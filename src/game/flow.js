// The start-up screens, in order:
//   1. Title (Play)  →  2. Gary's outfit wheel spins  →  3. Choose your character (by family) + Done
//   →  4. Choose a game mode (+ default or random teams) + Next  →  5. "Here's tonight" summary for ~3 s  →  game.
// Chip, Mason and Harrison skip the mode screen: they just roam the house.
import { G, shuffle } from '../core.js';
import { CAST, TEAMS, TEAM_IDS, OUTFITS } from '../chars/cast.js';
import { dressGaryFor } from '../chars/people.js';
import { MODES, modeById } from './modes.js';
import { GAMES, gamePlaylist } from './minigames.js';
import { FAMILIES, ROAMERS, setAvatar } from './avatar.js';
import { saveStore, loadStore } from './settings.js';
import { sfx } from '../engine/audio.js';
import { vrPick, vrShow } from './vrhud.js';

let el = null;
function ensure() {
  if (el) return el;
  const st = document.createElement('style');
  st.textContent = `
  #flow { position:fixed; inset:0; z-index:30; display:none; overflow:auto; -webkit-overflow-scrolling:touch; color:#fff; font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    background: radial-gradient(120% 90% at 50% 0%, #7a1020 0%, #3a0812 45%, #12060c 100%); padding: max(18px, env(safe-area-inset-top)) 14px 120px; box-sizing:border-box; }
  #flow.on { display:block; }
  #flow h2 { font:900 clamp(26px,7vw,42px) Georgia,serif; text-align:center; margin:6px 0 4px; text-shadow:0 3px 0 rgba(0,0,0,.4); }
  #flow .lead { text-align:center; opacity:.85; margin:0 0 14px; font-size:15px; }
  #flow .fams { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px; max-width:1100px; margin:0 auto; }
  #flow .fam { background:rgba(255,255,255,.07); border:2px solid rgba(255,215,0,.35); border-radius:18px; padding:10px; }
  #flow .fam h3 { margin:0; font:800 20px Georgia,serif; color:#ffd700; } #flow .fam h3 small { display:block; font:600 12px system-ui; color:#fff; opacity:.7; letter-spacing:.06em; margin-bottom:6px; }
  #flow .ppl { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  #flow .who { background:rgba(0,0,0,.3); border:2px solid transparent; border-radius:14px; padding:6px 4px; text-align:center; color:#fff; cursor:pointer; font:700 13px system-ui; }
  #flow .who img, #flow .who .ph { width:64px; height:64px; border-radius:50%; object-fit:cover; display:block; margin:0 auto 4px; background:#2a1a20; font-size:38px; line-height:64px; }
  #flow .who.sel { border-color:#ffd700; background:rgba(255,215,0,.18); box-shadow:0 0 18px rgba(255,215,0,.35); } #flow .who small { display:block; font:600 10px system-ui; opacity:.7; }
  #flow .modes2 { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; max-width:1000px; margin:0 auto; }
  #flow .m2 { text-align:left; background:rgba(255,255,255,.07); border:2px solid rgba(255,255,255,.2); border-radius:16px; padding:12px 14px; color:#fff; cursor:pointer; }
  #flow .m2 i { font-style:normal; font-size:30px; float:left; margin-right:10px; } #flow .m2 b { font:800 19px Georgia,serif; display:block; } #flow .m2 small { display:block; opacity:.8; font-size:13px; margin-top:3px; } #flow .m2 em { font-size:11px; color:#ffd700; font-style:normal; }
  #flow .m2.sel { border-color:#ffd700; background:rgba(255,215,0,.16); }
  #flow .tog { display:flex; gap:8px; justify-content:center; margin:6px 0 12px; } #flow .tog button { border-radius:999px; padding:9px 16px; border:2px solid rgba(255,255,255,.35); background:transparent; color:#fff; font:700 14px system-ui; }
  #flow .tog button.sel { border-color:#ffd700; background:rgba(255,215,0,.2); color:#ffd700; }
  #flow .go { position:fixed; left:50%; bottom:max(18px, env(safe-area-inset-bottom)); transform:translateX(-50%); min-width:220px; padding:16px 28px; border-radius:999px; border:3px solid #ffd700; background:linear-gradient(#e2283f,#9c0f22); color:#fff; font:900 22px Georgia,serif; box-shadow:0 10px 30px rgba(0,0,0,.5); }
  #flow .go:disabled { opacity:.45; filter:grayscale(.6); }
  #flow .wheel { display:block; margin:10px auto; width:min(86vw,460px); height:min(86vw,460px); }
  #flow .sum { max-width:760px; margin:0 auto; text-align:center; } #flow .sum .big { font:900 clamp(22px,6vw,32px) Georgia,serif; margin:8px 0; } #flow .sum .big b { color:#ffd700; }
  #flow .tgrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px; margin-top:12px; text-align:left; } #flow .tgrid div { border-radius:12px; padding:8px 10px; background:rgba(0,0,0,.3); border-left:6px solid var(--c); font-size:13px; } #flow .tgrid b { display:block; font-size:15px; margin-bottom:2px; }
  #flow .tgrid .me { box-shadow:0 0 0 2px #ffd700 inset; }
  `;
  document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'flow'; document.body.appendChild(el); return el;
}
let VR = false; // in the headset: the same screens, drawn on the floating panel
const P = () => G.portraits || {};
const face = (n) => P()[n] ? `<img src="${P()[n]}" alt="">` : `<div class="ph">${n === 'Mason' ? '💙' : n === 'Harrison' ? '🧝' : n === 'Chip' ? '🐶' : '🎄'}</div>`;

// entry point from the Play button. launch() starts the game (and VR when asked)
export async function startFlow(launch, opts = {}) {
  ensure(); VR = !!opts.vr; if (!VR) el.classList.add('on'); document.getElementById('loading').style.display = 'none';
  if (VR) await vrTitleStep();
  const who = await characterStep();
  let mode = 'roam', random = false;
  if (!ROAMERS.includes(who)) { ({ mode, random } = await modeStep()); await teamsStep(who, random); }
  if (mode === 'games') await gamesStep();
  // Gary's outfit wheel comes last; Mini Games and Fling the Relative get plain Gary
  if (mode !== 'games' && mode !== 'fling') await wheelStep();
  dressGaryFor(mode);
  setAvatar(who); // (the teams were settled on the teams screen)
  G.modes.id = mode; G.modes.def = modeById(mode); if (mode !== 'roam') saveStore('mode', mode); saveStore('lastAs', who);
  await summaryStep(who, mode);
  el.classList.remove('on'); launch();
}

// 2. the outfit wheel
function wheelStep() {
  G.wheelShown = true;
  if (VR) { const list = OUTFITS; const n = list.length; const target = Math.max(0, list.findIndex(o => o.id === G.garyOutfit?.id)); const final = Math.PI * 2 * 6 - ((target + 0.5) / n) * Math.PI * 2; const cols = ['#c1121f', '#2d6a4f', '#d4af37', '#1d6fd8', '#7b2cbf', '#e76f51']; let tickA = 0, cheered = false;
    const name = (G.garyOutfit?.label || '').split(' (')[0];
    return vrShow({ title: 'Gary\'s Outfit Wheel', lead: 'What\'s Gary wearing this year?', secs: 7.5, draw: (g, W, H, ms) => { const k = Math.min(1, ms / 4200), e = 1 - Math.pow(1 - k, 3), a = final * e, R = 230, cx = W / 2, cy = 390;
      g.save(); g.translate(cx, cy); for (let i = 0; i < n; i++) { const a0 = a + i / n * Math.PI * 2 - Math.PI / 2, a1 = a0 + Math.PI * 2 / n; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0, a1); g.closePath(); g.fillStyle = cols[i % cols.length]; g.fill(); g.strokeStyle = '#ffd700'; g.lineWidth = 4; g.stroke();
        g.save(); g.rotate((a0 + a1) / 2); g.fillStyle = '#fff'; g.textAlign = 'right'; g.textBaseline = 'middle'; const lb = list[i].label.split(' (')[0]; let fs = 24; g.font = `bold ${fs}px Georgia`; while (g.measureText(lb).width > 160 && fs > 12) { fs--; g.font = `bold ${fs}px Georgia`; } g.fillText(lb, R - 16, 0); g.restore(); }
      g.beginPath(); g.arc(0, 0, 40, 0, 7); g.fillStyle = '#ffd700'; g.fill(); g.fillStyle = '#7a1020'; g.font = 'bold 20px Georgia'; g.textAlign = 'center'; g.fillText('GARY', 0, 2); g.restore();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(cx, cy - R + 26); g.lineTo(cx - 20, cy - R - 16); g.lineTo(cx + 20, cy - R - 16); g.closePath(); g.fill();
      const ti = Math.floor(a / (Math.PI * 2 / n)); if (ti !== tickA) { tickA = ti; sfx('tap', null, 0.25); }
      if (k >= 1) { if (!cheered) { cheered = true; sfx('cheer', null, 0.7); } g.fillStyle = '#ffd700'; g.font = '900 34px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`Gary will be wearing the ${name} outfit!`, W / 2, H - 60); } } }); }
  return new Promise(res => {
    const list = OUTFITS; const target = Math.max(0, list.findIndex(o => o.id === G.garyOutfit?.id)); const n = list.length;
    el.innerHTML = `<h2>Gary's Outfit Wheel</h2><p class="lead">What's Gary wearing this year?</p><canvas class="wheel" width="600" height="600"></canvas><h2 id="wRes" style="min-height:1.3em;color:#ffd700"></h2><button class="go" id="wGo" disabled>Let's play →</button>`;
    const c = el.querySelector('canvas'), g = c.getContext('2d'); const cols = ['#c1121f', '#2d6a4f', '#d4af37', '#1d6fd8', '#7b2cbf', '#e76f51'];
    const final = Math.PI * 2 * 6 - ((target + 0.5) / n) * Math.PI * 2; const t0 = performance.now(), dur = 4200; let tickA = 0;
    const draw = (a) => { g.clearRect(0, 0, 600, 600); g.save(); g.translate(300, 300);
      for (let i = 0; i < n; i++) { const a0 = a + i / n * Math.PI * 2 - Math.PI / 2, a1 = a0 + Math.PI * 2 / n; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 270, a0, a1); g.closePath(); g.fillStyle = cols[i % cols.length]; g.fill(); g.strokeStyle = '#ffd700'; g.lineWidth = 4; g.stroke();
        g.save(); g.rotate((a0 + a1) / 2); g.fillStyle = '#fff'; g.textAlign = 'right'; const lb = list[i].label.split(' (')[0]; let fs = 26; g.font = `bold ${fs}px Georgia`; while (g.measureText(lb).width > 190 && fs > 14) { fs--; g.font = `bold ${fs}px Georgia`; } g.fillText(lb, 250, fs / 3); g.restore(); }
      g.beginPath(); g.arc(0, 0, 46, 0, 7); g.fillStyle = '#ffd700'; g.fill(); g.fillStyle = '#7a1020'; g.font = 'bold 22px Georgia'; g.textAlign = 'center'; g.fillText('GARY', 0, 8); g.restore();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(300, 8); g.lineTo(278, -2 + 30); g.lineTo(322, 28); g.closePath(); g.moveTo(300, 52); g.lineTo(282, 12); g.lineTo(318, 12); g.fill(); };
    const step = (now) => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); const a = final * e; draw(a); const ti = Math.floor(a / (Math.PI * 2 / n)); if (ti !== tickA) { tickA = ti; sfx('tap', null, 0.25); }
      if (k < 1) requestAnimationFrame(step); else { sfx('cheer', null, 0.7); el.querySelector('#wRes').textContent = `Gary will be wearing the ${(G.garyOutfit?.label || '').split(' (')[0]} outfit!`; const b = el.querySelector('#wGo'); b.disabled = false; b.onclick = () => res(); setTimeout(res, 3500); } };
    requestAnimationFrame(step);
  });
}

// 3. choose your character, by family
function characterStep() {
  if (VR) { let sel = loadStore('lastAs', 'Tommy'); if (!G.charByName[sel] && sel !== 'Chip') sel = 'Tommy';
    const groups = FAMILIES.map(f => ({ name: f.name, sub: f.sub, items: f.people.filter(n => n === 'Chip' || G.charByName[n]).map(n => ({ id: n, label: n, img: P()[n], icon: n === 'Chip' ? '🐶' : '🎄', sub: n === 'Chip' ? 'Just here for the buffet' : n === 'Martin' ? 'Quizmaster' : '' })) }));
    return vrPick({ title: 'Who are you playing as?', lead: 'Point and pull the trigger (or pinch). Chip, Mason and Harrison roam causing trouble.', groups, items: groups.flatMap(x => x.items), selected: sel, done: 'Done ✓' }).then(r => { sfx('ding', null, 0.6); return r.sel; }); }
  return new Promise(res => {
    let sel = loadStore('lastAs', 'Tommy'); if (!G.charByName[sel] && sel !== 'Chip') sel = 'Tommy';
    const team = (n) => n === 'Chip' ? 'Just here for the buffet' : n === 'Martin' ? 'Quizmaster (or play him!)' : ''; // no team names here: just who they are
    el.innerHTML = `<h2>Who are you playing as?</h2><p class="lead">Pick anyone in the family. Chip, Mason and Harrison just roam the house causing trouble.</p>
      <div class="fams">${FAMILIES.map(f => `<div class="fam"><h3>${f.name}<small>${f.sub.toUpperCase()}</small></h3><div class="ppl">${f.people.filter(n => n === 'Chip' || G.charByName[n]).map(n => `<button class="who${n === sel ? ' sel' : ''}" data-n="${n}">${face(n)}${n}${team(n) ? `<small>${team(n)}</small>` : ''}</button>`).join('')}</div></div>`).join('')}</div>
      <button class="go" id="cGo">Done ✓</button>`;
    el.scrollTop = 0;
    el.querySelectorAll('.who').forEach(b => b.onclick = () => { sel = b.dataset.n; el.querySelectorAll('.who').forEach(x => x.classList.toggle('sel', x === b)); sfx('tap', null, 0.4); });
    el.querySelector('#cGo').onclick = () => { sfx('ding', null, 0.6); res(sel); };
  });
}

// 4. choose the game mode, and default or random teams
function modeStep() {
  if (VR) { let sel = loadStore('mode', 'quick'); if (!MODES.some(m => m.id === sel)) sel = 'quick'; const random = !!loadStore('randomTeams', false);
    return vrPick({ title: 'Choose a game mode', lead: 'Free Roam is always there afterwards.', toggles: [{ id: 'default', label: 'Default teams' }, { id: 'random', label: '🎲 Randomise teams' }], toggleSel: random ? 'random' : 'default', items: MODES.map(m => ({ id: m.id, label: m.name, icon: m.icon, sub: m.desc })), selected: sel, cols: 2 })
      .then(r => { sfx('ding', null, 0.6); saveStore('randomTeams', r.toggle === 'random'); return { mode: r.sel, random: r.toggle === 'random' }; }); }
  return new Promise(res => {
    let sel = loadStore('mode', 'quick'); if (!MODES.some(m => m.id === sel)) sel = 'quick'; let random = !!loadStore('randomTeams', false);
    el.innerHTML = `<h2>Choose a game mode</h2><p class="lead">Free Roam is always there afterwards.</p><div class="tog"><button data-r="0" class="${random ? '' : 'sel'}">Default teams</button><button data-r="1" class="${random ? 'sel' : ''}">🎲 Randomise teams</button></div><div class="modes2">${MODES.map(m => { const b = loadStore('best.' + m.id, null); return `<button class="m2${m.id === sel ? ' sel' : ''}" data-m="${m.id}"><i>${m.icon}</i><b>${m.name}</b><small>${m.desc}</small><em>${m.tag}${b != null ? ` · best ${b}` : ''}</em></button>`; }).join('')}</div>
      <button class="go" id="mGo">Next →</button>`;
    el.scrollTop = 0;
    el.querySelectorAll('.m2').forEach(b => b.onclick = () => { sel = b.dataset.m; el.querySelectorAll('.m2').forEach(x => x.classList.toggle('sel', x === b)); sfx('tap', null, 0.4); });
    el.querySelectorAll('.tog button').forEach(b => b.onclick = () => { random = b.dataset.r === '1'; saveStore('randomTeams', random); el.querySelectorAll('.tog button').forEach(x => x.classList.toggle('sel', x === b)); });
    el.querySelector('#mGo').onclick = () => { sfx('ding', null, 0.6); res({ mode: sel, random }); };
  });
}

// 1. in the headset: the title, on its own, before anything else
function vrTitleStep() {
  sfx('whistle', null, 0.5);
  return vrShow({ title: '✦ The 2026 Boxing Day Edition ✦', done: 'Start ▶', draw: (g, W, H, ms) => { g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff3d6'; g.font = 'italic 900 58px Georgia, serif'; g.fillText('The Mason Family', W / 2, 220);
    const gr = g.createLinearGradient(W / 2 - 360, 0, W / 2 + 360, 0); const sh = (ms / 2500) % 1; gr.addColorStop(0, '#a8701a'); gr.addColorStop(Math.max(0, sh - 0.1), '#ffe08a'); gr.addColorStop(sh, '#fff8e0'); gr.addColorStop(Math.min(1, sh + 0.1), '#d9a12e'); gr.addColorStop(1, '#ffe08a');
    g.fillStyle = gr; g.font = '900 104px Georgia, serif'; g.fillText('Boxing Day Quiz', W / 2, 330);
    g.fillStyle = '#fff3d6'; g.font = '900 52px Georgia, serif'; g.shadowColor = 'rgba(255,215,0,0.7)'; g.shadowBlur = 24; g.fillText('— T H E   G A M E —', W / 2, 450); g.shadowBlur = 0;
    g.font = '600 22px system-ui'; g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillText('Point at Start and pull the trigger (or pinch)', W / 2, 560); } });
}

// 4a. the teams: default or shuffled, everyone shown, yours highlighted
function teamsStep(who, random) {
  const def = Object.fromEntries(CAST.map(c => [c.name, c.team]));
  const settle = () => { if (random) randomTeams(); else for (const c of G.chars) if (def[c.name]) c.team = def[c.name]; };
  const mine = () => { const t = G.charByName[who]?.team; return t === 'host' ? 'julie' : t; };
  const teams = () => TEAM_IDS.map(t => ({ t, ppl: G.chars.filter(c => c.team === t && !(c.name === who && G.charByName[who]?.team === 'host')).map(c => c.name).concat(who === 'Martin' && t === 'julie' ? ['Martin'] : []) }));
  settle();
  if (VR) return vrShow({ title: random ? '🎲 Tonight\'s random teams' : 'Tonight\'s teams', done: 'Next →', draw: (g, W, H) => { const T = teams(); const cw = (W - 80) / 2, chh = 250;
      T.forEach((x, i) => { const cx = 30 + (i % 2) * (cw + 20), cy = 110 + Math.floor(i / 2) * (chh + 16); const me = x.t === mine(); g.beginPath(); g.roundRect(cx, cy, cw, chh, 18); g.fillStyle = me ? 'rgba(255,215,0,0.16)' : 'rgba(0,0,0,0.32)'; g.fill(); g.lineWidth = me ? 5 : 2; g.strokeStyle = me ? '#ffd700' : TEAMS[x.t].color; g.stroke();
        g.fillStyle = TEAMS[x.t].color; g.fillRect(cx + 12, cy + 16, 10, 34); g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = '900 32px Georgia, serif'; g.fillStyle = '#fff'; g.fillText(TEAMS[x.t].name + (me ? '  (you)' : ''), cx + 34, cy + 34);
        g.font = '700 24px system-ui'; x.ppl.forEach((n, k) => { g.fillStyle = n === who ? '#ffd700' : '#fff'; g.fillText((n === who ? '★ ' : '• ') + n, cx + 30 + (k % 2) * (cw / 2 - 10), cy + 84 + Math.floor(k / 2) * 38); }); }); } });
  return new Promise(res => {
    const draw = () => { const T = teams();
      el.innerHTML = `<h2>${random ? '🎲 Tonight\'s random teams' : 'Tonight\'s teams'}</h2><p class="lead">${random ? 'Shuffled! Don\'t like them? Shuffle again.' : 'The usual families, as ever.'}</p>
        <div class="tgrid big">${T.map(x => `<div class="${x.t === mine() ? 'me' : ''}" style="--c:${TEAMS[x.t].color}"><b>${TEAMS[x.t].name}${x.t === mine() ? ' <small>(your team)</small>' : ''}</b><div class="tf">${x.ppl.map(n => `<span class="${n === who ? 'you' : ''}">${face(n)}${n}</span>`).join('')}</div></div>`).join('')}</div>
        ${random ? '<div class="tog" style="margin-top:14px"><button id="tShuffle">🎲 Shuffle again</button></div>' : ''}<button class="go" id="tGo">Next →</button>`;
      el.scrollTop = 0; el.querySelector('#tGo').onclick = () => { sfx('ding', null, 0.6); res(); };
      const sb = el.querySelector('#tShuffle'); if (sb) sb.onclick = () => { sfx('tap', null, 0.5); settle(); draw(); }; };
    const st = document.createElement('style'); st.textContent = '#flow .tgrid.big { max-width:900px; margin:12px auto 0; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); } #flow .tgrid.big > div { padding:10px 12px; } #flow .tgrid.big small { color:#ffd700; font-size:11px; } #flow .tf { display:flex; flex-wrap:wrap; gap:8px 10px; margin-top:6px; } #flow .tf span { display:flex; flex-direction:column; align-items:center; font:700 12px system-ui; width:58px; text-align:center; } #flow .tf img, #flow .tf .ph { width:44px; height:44px; border-radius:50%; object-fit:cover; background:#2a1a20; font-size:26px; line-height:44px; margin-bottom:3px; } #flow .tf span.you { color:#ffd700; } #flow .tf span.you img { box-shadow:0 0 0 3px #ffd700; }';
    document.head.appendChild(st); draw();
  });
}

// 4b. Mini Games: let the dice pick five, or choose exactly which ones
function gamesStep() {
  const valid = (ids) => (ids || []).filter(id => GAMES.some(g => g.id === id)); // games that have since been removed don't count
  if (VR) { const saved = loadStore('gamesPick', { random: true, ids: [] }); saved.ids = saved.random !== false ? [] : valid(saved.ids); const short = (g) => { const h = typeof g.how === 'function' ? g.how() : g.how; return h.split('. ')[0] + '.'; };
    return vrPick({ title: 'Which games?', lead: 'Let the dice pick five, or choose your own (they\'re played in the order you pick them).', toggles: [{ id: 'random', label: '🎲 Random five' }, { id: 'pick', label: '✋ I\'ll choose' }], toggleSel: saved.random !== false ? 'random' : 'pick', multi: true, multiToggle: 'pick', selected: saved.ids || [], items: GAMES.map(g => ({ id: g.id, label: g.title.replace(/\b(\w)(\w*)/g, (m, a, b) => a + b.toLowerCase()), icon: g.icon, sub: short(g) })), cols: 3 })
      .then(r => { const pick = { random: r.toggle !== 'pick', ids: r.sel }; saveStore('gamesPick', pick); G.minigames.playlist = gamePlaylist(pick); sfx('ding', null, 0.6); }); }
  return new Promise(res => {
    const saved = loadStore('gamesPick', { random: true, ids: [] }); let random = saved.random !== false; const sel = new Set(random ? [] : valid(saved.ids)); // choosing starts from nothing, so your first tap is #1
    const how = (g) => { const h = typeof g.how === 'function' ? g.how() : g.how; return h.split('. ')[0] + '.'; };
    el.innerHTML = `<h2>Which games?</h2><p class="lead">Let the dice pick five, or choose your own.</p>
      <div class="tog"><button data-r="1" class="${random ? 'sel' : ''}">🎲 Random five</button><button data-r="0" class="${random ? '' : 'sel'}">✋ I'll choose</button></div>
      <div class="modes2 gpick${random ? ' rnd' : ''}">${GAMES.map(g => `<button class="m2${sel.has(g.id) ? ' sel' : ''}" data-g="${g.id}"><i>${g.icon}</i><b>${g.title.replace(/\b(\w)(\w*)/g, (m, a, b) => a + b.toLowerCase())}</b><small>${how(g)}</small><em class="tick"></em></button>`).join('')}</div>
      <p class="lead" id="gCount" style="margin-top:12px"></p><button class="go" id="gGo">Next →</button>`;
    el.scrollTop = 0;
    const st = document.createElement('style'); st.textContent = '#flow .gpick.rnd .m2 { opacity:.55; pointer-events:none; } #flow .gpick.rnd .tick { display:none; } #flow .gpick .tick { float:right; margin-top:-4px; font:900 18px Georgia,serif; color:#ffd700; } #flow .gpick .m2:not(.sel) .tick { font:700 12px system-ui; color:#fff; opacity:.7; }'; el.appendChild(st);
    const refresh = () => { el.querySelector('.gpick').classList.toggle('rnd', random); el.querySelectorAll('.gpick .m2').forEach(b => { const on = sel.has(b.dataset.g); b.classList.toggle('sel', on); b.querySelector('.tick').textContent = on ? `#${[...sel].indexOf(b.dataset.g) + 1}` : '+ Add'; });
      el.querySelector('#gCount').textContent = random ? 'Five games, picked at random, in a random order.' : `${sel.size} game${sel.size === 1 ? '' : 's'} chosen · they're played in the order you tap them`; el.querySelector('#gGo').disabled = !random && !sel.size; };
    el.querySelectorAll('.tog button').forEach(b => b.onclick = () => { const was = random; random = b.dataset.r === '1'; if (was && !random) sel.clear(); el.querySelectorAll('.tog button').forEach(x => x.classList.toggle('sel', x === b)); sfx('tap', null, 0.4); refresh(); });
    el.querySelectorAll('.gpick .m2').forEach(b => b.onclick = () => { const id = b.dataset.g; sel.has(id) ? sel.delete(id) : sel.add(id); sfx('tap', null, 0.4); refresh(); });
    refresh();
    el.querySelector('#gGo').onclick = () => { const pick = { random, ids: [...sel] }; saveStore('gamesPick', pick); G.minigames.playlist = gamePlaylist(pick); sfx('ding', null, 0.6); res(); };
  });
}

// 5. tonight's line-up, then go
function summaryStep(who, mode) {
  if (VR) { const m = modeById(mode); sfx('whistle', null, 0.6); return vrShow({ title: 'Tonight', lines: [`You're playing as ${who}`, `${m.icon} ${m.name}`, G.myTeam ? `Your team: ${TEAMS[G.myTeam].name}` : (who === 'Chip' ? 'Dog mode: paw-punch the family and steal sausage rolls.' : '')], secs: 3.2 }); }
  return new Promise(res => {
    const m = modeById(mode); const host = G.chars.find(c => c.team === 'host')?.name || 'Martin';
    const teams = TEAM_IDS.map(t => ({ t, ppl: G.chars.filter(c => c.team === t).map(c => c.name) }));
    el.innerHTML = `<div class="sum"><h2>Tonight</h2><div class="big">You're playing as <b>${who}</b></div><div class="big">${m.icon} <b>${m.name}</b></div>
      ${who === 'Chip' ? '<p class="lead">Dog mode: paw-punch the family, steal sausage rolls, sit on the answer sheets.</p>' : `<p class="lead">Quizmaster: ${host}${G.myTeam ? ` · your team: ${TEAMS[G.myTeam].name}` : ''}</p>`}
      </div>`;
    el.scrollTop = 0; sfx('whistle', null, 0.6); setTimeout(res, 3000);
  });
}

// shuffle the grown-ups into four teams (Mason stays with Jodie, Harrison with Bradley; the quizmaster stays out)
export function randomTeams() {
  const adults = shuffle(G.chars.filter(c => c.team !== 'host' && c.name !== 'Mason' && c.name !== 'Harrison'));
  adults.forEach((c, i) => { c.team = TEAM_IDS[i % TEAM_IDS.length]; });
  for (const [kid, parent] of [['Mason', 'Jodie'], ['Harrison', 'Bradley']]) { const k = G.charByName[kid], p = G.charByName[parent]; if (k && p) k.team = p.team; }
  if (G.me && G.me.team) G.myTeam = G.me.team;
}
