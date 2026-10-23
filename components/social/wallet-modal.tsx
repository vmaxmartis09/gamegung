"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  Gift,
  LifeBuoy,
  History,
  TrendingUp,
  TrendingDown,
  Coins,
  CheckCircle2,
  AlertCircle,
  Database,
  Crown,
  ChevronRight,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useAppStore } from "@/lib/store";
import { soundManager } from "@/lib/audio";
import { calculateDailyBonus, DAILY_BONUS_TIERS } from "@/lib/ranking-system";
import { isSupabaseConfigured } from "@/lib/supabase";
import { CountUp } from "@/components/reactbits/count-up";
import { cn } from "@/lib/utils";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const {
    currentUser,
    transactions,
    claimDailyBonus,
    claimRelief,
    soundEnabled,
  } = useAppStore();

  const [notification, setNotification] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [showTierTable, setShowTierTable] = useState(false);

  // Calculate highest ELO for daily allowance scaling
  const highestElo = Math.max(
    currentUser.eloChess || 1200,
    currentUser.eloXiangqi || 1200,
    currentUser.eloWerewolf || 1000,
    currentUser.eloArcade || 1200
  );
  const bonusInfo = calculateDailyBonus(highestElo);

  const handleClaimDaily = () => {
    const res = claimDailyBonus();
    if (res.success) {
      if (soundEnabled) soundManager.playCoin();
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.5 } });
      setNotification({ type: "success", text: res.message });
    } else {
      setNotification({ type: "error", text: res.message });
    }
    setTimeout(() => setNotification(null), 4500);
  };

  const handleClaimRelief = () => {
    const res = claimRelief();
    if (res.success) {
      if (soundEnabled) soundManager.playCoin();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } });
      setNotification({ type: "success", text: res.message });
    } else {
      setNotification({ type: "error", text: res.message });
    }
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            className="modal-shell max-w-lg"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center text-lg shadow-inner">
                  🌾
                </div>
                <div>
                  <h3 className="font-display text-base font-bold tracking-tight text-white">
                    Ví Lúa
                  </h3>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-mono text-ink-400">
                      Số dư, điểm danh và lịch sử giao dịch
                    </p>
                    {isSupabaseConfigured && (
                      <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-white border border-white/20">
                        <Database className="w-2.5 h-2.5" /> Supabase Trigger
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-ink-400 hover:text-white hover:bg-ink-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification alert */}
            <AnimatePresence>
              {notification && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn(
                    "p-3 rounded-xl my-2 text-xs flex items-center gap-2 border font-mono",
                    notification.type === "success"
                      ? "bg-white/10 border-white/30 text-white"
                      : "bg-neutral-900 border-neutral-700 text-neutral-300"
                  )}
                >
                  {notification.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-neutral-400" />
                  )}
                  <span>{notification.text}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1 overflow-y-auto space-y-4 py-4 no-scrollbar">
              {/* Balance Card */}
              <div className="relative p-5 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-950 border border-accent/30  overflow-hidden">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-28 h-28 bg-accent/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider text-ink-400">
                      Số Dư Hiện Tại
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="font-display text-3xl sm:text-4xl font-bold tabular text-accent tracking-tight">
                        <CountUp value={currentUser.lua} />
                      </span>
                      <span className="text-xl">🌾</span>
                      <span className="text-xs font-mono text-ink-400">Lúa</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
                      Cấp bậc: {bonusInfo.tierName.split(" ")[0]}
                    </span>
                    <p className="text-[11px] font-mono text-ink-400 mt-2">
                      ELO tính thưởng: <span className="text-white font-bold">{highestElo}</span>
                    </p>
                  </div>
                </div>

                {/* Daily Bonus entitlement banner */}
                <div className="mt-4 p-3 rounded-xl bg-ink-950/70 border border-ink-800 text-xs flex items-center justify-between">
                  <div>
                    <p className="text-ink-300 font-medium flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-accent" />
                      Điểm danh hôm nay:{" "}
                      <span className="text-accent font-bold font-mono">
                        +{bonusInfo.total} Lúa 🌾
                      </span>
                    </p>
                    <p className="text-[10px] text-ink-500 font-mono mt-0.5">
                      Cơ bản 500 🌾 {bonusInfo.bonus > 0 ? `+ Thưởng ELO ${bonusInfo.bonus} 🌾` : "(Rank Tập Sự)"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowTierTable(!showTierTable)}
                    className="text-[10px] font-mono text-accent hover:text-accent underline"
                  >
                    {showTierTable ? "Ẩn bảng" : "Xem mốc ELO"}
                  </button>
                </div>

                {/* Expandable ELO Tier Table */}
                {showTierTable && (
                  <div className="mt-3 p-3 rounded-xl bg-ink-950 border border-ink-800 space-y-1.5 text-xs font-mono">
                    <p className="text-[10px] text-ink-400 uppercase font-semibold mb-1">
                      Bảng Thưởng Lúa Điểm Danh Hàng Ngày Theo ELO
                    </p>
                    {DAILY_BONUS_TIERS.map((tier) => {
                      const isCurrent = highestElo >= tier.minElo && highestElo <= tier.maxElo;
                      return (
                        <div
                          key={tier.name}
                          className={cn(
                            "flex items-center justify-between py-1 px-2 rounded-lg text-[11px] transition-colors",
                            isCurrent
                              ? "bg-accent/20 text-accent border border-accent/30 font-bold"
                              : "text-ink-400"
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            <span>{tier.icon}</span>
                            <span>{tier.name}</span>
                            {tier.minElo > 0 && <span className="opacity-60">({tier.minElo}+)</span>}
                          </span>
                          <span className={cn(isCurrent ? "text-accent font-bold" : "text-ink-300")}>
                            +{tier.total} 🌾 {isCurrent && "★ Bạn"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Quick actions */}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-ink-800">
                  <button
                    type="button"
                    onClick={handleClaimDaily}
                    className="btn-accent gap-2 px-3 py-2.5 text-xs"
                  >
                    <Gift className="w-4 h-4" />
                    <span>Điểm Danh (+{bonusInfo.total} 🌾)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClaimRelief}
                    disabled={currentUser.lua >= 100}
                    className={cn(
                      "flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all",
                      currentUser.lua < 100
                        ? "bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-300 hover:scale-[1.02]"
                        : "bg-ink-900 border-ink-800 text-ink-500 cursor-not-allowed opacity-60"
                    )}
                    title={
                      currentUser.lua >= 100
                        ? "Chỉ khả dụng khi số dư dưới 100 Lúa"
                        : "Nhận cứu trợ khẩn cấp"
                    }
                  >
                    <LifeBuoy className="w-4 h-4 text-rose-400" />
                    <span>Cứu Trợ (+200 🌾)</span>
                  </button>
                </div>
              </div>

              {/* Transactions Ledger */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-ink-400" />
                    Nhật Ký Giao Dịch ({transactions.length})
                  </h4>
                  <span className="text-[10px] font-mono text-ink-500">
                    Minh bạch & Tự động
                  </span>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1 no-scrollbar">
                  {transactions.map((tx) => {
                    const isPositive = tx.amount > 0;
                    return (
                      <div
                        key={tx.id}
                        className="p-3 rounded-xl bg-ink-900/60 border border-ink-800/80 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0",
                              isPositive
                                ? "bg-white/10 text-white border border-white/20"
                                : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                            )}
                          >
                            {isPositive ? (
                              <TrendingUp className="w-3.5 h-3.5" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="truncate">
                            <p className="font-medium text-white truncate">{tx.description}</p>
                            <p className="text-[10px] font-mono text-ink-500">
                              {new Date(tx.timestamp).toLocaleString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                day: "2-digit",
                                month: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 pl-3">
                          <span
                            className={cn(
                              "font-mono font-bold text-xs",
                              isPositive ? "text-white" : "text-neutral-400"
                            )}
                          >
                            {isPositive ? `+${tx.amount}` : tx.amount} 🌾
                          </span>
                          <p className="text-[10px] font-mono text-ink-400">
                            Dư: {tx.balanceAfter.toLocaleString()} 🌾
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-ink-800/80 flex items-center justify-between text-[11px] font-mono text-ink-400">
              <span>🌾 Khởi điểm: 1,000 Lúa • Điểm danh: 500+ Lúa</span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl seg-active font-semibold text-xs hover:bg-ink-200 transition-colors"
              >
                Đóng
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default WalletModal;
