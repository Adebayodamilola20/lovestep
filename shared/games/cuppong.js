import { assertTurn } from './util.js';

// Distances in mm. The rack sits at the far end with its point toward the thrower.
export const CUP_R = 46, BALLS = 2, RACK_D = 2150;
export const meta = { id: 'cuppong', name: 'Cup Pong', blurb: 'Flick it in. Sink all ten.', tag: '3D' };
export const animated = true;

export const CUPS = (() => {
  const out = [], gap = CUP_R * 2 + 2, row = gap * Math.sin(Math.PI / 3);
  for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) out.push({ x: (k - r / 2) * gap, d: RACK_D + r * row });
  return out;
})();

export function init() {
  return { cups: [CUPS.map(() => true), CUPS.map(() => true)], turn: 0, ballsLeft: BALLS, madeThisTurn: 0, bonus: false, winner: null, msg: null, last: null };
}

/** m = { type: 'throw', x, d }: where the flick was aimed to land (mm). The server adds the wobble. */
export function move(s, p, m) {
  assertTurn(s, p);
  if (m.type !== 'throw') throw new Error('Invalid move');
  if (!Number.isFinite(m.x) || !Number.isFinite(m.d) || Math.abs(m.x) > 900 || m.d < 500 || m.d > 3600) throw new Error('Invalid throw');
  const target = s.cups[1 - p];
  const land = { x: m.x + (Math.random() - 0.5) * 2 * 26, d: m.d + (Math.random() - 0.5) * 2 * 34 };
  let result = 'miss', cup = -1, best = Infinity;
  CUPS.forEach((c, i) => {
    if (!target[i]) return;
    const dist = Math.hypot(c.x - land.x, c.d - land.d);
    if (dist < best) { best = dist; cup = i; }
  });
  if (best < CUP_R * 0.82) result = 'swish';
  else if (best < CUP_R * 1.15) result = Math.random() < 0.45 ? 'rattle' : 'rim';
  else cup = best < CUP_R * 2 ? cup : -1;
  const made = result === 'swish' || result === 'rattle';
  if (made) { target[cup] = false; s.madeThisTurn++; }
  s.last = { by: p, x: +land.x.toFixed(1), d: +land.d.toFixed(1), result, cup };
  s.msg = null;
  if (target.every((c) => !c)) { s.winner = p; s.msg = 'Last cup sunk!'; return s; }
  if (--s.ballsLeft === 0) {
    // House rule: sink both and you get the balls back, once.
    if (s.madeThisTurn === BALLS && !s.bonus) { s.ballsLeft = BALLS; s.madeThisTurn = 0; s.bonus = true; s.msg = 'Both in! Balls back.'; return s; }
    s.turn = 1 - p;
    s.ballsLeft = BALLS;
    s.madeThisTurn = 0;
    s.bonus = false;
  }
  return s;
}
