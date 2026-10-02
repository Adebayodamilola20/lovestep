import { assertTurn, int } from './util.js';

export const meta = { id: 'mancala', name: 'Mancala', blurb: 'Sow stones, capture, fill your store.', tag: 'Strategy' };
export const animated = true;
export const store = (p) => p * 7 + 6;

export function init() {
  const pits = Array(14).fill(4);
  pits[6] = 0; pits[13] = 0;
  return { pits, turn: 0, winner: null, last: null, msg: null };
}

export function move(s, p, m) {
  assertTurn(s, p);
  let i = p * 7 + int(m.pit, 0, 5);
  let n = s.pits[i];
  if (!n) throw new Error('That pit is empty');
  s.pits[i] = 0;
  const path = [];
  while (n > 0) {
    i = (i + 1) % 14;
    if (i === store(1 - p)) continue;
    s.pits[i]++;
    path.push(i);
    n--;
  }
  s.last = { from: p * 7 + m.pit, path };
  s.msg = null;
  const again = i === store(p);
  if (!again && i >= p * 7 && i < p * 7 + 6 && s.pits[i] === 1 && s.pits[12 - i] > 0) {
    s.msg = `Captured ${s.pits[12 - i]} stones!`;
    s.pits[store(p)] += s.pits[12 - i] + 1;
    s.pits[12 - i] = 0;
    s.pits[i] = 0;
  }
  if (again) s.msg = 'Landed in your store. Go again!';
  const side = (q) => s.pits.slice(q * 7, q * 7 + 6).reduce((a, b) => a + b, 0);
  if (side(0) === 0 || side(1) === 0) {
    for (const q of [0, 1]) {
      s.pits[store(q)] += side(q);
      for (let k = 0; k < 6; k++) s.pits[q * 7 + k] = 0;
    }
    const a = s.pits[6], b = s.pits[13];
    s.winner = a === b ? 'draw' : a > b ? 0 : 1;
  } else if (!again) s.turn = 1 - p;
  return s;
}
