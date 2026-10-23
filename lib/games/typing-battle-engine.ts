/* Engine Typing Battle: không phụ thuộc React, chỉ thao tác trên đối tượng Game. */
import {
  FusionDef,
  HAND_HOLD,
  HAND_MAX,
  ITEMS,
  ITEM_BAG,
  ItemType,
  LEFT_KEYS,
  POOL,
  RIGHT_KEYS,
  findFusion,
} from "./typing-battle-data";

export const W = 1100;
export const H = 620;

export interface LaneDef {
  id: number;
  y: number;
  dir: 1 | -1; // 1: Trái sang Phải, -1: Phải sang Trái
  speed: number;
}

/** 3 làn băng chuyền chạy ngang qua giữa màn hình */
export const LANES: LaneDef[] = [
  { id: 0, y: 215, dir: 1, speed: 92 },
  { id: 1, y: 310, dir: -1, speed: 92 },
  { id: 2, y: 405, dir: 1, speed: 92 },
];

/** Tương thích ngược: vị trí mặc định nếu cần */
export const SLOTS = [
  { x: 360, y: 195 },
  { x: 550, y: 295 },
  { x: 740, y: 195 },
  { x: 550, y: 395 },
];

export type Mode = 1 | 2 | 3;
export type Sfx = "fire" | "hit" | "collect" | "fuse" | "win" | "count" | "go";

export interface Hooks {
  sfx: (n: Sfx) => void;
}

export interface HandCard {
  type: ItemType;
  t: number;
}

export interface Item {
  id: number;
  type: ItemType;
  lane: number;
  dir: 1 | -1;
  x: number;
  y: number;
  vx: number;
  slot: number;
  /** đoạn text hiển thị cho P1 / P2 */
  disp: [string, string];
  /** đoạn text bỏ khoảng trắng (khoảng trắng tự bỏ qua khi gõ) */
  keys: [string, string];
  age: number;
  life: number;
  state: "live" | "taken" | "expired";
  by: 0 | 1 | -1;
  st: number;
}

export interface Fighter {
  id: 0 | 1;
  name: string;
  bot: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  ghost: number;
  buf: string;
  word: string;
  ammo: number;
  armor: number;
  reflectT: number;
  reflectMul: number;
  lifeT: number;
  slowT: number;
  freezeT: number;
  lastKey: number;
  combo: number;
  err: number;
  idx: number;
  text: string;
  errors: number;
  hand: HandCard[];
  lock: Item | null;
  /** true sau khi bấm Space lần 1: bắt đầu "ghi" (gõ) cụm từ của thẻ đang khóa */
  typing: boolean;
  fireN: number;
  hitN: number;
  botT: number;
  botItem: Item | null;
  botWait: number;
}

export interface Missile {
  x: number;
  y: number;
  dir: 1 | -1;
  owner: 0 | 1;
  dmg: number;
  reflected: boolean;
  big: boolean;
  ph: number;
  age: number;
  yy: number;
  /** điểm xuất phát, để vẽ tia điện kéo dài từ người bắn */
  ox: number;
  oy: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  col: string;
  sz: number;
}
export interface Ring {
  x: number;
  y: number;
  r: number;
  max: number;
  life: number;
  t: number;
  col: string;
}
/** Mảnh kính vỡ khi đòn đánh trúng (Shatter). */
export interface Shard { x: number; y: number; vx: number; vy: number; rot: number; vr: number; s: number; life: number; max: number; col: string }
/** Tia sáng tỏa ra từ một lõi (Nexus Rays). */
export interface Ray { x: number; y: number; t: number; life: number; col: string; n: number; len: number; rot: number }
export interface FloatText {
  x: number;
  y: number;
  txt: string;
  col: string;
  t: number;
  big: boolean;
}
export interface Banner {
  id: number;
  kind: "activate" | "fusion";
  owner: 0 | 1;
  type?: ItemType;
  fusion?: FusionDef;
  t: number;
}

export interface Game {
  mode: Mode;
  diff: number;
  fighters: [Fighter, Fighter];
  t: number;
  count: number;
  goT: number;
  phase: "count" | "play" | "over";
  winner: -1 | 0 | 1;
  missiles: Missile[];
  items: Item[];
  parts: Particle[];
  rings: Ring[];
  shards: Shard[];
  rays: Ray[];
  texts: FloatText[];
  banners: Banner[];
  /** Chuỗi từ khóa dùng chung cho cả hai người (Đọ tên lửa) và vị trí từ hiện tại. */
  seq: string[];
  seqI: number;
  spawnT: number;
  shake: number;
  flashA: number;
  flashC: string;
  lastCount: number;
  uid: number;
}

const fighter = (id: 0 | 1, name: string, bot: boolean): Fighter => ({
  id, name, bot,
  x: id ? W - 56 : 56, y: id ? 60 : H - 44,
  hp: 0, maxHp: 0, ghost: 0, buf: "", word: "", ammo: 0, armor: 0,
  reflectT: 0, reflectMul: 1, lifeT: 0, slowT: 0, freezeT: 0, lastKey: 0,
  combo: 0, err: 0, idx: 0, text: "", errors: 0, hand: [], lock: null, typing: false,
  fireN: 0, hitN: 0, botT: 0, botItem: null, botWait: 0,
});

const rnd = <T,>(a: T[]): T => a[(Math.random() * a.length) | 0];

export function pickWord(f: Fighter, minLen = 4, maxLen = 7) {
  const pool = POOL[f.id].filter((w) => w.length >= minLen && w.length <= maxLen && w !== f.word);
  return rnd(pool);
}

/** Luôn có sẵn vài từ phía trước từ hiện tại để hiển thị trên mặt trụ. */
const SHARED_POOL = Array.from(new Set([...POOL[0], ...POOL[1]])).filter((w) => w.length >= 4 && w.length <= 7);
function ensureSeq(g: Game) {
  while (g.seq.length < g.seqI + 5) {
    const last = g.seq[g.seq.length - 1];
    g.seq.push(rnd(SHARED_POOL.filter((w) => w !== last)));
  }
  for (const f of g.fighters) f.word = g.seq[g.seqI];
}

export function createGame(opts: { mode: Mode; vsBot: boolean; diff: number; names: [string, string] }): Game {
  const f0 = fighter(0, opts.names[0], false);
  const f1 = fighter(1, opts.names[1], opts.vsBot);
  const g: Game = {
    mode: opts.mode, diff: opts.diff, fighters: [f0, f1], t: 0, count: 3, goT: 0, phase: "count", winner: -1,
    missiles: [], items: [], parts: [], rings: [], shards: [], rays: [], texts: [], banners: [], seq: [], seqI: 0, spawnT: 1,
    shake: 0, flashA: 0, flashC: "#fff", lastCount: 0, uid: 1,
  };
  for (const f of g.fighters) {
    if (opts.mode === 1) { f.maxHp = f.hp = f.ghost = 5000; }
    else if (opts.mode === 2) { f.maxHp = f.hp = f.ghost = 3000; f.ammo = 1; }
    else {
      f.maxHp = f.hp = f.ghost = 1;
      const words: string[] = [];
      let len = 0, last = "";
      while (len < 115) {
        const w = rnd(POOL[f.id].filter((x) => x !== last && x.length <= 7));
        words.push(w); len += w.length + 1; last = w;
      }
      f.text = words.join(" ");
    }
  }
  if (opts.mode === 1) ensureSeq(g);
  return g;
}

/* ------------------------------ hiệu ứng ------------------------------ */

export function burst(g: Game, x: number, y: number, col: string, n = 26, sp = 260) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, s = Math.random() * sp;
    g.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.6, max: 1, col, sz: 1.5 + Math.random() * 3 });
  }
}
const ring = (g: Game, x: number, y: number, max: number, life: number, col: string, r = 10) => g.rings.push({ x, y, r, max, life, t: 0, col });
const raysAt = (g: Game, x: number, y: number, col: string, len = 140, life = 0.5, n = 14) =>
  g.rays.push({ x, y, t: 0, life, col, n, len, rot: Math.random() * 6.283 });
function shatter(g: Game, x: number, y: number, col: string, n = 22) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, sp = 120 + Math.random() * 330;
    g.shards.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, rot: Math.random() * 6.283, vr: (Math.random() - 0.5) * 14, s: 6 + Math.random() * 14, life: 0.7 + Math.random() * 0.6, max: 1.3, col: Math.random() < 0.35 ? "#ffffff" : col });
  }
}
const popText = (g: Game, x: number, y: number, txt: string, col: string, big = false) => g.texts.push({ x, y: Math.max(40, Math.min(H - 30, y)), txt, col, t: 0, big });

export function launch(g: Game, f: Fighter, dmg: number, big = false, h?: Hooks) {
  f.fireN++;
  const x = f.x, y = f.y + (f.id ? 70 : -70);
  g.missiles.push({ x, y, dir: f.id ? 1 : -1, owner: f.id, dmg, reflected: false, big, ph: Math.random() * 6, age: 0, yy: y, ox: x, oy: y });
  raysAt(g, x, y, f.id ? "#e27d85" : "#7aa2f7", 70, 0.3, 8);
  burst(g, x, y, f.id ? "#ff4f88" : "#3ad0ff", 10, 140);
  ring(g, x, y, 40, 0.3, f.id ? "#ff4f88" : "#3ad0ff", 6);
  h?.sfx("fire");
}

function hit(g: Game, m: Missile, h: Hooks) {
  const t = g.fighters[1 - m.owner], s = g.fighters[m.owner];
  if (t.reflectT > 0 && !m.reflected) {
    const mul = t.reflectMul;
    t.reflectT = 0; t.reflectMul = 1;
    popText(g, t.x, t.y - 110, "PHẢN DAME!", "#b878ff", true);
    burst(g, t.x, t.y, "#b878ff", 34);
    ring(g, t.x, t.y + (t.id ? 70 : -70), 110, 0.5, "#b878ff");
    g.missiles.push({ x: t.x, y: t.y + (t.id ? 70 : -70), dir: t.id ? 1 : -1, owner: t.id, dmg: Math.round(m.dmg * mul), reflected: true, big: m.big, ph: 0, age: 0, yy: t.y + (t.id ? 70 : -70), ox: t.x, oy: t.y + (t.id ? 70 : -70) });
    t.hitN++;
    return;
  }
  let dmg = m.dmg;
  if (t.armor > 0) {
    const a = Math.min(t.armor, dmg);
    t.armor -= a; dmg -= a;
    if (a) popText(g, t.x, t.y - 90, "-" + a + " giáp", "#6ab8ff");
  }
  t.hp = Math.max(0, t.hp - dmg);
  if (s.lifeT > 0) { s.hp = Math.min(s.maxHp, s.hp + m.dmg); popText(g, s.x, s.y - 90, "+" + m.dmg, "#40e880"); }
  popText(g, t.x, t.y - 50, "-" + m.dmg, "#ff7070", true);
  const hc = s.id ? "#e27d85" : "#7aa2f7";
  shatter(g, t.x, t.y, hc, m.big ? 34 : 22);
  raysAt(g, t.x, t.y, "#ffffff", m.big ? 260 : 190, 0.55, m.big ? 22 : 16);
  raysAt(g, t.x, t.y, hc, 120, 0.4, 10);
  burst(g, t.x, t.y, hc, 24, 300);
  ring(g, t.x, t.y, 120, 0.45, "#ffffff", 4);
  g.shake = 0.4; g.flashA = 0.25; g.flashC = "#ff7a3a"; t.hitN++;
  h.sfx("hit");
  if (t.hp <= 0) finish(g, s.id, h);
}

export function finish(g: Game, winner: 0 | 1, h: Hooks) {
  if (g.phase === "over") return;
  g.phase = "over"; g.winner = winner;
  h.sfx("win");
}

/* ------------------------- thẻ, hợp thể, kỹ năng ------------------------- */

/** Bỏ khóa mục tiêu và xóa chữ đang gõ. */
const drop = (f: Fighter) => { f.buf = ""; f.lock = null; f.typing = false; };

let bannerUid = 1;
const pushBanner = (g: Game, b: Omit<Banner, "id" | "t">) => g.banners.push({ ...b, id: bannerUid++, t: 0 });

function applyEffect(g: Game, f: Fighter, type: ItemType) {
  const o = g.fighters[1 - f.id];
  switch (type) {
    case "shield": f.armor += 700; break;
    case "reflect": f.reflectT = 8; f.reflectMul = 1; break;
    case "wipe": drop(o); o.freezeT = 2; break;
    case "steal": f.lifeT = 5; break;
    case "slow": o.slowT = 6; break;
  }
}

/** Kích hoạt một thẻ trên tay (tự hết giờ, đầy tay, hoặc bấm bắn khi hết đạn). */
export function activate(g: Game, f: Fighter, type: ItemType, h: Hooks) {
  if (type === "ammo") launch(g, f, 700, false, h);
  else applyEffect(g, f, type);
  const d = ITEMS[type];
  pushBanner(g, { kind: "activate", owner: f.id, type });
  popText(g, f.x, f.y - 110, d.name + "!", d.col, true);
  burst(g, f.x, f.y, d.col, 18, 200);
  raysAt(g, f.x, f.y, d.col, 130, 0.5, 12);
  ring(g, f.x, f.y, 100, 0.45, d.col);
  h.sfx("collect");
}

function fuse(g: Game, f: Fighter, fu: FusionDef, h: Hooks) {
  const o = g.fighters[1 - f.id];
  switch (fu.id) {
    case "mirror": f.armor += 1000; f.reflectT = 10; f.reflectMul = 1.5; break;
    case "seal": drop(o); o.freezeT = 3; o.slowT = 11; break;
    case "bloodarmor": f.armor += 800; f.lifeT = 8; break;
    case "thunder": launch(g, f, 900, true, h); drop(o); o.freezeT = 1.5; break;
    case "venom": {
      const d = Math.min(500, o.hp - 1);
      o.hp -= d; f.hp = Math.min(f.maxHp, f.hp + d);
      f.lifeT = 8; o.slowT = 8;
      popText(g, o.x, o.y - 60, "-" + d, "#9dff7a", true);
      popText(g, f.x, f.y - 60, "+" + d, "#40e880", true);
      o.hitN++;
      break;
    }
  }
  pushBanner(g, { kind: "fusion", owner: f.id, fusion: fu });
  popText(g, f.x, f.y - 120, "HỢP THỂ: " + fu.name, fu.col, true);
  shatter(g, f.x, f.y, fu.col, 30);
  raysAt(g, f.x, f.y, fu.col, 280, 0.8, 24);
  raysAt(g, f.x, f.y, "#ffffff", 160, 0.55, 14);
  ring(g, f.x, f.y, 160, 0.6, fu.col);
  g.shake = 0.3; g.flashA = 0.35; g.flashC = fu.col;
  h.sfx("fuse");
}

function collect(g: Game, f: Fighter, it: Item, h: Hooks) {
  const o = g.fighters[1 - f.id], def = ITEMS[it.type];
  it.state = "taken"; it.by = f.id; it.st = 0;
  drop(f);
  if (o.lock === it) drop(o);
  burst(g, it.x, it.y, def.col, 34, 260); ring(g, it.x, it.y, 90, 0.45, def.col);
  h.sfx("collect");
  if (it.type === "ammo") { f.ammo += 3; popText(g, it.x, it.y - 40, "+3 đạn", def.col, true); return; }
  if (f.hand.length >= HAND_MAX) activate(g, f, f.hand.shift()!.type, h);
  f.hand.push({ type: it.type, t: HAND_HOLD });
  popText(g, it.x, it.y - 40, "+ " + def.name, def.col, true);
}

/** Dùng kỹ năng ở ô `slot` (phím 1-4). Có thẻ hợp thể trong tay thì hợp thể luôn. */
export function castSkill(g: Game, f: Fighter, slot: number, h: Hooks) {
  if (g.phase !== "play" || f.freezeT > 0 || g.mode !== 2) return;
  const c = f.hand[slot];
  if (!c) { f.err = 0.25; return; }
  const pi = f.hand.findIndex((o, i) => i !== slot && findFusion(o.type, c.type));
  if (pi >= 0) {
    const fu = findFusion(f.hand[pi].type, c.type)!;
    f.hand = f.hand.filter((_, i) => i !== slot && i !== pi);
    fuse(g, f, fu, h);
    return;
  }
  f.hand.splice(slot, 1);
  activate(g, f, c.type, h);
}

/* -------------------------------- phím -------------------------------- */

export const keyOf = (it: Item, f: Fighter) => it.keys[f.id];

export function onKey(g: Game, f: Fighter, ch: string, h: Hooks) {
  if (g.phase !== "play" || f.freezeT > 0) return;
  if (f.slowT > 0 && g.t - f.lastKey < 0.75) return;
  f.lastKey = g.t;

  if (g.mode === 1) {
    if (f.word[f.buf.length] === ch) f.buf += ch;
    else { f.buf = f.word[0] === ch ? ch : ""; f.err = 0.25; f.combo = 0; }
  } else if (g.mode === 2) {
    if (f.lock && f.lock.state !== "live") drop(f);
    const target = f.lock ? keyOf(f.lock, f) : "";
    if (f.lock && target[f.buf.length] === ch) f.buf += ch;
    else {
      // Chữ cái đầu chọn thẻ ngay và bắt đầu gõ; gõ sai thì chọn lại
      drop(f);
      const it = g.items.find((i) => i.state === "live" && keyOf(i, f)[0] === ch);
      if (it) { f.lock = it; f.buf = ch; } else { f.err = 0.25; return; }
    }
    if (f.lock && f.buf === keyOf(f.lock, f)) collect(g, f, f.lock, h);
  } else {
    if (f.text[f.idx] === ch) {
      f.idx++;
      while (f.text[f.idx] === " ") f.idx++;
      if (f.idx >= f.text.length) finish(g, f.id, h);
    } else { f.errors++; f.err = 0.2; }
  }
}

export function onFire(g: Game, f: Fighter, h: Hooks) {
  if (g.phase !== "play" || f.freezeT > 0 || g.mode === 3) return;
  if (g.mode === 1) {
    if (f.buf && f.buf === f.word) {
      const dmg = Math.round(f.word.length * 60 * (1 + Math.min(f.combo, 5) * 0.1));
      launch(g, f, dmg, false, h);
      f.combo++;
      // Ai bắn trước thì giành từ này: cả hai bắt đầu lại ở từ kế tiếp
      const o = g.fighters[1 - f.id];
      o.buf = ""; o.combo = 0;
      for (const x of g.fighters) x.buf = "";
      g.seqI++; ensureSeq(g);
    } else { f.buf = ""; f.combo = 0; f.err = 0.25; }
  } else if (f.ammo > 0) {
    f.ammo--; launch(g, f, 350, false, h);
  } else f.err = 0.25;
}

/* --------------------------------- bot --------------------------------- */

const CPS = [0, 1.8, 2.4, 3.2, 4.2, 5.5];

function botStep(g: Game, p: Fighter, dt: number, h: Hooks) {
  p.botT -= dt;
  if (p.botT > 0 || p.freezeT > 0) return;
  p.botT = (1 / (CPS[g.diff] || 3)) * (0.7 + Math.random() * 0.6);
  const mistake = Math.random() < 0.04;
  const wrong = () => RIGHT_KEYS[(Math.random() * RIGHT_KEYS.length) | 0];

  if (g.mode === 1) {
    if (p.buf === p.word) {
      if (p.botWait++ > 0) { p.botWait = 0; onFire(g, p, h); p.botT = 0.5 + Math.random() * 0.5; }
      return;
    }
    onKey(g, p, mistake ? wrong() : p.word[p.buf.length], h);
  } else if (g.mode === 2) {
    if (p.ammo > 0 && Math.random() < 0.5) { onFire(g, p, h); p.botT = 0.5; return; }
    if (p.hand.length && Math.random() < 0.25) { castSkill(g, p, 0, h); p.botT = 0.6; return; }
    if (!p.botItem || p.botItem.state !== "live") {
      p.botItem = null; drop(p);
      const live = g.items.filter((i) => i.state === "live");
      if (!live.length) return;
      const ammo = p.ammo === 0 ? live.filter((i) => i.type === "ammo") : [];
      p.botItem = rnd(ammo.length && Math.random() < 0.8 ? ammo : live);
      p.botT = 0.4 + Math.random() * 0.5;
      return;
    }
    const w = keyOf(p.botItem, p);
    const ch = p.lock === p.botItem ? w[p.buf.length] : w[0];
    onKey(g, p, mistake ? wrong() : ch, h);
    if (mistake) p.botItem = null;
  } else {
    onKey(g, p, mistake ? wrong() : p.text[p.idx], h);
  }
}

/* -------------------------------- vật phẩm -------------------------------- */

function phrase(pid: 0 | 1, words: number, used: string[]): string | null {
  const pool = POOL[pid].filter((w) => w.length <= (words > 1 ? 4 : 5) && !used.includes(w[0]));
  if (!pool.length) return null;
  const first = rnd(pool);
  if (words === 1) return first;
  const rest = POOL[pid].filter((w) => w.length <= 4 && w !== first);
  return first + " " + rnd(rest);
}

function spawnItem(g: Game) {
  const live = g.items.filter((i) => i.state === "live");
  if (live.length >= 4) return;
  // Tìm các lane chưa có item xuất hiện gần điểm xuất phát
  const laneCandidates = LANES.filter((lane) => {
    const spawnX = lane.dir > 0 ? -90 : W + 90;
    return !live.some((it) => it.lane === lane.id && Math.abs(it.x - spawnX) < 260);
  });
  if (!laneCandidates.length) return;
  const lane = rnd(laneCandidates);
  const type = rnd(ITEM_BAG), def = ITEMS[type];
  const liveOnly = g.items.filter((i) => i.state === "live");
  const a = phrase(0, def.words, liveOnly.map((i) => i.keys[0][0]));
  const b = phrase(1, def.words, liveOnly.map((i) => i.keys[1][0]));
  if (!a || !b) return;
  const startX = lane.dir > 0 ? -100 : W + 100;
  const speed = lane.speed + (Math.random() - 0.5) * 6;
  g.items.push({
    id: g.uid++,
    type,
    lane: lane.id,
    dir: lane.dir,
    x: startX,
    y: lane.y,
    vx: lane.dir * speed,
    slot: lane.id,
    disp: [a, b],
    keys: [a.replace(/ /g, ""), b.replace(/ /g, "")],
    age: 0,
    life: 16,
    state: "live",
    by: -1,
    st: 0,
  });
}

/* -------------------------------- cập nhật -------------------------------- */

export function update(g: Game, dt: number, h: Hooks) {
  g.t += dt;
  g.shake = Math.max(0, g.shake - dt);
  g.flashA = Math.max(0, g.flashA - dt * 1.6);
  g.goT = Math.max(0, g.goT - dt);

  if (g.phase === "count") {
    g.count -= dt;
    if (g.count <= 0) { g.phase = "play"; g.t = 0; g.goT = 0.8; h.sfx("go"); }
    else if (Math.ceil(g.count) !== g.lastCount) { g.lastCount = Math.ceil(g.count); h.sfx("count"); }
  }

  for (const f of g.fighters) {
    f.err = Math.max(0, f.err - dt);
    f.ghost += (f.hp - f.ghost) * Math.min(1, dt * 2.2);
    f.reflectT = Math.max(0, f.reflectT - dt); if (f.reflectT === 0) f.reflectMul = 1;
    f.lifeT = Math.max(0, f.lifeT - dt);
    f.slowT = Math.max(0, f.slowT - dt);
    f.freezeT = Math.max(0, f.freezeT - dt);
    if (g.phase === "play") {
      if (f.bot) botStep(g, f, dt, h);
    }
  }

  if (g.mode === 2 && g.phase === "play") {
    g.spawnT -= dt;
    if (g.spawnT <= 0) { spawnItem(g); g.spawnT = 1.2 + Math.random() * 0.8; }
  }
  for (let i = g.items.length - 1; i >= 0; i--) {
    const it = g.items[i];
    if (it.state === "live") {
      if (g.phase === "play") {
        it.age += dt;
        const locked = g.fighters.some((f) => f.lock === it);
        const curVx = locked ? it.vx * 0.72 : it.vx;
        it.x += curVx * dt;
        it.y = LANES[it.lane].y + Math.sin(it.age * 2.5 + it.id) * 3;
      }
      const expiredByX = (it.dir > 0 && it.x > W + 110) || (it.dir < 0 && it.x < -110);
      if (it.age > it.life || expiredByX) {
        it.state = "expired";
        it.st = 0;
        for (const f of g.fighters) if (f.lock === it) drop(f);
      }
    } else {
      it.st += dt;
      if (it.st > 0.5) g.items.splice(i, 1);
    }
  }

  for (let i = g.missiles.length - 1; i >= 0; i--) {
    const m = g.missiles[i], t = g.fighters[1 - m.owner];
    m.age += dt; m.y += m.dir * (480 + Math.min(420, m.age * 800)) * dt; m.ph += dt * 10;
    m.x += (t.x - m.x) * Math.min(1, dt * 1.6);
    m.yy = m.y;
    for (let k = 0; k < 2; k++) {
      g.parts.push({ x: m.x + Math.sin(m.ph) * 5 + (Math.random() - 0.5) * 6, y: m.yy - m.dir * 22, vx: (Math.random() - 0.5) * 50, vy: -m.dir * (60 + Math.random() * 60), life: 0.4, max: 0.4, col: m.reflected ? "#d8a0ff" : m.big ? "#fff07a" : Math.random() < 0.5 ? "#ffd070" : "#ff8a40", sz: 1.5 + Math.random() * 2.5 });
    }
    if ((m.dir > 0 && m.y >= t.y - 60) || (m.dir < 0 && m.y <= t.y + 60)) {
      g.missiles.splice(i, 1);
      if (g.phase !== "over") hit(g, m, h);
    }
  }
  for (let i = g.parts.length - 1; i >= 0; i--) {
    const q = g.parts[i];
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.97; q.vy *= 0.97;
    if (q.life <= 0) g.parts.splice(i, 1);
  }
  for (let i = g.shards.length - 1; i >= 0; i--) {
    const q = g.shards[i];
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 520 * dt; q.vx *= 0.985; q.rot += q.vr * dt;
    if (q.life <= 0) g.shards.splice(i, 1);
  }
  for (let i = g.rays.length - 1; i >= 0; i--) { const r = g.rays[i]; r.t += dt; if (r.t > r.life) g.rays.splice(i, 1); }
  for (let i = g.rings.length - 1; i >= 0; i--) { const r = g.rings[i]; r.t += dt; if (r.t > r.life) g.rings.splice(i, 1); }
  for (let i = g.texts.length - 1; i >= 0; i--) { const t = g.texts[i]; t.t += dt; t.y -= 34 * dt; if (t.t > 1.3) g.texts.splice(i, 1); }
  for (let i = g.banners.length - 1; i >= 0; i--) {
    const b = g.banners[i];
    b.t += dt;
    if (b.t > (b.kind === "fusion" ? 2.6 : 1.5)) g.banners.splice(i, 1);
  }
}

export { LEFT_KEYS, RIGHT_KEYS };
