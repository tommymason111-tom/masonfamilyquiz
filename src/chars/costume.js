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
    extras: ['wings', 'wand', 'tutu'],
  },
  minion: {
    colours: ['#f5cf14', '#2f5d9e', '#151515'],
    zone(c) {
      if (c.hand || c.foot) return 3;                                       // black gloves and boots
      if (c.b >= 3) return c.b <= 6 ? 1 : 2;                                // yellow arms, denim legs
      if (c.y < c.shY - 0.09 * c.H) return 2;                               // dungarees, all the way round up to the chest
      if (Math.abs(Math.abs(c.x) - 0.06 * c.H) < 0.017 * c.H) return 2;     // straps over the shoulders
      return 1;
    },
    extras: ['goggleStrap'],
  },
  smurf: {
    colours: ['#3d8ad8', '#f6f6f6'],
    zone(c) {
      if (c.foot) return 2;
      if (c.b >= 7 || (c.b === 0 && c.y < c.hipY + 0.04 * c.H)) return 2;  // white trousers
      return 1;                                                             // Smurf blue everywhere else (below the neck)
    },
    extras: ['smurfHat'],
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
    extras: ['santaHat'],
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
    extras: ['elfHat'],
  },
};

export function paintCostume(p, outfit) {
  const def = COSTUMES[outfit.id]; const mesh = p.mesh; if (!def || !mesh) return;
  const g = mesh.geometry, P = g.attributes.position, UV = g.attributes.uv, SI = g.attributes.skinIndex, I = g.index;
  const map = mesh.material.map, img = map?.image; if (!img || !UV || !I) return;
  const W = img.width, Hh = img.height, H = p.H, O = p.O;
  const ctx = { H, neckY: O[2].y, shY: O[3].y, hipY: O[7].y, kneeY: O[8].y };
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

function addExtras(p, list) {
  const H = p.H, O = p.O, hd = p.dims.head;
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  const mk = (build, mat = vc) => { const pr = new Prop(); build(pr); const m = new THREE.Mesh(pr.build(), mat); m.castShadow = true; return m; };
  const headTop = new THREE.Vector3(0, hd.cy - O[2].y + hd.ry * 0.92, hd.cz * 0.5);
  const handR = new THREE.Vector3(0, -(O[6].y - (p.dims.wristY - 0.065 * H)), 0.025);
  for (const e of list) {
    if (e === 'smurfHat') p.attach(mk(P => P.sph(hd.rx * 1.12, '#f6f6f6', 0, 0, -0.01, 1, 0.62, 1.12, 16).sph(hd.rx * 0.75, '#f6f6f6', 0, hd.ry * 0.5, 0.03, 1, 0.9, 1, 12).cone(hd.rx * 0.55, 0.16, '#f6f6f6', 0, hd.ry * 0.62, 0.1, 1.25, 0, 0, 12)), 'head', headTop.clone().add(new THREE.Vector3(0, -0.035, 0)));
    if (e === 'santaHat') p.attach(mk(P => P.cone(hd.rx * 1.06, 0.3, '#c41e1e', 0, 0.12, -0.01, -0.35, 0, 0, 18).sph(0.035, '#ffffff', 0, 0.25, -0.1)), 'head', headTop.clone().add(new THREE.Vector3(0, -0.05, 0)));
    if (e === 'elfHat') p.attach(mk(P => P.cone(hd.rx * 1.04, 0.34, '#1f8a3a', 0, 0.14, -0.02, -0.45, 0, 0, 18).sph(0.028, '#ffd700', 0, 0.28, -0.15)), 'head', headTop.clone().add(new THREE.Vector3(0, -0.05, 0)));
    if (e === 'goggleStrap') { /* the Minion look is all in the dungarees: goggles would hide his face */ }
    if (e === 'wings') { const wm = new THREE.MeshStandardMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.55, roughness: 0.2, side: THREE.DoubleSide, emissive: '#8fb8ff', emissiveIntensity: 0.25 });
      for (const s of [-1, 1]) { p.attach(mk(P => P.sph(0.16, '#ffffff', 0, 0.06, 0, 1, 1.5, 0.06, 14).sph(0.1, '#ffffff', 0.03 * s, -0.17, 0.0, 1, 1.2, 0.06, 12), wm), 'spine', new THREE.Vector3(s * 0.17, O[3].y - O[1].y - 0.05, -0.17), new THREE.Euler(0, s * 0.35, s * -0.35)); } }
    if (e === 'wand') p.attach(mk(P => { P.cyl(0.006, 0.006, 0.34, '#f4f4f4', 0, 0.12, 0); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; P.cone(0.022, 0.05, '#ffd700', Math.sin(a) * 0.025, 0.3 + Math.cos(a) * 0.025, 0, 0, 0, -a, 4); } P.sph(0.022, '#fff6a0', 0, 0.3, 0); }), 'lArmR', handR.clone().add(new THREE.Vector3(-0.02, 0.0, 0.03)));
    if (e === 'tutu') { // a frilly skirt around the hips, sized from the scan
      const g = p.mesh.geometry, P0 = g.attributes.position, SI = g.attributes.skinIndex; let r = 0, cz = 0, n = 0; const y0 = O[7].y;
      for (let i = 0; i < P0.count; i++) { const b = SI.getX(i); if (b > 0 && b !== 7 && b !== 9) continue; const y = P0.getY(i); if (Math.abs(y - y0) > 0.03 * H) continue; r = Math.max(r, Math.hypot(P0.getX(i), P0.getZ(i))); cz += P0.getZ(i); n++; }
      cz = n ? cz / n : 0; r = Math.max(r, 0.16);
      p.attach(mk(P => { for (let k = 0; k < 22; k++) { const a = k / 22 * Math.PI * 2; for (const [rr, yy, s] of [[r + 0.05, 0, 0.09], [r + 0.1, -0.05, 0.08]]) P.sph(s, k % 2 ? '#ffc6e6' : '#ffb0dc', Math.sin(a) * rr, yy, Math.cos(a) * rr * 0.85, 1, 0.45, 1, 8); } }), 'hips', new THREE.Vector3(0, y0 - O[0].y + 0.02, cz));
    }
  }
}
