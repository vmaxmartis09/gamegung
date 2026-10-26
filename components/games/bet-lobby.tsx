"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Hourglass, LogOut, Play } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { useBetRounds } from "@/lib/bet-rounds";
import { betCode } from "@/lib/room-code";

/** `inGame`: hai bên đã vào ván trước đó — vào lại thẳng bàn, không qua phòng chờ. */
export type BetOpp = { room: string; oppId: string; name: string; avatar: string; stake: number; inGame?: boolean; /** Ván thứ mấy trong kèo (chủ phòng quyết định). */ round?: number };

/** Sau chừng này kể từ lúc nhận kèo mà hai bên chưa cùng sẵn sàng thì kèo tự huỷ, hoàn Lúa. */
export const LOBBY_TIMEOUT_MS = 9 * 60 * 1000;

/** Hạn chót phòng chờ của một kèo (null nếu không tìm thấy kèo). */
export function lobbyDeadline(betId: string): number | null {
  for (const list of Object.values(useAppStore.getState().messages)) {
    const b = list.find((m) => m.betChallenge?.id === betId)?.betChallenge;
    if (!b) continue;
    // Giữa hai ván: tính từ lúc ván trước kết thúc.
    const ended = useBetRounds.getState().rounds[betId]?.endedAt ?? 0;
    return Math.max(b.acceptedAt ?? b.createdAt, ended) + LOBBY_TIMEOUT_MS;
  }
  return null;
}

type LobbyPeer = { ready?: boolean; startAt?: number; round?: number };

const COUNTDOWN = 3;

/**
 * Phòng chờ của kèo đã nhận: người nhận kèo vào là sẵn sàng luôn, chủ kèo bấm "Bắt đầu"
 * thì cả hai máy đếm ngược tới cùng một mốc rồi vào bàn.
 */
export function BetLobby({ bo, onStart, onLeave }: { bo: BetOpp; onStart: (bo: BetOpp) => void; onLeave: () => void }) {
  const myId = useAppStore((s) => s.currentUser.id);
  const myName = useAppStore((s) => s.currentUser.username);
  const myAvatar = useAppStore((s) => s.currentUser.avatar);
  const bet = useAppStore((s) => {
    for (const list of Object.values(s.messages)) {
      const b = list.find((m) => m.betChallenge?.id === bo.room)?.betChallenge;
      if (b) return b;
    }
    return null;
  });
  // Chủ phòng = chủ kèo. Không tìm thấy kèo thì coi như mình là chủ phòng.
  const isHost = bet ? bet.creatorId === myId : true;
  const [peers, setPeers] = useState<Record<string, LobbyPeer>>({});
  const [myStartAt, setMyStartAt] = useState<number | null>(null);
  const played = useBetRounds((s) => s.rounds[bo.room]);
  // Ván kế tiếp: chưa chơi ván nào là 1, đã chơi thì +1.
  const nextRound = played ? played.round + (played.active ? 0 : 1) : 1;
  const [count, setCount] = useState<number | null>(null);
  const startedRef = useRef(false);
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const startRef = useRef(onStart);
  startRef.current = onStart;
  const leaveRef = useRef(onLeave);
  leaveRef.current = onLeave;
  const [left, setLeft] = useState<number | null>(null);

  // Hết 9 phút mà chưa vào ván: huỷ kèo (hoàn Lúa cả hai bên) và đóng phòng chờ.
  useEffect(() => {
    const t = setInterval(() => {
      if (startedRef.current) return;
      const dl = lobbyDeadline(bo.room);
      if (dl === null) return setLeft(null);
      const ms = dl - Date.now();
      setLeft(Math.max(0, ms));
      if (ms <= 0) {
        // Chưa chơi ván nào: huỷ và hoàn Lúa. Đã chơi rồi: chốt kèo, không hoàn nữa.
        if (useBetRounds.getState().rounds[bo.room]?.escrowBack) useAppStore.getState().markBetStatus(bo.room, "completed");
        else useAppStore.getState().markBetStatus(bo.room, "cancelled", { cancelReason: "lobby_timeout" });
        leaveRef.current();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [bo.room]);

  // Kèo đã bị huỷ ở máy kia: đóng phòng chờ.
  useEffect(() => {
    if (bet?.status === "cancelled" && !startedRef.current) leaveRef.current();
  }, [bet?.status]);

  useEffect(() => {
    if (!isSupabaseConfigured || !myId) return;
    const ch = supabase.channel(`bet-lobby:${bo.room}`, { config: { presence: { key: myId } } });
    chRef.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, LobbyPeer[]>;
      const next: Record<string, LobbyPeer> = {};
      for (const [key, metas] of Object.entries(state)) next[key] = metas[metas.length - 1] ?? {};
      setPeers(next);
    }).subscribe((status) => {
      // Vào phòng là sẵn sàng; chủ phòng còn phải bấm Bắt đầu.
      if (status === "SUBSCRIBED") void ch.track({ ready: true });
    });
    return () => {
      chRef.current = null;
      void supabase.removeChannel(ch);
    };
  }, [bo.room, myId]);

  const oppHere = !!peers[bo.oppId];
  const startAt = isHost ? myStartAt : peers[bo.oppId]?.startAt ?? null;
  const round = isHost ? nextRound : peers[bo.oppId]?.round ?? nextRound;

  const hostStart = () => {
    if (!oppHere || myStartAt) return;
    const at = Date.now() + COUNTDOWN * 1000;
    setMyStartAt(at);
    void chRef.current?.track({ ready: true, startAt: at, round: nextRound });
  };

  // Đối thủ rời phòng trước khi đếm xong: chủ phòng huỷ đếm ngược.
  useEffect(() => {
    if (isHost && myStartAt && !oppHere && !startedRef.current) {
      setMyStartAt(null);
      void chRef.current?.track({ ready: true });
    }
  }, [isHost, myStartAt, oppHere]);

  useEffect(() => {
    if (!startAt) return setCount(null);
    const tick = () => {
      const left = Math.ceil((startAt - Date.now()) / 1000);
      if (left <= 0) {
        if (!startedRef.current) {
          startedRef.current = true;
          useAppStore.getState().markBetStatus(bo.room, "in_game");
          startRef.current({ ...bo, round, inGame: true });
        }
        return setCount(0);
      }
      setCount(Math.min(COUNTDOWN, left));
    };
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startAt]);

  // Hết ván, lần nữa vào phòng chờ: cho phép bắt đầu lại.
  useEffect(() => {
    startedRef.current = false;
  }, [bo.room]);

  const slot = (name: string, avatar: string, here: boolean, host: boolean, you: boolean) => (
    <div className="flex flex-1 flex-col items-center gap-2 rounded-2xl border border-white/[0.075] bg-white/[0.03] p-3">
      <UserAvatar src={avatar} name={name} className="size-14" />
      <p className="max-w-full truncate text-sm font-semibold text-ink-100">
        {name}
        {you ? " (bạn)" : ""}
      </p>
      <span
        className={cn(
          "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
          here ? "bg-success/15 text-success" : "bg-white/5 text-ink-400"
        )}
      >
        {here ? <Check className="size-3" /> : <Hourglass className="size-3" />}
        {!here ? "Chưa vào phòng" : host ? "Chủ phòng" : "Sẵn sàng"}
      </span>
    </div>
  );

  const status =
    count !== null
      ? `Bắt đầu sau ${count}…`
      : !oppHere
        ? `Đang chờ ${bo.name} vào phòng…`
        : isHost
          ? `${bo.name} đã sẵn sàng. Bấm Bắt đầu để vào bàn.`
          : `Đang chờ ${bo.name} (chủ phòng) bấm Bắt đầu…`;

  return (
    <div role="dialog" aria-label="Phòng chờ" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/[0.1] bg-ink-950 p-5 shadow-2xl">
        <div className="text-center">
          <h2 className="font-display text-lg font-extrabold text-white">Phòng chờ{round > 1 ? ` · Ván ${round}` : ""}</h2>
          {bet && <p className="mt-0.5 font-mono text-xs tracking-widest text-ink-400">Mã phòng {betCode(bet)} · /join {betCode(bet)}</p>}
          <p className="text-xs text-ink-300">Kèo {bo.stake} Lúa · chủ phòng bấm Bắt đầu khi đủ người</p>
          {left !== null && count === null && (
            <p className="mt-1 text-[11px] text-ink-400">
              Tự huỷ và hoàn Lúa sau {Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, "0")} nếu chưa bắt đầu
            </p>
          )}
        </div>
        <div className="flex items-stretch gap-3">
          {slot(myName, myAvatar, true, isHost, true)}
          {slot(bo.name, bo.avatar, oppHere, !isHost, false)}
        </div>
        <p className="min-h-5 text-center text-xs text-ink-300" aria-live="polite">
          {status}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onLeave} className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-sm">
            <LogOut className="size-4" /> Rời phòng
          </button>
          {isHost && (
            <button
              type="button"
              onClick={hostStart}
              disabled={!oppHere || count !== null}
              className="btn-accent flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-bold disabled:opacity-50"
            >
              <Play className="size-4" /> Bắt đầu
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
