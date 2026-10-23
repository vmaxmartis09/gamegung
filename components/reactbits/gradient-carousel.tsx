"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skull, AlertTriangle, Flame, ShieldAlert, Award } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { playRouletteTick, playWerewolfClawSlash, playHeartbeat } from "@/lib/audio";

export interface VoteCandidate {
  id: string;
  name: string;
  avatar: string;
  role?: string;
  votes: number;
  votedBy?: string[];
  isDead?: boolean;
}

interface GradientCarouselProps {
  candidates: VoteCandidate[];
  eliminatedId: string | null;
  isTie?: boolean;
  onComplete: () => void;
}

export function GradientCarousel({
  candidates,
  eliminatedId,
  isTie = false,
  onComplete,
}: GradientCarouselProps) {
  // Sort candidates so the eliminated person is dramatically highlighted
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(true);
  const [showVerdict, setShowVerdict] = useState(false);
  const [progress, setProgress] = useState(0);

  const total = candidates.length;
  const targetIndex = eliminatedId
    ? Math.max(0, candidates.findIndex((c) => c.id === eliminatedId))
    : 0;

  useEffect(() => {
    if (total <= 1) {
      setIsSpinning(false);
      setShowVerdict(true);
      return;
    }

    // Play initial heartbeat
    try {
      playHeartbeat();
    } catch {}

    // Suspense spin sequence: spins around multiple times before slowing down on targetIndex
    let step = 0;
    const totalSteps = 24 + targetIndex;
    let delay = 60;

    const spin = () => {
      step++;
      setCurrentIndex((prev) => (prev + 1) % total);
      setProgress(Math.min(100, (step / totalSteps) * 100));

      try {
        playRouletteTick();
      } catch {}

      if (step < totalSteps) {
        // Slow down smoothly towards the end
        if (step > totalSteps - 10) {
          delay += 40;
        } else if (step > totalSteps - 5) {
          delay += 90;
        }
        setTimeout(spin, delay);
      } else {
        // Landed on target!
        setIsSpinning(false);
        setCurrentIndex(targetIndex);
        try {
          playWerewolfClawSlash();
        } catch {}

        setTimeout(() => {
          setShowVerdict(true);
        }, 600);
      }
    };

    const timer = setTimeout(spin, 400);
    return () => clearTimeout(timer);
  }, [total, targetIndex, eliminatedId]);

  const activeCandidate = candidates[currentIndex] || candidates[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl select-none overflow-hidden">
      {/* Dynamic atmospheric gradient background that shifts with the card */}
      <motion.div
        animate={{
          background: isTie
            ? "radial-gradient(circle at 50% 50%, rgba(234, 179, 8, 0.25) 0%, rgba(0, 0, 0, 0.95) 75%)"
            : showVerdict
            ? "radial-gradient(circle at 50% 50%, rgba(220, 38, 38, 0.35) 0%, rgba(15, 5, 5, 0.98) 70%)"
            : "radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.2) 0%, rgba(5, 5, 15, 0.95) 70%)",
        }}
        transition={{ duration: 0.8 }}
        className="absolute inset-0 pointer-events-none"
      />

      {/* Floating particles / sparks */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="relative w-full max-w-2xl flex flex-col items-center text-center z-10">
        {/* Header title */}
        <div className="mb-4">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-red-600/20 via-amber-600/20 to-red-600/20 border border-red-500/40 text-red-300 text-xs font-black uppercase tracking-widest mb-2 shadow-lg shadow-red-950/40"
          >
            <Flame className="w-4 h-4 text-amber-400 animate-bounce" />
            Kiểm Phiếu Phán Quyết
          </motion.div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide drop-shadow-md">
            {isSpinning
              ? "Đang đối chiếu các lá phiếu bí mật..."
              : isTie
              ? "Bất phân thắng bại — Số phiếu ngang nhau!"
              : "Phán quyết của dân làng đã rõ ràng!"}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {isSpinning
              ? "Hòm phiếu đang xoay tròn để tìm ra người bị nghi ngờ nhiều nhất"
              : isTie
              ? "Không ai bị trục xuất hôm nay do hòa phiếu"
              : "Kẻ bị cả làng đồng lòng chỉ mặt điểm tên..."}
          </p>
        </div>

        {/* 3D Gradient Carousel Stage */}
        <div
          className="relative w-full h-[340px] flex items-center justify-center my-2"
          style={{ perspective: 1200 }}
        >
          {candidates.map((cand, idx) => {
            const offset = (idx - currentIndex + total) % total;
            // Calculate relative offset around center (-1, 0, 1)
            let normalizedOffset = offset;
            if (offset > total / 2) normalizedOffset = offset - total;

            const isCenter = normalizedOffset === 0;
            const isVisible = Math.abs(normalizedOffset) <= 2;

            if (!isVisible) return null;

            return (
              <motion.div
                key={cand.id}
                animate={{
                  x: normalizedOffset * 170,
                  z: -Math.abs(normalizedOffset) * 160,
                  rotateY: -normalizedOffset * 22,
                  scale: isCenter ? 1.08 : 0.82,
                  opacity: isCenter ? 1 : Math.max(0.2, 0.6 - Math.abs(normalizedOffset) * 0.2),
                }}
                transition={{ type: "spring", stiffness: 260, damping: 25 }}
                className={`absolute w-52 h-72 rounded-3xl p-5 flex flex-col items-center justify-between border ${
                  isCenter
                    ? showVerdict && !isTie
                      ? "bg-gradient-to-b from-red-950 via-slate-950 to-black border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.55)] ring-4 ring-red-500/40"
                      : "bg-gradient-to-b from-slate-900 via-slate-950 to-black border-indigo-500/60 shadow-[0_0_35px_rgba(99,102,241,0.3)] ring-2 ring-indigo-400/30"
                    : "bg-slate-950/80 border-slate-800 backdrop-blur-md"
                }`}
                style={{ transformStyle: "preserve-3d" }}
              >
                {/* Vote Count Badge */}
                <div className="w-full flex items-center justify-between">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                      isCenter && showVerdict && !isTie
                        ? "bg-red-500 text-white animate-pulse"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    <Vote className="w-3.5 h-3.5" />
                    {cand.votes} phiếu
                  </span>

                  {isCenter && showVerdict && !isTie && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-red-400 bg-red-950/80 border border-red-800/80 px-2 py-0.5 rounded-full">
                      TỬ HÌNH
                    </span>
                  )}
                </div>

                {/* Candidate Avatar & Name */}
                <div className="flex flex-col items-center my-auto">
                  <div
                    className={`relative w-24 h-24 rounded-3xl flex items-center justify-center text-5xl shadow-2xl transition-all duration-300 ${
                      isCenter && showVerdict && !isTie
                        ? "ring-4 ring-red-500 bg-red-950/60 shadow-red-900/60"
                        : "ring-2 ring-white/10 bg-slate-900 shadow-black"
                    }`}
                  >
                    <UserAvatar src={cand.avatar} name={cand.name} className="size-full rounded-3xl" />

                    {isCenter && showVerdict && !isTie && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg border-2 border-black"
                      >
                        <Skull className="w-5 h-5 animate-pulse" />
                      </motion.div>
                    )}
                  </div>

                  <h3 className="text-lg font-black text-white mt-3 line-clamp-1 max-w-[180px]">
                    {cand.name}
                  </h3>
                  {cand.role && showVerdict && (
                    <span className="text-xs font-bold text-amber-400 mt-0.5">
                      {cand.role}
                    </span>
                  )}
                </div>

                {/* Voter preview badges if any */}
                <div className="w-full text-center">
                  <span className="text-[11px] text-slate-400">
                    {cand.votes === 0
                      ? "Không nhận phiếu nào"
                      : `${cand.votes} người đã bỏ phiếu`}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Verdict Details & Dismiss CTA */}
        <AnimatePresence>
          {showVerdict && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="w-full max-w-md mt-4 flex flex-col items-center gap-3"
            >
              <div
                className={`w-full p-4 rounded-2xl border text-sm font-semibold flex items-center gap-3 text-left ${
                  isTie
                    ? "bg-amber-950/40 border-amber-500/40 text-amber-200"
                    : "bg-red-950/50 border-red-500/50 text-red-200 shadow-xl shadow-red-950/50"
                }`}
              >
                {isTie ? (
                  <AlertTriangle className="w-7 h-7 text-amber-400 shrink-0" />
                ) : (
                  <Skull className="w-7 h-7 text-red-400 shrink-0 animate-bounce" />
                )}
                <div>
                  <div className="font-bold text-base text-white">
                    {isTie
                      ? "Không ai bị treo cổ"
                      : `${activeCandidate?.name} chính thức bị trục xuất!`}
                  </div>
                  <div className="text-xs opacity-80 mt-0.5">
                    {isTie
                      ? "Hai hoặc nhiều người có cùng số phiếu cao nhất. Cả làng quyết định tha bổng cho tất cả."
                      : `Với ${activeCandidate?.votes} phiếu bầu, kẻ tình nghi này đã bị dân làng đưa lên giàn treo cổ.`}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onComplete}
                className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-red-900/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Tiếp tục trận đấu
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Vote(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m9 12 2 2 4-4" />
      <path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z" />
      <path d="M22 19H2" />
    </svg>
  );
}

export interface PickerItem {
  id: string;
  name: string;
  avatar: string;
  disabled?: boolean;
  badge?: string;
  votes?: number;
}

/** Swipeable 3D carousel used to choose a player (night targets, secret vote). */
export function GradientCarouselPicker({
  items,
  title,
  confirmLabel,
  onConfirm,
  onClose,
  onAbstain,
  abstainLabel,
}: {
  items: PickerItem[];
  title: string;
  confirmLabel: string;
  onConfirm: (id: string) => void;
  onClose?: () => void;
  onAbstain?: () => void;
  abstainLabel?: string;
}) {
  const total = items.length;
  const firstOk = Math.max(0, items.findIndex((i) => !i.disabled));
  const [idx, setIdx] = useState(firstOk);
  const move = (d: number) => {
    let n = idx;
    for (let k = 0; k < total; k++) {
      n = (n + d + total) % total;
      if (!items[n].disabled) break;
    }
    setIdx(n);
    try {
      playRouletteTick();
    } catch {}
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") move(-1);
      else if (e.key === "ArrowRight") move(1);
      else if (e.key === "Enter" && !items[idx]?.disabled) onConfirm(items[idx].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const cur = items[idx];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl select-none overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(99,102,241,0.25),rgba(5,5,15,0.95)_70%)]" />
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">
        <div className="mb-1 flex w-full items-center justify-between px-2">
          <span className="font-mono text-xs font-bold text-amber-400">{title}</span>
          {onClose && (
            <button type="button" onClick={onClose} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white">
              Đóng (chọn trên bàn)
            </button>
          )}
        </div>
        <div className="relative my-2 flex h-[340px] w-full items-center justify-center" style={{ perspective: 1200 }}>
          {items.map((it, i) => {
            let o = (i - idx + total) % total;
            if (o > total / 2) o -= total;
            if (Math.abs(o) > 2) return null;
            const center = o === 0;
            return (
              <motion.button
                key={it.id}
                type="button"
                onClick={() => (center ? undefined : setIdx(i))}
                animate={{ x: o * 170, z: -Math.abs(o) * 160, rotateY: -o * 22, scale: center ? 1.08 : 0.82, opacity: it.disabled ? 0.35 : center ? 1 : Math.max(0.25, 0.65 - Math.abs(o) * 0.2) }}
                transition={{ type: "spring", stiffness: 260, damping: 25 }}
                className={`absolute flex h-72 w-52 flex-col items-center justify-between rounded-3xl border p-5 ${
                  center ? "border-indigo-400/70 bg-gradient-to-b from-slate-900 via-slate-950 to-black shadow-[0_0_35px_rgba(99,102,241,0.35)] ring-2 ring-indigo-400/30" : "border-slate-800 bg-slate-950/80"
                }`}
                style={{ transformStyle: "preserve-3d" }}
              >
                <span className="h-5 text-[11px] font-bold text-amber-300">{it.badge}</span>
                <div className="flex flex-col items-center">
                  <UserAvatar src={it.avatar} name={it.name} className="size-24 rounded-3xl" />
                  <h3 className="mt-3 line-clamp-1 max-w-[170px] text-lg font-black text-white">{it.name}</h3>
                </div>
                <span className="text-[11px] text-slate-400">{it.disabled ? "Không thể chọn" : it.votes ? `${it.votes} phiếu` : " "}</span>
              </motion.button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button type="button" onClick={() => move(-1)} className="rounded-xl bg-white/10 px-4 py-2 font-bold text-white hover:bg-white/20" aria-label="Trước">‹</button>
          <button
            type="button"
            disabled={!cur || cur.disabled}
            onClick={() => cur && onConfirm(cur.id)}
            className="rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 px-6 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg disabled:opacity-40"
          >
            {confirmLabel}: {cur?.name}
          </button>
          <button type="button" onClick={() => move(1)} className="rounded-xl bg-white/10 px-4 py-2 font-bold text-white hover:bg-white/20" aria-label="Sau">›</button>
        </div>
        {onAbstain && (
          <button type="button" onClick={onAbstain} className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/20">
            {abstainLabel ?? "Bỏ qua"}
          </button>
        )}
      </div>
    </div>
  );
}
