"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Skull,
  Timer,
  Volume2,
  VolumeX,
  Heart,
  Crown,
  Flame,
  Shield,
  Eye,
  Lock,
} from "lucide-react";
import {
  WPlayer,
  WState,
  ROLE_INFO,
  Role,
  isWolf,
} from "@/lib/games/werewolf-engine";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { CenterFlow, CenterFlowNode } from "@/components/reactbits/center-flow";
import { playNarratorVoice, stopNarratorVoice } from "@/lib/narrator-audio";

export interface WerewolfRoundtableProps {
  state: WState;
  humanPlayer: WPlayer;
  canTarget: (p: WPlayer) => boolean;
  onTarget: (p: WPlayer) => void;
  targetKind: string | null;
  secondsLeft: number | null;
  prompt: string;
  isHumanSpeaking?: boolean;
  humanVolume?: number;
  latestChats?: Record<string, string>; // speakerId -> text
  onOpenRotatingVote?: () => void;
}

export function WerewolfRoundtable({
  state,
  humanPlayer,
  canTarget,
  onTarget,
  targetKind,
  secondsLeft,
  prompt,
  isHumanSpeaking = false,
  latestChats = {},
  onOpenRotatingVote,
}: WerewolfRoundtableProps) {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isNarratorSpeaking, setIsNarratorSpeaking] = useState(false);
  const isNight = state.phase === "night" || state.phase === "reveal";
  const lastPromptRef = useRef<string>("");

  // Automated LyLy Cloned Voice Narration
  useEffect(() => {
    if (!voiceEnabled || !prompt || prompt === lastPromptRef.current) return;
    lastPromptRef.current = prompt;

    // Determine audio key based on phase & step
    let audioKey = "";
    if (state.phase === "night") {
      if (state.step === "cupid") audioKey = "cupid";
      else if (state.step === "guard") audioKey = "guard";
      else if (state.step === "wolves") audioKey = "wolves";
      else if (state.step === "white_wolf") audioKey = "white_wolf";
      else if (state.step === "seer") audioKey = "seer";
      else if (state.step === "witch") audioKey = "witch";
      else audioKey = "night_falls";
    } else if (state.phase === "discussion") {
      audioKey = "day_break";
    } else if (state.phase === "vote") {
      audioKey = "vote_start";
    } else if (state.phase === "over") {
      if (state.winner === "lovers") audioKey = "lovers_win";
      else if (state.winner === "wolves") audioKey = "wolf_win";
      else audioKey = "villager_win";
    }

    if (audioKey) {
      setIsNarratorSpeaking(true);
      playNarratorVoice(audioKey, prompt, () => {
        setIsNarratorSpeaking(false);
      });
    }
  }, [prompt, state.phase, state.step, state.winner, voiceEnabled]);

  // Compute circular layout coordinates for all players
  // Human player is placed at the bottom (90 degrees / angle = PI / 2)
  const playersWithCoords = useMemo(() => {
    const total = state.players.length;
    const humanIdx = state.players.findIndex((p) => p.id === humanPlayer.id);

    return state.players.map((p, i) => {
      const relIdx = (i - humanIdx + total) % total;
      const angle = (relIdx / total) * (2 * Math.PI) + Math.PI / 2;

      // Ellipse radii (percentage from center 50%, 50%)
      const rx = 40; // width radius %
      const ry = 36; // height radius %

      const x = 50 + rx * Math.cos(angle);
      const y = 50 + ry * Math.sin(angle);

      return {
        ...p,
        x,
        y,
        angle,
      };
    });
  }, [state.players, humanPlayer.id]);

  const knownRole = (p: WPlayer) => {
    if (p.isHuman || !p.alive || state.phase === "over" || !humanPlayer.alive) return p.role;
    if (isWolf(humanPlayer.role) && isWolf(p.role)) return p.role;
    return null;
  };

  const isLover = (id: string) => state.lovers && state.lovers.includes(id);

  // Center Hub component: LyLy Quản Trò & Campfire
  const centerHub = (
    <div className="relative flex flex-col items-center justify-center">
      {/* Campfire / Altar Visual */}
      <div className="relative size-24 sm:size-28 rounded-full grid place-items-center">
        {/* Flame Ambient Glow */}
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: isNight ? [0.3, 0.55, 0.3] : [0.65, 0.95, 0.65],
          }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className={cn(
            "absolute inset-0 rounded-full blur-2xl",
            isNight ? "bg-purple-600/50" : "bg-amber-500/70"
          )}
        />

        {/* Narrator LyLy Avatar & Speaking Wave */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          <div className="relative size-14 sm:size-16 rounded-full border-2 border-amber-400 bg-gradient-to-tr from-amber-950 via-slate-900 to-amber-900 flex items-center justify-center text-2xl shadow-xl overflow-hidden">
            <span className="text-3xl select-none">
              {isNight ? "🧙‍♀️" : "🔥"}
            </span>
            {isNarratorSpeaking && (
              <span className="absolute inset-0 rounded-full border-2 border-amber-300 animate-ping pointer-events-none" />
            )}
          </div>
          <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-amber-300 mt-1 drop-shadow">
            {isNight ? `Đêm ${state.day}` : `Ngày ${state.day}`}
          </span>
        </div>
      </div>

      {/* Quản Trò Announcement Bubble */}
      <motion.div
        key={prompt}
        initial={{ scale: 0.9, opacity: 0, y: 5 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative mt-1 max-w-[280px] sm:max-w-xs rounded-2xl bg-black/85 border border-white/15 px-3.5 py-2 text-center shadow-xl backdrop-blur-md"
      >
        <div className="flex items-center justify-center gap-1.5 mb-0.5">
          <Crown className="size-3 text-amber-400" />
          <span className="font-mono text-[9px] font-black uppercase tracking-wider text-amber-300">
            Quản Trò LyLy
          </span>
          <button
            type="button"
            onClick={() => {
              if (voiceEnabled) stopNarratorVoice();
              setVoiceEnabled(!voiceEnabled);
            }}
            className="ml-1 text-slate-400 hover:text-white"
            title={voiceEnabled ? "Tắt giọng nói LyLy" : "Bật giọng nói LyLy"}
          >
            {voiceEnabled ? (
              <Volume2 className="size-3 text-lime-400" />
            ) : (
              <VolumeX className="size-3 text-zinc-500" />
            )}
          </button>
        </div>
        <p className="text-xs font-bold text-white leading-tight">
          {prompt}
        </p>
        {secondsLeft !== null && (
          <div className="mt-1 flex items-center justify-center gap-1 text-[11px] font-mono font-extrabold text-amber-400">
            <Timer className="size-3" /> {secondsLeft}s
          </div>
        )}

        {/* Quick button to open 3D Rotating Cards for Voting */}
        {state.phase === "vote" && onOpenRotatingVote && state.votes[humanPlayer.id] === undefined && (
          <button
            type="button"
            onClick={onOpenRotatingVote}
            className="mt-2 w-full py-1 px-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-[11px] font-black uppercase tracking-wider shadow-md animate-pulse"
          >
            Mở Vòng Xoay 3D Bỏ Phiếu
          </button>
        )}
      </motion.div>
    </div>
  );

  // Transform players into CenterFlow nodes
  const flowNodes: CenterFlowNode[] = playersWithCoords.map((p) => {
    const targetable = canTarget(p);
    const role = knownRole(p);
    const pIsLover = isLover(p.id);
    const isSpeaking = p.isHuman ? isHumanSpeaking : false;
    const recentChat = latestChats[p.id];

    // Secret vote status: In vote phase, DO NOT reveal who voted for whom!
    const hasVotedSecretly = state.phase === "vote" && state.votes[p.id] !== undefined;

    return {
      id: p.id,
      x: p.x,
      y: p.y,
      isAlive: p.alive,
      color: isNight ? "#a855f7" : "#f59e0b",
      content: (
        <div className="relative">
          {/* Speech bubble if chatting */}
          <AnimatePresence>
            {recentChat && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 5 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 max-w-[140px] rounded-xl bg-lime-400 text-black px-2.5 py-1 text-[11px] font-bold shadow-lg pointer-events-none whitespace-normal text-center"
              >
                {recentChat}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-lime-400" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Player Seat Card */}
          <button
            type="button"
            disabled={!targetable}
            onClick={() => onTarget(p)}
            className={cn(
              "group relative flex flex-col items-center rounded-2xl p-2 text-center transition-all duration-300 w-20 sm:w-24 md:w-28",
              p.alive
                ? "bg-slate-900/90 border-2 border-white/10 hover:border-white/30"
                : "bg-slate-950/60 border border-transparent opacity-45 grayscale",
              targetable &&
                "cursor-pointer border-lime-400/80 hover:scale-105 hover:bg-lime-400/10 ring-4 ring-lime-400/30",
              p.isHuman && "ring-2 ring-indigo-500/70 bg-slate-850",
              isSpeaking && "ring-4 ring-lime-400 animate-pulse"
            )}
          >
            {/* Secret Vote Badge (Bí mật tuyệt đối: chỉ hiển thị biểu tượng đã bỏ phiếu) */}
            {hasVotedSecretly && (
              <span
                className="absolute -top-2 -right-2 z-40 grid size-6 place-items-center rounded-full border-2 border-black bg-indigo-600 text-xs font-black text-white shadow-md animate-bounce"
                title="Đã bỏ phiếu kín"
              >
                🗳️
              </span>
            )}

            {/* Lovers Heart Sigil */}
            {pIsLover && p.alive && (
              <span className="absolute -top-2 -left-2 z-40 grid size-5 place-items-center rounded-full bg-pink-500 text-white text-[10px] shadow-sm">
                💘
              </span>
            )}

            {/* Avatar with speaking wave */}
            <div className="relative">
              <UserAvatar src={p.avatar} name={p.name} className="size-11 sm:size-14" />
              {!p.alive && (
                <Skull className="absolute -bottom-1 -right-1 size-5 rounded-full bg-black p-0.5 text-red-500" />
              )}
              {isSpeaking && (
                <span className="absolute -inset-1 rounded-full border-2 border-lime-400 animate-ping pointer-events-none" />
              )}
            </div>

            {/* Name */}
            <p className="mt-1.5 w-full truncate text-[11px] sm:text-xs font-bold text-white">
              {p.name}
              {p.isHuman && <span className="text-lime-300"> (bạn)</span>}
            </p>

            {/* Role badge */}
            <div className="mt-0.5 flex min-h-[18px] items-center justify-center">
              {role ? (
                <span
                  className="rounded-full px-1.5 py-0.2 text-[9px] font-black text-black"
                  style={{ background: ROLE_INFO[role]?.color || "#fff" }}
                >
                  {ROLE_INFO[role]?.emoji} {ROLE_INFO[role]?.name}
                </span>
              ) : (
                isWolf(humanPlayer.role) && isWolf(p.role) && (
                  <span className="text-[9px] font-bold text-red-400">🐺 Bầy Sói</span>
                )
              )}
            </div>
          </button>
        </div>
      ),
    };
  });

  return (
    <div className="relative w-full">
      {/* Lovers connection thread overlay if lovers exist */}
      {state.lovers && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-25">
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
              return (
                <line
                  x1={`${l1.x}%`}
                  y1={`${l1.y}%`}
                  x2={`${l2.x}%`}
                  y2={`${l2.y}%`}
                  stroke="url(#lovers-beam-grad)"
                  strokeWidth="2.5"
                  strokeDasharray="4 4"
                  className="animate-pulse"
                />
              );
            }
            return null;
          })()}
        </svg>
      )}

      {/* Center Flow Component */}
      <CenterFlow
        centerNode={centerHub}
        nodes={flowNodes}
        isNight={isNight}
      />
    </div>
  );
}

export default WerewolfRoundtable;
