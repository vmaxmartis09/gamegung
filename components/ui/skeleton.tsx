import * as React from "react";
import { cn } from "@/lib/utils";

/** Loading placeholder. Size it with className (e.g. `h-4 w-32`); it pulses softly and respects reduced motion. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("animate-skeleton rounded-lg bg-white/[0.06]", className)} {...props} />;
}
