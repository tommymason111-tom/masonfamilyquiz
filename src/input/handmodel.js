// A realistic, fully articulated hand: 25 bones in the same order as WebXR hand joints, so in VR every
// knuckle follows your real hand, and on a flat screen we pose it (relaxed / grip / fist / point / pinch).
// Sculpted palm with thenar & hypothenar pads, knuckles, tapered phalanges, rounded fingertips, nails,
// skin tone variation (pinker palm & fingertips, warmer knuckles), sheen for skin, ribbed jumper cuff, watch.
import * as THREE from 'three';
import { mergeGeometries } from '../engine/geo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// right hand, canonical frame: wrist at origin, fingers along -Z, back of the hand +Y, thumb on -X
const J = [
  V(0, 0, 0),                                                                                         // 0 wrist
  V(-0.021, -0.008, -0.022), V(-0.043, -0.017, -0.05), V(-0.058, -0.022, -0.079), V(-0.066, -0.025, -0.101), // thumb
  V(-0.017, 0.004, -0.026), V(-0.024, 0.003, -0.093), V(-0.026, 0.0, -0.135), V(-0.027, -0.002, -0.16), V(-0.027, -0.004, -0.181),  // index
  V(-0.004, 0.005, -0.027), V(-0.004, 0.004, -0.096), V(-0.004, 0.0, -0.143), V(-0.004, -0.002, -0.172), V(-0.004, -0.004, -0.195),  // middle
  V(0.011, 0.004, -0.026), V(0.016, 0.002, -0.091), V(0.018, -0.001, -0.134), V(0.019, -0.003, -0.161), V(0.02, -0.005, -0.183),    // ring
  V(0.022, 0.002, -0.024), V(0.032, -0.001, -0.083), V(0.037, -0.004, -0.114), V(0.039, -0.006, -0.134), V(0.04, -0.008, -0.153),   // pinky
];
const PARENT = [-1, 0, 1, 2, 3, 0, 5, 6, 7, 8, 0, 10, 11, 12, 13, 0, 15, 16, 17, 18, 0, 20, 21, 22, 23];
const CHILD = [10, 2, 3, 4, 4, 6, 7, 8, 9, 9, 11, 12, 13, 14, 14, 16, 17, 18, 19, 19, 21, 22, 23, 24, 24];
// finger radii at each joint (prox, inter, distal, tip)
const RAD = { index: [0.0102, 0.0091, 0.0081, 0.0074], middle: [0.0106, 0.0094, 0.0083, 0.0076], ring: [0.0099, 0.0089, 0.0079, 0.0072], pinky: [0.0088, 0.0079, 0.0071, 0.0064], thumb: [0.0135, 0.0112, 0.0093] };
const FINGERS = [['index', 5], ['middle', 10], ['ring', 15], ['pinky', 20]];

const C = (h) => new THREE.Color(h);
const SKIN = C('#e3b296'), PALM = C('#eebfa6'), KNUCK = C('#d99e86'), TIPC = C('#efb4a0'), NAIL = C('#f2cfc6'), NAILEDGE = C('#fbf1ea');

function frameFor(i, J) { // bind orientation: -Z along the bone, +Y towards the back of the hand
  const a = J[i], b = J[CHILD[i]]; let dir = b.clone().sub(a); if (dir.lengthSq() < 1e-8 || i === CHILD[i]) dir = a.clone().sub(J[PARENT[i]]); dir.normalize();
  const z = dir.clone().negate(); const up = V(0, 1, 0); const x = up.clone().cross(z).normalize(); const y = z.clone().cross(x).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

class Builder {
  constructor() { this.p = []; this.c = []; this.si = []; this.sw = []; this.idx = []; }
  v(p, col, b0, b1 = b0, w = 1) { this.p.push(p.x, p.y, p.z); this.c.push(col.r, col.g, col.b); this.si.push(b0, b1, 0, 0); this.sw.push(w, 1 - w, 0, 0); return this.p.length / 3 - 1; }
  // ring-loft along a list of rings: {c, x, y, rx, ry, col(angle,t), skin(t)->[b0,b1,w]}
  loft(rings, segs, capStart, capEnd) {
    const base = this.p.length / 3;
    rings.forEach((r) => { for (let j = 0; j < segs; j++) { const a = j / segs * Math.PI * 2; const ca = Math.cos(a), sa = Math.sin(a);
      const pw = r.pw || 1; const cx = Math.sign(ca) * Math.abs(ca) ** pw, sy = Math.sign(sa) * Math.abs(sa) ** pw;
      const ry = sa < 0 ? r.ry * (r.palmBulge || 1) : r.ry;
      const p = r.c.clone().addScaledVector(r.x, cx * r.rx).addScaledVector(r.y, sy * ry); if (r.zf) p.addScaledVector(r.zdir, r.zf(cx));
      const sk = r.skin(p, a); this.v(p, r.col(a, p), sk[0], sk[1], sk[2]); } });
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < segs; j++) { const a = base + i * segs + j, b = base + i * segs + (j + 1) % segs, c = a + segs, d = b + segs; this.idx.push(a, b, c, b, d, c); }
    const cap = (ri, dir) => { const r = rings[ri]; const n = r.capSteps || 1; let prev = base + ri * segs;
      for (let k = 1; k <= n; k++) { const t = k / n; const s = Math.cos(t * Math.PI / 2), h = Math.sin(t * Math.PI / 2) * (r.capLen || 0);
        if (k === n) { const p = r.c.clone().addScaledVector(r.zdir, dir * h); const sk = r.skin(p, 0); const ci = this.v(p, r.col(Math.PI / 2, p), sk[0], sk[1], sk[2]); for (let j = 0; j < segs; j++) { const a = prev + j, b = prev + (j + 1) % segs; if (dir > 0) this.idx.push(a, b, ci); else this.idx.push(a, ci, b); } break; }
        const st = this.p.length / 3; for (let j = 0; j < segs; j++) { const a = j / segs * Math.PI * 2; const p = r.c.clone().addScaledVector(r.x, Math.cos(a) * r.rx * s).addScaledVector(r.y, Math.sin(a) * r.ry * s).addScaledVector(r.zdir, dir * h); const sk = r.skin(p, a); this.v(p, r.col(a, p), sk[0], sk[1], sk[2]); }
        for (let j = 0; j < segs; j++) { const a = prev + j, b = prev + (j + 1) % segs, c = st + j, d = st + (j + 1) % segs; if (dir > 0) this.idx.push(a, b, c, b, d, c); else this.idx.push(a, c, b, b, c, d); }
        prev = st; } };
    if (capStart) cap(0, -1); if (capEnd) cap(rings.length - 1, 1);
  }
  ellipsoid(c, r, q, col, bone) {
    const base = this.p.length / 3, la = 8, lo = 12;
    for (let i = 0; i <= la; i++) { const th = i / la * Math.PI; for (let j = 0; j <= lo; j++) { const ph = j / lo * Math.PI * 2; const p = V(Math.sin(th) * Math.cos(ph) * r.x, Math.cos(th) * r.y, Math.sin(th) * Math.sin(ph) * r.z); if (q) p.applyQuaternion(q); p.add(c); this.v(p, typeof col === 'function' ? col(p) : col, bone); } }
    for (let i = 0; i < la; i++) for (let j = 0; j < lo; j++) { const a = base + i * (lo + 1) + j, b = a + 1, c2 = a + lo + 1, d = c2 + 1; this.idx.push(a, b, c2, b, d, c2); }
  }
  build(mirror) {
    const pos = new Float32Array(this.p); const idx = this.idx.slice();
    if (mirror) { for (let i = 0; i < pos.length; i += 3) pos[i] = -pos[i]; for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
}
const mix = (a, b, t) => a.clone().lerp(b, Math.max(0, Math.min(1, t)));
const noise = (p) => (Math.sin(p.x * 900) * Math.sin(p.y * 1300 + 1) * Math.sin(p.z * 1100 + 2) + 1) * 0.5;

function buildGeometry(opts) {
  const B = new Builder(); const Q = J.map((_, i) => frameFor(i, J));
  const axes = (i) => ({ x: V(1, 0, 0).applyQuaternion(Q[i]), y: V(0, 1, 0).applyQuaternion(Q[i]), z: V(0, 0, -1).applyQuaternion(Q[i]) });
  const skinTone = (p, a, extra = 0) => { const palmSide = Math.sin(a) < 0 ? 1 : 0; let c = mix(SKIN, PALM, palmSide * 0.7 + extra); return c.multiplyScalar(0.96 + noise(p) * 0.06); };
  // ---- fingers ----
  for (const [name, b] of FINGERS) {
    const R = RAD[name]; const segs = [[b + 1, b + 2, R[0], R[1]], [b + 2, b + 3, R[1], R[2]], [b + 3, b + 4, R[2], R[3]]];
    segs.forEach(([i, k, r0, r1], si) => {
      const A = axes(i); const rings = []; const N = 7;
      for (let s = 0; s <= N; s++) { const t = s / N; const c = J[i].clone().lerp(J[k], t); if (si === 0 && s === 0) c.addScaledVector(A.z, -0.014); const r = (r0 + (r1 - r0) * t) * (si === 0 && s === 0 ? 1.15 : 1); const knuckle = Math.exp(-((t * 8) ** 2)) * 0.08;
        rings.push({ c, x: A.x, y: A.y, zdir: A.z, rx: r * (1.05 + knuckle), ry: r * (0.92 + knuckle * 0.6), palmBulge: 1.08 - 0.12 * Math.abs(Math.sin(t * Math.PI * 1)) , capLen: r * 1.0, capSteps: 4,
          col: (a, p) => { let col = skinTone(p, a); if (Math.sin(a) > 0.3 && t < 0.18) col = mix(col, KNUCK, 0.55); if (Math.sin(a) < -0.4 && (t > 0.35 && t < 0.45)) col.multiplyScalar(0.9); if (si === 2) col = mix(col, TIPC, t * 0.5); return col; },
          skin: () => t < 0.18 && si > 0 ? [i, PARENT[i], 0.5 + t * 2.7] : t > 0.82 && si < 2 ? [i, k, 1 - (t - 0.82) * 2.7] : [i, i, 1] }); }
      B.loft(rings, 14, false, si === 2);
      if (si === 2) { // nail on the distal phalanx
        const nc = J[i].clone().lerp(J[k], 0.62).addScaledVector(A.y, r1 * 0.78); const q = Q[i].clone();
        B.ellipsoid(nc, V(r0 * 0.78, r0 * 0.16, (J[i].distanceTo(J[k])) * 0.42), q, (p) => { const d = p.clone().sub(J[k]).dot(A.z); return d > -0.004 ? NAILEDGE : NAIL; }, i);
      }
    });
    // knuckle bump on the back of the hand
  }
  // ---- thumb (metacarpal pad + two phalanges) ----
  { const T = [[1, 2, RAD.thumb[0] * 1.35, RAD.thumb[0]], [2, 3, RAD.thumb[0], RAD.thumb[1]], [3, 4, RAD.thumb[1], RAD.thumb[2]]];
    T.forEach(([i, k, r0, r1], si) => { const A = axes(i); const rings = []; const N = 7;
      for (let s = 0; s <= N; s++) { const t = s / N; const c = J[i].clone().lerp(J[k], t); if (si === 0 && s === 0) c.add(V(0.012, 0.004, 0.004)); const r = r0 + (r1 - r0) * t;
        rings.push({ c, x: A.x, y: A.y, zdir: A.z, rx: r * (si === 0 ? 1.25 : 1.08), ry: r * 0.95, palmBulge: si === 0 ? 1.5 : 1.05, capLen: r, capSteps: 4,
          col: (a, p) => { let col = skinTone(p, a); if (si === 2) col = mix(col, TIPC, t * 0.5); return col; },
          skin: () => t < 0.2 && si > 0 ? [i, PARENT[i], 0.5 + t * 2.5] : t > 0.8 && si < 2 ? [i, k, 1 - (t - 0.8) * 2.5] : [i, i, 1] }); }
      B.loft(rings, 14, false, si === 2);
      if (si === 2) { const nc = J[i].clone().lerp(J[k], 0.6).addScaledVector(A.y, r1 * 0.8); B.ellipsoid(nc, V(r0 * 0.8, r0 * 0.16, J[i].distanceTo(J[k]) * 0.4), Q[i], NAIL, i); }
    }); }
  // ---- palm ----
  { const knZ = (x) => { const pts = FINGERS.map(([, b]) => J[b + 1]).sort((a, b) => a.x - b.x); if (x <= pts[0].x) return pts[0].z; if (x >= pts[3].x) return pts[3].z; for (let i = 0; i < 3; i++) if (x <= pts[i + 1].x) return pts[i].z + (pts[i + 1].z - pts[i].z) * (x - pts[i].x) / (pts[i + 1].x - pts[i].x); };
    const metaFor = (x) => { let best = 5, bd = 1e9; for (const [, b] of FINGERS) { const d = Math.abs(J[b + 1].x - x); if (d < bd) { bd = d; best = b; } } return best; };
    const rings = []; const N = 9; const ends = [1, 0.85, 0.62, 0.3];
    for (let s = 0; s <= N + 3; s++) { const t = Math.min(1, s / N); const e = s > N ? ends[s - N] : 1; const ez = s > N ? (s - N) * 0.0045 : 0;
      const hw = (0.028 + 0.016 * Math.sin(Math.min(1, t * 1.2) * Math.PI / 2)) * e, ht = (0.0125 + 0.004 * Math.sin(t * Math.PI)) * (s > N ? e * 0.9 : 1);
      const cx = -0.004 + 0.002 * t; const z0 = 0.012 * (1 - t);
      rings.push({ c: V(cx, 0.001, z0), x: V(1, 0, 0), y: V(0, 1, 0), zdir: V(0, 0, -1), rx: hw, ry: ht, pw: 0.88, palmBulge: 1.3 - 0.2 * t,
        zf: (u) => { const x = cx + u * hw; return -(knZ(x) + 0.004) * t + ez; },
        col: (a, p) => { let col = skinTone(p, a); const crease = Math.sin(a) < -0.5 && (Math.abs(p.z + 0.06 + p.x * 0.3) < 0.0015 || Math.abs(p.z + 0.075 - p.x * 0.2) < 0.0013); if (crease) col.multiplyScalar(0.9); return col; },
        skin: (p) => { const m = metaFor(p.x); return t < 0.25 ? [0, m, 1 - t * 2] : s >= N ? [m + 1, m, 0.6] : t > 0.88 ? [m, m + 1, 1 - (t - 0.88) * 3.5] : [m, 0, 0.6 + t * 0.4]; } }); }
    B.loft(rings, 22, false, false);
    // thenar & hypothenar pads (fleshy palm bulges)
    // wrist
    const wr = []; for (let s = 0; s <= 4; s++) { const t = s / 4; wr.push({ c: V(-0.003, 0.0, 0.0 + t * 0.06), x: V(1, 0, 0), y: V(0, 1, 0), zdir: V(0, 0, 1), rx: 0.028 + t * 0.003, ry: 0.019 + t * 0.002, pw: 0.85, col: (a, p) => skinTone(p, a, -0.2), skin: () => [0, 0, 1] }); }
    B.loft(wr, 18, false, false);
  }
  // ---- jumper cuff + watch ----
  const cuff = new Builder();
  if (opts.cuff) { const rings = []; const N = 14;
    for (let s = 0; s <= N; s++) { const t = s / N; const z = 0.03 + t * 0.15; const band = (s === 0 ? 0.86 : 1) * (t < 0.3 ? (Math.sin(t * 160) > 0 ? 1.04 : 1) : 1.06);
      const col = t < 0.3 ? C('#1c3a62') : t < 0.36 ? C('#f2f2f2') : t < 0.42 ? C('#c0282d') : t < 0.48 ? C('#f2f2f2') : C('#20406a');
      rings.push({ c: V(-0.003, 0.002, z), x: V(1, 0, 0), y: V(0, 1, 0), zdir: V(0, 0, 1), rx: 0.037 * band + t * 0.006, ry: 0.031 * band + t * 0.005, pw: 0.9, col: (a, p) => col.clone().multiplyScalar(0.9 + noise(p.clone().multiplyScalar(3)) * 0.15), skin: () => [0, 0, 1] }); }
    cuff.loft(rings, 22, false, false); }
  return { hand: B.build(opts.mirror), cuff: opts.cuff ? cuff.build(opts.mirror) : null, Q };
}

const POSES = {
  // per finger: [meta, prox, inter, distal] flexion (rad); thumb: [meta, prox, distal] + opposition
  relaxed: { f: [[0, 0.25, 0.32, 0.18], [0, 0.32, 0.38, 0.2], [0, 0.4, 0.45, 0.24], [0, 0.5, 0.5, 0.28]], t: [0.12, 0.18, 0.12], opp: 0.25, spread: 0.05 },
  open: { f: [[0, 0.05, 0.05, 0.04], [0, 0.05, 0.05, 0.04], [0, 0.06, 0.06, 0.05], [0, 0.08, 0.08, 0.05]], t: [0.0, 0.05, 0.05], opp: 0.05, spread: 0.12 },
  grip: { f: [[0, 0.95, 1.15, 0.6], [0, 1.0, 1.2, 0.65], [0, 1.05, 1.2, 0.7], [0, 1.1, 1.15, 0.7]], t: [0.45, 0.4, 0.35], opp: 0.75, spread: 0 },
  fist: { f: [[0, 1.5, 1.75, 1.0], [0, 1.55, 1.75, 1.05], [0, 1.55, 1.75, 1.05], [0, 1.55, 1.7, 1.05]], t: [0.6, 0.55, 0.65], opp: 0.9, spread: 0 },
  point: { f: [[0, 0.05, 0.05, 0.04], [0, 1.5, 1.7, 1.0], [0, 1.5, 1.7, 1.0], [0, 1.5, 1.6, 1.0]], t: [0.5, 0.45, 0.5], opp: 0.8, spread: 0 },
  pinch: { f: [[0, 0.6, 0.65, 0.35], [0, 0.45, 0.5, 0.3], [0, 0.55, 0.55, 0.3], [0, 0.65, 0.6, 0.3]], t: [0.55, 0.45, 0.3], opp: 0.85, spread: 0.02 },
};

export class HandModel {
  constructor(side = 'R', opts = {}) {
    this.side = side; const mirror = side === 'L';
    const { hand, cuff, Q } = buildGeometry({ mirror, cuff: opts.cuff !== false });
    // bind transforms (mirrored for the left hand)
    this.bindP = J.map(p => mirror ? V(-p.x, p.y, p.z) : p.clone());
    this.bindQ = mirror ? this.bindP.map((_, i) => frameFor(i, this.bindP)) : Q;
    this.root = new THREE.Group();
    this.bones = J.map(() => new THREE.Bone()); this.bones.forEach((b, i) => { b.position.copy(this.bindP[i]); b.quaternion.copy(this.bindQ[i]); this.root.add(b); });
    this.root.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(this.bones);
    this.mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.52, metalness: 0, sheen: 0.6, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ff9a7a'), clearcoat: 0.04, clearcoatRoughness: 0.6 });
    this.mesh = new THREE.SkinnedMesh(hand, this.mat); this.mesh.frustumCulled = false; this.root.add(this.mesh); this.mesh.bind(skeleton);
    if (cuff) { const cm = new THREE.Mesh(cuff, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide })); this.bones[0].add(cm); cm.position.set(0, 0, 0); cm.quaternion.copy(this.bindQ[0]).invert(); this.cuff = cm; }
    if (opts.watch ?? side === 'L') { const w = new THREE.Group(); const strap = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.006, 6, 24), new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.6 })); strap.scale.set(1.0, 0.75, 2.2);
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.008, 24), new THREE.MeshStandardMaterial({ color: '#c0c4c8', metalness: 0.8, roughness: 0.25 })); face.position.set(0, 0.026, 0);
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.002, 24), new THREE.MeshStandardMaterial({ color: '#1a2a3a', roughness: 0.05, metalness: 0.2 })); glass.position.set(0, 0.031, 0);
      w.add(strap, face, glass); w.position.set(0, 0, 0.032); strap.rotation.y = Math.PI / 2; this.watch = w;
      const holder = new THREE.Object3D(); this.bones[0].add(holder); holder.quaternion.copy(this.bindQ[0]).invert(); holder.add(w); }
    // pose state
    this.flex = { f: POSES.relaxed.f.map(a => a.slice()), t: POSES.relaxed.t.slice(), opp: POSES.relaxed.opp, spread: POSES.relaxed.spread };
    this.localOff = J.map((_, i) => PARENT[i] < 0 ? V() : this.bindP[i].clone().sub(this.bindP[PARENT[i]]).applyQuaternion(this.bindQ[PARENT[i]].clone().invert()));
    this.localRot = J.map((_, i) => PARENT[i] < 0 ? this.bindQ[i].clone() : this.bindQ[PARENT[i]].clone().invert().multiply(this.bindQ[i]));
    this.gripPoint = new THREE.Object3D(); this.root.add(this.gripPoint); this.gripPoint.position.set(mirror ? 0.004 : -0.004, -0.032, -0.08);
  }
  // flat-screen: blend towards a named pose and run FK
  pose(name, dt, blend = 12) {
    const P = POSES[name] || POSES.relaxed; const k = 1 - Math.exp(-dt * blend); const F = this.flex;
    for (let f = 0; f < 4; f++) for (let j = 0; j < 4; j++) F.f[f][j] += (P.f[f][j] - F.f[f][j]) * k;
    for (let j = 0; j < 3; j++) F.t[j] += (P.t[j] - F.t[j]) * k; F.opp += (P.opp - F.opp) * k; F.spread += (P.spread - F.spread) * k;
    this.fk();
  }
  fk() {
    const s = this.side === 'L' ? -1 : 1; const F = this.flex; const W = this._W || (this._W = J.map(() => ({ p: V(), q: new THREE.Quaternion() }))); const q = new THREE.Quaternion();
    const flexOf = (i) => { if (i === 0) return null; if (i <= 4) { const j = i - 1; if (j === 3) return null; const r = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -F.t[j]); if (j === 0) r.premultiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -s * F.opp * 0.9)).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), s * F.opp * 0.6)); return r; }
      const f = Math.floor((i - 5) / 5), j = (i - 5) % 5; if (j === 4) return null; const r = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -F.f[f][j]); if (j === 1) r.premultiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), s * (f - 1.5) * F.spread * 0.8)); return r; };
    for (let i = 0; i < J.length; i++) { const p = PARENT[i];
      if (p < 0) { W[i].p.copy(this.bindP[0]); W[i].q.copy(this.bindQ[0]); }
      else { W[i].p.copy(this.localOff[i]).applyQuaternion(W[p].q).add(W[p].p); W[i].q.copy(W[p].q).multiply(this.localRot[i]); }
      const fr = flexOf(i); if (fr) W[i].q.multiply(fr);
      this.bones[i].position.copy(W[i].p); this.bones[i].quaternion.copy(W[i].q); }
  }
  // VR: drive every bone straight from the tracked joints (world space; root must sit at the scene origin)
  setJoint(i, p, q) { this.bones[i].position.copy(p); this.bones[i].quaternion.copy(q); }
  setGlow(on) { this.mat.emissive.set(on ? '#5a3a00' : '#000000'); }
}
