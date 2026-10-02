// Builds the static website for Vercel into ./dist. The game server (server.js) runs separately on Render;
// API_URL tells the page where to find it, e.g. API_URL=https://lovestep.onrender.com
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const api = (process.env.API_URL || '').replace(/\/$/, '');
if (!api) console.warn('API_URL is not set: the page will look for the game server on its own address.');

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });
cpSync('shared', 'dist/shared', { recursive: true });

// Only the library files the page actually loads.
const nm = 'node_modules/';
const copy = (from, to) => cpSync(nm + from, 'dist/vendor/' + to, { recursive: true });
copy('three/build/three.module.js', 'three/three.module.js');
copy('three/build/three.core.js', 'three/three.core.js');
copy('three/examples/jsm/environments/RoomEnvironment.js', 'three-addons/environments/RoomEnvironment.js');
copy('socket.io/client-dist/socket.io.min.js', 'socket.io/socket.io.min.js');
copy('@fontsource-variable/geist', 'geist');
copy('@fontsource-variable/geist-mono', 'geist-mono');
for (const style of ['regular', 'fill']) {
  for (const f of ['style.css', `Phosphor${style === 'fill' ? '-Fill' : ''}.woff2`, `Phosphor${style === 'fill' ? '-Fill' : ''}.woff`]) copy(`@phosphor-icons/web/src/${style}/${f}`, `phosphor/${style}/${f}`);
}

writeFileSync('dist/config.js', `window.LS_API = ${JSON.stringify(api)};\n`);
console.log('Built dist/ for', api || '(same address)');
