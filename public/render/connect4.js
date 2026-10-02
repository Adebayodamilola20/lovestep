import { W, H } from '/shared/games/connect4.js';
import { scene } from '/js/board.js';
import { reduced, haptic, EASE_FALL } from '/js/fx.js';

export function mount(el, { send, preview }) {
  const { surface, off } = scene(el, 'c4', {
    preview, sceneClass: 'c4-scene',
    html: `<div class="c4-grid">${'<div class="c4-col"></div>'.repeat(W)}</div><div class="c4-face"></div><div class="c4-hit">${Array.from({ length: W }, (_, c) => `<button type="button" aria-label="Drop in column ${c + 1}"></button>`).join('')}</div>`,
  });
  const cols = [...surface.querySelectorAll('.c4-col')];
  const hits = [...surface.querySelectorAll('.c4-hit button')];
  hits.forEach((b, col) => b.addEventListener('click', () => send({ col })));
  const discs = new Map();
  let seen = -1;

  function fall(disc, row) {
    if (reduced) return;
    const dy = -(disc.offsetTop + disc.offsetHeight + 24);
    disc.animate([
      { transform: `translateY(${dy}px)`, easing: EASE_FALL },
      { transform: 'translateY(0)', offset: 0.8, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
      { transform: `translateY(${-Math.min(14, 4 + row * 2)}px)`, offset: 0.9, easing: EASE_FALL },
      { transform: 'translateY(0)' },
    ], { duration: 380 + row * 55, fill: 'backwards' }).finished.then(() => haptic(10)).catch(() => {});
  }

  return {
    update(s, { you, seq }) {
      const fresh = seq !== seen;
      seen = seq;
      const canPlay = !preview && s.turn === you && s.winner == null;
      hits.forEach((b, c) => { b.disabled = !canPlay || s.board[c] != null; });
      s.board.forEach((v, i) => {
        let d = discs.get(i);
        if (v == null) { d?.remove(); discs.delete(i); return; }
        const row = Math.floor(i / W), col = i % W;
        if (!d) {
          d = document.createElement('div');
          d.className = 'c4-disc';
          d.style.setProperty('--r', row + 1);
          cols[col].append(d);
          discs.set(i, d);
          if (fresh && i === s.last && !preview) requestAnimationFrame(() => fall(d, row));
        }
        d.dataset.p = v;
        d.classList.toggle('win', !!s.line?.includes(i));
      });
    },
    destroy: off,
  };
}
