import React, { memo } from "react";
import { cn } from "@/lib/utils";

export type GameId = "chess" | "xiangqi" | "werewolf" | "arcade" | "uno" | "typing";

/* ---------------------------------------------------------------------------
 * Cover illustrations (400×260). Original artwork, pure SVG, no network.
 * House style: each game owns one deep jewel tone (emerald, wine, indigo,
 * sapphire, teal), lit from above, with ivory forms and champagne-gold detail.
 * Colour is rich but dark and controlled, so it reads as premium, not playful.
 * ------------------------------------------------------------------------- */

const IVORY = "#f6f1e7";
const INK = "#050505";
const GOLD = "#d9b870";
const CRIMSON = "#b3262f";

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

/** Deep two-stop ground with one soft coloured light. */
function Ground({
  id,
  top,
  bottom,
  light,
  cx = 0.5,
  cy = 0.35,
  glow = 0.28,
}: {
  id: string;
  top: string;
  bottom: string;
  light: string;
  cx?: number;
  cy?: number;
  glow?: number;
}) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
        <radialGradient id={`${id}-l`} cx={cx} cy={cy} r="0.7">
          <stop offset="0" stopColor={light} stopOpacity={glow} />
          <stop offset="1" stopColor={light} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="260" fill={`url(#${id}-g)`} />
      <rect width="400" height="260" fill={`url(#${id}-l)`} />
    </>
  );
}

/* Chess — black silhouettes on a pale ground (per supplied reference) */
function Knight({ cx, flip }: { cx: number; flip?: boolean }) {
  return (
    <g transform={`translate(${cx} 0) scale(${flip ? -1 : 1} 1)`} fill="#0b0b0c">
      <path d="M-20 152 L-18 140 Q-16 122 -9 110 Q-20 106 -27 98 Q-31 91 -24 87 L-14 81 L-8 66 L-2 62 L0 55 L6 62 Q23 70 25 93 Q25 122 21 140 L24 152Z" />
      <rect x="-26" y="148" width="52" height="8" rx="2" />
    </g>
  );
}

function Bishop({ cx }: { cx: number }) {
  return (
    <g fill="#0b0b0c">
      <ellipse cx={cx} cy="66" rx="4" ry="3" />
      <path d={`M${cx - 12} 102 Q${cx - 15} 82 ${cx} 72 Q${cx + 15} 82 ${cx + 12} 102Z`} />
      <path d={`M${cx - 10} 102 L${cx + 10} 102 Q${cx + 14} 130 ${cx + 24} 148 L${cx - 24} 148 Q${cx - 14} 130 ${cx - 10} 102Z`} />
      <ellipse cx={cx} cy="153" rx="30" ry="7" />
      <path d={`M${cx + 2} 78 L${cx + 9} 92`} stroke="#eef0f3" strokeWidth="2" />
    </g>
  );
}

function ChessCover() {
  return (
    <>
      <rect width="400" height="260" fill="#eef0f3" />
      <g fill="#0b0b0c">
        <path d="M108 188 L122 172 L168 172 L168 188Z" />
        <path d="M228 172 L276 172 L292 188 L228 188Z" />
        <path d="M268 160 L306 160 L322 172 L284 172Z" />
        <path d="M162 192 L232 192 L240 228 L158 228Z" />
      </g>
      <Knight cx={118} />
      <Knight cx={282} flip />
      <Bishop cx={160} />
      <Bishop cx={240} />
      {/* King */}
      <g fill="#0b0b0c">
        <rect x="198" y="14" width="5" height="24" rx="1" />
        <rect x="191" y="21" width="19" height="5" rx="1" />
        <path d="M184 52 Q185 44 192 46 L200 40 L208 46 Q215 44 216 52 Q214 60 210 64 L190 64 Q186 60 184 52Z" />
        <rect x="186" y="64" width="28" height="6" rx="3" />
        <path d="M190 70 L210 70 Q214 100 222 130 Q226 150 234 160 L166 160 Q174 150 178 130 Q186 100 190 70Z" />
        <rect x="164" y="158" width="72" height="8" rx="3" />
        <ellipse cx="200" cy="170" rx="36" ry="10" />
      </g>
    </>
  );
}

/* Xiangqi — wine and gold */
function XiangqiCover() {
  return (
    <>
      <Ground id="xq" top="#5a1220" bottom="#16040a" light="#ff7a5c" cx={0.55} cy={0.4} glow={0.3} />
      <defs>
        <linearGradient id="xq-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a2028" />
          <stop offset="1" stopColor="#14060a" />
        </linearGradient>
        <linearGradient id="xq-disc" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fbf0d6" />
          <stop offset="1" stopColor="#d6bf92" />
        </linearGradient>
      </defs>
      {/* Board lines + river */}
      <g stroke={GOLD} strokeOpacity="0.14" strokeWidth="1">
        {[40, 90, 140, 190, 240, 290, 340].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="260" />
        ))}
        {[30, 80, 180, 230].map((y) => (
          <line key={y} x1="0" y1={y} x2="400" y2={y} />
        ))}
      </g>
      <g fill="none" stroke={GOLD} strokeOpacity="0.3" strokeWidth="1.5" strokeLinecap="round">
        <path d="M0 118 Q25 108 50 118 T100 118 T150 118 T200 118 T250 118 T300 118 T350 118 T400 118" />
        <path d="M0 138 Q25 128 50 138 T100 138 T150 138 T200 138 T250 138 T300 138 T350 138 T400 138" />
      </g>
      {/* Black general (back) */}
      <g transform="translate(140 132)">
        <circle r="62" fill="url(#xq-dark)" stroke={GOLD} strokeOpacity="0.55" strokeWidth="2" />
        <circle r="50" fill="none" stroke={GOLD} strokeOpacity="0.4" strokeWidth="1.5" />
        <text y="19" textAnchor="middle" fontSize="54" fontWeight="700" fill={GOLD} fontFamily="'Noto Serif SC','Songti SC',serif">
          將
        </text>
      </g>
      {/* Red general (front) */}
      <g transform="translate(262 146)">
        <ellipse cy="76" rx="70" ry="9" fill="#000" opacity="0.5" />
        <circle r="74" fill="url(#xq-disc)" stroke="#1a0508" strokeWidth="4" />
        <circle r="60" fill="none" stroke={CRIMSON} strokeWidth="2.5" />
        <text y="24" textAnchor="middle" fontSize="68" fontWeight="700" fill={CRIMSON} fontFamily="'Noto Serif SC','Songti SC',serif">
          帥
        </text>
      </g>
    </>
  );
}

/* Werewolf — black silhouettes on a pale ground, matching the chess cover */
function WerewolfCover() {
  const pine = (x: number, h: number, w: number) => `M${x} 200 L${x - w} 200 L${x - w * 0.55} ${200 - h * 0.45} L${x - w * 0.8} ${200 - h * 0.45} L${x} ${200 - h} L${x + w * 0.8} ${200 - h * 0.45} L${x + w * 0.55} ${200 - h * 0.45} L${x + w} 200Z`;
  return (
    <>
      <rect width="400" height="260" fill="#eef0f3" />
      <circle cx="150" cy="104" r="78" fill="#d5d9e0" />
      <circle cx="150" cy="104" r="64" fill="#e3e6eb" />
      <g fill="#0b0b0c">
        <path d={pine(40, 110, 30)} />
        <path d={pine(84, 80, 24)} />
        <path d={pine(332, 120, 32)} />
        <path d={pine(374, 86, 24)} />
        {/* Ground */}
        <path d="M0 200 Q100 188 200 204 T400 198 V260 H0Z" />
        {/* Rock */}
        <path d="M196 260 Q204 214 238 208 L322 208 Q348 214 354 260Z" />
        {/* Howling wolf */}
        <path d="M262 212 Q258 182 268 162 Q276 144 270 128 L277 106 L271 86 L262 104 L254 102 Q240 94 226 86 L214 84 L216 93 Q226 102 238 110 Q246 122 244 138 Q236 158 238 186 L234 212Z" />
        <path d="M262 212 Q304 218 318 190 Q304 204 280 200Z" />
      </g>
      <circle cx="246" cy="101" r="2" fill="#eef0f3" />
    </>
  );
}

/* Arcade — violet (not in the lobby, kept so GameId stays exhaustive) */
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
      <Ground id="ar" top="#3a1478" bottom="#0a0418" light="#ff6ad0" cx={0.6} cy={0.3} glow={0.28} />
      <defs>
        <linearGradient id="ar-slash" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.6" stopColor="#ffd9f3" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
      </defs>
      <g stroke="#d9a8ff" strokeOpacity="0.16" strokeWidth="1">
        {Array.from({ length: 13 }, (_, i) => (
          <line key={i} x1={200} y1={140} x2={-280 + i * 80} y2={260} />
        ))}
        {[150, 162, 178, 200, 230].map((y) => (
          <line key={y} x1="0" y1={y} x2="400" y2={y} />
        ))}
      </g>
      <g transform="translate(206 44)">
        {bug.map((row, r) =>
          row.split("").map((ch, c) =>
            ch === "x" ? <rect key={`${r}-${c}`} x={c * 13} y={r * 13} width="13" height="13" fill={IVORY} /> : null
          )
        )}
        <rect x={39} y={39} width="13" height="13" fill={INK} />
        <rect x={78} y={39} width="13" height="13" fill={INK} />
      </g>
      <path d="M60 230 Q190 150 360 40 L368 52 Q200 170 70 240Z" fill="url(#ar-slash)" />
      <path d="M110 40 L76 112 L102 112 L86 170 L140 90 L112 90 L130 40Z" fill={GOLD} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <text x="300" y="214" fontFamily="var(--font-mono), monospace" fontSize="34" fontWeight="600" fill="#fff" opacity="0.25">
        404
      </text>
    </>
  );
}

type CardTone = "sapphire" | "ruby" | "ivory";

function CardShape({ x, y, rot, tone, label }: { x: number; y: number; rot: number; tone: CardTone; label: string }) {
  const light = tone === "ivory";
  const fg = light ? "#0c1330" : IVORY;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x="-46" y="-66" width="92" height="132" rx="12" fill={INK} />
      <rect x="-42" y="-62" width="84" height="124" rx="9" fill={`url(#dl-${tone})`} stroke="#fff" strokeOpacity={light ? 0 : 0.22} strokeWidth="1.2" />
      <rect x="-33" y="-53" width="66" height="106" rx="5" fill="none" stroke={light ? GOLD : fg} strokeOpacity={light ? 0.7 : 0.25} strokeWidth="1" />
      <text y="15" textAnchor="middle" fontSize="42" fontWeight="600" fill={fg} fontFamily="var(--font-display), sans-serif">
        {label}
      </text>
      <text x="-29" y="-35" fontSize="13" fontWeight="600" fill={fg} fillOpacity="0.85" fontFamily="var(--font-display), sans-serif">
        {label}
      </text>
    </g>
  );
}

/* Deadline Rush — sapphire */
function DeadlineCover() {
  return (
    <>
      <Ground id="dl" top="#1b3480" bottom="#070d26" light="#6aa4ff" cx={0.5} cy={0.42} glow={0.3} />
      <defs>
        <linearGradient id="dl-sapphire" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b6ee0" />
          <stop offset="1" stopColor="#1a3a92" />
        </linearGradient>
        <linearGradient id="dl-ruby" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c23a50" />
          <stop offset="1" stopColor="#6e1526" />
        </linearGradient>
        <linearGradient id="dl-ivory" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#d9c9a6" />
        </linearGradient>
      </defs>
      <CardShape x={150} y={152} rot={-24} tone="sapphire" label="7" />
      <CardShape x={252} y={148} rot={14} tone="ruby" label="⇄" />
      <CardShape x={200} y={138} rot={-6} tone="ivory" label="+2" />
      {/* Clock */}
      <g transform="translate(334 62)">
        <circle r="32" fill="#0a1233" stroke={GOLD} strokeOpacity="0.9" strokeWidth="2.5" />
        <g stroke={GOLD} strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round">
          <path d="M0 -25 V-21 M25 0 H21 M0 25 V21 M-25 0 H-21" />
        </g>
        <path d="M0 -17 L0 0 L12 7" stroke={GOLD} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x="-7" y="-42" width="14" height="7" rx="2" fill="none" stroke={GOLD} strokeOpacity="0.9" strokeWidth="2" />
      </g>
    </>
  );
}

/* Typing Battle — teal */
function TypingCover() {
  return (
    <>
      <Ground id="ty" top="#0a4a55" bottom="#020c10" light="#3de8d4" cx={0.5} cy={0.5} glow={0.28} />
      {[[40, 30], [120, 200], [180, 60], [250, 225], [330, 40], [370, 190], [90, 110], [300, 100]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1.1} fill="#c8fff6" opacity="0.6" />
      ))}
      <path d="M60 130 L120 112 L100 130 L120 148Z" fill="#5eead4" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M340 130 L280 112 L300 130 L280 148Z" fill={GOLD} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M130 130 L190 130" stroke={IVORY} strokeOpacity="0.6" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="12 8" />
      <path d="M270 130 L215 130" stroke={IVORY} strokeOpacity="0.6" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="12 8" />
      <path d="M198 122 L212 130 L198 138Z" fill={IVORY} />
      <g fontFamily="var(--font-mono), monospace" fontWeight="600" fontSize="21" textAnchor="middle">
        <rect x="62" y="186" width="110" height="34" rx="8" fill="#031318" stroke="#5eead4" strokeOpacity="0.5" strokeWidth="1.5" />
        <text x="117" y="209" fill={GOLD}>
          stre<tspan fill="#7fb8b0">et</tspan>
        </text>
        <rect x="228" y="186" width="110" height="34" rx="8" fill="#031318" stroke={GOLD} strokeOpacity="0.5" strokeWidth="1.5" />
        <text x="283" y="209" fill={GOLD}>
          pu<tspan fill="#7fb8b0">mp</tspan>
        </text>
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

/**
 * Photographic covers, stored in /public/covers (Pexels licence, free to use).
 * The vector art above is drawn first and stays visible if a photo fails to load.
 * chess.jpg: pexels.com/photo/164433 (George Becker). werewolf.jpg: pexels.com/photo/30845537.
 */
const PHOTOS: Partial<Record<GameId, { src: string; x: number; y: number; w: number; h: number; align: string }>> = {
  chess: { src: "/covers/chess.jpg", x: 0, y: 0, w: 400, h: 260, align: "xMidYMid slice" },
  // Portrait shot (2:3): fit the width and slide it up so the howling head sits in the frame.
  werewolf: { src: "/covers/werewolf.jpg", x: 0, y: -8, w: 400, h: 600, align: "xMidYMid meet" },
};

export const GameCover = memo(function GameCover({ game, className }: { game: GameId; className?: string }) {
  const Cover = COVERS[game];
  const photo = PHOTOS[game];
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={cn("block h-full w-full", className)}>
      <Cover />
      {photo && <image href={photo.src} x={photo.x} y={photo.y} width={photo.w} height={photo.h} preserveAspectRatio={photo.align} />}
    </svg>
  );
});

/* ---------------------------------------------------------------------------
 * App-style icons (squircle tiles) for lists, chat channels, headers.
 * Each tile carries its game's jewel tone.
 * ------------------------------------------------------------------------- */

const ICON_BG: Record<GameId | "lounge", [string, string]> = {
  chess: ["#1f7a64", "#08261f"],
  xiangqi: ["#a02636", "#2e0710"],
  werewolf: ["#4a42c4", "#130f4c"],
  arcade: ["#7a35c8", "#1a0838"],
  uno: ["#3566d8", "#102766"],
  typing: ["#1fa9a0", "#063036"],
  lounge: ["#b8873a", "#3e290c"],
};

function IconGlyph({ game }: { game: GameId | "lounge" }) {
  switch (game) {
    case "chess":
      return (
        <g fill={IVORY} stroke={INK} strokeWidth="2" strokeLinejoin="round">
          <rect x="20" y="44" width="24" height="7" rx="3" />
          <path d="M24 44 Q26 30 28 24 L36 24 Q38 30 40 44Z" />
          <circle cx="32" cy="19" r="6" />
          <rect x="30" y="6" width="4" height="9" rx="1" stroke="none" fill={GOLD} />
          <rect x="27" y="8.5" width="10" height="4" rx="1" stroke="none" fill={GOLD} />
        </g>
      );
    case "xiangqi":
      return (
        <g>
          <circle cx="32" cy="32" r="21" fill="#fbf0d6" stroke={INK} strokeWidth="2.5" />
          <circle cx="32" cy="32" r="16" fill="none" stroke={CRIMSON} strokeWidth="1.8" />
          <text x="32" y="40" textAnchor="middle" fontSize="22" fontWeight="700" fill={CRIMSON} fontFamily="'Noto Serif SC',serif">
            帥
          </text>
        </g>
      );
    case "werewolf":
      return (
        <g>
          <circle cx="26" cy="24" r="13" fill="#fbe9b0" />
          <path d="M30 56 Q29 44 35 36 L38 26 L34 18 L30 26 Q24 22 18 22 L20 26 Q28 30 30 36 Q26 46 26 56Z" fill="#0b0833" stroke={IVORY} strokeOpacity="0.5" strokeWidth="1" strokeLinejoin="round" />
        </g>
      );
    case "arcade":
      return <path d="M36 8 L18 34 L30 34 L24 56 L46 26 L34 26 L40 8Z" fill={GOLD} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />;
    case "typing":
      return (
        <g>
          <path d="M10 40 L34 32 L10 24 L16 32Z" fill={IVORY} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M54 40 L30 32 L54 24 L48 32Z" fill={GOLD} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <rect x="18" y="44" width="28" height="11" rx="3" fill="none" stroke={IVORY} strokeWidth="2.2" />
          <path d="M23 49.5h18" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" />
        </g>
      );
    case "uno":
      return (
        <g>
          <rect x="14" y="14" width="22" height="32" rx="4" fill="#c23a50" stroke={INK} strokeWidth="2" transform="rotate(-14 25 30)" />
          <rect x="28" y="16" width="22" height="32" rx="4" fill={IVORY} stroke={INK} strokeWidth="2" transform="rotate(10 39 32)" />
          <text x="40" y="38" textAnchor="middle" fontSize="13" fontWeight="700" fill={INK} transform="rotate(10 39 32)">
            +2
          </text>
        </g>
      );
    case "lounge":
      return (
        <g fill="none" stroke={IVORY} strokeWidth="2.5" strokeLinecap="round">
          <path d="M16 26 h26 v14 a10 10 0 0 1 -10 10 h-6 a10 10 0 0 1 -10 -10Z" />
          <path d="M42 30 h4 a5 5 0 0 1 0 10 h-4" />
          <path d="M24 12 q3 4 0 8 M32 10 q3 4 0 8" stroke="#ffe3a3" />
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
  const gid = `gi-${game}`;
  const [a, b] = ICON_BG[game];
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("block shrink-0", className ?? "size-10")}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gid})`} />
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="15.25" fill="none" stroke="#fff" strokeOpacity="0.2" strokeWidth="1.5" />
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
    accent: "#2fc79c",
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
    accent: "#c43a4a",
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
    accent: "#7a6cff",
    tags: ["Suy luận", "Vai trò", "Chat"],
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
    accent: "#4a7be8",
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
    accent: "#2fc9bd",
    tags: ["Gõ phím", "Phi thuyền", "3 chế độ"],
  },
];

export const GAME_BY_ID: Record<GameId, GameMeta> = Object.fromEntries(GAMES.map((g) => [g.id, g])) as Record<
  GameId,
  GameMeta
>;
