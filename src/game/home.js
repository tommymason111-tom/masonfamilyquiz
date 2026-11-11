// The festive home screen: snowfall, a twinkling fairy-light garland, swinging baubles, holly, team cards with
// portraits rendered from the family's 3D scans, the Mason Cup roll of honour, a Boxing Day countdown, and —
// once loaded — a slow cinematic orbit of Martin's living room with everyone in it behind the menu.
import * as THREE from 'three';
import { G } from '../core.js';
import { CAST, TEAMS } from '../chars/cast.js';
import { loadStore } from './settings.js';

const $ = (id) => document.getElementById(id);
export function initHome() {
  snow(); garland(); baubles(); honour(); countdown(); teamCards(false);
}
export function homeProgress(f) { const el = $('caneFill'); if (el) el.style.width = Math.round(4 + f * 96) + '%'; }

function snow() {
  const c = $('snow'); if (!c) return; const g = c.getContext('2d'); let W, H; const flakes = [];
  const resize = () => { W = c.width = innerWidth * Math.min(devicePixelRatio, 1.5); H = c.height = innerHeight * Math.min(devicePixelRatio, 1.5); }; resize(); addEventListener('resize', resize);
  for (let i = 0; i < 260; i++) flakes.push({ x: Math.random(), y: Math.random(), r: Math.random() ** 2 * 3.2 + 0.6, s: Math.random() * 0.5 + 0.2, w: Math.random() * Math.PI * 2, d: Math.random() < 0.15 });
  const tick = (t) => {
    if ($('loading').style.display === 'none') return;
    g.clearRect(0, 0, W, H);
    for (const f of flakes) {
      f.y += f.s * 0.0016 * (f.r * 0.4 + 0.6); f.w += 0.01; const x = (f.x + Math.sin(f.w) * 0.01) * W, y = f.y * H;
      if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); }
      g.beginPath(); g.fillStyle = `rgba(255,255,255,${0.35 + f.r / 6})`; g.arc(x, y, f.r * Math.min(devicePixelRatio, 1.5), 0, 7); g.fill();
      if (f.d && f.r > 2) { g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.8; for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3 + f.w; g.beginPath(); g.moveTo(x - Math.cos(a) * f.r * 2.4, y - Math.sin(a) * f.r * 2.4); g.lineTo(x + Math.cos(a) * f.r * 2.4, y + Math.sin(a) * f.r * 2.4); g.stroke(); } }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function garland() {
  const el = $('garland'); if (!el) return; const n = 36; const cols = ['#ff3b3b', '#ffd23f', '#3bff7a', '#3bb8ff', '#ff6bf0', '#ffffff'];
  let path = 'M0,8 '; const bulbs = [];
  for (let i = 0; i <= n; i++) { const x = i / n * 100; const y = 8 + Math.abs(Math.sin(i / n * Math.PI * 6)) * 26; path += `L${x},${y} `; if (i % 1 === 0 && i < n) { const bx = (i + 0.5) / n * 100; const by = 8 + Math.abs(Math.sin((i + 0.5) / n * Math.PI * 6)) * 26 + 6; bulbs.push(`<g class="bulb" style="animation-delay:${(i * 0.37) % 1.6}s"><rect x="${bx - 0.25}" y="${by - 5}" width="0.5" height="3" fill="#2a3a2a"/><ellipse cx="${bx}" cy="${by + 1.5}" rx="0.55" ry="3.4" fill="${cols[i % cols.length]}" filter="url(#glow)"/></g>`); } }
  el.innerHTML = `<svg viewBox="0 0 100 60" preserveAspectRatio="none"><defs><filter id="glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="0.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="${path}" stroke="#1f3a22" stroke-width="0.35" fill="none" vector-effect="non-scaling-stroke"/>${bulbs.join('')}</svg>`;
}
function baubles() {
  const el = $('hang'); if (!el) return; const cols = ['#c1121f', '#d4af37', '#1d6fd8', '#2d8a4f', '#8f2bd8', '#c0c0c0'];
  const xs = [4, 10, 17, 83, 90, 96, 23, 77]; el.innerHTML = xs.map((x, i) => `<div class="bauble" style="left:${x}%;--len:${30 + (i * 37) % 70}px;--sz:${26 + (i * 13) % 20}px;--c:${cols[i % cols.length]};--a:${3 + (i % 3) * 2}deg;animation-delay:-${i * 0.4}s"><i></i></div>`).join('');
}
function honour() {
  const el = $('honour'); if (!el) return; const w = loadStore('winners', [{ year: 2025, team: 'Team Martin', note: '(disputed)' }]);
  el.innerHTML = w.slice(-6).reverse().map(r => `<div><span>${r.year}</span><b>${r.team}</b></div>`).join('') + `<div style="opacity:.7"><span>${new Date().getFullYear()}</span><b>???</b></div>`;
}
function countdown() {
  const el = $('countdown'); if (!el) return; const now = new Date(); let bd = new Date(now.getFullYear(), 11, 26);
  if (now > new Date(now.getFullYear(), 11, 27)) bd = new Date(now.getFullYear() + 1, 11, 26);
  const days = Math.ceil((bd - now) / 86400000);
  el.textContent = days <= 0 ? '🎉 It\'s Boxing Day! Quiz time.' : `⏳ ${days} sleep${days === 1 ? '' : 's'} until Boxing Day`;
}
// team cards; portraits are filled in once the 3D family has loaded
export function teamCards(withPortraits, portraits = {}) {
  const el = $('teams'); if (!el) return;
  const emoji = { Mason: '🦖', Harrison: '👶', Tommy: '🧑', Tasha: '💃', Dan: '🍺' };
  el.innerHTML = Object.entries(TEAMS).map(([k, t]) => `<div class="team" style="--tc:${t.color}"><h4>${t.name}</h4><div class="faces">${CAST.filter(c => c.team === k).map(c => `<div class="face">${portraits[c.name] ? `<img src="${portraits[c.name]}" alt="${c.name}">` : `<div class="ph">${emoji[c.name] || '🎄'}</div>`}<span>${c.name === 'Tommy' ? 'You' : c.name}</span></div>`).join('')}${k === 'debbie' ? '<div class="face"><div class="ph">🐶</div><span>Chip</span></div>' : ''}</div></div>`).join('');
}
// render a little portrait of each person from the live scene
export function renderPortraits() {
  const r = G.renderer; const rt = new THREE.WebGLRenderTarget(160, 160, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
  const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 20); const out = {};
  const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'); const buf = new Uint8Array(160 * 160 * 4); const img = g.createImageData(160, 160);
  const xr = r.xr.enabled; r.xr.enabled = false;
  for (const p of G.chars) {
    if (p.isPlayer || p.name === 'Harrison') continue;
    const hp = p.headPos(new THREE.Vector3()); const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    cam.position.copy(hp).addScaledVector(fwd, 0.62).add(new THREE.Vector3(0, 0.04, 0)); cam.lookAt(hp.x, hp.y - 0.02, hp.z);
    const hide = G.ui?.bubbles?.map(b => [b.s, b.s.visible]) || []; hide.forEach(([s]) => s.visible = false);
    r.setRenderTarget(rt); r.render(G.scene, cam); r.setRenderTarget(null);
    hide.forEach(([s, v]) => s.visible = v);
    r.readRenderTargetPixels(rt, 0, 0, 160, 160, buf);
    for (let y = 0; y < 160; y++) for (let x = 0; x < 160; x++) { const si = ((159 - y) * 160 + x) * 4, di = (y * 160 + x) * 4; img.data[di] = buf[si]; img.data[di + 1] = buf[si + 1]; img.data[di + 2] = buf[si + 2]; img.data[di + 3] = 255; }
    g.putImageData(img, 0, 0); out[p.name] = c.toDataURL('image/jpeg', 0.85);
  }
  r.xr.enabled = xr; rt.dispose();
  return out;
}
// slow cinematic camera around the living room while the menu is up
let orbitT = 0;
export function orbitCamera(dt) {
  orbitT += dt * 0.05;
  const shots = [[[2.2, 1.6, -0.6], [-1.2, 0.9, -4.5]], [[-0.4, 1.3, -1.0], [0.2, 1.0, -6.8]], [[2.9, 1.5, -6.3], [-2.0, 0.8, -3.0]], [[-2.4, 1.7, -0.7], [1.5, 0.8, -4.0]]];
  const i = Math.floor(orbitT) % shots.length, k = orbitT % 1; const e = k * k * (3 - 2 * k);
  const [p, t] = shots[i]; const [p2] = shots[(i + 1) % shots.length];
  const P = new THREE.Vector3(...p).lerp(new THREE.Vector3(...p).lerp(new THREE.Vector3(...p2), 0.25), e);
  const rig = G.player.rig; rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  G.camera.position.copy(P); G.camera.lookAt(new THREE.Vector3(...t)); G.camera.updateMatrixWorld(true);
}
