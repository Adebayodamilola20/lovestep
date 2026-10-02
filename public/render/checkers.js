import { legalMoves } from '/shared/games/checkers.js';
import { scene, cells, cellDelta } from '/js/board.js';
import { arc, haptic, reduced } from '/js/fx.js';

const tokenHtml = (pc) => `<span class="pc"><span class="token${pc.k ? ' king' : ''}" data-p="${pc.p}">${pc.k ? '<i class="ph-fill ph-crown-simple"></i>' : ''}</span></span>`;

export function mount(el, { send, preview }) {
  const { surface, off } = scene(el, 'wood-board chk', { preview });
  let state = null, you = 0, selected = null, seen = -1;
  // Flip so your pieces are always nearest you.
  const idx = (d) => (you === 1 ? 63 - d : d);
  const sq = cells(surface, 64, { onClick: (d) => click(idx(d)) });
  const at = (i) => sq[you === 1 ? 63 - i : i];
  const moves = () => (!preview && state && state.turn === you && state.winner == null ? legalMoves(state, you) : []);

  function click(i) {
    const ms = moves();
    const go = selected != null && ms.find((m) => m.from === selected && m.to === i);
    if (go) { haptic(10); selected = null; draw(); send({ from: go.from, to: go.to }); return; }
    selected = ms.some((m) => m.from === i) && selected !== i ? i : null;
    if (selected != null) haptic(6);
    draw();
  }

  function draw() {
    const ms = moves();
    if (state.chain != null && state.turn === you) selected = state.chain;
    const targets = new Set(ms.filter((m) => m.from === selected).map((m) => m.to));
    const movable = new Set(ms.map((m) => m.from));
    sq.forEach((b, d) => {
      const i = idx(d), pc = state.board[i];
      b.className = `cellbtn ${((i >> 3) + (i & 7)) % 2 ? 'dark' : 'light'}`;
      b.classList.toggle('sel', i === selected);
      b.classList.toggle('target', targets.has(i));
      b.classList.toggle('last', !!state.last && (state.last.from === i || state.last.to === i));
      b.disabled = !targets.has(i) && !movable.has(i);
      const key = pc ? `${pc.p}${pc.k ? 'k' : ''}` : '';
      if (b.dataset.k !== key) { b.dataset.k = key; b.innerHTML = pc ? tokenHtml(pc) : ''; }
    });
  }

  function animateLast() {
    const { from, to, cap } = state.last;
    const toB = at(to), fromB = at(from);
    const { dx, dy } = cellDelta(fromB, toB);
    arc(toB.querySelector('.pc'), dx, dy, { lift: 56, duration: 440 });
    if (cap != null && !reduced) {
      const mover = state.board[to]?.p ?? 0;
      const ghost = document.createElement('span');
      ghost.innerHTML = tokenHtml({ p: 1 - mover, k: false });
      const g = ghost.firstChild;
      at(cap).append(g);
      g.animate([
        { transform: 'translateZ(0)', opacity: 1 },
        { transform: 'translateZ(90px) rotateX(70deg)', opacity: 0 },
      ], { duration: 520, delay: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'both' }).finished.then(() => g.remove()).catch(() => g.remove());
    }
  }

  return {
    update(s, meta) {
      const fresh = meta.seq !== seen && seen !== -1;
      seen = meta.seq;
      state = s;
      you = meta.you;
      selected = null;
      draw();
      if (fresh && s.last && !preview) animateLast();
    },
    destroy: off,
  };
}
