import { assertTurn } from './util.js';

export const meta = { id: 'whot', name: 'Whot', blurb: 'Match shape or number. Last card wins.', tag: 'Cards' };

export const SHAPES = ['circle', 'triangle', 'cross', 'square', 'star'];
const NUMBERS = {
  circle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  cross: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  square: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  star: [1, 2, 3, 4, 5, 7, 8],
};
const SPECIAL = new Set([1, 2, 5, 8, 14, 20]);
export const RULES = {
  1: 'Hold on: play again',
  2: 'Pick two',
  5: 'Pick three',
  8: 'Suspension: play again',
  14: 'General market: opponent picks one',
  20: 'Whot: call a shape',
};

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function init() {
  const deck = [];
  for (const s of SHAPES) for (const n of NUMBERS[s]) deck.push({ s, n });
  for (let k = 0; k < 5; k++) deck.push({ s: 'whot', n: 20 });
  deck.forEach((c, i) => (c.id = i));
  shuffle(deck);
  const hands = [deck.splice(0, 5), deck.splice(0, 5)];
  // The starting card is always a plain card so nobody begins under a penalty.
  let top = deck.shift();
  while (SPECIAL.has(top.n)) { deck.push(top); top = deck.shift(); }
  return { deck, pile: [top], hands, turn: 0, need: null, pending: null, winner: null, msg: null, last: null };
}

export const top = (s) => s.pile[s.pile.length - 1];

export function canPlay(s, card) {
  if (s.pending) return card.n === s.pending.type;
  if (card.s === 'whot') return true;
  if (s.need) return card.s === s.need;
  const t = top(s);
  return card.s === t.s || card.n === t.n;
}

export const handValue = (hand) => hand.reduce((sum, c) => sum + (c.s === 'star' ? c.n * 2 : c.n), 0);

function draw(s, p, count) {
  let got = 0;
  for (let k = 0; k < count; k++) {
    if (!s.deck.length) {
      const keep = s.pile.pop();
      s.deck = shuffle(s.pile);
      s.pile = [keep];
    }
    if (!s.deck.length) break;
    s.hands[p].push(s.deck.shift());
    got++;
  }
  return got;
}

function tenders(s) {
  const a = handValue(s.hands[0]), b = handValue(s.hands[1]);
  s.winner = a === b ? 'draw' : a < b ? 0 : 1;
  s.msg = `Market is empty. Hands counted: ${a} to ${b}.`;
}

export function move(s, p, m) {
  assertTurn(s, p);
  const opp = 1 - p;

  if (m.type === 'draw') {
    const want = s.pending ? s.pending.n : 1;
    const got = draw(s, p, want);
    s.last = { by: p, action: 'draw', count: got };
    s.msg = s.pending ? `Picked ${got}.` : null;
    s.pending = null;
    if (!got) { tenders(s); return s; }
    s.turn = opp;
    return s;
  }

  if (m.type !== 'play') throw new Error('Invalid move');
  const idx = s.hands[p].findIndex((c) => c.id === m.id);
  if (idx < 0) throw new Error('That card isn’t in your hand');
  const card = s.hands[p][idx];
  if (!canPlay(s, card)) {
    throw new Error(s.pending ? `Defend with a ${s.pending.type} or go to market` : s.need ? `Play a ${s.need} or a Whot` : 'That card doesn’t match');
  }
  if (card.s === 'whot' && !SHAPES.includes(m.ask)) throw new Error('Call a shape');

  s.hands[p].splice(idx, 1);
  s.pile.push(card);
  s.need = card.s === 'whot' ? m.ask : null;
  s.last = { by: p, action: 'play', card, ask: s.need };
  s.msg = null;

  if (!s.hands[p].length) {
    s.winner = p;
    s.msg = 'Check up!';
    return s;
  }

  let again = false;
  switch (card.n) {
    case 1: again = true; s.msg = 'Hold on.'; break;
    case 8: again = true; s.msg = 'Suspension.'; break;
    case 2: s.pending = { type: 2, n: (s.pending?.n ?? 0) + 2 }; s.msg = `Pick ${s.pending.n}!`; break;
    case 5: s.pending = { type: 5, n: (s.pending?.n ?? 0) + 3 }; s.msg = `Pick ${s.pending.n}!`; break;
    case 14: draw(s, opp, 1); again = true; s.msg = 'General market.'; break;
    case 20: s.msg = `Whot. Calling ${m.ask}.`; break;
  }
  if (s.hands[p].length === 1) s.msg = (s.msg ? s.msg + ' ' : '') + 'Last card!';
  s.turn = again ? p : opp;
  return s;
}

/** Opponent's hand and the market stay face down. */
export function view(s, me) {
  const v = structuredClone(s);
  const opp = 1 - me;
  if (s.winner == null) v.hands[opp] = v.hands[opp].map(() => null);
  v.deck = s.deck.length;
  return v;
}
