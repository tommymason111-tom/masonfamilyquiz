// Games-room mini-games between rounds: Sprout Pong, Cracker Pull Duel, Pass the Parcel, Stack the
// Celebrations, Gift Grab. Martin blows the whistle and everyone piles into the dining room.
import * as THREE from 'three';
import { G, on, emit, rand, pick, clamp, shuffle } from '../core.js';
import { sfx, playMusic, stopMusic } from '../engine/audio.js';
import { tvFrame, wrapText } from './screens.js';

const GAMES = ['sproutPong', 'crackerDuel', 'parcel', 'stack', 'giftGrab'];
const NAMES = { sproutPong: 'SPROUT PONG', crackerDuel: 'CRACKER PULL DUEL', parcel: 'PASS THE PARCEL', stack: 'STACK THE CELEBRATIONS', giftGrab: 'GIFT GRAB' };
const HELP = {
  sproutPong: 'Throw sprouts into the red cups on the dining table. 45 seconds. Every cup = a point (well, half a point).',
  crackerDuel: 'Grab the other end of the cracker your relative is holding and PULL (or press USE to yank). Best of three.',
  parcel: 'Grab the parcel. When the music STOPS, tear a layer (USE / pinch). Tear while the music is playing and you get a penalty.',
  stack: 'Build the tallest tower of chocolates on the dining table. 30 seconds. Mason is watching.',
  giftGrab: 'Throw the presents into Team Paul\'s corner (the gold square in the games room). 40 seconds.',
};
export class MiniGames {
  constructor() { G.minigames = this; this.active = null; on('next', () => { if (this.active) this.finish(true); }); G.updaters.push((dt) => this.update(dt)); }
  start(roundIdx, done) {
    const id = GAMES[roundIdx % GAMES.length]; this.done = done;
    const q = G.quiz; sfx('whistle', G.charByName.Martin?.headPos(new THREE.Vector3()), 1);
    q.mSay(`Mini-game! Everyone into the games room. It's ${NAMES[id].toLowerCase()}!`, 2);
    // a rep from each team wanders in
    for (const [n, s] of [['Charli', [4.6, -2.4]], ['Hollie', [4.6, -4.2]], ['Kirsty', [5.1, -5.0]], ['Martin', [4.2, -3.3]]]) G.ai?.sendTo(n, new THREE.Vector3(s[0], 0, s[1]), () => { const p = G.charByName[n]; if (p) { p.base = 'stand'; p.brain.state = 'scripted'; p.brain.timer = 60; } });
    this.active = { id, t: -6, score: 0, state: {}, before: new Set(G.items.instances) };
    G.screens.setTV((g, W, H) => { tvFrame(g, W, H, 'MINI-GAME: ' + NAMES[id], '#2d6a4f'); g.fillStyle = '#fff'; g.font = '30px sans-serif'; wrapText(g, HELP[id], 60, 160, 900, 42); g.fillStyle = '#ffd700'; g.font = 'bold 32px sans-serif'; const a = this.active; if (a) g.fillText(a.t < 0 ? `Starting in ${Math.ceil(-a.t)}… (head to the games room!)` : `Score: ${a.score}   Time: ${Math.max(0, Math.ceil(a.limit - a.t))}s`, 60, 420); g.font = '22px sans-serif'; g.fillStyle = '#9ab'; g.fillText('Press NEXT to skip', 60, 520); });
    G.ui?.toast(`MINI-GAME: ${NAMES[id]}. ${HELP[id]}`, 7);
    this['setup_' + id]?.(this.active);
  }
  update(dt) {
    const a = this.active; if (!a) return; a.t += dt;
    if (a.t >= 0 && !a.begun) { a.begun = true; sfx('whistle', null, 0.8); this['begin_' + a.id]?.(a); }
    if (a.begun) this['tick_' + a.id]?.(a, dt);
    if (a.limit && a.t > a.limit) this.finish(false);
  }
  finish(skipped) {
    const a = this.active; if (!a) return; this.active = null; stopMusic();
    this['end_' + a.id]?.(a);
    // tidy away anything the mini-game added, so the house doesn't fill up
    setTimeout(() => { for (const it of G.items.instances.slice()) if (!a.before.has(it) && !it.held && ['sprout', 'celebration', 'present_s', 'present_m', 'paper_ball', 'cracker', 'paper_crown', 'satsuma'].includes(it.id)) G.items.remove(it); }, 6000);
    const q = G.quiz; const pts = skipped ? 0 : Math.min(3, Math.round(a.score * (a.id === 'sproutPong' ? 0.5 : 1)));
    const others = { martin: Math.floor(rand(0, 3)), debbie: Math.floor(rand(0, 3)) };
    q.bonus.paul += pts; q.bonus.martin += others.martin; q.bonus.debbie += others.debbie;
    G.ui?.toast(skipped ? 'Mini-game skipped.' : `${NAMES[a.id]} over! Team Paul +${pts}, Team Martin +${others.martin}, Team Debbie +${others.debbie}.`, 5);
    for (const n of ['Charli', 'Hollie', 'Kirsty', 'Martin']) G.ai?.release(n);
    setTimeout(() => this.done && this.done(), 3000);
  }
  // ---------- Sprout Pong ----------
  setup_sproutPong(a) {
    a.limit = 45; a.cups = (G.items.byType.pong_cup || []); a.counted = new Set();
    // reset cups into a triangle on the table, and lay out sprouts on the sideboard
    a.cups.forEach((c, i) => { const row = i < 3 ? 0 : i < 5 ? 1 : 2; const k = i < 3 ? i : i < 5 ? i - 3 : 0; c.body.setTranslation({ x: 6.2 + row * 0.1 + k * 0.11 - (row * 0.055), y: 0.84, z: -4.4 + row * 0.1 }, true); c.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); c.body.setLinvel({ x: 0, y: 0, z: 0 }, true); });
    for (let i = 0; i < 10; i++) G.items.spawn('sprout', new THREE.Vector3(3.85, 0.9, -3.0 - i * 0.07), null);
  }
  tick_sproutPong(a) {
    if (G.frame % 6) return;
    for (const s of G.items.byType.sprout || []) { if (a.counted.has(s)) continue; const p = s.body.translation(); for (const c of a.cups) { const q = c.body.translation(); if (Math.hypot(p.x - q.x, p.z - q.z) < 0.035 && p.y > q.y - 0.06 && p.y < q.y + 0.03) { a.counted.add(s); a.score++; sfx('ding', q, 0.6); G.ui?.toast(`Sprout in the cup! (${a.score})`, 1.5); if (Math.random() < 0.3) G.ai.say('Julie', 'I want those sprouts back!', 0); } } }
  }
  // ---------- Cracker Pull Duel ----------
  setup_crackerDuel(a) { a.limit = 50; a.round = 0; a.opps = shuffle(['Charli', 'Hollie', 'Kirsty', 'Martin']).slice(0, 3); }
  begin_crackerDuel(a) { this.nextDuel(a); }
  nextDuel(a) {
    if (a.round >= 3) { this.finish(false); return; }
    const opp = G.charByName[a.opps[a.round]]; a.opp = opp; a.pull = 0;
    if (!opp || opp.isDown()) { a.round++; return this.nextDuel(a); }
    opp.gesture = 'point';
    const c = G.items.spawn('cracker', opp.handPos('R', new THREE.Vector3()), null); a.cracker = c;
    c.body.setBodyType(G.R.RigidBodyType.KinematicPositionBased, true); c.attached = (out, q) => { opp.handPos('R', out); out.add(opp.facing(new THREE.Vector3()).multiplyScalar(0.12)); q.setFromEuler(new THREE.Euler(0, opp.yaw + Math.PI / 2, 0)); return out; };
    opp.say(pick(['Come on then!', 'Pull it, Tommy!', 'I always win these.']));
    G.ui?.toast(`Duel ${a.round + 1}: ${opp.name}. Grab the cracker and pull (or USE to yank)!`, 4);
    a.useHandler = () => { a.pull += 0.35; };
    on('useCracker', a.useHandler);
  }
  tick_crackerDuel(a, dt) {
    const c = a.cracker; if (!c || !c.alive) return;
    const held = Object.values(G.player.holders).find(h => h && h.ref === c);
    if (held) { c.attached = null; const hp = a.opp.handPos('R', new THREE.Vector3()); const t = c.body.translation(); const d = Math.hypot(t.x - hp.x, t.y - hp.y, t.z - hp.z); a.pull += dt * clamp((d - 0.15) * 4, 0, 3); if (!c.attached && d < 0.12) {} }
    if (G.player.controls.btn('use').pressed) a.pull += 0.3;
    if (a.pull > 1.2) {
      const win = Math.random() < 0.6; sfx('crack', c.body.translation(), 1); G.player.releaseAll(); G.items.remove(c); a.cracker = null;
      const crown = G.items.spawn('paper_crown', a.opp.headPos(new THREE.Vector3()), null); crown?.body.setLinvel({ x: rand(-1, 1), y: 2, z: rand(-1, 1) }, true);
      if (win) { a.score++; G.ui?.toast('You win the cracker! The hat and the joke are yours.', 3); a.opp.say('Rigged.'); } else { G.ui?.toast(`${a.opp.name} wins the cracker.`, 3); a.opp.gesture = 'cheer'; }
      if (a.opp.name === 'Martin' || Math.random() < 0.3) setTimeout(() => G.ai.say('Paul', 'What do you call a man with a seagull on his head? ...Douglas! No wait—', 1), 1500);
      setTimeout(() => { if (a.opp) a.opp.gesture = null; a.round++; this.nextDuel(a); }, 2500);
    }
  }
  end_crackerDuel(a) { if (a.cracker?.alive) G.items.remove(a.cracker); if (a.opp) a.opp.gesture = null; }
  // ---------- Pass the Parcel ----------
  setup_parcel(a) { a.limit = 60; a.layers = 6; a.parcel = G.items.byType.parcel?.[0]; if (a.parcel) a.parcel.body.setTranslation({ x: 4.6, y: 0.95, z: -3.3 }, true); }
  begin_parcel(a) { this.parcelMusic(a); a.useHandler = () => this.tear(a); on('parcelUse', a.useHandler); }
  parcelMusic(a) { a.playing = true; playMusic('wewish', true, 0.3); clearTimeout(a.stopT); a.stopT = setTimeout(() => { stopMusic(); a.playing = false; a.stopAt = G.time; const pl = Object.values(G.player.holders).some(h => h && h.ref === a.parcel); if (!pl) { G.ui?.toast('Music stops... and Martin "accidentally" stops it on Team Martin. They tear a layer.', 3); a.layers--; sfx('rip'); if (a.layers <= 0) return this.finish(false); setTimeout(() => this.parcelMusic(a), 3000); } else G.ui?.toast('Music stopped! You\'re holding it — TEAR A LAYER (USE / pinch)!', 3); }, rand(5000, 10000)); }
  tear(a) {
    if (!a.parcel) return; if (a.playing) { a.score = Math.max(0, a.score - 1); G.ui?.toast('You tore it while the music was playing! Penalty.', 2); G.ai.say('Martin', 'Penalty! The music\'s still going!', 1); return; }
    a.layers--; a.score++; sfx('rip', a.parcel.body.translation(), 1); const b = G.items.spawn('paper_ball', new THREE.Vector3().copy(a.parcel.body.translation()).add(new THREE.Vector3(0, 0.2, 0)), null); b?.body.setLinvel({ x: rand(-1, 1), y: 2, z: rand(-1, 1) }, true);
    if (a.layers <= 0) { G.ui?.toast('Final layer! Prize: a satsuma. Of course.', 4); G.items.spawn('satsuma', new THREE.Vector3().copy(a.parcel.body.translation()).add(new THREE.Vector3(0, 0.2, 0)), null); return this.finish(false); }
    G.ui?.toast(`Layer torn! (${a.layers} left)`, 2); setTimeout(() => this.parcelMusic(a), 2500);
  }
  end_parcel(a) { clearTimeout(a.stopT); }
  // ---------- Stack the Celebrations ----------
  setup_stack(a) { a.limit = 30; for (let i = 0; i < 14; i++) G.items.spawn('celebration', new THREE.Vector3(6.1 + (i % 4) * 0.06, 0.8, -2.8 - Math.floor(i / 4) * 0.05), null); }
  tick_stack(a) { if (G.frame % 10) return; let top = 0; for (const c of G.items.byType.celebration || []) { const p = c.body.translation(); if (p.x > 5.95 && p.x < 6.95 && p.z > -4.6 && p.z < -2.4 && !c.held) { const v = c.body.linvel(); if (Math.hypot(v.x, v.y, v.z) < 0.1) top = Math.max(top, p.y - 0.78); } } a.height = top; a.score = Math.floor(top / 0.02); }
  end_stack(a) { G.ui?.toast(`Tower height: ${Math.round((a.height || 0) * 100)} cm. Then Mason knocks it over and eats a Malteser.`, 4); G.ai.say('Mason', 'CRASH!', 1); for (const c of G.items.byType.celebration || []) { const p = c.body.translation(); if (p.x > 5.9) c.body.applyImpulse({ x: rand(-0.02, 0.02), y: 0.01, z: rand(-0.02, 0.02) }, true); } }
  // ---------- Gift Grab ----------
  setup_giftGrab(a) { a.limit = 40; for (let i = 0; i < 6; i++) G.items.spawn(pick(['present_s', 'present_m']), new THREE.Vector3(5.2 + rand(-0.4, 0.4), 0.3 + i * 0.2, -3.3 + rand(-0.4, 0.4)), null);
    const zone = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ color: '#ffd700', transparent: true, opacity: 0.35 })); zone.rotation.x = -Math.PI / 2; zone.position.set(4.05, 0.015, -6.5); G.scene.add(zone); a.zone = zone; }
  tick_giftGrab(a) { if (G.frame % 10) return; let n = 0; for (const id of ['present_s', 'present_m', 'present_l']) for (const p of G.items.byType[id] || []) { const t = p.body.translation(); if (Math.abs(t.x - 4.05) < 0.45 && Math.abs(t.z + 6.5) < 0.45) n++; } a.score = Math.min(3, Math.floor(n / 2)); a.count = n; }
  end_giftGrab(a) { G.scene.remove(a.zone); G.ui?.toast(`${a.count || 0} presents in Team Paul's corner.`, 3); }
  // hooks from interact.js
  unwrapParcel(inst) { if (this.active?.id === 'parcel') this.tear(this.active); else G.ui?.toast('Save it for Pass the Parcel!'); }
  clapStart() {}
}
