"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, Pause, Play, RotateCcw, Shield, Timer, Trophy, Zap } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/lib/store";
import { soundManager } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { MatchResultModal } from "./match-result-modal";
import { GameHeader, Segmented, StakePicker, useMatchSettlement } from "./shared";

/* --------------------------------- World --------------------------------- */

const W = 960;
const H = 600;
const GROUND = 540;

const DIFFS = {
  easy: { label: "Dễ", target: 800, speed: 0.85, spawn: 1.15 },
  normal: { label: "Thường", target: 1500, speed: 1, spawn: 1 },
  hard: { label: "Khó", target: 2500, speed: 1.2, spawn: 0.8 },
} as const;
type Diff = keyof typeof DIFFS;

type Kind = "bug" | "meeting" | "deadline" | "lua" | "coffee" | "shield" | "bolt" | "boss" | "minion";
interface Ent {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  t: number;
  seed: number;
}
interface Wave {
  x: number;
  y: number;
  vy: number;
  life: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  red?: boolean;
}

const POINTS: Partial<Record<Kind, number>> = { bug: 10, minion: 8, meeting: 25, deadline: 35, lua: 15, boss: 400 };

function freshState(diff: Diff) {
  return {
    diff,
    t: 0,
    px: W / 2,
    pvx: 0,
    targetX: null as number | null,
    keys: { left: false, right: false },
    slashCd: 0,
    slashT: 0,
    slashAngle: 0,
    dashCd: 0,
    dashT: 0,
    invuln: 0,
    lives: 3,
    score: 0,
    combo: 0,
    comboT: 0,
    level: 1,
    levelT: 0,
    spawnT: 0.6,
    shield: 0,
    bolt: 0,
    slow: 0,
    shake: 0,
    ents: [] as Ent[],
    waves: [] as Wave[],
    parts: [] as Particle[],
    bossAlive: false,
    reachedTarget: false,
    kills: 0,
    over: false,
    banner: { text: "", t: 0 },
  };
}
type GameState = ReturnType<typeof freshState>;

// Pixel bug sprite (10×8)
const BUG = ["..x....x..", "...x..x...", "..xxxxxx..", ".xx.xx.xx.", "xxxxxxxxxx", "x.xxxxxx.x", "x.x....x.x", "...xx.xx.."];
const bugPath = (() => {
  if (typeof Path2D === "undefined") return null;
  const p = new Path2D();
  BUG.forEach((row, r) => row.split("").forEach((ch, c) => ch === "x" && p.rect(c - 5, r - 4, 1, 1)));
  return p;
})();

/* --------------------------------- Game ---------------------------------- */

export function ArcadeGame() {
  const me = useAppStore(useShallow((s) => ({ id: s.currentUser.id, username: s.currentUser.username })));
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const { settle, reset: resetSettlement, result, open: resultOpen, setOpen: setResultOpen } = useMatchSettlement("arcade");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GameState>(freshState("normal"));
  const [phase, setPhase] = useState<"setup" | "playing" | "paused" | "over">("setup");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [diff, setDiff] = useState<Diff>("normal");
  const [stake, setStake] = useState(0);
  const [hud, setHud] = useState({ score: 0, combo: 0, mult: 1, lives: 3, level: 1, shield: 0, bolt: 0, slow: 0, boss: 0, dash: 0 });
  const [best, setBest] = useState(0);
  const bestKey = `oa-cyber-best-${me.id}`;
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;

  useEffect(() => {
    try {
      setBest(parseInt(localStorage.getItem(bestKey) || "0", 10) || 0);
    } catch {}
    const st = parseInt(new URLSearchParams(window.location.search).get("stake") || "", 10);
    if (st > 0) setStake(st);
  }, [bestKey]);

  const sfx = useCallback((k: "slash" | "hit" | "coin" | "hurt" | "level" | "boss") => {
    if (!soundRef.current) return;
    ({
      slash: () => soundManager.playCyberSlash(),
      hit: () => soundManager.playCyberHit(),
      coin: () => soundManager.playCoin(),
      hurt: () => soundManager.playDefeat(),
      level: () => soundManager.playVictory(),
      boss: () => soundManager.playCyberBoss(),
    })[k]();
  }, []);

  /* ------------------------------ Canvas size ------------------------------ */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = wrap.getBoundingClientRect();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  /* --------------------------------- Input --------------------------------- */

  const slash = useCallback(() => {
    const s = stateRef.current;
    if (phaseRef.current !== "playing" || s.slashCd > 0) return;
    s.slashCd = 0.3;
    s.slashT = 0.14;
    s.slashAngle = Math.random() * Math.PI;
    s.waves.push({ x: s.px, y: GROUND - 40, vy: -900, life: 0.8 });
    sfx("slash");
  }, [sfx]);

  const dash = useCallback(() => {
    const s = stateRef.current;
    if (phaseRef.current !== "playing" || s.dashCd > 0) return;
    const dir = s.keys.left ? -1 : s.keys.right ? 1 : s.targetX !== null ? Math.sign(s.targetX - s.px) || 1 : 1;
    s.pvx = dir * 1500;
    s.dashT = 0.16;
    s.dashCd = 1.2;
    s.invuln = Math.max(s.invuln, 0.3);
  }, []);

  const togglePause = useCallback(() => {
    setPhase((p) => (p === "playing" ? "paused" : p === "paused" ? "playing" : p));
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.code === "ArrowLeft" || e.code === "KeyA") (s.keys.left = true), (s.targetX = null);
      else if (e.code === "ArrowRight" || e.code === "KeyD") (s.keys.right = true), (s.targetX = null);
      else if (e.code === "Space") {
        e.preventDefault();
        slash();
      } else if (e.code === "ShiftLeft" || e.code === "ShiftRight") dash();
      else if (e.code === "KeyP" || e.code === "Escape") togglePause();
    };
    const up = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.code === "ArrowLeft" || e.code === "KeyA") s.keys.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") s.keys.right = false;
    };
    const vis = () => document.hidden && phaseRef.current === "playing" && setPhase("paused");
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [slash, dash, togglePause]);

  const toWorldX = (clientX: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return null;
    return ((clientX - r.left) / r.width) * W;
  };

  /* ------------------------------- Game over ------------------------------- */

  const endGame = useCallback(() => {
    const s = stateRef.current;
    if (s.over) return;
    s.over = true;
    setPhase("over");
    const won = s.score >= DIFFS[s.diff].target;
    if (s.score > best) {
      setBest(s.score);
      try {
        localStorage.setItem(bestKey, String(s.score));
      } catch {}
    }
    settle(won ? "win" : "loss", { name: `Bầy Bug (${DIFFS[s.diff].label})`, elo: s.diff === "hard" ? 1500 : s.diff === "easy" ? 1100 : 1300 }, stake);
  }, [best, bestKey, settle, stake]);

  const start = () => {
    stateRef.current = freshState(diff);
    resetSettlement();
    setPhase("playing");
    sfx("level");
  };

  /* -------------------------------- Loop -------------------------------- */

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    let last = performance.now();
    let hudT = 0;

    const burst = (x: number, y: number, n: number, red = false) => {
      const s = stateRef.current;
      for (let i = 0; i < n && s.parts.length < 320; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 120 + Math.random() * 320;
        s.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.3, max: 0.8, size: 2 + Math.random() * 3, red });
      }
    };

    const kill = (e: Ent, idx: number) => {
      const s = stateRef.current;
      s.ents.splice(idx, 1);
      const mult = Math.min(5, 1 + Math.floor(s.combo / 5));
      if (e.kind === "coffee") (s.slow = 5), banner("☕ Slow-mo");
      else if (e.kind === "shield") (s.shield = 10), banner("🛡 Khiên");
      else if (e.kind === "bolt") (s.bolt = 6), banner("⚡ Chém rộng");
      else {
        s.score += (POINTS[e.kind] ?? 10) * (e.kind === "lua" ? 1 : mult);
        if (e.kind !== "lua") {
          s.combo++;
          s.comboT = 2.5;
          s.kills++;
        }
      }
      if (e.kind === "boss") {
        s.bossAlive = false;
        s.shake = 18;
        banner("DEADLINE ĐÃ BỊ HẠ!");
      }
      burst(e.x, e.y, e.kind === "boss" ? 60 : 14, e.kind === "deadline");
      sfx(e.kind === "lua" ? "coin" : "hit");
      if (!s.reachedTarget && s.score >= DIFFS[s.diff].target) {
        s.reachedTarget = true;
        banner("🏆 ĐẠT MỤC TIÊU — chơi tiếp để phá kỷ lục!");
      }
    };

    const banner = (text: string) => {
      stateRef.current.banner = { text, t: 2 };
    };

    const hurt = () => {
      const s = stateRef.current;
      if (s.invuln > 0) return;
      if (s.shield > 0) {
        s.shield = 0;
        s.invuln = 0.8;
        banner("Khiên đã đỡ đòn");
        return;
      }
      s.lives--;
      s.combo = 0;
      s.invuln = 1.3;
      s.shake = 14;
      burst(s.px, GROUND - 20, 24, true);
      sfx("hurt");
      if (s.lives <= 0) endGame();
    };

    const spawn = () => {
      const s = stateRef.current;
      const d = DIFFS[s.diff];
      const sp = (90 + s.level * 14) * d.speed;
      const r = Math.random();
      const x = 60 + Math.random() * (W - 120);
      const base: Ent = { kind: "bug", x, y: -30, vx: 0, vy: sp + Math.random() * 60, r: 18, hp: 1, maxHp: 1, t: 0, seed: Math.random() * 10 };
      if (r < 0.46) s.ents.push(base);
      else if (r < 0.66) s.ents.push({ ...base, kind: "meeting", hp: 2, maxHp: 2, r: 20, vy: sp * 0.8 });
      else if (r < 0.8) s.ents.push({ ...base, kind: "deadline", r: 22, vy: sp * 0.55 });
      else if (r < 0.93) s.ents.push({ ...base, kind: "lua", r: 12, vy: sp * 0.9 });
      else s.ents.push({ ...base, kind: (["coffee", "shield", "bolt"] as Kind[])[Math.floor(Math.random() * 3)], r: 16, vy: sp * 0.7 });
    };

    const step = (dtRaw: number) => {
      const s = stateRef.current;
      const timeScale = s.slow > 0 ? 0.5 : 1;
      const dt = dtRaw * timeScale;
      s.t += dtRaw;

      // Player
      const accel = 3200;
      if (s.dashT > 0) s.dashT -= dtRaw;
      else {
        let want = 0;
        if (s.keys.left) want -= 560;
        if (s.keys.right) want += 560;
        if (s.targetX !== null && !s.keys.left && !s.keys.right) want = Math.max(-700, Math.min(700, (s.targetX - s.px) * 9));
        s.pvx += Math.max(-accel * dtRaw, Math.min(accel * dtRaw, want - s.pvx));
      }
      s.px = Math.max(40, Math.min(W - 40, s.px + s.pvx * dtRaw));
      for (const k of ["slashCd", "slashT", "dashCd", "invuln", "shield", "bolt", "slow", "comboT"] as const) s[k] = Math.max(0, s[k] - dtRaw);
      if (s.comboT === 0) s.combo = 0;
      if (s.banner.t > 0) s.banner.t -= dtRaw;
      s.shake *= 0.88;

      // Levels & boss
      s.levelT += dtRaw;
      if (s.levelT > 16 && !s.bossAlive) {
        s.levelT = 0;
        s.level++;
        sfx("level");
        if (s.level % 5 === 0) {
          const hp = 18 + s.level * 3;
          s.ents.push({ kind: "boss", x: W / 2, y: -60, vx: 120, vy: 40, r: 52, hp, maxHp: hp, t: 0, seed: 0 });
          s.bossAlive = true;
          banner("⚠ BOSS DEADLINE");
          sfx("boss");
        } else banner(`Cấp ${s.level}`);
      }
      s.spawnT -= dt;
      if (s.spawnT <= 0) {
        spawn();
        s.spawnT = Math.max(0.22, (0.95 - s.level * 0.055) * DIFFS[s.diff].spawn) * (s.bossAlive ? 1.6 : 1);
      }

      // Waves
      for (let i = s.waves.length - 1; i >= 0; i--) {
        const w = s.waves[i];
        w.y += w.vy * dtRaw;
        w.life -= dtRaw;
        let hit = false;
        for (let j = s.ents.length - 1; j >= 0; j--) {
          const e = s.ents[j];
          if (e.kind === "lua") continue;
          if (Math.abs(e.x - w.x) < e.r + 26 && Math.abs(e.y - w.y) < e.r + 10) {
            e.hp--;
            burst(w.x, w.y, 5);
            if (e.hp <= 0) kill(e, j);
            hit = true;
            break;
          }
        }
        if (hit || w.life <= 0 || w.y < -20) s.waves.splice(i, 1);
      }

      // Entities
      const slashR = s.bolt > 0 ? 150 : 95;
      for (let i = s.ents.length - 1; i >= 0; i--) {
        const e = s.ents[i];
        e.t += dt;
        if (e.kind === "boss") {
          e.y = Math.min(110, e.y + e.vy * dt);
          e.x += e.vx * dt;
          if (e.x < 90 || e.x > W - 90) e.vx *= -1;
          if (Math.floor(e.t / 1.1) !== Math.floor((e.t - dt) / 1.1)) {
            for (const dx of [-30, 30]) s.ents.push({ kind: "minion", x: e.x + dx, y: e.y + 40, vx: dx * 2, vy: 200 + s.level * 8, r: 14, hp: 1, maxHp: 1, t: 0, seed: Math.random() });
          }
          continue;
        }
        if (e.kind === "meeting") e.x += Math.sin(e.t * 3 + e.seed) * 140 * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        const dx = e.x - s.px;
        const dy = e.y - (GROUND - 24);
        const dist = Math.hypot(dx, dy);
        if (s.slashT > 0 && dist < slashR) {
          e.hp -= e.kind === "meeting" ? 2 : 1;
          if (e.hp <= 0) {
            kill(e, i);
            continue;
          }
        }
        if (dist < e.r + 22) {
          if (e.kind === "lua" || e.kind === "coffee" || e.kind === "shield" || e.kind === "bolt") kill(e, i);
          else {
            s.ents.splice(i, 1);
            hurt();
          }
          continue;
        }
        if (e.y > GROUND + 10) {
          s.ents.splice(i, 1);
          if (e.kind === "deadline") {
            burst(e.x, GROUND, 30, true);
            hurt();
          } else if (e.kind === "bug" || e.kind === "meeting" || e.kind === "minion") s.combo = 0;
        }
      }

      // Particles
      for (let i = s.parts.length - 1; i >= 0; i--) {
        const p = s.parts[i];
        p.x += p.vx * dtRaw;
        p.y += p.vy * dtRaw;
        p.vy += 400 * dtRaw;
        p.life -= dtRaw;
        if (p.life <= 0) s.parts.splice(i, 1);
      }
    };

    const draw = () => {
      const s = stateRef.current;
      const scale = canvas.width / W;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.save();
      if (s.shake > 0.5) ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
      // Background
      ctx.fillStyle = "#0b0b0e";
      ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 48) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, GROUND);
      }
      for (let y = 0; y <= GROUND; y += 48) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();
      // Perspective floor
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      for (let i = -10; i <= 10; i++) {
        ctx.moveTo(W / 2 + i * 30, GROUND);
        ctx.lineTo(W / 2 + i * 140, H);
      }
      ctx.moveTo(0, GROUND);
      ctx.lineTo(W, GROUND);
      ctx.stroke();
      if (s.slow > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fillRect(0, 0, W, H);
      }

      // Entities
      for (const e of s.ents) {
        ctx.save();
        ctx.translate(e.x, e.y);
        switch (e.kind) {
          case "bug":
          case "minion": {
            const k = e.kind === "minion" ? 2.4 : 3.4;
            ctx.scale(k, k);
            ctx.fillStyle = "#fafafa";
            if (bugPath) ctx.fill(bugPath);
            break;
          }
          case "meeting":
            ctx.fillStyle = "#fafafa";
            ctx.fillRect(-18, -16, 36, 32);
            ctx.fillStyle = "#0b0b0e";
            ctx.fillRect(-14, -6, 28, 18);
            ctx.fillStyle = "#fafafa";
            for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) ctx.fillRect(-12 + c * 7, -3 + r * 8, 4, 4);
            ctx.fillRect(-10, -21, 4, 8);
            ctx.fillRect(6, -21, 4, 8);
            if (e.hp < e.maxHp) {
              ctx.strokeStyle = "#ef4444";
              ctx.lineWidth = 2;
              ctx.strokeRect(-20, -18, 40, 36);
            }
            break;
          case "deadline": {
            const urgency = Math.min(1, e.y / GROUND);
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, e.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - urgency));
            ctx.stroke();
            ctx.fillStyle = "#fafafa";
            ctx.beginPath();
            ctx.arc(0, 0, e.r - 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#0b0b0e";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -9);
            ctx.moveTo(0, 0);
            ctx.lineTo(7, 4);
            ctx.stroke();
            break;
          }
          case "lua":
            ctx.rotate(e.t * 2);
            ctx.fillStyle = "#d4d4d8";
            ctx.beginPath();
            ctx.moveTo(0, -12);
            ctx.lineTo(8, 0);
            ctx.lineTo(0, 12);
            ctx.lineTo(-8, 0);
            ctx.closePath();
            ctx.fill();
            break;
          case "coffee":
          case "shield":
          case "bolt":
            ctx.strokeStyle = "#fafafa";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 18 + Math.sin(e.t * 6) * 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = "#fafafa";
            if (e.kind === "coffee") {
              ctx.fillRect(-8, -6, 14, 14);
              ctx.strokeRect(5, -3, 6, 7);
            } else if (e.kind === "shield") {
              ctx.beginPath();
              ctx.moveTo(0, -10);
              ctx.lineTo(9, -6);
              ctx.lineTo(7, 6);
              ctx.lineTo(0, 11);
              ctx.lineTo(-7, 6);
              ctx.lineTo(-9, -6);
              ctx.closePath();
              ctx.fill();
            } else {
              ctx.beginPath();
              ctx.moveTo(3, -12);
              ctx.lineTo(-6, 2);
              ctx.lineTo(0, 2);
              ctx.lineTo(-3, 12);
              ctx.lineTo(7, -3);
              ctx.lineTo(1, -3);
              ctx.closePath();
              ctx.fill();
            }
            break;
          case "boss":
            ctx.fillStyle = "#fafafa";
            ctx.fillRect(-70, -44, 140, 88);
            ctx.fillStyle = "#0b0b0e";
            ctx.font = "900 22px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("DEADLINE", 0, -10);
            ctx.fillStyle = "#ef4444";
            ctx.fillText(`${Math.max(0, Math.ceil(3 - (e.t % 3)))}h`, 0, 18);
            ctx.fillStyle = "rgba(255,255,255,0.15)";
            ctx.fillRect(-70, 52, 140, 6);
            ctx.fillStyle = "#ef4444";
            ctx.fillRect(-70, 52, 140 * (e.hp / e.maxHp), 6);
            break;
        }
        ctx.restore();
      }

      // Waves
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 3;
      for (const w of s.waves) {
        ctx.beginPath();
        ctx.arc(w.x, w.y + 18, 26, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }

      // Player
      const blink = s.invuln > 0 && Math.floor(s.t * 20) % 2 === 0;
      if (!blink) {
        ctx.save();
        ctx.translate(s.px, GROUND - 24);
        if (s.shield > 0) {
          ctx.strokeStyle = "rgba(255,255,255,0.7)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, -4, 40, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (s.dashT > 0) {
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.fillRect(-60 * Math.sign(s.pvx) - 16, -24, 32, 48);
        }
        ctx.fillStyle = "#fafafa";
        ctx.beginPath();
        ctx.roundRect(-16, -2, 32, 28, 8);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -16, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0b0b0e";
        ctx.fillRect(-11, -20, 22, 7);
        ctx.fillStyle = "#fafafa";
        ctx.fillRect(-7, -18, 4, 3);
        ctx.fillRect(3, -18, 4, 3);
        ctx.restore();
      }
      if (s.slashT > 0) {
        const r = s.bolt > 0 ? 150 : 95;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = s.bolt > 0 ? 7 : 5;
        ctx.globalAlpha = Math.min(1, s.slashT / 0.08);
        ctx.beginPath();
        ctx.arc(s.px, GROUND - 24, r, s.slashAngle + Math.PI, s.slashAngle + Math.PI * 1.9);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Particles
      for (const p of s.parts) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.red ? "#ef4444" : "#fafafa";
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      // Banner
      if (s.banner.t > 0) {
        ctx.globalAlpha = Math.min(1, s.banner.t);
        ctx.fillStyle = "#fafafa";
        ctx.font = "800 30px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(s.banner.text, W / 2, H * 0.38);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (phaseRef.current === "playing" && !stateRef.current.over) step(dt);
      draw();
      hudT += dt;
      if (hudT > 0.1) {
        hudT = 0;
        const s = stateRef.current;
        const boss = s.ents.find((e) => e.kind === "boss");
        setHud({
          score: s.score,
          combo: s.combo,
          mult: Math.min(5, 1 + Math.floor(s.combo / 5)),
          lives: s.lives,
          level: s.level,
          shield: s.shield,
          bolt: s.bolt,
          slow: s.slow,
          boss: boss ? boss.hp / boss.maxHp : 0,
          dash: s.dashCd,
        });
      }
      if (!stateRef.current.over && phaseRef.current === "playing") raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, endGame, sfx]);

  const target = DIFFS[phase === "setup" ? diff : stateRef.current.diff].target;

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
      <GameHeader game="arcade" subtitle={`Mục tiêu ${target} điểm · Kỷ lục ${best}`}>
        {phase === "playing" || phase === "paused" ? (
          <button type="button" onClick={togglePause} className="grid size-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white hover:text-black" aria-label="Tạm dừng" title="Tạm dừng (P)">
            {phase === "paused" ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
        ) : null}
      </GameHeader>

      <div className="mx-auto w-full max-w-[min(100%,calc((100dvh-8.5rem)*1.6))]">
        <div
          ref={wrapRef}
          className="relative aspect-[16/10] w-full touch-none select-none overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0e]"
          onPointerMove={(e) => {
            const x = toWorldX(e.clientX);
            if (x !== null) stateRef.current.targetX = x;
          }}
          onPointerDown={(e) => {
            const x = toWorldX(e.clientX);
            if (x !== null) stateRef.current.targetX = x;
            slash();
          }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          {/* HUD */}
          {phase !== "setup" && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4">
              <div className="flex items-center gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Heart key={i} className={cn("size-5", i < hud.lives ? "fill-white text-white" : "text-white/20")} />
                ))}
                {hud.shield > 0 && <Shield className="ml-2 size-5 text-white" />}
                {hud.bolt > 0 && <Zap className="size-5 text-white" />}
                {hud.slow > 0 && <Timer className="size-5 text-white" />}
              </div>
              <div className="text-center">
                <p className="font-display text-3xl font-extrabold tabular leading-none">{hud.score}</p>
                <div className="mx-auto mt-1 h-1 w-32 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full bg-white" style={{ width: `${Math.min(100, (hud.score / target) * 100)}%` }} />
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs text-ink-300">Cấp {hud.level}</p>
                {hud.mult > 1 && <p className="font-display text-xl font-extrabold">x{hud.mult}</p>}
                {hud.combo > 0 && <p className="text-[11px] text-ink-400">{hud.combo} combo</p>}
              </div>
            </div>
          )}
          {hud.boss > 0 && phase === "playing" && (
            <div className="pointer-events-none absolute inset-x-0 top-16 mx-auto h-1.5 w-1/2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-pop-red" style={{ width: `${hud.boss * 100}%` }} />
            </div>
          )}

          {/* Overlays */}
          {phase === "setup" && (
            <div className="absolute inset-0 grid place-items-center bg-black/60 p-4">
              <div className="panel w-full max-w-sm space-y-4 p-5">
                <div>
                  <span className="label">Độ khó</span>
                  <Segmented value={diff} onChange={setDiff} options={(Object.keys(DIFFS) as Diff[]).map((k) => ({ value: k, label: `${DIFFS[k].label} · ${DIFFS[k].target}` }))} />
                </div>
                <StakePicker value={stake} onChange={setStake} />
                <div className="flex flex-wrap gap-1.5">
                  <span className="kbd">Chuột / chạm</span>
                  <span className="kbd">A D ← →</span>
                  <span className="kbd">Space chém</span>
                  <span className="kbd">Shift lướt</span>
                  <span className="kbd">P dừng</span>
                </div>
                <button type="button" className="btn-lime w-full py-3" onClick={start}>
                  <Play className="size-4" /> Bắt đầu
                </button>
                {best > 0 && (
                  <p className="flex items-center justify-center gap-1.5 text-xs text-ink-300">
                    <Trophy className="size-3.5" /> Kỷ lục của bạn: {best}
                  </p>
                )}
              </div>
            </div>
          )}
          {phase === "paused" && (
            <div className="absolute inset-0 grid place-items-center bg-black/60">
              <div className="flex flex-col items-center gap-3">
                <p className="font-display text-3xl font-extrabold">Tạm dừng</p>
                <div className="flex gap-2">
                  <button type="button" className="btn-lime" onClick={() => setPhase("playing")}>
                    <Play className="size-4" /> Tiếp tục
                  </button>
                  <button type="button" className="btn-ghost" onClick={endGame}>
                    Kết thúc
                  </button>
                </div>
              </div>
            </div>
          )}
          {phase === "over" && (
            <div className="absolute inset-0 grid place-items-center bg-black/70">
              <div className="text-center">
                <p className="text-sm text-ink-300">{stateRef.current.reachedTarget ? "Đạt mục tiêu 🏆" : "Hết mạng"}</p>
                <p className="font-display text-6xl font-extrabold tabular">{stateRef.current.score}</p>
                <p className="mt-1 text-sm text-ink-300">
                  Cấp {stateRef.current.level} · {stateRef.current.kills} bug · kỷ lục {best}
                </p>
                <button type="button" className="btn-lime mt-4" onClick={() => setPhase("setup")}>
                  <RotateCcw className="size-4" /> Chơi lại
                </button>
              </div>
            </div>
          )}
        </div>
        {phase === "playing" && (
          <div className="mt-3 flex justify-center gap-2 sm:hidden">
            <button type="button" className="btn-ghost flex-1" onPointerDown={dash}>
              Lướt
            </button>
            <button type="button" className="btn-lime flex-1" onPointerDown={slash}>
              Chém
            </button>
          </div>
        )}
      </div>

      <MatchResultModal isOpen={resultOpen} onClose={() => setResultOpen(false)} onPlayAgain={() => setPhase("setup")} resultData={result} reason={stateRef.current.reachedTarget ? `${stateRef.current.score} điểm — vượt mục tiêu!` : `${stateRef.current.score}/${target} điểm`} />
    </div>
  );
}

export default ArcadeGame;
