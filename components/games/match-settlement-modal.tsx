"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Award,
  Sparkles,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Zap,
  Home,
  CheckCircle2,
  XCircle,
  Equal,
} from "lucide-react";
import Link from "next/link";
import { BadgeDefinition, GameType, getRankTier } from "@/lib/ranking-system";
import { cn } from "@/lib/utils";

export interface MatchSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameType: GameType;
  result: "win" | "loss" | "draw";
  playerEloChange: number;
  newPlayerElo: number;
  luaChange: number;
  newLuaBalance: number;
  newBadges?: BadgeDefinition[];
  stake: number;
  opponentName?: string;
  onRematch?: () => void;
  onNewMatchmaking?: () => void;
}

export function MatchSettlementModal({
  isOpen,
  onClose,
  gameType,
  result,
  playerEloChange,
  newPlayerElo,
  luaChange,
  newLuaBalance,
  newBadges = [],
  stake,
  opponentName = "Đối Thủ",
  onRematch,
  onNewMatchmaking,
}: MatchSettlementModalProps) {
  const isWin = result === "win";
  const isLoss = result === "loss";
  const isDraw = result === "draw";

  const currentTier = getRankTier(newPlayerElo);

  const gameTitle =
    gameType === "chess"
      ? "Cờ Vua Quốc Tế"
      : gameType === "xiangqi"
      ? "Cờ Tướng Á Đông"
      : "Ma Sói Văn Phòng";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative z-10 w-full max-w-md bg-ink-950 border border-ink-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-white text-center overflow-hidden"
          >
            {/* Top gradient glow based on result */}
            <div
              className={cn(
                "absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r",
                isWin && "from-amber-500 via-yellow-300 to-amber-500",
                isLoss && "from-rose-600 via-red-500 to-rose-600",
                isDraw && "from-ink-500 via-ink-300 to-ink-500"
              )}
            />

            {/* Result Icon */}
            <div className="flex justify-center mb-4">
              <div
                className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border shadow-xl",
                  isWin &&
                    "bg-amber-950/40 border-amber-500/50 text-amber-300 shadow-amber-500/20",
                  isLoss &&
                    "bg-rose-950/40 border-rose-500/50 text-rose-300 shadow-rose-500/20",
                  isDraw &&
                    "bg-ink-900 border-ink-700 text-ink-300 shadow-ink-500/20"
                )}
              >
                {isWin ? "🏆" : isLoss ? "💥" : "🤝"}
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-black tracking-tight text-white uppercase">
              {isWin ? "CHIẾN THẮNG VANG DỘI!" : isLoss ? "BẠI TRẬN!" : "BẤT PHÂN THẮNG BẠI!"}
            </h2>
            <p className="text-xs text-ink-400 font-mono mt-1">
              {gameTitle} • Đối đầu {opponentName}
            </p>

            {/* Summary Stat Grid */}
            <div className="grid grid-cols-2 gap-3 my-6">
              {/* ELO Change Card */}
              <div className="p-4 rounded-2xl bg-ink-900/80 border border-ink-800 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-ink-400">
                  Biến Động ELO
                </span>
                <div className="flex items-center justify-center gap-1.5 my-1">
                  {playerEloChange >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-rose-400" />
                  )}
                  <span
                    className={cn(
                      "text-xl font-black font-mono",
                      playerEloChange > 0
                        ? "text-emerald-400"
                        : playerEloChange < 0
                        ? "text-rose-400"
                        : "text-ink-400"
                    )}
                  >
                    {playerEloChange > 0 ? `+${playerEloChange}` : playerEloChange}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-ink-300 flex items-center justify-center gap-1">
                  <span>Mới:</span>
                  <span className="font-bold text-white">{newPlayerElo}</span>
                  <span className="text-xs">{currentTier.icon}</span>
                </div>
              </div>

              {/* Lúa Coins Change Card */}
              <div className="p-4 rounded-2xl bg-ink-900/80 border border-ink-800 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-ink-400">
                  Tiền Cược Lúa 🌾
                </span>
                <div className="flex items-center justify-center gap-1.5 my-1">
                  <span
                    className={cn(
                      "text-xl font-black font-mono",
                      luaChange > 0
                        ? "text-amber-300"
                        : luaChange < 0
                        ? "text-rose-400"
                        : "text-ink-400"
                    )}
                  >
                    {luaChange > 0 ? `+${luaChange}` : luaChange}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-ink-300">
                  Số dư: <span className="font-bold text-amber-300">{newLuaBalance.toLocaleString()} 🌾</span>
                </div>
              </div>
            </div>

            {/* Unlocked Badges Notification (if any) */}
            {newBadges.length > 0 && (
              <div className="mb-6 p-3 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-left">
                <div className="flex items-center gap-1.5 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Huy Hiệu Mới Đã Mở Khóa!</span>
                </div>
                <div className="space-y-2">
                  {newBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className="flex items-center gap-2.5 p-2 rounded-xl bg-black/40 border border-amber-500/20"
                    >
                      <span className="text-2xl">{badge.icon}</span>
                      <div className="flex-1 truncate">
                        <p className="text-xs font-bold text-white truncate">{badge.name}</p>
                        <p className="text-[10px] text-ink-300 truncate">
                          {badge.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-ink-800">
              {onRematch && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRematch();
                  }}
                  className="w-full py-3 rounded-xl seg-active font-bold text-xs uppercase tracking-wider hover:bg-ink-200 transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02]"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Chơi Lại Ván Mới</span>
                </button>
              )}

              {onNewMatchmaking && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNewMatchmaking();
                  }}
                  className="w-full py-2.5 rounded-xl bg-ink-900 border border-ink-700 hover:border-ink-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Ghép Trận Đối Thủ Mới</span>
                </button>
              )}

              <Link
                href="/"
                className="w-full py-2.5 rounded-xl text-ink-400 hover:text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Rời phòng về sảnh</span>
              </Link>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
