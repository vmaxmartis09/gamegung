"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Eye, LayoutGrid, Moon, Orbit, Play, Send, Square, Sun, Timer, Users, Vote, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/lib/store";
import { soundManager } from "@/lib/audio";
import {
  ROLE_INFO,
  WState,
  WPlayer,
  createGame,
  addLog,
  alive,
  byId,
  human,
  botNightActions,
  botWitch,
  resolveNight,
  kill,
  botHunterShot,
  checkWinner,
  botDiscussion,
  reactToHuman,
  botVotes,
  tallyVotes,
  teamOf,
  isWolf,
} from "@/lib/games/werewolf-engine";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { MatchResultModal } from "./match-result-modal";
import { GameHeader, Segmented, StakePicker, useGameSession, useMatchOpponent, useMatchSettlement } from "./shared";
import { WerewolfLobby, LobbySetup, defaultSetup } from "./werewolf-lobby";
import { WerewolfRoleRandomizer } from "./werewolf-role-randomizer";
import { WerewolfRoundtable } from "./werewolf-roundtable";
import { WerewolfActionFxOverlay, WerewolfFxEvent } from "./werewolf-action-fx";
import { useWerewolfVoice, WerewolfMicButton } from "./werewolf-voice";
import { GradientCarousel, VoteCandidate } from "@/components/reactbits/gradient-carousel";
import { playNarratorVoice, stopNarratorVoice, whenNarratorIdle } from "@/lib/narrator-audio";
import { SeatCard } from "./werewolf-seat";
import { DockBtn, IconToggle, WerewolfOnline, WerewolfOnlineEntry } from "./werewolf-online";
import { wwResume } from "@/lib/werewolf-online";
import { COOLDOWN, useCooldownStore, useCooldown } from "@/lib/cooldown-store";
import { Emoji, EmojiText } from "@/components/ui/emoji";

const DISCUSS_MS = 60_000;
const VOTE_MS = 30_000;
const STEP_LABEL: Record<string, string> = {
  cupid: "💘 Chọn 2 người se duyên",
  guard: "🛡️ Chọn người bảo vệ",
  wolves: "🐺 Chọn con mồi",
  white_wolf: "⚪ Trừ khử một Sói",
  seer: "🔮 Soi một người",
  witch: "🧪 Dùng bình thuốc?",
};

/** Thời gian không đều để nhịp ván bớt máy móc. */
const jit = (base: number, spread = 0.5) => base * (1 - spread / 2 + Math.random() * spread);

type Pick = null | { kind: "cupid" | "guard" | "wolf" | "white_wolf" | "seer" | "poison" | "vote" | "hunter" };

export function WerewolfGame() {
  const me = useAppStore(useShallow((s) => ({ id: s.currentUser.id, username: s.currentUser.username, avatar: s.currentUser.avatar })));
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const { settle, reset: resetSettlement, result, open: resultOpen, setOpen: setResultOpen } = useMatchSettlement("werewolf");
  const session = useGameSession<{ state: WState; stake: number }>("werewolf");
  const matchOpp = useMatchOpponent();

  const [setup, setSetup] = useState<LobbySetup>(defaultSetup);
  // Phòng online đang ngồi (null = chơi offline với bot).
  const [onlineRoom, setOnlineRoom] = useState<string | null>(null);
  const cooldown = useCooldown();
  const [stake, setStake] = useState(0);
  // Game state lives in a ref so bot logic can read/write it synchronously;
  // `rerender` publishes each new immutable snapshot to React.
  const gRef = useRef<WState | null>(null);
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const g = gRef.current;
  const setG = useCallback((next: WState | null) => {
    gRef.current = next;
    rerender();
  }, []);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [kick, setKick] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [chat, setChat] = useState("");
  const [witchChoice, setWitchChoice] = useState<"ask" | "poison" | null>(null);
  const [seerReveal, setSeerReveal] = useState<{ name: string; wolf: boolean } | null>(null);
  const [showRole, setShowRole] = useState(false);
  const [roleModalMode, setRoleModalMode] = useState<"roulette" | "inspect">("roulette");
  const [demoRole, setDemoRole] = useState<import("@/lib/games/werewolf-engine").Role | null>(null);
  // FX run as a queue so rapid events (dawn deaths, hunter chains) never cut each other off.
  const [fxQueue, setFxQueue] = useState<WerewolfFxEvent[]>([]);
  const currentFx = fxQueue[0] ?? null;
  const playFx = useCallback((ev: WerewolfFxEvent) => setFxQueue((q) => [...q, ev]), []);
  const popFx = useCallback(() => setFxQueue((q) => q.slice(1)), []);
  const [phaseBanner, setPhaseBanner] = useState<{ key: string; night: boolean; text: string } | null>(null);
  const [viewMode, setViewMode] = useState<"circle" | "grid">("circle");
  const [latestChats, setLatestChats] = useState<Record<string, string>>({});
  const [voteRevealState, setVoteRevealState] = useState<{
    candidates: VoteCandidate[];
    executed: string | null;
    isTie: boolean;
    count: Map<string, number>;
  } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const voice = useWerewolfVoice(
    useCallback((speechText: string) => {
      if (gRef.current?.phase === "discussion") {
        setChat(speechText);
      }
    }, [])
  );

  // Xem bài xong (hoặc hết giờ xem) → quản trò tự mở đêm, không cần bấm.
  const introPlayed = useRef(false);
  useEffect(() => {
    if (g?.phase !== "reveal") {
      introPlayed.current = false;
      return;
    }
    if (showRole) return;
    if (!introPlayed.current) {
      introPlayed.current = true;
      playNarratorVoice("intro");
    }
    later(() => mutate((s) => { if (s.phase === "reveal") goNight(s); }), 1200);
  }, [g?.phase, showRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chỉ được nói khi thảo luận; hết giờ thảo luận tự tắt mic.
  useEffect(() => {
    if (g?.phase !== "discussion" && voice.isMicOn) void voice.toggleMic();
  }, [g?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = parseInt(params.get("stake") || "", 10);
    if (s > 0) setStake(s);
    // Link mời ?room=MÃ, hoặc vào lại ván online đang dở sau khi tải lại trang / rớt mạng.
    const room = params.get("room");
    if (room) setOnlineRoom(room.toUpperCase());
    else if (!gRef.current) void wwResume().then((id) => id && !gRef.current && setOnlineRoom(id));
  }, []);

  // Mỗi lần clearTimers tăng epoch: callback đã xếp hàng chờ quản trò (whenNarratorIdle) của đợt cũ sẽ bị bỏ,
  // không bắn muộn sang pha sau (chat ban ngày hiện giữa đêm, bước đêm chạy hai lần…).
  const epoch = useRef(0);
  const later = useCallback((fn: () => void, ms: number) => {
    const e = epoch.current;
    // Chờ quản trò đọc xong rồi mới sang bước tiếp theo.
    timers.current.push(
      setTimeout(
        () =>
          whenNarratorIdle(() => {
            if (e === epoch.current) fn();
          }),
        ms
      )
    );
  }, []);
  const clearTimers = useCallback(() => {
    epoch.current++;
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  /** Immutable, synchronous update helper. */
  const mutate = useCallback(
    (fn: (s: WState) => void) => {
      if (!gRef.current) return;
      const next = structuredClone(gRef.current);
      fn(next);
      setG(next);
    },
    [setG]
  );

  // Resume a village left mid-game.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = session.load();
    if (!saved || saved.payload.state.phase === "over") return;
    const st = saved.payload.state;
    // Discussion/vote restart cleanly; night steps resume where they were.
    if (st.phase === "vote") st.phase = "discussion";
    setStake(saved.payload.stake);
    setG(st);
  }, [session, setG]);

  useEffect(() => {
    if (!g) return;
    if (g.phase === "over") return session.clear();
    if (g.phase === "reveal") return;
    const h = human(g);
    session.save(
      { state: g, stake },
      {
        label: `${g.phase === "night" ? "Đêm" : "Ngày"} ${g.day} · ${ROLE_INFO[h.role].emoji} ${ROLE_INFO[h.role].name}${h.alive ? "" : " (đã chết)"}`,
        detail: `${alive(g).length}/${g.players.length} còn sống`,
        progress: Math.min(1, (g.players.length - alive(g).length) / Math.max(1, g.players.length - 2)),
      }
    );
  }, [g, stake, session]);

  const meP = g ? human(g) : null;
  const meAlive = !!meP?.alive;
  const pace = meAlive ? 1 : 0.45;

  /* --------------------------- Phase machinery --------------------------- */

  const endIfWinner = useCallback((s: WState) => {
    const w = checkWinner(s);
    if (!w) return false;
    s.winner = w;
    s.phase = "over";
    addLog(s, "narrator", w === "village" ? "☀️ Toàn bộ Sói đã bị loại. DÂN LÀNG CHIẾN THẮNG!" : "🌑 Sói đã áp đảo dân làng. BẦY SÓI CHIẾN THẮNG!");
    return true;
  }, []);

  const goNight = useCallback(
    (s: WState) => {
      s.phase = "night";
      s.step = s.day === 1 && !s.cupidDone && s.players.some((p) => p.alive && p.role === "cupid") ? "cupid" : "guard";
      s.votes = {};
      addLog(s, "narrator", `🌙 Đêm ${s.day} buông xuống. Cả làng nhắm mắt…`);
      botNightActions(s);
      playNarratorVoice("night_falls");
      if (soundEnabled) soundManager.playWerewolfNight();
    },
    [soundEnabled]
  );

  /** `expected`: chỉ tiến nếu vẫn đang ở bước đó, để timer + watchdog gọi trùng không nhảy cóc hai bước. */
  const advanceStep = useCallback((expected?: string) => {
    // Người chơi bấm sớm cũng phải đợi quản trò đọc xong bước hiện tại.
    whenNarratorIdle(() => mutate((s) => {
      if (s.phase !== "night" || (expected && s.step !== expected)) return;
      const order = ["cupid", "guard", "wolves", "white_wolf", "seer", "witch", "done"] as const;
      const i = order.indexOf(s.step as (typeof order)[number]);
      let next = order[Math.min(order.length - 1, i + 1)];
      // Skip cupid if not night 1 or already done or no alive cupid
      if (next === "cupid" && (s.day > 1 || s.cupidDone || !s.players.some((p) => p.alive && p.role === "cupid"))) {
        next = "guard";
      }
      // Skip white wolf if odd day or no alive white wolf
      if (next === "white_wolf" && (s.day % 2 !== 0 || !s.players.some((p) => p.alive && p.role === "white_wolf"))) {
        next = "seer";
      }
      s.step = next;
      if (s.step === "wolves" && soundEnabled) soundManager.playWerewolfWolfHowl();
      if (s.step === "witch") botWitch(s);
    }));
  }, [mutate, soundEnabled]);

  // Watchdog: nếu một pha tự chạy (không chờ người chơi) đứng yên quá lâu — timer bị huỷ, quản trò kẹt, vai đã chết…
  // — thì chạy lại bộ hẹn giờ của pha đó. Mọi bước đều idempotent nên chạy lại không gây nhảy cóc.
  const stuckKey = g ? `${g.phase}-${g.day}-${g.step}-${g.pendingHunter ?? ""}-${g.log.length}` : "";
  useEffect(() => {
    const s = gRef.current;
    if (!s || s.phase === "over" || s.phase === "reveal" || s.phase === "lobby" || voteRevealState) return;
    const me = s.players.find((p) => p.isHuman);
    const roleFor = { cupid: "cupid", guard: "guard", wolves: "wolf", white_wolf: "white_wolf", seer: "seer", witch: "witch" }[s.step as string];
    const waitingHuman =
      !!me &&
      me.alive &&
      ((s.phase === "night" && !!roleFor && (roleFor === "wolf" ? isWolf(me.role) : me.role === roleFor)) ||
        (s.phase === "vote" && s.votes[me.id] === undefined) ||
        (s.phase === "hunter" && s.pendingHunter === me.id));
    if (waitingHuman || s.phase === "discussion") return;
    const t = setTimeout(() => {
      stopNarratorVoice(); // quản trò kẹt thì thả hàng đợi
      setKick((k) => k + 1);
    }, 18_000);
    return () => clearTimeout(t);
  }, [stuckKey, kick, voteRevealState]);
  // Thảo luận quá hạn mà vẫn chưa sang phiếu (timer mất) → chuyển.
  useEffect(() => {
    if (!deadline || g?.phase !== "discussion") return;
    const t = setTimeout(() => startVote(), Math.max(0, deadline - Date.now()) + 4000);
    return () => clearTimeout(t);
  }, [deadline, g?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Night: walk through steps, pausing for the human's role.
  useEffect(() => {
    if (!g || g.phase !== "night") return;
    const h = human(g);
    if (g.step === "done") {
      later(() => {
        mutate((s) => {
          if (s.phase !== "night" || s.step !== "done") return;
          const deaths = resolveNight(s);
          s.phase = "dawn";
          if (deaths.length) {
            for (const id of deaths) {
              const p = byId(s, id)!;
              playFx({ id: `${Date.now()}-${id}`, type: p.cause === "poison" ? "poison" : "claw", targetName: p.name });
              addLog(s, "death", `☠️ ${p.name} đã chết${p.cause === "poison" ? " (trúng độc)" : p.cause === "lover" ? " (chết vì người yêu)" : ""}. Vai: ${ROLE_INFO[p.role].emoji} ${ROLE_INFO[p.role].name}.`);
            }
            if (soundEnabled) soundManager.playWerewolfDeath();
            playNarratorVoice("someone_died");
          } else {
            playNarratorVoice("no_one_died");
            addLog(s, "narrator", "☀️ Trời sáng. Một đêm bình yên — không ai chết!");
            if (soundEnabled) soundManager.playWerewolfDawn();
          }
        });
      }, jit(2000, 0.3) * pace);
      return;
    }
    const roleFor = {
      cupid: "cupid",
      guard: "guard",
      wolves: "wolf",
      white_wolf: "white_wolf",
      seer: "seer",
      witch: "witch",
    }[g.step];
    const actorAlive = g.players.some((p) => p.alive && (roleFor === "wolf" ? isWolf(p.role) : p.role === roleFor));
    const humanActs = h.alive && (roleFor === "wolf" ? isWolf(h.role) : h.role === roleFor);
    if (humanActs) {
      if (g.step === "witch") setWitchChoice("ask");
      return;
    }
    // Pretend-think so roles can't be inferred from timing.
    const stepNow = g.step;
    later(() => advanceStep(stepNow), jit(actorAlive ? 3200 : 2600, 0.3) * pace);
  }, [g?.phase, g?.step, kick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Announce day/night swaps with a short cinematic banner.
  useEffect(() => {
    if (!g || (g.phase !== "night" && g.phase !== "discussion")) return;
    const night = g.phase === "night";
    setPhaseBanner({ key: `${g.phase}-${g.day}`, night, text: night ? `🌙 Đêm ${g.day}` : `☀️ Ngày ${g.day}` });
    const t = setTimeout(() => setPhaseBanner(null), 2600);
    return () => clearTimeout(t);
  }, [g?.phase, g?.day]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dawn → hunter or discussion.
  useEffect(() => {
    if (!g || g.phase !== "dawn") return;
    later(() => {
      mutate((s) => {
        if (s.phase !== "dawn") return;
        if (endIfWinner(s)) return;
        if (s.pendingHunter) {
          s.phase = "hunter";
          s.afterHunter = "discussion";
          return;
        }
        s.phase = "discussion";
        addLog(s, "narrator", `💬 Ngày ${s.day}: thảo luận ${DISCUSS_MS / 1000}s rồi bỏ phiếu.`);
      });
    }, jit(2800, 0.3) * pace);
  }, [g?.phase, kick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hunter shot.
  useEffect(() => {
    if (!g || g.phase !== "hunter" || !g.pendingHunter) return;
    const hunter = byId(g, g.pendingHunter)!;
    if (hunter.isHuman) return; // wait for the human
    later(() => {
      mutate((s) => {
        if (s.phase !== "hunter" || !s.pendingHunter) return;
        const target = botHunterShot(s, s.pendingHunter);
        applyHunter(s, target);
      });
    }, jit(1300, 0.7) * pace);
  }, [g?.phase, g?.pendingHunter, kick]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyHunter = useCallback(
    (s: WState, target: string | null) => {
      const hunter = byId(s, s.pendingHunter)!;
      s.pendingHunter = null;
      if (target) {
        const t = byId(s, target)!;
        addLog(s, "death", `🏹 Thợ Săn ${hunter.name} bắn hạ ${t.name}! Vai: ${ROLE_INFO[t.role].emoji} ${ROLE_INFO[t.role].name}.`);
        kill(s, target, "hunter");
        playFx({ id: `${Date.now()}-h`, type: "hunter", targetName: t.name });
        if (soundEnabled) soundManager.playWerewolfHunter();
      } else addLog(s, "narrator", `🏹 Thợ Săn ${hunter.name} quyết định không bắn.`);
      if (endIfWinner(s)) return;
      if (s.pendingHunter) return; // chained hunter (rare)
      if (s.afterHunter === "night") {
        s.day += 1;
        goNight(s);
      } else {
        s.phase = "discussion";
        addLog(s, "narrator", `💬 Ngày ${s.day}: thảo luận ${DISCUSS_MS / 1000}s rồi bỏ phiếu.`);
      }
      s.afterHunter = null;
    },
    [endIfWinner, goNight, soundEnabled, playFx]
  );

  // Discussion: bots talk over time.
  useEffect(() => {
    if (!g || g.phase !== "discussion") return;
    const length = meAlive ? DISCUSS_MS : 12_000;
    setDeadline(Date.now() + length);
    let lines: { speaker: string; text: string }[] = [];
    mutate((s) => {
      lines = botDiscussion(s);
    });
    // Second wave midway keeps the room alive.
    const spread = (meAlive ? length * 0.7 : length * 0.8) / Math.max(1, lines.length + 2);
    lines.forEach((l, i) =>
      later(() =>
        mutate((s) => {
          addLog(s, "chat", l.text, l.speaker);
          setLatestChats((prev) => ({ ...prev, [l.speaker]: l.text }));
          setTimeout(() => {
            setLatestChats((prev) => {
              const next = { ...prev };
              delete next[l.speaker];
              return next;
            });
          }, 4500);
        }),
        3000 + i * spread + Math.random() * 600
      )
    );
    later(() => {
      mutate((s) => {
        for (const l of botDiscussion(s).slice(0, 3)) {
          addLog(s, "chat", l.text, l.speaker);
          setLatestChats((prev) => ({ ...prev, [l.speaker]: l.text }));
        }
      });
    }, length * 0.72);
    later(() => startVote(), length);
  }, [g?.phase, g?.day]); // eslint-disable-line react-hooks/exhaustive-deps

  const startVote = useCallback(() => {
    clearTimers();
    mutate((s) => {
      if (s.phase !== "discussion") return;
      s.phase = "vote";
      s.votes = {};
      addLog(s, "narrator", "🗳️ Bỏ phiếu treo cổ! Đa số tuyệt đối mới bị treo, hoà phiếu thì không ai chết.");
    });
  }, [clearTimers, mutate]);

  // Vote: bots vote after the human (or when time runs out / human is dead).
  useEffect(() => {
    if (!g || g.phase !== "vote") return;
    setDeadline(Date.now() + (meAlive ? VOTE_MS : 4000));
    if (!meAlive) later(() => finalizeVote(null), 2500);
    else later(() => finalizeVote(undefined), VOTE_MS);
  }, [g?.phase, g?.day, kick]); // eslint-disable-line react-hooks/exhaustive-deps

  const finalizeVote = useCallback(
    (humanVote: string | null | undefined) => {
      clearTimers();
      setDeadline(null);
        if (gRef.current?.phase !== "vote") return;
      let bot: Record<string, string | null> = {};
      mutate((s) => {
        const h = human(s);
        if (h.alive) s.votes[h.id] = humanVote ?? null;
        bot = botVotes(s);
      });
      // Secret voting: reveal that each bot voted secretly without showing who they voted for!
      const entries = Object.entries(bot);
      entries.forEach(([voter, target], i) =>
        later(() => {
          mutate((s) => {
            s.votes[voter] = target;
            addLog(s, "vote", `🗳️ ${byId(s, voter)!.name} đã bỏ một lá phiếu kín.`);
          });
          if (soundEnabled) soundManager.playWerewolfVote();
        }, 250 + i * jit(240, 1.1))
      );

      // Once all secret ballots are in, trigger suspenseful GradientCarousel reveal!
      later(() => {
        if (!gRef.current) return;
        const s = gRef.current;
        const { executed, count } = tallyVotes(s.votes);

        const candidates: VoteCandidate[] = s.players
          .filter((p) => p.alive)
          .map((p) => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            votes: count.get(p.id) || 0,
            votedBy: s.players.filter((v) => s.votes[v.id] === p.id).map((v) => ({ name: v.name, avatar: v.avatar })),
            role: executed === p.id ? `${ROLE_INFO[p.role].emoji} ${ROLE_INFO[p.role].name}` : undefined,
          }))
          .sort((a, b) => b.votes - a.votes);

        setVoteRevealState({
          candidates,
          executed,
          isTie: !executed,
          count,
        });

        playNarratorVoice("vote_reveal");
      }, 600 + entries.length * 260);
    },
    [clearTimers, mutate, later, soundEnabled]
  );

  const onVoteRevealComplete = useCallback(() => {
    if (!voteRevealState) return;
    const { executed, count } = voteRevealState;
    setVoteRevealState(null);

    mutate((s) => {
      if (!executed) {
        const top = Math.max(0, ...count.values());
        addLog(
          s,
          "narrator",
          top
            ? "⚖️ Hoà phiếu — không ai bị trục xuất hôm nay."
            : "⚖️ Không ai nhận phiếu — không ai bị trục xuất."
        );
        if (soundEnabled) soundManager.playTurn();
      } else {
        const p = byId(s, executed)!;
        addLog(
          s,
          "death",
          `🪢 ${p.name} bị trục xuất với ${count.get(executed)} phiếu. Vai thật: ${ROLE_INFO[p.role].emoji} ${ROLE_INFO[p.role].name}.`
        );
        kill(s, executed, "vote");
        playFx({ id: Date.now().toString(), type: "execution", targetName: p.name });
        if (soundEnabled) soundManager.playWerewolfExecution();
      }
      if (endIfWinner(s)) return;
      if (s.pendingHunter) {
        s.phase = "hunter";
        s.afterHunter = "night";
        return;
      }
      s.day += 1;
      goNight(s);
    });
  }, [voteRevealState, mutate, soundEnabled, endIfWinner, goNight]);

  const castVote = useCallback(
    (targetId: string | null) => {
        if (soundEnabled) soundManager.playWerewolfVote();
      mutate((s) => {
        s.votes[human(s).id] = targetId;
        addLog(
          s,
          "vote",
          targetId
            ? `🗳️ ${human(s).name} (bạn) đã bí mật bỏ phiếu vào hòm.`
            : `🗳️ ${human(s).name} (bạn) đã bỏ phiếu trắng vào hòm.`
        );
      });
      finalizeVote(targetId);
    },
    [soundEnabled, mutate, finalizeVote]
  );

  // Game over → settlement.
  useEffect(() => {
    if (!g || g.phase !== "over" || !g.winner) return;
    clearTimers();
    setDeadline(null);
    const myTeam = teamOf(human(g).role);
    settle(myTeam === g.winner ? "win" : "loss", { name: matchOpp?.name ?? "Làng Ma Sói", elo: matchOpp?.elo ?? 1250 }, stake);
  }, [g?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clock tick only while a deadline exists.
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [g?.log.length]);

  /* ------------------------------ Human input ------------------------------ */

  const pick: Pick = useMemo(() => {
    if (!g || !meP) return null;
    if (g.phase === "hunter" && g.pendingHunter === meP.id) return { kind: "hunter" };
    if (!meP.alive) return null;
    if (g.phase === "vote" && g.votes[meP.id] === undefined) return { kind: "vote" };
    if (g.phase !== "night") return null;
    if (g.step === "cupid" && meP.role === "cupid" && !g.cupidDone) return { kind: "cupid" };
    if (g.step === "guard" && meP.role === "guard") return { kind: "guard" };
    if (g.step === "wolves" && isWolf(meP.role)) return { kind: "wolf" };
    if (g.step === "white_wolf" && meP.role === "white_wolf" && g.day % 2 === 0) return { kind: "white_wolf" };
    if (g.step === "seer" && meP.role === "seer" && !seerReveal) return { kind: "seer" };
    if (g.step === "witch" && meP.role === "witch" && witchChoice === "poison") return { kind: "poison" };
    return null;
  }, [g, meP, seerReveal, witchChoice]);


  const pickAction = pick
    ? ({ guard: ["Bảo vệ", "emerald"], wolf: ["Cắn", "red"], white_wolf: ["Cắn", "red"], seer: ["Soi", "violet"], poison: ["Đầu độc", "red"], vote: ["Bỏ phiếu", "amber"], hunter: ["Bắn", "red"], cupid: ["Se duyên", "pink"] } as const)[pick.kind]
    : undefined;

  const canTarget = (p: WPlayer) => {
    if (!pick || !g || !meP || !p.alive) return false;
    switch (pick.kind) {
      case "cupid":
        return !g.cupidTarget1 || p.id !== g.cupidTarget1;
      case "guard":
        return p.id !== g.lastGuarded;
      case "wolf":
        return !isWolf(p.role);
      case "white_wolf":
        return isWolf(p.role) && p.id !== meP.id;
      case "seer":
      case "poison":
      case "vote":
      case "hunter":
        return p.id !== meP.id;
    }
  };

  const onTarget = (p: WPlayer) => {
    if (!g || !pick || !canTarget(p)) return;
    switch (pick.kind) {
      case "cupid":
        if (!g.cupidTarget1) {
          mutate((s) => {
            s.cupidTarget1 = p.id;
          });
        } else {
          const p1 = g.cupidTarget1;
          const p2 = p.id;
          mutate((s) => {
            s.lovers = [p1, p2];
            s.cupidDone = true;
            s.cupidTarget1 = null;
            addLog(s, "narrator", `💘 Thần Tình Yêu đã se duyên cho ${byId(s, p1)?.name} và ${byId(s, p2)?.name}!`);
          });
          if (soundEnabled) soundManager.playCupidArrow();
          playFx({ id: Date.now().toString(), type: "cupid", targetName: `${byId(g, p1)?.name} & ${p.name}` });
          advanceStep();
        }
        break;
      case "guard":
        if (soundEnabled) soundManager.playWerewolfShield();
        playFx({ id: Date.now().toString(), type: "shield", targetName: p.name });
        mutate((s) => {
          s.guard = p.id;
        });
        advanceStep();
        break;
      case "wolf":
        if (soundEnabled) {
          soundManager.playWerewolfWolfHowl();
          soundManager.playWerewolfClawSlash();
        }
        playFx({ id: Date.now().toString(), type: "claw", targetName: p.name });
        mutate((s) => {
          s.wolfTarget = p.id;
        });
        advanceStep();
        break;
      case "white_wolf":
        if (soundEnabled) soundManager.playWerewolfClawSlash();
        playFx({ id: Date.now().toString(), type: "claw", targetName: p.name });
        mutate((s) => {
          s.whiteWolfTarget = p.id;
        });
        advanceStep();
        break;
      case "seer":
        const targetIsWolf = isWolf(p.role);
        if (soundEnabled) soundManager.playWerewolfSeer();
        playFx({ id: Date.now().toString(), type: "seer", targetName: p.name, seerResultIsWolf: targetIsWolf });
        mutate((s) => {
          s.seerCheck = p.id;
          s.seerResults[human(s).id] = { ...(s.seerResults[human(s).id] || {}), [p.id]: targetIsWolf };
        });
        setSeerReveal({ name: p.name, wolf: targetIsWolf });
        break;
      case "poison":
        if (soundEnabled) soundManager.playWitchPoison();
        playFx({ id: Date.now().toString(), type: "poison", targetName: p.name });
        mutate((s) => {
          s.poisonTarget = p.id;
          s.poisonUsed = true;
        });
        setWitchChoice(null);
        advanceStep();
        break;
      case "vote":
        castVote(p.id);
        break;
      case "hunter":
        mutate((s) => applyHunter(s, p.id));
        break;
    }
  };

  const sendChat = () => {
    const text = chat.trim();
    if (!text || !g || g.phase !== "discussion" || !meAlive) return;
    setChat("");
    let replies: { speaker: string; text: string }[] = [];
    mutate((s) => {
      addLog(s, "chat", text, human(s).id);
      replies = reactToHuman(s, text);
    });
    setLatestChats((prev) => ({ ...prev, [meP!.id]: text }));
    setTimeout(() => {
      setLatestChats((prev) => {
        const next = { ...prev };
        delete next[meP!.id];
        return next;
      });
    }, 4500);
    replies.forEach((r, i) =>
      later(
        () =>
          mutate((s) => {
            addLog(s, "chat", r.text, r.speaker);
            setLatestChats((prev) => ({ ...prev, [r.speaker]: r.text }));
            setTimeout(() => {
              setLatestChats((prev) => {
                const next = { ...prev };
                delete next[r.speaker];
                return next;
              });
            }, 4500);
          }),
        1200 + i * 1100
      )
    );
  };

  const start = () => {
    if (useCooldownStore.getState().until > Date.now()) return;
    clearTimers();
    resetSettlement();
    setWitchChoice(null);
    setSeerReveal(null);
    setDemoRole(null);
    setG(createGame(setup.roles.length, { id: me.id, name: me.username, avatar: me.avatar }, { roles: setup.roles, myRole: setup.myRole === "random" ? undefined : setup.myRole }));
    setRoleModalMode("roulette");
    setShowRole(true);
  };

  /** Dừng ván ngay lập tức, quay về phòng chờ (không tính thắng/thua). */
  const stopGame = () => {
    // bỏ ngang ván có cược → phạt cooldown dài hơn
    if (stake > 0 && g && g.phase !== "over") useCooldownStore.getState().start(COOLDOWN.abandon, "Bỏ giữa trận");
    clearTimers();
    stopNarratorVoice();
    resetSettlement();
    session.clear();
    setDeadline(null);
    setVoteRevealState(null);
    setWitchChoice(null);
    setSeerReveal(null);
    setShowRole(false);
    setFxQueue([]);
    setPhaseBanner(null);
    setLatestChats({});
    setChat("");
    setG(null);
  };

  /* --------------------------------- Render --------------------------------- */

  if (onlineRoom) return <WerewolfOnline roomId={onlineRoom} onExit={() => setOnlineRoom(null)} />;

  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  const isNight = g?.phase === "night" || g?.phase === "reveal";
  const knownRole = (p: WPlayer) => {
    if (!g || !meP) return null;
    if (p.isHuman || !p.alive || g.phase === "over" || !meP.alive) return p.role;
    if (meP.role === "wolf" && p.role === "wolf") return p.role;
    return null;
  };
  const seerMark = (p: WPlayer) => (g && meP ? g.seerResults[meP.id]?.[p.id] : undefined);
  const voteCount = (id: string) => (g ? Object.values(g.votes).filter((v) => v === id).length : 0);

  const prompt = (() => {
    if (!g || !meP) return "";
    if (g.phase === "reveal") return "Xem vai của bạn — quản trò sắp mở đêm";
    if (g.phase === "over") return g.winner === teamOf(meP.role) ? "🎉 Phe bạn thắng!" : "Phe bạn thua…";
    if (!meP.alive && g.phase !== "hunter") return "👻 Hồn ma — thấy mọi vai";
    if (pick?.kind === "guard") return "🛡️ Chọn người bảo vệ";
    if (pick?.kind === "wolf") return "🐺 Chọn con mồi";
    if (pick?.kind === "seer") return "🔮 Chọn người để soi";
    if (pick?.kind === "poison") return "🧪 Chọn người đầu độc";
    if (pick?.kind === "vote") return "🗳️ Chọn người treo cổ";
    if (pick?.kind === "hunter") return "🏹 Bắn theo một người!";
    if (g.phase === "night") return STEP_LABEL[g.step] ?? "🌙 Đêm đang trôi…";
    if (g.phase === "discussion") return "💬 Thảo luận — tìm Sói";
    if (g.phase === "vote") return "🗳️ Đang kiểm phiếu…";
    if (g.phase === "hunter") return "🏹 Thợ Săn đang ngắm…";
    return "";
  })();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
    <div className="mx-auto max-w-[1360px] px-4 pb-10 sm:px-6">
      <GameHeader game="werewolf" subtitle={g ? `Ngày ${g.day} · ${alive(g).length}/${g.players.length} còn sống` : "Sói · Tiên tri · Bảo vệ · Phù thủy · Thợ săn"}>
        {g && g.phase !== "over" && (
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

      {!g ? (
        <>
        <WerewolfOnlineEntry roles={setup.roles} onEnter={setOnlineRoom} />
        <WerewolfLobby
          setup={setup}
          setSetup={setSetup}
          stake={stake}
          setStake={setStake}
          onStart={start}
          onPreviewRoulette={() => {
            const roles: import("@/lib/games/werewolf-engine").Role[] = ["wolf", "seer", "guard", "witch", "hunter", "villager"];
            setDemoRole(roles[Math.floor(Math.random() * roles.length)]);
            setRoleModalMode("roulette");
            setShowRole(true);
          }}
        />
        </>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_clamp(300px,28vw,400px)]">
          <div className="space-y-4">
            {/* Control dock */}
            <div className="space-y-2">
              <div className={cn("flex flex-wrap items-center gap-2 rounded-2xl border p-2 pl-2.5 backdrop-blur-xl transition-colors duration-700", isNight ? "border-violet-400/25 bg-[#120d24]/85" : "border-amber-300/30 bg-[#1f1608]/85")}>
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", isNight ? "bg-violet-500/25 text-violet-200" : "bg-amber-400/25 text-amber-200")}>
                  {isNight ? <Moon className="size-5" /> : g.phase === "over" ? <span className="text-xl"><Emoji e="🏁" /></span> : <Sun className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-white/50">{g.phase === "over" ? "Kết thúc" : isNight ? `Đêm ${g.day}` : `Ngày ${g.day}`}</p>
                  <p className="truncate text-sm font-extrabold text-white sm:text-base"><EmojiText>{prompt}</EmojiText></p>
                </div>
                {secondsLeft !== null && (g.phase === "discussion" || g.phase === "vote") && (
                  <span className={cn("flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-mono text-sm font-extrabold", secondsLeft <= 10 ? "animate-pulse bg-red-500/25 text-red-200" : "bg-white/10 text-white")}>
                    <Timer className="size-4" /> {secondsLeft}
                  </span>
                )}

                {pick?.kind === "vote" && (
                  <DockBtn
                    icon={<Square className="size-4" />}
                    label="Phiếu trắng"
                    onClick={() => {
                      mutate((s) => {
                        s.votes[human(s).id] = null;
                        addLog(s, "vote", `${human(s).name} (bạn) → bỏ phiếu trắng`);
                      });
                      finalizeVote(null);
                    }}
                  />
                )}
                {pick?.kind === "hunter" && <DockBtn icon={<X className="size-4" />} label="Không bắn" onClick={() => mutate((s) => applyHunter(s, null))} />}
                {pick?.kind === "poison" && (
                  <DockBtn
                    icon={<X className="size-4" />}
                    label="Bỏ qua"
                    onClick={() => {
                      setWitchChoice(null);
                      advanceStep();
                    }}
                  />
                )}
                {g.phase === "over" && (
                  <DockBtn icon={cooldown.active ? <Timer className="size-4" /> : <Play className="size-4" />} label={cooldown.active ? `${cooldown.seconds}s` : "Ván mới"} tone="lime" disabled={cooldown.active} onClick={start} />
                )}

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
                  onClick={stopGame}
                  title="Dừng game"
                  className="flex items-center gap-1.5 rounded-xl border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs font-black text-red-200 transition hover:scale-105 hover:bg-red-500/30 active:scale-95"
                >
                  <Square className="size-3.5 fill-current" /> Dừng
                </button>
              </div>

              {witchChoice === "ask" && g.phase === "night" && g.step === "witch" && (
                <WitchPanel
                  state={g}
                  onHeal={(heal) => {
                    if (heal) {
                      if (soundEnabled) soundManager.playWitchHeal();
                      playFx({ id: Date.now().toString(), type: "heal", targetName: byId(g, g.wolfTarget)?.name });
                    }
                    mutate((s) => {
                      if (heal) {
                        s.healed = true;
                        s.healUsed = true;
                      }
                    });
                    setWitchChoice(g.poisonUsed ? null : "poison");
                    if (g.poisonUsed) advanceStep();
                  }}
                />
              )}
              {seerReveal && (
                <div className={cn("flex items-center gap-3 rounded-2xl border px-4 py-2.5 font-bold", seerReveal.wolf ? "border-red-400/50 bg-red-500/20 text-red-100" : "border-emerald-400/40 bg-emerald-500/15 text-emerald-100")}>
                  <Emoji e="🔮" /> {seerReveal.name} <EmojiText>{seerReveal.wolf ? "🐺 SÓI" : "✅ Người tốt"}</EmojiText>
                  <button
                    type="button"
                    className="ml-auto grid size-8 place-items-center rounded-xl bg-white text-black transition hover:scale-110 active:scale-95"
                    title="Đã nhớ"
                    onClick={() => {
                      setSeerReveal(null);
                      advanceStep();
                    }}
                  >
                    <Check className="size-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Players Arena — mọi hiệu ứng/hành động hiển thị ngay trong khung này */}
            <div className="relative" style={{ minHeight: showRole || voteRevealState ? "clamp(520px, calc(100dvh - 190px), 680px)" : undefined }}>
            {viewMode === "circle" ? (
              <WerewolfRoundtable
                state={g}
                humanPlayer={meP!}
                canTarget={canTarget}
                onTarget={onTarget}
                targetKind={pick?.kind ?? null}
                secondsLeft={secondsLeft}
                prompt={prompt}
                isHumanSpeaking={voice.isSpeaking}
                isHumanMicOn={voice.isMicOn}
                humanVolume={voice.volume}
                latestChats={latestChats}
                narrationKey={`${g.phase}-${g.day}-${g.step}`}
              />
            ) : (
              <div className={cn("grid gap-3", g.players.length > 10 ? "grid-cols-3 sm:grid-cols-4 xl:grid-cols-6" : "grid-cols-2 sm:grid-cols-4")}>
                {g.players.map((p) => {
                  const role = knownRole(p);
                  const speaking = p.alive && (p.isHuman ? voice.isSpeaking : !!latestChats[p.id]);
                  return (
                    <SeatCard
                      key={p.id}
                      variant="tile"
                      name={p.name}
                      avatar={p.avatar}
                      alive={p.alive}
                      isMe={p.isHuman}
                      role={role}
                      packmate={!role && isWolf(meP?.role || "villager") && isWolf(p.role)}
                      targetable={canTarget(p)}
                      action={pickAction ? { label: pickAction[0], tone: pickAction[1] } : undefined}
                      dimmed={!!pickAction && !canTarget(p)}
                      speaking={speaking}
                      micOn={p.alive && (p.isHuman ? voice.isMicOn || voice.isSpeaking : speaking)}
                      hasVoted={g.phase === "vote" && g.votes[p.id] !== undefined}
                      lover={!!g.lovers?.includes(p.id)}
                      votes={voteCount(p.id)}
                      seerMark={seerMark(p)}
                      onClick={() => onTarget(p)}
                    />
                  );
                })}
              </div>
            )}
              {/* 3D Suspense Gradient Carousel for Vote Reveal */}
              {voteRevealState && (
                <GradientCarousel
                  candidates={voteRevealState.candidates}
                  eliminatedId={voteRevealState.executed}
                  isTie={voteRevealState.isTie}
                  onComplete={onVoteRevealComplete}
                />
              )}

              <AnimatePresence>
                {phaseBanner && (
                  <motion.div
                    key={phaseBanner.key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className={cn(
                      "pointer-events-none absolute inset-0 z-[45] grid place-items-center rounded-[36px] overflow-hidden",
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

              {/* Action FX Visual Overlay (Claw, Poison, Heal, Seer, Shield, Cupid, Execution) */}
              <WerewolfActionFxOverlay currentFx={currentFx} onFinish={popFx} />

              {g && meP && (
                <WerewolfRoleRandomizer
                  inline
                  isOpen={showRole}
                  role={meP.role}
                  players={g.players}
                  initialMode={roleModalMode}
                  onClose={() => setShowRole(false)}
                />
              )}

            </div>
          </div>

          {/* Log + chat */}
          <div className="panel flex h-[min(78dvh,760px)] flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <p className="font-display text-sm font-bold">Nhật ký làng</p>
              <span className="chip">
                <Users className="size-3" /> {alive(g).length} sống
              </span>
            </div>
            <div ref={logRef} className="flex-1 no-scrollbar overflow-y-auto px-4 py-4">
              {g.log.filter((l) => l.kind !== "vote").map((l, i, arr) => {
                if (l.kind === "chat") {
                  const sp = byId(g, l.speaker);
                  const me = !!sp?.isHuman;
                  const prev = arr[i - 1];
                  const grouped = prev?.kind === "chat" && prev.speaker === l.speaker;
                  return (
                    <motion.div key={l.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={cn("flex items-end gap-2.5", me && "flex-row-reverse", grouped ? "mt-1" : "mt-4")}>
                      <div className="size-8 shrink-0">
                        {!grouped && <UserAvatar src={sp?.avatar} name={sp?.name ?? "?"} className="size-8" />}
                      </div>
                      <div className={cn("flex max-w-[78%] flex-col gap-1", me && "items-end")}>
                        {!grouped && !me && <p className="px-1 text-xs font-semibold text-ink-300">{sp?.name}</p>}
                        <div className={cn("w-fit break-words rounded-2xl px-3.5 py-2 text-sm leading-snug", me ? "rounded-br-md bg-lime-400 font-medium text-black" : "rounded-bl-md bg-white/[0.07] text-ink-100")}>
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
                return (
                  <motion.p key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 px-2 text-center text-xs leading-relaxed text-ink-400">
                    <EmojiText>{l.text}</EmojiText>
                  </motion.p>
                );
              })}
            </div>
            <div className="border-t border-white/[0.06] p-3">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-ink-850 p-1.5 pl-2 focus-within:border-lime-400/50">
                <WerewolfMicButton voice={voice} disabled={g.phase !== "discussion" || !meAlive} />
                <input
                  value={chat}
                  onChange={(e) => setChat(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  disabled={g.phase !== "discussion" || !meAlive}
                  maxLength={200}
                  placeholder={
                    g.phase === "discussion" && meAlive
                      ? voice.isMicOn
                        ? "…"
                        : "Nói gì đó…"
                      : "Chat đã khoá"
                  }
                  className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-ink-500 disabled:opacity-50"
                />
                <button type="button" onClick={sendChat} disabled={g.phase !== "discussion" || !meAlive || !chat.trim()} className="grid size-9 place-items-center rounded-full bg-lime-400 text-black disabled:opacity-30" aria-label="Gửi">
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* High-Impact 3D Tilted Tiles Role Randomizer & Mystery Card Reveal */}
      {!g && demoRole && (
        <WerewolfRoleRandomizer
          isOpen={showRole}
          role={demoRole}
          players={[]}
          initialMode={roleModalMode}
          onClose={() => setShowRole(false)}
        />
      )}


      <MatchResultModal
        isOpen={resultOpen}
        onClose={() => setResultOpen(false)}
        onPlayAgain={start}
        resultData={result}
        reason={g?.winner ? (g.winner === "village" ? "Dân làng đã tìm ra tất cả Sói" : "Bầy Sói đã chiếm lấy ngôi làng") : undefined}
      />
    </div>
    </div>
  );
}

function WitchPanel({ state, onHeal }: { state: WState; onHeal: (heal: boolean) => void }) {
  const victim = byId(state, state.wolfTarget);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-black bg-ink-100 px-4 py-2 text-black">
      <span className="font-bold"><Emoji e="🧪" /> {victim ? `Sói vừa cắn ${victim.name}.` : "Đêm nay Sói không cắn ai."}</span>
      {victim && !state.healUsed ? (
        <>
          <button type="button" className="rounded-xl bg-black px-3 py-1 text-xs font-bold text-white" onClick={() => onHeal(true)}>
            Dùng bình Cứu
          </button>
          <button type="button" className="rounded-xl border-2 border-black px-3 py-1 text-xs font-bold" onClick={() => onHeal(false)}>
            Không cứu
          </button>
        </>
      ) : (
        <button type="button" className="rounded-xl bg-black px-3 py-1 text-xs font-bold text-white" onClick={() => onHeal(false)}>
          {state.healUsed ? "Bình Cứu đã dùng — tiếp" : "Tiếp"}
        </button>
      )}
    </div>
  );
}

export default WerewolfGame;
