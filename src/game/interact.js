// What happens when you USE, EAT/DRINK or GIVE things, and the house's interactive spots.
import * as THREE from 'three';
import { G, emit, on, rand, pick } from '../core.js';
import { sfx, say, playMusic, stopMusic } from '../engine/audio.js';
import { DRINK_ORDERS } from '../chars/cast.js';

const _v = new THREE.Vector3();
const toast = (t, s) => G.ui?.toast(t, s);
const pos = (inst) => { const t = inst.body.translation(); return new THREE.Vector3(t.x, t.y, t.z); };
const JOKES = ["What do you call Santa's helpers? Subordinate clauses.", "Why did the turkey join the band? It had the drumsticks.", "What do snowmen eat for breakfast? Frosties.", "Who hides in the bakery at Christmas? A mince spy.", "What's Paul's favourite Christmas song? Last Christmas I Gave You My Opinion.", "How does Christmas Day end? With the letter Y.", "What did Adam say the day before Christmas? It's Christmas, Eve."];

export function initInteract() {
  G.interact = { useItem, useSpot, consume, give, talkTo };
}

function useItem(inst, player, handKey) {
  const t = inst.type; const p = pos(inst);
  switch (t.use) {
    case 'eat': case 'drink': return consume(inst, player);
    case 'remote': return emit('remote', inst);
    case 'sheet': return G.quiz?.openSheet(inst);
    case 'pen': if (!inst.state.tested) { inst.state.tested = true; inst.state.works = G.quiz ? G.quiz.penWorks(inst) : Math.random() < 0.2; } sfx('click', p, 0.5); toast(inst.state.works ? 'This pen works! Guard it with your life.' : 'Dead. Every biro in this house is dead.'); if (inst.state.works) emit('goodPen', inst); return;
    case 'cracker': if (G.minigames?.active?.id === 'crackerDuel' && G.minigames.active.cracker === inst) { G.minigames.active.pull += 0.35; return; } return pullCracker(inst, player);
    case 'crown': toast('Paper crown: put it on Chip (give it to him) or keep yours on all game!'); return;
    case 'tin': sfx('clink', p); { const n = inst.id === 'celeb_tin' ? 'celebration' : 'sweet'; for (let i = 0; i < 2; i++) { const s = G.items.spawn(n, p.clone().add(new THREE.Vector3(rand(-0.05, 0.05), 0.15, rand(-0.05, 0.05))), null); s?.body.setLinvel({ x: rand(-0.5, 0.5), y: 1.5, z: rand(-0.5, 0.5) }, true); } const left = G.systems?.sweetsLeft?.(); toast(left !== undefined && left < 8 ? 'Only Bounties and the coconut ones left...' : 'You dig through the tin.'); emit('sweetsOut'); } return;
    case 'present': return unwrap(inst);
    case 'shake': sfx('clink', p); inst.body.applyImpulse({ x: 0, y: 1.5, z: 0 }, true); toast('It\'s snowing in Essex! (in the globe)'); return;
    case 'squeak': sfx('squeak', p); emit('squeak', inst); return;
    case 'phone': case 'torch': return;
    case 'kettle': {
      sfx('kettle', p); toast('Kettle on... (leave a mug next to it)'); emit('kettleOn');
      setTimeout(() => { const kp = pos(inst); const mug = (G.items.byType.mug || []).filter(m => m.alive).sort((a, b) => pos(a).distanceTo(kp) - pos(b).distanceTo(kp))[0];
        if (mug && (pos(mug).distanceTo(kp) < 1.3 || mug.held)) { mug.drinkOverride = 'tea'; mug.state.open = true; mug.uses = 4; sfx('sip', kp); toast('Tea made in the mug by the kettle. Julie wants "just a small one".', 4); } else toast('Kettle\'s boiled, but there\'s no mug next to it.', 3); }, 4000);
      return; }
    case 'wave': sfx('whoosh', p); emit('towelWave', inst); return;
    case 'clean': emit('clean', inst, p); return;
    case 'spray': sfx('fizz', p); toast('Pssshhh. The toilet now smells of "Winter Berries".'); return;
    case 'hoover': sfx('zap', p); toast('VRRRRMMM. Chip hates the hoover.'); emit('hoover', p); return;
    case 'box': sfx('rip', p); toast('Christmas decorations from 1998. Some of them are still tangled.'); return;
    case 'parcel': return G.minigames?.unwrapParcel(inst);
    case 'boardgame': sfx('thud', p); toast('You open the board game. A 40-minute argument starts automatically.'); emit('boardgame'); return;
    case 'buzzer': sfx('beep', p); emit('buzzer', inst); return;
    case 'postit': emit('postit', inst); toast('You stick a Post-it on your head. Charli writes "PAUL" on it.'); return;
    case 'mic': emit('karaoke'); return;
    case 'pudding': emit('pudding', inst); return;
    case 'pour': sfx('sip', p); toast('You pour cream on the pudding. Lovely.'); return;
    case 'cone': toast('Nobody remembers how this got here. (2009, apparently.)'); return;
  }
  if (t.drink || t.food || inst.drinkOverride) return consume(inst, player);
  if (t.kind === 'glass' || inst.id === 'mug') return toast('It\'s empty. Fill it at the kitchen tap (USE the tap) or make a tea with the kettle.', 3);
  toast(t.name);
}

function consume(inst, player) {
  const t = inst.type; const p = pos(inst); const drink = inst.drinkOverride || t.drink;
  if (drink) {
    if (!inst.state.open) return openDrink(inst);
    if (inst.state.empty) return toast('It\'s empty.');
    sfx('sip', p); inst.uses = (inst.uses ?? t.uses ?? 5) - 1; player.stats.drinks++;
    const alcoholic = ['lager', 'cider', 'bitter', 'prosecco', 'wine', 'baileys', 'brandy'].includes(drink) && !G.settings.softDrinks;
    if (alcoholic) { player.drunk = Math.min(1, player.drunk + 0.07); if (player.drunk > 0.5) toast('Everything is slightly wobbly.'); }
    emit('drank', inst);
    if (inst.uses <= 0) { toast('Empty! Better find a coaster for it.'); inst.state.empty = true; }
    return;
  }
  if (t.food) {
    sfx('crunch', p); player.stats.eaten++; emit('ate', inst, player);
    if (t.food === 'mincePie') { G.systems && (G.systems.mincePiesEaten = (G.systems.mincePiesEaten || 0) + 1); if (G.systems.mincePiesEaten >= 5) { player.foodComa = 60; toast('Food coma. Your hands feel heavy.'); } }
    if (t.food === 'sprout') toast('A sprout. Why.');
    inst.uses = (inst.uses ?? t.uses ?? 1) - 1;
    if (inst.uses <= 0) G.items.remove(inst); else toast('Mmm. ' + t.name + '.');
  }
}
function openDrink(inst) {
  const t = inst.type; const p = pos(inst); inst.state.open = true;
  if (t.cork) {
    sfx('pop', p, 1);
    const cork = G.items.spawn('cork', p.clone().add(new THREE.Vector3(0, 0.2, 0)), null);
    // aim the cork at... Martin, mostly
    const target = G.charByName.Martin && Math.random() < 0.6 ? G.charByName.Martin.headPos(new THREE.Vector3()) : p.clone().add(new THREE.Vector3(rand(-2, 2), 2, rand(-2, 2)));
    const dir = target.sub(p).normalize();
    cork?.body.setLinvel({ x: dir.x * 14, y: dir.y * 14 + 2, z: dir.z * 14 }, true);
    if (cork) cork.isCork = true;
    emit('corkPopped', cork); toast('POP! The cork fires across the room.');
  } else if (['lager', 'cider'].includes(t.drink)) { sfx('pop', p, 0.4); sfx('fizz', p, 0.6); if (inst.state.shaken) { toast('It was shaken. It fizzes everywhere.'); emit('spill', p); } else toast('Tsssk. Can opened.'); }
  else { sfx('click', p, 0.6); toast('Opened.'); }
}
function pullCracker(inst, player) {
  const p = pos(inst);
  sfx('crack', p, 1);
  const win = Math.random() < 0.55;
  G.items.remove(inst);
  const crown = G.items.spawn('paper_crown', p.clone().add(new THREE.Vector3(0, 0.1, 0)), null); crown?.body.setLinvel({ x: rand(-1, 1), y: 2.5, z: rand(-1, 1) }, true);
  const toy = G.items.spawn('cracker_toy', p.clone().add(new THREE.Vector3(0.05, 0.1, 0)), null); toy?.body.setLinvel({ x: rand(-1.5, 1.5), y: 2, z: rand(-1.5, 1.5) }, true);
  const joke = pick(JOKES);
  G.ui?.toast((win ? 'You won the cracker! ' : 'The other end wins. ') + '"' + joke + '"', 6);
  const paul = G.charByName.Paul; if (paul && !paul.isDown() && paul.pos.distanceTo(p) < 5 && Math.random() < 0.6) setTimeout(() => { paul.say('Ha! No wait, I\'ve got a better one: ' + joke.split('?')[0] + '? ...I forgot the answer.'); paul.gesture = 'laugh'; setTimeout(() => paul.gesture = null, 2500); }, 1500);
  emit('crackerPulled', win);
}
function unwrap(inst) {
  const p = pos(inst); sfx('rip', p, 1);
  for (let i = 0; i < 3; i++) { const b = G.items.spawn('paper_ball', p.clone().add(new THREE.Vector3(rand(-0.1, 0.1), 0.1, rand(-0.1, 0.1))), null, { tint: inst.tint }); b?.body.setLinvel({ x: rand(-1, 1), y: 2, z: rand(-1, 1) }, true); }
  const gifts = [['Scratch card (from Paul, obviously)', 'postit'], ['Socks. Again.', 'slipper'], ['A "World\'s Best Uncle" mug', 'mug'], ['Satsumas', 'satsuma'], ['Chocolate orange (half eaten)', 'sweet'], ['A football', 'football'], ['A rubber duck', 'rubber_duck'], ['A snow globe', 'snow_globe'], ['A teddy', 'teddy']];
  const [label, id] = pick(gifts);
  G.items.remove(inst);
  G.items.spawn(id, p, null);
  G.ui?.toast('Secret Santa: ' + label + '. Who bought it? (Guess: point at them and press X / point for 1 second)', 6);
  emit('presentOpened', label);
}

function give(inst, person, player) {
  if (G.modes?.id === 'beer' && G.modes.running && (inst.type.drink || inst.drinkOverride)) { G.ui?.toast('Hand it over properly: touch the drink on them!', 2, { game: true }); return; } // Drinks Run: no handing over from across the room
  const t = inst.type; const name = person.name;
  const take = () => { G.items.remove(inst); };
  if (person.isDog) {
    if (t.food) { take(); emit('dogFed', inst); toast('Chip inhales it. Good boy.'); sfx('yap', person.pos); return; }
    if (inst.id === 'paper_crown') { take(); emit('dogCrown'); toast('Chip is wearing a paper crown. Best-dressed member of the family.'); return; }
    if (inst.id === 'dog_toy' || inst.id === 'tennis_ball') { emit('dogToy', inst); toast('Chip goes mad for it.'); return; }
    toast('Chip sniffs it and looks at you.'); return;
  }
  if (name === 'Mason') { if (t.toy || inst.id === 'remote' || inst.id === 'celeb_tin' || inst.id === 'quality_tin') { take(); emit('masonGiven', inst); return; } toast('Mason: "NO!"'); return; }
  if (name === 'Harrison') { take(); emit('harrisonGiven', inst); return; }
  // food & drink orders
  if (t.food === 'mincePie' && name === 'Paul') { take(); emit('paulMincePie'); return; }
  if (t.food === 'sausageRoll' && name === 'Debbie') { take(); emit('debbiePeace'); return; }
  if (t.drink || inst.drinkOverride) {
    const want = DRINK_ORDERS[name];
    let got = inst.drinkOverride || t.drink; if (got === 'wine') got = 'wine'; const ok = want === got || (want === 'pint' && (got === 'lager' || got === 'bitter')) || (want === 'small' && ['prosecco', 'wine', 'tea'].includes(got)) || (want === 'juice' && ['juice', 'squash'].includes(got));
    take(); emit('drinkServed', person, ok, inst);
    if (t.drink === 'baileys' && name === 'Debbie') emit('debbieBaileys');
    return;
  }
  if (t.food) { take(); person.mouthFull = G.time + 6; person.say(pick(['Ooh, lovely.', 'Ta.', 'Cheers, Tommy.', 'Don\'t mind if I do.'])); emit('fed', person, inst); return; }
  if (inst.id === 'paper_crown') { take(); emit('crowned', person); person.say('Ooh, a crown!'); return; }
  if (inst.id === 'remote' && name === 'Martin') { take(); emit('remoteReturned'); return; }
  if (inst.id === 'answer_sheet') { emit('sheetGiven', inst, person); return; }
  person.say(pick(['What am I meant to do with that?', 'Er... thanks?', 'Tommy, why?']));
}

function talkTo(target, player) {
  if (target.isDog) { emit('pet', target); return; }
  if (target.protected) { emit('protectedTouch', target); return; }
  emit('talk', target);
}

function useSpot(id, player) {
  const s = G.house.interact.find(x => x.id === id);
  switch (id) {
    case 'doorbell': sfx('ding', s.pos, 1); emit('doorbell'); return;
    case 'flush': sfx('flush', s.pos, 1); G.ui?.toast('You wiggle the handle. On the third go it flushes.'); return;
    case 'garageLight': sfx('click', s.pos, 0.6); G.ui?.toast('Click. Click. The garage light still doesn\'t work. (Phone torch: T / pinch your phone)'); emit('garageSwitch'); return;
    case 'heater': emit('heater'); return;
    case 'karaoke': emit('karaoke'); return;
    case 'tap': { sfx('fizz', s.pos, 0.5); const h = player.heldItem(); if (h && (h.type.kind === 'glass' || h.id === 'mug')) { h.drinkOverride = 'water'; h.state.open = true; h.uses = 4; G.ui?.toast(`Filled the ${h.type.name.toLowerCase()} with water.`, 2); } else G.ui?.toast('Tap on. Tap off. (Hold a glass or mug to fill it.)', 2); return; }
    case 'light': { const L = G.house.lights[s.room]; if (!L) return; sfx('click', s.pos, 0.6); L.userData.on = L.userData.on === false; for (const l of [L, G.house.lights[s.room + 'Spot']].filter(Boolean)) { if (L.userData.on === false) { l.userData.saved = l.intensity; l.intensity = 0; } else l.intensity = l.userData.saved ?? 4; } G.ui?.toast(`${s.room[0].toUpperCase() + s.room.slice(1)} light ${L.userData.on === false ? 'off' : 'on'}.`, 1.5); return; }
    case 'smokeAlarm': emit('towelWave'); return;
    case 'pc': emit('pcTouched'); return;
  }
}
