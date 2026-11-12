// The mini-games, in the dining room and the conservatory. Each one opens with a big title card ("GAME ONE —
// BRUSSELS SPROUT THROWING"), runs with a clear timer, then shows "GAME ONE FINISHED" and a leaderboard of you
// against the other teams. Used back-to-back by the Mini Games mode, and one at a time between quiz rounds.
import * as THREE from 'three';
import { G, on, emit, rand, pick, clamp, shuffle } from '../core.js';
import { sfx, playMusic, stopMusic } from '../engine/audio.js';
import { tvFrame, wrapText } from './screens.js';
import { TEAMS, TEAM_IDS } from '../chars/cast.js';
import { card, board, timer, tapButton, meters } from './popup.js';
import { Prop } from '../engine/geo.js';
import { staticBox, staticCyl } from '../engine/physics.js';

const ORDINAL = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];
export const GAMES = [
  { id: 'sproutPong', icon: '🥬', title: 'BRUSSELS SPROUT THROWING', how: 'Throw the sprouts into the red and white cups at the far end of the table. Tap a sprout to pick it up, tap again (or THROW) to lob it. 45 seconds.', unit: ' cups', other: () => Math.floor(rand(0, 5)) },
  { id: 'crackerDuel', icon: '🎉', title: 'CRACKER PULL', how: 'Three relatives, one at a time, right in front of you. Hammer PULL faster than they do to win the cracker.', unit: ' wins', other: () => Math.floor(rand(0, 3.2)) },
  { id: 'sumo', icon: '🤼', title: 'BOXING DAY SUMO', how: () => G.xr ? 'In the ring in the garden. Shove and punch your opponent to fill their wobble meter (it drops if you stop). When it\'s full, GRAB them and THROW them out of the ring! 3 opponents, 25 seconds each.' : 'In the ring in the garden. Keep hitting your opponent: every hit fills their wobble meter, and it drops if you stop. Fill it and they fly out of the ring! 3 opponents, 25 seconds each.', unit: ' wins', other: () => Math.floor(rand(0, 3.2)) },
  { id: 'elfHunt', icon: '🧝', title: 'FIND THE MAGIC ELVES', how: 'Five glowing magic elves are hidden around the house. Find all five in 1 minute 30 — walk right up to an elf to catch it. Fastest team wins!', unit: 's', lowerBetter: true, other: () => Math.random() < 0.35 ? null : Math.round(rand(46, 89)) },
  { id: 'parcel', icon: '🎁', title: 'PASS THE PARCEL', how: 'The parcel goes round while the music plays. When it stops on YOU, hit TEAR before the music starts again!', unit: ' layers', other: () => Math.floor(rand(0, 3)) },
];
// (spare games, used between quiz rounds if ever needed)
export const SPARE = [
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
  // put people straight on their spots (no long walks across the house), standing and watching
  place(p, x, z, faceTo) { if (!p || p.isPlayer) return; if (p.isDown()) { p.state = 'anim'; } const yaw = Math.atan2(faceTo[0] - x, faceTo[1] - z); p.teleport(x, 0, z, yaw); p.base = 'stand'; p.gesture = null; p.lookTarget = null; if (p.brain) { p.brain.state = 'scripted'; p.brain.timer = 9999; p.brain.path = null; } }
  park(people, spots, faceTo) { people.forEach((p, i) => { const s = spots[i % spots.length]; this.place(p, s[0], s[1], faceTo); }); this.parked = people; }
  // everyone else becomes the audience: standing round the game, watching and cheering, not wandering about
  crowd(spots, faceTo, except = []) { const ex = new Set([...except, ...(this.parked || [])]); const ppl = G.chars.filter(c => !c.isPlayer && !ex.has(c) && c.brain && !(c.brain.home?.carried)); this.audience = ppl;
    ppl.forEach((p, i) => { const s = spots[i % spots.length]; const j = i >= spots.length ? 0.35 : 0; this.place(p, s[0] + rand(-j, j), s[1] + rand(-j, j), faceTo); }); }
  seatEveryone(except = []) { const ex = new Set(except); for (const c of G.chars) { if (c.isPlayer || ex.has(c) || !c.brain || c.brain.home?.carried) continue; if (c.isDown()) c.state = 'anim'; G.ai?.sitAtHome(c.brain, true); c.brain.state = 'scripted'; c.brain.timer = 9999; } this.audience = []; }
  cheer() { const a = this.audience; if (!a?.length) return; for (let k = 0; k < 3; k++) { const p = pick(a); if (p.state !== 'anim') continue; p.gesture = pick(['clap', 'cheer', 'laugh', 'point']); setTimeout(() => { if (['clap', 'cheer', 'laugh', 'point'].includes(p.gesture)) p.gesture = null; }, 1800); } }
  releaseAll() { for (const c of G.chars) if (c.brain && c.brain.state === 'scripted' && !c.isPlayer) { c.brain.state = 'idle'; c.gesture = null; G.ai?.goHome(c.brain); } this.parked = []; this.audience = []; }
  release() { if (G.modes?.id === 'games') { this.parked = []; return; } /* mini games mode: they stay as the audience for the next game */ this.releaseAll(); }
  clearArea(x0, x1, z0, z1, keep = []) { for (const it of G.items.instances.slice()) { if (it.type.fixed || it.held || keep.includes(it.id)) continue; const t = it.body.translation(); if (t.x > x0 && t.x < x1 && t.z > z0 && t.z < z1) G.items.remove(it); } }

  async play(i) {
    const def = GAMES[i]; const q = G.quiz; G.player.releaseAll(); G.modes?.hudOff?.();
    sfx('whistle', null, 0.8); q?.mSay?.(`Game ${i + 1}: ${def.title.toLowerCase()}!`, 2);
    const a = { id: def.id, def, i, t: 0, score: 0, limit: 0, live: false };
    this['setup_' + def.id](a);
    const how = typeof def.how === 'function' ? def.how() : def.how;
    G.screens?.setTV((g, W, H) => { tvFrame(g, W, H, `GAME ${ORDINAL[i]}: ${def.title}`, '#2d6a4f'); g.fillStyle = '#fff'; g.font = '30px sans-serif'; wrapText(g, how, 60, 170, 900, 42); });
    await card({ kicker: `GAME ${ORDINAL[i]}`, title: def.title, sub: how, icon: def.icon, secs: 6.5 });
    await card({ kicker: 'GET READY', title: '3 · 2 · 1 · GO!', secs: 1.6, c1: '#2d8a4f', c2: '#0e3a20' });
    sfx('whistle', null, 1); a.live = true; this.active = a; this['begin_' + def.id]?.(a);
    await new Promise(res => { a.done = res; });
    this.active = null; timer(null); meters(null); stopMusic(); this['end_' + def.id]?.(a);
    // leaderboard: you vs the other teams (theirs are made up, obviously)
    const mine = this.me(); let rows = TEAM_IDS.map(t => ({ team: t, name: TEAMS[t].name, color: TEAMS[t].color, me: t === mine, score: t === mine ? a.score : def.other() }));
    // times (lower is better, DNF last) are shown as text and ranked by a sort key
    if (def.lowerBetter) rows = rows.map(r => ({ ...r, raw: r.score, display: r.score == null ? 'DNF' : `${r.score}s`, score: r.score == null ? -9999 : -r.score }));
    const order = rows.slice().sort((x, y) => y.score - x.score); order.forEach((r, k) => { const pts = [3, 2, 1, 0][k]; this.total[r.team] = (this.total[r.team] || 0) + pts; if (q) q.bonus[r.team] += pts; });
    sfx(order[0].me ? 'cheer' : 'drum', null, 0.9);
    await board({ kicker: `GAME ${ORDINAL[i]} FINISHED`, title: def.title, rows, unit: def.lowerBetter ? '' : def.unit, footer: order[0].me ? 'You won this one! +3 points' : `${order[0].name} win this one.`, secs: 5.5 });
    this.release(); this.tidy(a);
    return a.score;
  }
  overall() { const mine = this.me(); return TEAM_IDS.map(t => ({ name: TEAMS[t].name, color: TEAMS[t].color, me: t === mine, score: this.total[t] || 0 })); }
  tidy(a) { setTimeout(() => { for (const it of G.items.instances.slice()) if (!it.held && ['sprout', 'celebration', 'present_s', 'present_m', 'paper_ball', 'cracker', 'paper_crown', 'satsuma'].includes(it.id) && it.mg) G.items.remove(it); }, 1500); }
  spawn(id, pos, opts) { const it = G.items.spawn(id, pos, null, opts); if (it) it.mg = true; return it; }
  limitTick(a, dt) { if (!a.limit) return; const left = Math.max(0, a.limit - a.t); const L = Math.ceil(left); timer(L >= 60 ? `${Math.floor(L / 60)}:${String(L % 60).padStart(2, '0')}` : `${L}s`, a.label ? a.label() : `SCORE ${a.score}`, left < 6); if (left <= 0 || a.skip) { a.timeUp = left <= 0; this.stop(a); } }
  stop(a) { if (a.stopped) return; a.stopped = true; a.live = false; sfx('whistle', null, 1); a.done?.(); }
  update(dt) { const a = this.active; if (!a || !a.live) return; a.t += dt; this['tick_' + a.id]?.(a, dt); this.limitTick(a, dt); if (G.frame % 140 === 0) this.cheer(); }

  // the audience spots: round the dining room (away from the table and the cracker spot) and round the sumo ring
  diningCrowd(except, faceTo = [TABLE.x, TABLE.z]) { this.crowd([[3.8, -1.9], [3.3, -1.8], [2.8, -1.9], [2.3, -2.1], [1.9, -2.5], [1.8, -4.3], [2.0, -4.9], [2.5, -5.3], [3.0, -5.4], [3.5, -5.4], [1.8, -3.7], [3.9, -5.0], [4.2, -1.75], [2.6, -2.6]], faceTo, except); }

  // ---------- 1. Brussels sprout throwing ----------
  // six big red-and-white party cups, fixed to the far end of the table, and a pile of sprouts at your end
  setup_sproutPong(a) {
    a.limit = 45; a.counted = new Set();
    this.clearArea(TABLE.x0 - 0.1, TABLE.x1 + 0.1, TABLE.z0 - 0.1, TABLE.z1 + 0.1);
    for (const c of G.items.byType.pong_cup || []) { c.body.setTranslation({ x: 1.25, y: 0.95, z: -3.5 - Math.random() * 0.5 }, true); c.dirty = true; } // the little cups go on the sideboard
    const R0 = 0.05, R1 = 0.078, CH = 0.16;
    const P = new Prop().lathe([[0, 0], [R0, 0], [R1, CH], [R1 - 0.004, CH], [R0 - 0.004, 0.006], [0, 0.006]], '#d0101e', 0, 0, 0, 24);
    P.lathe([[0, 0.007], [R0 - 0.005, 0.007], [R1 - 0.005, CH - 0.002], [R1 - 0.006, CH - 0.002], [R0 - 0.006, 0.008], [0, 0.008]], '#f6f6f6', 0, 0, 0, 24); // white inside
    P.torus(R1, 0.005, '#ffffff', 0, CH, 0, Math.PI / 2).torus(R1 - 0.009, 0.0035, '#ffffff', 0, CH - 0.022, 0, Math.PI / 2); // white rim + stripe
    const geo = P.build(); const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, side: THREE.DoubleSide });
    a.cups = []; a.cupStatics = [];
    const pts = [[-0.17, 0], [0, 0], [0.17, 0], [-0.085, 0.15], [0.085, 0.15], [0, 0.3]];
    for (const [dx, dz] of pts) { const x = TABLE.x + dx, z = TABLE.z0 + 0.16 + dz, y = TABLE.y;
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; G.scene.add(m); a.cups.push({ x, z, y, mesh: m });
      a.cupStatics.push(staticCyl(x, y + 0.004, z, 0.004, R0)); // base
      for (let k = 0; k < 12; k++) { const ang = k / 12 * Math.PI * 2, r = (R0 + R1) / 2 + 0.003; const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -ang, 0)); a.cupStatics.push(staticBox(x + Math.cos(ang) * r, y + CH / 2, z + Math.sin(ang) * r, 0.003, CH / 2, 0.022, q)); } }
    for (let k = 0; k < 14; k++) this.spawn('sprout', new THREE.Vector3(TABLE.x - 0.25 + (k % 7) * 0.08, TABLE.y + 0.03, TABLE.z1 - 0.12 - Math.floor(k / 7) * 0.08));
    G.player.teleport(TABLE.x, TABLE.z1 + 0.65, 0); G.player.pitch = -0.35;
    this.park(this.reps(2), [[4.15, -3.25], [4.15, -4.2]], [TABLE.x, TABLE.z]); this.diningCrowd([]);
  }
  tick_sproutPong(a) {
    if (G.frame % 4) return;
    for (const s of G.items.byType.sprout || []) { if (a.counted.has(s)) continue; const p = s.body.translation(); for (const c of a.cups) { if (Math.hypot(p.x - c.x, p.z - c.z) < 0.062 && p.y > c.y && p.y < c.y + 0.15) { a.counted.add(s); a.score++; sfx('ding', p, 0.7); G.ui?.toast(`IN THE CUP! (${a.score})`, 1.2, { game: true }); c.mesh.scale.setScalar(1.12); setTimeout(() => c.mesh.scale.setScalar(1), 160); this.cheer(); break; } } }
    // sprouts run out? put a few more out
    if ((G.items.byType.sprout || []).length < 60 && (G.items.byType.sprout || []).filter(s => !a.counted.has(s) && s.body.translation().y > 0.5).length < 3) for (let k = 0; k < 6; k++) this.spawn('sprout', new THREE.Vector3(TABLE.x - 0.2 + k * 0.08, TABLE.y + 0.03, TABLE.z1 - 0.12));
  }
  end_sproutPong(a) { for (const c of a.cups || []) G.scene.remove(c.mesh); for (const st of a.cupStatics || []) { G.colliderMap.delete(st.collider.handle); G.world.removeRigidBody(st.body); } a.cups = []; a.cupStatics = []; }

  // ---------- 2. Cracker pull ----------
  // you stand on one spot in the dining room; each opponent appears straight in front of you, the camera locks on them
  // and you can't walk off until the cracker goes bang; then the next one steps up
  setup_crackerDuel(a) {
    a.round = 0; a.opps = this.reps(3); a.wins = 0; a.spot = [2.4, -3.2]; a.oppSpot = [3.2, -3.2];
    G.player.teleport(a.spot[0], a.spot[1], -Math.PI / 2); G.player.pitch = -0.08;
    this.park(a.opps, [[3.9, -4.7], [3.5, -5.1], [3.1, -5.3]], a.spot);
    this.diningCrowd(a.opps, a.spot);
  }
  begin_crackerDuel(a) { this.nextDuel(a); }
  nextDuel(a) {
    if (a.round >= a.opps.length) return this.stop(a);
    const opp = a.opps[a.round]; a.opp = opp; a.me = 0; a.them = 0; a.duelOn = false;
    G.player.teleport(a.spot[0], a.spot[1], -Math.PI / 2); // back to the cracker spot
    this.place(opp, a.oppSpot[0], a.oppSpot[1], a.spot); opp.gesture = 'pull';
    G.player.lockAt = () => opp.state === 'anim' ? opp.chestPos(new THREE.Vector3()).add(new THREE.Vector3(0, 0.12, 0)) : null;
    const c = this.spawn('cracker', opp.handPos('R', new THREE.Vector3())); a.cracker = c;
    if (c) { c.body.setBodyType(G.R.RigidBodyType.KinematicPositionBased, true); c.attached = (out, q) => { const hp = opp.handPos('R', new THREE.Vector3()); const pp = G.player.headPos(new THREE.Vector3()).add(G.player.forward(new THREE.Vector3()).multiplyScalar(0.45)); pp.y -= 0.35; out.copy(hp).lerp(pp, 0.5); q.setFromEuler(new THREE.Euler(0, Math.atan2(pp.x - hp.x, pp.z - hp.z) + Math.PI / 2, 0)); return out; }; }
    opp.say(pick(['Come on then!', 'Pull it!', 'I always win these.', 'Ready?']), { prio: 1 });
    card({ kicker: `DUEL ${a.round + 1} OF 3`, title: `VS ${opp.name.toUpperCase()}`, sub: 'Hammer PULL!', secs: 1.8, c1: '#7b2cbf', c2: '#2a0b44' }).then(() => { a.duelOn = true; a.rate = rand(0.28, 0.42); a.removeBtn = tapButton('PULL!', () => { if (a.duelOn) { a.me += 0.075; G.player.fp.punch?.('R'); sfx('tap', null, 0.25); } }); });
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
      if (win) { a.score++; a.opp.say(pick(['Rigged.', 'My hand slipped!', 'Best of five?']), { prio: 1 }); a.opp.setMood('angry', 2); a.opp.gesture = 'facepalm'; } else { a.opp.gesture = 'cheer'; a.opp.say(pick(['YES!', 'Get in!', 'Too easy.']), { prio: 1 }); }
      this.cheer();
      card({ kicker: 'BANG!', title: win ? 'YOU WIN!' : `${a.opp.name.toUpperCase()} WINS`, sub: win ? 'The hat and the terrible joke are yours.' : 'The hat goes to them. The joke is still terrible.', secs: 2, c1: win ? '#2d8a4f' : '#7a1f24', c2: win ? '#0e3a20' : '#2a0a10' }).then(() => {
        const o = a.opp; o.gesture = null; this.place(o, 1.9 + a.round * 0.4, -5.0, a.spot); a.round++; this.nextDuel(a); });
    }
  }
  end_crackerDuel(a) { a.removeBtn?.(); if (a.cracker?.alive) G.items.remove(a.cracker); G.player.lockAt = null; }

  // ---------- 3. Boxing Day sumo (garden ring) ----------
  // a little sumo stage on the lawn. Every hit fills the opponent's wobble meter (and it drains if you stop); full
  // meter on a phone = they fly out of the ring; in the headset = grab them and throw them out. They shove back.
  setup_sumo(a) {
    const R = { x: -1.4, z: -12.4, r: 1.5 }; a.ring = R; a.round = 0; a.opps = this.reps(3); a.limitEach = 25;
    const P = new Prop(); P.cyl(R.r + 0.28, R.r + 0.34, 0.07, '#b89a6a', 0, 0.035, 0, 0, 0, 0, 40).cyl(R.r, R.r, 0.006, '#e6d3a2', 0, 0.075, 0, 0, 0, 0, 40); // raised clay platform + sand
    for (let k = 0; k < 90; k++) { const ang = k / 90 * Math.PI * 2; P.sph(0.055, k % 2 ? '#c8a960' : '#b8964c', Math.cos(ang) * R.r, 0.09, Math.sin(ang) * R.r, 1.6, 0.9, 1.6, 8); } // the straw-bale rope round the edge
    for (const s of [-1, 1]) P.box(0.04, 0.006, 0.42, '#ffffff', s * 0.45, 0.08, 0); // the two start lines
    const cols = ['#1a1a1a', '#c41e1e', '#ffffff', '#1f8a3a'];
    [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], k) => { const x = sx * (R.r + 0.45), z = sz * (R.r + 0.45); P.cyl(0.05, 0.05, 2.0, '#6b4a2a', x, 1.0, z, 0, 0, 0, 10).sph(0.12, cols[k], x, 1.95, z, 1, 1.4, 1, 10).cone(0.1, 0.4, cols[k], x, 1.7, z, Math.PI, 0, 0, 10); });
    for (const [x0, z0, x1, z1] of [[1, 1, -1, 1], [-1, 1, -1, -1], [-1, -1, 1, -1], [1, -1, 1, 1]]) { const k = R.r + 0.45; const cx = (x0 + x1) / 2 * k, cz = (z0 + z1) / 2 * k; P.box(Math.abs(x1 - x0) * k + 0.1, 0.08, Math.abs(z1 - z0) * k + 0.1, '#7b2cbf', cx, 2.02, cz); } // purple roof frame
    a.ringMesh = new THREE.Mesh(P.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })); a.ringMesh.position.set(R.x, 0, R.z); a.ringMesh.receiveShadow = false; a.ringMesh.castShadow = false; G.scene.add(a.ringMesh);
    a.light = new THREE.PointLight('#ffe2a8', 6, 7, 1.6); a.light.position.set(R.x, 2.6, R.z); G.scene.add(a.light);
    this.park(a.opps, [[R.x - 2.4, R.z - 1.7], [R.x - 2.7, R.z - 1.2], [R.x - 3.0, R.z - 0.7]], [R.x, R.z]);
    const ring = []; for (let k = 0; k < 14; k++) { const ang = Math.PI * 0.15 + k / 14 * Math.PI * 1.5; ring.push([R.x + Math.cos(ang) * (R.r + 1.25), R.z + Math.sin(ang) * (R.r + 1.25)]); }
    this.crowd(ring, [R.x, R.z], a.opps);
    G.player.teleport(R.x - 0.75, R.z, -Math.PI / 2); G.player.pitch = -0.1;
    a.label = () => `ROUND ${Math.min(3, a.round + 1)} · WINS ${a.score}`;
  }
  begin_sumo(a) { this.nextBout(a); }
  nextBout(a) {
    const R = a.ring; if (a.round >= a.opps.length) return this.stop(a);
    const opp = a.opps[a.round]; a.opp = opp; a.meter = 0; a.boutOn = false; a.lunge = rand(1.4, 2.4);
    G.player.teleport(R.x - 0.75, R.z, -Math.PI / 2);
    this.place(opp, R.x + 0.75, R.z, [R.x - 0.75, R.z]); opp.gesture = 'sumo'; opp.sumoReady = false;
    opp.sumo = (imp, grab) => { if (!a.boutOn) return; a.meter = Math.min(1.05, a.meter + (grab ? 0.07 : 0.11)); sfx('boff', opp.chestPos(new THREE.Vector3()), 0.7); opp.setMood?.('shock', 0.4);
      const d = new THREE.Vector3(opp.pos.x - G.player.pos.x, 0, opp.pos.z - G.player.pos.z).normalize(); opp.pos.addScaledVector(d, 0.06); opp.gestureT = 0; };
    card({ kicker: `BOUT ${a.round + 1} OF 3`, title: `VS ${opp.name.toUpperCase()}`, sub: G.xr ? 'Fill the wobble meter, then GRAB and THROW!' : 'Keep hitting them!', secs: 1.8, c1: '#7b2cbf', c2: '#2a0b44' }).then(() => { a.boutOn = true; a.boutT = 0; opp.say(pick(['Come on then!', 'I\'ve been training.', 'You\'re going in the hedge.', 'Hakkeyoi!']), { prio: 1 }); });
  }
  tick_sumo(a, dt) {
    const R = a.ring, opp = a.opp; if (!opp) return;
    if (!a.boutOn) { meters(null); return; }
    a.boutT += dt; a.meter = Math.max(0, a.meter - dt * 0.22);
    // they edge forward and shove you back (out of the ring = you lose the bout)
    if (opp.state === 'anim' && opp.sumo) {
      const pp = G.player.pos; const d = new THREE.Vector3(pp.x - opp.pos.x, 0, pp.z - opp.pos.z); const dist = d.length(); d.normalize();
      opp.yaw = Math.atan2(d.x, d.z); a.lunge -= dt;
      if (a.lunge < 0) { a.lunge = rand(1.2, 2.2) * (1 + a.meter); if (dist > 0.7) opp.pos.addScaledVector(d, Math.min(0.3, dist - 0.65)); else if (a.meter < 0.5) { const np = pp.clone().addScaledVector(d, 0.35); G.player.teleport(np.x, np.z, G.player.yaw); sfx('thud', pp, 0.8); G.ui?.toast('SHOVED!', 0.8, { game: true }); } }
      const pr = Math.hypot(G.player.pos.x - R.x, G.player.pos.z - R.z); if (pr > R.r + 0.1) return this.boutOver(a, false, "You're out of the ring!");
      // keep them on the sand until they're beaten
      const or = Math.hypot(opp.pos.x - R.x, opp.pos.z - R.z); if (or > R.r - 0.15) { opp.pos.x = R.x + (opp.pos.x - R.x) * (R.r - 0.15) / or; opp.pos.z = R.z + (opp.pos.z - R.z) * (R.r - 0.15) / or; }
    }
    meters([{ label: `${opp.name} · WOBBLE`, value: a.meter, color: a.meter > 0.8 ? '#ff4d4d' : '#ffd700' }]);
    if (a.meter >= 1 && !opp.sumoReady) {
      if (G.xr) { opp.sumoReady = true; G.ui?.toast('OFF BALANCE! GRAB THEM AND THROW THEM OUT!', 2.5, { game: true }); sfx('whistle', null, 0.6); }
      else { opp.sumoReady = true; const d = new THREE.Vector3(opp.pos.x - G.player.pos.x, 0, opp.pos.z - G.player.pos.z).normalize(); opp.sumo = null; opp.knock(d.multiplyScalar(opp.mass * 7).setY(opp.mass * 3.2), 1, { force: true }); sfx('bigthud', opp.pos, 1); }
    }
    if (opp.sumoReady && a.meter < 0.55 && opp.state === 'anim' && opp.sumo) opp.sumoReady = false; // they got their balance back
    // out of the ring?
    const p0 = opp.state === 'anim' ? opp.pos : opp.world[0].p; const off = Math.hypot(p0.x - R.x, p0.z - R.z) > R.r + 0.2;
    if (off && (opp.state !== 'anim' || !opp.sumo)) return this.boutOver(a, true);
    if (a.boutT > a.limitEach) return this.boutOver(a, false, 'Time! They held their ground.');
    timer(`${Math.ceil(a.limitEach - a.boutT)}s`, a.label(), a.limitEach - a.boutT < 6);
  }
  boutOver(a, win, why) {
    if (!a.boutOn) return; a.boutOn = false; const opp = a.opp; opp.sumo = null; opp.sumoReady = false; meters(null);
    if (win) { a.score++; sfx('cheer', null, 0.9); opp.say(pick(['Ow! My dignity!', 'I slipped!', 'Rematch!']), { prio: 1 }); } else { if (opp.state === 'anim') opp.gesture = 'cheer'; opp.say(pick(['Sumo champion!', 'Too strong.', 'Have that!']), { prio: 1 }); }
    this.cheer();
    card({ kicker: win ? 'OUT OF THE RING!' : 'BOUT LOST', title: win ? 'YOU WIN!' : `${opp.name.toUpperCase()} WINS`, sub: win ? `${opp.name} is in the flower bed.` : why || '', secs: 2, c1: win ? '#2d8a4f' : '#7a1f24', c2: win ? '#0e3a20' : '#2a0a10' }).then(() => {
      setTimeout(() => { const R = a.ring; this.place(opp, R.x + 2.6, R.z + 1.2 + a.round * 0.4, [R.x, R.z]); a.round++; this.nextBout(a); }, opp.state === 'anim' ? 0 : 600); });
  }
  end_sumo(a) { if (a.opp) { a.opp.sumo = null; a.opp.sumoReady = false; } for (const o of a.opps || []) { o.sumo = null; o.sumoReady = false; } G.scene.remove(a.ringMesh); G.scene.remove(a.light); meters(null); }

  // ---------- 4. Find the magic elves ----------
  // five little glowing elves hidden around the house; walk up to one to catch it; 1:30 on the clock
  setup_elfHunt(a) {
    a.limit = 90; a.found = 0; a.label = () => `ELVES ${a.found}/5`;
    const tree = G.house.spots.tree;
    const spots = [[1.15, 0.9, -4.6], [3.85, 0.93, 5.55], [-3.45, 0.95, 4.2], [-7.19, 0.54, 3.5], [-4.4, 0.02, -0.6], [-3.2, 0.02, 2.5], [5.51, 1.87, 0.1], [0.0, 0.02, 5.6], [2.6, 0.02, -8.0], [tree.x + 0.55, 0.02, tree.z + 0.35], [-2.2, 1.45, -0.1], [-2.5, 0.95, 3.75], [-1.5, 0.02, 5.55], [4.6, 0.02, -7.4]];
    const chosen = shuffle(spots).slice(0, 5); a.elves = [];
    const halo = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,200,1)'); gr.addColorStop(0.35, 'rgba(140,255,120,0.55)'); gr.addColorStop(1, 'rgba(60,255,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    for (const [x, y, z] of chosen) {
      const P = new Prop(); P.cone(0.07, 0.16, '#1f8a3a', 0, 0.08, 0, 0, 0, 0, 12).cyl(0.062, 0.062, 0.02, '#151515', 0, 0.05, 0, 0, 0, 0, 12).box(0.03, 0.022, 0.012, '#ffd700', 0, 0.05, 0.062)
        .sph(0.048, '#f2c9a8', 0, 0.2, 0, 1, 1, 1, 12).sph(0.008, '#222', -0.017, 0.21, 0.042).sph(0.008, '#222', 0.017, 0.21, 0.042).sph(0.01, '#e88', 0, 0.195, 0.048)
        .cone(0.05, 0.13, '#c41e1e', 0, 0.29, -0.01, -0.35, 0, 0, 12).sph(0.016, '#ffd700', 0, 0.35, -0.05).torus(0.046, 0.01, '#f6f6f6', 0, 0.235, 0, Math.PI / 2)
        .cone(0.014, 0.04, '#f2c9a8', -0.05, 0.215, 0, 0, 0, 1.2, 6).cone(0.014, 0.04, '#f2c9a8', 0.05, 0.215, 0, 0, 0, -1.2, 6)
        .cyl(0.015, 0.012, 0.06, '#c41e1e', -0.03, 0.0, 0.01, 0, 0, 0, 8).cyl(0.015, 0.012, 0.06, '#c41e1e', 0.03, 0.0, 0.01, 0, 0, 0, 8);
      const m = new THREE.Mesh(P.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: new THREE.Color('#2a5a1a'), emissiveIntensity: 1 }));
      const grp = new THREE.Group(); grp.position.set(x, y + 0.03, z); grp.add(m);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ccff99' })); sp.scale.setScalar(0.75); sp.position.y = 0.18; grp.add(sp);
      const sparks = []; for (let k = 0; k < 6; k++) { const s2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#fff6a0' })); s2.scale.setScalar(0.08); grp.add(s2); sparks.push(s2); }
      grp.rotation.y = Math.random() * 6; G.scene.add(grp); a.elves.push({ grp, m, sp, sparks, x, y, z, ph: Math.random() * 6 });
    }
    G.player.teleport(-2.2, -1.75, 0.67); G.player.pitch = 0;
    this.seatEveryone();
  }
  tick_elfHunt(a, dt) {
    const hp = G.player.headPos(new THREE.Vector3());
    for (const e of a.elves) { if (e.found) continue; const t = G.time + e.ph;
      e.m.position.y = Math.sin(t * 2.2) * 0.025; e.grp.rotation.y += dt * 0.8; e.sp.material.opacity = 0.65 + Math.sin(t * 4) * 0.3; e.sp.scale.setScalar(0.7 + Math.sin(t * 3) * 0.1);
      e.sparks.forEach((s2, k) => { const ang = t * 1.6 + k / 6 * Math.PI * 2; s2.position.set(Math.cos(ang) * 0.16, 0.12 + Math.sin(t * 3 + k) * 0.1, Math.sin(ang) * 0.16); });
      if (Math.hypot(hp.x - e.x, hp.z - e.z) < 1.0 && Math.abs(hp.y - e.y) < 1.7) {
        e.found = true; a.found++; sfx('ding', new THREE.Vector3(e.x, e.y, e.z), 1); sfx('cheer', null, 0.4);
        let k = 0; const pop = () => { k++; e.grp.scale.setScalar(1 + k * 0.25); e.grp.position.y += 0.03; e.sp.material.opacity = 1 - k / 8; if (k < 8) setTimeout(pop, 30); else G.scene.remove(e.grp); }; pop();
        G.ui?.toast(`🧝 MAGIC ELF FOUND! ${a.found}/5`, 1.8, { game: true });
        if (a.found >= 5) { a.score = Math.max(1, Math.round(a.t)); this.stop(a); }
      }
    }
  }
  end_elfHunt(a) { for (const e of a.elves || []) G.scene.remove(e.grp); if (a.found < 5) a.score = null; }

  // ---------- 3. Pass the parcel ----------
  setup_parcel(a) {
    a.layers = 6; const c = { x: 2.9, z: -3.7 }, r = 1.0; a.circle = c;
    this.clearArea(1.6, 4.2, -5.1, -2.3);
    a.people = this.reps(4); const slots = [];
    for (let k = 0; k < 5; k++) { const ang = k / 5 * Math.PI * 2; slots.push([c.x + Math.sin(ang) * r, c.z + Math.cos(ang) * r]); }
    G.player.teleport(slots[0][0], slots[0][1], 0); G.player.pitch = -0.15;
    this.park(a.people, slots.slice(1), [c.x, c.z]); a.slots = slots; a.holder = 0; this.diningCrowd(a.people, [c.x, c.z]);
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
    if (a.tearing && a.t > a.tearUntil) { a.tearing = false; a.removeBtn?.(); G.ui?.toast('Too slow! It goes round again.', 2, { game: true }); G.ai.say('Paul', 'Tear it, then!', 1); setTimeout(() => this.parcelMusic(a), 1200); }
    if (a.playing && (G.player.controls.btn('use').pressed)) { a.score = Math.max(0, a.score - 1); G.ui?.toast('You tore it while the music was playing! -1', 2, { game: true }); }
  }
  tore(a, mine, p) {
    if (!a.live) return; a.layers--; sfx('rip', a.parcel?.body.translation(), 1);
    const b = this.spawn('paper_ball', new THREE.Vector3().copy(a.parcel.body.translation()).add(new THREE.Vector3(0, 0.25, 0))); b?.body.setLinvel({ x: rand(-1, 1), y: 2, z: rand(-1, 1) }, true);
    if (mine) { a.score++; G.ui?.toast(`You tear a layer! (${a.score})`, 1.5, { game: true }); } else { p?.say(pick(['Mine!', 'Ooh!', 'Is it a satsuma?']), { prio: 0 }); }
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
  tick_giftGrab(a) { if (G.frame % 10) return; let n = 0; for (const id of ['present_s', 'present_m', 'present_l']) for (const p of G.items.byType[id] || []) { const t = p.body.translation(); if (Math.abs(t.x - a.zone.x) < 0.5 && Math.abs(t.z - a.zone.z) < 0.5) n++; } if (n > a.score) { sfx('ding', null, 0.6); G.ui?.toast(`In the square! (${n})`, 1.2, { game: true }); } a.score = n; a.zoneMesh.material.opacity = 0.35 + Math.sin(G.time * 5) * 0.15; }
  end_giftGrab(a) { G.scene.remove(a.zoneMesh); }

  // hooks from interact.js
  unwrapParcel() { G.ui?.toast('Save it for Pass the Parcel!'); }
  clapStart() {}
}
