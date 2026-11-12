// Auto-rigger for the family's 3D scans (Tripo GLBs: unrigged, any of T-pose / arms-down / arms-up).
// 1. find joints from the mesh itself (shoulders, hands, hips, knees, ankles, neck, head)
// 2. skin every vertex to the same 11-part ragdoll skeleton the game already uses (distance-to-bone weights)
// 3. per-bone "correction" rotations map the scanned pose onto the game's arms-down rest pose, so all the
//    existing animation, physics, grabbing, throwing and getting-up work unchanged.
import * as THREE from 'three';
import { GLTFLoader } from '../../lib/addons/loaders/GLTFLoader.js';
import { BONES, PARENT, PART_COUNT, computeDims } from './body.js';

export const MODEL_FILES = { Paul: 'paul', Karen: 'karen', Charli: 'charli', Martin: 'martin', Julie: 'julie', Hollie: 'hollie', Sophie: 'sophie', James: 'james', Debbie: 'debbie', Gary: 'gary', Kirsty: 'kirsty', Jodie: 'jodie', Harry: 'harry', Bradley: 'bradley', Dan: 'dan', Tommy: 'tommy' };
export const models = {};
// Arm pose of each scan (degrees from straight out to the side: 0 = T-pose, -75 = arms down, +55 = arms up)
export const POSE_HINT = { Paul: 0, Martin: 0, Gary: 0, Harry: 0, James: 0, Julie: 0, Sophie: 0 };
// Measured from front-on renders of the raised-arm scans (x, y in head-height units; L = their left = +x)
export const ARM_MARKS = {
  Hollie: { L: [[0.114, 0.875], [0.177, 0.975], [0.212, 1.077]], R: [[-0.108, 0.875], [-0.167, 0.975], [-0.205, 1.077]] },
  Jodie: { L: [[0.098, 0.822], [0.150, 0.947], [0.202, 1.079]], R: [[-0.091, 0.822], [-0.144, 0.947], [-0.196, 1.079]] },
  Kirsty: { L: [[0.080, 0.834], [0.235, 0.795], [0.240, 0.936]], R: [[-0.080, 0.834], [-0.235, 0.795], [-0.240, 0.936]] },
  Bradley: { L: [[0.114, 0.836], [0.153, 0.670], [0.164, 0.511]], R: [[-0.114, 0.836], [-0.153, 0.670], [-0.164, 0.511]] },
  Debbie: { L: [[0.125, 0.835], [0.164, 0.687], [0.169, 0.550]], R: [[-0.125, 0.835], [-0.164, 0.687], [-0.169, 0.550]] },
  Tommy: { L: [[0.102, 0.842], [0.233, 0.885], [0.199, 1.036]], R: [[-0.102, 0.842], [-0.233, 0.885], [-0.199, 1.036]] },
  Dan: { L: [[0.112, 0.818], [0.151, 0.640], [0.162, 0.488]], R: [[-0.112, 0.818], [-0.151, 0.640], [-0.162, 0.488]] },
  Charli: { L: [[0.109, 0.830], [0.120, 0.654], [0.125, 0.511]], R: [[-0.109, 0.830], [-0.120, 0.654], [-0.125, 0.511]] },
  // Karen's scan holds her arms straight out in front (third value = forward offset from the shoulder)
  Karen: { L: [[0.109, 0.814, 0], [0.122, 0.825, 0.142], [0.140, 0.857, 0.262]], R: [[-0.109, 0.814, 0], [-0.122, 0.825, 0.142], [-0.140, 0.857, 0.262]] },
};

export async function loadModels(onProgress, base = '') {
  const loader = new GLTFLoader(); const names = [...Object.keys(MODEL_FILES), 'Chip']; let done = 0;
  await Promise.all(names.map(n => new Promise((res) => {
    const file = n === 'Chip' ? 'chip' : MODEL_FILES[n];
    loader.load(`${base}assets/models/${file}.glb`, (g) => { let mesh = null; g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; }); if (mesh) { mesh.updateWorldMatrix(true, false); const geo = mesh.geometry.clone(); geo.applyMatrix4(mesh.matrixWorld); models[n] = { geo, mat: mesh.material }; } onProgress && onProgress(++done / names.length, n); res(); }, undefined, () => { onProgress && onProgress(++done / names.length, n); res(); });
  })));
  return models;
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function segDist(p, a, b) { const ab = b.clone().sub(a); const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / Math.max(1e-9, ab.lengthSq()))); return p.distanceTo(a.clone().addScaledVector(ab, t)); }

// ---------------- humans ----------------
export function buildFromModel(spec, model) {
  const geo = model.geo.clone();
  geo.computeBoundingBox(); const bb = geo.boundingBox;
  // scale by the top of the head (not raised hands)
  const pa = geo.attributes.position; const bh = bb.max.y - bb.min.y; const mx = (bb.min.x + bb.max.x) / 2; let headTop = -1e9;
  for (let i = 0; i < pa.count; i++) if (Math.abs(pa.getX(i) - mx) < 0.07 * bh) headTop = Math.max(headTop, pa.getY(i));
  const scale = spec.height / (headTop - bb.min.y);
  geo.translate(0, -bb.min.y, 0); geo.scale(scale, scale, scale);
  const pos = geo.attributes.position; const n = pos.count; const H = spec.height;
  const P = (i) => V(pos.getX(i), pos.getY(i), pos.getZ(i));
  // centre the body on x/z using the torso band
  let cx = 0, cz = 0, cn = 0; for (let i = 0; i < n; i++) { const y = pos.getY(i), x = pos.getX(i); if (y > 0.5 * H && y < 0.72 * H && Math.abs(x) < 0.16 * H) { cx += x; cz += pos.getZ(i); cn++; } }
  cx /= cn; cz /= cn; geo.translate(-cx, 0, -cz);
  const female = spec.sex === 'f';
  // ---- landmarks ----
  const sx = H * (female ? 0.094 : 0.104) * (spec.build === 'bigger' ? 1.1 : 1);
  const shoulderY = 0.812 * H;
  const S = { L: V(sx, shoulderY, 0), R: V(-sx, shoulderY, 0) };
  // shoulder depth = centre of the body's cross-section at the shoulder (bellies push the torso centroid forward)
  for (const side of ['L', 'R']) { const sg = side === 'L' ? 1 : -1; let zs = 0, k = 0; for (let i = 0; i < n; i++) { const p = P(i); if (Math.abs(p.x - sg * sx) < 0.035 * H && Math.abs(p.y - shoulderY) < 0.05 * H) { zs += p.z; k++; } } if (k) S[side].z = zs / k; }
  const arm = {};
  const zAt = (x, y, r = 0.04 * H, zmax = 1e9) => { let z = 0, k = 0; for (let i = 0; i < n; i++) { if (Math.abs(pos.getX(i) - x) < r && Math.abs(pos.getY(i) - y) < r && Math.abs(pos.getZ(i)) < zmax) { z += pos.getZ(i); k++; } } return k ? z / k : 0; };
  for (const side of ['L', 'R']) {
    const sg = side === 'L' ? 1 : -1; const s = S[side]; const marks = ARM_MARKS[spec.name]?.[side];
    if (marks) {
      const [ms, me, mw] = marks.map(([x, y]) => V(x * H, y * H, 0)); const fwd = marks[1][2] !== undefined; ms.z = zAt(ms.x, ms.y, 0.04 * H, fwd ? 0.07 * H : 1e9);
      [me, mw].forEach((m, k) => { const dz = marks[k + 1][2]; m.z = dz !== undefined ? ms.z + dz * H : zAt(m.x, m.y); });
      s.copy(ms); const udir = me.clone().sub(ms).normalize(), fdir = mw.clone().sub(me).normalize();
      const upperLen = ms.distanceTo(me), wl = me.distanceTo(mw), foreLen = wl + 0.1 * H;
      arm[side] = { dir: udir, fdir, upperLen, foreLen, len: upperLen + foreLen, elbow: me, wrist: mw, tip: me.clone().addScaledVector(fdir, foreLen) };
      continue;
    }
    // straight arms: search around the hinted angle for the direction with the longest straight limb
    const hint = (POSE_HINT[spec.name] ?? 0) * Math.PI / 180;
    let best = null;
    for (let a = hint - 0.45; a <= hint + 0.45; a += 0.05) for (let tz = -0.3; tz <= 0.3; tz += 0.15) {
      const dir = V(sg * Math.cos(a), Math.sin(a), tz).normalize(); let far = 0, cnt = 0;
      for (let i = 0; i < n; i += 2) { const p = P(i); if (p.x * sg < sx * 0.5) continue; const v = p.sub(s); const t = v.dot(dir); if (t < 0.12 * H) continue; const perp = v.addScaledVector(dir, -t).length(); if (perp < 0.05 * H && t < 0.47 * H) { cnt++; if (t > far) far = t; } }
      const score = far + cnt * 1e-6; if (!best || score > best.score) best = { score, dir, far };
    }
    let dir = best.dir;
    for (let it = 0; it < 2; it++) { const off = V(0, 0, 0); let m = 0; for (let i = 0; i < n; i++) { const v = P(i).sub(s); const t = v.dot(dir); if (t < 0.06 * H || t > best.far * 0.75) continue; const pv = v.addScaledVector(dir, -t); if (pv.length() < 0.1 * H) { off.add(pv); m++; } } if (m) { off.divideScalar(m); s.add(off.multiplyScalar(0.8)); }
      const tc = V(0, 0, 0); let q = 0; for (let i = 0; i < n; i++) { const p = P(i); const v = p.clone().sub(s); const t = v.dot(dir); const perp = v.addScaledVector(dir, -t).length(); if (perp < 0.07 * H && t > best.far - 0.06 * H && t < 0.47 * H) { tc.add(p); q++; } } if (q) dir = tc.divideScalar(q).sub(s).normalize(); }
    s.y = Math.min(s.y, shoulderY + 0.03 * H); s.x = sg * Math.max(sx * 0.85, Math.min(sx * 1.25, Math.abs(s.x)));
    const tip = Math.min(0.46 * H, Math.max(best.far, 0.36 * H)); const upperLen = tip * 0.43;
    arm[side] = { dir, fdir: dir, len: tip, upperLen, foreLen: tip - upperLen, elbow: s.clone().addScaledVector(dir, upperLen), wrist: s.clone().addScaledVector(dir, tip * 0.8), tip: s.clone().addScaledVector(dir, tip) };
  }
  const leg = {};
  for (const side of ['L', 'R']) {
    const sg = side === 'L' ? 1 : -1;
    const band = (y0, y1) => { const a = V(0, 0, 0); let k = 0; for (let i = 0; i < n; i++) { const p = P(i); if (p.y > y0 * H && p.y < y1 * H && p.x * sg > 0.005 * H && p.x * sg < 0.2 * H) { a.add(p); k++; } } return k ? a.divideScalar(k) : V(sg * 0.05 * H, (y0 + y1) / 2 * H, 0); };
    const knee = band(0.25, 0.31); const ankle = band(0.04, 0.09); ankle.y = 0.045 * H; knee.y = 0.28 * H; ankle.z = Math.min(ankle.z, knee.z + 0.02 * H);
    const hip = V(Math.max(0.04 * H, Math.min(0.075 * H, Math.abs(knee.x) * 0.95)) * sg, 0.515 * H, 0);
    leg[side] = { hip, knee, ankle, dir: ankle.clone().sub(hip).normalize(), thigh: hip.distanceTo(knee), shin: knee.distanceTo(ankle) };
  }
  // head
  const hc = V(0, 0, 0); let hk = 0; const hmin = V(1, 1, 1).multiplyScalar(1e9), hmax = V(-1, -1, -1).multiplyScalar(1e9);
  for (let i = 0; i < n; i++) { const p = P(i); if (p.y > 0.87 * H && Math.abs(p.x) < 0.12 * H && Math.abs(p.z) < 0.18 * H) { hc.add(p); hk++; hmin.min(p); hmax.max(p); } }
  hc.divideScalar(Math.max(1, hk));
  const neck = V(hc.x * 0.5, 0.835 * H, hc.z * 0.6);
  const top = hmax.y;
  // ---- bind (scan) joints and logical (game) joints ----
  const bind = [];
  bind[0] = V(0, 0.53 * H, 0); bind[1] = V(0, 0.6 * H, 0); bind[2] = neck.clone();
  bind[3] = S.L.clone(); bind[4] = arm.L.elbow.clone(); bind[5] = S.R.clone(); bind[6] = arm.R.elbow.clone();
  bind[7] = leg.L.hip.clone(); bind[8] = leg.L.knee.clone(); bind[9] = leg.R.hip.clone(); bind[10] = leg.R.knee.clone();
  // straightened legs decide how high the pelvis sits so feet reach the floor
  const legLen = Math.max(leg.L.thigh + leg.L.shin, leg.R.thigh + leg.R.shin);
  const lift = (0.045 * H + legLen) - 0.515 * H;
  const DOWN = V(0, -1, 0);
  const O = [];
  for (const i of [0, 1, 2, 3, 5, 7, 9]) O[i] = bind[i].clone().add(V(0, lift, 0));
  O[4] = O[3].clone().addScaledVector(DOWN, arm.L.elbow.distanceTo(S.L)); O[6] = O[5].clone().addScaledVector(DOWN, arm.R.elbow.distanceTo(S.R));
  O[8] = O[7].clone().addScaledVector(DOWN, leg.L.thigh); O[10] = O[9].clone().addScaledVector(DOWN, leg.R.thigh);
  // dims shared with the procedural characters (physics sizes, hand position, head collider…)
  const d = computeDims(spec);
  const headR = Math.max(0.06 * H, (hmax.x - hmin.x) / 2);
  d.head = { rx: headR, ry: (top - neck.y) * 0.5, rz: Math.max(headR, (hmax.z - hmin.z) / 2), cy: (top + neck.y) / 2 + lift, cz: hc.z };
  d.wristY = O[4].y - arm.L.elbow.distanceTo(arm.L.wrist);
  d.p = { ...d.p, ankle: (O[8].y - leg.L.shin) / H };
  d.armX = Math.abs(O[3].x); d.hipX = Math.abs(O[7].x);
  for (let i = PART_COUNT; i < BONES.length; i++) { O[i] = V(0, d.head.cy, d.head.cz); bind[i] = O[i].clone(); }
  // per-bone corrections (scan direction -> straight down)
  const C = Array.from({ length: BONES.length }, () => new THREE.Quaternion());
  C[3] = new THREE.Quaternion().setFromUnitVectors(arm.L.dir, DOWN); C[4] = new THREE.Quaternion().setFromUnitVectors(arm.L.fdir, DOWN);
  C[5] = new THREE.Quaternion().setFromUnitVectors(arm.R.dir, DOWN); C[6] = new THREE.Quaternion().setFromUnitVectors(arm.R.fdir, DOWN);
  C[7] = new THREE.Quaternion().setFromUnitVectors(leg.L.dir, DOWN); C[8] = C[7].clone();
  C[9] = new THREE.Quaternion().setFromUnitVectors(leg.R.dir, DOWN); C[10] = C[9].clone();
  // ---- skin weights ----
  const segs = [
    [0, V(0, 0.45 * H, 0), V(0, 0.6 * H, 0), 0.12 * H], [1, V(0, 0.6 * H, 0), V(neck.x, neck.y, neck.z * 0.5), 0.13 * H], [2, neck, V(hc.x, top, hc.z), 0.1 * H],
    [3, S.L, arm.L.elbow, 0.045 * H], [4, arm.L.elbow, arm.L.tip, 0.042 * H], [5, S.R, arm.R.elbow, 0.045 * H], [6, arm.R.elbow, arm.R.tip, 0.042 * H],
    [7, leg.L.hip, leg.L.knee, 0.07 * H], [8, leg.L.knee, leg.L.ankle.clone().add(V(0, -0.05 * H, 0.04 * H)), 0.055 * H], [9, leg.R.hip, leg.R.knee, 0.07 * H], [10, leg.R.knee, leg.R.ankle.clone().add(V(0, -0.05 * H, 0.04 * H)), 0.055 * H],
  ];
  const headHalfE = Math.max(0.06 * H, (hmax.x - hmin.x) / 2);
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const dn = new Float32Array(segs.length);
  const marked = !!ARM_MARKS[spec.name];
  const closestOn = (p, a, b) => { const ab = b.clone().sub(a); const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq())); return a.clone().addScaledVector(ab, t); };
  const tightTube = marked || (POSE_HINT[spec.name] ?? 0) < -30; // arms beside the body or by the head: thin tube
  const tubeR = (t) => tightTube ? 0.075 : 0.07 + 0.025 * Math.min(1, t / (0.1 * H));
  // each arm's real thickness, measured on its outer side (where nothing else touches it)
  const armRad = {};
  for (const side of ['L', 'R']) { const a = arm[side]; const sg = side === 'L' ? 1 : -1; let sum = 0, k = 0;
    for (let i = 0; i < n; i++) { const p = P(i); const c = closestOn(p, S[side], a.elbow); const d = p.distanceTo(c); const along = c.distanceTo(S[side]) / a.upperLen; if (along < 0.25 || along > 0.95 || d > 0.09 * H) continue; const out = (p.x - c.x) * sg; if (out > 0.3 * d) { sum += d; k++; } }
    armRad[side] = k ? Math.min(0.06 * H, Math.max(0.025 * H, sum / k)) : 0.035 * H; }
  const handEndAt = (c, side) => { const a = arm[side]; return c.distanceTo(a.elbow) > a.elbow.distanceTo(a.wrist) * 0.75 && c.distanceTo(S[side]) > a.upperLen * 1.05; };
  const tube = (p, side) => { const a = arm[side]; const sg = side === 'L' ? 1 : -1; const v = p.clone().sub(S[side]); const t = v.dot(a.dir);
    const c1 = closestOn(p, S[side], a.elbow), c2 = closestOn(p, a.elbow, a.tip.clone().addScaledVector(a.fdir, 0.03 * H)); const d1 = p.distanceTo(c1), d2 = p.distanceTo(c2); const c = d1 < d2 ? c1 : c2; const perp = Math.min(d1, d2);
    // tight mode: nothing on the body side of the arm's inner surface (thighs, dress, hair beside the arm)
    const innerOK = !tightTube || (p.x - c.x) * sg > (handEndAt(c, side) ? -0.034 * H : -Math.max(armRad[side] * 1.3, armRad[side] + 0.012 * H)) || (d2 < d1 && p.y > S[side].y + 0.02 * H && Math.abs(p.x) > headHalf * 1.1);
    const handEnd = d2 < d1 && c.distanceTo(a.elbow) > a.elbow.distanceTo(a.wrist) * 0.75; const rad = handEnd ? Math.max(tubeR(t), 0.075) : tubeR(t);
    return { t, perp, inside: t > 0.015 * H && perp < rad * H && innerOK }; };
  const headHalf = Math.max(0.06 * H, (hmax.x - hmin.x) / 2); const upZone = (p) => !tightTube && p.y > shoulderY + 0.02 * H && Math.abs(p.x) > Math.max(headHalf * 1.2, sx * 0.85);
  for (let i = 0; i < n; i++) {
    const p = P(i);
    const tl = tube(p, 'L'), tr = tube(p, 'R'); const inArm = p.x >= 0 ? (tl.inside || upZone(p) ? 'L' : null) : (tr.inside || upZone(p) ? 'R' : null);
    const tt = p.x >= 0 ? tl : tr;
    for (let k = 0; k < segs.length; k++) {
      const [b, a, e, r] = segs[k]; let v = segDist(p, a, e) / r;
      const side = (b >= 3 && b <= 4) || b === 7 || b === 8 ? 1 : (b >= 5 && b <= 6) || b === 9 || b === 10 ? -1 : 0;
      if (side && p.x * side < -0.01 * H) v += 50;                       // never weight to the other side
      if ((b >= 7) && p.y > 0.6 * H) v += 50;                             // legs stay below the waist
      if (b === 2 && p.y < neck.y - 0.03 * H) v += 50;                    // head stays above the neck
      if (b === 2 && Math.abs(p.x) > Math.max(0.13 * H, headHalfE * 2.2)) v += 20;      // far beside the head is never head
      if (b <= 1 && !inArm && p.y > neck.y + 0.015 * H && Math.abs(p.x - hc.x) < headHalfE * 1.25) v += 50; // the whole face (nose, mouth, chin) moves with the head, never the chest
      if ((b === 3 || b === 5) && Math.abs(p.x) < sx * 0.55 && p.y < shoulderY) v += 3; // chest isn't arm
      if (b <= 1 && (Math.abs(p.x) > sx * 1.6 && p.y > 0.55 * H)) v += 1.5; // far-out arm isn't torso
      if (inArm && b <= 2) v += upZone(p) ? 4 : Math.min(4, tt.t / (0.025 * H));
      if (inArm && b >= 7) v += 6;                                         // hands resting on thighs belong to the arm          // inside the arm tube, past the shoulder: arm only
      if (!inArm && (b >= 3 && b <= 6) && tt.t > 0.05 * H) v += 4;       // outside the tube (head, hair, hips): never arm
      dn[k] = v;
    }
    // best 3, soft blend
    // hand rescue: anything close to a wrist (and away from the head/hips) is hand
    for (const side of ['L', 'R']) { const a = arm[side]; if (a.fdir.y > -0.5 && segDist(p, a.wrist, a.tip.clone().addScaledVector(a.fdir, 0.05 * H)) < 0.13 * H && Math.abs(p.x) > headHalf * 1.15 && (p.x >= 0) === (side === 'L')) { const k = segs.findIndex(sg => sg[0] === (side === 'L' ? 4 : 6)); dn[k] = -10; } }
    const order = [...dn.keys()].sort((a, b) => dn[a] - dn[b]).slice(0, 3);
    // rigid parts: every vertex follows ONE bone (faces, hands, torso never stretch); only a very thin seam at
    // limb joints (shoulder, elbow, hip, knee) blends between a bone and its direct parent so joints don't crack
    const b0 = segs[order[0]][0], b1 = segs[order[1]][0], gap = dn[order[1]] - dn[order[0]];
    const adjacent = PARENT[b0] === b1 || PARENT[b1] === b0;
    const limbSeam = adjacent && b0 !== 2 && b1 !== 2 && (b0 >= 3 || b1 >= 3) && gap < 0.12;
    si[i * 4] = b0; sw[i * 4] = 1;
    if (limbSeam) { const w1 = 0.5 * (1 - gap / 0.12); si[i * 4 + 1] = b1; sw[i * 4] = 1 - w1; sw[i * 4 + 1] = w1; }
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  // hands resting on thighs in the scans: patches of fingers end up on the leg (and bits of trouser on the hand), which
  // stretch into long strips once the arms swing. Tidy by neighbourhood vote, then cut the hand free of the leg/hips.
  if (geo.index) { const I = geo.index.array; const nb = Array.from({ length: n }, () => new Set());
    for (let t = 0; t < I.length; t += 3) { const a = I[t], b2 = I[t + 1], c = I[t + 2]; nb[a].add(b2).add(c); nb[b2].add(a).add(c); nb[c].add(a).add(b2); }
    const LEG = (b) => b === 0 || b >= 7, HAND = (b) => b === 4 || b === 6;
    for (let it = 0; it < 4; it++) for (let i = 0; i < n; i++) { const b = si[i * 4]; if (!LEG(b) && !HAND(b)) continue; let arm = 0, armB = 0, leg = 0, legB = 0, tot = 0;
      for (const j of nb[i]) { const bj = si[j * 4]; tot++; if (HAND(bj)) { arm++; armB = bj; } else if (LEG(bj)) { leg++; legB = bj; } }
      if (LEG(b) && arm > tot * 0.5) { si[i * 4] = armB; sw[i * 4] = 1; si[i * 4 + 1] = 0; sw[i * 4 + 1] = 0; } } // (hand vertices are never handed to the leg: that left fingertips behind on the thigh)
    // collar/shoulder bits that ended up on the head (below the chin, surrounded by body): back to the chest
    for (let it = 0; it < 3; it++) for (let i = 0; i < n; i++) { if (si[i * 4] !== 2 || pos.getY(i) > neck.y + 0.01 * H) continue; let body = 0, tot = 0; for (const j of nb[i]) { tot++; const bj = si[j * 4]; if (bj === 1 || bj === 3 || bj === 5) body++; } if (body > tot * 0.5) { si[i * 4] = 1; sw[i * 4] = 1; si[i * 4 + 1] = 0; sw[i * 4 + 1] = 0; } }
    // cut joins that can only ever stretch: hand/forearm to leg or hips, forearm to the body, head to the arms
    const ARM = (b) => b >= 3 && b <= 6;
    const keep = []; for (let t = 0; t < I.length; t += 3) { const bs = [si[I[t] * 4], si[I[t + 1] * 4], si[I[t + 2] * 4]];
      const has = (f) => bs.some(f); if (has(HAND) && has(LEG)) continue; if (has(HAND) && has(b => b === 1)) continue; if (has(b => b === 2) && has(ARM)) continue;
      // inner upper arm glued to the side of the body (arms-down scans): cut below the shoulder so raising the arms
      // doesn't pull the skin into long spikes (the shoulder cap itself stays joined)
      if (has(b => b === 1) && has(b => b === 3 || b === 5) && Math.max(pos.getY(I[t]), pos.getY(I[t + 1]), pos.getY(I[t + 2])) < shoulderY - 0.015 * H) continue;
      keep.push(I[t], I[t + 1], I[t + 2]); }
    geo.setIndex(keep); }
  const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  // the neck: a soft blend between the chest and the head over a short band, so turning the head twists the neck
  // instead of shearing it (the face above stays rigid with the head)
  { const y0 = neck.y - 0.04 * H, y1 = neck.y + 0.022 * H;
    for (let i = 0; i < n; i++) { const b = si[i * 4]; if (b !== 1 && b !== 2) continue; const p = P(i); if (p.y < y0 || p.y > y1) continue;
      const chin = Math.abs(p.x - hc.x) < 0.05 * H && p.z > hc.z && p.y > neck.y - 0.012 * H; if (chin) continue; // the chin and jaw stay with the head
      if (b === 1 && Math.abs(p.x - neck.x) > headHalfE * 1.3) continue; // (collar points that were on the head get blended down too)
      const w = smooth((p.y - y0) / (y1 - y0)); si[i * 4] = 2; sw[i * 4] = w; si[i * 4 + 1] = 1; sw[i * 4 + 1] = 1 - w; } }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); // (the attributes are copies: write the tidied weights back)
  // legs are separate: drop the triangles that join the left leg to the right leg (dresses and skirts in the scans
  // bridge the legs, which stretched into a jelly web whenever the legs moved apart)
  if (geo.index) { const I = geo.index.array, keep = []; const L = (b) => b === 7 || b === 8, R = (b) => b === 9 || b === 10;
    for (let t = 0; t < I.length; t += 3) { const a = si[I[t] * 4], b2 = si[I[t + 1] * 4], c = si[I[t + 2] * 4]; if ((L(a) || L(b2) || L(c)) && (R(a) || R(b2) || R(c))) continue; keep.push(I[t], I[t + 1], I[t + 2]); }
    geo.setIndex(keep); }
  // ---- skeleton (flat part bones like the procedural rig; extra face bones kept for compatibility) ----
  const root = new THREE.Group(); root.name = spec.name;
  const bones = BONES.map((nm) => { const b = new THREE.Bone(); b.name = nm; return b; });
  for (let i = 0; i < bones.length; i++) { const p = PARENT[i]; if (i < PART_COUNT) { root.add(bones[i]); bones[i].position.copy(O[i]); } else { bones[p].add(bones[i]); bones[i].position.copy(O[i]).sub(O[p]); } }
  root.updateMatrixWorld(true);
  const inverses = bones.map((b, i) => new THREE.Matrix4().makeTranslation(-bind[i].x, -bind[i].y, -bind[i].z));
  // face bones: their inverse must cancel their runtime world matrix at rest (they carry no weights anyway)
  for (let i = PART_COUNT; i < bones.length; i++) inverses[i] = bones[i].matrixWorld.clone().invert();
  const skeleton = new THREE.Skeleton(bones, inverses);
  const mat = model.mat.clone(); mat.roughness = 0.78; mat.metalness = 0;
  const mesh = new THREE.SkinnedMesh(geo, mat); mesh.frustumCulled = false; mesh.castShadow = true;
  root.add(mesh); mesh.bind(skeleton, new THREE.Matrix4());
  return { root, mesh, bones, skeleton, dims: d, origins: O, mats: [mat], tris: geo.index.count / 3, corrections: C, scanned: true };
}
