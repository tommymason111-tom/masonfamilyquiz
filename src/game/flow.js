// The start-up screens, in order:
//   1. Title (Play)  →  2. Gary's outfit wheel spins  →  3. Choose your character (by family) + Done
//   →  4. Choose a game mode (+ default or random teams) + Next  →  5. "Here's tonight" summary for ~3 s  →  game.
// Chip, Mason and Harrison skip the mode screen: they just roam the house.
import { G, shuffle } from '../core.js';
import { CAST, TEAMS, TEAM_IDS, OUTFITS } from '../chars/cast.js';
import { dressGaryFor } from '../chars/people.js';
import { MODES, modeById } from './modes.js';
import { FAMILIES, ROAMERS, setAvatar } from './avatar.js';
import { saveStore, loadStore } from './settings.js';
import { sfx } from '../engine/audio.js';

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
const P = () => G.portraits || {};
const face = (n) => P()[n] ? `<img src="${P()[n]}" alt="">` : `<div class="ph">${n === 'Mason' ? '🦖' : n === 'Harrison' ? '🧝' : n === 'Chip' ? '🐶' : '🎄'}</div>`;

// entry point from the Play button. launch() starts the game (and VR when asked)
export async function startFlow(launch, opts = {}) {
  ensure(); el.classList.add('on'); document.getElementById('loading').style.display = 'none';
  const who = await characterStep();
  let mode = 'roam', random = false;
  if (!ROAMERS.includes(who)) ({ mode, random } = await modeStep());
  // Gary's outfit wheel comes last; Mini Games and Fling the Relative get plain Gary
  if (mode !== 'games' && mode !== 'fling') await wheelStep();
  dressGaryFor(mode);
  setAvatar(who); if (random) randomTeams();
  G.modes.id = mode; G.modes.def = modeById(mode); if (mode !== 'roam') saveStore('mode', mode); saveStore('lastAs', who);
  if (opts.vr) { el.classList.remove('on'); launch(); return; }
  await summaryStep(who, mode);
  el.classList.remove('on'); launch();
}

// 2. the outfit wheel
function wheelStep() {
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
      if (k < 1) requestAnimationFrame(step); else { sfx('cheer', null, 0.7); el.querySelector('#wRes').textContent = 'THIS YEAR: ' + (G.garyOutfit?.label || ''); const b = el.querySelector('#wGo'); b.disabled = false; b.onclick = () => res(); setTimeout(res, 3500); } };
    requestAnimationFrame(step);
  });
}

// 3. choose your character, by family
function characterStep() {
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

// 5. tonight's line-up, then go
function summaryStep(who, mode) {
  return new Promise(res => {
    const m = modeById(mode); const host = G.chars.find(c => c.team === 'host')?.name || 'Martin';
    const teams = TEAM_IDS.map(t => ({ t, ppl: G.chars.filter(c => c.team === t).map(c => c.name) }));
    el.innerHTML = `<div class="sum"><h2>Tonight</h2><div class="big">You're playing as <b>${who}</b></div><div class="big">${m.icon} <b>${m.name}</b></div>
      ${who === 'Chip' ? '<p class="lead">Dog mode: paw-punch the family, steal sausage rolls, sit on the answer sheets.</p>' : `<p class="lead">Quizmaster: ${host}${G.myTeam ? ` · your team: ${TEAMS[G.myTeam].name}` : ''}</p>`}
      <div class="tgrid">${teams.map(x => `<div class="${x.t === G.myTeam ? 'me' : ''}" style="--c:${TEAMS[x.t].color}"><b>${TEAMS[x.t].name}</b>${x.ppl.join(', ')}</div>`).join('')}</div></div>`;
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
