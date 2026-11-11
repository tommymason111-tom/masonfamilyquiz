// First-person hands (flat-screen modes): Tommy's arms in his fair-isle jumper, with a watch, that hold
// things, reach for heavy things/people, punch, and lift food & drink to your mouth.
import * as THREE from 'three';
import { G, clamp, lerp } from '../core.js';
import { Prop } from '../engine/geo.js';
import { HandModel } from './handmodel.js';

const SKIN = '#e9c2a6', KNIT = '#20406a', BAND = '#f2f2f2', RED = '#c0282d';
function armGeo(side) {
  const p = new Prop(); const s = side; // built along -z (forward), origin at the elbow
  p.cyl(0.05, 0.045, 0.32, KNIT, 0, 0, -0.16, Math.PI / 2, 0, 0, 14).cyl(0.051, 0.051, 0.03, BAND, 0, 0, -0.24, Math.PI / 2, 0, 0, 14).cyl(0.052, 0.052, 0.015, RED, 0, 0, -0.27, Math.PI / 2, 0, 0, 14)
    .cyl(0.047, 0.047, 0.04, KNIT, 0, 0, -0.31, Math.PI / 2, 0, 0, 14);
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
    this.bob = 0;
  }
  setVisible(v) { this.group.visible = v; }
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
    const show = !G.xr && !player.thirdPerson && !G.ui?.modalOpen; this.group.visible = show; if (!show) return;
    const h = player.holders.D; const item = h && h.kind === 'item' && h.attach;
    const heavy = h && !item; // people, doors, heavy furniture: both hands reach forward
    const moving = (player.speedXZ || 0) > 0.2; this.bob += dt * (moving ? 9 : 2);
    for (const k of ['R', 'L']) {
      const a = this.arms[k]; const target = a.rest.clone();
      let rx = 0.12, ry = -a.s * 0.12, rz = 0;
      if (k === 'R' && item) { target.set(0.17, -0.22, -0.02); rx = 0.25; ry = -0.18; }
      if (heavy) { target.set(a.s * 0.14, -0.15, -0.12); rx = 0.05; ry = -a.s * 0.25; }
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
