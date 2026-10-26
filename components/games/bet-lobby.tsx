"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Hourglass, LogOut, Play } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

export type BetOpp = { room: string; oppId: string; name: string; avatar: string; stake: number };

type LobbyPeer = { ready?: boolean; readyAt?: number };

const COUNTDOWN = 3;

/**
 * Waiting room for an accepted bet: both players meet here, each presses "Sẵn sàng",
 * and the table opens for both once everyone is ready.
 */
export function BetLobby({ bo, onStart, onLeave }: { bo: BetOpp; onStart: (bo: BetOpp) => void; onLeave: () => void }) {
  const myId = useAppStore((s) => s.currentUser.id);
  const myName = useAppStore((s) => s.currentUser.username);
  const myAvatar = useAppStore((s) => s.currentUser.avatar);
  const [peers, setPeers] = useState<Record<string, LobbyPeer>>({});
  const [myReady, setMyReady] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const myReadyAt = useRef(0);
  const startedRef = useRef(false);
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const startRef = useRef(onStart);
  startRef.current = onStart;

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
      if (status === "SUBSCRIBED") void ch.track({ ready: false });
    });
    return () => {
      chRef.current = null;
      void supabase.removeChannel(ch);
    };
  }, [bo.room, myId]);

  const toggleReady = () => {
    const next = !myReady;
    setMyReady(next);
    myReadyAt.current = next ? Date.now() : 0;
    void chRef.current?.track({ ready: next, readyAt: myReadyAt.current });
  };

  const oppHere = !!peers[bo.oppId];
  const oppReady = !!peers[bo.oppId]?.ready;
  const bothReady = myReady && oppHere && oppReady;
  // Cả hai máy đếm ngược tới cùng một mốc: lúc người sẵn sàng sau cùng + COUNTDOWN giây.
  const startAt = bothReady ? Math.max(myReadyAt.current, peers[bo.oppId]?.readyAt ?? 0) + COUNTDOWN * 1000 : null;

  useEffect(() => {
    if (startAt === null) return setCount(null);
    const tick = () => {
      const left = Math.ceil((startAt - Date.now()) / 1000);
      if (left <= 0) {
        if (!startedRef.current) {
          startedRef.current = true;
          startRef.current(bo);
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

  const slot = (name: string, avatar: string, here: boolean, ready: boolean, you: boolean) => (
    <div className="flex flex-1 flex-col items-center gap-2 rounded-2xl border border-white/[0.075] bg-white/[0.03] p-3">
      <UserAvatar src={avatar} name={name} className="size-14" />
      <p className="max-w-full truncate text-sm font-semibold text-ink-100">
        {name}
        {you ? " (bạn)" : ""}
      </p>
      <span
        className={cn(
          "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
          ready ? "bg-success/15 text-success" : here ? "bg-white/10 text-ink-200" : "bg-white/5 text-ink-400"
        )}
      >
        {ready ? <Check className="size-3" /> : <Hourglass className="size-3" />}
        {ready ? "Sẵn sàng" : here ? "Đã vào phòng" : "Chưa vào phòng"}
      </span>
    </div>
  );

  return (
    <div role="dialog" aria-label="Phòng chờ" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/[0.1] bg-ink-950 p-5 shadow-2xl">
        <div className="text-center">
          <h2 className="font-display text-lg font-extrabold text-white">Phòng chờ</h2>
          <p className="text-xs text-ink-300">Kèo {bo.stake} Lúa · cả hai bấm Sẵn sàng để bắt đầu</p>
        </div>
        <div className="flex items-stretch gap-3">
          {slot(myName, myAvatar, true, myReady, true)}
          {slot(bo.name, bo.avatar, oppHere, oppReady, false)}
        </div>
        <p className="min-h-5 text-center text-xs text-ink-300" aria-live="polite">
          {count !== null
            ? `Bắt đầu sau ${count}…`
            : !oppHere
              ? `Đang chờ ${bo.name} vào phòng…`
              : myReady
                ? `Đang chờ ${bo.name} sẵn sàng…`
                : oppReady
                  ? `${bo.name} đã sẵn sàng, đến lượt bạn.`
                  : "Bấm Sẵn sàng khi bạn đã chuẩn bị xong."}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onLeave} className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-sm">
            <LogOut className="size-4" /> Rời phòng
          </button>
          <button
            type="button"
            onClick={toggleReady}
            disabled={count !== null}
            className={cn("btn-accent flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-bold disabled:opacity-60", myReady && "opacity-90")}
          >
            <Play className="size-4" /> {myReady ? "Huỷ sẵn sàng" : "Sẵn sàng"}
          </button>
        </div>
      </div>
    </div>
  );
}
