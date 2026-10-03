import express from 'express';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { games } from './shared/games/index.js';
import { AWAY_MS } from './shared/games/quiz.js';
import { PACKS, MODES } from './shared/packs.js';
import { CATEGORIES } from './shared/trivia.js';
import { createRecords } from './records.js';
import { createUsers } from './users.js';
import { createStore } from './store.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const store = await createStore(root + 'data');
const users = createUsers(store, await store.load('users', {}));
const records = createRecords(store, await store.load('records', {}));
// One conversation per couple, shared by the home page and every game: "uidA|uidB" -> messages.
const threads = await store.load('threads', {});
const threadKey = (a, b) => [a, b].sort().join('|');
const THREAD_MAX = 300;

const app = express();
app.use(express.static(root + 'public'));
app.use('/shared', express.static(root + 'shared'));
app.get('/avatars/:file', async (req, res) => {
  const m = /^([0-9a-f-]{36})\.jpg$/.exec(req.params.file);
  const buf = m && await users.avatar(m[1]);
  if (!buf) return res.status(404).end();
  res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=2592000, immutable' }).send(buf);
});
// Self-hosted vendor assets: no third-party CDNs at runtime.
const vendor = { 'socket.io': 'socket.io/client-dist', three: 'three/build', 'three-addons': 'three/examples/jsm', geist: '@fontsource-variable/geist', 'geist-mono': '@fontsource-variable/geist-mono', phosphor: '@phosphor-icons/web/src' };
for (const [name, dir] of Object.entries(vendor)) app.use(`/vendor/${name}`, express.static(root + 'node_modules/' + dir, { maxAge: '7d' }));
app.get(['/r/:code', '/play/:game', '/between', '/between/:mode', '/between/c/:id', '/me', '/quiz'], (_req, res) => res.sendFile(root + 'public/index.html'));
// Where the page finds this server. Served here it's "same address"; the Vercel build writes its own copy.
app.get('/config.js', (_req, res) => res.type('js').send('window.LS_API = "";'));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

const server = createServer(app);
// Short heartbeats so a dropped phone is noticed within seconds, not a minute. Room for photo uploads.
// The website may be hosted elsewhere (Vercel) and connect here from its own address.
const origins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
const io = new Server(server, { pingInterval: 4000, pingTimeout: 6000, maxHttpBufferSize: 600_000, cors: { origin: origins.length ? origins : true } });

/** code -> { code, game, options, players: [{ uid, sid, connected, net }], state, seq, lastMove, prev, score, rematch, touched } */
const rooms = new Map();
const online = new Map(); // uid -> number of open sockets

// Rooms are saved (disk locally, MongoDB in production) so a restart never closes a game someone is in.
const SKIP = new Set(['timer', 'dropTimer', 'awayTimer', 'sid']);
function saveRooms() {
  store.save('rooms', () => JSON.parse(JSON.stringify([...rooms.values()], (k, v) => (SKIP.has(k) ? undefined : v))));
}
async function loadRooms() {
  for (const room of await store.load('rooms', [])) {
    if (!games[room.game]) continue; // a game that has since been removed
    // Nobody is connected after a restart; each player is reseated when their page reconnects.
    room.players.forEach((p) => Object.assign(p, { sid: null, connected: false, net: 'good' }));
    rooms.set(room.code, room);
  }
}
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode() {
  let code;
  do code = Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
  while (rooms.has(code));
  return code;
}

const nameOf = (uid) => users.get(uid)?.username ?? 'Player';
const personOf = (uid) => ({ ...users.publicUser(users.get(uid)), online: (online.get(uid) || 0) > 0 });

function payload(room, you) {
  const mod = games[room.game];
  const view = (s) => (s && mod.view ? mod.view(s, you) : s);
  return {
    code: room.code,
    game: room.game,
    you,
    players: room.players.map((p) => ({ ...personOf(p.uid), name: nameOf(p.uid), connected: p.connected, left: !!p.left, net: p.net || 'good' })),
    options: room.options,
    record: room.players.length === 2 ? records.between(room.players[you].uid, room.players[1 - you].uid, room.game) : null,
    state: view(room.state),
    prev: mod.animated ? view(room.prev) : null,
    seq: room.seq,
    lastMove: room.lastMove,
    score: room.score,
    rematch: room.rematch,
    now: Date.now(), // lets phones line their clocks up with the server (Movie Night sync)
  };
}

function broadcast(room) {
  room.touched = Date.now();
  saveRooms();
  room.players.forEach((p, i) => {
    if (p.sid) io.to(p.sid).emit('room', payload(room, i));
  });
}

// Quiz questions each pair has already seen, so new matches (and rematches) bring new ones.
const asked = new Map(); // "uidA|uidB" -> question texts, oldest first
const pairKey = (room) => room.players.map((p) => p.uid).sort().join('|');

function startGame(room) {
  let opts = room.options ?? {};
  if (room.game === 'quiz') {
    const key = pairKey(room), list = asked.get(key) ?? room.asked ?? [];
    if (room.state?.qs) list.push(...room.state.qs.map((q) => q.text));
    room.asked = [...new Set(list)].slice(-400);
    asked.set(key, room.asked);
    opts = { ...opts, avoid: room.asked };
  }
  room.state = games[room.game].init(opts);
  room.prev = null;
  room.lastMove = null;
  room.seq++;
  room.rematch = [false, false];
}

/** Server-driven games (the quiz clock) move on by themselves between moves. */
function arm(room) {
  clearTimeout(room.timer);
  const mod = games[room.game];
  if (!mod.nextTick || !room.state || room.state.winner != null || room.players.length < 2) return;
  const at = mod.nextTick(room.state);
  if (at == null) return;
  room.timer = setTimeout(() => {
    if (!room.state || room.state.winner != null) return;
    room.prev = room.state;
    room.state = mod.tick(structuredClone(room.state), Date.now());
    room.seq++;
    room.lastMove = null;
    finishIfOver(room);
    broadcast(room);
    arm(room);
  }, Math.max(0, at - Date.now()));
}

function forfeit(room, idx, msg) {
  if (!room.state || room.state.winner != null) return;
  room.prev = room.state;
  room.state = { ...room.state, winner: 1 - idx, msg, phase: 'done' };
  room.seq++;
  room.lastMove = { seq: room.seq, by: idx, move: { type: 'forfeit' } };
  clearTimeout(room.timer);
  finishIfOver(room);
  broadcast(room);
}

function finishIfOver(room) {
  const w = room.state.winner;
  if (w == null || room.players.length < 2) return;
  const [a, b] = room.players.map((p) => p.uid);
  if (w === 'done') records.sync(a, b, room.state.pack, room.state.score);
  else if (w === 0 || w === 1) { room.score[w]++; records.result(a, b, room.game, room.players[w].uid); }
  else records.result(a, b, room.game, null);
}

/** Tell everyone you've played (and anyone at a table with you) that you came or went. */
function announce(uid) {
  const msg = { id: uid, online: (online.get(uid) || 0) > 0, lastActive: users.get(uid)?.lastActive };
  for (const r of records.list(uid)) io.to('u:' + r.id).emit('presence', msg);
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.uid === uid)) room.players.forEach((p) => p.uid !== uid && io.to('u:' + p.uid).emit('presence', msg));
  }
}

const reply = (args) => args.find((f) => typeof f === 'function') ?? (() => {});

io.on('connection', (socket) => {
  let user = users.bySession(socket.handshake.auth?.session);
  const uid = () => user?.id;

  if (user) {
    socket.join('u:' + user.id);
    online.set(user.id, (online.get(user.id) || 0) + 1);
    users.touch(user.id);
    if (online.get(user.id) === 1) announce(user.id);
  }

  /* ---------- accounts ---------- */
  socket.on('signup', (data, ...rest) => {
    const cb = reply([data, ...rest]);
    try { cb(users.signup(data ?? {})); } catch (e) { cb({ error: e.message }); }
  });
  socket.on('login', (data, ...rest) => {
    const cb = reply([data, ...rest]);
    try { cb(users.login(data ?? {})); } catch (e) { cb({ error: e.message }); }
  });
  socket.on('logout', ({ session } = {}) => users.logout(session));

  /** Who I am, my main person (most recent opponent) and everyone I've played. */
  socket.on('me', (...args) => {
    const cb = reply(args);
    if (!user) return cb({ auth: false });
    const people = records.list(user.id).map((r) => ({ ...r, person: personOf(r.id) })).filter((r) => r.person.id);
    cb({ user: personOf(user.id), partner: people[0]?.person ?? null, people });
  });

  socket.on('profile', async (data, ...rest) => {
    const cb = reply([data, ...rest]);
    if (!user) return cb({ error: 'Please log in' });
    try {
      let out = users.update(user.id, data ?? {});
      if (data?.avatar) out = await users.setAvatar(user.id, data.avatar);
      if (data?.removeAvatar) out = await users.removeAvatar(user.id);
      user = users.get(user.id);
      for (const room of rooms.values()) if (room.players.some((p) => p.uid === user.id)) broadcast(room);
      cb({ user: out });
    } catch (e) { cb({ error: e.message }); }
  });

  // Everything below needs an account.
  const guard = (fn) => (...args) => {
    if (!user) return reply(args)({ error: 'Please log in', auth: false });
    fn(...args);
  };
  const seat = (code) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room) return {};
    return { room, idx: room.players.findIndex((p) => p.uid === uid()) };
  };

  /* ---------- rooms ---------- */
  socket.on('create', guard(({ game, options } = {}, cb) => {
    const mod = games[game];
    if (!mod) return cb?.({ error: 'Unknown game' });
    const opts = mod.validOptions ? mod.validOptions(options) : {};
    if (!opts) return cb?.({ error: 'That pack doesn’t exist' });
    const code = newCode();
    rooms.set(code, {
      code, game, options: opts,
      players: [{ uid: uid(), sid: socket.id, connected: true }],
      state: null, prev: null, seq: 0, lastMove: null,
      score: [0, 0], rematch: [false, false], touched: Date.now(),
    });
    // Answer-at-your-own-pace games start before the partner arrives.
    if (mod.meta.startAlone) startGame(rooms.get(code));
    saveRooms();
    cb?.({ code });
  }));

  // Lets an invite link show "Stephen wants to play Chess" before the guest takes a seat.
  socket.on('peek', ({ code } = {}, cb) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room) return cb?.({ error: 'That game room doesn’t exist (it may have expired).' });
    const idx = room.players.findIndex((p) => p.uid === uid());
    const pack = PACKS[room.options?.pack];
    const host = room.players[0] ? personOf(room.players[0].uid) : null;
    cb?.({
      game: room.game, host: host?.username ?? 'A friend', hostAvatar: host?.avatar ?? null,
      seated: idx >= 0, full: idx < 0 && room.players.length >= 2,
      pack: pack ? { title: pack.title, mode: MODES[pack.mode].name }
        : room.game === 'quiz' ? { title: room.options.cat === 'mixed' ? 'Mixed bag' : CATEGORIES[room.options.cat].name, mode: 'Quiz Duel', quiz: true, n: room.options.n ?? 10, secs: room.options.secs ?? 20 } : null,
      // Your own Between Us rounds: enough to show My turn / Their turn / Results.
      summary: idx >= 0 && room.game === 'between' && room.state ? {
        pack: room.state.pack, finished: room.state.winner != null, score: room.state.score,
        mine: room.state.progress[idx], theirs: room.state.progress[1 - idx], total: room.state.qs.length,
        partner: room.players[1 - idx] ? nameOf(room.players[1 - idx].uid) : null,
        partnerAvatar: room.players[1 - idx] ? personOf(room.players[1 - idx].uid).avatar : null,
      } : null,
    });
  });

  socket.on('join', guard(({ code } = {}, cb) => {
    const { room, idx } = seat(code);
    if (!room) return cb?.({ error: 'That game room doesn’t exist (it may have expired).' });
    if (idx >= 0) {
      Object.assign(room.players[idx], { sid: socket.id, connected: true, left: false });
      clearTimeout(room.players[idx].dropTimer);
      clearTimeout(room.players[idx].awayTimer);
    } else if (room.players.length < 2) {
      room.players.push({ uid: uid(), sid: socket.id, connected: true });
      if (room.players[0].uid !== uid()) records.meet(room.players[0].uid, uid());
      if (!room.state) { startGame(room); arm(room); }
      announce(uid());
    } else return cb?.({ error: 'This room already has two players.' });
    cb?.({ ok: true });
    broadcast(room);
  }));

  // Leaving the room on purpose (back button, another page). The other player is told straight away.
  socket.on('leave', guard(({ code } = {}) => {
    const { room, idx } = seat(code);
    if (!room || idx < 0) return;
    const p = room.players[idx];
    if (p.sid !== socket.id) return; // another device of theirs is still in the room
    Object.assign(p, { sid: null, connected: false, left: true, net: 'good' });
    clearTimeout(p.dropTimer);
    const live = room.state && room.state.winner == null && room.players.length === 2;
    if (live && games[room.game].meta.strict) return forfeit(room, idx, `${nameOf(p.uid)} left the quiz, so ${nameOf(room.players[1 - idx].uid)} wins.`);
    broadcast(room);
  }));

  socket.on('move', guard(({ code, move } = {}, cb) => {
    const { room, idx } = seat(code);
    if (!room || idx < 0) return cb?.({ error: 'You are not in this room' });
    if (!room.state) return cb?.({ error: 'Waiting for an opponent' });
    if (room.state.winner != null) return cb?.({ error: 'The game is over' });
    let next;
    try {
      if (move?.type === 'resign') {
        next = { ...room.state, winner: 1 - idx, msg: `${nameOf(uid())} resigned.` };
      } else if (move?.type === 'away' || move?.type === 'back') {
        // The quiz's anti-cheat: the app went to the background. Staying away too long loses; a reload is back in time.
        if (!games[room.game].meta.strict) return cb?.({ error: 'Nothing to do' });
        const p = room.players[idx];
        clearTimeout(p.awayTimer);
        if (move.type === 'away' && room.players.length === 2) {
          p.awayTimer = setTimeout(() => forfeit(room, idx, `${nameOf(p.uid)} left the quiz, so ${nameOf(room.players[1 - idx].uid)} wins.`), AWAY_MS);
        }
        return cb?.({ ok: true });
      } else if (move?.type === 'forfeit') {
        // The quiz's anti-cheat: leaving the app mid-question hands the match over.
        if (!games[room.game].meta.strict || room.players.length < 2) return cb?.({ error: 'Nothing to forfeit' });
        forfeit(room, idx, `${nameOf(uid())} left the quiz, so ${nameOf(room.players[1 - idx].uid)} wins.`);
        return cb?.({ ok: true });
      } else {
        next = games[room.game].move(structuredClone(room.state), idx, move ?? {}, { now: Date.now() });
      }
    } catch (err) {
      return cb?.({ error: err.message || 'Illegal move' });
    }
    room.prev = room.state;
    room.state = next;
    room.seq++;
    room.lastMove = { seq: room.seq, by: idx, move };
    finishIfOver(room);
    users.touch(uid());
    cb?.({ ok: true });
    broadcast(room);
    arm(room);
  }));

  socket.on('rematch', guard(({ code } = {}) => {
    const { room, idx } = seat(code);
    if (!room || idx < 0 || room.state?.winner == null) return;
    room.rematch[idx] = true;
    if (room.rematch.every(Boolean)) {
      // Swap seats so the other player goes first next round.
      room.players.reverse();
      room.score.reverse();
      startGame(room);
      arm(room);
    }
    broadcast(room);
  }));

  /* ---------- chat: one thread per couple, on every page ---------- */
  const okPartner = (to) => to && to !== uid() && users.get(to);
  socket.on('dm:history', (...args) => {
    const cb = reply(args), { to } = args[0] ?? {};
    if (!user || !okPartner(to)) return cb({ messages: [] });
    cb({ messages: threads[threadKey(uid(), to)] ?? [] });
  });
  socket.on('dm', guard(({ to, text, invite } = {}, cb) => {
    if (!okPartner(to)) return cb?.({ error: 'Nobody to message yet' });
    const msg = { id: randomUUID(), from: uid(), text: String(text || '').trim().slice(0, 500), at: Date.now() };
    // An invite card: a link to a game room, shown with Copy and Open buttons.
    if (invite?.code && rooms.has(String(invite.code).toUpperCase())) {
      const room = rooms.get(String(invite.code).toUpperCase());
      msg.invite = { code: room.code, game: games[room.game].meta.name };
    }
    if (!msg.text && !msg.invite) return cb?.({ error: 'Empty message' });
    const list = (threads[threadKey(uid(), to)] ??= []);
    list.push(msg);
    if (list.length > THREAD_MAX) list.splice(0, list.length - THREAD_MAX);
    store.save('threads', threads);
    for (const id of [uid(), to]) io.to('u:' + id).emit('dm', { ...msg, with: id === uid() ? to : uid() });
    users.touch(uid());
    cb?.({ ok: true });
  }));
  socket.on('dm:typing', guard(({ to, on } = {}) => {
    if (okPartner(to)) io.to('u:' + to).emit('dm:typing', { from: uid(), on: !!on });
  }));

  // Connection quality: clients time a round trip and report good / weak.
  socket.on('ping2', (cb) => cb?.(Date.now()));
  socket.on('net', ({ q } = {}) => {
    if (!user) return;
    const quality = q === 'weak' ? 'weak' : 'good';
    for (const room of rooms.values()) {
      const p = room.players.find((pl) => pl.uid === user.id);
      if (p && p.net !== quality) { p.net = quality; broadcast(room); }
    }
  });

  socket.on('records', (...args) => reply(args)(user ? records.list(user.id).map((r) => ({ ...r, person: personOf(r.id) })) : []));

  socket.on('disconnect', () => {
    for (const room of rooms.values()) {
      const p = room.players.find((pl) => pl.sid === socket.id);
      if (p) {
        p.connected = false;
        p.sid = null;
        p.net = 'good';
        broadcast(room);
        // In a live quiz, staying away (closing the app to look something up) loses the match.
        if (games[room.game].meta.strict && room.state && room.state.winner == null && room.players.length === 2) {
          const idx = room.players.indexOf(p);
          p.dropTimer = setTimeout(() => {
            if (!p.connected) forfeit(room, idx, `${nameOf(p.uid)} left the quiz for too long, so ${nameOf(room.players[1 - idx].uid)} wins.`);
          }, 10000);
        }
      }
    }
    if (user) {
      const n = (online.get(user.id) || 1) - 1;
      if (n <= 0) online.delete(user.id); else online.set(user.id, n);
      users.touch(user.id);
      if (n <= 0) announce(user.id);
    }
  });
});

// Drop rooms nobody has touched in a while: a month for Between Us (answered at your own pace), three days for the rest.
const DAY = 24 * 60 * 60 * 1000;
setInterval(() => {
  let dropped = false;
  for (const [code, room] of rooms) {
    const keep = room.game === 'between' ? 30 * DAY : 3 * DAY;
    if (room.touched < Date.now() - keep && room.players.every((p) => !p.connected)) { rooms.delete(code); dropped = true; }
  }
  if (dropped) saveRooms();
}, 10 * 60 * 1000).unref();

await loadRooms();
for (const room of rooms.values()) arm(room);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`LoveStep running on http://localhost:${PORT}`));
