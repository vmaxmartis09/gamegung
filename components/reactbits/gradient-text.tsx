import { cn } from "@/lib/utils";

/** Slow-moving champagne gradient on text (React Bits Gradient Text). */
export function GradientText({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn("animate-shimmer bg-clip-text text-transparent", className)}
      style={{
        backgroundImage: "linear-gradient(90deg, #a8864f, #f1deb4, #c9a96e, #f1deb4, #a8864f)",
        backgroundSize: "200% 100%",
        animationDuration: "8s",
      }}
    >
      {children}
    </span>
  );
}
