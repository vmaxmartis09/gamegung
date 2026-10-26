"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { CatalogRole, CatalogSet, CatalogTeam, SETS, TEAM_META, WEREWOLF_CATALOG, catalogImage } from "@/lib/games/werewolf-catalog";
import { cn } from "@/lib/utils";
import { Emoji } from "@/components/ui/emoji";

/** Các vai đã chơi được trong game hiện tại. */
const PLAYABLE_IDS = new Set(["soi-thuong", "soi-con", "soi-trang", "tien-tri", "bao-ve", "phu-thuy", "tho-san", "cupid", "gia-lang", "dan-lang"]);

type TeamFilter = "all" | CatalogTeam;
type SetFilter = "all" | CatalogSet;

const TEAM_TABS: { id: TeamFilter; label: string; color?: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "village", label: "Dân", color: TEAM_META.village.color },
  { id: "wolves", label: "Sói", color: TEAM_META.wolves.color },
  { id: "solo", label: "Phe 3", color: TEAM_META.solo.color },
];

/** Ảnh nguồn nhỏ: dùng bản mờ phủ nền + bản nét ở giữa để card luôn đầy và sắc. */
function Art({ role, className, fit = "contain" }: { role: CatalogRole; className?: string; fit?: "contain" | "cover" }) {
  const src = catalogImage(role);
  const meta = TEAM_META[role.team];
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ background: "linear-gradient(180deg,#15121f,#0a0814)" }}>
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-2xl" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={role.name} loading="lazy" className={cn("relative h-full w-full drop-shadow-[0_12px_24px_rgba(0,0,0,0.55)]", fit === "contain" ? "object-contain p-5" : "object-cover")} />
        </>
      ) : (
        <div className="relative grid h-full w-full place-items-center text-7xl drop-shadow-[0_0_24px_rgba(255,255,255,0.35)]"><Emoji e={role.emoji} /></div>
      )}
    </div>
  );
}

function RoleCard({ role, index, onOpen }: { role: CatalogRole; index: number; onOpen: () => void }) {
  const meta = TEAM_META[role.team];
  const ref = useRef<HTMLButtonElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(700px) rotateX(${(0.5 - py) * 14}deg) rotateY(${(px - 0.5) * 16}deg) translateZ(0) scale(1.03)`;
    el.style.setProperty("--gx", `${px * 100}%`);
    el.style.setProperty("--gy", `${py * 100}%`);
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 12) * 0.03, duration: 0.3 }}>
      <button
        ref={ref}
        type="button"
        onClick={onOpen}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="group relative block aspect-[3/4] w-full overflow-hidden rounded-lg text-left ring-1 ring-white/[0.08] transition-transform duration-200 ease-out hover:ring-white/25"
      >
        <Art role={role} className="absolute inset-x-0 top-0 h-[68%]" />
        {/* thân card */}
        <div className="absolute inset-x-0 bottom-0 h-[44%] bg-gradient-to-t from-[#07050f] via-[#0b0816]/95 to-transparent" />
        {/* ánh sáng theo chuột */}
        {/* kim loại phản chiếu: dải sáng chạy theo chuột */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-black/25" />
        <div className="pointer-events-none absolute inset-0 opacity-0 mix-blend-soft-light transition-opacity duration-200 group-hover:opacity-100" style={{ background: "linear-gradient(112deg, transparent calc(var(--gx,50%) - 26%), rgba(255,255,255,0.75) var(--gx,50%), transparent calc(var(--gx,50%) + 26%))" }} />
        <div className="pointer-events-none absolute inset-0 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.5)]" />

        <div className="absolute inset-x-0 bottom-0 p-3.5">
          <p className="font-display text-[17px] font-extrabold leading-tight text-white drop-shadow">{role.name}</p>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/50">{role.desc}</p>
        </div>
      </button>
    </motion.div>
  );
}

function RoleDetail({ role, onClose, onPrev, onNext, inline }: { role: CatalogRole; onClose: () => void; onPrev: () => void; onNext: () => void; inline: boolean }) {
  const meta = TEAM_META[role.team];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className={cn("flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md", inline ? "absolute inset-0 z-30 rounded-xl" : "fixed inset-0 z-[80]")}>
      <motion.div
        key={role.id}
        initial={{ scale: 0.92, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="relative grid w-full max-w-2xl overflow-hidden rounded-xl bg-[#0c0918] ring-1 ring-white/15 sm:grid-cols-[1fr_1.05fr]"
      >
        <Art role={role} className="aspect-square sm:aspect-auto sm:min-h-[340px]" />
        <div className="flex flex-col justify-center gap-3 p-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-white/15 px-2.5 py-0.5 text-xs font-bold text-white">{meta.label}</span>
            <span className="rounded-md bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white/70">{role.set}</span>
            {PLAYABLE_IDS.has(role.id) && <span className="rounded-md bg-white px-2.5 py-0.5 text-xs font-black text-black">Chơi được</span>}
          </div>
          <h3 className="font-display text-3xl font-black text-white">{role.name}</h3>
          <p className="text-sm leading-relaxed text-white/75">{role.desc}</p>
        </div>

        <button type="button" onClick={onClose} aria-label="Đóng" className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-black/60 text-white/80 transition hover:scale-110 hover:text-white">
          <X className="size-4" />
        </button>
        <button type="button" onClick={onPrev} aria-label="Trước" className="absolute left-3 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white transition hover:scale-110 active:scale-95">
          <ChevronLeft className="size-5" />
        </button>
        <button type="button" onClick={onNext} aria-label="Sau" className="absolute right-3 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white text-black transition hover:scale-110 active:scale-95">
          <ChevronRight className="size-5" />
        </button>
      </motion.div>
    </motion.div>
  );
}

export function WerewolfRoleGallery({ overlayHost }: { overlayHost?: HTMLElement | null }) {
  const [team, setTeam] = useState<TeamFilter>("all");
  const [set, setSet] = useState<SetFilter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const roles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return WEREWOLF_CATALOG.filter((r) => (team === "all" || r.team === team) && (set === "all" || r.set === set) && (!q || r.name.toLowerCase().includes(q)));
  }, [team, set, query]);

  const openIdx = roles.findIndex((r) => r.id === openId);
  const move = useCallback(
    (d: number) => {
      if (!roles.length) return;
      const i = openIdx < 0 ? 0 : (openIdx + d + roles.length) % roles.length;
      setOpenId(roles[i].id);
    },
    [roles, openIdx],
  );
  const open = openIdx >= 0 ? roles[openIdx] : null;

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-5 -mt-5 bg-[#0d0a1a]/90 px-5 pb-3 pt-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm nhân vật…" className="w-full rounded-lg border border-white/10 bg-white/[0.06] py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30" />
        </div>
        <div className="flex rounded-xl border border-white/10 bg-black/30 p-1 text-xs font-bold">
          {TEAM_TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTeam(t.id)} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition active:scale-95", team === t.id ? "bg-white text-black" : "text-white/55 hover:text-white")}>
              {t.color && <span className="size-2 rounded-full" style={{ background: t.color }} />}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto pb-1 text-xs">
        {(["all", ...SETS] as SetFilter[]).map((s) => (
          <button key={s} type="button" onClick={() => setSet(s)} className={cn("shrink-0 rounded-md border px-3 py-1 font-bold transition active:scale-95", set === s ? "border-white/40 bg-white/10 text-white" : "border-white/10 text-white/50 hover:text-white")}>
            {s === "all" ? "Tất cả bản" : s}
          </button>
        ))}
      </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {roles.map((r, i) => (
          <RoleCard key={r.id} role={r} index={i} onOpen={() => setOpenId(r.id)} />
        ))}
      </div>
      {roles.length === 0 && <p className="mt-10 text-center text-sm text-white/50">Không có kết quả</p>}

      {mounted &&
        createPortal(
          <AnimatePresence>{open && <RoleDetail inline={!!overlayHost} role={open} onClose={() => setOpenId(null)} onPrev={() => move(-1)} onNext={() => move(1)} />}</AnimatePresence>,
          overlayHost ?? document.body,
        )}
    </div>
  );
}
