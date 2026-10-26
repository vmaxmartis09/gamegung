"use client";

import { NARRATOR_AUDIO_MAP, playNarratorVoice, stopNarratorVoice } from "@/lib/narrator-audio";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { GlitchText } from "@/components/reactbits/glitch-text";
import { BlurText } from "@/components/reactbits/blur-text";
import { cn } from "@/lib/utils";
import { MatchCard } from "@/components/matchmaking/match-card";
import { EmojiText } from "@/components/ui/emoji";

/* Shared "Ma Sói style" presentation kit: announce overlays, VS intro, narrator voice. */

export type FxTone = "red" | "gold" | "blue" | "white";
export interface GameFx {
  id: string;
  title: string;
  subtitle?: string;
  tone?: FxTone;
  icon?: string;
}

const TONE: Record<FxTone, { glow: string; wash: string }> = {
  red: { glow: "#f43f5e", wash: "bg-red-950/60" },
  gold: { glow: "#fbbf24", wash: "bg-amber-950/50" },
  blue: { glow: "#38bdf8", wash: "bg-sky-950/55" },
  white: { glow: "#ffffff", wash: "bg-black/55" },
};

/** Full-screen action announcement (claw / heal style flash). Calls onDone after ~1.8s. */
export function GameFxOverlay({ fx, onDone }: { fx: GameFx | null; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!fx) return;
    const t = setTimeout(() => done.current(), 1800);
    return () => clearTimeout(t);
  }, [fx]);

  const tone = TONE[fx?.tone ?? "white"];
  return (
    <AnimatePresence>
      {fx && (
        <motion.div
          key={fx.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-[80] grid place-items-center overflow-hidden"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.8, 0.25, 0.6, 0] }}
            transition={{ duration: 1.4, times: [0, 0.15, 0.4, 0.7, 1] }}
            className={cn("absolute inset-0 backdrop-blur-[2px]", tone.wash)}
          />
          <motion.div
            initial={{ scale: 0.4, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="relative flex flex-col items-center gap-2 text-center"
          >
            {fx.icon && <span className="text-7xl drop-shadow-[0_0_30px_var(--g)]" style={{ ["--g" as string]: tone.glow }}><EmojiText>{fx.icon}</EmojiText></span>}
            <GlitchText text={fx.title} glowColor={tone.glow} className="text-5xl sm:text-7xl" speed="medium" />
            {fx.subtitle && <p className="max-w-[80vw] text-sm font-semibold text-white/80 sm:text-base"><EmojiText>{fx.subtitle}</EmojiText></p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Queue of announcements so quick events never overwrite each other. */
export function useFxQueue() {
  const [queue, setQueue] = useState<GameFx[]>([]);
  const push = useCallback((fx: Omit<GameFx, "id">) => setQueue((q) => [...q.slice(-3), { ...fx, id: Math.random().toString(36).slice(2) }]), []);
  const pop = useCallback(() => setQueue((q) => q.slice(1)), []);
  return { current: queue[0] ?? null, push, pop };
}

/** Roleplay-reveal style versus intro shown at the start of a match. */
export function MatchIntro({
  open,
  title,
  subtitle,
  players,
  onDone,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  players: { name: string; avatar: string; elo?: number; tier?: { icon: string; name: string }; footer?: string }[];
  onDone: () => void;
}) {
  const done = useRef(onDone);
  done.current = onDone;
  // Gắn thẳng vào body để lớp phủ luôn căn giữa màn hình, không bị khung cha có transform kéo lệch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => done.current(), 2600);
    return () => clearTimeout(t);
  }, [open]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDone}
          className="fixed inset-0 z-[85] flex cursor-pointer items-center justify-center bg-black/85 backdrop-blur-md"
        >
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 text-center">
            <p className="pl-[0.4em] font-mono text-xs font-bold uppercase tracking-[0.4em] text-white/50">{subtitle ?? "Office Arena"}</p>
            <BlurText text={title} className="mt-4 font-display text-4xl font-black text-white sm:text-6xl" />
            {/* Thẻ người chơi cùng bề rộng, xen chữ VS, để cả hàng cân đối quanh trục giữa */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-5">
              {players.map((p, i) => (
                <Fragment key={p.name + i}>
                  {i > 0 && <GlitchText text="VS" className="text-3xl" glowColor="#f43f5e" />}
                  <motion.div
                    initial={{ y: 40, opacity: 0, rotateY: 90 }}
                    animate={{ y: 0, opacity: 1, rotateY: 0 }}
                    transition={{ delay: 0.5 + i * 0.25, type: "spring", stiffness: 200, damping: 18 }}
                    className="w-40 sm:w-48"
                  >
                    <MatchCard tone={i === 0 ? "me" : "opp"} name={p.name} avatar={p.avatar} elo={p.elo} tier={p.tier} footer={p.footer ?? (i === 0 ? "Bạn" : "Đối thủ")} />
                  </motion.div>
                </Fragment>
              ))}
            </div>
            <p className="mt-8 text-xs text-white/40">Chạm để bỏ qua</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Giọng dẫn LyLy dùng chung cho mọi game, có nút tắt/bật được nhớ lại. */
export function useNarrator() {
  const [enabled, setEnabled] = useState(true);
  const enabledRef = useRef(true);
  useEffect(() => {
    try {
      const v = localStorage.getItem("oa-narrator") !== "0";
      setEnabled(v);
      enabledRef.current = v;
    } catch {}
  }, []);

  /** Đọc bằng giọng LyLy (mp3 theo `clip`); thiếu file thì tự đọc bằng giọng trình duyệt. */
  const say = useCallback((text: string, clip?: keyof typeof NARRATOR_AUDIO_MAP) => {
    if (!enabledRef.current || typeof window === "undefined") return;
    if (clip) playNarratorVoice(clip, text);
  }, []);

  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    try {
      localStorage.setItem("oa-narrator", next ? "1" : "0");
      if (!next) stopNarratorVoice();
    } catch {}
  }, []);

  return { say, enabled, toggle };
}

export function NarratorButton({ enabled, onClick, className }: { enabled: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={enabled ? "Tắt giọng dẫn" : "Bật giọng dẫn"}
      className={cn("grid size-8 place-items-center rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/10", className)}
    >
      {enabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
    </button>
  );
}
