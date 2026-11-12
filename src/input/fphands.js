// First-person hands (flat-screen modes): Tommy's arms in his fair-isle jumper, with a watch, that hold
// things, reach for heavy things/people, punch, and lift food & drink to your mouth.
import * as THREE from 'three';
import { G, clamp, lerp } from '../core.js';
import { Prop } from '../engine/geo.js';
import { HandModel } from './handmodel.js';
import { makePaw } from './paw.js';

const SKIN = '#e3b296';
function armGeo(side) {
  const p = new Prop(); const s = side; // built along -z (forward), origin at the elbow
  // bare forearm (no sleeve): thicker by the elbow, slimmer at the wrist, a soft muscle bulge on top
  p.cyl(0.044, 0.031, 0.33, SKIN, 0, 0, -0.165, Math.PI / 2, 0, 0, 16).sph(0.041, SKIN, 0, 0.006, -0.07, 1, 0.92, 2.1, 14)
    .sph(0.032, SKIN, 0, 0, -0.318, 1.12, 0.78, 0.6, 12);
  return p.build();
}
function handGeo(side, curl) { // palm faces inward (+x for the right hand), fingers curl around a grip point
  const p = new Prop(); const s = side;
  p.rbox(0.03, 0.085, 0.09, 0.014, SKIN, 0, 0, -0.045);
  for (let f = 0; f < 4; f++) { const y = 0.03 - f * 0.02; const L = [0.045, 0.05, 0.047, 0.038][f];
    p.cyl(0.009, 0.009, L * 0.55, SKIN, -s * 0.004, y, -0.09 - L * 0.25, Math.PI / 2 - curl * 0.6, 0, 0, 8);
    p.cyl(0.0085, 0.008, L * 0.5, SKIN, -s * (0.012 + curl * 0.03), y, -0.105 - L * 0.4 + curl * 0.04, Math.PI / 2 - curl * 1.4, 0, 0, 8); }
  p.cyl(0.011, 0.01, 0.05, SKIN, -s * 0.02, 0.045, -0.04, 0.4 + curl * 0.6, 0, s * 0.9, 8);
  return p.build();
}
export class FPHands {
  constructor() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
    this.group = new THREE.Group(); this.group.scale.setScalar(0.82); G.camera.add(this.group);
    this.arms = {};
    for (const [k, s] of [['R', 1], ['L', -1]]) {
      const arm = new THREE.Group(); const fore = new THREE.Mesh(armGeo(s), mat); arm.add(fore);
      const model = new HandModel(k, { cuff: false, watch: k === 'L' });
      const hand = model.root; hand.position.set(0, 0, -0.31); hand.rotation.set(0, 0, -s * Math.PI / 2 * 0.85); arm.add(hand);
      fore.castShadow = false; this.group.add(arm);
      this.arms[k] = { arm, hand, model, s, rest: new THREE.Vector3(s * 0.25, -0.34, -0.02), pose: new THREE.Vector3(), rot: new THREE.Euler(), punch: 0, mouth: 0 };
    }
    this.gripPoint = this.arms.R.model.gripPoint;
    // Chip's two front paws instead of hands when you're playing as him
    this.pawGroup = new THREE.Group(); G.camera.add(this.pawGroup); this.paws = {};
    for (const [k, s] of [['R', 1], ['L', -1]]) { const g = makePaw(s); this.pawGroup.add(g); this.paws[k] = { g, s, ph: k === 'R' ? 0 : Math.PI }; }
    this.bob = 0;
  }
  setVisible(v) { this.group.visible = v; }
  // paws: low down at the bottom of the view, padding along in turn as you trot, a swipe forward for a "punch"
  updatePaws(dt, player) {
    const moving = (player.speedXZ || 0) > 0.2; this.bob += dt * (moving ? 11 : 2); const narrow = innerWidth < innerHeight ? 0.6 : 1;
    for (const k of ['R', 'L']) { const a = this.paws[k]; const arm = this.arms[k];
      const step = moving ? Math.sin(this.bob + a.ph) : 0; const t = new THREE.Vector3(a.s * 0.09 * narrow, -0.17 + Math.max(0, step) * 0.03, -0.42 - step * 0.04);
      let rx = 0.75 + step * 0.2;
      if (arm.punch > 0) { const p = Math.sin((1 - arm.punch) * Math.PI); t.add(new THREE.Vector3(-a.s * 0.05, 0.1, -0.16).multiplyScalar(p)); rx -= p * 0.7; arm.punch -= dt * 4; }
      a.g.position.lerp(t, 1 - Math.exp(-dt * 14)); a.g.rotation.set(rx, -a.s * 0.12, a.s * 0.08); }
  }
  punch(side = 'R') { this.arms[side].punch = 1; }
  toMouth(side = 'R') { this.arms[side].mouth = 1; }
  // world transform of the right-hand grip, with the item pushed out so it sits in the fingers
  gripWorld(outP, outQ, radius = 0.04) {
    this.group.updateWorldMatrix(true, true);
    this.gripPoint.getWorldPosition(outP); this.gripPoint.getWorldQuaternion(outQ);
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(outQ); outP.addScaledVector(down, Math.max(0, radius - 0.02));
    return outP;
  }
  update(dt, player) {
    const dog = !!G.dog?.playerControlled; const base = !G.xr && !player.thirdPerson && !G.ui?.modalOpen;
    const show = base && !dog; this.group.visible = show; this.pawGroup.visible = base && dog; // Chip gets paws, everyone else bare hands
    if (base && dog) return this.updatePaws(dt, player); if (!show) return;
    const h = player.holders.D; const item = h && h.kind === 'item' && h.attach;
    const heavy = h && !item; // people, doors, heavy furniture: both hands reach forward
    const moving = (player.speedXZ || 0) > 0.2; this.bob += dt * (moving ? 9 : 2);
    const narrow = innerWidth < innerHeight ? 0.5 : 1; // phone held upright: bring the hands in so held things stay on screen
    for (const k of ['R', 'L']) {
      const a = this.arms[k]; const target = a.rest.clone(); target.x *= narrow;
      let rx = 0.12, ry = -a.s * 0.12, rz = 0;
      if (k === 'R' && item) { target.set(0.17 * narrow, narrow < 1 ? -0.2 : -0.22, -0.02); rx = 0.25; ry = -0.18; }
      if (heavy) { target.set(a.s * 0.14 * narrow, -0.15, -0.12); rx = 0.05; ry = -a.s * 0.25; }
      if (!h && !moving) target.y -= 0.03;
      target.y += Math.sin(this.bob) * (moving ? 0.012 : 0.004); target.x += Math.cos(this.bob * 0.5) * (moving ? 0.008 : 0.002);
      // throw wind-up while charging
      if (k === 'R' && h && player.charge > 0) { target.add(new THREE.Vector3(0.05, 0.05, 0.14).multiplyScalar(player.charge)); rx -= player.charge * 0.6; }
      // punch: snap forward and back
      if (a.punch > 0) { const p = Math.sin((1 - a.punch) * Math.PI); target.add(new THREE.Vector3(-a.s * 0.08, 0.06, -0.3).multiplyScalar(p)); rx -= p * 0.2; a.punch -= dt * 5; }
      // lift to the mouth (eating / drinking)
      if (a.mouth > 0) { const p = Math.sin((1 - a.mouth) * Math.PI); target.lerp(new THREE.Vector3(0.03, -0.1, -0.12), p); rx += p * 1.0; ry += p * 0.6; a.mouth -= dt * 1.4; }
      a.pose.lerp(target, 1 - Math.exp(-dt * 16)); a.arm.position.copy(a.pose);
      a.rot.x = lerp(a.rot.x, rx, 1 - Math.exp(-dt * 14)); a.rot.y = lerp(a.rot.y, ry, 1 - Math.exp(-dt * 14)); a.rot.z = rz; a.arm.rotation.copy(a.rot);
      const fist = a.punch > 0, grip = (k === 'R' && item) || heavy;
      a.model.pose(fist ? 'fist' : (grip || a.mouth > 0) ? 'grip' : 'relaxed', dt, fist ? 25 : 12);
    }
  }
}
