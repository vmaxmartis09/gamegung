import * as React from "react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  primary: "btn-accent",
  solid: "btn-lime",
  ghost: "btn-ghost",
  dark: "btn-dark",
  danger: "btn-danger",
} as const;

const SIZES = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Shows a spinner and blocks clicks while keeping the button's width. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "ghost", size = "md", loading = false, className, type = "button", disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
      {loading && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";
