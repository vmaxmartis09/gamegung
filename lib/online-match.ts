"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * Trận online 1-1 (Cờ Vua, Cờ Tướng) với server làm trọng tài — xem db/online.sql.
 *  - Dòng `matches` là nguồn sự thật: danh sách nước đi, đồng hồ, kết quả.
 *  - Mỗi trận một kênh realtime riêng `match:<id>`: postgres_changes của đúng dòng đó + presence 2 người.
 *  - Nước đi gửi kèm số thứ tự (ply) nên gửi trùng / lệch đều bị server từ chối và client tự đồng bộ lại.
 *  - Đồng hồ tính theo giờ server (turn_started_at), không phụ thuộc tab có đang hiện hay không.
 *  - Thăm dò lại mỗi vài giây phòng khi rớt sự kiện realtime.
 */

export interface MatchRow {
  id: string;
  game: "chess" | "xiangqi" | "caro" | "flip";
  p1: string;
  p2: string;
  p1_name: string | null;
  p2_name: string | null;
  p1_avatar: string | null;
  p2_avatar: string | null;
  p1_elo: number;
  p2_elo: number;
  stake: number;
  base_ms: number;
  inc_ms: number;
  moves: unknown[];
  clock1: number;
  clock2: number;
  turn_started_at: string;
  status: "active" | "finished";
  /** user id, "draw", hoặc "none" khi ván bị huỷ. */
  winner: string | null;
  reason: string | null;
  draw_offer_by: string | null;
  updated_at: string;
}

type RpcRow = MatchRow & { ok: boolean; server_now: number };

export type MatchAction = "resign" | "draw_offer" | "draw_accept" | "draw_decline" | "flag" | "abort";

const POLL_MS = 4000;

/** Đọc timestamptz từ RPC ("2026-10-23T03:00:00.123456+00:00") lẫn realtime ("2026-10-23 03:00:00.123456+00"). */
export function parseTs(v: string | null | undefined) {
  if (!v) return 0;
  const iso = v
    .replace(" ", "T")
    .replace(/(\.\d{3})\d+/, "$1")
    .replace(/([+-]\d{2})$/, "$1:00");
  const t = Date.parse(/[zZ]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + "Z");
  return Number.isFinite(t) ? t : 0;
}

/** Thứ tự "mới hơn" của một bản ghi trận, để bỏ qua bản cũ đến muộn. */
function rank(r: MatchRow) {
  return [r.moves.length, r.status === "finished" ? 1 : 0, parseTs(r.updated_at)];
}
function newerOrSame(a: MatchRow, b: MatchRow) {
  const x = rank(a);
  const y = rank(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return true;
}

/** 1 = đi trước (Trắng / Đỏ), 2 = đi sau. */
export function slotOf(row: MatchRow, userId: string): 1 | 2 {
  return row.p1 === userId ? 1 : 2;
}

export function opponentOf(row: MatchRow, userId: string) {
  const mine = slotOf(row, userId);
  return mine === 1
    ? { id: row.p2, name: row.p2_name || "Đối thủ", avatar: row.p2_avatar || "", elo: row.p2_elo }
    : { id: row.p1, name: row.p1_name || "Đối thủ", avatar: row.p1_avatar || "", elo: row.p1_elo };
}

/** Thời gian còn lại (ms) của một bên tại thời điểm `serverNow`. */
export function timeLeft(row: MatchRow, slot: 1 | 2, serverNow: number) {
  const base = slot === 1 ? row.clock1 : row.clock2;
  const toMove: 1 | 2 = row.moves.length % 2 === 0 ? 1 : 2;
  if (row.status !== "active" || row.moves.length < 2 || toMove !== slot) return Math.max(0, base);
  return Math.max(0, base - (serverNow - parseTs(row.turn_started_at)));
}

/** Kết quả ván theo góc nhìn của mình. */
export function describeEnd(row: MatchRow, userId: string): { outcome: "win" | "loss" | "draw" | "abort"; reason: string } {
  const outcome = row.winner === "none" ? "abort" : row.winner === "draw" ? "draw" : row.winner === userId ? "win" : "loss";
  const reason =
    row.reason === "resign"
      ? outcome === "win"
        ? "Đối thủ xin thua"
        : "Bạn xin thua"
      : row.reason === "timeout"
        ? "Hết giờ"
        : row.reason === "timeout_draw"
          ? "Hết giờ, bên còn lại không đủ lực chiếu hết"
          : row.reason === "agreed"
            ? "Hai bên thoả thuận hoà"
            : row.reason === "abort"
              ? "Ván bị huỷ trước khi bắt đầu"
              : row.reason || "Ván đã kết thúc";
  return { outcome, reason };
}

/** Mở (hoặc vào lại) trận cho kèo cược bạn bè; id trận = id kèo. */
export async function openBetMatch(args: {
  id: string;
  game: "chess" | "xiangqi" | "caro" | "flip";
  oppId: string;
  stake: number;
  me: { name: string; avatar: string };
  opp: { name: string; avatar: string };
  /** Thời gian mỗi bên (ms); game không đồng hồ truyền số rất lớn. */
  baseMs?: number;
}): Promise<MatchRow | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("match_open", {
    p_id: args.id,
    p_game: args.game,
    p_opp: args.oppId,
    p_stake: args.stake,
    p_my_name: args.me.name,
    p_my_avatar: args.me.avatar,
    p_opp_name: args.opp.name,
    p_opp_avatar: args.opp.avatar,
    ...(args.baseMs ? { p_base_ms: args.baseMs } : {}),
  });
  if (error) {
    console.warn("[match] open:", error.message);
    return null;
  }
  return (data as RpcRow | null) ?? null;
}

/** Người đang xem trận (không phải người chơi). */
export type Watcher = { id: string; name: string; avatar: string };

/** Trạng thái gọn của các trận (còn chơi hay đã xong); trận chưa mở thì không có trong kết quả. */
export async function peekMatches(ids: string[]): Promise<Record<string, { status: string; winner: string | null; updated_at?: string }>> {
  if (!isSupabaseConfigured || !ids.length) return {};
  const { data, error } = await supabase.rpc("match_peek", { p_ids: ids });
  if (error) {
    console.warn("[match] peek:", error.message);
    return {};
  }
  const out: Record<string, { status: string; winner: string | null; updated_at?: string }> = {};
  for (const r of (data ?? []) as { id: string; status: string; winner: string | null; updated_at?: string }[]) out[r.id] = { status: r.status, winner: r.winner, updated_at: r.updated_at };
  return out;
}

/**
 * `watch`: xem trận của người khác (hoặc trận đã xong) — chỉ đọc, không gửi nước;
 * người xem hiện trong danh sách `watchers` của mọi người trong trận.
 */
export function useOnlineMatch(matchId: string | null, myId: string, opts: { watch?: boolean; me?: { name: string; avatar: string } } = {}) {
  const watch = !!opts.watch;
  const meRef = useRef(opts.me);
  meRef.current = opts.me;
  const [row, setRow] = useState<MatchRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [oppOnline, setOppOnline] = useState<boolean | null>(null);
  const [watchers, setWatchers] = useState<Watcher[]>([]);
  const rowRef = useRef<MatchRow | null>(null);
  // Giờ server − giờ máy; giữ phép đo có độ trễ mạng thấp nhất.
  const offset = useRef({ ms: 0, rtt: Infinity });

  const accept = useCallback((raw: MatchRow | null | undefined) => {
    if (!raw) return;
    // int8 / jsonb có thể đến dạng chuỗi tuỳ đường (RPC hay realtime).
    const next: MatchRow = {
      ...raw,
      moves: typeof raw.moves === "string" ? JSON.parse(raw.moves) : raw.moves ?? [],
      clock1: Number(raw.clock1),
      clock2: Number(raw.clock2),
      base_ms: Number(raw.base_ms),
      inc_ms: Number(raw.inc_ms),
    };
    const cur = rowRef.current;
    if (cur && cur.id === next.id && !newerOrSame(next, cur)) return;
    rowRef.current = next;
    setRow(next);
  }, []);

  const call = useCallback(
    async (fn: string, args: Record<string, unknown>): Promise<RpcRow | null> => {
      const t0 = Date.now();
      const { data, error: err } = await supabase.rpc(fn, args);
      const t1 = Date.now();
      if (err) {
        setError(
          /match_not_found/.test(err.message)
            ? "Không tìm thấy trận hoặc bạn không ở trong trận này."
            : /could not find the function|schema cache/i.test(err.message)
              ? "Server chưa cài phòng trận online (chạy db/online.sql trên Supabase)."
              : err.message
        );
        return null;
      }
      const r = data as RpcRow | null;
      if (r?.server_now && t1 - t0 < offset.current.rtt) offset.current = { ms: r.server_now - (t0 + t1) / 2, rtt: t1 - t0 };
      accept(r);
      return r;
    },
    [accept]
  );

  useEffect(() => {
    rowRef.current = null;
    setRow(null);
    setError(null);
    setOppOnline(null);
    setWatchers([]);
    if (!matchId || !isSupabaseConfigured) return;
    let alive = true;

    const refresh = () => {
      if (alive) void call(watch ? "match_watch" : "match_state", { p_id: matchId }).then((r) => alive && !r && !rowRef.current && setError((e) => e ?? "Không tải được trận."));
    };
    refresh();

    const ch: RealtimeChannel = supabase.channel(`match:${matchId}`, { config: { presence: { key: myId } } });
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, (p) => accept(p.new as MatchRow))
      .on("presence", { event: "sync" }, () => {
        const state = ch.presenceState() as Record<string, { id?: string; watch?: boolean; name?: string; avatar?: string }[]>;
        const list: Watcher[] = [];
        let opp = false;
        for (const [id, metas] of Object.entries(state)) {
          const m = metas[metas.length - 1] ?? {};
          if (m.watch) list.push({ id, name: m.name || "Khán giả", avatar: m.avatar || "" });
          else if (id !== myId) opp = true;
        }
        setOppOnline(opp);
        setWatchers(list);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          ch.track(watch ? { id: myId, watch: true, name: meRef.current?.name ?? "", avatar: meRef.current?.avatar ?? "" } : { id: myId }).catch(() => {});
          refresh(); // bắt kịp những gì xảy ra trước khi kênh sẵn sàng
        }
      });

    const poll = setInterval(() => {
      if (rowRef.current?.status === "active") refresh();
    }, watch ? 1500 : POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(ch);
    };
  }, [matchId, myId, watch, call, accept]);

  /** Gửi nước đi thứ `ply` (đếm từ 0). `result` theo góc nhìn người đi, khi nước này kết thúc ván. */
  const sendMove = useCallback(
    (ply: number, move: unknown, result?: "win" | "loss" | "draw", reason?: string) =>
      matchId && !watch ? call("match_move", { p_id: matchId, p_ply: ply, p_move: move, p_result: result ?? null, p_reason: reason ?? null }) : Promise.resolve(null),
    [matchId, watch, call]
  );

  const act = useCallback(
    (action: MatchAction, flagDraw = false) =>
      matchId && !watch ? call("match_action", { p_id: matchId, p_action: action, p_flag_draw: flagDraw }) : Promise.resolve(null),
    [matchId, watch, call]
  );

  const serverNow = useCallback(() => Date.now() + offset.current.ms, []);

  return { row, error, oppOnline, watchers, sendMove, act, serverNow };
}

/* ------------------------------- Matchmaking ------------------------------- */

export type QueueStatus = { status: "waiting"; othersWaiting: number } | { status: "matched"; match: MatchRow };

/**
 * Vào hàng chờ ghép trận: gọi mm_join mỗi 2s (vừa giữ chỗ vừa hỏi đã ghép chưa).
 * Trả về hàm huỷ; huỷ khi chưa ghép thì rời hàng chờ.
 */
export function joinMatchQueue(args: {
  game: "chess" | "xiangqi";
  stake: number;
  elo: number;
  name: string;
  avatar: string;
  onUpdate: (s: QueueStatus) => void;
  onError: (message: string) => void;
}): () => void {
  let stopped = false;
  let matched = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    if (stopped) return;
    const { data, error } = await supabase.rpc("mm_join", {
      p_game: args.game,
      p_stake: args.stake,
      p_elo: args.elo,
      p_name: args.name,
      p_avatar: args.avatar,
    });
    if (stopped) return;
    if (error) {
      args.onError(
        /could not find the function|does not exist/i.test(error.message)
          ? "Server chưa cài hàng chờ ghép trận (chạy db/online.sql trên Supabase)."
          : error.message
      );
      return;
    }
    const d = data as { status: string; others_waiting?: number; match?: MatchRow };
    if (d.status === "matched" && d.match) {
      matched = true;
      args.onUpdate({ status: "matched", match: d.match });
      return;
    }
    args.onUpdate({ status: "waiting", othersWaiting: d.others_waiting ?? 0 });
    timer = setTimeout(tick, 2000);
  };
  void tick();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (!matched) void supabase.rpc("mm_leave");
  };
}
