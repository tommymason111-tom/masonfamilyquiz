// Rapier wrapper: world setup, stepping, helpers for queries and the held-object spring.
import RAPIER from '../../lib/rapier.es.js';
import * as THREE from 'three';
import { G, GR, groups, ALL, emit } from '../core.js';

export async function initPhysics() {
  await RAPIER.init();
  G.R = RAPIER;
  G.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  G.world.integrationParameters.numSolverIterations = 4; // Rapier's default: nearly half the cost of 6 and still steady for the stacks and ragdolls
  G.eventQueue = new RAPIER.EventQueue(true);
  // a person's own body parts never collide with each other (scans have arms close to the hips and thighs
  // touching; self-collisions made bodies fight themselves forever = jelly). They still hit everyone else.
  G.selfOwner = new Map(); // collider handle -> person id
  G.hooks = { filterContactPair(c1, c2) { const a = G.selfOwner.get(c1); return a !== undefined && a === G.selfOwner.get(c2) ? RAPIER.SolverFlags.EMPTY : RAPIER.SolverFlags.COMPUTE_IMPULSE; }, filterIntersectionPair() { return true; } };
}

export function stepPhysics(dt) {
  const w = G.world;
  w.timestep = Math.min(Math.max(dt, 1 / 120), 1 / 40);
  for (const f of G.physUpdaters) f(w.timestep);
  w.step(G.eventQueue, G.hooks);
  G.eventQueue.drainCollisionEvents((h1, h2, started) => {
    if (!started) return;
    const a = G.colliderMap.get(h1), b = G.colliderMap.get(h2);
    if (a || b) emit('collision', a, b, h1, h2);
  });
}

// ---------- body helpers ----------
export function v3(x, y, z) { return { x, y, z }; }
export function toV(t, out = new THREE.Vector3()) { return out.set(t.x, t.y, t.z); }
export function toQ(r, out = new THREE.Quaternion()) { return out.set(r.x, r.y, r.z, r.w); }

// Static box collider (for walls/floors/furniture). Rotation optional (THREE.Quaternion)
export function staticBox(cx, cy, cz, hx, hy, hz, quat, opts = {}) {
  const R = G.R;
  const bd = R.RigidBodyDesc.fixed().setTranslation(cx, cy, cz);
  if (quat) bd.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
  const b = G.world.createRigidBody(bd);
  const cd = R.ColliderDesc.cuboid(hx, hy, hz).setFriction(opts.friction ?? 0.7).setRestitution(opts.restitution ?? 0.1)
    .setCollisionGroups(groups(opts.group ?? GR.STATIC, ALL));
  const c = G.world.createCollider(cd, b);
  G.colliderMap.set(c.handle, { kind: opts.kind || 'static', ref: opts.ref || null, tag: opts.tag });
  return { body: b, collider: c };
}
export function staticCyl(cx, cy, cz, hh, r, opts = {}) {
  const R = G.R;
  const b = G.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(cx, cy, cz));
  const c = G.world.createCollider(R.ColliderDesc.cylinder(hh, r).setFriction(0.7).setCollisionGroups(groups(GR.STATIC, ALL)), b);
  G.colliderMap.set(c.handle, { kind: 'static', tag: opts.tag });
  return { body: b, collider: c };
}

// Ray cast returning {entry, point, normal, dist, collider}
const _ray = { origin: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 0, z: 1 } };
export function raycast(origin, dir, maxDist, filterGroups = groups(GR.SENSOR, ALL), excludeBody = null, predicate = null) {
  const R = G.R;
  const ray = new R.Ray({ x: origin.x, y: origin.y, z: origin.z }, { x: dir.x, y: dir.y, z: dir.z });
  const hit = G.world.castRayAndGetNormal(ray, maxDist, true, undefined, filterGroups, undefined, excludeBody, predicate);
  if (!hit) return null;
  const toi = hit.toi ?? hit.timeOfImpact;
  return {
    collider: hit.collider, entry: G.colliderMap.get(hit.collider.handle), dist: toi,
    point: new THREE.Vector3(origin.x + dir.x * toi, origin.y + dir.y * toi, origin.z + dir.z * toi),
    normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
  };
}

// All colliders overlapping a sphere
export function overlapSphere(p, r, filterGroups = groups(GR.SENSOR, ALL)) {
  const R = G.R;
  const out = [];
  const shape = new R.Ball(r);
  G.world.intersectionsWithShape({ x: p.x, y: p.y, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, shape, (c) => {
    const e = G.colliderMap.get(c.handle); if (e) out.push({ collider: c, entry: e }); return true;
  }, undefined, filterGroups);
  return out;
}

// ---------- Grab spring ----------
// Drives a dynamic body so that its local anchor follows a world target, with a force cap.
// This gives the floppy Gang-Beasts feel: heavy relatives drag if the cap is too low to lift them.
const _w = new THREE.Vector3(), _p = new THREE.Vector3(), _err = new THREE.Vector3(), _v = new THREE.Vector3();
const _bq = new THREE.Quaternion();
export function driveBodyTo(body, localAnchor, target, targetVel, dt, maxForce, totalMass, opts = {}) {
  const t = body.translation(), r = body.rotation();
  _bq.set(r.x, r.y, r.z, r.w);
  _w.copy(localAnchor).applyQuaternion(_bq).add(_p.set(t.x, t.y, t.z));
  _err.subVectors(target, _w);
  const k = opts.k ?? 18;
  // desired velocity of anchor
  _v.copy(_err).multiplyScalar(k);
  if (targetVel) _v.add(targetVel);
  const lv = body.linvel();
  const dvx = _v.x - lv.x, dvy = _v.y - lv.y, dvz = _v.z - lv.z;
  // Force needed: m*dv/dt + gravity compensation (for the whole connected mass)
  const m = body.mass();
  let fx = m * dvx / dt, fy = m * dvy / dt + 9.81 * (totalMass ?? m), fz = m * dvz / dt;
  const mag = Math.hypot(fx, fy, fz);
  if (mag > maxForce) { const s = maxForce / mag; fx *= s; fy *= s; fz *= s; }
  // remove gravity part we added (the actual gravity is already applied by world)
  const imp = { x: fx * dt, y: (fy - 9.81 * m) * dt, z: fz * dt };
  body.applyImpulse(imp, true);
  // Some damping of spin while held so items don't helicopter
  const av = body.angvel();
  const damp = opts.angDamp ?? 0.85;
  body.setAngvel({ x: av.x * damp, y: av.y * damp, z: av.z * damp }, true);
  return _err.length();
}

// Rotate body towards target orientation (used for VR held items)
const _qe = new THREE.Quaternion();
export function driveBodyRot(body, targetQ, strength = 20) {
  const r = body.rotation();
  _bq.set(r.x, r.y, r.z, r.w);
  _qe.copy(targetQ).multiply(_bq.invert());
  if (_qe.w < 0) { _qe.x *= -1; _qe.y *= -1; _qe.z *= -1; _qe.w *= -1; }
  const angle = 2 * Math.acos(Math.min(1, _qe.w));
  const s = Math.sqrt(1 - _qe.w * _qe.w);
  if (s < 1e-4) { body.setAngvel({ x: 0, y: 0, z: 0 }, true); return; }
  const ax = _qe.x / s, ay = _qe.y / s, az = _qe.z / s;
  const w = Math.min(angle * strength, 30);
  body.setAngvel({ x: ax * w, y: ay * w, z: az * w }, true);
}
