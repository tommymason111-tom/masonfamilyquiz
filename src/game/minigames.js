// The mini-games, in the dining room and the conservatory. Each one opens with a big title card ("GAME ONE —
// BRUSSELS SPROUT THROWING"), runs with a clear timer, then shows "GAME ONE FINISHED" and a leaderboard of you
// against the other teams. Used back-to-back by the Mini Games mode, and one at a time between quiz rounds.
import * as THREE from 'three';
import { G, on, emit, rand, pick, clamp, shuffle } from '../core.js';
import { sfx, playMusic, stopMusic } from '../engine/audio.js';
import { tvFrame, wrapText } from './screens.js';
import { TEAMS, TEAM_IDS } from '../chars/cast.js';
import { card, board, timer, tapButton, meters } from './popup.js';

const ORDINAL = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];
export const GAMES = [
  { id: 'sproutPong', icon: '🥬', title: 'BRUSSELS SPROUT THROWING', how: 'Throw the sprouts into the red cups at the far end of the table. Tap a sprout to pick it up, tap again (or THROW) to lob it. 45 seconds.', unit: ' cups', other: () => Math.floor(rand(0, 5)) },
  { id: 'crackerDuel', icon: '🎉', title: 'CRACKER PULL', how: 'Three relatives, one at a time. Hammer PULL faster than they do to win the cracker.', unit: ' wins', other: () => Math.floor(rand(0, 3.2)) },
  { id: 'parcel', icon: '🎁', title: 'PASS THE PARCEL', how: 'The parcel goes round while the music plays. When it stops on YOU, hit TEAR before the music starts again!', unit: ' layers', other: () => Math.floor(rand(0, 3)) },
  { id: 'stack', icon: '🍫', title: 'STACK THE CELEBRATIONS', how: 'Build the tallest tower of chocolates on the dining table. 30 seconds. Mason is watching.', unit: ' cm', other: () => Math.floor(rand(6, 26)) },
  { id: 'giftGrab', icon: '🎄', title: 'GIFT GRAB', how: 'In the conservatory: throw the presents into the gold square. 40 seconds.', unit: ' gifts', other: () => Math.floor(rand(0, 5)) },
];
const TABLE = { x: 4.99, z: -3.9, x0: 4.52, x1: 5.47, z0: -4.75, z1: -3.05, y: 0.77 };

export class MiniGames {
  constructor() { G.minigames = this; this.active = null; this.total = {}; G.updaters.push((dt) => this.update(dt)); on('next', () => { if (this.active && this.active.t > 1) this.active.skip = true; }); }
  // one game between quiz rounds (old API)
  finish() { const a = this.active; if (a && a.live) { a.skip = true; this.stop(a); } } // skip the current game
  start(roundIdx, done) { this.play(roundIdx % GAMES.length).then(() => done && done()); }
  me() { return G.myTeam || 'paul'; }
  reps(n = 4) { const mine = this.me(); const pool = G.chars.filter(c => !c.isPlayer && !c.protected && c.team !== 'host' && !c.isDown() && c.brain); const byTeam = {}; for (const c of shuffle(pool)) (byTeam[c.team] ||= []).push(c);
    const out = []; for (const t of TEAM_IDS) if (t !== mine && byTeam[t]?.length) out.push(byTeam[t].pop()); for (const c of shuffle(pool)) if (out.length < n && !out.includes(c)) out.push(c); return out.slice(0, n); }
  park(people, spots, faceTo) { people.forEach((p, i) => { const s = spots[i % spots.length]; G.ai?.sendTo(p.name, new THREE.Vector3(s[0], 0, s[1]), () => { p.base = 'stand'; p.brain.state = 'scripted'; p.brain.timer = 999; p.yaw = Math.atan2(faceTo[0] - s[0], faceTo[1] - s[1]); }, 1.6); }); this.parked = people; }
  release() { for (const p of this.parked || []) { if (p.brain) { p.brain.state = 'idle'; G.ai?.goHome(p.brain); } } this.parked = []; }
  clearArea(x0, x1, z0, z1, keep = []) { for (const it of G.items.instances.slice()) { if (it.type.fixed || it.held || keep.includes(it.id)) continue; const t = it.body.translation(); if (t.x > x0 && t.x < x1 && t.z > z0 && t.z < z1) G.items.remove(it); } }

  async play(i) {
    const def = GAMES[i]; const q = G.quiz; G.player.releaseAll(); G.modes?.hudOff?.();
    sfx('whistle', null, 0.8); q?.mSay?.(`Game ${i + 1}: ${def.title.toLowerCase()}!`, 2);
    const a = { id: def.id, def, i, t: 0, score: 0, limit: 0, live: false };
    this['setup_' + def.id](a);
    G.screens?.setTV((g, W, H) => { tvFrame(g, W, H, `GAME ${ORDINAL[i]}: ${def.title}`, '#2d6a4f'); g.fillStyle = '#fff'; g.font = '30px sans-serif'; wrapText(g, def.how, 60, 170, 900, 42); });
    await card({ kicker: `GAME ${ORDINAL[i]}`, title: def.title, sub: def.how, icon: def.icon, secs: 4 });
    await card({ kicker: 'GET READY', title: '3 · 2 · 1 · GO!', secs: 1.6, c1: '#2d8a4f', c2: '#0e3a20' });
    sfx('whistle', null, 1); a.live = true; this.active = a; this['begin_' + def.id]?.(a);
    await new Promise(res => { a.done = res; });
    this.active = null; timer(null); meters(null); stopMusic(); this['end_' + def.id]?.(a);
    // leaderboard: you vs the other teams (theirs are made up, obviously)
    const mine = this.me(); const rows = TEAM_IDS.map(t => ({ team: t, name: TEAMS[t].name, color: TEAMS[t].color, me: t === mine, score: t === mine ? a.score : def.other() }));
    const order = rows.slice().sort((x, y) => y.score - x.score); order.forEach((r, k) => { const pts = [3, 2, 1, 0][k]; this.total[r.team] = (this.total[r.team] || 0) + pts; if (q) q.bonus[r.team] += pts; });
    sfx(order[0].me ? 'cheer' : 'drum', null, 0.9);
    await board({ kicker: `GAME ${ORDINAL[i]} FINISHED`, title: def.title, rows, unit: def.unit, footer: order[0].me ? 'You won this one! +3 points' : `${order[0].name} win this one.`, secs: 5.5 });
    this.release(); this.tidy(a);
    return a.score;
  }
  overall() { const mine = this.me(); return TEAM_IDS.map(t => ({ name: TEAMS[t].name, color: TEAMS[t].color, me: t === mine, score: this.total[t] || 0 })); }
  tidy(a) { setTimeout(() => { for (const it of G.items.instances.slice()) if (!it.held && ['sprout', 'celebration', 'present_s', 'present_m', 'paper_ball', 'cracker', 'paper_crown', 'satsuma'].includes(it.id) && it.mg) G.items.remove(it); }, 1500); }
  spawn(id, pos, opts) { const it = G.items.spawn(id, pos, null, opts); if (it) it.mg = true; return it; }
  limitTick(a, dt) { if (!a.limit) return; const left = Math.max(0, a.limit - a.t); timer(`${Math.ceil(left)}s`, `SCORE ${a.score}`, left < 6); if (left <= 0 || a.skip) this.stop(a); }
  stop(a) { if (a.stopped) return; a.stopped = true; a.live = false; sfx('whistle', null, 1); a.done?.(); }
  update(dt) { const a = this.active; if (!a || !a.live) return; a.t += dt; this['tick_' + a.id]?.(a, dt); this.limitTick(a, dt); }

  // ---------- 1. Brussels sprout throwing ----------
  setup_sproutPong(a) {
    a.limit = 45; a.counted = new Set();
    this.clearArea(TABLE.x0 - 0.1, TABLE.x1 + 0.1, TABLE.z0 - 0.1, TABLE.z1 + 0.1, ['pong_cup']);
    // six cups in a triangle at the far end, nothing else on the table but the sprouts
    const cups = G.items.byType.pong_cup || []; a.cups = cups;
    const pts = [[0, 0], [-0.1, 0], [0.1, 0], [-0.05, 0.09], [0.05, 0.09], [0, 0.18]];
    cups.forEach((c, k) => { const [dx, dz] = pts[k % pts.length]; c.body.setBodyType(G.R.RigidBodyType.Dynamic, true); c.body.setTranslation({ x: TABLE.x + dx, y: TABLE.y + 0.065, z: TABLE.z0 + 0.2 + dz }, true); c.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); c.body.setLinvel({ x: 0, y: 0, z: 0 }, true); c.body.setAngvel({ x: 0, y: 0, z: 0 }, true); c.dirty = true; });
    for (let k = 0; k < 14; k++) this.spawn('sprout', new THREE.Vector3(TABLE.x - 0.25 + (k % 7) * 0.08, TABLE.y + 0.03, TABLE.z1 - 0.12 - Math.floor(k / 7) * 0.08));
    G.player.teleport(TABLE.x, TABLE.z1 + 0.65, 0); G.player.pitch = -0.35;
    this.park(this.reps(3), [[3.95, -3.3], [3.95, -4.3], [3.3, -2.6]], [TABLE.x, TABLE.z]);
  }
  tick_sproutPong(a) {
    if (G.frame % 5) return;
    for (const s of G.items.byType.sprout || []) { if (a.counted.has(s)) continue; const p = s.body.translation(); for (const c of a.cups) { const q = c.body.translation(); if (Math.hypot(p.x - q.x, p.z - q.z) < 0.04 && p.y > q.y - 0.07 && p.y < q.y + 0.04) { a.counted.add(s); a.score++; sfx('ding', q, 0.7); G.ui?.toast(`IN THE CUP! (${a.score})`, 1.2); if (Math.random() < 0.4) G.ai.say(pick(['Paul', 'James', 'Dan', 'Charli']), pick(['Get in!', 'Fluke.', 'Sprout-tacular.']), 0); break; } } }
    // sprouts run out? put a few more out
    if ((G.items.byType.sprout || []).length < 60 && (G.items.byType.sprout || []).filter(s => !a.counted.has(s) && s.body.translation().y > 0.5).length < 3) for (let k = 0; k < 6; k++) this.spawn('sprout', new THREE.Vector3(TABLE.x - 0.2 + k * 0.08, TABLE.y + 0.03, TABLE.z1 - 0.12));
  }

  // ---------- 2. Cracker pull ----------
  setup_crackerDuel(a) {
    a.round = 0; a.opps = this.reps(3); a.wins = 0;
    G.player.teleport(2.4, -3.2, -Math.PI / 2); G.player.pitch = -0.08;
    // the ones waiting stand back in a queue
    this.park(a.opps, [[3.9, -4.6], [3.6, -5.0], [3.3, -5.3]], [2.4, -3.2]);
  }
  begin_crackerDuel(a) { this.nextDuel(a); }
  nextDuel(a) {
    if (a.round >= a.opps.length) return this.stop(a);
    const opp = a.opps[a.round]; a.opp = opp; a.me = 0; a.them = 0; a.duelOn = false;
    G.ai?.sendTo(opp.name, new THREE.Vector3(3.3, 0, -3.2), () => { opp.base = 'stand'; opp.yaw = -Math.PI / 2; opp.gesture = 'point';
      const c = this.spawn('cracker', opp.handPos('R', new THREE.Vector3())); a.cracker = c;
      if (c) { c.body.setBodyType(G.R.RigidBodyType.KinematicPositionBased, true); c.attached = (out, q) => { const hp = opp.handPos('R', new THREE.Vector3()); const pp = G.player.headPos(new THREE.Vector3()).add(G.player.forward(new THREE.Vector3()).multiplyScalar(0.45)); pp.y -= 0.35; out.copy(hp).lerp(pp, 0.5); q.setFromEuler(new THREE.Euler(0, Math.atan2(pp.x - hp.x, pp.z - hp.z) + Math.PI / 2, 0)); return out; }; }
      opp.say(pick(['Come on then!', 'Pull it!', 'I always win these.', 'Ready?']), { prio: 1 });
      card({ kicker: `DUEL ${a.round + 1} OF 3`, title: `VS ${opp.name.toUpperCase()}`, sub: 'Hammer PULL!', secs: 1.8, c1: '#7b2cbf', c2: '#2a0b44' }).then(() => { a.duelOn = true; a.rate = rand(0.28, 0.42); a.removeBtn = tapButton('PULL!', () => { if (a.duelOn) { a.me += 0.075; G.player.fp.punch?.('R'); sfx('tap', null, 0.25); } }); });
    }, 1.8);
  }
  tick_crackerDuel(a, dt) {
    if (!a.duelOn) { meters(null); return; }
    if (G.player.controls.btn('use').pressed || G.player.controls.btn('punch').pressed || G.player.controls.btn('jump').pressed) a.me += 0.075;
    a.them += a.rate * dt * (0.7 + Math.random() * 0.6);
    meters([{ label: 'You', value: a.me, color: TEAMS[this.me()].color }, { label: a.opp.name, value: a.them, color: '#ffffff' }]);
    if (a.me >= 1 || a.them >= 1) {
      const win = a.me >= 1; a.duelOn = false; a.removeBtn?.(); meters(null);
      sfx('crack', a.cracker?.body.translation(), 1); if (a.cracker?.alive) G.items.remove(a.cracker); a.cracker = null;
      const crown = this.spawn('paper_crown', (win ? G.player.headPos(new THREE.Vector3()) : a.opp.headPos(new THREE.Vector3())).add(new THREE.Vector3(0, 0.1, 0))); crown?.body.setLinvel({ x: rand(-0.5, 0.5), y: 1.5, z: rand(-0.5, 0.5) }, true);
      if (win) { a.score++; a.opp.say(pick(['Rigged.', 'My hand slipped!', 'Best of five?']), { prio: 1 }); a.opp.setMood('angry', 2); } else { a.opp.gesture = 'cheer'; a.opp.say(pick(['YES!', 'Get in!', 'Too easy.']), { prio: 1 }); }
      card({ kicker: 'BANG!', title: win ? 'YOU WIN!' : `${a.opp.name.toUpperCase()} WINS`, sub: win ? 'The hat and the terrible joke are yours.' : 'The hat goes to them. The joke is still terrible.', secs: 2, c1: win ? '#2d8a4f' : '#7a1f24', c2: win ? '#0e3a20' : '#2a0a10' }).then(() => {
        const o = a.opp; o.gesture = null; G.ai?.sendTo(o.name, new THREE.Vector3(1.9, 0, -5.2 + a.round * 0.5), () => { o.base = 'stand'; o.brain.state = 'scripted'; o.brain.timer = 999; }); a.round++; this.nextDuel(a); });
    }
  }
  end_crackerDuel(a) { a.removeBtn?.(); if (a.cracker?.alive) G.items.remove(a.cracker); }

  // ---------- 3. Pass the parcel ----------
  setup_parcel(a) {
    a.layers = 6; const c = { x: 2.9, z: -3.7 }, r = 1.0; a.circle = c;
    this.clearArea(1.6, 4.2, -5.1, -2.3);
    for (const id of ['highchair', 'bouncer']) for (const it of G.items.byType[id] || []) G.items.remove(it);
    a.people = this.reps(4); const slots = [];
    for (let k = 0; k < 5; k++) { const ang = k / 5 * Math.PI * 2; slots.push([c.x + Math.sin(ang) * r, c.z + Math.cos(ang) * r]); }
    G.player.teleport(slots[0][0], slots[0][1], 0); G.player.pitch = -0.15;
    this.park(a.people, slots.slice(1), [c.x, c.z]); a.slots = slots; a.holder = 0;
    const pc = this.spawn('parcel', new THREE.Vector3(c.x, 1.0, c.z)); a.parcel = pc;
    if (pc) { pc.body.setBodyType(G.R.RigidBodyType.KinematicPositionBased, true); pc.attached = (out, q) => { const h = a.holder; const lift = a.tearing ? 0.15 * Math.sin(G.time * 30) : 0; if (h === 0) { G.player.headPos(out).add(G.player.forward(new THREE.Vector3()).setY(0).normalize().multiplyScalar(0.45)); out.y -= 0.45; } else { const p = a.people[h - 1]; if (p) { p.handPos('R', out); out.add(new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)).multiplyScalar(0.12)); } } out.y += lift; q.setFromEuler(new THREE.Euler(0, G.time, 0)); return out; }; }
  }
  begin_parcel(a) { this.parcelMusic(a); }
  parcelMusic(a) { if (!a.live) return; a.playing = true; a.tearing = false; playMusic('wewish', true, 0.35); a.passT = 0; a.stopAt = a.t + rand(2.8, 6.5); timer('♪ MUSIC ♪', `PASS THE PARCEL · ${a.layers} LAYERS LEFT`); }
  tick_parcel(a, dt) {
    if (a.playing) { a.passT += dt; if (a.passT > 0.55) { a.passT = 0; a.holder = (a.holder + 1) % 5; sfx('tap', null, 0.2); }
      if (a.t > a.stopAt) { a.playing = false; stopMusic(); sfx('click', null, 1);
        if (a.holder === 0) { timer('IT\'S YOU!', 'TEAR IT!', true); a.tearing = true; const until = a.t + 2.2; a.tearUntil = until; a.removeBtn = tapButton('TEAR!', () => { if (!a.tearing) return; a.tearing = false; a.removeBtn?.(); this.tore(a, true); }); }
        else { const p = a.people[a.holder - 1]; timer(`${p.name}!`, 'MUSIC STOPPED'); setTimeout(() => this.tore(a, false, p), 1100); } } }
    if (a.tearing && a.t > a.tearUntil) { a.tearing = false; a.removeBtn?.(); G.ui?.toast('Too slow! It goes round again.', 2); G.ai.say('Paul', 'Tear it, then!', 1); setTimeout(() => this.parcelMusic(a), 1200); }
    if (a.playing && (G.player.controls.btn('use').pressed)) { a.score = Math.max(0, a.score - 1); G.ui?.toast('You tore it while the music was playing! -1', 2); }
  }
  tore(a, mine, p) {
    if (!a.live) return; a.layers--; sfx('rip', a.parcel?.body.translation(), 1);
    const b = this.spawn('paper_ball', new THREE.Vector3().copy(a.parcel.body.translation()).add(new THREE.Vector3(0, 0.25, 0))); b?.body.setLinvel({ x: rand(-1, 1), y: 2, z: rand(-1, 1) }, true);
    if (mine) { a.score++; G.ui?.toast(`You tear a layer! (${a.score})`, 1.5); } else { p?.say(pick(['Mine!', 'Ooh!', 'Is it a satsuma?']), { prio: 0 }); }
    if (a.layers <= 0) { const prize = this.spawn('satsuma', new THREE.Vector3().copy(a.parcel.body.translation()).add(new THREE.Vector3(0, 0.3, 0))); prize?.body.setLinvel({ x: 0, y: 1.5, z: 0 }, true);
      if (mine) a.score += 2; card({ kicker: 'THE PRIZE IS…', title: 'A SATSUMA', sub: mine ? 'All yours. +2' : `${p?.name || 'They'} got it.`, secs: 2.2 }).then(() => this.stop(a)); return; }
    setTimeout(() => this.parcelMusic(a), 1300);
  }
  end_parcel(a) { a.removeBtn?.(); if (a.parcel?.alive) G.items.remove(a.parcel); stopMusic(); }

  // ---------- 4. Stack the Celebrations ----------
  setup_stack(a) { a.limit = 30; this.clearArea(TABLE.x0 - 0.1, TABLE.x1 + 0.1, TABLE.z0 - 0.1, TABLE.z1 + 0.1);
    for (const c of G.items.byType.pong_cup || []) c.body.setTranslation({ x: 1.25, y: 0.95, z: -3.6 - Math.random() * 0.4 }, true);
    for (let k = 0; k < 18; k++) this.spawn('celebration', new THREE.Vector3(TABLE.x - 0.2 + (k % 6) * 0.07, TABLE.y + 0.02, TABLE.z1 - 0.15 - Math.floor(k / 6) * 0.06));
    G.player.teleport(TABLE.x - 0.85, TABLE.z, -Math.PI / 2); G.player.pitch = -0.45;
    this.park(this.reps(3), [[3.6, -2.7], [3.6, -5.0], [3.2, -3.9]], [TABLE.x, TABLE.z]); }
  tick_stack(a) { if (G.frame % 10) return; let top = 0; for (const c of G.items.byType.celebration || []) { const p = c.body.translation(); if (p.x > TABLE.x0 && p.x < TABLE.x1 && p.z > TABLE.z0 && p.z < TABLE.z1 && !c.held) { const v = c.body.linvel(); if (Math.hypot(v.x, v.y, v.z) < 0.1) top = Math.max(top, p.y - TABLE.y); } } a.score = Math.round(top * 100); }
  end_stack(a) { G.ai.say('Mason', 'CRASH!', 1); for (const c of G.items.byType.celebration || []) c.body.applyImpulse({ x: rand(-0.01, 0.01), y: 0.006, z: rand(-0.01, 0.01) }, true); }

  // ---------- 5. Gift grab (conservatory) ----------
  setup_giftGrab(a) { a.limit = 40; a.zone = { x: 4.35, z: -6.85 };
    for (const id of ['wicker_chair']) for (const it of G.items.byType[id] || []) G.items.remove(it);
    for (let k = 0; k < 8; k++) this.spawn(pick(['present_s', 'present_m']), new THREE.Vector3(1.6 + (k % 4) * 0.3, 0.3, -7.6 - Math.floor(k / 4) * 0.3));
    const zone = new THREE.Mesh(new THREE.RingGeometry(0.0, 0.5, 4, 1), new THREE.MeshBasicMaterial({ color: '#ffd700', transparent: true, opacity: 0.45 })); zone.rotation.set(-Math.PI / 2, 0, Math.PI / 4); zone.position.set(a.zone.x, 0.02, a.zone.z); G.scene.add(zone); a.zoneMesh = zone;
    G.player.teleport(2.0, -7.0, -Math.PI / 2); G.player.pitch = -0.3;
    this.park(this.reps(2), [[3.1, -6.6], [2.4, -6.5]], [a.zone.x, a.zone.z]); }
  tick_giftGrab(a) { if (G.frame % 10) return; let n = 0; for (const id of ['present_s', 'present_m', 'present_l']) for (const p of G.items.byType[id] || []) { const t = p.body.translation(); if (Math.abs(t.x - a.zone.x) < 0.5 && Math.abs(t.z - a.zone.z) < 0.5) n++; } if (n > a.score) { sfx('ding', null, 0.6); G.ui?.toast(`In the square! (${n})`, 1.2); } a.score = n; a.zoneMesh.material.opacity = 0.35 + Math.sin(G.time * 5) * 0.15; }
  end_giftGrab(a) { G.scene.remove(a.zoneMesh); }

  // hooks from interact.js
  unwrapParcel() { G.ui?.toast('Save it for Pass the Parcel!'); }
  clapStart() {}
}
