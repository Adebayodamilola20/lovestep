import { drift } from './fx.js';

/** A tilted, spring-reactive surface. Returns the surface element and a cleanup. */
export function scene(el, surfaceClass, { sceneClass = '', preview = false, html = '' } = {}) {
  el.innerHTML = `<div class="scene ${sceneClass}"><div class="surface slab ${surfaceClass}">${html}</div></div>`;
  const sc = el.firstElementChild;
  const surface = sc.firstElementChild;
  const off = preview ? () => {} : drift(surface, sc);
  return { sc, surface, off };
}

/** Local (pre-transform) offset between two grid cells, for arc moves on a tilted board. */
export function cellDelta(fromEl, toEl) {
  return { dx: fromEl.offsetLeft - toEl.offsetLeft, dy: fromEl.offsetTop - toEl.offsetTop };
}

export function cells(parent, count, { cls = 'cellbtn', onClick, tag = 'button' } = {}) {
  return Array.from({ length: count }, (_, i) => {
    const b = document.createElement(tag);
    b.className = cls;
    if (tag === 'button') b.type = 'button';
    if (onClick) b.addEventListener('click', () => onClick(i));
    parent.append(b);
    return b;
  });
}
