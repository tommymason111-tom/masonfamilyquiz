// Martin's TV and the games-room PC: canvas screens for questions, scores (they disagree by 2), the outfit
// wheel, the dispute wheel, CBeebies, blue screens — and a render-target for the instant replay.
import * as THREE from 'three';
import { G } from '../core.js';
import { canvasTex } from '../engine/textures.js';

export class Screens {
  constructor() {
    G.screens = this;
    const tv = G.house.tv;
    this.tvTex = canvasTex(1024, 576); this.tvCtx = this.tvTex.userData.ctx;
    this.tvMat = new THREE.MeshBasicMaterial({ map: this.tvTex, toneMapped: false });
    this.tvMesh = new THREE.Mesh(new THREE.PlaneGeometry(tv.w, tv.h), this.tvMat); this.tvMesh.position.set(0, 0.5, 0.027); tv.group.add(this.tvMesh);
    this.overlayTex = canvasTex(1024, 576); this.overlayMat = new THREE.MeshBasicMaterial({ map: this.overlayTex, transparent: true, toneMapped: false });
    this.overlay = new THREE.Mesh(new THREE.PlaneGeometry(tv.w, tv.h), this.overlayMat); this.overlay.position.set(0, 0.5, 0.029); this.overlay.visible = false; tv.group.add(this.overlay);
    this.crack = null; this.mode = 'idle'; this.drawFn = null;
    const pc = G.house.pc;
    this.pcTex = canvasTex(512, 300); this.pcCtx = this.pcTex.userData.ctx;
    this.pcMesh = new THREE.Mesh(new THREE.PlaneGeometry(pc.w, pc.h), new THREE.MeshBasicMaterial({ map: this.pcTex, toneMapped: false })); this.pcMesh.position.set(0, 0.36, 0.021); pc.group.add(this.pcMesh);
    this.pcMode = 'scores';
    this.lastDraw = 0;
  }
  setTV(fn) { this.drawFn = fn; this.redraw(); }
  redraw() {
    const g = this.tvCtx, W = 1024, H = 576;
    if (G.systems?.tvOff) { g.fillStyle = '#050505'; g.fillRect(0, 0, W, H); }
    else if (G.systems?.cbeebies) cbeebies(g, W, H);
    else if (this.drawFn) this.drawFn(g, W, H); else { g.fillStyle = '#123'; g.fillRect(0, 0, W, H); }
    if (G.systems?.tvDamage >= 5) drawCrack(g, W, H, G.systems.tvDamage);
    if (G.systems?.noseprints) { g.fillStyle = 'rgba(255,255,255,0.12)'; for (const [x, y] of G.systems.noseprints) { g.beginPath(); g.ellipse(x, y, 26, 18, 0, 0, 7); g.fill(); } }
    if (G.systems?.tvCovered) { g.fillStyle = '#f2c20f'; g.beginPath(); g.ellipse(700, 200, 220, 120, 0.3, 0, 7); g.fill(); g.fillStyle = '#000'; g.font = 'bold 40px sans-serif'; g.fillText('(paper crown stuck on the TV)', 520, 210); }
    this.tvTex.needsUpdate = true;
  }
  update(dt) {
    if (G.time - this.lastDraw > 0.2) { this.lastDraw = G.time; this.redraw(); this.drawPC(); }
    // TV wobble after 10 hits
    const tv = G.house.tv; const dmg = G.systems?.tvDamage || 0;
    tv.group.rotation.z = dmg >= 10 && dmg < 15 ? Math.sin(G.time * 7) * 0.02 : 0;
    G.house.lights.tv.intensity = G.systems?.tvOff ? 0 : 0.6;
  }
  drawPC() {
    const g = this.pcCtx, W = 512, H = 300;
    if (G.systems?.pcBlue) { g.fillStyle = '#1a5fb4'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = '64px sans-serif'; g.fillText(':(', 30, 90); g.font = '18px sans-serif'; g.fillText('Your PC ran into a problem during Family Feud.', 30, 140); g.fillText('Everyone was definitely winning.', 30, 170); g.fillText('Ask Dan to turn it off and on again.', 30, 200); this.pcTex.needsUpdate = true; return; }
    const q = G.quiz; g.fillStyle = '#0b1830'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffd700'; g.font = 'bold 26px sans-serif'; g.fillText('MASON QUIZ — OFFICIAL SCORES', 20, 40);
    g.font = '13px monospace'; g.fillStyle = '#8ab'; g.fillText('scores.xlsx (last saved by Martin)', 20, 62);
    if (q) { const s = q.pcScores(); let y = 110; for (const t of ['paul', 'martin', 'debbie']) { g.fillStyle = q.teamColor(t); g.fillRect(20, y - 28, 12, 36); g.fillStyle = '#fff'; g.font = 'bold 30px sans-serif'; g.fillText(q.teamName(t), 44, y); g.fillText(String(s[t]), 420, y); y += 60; } }
    this.pcTex.needsUpdate = true;
  }
  showOverlay(fn) { if (!fn) { this.overlay.visible = false; return; } const g = this.overlayTex.userData.ctx; g.clearRect(0, 0, 1024, 576); fn(g, 1024, 576); this.overlayTex.needsUpdate = true; this.overlay.visible = true; }
}
function drawCrack(g, W, H, n) {
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2; const cx = W * 0.62, cy = H * 0.38;
  for (let i = 0; i < 9 + n; i++) { const a = i * 2.3; let x = cx, y = cy; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += Math.cos(a + k * 0.4) * 40; y += Math.sin(a + k * 0.3) * 40; g.lineTo(x, y); } g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.font = 'bold 22px sans-serif'; g.fillText('(crack sticker)', cx - 60, cy + 120);
}
function cbeebies(g, W, H) {
  const t = G.time; g.fillStyle = '#7fd34a'; g.fillRect(0, 0, W, H); g.fillStyle = '#ffd60a'; g.beginPath(); g.arc(W / 2 + Math.sin(t) * 200, 200, 90, 0, 7); g.fill();
  g.fillStyle = '#ff6fa8'; g.beginPath(); g.arc(300, 420 + Math.sin(t * 3) * 20, 70, 0, 7); g.fill(); g.fillStyle = '#4fa8ff'; g.beginPath(); g.arc(720, 430 + Math.cos(t * 3) * 20, 70, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 60px sans-serif'; g.fillText('KIDS\' TELLY', 340, 90); g.font = '28px sans-serif'; g.fillText('(Mason has the remote. Get it back!)', 280, 540);
}

// ---------- shared TV drawing helpers ----------
export function tvFrame(g, W, H, title, color = '#7a1f24') {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#13213f'); gr.addColorStop(1, '#0a1020'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = color; g.fillRect(0, 0, W, 70); g.fillStyle = '#ffd700'; g.font = 'bold 40px Georgia, serif'; g.fillText(title, 24, 50);
  // snowflakes
  g.fillStyle = 'rgba(255,255,255,0.15)'; for (let i = 0; i < 30; i++) { const x = (i * 97 + G.time * 20) % W, y = (i * 53 + G.time * 30 * (1 + i % 3)) % H; g.beginPath(); g.arc(x, y, 2 + i % 3, 0, 7); g.fill(); }
}
export function wrapText(g, text, x, y, maxW, lh) { const words = String(text).split(' '); let line = ''; for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; } else line = t; } g.fillText(line, x, y); return y + lh; }
export function drawWheel(g, cx, cy, r, labels, colors, angle) {
  const n = labels.length;
  for (let i = 0; i < n; i++) { const a0 = angle + i / n * Math.PI * 2, a1 = angle + (i + 1) / n * Math.PI * 2; g.fillStyle = colors[i % colors.length]; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a1); g.closePath(); g.fill();
    g.save(); g.translate(cx, cy); g.rotate((a0 + a1) / 2); g.fillStyle = '#fff'; g.font = `bold ${Math.max(14, 30 - n)}px sans-serif`; g.textAlign = 'right'; g.fillText(labels[i].slice(0, 24), r - 14, 8); g.restore(); }
  g.fillStyle = '#ffd700'; g.beginPath(); g.moveTo(cx + r + 30, cy - 18); g.lineTo(cx + r - 10, cy); g.lineTo(cx + r + 30, cy + 18); g.fill();
  g.fillStyle = '#222'; g.beginPath(); g.arc(cx, cy, 24, 0, 7); g.fill();
}
