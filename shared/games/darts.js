import { assertTurn } from './util.js';

// Regulation dartboard, in millimetres from the centre. Sectors run clockwise from the top.
export const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
export const RINGS = { bull: 6.35, outerBull: 15.9, trebleIn: 99, trebleOut: 107, doubleIn: 162, doubleOut: 170, board: 225 };
export const START = 301, ROUNDS = 10, PER_TURN = 3;

export const meta = { id: 'darts', name: 'Darts', blurb: '301. Hit zero exactly. Go past it and you bust.', tag: '3D' };
export const animated = true;

/** Score for a point on the board (x right, y up). */
export function scoreAt(x, y) {
  const r = Math.hypot(x, y);
  if (r <= RINGS.bull) return { pts: 50, label: 'Bull', ring: 'bull' };
  if (r <= RINGS.outerBull) return { pts: 25, label: '25', ring: 'outer' };
  if (r > RINGS.doubleOut) return { pts: 0, label: 'Miss', ring: 'miss' };
  const deg = ((Math.atan2(x, y) * 180) / Math.PI + 360 + 9) % 360;
  const base = ORDER[Math.floor(deg / 18) % 20];
  if (r > RINGS.trebleIn && r <= RINGS.trebleOut) return { pts: base * 3, label: `T${base}`, ring: 'treble' };
  if (r > RINGS.doubleIn) return { pts: base * 2, label: `D${base}`, ring: 'double' };
  return { pts: base, label: String(base), ring: 'single' };
}

function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function init() {
  return { scores: [START, START], turn: 0, dartsLeft: PER_TURN, turnStart: START, darts: [], turns: [0, 0], winner: null, msg: null, last: null };
}

function endTurn(s, p) {
  s.turns[p]++;
  if (s.turns[0] >= ROUNDS && s.turns[1] >= ROUNDS) {
    s.winner = s.scores[0] === s.scores[1] ? 'draw' : s.scores[0] < s.scores[1] ? 0 : 1;
    s.msg = `${ROUNDS} rounds up. Lowest score left wins.`;
    return;
  }
  s.turn = 1 - p;
  s.dartsLeft = PER_TURN;
  s.turnStart = s.scores[1 - p];
  s.darts = [];
}

/**
 * m = { type: 'throw', x, y, v }: where the player aimed (mm) and how hard they flicked (1 = perfect).
 * The server adds the hand's natural spread, so nobody can script a perfect throw.
 */
export function move(s, p, m) {
  assertTurn(s, p);
  if (m.type !== 'throw') throw new Error('Invalid move');
  const { x, y, v } = m;
  if (![x, y, v].every(Number.isFinite) || Math.abs(x) > 400 || Math.abs(y) > 400 || v < 0.1 || v > 3) throw new Error('Invalid throw');
  const drop = Math.max(-130, Math.min(130, (v - 1) * 60)); // too soft drops low, too hard sails high
  const land = { x: x + gauss() * 6.5, y: y + gauss() * 6.5 + drop };
  const hit = scoreAt(land.x, land.y);
  const dart = { x: +land.x.toFixed(2), y: +land.y.toFixed(2), ...hit, by: p };
  s.darts.push(dart);
  s.last = dart;
  s.msg = null;
  const left = s.scores[p] - hit.pts;
  if (left < 0) {
    s.scores[p] = s.turnStart;
    s.msg = 'Bust! Back to where the turn started.';
    s.last.bust = true;
    endTurn(s, p);
  } else {
    s.scores[p] = left;
    if (left === 0) { s.winner = p; s.msg = `Checked out with ${hit.label}!`; return s; }
    s.dartsLeft--;
    if (s.dartsLeft === 0) endTurn(s, p);
  }
  return s;
}
