"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Small trailing count or marker. */
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** `underline` for page sections, `segmented` for compact switches inside panels. */
  variant?: "underline" | "segmented";
  label?: string;
  className?: string;
}

/** Controlled tab strip with roving focus (←/→/Home/End) and a sliding indicator. */
export function Tabs<T extends string = string>({ items, value, onChange, variant = "underline", label, className }: TabsProps<T>) {
  const group = React.useId();
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (from: number, step: 1 | -1 | "first" | "last") => {
    const enabled = items.filter((i) => !i.disabled);
    if (enabled.length === 0) return;
    const current = enabled.findIndex((i) => i.id === items[from].id);
    const next = step === "first" ? 0 : step === "last" ? enabled.length - 1 : (current + step + enabled.length) % enabled.length;
    const target = enabled[next];
    onChange(target.id);
    refs.current[target.id]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowRight") move(index, 1);
    else if (e.key === "ArrowLeft") move(index, -1);
    else if (e.key === "Home") move(index, "first");
    else if (e.key === "End") move(index, "last");
    else return;
    e.preventDefault();
  };

  const segmented = variant === "segmented";

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(segmented ? "inline-flex gap-0.5 rounded-xl border border-white/[0.075] bg-white/[0.025] p-1" : "flex gap-6 border-b border-white/[0.075]", className)}
    >
      {items.map((item, index) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[item.id] = el;
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              "relative inline-flex items-center gap-2 text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
              segmented ? "rounded-lg px-3.5 py-1.5" : "-mb-px px-0.5 pb-3 pt-1",
              active ? (segmented ? "text-ink-100" : "text-ink-100") : "text-ink-400 hover:text-ink-200"
            )}
          >
            {active && (
              <motion.span
                layoutId={`tab-indicator-${group}`}
                aria-hidden
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className={cn("absolute", segmented ? "inset-0 rounded-lg bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" : "inset-x-0 -bottom-px h-px bg-accent")}
              />
            )}
            <span className="relative flex items-center gap-2">
              {item.icon}
              {item.label}
              {item.badge != null && <span className="rounded-full bg-white/[0.08] px-1.5 text-[10px] font-medium tabular text-ink-200">{item.badge}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
