import * as React from "react";
import { cn } from "@/lib/utils";

/** Placeholder for lists with nothing in them yet: say what is missing and offer the next step. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center", className)}>
      {icon && <span className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-ink-300 [&_svg]:size-5">{icon}</span>}
      <div className="space-y-1">
        <p className="font-display text-lg font-medium text-ink-100">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-ink-300">{description}</p>}
      </div>
      {action}
    </div>
  );
}
