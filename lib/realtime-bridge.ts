"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";
import { useAppStore, ChatMessage, BetChallenge, UserProfile } from "./store";
import { soundManager } from "./audio";
import { usePresenceStore, OnlinePeer, HEARTBEAT_MS } from "./presence";
import { dmIncludes, dmOtherId, isDmChannel } from "./chat";
import { isAccountId } from "./supabase-game";

type BridgeEvent =
  | { type: "PRESENCE"; peer: OnlinePeer }
  | { type: "PRESENCE_LEAVE"; id: string }
  | { type: "CHAT_MESSAGE"; payload: ChatMessage }
  | { type: "CHAT_REACTION"; payload: { channelId: string; messageId: string; emoji: string; userId: string } }
  | { type: "BET_UPDATE"; payload: BetChallenge };

const MAX_MESSAGES_PER_CHANNEL = 200;
const HISTORY_PUBLIC = 80;
const HISTORY_DM = 300;
const MISSING_TABLE = /chat_messages|does not exist|schema cache|could not find/i;

interface ChatRow {
  id: string;
  channel_id: string;
  sender_id: string;
  payload: ChatMessage;
  created_at: string;
}

/** Stored row → message; the author is whoever really sent it, not what the payload claims. */
function rowToMessage(r: ChatRow): ChatMessage {
  const m = r.payload;
  const senderId = m.senderId === "system" ? "system" : r.sender_id;
  return { ...m, id: r.id, channelId: r.channel_id, senderId, reactions: m.reactions ?? {} };
}

/**
 * One realtime pipe for the whole app:
 *  - BroadcastChannel for instant cross-tab sync on the same machine
 *  - one Supabase channel (broadcast + presence) for presence, reactions and guest chat
 *  - signed-in accounts: chat is stored in `chat_messages` (db/online.sql) and delivered with
 *    postgres_changes, so history survives reloads and RLS keeps DMs to the two people in them
 * Presence and peers live in `usePresenceStore`, chat lives in `useAppStore`.
 * Game moves never go through here: each online match has its own channel (lib/online-match).
 */
class RealtimeBridge {
  private bc: BroadcastChannel | null = null;
  private sb: RealtimeChannel | null = null;
  private chatDb: RealtimeChannel | null = null;
  /** Chat goes through the database (signed-in account) rather than broadcast. */
  private stored = false;
  private started = false;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private unsubPresence: (() => void) | null = null;

  /** Start once the user is authenticated. Safe to call many times. */
  init() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;

    try {
      this.bc = new BroadcastChannel("office_arena_v4");
      this.bc.onmessage = (e) => this.handle(e.data as BridgeEvent, "bc");
    } catch {
      this.bc = null;
    }

    if (isSupabaseConfigured) {
      const me = useAppStore.getState().currentUser;
      try {
        this.sb = supabase.channel("office_arena_global_v4", {
          config: { broadcast: { self: false }, presence: { key: me.id } },
        });
        this.sb
          .on("broadcast", { event: "evt" }, ({ payload }) => this.handle(payload as BridgeEvent, "sb"))
          .on("presence", { event: "sync" }, () => this.syncSupabasePresence())
          .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
            const myId = useAppStore.getState().currentUser.id;
            for (const p of (leftPresences as unknown as OnlinePeer[]) ?? []) {
              if (p?.id && p.id !== myId) usePresenceStore.getState().removePeer(p.id);
            }
            if (key && key !== myId) usePresenceStore.getState().removePeer(key);
          })
          .subscribe((status) => {
            if (status === "SUBSCRIBED") this.announce();
          });
      } catch (err) {
        console.warn("[realtime] Supabase channel failed:", err);
      }

      this.stored = isAccountId(me.id);
      if (this.stored) this.startStoredChat();
    }

    this.heartbeat = setInterval(() => {
      this.announce();
      usePresenceStore.getState().pruneStale();
    }, HEARTBEAT_MS);

    window.addEventListener("pagehide", this.leave);
    // Re-announce whenever my own status/location changes.
    this.unsubPresence = usePresenceStore.subscribe((s, prev) => {
      if (s.myStatus !== prev.myStatus || s.myLocation !== prev.myLocation) this.announce();
    });
    setTimeout(() => this.announce(), 300);
  }

  /** Tear down on sign-out. */
  stop() {
    if (!this.started) return;
    this.leave();
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.unsubPresence?.();
    this.unsubPresence = null;
    this.bc?.close();
    this.bc = null;
    if (this.sb) supabase.removeChannel(this.sb);
    this.sb = null;
    if (this.chatDb) supabase.removeChannel(this.chatDb);
    this.chatDb = null;
    this.stored = false;
    this.started = false;
    usePresenceStore.getState().replacePeers([]);
    window.removeEventListener("pagehide", this.leave);
  }

  private leave = () => {
    const id = useAppStore.getState().currentUser.id;
    this.post({ type: "PRESENCE_LEAVE", id }, false);
    try {
      this.sb?.untrack();
    } catch {
      /* ignore */
    }
  };

  private myPeer(): OnlinePeer {
    const u = useAppStore.getState().currentUser;
    const p = usePresenceStore.getState();
    return {
      id: u.id,
      username: u.username,
      avatar: u.avatar,
      title: u.title,
      status: p.myStatus,
      currentGame: p.myLocation,
      score: u.score,
      lua: u.lua,
      lastSeen: Date.now(),
      awaySince: p.myStatus === "away" ? p.awaySince ?? Date.now() : undefined,
    };
  }

  announce() {
    if (!this.started) return;
    const peer = this.myPeer();
    this.post({ type: "PRESENCE", peer }, false);
    try {
      this.sb?.track(peer);
    } catch {
      /* channel not ready yet */
    }
  }

  private syncSupabasePresence() {
    const state = this.sb?.presenceState() as Record<string, OnlinePeer[]> | undefined;
    if (!state) return;
    const myId = useAppStore.getState().currentUser.id;
    const store = usePresenceStore.getState();
    for (const [key, metas] of Object.entries(state)) {
      if (key === myId || !metas?.length) continue;
      const latest = metas[metas.length - 1];
      if (latest?.id && latest.id !== myId) store.upsertPeer({ ...latest, lastSeen: Date.now() });
    }
  }

  // ---------- stored chat ----------

  private startStoredChat() {
    this.chatDb = supabase
      .channel("chat-db")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, ({ new: row }) => {
        this.receiveMessage(rowToMessage(row as ChatRow));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages" }, ({ new: row }) => {
        const bet = (row as ChatRow).payload?.betChallenge;
        if (bet) useAppStore.getState().applyBetUpdate(bet);
      })
      .subscribe((status) => {
        // (Re)subscribed: fetch what may have arrived while the socket was down.
        if (status === "SUBSCRIBED") void this.loadHistory();
      });
  }

  /** Server without db/online.sql yet: keep chat working over broadcast instead. */
  private disableStoredChat() {
    if (!this.stored) return;
    console.warn("[chat] chat_messages is missing — run db/online.sql. Falling back to broadcast chat.");
    this.stored = false;
    if (this.chatDb) supabase.removeChannel(this.chatDb);
    this.chatDb = null;
  }

  private async loadHistory() {
    const [pub, dm] = await Promise.all([
      supabase.from("chat_messages").select("*").not("channel_id", "like", "dm-%").order("created_at", { ascending: false }).limit(HISTORY_PUBLIC),
      // RLS returns only the threads I am in.
      supabase.from("chat_messages").select("*").like("channel_id", "dm-%").order("created_at", { ascending: false }).limit(HISTORY_DM),
    ]);
    if (pub.error || dm.error) {
      const msg = (pub.error ?? dm.error)!.message;
      console.warn("[chat] history:", msg);
      if (MISSING_TABLE.test(msg)) this.disableStoredChat();
      return;
    }
    const rows = [...(pub.data as ChatRow[]), ...(dm.data as ChatRow[])];
    const store = useAppStore.getState();
    const myId = store.currentUser.id;
    const byChannel: Record<string, ChatMessage[]> = {};
    for (const r of rows) (byChannel[r.channel_id] ||= []).push(rowToMessage(r));

    const messages = { ...store.messages };
    for (const [ch, list] of Object.entries(byChannel)) {
      const seen = new Map((messages[ch] || []).map((m) => [m.id, m]));
      for (const m of list) seen.set(m.id, { ...m, reactions: seen.get(m.id)?.reactions ?? m.reactions });
      messages[ch] = [...seen.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-MAX_MESSAGES_PER_CHANNEL);
    }

    // Who is on the other side of each DM thread.
    const dmPeers = { ...store.dmPeers };
    const unknown: string[] = [];
    for (const [ch, list] of Object.entries(byChannel)) {
      if (!isDmChannel(ch) || dmPeers[ch]) continue;
      const theirs = list.find((m) => m.senderId !== myId && m.senderId !== "system");
      if (theirs) dmPeers[ch] = { id: theirs.senderId, username: theirs.senderName, avatar: theirs.senderAvatar };
      else unknown.push(dmOtherId(ch, myId));
    }
    if (unknown.length) {
      const { data } = await supabase.from("profiles").select("id, username, avatar").in("id", unknown);
      for (const p of (data ?? []) as { id: string; username: string | null; avatar: string | null }[]) {
        const ch = Object.keys(byChannel).find((c) => isDmChannel(c) && dmOtherId(c, myId) === p.id);
        if (ch) dmPeers[ch] = { id: p.id, username: p.username || "Đồng nghiệp", avatar: p.avatar || "" };
      }
    }
    useAppStore.setState({ messages, dmPeers });
  }

  // ---------- outgoing ----------

  sendChatMessage(message: ChatMessage) {
    if (!message) return;
    if (this.stored) {
      // Other tabs of mine get it at once; everyone else through the database.
      try {
        this.bc?.postMessage({ type: "CHAT_MESSAGE", payload: message } satisfies BridgeEvent);
      } catch {
        /* ignore */
      }
      const { reactions: _r, ...payload } = message;
      void supabase
        .from("chat_messages")
        .insert({ id: message.id, channel_id: message.channelId, sender_id: message.senderId === "system" ? useAppStore.getState().currentUser.id : message.senderId, payload })
        .then(({ error }) => {
          if (!error) return;
          console.warn("[chat] send:", error.message);
          if (MISSING_TABLE.test(error.message)) {
            this.disableStoredChat();
            this.post({ type: "CHAT_MESSAGE", payload: message }, !isDmChannel(message.channelId));
          }
        });
      return;
    }
    // Guests: broadcast only, and never put a private thread on the shared channel.
    this.post({ type: "CHAT_MESSAGE", payload: message }, !isDmChannel(message.channelId));
  }

  sendReaction(channelId: string, messageId: string, emoji: string) {
    const userId = useAppStore.getState().currentUser.id;
    this.post({ type: "CHAT_REACTION", payload: { channelId, messageId, emoji, userId } });
  }

  sendBetUpdate(challenge: BetChallenge) {
    if (this.stored) {
      // The server decides who got the bet; its answer may undo my local accept (refund in applyBetUpdate).
      void supabase.rpc("chat_update_bet", { p_bet: challenge }).then(({ data, error }) => {
        if (error) console.warn("[chat] bet:", error.message);
        else if (data) useAppStore.getState().applyBetUpdate(data as BetChallenge);
      });
      return;
    }
    this.post({ type: "BET_UPDATE", payload: challenge });
  }

  /** Back-compat helpers used by game lobbies. */
  getOnlinePeers(): UserProfile[] {
    return Object.values(usePresenceStore.getState().peers).map(peerToProfile);
  }

  subscribeToPeers(callback: (peers: UserProfile[]) => void) {
    callback(this.getOnlinePeers());
    return usePresenceStore.subscribe((s, prev) => {
      if (s.peers !== prev.peers) callback(Object.values(s.peers).map(peerToProfile));
    });
  }

  private post(evt: BridgeEvent, viaSupabase = true) {
    try {
      this.bc?.postMessage(evt);
    } catch {
      /* ignore */
    }
    if (viaSupabase && this.sb) {
      this.sb.send({ type: "broadcast", event: "evt", payload: evt }).catch(() => {});
    }
  }

  // ---------- incoming ----------

  private handle(evt: BridgeEvent, _from: "bc" | "sb") {
    if (!evt || !evt.type) return;
    const myId = useAppStore.getState().currentUser.id;
    switch (evt.type) {
      case "PRESENCE":
        if (evt.peer?.id && evt.peer.id !== myId) {
          usePresenceStore.getState().upsertPeer({ ...evt.peer, lastSeen: Date.now() });
        }
        break;
      case "PRESENCE_LEAVE":
        if (evt.id !== myId) usePresenceStore.getState().removePeer(evt.id);
        break;
      case "CHAT_MESSAGE":
        // No sender filter: the same account in another tab or device must see it too.
        // receiveMessage drops duplicates by id, so echoes of my own message are harmless.
        if (evt.payload?.id) this.receiveMessage(evt.payload);
        break;
      case "CHAT_REACTION":
        if (evt.payload.userId !== myId) {
          useAppStore.getState().applyReaction(evt.payload.channelId, evt.payload.messageId, evt.payload.emoji, evt.payload.userId);
        }
        break;
      case "BET_UPDATE":
        useAppStore.getState().applyBetUpdate(evt.payload);
        break;
    }
  }

  private receiveMessage(message: ChatMessage) {
    const store = useAppStore.getState();
    if (isDmChannel(message.channelId)) {
      // Direct messages travel on the shared pipe; only the two participants keep them.
      if (!dmIncludes(message.channelId, store.currentUser.id)) return;
      if (!store.dmPeers[message.channelId]) {
        useAppStore.setState({
          dmPeers: {
            ...store.dmPeers,
            [message.channelId]: { id: message.senderId, username: message.senderName, avatar: message.senderAvatar },
          },
        });
      }
    }
    const list = store.messages[message.channelId] || [];
    if (list.some((m) => m.id === message.id)) return;

    const isUnread = !store.isChatOpen || store.activeChannel !== message.channelId;
    const trimmed = [...list, message].slice(-MAX_MESSAGES_PER_CHANNEL);
    useAppStore.setState({
      messages: { ...store.messages, [message.channelId]: trimmed },
      unreadCounts: {
        ...store.unreadCounts,
        [message.channelId]: isUnread ? (store.unreadCounts[message.channelId] || 0) + 1 : 0,
      },
    });
    usePresenceStore.getState().noteMissedMessage();
    if (store.soundEnabled && isUnread) soundManager.playNotification();
  }
}

function peerToProfile(p: OnlinePeer): UserProfile {
  return {
    id: p.id,
    username: p.username,
    avatar: p.avatar,
    title: p.title,
    status: p.status === "offline" ? "away" : p.status,
    currentGame: p.currentGame,
    score: p.score,
    lua: p.lua,
    eloChess: p.score,
    eloXiangqi: p.score,
    eloWerewolf: p.score,
    eloArcade: p.score,
    stats: {
      chess: { wins: 0, losses: 0, draws: 0, games: 0 },
      xiangqi: { wins: 0, losses: 0, draws: 0, games: 0 },
      werewolf: { wins: 0, losses: 0, draws: 0, games: 0 },
      arcade: { wins: 0, losses: 0, draws: 0, games: 0 },
    },
    badges: [],
    equippedBadges: [],
  };
}

export const realtimeBridge = new RealtimeBridge();
