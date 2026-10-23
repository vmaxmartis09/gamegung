"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, Loader2, MessageSquare, X } from "lucide-react";
import { useAuthStore, translateAuthError } from "@/lib/auth";
import { useAppStore } from "@/lib/store";
import { usePresenceStore, locationFromPath, AWAY_HIDDEN_MS, AWAY_IDLE_MS } from "@/lib/presence";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
import { BlackHole, type BlackHoleRef } from "@/components/reactbits";
import { cn } from "@/lib/utils";

// Only signed-out visitors need the sign-up screen (avatar picker, forms).
const AuthScreen = dynamic(() => import("./auth-screen").then((m) => m.AuthScreen), { ssr: false, loading: () => <BlackHoleLoading /> });

/**
 * Everything behind this gate requires a signed-in account.
 * While the session is resolving we show a splash (also avoids SSR/CSR
 * hydration mismatches, because nothing user-specific renders on the server).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
    // Warm the chat chunk while the session resolves, so it is not a second round trip after login.
    import("@/components/social/chat-drawer");
  }, [init]);

  if (status === "loading") return <BlackHoleLoading />;
  if (status === "guest") return <AuthScreen />;
  return (
    <>
      <PresenceTracker />
      <UnreadTitle />
      <WelcomeBack />
      <RecoveryDialog />
      {children}
    </>
  );
}

export function BlackHoleLoading({
  message = "Đang mở sảnh…",
  subMessage = "Khởi tạo đấu trường Office Arena",
  homeCountdown,
}: {
  message?: string;
  subMessage?: string;
  /** Chỉ dùng cho trang 404: đếm ngược rồi về trang chủ. Màn loading đăng nhập không được tự chuyển trang. */
  homeCountdown?: { startAfterMs: number; seconds: number };
}) {
  const blackHoleRef = useRef<BlackHoleRef>(null);
  const skipToGuest = useAuthStore((s) => s.skipToGuest);
  const router = useRouter();
  const pathname = usePathname();
  const [showFallback, setShowFallback] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const goHome = () => {
    if (pathname !== "/") router.replace("/");
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowFallback(true), 3500);
    return () => clearTimeout(timer);
  }, []);

  // Treo quá lâu → đếm ngược rồi về trang chủ
  useEffect(() => {
    if (cancelled || !homeCountdown) return;
    const t = setTimeout(() => setLeft(homeCountdown.seconds), homeCountdown.startAfterMs);
    return () => clearTimeout(t);
  }, [cancelled, homeCountdown]);

  useEffect(() => {
    if (left === null || cancelled) return;
    if (left <= 0) {
      goHome();
      return;
    }
    const t = setTimeout(() => setLeft((v) => (v === null ? v : v - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, cancelled]);

  const counting = !!homeCountdown && left !== null && !cancelled;
  const progress = counting && homeCountdown ? 1 - (left ?? 0) / homeCountdown.seconds : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden select-none">
      {/* React Bits Pro: Smoky Black Hole Shader Animation */}
      <div className="absolute inset-0">
        <BlackHole
          ref={blackHoleRef}
          className="h-full w-full"
          speed={1.15}
          zoom={2.2}
          particleCount={14}
          orbSize={0.72}
          glow={0.08}
          contrast={3.2}
          bloom={1.2}
          ringIntensity={1.35}
          mirrorSplits={2}
          warpEnabled={true}
          distanceFade={0.32}
          cursorInteraction={true}
          cursorIntensity={1.2}
          backgroundColor="#000000"
        />
      </div>

      {/* Center Singularity & UI */}
      <div className="relative z-10 flex flex-col items-center gap-5 px-4 text-center pointer-events-auto">
        {/* Core Event Horizon Badge */}
        <button
          type="button"
          onClick={() => blackHoleRef.current?.gulp(1.5)}
          className="group relative flex size-20 items-center justify-center rounded-full bg-black/85 border border-white/20 shadow-[0_0_35px_rgba(255,255,255,0.18)] backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-90 hover:border-white/50 focus:outline-none"
          title="Bấm để kích hoạt lực hấp dẫn"
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
          <span className="font-display text-2xl font-black tracking-widest text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.85)]">
            OA
          </span>
          <div className="absolute -inset-1 rounded-full border border-white/20 animate-ping opacity-25 pointer-events-none" />
        </button>

        {/* Loading Indicator */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <p className="font-mono text-xs font-semibold tracking-wider text-ink-200">
              {message}
            </p>
          </div>
          <p className="font-mono text-xs text-ink-500">
            {subMessage}
          </p>
        </div>

        {counting && (
          <div className="flex items-center gap-4 rounded-2xl border border-white/15 bg-black/60 px-4 py-3 backdrop-blur-md">
            <div className="relative grid size-14 place-items-center">
              <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={97.4} strokeDashoffset={97.4 * (1 - progress)} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
              </svg>
              <span className="font-display text-xl font-black text-white">{left}</span>
            </div>
            <div className="flex flex-col items-start gap-1.5 text-left">
              <p className="text-xs font-semibold text-white">Về trang chủ</p>
              <div className="flex gap-2">
                <button type="button" onClick={goHome} className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-black text-black transition hover:scale-105 active:scale-95">Đi ngay</button>
                <button type="button" onClick={() => setCancelled(true)} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white transition hover:bg-white/20 active:scale-95">Ở lại</button>
              </div>
            </div>
          </div>
        )}

        {/* Fallback escape options if taking longer than 3.5s */}
        <div
          className={cn(
            "flex items-center gap-3 transition-all duration-500",
            showFallback ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
          )}
        >
          <button
            type="button"
            onClick={skipToGuest}
            className="rounded-full bg-white/10 px-3.5 py-1 text-xs font-medium text-ink-100 backdrop-blur-sm border border-white/15 hover:bg-white/20 hover:text-white transition-colors"
          >
            Vào ngay (Khách)
          </button>
          <a
            href=""
            onClick={(e) => {
              e.preventDefault();
              window.location.reload();
            }}
            className="text-xs text-ink-400 underline underline-offset-4 hover:text-white transition-colors"
          >
            Tải lại trang
          </a>
        </div>
      </div>
    </div>
  );
}

/** Online → In-game → Away, driven by route, input activity and tab visibility. */
function PresenceTracker() {
  const pathname = usePathname();
  const lastActive = useRef(Date.now());
  const hiddenAt = useRef<number | null>(null);
  const inGame = useRef(false);

  useEffect(() => {
    const loc = locationFromPath(pathname);
    inGame.current = loc.inGame;
    const p = usePresenceStore.getState();
    p.setMyLocation(loc.label);
    if (p.myStatus !== "away") p.setMyStatus(loc.inGame ? "in-game" : "online");
    useAppStore.getState().updateStatus(loc.inGame ? "in-game" : "online", loc.label);
  }, [pathname]);

  useEffect(() => {
    const evaluate = () => {
      const now = Date.now();
      const hiddenFor = hiddenAt.current ? now - hiddenAt.current : 0;
      const idleFor = now - lastActive.current;
      const away = hiddenFor > AWAY_HIDDEN_MS || idleFor > AWAY_IDLE_MS;
      usePresenceStore.getState().setMyStatus(away ? "away" : inGame.current ? "in-game" : "online");
    };
    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      lastActive.current = now;
      // Coming back from Away should flip instantly; otherwise throttle.
      if (usePresenceStore.getState().myStatus === "away" || now - last > 4000) {
        last = now;
        evaluate();
      }
    };
    const onVisibility = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else {
        hiddenAt.current = null;
        onActivity();
      }
    };
    const opts = { passive: true } as const;
    window.addEventListener("pointermove", onActivity, opts);
    window.addEventListener("pointerdown", onActivity, opts);
    window.addEventListener("keydown", onActivity, opts);
    window.addEventListener("wheel", onActivity, opts);
    window.addEventListener("touchstart", onActivity, opts);
    document.addEventListener("visibilitychange", onVisibility);
    const t = setInterval(evaluate, 5000);
    return () => {
      window.removeEventListener("pointermove", onActivity);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("wheel", onActivity);
      window.removeEventListener("touchstart", onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(t);
    };
  }, []);

  return null;
}

/** "(3) Office Arena" in the tab title while messages are unread. */
function UnreadTitle() {
  const total = useAppStore((s) => Object.values(s.unreadCounts).reduce((a, b) => a + b, 0));
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = total > 0 ? `(${total}) ${base}` : base;
  }, [total]);
  return null;
}

/** When you come back from Away, summarise what you missed. */
function WelcomeBack() {
  const status = usePresenceStore((s) => s.myStatus);
  const missed = usePresenceStore((s) => s.missedWhileAway);
  const awaySince = usePresenceStore((s) => s.awaySince);
  const clearMissed = usePresenceStore((s) => s.clearMissed);
  const toggleChat = useAppStore((s) => s.toggleChat);
  const [show, setShow] = useState(false);
  const [snapshot, setSnapshot] = useState({ missed: 0, minutes: 0 });

  useEffect(() => {
    if (status !== "away" && awaySince && missed > 0) {
      setSnapshot({ missed, minutes: Math.max(1, Math.round((Date.now() - awaySince) / 60000)) });
      setShow(true);
      clearMissed();
      const t = setTimeout(() => setShow(false), 9000);
      return () => clearTimeout(t);
    }
    if (status !== "away" && awaySince && missed === 0) clearMissed();
  }, [status, awaySince, missed, clearMissed]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          className="fixed left-1/2 top-16 z-[60] w-[min(92vw,380px)] -translate-x-1/2"
          role="status"
        >
          <div className="panel flex items-center gap-3 p-3 pr-2">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-black">
              <MessageSquare className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Welcome back! 👋</p>
              <p className="text-xs text-ink-300">
                {snapshot.missed} tin nhắn mới trong {snapshot.minutes} phút bạn Away.
              </p>
            </div>
            <button
              type="button"
              className="btn-lime px-3 py-1.5 text-xs"
              onClick={() => {
                toggleChat(true);
                setShow(false);
              }}
            >
              Xem
            </button>
            <button type="button" aria-label="Đóng" onClick={() => setShow(false)} className="grid size-8 place-items-center rounded-xl text-ink-400 hover:text-white">
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RecoveryDialog() {
  const recovery = useAuthStore((s) => s.recovery);
  const endRecovery = useAuthStore((s) => s.endRecovery);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!recovery) return null;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) return setMsg("Mật khẩu cần tối thiểu 6 ký tự.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) setMsg(translateAuthError(error.message));
    else endRecovery();
  };
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4">
      <form onSubmit={save} className="panel w-full max-w-sm p-6">
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-white text-black">
          <KeyRound className="size-6" />
        </div>
        <h2 className="font-display text-xl font-extrabold">Đặt mật khẩu mới</h2>
        <p className="mb-4 mt-1 text-sm text-ink-300">Nhập mật khẩu mới cho tài khoản của bạn.</p>
        {msg && <p className="mb-3 text-sm text-pop-red">{msg}</p>}
        <input type="password" autoComplete="new-password" className="field mb-4" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Mật khẩu mới" />
        <button type="submit" className="btn-lime w-full" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />} Lưu mật khẩu
        </button>
      </form>
    </div>
  );
}
