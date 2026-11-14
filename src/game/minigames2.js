// The second batch of mini games, added onto the MiniGames class:
//   • Stack the Chocolate Boxes (dining table): a box swings back and forth over the table, DROP it on the tower
//   • Catch the Leftovers (garden): Julie lobs Christmas dinner leftovers, catch them on your plate, Chip eats the misses
//   • Snowball Fight (snowy garden): 3 v 3 behind snow forts, three hits and you're out
import * as THREE from 'three';
import { G, rand, pick, clamp, shuffle } from '../core.js';
import { sfx } from '../engine/audio.js';
import { TEAMS } from '../chars/cast.js';
import { card, timer, tapButton, meters } from './popup.js';
import { Prop } from '../engine/geo.js';

const TABLE = { x: 4.99, z: -3.9, x0: 4.52, x1: 5.47, z0: -4.75, z1: -3.05, y: 0.77 };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const vc = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
const faceYaw = (from, to) => Math.atan2(-(to[0] - from[0]), -(to[1] - from[1])); // the player's yaw to look from one spot at another

// ---- shared bits: a row of action buttons on the phone, little splat bursts, flying things ----
function actionBar(list) {
  const row = document.createElement('div'); row.className = 'mgact';
  for (const b of list) { const el = document.createElement('button'); el.innerHTML = `<span>${b.icon}</span>${b.label}<i></i>`; el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (!el.classList.contains('cool')) b.fn(); }); b.el = el; row.appendChild(el); }
  document.body.appendChild(row);
  return { remove: () => row.remove(), cool: (b, f) => { b.el.classList.toggle('cool', f > 0); b.el.querySelector('i').style.width = `${Math.round(f * 100)}%`; } };
}
function burst(a, pos, color, n = 14, speed = 2.2, size = 0.025) {
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(size, 6, 4), new THREE.MeshStandardMaterial({ color, roughness: 0.8, transparent: true }), n); m.frustumCulled = false; G.scene.add(m);
  const parts = []; for (let k = 0; k < n; k++) parts.push({ p: pos.clone(), v: V(rand(-1, 1), rand(0.4, 1.4), rand(-1, 1)).multiplyScalar(speed * rand(0.4, 1)) });
  (a.fx ||= []).push({ m, parts, t: 0, life: 0.9 });
}
function stepFx(a, dt) {
  if (!a.fx) return; const M = new THREE.Matrix4();
  for (const f of a.fx) { f.t += dt; f.parts.forEach((q, k) => { q.v.y -= 7 * dt; q.p.addScaledVector(q.v, dt); if (q.p.y < 0.02) { q.p.y = 0.02; q.v.multiplyScalar(0.3); } M.makeTranslation(q.p.x, q.p.y, q.p.z); f.m.setMatrixAt(k, M); }); f.m.instanceMatrix.needsUpdate = true; f.m.material.opacity = Math.max(0, 1 - f.t / f.life); if (f.t > f.life) { G.scene.remove(f.m); f.dead = true; } }
  a.fx = a.fx.filter(f => !f.dead);
}
function clearFx(a) { for (const f of a.fx || []) G.scene.remove(f.m); a.fx = []; }
// a canvas sprite with an emoji / word on it (floating Zzz, +1s, SPLAT!)
function wordSprite(txt, color = '#fff', size = 0.35) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'); g.font = '900 84px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.strokeText(txt, 128, 66); g.fillStyle = color; g.fillText(txt, 128, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(size * 2, size, 1); s.renderOrder = 30; return s;
}
function floatWord(a, txt, pos, color, size = 0.3, life = 1.2) { const s = wordSprite(txt, color, size); s.position.copy(pos); G.scene.add(s); (a.words ||= []).push({ s, t: 0, life }); }
function stepWords(a, dt) { if (!a.words) return; for (const w of a.words) { w.t += dt; w.s.position.y += dt * 0.45; w.s.material.opacity = Math.max(0, 1 - w.t / w.life); if (w.t > w.life) { G.scene.remove(w.s); w.dead = true; } } a.words = a.words.filter(w => !w.dead); }
function clearWords(a) { for (const w of a.words || []) G.scene.remove(w.s); a.words = []; }
// a launch velocity that lands at `to` from `from` with the given horizontal speed
function lob(from, to, hs) { const d = V(to.x - from.x, 0, to.z - from.z); const L = Math.max(0.01, d.length()); const T = L / hs; const vy = (to.y - from.y + 0.5 * 9.8 * T * T) / T; return d.multiplyScalar(hs / L).setY(vy); }
const handR = () => G.xr ? G.player.xrIn?.hands?.R : null;

// ---- food for Catch the Leftovers ----
const FOODS = [
  { id: 'pig', name: 'Pig in blanket', pts: 1, geo: () => new Prop().cyl(0.016, 0.016, 0.07, '#a0522d', 0, 0, 0, 0, 0, Math.PI / 2, 10).cyl(0.019, 0.019, 0.04, '#d98a8a', 0, 0, 0, 0, 0, Math.PI / 2, 10).cyl(0.0195, 0.0195, 0.012, '#7a2a1a', 0.008, 0, 0, 0, 0, Math.PI / 2 + 0.6, 10).build() },
  { id: 'potato', name: 'Roast potato', pts: 1, geo: () => new Prop().sph(0.032, '#d9a441', 0, 0, 0, 1.2, 0.85, 1, 10).sph(0.02, '#b07a20', 0.015, 0.012, 0, 1, 0.6, 1, 8).build() },
  { id: 'pie', name: 'Mince pie', pts: 1, geo: () => new Prop().cyl(0.035, 0.03, 0.025, '#d9a441', 0, 0, 0, 0, 0, 0, 14).cyl(0.033, 0.033, 0.004, '#e8c27a', 0, 0.013, 0, 0, 0, 0, 14).sph(0.006, '#ffffff', 0, 0.017, 0, 2, 0.4, 2, 6).build() },
  { id: 'yorkie', name: 'Yorkshire pudding', pts: 1, geo: () => new Prop().cyl(0.045, 0.03, 0.03, '#c98a2e', 0, 0, 0, 0, 0, 0, 14).cyl(0.03, 0.022, 0.02, '#7a4a18', 0, 0.008, 0, 0, 0, 0, 12).build() },
  { id: 'stuffing', name: 'Stuffing ball', pts: 1, geo: () => new Prop().sph(0.028, '#8a5a2a', 0, 0, 0, 1, 1, 1, 8).sph(0.008, '#2d6a2f', 0.02, 0.01, 0.01, 1, 1, 1, 5).build() },
  { id: 'turkey', name: 'GOLDEN TURKEY LEG', pts: 3, gold: true, geo: () => new Prop().sph(0.04, '#e0a030', 0, 0, 0, 1.4, 0.9, 0.9, 12).cyl(0.01, 0.012, 0.07, '#f6efd8', 0.07, 0, 0, 0, 0, Math.PI / 2, 8).sph(0.014, '#f6efd8', 0.105, 0, 0, 1, 1, 1, 8).build() },
  { id: 'sprout', name: 'Sprout', pts: -1, bad: true, geo: () => new Prop().sph(0.026, '#4f8a2b', 0, 0, 0, 1, 1, 1, 10).sph(0.024, '#6aa83a', 0, 0.006, 0, 0.9, 0.7, 0.9, 8).build() },
];

export function installMoreGames(MiniGames) {
  const P = MiniGames.prototype;

  // =====================================================================================================
  // STACK THE CHOCOLATE BOXES
  // =====================================================================================================
  P.setup_stack = function (a) {
    a.limit = 50; a.best = 0; a.dropped = 0; this.clearArea(TABLE.x0 - 0.1, TABLE.x1 + 0.1, TABLE.z0 - 0.1, TABLE.z1 + 0.1);
    for (const c of G.items.byType.pong_cup || []) c.body.setTranslation({ x: 1.25, y: 0.95, z: -3.6 - Math.random() * 0.4 }, true);
    // a tablecloth "target" square in the middle of the table
    const mat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.004, 0.34), new THREE.MeshStandardMaterial({ color: '#c41e1e', roughness: 0.9 })); mat.position.set(TABLE.x, TABLE.y + 0.003, TABLE.z); G.scene.add(mat); a.mat = mat;
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.003, 0.36), new THREE.MeshStandardMaterial({ color: '#ffd700', roughness: 0.5 })); ring.position.set(TABLE.x, TABLE.y + 0.002, TABLE.z); G.scene.add(ring); a.ring = ring;
    // a measuring stick standing at the end of the table so you can see how high you are
    const S = new Prop(); S.box(0.04, 1.2, 0.012, '#f6efd8', 0, 0.6, 0); for (let k = 0; k <= 12; k++) S.box(k % 5 ? 0.02 : 0.04, 0.004, 0.014, '#1a1a1a', 0.01, k * 0.1, 0); a.stick = new THREE.Mesh(S.build(), vc()); a.stick.position.set(TABLE.x, TABLE.y, TABLE.z0 + 0.06); G.scene.add(a.stick);
    a.marker = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.008, 0.03), new THREE.MeshBasicMaterial({ color: '#ffd700' })); a.marker.position.set(TABLE.x, TABLE.y, TABLE.z0 + 0.06); G.scene.add(a.marker);
    G.player.teleport(TABLE.x - 0.95, TABLE.z, -Math.PI / 2); G.player.pitch = -0.22;
    this.park(this.reps(2), [[TABLE.x + 0.9, TABLE.z - 0.6], [TABLE.x + 0.9, TABLE.z + 0.6]], [TABLE.x, TABLE.z]); this.diningCrowd([], [TABLE.x, TABLE.z], 4);
    a.label = () => `TOWER ${a.score} CM · BEST ${a.best} CM`;
  };
  P.begin_stack = function (a) { this.nextBox(a); a.btn = tapButton('DROP! 📦', () => this.dropBox(a)); a.masonT = rand(9, 13); };
  P.shooMason = function (a) { const m = G.charByName.Mason; if (!a.mason || !m) return; a.mason = null; a.shoo?.remove(); a.shoo = null; m.say(pick(['Nooo!', 'Awww!', 'Mine tower!']), { prio: 1 }); sfx('giggle', m.pos, 0.7); G.minigames.place(m, 3.2, -2.2, [TABLE.x, TABLE.z]); a.masonT = rand(10, 15); floatWord(a, 'SHOO!', m.headPos(new THREE.Vector3()).add(V(0, 0.3, 0)), '#ffd700', 0.16); };
  P.nextBox = function (a) {
    if (!a.live) return; const ids = ['chocbox_a', 'chocbox_b', 'chocbox_c', 'chocbox_d', 'chocbox_e', 'chocbox_f'];
    const top = this.towerTop(a); const it = this.spawn(pick(ids), V(TABLE.x, top + 0.25, TABLE.z)); if (!it) return;
    it.body.setBodyType(G.R.RigidBodyType.KinematicPositionBased, true); a.hover = it; a.hoverT = 0; a.hoverY = top + 0.2;
    a.speed = 0.9 + Math.min(1.4, a.dropped * 0.12); // it swings faster the higher you go
  };
  P.towerTop = function (a) { let top = TABLE.y; for (const id of ['chocbox_a', 'chocbox_b', 'chocbox_c', 'chocbox_d', 'chocbox_e', 'chocbox_f']) for (const c of G.items.byType[id] || []) { if (c === a.hover || c.held) continue; const p = c.body.translation(); if (Math.abs(p.x - TABLE.x) < 0.45 && Math.abs(p.z - TABLE.z) < 0.85 && p.y > TABLE.y) top = Math.max(top, p.y + c.type.shape[2]); } return top; };
  P.dropBox = function (a) {
    const it = a.hover; if (!it || !a.live) return; a.hover = null; it.body.setBodyType(G.R.RigidBodyType.Dynamic, true); it.body.setLinvel({ x: 0, y: -0.4, z: 0 }, true); a.dropped++;
    sfx('whoosh', null, 0.4); G.player.fp?.punch?.('R'); setTimeout(() => { if (it.alive) sfx('thud', it.body.translation(), 0.6); }, 260);
    setTimeout(() => this.nextBox(a), 900);
  };
  P.tick_stack = function (a, dt) {
    stepFx(a, dt); stepWords(a, dt);
    // the box on offer swings left-right (and drifts in and out a bit) above the tower
    if (a.hover?.alive) { a.hoverT += dt * a.speed; const t = a.hoverT; a.hoverY = Math.max(a.hoverY, this.towerTop(a) + 0.18);
      const x = TABLE.x + Math.sin(t * 1.3) * 0.08, z = TABLE.z + Math.sin(t) * 0.42; a.hover.body.setNextKinematicTranslation({ x, y: a.hoverY + Math.sin(t * 3) * 0.01, z }); a.hover.body.setNextKinematicRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.sin(t * 0.7) * 0.4, 0))); }
    // measure the standing tower (only boxes that have stopped moving count)
    if (G.frame % 6 === 0) { let top = 0, fell = 0; for (const id of ['chocbox_a', 'chocbox_b', 'chocbox_c', 'chocbox_d', 'chocbox_e', 'chocbox_f']) for (const c of G.items.byType[id] || []) { if (c === a.hover) continue; const p = c.body.translation(); if (p.y < TABLE.y - 0.1) { fell++; continue; } const v = c.body.linvel(); if (Math.abs(p.x - TABLE.x) < 0.5 && Math.abs(p.z - TABLE.z) < 0.9 && Math.hypot(v.x, v.y, v.z) < 0.08) top = Math.max(top, p.y + c.type.shape[2] - TABLE.y); }
      const cm = Math.round(top * 100); if (cm > a.best) { if (cm >= a.best + 5 && a.best > 0) floatWord(a, `${cm} CM!`, V(TABLE.x, TABLE.y + top + 0.2, TABLE.z), '#ffd700', 0.18); a.best = cm; } a.score = cm;
      if (fell > (a.fell || 0)) { a.fell = fell; G.popup?.splash?.(pick(['TIMBER!', 'CRASH!', 'WOBBLE…', 'OH NO!']), ''); sfx('smash', null, 0.6); }
      a.marker.position.y = TABLE.y + top; }
    // Mason toddles over every so often to have a go at your tower. Shoo him (punch/tap him) or he'll bump the table
    a.masonT -= dt; const m = G.charByName.Mason;
    if (m && !m.isPlayer && a.masonT < 0 && !a.mason) { a.mason = { t: 0 }; G.minigames.place(m, TABLE.x - 0.4, TABLE.z + 1.3, [TABLE.x, TABLE.z]); m.say(pick(['Mine!', 'Tower!', 'Me do it!', 'CRASH!']), { prio: 1 }); G.ui?.toast(G.xr ? 'Mason\'s coming for your tower! Wave your hand at him to shoo him away' : 'Mason\'s coming for your tower! Hit SHOO!', 2.5, { game: true }); if (!G.xr) a.shoo = actionBar([{ icon: '🙅', label: 'SHOO MASON', fn: () => this.shooMason(a) }]); }
    if (a.mason && G.xr) { const hp = m.headPos(new THREE.Vector3()); for (const h of Object.values(G.player.xrIn?.hands || {})) if (h?.palm && h.palm.distanceTo(hp) < 0.7) this.shooMason(a); }
    if (a.mason) { a.mason.t += dt; const k = Math.min(1, a.mason.t / 3.2); m.pos.set(TABLE.x - 0.4, 0, TABLE.z + 1.3 - k * 0.75); m.base = 'walk'; m.speed = 0.3;
      if (k >= 1) { a.mason = null; a.shoo?.remove(); a.shoo = null; m.base = 'stand'; m.gesture = 'cheer'; sfx('bigthud', null, 0.7); if (G.fx) G.fx.shake = 0.03; m.say('CRASH!', { prio: 1 });
        for (const id of ['chocbox_a', 'chocbox_b', 'chocbox_c', 'chocbox_d', 'chocbox_e', 'chocbox_f']) for (const c of G.items.byType[id] || []) if (c !== a.hover && c.body.bodyType() === G.R.RigidBodyType.Dynamic) c.body.applyImpulse({ x: rand(-0.04, 0.04), y: 0.02, z: -0.06 }, true);
        setTimeout(() => { if (m.state === 'anim') { m.gesture = null; G.minigames.place(m, 3.2, -2.2, [TABLE.x, TABLE.z]); } }, 1500); a.masonT = rand(10, 15); } }
  };
  P.end_stack = function (a) {
    a.btn?.(); if (a.hover?.alive) G.items.remove(a.hover); a.score = a.best; for (const k of ['mat', 'ring', 'stick', 'marker']) if (a[k]) G.scene.remove(a[k]); clearFx(a); clearWords(a);
    a.shoo?.remove();
    setTimeout(() => { for (const id of ['chocbox_a', 'chocbox_b', 'chocbox_c', 'chocbox_d', 'chocbox_e', 'chocbox_f']) for (const c of (G.items.byType[id] || []).slice()) if (c.mg) G.items.remove(c); }, 6000);
  };

  // =====================================================================================================
  // CATCH THE LEFTOVERS
  // =====================================================================================================
  P.setup_leftovers = function (a) {
    a.limit = 50; a.caught = 0; a.chip = 0; a.flying = []; a.ground = []; a.thrown = 0; a.label = () => G.xr ? `🍽️ ${a.score} ON YOUR PLATE · 🐶 CHIP ${a.chip}` : `🐶 CHIP HAS EATEN ${a.chip}`;
    const J = G.charByName.Julie && !G.charByName.Julie.isPlayer ? G.charByName.Julie : G.charByName.Karen; a.thrower = J;
    a.from = V(-1.4, 0, -13.9); this.place(J, a.from.x, a.from.z, [-1.4, -10]); J.gesture = null; // Julie at the bottom of the garden, throwing back up the lawn
    G.player.teleport(-1.4, -10.4, faceYaw([-1.4, -10.4], [a.from.x, a.from.z])); G.player.pitch = 0.05;
    // a serving trolley next to Julie, piled with the leftovers
    const T = new Prop(); T.box(0.7, 0.03, 0.45, '#c0c0c0', 0, 0.8, 0).box(0.7, 0.03, 0.45, '#c0c0c0', 0, 0.35, 0); for (const [x, z] of [[-0.33, -0.2], [0.33, -0.2], [-0.33, 0.2], [0.33, 0.2]]) T.cyl(0.012, 0.012, 0.8, '#9a9a9a', x, 0.4, z).sph(0.03, '#2a2a2a', x, 0.03, z);
    T.cyl(0.18, 0.18, 0.02, '#ffffff', -0.15, 0.83, 0).sph(0.12, '#c98a2e', -0.15, 0.9, 0, 1.3, 0.7, 1).cyl(0.13, 0.13, 0.06, '#e8e2d8', 0.2, 0.85, 0.05).sph(0.03, '#4f8a2b', 0.18, 0.89, 0.02).sph(0.03, '#4f8a2b', 0.24, 0.89, 0.08).sph(0.03, '#d9a441', 0.15, 0.89, 0.1);
    a.trolley = new THREE.Mesh(T.build(), vc()); a.trolley.position.set(a.from.x + 0.7, 0, a.from.z - 0.1); G.scene.add(a.trolley);
    // your plate: a big white dinner plate with a holly rim
    const Pl = new Prop(); Pl.cyl(0.2, 0.17, 0.018, '#ffffff', 0, 0, 0, 0, 0, 0, 28).cyl(0.15, 0.15, 0.004, '#f2f2f2', 0, 0.01, 0, 0, 0, 0, 28).torus(0.185, 0.006, '#c41e1e', 0, 0.01, 0, Math.PI / 2);
    for (let k = 0; k < 6; k++) { const ang = k / 6 * Math.PI * 2; Pl.sph(0.014, '#1f6a2f', Math.cos(ang) * 0.18, 0.012, Math.sin(ang) * 0.18, 1.6, 0.3, 0.8, 6).sph(0.006, '#c41e1e', Math.cos(ang + 0.15) * 0.18, 0.016, Math.sin(ang + 0.15) * 0.18); }
    a.plate = new THREE.Group(); a.plate.add(new THREE.Mesh(Pl.build(), vc())); a.pile = new THREE.Group(); a.plate.add(a.pile); G.scene.add(a.plate);
    // the score, big: a counter floating over your plate (seen on the phone and in the headset) and a badge in the corner
    a.cc = document.createElement('canvas'); a.cc.width = 256; a.cc.height = 128; a.ctex = new THREE.CanvasTexture(a.cc); a.ctex.colorSpace = THREE.SRGBColorSpace;
    a.counter = new THREE.Sprite(new THREE.SpriteMaterial({ map: a.ctex, transparent: true, depthTest: false })); a.counter.scale.set(0.3, 0.15, 1); a.counter.renderOrder = 50; G.scene.add(a.counter);
    a.badge = document.createElement('div'); a.badge.className = 'platecount'; document.body.appendChild(a.badge); a.shown = -1;
    a.foodGeo = Object.fromEntries(FOODS.map(f => [f.id, f.geo()])); a.foodMat = vc(); a.goldMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: '#7a5200', emissiveIntensity: 0.8 });
    // a ring on the lawn showing where the next one will land
    a.shadow = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 24), new THREE.MeshBasicMaterial({ color: '#ffd700', transparent: true, opacity: 0.7, depthWrite: false })); a.shadow.rotation.x = -Math.PI / 2; a.shadow.visible = false; G.scene.add(a.shadow);
    const ring = []; for (let k = 0; k < 8; k++) ring.push([-5.6 + (k % 2) * 0.5, -9.4 - k * 0.45]); this.crowd(ring, [-1.4, -11.5], [J], 5);
    if (G.dog && !G.dog.playerControlled) { G.dog.path = null; G.dog.pos.set(-0.4, 0, -10.2); G.dog.state = 'sit'; G.dog.timer = 999; }
  };
  P.begin_leftovers = function (a) { a.nextT = 0.6; a.thrower.say('Right, who wants seconds? CATCH!', { prio: 1 }); };
  P.platePos = function (out) {
    const h = handR(); if (h?.palm) { out.copy(h.palm); out.y += 0.06; return out; }
    const f = G.player.forward(new THREE.Vector3()).setY(0).normalize(); return G.player.headPos(out).addScaledVector(f, 0.5).add(V(0, -0.5, 0));
  };
  P.tick_leftovers = function (a, dt) {
    stepFx(a, dt); stepWords(a, dt);
    const pp = this.platePos(new THREE.Vector3()); a.plate.position.copy(pp); a.plate.rotation.y = G.player.yaw ?? 0;
    if (a.shown !== a.score) { a.shown = a.score; const g = a.cc.getContext('2d'); g.clearRect(0, 0, 256, 128); g.fillStyle = 'rgba(20,12,18,0.82)'; g.beginPath(); g.roundRect(8, 8, 240, 112, 30); g.fill(); g.lineWidth = 6; g.strokeStyle = '#ffd700'; g.stroke(); g.font = '900 72px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(`🍽️ ${a.score}`, 128, 68); a.ctex.needsUpdate = true;
      a.badge.innerHTML = `<small>ON YOUR PLATE</small>${a.score}`; a.badge.classList.remove('pop'); void a.badge.offsetWidth; a.badge.classList.add('pop'); }
    a.counter.position.copy(pp).add(V(0, G.xr ? 0.25 : 0.32, 0)); a.counter.visible = !!G.xr; // the phone has the corner badge instead
    // Julie throws: more often, and sometimes two at once, as the clock runs down
    a.nextT -= dt; const J = a.thrower;
    if (a.nextT <= 0 && J.state === 'anim') { const busy = Math.min(1, a.t / 45); const ph = G.xr ? 0 : 0.5; a.nextT = rand(1.8, 2.5) + ph - busy * 0.6; const n = !G.xr ? 1 : Math.random() < busy * 0.3 ? 2 : 1; /* phones: a bit more time between throws, one at a time */
      J.gesture = 'throwOver'; J.gestureT = 0; setTimeout(() => { if (J.gesture === 'throwOver') J.gesture = null; }, 600);
      for (let k = 0; k < n; k++) setTimeout(() => this.throwFood(a), 250 + k * 280); }
    // flying food
    for (const f of a.flying) { f.v.y -= 9.8 * dt; f.m.position.addScaledVector(f.v, dt); f.m.rotation.x += f.w.x * dt; f.m.rotation.z += f.w.z * dt;
      const d = Math.hypot(f.m.position.x - pp.x, f.m.position.z - pp.z), dy = f.m.position.y - pp.y;
      if (f.v.y < 0 && d < (G.xr ? 0.3 : 0.55) && dy < (G.xr ? 0.12 : 0.2) && dy > (G.xr ? -0.14 : -0.22)) { this.caughtFood(a, f); f.done = true; continue; }
      if (f.m.position.y < 0.03) { f.done = true; this.droppedFood(a, f); } }
    a.flying = a.flying.filter(f => !f.done);
    const next = a.flying.slice().sort((x, y) => x.land.distanceTo(pp) - y.land.distanceTo(pp))[0]; a.shadow.visible = !!next; if (next) { a.shadow.position.set(next.land.x, 0.02, next.land.z); a.shadow.material.color.set(next.food.bad ? '#6aa83a' : next.food.gold ? '#ffd700' : '#ffffff'); }
    // Chip hoovers up whatever hits the lawn
    const d0 = G.dog; if (d0 && !d0.playerControlled && a.ground.length && !d0.path) { const g = a.ground[0]; d0.goTo(g.m.position.clone().setY(0), 3.4, () => { if (g.m.parent) { G.scene.remove(g.m); a.chip++; sfx('crunch', g.m.position, 0.7); d0.wag = 3; floatWord(a, 'CHIP +1', g.m.position.clone().add(V(0, 0.4, 0)), '#ffb020', 0.16); } a.ground.shift(); d0.state = 'sit'; d0.timer = 999; }); }
  };
  P.throwFood = function (a) {
    if (!a.live) return; const r = Math.random(); const food = r < 0.12 ? FOODS[5] : r < 0.3 ? FOODS[6] : pick(FOODS.slice(0, 5));
    const from = a.thrower.handPos('R', new THREE.Vector3()); from.y = Math.max(from.y, 1.5);
    // aim near you, but you'll usually have to move: further out the longer the game goes
    const me = G.player.pos; const spread = G.xr ? 0.5 + Math.min(1.0, a.t / 30) : 0.35 + Math.min(0.65, a.t / 40); /* on a phone they land closer to you */ const land = V(clamp(me.x + rand(-spread, spread), -4.8, 1.8), 0.95, clamp(me.z + rand(-spread, spread), -12.6, -9.2));
    const m = new THREE.Mesh(a.foodGeo[food.id], food.gold ? a.goldMat : a.foodMat); m.position.copy(from); m.scale.setScalar(1.6); G.scene.add(m);
    a.flying.push({ m, food, v: lob(from, land, G.xr ? rand(2.9, 3.7) : rand(2.4, 3.0)), /* phones: higher, slower lobs give you time to get under them */ w: V(rand(-8, 8), 0, rand(-8, 8)), land }); a.thrown++; sfx('whoosh', from, 0.4);
    if (food.gold) a.thrower.say('Ooh, the turkey leg! Don\'t drop it!', { prio: 1 }); else if (food.bad && Math.random() < 0.6) a.thrower.say(pick(['Sprout!', 'Eat your sprouts!', 'Have a sprout!']), { prio: 1 });
  };
  P.caughtFood = function (a, f) {
    G.scene.remove(f.m); const food = f.food;
    if (food.bad) { a.score = Math.max(0, a.score - 1); sfx('splat', f.m.position, 0.8); floatWord(a, 'SPROUT! −1', f.m.position.clone(), '#6aa83a', 0.18); G.popup?.flash?.('#3a8a2a'); return; }
    a.score += food.pts; a.caught++; sfx(food.gold ? 'ding' : 'tap', f.m.position, 0.9); if (food.gold) { G.popup?.splash?.('GOLDEN!', '+3'); burst(a, f.m.position.clone(), '#ffd700', 18, 1.6, 0.012); }
    floatWord(a, food.gold ? '+3' : '+1', f.m.position.clone().add(V(0, 0.15, 0)), food.gold ? '#ffd700' : '#ffffff', 0.15);
    // it lands on your plate (the pile gets taller)
    const k = a.pile.children.length; if (k < 26) { const m = new THREE.Mesh(a.foodGeo[food.id], food.gold ? a.goldMat : a.foodMat); m.scale.setScalar(1.1); const ang = k * 2.39; const rr = Math.min(0.12, 0.03 + k * 0.006); m.position.set(Math.cos(ang) * rr, 0.03 + Math.floor(k / 8) * 0.035, Math.sin(ang) * rr); m.rotation.set(rand(0, 3), rand(0, 3), 0); a.pile.add(m); }
    try { if (G.xr) handR()?.source?.gamepad?.hapticActuators?.[0]?.pulse(0.6, 60); } catch (e) { /* no haptics */ }
  };
  P.droppedFood = function (a, f) { f.m.position.y = 0.03; sfx('splat', f.m.position, 0.4); if (!f.food.bad) { a.ground.push(f); if (Math.random() < 0.4) a.thrower.say(pick(['Butterfingers!', 'Five second rule!', 'Chip, NO!', 'That was the last one!']), { prio: 0 }); } else G.scene.remove(f.m); };
  P.end_leftovers = function (a) {
    for (const f of a.flying) G.scene.remove(f.m); for (const g of a.ground) G.scene.remove(g.m); a.flying = []; a.ground = [];
    for (const k of ['trolley', 'plate', 'shadow', 'counter']) if (a[k]) G.scene.remove(a[k]); a.badge?.remove(); clearFx(a); clearWords(a);
    if (G.dog && !G.dog.playerControlled) { G.dog.timer = 2; G.dog.state = 'sit'; }
    if (a.chip > a.score) setTimeout(() => G.ui?.toast(`Chip ate ${a.chip}. Chip wins, really.`, 3, { game: true }), 400);
  };

  // =====================================================================================================
  // SNOWBALL FIGHT (3 v 3)
  // =====================================================================================================
  P.setup_snowball = function (a) {
    a.limit = 75; a.hits = 0; a.balls = []; a.charge = 0; a.cd = 0;
    const Z = { mine: -9.4, theirs: -13.6, x0: -4.6, x1: 1.6 }; a.Z = Z;
    // teams: you + two from your family's team vs three from one other team
    const pool = G.chars.filter(c => !c.isPlayer && !c.protected && c.team !== 'host' && c.brain && !c.isDown() && c.H > 1.3);
    const mine = shuffle(pool.filter(c => c.team === G.myTeam)); const byTeam = {}; for (const c of pool) if (c.team !== G.myTeam) (byTeam[c.team] ||= []).push(c);
    const otherT = Object.keys(byTeam).sort((x, y) => byTeam[y].length - byTeam[x].length)[0]; let them = shuffle(byTeam[otherT] || []).slice(0, 3);
    const rest = shuffle(pool.filter(c => !mine.slice(0, 2).includes(c) && !them.includes(c)));
    while (mine.length < 2 && rest.length) mine.push(rest.shift()); while (them.length < 3 && rest.length) them.push(rest.shift());
    a.us = [null, ...mine.slice(0, 2)]; a.them = them; a.themName = TEAMS[otherT]?.name || 'The Others'; a.themColor = TEAMS[otherT]?.color || '#ffffff';
    a.fighters = [...a.us.filter(Boolean).map((p, i) => ({ p, side: 0, hp: 3, slot: i + 1 })), ...a.them.map((p, i) => ({ p, side: 1, hp: 3, slot: i }))];
    a.myHp = 3;
    this.buildSnow(a);
    a.fighters.forEach(f => { const x = Z.x0 + 1.2 + (f.side ? f.slot * 2.0 : f.slot * 2.0), z = f.side ? Z.theirs : Z.mine; this.place(f.p, x, z, [x, f.side ? Z.mine : Z.theirs]); f.p.sumo = null; f.cd = rand(1.2, 2.5); f.moveT = rand(1, 3); f.skill = rand(0.45, 0.8); });
    G.player.teleport(Z.x0 + 1.2, Z.mine, faceYaw([Z.x0 + 1.2, Z.mine], [Z.x0 + 1.2, Z.theirs])); G.player.pitch = 0.02;
    const side = []; for (let k = 0; k < 10; k++) side.push([2.8 + (k % 2) * 0.5, -9.0 - k * 0.5]); this.crowd(side, [-1.5, -11.5], a.fighters.map(f => f.p), 6);
    a.label = () => `YOU ${'❤️'.repeat(Math.max(0, a.myHp))}${'🤍'.repeat(3 - Math.max(0, a.myHp))} · HITS ${a.hits}`;
    a.ballGeo = new THREE.SphereGeometry(0.045, 10, 8); a.ballMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
  };
  P.buildSnow = function (a) {
    const Z = a.Z; const grp = new THREE.Group(); a.snow = grp; G.scene.add(grp);
    // a white blanket over the lawn, lumpy, with drifts against the fence
    const geo = new THREE.PlaneGeometry(10, 7, 50, 35); geo.rotateX(-Math.PI / 2); const pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i); pa.setY(i, 0.02 + Math.max(0, Math.sin(x * 2.1) * Math.cos(z * 1.7)) * 0.03 + (Math.abs(z) > 3.1 || Math.abs(x) > 4.7 ? 0.08 : 0)); } geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#f4f8ff', roughness: 0.95 })); ground.position.set(-1.5, 0, -11.5); ground.receiveShadow = true; grp.add(ground);
    // two lines of snow forts (blocks of packed snow, a bit uneven) to hide behind
    const fort = (x, z) => { const F = new Prop(); for (let k = 0; k < 5; k++) for (let r = 0; r < 3 - (k === 0 || k === 4 ? 1 : 0); r++) F.rbox(0.26, 0.2, 0.26, 0.06, r % 2 ? '#eef3fa' : '#f8fbff', -0.56 + k * 0.28 + (r % 2) * 0.1, 0.1 + r * 0.19, rand(-0.02, 0.02), 0, rand(-0.15, 0.15), 0); const m = new THREE.Mesh(F.build(), vc()); m.position.set(x, 0, z); m.castShadow = true; grp.add(m); return { x, z, hw: 0.75, hd: 0.2, h: 0.55 }; };
    a.forts = []; for (let k = 0; k < 3; k++) { a.forts.push(fort(Z.x0 + 1.2 + k * 2.0, Z.mine - 0.75)); a.forts.push(fort(Z.x0 + 1.2 + k * 2.0, Z.theirs + 0.75)); }
    // snowmen at the sides: three balls, coal eyes and buttons, a carrot nose, a scarf and a hat
    const snowman = (x, z, hat, scarf) => { const S = new Prop(); S.sph(0.32, '#f8fbff', 0, 0.3, 0, 1, 0.92, 1, 16).sph(0.23, '#f8fbff', 0, 0.78, 0, 1, 0.95, 1, 14).sph(0.16, '#f8fbff', 0, 1.13, 0, 1, 1, 1, 12)
        .sph(0.018, '#111', -0.055, 1.17, 0.14).sph(0.018, '#111', 0.055, 1.17, 0.14).cone(0.025, 0.14, '#f77f00', 0, 1.13, 0.2, Math.PI / 2, 0, 0, 8);
      for (let k = 0; k < 3; k++) S.sph(0.02, '#111', 0, 0.68 + k * 0.1, 0.22 - k * 0.012);
      S.cyl(0.17, 0.17, 0.07, scarf, 0, 0.98, 0, 0, 0, 0, 16).box(0.07, 0.25, 0.025, scarf, 0.09, 0.86, 0.15, 0, 0, 0.2);
      if (hat === 'top') S.cyl(0.18, 0.18, 0.02, '#111', 0, 1.27, 0, 0, 0, 0, 16).cyl(0.11, 0.11, 0.2, '#111', 0, 1.37, 0, 0, 0, 0, 16).cyl(0.112, 0.112, 0.04, '#c41e1e', 0, 1.3, 0, 0, 0, 0, 16);
      else S.cone(0.14, 0.3, '#c41e1e', 0, 1.38, 0, 0, 0, 0.2, 14).sph(0.04, '#ffffff', 0.05, 1.52, 0).cyl(0.145, 0.145, 0.05, '#ffffff', 0, 1.25, 0, 0, 0, 0, 16);
      S.cyl(0.015, 0.012, 0.45, '#5a3a20', 0.28, 0.85, 0, 0, 0, -1.0, 6).cyl(0.015, 0.012, 0.45, '#5a3a20', -0.28, 0.85, 0, 0, 0, 1.0, 6);
      const m = new THREE.Mesh(S.build(), vc()); m.position.set(x, 0, z); m.rotation.y = rand(-0.4, 0.4); m.castShadow = true; grp.add(m); };
    snowman(Z.x1 + 0.7, -10.6, 'top', '#c41e1e'); snowman(Z.x0 - 0.5, -12.6, 'santa', '#1f6a2f'); snowman(Z.x1 + 0.9, -13.4, 'santa', '#1d4ed8');
    // a pile of ready-made snowballs behind your fort
    const pile = new Prop(); for (let k = 0; k < 14; k++) pile.sph(0.05, '#ffffff', rand(-0.18, 0.18), 0.05 + (k > 9 ? 0.08 : 0), rand(-0.12, 0.12)); const pm = new THREE.Mesh(pile.build(), vc()); pm.position.set(Z.x0 + 0.5, 0, Z.mine + 0.3); grp.add(pm);
    // falling snow
    const N = 900, pos = new Float32Array(N * 3); for (let k = 0; k < N; k++) { pos[k * 3] = rand(-6.5, 3.5); pos[k * 3 + 1] = rand(0, 4); pos[k * 3 + 2] = rand(-15, -8); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const fc = document.createElement('canvas'); fc.width = fc.height = 32; const fg = fc.getContext('2d'); const gr = fg.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); fg.fillStyle = gr; fg.fillRect(0, 0, 32, 32);
    a.flakes = new THREE.Points(sg, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(fc), color: '#ffffff', size: 0.04, transparent: true, opacity: 0.9, depthWrite: false })); grp.add(a.flakes);
    a.light = new THREE.HemisphereLight('#dfe9ff', '#ffffff', 0.5); grp.add(a.light);
  };
  P.begin_snowball = function (a) {
    // show the teams first
    a.paused = true; const us = ['You', ...a.us.filter(Boolean).map(p => p.name)].join(' · '), them = a.them.map(p => p.name).join(' · ');
    card({ kicker: 'SNOWBALL FIGHT · 3 v 3', title: 'THE TEAMS', sub: `<b style="color:${TEAMS[G.myTeam]?.color || '#ffd700'}">YOUR TEAM</b><br>${us}<br><br>⚔️<br><br><b style="color:${a.themColor}">${a.themName.toUpperCase()}</b><br>${them}<br><br><small>Three hits and you're out.</small>`, icon: '❄️', secs: 4.8, c1: '#3a6ea5', c2: '#0f2440' })
      .then(() => { a.paused = false; a.t = 0; if (G.xr) this.vrSnowSetup(a); G.popup?.splash?.('FIGHT!', ''); sfx('whistle', null, 1); });
  };
  // ---- in the headset: snowballs lie on the snow by your fort. Point at one (it glows, with a ring under it and a
  // line from your hand), pull the trigger and it flies to your hand; throw it for real and let go of the trigger.
  P.vrSnowSetup = function (a) {
    a.pick = []; a.pickMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, emissive: '#000000' });
    a.aimRing = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 24), new THREE.MeshBasicMaterial({ color: '#ffd700' })); a.aimRing.rotation.x = Math.PI / 2; a.aimRing.visible = false; a.snow.add(a.aimRing);
    a.aimLines = {}; for (const k of ['L', 'R']) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, 1)]), new THREE.LineBasicMaterial({ color: '#ffd700', transparent: true, opacity: 0.8 })); l.visible = false; l.frustumCulled = false; a.snow.add(l); a.aimLines[k] = l; }
    this.restockSnow(a);
  };
  P.restockSnow = function (a) {
    const me = G.player.pos; while (a.pick.filter(b => !b.taken).length < 7) { const m = new THREE.Mesh(a.ballGeo, a.pickMat.clone()); m.scale.setScalar(1.25);
      m.position.set(clamp(me.x + rand(-1.4, 1.4), a.Z.x0 + 0.2, a.Z.x1 - 0.2), 0.07, clamp(me.z + rand(-0.9, 0.9), a.Z.mine - 0.4, a.Z.mine + 0.9)); a.snow.add(m); a.pick.push({ m }); }
  };
  P.vrSnowTick = function (a, dt) {
    if (!a.pick) return; const H = G.player.xrIn?.hands || {}; let aimed = null;
    for (const k of ['L', 'R']) { const rec = H[k]; const line = a.aimLines[k]; line.visible = false; if (!rec?.palm) continue;
      if (rec.ball) { const b = rec.ball; b.k = Math.min(1, (b.k || 0) + dt / 0.18); b.m.position.lerpVectors(b.from, rec.palm, b.k * b.k * (3 - 2 * b.k)); continue; } // flying in / held in your hand
      if (a.myHp <= 0) continue;
      const o = rec.palm, d = V(0, 0, -1).applyQuaternion(rec.q); let best = null, bs = 1e9;
      for (const b of a.pick) { if (b.taken) continue; const to = b.m.position.clone().sub(o); const along = to.dot(d); if (along < 0.1 || along > 7) continue; const perp = to.clone().addScaledVector(d, -along).length(); const lim = 0.18 + along * 0.06; if (perp < lim && perp / lim + along * 0.02 < bs) { bs = perp / lim + along * 0.02; best = b; } }
      rec.aimBall = best; if (best) { aimed = best; const pa = line.geometry.attributes.position; pa.setXYZ(0, o.x, o.y, o.z); pa.setXYZ(1, best.m.position.x, best.m.position.y, best.m.position.z); pa.needsUpdate = true; line.visible = true; } }
    for (const b of a.pick) if (!b.taken) b.m.material.emissive.set(b === aimed ? '#ffcc33' : '#000000');
    a.aimRing.visible = !!aimed; if (aimed) { a.aimRing.position.set(aimed.m.position.x, 0.03, aimed.m.position.z); a.aimRing.scale.setScalar(1 + Math.sin(G.time * 8) * 0.12); }
  };
  P.vrPinch_snowball = function (a, rec) {
    if (a.paused || a.myHp <= 0 || !a.pick || rec.ball) return !!rec.ball; const b = rec.aimBall; if (!b || b.taken) return false;
    b.taken = true; b.from = b.m.position.clone(); b.k = 0; rec.ball = b; rec.aimBall = null; sfx('whoosh', b.from, 0.4); try { rec.source?.gamepad?.hapticActuators?.[0]?.pulse(0.5, 40); } catch (e) { /* no haptics */ }
    setTimeout(() => this.restockSnow(a), 600); return true;
  };
  P.vrPinchEnd_snowball = function (a, rec) {
    const b = rec.ball; if (!b) return false; rec.ball = null; a.snow.remove(b.m);
    let v = rec.vel.clone().multiplyScalar(1.5); if (v.length() < 2.5) v = V(0, 0, -1).applyQuaternion(rec.q).multiplyScalar(6).add(V(0, 1.2, 0)); if (v.length() > 18) v.setLength(18); // a proper throw keeps your arm's speed; a limp let-go just lobs it forward
    if (a.myHp > 0 && !a.paused) this.throwBall(a, rec.palm.clone(), v, 0, null); return true;
  };
  P.throwBall = function (a, from, vel, side, owner) { const m = new THREE.Mesh(a.ballGeo, a.ballMat); m.position.copy(from); G.scene.add(m); a.balls.push({ m, v: vel, side, owner, t: 0 }); sfx('whoosh', from, 0.35); };
  P.playerThrow = function (a, power) {
    if (a.paused || a.myHp <= 0 || a.cd > 0) return; a.cd = 0.45;
    let from, dir; const h = handR();
    if (h?.palm) { from = h.palm.clone(); dir = V(0, 0, -1).applyQuaternion(h.q); dir.y += 0.1; }
    else { from = G.player.headPos(new THREE.Vector3()); dir = G.player.forward(new THREE.Vector3()); from.addScaledVector(dir, 0.35).add(V(0, -0.12, 0)); dir.y += 0.14; }
    this.throwBall(a, from, dir.normalize().multiplyScalar(7 + power * 8), 0, null); G.player.fp?.punch?.('R');
  };
  P.tick_snowball = function (a, dt) {
    stepFx(a, dt); stepWords(a, dt);
    const fp = a.flakes.geometry.attributes.position; for (let k = 0; k < fp.count; k++) { let y = fp.getY(k) - dt * 0.6; if (y < 0) y = 4; fp.setY(k, y); fp.setX(k, fp.getX(k) + Math.sin(G.time + k) * dt * 0.05); } fp.needsUpdate = true;
    if (a.paused) { a.t = 0; return; }
    if (G.xr) this.vrSnowTick(a, dt);
    a.cd -= dt; a.charge = 0;
    // you: hold THROW for power, let go to throw (phone); trigger in the headset
    const c = G.player.controls; if (!G.xr && a.myHp > 0) { if (c.btn('throw').down) { a.hold = Math.min(1, (a.hold || 0) + dt * 1.5); a.charge = a.hold; } if (c.btn('throw').released) { this.playerThrow(a, a.hold || 0.3); a.hold = 0; } }
    // the others: shuffle between spots behind their forts, pop up and throw at someone on the other side
    const alive = (side) => [...a.fighters.filter(f => f.side === side && f.hp > 0).map(f => ({ pos: f.p.pos, f })), ...(side === 0 && a.myHp > 0 ? [{ pos: G.player.pos, me: true }] : [])];
    for (const f of a.fighters) { if (f.hp <= 0 || f.p.state !== 'anim') continue; const p = f.p, b = p.brain; f.cd -= dt; f.moveT -= dt;
      if (f.moveT < 0) { f.moveT = rand(2.5, 5); const x = clamp(a.Z.x0 + 0.6 + rand(0, 5.2), a.Z.x0 + 0.4, a.Z.x1 - 0.2), z = (f.side ? a.Z.theirs : a.Z.mine) + rand(-0.3, 0.3); G.ai?.goTo(b, V(x, 0, z), () => { b.state = 'scripted'; b.timer = 9999; p.base = 'stand'; }, 1.8); }
      const targets = alive(1 - f.side); if (!targets.length) continue; const tgt = targets.reduce((m, t) => (!m || t.pos.distanceTo(p.pos) < m.pos.distanceTo(p.pos)) ? t : m, null);
      if (b.state !== 'walk') p.yaw = Math.atan2(tgt.pos.x - p.pos.x, tgt.pos.z - p.pos.z);
      if (f.cd < 0) { f.cd = rand(1.8, 3.2) - f.skill; p.gesture = 'throwOver'; p.gestureT = 0;
        setTimeout(() => { if (!a.live || f.hp <= 0 || p.state !== 'anim') return; p.gesture = null; const from = p.handPos('R', new THREE.Vector3()); from.y = Math.max(from.y, 1.5); const err = (1 - f.skill) * 1.3; const aim = tgt.pos.clone().add(V(rand(-err, err), 1.1 + rand(-0.3, 0.3), rand(-err * 0.5, err * 0.5)));
          this.throwBall(a, from, lob(from, aim, rand(7, 9)), f.side, p); }, 320); } }
    // snowballs in the air
    for (const s of a.balls) { s.t += dt; s.v.y -= 9.8 * dt; s.m.position.addScaledVector(s.v, dt); const q = s.m.position;
      let hit = null;
      if (q.y < 0.04) hit = 'ground';
      for (const ft of a.forts) if (Math.abs(q.x - ft.x) < ft.hw && Math.abs(q.z - ft.z) < ft.hd && q.y < ft.h) hit = 'fort';
      if (!hit) for (const f of a.fighters) { if (f.hp <= 0 || f.side === s.side || f.p.state !== 'anim') continue; const pp = f.p.pos; if (Math.hypot(q.x - pp.x, q.z - pp.z) < 0.3 && q.y > 0.1 && q.y < f.p.H + 0.1) { hit = f; break; } }
      if (!hit && s.side === 1 && a.myHp > 0) { const pp = G.player.pos; if (Math.hypot(q.x - pp.x, q.z - pp.z) < 0.33 && q.y > 0.1 && q.y < 1.85) hit = 'me'; }
      if (hit) { s.done = true; G.scene.remove(s.m); burst(a, q.clone(), '#ffffff', 12, 1.4, 0.018); sfx('splat', q, hit === 'ground' ? 0.25 : 0.8);
        if (hit === 'me') this.snowHitMe(a, s); else if (hit.p) this.snowHit(a, hit, s); } }
    a.balls = a.balls.filter(s => !s.done && s.t < 4);
    // finished? one side all out
    const usLeft = a.fighters.filter(f => f.side === 0 && f.hp > 0).length + (a.myHp > 0 ? 1 : 0), themLeft = a.fighters.filter(f => f.side === 1 && f.hp > 0).length;
    if ((!usLeft || !themLeft) && !a.over) { a.over = true; a.won = themLeft === 0; this.snowEnd(a); }
  };
  P.snowHit = function (a, f, s) {
    f.hp--; const p = f.p; if (s.side === 0 && !s.owner) { a.hits++; a.score = a.hits + (a.won ? 3 : 0); floatWord(a, f.hp > 0 ? 'HIT!' : 'OUT!', p.headPos(new THREE.Vector3()).add(V(0, 0.3, 0)), f.hp > 0 ? '#ffffff' : '#ff4d4d', 0.2); sfx('ding', null, 0.4); }
    p.setMood?.('shock', 1); p.say(pick(f.hp > 0 ? ['Oi!', 'Right in the face!', 'That was cold!', 'You\'ll pay for that!'] : ['I\'m out!', 'Nooo!', 'I\'m frozen!']), { prio: 1 });
    if (f.hp <= 0) { const d = V(p.pos.x - s.m.position.x, 0, p.pos.z - s.m.position.z).normalize(); p.knock(d.multiplyScalar(p.mass * 2).setY(p.mass * 1.2), 1, { force: true }); }
  };
  P.snowHitMe = function (a, s) {
    a.myHp--; if (G.fx) G.fx.shake = Math.max(G.fx.shake || 0, 0.03); sfx('splat', null, 0.9); // no big pop-up: the hearts in the timer show it
    s.owner?.say(pick(['GOT YOU!', 'Have that!', 'Bullseye!']), { prio: 1 });
    try { if (G.xr) for (const h of Object.values(G.player.xrIn.hands)) h?.source?.gamepad?.hapticActuators?.[0]?.pulse(1, 120); } catch (e) { /* no haptics */ }
    if (a.myHp <= 0) { a.btn?.(); a.btn = null; G.player.knockDown?.(s.m.position); G.ui?.toast('You\'re out! Your team fights on…', 2.5, { game: true }); }
  };
  P.snowEnd = function (a) {
    a.score = a.hits + (a.won ? 3 : 0); a.btn?.(); a.btn = null; for (const f of a.fighters) if (f.hp > 0 && f.p.state === 'anim') { f.p.gesture = 'cheer'; f.p.say(pick(['WE WIN!', 'Snow kings!', 'Get in!']), { prio: 1 }); }
    card({ kicker: 'SNOWBALL FIGHT', title: a.won ? 'YOUR TEAM WINS!' : `${a.themName.toUpperCase()} WIN`, sub: `You landed ${a.hits} hit${a.hits === 1 ? '' : 's'}.${a.won ? ' +3 for the win.' : ''}`, icon: a.won ? '🏆' : '🥶', secs: 2.6, c1: a.won ? '#2d8a4f' : '#3a6ea5', c2: '#0f2440' }).then(() => this.stop(a));
  };
  P.end_snowball = function (a) {
    if (!a.over) { const us = a.fighters.filter(f => f.side === 0).reduce((s, f) => s + Math.max(0, f.hp), 0) + Math.max(0, a.myHp), them = a.fighters.filter(f => f.side === 1).reduce((s, f) => s + Math.max(0, f.hp), 0); a.won = us > them; a.score = a.hits + (a.won ? 3 : 0); }
    a.btn?.(); for (const s of a.balls) G.scene.remove(s.m); a.balls = []; if (a.snow) G.scene.remove(a.snow); for (const h of Object.values(G.player.xrIn?.hands || {})) if (h) { h.ball = null; h.aimBall = null; } clearFx(a); clearWords(a); a.charge = 0;
    for (const f of a.fighters) f.p.gesture = null;
  };
}
