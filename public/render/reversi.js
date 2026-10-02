import { legalMoves, count } from '/shared/games/reversi.js';
import { scene, cells } from '/js/board.js';
import { drop, reduced, EASE_IN_OUT } from '/js/fx.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function mount(el, { send, preview }) {
  const wrap = document.createElement('div');
  wrap.style.width = 'min(100%, 560px)';
  el.replaceChildren(wrap);
  const { surface, off } = scene(wrap, 'rev', { preview });
  const counts = document.createElement('div');
  counts.className = 'counts';
  wrap.append(counts);
  const sq = cells(surface, 64, { onClick: (i) => send({ i }) });
  let seen = -1;
  return {
    update(s, { you, seq, players }) {
      const fresh = seq !== seen;
      seen = seq;
      const mine = !preview && s.turn === you && s.winner == null ? new Set(legalMoves(s.board, you)) : new Set();
      const r0 = s.last != null ? s.last >> 3 : 0, c0 = s.last != null ? s.last & 7 : 0;
      sq.forEach((b, i) => {
        const v = s.board[i];
        b.disabled = !mine.has(i);
        b.classList.toggle('hint', mine.has(i));
        b.setAttribute('aria-label', v == null ? (mine.has(i) ? 'Legal move' : 'Empty') : v === 0 ? 'Dark disc' : 'Light disc');
        if (v == null) { b.innerHTML = ''; return; }
        const face = v === 0 ? 0 : 180;
        let d = b.querySelector('.disc');
        if (!d) {
          b.innerHTML = '<span class="pc"><span class="disc"><span class="f dark"></span><span class="f light"></span></span></span>';
          d = b.querySelector('.disc');
          d.style.setProperty('--face', `${face}deg`);
          if (fresh && i === s.last && !preview) drop(b.firstChild, { height: 60 });
        } else if (d.style.getPropertyValue('--face') !== `${face}deg`) {
          d.style.setProperty('--face', `${face}deg`);
          if (fresh && !reduced && !preview) {
            const dist = Math.max(Math.abs((i >> 3) - r0), Math.abs((i & 7) - c0));
            const from = face - 180;
            d.animate([
              { transform: `translateZ(3px) rotateY(${from}deg)` },
              { transform: `translateZ(34px) rotateY(${from + 90}deg)`, offset: 0.5 },
              { transform: `translateZ(3px) rotateY(${face}deg)` },
            ], { duration: 460, delay: 120 + dist * 70, easing: EASE_IN_OUT, fill: 'backwards' });
          }
        }
        d.classList.toggle('last', s.last === i);
      });
      const name = (p) => (p === you ? 'You' : players[p]?.name ?? 'Opponent');
      counts.innerHTML = [0, 1].map((p) => `<span><i style="background:${p ? 'var(--color-ivory)' : 'var(--color-ebony)'}"></i>${esc(name(p))} <b class="num">${count(s.board, p)}</b></span>`).join('');
    },
    destroy: off,
  };
}
