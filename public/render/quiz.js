import { CATEGORIES } from '/shared/trivia.js';
import { TIMES, AWAY_MS, phaseMs } from '/shared/games/quiz.js';
import { haptic, reduced } from '/js/fx.js';
import { celebrate } from '/js/confetti.js';
import { avatarHtml } from '/js/auth.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const LETTERS = ['A', 'B', 'C', 'D'];

export function mount(el, ctx) {
  let s = null, meta = null, phaseKey = '', phaseStart = 0, raf = 0, sent = null, cheered = null;
  el.innerHTML = '<div class="qz"></div>';
  const root = el.firstElementChild;

  const me = () => meta.you;
  const them = () => meta.players[1 - me()];
  const live = () => s && s.winner == null && meta?.players.length === 2;

  // Anti-cheat: going to another app or tab mid-match starts a short clock on the server.
  // Coming back (or reloading) inside it is fine; staying away hands the win over.
  let away = false;
  const onHide = () => {
    if (!live()) return;
    if (document.visibilityState === 'hidden' && !away) { away = true; ctx.send({ type: 'away' }); }
    else if (document.visibilityState === 'visible' && away) { away = false; ctx.send({ type: 'back' }); }
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);

  function catName() { return s.cat === 'mixed' ? 'Mixed bag' : CATEGORIES[s.cat]?.name ?? 'Quiz'; }

  function scoreboard() {
    const mine = s.scores[me()], theirs = s.scores[1 - me()];
    const opp = them();
    return `<header class="qz-top">
      <a class="bu-icon" href="/quiz" data-link aria-label="Leave the quiz"><i class="ph ph-x"></i></a>
      <div class="qz-board">
        <span class="qz-p">${avatarHtml(meta.players[me()], 'sm')}<b class="num">${mine}</b></span>
        <span class="qz-mid"><small>${esc(catName())}</small><b class="num">${Math.min(s.i + 1, s.qs.length)} / ${s.qs.length}</b></span>
        <span class="qz-p right"><b class="num">${theirs}</b>${opp ? avatarHtml(opp, 'sm') : '<span class="avatar initial empty">?</span>'}</span>
      </div>
      <span class="bu-icon" aria-hidden="true"></span>
    </header>`;
  }

  function render() {
    const opp = them();
    if (!opp) {
      root.innerHTML = `${scoreboard()}<div class="qz-wait"><h2>Waiting for your opponent</h2><p>Send them the link. The first question appears the moment they join.</p><button class="btn btn-primary" type="button" data-invite><i class="ph ph-paper-plane-tilt"></i>Send the link</button></div>`;
      root.querySelectorAll('[data-invite]').forEach((b) => b.addEventListener('click', (e) => ctx.copyLink?.(e.currentTarget)));
      return;
    }
    if (s.winner != null) return renderDone();
    const q = s.qs[s.i];
    const mine = s.answers[me()], theirs = s.answers[1 - me()];
    const open = s.phase === 'reveal';
    const opts = q.o.map((text, k) => {
      const cls = [
        mine?.a === k ? 'mine' : '',
        open && q.c === k ? 'right' : '',
        open && mine?.a === k && q.c !== k ? 'wrong' : '',
      ].join(' ');
      const marks = open ? [me(), 1 - me()].filter((p) => s.answers[p]?.a === k).map((p) => avatarHtml(meta.players[p], 'xs')).join('') : '';
      return `<button class="qz-opt ${cls}" type="button" data-a="${k}" ${s.phase !== 'ask' || mine ? 'disabled' : ''}><span class="qz-l">${LETTERS[k]}</span><span class="qz-t">${esc(text)}</span><span class="qz-marks">${marks}</span></button>`;
    }).join('');

    let banner = '';
    if (s.phase === 'ready') banner = `<div class="qz-ready"><b class="qz-count num" id="qz-count">3</b><p><i class="ph-fill ph-warning-circle"></i>Stay on this screen. Leaving Stephlia or switching tabs for more than ${AWAY_MS / 1000} seconds gives ${esc(opp.name)} the win.</p></div>`;
    else if (s.phase === 'ask') banner = `<p class="qz-status">${mine ? `<i class="ph-fill ph-lock-simple"></i>Locked in. ${theirs ? `${esc(opp.name)} locked in too.` : `Waiting for ${esc(opp.name)}…`}` : theirs ? `${avatarHtml(opp, 'xs')}${esc(opp.name)} has locked in. Hurry.` : 'Every right answer is a point.'}</p>`;
    else if (s.phase === 'pause') banner = `<div class="qz-suspense"><span class="flip">${avatarHtml(meta.players[me()], 'md')}</span><span class="qz-dots"><i></i><i></i><i></i></span><span class="flip">${avatarHtml(opp, 'md')}</span></div>`;
    else if (open) {
      const right = s.point?.right ?? [false, false];
      const mineRight = right[me()], theirsRight = right[1 - me()];
      const text = mineRight && theirsRight ? 'You both got it'
        : mineRight ? 'You got it'
        : theirsRight ? `${esc(opp.name)} got it`
        : 'Nobody got this one';
      const plus = (p) => `<span class="qz-pt ${right[p] ? 'on' : ''}">${avatarHtml(meta.players[p], 'xs')}<span class="num">${right[p] ? '+1' : '0'}</span></span>`;
      banner = `<div class="qz-point ${mineRight ? 'mine' : theirsRight ? 'theirs' : 'none'}"><b>${text}</b><span class="qz-pts">${plus(me())}${plus(1 - me())}</span></div>`;
    }

    root.innerHTML = `${scoreboard()}
      <div class="qz-timer"><i id="qz-bar"></i></div>
      <section class="qz-body">
        <h2 class="qz-q">${esc(q.text)}</h2>
        ${banner}
        <div class="qz-opts">${opts}</div>
      </section>`;
    root.querySelectorAll('.qz-opt:not(:disabled)').forEach((b) => b.addEventListener('click', async () => {
      const a = +b.dataset.a;
      haptic(10);
      sent = s.i;
      root.querySelectorAll('.qz-opt').forEach((x) => { x.disabled = true; });
      b.classList.add('mine');
      await ctx.send({ type: 'answer', q: s.i, a });
    }));
    if (open && s.point?.right?.[me()] && !reduced) root.querySelector('.qz-point')?.animate([{ transform: 'scale(0.9)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    if (open) haptic(s.point?.right?.[me()] ? [20, 30, 40] : 10);
  }

  function renderDone() {
    const mine = s.scores[me()], theirs = s.scores[1 - me()];
    const opp = them();
    const won = s.winner === me(), draw = s.winner === 'draw';
    const vote = meta.rematch?.[me()], theirVote = meta.rematch?.[1 - me()];
    root.innerHTML = `${scoreboard()}
      <section class="qz-done">
        <span class="qz-trophy ${won ? 'won' : draw ? 'draw' : 'lost'}"><i class="ph-fill ${won ? 'ph-trophy' : draw ? 'ph-handshake' : 'ph-medal'}"></i></span>
        <h2>${draw ? 'A draw' : won ? 'You win' : `${esc(opp?.name)} wins`}</h2>
        <p class="qz-final num">${mine} : ${theirs}</p>
        <p class="qz-msg">${mine} of ${s.qs.length} right for you, ${theirs} of ${s.qs.length} for ${esc(opp?.name)}.</p>
        ${s.msg ? `<p class="qz-msg">${esc(s.msg)}</p>` : ''}
        ${meta.record ? `<p class="bu-hist num">All time ${meta.record.you} : ${meta.record.them}</p>` : ''}
        <div class="bu-actions">
          <button class="bu-cta" type="button" data-again ${vote ? 'disabled' : ''}>${vote ? `Waiting for ${esc(opp?.name)}` : theirVote ? `${esc(opp?.name)} wants a rematch` : 'Rematch'}</button>
          <a class="bu-cta ghost" href="/quiz" data-link>Pick another category</a>
        </div>
      </section>`;
    root.querySelector('[data-again]')?.addEventListener('click', () => ctx.rematch?.());
    if (won && cheered !== meta.seq) { cheered = meta.seq; celebrate(); }
  }

  // The bar drains over the answer window; the countdown ticks during "ready".
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!s) return;
    const t = performance.now() - phaseStart;
    const bar = root.querySelector('#qz-bar');
    if (bar) {
      const frac = s.phase === 'ask' ? Math.max(0, 1 - t / phaseMs(s)) : s.phase === 'ready' ? 1 : 0;
      bar.style.transform = `scaleX(${frac})`;
      bar.classList.toggle('low', s.phase === 'ask' && frac < 0.3);
    }
    const count = root.querySelector('#qz-count');
    if (count) count.textContent = Math.max(1, Math.ceil((TIMES.ready - 1000 - t) / 1000));
  }
  raf = requestAnimationFrame(loop);

  return {
    update(state, m) {
      s = state;
      meta = m;
      const key = `${s.i}:${s.phase}`;
      if (key !== phaseKey) { phaseKey = key; phaseStart = performance.now() - Math.max(0, Math.min(Date.now() - s.phaseAt, phaseMs(s) ?? 0)); }
      render();
    },
    destroy() {
      // Walking away mid-match through the app counts as leaving too.
      if (live()) ctx.send({ type: 'forfeit' });
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    },
  };
}
