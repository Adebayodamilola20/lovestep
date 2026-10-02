// Win celebration: two cannons fire from the bottom corners, then the pieces flutter down.
import { reduced, haptic } from './fx.js';

const COLORS = ['#ef6a3a', '#9fd3ef', '#f3c94b', '#f4efe4', '#3fbf7f', '#e9577a'];

export function celebrate({ count = 220, duration = 4200 } = {}) {
  if (reduced) return;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:80';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, h = 0;
  const size = () => {
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  addEventListener('resize', size);

  const scale = Math.min(1, w / 900) * 0.4 + 0.6;
  const pieces = Array.from({ length: count }, (_, i) => {
    const left = i % 2 === 0;
    // Fire up and inward at 48-80 degrees so the two bursts cross over the middle.
    const elev = (48 + Math.random() * 32) * (Math.PI / 180);
    const speed = (13 + Math.random() * 11) * scale * Math.min(1.25, h / 700);
    return {
      x: left ? -10 : w + 10,
      y: h * (0.78 + Math.random() * 0.1),
      vx: Math.cos(elev) * speed * (left ? 1 : -1),
      vy: -Math.sin(elev) * speed,
      w: 6 + Math.random() * 6,
      h: 9 + Math.random() * 9,
      round: Math.random() < 0.22,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      flip: Math.random() * Math.PI * 2,
      vflip: 0.08 + Math.random() * 0.14,
      sway: Math.random() * Math.PI * 2,
      delay: (i % 2 ? 0 : 60) + Math.floor(i / 2) * 2.2,
    };
  });

  haptic([30, 40, 30]);
  const t0 = performance.now();
  return new Promise((resolve) => {
    const frame = (now) => {
      const t = now - t0;
      ctx.clearRect(0, 0, w, h);
      let alive = false;
      for (const p of pieces) {
        if (t < p.delay) { alive = true; continue; }
        p.vy += 0.32;            // gravity
        p.vx *= 0.985;           // air drag
        p.vy = Math.min(p.vy, 4.2 + Math.sin(p.sway) * 0.8); // terminal flutter speed
        p.sway += 0.06;
        p.x += p.vx + Math.sin(p.sway) * 0.6;
        p.y += p.vy;
        p.rot += p.vr;
        p.flip += p.vflip;
        if (p.y > h + 30) continue;
        alive = true;
        const fade = Math.max(0, Math.min(1, (duration - t) / 600));
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        // Cosine squash fakes the piece turning over in 3D; the dark side shows as it flips.
        const turn = Math.cos(p.flip);
        ctx.scale(1, turn);
        ctx.fillStyle = turn < 0 ? shade(p.color) : p.color;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive && t < duration) requestAnimationFrame(frame);
      else { removeEventListener('resize', size); canvas.remove(); resolve(); }
    };
    requestAnimationFrame(frame);
  });
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v * 0.72);
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}
