"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useAppStore, type BetChallenge } from "@/lib/store";
import { useSessionStore, sessionsFor } from "@/lib/session-store";
import { GAME_BY_ID, GameIcon, type GameId } from "@/components/art/game-art";

/** Accepted bets older than this are treated as abandoned rather than "in progress". */
const MAX_AGE_MS = 3 * 3600 * 1000;
const DISMISS_KEY = "oa-dock-dismissed-v1";

type Entry = { id: string; game: GameId; title: string; detail: string; href: string };

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
  } catch {
    return [];
  }
}

/**
 * Small card in the corner for a game the player left half-way: an accepted bet with a friend,
 * or a saved solo table. Shows who/what and jumps straight back in.
 */
export function ActiveMatchDock() {
  const pathname = usePathname() || "";
  const q = useSearchParams();
  const myId = useAppStore((s) => s.currentUser.id);
  const messages = useAppStore((s) => s.messages);
  const rawSessions = useSessionStore((s) => s.sessions);
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => setDismissed(readDismissed()), []);

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    const seen = new Set<string>();
    for (const list of Object.values(messages)) {
      for (const m of list) {
        const b: BetChallenge | undefined = m.betChallenge;
        if (!b || b.status !== "accepted" || seen.has(b.id)) continue;
        if (b.creatorId !== myId && b.opponentId !== myId) continue;
        if (Date.now() - b.createdAt > MAX_AGE_MS) continue;
        const meta = GAME_BY_ID[b.gameType as GameId];
        if (!meta) continue;
        seen.add(b.id);
        const other = b.creatorId === myId ? b.opponentName : b.creatorName;
        out.push({
          id: `bet:${b.id}`,
          game: b.gameType as GameId,
          title: meta.name,
          detail: `vs ${other ?? "đối thủ"} · ${b.stake} Lúa`,
          href: `${meta.href}?stake=${b.stake}&bet=${encodeURIComponent(b.id)}`,
        });
      }
    }
    for (const s of sessionsFor(myId, rawSessions)) {
      out.push({ id: `solo:${s.game}`, game: s.game, title: GAME_BY_ID[s.game].name, detail: s.label, href: GAME_BY_ID[s.game].href });
    }
    return out.filter((e) => !dismissed.includes(e.id));
  }, [messages, rawSessions, myId, dismissed]);

  // Already at that table: nothing to resume.
  const here = (e: Entry) => {
    const [path, query] = e.href.split("?");
    if (pathname !== path) return false;
    const bet = new URLSearchParams(query ?? "").get("bet");
    return bet ? q?.get("bet") === bet : true;
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
            aria-label={`Đang chơi dở ${e.title}`}
          >
            <GameIcon game={e.game} className="size-9 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">Đang chơi dở · {e.title}</p>
              <p className="truncate text-[11px] text-ink-300">{e.detail}</p>
            </div>
            <Link href={e.href} className="btn-accent shrink-0 px-2.5 py-1 text-[11px]">
              Vào lại
            </Link>
            <button type="button" onClick={() => dismiss(e.id)} aria-label="Ẩn" title="Ẩn" className="grid size-6 shrink-0 place-items-center rounded-md text-ink-400 transition hover:bg-white/10 hover:text-white">
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
