// Procedural canvas textures — no external image files needed, so the game loads fast on Quest.
import * as THREE from 'three';
import { mulberry } from '../core.js';

const cache = new Map();
function make(key, w, h, draw, opts = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  cache.set(key, t);
  return t;
}
export function canvasTex(w, h, draw, opts = {}) { // uncached, for dynamic screens
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw && draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.userData.canvas = c; t.userData.ctx = g;
  return t;
}

// Dark oak boards with grain, knots and staggered joints
export function oakFloor() {
  return make('oak', 1024, 1024, (g, w, h) => {
    const rnd = mulberry(7);
    const boards = 8, bw = w / boards;
    for (let i = 0; i < boards; i++) {
      let y = -rnd() * 300;
      while (y < h) {
        const len = 260 + rnd() * 380;
        const base = 40 + rnd() * 22;
        g.fillStyle = `rgb(${base + 28},${base * 0.62 + 10},${base * 0.36})`;
        g.fillRect(i * bw, y, bw, len);
        // grain lines
        for (let k = 0; k < 26; k++) {
          const x0 = i * bw + rnd() * bw;
          g.strokeStyle = `rgba(${20 + rnd() * 20},${10 + rnd() * 8},4,${0.18 + rnd() * 0.25})`;
          g.lineWidth = 0.6 + rnd() * 1.6;
          g.beginPath(); g.moveTo(x0, y);
          for (let s = 0; s < len; s += 16) g.lineTo(x0 + Math.sin((s + k * 30) * 0.02) * (2 + rnd() * 2), y + s);
          g.stroke();
        }
        // light streaks
        for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(150,95,50,${0.05 + rnd() * 0.06})`; g.fillRect(i * bw + rnd() * bw, y, 2 + rnd() * 6, len); }
        if (rnd() < 0.35) { // knot
          const kx = i * bw + bw * (0.25 + rnd() * 0.5), ky = y + len * rnd();
          for (let r = 9; r > 1; r -= 1.5) { g.strokeStyle = `rgba(25,12,5,${0.3})`; g.beginPath(); g.ellipse(kx, ky, r * 0.7, r * 1.6, 0, 0, 7); g.stroke(); }
        }
        g.fillStyle = 'rgba(8,4,2,0.85)'; g.fillRect(i * bw, y + len - 2, bw, 2); // end joint
        y += len;
      }
      g.fillStyle = 'rgba(5,3,1,0.9)'; g.fillRect(i * bw, 0, 2, h);
    }
  }, { repeat: [1, 1] });
}
export function oakWood(key = 'oakw', base = [70, 42, 24]) {
  return make(key, 512, 512, (g, w, h) => {
    const rnd = mulberry(11);
    g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 140; k++) {
      const y0 = rnd() * h; g.strokeStyle = `rgba(20,10,4,${0.1 + rnd() * 0.25})`; g.lineWidth = 0.5 + rnd() * 1.5;
      g.beginPath(); g.moveTo(0, y0); for (let x = 0; x <= w; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.01 + k) * 4); g.stroke();
    }
  });
}
export function paint(key, color, speck = 0.04) {
  return make('paint_' + key, 256, 256, (g, w, h) => {
    const rnd = mulberry(3);
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? 255 : 0},${rnd() < 0.5 ? 255 : 0},${rnd() < 0.5 ? 255 : 0},${speck * rnd()})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
  });
}
export function wallpaper(key, bg, fg) {
  return make('wp_' + key, 512, 512, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 3;
    for (let x = 0; x < w; x += 64) { g.globalAlpha = 0.35; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.globalAlpha = 0.25; g.fillStyle = fg;
    for (let x = 32; x < w; x += 64) for (let y = 32; y < h; y += 64) { g.beginPath(); g.ellipse(x, y, 7, 12, 0, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  });
}
export function tiles(key, c1, c2, n = 8, grout = '#ddd') {
  return make('tile_' + key, 512, 512, (g, w, h) => {
    const s = w / n; const rnd = mulberry(5);
    g.fillStyle = grout; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = ((i + j) % 2 ? c1 : c2); g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
      g.fillStyle = `rgba(255,255,255,${0.05 + rnd() * 0.08})`; g.fillRect(i * s + 4, j * s + 4, s * 0.4, s * 0.15);
    }
  });
}
export function carpet(key, c1, c2) {
  return make('rug_' + key, 512, 512, (g, w, h) => {
    const rnd = mulberry(9);
    g.fillStyle = c1; g.fillRect(0, 0, w, h);
    g.strokeStyle = c2; g.lineWidth = 18; g.strokeRect(30, 30, w - 60, h - 60);
    g.lineWidth = 6; g.strokeRect(70, 70, w - 140, h - 140);
    g.fillStyle = c2; for (let i = 0; i < 4; i++) { g.save(); g.translate(w / 2, h / 2); g.rotate(i * Math.PI / 2); g.beginPath(); g.moveTo(0, -150); g.lineTo(60, 0); g.lineTo(0, 150); g.lineTo(-60, 0); g.fill(); g.restore(); }
    for (let i = 0; i < 30000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.12})`; g.fillRect(rnd() * w, rnd() * h, 1, 2); }
  }, { clamp: true });
}
export function grass() {
  return make('grass', 512, 512, (g, w, h) => {
    const rnd = mulberry(13);
    g.fillStyle = '#3c5a2a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18000; i++) { g.strokeStyle = `rgba(${40 + rnd() * 50},${80 + rnd() * 70},${25 + rnd() * 30},0.7)`; const x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd() * 3 - 1.5, y - 4 - rnd() * 6); g.stroke(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(70,50,30,0.25)'; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 10 + rnd() * 20, 6 + rnd() * 10, 0, 0, 7); g.fill(); }
  });
}
export function slabs() {
  return make('slabs', 512, 512, (g, w, h) => {
    const rnd = mulberry(17);
    g.fillStyle = '#555'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const v = 140 + rnd() * 30; g.fillStyle = `rgb(${v},${v - 5},${v - 15})`; g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
      for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.15})`; g.fillRect(i * 128 + rnd() * 122, j * 128 + rnd() * 122, 2, 2); }
    }
  });
}
export function concrete() {
  return make('concrete', 512, 512, (g, w, h) => {
    const rnd = mulberry(19); g.fillStyle = '#6b6b68'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 20000; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? 0 : 255},${rnd() < 0.5 ? 0 : 255},${rnd() < 0.5 ? 0 : 255},${rnd() * 0.06})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    g.fillStyle = 'rgba(40,30,20,0.25)'; g.beginPath(); g.ellipse(300, 200, 70, 40, 0.4, 0, 7); g.fill();
  });
}
export function brick() {
  return make('brick', 512, 512, (g, w, h) => {
    const rnd = mulberry(23); g.fillStyle = '#c9c3b5'; g.fillRect(0, 0, w, h);
    const bh = 32, bw = 96;
    for (let r = 0; r < h / bh; r++) for (let c = -1; c < w / bw + 1; c++) {
      const x = c * bw + (r % 2 ? bw / 2 : 0); const v = rnd();
      g.fillStyle = `rgb(${150 + v * 50},${70 + v * 30},${50 + v * 20})`; g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
    }
  });
}
export function fabric(key, color, pattern = 'plain', color2 = '#fff') {
  return make('fab_' + key, 256, 256, (g, w, h) => {
    const rnd = mulberry(29);
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    if (pattern === 'check') { g.fillStyle = color2; g.globalAlpha = 0.35; for (let i = 0; i < w; i += 32) { g.fillRect(i, 0, 12, h); g.fillRect(0, i, w, 12); } g.globalAlpha = 1; }
    if (pattern === 'stripe') { g.fillStyle = color2; for (let i = 0; i < w; i += 40) g.fillRect(0, i, w, 14); }
    for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.1})`; g.fillRect(rnd() * w, rnd() * h, 1, 1); }
    for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(0, y, w, 1); }
  });
}
// Text label (cans, bottles, signs, boxes)
export function label(key, w, h, bg, lines, opts = {}) {
  return make('lbl_' + key, w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (opts.band) { g.fillStyle = opts.band; g.fillRect(0, h * 0.3, w, h * 0.4); }
    if (opts.stripes) { g.fillStyle = opts.stripes; for (let x = 0; x < w; x += w / 8) g.fillRect(x, 0, w / 16, h); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((ln, i) => {
      g.fillStyle = ln.color || '#fff'; g.font = `${ln.bold ? 'bold ' : ''}${ln.size || 40}px ${ln.font || 'Georgia, serif'}`;
      const x = ln.x ?? w / 2, y = ln.y ?? (h / (lines.length + 1)) * (i + 1);
      g.fillText(ln.text, x, y);
    });
    if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); }
  }, { clamp: true });
}
// Simple painted "photo" of a family scene for frames
export function photo(seed) {
  return make('photo_' + seed, 256, 320, (g, w, h) => {
    const rnd = mulberry(seed * 77 + 1);
    const sky = rnd() < 0.5;
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, sky ? '#8fb8e0' : '#704030'); grd.addColorStop(1, sky ? '#e8e0c0' : '#2a1a10');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const n = 2 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * w / n + (rnd() - 0.5) * 20, s = 0.7 + rnd() * 0.4;
      g.fillStyle = `hsl(${rnd() * 360},60%,${35 + rnd() * 20}%)`; g.beginPath(); g.ellipse(x, h * 0.8, 34 * s, 70 * s, 0, 0, 7); g.fill();
      g.fillStyle = '#f0c8a8'; g.beginPath(); g.arc(x, h * 0.52, 22 * s, 0, 7); g.fill();
      g.fillStyle = ['#2a1a10', '#6a4a2a', '#d8b860', '#888'][Math.floor(rnd() * 4)]; g.beginPath(); g.arc(x, h * 0.48, 23 * s, Math.PI, 0); g.fill();
      g.fillStyle = '#000'; g.fillRect(x - 8 * s, h * 0.51, 3, 3); g.fillRect(x + 5 * s, h * 0.51, 3, 3);
      g.strokeStyle = '#a03030'; g.beginPath(); g.arc(x, h * 0.55, 8 * s, 0.2, Math.PI - 0.2); g.stroke();
    }
    g.fillStyle = 'rgba(255,240,200,0.15)'; g.fillRect(0, 0, w, h);
  }, { clamp: true });
}
// Knitted jumper normal-ish detail (used as bumpMap on clothes)
export function knitBump() {
  return make('knit', 128, 128, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) {
      const gr = g.createLinearGradient(x, y, x + 8, y + 8); gr.addColorStop(0, '#c0c0c0'); gr.addColorStop(1, '#404040');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y + 8); g.lineTo(x + 8, y); g.lineTo(x + 4, y + 4); g.fill();
    }
  }, { linear: true });
}
export function skyTex() {
  return make('sky', 512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9fb4c8'); gr.addColorStop(0.6, '#d7dde2'); gr.addColorStop(1, '#e8e4dc');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { clamp: true });
}
