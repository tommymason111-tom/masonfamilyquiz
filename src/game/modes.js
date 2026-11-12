// Game modes, picked on the start screens: Quick Quiz, Mini Games, Fling the Relative, Drinks Run, Free Roam.
// (Playing as Chip, Mason or Harrison skips the mode and goes straight into roaming the house at their height.)
import * as THREE from 'three';
import { G, on, emit, rand, pick, clamp, shuffle } from '../core.js';
import { sfx } from '../engine/audio.js';
import { tvFrame, wrapText } from './screens.js';
import { loadStore, saveStore } from './settings.js';
import { DRINK_ORDERS, TEAMS, TEAM_IDS } from '../chars/cast.js';
import { GAMES } from './minigames.js';
import { card, board, timer } from './popup.js';
import { canvasTex } from '../engine/textures.js';

export const MODES = [
  { id: 'quick', icon: '⚡', name: 'Quick Quiz', desc: 'Into the living room: two quick rounds on the big question cards, marking, then the Mason Cup.', tag: '10 min' },
  { id: 'games', icon: '🎲', name: 'Mini Games', desc: 'Five games: sprout throwing and cracker pulls in the dining room, sumo in the garden ring, find the magic elves round the house, then pass the parcel.', tag: '5 games' },
  { id: 'fling', icon: '🚀', name: 'Fling the Relative', desc: 'Out in the garden. The family line up, you grab and launch them down the lawn. There\'s a measuring tape.', tag: '10 throws' },
  { id: 'beer', icon: '🍺', name: 'Drinks Run', desc: 'Everyone wants a drink and they\'re getting cross. The drinks are poured — find the right one and get it to them.', tag: '3:00 · orders' },
  { id: 'sandbox', icon: '🎄', name: 'Free Roam', desc: 'No quiz, no timer. Just the family, the house and loads to throw.', tag: 'Relax' },
];
export const ROAM = { id: 'roam', icon: '🐾', name: 'Cause Havoc', desc: 'Roam the house at your own height and bother everyone.', tag: '' };
export const FULL = { id: 'quiz', icon: '🏆', name: 'The Full Quiz', desc: 'All the rounds, the mini games in between and the Mason Cup.', tag: '' };
export const modeById = (id) => MODES.find(m => m.id === id) || (id === 'roam' ? ROAM : id === 'quiz' ? FULL : MODES[0]);
export function selectedMode() { const q = new URLSearchParams(location.search).get('mode'); if (q && (MODES.some(m => m.id === q) || q === 'roam' || q === 'quiz')) return q; /* 'quiz' = the full evening (hidden; used by tests) */ const s = loadStore('mode', 'quick'); return MODES.some(m => m.id === s) ? s : 'quick'; }

const DRINK = {
  lager: { label: 'lager', icon: '🍺', ids: ['lager', 'pint_full'], where: 'Kitchen fridge (or the garage fridge)' },
  bitter: { label: 'bitter', icon: '🍺', ids: ['bitter', 'pint_full'], where: 'Garage fridge' },
  pint: { label: 'pint', icon: '🍺', ids: ['pint_full', 'lager', 'bitter'], where: 'Poured pints on the breakfast bar' },
  prosecco: { label: 'Prosecco', icon: '🥂', ids: ['prosecco', 'wine_full'], where: 'Kitchen fridge' },
  wine: { label: 'glass of wine', icon: '🍷', ids: ['wine_full', 'white_wine', 'red_wine'], where: 'Poured glasses of wine on the breakfast bar' },
  small: { label: 'small one', icon: '🍷', ids: ['wine_full', 'prosecco', 'white_wine'], where: 'Poured glasses of wine on the breakfast bar' },
  juice: { label: 'juice', icon: '🧃', ids: ['juice', 'squash'], where: 'Kitchen fridge' },
};

// what people chat about in each mode (idle chatter gets swapped for these)
const ROAM_LINES = {
  Chip: ['Chip! Get down!', 'Who let Chip in here?', 'CHIP! That\'s my sausage roll!', 'Aww, Chip. Who\'s a good boy?', 'Chip, no! Leave it!', 'Martin, your dog is at it again.', 'He\'s got the remote!', 'Chip\'s had a pig in blanket, I saw that.'],
  Mason: ['Mason, put that down!', 'Where\'s Mason gone?', 'Mason, no throwing!', 'Jodie, he\'s at it again!', 'Mason! That\'s Grandad\'s!', 'Who gave Mason sugar?', 'Mason, gentle!', 'Ha! He\'s a little menace.'],
  Harrison: ['Harrison, that\'s not a toy!', 'Aww, look at the little elf!', 'Bradley, he\'s escaped!', 'Harrison, come here, trouble!', 'Who dressed him as an elf? Amazing.', 'He\'s faster than he looks!', 'Harrison! Not the tree!', 'Jingle bells, Harrison!'],
};
const GAME_LINES = {
  sproutPong: ['Get it in the cup!', 'Shot!', 'Lob it, don\'t throw it!', 'That sprout\'s got spin on it.', 'Ooh, so close!'],
  crackerDuel: ['Pull it!', 'Come on, pull!', 'Both hands!', 'It\'s going to go…', 'Who\'s got the bigger end?'],
  sumo: ['Hakkeyoi!', 'Push him out!', 'Go on, shove!', 'Get low!', 'Into the hedge!'],
  elfHunt: ['Is that an elf?', 'Try the kitchen!', 'I saw one glowing!', 'Warmer… colder…', 'Check the garage!'],
  parcel: ['Pass it on!', 'Stop the music!', 'Tear it!', 'It\'s a satsuma, I bet.', 'Don\'t keep hold of it!'],
  any: ['Come on!', 'Go on!', 'Ooh!', 'Unbelievable.', 'What a game.'],
};
const FLING_LINES = ['Throw him further!', 'That\'s a new record!', 'Mind the fence!', 'Did that one count?', 'Get the tape measure!', 'Into the snowman!', 'Again! Again!'];

export class Modes {
  constructor() {
    G.modes = this; this.id = selectedMode(); this.def = modeById(this.id); this.score = 0; this.t = 0; this.limit = 0; this.running = false; this.lines = [];
    on('started', () => this.start());
    G.updaters.push((dt) => this.update(dt));
    this.hud = document.getElementById('modeHud');
  }
  best() { return loadStore('best.' + this.id, null); }
  // the game modes have no random notifications/events (systems.js and ui.toast check this)
  quiet() { return G.ui?.started && ['roam', 'games', 'fling', 'beer'].includes(this.id); }
  // what people say follows the mode: Drinks Run only the thirsty speak, Chip/Mason/Harrison everyone talks about them,
  // Mini Games and Fling the chatter is about the game. Free roam and the quiz are untouched.
  speech(p, text, opts) {
    const id = this.id; if (!G.ui?.started || id === 'quick' || id === 'quiz' || id === 'sandbox') return text;
    const prio = opts.prio ?? 0;
    if (id === 'beer') return opts.order || (this.orders || []).some(o => o.p === p) ? text : null;
    if (prio >= 2) return text;
    if (id === 'roam') { const me = G.me?.name || 'Chip'; if (text.includes(me)) return text; if (Math.random() < 0.5) return null; return pick(ROAM_LINES[me] || ROAM_LINES.Chip); }
    if (id === 'games') { if (prio >= 1) return text; if (Math.random() < 0.5) return null; return pick(GAME_LINES[G.minigames?.active?.id] || GAME_LINES.any); }
    if (id === 'fling') { if (prio >= 1) return text; if (Math.random() < 0.5) return null; return pick(FLING_LINES); }
    return text;
  }
  add(pts, why) { if (!this.running) return; this.score += Math.round(pts); this.lines.unshift(`+${Math.round(pts)}  ${why}`); this.lines.length = Math.min(this.lines.length, 5); }
  start() {
    this.def = modeById(this.id); const q = G.quiz; document.body.classList.remove('mode-fling', 'mode-beer', 'mode-games', 'mode-quick', 'mode-roam');
    document.body.classList.add('mode-' + (this.id === 'quiz' ? 'quick' : this.id));
    if (this.id === 'quiz') { this.running = false; this.hudOff?.(); return; }
    if (this.id !== 'quick') { q.disabled = true; q.skipWelcome = true; G.systems.nextRoast = Infinity; }
    this.running = true; this.t = 0; const id = this.id;
    if (id === 'quick') return this.quickSetup();
    if (id === 'games') return this.gamesSetup();
    if (id === 'fling') return this.flingSetup();
    if (id === 'beer') return this.beerSetup();
    this.running = false; this.hudOff();
    if (id === 'roam') { this.running = true; this.havocSetup(); const who = G.me?.name || 'Chip'; const L = { Chip: ['Paw-punch the family, steal the sausage rolls, sit on the answer sheets.', ['🐾', '🦴', '💥', '🌭']], Mason: ['Throw everything. Climb everything. Shout DINOSAUR.', ['🦖', '💥', '🧱', '🚗']], Harrison: ['Tiny elf. Maximum chaos. Jingle bells!', ['🧝', '🔔', '💥', '🎄']] }[who] || ['Cause havoc.', ['💥']];
      setTimeout(() => { sfx('bigthud', null, 1); setTimeout(() => sfx('crack', null, 0.9), 450); setTimeout(() => sfx('cheer', null, 0.5), 1300); G.popup.havoc(who, L[0], L[1]); }, 400); }
    G.screens.setTV((g, W, H) => { tvFrame(g, W, H, 'FREE ROAM'); g.fillStyle = '#fff'; g.font = '30px sans-serif'; wrapText(g, 'No quiz tonight. Martin is devastated. Throw whatever you like (except the tree).', 60, 170, 900, 42); });
  }
  // ---------------- Cause Havoc (Chip, Mason, Harrison): the havoc meter ----------------
  // people knocked over (combos for several in quick succession), things thrown and things knocked flying all count
  havocSetup() {
    this.score = 0; this.hv = { meter: 0, combo: 0, lastHit: -9, hits: 0, things: 0, seen: new Map() };
    if (this._hvOn) return; this._hvOn = true;
    on('ragdoll', (p) => { if (this.id !== 'roam' || !this.hv || p.isPlayer || G.time - (p.playerHitT ?? -9) > 1.5) return; const h = this.hv;
      h.combo = G.time - h.lastHit < 2.6 ? Math.min(8, h.combo + 1) : 1; h.lastHit = G.time; h.hits++; const pts = 10 * h.combo; this.score += pts; h.meter = Math.min(100, h.meter + 9 + h.combo * 4);
      this.lines.unshift(`+${pts}  ${p.name} flattened${h.combo > 1 ? ` (x${h.combo})` : ''}`); this.lines.length = Math.min(this.lines.length, 5);
      if (h.combo > 1) { G.ui?.toast(`💥 x${h.combo} COMBO! +${pts}`, 1.6, { game: true }); sfx('ding', null, 0.4 + h.combo * 0.05); } this.drawHud(); });
    on('thrown', () => { if (this.id !== 'roam' || !this.hv) return; this.score += 3; this.hv.things++; this.hv.meter = Math.min(100, this.hv.meter + 3); });
  }
  tickHavoc(dt) {
    const h = this.hv; if (!h) return; h.meter = Math.max(0, h.meter - dt * 2.2); if (G.time - h.lastHit > 2.6) h.combo = 0;
    if (G.frame % 15) return; // things knocked flying (by you, Chip's paws or something you threw)
    for (const it of G.items.instances) { if (it.held || it.type.fixed || it.body.isSleeping()) continue; const v = it.body.linvel(); if (Math.hypot(v.x, v.y, v.z) < 1.6) continue;
      if (G.time - (it.playerT ?? -9) > 3 && !it.releasedRecently) continue; const last = h.seen.get(it) ?? -9; if (G.time - last < 4) continue; h.seen.set(it, G.time); this.score += 2; h.things++; h.meter = Math.min(100, h.meter + 2); }
  }
  // ---------------- Quick Quiz: in the living room, straight in ----------------
  quickSetup() {
    const q = G.quiz; q.lastRound = 1; q.qPer = 5; q.noMiniGames = true; q.skipWelcome = true; this.running = false; this.hudOff();
    if (G.me && !G.me.isDog) G.player.teleport(-2.2, -1.75, 0.67);
    card({ kicker: 'QUICK QUIZ', title: 'ROUND ONE', sub: `Two rounds, five questions each. Tap your answer on the cards. ${q.martin()?.name || 'Martin'} is marking.`, icon: '⚡', secs: 3.6 }).then(() => { if (q.phase === 'arrival') { q.phase = 'go'; q.startRound(0); } });
  }
  // ---------------- Mini Games: dining room + conservatory ----------------
  async gamesSetup() {
    this.hudOff(); this.running = false; const mg = G.minigames; mg.total = {};
    for (let i = 0; i < GAMES.length; i++) await mg.play(i);
    mg.releaseAll();
    const rows = mg.overall(); const mine = rows.find(r => r.me); const top = rows.slice().sort((a, b) => b.score - a.score)[0];
    sfx(top.me ? 'cheer' : 'drum', null, 1);
    await board({ kicker: 'MINI GAMES — FINAL STANDINGS', title: top.me ? 'YOU WIN!' : `${top.name.toUpperCase()} WIN`, rows, unit: ' pts', footer: '3 points for a win, 2 for second, 1 for third.', secs: 7 });
    this.running = true; this.score = (mine?.score || 0) * 100; this.end();
  }
  // ---------------- Fling the Relative (garden only) ----------------
  flingSetup() {
    this.throws = 0; this.maxThrows = 10; this.limit = 0; this.dists = []; this.lane = { x0: -5.6, z: -11.6 };
    // clear the lawn of clutter
    for (const it of G.items.instances.slice()) { if (it.type.fixed || it.held) continue; const t = it.body.translation(); if (t.z < -8.6 && t.z > -14.6 && t.x > -7.5 && t.x < 5.6) G.items.remove(it); }
    this.buildRuler();
    G.player.teleport(-6.3, this.lane.z, -Math.PI / 2); G.player.pitch = -0.12;
    // everyone lines up on the patio
    const q = shuffle(G.chars.filter(c => !c.isPlayer && !c.protected && c.brain && c.team !== 'host'));
    if (G.chars.find(c => c.team === 'host' && !c.isPlayer)) q.push(G.chars.find(c => c.team === 'host' && !c.isPlayer));
    this.queue = q; this.queue.forEach((p, i) => this.toQueue(p, i));
    this.nextUp();
    on('grab', (h) => { if (this.id === 'fling' && h.kind === 'char') this.holding = h.ref; });
    on('thrown', (h) => { if (this.id !== 'fling' || h.kind !== 'char' || !this.running) return; this.throws++; this.flying = { p: h.ref, t: 0 }; this.holding = null; });
    card({ kicker: 'FLING THE RELATIVE', title: '10 THROWS', sub: 'GRAB whoever\'s at the front, hold THROW to wind up, let go to launch them down the lawn. The tape measures it.', icon: '🚀', secs: 4 });
  }
  toQueue(p, i) { const s = new THREE.Vector3(-7.0 + (i % 2) * 0.55, 0, -10.1 + Math.floor(i / 2) * 0.7); G.ai?.sendTo(p.name, s, () => { p.base = 'stand'; p.brain.state = 'scripted'; p.brain.timer = 9999; p.yaw = Math.PI; p.gesture = Math.random() < 0.3 ? 'armsFolded' : null; }, 1.4); }
  nextUp() {
    if (this.throws >= this.maxThrows) return; const p = this.queue.find(c => !c.flung && c.state === 'anim'); if (!p) return; this.up = p;
    G.ai?.sendTo(p.name, new THREE.Vector3(this.lane.x0 + 0.2, 0, this.lane.z), () => { p.base = 'stand'; p.brain.state = 'scripted'; p.brain.timer = 9999; p.yaw = -Math.PI / 2; p.say(pick(['Go on then.', 'Not the face!', 'I\'ve just eaten!', 'Ten metres. Easy.', 'Mind the fence!']), { prio: 1 }); }, 1.6);
    G.ui?.toast(`Next up: ${p.name}. GRAB, then hold THROW.`, 3, { game: true });
  }
  buildRuler() {
    const len = 10.4, W = 2048, Hh = 96; const tex = canvasTex(W, Hh); const g = tex.userData.ctx;
    g.fillStyle = '#f5d10f'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#111'; g.fillRect(0, 0, W, 6); g.fillRect(0, Hh - 6, W, 6);
    for (let m = 0; m <= 100; m++) { const x = m / 100 * (W - 8) + 4; const big = m % 10 === 0, mid = m % 5 === 0; g.fillRect(x - (big ? 2 : 1), 6, big ? 4 : 2, big ? 46 : mid ? 30 : 16); if (big) { g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText(m / 10 + 'm', Math.min(W - 40, Math.max(30, x)), 86); } }
    tex.needsUpdate = true; tex.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.42), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })); m.rotation.x = -Math.PI / 2; m.position.set(this.lane.x0 + len / 2, 0.012, this.lane.z - 0.85); G.scene.add(m);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 1.8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); line.rotation.x = -Math.PI / 2; line.position.set(this.lane.x0, 0.013, this.lane.z); G.scene.add(line);
    this.flagMat = new THREE.MeshStandardMaterial({ color: '#c1121f' }); this.flags = [];
  }
  flag(x, z, d) { const grp = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7), new THREE.MeshStandardMaterial({ color: '#ddd' })); pole.position.y = 0.35; grp.add(pole);
    const tx = canvasTex(256, 128); const g = tx.userData.ctx; g.fillStyle = '#c1121f'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#fff'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.fillText(d.toFixed(1) + 'm', 128, 86); tx.needsUpdate = true;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide })); fl.position.set(0.2, 0.6, 0); grp.add(fl); grp.position.set(x, 0, z); grp.lookAt(G.player.headPos(new THREE.Vector3()).setY(0)); G.scene.add(grp); this.flags.push(grp); }
  tickFling(dt) {
    const f = this.flying; if (!f) return; f.t += dt; const p = f.p; if (!p.bodies) return; const b = p.bodies[0]; const v = b.linvel(), t = b.translation();
    if (f.t > 0.8 && Math.hypot(v.x, v.y, v.z) < 0.6) { this.flying = null; p.flung = true; const d = Math.max(0, t.x - this.lane.x0); this.dists.push({ name: p.name, d }); const pts = Math.round(d * 100); this.add(pts, `${p.name}: ${d.toFixed(1)} m`);
      const best = Math.max(...this.dists.map(x => x.d)); this.flag(t.x, t.z, d); sfx(d >= best ? 'cheer' : 'boing', null, 0.8);
      card({ kicker: `THROW ${this.throws} OF ${this.maxThrows}`, title: `${d.toFixed(1)} METRES`, sub: d >= best && this.dists.length > 1 ? `${p.name} — NEW BEST!` : `${p.name} landed.`, secs: 2.2, c1: '#2d6a4f', c2: '#0e3a20' })
        .then(() => { setTimeout(() => { if (p.brain) { p.brain.state = 'idle'; G.ai?.sendTo(p.name, new THREE.Vector3(-2.5 + rand(-1, 1), 0, -7.6 + rand(-0.3, 0.3)), () => { p.base = 'stand'; p.brain.state = 'scripted'; p.brain.timer = 9999; p.yaw = -Math.PI / 2; }); } }, 2500);
          if (this.throws >= this.maxThrows) { const rows = this.dists.slice().sort((a, b) => b.d - a.d).slice(0, 5).map((x, i) => ({ name: x.name, score: +x.d.toFixed(1), color: ['#ffd700', '#c0c0c0', '#cd7f32', '#888', '#666'][i], me: false })); board({ kicker: 'FLING THE RELATIVE', title: 'LONGEST THROWS', rows, unit: ' m', secs: 6 }).then(() => this.end()); }
          else this.nextUp(); }); }
  }
  // ---------------- Drinks Run ----------------
  beerSetup() {
    this.limit = 180; this.orders = []; this.orderT = 1.5; G.systems.nextOrder = Infinity; this.served = 0; this.missed = 0; this.restock();
    // nobody wandering about: everyone sits or stands to the side; the fridges are already open
    G.minigames?.seatEveryone(); for (const h of G.items.hinged) if (h.isFridge) h.open?.(1.45);
    if (G.me && !G.me.isDog) G.player.teleport(3.0, 2.6, -0.4);
    // the clock and the first order only start once the instructions have gone
    this.running = false;
    card({ kicker: 'DRINKS RUN', title: 'EVERYONE\'S THIRSTY', sub: 'The drinks are already poured and the fridges are open. When someone wants a drink a bubble pops up over their head: grab the right one and take it to them before their bar goes red. It gets busier.', icon: '🍺', secs: 5.5 }).then(() => { this.running = true; this.t = 0; });
  }
  restock() {
    const add = (id, x, y, z, n = 2) => { const have = (G.items.byType[id] || []).filter(i => { const t = i.body.translation(); return Math.hypot(t.x - x, t.z - z) < 0.45 && Math.abs(t.y - y) < 0.3; }).length; for (let k = have; k < n; k++) G.items.spawn(id, new THREE.Vector3(x + rand(-0.12, 0.12), y, z + rand(-0.05, 0.05)), null, { surface: true }); };
    add('lager', 5.6, 0.58, 0.1, 3); add('prosecco', 5.3, 0.13, 0.12); add('white_wine', 5.5, 0.13, 0.12, 1); add('juice', 5.35, 0.58, 0.15, 1);
    add('wine_full', 3.3, 1.035, -0.05, 3); add('pint_full', 3.9, 1.035, -0.05, 3);
    add('bitter', -4.75, 1.03, 0.12, 2); add('lager', -4.78, 0.13, 0.1, 2);
  }
  newOrder() {
    const cands = G.chars.filter(c => !c.isPlayer && !c.protected && !c.isDown() && DRINK_ORDERS[c.name] && !this.orders.some(o => o.p === c) && c.brain); if (!cands.length) return;
    const p = pick(cands); const d = DRINK[DRINK_ORDERS[p.name]] || DRINK.lager; const patience = Math.max(22, 55 - this.t * 0.18);
    const o = { p, d, start: G.time, until: G.time + patience, patience }; this.orders.push(o);
    p.say(pick([`${G.me?.name || 'Tommy'}! ${d.label}, please!`, `Get us a ${d.label}, would you?`, `I'm parched. ${d.label}?`, `Any chance of a ${d.label}?`]), { prio: 1, order: true }); p.gesture = 'wave'; setTimeout(() => p.gesture === 'wave' && (p.gesture = null), 2500);
    o.marker = this.marker(d.icon); o.marker.userData.order = o; sfx('ding', null, 0.5);
    G.popup?.card({ kicker: 'DRINK ORDER', title: `${p.name.toUpperCase()}: ${d.label.toUpperCase()}`, sub: `${d.icon} Where: <b>${d.where}</b><br>Where they are: ${roomName(p)}`, secs: 2.8, c1: '#8a5a00', c2: '#3a2400' });
  }
  // the bubble over someone waiting for a drink: their drink, three "waiting" dots and a ring that goes amber then red
  marker(icon) { const tx = canvasTex(160, 180); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true })); s.scale.set(0.42, 0.47, 1); s.renderOrder = 45; s.userData = { tx, icon }; this.drawMarker(s, 0); G.scene.add(s); return s; }
  drawMarker(s, anger) { const { tx, icon } = s.userData; const g = tx.userData.ctx; g.clearRect(0, 0, 160, 180);
    const col = anger > 0.66 ? '#ff4d4d' : anger > 0.33 ? '#ffb020' : '#3bd16f';
    g.fillStyle = 'rgba(255,255,255,0.96)'; g.beginPath(); g.arc(80, 72, 62, 0, 7); g.fill(); g.beginPath(); g.moveTo(62, 128); g.lineTo(98, 128); g.lineTo(80, 168); g.fill();
    g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.arc(80, 72, 62, 0, 7); g.stroke(); g.strokeStyle = col; g.beginPath(); g.arc(80, 72, 62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - anger)); g.stroke();
    g.font = '62px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(icon, 80, 62);
    const k = Math.floor(G.time * 3) % 4; g.fillStyle = '#555'; for (let d = 0; d < 3; d++) { g.globalAlpha = d < k ? 1 : 0.25; g.beginPath(); g.arc(60 + d * 20, 110, 6, 0, 7); g.fill(); } g.globalAlpha = 1; tx.needsUpdate = true; }
  tickBeer(dt) {
    this.orderT -= dt; const maxOrders = Math.min(6, 1 + Math.floor(this.t / 28));
    if (this.orderT <= 0 && this.orders.length < maxOrders) { this.orderT = Math.max(4, rand(12, 18) - this.t * 0.06); this.newOrder(); }
    // walking up to someone with the right drink in your hand hands it over
    const held = G.player.heldItem('D') || G.player.heldItem('R') || G.player.heldItem('L'); const me = G.player.headPos(new THREE.Vector3());
    for (const o of this.orders.slice()) {
      const hp = o.p.headPos(new THREE.Vector3()); o.marker.position.copy(hp).add(new THREE.Vector3(0, 0.42 + Math.sin(G.time * 4) * 0.04, 0)); const anger = clamp((G.time - o.start) / o.patience, 0, 1); o.anger = anger; if (G.frame % 8 === 0) this.drawMarker(o.marker, anger);
      if (anger > 0.6 && !o.moaned) { o.moaned = true; o.p.say(pick(['Still waiting!', 'Hello?! Drink!', 'Is it being brewed?']), { prio: 1, order: true }); o.p.setMood('angry', 4); }
      if (held && o.d.ids.includes(held.id) && hp.distanceTo(me) < 1.6) { this.serve(o, held); continue; }
      if (G.time > o.until) { this.drop(o); this.missed++; this.score = Math.max(0, this.score - 40); this.lines.unshift(`-40  ${o.p.name} gave up`); o.p.say(pick(['Forget it, I\'ll get it myself.', 'Unbelievable.', 'I\'ll die of thirst.']), { prio: 1, order: true }); o.p.setMood('angry', 6); G.ui?.toast(`${o.p.name} gave up waiting!`, 2.5, { game: true }); }
    }
    if (G.frame % 600 === 0) this.restock();
  }
  serve(o, item) { G.player.releaseAll(); G.items.remove(item); this.drop(o); this.served++; const fast = Math.max(0, o.until - G.time); const pts = 100 + Math.round(fast * 4); this.add(pts, `${o.p.name} got their ${o.d.label}`); sfx('ding', null, 0.9);
    o.p.say(pick(['Lovely, ta!', 'You\'re a star.', 'About time!', 'Cheers!']), { prio: 1, order: true }); o.p.gesture = 'sip'; setTimeout(() => o.p.gesture === 'sip' && (o.p.gesture = null), 3000); G.ui?.toast(`+${pts} — ${o.p.name} is happy`, 2, { game: true }); }
  drop(o) { this.orders.splice(this.orders.indexOf(o), 1); G.scene.remove(o.marker); }
  // ---------------- loop + HUD ----------------
  update(dt) {
    if (!this.running) return; this.t += dt;
    if (this.id === 'beer') this.tickBeer(dt);
    if (this.id === 'fling') this.tickFling(dt);
    if (this.id === 'roam') this.tickHavoc(dt);
    if (this.limit) { const left = Math.max(0, this.limit - this.t), L = Math.ceil(left); timer(`${Math.floor(L / 60)}:${String(L % 60).padStart(2, '0')}`, this.def.name.toUpperCase(), left < 15); if (left <= 0) return this.end(); }
    if (G.frame % 10 === 0) { this.drawHud(); this.drawTV(); }
  }
  extra() {
    if (this.id === 'roam' && this.hv) { const h = this.hv; return `<div class="hvbar"><i style="width:${Math.round(h.meter)}%"></i></div>${h.combo > 1 ? `<div class="hvcombo">x${h.combo} COMBO!</div>` : ''}<div>${h.hits} flattened · ${h.things} things flying</div>`; }
    if (this.id === 'fling' && this.maxThrows) return `Throw ${Math.min(this.throws + 1, this.maxThrows)}/${this.maxThrows}${this.dists?.length ? ` · best ${Math.max(...this.dists.map(x => x.d)).toFixed(1)} m` : ''}`;
    if (this.id === 'beer' && this.orders) return this.orders.length ? this.orders.map(o => `<div class="ord"><b>${o.d.icon} ${o.p.name}</b> · ${o.d.label}<div class="ang"><i style="width:${Math.round((o.anger || 0) * 100)}%;background:${(o.anger || 0) > 0.66 ? '#ff4d4d' : (o.anger || 0) > 0.33 ? '#ffb020' : '#3bd16f'}"></i></div><small>${o.d.where}</small></div>`).join('') : 'Waiting for orders…';
    return '';
  }
  drawHud() { if (!this.hud) return; this.hud.style.display = G.xr ? 'none' : 'block'; const b = this.best();
    // the same lines for the headset panel (vrhud.js)
    const strip = (h) => String(h || '').replace(/<(br|\/div|\/p|\/tr)[^>]*>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').split('\n').map(s => s.trim()).filter(Boolean);
    this.vrLines = [`${this.def.icon} ${this.def.name}`, `${this.score}`, ...(this.id === 'roam' && this.hv ? [`${'█'.repeat(Math.round(this.hv.meter / 10))}${'░'.repeat(10 - Math.round(this.hv.meter / 10))}`] : []), ...strip(this.extra()), ...(b != null ? [`Best: ${b}`] : [])];
    this.hud.innerHTML = `<div class="mh-name">${this.def.icon} ${this.def.name}</div><div class="mh-row"><b>${this.score}</b></div><div class="mh-extra">${this.extra()}</div>${b != null ? `<div class="mh-best">Best ${b}</div>` : ''}`; }
  hudOff() { if (this.hud) this.hud.style.display = 'none'; this.vrLines = null; }
  drawTV() { G.screens?.setTV((g, W, H) => { tvFrame(g, W, H, (this.def.name).toUpperCase(), '#1d3557'); g.fillStyle = '#ffd700'; g.font = 'bold 120px sans-serif'; g.fillText(String(this.score), 60, 230); g.fillStyle = '#9fe0ff'; g.font = '22px sans-serif'; this.lines.slice(0, 5).forEach((l, i) => g.fillText(l, 60, 320 + i * 32)); }); }
  end() {
    if (!this.running) return; this.running = false; this.hudOff(); timer(null); const prev = this.best(); const isBest = prev == null || this.score > prev; if (isBest) saveStore('best.' + this.id, this.score);
    for (const o of this.orders || []) G.scene.remove(o.marker); this.orders = [];
    sfx(isBest ? 'cheer' : 'drum', null, 1); G.player.releaseAll();
    const lines = { fling: `Longest throw: ${Math.max(0, ...(this.dists || []).map(x => x.d)).toFixed(1)} m.`, beer: `${this.served} drinks served, ${this.missed} people gave up waiting.`, games: 'Dining room survived. Mostly.' }[this.id] || '';
    const toRoam = () => { document.body.classList.remove('mode-' + this.id); this.id = 'sandbox'; this.def = modeById('sandbox'); for (const p of G.chars) if (p.brain && p.brain.state === 'scripted') { p.brain.state = 'idle'; G.ai?.goHome(p.brain); } };
    // in the headset there's nothing to click: show the result on the floating panel and carry on in free roam
    if (G.xr) { card({ kicker: `${this.def.name.toUpperCase()} · FINISHED`, title: String(this.score), icon: this.def.icon, sub: `${isBest ? 'New personal best!' : `Your best: ${prev}`} ${lines} Free roam is on now.`, secs: 8 }); toRoam(); return; }
    G.ui?.modal('scoreModal', `<h2>${this.def.icon} ${this.def.name}</h2><div style="font:900 64px Georgia,serif;color:#ffd700;text-align:center">${this.score}</div><p style="text-align:center">${isBest ? '🎉 New personal best!' : `Your best: ${prev}`}<br>${lines}</p>
      <div style="text-align:center"><button class="btn" id="mAgain">Play again</button><button class="btn alt" id="mModes">Main menu</button><button class="btn alt" id="mRoam">Free roam the house</button></div>`, (el) => {
      el.querySelector('#mAgain').onclick = () => { location.href = `?mode=${this.id}&as=${G.me?.name || 'Tommy'}&skip=1`; }; el.querySelector('#mModes').onclick = () => { location.href = '?'; };
      el.querySelector('#mRoam').onclick = () => { G.ui.closeModal('scoreModal'); document.body.classList.remove('mode-' + this.id); this.id = 'sandbox'; this.def = modeById('sandbox'); for (const p of G.chars) if (p.brain && p.brain.state === 'scripted') { p.brain.state = 'idle'; G.ai?.goHome(p.brain); } }; });
    emit('modeEnd', this.id, this.score);
  }
}
function roomName(p) { const r = G.house?.roomAt?.(p.pos.x, p.pos.z) || ''; return { living: 'living room', kitchen: 'kitchen', dining: 'dining room', conservatory: 'conservatory', hall: 'hallway', garden: 'garden', garage: 'garage', toilet: 'bathroom', bay: 'living room' }[r] || 'somewhere'; }
export function buildModePicker() {}
