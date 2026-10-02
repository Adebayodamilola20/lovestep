import { MODES, PACKS, question } from '/shared/packs.js';
import { GOOD } from '/shared/games/between.js';
import { haptic, reduced, EASE_OUT } from '/js/fx.js';
import { celebrate } from '/js/confetti.js';
import { avatarHtml } from '/js/auth.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ROT = [-2.2, 1.6, -1.1, 2.4];
// A hand-drawn wave for the progress line: 33 alternating arcs across a 400-wide box.
const SQUIGGLE = 'M2 7' + Array.from({ length: 33 }, (_, k) => ` q 6 ${k % 2 ? 6 : -6} 12 0`).join('');
const C = 2 * Math.PI * 52;

export function mount(el, ctx) {
  let state = null, meta = null, mode = null, pack = null;
  let localIdx = 0, sending = false, view = '', celebratedSeq = null, shownFor = null;
  let step = 'self', selfPick = null; // guessing rounds: answer for yourself, then guess them
  let solo = false; // started answering before the partner opened the link

  el.innerHTML = '<div class="bu"></div>';
  const root = el.firstElementChild;

  const me = () => meta.you;
  const total = () => state.qs.length;
  const partner = () => meta.players[1 - me()];
  const myself = () => meta.players[me()];
  const partnerName = () => partner()?.name ?? 'your partner';
  const isGuess = () => mode.kind === 'guess';
  // "Most likely" options are you ("Me") and your partner by name, never "Them".
  const q = (i) => {
    const out = question(pack, state.qs[i], partner()?.name ?? 'Your partner');
    if (mode.kind === 'likely') out.options = ['Me', partner()?.name ?? 'Your partner'];
    return out;
  };

  function shell(inner, { progress = 0, skip = false } = {}) {
    root.style.setProperty('--tone', `var(--tone-${mode.tone})`);
    root.style.setProperty('--tone-ink', `var(--tone-${mode.tone}-ink)`);
    root.innerHTML = `
      <header class="bu-top">
        <a class="bu-icon" href="/between/${mode.id}" data-link aria-label="Close"><i class="ph ph-x"></i></a>
        <div class="bu-title"><b>${esc(pack.title)}</b><small>${esc(mode.short)}</small></div>
        ${skip ? '<button class="bu-skip" type="button">Skip<i class="ph ph-arrow-right"></i></button>' : '<span class="bu-icon" aria-hidden="true"></span>'}
      </header>
      <div class="bu-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total()}" aria-valuenow="${Math.round(progress * total())}">
        <svg viewBox="0 0 400 14" preserveAspectRatio="none" aria-hidden="true">
          <path class="track" d="${SQUIGGLE}" pathLength="1"/>
          <path class="done" d="${SQUIGGLE}" pathLength="1" style="stroke-dashoffset:${1 - progress}"/>
        </svg>
      </div>
      <div class="bu-note" aria-live="polite">${note()}</div>
      <section class="bu-body">${inner}</section>`;
    root.querySelector('.bu-skip')?.addEventListener('click', () => answer(-1));
  }

  function note() {
    const p = partner();
    if (view === 'lobby') return '';
    if (!p) return `<button class="bu-chip" type="button" data-invite><i class="ph ph-paper-plane-tilt"></i>Send ${esc(pack.title)} to your partner</button>`;
    const theirs = state.progress[1 - me()];
    if (state.done[1 - me()] && !state.done[me()]) return `<span class="bu-chip hot"><i class="ph-fill ph-check-circle"></i>${esc(p.name)} answered all ${total()}. Your turn.</span>`;
    return `<span class="bu-chip">${avatarHtml(p, 'xs')}${esc(p.name)} is on ${theirs} of ${total()}</span>`;
  }

  /* ---------- answering ---------- */
  function cardHtml(i) {
    const { text, options } = q(i);
    const kind = mode.kind;
    const who = (k) => (k === 0 ? myself() : partner() ?? { name: '?' });
    const pill = (label, k) => `<button class="bq-pill" type="button" data-a="${k}" style="--rot:${ROT[k % ROT.length]}deg">${kind === 'likely' ? avatarHtml(who(k), 'sm') : ''}<span>${esc(label)}</span></button>`;
    const opts = options.length === 2
      ? `${pill(options[0], 0)}<span class="bq-or">OR</span>${pill(options[1], 1)}`
      : options.map(pill).join('');
    const guessing = isGuess() && step === 'guess';
    const label = !isGuess() ? '' : guessing
      ? `<p class="bq-step guess">${avatarHtml(partner() ?? { name: '?' }, 'xs')}Now guess ${partner() ? `${esc(partner().name)}'s` : 'their'} answer</p>`
      : `<p class="bq-step">${avatarHtml(myself(), 'xs')}About you</p>`;
    return `<article class="bq${guessing ? ' guessing' : ''}" data-i="${i}">
      <p class="bq-count num">${i + 1} / ${total()}</p>
      ${label}
      <h2 class="bq-text">${esc(text)}</h2>
      <div class="bq-opts ${options.length === 2 ? 'two' : 'many'}">${opts}</div>
    </article>`;
  }

  function showQuestion(enterFrom = 1) {
    view = 'ask';
    shownFor = partner()?.name ?? '';
    shell(cardHtml(localIdx), { progress: localIdx / total(), skip: true });
    bindCard();
    const card = root.querySelector('.bq');
    if (!reduced && enterFrom) card.animate([
      { opacity: 0, transform: `perspective(900px) translateX(${48 * enterFrom}px) rotateY(${-24 * enterFrom}deg)` },
      { opacity: 1, transform: 'none' },
    ], { duration: 420, easing: EASE_OUT });
  }

  function bindCard() {
    root.querySelectorAll('.bq-pill').forEach((b) => b.addEventListener('click', () => answer(+b.dataset.a, b)));
    root.querySelectorAll('[data-invite]').forEach((b) => b.addEventListener('click', (e) => ctx.copyLink?.(e.currentTarget)));
  }

  async function leave(btn) {
    const card = root.querySelector('.bq');
    if (reduced || !card) return;
    await card.animate([
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'perspective(900px) translateX(-56px) rotateY(28deg)' },
    ], { duration: 300, delay: btn ? 220 : 0, easing: 'cubic-bezier(0.7, 0, 0.84, 0)', fill: 'forwards' }).finished.catch(() => {});
  }

  async function answer(a, btn) {
    if (sending || view !== 'ask') return;
    haptic(8);
    if (btn) btn.classList.add('picked');
    root.querySelectorAll('.bq-pill').forEach((b) => { b.disabled = true; });

    // Guessing rounds: the first tap is about you, the second is your guess about them.
    if (isGuess() && step === 'self' && a !== -1) {
      selfPick = a;
      await leave(btn);
      step = 'guess';
      return showQuestion(1);
    }
    sending = true;
    const i = localIdx;
    const move = isGuess() ? { type: 'answer', i, a: step === 'guess' ? selfPick : -1, g: a } : { type: 'answer', i, a };
    const out = leave(btn);
    const res = await ctx.send(move);
    await out;
    sending = false;
    step = 'self';
    selfPick = null;
    if (res.error) { localIdx = state.progress[me()]; return render(); }
    localIdx = i + 1;
    if (localIdx >= total()) { view = ''; return render(); }
    showQuestion();
  }

  /* ---------- lobby: invite first, so you answer together ---------- */
  function showLobby() {
    view = 'lobby';
    const who = ctx.partnerName?.() ?? null;
    shell(`<div class="bu-wait bu-lobby">
      <span class="bu-badge"><i class="ph-fill ph-paper-plane-tilt"></i></span>
      <h2>Send it to ${esc(who ?? 'your partner')} first</h2>
      <p>You'll answer the same ${total()} questions side by side. When you both finish, you see each other's picks and how in sync you are.</p>
      <button class="btn btn-primary" type="button" data-invite><i class="ph ph-paper-plane-tilt"></i>Send the link</button>
      <span class="waiting"><span class="dots"><i></i><i></i><i></i></span>Waiting for ${esc(who ?? 'them')} to open it</span>
      <button class="btn btn-quiet" type="button" data-solo>Start answering now</button>
    </div>`);
    bindCard();
    root.querySelector('[data-solo]').addEventListener('click', () => { solo = true; render(); });
  }

  /* ---------- waiting ---------- */
  function showWaiting() {
    view = 'wait';
    const p = partner();
    const theirs = state.progress[1 - me()];
    const dots = Array.from({ length: total() }, (_, k) => `<i class="${k < theirs ? 'on' : ''}"></i>`).join('');
    shell(`<div class="bu-wait">
      <span class="bu-badge"><i class="ph-fill ph-check-fat"></i></span>
      <h2>All ${total()} answered</h2>
      ${p ? `<p>${esc(p.name)} is on ${theirs} of ${total()}. Your results unlock the moment they finish.</p><div class="bu-dots" aria-label="${theirs} of ${total()}">${dots}</div>`
        : `<p>Send the link so your partner can answer the same ${total()} questions. You'll see how many you matched.</p>
           <button class="btn btn-primary" type="button" data-invite><i class="ph ph-paper-plane-tilt"></i>Send the link</button>`}
    </div>`, { progress: 1 });
    bindCard();
  }

  /* ---------- results ---------- */
  function label(i, a) {
    if (a === -1) return 'Skipped';
    if (mode.kind === 'likely') return a === me() ? 'Me' : partnerName();
    return q(i).options[a];
  }

  const ring = (pct, good, who) => `
    <div class="bu-score ${good ? 'good' : 'low'}">
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-bg" cx="60" cy="60" r="52"/><circle class="ring" cx="60" cy="60" r="52" data-to="${pct}" style="stroke-dasharray:${C};stroke-dashoffset:${C}"/></svg>
      <div class="bu-pct"><b class="num" data-to="${pct}">0</b><span>%</span></div>
      ${who ? `<span class="bu-who">${who}</span>` : ''}
    </div>`;

  function showResults() {
    view = 'results';
    const good = state.score >= GOOD;
    const mine = state.answers[me()], theirs = state.answers[1 - me()];
    let head, rows;
    if (isGuess()) {
      const k = state.knows;
      head = `<div class="bu-duo">
        ${ring(k[me()].pct, k[me()].pct >= GOOD, `${avatarHtml(myself(), 'xs')}You know ${esc(partnerName())}`)}
        ${ring(k[1 - me()].pct, k[1 - me()].pct >= GOOD, `${avatarHtml(partner(), 'xs')}${esc(partnerName())} knows you`)}
      </div>
      <h2>${good ? 'You know each other' : 'Still learning each other'}</h2>
      <p class="bu-verdict">${state.matches} right guesses out of ${state.counted}${good ? '. That is real attention.' : `. Under ${GOOD}% means there's more to find out.`}</p>`;
      rows = state.qs.map((_, i) => {
        const line = (ans, guess, ansBy, guessBy) => {
          const res = ans.a === -1 || guess.g === -1 ? 'skip' : guess.g === ans.a ? 'match' : 'miss';
          const icon = { match: 'ph-check-circle', miss: 'ph-x-circle', skip: 'ph-minus-circle' }[res];
          return `<div class="ans-guess ${res}">
            <span class="ans-pill" style="--rot:-1deg">${avatarHtml(ansBy, 'sm')}${esc(label(i, ans.a))}</span>
            <span class="ans-g">${esc(guessBy?.name ?? '')} guessed <b>${esc(label(i, guess.g))}</b><i class="ph-fill ${icon}"></i></span>
          </div>`;
        };
        return `<li class="ans">
          <p>${esc(q(i).text)}</p>
          ${line(mine[i], theirs[i], myself(), partner())}
          ${line(theirs[i], mine[i], partner(), myself())}
        </li>`;
      }).join('');
    } else {
      head = `${ring(state.score, good)}
        <h2>${good ? 'In sync' : 'Out of sync'}</h2>
        <p class="bu-verdict">${good
          ? `You matched ${state.matches} of ${state.counted}. You two think alike.`
          : `You matched ${state.matches} of ${state.counted}. Under ${GOOD}% means there's something to talk about.`}</p>`;
      rows = state.qs.map((_, i) => {
        const x = mine[i], y = theirs[i];
        const cls = x === -1 || y === -1 ? 'skip' : x === y ? 'match' : 'miss';
        const { text, options } = q(i);
        const title = mode.kind === 'pair' ? `${text}: ${options[0]} or ${options[1]}` : text;
        return `<li class="ans ${cls}">
          <p>${esc(title)}</p>
          <div class="ans-pair">
            <span class="ans-pill" style="--rot:-1.4deg">${avatarHtml(myself(), 'sm')}${esc(label(i, x))}</span>
            <span class="ans-pill" style="--rot:1.2deg">${avatarHtml(partner(), 'sm')}${esc(label(i, y))}</span>
          </div>
        </li>`;
      }).join('');
    }
    const mineVote = meta.rematch?.[me()], theirVote = meta.rematch?.[1 - me()];
    shell(`<div class="bu-results">
      ${head}
      ${meta.record?.sync ? `<p class="bu-hist num">${meta.record.sync.rounds} round${meta.record.sync.rounds > 1 ? 's' : ''} together · average ${meta.record.sync.avg}% · best ${meta.record.sync.best}%</p>` : ''}
      <h3>Answers <span>(${total()})</span></h3>
      <ul class="ans-list">${rows}</ul>
      <div class="bu-actions">
        <button class="bu-cta" type="button" data-again ${mineVote ? 'disabled' : ''}>${mineVote ? `Waiting for ${esc(partnerName())}` : theirVote ? `${esc(partnerName())} wants another round` : 'Play another round'}</button>
        <a class="bu-cta ghost" href="/between/${mode.id}" data-link>Back to packs</a>
      </div>
    </div>`, { progress: 1 });
    root.querySelector('[data-again]')?.addEventListener('click', () => ctx.rematch?.());
    // Fill the rings and count up together.
    const dur = reduced ? 0 : 1100, t0 = performance.now();
    const rings = [...root.querySelectorAll('.ring')], nums = [...root.querySelectorAll('.bu-pct b')];
    const tick = (now) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = 1 - (1 - k) ** 3;
      rings.forEach((r) => { r.style.strokeDashoffset = C * (1 - (+r.dataset.to / 100) * e); });
      nums.forEach((n) => { n.textContent = Math.round(+n.dataset.to * e); });
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    if (good && celebratedSeq !== meta.seq) { celebratedSeq = meta.seq; setTimeout(() => celebrate(), 500); }
  }

  function render() {
    if (state.winner != null) return showResults();
    if (state.done[me()]) return showWaiting();
    if (!partner() && !solo && state.progress[me()] === 0) return showLobby();
    if (view === 'lobby') {
      // They opened the link: start together.
      haptic([20, 40, 20]);
      view = '';
    }
    if (view === 'ask' && localIdx === state.progress[me()]) {
      // Same question still on screen. If the partner just arrived, their name goes on the buttons.
      if (shownFor !== (partner()?.name ?? '')) return showQuestion(0);
      root.querySelector('.bu-note').innerHTML = note();
      root.querySelectorAll('[data-invite]').forEach((b) => b.addEventListener('click', (e) => ctx.copyLink?.(e.currentTarget)));
      return;
    }
    localIdx = state.progress[me()];
    step = 'self';
    selfPick = null;
    showQuestion();
  }

  return {
    update(s, m) {
      const fresh = !state || s.pack !== state.pack || s.qs.join() !== state.qs.join();
      const partnerJustFinished = state && !state.done[1 - m.you] && s.done[1 - m.you] && !s.done[m.you];
      state = s;
      meta = m;
      pack = PACKS[s.pack];
      mode = MODES[s.mode];
      if (fresh) { view = ''; step = 'self'; selfPick = null; }
      if (partnerJustFinished) haptic([20, 40, 20]);
      if (sending) return;
      render();
    },
  };
}
