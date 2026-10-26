"use client";

import { cn } from "@/lib/utils";

/**
 * Aurora background (React Bits style) built from blurred CSS gradients, so it
 * costs no WebGL context. Motion is disabled by the global reduced-motion rule.
 */
export function Aurora({ className, still = false }: { className?: string; still?: boolean }) {
  return (
    <div aria-hidden className={cn("pointer-events-none fixed inset-0 z-0 overflow-hidden", className)}>
      <div
        className={cn("absolute -left-[10%] -top-[30%] h-[70vh] w-[70vw] rounded-full opacity-[0.05] blur-[60px] sm:blur-[110px]", !still && "animate-aurora-a will-change-transform")}
        style={{ background: "radial-gradient(closest-side, #ffffff, transparent)" }}
      />
      <div
        className={cn("absolute -right-[15%] top-[5%] h-[60vh] w-[60vw] rounded-full opacity-[0.04] blur-[70px] sm:blur-[120px]", !still && "animate-aurora-b will-change-transform")}
        style={{ background: "radial-gradient(closest-side, #a3a3a3, transparent)" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,transparent_40%,#060606_95%)]" />
    </div>
  );
}
