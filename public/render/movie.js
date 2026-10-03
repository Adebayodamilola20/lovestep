import { film as filmById, youtubeId } from '/shared/games/movie.js';
import { haptic } from '/js/fx.js';
import { avatarHtml } from '/js/auth.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clock = (t) => {
  t = Math.max(0, Math.floor(t || 0));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(s).padStart(2, '0')}`;
};
// YouTube titles shout and repeat themselves; keep the film's name and the cast.
function tidy(t) {
  let out = String(t || '').replace(/\s*[|\-–:]*\s*(latest\s+)?(nigerian|nollywood|yoruba|ghanaian|african)\s+movies?\b.*$/i, '')
    .replace(/\s*[({\[]?\s*(full|new|latest)\s+(nollywood\s+)?movie\s*[)}\]]?/ig, ' ').replace(/\s*[-–|:]\s*[-–|:]\s*/g, ' - ').replace(/\s{2,}/g, ' ').trim().replace(/[\s\-|–:,]+$/, '');
  out = out.replace(/[{}\[\]]/g, '');
  if ((out.match(/\(/g) || []).length !== (out.match(/\)/g) || []).length) out = out.replace(/[()]/g, '');
  out = out.replace(/\s{2,}/g, ' ').trim();
  if (!out) out = String(t || '');
  // ALL CAPS -> Title Case, so it reads like a film title.
  if (out.replace(/[^A-Za-z]/g, '').length > 4 && out === out.toUpperCase()) out = out.toLowerCase().replace(/(^|[\s(\-/,])([a-z])/g, (m, p, c) => p + c.toUpperCase());
  return out;
}
function ago(iso) {
  const d = (Date.now() - Date.parse(iso)) / 86400000;
  if (!(d >= 0)) return '';
  return d < 1 ? 'today' : d < 2 ? 'yesterday' : d < 30 ? `${Math.floor(d)} days ago` : d < 365 ? `${Math.floor(d / 30)} mo ago` : `${Math.floor(d / 365)} yr ago`;
}
const DRIFT = 1.2; // seconds out of step before we quietly jump back in line

/** The YouTube player API, loaded once, only when someone picks a YouTube link. */
let ytReady = null;
function loadYouTube() {
  ytReady ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.append(s);
  });
  return ytReady;
}

export function mount(el, ctx) {
  el.innerHTML = '<div class="mv"></div>';
  const root = el.firstElementChild;
  let s = null, meta = null, offset = 0, player = null, shownKey = null, applying = 0, timer = 0, needsTap = false;

  root.addEventListener('click', (e) => onPick(e)); // film cards, bound once for every studio redraw
  const me = () => meta.you;
  const isHost = () => me() === 0;
  const partner = () => meta.players[1 - me()];
  const serverNow = () => Date.now() + offset;
  // Where the film should be right now, for both of you.
  const expected = () => s.t + (s.playing ? (serverNow() - s.at) / 1000 : 0);

  /* ---------- the studio: full films from YouTube, newest first ---------- */
  const api = (path) => fetch((window.LS_API || '') + path).then((r) => r.json());
  let shelvesCache = null;

  function studio() {
    const host = isHost();
    root.innerHTML = `
      ${top()}
      <section class="mv-studio">
        <header class="mv-head">
          <h2>${host ? 'Pick tonight’s film' : `${esc(meta.players[0]?.name ?? 'Your partner')} is picking a film…`}</h2>
          <p>${host ? 'Movies, reality shows, music, anything on YouTube. When you press play it plays on both phones, and either of you can pause or skip.' : 'It starts on your screen the moment they pick. Either of you can pause or skip.'}</p>
        </header>
        <form class="mv-search" role="search">
          <i class="ph ph-magnifying-glass"></i>
          <input class="field" id="mv-q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Search anything on YouTube">
          <button class="btn btn-primary" type="submit">Search</button>
        </form>
        <div class="mv-results" aria-live="polite"></div>
        <div class="mv-shelves"><p class="mv-loading"><span class="spin"></span>Finding the newest films…</p></div>
        ${host ? `
          <form class="mv-yt">
            <label for="mv-yt-url"><i class="ph-fill ph-youtube-logo"></i>Have a link? Paste any YouTube video</label>
            <div><input class="field" id="mv-yt-url" inputmode="url" autocomplete="off" placeholder="https://youtu.be/…"><button class="btn" type="submit">Watch</button></div>
            <p class="mv-err" role="alert"></p>
          </form>` : ''}
        <p class="mv-note">Everything plays from YouTube. A few videos are set by their owners to play only on YouTube itself.</p>
      </section>`;
    bindTop();
    const shelvesEl = root.querySelector('.mv-shelves'), resultsEl = root.querySelector('.mv-results');
    const paint = (data) => {
      if (data.error) { shelvesEl.innerHTML = `<p class="mv-err">Couldn’t load films right now (${esc(data.error)}). Paste a YouTube link below instead.</p>`; return; }
      const hero = data.shelves[0]?.items[0];
      shelvesEl.innerHTML = (hero ? `
        <button class="mv-hero" type="button" data-yt="${esc(hero.id)}" data-title="${esc(tidy(hero.title))}" ${isHost() ? '' : 'disabled'}>
          <img src="${esc(hero.thumb.replace('hqdefault', 'maxresdefault'))}" alt="" onerror="this.src='${esc(hero.thumb)}'">
          <span class="mv-hero-copy"><small>Trending · ${esc(hero.channel)}</small><b>${esc(tidy(hero.title))}</b>
            <span class="mv-hero-cta">${isHost() ? '<i class="ph-fill ph-play"></i>Watch together' : '<i class="ph ph-hourglass"></i>Waiting for the host to pick'}</span></span>
        </button>` : '') + data.shelves.map((sh) => `
        <section class="mv-shelf"><h3>${esc(sh.title)}</h3><div class="mv-row-scroll">${sh.items.map(card).join('')}</div></section>`).join('');
    };
    if (shelvesCache) paint(shelvesCache);
    else api('/api/movies/shelves').then((d) => { if (!d.error) shelvesCache = d; if (shelvesEl.isConnected) paint(d); }).catch(() => paint({ error: 'no connection' }));
    root.querySelector('.mv-search').addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = root.querySelector('#mv-q').value.trim();
      if (q.length < 2) { resultsEl.innerHTML = ''; return; }
      resultsEl.innerHTML = '<p class="mv-loading"><span class="spin"></span>Searching…</p>';
      const d = await api('/api/movies/search?q=' + encodeURIComponent(q)).catch(() => ({ error: 'no connection' }));
      resultsEl.innerHTML = d.error ? `<p class="mv-err">${esc(d.error)}</p>`
        : d.items.length ? `<section class="mv-shelf"><h3>Results for “${esc(q)}”</h3><div class="mv-grid">${d.items.map(card).join('')}</div></section>`
        : `<p class="mv-err">Nothing found for “${esc(q)}”. Try different words.</p>`;
    });
    root.querySelector('.mv-yt')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = root.querySelector('#mv-yt-url').value, err = root.querySelector('.mv-err');
      if (!youtubeId(url)) { err.textContent = 'Paste a YouTube video link, like https://youtu.be/abc123xyz00'; return; }
      const r = await ctx.send({ type: 'pick', yt: url, title: 'YouTube video' });
      if (r?.error) err.textContent = r.error;
    });
  }

  async function onPick(e) {
    const b = e.target.closest('[data-yt]');
    if (!b || !isHost() || !root.contains(b)) return;
    haptic(10);
    b.classList.add('picked');
    const r = await ctx.send({ type: 'pick', yt: b.dataset.yt, title: b.dataset.title });
    if (r?.error) b.classList.remove('picked');
  }

  function card(m) {
    const title = tidy(m.title);
    const len = m.mins ? (m.mins >= 60 ? `${Math.floor(m.mins / 60)}h ${m.mins % 60}m` : `${m.mins} min`) : '';
    const age = ago(m.published);
    return `<button class="mv-card" type="button" data-yt="${esc(m.id)}" data-title="${esc(title)}" ${isHost() ? '' : 'disabled'}>
      <span class="mv-thumb"><img src="${esc(m.thumb)}" alt="" loading="lazy">${len ? `<i class="num">${len}</i>` : ''}</span>
      <span class="mv-meta"><b>${esc(title)}</b><small>${esc(m.channel)}${age ? ` · ${age}` : ''}</small></span>
    </button>`;
  }

  function top() {
    const p = partner();
    return `<header class="mv-top">
      <a class="bu-icon" href="/" data-link aria-label="Leave Movie Night"><i class="ph ph-x"></i></a>
      <div class="mv-title"><b>Movie Night</b><small>${s.title ? esc(s.title) : 'Studio'}</small></div>
      ${p ? `<span class="mv-with${p.connected ? ' on' : ''}">${avatarHtml(p, 'xs')}${p.connected ? 'Watching' : 'Away'}</span>`
        : '<button class="mv-invite" type="button" data-invite><i class="ph ph-paper-plane-tilt"></i>Invite</button>'}
    </header>`;
  }
  function bindTop() {
    root.querySelectorAll('[data-invite]').forEach((b) => b.addEventListener('click', (e) => ctx.copyLink?.(e.currentTarget)));
  }

  /* ---------- the screen: Netflix-style, controls float over the film ---------- */
  let uiTimer = 0, sendTimer = 0, hold = 0, pendingT = null, online = true, status = '', statusTimer = 0;
  const now = () => performance.now();

  function screen() {
    const f = filmById(s.film), yt = !!s.yt;
    root.innerHTML = `
      ${top()}
      <section class="mv-screen">
        <div class="mv-frame" data-ui="on">
          ${yt ? '<div class="mv-yt-player" id="mv-ytp"></div>'
            : `<video class="mv-video" playsinline webkit-playsinline preload="auto" poster="${f.poster}" src="${f.src}"></video>`}
          <div class="mv-catch" aria-hidden="true"></div>
          <div class="mv-ui">
            <div class="mv-ui-top"><b>${esc(s.title || f?.title || 'Movie')}</b><small class="mv-with-line"></small></div>
            <div class="mv-ui-mid">
              <button class="mv-o" type="button" data-skip="-10" aria-label="Back 10 seconds"><i class="ph ph-arrow-counter-clockwise"></i><small>10</small></button>
              <button class="mv-o big" type="button" data-toggle aria-label="Play"><i class="ph-fill ph-play"></i></button>
              <button class="mv-o" type="button" data-skip="10" aria-label="Forward 10 seconds"><i class="ph ph-arrow-clockwise"></i><small>10</small></button>
            </div>
            <div class="mv-ui-bot">
              <input class="mv-seek" type="range" min="0" max="1000" value="0" aria-label="Seek">
              <div class="mv-ui-row">
                <span class="mv-time num"><b class="cur">0:00</b> / <span class="dur">–:––</span></span>
                <span class="mv-ui-right">
                  ${yt ? '<button class="mv-o sm" type="button" data-cc aria-label="Subtitles"><i class="ph ph-closed-captioning"></i></button>' : ''}
                  <button class="mv-o sm" type="button" data-full aria-label="Full screen"><i class="ph ph-corners-out"></i></button>
                </span>
              </div>
            </div>
          </div>
          <div class="mv-status" hidden></div>
          <div class="mv-buffer" hidden><span class="spin" aria-hidden="true"></span></div>
          <button class="mv-tap" type="button" hidden><i class="ph-fill ph-play-circle"></i><b>Tap to join</b><small>Your browser needs one tap before it can play.</small></button>
        </div>
        <div class="mv-below">
          <p class="mv-who" aria-live="polite"></p>
          <div class="mv-partner"></div>
          <div class="mv-about"><b>${esc(s.title || f?.title || '')}</b> <span>${f ? `${f.year} · ${esc(f.genre)} · ${f.mins} min` : 'on YouTube'}</span>
            ${f ? `<p>${esc(f.blurb)}</p>` : ''}
            ${isHost() ? '<button class="btn btn-quiet mv-change" type="button" data-change><i class="ph ph-film-strip"></i>Pick another film</button>' : ''}</div>
        </div>
      </section>`;
    bindTop();
    const $ = (q) => root.querySelector(q);
    player = yt ? ytAdapter($('#mv-ytp')) : videoAdapter($('.mv-video'));

    $('[data-toggle]').addEventListener('click', () => (wantPlaying() ? doPause() : doPlay()));
    root.querySelectorAll('[data-skip]').forEach((b) => b.addEventListener('click', () => doSkip(Number(b.dataset.skip))));
    const seek = $('.mv-seek');
    seek.addEventListener('input', () => { seek.dragging = true; showUI(); $('.cur').textContent = clock((seek.value / 1000) * player.duration); });
    seek.addEventListener('change', () => { seek.dragging = false; doSeekTo((seek.value / 1000) * player.duration); });
    $('[data-full]').addEventListener('click', toggleFull);
    $('[data-cc]')?.addEventListener('click', toggleCC);
    $('[data-change]')?.addEventListener('click', () => { if (confirm('Go back to the studio and pick another film?')) ctx.send({ type: 'close' }); });
    $('.mv-catch').addEventListener('click', () => ($('.mv-frame').dataset.ui === 'on' ? hideUI() : showUI()));
    $('.mv-tap').addEventListener('click', () => { needsTap = false; $('.mv-tap').hidden = true; hold = 0; apply(); });
    $('.mv-partner').addEventListener('click', (e) => { if (e.target.closest('[data-wait]')) doPause(); });
    showUI();
    timer = setInterval(tick, 500);
  }

  // Controls show on tap and fade after 3 seconds of playing, like Netflix.
  function showUI() {
    const fr = root.querySelector('.mv-frame');
    if (!fr) return;
    fr.dataset.ui = 'on';
    clearTimeout(uiTimer);
    uiTimer = setTimeout(() => { if (wantPlaying() && !root.querySelector('.mv-seek')?.dragging) hideUI(); }, 3200);
  }
  function hideUI() { const fr = root.querySelector('.mv-frame'); if (fr) fr.dataset.ui = 'off'; }

  function toggleFull() {
    const fr = root.querySelector('.mv-frame');
    if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
    if (fr.classList.contains('mv-full')) { fr.classList.remove('mv-full'); document.body.classList.remove('mv-noscroll'); return; }
    const go = fr.requestFullscreen?.() ?? fr.webkitRequestFullscreen?.();
    Promise.resolve(go).then(() => window.screen?.orientation?.lock?.('landscape').catch(() => {})).catch(() => {
      // iPhone can't full-screen a page element: fill the window instead.
      fr.classList.add('mv-full');
      document.body.classList.add('mv-noscroll');
    });
    if (!go) { fr.classList.add('mv-full'); document.body.classList.add('mv-noscroll'); }
    showUI();
  }

  /* ---------- players: one shape for <video> and YouTube ---------- */
  const quiet = (fn, ms = 500) => { applying++; try { fn(); } finally { setTimeout(() => applying--, ms); } };
  function videoAdapter(v) {
    const a = {
      get time() { return v.currentTime || 0; },
      get duration() { return v.duration || 0; },
      get paused() { return v.paused; },
      seek(t) { quiet(() => { v.currentTime = t; }); },
      play() { applying++; const p = v.play() ?? Promise.resolve(); p.finally(() => setTimeout(() => applying--, 300)); return p; },
      pause() { quiet(() => v.pause()); },
      destroy() { v.pause(); v.removeAttribute('src'); v.load(); },
    };
    // The phone's own controls (e.g. iPhone full screen) count as your action too.
    v.addEventListener('play', () => { if (!applying && !wantPlaying()) local({ playing: true }); });
    v.addEventListener('pause', () => { if (!applying && wantPlaying() && !v.ended) local({ playing: false }); });
    v.addEventListener('seeked', () => { if (!applying && Math.abs(v.currentTime - expected()) > DRIFT) local({ t: v.currentTime }); });
    v.addEventListener('waiting', () => buffering(true));
    v.addEventListener('playing', () => buffering(false));
    v.addEventListener('loadedmetadata', () => apply());
    return a;
  }

  function ytAdapter(host) {
    let yp = null, ready = false;
    const subs = ctx.prefs?.().subs || '';
    const a = {
      get time() { return ready ? yp.getCurrentTime() : 0; },
      get duration() { return ready ? yp.getDuration() : 0; },
      get paused() { return !ready || ![1, 3].includes(yp.getPlayerState()); },
      seek(t) { if (ready) quiet(() => yp.seekTo(t, true), 800); },
      play() { if (ready) quiet(() => yp.playVideo(), 800); return Promise.resolve(); },
      pause() { if (ready) quiet(() => yp.pauseVideo(), 800); },
      cc(lang) {
        if (!ready) return;
        if (!lang) { yp.unloadModule?.('captions'); return; }
        yp.loadModule?.('captions');
        yp.setOption?.('captions', 'track', { languageCode: lang });
      },
      destroy() { try { yp?.destroy(); } catch { /* already gone */ } },
    };
    a.ccLang = subs;
    loadYouTube().then((YT) => {
      if (!host.isConnected) return;
      yp = new YT.Player(host, {
        videoId: s.yt, width: '100%', height: '100%',
        // Our own controls sit on top; YouTube's are hidden. Captions follow your profile choice.
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, cc_load_policy: subs ? 1 : 0, ...(subs ? { cc_lang_pref: subs, hl: subs } : {}) },
        events: {
          onReady: () => { ready = true; if (subs) a.cc(subs); apply(); },
          onStateChange: (e) => {
            buffering(e.data === 3);
            if (applying) return;
            if (e.data === 1 && !wantPlaying()) local({ playing: true });
            if (e.data === 2 && wantPlaying()) local({ playing: false });
          },
          onError: (e) => {
            // 101 / 150: the channel doesn't allow this film to play outside YouTube.
            const msg = e.data === 101 || e.data === 150 ? 'This film’s owner only allows it on YouTube itself.' : 'This video couldn’t be played.';
            const tap = root.querySelector('.mv-tap');
            if (tap) { tap.hidden = false; tap.innerHTML = `<i class="ph-fill ph-warning-circle"></i><b>${msg}</b><small>${isHost() ? 'Tap to pick another film.' : 'Ask them to pick another.'}</small>`; tap.onclick = () => { if (isHost()) ctx.send({ type: 'close' }); }; }
          },
        },
      });
    });
    return a;
  }

  function toggleCC() {
    if (!player?.cc) return;
    const lang = player.ccLang ? '' : (ctx.prefs?.().subs || 'en');
    player.ccLang = lang;
    player.cc(lang);
    const b = root.querySelector('[data-cc]');
    b?.classList.toggle('on', !!lang);
    flash(lang ? `Subtitles on (${lang.toUpperCase()})` : 'Subtitles off');
    showUI();
  }

  /* ---------- keeping you in step ----------
   * Your own taps happen on your phone straight away and are sent in the background, so nothing
   * waits on a slow network. For a moment after you act, echoes of older state can't drag the film
   * back. Your partner's actions apply as soon as they arrive. */
  let localPlaying = null; // what you last asked for, until the server confirms it
  const wantPlaying = () => (localPlaying ?? s.playing);

  function local({ playing, t }) {
    if (!online) { flash('Reconnecting… try again in a moment'); return; }
    hold = now() + 2000;
    const at = t ?? player.time;
    if (playing === true) { localPlaying = true; player.play().catch(() => {}); ctx.send({ type: 'play', t: at }); }
    else if (playing === false) { localPlaying = false; player.pause(); ctx.send({ type: 'pause', t: at }); }
    else { ctx.send({ type: 'seek', t: at }); }
    paintControls();
  }
  function doPlay() { haptic(8); showUI(); local({ playing: true }); }
  function doPause() { haptic(8); showUI(); local({ playing: false }); }
  function doSkip(delta) {
    if (!online) { flash('Reconnecting… try again in a moment'); return; }
    haptic(6);
    showUI();
    // Quick taps add up: five taps is +50s, counted from where the last tap landed.
    const base = pendingT != null && now() < hold ? pendingT : player.time;
    const dur = player.duration || Infinity;
    pendingT = Math.max(0, Math.min(dur - 1, base + delta));
    hold = now() + 2000;
    player.seek(pendingT);
    flash(`${delta > 0 ? '+' : '−'}${Math.abs(delta)}s`);
    clearTimeout(sendTimer);
    sendTimer = setTimeout(() => ctx.send({ type: 'seek', t: pendingT }), 250);
    paintControls();
  }
  function doSeekTo(t) {
    if (!online) { flash('Reconnecting… try again in a moment'); return; }
    pendingT = Math.max(0, t);
    hold = now() + 2000;
    player.seek(pendingT);
    clearTimeout(sendTimer);
    ctx.send({ type: 'seek', t: pendingT });
    paintControls();
  }

  function apply() {
    if (!player || !s) return;
    if (now() < hold) { paintControls(); return; } // your own recent tap wins for a moment
    pendingT = null;
    localPlaying = null;
    const want = expected();
    if (Math.abs(player.time - want) > (s.playing ? DRIFT : 0.4)) player.seek(want);
    if (s.playing && player.paused && !needsTap) {
      player.play().catch(() => {
        // Browsers block playing with sound until you've tapped the page once.
        needsTap = true;
        const tap = root.querySelector('.mv-tap');
        if (tap) tap.hidden = false;
      });
    }
    if (!s.playing && !player.paused) player.pause();
    paintControls();
  }

  function tick() {
    if (!player || !s) return;
    // Every half second: if you've drifted (slow loading, a hiccup), jump back in line.
    if (online && now() > hold && s.playing && !player.paused && Math.abs(player.time - expected()) > DRIFT) {
      player.seek(expected());
      flash('Caught up');
    }
    paintControls();
  }

  let bufTimer = 0;
  function buffering(on) {
    const b = root.querySelector('.mv-buffer');
    if (!b) return;
    clearTimeout(bufTimer);
    if (!on) { b.hidden = true; setStatus(online ? '' : status); return; }
    b.hidden = false;
    // Still loading after a moment: say so. When it resumes, the half-second check skips ahead.
    bufTimer = setTimeout(() => { if (online) setStatus('catch'); }, 1500);
  }

  function setStatus(kind) {
    status = kind;
    const el = root.querySelector('.mv-status');
    if (!el) return;
    const them = partner()?.name ?? 'your partner';
    const text = { off: `<span class="spin"></span><b>Reconnecting to match ${esc(them)}…</b><small>The film jumps to where they are the moment you’re back.</small>`,
      catch: `<span class="spin"></span><b>Catching up with ${esc(them)}…</b>` }[kind];
    el.hidden = !text;
    el.classList.toggle('pill', kind === 'catch'); // catching up is a small label; only offline covers the film
    if (text) el.innerHTML = text;
    root.querySelectorAll('.mv-o, .mv-seek').forEach((b) => { b.disabled = kind === 'off'; });
  }

  function flash(text) {
    const fr = root.querySelector('.mv-frame');
    if (!fr) return;
    let f = fr.querySelector('.mv-flash');
    if (!f) { f = document.createElement('span'); f.className = 'mv-flash'; fr.append(f); }
    f.textContent = text;
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
  }

  // The app tells us when the connection drops and returns.
  const onNet = (e) => {
    const was = online;
    online = e.detail !== 'offline';
    if (!online) { setStatus('off'); return; }
    if (!was) {
      // Back: forget anything half-sent and line up with the room's state as soon as it arrives.
      hold = 0; pendingT = null; localPlaying = null;
      setStatus('catch');
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => { if (status === 'catch') setStatus(''); }, 8000);
    }
  };
  window.addEventListener('ls:net', onNet);
  // The phone itself knows the moment its connection goes; don't wait for the server to notice.
  const onOffline = () => onNet({ detail: 'offline' });
  const onOnline = () => onNet({ detail: 'good' });
  window.addEventListener('offline', onOffline);
  window.addEventListener('online', onOnline);

  function paintControls() {
    const $ = (q) => root.querySelector(q);
    if (!$('.mv-ui') || !player) return;
    const dur = player.duration, t = pendingT != null && now() < hold ? pendingT : player.time;
    $('.cur').textContent = clock(t);
    $('.dur').textContent = dur ? clock(dur) : '–:––';
    const seek = $('.mv-seek');
    if (!seek.dragging && dur) seek.value = Math.round((t / dur) * 1000);
    const playing = wantPlaying();
    const btn = $('[data-toggle]');
    btn.innerHTML = `<i class="ph-fill ${playing ? 'ph-pause' : 'ph-play'}"></i>`;
    btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    $('[data-cc]')?.classList.toggle('on', !!player.ccLang);
    const p = partner();
    $('.mv-with-line').textContent = p ? `with ${p.name}` : '';
    const by = s.by != null && s.by !== me() ? meta.players[s.by]?.name : null;
    $('.mv-who').textContent = by ? `${by} ${s.playing ? 'pressed play' : 'paused'}` : '';
    // Your partner's connection: they catch up by themselves, or you can wait for them.
    const box = $('.mv-partner');
    const msg = !p ? '' : p.left ? `${esc(p.name)} left Movie Night.` : !p.connected ? `${esc(p.name)} is reconnecting. They’ll catch up automatically.` : p.net === 'weak' ? `${esc(p.name)}’s connection is weak. They may skip ahead to stay with you.` : '';
    const html = msg ? `<p><i class="ph ph-wifi-slash"></i>${msg}</p>${s.playing && (p.left || !p.connected) ? '<button class="btn btn-quiet" type="button" data-wait><i class="ph-fill ph-pause"></i>Wait for them</button>' : ''}` : '';
    if (box.dataset.html !== html) { box.dataset.html = html; box.innerHTML = html; }
  }

  function teardown() {
    clearInterval(timer);
    clearTimeout(uiTimer);
    clearTimeout(sendTimer);
    player?.destroy?.();
    player = null;
    document.body.classList.remove('mv-noscroll');
  }

  return {
    update(state, m) {
      const prevPlaying = s?.playing;
      s = state;
      meta = m;
      if (m.now) offset = m.now - Date.now();
      const key = s.film || s.yt ? `${s.film ?? ''}|${s.yt ?? ''}` : 'studio';
      if (key !== shownKey) {
        teardown();
        shownKey = key;
        if (key === 'studio') studio(); else screen();
      } else {
        // Keep the header's "Watching / Away" honest without rebuilding the player.
        const topEl = root.querySelector('.mv-top');
        if (topEl) { topEl.outerHTML = top(); bindTop(); }
      }
      if (key !== 'studio') {
        // Their action, or the room's state after a reconnect, beats your short "hold".
        if (m.lastMove?.by != null && m.lastMove.by !== me()) { hold = 0; pendingT = null; localPlaying = null; }
        if (status === 'catch' && online) { clearTimeout(statusTimer); statusTimer = setTimeout(() => setStatus(''), 1200); }
        apply();
        if (prevPlaying !== undefined && prevPlaying !== s.playing && s.by !== me()) haptic(12);
      }
    },
    destroy() { teardown(); window.removeEventListener('ls:net', onNet); window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline); },
  };
}
