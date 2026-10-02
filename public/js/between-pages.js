// Between Us hub (/between), a game's packs (/between/:mode) and a collection (/between/c/:id).
import { MODES, PACK_LIST, PACKS, COLLECTIONS, packsFor, question } from '/shared/packs.js';
import { ROUND } from '/shared/games/between.js';
import { TOOLS, openTool } from './tools.js';
import { tilt, haptic } from './fx.js';
import { BRAND } from './brand.js';
import { avatarHtml } from './auth.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const roundOf = (p) => Math.min(ROUND, p.q.length);

/** Rounds you've started or joined on this device, newest first. */
export function history(store) {
  try { return JSON.parse(store.get('pr.between') || '[]'); } catch { return []; }
}
export function remember(store, code, pack) {
  const list = history(store).filter((r) => r.code !== code);
  list.unshift({ code, pack, at: Date.now() });
  store.set('pr.between', JSON.stringify(list.slice(0, 60)));
}

/** A frozen question card, built from the same markup as the real game. */
function sampleCard(pack, names) {
  const { text, options } = question(pack, 0, names[1]);
  if (MODES[pack.mode].kind === 'likely') options.splice(0, 2, 'Me', names[1]);
  return `<span class="mini-q" aria-hidden="true">
    <span class="mini-text">${esc(text)}</span>
    <span class="mini-opts"><span class="mini-pill" style="--rot:-2deg">${esc(options[0])}</span><span class="mini-pill" style="--rot:1.6deg">${esc(options[1])}</span></span>
  </span>`;
}

export function showHub(ctx) {
  const { app, MARK, cleanup } = ctx;
  document.title = `Between Us · ${BRAND}`;
  const modes = Object.values(MODES);
  const sections = [...new Set(COLLECTIONS.map((c) => c.section))];
  const names = [ctx.me?.user?.username ?? 'You', ctx.me?.partner?.username ?? 'Your partner'];
  const card = (href, title, tone, pack, extra = '') => `
    <a class="mode-card${extra}" href="${href}" data-link style="--tone:var(--tone-${tone});--tone-ink:var(--tone-${tone}-ink)">
      <h3>${esc(title)}</h3>
      <span class="mode-art">${sampleCard(pack, names)}</span>
      <span class="mode-foot"><span>${pack.spicy ? '<span class="tag18">18+</span>' : ''}</span><i class="ph ph-arrow-up-right"></i></span>
    </a>`;
  app.innerHTML = `
    <nav class="nav solid" aria-label="Main"><a class="wordmark" href="/" data-link>${MARK}</a>
      <a class="btn btn-quiet" href="/" data-link><i class="ph ph-arrow-left"></i>All games</a></nav>
    <main class="bu-hub">
      <header class="hub-head">
        <h1>Between Us</h1>
        <p>Answer the same ${ROUND} questions apart, then see how in sync you really are. ${PACK_LIST.length} packs, ${PACK_LIST.reduce((n, p) => n + p.q.length, 0)} questions.</p>
      </header>
      <h2 class="hub-h">Play together</h2>
      <div class="mode-grid">${modes.map((m) => card(`/between/${m.id}`, m.name, m.tone, packsFor(m.id)[0])).join('')}</div>
      ${sections.map((sec) => `
        <h2 class="hub-h">${esc(sec)}</h2>
        <div class="mode-grid">${COLLECTIONS.filter((c) => c.section === sec).map((c) => card(`/between/c/${c.id}`, c.title, c.tone, PACKS[c.packs[0]], c.wide ? ' wide' : '')).join('')}</div>`).join('')}
      <h2 class="hub-h">Just for fun</h2>
      <div class="tool-row">
        ${TOOLS.map((t) => `<button class="tool-tile" type="button" data-tool="${t.id}"><i class="ph ${t.icon}"></i><b>${esc(t.name)}</b><span>${esc(t.blurb)}</span></button>`).join('')}
      </div>
    </main>`;
  app.querySelectorAll('.mode-card').forEach((c) => cleanup.push(tilt(c, { max: 4 })));
  app.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => { haptic(6); openTool(b.dataset.tool, ctx.me?.user?.username); }));
}

export function showMode(ctx, modeId) {
  const mode = MODES[modeId];
  if (!mode) return ctx.navigate('/between');
  return packList(ctx, { title: mode.name, blurb: mode.blurb, tone: mode.tone, packs: packsFor(modeId) });
}

export function showCollection(ctx, id) {
  const c = COLLECTIONS.find((x) => x.id === id);
  if (!c) return ctx.navigate('/between');
  const first = PACKS[c.packs[0]];
  return packList(ctx, { title: c.title, blurb: MODES[first.mode].blurb, tone: c.tone, packs: c.packs.map((p) => PACKS[p]) });
}

async function packList(ctx, { title, blurb, tone, packs }) {
  const { app, store, emit, startGame, navigate } = ctx;
  document.title = `${title} · ${BRAND}`;
  const me = ctx.me?.user;
  let filter = 'all';
  const rounds = {};
  const ids = new Set(packs.map((p) => p.id));
  const mine = history(store).filter((r) => ids.has(r.pack));

  const status = (p) => {
    const r = rounds[p.id];
    if (!r) return 'new';
    if (r.finished) return 'results';
    if (r.mine < (r.total ?? roundOf(p))) return 'mine';
    return 'theirs';
  };

  const render = () => {
    const shown = packs.filter((p) => filter === 'all' || status(p) === filter);
    const count = (f) => packs.filter((p) => status(p) === f).length;
    app.querySelector('.pack-list').innerHTML = shown.length ? shown.map((p) => {
      const st = status(p), r = rounds[p.id], n = r?.total ?? roundOf(p);
      const av2 = r?.partner ? avatarHtml({ username: r.partner, avatar: r.partnerAvatar }) : '<span class="avatar initial empty"><i class="ph ph-plus"></i></span>';
      const btn = { new: 'Start', mine: 'Continue', theirs: 'Waiting', results: 'Results' }[st];
      const line = {
        new: `${MODES[p.mode].short} · ${n} questions`,
        mine: `You're on ${r?.mine} of ${n}${r?.partner ? ` · ${esc(r.partner)} on ${r.theirs}` : ''}`,
        theirs: r?.partner ? `Waiting for ${esc(r.partner)} (${r.theirs} of ${n})` : 'Waiting for your partner to open the link',
        results: `${r?.score}% ${p.mode === 'guess' ? 'right guesses' : 'in sync'} with ${esc(r?.partner ?? 'your partner')}`,
      }[st];
      return `<article class="pack-card st-${st}">
        <div class="pack-main">
          <h3>${esc(p.title.replace(' (18+)', ''))}${p.spicy ? ' <span class="tag18">18+</span>' : ''}</h3>
          <p>${line}</p>
          <span class="pack-avs">${avatarHtml(me)}${av2}</span>
        </div>
        <button class="pill3d" type="button" data-pack="${p.id}" data-st="${st}" data-code="${r?.code ?? ''}">${btn}</button>
      </article>`;
    }).join('') : `<p class="pack-empty">Nothing here yet.</p>`;
    app.querySelectorAll('.chip-row button').forEach((b) => {
      b.classList.toggle('on', b.dataset.f === filter);
      const n = b.dataset.f === 'all' ? packs.length : count(b.dataset.f);
      b.querySelector('.n').textContent = n;
      b.classList.toggle('has', b.dataset.f === 'mine' && n > 0);
    });
    app.querySelectorAll('[data-pack]').forEach((b) => b.addEventListener('click', async () => {
      haptic(8);
      if (b.dataset.st === 'new') {
        const code = await startGame('between', { pack: b.dataset.pack });
        if (code) remember(store, code, b.dataset.pack);
      } else navigate('/r/' + b.dataset.code);
    }));
  };

  app.innerHTML = `
    <main class="bu-mode" style="--tone:var(--tone-${tone});--tone-ink:var(--tone-${tone}-ink)">
      <header class="mode-head">
        <a class="btn btn-quiet btn-icon" href="/between" data-link aria-label="Back to Between Us"><i class="ph ph-caret-left"></i></a>
        <h1>${esc(title)}</h1>
        <p>${esc(blurb)}</p>
      </header>
      <div class="chip-row" role="tablist">
        ${[['all', 'All'], ['new', 'Available'], ['mine', 'My turn'], ['theirs', 'Their turn'], ['results', 'Results']].map(([f, l]) => `<button type="button" role="tab" data-f="${f}">${l}<span class="n num"></span></button>`).join('')}
      </div>
      <div class="pack-list"></div>
    </main>`;
  app.querySelectorAll('.chip-row button').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; render(); }));
  render();

  // Fill in live progress for rounds this device has played.
  const latest = {};
  for (const r of mine) if (!latest[r.pack]) latest[r.pack] = r;
  await Promise.all(Object.values(latest).map(async (r) => {
    const info = await emit('peek', { code: r.code });
    if (info.summary) rounds[r.pack] = { ...info.summary, code: r.code };
  }));
  if (app.querySelector('.bu-mode')) render();
}
