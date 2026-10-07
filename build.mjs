// Builds the static website for Vercel into ./dist. The game server (server.js) runs separately on Render;
// API_URL tells the page where to find it, e.g. API_URL=https://lovestep.onrender.com
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const api = (process.env.API_URL || '').replace(/\/$/, '');
if (!api) console.warn('API_URL is not set: the page will look for the game server on its own address.');

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

// OFFLINE=1 retires a deployment: every address on it shows only a "service unavailable" page.
if (process.env.OFFLINE) {
  const down = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>503 Service Unavailable</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#fff;color:#222;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:16px}h1{font-size:22px;margin:0 0 8px}p{margin:0;color:#666}</style></head>
<body><div><h1>503 Service Unavailable</h1><p>The server is temporarily unable to handle your request.</p></div></body></html>\n`;
  writeFileSync('dist/index.html', down);
  writeFileSync('dist/404.html', down);
  console.log('Built offline page');
  process.exit(0);
}

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
