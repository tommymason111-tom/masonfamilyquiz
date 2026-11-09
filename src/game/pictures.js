// Picture round: drawn on the TV (zoomed, blurred football kits, flags, festive close-ups).
const kit = (body, sleeves, stripes, stripe2, collar = '#fff', shorts = '#fff') => (g, W, H) => {
  g.fillStyle = '#2a3a2a'; g.fillRect(0, 0, W, H); g.filter = 'blur(4px)';
  g.save(); g.translate(W / 2, H / 2 + 10); g.scale(1.25, 1.25);
  g.fillStyle = sleeves; g.beginPath(); g.moveTo(-140, -110); g.lineTo(-60, -130); g.lineTo(-60, -40); g.lineTo(-150, -50); g.fill(); g.beginPath(); g.moveTo(140, -110); g.lineTo(60, -130); g.lineTo(60, -40); g.lineTo(150, -50); g.fill();
  g.fillStyle = body; g.fillRect(-70, -130, 140, 220);
  if (stripes) { g.fillStyle = stripe2; for (let x = -70; x < 70; x += 40) g.fillRect(x, -130, 20, 220); }
  g.fillStyle = collar; g.beginPath(); g.arc(0, -130, 22, 0, Math.PI); g.fill();
  g.fillStyle = shorts; g.fillRect(-70, 95, 140, 50);
  g.restore(); g.filter = 'none';
};
const flagH = (cols) => (g, W, H) => { g.filter = 'blur(2px)'; cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * H / cols.length, W, H / cols.length + 1); }); g.filter = 'none'; };
const nordic = (bg, cross) => (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = cross; g.fillRect(W * 0.3, 0, W * 0.14, H); g.fillRect(0, H * 0.42, W, H * 0.16); };
const zoom = (fn) => (g, W, H) => { g.save(); g.filter = 'blur(10px)'; g.translate(W / 2, H / 2); g.scale(3.2, 3.2); fn(g); g.restore(); g.filter = 'none'; };
export const PICTURES = [
  { round: 'picture', q: 'Whose home kit is this (blurred)?', answer: 'Newcastle', wrong: ['Arsenal', 'Chelsea', 'Liverpool'], draw: kit('#111', '#111', true, '#fff', '#111', '#111') },
  { round: 'picture', q: 'Whose home kit is this (blurred)?', answer: 'Arsenal', wrong: ['Man United', 'Liverpool', 'Brentford'], draw: kit('#d0021b', '#fff', false, null, '#fff', '#fff') },
  { round: 'picture', q: 'Whose home kit is this (blurred)?', answer: 'Man City', wrong: ['Chelsea', 'Tottenham', 'Everton'], draw: kit('#6cabdd', '#6cabdd', false, null, '#fff', '#fff') },
  { round: 'picture', q: 'Whose home kit is this (blurred)? (Essex knows this one)', answer: 'West Ham', wrong: ['Arsenal', 'Chelsea', 'Newcastle'], draw: kit('#7a263a', '#1bb1e7', false, null, '#1bb1e7', '#fff') },
  { round: 'picture', q: 'Whose home kit is this (blurred)?', answer: 'Chelsea', wrong: ['Man City', 'Everton', 'Leicester'], draw: kit('#034694', '#034694', false, null, '#fff', '#034694') },
  { round: 'picture', q: 'Eurovision 2026 winners — whose flag?', answer: 'Bulgaria', wrong: ['Hungary', 'Italy', 'Ireland'], draw: flagH(['#ffffff', '#00966e', '#d62612']) },
  { round: 'picture', q: 'Whose flag is this?', answer: 'Sweden', wrong: ['Norway', 'Denmark', 'Finland'], draw: nordic('#006aa7', '#fecc00') },
  { round: 'picture', q: 'Whose flag is this? (They send us a tree every year)', answer: 'Norway', wrong: ['Sweden', 'Iceland', 'Denmark'], draw: (g, W, H) => { nordic('#ba0c2f', '#ffffff')(g, W, H); g.fillStyle = '#00205b'; g.fillRect(W * 0.33, 0, W * 0.08, H); g.fillRect(0, H * 0.45, W, H * 0.1); } },
  { round: 'picture', q: 'Zoomed right in: what festive thing is this?', answer: 'A sprout', wrong: ['A bauble', 'A satsuma', 'A Christmas pudding'], draw: zoom((g) => { g.fillStyle = '#4a8a2a'; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.fill(); g.strokeStyle = '#2a5a1a'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(8, 0, 30 - i * 4, 1 + i * 0.2, 3 + i * 0.2); g.stroke(); } }) },
  { round: 'picture', q: 'Zoomed right in: what festive thing is this?', answer: 'Rudolph\'s nose', wrong: ['A bauble', 'A cherry', 'A clown nose'], draw: zoom((g) => { g.fillStyle = '#7a4a22'; g.fillRect(-80, -60, 160, 120); g.fillStyle = '#e00'; g.beginPath(); g.arc(0, 10, 22, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(-7, 3, 5, 0, 7); g.fill(); }) },
  { round: 'picture', q: 'Zoomed right in: what is this?', answer: 'A Christmas pudding', wrong: ['A football', 'A snowman', 'A trifle'], draw: zoom((g) => { g.fillStyle = '#3a1e12'; g.beginPath(); g.arc(0, 10, 40, 0, 7); g.fill(); g.fillStyle = '#fff8e8'; g.beginPath(); g.ellipse(0, -18, 34, 14, 0, 0, 7); g.fill(); g.fillStyle = '#1d6a2f'; g.fillRect(-6, -36, 14, 6); g.fillStyle = '#c00'; g.beginPath(); g.arc(0, -32, 4, 0, 7); g.fill(); }) },
  { round: 'picture', q: 'Silhouette: who is this?', answer: 'Gary (this year)', wrong: ['Father Christmas', 'Martin', 'A snowman'], draw: (g, W, H) => { g.fillStyle = '#ddd'; g.fillRect(0, 0, W, H); g.fillStyle = '#111'; g.beginPath(); g.arc(W / 2, 90, 40, 0, 7); g.fill(); g.beginPath(); g.ellipse(W / 2, 230, 95, 120, 0, 0, 7); g.fill(); g.fillRect(W / 2 - 60, 320, 40, 100); g.fillRect(W / 2 + 20, 320, 40, 100); g.fillStyle = '#c00'; g.font = 'bold 26px sans-serif'; g.fillText('(dignified)', W / 2 - 60, 370); } },
];
