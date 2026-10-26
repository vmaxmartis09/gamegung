"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flag, Play, Undo2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/lib/store";
import { soundManager } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { describeEnd, openBetMatch, opponentOf, slotOf, useOnlineMatch } from "@/lib/online-match";
import { MatchResultModal } from "./match-result-modal";
import { NarratorButton, useNarrator } from "./game-fx";
import { ConfirmDialog, GameHeader, OnlineStatus, PlayerCard, Segmented, StakePicker, useFriendBet, useMatchOpponent, useMatchSettlement, useToast, waitForBetOpponent } from "./shared";
import { Emoji, EmojiText } from "@/components/ui/emoji";

const N = 15;
const NO_CLOCK_MS = 24 * 3600 * 1000;
type Side = 1 | 2; // 1 = X (đi trước), 2 = O
type Cell = 0 | Side;
type Level = "easy" | "medium" | "hard";
const DIRS: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]];

const LEVELS: Record<Level, { label: string; elo: number }> = {
  easy: { label: "Dễ", elo: 900 },
  medium: { label: "Vừa", elo: 1200 },
  hard: { label: "Khó", elo: 1500 },
};

interface Settings {
  mode: "ai" | "local" | "friend";
  level: Level;
  color: Side | 0;
  ranked: boolean;
}
const DEFAULTS: Settings = { mode: "ai", level: "medium", color: 1, ranked: true };

interface PvpInfo {
  room: string;
  oppId: string;
  name: string;
  avatar: string;
  elo?: number;
}

function buildBoard(moves: number[]): Cell[] {
  const b: Cell[] = Array(N * N).fill(0);
  moves.forEach((m, i) => (b[m] = i % 2 === 0 ? 1 : 2));
  return b;
}

function winLine(b: Cell[], idx: number): number[] | null {
  const p = b[idx];
  if (!p) return null;
  const x = idx % N, y = (idx / N) | 0;
  for (const [dx, dy] of DIRS) {
    const line = [idx];
    for (const s of [1, -1]) {
      let cx = x + dx * s, cy = y + dy * s;
      while (cx >= 0 && cy >= 0 && cx < N && cy < N && b[cy * N + cx] === p) {
        line.push(cy * N + cx);
        cx += dx * s;
        cy += dy * s;
      }
    }
    if (line.length >= 5) return line;
  }
  return null;
}

function scoreCell(b: Cell[], idx: number, p: Cell): number {
  const x = idx % N, y = (idx / N) | 0;
  let total = 0;
  for (const [dx, dy] of DIRS) {
    let len = 1, open = 0;
    for (const s of [1, -1]) {
      let cx = x + dx * s, cy = y + dy * s;
      while (cx >= 0 && cy >= 0 && cx < N && cy < N && b[cy * N + cx] === p) {
        len++;
        cx += dx * s;
        cy += dy * s;
      }
      if (cx >= 0 && cy >= 0 && cx < N && cy < N && b[cy * N + cx] === 0) open++;
    }
    if (len >= 5) total += 100000;
    else if (len === 4) total += open === 2 ? 10000 : open === 1 ? 1000 : 0;
    else if (len === 3) total += open === 2 ? 1000 : open === 1 ? 100 : 0;
    else if (len === 2) total += open === 2 ? 100 : open === 1 ? 10 : 0;
    else total += open;
  }
  return total;
}

function aiMove(b: Cell[], me: Side, level: Level): number {
  const opp: Side = me === 1 ? 2 : 1;
  const empty: number[] = [];
  const near: number[] = [];
  let any = false;
  for (let i = 0; i < b.length; i++) {
    if (b[i]) { any = true; continue; }
    empty.push(i);
    const x = i % N, y = (i / N) | 0;
    let close = false;
    for (let dy = -2; dy <= 2 && !close; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const cx = x + dx, cy = y + dy;
        if (cx >= 0 && cy >= 0 && cx < N && cy < N && b[cy * N + cx]) { close = true; break; }
      }
    if (close) near.push(i);
  }
  if (!any) return 7 * N + 7;
  const cand = near.length ? near : empty;
  if (level === "easy" && Math.random() < 0.35) return cand[(Math.random() * cand.length) | 0];
  const defend = level === "easy" ? 0.6 : level === "medium" ? 0.9 : 1.1;
  let best = cand[0], bestScore = -1;
  for (const i of cand) {
    const s = scoreCell(b, i, me) * 1.05 + scoreCell(b, i, opp) * defend + Math.random() * 2;
    if (s > bestScore) { bestScore = s; best = i; }
  }
  return best;
}

function Mark({ side, win }: { side: Side; win?: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 20 20"
      className="size-[72%]"
      initial={{ scale: 0, rotate: side === 1 ? -50 : 0, opacity: 0 }}
      animate={win ? { scale: [1, 1.22, 1], rotate: 0, opacity: 1 } : { scale: 1, rotate: 0, opacity: 1 }}
      transition={win ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" } : { type: "spring", stiffness: 520, damping: 18 }}
    >
      {side === 1 ? (
        <g stroke="#f6f1e7" strokeWidth="3" strokeLinecap="round">
          <motion.path d="M4 4 L16 16" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.18 }} />
          <motion.path d="M16 4 L4 16" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.18, delay: 0.1 }} />
        </g>
      ) : (
        <motion.circle cx="10" cy="10" r="6.2" fill="none" stroke="#d9b870" strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3 }} />
      )}
    </motion.svg>
  );
}

export function CaroGame() {
  const me = useAppStore(useShallow((s) => ({ username: s.currentUser.username, avatar: s.currentUser.avatar, elo: s.currentUser.eloCaro || 1200 })));
  const myId = useAppStore((s) => s.currentUser.id);
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const { settle, reset: resetSettlement, result, open: resultOpen, setOpen: setResultOpen } = useMatchSettlement("caro");
  const { show: showToast, node: toastNode } = useToast();
  const narrator = useNarrator();
  const matchOpp = useMatchOpponent();

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  useEffect(() => {
    try {
      setSettings({ ...DEFAULTS, ...JSON.parse(localStorage.getItem("oa-caro-settings") || "{}") });
    } catch {}
  }, []);
  const update = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem("oa-caro-settings", JSON.stringify(next));
      } catch {}
      return next;
    });

  const [phase, setPhase] = useState<"setup" | "playing" | "over">("setup");
  const [moves, setMoves] = useState<number[]>([]);
  const [mySide, setMySide] = useState<Side>(1);
  const [win, setWin] = useState<number[] | null>(null);
  const [overReason, setOverReason] = useState("");
  const [winner, setWinner] = useState<Cell>(0);
  const [stake, setStake] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<"resign" | "new" | null>(null);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [pvp, setPvp] = useState<PvpInfo | null>(null);
  const pvpRef = useRef<PvpInfo | null>(null);
  pvpRef.current = pvp;
  const finishedRef = useRef(false);
  const movesRef = useRef<number[]>([]);
  movesRef.current = moves;
  const pendingMove = useRef(false);

  useEffect(() => {
    const s = parseInt(new URLSearchParams(window.location.search).get("stake") || "", 10);
    if (s > 0) setStake(s);
  }, []);

  const online = useOnlineMatch(pvp?.room ?? null, myId);
  const onlineRef = useRef(online);
  onlineRef.current = online;

  const isFriend = settings.mode === "friend";
  const fb = useFriendBet("caro");
  useEffect(() => {
    if (isFriend && fb.bet && fb.bet.stake !== stake) setStake(fb.bet.stake);
  }, [isFriend, fb.bet, stake]);
  const waitingOpp = isFriend && !fb.friend;

  const board = useMemo(() => buildBoard(moves), [moves]);
  const turn: Side = moves.length % 2 === 0 ? 1 : 2;
  const level = LEVELS[settings.level];
  const isAi = settings.mode === "ai";
  const rated = (isAi && settings.ranked) || !!pvp;
  const playing = phase === "playing";
  const myTurn = playing && (settings.mode === "local" || (turn === mySide && (!pvp || !!online.row)));
  const aiTurn = playing && isAi && turn !== mySide;
  const last = moves[moves.length - 1];
  const winSet = useMemo(() => new Set(win ?? []), [win]);

  const sound = useCallback(
    (kind: "move" | "win" | "lose") => {
      if (!soundEnabled) return;
      if (kind === "move") soundManager.playChessMove();
      else if (kind === "win") soundManager.playChessCapture();
    },
    [soundEnabled]
  );

  const finish = useCallback(
    (w: Cell, reason: string, line: number[] | null, settleIt = true) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setWinner(w);
      setWin(line);
      setOverReason(reason);
      setPhase("over");
      if (settleIt && (rated || stake > 0) && settings.mode !== "local") {
        const outcome = w === 0 ? "draw" : w === mySide ? "win" : "loss";
        const p = pvpRef.current;
        settle(outcome, { name: p?.name ?? matchOpp?.name ?? `Caro AI ${level.label}`, elo: p ? p.elo ?? 1200 : matchOpp?.elo ?? level.elo }, stake);
      } else if (!settleIt) showToast(reason, "info", 4000);
      sound(w === mySide || settings.mode === "local" ? "win" : "lose");
      if (settleIt) {
        if (w === 0) narrator.say("Ván đấu kết thúc với tỉ số hoà.", "gm_draw");
        else if (w === mySide || settings.mode === "local") narrator.say("Chúc mừng, bạn đã chiến thắng!", "gm_win");
        else narrator.say("Rất tiếc, bạn đã thua. Ván sau nhé!", "gm_lose");
      }
    },
    [rated, stake, settings.mode, mySide, level, matchOpp, settle, sound, showToast, narrator]
  );

  const play = useCallback(
    (idx: number, remote = false) => {
      const cur = movesRef.current;
      if (cur.includes(idx) || finishedRef.current) return;
      const next = [...cur, idx];
      const b = buildBoard(next);
      const line = winLine(b, idx);
      const full = next.length === N * N;
      const mover: Side = cur.length % 2 === 0 ? 1 : 2;
      movesRef.current = next;
      setMoves(next);
      setHover(null);
      sound("move");
      if (pvpRef.current && !remote) {
        pendingMove.current = true;
        void onlineRef.current
          .sendMove(cur.length, idx, line ? "win" : full ? "draw" : undefined, line ? "Đủ 5 quân liền" : full ? "Kín bàn" : undefined)
          .finally(() => {
            pendingMove.current = false;
          });
      }
      if (line) finish(mover, "Đủ 5 quân liền", line);
      else if (full) finish(0, "Kín bàn", null);
    },
    [sound, finish]
  );

  // AI reply
  useEffect(() => {
    if (!aiTurn) return;
    const t = setTimeout(() => play(aiMove(buildBoard(movesRef.current), turn, settings.level)), 450 + Math.random() * 350);
    return () => clearTimeout(t);
  }, [aiTurn, turn, settings.level, play]);

  // Reconcile with the server row (realtime, poll, or my own move's reply).
  const loadedMatch = useRef<string | null>(null);
  useEffect(() => {
    const r = online.row;
    if (!r || !pvp || r.id !== pvp.room) return;
    const first = loadedMatch.current !== r.id;
    const mine: Side = slotOf(r, myId) as Side;
    if (first) {
      loadedMatch.current = r.id;
      setMySide(mine);
      const o = opponentOf(r, myId);
      setPvp((p) => (p && p.room === r.id ? { ...p, oppId: o.id, name: o.name, avatar: o.avatar || p.avatar, elo: o.elo } : p));
      setStake(r.stake);
    }
    const remote = (r.moves as unknown[]).map(Number);
    const local = movesRef.current;
    const same = local.every((m, i) => remote[i] === m);
    if (!same || (remote.length < local.length && !pendingMove.current)) {
      movesRef.current = remote;
      setMoves(remote);
    } else if (remote.length > local.length) {
      if (first || remote.length - local.length > 2) {
        movesRef.current = remote;
        setMoves(remote);
      } else for (const m of remote.slice(local.length)) play(m, true);
    }
    if (r.status === "finished" && !finishedRef.current) {
      const end = describeEnd(r, myId);
      const lastMove = remote[remote.length - 1];
      const line = lastMove !== undefined && end.outcome !== "draw" && end.outcome !== "abort" ? winLine(buildBoard(remote), lastMove) : null;
      const w: Cell = end.outcome === "draw" || end.outcome === "abort" ? 0 : end.outcome === "win" ? mine : mine === 1 ? 2 : 1;
      finish(w, end.reason, line, end.outcome !== "abort" && !first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online.row]);

  useEffect(() => {
    if (online.error) showToast(online.error, "bad", 5000);
  }, [online.error, showToast]);

  const begin = (side: Side) => {
    finishedRef.current = false;
    movesRef.current = [];
    setMoves([]);
    setWin(null);
    setWinner(0);
    setOverReason("");
    setMySide(side);
    resetSettlement();
    setPhase("playing");
    narrator.say("Bắt đầu ván đấu! Chúc bạn may mắn.", "gm_start");
  };

  async function startBetPvp(bo: { room: string; oppId: string; name: string; avatar: string; stake: number }) {
    const row = await openBetMatch({
      id: bo.room,
      game: "caro",
      oppId: bo.oppId,
      stake: bo.stake,
      me: { name: me.username, avatar: me.avatar },
      opp: { name: bo.name, avatar: bo.avatar },
      baseMs: NO_CLOCK_MS,
    });
    if (!row) return showToast("Không mở được bàn online — cần đăng nhập tài khoản.", "bad", 4000);
    loadedMatch.current = null;
    setSettings((s) => ({ ...s, mode: "friend" }));
    setPvp({ room: bo.room, oppId: bo.oppId, name: bo.name, avatar: bo.avatar });
    setStake(bo.stake);
    begin(1);
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("bet")) {
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
      void startBetPvp({ room: fb.friend.betId, oppId: fb.friend.id, name: fb.friend.name, avatar: fb.friend.avatar, stake: fb.bet?.stake ?? stake });
      return;
    }
    setPvp(null);
    begin(settings.mode === "local" ? 1 : settings.color === 0 ? (Math.random() < 0.5 ? 1 : 2) : settings.color);
  };

  const backToSetup = () => {
    setPvp(null);
    loadedMatch.current = null;
    finishedRef.current = false;
    setConfirm(null);
    setResultOpen(false);
    setPhase("setup");
    setMoves([]);
    setWin(null);
  };

  const resign = () => {
    setConfirm(null);
    if (pvp) return void online.act("resign");
    finish(mySide === 1 ? 2 : 1, "Bạn xin thua", null);
  };

  const undo = () => {
    if (!playing || pvp || rated || !moves.length) return;
    const drop = isAi ? (turn === mySide && moves.length >= 2 ? 2 : 1) : 1;
    const keep = moves.slice(0, moves.length - drop);
    movesRef.current = keep;
    setMoves(keep);
  };

  const playerFor = (side: Side) => {
    if (settings.mode === "local") return { name: side === 1 ? "Bên ✕" : "Bên ◯", avatar: `kokonut:ben ${side}:1`, rating: undefined as number | undefined };
    if (side === mySide) return { name: me.username, avatar: me.avatar, rating: me.elo };
    if (pvp) return { name: pvp.name, avatar: pvp.avatar, rating: pvp.elo };
    return { name: matchOpp?.name ?? `Caro AI ${level.label}`, avatar: matchOpp?.avatar ?? `kokonut:caro ai ${settings.level}:5`, rating: matchOpp?.elo ?? level.elo };
  };

  const status =
    phase === "over"
      ? winner === 0
        ? "Hoà cờ"
        : settings.mode === "local"
        ? `${winner === 1 ? "✕" : "◯"} thắng!`
        : winner === mySide
        ? "Bạn thắng! 🎉"
        : "Bạn thua"
      : aiTurn
      ? "AI đang nghĩ…"
      : pvp && !myTurn
      ? "Chờ đối thủ…"
      : settings.mode === "local"
      ? `Lượt ${turn === 1 ? "✕" : "◯"}`
      : "Lượt của bạn";

  const winCenter = useMemo(() => {
    if (!win) return null;
    const pts = win.map((i) => ({ x: (i % N) + 0.5, y: ((i / N) | 0) + 0.5 }));
    pts.sort((a, b) => a.x - b.x || a.y - b.y);
    return [pts[0], pts[pts.length - 1]];
  }, [win]);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-3 py-3">
      <GameHeader game="caro" subtitle="5 quân liền nhau là thắng">
        <NarratorButton enabled={narrator.enabled} onClick={narrator.toggle} />
        {phase !== "setup" && <span className={cn("chip", rated && "border-lime-400/40 text-lime-300")}><EmojiText>{rated ? `Xếp hạng${stake ? ` · ${stake} 🌾` : ""}` : "Tập luyện"}</EmojiText></span>}
      </GameHeader>
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col items-center justify-center gap-2">
          {phase !== "setup" && (
            <PlayerCard className="w-full max-w-[640px]" name={playerFor(mySide === 1 ? 2 : 1).name} avatar={playerFor(mySide === 1 ? 2 : 1).avatar} rating={playerFor(mySide === 1 ? 2 : 1).rating} active={playing && turn !== mySide} thinking={aiTurn} accent="lime" />
          )}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative aspect-square w-full max-w-[min(100%,640px)] overflow-hidden rounded-2xl border border-white/10 bg-[#0e2038] shadow-[0_20px_60px_-20px_rgba(0,0,0,.8)]"
          >
            <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }} onMouseLeave={() => setHover(null)}>
              {board.map((c, i) => {
                const canPlay = myTurn && !c;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!canPlay}
                    onMouseEnter={() => canPlay && setHover(i)}
                    onClick={() => play(i)}
                    aria-label={`Hàng ${((i / N) | 0) + 1}, cột ${(i % N) + 1}`}
                    className={cn(
                      "relative grid aspect-square place-items-center border border-white/[0.07] transition-colors",
                      canPlay && "cursor-pointer hover:bg-white/[0.08]",
                      winSet.has(i) && "bg-lime-400/20"
                    )}
                  >
                    {i === last && !winSet.has(i) && (
                      <motion.span className="absolute inset-[12%] rounded-full border-2 border-[#d9b870]" initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 0.85 }} transition={{ duration: 0.35 }} />
                    )}
                    {c ? <Mark side={c} win={winSet.has(i)} /> : hover === i && canPlay ? <span className="size-[55%] opacity-30"><Mark side={turn} /></span> : null}
                  </button>
                );
              })}
            </div>
            {winCenter && (
              <svg viewBox={`0 0 ${N} ${N}`} className="pointer-events-none absolute inset-0 size-full">
                <motion.line
                  x1={winCenter[0].x} y1={winCenter[0].y} x2={winCenter[1].x} y2={winCenter[1].y}
                  stroke="#a3e635" strokeWidth="0.22" strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.9 }} transition={{ duration: 0.6, delay: 0.2 }}
                />
              </svg>
            )}
          </motion.div>
          {phase !== "setup" && (
            <PlayerCard className="w-full max-w-[640px]" name={playerFor(mySide).name} avatar={playerFor(mySide).avatar} rating={playerFor(mySide).rating} active={playing && turn === mySide} accent="red" />
          )}
        </div>

        <aside className="flex min-h-0 flex-col gap-3">
          {phase === "setup" ? (
            <div className="panel space-y-3 p-4">
              <div>
                <span className="label">Chế độ</span>
                <Segmented value={settings.mode} onChange={(v) => update({ mode: v })} options={[{ value: "ai", label: "Đấu AI" }, { value: "local", label: "2 người 1 máy" }, { value: "friend", label: "Mời bạn" }]} />
              </div>
              {isAi && (
                <>
                  <div>
                    <span className="label">Cấp AI</span>
                    <Segmented value={settings.level} onChange={(v) => update({ level: v })} options={(Object.keys(LEVELS) as Level[]).map((k) => ({ value: k, label: LEVELS[k].label, hint: `~${LEVELS[k].elo} ELO` }))} />
                  </div>
                  <div>
                    <span className="label">Quân của bạn</span>
                    <Segmented<number> value={settings.color} onChange={(v) => update({ color: v as Side | 0 })} options={[{ value: 1, label: "✕ đi trước" }, { value: 2, label: "◯ đi sau" }, { value: 0, label: "Ngẫu nhiên" }]} />
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
            <div className="panel space-y-3 p-4">
              <AnimatePresence mode="wait">
                <motion.p key={status} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} className="text-center font-display text-lg font-bold">
                  {status}
                </motion.p>
              </AnimatePresence>
              <p className="text-center text-xs text-ink-400">{moves.length} nước{overReason && phase === "over" ? ` · ${overReason}` : ""}</p>
              {pvp && playing && <OnlineStatus oppOnline={online.oppOnline} ready={!!online.row} canAbort={moves.length < 2} onAbort={() => void online.act("abort")} />}
              {playing ? (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={undo} disabled={!!pvp || rated || !moves.length} className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-xs font-bold hover:bg-white/[0.08] disabled:opacity-30">
                    <Undo2 className="size-4" /> Đi lại
                  </button>
                  <button type="button" onClick={() => (rated || pvp ? setConfirm("resign") : setConfirm("new"))} className="flex items-center justify-center gap-1.5 rounded-2xl border border-pop-red/30 bg-pop-red/10 px-3 py-2.5 text-xs font-bold text-[#ffb3bb] hover:bg-pop-red/20">
                    <Flag className="size-4" /> {rated || pvp ? "Xin thua" : "Thoát"}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={backToSetup} className="btn-lime w-full py-2.5 font-bold">
                  Ván mới
                </button>
              )}
            </div>
          )}
          {toastNode}
        </aside>
      </div>

      <ConfirmDialog open={confirm === "resign"} title="Xin thua ván này?" body={rated ? "Ván xếp hạng: bạn sẽ mất ELO và tiền cược." : undefined} confirmLabel="Xin thua" danger onConfirm={resign} onCancel={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === "new"} title="Bỏ ván đang chơi?" body="Ván hiện tại sẽ bị huỷ." confirmLabel="Bỏ ván" danger onConfirm={backToSetup} onCancel={() => setConfirm(null)} />
      <MatchResultModal isOpen={resultOpen} onClose={() => setResultOpen(false)} onPlayAgain={backToSetup} resultData={result} reason={overReason} />
    </div>
  );
}

export default CaroGame;
