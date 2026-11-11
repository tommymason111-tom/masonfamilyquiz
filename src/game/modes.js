// Game modes: pick one on the home screen. Each mode sets up the house, runs its own rules/timer/score,
// shows a live board on Martin's TV and a results screen with your personal best.
import * as THREE from 'three';
import { G, on, emit, rand, pick, clamp, shuffle } from '../core.js';
import { sfx, say } from '../engine/audio.js';
import { tvFrame, wrapText } from './screens.js';
import { loadStore, saveStore } from './settings.js';
import { DRINK_ORDERS } from '../chars/cast.js';

export const MODES = [
  { id: 'quiz', icon: '🏆', name: 'The Boxing Day Quiz', desc: 'The full night: 5 rounds, marking, disputes, mini-games and the Mason Cup.', tag: 'Classic' },
  { id: 'quick', icon: '⚡', name: 'Quick Quiz', desc: 'Two rounds, no mini-games, straight to the cup. About 10 minutes.', tag: '10 min' },
  { id: 'chaos', icon: '💥', name: 'Family Chaos', desc: 'Three minutes. Punch, kick, throw and pile up the relatives. Chain hits for a combo.', tag: '3:00 · score' },
  { id: 'fling', icon: '🚀', name: 'Fling the Family', desc: 'Ten throws. Every relative you launch gets a distance & style score out of 10.', tag: '10 throws' },
  { id: 'beer', icon: '🍺', name: 'Beer Run', desc: 'Everyone wants a drink NOW. Get the right one to the right person before they give up.', tag: '3:00 · orders' },
  { id: 'hide', icon: '🔍', name: 'Mason\'s Hide & Seek', desc: 'Mason has hidden six things all over the house. Find them before Martin notices.', tag: '4:00 · find 6' },
  { id: 'games', icon: '🎲', name: 'Games Room Marathon', desc: 'All five mini-games back to back: Sprout Pong, Crackers, Parcel, Celebrations, Gift Grab.', tag: '5 games' },
  { id: 'sandbox', icon: '🎄', name: 'Free Roam', desc: 'No quiz, no timer. Just the family, the house and 250 things to throw.', tag: 'Relax' },
];
export const modeById = (id) => MODES.find(m => m.id === id) || MODES[0];
export function selectedMode() {
  const q = new URLSearchParams(location.search).get('mode'); if (q && MODES.some(m => m.id === q)) return q;
  return loadStore('mode', 'quiz');
}

export class Modes {
  constructor() {
    G.modes = this; this.id = selectedMode(); this.def = modeById(this.id); this.score = 0; this.t = 0; this.limit = 0; this.running = false; this.combo = 1; this.comboT = 0; this.lines = [];
    on('started', () => this.start());
    G.updaters.push((dt) => this.update(dt));
    this.hud = document.getElementById('modeHud');
  }
  best() { return loadStore('best.' + this.id, null); }
  add(pts, why, pos) {
    if (!this.running) return; const p = Math.round(pts * (this.combo || 1)); this.score += p;
    this.lines.unshift(`+${p}  ${why}${this.combo > 1 ? `  (x${this.combo.toFixed(1)})` : ''}`); this.lines.length = Math.min(this.lines.length, 5);
    if (pos && G.fx) G.fx.score?.(pos, '+' + p);
    this.flash = G.time;
  }
  start() {
    this.id = selectedMode(); this.def = modeById(this.id); const q = G.quiz;
    if (this.id !== 'quiz' && this.id !== 'quick') { q.disabled = true; G.systems.nextRoast = Infinity; }
    if (this.id === 'quick') { q.lastRound = 1; q.qPer = 5; q.noMiniGames = true; }
    this.running = true; this.t = 0; const id = this.id;
    G.ui?.toast(`${this.def.icon} ${this.def.name}: ${this.def.desc}`, 7);
    if (id === 'quiz' || id === 'quick') { this.running = false; this.hudOff(); return; }
    if (id === 'chaos') this.chaosSetup();
    if (id === 'fling') this.flingSetup();
    if (id === 'beer') this.beerSetup();
    if (id === 'hide') this.hideSetup();
    if (id === 'games') this.gamesSetup();
    if (this.running) { this.drawTV(); this.drawHud(); }
    if (id === 'sandbox') { this.running = false; this.hudOff(); G.screens.setTV((g, W, H) => { tvFrame(g, W, H, 'FREE ROAM'); g.fillStyle = '#fff'; g.font = '30px sans-serif'; wrapText(g, 'No quiz tonight. Martin is devastated. Throw whatever you like (except the tree).', 60, 170, 900, 42); }); }
  }
  // ---------------- Family Chaos ----------------
  chaosSetup() {
    this.limit = 180; G.systems.havoc = 85;
    const ev = (n, pts) => on(n, (p) => { if (p?.isPlayer) return; this.hit(); this.add(pts, n === 'pileUp' ? 'PILE-UP!' : n === 'glassSquash' ? 'Face on the glass' : n === 'tvHit' ? 'Hit the telly' : n, p?.world?.[1]?.p); });
    ev('punched', 50); ev('kicked', 60); ev('shoved', 40); ev('pileUp', 150); ev('glassSquash', 120); ev('tvHit', 80); ev('corkHit', 100); ev('chipBowled', 70);
    on('thrown', (h) => { if (h.kind === 'char') { this.hit(); this.add(30, `Threw ${h.ref.name}`); } });
    on('throwRated', (h, r) => { if (h.kind === 'char' && r.score > 3) this.add(r.score * 15, `${h.ref.name} landed: ${r.score.toFixed(1)}/10`); });
    on('itemImpact', (inst, other, sp) => { if (other?.kind === 'char' && !other.ref.isPlayer && !other.ref.protected && G.time - (this._lastImp || 0) > 0.5) { this._lastImp = G.time; this.hit(); this.add(20, `${inst.type.name} to ${other.ref.name}`); } });
    this.chaosT = 6;
  }
  hit() { this.combo = this.comboT > 0 ? Math.min(5, this.combo + 0.5) : 1; this.comboT = 3; }
  // ---------------- Fling the Family ----------------
  flingSetup() { this.throws = 0; this.maxThrows = 10; this.limit = 0;
    on('thrown', (h) => { if (h.kind === 'char' && this.running) { this.throws++; this.inFlight = h.ref; this.flightBonus = 0; } });
    for (const [e, pts, why] of [['pileUp', 200, 'Pile-up bonus'], ['glassSquash', 250, 'Window splat bonus'], ['tvHit', 150, 'Telly bonus']]) on(e, () => { if (this.inFlight) this.add(pts, why); });
    on('throwRated', (h, r) => { if (h.kind !== 'char' || !this.running) return; const pts = Math.round(r.score * 100); this.add(pts, `${h.ref.name}: ${r.dist.toFixed(1)} m, ${r.height.toFixed(1)} m high — ${r.score.toFixed(1)}/10`);
      G.ui?.toast(`Throw ${this.throws}/${this.maxThrows}: ${h.ref.name} — ${r.score.toFixed(1)}/10`, 3); this.inFlight = null;
      if (this.throws >= this.maxThrows) setTimeout(() => this.end(), 2500); });
    G.ui?.toast('Grab a relative (LMB / fist), hold RMB to charge, release to fling. Big heights and long distances score most.', 6);
  }
  // ---------------- Beer Run ----------------
  beerSetup() { this.limit = 180; this.orders = []; this.orderT = 2; G.systems.nextOrder = Infinity; this.served = 0; this.missed = 0;
    on('drinkServed', (p, ok) => { if (!this.running) return; const o = this.orders.find(o => o.p === p); if (!o) { this.add(10, `${p.name} took one anyway`); return; } if (ok) { this.orders.splice(this.orders.indexOf(o), 1); this.served++; this.add(100 + Math.round(Math.max(0, o.until - G.time) * 3), `${p.name} got a ${o.label}`); sfx('ding', p.headPos(new THREE.Vector3()), 0.6); } else { this.score = Math.max(0, this.score - 20); this.lines.unshift(`-20  Wrong drink for ${p.name}`); } });
    this.restock();
  }
  restock() { const add = (id, x, y, z) => { if ((G.items.byType[id] || []).filter(i => { const t = i.body.translation(); return Math.hypot(t.x - x, t.z - z) < 0.5; }).length < 2) G.items.spawn(id, new THREE.Vector3(x + rand(-0.15, 0.15), y, z), null, { surface: true }); };
    add('lager', 4.0, 0.58, 0.35); add('prosecco', 3.6, 0.13, 0.45); add('white_wine', 3.75, 0.13, 0.45); add('bitter', -5.0, 1.03, 5.65); add('juice', 3.65, 0.58, 0.5); add('lager', -5.0, 0.13, 5.62); }
  newOrder() {
    const label = { lager: 'lager', bitter: 'bitter', pint: 'pint (lager or bitter)', prosecco: 'Prosecco', wine: 'glass of wine', small: 'small one (Prosecco or wine)', juice: 'juice' };
    const cands = G.chars.filter(c => !c.isPlayer && !c.protected && !c.isDown() && DRINK_ORDERS[c.name] && !this.orders.some(o => o.p === c)); if (!cands.length) return;
    const p = pick(cands); const d = DRINK_ORDERS[p.name]; const o = { p, drink: d, label: label[d] || d, until: G.time + 50 }; this.orders.push(o);
    p.say(pick([`Tommy! ${label[d]}, please!`, `Get us a ${label[d]}, Tommy.`, `I'm parched. ${label[d]}?`]), { prio: 1 });
  }
  // ---------------- Hide & Seek ----------------
  hideSetup() { this.limit = 240; this.found = 0;
    const spots = shuffle([
      ['in the Christmas tree', -2.12, 1.05, -6.1], ['under a sofa cushion', -2.9, 0.62, -1.0], ['in the bathroom', -2.2, 0.5, 4.8], ['in Chip\'s bed', -4.75, 0.08, -1.0],
      ['on the garage shelf', -7.19, 1.55, 3.0], ['behind the TV', -5.45, 0.6, -5.7], ['in the conservatory plant pot', 5.15, 0.5, -6.45], ['on top of the fridge', 5.51, 1.92, 0.1],
      ['under the stairs', -2.7, 0.1, 0.4], ['behind the trampoline', 3.4, 0.1, -14.0], ['in the fireplace', -5.0, 0.15, -3.05], ['in the kitchen bin', 2.35, 0.65, -0.05], ['on the landing', -2.1, 2.5, 0.1], ['under the BBQ', -7.0, 0.1, -7.4],
    ]).slice(0, 6);
    const ids = shuffle(['remote', 'keys', 'phone', 'cup_turkey', 'red_nose', 'rubber_duck']);
    this.hidden = spots.map(([where, x, y, z], i) => { const it = G.items.spawn(ids[i], new THREE.Vector3(x, y, z), null); if (it) it.hiddenAt = where; return it; }).filter(Boolean);
    on('grab', (h) => { if (!this.running || h.kind !== 'item') return; const i = this.hidden.indexOf(h.ref); if (i < 0 || h.ref.foundIt) return; h.ref.foundIt = true; this.found++; this.add(150, `Found the ${h.ref.type.name.toLowerCase()} ${h.ref.hiddenAt}`); sfx('ding', null, 0.8); G.charByName.Mason?.say(pick(['Awww!', 'No fair!', 'Hehehe!']), { prio: 1 }); if (this.found >= this.hidden.length) setTimeout(() => this.end(), 1200); });
    this.sparkles = this.hidden.map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffe680', transparent: true, opacity: 0, depthTest: false })); s.scale.set(0.12, 0.12, 1); s.renderOrder = 60; G.scene.add(s); return s; });
    G.ui?.toast('Mason has hidden: ' + this.hidden.map(h => h.type.name.toLowerCase()).join(', ') + '. Grab each one to find it. Sparkles appear after a minute.', 8);
  }
  // ---------------- Games Room Marathon ----------------
  gamesSetup() { this.limit = 0; this.gi = 0; const q = G.quiz; this.base = q.bonus.paul;
    G.player.teleport(1.6, -1.3, -0.6);
    const next = () => { this.score = (q.bonus.paul - this.base) * 100; if (this.gi >= 5) return this.end(); G.minigames.start(this.gi++, next); };
    setTimeout(next, 2500);
  }
  // ---------------- loop ----------------
  update(dt) {
    if (!this.running) return; this.t += dt; this.comboT -= dt; if (this.comboT <= 0) this.combo = 1;
    if (this.id === 'chaos') { this.chaosT -= dt; if (this.chaosT <= 0) { this.chaosT = rand(14, 22); G.systems.chaos(pick(['corkPop', 'chipZoomies', 'baubleBarrage', 'sippyStrike', 'volume100', 'doorbell', 'paulOverRoast', 'wineSpill', 'puddingFire', 'channelChange'])); } }
    if (this.id === 'beer') { this.orderT -= dt; if (this.orderT <= 0 && this.orders.length < 4) { this.orderT = rand(9, 15) * (1 - this.t / 400); this.newOrder(); }
      for (const o of this.orders.slice()) if (G.time > o.until) { this.orders.splice(this.orders.indexOf(o), 1); this.missed++; this.score = Math.max(0, this.score - 30); this.lines.unshift(`-30  ${o.p.name} gave up waiting`); o.p.say(pick(['Forget it, I\'ll get it myself.', 'Never mind, Tommy.', 'Unbelievable.']), { prio: 1 }); }
      if (G.frame % 600 === 0) this.restock(); }
    if (this.id === 'hide' && this.sparkles) this.hidden.forEach((it, i) => { const s = this.sparkles[i]; if (!it.alive || it.foundIt) { s.visible = false; return; } const tp = it.body.translation(); s.position.set(tp.x, tp.y + 0.12, tp.z); s.material.opacity = this.t > 60 ? (Math.sin(G.time * 4 + i) * 0.5 + 0.5) * 0.9 : 0; s.material.rotation = G.time; });
    if (this.limit && this.t >= this.limit) return this.end();
    if (G.frame % 10 === 0) { this.drawHud(); this.drawTV(); }
  }
  timeText() { const s = this.limit ? Math.max(0, Math.ceil(this.limit - this.t)) : Math.floor(this.t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  extra() {
    if (this.id === 'fling' && this.maxThrows) return `Throws ${this.throws}/${this.maxThrows}`;
    if (this.id === 'beer' && this.orders) return this.orders.map(o => `${o.p.name}: ${o.label} (${Math.max(0, Math.ceil(o.until - G.time))}s)`).join(' · ') || 'Waiting for orders…';
    if (this.id === 'hide' && this.hidden) return `Found ${this.found}/${this.hidden.length}`;
    if (this.id === 'chaos') return this.combo > 1 ? `COMBO x${this.combo.toFixed(1)}` : 'Chain hits for a combo';
    if (this.id === 'games') return `Game ${this.gi}/5`;
    return '';
  }
  drawHud() { if (!this.hud) return; this.hud.style.display = G.xr ? 'none' : 'block'; const b = this.best();
    this.hud.innerHTML = `<div class="mh-name">${this.def.icon} ${this.def.name}</div><div class="mh-row"><b>${this.score}</b><span>${this.timeText()}</span></div><div class="mh-extra">${this.extra()}</div>${b != null ? `<div class="mh-best">Best ${b}</div>` : ''}${this.lines.slice(0, 3).map((l, i) => `<div class="mh-line" style="opacity:${1 - i * 0.28}">${l}</div>`).join('')}`; }
  hudOff() { if (this.hud) this.hud.style.display = 'none'; }
  drawTV() { G.screens?.setTV((g, W, H) => { tvFrame(g, W, H, (this.def.name).toUpperCase(), '#1d3557'); g.fillStyle = '#ffd700'; g.font = 'bold 120px sans-serif'; g.fillText(String(this.score), 60, 230); g.fillStyle = '#fff'; g.font = 'bold 60px sans-serif'; g.fillText(this.timeText(), W - 230, 230);
    g.font = '26px sans-serif'; wrapText(g, this.extra(), 60, 300, W - 120, 34); g.fillStyle = '#9fe0ff'; g.font = '22px sans-serif'; this.lines.slice(0, 4).forEach((l, i) => g.fillText(l, 60, 410 + i * 30)); const b = this.best(); if (b != null) { g.fillStyle = '#ffd700'; g.fillText('Best: ' + b, W - 230, 280); } }); }
  end() {
    if (!this.running) return; this.running = false; this.hudOff(); const prev = this.best(); const isBest = prev == null || this.score > prev; if (isBest) saveStore('best.' + this.id, this.score);
    sfx(isBest ? 'cheer' : 'drum', null, 1); G.player.releaseAll();
    const lines = { chaos: 'The house is wrecked. Julie is not speaking to you.', fling: 'Ten relatives, airborne. Nobody was hurt (much).', beer: `${this.served} drinks served, ${this.missed} people gave up waiting.`, hide: `You found ${this.found} of ${this.hidden?.length || 6}.`, games: 'Games room survived. Mostly.' }[this.id] || '';
    G.screens.setTV((g, W, H) => { tvFrame(g, W, H, 'FINAL SCORE', '#7a1f24'); g.fillStyle = '#ffd700'; g.font = 'bold 140px sans-serif'; g.fillText(String(this.score), 60, 260); g.fillStyle = '#fff'; g.font = '30px sans-serif'; wrapText(g, (isBest ? 'NEW PERSONAL BEST! ' : `Best: ${prev}. `) + lines, 60, 340, W - 120, 40); });
    G.ui?.modal('scoreModal', `<h2>${this.def.icon} ${this.def.name}</h2><div style="font:900 64px Georgia,serif;color:#ffd700;text-align:center">${this.score}</div><p style="text-align:center">${isBest ? '🎉 New personal best!' : `Your best: ${prev}`}<br>${lines}</p>
      <div style="text-align:center"><button class="btn" id="mAgain">Play again</button><button class="btn alt" id="mModes">Choose another mode</button><button class="btn alt" data-close>Keep messing about</button></div>`, (el) => {
      el.querySelector('#mAgain').onclick = () => { location.href = `?mode=${this.id}`; }; el.querySelector('#mModes').onclick = () => { location.href = '?'; }; });
    if (G.xr) G.ui?.toast(`Final score ${this.score}${isBest ? ' — new best!' : ''}. Take the headset off to pick another mode.`, 8);
    emit('modeEnd', this.id, this.score);
  }
}

// home-screen mode picker
export function buildModePicker(onPick) {
  const el = document.getElementById('modes'); if (!el) return; let cur = selectedMode();
  const draw = () => { el.innerHTML = MODES.map(m => { const b = loadStore('best.' + m.id, null); return `<button class="mode${m.id === cur ? ' sel' : ''}" data-m="${m.id}"><i>${m.icon}</i><b>${m.name}</b><small>${m.desc}</small><em>${m.tag}${b != null ? ` · best ${b}` : ''}</em></button>`; }).join('');
    el.querySelectorAll('.mode').forEach(btn => btn.onclick = () => { cur = btn.dataset.m; saveStore('mode', cur); try { history.replaceState(null, '', '?mode=' + cur); } catch (e) {} draw(); onPick && onPick(cur); }); };
  draw(); onPick && onPick(cur);
  return () => cur;
}
