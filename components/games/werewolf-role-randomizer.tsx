"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import {
  Eye,
  EyeOff,
  Flame,
  Moon,
  RotateCcw,
  Shield,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { Role, WPlayer, ROLE_INFO, teamOf, isWolf } from "@/lib/games/werewolf-engine";
import { soundManager } from "@/lib/audio";
import { useAppStore } from "@/lib/store";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { TiltedTiles, TiltedTileItem } from "@/components/reactbits/tilted-tiles";
import {
  ROLE_THEMES,
  RoleCardIllustration,
  CardBackArt,
} from "./werewolf-card-art";

export interface WerewolfRoleRandomizerProps {
  isOpen: boolean;
  role: Role;
  players?: WPlayer[];
  onClose: () => void;
  onStartNight1?: () => void;
  initialMode?: "roulette" | "inspect";
  /** Hiển thị trong khung cha (position: relative) thay vì phủ toàn màn hình. */
  inline?: boolean;
}

type Stage = "spinning" | "locking" | "revealed";

const ALL_ROLES: Role[] = ["wolf", "white_wolf", "wolf_cub", "seer", "guard", "witch", "hunter", "cupid", "elder", "villager"];

export function WerewolfRoleRandomizer({
  isOpen,
  role,
  players = [],
  onClose,
  onStartNight1,
  initialMode = "roulette",
  inline = false,
}: WerewolfRoleRandomizerProps) {
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const [stage, setStage] = useState<Stage>(initialMode === "inspect" ? "revealed" : "spinning");
  const [isFlipped, setIsFlipped] = useState<boolean>(initialMode === "inspect");
  const [isPeeking, setIsPeeking] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(3);
  const [activeTab, setActiveTab] = useState<"card" | "wall">("card");
  const [soundMuted, setSoundMuted] = useState(!soundEnabled);

  // 3D Gyroscopic tilt springs for the interactive floating card
  const rotateX = useSpring(useMotionValue(0), { stiffness: 240, damping: 20 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 240, damping: 20 });

  const theme = ROLE_THEMES[role] || ROLE_THEMES.villager;
  const wolfAllies = useMemo(() => {
    return players.filter((p) => isWolf(p.role) && !p.isHuman);
  }, [players]);

  const soundSafe = useCallback(
    (fn: () => void) => {
      if (!soundMuted) {
        try {
          fn();
        } catch {
          // Fallback
        }
      }
    },
    [soundMuted]
  );

  // Generate Tilted Tile columns with authentic Werewolf character cards
  const tileColumns = useMemo(() => {
    const cols: TiltedTileItem[][] = [[], [], [], []];
    const pool: (Role | "back")[] = [
      "wolf",
      "back",
      "white_wolf",
      "seer",
      "villager",
      "guard",
      "cupid",
      "back",
      "witch",
      "hunter",
      "wolf_cub",
      "elder",
      "wolf",
      "back",
      "seer",
      "villager",
    ];

    cols.forEach((col, cIdx) => {
      // Shift array for visual variety per column
      const shifted = [...pool.slice(cIdx * 2), ...pool.slice(0, cIdx * 2)];
      shifted.forEach((itemRole, rIdx) => {
        const isBack = itemRole === "back";
        const curRole = isBack ? "wolf" : itemRole;
        const curTheme = ROLE_THEMES[curRole];

        col.push({
          id: `col-${cIdx}-row-${rIdx}`,
          content: isBack ? (
            <div className="relative h-44 sm:h-52 w-full p-2 bg-gradient-to-b from-[#141210] to-[#070605] flex flex-col items-center justify-center border border-amber-500/20 rounded-xl overflow-hidden shadow-lg">
              <div className="size-12 rounded-full border border-amber-600/40 bg-red-950/80 grid place-items-center text-xl">
                🐺
              </div>
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-amber-300/70 font-bold">
                BẢN MỆNH
              </p>
            </div>
          ) : (
            <div
              className={cn(
                "relative h-44 sm:h-52 w-full p-2.5 flex flex-col justify-between rounded-xl overflow-hidden border transition-all",
                `bg-gradient-to-b ${curTheme.bgGradient}`
              )}
              style={{ borderColor: curTheme.borderGlow }}
            >
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1 text-xs" style={{ color: curTheme.accentColor }}>
                  {curTheme.emoji} {curTheme.name}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-black/50 text-white/70">
                  {curTheme.teamLabel}
                </span>
              </div>
              <div className="h-24 w-full my-auto opacity-85 group-hover:opacity-100 transition-opacity">
                <RoleCardIllustration role={curRole} className="scale-90" />
              </div>
              <p className="text-xs text-white/50 truncate font-mono text-center">
                {curTheme.sub}
              </p>
            </div>
          ),
        });
      });
    });

    return cols;
  }, []);

  // Handle roulette spin & deceleration sequence
  useEffect(() => {
    if (!isOpen) return;

    if (initialMode === "inspect") {
      setStage("revealed");
      setIsFlipped(true);
      return;
    }

    setStage("spinning");
    setIsFlipped(false);
    setCountdown(3);

    // Audio cue: roulette ticks
    const tickInterval = setInterval(() => {
      soundSafe(() => soundManager.playRouletteTick());
    }, 180);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          clearInterval(tickInterval);
          lockInCard();
          return 0;
        }
        return prev - 1;
      });
    }, 900);

    return () => {
      clearInterval(timer);
      clearInterval(tickInterval);
    };
  }, [isOpen, initialMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const lockInCard = () => {
    setStage("locking");
    soundSafe(() => {
      soundManager.playHeartbeat();
      soundManager.playCardWhoosh();
    });

    setTimeout(() => {
      setStage("revealed");
      soundSafe(() => {
        soundManager.playCardFlip();
      });
    }, 1200);
  };

  const handleFlip = () => {
    const nextState = !isFlipped;
    setIsFlipped(nextState);
    soundSafe(() => soundManager.playCardFlip());

    if (nextState) {
      triggerRevealEffects();
    }
  };

  const triggerRevealEffects = () => {
    soundSafe(() => {
      soundManager.playGlowAura();
      switch (role) {
        case "wolf":
        case "white_wolf":
        case "wolf_cub":
          soundManager.playWerewolfWolfHowl();
          break;
        case "seer":
          soundManager.playWerewolfSeer();
          break;
        case "guard":
          soundManager.playWerewolfShield();
          break;
        case "witch":
          soundManager.playWerewolfWitch();
          break;
        case "hunter":
          soundManager.playWerewolfHunter();
          break;
        case "cupid":
          soundManager.playCupidArrow();
          break;
        case "elder":
        case "villager":
          soundManager.playWerewolfDawn();
          break;
      }
    });
  };

  // Card Mouse 3D Tilt handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    rotateX.set(-y * 22);
    rotateY.set(x * 22);
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  if (!isOpen) return null;

  const cardShown = isFlipped || isPeeking;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={inline ? "absolute inset-0 z-[60] overflow-y-auto overflow-x-hidden rounded-[36px] bg-black/90 backdrop-blur-md flex flex-col justify-between no-scrollbar" : "fixed inset-0 z-[70] overflow-hidden bg-black/90 backdrop-blur-md flex flex-col justify-between"}
      >
        {/* Dynamic Atmospheric Fog & Particle Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Blood Moon / Astral ambient orb */}
          <div
            className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[500px] rounded-full blur-[120px] transition-colors duration-1000 opacity-40"
            style={{
              backgroundColor: cardShown ? theme.accentColor : "#dc2626",
            }}
          />

          {/* Drifting Eerie Mist / Fog layers */}
          <motion.div
            className="absolute -inset-x-20 bottom-0 h-64 bg-gradient-to-t from-black via-white/[0.03] to-transparent opacity-60"
            animate={{ x: [-20, 20, -20] }}
            transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
          />
        </div>

        {/* Top Floating Control Bar */}
        <div className="relative z-30 flex items-center justify-between p-4 sm:p-6 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-white/10 text-lg">
              🐺
            </span>
            <div>
              <h2 className="font-display text-sm sm:text-base font-extrabold tracking-wide uppercase text-white">
                Vai của bạn
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Wall vs Card view */}
            {stage === "revealed" && (
              <div className="flex rounded-xl bg-white/[0.08] p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab("card")}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                    activeTab === "card" ? "bg-white text-black shadow-sm" : "text-white/70 hover:text-white"
                  )}
                >
                  Thẻ
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("wall")}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                    activeTab === "wall" ? "bg-white text-black shadow-sm" : "text-white/70 hover:text-white"
                  )}
                >
                  Tất cả
                </button>
              </div>
            )}

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={() => setSoundMuted(!soundMuted)}
              className="grid size-9 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
              title={soundMuted ? "Bật âm thanh" : "Tắt âm thanh"}
              aria-label="Toggle Sound"
            >
              {soundMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Đóng"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Center Arena */}
        <div className="relative flex-1 flex flex-col items-center justify-center p-4">
          {/* ============================================================== */}
          {/* STAGE 1: TILTED TILES ROULETTE WALL */}
          {/* ============================================================== */}
          {(stage === "spinning" || activeTab === "wall") && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
              {/* Tilted Tiles Engine */}
              <div className="absolute inset-0 overflow-hidden">
                <TiltedTiles
                  columns={tileColumns}
                  rotateX={22}
                  rotateY={-16}
                  rotateZ={6}
                  duration={stage === "spinning" ? 14 : 26}
                  speedMultiplier={stage === "spinning" ? 0.6 : 1}
                  className="h-full opacity-80"
                />
                {stage === "spinning" && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0.65),transparent_65%)]" />}
              </div>

              {/* Central Destiny Vortex & Crosshair during spinning */}
              {stage === "spinning" && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative z-20 flex flex-col items-center pointer-events-auto"
                >
                  <div className="relative size-36 sm:size-44 rounded-full border-2 border-dashed border-red-500/60 flex items-center justify-center animate-spin-slow">
                    <div className="absolute inset-2 rounded-full border border-red-500/30" />
                    <div className="size-20 rounded-full bg-red-950/80 border-2 border-red-500 flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.7)] animate-pulse">
                      <span className="text-3xl font-mono font-black text-white">{countdown}</span>
                    </div>
                  </div>


                  <button
                    type="button"
                    onClick={lockInCard}
                    className="mt-5 btn-lime px-6 py-2.5 shadow-brutal flex items-center gap-2 text-sm font-black"
                  >
                    <Zap className="size-4" /> KHÓA THẺ
                  </button>
                </motion.div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* STAGE 2: LOCKING TRANSITION */}
          {/* ============================================================== */}
          {stage === "locking" && (
            <motion.div
              initial={{ scale: 2.5, opacity: 0, rotate: 15 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 16 }}
              className="relative z-20 flex flex-col items-center"
            >
              <div className={cn("relative rounded-[28px] overflow-hidden shadow-[0_0_80px_rgba(239,68,68,0.8)] border-[3px] border-amber-500/60", inline ? "size-52" : "size-64 sm:size-72")}>
                <CardBackArt />
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 flex items-center gap-2 rounded-full bg-red-950/90 px-4 py-1.5 border border-red-500/60 text-xs font-bold text-red-200"
              >
                <Flame className="size-3.5 text-red-400 animate-bounce" />
              </motion.div>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* STAGE 3: INTERACTIVE 3D CARD INSPECTOR & PRIVACY REVEAL */}
          {/* ============================================================== */}
          {stage === "revealed" && activeTab === "card" && (
            <div className="relative z-20 flex flex-col items-center max-w-md w-full">
              {/* Background Tilted Tiles Subtle blur backdrop */}
              <div className="absolute inset-0 -z-10 opacity-30 pointer-events-none">
                <TiltedTiles
                  columns={tileColumns}
                  rotateX={20}
                  rotateY={-12}
                  rotateZ={5}
                  duration={36}
                  paused
                  showFadeMask
                />
              </div>

              {/* 3D Interactive Card with Perspective */}
              <div
                style={{ perspective: 1200 }}
                className={cn("w-full cursor-pointer", inline ? "max-w-[240px] h-[340px]" : "max-w-[320px] sm:max-w-[340px] h-[min(450px,66dvh)] sm:h-[min(480px,70dvh)]")}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={handleFlip}
              >
                <motion.div
                  style={{
                    rotateX,
                    rotateY,
                    transformStyle: "preserve-3d",
                  }}
                  animate={{
                    rotateY: cardShown ? 180 : 0,
                  }}
                  transition={{
                    duration: 0.65,
                    ease: [0.23, 1, 0.32, 1],
                  }}
                  className="relative w-full h-full"
                >
                  {/* FRONT FACE (Card Back - Mystery State) */}
                  <div
                    style={{
                      backfaceVisibility: "hidden",
                    }}
                    className="absolute inset-0 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
                  >
                    <CardBackArt />
                    <div className="absolute bottom-6 inset-x-6 text-center pointer-events-none">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md px-3.5 py-1 text-xs font-bold text-white border border-white/20">
                        <Sparkles className="size-3 text-amber-300" /> Lật
                      </span>
                    </div>
                  </div>

                  {/* BACK FACE (Unveiled Role Artwork & Details) */}
                  <div
                    className={cn(
                      "absolute inset-0 rounded-[28px] overflow-hidden border-[3px] shadow-[0_25px_60px_rgba(0,0,0,0.95)] flex flex-col justify-between p-5 select-none",
                      `bg-gradient-to-b ${theme.bgGradient}`
                    )}
                    style={{
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      borderColor: theme.borderGlow,
                      boxShadow: `0 0 50px ${theme.glowColor}, 0 25px 60px rgba(0,0,0,0.9)`,
                    }}
                  >
                    {/* Role Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{theme.emoji}</span>
                        <div>
                          <h3 className="font-display text-xl font-black text-white leading-tight">
                            {theme.name}
                          </h3>
                          <p className="text-xs font-bold" style={{ color: theme.accentColor }}>
                            {theme.sub}
                          </p>
                        </div>
                      </div>
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider text-black"
                        style={{ backgroundColor: theme.accentColor }}
                      >
                        {theme.teamLabel}
                      </span>
                    </div>

                    {/* Role SVG Artwork */}
                    <div className="my-auto h-44 w-full flex items-center justify-center relative">
                      <div
                        className="absolute inset-0 rounded-full blur-2xl opacity-40"
                        style={{ backgroundColor: theme.accentColor }}
                      />
                      <RoleCardIllustration role={role} className="z-10 drop-shadow-2xl" />
                    </div>

                    {/* Role Flavor Quote & Ability */}
                    <div className="space-y-2.5 bg-black/60 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-white">
                      <p className="text-xs font-medium text-ink-200 leading-snug">{theme.actionHint}</p>

                      {/* If Werewolf: reveal wolf teammates! */}
                      {role === "wolf" && (
                        <div className="border-t border-red-500/30 pt-2 text-xs">
                          <span className="font-bold text-red-400 flex items-center gap-1">
                            🐺
                          </span>
                          {wolfAllies.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                              {wolfAllies.map((ally) => (
                                <span
                                  key={ally.id}
                                  className="inline-flex items-center gap-1 rounded-lg bg-red-950/80 border border-red-500/40 px-2 py-0.5 text-xs text-red-200"
                                >
                                  <UserAvatar src={ally.avatar} name={ally.name} className="size-4" />
                                  {ally.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-white/60"> —</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Privacy Controls & Peek Button (Chống nhìn lén) */}
              <div className="mt-5 w-full flex flex-col items-center gap-2.5">
                <div className="flex items-center gap-2">
                  {/* Hold to Peek (Hé nhìn) */}
                  <button
                    type="button"
                    onMouseDown={() => setIsPeeking(true)}
                    onMouseUp={() => setIsPeeking(false)}
                    onTouchStart={() => setIsPeeking(true)}
                    onTouchEnd={() => setIsPeeking(false)}
                    className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-xs font-bold text-white border border-white/10 active:scale-95 transition-all select-none"
                    title="Giữ nút để hé nhìn bài bí mật"
                  >
                    <Eye className="size-4 text-amber-400" />
                  </button>

                  {/* Toggle Flip Button */}
                  <button
                    type="button"
                    onClick={handleFlip}
                    title={isFlipped ? "Úp thẻ lại" : "Lật mở thẻ"}
                    className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-xs font-bold text-white border border-white/10 transition-all"
                  >
                    <RotateCcw className="size-4 text-cyan-400" />
                  </button>

                  {/* Quick Hide Panic Button */}
                  {cardShown && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsFlipped(false);
                        setIsPeeking(false);
                      }}
                      title="Che bài ngay" className="flex items-center gap-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 px-3 py-2 text-xs font-bold text-red-300 border border-red-500/30 transition-all"
                    >
                      <EyeOff className="size-4" />
                    </button>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Footer */}
        <div className="relative z-30 p-4 sm:p-6 max-w-lg mx-auto w-full flex flex-col items-center">
          {stage === "revealed" ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onStartNight1) onStartNight1();
              }}
              className="btn-lime w-full py-3.5 text-base font-extrabold shadow-brutal flex items-center justify-center gap-2 group"
            >
              <Moon className="size-5 group-hover:rotate-12 transition-transform" />
              VÀO ĐÊM
            </button>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default WerewolfRoleRandomizer;
