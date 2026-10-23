"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Moon, Play, Send, Skull, Sun, Timer, Users, Vote } from "lucide-react";
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
import { GameHeader, Segmented, StakePicker, useGameSession, useMatchSettlement } from "./shared";
import { WerewolfRoleRandomizer } from "./werewolf-role-randomizer";
import { WerewolfRoundtable } from "./werewolf-roundtable";
import { WerewolfActionFxOverlay, WerewolfFxEvent } from "./werewolf-action-fx";
import { useWerewolfVoice, WerewolfMicButton } from "./werewolf-voice";
import { RotatingCards } from "@/components/reactbits/rotating-cards";
import { GradientCarousel, VoteCandidate } from "@/components/reactbits/gradient-carousel";
import { playNarratorVoice } from "@/lib/narrator-audio";

const DISCUSS_MS = 60_000;
const VOTE_MS = 30_000;
const STEP_LABEL: Record<string, string> = {
  cupid: "💘 Thần Tình Yêu thức dậy, chọn 2 người để se duyên…",
  guard: "🛡️ Bảo Vệ thức dậy, chọn người để che chở…",
  wolves: "🐺 Bầy Sói thức dậy, chọn con mồi…",
  white_wolf: "🐺⚪ Sói Trắng thức dậy, chọn 1 con sói để trừ khử…",
  seer: "🔮 Tiên Tri thức dậy, soi một người…",
  witch: "🧪 Phù Thủy thức dậy, cân nhắc hai bình thuốc…",
};

type Pick = null | { kind: "cupid" | "guard" | "wolf" | "white_wolf" | "seer" | "poison" | "vote" | "hunter" };

export function WerewolfGame() {
  const me = useAppStore(useShallow((s) => ({ id: s.currentUser.id, username: s.currentUser.username, avatar: s.currentUser.avatar })));
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const { settle, reset: resetSettlement, result, open: resultOpen, setOpen: setResultOpen } = useMatchSettlement("werewolf");
  const session = useGameSession<{ state: WState; stake: number }>("werewolf");

  const [count, setCount] = useState<8 | 10 | 12>(8);
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
  const [now, setNow] = useState(Date.now());
  const [chat, setChat] = useState("");
  const [witchChoice, setWitchChoice] = useState<"ask" | "poison" | null>(null);
  const [seerReveal, setSeerReveal] = useState<{ name: string; wolf: boolean } | null>(null);
  const [showRole, setShowRole] = useState(false);
  const [roleModalMode, setRoleModalMode] = useState<"roulette" | "inspect">("roulette");
  const [demoRole, setDemoRole] = useState<import("@/lib/games/werewolf-engine").Role | null>(null);
  const [currentFx, setCurrentFx] = useState<WerewolfFxEvent | null>(null);
  const [viewMode, setViewMode] = useState<"circle" | "grid">("circle");
  const [latestChats, setLatestChats] = useState<Record<string, string>>({});
  const [voteRevealState, setVoteRevealState] = useState<{
    candidates: VoteCandidate[];
    executed: string | null;
    isTie: boolean;
    count: Map<string, number>;
  } | null>(null);
  const [showRotatingVoteModal, setShowRotatingVoteModal] = useState(false);
  const [rotatingVoteSelected, setRotatingVoteSelected] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const voice = useWerewolfVoice(
    useCallback((speechText: string) => {
      if (gRef.current?.phase === "discussion") {
        setChat(speechText);
      }
    }, [])
  );

  useEffect(() => {
    const s = parseInt(new URLSearchParams(window.location.search).get("stake") || "", 10);
    if (s > 0) setStake(s);
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback(() => {
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
      if (soundEnabled) soundManager.playWerewolfNight();
    },
    [soundEnabled]
  );

  const advanceStep = useCallback(() => {
    mutate((s) => {
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
    });
  }, [mutate, soundEnabled]);

  // Night: walk through steps, pausing for the human's role.
  useEffect(() => {
    if (!g || g.phase !== "night") return;
    const h = human(g);
    if (g.step === "done") {
      later(() => {
        mutate((s) => {
          const deaths = resolveNight(s);
          s.phase = "dawn";
          if (deaths.length) {
            for (const id of deaths) {
              const p = byId(s, id)!;
              addLog(s, "death", `☠️ ${p.name} đã chết${p.cause === "poison" ? " (trúng độc)" : p.cause === "lover" ? " (chết vì người yêu)" : ""}. Vai: ${ROLE_INFO[p.role].emoji} ${ROLE_INFO[p.role].name}.`);
            }
            if (soundEnabled) soundManager.playWerewolfDeath();
          } else {
            addLog(s, "narrator", "☀️ Trời sáng. Một đêm bình yên — không ai chết!");
            if (soundEnabled) soundManager.playWerewolfDawn();
          }
        });
      }, 700 * pace);
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
    later(advanceStep, (actorAlive ? 1100 : 900) * pace);
  }, [g?.phase, g?.step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dawn → hunter or discussion.
  useEffect(() => {
    if (!g || g.phase !== "dawn") return;
    later(() => {
      mutate((s) => {
        if (endIfWinner(s)) return;
        if (s.pendingHunter) {
          s.phase = "hunter";
          s.afterHunter = "discussion";
          return;
        }
        s.phase = "discussion";
        addLog(s, "narrator", `💬 Ngày ${s.day}: thảo luận ${DISCUSS_MS / 1000}s rồi bỏ phiếu.`);
      });
    }, 1600 * pace);
  }, [g?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hunter shot.
  useEffect(() => {
    if (!g || g.phase !== "hunter" || !g.pendingHunter) return;
    const hunter = byId(g, g.pendingHunter)!;
    if (hunter.isHuman) return; // wait for the human
    later(() => {
      mutate((s) => {
        const target = botHunterShot(s, s.pendingHunter!);
        applyHunter(s, target);
      });
    }, 1300 * pace);
  }, [g?.phase, g?.pendingHunter]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyHunter = useCallback(
    (s: WState, target: string | null) => {
      const hunter = byId(s, s.pendingHunter)!;
      s.pendingHunter = null;
      if (target) {
        const t = byId(s, target)!;
        addLog(s, "death", `🏹 Thợ Săn ${hunter.name} bắn hạ ${t.name}! Vai: ${ROLE_INFO[t.role].emoji} ${ROLE_INFO[t.role].name}.`);
        kill(s, target, "hunter");
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
    [endIfWinner, goNight, soundEnabled]
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
        900 + i * spread + Math.random() * 600
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
    if (meAlive && g.votes[meP?.id || ""] === undefined) {
      setShowRotatingVoteModal(true);
    }
    if (!meAlive) later(() => finalizeVote(null), 2500);
    else later(() => finalizeVote(undefined), VOTE_MS);
  }, [g?.phase, g?.day]); // eslint-disable-line react-hooks/exhaustive-deps

  const finalizeVote = useCallback(
    (humanVote: string | null | undefined) => {
      clearTimers();
      setDeadline(null);
      setShowRotatingVoteModal(false);
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
        }, 350 + i * 260)
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
        setCurrentFx({ id: Date.now().toString(), type: "execution", targetName: p.name });
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
      setShowRotatingVoteModal(false);
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
    settle(myTeam === g.winner ? "win" : "loss", { name: "Làng Ma Sói", elo: 1250 }, stake);
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
          setCurrentFx({ id: Date.now().toString(), type: "cupid", targetName: `${byId(g, p1)?.name} & ${p.name}` });
          advanceStep();
        }
        break;
      case "guard":
        if (soundEnabled) soundManager.playWerewolfShield();
        setCurrentFx({ id: Date.now().toString(), type: "shield", targetName: p.name });
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
        setCurrentFx({ id: Date.now().toString(), type: "claw", targetName: p.name });
        mutate((s) => {
          s.wolfTarget = p.id;
        });
        advanceStep();
        break;
      case "white_wolf":
        if (soundEnabled) soundManager.playWerewolfClawSlash();
        setCurrentFx({ id: Date.now().toString(), type: "claw", targetName: p.name });
        mutate((s) => {
          s.whiteWolfTarget = p.id;
        });
        advanceStep();
        break;
      case "seer":
        const targetIsWolf = isWolf(p.role);
        if (soundEnabled) soundManager.playWerewolfSeer();
        setCurrentFx({ id: Date.now().toString(), type: "seer", targetName: p.name, seerResultIsWolf: targetIsWolf });
        mutate((s) => {
          s.seerCheck = p.id;
          s.seerResults[human(s).id] = { ...(s.seerResults[human(s).id] || {}), [p.id]: targetIsWolf };
        });
        setSeerReveal({ name: p.name, wolf: targetIsWolf });
        break;
      case "poison":
        if (soundEnabled) soundManager.playWitchPoison();
        setCurrentFx({ id: Date.now().toString(), type: "poison", targetName: p.name });
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
        if (soundEnabled) soundManager.playWerewolfHunter();
        setCurrentFx({ id: Date.now().toString(), type: "hunter", targetName: p.name });
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
    clearTimers();
    resetSettlement();
    setWitchChoice(null);
    setSeerReveal(null);
    setDemoRole(null);
    setG(createGame(count, { id: me.id, name: me.username, avatar: me.avatar }));
    setRoleModalMode("roulette");
    setShowRole(true);
  };

  /* --------------------------------- Render --------------------------------- */

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
    if (g.phase === "reveal") return "Xem vai của bạn rồi bắt đầu đêm đầu tiên.";
    if (g.phase === "over") return g.winner === teamOf(meP.role) ? "Phe bạn thắng! 🎉" : "Phe bạn thua rồi…";
    if (!meP.alive && g.phase !== "hunter") return "👻 Bạn đã chết — đang xem với góc nhìn hồn ma (thấy mọi vai).";
    if (pick?.kind === "guard") return `Chọn 1 người để bảo vệ đêm nay${g.lastGuarded ? ` (không được chọn ${byId(g, g.lastGuarded)?.name})` : ""}.`;
    if (pick?.kind === "wolf") return "Chọn con mồi cho bầy Sói đêm nay.";
    if (pick?.kind === "seer") return "Chọn 1 người để soi.";
    if (pick?.kind === "poison") return "Chọn người để đầu độc (hoặc huỷ).";
    if (pick?.kind === "vote") return "Bấm vào người bạn muốn treo cổ, hoặc bỏ phiếu trắng.";
    if (pick?.kind === "hunter") return "Bạn là Thợ Săn và vừa chết — chọn 1 người để bắn theo!";
    if (g.phase === "night") return STEP_LABEL[g.step] ?? "Đêm đang trôi qua…";
    if (g.phase === "discussion") return "Thảo luận: nhắc tên ai đó + “sói/nghi” để buộc tội, hoặc “tôi là tiên tri”.";
    if (g.phase === "vote") return "Đang kiểm phiếu…";
    if (g.phase === "hunter") return "Thợ Săn đang ngắm bắn…";
    return "";
  })();

  return (
    <div className="mx-auto max-w-[1360px] px-4 sm:px-6">
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
        <Lobby
          count={count}
          setCount={setCount}
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
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_clamp(300px,28vw,400px)]">
          <div className="space-y-4">
            {/* Phase banner */}
            <div
              className={cn(
                "relative overflow-hidden rounded-3xl border border-white/10 p-5 transition-colors duration-700",
                isNight ? "bg-ink-850 text-white" : "bg-white text-black"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn("grid size-14 place-items-center rounded-2xl", isNight ? "bg-white text-black" : "bg-black text-white")}>
                  {isNight ? <Moon className="size-7" /> : g.phase === "over" ? <span className="text-3xl">🏁</span> : <Sun className="size-7" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] opacity-75">
                    {g.phase === "over" ? "Kết thúc" : isNight ? `Đêm ${g.day}` : `Ngày ${g.day}`}
                  </p>
                  <p className="font-display text-xl font-extrabold leading-tight sm:text-2xl">{prompt}</p>
                </div>
                {secondsLeft !== null && (g.phase === "discussion" || g.phase === "vote") && (
                  <div className="flex items-center gap-1.5 rounded-2xl bg-black/80 px-3 py-2 font-mono text-lg font-extrabold text-white">
                    <Timer className="size-4" /> {secondsLeft}s
                  </div>
                )}
              </div>

              {/* Contextual actions */}
              <div className="mt-4 flex flex-wrap gap-2">
                {g.phase === "reveal" && (
                  <button
                    type="button"
                    className="btn-lime"
                    onClick={() =>
                      mutate((s) => {
                        goNight(s);
                      })
                    }
                  >
                    <Moon className="size-4" /> Bắt đầu Đêm 1
                  </button>
                )}
                {g.phase === "discussion" && meAlive && (
                  <button type="button" className="btn-dark" onClick={startVote}>
                    <Vote className="size-4" /> Bỏ phiếu ngay
                  </button>
                )}
                {pick?.kind === "vote" && (
                  <button
                    type="button"
                    className="btn-dark"
                    onClick={() => {
                      mutate((s) => {
                        s.votes[human(s).id] = null;
                        addLog(s, "vote", `${human(s).name} (bạn) → bỏ phiếu trắng`);
                      });
                      finalizeVote(null);
                    }}
                  >
                    Bỏ phiếu trắng
                  </button>
                )}
                {pick?.kind === "hunter" && (
                  <button type="button" className="btn-dark" onClick={() => mutate((s) => applyHunter(s, null))}>
                    Không bắn
                  </button>
                )}
                {witchChoice === "ask" && g.phase === "night" && g.step === "witch" && (
                  <WitchPanel
                    state={g}
                    onHeal={(heal) => {
                      if (heal) {
                        if (soundEnabled) soundManager.playWitchHeal();
                        setCurrentFx({ id: Date.now().toString(), type: "heal", targetName: byId(g, g.wolfTarget)?.name });
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
                {pick?.kind === "poison" && (
                  <button
                    type="button"
                    className="btn-dark"
                    onClick={() => {
                      setWitchChoice(null);
                      advanceStep();
                    }}
                  >
                    Không dùng bình Độc
                  </button>
                )}
                {seerReveal && (
                  <div className={cn("flex items-center gap-3 rounded-2xl border-2 border-black px-4 py-2 font-bold", seerReveal.wolf ? "bg-pop-red text-white" : "bg-ink-900 text-white")}>
                    🔮 {seerReveal.name} {seerReveal.wolf ? "là SÓI 🐺" : "là người tốt ✅"}
                    <button
                      type="button"
                      className="rounded-xl bg-black px-3 py-1 text-xs text-white"
                      onClick={() => {
                        setSeerReveal(null);
                        advanceStep();
                      }}
                    >
                      Đã nhớ
                    </button>
                  </div>
                )}
                {g.phase === "over" && (
                  <button type="button" className="btn-dark" onClick={start}>
                    <Play className="size-4" /> Ván mới
                  </button>
                )}
              </div>
            </div>

            {/* View Mode Toggle: Bàn Tròn Lửa Trại vs Dạng Lưới */}
            <div className="flex items-center justify-between px-1">
              <span className="font-mono text-xs font-bold text-ink-300 uppercase tracking-wider">
                {viewMode === "circle" ? "🔥 Đấu Trường Bàn Tròn Lửa Trại" : "▦ Danh Sách Người Chơi"}
              </span>
              <div className="flex rounded-xl bg-white/[0.08] p-1 border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("circle")}
                  className={cn(
                    "px-3 py-1 rounded-lg font-bold transition-all",
                    viewMode === "circle" ? "bg-white text-black shadow-sm" : "text-white/60 hover:text-white"
                  )}
                >
                  Vòng Tròn 3D
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "px-3 py-1 rounded-lg font-bold transition-all",
                    viewMode === "grid" ? "bg-white text-black shadow-sm" : "text-white/60 hover:text-white"
                  )}
                >
                  Dạng Lưới
                </button>
              </div>
            </div>

            {/* Players Arena */}
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
                humanVolume={voice.volume}
                latestChats={latestChats}
                onOpenRotatingVote={() => setShowRotatingVoteModal(true)}
              />
            ) : (
              <div className={cn("grid gap-3", g.players.length > 10 ? "grid-cols-3 sm:grid-cols-4 xl:grid-cols-6" : "grid-cols-2 sm:grid-cols-4")}>
                {g.players.map((p) => {
                  const role = knownRole(p);
                  const targetable = canTarget(p);
                  const mark = seerMark(p);
                  const votes = voteCount(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!targetable}
                      onClick={() => onTarget(p)}
                      className={cn(
                        "group relative flex flex-col items-center rounded-3xl border-2 p-3 text-center transition-all",
                        p.alive ? "border-white/[0.08] bg-ink-850" : "border-transparent bg-ink-900/60 opacity-55 grayscale",
                        targetable && "cursor-pointer border-lime-400/50 hover:-translate-y-1 hover:border-lime-400 hover:bg-lime-400/10",
                        p.isHuman && "ring-2 ring-pop-violet/60"
                      )}
                    >
                      {votes > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 z-10 grid size-7 place-items-center rounded-full border-2 border-black bg-white text-xs font-black text-black">{votes}</span>
                      )}
                      <div className="relative">
                        <UserAvatar src={p.avatar} name={p.name} className="size-14" />
                        {!p.alive && <Skull className="absolute -bottom-1 -right-1 size-6 rounded-full bg-black p-1 text-pop-red" />}
                        {mark !== undefined && p.alive && <span className="absolute -left-1 -top-1 text-lg">{mark ? "🐺" : "✅"}</span>}
                      </div>
                      <p className="mt-2 w-full truncate text-[13px] font-bold">
                        {p.name}
                        {p.isHuman && <span className="text-pop-violet"> (bạn)</span>}
                      </p>
                      <div className="mt-1 flex min-h-[22px] flex-wrap items-center justify-center gap-1">
                        {role && (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-black text-black" style={{ background: ROLE_INFO[role]?.color || "#fff" }}>
                            {ROLE_INFO[role]?.emoji} {ROLE_INFO[role]?.name}
                          </span>
                        )}
                        {p.claim === "seer" && p.alive && !role && <span className="rounded-full border border-pop-violet/40 px-2 py-0.5 text-[10px] font-bold text-pop-violet">Nhận Tiên Tri</span>}
                        {g.phase === "night" && g.step === "wolves" && isWolf(meP?.role || "villager") && meAlive && g.wolfTarget === p.id && <span className="text-[10px] font-bold text-pop-red">Mồi</span>}
                        {g.lastGuarded === p.id && meP?.role === "guard" && <span className="text-[10px] text-pop-cyan">Đêm trước</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Log + chat */}
          <div className="panel flex h-[min(78dvh,760px)] flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <p className="font-display text-sm font-bold">Nhật ký làng</p>
              <span className="chip">
                <Users className="size-3" /> {alive(g).length} sống
              </span>
            </div>
            <div ref={logRef} className="flex-1 space-y-2 no-scrollbar overflow-y-auto px-4 py-3">
              {g.log.map((l) => {
                if (l.kind === "chat") {
                  const sp = byId(g, l.speaker);
                  return (
                    <div key={l.id} className={cn("flex gap-2", sp?.isHuman && "flex-row-reverse")}>
                      <UserAvatar src={sp?.avatar} name={sp?.name ?? "?"} className="size-7" />
                      <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-[13px]", sp?.isHuman ? "rounded-tr-md bg-lime-400 text-black" : "rounded-tl-md bg-ink-800")}>
                        {!sp?.isHuman && <p className="text-[10px] font-bold text-ink-300">{sp?.name}</p>}
                        {l.text}
                      </div>
                    </div>
                  );
                }
                return (
                  <p
                    key={l.id}
                    className={cn(
                      "rounded-xl px-3 py-2 text-[12px]",
                      l.kind === "death" && "border border-pop-red/30 bg-pop-red/10 font-semibold text-[#ffb3bb]",
                      l.kind === "narrator" && "bg-white/[0.03] italic text-ink-200",
                      l.kind === "vote" && "py-1 font-mono text-[11px] text-ink-200"
                    )}
                  >
                    {l.text}
                  </p>
                );
              })}
            </div>
            <div className="border-t border-white/[0.06] p-3">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-ink-850 p-1.5">
                <WerewolfMicButton voice={voice} />
                <input
                  value={chat}
                  onChange={(e) => setChat(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  disabled={g.phase !== "discussion" || !meAlive}
                  maxLength={200}
                  placeholder={
                    g.phase === "discussion" && meAlive
                      ? voice.isMicOn
                        ? "🎤 Đang nghe mic của bạn…"
                        : "VD: Tuấn Dev nghi là sói…"
                      : "Chỉ chat được lúc thảo luận ban ngày"
                  }
                  className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-[13px] outline-none placeholder:text-ink-500 disabled:opacity-50"
                />
                <button type="button" onClick={sendChat} disabled={g.phase !== "discussion" || !meAlive || !chat.trim()} className="grid size-9 place-items-center rounded-xl bg-lime-400 text-black disabled:opacity-30" aria-label="Gửi">
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* High-Impact 3D Tilted Tiles Role Randomizer & Mystery Card Reveal */}
      {(meP || demoRole) && (
        <WerewolfRoleRandomizer
          isOpen={showRole}
          role={meP ? meP.role : (demoRole || "wolf")}
          players={g ? g.players : []}
          initialMode={roleModalMode}
          onClose={() => setShowRole(false)}
          onStartNight1={() => {
            if (g && g.phase === "reveal") {
              mutate((s) => {
                goNight(s);
              });
            }
          }}
        />
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

      {/* 3D Rotating Cards Suspect Selection Modal for Secret Voting */}
      <AnimatePresence>
        {showRotatingVoteModal && g?.phase === "vote" && meAlive && g.votes[meP?.id || ""] === undefined && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl bg-slate-950/95 border border-red-500/30 rounded-3xl p-5 shadow-2xl flex flex-col items-center"
            >
              <div className="w-full flex justify-between items-center mb-2 px-2">
                <span className="text-xs font-mono font-bold text-amber-400">
                  🗳️ BỎ PHIẾU BÍ MẬT (KÍN)
                </span>
                <button
                  type="button"
                  onClick={() => setShowRotatingVoteModal(false)}
                  className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10"
                >
                  Đóng (chọn trên bàn)
                </button>
              </div>

              <RotatingCards
                items={g.players.map((p) => ({
                  id: p.id,
                  name: p.name,
                  avatar: p.avatar,
                  isAlive: p.alive,
                  isSelf: p.id === meP?.id,
                  badge: isWolf(meP?.role || "villager") && isWolf(p.role) ? "🐺 Bầy Sói" : undefined,
                }))}
                selectedId={rotatingVoteSelected}
                onSelect={(id) => setRotatingVoteSelected(id)}
                confirmLabel="Xác nhận bỏ phiếu kín 🔒"
                onConfirm={() => {
                  if (rotatingVoteSelected) {
                    castVote(rotatingVoteSelected);
                  }
                }}
              />

              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => castVote(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-slate-300 transition"
                >
                  Bỏ phiếu trắng (Abstain)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Action FX Visual Overlay (Claw, Poison, Heal, Seer, Shield, Cupid, Execution) */}
      <WerewolfActionFxOverlay currentFx={currentFx} onFinish={() => setCurrentFx(null)} />

      <MatchResultModal
        isOpen={resultOpen}
        onClose={() => setResultOpen(false)}
        onPlayAgain={start}
        resultData={result}
        reason={g?.winner ? (g.winner === "village" ? "Dân làng đã tìm ra tất cả Sói" : "Bầy Sói đã chiếm lấy ngôi làng") : undefined}
      />
    </div>
  );
}

function WitchPanel({ state, onHeal }: { state: WState; onHeal: (heal: boolean) => void }) {
  const victim = byId(state, state.wolfTarget);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-black bg-ink-100 px-4 py-2 text-black">
      <span className="font-bold">🧪 {victim ? `Sói vừa cắn ${victim.name}.` : "Đêm nay Sói không cắn ai."}</span>
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

function Lobby({
  count,
  setCount,
  stake,
  setStake,
  onStart,
  onPreviewRoulette,
}: {
  count: 8 | 10 | 12;
  setCount: (c: 8 | 10 | 12) => void;
  stake: number;
  setStake: (v: number) => void;
  onStart: () => void;
  onPreviewRoulette?: () => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <div className="panel p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-extrabold">10 vai đa dạng — ai là Sói?</h2>
          {onPreviewRoulette && (
            <button
              type="button"
              onClick={onPreviewRoulette}
              className="btn-ghost px-3 py-1.5 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1.5"
            >
              <span>✨</span> Thử Vòng Quay Thẻ
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-300">Đêm Sói cắn, các vai đặc biệt hành động. Ngày cả làng ngồi vòng tròn thảo luận (bật mic hoặc chat) và bỏ phiếu treo cổ. Quản trò tự động dẫn dắt từng bước.</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(Object.keys(ROLE_INFO) as (keyof typeof ROLE_INFO)[]).map((r) => (
            <div key={r} className="rounded-2xl border-2 border-black p-3 text-black shadow-brutal-sm" style={{ background: ROLE_INFO[r].color }}>
              <p className="text-2xl">{ROLE_INFO[r].emoji}</p>
              <p className="mt-1 font-display font-extrabold">{ROLE_INFO[r].name}</p>
              <p className="mt-0.5 text-[11px] font-medium leading-snug opacity-80">{ROLE_INFO[r].desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="panel space-y-5 p-6">
        <h2 className="font-display text-xl font-extrabold">Tạo phòng luyện</h2>
        <div>
          <span className="label">Số người chơi</span>
          <Segmented
            value={count}
            onChange={setCount}
            options={[
              { value: 8 as const, label: "8 · Sói Con & Thợ Săn" },
              { value: 10 as const, label: "10 · Thêm Cupid & Già Làng" },
              { value: 12 as const, label: "12 · Thêm Sói Trắng" },
            ]}
          />
        </div>
        <StakePicker value={stake} onChange={setStake} />
        <ul className="space-y-1.5 text-xs text-ink-300">
          <li>• Bàn tròn lửa trại 3D: quan sát toàn bộ người chơi ngồi xoay vòng.</li>
          <li>• Bật Microphone nói chuyện trực tiếp trong phiên thảo luận.</li>
          <li>• Quản trò tự động cất giọng dẫn dắt và điều khiển các lượt đêm/ngày.</li>
          <li>• Hiệu ứng kỹ năng: móng vuốt cào xé, bình thuốc phù thủy, tên tình yêu...</li>
        </ul>
        <button type="button" onClick={onStart} className="btn-lime w-full py-3">
          <Play className="size-4" /> Vào làng
        </button>
      </div>
    </div>
  );
}

export default WerewolfGame;
