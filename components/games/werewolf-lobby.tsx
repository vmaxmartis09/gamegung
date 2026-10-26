"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dices, EyeOff, Eye, Library, Minus, Play, Plus, RotateCcw, Save, Shuffle, SlidersHorizontal, Swords, Timer, Zap } from "lucide-react";
import { ROLE_INFO, Role, isWolf } from "@/lib/games/werewolf-engine";
import { ROLE_CARD_IMAGES } from "./werewolf-card-art";
import { WerewolfRoleGallery } from "./werewolf-role-gallery";
import { StakePicker } from "./shared";
import { useCooldown } from "@/lib/cooldown-store";
import { cn } from "@/lib/utils";
import { Emoji } from "@/components/ui/emoji";

/* --------------------------------- Setup model -------------------------------- */

export type LobbyMode = "classic" | "random" | "custom" | "blitz" | "chaos";

export interface LobbySetup {
  mode: LobbyMode;
  roles: Role[];
  myRole: Role | "random";
}

const ALL_ROLES: Role[] = ["wolf", "wolf_cub", "white_wolf", "seer", "guard", "witch", "hunter", "cupid", "elder", "villager"];

const LIMITS: Record<Role, number> = { wolf: 5, wolf_cub: 2, white_wolf: 1, seer: 1, guard: 1, witch: 1, hunter: 1, cupid: 1, elder: 1, villager: 9 };

const MIN_PLAYERS = 6;
const MAX_PLAYERS = 16;

const CLASSIC: Record<number, Role[]> = {
  8: ["wolf", "wolf_cub", "seer", "guard", "witch", "hunter", "villager", "villager"],
  10: ["wolf", "wolf_cub", "seer", "guard", "witch", "hunter", "cupid", "elder", "villager", "villager"],
  12: ["wolf", "white_wolf", "wolf_cub", "seer", "guard", "witch", "hunter", "cupid", "elder", "villager", "villager", "villager"],
};
const BLITZ: Role[] = ["wolf", "wolf_cub", "seer", "witch", "villager", "villager"];
const CHAOS: Role[] = ["wolf", "wolf", "white_wolf", "wolf_cub", "seer", "guard", "witch", "hunter", "cupid", "elder", "villager", "villager"];

const shuffle = <T,>(a: T[]) => {
  const c = [...a];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
};

/** Sinh bộ vai ngẫu nhiên nhưng vẫn cân bằng. */
export function randomRoles(n: number): Role[] {
  const wolves = Math.max(1, Math.round(n / 4));
  const wolfPool: Role[] = ["wolf", "wolf_cub", ...(n >= 10 ? (["white_wolf"] as Role[]) : []), "wolf", "wolf"];
  const out: Role[] = wolfPool.slice(0, wolves);
  const specials = shuffle<Role>(["witch", "guard", "hunter", "cupid", "elder"]);
  out.push("seer");
  for (const r of specials) if (out.length < n) out.push(r);
  while (out.length < n) out.push("villager");
  return out.slice(0, n);
}

const countOf = (roles: Role[]) => {
  const m = {} as Record<Role, number>;
  for (const r of ALL_ROLES) m[r] = 0;
  for (const r of roles) m[r]++;
  return m;
};

export function validateRoles(roles: Role[]): string | null {
  if (roles.length < MIN_PLAYERS) return `Cần ít nhất ${MIN_PLAYERS} người chơi.`;
  if (roles.length > MAX_PLAYERS) return `Tối đa ${MAX_PLAYERS} người chơi.`;
  const w = roles.filter(isWolf).length;
  if (w < 1) return "Cần ít nhất 1 vai phe Sói.";
  if (w * 2 >= roles.length) return "Phe Sói phải ít hơn nửa số người chơi.";
  return null;
}

export const defaultSetup = (): LobbySetup => ({ mode: "classic", roles: CLASSIC[8], myRole: "random" });

const MODES: { id: LobbyMode; name: string; tag: string; desc: string; icon: React.ReactNode }[] = [
  { id: "classic", name: "Cổ điển", tag: "8 · 10 · 12", desc: "Chuẩn, cân bằng", icon: <Swords className="size-5" /> },
  { id: "random", name: "Ngẫu nhiên", tag: "6 – 16", desc: "Bốc vai bí mật", icon: <Dices className="size-5" /> },
  { id: "custom", name: "Tuỳ chỉnh", tag: "Sandbox", desc: "Tự xếp từng vai", icon: <SlidersHorizontal className="size-5" /> },
  { id: "blitz", name: "Chớp nhoáng", tag: "6 người", desc: "Ván ngắn 6 người", icon: <Zap className="size-5" /> },
  { id: "chaos", name: "Hỗn loạn", tag: "12 · 4 Sói", desc: "4 Sói, cực gắt", icon: <Shuffle className="size-5" /> },
];

const STORE_KEY = "ww-custom-setup";

/* ----------------------------------- Pieces ----------------------------------- */

function RoleThumb({ role, size = 36 }: { role: Role; size?: number }) {
  const src = ROLE_CARD_IMAGES[role];
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-lg bg-black/50 ring-1 ring-white/10" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-contain p-0.5" />
      ) : (
        <span style={{ fontSize: size * 0.55 }}><Emoji e={ROLE_INFO[role].emoji} /></span>
      )}
    </span>
  );
}

function Donut({ wolves, village, hidden }: { wolves: number; village: number; hidden: boolean }) {
  const total = Math.max(1, wolves + village);
  const R = 42;
  const C = 2 * Math.PI * R;
  const wLen = (wolves / total) * C;
  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
        {!hidden && (
          <>
            <circle cx="50" cy="50" r={R} fill="none" stroke="#4ade80" strokeWidth="9" strokeDasharray={`${C - wLen - 2} ${C}`} strokeDashoffset={-wLen} strokeLinecap="butt" />
            <circle cx="50" cy="50" r={R} fill="none" stroke="#f87171" strokeWidth="9" strokeDasharray={`${Math.max(0, wLen - 2)} ${C}`} />
          </>
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-2xl font-black leading-none text-white">{wolves + village}</p>
          <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.18em] text-white/45">người</p>
        </div>
      </div>
    </div>
  );
}

function Stepper({ role, value, max, onChange }: { role: Role; value: number; max: number; onChange: (v: number) => void }) {
  const info = ROLE_INFO[role];
  const wolf = isWolf(role);
  return (
    <div className={cn("flex items-center gap-2.5 rounded-xl border p-2 transition-colors", value > 0 ? "border-white/20 bg-white/[0.06]" : "border-white/[0.07] bg-white/[0.02]")}>
      <RoleThumb role={role} size={38} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-white">{info.name}</p>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: wolf ? "#f87171" : "#4ade80" }}>{wolf ? "Phe Sói" : "Phe Dân"}</p>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Giảm" disabled={value <= 0} onClick={() => onChange(value - 1)} className="grid size-7 place-items-center rounded-lg bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-25">
          <Minus className="size-3.5" />
        </button>
        <span className="w-5 text-center font-display text-sm font-black text-white">{value}</span>
        <button type="button" aria-label="Tăng" disabled={value >= max} onClick={() => onChange(value + 1)} className="grid size-7 place-items-center rounded-lg bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-25">
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------ Lobby ------------------------------------ */

export function WerewolfLobby({
  setup,
  setSetup,
  stake,
  setStake,
  onStart,
  onPreviewRoulette,
}: {
  setup: LobbySetup;
  setSetup: (s: LobbySetup) => void;
  stake: number;
  setStake: (v: number) => void;
  onStart: () => void;
  onPreviewRoulette?: () => void;
}) {
  const cooldown = useCooldown();
  const [tab, setTab] = useState<"setup" | "library">("setup");
  const [libHost, setLibHost] = useState<HTMLDivElement | null>(null);
  const [classicSize, setClassicSize] = useState<8 | 10 | 12>(8);
  const [randomSize, setRandomSize] = useState(10);
  const [hideComp, setHideComp] = useState(true);
  const [saved, setSaved] = useState<Role[] | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as Role[];
        if (Array.isArray(arr) && arr.every((r) => ALL_ROLES.includes(r))) setSaved(arr);
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 1800);
  };

  const mode = MODES.find((m) => m.id === setup.mode)!;
  const counts = useMemo(() => countOf(setup.roles), [setup.roles]);
  const wolves = setup.roles.filter(isWolf).length;
  const village = setup.roles.length - wolves;
  const error = validateRoles(setup.roles);
  const hidden = setup.mode === "random" && hideComp;

  const pickMode = (id: LobbyMode) => {
    if (id === "classic") setSetup({ ...setup, mode: id, roles: CLASSIC[classicSize] });
    else if (id === "random") setSetup({ ...setup, mode: id, roles: randomRoles(randomSize) });
    else if (id === "blitz") setSetup({ ...setup, mode: id, roles: BLITZ });
    else if (id === "chaos") setSetup({ ...setup, mode: id, roles: CHAOS });
    else setSetup({ ...setup, mode: id, roles: setup.mode === "custom" ? setup.roles : [...setup.roles] });
  };

  const setCustomCount = (role: Role, v: number) => {
    const rest = setup.roles.filter((r) => r !== role);
    setSetup({ ...setup, mode: "custom", roles: [...rest, ...Array<Role>(v).fill(role)] });
  };

  // Nếu vai đã chọn không còn trong bộ vai → quay về ngẫu nhiên.
  useEffect(() => {
    if (setup.myRole !== "random" && !setup.roles.includes(setup.myRole)) setSetup({ ...setup, myRole: "random" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup.roles]);

  const distinct = ALL_ROLES.filter((r) => counts[r] > 0);

  return (
    <div className="relative">
      {/* nền lưới HUD */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -top-4 h-[420px] opacity-25 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "36px 36px" }}
      />

      {/* Hero */}
      <div className="relative mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="mt-1 font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
            Phòng chờ <span>Ma Sói</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-white/10 bg-black/40 p-1 text-xs font-bold">
            {([["setup", "Thiết lập", <SlidersHorizontal key="a" className="size-3.5" />], ["library", "Thư viện thẻ", <Library key="b" className="size-3.5" />]] as const).map(([id, label, icon]) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition", tab === id ? "bg-white text-black" : "text-white/55 hover:text-white")}>
                {icon}
                {label}
              </button>
            ))}
          </div>
          {onPreviewRoulette && (
            <button type="button" onClick={onPreviewRoulette} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-white/80 transition hover:bg-white/10">
              <Emoji e="✨" /> Thử vòng quay thẻ
            </button>
          )}
        </div>
      </div>

      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        {/* ============================ LEFT ============================ */}
        <div className="space-y-5">
          {tab === "library" ? (
            <div ref={setLibHost} className="relative h-[calc(100dvh-250px)] min-h-[360px] overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
              <div className="h-full overflow-y-auto overscroll-contain p-5">
                <WerewolfRoleGallery overlayHost={libHost} />
              </div>
            </div>
          ) : (
            <>
              {/* Mode cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {MODES.map((m) => {
                  const on = setup.mode === m.id;
                  return (
                    <motion.button
                      key={m.id}
                      type="button"
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => pickMode(m.id)}
                      className={cn("relative overflow-hidden rounded-lg border p-3 text-left backdrop-blur-xl transition-colors", on ? "border-white/35 bg-white/[0.09]" : "border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06]")}
                    >
                      <span className={cn("grid size-9 place-items-center rounded-xl", on ? "bg-white text-black" : "bg-white/10 text-white/80")}>
                        {m.icon}
                      </span>
                      <p className="mt-2 font-display text-[15px] font-extrabold text-white">{m.name}</p>
                      <p className="font-mono text-xs font-semibold uppercase tracking-wider text-white/40">{m.tag}</p>
                      <p className="mt-1.5 text-xs leading-snug text-white/50">{m.desc}</p>
                    </motion.button>
                  );
                })}
              </div>

              {/* Mode config */}
              <div className="relative rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <AnimatePresence mode="wait">
                  <motion.div key={setup.mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                    {setup.mode === "classic" && (
                      <div>
                        
                        <div className="grid gap-2 sm:grid-cols-3">
                          {([8, 10, 12] as const).map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => {
                                setClassicSize(n);
                                setSetup({ ...setup, roles: CLASSIC[n] });
                              }}
                              className={cn("rounded-xl border p-3 text-left transition", classicSize === n ? "border-white/40 bg-white/10" : "border-white/10 hover:bg-white/5")}
                            >
                              <p className="font-display text-2xl font-black text-white">{n}</p>
                              <p className="text-xs text-white/50">{n === 8 ? "Sói Con & Thợ Săn" : n === 10 ? "Thêm Cupid & Già Làng" : "Thêm Sói Trắng"}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {setup.mode === "random" && (
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="label mb-0"><Emoji e="👥" /></p>
                          <span className="font-display text-xl font-black text-white">{randomSize}</span>
                        </div>
                        <input
                          type="range"
                          min={MIN_PLAYERS}
                          max={MAX_PLAYERS}
                          value={randomSize}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            setRandomSize(n);
                            setSetup({ ...setup, roles: randomRoles(n) });
                          }}
                          className="mt-2 w-full accent-white"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => setSetup({ ...setup, roles: randomRoles(randomSize) })} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20">
                            <Dices className="size-4" /> Bốc lại bộ vai
                          </button>
                          <button type="button" onClick={() => setHideComp((v) => !v)} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/70 transition hover:text-white">
                            {hideComp ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            {hideComp ? "Ẩn" : "Hiện"}
                          </button>
                        </div>
                      </div>
                    )}

                    {setup.mode === "custom" && (
                      <div>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="label mb-0"><Emoji e="👥" /> {setup.roles.length}</p>
                          <div className="flex gap-1.5 text-xs font-bold">
                            <button type="button" onClick={() => setSetup({ ...setup, roles: randomRoles(Math.max(MIN_PLAYERS, setup.roles.length)) })} className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-white/80 hover:bg-white/20">
                              <Shuffle className="size-3.5" /> Trộn
                            </button>
                            <button type="button" onClick={() => setSetup({ ...setup, roles: CLASSIC[8] })} className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-white/80 hover:bg-white/20">
                              <RotateCcw className="size-3.5" /> Mặc định
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  localStorage.setItem(STORE_KEY, JSON.stringify(setup.roles));
                                  setSaved(setup.roles);
                                  flash("Đã lưu cấu hình");
                                } catch {
                                  flash("Không lưu được");
                                }
                              }}
                              className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-white/80 hover:bg-white/20"
                            >
                              <Save className="size-3.5" /> Lưu
                            </button>
                            {saved && (
                              <button type="button" onClick={() => setSetup({ ...setup, mode: "custom", roles: saved })} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-white/80 hover:bg-white/20">
                                Tải
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {ALL_ROLES.map((r) => (
                            <Stepper key={r} role={r} value={counts[r]} max={LIMITS[r]} onChange={(v) => setCustomCount(r, v)} />
                          ))}
                        </div>
                      </div>
                    )}

                    {(setup.mode === "blitz" || setup.mode === "chaos") && (
                      <div>
                        
                        <div className="flex flex-wrap gap-2">
                          {setup.roles.map((r, i) => (
                            <div key={`${r}-${i}`} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-3">
                              <RoleThumb role={r} size={30} />
                              <span className="text-xs font-bold text-white">{ROLE_INFO[r].name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Chọn vai của tôi */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between">
                  <p className="label mb-0"><Emoji e="🎭" /></p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSetup({ ...setup, myRole: "random" })}
                    className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition", setup.myRole === "random" ? "border-white/40 bg-white/10 text-white" : "border-white/10 text-white/60 hover:text-white")}
                  >
                    <Dices className="size-4" /> Ngẫu nhiên
                  </button>
                  {distinct.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSetup({ ...setup, myRole: r })}
                      className={cn("flex items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-3 text-xs font-bold transition", setup.myRole === r ? "border-white/40 bg-white/10 text-white" : "border-white/10 text-white/60 hover:text-white")}
                    >
                      <RoleThumb role={r} size={28} />
                      {ROLE_INFO[r].name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ============================ RIGHT ============================ */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0d0b18]/90 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="size-1.5 rounded-full bg-emerald-400" title="Sẵn sàng" />
            </div>

            <div className="mt-4 flex items-center gap-4">
              <Donut wolves={wolves} village={village} hidden={hidden} />
              <div className="flex-1 space-y-2 text-sm">
                <div className="font-display text-lg font-extrabold text-white">{mode.name}</div>
                <div className="flex items-center justify-between"><span className="text-[#f87171]"><Emoji e="🐺" /></span><span className="font-bold text-white">{hidden ? "?" : wolves}</span></div>
                <div className="flex items-center justify-between"><span className="text-[#4ade80]"><Emoji e="🏘️" /></span><span className="font-bold text-white">{hidden ? "?" : village}</span></div>
                <div className="flex items-center justify-between"><span className="text-white/55"><Emoji e="🎭" /></span><span className="font-bold text-white">{setup.myRole === "random" ? "Ngẫu nhiên" : ROLE_INFO[setup.myRole].name}</span></div>
              </div>
            </div>

            <div className="mt-4 border-t border-white/10 pt-3">
                            {hidden ? (
                <p className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] py-4 text-center text-xs text-white/50"><Emoji e="🎲" /> Bộ vai bí mật</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {distinct.map((r) => (
                    <span key={r} className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] py-1 pl-1 pr-2 text-xs font-bold text-white/85">
                      <RoleThumb role={r} size={22} />
                      {ROLE_INFO[r].name}
                      {counts[r] > 1 && <span className="rounded bg-white/15 px-1 text-xs text-white">×{counts[r]}</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <StakePicker value={stake} onChange={setStake} />
            </div>


            {cooldown.active && <p className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60"><Emoji e="⏳" /> {cooldown.reason || "Đang nghỉ giữa trận"}</p>}

            {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-200"><Emoji e="⚠" /> {error}</p>}

            <button
              type="button"
              disabled={!!error || cooldown.active}
              onClick={onStart}
              className="group relative mt-4 flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-white py-3.5 font-display text-base font-black text-black transition hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {cooldown.active ? (
                <>
                  <Timer className="size-5" /> {cooldown.seconds}s
                </>
              ) : (
                <>
                  <Play className="size-5 fill-black" /> VÀO LÀNG
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-emerald-400 px-4 py-2 text-sm font-bold text-black shadow-lg">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
