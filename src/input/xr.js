// Meta Quest 3: hand tracking first (your real hands, with a Christmas-jumper cuff), controllers as fallback.
// Gestures: fist=grab, fist-swing=punch, pinch=use/write, pinch-drag in air=walk/turn, palm-up=wrist menu,
// hand above head=challenge, point 1s=accuse, clap, cover ears, facepalm, food-to-mouth, palm-down sweep/stamp=kick.
import * as THREE from 'three';
import { G, GR, groups, ALL, emit, clamp } from '../core.js';
import { overlapSphere, raycast } from '../engine/physics.js';
import { sfx, setMuted } from '../engine/audio.js';
import { HandModel } from './handmodel.js';
import { makePaw } from './paw.js';

const JOINTS = ['wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'];
const BONES = []; for (let f = 0; f < 5; f++) { const s = f === 0 ? 0 : 0; const base = f === 0 ? 1 : 5 + (f - 1) * 5; const n = f === 0 ? 4 : 5; BONES.push([0, base]); for (let i = 0; i < n - 1; i++) BONES.push([base + i, base + i + 1]); }
const GRAB_GROUPS = groups(GR.SENSOR, ALL & ~GR.PLAYER);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class XRInput {
  constructor(player) {
    this.player = player; this.hands = { L: null, R: null };
    const xr = G.renderer.xr; const rig = player.rig;
    const skin = new THREE.MeshStandardMaterial({ color: '#e9c2a6', roughness: 0.6, emissive: '#000000' });
    this.skinMat = skin;
    for (let i = 0; i < 2; i++) {
      const ctrl = xr.getController(i), grip = xr.getControllerGrip(i), hand = xr.getHand(i);
      rig.add(ctrl, grip, hand);
      const rec = { i, ctrl, grip, hand, source: null, palm: new THREE.Vector3(), q: new THREE.Quaternion(), vel: new THREE.Vector3(), hist: [], fist: false, pinch: false, pinchT: 0,
        tracked: false, key: null, joints: [], tip: new THREE.Vector3(), thumbTip: new THREE.Vector3(), normal: new THREE.Vector3(), pointT: 0, raiseT: 0, punchCD: 0, pokeCD: 0, kickCD: 0 };
      ctrl.addEventListener('connected', (e) => { rec.source = e.data; rec.key = e.data.handedness === 'left' ? 'L' : 'R'; this.hands[rec.key] = rec; rec.isHand = !!e.data.hand; this.buildVisual(rec); });
      ctrl.addEventListener('disconnected', () => { if (rec.key && this.hands[rec.key] === rec) this.hands[rec.key] = null; if (rec.vis) rec.vis.visible = false; if (rec.paw) { G.scene.remove(rec.paw); rec.paw = null; } if (rec.model) { rec.model.root.parent?.remove(rec.model.root); } rec.vis = null; rec.model = null; });
    }
    // wrist menu panel
    this.panel = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.17), new THREE.MeshBasicMaterial({ transparent: true, depthTest: true }));
    this.panel.visible = false; G.scene.add(this.panel);
    this.locoStart = null; this.turnStart = null; this.prevHeadY = null; this.headVy = 0;
    G.renderer.xr.addEventListener('sessionstart', () => { emit('xrstart'); this.placeOnStart(); });
    G.renderer.xr.addEventListener('sessionend', () => emit('xrend'));
  }
  placeOnStart() {
    const p = this.player;
    p.rig.position.set(p.pos.x, 0, p.pos.z); p.rig.rotation.set(0, p.yaw, 0);
    G.camera.position.set(0, 0, 0); G.camera.rotation.set(0, 0, 0);
  }
  buildVisual(rec) {
    if (rec.vis) { rec.vis.visible = true; if (!rec.paw) { rec.paw = makePaw(rec.key === 'R' ? 1 : -1); rec.paw.visible = false; G.scene.add(rec.paw); } return; }
    const g = new THREE.Group(); G.scene.add(g); rec.vis = g;
    const cuffMat = new THREE.MeshStandardMaterial({ color: rec.key === 'L' ? '#20406a' : '#20406a', roughness: 0.9 });
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.04, 0.09, 16, 1, true), cuffMat); cuff.material.side = THREE.DoubleSide;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.015, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#f2f2f2', side: THREE.DoubleSide })); band.position.y = -0.02; cuff.add(band);
    const band2 = band.clone(); band2.material = new THREE.MeshStandardMaterial({ color: '#c0282d', side: THREE.DoubleSide }); band2.position.y = 0.0; cuff.add(band2);
    rec.cuff = cuff; g.add(cuff);
    if (rec.key === 'L') { const watch = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.008, 16), new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.6 })); watch.rotation.x = Math.PI / 2; watch.position.set(0, -0.055, 0.035); rec.watch = watch; cuff.add(watch); }
    // realistic articulated hand (tracked joints in hand-tracking mode, posed from the buttons with controllers)
    rec.model = new HandModel(rec.key, { cuff: false, watch: rec.key === 'L' }); // bare hands, no sleeve, same as on the phone
    rec.paw = makePaw(rec.key === 'R' ? 1 : -1); rec.paw.visible = false; G.scene.add(rec.paw); // Chip's paw, shown instead of the hand when you're him
    cuff.visible = false;
    if (rec.isHand) { G.scene.add(rec.model.root); }
    else { const holder = new THREE.Group(); holder.add(rec.model.root); rec.model.root.rotation.set(-0.5, 0, (rec.key === 'L' ? 1 : -1) * Math.PI / 2 * 0.9); rec.model.root.position.set(0, -0.01, 0.07); g.add(holder); rec.ctrlHand = holder; }
    this.skinMat = rec.model.mat;
  }
  // when you're Chip the hand is swapped for a paw that follows it
  pawUpdate(rec) {
    const dog = !!G.dog?.playerControlled; if (rec.model) rec.model.root.visible = !dog; if (rec.watch) rec.watch.visible = !dog; if (!rec.paw) return;
    rec.paw.visible = dog && !!rec.vis?.visible; if (!dog) return;
    rec.paw.position.copy(rec.palm); rec.paw.quaternion.copy(rec.q);
  }
  jointPos(rec, name, out) { const j = rec.hand.joints[name]; if (!j) return null; return j.getWorldPosition(out); }

  update(dt, frame) {
    const p = this.player;
    p.rig.updateMatrixWorld(true);
    const head = p.headPos(new THREE.Vector3());
    // head bob for stamp-kick detection
    if (this.prevHeadY !== null) { const vy = (head.y - this.prevHeadY) / Math.max(dt, 1e-3); this.stampDetect(vy, dt); }
    this.prevHeadY = head.y;
    for (const key of ['L', 'R']) { const rec = this.hands[key]; if (rec) this.updateHand(rec, dt, head); }
    // keep the physics capsule under the head (for doors etc.) and the player position
    p.pos.set(head.x, p.rig.position.y, head.z);
    p.body.setNextKinematicTranslation({ x: head.x, y: p.rig.position.y + 0.82, z: head.z });
    this.twoHandGestures(dt, head);
    this.wristMenu(head);
    this.controllerSticks(dt, head);
  }

  updateHand(rec, dt, head) {
    const p = this.player;
    rec.punchCD -= dt; rec.pokeCD -= dt; rec.kickCD -= dt;
    let tracked = false;
    if (rec.isHand && rec.hand.joints && rec.hand.joints['wrist']) {
      const J = rec.hand.joints; const wrist = J['wrist']; tracked = !!wrist.visible || true;
      // joints in world space
      for (let k = 0; k < 25; k++) { const j = J[JOINTS[k]]; if (!j) continue; rec.joints[k] = rec.joints[k] || new THREE.Vector3(); j.getWorldPosition(rec.joints[k]); }
      if (rec.joints.length < 25) return;
      const Jp = rec.joints;
      const palmC = _v.copy(Jp[0]).add(Jp[10]).add(Jp[11]).multiplyScalar(1 / 3);
      rec.palm.copy(palmC);
      wrist.getWorldQuaternion(rec.q);
      rec.tip.copy(Jp[9]); rec.thumbTip.copy(Jp[4]);
      // palm normal (points out of the palm)
      const a = _v2.copy(Jp[5]).sub(Jp[0]), b = new THREE.Vector3().copy(Jp[20]).sub(Jp[0]);
      rec.normal.crossVectors(a, b).normalize(); if (rec.key === 'R') rec.normal.negate();
      // gesture metrics
      const curl = (tip, base) => Jp[tip].distanceTo(Jp[base]);
      const fistAmt = (curl(14, 10) + curl(19, 15) + curl(24, 20)) / 3; // tips to metacarpals
      const indexExt = curl(9, 5);
      const pinchD = Jp[4].distanceTo(Jp[9]);
      const wasFist = rec.fist; rec.fist = wasFist ? fistAmt < 0.075 : fistAmt < 0.06;
      const wasPinch = rec.pinch; rec.pinch = wasPinch ? pinchD < 0.035 : pinchD < 0.018;
      rec.pointing = indexExt > 0.085 && fistAmt < 0.07 && pinchD > 0.04;
      rec.thumbsDir = (fistAmt < 0.065 && Jp[4].distanceTo(Jp[0]) > 0.09) ? new THREE.Vector3().subVectors(Jp[4], Jp[2]).normalize().y : 0;
      rec.open = fistAmt > 0.09;
      this.drawHand(rec); this.pawUpdate(rec);
      if (rec.fist && !wasFist) this.onGrab(rec);
      if (!rec.fist && wasFist) this.onRelease(rec);
      if (rec.pinch && !wasPinch) this.onPinch(rec, head);
      if (!rec.pinch && wasPinch) this.onPinchEnd(rec);
      if (rec.pinch) this.pinchDrag(rec, dt);
      // pointing for 1 second at someone = accuse
      if (rec.pointing) { const dir = new THREE.Vector3().subVectors(Jp[9], Jp[6]).normalize(); const t = p.personInView(Jp[9], dir, 8, false); if (t && t === rec.pointTarget) { rec.pointT += dt; if (rec.pointT > 1 && !rec.pointFired) { rec.pointFired = true; emit('accuse', t); } } else { rec.pointTarget = t; rec.pointT = 0; rec.pointFired = false; } } else { rec.pointT = 0; rec.pointFired = false; }
      // thumbs up/down
      if (Math.abs(rec.thumbsDir) > 0.75) { rec.thumbT = (rec.thumbT || 0) + dt; if (rec.thumbT > 0.6 && !rec.thumbFired) { rec.thumbFired = true; emit(rec.thumbsDir > 0 ? 'thumbsUp' : 'thumbsDown'); } } else { rec.thumbT = 0; rec.thumbFired = false; }
      // poke buttons with the index tip
      this.poke(rec);
    } else {
      // controller fallback
      rec.grip.getWorldPosition(rec.palm); rec.grip.getWorldQuaternion(rec.q);
      const gp = rec.source?.gamepad; const squeeze = gp?.buttons[1]?.value || 0, trig = gp?.buttons[0]?.value || 0;
      const wasFist = rec.fist; rec.fist = squeeze > 0.6; const wasPinch = rec.pinch; rec.pinch = trig > 0.6;
      rec.tip.set(0, -0.01, -0.09).applyQuaternion(rec.q).add(rec.palm);
      rec.normal.set(rec.key === 'L' ? 1 : -1, 0, 0).applyQuaternion(rec.q);
      if (rec.vis) { rec.vis.position.copy(rec.palm); rec.vis.quaternion.copy(rec.q); rec.model?.pose(squeeze > 0.6 ? (this.player.holders[rec.key] ? 'grip' : 'fist') : trig > 0.6 ? 'pinch' : squeeze > 0.2 ? 'relaxed' : 'open', dt, 14); }
      this.pawUpdate(rec);
      if (rec.fist && !wasFist) this.onGrab(rec); if (!rec.fist && wasFist) this.onRelease(rec);
      if (rec.pinch && !wasPinch) this.onPinch(rec, head); if (!rec.pinch && wasPinch) this.onPinchEnd(rec);
      // buttons: A/X = hand up/kick, B/Y = drink/menu
      const b4 = gp?.buttons[4]?.pressed, b5 = gp?.buttons[5]?.pressed;
      if (b4 && !rec.b4) { if (rec.key === 'R') emit('handUp'); else this.player.kick(this.player.forward(new THREE.Vector3()).setY(0).normalize()); }
      if (b5 && !rec.b5) { if (rec.key === 'R') this.player.consume(rec.key); else emit('menu'); }
      rec.b4 = b4; rec.b5 = b5;
      this.poke(rec);
    }
    // velocity history
    rec.hist.push([rec.palm.clone(), G.time]); while (rec.hist.length > 6) rec.hist.shift();
    if (rec.hist.length > 1) { const [p0, t0] = rec.hist[0]; rec.vel.copy(rec.palm).sub(p0).divideScalar(Math.max(1e-3, G.time - t0)); }
    const speed = rec.vel.length();
    // punch: closed fist moving fast into someone
    if (rec.fist && speed > 2.2 && rec.punchCD <= 0 && !p.holders[rec.key]) {
      const hits = overlapSphere(rec.palm, 0.09, GRAB_GROUPS);
      const ch = hits.find(h => h.entry.kind === 'char' && !h.entry.ref.isPlayer);
      if (ch) { rec.punchCD = 0.45; const pp = ch.entry.ref; if (pp.protected) emit('protectedHit', pp); else { pp.playerHitT = G.time; pp.knock(rec.vel.clone().normalize().setY(0.35).normalize().multiplyScalar(pp.mass * Math.min(4, speed) * 0.9), ch.entry.part); sfx('boff', rec.palm, 1); p.knockCrown(pp, rec.vel.clone().normalize()); emit('punched', pp, rec.vel); p.stats.punches++; this.haptic(rec, 0.8, 80); } }
      const it = hits.find(h => h.entry.kind === 'item' && !h.entry.ref.held && !h.entry.ref.type.fixed);
      if (!ch && it) { rec.punchCD = 0.2; it.entry.ref.body.applyImpulse(rec.vel.clone().multiplyScalar(it.entry.ref.type.mass * 0.8), true); }
    }
    // two-palm shove
    // palm-down sweep near the floor = kick
    if (rec.isHand && rec.palm.y - p.rig.position.y < 0.55 && rec.normal.y < -0.6 && Math.hypot(rec.vel.x, rec.vel.z) > 1.4 && rec.kickCD <= 0) { rec.kickCD = 0.8; p.kick(new THREE.Vector3(rec.vel.x, 0, rec.vel.z).normalize(), new THREE.Vector3(p.pos.x, p.rig.position.y + 0.35, p.pos.z)); }
    // hand above head = put your hand up / challenge
    if (rec.palm.y > head.y + 0.12) { rec.raiseT += dt; if (rec.raiseT > 0.35 && !rec.raised) { rec.raised = true; emit('handUp'); } } else { rec.raiseT = 0; rec.raised = false; }
    // food/drink to mouth
    const held = p.heldItem(rec.key);
    if (held && rec.palm.distanceTo(_v.copy(head).add(new THREE.Vector3(0, -0.08, 0))) < 0.16) { rec.mouthT = (rec.mouthT || 0) + dt; if (rec.mouthT > 0.5) { rec.mouthT = -0.6; p.consume(rec.key); } } else rec.mouthT = 0;
    // grabbable highlight: fingers glow gold
    if (G.frame % 4 === rec.i && rec.model) { const near = !p.holders[rec.key] && this.findGrab(rec.palm, 0.12); rec.model.setGlow(!!near); }
  }
  drawHand(rec) {
    if (!rec.model) return; const jr = rec.hand.joints; const q = new THREE.Quaternion();
    for (let k = 0; k < 25; k++) { const j = jr[JOINTS[k]]; if (!j) continue; j.getWorldQuaternion(q); rec.model.setJoint(k, rec.joints[k], q); }
  }
  findGrab(pos, r) {
    const hits = overlapSphere(pos, r, GRAB_GROUPS); let best = null, bd = 1e9;
    for (const h of hits) { const e = h.entry; if (!['item', 'char', 'hinged', 'tree'].includes(e.kind)) continue; if (e.kind === 'char' && e.ref.isPlayer) continue; if (e.kind === 'item' && (e.ref.held || e.ref.type.fixed)) continue; if (e.kind === 'tree') continue;
      const t = h.collider.translation(); const d = (t.x - pos.x) ** 2 + (t.y - pos.y) ** 2 + (t.z - pos.z) ** 2; const pr = e.kind === 'item' ? 0 : 0.01; if (d + pr < bd) { bd = d + pr; best = { ...e, point: pos.clone(), dist: Math.sqrt(d) }; } }
    return best;
  }
  onGrab(rec) {
    const p = this.player; if (p.holders[rec.key]) return;
    const f = this.findGrab(rec.palm, 0.11);
    if (f) { if (p.tryGrab(rec.key, f, rec.palm.clone())) { sfx(f.kind === 'char' ? 'oof' : 'tap', rec.palm, 0.5); this.haptic(rec, 0.4, 40); } return; }
    // protected (kids / dog) feedback
    for (const c of [...G.chars, G.dog]) { if (!c || c.isPlayer || !(c.protected || c.isDog)) continue; const cp = c.chestPos ? c.chestPos(_v) : c.pos; if (cp.distanceTo(rec.palm) < 0.3) { emit(c.isDog ? 'pet' : 'protectedTouch', c); break; } }
  }
  onRelease(rec) {
    const p = this.player; const h = p.holders[rec.key]; if (!h) return;
    const sp = rec.vel.length();
    p.release(rec.key, sp > 1.0 ? rec.vel.clone().multiplyScalar(h.kind === 'char' ? (h.twoHand ? 1.2 : 1.0) * (G.modes?.id === 'fling' ? 1.7 : 1) : 1.35) : null);
  }
  onPinch(rec, head) {
    const p = this.player;
    if (G.vrHud?.menuOpen()) return; // the trigger is choosing a menu item
    if (G.minigames?.vrPinch?.(rec)) return; // a mini game wants the trigger (e.g. pulling a snowball to your hand)
    if (G.popup?.S?.tap) { G.popup.S.tap.onTap(); return; } // PULL! / TEAR! in the headset: pull the trigger
    // pinch an item held in the other hand = use it (pull cracker, open can, click pen)
    const held = p.heldItem(rec.key) || p.heldItem(rec.key === 'L' ? 'R' : 'L');
    const near = this.findGrab(rec.tip, 0.07);
    if (held && near && near.kind === 'item' && near.ref === held) { G.interact.useItem(held, p, rec.key); return; }
    if (near && near.kind === 'item' && near.ref.type.use) { G.interact.useItem(near.ref, p, rec.key); return; }
    if (held && held.type.use) { const hk = p.heldItem(rec.key) ? rec.key : (rec.key === 'L' ? 'R' : 'L'); G.interact.useItem(held, p, hk); return; }
    // spots (doorbell, flush, switch)
    for (const s of G.house.interact) if (s.pos.distanceTo(rec.tip) < s.r * 0.6) { G.interact.useSpot(s.id, p); return; }
    // otherwise: start pinch-drag locomotion (left) or turning (right)
    rec.dragStart = rec.palm.clone().sub(p.rig.position); rec.dragging = true;
  }
  onPinchEnd(rec) { rec.dragging = false; rec.turnAcc = 0; G.minigames?.vrPinchEnd?.(rec); }
  pinchDrag(rec, dt) {
    if (!rec.dragging) return; const p = this.player;
    const cur = rec.palm.clone().sub(p.rig.position); const d = cur.clone().sub(rec.dragStart);
    if ((rec.key === 'L') !== !!G.settings.leftHanded) {
      // world-pull walking: drag your pinched hand back to move forward
      const mv = new THREE.Vector3(-d.x, 0, -d.z).multiplyScalar(2.2);
      const len = mv.length(); if (len > 1e-4) {
        const head = p.headPos(new THREE.Vector3()); const hit = raycast(new THREE.Vector3(head.x, head.y - 0.6, head.z), mv.clone().normalize(), len + 0.3, groups(GR.SENSOR, GR.STATIC | GR.DOOR));
        if (!hit) p.rig.position.add(mv);
      }
      rec.dragStart.copy(cur);
    } else {
      // turning: drag sideways
      const head = p.headPos(new THREE.Vector3()); const right = new THREE.Vector3(1, 0, 0).applyQuaternion(G.camera.getWorldQuaternion(new THREE.Quaternion())); const side = d.dot(right);
      if (Math.abs(side) > 0.09) { this.snapTurn(side > 0 ? -1 : 1, head); rec.dragStart.copy(cur); }
    }
  }
  snapTurn(sign, head) {
    const p = this.player; const a = (G.settings.snapAngle || 30) * Math.PI / 180 * sign;
    const piv = head.clone(); p.rig.position.sub(piv).applyAxisAngle(UP, a).add(piv); p.rig.rotateY(a); p.yaw += a; sfx('click', null, 0.2);
  }
  controllerSticks(dt, head) {
    const p = this.player;
    if (G.vrHud?.menuOpen()) return; // the sticks drive the menu while it's up
    for (const key of ['L', 'R']) {
      const rec = this.hands[key]; const gp = rec?.source?.gamepad; if (!gp || rec.isHand) continue;
      const ax = gp.axes.length >= 4 ? [gp.axes[2], gp.axes[3]] : [gp.axes[0], gp.axes[1]];
      if (key === 'L') {
        const fwd = p.forward(new THREE.Vector3()).setY(0).normalize(); const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
        const mv = fwd.multiplyScalar(-ax[1]).add(right.multiplyScalar(ax[0])); if (mv.lengthSq() > 0.02) {
          mv.multiplyScalar(2.2 * dt); const hit = raycast(new THREE.Vector3(head.x, head.y - 0.6, head.z), mv.clone().normalize(), mv.length() + 0.3, groups(GR.SENSOR, GR.STATIC | GR.DOOR)); if (!hit) p.rig.position.add(mv); }
      } else {
        if (G.settings.smoothTurn) { if (Math.abs(ax[0]) > 0.2) { const a = -ax[0] * dt * 2; const piv = head.clone(); p.rig.position.sub(piv).applyAxisAngle(UP, a).add(piv); p.rig.rotateY(a); } }
        else { if (Math.abs(ax[0]) > 0.7 && !rec.snapped) { rec.snapped = true; this.snapTurn(ax[0] > 0 ? -1 : 1, head); } if (Math.abs(ax[0]) < 0.3) rec.snapped = false; }
      }
    }
  }
  twoHandGestures(dt, head) {
    const L = this.hands.L, R = this.hands.R; if (!L || !R || !L.isHand || !R.isHand) return;
    const d = L.palm.distanceTo(R.palm);
    // clap
    const closing = new THREE.Vector3().subVectors(L.vel, R.vel).dot(new THREE.Vector3().subVectors(R.palm, L.palm).normalize());
    if (d < 0.07 && closing > 0.6 && !this.clapped && L.open && R.open) { this.clapped = true; sfx('slap', L.palm, 0.8); emit('clap'); }
    if (d > 0.15) this.clapped = false;
    // cover ears: both hands either side of the head
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(G.camera.getWorldQuaternion(new THREE.Quaternion()));
    const lE = L.palm.distanceTo(_v.copy(head).addScaledVector(right, -0.09)), rE = R.palm.distanceTo(_v2.copy(head).addScaledVector(right, 0.09));
    if (lE < 0.11 && rE < 0.11) { this.earT = (this.earT || 0) + dt; if (this.earT > 0.3 && !this.earsFired) { this.earsFired = true; setMuted(3); emit('coverEars'); } } else { this.earT = 0; this.earsFired = false; }
    // facepalm: an open hand right in front of the face
    const fwd = this.player.forward(new THREE.Vector3());
    for (const h of [L, R]) { const fp = h.palm.distanceTo(_v.copy(head).addScaledVector(fwd, 0.07)); if (fp < 0.08 && h.open && !this.player.holders[h.key]) { h.faceT = (h.faceT || 0) + dt; if (h.faceT > 0.4 && !h.faceFired) { h.faceFired = true; emit('facepalm'); } } else { h.faceT = 0; h.faceFired = false; } }
    // two-palm shove
    if (L.open && R.open && L.vel.length() > 1.6 && R.vel.length() > 1.6 && d < 0.5 && !this.shoveCD) {
      const mid = L.palm.clone().add(R.palm).multiplyScalar(0.5); const hits = overlapSphere(mid, 0.25, GRAB_GROUPS); const ch = hits.find(h => h.entry.kind === 'char' && !h.entry.ref.isPlayer && !h.entry.ref.protected);
      if (ch) { this.shoveCD = true; setTimeout(() => this.shoveCD = false, 600); const p = ch.entry.ref; p.playerHitT = G.time; p.knock(L.vel.clone().add(R.vel).multiplyScalar(0.5 * p.mass * 0.9).setY(p.mass * 0.6), 1); sfx('boff', mid, 1); emit('shoved', p); }
    }
  }
  stampDetect(vy, dt) {
    // a quick dip and recover of the headset = stamping your foot = kick
    this.headVy = vy;
    if (vy < -0.55) this.dipT = G.time;
    if (vy > 0.35 && this.dipT && G.time - this.dipT < 0.18 && (!this.lastStamp || G.time - this.lastStamp > 0.9)) {
      this.lastStamp = G.time; this.dipT = 0; const p = this.player; p.kick(p.forward(new THREE.Vector3()).setY(0).normalize(), new THREE.Vector3(p.pos.x, p.rig.position.y + 0.35, p.pos.z));
    }
  }
  wristMenu(head) {
    const L = this.hands.L; const show = !!L && L.normal.y > 0.55 && !this.player.holders.L;
    this.panel.visible = show; G.ui && (G.ui.wristVisible = show);
    if (!show) return;
    if (G.ui?.wristTexture && this.panel.material.map !== G.ui.wristTexture) { this.panel.material.map = G.ui.wristTexture; this.panel.material.needsUpdate = true; }
    this.panel.position.copy(L.palm).add(new THREE.Vector3(0, 0.13, 0));
    this.panel.lookAt(head);
  }
  poke(rec) {
    if (rec.pokeCD > 0) return;
    const tip = rec.tip;
    // wrist menu (only the other hand pokes)
    if (this.panel.visible && rec.key === 'R') {
      const local = this.panel.worldToLocal(tip.clone());
      if (Math.abs(local.z) < 0.02 && Math.abs(local.x) < 0.13 && Math.abs(local.y) < 0.085) { const u = local.x / 0.26 + 0.5, v = 0.5 - local.y / 0.17; if (G.ui?.pressWrist(u, v)) { rec.pokeCD = 0.5; sfx('click', tip, 0.5); this.haptic(rec, 0.3, 20); } }
    }
    // answer sheet clipboard options
    const sheet = G.quiz?.sheetItem; if (sheet && sheet.alive) {
      const t = sheet.body.translation(), r = sheet.body.rotation(); const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
      const local = tip.clone().sub(new THREE.Vector3(t.x, t.y, t.z)).applyQuaternion(q.invert());
      if (local.y > -0.005 && local.y < 0.03 && Math.abs(local.x) < 0.11 && Math.abs(local.z) < 0.15) { const u = local.x / 0.21 + 0.5, v = (local.z + 0.15) / 0.3; if (G.quiz.pokeSheet(u, v)) { rec.pokeCD = 0.6; sfx('click', tip, 0.6); this.haptic(rec, 0.3, 20); } }
    }
  }
  haptic(rec, intensity, ms) { try { rec.source?.gamepad?.hapticActuators?.[0]?.pulse(intensity, ms); } catch (e) {} }
}
