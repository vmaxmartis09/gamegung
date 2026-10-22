"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { GameId } from "@/components/art/game-art";

/**
 * Games in progress, saved when the player leaves the table so they can pick
 * up exactly where they stopped. One slot per game, per account.
 */
export interface GameSession<T = unknown> {
  game: GameId;
  userId: string;
  savedAt: number;
  /** Short line for the resume pill, e.g. "Nước 14 · bạn cầm Trắng". */
  label: string;
  detail?: string;
  /** 0..1, how far into the game (drives the ring on the pill). */
  progress?: number;
  payload: T;
}

interface SessionState {
  sessions: Partial<Record<GameId, GameSession>>;
  save: <T>(s: GameSession<T>) => void;
  clear: (game: GameId) => void;
  get: <T>(game: GameId, userId: string) => GameSession<T> | null;
}

/** Sessions older than this are dropped rather than resumed. */
const MAX_AGE_MS = 3 * 24 * 3600 * 1000;

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: {},
      // One game at a time: saving a table drops any other game in progress.
      save: (s) => set({ sessions: { [s.game]: s as GameSession } }),
      clear: (game) =>
        set((st) => {
          if (!st.sessions[game]) return st;
          const next = { ...st.sessions };
          delete next[game];
          return { sessions: next };
        }),
      get: <T,>(game: GameId, userId: string) => {
        const s = get().sessions[game];
        if (!s || s.userId !== userId || Date.now() - s.savedAt > MAX_AGE_MS) return null;
        return s as GameSession<T>;
      },
    }),
    {
      name: "oa-game-sessions-v1",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export function sessionsFor(userId: string, sessions: Partial<Record<GameId, GameSession>>) {
  return Object.values(sessions).filter((s): s is GameSession => !!s && s.userId === userId && Date.now() - s.savedAt <= MAX_AGE_MS);
}
