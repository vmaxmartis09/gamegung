"use client";

import React from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Skull } from "lucide-react";
import { ROLE_INFO, Role } from "@/lib/games/werewolf-engine";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { Emoji, EmojiText } from "@/components/ui/emoji";

export interface SeatCardProps {
  name: string;
  avatar: string;
  alive: boolean;
  isMe?: boolean;
  role?: Role | null;
  /** Bầy Sói nhận ra đồng đội nhưng chưa biết vai cụ thể. */
  packmate?: boolean;
  targetable?: boolean;
  /** Người này đang bật mic (người thật) hoặc đang phát biểu. */
  micOn?: boolean;
  speaking?: boolean;
  hasVoted?: boolean;
  lover?: boolean;
  votes?: number;
  seerMark?: boolean;
  tags?: React.ReactNode;
  /** Hành động đang chờ người chơi: hiện thành nút gắn ngay trên thẻ. */
  action?: { label: string; tone: "red" | "violet" | "emerald" | "pink" | "amber" };
  /** Đang có hành động nhưng thẻ này không chọn được. */
  dimmed?: boolean;
  variant?: "seat" | "tile";
  onClick?: () => void;
}

function EqBars({ active }: { active: boolean }) {
  return (
    <span className="flex h-3 items-end gap-[2px]">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-black"
          animate={active ? { height: ["30%", "100%", "45%", "85%", "30%"] } : { height: "35%" }}
          transition={active ? { duration: 0.7, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" } : undefined}
        />
      ))}
    </span>
  );
}

export function MicBadge({ micOn, speaking }: { micOn: boolean; speaking: boolean }) {
  return (
    <span
      className={cn(
        "absolute -bottom-1 -right-1 z-20 grid size-[22px] place-items-center rounded-full border-2 border-[#0b0914] shadow-md transition-colors",
        speaking ? "bg-lime-400" : micOn ? "bg-lime-500/90" : "bg-slate-700"
      )}
      title={speaking ? "Đang nói" : micOn ? "Mic đang bật" : "Mic tắt"}
    >
      {micOn ? (speaking ? <EqBars active /> : <Mic className="size-3 text-black" />) : <MicOff className="size-3 text-slate-300" />}
    </span>
  );
}

const ACTION_TONE = {
  red: "bg-rose-400/15 text-rose-200 border-rose-300/25",
  violet: "bg-violet-400/15 text-violet-200 border-violet-300/25",
  emerald: "bg-emerald-400/15 text-emerald-200 border-emerald-300/25",
  pink: "bg-pink-400/15 text-pink-200 border-pink-300/25",
  amber: "bg-amber-300/15 text-amber-200 border-amber-300/25",
} as const;

export function SeatCard({
  name,
  avatar,
  alive,
  isMe,
  role,
  packmate,
  targetable,
  micOn = false,
  speaking = false,
  hasVoted,
  lover,
  votes = 0,
  seerMark,
  tags,
  action,
  dimmed,
  variant = "seat",
  onClick,
}: SeatCardProps) {
  const roleInfo = role ? ROLE_INFO[role] : null;
  const accent = speaking ? "#a3e635" : targetable ? "rgba(255,255,255,0.45)" : isMe ? "#a78bfa" : roleInfo ? roleInfo.color : "rgba(255,255,255,0.14)";

  return (
    <motion.button
      type="button"
      disabled={!targetable}
      onClick={onClick}
      whileHover={targetable ? { y: -4, scale: 1.04 } : undefined}
      whileTap={targetable ? { scale: 0.97 } : undefined}
      className={cn(
        "group relative flex flex-col items-center overflow-hidden rounded-[22px] text-center transition-[opacity,filter] duration-300",
        variant === "seat" ? "w-[100px] px-2 pt-3 sm:w-[116px]" : "w-full px-3 pt-4",
        !(targetable && action) && (variant === "seat" ? "pb-2" : "pb-3"),
        !alive && "opacity-45 grayscale",
        dimmed && alive && "opacity-55",
        targetable && "cursor-pointer"
      )}
      style={{
        background: "linear-gradient(165deg, rgba(30,26,52,0.92), rgba(10,8,22,0.95))",
        boxShadow: `0 0 0 ${speaking || targetable ? 2 : 1}px ${accent}${speaking || targetable ? "" : ""}, 0 10px 28px -10px ${speaking ? "rgba(163,230,53,0.55)" : "rgba(0,0,0,0.7)"}`,
      }}
    >
      {/* kim loại: ánh sáng nền + dải quét khi rê chuột */}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.09] via-transparent to-black/25" />
      <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[320%]" />
      <span className="pointer-events-none absolute inset-0 rounded-[22px] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]" />
      {speaking && <span className="pointer-events-none absolute inset-0 animate-pulse bg-lime-400/10" />}
      {targetable && <span className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-inset ring-white/40" />}

      {/* badges */}
      {hasVoted && <span className="absolute right-1.5 top-1.5 z-20 grid size-6 place-items-center rounded-full bg-indigo-500 text-[11px] shadow" title="Đã bỏ phiếu kín"><Emoji e="🗳️" /></span>}
      {lover && alive && <span className="absolute left-1.5 top-1.5 z-20 grid size-5 place-items-center rounded-full bg-pink-500 text-[10px] shadow"><Emoji e="💘" /></span>}
      {votes > 0 && <span className="absolute right-1.5 top-1.5 z-20 grid size-6 place-items-center rounded-full bg-white text-xs font-black text-black shadow">{votes}</span>}
      {seerMark !== undefined && alive && <span className="absolute left-1.5 top-1.5 z-20 text-base"><EmojiText>{seerMark ? "🐺" : "✅"}</EmojiText></span>}

      {/* avatar */}
      <div className="relative">
        {speaking && <span className="absolute -inset-1.5 animate-ping rounded-full border-2 border-lime-400/80" />}
        <div className="rounded-full p-[2.5px]" style={{ background: speaking ? "conic-gradient(#a3e635,#22d3ee,#a3e635)" : `linear-gradient(135deg, ${accent}, rgba(255,255,255,0.05))` }}>
          <UserAvatar src={avatar} name={name} className={cn("rounded-full bg-[#0b0914]", variant === "seat" ? "size-11 sm:size-[52px]" : "size-14")} />
        </div>
        {alive ? <MicBadge micOn={micOn} speaking={speaking} /> : <Skull className="absolute -bottom-1 -right-1 size-[22px] rounded-full bg-black p-1 text-red-500" />}
      </div>

      <p className="mt-2 w-full truncate text-xs font-bold text-white sm:text-sm">
        {name}
        {isMe && <span className="text-violet-300"> · bạn</span>}
      </p>

      <div className="mt-1 flex min-h-[20px] flex-wrap items-center justify-center gap-1">
        {roleInfo ? (
          <span className="rounded-full px-2 py-0.5 text-xs font-bold text-black" style={{ background: roleInfo.color }}>
            <Emoji e={roleInfo.emoji} /> {roleInfo.name}
          </span>
        ) : packmate ? (
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300"><Emoji e="🐺" /> Bầy Sói</span>
        ) : null}
        {tags}
      </div>

      {targetable && action && (
        <span className={cn("-mx-2 mt-2 flex w-[calc(100%+1rem)] items-center justify-center border-t py-2 text-xs font-semibold uppercase tracking-[0.14em] backdrop-blur-sm transition-colors group-hover:bg-white/15", variant === "tile" && "-mx-3 w-[calc(100%+1.5rem)]", ACTION_TONE[action.tone])}>
          {action.label}
        </span>
      )}
    </motion.button>
  );
}
