"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CipherRevealProps {
  text: string;
  className?: string;
  cipherClassName?: string;
  speed?: number; // ms between scramble frames
  cyclesPerChar?: number; // how many cycles a character scrambles before settling
  delay?: number; // initial delay in ms
  charset?: string;
  triggerKey?: any; // re-triggers when this changes
  triggerOnHover?: boolean;
  revealDirection?: "ltr" | "rtl" | "random" | "center";
  style?: React.CSSProperties;
  onComplete?: () => void;
}

const DEFAULT_CHARSET = "0123456789ABCDEF!@#$%^&*<>[]{}~=+/?\\|";

export function CipherReveal({
  text,
  className = "",
  cipherClassName = "text-primary/70",
  speed = 35,
  cyclesPerChar = 4,
  delay = 0,
  charset = DEFAULT_CHARSET,
  triggerKey,
  triggerOnHover = false,
  revealDirection = "ltr",
  style,
  onComplete,
}: CipherRevealProps) {
  const [displayText, setDisplayText] = useState<string>(text);
  const [isScrambling, setIsScrambling] = useState(false);
  const frameRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startScramble = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const length = text.length;
    if (length === 0) {
      setDisplayText("");
      return;
    }

    // Determine resolve order based on direction
    const order: number[] = Array.from({ length }, (_, i) => i);
    if (revealDirection === "rtl") {
      order.reverse();
    } else if (revealDirection === "random") {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    } else if (revealDirection === "center") {
      const mid = Math.floor(length / 2);
      const sorted: number[] = [];
      for (let offset = 0; offset <= mid; offset++) {
        if (mid - offset >= 0) sorted.push(mid - offset);
        if (mid + offset < length && offset !== 0) sorted.push(mid + offset);
      }
      order.length = 0;
      order.push(...sorted);
    }

    // Map each character to its settle frame
    const settleThresholds: number[] = new Array(length).fill(0);
    order.forEach((charIndex, step) => {
      settleThresholds[charIndex] = (step + 1) * cyclesPerChar;
    });

    const maxCycles = length * cyclesPerChar + 5;
    let currentCycle = 0;
    let lastTime = performance.now();

    setIsScrambling(true);

    const tick = (now: number) => {
      if (now - lastTime >= speed) {
        lastTime = now;
        currentCycle++;

        const currentChars = text.split("").map((realChar, index) => {
          if (realChar === " " || realChar === "\n") return realChar;
          if (currentCycle >= settleThresholds[index]) {
            return realChar;
          }
          return charset[Math.floor(Math.random() * charset.length)];
        });

        setDisplayText(currentChars.join(""));

        if (currentCycle >= maxCycles) {
          setDisplayText(text);
          setIsScrambling(false);
          onComplete?.();
          return;
        }
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    if (delay > 0) {
      timeoutRef.current = setTimeout(() => {
        frameRef.current = requestAnimationFrame(tick);
      }, delay);
    } else {
      frameRef.current = requestAnimationFrame(tick);
    }
  };

  useEffect(() => {
    startScramble();
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [text, triggerKey]);

  return (
    <span
      className={cn("inline-block font-mono select-none tracking-tight", className)}
      style={style}
      onMouseEnter={triggerOnHover ? startScramble : undefined}
    >
      {displayText.split("").map((ch, i) => {
        const isOriginal = ch === text[i];
        return (
          <span
            key={i}
            className={cn(
              "transition-colors duration-75",
              !isOriginal && cipherClassName
            )}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}

export default CipherReveal;
