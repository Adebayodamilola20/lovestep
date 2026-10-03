import { FILMS, film as filmById, youtubeId } from '/shared/games/movie.js';
import { haptic } from '/js/fx.js';
import { avatarHtml } from '/js/auth.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clock = (t) => {
  t = Math.max(0, Math.floor(t || 0));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(s).padStart(2, '0')}`;
};
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

  const me = () => meta.you;
  const isHost = () => me() === 0;
  const partner = () => meta.players[1 - me()];
  const serverNow = () => Date.now() + offset;
  // Where the film should be right now, for both of you.
  const expected = () => s.t + (s.playing ? (serverNow() - s.at) / 1000 : 0);

  /* ---------- the studio ---------- */
  function studio() {
    const p = partner();
    const who = p ? esc(p.name) : 'your partner';
    root.innerHTML = `
      ${top()}
      <section class="mv-studio">
        <header class="mv-head">
          <h2>${isHost() ? 'Pick tonight’s film' : `${esc(meta.players[0]?.name ?? 'Your partner')} is picking a film…`}</h2>
          <p>${isHost() ? `When you press play, it plays for ${who} too. Pause, skip back or jump ahead, and you both stay in step.` : 'It starts on your screen the moment they pick. Either of you can pause or skip.'}</p>
        </header>
        <div class="mv-grid${isHost() ? '' : ' locked'}">
          ${FILMS.map((f) => `
            <button class="mv-card" type="button" data-film="${f.id}" ${isHost() ? '' : 'disabled'}>
              <span class="mv-poster" data-genre="${esc(f.genre.split(' ').pop().toLowerCase())}">
                <b>${esc(f.title)}</b><small>${f.year}</small>
                <img src="${f.poster}" alt="" loading="lazy" onerror="this.remove()" onload="this.classList.add('in')">
              </span>
              <span class="mv-meta"><b>${esc(f.title)}</b><small>${f.year} · ${esc(f.genre)} · ${f.mins} min</small></span>
            </button>`).join('')}
        </div>
        ${isHost() ? `
          <form class="mv-yt">
            <label for="mv-yt-url"><i class="ph-fill ph-youtube-logo"></i>Or paste a YouTube link</label>
            <div><input class="field" id="mv-yt-url" inputmode="url" autocomplete="off" placeholder="https://youtu.be/…"><button class="btn btn-primary" type="submit">Watch</button></div>
            <p class="mv-err" role="alert"></p>
          </form>` : ''}
        <p class="mv-note">Films here are public domain or Creative Commons, streamed from the Internet Archive.</p>
      </section>`;
    bindTop();
    root.querySelectorAll('[data-film]').forEach((b) => b.addEventListener('click', async () => {
      haptic(10);
      b.classList.add('picked');
      const r = await ctx.send({ type: 'pick', film: b.dataset.film });
      if (r?.error) b.classList.remove('picked');
    }));
    root.querySelector('.mv-yt')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = root.querySelector('#mv-yt-url').value, err = root.querySelector('.mv-err');
      if (!youtubeId(url)) { err.textContent = 'Paste a YouTube video link, like https://youtu.be/abc123xyz00'; return; }
      const r = await ctx.send({ type: 'pick', yt: url, title: 'YouTube video' });
      if (r?.error) err.textContent = r.error;
    });
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

  /* ---------- the screen ---------- */
  function screen() {
    const f = filmById(s.film);
    root.innerHTML = `
      ${top()}
      <section class="mv-screen">
        <div class="mv-frame">
          ${s.yt ? '<div class="mv-yt-player" id="mv-ytp"></div>'
            : `<video class="mv-video" playsinline webkit-playsinline preload="auto" poster="${f.poster}" src="${f.src}"></video>`}
          <button class="mv-tap" type="button" hidden><i class="ph-fill ph-play-circle"></i><b>Tap to join</b><small>Your browser needs one tap before it can play.</small></button>
          <div class="mv-buffer" hidden><span class="spin" aria-hidden="true"></span></div>
        </div>
        <div class="mv-controls">
          <input class="mv-seek" type="range" min="0" max="1000" value="0" aria-label="Seek">
          <div class="mv-row">
            <span class="mv-time num"><b class="cur">0:00</b> / <span class="dur">–:––</span></span>
            <div class="mv-buttons">
              <button class="mv-btn" type="button" data-skip="-10" aria-label="Back 10 seconds"><i class="ph ph-arrow-counter-clockwise"></i><small>10</small></button>
              <button class="mv-btn big" type="button" data-toggle aria-label="Play"><i class="ph-fill ph-play"></i></button>
              <button class="mv-btn" type="button" data-skip="10" aria-label="Forward 10 seconds"><i class="ph ph-arrow-clockwise"></i><small>10</small></button>
            </div>
            <span class="mv-right">
              <button class="mv-btn" type="button" data-full aria-label="Full screen"><i class="ph ph-corners-out"></i></button>
              ${isHost() ? '<button class="mv-btn" type="button" data-change aria-label="Change film"><i class="ph ph-film-strip"></i></button>' : ''}
            </span>
          </div>
          <p class="mv-who" aria-live="polite"></p>
        </div>
        ${f ? `<div class="mv-about"><b>${esc(f.title)}</b> <span>${f.year} · ${esc(f.genre)} · ${f.mins} min</span><p>${esc(f.blurb)}</p></div>` : ''}
      </section>`;
    bindTop();
    const $ = (q) => root.querySelector(q);
    if (s.yt) player = ytAdapter($('#mv-ytp'));
    else player = videoAdapter($('.mv-video'));

    $('[data-toggle]').addEventListener('click', () => (s.playing ? doPause() : doPlay()));
    root.querySelectorAll('[data-skip]').forEach((b) => b.addEventListener('click', () => doSeek(player.time + Number(b.dataset.skip))));
    const seek = $('.mv-seek');
    seek.addEventListener('input', () => { seek.dragging = true; $('.cur').textContent = clock((seek.value / 1000) * player.duration); });
    seek.addEventListener('change', () => { seek.dragging = false; doSeek((seek.value / 1000) * player.duration); });
    $('[data-full]').addEventListener('click', () => player.fullscreen());
    $('[data-change]')?.addEventListener('click', () => { if (confirm('Go back to the studio and pick another film?')) ctx.send({ type: 'close' }); });
    $('.mv-tap').addEventListener('click', () => { needsTap = false; $('.mv-tap').hidden = true; apply(true); });
    timer = setInterval(tick, 500);
  }

  /* ---------- players: one shape for <video> and YouTube ---------- */
  function videoAdapter(v) {
    const a = {
      el: v,
      get time() { return v.currentTime || 0; },
      get duration() { return v.duration || 0; },
      get paused() { return v.paused; },
      seek(t) { applying++; v.currentTime = t; setTimeout(() => applying--, 400); },
      play() { applying++; const p = v.play(); setTimeout(() => applying--, 400); return p ?? Promise.resolve(); },
      pause() { applying++; v.pause(); setTimeout(() => applying--, 400); },
      fullscreen() { (v.requestFullscreen?.() ?? v.webkitEnterFullscreen?.())?.catch?.(() => v.webkitEnterFullscreen?.()); },
      destroy() { v.pause(); v.removeAttribute('src'); v.load(); },
    };
    // Native controls (e.g. iPhone full screen) also drive the shared clock.
    v.addEventListener('play', () => { if (!applying && !s.playing) ctx.send({ type: 'play', t: v.currentTime }); });
    v.addEventListener('pause', () => { if (!applying && s.playing && !v.ended) ctx.send({ type: 'pause', t: v.currentTime }); });
    v.addEventListener('seeked', () => { if (!applying && Math.abs(v.currentTime - expected()) > DRIFT) ctx.send({ type: 'seek', t: v.currentTime }); });
    v.addEventListener('waiting', () => { const b = root.querySelector('.mv-buffer'); if (b) b.hidden = false; });
    v.addEventListener('playing', () => { const b = root.querySelector('.mv-buffer'); if (b) b.hidden = true; });
    v.addEventListener('loadedmetadata', () => apply());
    return a;
  }

  function ytAdapter(host) {
    let yp = null, ready = false;
    const a = {
      get time() { return ready ? yp.getCurrentTime() : 0; },
      get duration() { return ready ? yp.getDuration() : 0; },
      get paused() { return !ready || yp.getPlayerState() !== 1; },
      seek(t) { if (!ready) return; applying++; yp.seekTo(t, true); setTimeout(() => applying--, 600); },
      play() { if (ready) { applying++; yp.playVideo(); setTimeout(() => applying--, 600); } return Promise.resolve(); },
      pause() { if (ready) { applying++; yp.pauseVideo(); setTimeout(() => applying--, 600); } },
      fullscreen() { host.requestFullscreen?.() ?? root.querySelector('.mv-frame').requestFullscreen?.(); },
      destroy() { try { yp?.destroy(); } catch { /* already gone */ } },
    };
    loadYouTube().then((YT) => {
      if (!host.isConnected) return;
      yp = new YT.Player(host, {
        videoId: s.yt, width: '100%', height: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => { ready = true; apply(); },
          onStateChange: (e) => {
            if (applying) return;
            if (e.data === 1 && !s.playing) ctx.send({ type: 'play', t: yp.getCurrentTime() });
            if (e.data === 2 && s.playing) ctx.send({ type: 'pause', t: yp.getCurrentTime() });
          },
        },
      });
    });
    return a;
  }

  /* ---------- keeping you in step ---------- */
  function doPlay() { haptic(8); ctx.send({ type: 'play', t: player.time }); }
  function doPause() { haptic(8); ctx.send({ type: 'pause', t: player.time }); }
  function doSeek(t) { haptic(6); t = Math.max(0, Math.min(player.duration || t, t)); player.seek(t); ctx.send({ type: 'seek', t }); }

  function apply(fromTap = false) {
    if (!player || !s) return;
    const want = expected();
    if (Math.abs(player.time - want) > (s.playing ? DRIFT : 0.4)) player.seek(want);
    if (s.playing && player.paused && (!needsTap || fromTap)) {
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
    if (s.playing && !player.paused && Math.abs(player.time - expected()) > DRIFT) player.seek(expected());
    paintControls();
  }

  function paintControls() {
    const $ = (q) => root.querySelector(q);
    if (!$('.mv-controls')) return;
    const dur = player.duration, t = player.time;
    $('.cur').textContent = clock(t);
    $('.dur').textContent = dur ? clock(dur) : '–:––';
    const seek = $('.mv-seek');
    if (!seek.dragging && dur) seek.value = Math.round((t / dur) * 1000);
    const btn = $('[data-toggle]');
    btn.innerHTML = `<i class="ph-fill ${s.playing ? 'ph-pause' : 'ph-play'}"></i>`;
    btn.setAttribute('aria-label', s.playing ? 'Pause' : 'Play');
    const by = s.by != null && s.by !== me() ? meta.players[s.by]?.name : null;
    $('.mv-who').textContent = by ? `${by} ${s.playing ? 'pressed play' : 'paused'}` : '';
  }

  function teardown() {
    clearInterval(timer);
    player?.destroy?.();
    player = null;
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
        apply();
        if (prevPlaying !== undefined && prevPlaying !== s.playing && s.by !== me()) haptic(12);
      }
    },
    destroy() { teardown(); },
  };
}
