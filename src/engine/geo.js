// Geometry helpers: world-scaled UV boxes, vertex-coloured primitive builder for props.
import * as THREE from 'three';
import { mergeGeometries } from '../../lib/addons/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from '../../lib/addons/RoundedBoxGeometry.js';
export { mergeGeometries, RoundedBoxGeometry };

// Box in world space with UVs = metres / texScale (so textures tile consistently)
export function uvBox(cx, cy, cz, w, h, d, texScale = 1, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(cx, cy, cz);
  worldUV(g, texScale);
  return g;
}
export function worldUV(g, s = 1) {
  const p = g.attributes.position, n = g.attributes.normal; const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ny > 0.5) uv.setXY(i, x / s, z / s); else if (nx > 0.5) uv.setXY(i, z / s, y / s); else uv.setXY(i, x / s, y / s);
  }
  uv.needsUpdate = true; return g;
}

// ---- Vertex-coloured prop builder: compose several primitives into one geometry ----
export class Prop {
  constructor() { this.parts = []; }
  _add(g, color, m) {
    g = g.index ? g.toNonIndexed() : g;
    if (m) g.applyMatrix4(m);
    const c = new THREE.Color(color); const n = g.attributes.position.count; const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    this.parts.push(g); return this;
  }
  M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  }
  box(w, h, d, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { return this._add(new THREE.BoxGeometry(w, h, d), color, this.M(x, y, z, rx, ry, rz)); }
  rbox(w, h, d, r, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 2) { return this._add(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)), color, this.M(x, y, z, rx, ry, rz)); }
  cyl(rt, rb, h, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 16, open = false) { return this._add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), color, this.M(x, y, z, rx, ry, rz)); }
  sph(r, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, seg = 12) { return this._add(new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.75 | 0)), color, this.M(x, y, z, 0, 0, 0, sx, sy, sz)); }
  torus(r, t, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2) { return this._add(new THREE.TorusGeometry(r, t, 8, 20, arc), color, this.M(x, y, z, rx, ry, rz)); }
  cone(r, h, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 16) { return this._add(new THREE.ConeGeometry(r, h, seg), color, this.M(x, y, z, rx, ry, rz)); }
  lathe(pts, color, x = 0, y = 0, z = 0, seg = 20) { return this._add(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg), color, this.M(x, y, z)); }
  geo(g, color, m) { return this._add(g, color, m); }
  build() { const g = mergeGeometries(this.parts, false); g.computeBoundingBox(); g.computeBoundingSphere(); return g; }
}
