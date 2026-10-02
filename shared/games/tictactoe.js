import { lineAt, assertTurn, int } from './util.js';

export const meta = { id: 'tictactoe', name: 'Tic-Tac-Toe', blurb: 'Three in a row. Quick and classic.', tag: 'Quick' };

export function init() {
  return { board: Array(9).fill(null), turn: 0, winner: null, line: null, last: null };
}

export function move(s, p, m) {
  assertTurn(s, p);
  const i = int(m.i, 0, 8);
  if (s.board[i] != null) throw new Error('That square is taken');
  s.board[i] = p;
  s.last = i;
  const line = lineAt(s.board, 3, 3, i % 3, Math.floor(i / 3), 3);
  if (line) { s.winner = p; s.line = line; }
  else if (s.board.every((c) => c != null)) s.winner = 'draw';
  else s.turn = 1 - p;
  return s;
}
