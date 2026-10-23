"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface TypographicWallProps {
  phrases?: string[];
  rows?: number;
  opacity?: number;
  tilt?: number; // tilt angle in degrees, e.g. -5
  className?: string;
}

const DEFAULT_PHRASES = [
  "TYPING DUEL",
  "ROCKET STRIKE",
  "CYBER ARENA",
  "FUSION PROTOCOL",
  "VELOCITY",
  "CRITICAL HIT",
  "OFFICE CHAMPION",
  "REFLEX MATRIX",
];

/**
 * TypographicWall - Architectural ambient typography wall for subtle esports & cyber backdrops.
 * Gives immediate high-production-value ambiance without visual clutter.
 */
export function TypographicWall({
  phrases = DEFAULT_PHRASES,
  rows = 4,
  opacity = 0.04,
  tilt = -6,
  className = "",
}: TypographicWallProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden select-none flex flex-col justify-around -z-10",
        className
      )}
      style={{
        transform: `rotate(${tilt}deg) scale(1.15)`,
        opacity,
      }}
    >
      {Array.from({ length: rows }).map((_, rowIndex) => {
        const offset = (rowIndex % 2) * 3;
        const shuffled = [...phrases.slice(offset), ...phrases.slice(0, offset)];
        const rowText = shuffled.join("  ·  ");

        return (
          <div
            key={rowIndex}
            className="whitespace-nowrap font-display font-black text-4xl uppercase tracking-[0.25em] text-white"
            style={{
              transform: `translateX(${(rowIndex % 2 === 0 ? -1 : 1) * (rowIndex * 30)}px)`,
            }}
          >
            {rowText}  ·  {rowText}
          </div>
        );
      })}
    </div>
  );
}

export default TypographicWall;
