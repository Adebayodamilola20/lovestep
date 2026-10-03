import { catalog, games } from '/shared/games/index.js';
import { Chat } from './chat.js';
import { tilt, haptic, reduced } from './fx.js';
import { celebrate } from './confetti.js';
import { LOGO, BRAND } from './brand.js';
import { showHub, showMode, showCollection, remember } from './between-pages.js';
import { MODES } from '/shared/packs.js';
import { showAuth, avatarHtml, seen, pickPhoto, GENDERS } from './auth.js';
import { showQuiz } from './quiz-page.js';

const app = document.getElementById('app');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

// Signed-in sessions live on this device; the account itself lives on the server.
let session = store.get('ls.session');
// LS_API is empty when this server also hosts the page, or the game server's address when the page is on Vercel.
const socket = io(window.LS_API || undefined, { auth: { session } });
let me = null; // { user, partner, people }

let current = null; // the room being shown
let homeCleanup = [];

const MARK = LOGO;

/* ---------- helpers ---------- */
let toastTimer;
function toast(text) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
const emit = (event, data) => new Promise((resolve) => socket.emit(event, data, (res) => resolve(res ?? {})));

function navigate(path) {
  history.pushState(null, '', path);
  route();
}
const SUBTITLES = [['', 'Off'], ['en', 'English'], ['fr', 'French'], ['es', 'Spanish'], ['pt', 'Portuguese'], ['ar', 'Arabic'], ['yo', 'Yoruba'], ['ig', 'Igbo'], ['ha', 'Hausa'], ['sw', 'Swahili']];

/* ---------- one chat for the two of you, on every page ---------- */
let chat = null;
function syncChat(partner = me?.partner) {
  if (!me?.user) return;
  chat ??= new Chat({ socket, meId: me.user.id, partner, copy: copyText, open: (code) => navigate('/r/' + code) });
  chat.setPartner(partner);
}

function route() {
  const m = location.pathname.match(/^\/r\/([A-Za-z0-9]{4,6})\/?$/);
  const play = location.pathname.match(/^\/play\/(\w+)\/?$/);
  const bu = location.pathname.match(/^\/between(?:\/(\w+))?\/?$/);
  const col = location.pathname.match(/^\/between\/c\/([\w-]+)\/?$/);
  if (col) { leaveRoom(); return showCollection({ app, MARK, store, emit, startGame, navigate, cleanup: homeCleanup, me }, col[1]); }
  if (m) return showRoom(m[1].toUpperCase());
  syncChat();
  if (location.pathname === '/me') { leaveRoom(); return showProfile(); }
  if (location.pathname === '/quiz') { leaveRoom(); return showQuiz({ app, MARK, startGame, cleanup: homeCleanup }); }
  if (bu) {
    leaveRoom();
    const ctx = { app, MARK, store, emit, startGame, navigate, cleanup: homeCleanup, me };
    return bu[1] ? showMode(ctx, bu[1]) : showHub(ctx);
  }
  if (play) history.replaceState(null, '', '/');
  showHome();
  if (play && games[play[1]]) startGame(play[1]);
}
window.addEventListener('popstate', route);
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (a && !e.metaKey && !e.ctrlKey) { e.preventDefault(); navigate(a.getAttribute('href')); }
});

async function startGame(id, options) {
  if (games[id]?.meta.closed) {
    toast(`${games[id].meta.name} is currently closed.`);
    return null;
  }
  const res = await emit('create', { game: id, options });
  if (res.error) { toast(res.error); return null; }
  navigate('/r/' + res.code);
  return res.code;
}

/* ---------- lobby ---------- */
const SPANS = { pool: 'span-2x2', whot: 'span-2x1', chess: 'span-2x1' };

/** A believable mid-game position for each lobby preview, played with the real rules. */
function sample(id) {
  const g = games[id];
  let s = g.init();
  const P = (p, m) => { s = g.move(structuredClone(s), p, m); };
  const sq = (n) => (8 - +n[1]) * 8 + n.charCodeAt(0) - 97;
  try {
    switch (id) {
      case 'chess': [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'], ['f1', 'c4'], ['g8', 'f6'], ['d2', 'd3']].forEach(([a, b], k) => P(k % 2, { from: sq(a), to: sq(b) })); break;
      case 'checkers': for (let k = 0; k < 6; k++) { const ms = g.legalMoves(s, s.turn); P(s.turn, ms[(k * 3) % ms.length]); } break;
      case 'connect4': [3, 3, 4, 2, 4, 5, 2, 4].forEach((col, k) => P(k % 2, { col })); break;
      case 'reversi': for (let k = 0; k < 6; k++) { const ms = g.legalMoves(s.board, s.turn); P(s.turn, { i: ms[k % ms.length] }); } break;
      case 'gomoku': [112, 113, 97, 127, 98, 96, 126, 82].forEach((i, k) => P(k % 2, { i })); break;
      case 'tictactoe': [4, 0, 2, 6, 3].forEach((i, k) => P(k % 2, { i })); break;
      case 'dots': [['h', 0, 0], ['v', 0, 0], ['h', 1, 0], ['v', 0, 1], ['h', 2, 2], ['v', 1, 3], ['h', 3, 1], ['v', 2, 2], ['h', 0, 3]].forEach(([kind, r, c]) => P(s.turn, { kind, r, c })); break;
      case 'mancala': for (let k = 0; k < 5; k++) { const p = s.turn; const pit = [0, 1, 2, 3, 4, 5].find((x) => s.pits[p * 7 + ((x + k) % 6)] > 0); P(p, { pit: (pit + k) % 6 }); } break;
      case 'rps': P(0, { type: 'lock', pick: 0 }); P(1, { type: 'lock', pick: 2 }); break;
      case 'darts': [[0, 103, 1], [12, 100, 1], [-40, 150, 1]].forEach(([x, y, v]) => P(0, { type: 'throw', x, y, v })); break;
      case 'battleship': {
        P(0, { type: 'place', ships: g.randomFleet() });
        P(1, { type: 'place', ships: g.randomFleet() });
        for (let k = 0; k < 18 && s.winner == null; k++) P(s.turn, { type: 'fire', i: (k * 37 + 11) % 100 });
        break;
      }
      default: break;
    }
  } catch { /* a preview is decoration; keep whatever position we reached */ }
  return g.view ? g.view(s, 0) : s;
}

function showHome() {
  leaveRoom();
  refreshMe().then(() => {
    const h = app.querySelector('#hero h1');
    if (h && me) h.outerHTML = heroNames(me.user, me.partner);
  });
  document.title = `${BRAND}: games for two`;
  const my = me?.user, partner = me?.partner;
  app.innerHTML = `
    <nav class="nav" aria-label="Main">
      <div class="brand-col">
        <a class="wordmark" href="/" data-link>${MARK}</a>
        ${partner ? `<span class="presence${partner.online ? ' on' : ''}" id="presence"><i></i>${esc(partner.username)} ${seen(partner)}</span>` : ''}
      </div>
      <div class="nav-actions">
        <form class="code-form" id="join" autocomplete="off">
          <label class="sr-only" for="code">Room code</label>
          <input class="field" id="code" name="code" maxlength="200" placeholder="Code" spellcheck="false" autocapitalize="characters">
          <button class="btn btn-icon" aria-label="Join room"><i class="ph ph-arrow-right"></i></button>
        </form>
        <a class="wins-chip" id="wins" href="/me" data-link aria-label="Your wins" hidden><i class="ph-fill ph-trophy"></i><b class="num">0</b></a>
        <a class="me-chip" href="/me" data-link aria-label="Your profile">${avatarHtml(my, 'sm')}</a>
      </div>
    </nav>
    <header class="marquee" id="hero">
      ${heroNames(my, partner)}
    </header>
    <main class="below">
      <div class="below-head">
        <h2>Pick a game. Send the link.</h2>
        <p>Your friend taps it and you're at the same table. Play live, or take turns whenever you get to it.</p>
      </div>
      <a class="bu-box" href="/between" data-link>
        <span class="bu-box-copy">
          <span class="bu-box-tag">New</span>
          <h3>Between Us</h3>
          <p>Answer the same questions apart, then see how in sync you are. Most Likely To, Would You Rather, Never Have I Ever and more.</p>
          <span class="btn btn-primary">Open Between Us<i class="ph ph-arrow-right"></i></span>
        </span>
        <span class="bu-box-art" aria-hidden="true">
          ${['nhie', 'wyr', 'likely'].map((id, k) => `<span class="stack-card" style="--k:${k};--tone:var(--tone-${MODES[id].tone});--tone-ink:var(--tone-${MODES[id].tone}-ink)"><b>${esc(MODES[id].short)}</b></span>`).join('')}
        </span>
      </a>
      <a class="qz-box" href="/quiz" data-link>
        <span class="qz-box-icon"><i class="ph-fill ph-lightning"></i></span>
        <span class="qz-box-copy"><h3>Quiz Duel</h3><p>Live trivia, same clock, no looking it up. Every right answer is a point.</p></span>
        <span class="go"><i class="ph ph-arrow-up-right"></i></span>
      </a>
      <a class="qz-box mv-box" href="/play/movie" data-link>
        <span class="qz-box-icon"><i class="ph-fill ph-popcorn"></i></span>
        <span class="qz-box-copy"><h3>Movie Night</h3><p>Pick a film and watch together. Pause, skip or rewind, and it happens on both phones.</p></span>
        <span class="go"><i class="ph ph-arrow-up-right"></i></span>
      </a>
      <div class="rack">
        ${catalog.map((g) => `
          <a class="tile ${SPANS[g.id] ?? ''}${g.closed ? ' is-closed' : ''}" href="${g.closed ? '#' : `/play/${g.id}`}" data-game="${g.id}"${g.closed ? ' aria-disabled="true"' : ''}>
            <span class="stagebox preview" aria-hidden="true"></span>
            <span class="meta"><span><h3>${esc(g.name)}</h3><p>${esc(g.blurb)}</p></span>${g.closed ? '<span class="closed-label">Closed</span>' : '<span class="go"><i class="ph ph-arrow-up-right"></i></span>'}</span>
          </a>`).join('')}
      </div>
    </main>
    <footer class="foot"><span>${LOGO}</span><span>Two players, one link.</span></footer>`;
  renderHeadToHead();

  // Accept a bare code or a whole invite link pasted from a message.
  const codeFrom = (text) => {
    const t = String(text || '').trim();
    const m = t.match(/\/r\/([A-Za-z0-9]{4,6})/) || t.match(/^([A-Za-z0-9]{4,6})$/);
    return m ? m[1].toUpperCase() : null;
  };
  const codeInput = app.querySelector('#code');
  codeInput.addEventListener('paste', (e) => {
    const code = codeFrom(e.clipboardData?.getData('text'));
    if (!code) return;
    e.preventDefault();
    codeInput.value = code;
    navigate('/r/' + code);
  });
  app.querySelector('#join').onsubmit = (e) => {
    e.preventDefault();
    const code = codeFrom(codeInput.value);
    if (code) navigate('/r/' + code);
    else toast('Paste the invite link or type the 5-letter code');
  };
  app.querySelectorAll('.tile').forEach((t) => {
    t.addEventListener('click', (e) => {
      e.preventDefault();
      if (t.getAttribute('aria-disabled') === 'true') return;
      haptic(8);
      startGame(t.dataset.game);
    });
    homeCleanup.push(tilt(t, { max: 5 }));
  });

  // Real boards, frozen mid-game, as previews. Built one at a time: each 3D preview renders once,
  // becomes a still picture and frees its GPU context before the next starts, so phones never
  // hold more than one of them at once.
  (async () => {
    for (const t of app.querySelectorAll('.tile')) {
      const id = t.dataset.game, box = t.querySelector('.stagebox');
      if (id === 'pool') continue;
      const mod = await import(`/render/${id}.js`);
      if (!box.isConnected) return;
      const host = document.createElement('div');
      box.append(host);
      const r = mod.mount(host, { send: async () => ({}), preview: true });
      r.update(sample(id), { you: 0, seq: 0, players: [{ name: 'You' }, { name: 'Friend' }], lastMove: null, prev: null });
      homeCleanup.push(() => r.destroy?.());
      // A 3D preview removes its canvas once it has frozen into a picture.
      for (let k = 0; k < 120 && host.querySelector('canvas'); k++) await new Promise((res) => requestAnimationFrame(res));
    }
  })();

  import('./pool3d.js').then(async ({ PoolTable }) => {
    const { init } = await import('/shared/games/pool.js');
    const hero = app.querySelector('#hero');
    if (!hero) return;
    const table = new PoolTable(hero, { mode: 'hero' });
    const rack = init().balls;
    table.setBalls(rack);
    const sway = (e) => {
      const r = hero.getBoundingClientRect();
      table.setSway(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2);
    };
    hero.addEventListener('pointermove', sway);
    const timer = reduced ? 0 : setTimeout(() => table.playShot(rack, 25, 0.25), 1300);

    const box = app.querySelector('.tile[data-game="pool"] .stagebox');
    const tile = new PoolTable(box);
    tile.setBalls(rack);
    homeCleanup.push(() => { clearTimeout(timer); table.destroy(); tile.destroy(); });
  }).catch(() => { /* no WebGL: the type still carries the hero */ });
}

/** Your total wins, as a trophy count beside your photo. The full head-to-head lives on the profile page. */
async function renderHeadToHead() {
  const list = await emit('records');
  const chip = app.querySelector('#wins');
  if (!chip || !Array.isArray(list)) return;
  const wins = list.reduce((n, r) => n + (r.you || 0), 0);
  chip.querySelector('b').textContent = wins;
  chip.setAttribute('aria-label', `You've won ${wins} game${wins === 1 ? '' : 's'}`);
  chip.title = list.map((r) => `${r.person?.username ?? 'Friend'}: ${r.you} : ${r.them}`).join('\n');
  chip.hidden = false;
}

function leaveHome() {
  homeCleanup.forEach((f) => f());
  homeCleanup = [];
}

/* ---------- room ---------- */
function leaveRoom() {
  leaveHome();
  if (!current) return;
  if (current.data) socket.emit('leave', { code: current.code });
  current.renderer?.destroy?.();
  clearTimeout(current.receiptTimer);
  current = null;
  renderNet();
}

async function showRoom(code) {
  if (current?.code === code) return;
  leaveRoom();
  current = { code, data: null, renderer: null };
  app.innerHTML = `<nav class="nav solid"><a class="wordmark" href="/" data-link>${MARK}</a></nav><div class="status"><span class="sub">Opening room ${esc(code)}</span></div>`;
  const closed = (msg) => {
    app.innerHTML = `<nav class="nav solid"><a class="wordmark" href="/" data-link>${MARK}</a></nav>
      <div class="error-card"><h2>That room is closed.</h2><p>${esc(msg)}</p><a class="btn btn-primary" href="/" data-link><i class="ph ph-arrow-left"></i>Back to the games</a></div>`;
    current = null;
  };
  const info = await emit('peek', { code });
  if (current?.code !== code) return;
  if (info.error) return closed(info.error);
  if (info.full) return closed('This table already has two players.');

  // Guests opening an invite see who's asking before they sit down.
  if (!info.seated) {
    const yes = await acceptInvite(info);
    if (current?.code !== code) return;
    if (!yes) { navigate('/'); return; }
  }
  const res = await emit('join', { code });
  if (current?.code !== code) return;
  if (res.error) return closed(res.error);
  current.joined = true;
}

function acceptInvite({ host, hostAvatar, game, pack }) {
  const g = pack?.quiz ? { name: `a ${pack.title} quiz`, blurb: `${pack.n} live questions, ${pack.secs} seconds each, the same clock for both of you. Stay on this screen until it ends.` }
    : pack ? { name: pack.mode, blurb: `${pack.title}. Answer on your own, then see how many you matched.` } : games[game]?.meta;
  const dlg = document.getElementById('invite-dialog');
  dlg.querySelector('.inv-av').innerHTML = avatarHtml({ username: host, avatar: hostAvatar }, 'lg');
  dlg.querySelector('.inv-title').textContent = `${host} wants to play ${g?.name ?? 'a game'}`;
  dlg.querySelector('.inv-sub').textContent = g?.blurb ?? '';
  dlg.querySelector('.inv-go span').textContent = "Let's play";
  dlg.showModal();
  dlg.querySelector('.inv-go').focus();
  return new Promise((resolve) => {
    dlg.addEventListener('close', function onClose() {
      dlg.removeEventListener('close', onClose);
      resolve(dlg.returnValue === 'ok');
    });
  });
}

socket.on('connect', () => {
  if (current?.joined) emit('join', { code: current.code });
});

socket.on('room', async (data) => {
  if (!current || data.code !== current.code) return;
  const room = current;
  const first = !room.data;
  room.data = data;
  if (first) {
    buildRoom(data);
    if (data.game === 'between' && data.options?.pack) remember(store, data.code, data.options.pack);
  }
  // In a game, the chat is with whoever is across the table (or your partner, before they join).
  const across = data.players[1 - data.you];
  syncChat(across ? { ...across, inRoom: across.connected } : me?.partner);
  renderVersus(data);
  renderNet();
  app.querySelector('.room')?.classList.toggle('is-waiting', !data.state);
  // Once your partner is in, there's nobody left to invite: the link goes away on both phones.
  const chip = app.querySelector('#copycode');
  if (chip) chip.hidden = data.players.length >= 2;
  if (!data.state) return renderInvite(data);

  if (!room.renderer) {
    room.mounting ??= import(`/render/${data.game}.js`).then((mod) => {
      if (current !== room) return;
      const stage = app.querySelector('#stage');
      stage.innerHTML = '';
      room.renderer = mod.mount(stage, {
        send: async (move) => {
          const r = await emit('move', { code: room.code, move });
          if (r.error) toast(r.error);
          return r;
        },
        copyLink: (btn) => copyLink(room.code, btn),
        partnerName: () => me?.partner?.username ?? null,
        prefs: () => ({ subs: me?.user?.subs ?? '' }),
        rematch: () => socket.emit('rematch', { code: room.code }),
      });
    });
    await room.mounting;
    if (current !== room || room.data !== data) return;
  }
  const meta = { you: data.you, seq: data.seq, lastMove: data.lastMove, prev: data.prev, players: data.players, rematch: data.rematch, record: data.record, now: data.now };
  // Animated games (pool shots, mancala sowing) play out before the result is announced.
  const lm = data.lastMove;
  if ((data.game === 'pool' || data.game === 'mancala') && data.prev && lm?.seq === data.seq && lm.move?.type !== 'resign' && room.shown !== data.seq) {
    const who = lm.by === data.you ? 'You' : data.players[lm.by]?.name ?? 'They';
    app.querySelector('#status').innerHTML = `<strong>${esc(data.game === 'pool' ? `${who === 'You' ? 'Your' : who + "'s"} shot` : `${who === 'You' ? 'Your' : who + "'s"} move`)}</strong><span class="sub">${data.game === 'pool' ? 'Balls rolling' : 'Sowing'}</span>`;
  }
  room.shown = data.seq;
  await room.renderer.update(data.state, meta);
  if (current === room && room.data === data) renderStatus(data);
});

function buildRoom(data) {
  const g = games[data.game].meta;
  document.title = `${g.name} · ${BRAND}`;
  app.innerHTML = `
    <div class="room${g.immersive ? ' immersive' : ''}">
      <div class="room-bar">
        <div class="title">
          <a class="btn btn-quiet btn-icon" href="/" data-link aria-label="Back to games"><i class="ph ph-arrow-left"></i></a>
          <h1>${esc(g.name)}</h1>
        </div>
        <button class="code-chip" id="copycode" type="button" aria-label="Copy invite link"><i class="ph ph-link-simple"></i>${esc(data.code)}</button>
      </div>
      <div class="versus" id="versus"></div>
      <div class="status" id="status" aria-live="polite"></div>
      <main class="stage" id="stage"></main>
      <div class="dock" id="dock"></div>
    </div>`;
  app.querySelector('#copycode').onclick = (e) => copyLink(data.code, e.currentTarget);
}

/** Clipboard API needs https; plain-http addresses (and iOS) need a selected, editable element. */
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(() => true, () => legacyCopy(text));
  return Promise.resolve(legacyCopy(text));
}
function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.contentEditable = 'true';
  ta.readOnly = false;
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px';
  // An open sheet makes the rest of the page inert, and inert text can't be selected or copied.
  (document.querySelector('dialog[open]') ?? document.body).append(ta);
  ta.focus({ preventScroll: true });
  const range = document.createRange();
  range.selectNodeContents(ta);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  sel.removeAllRanges();
  return ok;
}

/** Copy straight away, and always offer WhatsApp / Messages too, so sending never depends on the clipboard. */
async function copyLink(code, button) {
  const url = `${location.origin}/r/${code}`;
  const g = current?.data ? games[current.data.game].meta.name : 'a game';
  const text = `${me?.user?.username ?? 'I'} wants to play ${g} with you on ${BRAND}: ${url}`;
  const ok = await copyText(url);
  if (ok) {
    haptic(10);
    if (button) {
      const label = button.innerHTML;
      button.innerHTML = '<i class="ph ph-check"></i>Copied';
      button.classList.add('copied');
      clearTimeout(button._t);
      button._t = setTimeout(() => { button.innerHTML = label; button.classList.remove('copied'); }, 1800);
    }
  }
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet share-sheet';
  dlg.innerHTML = `
    <form method="dialog" class="sheet-head"><h2>Send the link</h2><button class="btn btn-quiet btn-icon" aria-label="Close"><i class="ph ph-x"></i></button></form>
    <div class="sheet-body">
      <p class="share-state${ok ? ' ok' : ''}">${ok ? '<i class="ph-fill ph-check-circle"></i>Copied. Paste it anywhere.' : 'Tap a button below to send it.'}</p>
      <input class="field share-url" readonly value="${esc(url)}" aria-label="Invite link">
      <div class="share-grid">
        ${chat?.them ? `<button class="btn btn-primary share-chat" type="button" data-chat><i class="ph-fill ph-chat-teardrop-text"></i>Send in our chat to ${esc(chat.them.name)}</button>` : ''}
        <a class="btn ${chat?.them ? '' : 'btn-primary'}" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener"><i class="ph ph-whatsapp-logo"></i>WhatsApp</a>
        <a class="btn" href="sms:&body=${encodeURIComponent(text)}"><i class="ph ph-chat-text"></i>Messages</a>
        <button class="btn" type="button" data-copy><i class="ph ph-copy"></i>Copy again</button>
        ${navigator.share ? '<button class="btn" type="button" data-share><i class="ph ph-share-fat"></i>More</button>' : ''}
      </div>
    </div>`;
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  const input = dlg.querySelector('.share-url');
  input.addEventListener('focus', () => input.setSelectionRange(0, url.length));
  dlg.querySelector('[data-chat]')?.addEventListener('click', () => {
    dlg.close();
    haptic(10);
    chat.sendInvite(code, `Come play ${g} with me`);
  });
  dlg.querySelector('[data-copy]').addEventListener('click', async (e) => {
    const btn = e.currentTarget, again = await copyText(url);
    const state = dlg.querySelector('.share-state');
    state.className = `share-state${again ? ' ok' : ''}`;
    state.innerHTML = again ? '<i class="ph-fill ph-check-circle"></i>Copied again. Paste it anywhere.' : 'Press and hold the link above, then Copy.';
    if (again) {
      haptic(10);
      state.animate([{ transform: 'scale(0.96)' }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
      btn.classList.add('copied');
      btn.innerHTML = '<i class="ph ph-check"></i>Copied';
      clearTimeout(btn._t);
      btn._t = setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = '<i class="ph ph-copy"></i>Copy again'; }, 1800);
    } else { input.focus(); input.select(); }
  });
  dlg.querySelector('[data-share]')?.addEventListener('click', () => navigator.share({ title: `Play ${g} with me`, text, url }).catch(() => {}));
  dlg.showModal();
}

function renderVersus(data) {
  const s = data.state, me = data.you, them = 1 - me;
  const seat = (i, side) => {
    const p = data.players[i];
    const col = i === me ? 'var(--color-you)' : 'var(--color-them)';
    if (!p) return `<div class="seat ${side} away" style="--pc:var(--color-paper-4)"><span class="av">?</span><span class="who"><b>Waiting</b><small>Invite someone</small></span></div>`;
    return `<div class="seat ${side}${p.connected ? '' : ' away'}" style="--pc:${col}">
      <span class="av">${avatarHtml(p)}</span>
      <span class="who"><b>${esc(p.name)}</b><small>${p.connected ? (i === me ? 'You' : 'In the room') : seen({ lastActive: p.lastActive })}</small></span></div>`;
  };
  const live = s && s.winner == null && s.phase !== 'setup';
  const bar = !live ? 'off' : s.turn === me ? '' : 'them';
  const rec = data.record;
  const alltime = rec && rec.you + rec.them + rec.draws > 0 ? `<small class="alltime">All time ${rec.you}:${rec.them}</small>` : '';
  app.querySelector('#versus').innerHTML = `${seat(me, 'left')}<span class="score num" aria-label="Score this session">${data.score[me]}:${data.score[them]}${alltime}</span>${seat(them, 'right')}<span class="turnbar ${bar}"></span>`;
}

function renderInvite(data) {
  const url = `${location.origin}/r/${data.code}`;
  const g = games[data.game].meta;
  app.querySelector('#status').innerHTML = '';
  app.querySelector('#dock').innerHTML = '';
  app.querySelector('#stage').innerHTML = `
    <div class="invite">
      <h2>Send this to a friend</h2>
      <p>The game starts the moment they open it.</p>
      <div class="bigcode" aria-label="Room code">${esc(data.code)}</div>
      <div class="link"><code>${esc(url)}</code><button class="btn" id="copy" type="button"><i class="ph ph-copy"></i>Copy</button></div>
      <div class="row">
        <a class="btn btn-primary" href="https://wa.me/?text=${encodeURIComponent(`${me?.user?.username ?? 'I'} wants to play ${g.name} with you: ${url}`)}" target="_blank" rel="noopener"><i class="ph ph-whatsapp-logo"></i>WhatsApp</a>
        <a class="btn" href="sms:&body=${encodeURIComponent(`Play ${g.name} with me: ${url}`)}"><i class="ph ph-chat-text"></i>Text it</a>
      </div>
      <span class="waiting"><span class="dots"><i></i><i></i><i></i></span>Waiting for them to join</span>
    </div>`;
  app.querySelector('#copy').onclick = (e) => copyLink(data.code, e.currentTarget);
}

function flash(text, icon) {
  if (reduced) return;
  const stage = app.querySelector('#stage');
  const f = document.createElement('div');
  f.className = 'flash';
  f.innerHTML = `<i class="ph-fill ${icon}"></i>${esc(text)}`;
  stage.append(f);
  setTimeout(() => f.remove(), 1400);
}

function renderStatus(data) {
  const room = current;
  if (games[data.game].meta.immersive) return;
  const s = data.state, me = data.you;
  const opp = data.players[1 - me];
  const oppName = opp?.name ?? 'Your friend';
  const custom = games[data.game].status?.(s, me);
  const el = app.querySelector('#status');
  // A game can opt out of the status line ('') when its own table already says it.
  if (custom === '' && s.winner == null) { el.innerHTML = ''; return; }
  const lm = data.lastMove;
  const freshMove = lm && lm.seq === data.seq && room.flashed !== data.seq;
  let title, sub = esc(s.msg ?? ''), cls = '';

  if (s.winner === 'draw') title = 'Draw';
  else if (s.winner != null) {
    title = s.winner === me ? 'You win' : `${oppName} wins`;
    cls = s.winner === me ? 'win' : '';
    if (room.celebrated !== data.seq) {
      room.celebrated = data.seq;
      if (s.winner === me) { celebrate(); winCard(`You win`, s.msg); }
    }
  }
  else if (custom) title = custom;
  else if (s.turn === me) {
    title = 'Your move';
    if (!sub && lm?.by === 1 - me) sub = `${esc(oppName)} played`;
  } else {
    title = `${oppName}'s move`;
    if (lm?.by === me) {
      // iMessage-style receipt: Sent, then Delivered once we know they're here.
      const state = room.receiptSeq === data.seq ? room.receipt : 'sent';
      sub = receipt(state, oppName, opp?.connected) + (s.msg ? ` <span>${esc(s.msg)}</span>` : '');
      if (room.receiptSeq !== data.seq) {
        room.receiptSeq = data.seq;
        room.receipt = 'sent';
        clearTimeout(room.receiptTimer);
        room.receiptTimer = setTimeout(() => {
          if (current !== room || room.data?.seq !== data.seq) return;
          room.receipt = 'delivered';
          renderStatus(room.data);
        }, 650);
      }
    } else sub = sub || `<span class="waiting"><span class="dots"><i></i><i></i><i></i></span>${esc(oppName)} is thinking</span>`;
  }
  el.className = 'status ' + cls;
  el.innerHTML = `<strong>${esc(title)}</strong><span class="sub">${sub}</span>`;

  if (freshMove && s.winner == null) {
    room.flashed = data.seq;
    if (lm.by === me && s.turn !== me) flash('Sent', 'ph-paper-plane-tilt');
    else if (lm.by !== me && s.turn === me && lm.move?.type !== 'place') { flash('Your move', 'ph-hand-tap'); haptic(20); }
  }
  renderDock(data);
  const myTurn = s.winner == null && s.turn === me && !custom;
  document.title = `${myTurn ? '(Your move) ' : ''}${games[data.game].meta.name} · ${BRAND}`;
}

function winCard(title, msg) {
  if (reduced) return;
  const stage = app.querySelector('#stage');
  const c = document.createElement('div');
  c.className = 'wincard';
  c.innerHTML = `<i class="ph-fill ph-trophy"></i><strong>${esc(title)}</strong>${msg ? `<span>${esc(msg)}</span>` : ''}`;
  stage.append(c);
  setTimeout(() => c.remove(), 2600);
}

function receipt(state, name, connected) {
  if (state === 'sent') return '<span class="receipt enter"><i class="ph ph-check"></i>Sent</span>';
  return connected
    ? `<span class="receipt enter"><i class="ph ph-checks"></i>Delivered</span> <span class="waiting"><span class="dots"><i></i><i></i><i></i></span>${esc(name)} is thinking</span>`
    : `<span class="receipt enter"><i class="ph ph-check"></i>Sent</span> <span class="waiting">${esc(name)} will see it when they're back</span>`;
}

function renderDock(data) {
  const s = data.state, me = data.you;
  const dock = app.querySelector('#dock');
  const opp = data.players[1 - me]?.name ?? 'your friend';
  if (s.winner != null) {
    const mine = data.rematch[me], theirs = data.rematch[1 - me];
    dock.innerHTML = `<button class="btn btn-primary" id="rematch" type="button" ${mine ? 'disabled' : ''}><i class="ph ph-arrow-counter-clockwise"></i>${mine ? `Waiting for ${esc(opp)}` : theirs ? 'Accept rematch' : 'Rematch'}</button>
      <a class="btn" href="/" data-link>New game</a>`;
    dock.querySelector('#rematch').onclick = () => socket.emit('rematch', { code: data.code });
    return;
  }
  if (dock.querySelector('#resign')) return;
  dock.innerHTML = `<button class="btn btn-quiet hold" id="resign" type="button" aria-label="Hold to resign"><span class="fill"></span><i class="ph ph-flag"></i><span>Hold to resign</span></button>`;
  const b = dock.querySelector('#resign');
  let t = 0;
  const start = (e) => {
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    if (e.type === 'keydown') { e.preventDefault(); if (e.repeat) return; }
    b.classList.add('holding');
    t = setTimeout(() => { b.classList.remove('holding'); haptic(40); emit('move', { code: data.code, move: { type: 'resign' } }); }, 1200);
  };
  const cancel = () => { clearTimeout(t); b.classList.remove('holding'); };
  b.addEventListener('pointerdown', start);
  b.addEventListener('keydown', start);
  ['pointerup', 'pointerleave', 'pointercancel', 'keyup', 'blur'].forEach((ev) => b.addEventListener(ev, cancel));
}

/* ---------- connection quality ---------- */
// Offline: our socket is down. Weak: round trips are slow or timing out.
const net = { q: navigator.onLine === false ? 'offline' : 'good', misses: 0, slow: 0, reported: 'good' };

function setNet(q) {
  if (net.q === q) return;
  net.q = q;
  window.dispatchEvent(new CustomEvent('ls:net', { detail: q })); // Movie Night shows reconnecting / catching up
  if (q !== 'offline' && net.reported !== q) { net.reported = q; socket.emit('net', { q }); }
  renderNet();
}

setInterval(() => {
  if (!socket.connected) return;
  const t0 = performance.now();
  socket.timeout(3500).emit('ping2', (err) => {
    const rtt = performance.now() - t0;
    if (err) { net.misses++; net.slow = 0; } else { net.misses = 0; net.slow = rtt > 900 ? net.slow + 1 : 0; }
    // Two missed checks in a row (~8s): treat it as offline even if the phone thinks it's connected.
    setNet(net.misses >= 2 ? 'offline' : net.misses >= 1 || net.slow >= 2 ? 'weak' : 'good');
  });
}, 4000);
// Brief blips (a server restart, a tunnel) reconnect in under a second; only warn if it lasts.
let dropTimer = 0;
socket.on('disconnect', () => { clearTimeout(dropTimer); dropTimer = setTimeout(() => { if (!socket.connected) setNet('offline'); }, 1500); });
socket.on('connect', () => { clearTimeout(dropTimer); net.misses = 0; net.slow = 0; net.reported = 'good'; setNet('good'); });
window.addEventListener('offline', () => setNet('offline'));
window.addEventListener('online', () => { if (socket.connected) setNet('good'); });

function renderNet() {
  let bar = document.getElementById('netbar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'netbar';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'assertive');
    document.body.append(bar);
  }
  const opp = current?.data?.players?.[1 - current.data.you];
  const inGame = !!current?.data?.state;
  let html = '', kind = '';
  const live = inGame && current.data.state.winner == null && current.data.game !== 'between';
  if (live && opp?.left) {
    html = `<i class="ph ph-sign-out"></i><span><b>${esc(opp.name)} left ${current.data.game === 'movie' ? 'Movie Night' : 'the game'}</b><small>They can come back with the same link.</small></span><button class="btn btn-quiet" type="button" data-home>Leave too</button>`;
    kind = 'bad';
  } else if (net.q === 'offline') {
    html = '<span class="spin" aria-hidden="true"></span><span><b>Waiting for connection</b><small>Your network dropped. Hold on, we are reconnecting.</small></span>';
    kind = 'bad';
  } else if (inGame && opp && !opp.connected) {
    html = `<i class="ph ph-wifi-slash"></i><span><b>${esc(opp.name)}'s connection is bad</b><small>Wait please. They'll be back in a moment.</small></span>`;
    kind = 'warn';
  } else if (net.q === 'weak') {
    html = '<i class="ph ph-wifi-low"></i><span><b>Your connection is weak</b><small>Hang on, things may be slow.</small></span>';
    kind = 'warn';
  } else if (inGame && opp?.net === 'weak') {
    html = `<i class="ph ph-wifi-low"></i><span><b>${esc(opp.name)}'s connection is weak</b><small>Their moves may take a moment.</small></span>`;
    kind = 'warn';
  }
  bar.className = html ? `on ${kind}` : '';
  if (html) bar.innerHTML = html;
  bar.querySelector('[data-home]')?.addEventListener('click', () => navigate('/'));
  // Say so when they come back.
  const gone = !!(live && opp?.left);
  if (current) {
    if (current.oppLeft && !gone && opp?.connected) { toast(`${opp.name} is back`); haptic([10, 40, 10]); }
    if (gone && !current.oppLeft) haptic([30, 60, 30]);
    current.oppLeft = gone;
  }
  document.body.classList.toggle('net-offline', net.q === 'offline');
}

/* ---------- accounts ---------- */
function heroNames(my, partner) {
  const a = my?.username ?? 'You', b = partner?.username;
  // Shrink long names so they still sit on one line each.
  const fit = (t) => `font-size:min(var(--text-display), calc(96vw / ${Math.max(4, t.length) * 0.62}))`;
  return b
    ? `<h1><span class="h-me" style="${fit(a)}">${esc(a)}</span><span class="h-amp" style="${fit('& ' + b)}">&amp; ${esc(b)}</span></h1>`
    : `<h1><span class="h-me" style="${fit('Hi,')}">Hi,</span><span class="h-amp" style="${fit(a + '.')}">${esc(a)}.</span></h1>`;
}

async function refreshMe() {
  const r = await emit('me');
  if (r.user) me = r;
  return r;
}

socket.on('presence', ({ id, online, lastActive }) => {
  if (!me) return;
  for (const p of [me.partner, ...me.people.map((x) => x.person)]) if (p?.id === id) Object.assign(p, { online, lastActive });
  if (chat?.them?.id === id) { Object.assign(chat.them, { online, lastActive }); chat.renderTyping(); }
  const el = document.getElementById('presence');
  if (el && me.partner?.id === id) {
    el.className = `presence${online ? ' on' : ''}`;
    el.innerHTML = `<i></i>${esc(me.partner.username)} ${seen(me.partner)}`;
  }
});
// Keep "was here 5m ago" honest without a reload.
setInterval(() => {
  const el = document.getElementById('presence');
  if (el && me?.partner) el.innerHTML = `<i></i>${esc(me.partner.username)} ${seen(me.partner)}`;
}, 30000);

function showProfile() {
  const my = me.user, partner = me.partner;
  document.title = `Us · ${BRAND}`;
  const rec = me.people[0];
  app.innerHTML = `
    <main class="us">
      <header class="us-top">
        <a class="btn btn-quiet btn-icon round" href="/" data-link aria-label="Back"><i class="ph ph-caret-left"></i></a>
        <h1>Us <svg class="us-heart" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 28.5C6.4 21.6 2 15.9 2 10.6 2 6.9 4.9 4 8.6 4c3 0 5.4 1.7 7.4 4.4C18 5.7 20.4 4 23.4 4 27.1 4 30 6.9 30 10.6c0 5.3-4.4 11-14 17.9z"/></svg></h1>
        <button class="btn btn-icon round light" id="settings" type="button" aria-label="Settings"><i class="ph-fill ph-gear"></i></button>
      </header>
      <div class="us-pair">
        <span class="us-av mine">${avatarHtml(my, 'xl')}<button class="cam" id="photo" type="button" aria-label="Change your photo"><i class="ph-fill ph-camera"></i></button></span>
        ${partner ? `<span class="us-av theirs">${avatarHtml(partner, 'xl')}<span class="dot${partner.online ? ' on' : ''}" title="${esc(seen(partner))}"></span></span>` : `<a class="us-av empty" href="/" data-link aria-label="Play someone to pair up"><i class="ph ph-plus"></i></a>`}
      </div>
      <p class="us-names">${esc(my.username)}${partner ? ` <span>&amp;</span> ${esc(partner.username)}` : ''}</p>
      ${partner ? `<p class="us-seen">${esc(partner.username)} ${esc(seen(partner))}</p>` : '<p class="us-seen">Play a game with someone and they show up here.</p>'}
      ${rec ? `<section class="us-stats">
        <div><b class="num">${rec.you}</b><span>Your wins</span></div>
        <div><b class="num">${rec.them}</b><span>${esc(partner.username)}'s wins</span></div>
        <div><b class="num">${rec.sync != null ? rec.sync + '%' : '-'}</b><span>In sync</span></div>
      </section>` : ''}
      ${me.people.length > 1 ? `<section class="h2h"><h2>Everyone you've played</h2><ul>${me.people.map((r) => `<li>${avatarHtml(r.person, 'md')}<span class="who"><b>${esc(r.person.username)}</b><small>${esc(seen(r.person))}</small></span><span class="tally num"><b>${r.you}</b><i>:</i><b>${r.them}</b></span></li>`).join('')}</ul></section>` : ''}
    </main>`;
  app.querySelector('#photo').addEventListener('click', async () => {
    const photo = await pickPhoto();
    if (!photo) return;
    const r = await emit('profile', { avatar: photo });
    if (r.error) return toast(r.error);
    me.user = { ...me.user, ...r.user };
    showProfile();
  });
  app.querySelector('#settings').addEventListener('click', openSettings);
}

function openSettings() {
  const my = me.user;
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet';
  dlg.innerHTML = `
    <form method="dialog" class="sheet-head"><h2>Your account</h2><button class="btn btn-quiet btn-icon" aria-label="Close"><i class="ph ph-x"></i></button></form>
    <form class="sheet-body tool-form" id="acct">
      <div><label class="label" for="st-name">Username</label><input class="field" id="st-name" name="username" value="${esc(my.username)}" maxlength="20" autocapitalize="off"></div>
      <fieldset class="gender"><legend class="label">Gender</legend><div class="chips">${GENDERS.map(([v, l]) => `<button type="button" class="chip-g${my.gender === v ? ' on' : ''}" data-g="${v}">${l}</button>`).join('')}</div></fieldset>
      <div><label class="label" for="st-subs">Movie subtitles</label>
        <select class="field" id="st-subs">${SUBTITLES.map(([v, l]) => `<option value="${v}"${(my.subs ?? '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <small class="hint">Used in Movie Night when the film has captions. You can also switch them with the CC button while watching.</small></div>
      <p class="auth-err" role="alert"></p>
      <button class="btn btn-primary">Save</button>
      ${my.avatar ? '<button class="btn btn-quiet" type="button" id="rmphoto">Remove photo</button>' : ''}
      <button class="btn btn-quiet danger" type="button" id="logout"><i class="ph ph-sign-out"></i>Log out</button>
    </form>`;
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  let gender = my.gender;
  dlg.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => {
    gender = b.dataset.g;
    dlg.querySelectorAll('[data-g]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  dlg.querySelector('#acct').addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = await emit('profile', { username: dlg.querySelector('#st-name').value.trim(), gender, subs: dlg.querySelector('#st-subs').value });
    if (r.error) { dlg.querySelector('.auth-err').textContent = r.error; return; }
    me.user = { ...me.user, ...r.user };
    dlg.close();
    showProfile();
  });
  dlg.querySelector('#rmphoto')?.addEventListener('click', async () => {
    const r = await emit('profile', { removeAvatar: true });
    if (!r.error) { me.user = { ...me.user, ...r.user }; dlg.close(); showProfile(); }
  });
  dlg.querySelector('#logout').addEventListener('click', () => {
    socket.emit('logout', { session });
    chat?.destroy();
    try { localStorage.removeItem('ls.session'); } catch { /* private mode */ }
    location.href = '/';
  });
  dlg.showModal();
}

async function boot() {
  if (session) {
    const r = await refreshMe();
    if (r.user) return route();
  }
  // Signed out. If they came from an invite, show who's asking on the welcome screen.
  const m = location.pathname.match(/^\/r\/([A-Za-z0-9]{4,6})/);
  let invite = null;
  if (m) { const info = await emit('peek', { code: m[1].toUpperCase() }); if (!info.error) invite = info; }
  const res = await showAuth(app, { emit, LOGO: MARK, invite });
  session = res.session;
  store.set('ls.session', session);
  socket.auth = { session };
  socket.disconnect().connect();
  await new Promise((r) => (socket.connected ? r() : socket.once('connect', r)));
  if (res.photo) await emit('profile', { avatar: res.photo });
  await refreshMe();
  route();
}

boot();
