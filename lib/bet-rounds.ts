"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Các ván trong một kèo: hết ván cả hai quay lại phòng chờ, chủ phòng bấm Bắt đầu là ván mới.
 * Ván 1 dùng id kèo làm id bàn; ván sau là `<id kèo>~<số ván>`.
 */
export interface BetRound {
  round: number;
  /** Đang trong ván (true) hay đang ở phòng chờ giữa hai ván (false). */
  active: boolean;
  /** Tiền cược tạm giữ lúc nhận/tạo kèo đã trả lại chưa (trả ở ván đầu tiên có kết quả). */
  escrowBack: boolean;
  endedAt?: number;
}

interface BetRoundsState {
  rounds: Record<string, BetRound>;
  start: (betId: string, round: number) => void;
  end: (betId: string) => void;
  markEscrowBack: (betId: string) => void;
}

export const useBetRounds = create<BetRoundsState>()(
  persist(
    (set) => ({
      rounds: {},
      start: (betId, round) =>
        set((s) => ({ rounds: { ...s.rounds, [betId]: { ...(s.rounds[betId] ?? { escrowBack: false }), round, active: true } } })),
      end: (betId) =>
        set((s) => {
          const r = s.rounds[betId];
          if (!r || !r.active) return s;
          return { rounds: { ...s.rounds, [betId]: { ...r, active: false, endedAt: Date.now() } } };
        }),
      markEscrowBack: (betId) =>
        set((s) => ({ rounds: { ...s.rounds, [betId]: { ...(s.rounds[betId] ?? { round: 1, active: false }), escrowBack: true } } })),
    }),
    { name: "oa-bet-rounds-v1", storage: createJSONStorage(() => localStorage) }
  )
);

/** Id bàn (bảng matches / kênh realtime) của ván `round` trong kèo. */
export function roomOf(betId: string, round = 1) {
  return round <= 1 ? betId : `${betId}~${round}`;
}

/** Ván hiện tại của kèo (1 nếu máy này chưa ghi nhận ván nào). */
export function currentRound(betId: string) {
  return useBetRounds.getState().rounds[betId]?.round ?? 1;
}

/** Vào lại kèo: đang giữa ván thì vào thẳng bàn, đang nghỉ giữa hai ván thì về phòng chờ. */
export function rejoinTable(betId: string) {
  const r = useBetRounds.getState().rounds[betId];
  return r ? r.active : true;
}
