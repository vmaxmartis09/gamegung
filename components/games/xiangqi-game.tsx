"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Flag, Handshake, Lightbulb, Play, Repeat, RotateCcw, Undo2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/lib/store";
import { soundManager } from "@/lib/audio";
import { EngineClient } from "@/lib/engines/engine-client";
import {
  XiangqiPosition,
  XQ_LEVELS,
  XqLevel,
  XSearchOptions,
  XSearchResult,
  vnNotation,
  VN_NAME,
  GENERAL,
  Side,
} from "@/lib/engines/xiangqi-engine";
import { cn } from "@/lib/utils";
import { describeEnd, openBetMatch, opponentOf, slotOf, timeLeft, useOnlineMatch } from "@/lib/online-match";
import { MatchResultModal } from "./match-result-modal";
import { NarratorButton, useNarrator } from "./game-fx";
import HoldButton from "@/components/kokonut/hold-button";
import { ConfirmDialog, GameHeader, OnlineStatus, PlayerCard, Segmented, StakePicker, useFriendBet, useGameSession, useMatchOpponent, useMatchSettlement, useToast, waitForBetOpponent } from "./shared";
import { Emoji, EmojiText } from "@/components/ui/emoji";
import { BetLobby, type BetOpp } from "./bet-lobby";
import { currentRound, rejoinTable, roomOf, useBetRounds } from "@/lib/bet-rounds";

const TIME_CONTROLS = [
  { id: "5+3", base: 300, inc: 3, label: "5+3", kind: "Nhanh" },
  { id: "10+5", base: 600, inc: 5, label: "10+5", kind: "Tiêu chuẩn" },
  { id: "15+10", base: 900, inc: 10, label: "15+10", kind: "Thong thả" },
  { id: "20+0", base: 1200, inc: 0, label: "20+0", kind: "Giải đấu" },
  { id: "inf", base: 0, inc: 0, label: "∞", kind: "Không giờ" },
] as const;
type TimeId = (typeof TIME_CONTROLS)[number]["id"];

const THEMES = {
  wood: { name: "Gỗ", board: "#e6c389", line: "#3a230f", river: "#4a2e14", frame: "#3a230f" },
  paper: { name: "Giấy", board: "#f4e7cc", line: "#262626", river: "#3a3a3a", frame: "#262626" },
  night: { name: "Đêm", board: "#1c1c21", line: "#a1a1aa", river: "#d4d4d8", frame: "#d4d4d8" },
} as const;
type ThemeId = keyof typeof THEMES;

const CHAR_RED = ["", "帥", "仕", "相", "傌", "俥", "炮", "兵"];
const CHAR_BLACK = ["", "將", "士", "象", "馬", "車", "砲", "卒"];

const makeEngine = () =>
  typeof window !== "undefined"
    ? new EngineClient<{ fen: string; history: number[]; opts: XSearchOptions }, XSearchResult>(
        () => new Worker(new URL("../../lib/engines/xiangqi.worker.ts", import.meta.url)),
        async ({ fen, history, opts }) => (await import("@/lib/engines/xiangqi-engine")).searchXiangqi(fen, history, opts)
      )
    : null;
const engine = makeEngine();
const analyst = makeEngine();

interface Settings {
  mode: "ai" | "local" | "friend" | "pvp";
  level: XqLevel;
  color: Side | 0;
  time: TimeId;
  ranked: boolean;
  theme: ThemeId;
}
const DEFAULTS: Settings = { mode: "friend", level: "medium", color: 1, time: "10+5", ranked: true, theme: "wood" };

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
}

interface XqSave {
  settings: Settings;
  stake: number;
  mySide: Side;
  moves: { from: number; to: number }[];
  clock: { red: number | null; black: number | null };
  hintsLeft: number;
  takebacksLeft: number;
}

interface PlayedMove {
  from: number;
  to: number;
  captured: number;
  notation: string;
  side: Side;
}

export function XiangqiGame() {
  const me = useAppStore(useShallow((s) => ({ username: s.currentUser.username, avatar: s.currentUser.avatar, elo: s.currentUser.eloXiangqi })));
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const { settle, reset: resetSettlement, result, open: resultOpen, setOpen: setResultOpen } = useMatchSettlement("xiangqi");
  const { show: showToast, node: toastNode } = useToast();
  const narrator = useNarrator();
  const session = useGameSession<XqSave>("xiangqi");
  const matchOpp = useMatchOpponent();

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  useEffect(() => {
    try {
      // Luôn mở ở chế độ Mời bạn; các thiết lập khác giữ như lần trước.
      setSettings({ ...DEFAULTS, ...JSON.parse(localStorage.getItem("oa-xq-settings") || "{}"), mode: "friend" });
    } catch {}
  }, []);
  const update = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem("oa-xq-settings", JSON.stringify(next));
      } catch {}
      return next;
    });

  const [stake, setStake] = useState(0);
  useEffect(() => {
    const s = parseInt(new URLSearchParams(window.location.search).get("stake") || "", 10);
    if (s > 0) setStake(s);
  }, []);

  const myId = useAppStore((s) => s.currentUser.id);
  const isFriend = settings.mode === "friend";
  const fb = useFriendBet("xiangqi");
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  useEffect(() => {
    if (isFriend && fb.bet && fb.bet.stake !== stake) setStake(fb.bet.stake);
  }, [isFriend, fb.bet, stake]);
  // A bet needs a ready opponent: friend mode starts only after the challenge is accepted.
  const waitingOpp = isFriend && !fb.friend;
  const [pvp, setPvp] = useState<PvpInfo | null>(null);
  const pvpRef = useRef<PvpInfo | null>(null);
  pvpRef.current = pvp;
  // Online match state (server-refereed); see lib/online-match.
  const online = useOnlineMatch(pvp?.room ?? null, myId, { watch: !!pvp?.watch, me: { name: me.username, avatar: me.avatar } });
  const onlineRef = useRef(online);
  onlineRef.current = online;
  /** A move of mine is on its way to the server; don't roll the board back meanwhile. */
  const pendingMove = useRef(false);
  const finishedRef = useRef(false);
  const [drawOffer, setDrawOffer] = useState<null | "in" | "out">(null);

  const posRef = useRef(new XiangqiPosition());
  const [boards, setBoards] = useState<Int8Array[]>([posRef.current.b.slice()]);
  const [moves, setMoves] = useState<PlayedMove[]>([]);
  const movesRef = useRef<PlayedMove[]>([]);
  movesRef.current = moves;
  const [phase, setPhase] = useState<"setup" | "playing" | "over">("setup");
  const [mySide, setMySide] = useState<Side>(1);
  const [flipped, setFlipped] = useState(false);
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState<{ from: number; to: number } | null>(null);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [takebacksLeft, setTakebacksLeft] = useState(3);
  const [overReason, setOverReason] = useState("");
  const [confirm, setConfirm] = useState<null | "resign" | "new">(null);
  const [animKey, setAnimKey] = useState(0);
  const [turn, setTurn] = useState<Side>(1);

  const tc = TIME_CONTROLS.find((t) => t.id === settings.time)!;
  const clockRef = useRef({ 1: tc.base * 1000 || Infinity, [-1]: tc.base * 1000 || Infinity } as Record<number, number>);
  const [clock, setClockView] = useState(clockRef.current);
  const syncClock = useCallback(() => setClockView({ ...clockRef.current }), []);

  const level = XQ_LEVELS[settings.level];
  const isAi = settings.mode === "ai";
  const isPvp = settings.mode === "pvp";
  const rated = (isAi && settings.ranked) || isPvp;
  const viewing = viewPly !== null && viewPly !== boards.length - 1;
  const shown = viewPly === null ? boards[boards.length - 1] : boards[viewPly];
  // Online: wait until the server has told us which side we play.
  const humanTurn = phase === "playing" && (settings.mode === "local" || turn === mySide) && (!pvp || (!!online.row && !pvp.watch));
  const bottomSide: Side = (settings.mode === "local" ? 1 : mySide) as Side; // người đăng nhập luôn ở phía dưới
  const lastMove = viewing ? moves[(viewPly ?? 1) - 1] : moves[moves.length - 1];

  const targets = useMemo(() => {
    if (selected === null || viewing) return new Set<number>();
    return new Set(posRef.current.movesFrom(selected).map((m) => m.to));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, viewing, boards]);

  const checkSq = useMemo(() => {
    if (viewing) return null;
    const p = posRef.current;
    return p.inCheck() ? p.kings[p.side === 1 ? 0 : 1] : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boards, viewing]);

  const sound = useCallback(
    (k: "move" | "capture" | "check" | "end") => {
      if (!soundEnabled) return;
      if (k === "capture") soundManager.playXiangqiCapture();
      else if (k === "check") soundManager.playXiangqiCheck();
      else if (k === "end") soundManager.playVictory();
      else soundManager.playXiangqiMove();
    },
    [soundEnabled]
  );

  const finish = useCallback(
    (winner: Side | 0, reason: string, settleIt = true) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      engine?.cancel();
      setThinking(false);
      setPhase("over");
      setOverReason(reason);
      setSelected(null);
      sound("end");
      if (settleIt) {
        if (winner === 0) narrator.say("Ván đấu kết thúc với tỉ số hoà.", "gm_draw");
        else if (winner === mySide || settings.mode === "local") narrator.say("Chúc mừng, bạn đã chiến thắng!", "gm_win");
        else narrator.say("Rất tiếc, bạn đã thua. Ván sau nhé!", "gm_lose");
      }
      setDrawOffer(null);
      if (!settleIt) showToast(reason, "info", 4000);
      else if (rated) {
        if (!pvp?.watch) settle(winner === 0 ? "draw" : winner === mySide ? "win" : "loss", { name: pvp?.name ?? matchOpp?.name ?? `Engine ${level.label}`, elo: pvp ? pvp.elo ?? 1200 : matchOpp?.elo ?? level.elo }, stake, pvp?.betId);
      } else showToast(winner === 0 ? `Hoà — ${reason}` : `${winner === 1 ? "Đỏ" : "Đen"} thắng — ${reason}`, "info", 4000);
    },
    [rated, mySide, level, stake, settle, sound, showToast, matchOpp, pvp, narrator, settings.mode]
  );

  const applyMove = useCallback(
    (from: number, to: number, remote = false) => {
      const p = posRef.current;
      const notation = vnNotation(p, from, to);
      const captured = p.b[to];
      const side = p.side;
      if (!p.play(from, to)) return false;
      if (pvpRef.current && !remote) {
        // Tell the server if this move ends the game (from the mover's point of view).
        const end = p.result();
        pendingMove.current = true;
        void onlineRef.current
          .sendMove(movesRef.current.length, { from, to }, end ? (end.winner === 0 ? "draw" : end.winner === side ? "win" : "loss") : undefined, end?.reason)
          .finally(() => {
            pendingMove.current = false;
          });
      }
      if (tc.base && tc.inc) {
        clockRef.current[side] += tc.inc * 1000;
        syncClock();
      }
      setMoves((ms) => [...ms, { from, to, captured, notation, side }]);
      setBoards((bs) => [...bs, p.b.slice()]);
      setTurn(p.side);
      setAnimKey((k) => k + 1);
      setViewPly(null);
      setSelected(null);
      setHint(null);
      if (p.inCheck()) {
        sound("check");
        if (!p.result()) narrator.say("Chiếu tướng!", "gm_check");
      }
      else if (captured) sound("capture");
      else sound("move");
      const r = p.result();
      if (r) finish(r.winner, r.reason);
      return true;
    },
    [tc, syncClock, sound, finish, narrator]
  );

  // AI
  useEffect(() => {
    if (phase !== "playing" || !isAi || turn === mySide || !engine) return;
    let alive = true;
    setThinking(true);
    const p = posRef.current;
    const remaining = clockRef.current[turn];
    const budget = remaining === Infinity ? level.timeMs : Math.max(200, Math.min(level.timeMs, remaining / 25));
    const started = performance.now();
    engine.request({ fen: p.fen(), history: [...p.historyHashes], opts: { maxDepth: level.maxDepth, timeMs: budget, noise: level.noise } }).then((r) => {
      if (!alive || !r) return;
      setTimeout(() => {
        if (!alive) return;
        setThinking(false);
        if (r.move) applyMove(r.move.from, r.move.to);
      }, Math.max(0, 400 - (performance.now() - started)));
    });
    return () => {
      alive = false;
    };
  }, [phase, isAi, turn, mySide, level, applyMove, boards.length]);

  const rebuildFrom = useCallback((list: { from: number; to: number }[]) => {
    const p = new XiangqiPosition();
    const played: PlayedMove[] = [];
    const bs = [p.b.slice()];
    for (const m of list) {
      const notation = vnNotation(p, m.from, m.to);
      const captured = p.b[m.to];
      const side = p.side;
      if (!p.play(m.from, m.to)) break;
      played.push({ ...m, captured, notation, side });
      bs.push(p.b.slice());
    }
    posRef.current = p;
    movesRef.current = played;
    setMoves(played);
    setBoards(bs);
    setTurn(p.side);
    setViewPly(null);
    setSelected(null);
  }, []);

  // Reconcile the board with the server row (realtime, poll, or my own move's reply).
  const loadedMatch = useRef<string | null>(null);
  const prevRow = useRef<{ offer: string | null; plies: number } | null>(null);
  useEffect(() => {
    const r = online.row;
    if (!r || !pvp || r.id !== pvp.room) return;
    const first = loadedMatch.current !== r.id;
    const mine: Side = slotOf(r, myId) === 1 ? 1 : -1;
    if (first) {
      loadedMatch.current = r.id;
      setMySide(mine);
      const o = opponentOf(r, myId);
      setPvp((p) => (p && p.room === r.id ? { ...p, oppId: o.id, name: o.name, avatar: o.avatar || p.avatar, elo: o.elo } : p));
      setStake(r.stake);
    }

    const remote = r.moves as { from: number; to: number }[];
    const local = movesRef.current;
    const same = local.slice(0, remote.length).every((m, i) => m.from === remote[i].from && m.to === remote[i].to);
    if (!same || (remote.length < local.length && !pendingMove.current)) rebuildFrom(remote);
    else if (remote.length > local.length) {
      if (first || remote.length - local.length > 2) rebuildFrom(remote);
      else for (const m of remote.slice(local.length)) applyMove(m.from, m.to, true);
    }

    const prev = prevRow.current;
    prevRow.current = { offer: r.draw_offer_by, plies: remote.length };
    if (r.status === "active") {
      setDrawOffer(r.draw_offer_by ? (r.draw_offer_by === myId ? "out" : "in") : null);
      if (r.draw_offer_by && r.draw_offer_by !== myId && prev?.offer !== r.draw_offer_by) narrator.say("Đối thủ đang xin hoà.", "gm_draw_offer");
      if (prev?.offer === myId && !r.draw_offer_by && prev.plies === remote.length) showToast("Đối thủ từ chối hoà", "bad");
    } else if (!finishedRef.current) {
      // A game that was already over when I opened it is shown, not paid out again.
      const end = describeEnd(r, myId);
      if (end.outcome === "abort") finish(0, end.reason, false);
      else finish(end.outcome === "draw" ? 0 : end.outcome === "win" ? mine : ((-mine) as Side), end.reason, !first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online.row]);

  useEffect(() => {
    if (online.error) showToast(online.error, "bad", 5000);
  }, [online.error, showToast]);

  // Online clock: derived from the server's turn start (same for both players, runs in hidden tabs).
  // When it runs out, ask the server to call the flag.
  useEffect(() => {
    if (!pvp || phase !== "playing") return;
    let lastFlag = 0;
    let shown = "";
    const t = setInterval(() => {
      const { row: r, serverNow, act } = onlineRef.current;
      if (!r || r.status !== "active") return;
      const now = serverNow();
      const red = timeLeft(r, 1, now);
      const black = timeLeft(r, 2, now);
      clockRef.current = { 1: red, [-1]: black };
      const key = [red, black].map((v) => Math.floor(v / (v < 10000 ? 100 : 1000))).join("|");
      if (key !== shown) {
        shown = key;
        syncClock();
      }
      const left = r.moves.length % 2 === 0 ? red : black;
      if (r.moves.length >= 2 && left <= 0 && Date.now() - lastFlag > 2000) {
        lastFlag = Date.now();
        void act("flag");
      }
    }, 100);
    return () => clearInterval(t);
  }, [pvp, phase, syncClock]);

  // Clock
  useEffect(() => {
    if (phase !== "playing" || !tc.base || moves.length < 2 || pvp) return;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      const side = posRef.current.side;
      const before = clockRef.current[side];
      const left = before - dt;
      if (left <= 0) {
        clockRef.current[side] = 0;
        syncClock();
        finish((-side) as Side, "Hết giờ");
        return;
      }
      clockRef.current[side] = left;
      const unit = left < 10000 ? 100 : 1000;
      if (Math.floor(left / unit) !== Math.floor(before / unit)) syncClock();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, tc.base, moves.length, finish, syncClock, pvp]);

  useEffect(
    () => () => {
      engine?.cancel();
      analyst?.cancel();
    },
    []
  );

  // Resume an unfinished game once on mount.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const q = new URLSearchParams(window.location.search);
    const matchId = q.get("match");
    if (matchId) {
      beginPvp({ room: matchId, oppId: "", name: "Đối thủ", avatar: "", watch: q.get("watch") === "1" });
      return;
    }
    if (q.get("bet")) {
      void waitForBetOpponent().then((bo) => {
        if (bo?.oppId) void startBetPvp(bo);
        else showToast("Không tìm thấy kèo đã được nhận cho bàn này.", "bad", 4000);
      });
      return;
    }
    const saved = session.load();
    if (!saved) return;
    const d = saved.payload;
    const p = new XiangqiPosition();
    const played: PlayedMove[] = [];
    const bs = [p.b.slice()];
    for (const m of d.moves) {
      const notation = vnNotation(p, m.from, m.to);
      const captured = p.b[m.to];
      const side = p.side;
      if (!p.play(m.from, m.to)) break;
      played.push({ ...m, captured, notation, side });
      bs.push(p.b.slice());
    }
    if (p.result()) return session.clear();
    posRef.current = p;
    setSettings(d.settings);
    setStake(d.stake);
    setMySide(d.mySide);
    setMoves(played);
    setBoards(bs);
    setTurn(p.side);
    clockRef.current = { 1: d.clock.red ?? Infinity, [-1]: d.clock.black ?? Infinity };
    syncClock();
    setHintsLeft(d.hintsLeft);
    setTakebacksLeft(d.takebacksLeft);
    setPhase("playing");
    showToast("Đã khôi phục ván đang dở 🀄", "good");
  }, [session, syncClock, showToast]);

  const persistRef = useRef<() => void>(() => {});
  persistRef.current = () => {
    if (phase !== "playing" || pvpRef.current) return;
    const fin = (v: number) => (v === Infinity ? null : Math.round(v));
    session.save(
      {
        settings,
        stake,
        mySide,
        moves: moves.map((m) => ({ from: m.from, to: m.to })),
        clock: { red: fin(clockRef.current[1]), black: fin(clockRef.current[-1]) },
        hintsLeft,
        takebacksLeft,
      },
      {
        label: `Nước ${Math.max(1, Math.ceil(moves.length / 2))} · cầm ${mySide === 1 ? "Đỏ" : "Đen"}`,
        detail: settings.mode === "ai" ? `vs Engine ${XQ_LEVELS[settings.level].label}` : "2 người 1 máy",
        progress: Math.min(1, moves.length / 100),
      }
    );
  };
  useEffect(() => {
    if (phase === "playing") persistRef.current();
    else if (phase === "over") session.clear();
  }, [phase, moves.length, session]);
  useEffect(() => () => persistRef.current(), []);

  // Online match: the matchmaking modal passes ?match=<id>; a chat bet opens a match keyed by the bet id.
  // Sides, names, moves and clocks all come from the server row.
  const beginPvp = (info: PvpInfo) => {
    session.clear();
    const p = new XiangqiPosition();
    posRef.current = p;
    loadedMatch.current = null;
    finishedRef.current = false;
    setDrawOffer(null);
    setPvp(info);
    setSettings((s) => ({ ...s, mode: "pvp", time: "10+5" }));
    setFlipped(false);
    setBoards([p.b.slice()]);
    setMoves([]);
    setTurn(1);
    setViewPly(null);
    setSelected(null);
    setHint(null);
    clockRef.current = { 1: 600000, [-1]: 600000 };
    syncClock();
    resetSettlement();
    setPhase("playing");
    narrator.say("Bắt đầu ván đấu! Chúc bạn may mắn.", "gm_start");
  };

  const [lobby, setLobby] = useState<BetOpp | null>(null);

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
    const round = bo.round ?? currentRound(bo.room);
    const room = roomOf(bo.room, round);
    useBetRounds.getState().start(bo.room, round);
    const row = await openBetMatch({
      id: room,
      game: "xiangqi",
      oppId: bo.oppId,
      stake: bo.stake,
      me: { name: me.username, avatar: me.avatar },
      opp: { name: bo.name, avatar: bo.avatar },
    });
    if (!row) return showToast("Không mở được bàn online — cần đăng nhập tài khoản.", "bad", 4000);
    beginPvp({ room, betId: bo.room, stake: bo.stake, oppId: bo.oppId, name: bo.name, avatar: bo.avatar });
  }

  const start = () => {
    if (isFriend) {
      if (!fb.friend) return;
      void startBetPvp({ room: fb.friend.betId, oppId: fb.friend.id, name: fb.friend.name, avatar: fb.friend.avatar, stake: fb.bet?.stake ?? stake, inGame: fb.bet?.status === "in_game" });
      return;
    }
    finishedRef.current = false;
    engine?.cancel();
    analyst?.cancel();
    const p = new XiangqiPosition();
    posRef.current = p;
    const side: Side = settings.mode === "local" ? 1 : settings.color === 0 ? (Math.random() < 0.5 ? 1 : -1) : settings.color;
    setMySide(side);
    setFlipped(false);
    setBoards([p.b.slice()]);
    setMoves([]);
    setTurn(1);
    setViewPly(null);
    setSelected(null);
    setHint(null);
    setHintsLeft(3);
    setTakebacksLeft(3);
    clockRef.current = { 1: tc.base * 1000 || Infinity, [-1]: tc.base * 1000 || Infinity };
    syncClock();
    resetSettlement();
    setPhase("playing");
    narrator.say("Bắt đầu ván đấu! Chúc bạn may mắn.", "gm_start");
  };

  const backToSetup = () => {
    engine?.cancel();
    setThinking(false);
    if (pvp) {
      setPvp(null);
      setSettings((s) => ({ ...s, mode: "friend" }));
      window.history.replaceState(null, "", window.location.pathname);
    }
    setPhase("setup");
    setResultOpen(false);
  };

  const resign = () => {
    setConfirm(null);
    if (phase !== "playing") return;
    if (pvp) void online.act("resign");
    const loser = settings.mode === "local" ? turn : mySide;
    finish((-loser) as Side, settings.mode === "local" ? `${loser === 1 ? "Đỏ" : "Đen"} xin thua` : "Bạn xin thua");
  };

  const offerDraw = async () => {
    if (phase !== "playing") return;
    if (settings.mode === "local") return finish(0, "Hai bên thoả thuận hoà");
    if (isPvp) {
      if (drawOffer) return;
      setDrawOffer("out");
      void online.act("draw_offer");
      return showToast("Đã gửi lời cầu hoà cho đối thủ…");
    }
    if (!analyst) return;
    showToast("Đã gửi lời cầu hoà…");
    const p = posRef.current;
    const r = await analyst.request({ fen: p.fen(), history: [...p.historyHashes], opts: { maxDepth: 4, timeMs: 500 } });
    if (!r) return;
    const aiScore = turn === mySide ? -r.score : r.score;
    if (aiScore <= -150 || (Math.abs(aiScore) <= 40 && moves.length >= 50)) finish(0, "Engine chấp nhận cầu hoà");
    else showToast("Engine từ chối: “Còn đánh được.”", "bad");
  };

  const takeback = () => {
    if (rated || phase !== "playing" || takebacksLeft <= 0 || thinking) return;
    const n = isAi ? (turn === mySide ? 2 : 1) : 1;
    if (moves.length < n) return;
    engine?.cancel();
    const p = posRef.current;
    for (let i = 0; i < n; i++) {
      const m = moves[moves.length - 1 - i];
      p.undo(m.from, m.to);
    }
    setMoves((ms) => ms.slice(0, -n));
    setBoards((bs) => bs.slice(0, -n));
    setTurn(p.side);
    setTakebacksLeft((t) => t - 1);
    setSelected(null);
    setHint(null);
  };

  const askHint = async () => {
    if (rated || !humanTurn || hintsLeft <= 0 || !analyst) return;
    showToast("Đang tìm nước hay…");
    const p = posRef.current;
    const r = await analyst.request({ fen: p.fen(), history: [...p.historyHashes], opts: { maxDepth: 6, timeMs: 1200 } });
    if (r?.move) {
      setHint(r.move);
      setHintsLeft((h) => h - 1);
    }
  };

  const onSquare = useCallback(
    (sq: number) => {
      if (!humanTurn || viewing) return;
      const p = posRef.current;
      if (selected !== null && targets.has(sq)) {
        applyMove(selected, sq);
        return;
      }
      const v = p.b[sq];
      if (v && Math.sign(v) === p.side) setSelected(sq === selected ? null : sq);
      else setSelected(null);
    },
    [humanTurn, viewing, selected, targets, applyMove]
  );

  // Keyboard review
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea")) return;
      const last = boards.length - 1;
      const cur = viewPly ?? last;
      if (e.key === "ArrowLeft") setViewPly(Math.max(0, cur - 1));
      else if (e.key === "ArrowRight") setViewPly(cur + 1 >= last ? null : cur + 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [boards.length, viewPly]);

  const captured = (by: Side) => moves.filter((m) => m.side === by && m.captured).map((m) => m.captured);
  const playerFor = (side: Side) => {
    if (settings.mode === "local") return { name: side === 1 ? "Bên Đỏ" : "Bên Đen", avatar: `kokonut:${side === 1 ? "ben do" : "ben den"}:1`, rating: undefined };
    if (pvp && side !== mySide) return { name: pvp.name, avatar: pvp.avatar, rating: pvp.elo };
    if (side === mySide) return { name: me.username, avatar: me.avatar, rating: me.elo };
    return { name: matchOpp?.name ?? `Engine ${level.label}`, avatar: matchOpp?.avatar ?? `kokonut:ky vuong ${settings.level}:5`, rating: matchOpp?.elo ?? level.elo };
  };
  const capturedRow = (side: Side) => (
    <span className="flex flex-wrap items-center gap-0.5">
      {captured(side).map((v, i) => (
        <span
          key={i}
          className={cn("grid size-4 place-items-center rounded-full text-xs font-black", v > 0 ? "bg-[#fff1d6] text-[#c8102e]" : "bg-[#fff1d6] text-[#111]")}
        >
          {(v > 0 ? CHAR_RED : CHAR_BLACK)[Math.abs(v)]}
        </span>
      ))}
    </span>
  );

  const topSide = (-bottomSide) as Side;
  const top = playerFor(topSide);
  const bottom = playerFor(bottomSide);

  return (
    <div
      className={cn(
        "flex-1 min-h-0 relative flex flex-col w-full overflow-hidden px-2 sm:px-4 lg:px-6 py-2 transition-[padding] duration-300"
      )}
    >
      <GameHeader game="xiangqi" subtitle="Luật WXF · chống chiếu dai">
        <NarratorButton enabled={narrator.enabled} onClick={narrator.toggle} />
        {phase !== "setup" && <span className={cn("chip", rated && "border-lime-400/40 text-lime-300")}><EmojiText>{rated ? `Xếp hạng${stake ? ` · ${stake} 🌾` : ""}` : "Tập luyện"}</EmojiText></span>}
      </GameHeader>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-3 lg:gap-6 overflow-y-auto lg:overflow-hidden pb-1">
        {/* Board column */}
        <div className="flex-1 min-w-0 h-full w-full flex flex-col items-center justify-center">
          <PlayerCard
            className="mb-2 w-full max-w-[min(100%,calc((100dvh-12rem)*0.909))] lg:hidden"
            name={top.name}
            avatar={top.avatar}
            rating={top.rating}
            active={phase === "playing" && turn === topSide}
            thinking={thinking && turn === topSide}
            clockMs={tc.base ? clock[topSide] : undefined}
            accent={topSide === 1 ? "red" : "lime"}
            extra={capturedRow(topSide)}
          />

          <div className="relative flex items-center justify-center w-full aspect-[9/10] max-w-[min(100%,calc((100dvh-5.5rem)*0.9))]">
            <XqBoard
              board={shown}
              bottomSide={bottomSide}
              theme={THEMES[settings.theme] ?? THEMES.wood}
              selected={selected}
              targets={targets}
              lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null}
              checkSq={checkSq}
              hint={hint}
              animKey={viewing ? -1 : animKey}
              onSquare={onSquare}
            >
              {phase === "setup" && (
                <div className="absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-xs">
                  <button type="button" onClick={start} disabled={waitingOpp} className="btn-lime disabled:opacity-50 px-6 py-4 text-base font-bold shadow-lift">
                    <Play className="size-5" /> {waitingOpp ? "Chờ đối thủ nhận kèo" : "Bắt đầu ván"}
                  </button>
                </div>
              )}
            </XqBoard>
          </div>

          <PlayerCard
            className="mt-2 w-full max-w-[min(100%,calc((100dvh-12rem)*0.909))] lg:hidden"
            name={bottom.name}
            avatar={bottom.avatar}
            rating={bottom.rating}
            active={phase === "playing" && turn === bottomSide}
            thinking={thinking && turn === bottomSide}
            clockMs={tc.base ? clock[bottomSide] : undefined}
            accent={bottomSide === 1 ? "red" : "lime"}
            extra={capturedRow(bottomSide)}
          />
        </div>

        {/* Side panel */}
        <aside className="w-full lg:w-[280px] xl:w-[320px] shrink-0 h-full max-h-[calc(100dvh-5.5rem)] flex flex-col justify-between gap-2.5 overflow-y-auto no-scrollbar py-0.5">
          {phase !== "setup" && (
            <div className="hidden lg:block shrink-0">
              {(() => {
                const pl = playerFor(topSide);
                return (
                  <PlayerCard
                    name={pl.name}
                    avatar={pl.avatar}
                    rating={pl.rating}
                    active={phase === "playing" && turn === topSide}
                    thinking={thinking && turn === topSide}
                    clockMs={tc.base ? clock[topSide] : undefined}
                    accent={topSide === 1 ? "red" : "lime"}
                    extra={capturedRow(topSide)}
                  />
                );
              })()}
            </div>
          )}

          {phase === "setup" ? (
            <div className="panel space-y-3.5 p-4 flex-1 overflow-y-auto no-scrollbar">
              <h2 className="font-display text-lg font-extrabold">Thiết lập ván</h2>
              <div>
                <span className="label">Chế độ</span>
                <Segmented value={settings.mode} onChange={(v) => update({ mode: v })} options={[{ value: "friend", label: "Mời bạn" }, { value: "ai", label: "Đấu Engine" }, { value: "local", label: "2 người 1 máy" }]} />
              </div>
              {isAi && (
                <>
                  <div>
                    <span className="label">Độ khó</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(Object.keys(XQ_LEVELS) as XqLevel[]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => update({ level: k })}
                          className={cn("rounded-xl border p-2.5 text-left transition-colors", settings.level === k ? "border-lime-400 bg-lime-400/10" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20")}
                        >
                          <p className="text-xs font-bold">{XQ_LEVELS[k].label}</p>
                          <p className="font-mono text-xs text-ink-400">~{XQ_LEVELS[k].elo} ELO</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="label">Cầm quân</span>
                    <Segmented
                      value={settings.color}
                      onChange={(v) => update({ color: v })}
                      options={[
                        { value: 1 as Side | 0, label: "🔴 Đỏ" },
                        { value: 0 as Side | 0, label: "🎲" },
                        { value: -1 as Side | 0, label: "⚫ Đen" },
                      ]}
                    />
                  </div>
                </>
              )}
              <div>
                <span className="label">Thời gian</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {TIME_CONTROLS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => update({ time: t.id })}
                      className={cn("rounded-xl border px-2 py-2 text-center", settings.time === t.id ? "border-lime-400 bg-lime-400/10" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20")}
                    >
                      <p className="font-mono text-xs font-bold">{t.label}</p>
                      <p className="text-xs text-ink-400">{t.kind}</p>
                    </button>
                  ))}
                </div>
              </div>
              {isAi && (
                <>
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
              <div>
                <span className="label">Bàn cờ</span>
                <Segmented value={THEMES[settings.theme] ? settings.theme : "wood"} onChange={(v) => update({ theme: v })} size="sm" options={(Object.keys(THEMES) as ThemeId[]).map((k) => ({ value: k, label: THEMES[k].name }))} />
              </div>
              {isFriend && (
                <>
                  <StakePicker value={stake} onChange={(v) => { setInviteErr(null); setStake(v); }} disabled={!!fb.pending || !!fb.friend} />
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5 text-xs">
                    {fb.friend ? (
                      <p><Emoji e="✅" /> <b>{fb.friend.name}</b> đã nhận kèo {fb.bet?.stake ?? 0} <Emoji e="🌾" /> — cả hai bấm Bắt đầu để vào bàn.</p>
                    ) : fb.pending ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0"><Emoji e="⏳" /> Chờ bạn bè nhận kèo {fb.pending.stake}&nbsp;<Emoji e="🌾" /></span>
                        <button type="button" className="btn-ghost shrink-0 whitespace-nowrap px-2 py-1" onClick={() => fb.cancel(fb.pending!.id)}>Huỷ kèo</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span>Chưa có đối thủ</span>
                        <button type="button" className="btn-accent shrink-0 whitespace-nowrap px-2 py-1" onClick={() => setInviteErr(fb.invite(stake))}>Gửi kèo vào chat</button>
                      </div>
                    )}
                    {inviteErr && <p role="alert" className="mt-1 text-danger">{inviteErr}</p>}
                  </div>
                </>
              )}
              <button type="button" onClick={start} disabled={waitingOpp} className="btn-lime w-full py-2.5 font-bold disabled:opacity-50">
                <Play className="size-4" /> {waitingOpp ? "Chờ đối thủ nhận kèo" : "Bắt đầu"}
              </button>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
              <div className="panel shrink-0 space-y-2.5 p-3">
                {phase === "over" && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-center">
                    <p className="font-display text-sm font-extrabold">Ván đã kết thúc</p>
                    <p className="text-xs text-ink-300">{overReason}</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-1.5">
                  <Act label="Cầu hoà" icon={<Handshake className="size-3.5" />} onClick={offerDraw} disabled={phase !== "playing" || drawOffer === "out"} />
                  <Act label={`Đi lại ${rated ? "" : takebacksLeft}`} icon={<Undo2 className="size-3.5" />} onClick={takeback} disabled={rated || phase !== "playing" || takebacksLeft <= 0 || !moves.length} />
                  <Act label={`Gợi ý ${rated ? "" : hintsLeft}`} icon={<Lightbulb className="size-3.5" />} onClick={askHint} disabled={rated || !humanTurn || hintsLeft <= 0} />
                  <Act label="Ván mới" icon={<RotateCcw className="size-3.5" />} onClick={() => (phase === "playing" ? setConfirm("new") : backToSetup())} />
                </div>
                {phase === "playing" && drawOffer === "in" && (
                  <div className="rounded-xl border border-lime-400/40 bg-lime-400/10 p-2 text-center text-xs">
                    <p className="mb-1.5 font-bold">Đối thủ cầu hoà</p>
                    <div className="flex gap-1.5">
                      <button type="button" className="btn-lime flex-1 py-1.5 font-bold" onClick={() => { setDrawOffer(null); void online.act("draw_accept"); }}>Đồng ý</button>
                      <button type="button" className="btn-ghost flex-1 py-1.5" onClick={() => { setDrawOffer(null); void online.act("draw_decline"); }}>Từ chối</button>
                    </div>
                  </div>
                )}
                {pvp && phase === "playing" && (
                  <OnlineStatus watchers={online.watchers} watching={!!pvp?.watch} oppOnline={online.oppOnline} ready={!!online.row} canAbort={moves.length < 2} onAbort={() => void online.act("abort")} />
                )}
                {phase === "playing" && (
                  <HoldButton className="w-full text-xs" variant="red" holdingLabel="Giữ để xác nhận…" completeLabel="Đã xin thua" onHoldComplete={resign}>
                    Giữ để xin thua
                  </HoldButton>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-2">
                <XqMoveList moves={moves} viewPly={viewPly} onView={setViewPly} total={boards.length - 1} />
                <div className="panel shrink-0 p-3 text-xs leading-relaxed text-ink-300">
                  <p className="mb-1 font-bold text-ink-100">Cách đọc ký hiệu</p>
                  <p>
                    <b className="text-white">P2-5</b>: Pháo bình · <b className="text-white">M8.7</b>: Mã tiến · <b className="text-white">X1/2</b>: Xe thoái. Cột đếm từ phải→trái.
                  </p>
                </div>
              </div>
            </div>
          )}

          {phase !== "setup" && (
            <div className="hidden lg:block shrink-0">
              {(() => {
                const pl = playerFor(bottomSide);
                return (
                  <PlayerCard
                    name={pl.name}
                    avatar={pl.avatar}
                    rating={pl.rating}
                    active={phase === "playing" && turn === bottomSide}
                    thinking={thinking && turn === bottomSide}
                    clockMs={tc.base ? clock[bottomSide] : undefined}
                    accent={bottomSide === 1 ? "red" : "lime"}
                    extra={capturedRow(bottomSide)}
                  />
                );
              })()}
            </div>
          )}

          {toastNode}
        </aside>
      </div>

      {lobby && <BetLobby bo={lobby} onStart={(b) => { setLobby(null); void launchBetPvp(b); }} onLeave={() => setLobby(null)} />}
      <ConfirmDialog open={confirm === "resign"} title="Xin thua ván này?" body={rated ? "Ván xếp hạng: bạn sẽ mất ELO và tiền cược." : undefined} confirmLabel="Xin thua" danger onConfirm={resign} onCancel={() => setConfirm(null)} />
      <ConfirmDialog
        open={confirm === "new"}
        title="Bỏ ván đang chơi?"
        body={rated ? "Bỏ ván xếp hạng được tính là thua." : "Ván hiện tại sẽ bị huỷ."}
        confirmLabel="Bỏ ván"
        danger
        onConfirm={() => {
          setConfirm(null);
          if (rated) resign();
          backToSetup();
        }}
        onCancel={() => setConfirm(null)}
      />
      <MatchResultModal isOpen={resultOpen} onClose={() => setResultOpen(false)} onPlayAgain={backToSetup} resultData={result} reason={overReason} />
    </div>
  );
}

/* --------------------------------- Board ---------------------------------- */

const RED_NUMS = ["九", "八", "七", "六", "五", "四", "三", "二", "一"];
const STARS: [number, number][] = [
  [2, 1], [2, 7], [7, 1], [7, 7],
  [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
  [6, 0], [6, 2], [6, 4], [6, 6], [6, 8],
];
const PIECE_FONT = "'KaiTi','STKaiti','Kaiti SC','Noto Serif SC','SimSun',serif";

/**
 * Standard xiangqi board drawn as one SVG: 9×10 intersections, double frame,
 * river, palace diagonals, cannon/soldier marks, file numbers. Pieces are part
 * of the same SVG so edges stay crisp at any size.
 */
const XqBoard = memo(function XqBoard({
  board,
  bottomSide,
  theme,
  selected,
  targets,
  lastMove,
  checkSq,
  hint,
  onSquare,
  children,
}: {
  board: Int8Array;
  bottomSide: Side;
  theme: (typeof THEMES)[ThemeId];
  selected: number | null;
  targets: Set<number>;
  lastMove: { from: number; to: number } | null;
  checkSq: number | null;
  hint: { from: number; to: number } | null;
  animKey?: number;
  onSquare: (sq: number) => void;
  children?: React.ReactNode;
}) {
  const flip = bottomSide === -1;
  // Intersection (row, col) → SVG point; grid spans 0..8 × 0..9.
  const pt = (sq: number) => {
    const r = Math.floor(sq / 9),
      c = sq % 9;
    return flip ? { x: 8 - c, y: 9 - r } : { x: c, y: r };
  };
  const L = theme.line;
  const topNums = flip ? RED_NUMS.slice().reverse() : ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const bottomNums = flip ? ["9", "8", "7", "6", "5", "4", "3", "2", "1"] : RED_NUMS;

  const corner = (x: number, y: number, color: string, key: string) => {
    const d = 0.42,
      l = 0.14;
    return (
      <path
        key={key}
        d={`M${x - d} ${y - d + l}V${y - d}H${x - d + l} M${x + d - l} ${y - d}H${x + d}V${y - d + l} M${x + d} ${y + d - l}V${y + d}H${x + d - l} M${x - d + l} ${y + d}H${x - d}V${y + d - l}`}
        fill="none"
        stroke={color}
        strokeWidth="0.05"
        strokeLinecap="square"
      />
    );
  };

  return (
    <div className="relative aspect-[9/10] h-full w-full select-none overflow-hidden rounded-xl ring-2 ring-black/40 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.85)]" style={{ background: theme.board }}>
      <svg viewBox="-1 -1.05 10 11.1" className="absolute inset-0 h-full w-full" role="grid" aria-label="Bàn cờ tướng" shapeRendering="geometricPrecision">
        <defs>
          <radialGradient id="piece-shine" cx="38%" cy="28%" r="55%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        {/* Frame */}
        <rect x="-0.18" y="-0.18" width="8.36" height="9.36" fill="none" stroke={theme.frame} strokeWidth="0.07" />
        <g stroke={L} strokeWidth="0.028" fill="none" strokeLinecap="square">
          <rect x="0" y="0" width="8" height="9" />
          {Array.from({ length: 8 }, (_, r) => (
            <line key={`h${r}`} x1="0" y1={r + 1} x2="8" y2={r + 1} />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <g key={`v${i}`}>
              <line x1={i + 1} y1="0" x2={i + 1} y2="4" />
              <line x1={i + 1} y1="5" x2={i + 1} y2="9" />
            </g>
          ))}
          <path d="M3 0L5 2M5 0L3 2M3 7L5 9M5 7L3 9" />
          {STARS.map(([r, c]) => {
            const y = flip ? 9 - r : r;
            const x = flip ? 8 - c : c;
            const g = 0.08,
              l = 0.2;
            const arm = (sx: number, sy: number) => `M${x + sx * g} ${y + sy * (g + l)}V${y + sy * g}H${x + sx * (g + l)}`;
            return <path key={`s${r}-${c}`} d={[x > 0 ? arm(-1, -1) + arm(-1, 1) : "", x < 8 ? arm(1, -1) + arm(1, 1) : ""].join("")} />;
          })}
        </g>
        <g fill={theme.river} fontFamily={PIECE_FONT} fontSize="0.5" fontWeight="700" textAnchor="middle" dominantBaseline="central">
          <text x="2" y="4.5" letterSpacing="0.6">
            楚 河
          </text>
          <text x="6" y="4.5" letterSpacing="0.6">
            漢 界
          </text>
        </g>
        <g fill={L} fontSize="0.26" fontFamily="var(--font-mono), monospace" textAnchor="middle" dominantBaseline="central" opacity="0.8">
          {topNums.map((n, i) => (
            <text key={`t${i}`} x={i} y="-0.62" fontFamily={/\d/.test(n) ? undefined : PIECE_FONT}>
              {n}
            </text>
          ))}
          {bottomNums.map((n, i) => (
            <text key={`b${i}`} x={i} y="9.62" fontFamily={/\d/.test(n) ? undefined : PIECE_FONT}>
              {n}
            </text>
          ))}
        </g>

        {/* Last move: golden corner brackets */}
        {lastMove && [lastMove.from, lastMove.to].map((sq, i) => {
          const { x, y } = pt(sq);
          return corner(x, y, "#f59e0b", `lm${i}`);
        })}

        {/* Pieces + hit targets */}
        {Array.from({ length: 90 }, (_, sq) => {
          const { x, y } = pt(sq);
          const v = board[sq];
          const isTarget = targets.has(sq);
          const isSel = selected === sq;
          const red = v > 0;
          const t = Math.abs(v);
          const ring = red ? "#b91c1c" : "#18181b";
          const ringHL = red ? "#dc2626" : "#27272a";
          return (
            <g key={sq} onClick={() => onSquare(sq)} style={{ cursor: "pointer" }} role="gridcell" aria-label={v ? `${red ? "Đỏ" : "Đen"} ${(red ? CHAR_RED : CHAR_BLACK)[t]}` : undefined}>
              <rect x={x - 0.5} y={y - 0.5} width="1" height="1" fill="transparent" />
              {v !== 0 && (
                <g transform={`translate(${x} ${y})`}>
                  {/* Drop shadow */}
                  <circle r="0.44" fill="rgba(0,0,0,0.35)" cy="0.045" />
                  {/* Base disc — ivory for both sides, richer gradient feel */}
                  <circle r="0.435" fill={red ? "#fdf3e3" : "#f5e6cc"} stroke={isSel ? "#3b82f6" : ring} strokeWidth={isSel ? 0.075 : 0.048} />
                  {/* Inner ring */}
                  <circle r="0.348" fill="none" stroke={isSel ? "#3b82f6" : ringHL} strokeWidth="0.025" />
                  {/* Slight radial highlight */}
                  <circle r="0.38" fill="url(#piece-shine)" />
                  <text
                    y="0.02"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily={PIECE_FONT}
                    fontSize="0.51"
                    fontWeight="800"
                    fill={red ? "#9b1c1c" : "#111827"}
                    style={{ textShadow: "none" }}
                  >
                    {(red ? CHAR_RED : CHAR_BLACK)[t]}
                  </text>
                  {checkSq === sq && t === GENERAL && <circle r="0.48" fill="none" stroke="#ef4444" strokeWidth="0.07" className="animate-pulse" />}
                  {isSel && <circle r="0.43" fill="none" stroke="#60a5fa" strokeWidth="0.04" opacity="0.8" />}
                </g>
              )}
              {isTarget &&
                (v ? (
                  <circle cx={x} cy={y} r="0.46" fill="none" stroke="#3b82f6" strokeWidth="0.065" opacity="0.9" />
                ) : (
                  <circle cx={x} cy={y} r="0.13" fill="#3b82f6" opacity="0.85" />
                ))}
            </g>
          );
        })}

        {hint &&
          (() => {
            const a = pt(hint.from),
              b = pt(hint.to);
            return (
              <g pointerEvents="none">
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#16a34a" strokeWidth="0.1" strokeLinecap="round" opacity="0.85" />
                <circle cx={b.x} cy={b.y} r="0.16" fill="#16a34a" />
              </g>
            );
          })()}
      </svg>
      {children}
    </div>
  );
});

function Act({ label, icon, onClick, disabled, danger }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2.5 text-xs font-bold transition-colors disabled:opacity-30",
        danger ? "border-pop-red/30 bg-pop-red/10 text-[#ffb3bb] hover:bg-pop-red/20" : "border-white/[0.07] bg-white/[0.03] text-ink-100 hover:bg-white/[0.08]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function XqMoveList({ moves, viewPly, onView, total }: { moves: PlayedMove[]; viewPly: number | null; onView: (p: number | null) => void; total: number }) {
  const box = useRef<HTMLDivElement>(null);
  const cur = viewPly ?? total;
  useEffect(() => {
    box.current?.querySelector(`[data-ply="${cur}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cur]);
  const rows = Math.ceil(moves.length / 2);
  return (
    <div className="panel p-3 flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="mb-2 flex items-center justify-between shrink-0">
        <h3 className="font-display text-xs font-bold">Biên bản · {moves.length} nước</h3>
        <div className="flex gap-1">
          {[
            { l: "Đầu ván", i: <ChevronFirst className="size-3.5" />, f: () => onView(0) },
            { l: "Lùi", i: <ChevronLeft className="size-3.5" />, f: () => onView(Math.max(0, cur - 1)) },
            { l: "Tiến", i: <ChevronRight className="size-3.5" />, f: () => onView(cur + 1 >= total ? null : cur + 1) },
            { l: "Hiện tại", i: <ChevronLast className="size-3.5" />, f: () => onView(null) },
          ].map((b) => (
            <button key={b.l} type="button" onClick={b.f} aria-label={b.l} title={b.l} className="grid size-7 place-items-center rounded-lg bg-white/[0.04] text-ink-200 hover:bg-white/[0.1]">
              {b.i}
            </button>
          ))}
        </div>
      </div>
      <div ref={box} className="flex-1 min-h-[100px] no-scrollbar overflow-y-auto rounded-xl bg-black/25 p-1.5 font-mono text-xs">
        {moves.length === 0 ? (
          <p className="pt-8 text-center text-xs text-ink-500">Đỏ đi trước. Phím ← → để xem lại.</p>
        ) : (
          Array.from({ length: rows }, (_, i) => (
            <div key={i} className="grid grid-cols-[2.2rem_1fr_1fr] items-center">
              <span className="pl-1 text-ink-500">{i + 1}.</span>
              {[0, 1].map((k) => {
                const ply = i * 2 + k + 1;
                const m = moves[ply - 1];
                if (!m) return <span key={k} />;
                return (
                  <button
                    key={k}
                    type="button"
                    data-ply={ply}
                    onClick={() => onView(ply === total ? null : ply)}
                    className={cn(
                      "rounded-lg px-2 py-1 text-left hover:bg-white/[0.06]",
                      cur === ply ? "bg-lime-400 font-bold text-black hover:bg-lime-400" : m.side === 1 ? "text-[#ff8a8a]" : "text-ink-100"
                    )}
                  >
                    {m.notation}
                    {m.captured ? " ×" : ""}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default XiangqiGame;
