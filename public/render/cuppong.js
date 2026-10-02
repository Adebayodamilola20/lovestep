import { CUPS, CUP_R, BALLS, RACK_D } from '/shared/games/cuppong.js';
import { stage, THREE, tween, ease, floatLabel } from '/js/three-kit.js';
import { haptic, reduced } from '/js/fx.js';
import { avatarHtml } from '/js/auth.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const CUP_H = 120, BALL_R = 20, TABLE_L = 2440, TABLE_W = 610;

function makeCup() {
  const cup = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(CUP_R, 31, CUP_H, 36, 1, true), new THREE.MeshPhysicalMaterial({ color: '#d32a2a', roughness: 0.35, clearcoat: 0.6, side: THREE.FrontSide }));
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(CUP_R - 1.5, 29.5, CUP_H - 2, 36, 1, true), new THREE.MeshStandardMaterial({ color: '#f3f1ec', roughness: 0.5, side: THREE.BackSide }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(CUP_R, 2.4, 8, 36).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f6f4ef', roughness: 0.4 }));
  rim.position.y = CUP_H / 2;
  const drink = new THREE.Mesh(new THREE.CircleGeometry(CUP_R - 8, 32).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#d99a2b', roughness: 0.1, transmission: 0.2, clearcoat: 1 }));
  drink.position.y = 6;
  cup.add(outer, inner, rim, drink);
  cup.traverse((m) => { m.castShadow = true; m.receiveShadow = true; });
  return cup;
}

export function mount(el, { send, preview }) {
  el.innerHTML = `
    <div class="g3">
      <div class="g3-hud"></div>
      <div class="g3-view g3-room" aria-label="Cup pong table"></div>
      <p class="g3-hint"></p>
    </div>`;
  const view = el.querySelector('.g3-view'), hud = el.querySelector('.g3-hud'), hint = el.querySelector('.g3-hint');
  const kit = stage(view, { fov: 30, env: 0.45, near: 20, far: 20000 });
  const { scene, camera } = kit;

  // The table runs away from the thrower along -z. Distances are mm.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), new THREE.MeshStandardMaterial({ color: '#3b2b22', roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -760;
  floor.receiveShadow = true;
  scene.add(floor);
  const top = new THREE.Mesh(new THREE.BoxGeometry(TABLE_W, 30, TABLE_L), new THREE.MeshPhysicalMaterial({ color: '#1f4f8f', roughness: 0.3, clearcoat: 0.8 }));
  top.position.set(0, -15, -TABLE_L / 2);
  top.receiveShadow = true;
  scene.add(top);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(TABLE_W, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f3f1ec' }));
  stripe.position.set(0, 1, -TABLE_L / 2);
  scene.add(stripe);
  for (const x of [-TABLE_W / 2 + 40, TABLE_W / 2 - 40]) for (const z of [-120, -TABLE_L + 120]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 740, 10), new THREE.MeshStandardMaterial({ color: '#2a2a2a', metalness: 0.7, roughness: 0.4 }));
    leg.position.set(x, -400, z);
    scene.add(leg);
  }
  scene.add(new THREE.HemisphereLight('#fff4e6', '#20160f', 0.7));
  const lamp = new THREE.SpotLight('#ffe9c9', 3, 0, 0.7, 0.6, 0);
  lamp.position.set(0, 2400, -1400);
  lamp.target = top;
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  scene.add(lamp);

  const cups = CUPS.map(() => { const c = makeCup(); scene.add(c); return c; });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#fbfaf6', roughness: 0.2, clearcoat: 1 }));
  ball.castShadow = true;
  scene.add(ball);
  const HAND = new THREE.Vector3(0, 250, -760);

  const look = { x: 0, tx: 0 };
  kit.onFrame(() => {
    look.x += (look.tx - look.x) * 0.06;
    // Low and close behind the throw, so the rack fills the view like it does over a real table.
    camera.position.set(look.x * 90, 430, -150);
    camera.lookAt(look.x * 30, 20, -RACK_D - 120);
  });

  let state = null, meta = null, seen = null, flying = false, drag = null;
  const target = () => state.cups[1 - state.turn]; // the rack being thrown at
  const myTurn = () => !preview && state && meta && state.turn === meta.you && state.winner == null && !flying;

  function placeCups(alive) {
    CUPS.forEach((c, i) => {
      cups[i].visible = !!alive[i];
      cups[i].position.set(c.x, CUP_H / 2, -c.d);
      cups[i].scale.setScalar(1);
    });
  }
  function resetBall() {
    ball.visible = myTurn();
    ball.position.copy(HAND);
  }

  async function fly(last) {
    flying = true;
    const land = new THREE.Vector3(last.x, CUP_H, -last.d);
    const cup = last.cup >= 0 ? cups[last.cup] : null;
    ball.visible = true;
    const start = HAND.clone();
    if (!reduced) {
      await tween(kit, 820, (k) => {
        ball.position.lerpVectors(start, land, k);
        ball.position.y = start.y + (land.y - start.y) * k + Math.sin(Math.PI * k) * 700;
      });
      const at = ball.position.clone();
      if (last.result === 'swish' || last.result === 'rattle') {
        if (last.result === 'rattle') {
          // Roll around the rim before dropping in.
          await tween(kit, 520, (k) => {
            const a = k * Math.PI * 3;
            ball.position.set(cup.position.x + Math.cos(a) * (CUP_R - 6), CUP_H + 4 - k * 6, cup.position.z + Math.sin(a) * (CUP_R - 6));
          });
        }
        haptic([20, 30, 20]);
        await tween(kit, 260, (k) => { ball.position.set(cup.position.x, CUP_H - ease.in(k) * 90, cup.position.z); });
        ball.visible = false;
        await tween(kit, 450, (k) => { cup.position.y = CUP_H / 2 + ease.out(k) * 220; cup.scale.setScalar(1 - k * 0.6); });
        cup.visible = false;
      } else {
        haptic(8);
        // Bounce off (a rim, or the table) and roll away down the table.
        const dir = new THREE.Vector3(cup ? at.x - cup.position.x : (Math.random() - 0.5) * 200, 0, cup ? at.z - cup.position.z : -300).normalize();
        await tween(kit, 700, (k) => {
          ball.position.set(at.x + dir.x * k * 600, Math.max(BALL_R, at.y + Math.sin(Math.PI * Math.min(1, k * 1.4)) * 160 - k * at.y), at.z + dir.z * k * 600 - k * 200);
        });
        ball.visible = false;
      }
    }
    const label = { swish: 'Swish!', rattle: 'Rattled in!', rim: 'Off the rim', miss: 'Miss' }[last.result];
    floatLabel(kit, land.clone().setY(CUP_H + 200), label, last.result === 'swish' || last.result === 'rattle' ? 'great' : 'bad');
    flying = false;
  }

  function renderHud() {
    if (!state || !meta) return;
    const seat = (p) => {
      const pl = meta.players[p], active = state.turn === p && state.winner == null;
      const left = state.cups[p].filter(Boolean).length;
      const pips = Array.from({ length: BALLS }, (_, k) => `<i class="${active && k < state.ballsLeft ? 'on' : ''}"></i>`).join('');
      return `<div class="g3-seat${active ? ' active' : ''}" style="--pc:${p === meta.you ? '#ef6a3a' : '#7cc4e6'}">
        ${pl ? avatarHtml(pl, 'sm') : '<span class="avatar initial empty">?</span>'}
        <span class="g3-name">${esc(p === meta.you ? 'Your cups' : `${pl?.name ?? 'Their'}'s cups`)}</span>
        <b class="num g3-big">${left}</b>
        <span class="g3-pips">${pips}</span>
      </div>`;
    };
    hud.innerHTML = `${seat(meta.you)}<div class="g3-mid">${state.msg ? `<span class="g3-chip">${esc(state.msg)}</span>` : '<span class="g3-chip ghost">vs</span>'}</div>${seat(1 - meta.you)}`;
    hint.textContent = preview ? '' : myTurn() ? 'Swipe the ball up toward the cups. A longer swipe throws further; about half the screen reaches the middle cups.' : state.winner == null ? `${meta.players[state.turn]?.name ?? 'They'} is throwing at ${state.turn === meta.you ? 'their' : 'your'} cups…` : '';
  }

  /* ---------- the flick ---------- */
  view.addEventListener('pointerdown', (e) => {
    if (!myTurn()) return;
    view.setPointerCapture(e.pointerId);
    drag = { samples: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }], samples0: { x: e.clientX, y: e.clientY } };
  });
  view.addEventListener('pointermove', (e) => {
    const r = view.getBoundingClientRect();
    look.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    if (!drag) return;
    drag.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    if (drag.samples.length > 14) drag.samples.shift();
    ball.position.set(HAND.x + (e.clientX - drag.samples[0].x) * 0.6, HAND.y, HAND.z);
  });
  view.addEventListener('pointerup', async (e) => {
    if (!drag) return;
    const pts = drag.samples.filter((s) => e.timeStamp - s.t < 150);
    const a = pts[0] ?? drag.samples[0], drag0 = drag.samples0;
    drag = null;
    const dx = e.clientX - a.x, dy = e.clientY - a.y, dt = Math.max(16, e.timeStamp - a.t);
    if (dy > -30) { resetBall(); hint.textContent = 'Flick upward to throw.'; return; }
    // Power is mostly how far you swipe (steady and easy to control), plus a little of how fast.
    // A short flick lands short; about half the screen reaches the middle of the rack.
    const h = view.clientHeight || window.innerHeight;
    const reach = -(e.clientY - drag0.y) / (0.45 * h), speed = (-dy / dt) / (0.0026 * h);
    const p = 0.75 * reach + 0.25 * Math.min(speed, 1.6);
    const x = Math.max(-600, Math.min(600, ((e.clientX - drag0.x) / -(e.clientY - drag0.y)) * 1100));
    const d = Math.max(900, Math.min(3300, 1500 + p * (RACK_D + 120 - 1500)));
    haptic(10);
    const r = await send({ type: 'throw', x: +x.toFixed(1), d: +d.toFixed(1) });
    if (r?.error) resetBall();
  });
  view.addEventListener('pointercancel', () => { drag = null; resetBall(); });

  return {
    async update(s, m) {
      state = s;
      meta = m;
      const lm = m.lastMove;
      const fresh = lm?.move?.type === 'throw' && lm.seq === m.seq && m.prev && seen !== null && seen !== m.seq;
      const first = seen === null;
      seen = m.seq;
      renderHud();
      if (fresh && s.last) {
        // Show the throw against the rack as it stood before it.
        placeCups(m.prev.cups[1 - s.last.by]);
        await fly(s.last);
      }
      placeCups(target());
      resetBall();
      renderHud();
      if (first && preview) kit.freeze(view);
    },
    destroy() { kit.destroy(); },
  };
}
