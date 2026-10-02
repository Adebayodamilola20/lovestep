import { MODES, PACKS, question } from '../packs.js';
import { int } from './util.js';

export const meta = { id: 'between', name: 'Between Us', blurb: 'Questions for two. See how in sync you are.', tag: 'For two', hidden: true, immersive: true, startAlone: true };
export const ROUND = 10;
export const GOOD = 80; // percent

/** Only real packs can be started. */
export function validOptions(o) {
  const pack = PACKS[o?.pack];
  return pack ? { pack: pack.id } : null;
}

export function init(opts = {}) {
  const pack = PACKS[opts.pack] ?? Object.values(PACKS)[0];
  const order = [...pack.q.keys()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const n = Math.min(ROUND, order.length);
  return {
    pack: pack.id, mode: pack.mode, qs: order.slice(0, n),
    // null = not answered yet, -1 = skipped, otherwise an option index (or a player index for "most likely").
    // Guessing rounds store { a, g }: your own answer and your guess at theirs.
    answers: [Array(n).fill(null), Array(n).fill(null)],
    progress: [0, 0], done: [false, false],
    turn: null, winner: null, score: null, matches: null, counted: null, knows: null, msg: null,
  };
}

export function optionCount(s, i) {
  return question(PACKS[s.pack], s.qs[i]).options.length;
}

const pickIndex = (s, i, a) => (a === null || a === -1 || a === undefined ? -1 : int(a, 0, optionCount(s, i) - 1));

export function move(s, p, m) {
  if (s.winner != null) throw new Error('This round is finished');
  if (m.type !== 'answer') throw new Error('Invalid move');
  if (s.done[p]) throw new Error('You have answered everything');
  const n = s.qs.length;
  const i = int(m.i, 0, n - 1);
  if (i !== s.progress[p]) throw new Error('Answer the questions in order');
  const kind = MODES[s.mode].kind;

  if (kind === 'guess') {
    const a = pickIndex(s, i, m.a);
    s.answers[p][i] = { a, g: a === -1 ? -1 : pickIndex(s, i, m.g) };
  } else {
    let a = pickIndex(s, i, m.a);
    // "Me" / partner become absolute player indexes so both answers compare directly.
    if (kind === 'likely' && a !== -1) a = a === 0 ? p : 1 - p;
    s.answers[p][i] = a;
  }
  s.progress[p]++;
  if (s.progress[p] === n) s.done[p] = true;

  if (s.done[0] && s.done[1]) finish(s, kind);
  return s;
}

function finish(s, kind) {
  const n = s.qs.length;
  if (kind === 'guess') {
    // knows[p] = how often p guessed the other's answer right.
    const knows = [0, 1].map((p) => {
      let right = 0, tried = 0;
      for (let k = 0; k < n; k++) {
        const mine = s.answers[p][k], theirs = s.answers[1 - p][k];
        if (mine.g === -1 || theirs.a === -1) continue;
        tried++;
        if (mine.g === theirs.a) right++;
      }
      return { right, tried, pct: tried ? Math.round((right / tried) * 100) : 0 };
    });
    s.knows = knows;
    s.matches = knows[0].right + knows[1].right;
    s.counted = knows[0].tried + knows[1].tried;
  } else {
    let matches = 0, counted = 0;
    for (let k = 0; k < n; k++) {
      const x = s.answers[0][k], y = s.answers[1][k];
      if (x === -1 || y === -1) continue;
      counted++;
      if (x === y) matches++;
    }
    s.matches = matches;
    s.counted = counted;
  }
  s.score = s.counted ? Math.round((s.matches / s.counted) * 100) : 0;
  s.winner = 'done';
}

/** Your partner's answers stay hidden until you have both finished. */
export function view(s, me) {
  const v = structuredClone(s);
  if (s.winner == null) v.answers[1 - me] = null;
  return v;
}

export function status(s, me) {
  if (s.winner != null) return null;
  if (s.done[me]) return 'Waiting for your partner';
  return 'Answer together, apart';
}
