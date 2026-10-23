"use client";

import { memo, useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Crosshair, Keyboard, Play, RotateCcw, Send, Sparkles, Trophy, UserPlus, X, Zap } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/lib/store";
import { soundManager } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ChibiAvatar } from "@/components/character/chibi-avatar";
import {
  FUSIONS,
  FusionDef,
  HAND_MAX,
  ITEMS,
  ItemType,
  LEFT_KEYS,
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
  keyOf,
  onFire,
  onKey,
  update,
  castSkill,
} from "@/lib/games/typing-battle-engine";
import { MatchResultModal } from "./match-result-modal";
import { GameFxOverlay, MatchIntro, NarratorButton, useFxQueue, useNarrator } from "./game-fx";
import { GameHeader, Segmented, StakePicker, useMatchSettlement } from "./shared";
import type { AsciiRippleRef } from "@/components/reactbits";
import { BorderBeam, BlurText, CylinderText, CylinderWords } from "@/components/reactbits";

/* --------------------------------- Hằng số --------------------------------- */

const P_COL = ["#7aa2f7", "#e27d85"] as const;
const P_GLOW = ["rgba(56,189,248,0.45)", "rgba(244,63,94,0.45)"] as const;
const BOTS = [
  { name: "Linh HR", seed: "linh hr:1", title: "Kỳ Thủ Văn Phòng" },
  { name: "Tuấn Dev", seed: "tuan dev:2", title: "Kỹ Sư Bậc Thầy" },
  { name: "Sếp Tổng", seed: "sep tong:3", title: "Đại Kiện Tướng" },
];
const FS = 1.5;

/* --------------------------------- Canvas --------------------------------- */

function makeBackdrop() {
  const c = document.createElement("canvas");
  c.width = W * FS;
  c.height = H * FS;
  const x = c.getContext("2d")!;
  x.scale(FS, FS);

  // Nền phẳng, tối giản
  x.fillStyle = "#08090d";
  x.fillRect(0, 0, W, H);

  // Lưới chấm mảnh
  x.fillStyle = "rgba(255,255,255,0.05)";
  for (let gx = 20; gx < W; gx += 40) for (let gy = 20; gy < H; gy += 40) x.fillRect(gx, gy, 1.5, 1.5);

  // Đường phân chia sân
  x.strokeStyle = "rgba(255,255,255,0.07)";
  x.lineWidth = 1;
  for (const y of [116, H - 92]) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
  x.beginPath(); x.moveTo(W / 2, 116); x.lineTo(W / 2, H - 92); x.setLineDash([2, 8]); x.stroke(); x.setLineDash([]);

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

  // 3 Làn băng chuyền chạy ngang qua màn hình
  ctx.save();
  for (const lane of LANES) {
    const y = lane.y;
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 10]);
    ctx.lineDashOffset = -clock * 24 * lane.dir;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

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
    const c = m.reflected ? "#c4a0f0" : m.big ? "#f0d870" : m.owner === 0 ? "#7aa2f7" : "#e27d85";
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

/* ------------------ Item chạy ngang giữa màn hình (Stream Capsule) ------------------ */

interface RunningItemProps {
  it: Item;
  g: Game;
}

/** Cụm từ đang gõ: phần đã gõ sáng, con trỏ ở ký tự kế tiếp, phần còn lại mờ. */
function TypedPhrase({ text, done, active, col }: { text: string; done: number; active: boolean; col: string }) {
  let seen = 0;
  return (
    <>
      {Array.from(text).map((ch, i) => {
        if (ch === " ") return <span key={i} className="inline-block w-2" />;
        const isDone = seen < done;
        const isCur = active && seen === done;
        seen++;
        return (
          <span
            key={i}
            className={cn(isCur && "border-b-2 animate-pulse")}
            style={{ color: isDone ? col : isCur ? "#f1f5f9" : "#64748b", borderColor: isCur ? col : undefined }}
          >
            {ch}
          </span>
        );
      })}
    </>
  );
}

function RunningItemCapsule({ it, g }: RunningItemProps) {
  const [f0, f1] = g.fighters;
  const def = ITEMS[it.type];
  const isP1Locked = f0.lock === it;
  const isP2Locked = f1.lock === it;
  const taken = it.state === "taken";
  const expired = it.state === "expired";
  const target = taken && it.by >= 0 ? g.fighters[it.by as 0 | 1] : null;

  const leftTime = Math.max(0, it.life - it.age);
  const timePct = Math.min(100, Math.max(0, (leftTime / it.life) * 100));

  // Tọa độ nội suy mượt 60fps từ engine
  const x = it.x;
  const y = it.y;

  return (
    <div
      className={cn(
        "absolute select-none pointer-events-none transition-opacity duration-200",
        expired && "opacity-0 scale-90",
        taken && "opacity-0 scale-50 transition-all duration-300"
      )}
      style={{
        transform: `translate3d(${x - 124}px, ${y - 40}px, 0)`,
        width: 248,
        height: 80,
        zIndex: isP1Locked || isP2Locked ? 25 : 15,
        willChange: "transform",
      }}
    >
      {/* Thân capsule dạng thẻ pha lê công nghệ */}
      <div
        className={cn(
          "relative flex h-full flex-col justify-between overflow-hidden rounded-xl border px-3.5 py-2 transition-colors",
          isP1Locked
            ? "border-[#7aa2f7]/70 bg-[#10131c]"
            : isP2Locked
            ? "border-[#e27d85]/70 bg-[#10131c]"
            : "border-white/[0.08] bg-[#0c0e14]/95"
        )}
      >
        {(isP1Locked || isP2Locked) && (
          <BorderBeam size={90} duration={3} borderWidth={2} colorFrom={isP1Locked ? P_COL[0] : P_COL[1]} colorTo="transparent" />
        )}
        {/* Hàng trên: Icon + Tên vật phẩm + Dấu chỉ hướng chạy */}
        <div className="flex items-center justify-between text-[13px] leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-lg grayscale">{def.icon}</span>
            <span className="font-sans font-bold tracking-wide text-slate-100">{def.name}</span>
          </div>
          <span
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[12px] font-mono text-slate-400"
          >
            {it.dir > 0 ? "▶" : "◀"} {Math.ceil(leftTime)}s
          </span>
        </div>

        {/* Chữ hiển thị cho P1 & P2 gõ tranh chấp */}
        <div className="my-0.5 flex flex-col justify-center gap-1 rounded-lg bg-white/[0.04] px-2 py-1">
          {/* P1 Dòng chữ */}
          <div className="flex items-center justify-between font-mono text-[17px] font-semibold leading-none">
            <div className="flex items-center gap-1 truncate">
              <span className="size-1.5 rounded-full shrink-0" style={{ background: P_COL[0] }} />
              <TypedWord
                text={it.disp[0]}
                bufLen={isP1Locked ? f0.buf.length : 0}
                activeCol={P_COL[0]}
                idleCol="#cbd5e1"
              />
            </div>
            {isP1Locked && <span className="text-[11px] font-bold text-[#7aa2f7]">ĐANG GÕ</span>}
          </div>

          {/* P2 Dòng chữ (nếu đấu 2 người hoặc bot) */}
          {(!f1.bot || isP2Locked) && (
            <div className="flex items-center justify-between font-mono text-[14px] leading-none opacity-85">
              <div className="flex items-center gap-1 truncate">
                <span className="size-1.5 rounded-full shrink-0" style={{ background: P_COL[1] }} />
                <TypedWord
                  text={it.disp[1]}
                  bufLen={isP2Locked ? f1.buf.length : 0}
                  activeCol={P_COL[1]}
                  idleCol="#94a3b8"
                />
              </div>
              {isP2Locked && <span className="text-[11px] font-bold text-[#e27d85]">ĐANG GÕ</span>}
            </div>
          )}
        </div>

        {/* Thanh đếm ngược thời gian chạy qua màn hình */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800/80">
          <div
            className="h-full rounded-full transition-[width] duration-100 ease-linear"
            style={{
              width: `${timePct}%`,
              background: timePct < 25 ? "#d95b5b" : "#94a3b8",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function TypedWord({
  text,
  bufLen,
  activeCol,
  idleCol,
}: {
  text: string;
  bufLen: number;
  activeCol: string;
  idleCol: string;
}) {
  let seen = 0;
  return (
    <span className="tracking-[0.16em] font-medium font-mono">
      {Array.from(text).map((ch, i) => {
        if (ch === " ") return <span key={i} className="inline-block w-1.5">&nbsp;</span>;
        const done = seen < bufLen;
        const isCurrent = seen === bufLen;
        seen++;
        return (
          <span
            key={i}
            className={cn(
              "transition-colors duration-100",
              isCurrent && "border-b-2 border-white animate-pulse font-bold"
            )}
            style={{
              color: done ? "#6ee7b7" : idleCol,
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}

/* --------------------- Bệ đấu kỳ thủ đối diện trực tiếp (Duel Stations) --------------------- */

interface DuelistStationProps {
  f: Fighter;
  opponent: Fighter;
  isP1: boolean;
  src: string;
  chibi: boolean;
  mode: Mode;
}

function DuelistStation({
  f,
  isP1,
  src,
  chibi,
  mode,
}: DuelistStationProps) {
  const col = P_COL[f.id];
  const frac = Math.max(0, Math.min(1, mode === 3 ? (f.text.length ? f.idx / f.text.length : 0) : f.hp / (f.maxHp || 1)));
  const ghost = Math.max(frac, mode === 3 ? frac : f.ghost / (f.maxHp || 1));
  const ringCol = mode === 3 || frac > 0.5 ? col : frac > 0.25 ? "#d4a24c" : "#d95b5b";
  const shove = f.fireN > 0 ? (isP1 ? "-translate-y-1.5" : "translate-y-1.5") : "";

  // Góc nhìn: đối thủ ở trên lớn hơn, phe ta ở dưới luôn nhỏ gọn hơn
  const big = !isP1;
  const S = big ? 92 : 62;
  const R = (S - 5) / 2;
  const C = 2 * Math.PI * R;

  const badges: string[] = [];
  if (f.armor > 0) badges.push(`GIÁP ${Math.ceil(f.armor)}`);
  if (f.reflectT > 0) badges.push(`PHẢN ${f.reflectT.toFixed(1)}s`);
  if (f.lifeT > 0) badges.push(`HÚT ${f.lifeT.toFixed(1)}s`);
  if (f.slowT > 0) badges.push("CHẬM");
  if (f.freezeT > 0) badges.push("BĂNG");
  if (f.combo > 1) badges.push(`COMBO ×${f.combo}`);

  const fireKey = isP1 ? "SPACE" : "ENTER";
  const slotKeys = isP1 ? ["1", "2", "3", "4"] : ["7", "8", "9", "0"];
  const panel = cn("relative rounded-xl border border-white/[0.08] bg-[#0c0e14]/90", big ? "px-4 py-3" : "px-3 py-2");

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-5 z-20 flex items-center select-none",
        isP1 ? "bottom-3 h-[88px] gap-3" : "top-3 h-[100px] flex-row-reverse gap-4"
      )}
    >
      {/* Avatar + vòng máu */}
      <div className={cn("relative shrink-0 transition-transform duration-200", shove, f.hitN > 0 && "brightness-150")} style={{ width: S, height: S }}>
        <svg className="absolute inset-0 -rotate-90" width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
          <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
          <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={4} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ghost)} className="transition-[stroke-dashoffset] duration-300" />
          <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke={ringCol} strokeWidth={4} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} className="transition-[stroke-dashoffset] duration-150" />
        </svg>
        <div className={cn("absolute inset-[7px] grid place-items-center overflow-hidden rounded-full bg-[#0c0e14]", f.err > 0 && "ring-2 ring-rose-400/70")}>
          {chibi ? <ChibiAvatar size={S - 14} animate={false} /> : <UserAvatar src={src} name={f.name} className="size-full" />}
          {f.freezeT > 0 && <span className="absolute inset-0 bg-cyan-200/25" />}
        </div>
      </div>

      {/* Tên, máu (số), trạng thái */}
      <div className={cn("min-w-0 flex-1", !isP1 && "text-right")}>
        <div className={cn("flex items-baseline gap-2", !isP1 && "justify-end")}>
          <span className={cn("truncate font-semibold text-slate-100", big ? "text-base" : "text-sm")}>{f.name}</span>
          <span className="font-mono text-xs uppercase tracking-widest text-slate-500">{isP1 ? "P1" : "P2"}</span>
        </div>
        <div className={cn("font-mono font-semibold tabular-nums", big ? "text-xl" : "text-base")} style={{ color: ringCol }}>
          {mode === 3 ? `${Math.round(frac * 100)}%` : Math.ceil(f.hp)}
        </div>
        <div className={cn("mt-1 flex min-h-[20px] flex-wrap items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-slate-400", !isP1 && "justify-end")}>
          {badges.map((t) => (
            <span key={t} className="rounded border border-white/10 px-1.5 py-0.5">{t}</span>
          ))}
        </div>
      </div>

      {mode === 2 && (
        <div className={cn(panel, "shrink-0", big ? "w-[390px]" : "w-[340px]")}>
          {mode === 2 && (
            <div className="flex items-center gap-2">
              {Array.from({ length: HAND_MAX }, (_, i) => {
                const c = f.hand[i];
                const def = c ? ITEMS[c.type] : null;
                const partner = !!c && f.hand.some((o, oi) => oi !== i && findFusion(o.type, c.type));
                return (
                  <div
                    key={i}
                    className={cn(
                      "relative grid place-items-center rounded-lg border bg-white/[0.03]",
                      big ? "size-11 text-lg" : "size-9 text-base",
                      c ? "border-white/20" : "border-dashed border-white/10",
                      partner && "border-amber-300/80"
                    )}
                    title={def ? `${def.name}: ${def.desc}` : "Ô kỹ năng trống"}
                  >
                    <span className="absolute left-1 top-0 font-mono text-xs text-slate-500">{slotKeys[i]}</span>
                    {def && <span className={cn("mt-1", !partner && "grayscale")}>{def.icon}</span>}
                  </div>
                );
              })}
              <span className="ml-auto font-mono text-xs uppercase tracking-wider text-slate-400">
                ĐẠN <span className={cn("text-sm", f.ammo > 0 ? "text-amber-300" : "text-slate-600")}>×{f.ammo}</span>
              </span>
            </div>
          )}
          {mode === 2 && (
            <div
              className={cn("mt-2 flex items-center justify-between rounded-lg border border-white/[0.08] bg-black/30 px-3 font-mono text-base", big ? "py-1.5" : "py-1")}
              style={f.lock ? { borderColor: col + "88" } : undefined}
            >
              <span className="truncate text-lg font-medium tracking-[0.14em]">
                {f.freezeT > 0 ? (
                  <span className="text-sm text-slate-300">bị đóng băng</span>
                ) : f.lock ? (
                  <TypedPhrase text={f.lock.disp[f.id]} done={f.buf.length} active col={col} />
                ) : (
                  <span className="text-xs tracking-normal text-slate-500">gõ chữ cái đầu để chọn thẻ</span>
                )}
              </span>
              <kbd className={cn("ml-2 shrink-0 rounded border px-1.5 py-0.5 text-xs", f.ammo > 0 ? "border-amber-300/60 text-amber-300" : "border-white/15 text-slate-500")}>{fireKey}</kbd>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Ô input của một người chơi trong Đọ tên lửa: hiện chữ đã gõ so với từ chung. */
function WordInput({ f, className }: { f: Fighter; className?: string }) {
  const col = P_COL[f.id];
  const ok = f.buf.length === f.word.length && f.buf === f.word;
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-1/2 z-20 flex h-[52px] w-[380px] -translate-x-1/2 items-center justify-between rounded-xl border bg-[#0c0e14]/90 px-4 font-mono text-xl tracking-[0.2em] transition-colors",
        f.err > 0 ? "border-rose-400/70" : "border-white/[0.1]",
        className
      )}
      style={ok ? { borderColor: col } : undefined}
    >
      <span className="flex min-w-0 items-center gap-1 truncate">
        <span className="size-2 shrink-0 rounded-full" style={{ background: col }} />
        <span style={{ color: ok ? col : "#f1f5f9" }}>{f.buf}</span>
        <span className="animate-pulse text-slate-600">▍</span>
      </span>
      <kbd className={cn("ml-2 shrink-0 rounded border px-1.5 py-0.5 text-xs tracking-normal", ok ? "border-amber-300/60 text-amber-300" : "border-white/15 text-slate-500")}>
        {f.id === 0 ? "SPACE" : "ENTER"}
      </kbd>
    </div>
  );
}

/* ------------------ Banner Hợp Thể & Kích Hoạt Tinh Tế ------------------ */

function FusionBanner({ b, names }: { b: Banner; names: [string, string] }) {
  const fu = b.fusion!;
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-50 grid place-items-center overflow-hidden bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      <motion.div
        className="relative flex flex-col items-center rounded-2xl border border-white/15 bg-[#0c0e14] px-8 py-6"
        initial={{ scale: 0.7, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 190, damping: 16 }}
      >
        <span
          className="text-xs font-mono font-bold uppercase tracking-[0.3em]"
          style={{ color: fu.col }}
        >
          KỸ NĂNG HỢP THỂ CHIẾN LƯỢC · {names[b.owner]}
        </span>

        <div className="my-3 flex items-center gap-3">
          <span className="text-4xl grayscale">{fu.icon}</span>
          <BlurText text={fu.name} step={0.12} className="font-display text-4xl font-extrabold uppercase text-white tracking-wide" />
        </div>

        <p className="max-w-[340px] text-center text-xs leading-relaxed text-slate-300">{fu.desc}</p>
      </motion.div>
    </motion.div>
  );
}

function ActivateBanner({ b, names }: { b: Banner; names: [string, string] }) {
  const def = ITEMS[b.type!];
  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 top-16 z-40 flex justify-center"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15, transition: { duration: 0.2 } }}
    >
      <div
        className="flex items-center gap-2.5 rounded-full border border-white/15 bg-[#0c0e14] px-4 py-1.5"
      >
        <span className="text-lg">{def.icon}</span>
        <span className="font-sans text-xs font-bold text-white tracking-wide">
          <span style={{ color: P_COL[b.owner] }}>{names[b.owner]}</span> kích hoạt{" "}
          <span className="inline text-amber-300">{def.name}</span>!
        </span>
      </div>
    </motion.div>
  );
}

/* ------------------------- Mode 3: Đua Gõ Đoạn Văn ------------------------- */

function RaceTrack({
  f,
  top,
  src,
  chibi,
  active,
}: {
  f: Fighter;
  top: number;
  src: string;
  chibi: boolean;
  active: boolean;
}) {
  const col = P_COL[f.id];
  const pct = f.text.length ? f.idx / f.text.length : 0;

  return (
    <div
      className="absolute left-16 right-16 rounded-xl border border-white/[0.08] bg-[#0c0e14]/95 px-6 py-3.5"
      style={{ top, height: 165 }}
    >
      <span className="absolute inset-y-3 left-0 w-[3px] rounded-r" style={{ background: col }} />
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-100">
          {f.name}
          {active && <span className="ml-2 font-mono text-xs font-normal uppercase tracking-widest" style={{ color: col }}>dẫn đầu</span>}
        </span>
        <span className="font-mono text-xs uppercase tracking-widest text-slate-500">
          {Math.round(pct * 100)}% · lỗi {f.errors}
        </span>
      </div>

      <div className="relative mb-1 mt-2.5 h-1 w-full rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${pct * 100}%`, background: col }} />
        <span
          className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border bg-[#0c0e14]"
          style={{ left: `${pct * 100}%`, borderColor: col }}
        >
          {chibi ? <ChibiAvatar size={18} animate={false} /> : <UserAvatar src={src} name={f.name} className="size-full" />}
        </span>
      </div>

      <CylinderText text={f.text} index={f.idx} color={col} className="mt-1.5 w-full" />
    </div>
  );
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
  // Mặc định chọn chế độ 2: Tranh thẻ & Băng chuyền chữ chạy ngang theo yêu cầu người dùng
  const [mode, setMode] = useState<Mode>(2);
  const [opp, setOpp] = useState<OppKind>("bot");
  const vsBot = opp === "bot";
  const [diff, setDiff] = useState(3);
  const [stake, setStake] = useState(0);
  const [scale, setScale] = useState(1);
  const [intro, setIntro] = useState(false);
  const fx = useFxQueue();
  const narrator = useNarrator();
  const pushFxRef = useRef(fx.push);
  pushFxRef.current = fx.push;
  const sayRef = useRef(narrator.say);
  sayRef.current = narrator.say;
  const [, force] = useReducer((x: number) => x + 1, 0);

  const gRef = useRef<Game | null>(null);
  const botRef = useRef<{ name: string; seed: string; title: string; avatar?: string }>(BOTS[0]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const asciiRef = useRef<AsciiRippleRef>(null);
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
      if (n === "count") sayRef.current("Chuẩn bị!");
      else if (n === "go") sayRef.current("Bắt đầu gõ!");
      else if (n === "fuse") {
        pushFxRef.current({ title: "HỢP THỂ", subtitle: "Kỹ năng hợp nhất được kích hoạt", tone: "gold", icon: "⚡" });
        sayRef.current("Hợp thể!");
      } else if (n === "win") {
        pushFxRef.current({ title: "HẠ GỤC!", subtitle: "Trận đấu kết thúc", tone: "red", icon: "💥" });
        sayRef.current("Hạ gục! Trận đấu kết thúc.");
      }
      if (n === "hit") asciiRef.current?.triggerRipple(0.5, 0.5, 2.0);
      else if (n === "fuse") asciiRef.current?.triggerRipple(0.5, 0.5, 2.5);
      else if (n === "win") asciiRef.current?.triggerRipple(0.5, 0.5, 3.0);
      else if (n === "fire") asciiRef.current?.triggerRipple(0.25, 0.7, 1.2);
      else if (n === "collect") asciiRef.current?.triggerRipple(0.5, 0.35, 1.5);
      else if (n === "go") asciiRef.current?.triggerRipple(0.5, 0.5, 2.0);

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
  }, []);

  const pendingOpp = useRef<{ name: string; seed: string; title: string; avatar?: string }>(BOTS[0]);
  const friendRef = useRef<{ name: string; avatar: string } | null>(null);
  const start = useCallback(() => {
    const fr = friendRef.current;
    pendingOpp.current = vsBot
      ? BOTS[Math.floor(Math.random() * BOTS.length)]
      : opp === "friend" && fr
      ? { name: fr.name, seed: fr.name, title: "Bạn bè", avatar: fr.avatar }
      : { name: "P2", seed: "player two:0", title: "Đấu Thủ" };
    setIntro(true);
    sayRef.current(`${me.username || "Người chơi một"} đối đầu ${pendingOpp.current.name}!`);
  }, [vsBot, opp, me.username]);

  // After the VS intro, the duel actually begins.
  const beginDuel = useCallback(() => {
    setIntro(false);
    const opp = pendingOpp.current;
    botRef.current = opp;
    gRef.current = createGame({ mode, vsBot, diff, names: [me.username || "P1", opp.name] });
    resetSettlement();
    setPhase("playing");
  }, [mode, vsBot, diff, me.username, resetSettlement]);

  // Vòng lặp cập nhật engine + vẽ canvas mượt mà 60fps
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
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      acc += dt;

      for (const L of stars) {
        for (const s of L) {
          s.x -= s.v * dt;
          if (s.x < 0) {
            s.x = W;
            s.y = Math.random() * H;
          }
        }
      }

      const g = gRef.current;
      if (g && phaseRef.current === "playing") {
        update(g, dt, hooks);
        if (g.phase === "over" && !ended) {
          ended = true;
          const w = g.winner;
          setTimeout(() => {
            if (cfgRef.current.vsBot && w >= 0) {
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

      // Cập nhật DOM ở tần số mượt mà ~60Hz
      if (acc > 0.016) {
        acc = 0;
        force();
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hooks]);

  // Bàn phím: P1 gõ phím bên trái + Space, P2 gõ phím bên phải + Enter
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input,textarea,select,[contenteditable='true']")) return;
      const g = gRef.current;
      if (phaseRef.current === "playing" && e.key === "Escape") {
        setPhase("setup");
        return;
      }
      if (!g || phaseRef.current !== "playing" || g.phase === "over") return;

      if (e.code === "Space") {
        e.preventDefault();
        onFire(g, g.fighters[0], hooks);
        asciiRef.current?.triggerRipple(0.2, 0.75, 1.8);
        force();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (!g.fighters[1].bot) {
          onFire(g, g.fighters[1], hooks);
          asciiRef.current?.triggerRipple(0.8, 0.75, 1.8);
        }
        force();
        return;
      }

      if (g.mode === 2 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const s1 = "1234".indexOf(e.key);
        const s2 = "7890".indexOf(e.key);
        if (e.key.length === 1 && s1 >= 0) { castSkill(g, g.fighters[0], s1, hooks); force(); return; }
        if (e.key.length === 1 && s2 >= 0 && !g.fighters[1].bot) { castSkill(g, g.fighters[1], s2, hooks); force(); return; }
      }

      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      const ch = e.key.toLowerCase();
      if (g.mode === 1) {
        // Đọ tên lửa: một từ chung, người chơi thật gõ bằng cả bàn phím
        if (!/^[a-z]$/.test(ch)) return;
        onKey(g, g.fighters[0], ch, hooks);
      } else if (LEFT_KEYS.includes(ch)) {
        onKey(g, g.fighters[0], ch, hooks);
        asciiRef.current?.triggerRipple(0.18, 0.75, 0.7);
      } else if (RIGHT_KEYS.includes(ch) && !g.fighters[1].bot) {
        onKey(g, g.fighters[1], ch, hooks);
        asciiRef.current?.triggerRipple(0.82, 0.75, 0.7);
      } else return;
      force();
    };

    window.addEventListener("keydown", onDown);
    return () => window.removeEventListener("keydown", onDown);
  }, [hooks]);

  const g = gRef.current;
  const show = phase !== "setup" && g;
  const srcs: [string, string] = [me.avatar, botRef.current.avatar ?? `kokonut:${botRef.current.seed}`];
  const chibi: [boolean, boolean] = [me.has, false];
  const names: [string, string] = g ? [g.fighters[0].name, g.fighters[1].name] : ["P1", "P2"];
  const winner = g && g.winner !== -1 ? g.fighters[g.winner] : null;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 py-2">
      <GameFxOverlay fx={fx.current} onDone={fx.pop} />
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
        subtitle={
          phase === "setup"
            ? "Đấu trường gõ phím đối kháng trực diện"
            : mode === 2
            ? "Băng chuyền vật phẩm · Khóa mục tiêu & Hợp thể"
            : mode === 1
            ? "Đọ tên lửa động năng · 5000 HP"
            : "Đua gõ đoạn văn"
        }
      >
        <NarratorButton enabled={narrator.enabled} onClick={narrator.toggle} />
      </GameHeader>


      {phase === "setup" && (
        <TypingLobby
          mode={mode}
          setMode={setMode}
          opp={opp}
          setOpp={(o) => {
            setOpp(o);
            if (o === "local") setStake(0);
          }}
          diff={diff}
          setDiff={setDiff}
          stake={stake}
          setStake={setStake}
          onStart={(fr) => {
            friendRef.current = fr;
            start();
          }}
        />
      )}

      <div className={cn("mx-auto w-full max-w-[min(100%,calc((100dvh-7rem)*1.774))]", phase === "setup" && "hidden")}>
        <div
          ref={wrapRef}
          className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#08090d]"
          style={{ aspectRatio: `${W}/${H}` }}
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ width: W, height: H, transform: `scale(${scale})` }}
          >

            {/* Canvas kết xuất hiệu ứng nền, tia laser, tên lửa, va chạm */}
            <canvas ref={canvasRef} width={W * FS} height={H * FS} className="absolute inset-0 size-full" />

            {show && g && (
              <>
                {/* 1. HAI BÊN KỲ THỦ ĐỨNG ĐỐI DIỆN TRỰC TIẾP (NHƯ ĐÁNH CỜ) */}
                <DuelistStation
                  f={g.fighters[0]}
                  opponent={g.fighters[1]}
                  isP1={true}
                  src={srcs[0]}
                  chibi={chibi[0]}
                  mode={g.mode}
                />
                <DuelistStation
                  f={g.fighters[1]}
                  opponent={g.fighters[0]}
                  isP1={false}
                  src={srcs[1]}
                  chibi={chibi[1]}
                  mode={g.mode}
                />

                {/* 2. Ở GIỮA: CÁC ITEM CHẠY NGANG QUA MÀN HÌNH VỚI HIỆU ỨNG MƯỢT (MODE 2) */}
                {g.mode === 2 && (
                  <>

                    {g.items.map((it) => (
                      <RunningItemCapsule key={it.id} it={it} g={g} />
                    ))}
                  </>
                )}

                {/* Mode 1: một từ dùng chung trên mặt trụ 3D, mỗi bên một ô input */}
                {g.mode === 1 && (
                  <>
                    <CylinderWords
                      words={g.seq}
                      active={g.seqI}
                      typed={[g.fighters[0].buf.length, g.fighters[1].buf.length]}
                      colors={[P_COL[0], P_COL[1]]}
                      className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-[760px] -translate-x-1/2 -translate-y-1/2"
                    />
                    {g.fighters.map((f) => (
                      <WordInput key={f.id} f={f} className={f.id === 1 ? "top-[126px]" : "bottom-[126px]"} />
                    ))}
                  </>
                )}

                {/* 3. MODE 3: ĐUA ĐOẠN VĂN */}
                {g.mode === 3 &&
                  g.fighters.map((f) => (
                    <RaceTrack
                      key={f.id}
                      f={f}
                      top={f.id === 1 ? 138 : 318}
                      src={srcs[f.id]}
                      chibi={chibi[f.id]}
                      active={
                        g.fighters[0].idx !== g.fighters[1].idx &&
                        g.fighters[0].idx > g.fighters[1].idx === !f.id
                      }
                    />
                  ))}

                {/* 4. BANNER HỢP THỂ & KÍCH HOẠT */}
                <AnimatePresence>
                  {g.banners.map((b) =>
                    b.kind === "fusion" ? (
                      <FusionBanner key={b.id} b={b} names={names} />
                    ) : (
                      <ActivateBanner key={b.id} b={b} names={names} />
                    )
                  )}
                </AnimatePresence>

                {/* 5. ĐẾM NGƯỢC BẮT ĐẦU */}
                {g.phase === "count" && (
                  <div className="absolute inset-0 z-40 grid place-items-center bg-black/55">
                    <motion.div
                      key={Math.ceil(g.count)}
                      initial={{ scale: 1.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      <span className="font-display text-[140px] font-bold text-white">{String(Math.max(1, Math.ceil(g.count)))}</span>
                    </motion.div>
                  </div>
                )}

                {g.goT > 0 && (
                  <div
                    className="pointer-events-none absolute inset-0 z-40 grid place-items-center"
                    style={{ opacity: Math.min(1, g.goT * 2.5) }}
                  >
                    <span className="font-display text-[96px] font-bold tracking-tight text-white">Bắt đầu</span>
                  </div>
                )}

                {g.phase === "over" && (
                  <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-black/50">
                    <span className="font-display text-[110px] font-bold tracking-tight" style={{ color: winner ? P_COL[winner.id] : "#e27d85" }}>K.O.</span>
                  </div>
                )}
              </>
            )}


            {/* MÀN HÌNH KẾT QUẢ KHI KẾT THÚC VÁN */}
            {phase === "over" && winner && (
              <div className="absolute inset-0 z-50 grid place-items-center bg-black/85">
                <div className="text-center space-y-4">
                  <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300 shadow-xl">
                    <Trophy className="size-8" />
                  </div>
                  <div>
                    <p className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400">
                      {g!.mode === 3 ? "Về đích chuẩn xác nhất" : "Đối thủ đã cạn kiệt HP"}
                    </p>
                    <h2
                      className="mt-1 font-display text-4xl font-extrabold"
                      style={{
                        color: P_COL[winner.id],
                        
                      }}
                    >
                      {winner.name.toUpperCase()} THẮNG CUỘC
                    </h2>
                  </div>

                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-xs font-bold text-black shadow-lg transition-all hover:bg-slate-200"
                      onClick={start}
                    >
                      <RotateCcw className="size-3.5" /> Chơi Lại
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl border border-white/20 bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition-all hover:bg-slate-800"
                      onClick={() => setPhase("setup")}
                    >
                      Thiết Lập Mới
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-sm text-slate-400">
          <span>P1: nửa trái · skill 1-4 · <kbd className="rounded-md border border-white/15 bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-slate-200">Space</kbd> bắn đạn</span>
          <span>P2: nửa phải · skill 7-0 · <kbd className="rounded-md border border-white/15 bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-slate-200">Enter</kbd> bắn đạn</span>
          <span><kbd className="rounded-md border border-white/15 bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-slate-200">Esc</kbd> về thiết lập</span>
        </p>
      </div>

      <MatchResultModal
        isOpen={resultOpen && phase === "over"}
        onClose={() => setResultOpen(false)}
        onPlayAgain={() => setPhase("setup")}
        resultData={result}
        reason={g?.mode === 3 ? "Về đích đầu tiên" : "Hạ gục đối thủ bằng tên lửa động năng"}
      />
    </div>
  );
}

const MODES: { value: Mode; icon: typeof Zap; name: string; desc: string }[] = [
  { value: 2, icon: Sparkles, name: "Băng chuyền thẻ", desc: "Gõ chữ trên vật phẩm lướt ngang để cướp về tay, gom 2 thẻ để hợp thể." },
  { value: 1, icon: Crosshair, name: "Đọ tên lửa", desc: "Gõ đúng từ khóa để nạp tên lửa, bấm phím bắn hạ đối thủ trước khi cạn máu." },
  { value: 3, icon: Trophy, name: "Đua gõ", desc: "Cùng gõ một đoạn văn, ai cán đích trước sẽ thắng." },
];

type OppKind = "bot" | "local" | "friend";

const OPPS: { value: OppKind; icon: typeof Bot; name: string; desc: string }[] = [
  { value: "bot", icon: Bot, name: "Đấu máy", desc: "Tính điểm xếp hạng, có thể cược Lúa" },
  { value: "local", icon: Keyboard, name: "Cùng máy", desc: "Hai người chung một bàn phím" },
  { value: "friend", icon: UserPlus, name: "Mời bạn", desc: "Gửi kèo qua chat, bạn nhận là vào bàn" },
];

const DIFFS = [
  { value: 2, label: "Dễ" },
  { value: 3, label: "Vừa" },
  { value: 4, label: "Khó" },
];

function Seat({ avatar, name, label, status, accent, children }: { avatar?: string; name: string; label: string; status?: React.ReactNode; accent: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border-2 bg-[#0c0e14]" style={{ borderColor: accent }}>
        {avatar ? <UserAvatar src={avatar} name={name} className="size-full" /> : <span className="font-mono text-sm text-slate-500">?</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs uppercase tracking-widest text-slate-500">{label}</p>
        <p className="truncate text-base font-semibold text-slate-100">{name}</p>
        {status && <p className="mt-0.5 text-sm text-slate-400">{status}</p>}
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
  onStart: (friend: { name: string; avatar: string } | null) => void;
}) {
  const me = useAppStore(useShallow((s) => ({ id: s.currentUser.id, name: s.currentUser.username, avatar: s.currentUser.avatar, lua: s.currentUser.lua })));
  const bet = useAppStore((s) => {
    const list = s.messages["lounge"] ?? [];
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i].betChallenge;
      if (b && b.gameType === "typing" && (b.creatorId === s.currentUser.id || b.opponentId === s.currentUser.id) && (b.status === "pending" || b.status === "accepted")) return b;
    }
    return null;
  });
  const createBet = useAppStore((s) => s.createBetChallenge);
  const cancelBet = useAppStore((s) => s.cancelBetChallenge);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (bet && opp === "friend" && bet.stake !== stake) setStake(bet.stake);
  }, [bet, opp, stake, setStake]);

  const friend =
    bet?.status === "accepted"
      ? bet.creatorId === me.id
        ? { name: bet.opponentName ?? "Bạn bè", avatar: bet.opponentAvatar ?? "" }
        : { name: bet.creatorName, avatar: bet.creatorAvatar }
      : null;
  const pending = bet?.status === "pending" && bet.creatorId === me.id ? bet : null;
  const needsBot = mode === 1 && opp !== "bot";
  const canStart = !needsBot && (opp !== "friend" || !!friend);
  const modeDef = MODES.find((m) => m.value === mode)!;

  const sendInvite = () => {
    setErr(null);
    if (stake < 10) return setErr("Chọn mức cược từ 50 Lúa để gửi kèo.");
    if (stake > me.lua) return setErr("Số dư không đủ để cược.");
    if (!createBet("lounge", "typing", stake)) return setErr("Không thể gửi kèo. Kiểm tra lại số dư.");
    const st = useAppStore.getState();
    st.setActiveChannel("lounge");
    st.toggleChat(true);
  };

  const oppSeat =
    opp === "bot" ? (
      <Seat avatar={`kokonut:${BOTS[0].seed}`} name="Đối thủ máy" label="Đối thủ" accent={P_COL[1]} status={`Cấp độ ${DIFFS.find((d) => d.value === diff)?.label ?? "Vừa"}`} />
    ) : opp === "local" ? (
      <Seat name="Người chơi 2" label="Đối thủ" accent={P_COL[1]} status="Nửa phải bàn phím · Enter để bắn" />
    ) : friend ? (
      <Seat avatar={friend.avatar} name={friend.name} label="Đối thủ" accent={P_COL[1]} status="Đã nhận kèo, sẵn sàng" />
    ) : pending ? (
      <Seat name="Đang chờ người nhận…" label="Đối thủ" accent={P_COL[1]} status={`Kèo ${pending.stake} 🌾 đã gửi vào chat`}>
        <button type="button" onClick={() => cancelBet(pending.id)} className="btn-ghost px-3 py-1.5 text-sm">
          <X className="size-3.5" /> Huỷ kèo
        </button>
      </Seat>
    ) : (
      <Seat name="Chưa có ai" label="Đối thủ" accent="rgba(255,255,255,0.2)" status="Mời một người bạn vào bàn">
        <button type="button" onClick={sendInvite} className="btn-accent px-3 py-1.5 text-sm">
          <Send className="size-3.5" /> Mời bạn
        </button>
      </Seat>
    );

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
      {/* Bàn đấu: đối thủ ở trên, bạn ở dưới */}
      <div className="panel flex flex-col p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">Bàn đấu</h2>
          <span className="font-mono text-xs uppercase tracking-widest text-slate-500">{modeDef.name}</span>
        </div>
        {oppSeat}
        <div className="my-3 flex items-center gap-3">
          <span className="h-px flex-1 bg-white/10" />
          <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-xs uppercase tracking-widest text-slate-400">
            VS · {stake > 0 ? `cược ${stake} 🌾` : "không cược"}
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <Seat avatar={me.avatar} name={me.name || "Bạn"} label="Bạn" accent={P_COL[0]} status="Nửa trái bàn phím · Space để bắn" />

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
                className={cn("flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-colors", on ? "border-white/50 bg-white/[0.07]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]")}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <I className={cn("size-4", on ? "text-white" : "text-slate-400")} /> {m.name}
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
                  className={cn("flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors", on ? "border-white/50 bg-white/[0.07]" : "border-white/10 hover:bg-white/[0.04]")}
                >
                  <I className={cn("size-4 shrink-0", on ? "text-white" : "text-slate-500")} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-100">{o.name}</span>
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
        {needsBot && <p className="text-xs text-ink-400">Hai bên cùng gõ một từ nên cần cả bàn phím: chọn "Đấu máy" cho chế độ này.</p>}
        {err && <p role="alert" className="text-xs text-danger">{err}</p>}

        <div className="mt-auto space-y-2">
          <button type="button" disabled={!canStart} onClick={() => onStart(opp === "friend" ? friend : null)} className="btn-lime w-full py-3 disabled:opacity-50">
            <Play className="size-4" /> {needsBot ? "Đọ tên lửa cần đối thủ máy" : canStart ? "Vào bàn" : "Chờ đối thủ nhận kèo"}
          </button>
          <p className="text-center text-xs text-ink-400">Esc trong ván để quay lại phòng chờ.</p>
        </div>
      </div>
    </div>
  );
}

export default TypingBattleGame;
