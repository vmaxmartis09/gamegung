"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Skull, Heart, Shield, Crosshair } from "lucide-react";
import { Emoji, EmojiText } from "@/components/ui/emoji";

export type FxType =
  | "claw"
  | "poison"
  | "heal"
  | "seer"
  | "shield"
  | "hunter"
  | "cupid"
  | "execution";

export interface WerewolfFxEvent {
  id: string;
  type: FxType;
  targetName?: string;
  targetId?: string;
  seerResultIsWolf?: boolean;
}

export function WerewolfActionFxOverlay({
  currentFx,
  onFinish,
}: {
  currentFx: WerewolfFxEvent | null;
  onFinish: () => void;
}) {
  useEffect(() => {
    if (!currentFx) return;
    const timer = setTimeout(() => {
      onFinish();
    }, 2400);
    return () => clearTimeout(timer);
  }, [currentFx, onFinish]);

  if (!currentFx) return null;

  return (
    <AnimatePresence>
      <div className="absolute inset-0 pointer-events-none z-[50] grid place-items-center overflow-hidden rounded-[36px]">
        {/* ========================================================= */}
        {/* 1. SÓI CÀO XÉ (CLAW SLASH) */}
        {/* ========================================================= */}
        {currentFx.type === "claw" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex flex-col items-center justify-center w-full h-full"
          >
            {/* Blood red vignette screen flash */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.7, 0.2, 0.6, 0] }}
              transition={{ duration: 1.2, times: [0, 0.2, 0.4, 0.7, 1] }}
              className="absolute inset-0 bg-red-950/70 backdrop-blur-[2px]"
            />

            {/* Claw Slash Marks */}
            <div className="relative w-80 h-72">
              <svg viewBox="0 0 320 280" className="w-full h-full filter drop-shadow-[0_0_25px_rgba(239,68,68,0.9)]">
                {/* Slash 1 */}
                <motion.path
                  d="M40 30 Q140 130 260 230"
                  stroke="#ef4444"
                  strokeWidth="8"
                  strokeLinecap="round"
                  fill="none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
                {/* Slash 2 */}
                <motion.path
                  d="M70 20 Q170 120 290 220"
                  stroke="#dc2626"
                  strokeWidth="11"
                  strokeLinecap="round"
                  fill="none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 0.8, delay: 0.08, ease: "easeOut" }}
                />
                {/* Slash 3 */}
                <motion.path
                  d="M100 15 Q200 115 310 205"
                  stroke="#991b1b"
                  strokeWidth="8"
                  strokeLinecap="round"
                  fill="none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 0.8, delay: 0.16, ease: "easeOut" }}
                />
              </svg>
            </div>

            {/* Banner announcement */}
            <motion.div
              initial={{ scale: 0.8, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-4 rounded-2xl bg-black/90 border-2 border-red-500/80 px-6 py-2.5 text-center shadow-[0_0_35px_rgba(239,68,68,0.6)]"
            >
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-red-400 font-bold">
                <Emoji e="🐺" /> BẦY SÓI RA TAY
              </p>
              <p className="font-display text-lg font-black text-white">
                Mục tiêu: {currentFx.targetName || "Con mồi"}
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* ========================================================= */}
        {/* 2. PHÙ THỦY ĐẦU ĐỘC (POISON BUBBLE & SKULL) */}
        {/* ========================================================= */}
        {currentFx.type === "poison" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex flex-col items-center justify-center w-full h-full"
          >
            {/* Toxic purple haze */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.75, 0.2, 0] }}
              transition={{ duration: 1.6 }}
              className="absolute inset-0 bg-purple-950/70 backdrop-blur-[2px]"
            />

            {/* Toxic Skull Sigil */}
            <motion.div
              initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
              animate={{ scale: [0.5, 1.2, 1], rotate: 0, opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="relative size-32 rounded-full border-4 border-purple-500 bg-purple-950/90 shadow-[0_0_60px_rgba(168,85,247,0.8)] grid place-items-center"
            >
              <Skull className="size-16 text-purple-300 animate-pulse" />
              {/* Bubbles */}
              <motion.div
                animate={{ y: [-10, -50], opacity: [1, 0], scale: [0.8, 1.4] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="absolute -top-4 size-5 rounded-full bg-purple-400/80 blur-[1px]"
              />
              <motion.div
                animate={{ y: [-15, -60], opacity: [1, 0], scale: [0.6, 1.2] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
                className="absolute -top-2 -right-3 size-4 rounded-full bg-fuchsia-400/80 blur-[1px]"
              />
            </motion.div>

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-6 rounded-2xl bg-black/90 border-2 border-purple-500/80 px-6 py-2.5 text-center shadow-[0_0_35px_rgba(168,85,247,0.6)]"
            >
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400 font-bold">
                <Emoji e="🧪" /> BÌNH THUỐC ĐỘC CỦA PHÙ THỦY
              </p>
              <p className="font-display text-lg font-black text-white">
                Đầu độc {currentFx.targetName || "Nạn nhân"}!
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* ========================================================= */}
        {/* 3. PHÙ THỦY CỨU SỐNG (HEAL ELIXIR) */}
        {/* ========================================================= */}
        {currentFx.type === "heal" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex flex-col items-center justify-center w-full h-full"
          >
            {/* Emerald radiance */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.7, 0.15, 0] }}
              transition={{ duration: 1.5 }}
              className="absolute inset-0 bg-emerald-950/60 backdrop-blur-[2px]"
            />

            {/* Sacred Emerald Elixir */}
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: [0.4, 1.2, 1], opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="relative size-32 rounded-full border-4 border-emerald-400 bg-emerald-950/90 shadow-[0_0_60px_rgba(16,185,129,0.8)] grid place-items-center"
            >
              <Sparkles className="size-16 text-emerald-300 animate-spin-slow" />
              {/* Expanding Light Rings */}
              <motion.div
                animate={{ scale: [1, 2], opacity: [0.8, 0] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="absolute inset-0 rounded-full border-2 border-emerald-300"
              />
            </motion.div>

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-6 rounded-2xl bg-black/90 border-2 border-emerald-500/80 px-6 py-2.5 text-center shadow-[0_0_35px_rgba(16,185,129,0.6)]"
            >
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400 font-bold">
                <Emoji e="🧪" /> BÌNH TIÊN DƯỢC CỨU SỐNG
              </p>
              <p className="font-display text-lg font-black text-white">
                Cứu sống {currentFx.targetName || "Người bị cắn"} khỏi tử thần!
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* ========================================================= */}
        {/* 4. TIÊN TRI SOI THÂN PHẬN (SEER EYE FX) */}
        {/* ========================================================= */}
        {currentFx.type === "seer" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex flex-col items-center justify-center w-full h-full"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.65, 0] }}
              transition={{ duration: 1.8 }}
              className="absolute inset-0 bg-indigo-950/60 backdrop-blur-[2px]"
            />

            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 1.25, 1], opacity: 1 }}
              transition={{ duration: 0.7 }}
              className="relative size-36 rounded-full border-4 border-indigo-400 bg-indigo-950/90 shadow-[0_0_70px_rgba(99,102,241,0.9)] grid place-items-center"
            >
              <span className="text-6xl animate-pulse">
                <EmojiText>{currentFx.seerResultIsWolf ? "🐺" : "🔮"}</EmojiText>
              </span>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-6 rounded-2xl bg-black/90 border-2 border-indigo-500 px-6 py-2.5 text-center shadow-[0_0_35px_rgba(99,102,241,0.6)]"
            >
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-indigo-300 font-bold">
                <Emoji e="🔮" /> TIÊN TRI KHAI NHÃN
              </p>
              <p className="font-display text-xl font-black text-white mt-1">
                {currentFx.targetName}:{" "}
                <span className={currentFx.seerResultIsWolf ? "text-red-400" : "text-emerald-400"}>
                  <EmojiText>{currentFx.seerResultIsWolf ? "LÀ SÓI! 🐺" : "LÀ DÂN LÀNH ✅"}</EmojiText>
                </span>
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* ========================================================= */}
        {/* 5. BẢO VỆ CHE CHỞ (GUARDIAN SHIELD FX) */}
        {/* ========================================================= */}
        {currentFx.type === "shield" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex flex-col items-center justify-center w-full h-full"
          >
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: [0.4, 1.3, 1], opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="relative size-36 rounded-full border-4 border-emerald-400 bg-emerald-950/90 shadow-[0_0_60px_rgba(16,185,129,0.8)] grid place-items-center"
            >
              <Shield className="size-20 text-emerald-300" />
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-6 rounded-2xl bg-black/90 border-2 border-emerald-500 px-6 py-2.5 text-center shadow-[0_0_35px_rgba(16,185,129,0.6)]"
            >
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400 font-bold">
                <Emoji e="🛡️" /> LÁ CHẮN BẢO VỆ
              </p>
              <p className="font-display text-lg font-black text-white">
                Đã che chở an toàn cho {currentFx.targetName || "Mục tiêu"}!
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* ========================================================= */}
        {/* 6. THẦN TÌNH YÊU CUPID (LOVE ARROW FX) */}
        {/* ========================================================= */}
        {currentFx.type === "cupid" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex flex-col items-center justify-center w-full h-full"
          >
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 1.3, 1], opacity: 1 }}
              transition={{ duration: 0.7 }}
              className="relative size-36 rounded-full border-4 border-pink-400 bg-pink-950/90 shadow-[0_0_70px_rgba(236,72,153,0.9)] grid place-items-center"
            >
              <Heart className="size-20 text-pink-300 animate-pulse fill-pink-500" />
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-6 rounded-2xl bg-black/90 border-2 border-pink-500 px-6 py-2.5 text-center shadow-[0_0_35px_rgba(236,72,153,0.6)]"
            >
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-pink-400 font-bold">
                <Emoji e="💘" /> MŨI TÊN TÌNH DUYÊN
              </p>
              <p className="font-display text-lg font-black text-white">
                Hai trái tim đã được gắn kết sinh tử có nhau!
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* ========================================================= */}
        {/* 7. THỢ SĂN BẮN (HUNTER SNIPER SHOT) */}
        {/* ========================================================= */}
        {currentFx.type === "hunter" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex flex-col items-center justify-center w-full h-full"
          >
            <motion.div
              initial={{ scale: 1.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="relative size-36 rounded-full border-4 border-amber-400 bg-amber-950/90 shadow-[0_0_60px_rgba(245,158,11,0.8)] grid place-items-center"
            >
              <Crosshair className="size-24 text-amber-300 animate-spin-slow" />
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-6 rounded-2xl bg-black/90 border-2 border-amber-500 px-6 py-2.5 text-center shadow-[0_0_35px_rgba(245,158,11,0.6)]"
            >
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400 font-bold">
                <Emoji e="🏹" /> PHÁT BẮN PHỤC HẬN CỦA THỢ SĂN
              </p>
              <p className="font-display text-lg font-black text-white">
                Bắn hạ {currentFx.targetName || "Kẻ thù"}!
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* ========================================================= */}
        {/* 8. TREO CỔ VOTE (EXECUTION FX) */}
        {/* ========================================================= */}
        {currentFx.type === "execution" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex flex-col items-center justify-center w-full h-full"
          >
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, type: "spring" }}
              className="relative size-36 rounded-full border-4 border-zinc-200 bg-black/95 shadow-[0_0_60px_rgba(255,255,255,0.7)] grid place-items-center text-6xl"
            >
              <Emoji e="🪢" />
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-6 rounded-2xl bg-black/90 border-2 border-white px-6 py-2.5 text-center shadow-[0_0_35px_rgba(255,255,255,0.4)]"
            >
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/80 font-bold">
                <Emoji e="⚖️" /> BẢN ÁN CỦA DÂN LÀNG
              </p>
              <p className="font-display text-lg font-black text-white">
                {currentFx.targetName} bị treo cổ theo phán quyết số đông!
              </p>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
