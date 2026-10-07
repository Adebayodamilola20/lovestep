// Head-to-head records between two accounts, kept across rooms, devices and server restarts.
/** `store` is the data store (store.js); `db` was loaded from it at startup. */
export function createRecords(store, db = {}) {
  db.pairs ??= {};
  const save = () => store.save('records', db);

  const key = (a, b) => [a, b].sort().join('|');
  const pair = (a, b) => (db.pairs[key(a, b)] ??= { wins: {}, draws: 0, games: {}, sync: [], last: 0 });

  return {
    /** Two people sat at the same table: they now know each other, even before a result. */
    meet(a, b) {
      pair(a, b).last = Date.now();
      save();
    },


    knows: (a, b) => !!db.pairs[key(a, b)],

    /** winner: a token, or null for a draw. */
    result(a, b, game, winner) {
      const p = pair(a, b);
      const g = (p.games[game] ??= { wins: {}, draws: 0 });
      if (winner) { p.wins[winner] = (p.wins[winner] || 0) + 1; g.wins[winner] = (g.wins[winner] || 0) + 1; }
      else { p.draws++; g.draws++; }
      p.last = Date.now();
      save();
    },

    sync(a, b, pack, score) {
      const p = pair(a, b);
      p.sync.push({ pack, score, at: Date.now() });
      p.sync = p.sync.slice(-50);
      p.last = Date.now();
      save();
    },

    /** The record as seen by `me` against `them`. */
    between(me, them, game) {
      const p = db.pairs[key(me, them)];
      if (!p) return { you: 0, them: 0, draws: 0, game: { you: 0, them: 0 }, sync: null };
      const g = p.games[game];
      const scores = p.sync.map((s) => s.score);
      return {
        you: p.wins[me] || 0, them: p.wins[them] || 0, draws: p.draws,
        game: { you: g?.wins[me] || 0, them: g?.wins[them] || 0 },
        sync: scores.length ? { rounds: scores.length, avg: Math.round(scores.reduce((x, y) => x + y, 0) / scores.length), best: Math.max(...scores) } : null,
      };
    },

    /** Everyone `me` has played, most recent first. */
    list(me) {
      return Object.entries(db.pairs)
        .filter(([k]) => k.split('|').includes(me))
        .map(([k, p]) => {
          const other = k.split('|').find((t) => t !== me) ?? me;
          const scores = p.sync.map((s) => s.score);
          return {
            id: other, you: p.wins[me] || 0, them: p.wins[other] || 0, draws: p.draws, last: p.last,
            sync: scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null,
          };
        })
        .sort((x, y) => y.last - x.last)
        .slice(0, 12);
    },
  };
}
