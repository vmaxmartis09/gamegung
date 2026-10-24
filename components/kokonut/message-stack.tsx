"use client";

/**
 * Ported from KokonutUI Notification Stack
 * @author: @dorianbaffier
 * @version: 1.1.0
 * @license: MIT — Copyright (c) KokonutUI (https://kokonutui.com)
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Adapted for Office Arena chat bubbles: items are controlled by the parent
 * (new messages arrive live), cards are measured as they mount, a tap opens
 * the conversation, a sideways swipe dismisses. Indigo/lime palette.
 */

import { getReducedMotion } from "@/lib/motion";
import { X } from "lucide-react";
import { type PointerEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface StackMessage {
  id: string;
  title: string;
  body: string;
  time: string;
  icon?: ReactNode;
}

const PEEK = 9;
const VISIBLE_BEHIND = 2;
const GAP = 8;
const FALLBACK_HEIGHT = 68;
const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 0.11;
const AXIS_LOCK = 6;
const SPRING_STIFFNESS = 520;
const SPRING_DAMPING = 2 * Math.sqrt(SPRING_STIFFNESS);
const FLIGHT_MIN_SPEED = 1400;
const FLIGHT_ACCEL = 4200;
const VELOCITY_WINDOW_MS = 80;

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  dx: number;
  axis: "x" | "y" | null;
  samples: { t: number; x: number }[];
}

const opacityFor = (x: number) => Math.max(1 - Math.abs(x) / 240, 0.3);

function releaseVelocity(samples: { t: number; x: number }[]) {
  const last = samples.at(-1);
  if (!last) return 0;
  let first = last;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (last.t - samples[i].t > VELOCITY_WINDOW_MS) break;
    first = samples[i];
  }
  const dt = last.t - first.t;
  return dt > 0 ? (last.x - first.x) / dt : 0;
}

function dismissDirection(dx: number, velocity: number): 1 | -1 | 0 {
  const flick = Math.abs(velocity) > DISMISS_VELOCITY && Math.sign(velocity) === Math.sign(dx);
  if (Math.abs(dx) < DISMISS_DISTANCE && !flick) return 0;
  return (dx === 0 ? velocity : dx) > 0 ? 1 : -1;
}

const reducedMotion = getReducedMotion;

export default function MessageStack({
  items,
  onOpen,
  onDismiss,
  className,
}: {
  /** Newest first. */
  items: StackMessage[];
  onOpen: (id: string) => void;
  onDismiss: (id: string) => void;
  className?: string;
}) {
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [hovered, setHovered] = useState(false);
  const [leaving, setLeaving] = useState<Set<string>>(() => new Set());
  const swipeRefs = useRef(new Map<string, HTMLDivElement>());
  const observer = useRef<ResizeObserver | null>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const swipeX = useRef(new Map<string, number>());
  const frames = useRef(new Map<string, number>());
  const dismissed = useRef(new Set<string>());

  useEffect(() => {
    observer.current = new ResizeObserver((entries) => {
      setHeights((prev) => {
        let next = prev;
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.id;
          const hgt = Math.round(e.borderBoxSize[0]?.blockSize ?? (e.target as HTMLElement).offsetHeight);
          if (id && hgt && prev[id] !== hgt) {
            next = next === prev ? { ...prev } : next;
            next[id] = hgt;
          }
        }
        return next;
      });
    });
    const running = frames.current;
    return () => {
      observer.current?.disconnect();
      running.forEach((f) => cancelAnimationFrame(f));
    };
  }, []);

  const measureRef = useCallback((node: HTMLLIElement | null) => {
    if (node) observer.current?.observe(node);
  }, []);

  const laidOut = items.filter((i) => !leaving.has(i.id));
  const expanded = hovered && laidOut.length > 1;
  const heightOf = (id: string) => heights[id] ?? FALLBACK_HEIGHT;
  const frontHeight = laidOut[0] ? heightOf(laidOut[0].id) : 0;
  const stackHeight = expanded
    ? laidOut.reduce((s, i) => s + heightOf(i.id), 0) + Math.max(laidOut.length - 1, 0) * GAP
    : frontHeight + Math.min(laidOut.length - 1, VISIBLE_BEHIND) * PEEK;
  const offsets: number[] = [];
  let running = 0;
  for (const it of laidOut) {
    offsets.push(running);
    running += heightOf(it.id) + GAP;
  }

  const stopFrame = (id: string) => {
    const f = frames.current.get(id);
    if (f !== undefined) {
      cancelAnimationFrame(f);
      frames.current.delete(id);
    }
  };
  const paint = (id: string, x: number) => {
    swipeX.current.set(id, x);
    const node = swipeRefs.current.get(id);
    if (node) {
      node.style.transition = "none";
      node.style.transform = x === 0 ? "" : `translateX(${x}px)`;
      node.style.opacity = x === 0 ? "" : `${opacityFor(x)}`;
    }
  };
  const run = (id: string, step: (dt: number) => boolean, onDone?: () => void) => {
    stopFrame(id);
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      if (step(dt)) {
        frames.current.delete(id);
        onDone?.();
        return;
      }
      frames.current.set(id, requestAnimationFrame(tick));
    };
    frames.current.set(id, requestAnimationFrame(tick));
  };
  const snapBack = (id: string, velocity: number) => {
    let x = swipeX.current.get(id) ?? 0;
    let v = velocity * 1000;
    if (reducedMotion()) return paint(id, 0);
    run(id, (dt) => {
      v += (-SPRING_STIFFNESS * x - SPRING_DAMPING * v) * dt;
      x += v * dt;
      if (Math.abs(x) < 0.5 && Math.abs(v) < 10) {
        paint(id, 0);
        return true;
      }
      paint(id, x);
      return false;
    });
  };
  const finish = (id: string) => {
    swipeX.current.delete(id);
    dismissed.current.delete(id);
    setLeaving((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    onDismiss(id);
  };
  const dismiss = (id: string, direction: 1 | -1, velocity = 0) => {
    if (dismissed.current.has(id)) return;
    dismissed.current.add(id);
    setLeaving((prev) => new Set(prev).add(id));
    const node = swipeRefs.current.get(id);
    if (!node || reducedMotion()) return finish(id);
    const distance = node.offsetWidth * 1.1;
    let x = swipeX.current.get(id) ?? 0;
    let speed = Math.max(Math.abs(velocity) * 1000, FLIGHT_MIN_SPEED);
    run(
      id,
      (dt) => {
        speed += FLIGHT_ACCEL * dt;
        x += direction * speed * dt;
        const done = Math.abs(x) >= distance;
        paint(id, done ? direction * distance : x);
        node.style.opacity = `${Math.max(1 - Math.abs(x) / distance, 0)}`;
        return done;
      },
      () => finish(id)
    );
  };

  const onDown = (e: PointerEvent<HTMLDivElement>, index: number, id: string) => {
    if (drag.current || leaving.has(id) || (!expanded && index > 0)) return;
    suppressClick.current = false;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    stopFrame(id);
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, originX: swipeX.current.get(id) ?? 0, dx: 0, axis: null, samples: [] };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>, id: string) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (d.axis === null) {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "x") {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
      }
    }
    if (d.axis !== "x") return;
    d.dx = d.originX + dx;
    d.samples.push({ t: e.timeStamp, x: d.dx });
    if (d.samples.length > 12) d.samples.shift();
    paint(id, d.dx);
  };
  const onUp = (e: PointerEvent<HTMLDivElement>, id: string) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (d.axis !== "x") {
      if (swipeX.current.get(id)) snapBack(id, 0);
      return;
    }
    suppressClick.current = true;
    const v = releaseVelocity(d.samples);
    const dir = dismissDirection(d.dx, v);
    if (dir === 0) snapBack(id, v);
    else dismiss(id, dir, Math.sign(v) === dir ? v : 0);
  };

  if (!items.length) return null;

  return (
    <div
      className={cn("w-[min(84vw,320px)]", className)}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
    >
      <ol aria-label="Tin nhắn mới" className="relative transition-[height] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]" style={{ height: stackHeight }}>
        {items.map((item) => {
          const index = laidOut.findIndex((c) => c.id === item.id);
          const isLeaving = index === -1;
          const depth = Math.max(index, 0);
          const hiddenBehind = !(expanded || depth <= VISIBLE_BEHIND);
          const scale = expanded || isLeaving ? 1 : 1 - depth * 0.05;
          // Bottom-anchored: newest sits lowest, near the chat bubble.
          const y = expanded ? stackHeight - offsets[depth] - heightOf(item.id) : stackHeight - frontHeight - depth * PEEK;
          return (
            <li
              key={item.id}
              ref={measureRef}
              data-id={item.id}
              className="absolute inset-x-0 top-0 origin-top transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
              style={{ transform: `translateY(${y}px) scale(${scale})`, opacity: hiddenBehind ? 0 : 1, zIndex: items.length - depth, pointerEvents: hiddenBehind ? "none" : undefined }}
            >
              <div
                className="touch-pan-y"
                onPointerDown={(e) => onDown(e, depth, item.id)}
                onPointerMove={(e) => onMove(e, item.id)}
                onPointerUp={(e) => onUp(e, item.id)}
                onPointerCancel={(e) => onUp(e, item.id)}
                ref={(node) => {
                  if (node) swipeRefs.current.set(item.id, node);
                  else swipeRefs.current.delete(item.id);
                }}
              >
                <article
                  aria-label={`${item.title}: ${item.body}`}
                  tabIndex={hiddenBehind ? -1 : 0}
                  onClick={() => {
                    if (suppressClick.current) {
                      suppressClick.current = false;
                      return;
                    }
                    onOpen(item.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOpen(item.id);
                    if (e.key === "Delete" || e.key === "Backspace") dismiss(item.id, -1);
                  }}
                  className="group/card relative flex cursor-pointer select-none gap-3 rounded-[22px] rounded-bl-md border border-white/30 bg-ink-850/95 p-3 shadow-[0_14px_30px_-12px_rgba(5,2,20,0.9)] outline-none backdrop-blur focus-visible:ring-2 focus-visible:ring-lime-400"
                >
                  <div className={cn("flex min-w-0 flex-1 gap-3 transition-opacity duration-200", !expanded && depth > 0 && "opacity-0")}>
                    <div className="shrink-0">{item.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-[13px] font-bold text-white">{item.title}</p>
                        <span className="shrink-0 text-xs tabular-nums text-ink-400">{item.time}</span>
                      </div>
                      <p className="line-clamp-2 text-[13px] text-ink-200">{item.body}</p>
                    </div>
                  </div>
                  <button
                    aria-label={`Bỏ qua ${item.title}`}
                    className={cn(
                      "absolute -right-2 -top-2 grid size-6 place-items-center rounded-full border border-white/40 bg-ink-800 text-ink-300 opacity-0 transition-opacity duration-150 hover:text-white focus-visible:opacity-100 group-hover/card:opacity-100",
                      !expanded && depth > 0 && "hidden"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss(item.id, -1);
                    }}
                    type="button"
                  >
                    <X className="size-3" />
                  </button>
                </article>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
