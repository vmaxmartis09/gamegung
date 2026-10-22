"use client";

/**
 * Ported from KokonutUI AI Text Loading
 * @author: @kokonutui
 * @version: 2.0.0
 * @license: MIT — Copyright (c) KokonutUI (https://kokonutui.com)
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Adapted: framer-motion imports; the wave keyframes live in globals.css
 * (React 18 has no hoisted <style precedence>).
 */

import { AnimatePresence, MotionConfig, motion, type Variants } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TextLoadingProps {
  texts?: string[];
  className?: string;
  interval?: number;
  label?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const WAVE_STEP = 0.07;

const wordVariants = {
  enter: {},
  shown: { transition: { staggerChildren: 0.018 } },
  exit: { opacity: 0, y: -6, filter: "blur(3px)", transition: { duration: 0.15, ease: EASE_OUT } },
} satisfies Variants;

const letterVariants = {
  enter: { opacity: 0, y: 8, filter: "blur(4px)" },
  shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.28, ease: EASE_OUT } },
} satisfies Variants;

export default function TextLoading({
  texts = ["Đang nghĩ…", "Tính nước…", "Soi thế cờ…", "Sắp xong…"],
  className,
  interval = 1400,
  label = "Đang tải",
}: TextLoadingProps) {
  const [i, setI] = useState(0);
  const idx = texts.length ? i % texts.length : 0;
  const text = texts[idx] ?? "";

  useEffect(() => {
    if (texts.length < 2) return;
    const t = setInterval(() => setI((p) => (p + 1) % texts.length), interval);
    return () => clearInterval(t);
  }, [interval, texts.length]);

  return (
    <output aria-live="polite" className={cn("inline-flex items-baseline", className)}>
      <span className="sr-only">{label}</span>
      <MotionConfig reducedMotion="user">
        <span aria-hidden="true" className="relative flex">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span animate="shown" className="flex min-w-max whitespace-pre" exit="exit" initial="enter" key={idx} variants={wordVariants}>
              {Array.from(text).map((char, k) => (
                <motion.span className="inline-block" key={k} variants={letterVariants}>
                  <span className="kokonut-ai-wave inline-block" style={{ animationDelay: `${k * WAVE_STEP}s` }}>
                    {char}
                  </span>
                </motion.span>
              ))}
            </motion.span>
          </AnimatePresence>
        </span>
      </MotionConfig>
    </output>
  );
}
