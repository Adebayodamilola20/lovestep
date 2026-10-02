import { ORDER, RINGS, PER_TURN } from '/shared/games/darts.js';
import { stage, THREE, tween, ease, floatLabel } from '/js/three-kit.js';
import { haptic, reduced } from '/js/fx.js';
import { avatarHtml } from '/js/auth.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const FACE = 19; // board face, mm in front of the wall
const COL = { black: '#1d1c1a', cream: '#eadcb8', red: '#c3311f', green: '#1d7a3f', wire: '#b9bcbf' };

/** Paint the board from the same regulation measurements the server scores with. */
function boardTexture() {
  const S = 2048, C = S / 2, k = (C - 6) / RINGS.board;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#121212';
  g.beginPath(); g.arc(C, C, RINGS.board * k, 0, Math.PI * 2); g.fill();
  const ring = (r0, r1, a0, a1, color) => {
    g.fillStyle = color;
    g.beginPath(); g.arc(C, C, r1 * k, a0, a1); g.arc(C, C, r0 * k, a1, a0, true); g.closePath(); g.fill();
  };
  for (let i = 0; i < 20; i++) {
    const a0 = ((i * 18 - 9 - 90) * Math.PI) / 180, a1 = a0 + (18 * Math.PI) / 180;
    const dark = i % 2 === 0;
    ring(RINGS.outerBull, RINGS.trebleIn, a0, a1, dark ? COL.black : COL.cream);
    ring(RINGS.trebleIn, RINGS.trebleOut, a0, a1, dark ? COL.red : COL.green);
    ring(RINGS.trebleOut, RINGS.doubleIn, a0, a1, dark ? COL.black : COL.cream);
    ring(RINGS.doubleIn, RINGS.doubleOut, a0, a1, dark ? COL.red : COL.green);
  }
  ring(RINGS.bull, RINGS.outerBull, 0, Math.PI * 2, COL.green);
  ring(0, RINGS.bull, 0, Math.PI * 2, COL.red);
  // The wire spider.
  g.strokeStyle = COL.wire;
  g.lineWidth = 3;
  for (const r of [RINGS.bull, RINGS.outerBull, RINGS.trebleIn, RINGS.trebleOut, RINGS.doubleIn, RINGS.doubleOut]) { g.beginPath(); g.arc(C, C, r * k, 0, Math.PI * 2); g.stroke(); }
  for (let i = 0; i < 20; i++) {
    const a = ((i * 18 - 9 - 90) * Math.PI) / 180;
    g.beginPath();
    g.moveTo(C + Math.cos(a) * RINGS.outerBull * k, C + Math.sin(a) * RINGS.outerBull * k);
    g.lineTo(C + Math.cos(a) * RINGS.doubleOut * k, C + Math.sin(a) * RINGS.doubleOut * k);
    g.stroke();
  }
  // Numbers on the outer ring, upright as on a real board.
  g.fillStyle = '#f2efe8';
  g.font = `700 ${Math.round(30 * k)}px Geist Variable, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  ORDER.forEach((n, i) => {
    const a = ((i * 18 - 90) * Math.PI) / 180, r = 197 * k;
    g.fillText(String(n), C + Math.cos(a) * r, C + Math.sin(a) * r);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function makeDart(color) {
  // Built along +z: tip at the origin pointing into the board (-z), flights toward the thrower.
  const dart = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#d8dadc', metalness: 1, roughness: 0.25 });
  const tung = new THREE.MeshStandardMaterial({ color: '#80858b', metalness: 1, roughness: 0.32 });
  const shaftM = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.4 });
  const flightM = new THREE.MeshStandardMaterial({ color, roughness: 0.5, side: THREE.DoubleSide });
  const part = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; dart.add(m); return m; };
  part(new THREE.ConeGeometry(1.1, 30, 12).rotateX(-Math.PI / 2).translate(0, 0, 15), steel);
  part(new THREE.CylinderGeometry(3.4, 2.8, 48, 20).rotateX(Math.PI / 2).translate(0, 0, 54), tung);
  for (let k = 0; k < 6; k++) part(new THREE.TorusGeometry(3.45, 0.4, 6, 20).translate(0, 0, 38 + k * 6.5), tung);
  part(new THREE.CylinderGeometry(1.6, 1.9, 38, 12).rotateX(Math.PI / 2).translate(0, 0, 97), shaftM);
  const fin = new THREE.Shape();
  fin.moveTo(0, 0); fin.lineTo(17, 14); fin.lineTo(17, 40); fin.lineTo(0, 46); fin.lineTo(-17, 40); fin.lineTo(-17, 14); fin.closePath();
  for (const turn of [0, Math.PI / 2]) part(new THREE.ShapeGeometry(fin).rotateX(Math.PI / 2).rotateZ(turn).translate(0, 0, 104), flightM);
  return dart;
}

export function mount(el, { send, preview }) {
  el.innerHTML = `
    <div class="g3">
      <div class="g3-hud"></div>
      <div class="g3-view" aria-label="Dartboard"></div>
      <p class="g3-hint"></p>
    </div>`;
  const view = el.querySelector('.g3-view'), hud = el.querySelector('.g3-hud'), hint = el.querySelector('.g3-hint');
  const kit = stage(view, { fov: 32, env: 0.3, near: 50, far: 20000 });
  const { scene, camera } = kit;

  // Room: a dark wall, the board on its backboard, a warm light above.
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(6000, 4000), new THREE.MeshStandardMaterial({ color: '#1a201d', roughness: 0.95 }));
  wall.position.z = -40;
  wall.receiveShadow = true;
  scene.add(wall);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(300, 300, 18, 64), new THREE.MeshStandardMaterial({ color: '#3a2414', roughness: 0.6 }));
  back.rotation.x = Math.PI / 2;
  back.position.z = -30;
  back.receiveShadow = true;
  scene.add(back);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(228, 228, 38, 96), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.7 }));
  body.rotation.x = Math.PI / 2;
  body.position.z = 0;
  body.castShadow = true;
  body.receiveShadow = true;
  // The printed face sits on its own disc, flush with the front of the board.
  scene.add(body);
  const face = new THREE.Mesh(new THREE.CircleGeometry(RINGS.board, 96), new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.92 }));
  face.position.z = FACE + 0.2;
  face.receiveShadow = true;
  scene.add(face);
  scene.add(new THREE.HemisphereLight('#f4ead8', '#0b0f0d', 0.6));
  const lamp = new THREE.SpotLight('#fff1d9', 2.4, 0, 0.5, 0.6, 0);
  lamp.position.set(0, 1100, 1300);
  lamp.target = face;
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  scene.add(lamp);

  const reticle = new THREE.Group();
  reticle.add(new THREE.Mesh(new THREE.RingGeometry(6, 8.5, 40), new THREE.MeshBasicMaterial({ color: '#ff7a45' })));
  reticle.add(new THREE.Mesh(new THREE.CircleGeometry(2, 16), new THREE.MeshBasicMaterial({ color: '#ffffff' })));
  reticle.position.z = FACE + 1;
  reticle.visible = false;
  scene.add(reticle);

  // Camera framing: the whole board with breathing room, a slight upward look for depth.
  let dist = 1800;
  const sway = { x: 0, y: 0, tx: 0, ty: 0 };
  kit.onResize(({ w, h }) => {
    const need = 820, vfov = (camera.fov * Math.PI) / 180;
    const fitH = need / 2 / Math.tan(vfov / 2), fitW = need / 2 / (Math.tan(vfov / 2) * (w / h));
    dist = Math.max(fitH, fitW);
  });
  kit.onFrame(() => {
    sway.x += (sway.tx - sway.x) * 0.06;
    sway.y += (sway.ty - sway.y) * 0.06;
    // Slightly off to the side and below, so darts read as solid objects sticking out of the board.
    camera.position.set(dist * 0.16 + sway.x * 50, -dist * 0.12 + sway.y * 35, dist);
    camera.lookAt(0, 0, 0);
  });

  let state = null, meta = null, seen = null, aiming = null, flying = false;
  const stuck = []; // dart meshes in the board this turn
  const colorFor = (p) => (p === meta?.you ? '#ef6a3a' : '#7cc4e6');
  const myTurn = () => !preview && state && meta && state.turn === meta.you && state.winner == null && !flying;

  function addStuck(d, animateIn = false) {
    const dart = makeDart(colorFor(d.by));
    dart.scale.setScalar(1.35);
    const tiltX = (d.y / RINGS.board) * 0.18 + 0.05, tiltY = -(d.x / RINGS.board) * 0.18;
    dart.position.set(d.x, d.y, FACE - 5); // tip buried a few mm
    dart.rotation.set(tiltX, tiltY, 0);
    dart.userData.rest = dart.rotation.clone();
    scene.add(dart);
    stuck.push(dart);
    return dart;
  }

  function clearStuck() {
    const gone = stuck.splice(0);
    if (!gone.length) return;
    tween(kit, reduced ? 1 : 380, (k) => gone.forEach((d) => { d.position.z = FACE - 5 + ease.in(k) * 500; d.scale.setScalar(1 - k * 0.4); })).then(() => gone.forEach((d) => scene.remove(d)));
  }

  async function fly(d) {
    flying = true;
    const dart = addStuck(d);
    const end = dart.position.clone(), endRot = dart.rotation.clone();
    const start = new THREE.Vector3(d.by === meta.you ? 60 : -60, -420, dist * 0.55);
    if (!reduced) {
      await tween(kit, 420, (k) => {
        const e = ease.out(k);
        dart.position.lerpVectors(start, end, e);
        dart.position.y += Math.sin(Math.PI * k) * 120;
        dart.rotation.set(endRot.x + (1 - e) * 0.6, endRot.y, (1 - e) * 2.2);
      });
      haptic(d.pts ? 18 : 8);
      // Wobble as the tip bites.
      const rest = dart.rotation.clone();
      tween(kit, 650, (k) => { const w = Math.exp(-6 * k) * Math.sin(k * 34) * 0.09; dart.rotation.set(rest.x + w, rest.y + w * 0.6, rest.z); });
    }
    floatLabel(kit, new THREE.Vector3(d.x, d.y + 40, FACE), d.bust ? 'Bust' : d.pts ? `${d.label}${d.label === String(d.pts) ? '' : ` · ${d.pts}`}` : 'Miss', d.bust ? 'bad' : d.ring === 'treble' || d.ring === 'bull' ? 'great' : '');
    flying = false;
  }

  function renderHud() {
    if (!state || !meta) return;
    const seat = (p) => {
      const pl = meta.players[p];
      const active = state.turn === p && state.winner == null;
      const pips = Array.from({ length: PER_TURN }, (_, k) => `<i class="${active && k < state.dartsLeft ? 'on' : ''}"></i>`).join('');
      return `<div class="g3-seat${active ? ' active' : ''}" style="--pc:${colorFor(p)}">
        ${pl ? avatarHtml(pl, 'sm') : '<span class="avatar initial empty">?</span>'}
        <span class="g3-name">${esc(p === meta.you ? 'You' : pl?.name ?? 'Waiting')}</span>
        <b class="num g3-big">${state.scores[p]}</b>
        <span class="g3-pips">${pips}</span>
      </div>`;
    };
    const thrown = state.darts.map((d) => `<span class="g3-chip">${esc(d.label)}</span>`).join('');
    hud.innerHTML = `${seat(meta.you)}<div class="g3-mid">${thrown || '<span class="g3-chip ghost">301</span>'}</div>${seat(1 - meta.you)}`;
    hint.textContent = preview ? '' : myTurn() ? 'Hold to aim, then flick up to throw. Soft flicks drop low, hard ones fly high.' : state.winner == null ? `${meta.players[state.turn]?.name ?? 'They'} is throwing…` : '';
  }

  /* ---------- aiming and the flick ---------- */
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -FACE);
  const aimFrom = (e) => {
    const p = kit.pickPlane(e.clientX, e.clientY, plane);
    if (!p) return null;
    if (e.pointerType === 'touch') p.y += 60; // keep the target visible above the finger
    return p;
  };
  view.addEventListener('pointerdown', (e) => {
    if (!myTurn()) return;
    view.setPointerCapture(e.pointerId);
    const p = aimFrom(e);
    aiming = { start: performance.now(), base: p, samples: [{ y: e.clientY, t: e.timeStamp }], phase: Math.random() * 6 };
    reticle.visible = true;
    haptic(4);
  });
  view.addEventListener('pointermove', (e) => {
    const r = view.getBoundingClientRect();
    sway.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    sway.ty = -((e.clientY - r.top) / r.height - 0.5) * 2;
    if (!aiming) return;
    // Event timestamps, not handler time: a busy frame must not make a fast flick look slow.
    aiming.samples.push({ y: e.clientY, t: e.timeStamp });
    if (aiming.samples.length > 12) aiming.samples.shift();
    // The aim follows the finger until it starts flicking upward.
    const recent = aiming.samples.slice(-3);
    const rising = recent.length === 3 && recent[0].y - recent[2].y > 6;
    if (!rising) { const p = aimFrom(e); if (p) aiming.base = p; }
  });
  kit.onFrame((dt, now) => {
    if (!aiming || !aiming.base) return;
    // A steady hand drifts a little; the longer you hold, the more it drifts.
    const held = Math.min(3, (now - aiming.start) / 1000), amp = 4 + held * 3.2;
    aiming.x = aiming.base.x + Math.sin(now / 520 + aiming.phase) * amp;
    aiming.y = aiming.base.y + Math.sin(now / 370 + aiming.phase * 1.7) * amp;
    reticle.position.set(aiming.x, aiming.y, FACE + 1);
  });
  const release = async (e) => {
    if (!aiming) return;
    const a = aiming;
    aiming = null;
    reticle.visible = false;
    const pts = a.samples.filter((s) => e.timeStamp - s.t < 120);
    const first = pts[0] ?? a.samples[a.samples.length - 1], lastS = { y: e.clientY, t: e.timeStamp };
    const vel = (first.y - lastS.y) / Math.max(16, lastS.t - first.t); // px/ms, upward positive
    const ideal = 0.0019 * window.innerHeight;
    if (vel < ideal * 0.25 || a.x == null) { hint.textContent = 'Flick upward to throw.'; return; }
    const v = Math.max(0.2, Math.min(2.5, vel / ideal));
    const r = await send({ type: 'throw', x: +a.x.toFixed(1), y: +a.y.toFixed(1), v: +v.toFixed(3) });
    if (r?.error) renderHud();
  };
  view.addEventListener('pointerup', release);
  view.addEventListener('pointercancel', () => { aiming = null; reticle.visible = false; });
  view.addEventListener('pointerleave', () => { sway.tx = 0; sway.ty = 0; });

  return {
    async update(s, m) {
      state = s;
      meta = m;
      const lm = m.lastMove;
      const fresh = lm?.move?.type === 'throw' && lm.seq === m.seq && seen !== null && seen !== m.seq;
      const first = seen === null;
      seen = m.seq;
      renderHud();
      if (first) {
        s.darts.forEach((d) => addStuck(d));
        if (preview) kit.freeze(view);
        return;
      }
      if (fresh && s.last) {
        await fly(s.last);
        if (!s.darts.length || s.last.bust) setTimeout(clearStuck, 1100);
        renderHud();
        return;
      }
      if (!s.darts.length) clearStuck();
    },
    destroy() { kit.destroy(); },
  };
}
