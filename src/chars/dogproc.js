// Chip: beige cocker spaniel. Fur-carded body, jiggle ears and tail, big wet brown eyes.
// Can't be grabbed or thrown. Steals food, zoomies, drops his squeaky toy in your lap, barks at Gary.
import * as THREE from 'three';
import { G, GR, groups, ALL, rand, pick, clamp, noise3, on, emit } from '../core.js';
import { Prop } from '../engine/geo.js';
import { sfx } from '../engine/audio.js';
import { roomAt } from '../world/house.js';

const BEIGE = '#d8b685', DARK = '#b8925e', CREAM = '#ecd3a8';
const _v = new THREE.Vector3();

function furGeo(build) { const p = new Prop(); build(p); const g = p.build();
  // shaggy displacement + colour variation
  const pos = g.attributes.position, col = g.attributes.color;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const n = noise3(x * 60, y * 60, z * 60); const k = 1 + (n - 0.5) * 0.08; pos.setXYZ(i, x * k, y * k, z * k); col.setXYZ(i, col.getX(i) * (0.85 + n * 0.3), col.getY(i) * (0.85 + n * 0.3), col.getZ(i) * (0.85 + n * 0.3)); }
  g.computeVertexNormals(); return g; }
function fringe(p, x0, y0, z0, x1, y1, z1, n, len, color) { for (let i = 0; i < n; i++) { const t = i / (n - 1); const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t; p.box(0.012, len * (0.8 + Math.random() * 0.4), 0.004, color, x, y - len / 2, z, rand(-0.2, 0.2), rand(0, 3), rand(-0.15, 0.15)); } }

export class DogProc {
  constructor() {
    G.dog = this; this.isDog = true; this.name = 'Chip'; this.protected = true;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const furMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#2a1608', roughness: 0.05, metalness: 0.1 });
    const root = new THREE.Group(); this.root = root; G.scene.add(root);
    const body = new THREE.Group(); body.position.y = 0.36; root.add(body); this.body = body;
    body.add(new THREE.Mesh(furGeo(p => p.sph(0.13, BEIGE, 0, 0, 0, 1, 0.95, 1.9, 16).sph(0.1, CREAM, 0, -0.04, 0.17, 1, 1.1, 0.9, 12).sph(0.11, BEIGE, 0, 0.0, -0.17, 1, 1, 1.1, 12)), mat));
    const fr = new Prop(); fringe(fr, -0.07, -0.08, 0.2, 0.07, -0.08, 0.2, 10, 0.1, CREAM); fringe(fr, -0.1, -0.1, -0.1, -0.1, -0.1, 0.12, 8, 0.07, BEIGE); fringe(fr, 0.1, -0.1, -0.1, 0.1, -0.1, 0.12, 8, 0.07, BEIGE);
    body.add(new THREE.Mesh(fr.build(), furMat));
    // head
    const head = new THREE.Group(); head.position.set(0, 0.11, 0.27); body.add(head); this.head = head;
    head.add(new THREE.Mesh(furGeo(p => p.sph(0.085, BEIGE, 0, 0.03, 0, 1, 1, 1.05, 14).sph(0.05, CREAM, 0, -0.01, 0.1, 0.9, 0.8, 1.2, 12).sph(0.022, '#2a1a12', 0, 0.0, 0.16, 1.2, 0.9, 0.9, 8).sph(0.03, CREAM, 0, -0.045, 0.08, 1.2, 0.6, 1.4, 8)), mat));
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), eyeMat); e.position.set(s * 0.04, 0.05, 0.075); head.add(e); const hl = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.set(s * 0.04 + 0.005, 0.057, 0.09); head.add(hl); }
    // long wavy ears with jiggle
    this.ears = [];
    for (const s of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(s * 0.075, 0.06, -0.01); head.add(ear);
      const ep = new Prop(); for (let i = 0; i < 7; i++) ep.sph(0.035, i > 3 ? DARK : '#c8a06c', 0, -0.02 - i * 0.022, Math.sin(i * 1.3) * 0.008, 0.45, 1, 1.1, 8);
      fringe(ep, 0, -0.16, -0.02, 0, -0.16, 0.03, 6, 0.04, DARK);
      ear.add(new THREE.Mesh(furGeo(p => p.geo(ep.build(), '#ffffff')), mat)); ear.rotation.z = s * 0.15; this.ears.push({ g: ear, s, a: 0, v: 0 });
    }
    // tail (stubby, fast wag)
    const tail = new THREE.Group(); tail.position.set(0, 0.06, -0.33); body.add(tail); this.tail = tail;
    tail.add(new THREE.Mesh(furGeo(p => p.sph(0.03, BEIGE, 0, 0.03, -0.04, 0.9, 0.9, 1.6, 8)), mat));
    // legs
    this.legs = [];
    for (const [x, z] of [[-0.07, 0.17], [0.07, 0.17], [-0.07, -0.18], [0.07, -0.18]]) {
      const leg = new THREE.Group(); leg.position.set(x, -0.05, z); body.add(leg);
      const lp = new Prop().cyl(0.032, 0.025, 0.26, BEIGE, 0, -0.13, 0, 0, 0, 0, 10).sph(0.032, CREAM, 0, -0.28, 0.015, 1, 0.6, 1.3, 8);
      fringe(lp, 0, -0.04, -0.03, 0, -0.2, -0.03, 5, 0.05, CREAM);
      leg.add(new THREE.Mesh(furGeo(p => p.geo(lp.build(), '#ffffff')), mat)); this.legs.push(leg);
    }
    // collar + tag
    head.add(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.01, 6, 20), new THREE.MeshStandardMaterial({ color: '#c1121f' }))).rotation.set(1.2, 0, 0);
    this.crownMesh = null;
    // physics: protected kinematic capsule (things bounce off Chip)
    const R = G.R;
    this.kbody = G.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.3, 0));
    const col = G.world.createCollider(R.ColliderDesc.capsule(0.18, 0.13).setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))).setRestitution(0.9).setCollisionGroups(groups(GR.PROTECTED, GR.ITEM | GR.CHAR | GR.HELD | GR.SENSOR)), this.kbody);
    G.colliderMap.set(col.handle, { kind: 'dog', ref: this });
    this.pos = new THREE.Vector3(-0.9, 0, -0.5); this.yaw = 0; this.speed = 0; this.phase = 0; this.state = 'sleep'; this.timer = 20; this.path = null; this.wag = 0.3; this.mouth = null; this.followT = 0;
    this.headPos = (out = new THREE.Vector3()) => this.head.getWorldPosition(out);
    this.chestPos = (out = new THREE.Vector3()) => out.set(this.pos.x, 0.4, this.pos.z);
    on('pet', () => this.petted()); on('doorbell', () => this.bark(4, 'hallway')); on('dogToy', (i) => this.fetch(i)); on('dogFed', () => { this.wag = 2.5; this.state = 'sit'; this.timer = 4; });
    on('dogCrown', () => { if (!this.crownMesh) { const p = new Prop(); p.cyl(0.07, 0.07, 0.03, '#f2c20f', 0, 0, 0, 0, 0, 0, 16, true); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; p.cone(0.016, 0.022, '#f2c20f', Math.sin(a) * 0.065, 0.025, Math.cos(a) * 0.065, 0, a, 0, 4); } this.crownMesh = new THREE.Mesh(p.build(), mat); this.crownMesh.position.set(0, 0.11, 0); this.head.add(this.crownMesh); } });
    on('ragdoll', (p) => { if (p.pos.distanceTo(this.pos) < 3 && Math.random() < 0.5) setTimeout(() => this.jumpOn(p), 900); });
    G.updaters.push((dt) => this.think(dt));
  }
  // ---------------- behaviour ----------------
  goTo(target, speed = 1.6, then) { this.path = G.house.path(this.pos, target); this.speed = speed; this.then = then; }
  think(dt) {
    this.timer -= dt; this.followT -= dt;
    if (this.path) return;
    if (this.followTarget && this.followT > 0) { const t = this.followTarget.pos; if (t.distanceTo(this.pos) > 1.2) this.goTo(t.clone(), 2.6); return; }
    if (this.mouth) { // run off with stolen food then scoff it
      if (this.timer < 0) { G.items.remove(this.mouth); this.mouth = null; this.wag = 2; sfx('crunch', this.pos); emit('chipAte'); } return; }
    if (this.state === 'jumpTV' || this.state === 'sit' || this.state === 'beg' || this.state === 'lie') { if (this.timer > 0) return; }
    if (this.timer > 0 && this.state === 'sleep') return;
    const havoc = G.systems?.havocLevel?.() ?? 0; const r = Math.random();
    if (r < 0.15 + havoc * 0.05) return this.zoomies();
    if (r < 0.35) return this.stealFood();
    if (r < 0.48) return this.dropToy();
    if (r < 0.58) { this.state = 'beg'; this.goTo(new THREE.Vector3(3.6, 0, 4.9), 1.4, () => { this.state = 'beg'; this.timer = 10; this.yaw = 0; sfx('whine', this.pos); }); return; }
    if (r < 0.66 && G.house.tv) { this.goTo(G.house.tv.center.clone().setY(0).add(G.house.tv.normal.clone().multiplyScalar(0.5)), 1.8, () => { this.state = 'jumpTV'; this.timer = 3; this.yaw = Math.atan2(-G.house.tv.normal.x, -G.house.tv.normal.z); this.bark(2); emit('chipTV'); }); return; }
    if (r < 0.74) { const sheets = G.items.byType.answer_sheet; const s = pick(sheets); if (s) { const t = s.body.translation(); this.goTo(new THREE.Vector3(t.x, 0, t.z), 1.4, () => { this.state = 'lie'; this.timer = 15; emit('chipOnSheets'); }); return; } }
    if (r < 0.8 && G.charByName.Gary && !G.charByName.Gary.brain?.state?.startsWith('hidden')) { const g = G.charByName.Gary; this.goTo(g.pos.clone().add(new THREE.Vector3(0.8, 0, 0.6)), 2, () => { this.yaw = Math.atan2(g.pos.x - this.pos.x, g.pos.z - this.pos.z); this.bark(4); this.state = 'sit'; this.timer = 3; emit('chipVsGary'); }); return; }
    this.state = 'sleep'; this.goTo(G.house.spots.chipBed.clone(), 1.2, () => { this.state = 'sleep'; this.timer = rand(15, 35); });
  }
  follow(p, secs) { this.followTarget = p; this.followT = secs; }
  zoomies() {
    this.state = 'zoom'; emit('zoomies');
    const pts = [new THREE.Vector3(0, 0, -3), new THREE.Vector3(0, 0, 2), new THREE.Vector3(3.5, 0, 1.6), new THREE.Vector3(5.6, 0, 3.8), new THREE.Vector3(5.85, 0, 0.6), new THREE.Vector3(5, 0, -3.5), new THREE.Vector3(0, 0, -4)];
    let i = 0; const next = () => { if (i >= pts.length) { this.state = 'sit'; this.timer = 3; return; } this.goTo(pts[i++], 4.2, next); }; next();
  }
  stealFood() {
    const food = G.items.nearest(new THREE.Vector3(4, 0.9, 4.5), 6, (it) => it.type.food && !it.held && !it.attached && it.type.mass < 0.6 && it.id !== 'sprout');
    if (!food) { this.timer = 5; return; }
    const t = food.body.translation();
    this.goTo(new THREE.Vector3(t.x, 0, t.z), 2.2, () => {
      if (!food.alive || food.held) return;
      // jump up and snatch it
      this.mouth = food; food.body.setBodyType(G.R.RigidBodyType.KinematicPositionBased, true);
      food.attached = (outP, outQ) => { this.head.localToWorld(outP.set(0, -0.03, 0.17)); outQ.identity(); return outP; };
      sfx('yap', this.pos); emit('chipStole', food); G.ai?.say('Julie', pick(['CHIP! Drop it!', 'Who gave the dog a sausage roll?!', 'Chip, NO!']), 1);
      const julie = G.charByName.Julie; if (julie && Math.random() < 0.6) G.ai.sendTo('Julie', this.pos.clone(), () => G.ai.release('Julie'), 2.4);
      this.timer = 6; this.goTo(pick([new THREE.Vector3(0, 0, -12), new THREE.Vector3(0, 0, 4), new THREE.Vector3(5.2, 0, -9)]), 3.5);
    });
  }
  dropToy() {
    const toy = G.items.byType.dog_toy?.[0]; if (!toy || toy.held) { this.timer = 5; return; }
    const t = toy.body.translation();
    this.goTo(new THREE.Vector3(t.x, 0, t.z), 2, () => {
      if (toy.held) return;
      this.mouth = null; toy.body.setBodyType(G.R.RigidBodyType.KinematicPositionBased, true);
      toy.attached = (outP, outQ) => { this.head.localToWorld(outP.set(0, -0.03, 0.17)); outQ.identity(); return outP; };
      const pp = G.player.pos.clone();
      this.goTo(pp, 2, () => { toy.attached = null; toy.body.setBodyType(G.R.RigidBodyType.Dynamic, true); toy.body.setLinvel({ x: 0, y: 1, z: 0 }, true); sfx('squeak', this.pos); this.state = 'sit'; this.timer = 6; this.wag = 2.5; G.ui?.toast('Chip drops a slobbery squeaky toy at your feet. Throw it! (grab + throw)'); });
    });
  }
  fetch(toy) { this.goTo(G.player.pos.clone(), 3); this.wag = 3; }
  petted() { this.state = 'sit'; this.timer = 4; this.wag = 3.5; this.yaw = Math.atan2(G.player.pos.x - this.pos.x, G.player.pos.z - this.pos.z); sfx('whine', this.pos, 0.4); G.ui?.toast('Chip leans into your hand. Tail at maximum speed.'); emit('chipPetted'); }
  bark(n = 2, room) { for (let i = 0; i < n; i++) setTimeout(() => sfx('bark', this.pos), i * 260); if (room === 'hallway') this.goTo(new THREE.Vector3(0, 0, 4.8), 3.2, () => { this.state = 'sit'; this.timer = 4; }); }
  jumpOn(p) { const t = p.world[0].p; this.goTo(new THREE.Vector3(t.x, 0, t.z), 3, () => { this.state = 'jump'; this.timer = 2; this.wag = 3; sfx('yap', this.pos); emit('chipJumpedOn', p); }); }
  // ---------------- animation ----------------
  update(dt) {
    // follow path
    if (this.path && this.path.length) {
      const tgt = this.path[0]; _v.copy(tgt).sub(this.pos); _v.y = 0; const d = _v.length();
      if (d < 0.2) { this.path.shift(); if (!this.path.length) { this.path = null; const f = this.then; this.then = null; f && f(); } }
      else { _v.normalize(); this.pos.addScaledVector(_v, Math.min(d, this.speed * dt)); const want = Math.atan2(_v.x, _v.z); let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, dt * 10); this.moving = true;
        // skid on the oak
        if (this.speed > 3 && Math.abs(dy) > 0.8 && G.frame % 20 === 0) sfx('tap', this.pos, 0.3);
        // crash into legs: light knock-back on people
        if (this.speed > 3) for (const c of G.chars) { if (c.protected || c.isPlayer || c.state !== 'anim') continue; if (c.pos.distanceTo(this.pos) < 0.35 && Math.random() < 0.01) c.setMood?.('shock', 1); }
      }
    } else { this.moving = false; this.path = null; }
    const sp = this.moving ? this.speed : 0;
    this.phase += dt * (sp > 0.1 ? 4 + sp * 3.5 : 0);
    const R = this.root; R.position.copy(this.pos); R.rotation.y = this.yaw;
    const b = this.body; const st = this.state;
    // pose
    let bodyY = 0.36, bodyPitch = 0, headPitch = 0;
    if (!this.moving && st === 'sleep') { bodyY = 0.16; this.legs.forEach((l, i) => l.rotation.x = i < 2 ? -1.4 : 1.4); headPitch = 0.4; if (G.frame % 200 === 0) sfx('snore', this.pos, 0.3); }
    else if (!this.moving && (st === 'sit' || st === 'beg')) { bodyPitch = -0.5; bodyY = 0.3; this.legs[2].rotation.x = this.legs[3].rotation.x = -1.2; this.legs[0].rotation.x = this.legs[1].rotation.x = 0.4; headPitch = -0.4 + (st === 'beg' ? Math.sin(G.time * 3) * 0.1 : 0); }
    else if (!this.moving && st === 'jumpTV' || st === 'jump') { bodyPitch = -1.0; bodyY = 0.45; this.legs[0].rotation.x = this.legs[1].rotation.x = -0.8 + Math.sin(G.time * 12) * 0.3; this.legs[2].rotation.x = this.legs[3].rotation.x = 0.9; }
    else if (!this.moving && st === 'lie') { bodyY = 0.5; this.legs.forEach((l, i) => l.rotation.x = i < 2 ? -1.4 : 1.4); }
    else { const s = Math.sin(this.phase), c = Math.cos(this.phase); const amp = Math.min(1, sp / 2.5) * 0.7;
      const gallop = sp > 3; this.legs[0].rotation.x = s * amp; this.legs[3].rotation.x = gallop ? s * amp : s * amp; this.legs[1].rotation.x = gallop ? s * amp * 0.9 : -s * amp; this.legs[2].rotation.x = gallop ? -s * amp : -s * amp;
      bodyY = 0.36 + Math.abs(c) * 0.02 * amp * (gallop ? 3 : 1); bodyPitch = gallop ? s * 0.12 : 0; }
    b.position.y += (bodyY - b.position.y) * Math.min(1, dt * 10); b.rotation.x += (bodyPitch - b.rotation.x) * Math.min(1, dt * 10);
    this.head.rotation.x = headPitch + (this.mouth ? Math.sin(G.time * 18) * 0.3 : 0); // head-shake fling
    // tail wag + ears jiggle (spring)
    this.wag = Math.max(0.4, this.wag - dt * 0.3);
    this.tail.rotation.y = Math.sin(G.time * (8 + this.wag * 6)) * 0.6 * Math.min(1, this.wag);
    this.tail.rotation.x = -0.6;
    for (const e of this.ears) { const target = sp * 0.12 + (this.mouth ? Math.sin(G.time * 18) * 0.5 : 0); e.v += ((target - e.a) * 60 - e.v * 6) * dt; e.a += e.v * dt; e.g.rotation.x = -e.a; e.g.rotation.z = e.s * (0.15 + Math.abs(e.a) * 0.3); }
    // tail knocks drinks off the coffee table
    if (this.wag > 1.5 && G.frame % 10 === 0) { const tp = this.tail.getWorldPosition(_v); for (const it of G.items.instances) { if (!it.type.drink && it.type.kind !== 'glass') continue; const p = it.body.translation(); if (Math.hypot(p.x - tp.x, p.z - tp.z) < 0.3 && Math.abs(p.y - tp.y) < 0.25) { it.body.wakeUp(); it.body.applyImpulse({ x: rand(-0.3, 0.3), y: 0.2, z: rand(-0.3, 0.3) }, true); emit('tailKnock', it); } } }
    this.kbody.setNextKinematicTranslation({ x: this.pos.x, y: b.position.y, z: this.pos.z });
  }
}
