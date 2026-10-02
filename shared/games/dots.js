import { assertTurn, int } from './util.js';

export const R = 5, C = 5; // boxes
export const meta = { id: 'dots', name: 'Dots & Boxes', blurb: 'Close a box, claim it, go again.', tag: 'Classic' };

export function init() {
  return {
    h: Array((R + 1) * C).fill(null),
    v: Array(R * (C + 1)).fill(null),
    boxes: Array(R * C).fill(null),
    turn: 0, winner: null, last: null,
  };
}

const full = (s, br, bc) =>
  s.h[br * C + bc] != null && s.h[(br + 1) * C + bc] != null &&
  s.v[br * (C + 1) + bc] != null && s.v[br * (C + 1) + bc + 1] != null;

export function move(s, p, m) {
  assertTurn(s, p);
  let candidates;
  if (m.kind === 'h') {
    const r = int(m.r, 0, R), c = int(m.c, 0, C - 1);
    if (s.h[r * C + c] != null) throw new Error('Line already drawn');
    s.h[r * C + c] = p;
    candidates = [[r - 1, c], [r, c]];
  } else if (m.kind === 'v') {
    const r = int(m.r, 0, R - 1), c = int(m.c, 0, C);
    if (s.v[r * (C + 1) + c] != null) throw new Error('Line already drawn');
    s.v[r * (C + 1) + c] = p;
    candidates = [[r, c - 1], [r, c]];
  } else throw new Error('Invalid move');
  s.last = { kind: m.kind, r: m.r, c: m.c };
  let scored = false;
  for (const [br, bc] of candidates) {
    if (br < 0 || bc < 0 || br >= R || bc >= C) continue;
    if (s.boxes[br * C + bc] == null && full(s, br, bc)) {
      s.boxes[br * C + bc] = p;
      scored = true;
    }
  }
  if (s.boxes.every((b) => b != null)) {
    const a = s.boxes.filter((b) => b === 0).length, b = s.boxes.length - a;
    s.winner = a === b ? 'draw' : a > b ? 0 : 1;
  } else if (!scored) s.turn = 1 - p;
  return s;
}
