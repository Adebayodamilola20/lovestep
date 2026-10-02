// Real-time 3D pool table. The shared 2D simulation stays authoritative; this only draws it.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { W, H, R, POCKETS, createSim } from '/shared/games/pool.js';
import { reduced } from './fx.js';

const RAIL = 50, CUSH = 15, RAIL_H = 24, CUSH_H = 15;
const COLORS = { 1: '#f0b20a', 2: '#1645b5', 3: '#cf2a1f', 4: '#56288f', 5: '#ea6a0e', 6: '#0f7a3d', 7: '#7d1b20', 8: '#151515' };
const ballColor = (id) => COLORS[id > 8 ? id - 8 : id];

function ballTexture(id) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const ivory = '#f3efe4';
  g.fillStyle = id === 0 || id > 8 ? ivory : ballColor(id);
  g.fillRect(0, 0, 512, 256);
  if (id > 8) { g.fillStyle = ballColor(id); g.fillRect(0, 70, 512, 116); }
  if (id === 0) {
    g.fillStyle = '#b3262d';
    for (const [x, y] of [[128, 128], [384, 128], [0, 40], [256, 40], [0, 216], [256, 216]]) { g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill(); }
  } else {
    for (const x of [128, 384]) {
      g.fillStyle = ivory;
      g.beginPath(); g.ellipse(x, 128, 50, 46, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#141414';
      g.font = `700 ${id > 9 ? 50 : 58}px Geist Variable, system-ui, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(id), x, 132);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function feltTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 118 + Math.random() * 20;
    img.data[i] = n; img.data[i + 1] = n; img.data[i + 2] = n; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 5);
  return t;
}

const toWorld = (x, y, out = new THREE.Vector3()) => out.set(x - W / 2, R, y - H / 2);

export class PoolTable {
  constructor(container, { mode = 'game' } = {}) {
    this.container = container;
    this.mode = mode;
    this.view = 'top';
    this.angle = 0;
    this.power = 0;
    this.aimVisible = false;
    this.balls = [];
    this.meshes = new Map();
    this.sinking = [];
    this.portrait = false;
    this.cam = { az: 0, polar: 0.5, dist: 1500, look: new THREE.Vector3(), vaz: 0, vpolar: 0, vdist: 0, vlook: new THREE.Vector3() };
    this.camTarget = { az: 0, polar: 0.5, dist: 1500, look: new THREE.Vector3() };
    this.sway = { x: 0, y: 0 };
    this.dirty = true;
    this.destroyed = false;

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    container.prepend(r.domElement);
    r.domElement.style.touchAction = 'none';

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    this.camera = new THREE.PerspectiveCamera(30, 1, 10, 6000);

    this.buildTable();
    this.buildLights();
    this.buildCue();
    this.buildGuides();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  buildTable() {
    const s = this.scene;
    const felt = new THREE.MeshStandardMaterial({ color: '#1f7a4c', roughness: 0.95, bumpMap: feltTexture(), bumpScale: 0.6 });
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(W + 2 * CUSH, H + 2 * CUSH), felt);
    cloth.rotation.x = -Math.PI / 2;
    cloth.receiveShadow = true;
    s.add(cloth);

    // Cushions: six rubber-and-felt bars broken by the pocket mouths.
    const cushMat = new THREE.MeshStandardMaterial({ color: '#17643d', roughness: 0.9 });
    const bar = (x0, x1, z0, z1) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, CUSH_H, z1 - z0), cushMat);
      m.position.set((x0 + x1) / 2 - W / 2, CUSH_H / 2, (z0 + z1) / 2 - H / 2);
      m.castShadow = true; m.receiveShadow = true;
      s.add(m);
    };
    const corner = 34, side = 26;
    bar(corner, W / 2 - side, -CUSH, 0); bar(W / 2 + side, W - corner, -CUSH, 0);
    bar(corner, W / 2 - side, H, H + CUSH); bar(W / 2 + side, W - corner, H, H + CUSH);
    bar(-CUSH, 0, corner, H - corner); bar(W, W + CUSH, corner, H - corner);

    // Walnut rail: a frame extruded from a rounded rectangle with the playfield cut out.
    const ox = W / 2 + CUSH + RAIL, oz = H / 2 + CUSH + RAIL, ix = W / 2 + CUSH, iz = H / 2 + CUSH, rr = 26;
    const shape = new THREE.Shape();
    shape.moveTo(-ox + rr, -oz); shape.lineTo(ox - rr, -oz); shape.quadraticCurveTo(ox, -oz, ox, -oz + rr);
    shape.lineTo(ox, oz - rr); shape.quadraticCurveTo(ox, oz, ox - rr, oz); shape.lineTo(-ox + rr, oz);
    shape.quadraticCurveTo(-ox, oz, -ox, oz - rr); shape.lineTo(-ox, -oz + rr); shape.quadraticCurveTo(-ox, -oz, -ox + rr, -oz);
    const hole = new THREE.Path();
    hole.moveTo(-ix, -iz); hole.lineTo(-ix, iz); hole.lineTo(ix, iz); hole.lineTo(ix, -iz); hole.lineTo(-ix, -iz);
    shape.holes.push(hole);
    const wood = new THREE.MeshPhysicalMaterial({ color: '#4b2914', roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5 });
    const rail = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: RAIL_H, bevelEnabled: true, bevelThickness: 3, bevelSize: 3, bevelSegments: 3, curveSegments: 12 }), wood);
    rail.rotation.x = -Math.PI / 2;
    rail.castShadow = true; rail.receiveShadow = true;
    s.add(rail);
    // Body below the rail so the table has mass when the camera is low.
    const body = new THREE.Mesh(new THREE.BoxGeometry(ox * 2 - 30, 90, oz * 2 - 30), new THREE.MeshStandardMaterial({ color: '#2a170b', roughness: 0.7 }));
    body.position.y = -46;
    s.add(body);

    // Diamonds (sights) inlaid in the rail.
    const pearl = new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.3 });
    const dia = new THREE.CircleGeometry(3.2, 4);
    const sight = (x, z) => { const d = new THREE.Mesh(dia, pearl); d.rotation.x = -Math.PI / 2; d.position.set(x, RAIL_H + 3.1, z); s.add(d); };
    for (let k = 1; k < 8; k++) if (k !== 4) { sight(-W / 2 + (W * k) / 8, -oz + RAIL / 2); sight(-W / 2 + (W * k) / 8, oz - RAIL / 2); }
    for (let k = 1; k < 4; k++) { sight(-ox + RAIL / 2, -H / 2 + (H * k) / 4); sight(ox - RAIL / 2, -H / 2 + (H * k) / 4); }

    // Pockets: a dark mouth on the cloth, and a leather-rimmed opening cut into the rail top.
    const black = new THREE.MeshBasicMaterial({ color: '#050505' });
    const leather = new THREE.MeshPhysicalMaterial({ color: '#1c130d', roughness: 0.45, clearcoat: 0.5 });
    const railTop = RAIL_H + 3;
    const cut = (p, r) => {
      // The part of a circle that lies over the rail (outside the playfield and cushions).
      const x0 = -CUSH, x1 = W + CUSH, y0 = -CUSH, y1 = H + CUSH, pts = [];
      for (let k = 0; k < 96; k++) {
        const a = (k / 96) * Math.PI * 2;
        let x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (x > x0 && x < x1 && y > y0 && y < y1) {
          const d = [x - x0, x1 - x, y - y0, y1 - y], m = Math.min(...d);
          if (m === d[0]) x = x0; else if (m === d[1]) x = x1; else if (m === d[2]) y = y0; else y = y1;
        }
        pts.push(new THREE.Vector2(x - W / 2, -(y - H / 2)));
      }
      return new THREE.ShapeGeometry(new THREE.Shape(pts));
    };
    for (const p of POCKETS) {
      const mouth = new THREE.Mesh(new THREE.CircleGeometry(p.r + 2, 48), black);
      mouth.rotation.x = -Math.PI / 2;
      mouth.position.set(p.x - W / 2, 0.6, p.y - H / 2);
      s.add(mouth);
      const rim = new THREE.Mesh(cut(p, p.r + 8), leather);
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = railTop + 0.15;
      s.add(rim);
      const hole = new THREE.Mesh(cut(p, p.r + 2), black);
      hole.rotation.x = -Math.PI / 2;
      hole.position.y = railTop + 0.3;
      s.add(hole);
    }

    this.ballGeo = new THREE.SphereGeometry(R, 40, 28);
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R);
    this.ray = new THREE.Raycaster();
  }

  buildLights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#fff1dc', '#0b1410', 0.55));
    const lamp = new THREE.SpotLight('#ffe9c7', 3.2, 0, 0.62, 0.75, 0);
    lamp.position.set(0, 1150, 80);
    lamp.target.position.set(0, 0, 0);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    lamp.shadow.camera.near = 600; lamp.shadow.camera.far = 1500;
    lamp.shadow.bias = -0.0004;
    lamp.shadow.radius = 4;
    s.add(lamp, lamp.target);
    const fill = new THREE.DirectionalLight('#cfe0ff', 0.35);
    fill.position.set(-600, 500, 700);
    s.add(fill);
  }

  buildCue() {
    // yaw group -> pitch group -> stick pieces along local -x (tip at origin).
    this.cueYaw = new THREE.Group();
    this.cuePitch = new THREE.Group();
    this.cueSlide = new THREE.Group();
    const len = 460;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4.2, len * 0.62, 24), new THREE.MeshPhysicalMaterial({ color: '#e7c993', roughness: 0.35, clearcoat: 0.8 }));
    const butt = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.6, len * 0.38, 24), new THREE.MeshPhysicalMaterial({ color: '#2a140a', roughness: 0.3, clearcoat: 1 }));
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.6, 9, 20), new THREE.MeshStandardMaterial({ color: '#f5f2ea', roughness: 0.4 }));
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.55, 3, 20), new THREE.MeshStandardMaterial({ color: '#2d4f8f', roughness: 0.9 }));
    for (const m of [shaft, butt, ferrule, tip]) { m.rotation.z = Math.PI / 2; m.castShadow = true; }
    tip.position.x = -1.5;
    ferrule.position.x = -7.5;
    shaft.position.x = -12 - (len * 0.62) / 2;
    butt.position.x = -12 - len * 0.62 - (len * 0.38) / 2;
    this.cueSlide.add(shaft, butt, ferrule, tip);
    this.cuePitch.add(this.cueSlide);
    this.cueYaw.add(this.cuePitch);
    this.cuePitch.rotation.z = -0.07;
    this.cueYaw.visible = false;
    this.scene.add(this.cueYaw);
  }

  buildGuides() {
    const mk = (color, dashed) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = dashed
        ? new THREE.LineDashedMaterial({ color, dashSize: 9, gapSize: 7, transparent: true, opacity: 0.85 })
        : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 });
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      this.scene.add(line);
      return line;
    };
    this.aimLine = mk('#ffffff', true);
    this.objLine = mk('#ffffff', false);
    this.ghost = new THREE.Mesh(new THREE.RingGeometry(R - 1.6, R, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }));
    this.ghost.rotation.x = -Math.PI / 2;
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    this.hand = new THREE.Mesh(new THREE.RingGeometry(R * 1.7, R * 1.9, 48), new THREE.MeshBasicMaterial({ color: '#ff7a45', transparent: true, opacity: 0.9 }));
    this.hand.rotation.x = -Math.PI / 2;
    this.hand.visible = false;
    this.scene.add(this.hand);
  }

  /* ---------- state ---------- */
  setBalls(balls) {
    this.sinking = [];
    this.balls = balls.map((b) => ({ ...b }));
    for (const b of this.balls) {
      let m = this.meshes.get(b.id);
      if (!m) {
        m = new THREE.Mesh(this.ballGeo, new THREE.MeshPhysicalMaterial({ map: ballTexture(b.id), roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06 }));
        m.castShadow = true;
        // Show the number face-up-ish to begin with.
        m.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.25, 0.3 * b.id, 0));
        this.scene.add(m);
        this.meshes.set(b.id, m);
      }
      m.visible = b.on;
      m.scale.setScalar(1);
      toWorld(b.x, b.y, m.position);
    }
    this.updateGuides();
    this.dirty = true;
  }

  setAim({ angle = this.angle, power = this.power, visible = this.aimVisible, legalTarget = this.legalTarget, hand = this.handOn } = {}) {
    this.angle = angle; this.power = power; this.aimVisible = visible;
    this.legalTarget = legalTarget; this.handOn = hand;
    this.updateGuides();
    this.dirty = true;
  }

  cueBall() { return this.balls.find((b) => b.id === 0); }

  rayCast(cx, cy, dx, dy) {
    let best = Infinity, hit = null;
    for (const b of this.balls) {
      if (!b.on || b.id === 0) continue;
      const fx = cx - b.x, fy = cy - b.y;
      const bq = fx * dx + fy * dy, c = fx * fx + fy * fy - 4 * R * R, disc = bq * bq - c;
      if (disc < 0) continue;
      const t = -bq - Math.sqrt(disc);
      if (t > 0 && t < best) { best = t; hit = b; }
    }
    let tw = Infinity;
    if (dx > 0) tw = Math.min(tw, (W - R - cx) / dx);
    if (dx < 0) tw = Math.min(tw, (R - cx) / dx);
    if (dy > 0) tw = Math.min(tw, (H - R - cy) / dy);
    if (dy < 0) tw = Math.min(tw, (R - cy) / dy);
    return best < tw ? { t: best, hit } : { t: tw, hit: null };
  }

  updateGuides() {
    const c = this.cueBall();
    const show = this.aimVisible && c?.on;
    this.cueYaw.visible = !!show || !!this.striking;
    this.aimLine.visible = this.objLine.visible = this.ghost.visible = !!show;
    this.hand.visible = !!(show && this.handOn);
    if (!c) return;
    const p = toWorld(c.x, c.y);
    this.cueYaw.position.copy(p);
    this.cueYaw.rotation.y = -this.angle;
    if (!this.striking) this.cueSlide.position.x = -(4 + this.power * 70);
    this.hand.position.set(p.x, 0.9, p.z);
    if (!show) return;
    const dx = Math.cos(this.angle), dy = Math.sin(this.angle);
    const { t, hit } = this.rayCast(c.x, c.y, dx, dy);
    const gx = c.x + dx * t, gy = c.y + dy * t;
    const a = this.aimLine.geometry.attributes.position;
    a.setXYZ(0, p.x + dx * R, 1.2, p.z + dy * R);
    a.setXYZ(1, gx - W / 2, 1.2, gy - H / 2);
    a.needsUpdate = true;
    this.aimLine.computeLineDistances();
    this.ghost.position.set(gx - W / 2, 1.3, gy - H / 2);
    this.ghost.material.color.set(hit && this.legalTarget && !this.legalTarget(hit.id) ? '#ff6b5a' : '#ffffff');
    if (hit) {
      const nx = (hit.x - gx) / (2 * R), ny = (hit.y - gy) / (2 * R);
      const len = 40 + 110 * Math.max(0, nx * dx + ny * dy);
      const o = this.objLine.geometry.attributes.position;
      o.setXYZ(0, hit.x - W / 2, 1.2, hit.y - H / 2);
      o.setXYZ(1, hit.x - W / 2 + nx * len, 1.2, hit.y - H / 2 + ny * len);
      o.needsUpdate = true;
      this.objLine.visible = true;
    } else this.objLine.visible = false;
  }

  /* ---------- shot playback ---------- */
  async playShot(start, vx, vy) {
    this.setBalls(start);
    const sp = Math.hypot(vx, vy);
    this.angle = Math.atan2(vy, vx);
    this.aimVisible = false;
    if (!reduced) await this.strike(sp);
    this.striking = false;
    this.cueYaw.visible = false;
    this.aimLine.visible = this.objLine.visible = this.ghost.visible = this.hand.visible = false;
    const sim = createSim(this.balls, vx, vy);
    const prev = new Map(sim.balls.map((b) => [b.id, { x: b.x, y: b.y, on: b.on }]));
    const axis = new THREE.Vector3(), q = new THREE.Quaternion();
    return new Promise((resolve) => {
      let last = performance.now(), acc = 0, moving = true;
      const step = (now) => {
        if (this.destroyed) return resolve();
        acc += Math.min(100, now - last);
        last = now;
        while (acc >= 1000 / 60 && moving) {
          moving = sim.step();
          acc -= 1000 / 60;
          for (const b of sim.balls) {
            const pv = prev.get(b.id), m = this.meshes.get(b.id);
            if (pv.on && !b.on) this.sink(m, b.id, pv);
            if (b.on) {
              const dx = b.x - pv.x, dy = b.y - pv.y, d = Math.hypot(dx, dy);
              if (d > 1e-4) {
                // Roll: rotate about the axis perpendicular to travel, by distance / radius.
                axis.set(dy / d, 0, -dx / d);
                q.setFromAxisAngle(axis, d / R);
                m.quaternion.premultiply(q);
              }
              toWorld(b.x, b.y, m.position);
            }
            pv.x = b.x; pv.y = b.y; pv.on = b.on;
          }
        }
        this.dirty = true;
        if (moving || this.sinking.length) requestAnimationFrame(step);
        else { this.balls = sim.balls.map(({ id, x, y, on }) => ({ id, x, y, on })); resolve(); }
      };
      requestAnimationFrame(step);
    });
  }

  strike(speed) {
    // Draw back a touch further, then drive through the ball.
    this.striking = true;
    this.cueYaw.visible = true;
    const back = -(10 + (speed / 26) * 70);
    return new Promise((resolve) => {
      const t0 = performance.now(), d1 = 120, d2 = 90;
      const tick = (now) => {
        const t = now - t0;
        if (t < d1) this.cueSlide.position.x = -4 + (back + 4) * easeOut(t / d1);
        else if (t < d1 + d2) this.cueSlide.position.x = back + (2 - back) * easeIn((t - d1) / d2);
        else { this.cueSlide.position.x = 2; this.dirty = true; return resolve(); }
        this.dirty = true;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  sink(mesh, id, from) {
    let best = POCKETS[0], bd = Infinity;
    for (const p of POCKETS) { const d = (p.x - from.x) ** 2 + (p.y - from.y) ** 2; if (d < bd) { bd = d; best = p; } }
    this.sinking.push({ mesh, t0: performance.now(), from: mesh.position.clone(), to: new THREE.Vector3(best.x - W / 2, -R * 2.5, best.y - H / 2) });
  }

  /* ---------- camera ---------- */
  setView(view) { this.view = view; this.frame(); }

  frame() {
    const t = this.camTarget;
    const aspect = this.width / Math.max(1, this.height);
    this.portrait = aspect < 0.95;
    const vfov = (this.camera.fov * Math.PI) / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const long = W + 2 * (CUSH + RAIL) + 40, short = H + 2 * (CUSH + RAIL) + 40;
    if (this.mode === 'hero' && this.portrait) {
      // Phones: stand at the head of the table and look down its length.
      t.az = -Math.PI / 2 + 0.12; t.polar = 0.98;
      t.dist = Math.max(720, (short * 0.62) / Math.tan(hfov / 2));
      t.look.set(60, 0, 0);
    } else if (this.mode === 'hero') {
      t.az = -Math.PI / 2 + 0.38; t.polar = 1.02;
      t.dist = Math.max(900, (long * 0.62) / Math.tan(hfov / 2));
      t.look.set(110, 0, 0);
    } else if (this.view === 'cue' && this.cueBall()?.on) {
      const c = this.cueBall();
      t.az = -this.angle - Math.PI / 2;
      t.polar = 1.08;
      t.dist = 640;
      toWorld(c.x, c.y, t.look).add(new THREE.Vector3(Math.cos(this.angle) * 200, -R, Math.sin(this.angle) * 200));
    } else {
      t.az = this.portrait ? -Math.PI / 2 : 0;
      t.polar = 0.42;
      const across = this.portrait ? short : long, along = this.portrait ? long : short;
      const dW = across / 2 / Math.tan(hfov / 2), dH = along / 2 / Math.tan(vfov / 2);
      t.dist = Math.max(dW, dH * 1.06) * 1.02;
      t.look.set(0, 0, this.portrait ? 0 : 12);
    }
    this.dirty = true;
  }

  springCamera() {
    const c = this.cam, t = this.camTarget, k = 0.09, d = 0.72;
    let az = t.az + this.sway.x;
    while (az - c.az > Math.PI) az -= Math.PI * 2;
    while (az - c.az < -Math.PI) az += Math.PI * 2;
    c.vaz = (c.vaz + (az - c.az) * k) * d; c.az += c.vaz;
    c.vpolar = (c.vpolar + (t.polar + this.sway.y - c.polar) * k) * d; c.polar += c.vpolar;
    c.vdist = (c.vdist + (t.dist * (1 - this.power * 0.04) - c.dist) * k) * d; c.dist += c.vdist;
    c.vlook.add(t.look.clone().sub(c.look).multiplyScalar(k)).multiplyScalar(d); c.look.add(c.vlook);
    const moving = Math.abs(c.vaz) + Math.abs(c.vpolar) + Math.abs(c.vdist) * 0.01 + c.vlook.length() * 0.01 > 1e-4;
    const sp = Math.sin(c.polar);
    this.camera.position.set(c.look.x + sp * Math.sin(c.az) * c.dist, c.look.y + Math.cos(c.polar) * c.dist, c.look.z + sp * Math.cos(c.az) * c.dist);
    this.camera.lookAt(c.look);
    return moving;
  }

  snapCamera() {
    const c = this.cam, t = this.camTarget;
    c.az = t.az; c.polar = t.polar; c.dist = t.dist; c.look.copy(t.look);
    c.vaz = c.vpolar = c.vdist = 0; c.vlook.set(0, 0, 0);
  }

  /** Decorative camera drift toward the pointer. Small enough not to affect aiming. */
  setSway(nx, ny) {
    if (reduced) return;
    this.sway.x = nx * (this.mode === 'hero' ? 0.12 : 0.03);
    this.sway.y = ny * (this.mode === 'hero' ? 0.05 : 0.02);
    this.dirty = true;
  }

  pick(clientX, clientY) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, p)) return null;
    return { x: p.x + W / 2, y: p.z + H / 2 };
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.width = w; this.height = h;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const first = !this.framed;
    this.frame();
    if (first) { this.snapCamera(); this.framed = true; }
  }

  loop(now) {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    let busy = this.springCamera();
    if (this.sinking.length) {
      this.sinking = this.sinking.filter((s) => {
        const k = Math.min(1, (now - s.t0) / 320);
        s.mesh.position.lerpVectors(s.from, s.to, easeIn(k));
        s.mesh.scale.setScalar(1 - k * 0.15);
        if (k >= 1) { s.mesh.visible = false; return false; }
        return true;
      });
      busy = true;
    }
    if (this.view === 'cue' && this.aimVisible) this.frame();
    if (busy || this.dirty) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
  }

  snapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/jpeg', 0.86);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t * t;
