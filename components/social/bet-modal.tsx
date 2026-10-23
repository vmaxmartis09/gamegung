"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Swords, Coins, ShieldAlert, Check, Users, Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { GameType } from "@/lib/ranking-system";
import { cn } from "@/lib/utils";
import { ShinyText } from "@/components/reactbits/shiny-text";
import { BorderBeam } from "@/components/reactbits/border-beam";

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  defaultTargetId?: string;
}

const PRESET_STAKES = [50, 100, 200, 500];

export function BetModal({
  isOpen,
  onClose,
  channelId,
  defaultTargetId,
}: BetModalProps) {
  const { currentUser, friends, createBetChallenge, dmPeers } = useAppStore();
  const dmTarget = defaultTargetId && !friends.some((f) => f.id === defaultTargetId) ? dmPeers[channelId] : undefined;
  const [selectedGame, setSelectedGame] = useState<GameType>("chess");
  const [stake, setStake] = useState<number>(100);
  const [targetId, setTargetId] = useState<string>(defaultTargetId || "");
  const [error, setError] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (stake < 10) {
      setError("Mức cược tối thiểu là 10 Lúa 🌾!");
      return;
    }
    if (stake > currentUser.lua) {
      setError(`Số dư chỉ có ${currentUser.lua.toLocaleString()} Lúa 🌾!`);
      return;
    }

    const challenge = createBetChallenge(
      channelId,
      selectedGame,
      stake,
      targetId || undefined
    );

    if (challenge) {
      onClose();
    } else {
      setError("Không thể tạo thách đấu. Vui lòng kiểm tra lại số dư!");
    }
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
            className="modal-shell max-w-md"
          >
            {/* Animated Golden BorderBeam */}
            <BorderBeam size={220} duration={8} colorFrom="#f59e0b" colorTo="transparent" />

            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
                  <Swords className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wider text-white font-mono flex items-center gap-1.5">
                    <span>MỜI CHƠI</span>
                  </h3>
                  <p className="text-xs font-mono text-ink-400">
                    Đối kháng trực tiếp & thưởng Lúa 🌾
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-ink-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="py-4 space-y-4">
              {/* Game Selector */}
              <div>
                <label className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-400 block mb-2">
                  Bộ Môn Thi Đấu
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[
                    { id: "chess", label: "Cờ Vua", icon: "♟️" },
                    { id: "xiangqi", label: "Cờ Tướng", icon: "🀄" },
                    { id: "werewolf", label: "Ma Sói", icon: "🐺" },
                    { id: "uno", label: "Uno Battle", icon: "🎴" },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGame(g.id as GameType)}
                      className={cn(
                        "p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1",
                        selectedGame === g.id
                          ? "border-accent bg-accent/15 text-white font-bold "
                          : "border-white/10 bg-white/[0.02] text-ink-400 hover:border-white/20"
                      )}
                    >
                      <span className="text-xl">{g.icon}</span>
                      <span className="text-xs font-mono">{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Stake Amount */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-400">
                    Mức Cược Lúa 🌾
                  </label>
                  <span className="text-xs font-mono text-accent font-bold">
                    Ví: {currentUser.lua.toLocaleString()} 🌾
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-2">
                  {PRESET_STAKES.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setStake(amt);
                        setError(null);
                      }}
                      className={cn(
                        "py-1.5 rounded-xl text-xs font-mono font-bold border transition-all",
                        stake === amt
                          ? "border-accent bg-accent text-black shadow-md"
                          : "border-white/10 bg-white/[0.03] text-ink-300 hover:bg-white/[0.07]"
                      )}
                    >
                      {amt} 🌾
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min={10}
                    max={currentUser.lua}
                    value={stake}
                    onChange={(e) => {
                      setStake(parseInt(e.target.value) || 0);
                      setError(null);
                    }}
                    className="w-full bg-white/[0.03] border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-accent transition-colors"
                    placeholder="Mức cược tùy chỉnh..."
                  />
                  <span className="absolute right-3.5 top-2 text-xs font-mono text-accent font-bold">
                    🌾 LÚA
                  </span>
                </div>
              </div>

              {/* Target Opponent */}
              <div>
                <label className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-400 block mb-2">
                  Đối Thủ
                </label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full bg-[#121318] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white transition-colors font-mono"
                >
                  <option value="">📢 Kênh chung (ai cũng nhận được)</option>
                  {dmTarget && <option value={dmTarget.id}>⚔️ Mời riêng: {dmTarget.username}</option>}
                  {friends.map((f) => (
                    <option key={f.id} value={f.id}>
                      ⚔️ Thách đấu riêng: {f.username} ({f.title})
                    </option>
                  ))}
                </select>
              </div>

              {/* Escrow Note (Compact) */}
              <div className="p-2.5 rounded-xl bg-accent/5 border border-accent/20 text-xs font-mono text-ink-300 flex items-center gap-2">
                <span className="text-accent">⚖️</span>
                <span>
                  Trọng tài tạm giữ <strong>{stake} 🌾</strong>. Hoàn trả 100% nếu hủy kèo.
                </span>
              </div>

              {error && (
                <p className="text-xs text-rose-400 font-mono flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </p>
              )}

              {/* Submit */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 text-xs text-ink-400 hover:text-white"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={stake <= 0 || stake > currentUser.lua}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent text-black font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-accent/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>Xác Nhận ({stake} 🌾)</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default BetModal;
