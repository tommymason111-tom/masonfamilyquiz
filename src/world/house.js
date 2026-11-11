// Martin's house (ground floor), built to the doc: hallway + front door, downstairs toilet (left), stairs
// with Mason's gate, under-stairs cupboard -> garage, kitchen (right), living room (ahead) with the TV in
// the far corner and the tree in the bay window, dining/games room, conservatory and the garden + patio.
import * as THREE from 'three';
import { G, GR, groups, ALL, rand, mulberry, noise3 } from '../core.js';
import { uvBox, worldUV, mergeGeometries, Prop, RoundedBoxGeometry } from '../engine/geo.js';
import * as TX from '../engine/textures.js';
import { staticBox, staticCyl } from '../engine/physics.js';
import { buildDecor } from './decor.js';
import { buildLights, buildNight, setNight } from './night.js';

const WALL_H = 2.5, WT = 0.18;
// The layout follows Martin & Julie's floor plan exactly: plan pixels -> metres (90 px = 1 m).
// x grows to the right of the plan (garage on the left, kitchen on the right), z grows towards the front door.
export const PX = (px) => (px - 722) / 90, PZ = (py) => 6 + (py - 1887) / 90;
// the kitchen is a single-storey extension a bit wider than the plan: everything on its right-hand side shifts by KW
export const KW = 0.9, KX = (px) => PX(px) + KW;
export const ROOMS = {
  hall: { x0: -1.13, x1: 1.33, z0: -0.39, z1: 5.92, label: 'Hallway' },
  hallTop: { x0: 1.33, x1: 1.92, z0: -0.39, z1: 0.72, label: 'Hallway' },
  under: { x0: -2.88, x1: -1.31, z0: -0.3, z1: 0.62, label: 'Under the stairs' },
  stairs: { x0: -2.88, x1: -1.31, z0: 0.62, z1: 3.26, label: 'Stairs' },
  toilet: { x0: -2.88, x1: -1.31, z0: 3.43, z1: 5.92, label: 'Bathroom' },
  garage: { x0: -7.49, x1: -3.06, z0: -0.3, z1: 5.92, label: 'Garage' },
  kitchen: { x0: 1.51, x1: 6.37, z0: -0.3, z1: 5.92, label: 'Kitchen' },
  living: { x0: -5.78, x1: 0.81, z0: -5.93, z1: -0.39, label: 'Living room' },
  bay: { x0: -3.8, x1: -1.13, z0: -6.97, z1: -5.93, label: 'Bay window' },
  dining: { x0: 0.99, x1: 5.47, z0: -5.93, z1: -0.48, label: 'Dining room' },
  conservatory: { x0: 0.99, x1: 5.47, z0: -9.3, z1: -6.11, label: 'Conservatory' },
  garden: { x0: -7.5, x1: 5.6, z0: -14.75, z1: -6.02, label: 'Garden' },
  patioSide: { x0: -7.5, x1: -5.96, z0: -6.02, z1: -0.48, label: 'Patio' },
};

export function roomAt(x, z) {
  for (const k of ['toilet', 'stairs', 'under', 'garage', 'hall', 'hallTop', 'kitchen', 'bay', 'living', 'dining', 'conservatory']) {
    const r = ROOMS[k]; if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return k === 'hallTop' ? 'hall' : k === 'under' ? 'cupboard' : k;
  }
  for (const k of ['garden', 'patioSide']) { const g = ROOMS[k]; if (x >= g.x0 && x <= g.x1 && z >= g.z0 && z <= g.z1) return 'garden'; }
  return null;
}

export function buildHouse() {
  const H = { meshes: [], spots: {}, doors: [], lights: {}, screens: {}, interact: [] };
  G.house = H;
  const scene = G.scene;
  // ---------- materials ----------
  const M = {
    oak: new THREE.MeshStandardMaterial({ map: TX.oakFloor(), roughness: 0.45, metalness: 0.0 }),
    paintLiving: new THREE.MeshStandardMaterial({ map: TX.paint('living', '#d9d0c1'), roughness: 0.9 }),
    paintHall: new THREE.MeshStandardMaterial({ map: TX.wallpaper('hall', '#e3dccd', '#b8a888'), roughness: 0.9 }),
    paintKitchen: new THREE.MeshStandardMaterial({ map: TX.paint('kitchen', '#eef0ea'), roughness: 0.85 }),
    paintDining: new THREE.MeshStandardMaterial({ map: TX.paint('dining', '#9fb0a0'), roughness: 0.9 }),
    paintToilet: new THREE.MeshStandardMaterial({ map: TX.paint('toilet', '#c8d8e0'), roughness: 0.9 }),
    garageWall: new THREE.MeshStandardMaterial({ map: TX.brick(), roughness: 1, color: '#9a9a9a' }),
    brick: new THREE.MeshStandardMaterial({ map: TX.brick(), roughness: 1 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 1 }),
    tileFloor: new THREE.MeshStandardMaterial({ map: TX.tiles('kfloor', '#d8d8d4', '#cacac6', 6, '#9a9a96'), roughness: 0.45 }),
    bathFloor: new THREE.MeshStandardMaterial({ map: TX.tiles('bfloor', '#9a9a9a', '#8a8a8a', 8, '#6a6a6a'), roughness: 0.5 }),
    tileWall: new THREE.MeshStandardMaterial({ map: TX.tiles('kwall', '#f4f4f0', '#ececE6', 10, '#bbb'), roughness: 0.35 }),
    tileCons: new THREE.MeshStandardMaterial({ map: TX.oakFloor(), roughness: 0.5, color: '#e8c8a0' }),
    concrete: new THREE.MeshStandardMaterial({ map: TX.concrete(), roughness: 1 }),
    grass: new THREE.MeshStandardMaterial({ map: TX.grass(), roughness: 1 }),
    slabs: new THREE.MeshStandardMaterial({ map: TX.slabs(), roughness: 0.95 }),
    tarmac: new THREE.MeshStandardMaterial({ color: '#3a3a3c', roughness: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: '#cfe4ee', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false }),
    frame: new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.5 }),
    worktop: new THREE.MeshStandardMaterial({ map: TX.paint('granite', '#f2f2ee', 0.12), roughness: 0.25, metalness: 0.05 }),
    skirting: new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.6 }),
    rug: new THREE.MeshStandardMaterial({ map: TX.carpet('living', '#e4dccf', '#cfc4b2'), roughness: 1 }),
    props: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
    fabricSofa: new THREE.MeshStandardMaterial({ map: TX.fabric('sofa', '#4a5560'), roughness: 1 }),
    oakWood: new THREE.MeshStandardMaterial({ map: TX.oakWood('dark', [62, 38, 22]), roughness: 0.55 }),
    fence: new THREE.MeshStandardMaterial({ map: TX.oakWood('fence', [105, 80, 55]), roughness: 1 }),
  };
  H.M = M;
  const statics = new Map(); // material -> [geometries]
  const add = (mat, g) => { if (!statics.has(mat)) statics.set(mat, []); statics.get(mat).push(g); };
  const props = new Prop();
  const solid = (cx, cy, cz, hx, hy, hz, q) => staticBox(cx, cy, cz, hx, hy, hz, q);

  // ---------- floors & ceilings ----------
  const floor = (r, mat, s = 1.2, y = 0) => { add(mat, uvBox((r.x0 + r.x1) / 2, y - 0.05, (r.z0 + r.z1) / 2, r.x1 - r.x0, 0.1, r.z1 - r.z0, s)); };
  const ceil = (r, h = WALL_H) => add(M.ceiling, uvBox((r.x0 + r.x1) / 2, h + 0.05, (r.z0 + r.z1) / 2, r.x1 - r.x0, 0.1, r.z1 - r.z0, 2));
  // flat polygon (x,z points) as a floor/ground slab with world UVs
  const poly = (pts, mat, y, s = 1.2) => { const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))); const g = new THREE.ShapeGeometry(sh, 24); g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
    const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / s, p.getZ(i) / s); add(mat, g); return g; };
  floor(ROOMS.hall, M.oak); floor(ROOMS.hallTop, M.oak); floor(ROOMS.stairs, M.oak); floor(ROOMS.living, M.oak, 1.6); floor(ROOMS.dining, M.oak, 1.6);
  // kitchen floor stops where the hall's corner by the dining door begins (no two floors fighting there)
  floor({ x0: 1.51, x1: 6.37, z0: 0.72, z1: 5.92 }, M.oak, 1.6); floor({ x0: 2.01, x1: 6.37, z0: -0.3, z1: 0.72 }, M.oak, 1.6); floor(ROOMS.toilet, M.bathFloor, 0.9); floor(ROOMS.under, M.concrete, 2); floor(ROOMS.garage, M.concrete, 3);
  floor(ROOMS.conservatory, M.tileCons, 1.5);
  // the bay is a trapezoid (angled sides)
  const BAY = [[PX(380), PZ(805)], [PX(430), PZ(722)], [PX(575), PZ(722)], [PX(620), PZ(805)]];
  poly([[BAY[0][0], -5.9], ...BAY.slice(1, 3), [BAY[3][0], -5.9]], M.oak, 0.0, 1.6);
  for (const k of ['hall', 'hallTop', 'toilet', 'kitchen', 'living', 'dining', 'garage']) ceil(ROOMS[k]);
  ceil(ROOMS.under, 2.38);
  add(M.ceiling, (() => { const g = poly([[BAY[0][0], -5.9], ...BAY.slice(1, 3), [BAY[3][0], -5.9]], M.ceiling, WALL_H + 0.0); return g; })());
  // one big floor collider
  solid(0, -0.1, -4, 40, 0.1, 40).collider.setFriction(0.55);
  // ---------- outside ground: lawn, the patio (L-shape with the curved lawn edge), drive, front path, porch ----------
  add(M.grass, uvBox((PX(40) + PX(1232)) / 2, -0.06, (PZ(15) + PZ(1312)) / 2, PX(1232) - PX(40), 0.1, PZ(1312) - PZ(15), 3));
  { const pts = [[PX(48), PZ(1300)], [PX(185), PZ(1300)], [PX(185), PZ(800)], [PX(795), PZ(800)], [PX(795), PZ(405)]];
    // the curved lawn edge from (795,405) sweeping down to (48,550)
    for (let i = 1; i <= 16; i++) { const t = i / 16; const x = PX(795) + (PX(48) - PX(795)) * t; const z = PZ(405) + (PZ(550) - PZ(405)) * (t * t * 0.55 + t * 0.45); pts.push([x, z]); }
    poly(pts, M.slabs, 0.004, 1.4); }
  add(M.tarmac, uvBox(PX(246), -0.04, 9.2, PX(420) - PX(70), 0.06, 6.2, 3));   // drive in front of the garage
  add(M.slabs, uvBox(0, -0.02, 9.5, 1.3, 0.06, 5.2, 1));                        // front path
  add(M.concrete, uvBox(0, 0.03, (PZ(1895) + PZ(1975)) / 2, PX(808) - PX(636), 0.08, PZ(1975) - PZ(1895), 1)); solid(0, 0.03, (PZ(1895) + PZ(1975)) / 2, (PX(808) - PX(636)) / 2, 0.04, (PZ(1975) - PZ(1895)) / 2);

  // ---------- walls ----------
  // wall along X at z, from x0..x1; sides: matNeg (faces -z), matPos (faces +z); openings [{a,b,bottom,top,glass}]
  const wallX = (z, x0, x1, matNeg, matPos, ops = [], h = WALL_H) => wallRun('x', z, x0, x1, matNeg, matPos, ops, h);
  const wallZ = (x, z0, z1, matNeg, matPos, ops = [], h = WALL_H) => wallRun('z', x, z0, z1, matNeg, matPos, ops, h);
  function wallRun(axis, c, a0, a1, mNeg, mPos, ops, h) {
    ops = ops.slice().sort((p, q) => p.a - q.a);
    const pieces = []; let cur = a0;
    for (const o of ops) { if (o.a > cur) pieces.push([cur, o.a, 0, h]); if (o.bottom > 0) pieces.push([o.a, o.b, 0, o.bottom]); if (o.top < h) pieces.push([o.a, o.b, o.top, h]); cur = o.b;
      if (o.glass) glassPane(axis, c, o.a, o.b, o.bottom, o.top);
      if (o.bottom === 0) add(M.oak, axis === 'x' ? uvBox((o.a + o.b) / 2, -0.049, c, o.b - o.a, 0.1, WT + 0.04, 1.2) : uvBox(c, -0.049, (o.a + o.b) / 2, WT + 0.04, 0.1, o.b - o.a, 1.2)); } // threshold: no gap under doorways
    if (cur < a1) pieces.push([cur, a1, 0, h]);
    for (const [p0, p1, y0, y1] of pieces) {
      const len = p1 - p0, mid = (p0 + p1) / 2, ym = (y0 + y1) / 2, hh = y1 - y0;
      if (axis === 'x') {
        add(mNeg, uvBox(mid, ym, c - WT / 4, len, hh, WT / 2, 1.5)); add(mPos, uvBox(mid, ym, c + WT / 4, len, hh, WT / 2, 1.5));
        solid(mid, ym, c, len / 2, hh / 2, WT / 2);
        if (y0 === 0) { add(M.skirting, uvBox(mid, 0.06, c - WT / 2 - 0.008, len, 0.12, 0.016)); add(M.skirting, uvBox(mid, 0.06, c + WT / 2 + 0.008, len, 0.12, 0.016)); }
      } else {
        add(mNeg, uvBox(c - WT / 4, ym, mid, WT / 2, hh, len, 1.5)); add(mPos, uvBox(c + WT / 4, ym, mid, WT / 2, hh, len, 1.5));
        solid(c, ym, mid, WT / 2, hh / 2, len / 2);
        if (y0 === 0) { add(M.skirting, uvBox(c - WT / 2 - 0.008, 0.06, mid, 0.016, 0.12, len)); add(M.skirting, uvBox(c + WT / 2 + 0.008, 0.06, mid, 0.016, 0.12, len)); }
      }
    }
  }
  function glassPane(axis, c, a, b, y0, y1) {
    const len = b - a, mid = (a + b) / 2, ym = (y0 + y1) / 2;
    const g = axis === 'x' ? new THREE.BoxGeometry(len, y1 - y0, 0.02) : new THREE.BoxGeometry(0.02, y1 - y0, len);
    const m = new THREE.Mesh(g, M.glass); m.position.set(axis === 'x' ? mid : c, ym, axis === 'x' ? c : mid); m.renderOrder = 10; scene.add(m);
    const sb = axis === 'x' ? staticBox(mid, ym, c, len / 2, (y1 - y0) / 2, 0.03, null, { tag: 'glass', restitution: 0.3 }) : staticBox(c, ym, mid, 0.03, (y1 - y0) / 2, len / 2, null, { tag: 'glass', restitution: 0.3 });
    G.colliderMap.get(sb.collider.handle).tag = 'glass';
    const f = 0.05;
    if (axis === 'x') { props.box(len + f, f, 0.08, '#f4f4f4', mid, y0, c); props.box(len + f, f, 0.08, '#f4f4f4', mid, y1, c); props.box(f, y1 - y0, 0.08, '#f4f4f4', a, ym, c); props.box(f, y1 - y0, 0.08, '#f4f4f4', b, ym, c); props.box(0.03, y1 - y0, 0.06, '#f4f4f4', mid, ym, c); props.box(len + 0.1, 0.04, 0.22, '#f4f4f4', mid, y0 - 0.02, c); }
    else { props.box(0.08, f, len + f, '#f4f4f4', c, y0, mid); props.box(0.08, f, len + f, '#f4f4f4', c, y1, mid); props.box(0.08, y1 - y0, f, '#f4f4f4', c, ym, a); props.box(0.08, y1 - y0, f, '#f4f4f4', c, ym, b); props.box(0.06, y1 - y0, 0.03, '#f4f4f4', c, ym, mid); props.box(0.22, 0.04, len + 0.1, '#f4f4f4', c, y0 - 0.02, mid); }
  }
  // an angled wall segment (the bay) with one window: brick outside, paint inside
  function wallSeg(x0, z0, x1, z1, win) {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang, 0));
    const part = (y0, y1, mat, off) => { const g = new THREE.BoxGeometry(WT / 2, y1 - y0, len + 0.02); worldUV(g, 1.5); g.rotateY(ang); g.translate(cx + Math.cos(ang) * off, (y0 + y1) / 2, cz - Math.sin(ang) * off); add(mat, g); };
    for (const [y0, y1] of [[0, win[0]], [win[1], WALL_H]]) { part(y0, y1, M.paintLiving, -WT / 4); part(y0, y1, M.brick, WT / 4); staticBox(cx, (y0 + y1) / 2, cz, WT / 2, (y1 - y0) / 2, len / 2, q); }
    const gm = new THREE.Mesh(new THREE.BoxGeometry(0.02, win[1] - win[0], len - 0.06), M.glass); gm.position.set(cx, (win[0] + win[1]) / 2, cz); gm.rotation.y = ang; gm.renderOrder = 10; scene.add(gm);
    const sb = staticBox(cx, (win[0] + win[1]) / 2, cz, 0.03, (win[1] - win[0]) / 2, len / 2, q, { tag: 'glass', restitution: 0.3 }); G.colliderMap.get(sb.collider.handle).tag = 'glass';
    for (const y of [win[0], win[1]]) props.box(0.08, 0.05, len, '#f4f4f4', cx, y, cz, 0, ang); for (const t of [-0.5, 0, 0.5]) props.box(0.08, win[1] - win[0], 0.04, '#f4f4f4', cx + Math.sin(ang) * t * len, (win[0] + win[1]) / 2, cz + Math.cos(ang) * t * len, 0, ang);
    props.box(0.26, 0.04, len, '#f4f4f4', cx - Math.cos(ang) * 0.08, win[0] - 0.02, cz + Math.sin(ang) * 0.08, 0, ang);
  }
  const door = (a, b) => ({ a, b, bottom: 0, top: 2.05 });
  const win = (a, b, bottom = 0.9, top = 2.1) => ({ a, b, bottom, top, glass: true });
  const opening = (a, b, top = 2.1) => ({ a, b, bottom: 0, top });
  // key wall lines (plan centre-lines)
  const xGL = PX(40), xGS = PX(455), xHW = PX(612), xLW = PX(194), xLD = PX(803), xHE = PX(850), xNT = PX(903), xR = PX(1222), xK = KX(1222);
  const zF = PZ(1887), zMid = PZ(1312), zUS = PZ(1410), zBT = PZ(1648), zNT = PZ(1420), zBack = PZ(805), zCB = PZ(502);
  // Front wall: garage (up-and-over door) | bathroom | hall (front door) | kitchen (sink window)
  wallX(zF, xGL, xGS, M.garageWall, M.brick, [{ a: PX(103), b: PX(390), bottom: 0, top: 2.1 }]);
  add(M.frame, uvBox((PX(103) + PX(390)) / 2, 1.05, zF, PX(390) - PX(103), 2.1, 0.06)); solid((PX(103) + PX(390)) / 2, 1.05, zF, (PX(390) - PX(103)) / 2, 1.05, 0.05);
  for (let i = 0; i < 6; i++) props.box(PX(390) - PX(103) - 0.05, 0.02, 0.02, '#d8d8d8', (PX(103) + PX(390)) / 2, 0.2 + i * 0.35, zF - 0.04);
  wallX(zF, xGS, xHW, M.paintToilet, M.brick, [win(PX(500), PX(570), 1.4, 2.0)]);
  wallX(zF, xHW, xHE, M.paintHall, M.brick, [door(PX(683), PX(762))]);
  wallX(zF, xHE, xK + WT / 2, M.tileWall, M.brick, [win(PX(912), PX(1072), 1.05, 2.1)]);
  // garage: outer west wall, north wall (window onto the side patio)
  wallZ(xGL, zMid, zF, M.brick, M.garageWall);
  wallX(zMid, xGL, xLW, M.brick, M.garageWall, [door(-7.2, -6.35)]);
  // the side door from the patio into the garage, left open (swung back against the inside)
  props.box(0.05, 2.0, 0.82, '#5a4632', -7.17, 1.0, zMid + 0.5).box(0.06, 0.02, 0.1, '#c0a050', -7.14, 1.0, zMid + 0.85).box(0.01, 0.55, 0.3, '#bcd0d8', -7.145, 1.5, zMid + 0.5);
  solid(-7.17, 1.0, zMid + 0.5, 0.025, 1.0, 0.41);
  // the long east-west wall: living room above, garage + under-stairs below
  wallX(zMid, xLW, xGS, M.paintLiving, M.garageWall);
  wallX(zMid, xGS, xHW, M.paintLiving, M.paintHall);
  // hall | living room: wall with a doorway, the door left open (swung back into the lounge)
  wallX(zMid, xHW, xLD, M.paintLiving, M.paintHall, [door(-0.75, 0.15)]);
  props.box(0.05, 2.0, 0.84, '#f4f1ea', 0.12, 1.0, zMid - 0.51).box(0.06, 0.02, 0.1, '#c0a050', 0.09, 1.0, zMid - 0.86);
  for (const y of [0.55, 1.45]) props.box(0.055, 0.6, 0.6, '#ebe7de', 0.12, y, zMid - 0.51);
  solid(0.12, 1.0, zMid - 0.51, 0.025, 1.0, 0.42);
  // garage | under-stairs/stairs/bathroom (door through the under-stairs cupboard into the garage)
  wallZ(xGS, zMid, zUS, M.garageWall, M.paintHall, [door(PZ(1340), PZ(1400))]);
  wallZ(xGS, zUS, zBT, M.garageWall, M.paintHall);
  wallZ(xGS, zBT, zF, M.garageWall, M.paintToilet);
  // hall west wall: under-stairs door, the way onto the stairs, bathroom door
  wallZ(xHW, zMid, zUS, M.paintHall, M.paintHall, [door(PZ(1340), PZ(1400))]);
  wallZ(xHW, zUS, zBT, M.paintHall, M.paintHall, [opening(PZ(1575), PZ(1640), 2.1)]);
  wallZ(xHW, zBT, zF, M.paintToilet, M.paintHall, [door(PZ(1740), PZ(1800))]);
  // under-stairs / stairs, stairs-landing / bathroom
  wallX(zUS, xGS, xHW, M.paintHall, M.paintHall, [], 2.38);
  wallX(zBT, xGS, xHW, M.paintHall, M.paintToilet);
  // the cupboard beside the stairs (a closed box)
  { const x0 = PX(540), x1 = PX(605), z0 = PZ(1418), z1 = PZ(1566); add(M.paintHall, uvBox((x0 + x1) / 2, WALL_H / 2, (z0 + z1) / 2, x1 - x0, WALL_H, z1 - z0, 1.5)); solid((x0 + x1) / 2, WALL_H / 2, (z0 + z1) / 2, (x1 - x0) / 2, WALL_H / 2, (z1 - z0) / 2);
    props.box(0.02, 1.9, z1 - z0 - 0.2, '#f4f1ea', x0 - 0.005, 0.95, (z0 + z1) / 2).sph(0.025, '#c8a050', x0 - 0.03, 1.0, z1 - 0.25); }
  // hall east wall (kitchen door) and the little notch at the top of the hall
  wallZ(xHE, zNT, zF, M.paintHall, M.tileWall, [door(PZ(1500), PZ(1565))]);
  wallX(zNT, xHE, xNT, M.paintHall, M.tileWall);
  wallZ(xNT, zMid, zNT, M.paintHall, M.tileWall);
  // dining room: wall down to the hall (door at the bottom-left), wall to the kitchen
  wallX(zMid, xLD, xNT, M.paintDining, M.paintHall, [door(PX(822), PX(880))]);
  wallX(zMid, xNT, xR, M.paintDining, M.tileWall);
  wallX(zMid, xR, xK + WT / 2, M.brick, M.tileWall); // the extension's back wall
  wallZ(xLD, zBack, zMid, M.paintLiving, M.paintDining);
  // outside east wall: kitchen + dining
  wallZ(xK, zMid, zF, M.tileWall, M.brick);
  wallZ(xR, zBack, zMid, M.paintDining, M.brick);
  // living room: west wall (chimney breast), back wall with two windows and the bay
  wallZ(xLW, zBack, zMid, M.brick, M.paintLiving);
  wallX(zBack, xLW, BAY[0][0], M.brick, M.paintLiving, [win(PX(232), PX(372), 0.9, 2.1)]);
  wallX(zBack, BAY[3][0], xLD, M.brick, M.paintLiving, [win(PX(626), PX(758), 0.9, 2.1)]);
  wallSeg(BAY[0][0], BAY[0][1], BAY[1][0], BAY[1][1], [0.55, 2.2]); wallSeg(BAY[1][0], BAY[1][1], BAY[2][0], BAY[2][1], [0.55, 2.2]); wallSeg(BAY[2][0], BAY[2][1], BAY[3][0], BAY[3][1], [0.55, 2.2]);
  // dining | conservatory (open walkway)
  wallX(zBack, xLD, xR, M.brick, M.paintDining, [opening(PX(912), PX(1048), 2.15)]);
  // conservatory: dwarf brick walls with glass above, door out to the patio on the west side, glass roof
  const cons = ROOMS.conservatory;
  const dwarf = 0.6, ch = 2.45;
  wallX(zCB, xLD, xR, M.brick, M.brick, [win(xLD + 0.15, xR - 0.15, dwarf, ch - 0.05)], ch);
  wallZ(xR, zCB, zBack, M.brick, M.brick, [win(zCB + 0.15, zBack - 0.15, dwarf, ch - 0.05)], ch);
  wallZ(xLD, zCB, zBack, M.brick, M.brick, [win(zCB + 0.15, PZ(587) - 0.05, dwarf, ch - 0.05), opening(PZ(587), PZ(657), 2.1), win(PZ(657) + 0.05, zBack - 0.15, dwarf, ch - 0.05)], ch);
  { const roof = new THREE.Mesh(new THREE.BoxGeometry(xR - xLD + 0.3, 0.02, zBack - zCB + 0.2), M.glass);
    roof.position.set((xLD + xR) / 2, ch + 0.25, (zCB + zBack) / 2); roof.rotation.x = -0.12; roof.renderOrder = 10; scene.add(roof);
    for (let x = xLD; x <= xR + 0.01; x += 0.66) props.box(0.05, 0.08, zBack - zCB + 0.2, '#f6f6f6', x, ch + 0.25, (zCB + zBack) / 2, -0.12);
    staticBox((xLD + xR) / 2, ch + 0.3, (zCB + zBack) / 2, (xR - xLD) / 2, 0.05, (zBack - zCB) / 2); }
  H.cons = { x0: xLD, x1: xR, z0: zCB, z1: zBack };
  // ---------- garden boundary: close-board fence with a hedge in front of it all the way round ----------
  const fence = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0); const ang = Math.atan2(x1 - x0, z1 - z0);
    add(M.fence, uvBox(0, 0.9, 0, 0.04, 1.8, len, 1).rotateY(ang).translate((x0 + x1) / 2, 0, (z0 + z1) / 2));
    staticBox((x0 + x1) / 2, 0.9, (z0 + z1) / 2, x1 === x0 ? 0.05 : len / 2, 0.9, x1 === x0 ? len / 2 : 0.05);
    for (let t = 0; t <= len; t += 1.8) props.box(0.09, 1.9, 0.09, '#4a3a2a', x0 + (x1 - x0) * t / len, 0.95, z0 + (z1 - z0) * t / len); };
  const gL = PX(36), gR = PX(1228), gT = PZ(16);
  fence(gL, zMid, gL, gT); fence(gL, gT, gR, gT); fence(gR, gT, gR, zCB);
  const rh = mulberry(9); const hedge = (x0, z0, x1, z1, inset) => { const len = Math.hypot(x1 - x0, z1 - z0); for (let t = 0.2; t < len; t += 0.42) { const x = x0 + (x1 - x0) * t / len + inset[0], z = z0 + (z1 - z0) * t / len + inset[1]; const r = 0.38 + rh() * 0.16;
    props.sph(r, ['#3f7a34', '#4b8a3c', '#376c2e'][(rh() * 3) | 0], x, r * 0.85, z, 1, 0.95 + rh() * 0.3, 1, 8); } };
  hedge(gL, PZ(560), gL, gT, [0.38, 0]); hedge(gL, gT, gR, gT, [0, 0.38]); hedge(gR, gT, gR, zCB - 0.1, [-0.38, 0]);
  staticBox(gL + 0.38, 0.5, (PZ(560) + gT) / 2, 0.3, 0.5, (PZ(560) - gT) / 2); staticBox((gL + gR) / 2, 0.5, gT + 0.38, (gR - gL) / 2, 0.5, 0.3); staticBox(gR - 0.38, 0.5, (gT + zCB) / 2, 0.3, 0.5, (zCB - gT) / 2);
  // BBQ on the patio (with its side shelves)
  { const bx = PX(70), bz = PZ(682);
    props.box(0.32, 0.05, 1.12, '#5a5a5a', bx - 0.05, 0.85, bz).cyl(0.36, 0.3, 0.42, '#1f1f1f', bx, 0.75, bz, 0, 0, 0, 20).sph(0.36, '#262626', bx, 0.96, bz, 1, 0.45, 1, 16).cyl(0.02, 0.02, 0.85, '#333', bx - 0.2, 0.42, bz - 0.2).cyl(0.02, 0.02, 0.85, '#333', bx + 0.2, 0.42, bz - 0.2).cyl(0.02, 0.02, 0.85, '#333', bx, 0.42, bz + 0.25);
    for (let i = 0; i < 8; i++) props.box(0.6, 0.012, 0.012, '#888', bx, 0.97, bz - 0.24 + i * 0.07);
    solid(bx, 0.5, bz, 0.4, 0.5, 0.55); }

  // ---------- Hallway ----------
  stairs(props, add, M, solid);
  // coat hooks with coats on the hall east wall near the door
  props.box(1.0, 0.08, 0.03, '#4a3020', xHE - 0.12, 1.75, 4.9, 0, Math.PI / 2);
  ['#2a2a3a', '#7a2a2a', '#3a5a3a', '#b0a080', '#222'].forEach((c, i) => { props.rbox(0.38, 0.95, 0.16, 0.06, c, xHE - 0.17, 1.25, 4.5 + i * 0.2, 0, Math.PI / 2 + rand(-0.1, 0.1), rand(-0.05, 0.05)); });
  // hall console table + radiator + doormat
  props.box(0.3, 0.04, 0.9, '#4a2e1c', xHE - 0.24, 0.85, 3.3).box(0.03, 0.85, 0.03, '#4a2e1c', xHE - 0.37, 0.42, 2.9).box(0.03, 0.85, 0.03, '#4a2e1c', xHE - 0.37, 0.42, 3.7);
  solid(xHE - 0.24, 0.85, 3.3, 0.15, 0.02, 0.45);
  props.box(0.9, 0.02, 0.55, '#6a4a2a', 0, 0.01, 5.55);
  // front door (fixed, with doorbell)
  props.box(0.88, 2.05, 0.06, '#7a1f24', 0, 1.025, zF).box(0.5, 0.55, 0.01, '#bdd7e0', 0, 1.6, zF - 0.035).sph(0.035, '#d4af37', 0.33, 1.0, zF - 0.04).box(0.12, 0.03, 0.02, '#d4af37', 0, 1.25, zF - 0.035);
  solid(0, 1.025, zF, 0.44, 1.025, 0.04);
  props.box(0.07, 0.11, 0.03, '#eee', 0.65, 1.3, zF + 0.1).sph(0.015, '#c33', 0.65, 1.3, zF + 0.12);
  H.interact.push({ id: 'doorbell', pos: new THREE.Vector3(0.65, 1.3, zF - 0.05), r: 0.25, label: 'Ring doorbell' });
  // ---------- Bathroom: basin on the back wall, toilet against the front wall ----------
  { const sx = PX(518), sz = PZ(1680), tx = PX(502), tz = PZ(1850);
    props.box(0.6, 0.15, 0.42, '#f8f8f8', sx, 0.85, sz).cyl(0.07, 0.05, 0.1, '#e8eef2', sx, 0.88, sz + 0.02).cyl(0.06, 0.06, 0.78, '#f8f8f8', sx, 0.39, sz - 0.05).cyl(0.01, 0.01, 0.14, '#ccc', sx, 0.98, sz - 0.14).box(0.02, 0.02, 0.1, '#ccc', sx, 1.05, sz - 0.1);
    props.box(0.55, 0.65, 0.02, '#c8e0ea', sx, 1.45, zBT + WT / 2 + 0.012).box(0.6, 0.7, 0.015, '#d8d8d8', sx, 1.45, zBT + WT / 2 + 0.004);
    solid(sx, 0.85, sz, 0.3, 0.075, 0.21);
    H.interact.push({ id: 'tap', pos: new THREE.Vector3(sx, 1.0, sz - 0.1), r: 0.2, label: 'Basin tap' });
    props.rbox(0.38, 0.4, 0.55, 0.12, '#f8f8f8', tx, 0.2, tz - 0.08).rbox(0.42, 0.45, 0.2, 0.05, '#f8f8f8', tx, 0.6, tz + 0.22).box(0.1, 0.04, 0.04, '#bbb', tx + 0.12, 0.85, tz + 0.22);
    solid(tx, 0.2, tz - 0.05, 0.22, 0.2, 0.28); solid(tx, 0.6, tz + 0.22, 0.21, 0.22, 0.1);
    H.interact.push({ id: 'flush', pos: new THREE.Vector3(tx + 0.12, 0.85, tz + 0.2), r: 0.25, label: 'Wiggle the flush handle' });
    H.spots.toilet = { pos: new THREE.Vector3(tx, 0, tz - 0.1), yaw: Math.PI, seatY: 0.42 };
    H.spots.toiletLid = { x: tx, z: tz - 0.1 }; H.spots.basin = new THREE.Vector3(sx, 0.93, sz); }
  // ---------- Under the stairs (the way through to the garage) ----------
  props.box(1.4, 0.03, 0.35, '#8a7050', -2.1, 1.4, -0.12).box(1.4, 0.03, 0.35, '#8a7050', -2.1, 1.8, -0.12);
  H.interact.push({ id: 'garageLight', pos: new THREE.Vector3(xGS - 0.12, 1.3, 0.8), r: 0.25, label: 'Light switch (broken)' });
  props.box(0.03, 0.12, 0.08, '#eee', xGS - 0.1, 1.3, 0.8);
  // ---------- Garage: the fridge at the back, shelving, workbench, chest freezer (beer) ----------
  props.box(0.5, 1.9, 2.4, '#5a5a5a', PX(48) + 0.3, 0.95, 4.55).box(0.48, 0.03, 2.35, '#7a6a50', PX(48) + 0.3, 0.5, 4.55).box(0.48, 0.03, 2.35, '#7a6a50', PX(48) + 0.3, 1.0, 4.55).box(0.48, 0.03, 2.35, '#7a6a50', PX(48) + 0.3, 1.5, 4.55);
  for (let i = 0; i < 8; i++) props.cyl(0.1, 0.1, 0.18, ['#ddd', '#a33', '#36a', '#eee'][i % 4], PX(48) + 0.3, 0.6 + (i % 3) * 0.5, 3.6 + i * 0.25);
  solid(PX(48) + 0.3, 0.95, 4.55, 0.25, 0.95, 1.2);
  props.box(0.6, 0.06, 1.6, '#6a5030', -3.45, 0.9, 4.2).box(0.05, 0.85, 1.6, '#4a3a28', -3.17, 0.45, 4.2).box(0.02, 0.6, 1.4, '#a08868', -3.14, 1.3, 4.2);
  solid(-3.45, 0.45, 4.2, 0.3, 0.45, 0.8);
  H.spots.workbench = new THREE.Vector3(-3.45, 0.93, 4.2);
  props.rbox(0.7, 0.85, 1.2, 0.03, '#f2f2f2', -7.1, 0.425, 1.55);
  solid(-7.1, 0.42, 1.55, 0.35, 0.42, 0.6);
  H.spots.freezer = new THREE.Vector3(-7.1, 0, 1.55);
  // ---------- Kitchen / Living / Dining / Conservatory ----------
  kitchen(props, add, M, solid, H);
  living(props, add, M, solid, H, BAY);
  dining(props, add, M, solid, H);
  // Conservatory: sofa along the back, TV on the right wall, heater, karaoke machine
  { const sx = (PX(898) + PX(1110)) / 2, sz = (PZ(517) + PZ(602)) / 2;
    sofa(props, sx, sz, 0, '#e8dcc8', solid, PX(1110) - PX(898), 3, 0.9);
    H.spots.consSofa = [-0.7, 0, 0.7].map(o => ({ pos: new THREE.Vector3(sx + o, 0, sz + 0.22), yaw: 0, seatY: 0.57 }));
    const tx = PX(1199), tz = (PZ(588) + PZ(697)) / 2;
    props.box(0.4, 0.5, 1.3, '#3a3028', tx - 0.12, 0.25, tz).box(0.05, 0.7, 1.22, '#111', tx + 0.04, 1.2, tz);
    solid(tx - 0.12, 0.25, tz, 0.2, 0.25, 0.65);
    H.consTV = { x: tx + 0.01, y: 1.2, z: tz };
    props.box(0.05, 0.5, 1.2, '#c8c8c8', xR - 0.15, 0.35, -8.9).box(0.06, 0.02, 1.2, '#ddd', xR - 0.15, 0.62, -8.9);
    H.interact.push({ id: 'heater', pos: new THREE.Vector3(xR - 0.2, 0.6, -8.9), r: 0.4, label: 'Conservatory heater' });
    props.box(0.5, 0.6, 0.4, '#222', 1.5, 0.3, -8.95).box(0.42, 0.25, 0.02, '#4af', 1.5, 0.45, -8.74).cyl(0.02, 0.02, 0.9, '#888', 1.8, 1.05, -8.9).sph(0.05, '#222', 1.8, 1.5, -8.9);
    solid(1.5, 0.3, -8.95, 0.25, 0.3, 0.2);
    H.interact.push({ id: 'karaoke', pos: new THREE.Vector3(1.5, 0.6, -8.75), r: 0.4, label: 'Karaoke machine' }); }

  // ---------- seats the player can use + light switches ----------
  const SP = H.spots;
  H.seats = [...SP.sofaL, ...SP.sofaR, SP.sofaArmL, SP.toilet, ...SP.consSofa];
  const sw = (room, x, y, z, ry) => { props.box(0.08, 0.12, 0.015, '#f4f4f4', x, y, z, 0, ry).box(0.02, 0.04, 0.02, '#ddd', x, y, z, 0, ry); H.interact.push({ id: 'light', room, pos: new THREE.Vector3(x, y, z), r: 0.3, label: 'Light switch' }); };
  sw('living', -1.3, 1.3, zMid - WT / 2 - 0.01, 0); sw('kitchen', xHE + WT / 2 + 0.01, 1.3, PZ(1590), Math.PI / 2); sw('dining', PX(890), 1.3, zMid - WT / 2 - 0.01, 0); sw('hall', 0.65, 1.3, zF - WT / 2 - 0.01, 0);
  buildDecor(props, add, M, solid, H);
  buildNight(H);
  // ---------- merge statics ----------
  for (const [mat, geos] of statics) {
    const g = mergeGeometries(geos.map(x => x.index ? x.toNonIndexed() : x).map(x => { x.deleteAttribute && x.attributes.uv2 && x.deleteAttribute('uv2'); return x; }), false);
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m); H.meshes.push(m);
  }
  const pg = props.build(); const pm = new THREE.Mesh(pg, M.props); pm.castShadow = pm.receiveShadow = true; pm.matrixAutoUpdate = false; pm.updateMatrix(); scene.add(pm); H.meshes.push(pm);

  // ---------- lights ----------
  buildLights(H);
  // ---------- navigation ----------
  buildNav(H);
  H.floorAt = () => 0;
  H.clampToNav = (p) => {
    if (roomAt(p.x, p.z)) return p;
    let best = null, bd = 1e9;
    for (const k in ROOMS) { const r = ROOMS[k]; const cx = Math.max(r.x0 + 0.3, Math.min(r.x1 - 0.3, p.x)), cz = Math.max(r.z0 + 0.3, Math.min(r.z1 - 0.3, p.z)); const d = (cx - p.x) ** 2 + (cz - p.z) ** 2; if (d < bd) { bd = d; best = [cx, cz]; } }
    p.x = best[0]; p.z = best[1]; return p;
  };
  return H;
}

// Stairs: from the hall you step west up three steps onto a quarter landing, then the main flight climbs
// towards the back of the house to the upstairs landing (which sits over the under-stairs cupboard).
export const STAIR = { x0: PX(465), x1: PX(540), z0: PZ(1410), z1: PZ(1575), lz0: PZ(1575), lz1: PZ(1640), sx1: PX(605), rise: 2.45 / 13 };
function stairs(P, add, M, solid) {
  const S = STAIR, r = S.rise; const bw = S.lz1 - S.lz0;
  // three bottom steps going west from the hall
  const tw = (S.sx1 - S.x1) / 3;
  for (let i = 0; i < 3; i++) { const x = S.sx1 - (i + 0.5) * tw, y = (i + 1) * r;
    add(M.oakWood, uvBox(x, y / 2, (S.lz0 + S.lz1) / 2, tw + 0.005, y, bw, 0.8)); solid(x, y / 2, (S.lz0 + S.lz1) / 2, tw / 2, y / 2, bw / 2); }
  // quarter landing
  { const y = 4 * r; add(M.oakWood, uvBox((S.x0 + S.x1) / 2, y / 2, (S.lz0 + S.lz1) / 2, S.x1 - S.x0, y, bw, 0.8)); solid((S.x0 + S.x1) / 2, y / 2, (S.lz0 + S.lz1) / 2, (S.x1 - S.x0) / 2, y / 2, bw / 2); }
  // main flight: 9 steps up towards -z
  const n = 9, td = (S.z1 - S.z0) / n;
  for (let i = 0; i < n; i++) { const z = S.z1 - (i + 0.5) * td, y = (5 + i) * r;
    add(M.oakWood, uvBox((S.x0 + S.x1) / 2, y / 2, z, S.x1 - S.x0, y, td + 0.005, 0.8)); solid((S.x0 + S.x1) / 2, y / 2, z, (S.x1 - S.x0) / 2, y / 2, td / 2);
    P.box(S.x1 - S.x0, 0.02, 0.03, '#f4f1ea', (S.x0 + S.x1) / 2, y - 0.01, z + td / 2 + 0.005); }
}
function kitchen(P, add, M, solid, H) {
  // Plan: fridge top-right, worktop down the right wall (hob halfway), worktop along the front wall with the sink under the window.
  const xR = KX(1212), zF = PZ(1880), xL = PX(858), xW = KX(1148); // right-hand run shifted by KW (wider kitchen)
  const fx = KX(1137), fz = PZ(1356);
  const rx = (xW + xR) / 2, rd = xR - xW, rz0 = PZ(1388), rz1 = PZ(1815);
  const bz = (PZ(1815) + zF) / 2, bd = zF - PZ(1815);
  const door = (x, z, w, rot) => { if (rot) P.box(0.02, 0.7, w - 0.06, '#f4f1ea', x, 0.47, z).box(0.02, 0.02, 0.16, '#999', x - 0.015, 0.75, z); else P.box(w - 0.06, 0.7, 0.02, '#f4f1ea', x, 0.47, z).box(0.16, 0.02, 0.02, '#999', x, 0.75, z + 0.015 * Math.sign(-z)); };
  // carcasses
  P.box(rd - 0.04, 0.86, rz1 - rz0, '#e6e2d8', rx + 0.02, 0.43, (rz0 + rz1) / 2); for (let z = rz0 + 0.3; z < rz1; z += 0.6) door(xW - 0.005, z, 0.6, true);
  P.box(xR - xL, 0.86, bd - 0.04, '#e6e2d8', (xL + xR) / 2, 0.43, bz + 0.02); for (let x = xL + 0.3; x < xW; x += 0.6) P.box(0.54, 0.7, 0.02, '#f4f1ea', x, 0.47, PZ(1815) - 0.005).box(0.16, 0.02, 0.02, '#999', x, 0.75, PZ(1815) - 0.02);
  add(M.worktop, uvBox(rx, 0.89, (rz0 + rz1) / 2, rd + 0.02, 0.04, rz1 - rz0, 1)); add(M.worktop, uvBox((xL + xR) / 2, 0.89, bz, xR - xL, 0.04, bd + 0.02, 1));
  solid(rx, 0.45, (rz0 + rz1) / 2, rd / 2, 0.46, (rz1 - rz0) / 2); solid((xL + xR) / 2, 0.45, bz, (xR - xL) / 2, 0.46, bd / 2);
  // splashbacks
  add(M.tileWall, uvBox(xR - 0.01, 1.2, (rz0 + rz1) / 2, 0.01, 0.6, rz1 - rz0, 0.6)); add(M.tileWall, uvBox((xL + xR) / 2, 1.2, zF - 0.01, xR - xL, 0.6, 0.01, 0.6));
  // sink under the window + tap
  const sx = (PX(952) + PX(1060)) / 2;
  P.box(PX(1060) - PX(952), 0.03, 0.48, '#c8ccd0', sx, 0.915, bz).box(PX(1060) - PX(952) - 0.1, 0.02, 0.4, '#8a9096', sx, 0.9, bz).box(0.02, 0.02, 0.4, '#c8ccd0', sx, 0.92, bz).cyl(0.015, 0.015, 0.25, '#c8ccd0', sx, 1.03, zF - 0.08).cyl(0.012, 0.012, 0.18, '#c8ccd0', sx, 1.14, zF - 0.16, Math.PI / 2);
  H.interact.push({ id: 'tap', pos: new THREE.Vector3(sx, 1.05, zF - 0.14), r: 0.25, label: 'Tap' });
  // hob (4 rings) + extractor + oven under it
  const hz = (PZ(1555) + PZ(1650)) / 2;
  P.box(0.52, 0.01, PZ(1650) - PZ(1555), '#111', rx, 0.915, hz); for (const [dx, dz] of [[-0.12, -0.2], [0.12, -0.2], [-0.12, 0.2], [0.12, 0.2]]) P.torus(0.07, 0.008, '#444', rx + dx, 0.925, hz + dz, Math.PI / 2);
  P.box(0.5, 0.12, 0.7, '#bbb', rx + 0.05, 1.95, hz).box(0.25, 0.6, 0.25, '#bbb', rx + 0.18, 2.3, hz);
  P.box(0.03, 0.6, 0.58, '#111', xW - 0.01, 0.45, hz);
  H.spots.hob = new THREE.Vector3(rx, 0.93, hz);
  // wall cupboards: right wall (not over the hob), front wall either side of the window
  for (let z = rz0 + 0.35; z < rz1 - 0.2; z += 0.6) { if (Math.abs(z - hz) < 0.6) continue; P.box(0.33, 0.7, 0.58, '#e6e2d8', xR - 0.18, 1.85, z).box(0.02, 0.02, 0.12, '#999', xR - 0.36, 1.55, z); }
  for (const x of [xL + 0.3, KX(1112), KX(1112) + 0.6]) P.box(0.58, 0.7, 0.33, '#e6e2d8', x, 1.85, zF - 0.18).box(0.12, 0.02, 0.02, '#999', x, 1.55, zF - 0.36);
  // breakfast bar against the back wall, right next to the fridge, with three stools
  const bx0 = 3.0, bx1 = fx - 0.52, bzc = 0.02, bdz = 0.62, bh = 1.0, bcx = (bx0 + bx1) / 2;
  P.box(bx1 - bx0, 0.05, bdz, '#5a3a24', bcx, bh, bzc).box(bx1 - bx0 - 0.1, bh - 0.05, 0.35, '#e6e2d8', bcx, (bh - 0.05) / 2, bzc - 0.1).box(bx1 - bx0 - 0.1, 0.03, 0.04, '#c0c0c0', bcx, 0.25, bzc + 0.2);
  solid(bcx, bh / 2, bzc, (bx1 - bx0) / 2, bh / 2, bdz / 2);
  H.spots.bar = { x0: bx0, x1: bx1, z: bzc, y: bh + 0.025 };
  for (const x of [bx0 + 0.35, bcx, bx1 - 0.35]) { const z = bzc + 0.62; P.cyl(0.19, 0.19, 0.06, '#2a2a2a', x, 0.72, z, 0, 0, 0, 16).cyl(0.025, 0.03, 0.7, '#9a9a9a', x, 0.36, z).torus(0.15, 0.012, '#9a9a9a', x, 0.3, z, Math.PI / 2).cyl(0.18, 0.2, 0.02, '#9a9a9a', x, 0.01, z, 0, 0, 0, 16); staticCyl(x, 0.37, z, 0.37, 0.19); }
  // smoke alarm + clock
  P.cyl(0.07, 0.07, 0.03, '#f4f4f4', 3.9, 2.48, 2.8).sph(0.008, '#f22', 3.92, 2.46, 2.8);
  H.interact.push({ id: 'smokeAlarm', pos: new THREE.Vector3(3.9, 2.45, 2.8), r: 0.5, label: 'Smoke alarm' });
  P.cyl(0.18, 0.18, 0.03, '#fff', PX(858) + 0.02, 1.9, 4.2, 0, 0, Math.PI / 2).cyl(0.17, 0.17, 0.035, '#222', PX(858) + 0.01, 1.9, 4.2, 0, 0, Math.PI / 2, 20);
  H.spots.fridgeBox = { x: fx, z: fz };
  H.spots.kettle = new THREE.Vector3(rx, 0.93, PZ(1780));
  H.spots.fridge = new THREE.Vector3(fx, 0, PZ(1470));
  H.spots.drinks = { x: rx, z0: PZ(1420), z1: PZ(1530) };
  H.spots.buffet = [new THREE.Vector3(2.3, 0, 4.6), new THREE.Vector3(3.3, 0, 4.6), new THREE.Vector3(4.3, 0, 4.4), new THREE.Vector3(5.1, 0, 3.6), new THREE.Vector3(5.1, 0, 1.9)];
  H.spots.kitchen = [new THREE.Vector3(2.6, 0, 1.2), new THREE.Vector3(2.4, 0, 3.0), new THREE.Vector3(3.2, 0, 2.2)];
  H.spots.kitchenMid = new THREE.Vector3(3.0, 0, 2.6);
}

function living(P, add, M, solid, H, BAY) {
  // rug (plan: px 445-710 x 905-1190) with the round coffee table on it
  const rx0 = PX(445), rx1 = PX(710), rz0 = PZ(905), rz1 = PZ(1190);
  add(M.rug, (() => { const g = new THREE.BoxGeometry(rx1 - rx0, 0.012, rz1 - rz0); g.translate((rx0 + rx1) / 2, 0.006, (rz0 + rz1) / 2); return g; })());
  H.spots.coffee = new THREE.Vector3(PX(587), 0, PZ(1023));
  // L-shaped sofa: long run down the dining-room wall (facing west) + the short return along the back wall (facing the room)
  const lx = (PX(715) + PX(790)) / 2 + 0.05;
  sofa(P, lx, (PZ(895) + PZ(1155)) / 2, -Math.PI / 2, '#ece6da', solid, PZ(1155) - PZ(895), 3, 0.84);
  sofa(P, (PX(628) + PX(790)) / 2, (PZ(820) + PZ(895)) / 2 + 0.1, 0, '#ece6da', solid, PX(790) - PX(628), 2, 0.84, true);
  // the sofa along the bottom wall, facing the fireplace end of the room
  const bx = (PX(350) + PX(572)) / 2, bz = (PZ(1230) + PZ(1300)) / 2 - 0.08;
  sofa(P, bx, bz, Math.PI, '#ece6da', solid, PX(572) - PX(350), 3, 0.84);
  // TV in the back-left corner on a corner unit, angled to the room
  const tvX = PX(258), tvZ = PZ(860), tvYaw = Math.PI / 4;
  P.box(1.2, 0.5, 0.42, '#2a2420', tvX, 0.25, tvZ, 0, tvYaw).box(1.1, 0.02, 0.38, '#3a332c', tvX, 0.51, tvZ, 0, tvYaw);
  solid(tvX, 0.25, tvZ, 0.55, 0.25, 0.3, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, tvYaw, 0)));
  const tvGroup = new THREE.Group(); tvGroup.position.set(tvX + Math.sin(tvYaw) * -0.02, 0.52, tvZ + Math.cos(tvYaw) * -0.02); tvGroup.rotation.y = tvYaw;
  const bez = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.86, 0.05), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.3 }));
  bez.position.set(0, 0.5, 0); tvGroup.add(bez);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.22), bez.material); foot.position.y = 0.02; tvGroup.add(foot);
  const neckM = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.04), bez.material); neckM.position.y = 0.07; tvGroup.add(neckM);
  G.scene.add(tvGroup);
  H.tv = { group: tvGroup, w: 1.38, h: 0.78, center: new THREE.Vector3(), normal: new THREE.Vector3(Math.sin(tvYaw), 0, Math.cos(tvYaw)) };
  tvGroup.updateMatrixWorld(true); H.tv.center.set(0, 0.5, 0.03).applyMatrix4(tvGroup.matrixWorld);
  const tvc = staticBox(H.tv.center.x, H.tv.center.y, H.tv.center.z, 0.72, 0.42, 0.04, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, tvYaw, 0)), { tag: 'tv' });
  G.colliderMap.get(tvc.collider.handle).tag = 'tv';
  H.spots.tvFront = new THREE.Vector3(tvX + 1.2, 0, tvZ + 1.2);
  // Martin's armchair: next to the TV, angled to face the rest of the room (the quizmaster's seat)
  H.spots.armchair = { pos: new THREE.Vector3(-4.15, 0, -5.2), yaw: 0.69, seatY: 0.55 };
  // the fireplace on the west wall: stone chimney breast, hearth, fire opening facing into the room
  const fx = PX(216), fz = (PZ(955) + PZ(1190)) / 2, fl = PZ(1190) - PZ(955);
  P.box(PX(247) - PX(185) - 0.09, WALL_H, fl, '#8e8e8a', (PX(247) + PX(194)) / 2 + 0.04, WALL_H / 2, fz);
  for (let i = 0; i < 18; i++) P.box(0.005, 0.012, fl, '#7a7a76', PX(247) + 0.005, 0.15 + i * 0.13, fz);
  P.box(0.36, 0.8, 0.9, '#c8c0b4', PX(247) + 0.18, 0.4, fz).box(0.37, 0.55, 0.55, '#181412', PX(247) + 0.19, 0.3, fz).box(0.42, 0.06, 1.15, '#3a2a1e', PX(247) + 0.21, 1.22, fz);
  P.box(PX(278) - PX(247) + 0.25, 0.06, PZ(1135) - PZ(1010), '#8a8a86', (PX(247) + PX(278)) / 2 + 0.12, 0.03, fz);
  solid(PX(216) + 0.03, WALL_H / 2, fz, 0.32, WALL_H / 2, fl / 2); solid(PX(247) + 0.2, 0.62, fz, 0.21, 0.62, 0.57);
  H.spots.mantel = new THREE.Vector3(PX(247) + 0.24, 1.25, fz);
  H.spots.fire = new THREE.Vector3(PX(247) + 0.3, 0.3, fz);
  ['#c41e1e', '#1f7a3a', '#c41e1e', '#e0e0e0'].forEach((c, i) => P.rbox(0.05, 0.3, 0.12, 0.02, c, PX(247) + 0.43, 1.0, fz - 0.42 + i * 0.28).rbox(0.05, 0.08, 0.15, 0.02, c, PX(247) + 0.43, 0.86, fz - 0.39 + i * 0.28).box(0.055, 0.05, 0.13, '#fff', PX(247) + 0.43, 1.15, fz - 0.42 + i * 0.28));
  // bookcase on the west wall nearer the front
  const bkx = PX(205) + 0.18, bkz = -1.1;
  P.box(0.35, 2.0, 1.0, '#4a2e1c', bkx, 1.0, bkz);
  for (let s = 0; s < 4; s++) { P.box(0.33, 0.02, 0.96, '#5a3a24', bkx + 0.02, 0.3 + s * 0.45, bkz); for (let b = 0; b < 8; b++) P.box(0.22, 0.28 + (b % 3) * 0.03, 0.08, ['#7a2a2a', '#2a4a7a', '#3a6a3a', '#d8c08a', '#555'][(b + s) % 5], bkx + 0.06, 0.45 + s * 0.45, bkz - 0.4 + b * 0.11); }
  solid(bkx, 1.0, bkz, 0.17, 1.0, 0.5);
  H.spots.bookshelf = new THREE.Vector3(bkx + 0.05, 2.0, bkz);
  // side table + lamp at the end of the long sofa, plant in the back corner, radiator under the left window
  P.cyl(0.25, 0.25, 0.03, '#5a3a24', 0.45, 0.55, -1.8).cyl(0.03, 0.03, 0.53, '#5a3a24', 0.45, 0.27, -1.8).cyl(0.18, 0.2, 0.02, '#5a3a24', 0.45, 0.01, -1.8);
  P.cyl(0.18, 0.12, 0.3, '#e8dcc0', 0.45, 0.95, -1.8).cyl(0.02, 0.02, 0.35, '#888', 0.45, 0.72, -1.8);
  solid(0.45, 0.28, -1.8, 0.25, 0.28, 0.25);
  P.cyl(0.18, 0.14, 0.35, '#9a5a3a', PX(214) + 0.25, 0.175, PZ(1270)).sph(0.35, '#3a6a32', PX(214) + 0.25, 0.6, PZ(1270), 1, 1.3, 1, 8);
  P.cyl(0.25, 0.3, 0.12, '#f4efe4', -2.5, 2.38, -3.3).cyl(0.01, 0.01, 0.1, '#888', -2.5, 2.47, -3.3);
  // curtains in the bay
  for (const [x, z, r] of [[BAY[0][0] + 0.12, BAY[0][1] - 0.2, 0.55], [BAY[3][0] - 0.12, BAY[3][1] - 0.2, -0.55]]) P.box(0.08, 2.3, 0.35, '#6a1e2a', x, 1.2, z, 0, r);
  // Chip's bed by the bookcase
  P.torus(0.32, 0.1, '#8a6a4a', -4.75, 0.08, -1.0, Math.PI / 2).cyl(0.3, 0.3, 0.05, '#c8b090', -4.75, 0.03, -1.0);
  H.spots.chipBed = new THREE.Vector3(-4.75, 0, -1.0);
  H.spots.tree = new THREE.Vector3(PX(500), 0, PZ(772));
  // Seats: bottom sofa (3) = sofaL, long sofa (3) = sofaR, the return = sofaArmL
  H.spots.sofaL = [-0.8, 0, 0.8].map(o => ({ pos: new THREE.Vector3(bx + o, 0, bz - 0.2), yaw: Math.PI, seatY: 0.57 }));
  H.spots.sofaR = [-0.85, 0, 0.85].map(o => ({ pos: new THREE.Vector3(lx - 0.2, 0, (PZ(895) + PZ(1155)) / 2 + o), yaw: -Math.PI / 2, seatY: 0.57 }));
  H.spots.sofaArmL = { pos: new THREE.Vector3(PX(660), 0, (PZ(820) + PZ(895)) / 2 + 0.3), yaw: 0, seatY: 0.57 };
  const cf = H.spots.coffee;
  H.spots.floor = [[cf.x - 0.75, cf.z + 0.35, Math.PI / 2], [cf.x - 0.75, cf.z - 0.35, Math.PI / 2], [cf.x, cf.z + 0.85, Math.PI], [cf.x, cf.z - 0.85, 0]].map(([x, z, y]) => ({ pos: new THREE.Vector3(x, 0, z), yaw: y }));
  H.spots.stand = [[-3.6, -1.6, Math.PI * 0.9], [-4.2, -4.6, Math.PI * 0.75], [-0.9, -1.6, -Math.PI * 0.9], [-3.6, -5.4, Math.PI * 0.1], [-2.4, -1.8, Math.PI]].map(([x, z, y]) => ({ pos: new THREE.Vector3(x, 0, z), yaw: y }));
  H.spots.martinStand = { pos: new THREE.Vector3(-3.4, 0, -2.6), yaw: -Math.PI * 0.6 };
  H.spots.living = new THREE.Vector3(-2.6, 0, -3.0);
  H.spots.ceremony = new THREE.Vector3(-3.3, 0, -3.0);
}

// sofa(len along local x, facing local +z rotated by yaw); 'corner' leaves the right arm off (joins the L)
function sofa(P, x, z, yaw, color, solid, len = 2.4, seats = 3, depth = 0.9, corner = false) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const L = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const add = (w, h, d, lx, y, lz, col, r = 0.06) => { const [px, pz] = L(lx, lz); P.rbox(w, h, d, r, col, px, y, pz, 0, yaw); };
  const dark = new THREE.Color(color).multiplyScalar(0.82).getStyle(), cush = new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.35).getStyle();
  const hl = len / 2, hd = depth / 2;
  add(len, 0.42, depth, 0, 0.21, 0, dark, 0.04);
  add(len, 0.5, 0.24, 0, 0.62, -hd + 0.12, color, 0.1);
  add(0.2, 0.62, depth, -hl + 0.1, 0.42, 0, color, 0.1); if (!corner) add(0.2, 0.62, depth, hl - 0.1, 0.42, 0, color, 0.1);
  const inner = len - (corner ? 0.2 : 0.4), sw = inner / seats, off = corner ? 0.1 : 0;
  for (let i = 0; i < seats; i++) { const lx = -inner / 2 + sw * (i + 0.5) - off * -1 * 0; add(sw - 0.04, 0.16, depth - 0.28, lx + (corner ? -0.0 : 0) + (corner ? 0.1 : 0) * 0, 0.49, 0.08, cush, 0.07); add(sw - 0.06, 0.4, 0.14, lx, 0.72, -hd + 0.27, cush, 0.07); }
  for (const lx of [-hl + 0.1, hl - 0.1]) for (const lz of [-hd + 0.08, hd - 0.08]) { const [px, pz] = L(lx, lz); P.cyl(0.025, 0.02, 0.06, '#2a1a10', px, 0.03, pz); }
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
  const [bx, bz] = L(0, 0); staticBox(bx, 0.28, bz, hl, 0.28, hd, q);
  const [kx, kz] = L(0, -hd + 0.12); staticBox(kx, 0.62, kz, hl, 0.3, 0.12, q);
  for (const lx of corner ? [-hl + 0.1] : [-hl + 0.1, hl - 0.1]) { const [ax, az] = L(lx, 0); staticBox(ax, 0.4, az, 0.1, 0.31, hd, q); }
}

function dining(P, add, M, solid, H) {
  // the desk in the bottom-right corner with Martin's PC (screen faces the room, west)
  const dx = (PX(1160) + PX(1212)) / 2 - 0.02, dz = (PZ(1155) + PZ(1300)) / 2, dl = PZ(1300) - PZ(1155) - 0.05;
  P.box(0.62, 0.04, dl, '#c8a070', dx, 0.75, dz).box(0.6, 0.73, 0.04, '#b08a5a', dx, 0.37, dz - dl / 2 + 0.03).box(0.6, 0.73, 0.04, '#b08a5a', dx, 0.37, dz + dl / 2 - 0.03);
  P.box(0.42, 0.45, 0.2, '#1a1a1a', dx + 0.05, 0.23, dz + 0.45).sph(0.01, '#3af', dx - 0.17, 0.4, dz + 0.4);
  P.box(0.15, 0.02, 0.45, '#222', dx - 0.18, 0.78, dz).box(0.1, 0.02, 0.06, '#222', dx - 0.18, 0.78, dz + 0.35);
  solid(dx, 0.38, dz, 0.31, 0.39, dl / 2);
  const mon = new THREE.Group(); mon.position.set(dx + 0.15, 0.77, dz); mon.rotation.y = -Math.PI / 2;
  const mb = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.44, 0.04), new THREE.MeshStandardMaterial({ color: '#111' })); mb.position.y = 0.36; mon.add(mb);
  const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), mb.material); st.position.y = 0.08; mon.add(st);
  G.scene.add(mon); mon.updateMatrixWorld(true);
  H.pc = { group: mon, w: 0.66, h: 0.38, center: new THREE.Vector3(dx + 0.12, 1.13, dz) };
  H.interact.push({ id: 'pc', pos: new THREE.Vector3(dx - 0.2, 1.0, dz), r: 0.5, label: 'Dining room PC' });
  H.spots.pcChair = new THREE.Vector3(PX(1138), 0, PZ(1230));
  // sideboard on the west wall (the table has the east wall)
  const sx = 1.22, sz = -4.2, sl = 1.87;
  P.box(0.45, 0.85, sl, '#a8784a', sx, 0.425, sz).box(0.47, 0.03, sl + 0.02, '#8a6038', sx, 0.86, sz);
  for (let i = 0; i < 3; i++) P.box(0.01, 0.6, sl / 3 - 0.06, '#b8885a', sx + 0.23, 0.45, sz - sl / 3 + i * sl / 3).sph(0.02, '#c8a050', sx + 0.24, 0.6, sz - sl / 3 + i * sl / 3 + 0.18);
  solid(sx, 0.43, sz, 0.23, 0.43, sl / 2);
  H.spots.sideboard = { x: sx, y: 0.88, z: sz, len: sl };
  for (const pz of [PZ(1103)]) P.cyl(0.16, 0.12, 0.3, '#e8e0d0', PX(1190), 0.15, pz).sph(0.25, '#4a8a3a', PX(1190), 0.55, pz, 1, 1.3, 1, 8).sph(0.18, '#5a9a42', PX(1190) - 0.05, 0.8, pz, 1, 1.2, 1, 8);
  // wall art + ceiling light over the table
  P.box(0.03, 0.7, 1.0, '#2a2a2a', PX(1212) - 0.02, 1.6, -4.0).box(0.01, 0.6, 0.9, '#c87a3a', PX(1212) - 0.04, 1.6, -4.0);
  const tx = 4.99, tz = -3.9; // dining table pushed against the right-hand wall
  P.cyl(0.2, 0.05, 0.25, '#e8d8a8', tx, 2.3, tz).cyl(0.005, 0.005, 0.2, '#555', tx, 2.45, tz);
  H.spots.table = new THREE.Vector3(tx, 0.77, tz);
  H.spots.dining = [[tx - 0.85, tz + 0.3, Math.PI / 2], [tx - 0.85, tz - 0.4, Math.PI / 2], [tx - 0.4, tz + 1.3, Math.PI]].map(([x, z, y]) => ({ pos: new THREE.Vector3(x, 0, z), yaw: y }));
  H.spots.games = new THREE.Vector3(tx, 0, tz);
  H.spots.conservatory = [[2.0, -7.4, 0.4], [3.9, -6.8, -0.6], [3.1, -6.6, Math.PI]].map(([x, z, y]) => ({ pos: new THREE.Vector3(x, 0, z), yaw: y }));
  H.spots.garden = [[-2.4, -7.2, 0], [-4.5, -9.4, 0], [-1.0, -11.5, 0.5], [2.5, -12.5, 0]].map(([x, z, y]) => ({ pos: new THREE.Vector3(x, 0, z), yaw: y }));
  H.spots.bayOutside = { pos: new THREE.Vector3(-0.95, 0, -6.75), yaw: -1.08 };
  H.spots.garage = new THREE.Vector3(-5.2, 0, 3.0);
  H.spots.garageFridge = new THREE.Vector3(-4.6, 0, 1.1);
  H.spots.garageSideDoor = new THREE.Vector3(-6.78, 0, -0.39);
  H.spots.garageIn = new THREE.Vector3(-3.7, 0, 0.25);
  H.spots.hallDoor = new THREE.Vector3(0, 0, 5.3);
  H.spots.hallway = new THREE.Vector3(0.1, 0, 2.8);
  H.spots.stairGate = new THREE.Vector3(-0.9, 0, (PZ(1575) + PZ(1640)) / 2);
  H.spots.stormOff = new THREE.Vector3(0.3, 0, 4.4);
}

export function setDaylight() { setNight(); }

// Simple waypoint graph for NPC walking between rooms
function buildNav(H) {
  const N = {
    hallFront: [0.1, 5.0], hallMid: [0.1, 2.9], hallBack: [0.1, 0.9], hallTop: [0.3, 0.0], hallLiv: [-0.3, 0.25], livingDoor: [-0.3, -1.0], living: [-2.4, -3.0], livingL: [-3.4, -1.7], livingR: [-1.0, -2.0], livingBack: [-2.5, -5.2], livingTV: [-4.4, -4.25], livingFire: [-4.4, -2.6],
    kitchenDoor: [1.85, 2.06], kitchen: [2.8, 2.0], kitchenE: [5.1, 2.1], kitchenNE: [5.0, 4.4], kitchenN: [3.8, 4.4], kitchenW: [2.2, 4.4],
    diningDoorH: [1.45, 0.25], diningDoor: [1.45, -0.9], dining: [1.9, -2.6], diningE: [4.15, -2.0], diningN: [3.6, -4.9], diningBack: [2.15, -5.4], consDoor: [2.9, -6.6], cons: [2.0, -7.0], consW: [1.5, -8.05], patioCons: [0.2, -8.05], patio: [-0.4, -7.2], patioE: [-0.6, -9.7], patioW: [-4.6, -9.6], garden: [-2.5, -11.6], gardenFar: [1.5, -12.5], bayOut: [-0.9, -6.9], patioSide: [-6.7, -3.0], bbq: [-6.2, -8.2], hallK: [0.9, 2.06],
    toiletDoor: [-0.7, 4.7], toilet: [-1.9, 4.7], cupDoor: [-0.7, 0.25], cupboard: [-2.1, 0.25], garageDoor: [-3.6, 0.25], garage: [-5.2, 2.6], garageFridge: [-4.6, 1.1], stairFoot: [-0.75, 2.9], sideDoorOut: [-6.78, -1.2], sideDoorIn: [-6.6, 0.6],
  };
  const E = [['hallFront', 'hallMid'], ['hallMid', 'hallBack'], ['hallBack', 'hallTop'], ['hallTop', 'hallLiv'], ['hallBack', 'hallLiv'], ['hallLiv', 'livingDoor'], ['livingDoor', 'living'], ['livingDoor', 'livingR'], ['living', 'livingL'], ['living', 'livingR'], ['living', 'livingBack'], ['livingBack', 'livingTV'], ['living', 'livingFire'], ['livingFire', 'livingTV'], ['livingL', 'livingFire'],
    ['hallMid', 'hallK'], ['hallK', 'kitchenDoor'], ['kitchenDoor', 'kitchen'], ['kitchen', 'kitchenE'], ['kitchen', 'kitchenW'], ['kitchenE', 'kitchenN'], ['kitchenW', 'kitchenN'], ['kitchen', 'kitchenN'], ['kitchenE', 'kitchenNE'], ['kitchenN', 'kitchenNE'],
    ['hallTop', 'diningDoorH'], ['hallBack', 'diningDoorH'], ['diningDoorH', 'diningDoor'], ['diningDoor', 'dining'], ['diningDoor', 'diningE'], ['dining', 'diningBack'], ['diningE', 'diningN'], ['diningN', 'diningBack'], ['diningBack', 'consDoor'], ['consDoor', 'cons'], ['cons', 'consW'], ['consW', 'patioCons'], ['patioCons', 'patio'], ['patio', 'bayOut'], ['patioCons', 'patioE'], ['patio', 'patioE'], ['patioE', 'garden'], ['garden', 'gardenFar'], ['patioE', 'patioW'], ['patioW', 'garden'], ['patioW', 'bbq'], ['bbq', 'patioSide'],
    ['hallFront', 'toiletDoor'], ['toiletDoor', 'toilet'], ['hallBack', 'cupDoor'], ['hallTop', 'cupDoor'], ['cupDoor', 'cupboard'], ['cupboard', 'garageDoor'], ['garageDoor', 'garage'], ['garageDoor', 'garageFridge'], ['garage', 'garageFridge'], ['hallMid', 'stairFoot'], ['patioSide', 'sideDoorOut'], ['sideDoorOut', 'sideDoorIn'], ['sideDoorIn', 'garage'], ['sideDoorIn', 'garageFridge']];
  const nodes = {}; for (const k in N) nodes[k] = { id: k, p: new THREE.Vector3(N[k][0], 0, N[k][1]), n: [] };
  for (const [a, b] of E) { nodes[a].n.push(b); nodes[b].n.push(a); }
  H.nav = nodes;
  H.nearestNode = (p) => { let best = null, bd = 1e9; const r = roomAt(p.x, p.z);
    for (const k in nodes) { const q = nodes[k].p; let d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (roomAt(q.x, q.z) !== r) d += 9; if (d < bd) { bd = d; best = k; } } return best; };
  H.path = (from, to) => { // BFS on node ids -> array of Vector3 incl. final target
    const s = H.nearestNode(from), t = H.nearestNode(to);
    const prev = { [s]: null }; const q = [s];
    while (q.length) { const c = q.shift(); if (c === t) break; for (const n of nodes[c].n) if (!(n in prev)) { prev[n] = c; q.push(n); } }
    const out = []; let c = t; while (c) { out.unshift(nodes[c].p.clone()); c = prev[c]; }
    if (out.length > 1 && roomAt(from.x, from.z) === roomAt(out[1].x, out[1].z)) out.shift();
    out.push(to.clone()); return out;
  };
}
