"use client";

import { memo, useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, RotateCcw } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/lib/store";
import { soundManager } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ChibiAvatar } from "@/components/character/chibi-avatar";
import {
  CardFrame,
  FUSIONS,
  FusionDef,
  HAND_HOLD,
  ITEMS,
  ItemType,
  LEFT_KEYS,
  RIGHT_KEYS,
} from "@/lib/games/typing-battle-data";
import {
  Banner,
  Fighter,
  Game,
  Hooks,
  Item,
  H,
  Mode,
  SLOTS,
  W,
  createGame,
  keyOf,
  onFire,
  onKey,
  update,
} from "@/lib/games/typing-battle-engine";
import { MatchResultModal } from "./match-result-modal";
import { GameHeader, Segmented, StakePicker, useMatchSettlement } from "./shared";

const P_COL = ["#3ad0ff", "#ff4f88"] as const;
const BOTS = [
  { name: "Linh HR", seed: "linh hr:1" },
  { name: "Tuấn Dev", seed: "tuan dev:2" },
  { name: "Sếp Tổng", seed: "sep tong:3" },
];
const FS = 1.5; // độ phân giải canvas so với toạ độ logic

/* --------------------------------- Canvas --------------------------------- */

function makeBackdrop() {
  const c = document.createElement("canvas");
  c.width = W * FS; c.height = H * FS;
  const x = c.getContext("2d")!;
  x.scale(FS, FS);
  let g: CanvasGradient = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#03041a"); g.addColorStop(0.6, "#0a0d33"); g.addColorStop(1, "#150f3a");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const blob = (bx: number, by: number, r: number, col: string) => {
    const q = x.createRadialGradient(bx, by, 0, bx, by, r);
    q.addColorStop(0, col); q.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = q; x.fillRect(0, 0, W, H);
  };
  blob(300, 200, 420, "rgba(90,60,200,.28)"); blob(820, 380, 460, "rgba(200,60,160,.2)"); blob(560, 520, 380, "rgba(40,120,220,.18)");
  const px = 560, py = 790, pr = 330;
  g = x.createRadialGradient(px - 90, py - 120, 40, px, py, pr);
  g.addColorStop(0, "#5a4fd0"); g.addColorStop(0.5, "#2a2a80"); g.addColorStop(1, "#0a0b2c");
  x.fillStyle = g; x.beginPath(); x.arc(px, py, pr, 0, 6.283); x.fill();
  x.strokeStyle = "rgba(150,170,255,.55)"; x.lineWidth = 3; x.shadowColor = "#7a8cff"; x.shadowBlur = 40;
  x.beginPath(); x.arc(px, py, pr, Math.PI * 1.12, Math.PI * 1.88); x.stroke();
  x.shadowBlur = 0;
  x.strokeStyle = "rgba(120,140,255,.07)"; x.lineWidth = 1;
  for (let i = -10; i <= 10; i++) { x.beginPath(); x.moveTo(W / 2 + i * 40, 440); x.lineTo(W / 2 + i * 160, H); x.stroke(); }
  for (let i = 0; i < 8; i++) { const y = 440 + Math.pow(i / 7, 2) * 180; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
  return c;
}

interface Star { x: number; y: number; s: number; v: number; ph: number }
const makeStars = (): Star[][] =>
  [0, 1, 2].map((l) => Array.from({ length: 50 - l * 10 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 0.6 + l * 0.7, v: 6 + l * 16, ph: Math.random() * 6 })));

function drawFx(ctx: CanvasRenderingContext2D, bg: HTMLCanvasElement, stars: Star[][], g: Game | null, clock: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bg, 0, 0);
  ctx.setTransform(FS, 0, 0, FS, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [x, col] of [[0, P_COL[0]], [W, P_COL[1]]] as const) {
    const gr = ctx.createRadialGradient(x, 300, 0, x, 300, 520);
    gr.addColorStop(0, col + "30"); gr.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
  for (const L of stars) for (const s of L) {
    ctx.fillStyle = `rgba(210,222,255,${0.35 + 0.4 * Math.abs(Math.sin(clock * 1.5 + s.ph))})`;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  if (!g) return;
  ctx.save();
  if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 18 * g.shake, (Math.random() - 0.5) * 18 * g.shake);
  for (const r of g.rings) {
    const k = r.t / r.life;
    ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.col; ctx.lineWidth = 4 * (1 - k) + 1;
    ctx.shadowColor = r.col; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r + (r.max - r.r) * Math.sqrt(k), 0, 6.283); ctx.stroke();
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  for (const m of g.missiles) {
    ctx.save(); ctx.translate(m.x, m.yy); if (m.dir < 0) ctx.scale(-1, 1);
    const c = m.reflected ? "#d8a0ff" : m.big ? "#fff07a" : "#ffc860", k = m.big ? 1.5 : 1;
    ctx.scale(k, k);
    ctx.globalCompositeOperation = "lighter";
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 38);
    gr.addColorStop(0, c + "aa"); gr.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 38, 0, 6.283); ctx.fill();
    const tr = ctx.createLinearGradient(-14, 0, -90, 0);
    tr.addColorStop(0, c); tr.addColorStop(1, "rgba(255,100,30,0)");
    ctx.fillStyle = tr; ctx.beginPath(); ctx.moveTo(-14, -4); ctx.lineTo(-90, 0); ctx.lineTo(-14, 4); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#e8ecff"; ctx.beginPath(); ctx.moveTo(24, 0); ctx.quadraticCurveTo(10, -7, -12, -6); ctx.lineTo(-12, 6); ctx.quadraticCurveTo(10, 7, 24, 0); ctx.fill();
    ctx.fillStyle = "#ff4a4a"; ctx.beginPath(); ctx.moveTo(24, 0); ctx.quadraticCurveTo(18, -4, 12, -5); ctx.lineTo(12, 5); ctx.quadraticCurveTo(18, 4, 24, 0); ctx.fill();
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(-18, -12); ctx.lineTo(-14, 0); ctx.lineTo(-18, 12); ctx.lineTo(-8, 6); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const q of g.parts) {
    ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.col;
    const s = q.sz * (0.5 + q.life / q.max / 2);
    ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  for (const t of g.texts) {
    const k = t.t / 1.3, pop = t.big ? 1 + Math.max(0, 0.5 - t.t * 3) : 1, size = t.big ? 28 : 20;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k * k); ctx.translate(t.x, t.y); ctx.scale(pop, pop);
    ctx.font = `900 ${size}px ui-sans-serif, system-ui, sans-serif`; ctx.textAlign = "center";
    ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.strokeText(t.txt, 0, 0);
    ctx.fillStyle = t.col; ctx.shadowColor = t.col; ctx.shadowBlur = 14; ctx.fillText(t.txt, 0, 0);
    ctx.restore();
  }
  ctx.restore();
  if (g.flashA > 0) { ctx.globalAlpha = g.flashA; ctx.fillStyle = g.flashC; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,10,.55)");
  ctx.fillStyle = v; ctx.fillRect(-20, -20, W + 40, H + 40);
}

/* ----------------------------- Thẻ kiểu Yu-Gi-Oh ----------------------------- */

const FRAME_BG: Record<CardFrame, string> = {
  monster: "linear-gradient(160deg,#f0cf7a,#b07a22 60%,#7a4e12)",
  spell: "linear-gradient(160deg,#35c4a6,#0f6b60 60%,#073a38)",
  trap: "linear-gradient(160deg,#c45acb,#6a2278 60%,#3a1048)",
  fusion: "linear-gradient(160deg,#8f66ff,#3a2a9a 55%,#1a1050)",
};

/** Đếm số chữ (bỏ khoảng trắng) đã gõ đúng để tô màu đoạn text trên thẻ. */
function Typed({ text, n, col }: { text: string; n: number; col: string }) {
  let seen = 0;
  return (
    <span className="font-mono tracking-tight">
      {Array.from(text).map((ch, i) => {
        if (ch === " ") return <span key={i}>&nbsp;</span>;
        const done = seen < n;
        seen++;
        return (
          <span key={i} style={done ? { color: "#58ffa6", textShadow: "0 0 8px #58ffa6" } : { color: col }}>
            {ch}
          </span>
        );
      })}
    </span>
  );
}

interface CardProps {
  frame: CardFrame;
  name: string;
  icon: string;
  stars: number;
  type: string;
  desc: string;
  accent: string;
  lines?: { text: string; n: number; col: string; locked: boolean }[];
}

/** Một lá bài 112×168: tên, nguyên tố, ảnh minh hoạ, sao, loại, ô text hiệu ứng. */
const YgoCard = memo(function YgoCard({ frame, name, icon, stars, type, desc, accent, lines }: CardProps) {
  return (
    <div
      className="tb-holo relative h-[168px] w-[112px] select-none overflow-hidden rounded-[10px] p-[5px] text-[#16110a]"
      style={{ background: FRAME_BG[frame], boxShadow: `0 0 0 2px #1a1208, 0 0 22px ${accent}88, 0 12px 24px -8px #000` }}
    >
      <div className="flex h-full flex-col rounded-[6px] bg-gradient-to-b from-[#f4e6bd] to-[#d8c28a] p-[3px]">
        <div className="flex items-center justify-between rounded-[3px] bg-white/70 px-1 py-[1px]">
          <span className="truncate text-[9.5px] font-black uppercase leading-tight tracking-tight">{name}</span>
          <span className="ml-1 size-2.5 shrink-0 rounded-full" style={{ background: accent, boxShadow: `0 0 6px ${accent}` }} />
        </div>
        <div className="mt-[1px] flex justify-end gap-[1px] text-[8px] leading-none text-[#c8102e]">
          {Array.from({ length: stars }).map((_, i) => (
            <span key={i}>★</span>
          ))}
        </div>
        <div className="relative mt-[1px] grid h-[56px] place-items-center overflow-hidden rounded-[3px] border border-[#7a5a1a]" style={{ background: `radial-gradient(circle at 50% 55%, ${accent}aa, #0a0c28 70%)` }}>
          <span className="tb-art text-[34px] drop-shadow-[0_0_10px_rgba(255,255,255,.7)]">{icon}</span>
          <span className="tb-shine pointer-events-none absolute inset-0" />
        </div>
        <p className="mt-[1px] text-right text-[7.5px] font-bold italic leading-none text-[#4a3510]">[{type}]</p>
        <div className="mt-[1px] flex flex-1 flex-col justify-center gap-[2px] rounded-[3px] bg-[#0b0f2c] px-[3px] py-[2px] text-[11px] leading-none">
          {lines ? (
            lines.map((l, i) => (
              <div key={i} className={cn("flex items-center gap-1 whitespace-nowrap rounded-sm px-[2px] py-[1px]", l.locked && "bg-white/10 ring-1 ring-white/40")}>
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: P_COL[i] }} />
                <Typed text={l.text} n={l.n} col={P_COL[i]} />
              </div>
            ))
          ) : (
            <p className="text-[8px] font-medium leading-tight text-[#dfe6ff]">{desc}</p>
          )}
        </div>
      </div>
    </div>
  );
});

function itemCard(type: ItemType, lines?: CardProps["lines"]) {
  const d = ITEMS[type];
  return <YgoCard frame={d.frame} name={d.name} icon={d.icon} stars={d.stars} type={d.type} desc={d.desc} accent={d.col} lines={lines} />;
}
function fusionCard(fu: FusionDef) {
  return <YgoCard frame="fusion" name={fu.name} icon={fu.icon} stars={5} type="Hợp thể / Kỹ năng đặc biệt" desc={fu.desc} accent={fu.col} />;
}

function CardSlot({ it, g }: { it: Item; g: Game }) {
  const s = SLOTS[it.slot];
  const [a, b] = g.fighters;
  const taken = it.state === "taken", expired = it.state === "expired";
  const target = taken ? g.fighters[it.by as 0 | 1] : null;
  const left = Math.max(0, it.life - it.age);
  const lines = ([a, b] as Fighter[]).map((f, i) => ({
    text: it.disp[i],
    n: f.lock === it ? f.buf.length : 0,
    col: P_COL[i] as string,
    locked: f.lock === it,
  }));
  return (
    <motion.div
      className="absolute"
      style={{ left: s.x - 56, top: s.y - 84, perspective: 700, zIndex: taken ? 30 : 10 }}
      initial={{ scale: 0.2, rotateY: 180, y: -90, opacity: 0 }}
      animate={
        taken && target
          ? { x: target.x - s.x, y: target.y - s.y, scale: 0.2, rotate: target.id ? 40 : -40, opacity: 0, rotateY: 0 }
          : expired
          ? { opacity: 0, scale: 0.8, y: 30, rotateY: 0 }
          : { scale: 1, rotateY: 0, y: 0, opacity: 1, x: 0 }
      }
      transition={taken ? { duration: 0.55, ease: "easeIn" } : expired ? { duration: 0.4 } : { type: "spring", stiffness: 140, damping: 14 }}
    >
      {/* vòng sáng triệu hồi */}
      <motion.span
        className="pointer-events-none absolute -inset-6 rounded-full"
        style={{ background: `radial-gradient(circle, ${ITEMS[it.type].col}, transparent 65%)` }}
        initial={{ opacity: 0.9, scale: 0.4 }}
        animate={{ opacity: 0, scale: 2.2 }}
        transition={{ duration: 0.7 }}
      />
      <div className="tb-float" style={{ animationDelay: `${-it.id * 0.7}s` }}>
        {itemCard(it.type, lines)}
        <div className="absolute -bottom-3 left-1 right-1 h-1 overflow-hidden rounded-full bg-black/60">
          <div className="h-full rounded-full" style={{ width: `${(left / it.life) * 100}%`, background: left < 3 ? "#ff5a5a" : ITEMS[it.type].col }} />
        </div>
      </div>
    </motion.div>
  );
}

/** Banner kích hoạt: lá bài phóng to giữa màn hình như Yu-Gi-Oh. */
function ActivateBanner({ b, names }: { b: Banner; names: [string, string] }) {
  const d = ITEMS[b.type!];
  const dir = b.owner ? 1 : -1;
  return (
    <motion.div className="pointer-events-none absolute inset-x-0 top-[26%] z-40 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }}>
      <motion.div
        className="absolute inset-x-0 h-[120px]"
        style={{ background: `linear-gradient(90deg, transparent, ${d.col}55 25%, ${d.col}55 75%, transparent)` }}
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.25 }}
      />
      <motion.div className="relative flex items-center gap-5" initial={{ x: 220 * dir, scale: 0.3, rotate: 25 * dir, opacity: 0 }} animate={{ x: 0, scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 15 }}>
        <div style={{ transform: "scale(1.15)" }}>{itemCard(b.type!)}</div>
        <div className={cn("max-w-[260px]", b.owner ? "order-first text-right" : "")}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: P_COL[b.owner] }}>{names[b.owner]} kích hoạt</p>
          <p className="font-display text-3xl font-black uppercase leading-tight text-white" style={{ textShadow: `0 0 18px ${d.col}` }}>{d.name}</p>
          <p className="mt-1 text-xs text-white/70">{d.desc}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Banner hợp thể: 2 thẻ xoáy vào nhau rồi hiện thẻ kỹ năng đặc biệt. */
function FusionBanner({ b, names }: { b: Banner; names: [string, string] }) {
  const fu = b.fusion!;
  return (
    <motion.div className="pointer-events-none absolute inset-0 z-50 grid place-items-center overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.35 } }}>
      <div className="absolute inset-0 bg-black/55" />
      <motion.div
        className="tb-vortex absolute size-[520px] rounded-full"
        style={{ background: `conic-gradient(from 0deg, transparent, ${fu.col}, transparent 30%, #ffffff88, transparent 60%, ${fu.col}, transparent)` }}
        initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1, 1, 2.2], opacity: [0, 0.9, 0.9, 0] }} transition={{ duration: 2.2, times: [0, 0.2, 0.7, 1] }}
      />
      {[fu.a, fu.b].map((t, i) => (
        <motion.div
          key={t}
          className="absolute"
          initial={{ x: i ? 340 : -340, rotate: i ? 30 : -30, scale: 0.9, opacity: 0 }}
          animate={{ x: [i ? 340 : -340, i ? 120 : -120, 0], rotate: [0, 360, 720], scale: [0.9, 0.9, 0.2], opacity: [0, 1, 0] }}
          transition={{ duration: 1.0, times: [0, 0.55, 1], ease: "easeInOut" }}
        >
          {itemCard(t)}
        </motion.div>
      ))}
      <motion.div className="absolute inset-0 bg-white" initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 1, 0] }} transition={{ duration: 1.3, times: [0, 0.6, 0.78, 1] }} />
      <motion.div className="relative flex flex-col items-center gap-2" initial={{ scale: 0, rotate: -180, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ delay: 0.95, type: "spring", stiffness: 160, damping: 13 }}>
        <p className="font-display text-sm font-black uppercase tracking-[0.4em]" style={{ color: fu.col, textShadow: `0 0 16px ${fu.col}` }}>
          {names[b.owner]} · hợp thể
        </p>
        <div style={{ transform: "scale(1.35)", margin: "26px 0" }}>{fusionCard(fu)}</div>
        <p className="font-display text-4xl font-black uppercase text-white" style={{ textShadow: `0 0 26px ${fu.col}` }}>{fu.name}</p>
        <p className="max-w-[320px] text-center text-xs text-white/75">{fu.desc}</p>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------ Nhân vật + HUD ------------------------------ */

function Fighters({ f, src, chibi }: { f: Fighter; src: string; chibi: boolean }) {
  const col = P_COL[f.id];
  return (
    <div className="absolute" style={{ left: f.x - 80, top: f.y - 110, width: 160, height: 220 }}>
      <span className="absolute left-1/2 top-[120px] h-5 w-36 -translate-x-1/2 rounded-full blur-md" style={{ background: col + "88" }} />
      <div key={`fire${f.fireN}`} className={f.fireN > 0 ? (f.id ? "tb-lunge-l" : "tb-lunge-r") : ""}>
        <div key={`hit${f.hitN}`} className={cn("relative grid place-items-center", f.hitN > 0 && "tb-hit", "tb-idle")} style={{ height: 170 }}>
          {f.armor > 0 && <span className="absolute size-[150px] rounded-full border-2 border-sky-400/80 bg-sky-400/15 shadow-[0_0_26px_#3aa0ffaa]" />}
          {f.reflectT > 0 && <span className="tb-spin absolute size-[168px] rounded-full border-[3px] border-dashed border-violet-400 shadow-[0_0_22px_#b878ffaa]" />}
          {f.lifeT > 0 && <span className="tb-pulse absolute size-[184px] rounded-full border-2 border-emerald-400/80" />}
          {f.slowT > 0 && <span className="tb-spin absolute size-[196px] rounded-full border-2 border-dotted border-yellow-300/80" />}
          {chibi ? (
            <ChibiAvatar size={150} animate={false} />
          ) : (
            <span className="rounded-full p-[3px]" style={{ background: `linear-gradient(160deg,${col},#10163c)`, boxShadow: `0 0 28px ${col}88` }}>
              <UserAvatar src={src} name={f.name} className="size-[128px]" />
            </span>
          )}
          {f.freezeT > 0 && (
            <span className="absolute inset-3 grid place-items-center rounded-full bg-cyan-200/35 text-5xl backdrop-grayscale">❄️</span>
          )}
        </div>
      </div>
      <p className="mt-1 text-center font-display text-sm font-extrabold" style={{ color: col, textShadow: `0 0 10px ${col}` }}>
        {f.name}
      </p>
      {f.combo > 1 && <p className="text-center text-xs font-black text-yellow-300">COMBO x{f.combo}</p>}
      {/* đạn dự trữ */}
      {f.ammo > 0 && (
        <p className="text-center text-xs font-bold text-amber-300">
          {"▲".repeat(Math.min(f.ammo, 10))}
          {f.ammo > 10 ? ` +${f.ammo - 10}` : ""}
        </p>
      )}
    </div>
  );
}

function Hud({ f, mode }: { f: Fighter; mode: Mode }) {
  const left = f.id === 0, col = P_COL[f.id];
  const frac = mode === 3 ? f.idx / f.text.length : f.hp / f.maxHp;
  const ghost = mode === 3 ? frac : f.ghost / f.maxHp;
  const hpCol = frac > 0.5 ? "from-emerald-300 to-emerald-600" : frac > 0.25 ? "from-yellow-300 to-orange-500" : "from-red-400 to-red-700";
  const chips: [string, string][] = [];
  if (mode === 2) chips.push([`🚀 ${f.ammo}`, "#ffb020"]);
  if (f.armor > 0) chips.push([`🛡️ ${Math.ceil(f.armor)}`, "#5ab4ff"]);
  if (f.reflectT > 0) chips.push([`🔄 ${f.reflectT.toFixed(1)}s${f.reflectMul > 1 ? " ×1.5" : ""}`, "#b878ff"]);
  if (f.lifeT > 0) chips.push([`🩸 ${f.lifeT.toFixed(1)}s`, "#40e880"]);
  if (f.slowT > 0) chips.push([`🐌 ${f.slowT.toFixed(1)}s`, "#ffe040"]);
  if (f.freezeT > 0) chips.push([`❄️ ${f.freezeT.toFixed(1)}s`, "#a0f0ff"]);
  return (
    <div className={cn("absolute top-3 w-[440px]", left ? "left-6" : "right-6")}>
      <div className="rounded-2xl border bg-ink-900/80 px-4 py-2 backdrop-blur" style={{ borderColor: col, boxShadow: `0 0 18px ${col}55` }}>
        <div className={cn("flex items-baseline justify-between", !left && "flex-row-reverse")}>
          <span className="font-display text-base font-extrabold" style={{ color: col }}>{f.name}</span>
          <span className="font-mono text-sm font-bold text-white/90">{mode === 3 ? `${Math.round(frac * 100)}%` : Math.ceil(f.hp)}</span>
        </div>
        <div className={cn("relative mt-1 h-4 overflow-hidden rounded-full bg-black/60", !left && "[direction:rtl]")}>
          <div className="absolute inset-y-0 left-0 bg-white/60" style={{ width: `${Math.max(frac, ghost) * 100}%` }} />
          <div className={cn("absolute inset-y-0 left-0 bg-gradient-to-b transition-[width] duration-150", hpCol)} style={{ width: `${frac * 100}%` }} />
          <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_4.6%,rgba(0,0,0,.35)_4.6%_5%)]" />
        </div>
      </div>
      <div className={cn("mt-1.5 flex flex-wrap items-start gap-1.5", !left && "justify-end")}>
        {chips.map(([s, c]) => (
          <span key={s} className="rounded-full border bg-ink-900/70 px-2 py-0.5 text-[11px] font-bold" style={{ borderColor: c, color: c }}>{s}</span>
        ))}
        {/* tay bài: 2 thẻ khớp công thức sẽ hợp thể */}
        {f.hand.map((c, i) => (
          <motion.span
            key={`${c.type}${i}`}
            layout
            initial={{ y: -20, opacity: 0, scale: 0.6 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            className="relative grid size-9 place-items-center overflow-hidden rounded-md border-2 text-lg"
            style={{ borderColor: ITEMS[c.type].col, background: FRAME_BG[ITEMS[c.type].frame] }}
            title={`${ITEMS[c.type].name} · tự kích hoạt sau ${c.t.toFixed(1)}s`}
          >
            {ITEMS[c.type].icon}
            <span className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
              <span className="block h-full bg-white" style={{ width: `${(c.t / HAND_HOLD) * 100}%` }} />
            </span>
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function WordBox({ f, label, hint, ready }: { f: Fighter; label: string; hint: string; ready: boolean }) {
  const col = ready ? "#ffe040" : f.err > 0 ? "#ff4a4a" : P_COL[f.id];
  return (
    <div className={cn("absolute bottom-4 w-[500px] rounded-2xl border bg-ink-900/85 px-4 pb-2 pt-3 text-center backdrop-blur", f.err > 0 && "tb-shake")} style={{ [f.id ? "right" : "left"]: 24, borderColor: col, boxShadow: `0 0 22px ${col}55` } as React.CSSProperties}>
      <p className="absolute -top-2.5 left-4 rounded-full bg-ink-900 px-2 text-[10px] font-bold tracking-widest" style={{ color: P_COL[f.id] }}>{label}</p>
      {f.freezeT > 0 ? (
        <p className="py-2 font-display text-2xl font-black text-cyan-200">❄️ BỊ ĐÓNG BĂNG</p>
      ) : (
        <p className="font-mono text-[44px] leading-[1.15]">
          {Array.from(f.word).map((ch, i) => (
            <span key={i} className={cn(i === f.buf.length && "tb-caret")} style={i < f.buf.length ? { color: "#58ffa6", textShadow: "0 0 14px #58ffa6" } : { color: "#e6ebff" }}>{ch}</span>
          ))}
        </p>
      )}
      <div className="mx-auto mt-1 h-1.5 w-[90%] overflow-hidden rounded-full bg-black/60">
        <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${f.word ? (f.buf.length / f.word.length) * 100 : 0}%`, background: col }} />
      </div>
      <p className={cn("mt-1 text-xs font-semibold", ready ? "animate-pulse text-yellow-300" : "text-white/45")}>{hint}</p>
    </div>
  );
}

function BufferBox({ f, hint }: { f: Fighter; hint: string }) {
  const col = f.err > 0 ? "#ff4a4a" : P_COL[f.id];
  return (
    <div className={cn("absolute bottom-4 w-[300px] rounded-2xl border bg-ink-900/85 px-4 py-2 text-center backdrop-blur", f.err > 0 && "tb-shake")} style={{ [f.id ? "right" : "left"]: 24, borderColor: col, boxShadow: `0 0 18px ${col}55` } as React.CSSProperties}>
      <p className="font-mono text-2xl text-white">{f.freezeT > 0 ? "❄️ BỊ ĐÓNG BĂNG" : f.buf || "▍"}</p>
      <p className="text-[10px] font-bold tracking-widest text-white/45">{hint}</p>
    </div>
  );
}

function RacePanel({ f, top, src, chibi, active }: { f: Fighter; top: number; src: string; chibi: boolean; active: boolean }) {
  const col = P_COL[f.id], pct = f.idx / f.text.length;
  const lines: { st: number; text: string }[] = [];
  let cur = "", st = 0;
  for (const w of f.text.split(" ")) {
    if ((cur + " " + w).trim().length > 58) { lines.push({ st, text: cur }); st += cur.length + 1; cur = w; }
    else cur = (cur + " " + w).trim();
  }
  lines.push({ st, text: cur });
  return (
    <div className={cn("absolute left-6 right-6 rounded-2xl border bg-ink-900/80 px-5 pb-3 pt-2 backdrop-blur", f.err > 0 && "tb-shake")} style={{ top, height: 220, borderColor: f.err > 0 ? "#ff4a4a" : col, boxShadow: `0 0 20px ${col}44` }}>
      <div className="flex items-center justify-between">
        <span className="font-display text-base font-extrabold" style={{ color: col }}>{f.name}{active ? "  ★ DẪN ĐẦU" : ""}</span>
        <span className="font-mono text-sm text-white/80">LỖI {f.errors}</span>
      </div>
      <div className="relative my-2 mr-4 h-2 rounded-full bg-black/60">
        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: col, boxShadow: `0 0 10px ${col}` }} />
        <span className="absolute -top-5 grid size-9 -translate-x-1/2 place-items-center" style={{ left: `${pct * 100}%` }}>
          {chibi ? <ChibiAvatar size={40} animate={false} /> : <UserAvatar src={src} name={f.name} className="size-9" />}
        </span>
        <span className="absolute -right-5 -top-2 text-lg">🏁</span>
      </div>
      <div className="mt-5 font-mono text-[25px] leading-[40px]">
        {lines.map((l) => (
          <div key={l.st} className="whitespace-pre">
            {Array.from(l.text).map((ch, i) => {
              const gi = l.st + i;
              if (gi === f.idx) return <span key={i} className="rounded px-[1px] text-[#04081a]" style={{ background: f.err > 0 ? "#ff4a4a" : col, boxShadow: `0 0 14px ${col}` }}>{ch}</span>;
              return <span key={i} style={{ color: gi < f.idx ? "#58ffa6" : "#7e89bd" }}>{ch}</span>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- Game ---------------------------------- */

export function TypingBattleGame() {
  const me = useAppStore(useShallow((s) => ({ id: s.currentUser.id, username: s.currentUser.username, avatar: s.currentUser.avatar, has: !!s.currentUser.hasCreatedCharacter })));
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const { settle, reset: resetSettlement, result, open: resultOpen, setOpen: setResultOpen } = useMatchSettlement("typing");

  const [phase, setPhase] = useState<"setup" | "playing" | "over">("setup");
  const [mode, setMode] = useState<Mode>(1);
  const [vsBot, setVsBot] = useState(true);
  const [diff, setDiff] = useState(3);
  const [stake, setStake] = useState(0);
  const [scale, setScale] = useState(1);
  const [, force] = useReducer((x: number) => x + 1, 0);

  const gRef = useRef<Game | null>(null);
  const botRef = useRef(BOTS[0]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;
  const settleRef = useRef(settle);
  settleRef.current = settle;
  const cfgRef = useRef({ vsBot, diff, stake });
  cfgRef.current = { vsBot, diff, stake };

  const hooks = useRef<Hooks>({
    sfx: (n) => {
      if (!soundRef.current) return;
      try {
        ({ fire: () => soundManager.playPieceDrop(), hit: () => soundManager.playCapture(), collect: () => soundManager.playCoin(), fuse: () => soundManager.playTurn(), win: () => soundManager.playTurn(), count: () => {}, go: () => soundManager.playTurn() })[n]();
      } catch {}
    },
  }).current;

  useEffect(() => {
    const st = parseInt(new URLSearchParams(window.location.search).get("stake") || "", 10);
    if (st > 0) setStake(st);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / W));
    ro.observe(el);
    setScale(el.clientWidth / W);
    return () => ro.disconnect();
  }, []);

  const start = useCallback(() => {
    const opp = vsBot ? BOTS[Math.floor(Math.random() * BOTS.length)] : { name: "P2", seed: "player two:0" };
    botRef.current = opp;
    gRef.current = createGame({ mode, vsBot, diff, names: [me.username || "P1", opp.name] });
    resetSettlement();
    setPhase("playing");
  }, [mode, vsBot, diff, me.username, resetSettlement]);

  // vòng lặp: cập nhật engine + vẽ canvas, DOM cập nhật ~15Hz
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const bg = makeBackdrop();
    const stars = makeStars();
    let raf = 0, last = performance.now(), clock = 0, acc = 0, ended = false;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; clock += dt; acc += dt;
      for (const L of stars) for (const s of L) { s.x -= s.v * dt; if (s.x < 0) { s.x = W; s.y = Math.random() * H; } }
      const g = gRef.current;
      if (g && phaseRef.current === "playing") {
        update(g, dt, hooks);
        if (g.phase === "over" && !ended) {
          ended = true;
          const w = g.winner;
          setTimeout(() => {
            if (cfgRef.current.vsBot && w >= 0) settleRef.current(w === 0 ? "win" : "loss", { name: botRef.current.name, elo: 1000 + cfgRef.current.diff * 120 }, cfgRef.current.stake);
            setPhase("over");
          }, 1400);
        }
        if (g.phase !== "over") ended = false;
      }
      drawFx(ctx, bg, stars, phaseRef.current === "setup" ? null : g, clock);
      if (acc > 0.066) { acc = 0; force(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hooks]);

  // bàn phím: P1 nửa trái + Space, P2 nửa phải + Enter
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input,textarea,select,[contenteditable='true']")) return;
      const g = gRef.current;
      if (phaseRef.current === "playing" && e.key === "Escape") { setPhase("setup"); return; }
      if (!g || phaseRef.current !== "playing" || g.phase === "over") return;
      if (e.code === "Space") { e.preventDefault(); onFire(g, g.fighters[0], hooks); force(); return; }
      if (e.key === "Enter") { e.preventDefault(); if (!g.fighters[1].bot) onFire(g, g.fighters[1], hooks); force(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      const ch = e.key.toLowerCase();
      if (LEFT_KEYS.includes(ch)) onKey(g, g.fighters[0], ch, hooks);
      else if (RIGHT_KEYS.includes(ch) && !g.fighters[1].bot) onKey(g, g.fighters[1], ch, hooks);
      else return;
      force();
    };
    window.addEventListener("keydown", onDown);
    return () => window.removeEventListener("keydown", onDown);
  }, [hooks]);

  const g = gRef.current;
  const show = phase !== "setup" && g;
  const opp = botRef.current;
  const srcs: [string, string] = [me.avatar, `kokonut:${opp.seed}`];
  const chibi: [boolean, boolean] = [me.has, false];
  const names: [string, string] = g ? [g.fighters[0].name, g.fighters[1].name] : ["P1", "P2"];
  const winner = g && g.winner !== -1 ? g.fighters[g.winner] : null;

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
      <style>{`
        @keyframes tb-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes tb-float{0%,100%{transform:translateY(0) rotate(-1.2deg)}50%{transform:translateY(-8px) rotate(1.2deg)}}
        @keyframes tb-lr{0%{transform:translateX(0)}30%{transform:translateX(-26px)}100%{transform:translateX(0)}}
        @keyframes tb-ll{0%{transform:translateX(0)}30%{transform:translateX(26px)}100%{transform:translateX(0)}}
        @keyframes tb-hit{0%,100%{transform:translateX(0);filter:none}15%{transform:translateX(-12px);filter:brightness(2) saturate(2) hue-rotate(-30deg)}35%{transform:translateX(10px)}55%{transform:translateX(-7px)}75%{transform:translateX(4px)}}
        @keyframes tb-spin{to{transform:rotate(360deg)}}
        @keyframes tb-pulse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.08);opacity:.4}}
        @keyframes tb-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
        @keyframes tb-shine{0%{transform:translateX(-120%) skewX(-20deg)}60%,100%{transform:translateX(220%) skewX(-20deg)}}
        @keyframes tb-caret{50%{border-color:transparent}}
        .tb-idle{animation:tb-bob 2.6s ease-in-out infinite}
        .tb-float{animation:tb-float 3.4s ease-in-out infinite;position:relative}
        .tb-lunge-r{animation:tb-lr .35s ease-out}.tb-lunge-l{animation:tb-ll .35s ease-out}
        .tb-hit{animation:tb-hit .45s ease-out}
        .tb-spin{animation:tb-spin 4s linear infinite}
        .tb-vortex{animation:tb-spin 1.4s linear infinite}
        .tb-pulse{animation:tb-pulse 1s ease-in-out infinite}
        .tb-shake{animation:tb-shake .25s linear}
        .tb-shine{background:linear-gradient(100deg,transparent 35%,rgba(255,255,255,.55) 50%,transparent 65%);animation:tb-shine 2.8s ease-in-out infinite}
        .tb-caret{border-bottom:4px solid #3ad0ff;animation:tb-caret 1s steps(1) infinite}
      `}</style>

      <GameHeader game="typing" subtitle={phase === "setup" ? "Gõ phím đối kháng · 3 chế độ" : mode === 1 ? "Đọ tên lửa · 5000 máu" : mode === 2 ? "Tranh vật phẩm · gộp thẻ hợp thể" : "Đua gõ đoạn văn"} />

      <div className="mx-auto w-full max-w-[min(100%,calc((100vh-11rem)*1.774))]">
        <div ref={wrapRef} className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[#04061a]" style={{ aspectRatio: `${W}/${H}` }}>
          <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
            <canvas ref={canvasRef} width={W * FS} height={H * FS} className="absolute inset-0 h-full w-full" />

            {show && g && (
              <>
                {g.mode !== 3 && g.fighters.map((f) => <Fighters key={f.id} f={f} src={srcs[f.id]} chibi={chibi[f.id]} />)}
                {g.fighters.map((f) => <Hud key={f.id} f={f} mode={g.mode} />)}

                {g.mode === 1 &&
                  g.fighters.map((f) => {
                    const ready = !!f.word && f.buf === f.word;
                    return <WordBox key={f.id} f={f} ready={ready} label={f.name} hint={ready ? (f.id ? (f.bot ? "..." : "▶ NHẤN ENTER ĐỂ BẮN ◀") : "▶ NHẤN SPACE ĐỂ BẮN ◀") : `Gõ đúng từ rồi bắn · sát thương ${f.word.length * 60}`} />;
                  })}

                {g.mode === 2 && (
                  <>
                    <p className="absolute left-1/2 top-[112px] -translate-x-1/2 text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-200/40">Khu tranh giành thẻ · ghép 2 thẻ để hợp thể</p>
                    {g.items.map((it) => <CardSlot key={it.id} it={it} g={g} />)}
                    {g.fighters.map((f) => <BufferBox key={f.id} f={f} hint={f.id ? (f.bot ? "" : "ENTER = BẮN / KÍCH HOẠT") : "SPACE = BẮN / KÍCH HOẠT"} />)}
                  </>
                )}

                {g.mode === 3 &&
                  g.fighters.map((f) => (
                    <RacePanel key={f.id} f={f} top={110 + f.id * 250} src={srcs[f.id]} chibi={chibi[f.id]} active={g.fighters[0].idx !== g.fighters[1].idx && g.fighters[0].idx > g.fighters[1].idx === !f.id} />
                  ))}

                <AnimatePresence>
                  {g.banners.map((b) => (b.kind === "fusion" ? <FusionBanner key={b.id} b={b} names={names} /> : <ActivateBanner key={b.id} b={b} names={names} />))}
                </AnimatePresence>

                {g.phase === "count" && (
                  <div className="absolute inset-0 z-40 grid place-items-center bg-black/50">
                    <motion.p key={Math.ceil(g.count)} className="font-display text-[150px] font-black text-white" style={{ textShadow: "0 0 40px #fff" }} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                      {Math.max(1, Math.ceil(g.count))}
                    </motion.p>
                  </div>
                )}
                {g.goT > 0 && (
                  <p className="pointer-events-none absolute inset-0 z-40 grid place-items-center font-display text-[130px] font-black text-emerald-300" style={{ textShadow: "0 0 40px #58ffa6", opacity: Math.min(1, g.goT * 2.5) }}>GO!</p>
                )}
                {g.phase === "over" && (
                  <p className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-black/40 font-display text-[120px] font-black" style={{ color: winner ? P_COL[winner.id] : "#fff", textShadow: "0 0 50px currentColor" }}>K.O.</p>
                )}
              </>
            )}

            {/* Thiết lập */}
            {phase === "setup" && (
              <div className="absolute inset-0 z-50 grid place-items-center bg-black/65 p-4">
                <div className="panel w-[560px] space-y-4 p-6">
                  <div>
                    <span className="label">Chế độ</span>
                    <Segmented value={mode} onChange={setMode} options={[{ value: 1 as Mode, label: "🚀 Đọ tên lửa" }, { value: 2 as Mode, label: "🃏 Tranh thẻ" }, { value: 3 as Mode, label: "🏁 Đua gõ" }]} />
                    <p className="mt-2 text-xs leading-relaxed text-ink-300">
                      {mode === 1 && "Gõ đúng từ rồi bấm bắn tên lửa. Hết 5000 máu là thua."}
                      {mode === 2 && "Thẻ vật phẩm lơ lửng giữa đấu trường, thẻ hiếm là cả đoạn text dài. Gom 2 thẻ khớp công thức để hợp thể thành kỹ năng đặc biệt."}
                      {mode === 3 && "Mỗi bên gõ một đoạn văn dài bằng nhau, ai xong trước thắng."}
                    </p>
                  </div>
                  <div>
                    <span className="label">Đối thủ</span>
                    <Segmented value={vsBot ? 1 : 0} onChange={(v) => setVsBot(v === 1)} options={[{ value: 1, label: "🤖 Đấu với máy" }, { value: 0, label: "👥 2 người 1 bàn phím" }]} />
                  </div>
                  {vsBot && (
                    <>
                      <div>
                        <span className="label">Độ khó của máy</span>
                        <Segmented value={diff} onChange={setDiff} size="sm" options={[1, 2, 3, 4, 5].map((v) => ({ value: v, label: ["Rất dễ", "Dễ", "Vừa", "Khó", "Rất khó"][v - 1] }))} />
                      </div>
                      <StakePicker value={stake} onChange={setStake} />
                    </>
                  )}
                  {mode === 2 && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl bg-black/30 p-3 text-[11px] text-ink-200">
                      {FUSIONS.map((f) => (
                        <p key={f.id}>
                          <span className="font-bold" style={{ color: f.col }}>{ITEMS[f.a].icon}+{ITEMS[f.b].icon} {f.name}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5 text-[11px] text-ink-300">
                    <span className="kbd">P1 nửa trái</span><span className="kbd">Space bắn</span>
                    <span className="kbd">P2 nửa phải</span><span className="kbd">Enter bắn</span><span className="kbd">Esc thoát</span>
                  </div>
                  <button type="button" className="btn-lime w-full py-3" onClick={start}>
                    <Play className="size-4" /> Bắt đầu
                  </button>
                </div>
              </div>
            )}

            {/* Kết quả */}
            {phase === "over" && winner && (
              <div className="absolute inset-0 z-50 grid place-items-center bg-black/70">
                <div className="text-center">
                  <p className="text-sm text-ink-300">{g!.mode === 3 ? "Về đích đầu tiên" : "Đối thủ đã hết máu"}</p>
                  <p className="font-display text-5xl font-extrabold" style={{ color: P_COL[winner.id], textShadow: `0 0 30px ${P_COL[winner.id]}` }}>
                    {winner.name} THẮNG 🏆
                  </p>
                  <div className="mt-5 flex justify-center gap-2">
                    <button type="button" className="btn-lime" onClick={start}>
                      <RotateCcw className="size-4" /> Chơi lại
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setPhase("setup")}>Thiết lập</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-ink-400">P1: nửa trái bàn phím + Space · P2: nửa phải + Enter · Esc về thiết lập</p>
      </div>

      <MatchResultModal isOpen={resultOpen && phase === "over"} onClose={() => setResultOpen(false)} onPlayAgain={() => setPhase("setup")} resultData={result} reason={g?.mode === 3 ? "Về đích đầu tiên" : "Hạ gục đối thủ bằng tên lửa"} />
    </div>
  );
}

export default TypingBattleGame;
