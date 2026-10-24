"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface TextLoopProps {
  /** Cụm chữ lặp lại, nối bằng `separator`. */
  items: string[];
  separator?: string;
  /** Tốc độ chạy (px/giây trong toạ độ SVG). */
  speed?: number;
  /** Độ cao của sóng. */
  amplitude?: number;
  /** Số nhịp sóng trên bề ngang. */
  waves?: number;
  fontSize?: number;
  /** Độ dày ruy băng so với cỡ chữ. */
  band?: number;
  /** Bề ngang hệ toạ độ SVG; đặt bằng bề ngang hiển thị để cỡ chữ đúng bằng px. */
  viewWidth?: number;
  reverse?: boolean;
  /** Màu dải ruy băng lấy từ `currentColor` (ví dụ `text-danger`). */
  className?: string;
  style?: React.CSSProperties;
  /** Lớp cho chữ (ví dụ `fill-ink-100`). */
  textClassName?: string;
}

/**
 * Dải ruy băng chữ chạy vô tận theo một đường cong SVG (React Bits Text Loop).
 * Ruy băng là nét vẽ dày theo cùng đường `textPath`, chữ đậm chạy trên đó.
 */
export function TextLoop({
  items,
  separator = "✦",
  speed = 70,
  amplitude = 22,
  waves = 1.5,
  fontSize = 26,
  band = 1.7,
  viewWidth: VW = 1200,
  reverse = false,
  className,
  style,
  textClassName,
}: TextLoopProps) {
  const id = `text-loop-${useId().replace(/:/g, "")}`;
  const reduce = useReducedMotion();
  const oneRef = useRef<SVGTextElement>(null);
  const twoRef = useRef<SVGTextElement>(null);
  const pathTextRef = useRef<SVGTextPathElement>(null);
  const [unitW, setUnitW] = useState(0);
  // Đổi tốc độ giữa chừng không làm chữ giật về đầu
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const unit = items.map((s) => `${s} ${separator} `).join("");
  const textCls = cn("font-display font-extrabold uppercase tracking-wide", textClassName);
  const height = amplitude * 2 + fontSize * band + 4;
  const mid = height / 2;

  // Đường sóng: các đoạn cong bậc ba nối nhau, dư hai đầu để chữ không hụt mép
  const seg = VW / (waves * 2);
  let d = `M ${-seg} ${mid}`;
  for (let x = -seg, up = true; x < VW + seg; x += seg, up = !up) {
    const y = mid + (up ? -amplitude : amplitude);
    d += ` C ${x + seg * 0.4} ${y}, ${x + seg * 0.6} ${y}, ${x + seg} ${mid}`;
  }

  // SVG bỏ khoảng trắng cuối chuỗi, nên đo hiệu của hai lần lặp và một lần lặp
  useLayoutEffect(() => {
    const w = (twoRef.current?.getComputedTextLength() ?? 0) - (oneRef.current?.getComputedTextLength() ?? 0);
    if (w > 0) setUnitW(w);
  }, [unit, fontSize]);

  // Đủ số lần lặp để phủ cả đường cong khi đã dịch đi một đơn vị
  const copies = unitW ? Math.ceil((VW * 1.6) / unitW) + 2 : 1;

  useEffect(() => {
    const el = pathTextRef.current;
    if (!el || !unitW || reduce) return;
    let raf = 0;
    let last = performance.now();
    let off = 0;
    const tick = (now: number) => {
      off = (off + ((now - last) / 1000) * speedRef.current) % unitW;
      last = now;
      el.setAttribute("startOffset", String(reverse ? off - unitW : -off));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [unitW, reverse, reduce]);

  return (
    <svg
      viewBox={`0 0 ${VW} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className={cn("block w-full overflow-hidden", className)}
      style={style}
      role="img"
      aria-label={items.join(" ")}
    >
      <defs>
        <path id={id} d={d} />
      </defs>
      <use href={`#${id}`} fill="none" stroke="currentColor" strokeWidth={fontSize * band} strokeLinecap="butt" />
      {/* Đo bề rộng một đơn vị chữ */}
      <text ref={oneRef} fontSize={fontSize} className={textCls} opacity={0} aria-hidden>
        {unit}
      </text>
      <text ref={twoRef} fontSize={fontSize} className={textCls} opacity={0} aria-hidden>
        {unit.repeat(2)}
      </text>
      <text
        fontSize={fontSize}
        dominantBaseline="central"
        className={textCls}
        aria-hidden
      >
        <textPath ref={pathTextRef} href={`#${id}`} startOffset={reverse && unitW ? -unitW : 0}>
          {unit.repeat(copies)}
        </textPath>
      </text>
    </svg>
  );
}
