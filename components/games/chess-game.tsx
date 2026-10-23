"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, Move, Square } from "chess.js";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Copy,
  Flag,
  Handshake,
  Lightbulb,
  Play,
  Repeat,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/lib/store";
import { soundManager } from "@/lib/audio";
import { EngineClient } from "@/lib/engines/engine-client";
import { ENGINE_LEVELS, EngineLevel, SearchOptions, SearchResult } from "@/lib/engines/chess-engine";
import { cn } from "@/lib/utils";
import { ChessIcon } from "./chess-icons";
import { MatchResultModal } from "./match-result-modal";
import HoldButton from "@/components/kokonut/hold-button";
import { ConfirmDialog, GameHeader, PlayerCard, Segmented, StakePicker, useGameSession, useMatchSettlement, useToast } from "./shared";

/* --------------------------------- Config --------------------------------- */

const TIME_CONTROLS = [
  { id: "1+0", base: 60, inc: 0, label: "1+0", kind: "Bullet" },
  { id: "3+2", base: 180, inc: 2, label: "3+2", kind: "Blitz" },
  { id: "5+0", base: 300, inc: 0, label: "5+0", kind: "Blitz" },
  { id: "10+0", base: 600, inc: 0, label: "10+0", kind: "Rapid" },
  { id: "15+10", base: 900, inc: 10, label: "15+10", kind: "Rapid" },
  { id: "inf", base: 0, inc: 0, label: "∞", kind: "Không giờ" },
] as const;
type TimeId = (typeof TIME_CONTROLS)[number]["id"];

const THEMES = {
  tournament: { name: "Giải đấu", light: "#edeed1", dark: "#779952", hlLast: "rgba(246,246,105,0.65)", hlSel: "rgba(20,85,30,0.4)" },
  wood: { name: "Gỗ cổ điển", light: "#f0d9b5", dark: "#b58863", hlLast: "rgba(205,210,106,0.65)", hlSel: "rgba(20,85,30,0.4)" },
  mono: { name: "Đá cẩm thạch", light: "#e2e8f0", dark: "#64748b", hlLast: "rgba(250,204,21,0.45)", hlSel: "rgba(30,41,59,0.35)" },
  ice: { name: "Băng tuyết", light: "#e0f2fe", dark: "#38bdf8", hlLast: "rgba(125,211,252,0.6)", hlSel: "rgba(3,105,161,0.35)" },
} as const;
type ThemeId = keyof typeof THEMES;

// prettier-ignore
const OPENINGS: [string, string][] = [
  ["e4", "Khai cuộc Tốt Vua"], ["d4", "Khai cuộc Tốt Hậu"], ["c4", "Khai cuộc Anh"], ["Nf3", "Khai cuộc Réti"],
  ["e4 e5", "Khai cuộc mở"], ["e4 c5", "Phòng thủ Sicilia"], ["e4 e6", "Phòng thủ Pháp"], ["e4 c6", "Phòng thủ Caro-Kann"],
  ["e4 d5", "Phòng thủ Scandinavia"], ["e4 d6", "Phòng thủ Pirc"], ["e4 Nf6", "Phòng thủ Alekhine"], ["e4 Nc6", "Phòng thủ Nimzowitsch"], ["e4 b6", "Phòng thủ Owen"], ["e4 g6", "Phòng thủ Hiện đại"],
  ["e4 e5 f4", "Gambit Vua"], ["e4 e5 Nc3", "Ván cờ Vienna"], ["e4 e5 Nf3 Nf6", "Phòng thủ Petrov"], ["e4 e5 Nf3 d6", "Phòng thủ Philidor"],
  ["e4 e5 Nf3 Nc6 Bc4", "Ván cờ Ý"], ["e4 e5 Nf3 Nc6 Bc4 Bc5", "Giuoco Piano"], ["e4 e5 Nf3 Nc6 Bc4 Nf6", "Phòng thủ Hai Mã"],
  ["e4 e5 Nf3 Nc6 Bb5", "Tây Ban Nha (Ruy López)"], ["e4 e5 Nf3 Nc6 Bb5 a6", "Ruy López — Morphy"], ["e4 e5 Nf3 Nc6 d4", "Ván cờ Scotland"],
  ["e4 c5 Nf3 d6", "Sicilia — biến cổ điển"], ["e4 c5 Nf3 Nc6", "Sicilia — hệ Mã"], ["e4 c5 Nf3 e6", "Sicilia — biến Pháp"],
  ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6", "Sicilia Najdorf"], ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6", "Sicilia Rồng"],
  ["d4 d5 c4", "Gambit Hậu"], ["d4 d5 c4 e6", "Gambit Hậu từ chối"], ["d4 d5 c4 dxc4", "Gambit Hậu chấp nhận"], ["d4 d5 c4 c6", "Phòng thủ Slav"],
  ["d4 Nf6 c4 g6", "Ấn Độ cổ (King's Indian)"], ["d4 Nf6 c4 e6", "Phòng thủ Ấn Độ"], ["d4 Nf6 c4 e6 Nc3 Bb4", "Phòng thủ Nimzo-Ấn"],
  ["d4 f5", "Phòng thủ Hà Lan"], ["d4 d5 Bf4", "Hệ thống London"], ["d4 Nf6 Bf4", "Hệ thống London"], ["d4 d5 Nf3 Nf6 Bf4", "Hệ thống London"],
];

function openingName(sans: string[]) {
  const line = sans.join(" ");
  let best = "";
  for (const [k, v] of OPENINGS) if ((line === k || line.startsWith(k + " ")) && k.length > best.length) best = v;
  return best || null;
}

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const START_COUNT: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };

function materialInfo(fen: string) {
  const counts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } } as Record<"w" | "b", Record<string, number>>;
  for (const ch of fen.split(" ")[0]) {
    const l = ch.toLowerCase();
    if (!"pnbrq".includes(l)) continue;
    counts[ch === l ? "b" : "w"][l]++;
  }
  const capturedBy = (side: "w" | "b") => {
    const opp = side === "w" ? "b" : "w";
    const out: string[] = [];
    for (const t of ["q", "r", "b", "n", "p"]) for (let i = counts[opp][t]; i < START_COUNT[t]; i++) out.push(t);
    return out;
  };
  const score = (side: "w" | "b") => Object.entries(counts[side]).reduce((a, [t, n]) => a + VALUES[t] * n, 0);
  return { capturedByWhite: capturedBy("w"), capturedByBlack: capturedBy("b"), diff: score("w") - score("b") };
}

const makeEngine = () =>
  typeof window !== "undefined"
    ? new EngineClient<{ fen: string; opts: SearchOptions }, SearchResult>(
        () => new Worker(new URL("../../lib/engines/chess.worker.ts", import.meta.url)),
        async ({ fen, opts }) => (await import("@/lib/engines/chess-engine")).searchBestMove(fen, opts)
      )
    : null;
// Two workers: one plays, one answers hints / draw offers without interrupting play.
const engine = makeEngine();
const analyst = makeEngine();

type Phase = "setup" | "playing" | "over";

interface ChessSave {
  settings: Settings;
  stake: number;
  myColor: "w" | "b";
  moves: { from: string; to: string; promotion?: string }[];
  clock: { w: number | null; b: number | null };
  hintsLeft: number;
  takebacksLeft: number;
}
type Mode = "ai" | "local";

interface Settings {
  mode: Mode;
  level: EngineLevel;
  color: "w" | "b" | "random";
  time: TimeId;
  ranked: boolean;
  theme: ThemeId;
}

const DEFAULT_SETTINGS: Settings = { mode: "ai", level: "medium", color: "w", time: "10+0", ranked: true, theme: "tournament" };

function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem("oa-chess-settings") || "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/* ---------------------------------- Game ---------------------------------- */

export function ChessGame() {
  const me = useAppStore(useShallow((s) => ({ username: s.currentUser.username, avatar: s.currentUser.avatar, elo: s.currentUser.eloChess })));
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const { isChatOpen, isChatCollapsed } = useAppStore(
    useShallow((s) => ({
      isChatOpen: s.isChatOpen,
      isChatCollapsed: s.isChatCollapsed,
    }))
  );
  const isChatVisible = isChatOpen && !isChatCollapsed;
  const { settle, reset: resetSettlement, result, open: resultOpen, setOpen: setResultOpen } = useMatchSettlement("chess");
  const { show: showToast, node: toastNode } = useToast();
  const session = useGameSession<ChessSave>("chess");

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => setSettings(loadSettings()), []);
  const updateSettings = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem("oa-chess-settings", JSON.stringify(next));
      } catch {}
      return next;
    });

  const [stake, setStake] = useState(0);
  useEffect(() => {
    const s = parseInt(new URLSearchParams(window.location.search).get("stake") || "", 10);
    if (s > 0) setStake(s);
  }, []);

  const chessRef = useRef(new Chess());
  const [fens, setFens] = useState<string[]>([chessRef.current.fen()]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [myColor, setMyColor] = useState<"w" | "b">("w");
  const [flipped, setFlipped] = useState(false);
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState<{ from: Square; to: Square } | null>(null);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [takebacksLeft, setTakebacksLeft] = useState(3);
  const [evalCp, setEvalCp] = useState<number | null>(null);
  const [overReason, setOverReason] = useState<string>("");
  const [confirm, setConfirm] = useState<null | "resign" | "new">(null);
  const [animKey, setAnimKey] = useState(0);
  const lastWasDrag = useRef(false);

  const tc = TIME_CONTROLS.find((t) => t.id === settings.time)!;
  // Live clock in a ref; the visible copy only re-renders when the shown digits change.
  const clockRef = useRef({ w: tc.base * 1000 || Infinity, b: tc.base * 1000 || Infinity });
  const [clock, setClockView] = useState(clockRef.current);
  const syncClock = useCallback(() => setClockView({ ...clockRef.current }), []);
  const tickRef = useRef<number | null>(null);

  const level = ENGINE_LEVELS[settings.level];
  const isAi = settings.mode === "ai";
  const rated = isAi && settings.ranked;

  const chess = chessRef.current;
  const liveFen = fens[fens.length - 1];
  const shownFen = viewPly === null ? liveFen : fens[viewPly];
  const viewing = viewPly !== null && viewPly !== fens.length - 1;
  const turn = liveFen.split(" ")[1] as "w" | "b";
  const humanTurn = phase === "playing" && (settings.mode === "local" || turn === myColor);
  const orientation: "w" | "b" = (settings.mode === "local" ? "w" : myColor) === "w" ? (flipped ? "b" : "w") : flipped ? "w" : "b";

  const shownBoard = useMemo(() => new Chess(shownFen).board(), [shownFen]);
  const material = useMemo(() => materialInfo(shownFen), [shownFen]);
  const opening = useMemo(() => openingName(moves.map((m) => m.san)), [moves]);
  const lastMove = viewing ? moves[(viewPly ?? 1) - 1] : moves[moves.length - 1];
  const inCheckSquare = useMemo(() => {
    const c = new Chess(shownFen);
    if (!c.inCheck()) return null;
    const t = c.turn();
    for (const row of c.board()) for (const p of row) if (p && p.type === "k" && p.color === t) return p.square;
    return null;
  }, [shownFen]);

  const legalTargets = useMemo(() => {
    if (!selected || viewing) return new Set<string>();
    return new Set(chess.moves({ square: selected, verbose: true }).map((m) => m.to));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, viewing, liveFen]);

  const play = useCallback(
    (kind: "move" | "capture" | "check" | "castle" | "promotion" | "end") => {
      if (!soundEnabled) return;
      if (kind === "capture") soundManager.playChessCapture();
      else if (kind === "check") soundManager.playChessCheck();
      else if (kind === "castle") soundManager.playChessCastle();
      else if (kind === "promotion") soundManager.playChessPromotion();
      else if (kind === "end") soundManager.playVictory();
      else soundManager.playChessMove();
    },
    [soundEnabled]
  );

  /* ------------------------------ Game end ------------------------------ */

  const finish = useCallback(
    (winner: "w" | "b" | null, reason: string) => {
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
      engine?.cancel();
      setThinking(false);
      setPhase("over");
      setOverReason(reason);
      setSelected(null);
      play("end");
      if (rated) {
        const outcome = winner === null ? "draw" : winner === myColor ? "win" : "loss";
        settle(outcome, { name: `Engine ${level.label}`, elo: level.elo }, stake);
      } else {
        showToast(winner === null ? `Hoà — ${reason}` : `${winner === "w" ? "Trắng" : "Đen"} thắng — ${reason}`, "info", 4000);
      }
    },
    [rated, myColor, level, stake, settle, play, showToast]
  );

  const checkGameEnd = useCallback(() => {
    const c = chessRef.current;
    if (c.isCheckmate()) finish(c.turn() === "w" ? "b" : "w", "Chiếu hết");
    else if (c.isStalemate()) finish(null, "Hết nước đi (pat)");
    else if (c.isInsufficientMaterial()) finish(null, "Không đủ lực chiếu hết");
    else if (c.isThreefoldRepetition()) finish(null, "Lặp lại thế cờ 3 lần");
    else if (c.isDraw()) finish(null, "Luật 50 nước");
    else return false;
    return true;
  }, [finish]);

  /* ------------------------------ Moves ------------------------------ */

  const applyMove = useCallback(
    (from: string, to: string, promo?: string, viaDrag = false) => {
      const c = chessRef.current;
      let mv: Move;
      try {
        mv = c.move({ from, to, promotion: promo });
      } catch {
        return false;
      }
      const mover = mv.color;
      if (tc.base && tc.inc) {
        clockRef.current[mover] += tc.inc * 1000;
        syncClock();
      }
      lastWasDrag.current = viaDrag;
      setAnimKey((k) => k + 1);
      setMoves((ms) => [...ms, mv]);
      setFens((fs) => [...fs, c.fen()]);
      setViewPly(null);
      setSelected(null);
      setHint(null);
      if (c.inCheck()) play("check");
      else if (mv.promotion) play("promotion");
      else if (mv.captured) play("capture");
      else if (mv.flags.includes("k") || mv.flags.includes("q")) play("castle");
      else play("move");
      checkGameEnd();
      return true;
    },
    [checkGameEnd, play, tc, syncClock]
  );

  const tryUserMove = useCallback(
    (from: Square, to: Square, viaDrag = false) => {
      const c = chessRef.current;
      if (!c.get(from)) return false;
      const legal = c.moves({ square: from, verbose: true }).filter((m) => m.to === to);
      if (!legal.length) return false;
      if (legal.some((m) => m.promotion)) {
        setPromotion({ from, to });
        return true;
      }
      return applyMove(from, to, undefined, viaDrag);
    },
    [applyMove]
  );

  const isOwnPiece = useCallback(
    (sq: Square) => {
      const p = chessRef.current.get(sq);
      return !!p && p.color === turn && (settings.mode === "local" || p.color === myColor);
    },
    [turn, settings.mode, myColor]
  );

  /* ------------------------------ AI turn ------------------------------ */

  useEffect(() => {
    if (phase !== "playing" || !isAi || turn === myColor || !engine) return;
    let alive = true;
    setThinking(true);
    const remaining = clockRef.current[turn];
    const budget = remaining === Infinity ? level.timeMs : Math.max(150, Math.min(level.timeMs, remaining / 25));
    const started = performance.now();
    engine.request({ fen: liveFen, opts: { maxDepth: level.maxDepth, timeMs: budget, noise: level.noise } }).then((r) => {
      if (!alive || !r) return;
      // Feel human: never answer instantly.
      const wait = Math.max(0, 350 - (performance.now() - started));
      setTimeout(() => {
        if (!alive) return;
        setThinking(false);
        if (r.move) {
          setEvalCp(turn === "w" ? r.score : -r.score);
          applyMove(r.move.from, r.move.to, r.move.promotion);
        }
      }, wait);
    });
    return () => {
      alive = false;
    };
  }, [phase, isAi, turn, myColor, liveFen, level, applyMove]);

  /* ------------------------------ Clock ------------------------------ */

  useEffect(() => {
    if (phase !== "playing" || !tc.base || moves.length < 2) return;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      const side = chessRef.current.turn();
      const before = clockRef.current[side];
      const left = before - dt;
      if (left <= 0) {
        clockRef.current[side] = 0;
        syncClock();
        // FIDE 6.9: flag loses unless the opponent cannot possibly mate.
        const opp = side === "w" ? "b" : "w";
        const oppPieces = chessRef.current
          .board()
          .flat()
          .filter((p) => p && p.color === opp && p.type !== "k");
        const canMate = oppPieces.some((p) => p!.type !== "n" && p!.type !== "b") || oppPieces.length >= 2;
        finish(canMate ? opp : null, canMate ? "Hết giờ" : "Hết giờ, đối thủ không đủ lực");
        return;
      }
      clockRef.current[side] = left;
      const unit = left < 10000 ? 100 : 1000;
      if (Math.floor(left / unit) !== Math.floor(before / unit)) syncClock();
      tickRef.current = requestAnimationFrame(loop);
    };
    tickRef.current = requestAnimationFrame(loop);
    return () => {
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
    };
  }, [phase, tc.base, moves.length, finish, syncClock]);

  /* ------------------------------ Session ------------------------------ */

  // Resume a game left unfinished (once, on mount).
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = session.load();
    if (!saved) return;
    const p = saved.payload;
    const c = new Chess();
    const mv: Move[] = [];
    const fs = [c.fen()];
    for (const m of p.moves) {
      try {
        mv.push(c.move(m));
        fs.push(c.fen());
      } catch {
        break;
      }
    }
    if (c.isGameOver()) return session.clear();
    chessRef.current = c;
    setSettings(p.settings);
    setStake(p.stake);
    setMyColor(p.myColor);
    setMoves(mv);
    setFens(fs);
    clockRef.current = { w: p.clock.w ?? Infinity, b: p.clock.b ?? Infinity };
    syncClock();
    setHintsLeft(p.hintsLeft);
    setTakebacksLeft(p.takebacksLeft);
    setPhase("playing");
    showToast("Đã khôi phục ván đang dở ♟", "good");
  }, [session, syncClock, showToast]);

  const persistRef = useRef<() => void>(() => {});
  persistRef.current = () => {
    if (phase !== "playing") return;
    const finite = (v: number) => (v === Infinity ? null : Math.round(v));
    session.save(
      {
        settings,
        stake,
        myColor,
        moves: moves.map((m) => ({ from: m.from, to: m.to, promotion: m.promotion })),
        clock: { w: finite(clockRef.current.w), b: finite(clockRef.current.b) },
        hintsLeft,
        takebacksLeft,
      },
      {
        label: `Nước ${Math.max(1, Math.ceil(moves.length / 2))} · cầm ${myColor === "w" ? "Trắng" : "Đen"}`,
        detail: settings.mode === "ai" ? `vs Engine ${ENGINE_LEVELS[settings.level].label}` : "2 người 1 máy",
        progress: Math.min(1, moves.length / 80),
      }
    );
  };
  useEffect(() => {
    if (phase === "playing") persistRef.current();
    else if (phase === "over") session.clear();
  }, [phase, moves.length, session]);
  // Leaving the page keeps the exact clock.
  useEffect(() => () => persistRef.current(), []);

  /* ------------------------------ Actions ------------------------------ */

  const startGame = () => {
    engine?.cancel();
    const c = new Chess();
    chessRef.current = c;
    const color = settings.color === "random" ? (Math.random() < 0.5 ? "w" : "b") : settings.color;
    setMyColor(settings.mode === "local" ? "w" : color);
    setFlipped(false);
    setFens([c.fen()]);
    setMoves([]);
    setViewPly(null);
    setSelected(null);
    setPromotion(null);
    setHint(null);
    setEvalCp(null);
    setHintsLeft(3);
    setTakebacksLeft(3);
    clockRef.current = { w: tc.base * 1000 || Infinity, b: tc.base * 1000 || Infinity };
    syncClock();
    analyst?.cancel();
    resetSettlement();
    setPhase("playing");
  };

  const backToSetup = () => {
    engine?.cancel();
    setThinking(false);
    setPhase("setup");
    setResultOpen(false);
  };

  const resign = () => {
    setConfirm(null);
    if (phase !== "playing") return;
    const loser = settings.mode === "local" ? turn : myColor;
    finish(loser === "w" ? "b" : "w", settings.mode === "local" ? `${loser === "w" ? "Trắng" : "Đen"} xin thua` : "Bạn xin thua");
  };

  const offerDraw = async () => {
    if (phase !== "playing") return;
    if (settings.mode === "local") return finish(null, "Hai bên thoả thuận hoà");
    if (!analyst) return;
    showToast("Đã gửi lời cầu hoà…");
    const r = await analyst.request({ fen: liveFen, opts: { maxDepth: 4, timeMs: 400 } });
    if (!r) return;
    const aiScore = turn === myColor ? -r.score : r.score;
    const accept = aiScore <= -120 || (Math.abs(aiScore) <= 40 && moves.length >= 40);
    if (accept) finish(null, "Engine chấp nhận cầu hoà");
    else showToast("Engine từ chối: “Ván này còn đánh được.”", "bad");
  };

  const takeback = () => {
    if (rated || phase !== "playing" || takebacksLeft <= 0 || thinking) return;
    const c = chessRef.current;
    const n = isAi ? (turn === myColor ? 2 : 1) : 1;
    if (moves.length < n) return;
    engine?.cancel();
    for (let i = 0; i < n; i++) c.undo();
    setMoves((ms) => ms.slice(0, -n));
    setFens((fs) => fs.slice(0, -n));
    setTakebacksLeft((t) => t - 1);
    setSelected(null);
    setHint(null);
    setViewPly(null);
  };

  const askHint = async () => {
    if (rated || !humanTurn || hintsLeft <= 0 || !analyst) return;
    showToast("Đang tìm nước hay…");
    const r = await analyst.request({ fen: liveFen, opts: { maxDepth: 8, timeMs: 900 } });
    if (r?.move) {
      setHint({ from: r.move.from as Square, to: r.move.to as Square });
      setHintsLeft((h) => h - 1);
    }
  };

  const copyPgn = () => {
    const c = chessRef.current;
    c.header("Event", "Office Arena", "White", myColor === "w" ? me.username : isAi ? `Engine ${level.label}` : "Đối thủ", "Black", myColor === "b" ? me.username : isAi ? `Engine ${level.label}` : "Đối thủ");
    navigator.clipboard?.writeText(c.pgn()).then(() => showToast("Đã chép PGN", "good"), () => showToast("Không chép được", "bad"));
  };

  useEffect(
    () => () => {
      engine?.cancel();
      analyst?.cancel();
    },
    []
  );

  /* ------------------------------ Keyboard ------------------------------ */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea")) return;
      const last = fens.length - 1;
      const cur = viewPly ?? last;
      if (e.key === "ArrowLeft") setViewPly(Math.max(0, cur - 1));
      else if (e.key === "ArrowRight") setViewPly(cur + 1 >= last ? null : cur + 1);
      else if (e.key === "ArrowUp") setViewPly(0);
      else if (e.key === "ArrowDown") setViewPly(null);
      else if (e.key.toLowerCase() === "f") setFlipped((f) => !f);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fens.length, viewPly]);

  /* ------------------------------ Render ------------------------------ */

  const topColor = orientation === "w" ? "b" : "w";
  const bottomColor = orientation;
  const playerFor = (color: "w" | "b") => {
    if (settings.mode === "local") return { name: color === "w" ? "Trắng" : "Đen", avatar: `kokonut:${color === "w" ? "quan trang" : "quan den"}:2`, rating: undefined };
    if (color === myColor) return { name: me.username, avatar: me.avatar, rating: me.elo };
    return { name: `Engine ${level.label}`, avatar: `kokonut:engine ${settings.level}:4`, rating: level.elo };
  };
  const capturedRow = (color: "w" | "b") => {
    const caps = color === "w" ? material.capturedByWhite : material.capturedByBlack;
    const adv = color === "w" ? material.diff : -material.diff;
    return (
      <span className="flex items-center">
        {caps.map((t, i) => (
          <ChessIcon key={i} type={t} color={color === "w" ? "b" : "w"} className="-mr-1.5 size-4" />
        ))}
        {adv > 0 && <span className="ml-2 font-mono text-[11px] font-bold text-ink-200">+{adv}</span>}
      </span>
    );
  };

  return (
    <div
      className={cn(
        "flex-1 min-h-0 relative flex flex-col w-full overflow-hidden px-2 sm:px-4 lg:px-6 py-2 transition-[padding] duration-300",
        isChatVisible ? "lg:pr-[395px] xl:pr-[435px]" : ""
      )}
    >
      <GameHeader game="chess" subtitle={opening ? `📖 ${opening}` : "Luật FIDE · Engine 4 cấp · Đồng hồ có cộng giờ"}>
        {phase !== "setup" && (
          <span className={cn("chip", rated ? "border-lime-400/40 text-lime-300" : "")}>{rated ? `Xếp hạng${stake ? ` · ${stake} 🌾` : ""}` : "Tập luyện"}</span>
        )}
      </GameHeader>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-3 lg:gap-6 overflow-y-auto lg:overflow-hidden pb-1">
        {/* Board column - Maximized Full Area */}
        <div className="flex-1 min-w-0 h-full w-full flex flex-col items-center justify-center">
          {(() => {
            const p = playerFor(topColor);
            return (
              <PlayerCard
                className="mb-2 w-full max-w-[min(100%,calc(100dvh-12rem))] lg:hidden"
                name={p.name}
                avatar={p.avatar}
                rating={p.rating}
                active={phase === "playing" && turn === topColor}
                thinking={thinking && turn === topColor}
                clockMs={tc.base ? clock[topColor] : undefined}
                extra={capturedRow(topColor)}
              />
            );
          })()}

          <div className="relative flex items-center justify-center gap-2 h-full max-h-[calc(100dvh-5.5rem)] aspect-square max-w-[min(100%,calc(100dvh-5.5rem))]">
            {evalCp !== null && !rated && <EvalBar cp={evalCp} orientation={orientation} />}
            <Board
              board={shownBoard}
              orientation={orientation}
              theme={THEMES[settings.theme] ?? THEMES.tournament ?? THEMES.mono}
              selected={selected}
              targets={legalTargets}
              lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null}
              checkSquare={inCheckSquare}
              hint={hint}
              animKey={viewing ? -1 : animKey}
              animate={!viewing && !lastWasDrag.current}
              canInteract={humanTurn && !viewing && !promotion}
              isOwnPiece={isOwnPiece}
              onSelect={setSelected}
              onMove={tryUserMove}
            >
              {promotion && (
                <PromotionPicker
                  color={turn}
                  file={promotion.to.charCodeAt(0) - 97}
                  orientation={orientation}
                  onPick={(t) => {
                    const pr = promotion;
                    setPromotion(null);
                    applyMove(pr.from, pr.to, t);
                  }}
                  onCancel={() => setPromotion(null)}
                />
              )}
              {phase === "setup" && (
                <div className="absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-xs">
                  <button type="button" onClick={startGame} className="btn-lime px-6 py-4 text-base font-bold shadow-lift">
                    <Play className="size-5" /> Bắt đầu ván
                  </button>
                </div>
              )}
            </Board>
          </div>

          {(() => {
            const p = playerFor(bottomColor);
            return (
              <PlayerCard
                className="mt-2 w-full max-w-[min(100%,calc(100dvh-12rem))] lg:hidden"
                name={p.name}
                avatar={p.avatar}
                rating={p.rating}
                active={phase === "playing" && turn === bottomColor}
                thinking={thinking && turn === bottomColor}
                clockMs={tc.base ? clock[bottomColor] : undefined}
                extra={capturedRow(bottomColor)}
              />
            );
          })()}
        </div>

        {/* Side panel */}
        <aside className="w-full lg:w-[280px] xl:w-[320px] shrink-0 h-full max-h-[calc(100dvh-5.5rem)] flex flex-col justify-between gap-2.5 overflow-y-auto no-scrollbar py-0.5">
          {phase !== "setup" && (
            <div className="hidden lg:block shrink-0">
              {(() => {
                const p = playerFor(topColor);
                return (
                  <PlayerCard
                    name={p.name}
                    avatar={p.avatar}
                    rating={p.rating}
                    active={phase === "playing" && turn === topColor}
                    thinking={thinking && turn === topColor}
                    clockMs={tc.base ? clock[topColor] : undefined}
                    extra={capturedRow(topColor)}
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
                <Segmented
                  value={settings.mode}
                  onChange={(v) => updateSettings({ mode: v })}
                  options={[
                    { value: "ai", label: "Đấu Engine" },
                    { value: "local", label: "2 người 1 máy" },
                  ]}
                />
              </div>
              {isAi && (
                <>
                  <div>
                    <span className="label">Độ khó</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(Object.keys(ENGINE_LEVELS) as EngineLevel[]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => updateSettings({ level: k })}
                          className={cn(
                            "rounded-xl border p-2.5 text-left transition-colors",
                            settings.level === k ? "border-lime-400 bg-lime-400/10" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"
                          )}
                        >
                          <p className="text-xs font-bold">{ENGINE_LEVELS[k].label}</p>
                          <p className="font-mono text-[10px] text-ink-400">~{ENGINE_LEVELS[k].elo} ELO</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="label">Cầm quân</span>
                    <Segmented
                      value={settings.color}
                      onChange={(v) => updateSettings({ color: v })}
                      options={[
                        { value: "w", label: "♔ Trắng" },
                        { value: "random", label: "🎲 Random" },
                        { value: "b", label: "♚ Đen" },
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
                      onClick={() => updateSettings({ time: t.id })}
                      className={cn(
                        "rounded-xl border px-2 py-2 text-center transition-colors",
                        settings.time === t.id ? "border-lime-400 bg-lime-400/10" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"
                      )}
                    >
                      <p className="font-mono text-xs font-bold">{t.label}</p>
                      <p className="text-[9px] text-ink-400">{t.kind}</p>
                    </button>
                  ))}
                </div>
              </div>
              {isAi && (
                <>
                  <div>
                    <span className="label">Loại ván</span>
                    <Segmented
                      value={settings.ranked ? "r" : "t"}
                      onChange={(v) => updateSettings({ ranked: v === "r" })}
                      options={[
                        { value: "r", label: "Xếp hạng" },
                        { value: "t", label: "Tập luyện" },
                      ]}
                    />
                  </div>
                  {settings.ranked && <StakePicker value={stake} onChange={setStake} />}
                </>
              )}
              <div>
                <span className="label">Bàn cờ</span>
                <div className="flex gap-2">
                  {(Object.keys(THEMES) as ThemeId[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => updateSettings({ theme: k })}
                      title={THEMES[k].name}
                      className={cn("grid size-9 grid-cols-2 overflow-hidden rounded-xl border-2 transition-transform hover:scale-105", settings.theme === k ? "border-lime-400" : "border-transparent")}
                    >
                      <span style={{ background: THEMES[k].light }} />
                      <span style={{ background: THEMES[k].dark }} />
                      <span style={{ background: THEMES[k].dark }} />
                      <span style={{ background: THEMES[k].light }} />
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={startGame} className="btn-lime w-full py-2.5 font-bold">
                <Play className="size-4" /> Bắt đầu
              </button>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
              <div className="panel shrink-0 space-y-2.5 p-3">
                {phase === "over" && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-center">
                    <p className="font-display text-sm font-extrabold">Ván đã kết thúc</p>
                    <p className="text-[11px] text-ink-300">{overReason}</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-1.5">
                  <IconAction label="Cầu hoà" icon={<Handshake className="size-3.5" />} onClick={offerDraw} disabled={phase !== "playing"} />
                  <IconAction label={`Đi lại ${rated ? "" : takebacksLeft}`} icon={<Undo2 className="size-3.5" />} onClick={takeback} disabled={rated || phase !== "playing" || takebacksLeft <= 0 || moves.length === 0} />
                  <IconAction label={`Gợi ý ${rated ? "" : hintsLeft}`} icon={<Lightbulb className="size-3.5" />} onClick={askHint} disabled={rated || !humanTurn || hintsLeft <= 0} />
                  <IconAction label="Xoay bàn" icon={<Repeat className="size-3.5" />} onClick={() => setFlipped((f) => !f)} />
                  <IconAction label="PGN" icon={<Copy className="size-3.5" />} onClick={copyPgn} disabled={moves.length === 0} />
                  <IconAction label="Ván mới" icon={<RotateCcw className="size-3.5" />} onClick={() => (phase === "playing" ? setConfirm("new") : backToSetup())} wide />
                </div>
                {phase === "playing" && (
                  <HoldButton className="w-full text-xs" variant="red" holdingLabel="Giữ để xác nhận…" completeLabel="Đã xin thua" onHoldComplete={resign}>
                    Giữ để xin thua
                  </HoldButton>
                )}
              </div>

              {/* Flex-1 Move History */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <MoveList moves={moves} viewPly={viewPly} onView={setViewPly} total={fens.length - 1} />
              </div>
            </div>
          )}

          {phase !== "setup" && (
            <div className="hidden lg:block shrink-0">
              {(() => {
                const p = playerFor(bottomColor);
                return (
                  <PlayerCard
                    name={p.name}
                    avatar={p.avatar}
                    rating={p.rating}
                    active={phase === "playing" && turn === bottomColor}
                    thinking={thinking && turn === bottomColor}
                    clockMs={tc.base ? clock[bottomColor] : undefined}
                    extra={capturedRow(bottomColor)}
                  />
                );
              })()}
            </div>
          )}

          {toastNode}
        </aside>
      </div>

      <ConfirmDialog
        open={confirm === "resign"}
        title="Xin thua ván này?"
        body={rated ? "Ván xếp hạng: bạn sẽ mất ELO và tiền cược." : undefined}
        confirmLabel="Xin thua"
        danger
        onConfirm={resign}
        onCancel={() => setConfirm(null)}
      />
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

type BoardCell = ReturnType<Chess["board"]>[number][number];

const Board = memo(function Board({
  board,
  orientation,
  theme,
  selected,
  targets,
  lastMove,
  checkSquare,
  hint,
  animKey,
  animate,
  canInteract,
  isOwnPiece,
  onSelect,
  onMove,
  children,
}: {
  board: BoardCell[][];
  orientation: "w" | "b";
  theme: (typeof THEMES)[ThemeId];
  selected: Square | null;
  targets: Set<string>;
  lastMove: { from: string; to: string } | null;
  checkSquare: string | null;
  hint: { from: Square; to: Square } | null;
  animKey: number;
  animate: boolean;
  canInteract: boolean;
  isOwnPiece: (sq: Square) => boolean;
  onSelect: (sq: Square | null) => void;
  onMove: (from: Square, to: Square, viaDrag?: boolean) => boolean;
  children?: React.ReactNode;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ from: Square; x0: number; y0: number; moved: boolean; id: number } | null>(null);
  const [dragFrom, setDragFrom] = useState<Square | null>(null);

  const squareAt = (x: number, y: number): Square | null => {
    const r = boardRef.current?.getBoundingClientRect();
    if (!r) return null;
    const fx = Math.floor(((x - r.left) / r.width) * 8);
    const fy = Math.floor(((y - r.top) / r.height) * 8);
    if (fx < 0 || fx > 7 || fy < 0 || fy > 7) return null;
    const file = orientation === "w" ? fx : 7 - fx;
    const rank = orientation === "w" ? 7 - fy : fy;
    return `${"abcdefgh"[file]}${rank + 1}` as Square;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canInteract || e.button !== 0) return;
    const sq = squareAt(e.clientX, e.clientY);
    if (!sq) return;
    if (selected && targets.has(sq)) {
      onMove(selected, sq);
      return;
    }
    if (isOwnPiece(sq)) {
      onSelect(sq);
      drag.current = { from: sq, x0: e.clientX, y0: e.clientY, moved: false, id: e.pointerId };
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* synthetic or already-released pointer */
      }
    } else onSelect(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 5) {
      d.moved = true;
      setDragFrom(d.from);
    }
    if (d.moved && ghostRef.current && boardRef.current) {
      const r = boardRef.current.getBoundingClientRect();
      const size = r.width / 8;
      ghostRef.current.style.transform = `translate(${e.clientX - r.left - size / 2}px, ${e.clientY - r.top - size / 2}px)`;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    setDragFrom(null);
    if (!d.moved) return;
    const sq = squareAt(e.clientX, e.clientY);
    if (sq && sq !== d.from && targets.has(sq)) onMove(d.from, sq, true);
  };

  const rows = orientation === "w" ? board : [...board].reverse().map((r) => [...r].reverse());
  const dragPiece = dragFrom ? board.flat().find((p) => p?.square === dragFrom) : null;

  const sqCenter = (sq: string) => {
    const f = sq.charCodeAt(0) - 97;
    const r = +sq[1] - 1;
    const x = orientation === "w" ? f : 7 - f;
    const y = orientation === "w" ? 7 - r : r;
    return { x: x * 12.5 + 6.25, y: y * 12.5 + 6.25, col: x, row: y };
  };

  return (
    <div
      ref={boardRef}
      className="relative aspect-square h-full w-full select-none overflow-hidden rounded-xl touch-none ring-1 ring-white/20 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.85)]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null;
        setDragFrom(null);
      }}
      role="grid"
      aria-label="Bàn cờ vua"
    >
      <div
        className="grid h-full w-full grid-cols-8 grid-rows-8"
        // One seamless checker layer: no hairline gaps between 64 fractional-pixel cells.
        style={{ background: `repeating-conic-gradient(${theme.dark} 0 25%, ${theme.light} 0 50%) 0 0 / 25% 25%` }}
      >
        {rows.map((row, ri) =>
          row.map((_, ci) => {
            const file = orientation === "w" ? ci : 7 - ci;
            const rank = orientation === "w" ? 7 - ri : ri;
            const sq = `${"abcdefgh"[file]}${rank + 1}`;
            const piece = board[7 - rank][file];
            const dark = (file + rank) % 2 === 0;
            const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
            const isSel = selected === sq;
            const isTarget = targets.has(sq);
            const slide = animate && lastMove && lastMove.to === sq && piece;
            let slideStyle: React.CSSProperties | undefined;
            if (slide) {
              const a = sqCenter(lastMove!.from);
              const b = sqCenter(lastMove!.to);
              slideStyle = { ["--dx" as string]: `${(a.col - b.col) * 100}%`, ["--dy" as string]: `${(a.row - b.row) * 100}%` };
            }
            return (
              <div key={sq} className="relative" role="gridcell" aria-label={sq}>
                {isLast && <div className="absolute inset-0" style={{ background: theme.hlLast }} />}
                {isSel && <div className="absolute inset-0" style={{ background: theme.hlSel }} />}
                {checkSquare === sq && <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(239,68,68,0.95)_0%,rgba(239,68,68,0.5)_45%,transparent_72%)] animate-pulse" />}
                {ci === 0 && (
                  <span className="absolute left-1 top-0.5 text-[10px] font-bold sm:text-xs select-none pointer-events-none" style={{ color: dark ? theme.light : theme.dark }}>
                    {rank + 1}
                  </span>
                )}
                {ri === 7 && (
                  <span className="absolute bottom-0.5 right-1 text-[10px] font-bold sm:text-xs select-none pointer-events-none" style={{ color: dark ? theme.light : theme.dark }}>
                    {"abcdefgh"[file]}
                  </span>
                )}
                {piece && (
                  <div
                    key={slide ? `s${animKey}` : "p"}
                    className={cn("absolute inset-[3.5%] z-10 flex items-center justify-center", slide && "animate-piece-slide", dragFrom === sq && "opacity-30")}
                    style={slideStyle}
                  >
                    <ChessIcon type={piece.type} color={piece.color} className="h-full w-full pointer-events-none select-none" />
                  </div>
                )}
                {isTarget &&
                  (piece ? (
                    <div className="absolute inset-1 z-20 rounded-full border-[3.5px] border-lime-400/80 bg-lime-400/20 shadow-sm" />
                  ) : (
                    <div className="absolute left-1/2 top-1/2 z-20 size-[32%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/40 ring-1 ring-white/30 backdrop-blur-[1px]" />
                  ))}
              </div>
            );
          })
        )}
      </div>

      {hint && (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 z-30 h-full w-full">
          <defs>
            <marker id="hint-head" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
              <path d="M0 0 L4 2 L0 4Z" fill="#d4ff3a" />
            </marker>
          </defs>
          {(() => {
            const a = sqCenter(hint.from);
            const b = sqCenter(hint.to);
            return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#d4ff3a" strokeOpacity="0.85" strokeWidth="2.2" strokeLinecap="round" markerEnd="url(#hint-head)" />;
          })()}
        </svg>
      )}

      {dragPiece && (
        <div ref={ghostRef} className="pointer-events-none absolute left-0 top-0 z-40 aspect-square w-[12.5%] scale-110">
          <ChessIcon type={dragPiece.type} color={dragPiece.color} className="h-full w-full" />
        </div>
      )}
      {children}
    </div>
  );
});

function PromotionPicker({
  color,
  file,
  orientation,
  onPick,
  onCancel,
}: {
  color: "w" | "b";
  file: number;
  orientation: "w" | "b";
  onPick: (t: "q" | "r" | "b" | "n") => void;
  onCancel: () => void;
}) {
  const col = orientation === "w" ? file : 7 - file;
  const fromTop = (color === "w") === (orientation === "w");
  return (
    <div className="absolute inset-0 z-50 bg-black/40" onPointerDown={(e) => (e.stopPropagation(), onCancel())}>
      <div
        className={cn("absolute flex w-[12.5%] flex-col overflow-hidden rounded-md border border-black/20 bg-white shadow-lg", !fromTop && "flex-col-reverse")}
        style={{ left: `${col * 12.5}%`, [fromTop ? "top" : "bottom"]: 0 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {(["q", "n", "r", "b"] as const).map((t) => (
          <button key={t} type="button" onClick={() => onPick(t)} className="aspect-square p-[8%] hover:bg-lime-300" aria-label={`Phong ${t}`}>
            <ChessIcon type={t} color={color} className="h-full w-full" />
          </button>
        ))}
      </div>
    </div>
  );
}

function EvalBar({ cp, orientation }: { cp: number; orientation: "w" | "b" }) {
  const mate = Math.abs(cp) > 90000;
  const clamped = Math.max(-1000, Math.min(1000, cp));
  const whitePct = mate ? (cp > 0 ? 100 : 0) : 50 + 50 * (2 / (1 + Math.exp(-clamped / 250)) - 1);
  const label = mate ? "M" : (Math.abs(cp) / 100).toFixed(1);
  return (
    <div className={cn("relative w-3 shrink-0 overflow-hidden rounded-full border border-black bg-ink-800 sm:w-4", orientation === "b" && "rotate-180")} title={`Đánh giá: ${cp > 0 ? "+" : ""}${(cp / 100).toFixed(2)}`}>
      <div className="absolute inset-x-0 bottom-0 bg-white transition-[height] duration-500" style={{ height: `${whitePct}%` }} />
      <span className={cn("absolute inset-x-0 text-center text-[8px] font-bold", cp >= 0 ? "bottom-1 text-black" : "top-1 text-white", orientation === "b" && "rotate-180")}>{label}</span>
    </div>
  );
}

function IconAction({ label, icon, onClick, disabled, danger, wide }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; wide?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2.5 text-[11px] font-bold transition-colors disabled:opacity-30",
        danger ? "border-pop-red/30 bg-pop-red/10 text-[#ffb3bb] hover:bg-pop-red/20" : "border-white/[0.07] bg-white/[0.03] text-ink-100 hover:bg-white/[0.08]",
        wide && "col-span-1"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function MoveList({ moves, viewPly, onView, total }: { moves: Move[]; viewPly: number | null; onView: (p: number | null) => void; total: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const current = viewPly ?? total;
  useEffect(() => {
    boxRef.current?.querySelector(`[data-ply="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);
  const rows = Math.ceil(moves.length / 2);
  return (
    <div className="panel p-3 h-full flex flex-col overflow-hidden">
      <div className="mb-2 flex items-center justify-between shrink-0">
        <h3 className="font-display text-xs font-bold">Biên bản · {moves.length} nước</h3>
        <div className="flex gap-1">
          <NavBtn label="Đầu ván" onClick={() => onView(0)} icon={<ChevronFirst className="size-3.5" />} />
          <NavBtn label="Lùi" onClick={() => onView(Math.max(0, current - 1))} icon={<ChevronLeft className="size-3.5" />} />
          <NavBtn label="Tiến" onClick={() => onView(current + 1 >= total ? null : current + 1)} icon={<ChevronRight className="size-3.5" />} />
          <NavBtn label="Hiện tại" onClick={() => onView(null)} icon={<ChevronLast className="size-3.5" />} />
        </div>
      </div>
      <div ref={boxRef} className="flex-1 min-h-[120px] no-scrollbar overflow-y-auto rounded-xl bg-black/25 p-1.5 font-mono text-xs">
        {moves.length === 0 ? (
          <p className="pt-8 text-center text-[11px] text-ink-500">Chưa có nước nào. Phím ← → để xem lại.</p>
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
                    className={cn("rounded-lg px-2 py-1 text-left hover:bg-white/[0.06]", current === ply ? "bg-lime-400 font-bold text-black hover:bg-lime-400" : "text-ink-100")}
                  >
                    {m.san}
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

function NavBtn({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="grid size-8 place-items-center rounded-lg bg-white/[0.04] text-ink-200 hover:bg-white/[0.1] hover:text-white">
      {icon}
    </button>
  );
}

export default ChessGame;
