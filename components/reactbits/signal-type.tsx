"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface SignalTypeProps {
  text: string;
  color?: string; // e.g. "#38bdf8", "#34d399", "#f43f5e", "#fbbf24"
  secondaryColor?: string;
  flicker?: boolean;
  className?: string;
  as?: "h1" | "h2" | "h3" | "span" | "div" | "p";
}

/**
 * SignalType - Neon tube / broadcast signal typography with authentic electric cadence & glow.
 * Refined and subtle for modern cyber/arcade interfaces.
 */
export function SignalType({
  text,
  color = "#38bdf8",
  flicker = true,
  className = "",
  as: Component = "span",
}: SignalTypeProps) {
  const [flickerState, setFlickerState] = useState(1);

  useEffect(() => {
    if (!flicker) return;
    let timeout: NodeJS.Timeout;

    const runFlicker = () => {
      // Periodic subtle electrical hum / flicker
      const isQuickTwitch = Math.random() < 0.3;
      if (isQuickTwitch) {
        setFlickerState(0.4 + Math.random() * 0.3);
        timeout = setTimeout(() => {
          setFlickerState(1);
          timeout = setTimeout(runFlicker, 2000 + Math.random() * 4000);
        }, 60 + Math.random() * 80);
      } else {
        timeout = setTimeout(runFlicker, 3000 + Math.random() * 5000);
      }
    };

    timeout = setTimeout(runFlicker, 1500);
    return () => clearTimeout(timeout);
  }, [flicker]);

  return (
    <Component
      className={cn(
        "inline-block font-display font-extrabold tracking-wider select-none transition-opacity duration-75",
        className
      )}
      style={{
        color,
        opacity: flickerState,
        textShadow: `0 0 10px ${color}88, 0 0 24px ${color}44, 0 1px 2px rgba(0,0,0,0.8)`,
      }}
    >
      {text}
    </Component>
  );
}

export default SignalType;
