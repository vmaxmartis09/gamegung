"use client";

import { cn } from "@/lib/utils";

/**
 * Aurora background (React Bits style) built from blurred CSS gradients, so it
 * costs no WebGL context. Motion is disabled by the global reduced-motion rule.
 */
export function Aurora({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none fixed inset-0 z-0 overflow-hidden", className)}>
      <div
        className="absolute -left-[10%] -top-[30%] h-[70vh] w-[70vw] animate-aurora-a rounded-full opacity-[0.16] blur-[60px] sm:blur-[110px] will-change-transform"
        style={{ background: "radial-gradient(closest-side, #c9a96e, transparent)" }}
      />
      <div
        className="absolute -right-[15%] top-[5%] h-[60vh] w-[60vw] animate-aurora-b rounded-full opacity-[0.12] blur-[70px] sm:blur-[120px] will-change-transform"
        style={{ background: "radial-gradient(closest-side, #8a6f3f, transparent)" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,transparent_40%,#0b0a09_95%)]" />
    </div>
  );
}
