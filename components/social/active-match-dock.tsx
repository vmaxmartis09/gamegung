"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { betHref, openBetLobby } from "@/lib/bet-nav";
import { currentRound, roomOf, useBetRounds } from "@/lib/bet-rounds";
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
const SERVER_GAMES = new Set(["chess", "xiangqi", "caro", "flip"]);

type Peek = Record<string, { status: string; winner: string | null; updated_at?: string }>;
type Entry = { id: string; game: GameId; title: string; detail: string; href: string; watch: boolean; at: number };

/** Ván đã vào mà máy này không theo dõi được (máy khác / dữ liệu cũ): quá lâu thì thôi không nhắc. */
const STALE_GAME_MS = 30 * 60 * 1000;

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
      // Hỏi bàn của ván hiện tại (ván 2 trở đi có id riêng).
      const ids = bets.filter((b) => SERVER_GAMES.has(b.gameType)).map((b) => roomOf(b.id, currentRound(b.id)));
      const rows = (await peekMatches(ids)) as Peek;
      if (!alive) return;
      setPeek(rows);
      const now = Date.now();
      const local = useBetRounds.getState().rounds;
      for (const b of bets) {
        const room = roomOf(b.id, currentRound(b.id));
        const row = rows[room];
        const r = local[b.id];
        // Đang nghỉ giữa hai ván ở phòng chờ: quá 9 phút thì chốt kèo (đã chơi) hoặc huỷ (chưa chơi).
        if (b.status === "in_game" && r && !r.active) {
          if (now > (r.endedAt ?? 0) + LOBBY_TIMEOUT_MS) {
            if (r.escrowBack) st.markBetStatus(b.id, "completed");
            else st.markBetStatus(b.id, "cancelled", { cancelReason: "lobby_timeout" });
          }
          continue;
        }
        if (b.status === "accepted" && !row) {
          if (now > (b.acceptedAt ?? b.createdAt) + LOBBY_TIMEOUT_MS) st.markBetStatus(b.id, "cancelled", { cancelReason: "lobby_timeout" });
          continue;
        }
        if (b.status === "completed") continue;
        if (row?.status === "finished") {
          // Máy này có theo dõi các ván thì kèo vẫn tiếp tục (về phòng chờ); không thì chốt theo bàn.
          if (r) continue;
          if (row.winner === "none") st.markBetStatus(b.id, "cancelled", { cancelReason: "abandoned" });
          else st.markBetStatus(b.id, "completed");
          continue;
        }
        if (row?.status === "active" && row.updated_at && now - Date.parse(row.updated_at) > IDLE_MS) {
          const { data } = await supabase.rpc("match_expire", { p_id: room });
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
    const now = Date.now();
    const rounds = useBetRounds.getState().rounds;
    const out: Entry[] = [];
    for (const b of myBets(messages, myId)) {
      if (now - b.createdAt > MAX_AGE_MS) continue;
      const meta = GAME_BY_ID[b.gameType as GameId];
      // Chỉ game có phòng chờ kèo mới vào lại được (Ma Sói, Deadline Rush thì không).
      const lobbyHref = betHref(b);
      if (!meta || !lobbyHref) continue;
      const r = rounds[b.id];
      const room = roomOf(b.id, currentRound(b.id));
      // Kèo nhiều ván: hết ván vẫn còn phòng chờ, nên chỉ coi là xong khi kèo đã chốt.
      const finished = b.status === "completed" || (!r && peek[room]?.status === "finished");
      // Kèo đã quá hạn nhưng server chưa kịp cập nhật: đừng nhắc nữa.
      const expired =
        (b.status === "accepted" && now > (b.acceptedAt ?? b.createdAt) + LOBBY_TIMEOUT_MS) ||
        (b.status === "in_game" && !r && now > (b.startedAt ?? b.acceptedAt ?? b.createdAt) + STALE_GAME_MS) ||
        (b.status === "in_game" && r && !r.active && now > (r.endedAt ?? 0) + LOBBY_TIMEOUT_MS);
      const live = (b.status === "accepted" || b.status === "in_game") && !finished && !expired;
      // Ván đã xong: chỉ xem lại được với game có bàn trên server.
      const canWatch = finished && SERVER_GAMES.has(b.gameType) && !!peek[room];
      if (!live && !canWatch) continue;
      const other = b.creatorId === myId ? b.opponentName : b.creatorName;
      const between = live && r && !r.active;
      out.push({
        id: `bet:${b.id}`,
        game: b.gameType as GameId,
        title: meta.name,
        detail: `${live ? (between ? "Ở phòng chờ · " : "") : "Đã xong · "}vs ${other ?? "đối thủ"} · ${b.stake} Lúa`,
        href: live ? lobbyHref : `${meta.href}?match=${encodeURIComponent(room)}&watch=1`,
        watch: !live,
        at: live ? 2e13 + (b.startedAt ?? b.acceptedAt ?? b.createdAt) : b.createdAt,
      });
    }
    for (const s of sessionsFor(myId, rawSessions)) {
      out.push({ id: `solo:${s.game}`, game: s.game, title: GAME_BY_ID[s.game].name, detail: s.label, href: GAME_BY_ID[s.game].href, watch: false, at: 1e13 + s.savedAt });
    }
    // Ưu tiên: kèo đang chơi (mới nhất) > ván chơi một mình > ván đã xong; mỗi game một thẻ.
    out.sort((x, y) => y.at - x.at);
    const seenGame = new Set<string>();
    return out.filter((e) => {
      if (dismissed.includes(e.id) || seenGame.has(e.game)) return false;
      seenGame.add(e.game);
      return true;
    });
  }, [messages, rawSessions, myId, dismissed, peek]);

  // Đang ở trang của game đó (trang game có thể xoá ?bet khỏi URL khi vào bàn): không nhắc game đó nữa.
  const here = (e: Entry) => pathname === e.href.split("?")[0];
  // Chỉ một thẻ, kèm số việc dở khác.
  const pending = entries.filter((e) => !here(e));
  const shown = pending.slice(0, 1);
  const more = pending.length - shown.length;

  // Trang game chỉ đọc ?bet / ?match lúc mở: cùng trang thì tải lại để vào đúng bàn.
  const go = (href: string) => {
    if (window.location.pathname === href.split("?")[0]) window.location.assign(href);
    else router.push(href);
  };

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
              {more > 0 && <p className="text-[10px] text-ink-500">+{more} ván dở khác</p>}
            </div>
            {e.watch ? (
              <button type="button" onClick={() => go(e.href)} className="btn-ghost flex shrink-0 items-center gap-1 px-2.5 py-1 text-[11px]">
                <Eye className="size-3.5" /> Xem
              </button>
            ) : (
              <button type="button" onClick={() => go(e.href)} className="btn-accent shrink-0 px-2.5 py-1 text-[11px]">
                Vào lại
              </button>
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
