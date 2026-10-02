import { lineAt, assertTurn, int } from './util.js';

export const N = 15;
export const meta = { id: 'gomoku', name: 'Gomoku', blurb: 'Five stones in a row on a big board.', tag: 'Strategy' };

export function init() {
  return { board: Array(N * N).fill(null), turn: 0, winner: null, line: null, last: null };
}

export function move(s, p, m) {
  assertTurn(s, p);
  const i = int(m.i, 0, N * N - 1);
  if (s.board[i] != null) throw new Error('That spot is taken');
  s.board[i] = p;
  s.last = i;
  const line = lineAt(s.board, N, N, i % N, Math.floor(i / N), 5);
  if (line) { s.winner = p; s.line = line; }
  else if (s.board.every((c) => c != null)) s.winner = 'draw';
  else s.turn = 1 - p;
  return s;
}
