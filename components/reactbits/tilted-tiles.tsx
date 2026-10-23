"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TiltedTileItem {
  id: string | number;
  content: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export interface TiltedTilesProps {
  /** Array of columns, each containing tile items */
  columns: TiltedTileItem[][];
  /** 3D rotation angles in degrees */
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  /** Perspective in px (default 1000px) */
  perspective?: number;
  /** Scale of the tiled wall (default 1.15) */
  scale?: number;
  /** Scrolling speed duration in seconds per loop (default 26s) */
  duration?: number;
  /** Scrolling direction pattern: 'alternate' | 'up' | 'down' */
  directionPattern?: "alternate" | "up" | "down";
  /** Whether scrolling is paused (e.g. during card lock-in) */
  paused?: boolean;
  /** Optional slow factor (1 = normal, >1 = slower) */
  speedMultiplier?: number;
  /** Top/bottom gradient fade mask */
  showFadeMask?: boolean;
  className?: string;
  tileClassName?: string;
}

export function TiltedTiles({
  columns,
  rotateX = 18,
  rotateY = -14,
  rotateZ = 8,
  perspective = 1000,
  scale = 1.18,
  duration = 24,
  directionPattern = "alternate",
  paused = false,
  speedMultiplier = 1,
  showFadeMask = true,
  className,
  tileClassName,
}: TiltedTilesProps) {
  // Triple the column items so the infinite seamless loop never reveals an edge
  const loopedColumns = useMemo(() => {
    return columns.map((col) => [...col, ...col, ...col]);
  }, [columns]);

  return (
    <div
      className={cn(
        "relative w-full h-full overflow-hidden select-none pointer-events-none",
        className
      )}
      style={{
        perspective: `${perspective}px`,
        transformStyle: "preserve-3d",
      }}
    >
      {/* 3D Tilted container */}
      <div
        className="absolute inset-[-40%] flex justify-center items-center gap-4 sm:gap-6"
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) scale(${scale})`,
          transformStyle: "preserve-3d",
        }}
      >
        {loopedColumns.map((col, colIdx) => {
          const isReverse =
            directionPattern === "down"
              ? true
              : directionPattern === "up"
              ? false
              : colIdx % 2 === 1;

          // Vary duration slightly per column for an organic parallax effect
          const colDuration = (duration * (1 + (colIdx % 3) * 0.15)) * speedMultiplier;

          return (
            <div
              key={colIdx}
              className="flex flex-col gap-4 sm:gap-6 shrink-0 w-36 sm:w-44 md:w-52"
              style={{
                transformStyle: "preserve-3d",
              }}
            >
              <motion.div
                className="flex flex-col gap-4 sm:gap-6 will-change-transform"
                animate={
                  paused
                    ? { y: 0 }
                    : {
                        y: isReverse ? ["-33.333%", "0%"] : ["0%", "-33.333%"],
                      }
                }
                transition={
                  paused
                    ? { duration: 0.5, ease: "easeOut" }
                    : {
                        y: {
                          repeat: Infinity,
                          repeatType: "loop",
                          duration: colDuration,
                          ease: "linear",
                        },
                      }
                }
              >
                {col.map((item, itemIdx) => (
                  <div
                    key={`${colIdx}-${itemIdx}-${item.id}`}
                    onClick={item.onClick}
                    className={cn(
                      "group relative rounded-2xl overflow-hidden border border-white/10 bg-ink-900/90 shadow-2xl transition-all duration-300",
                      item.onClick && "pointer-events-auto cursor-pointer hover:border-white/30 hover:scale-[1.03]",
                      tileClassName,
                      item.className
                    )}
                    style={{
                      transformStyle: "preserve-3d",
                    }}
                  >
                    {item.content}
                  </div>
                ))}
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Top & Bottom & Radial Vignette fade masks */}
      {showFadeMask && (
        <>
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              background:
                "radial-gradient(circle at center, transparent 35%, rgba(6, 6, 6, 0.7) 75%, rgba(6, 6, 6, 0.98) 100%)",
            }}
          />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#060606] via-[#060606]/80 to-transparent pointer-events-none z-10" />
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#060606] via-[#060606]/85 to-transparent pointer-events-none z-10" />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#060606] to-transparent pointer-events-none z-10" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#060606] to-transparent pointer-events-none z-10" />
        </>
      )}
    </div>
  );
}

export default TiltedTiles;
