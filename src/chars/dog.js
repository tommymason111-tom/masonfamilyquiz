// Chip — the family's cocker spaniel, from his 3D scan, on a dog skeleton with real gaits.
//  • walk (4-beat lateral sequence), trot (diagonal pairs), rotary gallop for zoomies, with body bob/pitch
//  • turns lead with the chest, head counter-bobs, nose drops to sniff, ears & tail on springs
//  • holds things crosswise in his jaws; picks up (head down, jaw open, bite, lift), drops (lower, open, release)
//    and does the head-shake fling. Can't be grabbed or thrown; things bounce off him.
import * as THREE from 'three';
import { G, GR, groups, ALL, rand, pick, clamp, on, emit } from '../core.js';
import { Prop } from '../engine/geo.js';
import { sfx } from '../engine/audio.js';
import { models } from './glbrig.js';
import { buildDog, poseDog, DB } from './dogrig.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const NB = 17;
const LEGS = { FL: [DB.FLu, DB.FLl, true, 1], FR: [DB.FRu, DB.FRl, true, -1], BL: [DB.BLu, DB.BLl, false, 1], BR: [DB.BRu, DB.BRl, false, -1] };
// footfall phase offsets (fraction of a stride) per gait
const GAITS = { walk: { BL: 0, FL: 0.25, BR: 0.5, FR: 0.75, swing: 0.3 }, trot: { FL: 0, BR: 0, FR: 0.5, BL: 0.5, swing: 0.45 }, gallop: { BL: 0, BR: 0.08, FR: 0.42, FL: 0.52, swing: 0.55 } };

export class Dog {
  constructor() {
    G.dog = this; this.isDog = true; this.name = 'Chip'; this.protected = true;
    this.rig = buildDog(models.Chip, 0.4);
    G.scene.add(this.rig.root);
    this.local = Array.from({ length: NB }, () => new THREE.Quaternion());
    this.target = Array.from({ length: NB }, () => new THREE.Quaternion());
    this.centerZ = (this.rig.O[0].z + this.rig.O[1].z) / 2;
    const R = G.R;
    this.kbody = G.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.3, 0));
    const col = G.world.createCollider(R.ColliderDesc.capsule(0.2, 0.13).setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))).setRestitution(0.9).setCollisionGroups(groups(GR.PROTECTED, GR.ITEM | GR.CHAR | GR.HELD | GR.SENSOR)), this.kbody);
    G.colliderMap.set(col.handle, { kind: 'dog', ref: this });
    this.pos = new THREE.Vector3(-0.9, 0, -0.5); this.yaw = 0; this.speed = 0; this.vel = 0; this.phase = 0; this.state = 'sleep'; this.timer = 20; this.path = null;
    this.wag = 0.4; this.mouth = null; this.followT = 0; this.jaw = 0; this.headDown = 0; this.sniff = 0; this.turn = 0; this.shake = 0;
    this.ears = [{ a: 0, v: 0 }, { a: 0, v: 0 }]; this.tailA = 0; this.prevYaw = 0; this.prevPos = this.pos.clone(); this.panting = 0;
    this.root = this.rig.root; this.body = new THREE.Object3D(); // (kept for replay tracking compatibility)
    this.headPos = (out = new THREE.Vector3()) => out.copy(this.rig.bones[DB.head].position);
    this.chestPos = (out = new THREE.Vector3()) => out.set(this.pos.x, this.rig.dims.shoulder * 0.8, this.pos.z);
    on('pet', () => this.petted()); on('doorbell', () => this.bark(4, 'hallway')); on('dogToy', (i) => this.fetch(i)); on('dogFed', () => { this.wag = 2.5; this.state = 'sit'; this.timer = 4; });
    on('dogCrown', () => { if (this.crownMesh) return; const p = new Prop(); p.cyl(0.06, 0.06, 0.03, '#f2c20f', 0, 0, 0, 0, 0, 0, 16, true); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; p.cone(0.016, 0.022, '#f2c20f', Math.sin(a) * 0.056, 0.025, Math.cos(a) * 0.056, 0, a, 0, 4); } this.crownMesh = new THREE.Mesh(p.build(), new THREE.MeshStandardMaterial({ vertexColors: true })); G.scene.add(this.crownMesh); });
    on('ragdoll', (p) => { if (p.pos.distanceTo(this.pos) < 3 && Math.random() < 0.5) setTimeout(() => this.jumpOn(p), 900); });
    G.updaters.push((dt) => this.think(dt));
  }
  // ---------------- mouth ----------------
  mouthWorld(outP, outQ) {
    const hb = this.rig.bones[DB.head]; const hq = _q.copy(hb.quaternion).multiply(this.rig.C[DB.head].clone().invert());
    outP.copy(this.rig.mouthLocal).applyQuaternion(hq).add(hb.position);
    if (outQ) outQ.copy(hq).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)); // crosswise in the jaws
    return outP;
  }
  carry(item) {
    this.mouth = item; item.body.setBodyType(G.R.RigidBodyType.KinematicPositionBased, true); item.inMouth = true;
    item.attached = (outP, outQ) => this.mouthWorld(outP, outQ);
    this.jawHold = clamp((item.type.shape[1] || 0.04) * 3.5, 0.15, 0.6);
  }
  // lower the head, open, bite, lift — then call done
  pickUp(item, done) {
    this.state = 'pickup'; this.seq = { t: 0, item, done }; this.speed = 0;
  }
  drop(opts = {}) {
    const it = this.mouth; if (!it) return; this.state = 'dropping'; this.seq = { t: 0, item: it, fling: opts.fling, done: opts.done };
  }
  release(it, vel) {
    it.attached = null; it.inMouth = false; it.body.setBodyType(G.R.RigidBodyType.Dynamic, true);
    it.body.setLinvel(vel || { x: 0, y: -0.2, z: 0 }, true); it.body.setAngvel({ x: rand(-3, 3), y: rand(-3, 3), z: rand(-3, 3) }, true); it.dirty = true;
    if (this.mouth === it) this.mouth = null;
  }
  // ---------------- behaviour ----------------
  goTo(target, speed = 1.4, then) { this.path = G.house.path(this.pos, target); this.speed = speed; this.then = then; }
  think(dt) {
    this.timer -= dt; this.followT -= dt;
    if (this.path || this.state === 'pickup' || this.state === 'dropping') return;
    if (this.followTarget && this.followT > 0) { const t = this.followTarget.pos; if (t.distanceTo(this.pos) > 1.2) this.goTo(t.clone(), 2.6); return; }
    if (this.mouth && this.mouth.type.food) { if (this.timer < 0) { const f = this.mouth; this.release(f); G.items.remove(f); this.wag = 2; sfx('crunch', this.pos); emit('chipAte'); this.state = 'sit'; this.timer = 3; } return; }
    if (['jumpTV', 'sit', 'beg', 'lie', 'sniffAround'].includes(this.state) && this.timer > 0) return;
    if (this.timer > 0 && this.state === 'sleep') return;
    const havoc = G.systems?.havocLevel?.() ?? 0; const r = Math.random();
    if (r < 0.12 + havoc * 0.05) return this.zoomies();
    if (r < 0.3) return this.stealFood();
    if (r < 0.43) return this.dropToy();
    if (r < 0.52) { this.goTo(new THREE.Vector3(3.6, 0, 4.9), 1.0, () => { this.state = 'beg'; this.timer = 10; this.yaw = 0; sfx('whine', this.pos); }); return; }
    if (r < 0.6 && G.house.tv) { this.goTo(G.house.tv.center.clone().setY(0).add(G.house.tv.normal.clone().multiplyScalar(0.5)), 1.8, () => { this.state = 'jumpTV'; this.timer = 3; this.yaw = Math.atan2(-G.house.tv.normal.x, -G.house.tv.normal.z); this.bark(2); emit('chipTV'); }); return; }
    if (r < 0.67) { const s = pick(G.items.byType.answer_sheet || []); if (s) { const t = s.body.translation(); this.goTo(new THREE.Vector3(t.x, 0, t.z), 1.0, () => { this.state = 'lie'; this.timer = 15; emit('chipOnSheets'); }); return; } }
    if (r < 0.73 && G.charByName.Gary && G.charByName.Gary.brain?.state !== 'hidden') { const g = G.charByName.Gary; this.goTo(g.pos.clone().add(new THREE.Vector3(0.8, 0, 0.6)), 2, () => { this.yaw = Math.atan2(g.pos.x - this.pos.x, g.pos.z - this.pos.z); this.bark(4); this.state = 'sit'; this.timer = 3; emit('chipVsGary'); }); return; }
    if (r < 0.85) { this.state = 'sniffAround'; this.timer = rand(5, 9); this.goTo(this.pos.clone().add(new THREE.Vector3(rand(-2, 2), 0, rand(-2, 2))), 0.5, () => { this.state = 'sniffAround'; }); return; }
    this.state = 'walkBed'; this.goTo(G.house.spots.chipBed.clone(), 0.9, () => { this.state = 'sleep'; this.timer = rand(15, 35); });
  }
  follow(p, secs) { this.followTarget = p; this.followT = secs; }
  zoomies() {
    this.state = 'zoom'; emit('zoomies');
    const pts = [new THREE.Vector3(0, 0, -3), new THREE.Vector3(0, 0, 2), new THREE.Vector3(3.5, 0, 1.6), new THREE.Vector3(5.6, 0, 3.8), new THREE.Vector3(5.85, 0, 0.6), new THREE.Vector3(5, 0, -3.5), new THREE.Vector3(0, 0, -4)];
    let i = 0; const next = () => { if (i >= pts.length) { this.state = 'sit'; this.timer = 3; this.panting = 8; return; } this.goTo(pts[i++], 4.4, next); }; next();
  }
  stealFood() {
    const food = G.items.nearest(new THREE.Vector3(4, 0.9, 4.5), 6, (it) => it.type.food && !it.held && !it.attached && it.type.mass < 0.6 && it.id !== 'sprout');
    if (!food) { this.timer = 5; return; }
    const t = food.body.translation();
    this.goTo(new THREE.Vector3(t.x, 0, t.z), 1.6, () => {
      if (!food.alive || food.held) return;
      // up on the hind legs to the worktop, snatch it
      this.state = 'jumpUp'; this.timer = 0.8;
      setTimeout(() => {
        if (!food.alive || food.held) { this.state = 'sit'; return; }
        this.carry(food); sfx('yap', this.pos); emit('chipStole', food); G.ai?.say('Julie', pick(['CHIP! Drop it!', 'Who gave the dog a sausage roll?!', 'Chip, NO!']), 1);
        if (G.charByName.Julie && Math.random() < 0.6) G.ai.sendTo('Julie', this.pos.clone(), () => G.ai.release('Julie'), 2.4);
        this.state = 'run'; this.timer = 6; this.goTo(pick([new THREE.Vector3(0, 0, -12), new THREE.Vector3(0, 0, 4), new THREE.Vector3(5.2, 0, -9)]), 3.4);
      }, 700);
    });
  }
  dropToy() {
    const toy = G.items.byType.dog_toy?.[0]; if (!toy || toy.held) { this.timer = 5; return; }
    const t = toy.body.translation();
    this.goTo(new THREE.Vector3(t.x, 0, t.z), 1.6, () => {
      if (toy.held) return;
      this.pickUp(toy, () => {
        // trot over proudly with it, shake it, then drop it at your feet
        this.goTo(G.player.pos.clone(), 1.8, () => { this.yaw = Math.atan2(G.player.pos.x - this.pos.x, G.player.pos.z - this.pos.z); this.shake = 0.8; sfx('squeak', this.pos);
          setTimeout(() => this.drop({ done: () => { this.state = 'sit'; this.timer = 6; this.wag = 2.8; G.ui?.toast('Chip drops a slobbery squeaky toy at your feet. Throw it! (grab + throw)'); } }), 900); });
      });
    });
  }
  fetch(toy) { this.goTo(G.player.pos.clone(), 3); this.wag = 3; }
  petted() { this.state = 'sit'; this.timer = 4; this.wag = 3.5; this.yaw = Math.atan2(G.player.pos.x - this.pos.x, G.player.pos.z - this.pos.z); this.headTilt = 1; sfx('whine', this.pos, 0.4); G.ui?.toast('Chip leans into your hand. Tail at maximum speed.'); emit('chipPetted'); }
  bark(n = 2, room) { for (let i = 0; i < n; i++) setTimeout(() => { sfx('bark', this.pos); this.barkT = G.time + 0.18; }, i * 260); if (room === 'hallway') this.goTo(new THREE.Vector3(0, 0, 4.8), 3.2, () => { this.state = 'sit'; this.timer = 4; }); }
  jumpOn(p) { const t = p.world[0].p; this.goTo(new THREE.Vector3(t.x, 0, t.z), 3, () => { this.state = 'jumpUp'; this.timer = 2; this.wag = 3; sfx('yap', this.pos); emit('chipJumpedOn', p); }); }

  // ---------------- locomotion + animation ----------------
  update(dt) {
    let moving = false;
    if (this.path && this.path.length && this.state !== 'pickup' && this.state !== 'dropping') {
      const tgt = this.path[0]; _v.copy(tgt).sub(this.pos); _v.y = 0; const d = _v.length();
      const stopping = this.path.length === 1 && d < 0.6;
      if (d < 0.18) { this.path.shift(); if (!this.path.length) { this.path = null; const f = this.then; this.then = null; f && f(); } }
      else {
        _v.normalize(); const want = Math.atan2(_v.x, _v.z); let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        const turnRate = this.vel > 3 ? 4 : 7; this.yaw += clamp(dy, -turnRate * dt, turnRate * dt);
        // slow down for sharp turns and arrival; accelerate smoothly
        const goal = this.speed * (Math.abs(dy) > 1.2 ? 0.35 : 1) * (stopping ? 0.5 : 1);
        this.vel += (goal - this.vel) * Math.min(1, dt * 3);
        const fwd = _v2.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); this.pos.addScaledVector(fwd, Math.min(d, this.vel * dt)); moving = true;
        if (this.vel > 3 && Math.abs(dy) > 0.8 && G.frame % 18 === 0) sfx('tap', this.pos, 0.3); // claws skid on the oak
        if (this.vel > 3) for (const c of G.chars) { if (c.protected || c.isPlayer || c.state !== 'anim') continue; if (c.pos.distanceTo(this.pos) < 0.35 && Math.random() < 0.01) c.setMood?.('shock', 1); }
      }
    }
    if (!moving) { this.vel *= Math.exp(-dt * 6); if (this.vel < 0.05) this.vel = 0; if (!this.path) this.path = null; }
    // turn rate (for chest-leads-body bend)
    let yr = this.yaw - this.prevYaw; yr = Math.atan2(Math.sin(yr), Math.cos(yr)); this.turn += ((yr / Math.max(dt, 1e-3)) - this.turn) * Math.min(1, dt * 6); this.prevYaw = this.yaw;
    this.animate(dt);
    this.kbody.setNextKinematicTranslation({ x: this.pos.x, y: 0.3, z: this.pos.z });
    this.kbody.setNextKinematicRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw));
  }
  animate(dt) {
    const T = this.target; for (const q of T) q.identity();
    const E = (i, x, y = 0, z = 0) => T[i].multiply(_q.setFromEuler(_e.set(x, y, z, 'YXZ')));
    const sp = this.vel; const st = this.state; const t = G.time;
    const gait = sp > 3.0 ? 'gallop' : sp > 1.3 ? 'trot' : 'walk';
    const G0 = GAITS[gait];
    const freq = gait === 'gallop' ? 2.6 : gait === 'trot' ? 2.2 : 0.9 + sp * 0.9;
    if (sp > 0.05) this.phase = (this.phase + dt * freq) % 1;
    const amp = clamp(sp / (gait === 'gallop' ? 4 : gait === 'trot' ? 2 : 1.1), 0, 1);
    let rootY = 0, pitch = 0, roll = 0;
    // legs
    for (const k in LEGS) {
      const [u, l, front] = LEGS[k]; const ph = (this.phase + G0[k]) % 1; const swing = G0.swing;
      // stance: leg sweeps back linearly; swing: lifts and reaches forward
      let a, lift;
      if (ph < 1 - swing) { const s = ph / (1 - swing); a = 0.45 - s * 0.9; lift = 0; } else { const s = (ph - (1 - swing)) / swing; a = -0.45 + s * 0.9; lift = Math.sin(s * Math.PI); }
      const reach = gait === 'gallop' ? 1.5 : 1;
      E(u, -a * amp * reach * (front ? 0.85 : 1));                   // + x = leg swings back
      E(l, lift * amp * (gait === 'gallop' ? 1.3 : 0.9) * (front ? 1 : 0.8)); // carpus / hock flex: paw tucks up and back
    }
    if (gait === 'gallop') { const g = Math.sin(this.phase * Math.PI * 2); pitch = g * 0.12 * amp; rootY = Math.abs(Math.cos(this.phase * Math.PI * 2)) * 0.035 * amp; E(DB.chest, -g * 0.15 * amp); }
    else rootY = -Math.abs(Math.sin(this.phase * Math.PI * (gait === 'trot' ? 4 : 4))) * 0.012 * amp;
    // chest leads into turns, tail follows
    E(DB.chest, 0, clamp(this.turn * 0.12, -0.35, 0.35)); roll = clamp(-this.turn * 0.04 * amp, -0.15, 0.15);
    // head & neck: counter-bob, sniff, carry, look
    let neckX = -0.1 + Math.sin(this.phase * Math.PI * 4) * 0.04 * amp, headX = 0, headY = 0, headZ = 0;
    const sniffing = (st === 'sniffAround' || (st === 'walkBed' && Math.sin(t * 0.7) > 0.3)) && !this.mouth;
    this.sniff += ((sniffing ? 1 : 0) - this.sniff) * Math.min(1, dt * 3); neckX += this.sniff * 0.75; headX += this.sniff * 0.35;
    if (sniffing && G.frame % 40 === 0) sfx('whine', this.pos, 0.05);
    // look at the player or whoever's holding food
    if (!sniffing && sp < 1.5) { const tp = G.player.pos; const d = Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z) - this.yaw; headY = clamp(Math.atan2(Math.sin(d), Math.cos(d)), -0.7, 0.7) * 0.6; }
    if (this.headTilt > 0) { headZ = Math.sin(t * 2) * 0.3 * this.headTilt; this.headTilt -= dt * 0.4; }
    if (this.shake > 0) { headY += Math.sin(t * 38) * 0.6; headZ += Math.sin(t * 38 + 1) * 0.2; this.shake -= dt; }
    // poses
    if (st === 'sleep' && sp < 0.1) { rootY = -0.2; [DB.FLu, DB.FRu].forEach(i => E(i, -1.35)); [DB.FLl, DB.FRl].forEach(i => E(i, 0.2)); [DB.BLu, DB.BRu].forEach(i => E(i, -1.5)); [DB.BLl, DB.BRl].forEach(i => E(i, 2.2)); neckX = 0.5; headX = 0.2; roll = 0.12; this.jawT = 0; if (G.frame % 240 === 0) sfx('snore', this.pos, 0.3); }
    else if ((st === 'sit' || st === 'beg') && sp < 0.1) { pitch = -0.45; rootY = -0.08; [DB.BLu, DB.BRu].forEach(i => E(i, -1.1)); [DB.BLl, DB.BRl].forEach(i => E(i, 2.0)); [DB.FLu, DB.FRu].forEach(i => E(i, 0.42)); neckX = -0.35; headX = st === 'beg' ? -0.25 + Math.sin(t * 3) * 0.05 : 0; if (st === 'beg') headZ += Math.sin(t * 1.3) * 0.25; }
    else if (st === 'lie' && sp < 0.1) { rootY = -0.17; [DB.FLu, DB.FRu].forEach(i => E(i, -1.4)); [DB.BLu, DB.BRu].forEach(i => E(i, -1.4)); [DB.BLl, DB.BRl].forEach(i => E(i, 2.4)); neckX = 0.1; }
    else if ((st === 'jumpTV' || st === 'jumpUp') && sp < 0.2) { pitch = -1.05; rootY = 0.05; [DB.BLu, DB.BRu].forEach(i => E(i, -0.6)); [DB.BLl, DB.BRl].forEach(i => E(i, 1.0)); const pd = Math.sin(t * 10) * 0.3; E(DB.FLu, 1.2 + pd); E(DB.FRu, 1.2 - pd); neckX = -0.5; }
    // pick up / drop sequences
    if (st === 'pickup' && this.seq) { const s = this.seq; s.t += dt; const k = s.t; this.headDownT = k < 0.45 ? k / 0.45 : k < 0.75 ? 1 : Math.max(0, 1 - (k - 0.75) / 0.4); this.jawT = k < 0.35 ? k / 0.35 * 0.7 : k < 0.6 ? 0.7 : this.jawHold || 0.3;
      if (k > 0.55 && !s.bit) { s.bit = true; if (s.item.alive && !s.item.held) { this.carry(s.item); sfx('tap', this.pos, 0.6); } }
      if (k > 1.2) { this.state = 'carry'; const d = s.done; this.seq = null; d && d(); } }
    else if (st === 'dropping' && this.seq) { const s = this.seq; s.t += dt; const k = s.t; this.headDownT = k < 0.4 ? k / 0.4 : Math.max(0, 1 - (k - 0.6) / 0.4); this.jawT = k < 0.35 ? this.jawHold || 0.3 : 0.75;
      if (s.fling) { headY += Math.sin(k * 30) * 0.8; }
      if (k > 0.42 && !s.let) { s.let = true; const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); this.release(s.item, s.fling ? { x: rand(-3, 3), y: 2.5, z: rand(-3, 3) } : { x: fwd.x * 0.5, y: -0.3, z: fwd.z * 0.5 }); sfx('squeak', this.pos, 0.5); }
      if (k > 1.0) { this.state = 'sit'; this.timer = 3; const d = s.done; this.seq = null; d && d(); } }
    else { this.headDownT = 0; this.jawT = this.mouth ? (this.jawHold || 0.3) : (this.panting > 0 || sp > 3 ? 0.35 + Math.sin(t * 9) * 0.12 : 0.04); }
    if (this.barkT > t) this.jawT = 0.8;
    this.panting = Math.max(0, this.panting - dt);
    this.headDown = this.headDownT ?? 0; neckX += this.headDown * 0.9; headX += this.headDown * 0.5; rootY -= this.headDown * 0.03; pitch += this.headDown * 0.12;
    E(DB.neck, neckX, headY * 0.4); E(DB.head, headX, headY * 0.6, headZ);
    this.jaw += ((this.jawT ?? 0) - this.jaw) * Math.min(1, dt * 14); E(DB.jaw, this.jaw * 0.6);
    // tail: wag speed/width by mood; up when trotting, level at a gallop, down when sniffing
    this.wag = Math.max(0.4, this.wag - dt * 0.25);
    const wagF = 6 + this.wag * 5, wagA = (st === 'sleep' ? 0.05 : 0.25 + 0.25 * Math.min(1, this.wag)) * (gait === 'gallop' ? 0.4 : 1);
    E(DB.tail1, (sniffing ? 0.4 : gait === 'gallop' ? 0.1 : -0.35), Math.sin(t * wagF) * wagA); E(DB.tail2, -0.2, Math.sin(t * wagF - 0.8) * wagA * 0.8);
    // ears: springs driven by head motion and speed (flop when running/shaking)
    const hp = this.rig.bones[DB.head].position; const hv = this._hp ? _v.copy(hp).sub(this._hp).divideScalar(Math.max(dt, 1e-3)) : _v.set(0, 0, 0); this._hp = hp.clone();
    this.ears.forEach((e, i) => { const drive = hv.y * 0.6 + sp * 0.1 + (this.shake > 0 ? Math.sin(t * 38 + i) * 2 : 0); e.v += ((drive - e.a) * 70 - e.v * 7) * dt; e.a += e.v * dt; E(DB.earL + i, clamp(-e.a, -0.9, 0.6), 0, (i ? -1 : 1) * clamp(Math.abs(e.a) * 0.4, 0, 0.5)); });
    // smooth towards targets
    const k = 1 - Math.exp(-dt * (gait === 'gallop' ? 22 : 14));
    for (let i = 0; i < NB; i++) this.local[i].slerp(T[i], [DB.FLu, DB.FLl, DB.FRu, DB.FRl, DB.BLu, DB.BLl, DB.BRu, DB.BRl].includes(i) && sp > 0.1 ? 1 : k);
    const rootQ = _q.setFromEuler(_e.set(pitch, this.yaw, roll, 'YXZ')).clone();
    const O = this.rig.O; const off = new THREE.Vector3(0, O[0].y + rootY, O[0].z - this.centerZ).applyQuaternion(rootQ);
    const W = poseDog(this.rig, off.add(this.pos), rootQ, this.local);
    if (this.crownMesh) { const hq = W[DB.head].q; this.crownMesh.position.copy(W[DB.head].p).add(new THREE.Vector3(0, 0.1, 0.0).applyQuaternion(hq)); this.crownMesh.quaternion.copy(hq); }
  }
}
