// Ludo for two: red (you if you created the room) against yellow, from opposite corners.
// Classic rules: roll a 6 to bring a piece out, a 6 rolls again (three 6s in a row and your turn ends),
// landing on an opponent sends their piece home unless it's on a safe square, exact roll to finish.
export const meta = { id: 'ludo', name: 'Ludo', blurb: 'Roll, race and send each other home.', tag: '3D' };

export const TRACK = 52, HOME = 56, PIECES = 4;
export const COLORS = ['red', 'yellow'];
export const START = [0, 26]; // where each colour enters the track
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]); // starts and stars

/** The 52 track squares as [col, row] on a 15x15 board (row 0 at the top), clockwise from red's start. */
export const PATH = (() => {
  const p = [];
  const run = (c, r, dc, dr, n) => { for (let k = 0; k < n; k++) p.push([c + dc * k, r + dr * k]); };
  run(1, 6, 1, 0, 5);   // red's arm, heading right
  run(6, 5, 0, -1, 6);  // up the top arm's left column
  run(7, 0, 1, 0, 1);   // across the top
  run(8, 0, 0, 1, 6);   // down the top arm's right column
  run(9, 6, 1, 0, 6);   // out along the right arm's top row
  run(14, 7, 0, 1, 1);  // the right end
  run(14, 8, -1, 0, 6); // back along the right arm's bottom row
  run(8, 9, 0, 1, 6);   // down the bottom arm's right column
  run(7, 14, -1, 0, 1); // across the bottom
  run(6, 14, 0, -1, 6); // up the bottom arm's left column
  run(5, 8, -1, 0, 6);  // out along the left arm's bottom row
  run(0, 7, 0, -1, 2);  // the left end, back to red's start
  return p;
})();
/** Each colour's home column (progress 51..55), ending next to the centre. */
export const LANES = [
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
];
/** Yard spots for pieces that haven't come out yet. */
export const YARDS = [
  [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]],
  [[10.5, 10.5], [12.5, 10.5], [10.5, 12.5], [12.5, 12.5]],
];

/** Board square of a piece (progress -1 = yard, 0..50 track, 51..55 home column, 56 home). */
export function squareOf(color, piece, progress) {
  if (progress < 0) return YARDS[color][piece];
  if (progress <= 50) return PATH[(START[color] + progress) % TRACK];
  if (progress < HOME) return LANES[color][progress - 51];
  return [7, 7];
}
export const trackIndex = (color, progress) => (progress >= 0 && progress <= 50 ? (START[color] + progress) % TRACK : null);

export function init() {
  return { turn: 0, phase: 'roll', dice: null, sixes: 0, pieces: [[-1, -1, -1, -1], [-1, -1, -1, -1]], last: null, winner: null, msg: null };
}

/** Pieces that can move with this roll. */
export function legal(s, p, d = s.dice) {
  if (d == null) return [];
  return s.pieces[p].map((pos, i) => (pos < 0 ? (d === 6 ? i : -1) : pos + d <= HOME ? i : -1)).filter((i) => i >= 0);
}

function endTurn(s, again) {
  s.phase = 'roll';
  if (!again) { s.turn = 1 - s.turn; s.sixes = 0; }
}

export function move(s, p, m) {
  if (s.winner != null) throw new Error('The game is over');
  if (p !== s.turn) throw new Error('Not your turn');
  if (m.type === 'roll') {
    if (s.phase !== 'roll') throw new Error('Move a piece first');
    const d = 1 + Math.floor(Math.random() * 6);
    s.dice = d;
    s.sixes = d === 6 ? s.sixes + 1 : 0;
    s.last = { type: 'roll', by: p, dice: d };
    if (s.sixes === 3) { s.last.burnt = true; s.msg = 'Three 6s in a row. Turn over.'; endTurn(s, false); return s; }
    const can = legal(s, p, d);
    s.msg = null;
    if (!can.length) { s.last.stuck = true; endTurn(s, d === 6); return s; }
    s.phase = 'move';
    return s;
  }
  if (m.type === 'move') {
    if (s.phase !== 'move') throw new Error('Roll first');
    const i = Number(m.piece);
    if (!legal(s, p).includes(i)) throw new Error('That piece can’t move');
    const d = s.dice, from = s.pieces[p][i];
    const to = from < 0 ? 0 : from + d;
    s.pieces[p][i] = to;
    // Land on them (not on a safe square) and they go back to their yard.
    let captured = [];
    const at = trackIndex(p, to);
    if (at != null && !SAFE.has(at)) {
      const o = 1 - p;
      s.pieces[o].forEach((pos, j) => { if (trackIndex(o, pos) === at) { s.pieces[o][j] = -1; captured.push(j); } });
    }
    s.last = { type: 'move', by: p, piece: i, from, to, dice: d, captured };
    if (s.pieces[p].every((pos) => pos === HOME)) { s.winner = p; s.msg = 'All four pieces home.'; return s; }
    // A 6, a capture or getting a piece home earns another roll.
    endTurn(s, d === 6 || captured.length > 0 || to === HOME);
    return s;
  }
  throw new Error('Invalid move');
}

export function status(s, me) {
  if (s.winner != null) return null;
  if (s.turn !== me) return null;
  return s.phase === 'roll' ? 'Your roll' : 'Pick a piece to move';
}
