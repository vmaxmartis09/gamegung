"use client";

import { create } from "zustand";
import type { PresenceStatus } from "@/components/ui/user-avatar";

export interface OnlinePeer {
  id: string;
  username: string;
  avatar: string;
  title: string;
  status: PresenceStatus;
  /** Human label of where the peer is, e.g. "Cờ Vua" */
  currentGame?: string;
  score: number;
  lua: number;
  lastSeen: number;
  /** When the peer went Away (for "away 5 phút"). */
  awaySince?: number;
}

/** Idle for this long → Away. */
export const AWAY_IDLE_MS = 2 * 60 * 1000;
/** Tab hidden for this long → Away. */
export const AWAY_HIDDEN_MS = 45 * 1000;
/** A peer that has not pinged for this long is considered gone. */
export const PEER_STALE_MS = 50 * 1000;
export const HEARTBEAT_MS = 15 * 1000;

interface PresenceState {
  myStatus: PresenceStatus;
  /** Where I am right now (route label). */
  myLocation: string;
  /** Timestamp I went away, used for the "while you were away" summary. */
  awaySince: number | null;
  /** Messages that arrived while I was away. */
  missedWhileAway: number;
  /** User-chosen status (Away / Do not disturb). Overrides automatic status. */
  manualStatus: "away" | "busy" | null;
  setManualStatus: (status: "away" | "busy" | null) => void;
  peers: Record<string, OnlinePeer>;
  noteMissedMessage: () => void;
  clearMissed: () => void;
  setMyStatus: (status: PresenceStatus) => void;
  setMyLocation: (label: string) => void;
  upsertPeer: (peer: OnlinePeer) => void;
  removePeer: (id: string) => void;
  replacePeers: (peers: OnlinePeer[]) => void;
  pruneStale: () => void;
}

export const usePresenceStore = create<PresenceState>()((set, get) => ({
  myStatus: "online",
  myLocation: "Sảnh chờ",
  awaySince: null,
  missedWhileAway: 0,
  manualStatus: null,
  setManualStatus: (manual) => {
    set({ manualStatus: manual });
    if (manual) get().setMyStatus(manual);
    else set({ myStatus: "online", awaySince: null });
  },
  peers: {},
  noteMissedMessage: () => {
    if (get().myStatus === "away") set((s) => ({ missedWhileAway: s.missedWhileAway + 1 }));
  },
  clearMissed: () => set({ missedWhileAway: 0, awaySince: null }),
  setMyStatus: (requested) => {
    const status = get().manualStatus ?? requested;
    const prev = get().myStatus;
    if (prev === status) return;
    set({
      myStatus: status,
      awaySince: status === "away" ? Date.now() : prev === "away" ? get().awaySince : null,
    });
  },
  setMyLocation: (label) => {
    if (get().myLocation !== label) set({ myLocation: label });
  },
  upsertPeer: (peer) =>
    set((s) => {
      const old = s.peers[peer.id];
      if (
        old &&
        old.status === peer.status &&
        old.currentGame === peer.currentGame &&
        old.username === peer.username &&
        old.avatar === peer.avatar &&
        old.score === peer.score &&
        old.lua === peer.lua
      ) {
        // Only bump lastSeen without re-rendering subscribers that read other fields.
        old.lastSeen = peer.lastSeen;
        return s;
      }
      return { peers: { ...s.peers, [peer.id]: peer } };
    }),
  removePeer: (id) =>
    set((s) => {
      if (!s.peers[id]) return s;
      const next = { ...s.peers };
      delete next[id];
      return { peers: next };
    }),
  replacePeers: (list) => {
    const next: Record<string, OnlinePeer> = {};
    for (const p of list) next[p.id] = p;
    set({ peers: next });
  },
  pruneStale: () => {
    const now = Date.now();
    const { peers } = get();
    let changed = false;
    const next: Record<string, OnlinePeer> = {};
    for (const p of Object.values(peers)) {
      if (now - p.lastSeen > PEER_STALE_MS) changed = true;
      else next[p.id] = p;
    }
    if (changed) set({ peers: next });
  },
}));

const STATUS_ORDER: Record<PresenceStatus, number> = { "in-game": 0, online: 1, busy: 2, away: 3, offline: 4 };

export function sortPeers(peers: OnlinePeer[]) {
  return [...peers].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.username.localeCompare(b.username, "vi")
  );
}

/** Route → human label shown to others. */
export function locationFromPath(pathname: string | null): { label: string; inGame: boolean } {
  const p = pathname || "/";
  if (p.startsWith("/games/chess")) return { label: "Cờ Vua", inGame: true };
  if (p.startsWith("/games/xiangqi")) return { label: "Cờ Tướng", inGame: true };
  if (p.startsWith("/games/werewolf")) return { label: "Ma Sói", inGame: true };
  if (p.startsWith("/games/arcade")) return { label: "Cyber Slash", inGame: true };
  if (p.startsWith("/games/uno")) return { label: "Deadline Rush", inGame: true };
  if (p.startsWith("/games/typing")) return { label: "Typing Battle", inGame: true };
  return { label: "Sảnh chờ", inGame: false };
}
