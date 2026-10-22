import { memo } from "react";

/**
 * Flat, minimal chess piece icons. Solid silhouettes on a 48×48 grid,
 * one crisp outline, no gradients or blur — they stay sharp at any size.
 */

type PieceType = "k" | "q" | "r" | "b" | "n" | "p";

const BASE = "M11 37.5h26a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5H11A1.5 1.5 0 0 1 9.5 41v-2a1.5 1.5 0 0 1 1.5-1.5Z";

const SHAPES: Record<PieceType, string[]> = {
  p: ["M24 8a6 6 0 0 1 3.6 10.8H30a1 1 0 0 1 0 3h-2.2l2.7 15.7H17.5l2.7-15.7H18a1 1 0 0 1 0-3h2.4A6 6 0 0 1 24 8Z", BASE],
  r: [
    "M13 7h5v4h3.5V7h5v4H30V7h5v9.5a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2Z",
    "M16 18.5h16l1.5 19h-19Z",
    BASE,
  ],
  b: [
    "M24 4.5a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z",
    "M24 9.5c5.8 4 8.4 10.2 6 15.5H18c-2.4-5.3.2-11.5 6-15.5Z",
    "M17.5 25.5h13a1.3 1.3 0 0 1 0 2.6h-13a1.3 1.3 0 0 1 0-2.6Z",
    "M19 28h10l3 9.5H16Z",
    BASE,
  ],
  n: [
    "M14.5 37.5c-.6-6.7 2.4-10.6 7.6-14.1-3.1.4-5.6.1-7.9-1.4a2.4 2.4 0 0 1-.6-3.3l5.9-8.5C21.4 7.4 24.3 6 28 6.4c6 .7 9.6 6.5 9 15.2-.4 6.3-2.2 10.4-1.6 15.9Z",
    BASE,
  ],
  q: [
    "M8.5 15.5 16 22l3.2-10.3L24 21l4.8-9.3L32 22l7.5-6.5-4.2 16H12.7Z",
    "M12.7 31.5h22.6l-1.3 6H14Z",
    BASE,
  ],
  k: [
    "M22.5 3.5h3v4h4v3h-4v4h-3v-4h-4v-3h4Z",
    "M24 15c6.8 0 11.4 5.4 9.5 13.5l-.8 3H15.3l-.8-3C12.6 20.4 17.2 15 24 15Z",
    "M15.3 31.5h17.4l1 6H14.3Z",
    BASE,
  ],
};

// Small dots/lines that read as detail without adding noise.
const DETAIL: Partial<Record<PieceType, string>> = {
  b: "M26.2 14.5 22 19.6",
  n: "M27.8 12.2a1.4 1.4 0 1 0 .01 0Z",
  q: "M8.5 15.5a2.3 2.3 0 1 0 .01 0ZM19.2 10.6a2.3 2.3 0 1 0 .01 0ZM28.8 10.6a2.3 2.3 0 1 0 .01 0ZM39.5 15.5a2.3 2.3 0 1 0 .01 0Z",
};

export const ChessIcon = memo(function ChessIcon({
  type,
  color,
  className,
}: {
  type: string;
  color: "w" | "b";
  className?: string;
}) {
  const t = type as PieceType;
  const white = color === "w";
  const fill = white ? "#fafafa" : "#18181b";
  const stroke = white ? "#18181b" : "#fafafa";
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" shapeRendering="geometricPrecision">
      <g fill={fill} stroke={stroke} strokeWidth={white ? 2 : 1.6} strokeLinejoin="round" paintOrder="stroke">
        {SHAPES[t]?.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {DETAIL[t] && (
        <path
          d={DETAIL[t]}
          fill={t === "q" ? fill : stroke}
          stroke={stroke}
          strokeWidth={t === "q" ? (white ? 2 : 1.6) : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
});
