// Shared three.js setup for the 3D games: renderer, lights, resize, render loop, picking.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };

export function stage(container, { fov = 35, env = 0.35, exposure = 1, near = 1, far = 20000 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.display = 'block';
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = env;
  // A sensible near plane keeps depth precise at long range (no shimmering where surfaces meet).
  const camera = new THREE.PerspectiveCamera(fov, 1, near, far);

  const frames = new Set();
  const resizers = new Set();
  let raf = 0, dead = false, last = performance.now();
  const size = { w: 1, h: 1 };

  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    size.w = w; size.h = h;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    resizers.forEach((f) => f(size));
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  const loop = (now) => {
    if (dead) return;
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frames.forEach((f) => f(dt, now));
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);
  resize();

  const ray = new THREE.Raycaster();
  return {
    THREE, renderer, scene, camera, size,
    onFrame(f) { frames.add(f); return () => frames.delete(f); },
    onResize(f) { resizers.add(f); f(size); return () => resizers.delete(f); },
    /** Pointer position (client px) projected onto a plane in world space. */
    pickPlane(clientX, clientY, plane) {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
      const p = new THREE.Vector3();
      return ray.ray.intersectPlane(plane, p) ? p : null;
    },
    /** First of `objects` under the pointer, or null. */
    pickObjects(clientX, clientY, objects) {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
      return ray.intersectObjects(objects, true)[0] ?? null;
    },
    /** World point to client px, for floating labels. */
    toScreen(v) {
      const p = v.clone().project(camera), r = renderer.domElement.getBoundingClientRect();
      return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
    },
    /** For lobby previews: render a couple of frames, then swap the live canvas for a still image. */
    freeze(container) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (dead) return;
        const url = this.snapshot();
        this.destroy();
        container.style.background = `center / cover no-repeat url(${url})`;
      }));
    },
    snapshot() {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/jpeg', 0.85);
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export const ease = {
  out: (t) => 1 - (1 - t) ** 3,
  in: (t) => t * t * t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};

/** Tween helper driven by a stage's frame loop. Resolves when done. */
export function tween(kit, ms, fn) {
  return new Promise((resolve) => {
    let t = 0;
    const off = kit.onFrame((dt) => {
      t += dt * 1000;
      const k = Math.min(1, t / ms);
      fn(k);
      if (k >= 1) { off(); resolve(); }
    });
  });
}

/** A floating label (e.g. "T20") over a world position, fading upward. */
export function floatLabel(kit, pos, text, cls = '') {
  const el = document.createElement('div');
  el.className = `float-label ${cls}`;
  el.textContent = text;
  document.body.append(el);
  const p = kit.toScreen(pos);
  el.style.left = p.x + 'px';
  el.style.top = p.y + 'px';
  setTimeout(() => el.remove(), 1500);
}
