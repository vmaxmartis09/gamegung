"use client";

import { whenNarratorIdle } from "@/lib/narrator-audio";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skull, AlertTriangle, Flame, ChevronLeft, ChevronRight, FastForward, X, Check } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { playRouletteTick, playWerewolfClawSlash, playHeartbeat } from "@/lib/audio";

export interface VoterChip {
  name: string;
  avatar: string;
}

export interface VoteCandidate {
  id: string;
  name: string;
  avatar: string;
  role?: string;
  votes: number;
  votedBy?: VoterChip[];
  isDead?: boolean;
}

/* --------------------------------- helpers --------------------------------- */

/** Màu chủ đạo ổn định theo tên để mỗi card có "gradient" riêng. */
function hueOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

const wrap = (i: number, n: number) => ((i % n) + n) % n;

/** Nền toả màu theo card đang chọn — crossfade giữa các màu. */
function TintBackdrop({ hue, mode }: { hue: number; mode?: "danger" | "tie" }) {
  const h = mode === "danger" ? 355 : mode === "tie" ? 42 : hue;
  const key = `${h}`;
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[#05050c]" />
      <AnimatePresence initial={false}>
        <motion.div
          key={key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 70% 55% at 50% 48%, hsla(${h},45%,45%,0.2), transparent 70%)`,
          }}
        />
      </AnimatePresence>
      <div className="pointer-events-none absolute inset-0 opacity-[0.035]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
    </>
  );
}

/* ------------------------------ Rotating ring ------------------------------ */

const RING_MAX = 560;

/** Vòng thẻ xoay 3D: kéo / vuốt / cuộn để xoay, thẻ trên đỉnh là thẻ đang chọn. */
function CarouselStage({
  count,
  index,
  interactive,
  onStep,
  onTapCard,
  renderCard,
}: {
  count: number;
  index: number;
  interactive: boolean;
  onStep: (d: number) => void;
  onTapCard?: (i: number) => void;
  renderCard: (i: number, center: boolean, angle: number) => React.ReactNode;
}) {
  const [width, setWidth] = useState(900);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const RING_R = Math.min(RING_MAX, Math.max(300, width * 0.78));
  const step = 25; // thẻ xếp hình quạt: luôn thấy rõ 2 thẻ mỗi bên
  const span = step * count;
  const [rot, setRot] = useState(index * step);
  const rotRef = useRef(rot);
  const target = useRef(rot);
  const dragging = useRef(false);
  const drag = useRef({ id: -1, x: 0, startRot: 0, lastX: 0, lastT: 0, v: 0, moved: false });
  const wheelAcc = useRef({ v: 0, t: 0 });
  const indexRef = useRef(index);
  indexRef.current = index;

  // easing loop
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (!dragging.current) {
        const d = target.current - rotRef.current;
        if (Math.abs(d) > 0.04) {
          rotRef.current += d * 0.17;
          setRot(rotRef.current);
        } else if (d !== 0) {
          rotRef.current = target.current;
          setRot(rotRef.current);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // parent đổi index (auto-spin, nút, phím) → xoay vòng tới thẻ đó theo đường ngắn nhất
  useEffect(() => {
    const cur = Math.round(rotRef.current / step);
    const curIdx = wrap(cur, count);
    if (curIdx === index) {
      target.current = cur * step;
      return;
    }
    let d = wrap(index - curIdx, count);
    if (d > count / 2) d -= count;
    target.current = (cur + d) * step;
  }, [index, step, count]);

  const onDown = (e: React.PointerEvent) => {
    if (!interactive || count < 2) return;
    dragging.current = true;
    drag.current = { id: e.pointerId, x: e.clientX, startRot: rotRef.current, lastX: e.clientX, lastT: performance.now(), v: 0, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 6) d.moved = true;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    // rot giảm khi kéo sang phải (thẻ đi theo con trỏ trên cung tròn)
    d.v = d.v * 0.6 + ((-(e.clientX - d.lastX) / RING_R) * (180 / Math.PI) / dt) * 0.4;
    d.lastX = e.clientX;
    d.lastT = now;
    rotRef.current = d.startRot - (dx / RING_R) * (180 / Math.PI);
    setRot(rotRef.current);
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d.id !== e.pointerId) return;
    d.id = -1;
    dragging.current = false;
    const k = Math.round((rotRef.current + d.v * 240) / step);
    target.current = k * step;
    let delta = wrap(k, count) - indexRef.current;
    if (delta > count / 2) delta -= count;
    if (delta < -count / 2) delta += count;
    if (delta !== 0) onStep(delta);
  };
  const onWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const w = wheelAcc.current;
    const now = performance.now();
    if (now - w.t > 250) w.v = 0;
    w.t = now;
    w.v += delta;
    if (Math.abs(w.v) > 50) {
      onStep(w.v > 0 ? 1 : -1);
      w.v = 0;
    }
  };

  return (
    <div
      ref={boxRef}
      className="relative my-1 h-[400px] w-full cursor-grab touch-pan-y overflow-hidden overscroll-contain active:cursor-grabbing"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onWheel={onWheel}
      onClickCapture={(e) => {
        if (drag.current.moved) {
          e.stopPropagation();
          drag.current.moved = false;
        }
      }}
    >
      {Array.from({ length: count }, (_, i) => {
        let a = (((i * step - rot) % span) + span) % span;
        if (a > span / 2) a -= span;
        const abs = Math.abs(a);
        if (abs > 58) return null;
        const rad = (a * Math.PI) / 180;
        const x = RING_R * Math.sin(rad);
        const y = RING_R * (1 - Math.cos(rad)) + 16;
        const center = abs < step / 2;
        const scale = 1 - Math.min(abs / step, 2) * 0.07;
        return (
          <div
            key={i}
            onClick={() => (!center ? onTapCard?.(i) : undefined)}
            className="absolute left-1/2 top-0 will-change-transform"
            style={{
              transform: `translate(calc(-50% + ${x}px), ${y}px) rotate(${a}deg) scale(${scale})`,
              transformOrigin: "50% 50%",
              zIndex: 100 - Math.round(abs),
              opacity: Math.max(0.2, 1 - Math.max(0, abs - 26) / 36),
            }}
          >
            {renderCard(i, center, a)}
          </div>
        );
      })}
    </div>
  );
}

function Scrubber({ count, index, onJump }: { count: number; index: number; onJump: (i: number) => void }) {
  if (count < 2) return null;
  return (
    <div className="flex w-full max-w-md items-center gap-3 px-2">
      <span className="w-10 text-right font-mono text-[11px] font-bold text-white/50">{index + 1}/{count}</span>
      <input
        type="range"
        min={0}
        max={count - 1}
        step={1}
        value={index}
        onChange={(e) => onJump(Number(e.target.value))}
        aria-label="Cuộn danh sách người chơi"
        className="h-1.5 flex-1 cursor-pointer accent-white"
      />
    </div>
  );
}

/* --------------------------------- Card face -------------------------------- */

function CardFace({
  hue,
  center,
  name,
  avatar,
  top,
  topRight,
  sub,
  voters,
  state = "normal",
  disabled,
  sheen = 50,
}: {
  hue: number;
  center: boolean;
  name: string;
  avatar: string;
  top?: React.ReactNode;
  topRight?: React.ReactNode;
  sub?: React.ReactNode;
  voters?: VoterChip[];
  state?: "normal" | "doom";
  disabled?: boolean;
  /** Vị trí dải phản chiếu (0–100%), đổi theo góc xoay của thẻ. */
  sheen?: number;
}) {
  const s = Math.max(-10, Math.min(110, sheen));
  const h = state === "doom" ? 355 : hue;
  return (
    <div
      className="relative flex h-[330px] w-56 select-none flex-col items-center justify-between overflow-hidden rounded-[28px] p-4"
      style={{
        background: state === "doom"
          ? "linear-gradient(160deg, hsl(355,45%,28%), hsl(355,40%,13%) 60%, #0a0608)"
          : `linear-gradient(160deg, hsl(${h},18%,${center ? 27 : 20}%) 0%, hsl(${h},16%,${center ? 14 : 11}%) 60%, #09080e 100%)`,
        boxShadow: center ? `0 0 0 1px rgba(255,255,255,0.35), 0 24px 50px -16px rgba(0,0,0,0.9)` : `0 0 0 1px rgba(255,255,255,0.1), 0 12px 28px -12px rgba(0,0,0,0.8)`,
        filter: disabled ? "grayscale(0.85) brightness(0.7)" : undefined,
      }}
    >
      {/* kim loại phản chiếu */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30" />
      <div className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ background: `linear-gradient(112deg, transparent ${s - 24}%, rgba(255,255,255,${center ? 0.85 : 0.5}) ${s}%, transparent ${s + 24}%)` }} />
      <div className="pointer-events-none absolute inset-0 rounded-[28px] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(0,0,0,0.5)] ring-1 ring-inset ring-white/10" />

      <div className="relative z-10 flex h-6 w-full items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-wider text-white/85">{top}</span>
        {topRight}
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative">
          <div className="absolute -inset-3 rounded-full blur-2xl" style={{ background: `hsla(${h},40%,60%,0.25)` }} />
          <UserAvatar src={avatar} name={name} className="relative size-28 rounded-[32px] ring-2 ring-white/70" />
        </div>
        <h3 className="mt-4 line-clamp-1 max-w-[190px] text-xl font-black text-white drop-shadow">{name}</h3>
      </div>

      <div className="relative z-10 flex min-h-[44px] w-full flex-col items-center justify-end gap-1.5">
        {voters && voters.length > 0 && (
          <div className="flex -space-x-2">
            {voters.slice(0, 6).map((v, i) => (
              <UserAvatar key={`${v.name}-${i}`} src={v.avatar} name={v.name} className="size-6 rounded-full ring-2 ring-black/60" />
            ))}
            {voters.length > 6 && <span className="grid size-6 place-items-center rounded-full bg-black/70 text-[10px] font-black text-white ring-2 ring-black/60">+{voters.length - 6}</span>}
          </div>
        )}
        <span className="text-[11px] font-semibold text-white/75">{sub}</span>
      </div>
    </div>
  );
}

/* ------------------------------ Vote reveal ------------------------------ */

interface GradientCarouselProps {
  candidates: VoteCandidate[];
  eliminatedId: string | null;
  isTie?: boolean;
  onComplete: () => void;
}

export function GradientCarousel({ candidates, eliminatedId, isTie = false, onComplete }: GradientCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(true);
  const [showVerdict, setShowVerdict] = useState(false);
  const skipRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = candidates.length;
  const targetIndex = eliminatedId ? Math.max(0, candidates.findIndex((c) => c.id === eliminatedId)) : 0;
  const eliminated = eliminatedId ? candidates[targetIndex] : null;

  // Quản trò tự dẫn dắt: hiện kết luận một lúc rồi tự chuyển, không cần bấm.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    if (!showVerdict) return;
    let cancelled = false;
    const t = setTimeout(() => whenNarratorIdle(() => !cancelled && onCompleteRef.current()), 4500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [showVerdict]);

  const land = useCallback(() => {
    setIsSpinning(false);
    setCurrentIndex(targetIndex);
    try {
      playWerewolfClawSlash();
    } catch {}
    setTimeout(() => setShowVerdict(true), skipRef.current ? 150 : 600);
  }, [targetIndex]);

  useEffect(() => {
    if (total <= 1) {
      setIsSpinning(false);
      setShowVerdict(true);
      return;
    }
    try {
      playHeartbeat();
    } catch {}
    let step = 0;
    const totalSteps = 24 + targetIndex;
    let delay = 60;
    const spin = () => {
      if (skipRef.current) return;
      step++;
      setCurrentIndex((prev) => (prev + 1) % total);
      try {
        playRouletteTick();
      } catch {}
      if (step < totalSteps) {
        if (step > totalSteps - 10) delay += 40;
        else if (step > totalSteps - 5) delay += 90;
        timerRef.current = setTimeout(spin, delay);
      } else land();
    };
    timerRef.current = setTimeout(spin, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [total, targetIndex, eliminatedId, land]);

  const skip = () => {
    if (!isSpinning) return;
    skipRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    land();
  };

  const step = (d: number) => {
    setCurrentIndex((i) => wrap(i + d, total));
    try {
      playRouletteTick();
    } catch {}
  };

  const active = candidates[currentIndex] ?? candidates[0];
  const verdictMode = showVerdict ? (isTie ? "tie" : "danger") : undefined;

  return (
    <div className="absolute inset-0 z-40 flex select-none justify-center overflow-y-auto overflow-x-hidden rounded-[36px] p-3 backdrop-blur-xl no-scrollbar">
      <TintBackdrop hue={hueOf(active?.name ?? "x")} mode={verdictMode} />

      <div className="relative z-10 my-auto flex w-full max-w-3xl flex-col items-center text-center">
        <div className="mb-1">
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-600/15 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-red-300">
            <Flame className="h-4 w-4 animate-bounce text-amber-400" />
            {isSpinning ? "Kiểm phiếu…" : isTie ? "Hoà phiếu" : "Phán quyết"}
          </motion.div>
        </div>

        <CarouselStage
          count={total}
          index={currentIndex}
          interactive={!isSpinning}
          onStep={step}
          onTapCard={(i) => setCurrentIndex(i)}
          renderCard={(i, center, angle) => {
            const c = candidates[i];
            const doom = showVerdict && !isTie && c.id === eliminatedId;
            return (
              <CardFace
                hue={hueOf(c.name)}
                center={center}
                name={c.name}
                avatar={c.avatar}
                state={doom ? "doom" : "normal"}
                sheen={50 + angle * 2.6}
                top={
                  <span className="flex items-center gap-1.5">
                    <Vote className="h-3.5 w-3.5" /> {c.votes} phiếu
                  </span>
                }
                topRight={doom ? <span className="rounded-full border border-red-300/60 bg-red-950/80 px-2 py-0.5 text-[10px] font-black uppercase text-red-200">Tử hình</span> : undefined}
                voters={showVerdict ? c.votedBy : undefined}
                sub={c.role && showVerdict ? <span className="font-bold text-amber-300">{c.role}</span> : c.votes === 0 ? "Không nhận phiếu nào" : `${c.votes} người đã bỏ phiếu`}
              />
            );
          }}
        />

        <AnimatePresence>
          {showVerdict && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4 flex w-full max-w-md flex-col items-center gap-3">
              <div className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left text-sm font-semibold ${isTie ? "border-amber-500/40 bg-amber-950/40 text-amber-200" : "border-red-500/50 bg-red-950/50 text-red-200 shadow-xl shadow-red-950/50"}`}>
                {isTie ? <AlertTriangle className="h-7 w-7 shrink-0 text-amber-400" /> : <Skull className="h-7 w-7 shrink-0 animate-bounce text-red-400" />}
                <div className="text-base font-bold text-white">{isTie ? "Không ai bị treo" : `${eliminated?.name} bị treo cổ · ${eliminated?.votes} phiếu`}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Vote(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m9 12 2 2 4-4" />
      <path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z" />
      <path d="M22 19H2" />
    </svg>
  );
}

/* --------------------------------- Picker --------------------------------- */

export interface PickerItem {
  id: string;
  name: string;
  avatar: string;
  disabled?: boolean;
  badge?: string;
  votes?: number;
}

/** Carousel 3D kéo / cuộn / vuốt được, dùng để chọn người (mục tiêu ban đêm, bỏ phiếu kín). */
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

  const go = useCallback(
    (to: number) => {
      setIdx(wrap(to, total));
      try {
        playRouletteTick();
      } catch {}
    },
    [total],
  );
  /** Bước d vị trí, bỏ qua các mục bị khoá khi bước đơn. */
  const step = (d: number) => {
    if (Math.abs(d) > 1) return go(idx + d);
    let n = idx;
    for (let k = 0; k < total; k++) {
      n = wrap(n + d, total);
      if (!items[n].disabled) break;
    }
    go(n);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "Enter" && !items[idx]?.disabled) onConfirm(items[idx].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const cur = items[idx];
  return (
    <div className="absolute inset-0 z-40 flex select-none justify-center overflow-y-auto overflow-x-hidden rounded-[36px] p-3 backdrop-blur-xl no-scrollbar">
      <TintBackdrop hue={hueOf(cur?.name ?? "x")} />
      <div className="relative z-10 my-auto flex w-full max-w-3xl flex-col items-center text-center">
        <div className="mb-1 flex w-full items-center justify-between px-2">
          <span className="font-mono text-xs font-bold text-amber-300">{title}</span>
          {onClose && (
            <button type="button" onClick={onClose} title="Đóng" aria-label="Đóng" className="grid size-8 place-items-center rounded-lg bg-white/10 text-slate-200 transition hover:scale-110 hover:bg-white/20 active:scale-95">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <CarouselStage
          count={total}
          index={idx}
          interactive
          onStep={step}
          onTapCard={(i) => go(i)}
          renderCard={(i, center, angle) => {
            const it = items[i];
            return (
              <CardFace
                hue={hueOf(it.name)}
                center={center}
                name={it.name}
                avatar={it.avatar}
                disabled={it.disabled}
                sheen={50 + angle * 2.6}
                top={it.badge}
                sub={it.disabled ? "Không thể chọn" : it.votes ? `${it.votes} phiếu` : undefined}
              />
            );
          }}
        />

        <Scrubber count={total} index={idx} onJump={go} />

        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={() => step(-1)} className="rounded-xl bg-white/10 p-2.5 text-white hover:bg-white/20" aria-label="Trước">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={!cur || cur.disabled}
            onClick={() => cur && onConfirm(cur.id)}
            title={confirmLabel} className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-40"
          >
            <Check className="h-4 w-4" /> {cur?.name}
          </button>
          <button type="button" onClick={() => step(1)} className="rounded-xl bg-white/10 p-2.5 text-white hover:bg-white/20" aria-label="Sau">
            <ChevronRight className="h-5 w-5" />
          </button>
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
