"use client";

/**
 * Ported from KokonutUI Account Menu (profile-dropdown)
 * @author: @dorianbaffier
 * @version: 2.0.0
 * @license: MIT — Copyright (c) KokonutUI (https://kokonutui.com)
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Adapted for Office Arena: the menu grows UP out of a compact avatar
 * trigger in the bottom dock; single account; presence status row
 * (Online / Away / Do not disturb); sound row in place of theme; hold to
 * sign out. framer-motion imports, React 18-safe `inert`.
 */

import { LogOut, Volume2, VolumeX } from "lucide-react";
import { animate, motion, type Transition, useMotionTemplate, useMotionValue } from "framer-motion";
import { useReducedMotion } from "@/lib/motion";
import { type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { UserAvatar, type PresenceStatus } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

export interface AccountMenuItem {
  label: string;
  icon: ReactNode;
  value?: string;
  onSelect: () => void;
}

export type ManualStatus = "auto" | "away" | "busy";

interface AccountMenuProps {
  name: string;
  email?: string | null;
  avatar: string;
  /** Live presence shown on the avatar. */
  presence: PresenceStatus;
  /** The user's chosen status mode. */
  status: ManualStatus;
  onStatusChange: (s: ManualStatus) => void;
  sound: boolean;
  onSoundChange: (on: boolean) => void;
  items: AccountMenuItem[];
  onSignOut: () => void;
  /** Extra line under the name, e.g. "1250 ELO · 1.000 🌾". */
  plan?: string;
  holdDuration?: number;
  className?: string;
}

const STATUSES: { id: ManualStatus; label: string; name: string; dot: string }[] = [
  { id: "auto", label: "Online", name: "Tự động (Online / Away)", dot: "bg-pop-green" },
  { id: "away", label: "Away", name: "Vắng mặt", dot: "bg-pop-yellow" },
  { id: "busy", label: "Bận", name: "Không làm phiền", dot: "bg-pop-red" },
];

const PANEL_W = 288;
const RADIUS = 20;
const SPRING: Transition = { type: "spring", duration: 0.3, bounce: 0 };
const INDICATOR_SPRING: Transition = { type: "spring", duration: 0.25, bounce: 0 };
const INSTANT: Transition = { duration: 0 };
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const NAV_KEYS = new Set(["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"]);
const ITEM_CLASS =
  "flex w-full cursor-default items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-ink-200 outline-none transition-colors duration-100 focus:bg-white/[0.08] focus:text-white";

type Phase = "closed" | "open" | "closing";
type Via = "pointer" | "keyboard";

const viaOf = (event: MouseEvent): Via => (event.detail === 0 ? "keyboard" : "pointer");
const menuItems = (root: HTMLElement | null) => (root ? Array.from(root.querySelectorAll<HTMLElement>("[data-menu-item]")) : []);

function nextTarget(items: HTMLElement[], active: Element | null, key: string): HTMLElement | undefined {
  if (key === "Home") return items[0];
  if (key === "End") return items.at(-1);
  const current = items.find((item) => item === active);
  if (!current) return key === "ArrowUp" ? items.at(-1) : items[0];
  if (key === "ArrowLeft" || key === "ArrowRight") {
    const row = items.filter((i) => i.dataset.row === current.dataset.row);
    if (row.length < 2) return;
    const idx = row.indexOf(current);
    return row[(idx + (key === "ArrowRight" ? 1 : -1) + row.length) % row.length];
  }
  const rows = [...new Set(items.map((i) => i.dataset.row))];
  const ri = rows.indexOf(current.dataset.row);
  const next = rows[(ri + (key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length];
  const cands = items.filter((i) => i.dataset.row === next);
  return cands.find((i) => i.getAttribute("aria-checked") === "true") ?? cands[0];
}

function HoldSignOut({ duration, onComplete }: { duration: number; onComplete: (via: Via) => void }) {
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const [nudge, setNudge] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const nudgeTimer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(nudgeTimer.current);
    },
    []
  );
  const start = (via: Via) => {
    if (timer.current !== undefined || done) return;
    window.clearTimeout(nudgeTimer.current);
    setNudge(false);
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      setHolding(false);
      setDone(true);
      onComplete(via);
    }, duration);
  };
  const cancel = () => {
    if (timer.current === undefined) return;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    setHolding(false);
    setNudge(true);
    nudgeTimer.current = window.setTimeout(() => setNudge(false), 1400);
  };
  const label = (
    <>
      <LogOut className="size-4" />
      <span className="flex-1">Đăng xuất</span>
      <span className="text-xs opacity-60">{nudge ? "Giữ lâu hơn" : "Giữ"}</span>
    </>
  );
  return (
    <button
      className={cn(ITEM_CLASS, "relative touch-none select-none text-[#ffb3bb]")}
      data-menu-item=""
      data-row="sign-out"
      onBlur={cancel}
      onClick={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!e.repeat) start("keyboard");
        }
      }}
      onKeyUp={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          cancel();
        }
      }}
      onPointerCancel={cancel}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
        start("pointer");
      }}
      onPointerUp={cancel}
      role="menuitem"
      tabIndex={-1}
      type="button"
    >
      {label}
      <span className="sr-only">, nhấn giữ để xác nhận</span>
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center gap-2.5 rounded-xl bg-pop-red px-2.5 text-white"
        style={{
          clipPath: holding || done ? "inset(0 0 0 0 round 12px)" : "inset(0 100% 0 0 round 12px)",
          transition: holding ? `clip-path ${duration}ms linear` : "clip-path 240ms cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        {label}
      </span>
    </button>
  );
}

export default function AccountMenu({
  name,
  email,
  avatar,
  presence,
  status,
  onStatusChange,
  sound,
  onSoundChange,
  items,
  onSignOut,
  plan,
  holdDuration = 1200,
  className,
}: AccountMenuProps) {
  const uid = useId();
  const reduced = useReducedMotion() === true;
  const [phase, setPhase] = useState<Phase>("closed");
  const [instant, setInstant] = useState(false);
  const [openSeq, setOpenSeq] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>("closed");
  phaseRef.current = phase;
  const openIntent = useRef<{ focus: "first" | "last" | "menu"; resume: boolean }>({ focus: "menu", resume: false });
  const closeSeq = useRef(0);

  // The visible box grows from the trigger's bottom-right corner, upward.
  const w = useMotionValue(0);
  const h = useMotionValue(0);
  const bodyOpacity = useMotionValue(1);
  const outerClip = useMotionTemplate`inset(calc(100% - ${h}px) 0px 0px calc(100% - ${w}px) round ${RADIUS}px)`;
  const innerClip = useMotionTemplate`inset(calc(100% - ${h}px + 1px) 1px 1px calc(100% - ${w}px + 1px) round ${RADIUS - 1}px)`;
  const shared = phase === "open";
  const menuId = `${uid}-menu`;
  const transition = instant ? INSTANT : SPRING;

  const openMenu = (via: Via, focus: "first" | "last" | "menu") => {
    if (phaseRef.current === "open") return;
    openIntent.current = { focus, resume: phaseRef.current === "closing" };
    closeSeq.current += 1;
    setInstant(via === "keyboard" || reduced);
    setPhase("open");
    setOpenSeq((s) => s + 1);
  };

  const closeMenu = (via: Via, returnFocus: boolean) => {
    if (phaseRef.current !== "open") return;
    const trigger = triggerRef.current;
    if (returnFocus) trigger?.focus({ preventScroll: true });
    if (via === "keyboard" || reduced || !trigger) {
      setInstant(true);
      setPhase("closed");
      return;
    }
    setInstant(false);
    setPhase("closing");
    const seq = ++closeSeq.current;
    animate(bodyOpacity, 0, { duration: 0.12, ease: EASE_OUT });
    animate(w, trigger.offsetWidth, SPRING);
    animate(h, trigger.offsetHeight, SPRING).then(() => {
      if (closeSeq.current === seq) setPhase("closed");
    });
  };

  const select = (event: MouseEvent, run?: () => void) => {
    run?.();
    closeMenu(viaOf(event), true);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const main = mainRef.current;
    if (openSeq === 0 || phaseRef.current !== "open" || !trigger || !main) return;
    const target = main.offsetHeight;
    if (instant) {
      w.jump(PANEL_W);
      h.jump(target);
      bodyOpacity.jump(1);
    } else {
      if (!openIntent.current.resume) {
        w.jump(trigger.offsetWidth);
        h.jump(trigger.offsetHeight);
        bodyOpacity.jump(0);
      }
      animate(w, PANEL_W, SPRING);
      animate(h, target, SPRING);
      animate(bodyOpacity, 1, { duration: 0.2, delay: 0.05, ease: EASE_OUT });
    }
    const list = menuItems(main);
    const targets = { first: list[0], last: list.at(-1), menu: main.querySelector<HTMLElement>("[role=menu]") };
    targets[openIntent.current.focus]?.focus({ preventScroll: true });
  }, [openSeq]);

  // Keep the height in step when the content changes size (status / sound rows).
  useEffect(() => {
    if (phase !== "open") return;
    const ro = new ResizeObserver(() => {
      if (mainRef.current && phaseRef.current === "open") animate(h, mainRef.current.offsetHeight, reduced ? INSTANT : SPRING);
    });
    if (mainRef.current) ro.observe(mainRef.current);
    return () => ro.disconnect();
  }, [phase, h, reduced]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase !== "open") return;
    const onDown = (event: globalThis.PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) closeMenu("pointer", false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [phase]);

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      closeMenu("keyboard", true);
      return;
    }
    if (!NAV_KEYS.has(event.key)) return;
    event.preventDefault();
    nextTarget(menuItems(mainRef.current), document.activeElement, event.key)?.focus({ preventScroll: true });
  };

  const onPanelPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const item = (event.target as HTMLElement).closest<HTMLElement>("[data-menu-item]");
    if (item && document.activeElement !== item) item.focus({ preventScroll: true });
  };

  return (
    <div className={cn("relative isolate inline-block", phase !== "closed" && "z-50", className)} ref={wrapperRef}>
      <button
        aria-controls={shared ? menuId : undefined}
        aria-expanded={shared}
        aria-haspopup="menu"
        aria-label={`Tài khoản: ${name}`}
        className="grid size-12 place-items-center rounded-2xl bg-ink-800 outline-none transition-colors duration-150 hover:bg-ink-700 focus-visible:ring-2 focus-visible:ring-lime-400"
        onClick={(event) => {
          const via = viaOf(event);
          openMenu(via, via === "keyboard" ? "first" : "menu");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu("keyboard", event.key === "ArrowDown" ? "first" : "last");
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <motion.span className={cn("relative z-20 block", shared && "invisible")} layoutId={!shared ? `${uid}-avatar` : undefined} transition={transition}>
          <UserAvatar src={avatar} name={name} status={presence} className="size-9" dotClassName="size-3 border-ink-800" />
        </motion.span>
      </button>

      {phase === "closed" ? null : (
        <div className="pointer-events-none absolute bottom-0 right-0 z-10" style={{ width: PANEL_W }}>
          <div aria-hidden="true" className="absolute inset-0 [filter:drop-shadow(0_-12px_28px_rgb(5_2_20/0.6))]">
            <motion.div className="absolute inset-0 bg-white/30" style={{ clipPath: outerClip }} />
            <motion.div className="absolute inset-0 bg-ink-850" style={{ clipPath: innerClip }} />
          </div>
          <motion.div className={cn("relative", shared && "pointer-events-auto")} onKeyDown={onPanelKeyDown} onPointerMove={onPanelPointerMove} style={{ clipPath: innerClip }}>
            <div className="p-1.5" ref={mainRef} style={{ width: PANEL_W }}>
              <div className="flex items-start gap-3 px-2.5 pb-3 pt-2.5">
                <motion.span className={cn("relative z-20 block", !shared && "invisible")} layoutId={shared ? `${uid}-avatar` : undefined} transition={transition}>
                  <UserAvatar src={avatar} name={name} status={presence} className="size-11" dotClassName="size-3 border-ink-850" />
                </motion.span>
                <motion.span className="flex min-w-0 flex-col pt-0.5" style={{ opacity: bodyOpacity }}>
                  <span className="truncate font-display text-[15px] font-bold leading-5 text-white">{name}</span>
                  {email && <span className="truncate text-xs leading-4 text-ink-300">{email}</span>}
                  {plan && <span className="mt-1 truncate text-xs font-semibold text-lime-300">{plan}</span>}
                </motion.span>
              </div>
              <motion.div aria-label={name} className="outline-none" id={menuId} role="menu" style={{ opacity: bodyOpacity }} tabIndex={-1}>
                <fieldset aria-label="Trạng thái" className="m-0 flex min-w-0 items-center justify-between border-0 py-1 pl-2.5 pr-1">
                  <span className="text-sm text-ink-300">Trạng thái</span>
                  <span className="flex">
                    {STATUSES.map((entry) => {
                      const checked = entry.id === status;
                      return (
                        <button
                          aria-checked={checked}
                          aria-label={entry.name}
                          title={entry.name}
                          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-ink-300 outline-none transition-colors duration-100 focus:bg-white/[0.08] aria-checked:font-bold aria-checked:text-white"
                          data-menu-item=""
                          data-row="status"
                          key={entry.id}
                          onClick={() => onStatusChange(entry.id)}
                          role="menuitemradio"
                          tabIndex={-1}
                          type="button"
                        >
                          <span className={cn("size-2 rounded-full transition-colors duration-200", checked ? entry.dot : "bg-ink-500")} />
                          {entry.label}
                        </button>
                      );
                    })}
                  </span>
                </fieldset>
                <fieldset aria-label="Âm thanh" className="m-0 flex min-w-0 items-center justify-between border-0 py-1 pl-2.5 pr-1">
                  <span className="text-sm text-ink-300">Âm thanh</span>
                  <span className="flex rounded-xl bg-ink-800 p-0.5">
                    {[
                      { on: true, label: "Bật âm", Icon: Volume2 },
                      { on: false, label: "Tắt âm", Icon: VolumeX },
                    ].map(({ on, label, Icon }) => {
                      const checked = sound === on;
                      return (
                        <button
                          aria-checked={checked}
                          aria-label={label}
                          className="relative grid h-7 w-10 place-items-center rounded-lg text-ink-300 outline-none transition-colors duration-150 hover:text-white aria-checked:text-black"
                          data-menu-item=""
                          data-row="sound"
                          key={label}
                          onClick={() => onSoundChange(on)}
                          role="menuitemradio"
                          tabIndex={-1}
                          type="button"
                        >
                          {checked ? <motion.span className="absolute inset-0 rounded-lg bg-lime-400" layoutId={`${uid}-sound`} transition={reduced ? INSTANT : INDICATOR_SPRING} /> : null}
                          <Icon className="relative size-3.5" />
                        </button>
                      );
                    })}
                  </span>
                </fieldset>
                <hr className="mx-2.5 my-1.5 h-px border-0 bg-white/15" />
                {items.map((item, index) => (
                  <button key={item.label} className={ITEM_CLASS} data-menu-item="" data-row={`item-${index}`} onClick={(e) => select(e, item.onSelect)} role="menuitem" tabIndex={-1} type="button">
                    <span className="text-ink-300">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.value ? <span className="text-xs text-ink-400">{item.value}</span> : null}
                  </button>
                ))}
                <hr className="mx-2.5 my-1.5 h-px border-0 bg-white/15" />
                <HoldSignOut
                  duration={holdDuration}
                  onComplete={(via) => {
                    onSignOut();
                    closeMenu(via, true);
                  }}
                />
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
