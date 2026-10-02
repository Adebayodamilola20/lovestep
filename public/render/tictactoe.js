import { scene, cells } from '/js/board.js';

const X = '<svg viewBox="0 0 100 100" aria-hidden="true"><path pathLength="1" d="M22 22 78 78"/><path pathLength="1" d="M78 22 22 78"/></svg>';
const O = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle pathLength="1" cx="50" cy="50" r="30" transform="rotate(-90 50 50)"/></svg>';

export function mount(el, { send, preview }) {
  const { surface, off } = scene(el, 'ttt', { preview, sceneClass: 'ttt-scene' });
  const sq = cells(surface, 9, { onClick: (i) => send({ i }) });
  let seen = -1;
  return {
    update(s, { you, seq }) {
      const fresh = seq !== seen;
      seen = seq;
      sq.forEach((b, i) => {
        const v = s.board[i];
        b.disabled = preview || v != null || s.turn !== you || s.winner != null;
        b.classList.toggle('win', !!s.line?.includes(i));
        b.setAttribute('aria-label', `Square ${i + 1}${v == null ? ', empty' : v === 0 ? ', X' : ', O'}`);
        if (String(v ?? '') === b.dataset.p) return;
        b.dataset.p = v ?? '';
        b.innerHTML = v == null ? '' : v === 0 ? X : O;
        if (fresh && i === s.last) b.querySelector('svg')?.classList.add('draw');
      });
    },
    destroy: off,
  };
}
