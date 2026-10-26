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
import { isAccountId, pickBotOpponent, MatchmakingOpponent } from "@/lib/supabase-game";
import { joinMatchQueue, opponentOf } from "@/lib/online-match";
import { cn } from "@/lib/utils";
import { MatchCard } from "./match-card";
import { Emoji, EmojiText } from "@/components/ui/emoji";

interface MatchmakingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultGame?: GameType;
  initialGame?: GameType;
  defaultStake?: number;
}

/** `online`: có chế độ đấu người thật qua hàng chờ; các game khác đấu với máy. */
const GAME_OPTIONS: { id: GameType; name: string; icon: string; desc: string; online: boolean }[] = [
  { id: "chess", name: "Cờ Vua", icon: "♟️", desc: "Đấu trí FIDE 64 ô quốc tế", online: true },
  { id: "xiangqi", name: "Cờ Tướng", icon: "🀄", desc: "Chiến thuật Á Đông Sở Hà Hán Giới", online: true },
  { id: "werewolf", name: "Ma Sói", icon: "🐺", desc: "Đấu với làng bot · chưa có online", online: false },
  { id: "uno", name: "Deadline Rush", icon: "🎴", desc: "Bài đẩy việc với bot · chưa có online", online: false },
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
  const [matchId, setMatchId] = useState<string | null>(null);
  const [othersWaiting, setOthersWaiting] = useState(0);

  const cleanupRef = useRef<(() => void) | null>(null);

  // Sync defaults when reopened
  useEffect(() => {
    if (isOpen) {
      setSelectedGame(defaultGame);
      setSelectedStake(defaultStake);
      setPhase("idle");
      setSearchSeconds(0);
      setMatchedOpponent(null);
      setMatchId(null);
      setErrorMsg(null);
    } else {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    }
  }, [isOpen, defaultGame, defaultStake]);

  // Đóng modal (unmount) khi đang tìm thì rời hàng chờ.
  useEffect(() => () => cleanupRef.current?.(), []);

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
      const url = matchId
        ? `/games/${selectedGame}?match=${encodeURIComponent(matchId)}&stake=${selectedStake}`
        : `/games/${selectedGame}?mode=match&stake=${selectedStake}&room=${matchedOpponent.roomCode}&oppId=${encodeURIComponent(matchedOpponent.id)}&opp=${encodeURIComponent(
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
  }, [phase, countdown, matchedOpponent, matchId, selectedGame, selectedStake, router, onClose]);

  const gameInfo = GAME_OPTIONS.find((g) => g.id === selectedGame) ?? GAME_OPTIONS[0];
  const canGoOnline = gameInfo.online && isAccountId(currentUser.id);

  const onFound = (opp: MatchmakingOpponent, id: string | null) => {
    setMatchedOpponent(opp);
    setMatchId(id);
    setPhase("matched");
    setCountdown(3);
    if (soundEnabled) soundManager.playVictory();
    confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
  };

  const playBot = () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    onFound(pickBotOpponent(currentElo, selectedStake), null);
  };

  const handleStartSearch = () => {
    if (selectedStake > currentUser.lua) {
      setErrorMsg(`Bạn không đủ Lúa (${currentUser.lua} 🌾). Vui lòng chọn mức cược thấp hơn hoặc nhận cứu trợ!`);
      return;
    }
    setErrorMsg(null);
    setPhase("searching");
    setSearchSeconds(0);

    if (soundEnabled) soundManager.playTurn();

    if (!canGoOnline) {
      playBot();
      return;
    }
    if (selectedGame !== "chess" && selectedGame !== "xiangqi") return;
    setOthersWaiting(0);
    const cleanup = joinMatchQueue({
      game: selectedGame,
      stake: selectedStake,
      elo: currentElo,
      name: currentUser.username,
      avatar: currentUser.avatar,
      onUpdate: (st) => {
        if (st.status === "waiting") return setOthersWaiting(st.othersWaiting);
        const o = opponentOf(st.match, currentUser.id);
        onFound({ id: o.id, username: o.name, avatar: o.avatar, title: "Kỳ thủ", elo: o.elo, isBot: false, stake: selectedStake, roomCode: st.match.id }, st.match.id);
      },
      onError: (msg) => {
        cleanupRef.current?.();
        cleanupRef.current = null;
        setErrorMsg(msg);
        setPhase("idle");
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
      : (currentUser.eloUno ?? 1200);

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
                    <div className="grid grid-cols-2 gap-2.5">
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
                            <span className="text-2xl mb-1"><EmojiText>{g.icon}</EmojiText></span>
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
                        2. Chọn Mức Cược (Lúa <Emoji e="🌾" />)
                      </label>
                      <span className="text-xs font-mono text-ink-400">
                        Ví của bạn:{" "}
                        <strong className="text-amber-300">
                          {currentUser.lua.toLocaleString()} <Emoji e="🌾" />
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
                            <EmojiText>{amt === 0 ? "Free" : `${amt} 🌾`}</EmojiText>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rating Info Card */}
                  <div className="p-3.5 rounded-2xl bg-ink-900/50 border border-ink-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full border border-ink-700 bg-ink-950 flex items-center justify-center text-xl">
                        <EmojiText>{currentTier.icon}</EmojiText>
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
                        <EmojiText>{selectedStake === 0 ? "Giao hữu" : `${selectedStake * 2} Lúa 🌾`}</EmojiText>
                      </p>
                    </div>
                  </div>

                  {!canGoOnline && (
                    <p className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs text-ink-300">
                      <Bot className="size-4 shrink-0" />
                      {gameInfo.online
                        ? "Cần đăng nhập tài khoản để ghép với người thật. Lượt này bạn sẽ đấu với máy."
                        : `${gameInfo.name} chưa có chế độ online. Bạn sẽ đấu với máy.`}
                    </p>
                  )}

                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span><EmojiText>{errorMsg}</EmojiText></span>
                    </div>
                  )}

                  {/* Start Button */}
                  <button
                    type="button"
                    onClick={handleStartSearch}
                    className="w-full py-3.5 rounded-2xl seg-active font-extrabold text-xs uppercase tracking-widest hover:bg-ink-200 transition-all shadow-[0_0_25px_rgba(255,255,255,0.25)] hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4 fill-black" />
                    <span>{canGoOnline ? "Tìm Đối Thủ Thật" : "Đấu Với Máy"}</span>
                  </button>
                </div>
              )}

              {/* PHASE 2: SEARCHING RADAR */}
              {phase === "searching" && (
                <div className="py-6 flex flex-col items-center text-center space-y-6">
                  {/* Thẻ của bạn đối diện thẻ đang chờ đối thủ */}
                  <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <MatchCard tone="me" name={currentUser.username} avatar={currentUser.avatar} elo={currentElo} tier={currentTier} footer="Bạn" />
                    <span className="font-mono text-base font-black text-amber-400">VS</span>
                    <MatchCard tone="empty" name="Đối thủ" searching footer="Đang chờ" />
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-white tracking-wide">
                      ĐANG TÌM KIẾM ĐỐI THỦ...
                    </h4>
                    <p className="text-xs text-ink-400 font-mono mt-1">
                      Ưu tiên đối thủ gần {currentElo} ELO · cùng mức cược
                    </p>
                    <p className="text-xs font-mono text-amber-300 mt-2">
                      Thời gian chờ: {String(Math.floor(searchSeconds / 60)).padStart(2, "0")}:{String(searchSeconds % 60).padStart(2, "0")}
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ink-900 border border-ink-800 text-[10px] font-mono text-ink-400">
                    <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>
                      {othersWaiting > 0
                        ? `${othersWaiting} người khác đang tìm trận ${gameInfo.name}`
                        : `Chưa có ai khác đang tìm trận ${gameInfo.name}`}
                    </span>
                  </div>

                  {searchSeconds >= 10 && (
                    <button
                      type="button"
                      onClick={playBot}
                      className="mx-auto flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
                    >
                      <Bot className="size-4" /> Đấu với máy trong lúc chờ
                    </button>
                  )}

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
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <MatchCard tone="me" name={currentUser.username} avatar={currentUser.avatar} elo={currentElo} tier={currentTier} footer="Bạn" />
                    <span className="animate-pulse font-mono text-base font-black text-amber-400">VS</span>
                    <MatchCard
                      tone="opp"
                      name={matchedOpponent.username}
                      avatar={matchedOpponent.avatar}
                      elo={matchedOpponent.elo}
                      tier={getRankTier(matchedOpponent.elo)}
                      footer={matchedOpponent.isBot ? "Máy" : "Đối thủ"}
                    />
                  </div>

                  {/* Pot Summary */}
                  <div className="p-3 rounded-2xl bg-ink-900 border border-ink-800 flex items-center justify-around text-xs font-mono">
                    <div>
                      <span className="text-ink-400 block text-[10px]">MỨC CƯỢC</span>
                      <span className="font-bold text-white">
                        <EmojiText>{selectedStake === 0 ? "Giao hữu" : `${selectedStake} 🌾`}</EmojiText>
                      </span>
                    </div>
                    <div className="h-6 w-px bg-ink-800" />
                    <div>
                      <span className="text-ink-400 block text-[10px]">TỔNG GIẢI THƯỞNG</span>
                      <span className="font-bold text-amber-300">
                        <EmojiText>{selectedStake === 0 ? "Vinh quang" : `${selectedStake * 2} 🌾`}</EmojiText>
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
