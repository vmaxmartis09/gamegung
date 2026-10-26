"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import AvatarPicker, { avatarSeed, KokonutFace } from "@/components/ui/kokonut-avatar";
import { supabase } from "@/lib/supabase";
import { AVATAR_PREFIX } from "@/lib/store";
import { translateAuthError } from "@/lib/auth";
import { Aurora } from "@/components/reactbits/aurora";
import { BorderBeam } from "@/components/reactbits/border-beam";
import { BlurText } from "@/components/reactbits/blur-text";
import { GradientText } from "@/components/reactbits/gradient-text";
import { cn } from "@/lib/utils";
import { Emoji } from "@/components/ui/emoji";

const TITLES = [
  "Đại Kiện Tướng Bàn Trà",
  "Thánh Chốt Deadline",
  "Sói Già Phòng Họp",
  "Kỳ Thánh IT",
  "Vua Cờ Nghỉ Trưa",
  "Thần Đoán Mò",
];

type Mode = "signup" | "login" | "check-email" | "forgot";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");

  const [displayName, setDisplayName] = useState("");
  const [variant, setVariant] = useState(0);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const nameOk = displayName.trim().length >= 2;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!nameOk) return setError("Nhập biệt danh (ít nhất 2 ký tự).");
    if (!emailOk) return setError("Email không hợp lệ.");
    if (password.length < 6) return setError("Mật khẩu cần tối thiểu 6 ký tự.");
    setLoading(true);
    try {
      const name = displayName.trim();
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          data: {
            username: name,
            title: TITLES[0],
            avatar_url: AVATAR_PREFIX + avatarSeed(name, variant),
          },
        },
      });
      if (err) throw err;
      // Supabase returns an empty identities list when the email already exists.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("Email này đã có tài khoản — chuyển sang Đăng nhập nhé.");
        return;
      }
      if (!data.session) {
        // No email step: sign straight in. Only fails while the project still requires confirmation.
        const { error: inErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (inErr) setMode("check-email");
      }
      // With a session, onAuthStateChange takes over and the gate opens.
    } catch (err) {
      setError(translateAuthError((err as Error).message || "Lỗi đăng ký"));
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!emailOk) return setError("Email không hợp lệ.");
    if (!password) return setError("Nhập mật khẩu.");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) throw err;
    } catch (err) {
      setError(translateAuthError((err as Error).message || "Lỗi đăng nhập"));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!emailOk) return setError("Nhập email đã đăng ký.");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (err) throw err;
      setInfo("Đã gửi link đặt lại mật khẩu. Kiểm tra hộp thư (cả mục Spam).");
    } catch (err) {
      setError(translateAuthError((err as Error).message));
    } finally {
      setLoading(false);
    }
  };

  const resendConfirm = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resend({ type: "signup", email: email.trim() });
      if (err) throw err;
      setInfo("Đã gửi lại email xác nhận.");
    } catch (err) {
      setError(translateAuthError((err as Error).message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <Aurora />
      {/* Left: brand stage */}
      <section className="relative hidden overflow-hidden border-r border-white/[0.06] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between lg:gap-10 lg:p-12">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-b from-[#dcc08a] to-accent font-display text-lg font-bold text-[#1a1408] shadow-brutal">
            OA
          </div>
          <div>
            <p className="font-display text-lg font-bold leading-none tracking-tight">Office Arena</p>
            <p className="mt-1 text-xs text-ink-300">Esports giờ nghỉ trưa</p>
          </div>
        </div>

        <div className="relative">
          <h1 className="font-display text-[clamp(3rem,5.2vw,5.6rem)] font-extrabold leading-[0.92] tracking-[-0.04em]">
            <BlurText text="Nghỉ trưa" />
            <br />
            <span className="relative inline-block">
              <BlurText text="nhưng là" delay={0.25} className="relative z-10" />
              <span className="absolute inset-x-0 bottom-[-0.06em] z-0 h-[0.05em] rounded bg-accent/70" />
            </span>
            <br />
            <GradientText className="inline-block animate-fade-up [animation-delay:500ms]">esports.</GradientText>
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-ink-200">
            5 game đối kháng cho dân văn phòng — cờ vua, cờ tướng, ma sói, game bài, arcade. Xếp hạng ELO, cược Lúa
            <Emoji e="🌾" />, chat realtime với cả công ty.
          </p>
        </div>
      </section>

      {/* Right: form */}
      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[440px]">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="grid size-10 place-items-center rounded-2xl bg-gradient-to-b from-[#dcc08a] to-accent font-display font-bold text-[#1a1408] shadow-brutal">OA</div>
            <p className="font-display text-lg font-extrabold">Office Arena</p>
          </div>

          <div className="panel relative overflow-hidden p-6 sm:p-8 backdrop-blur-xl">
            <BorderBeam size={220} duration={10} colorFrom="#c9a96e" borderWidth={1.5} />
            {(mode === "signup" || mode === "login") && (
              <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.07] bg-black/40 p-1">
                {(["login", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={cn(
                      "rounded-xl py-2.5 text-sm font-bold transition-colors",
                      mode === m ? "border border-white/10 bg-white/[0.09] text-white" : "text-ink-300 hover:text-white"
                    )}
                  >
                    {m === "signup" ? "Tạo tài khoản" : "Đăng nhập"}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div role="alert" className="mb-4 rounded-2xl border border-pop-red/30 bg-pop-red/10 px-4 py-3 text-sm text-[#ffb3bb]">
                {error}
              </div>
            )}
            {info && (
              <div role="status" className="mb-4 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
                {info}
              </div>
            )}

            <AnimatePresence mode="wait" initial={false}>
              {mode === "signup" && (
                <motion.form
                  key="signup"
                  onSubmit={handleSignUp}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  <h2 className="font-display text-2xl font-bold tracking-tight">Chọn avatar</h2>
                  <p className="mb-4 mt-1 text-sm text-ink-300">Bấm đồng xu để đổi mặt, thích mặt nào thì giữ.</p>
                  <AvatarPicker embedded value={{ displayName: displayName || "Kỳ Thủ", variant }} onChange={(v) => setVariant(v.variant)} />
                  <div className="mb-4 mt-5">
                    <label className="label" htmlFor="oa-name">
                      Biệt danh
                    </label>
                    <input
                      id="oa-name"
                      className="field"
                      value={displayName}
                      maxLength={24}
                      autoComplete="nickname"
                      placeholder="VD: Tuấn Dev, Linh HR…"
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                  <EmailField value={email} onChange={setEmail} />
                  <PasswordField value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw((v) => !v)} autoComplete="new-password" />
                  <button type="submit" className="btn-accent mt-1 w-full py-3" disabled={loading || !nameOk}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    {loading ? "Đang tạo…" : "Vào sảnh thôi"}
                  </button>
                </motion.form>
              )}

              {mode === "login" && (
                <motion.form
                  key="login"
                  onSubmit={handleSignIn}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  <h2 className="font-display text-2xl font-bold tracking-tight">Chào mừng trở lại</h2>
                  <p className="mb-6 mt-1 text-sm text-ink-300">Ván dở hôm qua vẫn đang chờ bạn.</p>
                  <EmailField value={email} onChange={setEmail} />
                  <PasswordField value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw((v) => !v)} autoComplete="current-password" />
                  <div className="-mt-1 mb-5 text-right">
                    <button type="button" onClick={() => switchMode("forgot")} className="text-xs font-semibold text-ink-300 underline-offset-4 hover:text-white hover:underline">
                      Quên mật khẩu?
                    </button>
                  </div>
                  <button type="submit" className="btn-accent w-full py-3" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                    {loading ? "Đang vào…" : "Vào sảnh"}
                  </button>
                </motion.form>
              )}

              {mode === "forgot" && (
                <motion.form key="forgot" onSubmit={handleForgot} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <button type="button" onClick={() => switchMode("login")} className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-ink-300 hover:text-white">
                    <ArrowLeft className="size-3.5" /> Quay lại
                  </button>
                  <h2 className="font-display text-2xl font-bold tracking-tight">Đặt lại mật khẩu</h2>
                  <p className="mb-6 mt-1 text-sm text-ink-300">Nhập email, mình gửi link đặt mật khẩu mới.</p>
                  <EmailField value={email} onChange={setEmail} />
                  <button type="submit" className="btn-accent w-full py-3" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Gửi link
                  </button>
                </motion.form>
              )}

              {mode === "check-email" && (
                <motion.div key="check" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                  <div className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-gradient-to-b from-[#dcc08a] to-accent text-[#1a1408] shadow-brutal">
                    <MailCheck className="size-8" />
                  </div>
                  <h2 className="font-display text-2xl font-bold tracking-tight">Kiểm tra email của bạn</h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-ink-200">
                    Đã gửi link xác nhận tới <span className="font-semibold text-white">{email}</span>. Bấm link trong mail rồi quay lại đây
                    đăng nhập.
                  </p>
                  <div className="mt-6 grid gap-2">
                    <button type="button" className="btn-accent py-3" onClick={() => switchMode("login")}>
                      <Check className="size-4" /> Đã xác nhận — Đăng nhập
                    </button>
                    <button type="button" className="btn-ghost" onClick={resendConfirm} disabled={loading}>
                      Gửi lại email
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-ink-400">
            <ShieldCheck className="size-3.5" /> Bảo mật bởi Supabase Auth · mật khẩu được mã hoá, không ai đọc được
          </p>
        </div>
      </section>
    </div>
  );
}

function EmailField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-4">
      <label className="label" htmlFor="oa-email">
        Email
      </label>
      <div className="relative">
        <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <input
          id="oa-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className="field pl-11"
          placeholder="ban@congty.vn"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
}) {
  return (
    <div className="mb-4">
      <label className="label" htmlFor="oa-pw">
        Mật khẩu
      </label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <input
          id="oa-pw"
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          className="field pl-11 pr-12"
          placeholder="Tối thiểu 6 ký tự"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-ink-300 hover:bg-white/[0.06] hover:text-white"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
