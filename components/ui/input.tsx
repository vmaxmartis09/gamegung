import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, invalid, ...props }, ref) => (
  <input ref={ref} aria-invalid={invalid || undefined} className={cn("field", invalid && "border-danger/60 focus:border-danger/70", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <textarea ref={ref} aria-invalid={invalid || undefined} className={cn("field min-h-[96px] resize-y", invalid && "border-danger/60 focus:border-danger/70", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";

/** Label + control + hint/error, wired together with ids so screen readers announce them. */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  /** Receives the generated ids; spread them onto the control. */
  children: (ids: { id: string; "aria-describedby"?: string; invalid: boolean }) => React.ReactNode;
}) {
  const id = React.useId();
  const note = error ?? hint;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children({ id, "aria-describedby": note ? `${id}-note` : undefined, invalid: !!error })}
      {note && (
        <p id={`${id}-note`} className={cn("mt-1.5 text-xs", error ? "text-[#e08b8e]" : "text-ink-400")}>
          {note}
        </p>
      )}
    </div>
  );
}
