import { N } from '/shared/games/gomoku.js';
import { scene, cells } from '/js/board.js';
import { drop } from '/js/fx.js';

export function mount(el, { send, preview }) {
  const { surface, off } = scene(el, 'gomoku', { preview, html: '<div class="grid"></div>' });
  const pts = cells(surface.firstElementChild, N * N, { onClick: (i) => send({ i }) });
  let seen = -1;
  return {
    update(s, { you, seq }) {
      const fresh = seq !== seen;
      seen = seq;
      pts.forEach((b, i) => {
        const v = s.board[i];
        b.disabled = preview || v != null || s.turn !== you || s.winner != null;
        if (v == null) { b.innerHTML = ''; return; }
        if (!b.firstChild) {
          b.innerHTML = '<span class="stone"></span>';
          if (fresh && i === s.last && !preview) drop(b.firstChild, { height: 70 });
        }
        const st = b.firstChild;
        st.dataset.p = v;
        st.classList.toggle('last', s.last === i && s.winner == null);
        st.classList.toggle('win', !!s.line?.includes(i));
      });
    },
    destroy: off,
  };
}
