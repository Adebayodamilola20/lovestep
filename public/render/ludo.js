import { PATH, LANES, HOME, squareOf, legal } from '/shared/games/ludo.js';
import { stage, THREE, tween, ease, floatLabel, SHADOW } from '/js/three-kit.js';
import { haptic, reduced } from '/js/fx.js';
import { avatarHtml } from '/js/auth.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Classic board colours; red and yellow are the two of you, green and blue are just the board.
const HUE = { red: '#e0443e', green: '#2fa35a', yellow: '#f2c230', blue: '#2f7fd6' };
const PLAYER_HUE = [HUE.red, HUE.yellow];
const W = (c) => c - 7; // board square (col or row) -> world units, board centred on 0

function boardTexture() {
  const S = 70, c = document.createElement('canvas');
  c.width = c.height = S * 15;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f3ea';
  g.fillRect(0, 0, c.width, c.height);
  const cell = (col, row, fill, stroke = '#cfc6b4') => {
    g.fillStyle = fill; g.fillRect(col * S, row * S, S, S);
    g.strokeStyle = stroke; g.lineWidth = 2; g.strokeRect(col * S + 1, row * S + 1, S - 2, S - 2);
  };
  // The four yards.
  const yard = (col, row, hue) => {
    g.fillStyle = hue; g.fillRect(col * S, row * S, 6 * S, 6 * S);
    g.fillStyle = '#fbf8f1'; g.beginPath(); g.roundRect(col * S + S * 0.75, row * S + S * 0.75, S * 4.5, S * 4.5, S * 0.5); g.fill();
    for (const [dx, dy] of [[2, 2], [4, 2], [2, 4], [4, 4]]) {
      g.fillStyle = hue; g.globalAlpha = 0.9; g.beginPath(); g.arc((col + dx) * S, (row + dy) * S, S * 0.62, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.stroke();
    }
  };
  yard(0, 0, HUE.red); yard(9, 0, HUE.green); yard(9, 9, HUE.yellow); yard(0, 9, HUE.blue);
  // Track and home lanes.
  for (const [col, row] of PATH) cell(col, row, '#fffdf8');
  const lane = (sq, hue) => sq.forEach(([col, row]) => cell(col, row, hue, '#00000022'));
  lane(LANES[0], HUE.red); lane(LANES[1], HUE.yellow);
  lane([[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], HUE.green); lane([[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], HUE.blue);
  // Start squares in each colour, stars on the safe squares.
  cell(...PATH[0], HUE.red, '#00000022'); cell(...PATH[13], HUE.green, '#00000022'); cell(...PATH[26], HUE.yellow, '#00000022'); cell(...PATH[39], HUE.blue, '#00000022');
  const star = (col, row) => {
    const cx = (col + 0.5) * S, cy = (row + 0.5) * S;
    g.beginPath();
    for (let k = 0; k < 10; k++) { const r = k % 2 ? S * 0.16 : S * 0.34, a = -Math.PI / 2 + (k * Math.PI) / 5; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    g.closePath(); g.fillStyle = '#b9ad94'; g.fill();
  };
  for (const i of [8, 21, 34, 47]) star(...PATH[i]);
  // Arrows into each start square.
  // The centre: four triangles meeting in the middle.
  const tri = (hue, pts) => { g.fillStyle = hue; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x * S, y * S) : g.moveTo(x * S, y * S))); g.closePath(); g.fill(); };
  tri(HUE.red, [[6, 6], [7.5, 7.5], [6, 9]]); tri(HUE.green, [[6, 6], [9, 6], [7.5, 7.5]]);
  tri(HUE.yellow, [[9, 6], [9, 9], [7.5, 7.5]]); tri(HUE.blue, [[6, 9], [7.5, 7.5], [9, 9]]);
  g.strokeStyle = '#3b3328'; g.lineWidth = 6; g.strokeRect(3, 3, c.width - 6, c.height - 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function dieFace(n) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, 128, 128);
  const at = { 1: [[64, 64]], 2: [[34, 34], [94, 94]], 3: [[30, 30], [64, 64], [98, 98]], 4: [[34, 34], [94, 34], [34, 94], [94, 94]], 5: [[32, 32], [96, 32], [64, 64], [32, 96], [96, 96]], 6: [[34, 28], [94, 28], [34, 64], [94, 64], [34, 100], [94, 100]] }[n];
  g.fillStyle = n === 1 ? '#d9332e' : '#1d1b18';
  for (const [x, y] of at) { g.beginPath(); g.arc(x, y, n === 1 ? 16 : 11, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Box faces in three.js order (+x, -x, +y, -y, +z, -z) and the turn that brings each number to the top.
const FACES = [1, 6, 2, 5, 3, 4];
const UP = { 1: [0, 0, Math.PI / 2], 6: [0, 0, -Math.PI / 2], 2: [0, 0, 0], 5: [Math.PI, 0, 0], 3: [-Math.PI / 2, 0, 0], 4: [Math.PI / 2, 0, 0] };

function makePiece(hue) {
  const pts = [[0, 0], [0.34, 0], [0.34, 0.06], [0.24, 0.12], [0.15, 0.36], [0.12, 0.52], [0.2, 0.6], [0.2, 0.64], [0.1, 0.68], [0.17, 0.8], [0.15, 0.92], [0.06, 0.99], [0, 1]].map(([x, y]) => new THREE.Vector2(x, y * 0.95));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), new THREE.MeshPhysicalMaterial({ color: hue, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
  m.castShadow = true;
  const g = new THREE.Group();
  g.add(m);
  // A glowing ring under pieces you can move.
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }));
  ring.position.y = 0.02;
  ring.visible = false;
  g.add(ring);
  g.userData.ring = ring;
  return g;
}

export function mount(el, { send, preview }) {
  el.innerHTML = `
    <div class="g3">
      <div class="g3-hud"></div>
      <div class="g3-view g3-room ludo-view" aria-label="Ludo board"></div>
      <p class="g3-hint"></p>
    </div>`;
  const view = el.querySelector('.g3-view'), hud = el.querySelector('.g3-hud'), hint = el.querySelector('.g3-hint');
  const kit = stage(view, { fov: 34, env: 0.45, near: 0.5, far: 200 });
  const { scene, camera } = kit;

  // Table, wooden frame, the board.
  const table = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#2a1d14', roughness: 0.9 }));
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.62;
  table.receiveShadow = true;
  scene.add(table);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.6, 16.2), new THREE.MeshStandardMaterial({ color: '#6b4426', roughness: 0.55 }));
  frame.position.y = -0.31;
  frame.castShadow = true; frame.receiveShadow = true;
  scene.add(frame);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.7 }));
  board.rotation.x = -Math.PI / 2;
  board.position.y = 0.002;
  board.receiveShadow = true;
  scene.add(board);
  scene.add(new THREE.HemisphereLight('#fff6e8', '#2a1d14', 0.8));
  const lamp = new THREE.DirectionalLight('#fff1dc', 2.2);
  lamp.position.set(-6, 18, 9);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(SHADOW, SHADOW);
  Object.assign(lamp.shadow.camera, { left: -10, right: 10, top: 12, bottom: -10, near: 1, far: 50 });
  scene.add(lamp);

  const pieces = [0, 1].map((p) => [0, 1, 2, 3].map(() => { const g = makePiece(PLAYER_HUE[p]); scene.add(g); return g; }));
  const die = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), FACES.map((n) => new THREE.MeshStandardMaterial({ map: dieFace(n), roughness: 0.35 })));
  die.castShadow = true;
  const DIE_REST = new THREE.Vector3(0, 0.55, 9.2);
  die.position.copy(DIE_REST);
  scene.add(die);

  // Camera: from your side, so your yard is nearest. Fit the board (and die) to the view.
  let me = 0, dist = 26;
  kit.onResize(({ w, h }) => {
    const need = 19, vfov = (camera.fov * Math.PI) / 180;
    dist = Math.max(need / 2 / Math.tan(vfov / 2), need / 2 / (Math.tan(vfov / 2) * (w / h)));
  });
  const look = { x: 0, tx: 0 };
  kit.onFrame((dt, now) => {
    look.x += (look.tx - look.x) * 0.05;
    // Sit at your own corner: red's yard is at the top of the board texture (-z), yellow's at the bottom (+z).
    const side = me === 0 ? -1 : 1;
    camera.position.set(look.x * 1.2 * side, dist * 0.82, dist * 0.58 * side);
    camera.lookAt(0, 0, 1.2 * side);
    // Movable pieces breathe.
    for (const set of pieces) for (const g of set) if (g.userData.ring.visible) g.userData.ring.material.opacity = 0.55 + Math.sin(now / 180) * 0.35;
  });
  // Yellow's view: the die rests on their side too.
  const dieRest = () => (me === 0 ? new THREE.Vector3(0, 0.55, -9.2) : DIE_REST);

  let state = null, meta = null, seen = null, busy = false, autoT = 0;
  const myTurn = () => !preview && state && meta && state.turn === meta.you && state.winner == null && meta.players.length === 2;

  function spotFor(p, i, prog, s = state) {
    const [c, r] = squareOf(p, i, prog);
    if (prog === HOME) return new THREE.Vector3(W(c) + (i - 1.5) * 0.35, 0, W(r) + (p === 0 ? -0.35 : 0.35));
    if (prog < 0) return new THREE.Vector3(W(c), 0, W(r));
    // Several pieces on one square shuffle aside so you can see (and tap) each.
    const here = [];
    [0, 1].forEach((q) => s.pieces[q].forEach((pos, j) => {
      if (pos < 0 || pos >= HOME) return;
      const [qc, qr] = squareOf(q, j, pos);
      if (qc === c && qr === r) here.push(`${q}:${j}`);
    }));
    const k = here.indexOf(`${p}:${i}`);
    const off = here.length > 1 && k >= 0 ? (k - (here.length - 1) / 2) * 0.3 : 0;
    return new THREE.Vector3(W(c) + off, 0, W(r) + off * 0.4);
  }

  function place(s) {
    [0, 1].forEach((p) => s.pieces[p].forEach((prog, i) => {
      const g = pieces[p][i];
      g.position.copy(spotFor(p, i, prog, s));
      g.scale.setScalar(prog === HOME ? 0.7 : 1);
    }));
  }

  function setDie(n, instant = true) {
    if (!n) return;
    const [x, y, z] = UP[n];
    die.rotation.set(x, y, z);
    if (instant) die.position.copy(dieRest());
  }

  async function rollAnim(n) {
    const rest = dieRest();
    if (reduced) { setDie(n); return; }
    haptic([6, 30, 6]);
    const start = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    const end = new THREE.Quaternion().setFromEuler(new THREE.Euler(...UP[n]));
    const spin = new THREE.Euler();
    await tween(kit, 760, (k) => {
      const e = ease.out(k);
      spin.set((1 - e) * 14, (1 - e) * 9, (1 - e) * 11);
      die.quaternion.setFromEuler(spin).multiply(start).slerp(end, e);
      die.position.set(rest.x + Math.sin(k * 9) * (1 - k) * 0.6, rest.y + Math.abs(Math.sin(k * Math.PI * 3)) * (1 - k) * 2.2, rest.z);
    });
    die.quaternion.copy(end);
    die.position.copy(rest);
  }

  async function hop(p, i, from, to, s) {
    const g = pieces[p][i];
    if (reduced) { g.position.copy(spotFor(p, i, to, s)); return; }
    const steps = from < 0 ? [0] : Array.from({ length: to - from }, (_, k) => from + k + 1);
    for (const prog of steps) {
      const a = g.position.clone(), b = spotFor(p, i, prog, s);
      await tween(kit, from < 0 ? 300 : 150, (k) => {
        g.position.lerpVectors(a, b, k);
        g.position.y = Math.sin(Math.PI * k) * (from < 0 ? 1.4 : 0.55);
      });
      haptic(3);
    }
    if (to === HOME) { g.scale.setScalar(0.7); floatLabel(kit, g.position.clone().setY(1.5), 'Home!', 'great'); }
  }

  async function sendHome(q, j) {
    const g = pieces[q][j], a = g.position.clone(), b = spotFor(q, j, -1);
    haptic([30, 40, 30]);
    if (!reduced) await tween(kit, 650, (k) => { g.position.lerpVectors(a, b, ease.inOut(k)); g.position.y = Math.sin(Math.PI * k) * 3; g.rotation.z = k * Math.PI * 2; });
    g.rotation.z = 0;
    g.position.copy(b);
  }

  function rings() {
    const can = myTurn() && state.phase === 'move' ? legal(state, meta.you) : [];
    pieces.forEach((set, p) => set.forEach((g, i) => { g.userData.ring.visible = p === meta?.you && can.includes(i); }));
    return can;
  }

  function renderHud() {
    if (!state || !meta) return;
    const seat = (p) => {
      const pl = meta.players[p], active = state.turn === p && state.winner == null;
      const home = state.pieces[p].filter((x) => x === HOME).length;
      const out = state.pieces[p].filter((x) => x >= 0 && x < HOME).length;
      return `<div class="g3-seat${active ? ' active' : ''}" style="--pc:${PLAYER_HUE[p]}">
        ${pl ? avatarHtml(pl, 'sm') : '<span class="avatar initial empty">?</span>'}
        <span class="g3-name">${esc(p === meta.you ? 'You' : pl?.name ?? 'Waiting')}</span>
        <b class="num g3-big">${home}<small>/4</small></b>
        <span class="g3-sub">${out} out</span>
      </div>`;
    };
    const d = state.dice;
    hud.innerHTML = `${seat(meta.you)}<div class="g3-mid">${d ? `<span class="g3-chip num">Rolled ${d}</span>` : '<span class="g3-chip ghost">Ludo</span>'}</div>${seat(1 - meta.you)}`;
    const name = meta.players[state.turn]?.name ?? 'They';
    hint.textContent = preview || state.winner != null ? ''
      : myTurn() ? (state.phase === 'roll' ? 'Tap the die to roll. A 6 brings a piece out and rolls again.' : 'Tap a glowing piece to move it.')
      : `${name} is ${state.phase === 'roll' ? 'rolling' : 'moving'}…`;
  }

  async function show(s, m, fresh) {
    const prev = m.prev;
    const L = s.last;
    if (fresh && L && prev) {
      busy = true;
      place(prev);
      if (L.type === 'roll') {
        await rollAnim(L.dice);
        if (L.burnt) floatLabel(kit, die.position.clone().setY(2), 'Three 6s! Turn over', 'bad');
        else if (L.stuck) floatLabel(kit, die.position.clone().setY(2), L.dice === 6 ? 'No moves, roll again' : 'No moves', 'bad');
        else if (L.dice === 6) floatLabel(kit, die.position.clone().setY(2), '6! Roll again after', 'great');
      } else if (L.type === 'move') {
        setDie(L.dice, false);
        await hop(L.by, L.piece, L.from, L.to, s);
        for (const j of L.captured) { floatLabel(kit, pieces[1 - L.by][j].position.clone().setY(1.6), 'Sent home!', L.by === m.you ? 'great' : 'bad'); await sendHome(1 - L.by, j); }
      }
      busy = false;
    } else if (s.dice) setDie(s.dice);
    place(s);
    renderHud();
    const can = rings();
    // Only one real choice (one piece, or every option is a piece still in the yard): move it for you.
    clearTimeout(autoT);
    const mine = myTurn() ? state.pieces[meta.you] : [];
    const onlyYard = can.length > 0 && can.every((i) => mine[i] < 0);
    if ((can.length === 1 || onlyYard) && myTurn()) autoT = setTimeout(() => { if (myTurn() && state.phase === 'move') send({ type: 'move', piece: can[0] }); }, 650);
  }

  /* ---------- taps: the die, or a glowing piece ---------- */
  view.addEventListener('pointerdown', (e) => {
    if (!myTurn() || busy) return;
    if (state.phase === 'roll') {
      // A tap anywhere on the table rolls: easier than aiming for the die on a small screen.
      haptic(8);
      send({ type: 'roll' });
      return;
    }
    const can = legal(state, meta.you);
    const hit = kit.pickObjects(e.clientX, e.clientY, can.map((i) => pieces[meta.you][i]));
    if (!hit) return;
    let o = hit.object;
    while (o.parent && !pieces[meta.you].includes(o)) o = o.parent;
    const i = pieces[meta.you].indexOf(o);
    if (i >= 0) { clearTimeout(autoT); haptic(10); send({ type: 'move', piece: i }); }
  });
  view.addEventListener('pointermove', (e) => { const r = view.getBoundingClientRect(); look.tx = ((e.clientX - r.left) / r.width - 0.5) * 2; });
  view.addEventListener('pointerleave', () => { look.tx = 0; });

  return {
    update(s, m) {
      const fresh = m.lastMove && m.lastMove.seq === m.seq && seen !== null && seen !== m.seq;
      const first = seen === null;
      seen = m.seq;
      state = s;
      meta = m;
      me = m.you;
      show(s, m, fresh);
      if (first) { die.position.copy(dieRest()); if (preview) kit.freeze(view); }
    },
    destroy() { clearTimeout(autoT); kit.destroy(); },
  };
}
