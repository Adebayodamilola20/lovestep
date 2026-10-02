import { assertTurn, int } from './util.js';

const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export const meta = { id: 'reversi', name: 'Reversi', blurb: 'Outflank and flip your rival’s discs.', tag: 'Strategy' };

export function init() {
  const board = Array(64).fill(null);
  board[27] = 1; board[36] = 1; board[28] = 0; board[35] = 0;
  return { board, turn: 0, winner: null, last: null, flipped: [], msg: null };
}

export function flips(b, i, p) {
  if (b[i] != null) return [];
  const r0 = i >> 3, c0 = i & 7, out = [];
  for (const [dr, dc] of D) {
    const run = [];
    let r = r0 + dr, c = c0 + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === 1 - p) {
      run.push(r * 8 + c);
      r += dr; c += dc;
    }
    if (run.length && r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === p) out.push(...run);
  }
  return out;
}

export function legalMoves(b, p) {
  const out = [];
  for (let i = 0; i < 64; i++) if (flips(b, i, p).length) out.push(i);
  return out;
}

export const count = (b, p) => b.filter((c) => c === p).length;

export function move(s, p, m) {
  assertTurn(s, p);
  const i = int(m.i, 0, 63);
  const f = flips(s.board, i, p);
  if (!f.length) throw new Error('That move doesn’t flip anything');
  s.board[i] = p;
  for (const j of f) s.board[j] = p;
  s.last = i;
  s.flipped = f;
  s.msg = null;
  if (legalMoves(s.board, 1 - p).length) s.turn = 1 - p;
  else if (legalMoves(s.board, p).length) s.msg = 'No moves for your opponent, so they pass.';
  else {
    const a = count(s.board, 0), b = count(s.board, 1);
    s.winner = a === b ? 'draw' : a > b ? 0 : 1;
  }
  return s;
}
