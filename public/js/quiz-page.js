// /quiz: pick a category, get a link, send it. The duel starts when they open it.
import { CATEGORIES } from '/shared/trivia.js';
import { QUESTIONS, COUNTS, SECONDS } from '/shared/games/quiz.js';
import { BRAND } from './brand.js';
import { haptic, tilt } from './fx.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const KEY = 'ls.quiz';
function remembered() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; }
}

export function showQuiz(ctx) {
  const { app, MARK, startGame, cleanup } = ctx;
  document.title = `Quiz Duel · ${BRAND}`;
  const saved = remembered();
  const pick = { n: COUNTS.includes(saved.n) ? saved.n : QUESTIONS, secs: SECONDS.includes(saved.secs) ? saved.secs : 20 };
  const cats = [['mixed', { name: 'Mixed bag', icon: 'ph-shuffle', tone: 'teal', blurb: 'A bit of everything' }], ...Object.entries(CATEGORIES)];
  const seg = (name, values, unit, label) => `
    <fieldset class="qz-set">
      <legend>${label}</legend>
      <div class="seg" role="radiogroup" aria-label="${label}">
        ${values.map((v) => `<button type="button" role="radio" data-set="${name}" data-v="${v}" aria-checked="${pick[name] === v}">${v}${unit}</button>`).join('')}
      </div>
    </fieldset>`;
  app.innerHTML = `
    <nav class="nav solid" aria-label="Main"><a class="wordmark" href="/" data-link>${MARK}</a>
      <a class="btn btn-quiet" href="/" data-link><i class="ph ph-arrow-left"></i>All games</a></nav>
    <main class="bu-hub">
      <header class="hub-head">
        <h1>Quiz Duel</h1>
        <p>Pick a category, set the rules, send the link. You both get the same questions on the same clock. Every right answer is a point. Leave the screen to look something up and you lose.</p>
      </header>
      <h2 class="hub-h">Pick a category</h2>
      <div class="cat-grid">
        ${cats.map(([id, c]) => `
          <button class="cat-card" type="button" data-cat="${id}" style="--tone:var(--tone-${c.tone});--tone-ink:var(--tone-${c.tone}-ink)">
            <i class="ph-fill ${c.icon}"></i>
            <b>${esc(c.name)}</b>
            ${c.blurb ? `<span>${esc(c.blurb)}</span>` : ''}
          </button>`).join('')}
      </div>
    </main>`;

  // Step two: with the category chosen, set how many questions and how long each, then make the link.
  function setup(id) {
    const c = Object.fromEntries(cats)[id];
    const dlg = document.createElement('dialog');
    dlg.className = 'sheet qz-sheet';
    dlg.style.setProperty('--tone', `var(--tone-${c.tone})`);
    dlg.style.setProperty('--tone-ink', `var(--tone-${c.tone}-ink)`);
    dlg.innerHTML = `
      <form method="dialog" class="sheet-head">
        <h2><span class="qz-sheet-icon"><i class="ph-fill ${c.icon}"></i></span>${esc(c.name)}</h2>
        <button class="btn btn-quiet btn-icon" aria-label="Close"><i class="ph ph-x"></i></button>
      </form>
      <div class="sheet-body qz-setup">
        ${seg('n', COUNTS, '', 'Questions')}
        ${seg('secs', SECONDS, 's', 'Time per question')}
        <button class="btn btn-primary qz-go" type="button"><i class="ph ph-paper-plane-tilt"></i>Create the link</button>
      </div>`;
    document.body.append(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => {
      pick[b.dataset.set] = +b.dataset.v;
      haptic(4);
      dlg.querySelectorAll(`[data-set="${b.dataset.set}"]`).forEach((x) => x.setAttribute('aria-checked', x === b));
      try { localStorage.setItem(KEY, JSON.stringify(pick)); } catch { /* private mode: just don't remember */ }
    }));
    dlg.querySelector('.qz-go').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      e.currentTarget.innerHTML = '<i class="ph ph-circle-notch"></i>Creating…';
      haptic(10);
      dlg.close();
      await startGame('quiz', { cat: id, n: pick.n, secs: pick.secs });
    });
    dlg.showModal();
  }

  app.querySelectorAll('.cat-card').forEach((b) => {
    cleanup.push(tilt(b, { max: 5 }));
    b.addEventListener('click', () => { haptic(8); setup(b.dataset.cat); });
  });
}
