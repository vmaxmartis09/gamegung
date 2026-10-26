"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Crosshair, Flag, Keyboard, Play, RotateCcw, Send, Sparkles, Trophy, UserPlus, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/lib/store";
import { soundManager } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ChibiAvatar } from "@/components/character/chibi-avatar";
import {
  HAND_MAX,
  ITEMS,
  RIGHT_KEYS,
  findFusion,
} from "@/lib/games/typing-battle-data";
import {
  Banner,
  Fighter,
  Game,
  Hooks,
  Item,
  LANES,
  H,
  Mode,
  W,
  createGame,
  finish,
  keyOf,
  onFire,
  onKey,
  onSubmit,
  onType,
  update,
  castSkill,
  wpmOf,
} from "@/lib/games/typing-battle-engine";
import { MatchResultModal } from "./match-result-modal";
import { MatchIntro, NarratorButton, useNarrator } from "./game-fx";
import { GameHeader, Segmented, StakePicker, useMatchSettlement, waitForBetOpponent, InviteSender, sendBetInvite, type InvitePerson } from "./shared";
import { BetLobby, type BetOpp } from "./bet-lobby";
import { currentRound, rejoinTable, roomOf, useBetRounds } from "@/lib/bet-rounds";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { CylinderText, CylinderWords, FocusFrame, TextLoop } from "@/components/reactbits";
import { EmojiText } from "@/components/ui/emoji";

/* --------------------------------- Hằng số --------------------------------- */

/** Màu hai người chơi = token `info` / `danger`. */
const P_COL = ["#6aa4ff", "#ef5350"] as const;
const BOTS = [
  { name: "Linh HR", seed: "linh hr:1", title: "Kỳ Thủ Văn Phòng" },
  { name: "Tuấn Dev", seed: "tuan dev:2", title: "Kỹ Sư Bậc Thầy" },
  { name: "Sếp Tổng", seed: "sep tong:3", title: "Đại Kiện Tướng" },
];
const FS = 1.5;
function makeBackdrop() {
  const c = document.createElement("canvas");
  c.width = W * FS;
  c.height = H * FS;
  const x = c.getContext("2d")!;
  x.scale(FS, FS);

  // Nền phẳng màu ink-900, chỉ hai đường mảnh tách khu HUD khỏi sân và ba vạch làn
  x.fillStyle = "#0c0c0c";
  x.fillRect(0, 0, W, H);
  x.strokeStyle = "rgba(255,255,255,0.06)";
  x.lineWidth = 1;
  for (const y of [108, H - 108]) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
  x.strokeStyle = "rgba(255,255,255,0.035)";
  for (const lane of LANES) { x.beginPath(); x.moveTo(0, lane.y); x.lineTo(W, lane.y); x.stroke(); }

  return c;
}

interface Star {
  x: number;
  y: number;
  s: number;
  v: number;
  ph: number;
}
const makeStars = (): Star[][] =>
  [0, 1].map((l) =>
    Array.from({ length: 30 - l * 8 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      s: 0.6 + l * 0.5,
      v: 8 + l * 12,
      ph: Math.random() * 6,
    }))
  );

/** Tia điện giật (Arc): đường gấp khúc ngẫu nhiên mỗi khung hình, ba lớp sáng + nhánh phụ. */
function arcBolt(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string, power: number, clock: number) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const n = Math.max(4, Math.ceil(len / 20));
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const amp = Math.sin(t * Math.PI) * 11 * power * (0.5 + Math.random());
    const off = (Math.random() - 0.5) * 2 * amp + Math.sin(clock * 22 + i) * 2;
    pts.push([x0 + dx * t + nx * off, y0 + dy * t + ny * off]);
  }
  const stroke = (w: number, a: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.globalAlpha = a;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  stroke(9 * power, 0.12, col);
  stroke(3.5 * power, 0.55, col);
  stroke(1.4 * power, 0.95, "#ffffff");
  // nhánh phụ
  for (let b = 0; b < 2; b++) {
    const i = 1 + Math.floor(Math.random() * (n - 2));
    const [px, py] = pts[i];
    const side = Math.random() < 0.5 ? -1 : 1;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + nx * side * (14 + Math.random() * 18) + dx / len * 10, py + ny * side * (14 + Math.random() * 18) + dy / len * 10);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawFx(
  ctx: CanvasRenderingContext2D,
  bg: HTMLCanvasElement,
  stars: Star[][],
  g: Game | null,
  clock: number
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bg, 0, 0);
  ctx.setTransform(FS, 0, 0, FS, 0, 0);

  if (!g) return;

  ctx.save();
  // Rung màn hình khi trúng đòn
  if (g.shake > 0) {
    ctx.translate((Math.random() - 0.5) * 12 * g.shake, (Math.random() - 0.5) * 12 * g.shake);
  }

  // Tia laser khoá mục tiêu (Target Lock Tether)
  for (const f of g.fighters) {
    if (f.lock && f.lock.state === "live") {
      const it = f.lock;
      const startX = f.x;
      const startY = f.id === 0 ? f.y - 55 : f.y + 55;
      const col = P_COL[f.id];

      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.8;
      ctx.shadowColor = col;
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.65 + Math.sin(clock * 8) * 0.25;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -clock * 70 * (f.id === 0 ? 1 : -1);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(it.x, it.y);
      ctx.stroke();

      // Hạt năng lượng chạy dọc tia laser
      const pulseK = (clock * 2.5) % 1;
      const px = startX + (it.x - startX) * pulseK;
      const py = startY + (it.y - startY) * pulseK;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // Vòng sóng xung kích chấn động
  for (const r of g.rings) {
    const k = r.t / r.life;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = r.col;
    ctx.lineWidth = 3 * (1 - k) + 1;
    ctx.shadowColor = r.col;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r + (r.max - r.r) * Math.sqrt(k), 0, 6.283);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // Đòn tấn công: tia điện (Arc) kéo dài từ người bắn, đầu tia là lõi phát tia (Nexus)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const m of g.missiles) {
    const c = m.reflected ? "#c4a0f0" : m.big ? "#f0d870" : P_COL[m.owner];
    const hx = m.x, hy = m.yy;
    const tail = Math.min(300, Math.abs(hy - m.oy) + 20);
    arcBolt(ctx, hx, hy - m.dir * tail, hx, hy, c, m.big ? 2 : 1, clock);
    // lõi + tia xoay
    const k = m.big ? 1.5 : 1;
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(hx, hy, 14 * k, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(hx, hy, 4.5 * k, 0, 6.283); ctx.fill();
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 8; i++) {
      const ang = clock * 3 + (i * Math.PI) / 4;
      const l = (i % 2 ? 12 : 22) * k;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(ang) * 6 * k, hy + Math.sin(ang) * 6 * k);
      ctx.lineTo(hx + Math.cos(ang) * l, hy + Math.sin(ang) * l);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Hạt tia lửa năng lượng
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const q of g.parts) {
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    ctx.fillStyle = q.col;
    const s = q.sz * (0.5 + q.life / q.max / 2);
    ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
  }
  ctx.restore();

  // Tia sáng tỏa ra từ lõi va chạm (Nexus Rays)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const r of g.rays) {
    const k = r.t / r.life;
    const e = 1 - Math.pow(1 - k, 3);
    ctx.strokeStyle = r.col;
    ctx.globalAlpha = Math.max(0, 1 - k);
    for (let i = 0; i < r.n; i++) {
      const ang = r.rot + (i * 6.283) / r.n + k * 0.4;
      const long = i % 2 ? 0.6 : 1;
      const r0 = r.len * 0.12 * e;
      const r1 = r.len * long * e;
      ctx.lineWidth = (i % 2 ? 1.2 : 2.2) * (1 - k * 0.6);
      ctx.beginPath();
      ctx.moveTo(r.x + Math.cos(ang) * r0, r.y + Math.sin(ang) * r0);
      ctx.lineTo(r.x + Math.cos(ang) * r1, r.y + Math.sin(ang) * r1);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Mảnh kính vỡ (Shatter)
  for (const q of g.shards) {
    const a = Math.max(0, q.life / q.max);
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(q.rot);
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.moveTo(q.s, 0);
    ctx.lineTo(-q.s * 0.6, q.s * 0.7);
    ctx.lineTo(-q.s * 0.3, -q.s * 0.8);
    ctx.closePath();
    ctx.fillStyle = q.col + "55";
    ctx.fill();
    ctx.strokeStyle = q.col;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Chữ nổi sát thương & thông báo kỹ năng
  ctx.globalAlpha = 1;
  for (const t of g.texts) {
    const k = t.t / 1.3;
    const pop = t.big ? 1 + Math.max(0, 0.4 - t.t * 2.8) : 1;
    const size = t.big ? 24 : 17;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - k * k);
    ctx.translate(t.x, t.y);
    ctx.scale(pop, pop);
    ctx.font = `800 ${size}px var(--font-mono), ui-monospace, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
    ctx.strokeText(t.txt, 0, 0);
    ctx.fillStyle = t.col;
    ctx.shadowColor = t.col;
    ctx.shadowBlur = 4;
    ctx.fillText(t.txt, 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // Chớp sáng toàn màn hình khi va chạm mạnh
  if (g.flashA > 0) {
    ctx.globalAlpha = g.flashA;
    ctx.fillStyle = g.flashC;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

}

/* --------------------------------- Thẻ vật phẩm --------------------------------- */

const CARD_W = 224;
/** Đấu máy: thẻ một dòng chữ. Cùng máy: thêm dòng chữ cho nửa phải bàn phím. */
const cardH = (shared: boolean) => (shared ? 80 : 98);

/** Chữ cần gõ: phần đã gõ đúng mang màu người gõ, phần còn lại màu chữ thường. */
function TypedWord({ text, done, col }: { text: string; done: number; col?: string }) {
  let seen = 0;
  return (
    <span className="whitespace-pre">
      {Array.from(text).map((ch, i) => {
        if (ch === " ") return <span key={i}> </span>;
        const ok = seen < done;
        seen++;
        return (
          <span key={i} style={ok && col ? { color: col } : undefined}>
            {ch}
          </span>
        );
      })}
    </span>
  );
}

/** Thẻ trên băng chuyền: một hàng đầu (icon, tên, giờ), MỘT đoạn chữ cần gõ, thanh thời gian mảnh. */
function ItemCard({ it, g, floating = true }: { it: Item; g: Game; floating?: boolean }) {
  const [f0, f1] = g.fighters;
  const def = ITEMS[it.type];
  const mine = f0.lock === it;
  const theirs = f1.lock === it;
  const shared = f1.bot;
  const typer = mine ? f0 : shared && theirs ? f1 : null;
  // Đang khoá thẻ khác: thẻ này lùi lại phía sau
  const dim = !!f0.lock && !mine;
  const left = Math.max(0, it.life - it.age);
  const pct = Math.min(100, (left / it.life) * 100);
  const h = cardH(shared);

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-ink-900 px-3 py-2.5 transition-[opacity,border-color] duration-200",
        floating ? "absolute left-0 top-0" : "relative w-full",
        mine ? "border-info/70" : theirs ? "border-danger/50" : "border-ink-700",
        it.state !== "live" && "opacity-0",
        dim && "opacity-55"
      )}
      style={
        floating
          ? { width: CARD_W, height: h, transform: `translate3d(${it.x - CARD_W / 2}px, ${it.y - h / 2}px, 0)`, zIndex: mine ? 25 : 15 }
          : undefined
      }
    >
      {!floating && mine && <FocusFrame inset={4} className="size-3 border-info" />}
      <div className="flex items-center gap-2 text-xs">
        <span aria-hidden className="text-sm leading-none grayscale"><EmojiText>{def.icon}</EmojiText></span>
        <span className="min-w-0 flex-1 truncate font-medium text-ink-300">{def.name}</span>
        <span className={cn("shrink-0 font-mono tabular-nums", pct < 25 ? "text-danger" : "text-ink-500")}>{Math.ceil(left)}s</span>
      </div>
      <p className={cn("mt-1.5 truncate font-mono text-lg font-semibold leading-tight tracking-wide text-ink-100", dim && "blur-[1px]")}>
        <TypedWord text={it.disp[0]} done={typer ? typer.buf.length : 0} col={typer ? P_COL[typer.id] : undefined} />
      </p>
      {!shared && (
        <p className="truncate font-mono text-sm leading-tight text-ink-500">
          <TypedWord text={it.disp[1]} done={theirs ? f1.buf.length : 0} col={P_COL[1]} />
        </p>
      )}
      <div className="mt-auto h-0.5 overflow-hidden rounded-full bg-ink-700">
        <div className={cn("h-full rounded-full", pct < 25 ? "bg-danger" : "bg-ink-500")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------ HUD ------------------------------------ */

/** Avatar với vòng máu (hoặc vòng tiến độ ở Đua gõ). */
function HpRing({ f, mode, src, chibi, size }: { f: Fighter; mode: Mode; src: string; chibi: boolean; size: number }) {
  const frac = Math.max(0, Math.min(1, mode === 3 ? (f.text.length ? f.idx / f.text.length : 0) : f.hp / (f.maxHp || 1)));
  const ghost = mode === 3 ? frac : Math.max(frac, f.ghost / (f.maxHp || 1));
  const col = mode === 3 || frac > 0.3 ? P_COL[f.id] : "#ef5350";
  const R = (size - 4) / 2;
  const C = 2 * Math.PI * R;
  return (
    <div className={cn("relative shrink-0", f.hitN > 0 && "brightness-125")} style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="currentColor" strokeWidth={3} className="text-ink-800" />
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="currentColor" strokeWidth={3} strokeDasharray={C} strokeDashoffset={C * (1 - ghost)} className="text-ink-600 transition-[stroke-dashoffset] duration-300" />
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={col} strokeWidth={3} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} className="transition-[stroke-dashoffset] duration-150" />
      </svg>
      <div className={cn("absolute inset-[6px] grid place-items-center overflow-hidden rounded-full bg-ink-900", f.err > 0 && "ring-2 ring-danger/70")}>
        {chibi ? <ChibiAvatar size={size - 12} animate={false} /> : <UserAvatar src={src} name={f.name} className="size-full" />}
        {f.freezeT > 0 && <span className="absolute inset-0 bg-info/25" />}
      </div>
    </div>
  );
}

/** HUD một người chơi: avatar + vòng máu, tên, điểm, WPM, phản xạ, đạn. Cùng bố cục cho cả hai bên (bên trên lật gương). */
function PlayerHud({ f, mode, src, chibi, label, mirror, compact }: { f: Fighter; mode: Mode; src: string; chibi: boolean; label: string; mirror?: boolean; compact?: boolean }) {
  const wpm = wpmOf(f);
  const score = mode === 3 ? `${Math.round((f.text.length ? f.idx / f.text.length : 0) * 100)}%` : Math.ceil(f.hp);
  // Điện thoại: hai dòng gọn (tên · điểm, đạn, WPM), bỏ thanh tốc độ
  if (compact)
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <HpRing f={f} mode={mode} src={src} chibi={chibi} size={44} />
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold text-ink-100">
            {f.name} {label && <span className="font-sans text-xs font-normal text-ink-500">{label}</span>}
          </p>
          <p className="flex items-baseline gap-2 overflow-hidden whitespace-nowrap">
            <span className="font-display text-xl font-bold tabular-nums text-ink-100">{score}</span>
            {mode === 2 && <span className={cn("font-mono text-xs", f.ammo > 0 ? "text-warning" : "text-ink-500")}>×{f.ammo}</span>}
            <span className="font-mono text-xs text-ink-400">{wpm} WPM</span>
          </p>
        </div>
      </div>
    );
  const size = 56;
  const badges: string[] = [];
  if (f.armor > 0) badges.push(`Giáp ${Math.ceil(f.armor)}`);
  if (f.reflectT > 0) badges.push("Phản đòn");
  if (f.lifeT > 0) badges.push("Hút máu");
  if (f.slowT > 0) badges.push("Bị chậm");
  if (f.freezeT > 0) badges.push("Đóng băng");
  if (f.combo > 1) badges.push(`Combo ×${f.combo}`);
  return (
    <div className={cn("flex min-w-0 items-center gap-3", mirror && "flex-row-reverse text-right")}>
      <HpRing f={f} mode={mode} src={src} chibi={chibi} size={size} />
      <div className="min-w-0">
        <div className={cn("flex items-baseline gap-2", mirror && "flex-row-reverse")}>
          <span className="max-w-[180px] truncate font-display text-base font-semibold text-ink-100">{f.name}</span>
          {label && <span className="shrink-0 text-xs text-ink-500">{label}</span>}
          {badges.length > 0 && <span className="truncate text-xs text-warning">{badges.join(" · ")}</span>}
        </div>
        <div className={cn("flex items-baseline gap-3", mirror && "flex-row-reverse")}>
          <span className="font-display text-2xl font-bold leading-tight tabular-nums text-ink-100">{score}</span>
          {mode === 2 && <span className={cn("font-mono text-xs tabular-nums", f.ammo > 0 ? "text-warning" : "text-ink-500")}>Đạn ×{f.ammo}</span>}
          <span className="font-mono text-xs tabular-nums text-ink-400">{f.rt ? `${f.rt.toFixed(1)}s` : "–"} phản xạ</span>
        </div>
        {/* Đồng hồ tốc độ: WPM trong 4 giây gần nhất */}
        <div className={cn("mt-1 flex items-center gap-2", mirror && "flex-row-reverse")}>
          <div className="h-1 w-28 overflow-hidden rounded-full bg-ink-800">
            <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.min(100, wpm)}%`, background: P_COL[f.id] }} />
          </div>
          <span className="font-mono text-xs tabular-nums text-ink-400">{wpm} WPM</span>
        </div>
      </div>
    </div>
  );
}

/** Bốn ô kỹ năng; ô có cặp hợp thể sáng viền. */
function SkillSlots({ f, keys, small }: { f: Fighter; keys: string[]; small?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {Array.from({ length: HAND_MAX }, (_, i) => {
        const c = f.hand[i];
        const def = c ? ITEMS[c.type] : null;
        const partner = !!c && f.hand.some((o, oi) => oi !== i && findFusion(o.type, c.type));
        return (
          <div
            key={i}
            title={def ? `${def.name}: ${def.desc}` : "Ô kỹ năng trống"}
            className={cn(
              "relative grid place-items-center rounded-lg border bg-ink-900",
              small ? "size-9 text-base" : "size-11 text-lg",
              c ? (partner ? "border-warning/70" : "border-ink-500") : "border-dashed border-ink-600"
            )}
          >
            <span className="absolute left-1 top-0.5 font-mono text-xs leading-none text-ink-400">{keys[i]}</span>
            {def && <span className={cn("mt-1", !partner && "grayscale")}><EmojiText>{def.icon}</EmojiText></span>}
          </div>
        );
      })}
    </div>
  );
}

/** Ô chữ của đối thủ (máy hoặc người chơi 2): cùng dáng ô nhập nhưng chỉ để xem. */
function TargetBox({ f, mode, className }: { f: Fighter; mode: Mode; className?: string }) {
  const col = P_COL[f.id];
  return (
    <div className={cn("flex h-12 items-center gap-2 rounded-xl border border-ink-700 bg-ink-900/80 px-4", className)}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: col }} />
      <span className="min-w-0 flex-1 truncate font-mono text-lg tracking-wide text-ink-300">
        {f.freezeT > 0 ? (
          <span className="font-sans text-sm text-info">Đang bị đóng băng</span>
        ) : mode === 2 && f.lock ? (
          <TypedWord text={f.lock.disp[f.id]} done={f.buf.length} col={col} />
        ) : mode === 1 && f.word ? (
          <TypedWord text={f.word} done={f.buf.length} col={col} />
        ) : (
          <span className="font-sans text-sm text-ink-500">Đang chọn mục tiêu…</span>
        )}
      </span>
      {!f.bot && <kbd className="shrink-0 rounded border border-ink-600 px-1.5 py-0.5 font-mono text-xs text-ink-400">SHIFT PHẢI</kbd>}
    </div>
  );
}

/** Phần còn lại của mục tiêu sau chữ đã gõ, hiện mờ ngay trong ô nhập (chỉ khi đang gõ đúng). */
function ghostOf(g: Game, f: Fighter): string {
  if (f.typo || f.freezeT > 0) return "";
  const d = f.draft.toLowerCase();
  if (g.mode === 2) {
    const t = f.lock?.disp[f.id];
    return t && t.startsWith(d) ? t.slice(d.length) : "";
  }
  if (g.mode === 1) return f.word.startsWith(d) ? f.word.slice(d.length) : "";
  const rest = f.text.slice(f.idx);
  if (!rest.startsWith(d)) return "";
  const end = rest.indexOf(" ", Math.max(1, d.length));
  return rest.slice(d.length, end < 0 ? rest.length : end);
}

/** Ô nhập duy nhất của người chơi: gõ, xoá, cách như ô thường; chỉ Enter mới gửi. */
function TypeBox({
  g,
  f,
  boxRef,
  onType,
  onSubmit,
  className,
}: {
  g: Game;
  f: Fighter;
  boxRef: React.Ref<HTMLInputElement>;
  onType: (text: string) => void;
  onSubmit: () => void;
  className?: string;
}) {
  const mode = g.mode;
  const col = P_COL[f.id];
  const frozen = f.freezeT > 0;
  const bad = f.err > 0 || f.typo;
  const ready =
    mode === 1 ? !!f.buf && f.buf === f.word
    : mode === 2 ? (f.lock ? f.buf === keyOf(f.lock, f) : !f.draft.trim() && f.ammo > 0)
    : !!f.draft.trim() && !f.typo;
  const ghost = ghostOf(g, f);
  const hint = frozen
    ? "Đang bị đóng băng…"
    : mode === 2
    ? "Gõ chữ trên thẻ rồi Enter"
    : mode === 1
    ? "Gõ từ khóa rồi Enter để bắn"
    : "Gõ từ tiếp theo rồi Enter";
  return (
    <label
      className={cn(
        "pointer-events-auto flex h-14 items-center gap-3 rounded-xl border bg-ink-900 px-4 transition-colors",
        bad ? "border-danger/70" : ready ? "border-accent/60" : "border-ink-600",
        className
      )}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ background: col }} />
      <span className="relative min-w-0 flex-1">
        {/* Phần còn lại của mục tiêu, nằm ngay sau con trỏ */}
        <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre font-mono text-xl">
          <span className="invisible">{f.draft}</span>
          <span className="text-ink-600">{ghost}</span>
        </span>
        <input
          ref={boxRef}
          value={f.draft}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
            e.preventDefault();
            onSubmit();
          }}
          readOnly={frozen}
          placeholder={ghost ? undefined : hint}
          aria-label="Ô gõ chữ, Enter để gửi"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="send"
          className="relative w-full bg-transparent font-mono text-xl text-ink-100 outline-none focus-visible:outline-none placeholder:font-sans placeholder:text-sm placeholder:text-ink-500"
        />
      </span>
      <kbd className={cn("shrink-0 rounded-md border px-2 py-1 font-mono text-xs", ready ? "border-accent/60 text-accent" : "border-ink-600 text-ink-500")}>ENTER</kbd>
    </label>
  );
}

/* --------------------------------- Banner sự kiện --------------------------------- */

function FusionBanner({ b, names }: { b: Banner; names: [string, string] }) {
  const fu = b.fusion!;
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-50 grid place-items-center bg-ink-950/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      <motion.div
        className="flex max-w-[380px] flex-col items-center rounded-2xl border border-ink-700 bg-ink-900 px-8 py-6 text-center"
        initial={{ scale: 0.9, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
      >
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-400">Hợp thể · {names[b.owner]}</span>
        <div className="my-3 flex items-center gap-3">
          <span className="text-3xl grayscale"><EmojiText>{fu.icon}</EmojiText></span>
          <span className="font-display text-3xl font-bold text-ink-100">{fu.name}</span>
        </div>
        <p className="text-sm leading-relaxed text-ink-300">{fu.desc}</p>
      </motion.div>
    </motion.div>
  );
}

function ActivateBanner({ b, names }: { b: Banner; names: [string, string] }) {
  const def = ITEMS[b.type!];
  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 top-[124px] z-40 flex justify-center"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
    >
      <div className="flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900 px-4 py-1.5 text-sm text-ink-300">
        <span aria-hidden><EmojiText>{def.icon}</EmojiText></span>
        <span style={{ color: P_COL[b.owner] }}>{names[b.owner]}</span> dùng <span className="font-semibold text-ink-100">{def.name}</span>
      </div>
    </motion.div>
  );
}

/** K.O.: một dải ruy băng ngắn trong lúc chờ màn kết quả (lúc này đã hết gõ). */
function KoBanner({ winner }: { winner: Fighter }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-ink-950/50">
      <TextLoop
        items={["K.O.", `${winner.name} thắng`]}
        viewWidth={W}
        fontSize={30}
        amplitude={14}
        waves={1}
        speed={120}
        className={winner.id === 0 ? "text-success" : "text-danger"}
        textClassName={winner.id === 0 ? "fill-ink-950" : "fill-ink-100"}
        style={{ width: W }}
      />
    </div>
  );
}

/* ------------------------------- Đua gõ đoạn văn ------------------------------- */

function RaceTrack({ f, top, lead }: { f: Fighter; top: number; lead: boolean }) {
  const col = P_COL[f.id];
  const pct = f.text.length ? f.idx / f.text.length : 0;
  // Phần đang gõ trong ô nhập (chưa Enter) được tô trước trên đoạn văn
  const at = Math.min(f.text.length, f.idx + f.buf.length);
  return (
    <div className="absolute left-16 right-16 rounded-xl border border-ink-700 bg-ink-900 px-6 py-4" style={{ top, height: 165 }}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-display font-semibold text-ink-100">
          {f.name}
          {lead && <span className="ml-2 text-xs font-normal text-ink-400">dẫn đầu</span>}
        </span>
        <span className="font-mono text-xs tabular-nums text-ink-500">{Math.round(pct * 100)}% · lỗi {f.errors}</span>
      </div>
      <div className="mb-1 mt-3 h-1 w-full rounded-full bg-ink-800">
        <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${pct * 100}%`, background: col }} />
      </div>
      <CylinderText text={f.text} index={at} color={col} className="mt-1.5 w-full" />
    </div>
  );
}

/* ------------------------------------ Tiện ích ------------------------------------ */

/** Màn hình hẹp (điện thoại): dùng bố cục xếp dọc thay cho sân đấu thu nhỏ. */
function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return narrow;
}

/* ---------------------------------- Main Component ---------------------------------- */

export function TypingBattleGame() {
  const me = useAppStore(
    useShallow((s) => ({
      id: s.currentUser.id,
      username: s.currentUser.username,
      avatar: s.currentUser.avatar,
      has: !!s.currentUser.hasCreatedCharacter,
    }))
  );
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const { settle, reset: resetSettlement, result, open: resultOpen, setOpen: setResultOpen } =
    useMatchSettlement("typing");

  const [phase, setPhase] = useState<"setup" | "playing" | "over">("setup");
  // Mời bạn chỉ có Đua gõ, nên mặc định mở ở chế độ đó.
  const [mode, setMode] = useState<Mode>(3);
  const [opp, setOpp] = useState<OppKind>("friend");
  const vsBot = opp === "bot";
  const [diff, setDiff] = useState(3);
  const [stake, setStake] = useState(0);
  const [scale, setScale] = useState(1);
  const [intro, setIntro] = useState(false);
  const narrow = useNarrow();
  const narrator = useNarrator();
  const sayRef = useRef(narrator.say);
  sayRef.current = narrator.say;
  const [, force] = useReducer((x: number) => x + 1, 0);

  const gRef = useRef<Game | null>(null);
  const botRef = useRef<{ name: string; seed: string; title: string; avatar?: string }>(BOTS[0]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLInputElement>(null);
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
      if (n === "count") sayRef.current("Chuẩn bị!", "ty_ready");
      else if (n === "go") sayRef.current("Bắt đầu gõ!", "ty_go");
      else if (n === "fuse") sayRef.current("Hợp thể!", "ty_merge");
      else if (n === "win") sayRef.current("Hạ gục! Trận đấu kết thúc.", "ty_ko");

      if (!soundRef.current) return;
      try {
        ({
          fire: () => soundManager.playTypingKeystroke(),
          hit: () => soundManager.playCyberHit(),
          collect: () => soundManager.playCoin(),
          fuse: () => soundManager.playTurn(),
          win: () => soundManager.playVictory(),
          count: () => soundManager.playTypingKeystroke(),
          go: () => soundManager.playVictory(),
        })[n]();
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
  }, [narrow]);

  const pendingOpp = useRef<{ name: string; seed: string; title: string; avatar?: string }>(BOTS[0]);
  const friendRef = useRef<FriendInfo | null>(null);
  const [lobby, setLobby] = useState<BetOpp | null>(null);
  // Đua gõ online: kênh realtime của kèo, đối thủ là người thật ở máy khác.
  const onlineRef = useRef<{ room: string; bo: BetOpp; oppName: string; stake: number; ch: ReturnType<typeof supabase.channel> } | null>(null);
  const closeOnline = useCallback(() => {
    const o = onlineRef.current;
    onlineRef.current = null;
    if (o) void supabase.removeChannel(o.ch);
  }, []);

  const sendProgress = useCallback(() => {
    const o = onlineRef.current;
    const g = gRef.current;
    if (!o || !g) return;
    // Lưu tiến độ của mình để vào lại ván thì gõ tiếp từ chỗ cũ.
    try {
      sessionStorage.setItem(`oa-typing-progress:${o.room}`, String(g.fighters[0].idx));
    } catch {
      /* ignore */
    }
    void o.ch.send({ type: "broadcast", event: "prog", payload: { idx: g.fighters[0].idx } });
  }, []);

  /** Cả hai đã sẵn sàng trong phòng chờ: mở kênh đua và vào ván (cùng seed = cùng đoạn văn). */
  const launchOnline = useCallback(
    (bo: BetOpp) => {
      setLobby(null);
      closeOnline();
      if (!isSupabaseConfigured) return;
      const round = bo.round ?? currentRound(bo.room);
      const room = roomOf(bo.room, round);
      useBetRounds.getState().start(bo.room, round);
      let seed = 0;
      for (let i = 0; i < room.length; i++) seed = (Math.imul(seed, 31) + room.charCodeAt(i)) >>> 0;
      const g = createGame({ mode: 3, vsBot: false, diff, names: [me.username || "P1", bo.name], seed });
      gRef.current = g;
      // Vào lại ván đang dở (không phải ván mới): gõ tiếp từ chỗ cũ, bỏ đếm ngược và lời mở ván.
      const resume = !!bo.inGame && !bo.round;
      if (resume) {
        let saved = 0;
        try {
          saved = Number(sessionStorage.getItem(`oa-typing-progress:${room}`)) || 0;
        } catch {
          /* ignore */
        }
        g.fighters[0].idx = Math.min(saved, g.fighters[0].text.length);
        g.phase = "play";
        g.count = 0;
      }
      botRef.current = { name: bo.name, seed: bo.name, title: "Bạn bè", avatar: bo.avatar };
      setMode(3);
      setStake(bo.stake);
      const ch = supabase.channel(`typing-online:${room}`, { config: { broadcast: { self: false } } });
      ch.on("broadcast", { event: "prog" }, ({ payload }) => {
        const cur = gRef.current;
        if (!cur || cur.phase === "over") return;
        const f = cur.fighters[1];
        f.idx = Math.max(f.idx, Math.min(Number(payload?.idx) || 0, f.text.length));
        if (f.idx >= f.text.length) finish(cur, 1, hooks);
      }).on("broadcast", { event: "hello" }, () => {
        // Đối thủ vừa vào lại: gửi tiến độ của mình để họ thấy đúng.
        sendProgress();
      }).on("broadcast", { event: "left" }, () => {
        const cur = gRef.current;
        if (cur && cur.phase !== "over") finish(cur, 0, hooks);
      });
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void ch.send({ type: "broadcast", event: "hello", payload: {} });
          sendProgress();
        }
      });
      onlineRef.current = { room, bo, oppName: bo.name, stake: bo.stake, ch };
      resetSettlement();
      setPhase("playing");
    },
    [closeOnline, diff, hooks, me.username, resetSettlement, sendProgress]
  );
  useEffect(() => () => closeOnline(), [closeOnline]);

  // Mở từ thẻ kèo trong chat (?bet=…): vào thẳng phòng chờ.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).get("bet")) return;
    void waitForBetOpponent().then((bo) => {
      if (!bo?.oppId) return;
      setMode(3);
      setOpp("friend");
      setStake(bo.stake);
      if (bo.inGame && rejoinTable(bo.room)) launchOnline(bo);
      else setLobby(bo);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(() => {
    const fr = friendRef.current;
    pendingOpp.current = vsBot
      ? BOTS[Math.floor(Math.random() * BOTS.length)]
      : opp === "friend" && fr
      ? { name: fr.name, seed: fr.name, title: "Bạn bè", avatar: fr.avatar }
      : { name: "P2", seed: "player two:0", title: "Đấu Thủ" };
    setIntro(true);
    sayRef.current("Hai đối thủ đối đầu!", "ty_versus");
  }, [vsBot, opp]);

  // Sau màn giới thiệu VS, trận đấu mới thật sự bắt đầu
  const beginDuel = useCallback(() => {
    setIntro(false);
    const opp = pendingOpp.current;
    botRef.current = opp;
    gRef.current = createGame({ mode, vsBot, diff, names: [me.username || "P1", opp.name] });
    resetSettlement();
    setPhase("playing");
  }, [mode, vsBot, diff, me.username, resetSettlement]);

  // Vòng lặp cập nhật engine + vẽ canvas (canvas luôn có trong DOM, kể cả khi ẩn trên điện thoại)
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const bg = makeBackdrop();
    const stars = makeStars();
    let raf = 0,
      last = performance.now(),
      clock = 0,
      acc = 0,
      ended = false;

    const loop = (now: number) => {
      // Real elapsed time, simulated in <=50ms slices: a slow frame no longer slows the game down.
      const dt = Math.min(0.2, (now - last) / 1000);
      last = now;
      clock += dt;
      acc += dt;

      const g = gRef.current;
      if (g && phaseRef.current === "playing") {
        for (let rem = dt; rem > 0 && g.phase !== "over"; rem -= 0.05) update(g, Math.min(rem, 0.05), hooks);
        if (g.phase === "over" && !ended) {
          ended = true;
          const w = g.winner;
          setTimeout(() => {
            const on = onlineRef.current;
            if (on && w >= 0) {
              settleRef.current(w === 0 ? "win" : "loss", { name: on.oppName, elo: 1000 }, on.stake, on.bo.room);
              // Hết ván: cả hai quay lại phòng chờ của kèo để chơi ván mới.
              useBetRounds.getState().end(on.bo.room);
              setTimeout(() => setLobby(on.bo), 3000);
            } else if (cfgRef.current.vsBot && w >= 0) {
              settleRef.current(
                w === 0 ? "win" : "loss",
                { name: botRef.current.name, elo: 1000 + cfgRef.current.diff * 120 },
                cfgRef.current.stake
              );
            }
            setPhase("over");
          }, 1400);
        }
        if (g.phase !== "over") ended = false;
      }

      drawFx(ctx, bg, stars, phaseRef.current === "setup" ? null : g, clock);

      // The canvas repaints every frame by itself; React (HUD, skill bar) only needs ~12 updates/s.
      if (acc > 0.08) {
        acc = 0;
        force();
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hooks]);

  /** Xin thua giữa ván: đối thủ thắng ngay (online thì báo máy kia), ván tính thua như thường. */
  const forfeit = useCallback(() => {
    const g = gRef.current;
    if (!g || g.phase === "over") return;
    const on = onlineRef.current;
    if (on) void on.ch.send({ type: "broadcast", event: "left", payload: {} });
    finish(g, 1, hooks);
    force();
  }, [hooks]);

  // P1 gõ trong một ô nhập duy nhất: xoá, sửa, cách như ô thường, chỉ Enter mới gửi
  const typeP1 = useCallback((text: string) => {
    const g = gRef.current;
    if (g) onType(g, g.fighters[0], text);
    force();
  }, []);
  const submitP1 = useCallback(() => {
    const g = gRef.current;
    if (!g) return;
    onSubmit(g, g.fighters[0], hooks);
    sendProgress();
    force();
  }, [hooks, sendProgress]);

  useEffect(() => {
    if (phase === "playing") boxRef.current?.focus();
  }, [phase, narrow]);

  // Bàn phím ngoài ô nhập: Esc thoát, gõ phím nào cũng đưa con trỏ về ô nhập.
  // Cùng máy: P2 vẫn gõ nửa phải bàn phím, 7-0 dùng kỹ năng, Shift phải để bắn.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const box = boxRef.current;
      const inBox = !!box && e.target === box;
      const t = e.target as HTMLElement | null;
      if (!inBox && t?.closest("input,textarea,select,[contenteditable='true']")) return;
      const g = gRef.current;
      if (phaseRef.current === "playing" && e.key === "Escape") {
        const on = onlineRef.current;
        if (on && g && g.phase !== "over") {
          // Rời ván online giữa chừng = chịu thua; đối thủ nhận thắng.
          void on.ch.send({ type: "broadcast", event: "left", payload: {} });
          finish(g, 1, hooks);
          return;
        }
        closeOnline();
        setPhase("setup");
        return;
      }
      if (!g || phaseRef.current !== "playing" || g.phase === "over") return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;

      // Phím số 1-4: dùng kỹ năng ở ô tương ứng ngay, không gõ vào ô nhập
      if (g.mode === 2 && e.key.length === 1 && "1234".includes(e.key)) {
        e.preventDefault();
        castSkill(g, g.fighters[0], "1234".indexOf(e.key), hooks);
        force();
        return;
      }

      const p2 = g.fighters[1];
      if (!p2.bot && !onlineRef.current) {
        const ch = e.key.length === 1 ? e.key.toLowerCase() : "";
        if (e.code === "ShiftRight") {
          e.preventDefault();
          onFire(g, p2, hooks);
          force();
          return;
        }
        if (ch && g.mode === 2 && "7890".includes(ch)) {
          e.preventDefault();
          castSkill(g, p2, "7890".indexOf(ch), hooks);
          force();
          return;
        }
        if (ch && RIGHT_KEYS.includes(ch)) {
          e.preventDefault();
          onKey(g, p2, ch, hooks);
          force();
          return;
        }
      }

      if (inBox) return;
      if (e.key === "Enter") {
        e.preventDefault();
        submitP1();
      } else if (e.key.length === 1 || e.key === "Backspace") box?.focus();
    };

    window.addEventListener("keydown", onDown);
    return () => window.removeEventListener("keydown", onDown);
  }, [hooks, submitP1, closeOnline]);

  const g = gRef.current;
  const show = phase !== "setup" && g;
  const srcs: [string, string] = [me.avatar, botRef.current.avatar ?? `kokonut:${botRef.current.seed}`];
  const chibi: [boolean, boolean] = [me.has, false];
  const names: [string, string] = g ? [g.fighters[0].name, g.fighters[1].name] : ["P1", "P2"];
  const winner = g && g.winner !== -1 ? g.fighters[g.winner] : null;
  const p2Keys = g && !g.fighters[1].bot ? ["7", "8", "9", "0"] : ["1", "2", "3", "4"];
  const lock = g && g.mode === 2 && g.fighters[0].lock?.state === "live" ? g.fighters[0].lock : null;
  const focusH = g ? cardH(g.fighters[1].bot) : 80;
  // Kết quả trong sân: đấu máy đã có hộp kết quả riêng, chỉ hiện nút khi hộp đó đóng
  const showResult = phase === "over" && !!winner && !resultOpen;

  const typeBox = (cls?: string) =>
    g && <TypeBox g={g} f={g.fighters[0]} boxRef={boxRef} onType={typeP1} onSubmit={submitP1} className={cls} />;

  const resultCard = winner && (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-ink-400">{g!.mode === 3 ? "Về đích trước" : "Đối thủ hết máu"}</p>
      <h2 className="font-display text-4xl font-bold" style={{ color: P_COL[winner.id] }}>
        {winner.name} thắng
      </h2>
      <div className="flex gap-2">
        <Button variant="primary" onClick={start}>
          <RotateCcw className="size-4" /> Chơi lại
        </Button>
        <Button variant="ghost" onClick={() => setPhase("setup")}>
          Thiết lập mới
        </Button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-2 sm:px-6">
      <MatchIntro
        open={intro}
        title="Typing Battle"
        subtitle="Đấu trường gõ phím"
        players={[
          { name: me.username || "P1", avatar: me.avatar },
          { name: pendingOpp.current.name, avatar: pendingOpp.current.avatar ?? `kokonut:${pendingOpp.current.seed}` },
        ]}
        onDone={beginDuel}
      />
      <GameHeader
        game="typing"
        subtitle={phase === "setup" ? "Đấu trường gõ phím đối kháng" : mode === 2 ? "Băng chuyền thẻ" : mode === 1 ? "Đọ tên lửa" : "Đua gõ đoạn văn"}
      >
        <NarratorButton enabled={narrator.enabled} onClick={narrator.toggle} />
        {phase === "playing" && (
          <button type="button" onClick={forfeit} title="Xin thua (Esc)" className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs text-pop-red">
            <Flag className="size-3.5" /> Xin thua
          </button>
        )}
      </GameHeader>

      {phase === "setup" && (
        <TypingLobby
          mode={mode}
          setMode={setMode}
          opp={opp}
          setOpp={(o) => {
            setOpp(o);
            if (o === "local") setStake(0);
            if (o === "friend") setMode(3);
          }}
          diff={diff}
          setDiff={setDiff}
          stake={stake}
          setStake={setStake}
          onStart={(fr) => {
            friendRef.current = fr;
            if (opp === "friend" && fr) {
              const bo = { room: fr.betId, oppId: fr.id, name: fr.name, avatar: fr.avatar, stake: fr.stake };
              if (fr.inGame && rejoinTable(bo.room)) launchOnline(bo);
              else setLobby(bo);
              return;
            }
            start();
          }}
        />
      )}

      {/* Điện thoại: đối thủ trên, thẻ xếp dọc ở giữa, ô nhập luôn ở đáy */}
      {narrow && show && g && (
        <div className="flex min-h-[calc(100dvh-7rem)] flex-col gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-3">
          <div className="flex items-center justify-between gap-3 border-b border-ink-800 pb-3">
            <PlayerHud f={g.fighters[1]} mode={g.mode} src={srcs[1]} chibi={chibi[1]} label="Đối thủ" compact />
            {g.mode === 2 && <SkillSlots f={g.fighters[1]} keys={p2Keys} small />}
          </div>

          <div className="relative flex-1 space-y-2">
            {g.phase === "count" ? (
              <p className="py-16 text-center font-display text-7xl font-bold text-ink-100">{Math.max(1, Math.ceil(g.count))}</p>
            ) : showResult ? (
              <div className="py-10">{resultCard}</div>
            ) : g.mode === 2 ? (
              g.items
                .filter((i) => i.state === "live")
                .sort((a, b) => a.life - a.age - (b.life - b.age))
                .slice(0, 4)
                .map((it) => <ItemCard key={it.id} it={it} g={g} floating={false} />)
            ) : g.mode === 1 ? (
              <div className="rounded-xl border border-ink-700 bg-ink-900 p-6 text-center">
                <p className="font-mono text-4xl font-semibold tracking-wide text-ink-100">
                  <TypedWord text={g.fighters[0].word} done={g.fighters[0].buf.length} col={P_COL[0]} />
                </p>
                <p className="mt-2 text-xs text-ink-500">Đối thủ: {g.fighters[1].buf.length}/{g.fighters[1].word.length}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-ink-700 bg-ink-900 p-4">
                <CylinderText text={g.fighters[0].text} index={Math.min(g.fighters[0].text.length, g.fighters[0].idx + g.fighters[0].buf.length)} color={P_COL[0]} className="w-full" />
              </div>
            )}
            {g.phase === "over" && phase !== "over" && winner && (
              <p className="py-6 text-center font-display text-5xl font-bold" style={{ color: P_COL[winner.id] }}>K.O.</p>
            )}
          </div>

          {/* Chừa đáy cho cụm phòng/chat nổi của ứng dụng để không che ô nhập */}
          <div className="sticky bottom-0 -mx-3 space-y-2 rounded-b-2xl border-t border-ink-800 bg-ink-900 px-3 pb-20 pt-3">
            <div className="flex items-center justify-between gap-3">
              <PlayerHud f={g.fighters[0]} mode={g.mode} src={srcs[0]} chibi={chibi[0]} label="Bạn" compact />
              {g.mode === 2 && <SkillSlots f={g.fighters[0]} keys={["1", "2", "3", "4"]} small />}
            </div>
            {typeBox("w-full")}
          </div>
        </div>
      )}

      {/* Máy tính: sân đấu 1100×620 thu phóng theo bề ngang */}
      <div className={cn("mx-auto w-full max-w-[min(100%,calc((100dvh-8rem)*1.774))]", (phase === "setup" || narrow) && "hidden")}>
        <div
          ref={wrapRef}
          className="relative w-full overflow-hidden rounded-2xl border border-ink-800 bg-ink-900"
          style={{ aspectRatio: `${W}/${H}` }}
          onPointerDown={() => phase === "playing" && requestAnimationFrame(() => boxRef.current?.focus())}
        >
          <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
            {/* Canvas: nền, tên lửa, va chạm */}
            <canvas ref={canvasRef} width={W * FS} height={H * FS} className="absolute inset-0 size-full" />

            {show && g && !narrow && (
              <>
                {/* Hàng trên: đối thủ (lật gương) — HUD ở góc phải, ô kỹ năng ở góc trái */}
                <div className="absolute inset-x-5 top-4 z-20 flex h-[76px] flex-row-reverse items-center gap-4">
                  <PlayerHud f={g.fighters[1]} mode={g.mode} src={srcs[1]} chibi={chibi[1]} label={g.fighters[1].bot ? "Máy" : ""} mirror />
                  <span className="flex-1" />
                  {g.mode !== 3 && <TargetBox f={g.fighters[1]} mode={g.mode} className="w-[360px]" />}
                  {g.mode === 2 && <SkillSlots f={g.fighters[1]} keys={p2Keys} />}
                </div>

                {/* Hàng dưới: bạn — HUD ở góc trái, ô nhập và ô kỹ năng ở góc phải */}
                <div className="absolute inset-x-5 bottom-4 z-20 flex h-[76px] items-center gap-4">
                  <PlayerHud f={g.fighters[0]} mode={g.mode} src={srcs[0]} chibi={chibi[0]} label="Bạn" />
                  <span className="flex-1" />
                  {typeBox("w-[420px]")}
                  {g.mode === 2 && <SkillSlots f={g.fighters[0]} keys={["1", "2", "3", "4"]} />}
                </div>

                {/* Băng chuyền: thẻ chạy theo 3 làn cố định */}
                {g.mode === 2 && g.items.map((it) => <ItemCard key={it.id} it={it} g={g} />)}

                {/* True Focus: khung góc bám thẻ đang khoá, trượt sang thẻ mới khi đổi mục tiêu */}
                <AnimatePresence>
                  {lock && (
                    <motion.div
                      key="focus"
                      aria-hidden
                      className="pointer-events-none absolute left-0 top-0 z-30"
                      style={{ width: CARD_W + 12, height: focusH + 12 }}
                      initial={{ opacity: 0, x: lock.x - CARD_W / 2 - 6, y: lock.y - focusH / 2 - 6 }}
                      animate={{ opacity: 1, x: lock.x - CARD_W / 2 - 6, y: lock.y - focusH / 2 - 6 }}
                      exit={{ opacity: 0 }}
                      transition={{ x: { type: "spring", stiffness: 700, damping: 48 }, y: { type: "spring", stiffness: 700, damping: 48 }, opacity: { duration: 0.15 } }}
                    >
                      <FocusFrame className="size-3.5 border-info" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Đọ tên lửa: một từ chung trên mặt trụ */}
                {g.mode === 1 && (
                  <CylinderWords
                    words={g.seq}
                    active={g.seqI}
                    typed={[g.fighters[0].buf.length, g.fighters[1].buf.length]}
                    colors={[P_COL[0], P_COL[1]]}
                    className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-[760px] -translate-x-1/2 -translate-y-1/2"
                  />
                )}

                {/* Đua gõ đoạn văn */}
                {g.mode === 3 &&
                  g.fighters.map((f) => (
                    <RaceTrack
                      key={f.id}
                      f={f}
                      top={f.id === 1 ? 128 : 316}
                      lead={g.fighters[0].idx !== g.fighters[1].idx && g.fighters[0].idx > g.fighters[1].idx === !f.id}
                    />
                  ))}

                <AnimatePresence>
                  {g.banners.map((b) =>
                    b.kind === "fusion" ? <FusionBanner key={b.id} b={b} names={names} /> : <ActivateBanner key={b.id} b={b} names={names} />
                  )}
                </AnimatePresence>

                {/* Đếm ngược */}
                {g.phase === "count" && (
                  <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-ink-950/55">
                    <motion.span
                      key={Math.ceil(g.count)}
                      initial={{ scale: 1.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="font-display text-[132px] font-bold leading-none text-ink-100"
                    >
                      {Math.max(1, Math.ceil(g.count))}
                    </motion.span>
                  </div>
                )}
                {g.goT > 0 && (
                  <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center" style={{ opacity: Math.min(1, g.goT * 2.5) }}>
                    <span className="font-display text-[88px] font-bold tracking-tight text-ink-100">Bắt đầu</span>
                  </div>
                )}

                {g.phase === "over" && phase !== "over" && winner && <KoBanner winner={winner} />}
              </>
            )}

            {showResult && !narrow && <div className="absolute inset-0 z-50 grid place-items-center bg-ink-950/85">{resultCard}</div>}
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-ink-500">
          Enter gửi{mode === 2 && " · Enter khi ô trống: bắn · 1–4: kỹ năng"}
          {!vsBot && " · P2: nửa phải, 7–0, Shift phải"} · Esc thoát
        </p>
      </div>

      {lobby && <BetLobby bo={lobby} onStart={launchOnline} onLeave={() => setLobby(null)} />}
      <MatchResultModal
        isOpen={resultOpen && phase === "over"}
        onClose={() => setResultOpen(false)}
        onPlayAgain={() => setPhase("setup")}
        resultData={result}
        reason={g?.mode === 3 ? "Về đích đầu tiên" : "Hạ gục đối thủ bằng tên lửa"}
      />
    </div>
  );
}

const MODES: { value: Mode; icon: typeof Zap; name: string; desc: string }[] = [
  { value: 2, icon: Sparkles, name: "Băng chuyền thẻ", desc: "Gõ chữ trên vật phẩm lướt ngang để cướp về tay, gom 2 thẻ để hợp thể." },
  { value: 1, icon: Crosshair, name: "Đọ tên lửa", desc: "Gõ đúng từ khóa rồi Enter để phóng tên lửa, hạ đối thủ trước khi cạn máu." },
  { value: 3, icon: Trophy, name: "Đua gõ", desc: "Cùng gõ một đoạn văn, ai cán đích trước sẽ thắng." },
];

type OppKind = "bot" | "local" | "friend";
type FriendInfo = { id: string; name: string; avatar: string; betId: string; stake: number; inGame?: boolean };

const OPPS: { value: OppKind; icon: typeof Bot; name: string; desc: string }[] = [
  { value: "friend", icon: UserPlus, name: "Mời bạn", desc: "Gửi kèo qua chat, bạn nhận là vào bàn" },
  { value: "bot", icon: Bot, name: "Đấu máy", desc: "Tính điểm xếp hạng, có thể cược Lúa" },
  { value: "local", icon: Keyboard, name: "Cùng máy", desc: "Hai người chung một bàn phím" },
];

const DIFFS = [
  { value: 2, label: "Dễ" },
  { value: 3, label: "Vừa" },
  { value: 4, label: "Khó" },
];

function Seat({ avatar, name, label, status, accent, children }: { avatar?: string; name: string; label: string; status?: React.ReactNode; accent: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-ink-800 bg-ink-900 p-4">
      <div className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border-2 bg-ink-900" style={{ borderColor: accent }}>
        {avatar ? <UserAvatar src={avatar} name={name} className="size-full" /> : <span className="font-mono text-sm text-ink-500">?</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-500">{label}</p>
        <p className="truncate font-display text-base font-semibold text-ink-100">{name}</p>
        {status && <p className="mt-0.5 text-sm text-ink-400"><EmojiText>{status}</EmojiText></p>}
      </div>
      {children}
    </div>
  );
}

function TypingLobby({
  mode,
  setMode,
  opp,
  setOpp,
  diff,
  setDiff,
  stake,
  setStake,
  onStart,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  opp: OppKind;
  setOpp: (o: OppKind) => void;
  diff: number;
  setDiff: (d: number) => void;
  stake: number;
  setStake: (s: number) => void;
  onStart: (friend: FriendInfo | null) => void;
}) {
  const me = useAppStore(useShallow((s) => ({ id: s.currentUser.id, name: s.currentUser.username, avatar: s.currentUser.avatar, lua: s.currentUser.lua })));
  const bet = useAppStore((s) => {
    let found: import("@/lib/store").BetChallenge | null = null;
    for (const list of Object.values(s.messages)) for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i].betChallenge;
      if (b && b.gameType === "typing" && (b.creatorId === s.currentUser.id || b.opponentId === s.currentUser.id) && (b.status === "pending" || b.status === "accepted" || b.status === "in_game")) {
        if (!found || b.createdAt > found.createdAt) found = b;
        break;
      }
    }
    return found;
  });
  const createBet = useAppStore((s) => s.createBetChallenge);
  const cancelBet = useAppStore((s) => s.cancelBetChallenge);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (bet && opp === "friend" && bet.stake !== stake) setStake(bet.stake);
  }, [bet, opp, stake, setStake]);

  const friend =
    bet?.status === "accepted" || bet?.status === "in_game"
      ? bet.creatorId === me.id
        ? { id: bet.opponentId ?? "", name: bet.opponentName ?? "Bạn bè", avatar: bet.opponentAvatar ?? "", betId: bet.id, stake: bet.stake, inGame: bet.status === "in_game" }
        : { id: bet.creatorId, name: bet.creatorName, avatar: bet.creatorAvatar, betId: bet.id, stake: bet.stake, inGame: bet.status === "in_game" }
      : null;
  const pending = bet?.status === "pending" && bet.creatorId === me.id ? bet : null;
  const needsBot = mode === 1 && opp !== "bot";
  // Online chỉ có Đua gõ: mỗi máy tự gõ, hai bên chỉ trao đổi tiến độ.
  const needsRace = opp === "friend" && mode !== 3;
  const canStart = !needsBot && !needsRace && (opp !== "friend" || !!friend);
  const modeDef = MODES.find((m) => m.value === mode)!;

  const sendInvite = (to: InvitePerson | null) => {
    setErr(null);
    const e = sendBetInvite("typing", stake, to);
    if (e) setErr(e);
  };

  const oppSeat =
    opp === "bot" ? (
      <Seat avatar={`kokonut:${BOTS[0].seed}`} name="Đối thủ máy" label="Đối thủ" accent={P_COL[1]} status={`Cấp độ ${DIFFS.find((d) => d.value === diff)?.label ?? "Vừa"}`} />
    ) : opp === "local" ? (
      <Seat name="Người chơi 2" label="Đối thủ" accent={P_COL[1]} status="Nửa phải bàn phím · Shift phải để bắn" />
    ) : friend ? (
      <Seat avatar={friend.avatar} name={friend.name} label="Đối thủ" accent={P_COL[1]} status="Đã nhận kèo · vào phòng chờ để bắt đầu" />
    ) : pending ? (
      <Seat name="Đang chờ người nhận…" label="Đối thủ" accent={P_COL[1]} status={`Kèo ${pending.stake} 🌾 đã gửi vào chat`}>
        <Button size="sm" onClick={() => cancelBet(pending.id)}>
          <X className="size-3.5" /> Huỷ kèo
        </Button>
      </Seat>
    ) : (
      <Seat name="Chưa có ai" label="Đối thủ" accent="rgba(255,255,255,0.2)" status="Mời một người bạn vào bàn">
        <div className="w-56">
          <InviteSender onSend={sendInvite} label="Mời bạn" />
        </div>
      </Seat>
    );

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
      {/* Bàn đấu: đối thủ ở trên, bạn ở dưới */}
      <div className="panel flex flex-col p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">Bàn đấu</h2>
          <span className="font-mono text-xs uppercase tracking-widest text-ink-500">{modeDef.name}</span>
        </div>
        {oppSeat}
        <div className="my-3 flex items-center gap-3">
          <span className="h-px flex-1 bg-ink-700" />
          <span className="rounded-full border border-ink-700 px-3 py-1 font-mono text-xs uppercase tracking-widest text-ink-400">
            VS · <EmojiText>{stake > 0 ? `cược ${stake} 🌾` : "không cược"}</EmojiText>
          </span>
          <span className="h-px flex-1 bg-ink-700" />
        </div>
        <Seat avatar={me.avatar} name={me.name || "Bạn"} label="Bạn" accent={P_COL[0]} status="Gõ vào ô · Enter để gửi" />

        <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
          {MODES.map((m) => {
            const I = m.icon;
            const on = m.value === mode;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                aria-pressed={on}
                className={cn("flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-colors", on ? "border-ink-400 bg-ink-800" : "border-ink-700 bg-ink-900 hover:bg-ink-850")}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-ink-100">
                  <I className={cn("size-4", on ? "text-ink-100" : "text-ink-400")} /> {m.name}
                </span>
                <span className="text-xs leading-snug text-ink-300">{m.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Thiết lập phòng */}
      <div className="panel flex flex-col gap-5 p-5">
        <h2 className="font-display text-xl font-bold">Thiết lập</h2>

        <div>
          <span className="label">Đối thủ</span>
          <div className="grid gap-2">
            {OPPS.map((o) => {
              const I = o.icon;
              const on = o.value === opp;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    setErr(null);
                    setOpp(o.value);
                  }}
                  aria-pressed={on}
                  className={cn("flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors", on ? "border-ink-400 bg-ink-800" : "border-ink-700 hover:bg-ink-850")}
                >
                  <I className={cn("size-4 shrink-0", on ? "text-ink-100" : "text-ink-500")} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink-100">{o.name}</span>
                    <span className="block text-xs text-ink-300">{o.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {opp === "bot" && (
          <div>
            <span className="label">Độ khó</span>
            <Segmented value={diff} onChange={setDiff} options={DIFFS} />
          </div>
        )}

        {opp !== "local" ? (
          <StakePicker value={stake} onChange={(v) => { setErr(null); setStake(v); }} disabled={!!pending || !!friend} />
        ) : (
          <p className="text-xs text-ink-400">Chơi cùng máy không tính Lúa và xếp hạng.</p>
        )}
        {needsRace && <p className="text-xs text-ink-400">Chơi online với bạn bè hiện chỉ có chế độ "Đua gõ": chọn chế độ đó để tiếp tục.</p>}
        {needsBot && <p className="text-xs text-ink-400">Hai bên cùng gõ một từ nên cần cả bàn phím: chọn "Đấu máy" cho chế độ này.</p>}
        {err && <p role="alert" className="text-xs text-danger">{err}</p>}

        <div className="mt-auto space-y-2">
          <Button variant="solid" size="lg" disabled={!canStart} onClick={() => onStart(opp === "friend" ? friend : null)} className="w-full">
            <Play className="size-4" /> {needsRace ? "Mời bạn chỉ có Đua gõ" : needsBot ? "Đọ tên lửa cần đối thủ máy" : canStart ? "Vào bàn" : "Chờ đối thủ nhận kèo"}
          </Button>
          <p className="text-center text-xs text-ink-400">Esc trong ván để quay lại phòng chờ.</p>
        </div>
      </div>
    </div>
  );
}

export default TypingBattleGame;
