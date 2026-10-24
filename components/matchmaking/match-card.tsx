"use client";

import React from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Trophy } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

/**
 * Thẻ người chơi cho màn ghép trận: bố cục hồ sơ (chân dung + tia sáng, tên, chỉ số, nhãn dưới)
 * kết hợp ngọn lửa shader mờ bốc lên sau nội dung và độ nghiêng 3D theo con trỏ.
 */

type Tone = "me" | "opp" | "empty";

const FLAME: Record<Tone, { a: string; b: string; ring: string }> = {
  me: { a: "bg-violet-500/70", b: "bg-fuchsia-400/60", ring: "border-violet-300/50" },
  opp: { a: "bg-amber-500/70", b: "bg-rose-400/60", ring: "border-amber-300/50" },
  empty: { a: "bg-white/20", b: "bg-white/10", ring: "border-white/20" },
};

export interface MatchCardProps {
  tone: Tone;
  name: string;
  avatar?: string;
  /** Hiển thị trên dòng chỉ số. */
  elo?: number;
  tier?: { icon: string; name: string };
  /** Nhãn dưới thẻ (thay cho nút của thẻ gốc). */
  footer: string;
  /** Thẻ chưa có người: hiện dấu hỏi thay avatar và làm ngọn lửa chậm lại. */
  searching?: boolean;
  className?: string;
}

export function MatchCard({ tone, name, avatar, elo, tier, footer, searching, className }: MatchCardProps) {
  const f = FLAME[tone];
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 160, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 160, damping: 18 });

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div className={cn("[perspective:900px]", className)} onPointerMove={onMove} onPointerLeave={onLeave}>
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className="relative overflow-hidden rounded-[28px] border border-white/10 bg-ink-900 p-2 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)]"
      >
        {/* ngọn lửa shader bốc lên từ đáy thẻ */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 overflow-hidden">
          <motion.span
            className={cn("absolute -bottom-10 left-[-10%] h-28 w-3/4 rounded-full blur-2xl", f.a)}
            animate={{ x: [0, 28, -6, 0], y: [0, -16, -4, 0], scale: [1, 1.2, 0.95, 1] }}
            transition={{ duration: searching ? 7 : 4.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            className={cn("absolute -bottom-12 right-[-10%] h-32 w-3/4 rounded-full blur-2xl", f.b)}
            animate={{ x: [0, -24, 8, 0], y: [0, -22, -6, 0], scale: [1, 0.9, 1.15, 1] }}
            transition={{ duration: searching ? 8 : 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
          />
        </div>

        {/* chân dung với tia sáng */}
        <div className="relative aspect-[5/4] overflow-hidden rounded-[22px] bg-gradient-to-b from-white/[0.07] to-transparent">
          <svg aria-hidden viewBox="0 0 100 80" className="absolute inset-0 h-full w-full text-white/15" preserveAspectRatio="none">
            {[0, 45, 90, 135].map((deg) => (
              <line key={deg} x1="50" y1="40" x2={50 + 70 * Math.cos((deg * Math.PI) / 180)} y2={40 + 70 * Math.sin((deg * Math.PI) / 180)} stroke="currentColor" strokeWidth="0.35" />
            ))}
            {[0, 45, 90, 135].map((deg) => (
              <line key={`m${deg}`} x1="50" y1="40" x2={50 - 70 * Math.cos((deg * Math.PI) / 180)} y2={40 - 70 * Math.sin((deg * Math.PI) / 180)} stroke="currentColor" strokeWidth="0.35" />
            ))}
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid size-[74%] max-h-[130px] max-w-[130px] place-items-center rounded-full border border-white/10 bg-white/[0.05]">
              <div className={cn("relative rounded-full border-2 p-0.5", f.ring)}>
                {searching ? (
                  <span className="grid size-14 place-items-center rounded-full bg-ink-950 font-display text-2xl font-black text-white/60 sm:size-16">
                    ?
                    <motion.span aria-hidden className={cn("absolute inset-0 rounded-full border", f.ring)} animate={{ scale: [1, 1.5], opacity: [0.7, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }} />
                  </span>
                ) : (
                  <UserAvatar src={avatar} name={name} className="size-14 rounded-full bg-ink-950 sm:size-16" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* nội dung */}
        <div className="relative px-2 pb-1 pt-3">
          <p className="truncate font-display text-base font-extrabold text-white">{name}</p>
          <div className="mt-1.5 flex items-center gap-3 text-xs font-semibold text-ink-200">
            {tier && (
              <span className="flex items-center gap-1">
                <span aria-hidden>{tier.icon}</span>
                <span className="truncate">{tier.name}</span>
              </span>
            )}
            {elo !== undefined && (
              <span className="flex items-center gap-1 font-mono">
                <Trophy className="size-3.5" aria-hidden /> {elo}
              </span>
            )}
            {searching && <span className="text-ink-300">Đang tìm…</span>}
          </div>
          <span className="mt-3 block rounded-full border border-white/15 bg-white/90 py-1.5 text-center text-xs font-bold text-black">{footer}</span>
        </div>
      </motion.div>
    </div>
  );
}
