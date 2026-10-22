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
} from "@/lib/games/werewolf-engine";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { MatchResultModal } from "./match-result-modal";
import { GameHeader, Segmented, StakePicker, useGameSession, useMatchSettlement } from "./shared";

const DISCUSS_MS = 60_000;
const VOTE_MS = 30_000;
const STEP_LABEL: Record<string, string> = {
  guard: "🛡️ Bảo Vệ thức dậy, chọn người để che chở…",
  wolves: "🐺 Bầy Sói thức dậy, chọn con mồi…",
  seer: "🔮 Tiên Tri thức dậy, soi một người…",
  witch: "🧪 Phù Thủy thức dậy, cân nhắc hai bình thuốc…",
};

type Pick = null | { kind: "guard" | "wolf" | "seer" | "poison" | "vote" | "hunter" };

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
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

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
      s.step = "guard";
      s.votes = {};
      addLog(s, "narrator", `🌙 Đêm ${s.day} buông xuống. Cả làng nhắm mắt…`);
      botNightActions(s);
    },
    []
  );

  const advanceStep = useCallback(() => {
    mutate((s) => {
      const order = ["guard", "wolves", "seer", "witch", "done"] as const;
      const i = order.indexOf(s.step as (typeof order)[number]);
      s.step = order[Math.min(order.length - 1, i + 1)];
      if (s.step === "witch") botWitch(s);
    });
  }, [mutate]);

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
              addLog(s, "death", `☠️ ${p.name} đã chết${p.cause === "poison" ? " (trúng độc)" : ""}. Vai: ${ROLE_INFO[p.role].emoji} ${ROLE_INFO[p.role].name}.`);
            }
          } else addLog(s, "narrator", "☀️ Trời sáng. Một đêm bình yên — không ai chết!");
        });
        if (soundEnabled) soundManager.playTurn();
      }, 700 * pace);
      return;
    }
    const roleFor = { guard: "guard", wolves: "wolf", seer: "seer", witch: "witch" }[g.step];
    const actorAlive = g.players.some((p) => p.alive && p.role === roleFor);
    const humanActs = h.alive && h.role === roleFor;
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
        if (soundEnabled) soundManager.playCapture();
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
    lines.forEach((l, i) => later(() => mutate((s) => addLog(s, "chat", l.text, l.speaker)), 900 + i * spread + Math.random() * 600));
    later(() => {
      mutate((s) => {
        for (const l of botDiscussion(s).slice(0, 3)) addLog(s, "chat", l.text, l.speaker);
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
  }, [g?.phase, g?.day]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Reveal bot votes one by one.
      const entries = Object.entries(bot);
      entries.forEach(([voter, target], i) =>
        later(() => {
          mutate((s) => {
            s.votes[voter] = target;
            addLog(s, "vote", `${byId(s, voter)!.name} → ${target ? byId(s, target)!.name : "bỏ phiếu trắng"}`);
          });
          if (soundEnabled) soundManager.playMove();
        }, 350 + i * 260)
      );
      later(() => {
        mutate((s) => {
          const { executed, count } = tallyVotes(s.votes);
          if (!executed) {
            const top = Math.max(0, ...count.values());
            addLog(s, "narrator", top ? "⚖️ Hoà phiếu — không ai bị treo hôm nay." : "⚖️ Không ai nhận phiếu — không ai bị treo.");
          } else {
            const p = byId(s, executed)!;
            addLog(s, "death", `🪢 ${p.name} bị treo cổ với ${count.get(executed)} phiếu. Vai thật: ${ROLE_INFO[p.role].emoji} ${ROLE_INFO[p.role].name}.`);
            kill(s, executed, "vote");
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
        if (soundEnabled) soundManager.playCheck();
      }, 600 + entries.length * 260);
    },
    [clearTimers, mutate, later, endIfWinner, goNight, soundEnabled]
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
    if (g.step === "guard" && meP.role === "guard") return { kind: "guard" };
    if (g.step === "wolves" && meP.role === "wolf") return { kind: "wolf" };
    if (g.step === "seer" && meP.role === "seer" && !seerReveal) return { kind: "seer" };
    if (g.step === "witch" && meP.role === "witch" && witchChoice === "poison") return { kind: "poison" };
    return null;
  }, [g, meP, seerReveal, witchChoice]);

  const canTarget = (p: WPlayer) => {
    if (!pick || !g || !meP || !p.alive) return false;
    switch (pick.kind) {
      case "guard":
        return p.id !== g.lastGuarded;
      case "wolf":
        return p.role !== "wolf";
      case "seer":
      case "poison":
      case "vote":
      case "hunter":
        return p.id !== meP.id;
    }
  };

  const onTarget = (p: WPlayer) => {
    if (!g || !pick || !canTarget(p)) return;
    if (soundEnabled) soundManager.playMove();
    switch (pick.kind) {
      case "guard":
        mutate((s) => {
          s.guard = p.id;
        });
        advanceStep();
        break;
      case "wolf":
        mutate((s) => {
          s.wolfTarget = p.id;
        });
        advanceStep();
        break;
      case "seer":
        mutate((s) => {
          s.seerCheck = p.id;
          s.seerResults[human(s).id] = { ...(s.seerResults[human(s).id] || {}), [p.id]: p.role === "wolf" };
        });
        setSeerReveal({ name: p.name, wolf: p.role === "wolf" });
        break;
      case "poison":
        mutate((s) => {
          s.poisonTarget = p.id;
          s.poisonUsed = true;
        });
        setWitchChoice(null);
        advanceStep();
        break;
      case "vote":
        mutate((s) => {
          s.votes[human(s).id] = p.id;
          addLog(s, "vote", `${human(s).name} (bạn) → ${p.name}`);
        });
        finalizeVote(p.id);
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
    replies.forEach((r, i) => later(() => mutate((s) => addLog(s, "chat", r.text, r.speaker)), 1200 + i * 1100));
  };

  const start = () => {
    clearTimers();
    resetSettlement();
    setWitchChoice(null);
    setSeerReveal(null);
    setG(createGame(count, { id: me.id, name: me.username, avatar: me.avatar }));
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
          <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={() => setShowRole(true)}>
            <Eye className="size-4" /> Vai của tôi
          </button>
        )}
      </GameHeader>

      {!g ? (
        <Lobby count={count} setCount={setCount} stake={stake} setStake={setStake} onStart={start} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
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

            {/* Players */}
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
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-black text-black" style={{ background: ROLE_INFO[role].color }}>
                          {ROLE_INFO[role].emoji} {ROLE_INFO[role].name}
                        </span>
                      )}
                      {p.claim === "seer" && p.alive && !role && <span className="rounded-full border border-pop-violet/40 px-2 py-0.5 text-[10px] font-bold text-pop-violet">Nhận Tiên Tri</span>}
                      {g.phase === "night" && g.step === "wolves" && meP?.role === "wolf" && meAlive && g.wolfTarget === p.id && <span className="text-[10px] font-bold text-pop-red">Mồi</span>}
                      {g.lastGuarded === p.id && meP?.role === "guard" && <span className="text-[10px] text-pop-cyan">Đêm trước</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Log + chat */}
          <div className="panel flex h-[min(78vh,760px)] flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <p className="font-display text-sm font-bold">Nhật ký làng</p>
              <span className="chip">
                <Users className="size-3" /> {alive(g).length} sống
              </span>
            </div>
            <div ref={logRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
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
                <input
                  value={chat}
                  onChange={(e) => setChat(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  disabled={g.phase !== "discussion" || !meAlive}
                  maxLength={200}
                  placeholder={g.phase === "discussion" && meAlive ? "VD: Tuấn Dev nghi là sói…" : "Chỉ chat được lúc thảo luận ban ngày"}
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

      {/* Role card */}
      <AnimatePresence>
        {showRole && meP && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4" onClick={() => setShowRole(false)}>
            <motion.div
              initial={{ rotateY: 180, scale: 0.8 }}
              animate={{ rotateY: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 160, damping: 18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs overflow-hidden rounded-[32px] border-[3px] border-black shadow-brutal"
              style={{ background: ROLE_INFO[meP.role].color }}
            >
              <div className="p-6 text-center text-black">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em]">Vai bí mật của bạn</p>
                <div className="mx-auto my-5 grid size-28 place-items-center rounded-full border-[3px] border-black bg-white text-6xl">{ROLE_INFO[meP.role].emoji}</div>
                <h3 className="font-display text-4xl font-extrabold">{ROLE_INFO[meP.role].name}</h3>
                <p className="mt-1 text-sm font-bold">Phe {teamOf(meP.role) === "wolves" ? "Sói 🐺" : "Dân làng 🏡"}</p>
              </div>
              <div className="bg-black p-5 text-sm text-ink-100">
                <p>{ROLE_INFO[meP.role].desc}</p>
                <p className="mt-2 text-xs text-ink-300">💡 {ROLE_INFO[meP.role].tip}</p>
                {meP.role === "wolf" && g && (
                  <p className="mt-2 text-xs text-pop-red">
                    Đồng bọn:{" "}
                    {g.players
                      .filter((p) => p.role === "wolf" && !p.isHuman)
                      .map((p) => p.name)
                      .join(", ")}
                  </p>
                )}
                <button type="button" className="btn-lime mt-4 w-full" onClick={() => setShowRole(false)}>
                  Đã hiểu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
}: {
  count: 8 | 10 | 12;
  setCount: (c: 8 | 10 | 12) => void;
  stake: number;
  setStake: (v: number) => void;
  onStart: () => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <div className="panel p-6">
        <h2 className="font-display text-2xl font-extrabold">6 vai — ai là Sói?</h2>
        <p className="mt-1 text-sm text-ink-300">Đêm Sói cắn, các vai đặc biệt hành động. Ngày cả làng tranh luận và bỏ phiếu treo cổ. Bot biết nói dối, nhận vai giả và đổ vote theo phe.</p>
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
              { value: 8 as const, label: "8 · 2 Sói" },
              { value: 10 as const, label: "10 · 3 Sói" },
              { value: 12 as const, label: "12 · 3 Sói" },
            ]}
          />
        </div>
        <StakePicker value={stake} onChange={setStake} />
        <ul className="space-y-1.5 text-xs text-ink-300">
          <li>• Hoà phiếu = không ai bị treo.</li>
          <li>• Bảo Vệ không che 1 người 2 đêm liền. Phù Thủy mỗi bình dùng 1 lần.</li>
          <li>• Thợ Săn chết (trừ trúng độc) được bắn 1 người.</li>
          <li>• Sói thắng khi số Sói ≥ số người còn lại.</li>
        </ul>
        <button type="button" onClick={onStart} className="btn-lime w-full py-3">
          <Play className="size-4" /> Vào làng
        </button>
      </div>
    </div>
  );
}

export default WerewolfGame;
