// Flat-screen HUD, touch controls (floating joystick + big buttons, layout editor), menus, subtitles,
// 3D speech bubbles (so VR players can read who said what), and the Quest wrist menu.
import * as THREE from 'three';
import { G, on, emit, clamp, pick } from '../core.js';
import { canvasTex } from '../engine/textures.js';
import { saveSettings, loadStore, saveStore } from './settings.js';
import { OUTFITS, TEAMS, TEAM_IDS } from '../chars/cast.js';
import { Ceremony } from './ceremony.js';
import { startFlow } from './flow.js';
import { dressGaryFor } from '../chars/people.js';
import { setAvatar } from './avatar.js';
import './popup.js';
import { initVRHud } from './vrhud.js';
import { initAudio, resumeAudio, sfx, unlockSpeech, voiceAvailable } from '../engine/audio.js';

const $ = (id) => document.getElementById(id);
const BUTTONS = [ // id, icon, label, default position (right/bottom or left/top in % / px), action
  // no grab button on phones: tap a person to knock them over, tap a thing to pick it up, tap again to throw
  { id: 'throw', icon: '🏈', label: 'THROW', pos: { right: 24, bottom: 28 }, big: true },
  { id: 'grab', icon: '✋', label: 'GRAB', pos: { right: 128, bottom: 116 } }, // only shown in Fling the Relative
  { id: 'punch', icon: '👊', label: 'PUNCH', pos: { right: 128, bottom: 26 } },
  { id: 'use', icon: '🖊️', label: 'USE', pos: { right: 104, top: 12 } },
  { id: 'drink', icon: '🍺', label: 'DRINK', pos: { right: 188, top: 12 } },
  { id: 'menu', icon: '☰', label: 'MENU', pos: { left: 10, top: 10 } },
  { id: 'crouch', icon: '⬇️', label: 'CROUCH', pos: { right: 128, bottom: 116 } },
  { id: 'jump', icon: '⬆️', label: 'JUMP', pos: { right: 34, bottom: 136 } },
];
export function initUI() { new UI(); new Ceremony(); initVRHud(); }

class UI {
  constructor() {
    G.ui = this; this.toasts = []; this.subs = []; this.modalOpen = false; this.touchMode = matchMedia('(pointer: coarse)').matches;
    this.bubbles = []; this.bubbleTex = [];
    for (let i = 0; i < 6; i++) { const t = canvasTex(512, 128); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true })); s.scale.set(0.9, 0.225, 1); s.visible = false; s.renderOrder = 20; G.scene.add(s); this.bubbles.push({ s, t, until: 0, who: null }); }
    on('say', (who, text) => this.onSay(who, text));
    on('menu', () => G.xr && G.vrHud ? G.vrHud.toggleMenu() : this.toggleMenu()); // in the headset the menu is on the floating panel
    on('scoreboard', (v) => this.scoreboard(v));
    on('question', () => this.showAnswers()); on('answered', () => this.showAnswers()); on('paulChanged', () => this.showAnswers()); on('questionEnd', () => G.popup?.questionCard(null));
    on('pointerlock', (l) => { if (!l && !this.modalOpen && !this.touchMode && !G.xr && this.started) { /* paused by ESC */ } });
    G.updaters.push((dt) => this.update(dt));
    // floating name tag over whoever you're looking at
    this.tagTex = canvasTex(512, 160); this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tagTex, depthTest: false, transparent: true }));
    this.tag.renderOrder = 40; this.tag.visible = false; G.scene.add(this.tag); this.tagFor = null;
    this.wristTex = canvasTex(1024, 680); this.wristTexture = this.wristTex; this.drawWrist();
    this.buildTouch();
    this.startScreen();
  }
  // ---------------- start / VR ----------------
  startScreen() {
    $('startBtns').style.display = 'block';
    const go = () => { initAudio(); resumeAudio(); unlockSpeech(); if (!voiceAvailable()) this.toast('This browser has no speech voices — subtitles only.', 5); $('loading').style.display = 'none'; $('hud').style.display = ''; this.started = true; emit('started'); if (!this.touchMode) { if (!G.renderer.xr.isPresenting) G.renderer.domElement.requestPointerLock?.(); } else { $('touch').classList.add('on'); document.body.classList.add('touch'); } };
    this.go = go;
    const qs = new URLSearchParams(location.search);
    const prep = () => { const m = qs.get('mode'); if (m) { G.modes.id = m; } if (['Chip', 'Mason', 'Harrison'].includes(qs.get('as'))) G.modes.id = 'roam'; dressGaryFor(G.modes.id); setAvatar(qs.get('as') || 'Tommy'); };
    const quick = () => { prep(); go(); };
    $('btnPlay').onclick = () => { initAudio(); resumeAudio(); unlockSpeech(); if (qs.get('skip')) return quick(); startFlow(go); };
    if (navigator.xr) navigator.xr.isSessionSupported('immersive-vr').then(ok => { if (!ok) return; $('btnVR').style.display = 'inline-block'; $('vrbtn').style.display = 'block'; const enter = async () => { if (this.started || this.vrFlow) return; initAudio(); resumeAudio(); if (qs.get('skip')) { prep(); go(); this.enterVR(); return; } this.vrFlow = true; try { setAvatar(loadStore('lastAs', 'Tommy') === 'Chip' ? 'Tommy' : (G.charByName[loadStore('lastAs', 'Tommy')] ? loadStore('lastAs', 'Tommy') : 'Tommy')); } catch (e) { /* set properly after the setup screens */ } const ok = await this.enterVR(true); if (!ok) { this.vrFlow = false; return; } startFlow(() => { this.vrFlow = false; go(); }, { vr: true }); }; /* straight into the headset, then the setup screens in there */ $('btnVR').onclick = enter; $('vrbtn').onclick = enter;
      // changed mode from the headset menu: the Quest browser hands the VR session straight back after the reload
      if (qs.get('vr')) { navigator.xr.addEventListener?.('sessiongranted', enter); $('btnVR').textContent = '🥽 Back into VR'; } }).catch(() => {});
    addEventListener('touchstart', () => { if (!this.touchMode) { this.touchMode = true; if (this.started) { $('touch').classList.add('on'); document.body.classList.add('touch'); } } }, { once: true });
  }
  async enterVR(setupFirst) {
    if (!setupFirst) this.started = true;
    try {
      const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'] });
      G.renderer.xr.setSession(s); $('hud').style.display = 'none'; $('loading').style.display = 'none'; $('touch').classList.remove('on');
      s.addEventListener('end', () => { $('hud').style.display = ''; if (this.vrFlow) { location.reload(); return; } this.started = true; });
      return true;
    } catch (e) { this.toast('Could not start VR: ' + e.message, 6); const el = $('vrErr') || Object.assign(document.createElement('div'), { id: 'vrErr' }); el.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:99;background:#b3122a;color:#fff;border:3px solid #ffd700;border-radius:14px;padding:10px 16px;font:700 15px system-ui;max-width:90vw;text-align:center'; el.textContent = 'Could not start VR: ' + e.message + ' — tap Enter VR again.'; document.body.appendChild(el); setTimeout(() => el.remove(), 8000); return false; }
  }
  // ---------------- toasts / subtitles / bubbles ----------------
  toast(text, secs = 3, opts = {}) {
    if (G.modes?.quiet?.() && !opts.game) return; // no random notifications in the game modes (only the game's own messages)
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = text; $('toasts').appendChild(el);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
    setTimeout(() => el.remove(), secs * 1000);
    if (G.xr) this.vrToast = { text, until: G.time + secs };
  }
  onSay(who, text) {
    if (G.settings.subtitles) { const el = document.createElement('div'); el.className = 'sub'; el.innerHTML = `<b>${who ? who.name : '📱'}:</b> ` + text.replace(/</g, '&lt;'); $('subs').appendChild(el); while ($('subs').children.length > 3) $('subs').firstChild.remove(); setTimeout(() => el.remove(), Math.min(7000, 1500 + text.length * 60)); }
    if (!who || !who.headPos) return;
    let b = this.bubbles.find(b => b.who === who) || this.bubbles.reduce((a, c) => (a.until < c.until ? a : c));
    b.who = who; b.until = G.time + Math.min(7, 1.8 + text.length * 0.06);
    const g = b.t.userData.ctx; g.clearRect(0, 0, 512, 128); g.fillStyle = 'rgba(255,255,255,0.93)'; roundRect(g, 4, 4, 504, 104, 22); g.fill(); g.beginPath(); g.moveTo(230, 106); g.lineTo(256, 126); g.lineTo(270, 106); g.fill();
    g.fillStyle = TEAMS[who.team]?.color || '#c8a050'; g.font = 'bold 22px sans-serif'; g.fillText(who.name, 18, 30);
    g.fillStyle = '#111'; g.font = '24px sans-serif'; wrap(g, text, 18, 60, 476, 26, 2); b.t.needsUpdate = true;
  }
  // ---------------- per-frame HUD ----------------
  update(dt) {
    for (const b of this.bubbles) { const show = b.who && G.time < b.until && !(b.who.isDown?.() && b.who.state === 'ragdoll' && false); b.s.visible = !!show; if (show) { b.who.headPos(b.s.position); b.s.position.y += 0.38; const d = b.s.position.distanceTo(G.player.headPos(new THREE.Vector3())); b.s.visible = d < 10; const k = clamp(d / 4, 0.7, 1.8); b.s.scale.set(0.9 * k, 0.225 * k, 1); } }
    if (!G.xr) { const f = G.player.focus, held = G.player.heldItem('D'); const who = f && (f.kind === 'char' || f.kind === 'dog') ? f.ref : null; if (who && !(held && f.dist < 2.2)) this.showTag(who, f.protected || who.protected); else this.showTag(null); }
    if (G.frame % 6) return;
    const s = G.systems, q = G.quiz;
    if (s) { const bv = s.banterV; $('banterBar').style.width = bv + '%'; $('banterBar').style.background = bv < 45 ? '#2c2' : bv < 75 ? '#fa2' : '#f22'; $('banterLbl').textContent = s.banterLevel(); $('havocBar').style.width = s.havoc + '%'; $('havocBar').style.background = '#8c4'; $('havocLbl').textContent = ['Calm', 'Busy', 'Wild', 'CHAOS'][s.havocLevel()]; }
    if (q) { $('scores').innerHTML = TEAM_IDS.map(t => `<div><span style="color:${q.teamColor(t)}">■</span> ${q.teamName(t)} <b>${q.total(t)}</b></div>`).join('') + `<div style="opacity:.7;font-size:12px">Host points ${s?.hostPoints || 0} · TV dmg ${s?.tvDamage || 0}</div>`;
      $('phaseLbl').textContent = ({ arrival: 'Arrival — press Enter to start', wheel: 'Gary\'s Outfit Wheel', roundIntro: 'Round starting', question: `Question ${q.qi + 1} — ${Math.max(0, Math.ceil(q.qTime - q.t))}s`, between: '', collect: 'Sheets swapped', heist: 'HEIST!', marking: 'Marking — Q to dispute', roundEnd: 'Round over', minigame: 'Mini-game', final: 'Final', ceremony: 'The Mason Cup', end: 'Same time next year' })[q.phase] || ''; }
    // focus prompt
    const f = G.player.focus; const held = G.player.heldItem('D'); let txt = '';
    if (!G.xr) {
      if (held && f && (f.kind === 'char' || f.kind === 'dog') && f.dist < 2.2) txt = `R: give ${held.type.name} to ${f.ref.name}`;
      else if (held && G.minigames?.active?.id === 'sproutPong') txt = 'Hold THROW for more power';
      else if (held && this.touchMode) txt = `${held.type.name} — tap to throw${held.type.food || held.type.drink ? ' · DRINK' : ''}`;
      else if (held) txt = `${held.type.name} — RMB throw · R use${held.type.food || held.type.drink ? ' · G eat/drink' : ''} · LMB drop`;
      else if (G.player.holders.D) txt = `Holding ${G.player.holders.D.ref.name || 'it'} — hold RMB to throw`;
      else if (f) { if (f.kind === 'item') txt = f.ref.type.fixed ? `${f.ref.type.name}${f.ref.type.use ? ' · R use' : ''}` : `${this.touchMode ? 'Tap to pick up' : 'LMB grab'} ${f.ref.type.name}${f.ref.type.use ? ' · R use' : ''}`; else if (f.kind === 'char') txt = f.protected || f.ref.protected ? `${f.ref.name} (can't be grabbed)` : `LMB grab ${f.ref.name} · F punch · R talk`; else if (f.kind === 'dog') txt = 'Chip — R to stroke'; else if (f.kind === 'hinged') txt = `${f.ref.name} — LMB grab & pull · R open/close`; else if (f.kind === 'spot') txt = `R: ${f.ref.label}`; else if (f.kind === 'tree') txt = 'The Christmas tree (grab the baubles)'; else if (f.kind === 'tv') txt = 'Martin\'s TV (do not touch)'; }
      if (!txt && !held && !G.player.seated && G.player.freeSeat()) txt = 'R: sit down';
      if (!txt && G.player.seated) txt = 'Move to stand up';
      const who = f && (f.kind === 'char' || f.kind === 'dog') ? f.ref : null;
      if (who && !(held && f.dist < 2.2)) txt = '';
      // phones: name the on-screen buttons, not keyboard keys
      if (this.touchMode && txt) txt = txt.replace(/^R: /, 'USE: ').replace(/ · R use/g, ' · USE').replace(/RMB throw/g, 'THROW').replace(/hold RMB to throw/g, 'hold THROW').replace(/ · G eat\/drink/g, ' · DRINK').replace(/ · LMB drop/g, '').replace(/LMB grab/g, 'Tap to pick up');
      $('prompt').textContent = txt;
      const ch = G.minigames?.active?.charge || G.player.charge; $('charge').style.display = ch > 0 ? 'block' : 'none'; $('charge').firstChild.style.width = (ch * 100) + '%';
      this.updateTouchReady(f, held);
    }
    if (G.xr && G.frame % 12 === 0) this.drawWrist();
  }
  showTag(p, prot) {
    if (!p) { this.tag.visible = false; this.tagFor = null; this.tagPerson = null; return; }
    const key = p.name;
    if (this.tagFor !== key) { this.tagFor = key; const g = this.tagTex.userData.ctx; g.clearRect(0, 0, 512, 160);
      const team = TEAMS[p.team]?.color || '#c8a050'; // just the name, edged in their team colour
      g.font = 'bold 58px Georgia, serif'; const w = g.measureText(p.name).width + 64;
      g.fillStyle = 'rgba(14,12,22,0.82)'; roundRect(g, 256 - w / 2, 36, w, 92, 26); g.fill(); g.fillStyle = team; roundRect(g, 256 - w / 2, 36, 14, 92, 7); g.fill();
      g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(p.name, 263, 102); g.textAlign = 'left';
      this.tagTex.needsUpdate = true; }
    this.tagPerson = p; this.placeTag();
  }
  placeTag() {
    const p = this.tagPerson; if (!p || !this.tagFor) { this.tag.visible = false; return; }
    const hp = p.headPos(new THREE.Vector3()); this.tag.position.copy(hp).add(new THREE.Vector3(0, p.isDog ? 0.28 : 0.2, 0));
    const d = hp.distanceTo(G.player.headPos(new THREE.Vector3())); const k = clamp(d / 2.2, 0.6, 1.8); this.tag.scale.set(0.95 * k, 0.3 * k, 1); this.tag.visible = !G.xr;
    for (const b of this.bubbles) if (b.who === p && b.s.visible) b.s.position.y += 0.2 * k; // keep the speech bubble above it
  }
  showAnswers() { // big animated question card with four tap-able answers (phones, tablets and desktop)
    const q = G.quiz; const cur = q?.cur; const box = $('answers'); if (box) box.style.display = 'none';
    if (!cur || q.phase !== 'question' || G.xr) { G.popup?.questionCard(null); return; }
    G.popup?.questionCard({ q: cur.q, opts: cur.opts, round: q.roundName?.() }, q.qi + 1, q.questions.length, (i) => q.answer(i), cur.answers[G.myTeam || 'paul']);
  }
  openAnswerPicker() { this.showAnswers(); if (G.quiz.phase === 'heist') this.modal('pickModal', `<h2>Change an answer (heist!)</h2><p>Pick the letter to write over your wrong answer:</p>${[0, 1, 2, 3].map(i => `<button class="btn" data-a="${i}">${'ABCD'[i]}</button>`).join('')}<br><button class="btn alt" data-close>Cancel</button>`, (el) => el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { G.quiz.answer(+b.dataset.a); this.closeModal('pickModal'); })); }
  askNumber(title, cb) { this.modal('pickModal', `<h2>${title}</h2><input id="numIn" type="number" value="100" style="font-size:22px;width:140px;padding:6px"> <button class="btn" id="numOk">Guess</button>`, (el) => { el.querySelector('#numOk').onclick = () => { const n = +el.querySelector('#numIn').value || 0; this.closeModal('pickModal'); cb(n); }; }); if (G.xr) cb(Math.round(60 + Math.random() * 60)); }
  showAwards(list) { this.modal('scoreModal', `<h2>🏆 Family Awards</h2><table>${list.map(([a, b]) => `<tr><td>${a}</td><td style="text-align:right;color:#ffd700">${b}</td></tr>`).join('')}</table><p style="opacity:.7">The cup stays on the mantelpiece with the winners' names for next time.</p><button class="btn" data-close>Close</button> <button class="btn alt" id="photoBtn">📸 Save team photo</button>`, (el) => { el.querySelector('#photoBtn').onclick = () => this.photo(); }); }
  photo() { G.renderer.render(G.scene, G.camera); const a = document.createElement('a'); a.href = G.renderer.domElement.toDataURL('image/png'); a.download = 'mason-quiz-team-photo.png'; a.click(); this.toast('Team photo saved.'); }
  scoreboard(v, back) { const q = G.quiz; if (!v) return this.closeModal('scoreModal'); const s = G.systems; const pc = q.pcScores(); this.modal('scoreModal', `<h2>Scoreboard</h2><table><tr><td></td><td>TV</td><td>PC</td></tr>${TEAM_IDS.map(t => `<tr><td style="color:${q.teamColor(t)}">${q.teamName(t)}</td><td>${q.total(t)}</td><td>${pc[t]}</td></tr>`).join('')}</table><p style="font-size:13px;opacity:.75">The TV and the PC disagree by 2. Nobody knows which is right.</p><div class="grid2"><div>Told You So (Charli)</div><div>${q.stats.toldYou}</div><div>Paul argued vs reality</div><div>${q.stats.argued}</div><div>Biased rulings</div><div>${q.stats.biased}</div><div>Your throws</div><div>${G.player.stats.throws}</div><div>Coaster warnings</div><div>${s.stats.coaster}</div><div>Gary dignity</div><div>${Math.round(s.dignity)}</div><div>Eye-rolls</div><div>${s.stats.eyeRolls}</div></div>`, null, back); }
  modal(id, html, after, back) { const m = $(id); m.firstElementChild.innerHTML = `<button class="mx" data-close aria-label="Close">✕</button>` + html + (back ? `<div style="margin-top:12px"><button class="btn" data-back>← Back to menu</button></div>` : ''); m.classList.add('open'); this.modalOpen = true; document.body.classList.add('paused'); document.exitPointerLock?.(); m.querySelectorAll('[data-close]').forEach(b => b.onclick = () => this.closeModal(id)); m.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { this.closeModal(id); this.toggleMenu(); }); after && after(m); m.onpointerdown = (e) => e.stopPropagation(); }
  closeModal(id) { $(id).classList.remove('open'); this.modalOpen = [...document.querySelectorAll('.modal.open')].length > 0; document.body.classList.toggle('paused', this.modalOpen); if (!this.modalOpen && !this.touchMode && this.started && !G.xr) G.renderer.domElement.requestPointerLock?.(); }
  // ---------------- menu & settings ----------------
  toggleMenu() {
    if ($('menu').classList.contains('open')) return this.closeModal('menu');
    const S = G.settings; const unlocked = loadStore('unlockedOutfits', OUTFITS.map(o => o.id));
    const chk = (k, l) => `<label class="row"><span>${l}</span><input type="checkbox" data-k="${k}" ${S[k] ? 'checked' : ''}></label>`;
    this.modal('menu', `<h2>Menu</h2>
      <div><button class="btn" data-close>Resume</button><button class="btn" id="mNext">${G.quiz.phase === 'arrival' ? 'Start the quiz' : 'Next / skip'}</button><button class="btn alt" id="mScore">Scoreboard</button><button class="btn alt" id="mMode">Change game mode</button></div>
      <h2 style="margin-top:14px">Settings</h2>
      ${chk('voices', 'Character voices (speech)')}${chk('subtitles', 'Subtitles')}${chk('softDrinks', 'Soft drinks mode (all alcohol → squash)')}${chk('drunkSway', 'Wobbly-after-drinks effect')}${chk('thirdPerson', 'Start in third person (V toggles)')}${chk('shadows', 'Shadows (reload)')}${chk('smoothTurn', 'VR smooth turn (instead of snap)')}${chk('leftHanded', 'Left-handed (swap VR pinch walk/turn, touch buttons)')}${chk('invertY', 'Invert look Y')}
      <label class="row"><span>Mouse / look sensitivity</span><input type="range" min="0.3" max="2.5" step="0.1" data-n="mouseSens" value="${S.mouseSens}"></label>
      <label class="row"><span>Questions per round (reload)</span><select data-s="questionsPerRound">${[4, 6, 8, 10].map(n => `<option ${S.questionsPerRound == n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="row"><span>Timer</span><select data-s="difficulty"><option value="normal" ${S.difficulty === 'normal' ? 'selected' : ''}>Normal (28s)</option><option value="relaxed" ${S.difficulty === 'relaxed' ? 'selected' : ''}>Relaxed (40s)</option></select></label>
      <label class="row"><span>Gary's outfit (next game)</span><select data-s="garyOutfit"><option value="random">Spin the wheel</option>${OUTFITS.filter(o => unlocked.includes(o.id)).map(o => `<option value="${o.id}" ${S.garyOutfit === o.id ? 'selected' : ''}>${o.label}</option>`).join('')}</select></label>
      <label class="row"><span>Touch button size</span><input type="range" min="0.7" max="1.5" step="0.05" data-n="touchScale" value="${S.touchScale}"></label>
      <label class="row"><span>Touch button transparency</span><input type="range" min="0.2" max="1" step="0.05" data-n="touchOpacity" value="${S.touchOpacity}"></label>
      <div><button class="btn alt small" id="mLayout">Edit touch layout</button><button class="btn alt small" id="mLayoutReset">Reset layout</button><button class="btn alt small" id="mRestart">Restart game</button><button class="btn alt small" id="mWipe">Clear saved history</button></div>
      <h2 style="margin-top:14px">Controls</h2>
      <div class="grid2"><div><b>PC</b>: WASD move, mouse look, LMB grab/drop, hold RMB + release throw, F punch, E kick (PC only), R use/give/talk, G eat/drink, Q hand up, X accuse, 1–4 answer, Space jump, C crouch, V third person, Tab scores, Enter next</div>
      <div><b>Gamepad</b>: LS move, RS look, RT grab (release with an RS flick to throw, or RB throw), X punch, B kick, A use, Y hand up, LB drink, Start menu, D-pad answers</div>
      <div><b>Quest 3 hands</b>: fist = grab (both fists on Dad/Martin/Gary to lift), swing & open = throw, fist punch, pinch = use/write, pinch-drag left hand = walk, right = turn, palm up = wrist menu, hand above head = challenge, point 1s = accuse, thumbs up/down, clap, cover ears = mute, facepalm = eye-roll, food to mouth = eat, palm-down sweep or stamp = kick</div>
      <div><b>Touch</b>: left thumb = joystick, drag right side = look, big buttons as labelled. Tap answers at the bottom of the screen.</div></div>`, (el) => {
      el.querySelector('#mNext').onclick = () => { this.closeModal('menu'); emit('next'); };
      el.querySelector('#mScore').onclick = () => { this.closeModal('menu'); this.scoreboard(true, true); };
      el.querySelector('#mMode').onclick = () => { location.href = '?'; };
      if (G.modes?.running) { const b = el.querySelector('#mNext'); b.textContent = 'End this game now'; b.onclick = () => { this.closeModal('menu'); G.modes.end(); }; }
      el.querySelector('#mRestart').onclick = () => location.reload();
      el.querySelector('#mWipe').onclick = () => { try { Object.keys(localStorage).filter(k => k.startsWith('masonQuiz.')).forEach(k => localStorage.removeItem(k)); } catch (e) {} this.toast('Saved history cleared.'); };
      el.querySelector('#mLayout').onclick = () => { this.closeModal('menu'); this.editLayout(); };
      el.querySelector('#mLayoutReset').onclick = () => { S.touchLayout2 = null; saveSettings(S); this.buildTouch(true); };
      el.querySelectorAll('[data-k]').forEach(i => i.onchange = () => { S[i.dataset.k] = i.checked; saveSettings(S); if (i.dataset.k === 'thirdPerson') G.player.thirdPerson = i.checked; if (i.dataset.k === 'leftHanded') this.buildTouch(true); });
      el.querySelectorAll('[data-n]').forEach(i => i.oninput = () => { S[i.dataset.n] = +i.value; saveSettings(S); if (i.dataset.n.startsWith('touch')) this.buildTouch(true); });
      el.querySelectorAll('[data-s]').forEach(i => i.onchange = () => { S[i.dataset.s] = isNaN(+i.value) ? i.value : +i.value; saveSettings(S); });
    });
  }
  // ---------------- touch controls ----------------
  buildTouch(rebuild) {
    const T = $('touch'); T.querySelectorAll('.tbtn').forEach(b => b.remove()); const S = G.settings; this.tbtn = {};
    const layout = S.touchLayout2 || {};
    for (const d of BUTTONS) {
      const dog = document.body.classList.contains('as-dog'); const lbl = dog ? ({ punch: 'PAW PUNCH', throw: 'DROP IT', jump: 'POUNCE', crouch: 'SNIFF' }[d.id] || d.label) : d.label; const ico = dog ? ({ punch: '🐾', throw: '🦴', jump: '🐕' }[d.id] || d.icon) : d.icon;
      const b = document.createElement('div'); b.className = 'tbtn' + (d.big ? ' big' : ''); b.dataset.id = d.id; b.innerHTML = `<span>${ico}</span>${lbl}` + (d.id === 'throw' ? '<div id="grabThumb"></div>' : '');
      b.style.opacity = S.touchOpacity; b.style.transform = `scale(${S.touchScale})`;
      const p = layout[d.id] || d.pos; for (const k of ['left', 'right', 'top', 'bottom']) if (p[k] !== undefined) b.style[k] = typeof p[k] === 'number' ? p[k] + 'px' : p[k];
      if (S.leftHanded && !layout[d.id]) { if (p.right !== undefined) { b.style.left = p.right + 'px'; b.style.right = ''; } else if (typeof p.left === 'number') { b.style.right = p.left + 'px'; b.style.left = ''; } }
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (this.editing) return this.startDrag(e, b, d.id); this.press(d.id, true); navigator.vibrate?.(15); });
      b.addEventListener('pointerup', (e) => { e.stopPropagation(); if (!this.editing) this.press(d.id, false); });
      b.addEventListener('pointercancel', () => this.press(d.id, false));
      T.appendChild(b); this.tbtn[d.id] = b;
    }
    if (rebuild) return;
    // joystick on the left half, look on the right half
    const stick = $('stick'); let sid = null, sx = 0, sy = 0; let lid = null, lx = 0, ly = 0, l0x = 0, l0y = 0, l0t = 0;
    const home = () => { stick.style.display = 'block'; stick.style.left = '22px'; stick.style.top = (innerHeight - 200) + 'px'; stick.classList.add('idle'); stick.firstChild.style.transform = ''; }; home(); addEventListener('resize', () => { if (sid === null) home(); }); this.stickHome = home;
    T.style.pointerEvents = 'none';
    const area = G.renderer.domElement;
    const down = (e) => { if (!this.touchMode || this.modalOpen || this.editing) return; const hx = 82, hy = innerHeight - 140; if (sid === null && Math.hypot(e.clientX - hx, e.clientY - hy) < 95) { sid = e.pointerId; sx = hx; sy = hy; stick.classList.remove('idle'); } /* the joystick stays where it is; everywhere else is look / tap */ else if (lid === null) { lid = e.pointerId; lx = l0x = e.clientX; ly = l0y = e.clientY; l0t = performance.now(); } };
    const move = (e) => { if (e.pointerId === sid) { const dx = clamp((e.clientX - sx) / 50, -1, 1), dy = clamp((e.clientY - sy) / 50, -1, 1); G.player.controls.touchMove.x = dx; G.player.controls.touchMove.z = -dy; stick.firstChild.style.transform = `translate(${dx * 34}px,${dy * 34}px)`; } if (e.pointerId === lid) { const s = 0.006 * (G.settings.mouseSens || 1); G.player.controls.touchLook.x += (e.clientX - lx) * s; G.player.controls.touchLook.y += (e.clientY - ly) * s; lx = e.clientX; ly = e.clientY; } };
    const up = (e) => { if (e.pointerId === sid) { sid = null; home(); G.player.controls.touchMove.x = G.player.controls.touchMove.z = 0; } if (e.pointerId === lid) { lid = null; if (Math.hypot(e.clientX - l0x, e.clientY - l0y) < 14 && performance.now() - l0t < 350) G.player.tapAt(e.clientX, e.clientY); } };
    // no text selection / magnifier when a thumb lingers or double-taps
    document.addEventListener('selectstart', (e) => { if (!/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '')) e.preventDefault(); });
    document.addEventListener('dblclick', (e) => e.preventDefault()); area.addEventListener('contextmenu', (e) => e.preventDefault());
    area.addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  press(id, v) {
    const c = G.player.controls;
    if (id === 'grab') { if (v) { c.set('grab', true); setTimeout(() => c.set('grab', false), 30); } return; }
    if (id === 'menu') { if (v) emit('menu'); return; }
    c.set(id, v);
  }
  updateTouchReady(f, held) {
    if (!this.touchMode || !this.tbtn) return; const r = (id, on) => this.tbtn[id]?.classList.toggle('ready', !!on);
    r('grab', f && !held && f.kind !== 'spot' && f.kind !== 'tv' && f.kind !== 'tree' && !(f.kind === 'item' && f.ref.type.fixed)); r('throw', !!G.player.holders.D); r('use', held || G.player.freeSeat() || (f && (f.kind === 'spot' || f.kind === 'item' && f.ref.type.use || f.kind === 'hinged')));
    r('drink', held && (held.type.food || held.type.drink)); r('handUp', G.quiz?.phase === 'marking'); r('punch', f && f.kind === 'char' && !f.ref.protected);
    const th = $('grabThumb'); if (th) th.textContent = held ? held.type.name : '';
  }
  editLayout() {
    this.editing = true; $('touch').classList.add('on'); this.toast('Drag buttons where your thumbs like them. Tap MENU to finish.', 5);
    const done = () => { this.editing = false; saveSettings(G.settings); this.toast('Layout saved.'); };
    this.tbtn.menu.onclick = () => { if (this.editing) done(); };
  }
  startDrag(e, b, id) {
    if (id === 'menu') { this.editing = false; saveSettings(G.settings); this.toast('Layout saved.'); return; }
    const move = (ev) => { const x = ev.clientX, y = ev.clientY; b.style.left = (x - 36) + 'px'; b.style.top = (y - 36) + 'px'; b.style.right = ''; b.style.bottom = ''; };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); const r = b.getBoundingClientRect(); G.settings.touchLayout2 = G.settings.touchLayout2 || {}; G.settings.touchLayout2[id] = { left: Math.round(r.left), top: Math.round(r.top) }; };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  }
  // ---------------- Quest wrist menu ----------------
  wristButtons() {
    const q = G.quiz; const B = [];
    const add = (x, y, w, h, label, fn, hot) => B.push({ x, y, w, h, label, fn, hot });
    if (q && (G.modes?.id === 'quick' || G.modes?.id === 'quiz')) { add(0.03, 0.32, 0.94, 0.18, q.phase === 'arrival' ? '▶ START QUIZ' : 'NEXT ▶', () => emit('next'), q.phase === 'arrival' || q.phase === 'roundEnd');
      for (let i = 0; i < 4; i++) add(0.03 + i * 0.24, 0.53, 0.22, 0.19, 'ABCD'[i], () => q.answer(i), q.cur?.answers[G.myTeam || 'paul'] === i); }
    add(0.03, 0.75, 0.46, 0.2, '☰ MENU', () => G.vrHud?.toggleMenu());
    add(0.51, 0.75, 0.46, 0.2, G.settings.smoothTurn ? 'SMOOTH TURN' : 'SNAP TURN', () => { G.settings.smoothTurn = !G.settings.smoothTurn; saveSettings(G.settings); });
    return B;
  }
  // the wrist menu in the headset: big, high-contrast text you can read at arm's length
  drawWrist() {
    const g = this.wristTex.userData.ctx, W = 1024, H = 680; const q = G.quiz; g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(14,10,20,0.97)'; roundRect(g, 0, 0, W, H, 40); g.fill(); g.strokeStyle = '#ffd700'; g.lineWidth = 8; roundRect(g, 4, 4, W - 8, H - 8, 36); g.stroke();
    g.textBaseline = 'middle';
    if (q) { TEAM_IDS.forEach((t, i) => { const x = 24 + (i % 2) * 492, y = 22 + Math.floor(i / 2) * 64; const me = t === G.myTeam; g.fillStyle = me ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.06)'; roundRect(g, x, y, 476, 56, 14); g.fill(); g.fillStyle = q.teamColor(t); g.fillRect(x + 12, y + 12, 12, 32);
        g.fillStyle = me ? '#ffd700' : '#fff'; g.font = '800 34px system-ui'; g.textAlign = 'left'; g.fillText(q.teamName(t).replace('Team ', '') + (me ? ' (you)' : ''), x + 38, y + 29); g.textAlign = 'right'; g.font = '900 40px system-ui'; g.fillText(String(q.total(t)), x + 460, y + 29); }); g.textAlign = 'left'; }
    const tt = this.vrToast && G.time < this.vrToast.until ? this.vrToast.text : (q && (G.modes?.id === 'quick' || G.modes?.id === 'quiz') ? (q.phase === 'question' ? `Question ${q.qi + 1} · ${Math.max(0, Math.ceil(q.qTime - q.t))}s left` : q.phase) : (G.modes?.def?.name || ''));
    if (tt) { g.fillStyle = '#ffd700'; g.font = '700 28px system-ui'; wrap(g, tt, 28, 176, W - 56, 30, 1); }
    for (const b of this.wristButtons()) { const x = b.x * W, y = b.y * H, w = b.w * W, h = b.h * H; g.fillStyle = b.hot ? '#d23b3b' : '#22416e'; roundRect(g, x, y, w, h, 20); g.fill(); g.lineWidth = 4; g.strokeStyle = b.hot ? '#ffd700' : 'rgba(255,255,255,0.35)'; roundRect(g, x, y, w, h, 20); g.stroke();
      g.fillStyle = '#fff'; g.font = `900 ${b.label.length <= 1 ? 64 : 40}px system-ui`; g.textAlign = 'center'; g.fillText(b.label, x + w / 2, y + h / 2 + 2); g.textAlign = 'left'; }
    this.wristTex.needsUpdate = true;
  }
  pressWrist(u, v) { for (const b of this.wristButtons()) if (u >= b.x && u <= b.x + b.w && v >= b.y && v <= b.y + b.h) { b.fn(); this.drawWrist(); return true; } return false; }
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(g, text, x, y, maxW, lh, maxLines = 3) { const words = String(text).split(' '); let line = '', n = 0; for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; if (++n >= maxLines) { line += '…'; break; } } else line = t; } g.fillText(line, x, y); }
