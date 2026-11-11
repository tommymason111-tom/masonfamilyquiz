// Family behaviour: seats, wandering to the buffet, personal idles, pairings (Hollie+Dan, Sophie+James),
// get-up reactions, sulking, Debbie's coat, Paul's nap, and the little ones' chaos (Mason & Harrison).
import * as THREE from 'three';
import { G, on, emit, rand, pick, clamp, shuffle } from '../core.js';
import { PERSONA } from './cast.js';
import { roomAt } from '../world/house.js';
import { sfx } from '../engine/audio.js';

const _v = new THREE.Vector3();
const IDLE_GESTURE = { bellyPat: 'bellyPat', point: 'point', argue: 'argue', drink: 'sip', tidy: 'tidy', phone: 'phone', film: 'phone', laughPolite: 'laugh', whisper: null,
  clipboard: 'write', whistle: 'whistle', straightenTree: null, refill: null, wipe: 'tidy', coaster: 'point', laugh: 'laugh', selfie: 'phone', pint: 'sip', deadpan: 'armsFolded',
  ring: 'wave', binder: 'write', tuckHair: 'tuckHair', stand: null, slapArm: 'slapArm', armsFolded: 'armsFolded', adjust: 'shrug', snack: 'sip', watchMason: null, sip: 'sip', bounce: 'bounce' };

export class AI {
  constructor() {
    G.ai = this; this.brains = new Map();
    const H = G.house.spots;
    const seat = (s) => ({ ...s, pos: s.pos.clone() });
    const V = (x, z) => new THREE.Vector3(x, 0, z);
    const plan = {
      // Living room: the quiz lot
      Paul: seat(H.sofaL[0]), Karen: seat(H.sofaL[1]), Charli: { ...seat(H.sofaArmL) },
      Martin: { ...seat(H.armchair), armchair: true },
      Debbie: seat(H.sofaR[0]), Kirsty: seat(H.sofaR[1]),
      Gary: { pos: V(-3.2, -5.25), yaw: 0.8, stand: true },
      Mason: { ...seat(H.floor[2]), floor: true },
      // Kitchen: Julie at the hob, Jodie by the kettle, Hollie & Dan leaning on the island by the drinks
      Julie: { pos: V(5.25, 2.85), yaw: Math.PI / 2, stand: true, room: 'kitchen' },
      Jodie: { pos: V(5.25, 4.7), yaw: Math.PI / 2, stand: true, room: 'kitchen' },
      Hollie: { pos: V(3.55, 1.95), yaw: Math.PI + 0.3, stand: true, room: 'kitchen' },
      Dan: { pos: V(4.22, 2.0), yaw: Math.PI - 0.3, stand: true, room: 'kitchen' },
      // Games room: Sophie & James planning the wedding at the table, Harry by the PC
      Sophie: { pos: V(1.75, -3.0), yaw: Math.PI / 2, stand: true, room: 'dining' },
      James: { pos: V(1.75, -3.7), yaw: Math.PI / 2 - 0.3, stand: true, room: 'dining' },
      Harry: { pos: V(4.25, -1.75), yaw: Math.PI / 2 + 0.3, stand: true, room: 'dining' },
      // Conservatory: Bradley keeping Harrison calm in the quiet
      Bradley: { ...seat(H.consSofa[0]), room: 'conservatory' },
      Harrison: { carried: 'Bradley' },
    };
    for (const p of G.chars) {
      if (p.isPlayer) continue;
      const home = plan[p.name] || { pos: new THREE.Vector3(0, 0, -3), yaw: 0, stand: true };
      const b = { p, home, state: 'idle', path: null, nextIdle: rand(2, 8), persona: PERSONA[p.name] || {}, timer: 0, quiet: false };
      this.brains.set(p, b);
      p.brain = b;
      if (home.carried) continue;
      this.sitAtHome(b, true);
    }
    // Harrison rides on Bradley's arm
    this.harrison = G.charByName.Harrison; this.bradley = G.charByName.Bradley;
    if (this.bradley) this.bradley.gesture = 'holdBaby';
    // Gary waits in the garage until the outfit wheel has spun
    const gary = G.charByName.Gary; if (gary) { const gb = this.brains.get(gary); gb.state = 'hidden'; gary.teleport(-5.0, 0, 3.0, Math.PI / 2); }
    on('recover', (p) => this.onRecover(p));
    on('ragdoll', (p) => this.onRagdoll(p));
    G.updaters.push((dt) => this.update(dt));
  }
  sitAtHome(b, snap) {
    const h = b.home; const p = b.p;
    if (h.armchair) { const ac = G.items.byType.armchair?.[0]; if (ac) { const t = ac.body.translation(), r = ac.body.rotation(); const q = new THREE.Quaternion(r.x, r.y, r.z, r.w); const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q); if (up.y > 0.8) { const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q); h.pos.set(t.x + fwd.x * 0.05, 0, t.z + fwd.z * 0.05); h.yaw = Math.atan2(fwd.x, fwd.z); h.seatY = 0.55 + (t.y - 0.42); } } }
    p.seatY = h.seatY ?? 0.45;
    p.base = h.stand ? 'stand' : h.floor ? 'sitFloor' : 'sit';
    if (snap) p.teleport(h.pos.x, 0, h.pos.z, h.yaw); else { p.pos.copy(h.pos); p.yaw = h.yaw; }
    b.state = 'idle';
  }
  goTo(b, target, then, speed = 1.15) {
    const p = b.p; b.path = G.house.path(p.pos, target); b.then = then; b.speed = speed; b.state = 'walk'; p.base = 'walk'; p.gesture = p.gesture === 'holdBaby' ? 'holdBaby' : null;
  }
  goHome(b) { const h = b.home; if (h.carried) return; this.goTo(b, h.pos, () => this.sitAtHome(b, false)); }
  say(name, text, prio = 1) { const p = G.charByName[name]; if (p && !p.isDown()) p.say(text, { prio }); }

  update(dt) {
    const t = G.time;
    for (const [p, b] of this.brains) {
      if (p.state !== 'anim') continue;
      if (b.state === 'hidden' || b.state === 'carried') continue;
      if (p.name === 'Mason') { this.mason(b, dt); continue; }
      if (p.name === 'Paul') this.paulRounds(b, dt);
      if (b.state === 'walk') { this.walk(b, dt); continue; }
      if (b.state === 'storm' || b.state === 'sulk' || b.state === 'asleep' || b.state === 'knock' || b.state === 'scripted') { b.timer -= dt; if (b.timer < 0 && b.state !== 'storm' && b.state !== 'asleep') { b.state = 'idle'; p.gesture = null; this.goHome(b); } }
      // look at whoever is talking (or at you)
      this.chooseLook(p, b);
      if (b.state !== 'idle') continue;
      // drift back home if pushed away
      if (p.pos.distanceTo(b.home.pos || p.pos) > 0.6 && !b.home.carried) { this.goHome(b); continue; }
      b.nextIdle -= dt;
      if (b.nextIdle < 0) {
        b.nextIdle = rand(6, 16);
        const list = b.persona.idle || [];
        const g = IDLE_GESTURE[pick(list)] ?? null;
        if (g && p.gesture !== 'holdBaby') { p.gesture = g; p.gestureT = 0; setTimeout(() => { if (p.gesture === g) p.gesture = null; }, rand(2500, 5000)); }
        if (p.name === 'Martin' && Math.random() < 0.25) { sfx('whistle', p.headPos(_v), 0.6); }
        // grazers wander to the buffet between questions
        if (b.persona && (p.spec.grazer) && Math.random() < 0.15 && !G.quiz?.questionLive) this.buffetTrip(b);
        if (p.name === 'Julie' && Math.random() < 0.2) this.buffetTrip(b, true);
        if (p.name === 'Jodie' && Math.random() < 0.3) this.chaseMason(b);
      }
    }
    this.babyUpdate(dt);
    this.pairings(dt);
  }
  // Paul doesn't sit still: he does the rounds between his own family, Martin and Debbie
  paulRounds(b, dt) {
    const p = b.p; if (b.state === 'asleep' || p.isDown()) return;
    b.visitT = (b.visitT ?? 20) - dt;
    if (b.visiting && G.quiz?.questionLive && b.state !== 'walk') { b.visiting = null; p.gesture = null; this.goHome(b); return; }
    if (b.state !== 'idle' || b.visitT > 0 || G.quiz?.questionLive) return;
    b.visitT = rand(30, 60);
    const options = [
      { who: 'Martin', g: 'argue', lines: ['Martin. Martin. Question four. Let\'s talk about it.', 'You\'re marking us harder, admit it.', 'Is there any more lager, Martin?'] },
      { who: 'Debbie', g: 'point', lines: ['Deb, back me up here.', 'Debbie! Tell him I\'m right.', 'You still talking about that horse?'] },
      { who: 'Karen', g: 'bellyPat', lines: ['Alright, love?', 'I\'m behaving, I\'m behaving.'] },
      { who: 'Charli', g: 'point', lines: ['Charli, what\'s the answer to the last one?', 'Stop filming me.'] },
      { who: 'Tommy', g: 'argue', lines: ['Tommy! Get your old man a drink.', 'We\'re winning this, son. I can feel it.', 'Listen. Next round, I\'m on the pen.'] },
    ];
    const o = pick(options); const t = o.who === 'Tommy' ? { pos: G.player.pos, yaw: 0 } : G.charByName[o.who]; if (!t) return;
    // stand an arm's length in front of them
    const fwd = new THREE.Vector3(Math.sin(t.yaw ?? 0), 0, Math.cos(t.yaw ?? 0)); const spot = t.pos.clone().addScaledVector(fwd, o.who === 'Tommy' ? -0.9 : 0.85); G.house.clampToNav(spot);
    b.visiting = o.who;
    this.goTo(b, spot, () => {
      b.state = 'scripted'; b.timer = rand(9, 15); p.base = 'stand'; const tp = o.who === 'Tommy' ? G.player.pos : t.pos; p.yaw = Math.atan2(tp.x - p.pos.x, tp.z - p.pos.z);
      p.gesture = o.g; p.gestureT = 0; p.say(pick(o.lines), { prio: 1 });
      const other = G.charByName[o.who]; if (other && !other.isDown() && Math.random() < 0.7) setTimeout(() => { const r = { Martin: ['Sit DOWN, Paul.', 'My house, my rules.'], Debbie: ['Paul, that\'s NOT funny.', 'Hahaha! Go away!'], Karen: ['Paul.'], Charli: ['Dad, sit DOWN.'] }[o.who]; if (r) other.say(pick(r), { prio: 1 }); }, 2500);
      setTimeout(() => { if (p.gesture === o.g) p.gesture = null; }, 4000);
    });
  }
  chooseLook(p, b) {
    let tgt = null; let best = 0;
    for (const o of G.chars) { if (o === p || o.state !== 'anim') continue; if (G.time < o.talkUntil) { const d = o.pos.distanceTo(p.pos); if (d < 7 && 8 - d > best) { best = 8 - d; tgt = o.headPos(_v.clone()); } } }
    const pl = G.player; const pd = pl.pos.distanceTo(p.pos);
    if (!tgt && pd < 3) tgt = pl.headPos(new THREE.Vector3());
    if (!tgt && G.quiz?.questionLive && G.house.tv) tgt = G.house.tv.center;
    p.lookTarget = tgt;
  }
  walk(b, dt) {
    const p = b.p; if (!b.path || !b.path.length) { b.state = 'idle'; p.base = 'stand'; p.speed = 0; if (b.then) { const f = b.then; b.then = null; f(); } return; }
    const tgt = b.path[0]; _v.copy(tgt).sub(p.pos); _v.y = 0; const d = _v.length();
    if (d < 0.15) { b.path.shift(); return; }
    const sp = b.speed * (p.mood === 'dazed' ? 0.6 : 1);
    _v.normalize(); p.pos.addScaledVector(_v, Math.min(d, sp * dt));
    const want = Math.atan2(_v.x, _v.z); let dy = want - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); p.yaw += dy * Math.min(1, dt * 8);
    p.speed = sp; p.base = sp > 2.4 ? 'run' : 'walk';
  }
  buffetTrip(b, julie) {
    const spots = G.house.spots.buffet; const s = pick(spots);
    this.goTo(b, s, () => {
      const p = b.p; p.base = 'stand'; p.gesture = 'tidy'; b.state = 'scripted'; b.timer = 3;
      // face the worktop
      p.yaw = s.z > 4 ? 0 : Math.PI / 2;
      setTimeout(() => {
        p.gesture = null;
        if (julie) { G.systems?.refillBuffet(); if (Math.random() < 0.5) p.bark('idle'); }
        else { const food = G.items.nearest(p.pos.clone().setY(0.95), 1.6, (i) => i.type.food && !i.held && i.id !== 'turkey'); if (food) { G.items.remove(food); p.mouthFull = G.time + 5; if (p.name === 'Paul' && food.id === 'pig_blanket' && (G.items.byType.pig_blanket.length === 0)) emit('lastPig', p); } }
        this.goHome(b);
      }, 2500);
    });
  }
  chaseMason(b) { const m = G.charByName.Mason; if (!m) return; if (m.pos.distanceTo(b.p.pos) < 3) return; b.p.say('Mason, NO.'); this.goTo(b, m.pos.clone(), () => { b.p.gesture = 'laugh'; setTimeout(() => { b.p.gesture = null; this.goHome(b); }, 2000); }, 2.0); emit('masonRescue'); }

  onRagdoll(p) { const b = this.brains.get(p); if (b) { b.state = 'down'; b.path = null; } this.reactToFall(p); }
  reactToFall(p) {
    // laugh wave from the gigglers nearby, gasps for the guest
    for (const n of ['Kirsty', 'Jodie', 'Debbie', 'Hollie', 'Charli']) {
      const o = G.charByName[n]; if (!o || o === p || o.isDown() || o.pos.distanceTo(p.world[0].p) > 7) continue;
      if (Math.random() < 0.55) setTimeout(() => { if (o.isDown()) return; o.gesture = n === 'Kirsty' || n === 'Jodie' ? 'laughDouble' : 'laugh'; o.gestureT = 0; if (Math.random() < 0.4) o.bark('laugh', { prio: 0 }); setTimeout(() => { if (o.gesture?.startsWith('laugh')) o.gesture = null; }, 3000); }, rand(300, 1200));
    }
    if (p.name === 'James') { const s = G.charByName.Sophie; const sb = this.brains.get(s); if (s && sb && !s.isDown()) setTimeout(() => this.goTo(sb, p.world[0].p.clone().setY(0), () => { s.say('Are you alright, babe? ...Hahaha!'); s.gesture = 'laugh'; setTimeout(() => { s.gesture = null; this.goHome(sb); }, 2500); }), 800); }
    if (p.name === 'Dan') { const h = G.charByName.Hollie; const hb = this.brains.get(h); if (h && hb && !h.isDown()) setTimeout(() => this.goTo(hb, p.world[0].p.clone().setY(0), () => { h.say('Dan! Hahaha!'); h.gesture = 'laugh'; setTimeout(() => { h.gesture = null; this.goHome(hb); }, 2500); }), 900); }
  }
  onRecover(p) {
    const b = this.brains.get(p); if (!b) return;
    b.state = 'scripted'; b.timer = 1.6; p.base = 'stand';
    p.onGotUp = () => {
      // personal get-ups
      switch (p.name) {
        case 'Martin': p.gesture = 'whistle'; sfx('whistle', p.headPos(_v), 0.8); p.say(pick(['As I meant to do.', 'Yellow card, Tommy.', 'Right. Quiet please.'])); break;
        case 'Gary': p.gesture = 'shrug'; p.say(pick(['Fair enough.', 'Dignity.', 'Was that necessary.'])); G.systems?.garyDignity(-5); break;
        case 'Debbie': p.gesture = 'laugh'; p.bark('thrown'); break;
        case 'Harry': p.gesture = 'shrug'; break;
        case 'James': p.say(pick(['Sorry. Sorry! My fault.', 'Sorry, was I in the way?'])); break;
        case 'Charli': p.say('Did anyone film that?'); break;
        case 'Dan': p.say(pick(['Ten from the Russian judge.', 'Nailed the landing.', 'I\'ll feel that on Monday.'])); emit('danJoke', p); break;
        case 'Julie': p.gesture = 'tidy'; p.say('Not on the oak!'); break;
        case 'Paul': p.bark('thrown'); break;
        default: if (Math.random() < 0.6) p.bark('thrown');
      }
      setTimeout(() => { if (p.gesture === 'whistle' || p.gesture === 'shrug' || p.gesture === 'laugh' || p.gesture === 'tidy') p.gesture = null; }, 1800);
      const room = roomAt(p.pos.x, p.pos.z);
      // thrown out into the garden: knock on the bay window behind the tree
      if (room === 'garden') { this.goTo(b, G.house.spots.bayOutside.pos, () => { b.state = 'knock'; b.timer = 8; p.base = 'stand'; p.yaw = 0; p.gesture = 'wave'; p.say(pick(['Let me in!', 'Tommy! It\'s freezing!', 'Very funny. Open the door.'])); emit('garden', p); }); return; }
      if (room === 'conservatory') { b.state = 'sulk'; b.timer = rand(8, 15); p.gesture = 'armsFolded'; if (p.name === 'Paul') emit('paulConservatory'); return; }
      // remembers being thrown: Paul sits further away after three throws
      if (p.name === 'Paul' && p.timesThrown >= 3 && !b.moved) { b.moved = true; const far = G.house.spots.sofaR[2]; b.home = { ...far, pos: far.pos.clone() }; p.say('I\'m sitting over here. Away from HIM.'); }
      this.goHome(b);
    };
  }
  // ---------- events used by systems ----------
  storm(name) { const p = G.charByName[name]; const b = this.brains.get(p); if (!p || !b) return; this.goTo(b, G.house.spots.stormOff.clone(), () => { b.state = 'storm'; p.base = 'stand'; p.gesture = 'coatOn'; p.yaw = 0; }); }
  calm(name) { const p = G.charByName[name]; const b = this.brains.get(p); if (!p || !b) return; b.state = 'idle'; p.gesture = null; this.goHome(b); }
  sleep(name, on) { const p = G.charByName[name]; const b = this.brains.get(p); if (!p || !b) return; if (on) { b.state = 'asleep'; p.base = 'sleep'; } else { b.state = 'idle'; p.base = b.home.stand ? 'stand' : 'sit'; } }
  release(name) { const p = G.charByName[name]; const b = this.brains.get(p); if (!b) return; b.state = 'idle'; this.goHome(b); }
  sendTo(name, pos, then, speed) { const p = G.charByName[name]; const b = this.brains.get(p); if (b && !p.isDown()) this.goTo(b, pos, then, speed); }
  pairings(dt) {
    if (G.frame % 30) return;
    const h = G.charByName.Hollie, d = G.charByName.Dan; if (h && d) { const apart = h.pos.distanceTo(d.pos) > 4; this.brains.get(h).quiet = this.brains.get(d).quiet = apart; }
  }

  // ---------- Harrison on Bradley's arm ----------
  babyUpdate(dt) {
    const hz = this.harrison, br = this.bradley; if (!hz || !br) return;
    const hb = this.brains.get(hz);
    if (hb.inBouncer) return;
    if (br.state === 'anim' && br.gesture !== 'holdBaby' && !hb.inBouncer) br.gesture = 'holdBaby';
    hb.state = 'carried';
    // sit Harrison in the crook of Bradley's left arm
    const arm = br.world[4]; const pos = _v.set(0.02, -(br.O[4].y - br.dims.wristY) * 0.55, 0.12).applyQuaternion(arm.q).add(arm.p);
    hz.base = 'sit'; hz.seatY = pos.y - 0.12; hz.pos.set(pos.x, 0, pos.z); hz.yaw = br.yaw + 0.6; hz.speed = 0;
    if (br.state !== 'anim') { // Bradley got knocked: Harrison goes into his bouncer, safe
      const bo = G.items.byType.bouncer?.[0]; hb.inBouncer = true; const bp = bo ? bo.body.translation() : { x: 4.6, z: -4.5 };
      hz.base = 'sit'; hz.seatY = 0.12; hz.teleport(bp.x, 0, bp.z, 0); hz.say('Eeee!');
      setTimeout(() => { hb.inBouncer = false; }, 30000);
    }
  }

  // ---------- Mason ----------
  mason(b, dt) {
    const m = b.p; this.chooseLook(m, b);
    if (b.state === 'walk') { this.walk(b, dt); if (b.carry) this.carryUpdate(b); return; }
    b.timer -= dt;
    if (b.timer > 0) return;
    const havoc = G.systems?.havocLevel?.() ?? 0;
    const roll = Math.random();
    if (G.systems?.asleepKids) { m.base = 'sleep'; b.timer = 5; return; }
    if (b.calmUntil && G.time < b.calmUntil) { m.base = 'sitFloor'; b.timer = 3; return; }
    if (roll < 0.25 + havoc * 0.1) { this.masonThrow(b); b.timer = rand(14, 30) / (1 + havoc); return; }
    if (roll < 0.4 + havoc * 0.1) { this.masonLap(b); b.timer = 4; return; }
    if (roll < 0.52) { this.masonSteal(b); b.timer = 4; return; }
    if (roll < 0.58) { this.goTo(b, G.house.spots.stairGate.clone(), () => { m.base = 'stand'; m.gesture = 'stretch'; m.say(pick(['Up!', 'Stuck!', 'Uh oh.'])); b.state = 'scripted'; b.timer = 6; emit('masonGate'); setTimeout(() => { m.gesture = null; this.goTo(b, b.home.pos, () => this.sitAtHome(b)); }, 6000); }, 1.6); b.timer = 10; return; }
    if (roll < 0.66) { m.say(pick(m.lines.idle), { prio: 0 }); }
    m.base = 'sitFloor'; b.timer = rand(5, 10);
  }
  masonLap(b) {
    const loop = [new THREE.Vector3(-2.4, 0, -2.2), new THREE.Vector3(0.1, 0, 2.8), new THREE.Vector3(2.8, 0, 2.0), new THREE.Vector3(3.8, 0, 4.2), new THREE.Vector3(1.7, 0, -2.4), new THREE.Vector3(4.3, 0, -4.6), new THREE.Vector3(-3.4, 0, -1.8)];
    b.p.say('Again!', { prio: 0 });
    let i = 0; const next = () => { if (i >= loop.length) { this.goTo(b, b.home.pos, () => this.sitAtHome(b)); return; } this.goTo(b, loop[i++], next, 2.3); };
    next();
    emit('masonLap');
    // Chip joins in
    G.dog?.follow(b.p, 10);
    // trail of toys
    if (Math.random() < 0.15) setTimeout(() => { G.items.spawn(pick(['duplo', 'toy_car']), b.p.pos.clone().setY(0.05), null); }, 2500);
  }
  masonThrow(b) {
    const m = b.p; m.base = 'stand'; m.gesture = 'cheer'; m.gestureT = 0;
    // target: whoever's talking, Paul, the TV, or you
    const talker = G.chars.find(c => !c.isPlayer && c !== m && G.time < c.talkUntil && !c.protected);
    const r = Math.random();
    let target, label;
    if (r < 0.3 && G.house.tv) { target = G.house.tv.center.clone(); label = 'tv'; }
    else if (r < 0.55 && G.charByName.Paul) { target = G.charByName.Paul.headPos(new THREE.Vector3()); label = 'Paul'; }
    else if (r < 0.75 && talker) { target = talker.headPos(new THREE.Vector3()); label = talker.name; }
    else { target = G.player.headPos(new THREE.Vector3()); label = 'you'; }
    const nearBuffet = m.pos.distanceTo(new THREE.Vector3(3.5, 0, 4.6)) < 2.5, nearTree = m.pos.distanceTo(G.house.spots.tree) < 2.5;
    const id = b.carry ? null : nearTree ? 'bauble' : nearBuffet ? 'sprout' : pick(['duplo', 'toy_car', 'duplo', 'cracker_toy', 'paper_ball']);
    setTimeout(() => {
      m.gesture = 'point';
      const start = m.handPos('R', new THREE.Vector3()).add(new THREE.Vector3(0, 0.15, 0));
      let inst;
      if (b.carry) { inst = b.carry; b.carry = null; inst.attached = null; inst.body.setBodyType(G.R.RigidBodyType.Dynamic, true); inst.body.setTranslation(start, true); }
      else if (id === 'bauble') { inst = G.tree?.baubles?.[0]; if (inst) { inst.attached = null; inst.onTree = false; G.tree.baubles.shift(); inst.body.setBodyType(G.R.RigidBodyType.Dynamic, true); inst.body.setTranslation(start, true); } }
      if (!inst) inst = G.items.spawn(id || 'duplo', start, null);
      if (!inst) return;
      // short, wobbly, somehow always on target
      const T = clamp(start.distanceTo(target) / 6, 0.35, 0.9);
      const v = target.clone().sub(start).divideScalar(T); v.y += 0.5 * 9.81 * T; v.x += rand(-0.3, 0.3); v.z += rand(-0.3, 0.3);
      inst.body.setLinvel(v, true); inst.thrownBy = 'Mason'; inst.thrownAt = label;
      sfx('whoosh', start, 0.4); m.say(pick(['DINOSAUR!', 'Wheee!', 'GARY BUM!', 'Catch!']), { prio: 0 });
      emit('kidThrow', 'Mason', inst, label);
      setTimeout(() => { m.gesture = null; m.base = 'sitFloor'; }, 600);
    }, 700);
  }
  masonSteal(b) {
    const choices = [...(G.items.byType.remote || []), ...(G.items.byType.pen || []), ...(G.items.byType.answer_sheet || []).filter(s => s !== G.quiz?.sheetItem || Math.random() < 0.3)].filter(i => !i.held && i.alive);
    const it = pick(choices); if (!it) return;
    const t = it.body.translation();
    this.goTo(b, new THREE.Vector3(t.x, 0, t.z), () => {
      if (it.held || !it.alive) { this.sitAtHome(b); return; }
      b.carry = it; it.body.setBodyType(G.R.RigidBodyType.KinematicPositionBased, true);
      it.attached = (outP, outQ) => { b.p.handPos('L', outP); outQ.identity(); return outP; };
      b.p.say(pick(['Mine!', 'Hehehe!']), { prio: 0 }); emit('masonSteals', it);
      const hides = [[G.house.spots.tree.clone().add(new THREE.Vector3(0.4, 0, 0.5)), 'in the tree'], [new THREE.Vector3(-2.9, 0, -1.2), 'under a sofa cushion'], [new THREE.Vector3(-2.2, 0, 4.8), 'in the bathroom'], [G.house.spots.chipBed.clone(), 'in Chip\'s bed'], [new THREE.Vector3(-4.8, 0, -5.0), 'behind the TV']];
      const [where, label] = pick(hides);
      this.goTo(b, where, () => {
        if (b.carry === it) { b.carry = null; it.attached = null; it.body.setBodyType(G.R.RigidBodyType.Dynamic, true); it.hiddenAt = label; const hp = where.clone().setY(label === 'in the tree' ? 1.0 : 0.15); if (label === 'under a sofa cushion') hp.set(-3.0, 0.5, -3.3); it.body.setTranslation(hp, true); emit('masonHid', it, label); }
        this.goTo(b, b.home.pos, () => this.sitAtHome(b));
      }, 2.0);
    }, 1.8);
  }
  carryUpdate(b) { }
}
