// Shared motion: spring tilt, arcs, flights. Everything respects reduced motion live.
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
export let reduced = mq.matches;
mq.addEventListener('change', (e) => { reduced = e.matches; });

export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
export const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';
export const EASE_FALL = 'cubic-bezier(0.55, 0, 1, 0.45)';
export const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export function haptic(ms = 12) {
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}

/**
 * Spring-driven tilt toward the pointer. Writes --rx / --ry (deg) on `target`.
 * Decorative, so it's skipped for reduced motion and coarse pointers.
 */
export function tilt(surface, { target = surface, max = 6, stiffness = 0.08, damping = 0.78 } = {}) {
  if (!finePointer) return () => {};
  let tx = 0, ty = 0, x = 0, y = 0, vx = 0, vy = 0, raf = 0;
  const tick = () => {
    vx = (vx + (tx - x) * stiffness) * damping;
    vy = (vy + (ty - y) * stiffness) * damping;
    x += vx; y += vy;
    target.style.setProperty('--rx', `${y.toFixed(3)}deg`);
    target.style.setProperty('--ry', `${x.toFixed(3)}deg`);
    raf = Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(vx) + Math.abs(vy) > 0.01 ? requestAnimationFrame(tick) : 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const move = (e) => {
    if (reduced) return;
    const r = surface.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2 * max;
    ty = -((e.clientY - r.top) / r.height - 0.5) * 2 * max;
    kick();
  };
  const leave = () => { tx = 0; ty = 0; kick(); };
  surface.addEventListener('pointermove', move);
  surface.addEventListener('pointerleave', leave);
  return () => {
    surface.removeEventListener('pointermove', move);
    surface.removeEventListener('pointerleave', leave);
    cancelAnimationFrame(raf);
  };
}

/**
 * Board drift: the table leans with the pointer as you move around the page, and holds
 * perfectly still while the pointer is over the board so aiming at a square stays precise.
 */
export function drift(target, hold, { max = 3 } = {}) {
  if (!finePointer) return () => {};
  let tx = 0, ty = 0, x = 0, y = 0, vx = 0, vy = 0, raf = 0;
  const tick = () => {
    vx = (vx + (tx - x) * 0.06) * 0.8;
    vy = (vy + (ty - y) * 0.06) * 0.8;
    x += vx; y += vy;
    target.style.setProperty('--rx', `${y.toFixed(3)}deg`);
    target.style.setProperty('--ry', `${x.toFixed(3)}deg`);
    raf = Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(vx) + Math.abs(vy) > 0.01 ? requestAnimationFrame(tick) : 0;
  };
  const move = (e) => {
    if (reduced) return;
    const r = hold.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      // Freeze exactly where it is so the square under the pointer can't slide away.
      tx = x; ty = y; vx = vy = 0;
      return;
    }
    tx = (e.clientX / innerWidth - 0.5) * 2 * max;
    ty = -(e.clientY / innerHeight - 0.5) * 2 * max;
    if (!raf) raf = requestAnimationFrame(tick);
  };
  window.addEventListener('pointermove', move);
  return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf); };
}

/** Lift-and-place: element travels from (dx, dy) local px back to its slot along an arc. */
export function arc(el, dx, dy, { lift = 48, duration = 420, delay = 0 } = {}) {
  if (reduced || (!dx && !dy)) return fade(el, 150);
  return el.animate([
    { transform: `translate3d(${dx}px, ${dy}px, 0)` },
    { transform: `translate3d(${dx / 2}px, ${dy / 2}px, ${lift}px)`, offset: 0.5 },
    { transform: 'translate3d(0, 0, 0)' },
  ], { duration, delay, easing: EASE_IN_OUT, fill: 'backwards' }).finished.catch(() => {});
}

/** Drop from above onto the surface (stones, discs, shells). */
export function drop(el, { height = 90, duration = 380, delay = 0 } = {}) {
  if (reduced) return fade(el, 150);
  return el.animate([
    { transform: `translate3d(0, 0, ${height}px) scale(1.12)`, opacity: 0 },
    { opacity: 1, offset: 0.25 },
    { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
  ], { duration, delay, easing: EASE_FALL, fill: 'backwards' }).finished.catch(() => {});
}

export function fade(el, duration = 200) {
  return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: 'linear', fill: 'backwards' }).finished.catch(() => {});
}

/**
 * FLIP between two screen rects for elements that change parent (cards to the pile).
 * `from` is a DOMRect captured before the DOM change.
 */
export function flyFrom(el, from, { duration = 520, rotate = 0, flip = false, lift = 60, suffix = '' } = {}) {
  if (reduced || !from) return fade(el, 150);
  const to = el.getBoundingClientRect();
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const s = from.width / (to.width || 1);
  const fy = flip ? 180 : 0;
  return el.animate([
    { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${s}) rotateZ(${rotate}deg) rotateY(${fy}deg)${suffix}` },
    { transform: `translate3d(${dx * 0.45}px, ${dy * 0.45}px, ${lift}px) scale(${(s + 1) / 2 * 1.06}) rotateZ(${rotate / 2}deg) rotateY(${fy / 2}deg)${suffix}`, offset: 0.5 },
    { transform: `translate3d(0, 0, 0) scale(1) rotateZ(0deg) rotateY(0deg)${suffix}` },
  ], { duration, easing: EASE_OUT, fill: 'backwards' }).finished.catch(() => {});
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
