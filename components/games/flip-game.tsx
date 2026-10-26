"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flag, LogOut, Play } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/lib/store";
import { soundManager } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { describeEnd, openBetMatch, opponentOf, slotOf, useOnlineMatch } from "@/lib/online-match";
import { currentRound, rejoinTable, roomOf, useBetRounds } from "@/lib/bet-rounds";
import { Button } from "@/components/ui/button";
import { Emoji, EmojiText } from "@/components/ui/emoji";
import { MatchResultModal } from "./match-result-modal";
import { NarratorButton, useNarrator } from "./game-fx";
import { BetLobby, type BetOpp } from "./bet-lobby";
import { ConfirmDialog, GameHeader, InviteSender, OnlineStatus, PlayerCard, Segmented, StakePicker, useFriendBet, useMatchOpponent, useMatchSettlement, useToast, waitForBetOpponent } from "./shared";

const COLS = 6;
const ROWS = 4;
const RESOLVE_MS = 850;
/** Nhịp phát lại lượt của đối thủ: lật thẻ thứ hai sau, lượt kế tiếp sau khi thẻ đã úp/ghép xong. */
const REPLAY_SECOND_MS = 650;
const REPLAY_GAP_MS = 450;
const COMBO_BONUS = 1;
const GOLD_VALUE = 3;
const NO_CLOCK_MS = 24 * 3600 * 1000;

type Level = "easy" | "medium" | "hard";
type Seat = 0 | 1; // 0 = bạn / bên đi trước, 1 = AI / bên đi sau

const LEVELS: Record<Level, { label: string; elo: number; memory: number }> = {
  easy: { label: "Dễ", elo: 900, memory: 0.3 },
  medium: { label: "Vừa", elo: 1200, memory: 0.7 },
  hard: { label: "Khó", elo: 1500, memory: 0.96 },
};

interface Settings {
  mode: "friend" | "ai" | "local";
  level: Level;
  ranked: boolean;
}
const DEFAULTS: Settings = { mode: "friend", level: "medium", ranked: true };

/** 10 cặp thường + 2 cặp vàng (3 điểm). Mọi emoji đều vẽ qua <Emoji>. */
const FACES: { e: string; name: string }[] = [
  { e: "☕", name: "cà phê" },
  { e: "🚀", name: "tên lửa" },
  { e: "🔥", name: "ngọn lửa" },
  { e: "🎯", name: "bia ngắm" },
  { e: "📎", name: "kẹp giấy" },
  { e: "⚡", name: "tia chớp" },
  { e: "👻", name: "bóng ma" },
  { e: "🌈", name: "cầu vồng" },
  { e: "🧪", name: "ống nghiệm" },
  { e: "🎮", name: "tay cầm" },
  { e: "🏆", name: "cúp vàng" },
  { e: "💎", name: "kim cương" },
];
const GOLD_FROM = 10;
const faceValue = (face: number) => (face >= GOLD_FROM ? GOLD_VALUE : 1);

interface Card {
  face: number;
  status: "down" | "up" | "done";
  by?: Seat;
}

interface Pair {
  a: number;
  b: number;
  by: Seat;
  match: boolean;
}

interface Game {
  cards: Card[];
  first: number | null;
  second: number | null;
  turn: Seat;
  scores: [number, number];
  streak: number;
  /** Số thẻ đã lật / số lần chấm cặp: dùng làm khoá cho các hiệu ứng. */
  flips: number;
  resolves: number;
  lastFlip: number | null;
  lastPair: Pair | null;
  over: boolean;
  winner: Seat | "draw" | null;
  reason: string;
}

type Action =
  | { type: "start"; cards: Card[]; turn: Seat }
  | { type: "load"; game: Game }
  | { type: "flip"; idx: number }
  | { type: "resolve" }
  | { type: "end"; winner: Seat | "draw"; reason: string };

/** Một nước đi online = cả lượt của một người: các cặp [thẻ 1, thẻ 2] họ lật liên tiếp (ghép đúng thì được lật tiếp). */
type Turn = [number, number][];

function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function seededRandom(seed: string) {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Xáo bộ bài; ván online dùng id bàn làm hạt giống nên hai máy có cùng bộ bài. */
function shuffled(rand: () => number = Math.random): Card[] {
  const cards: Card[] = FACES.flatMap((_, face) => [
    { face, status: "down" as const },
    { face, status: "down" as const },
  ]);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

const IDLE: Game = { cards: [], first: null, second: null, turn: 0, scores: [0, 0], streak: 0, flips: 0, resolves: 0, lastFlip: null, lastPair: null, over: false, winner: null, reason: "" };

/** Tối đa điểm còn có thể ghi trong phần thẻ chưa ghép (cặp + thưởng chuỗi). */
function remainingPotential(cards: Card[]) {
  const left = new Set(cards.filter((c) => c.status !== "done").map((c) => c.face));
  let sum = 0;
  left.forEach((f) => (sum += faceValue(f) + COMBO_BONUS));
  return sum;
}

function reduce(g: Game, a: Action): Game {
  switch (a.type) {
    case "start":
      return { ...IDLE, cards: a.cards, turn: a.turn };
    case "load":
      return a.game;
    case "flip": {
      if (g.over || g.second !== null || g.cards[a.idx]?.status !== "down") return g;
      const cards = g.cards.map((c, i) => (i === a.idx ? { ...c, status: "up" as const } : c));
      const base = { ...g, cards, flips: g.flips + 1, lastFlip: a.idx };
      return g.first === null ? { ...base, first: a.idx } : { ...base, second: a.idx };
    }
    case "resolve": {
      if (g.first === null || g.second === null) return g;
      const [x, y] = [g.cards[g.first], g.cards[g.second]];
      const match = x.face === y.face;
      const lastPair: Pair = { a: g.first, b: g.second, by: g.turn, match };
      if (!match) {
        const cards = g.cards.map((c, i) => (i === g.first || i === g.second ? { ...c, status: "down" as const } : c));
        return { ...g, cards, first: null, second: null, streak: 0, turn: g.turn === 0 ? 1 : 0, lastPair, resolves: g.resolves + 1 };
      }
      const cards = g.cards.map((c, i) => (i === g.first || i === g.second ? { ...c, status: "done" as const, by: g.turn } : c));
      const gain = faceValue(x.face) + (g.streak >= 1 ? COMBO_BONUS : 0);
      const scores: [number, number] = [g.scores[0], g.scores[1]];
      scores[g.turn] += gain;
      const next = { ...g, cards, first: null, second: null, scores, streak: g.streak + 1, lastPair, resolves: g.resolves + 1 };
      const winner = scores[0] === scores[1] ? "draw" : scores[0] > scores[1] ? 0 : 1;
      if (cards.every((c) => c.status === "done")) return { ...next, over: true, winner, reason: "Đã lật hết thẻ" };
      if (Math.abs(scores[0] - scores[1]) > remainingPotential(cards)) return { ...next, over: true, winner, reason: "Điểm số không thể bị bắt kịp" };
      return next;
    }
    case "end":
      return { ...g, over: true, winner: a.winner, reason: a.reason };
  }
}

/** Dựng lại ván từ danh sách lượt đã lưu trên server (hoặc đang xem lại). */
function replay(seed: string, turns: Turn[]): Game {
  let g = reduce(IDLE, { type: "start", cards: shuffled(seededRandom(seed)), turn: 0 });
  for (const t of turns) {
    for (const [a, b] of t) {
      g = reduce(g, { type: "flip", idx: a });
      g = reduce(g, { type: "flip", idx: b });
      g = reduce(g, { type: "resolve" });
    }
  }
  // Dựng lại không phải là vừa chấm một cặp: đừng kích hoạt hiệu ứng / gửi nước.
  return { ...g, lastPair: null, lastFlip: null };
}

function validTurns(moves: unknown[]): Turn[] {
  return moves.filter((m): m is Turn => Array.isArray(m) && m.every((p) => Array.isArray(p) && p.length === 2));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** AI chọn thẻ tiếp theo từ những gì nó còn nhớ. */
function aiPick(g: Game, mem: Map<number, number>): number {
  const down: number[] = [];
  g.cards.forEach((c, i) => c.status === "down" && down.push(i));
  if (g.first !== null) {
    const face = g.cards[g.first].face;
    for (const [i, f] of mem) if (f === face && i !== g.first && g.cards[i].status === "down") return i;
    const unknown = down.filter((i) => !mem.has(i));
    return pickRandom(unknown.length ? unknown : down);
  }
  const seen = new Map<number, number>();
  for (const [i, f] of mem) {
    if (g.cards[i].status !== "down") continue;
    const other = seen.get(f);
    if (other !== undefined) return other;
    seen.set(f, i);
  }
  const unknown = down.filter((i) => !mem.has(i));
  return pickRandom(unknown.length ? unknown : down);
}

interface PvpInfo {
  /** Chỉ xem (khán giả hoặc trận đã xong): không gửi nước, không tính kèo. */
  watch?: boolean;
  /** Id kèo khi bàn này là một ván của kèo bạn bè (`room` là id bàn của ván đó). */
  betId?: string;
  stake?: number;
  room: string;
  oppId: string;
  name: string;
  avatar: string;
  elo?: number;
  /** Khi xem: hai người chơi theo thứ tự đi trước / đi sau. */
  seats?: [{ name: string; avatar: string; elo: number }, { name: string; avatar: string; elo: number }];
}

function CardFace({ card, hidden }: { card: Card; hidden: boolean }) {
  const gold = card.face >= GOLD_FROM;
  return (
    <motion.div className="relative size-full [transform-style:preserve-3d]" initial={false} animate={{ rotateY: hidden ? 180 : 0 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
      <div
        className={cn(
          "absolute inset-0 grid place-items-center rounded-xl border text-[clamp(1.5rem,5vw,2.5rem)] [backface-visibility:hidden]",
          gold ? "border-warning/60 bg-warning-soft text-warning" : "border-white/20 bg-ink-800 text-ink-100"
        )}
      >
        <Emoji e={FACES[card.face].e} size="1em" />
        {gold && <span className="absolute right-1.5 top-1 text-xs font-semibold text-warning">+{GOLD_VALUE}</span>}
      </div>
      <div className="absolute inset-0 grid place-items-center rounded-xl border border-white/15 bg-ink-850 [backface-visibility:hidden] [transform:rotateY(180deg)]">
        <div className="size-[72%] rounded-lg border border-white/15 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,.07)_0_6px,transparent_6px_12px)]" />
      </div>
    </motion.div>
  );
}

export function FlipGame() {
  const me = useAppStore(useShallow((s) => ({ username: s.currentUser.username, avatar: s.currentUser.avatar, elo: s.currentUser.eloFlip || 1200 })));
  const myId = useAppStore((s) => s.currentUser.id);
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const { settle, reset: resetSettlement, result, open: resultOpen, setOpen: setResultOpen } = useMatchSettlement("flip");
  const { show: showToast, node: toastNode } = useToast();
  const narrator = useNarrator();
  const matchOpp = useMatchOpponent();

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  useEffect(() => {
    try {
      // Luôn mở ở chế độ Mời bạn; các thiết lập khác giữ như lần trước.
      setSettings({ ...DEFAULTS, ...JSON.parse(localStorage.getItem("oa-flip-settings") || "{}"), mode: "friend" });
    } catch {}
  }, []);
  const update = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem("oa-flip-settings", JSON.stringify(next));
      } catch {}
      return next;
    });

  const [phase, setPhase] = useState<"setup" | "playing" | "over">("setup");
  const [g, dispatch] = useReducer(reduce, IDLE);
  const [mySeat, setMySeat] = useState<Seat>(0);
  const [stake, setStake] = useState(0);
  const [confirm, setConfirm] = useState<"resign" | "new" | null>(null);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [pvp, setPvp] = useState<PvpInfo | null>(null);
  const [lobby, setLobby] = useState<BetOpp | null>(null);
  /** Đang phát lại lượt của đối thủ: chưa cho thao tác, chưa chốt kết quả. */
  const [replaying, setReplaying] = useState(false);

  const pvpRef = useRef<PvpInfo | null>(null);
  pvpRef.current = pvp;
  const mySeatRef = useRef<Seat>(0);
  mySeatRef.current = mySeat;
  const mem = useRef(new Map<number, number>());
  const loadedMatch = useRef<string | null>(null);
  /** Vào lại ván đang dở (không phải ván mới): không đọc lại lời mở ván. */
  const quietStart = useRef(false);
  const noSettle = useRef(false);
  const aborted = useRef(false);
  const pendingMove = useRef(false);
  /** Số lượt (nước đi) đã phản ánh trên bàn của máy này. */
  const appliedTurns = useRef(0);
  /** Các cặp tôi đã lật trong lượt hiện tại, gửi lên server khi hết lượt. */
  const turnPairs = useRef<Turn>([]);
  const queue = useRef<[number, number][]>([]);
  const pumping = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const s = parseInt(new URLSearchParams(window.location.search).get("stake") || "", 10);
    if (s > 0) setStake(s);
  }, []);

  const online = useOnlineMatch(pvp?.room ?? null, myId, { watch: !!pvp?.watch, me: { name: me.username, avatar: me.avatar } });
  const onlineRef = useRef(online);
  onlineRef.current = online;

  const isFriend = settings.mode === "friend";
  const fb = useFriendBet("flip");
  useEffect(() => {
    if (isFriend && fb.bet && fb.bet.stake !== stake) setStake(fb.bet.stake);
  }, [isFriend, fb.bet, stake]);
  const waitingOpp = isFriend && !fb.friend;

  const level = LEVELS[settings.level];
  const isAi = settings.mode === "ai";
  const isLocal = settings.mode === "local";
  const rated = (isAi && settings.ranked) || !!pvp;
  const playing = phase === "playing";
  const aiTurn = playing && isAi && g.turn === 1;
  const myTurn = playing && !g.over && g.second === null && !replaying && (isLocal || (g.turn === mySeat && (!pvp || (!!online.row && !pvp.watch))));

  const sound = useCallback(
    (kind: "flip" | "match" | "win") => {
      if (!soundEnabled) return;
      if (kind === "flip") soundManager.playCardFlip();
      else if (kind === "match") soundManager.playChessCapture();
      else soundManager.playCardWhoosh();
    },
    [soundEnabled]
  );

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    pumping.current = false;
    queue.current = [];
    setReplaying(false);
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  // Mỗi thẻ vừa lật: âm thanh + AI có xác suất nhớ nó.
  useEffect(() => {
    if (g.lastFlip === null) return;
    sound("flip");
    if (Math.random() < level.memory) mem.current.set(g.lastFlip, g.cards[g.lastFlip].face);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.flips]);

  // Hai thẻ đang mở: chờ rồi chấm. Ván online cả hai máy tự chấm giống nhau.
  useEffect(() => {
    if (g.second === null) return;
    const t = setTimeout(() => dispatch({ type: "resolve" }), RESOLVE_MS);
    return () => clearTimeout(t);
  }, [g.second, g.flips]);

  // Vừa chấm xong một cặp: ghép đúng thì thẻ không cần nhớ nữa.
  useEffect(() => {
    if (!g.lastPair?.match) return;
    for (const i of Array.from(mem.current.keys())) if (g.cards[i]?.status === "done") mem.current.delete(i);
    if (!g.over) sound("match");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.resolves]);

  // Lượt AI
  useEffect(() => {
    if (!aiTurn || g.over || g.second !== null) return;
    const t = setTimeout(() => dispatch({ type: "flip", idx: aiPick(g, mem.current) }), 600 + Math.random() * 350);
    return () => clearTimeout(t);
  }, [aiTurn, g]);

  // Ván online: hết lượt của tôi (mismatch hoặc hết ván) thì gửi cả lượt lên server.
  useEffect(() => {
    const p = pvpRef.current;
    const lp = g.lastPair;
    if (!p || p.watch || !lp || lp.by !== mySeatRef.current || pumping.current) return;
    turnPairs.current.push([lp.a, lp.b]);
    if (g.turn === mySeatRef.current && !g.over) return; // ghép đúng: tôi lật tiếp
    const pairs = turnPairs.current;
    turnPairs.current = [];
    const res = g.over ? (g.winner === "draw" ? "draw" : g.winner === mySeatRef.current ? "win" : "loss") : undefined;
    const ply = appliedTurns.current;
    appliedTurns.current = ply + 1;
    pendingMove.current = true;
    void onlineRef.current.sendMove(ply, pairs, res, res ? g.reason : undefined).finally(() => {
      pendingMove.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.resolves]);

  /** Phát lại từng cặp thẻ đối thủ vừa lật để mình cũng thấy và nhớ. */
  const pump = useCallback(() => {
    if (pumping.current) return;
    pumping.current = true;
    setReplaying(true);
    const step = () => {
      const next = queue.current.shift();
      if (!next) {
        pumping.current = false;
        setReplaying(false);
        return;
      }
      dispatch({ type: "flip", idx: next[0] });
      timers.current.push(
        setTimeout(() => {
          dispatch({ type: "flip", idx: next[1] });
          timers.current.push(setTimeout(step, RESOLVE_MS + REPLAY_GAP_MS));
        }, REPLAY_SECOND_MS)
      );
    };
    step();
  }, []);

  // Đồng bộ với dòng trận trên server (realtime, thăm dò, hoặc phản hồi nước của chính mình).
  useEffect(() => {
    const r = online.row;
    if (!r || !pvp || r.id !== pvp.room) return;
    const first = loadedMatch.current !== r.id;
    if (first) {
      loadedMatch.current = r.id;
      const seat: Seat = pvp.watch ? 0 : slotOf(r, myId) === 1 ? 0 : 1;
      setMySeat(seat);
      mySeatRef.current = seat;
      if (pvp.watch) {
        const seats = [
          { name: r.p1_name || "Người chơi 1", avatar: r.p1_avatar || "", elo: r.p1_elo },
          { name: r.p2_name || "Người chơi 2", avatar: r.p2_avatar || "", elo: r.p2_elo },
        ] as PvpInfo["seats"];
        setPvp((p) => (p && p.room === r.id ? { ...p, seats } : p));
      } else {
        const o = opponentOf(r, myId);
        setPvp((p) => (p && p.room === r.id ? { ...p, oppId: o.id, name: o.name, avatar: o.avatar || p.avatar, elo: o.elo } : p));
      }
      setStake(r.stake);
    }
    const remote = validTurns(r.moves);
    const applied = appliedTurns.current;
    if (first || remote.length - applied > 2 || (remote.length < applied && !pendingMove.current)) {
      clearTimers();
      appliedTurns.current = remote.length;
      turnPairs.current = [];
      dispatch({ type: "load", game: replay(r.id, remote) });
    } else if (remote.length > applied) {
      for (const t of remote.slice(applied)) queue.current.push(...t);
      appliedTurns.current = remote.length;
      pump();
    }
    if (first && r.status === "finished") noSettle.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online.row]);

  // Trận đã kết thúc ở server nhưng bàn chưa có kết quả (xin thua, huỷ, quá giờ): chốt sau khi phát lại xong.
  useEffect(() => {
    const r = online.row;
    if (!r || !pvp || r.status !== "finished" || g.over || replaying || !playing) return;
    const end = describeEnd(r, myId);
    if (end.outcome === "abort") {
      aborted.current = true;
      dispatch({ type: "end", winner: "draw", reason: end.reason });
      return;
    }
    const winner: Seat | "draw" = r.winner === "draw" ? "draw" : r.winner === r.p1 ? 0 : 1;
    dispatch({ type: "end", winner, reason: end.reason });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online.row?.status, g.over, replaying, playing]);

  useEffect(() => {
    if (online.error) showToast(online.error, "bad", 5000);
  }, [online.error, showToast]);

  const outcome: "win" | "loss" | "draw" = g.winner === "draw" || g.winner === null ? "draw" : g.winner === mySeat ? "win" : "loss";

  // Kết thúc ván
  useEffect(() => {
    if (!g.over || phase !== "playing") return;
    setPhase("over");
    const p = pvpRef.current;
    if (p?.watch) return;
    if ((rated || stake > 0) && !isLocal && !aborted.current && !noSettle.current) {
      settle(outcome, p ? { name: p.name, elo: p.elo ?? 1200 } : { name: matchOpp?.name ?? `Flip AI ${level.label}`, elo: matchOpp?.elo ?? level.elo }, stake, p?.betId);
    } else if (noSettle.current || aborted.current) showToast(g.reason, "info", 4000);
    if (outcome === "win" || isLocal) sound("win");
    if (aborted.current) return;
    if (outcome === "draw") narrator.say("Ván đấu kết thúc với tỉ số hoà.", "gm_draw");
    else if (outcome === "win" || isLocal) narrator.say("Chúc mừng, bạn đã chiến thắng!", "gm_win");
    else narrator.say("Rất tiếc, bạn đã thua. Ván sau nhé!", "gm_lose");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.over]);

  const begin = (seed?: string) => {
    clearTimers();
    mem.current.clear();
    appliedTurns.current = 0;
    turnPairs.current = [];
    noSettle.current = false;
    aborted.current = false;
    resetSettlement();
    setMySeat(0);
    mySeatRef.current = 0;
    dispatch({ type: "start", cards: shuffled(seed ? seededRandom(seed) : Math.random), turn: 0 });
    setPhase("playing");
    // Vào lại ván đang dở: chơi tiếp, không đọc lại lời mở ván.
    if (!quietStart.current) narrator.say("Bắt đầu ván đấu! Chúc bạn may mắn.", "gm_start");
    quietStart.current = false;
  };

  // Hết ván trong kèo: cả hai quay lại phòng chờ, chủ phòng bấm Bắt đầu là ván mới.
  const roundOver = !!pvp?.betId && !pvp.watch && online.row?.status === "finished";
  useEffect(() => {
    if (!roundOver || !pvp?.betId) return;
    useBetRounds.getState().end(pvp.betId);
    const back: BetOpp = { room: pvp.betId, oppId: pvp.oppId, name: pvp.name, avatar: pvp.avatar, stake: pvp.stake ?? stake };
    const t = setTimeout(() => setLobby(back), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundOver]);

  // Vào lại ván đã bắt đầu: vào thẳng bàn; lần đầu: qua phòng chờ.
  const startBetPvp = (bo: BetOpp) => (bo.inGame && rejoinTable(bo.room) ? void launchBetPvp(bo) : setLobby(bo));

  async function launchBetPvp(bo: BetOpp) {
    quietStart.current = !!bo.inGame && !bo.round;
    const round = bo.round ?? currentRound(bo.room);
    const room = roomOf(bo.room, round);
    useBetRounds.getState().start(bo.room, round);
    const row = await openBetMatch({
      id: room,
      game: "flip",
      oppId: bo.oppId,
      stake: bo.stake,
      me: { name: me.username, avatar: me.avatar },
      opp: { name: bo.name, avatar: bo.avatar },
      baseMs: NO_CLOCK_MS,
    });
    if (!row) return showToast("Không mở được bàn online — cần đăng nhập tài khoản.", "bad", 4000);
    loadedMatch.current = null;
    setSettings((s) => ({ ...s, mode: "friend" }));
    setPvp({ room, betId: bo.room, stake: bo.stake, oppId: bo.oppId, name: bo.name, avatar: bo.avatar });
    setStake(bo.stake);
    begin(room);
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const watchId = q.get("match");
    if (watchId && q.get("watch") === "1") {
      // Xem trận: bàn chỉ đọc, các lượt lấy từ server.
      loadedMatch.current = null;
      setSettings((s) => ({ ...s, mode: "friend" }));
      setPvp({ room: watchId, oppId: "", name: "Người chơi", avatar: "", watch: true });
      quietStart.current = true;
      begin(watchId);
      return;
    }
    if (q.get("bet")) {
      void waitForBetOpponent().then((bo) => {
        if (bo?.oppId) void startBetPvp(bo);
        else showToast("Không tìm thấy kèo đã được nhận cho bàn này.", "bad", 4000);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    if (isFriend) {
      if (!fb.friend) return;
      void startBetPvp({ room: fb.friend.betId, oppId: fb.friend.id, name: fb.friend.name, avatar: fb.friend.avatar, stake: fb.bet?.stake ?? stake, inGame: fb.bet?.status === "in_game" });
      return;
    }
    setPvp(null);
    begin();
  };

  const backToSetup = () => {
    clearTimers();
    setPvp(null);
    setLobby(null);
    loadedMatch.current = null;
    setConfirm(null);
    setResultOpen(false);
    setPhase("setup");
    dispatch({ type: "start", cards: [], turn: 0 });
  };

  const resign = () => {
    setConfirm(null);
    if (pvp) return void online.act("resign");
    dispatch({ type: "end", winner: mySeat === 0 ? 1 : 0, reason: "Bạn xin thua" });
  };

  const seatInfo = (seat: Seat) => {
    if (isLocal) return { name: seat === 0 ? "Người chơi 1" : "Người chơi 2", avatar: `kokonut:nguoi choi ${seat + 1}:${seat + 1}`, rating: undefined as number | undefined };
    if (pvp?.watch) {
      const s = pvp.seats?.[seat];
      return { name: s?.name ?? "Người chơi", avatar: s?.avatar ?? "", rating: s?.elo };
    }
    if (seat === mySeat) return { name: me.username, avatar: me.avatar, rating: me.elo };
    if (pvp) return { name: pvp.name, avatar: pvp.avatar, rating: pvp.elo };
    return { name: matchOpp?.name ?? `Flip AI ${level.label}`, avatar: matchOpp?.avatar ?? `kokonut:flip ai ${settings.level}:5`, rating: matchOpp?.elo ?? level.elo };
  };

  const who = (seat: Seat) => (isLocal ? `Người chơi ${seat + 1}` : pvp?.watch ? seatInfo(seat).name : seat === mySeat ? "Bạn" : isAi ? "AI" : pvp?.name ?? "Đối thủ");
  const status =
    phase === "over"
      ? g.winner === "draw" || g.winner === null
        ? "Hoà nhau!"
        : isLocal || pvp?.watch
        ? `${who(g.winner)} thắng!`
        : outcome === "win"
        ? "Bạn thắng! 🎉"
        : "Bạn thua"
      : aiTurn
      ? "AI đang nhớ…"
      : isLocal
      ? `Lượt ${who(g.turn)}`
      : pvp && !pvp.watch && !online.row
      ? "Đang vào bàn…"
      : pvp?.watch
      ? `Lượt ${who(g.turn)}`
      : g.turn === mySeat
      ? "Lượt của bạn"
      : "Chờ đối thủ…";

  const pairsLeft = useMemo(() => g.cards.filter((c) => c.status !== "done").length / 2, [g.cards]);
  const winning = (seat: Seat) => phase === "over" && g.winner === seat;
  const other: Seat = mySeat === 0 ? 1 : 0;

  const scoreChip = (seat: Seat) => (
    <span className="flex items-center gap-1.5">
      <b className="font-mono text-sm tabular-nums text-ink-100">{g.scores[seat]}</b> điểm
      {playing && g.turn === seat && g.streak >= 1 && <span className="chip border-warning/50 text-warning">Chuỗi x{g.streak}</span>}
    </span>
  );

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-3 py-3">
      <GameHeader game="flip" subtitle="Nhớ vị trí, ghép cặp, thu nhiều điểm hơn">
        <NarratorButton enabled={narrator.enabled} onClick={narrator.toggle} />
        {phase !== "setup" && (
          <span className={cn("chip", rated && "border-success/40 text-success")}>
            <EmojiText>{pvp?.watch ? "Đang xem" : rated ? `Xếp hạng${stake ? ` · ${stake} 🌾` : ""}` : "Tập luyện"}</EmojiText>
          </span>
        )}
      </GameHeader>
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col items-center justify-center gap-2">
          {phase !== "setup" && (
            <PlayerCard className="w-full max-w-[640px]" {...seatInfo(other)} active={playing && g.turn === other} thinking={aiTurn && g.second === null} extra={scoreChip(other)} accent="red" />
          )}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ maxWidth: "min(640px, calc((100dvh - 250px) * 1.1))" }}
            className="w-full rounded-2xl border border-white/10 bg-ink-900 p-2.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,.8)] sm:p-3.5"
          >
            <div className="grid gap-2 sm:gap-3 [perspective:1000px]" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
              {(phase === "setup" ? Array.from({ length: COLS * ROWS }, (): Card => ({ face: 0, status: "down" })) : g.cards).map((c, i) => {
                const hidden = c.status === "down";
                const canFlip = myTurn && hidden;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!canFlip}
                    onClick={() => dispatch({ type: "flip", idx: i })}
                    aria-label={hidden ? `Thẻ ${i + 1}, đang úp` : c.status === "done" ? `Thẻ ${i + 1}, đã ghép` : `Thẻ ${i + 1}, ${FACES[c.face].name}`}
                    className={cn(
                      "relative aspect-[3/4] rounded-xl outline-none transition-[transform,opacity] focus-visible:ring-2 focus-visible:ring-white/60",
                      canFlip && "cursor-pointer hover:-translate-y-0.5",
                      c.status === "done" && "opacity-55"
                    )}
                  >
                    <CardFace card={c} hidden={hidden} />
                    {c.status === "done" && <span className={cn("pointer-events-none absolute inset-0 rounded-xl border-2", (isLocal ? c.by === 0 : c.by === mySeat) ? "border-success/80" : "border-danger/80")} />}
                  </button>
                );
              })}
            </div>
          </motion.div>
          {phase !== "setup" && (
            <PlayerCard className="w-full max-w-[640px]" {...seatInfo(mySeat)} active={playing && g.turn === mySeat} extra={scoreChip(mySeat)} accent="lime" />
          )}
        </div>

        <aside className="flex min-h-0 flex-col gap-3">
          {phase === "setup" ? (
            <div className="panel space-y-3 p-4">
              <div>
                <span className="label">Chế độ</span>
                <Segmented value={settings.mode} onChange={(v) => update({ mode: v })} options={[{ value: "friend", label: "Mời bạn" }, { value: "ai", label: "Đấu AI" }, { value: "local", label: "2 người 1 máy" }]} />
              </div>
              {isAi && (
                <>
                  <div>
                    <span className="label">Cấp AI</span>
                    <Segmented value={settings.level} onChange={(v) => update({ level: v })} options={(Object.keys(LEVELS) as Level[]).map((k) => ({ value: k, label: LEVELS[k].label, hint: `~${LEVELS[k].elo} ELO` }))} />
                  </div>
                  <div>
                    <span className="label">Loại ván</span>
                    <Segmented value={settings.ranked ? "r" : "t"} onChange={(v) => { update({ ranked: v === "r" }); if (v === "t") setStake(0); }} options={[{ value: "r", label: "Xếp hạng" }, { value: "t", label: "Tập luyện" }]} />
                  </div>
                  <StakePicker
                    value={stake}
                    onChange={(v) => {
                      setStake(v);
                      if (v > 0 && !settings.ranked) update({ ranked: true });
                    }}
                  />
                </>
              )}
              {isFriend && (
                <>
                  <StakePicker value={stake} onChange={(v) => { setInviteErr(null); setStake(v); }} disabled={!!fb.pending || !!fb.friend} />
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5 text-xs">
                    {fb.friend ? (
                      <p><Emoji e="✅" /> <b>{fb.friend.name}</b> đã nhận kèo {fb.bet?.stake ?? 0} <Emoji e="🌾" /> — cả hai bấm Bắt đầu để vào bàn.</p>
                    ) : fb.pending ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0"><Emoji e="⏳" /> Chờ bạn bè nhận kèo {fb.pending.stake}&nbsp;<Emoji e="🌾" /></span>
                        <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => fb.cancel(fb.pending!.id)}>Huỷ kèo</Button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <span>Chưa có đối thủ</span>
                        <InviteSender onSend={(to) => setInviteErr(fb.invite(stake, to))} />
                      </div>
                    )}
                    {inviteErr && <p role="alert" className="mt-1 text-danger">{inviteErr}</p>}
                  </div>
                </>
              )}
              <Button variant="solid" onClick={start} disabled={waitingOpp} className="w-full py-2.5 font-semibold disabled:opacity-50">
                <Play className="size-4" /> {waitingOpp ? "Chờ đối thủ nhận kèo" : "Bắt đầu"}
              </Button>
            </div>
          ) : (
            <div className="panel space-y-3 p-4">
              <AnimatePresence mode="wait">
                <motion.p key={status} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} className="text-center font-display text-lg font-semibold">
                  <EmojiText>{status}</EmojiText>
                </motion.p>
              </AnimatePresence>
              <div className="grid grid-cols-2 gap-2 text-center">
                {([mySeat, other] as Seat[]).map((seat) => (
                  <div key={seat} className={cn("rounded-xl border px-2 py-2", winning(seat) ? "border-success/50 bg-success-soft" : "border-white/[0.07] bg-white/[0.02]")}>
                    <p className="truncate text-xs text-ink-400">{who(seat)}</p>
                    <p className="font-display text-2xl font-semibold tabular-nums">{g.scores[seat]}</p>
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-ink-400">{phase === "over" ? g.reason : `Còn ${pairsLeft} cặp · thẻ vàng +${GOLD_VALUE} · chuỗi +${COMBO_BONUS}/cặp`}</p>
              {pvp && playing && <OnlineStatus watchers={online.watchers} watching={!!pvp.watch} oppOnline={online.oppOnline} ready={!!online.row} canAbort={(online.row?.moves.length ?? 0) < 2} onAbort={() => void online.act("abort")} />}
              {pvp?.watch ? (
                <Button onClick={backToSetup} className="w-full py-2.5">
                  <LogOut className="size-4" /> Rời bàn
                </Button>
              ) : playing ? (
                <Button variant="danger" onClick={() => setConfirm(rated ? "resign" : "new")} className="w-full py-2.5">
                  <Flag className="size-4" /> {rated ? "Xin thua" : "Thoát"}
                </Button>
              ) : (
                <Button variant="solid" onClick={backToSetup} className="w-full py-2.5 font-semibold">
                  Ván mới
                </Button>
              )}
            </div>
          )}
          {toastNode}
        </aside>
      </div>

      {lobby && <BetLobby bo={lobby} onStart={(b) => { setLobby(null); void launchBetPvp(b); }} onLeave={() => setLobby(null)} />}
      <ConfirmDialog open={confirm === "resign"} title="Xin thua ván này?" body={rated ? "Ván xếp hạng: bạn sẽ mất ELO và tiền cược." : undefined} confirmLabel="Xin thua" danger onConfirm={resign} onCancel={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === "new"} title="Bỏ ván đang chơi?" body="Ván hiện tại sẽ bị huỷ." confirmLabel="Bỏ ván" danger onConfirm={backToSetup} onCancel={() => setConfirm(null)} />
      <MatchResultModal isOpen={resultOpen} onClose={() => setResultOpen(false)} onPlayAgain={backToSetup} resultData={result} reason={g.reason} />
    </div>
  );
}

export default FlipGame;
