import { N, randomFleet } from '/shared/games/battleship.js';
import { drift, drop, haptic, reduced } from '/js/fx.js';

function hullClass(ships) {
  const map = new Map();
  for (const ship of ships) {
    const cells = [...ship].sort((a, b) => a - b);
    const horiz = cells.length > 1 && cells[1] - cells[0] === 1;
    cells.forEach((x, k) => map.set(x, `hull${k === 0 ? (horiz ? ' h-start' : ' v-start') : ''}${k === cells.length - 1 ? (horiz ? ' h-end' : ' v-end') : ''}`));
  }
  return map;
}

export function mount(el, { send, preview }) {
  let fleet = randomFleet(), seen = -1, offs = [];
  const board = (cls, label, cell, clickable) => `
    <div class="scene"><div class="surface slab ocean ${cls}" role="grid" aria-label="${label}">${Array.from({ length: N * N }, (_, i) => {
      const c = cell(i);
      return `<button type="button" class="cellbtn${c.cls || ''}" data-i="${i}" ${clickable && !c.dis ? '' : 'disabled'} aria-label="${String.fromCharCode(65 + Math.floor(i / N))}${(i % N) + 1}${c.label || ''}">${c.html || ''}</button>`;
    }).join('')}</div></div>`;

  function bindTilt() {
    offs.forEach((f) => f());
    offs = preview ? [] : [...el.querySelectorAll('.scene')].map((sc) => drift(sc.firstElementChild, el));
  }

  function update(s, { you, seq }) {
    const fresh = seq !== seen && seen !== -1;
    seen = seq;
    const opp = 1 - you;
    if (s.phase === 'setup') {
      const placed = s.placed[you];
      const hull = hullClass(placed ? s.ships[you] : fleet);
      el.innerHTML = `<div class="sea setup-mode"><div>
        <h4>Your fleet</h4>
        ${board('', 'Your fleet', (i) => ({ html: hull.has(i) ? `<span class="${hull.get(i)}"></span>` : '' }), false)}
        ${placed || preview ? '' : '<div class="dock" style="padding:var(--space-lg) 0 0"><button class="btn" id="shuffle" type="button"><i class="ph ph-shuffle"></i>Shuffle</button><button class="btn btn-primary" id="ready" type="button"><i class="ph ph-check"></i>Ready</button></div>'}
      </div></div>`;
      el.querySelector('#shuffle')?.addEventListener('click', () => { fleet = randomFleet(); update(s, { you, seq }); });
      el.querySelector('#ready')?.addEventListener('click', () => send({ type: 'place', ships: fleet }));
      bindTilt();
      return;
    }
    const canFire = !preview && s.turn === you && s.winner == null;
    const theirs = s.ships[opp] || [];
    const sunk = new Set(theirs.filter((sh) => sh.every((x) => s.shots[you][x] === 'hit')).flat());
    const theirHull = hullClass(theirs), myHull = hullClass(s.ships[you] || []);
    const mySunk = new Set((s.ships[you] || []).filter((sh) => sh.every((x) => s.shots[opp][x] === 'hit')).flat());
    const peg = (shots, i) => (shots[i] ? `<span class="peg ${shots[i]}"></span>` : '');
    const last = (by, i) => (s.last && s.last.by === by && s.last.i === i ? ' lastshot' : '');
    el.innerHTML = `<div class="sea">
      <div><h4>Enemy waters</h4>${board('', 'Enemy waters', (i) => ({
        cls: last(you, i),
        html: (theirHull.has(i) ? `<span class="${theirHull.get(i)}${sunk.has(i) ? ' sunk' : ''}"></span>` : '') + peg(s.shots[you], i),
        dis: s.shots[you][i] != null,
        label: s.shots[you][i] ? `, ${s.shots[you][i]}` : '',
      }), canFire)}</div>
      <div class="mine"><h4>Your fleet</h4>${board('', 'Your fleet', (i) => ({
        cls: last(opp, i),
        html: (myHull.has(i) ? `<span class="${myHull.get(i)}${mySunk.has(i) ? ' sunk' : ''}"></span>` : '') + peg(s.shots[opp], i),
      }), false)}</div></div>`;
    el.querySelectorAll('.ocean')[0].querySelectorAll('.cellbtn:not(:disabled)').forEach((b) => b.addEventListener('click', () => { haptic(10); send({ type: 'fire', i: +b.dataset.i }); }));
    bindTilt();
    if (fresh && s.last && !preview) {
      const grid = el.querySelectorAll('.ocean')[s.last.by === you ? 0 : 1];
      const cell = grid.querySelector(`[data-i="${s.last.i}"]`);
      const p = cell?.querySelector('.peg');
      if (p) drop(p, { height: 160, duration: 420 }).then(() => {
        if (reduced) return;
        const rip = document.createElement('span');
        rip.className = 'ripple';
        cell.append(rip);
        setTimeout(() => rip.remove(), 800);
        if (p.classList.contains('hit')) haptic(30);
      });
    }
  }
  return { update, destroy: () => offs.forEach((f) => f()) };
}
