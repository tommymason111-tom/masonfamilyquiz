// Comic hit effects: "WHACK!" / "BOFF!" / "THWACK!" pop-up bursts at the point of impact, flying stars,
// a cartoon impact sound stack, a tiny hit-stop and camera shake — on punches, kicks, shoves, thrown things
// hitting people, people hitting walls/floors/windows and Gang-Beasts pile-ups.
import * as THREE from 'three';
import { G, on, rand, pick, clamp } from '../core.js';
import { sfx } from '../engine/audio.js';

const WORDS = {
  punch: ['WHACK!', 'BOFF!', 'POW!', 'THWACK!', 'BIFF!', 'KAPOW!', 'WALLOP!', 'BOSH!'],
  kick: ['BOOT!', 'THWUMP!', 'WHUMP!', 'KER-PLUNK!', 'HOOF!'],
  bonk: ['BONK!', 'DONK!', 'CLONK!', 'BOINK!', 'TOINK!'],
  splat: ['SPLAT!', 'SPLODGE!', 'SQUELCH!'],
  thud: ['THUD!', 'CRUNCH!', 'WHUMPH!', 'SMACK!', 'OOF!'],
  glass: ['SQUISH!', 'SMOOSH!', 'SPLAT!'],
  pile: ['PILE-UP!', 'DOUBLE KO!', 'TIMBER!', 'STRIKE!'],
  shove: ['SHOVE!', 'HUP!', 'OUT THE WAY!'],
};
// only things YOU threw (or are swinging) count — no pops when people bump into stuff on their own
const byYou = (inst) => inst.held || G.time - (inst.playerT ?? -99) < 4;
const COLORS = [['#ffd400', '#e4002b'], ['#ff6a00', '#1d1d8a'], ['#39d353', '#5a0a8a'], ['#00c2ff', '#e4002b'], ['#ff3fa4', '#1a1a1a'], ['#ffffff', '#e4002b']];

export class FX {
  constructor() {
    G.fx = this; this.pops = []; this.stars = []; this.shake = 0; this.hitStop = 0; this.cache = new Map();
    const sg = new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.4 : 1; const a = i / 10 * Math.PI * 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return s; })());
    this.starGeo = sg; this.starMats = ['#ffe23a', '#ffffff', '#ff7a1a', '#7ad7ff'].map(c => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, depthTest: false, transparent: true }));
    on('punched', (p) => this.hit(p.chestPos(new THREE.Vector3()), 'punch', 1));
    on('kicked', (p) => this.hit(p.world[0].p.clone(), 'kick', 1.1));
    on('shoved', (p) => this.hit(p.chestPos(new THREE.Vector3()), 'shove', 0.9));
    on('pileUp', (a, b) => this.hit(b.chestPos(new THREE.Vector3()), 'pile', 1));
    on('glassSquash', (p) => { if (p.byPlayer?.(6)) this.hit(p.world[1].p.clone(), 'glass', 1); });
    on('splat', (inst, other, pos) => { if (other?.kind === 'char' && byYou(inst)) this.hit(new THREE.Vector3(pos.x, pos.y, pos.z), 'splat', 0.9); });
    on('itemImpact', (inst, other, sp) => { if (other?.kind === 'char' && !other.ref.isPlayer && sp > 3 && byYou(inst)) { const t = inst.body.translation(); this.hit(new THREE.Vector3(t.x, t.y, t.z), inst.type.mass > 1 ? 'thud' : 'bonk', clamp(sp / 8, 0.6, 1.2)); } });
    // ragdolls slamming into walls / floor
    on('collision', (a, b) => {
      for (const [x, y] of [[a, b], [b, a]]) {
        if (!x || x.kind !== 'char' || x.ref.state !== 'ragdoll' || !y || (y.kind !== 'static' && y.kind !== 'item')) continue;
        const p = x.ref; if (!p.byPlayer?.(4) || G.time - (p._lastThud || 0) < 1.2) continue;
        const v = p.bodies[x.part].linvel(); const sp = Math.hypot(v.x, v.y, v.z); if (sp < 4.2) continue;
        p._lastThud = G.time; const t = p.bodies[x.part].translation();
        this.hit(new THREE.Vector3(t.x, t.y + 0.2, t.z), y.tag === 'glass' ? 'glass' : 'thud', clamp(sp / 9, 0.6, 1.2), true);
        if (p.heavy) sfx('bigthud', t, 1);
      }
    });
    G.updaters.push((dt) => this.update(dt));
  }
  wordTex(word, col) {
    const key = word + col[0]; if (this.cache.has(key)) return this.cache.get(key);
    const c = document.createElement('canvas'); c.width = 512; c.height = 320; const g = c.getContext('2d');
    // starburst
    g.translate(256, 160); g.fillStyle = col[1]; g.beginPath(); for (let i = 0; i < 24; i++) { const r = i % 2 ? 105 : 158; const a = i / 24 * Math.PI * 2; g.lineTo(Math.cos(a) * r * 1.45, Math.sin(a) * r * 0.95); } g.closePath(); g.fill();
    g.fillStyle = col[0]; g.beginPath(); for (let i = 0; i < 24; i++) { const r = i % 2 ? 90 : 140; const a = i / 24 * Math.PI * 2 + 0.1; g.lineTo(Math.cos(a) * r * 1.42, Math.sin(a) * r * 0.9); } g.closePath(); g.fill();
    g.rotate(-0.12); g.font = `900 ${word.length > 8 ? 62 : 84}px Impact, "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 14; g.strokeStyle = '#111'; g.strokeText(word, 0, 6); g.fillStyle = '#fff'; g.fillText(word, 0, 6);
    g.fillStyle = col[1]; g.globalAlpha = 0.25; g.fillText(word, 4, 12); g.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; this.cache.set(key, t); return t;
  }
  hit(pos, kind = 'punch', power = 1, quiet = false) {
    const word = pick(WORDS[kind] || WORDS.punch); const col = pick(COLORS);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.wordTex(word, col), transparent: true, depthTest: false }));
    sp.renderOrder = 50; sp.position.copy(pos).add(new THREE.Vector3(rand(-0.1, 0.1), 0.25, rand(-0.1, 0.1))); G.scene.add(sp);
    this.pops.push({ sp, t: 0, life: 0.6, base: 0.26 * power, rot: rand(-0.2, 0.2) });
    while (this.pops.length > 2) { const o = this.pops.shift(); G.scene.remove(o.sp); o.sp.material.dispose(); }
    // stars burst
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(this.starGeo, pick(this.starMats)); m.renderOrder = 49; m.scale.setScalar(0.02 + Math.random() * 0.015); m.position.copy(pos); G.scene.add(m);
      this.stars.push({ m, v: new THREE.Vector3(rand(-1.2, 1.2), rand(0.8, 2), rand(-1.2, 1.2)).multiplyScalar(power), t: 0, spin: rand(-12, 12) }); }
    // cartoon sound stack
    if (!quiet || kind !== 'thud') { if (kind === 'punch' || kind === 'shove') { sfx('slap', pos, 0.5); sfx('boff', pos, 0.6); } else if (kind === 'kick') { sfx('boff', pos, 0.6); sfx('boing', pos, 0.35); } else if (kind === 'bonk') sfx('bauble', pos, 0.8); else if (kind === 'splat' || kind === 'glass') sfx('splat', pos, 1); else if (kind === 'pile') { sfx('bigthud', pos, 1); sfx('star', pos, 0.6); } }
    if (kind === 'thud') sfx('thud', pos, 0.9);
    sfx('star', pos, 0.15);
    // feel: tiny hit-stop + camera shake if it's near you
    const d = G.player ? G.player.headPos(new THREE.Vector3()).distanceTo(pos) : 9;
    if (d < 4) { this.shake = Math.max(this.shake, 0.02 * power * (1 - d / 4)); this.hitStop = Math.max(this.hitStop, kind === 'punch' || kind === 'kick' ? 0.03 : 0); }
    if (G.xr) try { for (const h of Object.values(G.player.xrIn.hands)) h?.source?.gamepad?.hapticActuators?.[0]?.pulse(0.6, 60); } catch (e) {}
    else navigator.vibrate?.(25);
  }
  update(dt) {
    for (let i = this.pops.length - 1; i >= 0; i--) { const o = this.pops[i]; o.t += dt; const k = o.t / o.life;
      const s = o.base * (k < 0.15 ? 0.5 + (k / 0.15) * 0.6 : k < 0.3 ? 1.1 - (k - 0.15) * 0.67 : 1); o.sp.scale.set(s * 1.6, s, 1); o.sp.material.rotation = o.rot; o.sp.position.y += dt * 0.25; o.sp.material.opacity = 0.9 * (k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
      if (k >= 1) { G.scene.remove(o.sp); o.sp.material.dispose(); this.pops.splice(i, 1); } }
    for (let i = this.stars.length - 1; i >= 0; i--) { const s = this.stars[i]; s.t += dt; s.v.y -= 6 * dt; s.m.position.addScaledVector(s.v, dt); s.m.rotation.z += s.spin * dt; if (G.camera) s.m.quaternion.copy(G.camera.getWorldQuaternion(new THREE.Quaternion())); s.m.material.opacity = 1;
      if (s.t > 0.45) { G.scene.remove(s.m); this.stars.splice(i, 1); } }
    // camera shake (flat screen only — never shake a VR headset)
    if (!G.xr && this.shake > 0.0005) { G.camera.position.x += rand(-1, 1) * this.shake; G.camera.position.y += rand(-1, 1) * this.shake; this.shake *= Math.exp(-dt * 18); }
  }
}
