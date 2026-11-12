// The player (Tommy). Desktop/touch/gamepad first-person (or third-person) controller with physics grabbing,
// throwing, punching and kicking; in a headset the XR module drives two tracked hands instead.
import * as THREE from 'three';
import { G, GR, groups, ALL, clamp, emit, on, rand } from '../core.js';
import { raycast, overlapSphere, driveBodyTo, driveBodyRot, toV } from '../engine/physics.js';
import { sfx } from '../engine/audio.js';
import { Controls } from './controls.js';
import { XRInput } from './xr.js';
import { FPHands } from './fphands.js';
import { halfHeight } from '../world/items.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _f = new THREE.Vector3();
const RAY_GROUPS = groups(GR.SENSOR, ALL & ~GR.PLAYER);

export class Player {
  constructor() {
    const R = G.R;
    this.rig = new THREE.Group(); G.scene.add(this.rig); this.rig.add(G.camera);
    this.pos = new THREE.Vector3(0, 0, 5.0); this.yaw = 0; this.pitch = 0; this.vy = 0; this.grounded = true;
    this.crouch = 0; this.eyeH = 1.66; this.thirdPerson = !!G.settings.thirdPerson;
    this.body = G.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.9, 5));
    this.collider = G.world.createCollider(R.ColliderDesc.capsule(0.55, 0.25).setCollisionGroups(groups(GR.PLAYER, GR.STATIC | GR.DOOR)), this.body);
    G.colliderMap.set(this.collider.handle, { kind: 'player', ref: this });
    this.cc = G.world.createCharacterController(0.02);
    this.cc.enableAutostep(0.3, 0.15, true); this.cc.enableSnapToGround(0.3); this.cc.setMaxSlopeClimbAngle(0.9);
    this.controls = new Controls();
    this.xrIn = new XRInput(this);
    this.fp = new FPHands();
    this.holders = {};
    this.charge = 0; this.holdDist = 1.0;
    this.focus = null; this.stats = { throws: 0, punches: 0, kicks: 0, disputes: 0, changed: 0, drinks: 0, eaten: 0 };
    this.drunk = 0; this.foodComa = 0; this.torch = null; this.punchCD = 0;
    G.physUpdaters.push((dt) => this.physStep(dt));
    on('xrstart', () => { this.releaseAll(); });
  }
  headObject() { return G.camera; }
  headPos(out = new THREE.Vector3()) { return G.camera.getWorldPosition(out); }
  // a relative shoves you over (hit Chip, Mason or Harrison and see what happens)
  knockDown(from) {
    const d = new THREE.Vector3(this.pos.x - from.x, 0, this.pos.z - from.z); if (d.lengthSq() < 1e-4) d.set(0, 0, 1); d.normalize();
    this.releaseAll?.(); sfx('bigthud', this.pos, 1); sfx('oof', this.pos, 0.9);
    if (G.xr) { this.teleport(this.pos.x + d.x * 0.8, this.pos.z + d.z * 0.8); /* keep facing the way you are */ G.ui?.toast('KNOCKED FLAT!', 2, { game: true }); try { for (const h of Object.values(this.xrIn.hands)) h?.source?.gamepad?.hapticActuators?.[0]?.pulse(1, 300); } catch (e) { /* no haptics */ } return; }
    this.downT = 4.2; this.downPush = d.multiplyScalar(0.9); G.fx?.shake && (G.fx.shake = 0.03);
  }
  // a push that slides you back over a moment (sumo); in VR the rig just moves
  shove(v) { if (G.xr) { this.teleport(this.pos.x + v.x, this.pos.z + v.z); return; } this.shoveV = new THREE.Vector3(v.x, 0, v.z).multiplyScalar(5); }
  forward(out = new THREE.Vector3()) { return G.camera.getWorldDirection(out); }

  // ---------------- per-frame ----------------
  preUpdate(dt, xrFrame) {
    const c = this.controls; c.poll();
    if (G.xr) { this.xrIn.update(dt, xrFrame); }
    else this.desktopUpdate(dt);
    this.punchCD -= dt;
    if (this.drunk > 0) this.drunk = Math.max(0, this.drunk - dt * 0.004);
    if (this.foodComa > 0) this.foodComa -= dt;
    // Tommy's body follows the player (visible in third person and in TV replays)
    const t = G.tommy; if (t) {
      const head = this.headPos(_v);
      t.pos.set(G.xr ? head.x : this.pos.x, this.pos.y, G.xr ? head.z : this.pos.z);
      const f = this.forward(_f); t.yaw = Math.atan2(f.x, f.z);
      const sp = this.speedXZ || 0; t.speed = sp; t.base = this.seated ? 'sit' : this.crouch > 0.5 ? 'stand' : sp > 2.6 ? 'run' : sp > 0.2 ? 'walk' : 'stand';
      if (this.holdingAny() && !t.gesture) t.gesture = 'carryCrate'; else if (!this.holdingAny() && t.gesture === 'carryCrate') t.gesture = null;
      t.root.visible = this.thirdPerson && !G.xr;
    }
  }
  postUpdate(dt) {
    this.fp.update(dt, this);
    this.controls.endFrame();
    if (this.torch) { this.torch.position.copy(this.headPos(_v)); this.forward(_f); this.torch.target.position.copy(_v).add(_f); }
    // drunk sway (optional)
    if (!G.xr && G.settings.drunkSway && this.drunk > 0.05) { G.camera.rotation.z = Math.sin(G.time * 0.9) * 0.03 * this.drunk; }
  }

  desktopUpdate(dt) {
    const c = this.controls;
    if (G.ui?.modalOpen) { c.look.x = c.look.y = 0; }
    this.yaw -= c.look.x; this.pitch = clamp(this.pitch - c.look.y, -1.45, 1.45);
    // knocked flat by an angry relative: thrown back, the view drops to the floor and rolls, then you get back up
    if (this.downT > 0) { this.downT -= dt; const tt = 4.2 - this.downT; if (tt < 0.35 && this.downPush) { this.pushNow = this.downPush.clone().multiplyScalar(1 / 0.35); } c.move.x = c.move.z = 0; c.look.x = c.look.y = 0; c.btn('jump').pressed = false;
      this.downK = tt < 0.35 ? tt / 0.35 : this.downT < 0.8 ? Math.max(0, this.downT / 0.8) : 1; } else this.downK = 0;
    // locked on someone (cracker pull): can't walk, the camera stays on them
    if (this.lockAt) { const t = typeof this.lockAt === 'function' ? this.lockAt() : this.lockAt; if (t) { const h = this.headPos(_v); const dx = t.x - h.x, dz = t.z - h.z; this.yaw = Math.atan2(-dx, -dz); this.pitch = clamp(Math.atan2(t.y - h.y, Math.hypot(dx, dz)), -0.8, 0.6); } c.move.x = c.move.z = 0; c.btn('jump').pressed = false; }
    // movement via character controller
    const speed = (c.move.run ? 4.2 : 2.3) * (this.crouch > 0.5 ? 0.5 : 1) * (this.foodComa > 0 ? 0.75 : 1) * (G.ui?.modalOpen ? 0 : 1);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw); const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let mx = (fx * c.move.z + rx * c.move.x) * speed, mz = (fz * c.move.z + rz * c.move.x) * speed;
    // being shoved / knocked back slides you (added to the normal move: two moves in one frame would cancel out)
    if (this.shoveV && this.shoveV.lengthSq() > 1e-4) { mx += this.shoveV.x; mz += this.shoveV.z; this.shoveV.multiplyScalar(Math.exp(-dt * 5)); }
    if (this.pushNow) { mx += this.pushNow.x; mz += this.pushNow.z; this.pushNow = null; }
    if (this.drunk > 0.3) { mx += Math.sin(G.time * 1.3) * this.drunk * 0.6; mz += Math.cos(G.time * 1.1) * this.drunk * 0.6; }
    if (c.btn('jump').pressed && this.grounded) { this.vy = 3.6; sfx('whoosh', this.pos, 0.3); }
    if (this.seated && (Math.hypot(c.move.x, c.move.z) > 0.3 || c.btn('jump').pressed)) this.stand();
    this.vy -= 9.81 * dt; if (this.grounded && this.vy < 0) this.vy = -0.5;
    if (this.seated) { mx = mz = 0; this.vy = 0; } else this.moveBy(mx * dt, this.vy * dt, mz * dt);
    this.speedXZ = Math.hypot(mx, mz);
    if (c.btn('crouch').pressed) this.crouchToggle = !this.crouchToggle;
    this.crouch += ((this.crouchToggle ? 1 : 0) - this.crouch) * Math.min(1, dt * 10);
    const eye = (this.seated ? this.seated.seatY + 0.72 : this.eyeH - this.crouch * 0.6) * (1 - (this.downK || 0) * 0.82);
    if (c.btn('view').pressed) { this.thirdPerson = !this.thirdPerson; }
    this.rig.position.copy(this.pos); this.rig.rotation.set(0, this.yaw, 0);
    if (this.thirdPerson) {
      // over-the-shoulder camera that avoids walls
      const back = new THREE.Vector3(0.35, 0.25, 2.4).applyEuler(new THREE.Euler(this.pitch * 0.6, 0, 0));
      const origin = new THREE.Vector3(this.pos.x, this.pos.y + eye, this.pos.z);
      const dir = back.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw); const len = dir.length(); dir.normalize();
      const hit = raycast(origin, dir, len, groups(GR.SENSOR, GR.STATIC));
      const d = hit ? Math.max(0.3, hit.dist - 0.15) : len;
      G.camera.position.set(0, eye, 0).add(back.normalize().multiplyScalar(d));
      G.camera.rotation.set(this.pitch, 0, 0);
    } else { G.camera.position.set(0, eye, 0); G.camera.rotation.set(this.pitch, 0, 0); }
    if (this.downK) { G.camera.rotation.z = this.downK * 1.25; G.camera.rotation.x = this.pitch * (1 - this.downK) + this.downK * 0.35; }
    G.camera.updateMatrixWorld(true);
    this.updateFocus();
    this.desktopActions(dt);
  }
  moveBy(dx, dy, dz) {
    const p = this.body.translation();
    this.cc.computeColliderMovement(this.collider, { x: dx, y: dy, z: dz }, G.R.QueryFilterFlags.EXCLUDE_SENSORS, groups(GR.PLAYER, GR.STATIC | GR.DOOR));
    const m = this.cc.computedMovement();
    const np = { x: p.x + m.x, y: p.y + m.y, z: p.z + m.z };
    this.body.setNextKinematicTranslation(np);
    this.grounded = this.cc.computedGrounded();
    this.pos.set(np.x, np.y - 0.8, np.z);
    if (this.pos.y < -0.05 && this.grounded) this.pos.y = 0;
  }
  teleport(x, z, yaw) { this.body.setTranslation({ x, y: 0.82, z }, true); this.pos.set(x, 0, z); if (yaw !== undefined) this.yaw = yaw; if (G.xr) { // in the headset: turn you to face the way the game wants, and put your HEAD (not the play-space centre) on the spot
      if (yaw !== undefined) this.rig.rotation.set(0, yaw, 0); this.rig.position.set(x, 0, z); this.rig.updateMatrixWorld(true); const h = this.headPos(new THREE.Vector3()); if (Number.isFinite(h.x)) { this.rig.position.x += x - h.x; this.rig.position.z += z - h.z; } } }

  // ---------------- what's under the crosshair ----------------
  updateFocus() {
    const o = this.headPos(new THREE.Vector3()); const d = this.forward(new THREE.Vector3());
    const exclude = new Set(Object.values(this.holders).filter(Boolean).map(h => h.body.handle));
    const hit = raycast(o, d, 3.2, RAY_GROUPS, this.body, (col) => !exclude.has(col.parent()?.handle));
    this.focus = null;
    if (hit && hit.entry) {
      const e = hit.entry; const f = { ...e, point: hit.point, dist: hit.dist, collider: hit.collider };
      if (e.kind === 'item' || e.kind === 'char' || e.kind === 'hinged' || e.kind === 'tree') this.focus = f;
      else if (e.kind === 'static' && e.tag === 'tv') this.focus = { kind: 'tv', point: hit.point, dist: hit.dist };
    }
    // interactable spots (doorbell, flush, light switch...)
    if (!this.focus && G.house) for (const s of G.house.interact) {
      _v.copy(s.pos).sub(o); const t = _v.dot(d); if (t < 0 || t > 2.5) continue; const perp = _v.addScaledVector(d, -t).length();
      if (perp < s.r * 0.6) { this.focus = { kind: 'spot', ref: s, dist: t }; break; }
    }
    // dog/kids within view
    if (!this.focus) { const near = this.personInView(o, d, 2.5, true); if (near) this.focus = { kind: near.isDog ? 'dog' : 'char', ref: near, dist: near._d, protected: true }; }
  }
  personInView(o, d, maxD, includeProtected, rad = 0.35) {
    let best = null, bd = 1e9; const list = includeProtected ? [...G.chars, ...(G.dog ? [G.dog] : [])] : G.chars;
    for (const p of list) { if (p.isPlayer) continue; const pp = p.chestPos ? p.chestPos(_v2) : p.pos.clone().setY(0.3); _v.copy(pp).sub(o); const t = _v.dot(d); if (t < 0.2 || t > maxD) continue; const perp = _v.addScaledVector(d, -t).length(); if (perp < rad && t < bd) { bd = t; best = p; best._d = t; } }
    return best;
  }

  // ---------------- desktop actions ----------------
  desktopActions(dt) {
    const c = this.controls; if (G.ui?.modalOpen) return;
    const held = this.holders.D;
    if (c.btn('grab').pressed) {
      if (held) this.release('D', null);
      else if (this.focus) this.tryGrab('D', this.focus);
      else if (G.modes?.id === 'fling') this.grabNearest(); // Fling: GRAB takes whoever is in front of you
    }
    if (this.controls.wheel && held) this.holdDist = clamp(this.holdDist - this.controls.wheel * 0.1, 0.5, 2.0);
    // throw: hold right mouse to charge, release to throw
    if (c.btn('throw').down && held) this.charge = Math.min(1, this.charge + dt * 2.0);
    if (c.btn('throw').released && held) {
      const dir = this.forward(new THREE.Vector3()); dir.y += 0.12; dir.normalize();
      const k = held.kind === 'char' ? (held.ref.heavy ? 0.6 : 0.85) : 1;
      const sp = (held.kind === 'char' ? 4 + this.charge * 13 : 6 + this.charge * 20) * k; // throws fly properly fast
      if (held.kind === 'item' && held.ref.id === 'sprout' && G.minigames?.active?.id === 'sproutPong') { this.release('D', G.minigames.sproutLaunch(new THREE.Vector3())); this.charge = 0; } // sprout throwing: a gentle lob, power from how long you held THROW
      else { this.release('D', dir.multiplyScalar(sp)); this.charge = 0; }
    } else if (!held) this.charge = 0;
    // gamepad: releasing the trigger with a right-stick flick throws
    if (c.btn('grab').released && held && this.controls.padFlick) { const dir = this.forward(new THREE.Vector3()); dir.y += 0.15; this.release('D', dir.normalize().multiplyScalar(held.kind === 'char' ? 11 : 17)); }
    if (c.btn('punch').pressed) this.punch(this.headPos(new THREE.Vector3()), this.forward(new THREE.Vector3()), 1);
    if (c.btn('kick').pressed) this.kick(this.forward(new THREE.Vector3()).setY(0).normalize());
    if (c.btn('use').pressed) this.use();
    if (c.btn('drink').pressed) this.consume();
    if (c.btn('handUp').pressed) { G.tommy && (G.tommy.gesture = 'handUp', G.tommy.gestureT = 0, setTimeout(() => G.tommy.gesture === 'handUp' && (G.tommy.gesture = null), 1500)); emit('handUp'); }
    if (c.btn('accuse').pressed) { const p = this.personInView(this.headPos(new THREE.Vector3()), this.forward(new THREE.Vector3()), 8, false); emit('accuse', p); }
    if (c.btn('torch').pressed) this.toggleTorch();
    for (let i = 1; i <= 4; i++) if (c.btn('a' + i).pressed) emit('answerKey', i - 1);
    if (c.btn('joker').pressed) emit('joker');
    if (c.btn('next').pressed) emit('next');
    if (c.btn('menu').pressed) emit('menu');
    if (c.btn('score').pressed) emit('scoreboard', true); if (c.btn('score').released) emit('scoreboard', false);
  }

  grabNearest(maxD = 2.6) { const o = this.headPos(new THREE.Vector3()); let best = null, bd = maxD; for (const p of G.chars) { if (p.isPlayer || p.protected || !p.bodies) continue; const d = p.chestPos(new THREE.Vector3()).distanceTo(o); if (d < bd) { bd = d; best = p; } } if (best) this.tryGrab('D', { kind: 'char', ref: best, part: 1, point: best.chestPos(new THREE.Vector3()), dist: Math.min(1.1, bd) }); return best; }
  // ---------------- grabbing ----------------
  holdingAny() { return Object.values(this.holders).some(Boolean); }
  heldItem(key) { const h = key ? this.holders[key] : (this.holders.D || this.holders.R || this.holders.L); return h && h.kind === 'item' ? h.ref : null; }
  tryGrab(key, f, handPos) {
    if (f.protected || (f.kind === 'char' && f.ref.protected)) { emit('protectedTouch', f.ref); return false; }
    if (f.kind === 'dog') { emit('pet', f.ref); return false; }
    if (f.kind === 'tree' || (f.kind === 'item' && f.ref.type.fixed)) { G.ui?.toast(f.kind === 'tree' ? 'The tree is staying put. (Julie would kill you.)' : `${f.ref.type.name}: too heavy to pick up.`, 2); return false; }
    const holder = { key, kind: f.kind, ref: f.ref, local: new THREE.Vector3(), relQ: new THREE.Quaternion() };
    let body;
    if (f.kind === 'item') { body = f.ref.body; if (f.ref.inMouth && G.dog) { G.dog.mouth = null; f.ref.inMouth = false; G.dog.wag = 3; } if (f.ref.attached) { f.ref.attached = null; f.ref.onTree = false; G.tree && (G.tree.baubles = G.tree.baubles.filter(b => b !== f.ref)); } if (f.ref.stuck) f.ref.stuck = false; body.setBodyType(G.R.RigidBodyType.Dynamic, true); f.ref.held = true; f.ref.dirty = true; holder.mass = f.ref.type.mass; holder.maxF = Math.max(200, f.ref.type.mass * 60 + 80); holder.totalMass = f.ref.type.mass; if (f.ref.type.mass < 5) { holder.attach = true; holder.radius = itemRadius(f.ref.type.shape); body.setBodyType(G.R.RigidBodyType.KinematicPositionBased, true); } sfx(f.ref.type.sound === 'cushion' ? 'cushion' : 'tap', f.point, 0.5); }
    else if (f.kind === 'char') {
      const p = f.ref; if (p.sumo && !p.sumoReady) { p.sumo(null, true); return false; } /* sumo: they plant their feet until they're off balance */ if (p.state === 'recover') p.state = 'anim'; p.playerHitT = G.time;
      p.knock(null, f.part ?? 1, { muscle: 0.12 }); body = p.bodies[f.part ?? 1]; p.heldBy.add(holder);
      holder.totalMass = p.mass; holder.maxF = (key === 'D') ? (p.heavy ? 1300 : 1500) : 1000; if (G.modes?.id === 'fling') { holder.totalMass *= 0.4; holder.maxF *= 1.7; } /* Fling the Relative: they feel light so you can really launch them */ holder.part = f.part ?? 1; holder.person = p;
      sfx('oof', f.point, 0.8); p.setMood('shock', 2);
      if (Math.random() < 0.6) setTimeout(() => p.bark('thrown', { prio: 1 }), 300);
      emit('grabPerson', p);
    } else if (f.kind === 'hinged') { body = f.ref.body; f.ref.held = true; if (f.ref.locked) { emit('lockedDoor', f.ref); return false; } holder.totalMass = 0; holder.maxF = 220; sfx('creak', f.point, 0.4); }
    else if (f.kind === 'tree') { body = f.ref.body; holder.totalMass = 15; holder.maxF = 500; }
    else return false;
    body.wakeUp();
    holder.body = body;
    // local anchor = grab point in body space
    const t = body.translation(), r = body.rotation(); _q.set(r.x, r.y, r.z, r.w);
    const gp = handPos || f.point || toV(t);
    holder.local.copy(gp).sub(toV(t)).applyQuaternion(_q.clone().invert());
    if (f.kind === 'item' && f.ref.type.mass < 3) holder.local.multiplyScalar(0.3); // small things snap to the hand
    if (key === 'D') this.holdDist = clamp(f.dist ?? 1, 0.7, f.kind === 'char' ? 1.2 : 1.4);
    this.holders[key] = holder;
    // two-hand detection (VR): both hands on the same person double the lifting force
    const other = this.holders[key === 'L' ? 'R' : 'L'];
    if (other && other.ref === holder.ref && holder.kind === 'char') { other.twoHand = holder.twoHand = true; emit('twoHandLift', holder.ref); }
    else if (holder.kind === 'char' && holder.ref.heavy && key !== 'D') emit('needTwoHands', holder.ref);
    emit('grab', holder);
    return true;
  }
  release(key, vel) {
    const h = this.holders[key]; if (!h) return; this.holders[key] = null;
    const other = this.holders[key === 'L' ? 'R' : 'L']; if (other && other.ref === h.ref) { other.twoHand = false; if (!vel) return; }
    if (h.kind === 'item' && h.attach && h.ref.alive) { h.body.setBodyType(G.R.RigidBodyType.Dynamic, true); h.body.wakeUp(); if (!vel && h.lastVel) h.body.setLinvel(h.lastVel, true); }
    if (h.kind === 'item') { h.ref.held = false; h.ref.releasedRecently = true; setTimeout(() => (h.ref.releasedRecently = false), 4000); }
    if (h.kind === 'hinged') h.ref.held = false;
    if (h.kind === 'char') h.ref.heldBy.delete(h);
    if (vel) {
      const bodies = h.kind === 'char' ? h.ref.bodies : [h.body];
      for (const b of bodies) { b.setLinvel({ x: vel.x, y: vel.y, z: vel.z }, true); }
      if (h.kind === 'char') { h.ref.bodies[1].setAngvel({ x: rand(-3, 3), y: rand(-4, 4), z: rand(-3, 3) }, true); h.ref.timesThrown++; h.ref.ragdollT = 0; }
      else h.body.setAngvel({ x: rand(-6, 6), y: rand(-6, 6), z: rand(-6, 6) }, true);
      this.stats.throws++;
      sfx('whoosh', h.body.translation(), Math.min(1, vel.length() / 10));
      emit('thrown', h, vel);
    }
  }
  releaseAll() { for (const k of Object.keys(this.holders)) this.release(k, null); }
  // Called each physics step: drive held bodies toward the hand(s)
  physStep(dt) {
    for (const key in this.holders) {
      const h = this.holders[key]; if (!h) continue;
      if (h.kind === 'item' && !h.ref.alive) { this.holders[key] = null; continue; }
      let target, tvel = null, tq = null;
      if (key === 'D') {
        const o = this.headPos(_v); const d = this.forward(_f);
        target = _v2.copy(o).addScaledVector(d, this.holdDist);
        if (G.ui?.touchMode && h.kind === 'item') { target.y -= 0.16; target.addScaledVector(_v3.set(-d.z, 0, d.x).normalize(), 0.14); } // phones: held low and to the right, like in your hand
        if (h.kind === 'char') target.y -= 0.15;
        if (h.kind === 'item' && h.ref.type.mass > 10) target.y = Math.max(target.y, 0.3);
      } else { const hand = this.xrIn.hands[key]; if (!hand) continue; target = hand.palm; tvel = hand.vel; tq = hand.q; }
      if (h.attach) { // small things sit in your hand
        const tp = new THREE.Vector3(), tqq = new THREE.Quaternion();
        if (key === 'D') this.fp.gripWorld(tp, tqq, h.radius); else { tp.copy(target).addScaledVector(this.xrIn.hands[key].normal, h.radius * 0.7); tqq.copy(tq); if (!h.relQ0) { const r = h.body.rotation(); h.relQ0 = tq.clone().invert().multiply(new THREE.Quaternion(r.x, r.y, r.z, r.w)); } tqq.multiply(h.relQ0); }
        if (key === 'D') { if (!h.relQ0) { const r = h.body.rotation(); h.relQ0 = tqq.clone().invert().multiply(new THREE.Quaternion(r.x, r.y, r.z, r.w)); h.relQ0.slerp(new THREE.Quaternion(), 0.85); } tqq.multiply(h.relQ0); }
        const prev = h.body.translation(); h.lastVel = { x: (tp.x - prev.x) / dt, y: (tp.y - prev.y) / dt, z: (tp.z - prev.z) / dt };
        h.body.setNextKinematicTranslation(tp); h.body.setNextKinematicRotation(tqq); h.ref.dirty = true; continue;
      }
      const twoHand = h.twoHand ? 2 : 1;
      const totalMass = h.kind === 'char' ? h.totalMass / twoHand : h.totalMass;
      const err = driveBodyTo(h.body, h.local, target, tvel, dt, h.maxF * (h.twoHand ? 1 : 1), totalMass, { k: h.kind === 'char' ? 10 : 22, angDamp: h.kind === 'char' ? 0.95 : 0.8 });
      if (tq && h.kind === 'item' && h.ref.type.mass < 6) { if (!h.qOff) { const r = h.body.rotation(); h.qOff = tq.clone().invert().multiply(new THREE.Quaternion(r.x, r.y, r.z, r.w)); } driveBodyRot(h.body, _q.copy(tq).multiply(h.qOff), 18); }
      // dropped if stretched too far (e.g. door slammed, person stuck)
      if (err > (h.kind === 'char' ? 2.2 : 1.6)) this.release(key, null);
    }
  }

  // ---------------- punch / kick ----------------
  punch(origin, dir, power = 1, handKey) {
    if (this.punchCD > 0 && !handKey) return; this.punchCD = 0.35; this.stats.punches++; if (!handKey) this.fp.punch(this.heldItem('D') ? 'L' : 'R');
    if (G.tommy && !G.xr) { G.tommy.gesture = 'point'; G.tommy.gestureT = 0; setTimeout(() => G.tommy.gesture === 'point' && (G.tommy.gesture = null), 300); }
    const hit = raycast(origin, dir, 1.7, RAY_GROUPS, this.body);
    let tgt = hit?.entry;
    if (!tgt || (tgt.kind !== 'char' && tgt.kind !== 'item' && tgt.kind !== 'tree')) {
      const p = this.personInView(origin, dir, 1.6, true);
      if (p) tgt = { kind: p.isDog ? 'dog' : 'char', ref: p, part: 1 };
    }
    sfx('whoosh', origin, 0.25);
    if (!tgt) return;
    if (tgt.kind === 'dog' || tgt.ref?.protected) { emit('protectedHit', tgt.kind === 'dog' ? G.dog : tgt.ref); return; }
    const imp = dir.clone().setY(Math.max(0.25, dir.y)).normalize();
    if (tgt.kind === 'char') {
      const p = tgt.ref; const m = p.mass; p.playerHitT = G.time;
      p.knock(imp.clone().multiplyScalar(m * 2.4 * power), tgt.part ?? 1);
      sfx('boff', hit ? hit.point : p.chestPos(), 1); emit('punched', p, imp);
      this.knockCrown(p, imp);
    } else if (tgt.kind === 'item') { tgt.ref.playerT = G.time; const b = tgt.ref.body; b.applyImpulse(imp.multiplyScalar(Math.min(8, b.mass() * 6) * power), true); sfx('boff', hit.point, 0.6); }
  }
  // Phones: tap the screen. Tap a person = knock them flying, tap a thing = pick it up,
  // tap while holding something = throw it where you tapped.
  tapAt(sx, sy) {
    if (G.ui?.modalOpen) return;
    if (G.minigames?.active?.id === 'sproutPong') return; // sprout throwing is THROW-button only (hold for power)
    const ndc = new THREE.Vector2(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, G.camera);
    const o = rc.ray.origin.clone(), d = rc.ray.direction.clone();
    const held = this.holders.D;
    if (held) { const dir = d.clone(); dir.y += 0.12; dir.normalize(); this.release('D', dir.multiplyScalar(held.kind === 'char' ? 11 : 16)); return; }
    const hit = raycast(o, d, 4.5, RAY_GROUPS, this.body);
    let e = hit?.entry;
    if (!e || (e.kind !== 'char' && e.kind !== 'item')) { const p = this.personInView(o, d, 4.5, true, 0.5); if (p) e = { kind: p.isDog ? 'dog' : 'char', ref: p, part: 1 }; }
    if (!e) { if (hit?.entry?.kind === 'static' && hit.entry.tag === 'tv') emit('tvTouched'); return; }
    if (e.kind === 'dog') { this.fp.punch?.('R'); emit('protectedHit', G.dog); return; } // tapping Chip = trying to hit the dog
    if (e.kind === 'char') {
      const p = e.ref; if (p.protected) { this.fp.punch?.('R'); emit('protectedHit', p); return; }
      if (G.modes?.id === 'fling') { this.tryGrab('D', { kind: 'char', ref: p, part: e.part ?? 1, point: hit ? hit.point : p.chestPos(new THREE.Vector3()), dist: 1 }); return; }
      p.playerHitT = G.time; this.fp.punch('R'); this.stats.punches++;
      const imp = d.clone().setY(Math.max(0.3, d.y)).normalize();
      p.knock(imp.clone().multiplyScalar(p.mass * 2.6), e.part ?? 1);
      sfx('boff', hit ? hit.point : p.chestPos(), 0.8); emit('punched', p, imp); this.knockCrown(p, imp);
      return;
    }
    if (e.kind === 'item') { if (e.ref.type.fixed) { if (e.ref.type.use) G.interact.useItem(e.ref, this); return; } this.tryGrab('D', { ...e, point: hit.point, dist: hit.dist }); }
  }
  knockCrown(p, dir) {
    if (!p.crown || !p.crown.parent) return;
    const wp = p.crown.getWorldPosition(new THREE.Vector3());
    p.crown.parent.remove(p.crown); p.crown = null;
    const inst = G.items.spawn('paper_crown', wp, null, {});
    if (inst) inst.body.setLinvel({ x: dir.x * 3, y: 3, z: dir.z * 3 }, true);
  }
  kick(dir, originOverride) {
    this.stats.kicks++;
    const o = originOverride || new THREE.Vector3(this.pos.x, this.pos.y + 0.4, this.pos.z);
    if (G.tommy && !G.xr) { G.tommy.target[7]; }
    sfx('whoosh', o, 0.3);
    // people first (legs/pelvis), then items on the floor
    let best = null, bd = 1.4;
    for (const p of G.chars) { if (p.isPlayer || p.protected || !p.bodies) continue; const pp = p.world[0].p; _v.copy(pp).sub(o); _v.y = 0; const t = _v.dot(dir); if (t < 0 || t > 1.4) continue; const perp = _v.addScaledVector(dir, -t).length(); if (perp < 0.45 && t < bd) { bd = t; best = p; } }
    if (best) { best.playerHitT = G.time; const imp = dir.clone().multiplyScalar(best.mass * 2.2).setY(best.mass * 2.6); best.knock(imp, 8); best.bodies[10].applyImpulse({ x: imp.x * 0.3, y: 0, z: imp.z * 0.3 }, true); sfx('boff', best.world[0].p, 1); emit('kicked', best); if (best.state === 'ragdoll' && best.ragdollT > 0.5) emit('rolled', best); return; }
    const hits = overlapSphere(o.clone().addScaledVector(dir, 0.6).setY(this.pos.y + 0.25), 0.45, RAY_GROUPS);
    for (const h of hits) if (h.entry.kind === 'item' && !h.entry.ref.type.fixed) { h.entry.ref.playerT = G.time; const b = h.entry.ref.body; const k = h.entry.ref.type.kickable ? 3.5 : 1.2; b.applyImpulse({ x: dir.x * b.mass() * 7 * k, y: b.mass() * 3 * k, z: dir.z * b.mass() * 7 * k }, true); sfx(h.entry.ref.type.kickable ? 'boing' : 'thud', b.translation(), 0.8); emit('kickedItem', h.entry.ref); break; }
  }

  // ---------------- sitting ----------------
  freeSeat(maxD = 1.4) {
    if (!G.house?.seats) return null; const fw = this.forward(_f).setY(0).normalize(); let best = null, bd = maxD;
    for (const s of G.house.seats) { const d = Math.hypot(s.pos.x - this.pos.x, s.pos.z - this.pos.z); if (d > bd) continue; _v.set(s.pos.x - this.pos.x, 0, s.pos.z - this.pos.z).normalize(); if (d > 0.4 && _v.dot(fw) < 0.2) continue;
      if (G.chars.some(c => !c.isPlayer && c.state === 'anim' && Math.hypot(c.pos.x - s.pos.x, c.pos.z - s.pos.z) < 0.45)) continue; best = s; bd = d; }
    return best;
  }
  sit(seat) {
    this.seated = seat; this.releaseAll(); this.teleport(seat.pos.x, seat.pos.z, seat.yaw + Math.PI); this.pitch = -0.05;
    if (G.tommy) { G.tommy.seatY = seat.seatY; } G.ui?.toast('Sitting down. Move to stand up.', 2);
  }
  stand() { const s = this.seated; this.seated = null; if (!s) return; const f = new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw)); this.teleport(s.pos.x + f.x * 0.55, s.pos.z + f.z * 0.55); }
  // ---------------- use / consume ----------------
  use(handKey) {
    const held = this.heldItem(handKey);
    const f = this.focus;
    if (!held && !this.seated && (!f || (f.kind === 'item' && !f.ref.type.use) || f.kind === 'tree')) { const seat = this.freeSeat(); if (seat) return this.sit(seat); }
    if (this.seated && !held && !f) return this.stand();
    if (held && f && f.kind === 'char' && !f.protected && f.dist < 2.2) return G.interact.give(held, f.ref, this);
    if (held && f && (f.kind === 'char' || f.kind === 'dog') && f.protected && f.dist < 2.2) return G.interact.give(held, f.ref, this);
    if (held) return G.interact.useItem(held, this, handKey);
    if (!f) return;
    if (f.kind === 'item') return G.interact.useItem(f.ref, this);
    if (f.kind === 'hinged') { const h = f.ref; if (h.locked) { emit('lockedDoor', h); return; } const dir = h.closed ? 1 : -1; const s = (h.limits[0] + h.limits[1]) < 0 ? -1 : 1; const ax = h.axis; h.body.wakeUp(); h.body.applyTorqueImpulse({ x: ax.x * s * dir * 6, y: ax.y * s * dir * 6, z: ax.z * s * dir * 6 }, true); sfx('creak', f.point, 0.5); return; }
    if (f.kind === 'spot') return G.interact.useSpot(f.ref.id, this);
    if (f.kind === 'char' || f.kind === 'dog') return G.interact.talkTo(f.ref, this);
    if (f.kind === 'tv') return emit('tvTouched');
  }
  consume(handKey) { const held = this.heldItem(handKey); if (held) { if (!handKey) this.fp.toMouth('R'); G.interact.consume(held, this); } }
  toggleTorch() {
    if (!this.torch) { this.torch = new THREE.SpotLight('#fff8e8', 0, 12, 0.5, 0.5, 1.2); G.scene.add(this.torch, this.torch.target); }
    this.torch.intensity = this.torch.intensity > 0 ? 0 : 18; sfx('click', null, 0.4);
    emit('torch', this.torch.intensity > 0);
  }
}

function itemRadius(sh) { switch (sh[0]) { case 'box': return Math.max(sh[1], sh[3]); case 'ball': return sh[1]; case 'cyl': return sh[2]; case 'cap': return sh[2]; } return 0.05; }
