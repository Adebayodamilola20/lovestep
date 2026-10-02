import { scene } from '/js/board.js';
import { reduced, haptic, sleep } from '/js/fx.js';

const COLORS = ['oklch(70% 0.16 30)', 'oklch(76% 0.11 220)', 'oklch(84% 0.14 90)', 'oklch(74% 0.13 155)', 'oklch(70% 0.12 300)', 'oklch(92% 0.02 85)'];
// Golden-angle spiral keeps beads from stacking on one spot.
const spot = (k, tall) => {
  const a = k * 2.39996, r = Math.sqrt(k + 0.5) / Math.sqrt(14);
  return { x: 41 + Math.cos(a) * r * 34, y: 41 + Math.sin(a) * r * (tall ? 40 : 34) };
};
const beads = (n, seed, tall) => Array.from({ length: Math.min(n, tall ? 24 : 14) }, (_, k) => {
  const p = spot(k, tall);
  return `<i class="bead" style="--x:${p.x}%;--y:${p.y}%;--c:${COLORS[(seed * 3 + k * 7) % COLORS.length]}"></i>`;
}).join('');

export function mount(el, { send, preview }) {
  const { surface, off } = scene(el, 'mancala', {
    preview, sceneClass: 'mancala-scene',
    html: '<div class="storepit" data-s="opp"></div><div class="rows"><div class="row top"></div><div class="row bottom"></div></div><div class="storepit" data-s="me"></div>',
  });
  const top = surface.querySelector('.top'), bottom = surface.querySelector('.bottom');
  let seen = -1, you = 0;
  const pitEl = (i) => surface.querySelector(`[data-i="${i}"]`);

  function render(pits, canPlay) {
    const opp = 1 - you;
    const pit = (i, mine) => `<button type="button" class="pit" data-i="${i}" ${mine && canPlay && pits[i] ? '' : 'disabled'} aria-label="${pits[i]} stones">${beads(pits[i], i)}<span class="n num">${pits[i]}</span></button>`;
    // Counter-clockwise: your row runs left to right into your store on the right.
    bottom.innerHTML = [0, 1, 2, 3, 4, 5].map((k) => pit(you * 7 + k, true)).join('');
    top.innerHTML = [5, 4, 3, 2, 1, 0].map((k) => pit(opp * 7 + k, false)).join('');
    for (const [sel, p] of [['[data-s="me"]', you], ['[data-s="opp"]', opp]]) {
      const st = surface.querySelector(sel), i = p * 7 + 6;
      st.dataset.i = i;
      st.innerHTML = `${beads(pits[i], i, true)}<span class="n num">${pits[i]}</span>`;
    }
    bottom.querySelectorAll('.pit:not(:disabled)').forEach((b) => b.addEventListener('click', () => { haptic(8); send({ pit: +b.dataset.i - you * 7 }); }));
  }

  async function sow(prev, last) {
    const pits = prev.pits.slice();
    const n = pits[last.from];
    pits[last.from] = 0;
    render(pits, false);
    for (const i of last.path) {
      const a = pitEl(last.from).getBoundingClientRect(), b = pitEl(i).getBoundingClientRect();
      const f = document.createElement('i');
      f.className = 'flyer';
      f.style.setProperty('--c', COLORS[(i * 5) % COLORS.length]);
      f.style.left = a.left + a.width / 2 - 7 + 'px';
      f.style.top = a.top + a.height / 2 - 7 + 'px';
      document.body.append(f);
      const dx = b.left - a.left + (b.width - a.width) / 2, dy = b.top - a.top + (b.height - a.height) / 2;
      f.animate([
        { transform: 'translate(0, 0) scale(1)' },
        { transform: `translate(${dx / 2}px, ${dy / 2 - 46}px) scale(1.35)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(1)` },
      ], { duration: 300, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', fill: 'forwards' }).finished.then(() => {
        f.remove();
        pits[i]++;
        render(pits, false);
        haptic(4);
      });
      await sleep(Math.max(70, 260 - n * 12));
    }
    await sleep(320);
  }

  return {
    async update(s, { you: me, seq, prev, lastMove }) {
      you = me;
      const fresh = seq !== seen && seen !== -1 && lastMove?.seq === seq && prev && s.last && !preview;
      seen = seq;
      const canPlay = !preview && s.turn === you && s.winner == null;
      if (fresh && !reduced && lastMove.move?.type !== 'resign') await sow(prev, s.last);
      render(s.pits, canPlay);
    },
    destroy: off,
  };
}
