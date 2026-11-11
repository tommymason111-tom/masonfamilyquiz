// The detail pass: everything that makes it feel like Martin & Julie's actual house on Boxing Day.
// Architraves, cornice, ceiling roses, radiators, sockets, curtains with tie-backs, the stairwell and upstairs
// landing, a pitched roof and upper floor outside, paper chains, fairy lights, cards on strings, the fire,
// the Christmas village on the windowsill, kids' drawings on the fridge, the garage junk, garden lights…
import * as THREE from 'three';
import { G, rand, pick, mulberry } from '../core.js';
import { uvBox, Prop } from '../engine/geo.js';
import { staticBox } from '../engine/physics.js';
import * as TX from '../engine/textures.js';
import { PX, PZ, KX, STAIR } from './house.js';

const WALL_H = 2.5;
export function buildDecor(P, add, M, solid, H) {
  const glow = new Prop();                       // unlit "lit-up" bits (bulbs, windows at night, fire)
  const bulbs = [];                              // fairy-light bulbs (instanced, twinkling)
  const rnd = mulberry(42);
  const WHITE = '#f4f1ea', WOOD = '#5a3a24', DARK = '#2a1a10', BRASS = '#c8a050';
  const string = (pts, n, cols, sag = 0.06) => { for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; for (let k = 0; k < n; k++) { const t = k / n; const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t; const y = a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag; bulbs.push([x, y, z, pick(cols)]); } } };
  const FAIRY = ['#ffcf70', '#ffcf70', '#ff4a4a', '#5aff7a', '#5aa8ff', '#ffd23f'];
  const WARM = ['#ffd890', '#ffcf70', '#ffe8b0'];

  const xGS = PX(455), xHW = PX(612), xHE = PX(850), xLD = PX(803), xR = PX(1222), zMid = PZ(1312), zBack = PZ(805), zF = PZ(1887), zBT = PZ(1648), xLW = PX(194);
  // ---------- architraves around every door opening ----------
  const AO = 0.1; // half wall thickness + a hair
  const doorsX = [[PX(683), PX(762), zF], [PX(822), PX(880), zMid], [PX(912), PX(1048), zBack], [-7.2, -6.35, zMid], [-0.75, 0.15, zMid]];
  const doorsZ = [[PZ(1340), PZ(1400), xHW], [PZ(1340), PZ(1400), xGS], [PZ(1575), PZ(1640), xHW], [PZ(1740), PZ(1800), xHW], [PZ(1500), PZ(1565), xHE], [PZ(587), PZ(657), xLD]];
  for (const [a, b, z] of doorsX) for (const s of [-1, 1]) { P.box(0.07, 2.12, 0.025, WHITE, a - 0.035, 1.06, z + s * AO).box(0.07, 2.12, 0.025, WHITE, b + 0.035, 1.06, z + s * AO).box(b - a + 0.14, 0.07, 0.025, WHITE, (a + b) / 2, 2.085, z + s * AO); }
  for (const [a, b, x] of doorsZ) for (const s of [-1, 1]) { P.box(0.025, 2.12, 0.07, WHITE, x + s * AO, 1.06, a - 0.035).box(0.025, 2.12, 0.07, WHITE, x + s * AO, 1.06, b + 0.035).box(0.025, 0.07, b - a + 0.14, WHITE, x + s * AO, 2.085, (a + b) / 2); }
  // ---------- cornice / coving in every room (inner faces) ----------
  const rooms = [[-1.13, 1.33, -0.3, 5.91], [1.51, 6.37, -0.3, 5.91], [-5.78, 0.81, -5.93, -0.48], [0.99, 5.47, -5.93, -0.48], [-2.88, -1.31, 3.43, 5.91]];
  for (const [x0, x1, z0, z1] of rooms) {
    P.box(x1 - x0, 0.07, 0.07, WHITE, (x0 + x1) / 2, WALL_H - 0.035, z0 + 0.035, 0.6).box(x1 - x0, 0.07, 0.07, WHITE, (x0 + x1) / 2, WALL_H - 0.035, z1 - 0.035, -0.6)
      .box(0.07, 0.07, z1 - z0, WHITE, x0 + 0.035, WALL_H - 0.035, (z0 + z1) / 2, 0, 0, -0.6).box(0.07, 0.07, z1 - z0, WHITE, x1 - 0.035, WALL_H - 0.035, (z0 + z1) / 2, 0, 0, 0.6);
  }
  // ceiling roses
  for (const [x, z] of [[-2.5, -3.3], [0.1, 2.9], [3.4, 2.6], [PX(992), PZ(1050)]]) P.cyl(0.2, 0.2, 0.02, WHITE, x, WALL_H - 0.01, z, 0, 0, 0, 20).torus(0.15, 0.012, WHITE, x, WALL_H - 0.02, z, Math.PI / 2);
  // ---------- radiators, sockets & switches ----------
  const radiator = (x, z, len, ry) => { const c = Math.cos(ry), s = Math.sin(ry); for (let i = 0; i < Math.round(len / 0.06); i++) { const o = -len / 2 + i * 0.06 + 0.03; P.box(0.04, 0.55, 0.07, '#f2f2f2', x + o * c, 0.42, z - o * s, 0, ry); } P.box(len, 0.03, 0.04, '#e8e8e8', x, 0.72, z, 0, ry).cyl(0.012, 0.012, 0.1, '#c0c0c0', x + (len / 2 + 0.03) * c, 0.2, z - (len / 2 + 0.03) * s); };
  radiator(-4.6, -5.86, 1.2, 0); radiator(1.26, 3.9, 0.6, Math.PI / 2); radiator(1.07, -3.3, 0.9, Math.PI / 2); radiator(-1.38, 3.9, 0.4, Math.PI / 2);
  const socket = (x, y, z, ry) => P.box(0.14, 0.085, 0.012, '#f6f6f6', x, y, z, 0, ry).box(0.03, 0.03, 0.006, '#e0e0e0', x - 0.03 * Math.cos(ry), y, z + 0.03 * Math.sin(ry), 0, ry).box(0.03, 0.03, 0.006, '#e0e0e0', x + 0.03 * Math.cos(ry), y, z - 0.03 * Math.sin(ry), 0, ry);
  for (const [x, y, z, ry] of [[-5.77, 0.3, -4.7, Math.PI / 2], [-3.0, 0.3, -0.49, 0], [0.8, 0.3, -1.2, Math.PI / 2], [6.36, 1.1, 1.6, Math.PI / 2], [1.8, 1.1, 5.9, 0], [5.46, 0.3, -1.0, Math.PI / 2], [1.32, 0.3, 4.0, Math.PI / 2]]) socket(x, y, z, ry);

  // ---------- curtains (pleated, with tie-backs and poles) ----------
  const curtains = (cx, cz, w, top, ry, col) => { const c = Math.cos(ry), s = Math.sin(ry); P.cyl(0.015, 0.015, w + 0.4, BRASS, cx, top + 0.08, cz, 0, ry, Math.PI / 2).sph(0.03, BRASS, cx + (w / 2 + 0.2) * c, top + 0.08, cz - (w / 2 + 0.2) * s).sph(0.03, BRASS, cx - (w / 2 + 0.2) * c, top + 0.08, cz + (w / 2 + 0.2) * s);
    for (const side of [-1, 1]) for (let k = 0; k < 6; k++) { const o = side * (w / 2 + 0.05 + k * 0.045); const h = top + 0.05; const lean = side * 0.02 * k; P.cyl(0.028, 0.034, h - 0.05, k % 2 ? col : new THREE.Color(col).multiplyScalar(0.85).getStyle(), cx + o * c, h / 2 + 0.02, cz - o * s, 0, 0, lean * 0.2, 8);
      if (k === 0) P.torus(0.07, 0.012, BRASS, cx + (o + side * 0.1) * c, 0.95, cz - (o + side * 0.1) * s, Math.PI / 2, ry); } };
  const lwx = (PX(232) + PX(372)) / 2, rwx = (PX(626) + PX(758)) / 2;
  curtains(lwx, -5.85, 1.55, 2.15, 0, '#7a1e2a'); curtains(rwx, -5.85, 1.45, 2.15, 0, '#7a1e2a');
  // kitchen roman blind + window sills
  const kwx = (PX(912) + PX(1072)) / 2;
  for (let i = 0; i < 5; i++) P.box(1.8, 0.06, 0.04, '#e8e0d0', kwx, 2.05 - i * 0.07, 5.88);
  for (const [x, y, z, w] of [[kwx, 1.03, 5.84, 1.9], [lwx, 0.88, -5.85, 1.65], [rwx, 0.88, -5.85, 1.55], [(PX(500) + PX(570)) / 2, 1.38, 5.86, 0.85]]) P.box(w, 0.035, 0.22, WHITE, x, y, z);
  for (const x of [kwx - 0.6, kwx - 0.3, kwx + 0.3, kwx + 0.6]) P.cyl(0.05, 0.04, 0.09, '#b5562e', x, 1.1, 5.85).sph(0.07, '#3a7a32', x, 1.19, 5.85, 1, 1.2, 1, 8);

  // ---------- the stairwell: walls up to the first floor, upstairs landing over the under-stairs cupboard ----------
  const SH = 5.0, sx0 = -2.88, sx1 = -1.31, sz0 = -0.3, sz1 = 3.25;
  add(M.paintHall, uvBox(sx0 - 0.03, (WALL_H + SH) / 2, (sz0 + sz1) / 2, 0.06, SH - WALL_H, sz1 - sz0, 1.5));
  add(M.paintHall, uvBox(sx1 + 0.03, (WALL_H + SH) / 2 + 0.05, (sz0 + sz1) / 2, 0.06, SH - WALL_H - 0.1, sz1 - sz0, 1.5));
  add(M.paintHall, uvBox((sx0 + sx1) / 2, (WALL_H + SH) / 2, sz1 + 0.03, sx1 - sx0, SH - WALL_H, 0.06, 1.5));
  add(M.paintHall, uvBox((sx0 + sx1) / 2, (WALL_H + SH) / 2, sz0 - 0.03, sx1 - sx0, SH - WALL_H, 0.06, 1.5));
  add(M.ceiling, uvBox((sx0 + sx1) / 2, SH, (sz0 + sz1) / 2, sx1 - sx0, 0.06, sz1 - sz0, 2));
  const lz1 = PZ(1410), top = 2.45;
  add(M.oakWood, uvBox((sx0 + sx1) / 2, top - 0.03, (sz0 + lz1) / 2, sx1 - sx0, 0.06, lz1 - sz0, 0.8)); solid((sx0 + sx1) / 2, top - 0.03, (sz0 + lz1) / 2, (sx1 - sx0) / 2, 0.03, (lz1 - sz0) / 2);
  P.box(0.85, 2.0, 0.05, '#f4f1ea', -2.3, top + 1.0, sz0 + 0.03).sph(0.03, BRASS, -2.0, top + 0.98, sz0 + 0.07).box(0.4, 0.22, 0.01, '#fff', -2.3, top + 1.2, sz0 + 0.06);
  // landing banister over the cupboard side + a ribbon across the top of the stairs ("UPSTAIRS IS CLOSED — Julie")
  for (let i = 0; i < 5; i++) P.box(0.03, 0.85, 0.03, WHITE, PX(545) + i * 0.16, top + 0.45, lz1 + 0.02);
  P.box(0.72, 0.06, 0.06, '#5a3a22', (PX(540) + sx1) / 2, top + 0.88, lz1 + 0.02);
  P.box(PX(540) - sx0, 0.06, 0.01, '#c1121f', (sx0 + PX(540)) / 2, top + 0.55, lz1 + 0.05);
  // handrail up the west wall, with a garland and lights
  const S = STAIR, r = S.rise, td = (S.z1 - S.z0) / 9;
  P.box(0.05, 0.05, (S.z1 - S.z0) * 1.35, '#5a3a22', sx0 + 0.05, (5 * r + 13 * r) / 2 + 0.9, (S.z0 + S.z1) / 2, Math.atan2(8 * r, S.z1 - S.z0));
  string([[sx0 + 0.07, 5 * r + 1.0, S.z1], [sx0 + 0.07, 13 * r + 1.0, S.z0]], 20, FAIRY, 0.02);
  for (let i = 0; i < 16; i++) { const t = i / 15; P.sph(0.05, i % 3 ? '#1f5a2a' : '#2a6a34', sx0 + 0.08, 5 * r + 0.95 + t * 8 * r + Math.sin(i) * 0.03, S.z1 - t * (S.z1 - S.z0), 1.3, 0.8, 1, 6); }
  // stair runner carpet with brass rods
  for (let i = 0; i < 9; i++) { const z = S.z1 - (i + 0.5) * td, y = (5 + i) * r; P.box(0.55, 0.008, td, '#5a1a24', (S.x0 + S.x1) / 2, y + 0.004, z).cyl(0.006, 0.006, 0.57, BRASS, (S.x0 + S.x1) / 2, y + 0.006, z + td / 2 - 0.02, 0, 0, Math.PI / 2, 6); }
  for (let i = 0; i < 3; i++) { const tw = (S.sx1 - S.x1) / 3, x = S.sx1 - (i + 0.5) * tw, y = (i + 1) * r; P.box(tw, 0.008, 0.55, '#5a1a24', x, y + 0.004, (S.lz0 + S.lz1) / 2); }

  // ---------- living room ----------
  const fz = (PZ(955) + PZ(1190)) / 2, fxo = PX(247) + 0.19;
  P.cyl(0.04, 0.04, 0.45, '#5a3a24', fxo + 0.02, 0.08, fz, Math.PI / 2, 0.3, 0).cyl(0.04, 0.04, 0.45, '#4a3020', fxo + 0.05, 0.1, fz, Math.PI / 2, -0.4, 0).box(0.25, 0.02, 0.5, '#181412', fxo, 0.04, fz);
  for (let i = 0; i < 7; i++) glow.cone(0.035 + rnd() * 0.03, 0.12 + rnd() * 0.12, i % 2 ? '#ff8a20' : '#ffcf40', fxo + rnd() * 0.05, 0.2 + rnd() * 0.04, fz - 0.18 + i * 0.06, 0, 0, 0, 6);
  glow.box(0.18, 0.015, 0.45, '#ff5a10', fxo, 0.055, fz);
  const fire = new THREE.PointLight('#ff8a30', 1.6, 4, 2); fire.position.set(fxo + 0.5, 0.4, fz); G.scene.add(fire); H.lights.fire = fire;
  // mirror over the fireplace, garland with lights along the mantel
  P.box(0.03, 0.7, 1.0, '#c8a050', PX(247) + 0.01, 1.78, fz); add(new THREE.MeshStandardMaterial({ color: '#b8c8d0', metalness: 0.9, roughness: 0.08 }), uvBox(PX(247) + 0.03, 1.78, fz, 0.005, 0.6, 0.9, 1));
  for (let i = 0; i < 14; i++) P.sph(0.045, i % 2 ? '#1f5a2a' : '#2a6a34', PX(247) + 0.36 + Math.sin(i * 1.7) * 0.02, 1.27, fz - 0.6 + i * 0.09, 0.7, 0.7, 1.3, 6);
  string([[PX(247) + 0.38, 1.29, fz - 0.62], [PX(247) + 0.38, 1.29, fz + 0.62]], 16, WARM, 0.03);
  // Christmas cards on strings above the bottom sofa
  for (const y of [1.98, 2.18]) { P.box(2.6, 0.004, 0.004, '#c8a050', -2.9, y, -0.5); for (let i = 0; i < 10; i++) { const x = -4.1 + i * 0.26 + rnd() * 0.05; P.box(0.11, 0.15, 0.005, pick(['#c1121f', '#1f5a2a', '#f4f4f4', '#1d3557', '#d4af37']), x, y - 0.085, -0.505, 0, 0, rnd() * 0.2 - 0.1).box(0.05, 0.05, 0.006, '#ffffff', x, y - 0.08, -0.51); } }
  // paper chains across the lounge ceiling (Mason's handiwork)
  const chain = (a, b, links, sag) => { for (let i = 0; i < links; i++) { const t = i / (links - 1); const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, y = a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag; P.torus(0.035, 0.007, ['#e63946', '#2a9d8f', '#ffd23f', '#3a86ff', '#ff006e', '#ffffff'][i % 6], x, y, z, i % 2 ? Math.PI / 2 : 0, Math.atan2(b[0] - a[0], b[2] - a[2]), 0); } };
  chain([-5.7, 2.45, -0.55], [0.7, 2.45, -5.85], 70, 0.35); chain([0.7, 2.45, -0.55], [-5.7, 2.45, -5.85], 70, 0.35); chain([-2.5, 2.47, -0.55], [-2.5, 2.47, -5.85], 50, 0.25);
  P.sph(0.12, '#e63946', -1.0, 2.25, -4.5, 1, 1, 1, 10).sph(0.08, '#ffd23f', -1.0, 2.08, -4.5, 1, 1, 1, 8);
  // fairy lights round the bay and along the top of the lounge walls
  const BAY = [[PX(380), PZ(805)], [PX(430), PZ(722)], [PX(575), PZ(722)], [PX(620), PZ(805)]];
  string(BAY.map(([x, z]) => [x, 2.25, z + 0.08]), 12, FAIRY, 0.06);
  string([[-5.74, 2.38, -0.55], [-5.74, 2.38, -5.88], [0.76, 2.38, -5.88]], 44, WARM, 0.05);
  // Christmas village on the left windowsill + LED candle bridge on the right one
  for (let i = 0; i < 5; i++) { const x = lwx - 0.6 + i * 0.3, h = 0.12 + rnd() * 0.08, y0 = 0.9; P.box(0.16, h, 0.12, pick(['#c8a070', '#e8e0d0', '#a85a3a']), x, y0 + h / 2, -5.83).box(0.18, 0.02, 0.15, '#f4f4f4', x, y0 + h + 0.01, -5.83, 0.4).box(0.18, 0.02, 0.15, '#f4f4f4', x, y0 + h + 0.01, -5.83, -0.4); glow.box(0.04, 0.04, 0.005, '#ffd27a', x - 0.03, y0 + h * 0.4, -5.765).box(0.04, 0.04, 0.005, '#ffd27a', x + 0.04, y0 + h * 0.4, -5.765); }
  P.box(0.6, 0.05, 0.08, '#e8e0d0', rwx, 0.93, -5.83); for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.13; P.cyl(0.008, 0.008, 0.06, '#e8e0d0', rwx + Math.sin(a) * 0.3, 0.95 + Math.cos(a) * 0.12, -5.83); glow.sph(0.012, '#ffd890', rwx + Math.sin(a) * 0.3, 0.99 + Math.cos(a) * 0.12, -5.83); }
  // TV kit: soundbar, console
  const tvx = PX(258), tvz = PZ(860);
  P.box(0.8, 0.07, 0.1, '#111', tvx + 0.12, 0.56, tvz + 0.12, 0, Math.PI / 4).box(0.25, 0.05, 0.2, '#f4f4f4', tvx + 0.3, 0.29, tvz - 0.05, 0, Math.PI / 4);
  glow.box(0.01, 0.004, 0.004, '#3af', tvx + 0.4, 0.31, tvz + 0.05);
  // floor lamp by the bottom sofa, throw blanket, log basket by the fire
  P.cyl(0.18, 0.2, 0.03, '#2a2a2a', -1.4, 0.015, -0.8).cyl(0.015, 0.015, 1.5, BRASS, -1.4, 0.78, -0.8).cyl(0.16, 0.24, 0.3, '#efe4cc', -1.4, 1.6, -0.8, 0, 0, 0, 16, true);
  glow.cyl(0.14, 0.14, 0.005, '#fff0c8', -1.4, 1.46, -0.8);
  P.box(0.5, 0.02, 0.75, '#c8b8a0', -3.6, 0.72, -0.75, 0, 0, 0.4); for (let k = 0; k < 6; k++) P.box(0.03, 0.012, 0.7, '#a82020', -3.8 + k * 0.08, 0.735, -0.75, 0, 0, 0.4);
  P.cyl(0.22, 0.18, 0.3, '#8a6a3a', -4.75, 0.15, -1.85).cyl(0.04, 0.04, 0.45, '#6a4a2a', -4.75, 0.32, -1.9, 0, 0.3, Math.PI / 2).cyl(0.045, 0.045, 0.42, '#5a3a24', -4.7, 0.34, -1.8, 0, -0.5, Math.PI / 2);
  for (const [x, z] of [[-4.9, -4.7], [-1.35, -5.7]]) { P.cyl(0.11, 0.09, 0.15, '#c1121f', x, 0.075, z); for (let k = 0; k < 8; k++) { const a = k * 0.785; P.box(0.09, 0.01, 0.04, '#d01020', x + Math.cos(a) * 0.08, 0.2, z + Math.sin(a) * 0.08, 0, -a, 0.3); } }
  const bkx = PX(205) + 0.18;
  for (let i = 0; i < 5; i++) P.cyl(0.02, 0.03, 0.09, ['#7a5a8a', '#3a5a8a', '#c8a070', '#a07050', '#e8e0d0'][i], bkx, 2.05, -1.45 + i * 0.12);
  P.box(0.15, 0.18, 0.3, '#6a4a2a', bkx, 2.08, -0.8).box(0.17, 0.03, 0.32, '#4a2a1a', bkx, 2.18, -0.8, 0.3, 0, 0);
  // advent calendar (all doors open) + wall clock
  P.box(0.4, 0.5, 0.02, '#c1121f', -5.1, 1.5, -0.5); for (let i = 0; i < 24; i++) P.box(0.05, 0.06, 0.006, '#f4f1ea', -5.24 + (i % 4) * 0.09, 1.33 + Math.floor(i / 4) * 0.075, -0.512);
  P.cyl(0.17, 0.17, 0.03, '#1a1a1a', -5.1, 2.12, -5.91, Math.PI / 2).cyl(0.155, 0.155, 0.032, '#f4f1ea', -5.1, 2.12, -5.9, Math.PI / 2).box(0.006, 0.1, 0.004, '#111', -5.1, 2.16, -5.88, 0, 0, -0.5).box(0.006, 0.07, 0.004, '#111', -5.08, 2.12, -5.88, 0, 0, 2.2);

  // ---------- hallway ----------
  P.torus(0.18, 0.06, '#1f5a2a', 0, 1.65, 5.9).torus(0.18, 0.04, '#2a6a34', 0, 1.65, 5.89).box(0.08, 0.1, 0.02, '#c1121f', 0, 1.5, 5.88);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; P.sph(0.022, i % 3 ? '#c1121f' : '#d4af37', Math.cos(a) * 0.18, 1.65 + Math.sin(a) * 0.18, 5.87); }
  P.box(0.15, 0.003, 0.11, '#f4f4f4', 0.15, 0.025, 5.4, 0, 0.4).box(0.15, 0.003, 0.11, '#f0e0c0', -0.1, 0.027, 5.5, 0, -0.3);
  P.box(0.9, 0.35, 0.3, WOOD, -0.95, 0.18, 1.6, 0, Math.PI / 2).box(0.88, 0.02, 0.28, '#4a2e1c', -0.95, 0.2, 1.6, 0, Math.PI / 2);
  for (let i = 0; i < 4; i++) P.rbox(0.09, 0.07, 0.25, 0.02, pick(['#222', '#5a3a22', '#f4f4f4', '#8a1a2a']), -0.9, 0.07, 1.3 + i * 0.2, 0, rnd() * 0.3).rbox(0.09, 0.07, 0.25, 0.02, pick(['#222', '#5a3a22', '#1d3557']), -0.9, 0.28, 1.3 + i * 0.2);
  P.cyl(0.12, 0.1, 0.5, '#2a2a2a', -0.95, 0.25, 5.6).cyl(0.012, 0.012, 0.8, '#1d3557', -0.95, 0.55, 5.62, 0.05).cyl(0.012, 0.012, 0.85, '#c1121f', -0.92, 0.55, 5.58, -0.08);
  P.box(0.3, 0.12, 0.03, WOOD, 1.31, 1.4, 1.0, 0, Math.PI / 2); for (let i = 0; i < 4; i++) P.cyl(0.006, 0.006, 0.04, BRASS, 1.28, 1.36, 0.9 + i * 0.07, Math.PI / 2);
  P.box(0.85, 0.008, 3.8, '#5a2a30', 0.1, 0.004, 3.1); for (let i = 0; i < 12; i++) P.box(0.82, 0.009, 0.02, '#c8a070', 0.1, 0.005, 1.3 + i * 0.33);
  P.cyl(0.005, 0.005, 0.4, '#555', 0.1, 2.3, 2.9).cyl(0.12, 0.16, 0.2, '#e8d8a8', 0.1, 2.05, 2.9, 0, 0, 0, 12, true); glow.sph(0.04, '#fff3d0', 0.1, 2.0, 2.9);

  // ---------- kitchen ----------
  const krx = (KX(1148) + KX(1212)) / 2;
  P.cyl(0.004, 0.004, 0.3, '#222', 3.9, 2.35, 2.6).cyl(0.3, 0.3, 0.06, '#f4f4f4', 3.9, 2.2, 2.6, 0, 0, 0, 20); glow.cyl(0.26, 0.26, 0.005, '#fff3d0', 3.9, 2.165, 2.6);
  for (const x of [3.3, 3.9, 4.5]) { P.cyl(0.004, 0.004, 0.75, '#222', x, 2.12, 0.95).cone(0.12, 0.16, '#1a1a1a', x, 1.7, 0.95, Math.PI, 0, 0, 16); glow.sph(0.03, '#fff3d0', x, 1.65, 0.95); } // pendants over the breakfast bar
  P.box(0.21, 0.28, 0.003, '#ffffff', 5.35, 1.5, 0.48, 0, 0, 0.05).box(0.21, 0.28, 0.003, '#fff8e0', 5.7, 1.45, 0.48, 0, 0, -0.08); // Mason's drawings on the fridge
  P.cyl(0.05, 0.045, 0.14, '#e8e0d0', krx + 0.15, 0.98, 2.2).cyl(0.004, 0.004, 0.25, '#c8a070', krx + 0.13, 1.08, 2.19, 0.1).cyl(0.004, 0.004, 0.25, '#888', krx + 0.17, 1.08, 2.21, -0.1);
  P.box(0.14, 0.22, 0.1, '#3a2216', krx + 0.15, 1.02, 1.85, 0, 0, 0.2); for (let i = 0; i < 5; i++) P.box(0.015, 0.08, 0.015, '#222', krx + 0.12 + Math.floor(i / 3) * 0.03, 1.16, 1.82 + (i % 3) * 0.02);
  for (let r2 = 0; r2 < 2; r2++) for (let c = 0; c < 4; c++) P.cyl(0.035, 0.035, 0.11, pick(['#2a0a12', '#1f4a2a', '#c8d890']), 4.25 + c * 0.1, 1.0 + r2 * 0.12, 5.86, Math.PI / 2, 0, 0, 10);
  P.box(0.03, 0.42, 0.3, '#f4f4f4', 1.53, 1.55, 4.6); // calendar
  glow.box(0.02, 0.008, 2.0, '#fff3d0', 6.15, 1.49, 3.6); for (const x of [1.9, 4.6, 5.5, 6.0]) glow.box(0.5, 0.008, 0.02, '#fff3d0', x, 1.49, 5.72);
  const hz = (PZ(1555) + PZ(1650)) / 2;
  glow.box(0.006, 0.18, 0.34, '#ff9a40', KX(1148) - 0.03, 0.45, hz); P.box(0.02, 0.3, 0.16, '#f4f4f4', KX(1148) - 0.04, 0.62, hz + 0.2).box(0.021, 0.04, 0.16, '#c1121f', KX(1148) - 0.04, 0.6, hz + 0.2);

  // ---------- dining room ----------
  const tx = PX(992), tz = PZ(1050);
  P.box(0.5, 0.01, 2.0, '#c1121f', tx, 0.775, tz).box(0.48, 0.012, 0.05, '#d4af37', tx, 0.776, tz - 0.9).box(0.48, 0.012, 0.05, '#d4af37', tx, 0.776, tz + 0.9);
  P.torus(0.16, 0.05, '#1f5a2a', tx, 0.8, tz, Math.PI / 2); for (let i = 0; i < 3; i++) { P.cyl(0.025, 0.025, 0.2, '#f4f1ea', tx + (i - 1) * 0.06, 0.88, tz + (i - 1) * 0.05); glow.cone(0.012, 0.03, '#ffcf60', tx + (i - 1) * 0.06, 1.0, tz + (i - 1) * 0.05); }
  const word = 'MERRY XMAS'; for (let i = 0; i < word.length; i++) { const t = i / (word.length - 1); const x = 1.3 + t * 3.0, y = 2.35 - Math.sin(t * Math.PI) * 0.18; P.cone(0.1, 0.18, i % 2 ? '#c1121f' : '#1f6a3a', x, y - 0.09, -0.52, Math.PI, 0, 0, 3); }
  P.box(3.1, 0.005, 0.005, '#d4af37', 2.8, 2.35, -0.52);
  string([[1.05, 2.4, -5.88], [5.42, 2.4, -5.88], [5.42, 2.4, -0.55]], 36, FAIRY, 0.06);
  const dsk = (PX(1160) + PX(1212)) / 2, dkz = (PZ(1155) + PZ(1300)) / 2;
  P.box(0.1, 0.2, 0.1, '#111', dsk + 0.15, 0.87, dkz - 0.5).box(0.1, 0.2, 0.1, '#111', dsk + 0.15, 0.87, dkz + 0.5); glow.box(0.03, 0.005, 0.12, '#3a86ff', dsk - 0.3, 0.76, dkz);

  // ---------- bathroom ----------
  P.torus(0.08, 0.008, '#c0c0c0', -1.33, 1.2, 4.0, 0, Math.PI / 2).box(0.02, 0.35, 0.18, '#7ab8d8', -1.34, 1.0, 4.0).cyl(0.11, 0.09, 0.25, '#c0c0c0', -1.5, 0.125, 5.75).cyl(0.04, 0.035, 0.12, '#f4f4f4', -2.75, 0.06, 5.75).cyl(0.006, 0.006, 0.3, '#888', -2.75, 0.2, 5.75);
  P.box(0.02, 0.4, 0.3, '#3a2a1a', -2.87, 1.5, 4.6).box(0.005, 0.36, 0.26, '#d8e8f0', -2.86, 1.5, 4.6);
  P.box(0.5, 0.004, 0.4, '#7ab8d8', -2.1, 0.003, 4.6);

  // ---------- under the stairs & garage ----------
  P.box(0.4, 0.3, 0.3, '#c8a070', -2.6, 1.57, -0.12).box(0.3, 0.25, 0.3, '#d8b080', -1.8, 1.55, -0.12);
  P.cyl(0.004, 0.004, 0.2, '#555', -2.1, 2.28, 0.2); glow.sph(0.03, '#555555', -2.1, 2.16, 0.2); // dead bulb
  P.box(0.02, 0.9, 1.6, '#c8a070', -3.07, 1.6, 4.2); for (let i = 0; i < 12; i++) P.box(0.02, 0.15 + rnd() * 0.2, 0.04 + rnd() * 0.05, pick(['#c1121f', '#222', '#888', '#e8b020']), -3.09, 1.85 - Math.floor(i / 6) * 0.4, 3.55 + (i % 6) * 0.26, rnd() * 0.4, 0, 0);
  for (const z of [2.45, 3.25]) P.torus(0.3, 0.025, '#111', -3.2, 1.5, z, 0, Math.PI / 2); P.box(0.03, 0.04, 0.8, '#c1121f', -3.18, 1.6, 2.85).box(0.03, 0.4, 0.04, '#c1121f', -3.18, 1.45, 2.85);
  P.rbox(0.45, 0.3, 0.6, 0.05, '#2d8a3a', -6.9, 0.25, 5.2).cyl(0.012, 0.012, 0.9, '#222', -6.9, 0.6, 4.8, 0.6).cyl(0.1, 0.1, 0.05, '#111', -7.1, 0.1, 5.0, 0, 0, Math.PI / 2).cyl(0.1, 0.1, 0.05, '#111', -6.7, 0.1, 5.0, 0, 0, Math.PI / 2);
  P.box(0.05, 2.2, 0.05, '#c0c0c0', -3.25, 1.1, 1.6, 0, 0, -0.12).box(0.05, 2.2, 0.05, '#c0c0c0', -3.25, 1.1, 2.0, 0, 0, -0.12); for (let i = 0; i < 7; i++) P.box(0.03, 0.03, 0.4, '#c0c0c0', -3.27 + i * 0.03, 0.2 + i * 0.3, 1.8);
  P.box(0.42, 0.4, 0.4, '#3a3a3a', -7.22, 1.24, 5.2).box(0.01, 0.32, 0.36, '#1a1a1a', -7.0, 1.24, 5.2);
  P.rbox(0.58, 1.05, 0.72, 0.03, '#2a4a2a', -3.5, 0.53, 5.5).box(0.6, 0.04, 0.75, '#1f3a1f', -3.5, 1.07, 5.5);
  solid(-3.5, 0.53, 5.5, 0.29, 0.53, 0.36);

  // ---------- conservatory: fairy lights in the roof, rug, plants, the TV glow ----------
  for (let x = 1.2; x <= 5.3; x += 0.68) string([[x, 2.62, -6.2], [x, 2.75, -9.2]], 12, WARM, 0.06);
  P.box(2.4, 0.008, 1.6, '#c8b088', 3.1, 0.004, -7.4); for (let i = 0; i < 6; i++) P.box(2.4, 0.009, 0.03, '#a07a50', 3.1, 0.005, -8.0 + i * 0.25);
  for (const [x, z] of [[1.3, -6.45], [5.15, -6.45], [4.8, -9.1]]) P.cyl(0.18, 0.14, 0.35, '#e8e0d0', x, 0.175, z).sph(0.35, '#3a7a32', x, 0.75, z, 0.7, 1.4, 0.7, 8).sph(0.25, '#4a8a3a', x + 0.1, 1.1, z, 0.6, 1.2, 0.6, 8);
  if (H.consTV) glow.box(0.008, 0.62, 1.12, '#24406a', H.consTV.x - 0.03, H.consTV.y, H.consTV.z);

  // ---------- outside: upper floor, pitched roof, chimney, porch, icicle lights, garden lights, snowman, light-up reindeer ----------
  const brick = M.brick;
  const X0 = xLW, X1 = xR, Z0 = zBack, Z1 = zF, F1 = WALL_H, F2 = 5.0, T = 0.18;
  add(brick, uvBox((X0 + X1) / 2, (F1 + F2) / 2, Z1, X1 - X0 + T, F2 - F1, T, 1.5));
  add(brick, uvBox((X0 + X1) / 2, (F1 + F2) / 2, Z0, X1 - X0 + T, F2 - F1, T, 1.5));
  add(brick, uvBox(X1, (F1 + F2) / 2, (Z0 + Z1) / 2, T, F2 - F1, Z1 - Z0, 1.5));
  add(brick, uvBox(X0, (F1 + F2) / 2, (Z0 + Z1) / 2, T, F2 - F1, Z1 - Z0, 1.5));
  // seal above the ground-floor ceilings (with the stairwell cut out)
  const cw0 = xGS - 0.09, cw1 = xHW + 0.09, cz0 = zMid - 0.09, cz1 = zBT + 0.09;
  add(M.ceiling, uvBox((X0 + cw0) / 2, F1 + 0.12, (Z0 + Z1) / 2, cw0 - X0, 0.02, Z1 - Z0, 3)); add(M.ceiling, uvBox((cw1 + X1) / 2, F1 + 0.12, (Z0 + Z1) / 2, X1 - cw1, 0.02, Z1 - Z0, 3));
  add(M.ceiling, uvBox((cw0 + cw1) / 2, F1 + 0.12, (Z0 + cz0) / 2, cw1 - cw0, 0.02, cz0 - Z0, 3)); add(M.ceiling, uvBox((cw0 + cw1) / 2, F1 + 0.12, (cz1 + Z1) / 2, cw1 - cw0, 0.02, Z1 - cz1, 3));
  // upstairs windows: warm-lit at night, with frames and sills
  let wi = 0; const upWin = (x, z) => { const w = 1.0, h = 1.1, y = 3.85; const lit = [1, 0, 1, 0, 0, 1][wi++ % 6]; glow.box(w, h, 0.01, lit ? '#e8a860' : '#121626', x, y, z); if (lit) { glow.box(0.28, h, 0.012, '#8a3a2a', x - 0.36, y, z + Math.sign(z) * 0.002).box(0.28, h, 0.012, '#8a3a2a', x + 0.36, y, z + Math.sign(z) * 0.002); } P.box(w + 0.1, 0.06, 0.08, WHITE, x, y - h / 2 - 0.03, z).box(w + 0.1, 0.06, 0.08, WHITE, x, y + h / 2 + 0.03, z).box(0.06, h, 0.08, WHITE, x - w / 2, y, z).box(0.06, h, 0.08, WHITE, x + w / 2, y, z).box(0.04, h, 0.06, WHITE, x, y, z); };
  for (const x of [-4.4, -0.2, 3.4]) { upWin(x, Z1 + 0.1); upWin(x, Z0 - 0.1); }
  H.upWindows = true;
  // pitched roof (ridge along x), tiles
  const roofMat = new THREE.MeshStandardMaterial({ map: TX.tiles('roof', '#4a3a36', '#5a4440', 12, '#2a201c'), roughness: 0.9 });
  const ridgeY = F2 + 4.0, halfD = (Z1 - Z0) / 2 + 0.35, len = X1 - X0 + 0.6, slope = Math.hypot(halfD, ridgeY - F2);
  const ang = Math.atan2(ridgeY - F2, halfD);
  for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(len, 0.08, slope); g.rotateX(s * ang); g.translate((X0 + X1) / 2, (F2 + ridgeY) / 2, (Z0 + Z1) / 2 + s * halfD / 2); const m = new THREE.Mesh(g, roofMat); m.castShadow = true; G.scene.add(m); }
  for (const xe of [X0 - 0.3, X1 + 0.3]) { const sh = new THREE.Shape(); sh.moveTo(-halfD + 0.35, 0); sh.lineTo(halfD - 0.35, 0); sh.lineTo(0, ridgeY - F2 - 0.05); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(xe + (xe < 0 ? 0.3 : -0.42), F2, (Z0 + Z1) / 2); g.deleteAttribute('uv'); const pp = g.attributes.position, uv = new Float32Array(pp.count * 2); for (let i = 0; i < pp.count; i++) { uv[i * 2] = pp.getZ(i) / 1.5; uv[i * 2 + 1] = pp.getY(i) / 1.5; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); add(brick, g); }
  P.box(len, 0.12, 0.2, '#3a2e2a', (X0 + X1) / 2, ridgeY, (Z0 + Z1) / 2);
  { const cx = PX(205), cz = fz, rh = F2 + (ridgeY - F2) * (1 - Math.abs(cz - (Z0 + Z1) / 2) / halfD);
    P.box(0.7, 1.9, 0.9, '#9a5a3a', cx + 0.3, rh + 0.3, cz).box(0.8, 0.1, 1.0, '#7a4a32', cx + 0.3, rh + 1.27, cz).cyl(0.1, 0.1, 0.35, '#b86a42', cx + 0.3, rh + 1.47, cz - 0.2).cyl(0.1, 0.1, 0.35, '#b86a42', cx + 0.3, rh + 1.47, cz + 0.2); }
  // gutters + icicle lights all round the eaves
  for (const z of [Z0 - 0.3, Z1 + 0.3]) { P.cyl(0.06, 0.06, len, '#e8e8e8', (X0 + X1) / 2, F2 - 0.05, z, 0, 0, Math.PI / 2, 8); for (let i = 0; i < 70; i++) { const x = X0 - 0.2 + i * (len / 70); const l = 0.08 + (i % 4) * 0.06; glow.cyl(0.004, 0.012, l, '#e8f4ff', x, F2 - 0.12 - l / 2, z); } }
  // garage (single storey beyond the house line): flat felt roof + icicles
  const gx0 = PX(40) - 0.09;
  add(M.tarmac, uvBox((gx0 + X0) / 2, 2.62, (zMid + zF) / 2, X0 - gx0 + 0.1, 0.12, zF - zMid + 0.3, 3));
  for (let i = 0; i < 9; i++) { const x = gx0 + 0.1 + i * 0.19; const l = 0.08 + (i % 3) * 0.07; glow.cyl(0.004, 0.012, l, '#e8f4ff', x, 2.5 - l / 2, zF + 0.15); }
  // the kitchen extension's flat roof + icicles
  { const k0 = X1, k1 = KX(1222) + 0.09; add(M.tarmac, uvBox((k0 + k1) / 2 + 0.05, 2.62, (zMid + zF) / 2, k1 - k0 + 0.1, 0.12, zF - zMid + 0.3, 3)); for (let i = 0; i < 5; i++) { const l = 0.08 + (i % 3) * 0.07; glow.cyl(0.004, 0.012, l, '#e8f4ff', k0 + 0.1 + i * 0.18, 2.5 - l / 2, zF + 0.15); } }
  // bay window lead roof
  P.box(BAY[3][0] - BAY[0][0] + 0.2, 0.1, 1.2, '#4a4a50', (BAY[0][0] + BAY[3][0]) / 2, 2.6, (BAY[0][1] + BAY[1][1]) / 2 - 0.05, -0.25);
  // front porch canopy, lantern, house number, wheelie bins, outdoor trees with lights
  P.box(1.5, 0.08, 0.9, '#3a2e2a', 0, 2.35, 6.5, 0.12).box(0.06, 0.4, 0.06, WHITE, -0.7, 2.15, 6.9).box(0.06, 0.4, 0.06, WHITE, 0.7, 2.15, 6.9);
  P.box(0.14, 0.24, 0.14, '#1a1a1a', 0.7, 1.75, 6.16); glow.box(0.1, 0.16, 0.1, '#ffd890', 0.7, 1.73, 6.16);
  P.box(0.2, 0.12, 0.01, '#1a1a1a', -0.7, 1.95, 6.1); glow.box(0.04, 0.08, 0.005, '#d4af37', -0.73, 1.95, 6.11).box(0.04, 0.08, 0.005, '#d4af37', -0.67, 1.95, 6.11);
  for (const [x, c] of [[-2.6, '#2a2a2a'], [-2.0, '#1d5a2a'], [-1.4, '#1d3a6a']]) P.rbox(0.55, 1.05, 0.65, 0.04, c, x, 0.53, 6.65).box(0.57, 0.04, 0.7, c, x, 1.07, 6.65);
  for (const [x, z] of [[3.2, 8.4], [-2.2, 8.8]]) { P.cyl(0.08, 0.1, 0.8, '#4a3420', x, 0.4, z); for (let k = 0; k < 4; k++) P.cone(0.9 - k * 0.18, 0.8, '#1f4a22', x, 1.0 + k * 0.45, z, 0, 0, 0, 10); for (let i = 0; i < 40; i++) { const t = i / 40; const a = t * Math.PI * 9; const r2 = 0.85 * (1 - t) + 0.08; bulbs.push([x + Math.cos(a) * r2, 0.75 + t * 1.8, z + Math.sin(a) * r2, pick(FAIRY)]); } }
  // garden: path lights along the lawn edge, snowman, light-up reindeer, trampoline, fence fairy lights
  for (let i = 0; i < 8; i++) { const t = i / 7; const x = PX(795) + (PX(48) - PX(795)) * t, z = PZ(405) + (PZ(550) - PZ(405)) * (t * t * 0.55 + t * 0.45) - 0.25; P.cyl(0.02, 0.02, 0.4, '#222', x, 0.2, z); glow.sph(0.04, '#fff0c0', x, 0.42, z); }
  P.sph(0.42, '#f6f8fa', -5.2, 0.4, -12.2, 1, 0.95, 1, 14).sph(0.3, '#f6f8fa', -5.2, 1.0, -12.2, 1, 1, 1, 12).sph(0.2, '#f6f8fa', -5.2, 1.45, -12.2, 1, 1, 1, 12).cone(0.035, 0.18, '#f77f00', -5.2, 1.45, -12.0, Math.PI / 2, 0, 0, 8).sph(0.025, '#111', -5.27, 1.52, -12.03).sph(0.025, '#111', -5.13, 1.52, -12.03).torus(0.2, 0.04, '#c1121f', -5.2, 1.22, -12.2, Math.PI / 2).cyl(0.16, 0.16, 0.22, '#111', -5.2, 1.7, -12.2).cyl(0.22, 0.22, 0.03, '#111', -5.2, 1.6, -12.2);
  solid(-5.2, 0.7, -12.2, 0.4, 0.7, 0.4);
  for (const [x, z, r2] of [[-1.0, -13.4, 0.4], [0.1, -13.8, -0.3]]) { const c = Math.cos(r2), s = Math.sin(r2);
    glow.box(0.05, 0.3, 0.7, '#f8f0d8', x, 0.75, z, 0, r2).box(0.05, 0.25, 0.25, '#f8f0d8', x + 0.6 * s, 1.0, z + 0.6 * c, 0, r2).box(0.03, 0.4, 0.03, '#f8f0d8', x + 0.3 * s, 0.3, z + 0.3 * c).box(0.03, 0.4, 0.03, '#f8f0d8', x - 0.25 * s, 0.3, z - 0.25 * c).box(0.03, 0.25, 0.2, '#f8f0d8', x + 0.62 * s, 1.3, z + 0.62 * c, 0, r2); }
  P.cyl(1.3, 1.3, 0.08, '#1a1a1a', 3.4, 0.85, -12.6, 0, 0, 0, 28).torus(1.35, 0.05, '#2a6aa8', 3.4, 0.88, -12.6, Math.PI / 2); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P.cyl(0.03, 0.03, 0.85, '#888', 3.4 + Math.cos(a) * 1.3, 0.42, -12.6 + Math.sin(a) * 1.3); }
  staticBox(3.4, 0.86, -12.6, 1.2, 0.05, 1.2);
  const gL = PX(36) + 0.06, gR = PX(1228) - 0.06, gT = PZ(16) + 0.06;
  string([[gL, 1.8, gT], [gR, 1.8, gT]], 80, FAIRY, 0.15); string([[gR, 1.8, gT], [gR, 1.8, PZ(502)]], 30, FAIRY, 0.12); string([[gL, 1.8, gT], [gL, 1.8, zMid]], 80, FAIRY, 0.12);

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
  // framed family photos up the stair wall and along the hall (textured)
  const frameMat = (seed) => new THREE.MeshStandardMaterial({ map: TX.photo(seed), roughness: 0.5 });
  [[-2.86, 1.9, 2.2, 1], [-2.86, 2.3, 1.7, 1], [-2.86, 2.7, 1.2, 1], [-2.86, 3.1, 0.9, 1], [1.31, 1.6, 4.0, -1], [1.31, 1.6, 0.4, -1]].forEach(([x, y, z, f], i) => {
    P.box(0.03, 0.34, 0.28, '#3a2a1a', x, y, z);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3), frameMat(20 + i)); m.position.set(x + f * 0.02, y, z); m.rotation.y = f > 0 ? Math.PI / 2 : -Math.PI / 2; G.scene.add(m);
  });
  // kitchen calendar texture ("BOXING DAY — QUIZ!" circled)
  const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.3), new THREE.MeshStandardMaterial({ map: TX.label('cal', 260, 300, '#ffffff', [{ text: 'DECEMBER', size: 30, bold: true, color: '#c1121f', y: 30 }, { text: '26 — QUIZ!!', size: 30, bold: true, color: '#1d3557', y: 150 }, { text: '(Martin\'s house)', size: 20, color: '#333', y: 200 }]) }));
  cal.position.set(1.55, 1.52, 4.6); cal.rotation.y = Math.PI / 2; G.scene.add(cal);
}
