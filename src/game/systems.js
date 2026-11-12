// The living-room weather system: Sibling Banter Meter (fairy lights on the ceiling), Havoc Meter (kids + Chip),
// the Chaos Director (2–4 random family-quiz rows per round), TV damage, the buffet running out, drink orders,
// coasters, power cuts, 8pm fairy-light o'clock, and everything else that goes wrong.
import * as THREE from 'three';
import { G, on, emit, rand, pick, clamp, shuffle } from '../core.js';
import { sfx, say, playMusic, stopMusic, stopSpeech } from '../engine/audio.js';
import { roomAt, setDaylight } from '../world/house.js';
import { DRINK_ORDERS } from '../chars/cast.js';
import { initInteract } from './interact.js';
import { Screens } from './screens.js';

const _v = new THREE.Vector3();
export class Systems {
  constructor() {
    G.systems = this; initInteract(); new Screens();
    this.banterV = 15; this.banterReds = 0; this.havoc = 0; this.tvDamage = 0; this.hostPoints = 0; this.coasterWarnings = 0;
    this.dignity = 50; this.powerOut = false; this.paulCalmUsed = -1; this.nextRoast = G.time + rand(50, 80); this.roastCount = 0; this.nextJoke = G.time + rand(70, 110); this.nextOrder = G.time + rand(40, 70);
    this.orders = []; this.decals = []; this.events = []; this.noseprints = []; this.stats = { kidsThrows: 0, hidden: 0, tvHits: 0, ceasefires: 0, eyeRolls: 0, laughFits: 0, jokes: 0, coaster: 0, calmed: 0, chipStole: 0 };
    this.kitchenBeer = () => (G.items.byType.lager || []).filter(i => { const t = i.body.translation(); return t.x > 5.0 && t.x < 6.0 && t.z < 0.5; }).length;
    this.buildBanterLights();
    this.wire();
    G.updaters.push((dt) => this.update(dt));
    this.splatMat = new THREE.MeshBasicMaterial({ color: '#c8a070', transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  }
  // ---------------- Banter Meter ----------------
  buildBanterLights() {
    const n = 48; const g = new THREE.SphereGeometry(0.025, 6, 4); this.bLights = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: '#fff' }), n);
    const m = new THREE.Matrix4(); for (let i = 0; i < n; i++) { const t = i / (n - 1); const x = -3.3 + t * 6.6; const y = 2.42 - Math.sin(t * Math.PI * 6) * 0.04 - 0.03; m.makeTranslation(x, y, -6.9 + Math.sin(t * Math.PI) * 0.0); this.bLights.setMatrixAt(i, m); this.bLights.setColorAt(i, new THREE.Color('#0f0')); }
    // also a string along the side wall
    G.scene.add(this.bLights);
  }
  banter(delta, why) { this.banterV = clamp(this.banterV + delta, 0, 100); if (this.banterV >= 85 && !this.debbieOut) this.debbieStorms(); }
  banterLevel() { return this.banterV < 45 ? 'green' : this.banterV < 75 ? 'amber' : 'red'; }
  debbieStorms() {
    this.debbieOut = true; this.banterReds++; const d = G.charByName.Debbie; d?.bark('storm', { prio: 2 }); G.ai.storm('Debbie');
    G.ui?.toast('RED! Debbie has stormed into the kitchen with her coat on. Team Debbie can\'t answer until you bring her back — give her a sausage roll.', 7);
    if (this.banterReds >= 3) this.siblingShowdown();
  }
  siblingShowdown() {
    G.ui?.toast('SIBLING SHOWDOWN: Paul, Martin and Debbie are arguing about who Grandma liked best. Everyone picks a side.', 6);
    const lines = [['Paul', 'Grandma always said I was her favourite.'], ['Martin', 'She gave ME the good biscuit tin, Paul.'], ['Debbie', 'She left ME the brooch! Both of you, sit down!'], ['Karen', 'Paul.'], ['Julie', 'Martin, coaster.'], ['Gary', 'She liked me best, actually.']];
    lines.forEach(([n, l], i) => setTimeout(() => G.ai.say(n, l, 2), i * 2600));
  }
  // ---------------- Havoc Meter ----------------
  havocLevel() { return this.havoc < 25 ? 0 : this.havoc < 50 ? 1 : this.havoc < 80 ? 2 : 3; }
  // ---------------- wiring events ----------------
  wire() {
    on('itemImpact', (inst, other, sp) => this.impact(inst, other, sp));
    // Gang-Beasts pile-ups: a flying relative knocks over whoever they land on
    on('collision', (a, b) => {
      if (!a || !b || a.kind !== 'char' || b.kind !== 'char' || a.ref === b.ref) return;
      for (const [x, y] of [[a, b], [b, a]]) {
        const p = x.ref, q = y.ref; if (p.state !== 'ragdoll' || q.state !== 'anim' || q.protected || q.isPlayer || !p.byPlayer?.(4)) continue;
        const v = p.bodies[x.part].linvel(); const sp = Math.hypot(v.x, v.y, v.z); if (sp < 3.2) continue;
        q.playerHitT = p.playerHitT; q.knock(new THREE.Vector3(v.x, Math.abs(v.y) + 1, v.z).multiplyScalar(q.mass * 0.5), y.part ?? 1); sfx('oof', q.world[1].p, 0.8); emit('pileUp', p, q);
        if (Math.random() < 0.5) setTimeout(() => q.bark('thrown', { prio: 0 }), 400);
      }
    });
    on('splat', (inst, other, p) => this.splat(inst, other, p));
    on('smash', (inst) => { const t = inst.body.translation(); if (inst.type.kind === 'glass' || inst.id.includes('wine')) { G.ai.say('Julie', pick(['My glasses!', 'Not the good glasses!']), 1); this.banter(4); } if (inst.type.spill || inst.id === 'red_wine') this.spill(new THREE.Vector3(t.x, 0, t.z), '#5a0a1a'); });
    on('stuck', (inst) => { if (inst.id === 'brie') { G.ui?.toast('The Brie is stuck to the window.', 3); G.ai.say('Julie', 'Is that BRIE on my window?!', 1); } });
    on('ragdoll', (p) => { if (p.name === 'Paul' && G.time < this.roastUntil) { this.banter(-12); G.ui?.toast('Roast interrupted! The room laughs. Banter Meter drops.', 3); } });
    on('paulMincePie', () => { const p = G.charByName.Paul; p.mouthFull = G.time + 20; p.say('Mmmf! Mmmmf.', { prio: 1 }); this.banter(-15); this.stats.calmed++; G.ui?.toast('Mince pie deployed. Paul can\'t talk for 20 seconds.', 3); if (G.quiz) G.quiz.paulStopped = true; });
    on('debbieBaileys', () => { this.banter(-15); G.charByName.Debbie?.say('Ooh, go on then. HAHAHA!'); });
    on('debbiePeace', () => { if (this.debbieOut) { this.debbieOut = false; this.banterV = 40; G.ai.calm('Debbie'); G.charByName.Debbie?.say('Fine. I\'m only staying for the sausage rolls.'); G.ui?.toast('Debbie is back. Team Debbie can answer again.', 3); } else G.charByName.Debbie?.say('Ooh, ta, Tommy!'); });
    on('drinkServed', (p, ok) => { if (ok) { this.hostPoints++; this.banter(-6); p.say(pick(['Lovely, ta!', 'Good lad.', 'Perfect.', 'You\'re a star, Tommy.'])); G.ui?.toast(`Correct order! Host Points: ${this.hostPoints} (each cancels one wrong mark).`, 3); this.orders = this.orders.filter(o => o.p !== p); p.mouthFull = 0; } else p.say(pick(['That\'s not what I asked for.', 'I said a ' + DRINK_ORDERS[p.name] + ', Tommy.', 'This? Really?'])); });
    on('lastPig', (p) => { G.ui?.toast('The last pig in blanket has gone.', 3); G.ai.say('Martin', 'Who\'s had the last pig in blanket?!', 1); });
    on('handUp', () => {});
    on('accuse', () => {});
    on('facepalm', () => { this.stats.eyeRolls++; G.ui?.toast('Eye-roll logged (' + this.stats.eyeRolls + ').', 2); });
    on('coverEars', () => { const p = G.charByName.Paul; if (p && G.time < p.talkUntil) { stopSpeech(); p.talkUntil = 0; G.ui?.toast('Muted. Paul stops mid-story.', 2); this.banter(-5); } else G.ui?.toast('Muted for 3 seconds. Bliss.', 2); });
    on('clap', () => { if (G.minigames?.waitingClap) G.minigames.clapStart(); else { const p = G.charByName.Paul; if (p && G.time - p.talkUntil < 4) { p.say('Thank you, thank you. I\'m here all night.'); } sfx('slap'); } });
    on('protectedTouch', (c) => { if (c?.name === 'Mason') { c.say(pick(['No!', 'Hehehe!', 'Again!'])); G.ui?.toast('You can\'t grab Mason. He giggles and runs off.', 2); } else if (c?.name === 'Harrison') { this.harrisonLaugh(); } });
    on('masonGiven', (inst) => { const m = G.charByName.Mason; m.brain.calmUntil = G.time + 30; m.say('Thank you!'); if (inst.id === 'remote') { this.cbeebiesEvent(); } if (inst.id === 'celeb_tin' || inst.id === 'quality_tin') { this.havoc = Math.max(this.havoc, 60); G.ui?.toast('You gave Mason the sweets. Havoc Meter: WILD.', 4); G.ai.say('Julie', 'Who gave him the Celebrations?!', 1); } else G.ui?.toast('Mason is happy. He stops throwing for 30 seconds.', 3); this.havoc = Math.max(0, this.havoc - 10); });
    on('harrisonGiven', (inst) => { this.harrisonLaugh(); });
    on('protectedHit', (who) => this.protectorComes(who));
    on('dogFed', () => { this.havoc = Math.max(0, this.havoc - 8); });
    on('remote', (inst) => this.useRemote(inst));
    on('tvTouched', () => this.useRemote(null));
    on('remoteReturned', () => { G.charByName.Martin?.say('Thank you. NOBODY touches the remote.'); this.cbeebies = false; this.tvOff = false; });
    on('doorbell', () => this.doorbell());
    on('heater', () => { this.heaterOn = !this.heaterOn; sfx('click'); G.ui?.toast(this.heaterOn ? 'Heater on. It hums ominously.' : 'Heater off.', 2); if (this.heaterOn && this.kettleOn) this.powerCut(); });
    on('kettleOn', () => { this.kettleOn = true; setTimeout(() => this.kettleOn = false, 60000); if (this.heaterOn) this.powerCut(); G.ai.say('Julie', 'Ooh, if you\'re making one...', 0); });
    on('towelWave', () => { if (this.smokeAlarm) { this.smokeAlarm = false; G.ui?.toast('You wave the tea towel. The smoke alarm stops. Hero.', 3); } });
    on('pudding', (inst) => this.puddingFire(inst));
    on('clean', (inst, p) => { const d = this.decals.find(d => d.mesh.position.distanceTo(p.clone().setY(d.mesh.position.y)) < 0.8); if (d) { G.scene.remove(d.mesh); this.decals.splice(this.decals.indexOf(d), 1); sfx('rip', p, 0.4); G.ui?.toast(d.wine ? 'Red wine cleaned up before Julie saw. Phew.' : 'Cleaned.', 2); } else G.ui?.toast('Nothing to clean here.', 1.5); });
    on('pcTouched', () => { if (this.pcBlue) { this.pcBlue = false; G.ui?.toast('You turn it off and on again. It works. Dan is furious you stole his move.', 3); } else G.ui?.toast('The PC is running Martin\'s scores spreadsheet. It\'s 2 points out.'); });
    on('karaoke', () => { G.ai.say('Paul', 'Is that the karaoke? I\'ll do my one!', 1); playMusic('jingle', false, 0.3); setTimeout(() => G.charByName.Paul?.say('Jingle bells, Martin smells...'), 1200); setTimeout(() => G.charByName.Debbie?.say('Every YEAR!'), 4000); });
    on('boardgame', () => { setTimeout(() => G.ai.say('Paul', 'I\'m the boot. I\'m ALWAYS the boot.', 1), 800); setTimeout(() => G.ai.say('Martin', 'You can\'t buy hotels on the first lap, Paul.', 1), 3500); setTimeout(() => G.ai.say('Karen', 'Paul.', 2), 6500); });
    on('chipStole', () => { this.stats.chipStole++; });
    on('chipTV', () => { this.noseprints.push([rand(150, 850), rand(300, 500)]); if (this.noseprints.length > 6) this.noseprints.shift(); G.ai.say('Martin', 'CHIP! Off the telly!', 1); const r = G.items.byType.remote?.[0]; if (r && Math.random() < 0.5) { r.body.wakeUp(); r.body.applyImpulse({ x: 0.02, y: 0.03, z: 0.02 }, true); } });
    on('chipVsGary', () => G.ai.say('Gary', 'It\'s me, Chip. It\'s Gary.', 0));
    on('masonHid', (it, where) => { this.stats.hidden++; G.ui?.toast(`Mason has hidden the ${it.type.name.toLowerCase()} ${where}.`, 3); });
    on('kidThrow', (who, inst, at) => { this.stats.kidsThrows++; });
    on('treeFellUnused', () => { G.ai.say('Julie', 'THE TREE! Who\'s knocked my tree over?!', 2); this.banter(10); G.ui?.toast('The tree is down. Tree Rescue: stand it back up and re-hang the baubles before Julie sees!', 5); G.dog?.goTo(G.tree.group.position.clone(), 3); });
    on('treeUp', () => { G.ui?.toast('Tree back up! Re-hang the baubles by placing them on it. Put the angel back on top for a bonus.', 4); if (G.quiz) G.quiz.bonus[G.myTeam || 'paul'] += 1; });
    on('baubleHung', () => { if (G.tree.star?.onTree === false) {} });
    on('caught', () => {});
    on('heistCaught', () => this.banter(15));
    on('danJoke', () => this.laughWave(G.charByName.Dan));
    on('twoHandLift', (p) => G.ui?.toast(`Two-hand lift! ${p.name} is off the ground.`, 2));
    on('needTwoHands', (p) => G.ui?.toast(`${p.name} is a heavy lift. Use BOTH hands!`, 2));
    on('lockedDoor', () => G.ui?.toast('It\'s locked. Mason and Chip are giggling on the other side.', 3));
    on('pet', () => {});
    on('garden', (p) => { if (G.dog) G.dog.bark(3); });
    on('paulConservatory', () => { if (G.quiz) { G.quiz.bonus[G.myTeam || 'paul'] -= 2; G.ui?.toast('Paul thrown into the conservatory: works, but -2 points for unsportsmanlike conduct.', 4); } this.banter(-25); });
    on('crackerPulled', () => { this.havoc += 2; });
    on('sweetsOut', () => { this.havoc += 3; });
    on('roundStart', (r) => this.onRoundStart(r));
    on('roundEnd', (r) => this.onRoundEnd(r));
    on('grabPerson', (p) => { if (p.name === 'Martin' && G.quiz?.questionLive) G.ui?.toast('You\'ve picked up the quizmaster mid-question. Bold.', 2); if (p.name === 'Gary') this.garyThrownCheck(p); });
    on('thrown', (h) => { if (h.kind === 'char') { if (h.ref.name === 'Gary') this.garyThrownCheck(h.ref, true); if (h.ref.name === 'Paul' && G.quiz) G.quiz.paulStopped = true; } if (h.kind === 'item' && h.ref.id === 'cushion') h.ref.thrownByPlayer = G.time; if (h.kind === 'item') h.ref.playerT = G.time; if (h.kind === 'char') h.ref.playerHitT = G.time; });
    on('punched', (p) => { if (p.name === 'Paul' && G.quiz) G.quiz.paulStopped = true; });
    on('shoved', (p) => { if (p.name === 'Paul' && G.quiz) G.quiz.paulStopped = true; });
    on('outfitRevealed', (o) => { const L = { fairy: ['Gary', 'Every tree needs a fairy, Martin.'], minion: ['Gary', 'Banana. That\'s all I\'m saying.'], smurf: ['Paul', 'Papa Smurf! Where\'s the rest of the village?'], mankini: ['Julie', 'Gary, it\'s December!'] }[o.id]; if (L) setTimeout(() => G.ai.say(L[0], L[1], 1), 2500); if (o.id === 'trex') G.ui?.toast('Gary can\'t hold a pen in the T-Rex. Team Debbie loses a writer.', 4); });
  }
  // ---------------- collisions → comedy ----------------
  impact(inst, other, sp) {
    if (!other) return;
    if (other.kind === 'static' && other.tag === 'tv') { this.tvHit(inst); return; }
    if (other.kind === 'char') {
      const p = other.ref; if (p.isPlayer || p.protected) { if (p.protected) this.deflect(inst, p); return; }
      // bonk! light things make people stumble, big things knock them over
      const m = inst.type.mass; const energy = m * sp * sp;
      if (other.part === 2) { sfx('boff', p.headPos(_v), 0.5); p.setMood('shock', 1.5); }
      if (inst.id === 'cushion' || inst.id === 'paper_ball') { if (p.name === 'Paul') { this.banter(-10); if (G.quiz) G.quiz.paulStopped = true; if (G.time < this.roastUntil) G.ui?.toast('Cushion to the face mid-roast! The room laughs.', 3); this.laughWave(p); } if (this.paulAsleep && p.name === 'Paul') this.wakePaul(); }
      const yours = inst.held || G.time - (inst.playerT ?? -99) < 4;
      if (yours && energy > 25 && p.state === 'anim') { p.playerHitT = G.time; p.knock(new THREE.Vector3().copy(inst.body.linvel()).multiplyScalar(m * 0.8), other.part ?? 1); }
      else if (energy > 3 && Math.random() < 0.5) p.bark('thrown', { prio: 0 });
      if (inst.isCork) { emit('corkHit', p); p.say('OW! Who did that?!'); }
      if (inst.thrownBy === 'Mason' && p.name === 'Paul') { G.ui?.toast('Mason hits Paul. Again.', 2); p.say(pick(['Mason!', 'VAR! That\'s the fourth time!'])); }
      if (p.name === 'Paul' && this.paulAsleep) this.wakePaul();
    }
    if (other.kind === 'static' && other.tag === 'glass' && inst.type.mass > 1) sfx('thud', inst.body.translation(), 0.6);
  }
  deflect(inst, kid) { // anything thrown near the little ones bounces gently away
    const v = inst.body.linvel(); inst.body.setLinvel({ x: -v.x * 0.3, y: Math.abs(v.y) * 0.3 + 0.5, z: -v.z * 0.3 }, true);
    if (kid.name === 'Mason') { kid.say(pick(['Again!', 'Hehehe!']), { prio: 0 }); }
  }
  tvHit(inst) {
    this.tvDamage++; this.stats.tvHits++; sfx('crack', G.house.tv.center, 0.8);
    if (inst.id === 'remote') { this.tvOff = !this.tvOff; }
    if (inst.id === 'bauble') { this.tvGlitch = G.time + 5; }
    if (inst.id === 'paper_crown') { this.tvCovered = true; setTimeout(() => this.tvCovered = false, 15000); }
    if (this.tvDamage === 5) G.ui?.toast('TV damage 5: there\'s a crack sticker on the telly now.', 3);
    if (this.tvDamage === 10) { G.ui?.toast('TV damage 10: the telly is wobbling on its stand.', 3); G.ai.say('Martin', 'My TELLY!', 2); }
    if (this.tvDamage === 15) { this.tvOff = true; G.ai.say('Martin', 'Right. That\'s it. I\'m unplugging it. I\'ll read the pictures off my phone.', 2); }
    emit('tvHit', inst); G.ai.say('Martin', pick(['Not the telly!', 'Who threw that at my TV?!', 'MASON!']), 1);
  }
  splat(inst, other, p) {
    this.addDecal(new THREE.Vector3(p.x, 0, p.z), inst.id === 'trifle' ? '#f0d0a0' : inst.id === 'coleslaw' ? '#f0ecd0' : '#d8c890', 0.3 + inst.type.mass * 0.1);
    if (inst.id === 'trifle' && !this.trifleDown) { this.trifleDown = true; inst.uses = 0; stopSpeech(); G.ui?.toast('The trifle is on the floor. The house goes silent.', 5); emit('trifleDown', new THREE.Vector3(p.x, 0.5, p.z)); setTimeout(() => G.ai.say('Julie', 'Who. Has. Touched. My. Trifle.', 2), 1800); this.banter(15); G.dog?.goTo(new THREE.Vector3(p.x, 0, p.z), 3.5, () => { G.dog.state = 'sit'; G.dog.timer = 10; G.ui?.toast('Chip is already eating it.', 3); }); }
    if (other?.kind === 'char' && !other.ref.protected) other.ref.say(pick(['Urgh!', 'It\'s in my hair!', 'TOMMY!']), { prio: 0 });
  }
  addDecal(pos, color, r) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 16), this.splatMat.clone()); m.material.color.set(color); m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.012 + this.decals.length * 0.0003, pos.z); G.scene.add(m);
    this.decals.push({ mesh: m, t: G.time, wine: color === '#5a0a1a', pos: pos.clone() }); if (this.decals.length > 30) { const d = this.decals.shift(); G.scene.remove(d.mesh); }
  }
  spill(pos, color = '#5a0a1a') { this.addDecal(pos, color, 0.35); const d = this.decals[this.decals.length - 1]; if (color === '#5a0a1a') { G.ui?.toast('Red wine on the oak! Grab the kitchen roll (by the sink) and clean it before Julie sees!', 5); setTimeout(() => { if (this.decals.includes(d)) { G.ai.say('Julie', 'Is that RED WINE on my OAK FLOOR?!', 2); this.banter(12); } }, 30000); } }
  laughWave(src) {
    this.stats.laughFits++; this.banter(-8);
    const order = ['Hollie', 'Kirsty', 'Jodie', 'Debbie', 'Charli', 'Karen', 'Sophie'];
    order.forEach((n, i) => { const o = G.charByName[n]; if (!o || o.isDown() || (src && o.pos.distanceTo(src.pos) > 8)) return; setTimeout(() => { o.gesture = n === 'Kirsty' || n === 'Jodie' ? 'laughDouble' : 'laugh'; o.gestureT = 0; if (i < 2) o.bark('laugh', { prio: 0 }); setTimeout(() => { if (o.gesture?.startsWith('laugh')) o.gesture = null; }, 3500); }, 400 + i * 350); });
  }
  // Hit Chip, Mason or Harrison and their grown-up comes for you: a big red warning, they run over and flatten you.
  protectorComes(who) {
    if (!who || G.time < (this.protectT || 0)) return; const me = G.me;
    const little = (c) => c && (c === G.dog || c.isDog || c.name === 'Mason' || c.name === 'Harrison');
    if (little(me) && little(who)) return; // Chip, Mason and Harrison squabbling among themselves: nobody comes
    const map = who.isDog || who === G.dog ? { title: 'DON\'T HIT THE DOG!', guard: ['Martin', 'Julie'], icon: '🐶' } : who.name === 'Mason' ? { title: 'DON\'T HIT MASON!', guard: ['Harry', 'Jodie'], icon: '💙' } : who.name === 'Harrison' ? { title: 'DON\'T HIT HARRISON!', guard: ['Bradley', 'Hollie'], icon: '🧝' } : null;
    if (!map) return;
    const g = map.guard.map(n => G.charByName[n]).find(c => c && !c.isPlayer && c !== me && c.state === 'anim'); if (!g || !g.brain) return;
    this.protectT = G.time + 12;
    if (who.isDog || who === G.dog) { who.state = 'sit'; who.timer = 3; sfx('whine', who.pos, 0.8); } else { who.say?.('WAAAH!', { prio: 2 }); who.setMood?.('shock', 2); }
    sfx('drum', null, 0.8);
    g.say(pick([`Oi! ${G.me?.name || 'You'}!`, 'RIGHT. That\'s it.', 'Did you just…?!', 'Come here, you!']), { prio: 2 }); g.setMood?.('angry', 8);
    // first the warning (they stop and glare at you), and only once it's gone do they come for you
    const b = g.brain; b.state = 'scripted'; b.timer = 99; b.path = null; g.base = 'stand'; g.gesture = 'point'; g.lookTarget = G.player.headPos(new THREE.Vector3());
    const kid = who.isDog || who === G.dog ? 'CHIP' : who.name.toUpperCase();
    const warned = G.popup?.banner({ kicker: '⚠️ WARNING ⚠️', title: `${g.name.toUpperCase()} SAID DON'T HIT ${kid}!`, sub: `${g.name} is coming to get you…`, icon: map.icon, secs: 2.8 }) || Promise.resolve();
    const why = who.isDog || who === G.dog ? 'That\'s what you get for hitting the dog.' : who.name === 'Mason' ? 'Nobody touches Mason on Harry\'s watch.' : 'Bradley does not mess about where Harrison\'s concerned.';
    let t0 = 0, lastPath = -9;
    const chase = (dt) => {
      if (b.state !== 'chase' && b.state !== 'walk' && b.state !== 'idle') return true; // knocked down or busy: give up
      if (g.state !== 'anim' || G.time - t0 > 18) { b.state = 'idle'; G.ai?.goHome(b); return true; }
      const pp = G.player.pos; const d = Math.hypot(pp.x - g.pos.x, pp.z - g.pos.z);
      if (d < 1.2) { // shove
        g.yaw = Math.atan2(pp.x - g.pos.x, pp.z - g.pos.z); g.base = 'stand'; g.gesture = 'argue'; g.gestureT = 0; b.state = 'scripted'; b.timer = 3; b.path = null;
        setTimeout(() => { g.gesture = 'point'; }, 350); G.player.knockDown(g.pos); G.fx?.hit?.(G.player.headPos(new THREE.Vector3()), 'punch', 1.2);
        setTimeout(() => G.popup?.banner({ kicker: 'WHAT JUST HAPPENED', title: `${g.name.toUpperCase()} FLATTENED YOU`, sub: why, icon: '💥', secs: 3, c1: '#3a3a4a', c2: '#14141c' }), 700);
        g.say(pick(['And STAY down.', who.isDog || who === G.dog ? 'Nobody touches the dog.' : 'Leave him alone!', 'Let that be a lesson.']), { prio: 2 });
        setTimeout(() => { g.gesture = null; if (b.state === 'scripted') { b.state = 'idle'; G.ai?.goHome(b); } }, 3200); return true; }
      if (G.time - lastPath > 0.35) { lastPath = G.time; G.ai?.goTo(b, new THREE.Vector3(pp.x, 0, pp.z), null, d > 4 ? 6.5 : 5.2); b.state = 'walk'; g.gesture = null; }
      return false;
    };
    const up = (dt) => { if (chase(dt)) { const k = G.updaters.indexOf(up); if (k >= 0) G.updaters.splice(k, 1); } };
    warned.then(() => { t0 = G.time; lastPath = -9; g.lookTarget = null; g.gesture = null; g.base = 'run'; b.state = 'chase'; G.updaters.push(up); });
  }
  harrisonLaugh() {
    const h = G.charByName.Harrison; if (!h) return; h.setMood('laugh', 3); h.say('Hehehehe!', { prio: 0 });
    this.stats.ceasefires++; this.ceasefireUntil = G.time + 10; this.banter(-20);
    G.ui?.toast('BABY CEASEFIRE: Harrison laughs and the whole room melts for 10 seconds.', 4);
    for (const c of G.chars) if (!c.protected && !c.isPlayer && c.state === 'anim' && Math.random() < 0.6) { c.setMood('laugh', 3); }
  }
  // ---------------- the TV remote ----------------
  useRemote(inst) {
    const m = G.charByName.Martin;
    if (this.tvOff && this.tvDamage < 15) { this.tvOff = false; G.ui?.toast('TV back on.'); return; }
    if (this.cbeebies) { this.cbeebies = false; G.ui?.toast('Back to the quiz channel.'); return; }
    this.loudTV = !this.loudTV; sfx('click');
    if (this.loudTV) { playMusic('wewish', true, 0.28); G.ui?.toast('You turn the telly up. It drowns Paul out... but Martin saw.', 3); this.banter(-10); m?.say(pick(m.lines.remote || ['Who\'s touched my remote?'])); }
    else { stopMusic(); G.ui?.toast('Telly volume back to normal.'); }
  }
  cbeebiesEvent() { this.cbeebies = true; G.ai.say('Martin', 'Mason\'s put kids\' telly on! Give me that remote!', 2); setTimeout(() => this.cbeebies = false, 25000); }
  doorbell() {
    G.dog?.bark(4, 'hallway'); G.ai.say('Martin', 'Who\'s that? Get the door, Tommy.', 1);
    setTimeout(() => { G.ui?.toast('It\'s Steve from next door. Martin makes him join Team Debbie. (He knows nothing.)', 5); G.ai.say('Debbie', 'Oh, hiya Steve! You\'re on our team, love.', 1); }, 3000);
  }
  powerCut() {
    if (this.powerOut) return; this.powerOut = true; sfx('zap', null, 1); stopMusic();
    const L = G.house.lights; this.savedLights = {}; for (const k in L) { this.savedLights[k] = L[k].intensity; if (k !== 'hemi' && k !== 'sun') L[k].intensity = 0; } L.hemi.intensity = 0.06;
    G.ui?.toast('THE FUSE HAS TRIPPED (kettle + conservatory heater). Quiz in the dark — phone torch: T / pinch your phone. The fuse box is in the garage.', 7);
    G.ai.say('Martin', 'Who\'s put the heater on with the kettle?! Everyone, phones out.', 2);
    setTimeout(() => this.restorePower(), 35000);
  }
  restorePower() { if (!this.powerOut) return; this.powerOut = false; const L = G.house.lights; for (const k in this.savedLights) L[k].intensity = this.savedLights[k]; this.heaterOn = false; setDaylight(G.house.daylight); G.ui?.toast('Power back on. Martin found the fuse box.', 3); }
  puddingFire(inst) {
    if (this.smokeAlarm) return; const p = inst.body.translation(); sfx('pop', p); G.ai.say('Paul', 'Stand back! Brandy time!', 1);
    // a little fire & smoke
    const fire = new THREE.PointLight('#ff8a20', 3, 3); fire.position.set(p.x, p.y + 0.2, p.z); G.scene.add(fire);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 8), new THREE.MeshBasicMaterial({ color: '#4aa0ff', transparent: true, opacity: 0.6 })); flame.position.set(p.x, p.y + 0.15, p.z); G.scene.add(flame);
    let t = 0; const tick = setInterval(() => { t += 0.1; flame.scale.y = 0.8 + Math.random() * 0.5; const tt = inst.body.translation(); flame.position.set(tt.x, tt.y + 0.15, tt.z); fire.position.copy(flame.position); if (t > 8) { clearInterval(tick); G.scene.remove(fire, flame); } }, 100);
    setTimeout(() => { this.smokeAlarm = true; G.ui?.toast('SMOKE ALARM! Wave a tea towel at it (grab the tea towel + USE near the kitchen ceiling alarm).', 6); G.ai.say('Julie', 'PAUL! The alarm!', 2); const beep = setInterval(() => { if (!this.smokeAlarm) return clearInterval(beep); sfx('alarm', G.house.interact.find(s => s.id === 'smokeAlarm').pos, 0.8); }, 1200); setTimeout(() => this.smokeAlarm = false, 45000); }, 3000);
  }
  garyThrownCheck(p, thrown) {
    const o = G.garyOutfit; if (!o) return;
    if (o.trousersFall && thrown && !this.garyTrousers) { this.garyTrousers = true; const s = G.items.spawn('santa_trousers', p.world[0].p.clone().add(new THREE.Vector3(0, 0.3, 0)), null); s?.body.setLinvel({ x: rand(-1, 1), y: 2, z: rand(-1, 1) }, true); emit('garyLostOutfit', p); G.ui?.toast('Gary\'s Santa trousers have come down.', 3); setTimeout(() => p.say('Fair enough.'), 1500); this.garyDignity(-20); }
    if (o.id === 'sumo' && thrown) { sfx('boing', p.world[0].p, 1); }
    if (o.id === 'mankini' && thrown) { setTimeout(() => sfx('slap', p.world[0].p, 1), 600); G.ai.say('Julie', 'Mason, cover your eyes!', 0); }
  }
  garyDignity(d) { this.dignity = clamp(this.dignity + d, 0, 100); }
  wakePaul() { if (!this.paulAsleep) return; this.paulAsleep = false; G.ai.sleep('Paul', false); G.charByName.Paul?.say('I wasn\'t asleep! I was resting my eyes. The answer\'s Spain.'); }
  sweetsLeft() { return (G.items.byType.celebration?.length || 0) + (G.items.byType.sweet?.length || 0); }
  refillBuffet() {
    if (G.quiz && G.quiz.round >= 4) { if (!this.noMore) { this.noMore = true; G.ai.say('Julie', 'That\'s it, there\'s no more.', 1); } return; }
    const want = { sausage_roll: [2.1, 5.4], mince_pie: [1.15, -4.0], pig_blanket: [4.1, 5.43], scotch_egg: [5.8, 0.85] };
    for (const id in want) { if ((G.items.byType[id]?.length || 0) < 3) { for (let i = 0; i < 3; i++) G.items.spawn(id, new THREE.Vector3(want[id][0] + rand(-0.1, 0.1), 0.93, want[id][1] + rand(-0.08, 0.08)), null, { surface: true }); } }
  }
  // ---------------- rounds & the Chaos Director ----------------
  onRoundStart(r) {
    this.havoc = Math.min(100, this.havoc + 12);
    const pool = ['corkPop', 'phoneCheat', 'pcBlue', 'paulOverRoast', 'weddingTakeover', 'jamesTest', 'wineSpill', 'deadPens', 'remoteMissing', 'masonSheets', 'chipZoomies', 'baubleBarrage', 'sippyStrike', 'channelChange', 'volume100', 'doorbell', 'beerRun', 'puddingFire', 'siriBetrayal', 'toiletTrip', 'harrisonCries', 'fuse', 'chipOnSheets'];
    const n = 2 + Math.floor(Math.random() * 3);
    const picks = shuffle(pool).slice(0, n);
    if (r === 2) picks.push('paulAsleep');
    this.cheater = null; this.weddingTakeover = false;
    picks.forEach((e, i) => setTimeout(() => this.chaos(e), 8000 + i * rand(16000, 26000)));
  }
  onRoundEnd(r) { this.deadPens = false; if (r === 1) this.refillBuffet(); }
  chaos(e) {
    if (G.modes?.quiet?.()) return;
    if (G.quiz?.phase === 'ceremony' || G.quiz?.phase === 'end') return;
    const T = (t, s = 4) => G.ui?.toast(t, s);
    switch (e) {
      case 'treeFalls': { const d = new THREE.Vector3(rand(-1, 1), 0, 1).normalize(); G.tree?.knock(d, 1.6); break; }
      case 'corkPop': { const pr = G.items.byType.prosecco?.[0]; if (pr && !pr.state.open) { G.ai.say('Hollie', 'Who wants Prosecco?', 1); setTimeout(() => { G.interact.consume(pr, G.player); }, 2500); } break; }
      case 'phoneCheat': { const c = pick(['Hollie', 'Kirsty', 'James', 'Sophie'].map(n => G.charByName[n]).filter(Boolean)); this.cheater = c; c.gesture = 'phone'; setTimeout(() => { if (this.cheater === c) { c.gesture = null; this.cheater = null; } }, 30000); T(`Is that a phone glowing under the table...? (Point at the cheater for 1 second / look + X)`, 5); break; }
      case 'pcBlue': this.pcBlue = true; T('The dining room PC has blue-screened. Scores lost. Everyone claims they were winning.', 4); setTimeout(() => { if (this.pcBlue) { G.ai.sendTo('Dan', G.house.spots.pcChair.clone().add(new THREE.Vector3(-0.35, 0, 0.3)), () => { G.charByName.Dan?.say('Have you tried turning it off and on again? ...There.'); this.pcBlue = false; G.ai.release('Dan'); }); } }, 15000); break;
      case 'paulOverRoast': this.roast(true); break;
      case 'weddingTakeover': this.weddingTakeover = true; G.ai.say('Sophie', pick(G.charByName.Sophie.lines.wedding), 1); setTimeout(() => G.ai.say('Karen', 'Ooh, ivory.', 0), 3000); setTimeout(() => G.ai.say('Julie', 'Chair covers, definitely.', 0), 5000); T('Wedding takeover: three people have stopped answering to talk about centrepieces.', 4); setTimeout(() => this.weddingTakeover = false, 40000); break;
      case 'jamesTest': G.ai.say('Martin', 'James. Fiancé test. What\'s Sophie\'s middle name?', 1); setTimeout(() => G.ai.say('James', 'Is this a real question? Soph, do I answer that?', 1), 3000); setTimeout(() => G.ai.say('Paul', 'He doesn\'t know! He doesn\'t know!', 1), 6000); break;
      case 'wineSpill': { const p = new THREE.Vector3(rand(-1.5, 1.5), 0, rand(-4.5, -2.5)); sfx('splat', p); this.spill(p); G.ai.say('Karen', 'Whoops.', 0); break; }
      case 'deadPens': this.deadPens = true; T('Every biro in the house is dead. Find the ONE good pen (grab pens + USE to test) to write answers.', 6); break;
      case 'remoteMissing': { const r = G.items.byType.remote?.[0]; if (r && !r.held) { r.body.setTranslation({ x: G.house.spots.tree.x + 0.3, y: 1.0, z: G.house.spots.tree.z + 0.35 }, true); T('Martin can\'t find the remote. Mason hid it in the tree.', 4); G.ai.say('Martin', 'Where\'s my remote? MASON.', 1); } break; }
      case 'masonSheets': G.ai.masonSteal(G.charByName.Mason.brain); break;
      case 'chipZoomies': G.dog?.zoomies(); this.banter(5); break;
      case 'baubleBarrage': for (let i = 0; i < 3; i++) setTimeout(() => G.ai.masonThrow(G.charByName.Mason.brain), i * 2500); break;
      case 'sippyStrike': this.harrisonThrow('sippy_cup', true); break;
      case 'channelChange': this.cbeebiesEvent(); break;
      case 'volume100': playMusic('jingle', false, 0.2); sfx('bark', G.dog?.pos); T('Mason sat on the remote: the TV is at volume 100. Chip howls along.', 4); break;
      case 'doorbell': sfx('ding', new THREE.Vector3(0.65, 1.3, 5.95), 1); this.doorbell(); break;
      case 'beerRun': for (const b of (G.items.byType.lager || []).filter(i => { const t = i.body.translation(); return t.x > 5.0 && t.x < 6.0 && t.z < 0.5; })) G.items.remove(b); G.ai.say('Martin', 'Fridge is out of beer. Tommy, garage. Crates by the freezer.', 1); T('BEER RUN: the kitchen fridge is empty. Fetch beer from the dark garage (through the under-stairs cupboard). Phone torch: T.', 6); break;
      case 'puddingFire': { const pu = G.items.byType.pudding?.[0]; if (pu) this.puddingFire(pu); break; }
      case 'siriBetrayal': say(null, 'Here\'s what I found on the web for: ' + (G.quiz?.cur?.q || 'Grand National winner'), { prio: 2 }); T('A phone just shouted the question out loud. Who was that?!', 3); this.cheater = pick([G.charByName.Kirsty, G.charByName.Hollie]); break;
      case 'toiletTrip': { const c = pick([G.charByName.James, G.charByName.Hollie, G.charByName.Kirsty]); if (c) { this.cheater = c; G.ai.sendTo(c.name, G.house.spots.toilet.pos, () => { c.brain.state = 'scripted'; c.brain.timer = 25; c.gesture = 'phone'; }); T(`${c.name} has gone to the loo for "five minutes" during the hard round. Follow them in?`, 5); } break; }
      case 'harrisonCries': { const h = G.charByName.Harrison; h?.say('WAAAAAH!', { prio: 2 }); G.ai.say('Bradley', 'I\'ll take him out for a bit.', 1); G.ai.sendTo('Bradley', new THREE.Vector3(0, 0, 3.5), () => { G.charByName.Bradley.brain.state = 'scripted'; G.charByName.Bradley.brain.timer = 20; }); T('Harrison cries. Bradley takes him out (with Team Debbie\'s only working pen).', 4); break; }
      case 'fuse': this.heaterOn = true; this.kettleOn = true; this.powerCut(); break;
      case 'chipOnSheets': { const s = G.items.byType.answer_sheet?.[1]; if (s && G.dog) { const t = s.body.translation(); G.dog.goTo(new THREE.Vector3(t.x, 0, t.z), 2, () => { G.dog.state = 'lie'; G.dog.timer = 20; T('Chip is lying on the answer sheets and won\'t move. Bribe him with a sausage roll.', 4); }); } break; }
      case 'paulAsleep': this.paulAsleep = true; G.ai.sleep('Paul', true); T('Paul has fallen asleep. Wake him with a cushion — or leave him; he answers in his sleep.', 5); break;
    }
    emit('chaos', e);
  }
  harrisonThrow(id, atTV) {
    const h = G.charByName.Harrison; if (!h) return; const start = h.handPos('R', new THREE.Vector3()).add(new THREE.Vector3(0, 0.1, 0));
    const tgt = atTV ? G.house.tv.center.clone() : pick(G.chars.filter(c => !c.protected && !c.isPlayer)).chestPos(new THREE.Vector3());
    const inst = G.items.spawn(id, start, null); if (!inst) return; const T = clamp(start.distanceTo(tgt) / 6, 0.4, 1.0); const v = tgt.clone().sub(start).divideScalar(T); v.y += 0.5 * 9.81 * T; inst.body.setLinvel(v, true); inst.thrownBy = 'Harrison';
    emit('kidThrow', 'Harrison', inst);
  }
  roast(tooFar) {
    const p = G.charByName.Paul; if (!p || p.isDown() || this.paulAsleep || G.time < (p.mouthFull || 0)) return;
    this.roastCount++; const far = tooFar || this.roastCount % 3 === 0;
    p.say(pick(p.lines.roast), { prio: 1 }); p.gesture = 'point'; setTimeout(() => p.gesture === 'point' && (p.gesture = null), 2500); this.roastUntil = G.time + 4;
    this.banter(far ? 30 : 6);
    setTimeout(() => { const m = G.charByName.Martin; if (m && !m.isDown()) { m.say(pick(m.lines.roast), { prio: 1 }); this.banter(10); } }, 4500);
    setTimeout(() => { const d = G.charByName.Debbie; if (!d || d.isDown() || this.debbieOut) return; if (this.banterV < 50) { d.gesture = 'laugh'; d.bark('laugh', { prio: 0 }); this.banter(-6); setTimeout(() => d.gesture = null, 2500); } else d.say(pick(['You two are unbelievable.', 'Can you two act your age for ONE round?', 'Paul, that\'s NOT funny.']), { prio: 1 }); }, 8500);
    if (far) setTimeout(() => G.ui?.toast('Paul went too far. Banter Meter spiking! (Mince pie, cushion, Baileys for Debbie, or ask Karen.)', 5), 1500);
  }
  askKaren() {
    const k = G.charByName.Karen; const r = G.quiz?.round ?? 0;
    if (this.paulCalmUsed === r) { G.ui?.toast('Karen has already done her "Paul." this round.'); return; }
    if (!k || k.isDown()) { G.ui?.toast('Karen is... on the floor.'); return; }
    this.paulCalmUsed = r; k.bark('warn', { prio: 2 }); this.banterV = 20; this.stats.calmed++; G.ui?.toast('"Paul." The room goes quiet. Banter Meter: green.', 3);
  }
  // ---------------- per frame ----------------
  update(dt) {
    const t = G.time;
    if (G.modes?.quiet?.()) { this.banterV = Math.max(0, this.banterV - dt * 0.15); this.tvGlitchOn = this.tvGlitch > t; return; } // the game modes: no roasts, chaos, kid throws, random orders or coaster nagging
    // Banter: Paul roasts every 60-90 s; Dan's jokes calm things
    if (t > this.nextRoast && G.quiz?.phase !== 'arrival') { this.nextRoast = t + rand(60, 90); this.roast(false); }
    if (t > this.nextJoke) { this.nextJoke = t + rand(80, 140); const d = G.charByName.Dan; if (d && !d.isDown() && !d.brain?.quiet) { d.say(pick(d.lines.joke), { prio: 1 }); this.stats.jokes++; setTimeout(() => this.laughWave(d), 2200); } }
    this.banterV = Math.max(0, this.banterV - dt * 0.15);
    if (this.ceasefireUntil > t) this.banterV = Math.max(0, this.banterV - dt * 5);
    // fairy lights show the meter
    if (G.frame % 5 === 0) { const c = new THREE.Color(); const n = this.bLights.count; const lvl = this.banterV / 100;
      for (let i = 0; i < n; i++) { const on = i / n <= lvl + 0.02; const col = lvl < 0.45 ? '#20ff40' : lvl < 0.75 ? '#ffb020' : '#ff2020'; c.set(this.powerOut ? '#111' : on ? col : '#303030').multiplyScalar(on ? 0.7 + 0.5 * Math.sin(t * 4 + i) : 1); this.bLights.setColorAt(i, c); }
      this.bLights.instanceColor.needsUpdate = true; }
    // Paul's nose flashes when he's annoyed
    const paul = G.charByName.Paul; if (paul?.noseLight) paul.noseLight.material.emissiveIntensity = this.banterV > 50 || t < paul.talkUntil ? (Math.sin(t * 10) > 0 ? 3 : 0.2) : 0.6;
    // Havoc rises with time & sugar; kids fall asleep late on
    this.havoc = clamp(this.havoc + dt * 0.05, 0, 100);
    if ((G.quiz?.round ?? 0) >= 4 && !this.asleepKids && Math.random() < 0.0005) { this.asleepKids = true; this.havoc = 10; G.ui?.toast('Mason has fallen asleep on the sofa. Havoc drops. (Until Paul laughs.)', 4); }
    // Harrison throws from the bouncer/Bradley's arm
    this.harrisonT = (this.harrisonT ?? rand(30, 60)) - dt * (1 + this.havocLevel() * 0.6); if (this.harrisonT < 0) { this.harrisonT = rand(70, 130); this.harrisonThrow(pick(['rusk', 'dummy', 'squeaky_toy', 'yorkshire', 'sippy_cup'])); }
    // drink orders
    if (t > this.nextOrder && G.quiz?.phase !== 'arrival') { this.nextOrder = t + rand(70, 120); const c = pick(G.chars.filter(c => !c.isPlayer && !c.protected && !c.isDown() && DRINK_ORDERS[c.name])); if (c) { const d = DRINK_ORDERS[c.name]; const what = { lager: 'a lager', bitter: 'a bitter', pint: 'a pint', prosecco: 'a Prosecco', wine: 'a wine', small: 'just a small one', juice: 'a juice' }[d]; c.say(`Tommy, get us ${what}, will you?`, { prio: 1 }); this.orders.push({ p: c, d, t }); G.ui?.toast(`Drink order: ${c.name} wants ${what}. (Grab it from a fridge, look at them, press USE.)`, 4); } }
    // ragdolls flung near the tree knock it over; against glass they "squash and slide"
    if (G.tree && G.frame % 3 === 0) for (const p of G.chars) { if (p.state !== 'ragdoll') continue; const hp = p.world[1].p; const tp = G.tree.group.position; const d = Math.hypot(hp.x - tp.x, hp.z - tp.z);
      if (d < 1.0 && !p._treeBump) { const v = p.bodies[1].linvel(); if (Math.hypot(v.x, v.z) > 1.5) { p._treeBump = true; setTimeout(() => p._treeBump = false, 3000); G.tree.knock(new THREE.Vector3(v.x, 0, v.z).normalize(), 1); G.ai.say('Julie', 'Mind my tree!', 1); } }
      if (!p._glass) { const near = (hp.z < -5.7 && hp.z > -7.25 && ((hp.x > -5.5 && hp.x < -3.6) || (hp.x > -3.9 && hp.x < -1.0 && hp.z < -6.6) || (hp.x > -1.2 && hp.x < 0.5))) || (Math.abs(hp.z + 9.39) < 0.35 && hp.x > 0.9 && hp.x < 5.56) || ((Math.abs(hp.x - 0.9) < 0.35 || Math.abs(hp.x - 5.56) < 0.35) && hp.z < -6.2 && hp.z > -9.4); if (near) { p._glass = true; emit('glassSquash', p); setTimeout(() => p._glass = false, 5000); } } }
    // coasters: drinks left on wooden furniture without a coaster
    if (G.frame % 120 === 0) this.coasterCheck();
    // power cut: torch-lit, TV off
    this.tvGlitchOn = this.tvGlitch > t;
  }
  coasterCheck() {
    const table = G.items.byType.coffee_table?.[0]; if (!table) return; const tt = table.body.translation();
    for (const it of G.items.instances) {
      if (!(it.type.drink || it.type.kind === 'glass') || it.held || !it.body.isSleeping()) continue;
      const p = it.body.translation(); if (Math.hypot(p.x - tt.x, p.z - tt.z) > 0.42 || p.y < 0.4 || p.y > 0.75) continue;
      if (it.coasterChecked) continue; it.coasterChecked = true;
      const hasCoaster = (G.items.byType.coaster || []).some(c => { const q = c.body.translation(); return Math.hypot(q.x - p.x, q.z - p.z) < 0.06; });
      if (!hasCoaster && it.releasedRecently !== undefined) { this.coasterWarnings++; this.stats.coaster++; G.ai.say('Julie', pick(G.charByName.Julie.lines.coaster), 2); if (this.coasterWarnings >= 5) { G.ui?.toast('Five Coaster Warnings. Julie confiscates your drink.', 4); G.items.remove(it); this.coasterWarnings = 0; } }
    }
  }
}
