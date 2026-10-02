import { R, C } from '/shared/games/dots.js';
import { scene } from '/js/board.js';

const S = 64, M = 16, NS = 'http://www.w3.org/2000/svg';

export function mount(el, { send, preview }) {
  const wrap = document.createElement('div');
  wrap.style.width = 'min(100%, 500px)';
  el.replaceChildren(wrap);
  const w = C * S + 2 * M, h = R * S + 2 * M;
  const { surface, off } = scene(wrap, 'dots-card', { preview, html: `<svg viewBox="0 0 ${w} ${h}" role="group" aria-label="Dots and boxes board"></svg>` });
  const svg = surface.querySelector('svg');
  const mk = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    svg.append(n);
    return n;
  };
  const boxes = [], labels = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    boxes.push(mk('rect', { class: 'box', x: M + c * S + 6, y: M + r * S + 6, width: S - 12, height: S - 12, rx: 8, fill: 'transparent' }));
    labels.push(mk('text', { x: M + c * S + S / 2, y: M + r * S + S / 2 }));
  }
  let canPlay = false, seen = -1;
  const line = (kind, r, c, x1, y1, x2, y2) => {
    const hit = mk('line', { class: 'hit', x1, y1, x2, y2 });
    const ln = mk('line', { class: 'ln', x1, y1, x2, y2, pathLength: 1 });
    hit.addEventListener('click', () => canPlay && send({ kind, r, c }));
    return { hit, ln, kind, r, c };
  };
  const hs = [], vs = [];
  for (let r = 0; r <= R; r++) for (let c = 0; c < C; c++) hs.push(line('h', r, c, M + c * S, M + r * S, M + (c + 1) * S, M + r * S));
  for (let r = 0; r < R; r++) for (let c = 0; c <= C; c++) vs.push(line('v', r, c, M + c * S, M + r * S, M + c * S, M + (r + 1) * S));
  for (let r = 0; r <= R; r++) for (let c = 0; c <= C; c++) mk('circle', { class: 'dot', cx: M + c * S, cy: M + r * S, r: 5.5 });

  return {
    update(s, { you, players, seq }) {
      const fresh = seq !== seen;
      seen = seq;
      canPlay = !preview && s.turn === you && s.winner == null;
      const paint = (arr, vals) => arr.forEach((l) => {
        const v = vals[l.kind === 'h' ? l.r * C + l.c : l.r * (C + 1) + l.c];
        const isLast = s.last && s.last.kind === l.kind && s.last.r === l.r && s.last.c === l.c;
        l.ln.setAttribute('class', `ln${v == null ? '' : ' p' + v}${isLast && fresh && !preview ? ' fresh' : ''}`);
        l.hit.style.display = v == null && canPlay ? '' : 'none';
      });
      paint(hs, s.h);
      paint(vs, s.v);
      s.boxes.forEach((o, i) => {
        boxes[i].setAttribute('fill', o == null ? 'transparent' : o === 0 ? 'var(--color-you)' : 'oklch(55% 0.12 230)');
        boxes[i].style.opacity = o == null ? 0 : 0.92;
        labels[i].textContent = o == null ? '' : (players[o]?.name?.[0] ?? '').toUpperCase();
      });
    },
    destroy: off,
  };
}
