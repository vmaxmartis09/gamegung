"use client";
import { UserAvatar } from "@/components/ui/user-avatar";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Swords,
  Coins,
  Bot,
  User,
  Zap,
  Sparkles,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Radio,
} from "lucide-react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { useAppStore } from "@/lib/store";
import { GameType, getRankTier } from "@/lib/ranking-system";
import { soundManager } from "@/lib/audio";
import {
  startRealtimeMatchmaking,
  MatchmakingOpponent,
} from "@/lib/supabase-game";
import { cn } from "@/lib/utils";

interface MatchmakingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultGame?: GameType;
  initialGame?: GameType;
  defaultStake?: number;
}

const GAME_OPTIONS: { id: GameType; name: string; icon: string; desc: string }[] = [
  {
    id: "chess",
    name: "Cờ Vua",
    icon: "♟️",
    desc: "Đấu trí FIDE 64 ô quốc tế",
  },
  {
    id: "xiangqi",
    name: "Cờ Tướng",
    icon: "🀄",
    desc: "Chiến thuật Á Đông Sở Hà Hán Giới",
  },
  {
    id: "werewolf",
    name: "Ma Sói",
    icon: "🐺",
    desc: "Ẩn vai suy luận nhóm nghỉ trưa",
  },
  {
    id: "arcade",
    name: "Cyber Slash",
    icon: "⚡",
    desc: "Chém Bug diệt Deadline Chibi 60FPS",
  },
  {
    id: "uno",
    name: "Uno Battle",
    icon: "🎴",
    desc: "Đại chiến bài Uno công sở 2-4 người",
  },
];

const STAKE_PRESETS = [0, 50, 100, 200, 500];

export function MatchmakingModal({
  isOpen,
  onClose,
  defaultGame = "chess",
  initialGame,
  defaultStake = 100,
}: MatchmakingModalProps) {
  const router = useRouter();
  const { currentUser, soundEnabled } = useAppStore();

  const startingGame = initialGame || defaultGame || "chess";
  const [selectedGame, setSelectedGame] = useState<GameType>(startingGame);
  const [selectedStake, setSelectedStake] = useState<number>(defaultStake);
  const [phase, setPhase] = useState<"idle" | "searching" | "matched">("idle");
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [matchedOpponent, setMatchedOpponent] = useState<MatchmakingOpponent | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cleanupRef = useRef<(() => void) | null>(null);

  // Sync defaults when reopened
  useEffect(() => {
    if (isOpen) {
      setSelectedGame(defaultGame);
      setSelectedStake(defaultStake);
      setPhase("idle");
      setSearchSeconds(0);
      setMatchedOpponent(null);
      setErrorMsg(null);
    } else {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    }
  }, [isOpen, defaultGame, defaultStake]);

  // Searching timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (phase === "searching") {
      interval = setInterval(() => {
        setSearchSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phase]);

  // Matched countdown
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (phase === "matched" && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((c) => c - 1);
      }, 1000);
    } else if (phase === "matched" && countdown === 0 && matchedOpponent) {
      // Navigate to game
      const url = `/games/${selectedGame}?mode=match&stake=${selectedStake}&room=${matchedOpponent.roomCode}&opp=${encodeURIComponent(
        matchedOpponent.username
      )}&oppElo=${matchedOpponent.elo}&oppAvatar=${encodeURIComponent(
        matchedOpponent.avatar
      )}&isBot=${matchedOpponent.isBot ? "1" : "0"}`;

      onClose();
      router.push(url);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [phase, countdown, matchedOpponent, selectedGame, selectedStake, router, onClose]);

  const handleStartSearch = () => {
    if (selectedStake > currentUser.lua) {
      setErrorMsg(`Bạn không đủ Lúa (${currentUser.lua} 🌾). Vui lòng chọn mức cược thấp hơn hoặc nhận cứu trợ!`);
      return;
    }
    setErrorMsg(null);
    setPhase("searching");
    setSearchSeconds(0);

    if (soundEnabled) soundManager.playTurn();

    // Start Realtime Matchmaking with Supabase + AI fallback
    const cleanup = startRealtimeMatchmaking({
      gameType: selectedGame,
      stake: selectedStake,
      user: currentUser,
      onOpponentFound: (opp) => {
        setMatchedOpponent(opp);
        setPhase("matched");
        setCountdown(3);
        if (soundEnabled) soundManager.playVictory();
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      },
    });

    cleanupRef.current = cleanup;
  };

  const handleCancel = () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setPhase("idle");
    setSearchSeconds(0);
  };

  const currentElo =
    selectedGame === "chess"
      ? currentUser.eloChess
      : selectedGame === "xiangqi"
      ? currentUser.eloXiangqi
      : selectedGame === "werewolf"
      ? currentUser.eloWerewolf
      : (currentUser.eloArcade ?? 1200);

  const currentTier = getRankTier(currentElo);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={phase === "searching" ? handleCancel : onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 16 }}
            className="modal-shell max-w-lg sm:!p-7"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-300">
                  <Zap className="w-4 h-4 fill-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-wider text-white">
                    GHÉP TRẬN ĐẤU TRÍ REALTIME
                  </h3>
                  <p className="text-[10px] text-ink-400 font-mono">
                    Hệ thống tự động tìm đối thủ đồng cấp qua Supabase
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={phase === "searching" ? handleCancel : onClose}
                className="p-1.5 rounded-lg text-ink-400 hover:text-white hover:bg-ink-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="py-5">
              {/* PHASE 1: IDLE CONFIG */}
              {phase === "idle" && (
                <div className="space-y-5">
                  {/* Game Selection */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-ink-400 block mb-2.5">
                      1. Chọn Bộ Môn Thi Đấu
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {GAME_OPTIONS.map((g) => {
                        const isSelected = selectedGame === g.id;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setSelectedGame(g.id)}
                            className={cn(
                              "p-3 rounded-2xl border text-left transition-all flex flex-col justify-between",
                              isSelected
                                ? "seg-active border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                                : "bg-ink-900/60 border-ink-800 hover:border-ink-700 text-ink-300"
                            )}
                          >
                            <span className="text-2xl mb-1">{g.icon}</span>
                            <div>
                              <p className="text-xs font-bold leading-tight">{g.name}</p>
                              <p
                                className={cn(
                                  "text-[9px] mt-0.5 line-clamp-1",
                                  isSelected ? "text-ink-600" : "text-ink-400"
                                )}
                              >
                                {g.desc}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stake Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                        2. Chọn Mức Cược (Lúa 🌾)
                      </label>
                      <span className="text-xs font-mono text-ink-400">
                        Ví của bạn:{" "}
                        <strong className="text-amber-300">
                          {currentUser.lua.toLocaleString()} 🌾
                        </strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      {STAKE_PRESETS.map((amt) => {
                        const isSelected = selectedStake === amt;
                        const canAfford = currentUser.lua >= amt;
                        return (
                          <button
                            key={amt}
                            type="button"
                            disabled={!canAfford}
                            onClick={() => setSelectedStake(amt)}
                            className={cn(
                              "py-2.5 rounded-xl border text-center font-mono text-xs font-bold transition-all",
                              isSelected
                                ? "bg-amber-400 text-black border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.3)]"
                                : canAfford
                                ? "bg-ink-900 border-ink-800 hover:border-ink-700 text-white"
                                : "bg-ink-950 border-ink-900 text-ink-600 cursor-not-allowed"
                            )}
                          >
                            {amt === 0 ? "Free" : `${amt} 🌾`}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rating Info Card */}
                  <div className="p-3.5 rounded-2xl bg-ink-900/50 border border-ink-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full border border-ink-700 bg-ink-950 flex items-center justify-center text-xl">
                        {currentTier.icon}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{currentTier.name}</p>
                        <p className="text-[10px] text-ink-400 font-mono">
                          Trình độ hiện tại: {currentElo} ELO
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-ink-400 font-mono uppercase">Tổng Giải Thưởng</p>
                      <p className="text-sm font-black font-mono text-amber-300">
                        {selectedStake === 0 ? "Giao hữu" : `${selectedStake * 2} Lúa 🌾`}
                      </p>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Start Button */}
                  <button
                    type="button"
                    onClick={handleStartSearch}
                    className="w-full py-3.5 rounded-2xl seg-active font-extrabold text-xs uppercase tracking-widest hover:bg-ink-200 transition-all shadow-[0_0_25px_rgba(255,255,255,0.25)] hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4 fill-black" />
                    <span>Bắt Đầu Dò Tìm Đối Thủ</span>
                  </button>
                </div>
              )}

              {/* PHASE 2: SEARCHING RADAR */}
              {phase === "searching" && (
                <div className="py-6 flex flex-col items-center text-center space-y-6">
                  {/* Radar Pulse Visual */}
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border border-amber-400/20 animate-ping" />
                    <div className="absolute inset-2 rounded-full border border-amber-400/30 animate-pulse" />
                    <div className="absolute inset-6 rounded-full border border-white/20" />
                    <div className="w-16 h-16 rounded-full bg-ink-900 border border-amber-400/60 flex items-center justify-center text-2xl shadow-[0_0_25px_rgba(251,191,36,0.25)]">
                      {GAME_OPTIONS.find((g) => g.id === selectedGame)?.icon}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-white tracking-wide">
                      ĐANG TÌM KIẾM ĐỐI THỦ...
                    </h4>
                    <p className="text-xs text-ink-400 font-mono mt-1">
                      Dải ELO mục tiêu: {Math.max(100, currentElo - 150)} - {currentElo + 150} ELO
                    </p>
                    <p className="text-xs font-mono text-amber-300 mt-2">
                      Thời gian chờ: 00:{searchSeconds < 10 ? `0${searchSeconds}` : searchSeconds}
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ink-900 border border-ink-800 text-[10px] font-mono text-ink-400">
                    <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>Supabase Realtime Channel: Đang lắng nghe kỳ thủ...</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-6 py-2 rounded-xl bg-ink-900 hover:bg-ink-800 border border-ink-700 text-xs font-semibold text-ink-300 hover:text-white transition-colors"
                  >
                    Hủy Tìm Kiếm
                  </button>
                </div>
              )}

              {/* PHASE 3: MATCHED PREVIEW */}
              {phase === "matched" && matchedOpponent && (
                <div className="py-4 space-y-6 text-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/50 border border-emerald-500/40 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ĐÃ TÌM THẤY TRẬN ĐẤU!</span>
                  </div>

                  {/* VS Layout */}
                  <div className="grid grid-cols-7 items-center gap-2">
                    {/* User */}
                    <div className="col-span-3 flex flex-col items-center">
                      <UserAvatar src={currentUser.avatar} name={currentUser.username} className="w-14 h-14 rounded-full border-2 border-white bg-ink-950 shadow-lg" />
                      <p className="text-xs font-bold text-white mt-2 truncate max-w-[120px]">
                        {currentUser.username}
                      </p>
                      <p className="text-[10px] text-ink-400 font-mono">
                        {currentElo} ELO
                      </p>
                    </div>

                    {/* VS Center */}
                    <div className="col-span-1 flex flex-col items-center">
                      <span className="text-base font-black font-mono text-amber-400 animate-pulse">
                        VS
                      </span>
                    </div>

                    {/* Opponent */}
                    <div className="col-span-3 flex flex-col items-center">
                      <UserAvatar src={matchedOpponent.avatar} name={matchedOpponent.username} className="w-14 h-14 rounded-full border-2 border-amber-400 bg-ink-950 shadow-lg" />
                      <p className="text-xs font-bold text-white mt-2 truncate max-w-[120px]">
                        {matchedOpponent.username}
                      </p>
                      <p className="text-[10px] text-amber-300 font-mono">
                        {matchedOpponent.elo} ELO
                      </p>
                    </div>
                  </div>

                  {/* Pot Summary */}
                  <div className="p-3 rounded-2xl bg-ink-900 border border-ink-800 flex items-center justify-around text-xs font-mono">
                    <div>
                      <span className="text-ink-400 block text-[10px]">MỨC CƯỢC</span>
                      <span className="font-bold text-white">
                        {selectedStake === 0 ? "Giao hữu" : `${selectedStake} 🌾`}
                      </span>
                    </div>
                    <div className="h-6 w-px bg-ink-800" />
                    <div>
                      <span className="text-ink-400 block text-[10px]">TỔNG GIẢI THƯỞNG</span>
                      <span className="font-bold text-amber-300">
                        {selectedStake === 0 ? "Vinh quang" : `${selectedStake * 2} 🌾`}
                      </span>
                    </div>
                  </div>

                  {/* Countdown notice */}
                  <p className="text-xs font-mono text-ink-400">
                    Tự động vào bàn đấu sau{" "}
                    <strong className="text-white text-base font-black font-mono px-1">
                      {countdown}
                    </strong>{" "}
                    giây...
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
