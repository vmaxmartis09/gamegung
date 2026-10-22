"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, Loader2, MessageSquare, X } from "lucide-react";
import { useAuthStore, translateAuthError } from "@/lib/auth";
import { useAppStore } from "@/lib/store";
import { usePresenceStore, locationFromPath, AWAY_HIDDEN_MS, AWAY_IDLE_MS } from "@/lib/presence";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
import Loader from "@/components/kokonut/loader";

// Only signed-out visitors need the sign-up screen (avatar picker, forms).
const AuthScreen = dynamic(() => import("./auth-screen").then((m) => m.AuthScreen), { ssr: false, loading: () => <Splash /> });

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

  if (status === "loading") return <Splash />;
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

function Splash() {
  return (
    <div className="relative z-10 grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-4">
        <Loader className="text-white">
          <span className="font-display text-xl font-black">OA</span>
        </Loader>
        <p className="font-mono text-xs text-ink-400">Đang mở sảnh…</p>
        {/* CSS-only fallback: appears after 6s even if the JS bundle never loaded. */}
        <a href="" className="animate-fade-up text-xs font-semibold text-ink-200 underline underline-offset-4 hover:text-white" style={{ animationDelay: "6s" }}>
          Lâu quá? Tải lại trang
        </a>
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
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-lime-400 text-black">
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
