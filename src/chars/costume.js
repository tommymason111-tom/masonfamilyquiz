// Gary's outfit of the year, painted onto his real 3D scan. Everything below the neck is repainted in the
// costume's colours (the scan's own light and folds are kept, so it still looks like cloth on a body); his
// head is never touched, so it's always unmistakably Gary. A few shaped pieces (hats, wings, wand, tutu)
// are added on top.
import * as THREE from 'three';
import { Prop } from '../engine/geo.js';

const SKIN = 'skin';
// zone(c) -> index into colours (0 = leave the scan as it is). c: { x, y, z, b, hand, foot, H, neckY, shY, hipY, kneeY }
export const COSTUMES = {
  mankini: {
    extras: ['mankini'],
    colours: [SKIN, '#2b8a2b'],
    zone(c) {
      const torso = c.b <= 1;
      if (torso && c.y > c.hipY - 0.03 * c.H && c.y < c.shY + 0.02 * c.H) {
        const t = (c.y - c.hipY) / (c.shY - c.hipY); const xs = (0.02 + 0.075 * Math.max(0, t)) * c.H;
        if (Math.abs(Math.abs(c.x) - xs) < 0.02 * c.H) return 2;          // the two straps, over the shoulders
      }
      if ((c.b === 0 || c.b === 7 || c.b === 9) && c.y > c.hipY - 0.07 * c.H && c.y < c.hipY + 0.015 * c.H && Math.abs(c.x) < 0.05 * c.H) return 2; // the pouch
      return 1;
    },
  },
  fairy: {
    colours: [SKIN, '#ec6fb4', '#ffc6e6', '#ffffff', '#b0186a'],
    zone(c) {
      if (c.foot) return 5;
      if (c.b >= 3 && c.b <= 6) return 1;                                   // sleeveless: bare arms
      if (c.b <= 1 && c.y > c.shY - 0.025 * c.H && Math.abs(c.x) < 0.1 * c.H) return 1; // neckline
      if (c.b <= 1 && c.y > c.hipY + 0.03 * c.H) return 2;                  // bodice
      if (c.y > c.hipY - 0.12 * c.H) return 3;                              // tutu
      return 4;                                                             // white tights
    },
    extras: ['fairy'],
  },
  minion: {
    colours: ['#f5cf14', '#2f5d9e', '#151515'],
    zone(c) {
      if (c.hand || c.foot) return 3;                                       // black gloves and boots
      if (c.b >= 3) return c.b <= 6 ? 1 : 2;                                // yellow arms, denim legs
      if (c.y < c.shY - 0.09 * c.H) return 2;                               // dungarees, all the way round up to the chest
      if (Math.abs(Math.abs(c.x - c.cx) - 0.06 * c.H) < 0.017 * c.H) return 2; // straps over the shoulders (centred on his body, not the scan's origin)
      return 1;
    },
    extras: ['minion'],
  },
  santa: {
    colours: ['#c41e1e', '#f6f6f6', '#151515', SKIN],
    zone(c) {
      if (c.hand) return 4;
      if (c.foot || c.y < 0.1 * c.H) return 3;                              // boots
      if (c.b >= 3 && c.b <= 6) return c.cuff ? 2 : 1;
      if (c.b <= 1 || c.b === 0) {
        if (c.y > c.hipY + 0.05 * c.H && c.y < c.hipY + 0.085 * c.H) return 3; // belt
        if (c.y > c.hipY - 0.03 * c.H && c.y < c.hipY + 0.015 * c.H) return 2; // jacket hem
        if (c.z > 0 && Math.abs(c.x) < 0.018 * c.H && c.y > c.hipY) return 2; // front trim
      }
      return 1;
    },
    extras: ['santa'],
  },
  elf: {
    colours: ['#1f8a3a', '#c41e1e', '#f6f6f6', SKIN, '#6b3a1f'],
    zone(c) {
      if (c.hand) return 4;
      if (c.foot) return 1;
      if (c.b >= 7) return Math.floor(c.y / (0.045 * c.H)) % 2 ? 2 : 3;   // stripy tights
      if (c.y > c.hipY + 0.04 * c.H && c.y < c.hipY + 0.075 * c.H) return 5; // belt
      return 1;
    },
    extras: ['elf'],
  },
};

export function paintCostume(p, outfit) {
  const def = COSTUMES[outfit.id]; const mesh = p.mesh; if (!def || !mesh) return;
  const g = mesh.geometry, P = g.attributes.position, UV = g.attributes.uv, SI = g.attributes.skinIndex, I = g.index;
  const map = mesh.material.map, img = map?.image; if (!img || !UV || !I) return;
  const W = img.width, Hh = img.height, H = p.H, O = p.O;
  const ctx = { H, neckY: O[2].y, shY: O[3].y, hipY: O[7].y, kneeY: O[8].y, cx: O[1].x };
  // arm reach per side (for hands and cuffs) measured from the shoulder
  const reach = { 4: 0, 6: 0 }; const sh = { 4: O[3], 6: O[5] }; const v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) { const b = SI.getX(i); if (b === 4 || b === 6) { v.fromBufferAttribute(P, i); reach[b] = Math.max(reach[b], v.distanceTo(sh[b])); } }
  // the original texture
  const base = document.createElement('canvas'); base.width = W; base.height = Hh; const bg = base.getContext('2d'); bg.drawImage(img, 0, 0, W, Hh);
  const orig = bg.getImageData(0, 0, W, Hh);
  // skin tone sampled from his own face, so bare arms/legs match
  let sr = 0, sgc = 0, sb = 0, sn = 0;
  const hc = new THREE.Vector3(0, O[2].y + 0.12 * H / 1.8, 0);
  for (let i = 0; i < P.count; i += 3) { if (SI.getX(i) !== 2) continue; v.fromBufferAttribute(P, i); if (v.z < 0.03 || v.y < hc.y - 0.02 || v.y > hc.y + 0.06 || Math.abs(v.x) > 0.04) continue;
    const px = Math.min(W - 1, Math.max(0, Math.round(UV.getX(i) * W))), py = Math.min(Hh - 1, Math.max(0, Math.round(UV.getY(i) * Hh))); const k = (py * W + px) * 4; sr += orig.data[k]; sgc += orig.data[k + 1]; sb += orig.data[k + 2]; sn++; }
  const skin = sn ? [Math.min(255, sr / sn * 1.08), Math.min(255, sgc / sn * 1.08), Math.min(255, sb / sn * 1.08)] : [226, 184, 160];
  const cols = def.colours.map(c => c === SKIN ? skin : (() => { const t = new THREE.Color(c); return [t.r * 255, t.g * 255, t.b * 255]; })());
  // rasterise the body (not the head) into UV space, storing the 3D rest position + bone under every texel,
  // then decide the costume zone per texel — smooth edges whatever the triangle sizes
  const N = W * Hh, PX3 = new Float32Array(N * 3), BN = new Int8Array(N).fill(-1);
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3();
  for (let t = 0; t < I.count; t += 3) {
    const i0 = I.getX(t), i1 = I.getX(t + 1), i2 = I.getX(t + 2);
    const b0 = SI.getX(i0), b1 = SI.getX(i1), b2 = SI.getX(i2); if (b0 === 2 || b1 === 2 || b2 === 2) continue; // his head stays exactly as scanned
    pa.fromBufferAttribute(P, i0); pb.fromBufferAttribute(P, i1); pc.fromBufferAttribute(P, i2);
    const ax = UV.getX(i0) * W - 0.5, ay = UV.getY(i0) * Hh - 0.5, bx = UV.getX(i1) * W - 0.5, by = UV.getY(i1) * Hh - 0.5, cx = UV.getX(i2) * W - 0.5, cy = UV.getY(i2) * Hh - 0.5;
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)) - 1), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)) + 1), y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)) - 1), y1 = Math.min(Hh - 1, Math.ceil(Math.max(ay, by, cy)) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const w0 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / den, w1 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / den, w2 = 1 - w0 - w1;
      if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
      const k = y * W + x; PX3[k * 3] = pa.x * w0 + pb.x * w1 + pc.x * w2; PX3[k * 3 + 1] = pa.y * w0 + pb.y * w1 + pc.y * w2; PX3[k * 3 + 2] = pa.z * w0 + pb.z * w1 + pc.z * w2;
      BN[k] = w0 >= w1 && w0 >= w2 ? b0 : w1 >= w2 ? b1 : b2;
    }
  }
  // grow the covered area a few texels so the seams between UV islands are painted too
  for (let it = 0; it < 4; it++) { const src = BN.slice(); for (let y = 1; y < Hh - 1; y++) for (let x = 1; x < W - 1; x++) { const k = y * W + x; if (src[k] >= 0) continue;
    for (const o of [1, -1, W, -W]) { const q = k + o; if (src[q] >= 0) { BN[k] = src[q]; PX3[k * 3] = PX3[q * 3]; PX3[k * 3 + 1] = PX3[q * 3 + 1]; PX3[k * 3 + 2] = PX3[q * 3 + 2]; break; } } } }
  const c = { ...ctx }; const od = orig.data; const m = new THREE.Vector3(); const Z = new Uint8Array(N);
  let lsum = 0, ln = 0;
  for (let k = 0; k < N; k++) { const bone = BN[k]; if (bone < 0) continue;
    m.set(PX3[k * 3], PX3[k * 3 + 1], PX3[k * 3 + 2]); c.x = m.x; c.y = m.y; c.z = m.z; c.b = bone;
    const arm = bone === 4 || bone === 6; const r = arm ? m.distanceTo(sh[bone]) : 0;
    c.hand = arm && r > reach[bone] - 0.105 * H; c.cuff = arm && !c.hand && r > reach[bone] - 0.15 * H;
    c.foot = (bone === 8 || bone === 10) && m.y < 0.065 * H;
    const z = def.zone(c); if (!z || !cols[z - 1]) continue; Z[k] = z;
    lsum += od[k * 4] * 0.3 + od[k * 4 + 1] * 0.59 + od[k * 4 + 2] * 0.11; ln++; }
  const mean = ln ? lsum / ln : 128;
  for (let k = 0; k < N; k++) { const z = Z[k]; if (!z) continue; const o = k * 4;
    const L = od[o] * 0.3 + od[o + 1] * 0.59 + od[o + 2] * 0.11; const col = cols[z - 1];
    // bare skin keeps an even tone; cloth keeps the scan's folds and shading
    const f = col === skin ? Math.min(1.08, Math.max(0.85, 0.9 + 0.12 * (L / mean - 1))) : Math.min(1.25, Math.max(0.55, 0.62 + 0.38 * L / mean));
    od[o] = Math.min(255, col[0] * f); od[o + 1] = Math.min(255, col[1] * f); od[o + 2] = Math.min(255, col[2] * f); }
  bg.putImageData(orig, 0, 0);
  const tex = new THREE.CanvasTexture(base); tex.flipY = map.flipY; tex.colorSpace = map.colorSpace; tex.wrapS = map.wrapS; tex.wrapT = map.wrapT; tex.anisotropy = map.anisotropy;
  mesh.material = mesh.material.clone(); mesh.material.map = tex; mesh.material.needsUpdate = true;
  if (p.mats) p.mats[0] = mesh.material;
  addExtras(p, def.extras || []);
}

// ---- the 3D costume pieces, sized from Gary's own scan (they don't have to follow his body: a costume is a costume) ----
function measure(p) {
  const g = p.mesh.geometry, P = g.attributes.position, SI = g.attributes.skinIndex, H = p.H, O = p.O; const v = new THREE.Vector3();
  const band = (y, bones, dy = 0.02 * H) => { let hx = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, n = 0; for (let i = 0; i < P.count; i++) { if (!bones.includes(SI.getX(i))) continue; const yy = P.getY(i); if (Math.abs(yy - y) > dy) continue; const x = P.getX(i), z = P.getZ(i); hx = Math.max(hx, Math.abs(x)); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); n++; } return n ? { hx, cx: (x0 + x1) / 2, z0, z1, cz: (z0 + z1) / 2, rz: (z1 - z0) / 2 } : { hx: 0.17 * H / 1.8, cx: 0, z0: -0.12, z1: 0.12, cz: 0, rz: 0.12 }; };
  // the front of the chest along a thin vertical strip down the middle (where the dungaree bib sits)
  const front = (y, cx) => { let z1 = -1e9; for (let i = 0; i < P.count; i++) { const b = SI.getX(i); if (b > 1) continue; if (Math.abs(P.getY(i) - y) > 0.012 * H || Math.abs(P.getX(i) - cx) > 0.05 * H) continue; z1 = Math.max(z1, P.getZ(i)); } return z1 > -1e8 ? z1 : null; };
  const ends = (bones, far) => { const pts = []; let best = 0; for (let i = 0; i < P.count; i++) { if (!bones.includes(SI.getX(i))) continue; v.fromBufferAttribute(P, i); const d = far(v); if (d > best) best = d; } const out = new THREE.Vector3(); let n = 0; for (let i = 0; i < P.count; i++) { if (!bones.includes(SI.getX(i))) continue; v.fromBufferAttribute(P, i); if (far(v) > best - 0.06 * H / 1.8) { out.add(v); n++; } } return n ? out.divideScalar(n) : out; };
  const hd = p.dims.head;
  // face: the front of the head at eye level
  let eyeY = hd.cy + hd.ry * 0.12, fz = -1e9; for (let i = 0; i < P.count; i++) { if (SI.getX(i) !== 2) continue; if (Math.abs(P.getY(i) - eyeY) > 0.012 || Math.abs(P.getX(i)) > 0.03) continue; fz = Math.max(fz, P.getZ(i)); } if (fz < -1e8) fz = hd.cz + hd.rz * 0.9;
  return { H, O, hd, chest: band(O[3].y - 0.07 * H, [1]), belly: band(O[7].y + 0.1 * H, [0, 1]), hips: band(O[7].y, [0, 7, 9]), neck: band(O[2].y + 0.005 * H, [1, 2], 0.012 * H),
    front, handL: ends([4], (q) => q.distanceTo(O[3])), handR: ends([6], (q) => q.distanceTo(O[5])), footL: ends([8], (q) => -q.y + q.z * 0.2), footR: ends([10], (q) => -q.y + q.z * 0.2), eyeY, faceZ: fz };
}
function addExtras(p, list) {
  const M = measure(p), H = M.H, O = M.O, hd = M.hd, S = H / 1.8;
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  const shiny = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.6 });
  const mk = (build, mat = vc) => { const pr = new Prop(); build(pr); const m = new THREE.Mesh(pr.build(), mat); m.castShadow = true; return m; };
  const at = (bone, y, x = 0, z = 0) => new THREE.Vector3(x, y - O[{ hips: 0, spine: 1, head: 2, lArmL: 4, lArmR: 6, shinL: 8, shinR: 10 }[bone]].y, z);
  // hands: the scans hold their arms out, but the rig's rest pose is arms-down, so hang hand props straight below the elbow (as people.js does)
  const rel = (bone, v) => { const i = { lArmL: 4, lArmR: 6, shinL: 8, shinR: 10 }[bone]; if (i === 4 || i === 6) return new THREE.Vector3(0, -(O[i].y - (p.dims.wristY - 0.065 * H)), 0.02); return v.clone().sub(O[i]); };
  const headTop = new THREE.Vector3(0, hd.cy - O[2].y + hd.ry * 0.92, hd.cz * 0.5);
  // a pointy hat that sits on the crown, brim above the forehead and tipped back, so his face is always visible.
  // Built upright with the brim at the origin, then tilted about the brim (front up, tip falling behind).
  const hat = (color, h, trim, bobble, br) => p.attach(mk(P => { P.cone(hd.rx * 0.98, h, color, 0, h / 2, 0, 0, 0, 0, 18); ring(P, hd.rx * 0.96, hd.rz * 1.0, 0, 0, 0.026, trim, 30); P.sph(br, bobble, 0, h + br * 0.4, 0, 1, 1, 1, 10); }, vc),
    'head', new THREE.Vector3(-O[2].x, hd.cy - O[2].y + hd.ry * 0.55, hd.cz - O[2].z - hd.rz * 0.18), new THREE.Euler(-0.38, 0, 0));
  const ring = (P, rx, rz, y, cz, thick, col, n = 40, ry = 1) => { for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; P.sph(thick, typeof col === 'function' ? col(k) : col, Math.sin(a) * rx, y, cz + Math.cos(a) * rz, 1.4, ry, 1.4, 6); } };
  const fur = (k) => ['#ffffff', '#f2f2f2', '#e8e8e8'][k % 3];
  const gloves = (col, scale = 1) => { for (const [b, h] of [['lArmL', M.handL], ['lArmR', M.handR]]) p.attach(mk(P => P.sph(0.055 * S * scale, col, 0, 0, 0, 1.15, 0.8, 1, 12).sph(0.03 * S * scale, col, 0, -0.05 * S, 0.02, 1, 1, 1, 8)), b, rel(b, h)); };
  const boots = (col, trim, curl) => { for (const [b, f] of [['shinL', M.footL], ['shinR', M.footR]]) p.attach(mk(P => { P.rbox(0.12 * S, 0.11 * S, 0.27 * S, 0.04, col, 0, 0.03, 0.04).cyl(0.07 * S, 0.075 * S, 0.12 * S, col, 0, 0.12 * S, -0.01); if (trim) ring(P, 0.075 * S, 0.075 * S, 0.19 * S, -0.01, 0.022 * S, trim, 18); if (curl) P.cone(0.04 * S, 0.16 * S, col, 0, 0.06, 0.2 * S, -1.2, 0, 0, 10).sph(0.022 * S, '#ffd700', 0, 0.12 * S, 0.26 * S); }), b, rel(b, f).add(new THREE.Vector3(0, 0.02, 0))); };
  for (const e of list) {
    if (e === 'mankini') { // proper 3D straps, the pouch, a gold medallion and flip-flops
      const ch = M.chest, hp = M.hips; const strap = (s, front) => { const z = front ? ch.z1 + 0.012 : ch.z0 - 0.012, zb = front ? hp.z1 + 0.01 : hp.z0 - 0.01; const top = new THREE.Vector3(s * 0.09 * S, O[3].y + 0.035 * H, (ch.cz)), mid = new THREE.Vector3(s * 0.075 * S, O[3].y - 0.08 * H, z), bot = new THREE.Vector3(s * 0.02 * S, O[7].y - 0.02 * H, zb);
        return P => { for (const [a, b] of [[top, mid], [mid, bot]]) { const len = a.distanceTo(b), c = a.clone().add(b).multiplyScalar(0.5); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); const eu = new THREE.Euler().setFromQuaternion(q); P.box(0.035 * S, len, 0.012, '#2b8a2b', c.x, c.y - O[1].y, c.z, eu.x, eu.y, eu.z); } }; };
      p.attach(mk(P => { for (const s of [-1, 1]) for (const f of [true, false]) strap(s, f)(P); P.sph(0.075 * S, '#2b8a2b', 0, O[7].y - 0.045 * H - O[1].y, hp.z1 + 0.01, 1, 0.9, 0.55, 12); }), 'spine', new THREE.Vector3());
      p.attach(mk(P => P.cyl(0.03 * S, 0.03 * S, 0.006, '#ffd700', 0, 0, 0, Math.PI / 2, 0, 0, 16).torus(0.06 * S, 0.003, '#ffd700', 0, 0.055 * S, -0.01, -0.3), shiny), 'spine', at('spine', O[3].y - 0.06 * H, 0, ch.z1 + 0.01));
      for (const [b, f] of [['shinL', M.footL], ['shinR', M.footR]]) p.attach(mk(P => P.rbox(0.11 * S, 0.015, 0.27 * S, 0.01, '#1d6fd8', 0, -0.03, 0.03).box(0.012, 0.03, 0.08, '#ffd700', 0, -0.012, 0.08)), b, rel(b, f));
    }
    if (e === 'fairy') {
      // a big three-layer tutu with glitter, a sequinned bodice, four-lobed wings with veins, a wand with ribbons, slippers and a tiara
      const hp = M.hips, bl = M.belly; const r = Math.max(hp.hx, hp.rz) + 0.03;
      p.attach(mk(P => { for (const [rr, yy, sz, cols] of [[r + 0.06, 0.02, 0.1, ['#ffc6e6', '#ffb0dc']], [r + 0.13, -0.03, 0.11, ['#ff9ad0', '#ffc6e6']], [r + 0.2, -0.08, 0.1, ['#ffffff', '#ffd6ee']]]) for (let k = 0; k < 30; k++) { const a = k / 30 * Math.PI * 2; P.sph(sz * S, cols[k % 2], Math.sin(a) * rr, yy, hp.cz + Math.cos(a) * rr * 0.9, 1, 0.38, 1, 8); }
        for (let k = 0; k < 40; k++) { const a = k * 2.4; P.sph(0.008, '#fff6a0', Math.sin(a) * (r + 0.15), 0.02, hp.cz + Math.cos(a) * (r + 0.15) * 0.9); } }), 'hips', at('hips', O[7].y + 0.015 * H));
      p.attach(mk(P => { for (let k = 0; k < 60; k++) { const a = (k % 15) / 15 * Math.PI - Math.PI / 2, yy = (Math.floor(k / 15) - 1.5) * 0.06 * S; P.sph(0.009, k % 3 ? '#ffd6ee' : '#ffffff', Math.sin(a) * bl.hx * 0.95, yy, bl.cz + Math.cos(a) * (bl.rz + 0.01)); } }), 'spine', at('spine', O[7].y + 0.16 * H));
      const wm = new THREE.MeshStandardMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.5, roughness: 0.15, side: THREE.DoubleSide, emissive: '#9ec8ff', emissiveIntensity: 0.3 });
      const vein = new THREE.MeshBasicMaterial({ color: '#d0b0ff' });
      for (const s of [-1, 1]) { const grp = new THREE.Group(); grp.add(mk(P => P.sph(0.2 * S, '#ffffff', s * 0.05, 0.1, 0, 1, 1.5, 0.04, 16).sph(0.13 * S, '#ffffff', s * 0.07, -0.22 * S, 0, 1, 1.3, 0.04, 14), wm));
        grp.add(mk(P => { for (let k = 0; k < 5; k++) P.box(0.004, 0.32 * S, 0.004, '#d0b0ff', s * (0.03 + k * 0.025), 0.12 - k * 0.02, 0, 0, 0, s * (0.2 + k * 0.18)); }, vein));
        p.attach(grp, 'spine', at('spine', O[3].y - 0.04 * H, s * 0.1 * S, M.chest.z0 - 0.06), new THREE.Euler(0, s * 0.45, s * -0.3)); }
      p.attach(mk(P => { P.cyl(0.006, 0.006, 0.38, '#f4f4f4', 0, 0.15, 0); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; P.cone(0.026, 0.06, '#ffd700', Math.sin(a) * 0.03, 0.36 + Math.cos(a) * 0.03, 0, 0, 0, -a, 4); } P.sph(0.026, '#fff6a0', 0, 0.36, 0); for (const c of ['#ff6bd6', '#6bd6ff', '#ffd700']) for (let k = 0; k < 6; k++) P.box(0.008, 0.03, 0.004, c, Math.sin(k + c.length) * 0.02, 0.32 - k * 0.03, 0.01 + k * 0.004, 0, 0, Math.sin(k) * 0.6); }, shiny), 'lArmR', rel('lArmR', M.handR).add(new THREE.Vector3(0, 0.02, 0.03)));
      p.attach(mk(P => { for (let k = 0; k < 7; k++) { const a = (k - 3) * 0.32; P.cone(0.012 + (k === 3 ? 0.012 : 0), 0.035 + (k === 3 ? 0.03 : 0), '#e8e8f0', Math.sin(a) * hd.rx * 0.8, Math.cos(a) * 0.02, Math.cos(a) * hd.rz * 0.25, 0, 0, -a * 0.6, 6); } P.sph(0.012, '#ff6bd6', 0, 0.045, hd.rz * 0.25); }, shiny), 'head', headTop.clone().add(new THREE.Vector3(0, -0.03, 0.03)), new THREE.Euler(-0.4, 0, 0));
      boots('#ec6fb4', null, false);
    }
    if (e === 'minion') {
      // dungarees hugging his own body (the denim and the straps are painted on): a stitched bib panel with the round
      // G-logo pocket, strap ends with buttons at the top corners of the bib, and side buttons at the waist
      const cx = O[1].x, yTop = O[3].y - 0.09 * H, yPk = O[3].y - 0.16 * H, yW = O[7].y + 0.07 * H;
      const zAt = (y, x = cx) => (M.front(y, x) ?? (M.chest.z1)) - O[1].z;
      const zTop = zAt(yTop), zPk = zAt(yPk), zW = zAt(yW);
      p.attach(mk(P => {
        const bw = 0.15 * H; // bib width
        // bib panel: a thin denim plate following the chest from the strap buttons down to the waist
        const steps = 6; for (let k = 0; k < steps; k++) { const t0 = k / steps, t1 = (k + 1) / steps; const y0 = yTop + (yW - yTop) * t0, y1 = yTop + (yW - yTop) * t1; const z0 = zAt(y0), z1 = zAt(y1); const ym = (y0 + y1) / 2 - O[1].y, zm = (z0 + z1) / 2 + 0.004;
          P.box(bw, Math.abs(y1 - y0) + 0.004, 0.006, '#2f5d9e', 0, ym, zm, Math.atan2(z0 - z1, Math.abs(y0 - y1)) * -1, 0, 0); }
        // stitching along the bib edges
        for (const sx of [-1, 1]) for (let k = 0; k <= 10; k++) { const y = yTop + (yW - yTop) * k / 10; P.box(0.004, 0.012, 0.002, '#e8c060', sx * (bw / 2 - 0.008), y - O[1].y, zAt(y) + 0.008); }
        // pocket with the round black G logo
        P.rbox(0.09 * H, 0.07 * H, 0.008, 0.008, '#28508a', 0, yPk - O[1].y, zPk + 0.009).cyl(0.021 * H, 0.021 * H, 0.004, '#151515', 0, yPk - O[1].y, zPk + 0.015, Math.PI / 2, 0, 0, 18)
          .box(0.007 * H, 0.022 * H, 0.003, '#f2f2f2', 0.004 * H, yPk - O[1].y, zPk + 0.018).box(0.012 * H, 0.006 * H, 0.003, '#f2f2f2', 0.008 * H, yPk - O[1].y - 0.006 * H, zPk + 0.018);
        // strap ends and big black buttons at the bib's top corners
        for (const sx of [-1, 1]) { const x = sx * 0.06 * H; P.box(0.034 * H, 0.05 * H, 0.006, '#2f5d9e', x, yTop - O[1].y + 0.02 * H, zTop + 0.006).cyl(0.012 * H, 0.012 * H, 0.008, '#111', x, yTop - O[1].y, zTop + 0.012, Math.PI / 2, 0, 0, 14); }
      }), 'spine', new THREE.Vector3(cx - O[1].x, 0, 0));
      // side buttons at the waistband
      p.attach(mk(P => { for (const sx of [-1, 1]) P.cyl(0.011 * H, 0.011 * H, 0.008, '#111', sx * (M.belly.hx * 0.85), yW - O[0].y, zW - (O[0].z - O[1].z) - 0.03, Math.PI / 2, 0, sx * 0.8, 14); }), 'hips', new THREE.Vector3(cx - O[0].x, 0, 0));
      const ez = M.faceZ - hd.cz; p.attach(mk(P => { for (const s of [-1, 1]) { P.torus(0.03 * S, 0.009 * S, '#b8c0c8', s * 0.034 * S, 0, 0, 0, 0, 0).torus(0.024 * S, 0.004 * S, '#7a828a', s * 0.034 * S, 0, 0.006, 0, 0, 0); }
          P.box(0.016 * S, 0.01 * S, 0.012, '#7a828a', 0, 0, 0);
          for (let k = 0; k < 34; k++) { const a = (k / 34) * Math.PI * 2; const x = Math.sin(a) * hd.rx * 1.05, z = -ez + Math.cos(a) * hd.rz * 1.05; if (Math.cos(a) > 0.82) continue; P.box(0.03, 0.026 * S, 0.012, '#151515', x, 0, z, 0, a, 0); } }, shiny), 'head', new THREE.Vector3(-O[2].x, M.eyeY - O[2].y, M.faceZ + 0.012 - O[2].z));
      const lens = new THREE.MeshStandardMaterial({ color: '#c8e4ff', transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2 });
      p.attach(mk(P => { for (const s of [-1, 1]) P.cyl(0.026 * S, 0.026 * S, 0.004, '#ffffff', s * 0.034 * S, 0, 0, Math.PI / 2, 0, 0, 20); }, lens), 'head', new THREE.Vector3(-O[2].x, M.eyeY - O[2].y, M.faceZ + 0.016 - O[2].z));
      gloves('#151515'); boots('#151515', null, false);
    }
    if (e === 'santa') {
      // padded belly, fur trims, belt and buckle, fur cuffs, boots with fur tops, the hat with its fur band, and the sack on his back
      const bl = M.belly; const rx = bl.hx * 0.92 + 0.02, rz = bl.rz + 0.05;
      p.attach(mk(P => { P.sph(1, '#c41e1e', 0, 0, 0.04, rx, 0.18 * S, rz, 18); ring(P, rx * 0.98, rz * 0.98, -0.17 * S, 0.03, 0.03 * S, fur, 46); P.box(rx * 2.02, 0.06 * S, 0.02, '#151515', 0, 0.02, rz + 0.025); P.box(0.11 * S, 0.08 * S, 0.012, '#ffd700', 0, 0.02, rz + 0.04).box(0.07 * S, 0.045 * S, 0.014, '#151515', 0, 0.02, rz + 0.042);
        for (let k = 0; k < 8; k++) P.sph(0.022 * S, fur(k), 0, 0.16 * S - k * 0.045 * S, rz + 0.01); }), 'spine', at('spine', O[7].y + 0.12 * H, 0, bl.cz));
      for (const [b, h] of [['lArmL', M.handL], ['lArmR', M.handR]]) p.attach(mk(P => ring(P, 0.06 * S, 0.06 * S, 0, 0, 0.022 * S, fur, 16)), b, rel(b, h).add(new THREE.Vector3(0, 0.09 * S, 0)));
      boots('#151515', fur, false);
      hat('#c41e1e', 0.3, fur, '#ffffff', 0.045);
      p.attach(mk(P => P.sph(0.24 * S, '#8a5a2a', 0, 0, 0, 1, 1.2, 0.8, 14).cyl(0.04 * S, 0.06 * S, 0.12 * S, '#7a4a20', 0, 0.3 * S, 0).torus(0.05 * S, 0.012, '#c8a050', 0, 0.26 * S, 0, Math.PI / 2).box(0.08, 0.1, 0.01, '#c1121f', 0.06, 0.1, 0.19 * S)), 'spine', at('spine', O[3].y - 0.1 * H, 0.04, M.chest.z0 - 0.17 * S));
    }
    if (e === 'elf') {
      // zig-zag tunic hem, pointy collar with bells, belt and buckle, curly shoes, the hat with a bell, pointy ears
      const bl = M.belly, hp = M.hips, nk = M.neck; const r = Math.max(hp.hx, hp.rz) + 0.03;
      p.attach(mk(P => { for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; P.cone(0.06 * S, 0.12 * S, k % 2 ? '#1f8a3a' : '#c41e1e', Math.sin(a) * r, -0.05, hp.cz + Math.cos(a) * r * 0.92, Math.PI, 0, 0, 4); }
        P.box(r * 2.05, 0.05 * S, 0.02, '#6b3a1f', 0, 0.06, hp.cz + r * 0.9).box(0.07 * S, 0.06 * S, 0.012, '#ffd700', 0, 0.06, hp.cz + r * 0.92); }), 'hips', at('hips', O[7].y + 0.02 * H));
      p.attach(mk(P => { for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; P.cone(0.035 * S, 0.08 * S, k % 2 ? '#c41e1e' : '#1f8a3a', Math.sin(a) * (nk.hx + 0.03), -0.02, nk.cz + Math.cos(a) * (nk.rz + 0.03), Math.PI / 2 + 0.6, a, 0, 4); P.sph(0.012 * S, '#ffd700', Math.sin(a) * (nk.hx + 0.07), -0.05, nk.cz + Math.cos(a) * (nk.rz + 0.07)); } }, shiny), 'spine', at('spine', O[2].y - 0.01 * H));
      boots('#1f8a3a', null, true);
      hat('#1f8a3a', 0.34, (k) => k % 2 ? '#c41e1e' : '#f6f6f6', '#ffd700', 0.032);
      for (const s of [-1, 1]) p.attach(mk(P => P.cone(0.02 * S, 0.07 * S, '#e8b8a0', 0, 0.03, 0, 0, 0, s * -0.9, 8)), 'head', new THREE.Vector3(s * hd.rx * 0.98 - O[2].x, M.eyeY - O[2].y, hd.cz - 0.01 - O[2].z));
    }
  }
}
