"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Copy, Crown, Eye, Globe2, LayoutGrid, LogIn, Moon, Orbit, Play, RotateCcw, Send, Square, Sun, Timer, UserPlus, Users, Vote, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/lib/store";
import { soundManager } from "@/lib/audio";
import { DeathCause, NightStep, ROLE_INFO, ROLE_SETS, Role, WPlayer, WState, isWolf, teamOf } from "@/lib/games/werewolf-engine";
import { useWerewolfRoom, wwCreate, wwJoin, wwLeave, wwListOpen, WwMe, WwOpenRoom, WwRoom, WwSeat } from "@/lib/werewolf-online";
import { playNarratorVoice } from "@/lib/narrator-audio";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { GradientCarousel, VoteCandidate } from "@/components/reactbits/gradient-carousel";
import { MatchResultModal } from "./match-result-modal";
import { ConfirmDialog, GameHeader, Segmented, useMatchSettlement } from "./shared";
import { validateRoles } from "./werewolf-lobby";
import { WerewolfRoleRandomizer } from "./werewolf-role-randomizer";
import { WerewolfRoundtable } from "./werewolf-roundtable";
import { WerewolfActionFxOverlay, WerewolfFxEvent, FxType } from "./werewolf-action-fx";
import { useWerewolfVoice, WerewolfMicButton } from "./werewolf-voice";
import { SeatCard } from "./werewolf-seat";
import { Emoji, EmojiText } from "@/components/ui/emoji";

/* Ma Sói online: phòng chờ + bàn chơi. Mọi trạng thái đến từ server (lib/werewolf-online.ts). */

const BLITZ: Role[] = ["wolf", "wolf_cub", "seer", "witch", "villager", "villager"];
const PRESETS: Record<number, Role[]> = { 6: BLITZ, 8: ROLE_SETS[8], 10: ROLE_SETS[10], 12: ROLE_SETS[12] };

const STEP_LABEL: Record<string, string> = {
  cupid: "💘 Thần Tình Yêu đang se duyên",
  guard: "🛡️ Bảo Vệ đang chọn người",
  wolves: "🐺 Bầy Sói đang săn mồi",
  white_wolf: "⚪ Sói Trắng thức giấc",
  seer: "🔮 Tiên Tri đang soi",
  witch: "🧪 Phù Thủy đang pha thuốc",
};

const FX_BY_CAUSE: Partial<Record<DeathCause, FxType>> = { wolf: "claw", white_wolf: "claw", poison: "poison", hunter: "hunter", vote: "execution" };

type PickKind = "cupid" | "guard" | "wolf" | "white_wolf" | "seer" | "poison" | "vote" | "hunter";

const PICK_ACTION: Record<PickKind, { label: string; tone: "red" | "violet" | "emerald" | "pink" | "amber" }> = {
  cupid: { label: "Se duyên", tone: "pink" },
  guard: { label: "Bảo vệ", tone: "emerald" },
  wolf: { label: "Cắn", tone: "red" },
  white_wolf: { label: "Cắn", tone: "red" },
  seer: { label: "Soi", tone: "violet" },
  poison: { label: "Đầu độc", tone: "red" },
  vote: { label: "Bỏ phiếu", tone: "amber" },
  hunter: { label: "Bắn", tone: "red" },
};

const sid = (seat: number) => String(seat);

/** Dựng WState tối thiểu cho các thành phần bàn chơi dùng chung với chế độ offline. */
function toWState(room: WwRoom, me: WwMe, seats: WwSeat[], players: WPlayer[]): WState {
  return {
    players,
    day: room.day,
    phase: room.phase === "verdict" ? "dawn" : room.phase,
    step: (room.step || "done") as NightStep,
    lastGuarded: null,
    guard: null,
    wolfTarget: null,
    wolfTarget2: null,
    whiteWolfTarget: null,
    wolfBonusKills: 0,
    lovers: me.lovers ? [sid(me.lovers[0]), sid(me.lovers[1])] : null,
    cupidTarget1: null,
    cupidTarget2: null,
    cupidDone: false,
    elderLives: {},
    seerCheck: null,
    healed: false,
    poisonTarget: null,
    healUsed: false,
    poisonUsed: false,
    seerResults: {},
    sus: {},
    votes: Object.fromEntries(seats.filter((s) => s.voted).map((s) => [sid(s.seat), null])),
    log: [],
    winner: room.winner,
    pendingHunter: room.pendingHunter !== null ? sid(room.pendingHunter) : null,
    afterHunter: null,
    dawnDeaths: [],
  };
}

/* ------------------------------- Entry (sảnh) ------------------------------- */

/** Khối "Chơi online" trong sảnh Ma Sói: mở phòng với bộ vai đang chọn, hoặc vào bằng mã. */
export function WerewolfOnlineEntry({ roles, onEnter }: { roles: Role[]; onEnter: (roomId: string) => void }) {
  const me = useAppStore(useShallow((s) => ({ username: s.currentUser.username, avatar: s.currentUser.avatar })));
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<WwOpenRoom[]>([]);
  const rolesError = validateRoles(roles);

  useEffect(() => {
    let alive = true;
    const load = () => void wwListOpen().then((r) => alive && setOpen(r));
    load();
    const t = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const join = async (id: string) => {
    if (!id.trim()) return;
    setBusy("join");
    setError(null);
    const r = await wwJoin(id, me.username, me.avatar);
    setBusy(null);
    if (r.id) onEnter(r.id);
    else setError(r.error);
  };
  const create = async () => {
    setBusy("create");
    setError(null);
    const r = await wwCreate(me.username, me.avatar, roles);
    setBusy(null);
    if (r.id) onEnter(r.id);
    else setError(r.error);
  };

  return (
    <section className="panel mb-5 p-4 sm:p-5" aria-labelledby="ww-online-title">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-accent/15 text-accent">
          <Globe2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="ww-online-title" className="font-display text-base font-extrabold text-white">Chơi online với đồng nghiệp</h2>
          <p className="text-sm text-ink-300">Mở phòng với bộ vai đang chọn bên dưới, hoặc nhập mã phòng. Thiếu người thì bot ngồi thay.</p>
        </div>
        <Button variant="solid" onClick={create} loading={busy === "create"} disabled={!!rolesError || !!busy} title={rolesError ?? undefined}>
          <Play className="size-4" /> Mở phòng ({roles.length})
        </Button>
      </div>

      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void join(code);
        }}
      >
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          placeholder="Mã phòng"
          aria-label="Mã phòng"
          className="w-36 font-mono uppercase tracking-[0.2em]"
        />
        <Button type="submit" variant="ghost" loading={busy === "join"} disabled={code.length < 6 || !!busy}>
          <LogIn className="size-4" /> Vào phòng
        </Button>
        {open.length > 0 && <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />}
        {open.slice(0, 6).map((r) => (
          <button key={r.id} type="button" className="chip transition hover:bg-white/10" disabled={!!busy} onClick={() => void join(r.id)}>
            <Users className="size-3" /> {r.host ?? "Phòng"} · {r.players}/{r.size}
          </button>
        ))}
      </form>
      {error && <p className="mt-2 text-sm font-semibold text-danger">{error}</p>}
    </section>
  );
}

/* --------------------------------- Phòng --------------------------------- */

export function WerewolfOnline({ roomId, onExit }: { roomId: string; onExit: () => void }) {
  const r = useWerewolfRoom(roomId);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Giữ mã phòng trên URL để tải lại trang / gửi link vẫn vào đúng phòng.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    window.history.replaceState(null, "", url);
  }, [roomId]);

  const exit = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.replaceState(null, "", url);
    onExit();
  }, [onExit]);

  const leave = useCallback(async () => {
    setConfirmLeave(false);
    await wwLeave(roomId);
    exit();
  }, [roomId, exit]);

  const playing = r.room?.status === "playing";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <div className="mx-auto max-w-[1360px] px-4 pb-10 sm:px-6">
        {!r.room ? (
          <>
            <GameHeader game="werewolf" subtitle={`Phòng ${roomId}`} />
            <div className="panel mx-auto mt-8 max-w-md p-6 text-center">
              {r.error ? (
                <>
                  <p className="text-sm font-semibold text-danger">{r.error}</p>
                  <Button className="mt-4" onClick={exit}>
                    Về sảnh
                  </Button>
                </>
              ) : (
                <p className="text-sm text-ink-300">Đang vào phòng {roomId}…</p>
              )}
            </div>
          </>
        ) : r.room.status === "lobby" || r.room.status === "closed" || !r.me ? (
          <WaitingRoom r={r} onLeave={() => setConfirmLeave(true)} onExit={exit} />
        ) : (
          <OnlineTable r={r} onLeave={() => setConfirmLeave(true)} />
        )}
      </div>
      <ConfirmDialog
        open={confirmLeave}
        title={playing ? "Rời bàn?" : "Rời phòng?"}
        body={playing ? "Bot sẽ chơi thay bạn. Bạn có thể vào lại bằng mã phòng trước khi ván kết thúc." : "Ghế của bạn sẽ được nhả cho người khác."}
        confirmLabel="Rời"
        danger
        onConfirm={() => void leave()}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}

type RoomApi = ReturnType<typeof useWerewolfRoom>;

/* ------------------------------- Phòng chờ ------------------------------- */

function WaitingRoom({ r, onLeave, onExit }: { r: RoomApi; onLeave: () => void; onExit: () => void }) {
  const room = r.room!;
  const size = room.roles.length;
  const missing = Math.max(0, size - r.seats.length);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const preset = Object.entries(PRESETS).find(([, v]) => v.length === size && v.every((x, i) => x === room.roles[i]))?.[0];

  const run = async (key: string, fn: Parameters<RoomApi["host"]>[0], args?: Record<string, unknown>) => {
    setBusy(key);
    setErr(await r.host(fn, args));
    setBusy(null);
  };

  const counts = room.roles.reduce<Partial<Record<Role, number>>>((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {});

  if (room.status === "closed") {
    return (
      <>
        <GameHeader game="werewolf" subtitle={`Phòng ${room.id}`} />
        <div className="panel mx-auto mt-8 max-w-md p-6 text-center">
          <p className="text-sm text-ink-300">Phòng đã đóng.</p>
          <Button className="mt-4" onClick={onExit}>
            Về sảnh
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <GameHeader game="werewolf" subtitle={`Phòng chờ · ${r.seats.length}/${size} người`} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_clamp(300px,28vw,400px)]">
        <div className="panel p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="label mb-1">Mã phòng</p>
              <p className="font-mono text-3xl font-black tracking-[0.25em] text-white">{room.id}</p>
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label="Chép link mời"
              title={copied ? "Đã chép" : "Chép link mời"}
              onClick={() => {
                void navigator.clipboard?.writeText(window.location.href).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              <Copy className="size-4" />
            </button>
            <Button variant="danger" size="sm" onClick={onLeave}>
              <X className="size-4" /> Rời phòng
            </Button>
          </div>

          <ul className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {Array.from({ length: size }, (_, i) => r.seats[i] ?? null).map((s, i) =>
              s ? (
                <li key={s.seat} className={cn("relative flex items-center gap-2.5 rounded-2xl border p-2.5", s.me ? "border-accent/40 bg-accent/10" : "border-white/[0.08] bg-white/[0.03]")}>
                  <div className="relative shrink-0">
                    <UserAvatar src={s.avatar} name={s.name} className="size-10" />
                    <span className={cn("absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-ink-900", s.online ? "bg-success" : "bg-ink-500")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">
                      {s.name}
                      {s.me && <span className="text-ink-300"> · bạn</span>}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-ink-400">
                      {s.host ? (
                        <>
                          <Crown className="size-3 text-warning" /> Chủ phòng
                        </>
                      ) : s.bot ? (
                        <>
                          <Bot className="size-3" /> Bot
                        </>
                      ) : s.online ? (
                        "Sẵn sàng"
                      ) : (
                        "Mất kết nối"
                      )}
                    </p>
                  </div>
                  {room.isHost && !s.me && (
                    <button type="button" className="icon-btn-ghost shrink-0" aria-label={`Mời ${s.name} ra`} disabled={!!busy} onClick={() => void run(`kick${s.seat}`, "ww_kick", { p_seat: s.seat })}>
                      <X className="size-4" />
                    </button>
                  )}
                </li>
              ) : (
                <li key={`empty-${i}`} className="grid min-h-[62px] place-items-center rounded-2xl border border-dashed border-white/10 text-xs text-ink-500">
                  Ghế trống
                </li>
              )
            )}
          </ul>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {(Object.entries(counts) as [Role, number][]).map(([role, n]) => (
              <span key={role} className="chip">
                <Emoji e={ROLE_INFO[role].emoji} /> {ROLE_INFO[role].name}
                {n > 1 && <span className="text-ink-300">×{n}</span>}
              </span>
            ))}
          </div>

          {room.isHost ? (
            <div className="mt-5 space-y-3 border-t border-white/[0.06] pt-4">
              <div>
                <p className="label mb-1.5">Bộ vai</p>
                <Segmented
                  value={preset ? Number(preset) : 0}
                  size="sm"
                  onChange={(n) => n && void run("roles", "ww_set_roles", { p_roles: PRESETS[n] })}
                  options={[
                    ...[6, 8, 10, 12].map((n) => ({ value: n, label: n === 6 ? "6 · Chớp nhoáng" : `${n} · Cổ điển`, disabled: n < r.seats.length || !!busy })),
                    ...(preset ? [] : [{ value: 0, label: `${size} · Tuỳ chỉnh` }]),
                  ]}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => void run("bot", "ww_add_bot")} loading={busy === "bot"} disabled={missing === 0 || !!busy}>
                  <UserPlus className="size-4" /> Thêm bot
                </Button>
                <Button variant="solid" className="flex-1" onClick={() => void run("start", "ww_start", { p_fill_bots: true })} loading={busy === "start"} disabled={!!busy}>
                  <Play className="size-4" /> {missing ? `Bắt đầu · ${missing} bot ngồi thay` : "Bắt đầu"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-5 border-t border-white/[0.06] pt-4 text-center text-sm text-ink-300">Chờ chủ phòng bắt đầu… {missing > 0 && `(còn ${missing} ghế trống, bot sẽ ngồi thay)`}</p>
          )}
          {(err || r.error) && <p className="mt-3 text-sm font-semibold text-danger">{err ?? r.error}</p>}
        </div>

        <LogPanel r={r} canChat placeholder="Chào cả phòng…" />
      </div>
    </>
  );
}

/* -------------------------------- Bàn chơi -------------------------------- */

function OnlineTable({ r, onLeave }: { r: RoomApi; onLeave: () => void }) {
  const room = r.room!;
  const me = r.me!;
  const seats = r.seats;
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const profile = useAppStore(useShallow((s) => ({ username: s.currentUser.username, avatar: s.currentUser.avatar })));
  const { settle, reset: resetSettlement, result, open: resultOpen, setOpen: setResultOpen } = useMatchSettlement("werewolf");

  const mySeat = seats.find((s) => s.me) ?? null;
  const myRole = me.role;
  const meAlive = !!mySeat?.alive;
  const wolfMe = !!myRole && isWolf(myRole);
  const seatOf = useCallback((id: string) => seats.find((s) => sid(s.seat) === id), [seats]);

  const [viewMode, setViewMode] = useState<"circle" | "grid">("circle");
  const [showRole, setShowRole] = useState(false);
  const [roleModalMode, setRoleModalMode] = useState<"roulette" | "inspect">("roulette");
  const [fxQueue, setFxQueue] = useState<WerewolfFxEvent[]>([]);
  const playFx = useCallback((ev: WerewolfFxEvent) => setFxQueue((q) => [...q, ev]), []);
  const popFx = useCallback(() => setFxQueue((q) => q.slice(1)), []);
  const [phaseBanner, setPhaseBanner] = useState<{ key: string; night: boolean; text: string } | null>(null);
  const [latestChats, setLatestChats] = useState<Record<string, string>>({});
  const [voteReveal, setVoteReveal] = useState<{ candidates: VoteCandidate[]; executed: string | null; tie: boolean } | null>(null);
  const [cupidFirst, setCupidFirst] = useState<number | null>(null);
  const [seerPick, setSeerPick] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [, tick] = useState(0);

  const players: WPlayer[] = useMemo(
    () =>
      seats.map((s) => ({
        id: sid(s.seat),
        name: s.name,
        avatar: s.avatar,
        // Vai chưa biết hiển thị qua roleOf; giá trị giữ chỗ không bao giờ là Sói.
        role: s.role ?? "villager",
        alive: s.alive,
        isHuman: s.me,
        temper: 0.5,
        cause: s.cause ?? undefined,
        diedDay: s.diedDay ?? undefined,
      })),
    [seats]
  );
  const state = useMemo(() => toWState(room, me, seats, players), [room, me, seats, players]);
  const meP = players.find((p) => p.isHuman) ?? players[0];

  /* --------------------------- Đồng hồ server --------------------------- */

  useEffect(() => {
    if (!room.deadline) return;
    const t = setInterval(() => tick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [room.deadline]);
  const secondsLeft = room.deadline ? Math.max(0, Math.ceil((room.deadline - r.serverNow()) / 1000)) : null;

  /* ------------------------- Chuyển pha: hiệu ứng ------------------------- */

  const prev = useRef<{ gameNo: number; phase: string; step: string; day: number; alive: Record<number, boolean> } | null>(null);
  useEffect(() => {
    const p = prev.current;
    const alive = Object.fromEntries(seats.map((s) => [s.seat, s.alive]));
    prev.current = { gameNo: room.gameNo, phase: room.phase, step: room.step, day: room.day, alive };
    if (!p || p.gameNo !== room.gameNo) {
      // Lần đầu thấy ván (hoặc ván mới): mở lá vai nếu đang ở pha xem bài.
      resetSettlement();
      setCupidFirst(null);
      setSeerPick(null);
      if (room.phase === "reveal") {
        setRoleModalMode("roulette");
        setShowRole(true);
      }
      return;
    }
    const died = seats.filter((s) => !s.alive && p.alive[s.seat]);
    for (const s of died) {
      const type = s.cause ? FX_BY_CAUSE[s.cause] : undefined;
      if (type) playFx({ id: `${room.gameNo}-${s.seat}-${s.cause}`, type, targetName: s.name });
    }
    if (died.length && soundEnabled) {
      if (died.some((s) => s.cause === "vote")) soundManager.playWerewolfExecution();
      else if (died.some((s) => s.cause === "hunter")) soundManager.playWerewolfHunter();
      else soundManager.playWerewolfDeath();
    }
    // Quản trò đọc mọi bước cho cả bàn (kể cả người không có vai đó, đã hành động hay đã chết),
    // xếp hàng tuần tự; server giữ mỗi bước ít nhất 8s nên ai cũng phải chờ.
    if (p.phase !== room.phase) {
      if (room.phase === "night") {
        playNarratorVoice("night_falls");
        if (soundEnabled) soundManager.playWerewolfNight();
      } else if (room.phase === "dawn") {
        playNarratorVoice(died.length ? "someone_died" : "no_one_died");
        if (!died.length && soundEnabled) soundManager.playWerewolfDawn();
      } else if (room.phase === "discussion") {
        playNarratorVoice("day_break");
      } else if (room.phase === "vote") {
        playNarratorVoice("vote_start");
      } else if (room.phase === "verdict") {
        playNarratorVoice("vote_reveal");
      } else if (room.phase === "over") {
        playNarratorVoice(room.winner === "lovers" ? "lovers_win" : room.winner === "wolves" ? "wolf_win" : "villager_win");
      }
      if (p.phase === "reveal") setShowRole(false);
    }
    if (room.phase === "night" && room.step && (p.step !== room.step || p.phase !== "night")) {
      playNarratorVoice(room.step);
      if (room.step === "wolves" && soundEnabled) soundManager.playWerewolfWolfHowl();
    }
    if (p.step !== room.step) {
      setCupidFirst(null);
      setSeerPick(null);
    }
  }, [room.seq, room.gameNo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Xem bài xong thì quản trò giới thiệu luật (đêm do server mở theo giờ).
  const introPlayed = useRef(-1);
  useEffect(() => {
    if (room.phase === "reveal" && !showRole && introPlayed.current !== room.gameNo) {
      introPlayed.current = room.gameNo;
      playNarratorVoice("intro");
    }
  }, [room.phase, room.gameNo, showRole]);

  // Banner ngày / đêm.
  useEffect(() => {
    if (room.phase !== "night" && room.phase !== "discussion") return;
    const night = room.phase === "night";
    setPhaseBanner({ key: `${room.gameNo}-${room.phase}-${room.day}`, night, text: night ? `🌙 Đêm ${room.day}` : `☀️ Ngày ${room.day}` });
    const t = setTimeout(() => setPhaseBanner(null), 2600);
    return () => clearTimeout(t);
  }, [room.phase, room.day, room.gameNo]);

  // Kiểm phiếu công khai → băng chuyền hồi hộp.
  const revealedVerdict = useRef("");
  useEffect(() => {
    const v = room.verdict;
    const key = `${room.gameNo}-${room.day}`;
    if (room.phase !== "verdict" || !v || revealedVerdict.current === key) return;
    revealedVerdict.current = key;
    const nameOf = (seat: number) => seats.find((s) => s.seat === seat);
    const candidates: VoteCandidate[] = seats
      .filter((s) => s.alive)
      .map((s) => {
        const t = v.tally.find((x) => x.seat === s.seat);
        return {
          id: sid(s.seat),
          name: s.name,
          avatar: s.avatar,
          votes: t?.votes ?? 0,
          votedBy: (t?.by ?? []).map((b) => ({ name: nameOf(b)?.name ?? "?", avatar: nameOf(b)?.avatar ?? "" })),
          role: v.executed === s.seat && v.role ? `${ROLE_INFO[v.role].emoji} ${ROLE_INFO[v.role].name}` : undefined,
        };
      })
      .sort((a, b) => b.votes - a.votes);
    setVoteReveal({ candidates, executed: v.executed !== null ? sid(v.executed) : null, tie: v.executed === null });
  }, [room.phase, room.verdict, room.gameNo, room.day, seats]);

  // Kết thúc ván → kết quả (online không cược).
  const settledGame = useRef(-1);
  useEffect(() => {
    if (room.phase !== "over" || !room.winner || !myRole || settledGame.current === room.gameNo) return;
    settledGame.current = room.gameNo;
    const win = room.winner === "lovers" ? !!mySeat?.lover : teamOf(myRole) === room.winner;
    settle(win ? "win" : "loss", { name: "Làng Ma Sói online", elo: 1250 }, 0);
  }, [room.phase, room.winner, room.gameNo, myRole, mySeat?.lover, settle]);

  // Bong bóng chat trên ghế cho câu mới (không phát lại lịch sử khi vừa vào).
  const lastChatId = useRef<number | null>(null);
  useEffect(() => {
    const chats = r.log.filter((l) => (l.kind === "chat" || l.kind === "wolf") && l.speaker !== null);
    const maxId = chats.length ? chats[chats.length - 1].id : 0;
    if (lastChatId.current === null) {
      lastChatId.current = maxId;
      return;
    }
    const fresh = chats.filter((l) => l.id > lastChatId.current!);
    lastChatId.current = Math.max(lastChatId.current, maxId);
    for (const l of fresh) {
      const key = sid(l.speaker!);
      setLatestChats((prev) => ({ ...prev, [key]: l.text }));
      setTimeout(
        () =>
          setLatestChats((prev) => {
            if (prev[key] !== l.text) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
          }),
        4500
      );
    }
  }, [r.log]);

  /* ---------------------------- Lượt của mình ---------------------------- */

  const night = room.phase === "night";
  const myStep = night && !!myRole && meAlive && !me.acted;
  const witchHealOpen = myStep && room.step === "witch" && myRole === "witch" && !me.healDecided && me.victim != null && !me.healUsed;

  const pick: PickKind | null = (() => {
    if (room.phase === "hunter" && room.pendingHunter === mySeat?.seat) return "hunter";
    if (!meAlive) return null;
    if (room.phase === "vote" && !mySeat?.voted) return "vote";
    if (!myStep || !myRole) return null;
    if (room.step === "cupid" && myRole === "cupid") return "cupid";
    if (room.step === "guard" && myRole === "guard") return "guard";
    if (room.step === "wolves" && isWolf(myRole)) return "wolf";
    if (room.step === "white_wolf" && myRole === "white_wolf") return "white_wolf";
    if (room.step === "seer" && myRole === "seer") return "seer";
    if (room.step === "witch" && myRole === "witch" && !witchHealOpen && !me.poisonUsed) return "poison";
    return null;
  })();

  // Phù Thủy hết cả hai bình: tự kết thúc lượt cho khỏi chờ.
  const autoSkipped = useRef("");
  useEffect(() => {
    const key = `${room.gameNo}-${room.day}`;
    if (myStep && room.step === "witch" && myRole === "witch" && !witchHealOpen && me.poisonUsed && autoSkipped.current !== key) {
      autoSkipped.current = key;
      void r.act("poison", null);
    }
  }, [myStep, room.step, room.day, room.gameNo, myRole, witchHealOpen, me.poisonUsed, r]);

  const canTarget = (p: WPlayer) => {
    const s = seatOf(p.id);
    if (!pick || !s || !s.alive || sending) return false;
    switch (pick) {
      case "cupid":
        return s.seat !== cupidFirst;
      case "guard":
        return s.seat !== me.lastGuarded;
      case "wolf":
        return !(s.role && isWolf(s.role));
      case "white_wolf":
        return !!s.role && isWolf(s.role) && !s.me;
      default:
        return !s.me;
    }
  };

  const send = async (fn: () => Promise<boolean>) => {
    setSending(true);
    try {
      return await fn();
    } finally {
      setSending(false);
    }
  };

  const onTarget = (p: WPlayer) => {
    const s = seatOf(p.id);
    if (!s || !pick || !canTarget(p)) return;
    switch (pick) {
      case "cupid":
        if (cupidFirst === null) return setCupidFirst(s.seat);
        void send(() => r.act("cupid", cupidFirst, s.seat)).then((ok) => {
          if (!ok) return;
          if (soundEnabled) soundManager.playCupidArrow();
          playFx({ id: `cupid-${room.gameNo}`, type: "cupid", targetName: `${seats.find((x) => x.seat === cupidFirst)?.name} & ${s.name}` });
        });
        return setCupidFirst(null);
      case "guard":
        return void send(() => r.act("guard", s.seat)).then((ok) => {
          if (!ok) return;
          if (soundEnabled) soundManager.playWerewolfShield();
          playFx({ id: `guard-${room.gameNo}-${room.day}`, type: "shield", targetName: s.name });
        });
      case "wolf":
      case "white_wolf":
        return void send(() => r.act(pick === "wolf" ? "bite" : "white_bite", s.seat)).then((ok) => {
          if (!ok) return;
          if (soundEnabled) soundManager.playWerewolfClawSlash();
          playFx({ id: `${pick}-${room.gameNo}-${room.day}`, type: "claw", targetName: s.name });
        });
      case "seer":
        return void send(() => r.act("seer", s.seat)).then((ok) => {
          if (!ok) return;
          if (soundEnabled) soundManager.playWerewolfSeer();
          setSeerPick(s.seat);
        });
      case "poison":
        return void send(() => r.act("poison", s.seat)).then((ok) => {
          if (!ok) return;
          if (soundEnabled) soundManager.playWitchPoison();
          playFx({ id: `poison-${room.gameNo}-${room.day}`, type: "poison", targetName: s.name });
        });
      case "vote":
        if (soundEnabled) soundManager.playWerewolfVote();
        return void send(() => r.act("vote", s.seat));
      case "hunter":
        return void send(() => r.act("shoot", s.seat));
    }
  };

  // Kết quả soi đến từ server (chỉ Tiên Tri nhận được).
  const seerResult = seerPick !== null ? me.seerResults?.[sid(seerPick)] : undefined;
  const seerFxShown = useRef("");
  useEffect(() => {
    if (seerPick === null || seerResult === undefined) return;
    const key = `${room.gameNo}-${room.day}-${seerPick}`;
    if (seerFxShown.current === key) return;
    seerFxShown.current = key;
    playFx({ id: key, type: "seer", targetName: seats.find((s) => s.seat === seerPick)?.name, seerResultIsWolf: seerResult });
  }, [seerPick, seerResult, room.gameNo, room.day, seats, playFx]);

  /* --------------------------------- Chat --------------------------------- */

  const canChat = room.status === "over" || (meAlive && (room.phase === "discussion" || (night && wolfMe)));
  const [chat, setChat] = useState("");
  const voice = useWerewolfVoice(
    useCallback((text: string) => {
      setChat(text);
    }, [])
  );
  useEffect(() => {
    if (room.phase !== "discussion" && voice.isMicOn) void voice.toggleMic();
  }, [room.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  /* --------------------------------- Lời nhắc --------------------------------- */

  const victimName = me.victim != null ? seats.find((s) => s.seat === me.victim)?.name : undefined;
  const wolfPickNames = wolfMe && me.wolfVotes ? [...new Set(Object.values(me.wolfVotes).filter((v): v is number => v !== null))].map((v) => seats.find((s) => s.seat === v)?.name).filter(Boolean) : [];

  const prompt = (() => {
    if (room.phase === "reveal") return "Xem vai của bạn — quản trò sắp mở đêm";
    if (room.phase === "over") {
      const win = room.winner === "lovers" ? !!mySeat?.lover : !!myRole && teamOf(myRole) === room.winner;
      return win ? "🎉 Phe bạn thắng!" : "Phe bạn thua…";
    }
    if (pick === "hunter") return "🏹 Bắn theo một người!";
    if (!meAlive) return "👻 Bạn đã chết — theo dõi đến hết ván";
    if (pick === "cupid") return cupidFirst === null ? "💘 Chọn 2 người se duyên" : "💘 Chọn người thứ hai";
    if (pick === "guard") return "🛡️ Chọn người bảo vệ";
    if (pick === "wolf") return wolfPickNames.length ? `🐺 Bầy đang nhắm: ${wolfPickNames.join(", ")}` : "🐺 Chọn con mồi";
    if (pick === "white_wolf") return "⚪ Trừ khử một Sói, hoặc bỏ qua";
    if (pick === "seer") return "🔮 Chọn người để soi";
    if (witchHealOpen) return "🧪 Dùng bình Cứu?";
    if (pick === "poison") return victimName && !me.healed ? `🧪 ${victimName} sẽ chết. Đầu độc thêm ai?` : "🧪 Chọn người đầu độc, hoặc bỏ qua";
    if (pick === "vote") return "🗳️ Chọn người treo cổ";
    if (night) return me.acted ? "✓ Đã chọn — chờ trời sáng" : STEP_LABEL[room.step] ?? "🌙 Đêm đang trôi…";
    if (room.phase === "dawn") return "☀️ Trời sáng…";
    if (room.phase === "discussion") return "💬 Thảo luận — tìm Sói";
    if (room.phase === "vote") return "🗳️ Đã bỏ phiếu — chờ mọi người";
    if (room.phase === "verdict") return "🗳️ Đang kiểm phiếu…";
    if (room.phase === "hunter") return "🏹 Thợ Săn đang ngắm…";
    return "";
  })();

  const isNight = night || room.phase === "reveal";
  const showClock = secondsLeft !== null && (room.phase === "discussion" || room.phase === "vote" || pick !== null || witchHealOpen);
  const pickAction = pick ? PICK_ACTION[pick] : undefined;
  const roleOf = (p: WPlayer) => seatOf(p.id)?.role ?? null;
  const packmateOf = () => false;

  return (
    <>
      <GameHeader game="werewolf" subtitle={`Phòng ${room.id} · Ngày ${room.day} · ${seats.filter((s) => s.alive).length}/${seats.length} còn sống`}>
        {room.phase !== "over" && myRole && (
          <button
            type="button"
            className="btn-ghost px-3 py-2 text-xs"
            onClick={() => {
              setRoleModalMode("inspect");
              setShowRole(true);
            }}
          >
            <Eye className="size-4" /> Vai của tôi
          </button>
        )}
      </GameHeader>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_clamp(300px,28vw,400px)]">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className={cn("flex flex-wrap items-center gap-2 rounded-2xl border p-2 pl-2.5 backdrop-blur-xl transition-colors duration-700", isNight ? "border-violet-400/25 bg-[#120d24]/85" : "border-amber-300/30 bg-[#1f1608]/85")}>
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", isNight ? "bg-violet-500/25 text-violet-200" : "bg-amber-400/25 text-amber-200")}>
                {isNight ? <Moon className="size-5" /> : room.phase === "over" ? <span className="text-xl"><Emoji e="🏁" /></span> : <Sun className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-white/50">{room.phase === "over" ? "Kết thúc" : isNight ? `Đêm ${room.day}` : `Ngày ${room.day}`}</p>
                <p className="truncate text-sm font-extrabold text-white sm:text-base"><EmojiText>{prompt}</EmojiText></p>
              </div>
              {showClock && (
                <span className={cn("flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-mono text-sm font-extrabold", secondsLeft! <= 10 ? "animate-pulse bg-red-500/25 text-red-200" : "bg-white/10 text-white")}>
                  <Timer className="size-4" /> {secondsLeft}
                </span>
              )}

              {pick === "vote" && <DockBtn icon={<Square className="size-4" />} label="Phiếu trắng" disabled={sending} onClick={() => void send(() => r.act("vote", null))} />}
              {pick === "hunter" && <DockBtn icon={<X className="size-4" />} label="Không bắn" disabled={sending} onClick={() => void send(() => r.act("shoot", null))} />}
              {pick === "poison" && <DockBtn icon={<X className="size-4" />} label="Bỏ qua" disabled={sending} onClick={() => void send(() => r.act("poison", null))} />}
              {pick === "white_wolf" && <DockBtn icon={<X className="size-4" />} label="Bỏ qua" disabled={sending} onClick={() => void send(() => r.act("white_bite", null))} />}
              {pick === "cupid" && cupidFirst !== null && <DockBtn icon={<RotateCcw className="size-4" />} label="Chọn lại" onClick={() => setCupidFirst(null)} />}
              {room.phase === "over" && room.isHost && <DockBtn icon={<Play className="size-4" />} label="Ván mới" tone="lime" onClick={() => void r.host("ww_rematch")} />}

              <span className="mx-0.5 hidden h-6 w-px bg-white/10 sm:block" />
              <div className="flex rounded-xl border border-white/10 bg-black/30 p-0.5">
                <IconToggle active={viewMode === "circle"} title="Bàn tròn" onClick={() => setViewMode("circle")}>
                  <Orbit className="size-4" />
                </IconToggle>
                <IconToggle active={viewMode === "grid"} title="Lưới" onClick={() => setViewMode("grid")}>
                  <LayoutGrid className="size-4" />
                </IconToggle>
              </div>
              <button
                type="button"
                onClick={onLeave}
                title="Rời bàn"
                className="flex items-center gap-1.5 rounded-xl border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs font-black text-red-200 transition hover:scale-105 hover:bg-red-500/30 active:scale-95"
              >
                <Square className="size-3.5 fill-current" /> Rời
              </button>
            </div>

            {mySeat?.bot && room.phase !== "over" && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-100">
                <Emoji e="🤖" /> Bot đang chơi thay bạn.
                <button type="button" className="btn-ghost ml-auto px-3 py-1.5 text-xs" onClick={() => void wwJoin(room.id, profile.username, profile.avatar).then(() => r.refresh())}>
                  Chơi tiếp
                </button>
              </div>
            )}
            {room.phase === "over" && !room.isHost && <p className="px-1 text-sm text-ink-300">Chờ chủ phòng mở ván mới…</p>}
            {r.error && <p role="status" className="px-1 text-sm font-semibold text-danger">{r.error}</p>}

            {witchHealOpen && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-black bg-ink-100 px-4 py-2 text-black">
                <span className="font-bold"><Emoji e="🧪" /> Sói vừa cắn {victimName}.</span>
                <button
                  type="button"
                  className="rounded-xl bg-black px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
                  disabled={sending}
                  onClick={() =>
                    void send(() => r.act("heal", null, null, true)).then((ok) => {
                      if (!ok) return;
                      if (soundEnabled) soundManager.playWitchHeal();
                      playFx({ id: `heal-${room.gameNo}-${room.day}`, type: "heal", targetName: victimName });
                    })
                  }
                >
                  Dùng bình Cứu
                </button>
                <button type="button" className="rounded-xl border-2 border-black px-3 py-1 text-xs font-bold disabled:opacity-50" disabled={sending} onClick={() => void send(() => r.act("heal", null, null, false))}>
                  Không cứu
                </button>
              </div>
            )}
            {seerPick !== null && seerResult !== undefined && night && (
              <div className={cn("flex items-center gap-3 rounded-2xl border px-4 py-2.5 font-bold", seerResult ? "border-red-400/50 bg-red-500/20 text-red-100" : "border-emerald-400/40 bg-emerald-500/15 text-emerald-100")}>
                <Emoji e="🔮" /> {seats.find((s) => s.seat === seerPick)?.name} <EmojiText>{seerResult ? "🐺 SÓI" : "✅ Người tốt"}</EmojiText>
              </div>
            )}
          </div>

          <div className="relative" style={{ minHeight: showRole || voteReveal ? "clamp(520px, calc(100dvh - 190px), 680px)" : undefined }}>
            {viewMode === "circle" ? (
              <WerewolfRoundtable
                state={state}
                humanPlayer={meP}
                canTarget={canTarget}
                onTarget={onTarget}
                targetKind={pick}
                secondsLeft={showClock ? secondsLeft : null}
                prompt={prompt}
                isHumanSpeaking={voice.isSpeaking}
                isHumanMicOn={voice.isMicOn}
                humanVolume={voice.volume}
                latestChats={latestChats}
                roleOf={roleOf}
                packmateOf={packmateOf}
                narrate={false}
              />
            ) : (
              <div className={cn("grid gap-3", players.length > 10 ? "grid-cols-3 sm:grid-cols-4 xl:grid-cols-6" : "grid-cols-2 sm:grid-cols-4")}>
                {players.map((p) => {
                  const s = seatOf(p.id)!;
                  const speaking = p.alive && (p.isHuman ? voice.isSpeaking : !!latestChats[p.id]);
                  return (
                    <SeatCard
                      key={p.id}
                      variant="tile"
                      name={p.name}
                      avatar={p.avatar}
                      alive={p.alive}
                      isMe={p.isHuman}
                      role={s.role}
                      targetable={canTarget(p)}
                      action={pickAction}
                      dimmed={!!pickAction && !canTarget(p)}
                      speaking={speaking}
                      micOn={p.alive && (p.isHuman ? voice.isMicOn || voice.isSpeaking : speaking)}
                      hasVoted={room.phase === "vote" && s.voted}
                      lover={s.lover}
                      seerMark={me.seerResults?.[p.id]}
                      tags={!s.online && !s.bot ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-ink-300">mất mạng</span> : undefined}
                      onClick={() => onTarget(p)}
                    />
                  );
                })}
              </div>
            )}

            {voteReveal && <GradientCarousel candidates={voteReveal.candidates} eliminatedId={voteReveal.executed} isTie={voteReveal.tie} onComplete={() => setVoteReveal(null)} />}

            <AnimatePresence>
              {phaseBanner && (
                <motion.div
                  key={phaseBanner.key}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className={cn(
                    "pointer-events-none absolute inset-0 z-[45] grid place-items-center overflow-hidden rounded-[36px]",
                    phaseBanner.night ? "bg-[radial-gradient(circle,rgba(30,27,75,0.75),rgba(2,6,23,0.92))]" : "bg-[radial-gradient(circle,rgba(253,230,138,0.55),rgba(251,146,60,0.25))]"
                  )}
                >
                  <motion.p
                    initial={{ scale: 0.7, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 1.15, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 140, damping: 16 }}
                    className="font-display text-5xl font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.6)] sm:text-7xl"
                  >
                    <EmojiText>{phaseBanner.text}</EmojiText>
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            <WerewolfActionFxOverlay currentFx={fxQueue[0] ?? null} onFinish={popFx} />

            {myRole && <WerewolfRoleRandomizer inline isOpen={showRole} role={myRole} players={players} initialMode={roleModalMode} onClose={() => setShowRole(false)} />}
          </div>
        </div>

        <LogPanel
          r={r}
          canChat={canChat}
          placeholder={canChat ? (night ? "Nhắn riêng bầy Sói…" : voice.isMicOn ? "…" : "Nói gì đó…") : "Chat đã khoá"}
          chat={chat}
          setChat={setChat}
          mic={<WerewolfMicButton voice={voice} disabled={room.phase !== "discussion" || !meAlive} />}
        />
      </div>

      <MatchResultModal
        isOpen={resultOpen}
        onClose={() => setResultOpen(false)}
        onPlayAgain={() => {
          setResultOpen(false);
          if (room.isHost) void r.host("ww_rematch");
        }}
        resultData={result}
        reason={room.winner ? (room.winner === "village" ? "Dân làng đã tìm ra tất cả Sói" : room.winner === "lovers" ? "Đôi tình nhân sống sót đến cuối" : "Bầy Sói đã chiếm lấy ngôi làng") : undefined}
      />
    </>
  );
}

/* ---------------------------- Nhật ký + chat ---------------------------- */

function LogPanel({
  r,
  canChat,
  placeholder,
  chat: chatProp,
  setChat: setChatProp,
  mic,
}: {
  r: RoomApi;
  canChat: boolean;
  placeholder: string;
  chat?: string;
  setChat?: (v: string) => void;
  mic?: React.ReactNode;
}) {
  const [own, setOwn] = useState("");
  const chat = chatProp ?? own;
  const setChat = setChatProp ?? setOwn;
  const logRef = useRef<HTMLDivElement>(null);
  const bySeat = useMemo(() => new Map(r.seats.map((s) => [s.seat, s])), [r.seats]);
  const lines = r.log.filter((l) => l.kind !== "vote");

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [lines.length]);

  const send = () => {
    const text = chat.trim();
    if (!text || !canChat) return;
    setChat("");
    void r.chat(text);
  };

  return (
    <div className="panel flex h-[min(78dvh,760px)] flex-col overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <p className="font-display text-sm font-bold">Nhật ký làng</p>
        <span className="chip">
          <Users className="size-3" /> {r.seats.filter((s) => s.alive).length} sống
        </span>
      </div>
      <div ref={logRef} className="no-scrollbar flex-1 overflow-y-auto px-4 py-4">
        {lines.map((l, i, arr) => {
          if (l.kind === "chat" || l.kind === "wolf") {
            const sp = l.speaker !== null ? bySeat.get(l.speaker) : undefined;
            const mine = !!sp?.me;
            const prevL = arr[i - 1];
            const grouped = prevL?.kind === l.kind && prevL.speaker === l.speaker;
            return (
              <motion.div key={l.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={cn("flex items-end gap-2.5", mine && "flex-row-reverse", grouped ? "mt-1" : "mt-4")}>
                <div className="size-8 shrink-0">{!grouped && <UserAvatar src={sp?.avatar} name={sp?.name ?? "?"} className="size-8" />}</div>
                <div className={cn("flex max-w-[78%] flex-col gap-1", mine && "items-end")}>
                  {!grouped && !mine && (
                    <p className="px-1 text-xs font-semibold text-ink-300">
                      {sp?.name}
                      {l.kind === "wolf" && <span className="text-red-300"> · bầy Sói</span>}
                    </p>
                  )}
                  <div
                    className={cn(
                      "w-fit break-words rounded-2xl px-3.5 py-2 text-sm leading-snug",
                      l.kind === "wolf" ? "border border-red-400/30 bg-red-500/15 text-red-100" : mine ? "bg-lime-400 font-medium text-black" : "bg-white/[0.07] text-ink-100",
                      mine ? "rounded-br-md" : "rounded-bl-md"
                    )}
                  >
                    <EmojiText>{l.text}</EmojiText>
                  </div>
                </div>
              </motion.div>
            );
          }
          if (l.kind === "death") {
            return (
              <motion.p key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 rounded-xl border-l-2 border-pop-red bg-pop-red/10 px-3 py-2.5 text-sm font-medium text-[#ffb3bb]">
                <EmojiText>{l.text}</EmojiText>
              </motion.p>
            );
          }
          if (l.kind === "private") {
            return (
              <motion.p key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2.5 text-sm font-medium text-violet-100">
                <span className="mr-1 text-xs font-bold uppercase tracking-wider text-violet-300">Chỉ bạn thấy</span> <EmojiText>{l.text}</EmojiText>
              </motion.p>
            );
          }
          return (
            <motion.p key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 px-2 text-center text-xs leading-relaxed text-ink-400">
              <EmojiText>{l.text}</EmojiText>
            </motion.p>
          );
        })}
      </div>
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-ink-850 p-1.5 pl-2 focus-within:border-lime-400/50">
          {mic}
          <input
            value={chat}
            onChange={(e) => setChat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={!canChat}
            maxLength={200}
            placeholder={placeholder}
            aria-label="Tin nhắn"
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-ink-500 disabled:opacity-50"
          />
          <button type="button" onClick={send} disabled={!canChat || !chat.trim()} className="grid size-9 place-items-center rounded-full bg-lime-400 text-black disabled:opacity-30" aria-label="Gửi">
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Nút dock -------------------------------- */

export function DockBtn({ icon, label, onClick, tone = "neutral", disabled }: { icon: React.ReactNode; label: string; onClick: () => void; tone?: "neutral" | "lime" | "red"; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100",
        tone === "lime" && "bg-lime-400 text-black shadow-[0_0_18px_-4px_rgba(163,230,53,0.8)]",
        tone === "red" && "bg-red-500 text-white shadow-[0_0_18px_-4px_rgba(239,68,68,0.8)]",
        tone === "neutral" && "bg-white/10 text-white hover:bg-white/20"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function IconToggle({ active, title, onClick, children }: { active: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} className={cn("grid size-8 place-items-center rounded-lg transition hover:scale-110 active:scale-95", active ? "bg-white text-black" : "text-white/55 hover:text-white")}>
      {children}
    </button>
  );
}
