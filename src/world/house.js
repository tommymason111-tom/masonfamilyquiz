// Martin's house (ground floor), built to the doc: hallway + front door, downstairs toilet (left), stairs
// with Mason's gate, under-stairs cupboard -> garage, kitchen (right), living room (ahead) with the TV in
// the far corner and the tree in the bay window, dining/games room, conservatory and the garden + patio.
import * as THREE from 'three';
import { G, GR, groups, ALL, rand, mulberry, noise3 } from '../core.js';
import { uvBox, worldUV, mergeGeometries, Prop, RoundedBoxGeometry } from '../engine/geo.js';
import * as TX from '../engine/textures.js';
import { staticBox, staticCyl } from '../engine/physics.js';

const WALL_H = 2.5, WT = 0.12;
export const ROOMS = {
  hall: { x0: -1.1, x1: 1.1, z0: 0, z1: 6, label: 'Hallway' },
  stairs: { x0: -2.0, x1: -1.1, z0: 1.9, z1: 4.3, label: 'Stairs' },
  toilet: { x0: -3.0, x1: -1.1, z0: 4.3, z1: 6, label: 'Downstairs toilet' },
  cupboard: { x0: -3.0, x1: -1.1, z0: 0, z1: 1.9, label: 'Under-stairs cupboard' },
  garage: { x0: -8.5, x1: -3.0, z0: 0, z1: 6, label: 'Garage' },
  kitchen: { x0: 1.1, x1: 7, z0: 0, z1: 6, label: 'Kitchen' },
  living: { x0: -3.5, x1: 3.5, z0: -7, z1: 0, label: 'Living room' },
  bay: { x0: -1.5, x1: 1.5, z0: -8, z1: -7, label: 'Bay window' },
  dining: { x0: 3.5, x1: 7, z0: -7, z1: 0, label: 'Games room' },
  conservatory: { x0: 3.2, x1: 7.4, z0: -10.6, z1: -7, label: 'Conservatory' },
  garden: { x0: -9, x1: 11, z0: -18, z1: -7, label: 'Garden' },
};

export function roomAt(x, z) {
  for (const k of ['toilet', 'stairs', 'cupboard', 'garage', 'hall', 'kitchen', 'bay', 'living', 'dining', 'conservatory']) {
    const r = ROOMS[k]; if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return k;
  }
  const g = ROOMS.garden; if (x >= g.x0 && x <= g.x1 && z >= g.z0 && z <= g.z1) return 'garden';
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
    tileFloor: new THREE.MeshStandardMaterial({ map: TX.tiles('kfloor', '#3a3a3a', '#4a4844', 6, '#222'), roughness: 0.5 }),
    tileWall: new THREE.MeshStandardMaterial({ map: TX.tiles('kwall', '#f4f4f0', '#ececE6', 10, '#bbb'), roughness: 0.35 }),
    tileCons: new THREE.MeshStandardMaterial({ map: TX.tiles('cons', '#b87850', '#a86a44', 6, '#7a5a40'), roughness: 0.6 }),
    concrete: new THREE.MeshStandardMaterial({ map: TX.concrete(), roughness: 1 }),
    grass: new THREE.MeshStandardMaterial({ map: TX.grass(), roughness: 1 }),
    slabs: new THREE.MeshStandardMaterial({ map: TX.slabs(), roughness: 0.95 }),
    tarmac: new THREE.MeshStandardMaterial({ color: '#3a3a3c', roughness: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: '#cfe4ee', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false }),
    frame: new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.5 }),
    worktop: new THREE.MeshStandardMaterial({ map: TX.paint('granite', '#2a2826', 0.25), roughness: 0.25, metalness: 0.1 }),
    skirting: new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.6 }),
    rug: new THREE.MeshStandardMaterial({ map: TX.carpet('living', '#7a1e24', '#d8c08a'), roughness: 1 }),
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
  floor(ROOMS.hall, M.oak); floor(ROOMS.stairs, M.oak); floor(ROOMS.living, M.oak, 1.6); floor(ROOMS.bay, M.oak); floor(ROOMS.dining, M.oak, 1.6);
  floor(ROOMS.kitchen, M.tileFloor, 2); floor(ROOMS.toilet, M.tileFloor, 1.5); floor(ROOMS.cupboard, M.concrete, 2); floor(ROOMS.garage, M.concrete, 3);
  floor(ROOMS.conservatory, M.tileCons, 1.5);
  for (const k of ['hall', 'toilet', 'cupboard', 'kitchen', 'living', 'bay', 'dining', 'garage']) ceil(ROOMS[k], k === 'cupboard' ? 2.2 : WALL_H);
  // one big floor collider + room-specific friction
  solid(0, -0.1, -2, 30, 0.1, 30).collider.setFriction(0.55);
  // outside ground: garden lawn + patio + front drive
  add(M.grass, uvBox(1, -0.06, -12.5, 20, 0.1, 11, 3));
  add(M.slabs, uvBox(-0.6, -0.02, -9.0, 7.6, 0.06, 4, 2));
  add(M.tarmac, uvBox(0, -0.06, 9, 22, 0.1, 6, 3));
  add(M.grass, uvBox(-12, -0.07, 0, 6, 0.1, 30, 3)); add(M.grass, uvBox(13, -0.07, 0, 6, 0.1, 30, 3));
  // front path
  add(M.slabs, uvBox(0, -0.02, 7.5, 1.4, 0.06, 3, 1));

  // ---------- walls ----------
  // wall along X at z, from x0..x1; sides: matNeg (faces -z), matPos (faces +z); openings [{a,b,bottom,top,glass}]
  const wallX = (z, x0, x1, matNeg, matPos, ops = [], h = WALL_H) => wallRun('x', z, x0, x1, matNeg, matPos, ops, h);
  const wallZ = (x, z0, z1, matNeg, matPos, ops = [], h = WALL_H) => wallRun('z', x, z0, z1, matNeg, matPos, ops, h);
  function wallRun(axis, c, a0, a1, mNeg, mPos, ops, h) {
    ops = ops.slice().sort((p, q) => p.a - q.a);
    const pieces = []; let cur = a0;
    for (const o of ops) { if (o.a > cur) pieces.push([cur, o.a, 0, h]); if (o.bottom > 0) pieces.push([o.a, o.b, 0, o.bottom]); if (o.top < h) pieces.push([o.a, o.b, o.top, h]); cur = o.b;
      if (o.glass) glassPane(axis, c, o.a, o.b, o.bottom, o.top); }
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
    // frame
    const f = 0.05;
    if (axis === 'x') { props.box(len + f, f, 0.08, '#f4f4f4', mid, y0, c); props.box(len + f, f, 0.08, '#f4f4f4', mid, y1, c); props.box(f, y1 - y0, 0.08, '#f4f4f4', a, ym, c); props.box(f, y1 - y0, 0.08, '#f4f4f4', b, ym, c); props.box(0.03, y1 - y0, 0.06, '#f4f4f4', mid, ym, c); props.box(len + 0.1, 0.04, 0.2, '#f4f4f4', mid, y0 - 0.02, c - 0.08); }
    else { props.box(0.08, f, len + f, '#f4f4f4', c, y0, mid); props.box(0.08, f, len + f, '#f4f4f4', c, y1, mid); props.box(0.08, y1 - y0, f, '#f4f4f4', c, ym, a); props.box(0.08, y1 - y0, f, '#f4f4f4', c, ym, b); props.box(0.06, y1 - y0, 0.03, '#f4f4f4', c, ym, mid); }
  }
  const door = (a, b) => ({ a, b, bottom: 0, top: 2.05 });
  const win = (a, b, bottom = 0.9, top = 2.1) => ({ a, b, bottom, top, glass: true });

  // Front wall (z=6): garage | toilet | hall (front door) | kitchen (sink window)
  wallX(6, -3.0, -1.1, M.paintToilet, M.brick, [win(-2.4, -1.7, 1.3, 1.9)]);
  wallX(6, -1.1, 1.1, M.paintHall, M.brick, [door(-0.45, 0.45)]);
  wallX(6, 1.1, 7, M.tileWall, M.brick, [win(3.2, 5.2, 1.05, 2.1)]);
  wallX(6, -8.5, -3.0, M.garageWall, M.brick, [{ a: -7.6, b: -4.0, bottom: 0, top: 2.1 }]); // garage up-and-over door (closed panel below)
  // garage door panel
  add(M.frame, uvBox(-5.8, 1.05, 6.0, 3.6, 2.1, 0.06)); solid(-5.8, 1.05, 6.0, 1.8, 1.05, 0.05);
  for (let i = 0; i < 6; i++) props.box(3.55, 0.02, 0.02, '#d8d8d8', -5.8, 0.2 + i * 0.35, 5.96);
  // garage other walls
  wallZ(-8.5, 0, 6, M.brick, M.garageWall);
  wallX(0, -8.5, -3.5, M.brick, M.garageWall);
  // west column walls: toilet/cupboard vs garage (x=-3.0), with garage door from cupboard
  wallZ(-3.0, 0, 6, M.garageWall, M.paintToilet, [door(0.6, 1.45)]);
  // toilet south wall (z=4.3) and cupboard north wall (z=1.9) on x[-3,-2]; stairs side wall at x=-2
  wallX(4.3, -3.0, -1.1, M.paintHall, M.paintToilet);
  wallX(1.9, -3.0, -2.0, M.paintHall, M.paintHall);
  wallZ(-2.0, 1.9, 4.3, M.paintHall, M.paintHall);
  // hall west wall: toilet door (z 4.6..5.4), stairs open, cupboard door (z 0.7..1.5)
  wallZ(-1.1, 4.3, 6, M.paintToilet, M.paintHall, [door(4.65, 5.45)]);
  wallZ(-1.1, 0, 1.9, M.paintHall, M.paintHall, [door(0.75, 1.55)]);
  // hall east wall: kitchen door
  wallZ(1.1, 0, 6, M.paintHall, M.tileWall, [door(2.4, 3.3)]);
  // hall/living wall z=0, with doorway; kitchen/dining wall z=0 with doorway
  wallX(0, -3.5, -3.0, M.paintLiving, M.garageWall);
  wallX(0, -3.0, 1.1, M.paintLiving, M.paintHall, [door(-0.5, 0.5)]);
  wallX(0, 1.1, 3.5, M.paintLiving, M.tileWall);
  wallX(0, 3.5, 7, M.paintDining, M.tileWall, [door(5.4, 6.3)]);
  // kitchen east wall
  wallZ(7, 0, 6, M.tileWall, M.brick, [win(1.6, 3.6, 1.05, 2.1)]);
  // living room west wall (with side window), back wall with bay, east wall (to dining) with doorway
  wallZ(-3.5, -7, 0, M.brick, M.paintLiving, [win(-4.6, -2.8, 0.9, 2.1)]);
  wallX(-7, -3.5, -1.5, M.brick, M.paintLiving);
  wallX(-7, 1.5, 3.5, M.brick, M.paintLiving);
  // bay window: three glazed faces
  wallX(-8, -1.5, 1.5, M.brick, M.paintLiving, [win(-1.4, 1.4, 0.55, 2.2)]);
  wallZ(-1.5, -8, -7, M.brick, M.paintLiving, [win(-7.95, -7.05, 0.55, 2.2)]);
  wallZ(1.5, -8, -7, M.paintLiving, M.brick, [win(-7.95, -7.05, 0.55, 2.2)]);
  wallZ(3.5, -7, 0, M.paintLiving, M.paintDining, [door(-1.6, -0.7)]);
  // dining: east wall, back wall with door to conservatory
  wallZ(7, -7, 0, M.paintDining, M.brick, [win(-5.8, -4.0, 1.0, 2.1)]);
  wallX(-7, 3.5, 7, M.brick, M.paintDining, [{ a: 4.4, b: 5.6, bottom: 0, top: 2.1 }]);
  // conservatory: dwarf brick walls with glass above, glass roof
  const cons = ROOMS.conservatory;
  const dwarf = 0.6, ch = 2.45;
  wallX(cons.z0, cons.x0, cons.x1, M.brick, M.brick, [win(cons.x0 + 0.1, cons.x1 - 0.1, dwarf, ch - 0.05)], ch);
  wallZ(cons.x1, cons.z0, -7, M.brick, M.brick, [win(cons.z0 + 0.1, -7.1, dwarf, ch - 0.05)], ch);
  // west side: patio doors (open slot with glass either side)
  wallZ(cons.x0, cons.z0, -7, M.brick, M.brick, [win(cons.z0 + 0.1, -9.6, dwarf, ch - 0.05), { a: -9.6, b: -8.3, bottom: 0, top: 2.1 }, win(-8.3, -7.1, dwarf, ch - 0.05)], ch);
  // glass roof (sloped) + white frames
  { const roof = new THREE.Mesh(new THREE.BoxGeometry(cons.x1 - cons.x0 + 0.2, 0.02, cons.z1 - cons.z0 + 0.2), M.glass);
    roof.position.set((cons.x0 + cons.x1) / 2, ch + 0.25, (cons.z0 + cons.z1) / 2); roof.rotation.x = -0.12; roof.renderOrder = 10; scene.add(roof);
    for (let x = cons.x0; x <= cons.x1 + 0.01; x += 0.7) props.box(0.05, 0.08, cons.z1 - cons.z0 + 0.2, '#f6f6f6', x, ch + 0.25, (cons.z0 + cons.z1) / 2, -0.12); }
  // garden fence + shed
  const fence = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0); const ang = Math.atan2(x1 - x0, z1 - z0);
    add(M.fence, uvBox(0, 0.9, 0, 0.04, 1.8, len, 1).rotateY(ang).translate((x0 + x1) / 2, 0, (z0 + z1) / 2));
    staticBox((x0 + x1) / 2, 0.9, (z0 + z1) / 2, x1 === x0 ? 0.03 : len / 2, 0.9, x1 === x0 ? len / 2 : 0.03);
    for (let t = 0; t <= len; t += 1.8) props.box(0.09, 1.9, 0.09, '#4a3a2a', x0 + (x1 - x0) * t / len, 0.95, z0 + (z1 - z0) * t / len); };
  fence(-9, -7, -9, -18); fence(-9, -18, 11, -18); fence(11, -18, 11, -7); fence(7.4, -7, 11, -7); fence(-9, -7, -8.5, -7);
  // shed
  props.box(2.4, 2.1, 1.8, '#5a4632', 8.6, 1.05, -16.4).box(2.6, 0.08, 2.1, '#3a3a3a', 8.6, 2.2, -16.4, 0.15).box(0.8, 1.8, 0.03, '#4a3a28', 8.2, 0.9, -15.49).sph(0.03, '#c0a050', 8.5, 1.0, -15.47);
  solid(8.6, 1.05, -16.4, 1.2, 1.05, 0.9);
  // washing line
  props.cyl(0.03, 0.03, 2.2, '#9a9a9a', -6.5, 1.1, -13).cyl(0.03, 0.03, 2.2, '#9a9a9a', -2.5, 1.1, -15.5).box(0.004, 0.004, 4.7, '#ddd', -4.5, 2.1, -14.25, 0, Math.atan2(4, 2.5), 0);
  staticCyl(-6.5, 1.1, -13, 1.1, 0.04); staticCyl(-2.5, 1.1, -15.5, 1.1, 0.04);
  ['#d03030', '#3050d0', '#f0f0f0', '#30a040', '#e0c020'].forEach((c, i) => { const t = 0.15 + i * 0.16; props.box(0.35, 0.45, 0.01, c, -6.5 + 4 * t, 1.85, -13 - 2.5 * t, 0, Math.atan2(4, 2.5) + Math.PI / 2, 0); });
  // BBQ under a cover + patio heater
  props.cyl(0.42, 0.38, 1.0, '#1f2a22', -6.2, 0.5, -8.4, 0, 0, 0, 20).sph(0.42, '#1f2a22', -6.2, 1.0, -8.4, 1, 0.5, 1).cyl(0.44, 0.44, 0.04, '#26332a', -6.2, 0.06, -8.4);
  solid(-6.2, 0.55, -8.4, 0.4, 0.55, 0.4);
  props.cyl(0.04, 0.12, 2.2, '#8a8a8a', 2.6, 1.1, -10.6).cone(0.45, 0.25, '#9a9a9a', 2.6, 2.3, -10.6, Math.PI).cyl(0.25, 0.25, 0.05, '#6a6a6a', 2.6, 0.03, -10.6);
  staticCyl(2.6, 1.1, -10.6, 1.1, 0.12);
  // hedge/trees outside front + garden
  for (let i = 0; i < 12; i++) props.sph(0.7 + rand(0, 0.3), '#2f5a2a', -9 + i * 1.8, 0.6, 11.5, 1.2, 0.9, 1);
  for (const [x, z] of [[-7, -16.5], [-4, -17], [4, -17], [9.8, -12]]) { props.cyl(0.12, 0.16, 2.4, '#4a3420', x, 1.2, z).sph(1.3, '#2e5226', x, 3.0, z, 1, 1.1, 1, 10); staticCyl(x, 1.2, z, 1.2, 0.16); }

  // ---------- Hallway ----------
  // stairs: 13 thin slab steps rising toward -z, bannister, Mason's stair gate at the bottom
  for (let i = 0; i < 13; i++) {
    const z = 4.3 - (i + 0.5) * 0.185, y = (i + 1) * 0.185;
    add(M.oakWood, uvBox(-1.55, y - 0.03, z, 0.9, 0.06, 0.185, 0.8)); add(M.skirting, uvBox(-1.55, y - 0.12, z + 0.09, 0.9, 0.12, 0.02));
    solid(-1.55, y - 0.03, z, 0.45, 0.03, 0.0925);
  }
  add(M.paintHall, uvBox(-1.55, 2.47, 1.0, 0.9, 0.06, 1.8)); // landing soffit
  for (let i = 0; i < 14; i++) { const z = 4.3 - i * 0.185; props.box(0.03, 0.9, 0.03, '#f4f4f4', -1.13, (i + 1) * 0.185 + 0.45, z); }
  props.box(0.06, 0.06, 3.4, '#5a3a22', -1.13, 2.05, 3.1, -Math.PI / 4).box(0.09, 1.1, 0.09, '#f4f4f4', -1.13, 0.55, 4.3).sph(0.06, '#f4f4f4', -1.13, 1.12, 4.3);
  // coat hooks with coats on the hall east wall near the door
  props.box(1.0, 0.08, 0.03, '#4a3020', 0.98, 1.75, 5.2, 0, Math.PI / 2);
  ['#2a2a3a', '#7a2a2a', '#3a5a3a', '#b0a080', '#222'].forEach((c, i) => { props.rbox(0.38, 0.95, 0.16, 0.06, c, 0.93, 1.25, 4.8 + i * 0.2, 0, Math.PI / 2 + rand(-0.1, 0.1), rand(-0.05, 0.05)); });
  // hall console table + mirror + radiator + doormat + family photo hooks
  props.box(0.3, 0.04, 0.9, '#4a2e1c', -0.93, 0.85, 2.2).box(0.03, 0.85, 0.03, '#4a2e1c', -0.8, 0.42, 1.8).box(0.03, 0.85, 0.03, '#4a2e1c', -0.8, 0.42, 2.6);
  solid(-0.93, 0.85, 2.2, 0.15, 0.02, 0.45);
  props.box(0.04, 0.6, 1.0, '#ffffff', 0.95, 0.5, 1.4).box(0.02, 0.55, 0.95, '#dddddd', 0.93, 0.5, 1.4);
  props.box(0.9, 0.02, 0.55, '#6a4a2a', 0, 0.01, 5.5);
  // front door (fixed, with doorbell)
  props.box(0.9, 2.05, 0.06, '#7a1f24', 0, 1.025, 6.0).box(0.5, 0.55, 0.01, '#bdd7e0', 0, 1.6, 5.965).sph(0.035, '#d4af37', 0.33, 1.0, 5.96).box(0.12, 0.03, 0.02, '#d4af37', 0, 1.25, 5.965);
  solid(0, 1.025, 6.0, 0.45, 1.025, 0.04);
  props.box(0.07, 0.11, 0.03, '#eee', 0.65, 1.3, 6.08).sph(0.015, '#c33', 0.65, 1.3, 6.1);
  H.interact.push({ id: 'doorbell', pos: new THREE.Vector3(0.65, 1.3, 5.95), r: 0.25, label: 'Ring doorbell' });
  // ---------- Toilet ----------
  props.rbox(0.38, 0.4, 0.55, 0.12, '#f8f8f8', -2.6, 0.2, 5.0).rbox(0.4, 0.45, 0.2, 0.05, '#f8f8f8', -2.85, 0.6, 5.0, 0, Math.PI / 2).box(0.04, 0.04, 0.1, '#bbb', -2.75, 0.85, 5.15);
  solid(-2.65, 0.2, 5.0, 0.25, 0.2, 0.25);
  props.box(0.45, 0.15, 0.35, '#f8f8f8', -2.0, 0.85, 5.82).cyl(0.02, 0.02, 0.85, '#f8f8f8', -2.0, 0.42, 5.8).cyl(0.01, 0.01, 0.12, '#ccc', -2.0, 0.98, 5.9);
  props.box(0.5, 0.6, 0.02, '#c8e0ea', -2.0, 1.45, 5.93);
  H.interact.push({ id: 'flush', pos: new THREE.Vector3(-2.75, 0.85, 5.15), r: 0.25, label: 'Wiggle the flush handle' });
  // ---------- Under-stairs cupboard & garage ----------
  props.box(1.8, 0.03, 0.4, '#8a7050', -2.05, 1.4, 0.25).box(1.8, 0.03, 0.4, '#8a7050', -2.05, 1.8, 0.25);
  H.interact.push({ id: 'garageLight', pos: new THREE.Vector3(-3.15, 1.3, 1.7), r: 0.25, label: 'Light switch (broken)' });
  props.box(0.08, 0.12, 0.03, '#eee', -3.08, 1.3, 1.7);
  // garage: car, shelves, workbench, chest freezer, fridge (garage fridge is a hinged item)
  car(props, -6.6, 2.8);
  solid(-6.6, 0.7, 2.8, 0.9, 0.7, 2.1);
  props.box(0.5, 1.9, 2.4, '#5a5a5a', -8.15, 0.95, 1.3).box(0.48, 0.03, 2.35, '#7a6a50', -8.15, 0.5, 1.3).box(0.48, 0.03, 2.35, '#7a6a50', -8.15, 1.0, 1.3).box(0.48, 0.03, 2.35, '#7a6a50', -8.15, 1.5, 1.3);
  for (let i = 0; i < 8; i++) props.cyl(0.1, 0.1, 0.18, ['#ddd', '#a33', '#36a', '#eee'][i % 4], -8.15, 0.6 + (i % 3) * 0.5, 0.35 + i * 0.25);
  solid(-8.15, 0.95, 1.3, 0.25, 0.95, 1.2);
  props.box(1.6, 0.06, 0.6, '#6a5030', -5.2, 0.9, 0.4).box(1.6, 0.85, 0.05, '#4a3a28', -5.2, 0.45, 0.12).box(1.4, 0.6, 0.02, '#a08868', -5.2, 1.3, 0.08);
  solid(-5.2, 0.45, 0.4, 0.8, 0.45, 0.3);
  props.rbox(1.2, 0.85, 0.7, 0.03, '#f2f2f2', -3.75, 0.425, 5.55);
  solid(-3.75, 0.42, 5.55, 0.6, 0.42, 0.35);
  // ---------- Kitchen ----------
  kitchen(props, add, M, solid, H);
  // ---------- Living room ----------
  living(props, add, M, solid, H);
  // ---------- Dining / games room ----------
  dining(props, add, M, solid, H);
  // ---------- Conservatory ----------
  props.box(1.2, 0.5, 0.05, '#c8c8c8', 6.9, 0.35, -10.4).box(1.2, 0.02, 0.06, '#ddd', 6.9, 0.62, -10.4); // heater
  H.interact.push({ id: 'heater', pos: new THREE.Vector3(6.9, 0.6, -10.3), r: 0.4, label: 'Conservatory heater' });
  props.box(0.5, 0.6, 0.4, '#222', 4.0, 0.3, -10.2).box(0.42, 0.25, 0.02, '#4af', 4.0, 0.45, -9.99).cyl(0.02, 0.02, 0.9, '#888', 4.3, 1.05, -10.1).sph(0.05, '#222', 4.3, 1.5, -10.1);
  solid(4.0, 0.3, -10.2, 0.25, 0.3, 0.2);
  H.interact.push({ id: 'karaoke', pos: new THREE.Vector3(4.0, 0.6, -10.0), r: 0.4, label: 'Karaoke machine' });

  // ---------- seats the player can use + light switches ----------
  const SP = H.spots;
  H.seats = [...SP.sofaL, ...SP.sofaR, SP.sofaArmL, SP.toilet,
    { pos: new THREE.Vector3(4.2, 0, -8.6), yaw: 0.5, seatY: 0.44 }, { pos: new THREE.Vector3(6.4, 0, -9.5), yaw: -0.5, seatY: 0.44 }, { pos: new THREE.Vector3(5.6, 0, -10.0), yaw: 0.1, seatY: 0.44 },
    { pos: new THREE.Vector3(3.6, 0, 2.05), yaw: Math.PI, seatY: 0.7 }, { pos: new THREE.Vector3(4.8, 0, 2.05), yaw: Math.PI, seatY: 0.7 }];
  const sw = (room, x, y, z, ry) => { props.box(0.08, 0.12, 0.015, '#f4f4f4', x, y, z, 0, ry).box(0.02, 0.04, 0.02, '#ddd', x, y, z, 0, ry); H.interact.push({ id: 'light', room, pos: new THREE.Vector3(x, y, z), r: 0.3, label: 'Light switch' }); };
  sw('living', 0.75, 1.3, -0.075, 0); sw('kitchen', 1.175, 1.3, 2.2, Math.PI / 2); sw('dining', 3.575, 1.3, -0.5, Math.PI / 2); sw('hall', 0.65, 1.3, 5.93, 0);
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
    // nearest room centre
    let best = null, bd = 1e9;
    for (const k in ROOMS) { const r = ROOMS[k]; const cx = Math.max(r.x0 + 0.3, Math.min(r.x1 - 0.3, p.x)), cz = Math.max(r.z0 + 0.3, Math.min(r.z1 - 0.3, p.z)); const d = (cx - p.x) ** 2 + (cz - p.z) ** 2; if (d < bd) { bd = d; best = [cx, cz]; } }
    p.x = best[0]; p.z = best[1]; return p;
  };
  return H;
}

function car(P, x, z) {
  P.rbox(1.8, 0.7, 4.2, 0.2, '#2a4a7a', x, 0.55, z).rbox(1.6, 0.55, 2.2, 0.2, '#2a4a7a', x, 1.1, z - 0.2)
    .box(1.5, 0.45, 0.02, '#203040', x, 1.12, z + 0.92, -0.5).box(1.5, 0.4, 0.02, '#203040', x, 1.12, z - 1.32, 0.5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.cyl(0.33, 0.33, 0.22, '#111', x + sx * 0.82, 0.33, z + sz * 1.35, 0, 0, Math.PI / 2, 18).cyl(0.2, 0.2, 0.23, '#888', x + sx * 0.82, 0.33, z + sz * 1.35, 0, 0, Math.PI / 2, 12);
  P.box(0.3, 0.12, 0.02, '#ffe', x - 0.6, 0.65, z + 2.11).box(0.3, 0.12, 0.02, '#ffe', x + 0.6, 0.65, z + 2.11).box(0.5, 0.12, 0.02, '#eec', x, 0.45, z + 2.11);
}

function kitchen(P, add, M, solid, H) {
  // Units: along front wall (z=6) x[1.2,7], along east wall (x=7) z[0.2,6], along back wall z[0] x[1.2,3.2]; fridge at x[3.3,4.2] back wall
  const unit = (x, z, w, d, rot) => {
    // carcass + doors + handles
    if (rot) { P.box(d, 0.86, w, '#eae6dc', x, 0.43, z); P.box(0.02, 0.7, w - 0.06, '#f4f1ea', x - d / 2 - 0.005, 0.47, z); P.box(0.02, 0.02, 0.18, '#999', x - d / 2 - 0.02, 0.75, z); }
    else { P.box(w, 0.86, d, '#eae6dc', x, 0.43, z); P.box(w - 0.06, 0.7, 0.02, '#f4f1ea', x, 0.47, z + (z > 3 ? -1 : 1) * (d / 2 + 0.005)); P.box(0.18, 0.02, 0.02, '#999', x, 0.75, z + (z > 3 ? -1 : 1) * (d / 2 + 0.02)); }
  };
  for (let x = 1.5; x < 6.9; x += 0.6) unit(x, 5.7, 0.6, 0.6, false);
  for (let z = 0.6; z < 5.4; z += 0.6) unit(6.7, z, 0.6, 0.6, true);
  for (let x = 1.5; x < 3.2; x += 0.6) unit(x, 0.3, 0.6, 0.6, false);
  add(M.worktop, uvBox(4.1, 0.89, 5.68, 5.8, 0.04, 0.64, 1)); add(M.worktop, uvBox(6.68, 0.89, 2.7, 0.64, 0.04, 5.4, 1)); add(M.worktop, uvBox(2.25, 0.89, 0.32, 2.2, 0.04, 0.64, 1));
  solid(4.1, 0.45, 5.68, 2.9, 0.46, 0.32); solid(6.68, 0.45, 2.7, 0.32, 0.46, 2.7); solid(2.25, 0.45, 0.32, 1.1, 0.46, 0.32);
  // splashback tiles
  add(M.tileWall, uvBox(4.1, 1.2, 5.93, 5.8, 0.6, 0.01, 0.6));
  // sink (under the window on the front-door wall) + tap
  P.box(0.7, 0.03, 0.45, '#c8ccd0', 4.2, 0.915, 5.68).box(0.6, 0.02, 0.38, '#8a9096', 4.2, 0.9, 5.68).cyl(0.015, 0.015, 0.25, '#c8ccd0', 4.2, 1.03, 5.92).cyl(0.012, 0.012, 0.18, '#c8ccd0', 4.2, 1.14, 5.83, Math.PI / 2);
  H.interact.push({ id: 'tap', pos: new THREE.Vector3(4.2, 1.05, 5.85), r: 0.25, label: 'Tap' });
  // hob + extractor + oven (oven door is a hinged item)
  P.box(0.6, 0.01, 0.52, '#111', 6.68, 0.915, 3.0); for (const [dx, dz] of [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]]) P.torus(0.07, 0.008, '#444', 6.68 + dz, 0.925, 3.0 + dx, Math.PI / 2);
  P.box(0.6, 0.12, 0.5, '#bbb', 6.75, 1.95, 3.0).box(0.25, 0.6, 0.25, '#bbb', 6.85, 2.3, 3.0);
  P.box(0.03, 0.6, 0.58, '#111', 6.39, 0.45, 3.0);
  // wall cupboards
  for (let x = 1.6; x < 3.0; x += 0.6) P.box(0.58, 0.7, 0.33, '#eae6dc', x, 1.85, 5.82).box(0.12, 0.02, 0.02, '#999', x, 1.55, 5.64);
  for (let x = 5.4; x < 6.9; x += 0.6) P.box(0.58, 0.7, 0.33, '#eae6dc', x, 1.85, 5.82).box(0.12, 0.02, 0.02, '#999', x, 1.55, 5.64);
  for (let z = 4.2; z < 5.4; z += 0.6) P.box(0.33, 0.7, 0.58, '#eae6dc', 6.82, 1.85, z);
  // shelves inside wall cupboard for glasses (open shelf)
  P.box(1.2, 0.03, 0.28, '#6a4a2a', 1.8, 1.45, 0.14).box(1.2, 0.03, 0.28, '#6a4a2a', 1.8, 1.8, 0.14);
  solid(1.8, 1.45, 0.14, 0.6, 0.015, 0.14); solid(1.8, 1.8, 0.14, 0.6, 0.015, 0.14);
  // kitchen island (Julie chases Chip round it)
  P.box(1.8, 0.88, 0.85, '#3a4a5a', 4.2, 0.44, 2.9);
  add(M.worktop, uvBox(4.2, 0.9, 2.9, 2.0, 0.05, 1.0, 1)); solid(4.2, 0.46, 2.9, 1.0, 0.46, 0.5);
  // fridge carcass on the back wall (door is a hinged item) - big American style
  // smoke alarm + clock + kitchen bin
  P.cyl(0.07, 0.07, 0.03, '#f4f4f4', 3.5, 2.48, 3.0).sph(0.008, '#f22', 3.52, 2.46, 3.0);
  H.interact.push({ id: 'smokeAlarm', pos: new THREE.Vector3(3.5, 2.45, 3.0), r: 0.5, label: 'Smoke alarm' });
  P.cyl(0.18, 0.18, 0.03, '#fff', 1.18, 1.9, 4.0, 0, 0, Math.PI / 2).cyl(0.17, 0.17, 0.035, '#222', 1.17, 1.9, 4.0, 0, 0, Math.PI / 2, 20);
  H.spots.kettle = new THREE.Vector3(5.6, 0.93, 5.7);
  H.spots.fridge = new THREE.Vector3(3.8, 0, 1.2);
  H.spots.buffet = [new THREE.Vector3(2.4, 0, 5.0), new THREE.Vector3(3.6, 0, 5.0), new THREE.Vector3(5.2, 0, 5.0), new THREE.Vector3(6.0, 0, 4.0), new THREE.Vector3(6.0, 0, 2.0)];
  H.spots.kitchen = [new THREE.Vector3(5.6, 0, 1.5), new THREE.Vector3(2.4, 0, 2.2), new THREE.Vector3(5.8, 0, 4.3)];
}

function living(P, add, M, solid, H) {
  // rug
  add(M.rug, (() => { const g = new THREE.BoxGeometry(3.0, 0.012, 2.2); g.translate(0, 0.006, -3.6); return g; })());
  // Sofas (left along west wall facing east; right along east side facing west)
  sofa(P, -3.0, -3.3, Math.PI / 2, '#4a5868', solid);
  sofa(P, 2.85, -3.6, -Math.PI / 2, '#6a3a3a', solid);
  // TV in the far (back-left) corner on a stand, angled to the room
  const tvX = -2.85, tvZ = -6.4, tvYaw = Math.PI / 4;
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
  // TV collider (gets hit by thrown things)
  const tvc = staticBox(H.tv.center.x, H.tv.center.y, H.tv.center.z, 0.72, 0.42, 0.04, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, tvYaw, 0)), { tag: 'tv' });
  G.colliderMap.get(tvc.collider.handle).tag = 'tv';
  // Martin's armchair spot by the TV (the armchair itself is a heavy dynamic item)
  H.spots.armchair = { pos: new THREE.Vector3(-1.9, 0, -6.1), yaw: Math.PI * 0.82, seatY: 0.44 };
  // fireplace + mantelpiece on the front wall (z=0) — the Mason Cup lives here
  P.box(1.5, 1.2, 0.35, '#e8e2d8', -2.2, 0.6, -0.2).box(0.7, 0.55, 0.36, '#181412', -2.2, 0.3, -0.21).box(1.7, 0.06, 0.42, '#3a2a1e', -2.2, 1.22, -0.24).box(1.6, 0.06, 0.6, '#d8d0c4', -2.2, 0.03, -0.45);
  solid(-2.2, 0.62, -0.2, 0.85, 0.62, 0.21);
  H.spots.mantel = new THREE.Vector3(-2.2, 1.25, -0.28);
  // stockings on the mantel
  ['#c41e1e', '#1f7a3a', '#c41e1e', '#e0e0e0'].forEach((c, i) => P.rbox(0.12, 0.3, 0.05, 0.02, c, -2.75 + i * 0.36, 1.0, -0.47).rbox(0.15, 0.08, 0.05, 0.02, c, -2.71 + i * 0.36, 0.86, -0.47).box(0.13, 0.05, 0.055, '#fff', -2.75 + i * 0.36, 1.15, -0.47));
  // bookcase on west wall near front
  P.box(0.35, 2.0, 1.0, '#4a2e1c', -3.3, 1.0, -0.9);
  for (let s = 0; s < 4; s++) { P.box(0.33, 0.02, 0.96, '#5a3a24', -3.28, 0.3 + s * 0.45, -0.9); for (let b = 0; b < 8; b++) P.box(0.22, 0.28 + (b % 3) * 0.03, 0.08, ['#7a2a2a', '#2a4a7a', '#3a6a3a', '#d8c08a', '#555'][(b + s) % 5], -3.24, 0.45 + s * 0.45, -1.3 + b * 0.11); }
  solid(-3.3, 1.0, -0.9, 0.17, 1.0, 0.5);
  // side lamps + plant + radiator + curtains in bay
  P.cyl(0.18, 0.12, 0.3, '#e8dcc0', -3.2, 1.0, -5.4).cyl(0.02, 0.02, 0.4, '#888', -3.2, 0.7, -5.4).box(0.4, 0.5, 0.4, '#4a2e1c', -3.2, 0.25, -5.4);
  solid(-3.2, 0.25, -5.4, 0.2, 0.25, 0.2);
  P.cyl(0.18, 0.14, 0.35, '#9a5a3a', 3.15, 0.175, -6.6).sph(0.35, '#3a6a32', 3.15, 0.6, -6.6, 1, 1.3, 1, 8);
  P.box(1.2, 0.6, 0.08, '#f2f2f2', 0.0, 0.4, -0.1); for (let i = 0; i < 12; i++) P.box(0.02, 0.58, 0.1, '#e0e0e0', -0.55 + i * 0.1, 0.4, -0.1);
  for (const sx of [-1.45, 1.45]) P.box(0.35, 2.3, 0.08, '#6a1e2a', sx, 1.2, -7.05);
  P.box(3.2, 0.06, 0.06, '#c0a060', 0, 2.35, -7.05);
  // ceiling light + picture frames
  P.cyl(0.25, 0.3, 0.12, '#f4efe4', 0, 2.38, -3.5).cyl(0.01, 0.01, 0.1, '#888', 0, 2.47, -3.5);
  P.box(0.9, 0.6, 0.03, '#3a2a1a', 0, 1.6, -0.08).box(0.8, 0.5, 0.01, '#88a0b8', 0, 1.6, -0.1);
  // Chip's bed by the radiator
  P.torus(0.32, 0.1, '#8a6a4a', -0.9, 0.08, -0.5, Math.PI / 2).cyl(0.3, 0.3, 0.05, '#c8b090', -0.9, 0.03, -0.5);
  H.spots.chipBed = new THREE.Vector3(-0.9, 0, -0.5);
  H.spots.tree = new THREE.Vector3(0, 0, -7.45);
  // Seats: left sofa (3), right sofa (3), floor cushions, standing spots
  H.spots.sofaL = [-4.1, -3.3, -2.5].map(z => ({ pos: new THREE.Vector3(-2.85, 0, z), yaw: Math.PI / 2, seatY: 0.45 }));
  H.spots.sofaR = [-4.4, -3.6, -2.8].map(z => ({ pos: new THREE.Vector3(2.7, 0, z), yaw: -Math.PI / 2, seatY: 0.45 }));
  H.spots.sofaArmL = { pos: new THREE.Vector3(-2.9, 0, -1.75), yaw: Math.PI / 2, seatY: 0.62 };
  H.spots.floor = [[-0.9, -2.3, Math.PI], [0.8, -2.3, Math.PI], [-1.1, -5.0, 0], [1.2, -5.0, 0]].map(([x, z, y]) => ({ pos: new THREE.Vector3(x, 0, z), yaw: y }));
  H.spots.stand = [[-1.9, -1.0, Math.PI * 0.9], [1.9, -1.0, -Math.PI * 0.9], [2.3, -6.2, -Math.PI * 0.7], [-1.0, -6.6, Math.PI * 0.1], [0.2, -0.8, Math.PI]].map(([x, z, y]) => ({ pos: new THREE.Vector3(x, 0, z), yaw: y }));
  H.spots.martinStand = { pos: new THREE.Vector3(-1.6, 0, -5.4), yaw: Math.PI * 0.85 };
}

function sofa(P, x, z, yaw, color, solid) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const L = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const add = (w, h, d, lx, y, lz, col, r = 0.06) => { const [px, pz] = L(lx, lz); P.rbox(w, h, d, r, col, px, y, pz, 0, yaw); };
  const dark = new THREE.Color(color).multiplyScalar(0.8).getStyle();
  add(2.4, 0.42, 0.9, 0, 0.21, 0, dark, 0.04);            // base
  add(2.4, 0.5, 0.25, 0, 0.62, -0.33, color, 0.1);         // back
  add(0.22, 0.62, 0.9, -1.1, 0.42, 0, color, 0.1); add(0.22, 0.62, 0.9, 1.1, 0.42, 0, color, 0.1); // arms
  for (let i = -1; i <= 1; i++) { add(0.66, 0.16, 0.66, i * 0.68, 0.49, 0.08, color, 0.07); add(0.62, 0.4, 0.14, i * 0.68, 0.72, -0.17, color, 0.07); }
  for (const lx of [-1.1, 1.1]) for (const lz of [-0.38, 0.38]) { const [px, pz] = L(lx, lz); P.cyl(0.025, 0.02, 0.06, '#2a1a10', px, 0.03, pz); }
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
  const [bx, bz] = L(0, 0); staticBox(bx, 0.28, bz, 1.2, 0.28, 0.45, q);
  const [kx, kz] = L(0, -0.33); staticBox(kx, 0.62, kz, 1.2, 0.3, 0.12, q);
  for (const lx of [-1.1, 1.1]) { const [ax, az] = L(lx, 0); staticBox(ax, 0.4, az, 0.11, 0.31, 0.45, q); }
}

function dining(P, add, M, solid, H) {
  // PC desk in far right corner + tower; monitor screen is a canvas set up by the UI
  P.box(1.4, 0.04, 0.7, '#e8e4dc', 6.2, 0.75, -6.55).box(0.04, 0.73, 0.66, '#cfc8bc', 5.52, 0.37, -6.55).box(0.04, 0.73, 0.66, '#cfc8bc', 6.88, 0.37, -6.55);
  P.box(0.2, 0.45, 0.42, '#1a1a1a', 6.7, 0.23, -6.5).sph(0.01, '#3af', 6.6, 0.4, -6.28);
  P.box(0.45, 0.02, 0.15, '#222', 6.1, 0.78, -6.35).box(0.06, 0.02, 0.1, '#222', 6.45, 0.78, -6.35);
  solid(6.2, 0.38, -6.55, 0.7, 0.39, 0.35);
  const mon = new THREE.Group(); mon.position.set(6.15, 0.77, -6.75);
  const mb = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.44, 0.04), new THREE.MeshStandardMaterial({ color: '#111' })); mb.position.y = 0.36; mon.add(mb);
  const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), mb.material); st.position.y = 0.08; mon.add(st);
  G.scene.add(mon); mon.updateMatrixWorld(true);
  H.pc = { group: mon, w: 0.66, h: 0.38, center: new THREE.Vector3(6.15, 1.13, -6.72) };
  H.interact.push({ id: 'pc', pos: new THREE.Vector3(6.15, 1.0, -6.4), r: 0.5, label: 'Dining room PC' });
  // sideboard
  P.box(1.6, 0.85, 0.45, '#4a2e1c', 3.85, 0.425, -3.5, 0, Math.PI / 2).box(1.62, 0.03, 0.47, '#3a2216', 3.85, 0.86, -3.5, 0, Math.PI / 2);
  solid(3.85, 0.43, -3.5, 0.23, 0.43, 0.8);
  // wall art + ceiling light
  P.box(0.03, 0.7, 1.0, '#2a2a2a', 6.92, 1.6, -2.0).box(0.01, 0.6, 0.9, '#c87a3a', 6.9, 1.6, -2.0);
  P.cyl(0.2, 0.05, 0.25, '#e8d8a8', 5.2, 2.3, -3.5).cyl(0.005, 0.005, 0.2, '#555', 5.2, 2.45, -3.5);
  H.spots.dining = [[5.2, -2.0, Math.PI / 2], [5.2, -4.4, Math.PI / 2], [4.6, -3.2, Math.PI / 2]].map(([x, z, y]) => ({ pos: new THREE.Vector3(x, 0, z), yaw: y }));
  H.spots.games = new THREE.Vector3(5.0, 0, -3.3);
  H.spots.conservatory = [[4.2, -8.6, 0.5], [6.4, -9.5, -0.5], [5.4, -8.0, Math.PI]].map(([x, z, y]) => ({ pos: new THREE.Vector3(x, 0, z), yaw: y }));
  H.spots.garden = [[-2.0, -9.3, 0], [0.0, -8.4, 0], [-5.0, -11, 0.5], [4.5, -13, 0]].map(([x, z, y]) => ({ pos: new THREE.Vector3(x, 0, z), yaw: y }));
  H.spots.bayOutside = { pos: new THREE.Vector3(0.0, 0, -8.35), yaw: 0 };
  H.spots.garage = new THREE.Vector3(-4.6, 0, 3.5);
  H.spots.garageFridge = new THREE.Vector3(-4.1, 0, 4.4);
  H.spots.toilet = { pos: new THREE.Vector3(-2.4, 0, 5.0), yaw: -Math.PI / 2, seatY: 0.42 };
  H.spots.hallDoor = new THREE.Vector3(0, 0, 5.4);
  H.spots.hallway = new THREE.Vector3(0, 0, 3.0);
}

function buildLights(H) {
  const s = G.scene;
  const hemi = new THREE.HemisphereLight('#fff6e8', '#4a3a2a', 0.55); s.add(hemi); H.lights.hemi = hemi;
  const sun = new THREE.DirectionalLight('#fff2dc', 1.4); sun.position.set(-6, 9, -14); sun.target.position.set(0, 0, -3); s.add(sun, sun.target); H.lights.sun = sun;
  sun.castShadow = !!G.settings?.shadows; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 }); sun.shadow.bias = -0.0005;
  const mk = (name, color, I, x, y, z, dist = 8) => { const l = new THREE.PointLight(color, I, dist, 1.6); l.position.set(x, y, z); s.add(l); H.lights[name] = l; return l; };
  mk('living', '#ffe2b8', 6, 0, 2.2, -3.5, 9);
  mk('kitchen', '#fff0dc', 6, 4.2, 2.3, 3.0, 9);
  mk('dining', '#ffe0b0', 4, 5.2, 2.2, -3.5, 7);
  mk('hall', '#ffe8c8', 3, 0, 2.3, 3.0, 6);
  mk('tree', '#ffb060', 2.5, 0, 1.4, -7.3, 4);
  mk('tv', '#9ab8ff', 0.0, -2.4, 1.0, -5.9, 4);
  mk('garage', '#c8d0ff', 0.25, -5.8, 2.3, 2.5, 7);
  H.daylight = 1;
}
export function setDaylight(t) { // 1 = 2pm daylight, 0 = night
  const H = G.house; if (!H) return; H.daylight = t;
  H.lights.sun.intensity = 1.6 * t; H.lights.hemi.intensity = 0.25 + 0.4 * t;
  const sky = new THREE.Color('#0b1020').lerp(new THREE.Color('#aebfd0'), t);
  if (t < 0.6 && t > 0.2) sky.lerp(new THREE.Color('#d08050'), 0.35 * (1 - Math.abs(t - 0.4) / 0.2));
  G.scene.background = sky; if (G.scene.fog) G.scene.fog.color.copy(sky);
}

// Simple waypoint graph for NPC walking between rooms
function buildNav(H) {
  const N = {
    hallFront: [0, 5.0], hallMid: [0, 3.0], hallBack: [0, 0.8], livingDoor: [0, -0.6], living: [0, -3.4], livingL: [-1.8, -2.0], livingR: [1.8, -2.0], livingBack: [0, -5.6], livingTV: [-1.6, -5.4],
    kitchenDoor: [1.6, 2.85], kitchen: [3.0, 1.7], kitchenE: [5.6, 1.6], kitchenN: [5.6, 4.2], kitchenW: [2.4, 4.2],
    diningDoorL: [3.0, -1.15], diningIn: [4.4, -1.15], dining: [5.0, -3.3], diningK: [5.85, -0.8], kitchenD: [5.85, 0.7], diningBack: [5.0, -6.3],
    consDoor: [5.0, -7.4], cons: [5.2, -8.8], consW: [3.9, -8.95], patio: [2.2, -8.95], garden: [-1.0, -9.6], gardenFar: [-3.0, -13.0], bayOut: [0, -8.4],
    toiletDoor: [-0.6, 5.05], toilet: [-1.9, 5.05], cupDoor: [-0.6, 1.15], cupboard: [-1.9, 1.15], garageDoor: [-2.6, 1.05], garageIn: [-3.6, 1.05], garage: [-4.4, 3.2], garageFridge: [-4.1, 4.3],
  };
  const E = [['hallFront', 'hallMid'], ['hallMid', 'hallBack'], ['hallBack', 'livingDoor'], ['livingDoor', 'living'], ['livingDoor', 'livingL'], ['livingDoor', 'livingR'], ['living', 'livingL'], ['living', 'livingR'], ['living', 'livingBack'], ['livingBack', 'livingTV'], ['livingL', 'livingTV'],
    ['hallMid', 'kitchenDoor'], ['kitchenDoor', 'kitchen'], ['kitchen', 'kitchenE'], ['kitchen', 'kitchenW'], ['kitchenE', 'kitchenN'], ['kitchenW', 'kitchenN'], ['kitchenE', 'kitchenD'], ['kitchenD', 'diningK'], ['diningK', 'dining'],
    ['livingR', 'diningDoorL'], ['diningDoorL', 'diningIn'], ['diningIn', 'dining'], ['diningIn', 'diningK'], ['dining', 'diningBack'], ['diningBack', 'consDoor'], ['consDoor', 'cons'], ['cons', 'consW'], ['consW', 'patio'], ['patio', 'garden'], ['garden', 'gardenFar'], ['garden', 'bayOut'], ['patio', 'bayOut'],
    ['hallFront', 'toiletDoor'], ['toiletDoor', 'toilet'], ['hallBack', 'cupDoor'], ['hallMid', 'cupDoor'], ['cupDoor', 'cupboard'], ['cupboard', 'garageDoor'], ['garageDoor', 'garageIn'], ['garageIn', 'garage'], ['garage', 'garageFridge']];
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
