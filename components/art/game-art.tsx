import React, { memo } from "react";
import { cn } from "@/lib/utils";

export type GameId = "chess" | "xiangqi" | "werewolf" | "arcade" | "uno" | "typing";

/* ---------------------------------------------------------------------------
 * Cover illustrations (400×260). Original artwork, pure SVG, no network.
 * ------------------------------------------------------------------------- */

const VP = { x: 200, y: 150 };
const FLOOR_ROWS = [176, 190, 210, 236, 268];
// Perspective checker floor, computed once.
const FLOOR_TILES = (() => {
  const tiles: { d: string; dark: boolean }[] = [];
  const xAt = (bx: number, y: number) => VP.x + (bx - VP.x) * ((y - VP.y) / (268 - VP.y));
  for (let r = 0; r < FLOOR_ROWS.length - 1; r++) {
    const y0 = FLOOR_ROWS[r];
    const y1 = FLOOR_ROWS[r + 1];
    for (let c = -7; c < 7; c++) {
      const b0 = 200 + c * 64;
      const b1 = b0 + 64;
      const d = `M${xAt(b0, y0).toFixed(1)} ${y0}L${xAt(b1, y0).toFixed(1)} ${y0}L${xAt(b1, y1).toFixed(1)} ${y1}L${xAt(b0, y1).toFixed(1)} ${y1}Z`;
      tiles.push({ d, dark: (r + c) % 2 === 0 });
    }
  }
  return tiles;
})();

function Sparkle({ x, y, s = 1, fill = "#fff" }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -10 C1.5 -2 2 -1.5 10 0 C2 1.5 1.5 2 0 10 C-1.5 2 -2 1.5 -10 0 C-2 -1.5 -1.5 -2 0 -10Z"
      fill={fill}
    />
  );
}

function ChessCover() {
  return (
    <>
      <defs>
        <linearGradient id="ch-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8f6bff" />
          <stop offset="1" stopColor="#3a1aa0" />
        </linearGradient>
        <radialGradient id="ch-glow" cx="0.68" cy="0.42" r="0.5">
          <stop offset="0" stopColor="#d4ff3a" stopOpacity="0.45" />
          <stop offset="1" stopColor="#d4ff3a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="260" fill="url(#ch-bg)" />
      <rect width="400" height="260" fill="url(#ch-glow)" />
      {FLOOR_TILES.map((t, i) => (
        <path key={i} d={t.d} fill={t.dark ? "#1a0b52" : "#d4ff3a"} opacity={t.dark ? 0.9 : 0.85} />
      ))}
      <rect y="150" width="400" height="26" fill="url(#ch-bg)" opacity="0.55" />
      {/* King */}
      <g stroke="#14082e" strokeWidth="4" strokeLinejoin="round" fill="#f6f3ff">
        <ellipse cx="272" cy="232" rx="58" ry="8" fill="#14082e" opacity="0.35" stroke="none" />
        <rect x="226" y="208" width="92" height="20" rx="8" />
        <path d="M238 208 L306 208 L294 192 L250 192Z" />
        <path d="M252 192 Q256 146 262 126 L282 126 Q288 146 292 192Z" />
        <ellipse cx="272" cy="124" rx="28" ry="8" />
        <circle cx="272" cy="104" r="17" />
        <rect x="267" y="62" width="10" height="30" rx="2" />
        <rect x="257" y="70" width="30" height="10" rx="2" />
      </g>
      <path d="M262 140 Q264 165 263 188" stroke="#c9bfff" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* Pawn */}
      <g stroke="#14082e" strokeWidth="4" strokeLinejoin="round" fill="#14082e">
        <rect x="118" y="214" width="56" height="14" rx="6" />
        <path d="M128 214 Q134 186 140 176 L152 176 Q158 186 164 214Z" />
        <circle cx="146" cy="166" r="14" />
      </g>
      <circle cx="141" cy="161" r="4" fill="#9d7bff" />
      <Sparkle x={72} y={54} s={1.4} fill="#d4ff3a" />
      <Sparkle x={344} y={44} s={0.9} />
      <Sparkle x={196} y={86} s={0.6} />
    </>
  );
}

function XiangqiCover() {
  return (
    <>
      <defs>
        <linearGradient id="xq-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff6a4d" />
          <stop offset="1" stopColor="#a10f2b" />
        </linearGradient>
        <radialGradient id="xq-disc" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fff6e0" />
          <stop offset="1" stopColor="#f0d29a" />
        </radialGradient>
      </defs>
      <rect width="400" height="260" fill="url(#xq-bg)" />
      {/* Grid + river */}
      <g stroke="#ffd84d" strokeOpacity="0.28" strokeWidth="2">
        {[40, 90, 140, 190, 240, 290, 340].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="260" />
        ))}
        {[30, 80, 180, 230].map((y) => (
          <line key={y} x1="0" y1={y} x2="400" y2={y} />
        ))}
      </g>
      <g fill="none" stroke="#ffe9b0" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round">
        <path d="M0 118 Q25 106 50 118 T100 118 T150 118 T200 118 T250 118 T300 118 T350 118 T400 118" />
        <path d="M0 140 Q25 128 50 140 T100 140 T150 140 T200 140 T250 140 T300 140 T350 140 T400 140" />
      </g>
      {/* Black general (back) */}
      <g transform="translate(140 132)">
        <circle r="62" fill="#1a1013" />
        <circle r="62" fill="none" stroke="#000" strokeWidth="5" />
        <circle r="50" fill="none" stroke="#ffd84d" strokeOpacity="0.7" strokeWidth="3" />
        <text y="20" textAnchor="middle" fontSize="58" fontWeight="900" fill="#ffd84d" fontFamily="'Noto Serif SC','Songti SC',serif">
          將
        </text>
      </g>
      {/* Red general (front) */}
      <g transform="translate(262 146)">
        <ellipse cy="72" rx="70" ry="10" fill="#4a0010" opacity="0.4" />
        <circle r="74" fill="url(#xq-disc)" stroke="#5a0614" strokeWidth="6" />
        <circle r="60" fill="none" stroke="#d61f3c" strokeWidth="4" />
        <text y="26" textAnchor="middle" fontSize="72" fontWeight="900" fill="#d61f3c" fontFamily="'Noto Serif SC','Songti SC',serif">
          帥
        </text>
      </g>
      <Sparkle x={58} y={44} s={1.2} fill="#ffd84d" />
      <Sparkle x={360} y={36} s={0.8} fill="#fff" />
    </>
  );
}

function WerewolfCover() {
  return (
    <>
      <defs>
        <linearGradient id="ww-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1670" />
          <stop offset="1" stopColor="#090420" />
        </linearGradient>
        <radialGradient id="ww-moon" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.7" stopColor="#ffd84d" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffd84d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="260" fill="url(#ww-bg)" />
      {[
        [40, 40], [90, 90], [180, 30], [330, 60], [360, 120], [250, 22], [300, 100], [140, 120],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.2 : 1.4} fill="#fff" opacity="0.8" />
      ))}
      <circle cx="150" cy="96" r="96" fill="url(#ww-moon)" />
      <circle cx="150" cy="96" r="60" fill="#ffe680" />
      <circle cx="130" cy="80" r="11" fill="#f2c94c" />
      <circle cx="170" cy="112" r="8" fill="#f2c94c" />
      <circle cx="160" cy="72" r="5" fill="#f2c94c" />
      {/* Trees */}
      <g fill="#05020f">
        <path d="M0 260 L0 200 L18 160 L36 200 L28 200 L46 230 L30 230 L40 260Z" />
        <path d="M44 260 L60 196 L80 230 L70 230 L88 260Z" />
        <path d="M340 260 L360 180 L384 236 L372 236 L392 260Z" />
        <path d="M376 260 L392 210 L400 226 L400 260Z" />
        <rect y="244" width="400" height="16" />
      </g>
      {/* Wolf howling on a rock */}
      <path d="M200 260 Q206 226 236 222 L320 222 Q344 226 348 260Z" fill="#05020f" />
      <path
        d="M262 226 Q258 196 268 176 Q276 158 270 142 L276 122 L270 104 L262 120 L254 118 Q240 110 228 102 L218 100 L220 108 Q228 116 238 124 Q246 136 244 152 Q236 172 238 200 L234 226Z"
        fill="#05020f"
      />
      <path d="M262 226 Q300 232 312 206 Q300 218 278 214Z" fill="#05020f" />
      <circle cx="246" cy="117" r="2.2" fill="#ffd84d" />
      <g stroke="#ffd84d" strokeWidth="2.5" strokeLinecap="round" opacity="0.8">
        <path d="M208 92 l-14 -10" />
        <path d="M206 102 l-18 -2" />
        <path d="M212 84 l-6 -14" />
      </g>
    </>
  );
}

function ArcadeCover() {
  const bug = [
    "..x....x..",
    "...x..x...",
    "..xxxxxx..",
    ".xx.xx.xx.",
    "xxxxxxxxxx",
    "x.xxxxxx.x",
    "x.x....x.x",
    "...xx.xx..",
  ];
  return (
    <>
      <defs>
        <linearGradient id="ar-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#063a52" />
          <stop offset="1" stopColor="#030b14" />
        </linearGradient>
        <linearGradient id="ar-slash" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#d4ff3a" stopOpacity="0" />
          <stop offset="0.5" stopColor="#d4ff3a" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill="url(#ar-bg)" />
      <g stroke="#3ddcff" strokeOpacity="0.35" strokeWidth="1.5">
        {Array.from({ length: 13 }, (_, i) => (
          <line key={i} x1={200} y1={140} x2={-280 + i * 80} y2={260} />
        ))}
        {[150, 162, 178, 200, 230].map((y) => (
          <line key={y} x1="0" y1={y} x2="400" y2={y} />
        ))}
      </g>
      <rect width="400" height="140" fill="url(#ar-bg)" opacity="0.6" />
      {/* Pixel bug */}
      <g transform="translate(206 44)">
        {bug.map((row, r) =>
          row.split("").map((ch, c) =>
            ch === "x" ? <rect key={`${r}-${c}`} x={c * 13} y={r * 13} width="13" height="13" fill="#ff5caa" /> : null
          )
        )}
        <rect x={39} y={39} width="13" height="13" fill="#fff" />
        <rect x={78} y={39} width="13" height="13" fill="#fff" />
      </g>
      {/* Slash streak */}
      <path d="M60 230 Q190 150 360 40 L368 52 Q200 170 70 240Z" fill="url(#ar-slash)" />
      {/* Bolt */}
      <path d="M110 40 L76 112 L102 112 L86 170 L140 90 L112 90 L130 40Z" fill="#ffd84d" stroke="#030b14" strokeWidth="4" strokeLinejoin="round" />
      <text x="300" y="214" fontFamily="var(--font-mono), monospace" fontSize="34" fontWeight="800" fill="#3ddcff" opacity="0.8">
        404
      </text>
      <Sparkle x={350} y={110} s={0.9} fill="#d4ff3a" />
    </>
  );
}

const DEPT_COLORS = ["#3ddcff", "#ff5caa", "#3dff9a", "#ffd84d"];

function CardShape({ x, y, rot, color, label }: { x: number; y: number; rot: number; color: string; label: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x="-46" y="-66" width="92" height="132" rx="14" fill="#0c0c12" />
      <rect x="-40" y="-60" width="80" height="120" rx="10" fill={color} />
      <ellipse cx="0" cy="0" rx="30" ry="44" fill="#fff" transform="rotate(28)" opacity="0.92" />
      <text y="16" textAnchor="middle" fontSize="44" fontWeight="900" fill="#0c0c12" fontFamily="var(--font-display), sans-serif">
        {label}
      </text>
      <text x="-30" y="-40" fontSize="15" fontWeight="900" fill="#0c0c12" fontFamily="var(--font-display), sans-serif">
        {label}
      </text>
    </g>
  );
}

function DeadlineCover() {
  return (
    <>
      <defs>
        <linearGradient id="dl-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e3ff6b" />
          <stop offset="1" stopColor="#9bd400" />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill="url(#dl-bg)" />
      <g fill="#0c0c12" opacity="0.08">
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={i * 44 - 10} y="0" width="18" height="260" transform={`skewX(-18)`} />
        ))}
      </g>
      <CardShape x={150} y={150} rot={-24} color={DEPT_COLORS[0]} label="7" />
      <CardShape x={200} y={138} rot={-6} color={DEPT_COLORS[1]} label="+2" />
      <CardShape x={252} y={146} rot={14} color={DEPT_COLORS[2]} label="⇄" />
      {/* Clock */}
      <g transform="translate(332 66)">
        <circle r="38" fill="#0c0c12" />
        <circle r="30" fill="#fff" />
        <path d="M0 -20 L0 0 L14 8" stroke="#0c0c12" strokeWidth="5" strokeLinecap="round" fill="none" />
        <rect x="-8" y="-50" width="16" height="10" rx="3" fill="#0c0c12" />
      </g>
      <Sparkle x={62} y={56} s={1.4} fill="#0c0c12" />
    </>
  );
}

function TypingCover() {
  return (
    <>
      <defs>
        <linearGradient id="ty-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1a1060" />
          <stop offset="1" stopColor="#05061f" />
        </linearGradient>
        <radialGradient id="ty-l" cx="0" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#3ad0ff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#3ad0ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ty-r" cx="1" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#ff4f88" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ff4f88" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="260" fill="url(#ty-bg)" />
      <rect width="400" height="260" fill="url(#ty-l)" />
      <rect width="400" height="260" fill="url(#ty-r)" />
      {[[40, 30], [120, 200], [180, 60], [250, 220], [330, 40], [370, 190], [90, 110], [300, 120]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1.1} fill="#dfe6ff" opacity="0.7" />
      ))}
      <path d="M60 130 L120 112 L100 130 L120 148Z" fill="#3ad0ff" stroke="#05061f" strokeWidth="4" strokeLinejoin="round" />
      <path d="M340 130 L280 112 L300 130 L280 148Z" fill="#ff4f88" stroke="#05061f" strokeWidth="4" strokeLinejoin="round" />
      <path d="M130 130 L190 130" stroke="#ffd070" strokeWidth="4" strokeLinecap="round" strokeDasharray="14 8" />
      <path d="M270 130 L215 130" stroke="#ffd070" strokeWidth="4" strokeLinecap="round" strokeDasharray="14 8" />
      <path d="M198 122 L212 130 L198 138Z" fill="#fff" />
      <g fontFamily="monospace" fontWeight="900" fontSize="22" textAnchor="middle">
        <rect x="62" y="186" width="110" height="34" rx="8" fill="#0d1432" stroke="#3ad0ff" strokeWidth="2.5" />
        <text x="117" y="210" fill="#58ffa6">stre<tspan fill="#e6ebff">et</tspan></text>
        <rect x="228" y="186" width="110" height="34" rx="8" fill="#0d1432" stroke="#ff4f88" strokeWidth="2.5" />
        <text x="283" y="210" fill="#58ffa6">pu<tspan fill="#e6ebff">mp</tspan></text>
      </g>
    </>
  );
}

const COVERS: Record<GameId, () => React.ReactElement> = {
  chess: ChessCover,
  xiangqi: XiangqiCover,
  werewolf: WerewolfCover,
  arcade: ArcadeCover,
  uno: DeadlineCover,
  typing: TypingCover,
};

export const GameCover = memo(function GameCover({ game, className }: { game: GameId; className?: string }) {
  const Cover = COVERS[game];
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={cn("block h-full w-full saturate-[0.35] transition-[filter] duration-300 group-hover:saturate-100", className)}>
      <Cover />
    </svg>
  );
});

/* ---------------------------------------------------------------------------
 * App-style icons (squircle tiles) for dock, chat channels, lists.
 * ------------------------------------------------------------------------- */

const ICON_BG: Record<GameId | "lounge", [string, string]> = {
  chess: ["#9d7bff", "#4b23c8"],
  xiangqi: ["#ff6a4d", "#b3122b"],
  werewolf: ["#3a2490", "#120838"],
  arcade: ["#18a7cf", "#06304a"],
  uno: ["#e3ff6b", "#9bd400"],
  typing: ["#ff5caa", "#3a1aa0"],
  lounge: ["#ff5caa", "#b8146a"],
};

function IconGlyph({ game }: { game: GameId | "lounge" }) {
  switch (game) {
    case "chess":
      return (
        <g fill="#fff" stroke="#14082e" strokeWidth="2.5" strokeLinejoin="round">
          <rect x="20" y="44" width="24" height="7" rx="3" />
          <path d="M24 44 Q26 30 28 24 L36 24 Q38 30 40 44Z" />
          <circle cx="32" cy="19" r="6" />
          <rect x="30" y="6" width="4" height="9" rx="1" stroke="none" fill="#d4ff3a" />
          <rect x="27" y="8.5" width="10" height="4" rx="1" stroke="none" fill="#d4ff3a" />
        </g>
      );
    case "xiangqi":
      return (
        <g>
          <circle cx="32" cy="32" r="21" fill="#fff4dc" stroke="#5a0614" strokeWidth="3" />
          <circle cx="32" cy="32" r="16" fill="none" stroke="#d61f3c" strokeWidth="2" />
          <text x="32" y="40" textAnchor="middle" fontSize="22" fontWeight="900" fill="#d61f3c" fontFamily="'Noto Serif SC',serif">
            帥
          </text>
        </g>
      );
    case "werewolf":
      return (
        <g>
          <circle cx="26" cy="24" r="13" fill="#ffe680" />
          <path d="M30 56 Q29 44 35 36 L38 26 L34 18 L30 26 Q24 22 18 22 L20 26 Q28 30 30 36 Q26 46 26 56Z" fill="#05020f" />
        </g>
      );
    case "arcade":
      return (
        <path d="M36 8 L18 34 L30 34 L24 56 L46 26 L34 26 L40 8Z" fill="#ffd84d" stroke="#03111c" strokeWidth="3" strokeLinejoin="round" />
      );
    case "typing":
      return (
        <g>
          <path d="M10 40 L34 32 L10 24 L16 32Z" fill="#3ad0ff" stroke="#0c0c12" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M54 40 L30 32 L54 24 L48 32Z" fill="#ff4f88" stroke="#0c0c12" strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="18" y="44" width="28" height="11" rx="3" fill="#fff" stroke="#0c0c12" strokeWidth="2.5" />
          <path d="M23 50h18" stroke="#0c0c12" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    case "uno":
      return (
        <g>
          <rect x="14" y="14" width="22" height="32" rx="4" fill="#ff5caa" stroke="#0c0c12" strokeWidth="2.5" transform="rotate(-14 25 30)" />
          <rect x="28" y="16" width="22" height="32" rx="4" fill="#3ddcff" stroke="#0c0c12" strokeWidth="2.5" transform="rotate(10 39 32)" />
          <text x="40" y="38" textAnchor="middle" fontSize="13" fontWeight="900" fill="#0c0c12" transform="rotate(10 39 32)">
            +2
          </text>
        </g>
      );
    case "lounge":
      return (
        <g>
          <path d="M16 26 h26 v14 a10 10 0 0 1 -10 10 h-6 a10 10 0 0 1 -10 -10Z" fill="#fff" stroke="#3b0a24" strokeWidth="2.5" />
          <path d="M42 30 h4 a5 5 0 0 1 0 10 h-4" fill="none" stroke="#fff" strokeWidth="3" />
          <path d="M24 12 q3 4 0 8 M32 10 q3 4 0 8" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      );
  }
}

export const GameIcon = memo(function GameIcon({
  game,
  className,
}: {
  game: GameId | "lounge";
  className?: string;
}) {
  const [a, b] = ICON_BG[game];
  const gid = `gi-${game}`;
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("block shrink-0", className ?? "size-10")}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${gid})`} />
      <rect x="1" y="1" width="62" height="62" rx="17" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="2" />
      <IconGlyph game={game} />
    </svg>
  );
});

/* ---------------------------------------------------------------------------
 * Catalog: single source of truth for names, routes, colours.
 * ------------------------------------------------------------------------- */

export interface GameMeta {
  id: GameId;
  name: string;
  short: string;
  tagline: string;
  href: string;
  players: string;
  duration: string;
  mode: string;
  accent: string;
  tags: string[];
}

export const GAMES: GameMeta[] = [
  {
    id: "chess",
    name: "Cờ Vua",
    short: "Cờ Vua",
    tagline: "Luật FIDE, AI 4 cấp, đồng hồ có cộng giờ",
    href: "/games/chess",
    players: "1-2",
    duration: "3-15'",
    mode: "Ranked ELO",
    accent: "#9d7bff",
    tags: ["FIDE", "AI Engine", "PGN"],
  },
  {
    id: "xiangqi",
    name: "Cờ Tướng",
    short: "Cờ Tướng",
    tagline: "Chuẩn WXF, ký hiệu Việt, chống chiếu dai",
    href: "/games/xiangqi",
    players: "1-2",
    duration: "5-20'",
    mode: "Ranked ELO",
    accent: "#ff6a4d",
    tags: ["WXF", "AI Engine", "Ký hiệu VN"],
  },
  {
    id: "werewolf",
    name: "Ma Sói",
    short: "Ma Sói",
    tagline: "8-12 người, 6 vai, bot biết nói dối",
    href: "/games/werewolf",
    players: "8-12",
    duration: "10-15'",
    mode: "Party",
    accent: "#ffd84d",
    tags: ["Suy luận", "Vai trò", "Chat"],
  },
  {
    id: "arcade",
    name: "Cyber Slash",
    short: "Cyber Slash",
    tagline: "Chém bug 60 FPS, combo, boss Deadline",
    href: "/games/arcade",
    players: "Solo",
    duration: "2-5'",
    mode: "High score",
    accent: "#3ddcff",
    tags: ["Arcade", "60 FPS", "Combo"],
  },
  {
    id: "uno",
    name: "Deadline Rush",
    short: "Deadline",
    tagline: "Game bài đẩy việc: chồng +2, đánh đôi, hô CHỐT!",
    href: "/games/uno",
    players: "2-4",
    duration: "5-10'",
    mode: "Party",
    accent: "#d4ff3a",
    tags: ["Game bài", "Đẩy việc", "2-4P"],
  },
  {
    id: "typing",
    name: "Typing Battle",
    short: "Typing",
    tagline: "Gõ từ bắn tên lửa, tranh vật phẩm, đua gõ đoạn văn",
    href: "/games/typing",
    players: "1-2",
    duration: "2-5'",
    mode: "Ranked ELO",
    accent: "#ff4f88",
    tags: ["Gõ phím", "Phi thuyền", "3 chế độ"],
  },
];

export const GAME_BY_ID: Record<GameId, GameMeta> = Object.fromEntries(GAMES.map((g) => [g.id, g])) as Record<
  GameId,
  GameMeta
>;
