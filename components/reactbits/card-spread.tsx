"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface CardSpreadItem {
  id: string | number;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
  badge?: string;
}

interface CardSpreadProps {
  items: CardSpreadItem[];
  className?: string;
  spreadAngle?: number; // max degree of fan
  maxSpreadDistance?: number; // px separation
  onSelect?: (item: CardSpreadItem, index: number) => void;
}

export function CardSpread({
  items,
  className,
  spreadAngle = 24,
  maxSpreadDistance = 45,
  onSelect,
}: CardSpreadProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [isContainerHovered, setIsContainerHovered] = useState(false);

  const total = items.length;
  const mid = (total - 1) / 2;

  return (
    <div
      className={cn("relative flex items-center justify-center py-8 select-none", className)}
      onMouseEnter={() => setIsContainerHovered(true)}
      onMouseLeave={() => {
        setIsContainerHovered(false);
        setHoveredIdx(null);
      }}
    >
      <div className="relative h-44 w-32 sm:h-52 sm:w-36">
        {items.map((item, idx) => {
          const offset = idx - mid;
          const rotate = isContainerHovered ? offset * (spreadAngle / Math.max(1, mid)) : offset * 3;
          const x = isContainerHovered ? offset * maxSpreadDistance : offset * 8;
          const y = isContainerHovered ? Math.abs(offset) * 6 : 0;
          const isSelected = hoveredIdx === idx;

          return (
            <motion.div
              key={item.id}
              className="absolute inset-0 cursor-pointer rounded-2xl border border-white/20 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md transition-shadow"
              style={{
                zIndex: isSelected ? 30 : idx + 10,
                boxShadow: isSelected
                  ? `0 12px 32px -4px ${item.color || "#38bdf8"}66`
                  : "0 8px 24px -8px rgba(0,0,0,0.6)",
                borderColor: isSelected ? item.color || "#38bdf8" : "rgba(255,255,255,0.15)",
              }}
              animate={{
                x,
                y: isSelected ? y - 24 : y,
                rotate: isSelected ? 0 : rotate,
                scale: isSelected ? 1.08 : 1,
              }}
              transition={{
                type: "spring",
                stiffness: 280,
                damping: 20,
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onClick={() => onSelect?.(item, idx)}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between text-xs">
                {item.icon && <span className="text-xl">{item.icon}</span>}
                {item.badge && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider"
                    style={{
                      color: item.color || "#38bdf8",
                      backgroundColor: `${item.color || "#38bdf8"}22`,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Card Body */}
              <div className="mt-8 flex flex-col">
                <span className="font-display text-sm font-bold text-white truncate">{item.title}</span>
                {item.subtitle && (
                  <span className="text-[11px] text-slate-400 font-sans line-clamp-2 mt-0.5">
                    {item.subtitle}
                  </span>
                )}
              </div>

              {/* Decorative Glow */}
              <div
                className="absolute inset-x-0 bottom-0 h-1 rounded-b-2xl opacity-80"
                style={{ background: item.color || "#38bdf8" }}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
