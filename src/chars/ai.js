// Family behaviour: seats, wandering to the buffet, personal idles, pairings (Hollie+Dan, Sophie+James),
// get-up reactions, sulking, Debbie's coat, Paul's nap, and the little ones' chaos (Mason & Harrison).
import * as THREE from 'three';
import { G, on, emit, rand, pick, clamp, shuffle } from '../core.js';
import { PERSONA } from './cast.js';
import { roomAt } from '../world/house.js';
import { sfx } from '../engine/audio.js';
import { Prop } from '../engine/geo.js';

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
    const plan = this.planHomes(); this.plan = plan;
    for (const p of G.chars) {
      const home = plan[p.name] || { pos: new THREE.Vector3(0, 0, -3), yaw: 0, stand: true };
      const b = { p, home, state: p.isPlayer ? 'player' : 'idle', path: null, nextIdle: rand(2, 8), persona: PERSONA[p.name] || {}, timer: 0, quiet: false, nextAct: rand(4, 14) };
      this.brains.set(p, b);
      p.brain = b;
      if (home.carried || p.isPlayer) continue;
      this.sitAtHome(b, true);
    }
    // Harrison rides on Bradley's arm
    // (Harrison is a toddler now: he toddles about after his dad instead of being carried)
    this.harrison = null; this.bradley = G.charByName.Bradley;
    // Gary is in the living room from the start, already in his outfit of the year
    // Tommy (when he isn't you) rolls his eyes at his dad
    on('say', (who) => { const t = G.charByName.Tommy; if (!who || who.name !== 'Paul' || !t || t.isPlayer || t.isDown() || Math.random() > 0.3 || G.time < (this._tommyT || 0)) return; this._tommyT = G.time + 20; setTimeout(() => { t.say(pick(t.lines.idle || ['Dad.']), { prio: 0 }); t.gesture = 'armsFolded'; setTimeout(() => t.gesture === 'armsFolded' && (t.gesture = null), 2500); }, 2200); });
    on('recover', (p) => this.onRecover(p));
    on('ragdoll', (p) => this.onRagdoll(p));
    G.updaters.push((dt) => this.update(dt));
  }
  // Where everyone starts: families/couples/teams stay together, but which room they're in is random each game.
  planHomes() {
    const H = G.house.spots; const V = (x, z) => new THREE.Vector3(x, 0, z);
    const face = (x, z, cx, cz) => Math.atan2(cx - x, cz - z);
    const zone = (name, cx, cz, seats, stands, w) => ({ name, w, slots: [...seats.map(s => ({ ...s, pos: s.pos.clone() })), ...stands.map(([x, z]) => ({ pos: V(x, z), yaw: face(x, z, cx, cz), stand: true }))] });
    const zones = [
      zone('living', -2.4, -3.2, [...H.sofaL, ...H.sofaR, H.sofaArmL], [[-3.6, -1.8], [-4.2, -4.6], [-0.9, -1.6], [-3.4, -5.4], [-2.6, -2.0]], 0.38),
      zone('kitchen', 3.9, 2.4, [], [[5.25, 2.85], [3.55, 1.25], [4.25, 1.3], [5.25, 4.7], [2.75, 1.3], [2.6, 3.4], [3.6, 3.9]], 0.26),
      zone('dining', 3.6, -3.6, [], [[4.1, -3.45], [4.1, -4.25], [4.25, -1.75], [2.2, -4.0], [2.4, -2.0]], 0.2),
      zone('conservatory', 3.1, -7.8, H.consSofa, [[2.0, -7.4], [3.9, -6.8]], 0.16),
    ];
    const plan = { Martin: { ...H.armchair, pos: H.armchair.pos.clone(), armchair: true }, };
    const groups = shuffle([['Paul', 'Karen', 'Charli', 'Tommy'], ['Julie', 'Sophie', 'James'], ['Hollie', 'Dan', 'Kirsty'], ['Bradley', 'Harrison'], ['Debbie', 'Gary'], ['Jodie', 'Harry', 'Mason']]);
    for (const grp of groups) {
      // pick a room (weighted), falling back to whichever still has space
      let order = zones.slice().sort((a, b) => (b.w * Math.random()) - (a.w * Math.random()));
      const z = order.find(z => z.slots.length >= grp.length) || order.sort((a, b) => b.slots.length - a.slots.length)[0];
      for (const n of grp) { if (!z.slots.length) break; const kid = n === 'Mason' || n === 'Harrison'; const k = kid ? z.slots.findIndex(s => s.stand) : 0; const s = z.slots.splice(Math.max(0, k), 1)[0];
        if (kid && z.name === 'living') { const f = H.floor[n === 'Mason' ? 2 : 1] || H.floor[0]; plan[n] = { ...f, pos: f.pos.clone(), floor: true }; continue; }
        plan[n] = { ...s, room: z.name }; }
    }
    return plan;
  }
  // a relative stops (or starts) being played by you
  setPlayer(p, on) { const b = this.brains.get(p); if (!b) return; if (on) { b.state = 'player'; b.path = null; } else { b.state = 'idle'; if (b.home.carried) return; this.sitAtHome(b, true); } }
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
      if (p.isPlayer || b.state === 'player' || p.state !== 'anim') continue;
      if (b.state === 'hidden' || b.state === 'carried') continue;
      if (p.name === 'Mason') { this.mason(b, dt); continue; }
      if (p.name === 'Harrison') { this.toddle(b, dt); continue; }
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
    this.activities(dt);
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
  // ---------- activities: people go and DO things ----------
  // Every so often an idle relative picks something to do that suits them and the room: Gary fetches a beer from the
  // fridge, James flicks a sprout at the cups, Charli takes a selfie, two of them pull a cracker, a toast breaks out…
  activities(dt) {
    this.actAcc = (this.actAcc || 0) + dt; if (G.frame % 15) return; const step = this.actAcc; this.actAcc = 0; const live = G.quiz?.questionLive;
    for (const [p, b] of this.brains) {
      if (p.isPlayer || b.state !== 'idle' || p.state !== 'anim' || p.protected || b.home.carried || p.team === 'host' && live) continue;
      b.nextAct = (b.nextAct ?? rand(5, 15)) - step * (live ? 0.3 : 1); if (b.nextAct > 0) continue; b.nextAct = rand(16, 38);
      const W = { Gary: { beer: 5, snack: 2, toast: 1 }, James: { sprout: 5, beer: 1, chat: 2 }, Charli: { selfie: 4, chat: 2, dance: 1 }, Paul: { snack: 3, beer: 2, chat: 2 }, Martin: { stretch: 1, toast: 1 },
        Julie: { warm: 2, look: 2, chat: 2 }, Karen: { toast: 2, chat: 3 }, Debbie: { dance: 3, toast: 2, chat: 2 }, Kirsty: { chat: 3, selfie: 2, cracker: 2 }, Sophie: { chat: 3, selfie: 2 }, Hollie: { selfie: 3, chat: 2 },
        Dan: { beer: 3, sprout: 2, cracker: 2 }, Harry: { beer: 3, sprout: 2 }, Jodie: { chat: 3, snack: 2 }, Bradley: { look: 2, chat: 2 }, Tommy: { chat: 3, beer: 2, snack: 1 } }[p.name] || { chat: 2, snack: 1 };
      const all = { ...{ snack: 1, warm: 1, pet: 1, cracker: 1, look: 1, stretch: 1, chat: 1 }, ...W }; let tot = 0; for (const k in all) tot += all[k]; let r = Math.random() * tot, act = 'chat'; for (const k in all) { r -= all[k]; if (r <= 0) { act = k; break; } }
      this['act_' + act]?.(b); if (b.state !== 'idle') break; // one new activity per tick
    }
  }
  hold(p, kind) { const P = new Prop(); if (kind === 'can') P.cyl(0.033, 0.033, 0.12, '#c41e1e').cyl(0.034, 0.034, 0.02, '#c8c8c8', 0, 0.06, 0); else if (kind === 'roll') P.cyl(0.022, 0.022, 0.1, '#c8862a', 0, 0, 0, 0, 0, Math.PI / 2, 10); else if (kind === 'phone') P.rbox(0.075, 0.15, 0.01, 0.01, '#111').box(0.065, 0.13, 0.002, '#4a8ad8', 0, 0, 0.006); else if (kind === 'glass') P.cyl(0.035, 0.03, 0.12, '#e8d8a0'); else if (kind === 'cracker') P.cyl(0.025, 0.025, 0.22, '#c1121f', 0, 0, 0, 0, 0, Math.PI / 2, 10).cyl(0.026, 0.026, 0.03, '#d4af37', 0, 0, 0, 0, 0, Math.PI / 2, 10);
    const m = new THREE.Mesh(P.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 })); const H = p.H, O = p.O, d = p.dims;
    return p.attach(m, 'lArmR', new THREE.Vector3(0, -(O[6].y - (d.wristY - 0.065 * H)), 0.03)); }
  drop(p, m) { if (m && m.parent) { m.parent.remove(m); p.accessories = p.accessories.filter(a => a !== m); } }
  busy(b, secs, then) { b.state = 'act'; b.timer = secs; clearTimeout(b.actT); b.actT = setTimeout(() => { if (b.state === 'act') { b.state = 'idle'; b.p.gesture = b.p.gesture === 'holdBaby' ? 'holdBaby' : null; then && then(); this.goHome(b); } }, secs * 1000); }
  ok(b) { return b.state === 'act' && !b.p.isDown(); }
  face(p, x, z) { p.yaw = Math.atan2(x - p.pos.x, z - p.pos.z); }
  act_beer(b) { const p = b.p; const garage = p.pos.x < -2.9; const spot = garage ? new THREE.Vector3(-4.6, 0, 1.0) : new THREE.Vector3(5.5, 0, 1.15);
    const door = G.items.hinged?.find(h => h.name === (garage ? 'Garage fridge' : 'Kitchen fridge'));
    this.goTo(b, spot, () => { this.face(p, spot.x, spot.z - 1); this.busy(b, 14); door?.body.wakeUp(); door?.body.applyTorqueImpulse({ x: 0, y: -5, z: 0 }, true); p.gesture = 'reach'; p.say(pick(['Who\'s had all the lager?', 'Ooh, there\'s one left.', 'Fridge raid.']), { prio: 0 });
      setTimeout(() => { if (!this.ok(b)) return; b.prop = this.hold(p, 'can'); sfx('click', p.handPos('R', _v), 0.5); door?.body.applyTorqueImpulse({ x: 0, y: 5, z: 0 }, true); p.gesture = 'sip'; }, 1500);
      setTimeout(() => this.drop(p, b.prop), 13000); }, 1.1); }
  act_snack(b) { const p = b.p; const s = pick(G.house.spots.buffet); this.goTo(b, s, () => { this.face(p, s.x + (s.x > 4.5 ? 1 : 0), s.z + (s.x > 4.5 ? 0 : 1)); this.busy(b, 9); p.gesture = 'reach';
    setTimeout(() => { if (!this.ok(b)) return; b.prop = this.hold(p, 'roll'); p.gesture = 'eat'; p.mouthFull = G.time + 6; p.say(pick(['Mmm.', 'These are lovely, Julie.', 'Just the one.']), { prio: 0 }); }, 1200); setTimeout(() => this.drop(p, b.prop), 8500); }); }
  act_sprout(b) { const p = b.p; const spot = new THREE.Vector3(4.05, 0, -3.0 - Math.random() * 0.6); this.goTo(b, spot, () => { this.face(p, 4.99, -3.9); this.busy(b, 6); p.gesture = 'throwOver'; p.gestureT = 0;
    setTimeout(() => { if (!this.ok(b)) return; const cups = (G.items.byType.pong_cup || []).filter(c => { const t = c.body.translation(); return t.x > 4.4 && t.z < -2.9 && t.z > -4.9 && t.y > 0.7; }); const tgt = cups.length ? new THREE.Vector3().copy(pick(cups).body.translation()).add(new THREE.Vector3(0, 0.06, 0)) : new THREE.Vector3(4.99, 0.85, -3.9);
      const start = p.handPos('R', new THREE.Vector3()).add(new THREE.Vector3(0, 0.1, 0)); const T = 0.55; const v = tgt.clone().add(new THREE.Vector3(rand(-0.06, 0.06), 0, rand(-0.06, 0.06))).sub(start).divideScalar(T); v.y += 0.5 * 9.81 * T;
      const sp = G.items.spawn('sprout', start, null); if (sp) { sp.body.setLinvel(v, true); sp.thrownBy = p.name; }
      setTimeout(() => { if (!sp?.alive) return; const q = sp.body.translation(); const inCup = cups.some(c => { const t = c.body.translation(); return Math.hypot(q.x - t.x, q.z - t.z) < 0.04 && q.y > t.y - 0.07; }); if (inCup) { p.gesture = 'cheer'; p.say(pick(['GET IN!', 'Sprout pong champion!', 'Did you see that?!']), { prio: 1 }); sfx('ding', q, 0.6); } else { p.gesture = 'facepalm'; p.say(pick(['Ahh!', 'So close.', 'The sprout\'s wonky.']), { prio: 0 }); } }, 1100); }, 520); }); }
  act_warm(b) { const p = b.p; const s = new THREE.Vector3(-4.5, 0, -3.05 + rand(-0.4, 0.4)); this.goTo(b, s, () => { this.face(p, -5.3, s.z); this.busy(b, 9); p.gesture = 'warm'; if (Math.random() < 0.5) p.say(pick(['Lovely fire, Martin.', 'Freezing out there.', 'Ooh, that\'s better.']), { prio: 0 }); }); }
  act_look(b) { const p = b.p; const w = pick([[3.0, 5.0, 0], [-2.47, -5.6, Math.PI], [-4.6, -5.4, Math.PI], [3.0, -6.4, Math.PI]]); this.goTo(b, new THREE.Vector3(w[0], 0, w[1]), () => { p.yaw = w[2]; this.busy(b, 7); p.gesture = 'hips'; if (Math.random() < 0.5) p.say(pick(['Is that snow?', 'Next door\'s lights are better than ours.', 'Steve\'s out in his dressing gown again.']), { prio: 0 }); }); }
  act_selfie(b) { const p = b.p; this.busy(b, 6); b.prop = this.hold(p, 'phone'); p.gesture = 'selfie'; p.say(pick(['Everyone say Boxing Day!', 'One for the group chat.', 'Hold on, my good side.']), { prio: 0 });
    setTimeout(() => { if (!this.ok(b)) return; const l = new THREE.PointLight('#ffffff', 6, 3); l.position.copy(p.handPos('R', new THREE.Vector3())); G.scene.add(l); sfx('click', l.position, 0.6); setTimeout(() => G.scene.remove(l), 120); for (const o of G.chars) if (o !== p && !o.isPlayer && o.state === 'anim' && o.pos.distanceTo(p.pos) < 2.5 && o.brain?.state === 'idle') { o.gesture = 'laugh'; setTimeout(() => o.gesture === 'laugh' && (o.gesture = null), 2000); } }, 2500);
    setTimeout(() => this.drop(p, b.prop), 5800); }
  act_dance(b) { const p = b.p; this.busy(b, 8); p.gesture = 'dance'; p.say(pick(['This is my song!', 'Come on, Martin, turn it up!', 'Shapes!']), { prio: 0 }); const o = this.partner(b, 3); if (o) { this.busy(o.brain, 8); o.gesture = 'dance'; } }
  act_stretch(b) { this.busy(b, 3); b.p.gesture = 'stretch'; if (Math.random() < 0.4) b.p.say('Ooh, my back.', { prio: 0 }); }
  act_pet(b) { const d = G.dog; if (!d || d.playerControlled || d.state === 'sleep') return this.act_chat(b); const p = b.p; this.goTo(b, d.pos.clone().add(new THREE.Vector3(0.55, 0, 0.35)), () => { this.face(p, d.pos.x, d.pos.z); this.busy(b, 5); p.gesture = 'pet'; d.wag = 3; p.say(pick(['Who\'s a good boy?', 'Chip! Hello!', 'He\'s after my sausage roll.']), { prio: 0 }); }); }
  partner(b, maxD = 4) { const p = b.p; let best = null, bd = maxD; for (const [o, ob] of this.brains) { if (o === p || o.isPlayer || o.protected || ob.state !== 'idle' || o.state !== 'anim' || ob.home.carried) continue; const d = o.pos.distanceTo(p.pos) - (o.team === p.team ? 1 : 0); if (d < bd) { bd = d; best = o; } } return best; }
  act_chat(b) { const p = b.p; const o = this.partner(b); if (!o) return; const mid = p.pos.clone().lerp(o.pos, 0.5); this.busy(b, 8); this.busy(o.brain, 8); this.face(p, o.pos.x, o.pos.z); this.face(o, p.pos.x, p.pos.z);
    const moves = ['laugh', 'argue', 'point', 'shrug', 'slapArm']; let k = 0; const tick = () => { if (!this.ok(b) || k > 3) return; const who = k % 2 ? o : p; who.gesture = pick(moves); const l = who.lines?.idle; if (l?.length && Math.random() < 0.6) who.say(pick(l), { prio: 0 }); k++; setTimeout(tick, 2000); }; tick(); }
  act_cracker(b) { const p = b.p; const o = this.partner(b, 3.5); if (!o) return this.act_chat(b); this.busy(b, 6); this.busy(o.brain, 6); this.face(p, o.pos.x, o.pos.z); this.face(o, p.pos.x, p.pos.z);
    b.prop = this.hold(p, 'cracker'); p.gesture = o.gesture = 'pull'; p.say(pick(['Cracker! Grab the end.', 'Pull it, then!']), { prio: 0 });
    setTimeout(() => { if (!this.ok(b)) return; this.drop(p, b.prop); sfx('crack', p.handPos('R', new THREE.Vector3()), 0.9); const win = Math.random() < 0.5 ? p : o; const c = G.items.spawn('paper_crown', win.headPos(new THREE.Vector3()).add(new THREE.Vector3(0, 0.15, 0)), null); c?.body.setLinvel({ x: 0, y: 1, z: 0 }, true);
      win.gesture = 'cheer'; (win === p ? o : p).gesture = 'facepalm'; win.say(pick(['Yes! What\'s the joke?', 'Mine! Paper hat time.', 'Why did the turkey join the band? Drumsticks!']), { prio: 1 }); }, 2600); }
  act_toast(b) { const p = b.p; const near = [...this.brains].filter(([o, ob]) => o !== p && !o.isPlayer && !o.protected && ob.state === 'idle' && o.state === 'anim' && o.pos.distanceTo(p.pos) < 3.2).slice(0, 4);
    this.busy(b, 4); b.prop = this.hold(p, 'glass'); p.gesture = 'toast'; p.say(pick(['Cheers, everyone!', 'To Martin\'s quiz! Ish.', 'Merry Christmas!']), { prio: 1 });
    for (const [o, ob] of near) { this.busy(ob, 4); o.gesture = 'toast'; setTimeout(() => o.say?.(pick(['Cheers!', 'Merry Christmas!', 'Cheers!']), { prio: 0 }), rand(400, 1200)); } setTimeout(() => this.drop(p, b.prop), 3900); }
  babyUpdate(dt) {
    const hz = this.harrison, br = this.bradley; if (!hz || !br || hz.isPlayer || br.isPlayer) { if (br && hz?.isPlayer && br.gesture === 'holdBaby') br.gesture = null; return; }
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

  // ---------- Harrison: toddles after his dad and the family, plonks himself down, jingles about ----------
  toddle(b, dt) {
    const h = b.p; this.chooseLook(h, b);
    if (b.state === 'walk') { this.walk(b, dt); return; }
    if (b.state === 'scripted') { b.timer -= dt; if (b.timer < 0) { b.state = 'idle'; h.gesture = null; } return; }
    b.timer -= dt; if (b.timer > 0) return;
    if (G.systems?.asleepKids) { h.base = 'sleep'; b.timer = 5; return; }
    const r = Math.random(); const fam = ['Bradley', 'Hollie', 'Dan', 'Kirsty', 'Mason'].map(n => G.charByName[n]).filter(o => o && o.state === 'anim');
    if (r < 0.4 && fam.length) { const o = Math.random() < 0.55 && G.charByName.Bradley?.state === 'anim' ? G.charByName.Bradley : pick(fam);
      const tgt = o.pos.clone().add(new THREE.Vector3(rand(-0.5, 0.5), 0, rand(-0.5, 0.5)));
      this.goTo(b, tgt, () => { h.base = 'stand'; this.face(h, o.pos.x, o.pos.z); h.gesture = pick(['wave', 'bounce', 'handUp']); if (Math.random() < 0.6) h.say(o.name === 'Bradley' ? pick(['Daddy!', 'Up! Up!', 'Daddy look!']) : pick(h.lines.idle), { prio: 0 }); b.state = 'scripted'; b.timer = 4; }, 0.7);
      b.timer = rand(8, 16); return; }
    if (r < 0.6) { h.base = 'sitFloor'; h.seatY = 0.02; h.gesture = null; b.timer = rand(6, 12); return; }
    if (r < 0.8) { h.base = 'stand'; h.gesture = pick(['dance', 'bounce', 'clap']); h.say(pick(['Jingle bells!', 'Eeeee!', 'Dance!']), { prio: 0 }); b.state = 'scripted'; b.timer = 4; return; }
    h.base = 'stand'; h.gesture = null; b.timer = rand(4, 9);
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
    if (Math.random() < 0.04) setTimeout(() => { G.items.spawn(pick(['duplo', 'toy_car']), b.p.pos.clone().setY(0.05), null); }, 2500);
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
