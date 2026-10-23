"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Vote as VoteIcon, Mic } from "lucide-react";
import { WPlayer, WState, isWolf } from "@/lib/games/werewolf-engine";
import { cn } from "@/lib/utils";
import { CenterFlow, CenterFlowNode } from "@/components/reactbits/center-flow";
import { playNarratorVoice, stopNarratorVoice } from "@/lib/narrator-audio";
import { SeatCard } from "./werewolf-seat";

export interface WerewolfRoundtableProps {
  state: WState;
  humanPlayer: WPlayer;
  canTarget: (p: WPlayer) => boolean;
  onTarget: (p: WPlayer) => void;
  targetKind: string | null;
  secondsLeft: number | null;
  prompt: string;
  isHumanSpeaking?: boolean;
  isHumanMicOn?: boolean;
  humanVolume?: number;
  latestChats?: Record<string, string>; // speakerId -> text
  onOpenRotatingVote?: () => void;
}

export function WerewolfRoundtable({
  state,
  humanPlayer,
  canTarget,
  onTarget,
  secondsLeft,
  prompt,
  isHumanSpeaking = false,
  isHumanMicOn = false,
  latestChats = {},
  onOpenRotatingVote,
}: WerewolfRoundtableProps) {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isNarratorSpeaking, setIsNarratorSpeaking] = useState(false);
  const isNight = state.phase === "night" || state.phase === "reveal";
  const lastPromptRef = useRef<string>("");

  // Quản trò LyLy đọc theo từng bước
  useEffect(() => {
    if (!voiceEnabled || !prompt || prompt === lastPromptRef.current) return;
    lastPromptRef.current = prompt;

    let audioKey = "";
    if (state.phase === "night") {
      const steps = ["cupid", "guard", "wolves", "white_wolf", "seer", "witch"];
      audioKey = steps.includes(state.step) ? state.step : "night_falls";
    } else if (state.phase === "discussion") audioKey = "day_break";
    else if (state.phase === "vote") audioKey = "vote_start";
    else if (state.phase === "over") audioKey = state.winner === "lovers" ? "lovers_win" : state.winner === "wolves" ? "wolf_win" : "villager_win";

    if (audioKey) {
      setIsNarratorSpeaking(true);
      playNarratorVoice(audioKey, prompt, () => setIsNarratorSpeaking(false));
    }
  }, [prompt, state.phase, state.step, state.winner, voiceEnabled]);

  // Người chơi thật luôn ở đáy bàn
  const playersWithCoords = useMemo(() => {
    const total = state.players.length;
    const humanIdx = state.players.findIndex((p) => p.id === humanPlayer.id);
    return state.players.map((p, i) => {
      const relIdx = (i - humanIdx + total) % total;
      const angle = (relIdx / total) * (2 * Math.PI) + Math.PI / 2;
      return { ...p, x: 50 + 40 * Math.cos(angle), y: 50 + 36 * Math.sin(angle) };
    });
  }, [state.players, humanPlayer.id]);

  const knownRole = (p: WPlayer) => {
    if (p.isHuman || !p.alive || state.phase === "over" || !humanPlayer.alive) return p.role;
    if (isWolf(humanPlayer.role) && isWolf(p.role)) return p.role;
    return null;
  };

  const speakerIds = state.players.filter((p) => p.alive && (p.isHuman ? isHumanSpeaking : !!latestChats[p.id])).map((p) => p.id);
  const speakerNames = state.players.filter((p) => speakerIds.includes(p.id)).map((p) => (p.isHuman ? "Bạn" : p.name.split(" ")[0]));
  const canVote = state.phase === "vote" && onOpenRotatingVote && state.votes[humanPlayer.id] === undefined;

  const centerHub = (
    <div className="relative flex flex-col items-center justify-center">
      <div className="relative grid size-[120px] place-items-center sm:size-[140px]">
        {/* vòng quay + sóng lan */}
        <motion.span aria-hidden className={cn("absolute inset-0 rounded-full border border-dashed", isNight ? "border-violet-300/40" : "border-amber-300/50")} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 24, ease: "linear" }} />
        <motion.span aria-hidden className={cn("absolute inset-3 rounded-full border", isNight ? "border-violet-400/30" : "border-amber-400/40")} animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 16, ease: "linear" }} style={{ borderStyle: "dotted" }} />
        {[0, 1].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className={cn("absolute inset-6 rounded-full border-2", isNight ? "border-violet-400/50" : "border-amber-400/60")}
            animate={{ scale: [1, 1.7], opacity: [0.6, 0] }}
            transition={{ repeat: Infinity, duration: 2.6, delay: i * 1.3, ease: "easeOut" }}
          />
        ))}
        <motion.div animate={{ scale: [1, 1.12, 1], opacity: isNight ? [0.35, 0.6, 0.35] : [0.6, 0.95, 0.6] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }} className={cn("absolute inset-5 rounded-full blur-2xl", isNight ? "bg-violet-600/60" : "bg-amber-500/70")} />

        <div className={cn("relative z-10 grid size-[68px] place-items-center rounded-[22px] border text-3xl shadow-2xl sm:size-[76px]", isNight ? "border-violet-300/50 bg-gradient-to-br from-violet-950 to-slate-950 shadow-violet-900/60" : "border-amber-300/60 bg-gradient-to-br from-amber-900 to-orange-950 shadow-amber-900/60")}>
          <span className="select-none">{isNight ? "🌙" : "🔥"}</span>
          {isNarratorSpeaking && <span className="absolute inset-0 animate-ping rounded-[22px] border-2 border-amber-300/70" />}
          <button
            type="button"
            onClick={() => {
              if (voiceEnabled) stopNarratorVoice();
              setVoiceEnabled((v) => !v);
            }}
            title={voiceEnabled ? "Tắt giọng quản trò" : "Bật giọng quản trò"}
            className="absolute -bottom-2 -right-2 grid size-7 place-items-center rounded-full border-2 border-[#0b0914] bg-white/95 text-black shadow transition hover:scale-110 active:scale-95"
          >
            {voiceEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5 text-zinc-500" />}
          </button>
        </div>
      </div>

      <span className="-mt-1 font-mono text-[10px] font-extrabold uppercase tracking-[0.25em] text-white/70">
        {isNight ? "Đêm" : "Ngày"} {state.day}
        {secondsLeft !== null && <span className="ml-1.5 text-amber-300">· {secondsLeft}s</span>}
      </span>

      <AnimatePresence>
        {speakerNames.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="mt-1.5 flex items-center gap-1.5 rounded-full border border-lime-400/50 bg-lime-400/15 px-2.5 py-1 text-[11px] font-bold text-lime-200 shadow-[0_0_18px_-4px_rgba(163,230,53,0.7)]">
            <Mic className="size-3" /> {speakerNames.slice(0, 2).join(", ")}
          </motion.div>
        )}
      </AnimatePresence>

      {canVote && (
        <motion.button
          type="button"
          onClick={onOpenRotatingVote}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          className="mt-2 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 to-rose-500 px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-red-900/60"
          animate={{ boxShadow: ["0 0 0 0 rgba(244,63,94,0.6)", "0 0 0 12px rgba(244,63,94,0)"] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
        >
          <VoteIcon className="size-4" /> Bỏ phiếu
        </motion.button>
      )}
    </div>
  );

  const flowNodes: CenterFlowNode[] = playersWithCoords.map((p) => {
    const speaking = p.alive && (p.isHuman ? isHumanSpeaking : !!latestChats[p.id]);
    const micOn = p.alive && (p.isHuman ? isHumanMicOn || isHumanSpeaking : speaking);
    const chat = latestChats[p.id];
    const above = p.y > 50;
    const role = knownRole(p);
    return {
      id: p.id,
      x: p.x,
      y: p.y,
      isAlive: p.alive,
      active: speaking,
      color: isNight ? "#a855f7" : "#f59e0b",
      content: (
        <div className="relative">
          <AnimatePresence>
            {chat && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: above ? 6 : -6 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className={cn("pointer-events-none absolute left-1/2 z-50 w-max max-w-[170px] -translate-x-1/2 rounded-2xl bg-lime-300 px-3 py-1.5 text-center text-[11px] font-bold leading-snug text-black shadow-xl", above ? "bottom-full mb-2" : "top-full mt-2")}
              >
                {chat}
                <span className={cn("absolute left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-lime-300", above ? "-bottom-1" : "-top-1")} />
              </motion.div>
            )}
          </AnimatePresence>
          <SeatCard
            name={p.name}
            avatar={p.avatar}
            alive={p.alive}
            isMe={p.isHuman}
            role={role}
            packmate={!role && isWolf(humanPlayer.role) && isWolf(p.role)}
            targetable={canTarget(p)}
            micOn={micOn}
            speaking={speaking}
            hasVoted={state.phase === "vote" && state.votes[p.id] !== undefined}
            lover={!!state.lovers?.includes(p.id)}
            onClick={() => onTarget(p)}
          />
        </div>
      ),
    };
  });

  return (
    <div className="relative w-full">
      {state.lovers && (
        <svg className="pointer-events-none absolute inset-0 z-[25] h-full w-full">
          <defs>
            <linearGradient id="lovers-beam-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f472b6" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          {(() => {
            const l1 = playersWithCoords.find((p) => p.id === state.lovers![0]);
            const l2 = playersWithCoords.find((p) => p.id === state.lovers![1]);
            if (l1 && l2 && l1.alive && l2.alive) {
              return <line x1={`${l1.x}%`} y1={`${l1.y}%`} x2={`${l2.x}%`} y2={`${l2.y}%`} stroke="url(#lovers-beam-grad)" strokeWidth="2.5" strokeDasharray="4 4" className="animate-pulse" />;
            }
            return null;
          })()}
        </svg>
      )}

      <CenterFlow centerNode={centerHub} nodes={flowNodes} isNight={isNight} />
    </div>
  );
}

export default WerewolfRoundtable;
