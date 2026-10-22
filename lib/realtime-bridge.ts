"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";
import { useAppStore, ChatMessage, BetChallenge, UserProfile } from "./store";
import { soundManager } from "./audio";
import { usePresenceStore, OnlinePeer, HEARTBEAT_MS } from "./presence";
import { dmIncludes, isDmChannel } from "./chat";

type BridgeEvent =
  | { type: "PRESENCE"; peer: OnlinePeer }
  | { type: "PRESENCE_LEAVE"; id: string }
  | { type: "CHAT_MESSAGE"; payload: ChatMessage }
  | { type: "CHAT_REACTION"; payload: { channelId: string; messageId: string; emoji: string; userId: string } }
  | { type: "BET_UPDATE"; payload: BetChallenge }
  | { type: "ROOM_EVENT"; payload: { event: string; roomId: string; data: unknown } };

const MAX_MESSAGES_PER_CHANNEL = 200;

/**
 * One realtime pipe for the whole app:
 *  - BroadcastChannel for instant cross-tab sync on the same machine
 *  - one Supabase channel (broadcast + presence) for cross-device
 * Presence and peers live in `usePresenceStore`, chat lives in `useAppStore`.
 */
class RealtimeBridge {
  private bc: BroadcastChannel | null = null;
  private sb: RealtimeChannel | null = null;
  private started = false;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private unsubPresence: (() => void) | null = null;
  private roomListeners = new Set<(e: { event: string; roomId: string; data: unknown }) => void>();

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

  // ---------- outgoing ----------

  sendChatMessage(message: ChatMessage) {
    this.post({ type: "CHAT_MESSAGE", payload: message });
  }

  sendReaction(channelId: string, messageId: string, emoji: string) {
    const userId = useAppStore.getState().currentUser.id;
    this.post({ type: "CHAT_REACTION", payload: { channelId, messageId, emoji, userId } });
  }

  sendBetUpdate(challenge: BetChallenge) {
    this.post({ type: "BET_UPDATE", payload: challenge });
  }

  sendRoomEvent(roomEvent: { event: string; roomId: string; data: unknown }) {
    this.post({ type: "ROOM_EVENT", payload: roomEvent });
  }

  onRoomEvent(cb: (e: { event: string; roomId: string; data: unknown }) => void) {
    this.roomListeners.add(cb);
    return () => {
      this.roomListeners.delete(cb);
    };
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
        if (evt.payload?.senderId !== myId) this.receiveMessage(evt.payload);
        break;
      case "CHAT_REACTION":
        if (evt.payload.userId !== myId) {
          useAppStore.getState().applyReaction(evt.payload.channelId, evt.payload.messageId, evt.payload.emoji, evt.payload.userId);
        }
        break;
      case "BET_UPDATE":
        useAppStore.getState().applyBetUpdate(evt.payload);
        break;
      case "ROOM_EVENT":
        this.roomListeners.forEach((l) => l(evt.payload));
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
