// MASON TV REPLAY: records every moving thing 30x a second (positions, not video), plays the last few
// seconds back on Martin's TV from the corner camera — slow-mo on impact, then a second angle — with a
// Sky-Sports-style banner, a score out of 10 for big throws, VAR reviews, and the Replay of the Night.
import * as THREE from 'three';
import { G, on, emit, pick, clamp } from '../core.js';
import { PART_COUNT } from '../chars/body.js';

const RATE = 30, SECS = 15, FRAMES = RATE * SECS;
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _m2 = new THREE.Matrix4();

export class Replay {
  constructor() {
    G.replay = this;
    this.rt = new THREE.WebGLRenderTarget(512, 288, { samples: 2 }); this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.05, 60);
    this.active = null; this.acc = 0; this.highlights = [];
    this.track = []; // {get(arr,o), set(arr,o)} 7 floats each
    this.buildTracks();
    this.buf = new Float32Array(FRAMES * this.track.length * 7); this.times = new Float32Array(FRAMES); this.head = 0; this.count = 0;
    this.live = new Float32Array(this.track.length * 7);
    on('thrown', (h, vel) => this.onThrow(h, vel));
    on('treeFell', () => this.trigger('THE TREE IS DOWN', G.tree.group.position.clone()));
    on('trifleDown', (p) => this.trigger('TRIFLE DOWN', p));
    on('tvHit', (p) => this.trigger('DIRECT HIT ON THE TELLY', G.house.tv.center.clone()));
    on('chipStole', (it) => { const t = it.body.translation(); this.trigger('CHIP STEALS THE FOOD', new THREE.Vector3(t.x, 0.5, t.z)); });
    on('glassSquash', (p) => this.trigger('FACE ON THE GLASS', p.world[0].p.clone()));
    on('corkHit', (p) => this.trigger('PROSECCO CORK STRIKE', p.headPos(new THREE.Vector3())));
    on('garyLostOutfit', (p) => this.trigger('GARY\'S DIGNITY: COMPROMISED', p.world[0].p.clone()));
  }
  buildTracks() {
    const T = this.track;
    for (const inst of G.items.instances) { const mesh = inst.type.mesh; T.push({ kind: 'item', inst, mesh, idx: inst.index }); }
    for (const p of G.chars) for (let i = 0; i < PART_COUNT; i++) T.push({ kind: 'bone', bone: p.bones[i] });
    if (G.tree) T.push({ kind: 'obj', obj: G.tree.group });
    if (G.dog?.rig) for (const b of G.dog.rig.bones) T.push({ kind: 'obj', obj: b }); else if (G.dog) T.push({ kind: 'obj', obj: G.dog.root }, { kind: 'obj', obj: G.dog.body });
    for (const h of G.items.hinged) T.push({ kind: 'obj', obj: h.mesh });
  }
  // write current state into arr
  capture(arr) {
    let o = 0;
    for (const t of this.track) {
      if (t.kind === 'item') { if (t.inst.alive && t.inst.index === t.idx) { const b = t.inst.body.translation(), r = t.inst.body.rotation(); arr[o] = b.x; arr[o + 1] = b.y; arr[o + 2] = b.z; arr[o + 3] = r.x; arr[o + 4] = r.y; arr[o + 5] = r.z; arr[o + 6] = r.w; } else { arr[o + 1] = -100; } }
      else { const ob = t.kind === 'bone' ? t.bone : t.obj; arr[o] = ob.position.x; arr[o + 1] = ob.position.y; arr[o + 2] = ob.position.z; arr[o + 3] = ob.quaternion.x; arr[o + 4] = ob.quaternion.y; arr[o + 5] = ob.quaternion.z; arr[o + 6] = ob.quaternion.w; }
      o += 7;
    }
  }
  apply(arr, off = 0) {
    let o = off;
    for (const t of this.track) {
      if (t.kind === 'item') { if (arr[o + 1] > -50) { _m.compose(_p.set(arr[o], arr[o + 1], arr[o + 2]), _q.set(arr[o + 3], arr[o + 4], arr[o + 5], arr[o + 6]), _s.set(1, 1, 1)); t.mesh.setMatrixAt(t.idx, _m); t.mesh.instanceMatrix.needsUpdate = true; } }
      else { const ob = t.kind === 'bone' ? t.bone : t.obj; ob.position.set(arr[o], arr[o + 1], arr[o + 2]); ob.quaternion.set(arr[o + 3], arr[o + 4], arr[o + 5], arr[o + 6]); }
      o += 7;
    }
  }
  record(dt) {
    this.acc += dt; if (this.acc < 1 / RATE) return; this.acc = 0;
    const n = this.track.length * 7; this.capture(this.buf.subarray(this.head * n, this.head * n + n)); this.times[this.head] = G.time;
    this.head = (this.head + 1) % FRAMES; this.count = Math.min(FRAMES, this.count + 1);
  }
  frameAt(t) { // index of recorded frame nearest to time t
    let best = -1, bd = 1e9; for (let i = 0; i < this.count; i++) { const k = (this.head - 1 - i + FRAMES) % FRAMES; const d = Math.abs(this.times[k] - t); if (d < bd) { bd = d; best = k; } if (this.times[k] < t - 1) break; } return best;
  }
  onThrow(h, vel) {
    const sp = vel.length(); if (sp < 5 && h.kind !== 'char') return;
    const b = h.body; const start = b.translation(); const rec = { start: new THREE.Vector3(start.x, start.y, start.z), maxY: start.y, t0: G.time, h };
    const watch = () => { const t = b.translation(); rec.maxY = Math.max(rec.maxY, t.y); const v = b.linvel(); if (G.time - rec.t0 > 0.6 && Math.hypot(v.x, v.y, v.z) < 1 || G.time - rec.t0 > 4) {
      const dist = Math.hypot(t.x - rec.start.x, t.z - rec.start.z); const height = rec.maxY - rec.start.y; const score = clamp(Math.round((dist * 1.1 + height * 2 + (h.kind === 'char' ? 2 : 0)) * 10) / 10, 0, 10);
      this.lastRating = { dist, height, score }; G.systems && (G.systems.bestThrow = Math.max(G.systems.bestThrow || 0, score)); emit('throwRated', h, this.lastRating);
      if (h.kind === 'char' && dist > 2.2) this.trigger((h.ref.name || 'SOMEONE').toUpperCase() + ' GOES FLYING', new THREE.Vector3(t.x, t.y, t.z), score);
      return; } requestAnimationFrame(watch); };
    requestAnimationFrame(watch);
  }
  trigger(label, focus, score) {
    if (this.active || this.count < 30) return;
    const now = G.time;
    this.active = { label, focus: focus.clone(), t0: now - 3.5, t1: now + 0.5, play: 0, pass: 0, score: score ?? null, started: G.time };
    // corner camera (in the room the event happened, or the living-room corner)
    this.chooseCam(focus);
    // keep for Replay of the Night
    this.highlights.push({ label, score: score ?? 5 + Math.random() * 3, time: now, frames: this.snapshot(now - 3.5, now + 0.5), focus: focus.clone() });
    this.highlights.sort((a, b) => b.score - a.score); this.highlights.length = Math.min(5, this.highlights.length);
    emit('replay', label);
    const lines = { 'THE TREE IS DOWN': 'And the tree is DOWN! Julie\'s face!', 'TRIFLE DOWN': 'Oh no. Not the trifle.', 'DIRECT HIT ON THE TELLY': 'Right on the telly! Unbelievable!' };
    setTimeout(() => { const m = G.charByName.Martin; if (m && !m.isDown()) m.say(lines[label] || pick(['Look at the height on that!', 'What a moment!', 'We\'ll see that again in slow motion.', 'Ohhh, he\'s gone right over!']), { prio: 1 }); const p = G.charByName.Paul; if (p && !p.isDown() && Math.random() < 0.5) setTimeout(() => p.say('That\'s a FOUL!', { prio: 0 }), 2500); }, 600);
  }
  snapshot(t0, t1) {
    const out = []; const n = this.track.length * 7;
    for (let i = 0; i < this.count; i++) { const k = (this.head - this.count + i + FRAMES) % FRAMES; const tt = this.times[k]; if (tt >= t0 && tt <= t1) out.push(this.buf.slice(k * n, k * n + n)); }
    return out;
  }
  chooseCam(focus) {
    const room = G.house && Object.entries(G.house).length ? null : null;
    const corners = [[-3.3, 2.3, -0.2], [3.3, 2.3, -6.8], [6.8, 2.3, -0.3], [1.3, 2.3, 5.8], [6.8, 2.3, 0.2], [-0.9, 2.3, 5.8], [3.4, 2.3, -10.4], [-8, 3, -8], [-8.3, 2.3, 5.8]];
    let best = corners[0], bd = 1e9; for (const c of corners) { const d = Math.hypot(c[0] - focus.x, c[2] - focus.z); if (d < bd && d > 1.5) { bd = d; best = c; } }
    this.cam.position.set(...best); this.cam.lookAt(focus);
    this.cam2 = this.cam.clone(); const alt = corners.filter(c => c !== best).sort((a, b) => Math.hypot(a[0] - focus.x, a[2] - focus.z) - Math.hypot(b[0] - focus.x, b[2] - focus.z))[0]; this.cam2.position.set(...alt); this.cam2.lookAt(focus);
  }
  playHighlights(done) {
    if (!this.highlights.length) { done && done(); return; }
    let i = 0; const next = () => { if (i >= this.highlights.length) { done && done(); return; } const h = this.highlights[i++]; this.active = { label: `REPLAY OF THE NIGHT #${i}: ${h.label}`, frames: h.frames, play: 0, pass: 0, score: h.score, focus: h.focus, started: G.time, onEnd: next }; this.chooseCam(h.focus); };
    next();
  }
  // called every frame before the main render
  render() {
    if (!this.active) { this.record(G.dt); return; }
    this.record(G.dt);
    const a = this.active; const n = this.track.length * 7;
    let frames = a.frames; if (!frames) { frames = a.frames = this.snapshot(a.t0, a.t1); }
    if (!frames.length) { this.active = null; return; }
    // playback speed: slow-mo in the middle (impact), normal at the ends; then a second angle
    const L = frames.length; const pos = a.play; const k = pos / L; const slow = k > 0.55 && k < 0.95 ? 0.35 : 1;
    a.play += G.dt * RATE * slow;
    if (a.play >= L - 1) { a.pass++; a.play = 0; if (a.pass >= 2) { this.active = null; G.screens.tvMesh.material.map = G.screens.tvTex; G.screens.tvMesh.material.needsUpdate = true; G.screens.showOverlay(null); a.onEnd && a.onEnd(); emit('replayEnd'); return; } }
    const fi = Math.min(L - 1, Math.floor(a.play));
    // swap world into the recorded state, render TV camera, swap back
    this.capture(this.live);
    this.apply(frames[fi]);
    const tommyVis = G.tommy?.root.visible; if (G.tommy) G.tommy.root.visible = true;
    const sheetVis = G.screens.tvMesh.visible; G.screens.tvMesh.visible = false; G.screens.overlay.visible = false;
    const xr = G.renderer.xr.enabled; G.renderer.xr.enabled = false;
    const prevRT = G.renderer.getRenderTarget(); G.renderer.setRenderTarget(this.rt); G.renderer.render(G.scene, a.pass ? this.cam2 : this.cam); G.renderer.setRenderTarget(prevRT);
    G.renderer.xr.enabled = xr;
    G.screens.tvMesh.visible = sheetVis; if (G.tommy) G.tommy.root.visible = tommyVis;
    this.apply(this.live);
    for (const inst of G.items.instances) G.items.syncOne(inst);
    if (G.screens.tvMesh.material.map !== this.rt.texture) { G.screens.tvMesh.material.map = this.rt.texture; G.screens.tvMesh.material.needsUpdate = true; }
    if (G.frame % 6 === 0) G.screens.showOverlay((g, W, H) => {
      g.fillStyle = 'rgba(200,16,46,0.92)'; g.fillRect(0, H - 92, W, 60); g.fillStyle = '#0a1a4a'; g.fillRect(0, H - 92, 260, 60);
      g.fillStyle = '#fff'; g.font = 'bold 30px sans-serif'; g.fillText('MASON TV', 20, H - 50); g.font = 'bold 26px sans-serif'; g.fillText(a.label.slice(0, 50), 280, H - 50);
      g.fillStyle = '#ffd700'; g.font = 'bold 22px sans-serif'; g.fillText(a.pass ? 'ANGLE 2' : (slow < 1 ? 'SLOW-MO' : 'REPLAY'), W - 160, 40);
      if (a.score != null) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(W - 230, 60, 210, 70); g.fillStyle = '#ffd700'; g.font = 'bold 40px sans-serif'; g.fillText(`${(+a.score).toFixed(1)}/10`, W - 210, 110); }
    });
  }
}
