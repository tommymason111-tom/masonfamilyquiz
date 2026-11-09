// The quiz itself: five rounds, Martin reading from the armchair, answer sheets, Paul overruling you,
// Charli being right, sheet swapping, biased marking, disputes (with the wheel), the answer-sheet heist,
// jokers, scoreboards that disagree, tie-break and the Mason Cup.
import * as THREE from 'three';
import { G, on, emit, rand, pick, shuffle, clamp } from '../core.js';
import { say, sfx, playMusic, stopMusic } from '../engine/audio.js';
import { TEAMS, OUTFITS } from '../chars/cast.js';
import { BUILTIN } from './questions.js';
import { tvFrame, wrapText, drawWheel } from './screens.js';
import { canvasTex } from '../engine/textures.js';
import { loadStore, saveStore } from './settings.js';
import { PICTURES } from './pictures.js';

const ROUNDS = [
  { id: 'sport', name: 'Round 1: The Year in Sport' },
  { id: 'telly', name: 'Round 2: Telly, Film & Music' },
  { id: 'news', name: 'Round 3: News & Nonsense' },
  { id: 'picture', name: 'Round 4: The Picture Round' },
  { id: 'family', name: 'Round 5: The Family Round' },
];
const LETTERS = ['A', 'B', 'C', 'D'];
const SKILL = { martin: { sport: 0.55, telly: 0.8, news: 0.6, picture: 0.6, family: 0.55 }, debbie: { sport: 0.65, telly: 0.6, news: 0.55, picture: 0.55, family: 0.7 } };

export function parseBank(txt) {
  const out = [];
  for (const line of txt.split('\n')) {
    const l = line.trim(); if (!l || l.startsWith('#')) continue;
    const parts = l.split('|').map(s => s.trim()); if (parts.length < 6) continue;
    const [round, q, a, w1, w2, w3, arg] = parts;
    out.push({ round, q, answer: a, wrong: [w1, w2, w3], arg: arg || '' });
  }
  return out;
}

export class Quiz {
  constructor() {
    G.quiz = this;
    this.bank = parseBank(BUILTIN);
    fetch('questions.txt', { cache: 'no-store' }).then(r => r.ok ? r.text() : null).then(t => { if (t) { const b = parseBank(t); if (b.length > 10) this.bank = b; } }).catch(() => {});
    this.scores = { paul: 0, martin: 0, debbie: 0 }; this.bonus = { paul: 0, martin: 0, debbie: 0 };
    this.phase = 'arrival'; this.round = -1; this.qi = -1; this.t = 0; this.questionLive = false;
    this.jokers = { paul: null, martin: 1, debbie: 3 };
    this.history = []; this.stats = { argued: 0, biased: 0, whistles: 0, disputes: 0, disputesWon: 0, changed: 0, toldYou: loadStore('toldYou', 0) };
    this.paulPcBias = pick(['paul', 'martin', 'debbie']);
    this.qPer = G.settings.questionsPerRound || 6;
    // Team Paul's answer sheet = a clipboard with its own canvas
    this.sheetItem = G.items.byType.answer_sheet?.[0];
    this.sheetTex = canvasTex(512, 720); this.sheetPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.28), new THREE.MeshStandardMaterial({ map: this.sheetTex, roughness: 0.9 }));
    G.scene.add(this.sheetPlane);
    this.goodPen = pick(G.items.byType.pen || []);
    on('answerKey', (i) => this.answer(i));
    on('handUp', () => this.handUp());
    on('thumbsDown', () => this.handUp());
    on('next', () => this.next());
    on('joker', () => this.playJoker());
    on('accuse', (p) => this.accuse(p));
    G.updaters.push((dt) => this.update(dt));
    this.drawSheet();
    setTimeout(() => this.welcome(), 1500);
  }
  teamName(t) { return TEAMS[t].name; } teamColor(t) { return TEAMS[t].color; }
  total(t) { return this.scores[t] + this.bonus[t]; }
  pcScores() { const s = {}; for (const t of ['paul', 'martin', 'debbie']) s[t] = this.total(t) + (t === this.paulPcBias && this.round >= 0 ? 2 : 0); return s; }
  martin() { return G.charByName.Martin; }
  mSay(text, prio = 2) { const m = this.martin(); if (m && !m.isDown()) return m.say(text, { prio }); return say(null, text, { prio }); }
  penWorks(inst) { return inst === this.goodPen; }

  // ---------------- flow ----------------
  welcome() {
    G.screens.setTV((g, W, H) => { tvFrame(g, W, H, 'THE MASON FAMILY BOXING DAY QUIZ'); g.fillStyle = '#fff'; g.font = '34px sans-serif'; g.fillText('Boxing Day · 2pm · Uncle Martin\'s', 60, 160); g.font = '28px sans-serif'; wrapText(g, 'Find Team Paul\'s answer sheet on the coffee table. Have a nose around. Grab some food. Throw a cushion at your dad.', 60, 230, 900, 40);
      g.fillStyle = '#ffd700'; g.font = 'bold 34px sans-serif'; g.fillText(G.xr ? 'Palm up for the menu → START QUIZ' : 'Press ENTER (or NEXT) to start the quiz', 60, 470); this.drawScoresMini(g, W, H); });
    G.ui?.toast('You\'ve arrived at Uncle Martin\'s. Boxing Day, 2pm. Everyone else is already here.', 6);
    setTimeout(() => G.charByName.Paul?.say('Tommy! Get in! Grab the answer sheet, we\'re winning this year.'), 2500);
    setTimeout(() => this.mSay('Right, everyone, settle down. Quiz in a minute. First: the Outfit Wheel!', 1), 9000);
    this.autoStart = G.time + 75;
  }
  next() {
    if (this.phase === 'arrival') return this.outfitWheel();
    if (this.phase === 'question' && this.myAnswer() !== null) { this.t = Math.max(this.t, this.qTime - 2); return; }
    if (this.phase === 'roundEnd') return this.afterRound();
    if (this.phase === 'end') return location.reload();
  }
  outfitWheel() {
    if (this.phase !== 'arrival') return; this.phase = 'wheel'; this.t = 0;
    sfx('whistle', this.martin()?.headPos(new THREE.Vector3()), 1);
    this.mSay('Gary\'s Outfit Wheel! Spin it!');
    const labels = OUTFITS.map(o => o.label.split(' (')[0]); const colors = ['#c1121f', '#2d6a4f', '#d4af37', '#1d3557', '#7b2cbf', '#e76f51'];
    const target = OUTFITS.findIndex(o => o.id === G.garyOutfit.id); const n = labels.length;
    const finalAngle = -((target + 0.5) / n) * Math.PI * 2 + Math.PI * 2 * 6; const start = G.time;
    G.screens.setTV((g, W, H) => { tvFrame(g, W, H, "GARY'S OUTFIT WHEEL", '#2d6a4f'); const k = clamp((G.time - start) / 6, 0, 1); const e = 1 - Math.pow(1 - k, 3); drawWheel(g, 420, 320, 230, labels, colors, finalAngle * e);
      if (k >= 1) { g.fillStyle = '#ffd700'; g.font = 'bold 34px sans-serif'; wrapText(g, 'THIS YEAR: ' + G.garyOutfit.label, 700, 200, 300, 44); } });
    setTimeout(() => {
      sfx('cheer', null, 0.6); this.mSay('Gary! Come on out!');
      const gary = G.charByName.Gary; const gb = gary?.brain;
      if (gary && gb) { gb.state = 'idle'; gary.teleport(-3.6, 0, 1.05, Math.PI / 2); G.ai.goHome(gb); setTimeout(() => { gary.say(G.garyOutfit.id === 'mrsclaus' ? 'Call me Gail.' : pick(['Fair enough.', 'Evening all.', 'Not a word, Paul.'])); for (const n of ['Debbie', 'Kirsty', 'Jodie', 'Hollie']) { const o = G.charByName[n]; if (o) { o.gesture = 'laughDouble'; setTimeout(() => o.gesture = null, 4000); } } G.charByName.Mason?.say('GARY BUM!'); if (G.garyOutfit.id === 'mankini') G.charByName.Julie?.say('Mason, close your eyes!'); }, 3500);
        if (G.garyOutfit.onShelf) setTimeout(() => { gary.teleport(-3.2, 0, -0.9, Math.PI / 2); gb.state = 'scripted'; gb.timer = 9999; gary.base = 'sit'; gary.seatY = 1.42; G.ui?.toast('Martin has put Gary on the bookshelf. (Elf on the Shelf.) Grab him down!', 6); }, 6000);
      }
      emit('outfitRevealed', G.garyOutfit);
      setTimeout(() => this.startRound(0), 9000);
    }, 6500);
  }
  startRound(r) {
    this.round = r; this.qi = -1; this.phase = 'roundIntro'; this.t = 0;
    const R = ROUNDS[r]; const qs = r === 3 ? shuffle([...PICTURES]).slice(0, this.qPer) : shuffle(this.bank.filter(q => q.round === R.id)).slice(0, this.qPer);
    this.questions = qs.map(q => { const opts = shuffle([q.answer, ...q.wrong]); return { ...q, opts, correct: opts.indexOf(q.answer), answers: { paul: null, martin: null, debbie: null }, charli: null, paulPush: null }; });
    sfx('whistle', this.martin()?.headPos(new THREE.Vector3()), 1); this.stats.whistles++;
    this.mSay(`Quiet please! ${R.name}.`);
    emit('roundStart', r);
    G.screens.setTV((g, W, H) => { tvFrame(g, W, H, R.name.toUpperCase()); g.fillStyle = '#fff'; g.font = '30px sans-serif'; wrapText(g, `${this.questions.length} questions. Write your answers on the sheet (keys 1–4, tap the buttons, or poke the sheet in VR).`, 60, 170, 900, 42);
      g.fillStyle = '#ffd700'; g.font = 'bold 30px sans-serif'; g.fillText(this.jokers.paul === null ? 'Team Paul: you can still play your JOKER on this round (J / menu) for double points!' : 'Team Paul joker played on round ' + (this.jokers.paul + 1), 60, 330); this.drawScoresMini(g, W, H); });
    setTimeout(() => this.nextQuestion(), 6000);
  }
  nextQuestion() {
    this.qi++;
    if (this.qi >= this.questions.length) return this.collect();
    const q = this.questions[this.qi]; this.cur = q; this.phase = 'question'; this.t = 0; this.qTime = G.settings.difficulty === 'relaxed' ? 40 : 28; this.questionLive = true;
    this.paulOverruled = false; this.paulStopped = false;
    const text = `Question ${this.qi + 1}. ${q.q}`;
    this.mSay(text, 2);
    // Charli whispers (she's usually right about telly)
    const ch = G.charByName.Charli; const knows = Math.random() < (q.round === 'telly' ? 0.85 : 0.6);
    q.charli = knows ? q.correct : Math.floor(Math.random() * 4);
    setTimeout(() => { if (ch && !ch.isDown()) ch.say(`Psst. It's ${q.opts[q.charli]}.`, { prio: 0 }); }, rand(5000, 9000));
    // Paul has an opinion (it's usually wrong, and loud)
    const paulKnows = Math.random() < (q.round === 'sport' ? 0.45 : 0.3);
    q.paulPick = paulKnows ? q.correct : (q.correct + 1 + Math.floor(Math.random() * 3)) % 4;
    if (q.arg && Math.random() < 0.5) setTimeout(() => { const p = G.charByName.Paul; if (p && !p.isDown() && p.brain?.state !== 'asleep') p.say(q.arg.includes('Paul') ? q.arg.replace(/^Paul:\s*/, '').replace(/"/g, '') : q.arg, { prio: 0 }); }, 11000);
    this.drawQuestionTV();
    this.drawSheet();
    emit('question', q);
  }
  drawQuestionTV() {
    const q = this.cur; const R = ROUNDS[this.round];
    G.screens.setTV((g, W, H) => {
      tvFrame(g, W, H, `${R.name.split(':')[0]} · Q${this.qi + 1}/${this.questions.length}`);
      const pic = q.draw ? 1 : 0;
      if (pic) { g.save(); g.translate(40, 90); q.draw(g, 440, 380); g.restore(); }
      g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; const x0 = pic ? 510 : 50; const y = wrapText(g, q.q, x0, 130, W - x0 - 40, 42);
      const mine = this.myAnswer();
      q.opts.forEach((o, i) => { const yy = Math.max(y + 10, 250) + i * 62; g.fillStyle = mine === i ? '#d23b3b' : 'rgba(255,255,255,0.12)'; g.fillRect(x0, yy - 38, W - x0 - 40, 52); g.fillStyle = '#ffd700'; g.font = 'bold 30px sans-serif'; g.fillText(LETTERS[i], x0 + 12, yy); g.fillStyle = '#fff'; g.font = '30px sans-serif'; g.fillText(o, x0 + 60, yy); });
      const left = Math.max(0, this.qTime - this.t); g.fillStyle = left < 6 ? '#ff5050' : '#ffd700'; g.font = 'bold 40px sans-serif'; g.fillText(Math.ceil(left) + 's', W - 110, 50);
      this.drawScoresMini(g, W, H);
    });
  }
  myAnswer() { return this.cur ? this.cur.answers.paul : null; }
  answer(i) {
    if (this.phase === 'heist') return this.heistChange(i);
    if (this.phase !== 'question' || !this.cur) return;
    if (G.systems?.deadPens && !this.holdingGoodPen()) { G.ui?.toast('None of the pens work! Find the one good pen (grab a pen and USE it to test).', 4); return; }
    const q = this.cur; q.answers.paul = i; sfx('click', null, 0.6); this.drawSheet(); this.drawQuestionTV();
    G.ui?.toast(`Team Paul writes: ${LETTERS[i]} — ${q.opts[i]}`, 2);
    if (i !== q.paulPick && !this.paulOverruled && Math.random() < 0.6) this.paulOverrule(q);
    emit('answered', q, i);
  }
  holdingGoodPen() { const h = G.player.heldItem('D') || G.player.heldItem('R') || G.player.heldItem('L'); return h && h === this.goodPen; }
  paulOverrule(q) {
    const p = G.charByName.Paul; if (!p || p.isDown() || p.brain?.state === 'asleep' || G.time < (p.mouthFull || 0)) return;
    this.paulOverruled = true; const pick2 = q.paulPick;
    p.say(`No no no, put ${q.opts[pick2]}! Trust me.`, { prio: 1 }); p.gesture = 'point'; setTimeout(() => p.gesture === 'point' && (p.gesture = null), 2000);
    G.ui?.toast('Paul is overruling you! Stop him (cushion, mince pie, or a firm shove) or he\'ll change it.', 4);
    this.stats.argued++;
    setTimeout(() => {
      if (this.cur !== q || this.phase !== 'question' || this.paulStopped || p.isDown() || G.time < (p.mouthFull || 0)) { if (this.cur === q) G.ui?.toast('Paul has been stopped. Your answer stands.', 2); return; }
      q.answers.paul = pick2; q.paulChanged = true; sfx('click'); this.drawSheet(); this.drawQuestionTV(); G.ui?.toast(`Paul grabbed the pen and changed it to ${q.opts[pick2]}.`, 3); emit('paulChanged', q);
    }, 4500);
  }
  update(dt) {
    this.t += dt;
    if (this.phase === 'arrival' && G.time > this.autoStart) this.outfitWheel();
    if (this.phase === 'question') {
      if (G.frame % 10 === 0) this.drawQuestionTV();
      if (this.t > this.qTime) this.endQuestion();
    }
    // keep Team Paul's sheet plane glued to the clipboard
    const s = this.sheetItem; if (s && s.alive) { const t = s.body.translation(), r = s.body.rotation(); this.sheetPlane.position.set(t.x, t.y, t.z); this.sheetPlane.quaternion.set(r.x, r.y, r.z, r.w); this.sheetPlane.rotateX(-Math.PI / 2); this.sheetPlane.translateZ(0.0095); this.sheetPlane.translateY(0.01); this.sheetPlane.visible = true; } else this.sheetPlane.visible = false;
  }
  endQuestion() {
    const q = this.cur; this.questionLive = false;
    // other teams answer
    for (const t of ['martin', 'debbie']) {
      let sk = SKILL[t][q.round] ?? 0.6; if (t === 'debbie' && G.garyOutfit?.noPen) sk -= 0.1; if (t === 'debbie' && G.systems?.debbieOut) { q.answers[t] = null; continue; }
      if (t === 'martin' && G.systems?.weddingTakeover) sk -= 0.15;
      q.answers[t] = Math.random() < sk ? q.correct : (q.correct + 1 + Math.floor(Math.random() * 3)) % 4;
    }
    // Mason shouts the right answer sometimes
    if (Math.random() < 0.12) { const m = G.charByName.Mason; if (m) { m.say(q.opts[q.correct].toUpperCase() + '!', { prio: 1 }); setTimeout(() => { this.mSay('Did Mason just... Team Martin, he\'s on your sofa, that\'s your point.', 1); }, 2000); q.masonShout = true; } }
    if (q.answers.paul !== null && q.answers.paul !== q.correct && q.charli === q.correct) { this.stats.toldYou++; saveStore('toldYou', this.stats.toldYou); setTimeout(() => G.charByName.Charli?.bark('toldyou', { prio: 1 }), 1500); q.toldYou = true; }
    this.history.push(q);
    this.phase = 'between'; this.cur = null; this.drawSheet();
    setTimeout(() => this.nextQuestion(), 1800);
  }
  collect() {
    this.phase = 'collect'; this.mSay('Pens down! Swap your sheets. Team Martin marks Team Paul, Team Debbie marks Team Martin, Team Paul marks Team Debbie.');
    sfx('whistle', this.martin()?.headPos(new THREE.Vector3()), 1);
    G.screens.setTV((g, W, H) => { tvFrame(g, W, H, 'PENS DOWN — SWAP SHEETS'); g.fillStyle = '#fff'; g.font = '30px sans-serif'; wrapText(g, 'Team Martin is marking YOUR sheet. Watch them like a hawk. Put your hand up (Q / raise your hand) to challenge a mark.', 60, 170, 900, 42); this.drawScoresMini(g, W, H); });
    // the answer-sheet heist (sometimes): Martin turns away for 30 seconds
    if (Math.random() < 0.55 || G.systems?.forceHeist) setTimeout(() => this.startHeist(), 4000);
    else setTimeout(() => this.marking(), 5000);
  }
  startHeist() {
    this.phase = 'heist'; this.t = 0; this.heistUsed = false;
    this.mSay('Hang on, where are my reading glasses... Julie! Have you seen my glasses?');
    G.ai?.sendTo('Martin', new THREE.Vector3(3.0, 0, 1.7), null, 1.0);
    G.screens.setTV((g, W, H) => { tvFrame(g, W, H, 'MARTIN HAS TURNED AWAY', '#c1121f'); g.fillStyle = '#fff'; g.font = '30px sans-serif'; const left = Math.max(0, 30 - this.t); wrapText(g, `Sneak to your sheet and change ONE answer (keys 1–4 / tap / poke). Don't let Debbie see you. ${Math.ceil(left)}s`, 60, 170, 900, 42); this.drawScoresMini(g, W, H); });
    G.ui?.toast('HEIST! 30 seconds. Change one wrong answer on your sheet. If Debbie sees you, she\'ll scream.', 6);
    this.heistIdx = this.history.findIndex(q => q.answers.paul !== q.correct && this.questions.includes(q));
    const tick = setInterval(() => { if (this.phase !== 'heist') return clearInterval(tick); G.screens.redraw(); if (this.t > 30) { clearInterval(tick); G.ai?.release('Martin'); this.mSay('Found them. On my head. Right!'); this.marking(); } }, 500);
  }
  heistChange(i) {
    if (this.heistUsed) return G.ui?.toast('You already changed one. Don\'t push it.');
    const s = this.sheetItem; if (s) { const t = s.body.translation(); const d = G.player.pos.distanceTo(new THREE.Vector3(t.x, 0, t.z)); if (d > 2.2 && !G.player.heldItem()) return G.ui?.toast('Get to your answer sheet first (it\'s a clipboard).'); }
    const target = this.questions.find(q => q.answers.paul !== q.correct) || this.questions[0];
    target.answers.paul = target.opts.indexOf(target.opts[i]); target.changed = true; this.heistUsed = true; this.stats.changed++; G.player.stats.changed++;
    sfx('click'); this.drawSheet();
    // did Debbie see?
    const deb = G.charByName.Debbie; let seen = false;
    if (deb && !deb.isDown() && deb.brain?.state !== 'storm') { const to = G.player.pos.clone().sub(deb.pos); const d = to.length(); to.y = 0; to.normalize(); const fw = deb.facing(new THREE.Vector3()); if (d < 7 && fw.dot(to) > 0.2) seen = true; }
    if (seen) { deb.say('OI! HE\'S CHANGING HIS ANSWERS! MARTIN!', { prio: 2 }); deb.setMood('shock', 3); G.ui?.toast('Debbie saw you! VAR review...', 4); emit('heistCaught'); this.bonus.paul -= 2; G.replay?.trigger('VAR: ANSWER SHEET HEIST', G.player.pos.clone()); }
    else { G.ui?.toast(`Changed Q${this.questions.indexOf(target) + 1} to "${target.opts[i]}". Nobody saw. Probably.`, 4); emit('heistSuccess'); }
  }
  marking() {
    this.phase = 'marking'; this.t = 0; this.markIdx = -1; this.marks = [];
    // Team Martin marks Team Paul (harshly); Team Debbie marks Team Martin (fairly); you mark Team Debbie (fairly, automatically)
    const reasons = ['written in capitals', 'spelling', 'not specific enough', 'illegible', 'that\'s not what\'s on my sheet', 'you crossed it out', 'Martin "didn\'t see it"'];
    for (const q of this.questions) {
      const mine = q.answers.paul; let mark = mine === q.correct ? 1 : 0; let reason = '';
      if (mark === 1 && Math.random() < 0.18) { mark = 0; reason = pick(reasons); this.stats.biased++; }
      if (mine === null) { mark = 0; reason = 'blank'; }
      this.marks.push({ q, mark, reason, disputed: false });
      for (const t of ['martin', 'debbie']) { let m = q.answers[t] === q.correct ? 1 : 0; if (t === 'martin' && m === 0 && Math.random() < 0.25) { m = 0.5; this.stats.biased++; } if (q.masonShout && t === 'martin') m = Math.max(m, 1); q['mark_' + t] = m; }
    }
    this.mSay('Marking time. Let\'s see Team Paul\'s effort...');
    this.revealNext();
  }
  revealNext() {
    this.markIdx++;
    if (this.markIdx >= this.marks.length) return this.finishMarking();
    const mk = this.marks[this.markIdx]; const q = mk.q;
    this.drawMarkingTV();
    const msg = mk.mark ? pick(['Correct. Fine.', 'One point. Reluctantly.', 'Yes. Annoyingly.']) : (mk.reason && q.answers.paul === q.correct ? `Wrong. ${mk.reason[0].toUpperCase() + mk.reason.slice(1)}.` : pick(['Wrong!', 'Nope.', 'Paul, you get nothing.']));
    this.mSay(`Question ${this.markIdx + 1}: ${msg}`, 1);
    if (!mk.mark && q.answers.paul === q.correct) { G.ui?.toast('That was RIGHT! Put your hand up (Q / raise hand / thumbs down) to dispute it!', 4); const p = G.charByName.Paul; p && !p.isDown() && setTimeout(() => p.say('That\'s what I put! That\'s RIGHT, Martin!'), 1200); }
    if (!mk.mark && q.paulChanged) setTimeout(() => G.charByName.Charli?.say('Dad changed that. I SAID THAT.', { prio: 1 }), 1500);
    clearTimeout(this.revealTimer); this.revealTimer = setTimeout(() => this.revealNext(), mk.mark ? 3200 : 5500);
  }
  drawMarkingTV() {
    G.screens.setTV((g, W, H) => {
      tvFrame(g, W, H, `MARKING — TEAM PAUL (marked by Team Martin)`, '#1d3557');
      this.marks.forEach((mk, i) => { if (i > this.markIdx) return; const y = 115 + i * 44; const q = mk.q; g.font = '22px sans-serif'; g.fillStyle = i === this.markIdx ? '#fff' : '#9ab';
        g.fillText(`${i + 1}. ${q.q.slice(0, 48)}${q.q.length > 48 ? '…' : ''}`, 30, y); g.fillText(`You: ${q.answers.paul === null ? '—' : q.opts[q.answers.paul]}`, 600, y);
        g.font = 'bold 30px sans-serif'; g.fillStyle = mk.mark === 1 ? '#5f5' : mk.mark === 0.5 ? '#fd5' : '#f55'; g.fillText(mk.mark === 1 ? '✓' : mk.mark === 0.5 ? '½' : '✗', 880, y); if (mk.reason) { g.font = '16px sans-serif'; g.fillStyle = '#fbb'; g.fillText(mk.reason, 910, y); } if (mk.disputed) { g.fillStyle = '#ffd700'; g.font = '16px sans-serif'; g.fillText(mk.disputed, 910, y + 16); } });
      this.drawScoresMini(g, W, H);
    });
  }
  handUp() {
    if (this.phase === 'marking') return this.dispute();
    if (this.phase === 'question') { G.ui?.toast('You put your hand up. Martin: "Questions at the END, Tommy."'); return; }
    G.ui?.toast('You put your hand up. Nobody notices.');
  }
  dispute() {
    const mk = this.marks[this.markIdx]; if (!mk || this.wheelSpinning) return;
    if (mk.mark === 1) { this.mSay('You got that one RIGHT, Tommy. What are you disputing?', 1); return; }
    if (mk.disputed) return;
    clearTimeout(this.revealTimer);
    this.stats.disputes++; G.player.stats.disputes++; mk.disputed = 'disputed…';
    this.mSay('A dispute. Fine. Spin the Dispute Wheel.', 2); sfx('drum', null, 0.6);
    const labels = ['Allow', 'Half point', 'Deny', 'Google it', 'Ask Karen', 'Deny', 'Allow', 'Google it']; const colors = ['#2d6a4f', '#d4af37', '#c1121f', '#1d3557', '#7b2cbf'];
    const res = Math.floor(Math.random() * labels.length); const n = labels.length; const finalA = -((res + 0.5) / n) * Math.PI * 2 + Math.PI * 10; const start = G.time; this.wheelSpinning = true;
    G.screens.setTV((g, W, H) => { tvFrame(g, W, H, 'THE DISPUTE WHEEL', '#7b2cbf'); const k = clamp((G.time - start) / 4, 0, 1); drawWheel(g, 420, 320, 230, labels, colors, finalA * (1 - Math.pow(1 - k, 3))); if (k >= 1) { g.fillStyle = '#ffd700'; g.font = 'bold 44px sans-serif'; g.fillText(labels[res].toUpperCase(), 690, 300); } });
    setTimeout(() => {
      this.wheelSpinning = false; let outcome = labels[res]; const right = mk.q.answers.paul === mk.q.correct;
      const resolve = (o, line) => { if (line) this.mSay(line, 2); if (o === 'allow') { mk.mark = 1; mk.disputed = 'ALLOWED'; this.stats.disputesWon++; } else if (o === 'half') { mk.mark = 0.5; mk.disputed = 'HALF POINT'; } else { mk.disputed = 'DENIED'; G.systems?.banter(8, 'denied dispute'); } this.drawMarkingTV(); this.revealTimer = setTimeout(() => this.revealNext(), 3500); emit('disputeResolved', o); };
      if (outcome === 'Allow') resolve(right ? 'allow' : 'deny', right ? 'I\'ll allow it.' : 'Allowed... no, wait, it\'s still wrong. Denied.');
      else if (outcome === 'Half point') resolve(right ? 'half' : 'deny', right ? 'Half a point. For the spirit of the answer.' : 'Half a point? For THAT? No.');
      else if (outcome === 'Deny') resolve('deny', 'Denied. My house, my quiz, my answers.');
      else if (outcome === 'Google it') { const h = G.charByName.Hollie; h?.say('Googling it...'); setTimeout(() => { if (Math.random() < 0.33) { h?.say('This website says... the opposite?'); G.charByName.Paul?.say('SEE?! Wait, which website?'); resolve('deny', 'The internet says no. Denied.'); this.stats.argued++; } else { h?.say('It\'s right, Martin.'); resolve(right ? 'allow' : 'deny', right ? 'The internet has spoken. Allowed.' : 'Google says wrong. Denied.'); } }, 2500); }
      else { const k = G.charByName.Karen; if (k && !k.isDown()) { k.say(right ? 'It\'s right, Martin. Give him the point.' : 'It\'s wrong, love.'); resolve(right ? 'allow' : 'deny'); } else resolve('deny', 'Karen\'s on the floor. Denied.'); }
    }, 4300);
  }
  finishMarking() {
    let gained = { paul: 0, martin: 0, debbie: 0 };
    for (const mk of this.marks) gained.paul += mk.mark;
    for (const q of this.questions) { gained.martin += q.mark_martin || 0; gained.debbie += q.mark_debbie || 0; }
    for (const t in gained) { if (this.jokers[t] === this.round) gained[t] *= 2; this.scores[t] += gained[t]; }
    // Team Martin's joker is "remembered" on round 2 (index 1); Debbie on 4
    this.phase = 'roundEnd'; this.t = 0;
    const lead = ['paul', 'martin', 'debbie'].sort((a, b) => this.total(b) - this.total(a))[0];
    this.mSay(`End of round. Team Paul ${gained.paul}, Team Martin ${gained.martin}, Team Debbie ${gained.debbie}.${lead === 'martin' ? ' Team Martin leading, as is right and proper.' : ''}`, 2);
    if (this.jokers.paul === null && this.round >= 1 && Math.random() < 0.7) setTimeout(() => G.charByName.Paul?.say('JOKER! We were playing the joker on that! ...Weren\'t we?'), 3000);
    G.screens.setTV((g, W, H) => { tvFrame(g, W, H, `END OF ${ROUNDS[this.round].name.split(':')[0].toUpperCase()}`); this.drawBigScores(g, W, H); g.fillStyle = '#ffd700'; g.font = 'bold 28px sans-serif'; g.fillText(this.round < 4 ? 'Next: mini-game in the games room (or press NEXT)' : 'Final scores are in...', 60, 520); });
    emit('roundEnd', this.round);
    this.roundEndTimer = setTimeout(() => this.afterRound(), 12000);
  }
  afterRound() {
    if (this.phase !== 'roundEnd') return; clearTimeout(this.roundEndTimer);
    if (this.round >= 4) return this.final();
    this.phase = 'minigame';
    G.minigames.start(this.round, () => this.startRound(this.round + 1));
  }
  playJoker() {
    if (this.jokers.paul !== null) return G.ui?.toast('Joker already played.');
    if (this.round < 0) return G.ui?.toast('Play the joker once a round has started.');
    if (this.phase === 'marking' || this.phase === 'roundEnd') { G.ui?.toast('Too late! The round\'s been marked. (Paul, every year.)'); G.charByName.Paul?.say('That\'s ridiculous, we said joker earlier!'); return; }
    this.jokers.paul = this.round; sfx('ding'); G.ui?.toast('JOKER played: double points this round!'); this.mSay('Team Paul play their joker. Bold.', 1);
  }
  accuse(p) {
    if (!p) return G.ui?.toast('Point at someone (or look at them) to accuse them.');
    const s = G.systems; const guilty = s?.cheater === p;
    if (guilty) { G.ui?.toast(`Caught! ${p.name} was cheating. +1 to Team Paul, -1 to ${this.teamName(p.team)}.`, 4); this.bonus.paul += 1; this.bonus[p.team] -= 1; p.say('I was checking the TIME!'); s.cheater = null; G.replay?.trigger('VAR: CHEATING', p.pos.clone()); emit('caught', p); }
    else { G.ui?.toast(`You accuse ${p.name}. They were not cheating. Awkward.`, 3); p.say(pick(['Excuse me?!', 'I was not!', 'Cheek of it.'])); G.systems?.banter(6, 'false accusation'); }
  }
  pokeSheet(u, v) { if (this.phase !== 'question' && this.phase !== 'heist') return false; if (v < 0.42 || v > 0.92) return false; const i = Math.floor((v - 0.42) / 0.125); if (i < 0 || i > 3) return false; this.answer(i); return true; }
  openSheet(inst) { if (inst === this.sheetItem) { if (this.phase === 'question' || this.phase === 'heist') G.ui?.openAnswerPicker(); else G.ui?.toast('Team Paul\'s answer sheet. Questions appear on the TV when the quiz starts.'); } else { G.ui?.toast('Another team\'s sheet. Their handwriting is terrible.'); } }
  drawSheet() {
    const g = this.sheetTex.userData.ctx, W = 512, H = 720;
    g.fillStyle = '#fbfaf4'; g.fillRect(0, 0, W, H); g.strokeStyle = '#9ac'; for (let y = 120; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.strokeStyle = '#e88'; g.beginPath(); g.moveTo(60, 0); g.lineTo(60, H); g.stroke();
    g.fillStyle = '#1d3557'; g.font = 'bold 40px "Comic Sans MS", cursive'; g.fillText('TEAM PAUL', 80, 60); g.font = '24px "Comic Sans MS", cursive'; g.fillText(this.round >= 0 ? ROUNDS[this.round].name.split(':')[0] : 'Boxing Day Quiz', 80, 100);
    if (this.cur && (this.phase === 'question')) {
      g.font = 'bold 26px sans-serif'; g.fillStyle = '#333'; wrapText(g, `Q${this.qi + 1}: ${this.cur.q}`, 70, 160, 420, 30);
      this.cur.opts.forEach((o, i) => { const y = 302 + i * 90; const sel = this.cur.answers.paul === i; g.strokeStyle = sel ? '#c1121f' : '#aaa'; g.lineWidth = sel ? 6 : 2; g.strokeRect(70, y, 420, 74); g.fillStyle = sel ? '#c1121f' : '#222'; g.font = '30px "Comic Sans MS", cursive'; g.fillText(`${LETTERS[i]}  ${o}`.slice(0, 26), 86, y + 48); });
    } else {
      g.font = '24px "Comic Sans MS", cursive'; g.fillStyle = '#222';
      (this.questions || []).forEach((q, i) => { if (q.answers.paul === null && !this.history.includes(q)) return; g.fillText(`${i + 1}. ${q.answers.paul === null ? '—' : q.opts[q.answers.paul]}`.slice(0, 30), 80, 160 + i * 40); });
    }
    g.fillStyle = 'rgba(200,120,40,0.15)'; g.beginPath(); g.ellipse(400, 640, 50, 35, 0.3, 0, 7); g.fill(); // tea ring
    this.sheetTex.needsUpdate = true;
  }
  drawScoresMini(g, W, H) {
    g.font = 'bold 22px sans-serif'; let x = W - 560; const y = H - 20;
    for (const t of ['paul', 'martin', 'debbie']) { g.fillStyle = this.teamColor(t); g.fillRect(x, y - 22, 14, 26); g.fillStyle = '#fff'; g.fillText(`${this.teamName(t).replace('Team ', '')} ${this.total(t)}`, x + 20, y); x += 180; }
    const s = G.systems; if (s) { g.fillStyle = '#9f9'; g.fillText('🦖 ' + ['Calm', 'Busy', 'Wild', 'CHAOS'][s.havocLevel()], 20, y); g.fillStyle = '#fff'; g.fillText('TV dmg ' + (s.tvDamage || 0), 200, y); }
  }
  drawBigScores(g, W, H) {
    const order = ['paul', 'martin', 'debbie'];
    order.forEach((t, i) => { const y = 170 + i * 100; g.fillStyle = this.teamColor(t); g.fillRect(60, y - 60, 20, 80); g.fillStyle = '#fff'; g.font = 'bold 54px sans-serif'; g.fillText(this.teamName(t), 100, y); g.fillText(String(this.total(t)), 700, y); });
    g.font = '18px sans-serif'; g.fillStyle = '#9ab'; g.fillText('(The PC in the games room disagrees by 2. Nobody knows which is right.)', 60, 470);
  }
  // ---------------- the end ----------------
  final() {
    this.phase = 'final'; const t = (x) => this.total(x);
    const order = ['paul', 'martin', 'debbie'].sort((a, b) => t(b) - t(a));
    if (t(order[0]) === t(order[1])) {
      this.mSay('We have a TIE. Tie-break: closest guess. How many sprouts did Julie cook?', 2); G.charByName.Paul && setTimeout(() => G.charByName.Paul.say('A million.'), 3500);
      G.ui?.askNumber('Tie-break: how many sprouts did Julie cook?', (n) => { const real = 87; const other = Math.round(rand(40, 140)); const winTie = Math.abs(n - real) <= Math.abs(other - real); this.bonus[winTie && order.includes('paul') ? 'paul' : order[0] === 'paul' ? order[1] : order[0]] += 1; this.mSay(`It was ${real} sprouts. ${winTie ? 'Team Paul are closer. Unbelievable.' : 'Closest guess wins it.'}`); setTimeout(() => this.ceremony(), 4000); });
      return;
    }
    this.ceremony();
  }
  ceremony() {
    this.phase = 'ceremony'; const order = ['paul', 'martin', 'debbie'].sort((a, b) => this.total(b) - this.total(a)); this.winner = order[0];
    sfx('drum', null, 1); this.mSay('The final scores...', 2);
    G.screens.setTV((g, W, H) => { tvFrame(g, W, H, 'FINAL SCORES'); this.drawBigScores(g, W, H); });
    setTimeout(() => { G.charByName.Paul?.say('RECOUNT! The PC says different!'); G.charByName.Kirsty?.say('My tally says different too!'); }, 4000);
    setTimeout(() => { this.mSay('And the Mason Cup goes to... Team Martin! ...Oh. Sorry, sorry, misread it. ' + this.teamName(this.winner) + '!', 2); }, 9000);
    setTimeout(() => G.ceremony?.run(this.winner), 15000);
  }
}
