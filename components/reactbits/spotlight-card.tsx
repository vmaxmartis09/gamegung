"use client";

import React, { useRef } from "react";
import { cn } from "@/lib/utils";

interface SpotlightCardProps extends React.HTMLAttributes<HTMLElement> {
  as?: "div" | "article";
  spotlightColor?: string;
}

/** Cursor-following spotlight + soft border glow (React Bits Spotlight Card / Border Glow). */
export function SpotlightCard({ as: Tag = "div", spotlightColor = "rgba(201,169,110,0.16)", className, children, onMouseMove, style, ...props }: SpotlightCardProps) {
  const ref = useRef<HTMLElement>(null);
  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    }
    onMouseMove?.(e);
  };
  return (
    <Tag
      {...(props as object)}
      ref={ref as never}
      onMouseMove={handleMove}
      style={{ ...style, "--spot": spotlightColor } as React.CSSProperties}
      className={cn("group/spot relative isolate", className)}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{ background: "radial-gradient(360px circle at var(--mx,50%) var(--my,50%), var(--spot), transparent 60%)" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          padding: 1,
          background: "radial-gradient(220px circle at var(--mx,50%) var(--my,50%), rgba(201,169,110,0.7), transparent 70%)",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      {children}
    </Tag>
  );
}
