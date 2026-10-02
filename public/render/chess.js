import { legalMoves, colorOf } from '/shared/games/chess.js';
import { scene, cells, cellDelta } from '/js/board.js';
import { arc, haptic, reduced } from '/js/fx.js';

const GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
const START = { P: 8, N: 2, B: 2, R: 2, Q: 1 };
const pieceHtml = (pc) => `<span class="pc"><span class="piece" data-c="${pc[0]}"><span class="base"></span><span class="glyph">${GLYPH[pc[1]]}&#xFE0E;</span></span></span>`;

export function mount(el, { send, preview }) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:min(100%,600px);position:relative';
  el.replaceChildren(wrap);
  const { surface, off } = scene(wrap, 'wood-board chs', { preview });
  const capturedEl = document.createElement('div');
  capturedEl.className = 'captured';
  wrap.append(capturedEl);
  let state = null, you = 0, selected = null, seen = -1;
  const idx = (d) => (you === 1 ? 63 - d : d);
  const sq = cells(surface, 64, { onClick: (d) => click(idx(d)) });
  const at = (i) => sq[you === 1 ? 63 - i : i];
  const moves = () => (!preview && state && state.turn === you && state.winner == null ? legalMoves(state, you) : []);

  function promote(mv) {
    const col = colorOf(you);
    const overlay = document.createElement('div');
    overlay.className = 'promo';
    overlay.innerHTML = `<div role="dialog" aria-label="Promote to">${['Q', 'R', 'B', 'N'].map((p) => `<button type="button" data-p="${p}" style="color:${col === 'w' ? 'var(--color-ivory)' : 'var(--color-ebony)'}">${GLYPH[p]}&#xFE0E;</button>`).join('')}</div>`;
    overlay.addEventListener('click', (e) => {
      const p = e.target.closest('[data-p]')?.dataset.p;
      overlay.remove();
      if (p) send({ from: mv.from, to: mv.to, promo: p });
    });
    wrap.append(overlay);
    overlay.querySelector('button').focus();
  }

  function click(i) {
    const ms = moves();
    const go = selected != null && ms.find((m) => m.from === selected && m.to === i);
    if (go) {
      haptic(10);
      selected = null;
      draw();
      const pc = state.board[go.from];
      if (pc[1] === 'P' && (go.to >> 3 === 0 || go.to >> 3 === 7)) return promote(go);
      return send({ from: go.from, to: go.to });
    }
    selected = ms.some((m) => m.from === i) && selected !== i ? i : null;
    if (selected != null) haptic(6);
    draw();
  }

  function draw() {
    const ms = moves();
    const targets = new Set(ms.filter((m) => m.from === selected).map((m) => m.to));
    const movable = new Set(ms.map((m) => m.from));
    const checkSq = state.check ? state.board.indexOf(colorOf(state.turn) + 'K') : -1;
    sq.forEach((b, d) => {
      const i = idx(d), r = i >> 3, c = i & 7, pc = state.board[i];
      b.className = `cellbtn ${(r + c) % 2 ? 'dark' : 'light'}`;
      b.classList.toggle('sel', i === selected);
      b.classList.toggle('target', targets.has(i));
      b.classList.toggle('cap', targets.has(i) && !!pc);
      b.classList.toggle('check', i === checkSq);
      b.classList.toggle('last', !!state.last && (state.last.from === i || state.last.to === i));
      b.disabled = !targets.has(i) && !movable.has(i);
      b.setAttribute('aria-label', `${'abcdefgh'[c]}${8 - r}${pc ? ' ' + pc : ''}`);
      const key = (pc || '') + (d % 8 === 0 ? 'r' : '') + (d >= 56 ? 'f' : '') + you;
      if (b.dataset.k !== key) {
        b.dataset.k = key;
        b.innerHTML = (pc ? pieceHtml(pc) : '') +
          (d % 8 === 0 ? `<span class="coord r">${8 - r}</span>` : '') +
          (d >= 56 ? `<span class="coord f">${'abcdefgh'[c]}</span>` : '');
      }
    });
    // Pieces you've taken, shown in their colour.
    const opp = colorOf(1 - you), have = {};
    for (const pc of state.board) if (pc?.[0] === opp) have[pc[1]] = (have[pc[1]] || 0) + 1;
    capturedEl.innerHTML = Object.entries(START).map(([k, n]) => `${GLYPH[k]}&#xFE0E;`.repeat(Math.max(0, n - (have[k] || 0)))).join('');
  }

  function animateLast() {
    const { from, to } = state.last;
    const toB = at(to);
    const { dx, dy } = cellDelta(at(from), toB);
    arc(toB.querySelector('.pc'), dx, dy, { lift: 70, duration: 460 });
    const pc = state.board[to];
    if (pc?.[1] === 'K' && Math.abs((from & 7) - (to & 7)) === 2) {
      const rookTo = to > from ? to - 1 : to + 1, rookFrom = to > from ? to + 1 : to - 2;
      const d2 = cellDelta(at(rookFrom), at(rookTo));
      arc(at(rookTo).querySelector('.pc'), d2.dx, d2.dy, { lift: 50, duration: 460, delay: 120 });
    }
  }

  return {
    update(s, meta) {
      const fresh = meta.seq !== seen && seen !== -1;
      seen = meta.seq;
      state = s;
      you = meta.you;
      selected = null;
      wrap.querySelector('.promo')?.remove();
      draw();
      if (fresh && s.last && !preview && !reduced) animateLast();
    },
    destroy: off,
  };
}
