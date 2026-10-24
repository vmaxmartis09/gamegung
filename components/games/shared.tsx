"use client";

import { COOLDOWN, useCooldownStore } from "@/lib/cooldown-store";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BookOpen, MessageCircle, Volume2, VolumeX } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, MatchSettlementResult, type BetChallenge } from "@/lib/store";
import { useUiStore } from "@/lib/ui-store";
import { recordMatchToSupabase, syncProfileToSupabase } from "@/lib/supabase-game";
import { useSessionStore } from "@/lib/session-store";
import type { GameType } from "@/lib/ranking-system";
import { GameIcon, GAME_BY_ID, GameId } from "@/components/art/game-art";
import { UserAvatar } from "@/components/ui/user-avatar";
import TextLoading from "@/components/kokonut/text-loading";
import { cn } from "@/lib/utils";

/* ------------------------------- Game header ------------------------------- */

export function GameHeader({ game, subtitle, children }: { game: GameId; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  const meta = GAME_BY_ID[game];
  const open = useUiStore((s) => s.open);
  const unread = useAppStore((s) => s.unreadCounts[game] || 0);
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const toggleSound = useAppStore((s) => s.toggleSound);
  const chatShown = useAppStore((s) => s.isChatOpen && !s.isChatCollapsed);
  const icon = "icon-btn";
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      <Link href="/" className={icon} aria-label="Về sảnh" title="Về sảnh (ván được lưu)">
        <ArrowLeft className="size-4" />
      </Link>
      <span className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3" title={meta.tagline}>
        <GameIcon game={game} className="size-8" />
        <span className="text-sm font-bold">{meta.name}</span>
        {subtitle && <span className="hidden max-w-[260px] truncate text-xs text-ink-400 md:inline">· {subtitle}</span>}
      </span>
      {children}
      <span className="ml-auto flex items-center gap-1.5">
        <button type="button" onClick={() => open("rules", { game: game as GameType })} className={icon} aria-label="Luật chơi" title="Luật chơi">
          <BookOpen className="size-4" />
        </button>
        {!chatShown && (
          <button
            type="button"
            onClick={() => {
              useAppStore.getState().setActiveChannel(game);
              useAppStore.getState().toggleChat(true);
            }}
            className={icon}
            aria-label="Chat bàn này"
            title="Chat bàn này"
          >
            <MessageCircle className="size-4" />
            {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-pop-red px-1 text-xs font-black text-white">{unread}</span>}
          </button>
        )}
        <button type="button" onClick={toggleSound} className={icon} aria-label={soundEnabled ? "Tắt âm" : "Bật âm"} title={soundEnabled ? "Tắt âm" : "Bật âm"}>
          {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
      </span>
    </div>
  );
}

/* --------------------------- Matchmaking params ---------------------------- */

export interface MatchOpponent {
  name: string;
  elo: number | null;
  avatar: string | null;
  isBot: boolean;
  room: string | null;
}

/** Opponent handed over by the matchmaking modal (`?mode=match&room=…&opp=…`); null for a plain visit. */
export function useMatchOpponent(): MatchOpponent | null {
  const [opp, setOpp] = useState<MatchOpponent | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const name = q.get("opp");
    if (q.get("mode") !== "match" || !name) return;
    const elo = parseInt(q.get("oppElo") || "", 10);
    setOpp({ name, elo: Number.isFinite(elo) ? elo : null, avatar: q.get("oppAvatar"), isBot: q.get("isBot") !== "0", room: q.get("room") });
  }, []);
  return opp;
}

/** Opponent for a table opened from a chat bet card (`?bet=<id>`); null unless I am one of the two accepted players. */
export function betOpponentFromUrl(): { room: string; oppId: string; name: string; avatar: string; stake: number } | null {
  if (typeof window === "undefined") return null;
  const id = new URLSearchParams(window.location.search).get("bet");
  if (!id) return null;
  const st = useAppStore.getState();
  for (const list of Object.values(st.messages)) {
    const b = list.find((m) => m.betChallenge?.id === id)?.betChallenge;
    if (!b || b.status !== "accepted") continue;
    const meId = st.currentUser.id;
    if (b.creatorId === meId) return { room: b.id, oppId: b.opponentId ?? "", name: b.opponentName ?? "Đối thủ", avatar: b.opponentAvatar ?? "", stake: b.stake };
    if (b.opponentId === meId) return { room: b.id, oppId: b.creatorId, name: b.creatorName, avatar: b.creatorAvatar, stake: b.stake };
  }
  return null;
}

/** Like betOpponentFromUrl, but waits for chat history to load (the bet card may arrive a moment after the page). */
export function waitForBetOpponent(timeoutMs = 8000): Promise<ReturnType<typeof betOpponentFromUrl>> {
  return new Promise((resolve) => {
    const now = betOpponentFromUrl();
    if (now || !new URLSearchParams(window.location.search).get("bet")) return resolve(now);
    const timer = setTimeout(() => {
      unsub();
      resolve(null);
    }, timeoutMs);
    const unsub = useAppStore.subscribe(() => {
      const b = betOpponentFromUrl();
      if (!b) return;
      clearTimeout(timer);
      unsub();
      resolve(b);
    });
  });
}

/* ------------------------------ Game sessions ------------------------------ */

/** Save / load the game in progress so leaving the table never loses it. */
export function useGameSession<T>(game: GameId) {
  const userId = useAppStore((s) => s.currentUser.id);
  const save = useCallback(
    (payload: T, info: { label: string; detail?: string; progress?: number }) =>
      useSessionStore.getState().save<T>({ game, userId, savedAt: Date.now(), payload, ...info }),
    [game, userId]
  );
  const clear = useCallback(() => useSessionStore.getState().clear(game), [game]);
  const load = useCallback(() => useSessionStore.getState().get<T>(game, userId), [game, userId]);
  return { save, clear, load };
}

/* ------------------------------- Player card ------------------------------- */

export function formatClock(ms: number) {
  if (ms === Infinity) return "∞";
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  if (total < 10000) return `${s}.${Math.floor((total % 1000) / 100)}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerCard({
  name,
  avatar,
  rating,
  icon,
  active,
  thinking,
  clockMs,
  extra,
  accent = "lime",
  compact = false,
  className,
}: {
  name: string;
  avatar?: string;
  rating?: string | number;
  icon?: React.ReactNode;
  active?: boolean;
  thinking?: boolean;
  clockMs?: number;
  extra?: React.ReactNode;
  accent?: "lime" | "red" | "violet";
  compact?: boolean;
  className?: string;
}) {
  const low = clockMs !== undefined && clockMs !== Infinity && clockMs < 20000;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border px-2.5 py-1 transition-colors min-h-[34px]",
          active ? "border-white/20 bg-white/[0.08]" : "border-white/[0.06] bg-white/[0.02]",
          className
        )}
      >
        {icon ?? <UserAvatar src={avatar} name={name} className="size-6 shrink-0" />}
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <p className="truncate text-xs font-bold text-ink-100">{name}</p>
          {rating !== undefined && <span className="font-mono text-xs text-ink-400">({rating})</span>}
          {thinking ? (
            <TextLoading className="text-xs text-white" texts={["Nghĩ…", "Tính…"]} label="Đang nghĩ" />
          ) : (
            <div className="truncate text-xs text-ink-300">{extra}</div>
          )}
        </div>
        {clockMs !== undefined && (
          <div
            className={cn(
              "rounded-lg px-2 py-0.5 font-mono text-xs font-bold tabular transition-colors shrink-0",
              active
                ? low
                  ? "animate-pulse bg-pop-red text-white"
                  : accent === "red"
                  ? "bg-pop-red text-white"
                  : accent === "violet"
                  ? "bg-pop-violet text-black"
                  : "bg-lime-400 text-black"
                : "bg-black/40 text-ink-200"
            )}
          >
            {formatClock(clockMs)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors",
        active ? "border-white/20 bg-white/[0.06]" : "border-white/[0.06] bg-white/[0.02]",
        className
      )}
    >
      {icon ?? <UserAvatar src={avatar} name={name} className="size-10" />}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-bold">
          {name}
          {rating !== undefined && <span className="font-mono text-xs font-medium text-ink-400">{rating}</span>}
        </p>
        <div className="flex min-h-[18px] items-center gap-1 text-xs text-ink-300">
          {thinking ? (
            <TextLoading className="text-xs text-white" texts={["Đang nghĩ…", "Tính nước…", "Soi thế cờ…"]} label="Đối thủ đang nghĩ" />
          ) : (
            extra
          )}
        </div>
      </div>
      {clockMs !== undefined && (
        <div
          className={cn(
            "rounded-xl px-3 py-1.5 font-mono text-xl font-extrabold tabular transition-colors",
            active
              ? low
                ? "animate-pulse bg-pop-red text-white"
                : accent === "red"
                ? "bg-pop-red text-white"
                : accent === "violet"
                ? "bg-pop-violet text-black"
                : "bg-lime-400 text-black"
              : "bg-black/40 text-ink-200"
          )}
        >
          {formatClock(clockMs)}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- FitBox ---------------------------------- */

/**
 * A container-query-powered box that automatically scales to the maximum size
 * that fits both the width and height of its parent container, maintaining the
 * specified aspect ratio (width / height). Never overflows, never requires scroll.
 */
export function FitBox({
  aspect = 1,
  className,
  style,
  children,
}: {
  aspect: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden [container-type:size]",
        className
      )}
      style={style}
    >
      <div
        className="relative flex items-center justify-center max-h-full max-w-full"
        style={{
          aspectRatio: `${aspect}`,
          width: `min(100cqw, calc(100cqh * ${aspect}))`,
          height: `min(100cqh, calc(100cqw / ${aspect}))`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* --------------------------------- Pickers --------------------------------- */

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className,
  size = "md",
}: {
  value: T;
  options: { value: T; label: React.ReactNode; hint?: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("flex gap-1 rounded-2xl border border-white/[0.07] bg-black/30 p-1", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          disabled={o.disabled}
          title={o.hint}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-xl font-bold transition-colors disabled:opacity-30",
            size === "sm" ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-xs",
            value === o.value ? "seg-active" : "text-ink-300 hover:text-white"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StakePicker({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const lua = useAppStore((s) => s.currentUser.lua);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="label mb-0">Cược Lúa</span>
        <span className="text-xs text-ink-400">Ví: {lua.toLocaleString("vi-VN")} 🌾</span>
      </div>
      <Segmented
        value={value}
        onChange={onChange}
        size="sm"
        options={[0, 50, 100, 200, 500].map((v) => ({ value: v, label: v === 0 ? "Free" : v, disabled: disabled || v > lua }))}
      />
    </div>
  );
}

/* ------------------------------- Friend bet -------------------------------- */

export interface FriendOpp {
  id: string;
  name: string;
  avatar: string;
  betId: string;
}

/** Bet challenge sent through the table chat: the game may only start once the friend has accepted it. */
export function useFriendBet(game: GameType) {
  const meId = useAppStore((s) => s.currentUser.id);
  const bet = useAppStore((s) => {
    // Invites may come from the lounge or any private thread; newest wins.
    let found: BetChallenge | null = null;
    for (const list of Object.values(s.messages)) {
      for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i].betChallenge;
        if (b && b.gameType === game && (b.creatorId === s.currentUser.id || b.opponentId === s.currentUser.id) && (b.status === "pending" || b.status === "accepted")) {
          if (!found || b.createdAt > found.createdAt) found = b;
          break;
        }
      }
    }
    return found;
  });
  const createBet = useAppStore((s) => s.createBetChallenge);
  const cancelBet = useAppStore((s) => s.cancelBetChallenge);

  const friend: FriendOpp | null =
    bet?.status === "accepted"
      ? bet.creatorId === meId
        ? { id: bet.opponentId ?? "", name: bet.opponentName ?? "Bạn bè", avatar: bet.opponentAvatar ?? "", betId: bet.id }
        : { id: bet.creatorId, name: bet.creatorName, avatar: bet.creatorAvatar, betId: bet.id }
      : null;
  const pending = bet?.status === "pending" && bet.creatorId === meId ? bet : null;

  /** Returns an error message, or null when the challenge was posted to the table chat. */
  const invite = useCallback(
    (stake: number): string | null => {
      const lua = useAppStore.getState().currentUser.lua;
      if (stake < 10) return "Chọn mức cược từ 50 Lúa để gửi kèo.";
      if (stake > lua) return "Số dư không đủ để cược.";
      if (!createBet("lounge", game, stake)) return "Không thể gửi kèo. Kiểm tra lại số dư.";
      const st = useAppStore.getState();
      st.setActiveChannel("lounge");
      st.toggleChat(true);
      return null;
    },
    [createBet, game]
  );

  return { bet, friend, pending, invite, cancel: cancelBet };
}

/** Connection line for an online match: is the opponent at the table? */
export function OnlineStatus({ oppOnline, ready, canAbort, onAbort }: { oppOnline: boolean | null; ready: boolean; canAbort: boolean; onAbort: () => void }) {
  if (!ready) return <p className="text-center text-[11px] text-ink-300">Đang kết nối bàn đấu…</p>;
  if (oppOnline !== false) return null;
  return (
    <div role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-2 text-center text-[11px] text-amber-200">
      {canAbort ? "Đối thủ chưa vào bàn." : "Đối thủ mất kết nối — đồng hồ của họ vẫn chạy."}
      {canAbort && (
        <button type="button" className="btn-ghost ml-2 px-2 py-0.5 text-[11px]" onClick={onAbort}>
          Huỷ ván
        </button>
      )}
    </div>
  );
}

/* ------------------------------ Confirm dialog ----------------------------- */

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" onClick={onCancel}>
          <motion.div
            initial={{ scale: 0.94, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            className="panel w-full max-w-sm p-6"
          >
            <h3 className="font-display text-xl font-extrabold">{title}</h3>
            {body && <div className="mt-2 text-sm text-ink-300">{body}</div>}
            <div className="mt-6 flex gap-2">
              <button type="button" className="btn-ghost flex-1" onClick={onCancel} autoFocus>
                Huỷ
              </button>
              <button type="button" className={cn("flex-1", danger ? "btn-danger" : "btn-lime")} onClick={onConfirm}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------- Toast (local) ----------------------------- */

export function useToast() {
  const [toast, setToast] = useState<{ id: number; text: string; tone: "info" | "good" | "bad" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, tone: "info" | "good" | "bad" = "info", ms = 2600) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone });
    timer.current = setTimeout(() => setToast(null), ms);
  }, []);
  const node = (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          role="status"
          className={cn(
            "fixed bottom-28 left-1/2 z-[55] -translate-x-1/2 rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-lift",
            toast.tone === "good" && "border-lime-400/40 bg-ink-900 text-lime-300",
            toast.tone === "bad" && "border-pop-red/40 bg-ink-900 text-[#ffb3bb]",
            toast.tone === "info" && "border-white/15 bg-ink-900 text-ink-100"
          )}
        >
          {toast.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
  return { show, node };
}

/* ---------------------------- Match settlement ----------------------------- */

const ELO_FIELD: Record<GameType, "eloChess" | "eloXiangqi" | "eloWerewolf" | "eloArcade" | "eloUno" | "eloTyping" | "eloCaro"> = {
  chess: "eloChess",
  xiangqi: "eloXiangqi",
  werewolf: "eloWerewolf",
  arcade: "eloArcade",
  uno: "eloUno",
  typing: "eloTyping",
  caro: "eloCaro",
};

/** Settle ELO + Lúa exactly once per match, record it, and drive the result modal. */
export function useMatchSettlement(gameType: GameType) {
  const settleMatchResult = useAppStore((s) => s.settleMatchResult);
  const user = useAppStore(useShallow((s) => ({ id: s.currentUser.id, username: s.currentUser.username })));
  const [result, setResult] = useState<MatchSettlementResult | null>(null);
  const [open, setOpen] = useState(false);
  const settled = useRef(false);

  const settle = useCallback(
    (outcome: "win" | "loss" | "draw", opponent: { name: string; elo: number }, stake: number) => {
      if (settled.current) return null;
      settled.current = true;
      useCooldownStore.getState().start(COOLDOWN.afterMatch, "Vừa kết thúc trận");
      const r = settleMatchResult({ gameType, opponentName: opponent.name, opponentElo: opponent.elo, result: outcome, stake });
      setResult(r);
      setTimeout(() => setOpen(true), 650);
      recordMatchToSupabase({
        gameType,
        playerId: user.id,
        playerName: user.username,
        opponentName: opponent.name,
        opponentElo: opponent.elo,
        result: outcome,
        stake,
        luaChange: r.luaChange,
        eloChange: r.playerEloChange,
        newElo: r.newPlayerElo,
      }).catch(() => {});
      const latest = useAppStore.getState().currentUser;
      syncProfileToSupabase({ ...latest, [ELO_FIELD[gameType]]: r.newPlayerElo }).catch(() => {});
      return r;
    },
    [gameType, settleMatchResult, user.id, user.username]
  );

  const reset = useCallback(() => {
    settled.current = false;
    setResult(null);
    setOpen(false);
  }, []);

  return { settle, reset, result, open, setOpen };
}
