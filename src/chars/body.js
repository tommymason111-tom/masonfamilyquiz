// Procedural semi-realistic character builder.
// Every person is ONE SkinnedMesh (3 materials: skin/clothes, hair cards, glossy eyes) so 19 people stay
// cheap on Quest. The skeleton's 11 "part" bones map 1:1 onto the ragdoll rigid bodies; the extra face
// bones (jaw, eyes, eyelids, brows, hair) drive lip-sync, blinking, expressions and hair sway.
import * as THREE from 'three';
import { mulberry, noise3, clamp, smooth } from '../core.js';

export const BONES = ['hips', 'spine', 'head', 'uArmL', 'lArmL', 'uArmR', 'lArmR', 'thighL', 'shinL', 'thighR', 'shinR',
  'jaw', 'eyeL', 'eyeR', 'hair', 'brow', 'lidL', 'lidR'];
export const B = Object.fromEntries(BONES.map((n, i) => [n, i]));
export const PARENT = [-1, 0, 1, 1, 3, 1, 5, 0, 7, 0, 9, 2, 2, 2, 2, 2, 2, 2];
export const PART_COUNT = 11;

const C = (hex) => new THREE.Color(hex);
const lerpC = (a, b, t) => a.clone().lerp(b, clamp(t, 0, 1));

// ---------- proportions ----------
export function computeDims(spec) {
  const H = spec.height;
  const kind = spec.build;
  let p;
  if (kind === 'toddler') p = { ankle: .045, knee: .24, hip: .44, pelvis: .45, waist: .53, shoulder: .755, neck: .77, chin: .785, headW: .30 };
  else if (kind === 'baby') p = { ankle: .05, knee: .22, hip: .41, pelvis: .42, waist: .50, shoulder: .70, neck: .715, chin: .73, headW: .36 };
  else p = { ankle: .04, knee: .28, hip: .515, pelvis: .53, waist: .60, shoulder: .815, neck: .836, chin: .853, headW: .175 };
  const female = spec.sex === 'f';
  const wMul = { standard: 1, slim: 0.9, bigger: 1.18, toddler: 1.25, baby: 1.4 }[kind] * (spec.widthMul || 1);
  const headH = (1 - p.chin) * H * (kind === 'toddler' || kind === 'baby' ? 1 : 0.925);
  const head = {
    rx: headH * (female ? 0.33 : 0.345) * (kind === 'baby' ? 1.12 : kind === 'toddler' ? 1.06 : 1),
    ry: headH * 0.5, rz: headH * (kind === 'baby' ? 0.45 : 0.43),
  };
  head.cy = p.chin * H + headH * 0.5; head.cz = 0.004 * H;
  const shoulderHalf = H * (female ? 0.094 : 0.104) * (kind === 'bigger' ? 1.1 : kind === 'slim' ? 0.95 : 1) * (kind === 'toddler' || kind === 'baby' ? 1.2 : 1);
  const armR = H * (kind === 'bigger' ? 0.034 : female ? 0.027 : 0.031) * (kind === 'toddler' || kind === 'baby' ? 1.3 : 1);
  const legR = H * (kind === 'bigger' ? 0.052 : female ? 0.05 : 0.048) * (kind === 'toddler' || kind === 'baby' ? 1.25 : 1);
  const d = {
    H, p, female, kind, wMul, head, headH, shoulderHalf, armR, legR,
    hipX: H * (female ? 0.052 : 0.05) * (wMul > 1.1 ? 1.08 : 1),
    elbowY: H * (p.shoulder - (p.shoulder - p.hip) * 0.62),
    wristY: H * (p.hip - 0.02),
  };
  d.armX = shoulderHalf + armR * 0.85;
  d.origins = [
    [0, p.pelvis * H, 0],                 // hips
    [0, p.waist * H, 0],                  // spine
    [0, p.neck * H, 0],                   // head
    [d.armX, p.shoulder * H - armR * 0.4, 0], [d.armX, d.elbowY, 0],
    [-d.armX, p.shoulder * H - armR * 0.4, 0], [-d.armX, d.elbowY, 0],
    [d.hipX, p.hip * H, 0], [d.hipX, p.knee * H, 0],
    [-d.hipX, p.hip * H, 0], [-d.hipX, p.knee * H, 0],
    [0, head.cy - head.ry * 0.05, -head.rz * 0.25], // jaw pivot
    [head.rx * 0.36, head.cy + head.ry * 0.02, 0], [-head.rx * 0.36, head.cy + head.ry * 0.02, 0], // eyes (z fixed later)
    [0, p.neck * H + 0.02 * H, -head.rz * 0.6], // hair sway pivot
    [0, head.cy + head.ry * 0.2, head.rz * 0.8], // brows
    [0, 0, 0], [0, 0, 0],                  // lids = eye positions, set later
  ];
  return d;
}

// Torso cross-section (rx, rz, zOff) as a function of height fraction t (0=crotch .. 1=neck base)
function torsoProfile(d, spec, yFrac) {
  const H = d.H, f = d.female, k = d.kind;
  const p = d.p;
  const t = (yFrac - (p.hip - 0.03)) / (p.neck - (p.hip - 0.03));
  // key rings [t, rx/H, rz/H, zOff/H]
  let rings;
  if (k === 'toddler' || k === 'baby') rings = [[0, .1, .085, 0], [.3, .118, .1, .01], [.6, .115, .095, .012], [.88, .11, .08, 0], [.95, .07, .06, 0], [1, .045, .045, 0]];
  else if (f) rings = [[0, .082, .062, 0], [.12, .1, .07, -.004], [.3, .09, .062, 0], [.45, .078, .055, .004], [.62, .085, .064, .012], [.72, .09, .07, .02], [.84, .092, .058, .006], [.93, .07, .05, 0], [1, .034, .034, .002]];
  else rings = [[0, .08, .06, 0], [.12, .093, .066, 0], [.3, .09, .063, .002], [.45, .087, .062, .006], [.62, .095, .066, .01], [.76, .102, .068, .008], [.88, .1, .06, .003], [.95, .072, .05, 0], [1, .038, .038, .002]];
  let a = rings[0], b = rings[rings.length - 1];
  for (let i = 0; i < rings.length - 1; i++) if (t >= rings[i][0] && t <= rings[i + 1][0]) { a = rings[i]; b = rings[i + 1]; break; }
  const s = smooth(clamp((t - a[0]) / Math.max(1e-5, b[0] - a[0]), 0, 1));
  let rx = (a[1] + (b[1] - a[1]) * s) * H, rz = (a[2] + (b[2] - a[2]) * s) * H, zo = (a[3] + (b[3] - a[3]) * s) * H;
  if (t < 0) { const q = clamp(1 + t * 4, 0, 1); rx *= q; rz *= q; }
  // shoulders: widen to meet the arms, then a rounded trapezius slope to the neck
  if (t > 0.72 && k !== 'toddler' && k !== 'baby') {
    const sw = (d.armX - d.armR * 0.25) / (spec.inflate || 1) / d.wMul;
    if (t <= 0.9) { const u = smooth((t - 0.72) / 0.18); rx = rx + (sw - rx) * u; }
    else { const u = (t - 0.9) / 0.1; const neckR = 0.04 * H; rx = sw + (neckR - sw) * Math.sin(u * Math.PI / 2) ** 1.6; rz = rz * (1 - 0.35 * u); }
  }
  const wm = d.wMul * (spec.inflate || 1);
  rx *= t > 0.93 ? 1 + (wm - 1) * 0.5 : wm; rz *= t > 0.93 ? 1 : (k === 'bigger' ? 1.12 : 1) * (spec.inflate || 1);
  if (k === 'bigger' && t > 0.2 && t < 0.7) { const b2 = Math.sin((t - 0.2) / 0.5 * Math.PI); rz += 0.028 * H * b2 * (spec.belly ?? 1); zo += 0.024 * H * b2 * (spec.belly ?? 1); }
  if (spec.belly && k !== 'bigger' && t > 0.2 && t < 0.7) { const b2 = Math.sin((t - 0.2) / 0.5 * Math.PI); zo += 0.01 * H * b2 * spec.belly; }
  return { rx, rz, zo, t };
}

// ---------- geometry accumulator ----------
class Acc {
  constructor() { this.pos = []; this.col = []; this.si = []; this.sw = []; this.groups = [[], [], []]; }
  v(x, y, z, c, b0, b1 = b0, w = 1) {
    this.pos.push(x, y, z); this.col.push(c.r, c.g, c.b); this.si.push(b0, b1, 0, 0); this.sw.push(w, 1 - w, 0, 0);
    return this.pos.length / 3 - 1;
  }
  t(a, b, c, g = 0) { this.groups[g].push(a, b, c); }
  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    const idx = []; let start = 0;
    for (let g = 0; g < 3; g++) { const arr = this.groups[g]; for (const i of arr) idx.push(i); geo.addGroup(start, arr.length, g); start += arr.length; }
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }
}

// Generic loft: rings = [{c:[x,y,z], ax:[..], az:[..], rx, rz}] ; colorFn(ringIdx, angle, p) ; skinFn(p)->[b0,b1,w]
function loft(acc, rings, segs, colorFn, skinFn, opts = {}) {
  const base = acc.pos.length / 3;
  const g = opts.group || 0;
  const P = new THREE.Vector3();
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      // superellipse power for boxier torso
      const pw = r.pow || 1;
      const cx = Math.sign(ca) * Math.pow(Math.abs(ca), pw), sz = Math.sign(sa) * Math.pow(Math.abs(sa), pw);
      const ax = r.ax || [1, 0, 0], az = r.az || [0, 0, 1];
      let rxx = r.rx, rzz = r.rz;
      if (r.radFn) { const m = r.radFn(a); rxx *= m; rzz *= m; }
      P.set(r.c[0] + ax[0] * cx * rxx + az[0] * sz * rzz, r.c[1] + ax[1] * cx * rxx + az[1] * sz * rzz, r.c[2] + ax[2] * cx * rxx + az[2] * sz * rzz);
      if (opts.displace) opts.displace(P, i, a);
      const sk = skinFn(P, i);
      acc.v(P.x, P.y, P.z, colorFn(i, a, P), sk[0], sk[1], sk[2]);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < segs; j++) {
    const a = base + i * segs + j, b = base + i * segs + (j + 1) % segs, c = base + (i + 1) * segs + j, d = base + (i + 1) * segs + (j + 1) % segs;
    if (opts.flip) { acc.t(a, b, c, g); acc.t(b, d, c, g); } else { acc.t(a, c, b, g); acc.t(b, c, d, g); }
  }
  const cap = (ri, dirSign) => {
    const r = rings[ri]; const P2 = new THREE.Vector3(...r.c);
    if (opts.capOffset) { const ax = r.ay || [0, 1, 0]; P2.x += ax[0] * opts.capOffset * dirSign; P2.y += ax[1] * opts.capOffset * dirSign; P2.z += ax[2] * opts.capOffset * dirSign; }
    const sk = skinFn(P2, ri);
    const ci = acc.v(P2.x, P2.y, P2.z, colorFn(ri, 0, P2), sk[0], sk[1], sk[2]);
    for (let j = 0; j < segs; j++) {
      const a = base + ri * segs + j, b = base + ri * segs + (j + 1) % segs;
      const flip = (dirSign > 0) !== !!opts.flip;
      if (flip) acc.t(a, b, ci, g); else acc.t(b, a, ci, g);
    }
  };
  if (opts.capStart) cap(0, -1);
  if (opts.capEnd) cap(rings.length - 1, 1);
}

// Deformed UV-sphere: dirFn(dir) -> position (Vector3); include(dir) filter; color & skin fns
function sphere(acc, latSegs, lonSegs, posFn, colorFn, skinFn, opts = {}) {
  const base = acc.pos.length / 3; const g = opts.group || 0;
  const keep = []; const D = new THREE.Vector3();
  for (let i = 0; i <= latSegs; i++) {
    const th = (i / latSegs) * Math.PI;
    for (let j = 0; j <= lonSegs; j++) {
      const ph = (j / lonSegs) * Math.PI * 2;
      D.set(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
      const P = posFn(D.clone(), i, j);
      const sk = skinFn(P, D);
      acc.v(P.x, P.y, P.z, colorFn(P, D), sk[0], sk[1], sk[2]);
      keep.push(opts.include ? opts.include(D) : true);
    }
  }
  const row = lonSegs + 1;
  for (let i = 0; i < latSegs; i++) for (let j = 0; j < lonSegs; j++) {
    const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
    if (opts.include && !(keep[a] || keep[b] || keep[c] || keep[d])) continue;
    if (opts.include && opts.strict && !(keep[a] && keep[b] && keep[c] && keep[d])) continue;
    acc.t(base + a, base + c, base + b, g); acc.t(base + b, base + c, base + d, g);
  }
  // weld seam (j=0 and j=lon share positions; normals computed per-index so we average manually later)
}

function ellipsoid(acc, c, r, color, bone, opts = {}) {
  const q = opts.quat || null; const lat = opts.lat || 8, lon = opts.lon || 10;
  sphere(acc, lat, lon, (D) => { const v = new THREE.Vector3(D.x * r[0], D.y * r[1], D.z * r[2]); if (q) v.applyQuaternion(q); return v.add(c); },
    (P, D) => typeof color === 'function' ? color(P, D) : color, () => Array.isArray(bone) ? bone : [bone, bone, 1], { group: opts.group || 0 });
}

// ---------- clothing colour functions ----------
function jumperColor(spec, d, P, region) {
  const top = spec.top; const H = d.H;
  const c1 = C(top.c1 || '#a31d22'), c2 = C(top.c2 || '#ffffff'), c3 = C(top.c3 || '#1f5130');
  const y = P.y / H; const ang = Math.atan2(P.x, P.z); // 0 front
  const front = Math.cos(ang);
  const nz = noise3(P.x * 300, P.y * 300, P.z * 300) * 0.06;
  const knit = (c) => c.clone().multiplyScalar(0.94 + nz + ((Math.floor(P.y * 220) % 2) ? 0.03 : 0));
  // ribbing at hem / cuffs
  if (region === 'torso' && y < d.p.hip + 0.0) return knit(c1.clone().multiplyScalar(0.82));
  if (region === 'cuff') return knit(c1.clone().multiplyScalar(0.8));
  const pat = top.pattern;
  if (pat === 'fairisle' || pat === 'reindeer' || pat === 'snowflake') {
    const bandY = (y - d.p.shoulder + 0.11) * H; // band across upper chest/sleeves
    if (bandY > 0 && bandY < 0.09) {
      const u = (ang + Math.PI) * 18 + (region === 'arm' ? P.y * 200 : 0);
      const zig = Math.abs(((u % 2) + 2) % 2 - 1);
      const by = bandY / 0.09;
      if (by < 0.12 || by > 0.88) return knit(c2);
      if (Math.abs(by - 0.5) < zig * 0.32) return knit(c3);
      if ((Math.floor(u * 2) % 3 === 0) && Math.abs(by - 0.5) < 0.06) return knit(c2);
    }
    const lowY = (y - d.p.hip - 0.02) * H;
    if (lowY > 0 && lowY < 0.04) { const u = (ang + Math.PI) * 24; return knit(Math.floor(u) % 2 ? c2 : c3); }
  }
  if (pat === 'snowflake' && region !== 'cuff') {
    const u = (ang + Math.PI) * 6, v = y * 40;
    const fu = u - Math.floor(u) - 0.5, fv = v - Math.floor(v) - 0.5;
    if (fu * fu + fv * fv < 0.03 && (Math.floor(u) + Math.floor(v)) % 2 === 0) return knit(c2);
  }
  if (pat === 'reindeer' && region === 'torso' && front > 0.55) {
    // Rudolph face on chest
    const fx = P.x / H, fy = y - (d.p.waist + 0.1);
    const hd = (fx / 0.035) ** 2 + (fy / 0.045) ** 2;
    if (hd < 1) { if (Math.abs(fx) > 0.012 && Math.abs(fx) < 0.02 && Math.abs(fy - 0.012) < 0.006) return C('#ffffff'); return knit(C('#7a4a22')); }
    // antlers
    const ax = Math.abs(fx), ay = fy - 0.045;
    if (ay > 0 && ay < 0.05 && Math.abs(ax - 0.02 - ay * 0.5) < 0.004) return knit(C('#4a2a10'));
    if (ay > 0.02 && ay < 0.04 && Math.abs(ay - 0.03) < 0.004 && ax > 0.025 && ax < 0.045) return knit(C('#4a2a10'));
  }
  if (pat === 'tree' && region === 'torso' && front > 0.5) {
    const fx = Math.abs(P.x / H), fy = y - (d.p.waist + 0.04);
    if (fy > 0 && fy < 0.14 && fx < (0.14 - fy) * 0.45) return knit((Math.floor(fy * 300 + fx * 200) % 7 === 0) ? C('#f0d020') : c3);
    if (fy > 0.14 && fy < 0.155 && fx < 0.008) return C('#f0d020');
  }
  if (pat === 'stripes') { if (Math.floor(y * H * 18) % 2) return knit(c2); }
  if (pat === 'sparkly') { const n = noise3(P.x * 900, P.y * 900, P.z * 900); if (n > 0.72) return C(n > 0.86 ? '#ffffff' : top.c2 || '#ffd700'); return c1.clone().multiplyScalar(0.85 + n * 0.3); }
  if (pat === 'hoodie') {
    if (region === 'torso' && front > 0.6 && y > d.p.hip + 0.0 && y < d.p.waist + 0.02) return c1.clone().multiplyScalar(0.88); // pocket
    if (region === 'torso' && front > 0.85 && y > d.p.shoulder - 0.06 && Math.abs(P.x) < 0.012 * H) return C('#eeeeee');      // drawstrings
    return c1.clone().multiplyScalar(0.95 + nz);
  }
  if (pat === 'quarterzip') {
    if (region === 'torso' && front > 0.98 && y > d.p.shoulder - 0.09) return C('#bbbbbb');
    if (region === 'torso' && y > d.p.neck - 0.02 && Math.hypot(P.x, P.z) < 0.055 * H) return c1.clone().multiplyScalar(0.8);
    return c1.clone().multiplyScalar(0.95 + nz);
  }
  if (pat === 'apron' && region === 'torso' && front > 0.45 && y < d.p.shoulder - 0.07) {
    if (Math.abs(P.x / H) < 0.07) { const ch = (Math.floor(P.x * 60) + Math.floor(P.y * 60)) % 2; return ch ? C('#c8202a') : C('#f2efe6'); }
  }
  if (pat === 'shirtjumper' && region === 'torso' && y > d.p.neck - 0.02 && Math.hypot(P.x, P.z) < 0.055 * H) return C('#e9eef4');
  if (pat === 'topsmart') { const n = noise3(P.x * 700, P.y * 700, P.z * 700); return c1.clone().multiplyScalar(0.8 + n * 0.4 + (n > 0.8 ? 0.6 : 0)); }
  if (pat === 'santa') { if (y < d.p.hip + 0.02 && y > d.p.hip - 0.02) return C('#f4f4f4'); if (Math.abs(y - d.p.waist + 0.02) < 0.012) return C('#111111'); if (front > 0.97 && region === 'torso') return C('#f4f4f4'); return c1; }
  if (pat === 'mankini') { // skin with green straps
    const sx = Math.abs(P.x / H); const strap = Math.abs(sx - 0.03 - (y - d.p.hip) * 0.15) < 0.006 && front > 0;
    const strapB = Math.abs(sx - 0.03 - (y - d.p.hip) * 0.15) < 0.006 && front <= 0;
    if ((strap || strapB) && y > d.p.hip) return C('#2b8a2b');
    if (y < d.p.hip + 0.03 && y > d.p.hip - 0.04 && (front > 0.5 || front < -0.6) && sx < 0.035) return C('#2b8a2b');
    return C(spec.skin);
  }
  if (pat === 'speedo') { if (y < d.p.hip + 0.025) return C('#1a2a6a'); return C(spec.skin); }
  if (pat === 'turkey') { const n = noise3(P.x * 120, P.y * 120, P.z * 120); return lerpC(C('#6b3f1f'), C('#a8693a'), n); }
  if (pat === 'xmastree') { const n = noise3(P.x * 90, P.y * 90, P.z * 90); return lerpC(C('#174d1f'), C('#2f7a2a'), n); }
  if (pat === 'bluey') { if (region === 'torso' && front > 0.45 && y < d.p.shoulder - 0.04) return C('#f0d8a8'); if (region === 'torso' && front < -0.6 && y > d.p.waist) return C('#2f4f8f'); return c1; } // Bluey: tan tummy, darker saddle
  if (pat === 'dino') { if (region === 'torso' && front > 0.5 && y < d.p.shoulder - 0.05) return C('#c9e07a'); return c1; }
  if (pat === 'elf') { if (Math.abs(y - d.p.waist + 0.03) < 0.015) return C('#111'); if (y < d.p.hip + 0.03) return C('#c41e1e'); return c1; }
  if (pat === 'sumo') { const n = noise3(P.x * 30, P.y * 30, P.z * 30); return lerpC(C('#e8b892'), C('#f5cfaf'), n); }
  if (pat === 'donkey') { const n = noise3(P.x * 200, P.y * 200, P.z * 200); return lerpC(C('#6e6258'), C('#8b7d70'), n); }
  if (pat === 'trex') { const n = noise3(P.x * 50, P.y * 50, P.z * 50); return lerpC(C('#3f8f3a'), C('#5fb04f'), n); }
  if (pat === 'mrsclaus') { if (y < d.p.hip - 0.0) return C('#f4f4f4'); if (front > 0.95 && region === 'torso') return C('#f4f4f4'); return c1; }
  return knit(c1);
}
function legColor(spec, d, P) {
  const L = spec.legs || { type: 'jeans', c1: '#2d4466' };
  const H = d.H; const y = P.y / H; const n = noise3(P.x * 400, P.y * 400, P.z * 400);
  if (L.type === 'skin') return C(spec.skin).multiplyScalar(0.98 + n * 0.04);
  if (L.type === 'jeans') {
    const c = C(L.c1 || '#2d4466');
    const knee = Math.exp(-(((y - d.p.knee) / 0.03) ** 2)) * 0.25; const thighWear = Math.exp(-(((y - (d.p.knee + d.p.hip) / 2) / 0.05) ** 2)) * 0.18;
    const front = P.z > 0 ? 1 : 0;
    let col = c.clone().multiplyScalar(0.85 + n * 0.25 + (knee + thighWear) * front);
    const sideSeam = Math.abs(Math.abs(P.x) - Math.abs(d.hipX) - d.legR * 0.95) < 0.003 * H;
    if (sideSeam) col = C('#c08a3a');
    return col;
  }
  if (L.type === 'onesie') return C(L.c1).multiplyScalar(0.92 + n * 0.12);
  return C(L.c1 || '#222').multiplyScalar(0.9 + n * 0.15);
}

// ---------- main builder ----------
export function buildCharacter(spec) {
  const d = computeDims(spec);
  const H = d.H, acc = new Acc();
  const rnd = mulberry(spec.seed || 1);
  const skin = C(spec.skin || '#e9c2a6');
  const skinDark = skin.clone().multiplyScalar(0.82);
  const lipC = C(spec.lip || '#b86a62');
  const face = {
    jaw: spec.face?.jaw ?? (0.78 + rnd() * 0.14) * (d.female ? 0.95 : 1),
    chin: spec.face?.chin ?? (0.02 + rnd() * 0.03),
    nose: spec.face?.nose ?? (0.85 + rnd() * 0.4),
    noseW: spec.face?.noseW ?? (0.85 + rnd() * 0.3),
    cheek: spec.face?.cheek ?? (rnd() * 0.5 + 0.3),
    brow: spec.face?.brow ?? (d.female ? 0.3 : 0.7 + rnd() * 0.3),
    eyeGap: spec.face?.eyeGap ?? (0.34 + rnd() * 0.05),
    lips: spec.face?.lips ?? (d.female ? 1.15 : 0.9) * (0.9 + rnd() * 0.2),
    ears: spec.face?.ears ?? (0.9 + rnd() * 0.3),
    round: spec.face?.round ?? (d.kind === 'toddler' || d.kind === 'baby' ? 1.06 : 1),
  };
  const O = d.origins.map(o => new THREE.Vector3(...o));
  const hd = d.head;
  const hc = new THREE.Vector3(0, hd.cy, hd.cz);
  // ---- Torso ----
  const tor = [];
  const y0 = (d.p.hip - 0.035) * H, y1 = d.p.neck * H + 0.004 * H;
  const NR = 44;
  for (let i = 0; i <= NR; i++) {
    const y = y0 + (y1 - y0) * (i / NR);
    const pr = torsoProfile(d, spec, y / H);
    tor.push({ c: [0, y, pr.zo], rx: pr.rx, rz: pr.rz, pow: 0.85 });
  }
  const waistY = O[1].y;
  const torsoSkin = (P) => {
    const y = P.y;
    if (y < waistY - 0.05 * H) return [0, 0, 1];
    if (y > waistY + 0.04 * H) {
      // shoulders blend a little with upper arms so the deltoid follows
      const sx = Math.abs(P.x);
      if (y > d.p.shoulder * H - 0.07 * H && sx > d.shoulderHalf * 0.75) return [1, P.x > 0 ? 3 : 5, 0.6];
      return [1, 1, 1];
    }
    const w = (y - (waistY - 0.05 * H)) / (0.09 * H);
    return [1, 0, smooth(w)];
  };
  loft(acc, tor, 48, (i, a, P) => {
    const yN = P.y / H;
    if (yN > d.p.neck - 0.01 && !(spec.top?.pattern === 'mankini' || spec.top?.pattern === 'speedo')) return skin; // neck hole
    return jumperColor(spec, d, P, 'torso');
  }, torsoSkin, { capStart: true });
  // ---- Neck (head bone, blends to spine at the bottom) ----
  const neckR = (d.female ? 0.03 : 0.036) * H * (d.kind === 'bigger' ? 1.15 : 1) * (d.kind === 'toddler' || d.kind === 'baby' ? 0.9 : 1);
  const neck = [];
  for (let i = 0; i <= 6; i++) { const y = d.p.neck * H - 0.012 * H + i * ((hd.cy - hd.ry * 0.4) - (d.p.neck * H - 0.012 * H)) / 6; neck.push({ c: [0, y, -0.004 * H + i * 0.0015 * H], rx: neckR * (1 - i * 0.02), rz: neckR * 1.05 }); }
  loft(acc, neck, 20, (i, a, P) => {
    // stubble on throat
    if (spec.stubble && Math.cos(a) > 0.2 && i > 3) return lerpC(skin, C(spec.stubbleColor || '#3a2a20'), spec.stubble * 0.35);
    return skin;
  }, (P) => P.y < d.p.neck * H + 0.008 * H ? [2, 1, 0.5] : [2, 2, 1]);
  if (spec.top?.pattern === 'shirtjumper' || spec.top?.pattern === 'quarterzip') {
    // collar ring
    const cr = []; for (let i = 0; i <= 2; i++) cr.push({ c: [0, d.p.neck * H - 0.01 * H + i * 0.012 * H, -0.002 * H], rx: neckR * 1.25, rz: neckR * 1.3 });
    loft(acc, cr, 20, () => spec.top.pattern === 'shirtjumper' ? C('#f2f5f8') : C(spec.top.c1).multiplyScalar(0.8), () => [1, 1, 1]);
  }
  if (spec.top?.pattern === 'hoodie') ellipsoid(acc, new THREE.Vector3(0, d.p.neck * H + 0.01 * H, -0.06 * H), [0.075 * H, 0.04 * H, 0.04 * H], C(spec.top.c1).multiplyScalar(0.9), 1);
  // ---- Head ----
  const eyeY = hd.cy + hd.ry * 0.03;
  const eyeX = hd.rx * face.eyeGap;
  const gauss = (dx, dy, sx, sy) => Math.exp(-((dx * dx) / (sx * sx) + (dy * dy) / (sy * sy)));
  const headPos = (D) => {
    let x = D.x * hd.rx * face.round, y = D.y * hd.ry, z = D.z * hd.rz;
    // jaw taper
    if (D.y < 0.05) { const t = clamp((0.05 - D.y) / 1.05, 0, 1); x *= 1 - (1 - face.jaw) * t * 1.0; if (D.z > 0) z *= 1 - 0.1 * t; }
    // cranium fuller at back/top
    if (D.z < 0 && D.y > -0.3) z *= 1.06;
    if (D.y > 0.4) { x *= 1.02; }
    // flatter face plane
    if (D.z > 0.6) z -= (D.z - 0.6) * hd.rz * 0.18;
    // chin
    z += gauss(D.x / 0.25, (D.y + 0.85) / 0.18, 1, 1) * face.chin * H * Math.max(0, D.z);
    // eye sockets
    const sx = Math.abs(D.x) - face.eyeGap * 0.92, sy = D.y - 0.03;
    if (D.z > 0) z -= gauss(sx, sy, 0.14, 0.1) * 0.018 * hd.rz * 6 * D.z;
    // brow ridge
    if (D.z > 0) z += gauss(Math.abs(D.x) - 0.3, D.y - 0.2, 0.3, 0.07) * face.brow * 0.05 * hd.rz;
    // cheekbones
    if (D.z > 0) { x += Math.sign(D.x) * gauss(Math.abs(D.x) - 0.6, D.y + 0.15, 0.2, 0.15) * face.cheek * 0.04 * hd.rx; z += gauss(Math.abs(D.x) - 0.5, D.y + 0.2, 0.2, 0.15) * face.cheek * 0.04 * hd.rz; }
    // mouth area slightly forward (muzzle)
    if (D.z > 0) z += gauss(D.x, D.y + 0.48, 0.32, 0.18) * 0.06 * hd.rz;
    // philtrum groove
    if (D.z > 0) z -= gauss(D.x, D.y + 0.34, 0.04, 0.08) * 0.015 * hd.rz;
    // temples
    x -= Math.sign(D.x) * gauss(Math.abs(D.x) - 0.85, D.y - 0.35, 0.2, 0.2) * 0.02 * hd.rx;
    return new THREE.Vector3(x, y, z).add(hc);
  };
  const mouthY = hc.y - hd.ry * 0.47;
  const headSkin = (P, D) => {
    // jaw region
    if (D.y < -0.42 && D.z > -0.3) { const w = smooth(clamp((-0.42 - D.y) / 0.12, 0, 1)) * smooth(clamp((D.z + 0.3) / 0.4, 0, 1)); return [11, 2, w]; }
    return [2, 2, 1];
  };
  const stubbleC = C(spec.stubbleColor || '#3a2a20');
  const headColor = (P, D) => {
    let c = skin.clone();
    // subtle skin tone variation: warmer cheeks/nose/ears, cooler under-eye
    const cheek = gauss(Math.abs(D.x) - 0.55, D.y + 0.25, 0.25, 0.2) * Math.max(0, D.z);
    c.lerp(C('#e88a7a'), cheek * (spec.rosy ?? 0.18));
    c.lerp(skinDark, gauss(Math.abs(D.x) - face.eyeGap, D.y + 0.08, 0.15, 0.05) * Math.max(0, D.z) * 0.25);
    // stubble
    if (spec.stubble) {
      const jawZone = (D.y < -0.12 ? 1 : 0) * (D.z > -0.35 ? 1 : 0) * (Math.abs(D.x) < 0.95 ? 1 : 0);
      const cheekLine = smooth(clamp((-0.12 - D.y) / 0.25, 0, 1));
      const notLips = 1 - gauss(D.x, D.y + 0.5, 0.3, 0.06) * (D.z > 0.6 ? 1 : 0);
      const lipTop = gauss(D.x, D.y + 0.38, 0.28, 0.05) * Math.max(0, D.z); // moustache shadow
      const n = noise3(P.x * 1500, P.y * 1500, P.z * 1500);
      const amt = clamp((jawZone * cheekLine * notLips + lipTop * 0.8) * spec.stubble * (0.72 + n * 0.35), 0, 0.85);
      c.lerp(stubbleC, amt);
    }
    // lips colouring (merged with lip meshes)
    const lipZone = gauss(D.x, D.y + 0.47, 0.22, 0.045) * Math.max(0, D.z);
    c.lerp(lipC, clamp(lipZone * 1.5, 0, 1) * 0.6);
    return c;
  };
  sphere(acc, 40, 48, headPos, headColor, headSkin);
  // nose
  const noseTop = new THREE.Vector3(0, eyeY - hd.ry * 0.05, hc.z + hd.rz * 0.86);
  const noseQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.32);
  ellipsoid(acc, new THREE.Vector3(0, eyeY - hd.ry * 0.22, hc.z + hd.rz * 0.9), [hd.rx * 0.11 * face.noseW, hd.ry * 0.21 * face.nose, hd.rz * 0.12 * face.nose],
    (P) => skin.clone().lerp(C('#e39a88'), 0.12), 2, { quat: noseQ, lat: 10, lon: 12 });
  ellipsoid(acc, new THREE.Vector3(0, eyeY - hd.ry * 0.36 * face.nose, hc.z + hd.rz * (0.95 + 0.06 * face.nose)), [hd.rx * 0.13 * face.noseW, hd.ry * 0.075, hd.rz * 0.1],
    (P) => skin.clone().lerp(C('#e39a88'), 0.2), 2, { lat: 8, lon: 10 });
  for (const s of [-1, 1]) ellipsoid(acc, new THREE.Vector3(s * hd.rx * 0.12 * face.noseW, eyeY - hd.ry * 0.38 * face.nose, hc.z + hd.rz * 0.92), [hd.rx * 0.075, hd.ry * 0.055, hd.rz * 0.07], skin.clone().multiplyScalar(0.97), 2, { lat: 6, lon: 8 });
  // lips: upper on head, lower on jaw; dark mouth cavity behind
  ellipsoid(acc, new THREE.Vector3(0, mouthY - hd.ry * 0.01, hc.z + hd.rz * 0.83), [hd.rx * 0.3, hd.ry * 0.1, hd.rz * 0.1], C('#2a0f0f'), 2, { lat: 6, lon: 10 });
  ellipsoid(acc, new THREE.Vector3(0, mouthY + hd.ry * 0.025, hc.z + hd.rz * 0.9), [hd.rx * 0.27 * face.lips, hd.ry * 0.035 * face.lips, hd.rz * 0.06], lipC, 2, { lat: 6, lon: 12 });
  ellipsoid(acc, new THREE.Vector3(0, mouthY - hd.ry * 0.045, hc.z + hd.rz * 0.885), [hd.rx * 0.25 * face.lips, hd.ry * 0.042 * face.lips, hd.rz * 0.065], lipC.clone().multiplyScalar(1.05), 11, { lat: 6, lon: 12 });
  // teeth hint
  ellipsoid(acc, new THREE.Vector3(0, mouthY - hd.ry * 0.005, hc.z + hd.rz * 0.84), [hd.rx * 0.2, hd.ry * 0.03, hd.rz * 0.05], C('#f2efe6'), 2, { lat: 4, lon: 8 });
  // ears
  for (const s of [-1, 1]) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * 0.35, s * -0.12));
    ellipsoid(acc, new THREE.Vector3(s * hd.rx * 0.97, hc.y - hd.ry * 0.02, hc.z - hd.rz * 0.08), [hd.rx * 0.08, hd.ry * 0.26 * face.ears, hd.rz * 0.18 * face.ears],
      (P, D) => skin.clone().lerp(C('#e8958a'), 0.2).multiplyScalar(D.x * s > 0.3 ? 0.9 : 1), 2, { quat: q, lat: 8, lon: 10 });
  }
  // eyebrows on brow bone
  const browC = C(spec.browColor || spec.hair?.color || '#3a2a1a');
  for (const s of [-1, 1]) for (let k = 0; k < 6; k++) {
    const t = k / 5; const bx = s * (eyeX * 0.45 + t * eyeX * 1.05);
    const by = eyeY + hd.ry * (0.17 + Math.sin(t * Math.PI) * 0.04 - t * 0.02);
    const bz = hc.z + hd.rz * (0.93 - t * t * 0.22);
    ellipsoid(acc, new THREE.Vector3(bx, by, bz), [hd.rx * 0.085, hd.ry * (d.female ? 0.016 : 0.024) * (1 - t * 0.4), hd.rz * 0.03], browC, 15, { lat: 4, lon: 6 });
  }
  // eyes (separate glossy group) with eyelids
  const eyeR = Math.max(0.0115, H * 0.0068) * (d.kind === 'toddler' ? 1.05 : d.kind === 'baby' ? 1.1 : 1);
  const irisC = C(spec.eyes || '#5a3a20');
  for (const s of [1, -1]) {
    const bi = s > 0 ? 12 : 13; const li = s > 0 ? 16 : 17;
    // find socket depth: sample head surface at that direction
    const D = new THREE.Vector3((s * eyeX) / hd.rx, (eyeY - hc.y) / hd.ry, 0); D.z = Math.sqrt(Math.max(0, 1 - D.x * D.x - D.y * D.y)); D.normalize();
    const surf = headPos(D);
    const ec = new THREE.Vector3(s * eyeX, eyeY, surf.z - eyeR * 0.45);
    O[bi].copy(ec); O[li].copy(ec);
    sphere(acc, 12, 16, (D2) => D2.clone().multiplyScalar(eyeR).add(ec), (P, D2) => {
      if (D2.z > 0.93) return C('#050505');
      if (D2.z > 0.8) { const n = noise3(P.x * 3000, P.y * 3000, 0); return irisC.clone().multiplyScalar(0.7 + n * 0.6 + (D2.z > 0.9 ? -0.25 : 0)); }
      if (D2.z > 0.76) return irisC.clone().multiplyScalar(0.4);
      return C('#f3efe8').lerp(C('#e9c0b8'), D2.z < 0.3 ? 0.3 : 0);
    }, () => [bi, bi, 1], { group: 2 });
    // upper eyelid: top cap of slightly bigger sphere
    sphere(acc, 10, 16, (D2) => D2.clone().multiplyScalar(eyeR * 1.12).add(ec), () => skin.clone().multiplyScalar(0.93), () => [li, li, 1],
      { include: (D2) => D2.y > 0.25 || (D2.z < -0.1), strict: true });
    // lower lid ridge
    ellipsoid(acc, ec.clone().add(new THREE.Vector3(0, -eyeR * 0.85, eyeR * 0.35)), [eyeR * 1.15, eyeR * 0.3, eyeR * 0.6], skin.clone().multiplyScalar(0.95), 2, { lat: 4, lon: 8 });
    // lashes line (dark) on lid
    ellipsoid(acc, ec.clone().add(new THREE.Vector3(0, eyeR * 0.3, eyeR * 0.95)), [eyeR * 1.0, eyeR * 0.08, eyeR * 0.12], C(d.female ? '#111' : '#2a1d14'), li, { lat: 3, lon: 8 });
  }
  // ---- Hair ----
  buildHair(acc, spec, d, hc, headPos, rnd);
  // ---- Arms ----
  for (const s of [1, -1]) buildArm(acc, spec, d, s, skin, O);
  // ---- Legs ----
  for (const s of [1, -1]) buildLeg(acc, spec, d, s, skin, O);
  // ---- Outfit extras merged into the body ----
  buildOutfitExtras(acc, spec, d, O);

  const geo = acc.build();
  // finalize bones
  const root = new THREE.Group(); root.name = spec.name;
  const bones = BONES.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  for (let i = 0; i < bones.length; i++) {
    const p = PARENT[i];
    if (i < PART_COUNT) { root.add(bones[i]); bones[i].position.copy(O[i]); }
    else { bones[p].add(bones[i]); bones[i].position.copy(O[i]).sub(O[p]); }
  }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const knit = spec._knitTex || null;
  const mats = [
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, bumpMap: knit, bumpScale: 0.6 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0 }),
  ];
  const mesh = new THREE.SkinnedMesh(geo, mats);
  mesh.frustumCulled = false; mesh.castShadow = true;
  root.add(mesh);
  mesh.bind(skeleton);
  return { root, mesh, bones, skeleton, dims: d, origins: O, eyeR, mats, tris: geo.index.count / 3 };
}

// ---------- hair ----------
function buildHair(acc, spec, d, hc, headPos, rnd) {
  const hair = spec.hair || { style: 'short', color: '#3a2a1a' };
  const H = d.H, hd = d.head;
  const base = C(hair.color);
  const tip = C(hair.tip || hair.color);
  const root = C(hair.root || hair.color);
  const style = hair.style;
  // hairline threshold as a function of longitude (0 = front)
  const line = (D) => {
    const ph = Math.atan2(D.x, D.z); const a = Math.abs(ph);
    let th;
    if (a < 0.9) th = 0.52 - (hair.recede || 0) * 0.2 + a * 0.05 - (style === 'long' || style === 'curly' ? 0.06 : 0);
    else if (a < 1.75) th = 0.57 - (a - 0.9) * 0.45; // above the ear
    else th = 0.18 - (a - 1.75) * 0.55;              // nape
    if (style === 'messy' || style === 'wispy') th += 0.05;
    return th;
  };
  const thick = { short: 0.016, tuck: 0.03, long: 0.022, curly: 0.035, messy: 0.03, wispy: 0.008, cap: 0.025, wig: 0.03 }[style] ?? 0.016;
  const nscale = style === 'messy' ? 25 : 60;
  const hairCol = (P, D, f) => {
    const n = noise3(P.x * 500, P.y * 200, P.z * 500);
    return lerpC(root, base, 0.5 + (D.y - 0.3)).multiplyScalar(0.8 + n * 0.4);
  };
  sphere(acc, 30, 40, (D) => {
    const th = line(D);
    const f = smooth(clamp((D.y - th) / 0.12, 0, 1));
    const p = headPos(D);
    const n = noise3(D.x * nscale, D.y * nscale, D.z * nscale);
    let t = thick * H / 1.8 * (0.75 + n * 0.5);
    if (style === 'messy') t *= 1 + Math.max(0, n - 0.45) * 3.5 * Math.max(0, D.y);
    if (style === 'tuck' && Math.abs(D.x) > 0.5 && D.y < 0.5) t *= 1.5;
    const dir = p.clone().sub(hc).normalize();
    return p.add(dir.multiplyScalar(t * f + 0.0008));
  }, (P, D) => hairCol(P, D), (P, D) => [2, 2, 1], { include: (D) => D.y > line(D) - 0.02, group: 1 });
  // eyebrow-colour sideburns for men
  if (!d.female && d.kind !== 'toddler' && d.kind !== 'baby' && style !== 'cap') {
    for (const s of [-1, 1]) ellipsoid(acc, new THREE.Vector3(s * hd.rx * 0.93, hc.y + hd.ry * 0.05, hc.z + hd.rz * 0.12), [hd.rx * 0.08, hd.ry * 0.17, hd.rz * 0.1], base.clone().multiplyScalar(0.85), 2, { lat: 4, lon: 6 });
  }
  if (style === 'tuck') {
    // longer side strands tucked behind ears
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) {
      const pts = [];
      for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector3(s * hd.rx * (0.85 + t * 0.25), hc.y + hd.ry * (0.55 - t * 0.6), hc.z + hd.rz * (0.3 - t * 0.55 - k * 0.06))); }
      card(acc, pts, 0.012 * H / 1.8, base, base.clone().multiplyScalar(1.1), (i) => [2, 2, 1], new THREE.Vector3(s, 0, 0));
    }
  }
  if (style === 'long' || style === 'curly' || style === 'wig') {
    const len = (hair.length || 0.32) * (H / 1.65);
    const n = style === 'curly' ? 40 : 32;
    for (let layer = 0; layer < 2; layer++) for (let k = 0; k < n; k++) {
      const u = k / (n - 1);
      const ph = (-1.25 + u * 2.5) + Math.PI + (rnd() - 0.5) * 0.06; // around the back, from left-front to right-front
      const sinp = Math.sin(ph), cosp = Math.cos(ph);
      const frontSide = Math.abs(Math.atan2(sinp, cosp)) < 1.9; // cards near the face
      const rootY = 0.35 + rnd() * 0.25;
      const pts = [];
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        // follow scalp down to the head's lower half, then fall vertically and drape over shoulders/back
        const scalpT = Math.min(1, t / 0.35);
        const dy = rootY - scalpT * (rootY + 0.25);
        const dxz = Math.sqrt(Math.max(0, 1 - dy * dy));
        const D = new THREE.Vector3(sinp * dxz, dy, cosp * dxz).normalize();
        const p = headPos(D);
        const outward = p.clone().sub(hc).setY(0).normalize();
        p.add(p.clone().sub(hc).normalize().multiplyScalar((thick + 0.006 + layer * 0.006) * H / 1.8));
        if (t > 0.35) {
          const ft = (t - 0.35) / 0.65;
          p.y -= ft * len;
          // flare out over shoulders/back
          p.add(outward.clone().multiplyScalar(ft * 0.022 * H / 1.65));
          if (style === 'curly') { const w = Math.sin(ft * 18 + k) * 0.012 * H / 1.65; p.add(outward.clone().multiplyScalar(w)); p.x += Math.cos(ft * 18 + k) * 0.006; }
          // push out of torso
          const pr = torsoProfile(d, spec, p.y / H);
          if (p.y < d.p.neck * H + 0.03 * H && p.y > (d.p.hip) * H) {
            const ex = p.x / (pr.rx + 0.012 * H), ez = (p.z - pr.zo) / (pr.rz + 0.012 * H);
            const r = Math.hypot(ex, ez);
            if (r < 1) { p.x /= r; p.z = pr.zo + (p.z - pr.zo) / r; }
            // over shoulders: lift slightly where shoulders are
            if (Math.abs(p.x) > d.shoulderHalf * 0.5 && p.y < d.p.shoulder * H + 0.02 * H) {
              const sh = d.p.shoulder * H + 0.012 * H;
              if (p.y < sh && Math.abs(p.z) < pr.rz * 0.9 && Math.abs(p.x) < d.armX + d.armR) p.z = Math.sign(p.z || -1) * (pr.rz * 0.95 + 0.01 * H);
            }
          }
        }
        pts.push(p);
      }
      const nrm = new THREE.Vector3(sinp, 0, cosp);
      const w = (style === 'curly' ? 0.05 : 0.045) * H / 1.65 * (0.85 + rnd() * 0.3);
      card(acc, pts, w, root.clone().lerp(base, 0.3), tip, (i, P) => {
        const t = i / steps; if (t < 0.3) return [2, 2, 1];
        return [14, 2, smooth(clamp((t - 0.3) / 0.4, 0, 1))];
      }, nrm, layer === 0 ? 0.9 : 1.05);
    }
    // solid hair mass behind the cards so long hair reads as volume, not strands
    {
      const AS = 16, LS = 14; const base0 = acc.pos.length / 3;
      const topY = hc.y + hd.ry * 0.2, botY = hc.y - hd.ry * 0.3 - len * 0.95;
      for (let i = 0; i <= LS; i++) {
        const t = i / LS; const y = topY + (botY - topY) * t;
        for (let j = 0; j <= AS; j++) {
          const a = Math.PI + (-1.15 + 2.3 * j / AS); // around the back
          let rx, rz, cz;
          const dyH = (y - hc.y) / hd.ry;
          if (dyH > -0.55) { const k2 = Math.sqrt(Math.max(0.15, 1 - dyH * dyH)); rx = hd.rx * k2 * 1.08 + 0.012; rz = hd.rz * k2 * 1.08 + 0.012; cz = hc.z; }
          else { const pr = torsoProfile(d, spec, clamp(y / H, d.p.hip, d.p.neck - 0.02)); const nk = clamp((y - (d.p.neck - 0.02) * H) / (hc.y - hd.ry * 0.55 - (d.p.neck - 0.02) * H), 0, 1);
            rx = Math.max(hd.rx * 0.75, pr.rx * (1 - nk) + hd.rx * 0.9 * nk) + 0.012 * H / 1.65; rz = (pr.rz * (1 - nk) + hd.rz * 0.6 * nk) + 0.016 * H / 1.65; cz = pr.zo * (1 - nk) + hc.z * nk; }
          if (style === 'curly') { rx += 0.01; rz += 0.012; }
          const x = Math.sin(a) * rx * (1 - t * 0.15), z = cz + Math.cos(a) * rz;
          const n = noise3(x * 300, y * 60, z * 300);
          const c = root.clone().lerp(tip, t).multiplyScalar(0.72 + n * 0.3);
          const w = t < 0.25 ? 1 : smooth(clamp((t - 0.25) / 0.35, 0, 1));
          acc.v(x, y, z, c, t < 0.25 ? 2 : 14, 2, w);
        }
      }
      for (let i = 0; i < LS; i++) for (let j = 0; j < AS; j++) { const a = base0 + i * (AS + 1) + j, b = a + 1, c = a + AS + 1, dd = c + 1; acc.t(a, b, c, 1); acc.t(b, dd, c, 1); }
    }
    // fringe/side-swept front for some
    if (hair.fringe) for (let k = 0; k < 9; k++) {
      const pts = []; const x0 = -0.6 + k * 0.15;
      for (let i = 0; i <= 5; i++) { const t = i / 5; const D = new THREE.Vector3(x0 + t * 0.15, 0.85 - t * 0.5, 0); D.z = Math.sqrt(Math.max(0.02, 1 - D.x * D.x - D.y * D.y)); D.normalize(); const p = headPos(D); p.add(p.clone().sub(hc).normalize().multiplyScalar(0.012 * H / 1.65)); pts.push(p); }
      card(acc, pts, 0.03 * H / 1.65, base, tip, () => [2, 2, 1], new THREE.Vector3(0, 0, 1));
    }
  }
}
// a hair card: strip of 3 verts across along a polyline
function card(acc, pts, width, c0, c1, skinFn, outward, shade = 1) {
  const base = acc.pos.length / 3; const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i]; const tgt = (i < n - 1 ? pts[i + 1].clone().sub(p) : p.clone().sub(pts[i - 1])).normalize();
    const side = new THREE.Vector3().crossVectors(tgt, outward).normalize();
    if (side.lengthSq() < 0.1) side.set(1, 0, 0);
    const t = i / (n - 1);
    const c = c0.clone().lerp(c1, t).multiplyScalar(shade);
    const wv = width * (1 - t * 0.35);
    for (let k = -1; k <= 1; k++) {
      const q = p.clone().add(side.clone().multiplyScalar(k * wv * 0.5)).add(outward.clone().multiplyScalar(k === 0 ? 0.002 : 0));
      const cc = k === 0 ? c.clone().multiplyScalar(1.12) : c.clone().multiplyScalar(0.9);
      const sk = skinFn(i, q);
      acc.v(q.x, q.y, q.z, cc, sk[0], sk[1], sk[2]);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < 2; k++) {
    const a = base + i * 3 + k, b = a + 1, c = a + 3, dd = c + 1;
    acc.t(a, c, b, 1); acc.t(b, c, dd, 1);
  }
}

// ---------- arms ----------
function buildArm(acc, spec, d, s, skin, O) {
  const H = d.H; const ub = s > 0 ? 3 : 5, lb = s > 0 ? 4 : 6;
  const sh = O[ub], el = O[lb];
  const r = d.armR;
  const sleeve = spec.top?.sleeves ?? 'long';
  const isSkinTop = ['mankini', 'speedo'].includes(spec.top?.pattern);
  const rings = [];
  const wrist = d.wristY;
  const handTop = wrist - 0.005 * H;
  const N = 18;
  for (let i = 0; i <= N; i++) {
    const t = i / N; const y = sh.y + r * 0.1 + (handTop - sh.y - r * 0.1) * t;
    let rr = r;
    const ut = (sh.y - y) / (sh.y - el.y);
    if (y > el.y) rr = r * (1.02 - 0.15 * ut + 0.1 * Math.sin(ut * Math.PI) * (d.kind === 'bigger' ? 1.3 : 1));
    else { const ft = (el.y - y) / (el.y - wrist); rr = r * (0.9 - 0.22 * ft + 0.08 * Math.sin(ft * Math.PI)); }
    if (i === 0) rr *= 0.8;
    const sleeveEnd = sleeve === 'short' ? el.y + 0.06 * H : wrist + 0.012 * H;
    if (!isSkinTop && y > sleeveEnd) rr *= 1.1; // jumper thickness
    rings.push({ c: [sh.x + s * (0.003 * H) * t, y, 0], rx: rr, rz: rr * 1.02 });
  }
  loft(acc, rings, 16, (i, a, P) => {
    const sleeveEnd = sleeve === 'short' ? el.y + 0.06 * H : wrist + 0.012 * H;
    if (isSkinTop || P.y < sleeveEnd) return skin;
    if (P.y < sleeveEnd + 0.03 * H && spec.top?.pattern !== 'santa') return jumperColor(spec, d, P, 'cuff');
    if (spec.top?.pattern === 'santa' && P.y < sleeveEnd + 0.02 * H) return C('#f4f4f4');
    if (spec.top?.armColor) return C(spec.top.armColor);
    return jumperColor(spec, d, P, 'arm');
  }, (P) => {
    if (P.y > sh.y - 0.02 * H) return [ub, 1, 0.65 + 0.35 * clamp((sh.y - P.y) / (0.02 * H), 0, 1)];
    const de = P.y - el.y;
    if (Math.abs(de) < 0.035 * H) { const w = smooth(clamp(0.5 + de / (0.07 * H), 0, 1)); return [ub, lb, w]; }
    return de > 0 ? [ub, ub, 1] : [lb, lb, 1];
  }, { capStart: true });
  // hand (palm faces inwards toward the body, fingers point down, thumb forward)
  const hx = sh.x + s * 0.003 * H, hy = handTop;
  const hw = (d.female ? 0.037 : 0.042) * H / 1.8 * (d.kind === 'bigger' ? 1.12 : 1) * (d.kind === 'toddler' || d.kind === 'baby' ? 1.3 : 1);
  const hl = hw * 2.2;
  const palm = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; palm.push({ c: [hx, hy - t * hl, 0.003 * H], ax: [1, 0, 0], az: [0, 0, 1], rx: hw * 0.3 * (1 - 0.15 * Math.abs(t - 0.5)), rz: hw * (0.85 + 0.12 * Math.sin(t * Math.PI)) * (i === 0 ? 0.7 : 1) }); }
  loft(acc, palm, 12, () => skin, () => [lb, lb, 1], { capEnd: true });
  const fingerLen = [0.92, 1.0, 0.95, 0.75];
  for (let f = 0; f < 4; f++) {
    const fz = 0.003 * H + hw * (0.66 - f * 0.44);
    const L = hw * 1.75 * fingerLen[f];
    const fr = hw * 0.19;
    const fr2 = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5; const curl = t * t * 0.5 * (spec.curl ?? 1);
      fr2.push({ c: [hx - s * Math.sin(curl) * L * 0.4 * t, hy - hl * 0.92 - Math.cos(curl * 0.6) * L * t, fz + (f - 1.5) * -0.0015], rx: fr * (1 - t * 0.25), rz: fr * (1 - t * 0.2) });
    }
    loft(acc, fr2, 8, (i) => i === 5 ? skin.clone().lerp(C('#f3d0c8'), 0.4) : skin, () => [lb, lb, 1], { capEnd: true, capStart: true });
  }
  // thumb
  const th = [];
  for (let i = 0; i <= 5; i++) { const t = i / 5; th.push({ c: [hx - s * hw * 0.25 * t, hy - hl * 0.2 - t * hl * 0.5, 0.003 * H + hw * 0.85 + t * hw * 0.3], rx: hw * 0.22 * (1 - t * 0.2), rz: hw * 0.22 }); }
  loft(acc, th, 8, () => skin, () => [lb, lb, 1], { capEnd: true });
}

// ---------- legs ----------
function buildLeg(acc, spec, d, s, skin, O) {
  const H = d.H; const tb = s > 0 ? 7 : 9, sb = s > 0 ? 8 : 10;
  const hip = O[tb], knee = O[sb];
  const ankleY = d.p.ankle * H;
  const r = d.legR;
  const rings = [];
  const N = 22;
  const top = hip.y + 0.045 * H;
  for (let i = 0; i <= N; i++) {
    const t = i / N; const y = top + (ankleY + 0.01 * H - top) * t;
    let rx, rz;
    if (y > knee.y) { const u = (top - y) / (top - knee.y); rx = r * (1.02 - 0.38 * u); rz = r * (1.08 - 0.38 * u); }
    else { const u = (knee.y - y) / (knee.y - ankleY); const calf = Math.sin(clamp(u * 1.6, 0, Math.PI)) * 0.18; rx = r * (0.62 - 0.3 * u + calf * 0.6); rz = r * (0.66 - 0.28 * u + calf); }
    if (spec.legs?.type === 'jeans' || spec.legs?.type === 'trousers') { rx *= 1.06; rz *= 1.06; if (y < knee.y) { rx = Math.max(rx, r * 0.55); rz = Math.max(rz, r * 0.58); } }
    if (spec.inflateLegs) { rx *= spec.inflateLegs; rz *= spec.inflateLegs; }
    rings.push({ c: [hip.x + s * 0.002 * H * t, y, (y > knee.y ? 0.004 : -0.004) * H], rx, rz });
  }
  loft(acc, rings, 16, (i, a, P) => legColor(spec, d, P), (P) => {
    if (P.y > hip.y - 0.03 * H) return [tb, 0, smooth(clamp((hip.y + 0.04 * H - P.y) / (0.07 * H), 0, 1))];
    const dk = P.y - knee.y;
    if (Math.abs(dk) < 0.03 * H) return [tb, sb, smooth(clamp(0.5 + dk / (0.06 * H), 0, 1))];
    return dk > 0 ? [tb, tb, 1] : [sb, sb, 1];
  }, {});
  // foot: socks (house rule: no shoes) — festive sock colours
  const sockC = C(spec.socks || '#b02020'); const sock2 = C(spec.socks2 || '#f0f0f0');
  const fl = (d.kind === 'toddler' ? 0.15 : d.kind === 'baby' ? 0.16 : 0.145) * H * (d.female ? 0.95 : 1);
  const fw = r * 0.62;
  const foot = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10; const z = -fl * 0.22 + t * fl;
    const h = (t < 0.35 ? 0.055 : 0.055 - (t - 0.35) * 0.06) * H;
    foot.push({ c: [hip.x + s * 0.004 * H * t, ankleY * 0.5 + h * 0.3, z], ax: [1, 0, 0], az: [0, 1, 0], ay: [0, 0, 1], rx: fw * (0.75 + 0.35 * Math.sin(t * Math.PI * 0.8)) * (i === 0 || i === 10 ? 0.6 : 1), rz: Math.max(0.012, h * 0.55) * (i === 0 || i === 10 ? 0.6 : 1) });
  }
  const isBare = spec.legs?.type === 'skin' && spec.bareFeet;
  loft(acc, foot, 14, (i, a, P) => {
    if (isBare) return skin;
    if (spec.legs?.type === 'onesie') return C(spec.legs.c1).multiplyScalar(0.85);
    const band = Math.floor((P.z + 1) * 40) % 3 === 0;
    return (i > 7 || i < 2) ? sock2 : (band && spec.socksStripe ? sock2 : sockC);
  }, () => [sb, sb, 1], { capStart: true, capEnd: true, flip: true });
  // ankle bridge
  const ank = []; for (let i = 0; i <= 3; i++) ank.push({ c: [hip.x, ankleY + 0.03 * H - i * 0.014 * H, -0.004 * H], rx: r * 0.42, rz: r * 0.48 });
  loft(acc, ank, 12, () => spec.legs?.type === 'onesie' ? C(spec.legs.c1) : (isBare ? skin : sockC), () => [sb, sb, 1]);
}

// ---------- costume geometry ----------
function buildOutfitExtras(acc, spec, d, O) {
  const H = d.H; const top = spec.top || {};
  if (top.pattern === 'dino') { // spikes down the back + hood with eyes
    for (let i = 0; i < 7; i++) { const y = d.p.hip * H + i * 0.045 * H; const pr = torsoProfile(d, spec, y / H); const c = new THREE.Vector3(0, y, pr.zo - pr.rz - 0.005 * H);
      ellipsoid(acc, c, [0.008 * H, 0.025 * H, 0.03 * H], C('#e0a020'), y > d.p.waist * H ? 1 : 0, { lat: 4, lon: 6 }); }
  }
  if (top.pattern === 'sumo') { // inflatable belt/mawashi
    const rr = []; for (let i = 0; i <= 3; i++) { const y = d.p.hip * H - 0.02 * H + i * 0.03 * H; const pr = torsoProfile(d, spec, y / H); rr.push({ c: [0, y, pr.zo], rx: pr.rx * 1.04, rz: pr.rz * 1.04 }); }
    loft(acc, rr, 32, () => C('#1d1d6b'), () => [0, 0, 1]);
  }
  if (top.pattern === 'turkey') { // tail fan
    for (let k = 0; k < 9; k++) { const a = -1.1 + k * 0.275; const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, 0, a));
      const c = new THREE.Vector3(Math.sin(a) * 0.16 * H, d.p.waist * H + Math.cos(a) * 0.16 * H, -0.12 * H * d.wMul);
      ellipsoid(acc, c, [0.035 * H, 0.13 * H, 0.008 * H], k % 2 ? C('#8a5a2a') : C('#c08040'), 1, { quat: q, lat: 6, lon: 8 }); }
  }
  if (top.pattern === 'xmastree') { // cone skirt with baubles
    const rr = []; for (let i = 0; i <= 10; i++) { const t = i / 10; const y = d.p.knee * H + t * (d.p.shoulder - d.p.knee) * H; rr.push({ c: [0, y, 0], rx: (0.2 - t * 0.14) * H, rz: (0.2 - t * 0.14) * H }); }
    loft(acc, rr, 28, (i, a, P) => { const n = noise3(P.x * 80, P.y * 80, P.z * 80); if (n > 0.78) return [C('#ff2020'), C('#ffd700'), C('#2080ff')][Math.floor(n * 100) % 3]; return lerpC(C('#174d1f'), C('#2f7a2a'), n); }, (P) => P.y > d.p.waist * H ? [1, 1, 1] : [0, 0, 1], { capStart: true });
  }
  if (top.pattern === 'mrsclaus') { // skirt
    const rr = []; for (let i = 0; i <= 8; i++) { const t = i / 8; const y = d.p.waist * H - t * (d.p.waist - d.p.knee + 0.03) * H; const pr = torsoProfile(d, spec, d.p.waist); rr.push({ c: [0, y, pr.zo], rx: pr.rx * (1.05 + t * 0.6), rz: pr.rz * (1.05 + t * 0.6) }); }
    loft(acc, rr, 28, (i) => i > 6 ? C('#f4f4f4') : C('#b81a24'), () => [0, 0, 1]);
  }
  if (top.pattern === 'donkey') { // back half of a donkey costume
    const c = new THREE.Vector3(0, d.p.hip * H, -0.25 * H);
    ellipsoid(acc, c, [0.13 * H, 0.12 * H, 0.22 * H], (P) => lerpC(C('#6e6258'), C('#8b7d70'), noise3(P.x * 90, P.y * 90, P.z * 90)), 0, { lat: 10, lon: 14 });
    ellipsoid(acc, new THREE.Vector3(0, d.p.hip * H, -0.48 * H), [0.015 * H, 0.1 * H, 0.015 * H], C('#3a302a'), 0, { quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 0, 0)), lat: 4, lon: 6 });
  }
  if (top.pattern === 'trex') { // tail
    for (let i = 0; i < 6; i++) ellipsoid(acc, new THREE.Vector3(0, d.p.hip * H - i * 0.03 * H, -0.15 * H - i * 0.08 * H), [0.09 * H * (1 - i * 0.14), 0.08 * H * (1 - i * 0.14), 0.07 * H], C('#4a9a42'), 0, { lat: 8, lon: 10 });
  }
  if (top.pattern === 'elf' || top.hat === 'elf') { // pointy hat
    const hc = new THREE.Vector3(0, d.head.cy + d.head.ry * 0.6, d.head.cz - 0.01 * H);
    const rr = []; for (let i = 0; i <= 8; i++) { const t = i / 8; rr.push({ c: [0, hc.y + t * 0.16 * H, hc.z - t * t * 0.08 * H], rx: d.head.rx * 1.08 * (1 - t), rz: d.head.rz * 1.08 * (1 - t) }); }
    loft(acc, rr, 16, (i) => i === 0 ? C('#ffffff') : C('#1f8a3a'), () => [2, 2, 1], {});
    ellipsoid(acc, new THREE.Vector3(0, hc.y + 0.16 * H, hc.z - 0.08 * H), [0.015 * H, 0.015 * H, 0.015 * H], C('#f4f4f4'), 2);
  }
  if (top.hat === 'swimcap') {
    ellipsoid(acc, new THREE.Vector3(0, d.head.cy + d.head.ry * 0.12, d.head.cz - 0.002 * H), [d.head.rx * 1.07, d.head.ry * 0.95, d.head.rz * 1.07], C('#f4f4f4'), 2, { lat: 12, lon: 16 });
  }
  if (top.hat === 'santa') {
    const hc = new THREE.Vector3(0, d.head.cy + d.head.ry * 0.55, d.head.cz);
    const rr = []; for (let i = 0; i <= 8; i++) { const t = i / 8; rr.push({ c: [t * 0.06 * H, hc.y + Math.sin(t * 1.4) * 0.12 * H, hc.z - t * 0.05 * H], rx: d.head.rx * 1.1 * (1 - t * 0.9), rz: d.head.rz * 1.1 * (1 - t * 0.9) }); }
    loft(acc, rr, 16, (i) => i === 0 ? C('#ffffff') : C('#c41e1e'), () => [2, 2, 1]);
  }
  if (top.hood === 'bluey') { // Bluey hood: blue head with darker cap, tall pointy ears (tan inside), tan muzzle patch, and a tail
    const hc = new THREE.Vector3(0, d.head.cy + d.head.ry * 0.25, d.head.cz - 0.01 * H);
    sphere(acc, 14, 20, (D) => new THREE.Vector3(D.x * d.head.rx * 1.26, D.y * d.head.ry * 1.2, D.z * d.head.rz * 1.24).add(hc), (P, D) => C(D.y > 0.5 ? '#2f4f8f' : '#6fa8dc'), () => [2, 2, 1], { include: (D) => D.z < 0.3 || D.y > 0.55 });
    for (const s of [-1, 1]) { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -s * 0.28));
      ellipsoid(acc, new THREE.Vector3(s * d.head.rx * 0.62, hc.y + d.head.ry * 1.2, hc.z), [0.03 * H, 0.085 * H, 0.012 * H], C('#2f4f8f'), 2, { quat: q, lat: 6, lon: 8 });
      ellipsoid(acc, new THREE.Vector3(s * d.head.rx * 0.6, hc.y + d.head.ry * 1.15, hc.z + 0.008 * H), [0.018 * H, 0.06 * H, 0.006 * H], C('#e8c890'), 2, { quat: q, lat: 6, lon: 8 }); }
    ellipsoid(acc, new THREE.Vector3(0, hc.y + d.head.ry * 0.9, hc.z + d.head.rz * 0.75), [0.045 * H, 0.016 * H, 0.012 * H], C('#f0d8a8'), 2); // the tan brow patch on the hood front
    ellipsoid(acc, new THREE.Vector3(0, d.p.hip * H, -0.1 * H * d.wMul), [0.025 * H, 0.025 * H, 0.09 * H], C('#6fa8dc'), 0, { quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.6, 0, 0)), lat: 6, lon: 8 }); // tail
    ellipsoid(acc, new THREE.Vector3(0, d.p.hip * H - 0.055 * H, -0.165 * H * d.wMul), [0.02 * H, 0.02 * H, 0.03 * H], C('#2f4f8f'), 0); // tail tip
  }
  if (top.hood === 'dino') { // dinosaur hood with eyes on toddler
    const hc = new THREE.Vector3(0, d.head.cy + d.head.ry * 0.25, d.head.cz - 0.01 * H);
    sphere(acc, 14, 20, (D) => new THREE.Vector3(D.x * d.head.rx * 1.18, D.y * d.head.ry * 1.12, D.z * d.head.rz * 1.15).add(hc), () => C('#3f9a3a'), () => [2, 2, 1], { include: (D) => D.z < 0.25 || D.y > 0.55, strict: true });
    for (const s of [-1, 1]) ellipsoid(acc, new THREE.Vector3(s * d.head.rx * 0.45, hc.y + d.head.ry * 0.95, hc.z + d.head.rz * 0.45), [0.012 * H, 0.012 * H, 0.012 * H], C('#ffffff'), 2);
    for (let i = 0; i < 4; i++) ellipsoid(acc, new THREE.Vector3(0, hc.y + d.head.ry * (1.0 - i * 0.35), hc.z - d.head.rz * (0.3 + i * 0.3)), [0.006 * H, 0.03 * H, 0.025 * H], C('#e0a020'), 2, { lat: 4, lon: 6 });
  }
}
