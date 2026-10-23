"use client";

import { create } from "zustand";
import type { GameType } from "./ranking-system";

export type ModalId = "wallet" | "ranking" | "profile" | "matchmaking" | "creator" | "rules" | null;

interface UiState {
  modal: ModalId;
  matchmakingGame: GameType;
  rulesGame: GameType;
  open: (modal: Exclude<ModalId, null>, opts?: { game?: GameType }) => void;
  close: () => void;
}

/** Global modal router so every screen shares one lazily-loaded instance. */
export const useUiStore = create<UiState>()((set) => ({
  modal: null,
  matchmakingGame: "chess",
  rulesGame: "chess",
  open: (modal, opts) =>
    set((s) => ({
      modal,
      matchmakingGame: modal === "matchmaking" && opts?.game ? opts.game : s.matchmakingGame,
      rulesGame: modal === "rules" && opts?.game ? opts.game : s.rulesGame,
    })),
  close: () => set({ modal: null }),
}));
