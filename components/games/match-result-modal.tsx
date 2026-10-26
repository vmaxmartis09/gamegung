"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Home, MessageSquare, RotateCcw, X } from "lucide-react";
import confetti from "canvas-confetti";
import { soundManager } from "@/lib/audio";
import { MatchSettlementResult, useAppStore } from "@/lib/store";
import { GameIcon, GAME_BY_ID } from "@/components/art/game-art";
import { cn } from "@/lib/utils";
import { Emoji, EmojiText } from "@/components/ui/emoji";

interface MatchResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayAgain: () => void;
  resultData: MatchSettlementResult | null;
  /** Why the game ended, e.g. "Chiếu hết" */
  reason?: string;
}

const COPY = {
  win: { title: "Thắng đẹp!", sub: "ELO tăng, Lúa về ví.", emoji: "🏆", tone: "bg-lime-400 text-black" },
  loss: { title: "Thua rồi…", sub: "Mai gỡ. Hoặc gỡ ngay bây giờ.", emoji: "💀", tone: "bg-pop-red text-white" },
  draw: { title: "Hoà cờ", sub: "Không ai mất gì, trừ thời gian.", emoji: "🤝", tone: "seg-active" },
} as const;

export function MatchResultModal({ isOpen, onClose, onPlayAgain, resultData, reason }: MatchResultModalProps) {
  const soundEnabled = useAppStore((s) => s.soundEnabled);

  useEffect(() => {
    if (!isOpen || !resultData) return;
    if (resultData.result === "win") {
      if (soundEnabled) soundManager.playVictory();
      confetti({ particleCount: 110, spread: 75, origin: { y: 0.55 }, colors: ["#d4ff3a", "#9d7bff", "#ff5caa", "#3ddcff"] });
    }
    if (resultData.newBadges?.length) {
      const t = setTimeout(() => {
        if (soundEnabled) soundManager.playBadgeUnlock();
      }, 700);
      return () => clearTimeout(t);
    }
  }, [isOpen, resultData, soundEnabled]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const game = resultData?.gameType ?? "chess";
  const copy = COPY[resultData?.result ?? "draw"];

  return (
    <AnimatePresence>
      {isOpen && resultData && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4" onClick={onClose}>
          <motion.div
            initial={{ scale: 0.9, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 16 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={copy.title}
            className="panel relative w-full max-w-md overflow-hidden p-0"
          >
            <button type="button" onClick={onClose} aria-label="Đóng" className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-xl bg-black/40 text-ink-200 hover:text-white">
              <X className="size-4" />
            </button>
            <div className={cn("relative px-6 pb-6 pt-8 text-center", copy.tone)}>
              <div className="mx-auto mb-3 grid size-20 place-items-center rounded-[28px] border-[3px] border-black bg-white text-5xl shadow-brutal"><Emoji e={copy.emoji} /></div>
              <h2 className="font-display text-4xl font-extrabold tracking-tight">{copy.title}</h2>
              <p className="mt-1 text-sm font-semibold opacity-80">{reason ?? copy.sub}</p>
            </div>

            <div className="p-6">
              <div className="mb-4 flex items-center gap-2 text-xs text-ink-300">
                <GameIcon game={game} className="size-6" /> {GAME_BY_ID[game].name}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                  <p className="eyebrow text-xs">ELO</p>
                  <p className={cn("mt-1 font-display text-3xl font-extrabold tabular", resultData.playerEloChange > 0 ? "text-lime-400" : resultData.playerEloChange < 0 ? "text-pop-red" : "text-white")}>
                    {resultData.playerEloChange > 0 ? "+" : ""}
                    {resultData.playerEloChange}
                  </p>
                  <p className="text-xs text-ink-400">Mới: {resultData.newPlayerElo}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                  <p className="eyebrow text-xs">Lúa <Emoji e="🌾" /></p>
                  <p className={cn("mt-1 font-display text-3xl font-extrabold tabular", resultData.luaChange > 0 ? "text-white" : resultData.luaChange < 0 ? "text-pop-red" : "text-white")}>
                    {resultData.luaChange > 0 ? "+" : ""}
                    {resultData.luaChange}
                  </p>
                  <p className="text-xs text-ink-400">Ví: {resultData.newLuaBalance.toLocaleString("vi-VN")}</p>
                </div>
              </div>

              {resultData.newBadges?.length > 0 && (
                <div className="mt-3 rounded-2xl border border-pop-violet/30 bg-pop-violet/10 p-3">
                  <p className="text-xs font-bold text-pop-violet">Huy hiệu mới mở khoá</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {resultData.newBadges.map((b) => (
                      <span key={b.id} className="chip border-pop-violet/30 text-white">
                        <EmojiText>{b.icon}</EmojiText> {b.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 grid grid-cols-[1fr_auto_auto] gap-2">
                <button
                  type="button"
                  className="btn-lime py-3"
                  onClick={() => {
                    onClose();
                    onPlayAgain();
                  }}
                >
                  <RotateCcw className="size-4" /> Ván mới
                </button>
                <button
                  type="button"
                  className="btn-ghost px-3"
                  aria-label="Khoe lên chat"
                  onClick={() => {
                    const s = useAppStore.getState();
                    const line =
                      resultData.result === "win"
                        ? `🏆 Vừa thắng 1 ván ${GAME_BY_ID[game].name} (+${resultData.playerEloChange} ELO). Ai thách không?`
                        : resultData.result === "draw"
                        ? `🤝 Hoà 1 ván ${GAME_BY_ID[game].name}. Ván sau phân thắng bại!`
                        : `💀 Thua 1 ván ${GAME_BY_ID[game].name}. Cần người gỡ giúp…`;
                    s.sendMessage(game, line);
                    s.setActiveChannel(game);
                    s.toggleChat(true);
                    onClose();
                  }}
                >
                  <MessageSquare className="size-4" />
                </button>
                <Link href="/" className="btn-ghost px-3" aria-label="Về sảnh">
                  <Home className="size-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
