import { cn } from "@/lib/utils";

/** Slow-moving silver/white luxury monochrome shimmer on text (React Bits Gradient Text). */
export function GradientText({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn("animate-shimmer bg-clip-text text-transparent", className)}
      style={{
        backgroundImage: "linear-gradient(90deg, #737373, #ffffff, #d4d4d4, #ffffff, #737373)",
        backgroundSize: "200% 100%",
        animationDuration: "8s",
      }}
    >
      {children}
    </span>
  );
}
