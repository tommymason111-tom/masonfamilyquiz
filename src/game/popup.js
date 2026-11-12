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
G.popup = { card, board, timer, tapButton, meters, questionCard, questionTime, clearAll, S };
