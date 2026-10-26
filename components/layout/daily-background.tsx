"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Calendar, ChevronLeft, ChevronRight, RotateCcw, Info, Check } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth";
import { getDailyThemeForUser, type DailyBackgroundConfig } from "@/lib/daily-background-theme";
import {
  InterferenceRibbons,
  type InterferenceRibbonsHandle,
} from "@/components/reactbits/interference-ribbons";
import { BlackHole } from "@/components/reactbits/black-hole";
import { AsciiRipple } from "@/components/reactbits/ascii-ripple";
import { Aurora } from "@/components/reactbits/aurora";
import { TypographicWall } from "@/components/reactbits/typographic-wall";
import { cn } from "@/lib/utils";
import { getGpuInfo, getMotionPref, setMotionPref, type MotionPref } from "@/lib/motion";

const VARIANTS = ["ribbons", "blackhole", "ascii", "aurora"] as const;
type Variant = (typeof VARIANTS)[number];
// Shader backdrops need a hardware WebGL2 context; without one (Windows with hardware
// acceleration off, a blocklisted driver, RDP/VM) they crawl, so those machines get the cheap ones.
const LIGHT_VARIANTS: readonly Variant[] = ["ascii", "aurora"];

// Picked once per page load (this component is client-only), so each fresh load gets a new backdrop.
const pickVariant = (): Variant => {
  const pool = getGpuInfo().hardware ? VARIANTS : LIGHT_VARIANTS;
  return pool[Math.floor(Math.random() * pool.length)];
};

const MOTION_LABELS: Record<MotionPref, string> = {
  full: "Đầy đủ",
  system: "Theo hệ thống",
  reduced: "Giảm",
};
const MOTION_ORDER: MotionPref[] = ["full", "system", "reduced"];

/**
 * `inGame` swaps the animated backdrop for a still one: a full-screen shader running behind a live
 * match steals GPU time from the game and forces every backdrop-blur layer to re-blur each frame.
 */
export function DailyBackground({ inGame = false }: { inGame?: boolean }) {
  const ribbonRef = useRef<InterferenceRibbonsHandle>(null);
  const [variant] = useState<Variant>(pickVariant);
  const currentUser = useAppStore((s) => s.currentUser);
  const authStatus = useAuthStore((s) => s.status);

  // Day offset for previewing (0 = today, +1 = tomorrow, -1 = yesterday)
  const [dayOffset, setDayOffset] = useState(0);
  const [showThemeCard, setShowThemeCard] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [motionPref, setMotionPrefState] = useState<MotionPref>("full");
  useEffect(() => setMotionPrefState(getMotionPref()), []);
  const cycleMotion = () => {
    const next = MOTION_ORDER[(MOTION_ORDER.indexOf(motionPref) + 1) % MOTION_ORDER.length];
    setMotionPref(next);
    setMotionPrefState(next);
  };

  // Target date based on dayOffset
  const targetDate = useMemo(() => {
    const d = new Date();
    if (dayOffset !== 0) {
      d.setDate(d.getDate() + dayOffset);
    }
    return d;
  }, [dayOffset]);

  // Unique theme calculation per user per date
  const theme: DailyBackgroundConfig = useMemo(() => {
    const effectiveId = currentUser?.id || "guest";
    return getDailyThemeForUser(effectiveId, targetDate);
  }, [currentUser?.id, targetDate]);

  const dateLabel = useMemo(() => {
    if (dayOffset === 0) return "Hôm nay";
    if (dayOffset === 1) return "Ngày mai";
    if (dayOffset === -1) return "Hôm qua";
    return targetDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  }, [dayOffset, targetDate]);

  const handlePulse = () => {
    ribbonRef.current?.pulse(0.5);
  };

  return (
    <>
      {/* Dynamic Interference Ribbons WebGL Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        {inGame && <Aurora still />}
        {!inGame && variant === "blackhole" && (
          <BlackHole className="size-full opacity-80" speed={1} zoom={2.2} orbSize={0.72} bloom={1.1} backgroundColor="#060606" dpr={1.5} />
        )}
        {!inGame && variant === "ascii" && (
          <AsciiRipple className="absolute inset-0" color="rgba(255,255,255,0.10)" activeColor="#e5e5e5" />
        )}
        {!inGame && variant === "aurora" && (
          <>
            <Aurora />
            <TypographicWall />
          </>
        )}
        {!inGame && variant === "ribbons" && <InterferenceRibbons
          ref={ribbonRef}
          colors={theme.colors}
          backgroundColor="#060606"
          mode="auto"
          wires={theme.wires}
          lineWidth={theme.lineWidth}
          ribbonWidth={theme.ribbonWidth}
          amplitude={theme.amplitude}
          waveLength={theme.waveLength}
          angle={theme.angle}
          twist={theme.twist}
          curl={theme.curl}
          depth={theme.depth}
          stripes={theme.stripes}
          colorFlow={theme.colorFlow}
          glow={theme.glow}
          intensity={theme.intensity}
          speed={theme.speed}
          spin={theme.spin}
          interactive={true}
          hoverPulses={true}
          clickPulse={true}
          pulseSpeed={1.2}
          pulseStrength={1.2}
          hoverBoost={1.1}
          quality={0.75}
          className="size-full opacity-90"
        />}

        {/* Cinematic Vignette Overlay to maintain 100% text legibility */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,transparent_30%,#060606_92%)] pointer-events-none" />
      </div>

      {/* Daily Theme Pill & Preview Widget (Bottom-Left Corner) */}
      <aside aria-label="Daily Background Theme Controls" className="fixed bottom-4 left-4 z-20 flex flex-col items-start gap-2 select-none">
        {showThemeCard && (
          <div className="w-80 rounded-2xl border border-white/15 bg-black/85 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="size-3 rounded-full shadow-[0_0_8px_currentColor] shrink-0"
                  style={{
                    backgroundColor: theme.colors[0],
                    color: theme.colors[0],
                  }}
                />
                <span className="text-xs font-semibold uppercase tracking-wider text-white">
                  {theme.themeName}
                </span>
              </div>
              <span className="text-[10px] font-mono text-neutral-400 border border-white/10 px-1.5 py-0.5 rounded-md">
                {theme.themeTag}
              </span>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed mb-3">
              {theme.description}
            </p>

            <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-2.5 mb-3 flex flex-col gap-1.5 text-[11px] text-neutral-300 font-mono">
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Người dùng:</span>
                <span className="text-white font-medium truncate max-w-[150px]">
                  {currentUser.username || "Khách"}
                  {authStatus === "authed" ? " (Đã đăng nhập)" : " (Tạm thời)"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Mã sắc thái:</span>
                <span className="text-neutral-400 truncate max-w-[150px]" title={theme.seed}>
                  {theme.seed}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Màu sắc:</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="size-3 rounded-full border border-white/30"
                    style={{ backgroundColor: theme.colors[0] }}
                  />
                  <span
                    className="size-3 rounded-full border border-white/30"
                    style={{ backgroundColor: theme.colors[1] }}
                  />
                  <span className="text-[10px] text-neutral-400">
                    {theme.colors[0]} · {theme.colors[1]}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mb-3 text-[11px] text-neutral-300">
              <span className="text-neutral-500 font-mono">Hiệu ứng chuyển động:</span>
              <button
                type="button"
                onClick={cycleMotion}
                className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white font-medium transition-colors"
                title="Đầy đủ: luôn chạy mượt trên mọi máy · Theo hệ thống: tôn trọng cài đặt giảm chuyển động của OS"
              >
                {MOTION_LABELS[motionPref]}
              </button>
            </div>

            {/* Date Navigator / Preview */}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/[0.08]">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDayOffset((o) => o - 1)}
                  className="size-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white transition-colors"
                  title="Xem sắc thái ngày trước"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <span className="text-xs font-mono text-neutral-300 px-2 min-w-[70px] text-center">
                  {dateLabel}
                </span>
                <button
                  type="button"
                  onClick={() => setDayOffset((o) => o + 1)}
                  className="size-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white transition-colors"
                  title="Xem sắc thái ngày tiếp theo"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {dayOffset !== 0 && (
                  <button
                    type="button"
                    onClick={() => setDayOffset(0)}
                    className="size-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-neutral-300 hover:text-white transition-colors"
                    title="Trở về hôm nay"
                  >
                    <RotateCcw className="size-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePulse}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="size-3 text-amber-300" /> Phát sóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Minimalist Floating Pill Trigger */}
        <button
          type="button"
          onClick={() => setShowThemeCard((v) => !v)}
          className={cn(
            "group flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-xs text-neutral-300 shadow-lg backdrop-blur-md transition-all hover:border-white/25 hover:bg-black/85 hover:text-white",
            showThemeCard && "border-white/30 bg-black/90 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          )}
          title="Nhấn để xem thông tin sắc thái UI hôm nay của bạn"
        >
          <span
            className="size-2 rounded-full shrink-0 animate-pulse shadow-[0_0_6px_currentColor]"
            style={{
              backgroundColor: theme.colors[0],
              color: theme.colors[0],
            }}
          />
          <span className="font-mono text-[11px] tracking-tight">
            UI Hôm Nay: <strong className="font-semibold text-white">{theme.themeName}</strong>
          </span>
          <Sparkles className="size-3 text-neutral-400 group-hover:text-amber-300 transition-colors" />
        </button>
      </aside>
    </>
  );
}
