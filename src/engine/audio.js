// Audio: synthesized positional sound effects (WebAudio) + character voices (speechSynthesis).
import * as THREE from 'three';
import { G, rand, pick, emit } from '../core.js';

let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
const listenerPos = new THREE.Vector3();
let muteUntil = 0;

export function initAudio() {
  if (ctx) return;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.25; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  G.audio = api;
}
export function resumeAudio() { if (ctx && ctx.state !== 'running') ctx.resume(); }

const _f = new THREE.Vector3(), _u = new THREE.Vector3();
export function updateListener(cam) {
  if (!ctx) return;
  cam.getWorldPosition(listenerPos);
  cam.getWorldDirection(_f);
  _u.set(0, 1, 0).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()));
  const L = ctx.listener;
  if (L.positionX) {
    L.positionX.value = listenerPos.x; L.positionY.value = listenerPos.y; L.positionZ.value = listenerPos.z;
    L.forwardX.value = _f.x; L.forwardY.value = _f.y; L.forwardZ.value = _f.z;
    L.upX.value = _u.x; L.upY.value = _u.y; L.upZ.value = _u.z;
  } else { L.setPosition(listenerPos.x, listenerPos.y, listenerPos.z); L.setOrientation(_f.x, _f.y, _f.z, _u.x, _u.y, _u.z); }
}
export function setMuted(seconds) { muteUntil = performance.now() + seconds * 1000; if (master) master.gain.setTargetAtTime(0.05, ctx.currentTime, 0.05); setTimeout(() => master && master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.2), seconds * 1000); }

function out(pos, vol = 1) {
  const g = ctx.createGain(); g.gain.value = vol;
  if (pos) {
    const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1.2; p.rolloffFactor = 1.1;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
    g.connect(p); p.connect(sfxBus);
  } else g.connect(sfxBus);
  return g;
}
function osc(type, f0, f1, dur, dest, t0 = 0, vol = 1) {
  const t = ctx.currentTime + t0;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  return o;
}
function noise(dur, dest, filterType = 'lowpass', freq = 1000, t0 = 0, vol = 1, q = 1) {
  const t = ctx.currentTime + t0;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  return f;
}

// Named sound library
const SFX = {
  boff(d) { osc('sine', 160, 60, 0.18, d, 0, 0.9); noise(0.12, d, 'lowpass', 900, 0, 0.6); },
  oof(d) { const f = rand(0.8, 1.2); osc('sawtooth', 180 * f, 110 * f, 0.22, d, 0, 0.25); noise(0.2, d, 'bandpass', 700 * f, 0, 0.3, 4); },
  thud(d) { osc('sine', 90, 40, 0.3, d, 0, 1); noise(0.15, d, 'lowpass', 400, 0, 0.7); },
  bigthud(d) { osc('sine', 70, 30, 0.45, d, 0, 1); noise(0.3, d, 'lowpass', 300, 0, 0.9); },
  tap(d) { noise(0.05, d, 'bandpass', 2500, 0, 0.4, 2); },
  clink(d) { osc('sine', 2400, 2300, 0.25, d, 0, 0.3); osc('sine', 3600, 3500, 0.2, d, 0, 0.15); },
  smash(d) { for (let i = 0; i < 6; i++) osc('sine', rand(2000, 5000), rand(1500, 4000), 0.2, d, i * 0.02, 0.15); noise(0.3, d, 'highpass', 3000, 0, 0.5); },
  squeak(d) { osc('sine', 900, 1600, 0.12, d, 0, 0.4); osc('sine', 1600, 1100, 0.1, d, 0.11, 0.3); },
  cushion(d) { noise(0.18, d, 'lowpass', 500, 0, 0.6); osc('sine', 500, 900, 0.1, d, 0, 0.12); },
  splat(d) { noise(0.25, d, 'lowpass', 1200, 0, 0.8); osc('sine', 200, 80, 0.15, d, 0, 0.4); },
  pop(d) { osc('sine', 600, 120, 0.08, d, 0, 0.9); noise(0.06, d, 'highpass', 2000, 0, 0.7); noise(0.6, d, 'bandpass', 6000, 0.05, 0.15, 1); },
  fizz(d) { noise(0.8, d, 'highpass', 5000, 0, 0.2); },
  crunch(d) { for (let i = 0; i < 4; i++) noise(0.05, d, 'bandpass', rand(1500, 3500), i * 0.06, 0.5, 3); },
  sip(d) { noise(0.25, d, 'bandpass', 1200, 0, 0.25, 6); },
  whistle(d) { const o = osc('sine', 2900, 2900, 0.7, d, 0, 0.35); const l = ctx.createOscillator(); const lg = ctx.createGain(); l.frequency.value = 28; lg.gain.value = 120; l.connect(lg); lg.connect(o.frequency); l.start(); l.stop(ctx.currentTime + 0.8); },
  bark(d) { const f = rand(0.9, 1.1); osc('sawtooth', 520 * f, 300 * f, 0.12, d, 0, 0.35); noise(0.1, d, 'bandpass', 900, 0, 0.4, 3); },
  yap(d) { osc('sawtooth', 900, 600, 0.08, d, 0, 0.25); },
  whine(d) { osc('sine', 1200, 1500, 0.5, d, 0, 0.12); },
  snore(d) { noise(1.2, d, 'lowpass', 220, 0, 0.35); },
  ding(d) { osc('sine', 1046, 1046, 0.9, d, 0, 0.35); osc('sine', 784, 784, 1.2, d, 0.45, 0.35); },
  beep(d) { osc('square', 3100, 3100, 0.12, d, 0, 0.15); },
  alarm(d) { for (let i = 0; i < 3; i++) osc('square', 3200, 3200, 0.15, d, i * 0.3, 0.2); },
  bauble(d) { osc('sine', rand(2500, 3200), 2000, 0.3, d, 0, 0.25); },
  slap(d) { noise(0.07, d, 'highpass', 1500, 0, 0.9); },
  boing(d) { osc('sine', 150, 450, 0.35, d, 0, 0.5); },
  rip(d) { noise(0.35, d, 'bandpass', 3000, 0, 0.5, 1); },
  crack(d) { noise(0.12, d, 'highpass', 2500, 0, 1); osc('square', 120, 60, 0.1, d, 0, 0.3); },
  drum(d) { for (let i = 0; i < 16; i++) noise(0.05, d, 'bandpass', 250, i * 0.07, 0.6, 1); osc('sine', 80, 40, 0.6, d, 1.15, 1); noise(0.5, d, 'highpass', 4000, 1.15, 0.5); },
  cheer(d) { for (let i = 0; i < 8; i++) noise(1.2, d, 'bandpass', rand(600, 1800), rand(0, 0.3), 0.15, 2); },
  click(d) { osc('square', 1800, 1800, 0.02, d, 0, 0.2); },
  zap(d) { osc('sawtooth', 200, 50, 0.4, d, 0, 0.3); },
  door(d) { osc('sine', 80, 70, 0.3, d, 0, 0.4); noise(0.2, d, 'lowpass', 600, 0, 0.3); },
  creak(d) { osc('sawtooth', 300, 420, 0.5, d, 0, 0.06); },
  flush(d) { noise(2.5, d, 'lowpass', 900, 0, 0.6); },
  kettle(d) { noise(3, d, 'bandpass', 2500, 0, 0.15, 2); },
  laugh(d) { for (let i = 0; i < 5; i++) { osc('sawtooth', 260 + rand(-20, 40), 220, 0.12, d, i * 0.16, 0.12); noise(0.1, d, 'bandpass', 900, i * 0.16, 0.12, 3); } },
  giggle(d) { for (let i = 0; i < 6; i++) osc('sine', 700 + rand(0, 200), 600, 0.08, d, i * 0.1, 0.15); },
  cry(d) { osc('sawtooth', 500, 700, 0.6, d, 0, 0.15); osc('sawtooth', 700, 450, 0.7, d, 0.6, 0.15); },
  star(d) { osc('sine', 1800, 2600, 0.2, d, 0, 0.12); },
  whoosh(d) { noise(0.35, d, 'bandpass', 800, 0, 0.35, 0.7); },
  footstep(d) { noise(0.05, d, 'lowpass', 300, 0, 0.12); },
};

export function sfx(name, pos = null, vol = 1) {
  if (!ctx || !SFX[name]) return;
  if (performance.now() < muteUntil) vol *= 0.1;
  const d = out(pos, vol * (G.settings?.sfxVol ?? 1));
  SFX[name](d);
}

// ---------- Music (public domain carols, simple synth) ----------
const NOTES = { C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, F5: 698.5, G5: 784 };
const WE_WISH = 'G4:1 C5:1 C5:.5 D5:.5 C5:.5 B4:.5 A4:1 A4:1 A4:1 D5:1 D5:.5 E5:.5 D5:.5 C5:.5 B4:1 G4:1 G4:1 E5:1 E5:.5 F5:.5 E5:.5 D5:.5 C5:1 A4:1 G4:.5 G4:.5 A4:1 D5:1 B4:1 C5:2';
const JINGLE = 'E4:1 E4:1 E4:2 E4:1 E4:1 E4:2 E4:1 G4:1 C4:1.5 D4:.5 E4:4 F4:1 F4:1 F4:1.5 F4:.5 F4:1 E4:1 E4:1 E4:.5 E4:.5 E4:1 D4:1 D4:1 E4:1 D4:2 G4:2';
let musicTimer = null, musicOn = false;
export function playMusic(which = 'wewish', loop = true, tempo = 0.32) {
  if (!ctx) return; stopMusic(); musicOn = true;
  const seq = (which === 'jingle' ? JINGLE : WE_WISH).split(' ').map(s => { const [n, l] = s.split(':'); return [NOTES[n], parseFloat(l)]; });
  let t = ctx.currentTime + 0.05;
  const total = seq.reduce((a, s) => a + s[1], 0) * tempo;
  const sched = () => {
    if (!musicOn) return;
    for (const [f, l] of seq) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + l * tempo * 0.95);
      o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + l * tempo);
      const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = 'sine'; o2.frequency.value = f * 2;
      g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o2.connect(g2); g2.connect(musicBus); o2.start(t); o2.stop(t + 0.35);
      t += l * tempo;
    }
    if (loop) musicTimer = setTimeout(sched, (total - 0.5) * 1000);
  };
  sched();
}
export function stopMusic() { musicOn = false; clearTimeout(musicTimer); }

// ---------- Voices ----------
// Each character gets a speechSynthesis voice with their own pitch/rate. Lines are also shown as
// speech bubbles + subtitles. Only one synth voice can talk at a time, so lower-priority lines are
// shown as bubbles only (the "talk-over" rule: Martin's questions take priority).
let voices = [];
function loadVoices() { voices = (window.speechSynthesis?.getVoices?.() || []); }
if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function chooseVoice(female, idx) {
  const gb = voices.filter(v => /en[-_]GB/i.test(v.lang));
  const pool = gb.length ? gb : voices.filter(v => /^en/i.test(v.lang));
  if (!pool.length) return null;
  const fem = pool.filter(v => /female|woman|libby|sonia|maisie|hazel|susan|kate|serena|fiona|martha|google uk english female/i.test(v.name));
  const mal = pool.filter(v => /male|man|ryan|thomas|george|daniel|arthur|oliver|google uk english male/i.test(v.name) && !/female/i.test(v.name));
  const p = female ? (fem.length ? fem : pool) : (mal.length ? mal : pool);
  return p[idx % p.length];
}
let speaking = null; // {char, prio}
const queue = [];
export function say(char, text, opts = {}) {
  const prio = opts.prio ?? 1;
  emit('say', char, text);
  const dur = Math.min(6, 0.8 + text.length * 0.055);
  if (char) char.talkUntil = G.time + dur;
  const voiceOn = (G.settings?.voices ?? true) && window.speechSynthesis && performance.now() > muteUntil;
  if (!voiceOn) return dur;
  if (speaking && speaking.prio > prio) return dur;  // bubble only
  if (speaking && prio >= 2) speechSynthesis.cancel();
  else if (speaking) { if (queue.length < 2 && prio >= 1) queue.push([char, text, opts]); return dur; }
  const u = new SpeechSynthesisUtterance(text);
  const vp = char?.voice || { pitch: 1, rate: 1, female: false, idx: 0 };
  const v = chooseVoice(vp.female, vp.idx || 0); if (v) u.voice = v;
  u.lang = 'en-GB'; u.pitch = vp.pitch; u.rate = vp.rate; u.volume = Math.min(1, (opts.volume ?? 1) * (G.settings?.voiceVol ?? 1));
  speaking = { char, prio };
  u.onstart = () => { if (char) char.talkUntil = G.time + 30; };
  u.onend = u.onerror = () => {
    if (char) char.talkUntil = G.time + 0.1;
    speaking = null;
    const n = queue.shift(); if (n) say(...n);
  };
  try { speechSynthesis.speak(u); } catch (e) { speaking = null; }
  return dur;
}
export function stopSpeech() { if (window.speechSynthesis) speechSynthesis.cancel(); speaking = null; queue.length = 0; }

const api = { sfx, say, playMusic, stopMusic, setMuted, stopSpeech };
export default api;
