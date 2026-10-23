"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface BendingMarqueeProps {
  text?: string;
  items?: string[];
  speed?: number; // pixels per second
  curve?: number; // curve depth in px (positive = concave curve downward, negative = convex dome upward)
  reverse?: boolean;
  className?: string;
  textClassName?: string;
  fontSize?: number;
  separator?: string;
  repeat?: number;
  pauseOnHover?: boolean;
  height?: number;
}

export function BendingMarquee({
  text,
  items,
  speed = 40,
  curve = 35,
  reverse = false,
  className = "",
  textClassName = "",
  fontSize = 18,
  separator = " ✦ ",
  repeat = 8,
  pauseOnHover = true,
  height = 90,
}: BendingMarqueeProps) {
  const pathId = `bending-marquee-${useId().replace(/:/g, "")}`;
  const [offset, setOffset] = useState(0);
  const isHoveredRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Combine items or text
  const baseString = items ? items.join(separator) : (text || "");
  const fullContent = Array(repeat).fill(baseString).join(separator);

  // SVG dimensions
  const svgWidth = 1400;
  const baseY = height / 2;
  const controlY = baseY + curve;

  // Quadratic Bezier curve
  const pathD = `M 0,${baseY} Q ${svgWidth / 2},${controlY} ${svgWidth},${baseY}`;

  useEffect(() => {
    let currentOffset = reverse ? 0 : 0;
    const direction = reverse ? 1 : -1;

    const animate = (time: number) => {
      if (lastTimeRef.current !== null) {
        const delta = (time - lastTimeRef.current) / 1000;
        if (!isHoveredRef.current || !pauseOnHover) {
          currentOffset += direction * speed * delta;
          // Loop smoothly across arbitrary boundary
          if (currentOffset <= -svgWidth) {
            currentOffset += svgWidth;
          } else if (currentOffset >= svgWidth) {
            currentOffset -= svgWidth;
          }
          setOffset(currentOffset);
        }
      }
      lastTimeRef.current = time;
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [speed, reverse, svgWidth, pauseOnHover]);

  return (
    <div
      className={cn("w-full overflow-hidden select-none pointer-events-auto", className)}
      style={{ height }}
      onMouseEnter={() => { isHoveredRef.current = true; }}
      onMouseLeave={() => { isHoveredRef.current = false; }}
    >
      <svg
        viewBox={`0 0 ${svgWidth} ${height}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <path id={pathId} d={pathD} fill="none" />
        </defs>
        <text
          className={cn("fill-current font-bold uppercase tracking-widest", textClassName)}
          style={{ fontSize }}
        >
          <textPath href={`#${pathId}`} startOffset={`${offset}px`}>
            {fullContent}
          </textPath>
        </text>
      </svg>
    </div>
  );
}

export default BendingMarquee;
