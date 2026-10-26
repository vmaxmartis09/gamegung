"use client";

import { Fragment, memo, type ReactNode } from "react";
import { MorphIcon, type IconNode } from "morphicons/react";
import {
  Baby,
  Bird,
  BookOpen,
  Bomb,
  Bot,
  Briefcase,
  Building,
  Cat,
  ChessKnight,
  ChessPawn,
  Church,
  Circle,
  CircleCheck,
  Coffee,
  Crosshair,
  Crown,
  Diamond,
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
  Dices,
  Dna,
  Dog,
  Drama,
  Droplet,
  Eye,
  FaceAngry,
  FaceExpressionless,
  FaceGrinning,
  FaceNeutral,
  FaceSlightlyFrowning,
  FaceSlightlySmiling,
  Flag,
  FlaskConical,
  Flame,
  Gamepad2,
  Gem,
  Ghost,
  GraduationCap,
  Hand,
  HandHeart,
  Handshake,
  Heart,
  HeartCrack,
  Hourglass,
  House,
  Inbox,
  Keyboard,
  Layers,
  Lock,
  Medal,
  Megaphone,
  MessageCircle,
  Mic,
  Moon,
  Orbit,
  Paintbrush,
  Paperclip,
  PartyPopper,
  PawPrint,
  Pill,
  Puzzle,
  Rainbow,
  RefreshCw,
  Rocket,
  Scale,
  ScanFace,
  Shield,
  ShieldUser,
  Siren,
  Skull,
  Snail,
  Snowflake,
  Sparkles,
  Sprout,
  Star,
  Sun,
  Sword,
  Swords,
  Target,
  Tent,
  ThumbsUp,
  Tornado,
  TrendingUp,
  Trophy,
  TriangleAlert,
  User,
  UserCheck,
  Users,
  VenetianMask,
  Vote,
  Wand,
  Wheat,
  Wind,
  X,
  Zap,
} from "lucide";
import { cn } from "@/lib/utils";

/**
 * Emoji → Morphicons icon data. Every emoji in the UI is drawn as an animated
 * Morphicons SVG, so two emoji swapped in place morph into each other.
 * Keys are normalised (variation selector U+FE0F stripped).
 */
const MAP: Record<string, IconNode> = {
  "🌾": Wheat,
  "🐺": Dog,
  "🐾": PawPrint,
  "🐻": PawPrint,
  "🐕": Dog,
  "🦊": Cat,
  "🐦‍⬛": Bird,
  "🐌": Snail,
  "🔮": Eye,
  "🛡": Shield,
  "🧪": FlaskConical,
  "💘": Heart,
  "💞": Heart,
  "🤍": Heart,
  "💔": HeartCrack,
  "🏹": Crosshair,
  "🎯": Target,
  "🗳": Vote,
  "✅": CircleCheck,
  "⚔": Swords,
  "🗡": Sword,
  "♟": ChessPawn,
  "🏇": ChessKnight,
  "🏁": Flag,
  "🌙": Moon,
  "🌑": Moon,
  "🌕": Moon,
  "⚖": Scale,
  "🏆": Trophy,
  "🏅": Medal,
  "🥇": Medal,
  "🥈": Medal,
  "🥉": Medal,
  "🎴": Layers,
  "⚡": Zap,
  "💥": Bomb,
  "🩸": Droplet,
  "🚀": Rocket,
  "🛸": Orbit,
  "🔥": Flame,
  "🕯": Flame,
  "🔄": RefreshCw,
  "💬": MessageCircle,
  "👑": Crown,
  "🎲": Dices,
  "⚀": Dice1,
  "⚁": Dice2,
  "⚂": Dice3,
  "⚃": Dice4,
  "⚄": Dice5,
  "⚅": Dice6,
  "☀": Sun,
  "🧹": Paintbrush,
  "🤝": Handshake,
  "⏳": Hourglass,
  "💀": Skull,
  "☠": Skull,
  "⚰": Skull,
  "👥": Users,
  "👭": Users,
  "👬": Users,
  "👏": Sparkles,
  "✨": Sparkles,
  "🎭": Drama,
  "🎉": PartyPopper,
  "⚪": Circle,
  "⚫": Circle,
  "🔴": Circle,
  "☕": Coffee,
  "🫡": UserCheck,
  "🪢": Wind,
  "🧑‍💼": Briefcase,
  "🤖": Bot,
  "👾": Gamepad2,
  "🎮": Gamepad2,
  "😂": FaceGrinning,
  "😭": FaceSlightlyFrowning,
  "😎": FaceSlightlySmiling,
  "😇": FaceSlightlySmiling,
  "🤨": FaceExpressionless,
  "🤡": FaceNeutral,
  "🔒": Lock,
  "📣": Megaphone,
  "📢": Megaphone,
  "💠": Diamond,
  "💎": Gem,
  "👻": Ghost,
  "👴": User,
  "🧑": User,
  "🧒": Baby,
  "🍼": Baby,
  "👧": User,
  "👤": User,
  "🧑‍🌾": Sprout,
  "🧙‍♂️": Wand,
  "🧙‍♂": Wand,
  "🦹": VenetianMask,
  "🪞": ScanFace,
  "🪈": Wind,
  "🧬": Dna,
  "🙏": HandHeart,
  "🕍": Church,
  "📥": Inbox,
  "📖": BookOpen,
  "📎": Paperclip,
  "📈": TrendingUp,
  "💊": Pill,
  "👮": ShieldUser,
  "👍": ThumbsUp,
  "👋": Hand,
  "🏢": Building,
  "🏘": House,
  "🎪": Tent,
  "🎩": GraduationCap,
  "🎎": Puzzle,
  "🌈": Rainbow,
  "🌀": Tornado,
  "⭐": Star,
  "❌": X,
  "❄": Snowflake,
  "⚠": TriangleAlert,
  "⌨": Keyboard,
  "🎤": Mic,
  "🚓": Siren,
  "😡": FaceAngry,
  "🃏": Layers,
};

/** Default tints so the icons keep the colour cues the emoji carried. */
const TINT: Record<string, string> = {
  "🌾": "#fbbf24", "🥇": "#fbbf24", "🥈": "#cbd5e1", "🥉": "#cd7f32", "🏆": "#fbbf24", "🏅": "#fbbf24",
  "🔥": "#fb923c", "⚡": "#facc15", "💘": "#f472b6", "💞": "#f472b6", "🤍": "#f4f4f5", "💔": "#f87171",
  "🩸": "#ef4444", "✅": "#4ade80", "❌": "#f87171", "⚠": "#fbbf24", "☀": "#fbbf24", "🌙": "#a5b4fc",
  "🔴": "#ef4444", "⚫": "#27272a", "⚪": "#f4f4f5", "👑": "#fbbf24", "🚀": "#60a5fa", "🔮": "#c084fc",
  "🧪": "#a78bfa", "🛡": "#93c5fd", "🐺": "#cbd5e1", "🎉": "#f472b6", "💎": "#67e8f9", "❄": "#a5f3fc",
};
const FILLED = new Set(["🔴", "⚫", "⚪"]);

const VS16 = /️/g;
const norm = (e: string) => e.replace(VS16, "");

export const hasEmojiIcon = (e: string) => norm(e) in MAP;

/** Whole emoji sequences, longest match first (ZWJ chains, keycaps, flags). */
const EMOJI_RE =
  /(?:\p{Extended_Pictographic}|[☀-➿⭐⬛⬜])(?:️|‍(?:\p{Extended_Pictographic})️?)*/gu;

interface EmojiProps {
  /** The emoji character to draw, e.g. "🐺". */
  e: string;
  /** px or any CSS length; defaults to 1em so it tracks the surrounding text. */
  size?: number | string;
  className?: string;
  color?: string;
  strokeWidth?: number | string;
  label?: string;
}

/** Renders one emoji as an animated Morphicons icon; changing `e` morphs it. */
export const Emoji = memo(function Emoji({ e, size = "1.1em", className, color, strokeWidth = 2, label }: EmojiProps) {
  const parts = e.match(EMOJI_RE) ?? [e];
  if (parts.length > 1 && !hasEmojiIcon(e)) {
    return (
      <span className={cn("inline-flex items-center gap-[0.12em] align-[-0.15em]", className)}>
        {parts.map((p, i) => (
          <Emoji key={i} e={p} size={size} color={color} strokeWidth={strokeWidth} />
        ))}
      </span>
    );
  }
  const k = norm(e);
  const tint = color ?? TINT[k];
  return (
    <MorphIcon
      icon={MAP[k] ?? Sparkles}
      size={size}
      color={tint}
      fill={FILLED.has(k) ? tint : undefined}
      strokeWidth={strokeWidth}
      spring="bouncy"
      label={label}
      className={cn("inline-block shrink-0 align-[-0.15em]", className)}
    />
  );
});

/** Drop-in for a string that may embed emoji: each one becomes an <Emoji />. */
export function EmojiText({ children, size }: { children: ReactNode; size?: number | string }) {
  if (typeof children === "string") return <>{splitEmoji(children, size)}</>;
  if (Array.isArray(children)) {
    return (
      <>
        {children.map((c, i) => (
          <Fragment key={i}>{typeof c === "string" ? splitEmoji(c, size) : c}</Fragment>
        ))}
      </>
    );
  }
  return <>{children}</>;
}

function splitEmoji(text: string, size?: number | string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(EMOJI_RE)) {
    const i = m.index ?? 0;
    if (!hasEmojiIcon(m[0])) continue; // unknown (e.g. typed by a user): keep the native glyph
    if (i > last) out.push(text.slice(last, i));
    out.push(<Emoji key={`${i}-${m[0]}`} e={m[0]} size={size} />);
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Strip emoji for places that cannot host an SVG (<option>, aria-labels, TTS). */
export const stripEmoji = (s: string) => s.replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
