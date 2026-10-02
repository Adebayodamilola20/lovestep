import { assertTurn } from './util.js';

export const meta = { id: 'checkers', name: 'Checkers', blurb: 'Jump, chain captures, get kinged.', tag: 'Classic' };
const inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

export function init() {
  const board = Array(64).fill(null);
  for (let i = 0; i < 64; i++) {
    const r = i >> 3, c = i & 7;
    if ((r + c) % 2 === 1) {
      if (r < 3) board[i] = { p: 1, k: false };
      if (r > 4) board[i] = { p: 0, k: false };
    }
  }
  return { board, turn: 0, winner: null, chain: null, last: null };
}

function pieceMoves(b, i) {
  const pc = b[i], r = i >> 3, c = i & 7;
  const dirs = pc.k ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : pc.p === 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
  const caps = [], steps = [];
  for (const [dr, dc] of dirs) {
    const r1 = r + dr, c1 = c + dc;
    if (!inb(r1, c1)) continue;
    const j = r1 * 8 + c1;
    if (!b[j]) steps.push({ from: i, to: j });
    else if (b[j].p !== pc.p && inb(r1 + dr, c1 + dc) && !b[(r1 + dr) * 8 + c1 + dc]) {
      caps.push({ from: i, to: (r1 + dr) * 8 + c1 + dc, cap: j });
    }
  }
  return { caps, steps };
}

/** Captures are mandatory; during a multi-jump only the jumping piece may move. */
export function legalMoves(s, p) {
  if (s.chain != null) return pieceMoves(s.board, s.chain).caps;
  const caps = [], steps = [];
  s.board.forEach((pc, i) => {
    if (pc?.p !== p) return;
    const m = pieceMoves(s.board, i);
    caps.push(...m.caps);
    steps.push(...m.steps);
  });
  return caps.length ? caps : steps;
}

export function move(s, p, m) {
  assertTurn(s, p);
  const mv = legalMoves(s, p).find((x) => x.from === m.from && x.to === m.to);
  if (!mv) throw new Error(legalMoves(s, p).some((x) => x.cap != null) ? 'You must capture' : 'Illegal move');
  const pc = s.board[mv.from];
  s.board[mv.to] = pc;
  s.board[mv.from] = null;
  if (mv.cap != null) s.board[mv.cap] = null;
  s.last = mv;
  const row = mv.to >> 3;
  let promoted = false;
  if (!pc.k && ((pc.p === 0 && row === 0) || (pc.p === 1 && row === 7))) pc.k = promoted = true;
  if (mv.cap != null && !promoted && pieceMoves(s.board, mv.to).caps.length) {
    s.chain = mv.to;
    return s;
  }
  s.chain = null;
  s.turn = 1 - p;
  if (!legalMoves(s, 1 - p).length) s.winner = p;
  return s;
}
