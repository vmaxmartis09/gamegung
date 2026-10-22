import React from "react";
import { cn } from "@/lib/utils";

/** Slow orbiting highlight around a pill (React Bits Star Border), accent coloured. */
export function StarBorder({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-flex overflow-hidden rounded-full p-px", className)}>
      <span
        aria-hidden
        className="absolute inset-[-100%] animate-[spin_6s_linear_infinite]"
        style={{ background: "conic-gradient(from 0deg, transparent 0 70%, var(--accent) 90%, transparent 100%)" }}
      />
      <span className="relative inline-flex items-center gap-2 rounded-full bg-ink-900 px-3 py-1.5 text-xs font-semibold text-ink-100">{children}</span>
    </span>
  );
}
