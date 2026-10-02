import { W, H, R, MAXV, HEAD, shotStart, groupOf, remaining, validCuePlacement } from '/shared/games/pool.js';
import { PoolTable } from '/js/pool3d.js';
import { haptic } from '/js/fx.js';

const COLORS = { 1: '#f0b20a', 2: '#1645b5', 3: '#cf2a1f', 4: '#56288f', 5: '#ea6a0e', 6: '#0f7a3d', 7: '#7d1b20', 8: '#151515' };
const colorOf = (id) => COLORS[id > 8 ? id - 8 : id];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function mount(el, { send }) {
  el.innerHTML = `
    <div class="pool">
      <div class="pool-groups"></div>
      <div class="pool-wrap">
        <div class="pool-view" aria-label="Pool table"></div>
        <div class="pool-power" role="slider" aria-label="Shot power" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">
          <div class="track"><div class="fill"></div></div>
          <div class="grip"><i class="ph ph-arrow-down"></i></div>
        </div>
      </div>
      <div class="pool-controls">
        <p class="pool-hint"></p>
        <button class="btn btn-quiet pool-cam" type="button"><i class="ph ph-camera-rotate"></i><span>Cue view</span></button>
      </div>
    </div>`;
  const view = el.querySelector('.pool-view');
  const powerEl = el.querySelector('.pool-power');
  const fillEl = powerEl.querySelector('.fill');
  const gripEl = powerEl.querySelector('.grip');
  const hintEl = el.querySelector('.pool-hint');
  const groupsEl = el.querySelector('.pool-groups');
  const camBtn = el.querySelector('.pool-cam');
  const table = new PoolTable(view);

  let state = null, meta = null;
  let angle = 0, power = 0, mode = null, startY = 0, lastX = 0;
  let pending = false, animating = null, seenSeq = null;

  const myTurn = () => state && meta && state.turn === meta.you && state.winner == null && !pending && !animating;

  function legalTarget(id) {
    const g = state.groups?.[meta.you];
    if (!g) return state.breakShot || id !== 8;
    return groupOf(id) === (remaining(state.balls, g) === 0 ? '8' : g);
  }

  function syncAim() {
    table.setAim({ angle, power, visible: myTurn(), legalTarget, hand: myTurn() && state.ballInHand });
    powerEl.classList.toggle('off', !myTurn());
    powerEl.setAttribute('aria-valuenow', Math.round(power * 100));
    fillEl.style.transform = `scaleY(${power})`;
    gripEl.style.transform = `translateY(${power * 100}%)`;
  }

  /* aim and ball-in-hand */
  view.addEventListener('pointerdown', (e) => {
    if (!myTurn()) return;
    view.setPointerCapture(e.pointerId);
    lastX = e.clientX;
    const p = table.pick(e.clientX, e.clientY), c = table.cueBall();
    if (state.ballInHand && p && c && (p.x - c.x) ** 2 + (p.y - c.y) ** 2 < (R * 3) ** 2) mode = 'place';
    else { mode = 'aim'; aimAt(e); }
  });
  view.addEventListener('pointermove', (e) => {
    const r = view.getBoundingClientRect();
    table.setSway(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2);
    if (!mode || !myTurn()) return;
    if (mode === 'aim') aimAt(e);
    else if (mode === 'place') {
      const p = table.pick(e.clientX, e.clientY);
      if (!p) return;
      const x = Math.min(Math.max(p.x, R), state.breakShot ? HEAD.x : W - R), y = Math.min(Math.max(p.y, R), H - R);
      if (validCuePlacement(state, x, y)) { Object.assign(table.cueBall(), { x, y }); table.setBalls(table.balls); syncAim(); }
    }
  });
  const end = () => { mode = null; };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
  view.addEventListener('pointerleave', () => table.setSway(0, 0));

  function aimAt(e) {
    if (table.view === 'cue') {
      // Behind the cue, a horizontal drag turns the shot: precise on a phone.
      angle += (e.clientX - lastX) * 0.0035;
      lastX = e.clientX;
    } else {
      const p = table.pick(e.clientX, e.clientY), c = table.cueBall();
      if (!p || !c || (p.x === c.x && p.y === c.y)) return;
      angle = Math.atan2(p.y - c.y, p.x - c.x);
    }
    syncAim();
  }

  /* power: pull the grip down, let go to shoot */
  powerEl.addEventListener('pointerdown', (e) => {
    if (!myTurn()) return;
    powerEl.setPointerCapture(e.pointerId);
    mode = 'power';
    startY = e.clientY;
  });
  powerEl.addEventListener('pointermove', (e) => {
    if (mode !== 'power') return;
    const next = Math.min(1, Math.max(0, (e.clientY - startY) / (powerEl.clientHeight * 0.85)));
    if (Math.floor(next * 10) !== Math.floor(power * 10)) haptic(4);
    power = next;
    syncAim();
  });
  powerEl.addEventListener('pointerup', () => {
    if (mode !== 'power') return;
    mode = null;
    const p = power;
    power = 0;
    if (p < 0.03 || !myTurn()) return syncAim();
    shoot(p);
  });
  powerEl.addEventListener('pointercancel', () => { mode = null; power = 0; syncAim(); });
  powerEl.addEventListener('keydown', (e) => {
    if (!myTurn()) return;
    if (e.key === 'ArrowDown') { power = Math.min(1, power + 0.05); syncAim(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { power = Math.max(0, power - 0.05); syncAim(); e.preventDefault(); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (power >= 0.03) { const p = power; power = 0; shoot(p); } }
  });

  window.addEventListener('keydown', onKey);
  function onKey(e) {
    if (!myTurn() || e.target.closest?.('input, textarea')) return;
    const step = e.shiftKey ? 0.002 : 0.02;
    if (e.key === 'ArrowLeft') { angle -= step; syncAim(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { angle += step; syncAim(); e.preventDefault(); }
  }

  camBtn.addEventListener('click', () => {
    table.setView(table.view === 'top' ? 'cue' : 'top');
    camBtn.querySelector('span').textContent = table.view === 'top' ? 'Cue view' : 'Overhead';
    renderHud();
  });

  async function shoot(p) {
    const v = Math.max(0.6, p * MAXV);
    const move = { type: 'shot', vx: Math.cos(angle) * v, vy: Math.sin(angle) * v };
    if (state.ballInHand) move.cue = { x: table.cueBall().x, y: table.cueBall().y };
    haptic(18);
    pending = true;
    syncAim();
    renderHud();
    const r = await send(move);
    if (r.error) { pending = false; syncAim(); renderHud(); }
  }

  function renderHud() {
    if (!state || !meta) return;
    groupsEl.innerHTML = [meta.you, 1 - meta.you].map((p) => {
      const g = state.groups?.[p];
      const name = p === meta.you ? 'You' : meta.players[p]?.name ?? 'Opponent';
      const ids = g ? state.balls.filter((b) => b.on && groupOf(b.id) === g).map((b) => b.id) : [];
      const balls = !g ? '<span class="open">Open table</span>'
        : (ids.length ? ids : [8]).map((id) => `<i class="mini${id > 8 ? ' stripe' : ''}" style="--c:${colorOf(id)}"></i>`).join('');
      return `<div class="grp${state.turn === p && state.winner == null ? ' active' : ''}" style="--pc:var(${p === meta.you ? '--color-you' : '--color-them'})"><b>${esc(name)}</b>${balls}</div>`;
    }).join('');
    hintEl.textContent = !myTurn() ? ''
      : (state.ballInHand ? (state.breakShot ? 'Place the cue ball behind the line. ' : 'Ball in hand: drag the white ball. ') : '')
        + (table.view === 'cue' ? 'Drag sideways to aim.' : 'Drag on the table to aim.') + ' Pull the cue down, let go to shoot.';
  }

  return {
    update(s, m) {
      state = s;
      meta = m;
      if (animating) return animating;
      const lm = m.lastMove;
      const fresh = lm?.move?.type === 'shot' && lm.seq === m.seq && m.prev && seenSeq !== null && lm.seq !== seenSeq;
      seenSeq = m.seq;
      if (fresh) {
        renderHud();
        syncAim();
        animating = table.playShot(shotStart(m.prev, lm.move), lm.move.vx, lm.move.vy).then(() => {
          animating = null;
          pending = false;
          table.setBalls(state.balls);
          syncAim();
          renderHud();
          if (table.view === 'cue') table.frame();
        });
        return animating;
      }
      pending = false;
      table.setBalls(s.balls);
      syncAim();
      renderHud();
    },
    destroy() {
      window.removeEventListener('keydown', onKey);
      table.destroy();
    },
  };
}
