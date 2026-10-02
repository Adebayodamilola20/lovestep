import { canPlay, top, SHAPES, RULES } from '/shared/games/whot.js';
import { flyFrom, haptic } from '/js/fx.js';

// Geometric primitives for the five suits (drawn, not illustrated).
const starPts = Array.from({ length: 10 }, (_, k) => {
  const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 19 : 46;
  return `${(50 + Math.cos(a) * r).toFixed(1)},${(52 + Math.sin(a) * r).toFixed(1)}`;
}).join(' ');
const SHAPE_SVG = {
  circle: '<circle cx="50" cy="50" r="42"/>',
  triangle: '<polygon points="50,8 95,90 5,90"/>',
  cross: '<path d="M37 6h26v31h31v26H63v31H37V63H6V37h31z"/>',
  square: '<rect x="10" y="10" width="80" height="80"/>',
  star: `<polygon points="${starPts}"/>`,
};
const svg = (s) => `<svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">${SHAPE_SVG[s]}</svg>`;
const label = (c) => (c.s === 'whot' ? 'Whot 20' : `${c.s} ${c.n}`);

function cardHtml(c, extra = '') {
  if (!c) return `<div class="card down ${extra}"><div class="face"></div><div class="back">WHOT</div></div>`;
  if (c.s === 'whot') {
    return `<div class="card whot20 ${extra}" data-id="${c.id}" aria-label="Whot 20"><div class="face"><span class="corner tl">20</span><span class="big">WHOT</span><span class="corner br">20</span></div><div class="back">WHOT</div></div>`;
  }
  const rule = RULES[c.n] ? `<span class="rule">${RULES[c.n].split(':')[0]}</span>` : '';
  return `<div class="card ${extra}" data-id="${c.id}" aria-label="${label(c)}"><div class="face">
    <span class="corner tl">${c.n}${svg(c.s)}</span><span class="big">${svg(c.s)}</span><span class="corner br">${c.n}${svg(c.s)}</span>${rule}
  </div><div class="back">WHOT</div></div>`;
}

function fan(hand, n) {
  const step = Math.min(7, 42 / Math.max(1, n));
  [...hand.children].forEach((c, i) => {
    const o = i - (n - 1) / 2;
    c.style.setProperty('--fan', `${(o * step).toFixed(2)}deg`);
    c.style.setProperty('--dip', `${(Math.abs(o) * Math.abs(o) * 1.4).toFixed(1)}px`);
  });
  hand.style.setProperty('--overlap', n > 9 ? -0.66 : n > 6 ? -0.55 : -0.32);
}

function pickShape() {
  return new Promise((resolve) => {
    const o = document.createElement('div');
    o.className = 'shape-pick';
    o.innerHTML = `<div class="panel" role="dialog" aria-label="Call a shape"><h3>Call a shape</h3><div class="opts">${SHAPES.map((s) => `<button type="button" data-s="${s}">${svg(s)}${s}</button>`).join('')}</div><button type="button" class="btn btn-quiet" data-s="">Cancel</button></div>`;
    o.addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]');
      if (!b && e.target !== o) return;
      o.remove();
      resolve(b?.dataset.s || null);
    });
    document.body.append(o);
    o.querySelector('.opts button').focus();
  });
}

export function mount(el, { send, preview }) {
  el.innerHTML = `<div class="whot">
    <div class="hand opp" aria-label="Opponent's hand"></div>
    <div class="table-mid">
      <button type="button" class="market" aria-label="Go to market"></button>
      <div class="pile" aria-label="Pile"></div>
    </div>
    <div class="whot-bar"></div>
    <div class="hand mine" aria-label="Your hand"></div>
  </div>`;
  const oppEl = el.querySelector('.hand.opp'), mineEl = el.querySelector('.hand.mine');
  const marketEl = el.querySelector('.market'), pileEl = el.querySelector('.pile'), barEl = el.querySelector('.whot-bar');
  let state = null, you = 0, seen = -1, busy = false;
  const myTurn = () => !preview && state && state.turn === you && state.winner == null && !busy;

  async function play(card) {
    if (!myTurn() || !canPlay(state, card)) return;
    let ask;
    if (card.s === 'whot') { ask = await pickShape(); if (!ask) return; }
    haptic(10);
    busy = true;
    const r = await send({ type: 'play', id: card.id, ask });
    if (r.error) busy = false;
  }
  marketEl.addEventListener('click', async () => {
    if (!myTurn()) return;
    haptic(8);
    busy = true;
    const r = await send({ type: 'draw' });
    if (r.error) busy = false;
  });

  function render(s) {
    const mine = s.hands[you], theirs = s.hands[1 - you];
    oppEl.innerHTML = theirs.map((c) => cardHtml(c)).join('');
    fan(oppEl, theirs.length);
    mineEl.innerHTML = mine.map((c) => cardHtml(c, myTurn() && canPlay(s, c) ? 'ok' : '')).join('');
    fan(mineEl, mine.length);
    mineEl.querySelectorAll('.card').forEach((node, i) => {
      if (node.classList.contains('ok')) {
        node.tabIndex = 0;
        node.setAttribute('role', 'button');
        node.addEventListener('click', () => play(mine[i]));
        node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(mine[i]); } });
      }
    });
    const deckN = typeof s.deck === 'number' ? s.deck : s.deck.length;
    const shown = Math.min(deckN, 6);
    marketEl.innerHTML = Array.from({ length: shown }, (_, k) => cardHtml(null).replace('class="card down', `style="--i:${k}" class="card down`)).join('') + `<span class="count num">${deckN} left</span>`;
    marketEl.disabled = !myTurn();
    const pile = s.pile.slice(-4);
    pileEl.innerHTML = pile.map((c, k) => cardHtml(c).replace('class="card', `style="--i:${k};--r:${((c.id * 37) % 13) - 6}deg" class="card`)).join('')
      + (s.need ? `<span class="need">${svg(s.need)}Calling ${s.need}</span>` : '');
    const t = top(s);
    barEl.innerHTML = s.pending
      ? `<span class="pending"><i class="ph ph-warning"></i>${s.turn === you ? `Pick ${s.pending.n}, or defend with a ${s.pending.type}` : `They pick ${s.pending.n} unless they defend`}</span>`
      : s.turn === you && s.winner == null && !preview && !s.hands[you].some((c) => canPlay(s, c))
        ? `<span class="pending" style="background:var(--color-paper-3);color:var(--color-ink-2)"><i class="ph ph-cards"></i>Nothing matches ${t.s === 'whot' ? s.need : `${t.s} or ${t.n}`}. Tap the market.</span>` : '';
  }

  return {
    async update(s, meta) {
      const fresh = meta.seq !== seen && seen !== -1 && meta.lastMove?.seq === meta.seq;
      seen = meta.seq;
      you = meta.you;
      // Capture where things are before the DOM changes, then FLIP them into place.
      const before = new Map([...mineEl.querySelectorAll('.card[data-id]')].map((n) => [n.dataset.id, n.getBoundingClientRect()]));
      const oppRect = oppEl.getBoundingClientRect(), marketRect = marketEl.getBoundingClientRect();
      const prevMine = new Set(state?.hands[you]?.map((c) => String(c.id)) ?? []);
      const prevOpp = state?.hands[1 - you]?.length ?? 0;
      state = s;
      busy = false;
      render(s);
      if (!fresh || preview || !s.last) return;
      const last = s.last;
      const topEl = pileEl.querySelector('.card:last-of-type');
      if (last.action === 'play' && topEl) {
        const from = last.by === you ? before.get(String(last.card.id)) : oppRect;
        await flyFrom(topEl, from && { left: from.left + from.width / 2 - 30, top: from.top, width: 60, height: 86 }, { rotate: last.by === you ? -8 : 10, flip: last.by !== you, duration: 560 });
      }
      // New cards in hands come from the market, turning over as they land.
      const anims = [];
      [...mineEl.querySelectorAll('.card[data-id]')].filter((n) => !prevMine.has(n.dataset.id) && prevMine.size).forEach((n, k) => {
        anims.push(new Promise((r) => setTimeout(() => flyFrom(n, marketRect, { flip: true, duration: 520 }).then(r), k * 110)));
      });
      const oppCards = [...oppEl.querySelectorAll('.card')];
      oppCards.slice(prevOpp && oppCards.length > prevOpp ? prevOpp : oppCards.length).forEach((n, k) => {
        anims.push(new Promise((r) => setTimeout(() => flyFrom(n, marketRect, { duration: 480, suffix: ' rotateY(180deg)' }).then(r), k * 110)));
      });
      await Promise.all(anims);
    },
  };
}
