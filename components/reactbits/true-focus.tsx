"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TrueFocusProps {
  words: string[];
  /** Từ đang được lấy nét. */
  index: number;
  /** Độ nhoè (px) của các từ còn lại. */
  blur?: number;
  className?: string;
  wordClassName?: string;
  /** Màu bốn góc khung lấy từ `border-*` (ví dụ `border-accent`). */
  frameClassName?: string;
}

/** Bốn góc khung lấy nét, phủ kín phần tử cha (cha cần `relative`). */
export function FocusFrame({ className, inset = 0 }: { className?: string; inset?: number }) {
  const corner = cn("absolute size-4 border-accent", className);
  return (
    <span aria-hidden className="pointer-events-none absolute" style={{ inset: -inset }}>
      <span className={cn(corner, "left-0 top-0 rounded-tl border-l-[3px] border-t-[3px]")} />
      <span className={cn(corner, "right-0 top-0 rounded-tr border-r-[3px] border-t-[3px]")} />
      <span className={cn(corner, "bottom-0 left-0 rounded-bl border-b-[3px] border-l-[3px]")} />
      <span className={cn(corner, "bottom-0 right-0 rounded-br border-b-[3px] border-r-[3px]")} />
    </span>
  );
}

/**
 * Dãy từ, chỉ từ đang chọn rõ nét trong bốn góc khung; các từ khác nhoè đi (React Bits True Focus).
 * Khung trượt từ từ này sang từ kế tiếp theo `index`.
 */
export function TrueFocus({ words, index, blur = 5, className, wordClassName, frameClassName }: TrueFocusProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = wordRefs.current[index];
    const wrap = wrapRef.current;
    if (!el || !wrap) return;
    const a = el.getBoundingClientRect();
    const b = wrap.getBoundingClientRect();
    // getBoundingClientRect đã nhân transform của cha: quy về toạ độ gốc của khung
    const k = wrap.offsetWidth ? b.width / wrap.offsetWidth : 1;
    setBox({ x: (a.left - b.left) / k, y: (a.top - b.top) / k, w: a.width / k, h: a.height / k });
  }, [index, words]);

  return (
    <div ref={wrapRef} className={cn("relative flex flex-wrap items-center justify-center gap-[0.5em]", className)}>
      {words.map((w, i) => (
        <span
          key={i}
          ref={(n) => {
            wordRefs.current[i] = n;
          }}
          className={cn("relative transition-[filter,opacity] duration-300 motion-reduce:transition-none", wordClassName)}
          style={{ filter: i === index ? "none" : `blur(${blur}px)`, opacity: i === index ? 1 : 0.45 }}
        >
          {w}
        </span>
      ))}
      {box && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0"
          initial={false}
          animate={{ x: box.x - 10, y: box.y - 6, width: box.w + 20, height: box.h + 12 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
        >
          <FocusFrame className={frameClassName} />
        </motion.div>
      )}
    </div>
  );
}
