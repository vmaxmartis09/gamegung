"use client";

import React, { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useReducedMotion } from "@/lib/motion";

/** Subtle 3D tilt toward the cursor (React Bits Tilted Card). Angle kept low for a mature feel. */
export function TiltedCard({ children, className, maxTilt = 4 }: { children: React.ReactNode; className?: string; maxTilt?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rx = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 });
  const ry = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 });

  const onMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 2 * maxTilt);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 2 * maxTilt);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <div style={{ perspective: 1000 }} className={className}>
      <motion.div ref={ref} onMouseMove={onMove} onMouseLeave={reset} style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }} className="h-full">
        {children}
      </motion.div>
    </div>
  );
}
