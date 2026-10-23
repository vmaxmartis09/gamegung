"use client";

import React from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Skull } from "lucide-react";
import { ROLE_INFO, Role } from "@/lib/games/werewolf-engine";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

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
  variant = "seat",
  onClick,
}: SeatCardProps) {
  const roleInfo = role ? ROLE_INFO[role] : null;
  const accent = speaking ? "#a3e635" : targetable ? "#a3e635" : isMe ? "#a78bfa" : roleInfo ? roleInfo.color : "rgba(255,255,255,0.14)";

  return (
    <motion.button
      type="button"
      disabled={!targetable}
      onClick={onClick}
      whileHover={targetable ? { y: -4, scale: 1.04 } : undefined}
      whileTap={targetable ? { scale: 0.97 } : undefined}
      className={cn(
        "group relative flex flex-col items-center overflow-hidden rounded-[22px] text-center transition-[opacity,filter] duration-300",
        variant === "seat" ? "w-[92px] px-2 pb-2 pt-3 sm:w-[112px]" : "w-full px-3 pb-3 pt-4",
        !alive && "opacity-45 grayscale",
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
      {targetable && <span className="pointer-events-none absolute inset-0 animate-pulse rounded-[22px] ring-2 ring-inset ring-lime-300/60" />}

      {/* badges */}
      {hasVoted && <span className="absolute right-1.5 top-1.5 z-20 grid size-6 place-items-center rounded-full bg-indigo-500 text-[11px] shadow" title="Đã bỏ phiếu kín">🗳️</span>}
      {lover && alive && <span className="absolute left-1.5 top-1.5 z-20 grid size-5 place-items-center rounded-full bg-pink-500 text-[10px] shadow">💘</span>}
      {votes > 0 && <span className="absolute right-1.5 top-1.5 z-20 grid size-6 place-items-center rounded-full bg-white text-xs font-black text-black shadow">{votes}</span>}
      {seerMark !== undefined && alive && <span className="absolute left-1.5 top-1.5 z-20 text-base">{seerMark ? "🐺" : "✅"}</span>}

      {/* avatar */}
      <div className="relative">
        {speaking && <span className="absolute -inset-1.5 animate-ping rounded-full border-2 border-lime-400/80" />}
        <div className="rounded-full p-[2.5px]" style={{ background: speaking ? "conic-gradient(#a3e635,#22d3ee,#a3e635)" : `linear-gradient(135deg, ${accent}, rgba(255,255,255,0.05))` }}>
          <UserAvatar src={avatar} name={name} className={cn("rounded-full bg-[#0b0914]", variant === "seat" ? "size-11 sm:size-[52px]" : "size-14")} />
        </div>
        {alive ? <MicBadge micOn={micOn} speaking={speaking} /> : <Skull className="absolute -bottom-1 -right-1 size-[22px] rounded-full bg-black p-1 text-red-500" />}
      </div>

      <p className="mt-2 w-full truncate text-[11px] font-extrabold text-white sm:text-[13px]">
        {name}
        {isMe && <span className="text-violet-300"> · bạn</span>}
      </p>

      <div className="mt-1 flex min-h-[20px] flex-wrap items-center justify-center gap-1">
        {roleInfo ? (
          <span className="rounded-full px-2 py-0.5 text-[9px] font-black text-black sm:text-[10px]" style={{ background: roleInfo.color }}>
            {roleInfo.emoji} {roleInfo.name}
          </span>
        ) : packmate ? (
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-bold text-red-300">🐺 Bầy Sói</span>
        ) : null}
        {tags}
      </div>
    </motion.button>
  );
}
