// Chip's skeleton, auto-fitted to the scan: aligns the dog to face +z, finds spine, neck, head, jaw, ears,
// tail and four two-segment legs, skins every vertex, and exposes a pose API the Dog controller drives.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const DB = { pelvis: 0, chest: 1, neck: 2, head: 3, jaw: 4, earL: 5, earR: 6, tail1: 7, tail2: 8, FLu: 9, FLl: 10, FRu: 11, FRl: 12, BLu: 13, BLl: 14, BRu: 15, BRl: 16 };
const PARENTS = [-1, 0, 1, 2, 3, 3, 3, 0, 7, 1, 9, 1, 11, 0, 13, 0, 15];
const N = PARENTS.length;
function segDist(p, a, b) { const ab = b.clone().sub(a); const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / Math.max(1e-9, ab.lengthSq()))); return p.distanceTo(a.clone().addScaledVector(ab, t)); }

export function buildDog(model, shoulderHeight = 0.42) {
  const geo = model.geo.clone(); const pos = geo.attributes.position; const n = pos.count;
  // 1) heading: principal axis of the body on the floor plane; head end = the end with the tallest points
  geo.computeBoundingBox(); let bb = geo.boundingBox; const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  let sxx = 0, szz = 0, sxz = 0; for (let i = 0; i < n; i++) { const x = pos.getX(i) - cx, z = pos.getZ(i) - cz; sxx += x * x; szz += z * z; sxz += x * z; }
  const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz); let ax = V(Math.cos(ang), 0, Math.sin(ang));
  let hiA = -1e9, hiB = -1e9; for (let i = 0; i < n; i++) { const d = (pos.getX(i) - cx) * ax.x + (pos.getZ(i) - cz) * ax.z; const y = pos.getY(i); if (d > 0) hiA = Math.max(hiA, y); else hiB = Math.max(hiB, y); }
  if (hiB > hiA) ax.negate();
  const yaw = Math.atan2(ax.x, ax.z); // rotate so the head end points to +z
  geo.translate(-cx, -bb.min.y, -cz); geo.rotateY(-yaw);
  geo.computeBoundingBox(); bb = geo.boundingBox;
  // 2) scale: top of the scan (head) -> real height; a cocker's head top is ~1.45x shoulder height when alert
  const s = (shoulderHeight * 1.45) / (bb.max.y - bb.min.y); geo.scale(s, s, s); geo.computeBoundingBox(); bb = geo.boundingBox;
  const P = (i) => V(pos.getX(i), pos.getY(i), pos.getZ(i));
  const Hd = bb.max.y, L0 = bb.min.z, L1 = bb.max.z, L = L1 - L0;
  // 3) landmarks
  const centroid = (f) => { const c = V(0, 0, 0); let k = 0; for (let i = 0; i < n; i++) { const p = P(i); if (f(p)) { c.add(p); k++; } } return k ? c.divideScalar(k) : null; };
  let snout = null; for (let i = 0; i < n; i++) { const p = P(i); if (p.y > 0.55 * Hd && (!snout || p.z > snout.z)) snout = p; }
  const headC = centroid(p => p.y > 0.7 * Hd && p.z > snout.z - 0.32 * L) || V(0, 0.85 * Hd, L1 - 0.15 * L);
  // body = vertices between 0.35..0.75 height and behind the head
  const bodyTop = (z0, z1) => { let m = -1e9; for (let i = 0; i < n; i++) { const p = P(i); if (p.z > z0 && p.z < z1 && Math.abs(p.x) < 0.1 * L) m = Math.max(m, p.y); } return m; };
  // legs: low vertices split by side and front/back around the belly centre
  const low = []; for (let i = 0; i < n; i++) { const p = P(i); if (p.y < 0.3 * Hd) low.push(p); }
  const midZ = low.reduce((a, p) => a + p.z, 0) / Math.max(1, low.length);
  const legs = {};
  for (const [key, sx, front] of [['FL', 1, true], ['FR', -1, true], ['BL', 1, false], ['BR', -1, false]]) {
    const inLeg = (p) => (p.x * sx > -0.01 * L) && (front ? p.z > midZ : p.z <= midZ);
    const paw = centroid(p => p.y < 0.08 * Hd && inLeg(p)) || V(sx * 0.06, 0.02, front ? midZ + 0.15 : midZ - 0.15);
    const mid = centroid(p => p.y > 0.22 * Hd && p.y < 0.3 * Hd && inLeg(p) && Math.hypot(p.x - paw.x, p.z - paw.z) < 0.25 * L) || paw.clone().setY(0.26 * Hd);
    const topY = 0.5 * Hd;
    const top = V(paw.x * 0.7 + sx * 0.02, topY, mid.z + (mid.z - paw.z) * 0.6);
    paw.y = Math.max(paw.y, 0.02 * Hd);
    legs[key] = { paw, mid, top, front, sx };
  }
  const hipZ = (legs.BL.top.z + legs.BR.top.z) / 2, shZ = (legs.FL.top.z + legs.FR.top.z) / 2;
  const backY = Math.max(0.5 * Hd, bodyTop(hipZ - 0.05 * L, hipZ + 0.05 * L) - 0.08 * Hd);
  const withersY = Math.max(0.5 * Hd, bodyTop(shZ - 0.05 * L, shZ + 0.05 * L) - 0.1 * Hd);
  const pelvis = V(0, backY, hipZ), chest = V(0, withersY, (hipZ + shZ) / 2 + 0.05 * L);
  const neckBase = V(0, withersY + 0.05 * Hd, shZ + 0.02 * L);
  const headBase = V(0, headC.y - 0.06 * Hd, headC.z - 0.1 * L);
  const jawPivot = V(0, headC.y - 0.08 * Hd, headC.z + 0.0 * L);
  const headHalf = (() => { let m = 0; for (let i = 0; i < n; i++) { const p = P(i); if (p.y > headC.y - 0.05 * Hd && Math.abs(p.z - headC.z) < 0.08 * L) m = Math.max(m, Math.abs(p.x)); } return m || 0.06; })();
  let tailTip = null; for (let i = 0; i < n; i++) { const p = P(i); if (p.y > 0.3 * Hd && (!tailTip || p.z < tailTip.z)) tailTip = p; }
  const tailBase = V(0, backY + 0.03 * Hd, hipZ - 0.12 * L);
  // 4) bind (scan) joints
  const bind = [];
  bind[0] = pelvis; bind[1] = chest; bind[2] = neckBase; bind[3] = headBase; bind[4] = jawPivot;
  bind[5] = V(headHalf * 0.8, headC.y, headC.z - 0.02 * L); bind[6] = V(-headHalf * 0.8, headC.y, headC.z - 0.02 * L);
  bind[7] = tailBase; bind[8] = tailBase.clone().lerp(tailTip, 0.5);
  const legBones = { FL: [9, 10], FR: [11, 12], BL: [13, 14], BR: [15, 16] };
  for (const k in legs) { const [u, l] = legBones[k]; bind[u] = legs[k].top; bind[l] = legs[k].mid; }
  // 5) logical (neutral standing) joints: legs straight down, paws under the hips/shoulders
  const O = bind.map(b => b.clone());
  const DOWN = V(0, -1, 0); const C = Array.from({ length: N }, () => new THREE.Quaternion());
  let lift = 0;
  for (const k in legs) { const g = legs[k]; const [u, l] = legBones[k]; const ul = g.top.distanceTo(g.mid), ll = g.mid.distanceTo(g.paw); O[l] = O[u].clone().addScaledVector(DOWN, ul);
    C[u].setFromUnitVectors(g.mid.clone().sub(g.top).normalize(), DOWN); C[l].setFromUnitVectors(g.paw.clone().sub(g.mid).normalize(), DOWN); lift = Math.max(lift, (ul + ll + 0.015 * Hd) - g.top.y); }
  for (let i = 0; i < N; i++) O[i].y += lift;
  for (const k in legs) { const [u, l] = legBones[k]; O[l] = O[u].clone().addScaledVector(DOWN, legs[k].top.distanceTo(legs[k].mid)); }
  // 6) skinning
  const segs = [
    [0, V(0, backY, L0 + 0.1 * L), V(0, backY, (hipZ + shZ) / 2), 0.16 * Hd], [1, V(0, withersY, (hipZ + shZ) / 2), V(0, withersY, shZ + 0.04 * L), 0.18 * Hd],
    [2, neckBase, headBase, 0.1 * Hd], [3, headBase, snout.clone().add(V(0, 0.02 * Hd, 0)), 0.11 * Hd], [7, tailBase, bind[8], 0.05 * Hd], [8, bind[8], tailTip, 0.045 * Hd],
  ];
  for (const k in legs) { const g = legs[k]; const [u, l] = legBones[k]; segs.push([u, g.top, g.mid, 0.07 * Hd]); segs.push([l, g.mid, g.paw, 0.05 * Hd]); }
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); const dn = new Float32Array(segs.length);
  for (let i = 0; i < n; i++) {
    const p = P(i);
    // ears: long flaps hanging beside the head
    const earSide = p.x > 0 ? 5 : 6;
    if (Math.abs(p.x) > headHalf * 0.55 && p.y < headC.y + 0.02 * Hd && p.y > headC.y - 0.35 * Hd && p.z > headC.z - 0.14 * L && p.z < headC.z + 0.06 * L && p.y > withersY - 0.05 * Hd) {
      const w = Math.min(1, (headC.y + 0.02 * Hd - p.y) / (0.08 * Hd)); si[i * 4] = earSide; sw[i * 4] = w; si[i * 4 + 1] = 3; sw[i * 4 + 1] = 1 - w; continue;
    }
    // lower jaw: under the muzzle, in front of the jaw pivot
    if (p.z > jawPivot.z && p.y < snout.y - 0.04 * Hd && p.y > snout.y - 0.2 * Hd && Math.abs(p.x) < headHalf * 0.8) { si[i * 4] = 4; sw[i * 4] = 1; continue; }
    for (let k = 0; k < segs.length; k++) {
      const [b, a, e, r] = segs[k]; let v = segDist(p, a, e) / r;
      const isLeg = b >= 9; const leg = isLeg ? Object.entries(legBones).find(([, ids]) => ids.includes(b))[0] : null;
      if (isLeg) { const g = legs[leg]; if (p.x * g.sx < -0.02 * L) v += 30; if (g.front ? p.z < midZ - 0.03 * L : p.z > midZ + 0.03 * L) v += 30; if (p.y > g.top.y + 0.05 * Hd) v += 30; }
      if ((b === 7 || b === 8) && p.z > tailBase.z + 0.02 * L) v += 30;
      if (b === 3 && p.y < withersY) v += 5;
      dn[k] = v;
    }
    const order = [...dn.keys()].sort((a, b) => dn[a] - dn[b]).slice(0, 3); const m = dn[order[0]]; let tot = 0; const w = order.map(k => { const x = Math.exp(-6 * (dn[k] - m)); tot += x; return x; });
    for (let j = 0; j < 3; j++) { si[i * 4 + j] = segs[order[j]][0]; sw[i * 4 + j] = w[j] / tot; }
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const root = new THREE.Group(); const bones = []; for (let i = 0; i < N; i++) { const b = new THREE.Bone(); root.add(b); b.position.copy(O[i]); bones.push(b); }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones, bind.map(b => new THREE.Matrix4().makeTranslation(-b.x, -b.y, -b.z)));
  const mat = model.mat.clone(); mat.roughness = 0.85;
  const mesh = new THREE.SkinnedMesh(geo, mat); mesh.frustumCulled = false; mesh.castShadow = true; root.add(mesh); mesh.bind(skeleton, new THREE.Matrix4());
  const offsets = O.map((o, i) => PARENTS[i] < 0 ? o.clone() : o.clone().sub(O[PARENTS[i]]));
  // mouth point (between the jaws, just behind the nose) in head-bone local space
  const mouthLocal = snout.clone().add(V(0, -0.07 * Hd, -0.05 * L)).sub(bind[3]);
  return { root, mesh, bones, O, offsets, C, PARENTS, mouthLocal, Hd, L, legs, legBones, dims: { shoulder: withersY + lift, length: L, head: headC.y + lift } };
}

// Forward kinematics: local rotations (Quaternion per bone) + root position/yaw -> bone transforms
const _q = new THREE.Quaternion(), _p = new THREE.Vector3();
export function poseDog(rig, rootPos, rootQ, local) {
  const W = rig._W || (rig._W = Array.from({ length: N }, () => ({ p: new THREE.Vector3(), q: new THREE.Quaternion() })));
  for (let i = 0; i < N; i++) {
    const par = PARENTS[i];
    if (par < 0) { W[i].p.copy(rig.offsets[i]).sub(rig.O[0]).applyQuaternion(rootQ).add(rootPos); W[i].q.copy(rootQ).multiply(local[i]); }
    else { W[i].p.copy(rig.offsets[i]).applyQuaternion(W[par].q).add(W[par].p); W[i].q.copy(W[par].q).multiply(local[i]); }
    rig.bones[i].position.copy(W[i].p); rig.bones[i].quaternion.copy(W[i].q).multiply(rig.C[i]);
  }
  return W;
}
