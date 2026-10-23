"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";

/** Wrap text into lines of at most `max` chars, keeping the start offset of each line. */
function wrap(text: string, max: number) {
  const lines: { start: number; text: string }[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + max);
    if (end < text.length) {
      const sp = text.lastIndexOf(" ", end);
      if (sp > start) end = sp + 1;
    }
    lines.push({ start, text: text.slice(start, end) });
    start = end;
  }
  return lines;
}

interface CylinderTextProps {
  text: string;
  /** Number of characters already typed. */
  index: number;
  color: string;
  lineHeight?: number;
  maxChars?: number;
  /** Degrees between neighbouring lines on the cylinder. */
  step?: number;
  className?: string;
}

/**
 * Text lines laid out on a 3D cylinder (React Bits 3D Text Reveal): the line being typed sits
 * front and centre, finished lines roll up and away, upcoming lines curve in from below.
 */
export const CylinderText = memo(function CylinderText({
  text,
  index,
  color,
  lineHeight = 34,
  maxChars = 44,
  step = 26,
  className,
}: CylinderTextProps) {
  const lines = useMemo(() => wrap(text, maxChars), [text, maxChars]);
  let active = lines.findIndex((l) => index < l.start + l.text.length);
  if (active < 0) active = lines.length - 1;
  const radius = lineHeight / 2 / Math.tan((step / 2) * (Math.PI / 180));

  return (
    <div className={cn("relative select-none", className)} style={{ perspective: 700, height: lineHeight * 3 }}>
      <div
        className="absolute inset-x-0 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
        style={{
          top: lineHeight,
          height: lineHeight,
          transformStyle: "preserve-3d",
          transform: `translateZ(-${radius}px) rotateX(${-active * step}deg)`,
        }}
      >
        {lines.map((l, i) => {
          const d = Math.abs(i - active);
          if (d > 2) return null;
          return (
            <div
              key={l.start}
              className="absolute inset-0 flex items-center justify-center whitespace-pre font-mono text-[22px] font-medium tracking-wide"
              style={{
                transform: `rotateX(${i * step}deg) translateZ(${radius}px)`,
                backfaceVisibility: "hidden",
                opacity: d === 0 ? 1 : d === 1 ? 0.35 : 0.12,
                transition: "opacity 400ms",
              }}
            >
              {Array.from(l.text).map((ch, k) => {
                const at = l.start + k;
                const done = at < index;
                const cur = at === index;
                return (
                  <span
                    key={k}
                    style={{
                      color: done ? "#94a3b8" : cur ? "#0b0d12" : "#f1f5f9",
                      background: cur ? color : undefined,
                      borderRadius: cur ? 3 : undefined,
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default CylinderText;

interface CylinderWordsProps {
  /** Danh sách từ nối tiếp nhau; `active` là vị trí từ đang gõ. */
  words: string[];
  active: number;
  /** Số ký tự đã gõ của từ đang gõ, cho từng người chơi. */
  typed: [number, number];
  colors: [string, string];
  lineHeight?: number;
  step?: number;
  fontSize?: number;
  className?: string;
}

/**
 * Từ khóa trên mặt trụ 3D (React Bits 3D Text Reveal): từ đang gõ ở giữa, từ đã bắn cuộn lên,
 * từ sắp tới cong lên từ dưới. Hai người cùng gõ một từ: vạch dưới chữ là tiến độ người 1, vạch trên là người 2.
 */
export const CylinderWords = memo(function CylinderWords({ words, active, typed, colors, lineHeight = 88, step = 42, fontSize = 76, className }: CylinderWordsProps) {
  const radius = lineHeight / 2 / Math.tan((step / 2) * (Math.PI / 180));
  return (
    <div className={cn("relative select-none", className)} style={{ perspective: 620, height: lineHeight * 3 }}>
      <div
        className="absolute inset-x-0 transition-transform duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ top: lineHeight, height: lineHeight, transformStyle: "preserve-3d", transform: `translateZ(-${radius}px) rotateX(${-active * step}deg)` }}
      >
        {words.map((w, i) => {
          const d = Math.abs(i - active);
          if (d > 2) return null;
          return (
            <div
              key={i}
              className="absolute inset-0 flex items-center justify-center whitespace-pre font-display font-black uppercase leading-none tracking-tight"
              style={{
                fontSize,
                transform: `rotateX(${i * step}deg) translateZ(${radius}px)`,
                backfaceVisibility: "hidden",
                color: d === 0 ? "#ffffff" : "#9ca3af",
                opacity: d === 0 ? 1 : d === 1 ? 0.55 : 0.18,
                transition: "opacity 500ms, color 500ms",
              }}
            >
              {Array.from(w).map((ch, k) => (
                <span
                  key={k}
                  style={{
                    borderBottom: d === 0 && k < typed[0] ? `6px solid ${colors[0]}` : "6px solid transparent",
                    borderTop: d === 0 && k < typed[1] ? `6px solid ${colors[1]}` : "6px solid transparent",
                  }}
                >
                  {ch}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
});
