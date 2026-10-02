import { FACE, RING, PER_END, ENDS, windDrift } from '/shared/games/archery.js';
import { stage, THREE, tween, ease, floatLabel } from '/js/three-kit.js';
import { haptic, reduced } from '/js/fx.js';
import { avatarHtml } from '/js/auth.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const RANGE = 18000; // mm from the archer to the target
const DRAW_MS = 800;

function targetTexture() {
  const S = 1024, C = S / 2, k = (C - 4) / FACE, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const bands = ['#f4f1ea', '#f4f1ea', '#1b1b1d', '#1b1b1d', '#2f8fd6', '#2f8fd6', '#e0362c', '#e0362c', '#f6c62a', '#f6c62a'];
  for (let i = 0; i < 10; i++) {
    g.fillStyle = bands[i];
    g.beginPath(); g.arc(C, C, (FACE - i * RING) * k, 0, Math.PI * 2); g.fill();
    g.strokeStyle = i === 2 || i === 3 ? '#f4f1ea' : '#1b1b1d';
    g.lineWidth = 2;
    g.stroke();
  }
  g.beginPath(); g.arc(C, C, (RING / 2) * k, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#1b1b1d'; g.fillRect(C - 6, C - 1, 12, 2); g.fillRect(C - 1, C - 6, 2, 12);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function makeArrow(color) {
  const a = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 780, 10).rotateX(Math.PI / 2).translate(0, 0, 390), new THREE.MeshStandardMaterial({ color: '#2b2b2e', roughness: 0.4, metalness: 0.4 }));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(6, 30, 10).rotateX(-Math.PI / 2).translate(0, 0, -5), new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 1, roughness: 0.3 }));
  const vaneM = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.6 });
  a.add(shaft, tip);
  const vane = new THREE.Shape();
  vane.moveTo(0, 0); vane.lineTo(22, 20); vane.lineTo(22, 90); vane.lineTo(0, 110); vane.closePath();
  for (let k = 0; k < 3; k++) a.add(new THREE.Mesh(new THREE.ShapeGeometry(vane).rotateX(Math.PI / 2).rotateZ((k * Math.PI * 2) / 3).translate(0, 0, 640), vaneM));
  a.traverse((m) => { m.castShadow = true; });
  return a;
}

export function mount(el, { send, preview }) {
  el.innerHTML = `
    <div class="g3">
      <div class="g3-hud"></div>
      <div class="g3-view g3-sky" aria-label="Archery range">
        <div class="wind"><i class="ph-fill ph-arrow-up"></i><span class="num"></span></div>
        <div class="drawbar"><i></i></div>
      </div>
      <p class="g3-hint"></p>
    </div>`;
  const view = el.querySelector('.g3-view'), hud = el.querySelector('.g3-hud'), hint = el.querySelector('.g3-hint');
  const windEl = el.querySelector('.wind'), drawEl = el.querySelector('.drawbar i');
  const kit = stage(view, { fov: 9, env: 0.6, exposure: 1.05, near: 300, far: 120000 });
  const { scene, camera } = kit;
  scene.fog = new THREE.Fog('#bcd3d9', 40000, 110000);

  // The range: grass, a tree line, the target on its straw boss, a flag that shows the wind.
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(80000, 120000), new THREE.MeshStandardMaterial({ color: '#4f7f3a', roughness: 1 }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -1300, -RANGE);
  grass.receiveShadow = true;
  scene.add(grass);
  const treeM = new THREE.MeshStandardMaterial({ color: '#2e5b2c', roughness: 1 });
  // A distant tree line, far enough back to sit softly behind the target.
  for (let k = -16; k <= 16; k++) {
    const h = 9000 + ((k * 7919) % 5) * 1500;
    const t = new THREE.Mesh(new THREE.ConeGeometry(2600, h, 7), treeM);
    t.position.set(k * 4200, -1300 + h / 2, -RANGE - 42000 - ((k * 31) % 4) * 3000);
    scene.add(t);
  }
  const target = new THREE.Group();
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(FACE + 90, FACE + 90, 300, 48).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c9a35c', roughness: 1 }));
  boss.position.z = -150;
  boss.castShadow = true;
  const face = new THREE.Mesh(new THREE.CircleGeometry(FACE, 96), new THREE.MeshStandardMaterial({ map: targetTexture(), roughness: 0.85 }));
  face.position.z = 12;
  const legM = new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.9 });
  for (const x of [-500, 500]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(60, 2400, 60), legM); leg.position.set(x, -700, -260); leg.rotation.x = 0.18; target.add(leg); }
  target.add(boss, face);
  target.position.set(0, 0, -RANGE);
  scene.add(target);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, 3500, 8), legM);
  pole.position.set(2600, 450, -RANGE + 2000);
  scene.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(900, 450, 12, 4), new THREE.MeshStandardMaterial({ color: '#ef6a3a', side: THREE.DoubleSide, roughness: 0.7 }));
  flag.geometry.translate(450, 0, 0);
  flag.position.set(2600, 1950, -RANGE + 2000);
  scene.add(flag);
  scene.add(new THREE.HemisphereLight('#e8f3ff', '#3a5a2a', 1.1));
  const sun = new THREE.DirectionalLight('#fff3dc', 1.8);
  sun.position.set(-6000, 9000, -RANGE + 6000);
  sun.target = target;
  sun.castShadow = true;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -3000;
  sun.shadow.camera.right = sun.shadow.camera.top = 3000;
  scene.add(sun);

  const sight = new THREE.Group();
  sight.add(new THREE.Mesh(new THREE.RingGeometry(70, 95, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 })));
  sight.add(new THREE.Mesh(new THREE.CircleGeometry(16, 20), new THREE.MeshBasicMaterial({ color: '#ff7a45' })));
  sight.position.set(0, 0, -RANGE + 40);
  sight.visible = false;
  scene.add(sight);

  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  kit.onFrame((dt, now) => {
    look.x += (look.tx - look.x) * 0.05;
    look.y += (look.ty - look.y) * 0.05;
    camera.position.set(look.x * 300, 250 + look.y * 200, 0);
    camera.lookAt(look.x * 120, look.y * 80, -RANGE);
    // The flag streams with the wind.
    if (state?.wind) {
      const w = state.wind, pos = flag.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setZ(i, Math.sin(x / 140 - now / (260 - w.speed * 12)) * (20 + w.speed * 6) * (x / 900));
      }
      pos.needsUpdate = true;
      flag.rotation.y = -((w.dir - 90) * Math.PI) / 180 * 0.6;
    }
  });

  let state = null, meta = null, seen = null, drawing = null, flying = false;
  const stuck = [];
  const colorFor = (p) => (p === meta?.you ? '#ef6a3a' : '#7cc4e6');
  const myTurn = () => !preview && state && meta && state.turn === meta.you && state.winner == null && !flying;

  function addStuck(a) {
    const arrow = makeArrow(colorFor(a.by));
    arrow.scale.setScalar(1.6);
    arrow.position.set(a.x, a.y, -RANGE - 40);
    arrow.rotation.set(0.04 + a.y / 30000, -a.x / 30000, 0);
    scene.add(arrow);
    stuck.push(arrow);
    return arrow;
  }
  function clearStuck() { stuck.splice(0).forEach((a) => scene.remove(a)); }

  async function fly(a) {
    flying = true;
    const arrow = addStuck(a);
    const end = arrow.position.clone(), start = new THREE.Vector3(a.x * 0.02, 150, -600);
    if (!reduced) {
      await tween(kit, 900, (k) => {
        const e = ease.out(k);
        arrow.position.lerpVectors(start, end, e);
        arrow.position.y += Math.sin(Math.PI * k) * 380;
        arrow.rotation.x = 0.04 - Math.cos(Math.PI * k) * 0.02;
      });
      haptic(a.pts >= 9 ? [15, 30, 15] : 12);
      const rest = arrow.rotation.clone();
      tween(kit, 700, (k) => { const w = Math.exp(-5 * k) * Math.sin(k * 30) * 0.03; arrow.rotation.set(rest.x + w, rest.y + w, rest.z); });
    }
    floatLabel(kit, new THREE.Vector3(a.x, a.y + 260, -RANGE), a.label, a.pts >= 9 ? 'great' : a.pts === 0 ? 'bad' : '');
    flying = false;
  }

  function renderHud() {
    if (!state || !meta) return;
    const seat = (p) => {
      const pl = meta.players[p], active = state.turn === p && state.winner == null;
      const pips = Array.from({ length: PER_END }, (_, k) => `<i class="${active && k < state.arrowsLeft ? 'on' : ''}"></i>`).join('');
      return `<div class="g3-seat${active ? ' active' : ''}" style="--pc:${colorFor(p)}">
        ${pl ? avatarHtml(pl, 'sm') : '<span class="avatar initial empty">?</span>'}
        <span class="g3-name">${esc(p === meta.you ? 'You' : pl?.name ?? 'Waiting')} · end ${Math.min(ENDS, state.ends[p] + (active ? 1 : 0))}/${ENDS}</span>
        <b class="num g3-big">${state.totals[p]}</b>
        <span class="g3-pips">${pips}</span>
      </div>`;
    };
    hud.innerHTML = `${seat(meta.you)}<div class="g3-mid">${state.arrows.map((a) => `<span class="g3-chip">${esc(a.label)}</span>`).join('') || '<span class="g3-chip ghost">10</span>'}</div>${seat(1 - meta.you)}`;
    const w = state.wind;
    windEl.querySelector('.ph-fill').style.transform = `rotate(${w.dir}deg)`;
    windEl.querySelector('span').textContent = `${w.speed.toFixed(1)} mph`;
    hint.textContent = preview ? '' : myTurn() ? 'Press and hold to draw, drag to aim, let go to shoot. Aim off for the wind.' : state.winner == null ? `${meta.players[state.turn]?.name ?? 'They'} is shooting…` : '';
  }

  /* ---------- draw, aim, release ---------- */
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), RANGE);
  const aimAt = (e) => kit.pickPlane(e.clientX, e.clientY, plane);
  view.addEventListener('pointerdown', (e) => {
    if (!myTurn()) return;
    view.setPointerCapture(e.pointerId);
    const p = aimAt(e);
    drawing = { t0: performance.now(), base: p ?? new THREE.Vector3(), phase: Math.random() * 6 };
    sight.visible = true;
  });
  view.addEventListener('pointermove', (e) => {
    const r = view.getBoundingClientRect();
    look.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    look.ty = -((e.clientY - r.top) / r.height - 0.5) * 2;
    if (!drawing) return;
    const p = aimAt(e);
    if (p) { if (e.pointerType === 'touch') p.y += 600; drawing.base = p; }
  });
  kit.onFrame((dt, now) => {
    if (!drawing) { drawEl.style.transform = 'scaleX(0)'; return; }
    const held = now - drawing.t0, draw = Math.min(1, held / DRAW_MS), hold = Math.max(0, held - DRAW_MS) / 1000;
    drawEl.style.transform = `scaleX(${draw})`;
    drawEl.classList.toggle('tired', hold > 4);
    // Sway grows once your arms have held full draw for a while.
    const amp = 18 + Math.max(0, hold - 2) * 40;
    drawing.x = drawing.base.x + Math.sin(now / 430 + drawing.phase) * amp;
    drawing.y = drawing.base.y + Math.sin(now / 310 + drawing.phase * 1.3) * amp;
    drawing.draw = draw;
    drawing.hold = hold;
    sight.position.set(drawing.x, drawing.y, -RANGE + 40);
  });
  view.addEventListener('pointerup', async () => {
    if (!drawing) return;
    const d = drawing;
    drawing = null;
    sight.visible = false;
    if (d.draw < 0.15 || d.x == null) { hint.textContent = 'Hold longer to draw the bow.'; return; }
    haptic(10);
    const r = await send({ type: 'shoot', x: +d.x.toFixed(1), y: +d.y.toFixed(1), draw: +d.draw.toFixed(3), hold: +d.hold.toFixed(2) });
    if (r?.error) renderHud();
  });
  view.addEventListener('pointercancel', () => { drawing = null; sight.visible = false; });

  return {
    async update(s, m) {
      state = s;
      meta = m;
      const lm = m.lastMove;
      const fresh = lm?.move?.type === 'shoot' && lm.seq === m.seq && seen !== null && seen !== m.seq;
      const first = seen === null;
      seen = m.seq;
      renderHud();
      if (first) { s.arrows.forEach(addStuck); if (preview) kit.freeze(view); return; }
      if (fresh && s.last) {
        await fly(s.last);
        if (!s.arrows.length) setTimeout(clearStuck, 1300);
        renderHud();
        return;
      }
      if (!s.arrows.length) clearStuck();
    },
    destroy() { kit.destroy(); },
  };
}

export { windDrift };
