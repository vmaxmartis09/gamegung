/**
 * Ma Sói engine: roles, night resolution, bot reasoning (suspicion model),
 * bot chat, voting and win conditions. Pure functions over a plain state.
 */

export type Role = "wolf" | "white_wolf" | "wolf_cub" | "seer" | "guard" | "witch" | "hunter" | "cupid" | "elder" | "villager";
export type Team = "wolves" | "village" | "lovers";
export type Phase = "lobby" | "reveal" | "night" | "dawn" | "discussion" | "vote" | "hunter" | "over";
export type NightStep = "cupid" | "guard" | "wolves" | "white_wolf" | "seer" | "witch" | "done";
export type DeathCause = "wolf" | "vote" | "poison" | "hunter" | "lover" | "white_wolf";

export interface WPlayer {
  id: string;
  name: string;
  avatar: string;
  role: Role;
  alive: boolean;
  isHuman: boolean;
  /** Public claim made during the day. */
  claim?: "seer";
  diedDay?: number;
  cause?: DeathCause;
  /** Personality shifts how loud/accusing a bot is. */
  temper: number;
}

export interface LogEntry {
  id: number;
  kind: "narrator" | "chat" | "death" | "vote";
  day: number;
  speaker?: string;
  text: string;
}

export interface WState {
  players: WPlayer[];
  day: number;
  phase: Phase;
  step: NightStep;
  lastGuarded: string | null;
  guard: string | null;
  wolfTarget: string | null;
  wolfTarget2?: string | null;
  whiteWolfTarget: string | null;
  wolfBonusKills: number;
  lovers: [string, string] | null;
  cupidTarget1: string | null;
  cupidTarget2: string | null;
  cupidDone: boolean;
  elderLives: Record<string, number>;
  seerCheck: string | null;
  healed: boolean;
  poisonTarget: string | null;
  healUsed: boolean;
  poisonUsed: boolean;
  /** seerId → targetId → isWolf */
  seerResults: Record<string, Record<string, boolean>>;
  /** observerId → targetId → suspicion 0..1 (bots only) */
  sus: Record<string, Record<string, number>>;
  votes: Record<string, string | null>;
  log: LogEntry[];
  winner: Team | null;
  pendingHunter: string | null;
  /** What happens after the hunter shoots. */
  afterHunter: "discussion" | "night" | null;
  /** Deaths announced at dawn. */
  dawnDeaths: string[];
}

export const ROLE_INFO: Record<Role, { name: string; team: Team; emoji: string; color: string; desc: string; tip: string }> = {
  wolf: {
    name: "Ma Sói",
    team: "wolves",
    emoji: "🐺",
    color: "#fafafa",
    desc: "Mỗi đêm cùng bầy chọn 1 người để cắn.",
    tip: "Ban ngày trà trộn, đổ nghi ngờ cho người khác. Có thể nhận vai Tiên tri giả.",
  },
  white_wolf: {
    name: "Sói Trắng",
    team: "wolves",
    emoji: "🐺⚪",
    color: "#ffffff",
    desc: "Mỗi đêm cắn cùng bầy sói. Cứ mỗi 2 đêm được cắn thêm 1 con sói khác để độc chiếm chiến thắng.",
    tip: "Âm thầm tiêu diệt cả dân làng lẫn đồng bọn sói để là kẻ sống sót cuối cùng.",
  },
  wolf_cub: {
    name: "Sói Con",
    team: "wolves",
    emoji: "🐺🐾",
    color: "#f87171",
    desc: "Thành viên nhỏ tuổi của bầy sói. Nếu Sói Con chết, đêm tiếp theo bầy sói được cắn 2 người trả thù.",
    tip: "Cố gắng sống sót, hoặc hi sinh để bầy sói có cú cắn kép vào đêm sau.",
  },
  seer: { name: "Tiên Tri", team: "village", emoji: "🔮", color: "#e4e4e7", desc: "Mỗi đêm soi 1 người: là Sói hay không.", tip: "Lộ vai sớm dễ bị cắn. Chọn thời điểm công bố." },
  guard: { name: "Bảo Vệ", team: "village", emoji: "🛡️", color: "#d4d4d8", desc: "Mỗi đêm che chở 1 người khỏi Sói. Không bảo vệ 1 người 2 đêm liền.", tip: "Đoán xem Sói định cắn ai." },
  witch: { name: "Phù Thủy", team: "village", emoji: "🧪", color: "#e4e4e7", desc: "1 bình Cứu (hồi sinh nạn nhân của Sói) và 1 bình Độc (giết 1 người).", tip: "Mỗi bình chỉ dùng 1 lần trong cả ván." },
  hunter: { name: "Thợ Săn", team: "village", emoji: "🏹", color: "#d4d4d8", desc: "Khi chết (trừ bị Độc), được bắn chết 1 người.", tip: "Ghi nhớ kẻ khả nghi nhất để bắn khi cần." },
  cupid: {
    name: "Thần Tình Yêu",
    team: "village",
    emoji: "💘",
    color: "#f472b6",
    desc: "Đêm đầu tiên thức dậy ghép đôi 2 người. Nếu 1 người chết, người kia chết theo vì tương tư.",
    tip: "Nếu ghép 1 Dân và 1 Sói, 2 người trở thành phe thứ 3 phải bảo vệ nhau đến cùng.",
  },
  elder: {
    name: "Già Làng",
    team: "village",
    emoji: "👴",
    color: "#fbbf24",
    desc: "Có 2 mạng trước đòn cắn của Ma Sói. Nếu bị dân làng treo cổ, toàn bộ dân làng mất hết chức năng.",
    tip: "Chứng minh mình là Già Làng để làm chỗ dựa cho cả làng, tránh bị treo cổ oan.",
  },
  villager: { name: "Dân Làng", team: "village", emoji: "🧑‍💼", color: "#a1a1aa", desc: "Không có phép, chỉ có lý luận và lá phiếu.", tip: "Quan sát ai đổ vote vô lý." },
};

export const ROLE_SETS: Record<number, Role[]> = {
  8: ["wolf", "wolf_cub", "seer", "guard", "witch", "hunter", "villager", "villager"],
  10: ["wolf", "wolf_cub", "seer", "guard", "witch", "hunter", "cupid", "elder", "villager", "villager"],
  12: ["wolf", "white_wolf", "wolf_cub", "seer", "guard", "witch", "hunter", "cupid", "elder", "villager", "villager", "villager"],
};

export const isWolf = (r: Role): boolean => r === "wolf" || r === "white_wolf" || r === "wolf_cub";

const BOT_NAMES = [
  "Linh HR", "Tuấn Dev", "Minh Sale", "Trang Design", "Hùng Kế Toán", "Mai Marketing", "Quân DevOps", "Vy Content",
  "Long BA", "Thảo PM", "Khoa QA", "Ngọc Legal", "Duy Data", "Hà Admin", "Phúc Intern", "An CEO",
];

const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const shuffle = <T,>(a: T[]) => {
  const c = [...a];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
};
let logId = 1;

export const teamOf = (r: Role): Team => ROLE_INFO[r].team;
export const alive = (s: WState) => s.players.filter((p) => p.alive);
export const byId = (s: WState, id: string | null | undefined) => s.players.find((p) => p.id === id);
export const human = (s: WState) => s.players.find((p) => p.isHuman)!;

export function addLog(s: WState, kind: LogEntry["kind"], text: string, speaker?: string) {
  s.log = [...s.log, { id: logId++, kind, day: s.day, text, speaker }].slice(-160);
}

export interface GameOptions {
  /** Bộ vai tuỳ chỉnh (ghi đè ROLE_SETS). */
  roles?: Role[];
  /** Ép người chơi nhận vai này (nếu có trong bộ vai). */
  myRole?: Role;
}

export function createGame(countArg: number, me: { id: string; name: string; avatar: string }, opts: GameOptions = {}): WState {
  const base = opts.roles?.length ? opts.roles : ROLE_SETS[countArg] ?? ROLE_SETS[8];
  const count = base.length;
  const roles = shuffle(base);
  if (opts.myRole) {
    const at = roles.indexOf(opts.myRole);
    if (at > 0) [roles[0], roles[at]] = [roles[at], roles[0]];
  }
  const names = shuffle(BOT_NAMES).slice(0, count - 1);
  const players: WPlayer[] = roles.map((role, i) =>
    i === 0
      ? { id: me.id, name: me.name, avatar: me.avatar, role, alive: true, isHuman: true, temper: 0.5 }
      : { id: `bot-${i}`, name: names[i - 1], avatar: `kokonut:${names[i - 1].toLowerCase()}:${i}`, role, alive: true, isHuman: false, temper: 0.25 + Math.random() * 0.7 }
  );
  const ordered = shuffle(players);
  const hasCupid = ordered.some((p) => p.role === "cupid");
  const elderLives: Record<string, number> = {};
  for (const p of ordered) {
    if (p.role === "elder") elderLives[p.id] = 2;
  }
  const s: WState = {
    players: ordered,
    day: 1,
    phase: "reveal",
    step: hasCupid ? "cupid" : "guard",
    lastGuarded: null,
    guard: null,
    wolfTarget: null,
    wolfTarget2: null,
    whiteWolfTarget: null,
    wolfBonusKills: 0,
    lovers: null,
    cupidTarget1: null,
    cupidTarget2: null,
    cupidDone: false,
    elderLives,
    seerCheck: null,
    healed: false,
    poisonTarget: null,
    healUsed: false,
    poisonUsed: false,
    seerResults: {},
    sus: {},
    votes: {},
    log: [],
    winner: null,
    pendingHunter: null,
    afterHunter: null,
    dawnDeaths: [],
  };
  // Bots start with light random suspicion; wolves know their pack.
  for (const p of ordered) {
    if (p.isHuman) continue;
    s.sus[p.id] = {};
    for (const q of ordered) {
      if (q.id === p.id) continue;
      if (isWolf(p.role)) s.sus[p.id][q.id] = isWolf(q.role) ? 0 : 0.5;
      else s.sus[p.id][q.id] = 0.3 + Math.random() * 0.2;
    }
  }
  addLog(s, "narrator", `Làng có ${count} người, trong đó có ${roles.filter((r) => isWolf(r)).length} con Sói. Mỗi người nhận một lá vai bí mật.`);
  return s;
}

/* ------------------------------ Suspicion ------------------------------ */

function bump(s: WState, observer: string, target: string, delta: number) {
  const row = s.sus[observer];
  if (!row || row[target] === undefined) return;
  const obs = byId(s, observer);
  // Wolves never suspect their own pack and ignore evidence against themselves.
  if (obs?.role === "wolf" && byId(s, target)?.role === "wolf") return;
  row[target] = Math.max(0, Math.min(1, row[target] + delta));
}

function knownTo(s: WState, observer: string, target: string): boolean | undefined {
  return s.seerResults[observer]?.[target];
}

/** Most suspicious alive player for a bot (excluding itself), with optional filter. */
function mostSuspicious(s: WState, botId: string, filter: (p: WPlayer) => boolean = () => true) {
  const row = s.sus[botId] || {};
  const cands = alive(s).filter((p) => p.id !== botId && filter(p));
  if (!cands.length) return null;
  return cands.reduce((best, p) => ((row[p.id] ?? 0.4) + Math.random() * 0.08 > (row[best.id] ?? 0.4) ? p : best), cands[0]);
}

/* -------------------------------- Night -------------------------------- */

export function botNightActions(s: WState) {
  const living = alive(s);
  // Cupid (Night 1 only)
  if (s.day === 1 && !s.cupidDone) {
    const cupid = living.find((p) => p.role === "cupid" && !p.isHuman);
    if (cupid && !s.lovers) {
      const candidates = shuffle([...living]);
      s.lovers = [candidates[0].id, candidates[1].id];
      s.cupidDone = true;
      addLog(s, "narrator", "💘 Thần Tình Yêu đã bí mật se duyên cho hai người trong làng.");
    }
  }

  // Guard
  const guard = living.find((p) => p.role === "guard" && !p.isHuman);
  if (guard && s.guard === null) {
    const claimedSeer = living.find((p) => p.claim === "seer" && p.id !== s.lastGuarded);
    const options = living.filter((p) => p.id !== s.lastGuarded);
    const pick = claimedSeer && Math.random() < 0.7 ? claimedSeer : rnd(options.filter((p) => (s.sus[guard.id]?.[p.id] ?? 0.4) < 0.55)) ?? rnd(options);
    s.guard = pick?.id ?? null;
  }

  // Wolves (including Wolf Cub & White Wolf)
  const humanWolf = living.find((p) => p.isHuman && isWolf(p.role));
  if (!humanWolf && s.wolfTarget === null) {
    const wolves = living.filter((p) => isWolf(p.role));
    const prey = living.filter((p) => !isWolf(p.role));
    if (wolves.length && prey.length) {
      const claimed = prey.find((p) => p.claim === "seer");
      const threat = (p: WPlayer) => {
        if (p.isHuman) return 0.5 + Math.random() * 0.3;
        const row = s.sus[p.id] || {};
        return wolves.reduce((a, w) => a + (row[w.id] ?? 0.4), 0) / wolves.length + Math.random() * 0.25;
      };
      s.wolfTarget = claimed && Math.random() < 0.8 ? claimed.id : prey.reduce((a, b) => (threat(b) > threat(a) ? b : a), prey[0]).id;
      if (s.wolfBonusKills > 0 && prey.length > 1) {
        const remainingPrey = prey.filter((p) => p.id !== s.wolfTarget);
        s.wolfTarget2 = remainingPrey[0]?.id ?? null;
      }
    }
  }

  // White Wolf (every 2 nights: day 2, 4...)
  if (s.day % 2 === 0) {
    const whiteWolf = living.find((p) => p.role === "white_wolf" && !p.isHuman);
    if (whiteWolf && !s.whiteWolfTarget) {
      const otherWolves = living.filter((p) => isWolf(p.role) && p.id !== whiteWolf.id);
      if (otherWolves.length && Math.random() < 0.75) {
        s.whiteWolfTarget = rnd(otherWolves)?.id ?? null;
      }
    }
  }

  // Seer
  const seer = living.find((p) => p.role === "seer" && !p.isHuman);
  if (seer && s.seerCheck === null) {
    const unknown = (p: WPlayer) => knownTo(s, seer.id, p.id) === undefined;
    const t = mostSuspicious(s, seer.id, unknown);
    if (t) {
      s.seerCheck = t.id;
      s.seerResults[seer.id] = { ...(s.seerResults[seer.id] || {}), [t.id]: isWolf(t.role) };
      s.sus[seer.id][t.id] = isWolf(t.role) ? 1 : 0;
    }
  }
}

export function botWitch(s: WState) {
  const witch = alive(s).find((p) => p.role === "witch" && !p.isHuman);
  if (!witch) return;
  const victim = byId(s, s.wolfTarget);
  if (victim && !s.healUsed && s.wolfTarget !== s.guard) {
    const important = victim.claim === "seer" || victim.id === witch.id || victim.role === "elder";
    if (important || (s.day === 1 && Math.random() < 0.65) || Math.random() < 0.25) {
      s.healed = true;
      s.healUsed = true;
    }
  }
  if (!s.poisonUsed && s.day >= 2) {
    const t = mostSuspicious(s, witch.id);
    if (t && (s.sus[witch.id]?.[t.id] ?? 0) > 0.78) {
      s.poisonTarget = t.id;
      s.poisonUsed = true;
    }
  }
}

/** Resolve the night; returns ids that died. */
export function resolveNight(s: WState): string[] {
  const deaths: { id: string; cause: DeathCause }[] = [];

  // 1. Wolves attack target 1
  if (s.wolfTarget && s.wolfTarget !== s.guard && !s.healed) {
    const targetP = byId(s, s.wolfTarget);
    if (targetP && targetP.role === "elder" && (s.elderLives[targetP.id] ?? 2) > 1) {
      s.elderLives[targetP.id] -= 1;
      addLog(s, "narrator", `🛡️ Già Làng ${targetP.name} bị bầy Sói cắn nhưng kiên cường sống sót nhờ 2 mạng!`);
    } else {
      deaths.push({ id: s.wolfTarget, cause: "wolf" });
    }
  }

  // 2. Bonus kill from Wolf Cub death
  if (s.wolfTarget2 && s.wolfTarget2 !== s.guard && !deaths.some((d) => d.id === s.wolfTarget2)) {
    deaths.push({ id: s.wolfTarget2, cause: "wolf" });
  }

  // 3. White wolf kill
  if (s.whiteWolfTarget && !deaths.some((d) => d.id === s.whiteWolfTarget)) {
    deaths.push({ id: s.whiteWolfTarget, cause: "white_wolf" });
  }

  // 4. Witch poison
  if (s.poisonTarget && !deaths.some((d) => d.id === s.poisonTarget)) {
    deaths.push({ id: s.poisonTarget, cause: "poison" });
  }

  // Apply all deaths
  for (const d of deaths) kill(s, d.id, d.cause);

  s.lastGuarded = s.guard;
  s.guard = null;
  s.wolfTarget = null;
  s.wolfTarget2 = null;
  s.whiteWolfTarget = null;
  s.wolfBonusKills = 0;
  s.seerCheck = null;
  s.healed = false;
  s.poisonTarget = null;
  s.dawnDeaths = deaths.map((d) => d.id);
  return s.dawnDeaths;
}

export function kill(s: WState, id: string, cause: DeathCause) {
  const p = byId(s, id);
  if (!p || !p.alive) return;
  p.alive = false;
  p.cause = cause;
  p.diedDay = s.day;

  // If Wolf Cub dies, wolves get bonus kill next night
  if (p.role === "wolf_cub") {
    s.wolfBonusKills = 1;
    addLog(s, "narrator", "🐾 Sói Con đã chết! Đêm mai bầy Sói sẽ nổi cơn thịnh nộ và được cắn 2 người.");
  }

  // Deaths reveal roles publicly → everyone updates.
  for (const obs of Object.keys(s.sus)) {
    if (isWolf(p.role)) {
      for (const [voter, target] of Object.entries(s.votes)) if (target === id) bump(s, obs, voter, -0.12);
    } else if (cause === "vote") {
      for (const [voter, target] of Object.entries(s.votes)) if (target === id) bump(s, obs, voter, 0.14);
    }
  }
  if (p.role === "hunter" && cause !== "poison") s.pendingHunter = id;

  // Lovers suicide: if one lover dies, the other commits suicide
  if (s.lovers && s.lovers.includes(id)) {
    const partnerId = s.lovers[0] === id ? s.lovers[1] : s.lovers[0];
    const partner = byId(s, partnerId);
    if (partner && partner.alive) {
      addLog(s, "death", `💔 ${partner.name} không chịu nổi nỗi đau mất người yêu (${p.name}) nên đã chết theo!`);
      partner.alive = false;
      partner.cause = "lover";
      partner.diedDay = s.day;
      if (partner.role === "hunter") s.pendingHunter = partner.id;
    }
  }
}

export function botHunterShot(s: WState, hunterId: string): string | null {
  const t = mostSuspicious(s, hunterId);
  return t?.id ?? null;
}

/* ---------------------------------- Day --------------------------------- */

export function checkWinner(s: WState): Team | null {
  const living = alive(s);
  // Lovers win condition: if only the 2 lovers remain alive
  if (s.lovers && living.length === 2 && living.every((p) => s.lovers!.includes(p.id))) {
    return "lovers";
  }
  const wolves = living.filter((p) => isWolf(p.role)).length;
  if (wolves === 0) return "village";
  if (wolves >= living.length - wolves) return "wolves";
  return null;
}

const T = {
  accuse: [
    "Mình thấy {X} hơi sus 🤨",
    "{X} im im từ sáng, nghi lắm nha",
    "Vote {X} đi anh em, linh cảm mạnh",
    "{X} nói chuyện y chang sói hôm qua",
    "Ai thấy {X} lấp lửng không? Mình thấy đó",
    "Phiếu của mình cho {X}, không bàn cãi",
  ],
  defend: ["Mình dân thường thôi mà 😭", "Đừng vote mình, mình còn deadline!", "Bình tĩnh, mình không phải sói đâu", "Thề có KPI, mình trong sạch"],
  rip: ["RIP {D} 🕯️ đêm qua căng thật", "Tội {D}, chưa kịp nói gì", "{D} ra đi, sói chọn kỹ ghê"],
  calm: ["Bình tĩnh phân tích nào mọi người", "Ai có info gì chia sẻ đi", "Đêm nay Bảo Vệ cố lên 🙏", "Hôm nay vote trật là toang"],
  peaceful: ["Đêm qua yên bình ghê, Bảo Vệ hay Phù Thủy làm tốt quá 👏", "Không ai chết, vui ghê. Nhưng sói vẫn còn đó"],
  seerWolf: ["Mình là Tiên Tri 🔮. Đêm qua soi {X}: SÓI 🐺. Treo {X}!", "Tiên Tri đây. {X} là SÓI, chắc chắn 100%"],
  seerGood: ["Mình là Tiên Tri 🔮. {X} là người tốt ✅, đừng vote nhầm"],
  fakeSeer: ["Tôi mới là Tiên Tri thật! {X} là SÓI, tin tôi đi", "Claim Tiên Tri: {X} là sói 🐺. Ai claim khác là sói giả"],
  agree: ["Đồng ý với {H} 👍", "{H} nói có lý đó", "+1 với {H}"],
  doubt: ["{H} đang dắt mũi cả làng hả?", "Hơi nghi {H} rồi đó nha"],
};
const fill = (t: string, m: Record<string, string>) => t.replace(/\{(\w)\}/g, (_, k) => m[k] ?? "");

/** One round of bot discussion. Returns chat lines to append progressively. */
export function botDiscussion(s: WState): { speaker: string; text: string }[] {
  const lines: { speaker: string; text: string }[] = [];
  const living = alive(s);
  const dawn = s.dawnDeaths.map((id) => byId(s, id)!).filter(Boolean);

  for (const bot of shuffle(living.filter((p) => !p.isHuman))) {
    if (Math.random() > 0.35 + bot.temper * 0.5) continue;
    // Seer reveal: likely once a wolf is found, or when about to be voted.
    if (bot.role === "seer" && !bot.claim) {
      const found = Object.entries(s.seerResults[bot.id] || {}).find(([id, w]) => w && byId(s, id)?.alive);
      if (found && Math.random() < 0.75) {
        bot.claim = "seer";
        lines.push({ speaker: bot.id, text: fill(rnd(T.seerWolf), { X: byId(s, found[0])!.name }) });
        for (const o of living) if (!o.isHuman && o.id !== bot.id) bump(s, o.id, found[0], 0.45);
        continue;
      }
    }
    // Wolf may fake-claim when a real seer has claimed, to split the village.
    if (bot.role === "wolf" && !bot.claim && living.some((p) => p.claim === "seer" && p.role !== "wolf") && Math.random() < 0.45) {
      const realSeer = living.find((p) => p.claim === "seer" && p.role !== "wolf")!;
      bot.claim = "seer";
      lines.push({ speaker: bot.id, text: fill(rnd(T.fakeSeer), { X: realSeer.name }) });
      for (const o of living) if (!o.isHuman && o.id !== bot.id) {
        bump(s, o.id, realSeer.id, 0.18);
        bump(s, o.id, bot.id, 0.12);
      }
      continue;
    }
    if (dawn.length && Math.random() < 0.3) {
      lines.push({ speaker: bot.id, text: fill(rnd(T.rip), { D: dawn[0].name }) });
      continue;
    }
    if (!dawn.length && s.day > 1 && Math.random() < 0.25) {
      lines.push({ speaker: bot.id, text: rnd(T.peaceful) });
      continue;
    }
    const target =
      bot.role === "wolf"
        ? mostSuspicious(s, bot.id, (p) => p.role !== "wolf")
        : mostSuspicious(s, bot.id);
    if (target && Math.random() < 0.75) {
      lines.push({ speaker: bot.id, text: fill(rnd(T.accuse), { X: target.name }) });
      for (const o of living) if (!o.isHuman && o.id !== bot.id) bump(s, o.id, target.id, 0.06 * bot.temper);
    } else lines.push({ speaker: bot.id, text: rnd(T.calm) });
  }
  // Players under heavy pressure defend themselves.
  const pressure = new Map<string, number>();
  for (const l of lines) for (const p of living) if (l.text.includes(p.name)) pressure.set(p.id, (pressure.get(p.id) ?? 0) + 1);
  for (const [id, n] of pressure) {
    const p = byId(s, id)!;
    if (!p.isHuman && n >= 2 && Math.random() < 0.7) lines.push({ speaker: id, text: rnd(T.defend) });
  }
  return lines.slice(0, Math.max(4, Math.ceil(living.length * 0.9)));
}

/** Bots react to what the human wrote (accusations, seer claims). */
export function reactToHuman(s: WState, text: string): { speaker: string; text: string }[] {
  const me = human(s);
  const low = text.toLowerCase();
  const living = alive(s).filter((p) => !p.isHuman);
  const mentioned = alive(s).filter((p) => !p.isHuman && low.includes(p.name.toLowerCase().split(" ")[0]));
  const accuse = /(sói|soi|sus|nghi|vote|treo|giết|khả nghi)/.test(low);
  const good = /(tốt|dân|trắng|trong sạch|không phải sói)/.test(low);
  const claimSeer = /(tôi|mình|em|tui|t)\s*(là)?\s*tiên tri/.test(low);
  if (claimSeer) me.claim = "seer";
  const out: { speaker: string; text: string }[] = [];
  for (const target of mentioned) {
    for (const bot of living) {
      if (bot.id === target.id) continue;
      const cred = claimSeer ? 0.35 : 0.12;
      if (accuse && !good) bump(s, bot.id, target.id, cred);
      if (good) bump(s, bot.id, target.id, -cred);
    }
  }
  const responders = shuffle(living).slice(0, mentioned.length ? 2 : 1);
  for (const bot of responders) {
    if (Math.random() < 0.55) continue;
    if (mentioned.some((m) => m.id === bot.id) && accuse) out.push({ speaker: bot.id, text: rnd(T.defend) });
    else if ((s.sus[bot.id]?.[me.id] ?? 0.4) > 0.6) out.push({ speaker: bot.id, text: fill(rnd(T.doubt), { H: me.name }) });
    else out.push({ speaker: bot.id, text: fill(rnd(T.agree), { H: me.name }) });
  }
  return out;
}

/** Bot votes (human vote is supplied separately). */
export function botVotes(s: WState): Record<string, string | null> {
  const votes: Record<string, string | null> = {};
  const living = alive(s);
  const wolves = living.filter((p) => p.role === "wolf");
  // Wolves coordinate on the most-accused non-wolf.
  const tally = new Map<string, number>();
  for (const bot of living.filter((p) => !p.isHuman && p.role !== "wolf")) {
    const t = mostSuspicious(s, bot.id);
    if (t) tally.set(t.id, (tally.get(t.id) ?? 0) + 1);
  }
  const wolfPick =
    [...tally.entries()].filter(([id]) => byId(s, id)?.role !== "wolf").sort((a, b) => b[1] - a[1])[0]?.[0] ??
    mostSuspicious(s, wolves[0]?.id ?? "", (p) => p.role !== "wolf")?.id ??
    null;
  for (const bot of living.filter((p) => !p.isHuman)) {
    if (bot.role === "wolf") votes[bot.id] = wolfPick;
    else {
      const row = s.sus[bot.id] || {};
      const t = mostSuspicious(s, bot.id);
      // Unsure villagers sometimes abstain.
      votes[bot.id] = t && (row[t.id] ?? 0) > 0.42 ? t.id : Math.random() < 0.5 ? t?.id ?? null : null;
    }
  }
  return votes;
}

export function tallyVotes(votes: Record<string, string | null>) {
  const count = new Map<string, number>();
  for (const t of Object.values(votes)) if (t) count.set(t, (count.get(t) ?? 0) + 1);
  const sorted = [...count.entries()].sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return { executed: null as string | null, count };
  if (sorted[1] && sorted[1][1] === sorted[0][1]) return { executed: null as string | null, count };
  return { executed: sorted[0][0], count };
}
