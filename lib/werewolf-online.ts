"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";
import type { DeathCause, Role, Team } from "./games/werewolf-engine";

/**
 * Ma Sói online, server giữ trạng thái — xem db/werewolf-online.sql.
 *  - Client chỉ nhận phần mình được thấy (ww_state): vai mình, đồng đội Sói, kết quả soi…
 *  - Mỗi phòng một kênh realtime `ww:<id>` nghe ww_pulse; thăm dò lại mỗi 2s phòng khi rớt sự kiện.
 *  - Lời thăm dò cũng là nhịp đồng hồ: server tự chuyển pha khi quá hạn (giờ server).
 *  - Nhật ký tải tăng dần theo id (p_since), ván mới (gameNo đổi) thì bỏ nhật ký cũ.
 */

export type WwPhase = "lobby" | "reveal" | "night" | "dawn" | "discussion" | "vote" | "verdict" | "hunter" | "over";
export type WwStep = "" | "cupid" | "guard" | "wolves" | "white_wolf" | "seer" | "witch";
export type WwAction = "vote" | "shoot" | "cupid" | "guard" | "bite" | "white_bite" | "seer" | "heal" | "poison";

export interface WwSeat {
  seat: number;
  name: string;
  avatar: string;
  bot: boolean;
  me: boolean;
  host: boolean;
  alive: boolean;
  cause: DeathCause | null;
  diedDay: number | null;
  online: boolean;
  ready: boolean;
  voted: boolean;
  /** Chỉ có khi mình được phép biết: chính mình, đồng đội Sói, người đã chết, hoặc hết ván. */
  role: Role | null;
  lover: boolean;
}

export interface WwVerdict {
  executed: number | null;
  tie: boolean;
  votes: number;
  role: Role | null;
  tally: { seat: number; votes: number; by: number[] }[];
}

export interface WwRoom {
  id: string;
  isHost: boolean;
  status: "lobby" | "playing" | "over" | "closed";
  phase: WwPhase;
  step: WwStep;
  day: number;
  /** Hạn của pha / bước hiện tại, ms theo giờ server. */
  deadline: number | null;
  roles: Role[];
  winner: Team | null;
  gameNo: number;
  seq: number;
  pendingHunter: number | null;
  verdict: WwVerdict | null;
}

export interface WwMe {
  seat: number | null;
  role: Role | null;
  /** Đã hành động ở bước đêm hiện tại. */
  acted: boolean;
  lastGuarded?: number | null;
  wolfVotes?: Record<string, number | null>;
  wolfBonus?: number;
  seerResults?: Record<string, boolean>;
  healUsed?: boolean;
  poisonUsed?: boolean;
  healDecided?: boolean;
  healed?: boolean;
  /** Nạn nhân của Sói đêm nay (chỉ Phù Thủy, chỉ trong bước của mình). */
  victim?: number | null;
  lovers?: [number, number];
  myVote?: number | null;
}

export interface WwLog {
  id: number;
  day: number;
  kind: "narrator" | "chat" | "death" | "vote" | "private" | "wolf";
  speaker: number | null;
  text: string;
  private: boolean;
}

interface WwView {
  ok: boolean;
  server_now: number;
  room: WwRoom;
  me: WwMe;
  seats: WwSeat[];
  log: WwLog[];
}

export interface WwOpenRoom {
  id: string;
  host: string | null;
  players: number;
  size: number;
}

const POLL_MS = 2000;

const ERRORS: Record<string, string> = {
  not_authenticated: "Cần đăng nhập tài khoản để chơi online.",
  room_not_found: "Không tìm thấy phòng với mã này.",
  room_closed: "Phòng đã đóng.",
  room_full: "Phòng đã đủ người.",
  room_started: "Ván trong phòng này đã bắt đầu.",
  not_host: "Chỉ chủ phòng làm được việc này.",
  need_players: "Chưa đủ người cho bộ vai.",
  too_many_players: "Phòng đang nhiều người hơn bộ vai này.",
  bad_roles: "Bộ vai không hợp lệ.",
  bad_player_count: "Cần từ 6 đến 16 người.",
  bad_wolf_count: "Phe Sói phải có ít nhất 1 và ít hơn nửa số người.",
  not_over: "Ván chưa kết thúc.",
  not_in_room: "Bạn không ở trong phòng này.",
};

export function wwError(message: string) {
  if (/could not find the function|schema cache|does not exist/i.test(message)) {
    return "Server chưa cài Ma Sói online (chạy db/werewolf-online.sql trên Supabase).";
  }
  const key = Object.keys(ERRORS).find((k) => message.includes(k));
  return key ? ERRORS[key] : message;
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<{ data: T | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: "Chưa cấu hình Supabase." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { data: null, error: wwError(error.message) };
  return { data: (data as T) ?? null, error: null };
}

export const wwCreate = (name: string, avatar: string, roles: Role[]) =>
  rpc<WwView>("ww_create", { p_name: name, p_avatar: avatar, p_roles: roles }).then((r) => ({ id: r.data?.room.id ?? null, error: r.error }));

export const wwJoin = (code: string, name: string, avatar: string) =>
  rpc<WwView>("ww_join", { p_room: code, p_name: name, p_avatar: avatar }).then((r) => ({ id: r.data?.room.id ?? null, error: r.error }));

export const wwLeave = (room: string) => rpc<null>("ww_leave", { p_room: room });

/** Phòng đang dở của mình (vào lại sau khi tải lại trang / rớt mạng). */
export const wwResume = () => rpc<string>("ww_resume").then((r) => r.data);

export const wwListOpen = () => rpc<WwOpenRoom[]>("ww_list_open").then((r) => r.data ?? []);

export function useWerewolfRoom(roomId: string) {
  const [room, setRoom] = useState<WwRoom | null>(null);
  const [me, setMe] = useState<WwMe | null>(null);
  const [seats, setSeats] = useState<WwSeat[]>([]);
  const [log, setLog] = useState<WwLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<WwRoom | null>(null);
  const logRef = useRef<WwLog[]>([]);
  const lastLogId = useRef(0);
  // Giờ server − giờ máy; giữ phép đo có độ trễ mạng thấp nhất.
  const offset = useRef({ ms: 0, rtt: Infinity });
  const inFlight = useRef(false);
  const again = useRef(false);

  const accept = useCallback((v: WwView | null, t0: number, t1: number) => {
    if (!v?.room) return;
    if (v.server_now && t1 - t0 < offset.current.rtt) offset.current = { ms: v.server_now - (t0 + t1) / 2, rtt: t1 - t0 };
    const cur = roomRef.current;
    const newGame = !!cur && cur.gameNo !== v.room.gameNo;
    if (newGame) logRef.current = [];
    if (v.log.length) {
      const seen = new Set(logRef.current.map((l) => l.id));
      logRef.current = [...logRef.current, ...v.log.filter((l) => !seen.has(l.id))].sort((a, b) => a.id - b.id).slice(-300);
      setLog(logRef.current);
    } else if (newGame) setLog([]);
    lastLogId.current = logRef.current.length ? logRef.current[logRef.current.length - 1].id : 0;
    // Bản cũ đến muộn: chỉ lấy nhật ký, không lùi trạng thái.
    if (cur && !newGame && v.room.seq < cur.seq) return;
    roomRef.current = v.room;
    setRoom(v.room);
    setMe(v.me);
    setSeats(v.seats);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    try {
      do {
        again.current = false;
        const t0 = Date.now();
        const { data, error: err } = await rpc<WwView>("ww_state", { p_room: roomId, p_since: lastLogId.current });
        const t1 = Date.now();
        if (err) setError(err);
        else if (!data) setError("Bạn không còn ở trong phòng này.");
        else accept(data, t0, t1);
      } while (again.current);
    } finally {
      inFlight.current = false;
    }
  }, [roomId, accept]);

  useEffect(() => {
    roomRef.current = null;
    logRef.current = [];
    lastLogId.current = 0;
    setRoom(null);
    setMe(null);
    setSeats([]);
    setLog([]);
    setError(null);
    if (!roomId || !isSupabaseConfigured) return;
    let alive = true;
    void refresh();

    const ch: RealtimeChannel = supabase.channel(`ww:${roomId}`);
    ch.on("postgres_changes", { event: "*", schema: "public", table: "ww_pulse", filter: `room_id=eq.${roomId}` }, () => alive && void refresh()).subscribe((status) => {
      if (status === "SUBSCRIBED") void refresh(); // bắt kịp những gì xảy ra trước khi kênh sẵn sàng
    });

    const poll = setInterval(() => {
      const st = roomRef.current?.status;
      if (st === "playing" || st === "lobby") void refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(ch);
    };
  }, [roomId, refresh]);

  const serverNow = useCallback(() => Date.now() + offset.current.ms, []);

  // Hết hạn pha thì hỏi lại ngay (server chuyển pha theo giờ của nó), không đợi nhịp thăm dò.
  useEffect(() => {
    if (!room?.deadline || room.status !== "playing") return;
    const wait = Math.max(150, room.deadline - serverNow() + 250);
    const t = setTimeout(() => void refresh(), wait);
    return () => clearTimeout(t);
  }, [room?.deadline, room?.status, refresh, serverNow]);

  /** Gửi một hành động; trả về true nếu server chấp nhận. */
  const act = useCallback(
    async (action: WwAction, target: number | null = null, target2: number | null = null, flag = false) => {
      const t0 = Date.now();
      const { data, error: err } = await rpc<WwView>("ww_act", {
        p_room: roomId,
        p_action: action,
        p_target: target,
        p_target2: target2,
        p_flag: flag,
        p_since: lastLogId.current,
      });
      if (err) {
        setError(err);
        return false;
      }
      accept(data, t0, Date.now());
      return !!data?.ok;
    },
    [roomId, accept]
  );

  const chat = useCallback(
    async (text: string) => {
      const { data } = await rpc<boolean>("ww_chat", { p_room: roomId, p_text: text });
      void refresh();
      return !!data;
    },
    [roomId, refresh]
  );

  /** Lệnh chủ phòng (thêm bot, mời ra, đổi bộ vai, bắt đầu, ván mới). Trả về lỗi (nếu có). */
  const host = useCallback(
    async (fn: "ww_add_bot" | "ww_kick" | "ww_set_roles" | "ww_start" | "ww_rematch", args: Record<string, unknown> = {}) => {
      const t0 = Date.now();
      const { data, error: err } = await rpc<WwView>(fn, { p_room: roomId, ...args });
      if (data) accept(data, t0, Date.now());
      return err;
    },
    [roomId, accept]
  );

  return { room, me, seats, log, error, serverNow, refresh, act, chat, host };
}
