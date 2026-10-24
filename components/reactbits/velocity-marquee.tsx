"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface VelocityMarqueeProps {
  /** Mỗi phần tử là một hàng chữ; hàng chẵn chạy sang trái, hàng lẻ chạy sang phải. */
  rows: string[];
  /** Tốc độ nền (px/giây). */
  speed?: number;
  /**
   * Vận tốc bên ngoài (0 = đứng yên, 1 = rất nhanh): nhân tốc độ và làm nghiêng chữ.
   * Thay cho vận tốc cuộn trang trong bản gốc.
   */
  velocity?: number;
  /** Hệ số tăng tốc khi `velocity` = 1. */
  boost?: number;
  /** Độ nghiêng tối đa (độ). */
  maxSkew?: number;
  className?: string;
  rowClassName?: string;
}

/**
 * Các hàng chữ lớn chạy ngược chiều nhau, nhanh và nghiêng hơn khi vận tốc tăng (React Bits Scroll Velocity).
 * `speed` và `velocity` đổi được liên tục mà không làm chữ giật về đầu.
 */
export function VelocityMarquee({
  rows,
  speed = 40,
  velocity = 0,
  boost = 6,
  maxSkew = 12,
  className,
  rowClassName,
}: VelocityMarqueeProps) {
  const reduce = useReducedMotion();
  const velRef = useRef(velocity);
  velRef.current = velocity;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);
  const copyRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [widths, setWidths] = useState<number[]>([]);

  useLayoutEffect(() => {
    setWidths(copyRefs.current.map((c) => c?.offsetWidth ?? 0));
  }, [rows]);

  useEffect(() => {
    if (reduce || !widths.some(Boolean)) return;
    let raf = 0;
    let last = performance.now();
    let v = 0;
    const offs = rows.map(() => 0);
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Làm mượt vận tốc để chữ không giật theo từng phím
      v += (Math.max(0, Math.min(1, velRef.current)) - v) * Math.min(1, dt * 4);
      const skew = v * maxSkew;
      trackRefs.current.forEach((el, i) => {
        const w = widths[i];
        if (!el || !w) return;
        const dir = i % 2 ? 1 : -1;
        offs[i] = (offs[i] + dir * speedRef.current * (1 + v * boost) * dt) % w;
        const x = dir < 0 ? offs[i] : offs[i] - w;
        el.style.transform = `translate3d(${x}px,0,0) skewX(${-dir * skew}deg)`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rows, widths, boost, maxSkew, reduce]);

  return (
    <div className={cn("pointer-events-none select-none overflow-hidden", className)} aria-hidden>
      {rows.map((text, i) => (
        <div
          key={i}
          ref={(n) => {
            trackRefs.current[i] = n;
          }}
          className={cn("flex w-max whitespace-nowrap will-change-transform", rowClassName)}
        >
          {/* Hai bản giống nhau nối đuôi để vòng lặp liền mạch */}
          <span
            ref={(n) => {
              copyRefs.current[i] = n;
            }}
            className="pr-[0.6em]"
          >
            {text}
          </span>
          <span className="pr-[0.6em]">{text}</span>
        </div>
      ))}
    </div>
  );
}
