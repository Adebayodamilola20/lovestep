import { assertTurn } from './util.js';

// A 122 cm target face: ten rings, 61 mm each, plus the inner X.
export const FACE = 610, RING = 61, PER_END = 3, ENDS = 4;
export const meta = { id: 'archery', name: 'Archery', blurb: 'Draw, read the wind, release.', tag: '3D' };
export const animated = true;

export function scoreAt(x, y) {
  const r = Math.hypot(x, y);
  if (r >= FACE) return { pts: 0, label: 'Miss' };
  if (r < RING / 2) return { pts: 10, label: 'X' };
  const pts = 10 - Math.floor(r / RING);
  return { pts, label: String(pts) };
}

const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const newWind = () => ({ speed: Math.round(Math.random() * 12 * 10) / 10, dir: Math.round(Math.random() * 360) });

export function init() {
  return { totals: [0, 0], turn: 0, arrowsLeft: PER_END, arrows: [], ends: [0, 0], wind: newWind(), winner: null, msg: null, last: null };
}

/** How far the wind pushes an arrow at this range, in mm. Shown to players so they can aim off. */
export const windDrift = (w) => ({ x: Math.sin((w.dir * Math.PI) / 180) * w.speed * 22, y: -Math.cos((w.dir * Math.PI) / 180) * w.speed * 9 });

/** m = { type: 'shoot', x, y, draw, hold }: aim point (mm), draw 0-1, seconds held at full draw. */
export function move(s, p, m) {
  assertTurn(s, p);
  if (m.type !== 'shoot') throw new Error('Invalid move');
  const { x, y, draw, hold } = m;
  if (![x, y, draw, hold].every(Number.isFinite) || Math.abs(x) > 2500 || Math.abs(y) > 2500 || draw < 0 || draw > 1 || hold < 0) throw new Error('Invalid shot');
  const drift = windDrift(s.wind);
  const tired = Math.max(0, hold - 4) * 25; // arms shake after four seconds at full draw
  const sigma = 26 + tired;
  const land = { x: x + drift.x + gauss() * sigma, y: y + drift.y + gauss() * sigma - (1 - draw) * 900 };
  const hit = scoreAt(land.x, land.y);
  const arrow = { x: +land.x.toFixed(1), y: +land.y.toFixed(1), ...hit, by: p };
  s.arrows.push(arrow);
  s.last = arrow;
  s.totals[p] += hit.pts;
  s.msg = null;
  if (--s.arrowsLeft === 0) {
    s.ends[p]++;
    if (s.ends[0] >= ENDS && s.ends[1] >= ENDS) {
      s.winner = s.totals[0] === s.totals[1] ? 'draw' : s.totals[0] > s.totals[1] ? 0 : 1;
      s.msg = `${ENDS} ends shot. Highest total wins.`;
      return s;
    }
    s.turn = 1 - p;
    s.arrowsLeft = PER_END;
    s.arrows = [];
    s.wind = newWind();
  }
  return s;
}
