"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { openBetLobby } from "@/lib/bet-nav";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, X } from "lucide-react";
import { useAppStore, type BetChallenge } from "@/lib/store";
import { useSessionStore, sessionsFor } from "@/lib/session-store";
import { peekMatches } from "@/lib/online-match";
import { supabase } from "@/lib/supabase";
import { LOBBY_TIMEOUT_MS } from "@/components/games/bet-lobby";
import { GAME_BY_ID, GameIcon, type GameId } from "@/components/art/game-art";

/** Kèo cũ hơn chừng này không hiện ở góc nữa. */
const MAX_AGE_MS = 3 * 3600 * 1000;
/** Ván đã bắt đầu mà không ai đi nước quá lâu thì huỷ (khớp match_expire trên server). */
const IDLE_MS = 10 * 60 * 1000;
/** Typing Battle không có bàn trên server: ván online quá lâu coi như bỏ dở. */
const TYPING_IDLE_MS = 15 * 60 * 1000;
const SWEEP_MS = 20 * 1000;
const DISMISS_KEY = "oa-dock-dismissed-v1";
/** Game có bàn trên server (bảng matches): xem lại được sau khi xong. */
const SERVER_GAMES = new Set(["chess", "xiangqi", "caro"]);

type Peek = Record<string, { status: string; winner: string | null; updated_at?: string }>;
type Entry = { id: string; game: GameId; title: string; detail: string; href: string; watch: boolean };

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
  } catch {
    return [];
  }
}

function myBets(messages: Record<string, { betChallenge?: BetChallenge }[]>, myId: string) {
  const out = new Map<string, BetChallenge>();
  for (const list of Object.values(messages)) {
    for (const m of list) {
      const b = m.betChallenge;
      if (b && (b.creatorId === myId || b.opponentId === myId)) out.set(b.id, b);
    }
  }
  return [...out.values()];
}

/**
 * Thẻ nhỏ ở góc cho ván đang dở: còn hiệu lực thì "Vào lại", đã xong thì chỉ "Xem".
 * Đồng thời dọn kèo bỏ dở: phòng chờ quá 9 phút, hoặc ván không ai đi nước quá lâu.
 */
export function ActiveMatchDock() {
  const pathname = usePathname() || "";
  const q = useSearchParams();
  const myId = useAppStore((s) => s.currentUser.id);
  const messages = useAppStore((s) => s.messages);
  const rawSessions = useSessionStore((s) => s.sessions);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [peek, setPeek] = useState<Peek>({});
  useEffect(() => setDismissed(readDismissed()), []);
  const router = useRouter();

  // Kèo mình tạo vừa có người nhận: chủ kèo cũng vào phòng chờ luôn.
  useEffect(() => {
    const status = new Map<string, string>();
    for (const b of myBets(useAppStore.getState().messages, myId)) status.set(b.id, b.status);
    return useAppStore.subscribe((s) => {
      for (const b of myBets(s.messages, myId)) {
        const prev = status.get(b.id);
        status.set(b.id, b.status);
        if (prev === "pending" && b.status === "accepted" && b.creatorId === myId) openBetLobby(b, router.push);
      }
    });
  }, [myId, router]);

  // Dọn kèo bỏ dở + hỏi server trạng thái các bàn.
  useEffect(() => {
    let alive = true;
    const sweep = async () => {
      const st = useAppStore.getState();
      const me = st.currentUser.id;
      const bets = myBets(st.messages, me).filter((b) => b.status === "accepted" || b.status === "in_game" || b.status === "completed");
      const ids = bets.filter((b) => SERVER_GAMES.has(b.gameType)).map((b) => b.id);
      const rows = (await peekMatches(ids)) as Peek;
      if (!alive) return;
      setPeek(rows);
      const now = Date.now();
      for (const b of bets) {
        const row = rows[b.id];
        if (b.status === "accepted" && !row) {
          if (now > (b.acceptedAt ?? b.createdAt) + LOBBY_TIMEOUT_MS) st.markBetStatus(b.id, "cancelled", { cancelReason: "lobby_timeout" });
          continue;
        }
        if (b.status === "completed") continue;
        if (row?.status === "finished") {
          if (row.winner === "none") st.markBetStatus(b.id, "cancelled", { cancelReason: "abandoned" });
          else st.markBetStatus(b.id, "completed");
          continue;
        }
        if (row?.status === "active" && row.updated_at && now - Date.parse(row.updated_at) > IDLE_MS) {
          const { data } = await supabase.rpc("match_expire", { p_id: b.id });
          if ((data as { status?: string; winner?: string } | null)?.winner === "none") st.markBetStatus(b.id, "cancelled", { cancelReason: "abandoned" });
          continue;
        }
        if (!row && b.status === "in_game" && now > (b.startedAt ?? b.acceptedAt ?? b.createdAt) + TYPING_IDLE_MS) {
          st.markBetStatus(b.id, "cancelled", { cancelReason: "abandoned" });
        }
      }
    };
    void sweep();
    const t = setInterval(() => void sweep(), SWEEP_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [myId]);

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const b of myBets(messages, myId)) {
      if (Date.now() - b.createdAt > MAX_AGE_MS) continue;
      const meta = GAME_BY_ID[b.gameType as GameId];
      if (!meta) continue;
      const finished = b.status === "completed" || peek[b.id]?.status === "finished";
      const live = (b.status === "accepted" || b.status === "in_game") && !finished;
      // Ván đã xong: chỉ xem lại được với game có bàn trên server.
      if (!live && !(finished && SERVER_GAMES.has(b.gameType) && peek[b.id])) continue;
      const other = b.creatorId === myId ? b.opponentName : b.creatorName;
      out.push({
        id: `bet:${b.id}`,
        game: b.gameType as GameId,
        title: meta.name,
        detail: `${live ? "" : "Đã xong · "}vs ${other ?? "đối thủ"} · ${b.stake} Lúa`,
        href: live ? `${meta.href}?stake=${b.stake}&bet=${encodeURIComponent(b.id)}` : `${meta.href}?match=${encodeURIComponent(b.id)}&watch=1`,
        watch: !live,
      });
    }
    for (const s of sessionsFor(myId, rawSessions)) {
      out.push({ id: `solo:${s.game}`, game: s.game, title: GAME_BY_ID[s.game].name, detail: s.label, href: GAME_BY_ID[s.game].href, watch: false });
    }
    return out.filter((e) => !dismissed.includes(e.id));
  }, [messages, rawSessions, myId, dismissed, peek]);

  // Đang ở đúng bàn đó: không cần nhắc.
  const here = (e: Entry) => {
    const [path, query] = e.href.split("?");
    if (pathname !== path) return false;
    const p = new URLSearchParams(query ?? "");
    const id = p.get("bet") ?? p.get("match");
    return id ? q?.get("bet") === id || q?.get("match") === id : true;
  };
  const shown = entries.filter((e) => !here(e)).slice(0, 2);

  const dismiss = (id: string) => {
    const next = [...dismissed, id].slice(-50);
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  if (!shown.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-20 left-4 z-40 flex max-w-[min(280px,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {shown.map((e) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/10 bg-ink-950/95 p-2.5 shadow-[0_16px_40px_-14px_rgba(0,0,0,0.9)] backdrop-blur-xl"
            role="status"
            aria-label={`${e.watch ? "Ván đã xong" : "Đang chơi dở"} ${e.title}`}
          >
            <GameIcon game={e.game} className="size-9 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">
                {e.watch ? "Ván đã xong" : "Đang chơi dở"} · {e.title}
              </p>
              <p className="truncate text-[11px] text-ink-300">{e.detail}</p>
            </div>
            {e.watch ? (
              <Link href={e.href} className="btn-ghost flex shrink-0 items-center gap-1 px-2.5 py-1 text-[11px]">
                <Eye className="size-3.5" /> Xem
              </Link>
            ) : (
              <Link href={e.href} className="btn-accent shrink-0 px-2.5 py-1 text-[11px]">
                Vào lại
              </Link>
            )}
            <button type="button" onClick={() => dismiss(e.id)} aria-label="Ẩn" title="Ẩn" className="grid size-6 shrink-0 place-items-center rounded-md text-ink-400 transition hover:bg-white/10 hover:text-white">
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
