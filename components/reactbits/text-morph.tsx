"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TextMorphProps {
  text: string;
  className?: string;
  characterClassName?: string;
}

/**
 * TextMorph - Smoothly morphs/transitions text from one phrase to another
 * with spring physics and character-level layout matching.
 */
export function TextMorph({
  text,
  className = "",
  characterClassName = "",
}: TextMorphProps) {
  return (
    <span className={cn("inline-flex overflow-hidden select-none font-mono", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        {Array.from(text).map((char, index) => (
          <motion.span
            key={`${index}-${char}`}
            layout
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{
              type: "spring",
              stiffness: 420,
              damping: 24,
              duration: 0.25,
            }}
            className={cn("inline-block", characterClassName)}
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}

export default TextMorph;
