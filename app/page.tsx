"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { ArrowUpRight, BookOpen, Clock, Coins, Gift, Users, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { usePresenceStore, sortPeers } from "@/lib/presence";
import { useUiStore } from "@/lib/ui-store";
import { useSessionStore, sessionsFor } from "@/lib/session-store";
import { GameCover, GameIcon, GAMES, GAME_BY_ID, GameMeta } from "@/components/art/game-art";
import { UserAvatar, STATUS_META } from "@/components/ui/user-avatar";
import { StatusIsland, type IslandTask } from "@/components/kokonut/status-island";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 3600 * 1000;

function greetingFor(hour: number) {
  if (hour < 5) return "Chào buổi khuya";
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

export default function HomePage() {
  const router = useRouter();
  const user = useAppStore(
    useShallow((s) => ({
      id: s.currentUser.id,
      username: s.currentUser.username,
      avatar: s.currentUser.avatar,
      lua: s.currentUser.lua,
      lastDailyClaim: s.currentUser.lastDailyClaim,
      stats: s.currentUser.stats,
    }))
  );
  const myStatus = usePresenceStore((s) => s.myStatus);
  const peers = usePresenceStore((s) => s.peers);
  const peerList = useMemo(() => sortPeers(Object.values(peers)), [peers]);
  const open = useUiStore((s) => s.open);
  const claimDailyBonus = useAppStore((s) => s.claimDailyBonus);
  const rawSessions = useSessionStore((s) => s.sessions);
  const clearSession = useSessionStore((s) => s.clear);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  // Resolved after mount so server and client markup agree.
  const [greeting, setGreeting] = useState("Xin chào");
  useEffect(() => setGreeting(greetingFor(new Date().getHours())), []);

  const canClaim = !user.lastDailyClaim || Date.now() - user.lastDailyClaim > DAY_MS;
  const totalGames = Object.values(user.stats).reduce((a, s) => a + (s?.games ?? 0), 0);
  const totalWins = Object.values(user.stats).reduce((a, s) => a + (s?.wins ?? 0), 0);
  const winRate = totalGames > 0 ? `${Math.round((totalWins / totalGames) * 100)}%` : "—";
  const playing = (label: string) => peerList.filter((p) => p.status === "in-game" && p.currentGame === label).length;
  const inMatch = peerList.filter((p) => p.status === "in-game").length;

  const tasks: IslandTask[] = useMemo(
    () =>
      sessionsFor(user.id, rawSessions)
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
    [rawSessions, user.id, router]
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

      {/* Welcome + figures */}
      <section className="flex flex-col gap-6 border-b border-white/[0.075] pb-8 pt-2 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-4">
          <UserAvatar src={user.avatar} name={user.username} status={myStatus} className="size-14" />
          <div className="min-w-0">
            <p className="eyebrow">{greeting}</p>
            <h1 className="truncate font-display text-display-md font-medium sm:text-display-lg">
              <span className="italic text-accent-300">{user.username}</span>
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-ink-300">
              <span className={cn("size-1.5 rounded-full", STATUS_META[myStatus].dot)} aria-hidden />
              {STATUS_META[myStatus].label}
              {inMatch > 0 && <span className="text-ink-400">· {inMatch} người đang trong ván</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-stretch gap-3">
          <div className="panel flex divide-x divide-white/[0.075]">
            <FigureButton label="Credit" value={user.lua.toLocaleString("vi-VN")} icon={<Coins className="size-3.5" />} aria="Mở ví Credit" onClick={() => open("wallet")} />
            <FigureButton label="Thắng / Trận" value={`${totalWins} / ${totalGames}`} aria="Mở hồ sơ" onClick={() => open("profile")} />
            <FigureButton label="Tỉ lệ thắng" value={winRate} aria="Mở hồ sơ" onClick={() => open("profile")} />
          </div>
          {canClaim && (
            <Button
              variant="primary"
              className="self-stretch px-5"
              onClick={() => {
                const r = claimDailyBonus();
                setClaimMsg(r.success ? `+${r.amount.toLocaleString("vi-VN")} Credit` : r.message);
              }}
            >
              <Gift className="size-4" /> Nhận thưởng ngày
            </Button>
          )}
        </div>
      </section>
      <p role="status" aria-live="polite" className={cn("pt-3 text-sm text-accent-300", !claimMsg && "sr-only")}>
        {claimMsg}
      </p>

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

function FigureButton({ label, value, icon, aria, onClick }: { label: string; value: string; icon?: React.ReactNode; aria: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value}. ${aria}`}
      className="flex min-w-[7.5rem] flex-col gap-1.5 px-5 py-3.5 text-left transition-colors first:rounded-l-2xl last:rounded-r-2xl hover:bg-white/[0.04]"
    >
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-400">
        {icon}
        {label}
      </span>
      <span className="num text-2xl font-medium leading-none text-ink-100">{value}</span>
    </button>
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
