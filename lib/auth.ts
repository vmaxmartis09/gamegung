"use client";

import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { useAppStore, AVATAR_PREFIX } from "./store";
import { fetchProfileFromSupabase, syncProfileToSupabase } from "./supabase-game";
import { realtimeBridge } from "./realtime-bridge";

export type AuthStatus = "loading" | "authed" | "guest";

/**
 * Development-only escape hatch so the UI can be previewed without a real
 * Supabase account. Ignored in production builds.
 */
const DEV_SKIP_AUTH = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEV_SKIP_AUTH === "1";

interface AuthState {
  status: AuthStatus;
  email: string | null;
  /** True after the user opened a password-reset link. */
  recovery: boolean;
  endRecovery: () => void;
  init: () => void;
  skipToGuest: () => void;
  signOut: () => Promise<void>;
}

let initialised = false;

/** Instant, local-only: put the right account in the store so the app can render. */
function adoptLocal(user: User) {
  const meta = (user.user_metadata || {}) as Record<string, string | undefined>;
  const app = useAppStore.getState();
  const known = app.currentUser.id === user.id;
  const fromMeta = known
    ? {}
    : {
        ...(meta.username ? { username: meta.username } : {}),
        ...(meta.avatar_url?.startsWith(AVATAR_PREFIX) ? { avatar: meta.avatar_url } : {}),
        ...(meta.title ? { title: meta.title } : {}),
      };
  app.adoptAccount(user.id, fromMeta);
}

/** Network: merge the saved profile in the background; the UI never waits for it. */
async function syncRemote(user: User) {
  try {
    const remote = await fetchProfileFromSupabase(user.id);
    // Ignore a late answer if the user switched account meanwhile.
    if (useAppStore.getState().currentUser.id !== user.id) return;
    if (remote) useAppStore.getState().adoptAccount(user.id, remote);
    // First login on this account: create the row so the leaderboard sees it.
    else syncProfileToSupabase(useAppStore.getState().currentUser).catch(() => {});
  } catch {
    /* offline: keep local profile */
  }
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: "loading",
  email: null,
  recovery: false,
  endRecovery: () => set({ recovery: false }),

  skipToGuest: () => {
    set({ status: "guest", email: null });
  },

  init: () => {
    if (initialised || typeof window === "undefined") return;
    initialised = true;

    if (DEV_SKIP_AUTH) {
      const u = useAppStore.getState().currentUser;
      if (u.id.startsWith("user-")) useAppStore.getState().adoptAccount("dev-" + u.id.slice(5), {});
      set({ status: "authed", email: "dev@localhost" });
      realtimeBridge.init();
      return;
    }

    // Never let session resolution hang indefinitely (timeout fallback to guest after 4s)
    const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null } }), 4000)
    );

    Promise.race([
      supabase.auth.getSession().catch(() => ({ data: { session: null } })),
      timeoutPromise,
    ])
      .then(({ data }) => {
        const user = data.session?.user;
        if (user) {
          adoptLocal(user);
          set({ status: "authed", email: user.email ?? null });
          realtimeBridge.init();
          syncRemote(user);
        } else {
          set({ status: "guest", email: null });
        }
      })
      .catch(() => set({ status: "guest", email: null }));

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const user = session.user;
        // Defer: Supabase recommends not awaiting other calls inside this callback.
        setTimeout(() => {
          if (useAuthStore.getState().status === "authed" && useAppStore.getState().currentUser.id === user.id) return;
          adoptLocal(user);
          set({ status: "authed", email: user.email ?? null });
          realtimeBridge.init();
          syncRemote(user);
        }, 0);
      } else if (event === "SIGNED_OUT") {
        realtimeBridge.stop();
        useAppStore.getState().resetSession();
        set({ status: "guest", email: null });
      } else if (event === "PASSWORD_RECOVERY") {
        set({ recovery: true });
      } else if (event === "USER_UPDATED" && session?.user) {
        set({ email: session.user.email ?? null });
      }
    });
  },

  signOut: async () => {
    if (DEV_SKIP_AUTH) return;
    await supabase.auth.signOut();
  },
}));

/** Map Supabase auth errors to friendly Vietnamese. */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email hoặc mật khẩu không đúng.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Email này đã có tài khoản — chuyển sang Đăng nhập nhé.";
  if (m.includes("email not confirmed")) return "Email chưa xác nhận. Mở hộp thư và bấm link xác nhận trước khi đăng nhập.";
  if (m.includes("password should be at least")) return "Mật khẩu cần tối thiểu 6 ký tự.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return "Bạn thao tác hơi nhanh. Đợi khoảng 1 phút rồi thử lại.";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "Email không hợp lệ.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "Máy chủ đang tạm khoá đăng ký mới. Liên hệ admin.";
  return message;
}
