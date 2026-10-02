import { assertTurn, int } from './util.js';

export const N = 10;
export const FLEET = [5, 4, 3, 3, 2];
export const meta = { id: 'battleship', name: 'Sea Battle', blurb: 'Hide your fleet. Hunt theirs.', tag: 'Hidden' };

export function init() {
  return {
    phase: 'setup', ships: [null, null], placed: [false, false],
    shots: [Array(N * N).fill(null), Array(N * N).fill(null)],
    turn: 0, winner: null, last: null, msg: null,
  };
}

export function randomFleet() {
  for (;;) {
    const taken = new Set(), ships = [];
    let ok = true;
    for (const len of FLEET) {
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const horiz = Math.random() < 0.5;
        const r = Math.floor(Math.random() * (horiz ? N : N - len + 1));
        const c = Math.floor(Math.random() * (horiz ? N - len + 1 : N));
        const cells = Array.from({ length: len }, (_, k) => (horiz ? r * N + c + k : (r + k) * N + c));
        if (cells.some((x) => taken.has(x))) continue;
        cells.forEach((x) => taken.add(x));
        ships.push(cells);
        placed = true;
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return ships;
  }
}

function validFleet(ships) {
  if (!Array.isArray(ships) || ships.length !== FLEET.length) return false;
  const lens = ships.map((s) => (Array.isArray(s) ? s.length : 0)).sort((a, b) => b - a);
  if (lens.join() !== [...FLEET].sort((a, b) => b - a).join()) return false;
  const seen = new Set();
  for (const ship of ships) {
    if (!ship.every((x) => Number.isInteger(x) && x >= 0 && x < N * N && !seen.has(x))) return false;
    ship.forEach((x) => seen.add(x));
    const cells = [...ship].sort((a, b) => a - b);
    const horiz = cells.every((x, k) => x === cells[0] + k && Math.floor(x / N) === Math.floor(cells[0] / N));
    const vert = cells.every((x, k) => x === cells[0] + k * N);
    if (!horiz && !vert) return false;
  }
  return true;
}

export const isSunk = (ship, shots) => ship.every((x) => shots[x] === 'hit');

export function move(s, p, m) {
  if (s.winner != null) throw new Error('The game is over');
  if (m.type === 'place') {
    if (s.phase !== 'setup') throw new Error('Ships are already placed');
    if (!validFleet(m.ships)) throw new Error('Invalid fleet');
    s.ships[p] = m.ships;
    s.placed[p] = true;
    if (s.placed.every(Boolean)) s.phase = 'play';
    return s;
  }
  if (m.type !== 'fire' || s.phase !== 'play') throw new Error('Invalid move');
  assertTurn(s, p);
  const i = int(m.i, 0, N * N - 1);
  if (s.shots[p][i] != null) throw new Error('You already fired there');
  const ship = s.ships[1 - p].find((sh) => sh.includes(i));
  s.shots[p][i] = ship ? 'hit' : 'miss';
  s.last = { by: p, i };
  s.msg = !ship ? 'Miss.' : isSunk(ship, s.shots[p]) ? `Sunk a ship of length ${ship.length}!` : 'Hit! Fire again.';
  if (s.ships[1 - p].every((sh) => isSunk(sh, s.shots[p]))) s.winner = p;
  else if (!ship) s.turn = 1 - p;
  return s;
}

/** Each player only sees the opponent's ships once they're sunk (or the game ends). */
export function view(s, me) {
  const v = structuredClone(s);
  const opp = 1 - me;
  if (v.ships[opp] && s.winner == null) v.ships[opp] = v.ships[opp].filter((sh) => isSunk(sh, s.shots[me]));
  return v;
}

export function status(s, me) {
  if (s.phase === 'setup') return s.placed[me] ? 'Waiting for your opponent to place their fleet…' : 'Arrange your fleet, then tap Ready';
  return null;
}
