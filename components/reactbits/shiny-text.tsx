"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
}

export function ShinyText({
  text,
  disabled = false,
  speed = 4,
  className = "",
}: ShinyTextProps) {
  const animationDuration = `${speed}s`;

  return (
    <span
      className={cn(
        "inline-block font-bold bg-clip-text text-transparent",
        "bg-gradient-to-r from-ink-400 via-white to-ink-500",
        !disabled && "animate-shimmer",
        className
      )}
      style={{
        backgroundSize: "200% 100%",
        animationDuration,
      }}
    >
      {text}
    </span>
  );
}

export default ShinyText;
