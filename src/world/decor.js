// The detail pass: everything that makes it feel like Martin & Julie's actual house on Boxing Day.
// Architraves, cornice, ceiling roses, radiators, sockets, curtains with tie-backs, the stairwell and upstairs
// landing, a pitched roof and upper floor outside, paper chains, fairy lights, cards on strings, the fire,
// the Christmas village on the windowsill, kids' drawings on the fridge, the garage junk, garden lights…
import * as THREE from 'three';
import { G, rand, pick, mulberry } from '../core.js';
import { uvBox, Prop } from '../engine/geo.js';
import { staticBox } from '../engine/physics.js';
import * as TX from '../engine/textures.js';

const WALL_H = 2.5;
export function buildDecor(P, add, M, solid, H) {
  const glow = new Prop();                       // unlit "lit-up" bits (bulbs, windows at night, fire)
  const bulbs = [];                              // fairy-light bulbs (instanced, twinkling)
  const rnd = mulberry(42);
  const WHITE = '#f4f1ea', WOOD = '#5a3a24', DARK = '#2a1a10', BRASS = '#c8a050';
  const string = (pts, n, cols, sag = 0.06) => { for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; for (let k = 0; k < n; k++) { const t = k / n; const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t; const y = a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag; bulbs.push([x, y, z, pick(cols)]); } } };
  const FAIRY = ['#ffcf70', '#ffcf70', '#ff4a4a', '#5aff7a', '#5aa8ff', '#ffd23f'];
  const WARM = ['#ffd890', '#ffcf70', '#ffe8b0'];

  // ---------- architraves around every door opening ----------
  const doorsX = [[-0.45, 0.45, 6], [-0.5, 0.5, 0], [5.4, 6.3, 0], [4.4, 5.6, -7]];            // walls along x at z
  const doorsZ = [[4.65, 5.45, -1.1], [0.75, 1.55, -1.1], [0.6, 1.45, -3.0], [2.4, 3.3, 1.1], [-1.6, -0.7, 3.5]]; // walls along z at x
  for (const [a, b, z] of doorsX) for (const s of [-1, 1]) { P.box(0.07, 2.12, 0.025, WHITE, a - 0.035, 1.06, z + s * 0.07).box(0.07, 2.12, 0.025, WHITE, b + 0.035, 1.06, z + s * 0.07).box(b - a + 0.14, 0.07, 0.025, WHITE, (a + b) / 2, 2.085, z + s * 0.07); }
  for (const [a, b, x] of doorsZ) for (const s of [-1, 1]) { P.box(0.025, 2.12, 0.07, WHITE, x + s * 0.07, 1.06, a - 0.035).box(0.025, 2.12, 0.07, WHITE, x + s * 0.07, 1.06, b + 0.035).box(0.025, 0.07, b - a + 0.14, WHITE, x + s * 0.07, 2.085, (a + b) / 2); }
  // ---------- cornice / coving + picture rail in every room ----------
  const rooms = [[-1.1, 1.1, 0, 6], [1.1, 7, 0, 6], [-3.5, 3.5, -7, 0], [3.5, 7, -7, 0], [-3, -1.1, 4.3, 6]];
  for (const [x0, x1, z0, z1] of rooms) {
    P.box(x1 - x0 - 0.12, 0.07, 0.07, WHITE, (x0 + x1) / 2, WALL_H - 0.035, z0 + 0.095, 0.6).box(x1 - x0 - 0.12, 0.07, 0.07, WHITE, (x0 + x1) / 2, WALL_H - 0.035, z1 - 0.095, -0.6)
      .box(0.07, 0.07, z1 - z0 - 0.12, WHITE, x0 + 0.095, WALL_H - 0.035, (z0 + z1) / 2, 0, 0, -0.6).box(0.07, 0.07, z1 - z0 - 0.12, WHITE, x1 - 0.095, WALL_H - 0.035, (z0 + z1) / 2, 0, 0, 0.6);
  }
  P.box(6.85, 0.025, 0.02, WHITE, 0, 2.1, -6.93).box(0.02, 0.025, 6.85, WHITE, -3.43, 2.1, -3.5); // picture rail in the lounge
  // ceiling roses
  for (const [x, z] of [[0, -3.5], [0, 3.0], [4.2, 3.0], [5.2, -3.5]]) P.cyl(0.2, 0.2, 0.02, WHITE, x, WALL_H - 0.01, z, 0, 0, 0, 20).torus(0.15, 0.012, WHITE, x, WALL_H - 0.02, z, Math.PI / 2);
  // ---------- radiators, sockets & switches ----------
  const radiator = (x, z, len, ry) => { const c = Math.cos(ry), s = Math.sin(ry); for (let i = 0; i < Math.round(len / 0.06); i++) { const o = -len / 2 + i * 0.06 + 0.03; P.box(0.04, 0.55, 0.07, '#f2f2f2', x + o * c, 0.42, z - o * s, 0, ry); } P.box(len, 0.03, 0.04, '#e8e8e8', x, 0.72, z, 0, ry).cyl(0.012, 0.012, 0.1, '#c0c0c0', x + (len / 2 + 0.03) * c, 0.2, z - (len / 2 + 0.03) * s); };
  radiator(-3.4, -3.7, 1.0, Math.PI / 2); radiator(1.0, 2.0, 0.6, Math.PI / 2); radiator(6.9, -5.0, 0.9, Math.PI / 2); radiator(-2.2, 5.9, 0.4, 0);
  const socket = (x, y, z, ry) => P.box(0.14, 0.085, 0.012, '#f6f6f6', x, y, z, 0, ry).box(0.03, 0.03, 0.006, '#e0e0e0', x - 0.03 * Math.cos(ry), y, z + 0.03 * Math.sin(ry), 0, ry).box(0.03, 0.03, 0.006, '#e0e0e0', x + 0.03 * Math.cos(ry), y, z - 0.03 * Math.sin(ry), 0, ry);
  for (const [x, y, z, ry] of [[-3.43, 0.3, -2.0, Math.PI / 2], [-3.43, 0.3, -6.0, Math.PI / 2], [3.43, 0.3, -5.2, Math.PI / 2], [-2.4, 0.3, -6.93, 0], [2.6, 0.3, -0.07, 0], [6.93, 1.1, 4.6, Math.PI / 2], [1.8, 1.1, 5.93, 0], [6.93, 0.3, -6.0, Math.PI / 2], [0.98, 0.3, 4.0, Math.PI / 2]]) socket(x, y, z, ry);
  // cable from the TV to the wall, and the router with blinking lights
  P.cyl(0.006, 0.006, 0.9, '#111', -3.1, 0.05, -6.3, Math.PI / 2, 0, 0.8).box(0.18, 0.04, 0.12, '#f4f4f4', -3.2, 0.53, -5.6);
  glow.box(0.006, 0.006, 0.004, '#40ff60', -3.16, 0.55, -5.54).box(0.006, 0.006, 0.004, '#40ff60', -3.18, 0.55, -5.54).box(0.006, 0.006, 0.004, '#ffb020', -3.2, 0.55, -5.54);

  // ---------- curtains (pleated, with tie-backs and poles) ----------
  const curtains = (cx, cz, w, top, ry, col) => { const c = Math.cos(ry), s = Math.sin(ry); P.cyl(0.015, 0.015, w + 0.4, BRASS, cx, top + 0.08, cz, 0, ry, Math.PI / 2).sph(0.03, BRASS, cx + (w / 2 + 0.2) * c, top + 0.08, cz - (w / 2 + 0.2) * s).sph(0.03, BRASS, cx - (w / 2 + 0.2) * c, top + 0.08, cz + (w / 2 + 0.2) * s);
    for (const side of [-1, 1]) for (let k = 0; k < 6; k++) { const o = side * (w / 2 + 0.05 + k * 0.045); const h = top + 0.05; const lean = side * 0.02 * k; P.cyl(0.028, 0.034, h - 0.05, k % 2 ? col : new THREE.Color(col).multiplyScalar(0.85).getStyle(), cx + o * c, h / 2 + 0.02, cz - o * s, 0, 0, lean * 0.2, 8);
      if (k === 0) P.torus(0.07, 0.012, BRASS, cx + (o + side * 0.1) * c, 0.95, cz - (o + side * 0.1) * s, Math.PI / 2, ry); } };
  curtains(-3.42, -3.7, 1.8, 2.15, Math.PI / 2, '#7a1e2a'); curtains(6.92, -4.9, 1.8, 2.15, Math.PI / 2, '#2a4a3a'); curtains(6.92, 2.6, 2.0, 2.15, Math.PI / 2, '#d8d0c0');
  // kitchen roman blind + window sills everywhere
  for (let i = 0; i < 5; i++) P.box(2.0, 0.06, 0.04, '#e8e0d0', 4.2, 2.05 - i * 0.07, 5.91);
  for (const [x, y, z, w, ry] of [[4.2, 1.03, 5.85, 2.1, 0], [-3.32, 0.88, -3.7, 1.9, Math.PI / 2], [6.82, 0.98, -4.9, 1.9, Math.PI / 2], [6.82, 1.03, 2.6, 2.1, Math.PI / 2], [-2.05, 1.28, 5.88, 0.8, 0]]) P.box(w, 0.035, 0.2, WHITE, x, y, z, 0, ry);
  // window-sill plants and the kitchen herbs
  for (const x of [3.5, 3.8, 4.6, 4.9]) P.cyl(0.05, 0.04, 0.09, '#b5562e', x, 1.1, 5.85).sph(0.07, '#3a7a32', x, 1.19, 5.85, 1, 1.2, 1, 8);

  // ---------- the stairwell: walls up to the first floor, landing, banister, upstairs closed ----------
  const SH = 5.0;
  add(M.paintHall, uvBox(-2.03, (WALL_H + SH) / 2, 2.35, 0.06, SH - WALL_H, 4.0, 1.5));       // west wall (upper)
  add(M.paintHall, uvBox(-1.07, (WALL_H + SH) / 2 + 0.05, 2.35, 0.06, SH - WALL_H - 0.1, 4.0, 1.5)); // east wall above the hall ceiling
  add(M.paintHall, uvBox(-1.55, (WALL_H + SH) / 2, 4.33, 0.96, SH - WALL_H, 0.06, 1.5));        // north end
  add(M.paintHall, uvBox(-1.55, (WALL_H + SH) / 2, 0.37, 0.96, SH - WALL_H, 0.06, 1.5));        // south end
  add(M.ceiling, uvBox(-1.55, SH, 2.35, 1.0, 0.06, 4.0, 2));                                   // stairwell ceiling
  // landing at the top (the stairs arrive at 2.4 m) — floor, nosing, door to "upstairs"
  add(M.oakWood, uvBox(-1.55, 2.42, 1.15, 0.9, 0.06, 1.5, 0.8)); solid(-1.55, 2.42, 1.15, 0.45, 0.03, 0.75);
  P.box(0.92, 0.04, 0.05, '#4a2e1c', -1.55, 2.455, 1.9);
  P.box(0.85, 2.0, 0.05, '#f4f1ea', -1.55, 3.42, 0.42).sph(0.03, BRASS, -1.25, 3.4, 0.46).box(0.4, 0.22, 0.01, '#fff', -1.55, 3.6, 0.45);
  // landing banister + a ribbon across it ("UPSTAIRS IS CLOSED — Julie")
  for (let i = 0; i < 9; i++) P.box(0.03, 0.85, 0.03, WHITE, -1.12, 2.45 + 0.425, 0.45 + i * 0.18);
  P.box(0.06, 0.06, 1.55, '#5a3a22', -1.12, 3.32, 1.2);
  P.box(0.9, 0.06, 0.01, '#c1121f', -1.55, 3.0, 1.85);
  // stair runner carpet with brass rods on each step
  for (let i = 0; i < 13; i++) { const z = 4.3 - (i + 0.5) * 0.185, y = (i + 1) * 0.185; P.box(0.6, 0.008, 0.19, '#5a1a24', -1.55, y + 0.004, z).box(0.6, 0.18, 0.008, '#4a1520', -1.55, y - 0.085, z + 0.09).cyl(0.006, 0.006, 0.62, BRASS, -1.55, y - 0.002, z + 0.085, 0, 0, Math.PI / 2, 6); }
  // a few framed photos climbing the stair wall
  // (textured frames added below)
  // garland with lights wound down the banister
  string([[-1.12, 3.15, 1.95], [-1.12, 1.0, 4.25]], 22, FAIRY, 0.02);
  for (let i = 0; i < 18; i++) { const t = i / 17; P.sph(0.05, i % 3 ? '#1f5a2a' : '#2a6a34', -1.12, 3.1 - t * 2.15 + Math.sin(i) * 0.03, 1.98 + t * 2.3, 1, 0.8, 1.3, 6); }
  string([[-1.12, 3.32, 0.45], [-1.12, 3.32, 1.95]], 10, FAIRY, 0.05);

  // ---------- living room ----------
  // fire: logs, embers, flames (unlit glow) + a flicker light
  P.cyl(0.04, 0.04, 0.45, '#5a3a24', -2.2, 0.08, -0.3, 0, 0.3, Math.PI / 2).cyl(0.04, 0.04, 0.45, '#4a3020', -2.2, 0.1, -0.33, 0, -0.4, Math.PI / 2).box(0.6, 0.02, 0.25, '#181412', -2.2, 0.04, -0.32);
  for (let i = 0; i < 7; i++) glow.cone(0.035 + rnd() * 0.03, 0.12 + rnd() * 0.12, i % 2 ? '#ff8a20' : '#ffcf40', -2.38 + i * 0.06, 0.2 + rnd() * 0.04, -0.32 + rnd() * 0.05, 0, 0, 0, 6);
  glow.box(0.5, 0.015, 0.18, '#ff5a10', -2.2, 0.055, -0.32);
  const fire = new THREE.PointLight('#ff8a30', 1.6, 4, 2); fire.position.set(-2.2, 0.4, -0.6); G.scene.add(fire); H.lights.fire = fire;
  // mirror over the fireplace, garland with lights along the mantel, candles, the stockings already hang
  P.box(1.0, 0.7, 0.03, '#c8a050', -2.2, 1.75, -0.05); add(new THREE.MeshStandardMaterial({ color: '#b8c8d0', metalness: 0.9, roughness: 0.08 }), uvBox(-2.2, 1.75, -0.07, 0.9, 0.6, 0.005, 1));
  for (let i = 0; i < 16; i++) P.sph(0.045, i % 2 ? '#1f5a2a' : '#2a6a34', -2.95 + i * 0.1, 1.27, -0.4 + Math.sin(i * 1.7) * 0.02, 1.3, 0.7, 1, 6);
  string([[-3.0, 1.29, -0.42], [-1.4, 1.29, -0.42]], 18, WARM, 0.03);
  for (let i = 0; i < 5; i++) P.sph(0.03, ['#c1121f', '#d4af37'][i % 2], -2.85 + i * 0.32, 1.25, -0.47);
  // Christmas cards on strings across the chimney breast wall
  for (const y of [1.98, 2.18]) { P.box(2.6, 0.004, 0.004, '#c8a050', 0.2, y, -0.07); for (let i = 0; i < 10; i++) { const x = -1.0 + i * 0.26 + rnd() * 0.05; P.box(0.11, 0.15, 0.005, pick(['#c1121f', '#1f5a2a', '#f4f4f4', '#1d3557', '#d4af37']), x, y - 0.085, -0.075, 0, 0, rnd() * 0.2 - 0.1).box(0.05, 0.05, 0.006, '#ffffff', x, y - 0.08, -0.079); } }
  // paper chains across the lounge ceiling (Mason's handiwork)
  const chain = (a, b, links, sag) => { for (let i = 0; i < links; i++) { const t = i / (links - 1); const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, y = a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag; P.torus(0.035, 0.007, ['#e63946', '#2a9d8f', '#ffd23f', '#3a86ff', '#ff006e', '#ffffff'][i % 6], x, y, z, i % 2 ? Math.PI / 2 : 0, Math.atan2(b[0] - a[0], b[2] - a[2]), 0); } };
  chain([-3.4, 2.45, -0.15], [3.4, 2.45, -6.85], 70, 0.35); chain([3.4, 2.45, -0.15], [-3.4, 2.45, -6.85], 70, 0.35); chain([0, 2.47, -0.15], [0, 2.47, -6.85], 50, 0.25);
  P.sph(0.12, '#e63946', 0, 2.25, -3.5, 1, 1, 1, 10).sph(0.08, '#ffd23f', 0, 2.08, -3.5, 1, 1, 1, 8); // paper bell in the middle
  // fairy lights round the bay window and along the top of the lounge walls
  string([[-1.45, 2.3, -7.05], [1.45, 2.3, -7.05]], 30, FAIRY, 0.08); string([[-1.45, 2.3, -7.05], [-1.45, 0.6, -7.05]], 14, FAIRY, 0.02); string([[1.45, 2.3, -7.05], [1.45, 0.6, -7.05]], 14, FAIRY, 0.02);
  string([[-3.4, 2.38, -0.12], [-3.4, 2.38, -6.88], [3.4, 2.38, -6.88]], 40, WARM, 0.05);
  // Christmas village on the bay windowsill (lit windows) + LED candle bridge
  for (let i = 0; i < 5; i++) { const z = -4.45 + i * 0.26, h = 0.12 + rnd() * 0.08, y0 = 0.9; P.box(0.12, h, 0.16, pick(['#c8a070', '#e8e0d0', '#a85a3a']), -3.33, y0 + h / 2, z).box(0.15, 0.02, 0.18, '#f4f4f4', -3.33, y0 + h + 0.01, z, 0.4).box(0.15, 0.02, 0.18, '#f4f4f4', -3.33, y0 + h + 0.01, z, -0.4); glow.box(0.005, 0.04, 0.04, '#ffd27a', -3.265, y0 + h * 0.4, z - 0.03).box(0.005, 0.04, 0.04, '#ffd27a', -3.265, y0 + h * 0.4, z + 0.04); }
  P.box(0.08, 0.05, 0.6, '#e8e0d0', -3.33, 0.93, -3.0); for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.13; P.cyl(0.008, 0.008, 0.06, '#e8e0d0', -3.33, 0.95 + Math.cos(a) * 0.12, -3.0 + Math.sin(a) * 0.3); glow.sph(0.012, '#ffd890', -3.33, 0.99 + Math.cos(a) * 0.12, -3.0 + Math.sin(a) * 0.3); }
  // TV unit kit: soundbar, games console, a Christmas TV-guide, nativity set on the bookshelf side
  P.box(0.8, 0.07, 0.1, '#111', -2.85, 0.56, -6.35, 0, Math.PI / 4).box(0.25, 0.05, 0.2, '#f4f4f4', -2.55, 0.29, -6.55, 0, Math.PI / 4).box(0.25, 0.06, 0.15, '#222', -3.1, 0.29, -6.15, 0, Math.PI / 4);
  glow.box(0.01, 0.004, 0.004, '#3af', -2.5, 0.31, -6.45);
  // floor lamp & side table by the right sofa, throw blankets, log basket by the fire
  P.cyl(0.18, 0.2, 0.03, '#2a2a2a', 3.15, 0.015, -0.35).cyl(0.015, 0.015, 1.5, BRASS, 3.15, 0.78, -0.35).cyl(0.16, 0.24, 0.3, '#efe4cc', 3.15, 1.6, -0.35, 0, 0, 0, 16, true);
  glow.cyl(0.14, 0.14, 0.005, '#fff0c8', 3.15, 1.46, -0.35);
  P.cyl(0.25, 0.25, 0.03, WOOD, 3.15, 0.52, -5.3).cyl(0.03, 0.03, 0.5, WOOD, 3.15, 0.26, -5.3).cyl(0.18, 0.2, 0.02, WOOD, 3.15, 0.01, -5.3);
  P.box(0.75, 0.02, 0.5, '#c8b8a0', -3.0, 0.72, -2.35, 0.4, 0, 0).box(0.75, 0.3, 0.02, '#c8b8a0', -2.75, 0.55, -2.35, 0, 0, -0.2); // throw
  for (let k = 0; k < 6; k++) P.box(0.7, 0.012, 0.03, '#a82020', -3.0, 0.735, -2.55 + k * 0.08, 0.4);
  P.cyl(0.22, 0.18, 0.3, '#8a6a3a', -1.55, 0.15, -0.8).cyl(0.04, 0.04, 0.45, '#6a4a2a', -1.6, 0.32, -0.8, 0, 0.3, Math.PI / 2).cyl(0.045, 0.045, 0.42, '#5a3a24', -1.5, 0.34, -0.76, 0, -0.5, Math.PI / 2);
  // poinsettias and the nativity set on the bookcase top
  for (const [x, z] of [[-3.2, -6.6], [2.0, -6.8]]) { P.cyl(0.11, 0.09, 0.15, '#c1121f', x, 0.075, z); for (let k = 0; k < 8; k++) { const a = k * 0.785; P.box(0.09, 0.01, 0.04, '#d01020', x + Math.cos(a) * 0.08, 0.2, z + Math.sin(a) * 0.08, 0, -a, 0.3); } }
  for (let i = 0; i < 5; i++) P.cyl(0.02, 0.03, 0.09, ['#7a5a8a', '#3a5a8a', '#c8a070', '#a07050', '#e8e0d0'][i], -3.3, 2.05, -1.25 + i * 0.12);
  P.box(0.3, 0.18, 0.15, '#6a4a2a', -3.3, 2.08, -0.5).box(0.32, 0.03, 0.17, '#4a2a1a', -3.3, 2.18, -0.5, 0, 0, 0.3);
  // advent calendar (all doors open) on the lounge wall
  P.box(0.4, 0.5, 0.02, '#c1121f', 3.43, 1.5, -3.6, 0, Math.PI / 2); for (let i = 0; i < 24; i++) P.box(0.006, 0.06, 0.05, '#f4f1ea', 3.42, 1.33 + Math.floor(i / 4) * 0.075, -3.75 + (i % 4) * 0.09, 0, 0, 0);
  // wall clock (ten past nine-ish)
  P.cyl(0.17, 0.17, 0.03, '#1a1a1a', 1.8, 2.0, -6.95, Math.PI / 2).cyl(0.155, 0.155, 0.032, '#f4f1ea', 1.8, 2.0, -6.94, Math.PI / 2).box(0.006, 0.1, 0.004, '#111', 1.8, 2.04, -6.92, 0, 0, -0.5).box(0.006, 0.07, 0.004, '#111', 1.82, 2.0, -6.92, 0, 0, 2.2);

  // ---------- hallway ----------
  // front door wreath, coir doormat ("WIPE YOUR FEET"), letters on the mat, key hooks, shoe rack, umbrella stand, mirror
  P.torus(0.18, 0.06, '#1f5a2a', 0, 1.65, 5.93, 0, 0, 0).torus(0.18, 0.04, '#2a6a34', 0, 1.65, 5.92).box(0.08, 0.1, 0.02, '#c1121f', 0, 1.5, 5.91);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; P.sph(0.022, i % 3 ? '#c1121f' : '#d4af37', Math.cos(a) * 0.18, 1.65 + Math.sin(a) * 0.18, 5.9); }
  P.box(0.15, 0.003, 0.11, '#f4f4f4', 0.15, 0.025, 5.4, 0, 0.4).box(0.15, 0.003, 0.11, '#f0e0c0', -0.1, 0.027, 5.5, 0, -0.3);
  P.box(0.9, 0.35, 0.3, WOOD, 0.85, 0.18, 3.6, 0, Math.PI / 2).box(0.88, 0.02, 0.28, '#4a2e1c', 0.85, 0.2, 3.6, 0, Math.PI / 2);
  for (let i = 0; i < 4; i++) P.rbox(0.09, 0.07, 0.25, 0.02, pick(['#222', '#5a3a22', '#f4f4f4', '#8a1a2a']), 0.8, 0.07, 3.3 + i * 0.2, 0, rnd() * 0.3).rbox(0.09, 0.07, 0.25, 0.02, pick(['#222', '#5a3a22', '#1d3557']), 0.8, 0.28, 3.3 + i * 0.2);
  P.cyl(0.12, 0.1, 0.5, '#2a2a2a', -0.85, 0.25, 5.6).cyl(0.012, 0.012, 0.8, '#1d3557', -0.85, 0.55, 5.62, 0.05).cyl(0.012, 0.012, 0.85, '#c1121f', -0.82, 0.55, 5.58, -0.08);
  P.box(0.3, 0.12, 0.03, WOOD, 0.98, 1.4, 1.0, 0, Math.PI / 2); for (let i = 0; i < 4; i++) P.cyl(0.006, 0.006, 0.04, BRASS, 0.95, 1.36, 0.9 + i * 0.07, Math.PI / 2);
  // hall runner rug & pendant
  P.box(0.85, 0.008, 3.2, '#5a2a30', 0, 0.004, 2.6); for (let i = 0; i < 10; i++) P.box(0.82, 0.009, 0.02, '#c8a070', 0, 0.005, 1.1 + i * 0.33);
  P.cyl(0.005, 0.005, 0.4, '#555', 0, 2.3, 3.0).cyl(0.12, 0.16, 0.2, '#e8d8a8', 0, 2.05, 3.0, 0, 0, 0, 12, true); glow.sph(0.04, '#fff3d0', 0, 2.0, 3.0);

  // ---------- kitchen ----------
  // pendant lights over the island, fridge magnets + kids' drawings, calendar, utensils, knife block, bread bin, wine rack, dish rack
  for (const x of [3.6, 4.2, 4.8]) { P.cyl(0.004, 0.004, 0.7, '#222', x, 2.15, 2.9).cone(0.14, 0.18, '#1a1a1a', x, 1.72, 2.9, Math.PI, 0, 0, 16); glow.sph(0.035, '#fff3d0', x, 1.66, 2.9); }
  P.box(0.003, 0.28, 0.21, '#ffffff', 1.165, 1.5, 5.15, 0.05).box(0.003, 0.28, 0.21, '#fff8e0', 1.165, 1.45, 5.45, -0.08); // Mason's drawings
  P.cyl(0.05, 0.045, 0.14, '#e8e0d0', 6.75, 0.98, 0.5).cyl(0.004, 0.004, 0.25, '#c8a070', 6.73, 1.08, 0.49, 0.1).cyl(0.004, 0.004, 0.25, '#888', 6.77, 1.08, 0.51, -0.1).cyl(0.004, 0.004, 0.25, '#222', 6.75, 1.08, 0.53, 0.05, 0, 0.1);
  P.box(0.1, 0.22, 0.14, '#3a2216', 6.75, 1.02, 0.8, 0.2); for (let i = 0; i < 5; i++) P.box(0.015, 0.08, 0.015, '#222', 6.73 + (i % 3) * 0.02, 1.16, 0.77 + Math.floor(i / 3) * 0.03, 0.2);
  P.box(0.5, 0.35, 0.12, '#3a2216', 2.75, 1.08, 5.82);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) P.cyl(0.035, 0.035, 0.11, pick(['#2a0a12', '#1f4a2a', '#c8d890']), 2.6 + c * 0.1, 1.0 + r * 0.12, 5.86, Math.PI / 2, 0, 0, 10);
  P.box(0.03, 0.42, 0.3, '#f4f4f4', 1.13, 1.55, 4.6, 0, 0, 0).box(0.01, 0.3, 0.26, '#ffffff', 1.16, 1.52, 4.6); // calendar
  // kitchen clock already; extractor light; under-cabinet LED strips
  glow.box(0.5, 0.01, 0.02, '#fff3d0', 6.75, 1.89, 3.0); for (const x of [1.9, 5.7, 6.3]) glow.box(0.5, 0.008, 0.02, '#fff3d0', x, 1.49, 5.75);
  // oven window glow + tea towel on the oven handle
  glow.box(0.006, 0.18, 0.34, '#ff9a40', 6.37, 0.45, 3.0); P.box(0.02, 0.3, 0.16, '#f4f4f4', 6.36, 0.62, 3.2).box(0.021, 0.04, 0.16, '#c1121f', 6.36, 0.6, 3.2);

  // ---------- dining / games room ----------
  P.box(0.6, 0.01, 2.0, '#c1121f', 6.45, 0.775, -3.5).box(0.58, 0.012, 0.05, '#d4af37', 6.45, 0.776, -2.6).box(0.58, 0.012, 0.05, '#d4af37', 6.45, 0.776, -4.4);
  P.torus(0.16, 0.05, '#1f5a2a', 6.45, 0.8, -3.5, Math.PI / 2); for (let i = 0; i < 3; i++) { P.cyl(0.025, 0.025, 0.2, '#f4f1ea', 6.45 + (i - 1) * 0.06, 0.88, -3.5 + (i - 1) * 0.05); glow.cone(0.012, 0.03, '#ffcf60', 6.45 + (i - 1) * 0.06, 1.0, -3.5 + (i - 1) * 0.05); }
  // welsh dresser with plates
  P.box(0.45, 0.9, 1.4, '#5a3a24', 3.8, 0.45, -5.5).box(0.3, 1.1, 1.4, '#5a3a24', 3.72, 1.45, -5.5).box(0.28, 0.03, 1.35, '#4a2e1c', 3.74, 1.3, -5.5).box(0.28, 0.03, 1.35, '#4a2e1c', 3.74, 1.65, -5.5);
  for (let i = 0; i < 6; i++) { P.cyl(0.11, 0.11, 0.015, '#f4f4f4', 3.84, 1.43, -6.05 + i * 0.22, 0, 0, Math.PI / 2 - 0.2).cyl(0.07, 0.07, 0.016, '#2a5aa0', 3.85, 1.43, -6.05 + i * 0.22, 0, 0, Math.PI / 2 - 0.2); }
  solid(3.8, 0.45, -5.5, 0.225, 0.45, 0.7);
  // "MERRY CHRISTMAS" bunting across the games room
  const word = 'MERRY XMAS'; for (let i = 0; i < word.length; i++) { const t = i / (word.length - 1); const x = 3.7 + t * 3.1, y = 2.35 - Math.sin(t * Math.PI) * 0.18; P.cone(0.1, 0.18, i % 2 ? '#c1121f' : '#1f6a3a', x, y - 0.09, -0.15, Math.PI, 0, 0, 3); }
  P.box(3.2, 0.005, 0.005, '#d4af37', 5.25, 2.35, -0.15);
  string([[3.6, 2.4, -6.9], [6.9, 2.4, -6.9], [6.9, 2.4, -0.1]], 36, FAIRY, 0.06);
  // gaming chair LEDs and speakers either side of the monitor
  P.box(0.1, 0.2, 0.1, '#111', 5.75, 0.87, -6.75).box(0.1, 0.2, 0.1, '#111', 6.6, 0.87, -6.75); glow.box(0.12, 0.005, 0.03, '#3a86ff', 6.2, 0.76, -6.2);

  // ---------- downstairs toilet ----------
  P.torus(0.08, 0.008, '#c0c0c0', -1.2, 1.2, 5.2, 0, Math.PI / 2).box(0.02, 0.35, 0.18, '#7ab8d8', -1.18, 1.0, 5.2).cyl(0.11, 0.09, 0.25, '#c0c0c0', -1.35, 0.125, 5.85).cyl(0.04, 0.035, 0.12, '#f4f4f4', -2.95, 0.06, 4.55).cyl(0.006, 0.006, 0.3, '#888', -2.95, 0.2, 4.55);
  P.box(0.3, 0.4, 0.02, '#3a2a1a', -2.98, 1.5, 5.0, 0, Math.PI / 2).box(0.26, 0.36, 0.005, '#d8e8f0', -2.97, 1.5, 5.0, 0, Math.PI / 2);
  P.box(0.5, 0.004, 0.4, '#7ab8d8', -2.2, 0.003, 5.0); // bath mat

  // ---------- under-stairs cupboard & garage ----------
  P.box(0.4, 0.3, 0.3, '#c8a070', -2.6, 1.57, 0.2).box(0.3, 0.25, 0.3, '#d8b080', -1.8, 1.55, 0.2).box(0.02, 1.0, 0.01, '#e8e8e8', -2.2, 1.95, 0.05); // labelled boxes + string
  P.cyl(0.004, 0.004, 0.3, '#555', -2.0, 2.05, 1.0); glow.sph(0.03, '#555555', -2.0, 1.88, 1.0); // dead bulb
  // garage: pegboard with tools, bike on the wall, lawnmower, ladder, christmas boxes, old telly, wheelie bin
  P.box(1.6, 0.9, 0.02, '#c8a070', -6.0, 1.6, 0.03); for (let i = 0; i < 12; i++) P.box(0.04 + rnd() * 0.05, 0.15 + rnd() * 0.2, 0.02, pick(['#c1121f', '#222', '#888', '#e8b020']), -6.7 + (i % 6) * 0.26, 1.85 - Math.floor(i / 6) * 0.4, 0.06, 0, 0, rnd() * 0.4);
  for (const z of [3.9, 4.8]) P.torus(0.3, 0.025, '#111', -8.35, 1.5, z, 0, Math.PI / 2); P.box(0.03, 0.04, 0.9, '#c1121f', -8.33, 1.6, 4.35).box(0.03, 0.4, 0.04, '#c1121f', -8.33, 1.45, 4.35);
  P.rbox(0.45, 0.3, 0.6, 0.05, '#2d8a3a', -7.7, 0.25, 1.0).cyl(0.012, 0.012, 0.9, '#222', -7.7, 0.6, 0.6, 0.6).cyl(0.1, 0.1, 0.05, '#111', -7.9, 0.1, 0.8, 0, 0, Math.PI / 2).cyl(0.1, 0.1, 0.05, '#111', -7.5, 0.1, 0.8, 0, 0, Math.PI / 2);
  P.box(0.05, 2.2, 0.05, '#c0c0c0', -3.3, 1.1, 2.7, 0, 0, 0.12).box(0.05, 2.2, 0.05, '#c0c0c0', -3.3, 1.1, 3.1, 0, 0, 0.12); for (let i = 0; i < 7; i++) P.box(0.03, 0.03, 0.4, '#c0c0c0', -3.28 - i * 0.03, 0.2 + i * 0.3, 2.9);
  for (let i = 0; i < 4; i++) P.box(0.55, 0.35, 0.4, i % 2 ? '#c8a070' : '#d8b080', -7.6, 0.18 + Math.floor(i / 2) * 0.36, 5.0 - (i % 2) * 0.45);
  P.box(0.5, 0.4, 0.4, '#3a3a3a', -6.9, 1.12, 0.35).box(0.42, 0.32, 0.01, '#1a1a1a', -6.9, 1.12, 0.56);
  P.rbox(0.58, 1.05, 0.72, 0.03, '#2a4a2a', -3.5, 0.53, 0.5).box(0.6, 0.04, 0.75, '#1f3a1f', -3.5, 1.07, 0.5);
  solid(-3.5, 0.53, 0.5, 0.29, 0.53, 0.36);

  // ---------- conservatory: fairy lights in the roof, rattan sofa, rug, plants ----------
  for (let x = 3.4; x <= 7.2; x += 0.7) string([[x, 2.62, -7.1], [x, 2.75, -10.5]], 12, WARM, 0.06);
  P.rbox(1.6, 0.4, 0.75, 0.08, '#b88a50', 5.3, 0.2, -10.15).rbox(1.6, 0.5, 0.15, 0.06, '#b88a50', 5.3, 0.55, -10.48).rbox(0.5, 0.12, 0.6, 0.05, '#e8d8b8', 4.8, 0.45, -10.1).rbox(0.5, 0.12, 0.6, 0.05, '#e8d8b8', 5.35, 0.45, -10.1).rbox(0.5, 0.12, 0.6, 0.05, '#e8d8b8', 5.9, 0.45, -10.1);
  solid(5.3, 0.25, -10.15, 0.8, 0.25, 0.37);
  P.box(2.0, 0.008, 1.4, '#c8b088', 5.3, 0.004, -8.9); for (let i = 0; i < 6; i++) P.box(2.0, 0.009, 0.03, '#a07a50', 5.3, 0.005, -9.5 + i * 0.25);
  for (const [x, z] of [[3.5, -7.3], [7.1, -8.2], [7.1, -10.3]]) P.cyl(0.18, 0.14, 0.35, '#e8e0d0', x, 0.175, z).sph(0.35, '#3a7a32', x, 0.75, z, 0.7, 1.4, 0.7, 8).sph(0.25, '#4a8a3a', x + 0.1, 1.1, z, 0.6, 1.2, 0.6, 8);

  // ---------- outside: upper floor, pitched roof, chimney, porch, icicle lights, garden lights, snowman, light-up reindeer ----------
  const brick = M.brick;
  const X0 = -3.5, X1 = 7.0, Z0 = -7.0, Z1 = 6.0, F1 = WALL_H, F2 = 5.0;
  add(brick, uvBox((X0 + X1) / 2, (F1 + F2) / 2, Z1 + 0.06, X1 - X0, F2 - F1, 0.12, 1.5));
  add(brick, uvBox((X0 + X1) / 2, (F1 + F2) / 2, Z0 - 0.06, X1 - X0, F2 - F1, 0.12, 1.5));
  add(brick, uvBox(X1 + 0.06, (F1 + F2) / 2, (Z0 + Z1) / 2, 0.12, F2 - F1, Z1 - Z0, 1.5));
  add(brick, uvBox(X0 - 0.06, (F1 + F2) / 2, (Z0 + Z1) / 2, 0.12, F2 - F1, Z1 - Z0, 1.5));
  // seal above the ground-floor ceilings (with the stairwell cut out)
  add(M.ceiling, uvBox((X0 + -2.06) / 2, F1 + 0.12, (Z0 + Z1) / 2, -2.06 - X0, 0.02, Z1 - Z0, 3)); add(M.ceiling, uvBox((-1.04 + X1) / 2, F1 + 0.12, (Z0 + Z1) / 2, X1 + 1.04, 0.02, Z1 - Z0, 3));
  add(M.ceiling, uvBox(-1.55, F1 + 0.12, (Z0 + 0.34) / 2, 1.02, 0.02, 0.34 - Z0, 3)); add(M.ceiling, uvBox(-1.55, F1 + 0.12, (4.36 + Z1) / 2, 1.02, 0.02, Z1 - 4.36, 3));
  // upstairs windows: warm-lit at night, with frames and sills
  let wi = 0; const upWin = (x, z, face) => { const w = 1.0, h = 1.1, y = 3.85; const lit = [1, 0, 1, 0, 0, 1][wi++ % 6]; if (face === 'z') { glow.box(w, h, 0.01, lit ? '#e8a860' : '#121626', x, y, z); if (lit) { glow.box(0.28, h, 0.012, '#8a3a2a', x - 0.36, y, z + Math.sign(z) * 0.002).box(0.28, h, 0.012, '#8a3a2a', x + 0.36, y, z + Math.sign(z) * 0.002); } P.box(w + 0.1, 0.06, 0.08, WHITE, x, y - h / 2 - 0.03, z).box(w + 0.1, 0.06, 0.08, WHITE, x, y + h / 2 + 0.03, z).box(0.06, h, 0.08, WHITE, x - w / 2, y, z).box(0.06, h, 0.08, WHITE, x + w / 2, y, z).box(0.04, h, 0.06, WHITE, x, y, z); } else { glow.box(0.01, h, w, '#3a3a50', x, y, z); P.box(0.08, 0.06, w + 0.1, WHITE, x, y - h / 2 - 0.03, z).box(0.08, 0.06, w + 0.1, WHITE, x, y + h / 2 + 0.03, z).box(0.08, h, 0.06, WHITE, x, y, z - w / 2).box(0.08, h, 0.06, WHITE, x, y, z + w / 2).box(0.06, h, 0.04, WHITE, x, y, z); } };
  for (const x of [-1.8, 1.2, 4.6]) { upWin(x, Z1 + 0.13, 'z'); upWin(x, Z0 - 0.13, 'z'); }
  H.upWindows = true;
  // pitched roof (ridge along x), tiles
  const roofMat = new THREE.MeshStandardMaterial({ map: TX.tiles('roof', '#4a3a36', '#5a4440', 12, '#2a201c'), roughness: 0.9 });
  const ridgeY = F2 + 4.4, halfD = (Z1 - Z0) / 2 + 0.35, len = X1 - X0 + 0.6, slope = Math.hypot(halfD, ridgeY - F2);
  const ang = Math.atan2(ridgeY - F2, halfD);
  for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(len, 0.08, slope); g.rotateX(s * ang); g.translate((X0 + X1) / 2, (F2 + ridgeY) / 2, (Z0 + Z1) / 2 + s * halfD / 2); const m = new THREE.Mesh(g, roofMat); m.castShadow = true; G.scene.add(m); }
  for (const xe of [X0 - 0.3, X1 + 0.3]) { const sh = new THREE.Shape(); sh.moveTo(-halfD + 0.35, 0); sh.lineTo(halfD - 0.35, 0); sh.lineTo(0, ridgeY - F2 - 0.05); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(xe + (xe < 0 ? 0.3 : -0.42), F2, (Z0 + Z1) / 2); g.deleteAttribute('uv'); const pp = g.attributes.position, uv = new Float32Array(pp.count * 2); for (let i = 0; i < pp.count; i++) { uv[i * 2] = pp.getZ(i) / 1.5; uv[i * 2 + 1] = pp.getY(i) / 1.5; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); add(brick, g); }
  P.box(len, 0.12, 0.2, '#3a2e2a', (X0 + X1) / 2, ridgeY, (Z0 + Z1) / 2);
  P.box(0.7, 1.6, 0.6, '#9a5a3a', -2.2, ridgeY - 0.1, -0.2).box(0.8, 0.1, 0.7, '#7a4a32', -2.2, ridgeY + 0.72, -0.2).cyl(0.1, 0.1, 0.35, '#b86a42', -2.35, ridgeY + 0.92, -0.2).cyl(0.1, 0.1, 0.35, '#b86a42', -2.05, ridgeY + 0.92, -0.2);
  // gutters + icicle lights all round the eaves
  for (const z of [Z0 - 0.3, Z1 + 0.3]) { P.cyl(0.06, 0.06, len, '#e8e8e8', (X0 + X1) / 2, F2 - 0.05, z, 0, 0, Math.PI / 2, 8); for (let i = 0; i < 70; i++) { const x = X0 - 0.2 + i * (len / 70); const l = 0.08 + (i % 4) * 0.06; glow.cyl(0.004, 0.012, l, '#e8f4ff', x, F2 - 0.12 - l / 2, z); } }
  // garage roof (flat with felt) and its icicles
  add(M.tarmac, uvBox(-6.0, 2.62, 3.0, 5.7, 0.12, 6.4, 3));
  for (let i = 0; i < 26; i++) { const x = -8.6 + i * 0.22; const l = 0.08 + (i % 3) * 0.07; glow.cyl(0.004, 0.012, l, '#e8f4ff', x, 2.5 - l / 2, 6.15); }
  // bay window lead roof
  P.box(3.2, 0.1, 1.2, '#4a4a50', 0, 2.55, -7.55, -0.25);
  // front porch canopy, lantern, house number, wheelie bins, outdoor tree with lights
  P.box(1.5, 0.08, 0.9, '#3a2e2a', 0, 2.35, 6.45, 0.12).box(0.06, 0.4, 0.06, WHITE, -0.7, 2.15, 6.85).box(0.06, 0.4, 0.06, WHITE, 0.7, 2.15, 6.85);
  P.box(0.14, 0.24, 0.14, '#1a1a1a', 0.7, 1.75, 6.1); glow.box(0.1, 0.16, 0.1, '#ffd890', 0.7, 1.73, 6.1);
  P.box(0.2, 0.12, 0.01, '#1a1a1a', -0.7, 1.95, 6.08); glow.box(0.04, 0.08, 0.005, '#d4af37', -0.73, 1.95, 6.09).box(0.04, 0.08, 0.005, '#d4af37', -0.67, 1.95, 6.09);
  for (const [x, c] of [[-2.6, '#2a2a2a'], [-2.0, '#1d5a2a'], [-1.4, '#1d3a6a']]) P.rbox(0.55, 1.05, 0.65, 0.04, c, x, 0.53, 6.6).box(0.57, 0.04, 0.7, c, x, 1.07, 6.6);
  for (const [x, z] of [[4.5, 8.0], [-4.0, 7.8]]) { P.cyl(0.08, 0.1, 0.8, '#4a3420', x, 0.4, z); for (let k = 0; k < 4; k++) P.cone(0.9 - k * 0.18, 0.8, '#1f4a22', x, 1.0 + k * 0.45, z, 0, 0, 0, 10); for (let i = 0; i < 40; i++) { const t = i / 40; const a = t * Math.PI * 9; const r = 0.85 * (1 - t) + 0.08; bulbs.push([x + Math.cos(a) * r, 0.75 + t * 1.8, z + Math.sin(a) * r, pick(FAIRY)]); } }
  // garden: path lights, snowman, light-up reindeer, trampoline, flower beds, fence fairy lights
  for (let i = 0; i < 8; i++) { const x = -1.8 + i * 0.05, z = -10.5 - i * 0.9; P.cyl(0.02, 0.02, 0.4, '#222', x - 0.6, 0.2, z); glow.sph(0.04, '#fff0c0', x - 0.6, 0.42, z); }
  P.sph(0.42, '#f6f8fa', -5.5, 0.4, -12.0, 1, 0.95, 1, 14).sph(0.3, '#f6f8fa', -5.5, 1.0, -12.0, 1, 1, 1, 12).sph(0.2, '#f6f8fa', -5.5, 1.45, -12.0, 1, 1, 1, 12).cone(0.035, 0.18, '#f77f00', -5.5, 1.45, -11.8, Math.PI / 2, 0, 0, 8).sph(0.025, '#111', -5.57, 1.52, -11.83).sph(0.025, '#111', -5.43, 1.52, -11.83).torus(0.2, 0.04, '#c1121f', -5.5, 1.22, -12.0, Math.PI / 2).cyl(0.16, 0.16, 0.22, '#111', -5.5, 1.7, -12.0).cyl(0.22, 0.22, 0.03, '#111', -5.5, 1.6, -12.0);
  for (const [x, z, r] of [[2.0, -13.5, 0.4], [3.1, -13.9, -0.3]]) { const pts = [[0, 0.75, 0.35], [0, 0.75, -0.3], [0, 0.95, 0.5], [0, 1.25, 0.6], [0, 0.4, 0.3], [0, 0.4, -0.25], [0, 0, 0.3], [0, 0, -0.25]]; const c = Math.cos(r), s = Math.sin(r);
    glow.box(0.05, 0.3, 0.7, '#f8f0d8', x, 0.75, z, 0, r).box(0.05, 0.25, 0.25, '#f8f0d8', x + 0.6 * s, 1.0, z + 0.6 * c, 0, r).box(0.03, 0.4, 0.03, '#f8f0d8', x + 0.3 * s, 0.3, z + 0.3 * c).box(0.03, 0.4, 0.03, '#f8f0d8', x - 0.25 * s, 0.3, z - 0.25 * c).box(0.03, 0.25, 0.2, '#f8f0d8', x + 0.62 * s, 1.3, z + 0.62 * c, 0, r); }
  P.cyl(1.4, 1.4, 0.08, '#1a1a1a', 6.5, 0.85, -13.0, 0, 0, 0, 28).torus(1.45, 0.05, '#2a6aa8', 6.5, 0.88, -13.0, Math.PI / 2); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P.cyl(0.03, 0.03, 0.85, '#888', 6.5 + Math.cos(a) * 1.4, 0.42, -13.0 + Math.sin(a) * 1.4); }
  for (const [x0, x1, z] of [[-8.5, -4, -17.5], [-3, 3, -17.5], [4.5, 10.5, -17.5]]) { P.box(x1 - x0, 0.3, 0.8, '#4a3020', (x0 + x1) / 2, 0.15, z); for (let i = 0; i < (x1 - x0) * 2; i++) P.sph(0.15, pick(['#2f5a2a', '#3a6a2a', '#5a7a3a']), x0 + 0.25 + i * 0.5, 0.4, z + rnd() * 0.3 - 0.15, 1, 0.8, 1, 6); }
  string([[-9, 1.8, -17.95], [10.9, 1.8, -17.95]], 90, FAIRY, 0.15); string([[10.9, 1.8, -17.95], [10.9, 1.8, -7.1]], 50, FAIRY, 0.12); string([[-8.95, 1.8, -17.95], [-8.95, 1.8, -7.1]], 50, FAIRY, 0.12);

  // ---------- finish: glow mesh + twinkling bulbs ----------
  const gm = new THREE.Mesh(glow.build(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })); gm.matrixAutoUpdate = false; gm.updateMatrix(); G.scene.add(gm); H.glowMesh = gm;
  const bg = new THREE.SphereGeometry(0.018, 6, 4); const bm = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ toneMapped: false }), bulbs.length); const m4 = new THREE.Matrix4(); const col = new THREE.Color();
  bulbs.forEach(([x, y, z, c], i) => { m4.makeTranslation(x, y, z); bm.setMatrixAt(i, m4); bm.setColorAt(i, col.set(c)); });
  bm.frustumCulled = false; G.scene.add(bm); H.bulbs = { mesh: bm, data: bulbs };
  G.updaters.push(() => {
    if (G.frame % 8) return; const off = G.systems?.powerOut; const t = G.time;
    bulbs.forEach(([, , , c], i) => { const k = off ? 0.04 : 0.55 + 0.45 * Math.sin(t * 2.2 + i * 1.37); bm.setColorAt(i, col.set(c).multiplyScalar(k * 1.4)); }); bm.instanceColor.needsUpdate = true;
    fire.intensity = off ? 0.8 : 1.3 + Math.sin(t * 17) * 0.2 + Math.sin(t * 7.3) * 0.25;
  });
  // framed family photos up the stairs and along the hall (textured)
  const frameMat = (seed) => new THREE.MeshStandardMaterial({ map: TX.photo(seed), roughness: 0.5 });
  [[-2.0, 1.6, 3.6], [-2.0, 2.0, 3.0], [-2.0, 2.4, 2.4], [-2.0, 2.8, 2.6], [0.98, 1.6, 4.5], [0.98, 1.6, 2.2]].forEach(([x, y, z], i) => {
    P.box(0.03, 0.34, 0.28, '#3a2a1a', x + (x < 0 ? -0.0 : 0), y, z);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3), frameMat(20 + i)); m.position.set(x + (x < 0 ? 0.02 : -0.02), y, z); m.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; G.scene.add(m);
  });
  // kitchen calendar texture ("BOXING DAY — QUIZ!" circled)
  const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.3), new THREE.MeshStandardMaterial({ map: TX.label('cal', 260, 300, '#ffffff', [{ text: 'DECEMBER', size: 30, bold: true, color: '#c1121f', y: 30 }, { text: '26 — QUIZ!!', size: 30, bold: true, color: '#1d3557', y: 150 }, { text: '(Martin\'s house)', size: 20, color: '#333', y: 200 }]) }));
  cal.position.set(1.17, 1.52, 4.6); cal.rotation.y = Math.PI / 2; G.scene.add(cal);
}
