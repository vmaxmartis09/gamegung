"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";

/** Thời gian chờ giữa các trận. */
export const COOLDOWN = {
  /** Sau khi một trận kết thúc. */
  afterMatch: 30_000,
  /** Bỏ ngang trận có cược. */
  abandon: 60_000,
};

const KEY = "oa-match-cooldown";

interface CooldownState {
  until: number;
  reason: string;
  start: (ms: number, reason: string) => void;
  clear: () => void;
}

function load(): { until: number; reason: string } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as { until?: number; reason?: string };
      if (typeof v.until === "number" && v.until > Date.now()) return { until: v.until, reason: v.reason ?? "" };
    }
  } catch {
    /* storage unavailable */
  }
  return { until: 0, reason: "" };
}

function save(until: number, reason: string) {
  try {
    if (until > Date.now()) localStorage.setItem(KEY, JSON.stringify({ until, reason }));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Cooldown toàn cục, giữ qua lần tải lại trang để không né được bằng F5. */
export const useCooldownStore = create<CooldownState>()((set) => ({
  until: 0,
  reason: "",
  start: (ms, reason) => {
    // chỉ kéo dài, không rút ngắn cooldown đang chạy
    set((s) => {
      const until = Math.max(s.until, Date.now() + ms);
      const r = until === s.until ? s.reason : reason;
      save(until, r);
      return { until, reason: r };
    });
  },
  clear: () => {
    save(0, "");
    set({ until: 0, reason: "" });
  },
}));

/** Giây còn lại của cooldown (0 = không có). Chỉ tick khi đang đếm. */
export function useCooldown() {
  const until = useCooldownStore((s) => s.until);
  const reason = useCooldownStore((s) => s.reason);
  const [now, setNow] = useState(() => Date.now());

  // khôi phục sau khi tải lại trang
  useEffect(() => {
    const saved = load();
    if (saved.until > useCooldownStore.getState().until) useCooldownStore.setState(saved);
  }, []);

  useEffect(() => {
    if (until <= Date.now()) return;
    setNow(Date.now());
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= until) clearInterval(t);
    }, 250);
    return () => clearInterval(t);
  }, [until]);

  const remainingMs = Math.max(0, until - now);
  return { active: remainingMs > 0, seconds: Math.ceil(remainingMs / 1000), reason };
}
