"use client";

import { useEffect, useRef } from "react";
import { animate, useInView } from "framer-motion";
import { useReducedMotion } from "@/lib/motion";

/** Counts up to `value` once visible (React Bits Count Up). */
export function CountUp({
  to,
  value = to ?? 0,
  duration = 1.1,
  locale = "vi-VN",
  className,
}: {
  to?: number;
  value?: number;
  duration?: number;
  locale?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const prev = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || !inView) {
      el.textContent = value.toLocaleString(locale);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = Math.round(v).toLocaleString(locale);
      },
      onComplete: () => {
        prev.current = value;
      },
    });
    return () => controls.stop();
  }, [value, inView, reduce, duration, locale]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString(locale)}
    </span>
  );
}
