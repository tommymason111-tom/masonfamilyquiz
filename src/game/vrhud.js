// The phone pop-ups, in the headset. HTML overlays don't exist inside WebXR, so this draws the same things
// (title cards, the big timer, leaderboards, meters, the question card, the PULL!/TEAR! prompt, the mode's
// score/distance/orders and toasts) onto a canvas on a floating panel that drifts to stay in front of you.
import * as THREE from 'three';
import { G } from '../core.js';
import { S } from './popup.js';
import { saveStore } from './settings.js';

const W = 1024, H = 768, PW = 1.0, PH = PW * H / W, DIST = 1.25;
let canvas, g, tex, mesh, lastV = -1, lastDraw = 0, placed = false;
const _p = new THREE.Vector3(), _f = new THREE.Vector3(), _t = new THREE.Vector3(), _q = new THREE.Quaternion();

function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function panel(x, y, w, h, fill = 'rgba(14,12,22,0.86)', stroke = '#ffd700', r = 22) { rr(x, y, w, h, r); g.fillStyle = fill; g.fill(); g.lineWidth = 4; g.strokeStyle = stroke; g.stroke(); }
function text(s, x, y, size, color = '#fff', align = 'center', font = 'Georgia, serif', weight = '900') { g.font = `${weight} ${size}px ${font}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y); }
function fit(s, maxW, size, font = 'Georgia, serif', weight = '900') { let sz = size; g.font = `${weight} ${sz}px ${font}`; while (g.measureText(s).width > maxW && sz > 14) { sz -= 2; g.font = `${weight} ${sz}px ${font}`; } return sz; }
function wrap(s, x, y, maxW, size, lh, max = 3, color = '#fff', font = 'system-ui, sans-serif', weight = '600') {
  g.font = `${weight} ${size}px ${font}`; const words = String(s).split(/\s+/); let line = '', n = 0;
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { text(line, x, y + n * lh, size, color, 'center', font, weight); line = w; if (++n >= max) return n; } else line = t; }
  if (line) { text(line, x, y + n * lh, size, color, 'center', font, weight); n++; } return n;
}

// ---- the headset menu (Y on the left controller): thumbstick up/down, trigger to choose ----
const MENU = [{ id: 'resume', label: '▶  Resume' }, { id: 'quick', label: '⚡  Quick Quiz' }, { id: 'games', label: '🎲  Mini Games' }, { id: 'fling', label: '🚀  Fling the Relative' }, { id: 'beer', label: '🍺  Drinks Run' }, { id: 'sandbox', label: '🎄  Free Roam' }, { id: 'restart', label: '↺  Restart this game' }, { id: 'exit', label: '⏏  Leave VR' }];
const menu = { open: false, sel: 0, axT: 0, trig: false };
function choose(id) {
  menu.open = false; S.v++;
  if (id === 'resume') return;
  if (id === 'exit') { G.renderer.xr.getSession()?.end(); return; }
  const mode = id === 'restart' ? (G.modes?.id || 'quick') : id; const as = G.me?.name || 'Tommy';
  if (mode !== 'roam') saveStore('mode', mode);
  location.href = `?mode=${mode}&as=${encodeURIComponent(as)}&skip=1&vr=1`;
}
function menuInput(dt) {
  const s = G.renderer.xr.getSession(); if (!s) return; let ay = 0, trig = false;
  for (const src of s.inputSources) { const gp = src.gamepad; if (!gp) continue; const y = gp.axes[3] ?? gp.axes[1] ?? 0; if (Math.abs(y) > Math.abs(ay)) ay = y; if (gp.buttons[0]?.pressed || gp.buttons[0]?.value > 0.6) trig = true; }
  menu.axT -= dt; if (Math.abs(ay) > 0.6 && menu.axT <= 0) { menu.sel = (menu.sel + (ay > 0 ? 1 : -1) + MENU.length) % MENU.length; menu.axT = 0.28; S.v++; } if (Math.abs(ay) < 0.3) menu.axT = 0;
  if (trig && !menu.trig) choose(MENU[menu.sel].id); menu.trig = trig;
}
function drawMenu() {
  g.clearRect(0, 0, W, H); const w = 560, h = 90 + MENU.length * 66, x = W / 2 - w / 2, y = H / 2 - h / 2; panel(x, y, w, h, 'rgba(20,10,16,0.95)', '#ffd700', 26);
  text('MENU', W / 2, y + 44, 34, '#ffd700');
  MENU.forEach((m, i) => { const yy = y + 84 + i * 66; const on = i === menu.sel; if (on) { rr(x + 24, yy, w - 48, 56, 14); g.fillStyle = '#b3122a'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#ffd700'; g.stroke(); }
    const cur = m.id === G.modes?.id; text(m.label + (cur ? '  (playing)' : ''), x + 50, yy + 28, 28, on ? '#fff' : 'rgba(255,255,255,0.85)', 'left', 'system-ui', '800'); });
  text('Thumbstick to move · trigger to choose · Y to close', W / 2, y + h + 26, 20, '#fff', 'center', 'system-ui', '700'); tex.needsUpdate = true;
}

function active() { return menu.open || S.cards.length || S.timer || S.meters || S.q || S.tap || G.modes?.vrLines || (G.ui?.vrToast && G.time < G.ui.vrToast.until); }

function draw(now) {
  g.clearRect(0, 0, W, H);
  // mode HUD (score, fling distance, drink orders) top-left
  const ml = G.modes?.running && G.modes.vrLines;
  if (ml && ml.length) { const lines = ml.slice(0, 9); const h = lines.length > 2 ? 128 + (lines.length - 3) * 34 : 100; panel(16, 16, 330, h, 'rgba(14,12,22,0.8)', 'rgba(255,215,0,0.6)', 18);
    text(lines[0], 181, 44, fit(lines[0], 300, 26), '#ffd700'); text(lines[1], 181, 84, 40);
    lines.slice(2).forEach((l, i) => text(l, 181, 124 + i * 34, fit(l, 300, 22, 'system-ui', '700'), '#fff', 'center', 'system-ui', '700')); }
  // big timer top-centre
  if (S.timer) { const t = S.timer; panel(W / 2 - 150, 16, 300, t.label ? 118 : 92, 'rgba(14,12,22,0.88)', t.urgent ? '#ff4d4d' : '#ffd700');
    if (t.label) text(t.label.toUpperCase(), W / 2, 44, fit(t.label.toUpperCase(), 270, 20, 'system-ui', '800'), '#ffd700', 'center', 'system-ui', '800');
    const pulse = t.urgent ? 1 + 0.06 * Math.sin(now / 80) : 1; text(t.text, W / 2, t.label ? 92 : 62, 56 * pulse, t.urgent ? '#ff6b6b' : '#fff'); }
  // meters (cracker pull)
  if (S.meters) S.meters.forEach((m, i) => { const y = 160 + i * 64; text(m.label, W / 2, y, 24, '#fff', 'center', 'system-ui', '700'); rr(W / 2 - 260, y + 18, 520, 24, 12); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
    rr(W / 2 - 258, y + 20, Math.max(0, 516 * Math.min(1, m.value)), 20, 10); g.fillStyle = m.color || '#ffd700'; g.fill(); });
  // the quiz question
  if (S.q) { const q = S.q; const x = 112, y = 150, w = W - 224; panel(x, y, w, 330, 'rgba(18,40,72,0.94)', '#ffd700');
    text(`QUESTION ${q.n} OF ${q.total}${q.round ? ' · ' + String(q.round).toUpperCase() : ''}`, W / 2, y + 30, 20, '#ffd700', 'center', 'system-ui', '900');
    wrap(q.q, W / 2, y + 72, w - 50, 32, 38, 2, '#fff', 'Georgia, serif', '800');
    const cols = ['#c1121f', '#1d6fd8', '#d39b00', '#2d8a4f']; q.opts.forEach((o, i) => { const bx = x + 20 + (i % 2) * (w / 2 - 10), by = y + 160 + Math.floor(i / 2) * 72; rr(bx, by, w / 2 - 30, 62, 14); g.fillStyle = cols[i]; g.fill(); g.lineWidth = q.selected === i ? 7 : 2; g.strokeStyle = q.selected === i ? '#ffd700' : 'rgba(255,255,255,0.5)'; g.stroke();
      const s = `${'ABCD'[i]}  ${o}`; text(s, bx + 18, by + 31, fit(s, w / 2 - 70, 26, 'system-ui', '800'), '#fff', 'left', 'system-ui', '800'); });
    rr(x + 20, y + 306, w - 40, 10, 5); g.fillStyle = 'rgba(255,255,255,0.2)'; g.fill(); rr(x + 20, y + 306, (w - 40) * Math.max(0, Math.min(1, q.frac ?? 1)), 10, 5); g.fillStyle = '#ffd700'; g.fill(); }
  // title cards / leaderboards (newest on top), with the same pop-in
  const c = S.cards[S.cards.length - 1];
  if (c) { const age = (now - c.t0) / 1000, k = Math.min(1, age / 0.35), sc = 0.6 + 0.4 * (1 - Math.pow(1 - k, 3)) + (k >= 1 ? 0 : 0.04 * Math.sin(k * Math.PI)); const rows = c.rows || [];
    const h = c.rows ? 190 + rows.length * 56 + (c.footer ? 40 : 0) : 300 + (c.icon ? 70 : 0); const w = 720;
    g.save(); g.translate(W / 2, H / 2 + 10); g.scale(sc, sc); g.globalAlpha = Math.min(1, age / 0.25); g.translate(-w / 2, -h / 2);
    const grd = g.createRadialGradient(w / 2, 0, 20, w / 2, h * 0.4, w * 0.8); grd.addColorStop(0, c.c1); grd.addColorStop(1, c.c2); rr(0, 0, w, h, 28); g.fillStyle = grd; g.fill(); g.lineWidth = 5; g.strokeStyle = '#ffd700'; g.stroke();
    let y = 34; if (c.icon) { text(c.icon, w / 2, y + 26 + 6 * Math.sin(now / 250), 60, '#fff', 'center', 'system-ui', '400'); y += 72; }
    if (c.kicker) { text(c.kicker.split('').join(' '), w / 2, y + 6, fit(c.kicker, w - 120, 24), '#ffd700'); y += 40; }
    text(c.title, w / 2, y + 30, fit(c.title, w - 60, 62)); y += 80;
    if (c.rows) { rows.forEach((r, i) => { const ry = y + i * 56; g.globalAlpha = Math.min(1, Math.max(0, (age - 0.15 - i * 0.12) / 0.3)); if (r.me) { rr(24, ry - 4, w - 48, 50, 10); g.fillStyle = 'rgba(255,215,0,0.15)'; g.fill(); }
        text(['🥇', '🥈', '🥉', '4th', '5th'][i] || String(i + 1), 60, ry + 21, 28, '#fff', 'center', 'system-ui', '700'); rr(104, ry + 12, 18, 18, 4); g.fillStyle = r.color || '#888'; g.fill();
        text(`${r.name}${r.me ? ' (you)' : ''}`, 136, ry + 21, fit(`${r.name} (you)`, w - 330, 28, 'system-ui', '800'), r.me ? '#ffd700' : '#fff', 'left', 'system-ui', '800'); text(r.display ?? `${r.score}${c.unit || ''}`, w - 48, ry + 21, 30, r.me ? '#ffd700' : '#fff', 'right', 'system-ui', '900'); });
      g.globalAlpha = 1; if (c.footer) wrap(c.footer, w / 2, y + rows.length * 56 + 18, w - 80, 22, 26, 2); }
    else if (c.sub) wrap(c.sub, w / 2, y + 6, w - 80, 26, 32, 4, 'rgba(255,255,255,0.95)');
    const left = Math.max(0, 1 - age / c.secs); rr(40, h - 26, w - 80, 8, 4); g.fillStyle = 'rgba(255,255,255,0.2)'; g.fill(); rr(40, h - 26, (w - 80) * left, 8, 4); g.fillStyle = '#ffd700'; g.fill();
    g.restore(); }
  // PULL! / TEAR! — in the headset you pull the trigger
  if (S.tap) { const pulse = 1 + 0.05 * Math.sin(now / 90); g.save(); g.translate(W / 2, H - 120); g.scale(pulse, pulse); g.beginPath(); g.arc(0, 0, 82, 0, Math.PI * 2); const gr = g.createRadialGradient(-20, -24, 10, 0, 0, 82); gr.addColorStop(0, '#ff6b6b'); gr.addColorStop(1, '#b3122a'); g.fillStyle = gr; g.fill(); g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke();
    text(S.tap.label, 0, -8, fit(S.tap.label, 140, 40), '#fff'); text('pull the trigger', 0, 34, 18, '#ffd700', 'center', 'system-ui', '800'); g.restore(); }
  // toast strip along the bottom
  const tt = G.ui?.vrToast; if (tt && G.time < tt.until && !S.tap) { g.font = '700 26px system-ui'; const tw = Math.min(W - 80, g.measureText(tt.text).width + 60); panel(W / 2 - tw / 2, H - 92, tw, 64, 'rgba(14,12,22,0.86)', 'rgba(255,215,0,0.7)', 18); wrap(tt.text, W / 2, H - 60, tw - 40, 26, 28, 1); }
  tex.needsUpdate = true;
}

export function initVRHud() {
  canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; g = canvas.getContext('2d');
  tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  mesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  mesh.renderOrder = 999; mesh.frustumCulled = false; mesh.visible = false; G.scene.add(mesh);
  G.vrHud = { mesh, draw: () => draw(performance.now()), toggleMenu: () => { menu.open = !menu.open; menu.sel = 0; menu.trig = true; S.v++; }, menuOpen: () => menu.open, drawMenu: () => drawMenu() };
  G.updaters.push((dt) => {
    if (!G.xr || !active()) { mesh.visible = false; placed = false; return; }
    // follow the head lazily: stays put while you glance around, catches up when you turn away
    const cam = G.renderer.xr.getCamera(); cam.getWorldPosition(_p); cam.getWorldDirection(_f); _f.y = Math.max(-0.35, Math.min(0.2, _f.y)); _f.normalize();
    _t.copy(_p).addScaledVector(_f, DIST); _t.y -= 0.08;
    if (!placed) { mesh.position.copy(_t); placed = true; } else { const d = mesh.position.distanceTo(_t); mesh.position.lerp(_t, Math.min(1, dt * (d > 0.45 ? 4 : 1.2))); }
    mesh.lookAt(_p); mesh.visible = true;
    const now = performance.now(); const animating = S.cards.length || S.tap || S.timer?.urgent || S.q;
    if (menu.open) { menuInput(dt); if (S.v !== lastV || now - lastDraw > 250) { lastV = S.v; lastDraw = now; menu.open ? drawMenu() : draw(now); } return; }
    if (S.v !== lastV || (animating && now - lastDraw > 50) || now - lastDraw > 250) { lastV = S.v; lastDraw = now; draw(now); }
  });
}
