// The Christmas tree in the bay window: a dynamic body (it WILL fall over), real-ish layered needles,
// twinkling fairy lights, baubles that hang on it until it tips, and an angel you can put back on top.
import * as THREE from 'three';
import { G, GR, groups, ALL, rand, noise3, emit } from '../core.js';
import { sfx } from '../engine/audio.js';

export function buildTree(pos) {
  const R = G.R; const H = 2.15;
  const group = new THREE.Group(); G.scene.add(group);
  // needles: stacked jagged cones with vertex-colour variation
  const geos = [];
  const layers = 8;
  for (let i = 0; i < layers; i++) {
    const t = i / layers; const r = 0.78 * (1 - t) + 0.08; const y0 = 0.35 + t * (H - 0.5); const h = 0.55 - t * 0.2;
    const g = new THREE.ConeGeometry(r, h, 28, 4, true); g.translate(0, y0 + h / 2, 0);
    const p = g.attributes.position; const col = new Float32Array(p.count * 3);
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      const n = noise3(x * 9, y * 9, z * 9); const a = Math.atan2(x, z);
      const jag = 1 + Math.sin(a * 14 + i) * 0.08 + (n - 0.5) * 0.25;
      const rr = Math.hypot(x, z); if (rr > 0.01) { p.setX(k, x * jag); p.setZ(k, z * jag); p.setY(k, y - (rr / r) * 0.06 * (Math.sin(a * 7) + 1)); }
      const c = new THREE.Color().setHSL(0.33 + n * 0.04, 0.55, 0.12 + n * 0.12 + (rr / r) * 0.05); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); geos.push(g.toNonIndexed());
  }
  const needleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  for (const g of geos) group.add(new THREE.Mesh(g, needleMat));
  // trunk + pot
  const potMat = new THREE.MeshStandardMaterial({ color: '#7a1f24', roughness: 0.5 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.32, 20), potMat); pot.position.y = 0.16; group.add(pot);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 8, 24), new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.6, roughness: 0.3 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.32; group.add(rim);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.5, 8), new THREE.MeshStandardMaterial({ color: '#4a3020' })); trunk.position.y = 0.45; group.add(trunk);
  // tinsel spiral
  const tinselPts = []; for (let i = 0; i <= 120; i++) { const t = i / 120; const y = 0.45 + t * (H - 0.6); const r = 0.82 * (1 - (y - 0.35) / (H - 0.3)) + 0.1; const a = t * Math.PI * 9; tinselPts.push(new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r)); }
  const tinsel = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tinselPts), 240, 0.018, 5), new THREE.MeshStandardMaterial({ color: '#e8c040', metalness: 0.8, roughness: 0.25, emissive: '#402800' })); group.add(tinsel);
  // fairy lights
  const NL = 90; const lg = new THREE.SphereGeometry(0.014, 6, 4);
  const lights = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ color: '#ffffff' }), NL);
  const lp = []; const m4 = new THREE.Matrix4();
  for (let i = 0; i < NL; i++) { const t = i / NL; const y = 0.45 + t * (H - 0.55); const r = 0.84 * (1 - (y - 0.35) / (H - 0.3)) + 0.12; const a = t * Math.PI * 13 + 0.6; const p = new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r); lp.push(p); m4.makeTranslation(p.x, p.y, p.z); lights.setMatrixAt(i, m4); lights.setColorAt(i, new THREE.Color('#ffcf70')); }
  group.add(lights);
  // physics: pot + trunk + cone (compound)
  const body = G.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z)); // the tree stays put
  const gr = groups(GR.ITEM, ALL);
  const c1 = G.world.createCollider(R.ColliderDesc.cylinder(0.16, 0.24).setTranslation(0, 0.16, 0).setMass(9).setCollisionGroups(gr).setFriction(0.8), body);
  const c2 = G.world.createCollider(R.ColliderDesc.cone((H - 0.35) / 2, 0.7).setTranslation(0, 0.35 + (H - 0.35) / 2, 0).setMass(6).setCollisionGroups(gr).setFriction(0.9).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS), body);
  const tree = { group, body, lights, lightPos: lp, fallen: false, baubles: [], H, upright: true, falls: 0 };
  G.colliderMap.set(c1.handle, { kind: 'tree', ref: tree }); G.colliderMap.set(c2.handle, { kind: 'tree', ref: tree });
  // baubles hang on the tree until it tips
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion();
  function hang(inst, local) {
    inst.local = local; inst.body.setBodyType(R.RigidBodyType.KinematicPositionBased, true);
    inst.attached = (outP, outQ) => { const t = body.translation(), r = body.rotation(); _q.set(r.x, r.y, r.z, r.w); outP.copy(local).applyQuaternion(_q).add(_p.set(t.x, t.y, t.z)); outQ.copy(_q); return outP; };
    inst.onTree = true; if (!tree.baubles.includes(inst)) tree.baubles.push(inst);
  }
  tree.hang = hang;
  for (let i = 0; i < 16; i++) {
    const t = 0.08 + (i / 16) * 0.82; const y = 0.5 + t * (H - 0.7); const r = 0.8 * (1 - (y - 0.35) / (H - 0.3)) + 0.12; const a = i * 2.4;
    const local = new THREE.Vector3(Math.sin(a) * r, y - 0.05, Math.cos(a) * r);
    const inst = G.items.spawn('bauble', local.clone().add(pos), null, {}); if (inst) hang(inst, local);
  }
  const star = G.items.spawn('tree_star', new THREE.Vector3(pos.x, pos.y + H + 0.05, pos.z), null, {});
  if (star) { hang(star, new THREE.Vector3(0, H + 0.06, 0)); tree.star = star; }
  tree.release = (vel) => {
    for (const b of tree.baubles) { if (!b.alive || !b.onTree) continue; b.attached = null; b.onTree = false; b.body.setBodyType(R.RigidBodyType.Dynamic, true);
      b.body.setLinvel({ x: (vel?.x || 0) + rand(-1, 1), y: rand(0, 1.5), z: (vel?.z || 0) + rand(-1, 1) }, true); }
    tree.baubles = tree.baubles.filter(b => b.onTree);
  };
  tree.knock = (dir, strength = 1) => { // a bump shakes a couple of baubles off instead of toppling it
    let n = 0; for (const b of tree.baubles.slice()) { if (n >= 2 * strength) break; if (Math.random() < 0.5) continue; b.attached = null; b.onTree = false; b.body.setBodyType(R.RigidBodyType.Dynamic, true); b.body.setLinvel({ x: dir.x * 1.5, y: 0.5, z: dir.z * 1.5 }, true); tree.baubles.splice(tree.baubles.indexOf(b), 1); n++; }
    if (n) sfx('bauble', pos, 0.6);
  };
  tree.update = (dt) => {
    const t = body.translation(), r = body.rotation();
    group.position.set(t.x, t.y, t.z); group.quaternion.set(r.x, r.y, r.z, r.w);
    const up = _p.set(0, 1, 0).applyQuaternion(group.quaternion).y;
    const wasUp = tree.upright; tree.upright = up > 0.85;
    if (up < 0.8 && tree.baubles.length) tree.release(body.linvel());
    if (wasUp && up < 0.45 && !tree.fallen) { tree.fallen = true; tree.falls++; sfx('smash', t, 0.7); sfx('bigthud', t, 1); emit('treeFell', tree); }
    if (tree.fallen && up > 0.95) { tree.fallen = false; emit('treeUp', tree); }
    // fairy lights twinkle (and go out during a power cut)
    if (G.frame % 6 === 0) {
      const off = G.systems?.powerOut; const c = new THREE.Color();
      for (let i = 0; i < NL; i++) { const tw = 0.5 + 0.5 * Math.sin(G.time * 3 + i * 1.7); c.set(['#ffcf70', '#ff5050', '#60ff80', '#70a0ff'][i % 4]).multiplyScalar(off ? 0.05 : 0.5 + tw * 0.8); lights.setColorAt(i, c); }
      lights.instanceColor.needsUpdate = true;
    }
    const L = G.house.lights.tree; if (L) { L.position.set(t.x, t.y + 1.3, t.z); L.intensity = G.systems?.powerOut ? 0 : 2.2 + Math.sin(G.time * 2) * 0.3; }
    // re-hang dropped baubles placed against an upright tree
    if (tree.upright && G.frame % 15 === 0) for (const b of G.items.byType.bauble) {
      if (b.onTree || b.held || !b.alive) continue; const bp = b.body.translation(); const lx = bp.x - t.x, ly = bp.y - t.y, lz = bp.z - t.z;
      const rr = 0.8 * (1 - (ly - 0.35) / (H - 0.3)) + 0.12; const d = Math.hypot(lx, lz);
      if (ly > 0.45 && ly < H - 0.1 && Math.abs(d - rr) < 0.12 && b.body.linvel().y < 0.5 && b.releasedRecently) { hang(b, new THREE.Vector3(lx, ly, lz).applyQuaternion(group.quaternion.clone().invert())); emit('baubleHung', b); }
    }
  };
  G.tree = tree;
  return tree;
}
