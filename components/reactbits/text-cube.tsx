"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TextCubeProps {
  items: string[];
  interval?: number; // ms per rotation, default 3000ms
  cylinderRadius?: number; // height offset in px, default 16
  className?: string;
  itemClassName?: string;
}

/**
 * TextCube - 3D Tumbling Cube typography effect (React Bits Pro Text Cube).
 * Rotates through an array of phrases along the 3D X-axis.
 */
export function TextCube({
  items,
  interval = 3000,
  cylinderRadius = 16,
  className = "",
  itemClassName = "",
}: TextCubeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, interval);
    return () => clearInterval(timer);
  }, [items.length, interval]);

  const currentItem = items[currentIndex];
  const nextItem = items[(currentIndex + 1) % items.length];

  return (
    <div
      className={cn("relative overflow-hidden select-none", className)}
      style={{ perspective: 600, height: cylinderRadius * 2 }}
    >
      <div
        className="relative size-full transition-transform duration-700 ease-out"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${(currentIndex % 2 === 0 ? 0 : -90)}deg)`,
        }}
      >
        {/* Face 1 */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center font-bold backface-hidden",
            itemClassName
          )}
          style={{
            transform: `translateZ(${cylinderRadius}px)`,
          }}
        >
          {currentIndex % 2 === 0 ? currentItem : nextItem}
        </div>

        {/* Face 2 */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center font-bold backface-hidden",
            itemClassName
          )}
          style={{
            transform: `rotateX(90deg) translateZ(${cylinderRadius}px)`,
          }}
        >
          {currentIndex % 2 === 1 ? currentItem : nextItem}
        </div>
      </div>
    </div>
  );
}

// Alias for backwards compatibility
export const TextReveal3D = TextCube;

export default TextCube;
