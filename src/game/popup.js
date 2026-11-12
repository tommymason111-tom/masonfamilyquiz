// Big, phone-friendly overlays: animated title cards ("GAME ONE — BRUSSELS SPROUT THROWING"), a large timer,
// leaderboards, a big tap button (PULL!, TEAR!), and animated question cards for the quiz.
import { G } from '../core.js';

let root = null;
// what's on screen, kept as plain data too so the headset panel (vrhud.js) can draw the same pop-ups
export const S = { cards: [], timer: null, meters: null, q: null, tap: null, v: 0 };
const bump = () => { S.v++; };
const plain = (h) => String(h || '').replace(/<(br|\/div|\/p)[^>]*>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
function ensure() {
  if (root) return root;
  const st = document.createElement('style');
  st.textContent = `
  #pop { position:fixed; inset:0; z-index:40; pointer-events:none; font-family: system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  #pop .card { position:absolute; left:50%; top:44%; transform:translate(-50%,-50%) scale(.6); opacity:0; width:min(90vw,560px); padding:26px 22px 22px; border-radius:26px; text-align:center; color:#fff;
    background:radial-gradient(120% 140% at 50% 0%, var(--c1,#b3122a) 0%, var(--c2,#4a0a14) 70%); border:3px solid #ffd700; box-shadow:0 20px 60px rgba(0,0,0,.6), inset 0 0 40px rgba(255,215,0,.15);
    transition: transform .45s cubic-bezier(.2,1.6,.4,1), opacity .3s; }
  #pop .card.in { transform:translate(-50%,-50%) scale(1); opacity:1; }
  #pop .card.out { transform:translate(-50%,-60%) scale(.9); opacity:0; transition: transform .35s ease-in, opacity .35s; }
  #pop .kick { font:900 clamp(16px,4.6vw,22px) Georgia,serif; letter-spacing:.35em; color:#ffd700; text-shadow:0 2px 0 #000; }
  #pop .title { font:900 clamp(30px,9vw,54px)/1.02 Georgia,serif; margin:8px 0 10px; text-shadow:0 4px 0 rgba(0,0,0,.45), 0 0 22px rgba(255,215,0,.35); }
  #pop .sub { font-size:clamp(14px,3.8vw,18px); line-height:1.35; opacity:.95; }
  #pop .icon { font-size:clamp(40px,12vw,64px); line-height:1; animation: popBounce 1s ease-in-out infinite alternate; }
  #pop .bar { height:6px; border-radius:3px; background:rgba(255,255,255,.2); margin-top:16px; overflow:hidden; } #pop .bar i { display:block; height:100%; width:100%; background:#ffd700; transform-origin:left; }
  #pop .board { width:100%; border-collapse:collapse; margin-top:10px; font-size:clamp(15px,4.2vw,20px); }
  #pop .board td { padding:7px 8px; border-bottom:1px solid rgba(255,255,255,.15); text-align:left; } #pop .board td:last-child { text-align:right; font-weight:900; }
  #pop .board tr.me td { color:#ffd700; } #pop .board .rank { width:2em; opacity:.8; } #pop .board .sw { display:inline-block; width:12px; height:12px; border-radius:3px; margin-right:8px; vertical-align:middle; }
  #pop .board tr { animation: rowIn .4s both; }
  #pop .timer { position:absolute; left:50%; top:max(84px, env(safe-area-inset-top)); transform:translateX(-50%); padding:6px 18px; border-radius:16px; background:rgba(14,12,22,.82); border:2px solid #ffd700; color:#fff; font:900 clamp(26px,8vw,40px) Georgia,serif; display:none; text-align:center; }
  #pop .timer small { display:block; font:700 12px system-ui; letter-spacing:.2em; color:#ffd700; } #pop .timer.urgent { border-color:#ff4d4d; color:#ff6b6b; animation: pulseT .5s infinite alternate; }
  #pop .tap { position:absolute; left:50%; bottom:max(150px, 20vh); transform:translateX(-50%); width:min(46vw,190px); height:min(46vw,190px); border-radius:50%; border:4px solid #fff; background:radial-gradient(circle at 40% 35%, #ff6b6b, #b3122a); color:#fff; font:900 clamp(26px,8vw,38px) Georgia,serif; pointer-events:auto; box-shadow:0 10px 30px rgba(0,0,0,.5); touch-action:manipulation; }
  #pop .tap:active { transform:translateX(-50%) scale(.93); }
  #pop .meters { position:absolute; left:50%; top:max(150px,22vh); transform:translateX(-50%); width:min(88vw,460px); display:none; color:#fff; font:700 15px system-ui; }
  #pop .meters div { margin:6px 0; } #pop .meters .m { height:16px; border-radius:8px; background:rgba(0,0,0,.5); border:2px solid #fff; overflow:hidden; } #pop .meters .m i { display:block; height:100%; width:0; background:#ffd700; transition:width .1s; }
  #pop .qcard { position:absolute; left:50%; top:max(84px,11vh); transform:translate(-50%,-30px); opacity:0; width:min(94vw,640px); border-radius:22px; padding:14px 14px 12px; color:#fff; background:linear-gradient(180deg,#1d3557,#0d1b2e); border:3px solid #ffd700; box-shadow:0 14px 40px rgba(0,0,0,.55); transition: transform .4s cubic-bezier(.2,1.5,.4,1), opacity .3s; pointer-events:auto; }
  #pop .qcard.in { transform:translate(-50%,0); opacity:1; }
  #pop .qcard .qn { padding-right:46px; font:900 13px system-ui; letter-spacing:.25em; color:#ffd700; } #pop .qcard .qq { font:800 clamp(18px,5.4vw,26px)/1.2 Georgia,serif; margin:6px 0 10px; }
  #pop .qcard .opts { display:grid; grid-template-columns:1fr 1fr; gap:8px; } #pop .qcard button { min-height:56px; border-radius:14px; border:2px solid rgba(255,255,255,.5); color:#fff; font:800 clamp(14px,4vw,18px) system-ui; text-align:left; padding:8px 10px; animation: rowIn .35s both; }
  #pop .qcard button b { display:inline-block; width:1.6em; } #pop .qcard button.sel { border-color:#ffd700; box-shadow:0 0 0 3px #ffd700 inset; transform:scale(1.02); }
  #pop .qcard .qt { height:8px; border-radius:4px; background:rgba(255,255,255,.18); margin-top:10px; overflow:hidden; } #pop .qcard .qt i { display:block; height:100%; background:linear-gradient(90deg,#3bd16f,#ffd700,#ff4d4d); }
  #pop .qcard .qmin { position:absolute; right:8px; top:6px; width:40px; height:30px; border-radius:10px; background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.4); color:#fff; font:900 18px system-ui; display:flex; align-items:center; justify-content:center; padding:0; min-height:0; animation:none; }
  #pop .qcard.min { padding:8px 10px; } #pop .qcard.min .qq { display:none; } #pop .qcard.min .opts { grid-template-columns:repeat(4,1fr); gap:6px; margin-top:6px; }
  #pop .qcard.min .opts button { min-height:40px; text-align:center; padding:4px; } #pop .qcard.min .opts button span { display:none; } #pop .qcard.min .opts button b { width:auto; }
  #pop .qcard.min .qt { margin-top:6px; height:5px; }
  /* CAUSE HAVOC (Chip, Mason, Harrison) */
  #pop .havoc { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; overflow:hidden; pointer-events:none;
    background:radial-gradient(70% 55% at 50% 50%, rgba(160,10,20,.62), rgba(10,0,4,.88)); animation: hvBg 4.2s ease forwards; }
  #pop .havoc .flash { position:absolute; inset:0; background:#fff; opacity:0; animation: hvFlash .5s .55s ease-out; }
  #pop .havoc .stage { position:relative; display:flex; flex-direction:column; align-items:center; animation: hvShake .5s 1.05s both; }
  #pop .havoc .w1, #pop .havoc .w2 { display:flex; font-family: Impact, "Arial Black", Georgia, sans-serif; font-weight:900; letter-spacing:.04em; line-height:.92; }
  #pop .havoc .w1 { font-size:clamp(40px,12vw,84px); color:#fff; -webkit-text-stroke:2px #b3122a; text-shadow:0 6px 0 #4a0a14, 0 0 24px rgba(255,80,80,.6); }
  #pop .havoc .w2 { font-size:clamp(78px,25vw,180px); position:relative; }
  #pop .havoc .w2 span { background:linear-gradient(180deg,#fff7b0 0%,#ffd700 30%,#ff8a00 62%,#d4001a 100%); -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-stroke:3px #2a0006; filter: drop-shadow(0 8px 0 #4a0a14) drop-shadow(0 0 28px rgba(255,120,0,.85)); }
  #pop .havoc .w1 span, #pop .havoc .w2 span { display:inline-block; opacity:0; animation: hvSlam .5s cubic-bezier(.2,1.8,.4,1) forwards; }
  #pop .havoc .w2 span { animation: hvSlam .55s cubic-bezier(.2,1.8,.4,1) forwards, hvJitter .12s 1.6s steps(2) 6; }
  #pop .havoc .streak { position:absolute; top:-10%; left:-40%; width:30%; height:120%; background:linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent); transform:skewX(-20deg); mix-blend-mode:overlay; animation: hvStreak .7s 1.35s ease-in-out forwards; opacity:0; }
  #pop .havoc .ring { position:absolute; left:50%; top:50%; width:40px; height:40px; margin:-20px; border-radius:50%; border:6px solid #ffd700; opacity:0; animation: hvRing .9s .55s ease-out forwards; }
  #pop .havoc .ring.r2 { border-color:#ff3b3b; animation-delay:.75s; }
  #pop .havoc .spark { position:absolute; left:50%; top:50%; width:10px; height:10px; border-radius:50%; background:#ffd700; box-shadow:0 0 10px #ff8a00; opacity:0; animation: hvSpark .9s .58s ease-out forwards; }
  #pop .havoc .emo { position:absolute; left:50%; top:50%; font-size:34px; opacity:0; animation: hvEmo 1.6s .6s ease-out forwards; }
  #pop .havoc .crack { position:absolute; left:50%; top:50%; width:min(90vw,620px); height:6px; margin-left:calc(min(90vw,620px) / -2); background:linear-gradient(90deg,transparent,#fff,transparent); opacity:0; animation: hvCrack .6s .55s ease-out forwards; }
  #pop .havoc .who { margin-top:18px; font:800 clamp(15px,4.4vw,20px) system-ui; color:#ffe9a8; text-align:center; max-width:86vw; opacity:0; animation: hvUp .5s 1.5s ease-out forwards; text-shadow:0 2px 6px #000; }
  #pop .havoc .who b { color:#fff; font-size:1.25em; letter-spacing:.06em; }
  @keyframes hvBg { 0% { opacity:0; } 8% { opacity:1; } 85% { opacity:1; } 100% { opacity:0; } }
  @keyframes hvFlash { 0% { opacity:.85; } 100% { opacity:0; } }
  @keyframes hvSlam { 0% { opacity:0; transform:translateY(-60px) scale(3.2) rotate(var(--r,0deg)); filter:blur(6px); } 60% { opacity:1; filter:blur(0); } 100% { opacity:1; transform:none; } }
  @keyframes hvJitter { 0% { transform:translate(0,0); } 50% { transform:translate(2px,-2px) rotate(1deg); } 100% { transform:translate(-2px,1px); } }
  @keyframes hvShake { 0%,100% { transform:none; } 15% { transform:translate(-10px,6px) rotate(-1.5deg); } 30% { transform:translate(9px,-7px) rotate(1.2deg); } 50% { transform:translate(-6px,4px); } 70% { transform:translate(4px,-3px); } }
  @keyframes hvStreak { 0% { opacity:1; left:-40%; } 100% { opacity:1; left:120%; } }
  @keyframes hvRing { 0% { opacity:1; transform:scale(.2); } 100% { opacity:0; transform:scale(22); } }
  @keyframes hvSpark { 0% { opacity:1; transform:translate(0,0) scale(1.4); } 100% { opacity:0; transform:translate(var(--dx),var(--dy)) scale(.3); } }
  @keyframes hvEmo { 0% { opacity:0; transform:translate(-50%,-50%) scale(.3); } 15% { opacity:1; } 100% { opacity:0; transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1.3) rotate(var(--r)); } }
  @keyframes hvCrack { 0% { opacity:1; transform:scaleX(0); } 40% { opacity:1; transform:scaleX(1); } 100% { opacity:0; transform:scaleX(1.2); } }
  @keyframes hvUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
  @keyframes popBounce { from { transform:translateY(0) rotate(-6deg); } to { transform:translateY(-8px) rotate(6deg); } }
  @keyframes rowIn { from { opacity:0; transform:translateX(-14px); } to { opacity:1; transform:none; } }
  @keyframes pulseT { from { transform:translateX(-50%) scale(1); } to { transform:translateX(-50%) scale(1.07); } }
  `;
  document.head.appendChild(st);
  root = document.createElement('div'); root.id = 'pop';
  root.innerHTML = '<div class="timer" id="popTimer"></div><div class="meters" id="popMeters"></div>';
  document.body.appendChild(root);
  return root;
}
const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// CAUSE HAVOC: the big slam-in title when you play as Chip, Mason or Harrison (resolves when it has gone)
export function havoc(who = '', line = '', emojis = ['💥']) {
  ensure(); const el = document.createElement('div'); el.className = 'havoc';
  const letters = (w, d0) => [...w].map((c, i) => `<span style="animation-delay:${(d0 + i * 0.07).toFixed(2)}s;--r:${(Math.random() * 50 - 25).toFixed(0)}deg">${c}</span>`).join('');
  let fx = '<div class="ring"></div><div class="ring r2"></div><div class="crack"></div>';
  for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 260; fx += `<i class="spark" style="--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px;animation-delay:${(0.55 + Math.random() * 0.15).toFixed(2)}s;background:${['#ffd700', '#ff8a00', '#fff', '#ff3b3b'][i % 4]}"></i>`; }
  for (let i = 0; i < 12; i++) { const a = Math.random() * Math.PI * 2, d = 140 + Math.random() * 200; fx += `<i class="emo" style="--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px;--r:${(Math.random() * 120 - 60).toFixed(0)}deg;animation-delay:${(0.6 + Math.random() * 0.4).toFixed(2)}s">${emojis[i % emojis.length]}</i>`; }
  el.innerHTML = `<div class="flash"></div>${fx}<div class="stage"><div class="w1">${letters('CAUSE', 0.05)}</div><div class="w2">${letters('HAVOC', 0.45)}<div class="streak"></div></div>${who ? `<div class="who">Playing as <b>${esc(who.toUpperCase())}</b><br>${esc(line)}</div>` : ''}</div>`;
  root.appendChild(el);
  // the headset gets it on the floating panel
  const rec = { kicker: who ? `PLAYING AS ${who.toUpperCase()}` : '', title: 'CAUSE HAVOC', sub: line, icon: emojis[0], secs: 4, c1: '#d4001a', c2: '#2a0006', rows: null, unit: '', footer: '', t0: performance.now() }; S.cards.push(rec); bump();
  return new Promise(res => setTimeout(() => { el.remove(); S.cards = S.cards.filter(c => c !== rec); bump(); res(); }, 4300));
}
// a big animated card; resolves when it has gone
export function card({ kicker = '', title = '', sub = '', icon = '', secs = 3.5, c1, c2, _rows = null, _unit = '', _footer = '' } = {}) {
  ensure(); const rec = { kicker, title, sub: _rows ? '' : plain(sub), icon, secs, c1: c1 || '#b3122a', c2: c2 || '#4a0a14', rows: _rows, unit: _unit, footer: plain(_footer), t0: performance.now() }; S.cards.push(rec); bump(); const el = document.createElement('div'); el.className = 'card'; if (c1) el.style.setProperty('--c1', c1); if (c2) el.style.setProperty('--c2', c2);
  el.innerHTML = `${icon ? `<div class="icon">${icon}</div>` : ''}<div class="kick">${esc(kicker)}</div><div class="title">${esc(title)}</div><div class="sub">${sub}</div><div class="bar"><i></i></div>`;
  root.appendChild(el); const bar = el.querySelector('.bar i'); bar.style.transition = `transform ${secs}s linear`;
  requestAnimationFrame(() => { el.classList.add('in'); requestAnimationFrame(() => { bar.style.transform = 'scaleX(0)'; }); });
  return new Promise(res => setTimeout(() => { el.classList.replace('in', 'out'); setTimeout(() => { el.remove(); S.cards = S.cards.filter(c => c !== rec); bump(); res(); }, 380); }, secs * 1000));
}
// leaderboard card: rows [{ name, score, color, me }]
export function board({ kicker = '', title = '', rows = [], footer = '', secs = 5, unit = '' } = {}) {
  const sorted = rows.slice().sort((a, b) => b.score - a.score);
  const html = `<table class="board">${sorted.map((r, i) => `<tr class="${r.me ? 'me' : ''}" style="animation-delay:${0.15 + i * 0.12}s"><td class="rank">${['🥇', '🥈', '🥉', '4th', '5th'][i] || i + 1}</td><td><span class="sw" style="background:${r.color}"></span>${esc(r.name)}${r.me ? ' (you)' : ''}</td><td>${r.score}${unit}</td></tr>`).join('')}</table>${footer ? `<div class="sub" style="margin-top:10px">${footer}</div>` : ''}`;
  return card({ kicker, title, sub: html, secs, c1: '#1d3557', c2: '#0b1426', _rows: sorted, _unit: unit, _footer: footer });
}
export function timer(text, label = '', urgent = false) { ensure(); const nt = text == null ? null : { text: String(text), label, urgent }; if (JSON.stringify(nt) !== JSON.stringify(S.timer)) { S.timer = nt; bump(); } const t = root.querySelector('#popTimer'); if (text == null) { t.style.display = 'none'; return; } t.style.display = 'block'; t.innerHTML = `${label ? `<small>${esc(label)}</small>` : ''}${esc(text)}`; t.classList.toggle('urgent', urgent); }
// a huge tap button (PULL!, TEAR!); returns a remover
export function tapButton(label, onTap) { ensure(); const tp = { label, onTap }; S.tap = tp; bump(); const b = document.createElement('button'); b.className = 'tap'; b.textContent = label; const f = (e) => { e.preventDefault(); e.stopPropagation(); onTap(); }; b.addEventListener('pointerdown', f); root.appendChild(b); return () => { b.remove(); if (S.tap === tp) { S.tap = null; bump(); } }; }
// tug-of-war style meters: [{ label, value 0..1, color }]
export function meters(list) { ensure(); S.meters = list ? list.map(x => ({ ...x })) : null; bump(); const m = root.querySelector('#popMeters'); if (!list) { m.style.display = 'none'; return; } m.style.display = 'block'; m.innerHTML = list.map(x => `<div>${esc(x.label)}<div class="m"><i style="width:${Math.round(Math.min(1, x.value) * 100)}%;background:${x.color || '#ffd700'}"></i></div></div>`).join(''); }
// the quiz question card with big tap answers
let qEl = null; let qMin = false; try { qMin = localStorage.getItem('qMin') === '1'; } catch (e) { /* private mode */ }
export function questionCard(q, n, total, onPick, selected) {
  ensure(); S.q = q ? { q: q.q, opts: q.opts, round: q.round, n, total, selected, frac: S.q?.q === q.q ? S.q.frac : 1 } : null; bump();
  if (!q) { if (qEl) { const e = qEl; qEl = null; e.classList.remove('in'); setTimeout(() => e.remove(), 400); } return; }
  const cols = ['#c1121f', '#1d6fd8', '#d39b00', '#2d8a4f'];
  if (!qEl || qEl.dataset.q !== q.q) { if (qEl) qEl.remove(); qEl = document.createElement('div'); qEl.className = 'qcard'; qEl.dataset.q = q.q;
    qEl.innerHTML = `<div class="qn">QUESTION ${n} OF ${total}${q.round ? ' · ' + esc(String(q.round).toUpperCase()) : ''}</div><div class="qq">${esc(q.q)}</div><button class="qmin" aria-label="Minimise question">${qMin ? '▴' : '▾'}</button><div class="opts">${q.opts.map((o, i) => `<button data-i="${i}" style="background:${cols[i]};animation-delay:${0.1 + i * 0.08}s"><b>${'ABCD'[i]}</b><span>${esc(o)}</span></button>`).join('')}</div><div class="qt"><i></i></div>`;
    qEl.querySelectorAll('.opts button').forEach(b => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onPick(+b.dataset.i); }));
    // minimise: just the question number, A-D buttons and the time bar, so you can see the room
    const mb = qEl.querySelector('.qmin'); const el = qEl; el.classList.toggle('min', qMin);
    mb.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); qMin = !qMin; el.classList.toggle('min', qMin); mb.textContent = qMin ? '▴' : '▾'; try { localStorage.setItem('qMin', qMin ? '1' : '0'); } catch (err) { /* private mode */ } });
    root.appendChild(qEl); requestAnimationFrame(() => el.classList.add('in')); }
  qEl.querySelectorAll('.opts button').forEach(b => b.classList.toggle('sel', +b.dataset.i === selected));
  return qEl;
}
export function questionTime(frac) { if (S.q) S.q.frac = frac; if (qEl) { const i = qEl.querySelector('.qt i'); if (i) i.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%'; } }
export function clearAll() { if (!root) return; timer(null); meters(null); questionCard(null); root.querySelectorAll('.tap,.card').forEach(e => e.remove()); S.cards = []; S.tap = null; bump(); }
G.popup = { havoc, card, board, timer, tapButton, meters, questionCard, questionTime, clearAll, S };
