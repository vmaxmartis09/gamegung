/**
 * Office Arena xiangqi (Cờ Tướng) engine.
 * 9×10 mailbox board, legal move generation (incl. flying general), WXF-style
 * game-end rules, Vietnamese notation, and an alpha-beta search with
 * quiescence, Zobrist TT, killers and history. Pure TS for a Web Worker.
 *
 * Coordinates: index = row * 9 + col, row 0 is Black's back rank (top),
 * row 9 is Red's back rank (bottom). Red pieces > 0, Black pieces < 0.
 */

export const GENERAL = 1,
  ADVISOR = 2,
  ELEPHANT = 3,
  HORSE = 4,
  CHARIOT = 5,
  CANNON = 6,
  SOLDIER = 7;

export type Side = 1 | -1; // 1 = Red, -1 = Black

const VALUE = [0, 0, 120, 120, 270, 600, 285, 30];
const MATE = 100000;
const INF = 1000000;
const MAX_PLY = 64;

const rowOf = (i: number) => (i / 9) | 0;
const colOf = (i: number) => i % 9;
const inBoard = (r: number, c: number) => r >= 0 && r < 10 && c >= 0 && c < 9;
const inPalace = (r: number, c: number, side: Side) => c >= 3 && c <= 5 && (side === 1 ? r >= 7 && r <= 9 : r >= 0 && r <= 2);

// Positional tables from Red's view (row 0 = Black's back rank).
// prettier-ignore
const PST: Record<number, number[]> = {
  [SOLDIER]: [
    9, 9, 9,11,13,11, 9, 9, 9,
    19,24,34,42,44,42,34,24,19,
    19,24,32,37,37,37,32,24,19,
    19,23,27,29,30,29,27,23,19,
    14,18,20,27,29,27,20,18,14,
    7, 0,13, 0,16, 0,13, 0, 7,
    7, 0, 7, 0,15, 0, 7, 0, 7,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0],
  [HORSE]: [
    4, 8,16,12, 4,12,16, 8, 4,
    4,10,28,16, 8,16,28,10, 4,
    12,14,16,20,18,20,16,14,12,
    8,24,18,24,20,24,18,24, 8,
    6,16,14,18,16,18,14,16, 6,
    4,12,16,14,12,14,16,12, 4,
    2, 6, 8, 6,10, 6, 8, 6, 2,
    4, 2, 8, 8, 4, 8, 8, 2, 4,
    0, 2, 4, 4,-2, 4, 4, 2, 0,
    0,-4, 0, 0, 0, 0, 0,-4, 0],
  [CHARIOT]: [
    14,14,12,18,16,18,12,14,14,
    16,20,18,24,26,24,18,20,16,
    12,12,12,18,18,18,12,12,12,
    12,18,16,22,22,22,16,18,12,
    12,14,12,18,18,18,12,14,12,
    12,16,14,20,20,20,14,16,12,
    6,10, 8,14,14,14, 8,10, 6,
    4, 8, 6,14,12,14, 6, 8, 4,
    8, 4, 8,16, 8,16, 8, 4, 8,
    -2,10, 6,14,12,14, 6,10,-2],
  [CANNON]: [
    6, 4, 0,-10,-12,-10, 0, 4, 6,
    2, 2, 0, -4,-14, -4, 0, 2, 2,
    2, 2, 0,-10, -8,-10, 0, 2, 2,
    0, 0,-2,  4, 10,  4,-2, 0, 0,
    0, 0, 0,  2,  8,  2, 0, 0, 0,
    -2, 0, 4,  2,  6,  2, 4, 0,-2,
    0, 0, 0,  2,  4,  2, 0, 0, 0,
    4, 0, 8,  6, 10,  6, 8, 0, 4,
    0, 2, 4,  6,  6,  6, 4, 2, 0,
    0, 0, 2,  6,  6,  6, 2, 0, 0],
  [ADVISOR]: [
    0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,
    0,0,0,0,3,0,0,0,0,
    0,0,0,0,0,0,0,0,0],
  [ELEPHANT]: [
    0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,
    -2,0,0,0,3,0,0,0,-2,
    0,0,0,0,0,0,0,0,0,
    0,0,1,0,0,0,1,0,0],
  [GENERAL]: [
    0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,
    0,0,0,-16,-18,-16,0,0,0,
    0,0,0,-6,-8,-6,0,0,0,
    0,0,0,-2,0,-2,0,0,0],
};

export const START_FEN = "rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RHEAKAEHR w";

const FEN_PIECES: Record<string, number> = { k: GENERAL, a: ADVISOR, e: ELEPHANT, b: ELEPHANT, h: HORSE, n: HORSE, r: CHARIOT, c: CANNON, p: SOLDIER };
const PIECE_FEN = ["", "k", "a", "e", "h", "r", "c", "p"];

// Zobrist
let seed = 0x2545f491;
const rand32 = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed | 0;
};
const Z = Array.from({ length: 15 }, () => Int32Array.from({ length: 90 }, rand32));
const Z_SIDE = rand32();
const zi = (p: number) => p + 7;

export interface XMove {
  from: number;
  to: number;
}
const enc = (from: number, to: number) => from | (to << 7);
const mFrom = (m: number) => m & 127;
const mTo = (m: number) => m >> 7;

export class XiangqiPosition {
  b = new Int8Array(90);
  side: Side = 1;
  hash = 0;
  kings = [85, 4]; // [red, black]
  /** Plies since last capture. */
  quiet = 0;
  private hist: number[] = [];
  private checks: boolean[] = [];
  private undoCap: number[] = [];
  private undoQuiet: number[] = [];

  constructor(fen = START_FEN) {
    const [rows, side] = fen.split(" ");
    rows.split("/").forEach((row, r) => {
      let c = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) c += +ch;
        else {
          const t = FEN_PIECES[ch.toLowerCase()];
          const v = ch === ch.toLowerCase() ? -t : t;
          this.b[r * 9 + c] = v;
          if (t === GENERAL) this.kings[v > 0 ? 0 : 1] = r * 9 + c;
          c++;
        }
      }
    });
    this.side = side === "b" ? -1 : 1;
    this.hash = this.computeHash();
  }

  clone() {
    const p = new XiangqiPosition(this.fen());
    p.hist = [...this.hist];
    p.checks = [...this.checks];
    p.quiet = this.quiet;
    return p;
  }

  fen() {
    let out = "";
    for (let r = 0; r < 10; r++) {
      let empty = 0;
      for (let c = 0; c < 9; c++) {
        const v = this.b[r * 9 + c];
        if (!v) {
          empty++;
          continue;
        }
        if (empty) out += empty;
        empty = 0;
        const ch = PIECE_FEN[Math.abs(v)];
        out += v > 0 ? ch.toUpperCase() : ch;
      }
      if (empty) out += empty;
      if (r < 9) out += "/";
    }
    return `${out} ${this.side === 1 ? "w" : "b"}`;
  }

  computeHash() {
    let h = 0;
    for (let i = 0; i < 90; i++) if (this.b[i]) h ^= Z[zi(this.b[i])][i];
    if (this.side === -1) h ^= Z_SIDE;
    return h;
  }

  /** True if the two generals see each other on an open file. */
  generalsFacing() {
    const [rk, bk] = this.kings;
    if (colOf(rk) !== colOf(bk)) return false;
    for (let i = bk + 9; i < rk; i += 9) if (this.b[i]) return false;
    return true;
  }

  /** Is square `sq` attacked by `by`? (Used for checks.) */
  attacked(sq: number, by: Side): boolean {
    const b = this.b;
    const r = rowOf(sq),
      c = colOf(sq);
    // Chariot / cannon / facing general along lines
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      let rr = r + dr,
        cc = c + dc,
        screen = false;
      while (inBoard(rr, cc)) {
        const p = b[rr * 9 + cc];
        if (p) {
          if (!screen) {
            if (p === CHARIOT * by || (dc === 0 && p === GENERAL * by)) return true;
            screen = true;
          } else {
            if (p === CANNON * by) return true;
            break;
          }
        }
        rr += dr;
        cc += dc;
      }
    }
    // Horse (reverse leg check)
    for (const [dr, dc] of [
      [-2, -1],
      [-2, 1],
      [2, -1],
      [2, 1],
      [-1, -2],
      [1, -2],
      [-1, 2],
      [1, 2],
    ]) {
      const hr = r - dr,
        hc = c - dc;
      if (!inBoard(hr, hc) || b[hr * 9 + hc] !== HORSE * by) continue;
      const legR = Math.abs(dr) === 2 ? hr + dr / 2 : hr;
      const legC = Math.abs(dc) === 2 ? hc + dc / 2 : hc;
      if (!b[legR * 9 + legC]) return true;
    }
    // Soldier
    const fwd = by === 1 ? -1 : 1; // direction the attacking soldier moves
    if (inBoard(r - fwd, c) && b[(r - fwd) * 9 + c] === SOLDIER * by) return true;
    for (const dc of [-1, 1]) {
      const cc = c + dc;
      if (!inBoard(r, cc) || b[r * 9 + cc] !== SOLDIER * by) continue;
      const crossed = by === 1 ? r <= 4 : r >= 5;
      if (crossed) return true;
    }
    return false;
  }

  inCheck(side: Side = this.side) {
    return this.attacked(this.kings[side === 1 ? 0 : 1], (-side) as Side);
  }

  /** Pseudo-legal moves (as encoded ints) into `out`; returns count. */
  gen(out: Int32Array | number[], capturesOnly = false): number {
    const b = this.b;
    const s = this.side;
    let n = 0;
    const push = (from: number, r: number, c: number) => {
      const to = r * 9 + c;
      const t = b[to];
      if (t * s > 0) return;
      if (capturesOnly && !t) return;
      out[n++] = enc(from, to);
    };
    for (let from = 0; from < 90; from++) {
      const p = b[from] * s;
      if (p <= 0) continue;
      const r = rowOf(from),
        c = colOf(from);
      switch (p) {
        case GENERAL:
          for (const [dr, dc] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ])
            if (inPalace(r + dr, c + dc, s)) push(from, r + dr, c + dc);
          break;
        case ADVISOR:
          for (const [dr, dc] of [
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
          ])
            if (inPalace(r + dr, c + dc, s)) push(from, r + dr, c + dc);
          break;
        case ELEPHANT:
          for (const [dr, dc] of [
            [2, 2],
            [2, -2],
            [-2, 2],
            [-2, -2],
          ]) {
            const nr = r + dr,
              nc = c + dc;
            if (!inBoard(nr, nc)) continue;
            if (s === 1 ? nr < 5 : nr > 4) continue;
            if (b[(r + dr / 2) * 9 + (c + dc / 2)]) continue;
            push(from, nr, nc);
          }
          break;
        case HORSE:
          for (const [dr, dc] of [
            [-2, -1],
            [-2, 1],
            [2, -1],
            [2, 1],
            [-1, -2],
            [1, -2],
            [-1, 2],
            [1, 2],
          ]) {
            const nr = r + dr,
              nc = c + dc;
            if (!inBoard(nr, nc)) continue;
            const legR = Math.abs(dr) === 2 ? r + dr / 2 : r;
            const legC = Math.abs(dc) === 2 ? c + dc / 2 : c;
            if (b[legR * 9 + legC]) continue;
            push(from, nr, nc);
          }
          break;
        case CHARIOT:
        case CANNON:
          for (const [dr, dc] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            let nr = r + dr,
              nc = c + dc,
              screen = false;
            while (inBoard(nr, nc)) {
              const t = b[nr * 9 + nc];
              if (p === CHARIOT) {
                if (t) {
                  if (t * s < 0) out[n++] = enc(from, nr * 9 + nc);
                  break;
                }
                if (!capturesOnly) out[n++] = enc(from, nr * 9 + nc);
              } else if (!screen) {
                if (t) screen = true;
                else if (!capturesOnly) out[n++] = enc(from, nr * 9 + nc);
              } else if (t) {
                if (t * s < 0) out[n++] = enc(from, nr * 9 + nc);
                break;
              }
              nr += dr;
              nc += dc;
            }
          }
          break;
        case SOLDIER: {
          const fwd = s === 1 ? -1 : 1;
          if (inBoard(r + fwd, c)) push(from, r + fwd, c);
          const crossed = s === 1 ? r <= 4 : r >= 5;
          if (crossed) {
            if (inBoard(r, c - 1)) push(from, r, c - 1);
            if (inBoard(r, c + 1)) push(from, r, c + 1);
          }
          break;
        }
      }
    }
    return n;
  }

  make(m: number): boolean {
    const from = mFrom(m),
      to = mTo(m);
    const b = this.b;
    const piece = b[from];
    const cap = b[to];
    this.undoCap.push(cap);
    this.undoQuiet.push(this.quiet);
    this.hist.push(this.hash);
    let h = this.hash ^ Z[zi(piece)][from] ^ Z[zi(piece)][to];
    if (cap) h ^= Z[zi(cap)][to];
    b[to] = piece;
    b[from] = 0;
    if (Math.abs(piece) === GENERAL) this.kings[piece > 0 ? 0 : 1] = to;
    const mover = this.side;
    this.side = (-mover) as Side;
    this.hash = h ^ Z_SIDE;
    this.quiet = cap ? 0 : this.quiet + 1;
    if (this.generalsFacing() || this.attacked(this.kings[mover === 1 ? 0 : 1], this.side)) {
      this.restore(m);
      return false;
    }
    this.checks.push(this.inCheck());
    return true;
  }

  unmake(m: number) {
    this.checks.pop();
    this.restore(m);
  }

  private restore(m: number) {
    const from = mFrom(m),
      to = mTo(m);
    const b = this.b;
    const piece = b[to];
    b[from] = piece;
    b[to] = this.undoCap.pop()!;
    if (Math.abs(piece) === GENERAL) this.kings[piece > 0 ? 0 : 1] = from;
    this.side = (-this.side) as Side;
    this.hash = this.hist.pop()!;
    this.quiet = this.undoQuiet.pop()!;
  }

  /** Hashes of earlier positions (for repetition handling in the worker). */
  get historyHashes() {
    return this.hist;
  }

  legalMoves(): XMove[] {
    const buf: number[] = [];
    const n = this.gen(buf);
    const out: XMove[] = [];
    for (let i = 0; i < n; i++) {
      if (this.make(buf[i])) {
        this.unmake(buf[i]);
        out.push({ from: mFrom(buf[i]), to: mTo(buf[i]) });
      }
    }
    return out;
  }

  movesFrom(sq: number) {
    return this.legalMoves().filter((m) => m.from === sq);
  }

  play(from: number, to: number) {
    return this.make(enc(from, to));
  }

  undo(from: number, to: number) {
    this.unmake(enc(from, to));
  }

  repetitions() {
    let n = 0;
    for (let i = this.hist.length - 2; i >= 0; i -= 2) if (this.hist[i] === this.hash) n++;
    return n;
  }

  /**
   * WXF-style result, from the point of view of game flow:
   *  - no legal move (checkmate or stalemate) → side to move loses
   *  - position repeated 3 times: a side that checked on every move of the
   *    cycle (perpetual check) loses; otherwise draw
   *  - 120 plies without a capture → draw
   */
  result(): { winner: Side | 0; reason: string } | null {
    if (this.legalMoves().length === 0) {
      return { winner: (-this.side) as Side, reason: this.inCheck() ? "Chiếu bí" : "Hết nước đi (bị vây)" };
    }
    if (this.repetitions() >= 2) {
      // Look at the last cycle: who checked on every one of their moves?
      const cycle = Math.min(this.checks.length, 8);
      const recent = this.checks.slice(-cycle);
      // checks[i] is "after move i, side to move is in check" → move i was a check by its mover.
      const lastMoverChecks = recent.filter((_, i) => (cycle - 1 - i) % 2 === 0);
      const otherChecks = recent.filter((_, i) => (cycle - 1 - i) % 2 === 1);
      const lastMover = (-this.side) as Side;
      const lmPerp = lastMoverChecks.length >= 3 && lastMoverChecks.every(Boolean);
      const otPerp = otherChecks.length >= 3 && otherChecks.every(Boolean);
      if (lmPerp && !otPerp) return { winner: (-lastMover) as Side, reason: "Chiếu dai — bên chiếu bị xử thua" };
      if (otPerp && !lmPerp) return { winner: lastMover, reason: "Chiếu dai — bên chiếu bị xử thua" };
      return { winner: 0, reason: "Lặp lại thế cờ 3 lần" };
    }
    if (this.quiet >= 120) return { winner: 0, reason: "60 nước không ăn quân" };
    return null;
  }

  evaluate(): number {
    let score = 0;
    const b = this.b;
    for (let i = 0; i < 90; i++) {
      const p = b[i];
      if (!p) continue;
      const t = p > 0 ? p : -p;
      const idx = p > 0 ? i : (9 - rowOf(i)) * 9 + colOf(i);
      const v = VALUE[t] + PST[t][idx];
      score += p > 0 ? v : -v;
    }
    return score * this.side;
  }
}

/* --------------------------- Vietnamese notation --------------------------- */

const VN_LETTER = ["", "Tg", "S", "T", "M", "X", "P", "B"];
export const VN_NAME = ["", "Tướng", "Sĩ", "Tượng", "Mã", "Xe", "Pháo", "Tốt"];

/** e.g. "P2-5", "M8.7", "X1/2", "Xt.1". `pos` is the position BEFORE the move. */
export function vnNotation(pos: XiangqiPosition, from: number, to: number): string {
  const p = pos.b[from];
  const t = Math.abs(p);
  const side: Side = p > 0 ? 1 : -1;
  const fileNum = (c: number) => (side === 1 ? 9 - c : c + 1);
  const fr = rowOf(from),
    fc = colOf(from),
    tr = rowOf(to),
    tc = colOf(to);
  let prefix = VN_LETTER[t] + fileNum(fc);
  // Two identical pieces on the same file → "t" (trước, front) / "s" (sau, rear).
  const same: number[] = [];
  for (let r = 0; r < 10; r++) if (pos.b[r * 9 + fc] === p) same.push(r);
  if (same.length === 2 && t !== GENERAL && t !== ADVISOR && t !== ELEPHANT) {
    const front = side === 1 ? Math.min(...same) : Math.max(...same);
    prefix = VN_LETTER[t] + (fr === front ? "t" : "s");
  }
  const forward = side === 1 ? tr < fr : tr > fr;
  if (fr === tr) return `${prefix}-${fileNum(tc)}`;
  const action = forward ? "." : "/";
  const straight = t === CHARIOT || t === CANNON || t === SOLDIER || t === GENERAL;
  return `${prefix}${action}${straight ? Math.abs(tr - fr) : fileNum(tc)}`;
}

/* --------------------------------- Search --------------------------------- */

const TT_SIZE = 1 << 18;
const TT_MASK = TT_SIZE - 1;
const ttKey = new Int32Array(TT_SIZE);
const ttMove = new Int32Array(TT_SIZE);
const ttScore = new Int32Array(TT_SIZE);
const ttDepth = new Int8Array(TT_SIZE);
const ttFlag = new Int8Array(TT_SIZE);
const moveBuf = Array.from({ length: MAX_PLY + 8 }, () => new Int32Array(160));
const scoreBuf = Array.from({ length: MAX_PLY + 8 }, () => new Int32Array(160));
const killers = Array.from({ length: MAX_PLY + 8 }, () => [0, 0]);
const history = new Int32Array(128 * 128);

export interface XSearchOptions {
  maxDepth: number;
  timeMs: number;
  noise?: number;
}
export interface XSearchResult {
  move: XMove | null;
  score: number;
  depth: number;
  nodes: number;
}

export function searchXiangqi(fen: string, historyHashes: number[], opts: XSearchOptions): XSearchResult {
  const pos = new XiangqiPosition(fen);
  // Seed repetition history so the engine avoids (or seeks) repeats like the real game.
  const seeded = historyHashes.slice(-40);
  (pos as unknown as { hist: number[]; checks: boolean[] }).hist = seeded;
  (pos as unknown as { hist: number[]; checks: boolean[] }).checks = seeded.map(() => false);
  let nodes = 0;
  let stop = false;
  const deadline = Date.now() + opts.timeMs;
  for (const k of killers) k[0] = k[1] = 0;
  history.fill(0);

  const order = (ply: number, n: number, tt: number) => {
    const ms = moveBuf[ply],
      sc = scoreBuf[ply];
    for (let i = 0; i < n; i++) {
      const m = ms[i];
      if (m === tt) sc[i] = 2_000_000;
      else {
        const cap = pos.b[mTo(m)];
        if (cap) sc[i] = 1_000_000 + VALUE[Math.abs(cap)] * 10 - VALUE[Math.abs(pos.b[mFrom(m)])] / 10;
        else if (killers[ply][0] === m) sc[i] = 800_000;
        else if (killers[ply][1] === m) sc[i] = 700_000;
        else sc[i] = history[mFrom(m) * 128 + mTo(m)];
      }
    }
  };
  const pick = (ply: number, i: number, n: number) => {
    const ms = moveBuf[ply],
      sc = scoreBuf[ply];
    let best = i;
    for (let j = i + 1; j < n; j++) if (sc[j] > sc[best]) best = j;
    if (best !== i) {
      [ms[i], ms[best]] = [ms[best], ms[i]];
      [sc[i], sc[best]] = [sc[best], sc[i]];
    }
    return ms[i];
  };

  const quiesce = (alpha: number, beta: number, ply: number): number => {
    if ((++nodes & 2047) === 0 && Date.now() > deadline) stop = true;
    if (stop) return 0;
    const stand = pos.evaluate();
    if (ply >= MAX_PLY) return stand;
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    const n = pos.gen(moveBuf[ply], true);
    order(ply, n, 0);
    for (let i = 0; i < n; i++) {
      const m = pick(ply, i, n);
      if (!pos.make(m)) continue;
      const sc = -quiesce(-beta, -alpha, ply + 1);
      pos.unmake(m);
      if (stop) return 0;
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  };

  const search = (depth: number, alpha: number, beta: number, ply: number): number => {
    if ((++nodes & 2047) === 0 && Date.now() > deadline) stop = true;
    if (stop) return 0;
    if (ply > 0 && pos.repetitions() > 0) return 0;
    const inCheck = pos.inCheck();
    if (inCheck) depth++;
    if (depth <= 0) return quiesce(alpha, beta, ply);
    if (ply >= MAX_PLY) return pos.evaluate();

    const slot = pos.hash & TT_MASK;
    let tt = 0;
    if (ttKey[slot] === pos.hash) {
      tt = ttMove[slot];
      if (ply > 0 && ttDepth[slot] >= depth) {
        const sc = ttScore[slot],
          f = ttFlag[slot];
        if (f === 1 || (f === 2 && sc >= beta) || (f === 3 && sc <= alpha)) return sc;
      }
    }

    const n = pos.gen(moveBuf[ply]);
    order(ply, n, tt);
    let legal = 0,
      best = -INF,
      bestMove = 0;
    const a0 = alpha;
    for (let i = 0; i < n; i++) {
      const m = pick(ply, i, n);
      if (!pos.make(m)) continue;
      legal++;
      let sc: number;
      if (legal === 1) sc = -search(depth - 1, -beta, -alpha, ply + 1);
      else {
        sc = -search(depth - 1, -alpha - 1, -alpha, ply + 1);
        if (sc > alpha && sc < beta) sc = -search(depth - 1, -beta, -alpha, ply + 1);
      }
      pos.unmake(m);
      if (stop) return 0;
      if (sc > best) {
        best = sc;
        bestMove = m;
      }
      if (sc > alpha) {
        alpha = sc;
        if (sc >= beta) {
          if (!pos.b[mTo(m)]) {
            if (killers[ply][0] !== m) {
              killers[ply][1] = killers[ply][0];
              killers[ply][0] = m;
            }
            history[mFrom(m) * 128 + mTo(m)] += depth * depth;
          }
          break;
        }
      }
    }
    // In xiangqi both checkmate and stalemate lose.
    if (legal === 0) return -MATE + ply;
    ttKey[slot] = pos.hash;
    ttMove[slot] = bestMove;
    ttScore[slot] = best;
    ttDepth[slot] = depth;
    ttFlag[slot] = best >= beta ? 2 : best <= a0 ? 3 : 1;
    return best;
  };

  const buf: number[] = [];
  const n = pos.gen(buf);
  const root: { m: number; score: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (pos.make(buf[i])) {
      pos.unmake(buf[i]);
      root.push({ m: buf[i], score: 0 });
    }
  }
  if (!root.length) return { move: null, score: -MATE, depth: 0, nodes };

  const noise = opts.noise ?? 0;
  let best = root[0];
  let done = 0;
  for (let depth = 1; depth <= opts.maxDepth; depth++) {
    let alpha = -INF;
    for (const r of root) {
      if (!pos.make(r.m)) continue;
      const sc = noise > 0 ? -search(depth - 1, -INF, INF, 1) : -search(depth - 1, -INF, -alpha, 1);
      pos.unmake(r.m);
      if (stop) break;
      r.score = sc;
      if (sc > alpha) alpha = sc;
    }
    if (stop && depth > 1) break;
    root.sort((a, b) => b.score - a.score);
    best = root[0];
    done = depth;
    if (Math.abs(best.score) > MATE - 100 || Date.now() > deadline) break;
  }
  if (noise > 0) {
    let bv = -INF;
    for (const r of root) {
      const v = r.score + (Math.random() * 2 - 1) * noise;
      if (v > bv) {
        bv = v;
        best = r;
      }
    }
  }
  return { move: { from: mFrom(best.m), to: mTo(best.m) }, score: best.score, depth: done, nodes };
}

export const XQ_LEVELS = {
  easy: { label: "Tập sự", elo: 900, maxDepth: 1, timeMs: 300, noise: 120 },
  medium: { label: "Trung bình", elo: 1300, maxDepth: 3, timeMs: 800, noise: 30 },
  hard: { label: "Cao thủ", elo: 1700, maxDepth: 5, timeMs: 1500, noise: 0 },
  master: { label: "Đại kiện tướng", elo: 2000, maxDepth: 12, timeMs: 3000, noise: 0 },
} as const;
export type XqLevel = keyof typeof XQ_LEVELS;
