/**
 * Deadline Rush — an office-themed shedding card game in the Mau-Mau /
 * Switch family. Pure functions over a plain state object.
 *
 *  - 4 departments (suits): Tech, Sales, HR, Design
 *  - Per department: 1–9 ×2, "Đẩy việc +2" ×2, "Nghỉ phép" (skip) ×2, "Đổi ca" (reverse) ×2
 *  - Wild: "Chuyển phòng" ×4 (pick a department), "Sếp giao +4" ×4
 *  - Match department or value. Several cards of the same number can be
 *    played together. +2/+4 penalties stack. Call "CHỐT!" at one card.
 */

export type Dept = "tech" | "sales" | "hr" | "design";
export type Kind = "num" | "plus2" | "skip" | "reverse" | "wild" | "plus4";

export interface Card {
  id: string;
  dept: Dept | null; // null for wilds
  kind: Kind;
  value: number; // 1..9 for numbers, 0 otherwise
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  bot: boolean;
  hand: Card[];
  score: number;
  /** Called CHỐT on the way down to one card. */
  called: boolean;
}

export interface DState {
  players: Player[];
  draw: Card[];
  discard: Card[];
  turn: number;
  dir: 1 | -1;
  dept: Dept;
  /** Cards the next player must draw unless they stack. */
  pending: number;
  /** Set after a forced single draw: the drawn card may be played or kept. */
  drawnId: string | null;
  winner: number | null;
  round: number;
  target: number; // points to win the match (0 = single round)
  log: string[];
  /** Human forgot to call CHỐT and nobody caught it yet. */
  vulnerable: number | null;
}

export const DEPTS: Dept[] = ["tech", "sales", "hr", "design"];
export const DEPT_INFO: Record<Dept, { name: string; tone: string; ink: string }> = {
  tech: { name: "Tech", tone: "#fafafa", ink: "#09090b" },
  sales: { name: "Sales", tone: "#c8c8ce", ink: "#09090b" },
  hr: { name: "HR", tone: "#6b6b74", ink: "#fafafa" },
  design: { name: "Design", tone: "#26262b", ink: "#fafafa" },
};
export const KIND_LABEL: Record<Kind, string> = {
  num: "",
  plus2: "Đẩy việc",
  skip: "Nghỉ phép",
  reverse: "Đổi ca",
  wild: "Chuyển phòng",
  plus4: "Sếp giao",
};

let uid = 0;
const cardId = () => `c${++uid}-${Math.random().toString(36).slice(2, 6)}`;

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const d of DEPTS) {
    for (let v = 1; v <= 9; v++) for (let k = 0; k < 2; k++) deck.push({ id: cardId(), dept: d, kind: "num", value: v });
    for (const kind of ["plus2", "skip", "reverse"] as Kind[]) for (let k = 0; k < 2; k++) deck.push({ id: cardId(), dept: d, kind, value: 0 });
  }
  for (let k = 0; k < 4; k++) {
    deck.push({ id: cardId(), dept: null, kind: "wild", value: 0 });
    deck.push({ id: cardId(), dept: null, kind: "plus4", value: 0 });
  }
  return shuffle(deck);
}

export function shuffle<T>(a: T[]): T[] {
  const c = [...a];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

export const top = (s: DState) => s.discard[s.discard.length - 1];
export const cardPoints = (c: Card) => (c.kind === "num" ? c.value : c.kind === "wild" || c.kind === "plus4" ? 50 : 20);
export const next = (s: DState, steps = 1) => (((s.turn + s.dir * steps) % s.players.length) + s.players.length) % s.players.length;

export function canPlay(s: DState, c: Card): boolean {
  const t = top(s);
  if (s.pending > 0) return c.kind === "plus4" || (c.kind === "plus2" && (t.kind === "plus2" || t.kind === "plus4"));
  if (c.kind === "wild" || c.kind === "plus4") return true;
  if (c.dept === s.dept) return true;
  if (c.kind === "num") return t.kind === "num" && t.value === c.value;
  return c.kind === t.kind;
}

/** Can `extra` join a multi-play started with `first`? (same number only) */
export const canChain = (first: Card, extra: Card) => first.kind === "num" && extra.kind === "num" && extra.value === first.value && extra.id !== first.id;

export function newRound(players: Omit<Player, "hand" | "called">[], target: number, round = 1, starter = 0): DState {
  let deck = createDeck();
  const ps: Player[] = players.map((p) => ({ ...p, hand: deck.splice(0, 7), called: false }));
  // Start on a number card.
  let i = deck.findIndex((c) => c.kind === "num");
  const first = deck.splice(i, 1)[0];
  return {
    players: ps,
    draw: deck,
    discard: [first],
    turn: starter,
    dir: 1,
    dept: first.dept!,
    pending: 0,
    drawnId: null,
    winner: null,
    round,
    target,
    log: [`Ván ${round}: lá mở bài ${DEPT_INFO[first.dept!].name} ${first.value}.`],
    vulnerable: null,
  };
}

function refill(s: DState) {
  if (s.draw.length > 0) return;
  const keep = s.discard.pop()!;
  s.draw = shuffle(s.discard);
  s.discard = [keep];
}

export function drawCards(s: DState, who: number, n: number): Card[] {
  const got: Card[] = [];
  for (let i = 0; i < n; i++) {
    refill(s);
    const c = s.draw.pop();
    if (!c) break;
    got.push(c);
  }
  s.players[who].hand.push(...got);
  s.players[who].called = false;
  return got;
}

const say = (s: DState, line: string) => {
  s.log = [...s.log, line].slice(-40);
};

/**
 * Play one or more cards (same number for multiples). `chosen` is the
 * department for wilds. Returns false if illegal.
 */
export function play(s: DState, who: number, ids: string[], chosen?: Dept): boolean {
  if (s.winner !== null || who !== s.turn || !ids.length) return false;
  const p = s.players[who];
  const cards = ids.map((id) => p.hand.find((c) => c.id === id)).filter(Boolean) as Card[];
  if (cards.length !== ids.length || !canPlay(s, cards[0])) return false;
  if (cards.length > 1 && !cards.slice(1).every((c) => canChain(cards[0], c))) return false;
  if ((cards[0].kind === "wild" || cards[0].kind === "plus4") && !chosen) return false;

  p.hand = p.hand.filter((c) => !ids.includes(c.id));
  s.discard.push(...cards);
  const last = cards[cards.length - 1];
  s.dept = last.dept ?? chosen!;
  s.drawnId = null;

  const label = last.kind === "num" ? `${DEPT_INFO[last.dept!].name} ${last.value}` : KIND_LABEL[last.kind];
  say(s, `${p.name} đánh ${cards.length > 1 ? `${cards.length}× ` : ""}${label}${chosen && !last.dept ? ` → ${DEPT_INFO[chosen].name}` : ""}.`);

  // CHỐT check: a player at one card who didn't call is vulnerable.
  if (p.hand.length === 1 && !p.called) s.vulnerable = who;
  else if (p.hand.length !== 1) s.vulnerable = null;

  if (p.hand.length === 0) {
    finishRound(s, who);
    return true;
  }

  let steps = 1;
  switch (last.kind) {
    case "plus2":
      s.pending += 2;
      break;
    case "plus4":
      s.pending += 4;
      break;
    case "skip":
      steps = 2;
      break;
    case "reverse":
      if (s.players.length === 2) steps = 2;
      else s.dir = (s.dir * -1) as 1 | -1;
      break;
  }
  s.turn = next(s, steps);
  return true;
}

/** Take the pending penalty, or draw one card. */
export function takeDraw(s: DState, who: number): { drawn: Card[]; penalty: boolean } {
  if (who !== s.turn || s.winner !== null) return { drawn: [], penalty: false };
  if (s.pending > 0) {
    const n = s.pending;
    s.pending = 0;
    const drawn = drawCards(s, who, n);
    say(s, `${s.players[who].name} nhận ${n} lá phạt.`);
    s.turn = next(s);
    return { drawn, penalty: true };
  }
  const drawn = drawCards(s, who, 1);
  say(s, `${s.players[who].name} rút 1 lá.`);
  if (drawn[0] && canPlay(s, drawn[0])) s.drawnId = drawn[0].id;
  else s.turn = next(s);
  return { drawn, penalty: false };
}

/** Keep the card just drawn and end the turn. */
export function pass(s: DState, who: number) {
  if (who !== s.turn || !s.drawnId) return;
  s.drawnId = null;
  s.turn = next(s);
}

export function callChot(s: DState, who: number) {
  const p = s.players[who];
  p.called = true;
  if (s.vulnerable === who) s.vulnerable = null;
  say(s, `${p.name}: “CHỐT!” 📣`);
}

/** Someone catches a player who forgot to call: they draw 2. */
export function catchChot(s: DState, catcher: number): boolean {
  const v = s.vulnerable;
  if (v === null || v === catcher) return false;
  s.vulnerable = null;
  drawCards(s, v, 2);
  say(s, `${s.players[catcher].name} bắt lỗi: ${s.players[v].name} quên hô CHỐT → +2 lá!`);
  return true;
}

function finishRound(s: DState, who: number) {
  const gained = s.players.reduce((a, p, i) => (i === who ? a : a + p.hand.reduce((x, c) => x + cardPoints(c), 0)), 0);
  s.players[who].score += gained;
  s.winner = who;
  say(s, `🏁 ${s.players[who].name} hết bài! +${gained} điểm.`);
}

export const matchOver = (s: DState) => s.winner !== null && (s.target === 0 || s.players[s.winner].score >= s.target);

/* ---------------------------------- Bots ---------------------------------- */

export function botChoose(s: DState, who: number): { ids: string[]; dept?: Dept } | null {
  const p = s.players[who];
  const playable = p.hand.filter((c) => canPlay(s, c));
  if (!playable.length) return null;

  const counts: Record<Dept, number> = { tech: 0, sales: 0, hr: 0, design: 0 };
  for (const c of p.hand) if (c.dept) counts[c.dept]++;
  const bestDept = (exclude?: string) => DEPTS.filter((d) => d !== exclude).reduce((a, b) => (counts[b] > counts[a] ? b : a), DEPTS[0]);

  const nextP = s.players[next(s)];
  const threat = nextP.hand.length <= 2;
  const score = (c: Card) => {
    let v = 0;
    if (c.kind === "num") v += 10 + c.value * 0.3 + p.hand.filter((x) => canChain(c, x)).length * 6;
    if (c.kind === "plus2" || c.kind === "skip") v += threat ? 40 : 12;
    if (c.kind === "reverse") v += threat && s.players.length > 2 ? 30 : 10;
    if (c.kind === "wild") v += p.hand.length <= 2 ? 30 : -5;
    if (c.kind === "plus4") v += threat || s.pending > 0 ? 45 : -10;
    if (c.dept && c.dept === s.dept) v += 2;
    return v + Math.random() * 3;
  };
  const pick = playable.reduce((a, b) => (score(b) > score(a) ? b : a), playable[0]);
  const ids = [pick.id];
  if (pick.kind === "num") for (const c of p.hand) if (canChain(pick, c)) ids.push(c.id);
  // Prefer finishing on a department we hold most of.
  if (ids.length > 1) {
    const chosen = ids.map((id) => p.hand.find((c) => c.id === id)!);
    chosen.sort((a, b) => counts[a.dept!] - counts[b.dept!]);
    return { ids: chosen.map((c) => c.id) };
  }
  return { ids, dept: pick.dept ? undefined : bestDept() };
}
