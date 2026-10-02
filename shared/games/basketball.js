// Basketball shootout: you get 30 seconds to sink as many as you can, then they do. Most points wins.
export const TURN_MS = 30000;
const GAP_MS = 250; // a new ball needs a moment to appear
export const meta = { id: 'basketball', name: 'Basketball', blurb: '30 seconds on the clock. Sink as many as you can.', tag: '3D' };

export function init() {
  return { turn: 0, phase: 'ready', turnAt: null, scores: [0, 0], made: [0, 0], shots: [0, 0], streak: 0, done: [false, false], last: null, winner: null, msg: null };
}

/**
 * Where the shot goes. x is the sideways aim (0 is dead centre), v the power (1 is perfect).
 * The same function runs on the phone (to animate straight away) and on the server (to score).
 */
export function resolve(x, v) {
  const ex = Math.abs(x), ev = Math.abs(v - 1);
  if (ex < 0.08 && ev < 0.1) return 'swish';
  if (ex < 0.15 && ev < 0.17) return 'rim-in';
  if (ex < 0.24 && ev < 0.26) return 'rim-out';
  return 'miss';
}
export const scores = (r) => r === 'swish' || r === 'rim-in';
/** Three in a row and you're on fire: every basket after that is worth 3. */
export const ON_FIRE = 3;

export function nextTick(s) {
  return s.winner == null && s.phase === 'shoot' ? s.turnAt + TURN_MS : null;
}

export function tick(s) {
  if (s.phase !== 'shoot') return s;
  s.done[s.turn] = true;
  s.streak = 0;
  if (s.done[0] && s.done[1]) {
    s.phase = 'done';
    s.winner = s.scores[0] === s.scores[1] ? 'draw' : s.scores[0] > s.scores[1] ? 0 : 1;
  } else {
    Object.assign(s, { turn: 1 - s.turn, phase: 'ready', turnAt: null });
  }
  return s;
}

export function move(s, p, m, { now = Date.now() } = {}) {
  if (s.winner != null) throw new Error('The game is over');
  if (m.type !== 'shot') throw new Error('Invalid move');
  if (p !== s.turn) throw new Error('Not your turn');
  if (s.phase === 'ready') Object.assign(s, { phase: 'shoot', turnAt: now }); // the first shot starts your clock
  if (now > s.turnAt + TURN_MS) throw new Error('Time is up');
  if (s.last?.by === p && now - s.last.at < GAP_MS) throw new Error('Wait for the next ball');
  const x = Math.max(-1, Math.min(1, Number(m.x) || 0)), v = Math.max(0, Math.min(2.5, Number(m.v) || 0));
  const result = resolve(x, v);
  let pts = 0;
  s.shots[p]++;
  if (scores(result)) {
    s.streak++;
    pts = s.streak > ON_FIRE ? 3 : 2;
    s.scores[p] += pts;
    s.made[p]++;
  } else s.streak = 0;
  s.last = { by: p, x, v, result, pts, streak: s.streak, n: s.shots[p], at: now };
  return s;
}

export function status(s, me) {
  if (s.winner != null) return null;
  if (s.turn === me) return s.phase === 'ready' ? 'Your turn. The clock starts with your first shot' : null;
  return s.done[me] ? 'Your score is in. They are shooting now' : 'They are shooting first. You are next';
}
