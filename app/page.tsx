"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { ArrowUpRight, BookOpen, Clock, Trophy, Users, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { usePresenceStore, sortPeers } from "@/lib/presence";
import { useUiStore } from "@/lib/ui-store";
import { useSessionStore, sessionsFor } from "@/lib/session-store";
import { GameCover, GameIcon, GAMES, GAME_BY_ID, GameMeta } from "@/components/art/game-art";
import { StatusIsland, type IslandTask } from "@/components/kokonut/status-island";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TextReveal3D, CountUp, BorderBeam } from "@/components/reactbits";

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
    <div className="mx-auto max-w-[1360px] px-4 sm:px-6">
      {/* Floating "resume" island */}
      {tasks.length > 0 && (
        <div className="pointer-events-none sticky top-3 z-30 mb-2 flex justify-center">
          <div className="pointer-events-auto">
            <StatusIsland tasks={tasks} />
          </div>
        </div>
      )}

      {/* Luxury Editorial Arena Header - Clean & Monochrome */}
      <section className="flex flex-col gap-6 border-b border-white/[0.08] pb-8 pt-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-400 mb-3">
            <span className="size-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)] shrink-0" />
            <TextReveal3D
              items={[
                "Office Arena · Private Lounge",
                "Typing Battle · Esports Realtime",
                "Cờ Vua & Cờ Tướng · Chuẩn Quốc Tế",
                "Ma Sói & Uno · Đấu Trí Đỉnh Cao",
              ]}
              interval={3200}
              cylinderRadius={20}
              className="h-4 w-72"
              itemClassName="text-[11px] font-mono tracking-[0.16em] text-neutral-300"
            />
          </div>
          <h1 className="font-display text-3xl font-light tracking-tight text-white sm:text-4xl lg:text-5xl">
            Đấu Trường <span className="italic font-normal text-white">Nghỉ Trưa</span>
          </h1>
          <p className="mt-2 text-sm text-neutral-400 max-w-xl leading-relaxed">
            Không gian thi đấu trí tuệ và giải trí văn phòng chuẩn quốc tế. Cờ vua, cờ tướng, ma sói và các môn giải trí đối kháng realtime.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="panel flex divide-x divide-white/[0.08] bg-black/60 border border-white/10">
            <div className="flex min-w-[6.5rem] flex-col gap-1 px-4 py-3 text-left">
              <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-400">Danh mục</span>
              <span className="num text-xl font-medium text-white">
                <CountUp value={GAMES.length} duration={1} /> môn
              </span>
            </div>
            <div className="flex min-w-[6.5rem] flex-col gap-1 px-4 py-3 text-left">
              <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-400">Trực tuyến</span>
              <span className="num text-xl font-medium text-white">
                <CountUp value={peerList.length + 1} duration={1.2} /> người
              </span>
            </div>
            {inMatch > 0 && (
              <div className="flex min-w-[6.5rem] flex-col gap-1 px-4 py-3 text-left">
                <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-400">Đang đấu</span>
                <span className="num text-xl font-medium text-white">
                  <CountUp value={inMatch} duration={1} /> bàn
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => open("ranking")}
            className="group relative btn border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.1] hover:border-white/30 text-xs px-4 py-3 rounded-2xl flex items-center gap-2 self-stretch overflow-hidden shadow-lg transition-all"
          >
            <BorderBeam size={90} duration={8} colorFrom="#ffffff" colorTo="transparent" />
            <Trophy className="size-4 text-amber-300" /> Xếp hạng
          </button>
        </div>
      </section>

      {/* Games */}
      <section className="pt-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-medium tracking-tight">Phòng chơi</h2>
          <p className="text-sm text-ink-400">{GAMES.length} trò chơi</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GAMES.map((g, i) => (
            <GameCard
              key={g.id}
              game={g}
              index={i}
              playing={playing(g.name)}
              resumable={tasks.some((t) => t.id === g.id)}
              onDiscard={() => clearSession(g.id)}
              featured={i < 2}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function GameCard({
  game,
  index,
  playing,
  resumable,
  onDiscard,
  featured,
}: {
  game: GameMeta;
  index: number;
  playing: number;
  resumable: boolean;
  onDiscard: () => void;
  featured?: boolean;
}) {
  const open = useUiStore((s) => s.open);
  return (
    <article
      className={cn(
        "group panel relative flex animate-fade-up flex-col overflow-hidden transition-[border-color,background-color] duration-200 ease-standard hover:border-white/20 hover:bg-ink-850/80",
        featured && "sm:col-span-2"
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {featured && (
        <BorderBeam size={280} duration={12} colorFrom="#38bdf8" colorTo="transparent" />
      )}
      <div className={cn("relative overflow-hidden", featured ? "aspect-[16/7]" : "aspect-[16/10]")}>
        {/* Interim toning until the covers are redrawn (Phase 3) */}
        <GameCover game={game.id} className="saturate-[0.45] brightness-[0.8] transition duration-500 ease-lounge group-hover:scale-[1.03] group-hover:saturate-[0.6]" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/10 to-transparent" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
          {resumable ? (
            <Badge tone="accent" className="bg-ink-950/70 backdrop-blur">
              <span className="size-1.5 rounded-full bg-accent" /> Ván dở
            </Badge>
          ) : (
            <span />
          )}
          {playing > 0 && (
            <Badge className="bg-ink-950/70 backdrop-blur">
              <span className="size-1.5 rounded-full bg-success" /> {playing} đang chơi
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <GameIcon game={game.id} className="size-9 shrink-0" />
            <div className="min-w-0">
              <h3 className="truncate font-display text-xl font-medium leading-tight tracking-tight">
                {/* The stretched link makes the whole card clickable without nesting buttons in an anchor. */}
                <Link href={game.href} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-accent/60">
                  {game.name}
                </Link>
              </h3>
              <p className="text-xs text-ink-400">{game.mode}</p>
            </div>
          </div>
          <ArrowUpRight className="mt-1 size-4 shrink-0 text-ink-400 transition-[color,transform] duration-200 ease-lounge group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden />
        </div>

        <p className="line-clamp-2 text-sm leading-relaxed text-ink-300">{game.tagline}</p>

        <div className="mt-auto flex items-center gap-3 pt-1 text-xs text-ink-400">
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden /> <span className="sr-only">Số người:</span>
            {game.players}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden /> <span className="sr-only">Thời lượng:</span>
            {game.duration}
          </span>
          <span className="relative z-10 ml-auto flex items-center gap-0.5">
            {resumable && (
              <Tooltip content="Bỏ ván dở">
                <button type="button" onClick={onDiscard} aria-label={`Bỏ ván dở ${game.name}`} className="grid size-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-white/[0.06] hover:text-ink-100">
                  <X className="size-4" />
                </button>
              </Tooltip>
            )}
            <Tooltip content="Luật chơi">
              <button type="button" onClick={() => open("rules", { game: game.id })} aria-label={`Luật ${game.name}`} className="grid size-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-white/[0.06] hover:text-ink-100">
                <BookOpen className="size-4" />
              </button>
            </Tooltip>
          </span>
        </div>
      </div>
    </article>
  );
}
