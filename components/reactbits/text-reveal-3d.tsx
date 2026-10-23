"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TextReveal3DProps {
  items: string[];
  className?: string;
  itemClassName?: string;
  interval?: number; // ms between rotations
  cylinderRadius?: number; // px depth for 3D cylinder
  autoPlay?: boolean;
}

export function TextReveal3D({
  items,
  className,
  itemClassName,
  interval = 2800,
  cylinderRadius = 40,
  autoPlay = true,
}: TextReveal3DProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!autoPlay || items.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, interval);
    return () => clearInterval(timer);
  }, [autoPlay, items.length, interval]);

  if (!items || items.length === 0) return null;

  const total = items.length;
  const angleStep = 360 / total;

  return (
    <div
      className={cn("relative h-10 overflow-hidden select-none", className)}
      style={{ perspective: "1000px" }}
    >
      <div
        className="relative size-full transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${-activeIndex * angleStep}deg)`,
        }}
      >
        {items.map((item, idx) => {
          const itemAngle = idx * angleStep;
          const isCurrent = idx === activeIndex;

          return (
            <div
              key={idx}
              className={cn(
                "absolute inset-0 flex items-center justify-start font-display font-medium tracking-tight text-white transition-opacity duration-500",
                isCurrent ? "opacity-100" : "opacity-25 blur-[1px]",
                itemClassName
              )}
              style={{
                transform: `rotateX(${itemAngle}deg) translateZ(${cylinderRadius}px)`,
                backfaceVisibility: "hidden",
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
}
