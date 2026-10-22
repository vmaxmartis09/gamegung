import * as React from "react";
import { cn } from "@/lib/utils";

/** A single figure with a quiet label. Value uses the serif display face with tabular numerals. */
export function Stat({
  label,
  value,
  hint,
  icon,
  size = "md",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-400">
        {icon}
        {label}
      </span>
      <span className={cn("num font-medium leading-none text-ink-100", size === "sm" && "text-lg", size === "md" && "text-2xl", size === "lg" && "text-display-md")}>{value}</span>
      {hint && <span className="text-xs text-ink-400">{hint}</span>}
    </div>
  );
}
