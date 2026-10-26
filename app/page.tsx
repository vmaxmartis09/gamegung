"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { Clock, Flame, Users } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { usePresenceStore, sortPeers } from "@/lib/presence";
import { useSessionStore, sessionsFor } from "@/lib/session-store";
import { GameCover, GameIcon, GAMES, GAME_BY_ID, GameMeta } from "@/components/art/game-art";
import { StatusIsland, type IslandTask } from "@/components/kokonut/status-island";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/reactbits";
import { JoinRoomBox } from "@/components/social/room-invite";

export default function HomePage() {
  const router = useRouter();
  const currentUserId = useAppStore((s) => s.currentUser.id);
  const peers = usePresenceStore((s) => s.peers);
  const peerList = useMemo(() => sortPeers(Object.values(peers)), [peers]);
  const rawSessions = useSessionStore((s) => s.sessions);

  const playing = (label: string) => peerList.filter((p) => p.status === "in-game" && p.currentGame === label).length;
  const inMatch = peerList.filter((p) => p.status === "in-game").length;

  // Độ phổ biến: người đang chơi (presence) + số ván mình đã chơi. Hoà điểm → xáo ngẫu nhiên mỗi lần tải.
  const myStats = useAppStore((s) => s.currentUser.stats) as unknown as Record<string, { games?: number } | undefined>;
  const jitter = useMemo(() => Object.fromEntries(GAMES.map((g) => [g.id, Math.random()])), []);
  // Lượt truy cập từng game trên máy này (đếm khi bấm vào thẻ).
  const [visits, setVisits] = useState<Record<string, number>>({});
  useEffect(() => setVisits(readVisits()), []);
  const ranked = useMemo(() => {
    const score = (g: GameMeta) => playing(g.name) * 10 + (myStats[g.id]?.games ?? 0) + (visits[g.id] ?? 0) + jitter[g.id] * 0.5;
    return [...GAMES].sort((a, b) => score(b) - score(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peers, myStats, jitter, visits]);
  // Bố cục ngẫu nhiên mỗi lần tải trang; ô to nhất dành cho game được truy cập / chơi nhiều nhất.
  const [layoutPick] = useState(() => Math.random());
  const layout = LAYOUTS[GAMES.length]?.[Math.floor(layoutPick * LAYOUTS[GAMES.length].length)];
  const placed = useMemo(() => {
    // Có sẵn bố cục cho 6 và 7 game; số khác thì chia đều.
    const spans = layout && ranked.length === layout.length ? layout : ranked.map(() => 4);
    const bySize = spans.map((sp, i) => ({ sp, i, r: Math.random() })).sort((a, b) => b.sp - a.sp || a.r - b.r);
    const out: { game: GameMeta; span: number }[] = new Array(spans.length);
    bySize.forEach((slot, k) => (out[slot.i] = { game: ranked[k], span: slot.sp }));
    return out.filter(Boolean);
  }, [layout, ranked]);
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

  // Màn hình lớn: sảnh vừa khít một màn hình, không cuộn trang.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      document.documentElement.style.overflow = mq.matches ? "hidden" : "";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      document.documentElement.style.overflow = "";
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col px-4 sm:px-6 lg:h-[calc(100dvh-6.5rem)] lg:overflow-hidden">
      {/* Floating "resume" island */}
      {tasks.length > 0 && (
        <div className="pointer-events-none sticky top-3 z-30 mb-2 flex justify-center">
          <div className="pointer-events-auto">
            <StatusIsland tasks={tasks} />
          </div>
        </div>
      )}

      <section className="relative flex flex-wrap items-center justify-center gap-x-6 gap-y-3 pb-4 pt-1 lg:pb-5">
        {/* Vào phòng bằng mã, ở chính giữa */}
        <JoinRoomBox className="w-full max-w-md" />
        <dl className="flex items-center gap-6 text-left lg:absolute lg:right-0 lg:top-1/2 lg:-translate-y-1/2">
          <Stat label="Môn" value={<CountUp value={GAMES.length} duration={1} />} />
          <Stat label="Online" value={<CountUp value={peerList.length + 1} duration={1.2} />} />
          {inMatch > 0 && <Stat label="Đang đấu" value={<CountUp value={inMatch} duration={1} />} />}
        </dl>
      </section>

      <section className="grid auto-rows-[260px] gap-3 sm:grid-cols-2 lg:min-h-0 lg:flex-1 lg:auto-rows-auto lg:grid-cols-12 lg:grid-rows-2">
        {placed.map(({ game: g, span }, i) => (
          <GameCard key={g.id} game={g} index={i} span={span} hot={g.id === hotId} playing={playing(g.name)} resumable={tasks.some((t) => t.id === g.id)} />
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

const VISITS_KEY = "oa-game-visits";
function readVisits(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(VISITS_KEY) || "{}");
  } catch {
    return {};
  }
}
function countVisit(id: string) {
  try {
    const v = readVisits();
    v[id] = (v[id] ?? 0) + 1;
    localStorage.setItem(VISITS_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

/**
 * Các kiểu xếp lưới 12 cột × 2 hàng (mỗi hàng cộng đủ 12), luôn vừa một màn hình.
 * Số là số cột mỗi thẻ chiếm, theo thứ tự trên lưới.
 */
const LAYOUTS: Record<number, number[][]> = {
  6: [
    [6, 3, 3, 4, 4, 4],
    [5, 4, 3, 3, 4, 5],
    [7, 5, 3, 3, 3, 3],
    [8, 4, 3, 3, 3, 3],
    [4, 4, 4, 6, 3, 3],
    [3, 6, 3, 4, 4, 4],
    [4, 8, 3, 3, 3, 3],
    [5, 7, 3, 3, 3, 3],
  ],
  7: [
    [4, 4, 4, 3, 3, 3, 3],
    [3, 3, 3, 3, 4, 4, 4],
    [6, 3, 3, 3, 3, 3, 3],
    [3, 6, 3, 3, 3, 3, 3],
    [5, 3, 4, 3, 3, 3, 3],
    [3, 3, 3, 3, 5, 4, 3],
  ],
};
const SPAN_CLASS: Record<number, string> = {
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
};

/** Thẻ game: chỉ ảnh và chữ trên ảnh; luật chơi xem bên trong game. */
function GameCard({
  game,
  index,
  span,
  hot,
  playing,
  resumable,
}: {
  game: GameMeta;
  index: number;
  span: number;
  hot?: boolean;
  playing: number;
  resumable: boolean;
}) {
  return (
    <Link
      href={game.href}
      aria-label={`Chơi ${game.name}`}
      onClick={() => countVisit(game.id)}
      className={cn("group relative block h-full min-h-0 animate-fade-up overflow-hidden rounded-[24px] ring-1 ring-white/10 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)] outline-none transition-[box-shadow] duration-200 hover:ring-white/30 focus-visible:ring-2 focus-visible:ring-white/60 sm:max-lg:[&:nth-child(odd):last-child]:col-span-2", SPAN_CLASS[span])}
      style={{ animationDelay: `${index * 60}ms` }}
    >
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
    </Link>
  );
}
