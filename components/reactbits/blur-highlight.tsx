"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BlurHighlightProps {
  text?: string;
  words?: string[];
  highlightWords?: string[]; // list of exact words to highlight with glow
  activeIndex?: number; // active word index (for typing / guided focus)
  blurAmount?: number; // px of blur for inactive items (default 3px)
  highlightColor?: string; // background glow color e.g. "rgba(58, 208, 255, 0.25)"
  glowColor?: string; // text glow
  interactiveHover?: boolean; // hover to focus/highlight words
  className?: string;
  wordClassName?: string;
}

export function BlurHighlight({
  text,
  words: wordsProp,
  highlightWords = [],
  activeIndex,
  blurAmount = 3,
  highlightColor = "rgba(58, 208, 255, 0.22)",
  glowColor = "#3ad0ff",
  interactiveHover = true,
  className = "",
  wordClassName = "",
}: BlurHighlightProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const wordList = wordsProp || (text ? text.split(" ") : []);
  const effectiveActive = hoveredIndex !== null ? hoveredIndex : activeIndex;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 relative", className)}>
      {wordList.map((word, i) => {
        const isHighlightWord = highlightWords.some(
          (hw) => hw.toLowerCase() === word.replace(/[^a-zA-Z0-9À-ỹ]/g, "").toLowerCase()
        );
        const isFocused = effectiveActive === i || (effectiveActive === undefined && isHighlightWord);
        const hasActiveFocus = effectiveActive !== undefined;
        const isBlurred = hasActiveFocus && !isFocused && Math.abs((effectiveActive ?? 0) - i) > 1;

        return (
          <motion.span
            key={`${word}-${i}`}
            className={cn(
              "relative inline-block px-1.5 py-0.5 rounded-md transition-all duration-300 select-none",
              isBlurred ? "opacity-40" : "opacity-100",
              wordClassName
            )}
            style={{
              filter: isBlurred ? `blur(${blurAmount}px)` : "blur(0px)",
              textShadow: isFocused ? `0 0 12px ${glowColor}` : "none",
            }}
            onMouseEnter={interactiveHover ? () => setHoveredIndex(i) : undefined}
            onMouseLeave={interactiveHover ? () => setHoveredIndex(null) : undefined}
            layout
          >
            {isFocused && (
              <motion.span
                layoutId="blur-highlight-pill"
                className="absolute inset-0 rounded-md -z-10 shadow-sm"
                style={{
                  backgroundColor: highlightColor,
                  boxShadow: `0 0 16px ${highlightColor}`,
                }}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
              />
            )}
            <span className={cn(isFocused ? "text-white font-bold" : "text-white/80")}>
              {word}
            </span>
          </motion.span>
        );
      })}
    </span>
  );
}

export default BlurHighlight;
