// Small just-for-fun tools for two names. Everything runs in the browser.
import { haptic, reduced } from './fx.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clean = (s) => String(s || '').trim().replace(/\s+/g, ' ').slice(0, 24);

export const TOOLS = [
  { id: 'love', name: 'Love Calculator', icon: 'ph-heart', blurb: 'Two names in, one percentage out.' },
  { id: 'flames', name: 'FLAMES', icon: 'ph-fire', blurb: 'The playground classic.' },
  { id: 'ship', name: 'Ship Name', icon: 'ph-sparkle', blurb: 'Blend your names into one.' },
  { id: 'language', name: 'Love Language', icon: 'ph-chat-circle-text', blurb: 'Ten quick picks. Find yours.' },
  { id: 'days', name: 'Days Together', icon: 'ph-calendar-heart', blurb: 'Count the days and the next milestone.' },
];

/** Stable 0-1 from two names, order-independent, so the same pair always gets the same answer. */
function pairHash(a, b) {
  const s = [a, b].map((x) => x.toLowerCase().replace(/[^a-z]/g, '')).sort().join('+');
  let h = 2166136261;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

function flames(a, b) {
  const x = [...a.toLowerCase().replace(/[^a-z]/g, '')], y = [...b.toLowerCase().replace(/[^a-z]/g, '')];
  for (let i = 0; i < x.length; i++) {
    const j = y.indexOf(x[i]);
    if (j >= 0) { x.splice(i, 1); y.splice(j, 1); i--; }
  }
  const n = x.length + y.length;
  const words = ['Friends', 'Lovers', 'Affection', 'Marriage', 'Enemies', 'Siblings'];
  if (!n) return 'Twins';
  let pos = 0;
  while (words.length > 1) {
    pos = (pos + n - 1) % words.length;
    words.splice(pos, 1);
  }
  return words[0];
}

function ships(a, b) {
  const A = a.split(' ')[0], B = b.split(' ')[0];
  const cut = (s, front) => {
    const vowels = [...s.toLowerCase()].map((c, i) => ('aeiouy'.includes(c) ? i : -1)).filter((i) => i > 0);
    const mid = vowels.length ? vowels[front ? 0 : vowels.length - 1] : Math.ceil(s.length / 2);
    return front ? s.slice(0, mid + 1) : s.slice(mid);
  };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const out = new Set([cap(cut(A, true) + cut(B, false)), cap(cut(B, true) + cut(A, false)), cap(A.slice(0, Math.ceil(A.length / 2)) + B.slice(Math.floor(B.length / 2)))]);
  return [...out].filter((s) => s.length > 2);
}

const LANG = {
  words: { name: 'Words of affirmation', line: 'You feel loved when it is said out loud: compliments, texts, notes left on the mirror.' },
  acts: { name: 'Acts of service', line: 'Love is a verb for you: the dishes done, the errand run before you ask.' },
  gifts: { name: 'Receiving gifts', line: 'It is the thought you can hold: something small that says "I saw this and thought of you".' },
  time: { name: 'Quality time', line: 'Phones down, full attention. Time together is the whole point.' },
  touch: { name: 'Physical touch', line: 'A hand on your back, a hug at the door. Closeness says it best.' },
};
const LANG_Q = [
  [['words', 'A long message telling me what I mean to them'], ['touch', 'A long hug when I get home']],
  [['acts', 'They cook dinner after my long day'], ['gifts', 'They bring home my favourite snack']],
  [['time', 'An evening with no phones, just us'], ['words', 'Hearing "I am proud of you"']],
  [['touch', 'Holding hands in public'], ['acts', 'They sort out something I have been dreading']],
  [['gifts', 'A surprise gift for no reason'], ['time', 'A planned day out together']],
  [['words', 'Compliments on how I look'], ['acts', 'Help with my to-do list']],
  [['time', 'Long talks before sleep'], ['touch', 'Falling asleep cuddled up']],
  [['gifts', 'Flowers at the door'], ['words', 'A sweet text in the middle of the day']],
  [['acts', 'They fill up my car or charge my phone'], ['time', 'They come along to my boring errand']],
  [['touch', 'A kiss on the forehead'], ['gifts', 'A souvenir from their trip']],
];

const MILESTONES = [100, 200, 365, 500, 730, 1000, 1095, 1461, 1826, 2000, 2500, 3000, 3652];

function sheet(title, html) {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet';
  dlg.innerHTML = `<form method="dialog" class="sheet-head"><h2>${esc(title)}</h2><button class="btn btn-quiet btn-icon" aria-label="Close"><i class="ph ph-x"></i></button></form><div class="sheet-body">${html}</div>`;
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.showModal();
  return dlg;
}

const twoNames = (you) => `
  <form class="tool-form">
    <div><label class="label" for="n1">Your name</label><input class="field" id="n1" name="a" maxlength="24" value="${esc(you || '')}" required></div>
    <div><label class="label" for="n2">Their name</label><input class="field" id="n2" name="b" maxlength="24" required></div>
    <button class="btn btn-primary">Work it out</button>
  </form>
  <div class="tool-out" aria-live="polite"></div>`;

export function openTool(id, you) {
  const t = TOOLS.find((x) => x.id === id);
  if (!t) return;
  if (id === 'love' || id === 'flames' || id === 'ship') {
    const dlg = sheet(t.name, twoNames(you));
    const out = dlg.querySelector('.tool-out');
    dlg.querySelector('#n2').focus();
    dlg.querySelector('.tool-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target), a = clean(f.get('a')), b = clean(f.get('b'));
      if (!a || !b) return;
      haptic(12);
      if (id === 'love') {
        const pct = 40 + Math.round(pairHash(a, b) * 59);
        const line = pct >= 85 ? 'Written in the stars.' : pct >= 70 ? 'Strong pull. Keep going.' : pct >= 55 ? 'Something is there.' : 'Opposites, maybe. That can work.';
        out.innerHTML = `<div class="tool-big"><b class="num" data-to="${pct}">0</b><span>%</span></div><p><b>${esc(a)}</b> and <b>${esc(b)}</b>. ${line}</p><small>Just for fun. The real test is Between Us.</small>`;
        countUp(out.querySelector('[data-to]'));
      } else if (id === 'flames') {
        const r = flames(a, b);
        out.innerHTML = `<div class="tool-word">${esc(r)}</div><p>FLAMES says <b>${esc(a)}</b> and <b>${esc(b)}</b> are ${r === 'Twins' ? 'basically the same name' : esc(r.toLowerCase())}.</p>`;
      } else {
        out.innerHTML = `<div class="tool-ships">${ships(a, b).map((s) => `<span>${esc(s)}</span>`).join('')}</div><p>Pick your favourite and put it in the group chat.</p>`;
      }
    });
    return;
  }

  if (id === 'language') {
    const dlg = sheet(t.name, '<div class="lang"></div>');
    const box = dlg.querySelector('.lang');
    const tally = {};
    let i = 0;
    const step = () => {
      if (i >= LANG_Q.length) {
        const [top] = Object.entries(tally).sort((x, y) => y[1] - x[1]);
        const L = LANG[top[0]];
        box.innerHTML = `<p class="lang-k">Your love language</p><div class="tool-word">${esc(L.name)}</div><p>${esc(L.line)}</p>
          <ul class="lang-bars">${Object.keys(LANG).map((k) => `<li><span>${esc(LANG[k].name)}</span><b class="num">${tally[k] || 0}</b></li>`).join('')}</ul>`;
        return;
      }
      const [x, y] = LANG_Q[i];
      box.innerHTML = `<p class="lang-k num">${i + 1} / ${LANG_Q.length}</p><h3>Which means more to you?</h3>
        <div class="bq-opts two"><button class="bq-pill" type="button" style="--rot:-1.6deg">${esc(x[1])}</button><span class="bq-or">OR</span><button class="bq-pill" type="button" style="--rot:1.4deg">${esc(y[1])}</button></div>`;
      box.querySelectorAll('.bq-pill').forEach((b, k) => b.addEventListener('click', () => {
        const key = (k ? y : x)[0];
        tally[key] = (tally[key] || 0) + 1;
        i++;
        haptic(6);
        step();
      }));
    };
    step();
    return;
  }

  if (id === 'days') {
    const saved = (() => { try { return localStorage.getItem('pr.since') || ''; } catch { return ''; } })();
    const dlg = sheet(t.name, `<form class="tool-form"><div><label class="label" for="since">When did it start?</label><input class="field" id="since" name="since" type="date" value="${esc(saved)}" required></div><button class="btn btn-primary">Count</button></form><div class="tool-out" aria-live="polite"></div>`);
    const out = dlg.querySelector('.tool-out');
    const show = (v) => {
      const start = new Date(v + 'T00:00:00');
      const days = Math.floor((Date.now() - start) / 86400000);
      if (!(days >= 0)) { out.innerHTML = '<p>Pick a date in the past.</p>'; return; }
      try { localStorage.setItem('pr.since', v); } catch { /* private mode */ }
      const next = MILESTONES.find((m) => m > days);
      out.innerHTML = `<div class="tool-big"><b class="num" data-to="${days}">0</b><span>days</span></div>
        <p>That's ${Math.floor(days / 7)} weeks, or about ${(days / 30.44).toFixed(1)} months.</p>
        ${next ? `<p class="tool-next">Day ${next} is in <b>${next - days}</b> day${next - days === 1 ? '' : 's'}.</p>` : ''}`;
      countUp(out.querySelector('[data-to]'));
    };
    dlg.querySelector('.tool-form').addEventListener('submit', (e) => { e.preventDefault(); show(new FormData(e.target).get('since')); });
    if (saved) show(saved);
  }
}

function countUp(el) {
  const to = +el.dataset.to, dur = reduced ? 0 : 900, t0 = performance.now();
  const tick = (now) => {
    const k = dur ? Math.min(1, (now - t0) / dur) : 1;
    el.textContent = Math.round(to * (1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
