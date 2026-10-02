import { lineAt, assertTurn, int } from './util.js';

export const W = 7, H = 6;
export const meta = { id: 'connect4', name: 'Four in a Row', blurb: 'Drop discs. Connect four to win.', tag: 'Classic' };

export function init() {
  return { board: Array(W * H).fill(null), turn: 0, winner: null, line: null, last: null };
}

export function move(s, p, m) {
  assertTurn(s, p);
  const col = int(m.col, 0, W - 1);
  let row = H - 1;
  while (row >= 0 && s.board[row * W + col] != null) row--;
  if (row < 0) throw new Error('That column is full');
  const i = row * W + col;
  s.board[i] = p;
  s.last = i;
  const line = lineAt(s.board, W, H, col, row, 4);
  if (line) { s.winner = p; s.line = line; }
  else if (s.board.every((c) => c != null)) s.winner = 'draw';
  else s.turn = 1 - p;
  return s;
}
