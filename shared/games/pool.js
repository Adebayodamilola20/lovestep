import { assertTurn } from './util.js';

// Physics uses only + - * / and sqrt (all exactly rounded in IEEE-754), so the
// same shot plays out bit-for-bit identically on the server and in every browser.

export const meta = { id: 'pool', name: '8 Ball Pool', blurb: 'Sink your group, then call the 8.', tag: 'Featured' };
export const animated = true;

export const W = 1000, H = 500, R = 12, MAXV = 26;
export const POCKETS = [
  { x: 0, y: 0, r: 28 }, { x: W / 2, y: -8, r: 24 }, { x: W, y: 0, r: 28 },
  { x: 0, y: H, r: 28 }, { x: W / 2, y: H + 8, r: 24 }, { x: W, y: H, r: 28 },
];
export const HEAD = { x: W * 0.25, y: H / 2 };
const FOOT = { x: W * 0.72, y: H / 2 };
// Deceleration = rolling resistance (constant) + cloth drag (proportional), so a ball
// sheds speed quickly when hit hard and then creeps to a stop over the last second.
const SUB = 6, FRICTION = 0.99, ROLL = 0.01, STOP = 0.004, CUSHION = 0.8, RESTITUTION = 0.95;

export const groupOf = (id) => (id === 0 ? 'cue' : id === 8 ? '8' : id < 8 ? 'solids' : 'stripes');
const other = (g) => (g === 'solids' ? 'stripes' : 'solids');
export const remaining = (balls, g) => balls.filter((b) => b.on && groupOf(b.id) === g).length;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function init() {
  const gap = 2 * R + 0.3, dx = (gap * Math.sqrt(3)) / 2;
  const spots = [];
  for (let k = 0; k < 5; k++) for (let j = 0; j <= k; j++) spots.push({ x: FOOT.x + k * dx, y: FOOT.y + (j - k / 2) * gap });
  // 8 in the middle, one solid and one stripe in the back corners.
  const order = Array(15).fill(null);
  order[4] = 8;
  const solids = shuffle([1, 2, 3, 4, 5, 6, 7]), stripes = shuffle([9, 10, 11, 12, 13, 14, 15]);
  const [c1, c2] = Math.random() < 0.5 ? [solids.pop(), stripes.pop()] : [stripes.pop(), solids.pop()];
  order[10] = c1; order[14] = c2;
  const rest = shuffle([...solids, ...stripes]);
  for (let i = 0; i < 15; i++) if (order[i] == null) order[i] = rest.pop();
  const balls = [{ id: 0, x: HEAD.x, y: HEAD.y, on: true }];
  order.forEach((id, i) => balls.push({ id, x: spots[i].x, y: spots[i].y, on: true }));
  balls.sort((a, b) => a.id - b.id);
  return { balls, turn: 0, groups: null, ballInHand: true, breakShot: true, winner: null, msg: null };
}

export function createSim(balls, vx, vy) {
  const bs = balls.map((b) => ({ ...b, vx: 0, vy: 0 }));
  const cue = bs.find((b) => b.id === 0);
  cue.vx = vx;
  cue.vy = vy;
  const ev = { firstHit: null, potted: [], frames: 0 };
  function step() {
    for (let s = 0; s < SUB; s++) {
      for (const b of bs) {
        if (!b.on) continue;
        b.x += b.vx / SUB;
        b.y += b.vy / SUB;
        let near = false;
        for (const p of POCKETS) {
          const dx = b.x - p.x, dy = b.y - p.y, d2 = dx * dx + dy * dy;
          if (d2 < p.r * p.r) { b.on = false; break; }
          if (d2 < (p.r + R + 8) * (p.r + R + 8)) near = true;
        }
        if (!b.on || (near && (b.x < -R || b.x > W + R || b.y < -R || b.y > H + R))) {
          b.on = false; b.vx = 0; b.vy = 0;
          ev.potted.push(b.id);
          continue;
        }
        if (near) continue;
        if (b.x < R) { b.x = R; b.vx = -b.vx * CUSHION; }
        else if (b.x > W - R) { b.x = W - R; b.vx = -b.vx * CUSHION; }
        if (b.y < R) { b.y = R; b.vy = -b.vy * CUSHION; }
        else if (b.y > H - R) { b.y = H - R; b.vy = -b.vy * CUSHION; }
      }
      for (let i = 0; i < bs.length; i++) {
        const a = bs[i];
        if (!a.on) continue;
        for (let j = i + 1; j < bs.length; j++) {
          const b = bs[j];
          if (!b.on) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
          if (d2 >= 4 * R * R || d2 === 0) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, push = (2 * R - d) / 2;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel > 0) {
            const imp = (rel * (1 + RESTITUTION)) / 2;
            a.vx -= imp * nx; a.vy -= imp * ny;
            b.vx += imp * nx; b.vy += imp * ny;
          }
          if (ev.firstHit == null && (a.id === 0 || b.id === 0)) ev.firstHit = a.id === 0 ? b.id : a.id;
        }
      }
    }
    let moving = false;
    for (const b of bs) {
      const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      const ns = sp * FRICTION - ROLL;
      if (!b.on || ns <= STOP) { b.vx = 0; b.vy = 0; continue; }
      b.vx *= ns / sp; b.vy *= ns / sp;
      moving = true;
    }
    ev.frames++;
    return moving && ev.frames < 5000;
  }
  return { balls: bs, ev, step };
}

const strip = (bs) => bs.map(({ id, x, y, on }) => ({ id, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, on }));

function freeSpot(balls, self, x, y) {
  while (balls.some((b) => b !== self && b.on && (b.x - x) ** 2 + (b.y - y) ** 2 < 4 * R * R)) x += 2 * R + 1;
  return { x, y };
}

export function validCuePlacement(s, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x < R || x > (s.breakShot ? HEAD.x : W - R) || y < R || y > H - R) return false;
  return !s.balls.some((b) => b.id !== 0 && b.on && (b.x - x) ** 2 + (b.y - y) ** 2 < 4 * R * R);
}

/** Positions before the shot, with ball-in-hand placement applied. */
export function shotStart(s, m) {
  const balls = s.balls.map((b) => ({ ...b }));
  if (s.ballInHand && m.cue) Object.assign(balls[0], { x: m.cue.x, y: m.cue.y, on: true });
  return balls;
}

export function move(s, p, m) {
  assertTurn(s, p);
  if (m.type !== 'shot') throw new Error('Invalid move');
  const { vx, vy } = m;
  if (!Number.isFinite(vx) || !Number.isFinite(vy)) throw new Error('Invalid shot');
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed <= 0 || speed > MAXV + 0.01) throw new Error('Invalid shot power');
  if (m.cue && (!s.ballInHand || !validCuePlacement(s, m.cue.x, m.cue.y))) throw new Error('You can’t place the cue ball there');

  const sim = createSim(shotStart(s, m), vx, vy);
  while (sim.step());
  const { firstHit, potted } = sim.ev;
  const balls = strip(sim.balls);

  const mine = s.groups?.[p];
  const scratch = potted.includes(0);
  const eight = potted.includes(8);
  const objects = potted.filter((id) => id !== 0 && id !== 8);
  const clearedBefore = mine && remaining(s.balls, mine) === 0;

  let foul = null;
  if (scratch) foul = 'Scratch';
  else if (firstHit == null) foul = 'No ball hit';
  else if (mine && groupOf(firstHit) !== (clearedBefore ? '8' : mine)) foul = 'Wrong ball hit first';
  else if (!mine && !s.breakShot && firstHit === 8) foul = 'Hit the 8 first';

  const next = { ...s, balls, breakShot: false, ballInHand: false, msg: null };

  if (eight) {
    if (s.breakShot) {
      const b8 = balls.find((b) => b.id === 8);
      Object.assign(b8, { on: true }, freeSpot(balls, b8, FOOT.x, FOOT.y));
    } else {
      const won = clearedBefore && !foul;
      next.winner = won ? p : 1 - p;
      next.msg = won ? 'Sank the 8 ball!' : foul ? `${foul} on the 8 ball.` : 'Sank the 8 ball too early.';
      return next;
    }
  }
  if (scratch) {
    const cue = balls[0];
    Object.assign(cue, { on: true }, freeSpot(balls, cue, HEAD.x, HEAD.y));
  }
  if (!s.groups && !s.breakShot && !foul && objects.length) {
    const g = groupOf(objects[0]);
    next.groups = p === 0 ? [g, other(g)] : [other(g), g];
  }
  const myGroup = next.groups?.[p];
  const keep = !foul && (myGroup ? objects.some((id) => groupOf(id) === myGroup) : objects.length > 0);
  if (foul) {
    next.turn = 1 - p;
    next.ballInHand = true;
    next.msg = `${foul}! Ball in hand.`;
  } else if (keep) {
    next.msg = !s.groups && next.groups ? `Took ${myGroup}. Shoot again!` : 'Nice shot, go again!';
  } else {
    next.turn = 1 - p;
  }
  return next;
}
