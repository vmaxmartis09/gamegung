import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Ported from KokonutUI Loader
 * @license: MIT — Copyright (c) KokonutUI (https://kokonutui.com)
 * @github: https://github.com/kokonut-labs/kokonutui
 * Rotating gradient rings tinted with currentColor.
 */

const ringMask = (stops: string) => `radial-gradient(circle at 50% 50%, ${stops})`;

const RINGS: { id: string; style: CSSProperties }[] = [
  {
    id: "outer",
    style: {
      background: "conic-gradient(from 0deg, transparent 0deg, currentColor 90deg, transparent 180deg)",
      mask: ringMask("transparent 35%, black 37%, black 39%, transparent 41%"),
      WebkitMask: ringMask("transparent 35%, black 37%, black 39%, transparent 41%"),
      opacity: 0.8,
      animationDuration: "3s",
    },
  },
  {
    id: "primary",
    style: {
      background:
        "conic-gradient(from 0deg, transparent 0deg, currentColor 120deg, color-mix(in srgb, currentColor 50%, transparent) 240deg, transparent 360deg)",
      mask: ringMask("transparent 42%, black 44%, black 48%, transparent 50%"),
      WebkitMask: ringMask("transparent 42%, black 44%, black 48%, transparent 50%"),
      opacity: 0.9,
      animationDuration: "1.2s",
    },
  },
  {
    id: "counter",
    style: {
      background: "conic-gradient(from 180deg, transparent 0deg, color-mix(in srgb, currentColor 60%, transparent) 45deg, transparent 90deg)",
      mask: ringMask("transparent 52%, black 54%, black 56%, transparent 58%"),
      WebkitMask: ringMask("transparent 52%, black 54%, black 56%, transparent 58%"),
      opacity: 0.35,
      animationDuration: "4s",
      animationDirection: "reverse",
    },
  },
  {
    id: "accent",
    style: {
      background: "conic-gradient(from 270deg, transparent 0deg, color-mix(in srgb, currentColor 40%, transparent) 20deg, transparent 40deg)",
      mask: ringMask("transparent 61%, black 62%, black 63%, transparent 64%"),
      WebkitMask: ringMask("transparent 61%, black 62%, black 63%, transparent 64%"),
      opacity: 0.5,
      animationDuration: "3.5s",
    },
  },
];

export default function Loader({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("relative grid size-32 place-items-center", className)}>
      {RINGS.map((ring) => (
        <div aria-hidden="true" className="absolute inset-0 rounded-full motion-safe:animate-spin motion-reduce:animate-pulse" key={ring.id} style={ring.style} />
      ))}
      {children}
    </div>
  );
}
