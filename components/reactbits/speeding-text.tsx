"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SpeedingTextProps {
  text: string;
  speedLevel?: number; // 1 to 5 (influences skew and windline intensity)
  color?: string;
  showStreaks?: boolean;
  className?: string;
}

/**
 * SpeedingText - High-velocity typography with aerodynamic skew, motion trails,
 * and subtle kinetic wind lines. Perfect for combos, sprint typing, and rocket bursts.
 */
export function SpeedingText({
  text,
  speedLevel = 3,
  color = "#fbbf24",
  showStreaks = true,
  className = "",
}: SpeedingTextProps) {
  const skew = Math.min(18, 6 + speedLevel * 2.5);

  return (
    <span
      className={cn(
        "relative inline-flex items-center font-display font-black tracking-wide uppercase select-none",
        className
      )}
      style={{
        transform: `skewX(-${skew}deg)`,
      }}
    >
      {/* Ghost motion echo trails */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 select-none opacity-25 blur-[1px]"
        style={{
          color,
          transform: `translateX(-${speedLevel * 2.5}px)`,
        }}
      >
        {text}
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 select-none opacity-15 blur-[2px]"
        style={{
          color,
          transform: `translateX(-${speedLevel * 5}px)`,
        }}
      >
        {text}
      </span>

      {/* Main kinetic text */}
      <span
        className="relative z-10"
        style={{
          color,
          textShadow: `0 0 16px ${color}88`,
        }}
      >
        {text}
      </span>

      {/* Kinetic wind streak lines */}
      {showStreaks && (
        <span className="pointer-events-none absolute inset-x-0 -bottom-1 flex flex-col gap-0.5 opacity-60">
          <motion.span
            className="h-[1.5px] rounded-full"
            style={{ backgroundColor: color }}
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: [0.3, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            className="h-[1px] w-2/3 rounded-full opacity-50"
            style={{ backgroundColor: color }}
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: [0.1, 0.9, 0.2] }}
            transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          />
        </span>
      )}
    </span>
  );
}

export default SpeedingText;
