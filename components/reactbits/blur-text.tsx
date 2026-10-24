"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/motion";

/** Words fade in from a blur, staggered (React Bits Blur Text). Plays once on mount. */
export function BlurText({ text, delay = 0, step = 0.08, className }: { text: string; delay?: number; step?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={className} aria-label={text}>
      {text.split(" ").map((w, i, arr) => (
        <motion.span
          key={i}
          aria-hidden
          className="inline-block will-change-[filter,opacity]"
          initial={reduce ? false : { opacity: 0, filter: "blur(10px)", y: 8 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={{ duration: 0.6, delay: delay + i * step, ease: [0.22, 1, 0.36, 1] }}
        >
          {w}
          {i < arr.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  );
}
