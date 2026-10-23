"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SpringLetteringProps {
  text: string;
  triggerKey?: any; // re-triggers spring physics when this changes
  bounceOnHover?: boolean;
  className?: string;
  letterClassName?: string;
  stiffness?: number;
  damping?: number;
  delayStep?: number;
}

/**
 * SpringLettering - Physics-based kinetic typography where each letter stretches,
 * leans, and settles with organic spring damping. Provides mechanical tactile satisfaction.
 */
export function SpringLettering({
  text,
  triggerKey,
  bounceOnHover = true,
  className = "",
  letterClassName = "",
  stiffness = 380,
  damping = 18,
  delayStep = 0.03,
}: SpringLetteringProps) {
  return (
    <span className={cn("inline-flex items-baseline select-none", className)}>
      {Array.from(text).map((char, index) => {
        if (char === " ") {
          return <span key={index}>&nbsp;</span>;
        }

        return (
          <motion.span
            key={`${char}-${index}-${triggerKey ?? "init"}`}
            className={cn("inline-block will-change-transform", letterClassName)}
            initial={{ y: -12, scaleY: 1.35, scaleX: 0.85, opacity: 0.7 }}
            animate={{ y: 0, scaleY: 1, scaleX: 1, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness,
              damping,
              delay: index * delayStep,
            }}
            whileHover={
              bounceOnHover
                ? {
                    y: -6,
                    scale: 1.2,
                    rotate: (Math.random() - 0.5) * 12,
                    transition: { type: "spring", stiffness: 450, damping: 12 },
                  }
                : undefined
            }
          >
            {char}
          </motion.span>
        );
      })}
    </span>
  );
}

export default SpringLettering;
