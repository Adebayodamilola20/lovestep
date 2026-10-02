import { CATEGORIES } from '../trivia.js';
import { int } from './util.js';

export const meta = { id: 'quiz', name: 'Quiz Duel', blurb: 'Same question, same clock. No looking it up.', tag: 'Live', hidden: true, immersive: true, strict: true };
export const QUESTIONS = 10;
export const TIMES = { ready: 4000, ask: 30000, pause: 2000, reveal: 3200 };
/** Stepping away (another app, another tab) for longer than this loses the match. A reload comes back well within it. */
export const AWAY_MS = 5000;

export const COUNTS = [5, 10, 15, 20];
export const SECONDS = [10, 15, 20, 30];

/** The host picks the category, how many questions and how long each one runs. */
export function validOptions(o) {
  const cat = o?.cat === 'mixed' || CATEGORIES[o?.cat] ? o.cat : null;
  if (!cat) return null;
  const n = COUNTS.includes(+o?.n) ? +o.n : QUESTIONS;
  const secs = SECONDS.includes(+o?.secs) ? +o.secs : 20;
  return { cat, n, secs };
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function init(opts = {}) {
  const pool = opts.cat === 'mixed' || !CATEGORIES[opts.cat]
    ? Object.values(CATEGORIES).flatMap((c) => c.q)
    : CATEGORIES[opts.cat].q;
  const n = Math.min(opts.n ?? QUESTIONS, pool.length);
  // Questions you've already had together go to the back of the queue, so a rematch is a new quiz.
  const seen = new Set(opts.avoid ?? []);
  const fresh = shuffle(pool.filter((q) => !seen.has(q[0])));
  const old = shuffle(pool.filter((q) => seen.has(q[0])));
  const qs = [...fresh, ...old].slice(0, n).map(([text, right, ...wrong]) => {
    const o = shuffle([right, ...wrong]);
    return { text, o, c: o.indexOf(right) };
  });
  return {
    cat: opts.cat ?? 'mixed', qs, i: 0, phase: 'ready', phaseAt: Date.now(),
    askMs: (opts.secs ?? 20) * 1000,
    answers: [null, null], scores: [0, 0], log: [], point: null,
    turn: null, winner: null, msg: null,
  };
}

/** How long the current phase lasts. */
export function phaseMs(s) {
  return s.phase === 'ask' ? s.askMs ?? TIMES.ask : TIMES[s.phase];
}

/** When the server should next move the match along on its own. */
export function nextTick(s) {
  if (s.winner != null) return null;
  return s.phaseAt + phaseMs(s);
}

function settle(s) {
  // Every right answer is a point, for each of you.
  const q = s.qs[s.i];
  const right = s.answers.map((a) => a != null && a.a === q.c);
  right.forEach((r, p) => { if (r) s.scores[p]++; });
  s.point = { right };
  s.log.push({ i: s.i, a: s.answers.map((x) => x?.a ?? null), t: s.answers.map((x) => x?.t ?? null), right });
}

export function tick(s, now) {
  switch (s.phase) {
    case 'ready': Object.assign(s, { phase: 'ask', phaseAt: now, answers: [null, null] }); break;
    case 'ask': Object.assign(s, { phase: 'pause', phaseAt: now }); break; // time ran out
    case 'pause': settle(s); Object.assign(s, { phase: 'reveal', phaseAt: now }); break;
    case 'reveal':
      if (s.i + 1 < s.qs.length) Object.assign(s, { i: s.i + 1, phase: 'ask', phaseAt: now, answers: [null, null], point: null });
      else {
        s.phase = 'done';
        s.winner = s.scores[0] === s.scores[1] ? 'draw' : s.scores[0] > s.scores[1] ? 0 : 1;
      }
      break;
    default: break;
  }
  return s;
}

export function move(s, p, m, { now = Date.now() } = {}) {
  if (s.winner != null) throw new Error('The match is over');
  if (m.type !== 'answer') throw new Error('Invalid move');
  if (s.phase !== 'ask' || m.q !== s.i) throw new Error('Too late for that one');
  if (s.answers[p]) throw new Error('Already locked in');
  s.answers[p] = { a: int(m.a, 0, 3), t: now - s.phaseAt };
  if (s.answers[0] && s.answers[1]) Object.assign(s, { phase: 'pause', phaseAt: now });
  return s;
}

/** Answers and the right option stay secret until the reveal. Later questions are never sent early. */
export function view(s, me) {
  const v = structuredClone(s);
  const open = s.phase === 'reveal' || s.phase === 'done';
  v.qs = s.qs.map((q, k) => (k < s.i || (k === s.i && open) || s.winner != null ? q : k === s.i ? { text: q.text, o: q.o } : null));
  if (!open) v.answers = s.answers.map((a, k) => (k === me ? a : a ? { locked: true } : null));
  return v;
}

export function status() { return null; }
