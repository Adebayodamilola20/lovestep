export const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

/** Returns the cells of a run of >= n same-owner cells through (x, y), or null. */
export function lineAt(board, w, h, x, y, n) {
  const v = board[y * w + x];
  if (v == null) return null;
  for (const [dx, dy] of DIRS) {
    const cells = [y * w + x];
    for (const s of [1, -1]) {
      let cx = x + dx * s, cy = y + dy * s;
      while (cx >= 0 && cy >= 0 && cx < w && cy < h && board[cy * w + cx] === v) {
        cells.push(cy * w + cx);
        cx += dx * s;
        cy += dy * s;
      }
    }
    if (cells.length >= n) return cells;
  }
  return null;
}

export function assertTurn(state, p) {
  if (state.winner != null) throw new Error('The game is over');
  if (state.turn !== p) throw new Error('It’s not your turn');
}

export function int(v, lo, hi) {
  if (!Number.isInteger(v) || v < lo || v > hi) throw new Error('Invalid move');
  return v;
}
