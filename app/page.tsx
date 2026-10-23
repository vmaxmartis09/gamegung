"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { BookOpen, Clock, Flame, Users, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { usePresenceStore, sortPeers } from "@/lib/presence";
import { useUiStore } from "@/lib/ui-store";
import { useSessionStore, sessionsFor } from "@/lib/session-store";
import { GameCover, GameIcon, GAMES, GAME_BY_ID, GameMeta } from "@/components/art/game-art";
import { StatusIsland, type IslandTask } from "@/components/kokonut/status-island";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/reactbits";

export default function HomePage() {
  const router = useRouter();
  const currentUserId = useAppStore((s) => s.currentUser.id);
  const peers = usePresenceStore((s) => s.peers);
  const peerList = useMemo(() => sortPeers(Object.values(peers)), [peers]);
  const open = useUiStore((s) => s.open);
  const rawSessions = useSessionStore((s) => s.sessions);
  const clearSession = useSessionStore((s) => s.clear);

  const playing = (label: string) => peerList.filter((p) => p.status === "in-game" && p.currentGame === label).length;
  const inMatch = peerList.filter((p) => p.status === "in-game").length;

  // Độ phổ biến: người đang chơi (presence) + số ván mình đã chơi. Hoà điểm → xáo ngẫu nhiên mỗi lần tải.
  const myStats = useAppStore((s) => s.currentUser.stats) as unknown as Record<string, { games?: number } | undefined>;
  const jitter = useMemo(() => Object.fromEntries(GAMES.map((g) => [g.id, Math.random()])), []);
  const ranked = useMemo(() => {
    const score = (g: GameMeta) => playing(g.name) * 10 + (myStats[g.id]?.games ?? 0) + jitter[g.id] * 0.5;
    return [...GAMES].sort((a, b) => score(b) - score(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peers, myStats, jitter]);
  const hotId = ranked[0] && playing(ranked[0].name) + (myStats[ranked[0].id]?.games ?? 0) > 0 ? ranked[0].id : null;

  const tasks: IslandTask[] = useMemo(
    () =>
      sessionsFor(currentUserId, rawSessions)
        .sort((a, b) => a.savedAt - b.savedAt)
        .map((s) => ({
          id: s.game,
          label: `${GAME_BY_ID[s.game].name} · ${s.label}`,
          detail: s.detail,
          status: "running" as const,
          progress: s.progress,
          icon: <GameIcon game={s.game} className="size-7" />,
          action: { label: "Chơi tiếp", onClick: () => router.push(GAME_BY_ID[s.game].href) },
        })),
    [rawSessions, currentUserId, router]
  );

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col px-4 sm:px-6">
      {/* Floating "resume" island */}
      {tasks.length > 0 && (
        <div className="pointer-events-none sticky top-3 z-30 mb-2 flex justify-center">
          <div className="pointer-events-auto">
            <StatusIsland tasks={tasks} />
          </div>
        </div>
      )}

      <section className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pb-6 pt-2 sm:pb-8">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Đấu Trường <span className="font-normal italic text-ink-200">Nghỉ Trưa</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-300 sm:text-base">Cờ Vua, Cờ Tướng, Ma Sói, Uno và Typing Battle. Chọn một môn, ghép trận với đồng nghiệp.</p>
        </div>

        <dl className="flex items-center gap-6 text-left">
          <Stat label="Môn" value={<CountUp value={GAMES.length} duration={1} />} />
          <Stat label="Online" value={<CountUp value={peerList.length + 1} duration={1.2} />} />
          {inMatch > 0 && <Stat label="Đang đấu" value={<CountUp value={inMatch} duration={1} />} />}
        </dl>
      </section>

      <section className="grid auto-rows-[280px] gap-3 sm:grid-cols-2 lg:auto-rows-[300px] lg:grid-cols-12">
        {ranked.map((g, i) => (
          <GameCard key={g.id} game={g} index={i} hot={g.id === hotId} playing={playing(g.name)} resumable={tasks.some((t) => t.id === g.id)} onDiscard={() => clearSession(g.id)} />
        ))}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dd className="num order-1 text-2xl font-medium leading-tight text-white">{value}</dd>
      <dt className="order-2 text-xs font-medium uppercase tracking-[0.12em] text-ink-300">{label}</dt>
    </div>
  );
}

/** Hạng càng cao → ô càng rộng (7 / 5 / 4 / 4 / 4 trên lưới 12 cột). */
const RANK_SPAN = ["lg:col-span-7", "lg:col-span-5", "lg:col-span-4", "lg:col-span-4", "lg:col-span-4"];

function GameCard({
  game,
  index,
  hot,
  playing,
  resumable,
  onDiscard,
}: {
  game: GameMeta;
  index: number;
  hot?: boolean;
  playing: number;
  resumable: boolean;
  onDiscard: () => void;
}) {
  const open = useUiStore((s) => s.open);
  // Bỏ ván dở là thao tác phá huỷ: bấm lần 1 để xác nhận, tự huỷ sau 4 giây.
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  return (
    <article
      className={cn("group relative flex h-full min-h-0 animate-fade-up flex-col rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-2.5 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)] transition-colors duration-200 hover:border-white/30 sm:max-lg:[&:nth-child(odd):last-child]:col-span-2", RANK_SPAN[index] ?? "lg:col-span-4")}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <Link href={game.href} aria-label={`Chơi ${game.name}`} className="absolute inset-0 z-[1] rounded-[28px] outline-none focus-visible:ring-2 focus-visible:ring-white/60" />
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[20px] ring-1 ring-white/10">
        <GameCover game={game.id} className="transition duration-500 ease-lounge group-hover:scale-[1.04]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
          <span className="flex gap-1.5">
            {hot && (
              <Badge className="bg-white text-black">
                <Flame className="size-3" aria-hidden /> Hot
              </Badge>
            )}
            {resumable && (
              <Badge tone="accent" className="bg-ink-950/70 backdrop-blur">
                <span className="size-1.5 rounded-full bg-accent" /> Ván dở
              </Badge>
            )}
          </span>
          {playing > 0 && (
            <Badge className="bg-ink-950/70 backdrop-blur" aria-label={`${playing} người đang chơi`}>
              <span className="size-1.5 rounded-full bg-success" /> {playing} đang chơi
            </Badge>
          )}
        </div>
        <div className="absolute inset-x-4 bottom-4">
          <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight text-white drop-shadow">{game.name}</h3>
          <p className="mt-1 flex items-center gap-3 text-sm text-white/85">
            <span className="flex items-center gap-1 whitespace-nowrap"><Users className="size-3.5" aria-hidden />{game.players}</span>
            <span className="flex items-center gap-1 whitespace-nowrap"><Clock className="size-3.5" aria-hidden />{game.duration}</span>
          </p>
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-2.5 px-1 pb-0.5 pt-2.5">
        <GameIcon game={game.id} className="size-9 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm text-ink-200">{game.tagline}</span>
        {resumable &&
          (confirming ? (
            <button
              type="button"
              onClick={() => {
                onDiscard();
                setConfirming(false);
              }}
              onBlur={() => setConfirming(false)}
              autoFocus
              className="btn-danger btn-sm h-10"
            >
              Xoá ván?
            </button>
          ) : (
            <Tooltip content="Bỏ ván dở">
              <button type="button" onClick={() => setConfirming(true)} aria-label={`Bỏ ván dở ${game.name}`} className="icon-btn">
                <X className="size-4" />
              </button>
            </Tooltip>
          ))}
        <Tooltip content="Luật chơi">
          <button type="button" onClick={() => open("rules", { game: game.id })} aria-label={`Luật ${game.name}`} className="icon-btn">
            <BookOpen className="size-4" />
          </button>
        </Tooltip>
      </div>
    </article>
  );
}
