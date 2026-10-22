"use client";

import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownUp, Code2, Coffee, Crown, Hand, Heart, Layers, Megaphone, PenTool, Play, Repeat, RotateCcw, Shuffle, Siren, TrendingUp } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/lib/store";
import { soundManager } from "@/lib/audio";
import {
  Card,
  DState,
  Dept,
  DEPTS,
  DEPT_INFO,
  KIND_LABEL,
  botChoose,
  callChot,
  canChain,
  canPlay,
  catchChot,
  matchOver,
  newRound,
  pass,
  play,
  takeDraw,
  top,
} from "@/lib/games/deadline-engine";
import { UserAvatar } from "@/components/ui/user-avatar";
import TextLoading from "@/components/kokonut/text-loading";
import { cn } from "@/lib/utils";
import { MatchResultModal } from "./match-result-modal";
import { GameHeader, Segmented, StakePicker, useGameSession, useMatchSettlement } from "./shared";

const DEPT_ICON: Record<Dept, typeof Code2> = { tech: Code2, sales: TrendingUp, hr: Heart, design: PenTool };
const TURN_MS = 25_000;
const BOTS = [
  { name: "Sếp Tổng", seed: "sep tong:3" },
  { name: "Linh HR", seed: "linh hr:1" },
  { name: "Tuấn Dev", seed: "tuan dev:2" },
];

/* ---------------------------------- Card ---------------------------------- */

export const DCard = memo(function DCard({
  card,
  size = "md",
  playable,
  selected,
  faceDown,
  onClick,
  onDoubleClick,
}: {
  card?: Card;
  size?: "sm" | "md" | "lg";
  playable?: boolean;
  selected?: boolean;
  faceDown?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}) {
  const dims = size === "sm" ? "w-9 h-[52px] rounded-lg" : size === "lg" ? "w-28 h-40 sm:w-32 sm:h-[180px] rounded-2xl" : "w-[72px] h-[104px] sm:w-[84px] sm:h-[120px] rounded-xl";
  if (faceDown || !card) {
    return (
      <div className={cn(dims, "relative shrink-0 overflow-hidden border-2 border-white/15 bg-ink-800 shadow-[0_6px_14px_-6px_rgba(0,0,0,0.8)]")}>
        <div className="absolute inset-1.5 rounded-[inherit] border border-white/10 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.05)_0_6px,transparent_6px_12px)]" />
        {size !== "sm" && <span className="absolute inset-0 grid place-items-center font-display text-xs font-black tracking-widest text-white/40">DL</span>}
      </div>
    );
  }
  const wild = !card.dept;
  const tone = wild ? "#09090b" : DEPT_INFO[card.dept!].tone;
  const ink = wild ? "#fafafa" : DEPT_INFO[card.dept!].ink;
  const Icon = card.dept ? DEPT_ICON[card.dept] : null;
  const center =
    card.kind === "num" ? (
      <span className="font-display font-black leading-none" style={{ fontSize: size === "lg" ? 72 : size === "sm" ? 18 : 44 }}>
        {card.value}
      </span>
    ) : card.kind === "plus2" ? (
      <span className="font-display font-black leading-none" style={{ fontSize: size === "lg" ? 56 : 32 }}>+2</span>
    ) : card.kind === "plus4" ? (
      <span className="flex flex-col items-center">
        <Crown className={size === "lg" ? "size-10" : "size-5"} />
        <span className="font-display font-black leading-none" style={{ fontSize: size === "lg" ? 48 : 26 }}>+4</span>
      </span>
    ) : card.kind === "skip" ? (
      <Coffee className={size === "lg" ? "size-16" : "size-9"} />
    ) : card.kind === "reverse" ? (
      <Repeat className={size === "lg" ? "size-16" : "size-9"} />
    ) : (
      <Shuffle className={size === "lg" ? "size-16" : "size-9"} />
    );
  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      disabled={!onClick}
      aria-label={card.kind === "num" ? `${DEPT_INFO[card.dept!].name} ${card.value}` : `${KIND_LABEL[card.kind]}${card.dept ? ` ${DEPT_INFO[card.dept].name}` : ""}`}
      className={cn(
        dims,
        "relative shrink-0 select-none overflow-hidden border-2 text-left shadow-[0_8px_18px_-8px_rgba(0,0,0,0.9)] transition-transform duration-150",
        wild ? "border-white/40" : "border-black/40",
        onClick && playable && "hover:-translate-y-3",
        selected && "-translate-y-5 ring-4 ring-white ring-offset-2 ring-offset-ink-950",
        onClick && playable === false && "opacity-45 saturate-0"
      )}
      style={{ background: wild ? "conic-gradient(from 45deg,#fafafa,#c8c8ce,#6b6b74,#26262b,#fafafa)" : tone, color: ink }}
    >
      {wild && <span className="absolute inset-[18%] rounded-full bg-ink-950" />}
      <span className="absolute left-1.5 top-1 flex flex-col items-center leading-none" style={{ color: wild ? "#09090b" : ink }}>
        {size !== "sm" && <span className="text-xs font-black">{card.kind === "num" ? card.value : card.kind === "plus2" ? "+2" : card.kind === "plus4" ? "+4" : ""}</span>}
        {Icon && size !== "sm" && <Icon className="mt-0.5 size-3" />}
      </span>
      <span className="relative grid h-full w-full place-items-center" style={{ color: wild ? "#fafafa" : ink }}>
        {center}
      </span>
      {size === "lg" && card.kind !== "num" && (
        <span className="absolute inset-x-0 bottom-2 text-center text-[10px] font-black uppercase tracking-wider" style={{ color: wild ? "#09090b" : ink }}>
          {KIND_LABEL[card.kind]}
        </span>
      )}
    </button>
  );
});

/* ---------------------------------- Game ---------------------------------- */

interface Save {
  state: DState;
  stake: number;
}

export function DeadlineGame() {
  const me = useAppStore(useShallow((s) => ({ id: s.currentUser.id, username: s.currentUser.username, avatar: s.currentUser.avatar })));
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const { settle, reset: resetSettlement, result, open: resultOpen, setOpen: setResultOpen } = useMatchSettlement("uno");
  const session = useGameSession<Save>("uno");

  const [count, setCount] = useState<2 | 3 | 4>(4);
  const [target, setTarget] = useState<0 | 250>(0);
  const [stake, setStake] = useState(0);
  const sRef = useRef<DState | null>(null);
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const s = sRef.current;
  const [selected, setSelected] = useState<string[]>([]);
  const [choosing, setChoosing] = useState<string[] | null>(null);
  const [turnStart, setTurnStart] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [flash, setFlash] = useState<string | null>(null);

  const commit = useCallback((next: DState | null) => {
    sRef.current = next;
    rerender();
  }, []);
  const mutate = useCallback(
    (fn: (d: DState) => void) => {
      if (!sRef.current) return;
      const d = structuredClone(sRef.current);
      fn(d);
      commit(d);
    },
    [commit]
  );
  const sfx = useCallback(
    (k: "play" | "draw" | "shout" | "wild" | "win") => {
      if (!soundEnabled) return;
      if (k === "play") soundManager.playCardPlay();
      else if (k === "draw") soundManager.playCardDraw();
      else if (k === "shout") soundManager.playUnoShout();
      else if (k === "wild") soundManager.playWildColor();
      else soundManager.playVictory();
    },
    [soundEnabled]
  );
  const toast = useCallback((t: string) => {
    setFlash(t);
    setTimeout(() => setFlash((f) => (f === t ? null : f)), 1800);
  }, []);

  useEffect(() => {
    const st = parseInt(new URLSearchParams(window.location.search).get("stake") || "", 10);
    if (st > 0) setStake(st);
    const saved = session.load();
    if (saved && !matchOver(saved.payload.state)) {
      commit(saved.payload.state);
      setStake(saved.payload.stake);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!s) return;
    if (s.winner !== null && matchOver(s)) return session.clear();
    const mine = s.players[0];
    session.save(
      { state: s, stake },
      { label: `Ván ${s.round} · còn ${mine.hand.length} lá`, detail: `${s.players.length} người${s.target ? ` · đến ${s.target} điểm` : ""}`, progress: Math.max(0, 1 - mine.hand.length / 10) }
    );
  }, [s, stake, session]);

  const start = () => {
    resetSettlement();
    setSelected([]);
    const players = [
      { id: me.id, name: me.username, avatar: me.avatar, bot: false, score: 0 },
      ...BOTS.slice(0, count - 1).map((b, i) => ({ id: `bot-${i}`, name: b.name, avatar: `kokonut:${b.seed}`, bot: true, score: 0 })),
    ];
    commit(newRound(players, target));
    setTurnStart(Date.now());
  };

  const nextRound = () => {
    if (!s) return;
    const starter = s.winner ?? 0;
    commit(newRound(s.players.map(({ hand: _h, called: _c, ...p }) => p), s.target, s.round + 1, starter));
    setSelected([]);
    setTurnStart(Date.now());
  };

  const myTurn = !!s && s.winner === null && s.turn === 0;
  const hand = s?.players[0].hand ?? [];
  const playableIds = useMemo(() => new Set(s && myTurn ? hand.filter((c) => (s.drawnId ? c.id === s.drawnId : canPlay(s, c))).map((c) => c.id) : []), [s, myTurn, hand]);

  // Turn changes reset timer + selection.
  useEffect(() => {
    setTurnStart(Date.now());
    setSelected([]);
  }, [s?.turn, s?.round]);

  // Bot turns.
  useEffect(() => {
    if (!s || s.winner !== null) return;
    const p = s.players[s.turn];
    if (!p.bot) return;
    const t = setTimeout(() => {
      mutate((d) => {
        const who = d.turn;
        // Catch the human who forgot to call.
        if (d.vulnerable === 0 && Math.random() < 0.75) {
          catchChot(d, who);
          toast(`${d.players[who].name} bắt lỗi bạn quên CHỐT! +2 lá`);
        }
        const choice = d.drawnId ? { ids: [d.drawnId], dept: undefined as Dept | undefined } : botChoose(d, who);
        if (choice && (d.drawnId || canPlay(d, d.players[who].hand.find((c) => c.id === choice.ids[0])!))) {
          const card = d.players[who].hand.find((c) => c.id === choice.ids[0])!;
          const remaining = d.players[who].hand.length - choice.ids.length;
          if (remaining === 1 && Math.random() < 0.85) callChot(d, who);
          const dept = card.dept ? undefined : choice.dept ?? DEPTS[Math.floor(Math.random() * 4)];
          play(d, who, choice.ids, dept);
        } else {
          const r = takeDraw(d, who);
          if (!r.penalty && d.drawnId) {
            const card = d.players[who].hand.find((c) => c.id === d.drawnId)!;
            const dept = card.dept ? undefined : botChoose(d, who)?.dept ?? "tech";
            play(d, who, [card.id], dept);
          }
        }
      });
      sfx("play");
    }, 850 + Math.random() * 600);
    return () => clearTimeout(t);
  }, [s, mutate, sfx, toast]);

  // Human turn timer.
  useEffect(() => {
    if (!myTurn) return;
    const i = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(i);
  }, [myTurn]);
  useEffect(() => {
    if (myTurn && now - turnStart > TURN_MS) {
      mutate((d) => {
        if (d.drawnId) pass(d, 0);
        else takeDraw(d, 0);
        if (d.turn === 0 && d.drawnId) pass(d, 0);
      });
      toast("Hết giờ — tự động rút bài");
    }
  }, [now, turnStart, myTurn, mutate, toast]);

  // Settlement when the match ends.
  useEffect(() => {
    if (!s || !matchOver(s)) return;
    if (s.winner === 0) sfx("win");
    settle(s.winner === 0 ? "win" : "loss", { name: "Bàn Deadline Rush", elo: 1250 }, stake);
  }, [s?.winner, s?.round]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------------ Human input ------------------------------ */

  const onCard = (c: Card) => {
    if (!s || !myTurn) return;
    if (selected.includes(c.id)) return setSelected((sel) => sel.filter((x) => x !== c.id));
    const first = hand.find((h) => h.id === selected[0]);
    if (first && canChain(first, c)) return setSelected((sel) => [...sel, c.id]);
    if (playableIds.has(c.id)) setSelected([c.id]);
  };

  const playSelected = (ids = selected) => {
    if (!s || !ids.length) return;
    const first = hand.find((c) => c.id === ids[0])!;
    if (!first.dept) return setChoosing(ids);
    mutate((d) => play(d, 0, ids));
    setSelected([]);
    sfx("play");
  };

  const chooseDept = (dept: Dept) => {
    if (!choosing) return;
    mutate((d) => play(d, 0, choosing, dept));
    setChoosing(null);
    setSelected([]);
    sfx("wild");
  };

  const humanDraw = () => {
    if (!myTurn) return;
    mutate((d) => {
      if (d.drawnId) pass(d, 0);
      else takeDraw(d, 0);
    });
    sfx("draw");
  };

  /* --------------------------------- Render --------------------------------- */

  if (!s) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        <GameHeader game="uno" subtitle="Game bài đẩy việc · 2–4 người" />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="panel p-6">
            <div className="flex flex-wrap justify-center gap-3 py-4">
              {[
                { id: "a", dept: "tech", kind: "num", value: 7 },
                { id: "b", dept: "sales", kind: "plus2", value: 0 },
                { id: "c", dept: "hr", kind: "skip", value: 0 },
                { id: "d", dept: "design", kind: "reverse", value: 0 },
                { id: "e", dept: null, kind: "plus4", value: 0 },
              ].map((c, i) => (
                <div key={c.id} style={{ transform: `rotate(${(i - 2) * 7}deg) translateY(${Math.abs(i - 2) * 6}px)` }}>
                  <DCard card={c as Card} />
                </div>
              ))}
            </div>
            <ul className="mt-4 grid gap-2 text-sm text-ink-200 sm:grid-cols-2">
              <Rule icon={<Layers className="size-4" />} text="Cùng phòng ban hoặc cùng số/chức năng" />
              <Rule icon={<span className="text-xs font-black">7·7</span>} text="Đánh nhiều lá cùng số một lúc" />
              <Rule icon={<span className="text-xs font-black">+2</span>} text="+2/+4 chồng lên nhau để đẩy phạt" />
              <Rule icon={<Coffee className="size-4" />} text="Nghỉ phép: người kế mất lượt" />
              <Rule icon={<Repeat className="size-4" />} text="Đổi ca: đảo chiều vòng chơi" />
              <Rule icon={<Megaphone className="size-4" />} text="Còn 1 lá phải hô CHỐT!" />
            </ul>
          </div>
          <div className="panel space-y-4 p-6">
            <div>
              <span className="label">Người chơi</span>
              <Segmented value={count} onChange={setCount} options={[{ value: 2 as const, label: "2" }, { value: 3 as const, label: "3" }, { value: 4 as const, label: "4" }]} />
            </div>
            <div>
              <span className="label">Thể thức</span>
              <Segmented value={target} onChange={setTarget} options={[{ value: 0 as const, label: "1 ván" }, { value: 250 as const, label: "Đến 250 điểm" }]} />
            </div>
            <StakePicker value={stake} onChange={setStake} />
            <button type="button" className="btn-lime w-full py-3" onClick={start}>
              <Play className="size-4" /> Chia bài
            </button>
          </div>
        </div>
      </div>
    );
  }

  const topCard = top(s);
  const opponents = s.players.slice(1);
  const curPlayer = s.players[s.turn];
  const remainingMs = Math.max(0, TURN_MS - (now - turnStart));
  const mustChot = myTurn && hand.length === 2 && !s.players[0].called;
  const DeptIcon = DEPT_ICON[s.dept];
  const roundOver = s.winner !== null;
  const over = matchOver(s);

  return (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
      <GameHeader game="uno" subtitle={`Ván ${s.round}${s.target ? ` · đến ${s.target}` : ""}`}>
        {stake > 0 && <span className="chip">{stake} 🌾</span>}
      </GameHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="panel relative flex min-h-[calc(100vh-11rem)] flex-col justify-between overflow-hidden p-4 sm:p-6">
          {/* Opponents */}
          <div className="flex flex-wrap justify-center gap-3 sm:gap-6">
            {opponents.map((p, i) => {
              const idx = i + 1;
              const active = s.turn === idx && !roundOver;
              return (
                <div key={p.id} className={cn("flex min-w-[150px] items-center gap-3 rounded-3xl border p-2.5 pr-4 transition-colors", active ? "border-white bg-white/[0.08]" : "border-white/10 bg-white/[0.02]")}>
                  <div className="relative">
                    <UserAvatar src={p.avatar} name={p.name} className={cn("size-11", active && "ring-2 ring-white")} />
                    {p.hand.length === 1 && <span className="absolute -right-2 -top-2 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black text-black">{p.called ? "CHỐT" : "1!"}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{p.name}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <div className="flex -space-x-6">
                        {Array.from({ length: Math.min(p.hand.length, 7) }).map((_, k) => (
                          <DCard key={k} faceDown size="sm" />
                        ))}
                      </div>
                      <span className="ml-1 font-mono text-xs text-ink-300">{p.hand.length}</span>
                      {s.target > 0 && <span className="ml-1 font-mono text-[11px] text-ink-400">· {p.score}đ</span>}
                    </div>
                    {active && !p.bot ? null : active && <TextLoading className="mt-0.5 text-[11px] text-ink-300" texts={["Đang tính…", "Soi bài…", "Sắp đánh…"]} />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Center table */}
          <div className="my-6 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            <button type="button" onClick={humanDraw} disabled={!myTurn} className="relative transition-transform enabled:hover:-translate-y-1 disabled:opacity-60" aria-label={s.pending ? `Nhận ${s.pending} lá phạt` : "Rút bài"}>
              <div className="absolute left-1.5 top-1.5">
                <DCard faceDown size="lg" />
              </div>
              <div className="absolute left-0.5 top-0.5">
                <DCard faceDown size="lg" />
              </div>
              <DCard faceDown size="lg" />
              <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink-900 px-2 py-0.5 font-mono text-[11px] text-ink-300 ring-1 ring-white/10">{s.draw.length}</span>
            </button>

            <div className="relative">
              <AnimatePresence mode="popLayout">
                <motion.div key={topCard.id} initial={{ y: -40, rotate: -12, scale: 0.8, opacity: 0 }} animate={{ y: 0, rotate: (topCard.id.charCodeAt(2) % 9) - 4, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 380, damping: 26 }}>
                  <DCard card={topCard} size="lg" />
                </motion.div>
              </AnimatePresence>
              {s.pending > 0 && (
                <span className="absolute -right-4 -top-4 grid size-12 place-items-center rounded-full bg-pop-red font-display text-lg font-black text-white ring-4 ring-ink-900">+{s.pending}</span>
              )}
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="grid size-16 place-items-center rounded-2xl border-2 border-black/30 shadow-lg" style={{ background: DEPT_INFO[s.dept].tone, color: DEPT_INFO[s.dept].ink }} title={`Phòng ban hiện tại: ${DEPT_INFO[s.dept].name}`}>
                <DeptIcon className="size-8" />
              </div>
              <span className="text-xs font-bold">{DEPT_INFO[s.dept].name}</span>
              <span className={cn("grid size-8 place-items-center rounded-full bg-white/[0.06] transition-transform", s.dir === -1 && "-scale-x-100")} title="Chiều vòng chơi">
                <RotateCcw className="size-4" />
              </span>
            </div>
          </div>

          {/* Status line */}
          <div className="mb-3 flex min-h-[40px] flex-wrap items-center justify-center gap-2">
            {roundOver ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-2 font-bold text-black">
                🏁 {s.players[s.winner!].name} hết bài!
                {!over && (
                  <button type="button" className="rounded-xl bg-black px-3 py-1 text-sm text-white" onClick={nextRound}>
                    Ván tiếp
                  </button>
                )}
                {over && (
                  <button type="button" className="rounded-xl bg-black px-3 py-1 text-sm text-white" onClick={() => commit(null)}>
                    Bàn mới
                  </button>
                )}
              </div>
            ) : myTurn ? (
              <>
                <span className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-black">Lượt bạn</span>
                <span className="relative h-1.5 w-28 overflow-hidden rounded-full bg-white/10" title="Thời gian lượt">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-white transition-[width] duration-500" style={{ width: `${(remainingMs / TURN_MS) * 100}%` }} />
                </span>
              </>
            ) : (
              <span className="flex items-center gap-2 text-sm text-ink-300">
                <UserAvatar src={curPlayer.avatar} name={curPlayer.name} className="size-6" /> {curPlayer.name} đang đánh…
              </span>
            )}
            {flash && <span className="rounded-full bg-pop-red px-3 py-1.5 text-sm font-bold text-white">{flash}</span>}
          </div>

          {/* My hand */}
          <div className="relative">
            <div className="flex justify-center overflow-x-auto px-6 pb-2 pt-6 no-scrollbar">
              <div className="flex">
                {hand.map((c, i) => (
                  <motion.div key={c.id} layout initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={i > 0 ? "-ml-6 sm:-ml-5" : ""} style={{ zIndex: i }}>
                    <DCard
                      card={c}
                      playable={myTurn ? playableIds.has(c.id) || (!!selected[0] && canChain(hand.find((h) => h.id === selected[0])!, c)) : undefined}
                      selected={selected.includes(c.id)}
                      onClick={myTurn ? () => onCard(c) : undefined}
                      onDoubleClick={myTurn && playableIds.has(c.id) ? () => playSelected([c.id]) : undefined}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button type="button" className="btn-lime" disabled={!myTurn || !selected.length} onClick={() => playSelected()}>
              <Play className="size-4" /> Đánh{selected.length > 1 ? ` ${selected.length} lá` : ""}
            </button>
            <button type="button" className="btn-ghost" disabled={!myTurn} onClick={humanDraw}>
              {s.drawnId ? <Hand className="size-4" /> : <ArrowDownUp className="size-4" />}
              {s.drawnId ? "Giữ lá" : s.pending ? `Nhận +${s.pending}` : "Rút"}
            </button>
            <button
              type="button"
              className={cn("btn-ghost", mustChot && "animate-pulse border-white bg-white text-black hover:bg-white")}
              disabled={!(mustChot || s.vulnerable === 0)}
              onClick={() => {
                mutate((d) => callChot(d, 0));
                sfx("shout");
              }}
            >
              <Megaphone className="size-4" /> CHỐT!
            </button>
            {s.vulnerable !== null && s.vulnerable !== 0 && (
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  mutate((d) => catchChot(d, 0));
                  sfx("shout");
                }}
              >
                <Siren className="size-4" /> Bắt lỗi {s.players[s.vulnerable].name}
              </button>
            )}
          </div>

          {/* Department chooser */}
          <AnimatePresence>
            {choosing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 grid place-items-center bg-black/70 backdrop-blur-sm" onClick={() => setChoosing(null)}>
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="panel p-5" onClick={(e) => e.stopPropagation()}>
                  <p className="mb-3 text-center font-display text-lg font-bold">Chuyển sang phòng nào?</p>
                  <div className="grid grid-cols-2 gap-3">
                    {DEPTS.map((d) => {
                      const I = DEPT_ICON[d];
                      const n = hand.filter((c) => c.dept === d).length;
                      return (
                        <button key={d} type="button" onClick={() => chooseDept(d)} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-black/30 px-6 py-4 font-bold transition-transform hover:-translate-y-1" style={{ background: DEPT_INFO[d].tone, color: DEPT_INFO[d].ink }}>
                          <I className="size-7" />
                          {DEPT_INFO[d].name}
                          <span className="text-[11px] opacity-70">{n} lá</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Side: scores + log */}
        <aside className="space-y-3">
          <div className="panel p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-400">Bảng điểm</p>
            {s.players.map((p, i) => (
              <div key={p.id} className={cn("flex items-center gap-2 rounded-xl px-2 py-1.5", s.turn === i && !roundOver && "bg-white/[0.06]")}>
                <UserAvatar src={p.avatar} name={p.name} className="size-7" />
                <span className="min-w-0 flex-1 truncate text-sm">{i === 0 ? "Bạn" : p.name}</span>
                <span className="font-mono text-xs text-ink-300">{p.hand.length} lá</span>
                <span className="w-10 text-right font-mono text-sm font-bold">{p.score}</span>
              </div>
            ))}
          </div>
          <div className="panel p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-400">Diễn biến</p>
            <div className="max-h-[42vh] space-y-1 overflow-y-auto text-[12px] text-ink-300">
              {[...s.log].reverse().map((l, i) => (
                <p key={i} className={i === 0 ? "text-white" : ""}>
                  {l}
                </p>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <MatchResultModal isOpen={resultOpen} onClose={() => setResultOpen(false)} onPlayAgain={() => commit(null)} resultData={result} reason={s.winner === 0 ? "Bạn chốt đơn sạch bài!" : `${s.players[s.winner ?? 0].name} hết bài trước`} />
    </div>
  );
}

function Rule({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-black">{icon}</span>
      {text}
    </li>
  );
}

export default DeadlineGame;
