import { resolve, scores, TURN_MS, ON_FIRE } from '/shared/games/basketball.js';
import { stage, THREE, tween, ease, floatLabel, SHADOW } from '/js/three-kit.js';
import { haptic, reduced } from '/js/fx.js';
import { avatarHtml } from '/js/auth.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Metres. Regulation rim: 3.05 m up, 45 cm across, 15 cm out from a 1.8 m board.
const RIM_Y = 3.05, RIM_R = 0.23, RIM_Z = -3.6, BOARD_Z = -3.98, BALL_R = 0.12;
const HAND = new THREE.Vector3(0, 1.5, 0.5);

function ballTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#e8742c'); grad.addColorStop(1, '#c95a1b');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  // Pebbled leather.
  for (let k = 0; k < 9000; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * 512, Math.random() * 256, 1.4, 1.4); }
  g.strokeStyle = '#1b120c'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(0, 128); g.lineTo(512, 128); g.stroke();
  for (const x of [128, 384]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  for (const x0 of [0, 256]) {
    g.beginPath();
    for (let y = 0; y <= 256; y += 4) g.lineTo(x0 + 128 + Math.sin((y / 256) * Math.PI) * 70 * (x0 ? 1 : -1), y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    g.fillStyle = `hsl(${28 + (i % 3) * 2}, ${48 + (i % 4) * 3}%, ${46 + ((i * 7) % 5) * 2}%)`;
    g.fillRect(i * 32, 0, 32, 512);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(i * 32, 0, 1, 512);
    for (let k = 0; k < 3; k++) g.fillRect(i * 32, ((i * 131 + k * 173) % 512), 32, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}

export function mount(el, { send, preview }) {
  el.innerHTML = `
    <div class="g3">
      <div class="g3-hud"></div>
      <div class="g3-view g3-room" aria-label="Basketball hoop"></div>
      <p class="g3-hint"></p>
    </div>`;
  const view = el.querySelector('.g3-view'), hud = el.querySelector('.g3-hud'), hint = el.querySelector('.g3-hint');
  const kit = stage(view, { fov: 42, env: 0.4, near: 0.05, far: 200 });
  const { scene, camera } = kit;

  /* ---------- the gym ---------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.45 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const key = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 5.8), new THREE.MeshStandardMaterial({ color: '#23508f', roughness: 0.5 }));
  key.rotation.x = -Math.PI / 2;
  key.position.set(0, 0.003, BOARD_Z + 2.9);
  key.receiveShadow = true;
  scene.add(key);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), new THREE.MeshStandardMaterial({ color: '#1a1e27', roughness: 0.95 }));
  wall.position.set(0, 7, BOARD_Z - 2);
  scene.add(wall);

  const white = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.4 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.08, transparent: true, opacity: 0.32, clearcoat: 1 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.03), glass);
  board.position.set(0, 3.42, BOARD_Z);
  scene.add(board);
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.8, 1.05, 0.03)), new THREE.LineBasicMaterial({ color: '#ffffff' }));
  frame.position.copy(board.position);
  scene.add(frame);
  const square = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.59, 0.45)), new THREE.LineBasicMaterial({ color: '#ff5b2e' }));
  square.position.set(0, 3.33, BOARD_Z + 0.02);
  scene.add(square);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 16), new THREE.MeshStandardMaterial({ color: '#2b2f38', metalness: 0.6, roughness: 0.4 }));
  pole.position.set(0, 1.7, BOARD_Z - 0.9);
  scene.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.9), pole.material);
  arm.position.set(0, 3.3, BOARD_Z - 0.45);
  scene.add(arm);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_R, 0.011, 10, 48), new THREE.MeshStandardMaterial({ color: '#ff5a1f', metalness: 0.3, roughness: 0.35 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, RIM_Y, RIM_Z);
  rim.castShadow = true;
  scene.add(rim);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, RIM_Z - BOARD_Z - RIM_R), rim.material);
  bracket.position.set(0, RIM_Y - 0.01, (BOARD_Z + RIM_Z - RIM_R) / 2);
  scene.add(bracket);
  const net = new THREE.Mesh(new THREE.CylinderGeometry(RIM_R, 0.14, 0.42, 14, 4, true), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.85 }));
  net.position.set(0, RIM_Y - 0.21, RIM_Z);
  scene.add(net);

  scene.add(new THREE.HemisphereLight('#fff6ea', '#3a2a1c', 0.75));
  const lamp = new THREE.SpotLight('#fff3df', 60, 0, 0.75, 0.5, 1.6);
  lamp.position.set(0.8, 9, -1.5);
  lamp.target.position.set(0, 1.5, RIM_Z);
  scene.add(lamp, lamp.target);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(SHADOW, SHADOW);

  const ballGeo = new THREE.SphereGeometry(BALL_R, 32, 20), ballMat = new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.6 });
  const makeBall = () => { const b = new THREE.Mesh(ballGeo, ballMat); b.castShadow = true; scene.add(b); return b; };
  const ready = makeBall();
  ready.position.copy(HAND);

  const look = { x: 0, tx: 0 };
  kit.onFrame((dt, now) => {
    look.x += (look.tx - look.x) * 0.05;
    camera.position.set(look.x * 0.25, 1.7, 1.5);
    camera.lookAt(look.x * 0.1, 2.2, RIM_Z);
    // The waiting ball breathes a little in your hand.
    ready.position.y = HAND.y + Math.sin(now / 400) * 0.012;
    ready.rotation.y += dt * 0.6;
    tickClock();
  });

  let state = null, meta = null, seen = null, drag = null, lastSent = 0, localStart = null, streak = 0;
  const myTurn = () => !preview && state && meta && state.turn === meta.you && state.winner == null && meta.players.length === 2;

  /* ---------- a shot in the air ---------- */
  const arcTo = (b, from, to, apex, ms) => tween(kit, ms, (k) => {
    b.position.lerpVectors(from, to, k);
    b.position.y = from.y + (to.y - from.y) * k + 4 * (apex - Math.max(from.y, to.y)) * k * (1 - k);
    b.rotation.x -= 0.25;
  });
  const fall = (b, from, to, ms) => tween(kit, ms, (k) => {
    b.position.lerpVectors(from, to, k);
    b.position.y = from.y + (to.y - from.y) * ease.in(k);
    b.rotation.x -= 0.12;
  });
  const bounce = async (b, at) => {
    let h = 0.55;
    for (let n = 0; n < 2; n++, h *= 0.45) {
      const from = b.position.clone();
      await arcTo(b, from, from.clone().add(new THREE.Vector3(at.x * 0.3, 0, 0.35)).setY(BALL_R), BALL_R + h, 260 + n * 40);
    }
  };
  async function shoot(x, v, result) {
    const b = makeBall();
    b.position.copy(HAND);
    const side = Math.sign(x) || 1, rimTop = RIM_Y + BALL_R * 0.6;
    const ox = x * 1.1, oz = -(v - 1) * 1.8;
    if (reduced) { b.removeFromParent(); return; }
    if (result === 'swish' || result === 'rim-in') {
      if (result === 'rim-in') {
        await arcTo(b, HAND, new THREE.Vector3(side * (RIM_R - 0.03), rimTop + 0.02, RIM_Z + 0.05), 4.25, 640);
        haptic(6);
        await arcTo(b, b.position.clone(), new THREE.Vector3(side * 0.04, rimTop, RIM_Z), rimTop + 0.16, 230);
      } else {
        await arcTo(b, HAND, new THREE.Vector3(0, rimTop + 0.02, RIM_Z), 4.25, 660);
      }
      net.scale.set(1, 1.18, 1);
      fall(b, b.position.clone(), new THREE.Vector3(0, RIM_Y - 0.5, RIM_Z), 170).then(() => { net.scale.set(1, 1, 1); });
      await new Promise((r) => setTimeout(r, 170));
      await fall(b, b.position.clone(), new THREE.Vector3(0, BALL_R, RIM_Z + 0.2), 300);
      await bounce(b, { x: 0 });
    } else if (result === 'rim-out') {
      await arcTo(b, HAND, new THREE.Vector3(side * RIM_R, rimTop + 0.04, RIM_Z + (v < 1 ? 0.18 : -0.12)), 4.25, 640);
      haptic(10);
      await arcTo(b, b.position.clone(), new THREE.Vector3(side * 1.3, BALL_R, RIM_Z + 1.2), rimTop + 0.45, 620);
      await bounce(b, { x: side });
    } else if (v > 1 && Math.abs(x) < 0.5) {
      // Long: off the glass and down.
      await arcTo(b, HAND, new THREE.Vector3(ox, 3.55 + (v - 1) * 0.6, BOARD_Z + BALL_R + 0.02), 4.4 + (v - 1) * 0.8, 660);
      haptic(8);
      await fall(b, b.position.clone(), new THREE.Vector3(ox * 1.2, BALL_R, RIM_Z + 1.4), 560);
      await bounce(b, { x: ox });
    } else {
      // Short or wide: an airball.
      const land = new THREE.Vector3(ox * 1.6, BALL_R, Math.min(-1.2, RIM_Z + 0.5 - oz * 0.5));
      await arcTo(b, HAND, land, Math.min(4.1, 2.6 + v * 1.3), 760);
      await bounce(b, { x: ox });
    }
    await tween(kit, 260, (k) => { b.scale.setScalar(1 - k); });
    b.removeFromParent();
  }
  function announce(result, pts, streak) {
    const made = scores(result);
    const text = !made ? (result === 'rim-out' ? 'Rimmed out' : 'Miss') : `${streak > ON_FIRE ? 'On fire! ' : result === 'swish' ? 'Swish! ' : ''}+${pts}`;
    floatLabel(kit, new THREE.Vector3(0, RIM_Y + 0.55, RIM_Z), text, made ? 'great' : 'bad');
    if (made) haptic(streak > ON_FIRE ? [20, 30, 20, 30, 40] : [20, 30, 30]);
  }

  /* ---------- HUD and clock ---------- */
  const startedAt = () => state?.turnAt ?? (state?.turn === meta?.you ? localStart : null);
  function left() {
    const t0 = startedAt();
    return t0 == null ? TURN_MS : Math.max(0, TURN_MS - (Date.now() - t0));
  }
  let shownSecs = null;
  function tickClock() {
    if (!state || !meta) return;
    const clock = hud.querySelector('.bb-clock');
    if (!clock) return;
    const secs = Math.ceil(left() / 1000);
    if (secs === shownSecs) return;
    shownSecs = secs;
    clock.textContent = `0:${String(secs).padStart(2, '0')}`;
    clock.classList.toggle('low', state.phase === 'shoot' && secs <= 5);
  }
  function renderHud() {
    if (!state || !meta) return;
    const seat = (p) => {
      const pl = meta.players[p], active = state.turn === p && state.winner == null;
      return `<div class="g3-seat${active ? ' active' : ''}" style="--pc:${p === meta.you ? '#ef6a3a' : '#7cc4e6'}">
        ${pl ? avatarHtml(pl, 'sm') : '<span class="avatar initial empty">?</span>'}
        <span class="g3-name">${esc(p === meta.you ? 'You' : pl?.name ?? 'Waiting')}</span>
        <b class="num g3-big">${state.scores[p]}</b>
        <span class="g3-sub num">${state.made[p]}/${state.shots[p]}${state.done[p] ? ' · done' : ''}</span>
      </div>`;
    };
    const fire = state.streak >= ON_FIRE && state.winner == null;
    shownSecs = null;
    hud.innerHTML = `${seat(meta.you)}<div class="g3-mid"><b class="bb-clock num">0:30</b>${fire ? '<span class="g3-chip fire"><i class="ph-fill ph-fire"></i>On fire</span>' : ''}</div>${seat(1 - meta.you)}`;
    tickClock();
    const who = meta.players[state.turn]?.name ?? 'They';
    hint.textContent = preview ? ''
      : state.winner != null ? ''
      : myTurn() ? (state.phase === 'ready' && localStart == null ? 'Flick the ball up at the hoop. Your 30 seconds start with your first shot.' : 'Keep shooting! Flick straight up, not too soft, not too hard.')
      : state.phase === 'ready' ? `Waiting for ${who} to take their first shot…` : `${who} is shooting…`;
    ready.visible = myTurn() && left() > 0;
  }

  /* ---------- the flick ---------- */
  view.addEventListener('pointerdown', (e) => {
    if (!myTurn() || left() <= 0) return;
    view.setPointerCapture(e.pointerId);
    drag = { x0: e.clientX, y0: e.clientY, t0: e.timeStamp, samples: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }] };
  });
  view.addEventListener('pointermove', (e) => {
    const r = view.getBoundingClientRect();
    look.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    if (!drag) return;
    drag.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    if (drag.samples.length > 14) drag.samples.shift();
    ready.position.x = HAND.x + (e.clientX - drag.x0) * 0.0015;
  });
  view.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    ready.position.x = HAND.x;
    const dx = e.clientX - d.x0, dy = d.y0 - e.clientY; // upward positive
    const recent = d.samples.filter((s) => e.timeStamp - s.t < 120);
    const first = recent[0] ?? d.samples[0];
    // Speed at release, or over the whole swipe if the finger paused at the top.
    const vel = Math.max((first.y - e.clientY) / Math.max(16, e.timeStamp - first.t), dy / Math.max(16, e.timeStamp - d.t0));
    if (dy < 30) { hint.textContent = 'Flick upward to shoot.'; return; }
    if (performance.now() - lastSent < 280) return;
    lastSent = performance.now();
    // Power mixes how far and how fast you flick, so a tiny flick can't launch a full-court shot.
    const h = view.clientHeight || window.innerHeight;
    const v = +(0.55 * (dy / (0.42 * h)) + 0.45 * Math.min(1.6, vel / (0.0028 * h))).toFixed(3);
    const x = +Math.max(-1, Math.min(1, (dx / dy) * 2.4)).toFixed(3);
    if (state.phase === 'ready' && localStart == null) localStart = Date.now();
    const result = resolve(x, v);
    streak = scores(result) ? streak + 1 : 0;
    const pts = scores(result) ? (streak > ON_FIRE ? 3 : 2) : 0, run = streak;
    haptic(8);
    // Play it straight away; the server runs the same maths to score it.
    shoot(x, v, result).then(() => {});
    setTimeout(() => announce(result, pts, run), reduced ? 0 : 900);
    send({ type: 'shot', x, v }).then((r) => { if (r?.error) hint.textContent = r.error; });
    // Next ball pops up from below.
    if (!reduced) ready.scale.setScalar(0.4), tween(kit, 220, (k) => ready.scale.setScalar(0.4 + 0.6 * ease.out(k)));
  });
  view.addEventListener('pointercancel', () => { drag = null; ready.position.x = HAND.x; });
  view.addEventListener('pointerleave', () => { look.tx = 0; });

  return {
    update(s, m) {
      const lm = m.lastMove;
      const fresh = lm?.move?.type === 'shot' && lm.seq === m.seq && seen !== null && seen !== m.seq;
      const first = seen === null;
      seen = m.seq;
      state = s;
      meta = m;
      if (s.turn !== m.you || s.phase !== 'ready') localStart = null;
      if (s.turn !== m.you) streak = 0;
      renderHud();
      if (fresh && s.last && s.last.by !== m.you) {
        // Watch their shots live.
        shoot(s.last.x, s.last.v, s.last.result);
        setTimeout(() => announce(s.last.result, s.last.pts, s.last.streak), reduced ? 0 : 900);
      }
      if (first && preview) kit.freeze(view);
    },
    destroy() { kit.destroy(); },
  };
}
