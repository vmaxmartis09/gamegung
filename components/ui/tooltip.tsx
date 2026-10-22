"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SIDES = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "left-1/2 top-full mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
} as const;

/** Lightweight hover/focus tooltip. Keep content short; interactive content belongs in a popover. */
export function Tooltip({
  content,
  side = "top",
  delay = 350,
  className,
  children,
}: {
  content: React.ReactNode;
  side?: keyof typeof SIDES;
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };
  React.useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => e.key === "Escape" && hide()}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 w-max max-w-[16rem] animate-fade-in rounded-lg border border-white/10 bg-ink-800 px-2.5 py-1.5 text-xs font-medium leading-snug text-ink-100 shadow-lift",
            SIDES[side],
            className
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
