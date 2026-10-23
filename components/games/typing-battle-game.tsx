"use client";

import { memo, useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crosshair, Play, RotateCcw, Shield, Sparkles, Trophy, Zap } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/lib/store";
import { soundManager } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ChibiAvatar } from "@/components/character/chibi-avatar";
import {
  FUSIONS,
  FusionDef,
  HAND_HOLD,
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
} from "@/lib/games/typing-battle-engine";
import { MatchResultModal } from "./match-result-modal";
import { GameFxOverlay, MatchIntro, NarratorButton, useFxQueue, useNarrator } from "./game-fx";
import { GameHeader, Segmented, useMatchSettlement } from "./shared";
import type { AsciiRippleRef } from "@/components/reactbits";

/* --------------------------------- Hằng số --------------------------------- */

const P_COL = ["#38bdf8", "#f43f5e"] as const;
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

  // Nền tối sang trọng, chiều sâu cao cấp
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#050813");
  g.addColorStop(0.5, "#080d1e");
  g.addColorStop(1, "#04060f");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);

  // Vùng sáng trung tâm đấu trường
  const centerGlow = x.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 520);
  centerGlow.addColorStop(0, "rgba(30, 41, 59, 0.45)");
  centerGlow.addColorStop(0.6, "rgba(15, 23, 42, 0.2)");
  centerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  x.fillStyle = centerGlow;
  x.fillRect(0, 0, W, H);

  // Vành đấu trường trung tâm (vòng tròn đấu kỳ thủ)
  x.save();
  x.strokeStyle = "rgba(148, 163, 184, 0.05)";
  x.lineWidth = 1.5;
  x.beginPath();
  x.arc(W / 2, H / 2 + 10, 240, 0, Math.PI * 2);
  x.stroke();

  x.strokeStyle = "rgba(148, 163, 184, 0.03)";
  x.beginPath();
  x.arc(W / 2, H / 2 + 10, 310, 0, Math.PI * 2);
  x.stroke();

  // Dải sân của 2 đấu thủ: đối thủ phía trên, bạn phía dưới
  x.restore();
  for (const [y0, col] of [[0, "244, 63, 94"], [H - 130, "56, 189, 248"]] as const) {
    const bandGrad = x.createLinearGradient(0, y0, 0, y0 + 130);
    const top = y0 === 0;
    bandGrad.addColorStop(top ? 0 : 1, `rgba(${col}, 0.10)`);
    bandGrad.addColorStop(top ? 1 : 0, "rgba(0,0,0,0)");
    x.fillStyle = bandGrad;
    x.fillRect(0, y0, W, 130);
  }
  x.strokeStyle = "rgba(148, 163, 184, 0.08)";
  x.lineWidth = 1;
  for (const y of [130, H - 130]) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }

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

  // Hạt bụi năng lượng nền
  for (const L of stars) {
    for (const s of L) {
      ctx.fillStyle = `rgba(180, 200, 240, ${0.15 + 0.2 * Math.abs(Math.sin(clock * 1.2 + s.ph))})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
  }

  // 3 Làn băng chuyền chạy ngang qua màn hình
  ctx.save();
  for (const lane of LANES) {
    const y = lane.y;
    // Đường ray năng lượng chính
    ctx.strokeStyle = "rgba(148, 163, 184, 0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();

    // Vạch biên phát sáng nhẹ của làn
    ctx.strokeStyle = lane.dir > 0 ? "rgba(56, 189, 248, 0.12)" : "rgba(244, 63, 94, 0.12)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([12, 28]);
    ctx.lineDashOffset = -clock * 45 * lane.dir;
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
      ctx.shadowBlur = 10;
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
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r + (r.max - r.r) * Math.sqrt(k), 0, 6.283);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // Tên lửa chiến thuật tốc độ cao
  for (const m of g.missiles) {
    ctx.save();
    ctx.translate(m.x + Math.sin(m.ph) * 5, m.yy);
    ctx.rotate(m.dir * Math.PI / 2);

    const c = m.reflected ? "#c084fc" : m.big ? "#fde047" : m.owner === 0 ? "#38bdf8" : "#f43f5e";
    const k = m.big ? 1.4 : 1;
    ctx.scale(k, k);

    // Đuôi lửa plasma vệt dài
    const tr = ctx.createLinearGradient(-10, 0, -80, 0);
    tr.addColorStop(0, c);
    tr.addColorStop(0.5, c + "55");
    tr.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = tr;
    ctx.beginPath();
    ctx.moveTo(-8, -3.5);
    ctx.lineTo(-85, 0);
    ctx.lineTo(-8, 3.5);
    ctx.fill();

    // Thân tên lửa động năng
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.quadraticCurveTo(8, -5, -12, -4);
    ctx.lineTo(-12, 4);
    ctx.quadraticCurveTo(8, 5, 22, 0);
    ctx.fill();

    // Mũi nhọn
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(12, -3);
    ctx.lineTo(12, 3);
    ctx.fill();

    // Đốm sáng đầu mũi tên lửa
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(20, 0, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

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
    ctx.shadowBlur = 12;
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

  // Viền bóng mờ điện ảnh quanh 4 góc
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0, 0, 8, 0.65)");
  ctx.fillStyle = v;
  ctx.fillRect(-20, -20, W + 40, H + 40);
}

/* ------------------ Item chạy ngang giữa màn hình (Stream Capsule) ------------------ */

interface RunningItemProps {
  it: Item;
  g: Game;
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
        transform: `translate3d(${x - 98}px, ${y - 36}px, 0)`,
        width: 196,
        height: 72,
        zIndex: isP1Locked || isP2Locked ? 25 : 15,
        willChange: "transform",
      }}
    >
      {/* Vòng hào quang khi được người chơi khoá mục tiêu */}
      {(isP1Locked || isP2Locked) && (
        <span
          className="absolute -inset-1.5 rounded-2xl animate-pulse blur-sm"
          style={{
            background: isP1Locked && isP2Locked ? "#a855f7" : isP1Locked ? P_COL[0] : P_COL[1],
            opacity: 0.55,
          }}
        />
      )}

      {/* Thân capsule dạng thẻ pha lê công nghệ */}
      <div
        className={cn(
          "relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border px-3 py-2 shadow-2xl backdrop-blur-md transition-colors",
          isP1Locked
            ? "border-sky-400/80 bg-slate-900/95 ring-2 ring-sky-400/50"
            : isP2Locked
            ? "border-rose-400/80 bg-slate-900/95 ring-2 ring-rose-400/50"
            : "border-white/15 bg-slate-950/85"
        )}
        style={{
          boxShadow: isP1Locked
            ? "0 0 24px rgba(56,189,248,0.35)"
            : isP2Locked
            ? "0 0 24px rgba(244,63,94,0.35)"
            : `0 8px 24px -6px ${def.col}25`,
        }}
      >
        {/* Hàng trên: Icon + Tên vật phẩm + Dấu chỉ hướng chạy */}
        <div className="flex items-center justify-between text-[11px] leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-base drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">{def.icon}</span>
            <span className="font-sans font-bold tracking-wide text-slate-200">{def.name}</span>
          </div>
          <span
            className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-mono font-bold"
            style={{ color: def.col, backgroundColor: `${def.col}18` }}
          >
            {it.dir > 0 ? "▶" : "◀"} {Math.ceil(leftTime)}s
          </span>
        </div>

        {/* Chữ hiển thị cho P1 & P2 gõ tranh chấp */}
        <div className="my-0.5 flex flex-col justify-center gap-1 rounded-lg bg-black/45 px-2 py-1">
          {/* P1 Dòng chữ */}
          <div className="flex items-center justify-between font-mono text-[13px] leading-none">
            <div className="flex items-center gap-1 truncate">
              <span className="size-1.5 rounded-full shrink-0" style={{ background: P_COL[0] }} />
              <TypedWord
                text={it.disp[0]}
                bufLen={isP1Locked ? f0.buf.length : 0}
                activeCol={P_COL[0]}
                idleCol="#cbd5e1"
              />
            </div>
            {isP1Locked && <span className="text-[9px] font-bold text-sky-400">P1 KHÓA</span>}
          </div>

          {/* P2 Dòng chữ (nếu đấu 2 người hoặc bot) */}
          {(!f1.bot || isP2Locked) && (
            <div className="flex items-center justify-between font-mono text-[11px] leading-none opacity-85">
              <div className="flex items-center gap-1 truncate">
                <span className="size-1.5 rounded-full shrink-0" style={{ background: P_COL[1] }} />
                <TypedWord
                  text={it.disp[1]}
                  bufLen={isP2Locked ? f1.buf.length : 0}
                  activeCol={P_COL[1]}
                  idleCol="#94a3b8"
                />
              </div>
              {isP2Locked && <span className="text-[9px] font-bold text-rose-400">P2 KHÓA</span>}
            </div>
          )}
        </div>

        {/* Thanh đếm ngược thời gian chạy qua màn hình */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800/80">
          <div
            className="h-full rounded-full transition-[width] duration-100 ease-linear"
            style={{
              width: `${timePct}%`,
              background: timePct < 25 ? "#f43f5e" : def.col,
              boxShadow: `0 0 6px ${def.col}`,
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
              color: done ? "#34d399" : idleCol,
              textShadow: done
                ? "0 0 10px rgba(52, 211, 153, 0.8), 0 0 2px rgba(255, 255, 255, 0.9)"
                : "none",
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
  const frac = mode === 3 ? (f.text.length ? f.idx / f.text.length : 0) : f.hp / (f.maxHp || 1);
  const ghost = mode === 3 ? frac : f.ghost / (f.maxHp || 1);
  const hpCol =
    frac > 0.5 ? "from-emerald-400 to-teal-500" : frac > 0.25 ? "from-amber-400 to-orange-500" : "from-rose-500 to-red-600";
  const shove = f.fireN > 0 ? (isP1 ? "-translate-y-2" : "translate-y-2") : "";

  const badges: [string, string][] = [];
  if (f.armor > 0) badges.push([`🛡 ${Math.ceil(f.armor)}`, "#7dd3fc"]);
  if (f.reflectT > 0) badges.push([`🔄 ${f.reflectT.toFixed(1)}s`, "#d8b4fe"]);
  if (f.lifeT > 0) badges.push([`🩸 ${f.lifeT.toFixed(1)}s`, "#6ee7b7"]);
  if (f.slowT > 0) badges.push(["🐌 Chậm", "#fcd34d"]);
  if (f.freezeT > 0) badges.push(["❄️ Băng", "#a5f3fc"]);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-5 z-20 grid h-[112px] grid-cols-[1fr_auto_1fr] items-center gap-4 select-none",
        isP1 ? "bottom-3" : "top-3"
      )}
    >
      {/* Trái: tên + thanh máu + trạng thái */}
      <div
        className={cn("rounded-2xl border bg-slate-950/85 px-3 py-2.5 backdrop-blur-md", f.err > 0 && "ring-2 ring-rose-500/70")}
        style={{ borderColor: col + "44" }}
      >
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-bold" style={{ color: col }}>
            {f.name} <span className="font-normal text-slate-500">{isP1 ? "· P1" : "· P2"}</span>
          </span>
          <span className="font-mono text-xs font-bold text-white">
            {mode === 3 ? `${Math.round(frac * 100)}%` : `${Math.ceil(f.hp)}`}
          </span>
        </div>
        <div className="relative mt-1.5 h-3 overflow-hidden rounded-full border border-white/10 bg-slate-900">
          <div className="absolute inset-y-0 left-0 bg-white/40 transition-[width] duration-300" style={{ width: `${Math.max(frac, ghost) * 100}%` }} />
          <div className={cn("absolute inset-y-0 left-0 bg-gradient-to-r transition-[width] duration-150", hpCol)} style={{ width: `${frac * 100}%` }} />
          {f.armor > 0 && (
            <div className="absolute inset-y-0 left-0 bg-sky-400/70" style={{ width: `${Math.min(100, (f.armor / f.maxHp) * 100)}%` }} />
          )}
        </div>
        <div className="mt-1.5 flex min-h-[18px] flex-wrap items-center gap-1 text-[10px] font-semibold">
          {badges.map(([t, c]) => (
            <span key={t} className="rounded-full border border-white/10 bg-black/40 px-1.5 py-0.5" style={{ color: c }}>
              {t}
            </span>
          ))}
          {f.combo > 1 && <span className="text-amber-300">COMBO ×{f.combo}</span>}
          {mode === 2 && f.ammo > 0 && <span className="text-amber-300">🚀 ×{f.ammo}</span>}
        </div>
      </div>

      {/* Giữa: avatar (đúng trục bắn tên lửa) */}
      <div className={cn("relative transition-transform duration-200", shove, f.hitN > 0 && "brightness-150")}>
        <span className="absolute -inset-3 rounded-full opacity-30 blur-xl" style={{ background: col }} />
        <div
          className="relative grid size-[96px] place-items-center overflow-hidden rounded-2xl border-2 bg-slate-950/80"
          style={{ borderColor: col + "99", boxShadow: `0 0 22px ${col}44` }}
        >
          {chibi ? <ChibiAvatar size={90} animate={false} /> : <UserAvatar src={src} name={f.name} className="size-[88px]" />}
          {f.freezeT > 0 && <span className="absolute inset-0 grid place-items-center bg-cyan-400/30 text-3xl">❄️</span>}
        </div>
      </div>

      {/* Phải: kho thẻ + ô gõ */}
      <div className="rounded-2xl border bg-slate-950/85 px-3 py-2.5 backdrop-blur-md" style={{ borderColor: col + "33" }}>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase text-slate-500">Thẻ</span>
          {f.hand.length === 0 ? (
            <span className="text-[10px] italic text-slate-600">trống</span>
          ) : (
            f.hand.map((c, i) => {
              const def = ITEMS[c.type];
              const partner = f.hand.some((o, oi) => oi !== i && findFusion(o.type, c.type));
              return (
                <div
                  key={`${c.type}-${i}`}
                  className={cn("relative grid size-7 place-items-center rounded-md border text-xs", partner && "ring-2 ring-amber-400")}
                  style={{ borderColor: def.col, backgroundColor: `${def.col}22` }}
                  title={`${def.name} · tự kích hoạt sau ${c.t.toFixed(1)}s`}
                >
                  {def.icon}
                  <div className="absolute inset-x-0 bottom-0 h-0.5 bg-black/60">
                    <div className="h-full bg-white" style={{ width: `${(c.t / HAND_HOLD) * 100}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
        {mode === 1 && (
          <div className="mt-1.5 rounded-lg bg-black/50 px-2 py-1 text-center font-mono text-sm font-bold tracking-widest">
            {Array.from(f.word).map((ch, i) => (
              <span key={i} style={{ color: i < f.buf.length ? "#34d399" : "#94a3b8" }}>
                {ch}
              </span>
            ))}
          </div>
        )}
        {mode === 2 && (
          <div className="mt-1.5 flex items-center justify-between rounded-lg bg-black/50 px-2 py-1 font-mono text-sm">
            <span className="truncate font-bold text-white">{f.freezeT > 0 ? "❄️ Bị đóng băng" : f.buf || <span className="opacity-30">▍</span>}</span>
            <span className="ml-2 shrink-0 text-[9px] text-amber-300">{isP1 ? "SPACE" : f.bot ? "" : "ENTER"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------ Banner Hợp Thể & Kích Hoạt Tinh Tế ------------------ */

function FusionBanner({ b, names }: { b: Banner; names: [string, string] }) {
  const fu = b.fusion!;
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-50 grid place-items-center overflow-hidden bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      <motion.div
        className="relative flex flex-col items-center rounded-3xl border border-white/20 bg-slate-950/95 px-8 py-6 shadow-2xl"
        style={{
          boxShadow: `0 0 50px ${fu.col}55`,
        }}
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
          <span className="text-4xl drop-shadow-[0_0_16px_rgba(255,255,255,0.7)]">{fu.icon}</span>
          <span className="font-display text-4xl font-extrabold uppercase text-white tracking-wide drop-shadow-[0_0_24px_rgba(168,85,247,0.7)]">{fu.name}</span>
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
        className="flex items-center gap-2.5 rounded-full border border-white/20 bg-slate-950/90 px-4 py-1.5 shadow-xl backdrop-blur-md"
        style={{ boxShadow: `0 0 20px ${def.col}44` }}
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
      className="absolute left-16 right-16 rounded-2xl border bg-slate-950/85 p-4 backdrop-blur-md shadow-xl"
      style={{
        top,
        height: 165,
        borderColor: col + "44",
        boxShadow: `0 4px 20px -4px ${col}25`,
      }}
    >
      <div className="flex items-center justify-between text-xs font-bold">
        <span style={{ color: col }}>
          {f.name} {active ? "★ DẪN ĐẦU" : ""}
        </span>
        <span className="font-mono text-slate-400">LỖI: {f.errors}</span>
      </div>

      <div className="relative my-3 h-2 w-full rounded-full bg-slate-900 border border-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-150"
          style={{ width: `${pct * 100}%`, background: col, boxShadow: `0 0 10px ${col}` }}
        />
        <span
          className="absolute -top-3.5 -translate-x-1/2 size-7 rounded-full border-2 border-white bg-slate-900 overflow-hidden shadow-lg"
          style={{ left: `${pct * 100}%` }}
        >
          {chibi ? <ChibiAvatar size={26} animate={false} /> : <UserAvatar src={src} name={f.name} className="size-full" />}
        </span>
      </div>

      <div className="font-mono text-sm leading-relaxed tracking-wider text-slate-400 line-clamp-3 select-none">
        {Array.from(f.text).map((ch, i) => (
          <span
            key={i}
            className={cn(i === f.idx && "rounded bg-sky-400 px-[1px] text-black font-bold")}
            style={{
              color: i < f.idx ? "#34d399" : i === f.idx ? "#000000" : "#64748b",
            }}
          >
            {ch}
          </span>
        ))}
      </div>
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
  const vsBot = false;
  const diff = 3;
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
  const botRef = useRef(BOTS[0]);
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

  const pendingOpp = useRef(BOTS[0]);
  const start = useCallback(() => {
    pendingOpp.current = vsBot ? BOTS[Math.floor(Math.random() * BOTS.length)] : { name: "P2", seed: "player two:0", title: "Đấu Thủ" };
    setIntro(true);
    sayRef.current(`${me.username || "Người chơi một"} đối đầu ${pendingOpp.current.name}!`);
  }, [vsBot, me.username]);

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

      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      const ch = e.key.toLowerCase();
      if (LEFT_KEYS.includes(ch)) {
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
  const opp = botRef.current;
  const srcs: [string, string] = [me.avatar, `kokonut:${opp.seed}`];
  const chibi: [boolean, boolean] = [me.has, false];
  const names: [string, string] = g ? [g.fighters[0].name, g.fighters[1].name] : ["P1", "P2"];
  const winner = g && g.winner !== -1 ? g.fighters[g.winner] : null;

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-2">
      <GameFxOverlay fx={fx.current} onDone={fx.pop} />
      <MatchIntro
        open={intro}
        title="Typing Battle"
        subtitle="Đấu trường gõ phím"
        players={[
          { name: me.username || "P1", avatar: me.avatar },
          { name: pendingOpp.current.name, avatar: `kokonut:${pendingOpp.current.seed}` },
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


      {phase === "setup" && <TypingLobby mode={mode} setMode={setMode} onStart={start} />}

      <div className={cn("mx-auto w-full max-w-[min(100%,calc((100dvh-8.5rem)*1.774))]", phase === "setup" && "hidden")}>
        <div
          ref={wrapRef}
          className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[#050813] shadow-2xl"
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
                  <div className="absolute inset-0 z-40 grid place-items-center bg-black/60 backdrop-blur-[2px]">
                    <motion.div
                      key={Math.ceil(g.count)}
                      initial={{ scale: 1.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      <span className="font-display text-[140px] font-black text-white drop-shadow-[0_0_35px_rgba(255,255,255,0.8)]">{String(Math.max(1, Math.ceil(g.count)))}</span>
                    </motion.div>
                  </div>
                )}

                {g.goT > 0 && (
                  <div
                    className="pointer-events-none absolute inset-0 z-40 grid place-items-center"
                    style={{ opacity: Math.min(1, g.goT * 2.5) }}
                  >
                    <span className="font-display text-[110px] font-black text-emerald-400 drop-shadow-[0_0_40px_#34d399]">BẮT ĐẦU!</span>
                  </div>
                )}

                {g.phase === "over" && (
                  <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-black/45 backdrop-blur-[2px]">
                    <span className="font-display text-[130px] font-black" style={{
                        color: winner ? P_COL[winner.id] : "#f43f5e",
                        textShadow: "0 0 45px currentColor",
                      }}>K. O.</span>
                  </div>
                )}
              </>
            )}


            {/* MÀN HÌNH KẾT QUẢ KHI KẾT THÚC VÁN */}
            {phase === "over" && winner && (
              <div className="absolute inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-md">
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
                        textShadow: `0 0 28px ${P_COL[winner.id]}`,
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

        <p className="mt-2.5 text-center text-xs text-slate-400 font-sans">
          P1: Nửa trái bàn phím + <kbd className="rounded bg-slate-800 px-1 py-0.5 border border-slate-700">Space</kbd> bắn · 
          P2: Nửa phải bàn phím + <kbd className="rounded bg-slate-800 px-1 py-0.5 border border-slate-700">Enter</kbd> bắn · 
          <kbd className="rounded bg-slate-800 px-1 py-0.5 border border-slate-700 ml-1">Esc</kbd> về thiết lập
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

function TypingLobby({ mode, setMode, onStart }: { mode: Mode; setMode: (m: Mode) => void; onStart: () => void }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <div className="panel p-6">
        <h2 className="font-display text-2xl font-extrabold">3 chế độ — ai nhanh tay hơn?</h2>
        <p className="mt-1 text-sm text-ink-300">Hai kỳ thủ cùng một bàn phím, mỗi người một nửa. Gõ chuẩn để ra đòn, hợp thể kỹ năng và hạ gục đối thủ.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {MODES.map((m) => {
            const I = m.icon;
            const on = m.value === mode;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={cn("flex flex-col items-start gap-2 rounded-3xl border p-4 text-left transition-colors", on ? "border-white bg-white/[0.08]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]")}
              >
                <span className={cn("grid size-10 place-items-center rounded-2xl", on ? "bg-white text-black" : "bg-white/10 text-white")}>
                  <I className="size-5" />
                </span>
                <span className="font-display text-base font-bold">{m.name}</span>
                <span className="text-xs text-ink-300">{m.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="panel space-y-5 p-6">
        <h2 className="font-display text-xl font-extrabold">Tạo phòng đấu</h2>
        <div>
          <span className="label">Chế độ</span>
          <Segmented value={mode} onChange={setMode} options={MODES.map((m) => ({ value: m.value, label: m.name }))} />
        </div>
        <ul className="space-y-1.5 text-xs text-ink-300">
          <li>• P1 gõ nửa trái bàn phím, bắn bằng Space.</li>
          <li>• P2 gõ nửa phải bàn phím, bắn bằng Enter.</li>
          <li>• Esc để quay về phòng chờ.</li>
          <li>• Hiệu ứng hợp thể, giọng dẫn và màn VS như Ma Sói.</li>
        </ul>
        <button type="button" onClick={onStart} className="btn-lime w-full py-3">
          <Play className="size-4" /> Vào đấu
        </button>
      </div>
    </div>
  );
}

export default TypingBattleGame;
