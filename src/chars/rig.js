// Person = skinned character + active ragdoll (11 Rapier bodies joined by joints) + procedural animation.
// States: 'anim' (kinematic bodies follow the animation), 'ragdoll' (dynamic, PD "muscles" give the
// Gang-Beasts wobble), 'recover' (blend from the crumpled pose back to standing).
import * as THREE from 'three';
import { G, GR, groups, ALL, clamp, lerp, smooth, rand, pick, noise3, emit } from '../core.js';
import { buildCharacter, PARENT, PART_COUNT, B } from './body.js';
import { buildFromModel } from './glbrig.js';
import { sfx, say } from '../engine/audio.js';

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

let activeRagdolls = [];
export const MAX_RAGDOLLS = 8;

export class Person {
  constructor(spec) {
    this.spec = spec; this.name = spec.name; this.team = spec.team;
    const ch = spec._model ? buildFromModel(spec, spec._model) : buildCharacter(spec);
    Object.assign(this, { root: ch.root, mesh: ch.mesh, bones: ch.bones, dims: ch.dims, O: ch.origins, mats: ch.mats, tris: ch.tris });
    this.corr = ch.corrections || null; this.scanned = !!ch.scanned;
    this.root.userData.person = this;
    G.scene.add(this.root);
    this.H = this.dims.H;
    this.heavy = spec.build === 'bigger' || spec.weight === 'heavy';
    this.protected = !!spec.protected;
    this.isPlayer = !!spec.player;
    this.voice = spec.voice; this.lines = spec.lines || {};
    this.mass = (spec.build === 'bigger' ? 105 : spec.build === 'slim' ? 56 : spec.sex === 'f' ? 63 : 76) * (spec.build === 'toddler' ? 0.2 : spec.build === 'baby' ? 0.13 : 1);
    if (spec.inflate) this.mass *= 1.05;
    this.state = 'anim';
    this.pos = new THREE.Vector3(); this.yaw = 0;
    this.base = 'stand'; this.gesture = null; this.gestureT = 0; this.mood = 'neutral';
    this.walkPhase = 0; this.speed = 0;
    this.seatY = 0.45;
    this.lookTarget = null; this.lookAtPlayer = 0;
    this.talkUntil = 0; this.blinkT = rand(1, 4); this.blink = 0;
    this.dazedUntil = 0; this.timesThrown = 0;
    this.local = Array.from({ length: PART_COUNT }, () => new THREE.Quaternion());
    this.target = Array.from({ length: PART_COUNT }, () => new THREE.Quaternion());
    this.world = Array.from({ length: PART_COUNT }, () => ({ p: new THREE.Vector3(), q: new THREE.Quaternion() }));
    this.prevWorld = Array.from({ length: PART_COUNT }, () => new THREE.Vector3());
    this.rootPos = new THREE.Vector3(); this.rootQ = new THREE.Quaternion();
    this.offsets = [];
    for (let i = 0; i < PART_COUNT; i++) { const p = PARENT[i]; this.offsets.push(p < 0 ? new THREE.Vector3() : this.O[i].clone().sub(this.O[p])); }
    this.hairVel = 0; this.hairAng = 0; this.hairSide = 0; this.hairSideVel = 0;
    this.accessories = [];
    this.stars = null;
    this.muscle = 0.25;
    this.heldBy = new Set();
    if (!this.isPlayer) this.buildPhysics();
    this.stats = {};
  }

  // ---------- physics ----------
  buildPhysics() {
    const R = G.R, w = G.world, d = this.dims, O = this.O, H = this.H;
    const wm = d.wMul * (this.spec.inflate || 1);
    const mf = this.mass;
    const grp = this.protected ? groups(GR.PROTECTED, GR.STATIC | GR.ITEM | GR.CHAR | GR.HELD) : groups(GR.CHAR, ALL & ~GR.PLAYER);
    const restitution = this.spec.bouncy ? 0.85 : 0.15;
    const hd = d.head;
    const armLen = O[3].y - O[4].y, foreLen = O[4].y - (d.wristY - 0.09 * H);
    const thighLen = O[7].y - O[8].y, shinLen = O[8].y - d.p.ankle * H;
    const defs = [
      [0, 0.16, (c) => c.push(R.ColliderDesc.roundCuboid(0.075 * H * wm, 0.035 * H, 0.05 * H * wm, 0.02 * H).setTranslation(0, -0.01 * H, 0))],
      [1, 0.34, (c) => c.push(R.ColliderDesc.roundCuboid(0.07 * H * wm, 0.085 * H, 0.04 * H * (this.heavy ? 1.25 : 1) * (this.spec.inflate || 1), 0.025 * H).setTranslation(0, 0.11 * H, this.heavy ? 0.012 * H : 0))],
      [2, 0.08, (c) => c.push(R.ColliderDesc.ball(hd.ry * 0.82).setTranslation(0, hd.cy - O[2].y, hd.cz + 0.005))],
      [3, 0.028, (c) => c.push(R.ColliderDesc.capsule(Math.max(0.01, armLen / 2 - d.armR), d.armR).setTranslation(0, -armLen / 2, 0))],
      [4, 0.022, (c) => c.push(R.ColliderDesc.capsule(Math.max(0.01, foreLen / 2 - d.armR * 0.8), d.armR * 0.8).setTranslation(0, -foreLen / 2, 0))],
      [5, 0.028, null], [6, 0.022, null],
      [7, 0.1, (c) => c.push(R.ColliderDesc.capsule(Math.max(0.01, thighLen / 2 - d.legR * 0.85), d.legR * 0.85).setTranslation(0, -thighLen / 2, 0))],
      [8, 0.055, (c) => { c.push(R.ColliderDesc.capsule(Math.max(0.01, shinLen / 2 - d.legR * 0.55), d.legR * 0.55).setTranslation(0, -shinLen / 2, 0)); c.push(R.ColliderDesc.cuboid(d.legR * 0.5, 0.025 * H, 0.06 * H).setTranslation(0, -shinLen - 0.01 * H, 0.03 * H)); }],
      [9, 0.1, null], [10, 0.055, null],
    ];
    defs[5][2] = defs[3][2]; defs[6][2] = defs[4][2]; defs[9][2] = defs[7][2]; defs[10][2] = defs[8][2];
    this.bodies = []; this.colliders = []; this.partMass = [];
    for (const [i, frac, fn] of defs) {
      const bd = R.RigidBodyDesc.kinematicPositionBased().setTranslation(O[i].x, O[i].y, O[i].z).setLinearDamping(0.35).setAngularDamping(2.2).setCcdEnabled(i === 2 || i === 1);
      const body = w.createRigidBody(bd);
      const cds = []; fn(cds);
      const m = mf * frac;
      for (const cd of cds) {
        cd.setMass(m / cds.length).setFriction(0.8).setRestitution(restitution).setCollisionGroups(grp).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS).setActiveHooks(R.ActiveHooks.FILTER_CONTACT_PAIRS);
        const col = w.createCollider(cd, body); G.selfOwner.set(col.handle, this.selfId ??= (Person._ids = (Person._ids || 0) + 1));
        G.colliderMap.set(col.handle, { kind: 'char', ref: this, part: i });
        this.colliders.push(col);
      }
      this.bodies[i] = body; this.partMass[i] = m;
    }
    // joints
    this.joints = [];
    for (let i = 1; i < PART_COUNT; i++) {
      const p = PARENT[i];
      const a1 = this.offsets[i];
      let data;
      if (i === 4 || i === 6) { data = R.JointData.revolute({ x: a1.x, y: a1.y, z: a1.z }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }); data.limitsEnabled = true; data.limits = [-2.5, 0.05]; }
      else if (i === 8 || i === 10) { data = R.JointData.revolute({ x: a1.x, y: a1.y, z: a1.z }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }); data.limitsEnabled = true; data.limits = [-0.05, 2.6]; }
      else data = R.JointData.spherical({ x: a1.x, y: a1.y, z: a1.z }, { x: 0, y: 0, z: 0 });
      const j = w.createImpulseJoint(data, this.bodies[p], this.bodies[i], true);
      j.setContactsEnabled(false);
      this.joints.push(j);
    }
  }
  setKinematic(kin) {
    const R = G.R;
    for (const b of this.bodies) b.setBodyType(kin ? R.RigidBodyType.KinematicPositionBased : R.RigidBodyType.Dynamic, true);
  }

  // switch between being you (no physics body; driven by the player controller) and being an AI relative
  setPlayer(on) {
    if (on === this.isPlayer) return;
    if (on) {
      if (this.bodies) { for (const c of this.colliders || []) { G.colliderMap.delete(c.handle); G.selfOwner.delete(c.handle); } for (const b of this.bodies) G.world.removeRigidBody(b); }
      this.bodies = undefined; this.colliders = []; this.joints = []; this.state = 'anim'; this.heldBy?.clear(); this.isPlayer = true;
      activeRagdolls = activeRagdolls.filter(p => p !== this);
    } else { this.isPlayer = false; this.state = 'anim'; this.buildPhysics(); this.root.visible = true; }
  }
  // was this person hit/thrown/grabbed by the player in the last few seconds? (comic FX only fire then)
  byPlayer(s = 4) { return G.time - (this.playerHitT ?? -99) < s; }
  // Knock into ragdoll. impulse applied to part (or chest)
  knock(impulse, part = 1, opts = {}) {
    if (this.protected || this.isPlayer) return false;
    if (this.state !== 'ragdoll') this.toRagdoll(opts);
    if (impulse) this.bodies[part].applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
    this.ragdollT = 0;
    return true;
  }
  toRagdoll(opts = {}) {
    if (this.state === 'ragdoll') return;
    // velocity from last frame motion
    const dt = Math.max(G.dt, 1 / 90);
    this.setKinematic(false);
    for (let i = 0; i < PART_COUNT; i++) {
      const b = this.bodies[i]; const t = b.translation();
      b.setLinvel({ x: (t.x - this.prevWorld[i].x) / dt * 0.5, y: (t.y - this.prevWorld[i].y) / dt * 0.5, z: (t.z - this.prevWorld[i].z) / dt * 0.5 }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    this.state = 'ragdoll'; this.ragdollT = 0; this.muscle = opts.muscle ?? 0.18;
    this.mood = 'shock'; this.gesture = null;
    activeRagdolls = activeRagdolls.filter(p => p !== this); activeRagdolls.push(this);
    if (activeRagdolls.length > MAX_RAGDOLLS) { const old = activeRagdolls.find(p => p.heldBy.size === 0 && p !== this); if (old) old.startRecover(); }
    emit('ragdoll', this);
  }
  startRecover() {
    if (this.state !== 'ragdoll') return;
    // capture current pose as local rotations and root
    const hb = this.bodies[0].translation(), hr = this.bodies[0].rotation();
    this.recoverFromPos = new THREE.Vector3(hb.x, hb.y, hb.z);
    this.recoverFromQ = []; const wq = [];
    for (let i = 0; i < PART_COUNT; i++) { const r = this.bodies[i].rotation(); wq[i] = new THREE.Quaternion(r.x, r.y, r.z, r.w); }
    for (let i = 0; i < PART_COUNT; i++) { const p = PARENT[i]; this.recoverFromQ[i] = p < 0 ? wq[i].clone() : wq[p].clone().invert().multiply(wq[i]); }
    // facing from chest forward
    _v.set(0, 0, 1).applyQuaternion(wq[1]); _v.y = 0;
    const up = _v2.set(0, 1, 0).applyQuaternion(wq[1]);
    if (_v.lengthSq() < 0.01 || up.y < 0.3) { _v.copy(up).negate(); _v.y = 0; } // lying face down/up: stand facing along body
    if (_v.lengthSq() < 0.001) _v.set(0, 0, 1);
    this.yaw = Math.atan2(_v.x, _v.z);
    const floor = G.house ? G.house.floorAt(hb.x, hb.z, hb.y) : 0;
    this.pos.set(hb.x, floor, hb.z);
    if (G.house) G.house.clampToNav(this.pos);
    this.setKinematic(true);
    this.state = 'recover'; this.recoverT = 0;
    activeRagdolls = activeRagdolls.filter(p => p !== this);
    this.base = 'stand'; this.gesture = null;
    this.dazedUntil = G.time + 3;
    emit('recover', this);
  }
  isDown() { return this.state !== 'anim'; }
  chestPos(out = new THREE.Vector3()) { return out.copy(this.world[1].p).add(_v.set(0, 0.12 * this.H, 0).applyQuaternion(this.world[1].q)); }
  headPos(out = new THREE.Vector3()) { return out.copy(this.bones[2].getWorldPosition(_v3)).add(_v.set(0, this.dims.head.cy - this.O[2].y, 0).applyQuaternion(this.world[2].q)); }
  facing(out = new THREE.Vector3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  // ---------- per-step physics (active ragdoll muscles) ----------
  physStep(dt) {
    if (this.state !== 'ragdoll' || !this.bodies) return;
    const k = this.muscle;
    if (k <= 0.001) return;
    // PD towards a loose standing pose (or the struggle pose), relative to parent
    for (let i = 1; i < PART_COUNT; i++) {
      const p = PARENT[i]; const bc = this.bodies[i], bp = this.bodies[p];
      const rc = bc.rotation(), rp = bp.rotation();
      _q.set(rp.x, rp.y, rp.z, rp.w); _q2.set(rc.x, rc.y, rc.z, rc.w);
      const rel = _q3.copy(_q).invert().multiply(_q2);
      const tgt = this.target[i];
      const err = tgt.clone().multiply(rel.invert()).normalize(); // rotation from current rel to target (in parent frame)
      if (err.w < 0) { err.x *= -1; err.y *= -1; err.z *= -1; err.w *= -1; }
      const ang = 2 * Math.acos(Math.min(1, err.w)); if (ang < 1e-3) continue;
      const s = Math.sqrt(Math.max(0, 1 - err.w * err.w)); if (s < 1e-4 || !isFinite(ang)) continue;
      _v.set(err.x / s, err.y / s, err.z / s).applyQuaternion(_q); // world axis
      const wc = bc.angvel(), wp = bp.angvel();
      const stiff = i === 2 ? 3 : i === 1 ? 2 : 1;        // neck & spine hold their shape; limbs stay floppy
      const lim = i === 2 ? 0.6 : i === 1 ? 0.7 : (i === 3 || i === 5) ? 2.4 : (i === 7 || i === 9) ? 1.9 : 9;
      const over = ang > lim;                             // soft joint limits: past a natural range push back hard
      // velocity-level controller (unconditionally stable): blend the joint's relative spin towards the
      // spin that would close the error, instead of applying stiff torques that overshoot and wobble
      const gain = Math.min(12, 6 * k * stiff + (over ? 10 : 0)) * Math.min(ang, 1.2);
      const blend = Math.min(0.9, (0.25 + k) * stiff * 0.6 + (over ? 0.5 : 0));
      const rx = wc.x - wp.x, ry = wc.y - wp.y, rz = wc.z - wp.z;
      // change in relative spin, shared between the two parts by mass (equal & opposite: no energy is created)
      const dx = (_v.x * gain - rx) * blend, dy = (_v.y * gain - ry) * blend, dz = (_v.z * gain - rz) * blend;
      const mc = this.partMass[i], mp = this.partMass[p], fc = mp / (mc + mp), fp = mc / (mc + mp);
      bc.setAngvel({ x: wc.x + dx * fc, y: wc.y + dy * fc, z: wc.z + dz * fc }, true);
      bp.setAngvel({ x: wp.x - dx * fp, y: wp.y - dy * fp, z: wp.z - dz * fp }, true);
    }
    // Gang-Beasts style: when struggling, the chest tries to get upright (and fails comically)
    if (this.struggle > 0) {
      const ch = this.bodies[1]; const r = ch.rotation(); _q.set(r.x, r.y, r.z, r.w);
      const up = _v.set(0, 1, 0).applyQuaternion(_q); const axis = _v2.crossVectors(up, UP);
      const m = this.partMass[1] * this.struggle * 4 * dt;
      ch.applyTorqueImpulse({ x: axis.x * m, y: axis.y * m, z: axis.z * m }, true);
      if (Math.random() < 0.03) ch.applyImpulse({ x: rand(-1, 1) * m * 2, y: m * 6, z: rand(-1, 1) * m * 2 }, true);
    }
  }

  // ---------- animation ----------
  update(dt) {
    const t = G.time;
    for (let i = 0; i < PART_COUNT; i++) this.prevWorld[i].copy(this.world[i].p);
    if (this.state === 'ragdoll') {
      this.ragdollT += dt;
      for (let i = 0; i < PART_COUNT; i++) { const b = this.bodies[i]; const p = b.translation(), r = b.rotation(); this.world[i].p.set(p.x, p.y, p.z); this.world[i].q.set(r.x, r.y, r.z, r.w); }
      // muscle targets: floppy stand pose
      this.computePose(t, dt, true);
      const hv = this.bodies[0].linvel(); const sp = Math.hypot(hv.x, hv.y, hv.z);
      const held = this.heldBy.size > 0;
      if (held) { this.ragdollT = Math.min(this.ragdollT, 0.5); this.struggle = 0.15; this.muscle = 0.12; }
      else if (this.ragdollT > 1.6 && sp < 0.6) { this.struggle = clamp((this.ragdollT - 1.6) * 0.6, 0, 0.6); this.muscle = 0.35; }
      else { this.struggle = 0; this.muscle = 0.15; }
      if (!held && this.ragdollT > 2.6 && sp < 0.8) this.startRecover();
      // fell out of the world: reset
      if (this.world[0].p.y < -5) { this.setKinematic(true); this.state = 'anim'; this.pos.set(0, 0, -3); }
      this.applyBones();
    } else {
      this.computePose(t, dt, false);
      this.fk();
      if (this.state === 'recover') {
        this.recoverT += dt / 1.1;
        const k = smooth(clamp(this.recoverT, 0, 1));
        // blend root and locals from crumpled pose
        for (let i = 0; i < PART_COUNT; i++) this.local[i].copy(this.recoverFromQ[i]).slerp(this.target[i], k);
        this.rootPos.lerpVectors(this.recoverFromPos, this.rootPos, k);
        this.rootQ.copy(this.recoverFromQ[0]).slerp(this.rootQ, k);
        // recoverFromQ[0] is a world rotation: local[0] identity in that case
        this.local[0].identity();
        this.fkFrom();
        if (this.recoverT >= 1) { this.state = 'anim'; this.mood = 'dazed'; this.onGotUp?.(); }
      }
      this.applyBones();
      if (this.bodies) for (let i = 0; i < PART_COUNT; i++) { const wp = this.world[i]; this.bodies[i].setNextKinematicTranslation(wp.p); this.bodies[i].setNextKinematicRotation(wp.q); }
    }
    this.updateFace(dt);
    this.updateStars(dt);
  }

  // Compute target local rotations for the current base + gesture into this.target, and root into rootPos/rootQ
  computePose(t, dt, muscleOnly) {
    const T = this.target; const H = this.H;
    const E = (i, x, y = 0, z = 0) => T[i].setFromEuler(_e.set(x, y, z, 'XYZ'));
    for (let i = 0; i < PART_COUNT; i++) T[i].identity();
    const breathe = Math.sin(t * 1.6 + this.H * 10) * 0.015;
    let rootY = this.dims.O ? 0 : this.O[0].y; rootY = this.O[0].y;
    let rootTiltX = 0, rootRoll = 0;
    if (muscleOnly) {
      // loose "trying to stand" pose; arms out flailing a little
      E(1, 0.1); E(2, 0); const fl = Math.sin(t * 9) * 0.6 * this.struggle;
      E(3, -0.4 + fl, 0, 0.6); E(5, -0.4 - fl, 0, -0.6); E(4, -0.6); E(6, -0.6);
      E(7, -0.3 - fl, 0, 0.1); E(9, -0.3 + fl, 0, -0.1); E(8, 0.5); E(10, 0.5);
      return;
    }
    const b = this.base;
    // per-person noise seed and slow idle state (weight shifts, glances); all motion is layered on top of the base pose
    const sd = this._seed ?? (this._seed = (this.H * 977 + this.O[2].y * 131) % 50);
    const nz = (f, o) => (noise3(t * f, sd + o * 3.1, o * 0.37) - 0.5) * 2; // smooth noise in -1..1
    let rootYawOff = 0, rootSide = 0;
    // turning on the spot: little stepping feet, chest and head lead the turn
    let yr = this.yaw - (this._prevYaw ?? this.yaw); yr = Math.atan2(Math.sin(yr), Math.cos(yr)); this._prevYaw = this.yaw;
    this._turnRate = (this._turnRate || 0) + ((yr / Math.max(dt, 1e-3)) - (this._turnRate || 0)) * Math.min(1, dt * 8);
    if (b === 'walk' || b === 'run') {
      // a proper gait: thighs swing through stance/swing, knees flex in swing and soak up each heel strike, the pelvis
      // twists and drops with each step and shifts over the standing leg, the chest counter-rotates, arms swing opposite
      // their leg with elbows bending on the forward swing, the body bobs twice per stride and the head stays level
      const run = b === 'run'; const amp = clamp(this.speed / (run ? 3 : 1.4), 0, 1.3) * (run ? 1.2 : 1);
      this.walkPhase += dt * (run ? 9.5 : 6.3) * Math.max(0.45, Math.min(1.45, this.speed / 1.2));
      const ph = this.walkPhase;
      const leg = (th, sh, p, side) => { const sw = Math.sin(p);
        const thigh = -sw * (run ? 0.6 : 0.42) * amp - (run ? 0.18 : 0.04) * amp;
        const knee = amp * ((run ? 1.75 : 1.05) * Math.pow(Math.max(0, Math.cos(p + 0.3)), 2) + 0.16 * Math.max(0, -Math.sin(2 * p))) + 0.04;
        E(th, thigh, 0, side * (0.02 + 0.015 * amp)); E(sh, knee); };
      leg(7, 8, ph, 1); leg(9, 10, ph + Math.PI, -1);
      const lean = (run ? 0.2 : 0.05) * amp + Math.min(0.08, Math.abs(this._turnRate) * 0.01);
      rootYawOff = 0.08 * amp * Math.sin(ph); rootRoll = 0.035 * amp * Math.cos(ph) + clamp(-this._turnRate * 0.03, -0.08, 0.08); rootSide = 0.018 * amp * Math.cos(ph);
      rootY += (run ? 0.04 * Math.abs(Math.sin(ph)) - 0.035 : 0.022 * Math.cos(2 * ph) - 0.012) * amp;
      E(1, lean + breathe, -rootYawOff * 1.6, -rootRoll * 0.6); E(2, -lean * 0.6 + 0.02 * amp * Math.cos(2 * ph), rootYawOff * 0.7 + clamp(this._turnRate * 0.08, -0.3, 0.3), rootRoll * 0.4);
      const arm = (u, l, p, side) => { const sw = Math.sin(p) * (run ? 0.6 : 0.38) * amp; E(u, sw + (run ? -0.1 : 0.03), 0, side * (0.07 + 0.04 * amp)); E(l, run ? -1.45 + 0.15 * Math.sin(p) : -0.22 - Math.max(0, -sw) * 0.9 - 0.08 * amp); };
      arm(3, 4, ph, 1); arm(5, 6, ph + Math.PI, -1);
      if (this.base === 'walk' && Math.floor(ph / Math.PI) !== this._step) { this._step = Math.floor(ph / Math.PI); if (G.audio && Math.random() < 0.5) sfx('footstep', this.pos, 0.4); }
    } else if (b === 'sit' || b === 'sleep') {
      E(7, -1.45, 0, 0.06); E(9, -1.45, 0, -0.06); E(8, 1.35); E(10, 1.35);
      E(1, -0.12 + breathe * 1.4 + nz(0.12, 12) * 0.05, nz(0.08, 13) * 0.08, nz(0.1, 14) * 0.03); E(3, -0.3 + nz(0.2, 15) * 0.06, 0, 0.1); E(5, -0.3 + nz(0.2, 16) * 0.06, 0, -0.1); E(4, -0.9 + nz(0.22, 17) * 0.1); E(6, -0.9 + nz(0.22, 18) * 0.1);
      E(7, -1.45 + nz(0.07, 19) * 0.05, 0, 0.06 + nz(0.06, 20) * 0.06); E(9, -1.45 + nz(0.07, 21) * 0.05, 0, -0.06 - nz(0.06, 22) * 0.06);
      if (!this.lookTarget && b !== 'sleep') E(2, nz(0.15, 23) * 0.1, nz(0.08, 24) * 0.5, 0);
      rootY = this.seatY + this.dims.legR * 0.85 + (this.O[0].y - this.O[7].y);
      if (b === 'sleep') { E(2, 0.55, 0, 0.25); E(1, -0.3 + breathe * 3); }
    } else if (b === 'sitFloor') {
      E(7, -1.35, 0.5, 0.9); E(9, -1.35, -0.5, -0.9); E(8, 2.3); E(10, 2.3); E(1, 0.12 + breathe);
      E(3, -0.5, 0, 0.1); E(5, -0.5, 0, -0.1); E(4, -0.8); E(6, -0.8);
      rootY = 0.1 * H;
    } else if (b === 'lieDown') {
      rootTiltX = -Math.PI / 2; rootY = this.seatY + 0.12; E(2, -0.2); E(3, 0, 0, 0.2); E(5, 0, 0, -0.2);
    } else if (b === 'carried') {
      E(1, 0.2); E(3, 0.2, 0, 0.9); E(5, 0.2, 0, -0.9);
    } else { // stand
      // alive standing: breathing lifts the chest and shoulders, weight shifts from foot to foot every few seconds (hip
      // drops, the free knee softens), slow postural sway, arms hang with a soft elbow, idle glances when not looking at anyone
      this._wsT = this._wsT ?? 0; this._wsNext = this._wsNext ?? (t + rand(2, 6)); if (t > this._wsNext) { this._wsT = Math.random() < 0.25 ? 0 : (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 1); this._wsNext = t + rand(3, 9); }
      this._ws = (this._ws ?? 0) + (this._wsT - (this._ws ?? 0)) * Math.min(1, dt * 1.6); const ws = this._ws;
      const dz = this.mood === 'dazed' ? 1 : 0; const sx = nz(0.23, 1) * 0.025 + Math.sin(t * 3) * 0.08 * dz, sz = nz(0.19, 2) * 0.02 + Math.cos(t * 3) * 0.08 * dz;
      E(1, breathe * 1.2 + sx, nz(0.11, 3) * 0.05, -ws * 0.035 + sz);
      E(3, 0.02 + nz(0.3, 4) * 0.04, 0, 0.07 + breathe * 0.6 + ws * 0.02); E(5, 0.02 + nz(0.3, 5) * 0.04, 0, -0.07 - breathe * 0.6 + ws * 0.02);
      E(4, -0.14 + nz(0.25, 6) * 0.05); E(6, -0.14 + nz(0.25, 7) * 0.05);
      const relaxL = Math.max(0, -ws), relaxR = Math.max(0, ws); // which leg is resting
      E(7, -0.06 * relaxL, 0, 0.025 + 0.03 * relaxL); E(8, 0.2 * relaxL); E(9, -0.06 * relaxR, 0, -0.025 - 0.03 * relaxR); E(10, 0.2 * relaxR);
      rootRoll = ws * 0.03 + nz(0.15, 8) * 0.01; rootSide = -ws * 0.025; rootY -= (relaxL + relaxR) * 0.006 * H;
      if (!this.lookTarget) E(2, nz(0.17, 9) * 0.1, nz(0.09, 10) * 0.45, nz(0.13, 11) * 0.05); // idle glances
      // turning on the spot: step the feet round
      const tr = Math.abs(this._turnRate); if (tr > 0.5) { this._turnPh = (this._turnPh || 0) + dt * 9; const k = Math.min(1, (tr - 0.5) / 1.5); const a = Math.max(0, Math.sin(this._turnPh)), c = Math.max(0, -Math.sin(this._turnPh));
        E(7, -0.3 * a * k, 0, 0.03); E(8, 0.6 * a * k); E(9, -0.3 * c * k, 0, -0.03); E(10, 0.6 * c * k); E(1, breathe, clamp(this._turnRate * 0.06, -0.25, 0.25)); }
      if (this.spec.build === 'toddler') { E(3, 0.1, 0, 0.25); E(5, 0.1, 0, -0.25); }
    }
    // talking hands
    const talking = G.time < this.talkUntil;
    // upper-body gestures override arms/spine
    const g = this.gesture; const gt = (this.gestureT += dt);
    if (g) {
      const osc = Math.sin(t * 6);
      switch (g) {
        case 'point': E(5, -1.45, 0.2, -0.15); E(6, -0.1); E(2, 0, -0.2); break;
        case 'argue': E(3, -0.7 + osc * 0.25, 0, 0.3); E(5, -0.7 - osc * 0.25, 0, -0.3); E(4, -1.1); E(6, -1.1); E(1, 0.12); break;
        case 'clap': { const c = Math.abs(Math.sin(t * 12)) * 0.35; E(3, -0.95, -0.3, -0.25 + c); E(5, -0.95, 0.3, 0.25 - c); E(4, -1.0); E(6, -1.0); break; }
        case 'drink': E(5, -0.45, -0.3, 0.15); E(6, -2.25); E(2, -0.25); break;
        case 'sip': if (Math.sin(gt * 0.8) > 0.6) { E(5, -0.45, -0.3, 0.15); E(6, -2.25); E(2, -0.2); } else { E(5, -0.2, 0, -0.05); E(6, -1.4); } break;
        case 'phone': E(3, -0.3, 0, 0.12); E(5, -0.3, 0, -0.12); E(4, -1.5, 0.35); E(6, -1.5, -0.35); E(2, 0.4); break;
        case 'armsFolded': E(3, -0.35, 0, 0.12); E(5, -0.35, 0, -0.12); E(4, -1.75, -0.9); E(6, -1.75, 0.9); E(1, -0.05); break;
        case 'bellyPat': E(1, -0.12 + breathe); E(3, -0.5, 0, -0.05); E(5, -0.5, 0, 0.05); E(4, -1.05 + Math.max(0, osc) * 0.2, -0.4); E(6, -1.05 + Math.max(0, -osc) * 0.2, 0.4); break;
        case 'laughDouble': { const bo = Math.abs(Math.sin(t * 9)) * 0.08; E(1, 0.55 + bo); E(2, 0.1); E(3, -0.7, 0, 0.2); E(5, -0.7, 0, -0.2); E(4, -0.4); E(6, -0.4); rootY -= 0.03 * H; this.mood = 'laugh'; break; }
        case 'laugh': { const bo = Math.abs(Math.sin(t * 10)) * 0.07; E(1, -0.18 - bo); E(2, -0.25); E(3, -0.3, 0, 0.2); E(5, -0.3, 0, -0.2); E(4, -0.9); E(6, -0.9); this.mood = 'laugh'; break; }
        case 'cheer': E(3, -2.8, 0, 0.35); E(5, -2.8, 0, -0.35); E(4, -0.2); E(6, -0.2); break;
        case 'handUp': E(5, -2.9, 0, -0.1); E(6, -0.1); break;
        case 'wave': E(5, -0.2, 0, -2.4 + osc * 0.25); E(6, -0.5); break;
        case 'holdBaby': E(3, -0.55, 0, 0.15); E(4, -1.65, -0.9); break;
        case 'whistle': E(5, -0.4, -0.3, 0.15); E(6, -2.3); E(2, -0.1); break;
        case 'write': E(3, -0.55, 0, 0.1); E(5, -0.65, 0, -0.1); E(4, -1.0, 0.4); E(6, -1.2 + osc * 0.05, -0.4); E(2, 0.45); E(1, 0.12); break;
        case 'tuckHair': E(5, -0.25, 0, -1.6); E(6, -2.3); E(2, 0, 0, -0.1); break;
        case 'facepalm': E(5, -0.6, -0.4, 0.1); E(6, -2.35); E(2, 0.35); break;
        case 'shrug': E(3, -0.2, 0, 0.5); E(5, -0.2, 0, -0.5); E(4, -1.3, 0.6); E(6, -1.3, -0.6); E(2, 0, 0, 0.15); break;
        case 'slapArm': E(5, -0.6, 0, -0.6 - Math.max(0, osc) * 0.5); E(6, -0.6); this.mood = 'laugh'; break;
        case 'tidy': E(1, 0.7); E(3, -0.9); E(5, -0.9 + osc * 0.2); E(4, -0.3); E(6, -0.3); rootY -= 0.04 * H; break;
        case 'bounce': E(3, -0.55, 0, 0.15); E(4, -1.65, -0.9); rootY += Math.abs(Math.sin(t * 4)) * 0.015; break;
        case 'carryCrate': E(3, -1.0, 0, -0.1); E(5, -1.0, 0, 0.1); E(4, -0.5); E(6, -0.5); break;
        case 'dance': { const w2 = Math.sin(t * 5); E(1, 0.05, w2 * 0.3, w2 * 0.1); E(3, -1.2 + w2 * 0.6, 0, 0.6); E(5, -1.2 - w2 * 0.6, 0, -0.6); E(4, -1.2); E(6, -1.2); E(7, -Math.max(0, w2) * 0.4); E(9, -Math.max(0, -w2) * 0.4); rootY += Math.abs(w2) * 0.02; break; }
        case 'coatOn': E(3, -2.2, 0, 0.6); E(5, -0.3 + osc * 0.3, 0, -0.9); E(4, -1.0); E(6, -1.4); break;
        case 'stretch': E(3, -2.9, 0, 0.2); E(5, -2.9, 0, -0.2); E(1, -0.2); break;
        // activities: reaching into a fridge, overarm throws, eating, warming hands by the fire, stroking Chip, pulling a cracker, toasting, selfies
        case 'reach': E(5, -1.45, 0, -0.1); E(6, -0.15); E(1, 0.18); E(2, 0.15); break;
        case 'throwOver': { const k = Math.min(1, gt / 0.9); if (k < 0.55) { E(5, -2.6, 0, -0.5); E(6, -1.9); E(1, -0.15, 0.3); } else { E(5, -1.1, 0, -0.1); E(6, -0.1); E(1, 0.25, -0.25); } break; }
        case 'eat': { const up = Math.sin(gt * 2.2) > 0; E(5, up ? -0.5 : -0.3, -0.3, 0.15); E(6, up ? -2.3 : -1.5); E(2, up ? -0.12 : 0.05); break; }
        case 'warm': E(3, -1.25, 0, 0.12 + osc * 0.04); E(5, -1.25, 0, -0.12 - osc * 0.04); E(4, -0.35); E(6, -0.35); E(1, 0.12); break;
        case 'pet': E(1, 0.85); E(2, 0.3); E(5, -1.1 + osc * 0.15, 0, -0.1); E(6, -0.2); E(7, -0.9); E(9, -0.9); E(8, 1.3); E(10, 1.3); rootY -= 0.22 * H; break;
        case 'pull': { const tug = Math.sin(t * 7) * 0.08; E(3, -1.35, 0, 0.05); E(5, -1.35, 0, -0.05); E(4, -0.25 + tug); E(6, -0.25 + tug); E(1, -0.22 - tug); E(7, -0.15); E(9, 0.1); break; }
        case 'toast': E(5, -2.4, 0, -0.2); E(6, -0.6); E(2, -0.15); break;
        case 'selfie': E(5, -2.0, 0.6, -0.5); E(6, -0.4); E(2, -0.1, 0.25); break;
        case 'hips': E(3, -0.2, 0, 0.55); E(5, -0.2, 0, -0.55); E(4, -1.5, 0.9); E(6, -1.5, -0.9); break;
      }
    } else if (talking && b !== 'sleep') {
      // talking: both hands gesture with the rhythm of speech, the head nods and tilts, shoulders lift on emphasis
      const n1 = nz(1.7, 25), n2 = nz(1.3, 26), n3 = nz(2.1, 27), emph = Math.max(0, nz(0.9, 28));
      E(5, -0.42 + n1 * 0.25 - emph * 0.15, n3 * 0.15, -0.12 - n2 * 0.12); E(6, -1.0 - n2 * 0.35, -0.2 + n1 * 0.2);
      if (b !== 'sit' || Math.abs(n2) > 0.3) { E(3, -0.25 + n2 * 0.18, 0, 0.12 + n1 * 0.08); E(4, -0.7 - n3 * 0.3, 0.2); }
      _q.setFromEuler(_e.set(n3 * 0.07 + emph * 0.05, n1 * 0.12, n2 * 0.06, 'XYZ')); T[2].multiply(_q);
    }
    // head look-at (yaw/pitch relative to chest), clamped
    if (this.lookTarget && b !== 'sleep') {
      const hp = _v3.set(this.pos.x, this.pos.y + this.O[2].y + 0.1, this.pos.z);
      const dx = this.lookTarget.x - hp.x, dz = this.lookTarget.z - hp.z, dy = this.lookTarget.y - (b === 'sit' ? hp.y - 0.45 : hp.y);
      let yawRel = Math.atan2(dx, dz) - this.yaw; yawRel = Math.atan2(Math.sin(yawRel), Math.cos(yawRel));
      const pitch = -Math.atan2(dy, Math.hypot(dx, dz));
      _q.setFromEuler(_e.set(clamp(pitch, -0.5, 0.5), clamp(yawRel, -1.1, 1.1), 0, 'YXZ'));
      T[2].premultiply(_q);
      this._eyeYaw = clamp(yawRel - clamp(yawRel, -1.1, 1.1), -0.35, 0.35); this._eyePitch = clamp(pitch * 0.3, -0.3, 0.3);
    } else { this._eyeYaw = 0; this._eyePitch = 0; }
    // root
    this.rootPos.set(this.pos.x + Math.cos(this.yaw) * rootSide, this.pos.y + rootY, this.pos.z - Math.sin(this.yaw) * rootSide);
    this.rootQ.setFromEuler(_e.set(rootTiltX, this.yaw + rootYawOff, rootRoll, 'YXZ'));
  }
  // smooth local rotations toward target and run FK
  fk() {
    const walking = this.base === 'walk' || this.base === 'run'; const kL = 1 - Math.exp(-G.dt * (walking ? 22 : 12)), kA = 1 - Math.exp(-G.dt * 10), kS = 1 - Math.exp(-G.dt * 7);
    for (let i = 0; i < PART_COUNT; i++) this.local[i].slerp(this.target[i], i >= 7 ? kL : i >= 3 ? kA : kS); // legs crisp, arms follow, spine and head ease
    if (this._rootSmooth) { this._rootSmooth.lerp(this.rootPos, 1 - Math.exp(-G.dt * 15)); }
    this.fkFrom();
  }
  fkFrom() {
    const W = this.world;
    W[0].p.copy(this.rootPos); W[0].q.copy(this.rootQ).multiply(this.local[0]);
    for (let i = 1; i < PART_COUNT; i++) {
      const p = PARENT[i];
      W[i].p.copy(this.offsets[i]).applyQuaternion(W[p].q).add(W[p].p);
      W[i].q.copy(W[p].q).multiply(this.local[i]);
    }
  }
  applyBones() {
    const C = this.corr;
    for (let i = 0; i < PART_COUNT; i++) { this.bones[i].position.copy(this.world[i].p); this.bones[i].quaternion.copy(this.world[i].q); if (C) this.bones[i].quaternion.multiply(C[i]); }
  }
  // ---------- face ----------
  updateFace(dt) {
    const bn = this.bones; const t = G.time;
    // jaw / lip-sync
    const talking = t < this.talkUntil;
    let jaw = 0;
    if (talking) jaw = 0.08 + Math.max(0, noise3(t * 9, this.H * 7, 0) - 0.3) * 0.5;
    if (this.mood === 'laugh') jaw = 0.18 + Math.abs(Math.sin(t * 14)) * 0.15;
    if (this.mood === 'shock') jaw = 0.3;
    if (this.base === 'sleep') jaw = 0.12 + Math.sin(t * 1.2) * 0.05;
    if (this.mouthFull > t) jaw = Math.abs(Math.sin(t * 8)) * 0.12;
    bn[B.jaw].rotation.x = lerp(bn[B.jaw].rotation.x, jaw, 1 - Math.exp(-dt * 20));
    // blink
    this.blinkT -= dt; if (this.blinkT < 0) { this.blink = 0.15; this.blinkT = rand(2, 5); }
    let lid = 0.05;
    if (this.blink > 0) { this.blink -= dt; lid = 1.05; }
    if (this.mood === 'laugh') lid = Math.max(lid, 0.6);
    if (this.mood === 'angry') lid = Math.max(lid, 0.35);
    if (this.mood === 'smug') lid = Math.max(lid, 0.45);
    if (this.mood === 'shock') lid = -0.25;
    if (this.base === 'sleep' || this.state === 'ragdoll' && this.ragdollT > 0.3 && this.ragdollT < 1.2) lid = 1.1;
    bn[B.lidL].rotation.x = bn[B.lidR].rotation.x = lerp(bn[B.lidL].rotation.x, lid, 1 - Math.exp(-dt * 30));
    // eyes
    bn[B.eyeL].rotation.set(this._eyePitch || 0, this._eyeYaw || 0, 0); bn[B.eyeR].rotation.copy(bn[B.eyeL].rotation);
    // brows
    const browY = { shock: 0.012, laugh: 0.004, angry: -0.006, dazed: 0.006, smug: 0.002 }[this.mood] ?? 0;
    bn[B.brow].position.y = lerp(bn[B.brow].position.y, this.O[B.brow].y - this.O[2].y + browY * this.H / 1.7, 1 - Math.exp(-dt * 10));
    // hair sway: spring driven by head motion
    const hp = this.world[2].p; const prev = this._hp || hp.clone();
    const ax = (hp.x - prev.x) / Math.max(dt, 1e-3), az = (hp.z - prev.z) / Math.max(dt, 1e-3), ay = (hp.y - prev.y) / Math.max(dt, 1e-3);
    this._hp = hp.clone();
    const fw = _v.set(0, 0, 1).applyQuaternion(this.world[2].q);
    const fwdVel = ax * fw.x + az * fw.z;
    const sideVel = ax * fw.z - az * fw.x;
    this.hairVel += (-fwdVel * 0.25 - this.hairAng * 40 + ay * 0.1) * dt; this.hairVel *= Math.exp(-dt * 4); this.hairAng += this.hairVel * dt * 10;
    this.hairSideVel += (sideVel * 0.2 - this.hairSide * 40) * dt; this.hairSideVel *= Math.exp(-dt * 4); this.hairSide += this.hairSideVel * dt * 10;
    bn[B.hair].rotation.set(clamp(this.hairAng, -0.5, 0.5), 0, clamp(this.hairSide, -0.4, 0.4));
    if (this.mood !== 'neutral' && this.moodUntil && t > this.moodUntil) { this.mood = 'neutral'; this.moodUntil = 0; }
    if (this.mood === 'dazed' && t > this.dazedUntil) this.mood = 'neutral';
  }
  setMood(m, seconds = 3) { this.mood = m; this.moodUntil = G.time + seconds; }
  // cartoon stars over the head while dazed
  updateStars(dt) {
    const show = (this.state === 'recover' || (this.mood === 'dazed' && G.time < this.dazedUntil));
    if (show && !this.stars) {
      this.stars = new THREE.Group();
      const m = new THREE.MeshBasicMaterial({ color: '#ffe23a' });
      const sg = starGeo();
      for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(sg, m); this.stars.add(s); }
      G.scene.add(this.stars);
    }
    if (this.stars) {
      this.stars.visible = show;
      if (show) {
        this.headPos(this.stars.position); this.stars.position.y += 0.18;
        this.stars.children.forEach((s, i) => { const a = G.time * 4 + i * Math.PI / 2; s.position.set(Math.cos(a) * 0.15, Math.sin(a * 2) * 0.02, Math.sin(a) * 0.15); s.rotation.y = a * 2; });
      }
    }
  }
  say(text, opts) { return say(this, text, opts); }
  bark(kind, opts) { const l = this.lines[kind]; if (l && l.length) return this.say(pick(l), opts); return 0; }
  attach(obj, boneName, pos, rot) {
    const bi = B[boneName]; let b = this.bones[bi];
    // scanned models: bones carry a scan->rest correction; props are placed in the rest (logical) frame
    if (this.corr && bi < this.corr.length && this.corr[bi]) { const h = new THREE.Object3D(); h.quaternion.copy(this.corr[bi]).invert(); b.add(h); b = h; }
    obj.position.copy(pos || new THREE.Vector3()); if (rot) obj.rotation.copy(rot); b.add(obj); this.accessories.push(obj); return obj;
  }
  // world position of a hand (end of forearm)
  handPos(side = 'R', out = new THREE.Vector3()) {
    const i = side === 'R' ? 6 : 4; const len = this.O[i].y - (this.dims.wristY - 0.07 * this.H);
    return out.set(0, -len, 0.01).applyQuaternion(this.world[i].q).add(this.world[i].p);
  }
  teleport(x, y, z, yaw) {
    this.pos.set(x, y, z); if (yaw !== undefined) this.yaw = yaw;
    this.computePose(G.time, 0.016, false); for (let i = 0; i < PART_COUNT; i++) this.local[i].copy(this.target[i]); this.fkFrom(); this.applyBones();
    for (let i = 0; i < PART_COUNT; i++) this.prevWorld[i].copy(this.world[i].p);
    if (this.bodies) for (let i = 0; i < PART_COUNT; i++) { this.bodies[i].setTranslation(this.world[i].p, true); this.bodies[i].setRotation(this.world[i].q, true); }
  }
}

let _starGeo = null;
function starGeo() {
  if (_starGeo) return _starGeo;
  const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.012 : 0.03; const a = i / 10 * Math.PI * 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  _starGeo = new THREE.ShapeGeometry(s); return _starGeo;
}
export function ragdollPhysStep(dt) { for (const p of activeRagdolls) p.physStep(dt); }
export function getActiveRagdolls() { return activeRagdolls; }
