/**
 * Office Arena chess engine.
 * 0x88 board, iterative-deepening negamax with alpha-beta, quiescence search,
 * Zobrist transposition table, null-move pruning, killer + history ordering.
 * Pure TypeScript, no dependencies — runs inside a Web Worker.
 */

const P = 1,
  N = 2,
  B = 3,
  R = 4,
  Q = 5,
  K = 6;
const VALUE = [0, 100, 320, 330, 500, 900, 0];

const N_OFF = [33, 31, 18, 14, -33, -31, -18, -14];
const K_OFF = [16, -16, 1, -1, 17, 15, -17, -15];
const B_OFF = [17, 15, -17, -15];
const R_OFF = [16, -16, 1, -1];

const F_NONE = 0,
  F_DOUBLE = 1,
  F_EP = 2,
  F_CASTLE = 3;

const MATE = 100000;
const INF = 1000000;
const MAX_PLY = 64;

// Piece-square tables (white's view, rank 8 first). Simplified Evaluation Function.
// prettier-ignore
const PST: Record<number, number[]> = {
  [P]: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  [N]: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  [B]: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  [R]: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  [Q]: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  [K]: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
};
// prettier-ignore
const KING_END = [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50];

const CASTLE_MASK = new Int8Array(128).fill(15);
CASTLE_MASK[0] = 13;
CASTLE_MASK[7] = 14;
CASTLE_MASK[4] = 12;
CASTLE_MASK[112] = 7;
CASTLE_MASK[119] = 11;
CASTLE_MASK[116] = 3;

// --- Zobrist keys (32-bit) ---
let seed = 0x9e3779b9;
const rand32 = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed | 0;
};
const Z_PIECE: Int32Array[] = Array.from({ length: 12 }, () => {
  const a = new Int32Array(128);
  for (let i = 0; i < 128; i++) a[i] = rand32();
  return a;
});
const Z_CASTLE = Int32Array.from({ length: 16 }, rand32);
const Z_EP = Int32Array.from({ length: 8 }, rand32);
const Z_SIDE = rand32();
const pIdx = (p: number) => (p > 0 ? p - 1 : 5 - p);

const sqName = (sq: number) => "abcdefgh"[sq & 7] + ((sq >> 4) + 1);
const nameSq = (s: string) => (s.charCodeAt(1) - 49) * 16 + (s.charCodeAt(0) - 97);

const mFrom = (m: number) => m & 127;
const mTo = (m: number) => (m >> 7) & 127;
const mPromo = (m: number) => (m >> 14) & 7;
const mFlag = (m: number) => (m >> 17) & 7;
const encode = (from: number, to: number, promo = 0, flag = 0) => from | (to << 7) | (promo << 14) | (flag << 17);

export class ChessPosition {
  b = new Int8Array(128);
  side = 1;
  castle = 0;
  ep = -1;
  half = 0;
  kings = [4, 116];
  hash = 0;
  private hist: number[] = [];
  private undoCap: number[] = [];
  private undoCastle: number[] = [];
  private undoEp: number[] = [];
  private undoHalf: number[] = [];
  private undoHash: number[] = [];

  constructor(fen: string) {
    const [placement, side, castle, ep, half] = fen.split(" ");
    let rank = 7,
      file = 0;
    for (const ch of placement) {
      if (ch === "/") {
        rank--;
        file = 0;
      } else if (ch >= "1" && ch <= "8") file += +ch;
      else {
        const lower = ch.toLowerCase();
        const t = "pnbrqk".indexOf(lower) + 1;
        const v = ch === lower ? -t : t;
        const sq = rank * 16 + file;
        this.b[sq] = v;
        if (t === K) this.kings[v > 0 ? 0 : 1] = sq;
        file++;
      }
    }
    this.side = side === "b" ? -1 : 1;
    this.castle = (castle.includes("K") ? 1 : 0) | (castle.includes("Q") ? 2 : 0) | (castle.includes("k") ? 4 : 0) | (castle.includes("q") ? 8 : 0);
    this.ep = ep && ep !== "-" ? nameSq(ep) : -1;
    this.half = half ? parseInt(half, 10) || 0 : 0;
    this.hash = this.computeHash();
  }

  computeHash() {
    let h = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = this.b[sq];
      if (p) h ^= Z_PIECE[pIdx(p)][sq];
    }
    h ^= Z_CASTLE[this.castle];
    if (this.ep >= 0) h ^= Z_EP[this.ep & 7];
    if (this.side === -1) h ^= Z_SIDE;
    return h;
  }

  attacked(sq: number, by: number): boolean {
    const b = this.b;
    if (by === 1) {
      if (!((sq - 15) & 0x88) && b[sq - 15] === P) return true;
      if (!((sq - 17) & 0x88) && b[sq - 17] === P) return true;
    } else {
      if (!((sq + 15) & 0x88) && b[sq + 15] === -P) return true;
      if (!((sq + 17) & 0x88) && b[sq + 17] === -P) return true;
    }
    for (let i = 0; i < 8; i++) {
      const t = sq + N_OFF[i];
      if (!(t & 0x88) && b[t] === N * by) return true;
    }
    for (let i = 0; i < 8; i++) {
      const t = sq + K_OFF[i];
      if (!(t & 0x88) && b[t] === K * by) return true;
    }
    for (let i = 0; i < 4; i++) {
      const d = B_OFF[i];
      let t = sq + d;
      while (!(t & 0x88)) {
        const p = b[t];
        if (p) {
          if (p === B * by || p === Q * by) return true;
          break;
        }
        t += d;
      }
    }
    for (let i = 0; i < 4; i++) {
      const d = R_OFF[i];
      let t = sq + d;
      while (!(t & 0x88)) {
        const p = b[t];
        if (p) {
          if (p === R * by || p === Q * by) return true;
          break;
        }
        t += d;
      }
    }
    return false;
  }

  inCheck(side = this.side) {
    return this.attacked(this.kings[side === 1 ? 0 : 1], -side);
  }

  /** Pseudo-legal moves into `out`, returns count. */
  gen(out: Int32Array, capturesOnly = false): number {
    const b = this.b;
    const s = this.side;
    let n = 0;
    const promoRank = s === 1 ? 7 : 0;
    const startRank = s === 1 ? 1 : 6;
    const dir = 16 * s;
    for (let from = 0; from < 128; from++) {
      if (from & 0x88) {
        from += 7;
        continue;
      }
      const p = b[from] * s;
      if (p <= 0) continue;
      if (p === P) {
        const t = from + dir;
        if (!(t & 0x88) && b[t] === 0) {
          if (t >> 4 === promoRank) {
            out[n++] = encode(from, t, Q);
            if (!capturesOnly) {
              out[n++] = encode(from, t, N);
              out[n++] = encode(from, t, R);
              out[n++] = encode(from, t, B);
            }
          } else if (!capturesOnly) {
            out[n++] = encode(from, t);
            if (from >> 4 === startRank && b[t + dir] === 0) out[n++] = encode(from, t + dir, 0, F_DOUBLE);
          }
        }
        for (const d of [dir + 1, dir - 1]) {
          const c = from + d;
          if (c & 0x88) continue;
          if (b[c] * s < 0) {
            if (c >> 4 === promoRank) {
              out[n++] = encode(from, c, Q);
              out[n++] = encode(from, c, N);
              if (!capturesOnly) {
                out[n++] = encode(from, c, R);
                out[n++] = encode(from, c, B);
              }
            } else out[n++] = encode(from, c);
          } else if (c === this.ep) out[n++] = encode(from, c, 0, F_EP);
        }
        continue;
      }
      if (p === N || p === K) {
        const offs = p === N ? N_OFF : K_OFF;
        for (let i = 0; i < 8; i++) {
          const t = from + offs[i];
          if (t & 0x88) continue;
          const q = b[t] * s;
          if (q > 0) continue;
          if (capturesOnly && q === 0) continue;
          out[n++] = encode(from, t);
        }
        if (p === K && !capturesOnly) n = this.genCastles(out, n);
        continue;
      }
      const dirs = p === B ? B_OFF : p === R ? R_OFF : K_OFF;
      for (let i = 0; i < dirs.length; i++) {
        const d = dirs[i];
        let t = from + d;
        while (!(t & 0x88)) {
          const q = b[t] * s;
          if (q > 0) break;
          if (q < 0) {
            out[n++] = encode(from, t);
            break;
          }
          if (!capturesOnly) out[n++] = encode(from, t);
          t += d;
        }
      }
    }
    return n;
  }

  private genCastles(out: Int32Array, n: number) {
    const b = this.b;
    if (this.side === 1) {
      if (this.castle & 1 && b[5] === 0 && b[6] === 0 && b[7] === R && !this.attacked(4, -1) && !this.attacked(5, -1) && !this.attacked(6, -1))
        out[n++] = encode(4, 6, 0, F_CASTLE);
      if (this.castle & 2 && b[3] === 0 && b[2] === 0 && b[1] === 0 && b[0] === R && !this.attacked(4, -1) && !this.attacked(3, -1) && !this.attacked(2, -1))
        out[n++] = encode(4, 2, 0, F_CASTLE);
    } else {
      if (this.castle & 4 && b[117] === 0 && b[118] === 0 && b[119] === -R && !this.attacked(116, 1) && !this.attacked(117, 1) && !this.attacked(118, 1))
        out[n++] = encode(116, 118, 0, F_CASTLE);
      if (this.castle & 8 && b[115] === 0 && b[114] === 0 && b[113] === 0 && b[112] === -R && !this.attacked(116, 1) && !this.attacked(115, 1) && !this.attacked(114, 1))
        out[n++] = encode(116, 114, 0, F_CASTLE);
    }
    return n;
  }

  /** Returns false (and undoes) if the move leaves own king in check. */
  make(m: number): boolean {
    const b = this.b;
    const from = mFrom(m),
      to = mTo(m),
      promo = mPromo(m),
      flag = mFlag(m);
    const s = this.side;
    const piece = b[from];
    let cap = b[to];
    this.undoCap.push(cap);
    this.undoCastle.push(this.castle);
    this.undoEp.push(this.ep);
    this.undoHalf.push(this.half);
    this.undoHash.push(this.hash);
    this.hist.push(this.hash);

    let h = this.hash ^ Z_PIECE[pIdx(piece)][from];
    if (flag === F_EP) {
      const capSq = to - 16 * s;
      cap = b[capSq];
      b[capSq] = 0;
      h ^= Z_PIECE[pIdx(cap)][capSq];
    } else if (cap) h ^= Z_PIECE[pIdx(cap)][to];
    const placed = promo ? promo * s : piece;
    b[to] = placed;
    b[from] = 0;
    h ^= Z_PIECE[pIdx(placed)][to];
    if (flag === F_CASTLE) {
      const rf = to > from ? from + 3 : from - 4;
      const rt = to > from ? from + 1 : from - 1;
      const rook = b[rf];
      b[rt] = rook;
      b[rf] = 0;
      h ^= Z_PIECE[pIdx(rook)][rf] ^ Z_PIECE[pIdx(rook)][rt];
    }
    if (piece * s === K) this.kings[s === 1 ? 0 : 1] = to;
    h ^= Z_CASTLE[this.castle];
    this.castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
    h ^= Z_CASTLE[this.castle];
    if (this.ep >= 0) h ^= Z_EP[this.ep & 7];
    this.ep = flag === F_DOUBLE ? from + 16 * s : -1;
    if (this.ep >= 0) h ^= Z_EP[this.ep & 7];
    this.half = piece * s === P || cap ? 0 : this.half + 1;
    this.side = -s;
    this.hash = h ^ Z_SIDE;

    if (this.attacked(this.kings[s === 1 ? 0 : 1], -s)) {
      this.unmake(m);
      return false;
    }
    return true;
  }

  unmake(m: number) {
    const b = this.b;
    const from = mFrom(m),
      to = mTo(m),
      promo = mPromo(m),
      flag = mFlag(m);
    this.side = -this.side;
    const s = this.side;
    const cap = this.undoCap.pop()!;
    this.castle = this.undoCastle.pop()!;
    this.ep = this.undoEp.pop()!;
    this.half = this.undoHalf.pop()!;
    this.hash = this.undoHash.pop()!;
    this.hist.pop();
    const moved = promo ? P * s : b[to];
    b[from] = moved;
    b[to] = cap; // 0 for en passant: the captured pawn sits behind `to`
    if (flag === F_EP) b[to - 16 * s] = -P * s;
    if (flag === F_CASTLE) {
      const rf = to > from ? from + 3 : from - 4;
      const rt = to > from ? from + 1 : from - 1;
      b[rf] = b[rt];
      b[rt] = 0;
    }
    if (moved * s === K) this.kings[s === 1 ? 0 : 1] = from;
  }

  makeNull() {
    this.undoEp.push(this.ep);
    this.undoHash.push(this.hash);
    let h = this.hash;
    if (this.ep >= 0) h ^= Z_EP[this.ep & 7];
    this.ep = -1;
    this.side = -this.side;
    this.hash = h ^ Z_SIDE;
  }

  unmakeNull() {
    this.side = -this.side;
    this.ep = this.undoEp.pop()!;
    this.hash = this.undoHash.pop()!;
  }

  isRepetition() {
    const h = this.hash;
    const start = Math.max(0, this.hist.length - this.half);
    for (let i = this.hist.length - 2; i >= start; i -= 2) if (this.hist[i] === h) return true;
    return false;
  }

  hasNonPawn(side: number) {
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = this.b[sq] * side;
      if (p > P && p < K) return true;
    }
    return false;
  }

  /** Static evaluation, from the side to move's point of view. */
  evaluate(): number {
    const b = this.b;
    let mg = 0,
      material = 0,
      wb = 0,
      bb = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = b[sq];
      if (!p || p === K || p === -K) continue;
      const t = p > 0 ? p : -p;
      if (t !== P) material += VALUE[t];
      if (t === B) p > 0 ? wb++ : bb++;
    }
    const endgame = material <= 1500;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = b[sq];
      if (!p) continue;
      const rank = sq >> 4,
        file = sq & 7;
      if (p > 0) {
        const idx = (7 - rank) * 8 + file;
        mg += VALUE[p] + (p === K && endgame ? KING_END[idx] : PST[p][idx]);
      } else {
        const t = -p;
        const idx = rank * 8 + file;
        mg -= VALUE[t] + (t === K && endgame ? KING_END[idx] : PST[t][idx]);
      }
    }
    if (wb >= 2) mg += 30;
    if (bb >= 2) mg -= 30;
    return mg * this.side;
  }

  toUci(m: number) {
    const promo = mPromo(m);
    return { from: sqName(mFrom(m)), to: sqName(mTo(m)), promotion: promo ? " pnbrq"[promo] : undefined };
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const TT_BITS = 18;
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;
const ttKey = new Int32Array(TT_SIZE);
const ttMove = new Int32Array(TT_SIZE);
const ttScore = new Int32Array(TT_SIZE);
const ttDepth = new Int8Array(TT_SIZE);
const ttFlag = new Int8Array(TT_SIZE); // 1 exact, 2 lower, 3 upper

const moveBuf = Array.from({ length: MAX_PLY + 8 }, () => new Int32Array(256));
const scoreBuf = Array.from({ length: MAX_PLY + 8 }, () => new Int32Array(256));
const killers = Array.from({ length: MAX_PLY + 8 }, () => [0, 0]);
const history = new Int32Array(128 * 128);

export interface SearchOptions {
  maxDepth: number;
  timeMs: number;
  /** Centipawn noise added to root scores; makes weaker levels human-like. */
  noise?: number;
}

export interface SearchResult {
  move: { from: string; to: string; promotion?: string } | null;
  score: number;
  depth: number;
  nodes: number;
  pv: string;
}

export function searchBestMove(fen: string, opts: SearchOptions): SearchResult {
  const pos = new ChessPosition(fen);
  let nodes = 0;
  let stop = false;
  const deadline = Date.now() + opts.timeMs;
  for (const k of killers) k[0] = k[1] = 0;
  history.fill(0);

  const orderMoves = (ply: number, n: number, tt: number) => {
    const moves = moveBuf[ply];
    const scores = scoreBuf[ply];
    const b = pos.b;
    for (let i = 0; i < n; i++) {
      const m = moves[i];
      if (m === tt) {
        scores[i] = 2_000_000;
        continue;
      }
      const cap = b[mTo(m)];
      const promo = mPromo(m);
      if (cap || mFlag(m) === F_EP) {
        const victim = cap ? Math.abs(cap) : P;
        const attacker = Math.abs(b[mFrom(m)]);
        scores[i] = 1_000_000 + VALUE[victim] * 10 - VALUE[attacker] / 10;
      } else if (promo) scores[i] = 900_000 + promo;
      else if (killers[ply][0] === m) scores[i] = 800_000;
      else if (killers[ply][1] === m) scores[i] = 700_000;
      else scores[i] = history[mFrom(m) * 128 + mTo(m)];
    }
  };

  const pick = (ply: number, i: number, n: number) => {
    const moves = moveBuf[ply];
    const scores = scoreBuf[ply];
    let best = i;
    for (let j = i + 1; j < n; j++) if (scores[j] > scores[best]) best = j;
    if (best !== i) {
      const tm = moves[i];
      moves[i] = moves[best];
      moves[best] = tm;
      const ts = scores[i];
      scores[i] = scores[best];
      scores[best] = ts;
    }
    return moves[i];
  };

  const quiesce = (alpha: number, beta: number, ply: number): number => {
    nodes++;
    if ((nodes & 2047) === 0 && Date.now() > deadline) stop = true;
    if (stop) return 0;
    const stand = pos.evaluate();
    if (ply >= MAX_PLY) return stand;
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    const n = pos.gen(moveBuf[ply], true);
    orderMoves(ply, n, 0);
    for (let i = 0; i < n; i++) {
      const m = pick(ply, i, n);
      // Delta pruning: skip captures that cannot raise alpha.
      const cap = pos.b[mTo(m)];
      if (!mPromo(m) && stand + VALUE[Math.abs(cap) || P] + 200 < alpha) continue;
      if (!pos.make(m)) continue;
      const score = -quiesce(-beta, -alpha, ply + 1);
      pos.unmake(m);
      if (stop) return 0;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  };

  const search = (depth: number, alpha: number, beta: number, ply: number, nullOk: boolean): number => {
    if ((++nodes & 2047) === 0 && Date.now() > deadline) stop = true;
    if (stop) return 0;
    if (ply > 0 && (pos.half >= 100 || pos.isRepetition())) return 0;
    const inCheck = pos.inCheck();
    if (inCheck) depth++;
    if (depth <= 0) return quiesce(alpha, beta, ply);
    if (ply >= MAX_PLY) return pos.evaluate();

    const slot = pos.hash & TT_MASK;
    let tt = 0;
    if (ttKey[slot] === pos.hash) {
      tt = ttMove[slot];
      if (ply > 0 && ttDepth[slot] >= depth) {
        const sc = ttScore[slot];
        const f = ttFlag[slot];
        if (f === 1) return sc;
        if (f === 2 && sc >= beta) return sc;
        if (f === 3 && sc <= alpha) return sc;
      }
    }

    if (nullOk && !inCheck && depth >= 3 && ply > 0 && pos.hasNonPawn(pos.side)) {
      pos.makeNull();
      const sc = -search(depth - 3, -beta, -beta + 1, ply + 1, false);
      pos.unmakeNull();
      if (stop) return 0;
      if (sc >= beta) return beta;
    }

    const n = pos.gen(moveBuf[ply]);
    orderMoves(ply, n, tt);
    let legal = 0;
    let bestScore = -INF;
    let bestMove = 0;
    const origAlpha = alpha;
    for (let i = 0; i < n; i++) {
      const m = pick(ply, i, n);
      if (!pos.make(m)) continue;
      legal++;
      let sc: number;
      if (legal === 1) sc = -search(depth - 1, -beta, -alpha, ply + 1, true);
      else {
        // Principal variation search with a null window, re-search on fail high.
        sc = -search(depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (sc > alpha && sc < beta) sc = -search(depth - 1, -beta, -alpha, ply + 1, true);
      }
      pos.unmake(m);
      if (stop) return 0;
      if (sc > bestScore) {
        bestScore = sc;
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
    if (legal === 0) return inCheck ? -MATE + ply : 0;

    ttKey[slot] = pos.hash;
    ttMove[slot] = bestMove;
    ttScore[slot] = bestScore;
    ttDepth[slot] = depth;
    ttFlag[slot] = bestScore >= beta ? 2 : bestScore <= origAlpha ? 3 : 1;
    return bestScore;
  };

  // Root: iterative deepening, keeps per-move scores for noisy levels.
  const rootN = pos.gen(moveBuf[0]);
  const root: { m: number; score: number }[] = [];
  for (let i = 0; i < rootN; i++) {
    const m = moveBuf[0][i];
    if (pos.make(m)) {
      pos.unmake(m);
      root.push({ m, score: 0 });
    }
  }
  if (root.length === 0) return { move: null, score: pos.inCheck() ? -MATE : 0, depth: 0, nodes, pv: "" };

  let best = root[0];
  let completedDepth = 0;
  const noise = opts.noise ?? 0;
  for (let depth = 1; depth <= opts.maxDepth; depth++) {
    let alpha = -INF;
    for (const r of root) {
      if (!pos.make(r.m)) continue;
      // Full window when noise is wanted (we need real scores for every move).
      const sc = noise > 0 ? -search(depth - 1, -INF, INF, 1, true) : -search(depth - 1, -INF, -alpha, 1, true);
      pos.unmake(r.m);
      if (stop) break;
      r.score = sc;
      if (sc > alpha) alpha = sc;
    }
    if (stop && depth > 1) break;
    root.sort((a, b) => b.score - a.score);
    best = root[0];
    completedDepth = depth;
    if (Math.abs(best.score) > MATE - 100) break;
    if (Date.now() > deadline) break;
  }

  if (noise > 0) {
    let bestNoisy = -INF;
    for (const r of root) {
      const v = r.score + (Math.random() * 2 - 1) * noise;
      if (v > bestNoisy) {
        bestNoisy = v;
        best = r;
      }
    }
  }

  return { move: pos.toUci(best.m), score: best.score, depth: completedDepth, nodes, pv: sqName(mFrom(best.m)) + sqName(mTo(best.m)) };
}

export const ENGINE_LEVELS = {
  easy: { label: "Tập sự", elo: 900, maxDepth: 1, timeMs: 300, noise: 160 },
  medium: { label: "Trung bình", elo: 1300, maxDepth: 3, timeMs: 700, noise: 40 },
  hard: { label: "Cao thủ", elo: 1700, maxDepth: 5, timeMs: 1200, noise: 0 },
  master: { label: "Kiện tướng", elo: 2100, maxDepth: 14, timeMs: 2500, noise: 0 },
} as const;

export type EngineLevel = keyof typeof ENGINE_LEVELS;
