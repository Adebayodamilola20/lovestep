export const CHOICES = ['rock', 'paper', 'scissors'];
export const WIN = 3;
export const meta = { id: 'rps', name: 'Rock Paper Scissors', blurb: 'First to three. Read their mind.', tag: 'Quick' };

export function init() {
  return { score: [0, 0], round: 1, picks: [null, null], last: null, turn: null, winner: null, msg: null };
}

/** a beats b: paper covers rock, scissors cut paper, rock blunts scissors. */
export const beats = (a, b) => (a - b + 3) % 3 === 1;

/** Both players lock a pick in secret; the round resolves the moment both have. */
export function move(s, p, m) {
  if (s.winner != null) throw new Error('The match is over');
  if (m.type !== 'lock' || !Number.isInteger(m.pick) || m.pick < 0 || m.pick > 2) throw new Error('Pick rock, paper or scissors');
  if (s.picks[p] != null) throw new Error('Already locked in');
  s.picks[p] = m.pick;
  if (s.picks[0] != null && s.picks[1] != null) {
    const [a, b] = s.picks;
    const won = a === b ? null : beats(a, b) ? 0 : 1;
    if (won != null) s.score[won]++;
    s.last = { round: s.round, picks: [a, b], won };
    s.picks = [null, null];
    s.round++;
    if (s.score[0] >= WIN) s.winner = 0;
    else if (s.score[1] >= WIN) s.winner = 1;
  }
  return s;
}

/** Your opponent's pick stays secret until you've both locked in. */
export function view(s, me) {
  const v = structuredClone(s);
  v.picks = s.picks.map((pk, k) => (k === me ? pk : pk != null ? 'locked' : null));
  return v;
}

// The table itself says whose pick is in, so no extra status line above it.
export function status() { return ''; }
