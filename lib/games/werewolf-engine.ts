/**
 * Ma Sói engine: roles, night resolution, bot reasoning (suspicion model),
 * bot chat, voting and win conditions. Pure functions over a plain state.
 */

export type Role = "wolf" | "seer" | "guard" | "witch" | "hunter" | "villager";
export type Team = "wolves" | "village";
export type Phase = "lobby" | "reveal" | "night" | "dawn" | "discussion" | "vote" | "hunter" | "over";
export type NightStep = "guard" | "wolves" | "seer" | "witch" | "done";
export type DeathCause = "wolf" | "vote" | "poison" | "hunter";

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
  seer: { name: "Tiên Tri", team: "village", emoji: "🔮", color: "#e4e4e7", desc: "Mỗi đêm soi 1 người: là Sói hay không.", tip: "Lộ vai sớm dễ bị cắn. Chọn thời điểm công bố." },
  guard: { name: "Bảo Vệ", team: "village", emoji: "🛡️", color: "#d4d4d8", desc: "Mỗi đêm che chở 1 người khỏi Sói. Không bảo vệ 1 người 2 đêm liền.", tip: "Đoán xem Sói định cắn ai." },
  witch: { name: "Phù Thủy", team: "village", emoji: "🧪", color: "#e4e4e7", desc: "1 bình Cứu (hồi sinh nạn nhân của Sói) và 1 bình Độc (giết 1 người).", tip: "Mỗi bình chỉ dùng 1 lần trong cả ván." },
  hunter: { name: "Thợ Săn", team: "village", emoji: "🏹", color: "#d4d4d8", desc: "Khi chết (trừ bị Độc), được bắn chết 1 người.", tip: "Ghi nhớ kẻ khả nghi nhất để bắn khi cần." },
  villager: { name: "Dân Làng", team: "village", emoji: "🧑‍💼", color: "#a1a1aa", desc: "Không có phép, chỉ có lý luận và lá phiếu.", tip: "Quan sát ai đổ vote vô lý." },
};

export const ROLE_SETS: Record<number, Role[]> = {
  8: ["wolf", "wolf", "seer", "guard", "witch", "hunter", "villager", "villager"],
  10: ["wolf", "wolf", "wolf", "seer", "guard", "witch", "hunter", "villager", "villager", "villager"],
  12: ["wolf", "wolf", "wolf", "seer", "guard", "witch", "hunter", "villager", "villager", "villager", "villager", "villager"],
};

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

export function createGame(count: number, me: { id: string; name: string; avatar: string }): WState {
  const roles = shuffle(ROLE_SETS[count] ?? ROLE_SETS[8]);
  const names = shuffle(BOT_NAMES).slice(0, count - 1);
  const players: WPlayer[] = roles.map((role, i) =>
    i === 0
      ? { id: me.id, name: me.name, avatar: me.avatar, role, alive: true, isHuman: true, temper: 0.5 }
      : { id: `bot-${i}`, name: names[i - 1], avatar: `kokonut:${names[i - 1].toLowerCase()}:${i}`, role, alive: true, isHuman: false, temper: 0.25 + Math.random() * 0.7 }
  );
  const ordered = shuffle(players);
  const s: WState = {
    players: ordered,
    day: 1,
    phase: "reveal",
    step: "guard",
    lastGuarded: null,
    guard: null,
    wolfTarget: null,
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
      if (p.role === "wolf") s.sus[p.id][q.id] = q.role === "wolf" ? 0 : 0.5;
      else s.sus[p.id][q.id] = 0.3 + Math.random() * 0.2;
    }
  }
  addLog(s, "narrator", `Làng có ${count} người, trong đó có ${roles.filter((r) => r === "wolf").length} con Sói. Mỗi người nhận một lá vai bí mật.`);
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
  // Guard
  const guard = living.find((p) => p.role === "guard" && !p.isHuman);
  if (guard && s.guard === null) {
    const claimedSeer = living.find((p) => p.claim === "seer" && p.id !== s.lastGuarded);
    const options = living.filter((p) => p.id !== s.lastGuarded);
    const pick = claimedSeer && Math.random() < 0.7 ? claimedSeer : rnd(options.filter((p) => (s.sus[guard.id]?.[p.id] ?? 0.4) < 0.55)) ?? rnd(options);
    s.guard = pick?.id ?? null;
  }
  // Wolves (if human is not a living wolf, bots decide)
  const humanWolf = living.find((p) => p.isHuman && p.role === "wolf");
  if (!humanWolf && s.wolfTarget === null) {
    const wolves = living.filter((p) => p.role === "wolf");
    const prey = living.filter((p) => p.role !== "wolf");
    if (wolves.length && prey.length) {
      const claimed = prey.find((p) => p.claim === "seer");
      // Threat: players who suspect wolves the most get eaten first.
      const threat = (p: WPlayer) => {
        if (p.isHuman) return 0.5 + Math.random() * 0.3;
        const row = s.sus[p.id] || {};
        return wolves.reduce((a, w) => a + (row[w.id] ?? 0.4), 0) / wolves.length + Math.random() * 0.25;
      };
      s.wolfTarget = claimed && Math.random() < 0.8 ? claimed.id : prey.reduce((a, b) => (threat(b) > threat(a) ? b : a), prey[0]).id;
    }
  }
  // Seer
  const seer = living.find((p) => p.role === "seer" && !p.isHuman);
  if (seer && s.seerCheck === null) {
    const unknown = (p: WPlayer) => knownTo(s, seer.id, p.id) === undefined;
    const t = mostSuspicious(s, seer.id, unknown);
    if (t) {
      s.seerCheck = t.id;
      s.seerResults[seer.id] = { ...(s.seerResults[seer.id] || {}), [t.id]: t.role === "wolf" };
      s.sus[seer.id][t.id] = t.role === "wolf" ? 1 : 0;
    }
  }
}

export function botWitch(s: WState) {
  const witch = alive(s).find((p) => p.role === "witch" && !p.isHuman);
  if (!witch) return;
  const victim = byId(s, s.wolfTarget);
  if (victim && !s.healUsed && s.wolfTarget !== s.guard) {
    const important = victim.claim === "seer" || victim.id === witch.id;
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
  if (s.wolfTarget && s.wolfTarget !== s.guard && !s.healed) deaths.push({ id: s.wolfTarget, cause: "wolf" });
  if (s.poisonTarget && !deaths.some((d) => d.id === s.poisonTarget)) deaths.push({ id: s.poisonTarget, cause: "poison" });
  for (const d of deaths) kill(s, d.id, d.cause);
  s.lastGuarded = s.guard;
  s.guard = null;
  s.wolfTarget = null;
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
  // Deaths reveal roles publicly → everyone updates.
  for (const obs of Object.keys(s.sus)) {
    if (p.role === "wolf") {
      // Those who pushed this wolf look better; those who defended look worse.
      for (const [voter, target] of Object.entries(s.votes)) if (target === id) bump(s, obs, voter, -0.12);
    } else if (cause === "vote") {
      for (const [voter, target] of Object.entries(s.votes)) if (target === id) bump(s, obs, voter, 0.14);
    }
  }
  if (p.role === "hunter" && cause !== "poison") s.pendingHunter = id;
}

export function botHunterShot(s: WState, hunterId: string): string | null {
  const t = mostSuspicious(s, hunterId);
  return t?.id ?? null;
}

/* ---------------------------------- Day --------------------------------- */

export function checkWinner(s: WState): Team | null {
  const living = alive(s);
  const wolves = living.filter((p) => p.role === "wolf").length;
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
