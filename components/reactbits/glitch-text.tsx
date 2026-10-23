"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface GlitchTextProps {
  text: string;
  className?: string;
  glitchOnHover?: boolean;
  speed?: "fast" | "medium" | "slow";
  glowColor?: string;
}

export function GlitchText({
  text,
  className = "",
  glitchOnHover = false,
  speed = "fast",
  glowColor = "#f43f5e",
}: GlitchTextProps) {
  const [isHovered, setIsHovered] = useState(false);

  const duration = speed === "fast" ? "duration-100" : speed === "medium" ? "duration-200" : "duration-300";

  return (
    <span
      className={cn(
        "relative inline-block select-none font-display font-black tracking-wider uppercase text-white",
        className
      )}
      onMouseEnter={() => glitchOnHover && setIsHovered(true)}
      onMouseLeave={() => glitchOnHover && setIsHovered(false)}
      style={{
        textShadow: `0 0 20px ${glowColor}80`,
      }}
    >
      {/* Base Text */}
      <span className="relative z-10">{text}</span>

      {/* Cyan Glitch Clone */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-0 top-0 select-none text-sky-400 opacity-80 mix-blend-screen transition-transform",
          duration,
          glitchOnHover && !isHovered ? "opacity-0" : "animate-pulse -translate-x-[2px] translate-y-[1px]"
        )}
        style={{
          clipPath: "polygon(0 0, 100% 0, 100% 45%, 0 45%)",
        }}
      >
        {text}
      </span>

      {/* Red/Magenta Glitch Clone */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-0 top-0 select-none text-rose-500 opacity-80 mix-blend-screen transition-transform",
          duration,
          glitchOnHover && !isHovered ? "opacity-0" : "animate-pulse translate-x-[2px] -translate-y-[1px]"
        )}
        style={{
          clipPath: "polygon(0 55%, 100% 55%, 100% 100%, 0 100%)",
        }}
      >
        {text}
      </span>
    </span>
  );
}
