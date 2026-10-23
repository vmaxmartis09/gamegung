import * as React from "react";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "border-white/10 bg-white/[0.04] text-ink-200",
  accent: "border-accent/35 bg-accent-soft text-accent-300",
  success: "border-success/30 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  danger: "border-danger/30 bg-danger-soft text-[#e08b8e]",
  info: "border-info/30 bg-info-soft text-info",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", TONES[tone], className)} {...props} />;
}
