// Item manager: every grabbable thing is a Rapier rigid body drawn through one InstancedMesh per type.
import * as THREE from 'three';
import { G, GR, groups, ALL, emit, on, rand, pick } from '../core.js';
import { sfx } from '../engine/audio.js';
import { CATALOG, PLACEMENTS, buildHinged } from './catalog.js';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class Items {
  constructor() {
    this.types = {}; this.instances = []; this.byType = {}; this.meshes = [];
    this.hinged = [];
    this.lastSound = new Map();
    G.items = this;
  }
  build() {
    const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    this.vcMat = vc;
    // count placements per type
    const counts = {};
    for (const pl of PLACEMENTS) counts[pl[0]] = (counts[pl[0]] || 0) + (pl[5] || 1);
    for (const id in CATALOG) {
      const def = CATALOG[id];
      const t = { id, ...def };
      t.geo = def.geo();
      t.mat = def.mat ? def.mat() : vc;
      const cap = (counts[id] || 0) + (def.extra ?? 2);
      t.mesh = new THREE.InstancedMesh(t.geo, t.mat, cap);
      t.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      t.mesh.frustumCulled = false; t.mesh.castShadow = true; t.mesh.receiveShadow = true;
      t.mesh.count = 0; t.cap = cap; t.free = []; t.mesh.visible = false;
      if (def.tints) { t.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); }
      t.mesh.userData.itemType = t;
      G.scene.add(t.mesh); this.meshes.push(t.mesh);
      this.types[id] = t; this.byType[id] = [];
    }
    for (const pl of PLACEMENTS) {
      const [id, x, y, z, yaw = 0, n = 1, dx = 0, dz = 0, dy = 0, tilt = 0] = pl;
      for (let i = 0; i < n; i++) this.spawn(id, new THREE.Vector3(x + dx * i, y + dy * i, z + dz * i), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw + (n > 1 ? rand(-0.2, 0.2) : 0), 0, 'YXZ')), { surface: true, sleep: true });
    }
    this.hinged = buildHinged();
    on('collision', (a, b) => this.onCollision(a, b));
    return this;
  }
  spawn(id, pos, quat, opts = {}) {
    const t = this.types[id]; if (!t) { console.warn('no item type', id); return null; }
    let index; t.mesh.visible = true;
    if (t.free.length) index = t.free.pop(); else { if (t.mesh.count >= t.cap) { console.warn('item cap', id); return null; } index = t.mesh.count++; }
    const R = G.R; const sh = t.shape;
    const y = pos.y + (opts.surface ? halfHeight(sh) + 0.002 : 0);
    const bd = (t.fixed ? R.RigidBodyDesc.fixed() : R.RigidBodyDesc.dynamic()).setTranslation(pos.x, y, pos.z).setRotation(quat || { x: 0, y: 0, z: 0, w: 1 })
      .setLinearDamping(t.linDamp ?? 0.05).setAngularDamping(t.angDamp ?? 0.4).setCcdEnabled(t.mass < 2).setCanSleep(true);
    const body = G.world.createRigidBody(bd);
    const cd = colliderDesc(sh).setMass(t.mass).setFriction(t.friction ?? 0.6).setRestitution(t.bounce ?? 0.2)
      .setCollisionGroups(groups(GR.ITEM, ALL)).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);
    const collider = G.world.createCollider(cd, body);
    const inst = { type: t, id, index, body, collider, alive: true, state: {}, uses: t.uses ?? 0, name: t.name };
    G.colliderMap.set(collider.handle, { kind: 'item', ref: inst });
    if (t.tints) { const c = new THREE.Color(opts.tint || pick(t.tints)); t.mesh.setColorAt(index, c); t.mesh.instanceColor.needsUpdate = true; inst.tint = c; }
    this.instances.push(inst); this.byType[id].push(inst);
    this.syncOne(inst);
    if (t.onSpawn) t.onSpawn(inst);
    return inst;
  }
  remove(inst) {
    if (!inst.alive) return; inst.alive = false;
    G.colliderMap.delete(inst.collider.handle);
    G.world.removeRigidBody(inst.body);
    inst.type.mesh.setMatrixAt(inst.index, ZERO); inst.type.mesh.instanceMatrix.needsUpdate = true;
    inst.type.free.push(inst.index);
    this.instances.splice(this.instances.indexOf(inst), 1);
    const l = this.byType[inst.id]; l.splice(l.indexOf(inst), 1);
    emit('itemRemoved', inst);
  }
  syncOne(inst) {
    const t = inst.body.translation(), r = inst.body.rotation();
    const k = inst.held && !G.xr && G.ui?.touchMode ? 0.65 : 1; // phones: things in your hand are drawn a bit smaller so they don't fill the screen
    _m.compose(_p.set(t.x, t.y, t.z), _q.set(r.x, r.y, r.z, r.w), _s.set(k, k, k));
    inst.type.mesh.setMatrixAt(inst.index, _m); inst.type.mesh.instanceMatrix.needsUpdate = true;
  }
  update(dt) {
    for (const inst of this.instances) {
      if (inst.attached) { // e.g. baubles hanging on the tree
        const p = inst.attached(_p, _q); inst.body.setNextKinematicTranslation(p); inst.body.setNextKinematicRotation(_q);
        _m.compose(p, _q, _s.set(1, 1, 1)); inst.type.mesh.setMatrixAt(inst.index, _m); inst.type.mesh.instanceMatrix.needsUpdate = true; continue;
      }
      if (inst.body.isSleeping() && !inst.dirty) continue;
      inst.dirty = false;
      this.syncOne(inst);
      const t = inst.body.translation();
      if (t.y < -3 || Math.abs(t.x) > 40 || Math.abs(t.z) > 40) { inst.body.setTranslation({ x: 0, y: 1, z: -3 }, true); inst.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
    }
    for (const h of this.hinged) h.update?.(dt);
  }
  // Collision feedback: sounds, splats, smashes, TV hits, people getting bonked
  onCollision(a, b) {
    for (const [x, y] of [[a, b], [b, a]]) {
      if (!x || x.kind !== 'item') continue;
      const inst = x.ref; if (!inst.alive) continue;
      const v = inst.body.linvel(); const sp = Math.hypot(v.x, v.y, v.z);
      const now = G.time; const last = this.lastSound.get(inst) || 0;
      const pos = inst.body.translation();
      if (sp > 1.2 && now - last > 0.12) {
        this.lastSound.set(inst, now);
        sfx(inst.type.sound || (inst.type.mass > 5 ? 'thud' : 'tap'), pos, Math.min(1, sp / 6));
      }
      if (sp > 2.5) emit('itemImpact', inst, y, sp);
      if (inst.type.fragile && sp > (inst.type.fragile) && !inst.held) { sfx('smash', pos, 1); emit('smash', inst); this.remove(inst); return; }
      if (inst.type.splat && sp > 2.2 && !inst.held) { sfx('splat', pos, 1); emit('splat', inst, y, pos); if (inst.type.splatRemove) { this.remove(inst); return; } }
      if (inst.type.sticky && y && y.tag === 'glass' && sp > 2) { inst.body.setBodyType(G.R.RigidBodyType.Fixed, true); inst.stuck = true; emit('stuck', inst); }
    }
  }
  nearest(pos, maxD, filter) {
    let best = null, bd = maxD * maxD;
    for (const i of this.instances) { if (filter && !filter(i)) continue; const t = i.body.translation(); const d = (t.x - pos.x) ** 2 + (t.y - pos.y) ** 2 + (t.z - pos.z) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  count() { return this.instances.length; }
}

export function halfHeight(sh) {
  switch (sh[0]) { case 'box': return sh[2]; case 'ball': return sh[1]; case 'cyl': return sh[1]; case 'cap': return sh[1] + sh[2]; case 'hull': return sh[2]; }
  return 0.05;
}
export function colliderDesc(sh) {
  const R = G.R;
  switch (sh[0]) {
    case 'box': return R.ColliderDesc.cuboid(sh[1], sh[2], sh[3]);
    case 'ball': return R.ColliderDesc.ball(sh[1]);
    case 'cyl': return R.ColliderDesc.cylinder(sh[1], sh[2]);
    case 'cap': return R.ColliderDesc.capsule(sh[1], sh[2]);
    case 'rbox': return R.ColliderDesc.roundCuboid(sh[1], sh[2], sh[3], sh[4]);
  }
}
