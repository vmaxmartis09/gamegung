"use client";

/**
 * Ported from KokonutUI Hold Button
 * @author: @dorianbaffier
 * @version: 2.0.0
 * @license: MIT — Copyright (c) KokonutUI (https://kokonutui.com)
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Press and hold to confirm. Adapted for Office Arena: no cva dependency,
 * Tailwind 3 data-attribute variants, framer-motion imports.
 */

import { type LucideIcon, Flag } from "lucide-react";
import {
  AnimatePresence,
  type AnimationPlaybackControls,
  animate,
  MotionConfig,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { type ButtonHTMLAttributes, type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const BASE =
  "group/hold relative inline-flex h-10 touch-none select-none items-center justify-center overflow-hidden rounded-2xl px-4 text-sm font-bold border [-webkit-touch-callout:none] transition-[background-color,border-color,color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-40";

const VARIANTS = {
  red: "border-pop-red/40 bg-pop-red/10 text-[#ffb3bb] hover:bg-pop-red/20 data-[complete]:border-pop-red data-[complete]:bg-pop-red data-[complete]:text-white",
  lime: "border-lime-400/40 bg-lime-400/10 text-lime-300 hover:bg-lime-400/20 data-[complete]:border-lime-400 data-[complete]:bg-lime-400 data-[complete]:text-black",
  violet: "border-pop-violet/40 bg-pop-violet/10 text-ink-100 hover:bg-pop-violet/20 data-[complete]:border-pop-violet data-[complete]:bg-pop-violet data-[complete]:text-black",
} as const;

interface HoldButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: keyof typeof VARIANTS;
  icon?: LucideIcon;
  children?: ReactNode;
  holdDuration?: number;
  holdingLabel?: ReactNode;
  completeLabel?: ReactNode;
  resetAfter?: number;
  onHoldComplete?: () => void;
}

type Phase = "idle" | "holding" | "complete";
const HOLD_KEYS = new Set([" ", "Enter"]);
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const LABEL_TRANSITION = { duration: 0.2, ease: EASE_OUT };
const DRAIN_MS = 300;
const LABEL_DELAY_MS = 150;

function DrawnCheck() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16">
      <motion.path
        animate={{ pathLength: 1 }}
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={{ pathLength: 0 }}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        transition={{ duration: 0.3, delay: 0.1, ease: EASE_OUT }}
      />
    </svg>
  );
}

export default function HoldButton({
  className,
  variant = "red",
  icon: Icon = Flag,
  holdDuration = 1100,
  holdingLabel = "Giữ tiếp…",
  completeLabel = "Xong",
  resetAfter = 1600,
  onHoldComplete,
  children = "Giữ để xác nhận",
  type = "button",
  disabled,
  ...props
}: HoldButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [showHoldingLabel, setShowHoldingLabel] = useState(false);
  const labelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const progress = useMotionValue(0);
  const animationRef = useRef<AnimationPlaybackControls | null>(null);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHoldCompleteRef = useRef(onHoldComplete);
  const reduce = useReducedMotion();
  const clipPath = useTransform(progress, (p) => `inset(0 ${(1 - p) * 100}% 0 0)`);

  useEffect(() => {
    onHoldCompleteRef.current = onHoldComplete;
  }, [onHoldComplete]);

  useEffect(
    () => () => {
      animationRef.current?.stop();
      if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
      if (resetRef.current) clearTimeout(resetRef.current);
    },
    []
  );

  const updatePhase = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
    if (labelTimerRef.current) {
      clearTimeout(labelTimerRef.current);
      labelTimerRef.current = null;
    }
    if (next === "holding") labelTimerRef.current = setTimeout(() => setShowHoldingLabel(true), LABEL_DELAY_MS);
    else setShowHoldingLabel(false);
  };

  const complete = () => {
    updatePhase("complete");
    onHoldCompleteRef.current?.();
    if (resetAfter > 0) {
      resetRef.current = setTimeout(() => {
        resetRef.current = null;
        progress.set(0);
        updatePhase("idle");
      }, resetAfter);
    }
  };

  const startHold = () => {
    if (phaseRef.current !== "idle" || disabled) return;
    updatePhase("holding");
    animationRef.current?.stop();
    const remaining = (1 - progress.get()) * holdDuration;
    animationRef.current = animate(progress, 1, {
      duration: remaining / 1000,
      ease: "linear",
      onComplete: () => {
        if (phaseRef.current === "holding") complete();
      },
    });
  };

  const endHold = () => {
    if (phaseRef.current !== "holding") return;
    updatePhase("idle");
    animationRef.current?.stop();
    animationRef.current = animate(progress, 0, { duration: reduce ? 0 : (progress.get() * DRAIN_MS) / 1000, ease: EASE_OUT });
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    startHold();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (HOLD_KEYS.has(e.key)) {
      e.preventDefault();
      if (!e.repeat) startHold();
    }
  };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (HOLD_KEYS.has(e.key)) endHold();
  };

  let label: ReactNode = children;
  if (phase === "holding" && showHoldingLabel) label = holdingLabel;
  else if (phase === "complete") label = completeLabel;
  const labelKey = phase === "holding" && !showHoldingLabel ? "idle" : phase;

  return (
    <MotionConfig reducedMotion="user">
      <button
        {...props}
        aria-disabled={phase === "complete" || undefined}
        className={cn(BASE, VARIANTS[variant], className)}
        data-complete={phase === "complete" ? "" : undefined}
        data-holding={phase === "holding" ? "" : undefined}
        disabled={disabled}
        onBlur={endHold}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onPointerCancel={endHold}
        onPointerDown={onPointerDown}
        onPointerLeave={endHold}
        onPointerUp={endHold}
        type={type}
      >
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-150 group-data-[complete]/hold:opacity-0"
          style={{ clipPath, background: "color-mix(in srgb, currentColor 22%, transparent)" }}
        />
        <span className="relative flex items-center justify-center overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              className="inline-flex items-center gap-2 whitespace-nowrap"
              exit={{ opacity: 0, y: -10, filter: "blur(2px)" }}
              initial={{ opacity: 0, y: 10, filter: "blur(2px)" }}
              key={labelKey}
              transition={LABEL_TRANSITION}
            >
              {labelKey === "complete" ? <DrawnCheck /> : <Icon aria-hidden="true" className="size-4" />}
              {label}
            </motion.span>
          </AnimatePresence>
        </span>
        <span aria-live="polite" className="sr-only">
          {phase === "complete" ? completeLabel : ""}
        </span>
      </button>
    </MotionConfig>
  );
}
