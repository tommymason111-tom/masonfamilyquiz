// Creates the 19 people from the cast list, with their accessories, and Gary's outfit of the year.
import * as THREE from 'three';
import { G, hashStr, pick } from '../core.js';
import { CAST, SKIN, OUTFITS } from './cast.js';
import { Person } from './rig.js';
import { Prop } from '../engine/geo.js';
import { knitBump } from '../engine/textures.js';
import { loadStore } from '../game/settings.js';

let accMat = null;
const acc = (build) => { const p = new Prop(); build(p); const m = new THREE.Mesh(p.build(), accMat); m.castShadow = true; return m; };

export function chooseOutfit() {
  const sel = new URLSearchParams(location.search).get('outfit') || G.settings.garyOutfit;
  const unlocked = loadStore('unlockedOutfits', ['mankini', 'sumo', 'santa', 'turkey', 'xmastree', 'mrsclaus', 'elf', 'trex', 'donkey', 'speedo']);
  if (sel && sel !== 'random') { const o = OUTFITS.find(o => o.id === sel); if (o) return o; }
  return pick(OUTFITS.filter(o => unlocked.includes(o.id)));
}

export function createPeople() {
  accMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
  const knit = knitBump(); knit.repeat.set(40, 40);
  const outfit = chooseOutfit(); G.garyOutfit = outfit;
  CAST.forEach((c, i) => {
    let spec = { ...c, seed: hashStr(c.name) + 7, skin: SKIN[i % SKIN.length], _knitTex: null };
    if (c.name === 'Gary') spec = { ...spec, ...outfit, top: { ...outfit.top }, name: 'Gary', team: 'debbie', build: 'bigger', voice: c.voice, lines: c.lines, hair: outfit.wig ? { style: 'wig', color: '#d8d8d8', length: 0.3 } : c.hair };
    if (G.settings.softDrinks && c.lines) {/* lines stay; drinks are swapped in items */}
    const p = new Person(spec);
    G.chars.push(p); G.charByName[c.name] = p;
    if (p.isPlayer) G.tommy = p;
    dress(p, c, outfit);
  });
}

function dress(p, c, outfit) {
  const H = p.H, O = p.O, d = p.dims, hd = d.head;
  const headTop = new THREE.Vector3(0, hd.cy - O[2].y + hd.ry * 0.85, hd.cz);
  const handR = new THREE.Vector3(0, -(O[6].y - (d.wristY - 0.065 * H)), 0.025);
  const handL = new THREE.Vector3(0, -(O[4].y - (d.wristY - 0.065 * H)), 0.025);
  const neck = new THREE.Vector3(0, O[2].y - O[1].y, 0);
  switch (c.name) {
    case 'Charli': p.crown = p.attach(crown(c.crown), 'head', headTop.clone().add(new THREE.Vector3(0, 0.0, 0)), new THREE.Euler(-0.15, 0, 0)); p.attach(phone(), 'lArmR', handR, new THREE.Euler(0, 0, 0.2)); break;
    case 'Paul': {
      p.attach(acc(P => P.torus(0.022, 0.003, '#222', -0.03, 0, 0, Math.PI / 2 - 0.3).torus(0.022, 0.003, '#222', 0.03, 0, 0, Math.PI / 2 - 0.3).box(0.02, 0.004, 0.004, '#222', 0, 0, 0)), 'head', headTop.clone().add(new THREE.Vector3(0, -0.01, 0.06)), new THREE.Euler(-0.4, 0, 0));
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.014 * H / 1.8, 10, 8), new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff0000', emissiveIntensity: 1 }));
      const pr = d.p; nose.position.set(0, (pr.waist + 0.1 - 0.012) * H - O[1].y, 0.12 * H * 0.6 + 0.035); p.attach(nose, 'spine', nose.position.clone()); p.noseLight = nose;
      // push nose out to the jumper surface
      nose.position.z = 0.105 * H * 1.0; break;
    }
    case 'Martin':
      p.attach(clipboard(), 'lArmL', handL.clone().add(new THREE.Vector3(0.02, 0.05, 0.05)), new THREE.Euler(-0.3, 0, 1.5));
      p.attach(acc(P => { P.torus(0.07 * H / 1.8, 0.003, '#1d3557', 0, 0, 0, Math.PI / 2 + 0.6, 0, 0); P.box(0.03, 0.012, 0.012, '#c0c0c0', 0, -0.08, 0.06); }), 'spine', neck.clone().add(new THREE.Vector3(0, -0.04, 0.02)));
      p.attach(acc(P => P.cyl(0.004, 0.004, 0.12, '#1d4ed8', 0, 0, 0, 0, 0, 1.4)), 'head', new THREE.Vector3(hd.rx * 0.95, hd.cy - O[2].y + 0.03, hd.cz - 0.01));
      break;
    case 'Karen': p.attach(wineGlass(), 'lArmR', handR.clone().add(new THREE.Vector3(-0.02, 0.06, 0.03))); p.attach(acc(P => P.rbox(0.28, 0.2, 0.1, 0.03, '#5a2a3a').torus(0.18, 0.006, '#3a1a2a', 0, 0.18, 0, 0, 0, 0, Math.PI)), 'uArmL', new THREE.Vector3(0.06, -0.18, 0)); break;
    case 'Julie': p.attach(acc(P => P.box(0.18, 0.005, 0.38, '#f4f4f4').box(0.18, 0.006, 0.03, '#c1121f', 0, 0, 0.14).box(0.18, 0.006, 0.03, '#c1121f', 0, 0, -0.14)), 'spine', new THREE.Vector3(-d.shoulderHalf * 0.6, O[3].y - O[1].y + 0.02, 0), new THREE.Euler(0, 0, -0.5));
      p.attach(acc(P => P.rbox(0.07, 0.03, 0.2, 0.012, '#c1121f')), 'lArmL', handL.clone().add(new THREE.Vector3(0, 0.03, 0)), new THREE.Euler(Math.PI / 2, 0, 0)); break;
    case 'Hollie': p.attach(phone(true), 'lArmR', handR, new THREE.Euler(0, 0, 0.2)); p.phoneGlow = true; break;
    case 'Dan': p.attach(pint(), 'lArmR', handR.clone().add(new THREE.Vector3(-0.02, 0.05, 0.03))); break;
    case 'Sophie': p.attach(acc(P => P.box(0.04, 0.3, 0.24, '#f4c0d0').box(0.045, 0.31, 0.02, '#ffffff', 0, 0, 0.11)), 'lArmL', handL.clone().add(new THREE.Vector3(0.03, 0.03, 0.04)));
      p.attach(acc(P => P.torus(0.008, 0.002, '#d4af37', 0, 0, 0).sph(0.004, '#e8f4ff', 0, 0.01, 0)), 'lArmL', handL.clone().add(new THREE.Vector3(0.012, -0.05, 0.0))); break;
    case 'Debbie': p.attach(acc(P => { for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; P.sph(0.022, i % 2 ? '#c0c0c0' : '#d4af37', Math.sin(a) * 0.075 * H / 1.6, 0, Math.cos(a) * 0.07 * H / 1.6, 1, 1, 1, 5); } P.sph(0.022, '#d4af37', 0.03, -0.12, 0.08, 0.8, 3, 0.8, 5); }), 'spine', neck.clone().add(new THREE.Vector3(0, -0.01, 0)));
      for (const s of [-1, 1]) p.attach(acc(P => P.torus(0.018, 0.004, '#d4af37', 0, 0, 0, 0, Math.PI / 2, 0)), 'head', new THREE.Vector3(s * hd.rx * 1.02, hd.cy - O[2].y - hd.ry * 0.3, hd.cz - 0.01)); break;
    case 'Harry': p.attach(acc(P => P.sph(1, '#222', 0, 0, 0, hd.rx * 1.12, hd.ry * 0.62, hd.rz * 1.1, 14).box(hd.rx * 1.7, 0.008, hd.rz * 0.9, '#1a1a1a', 0, -hd.ry * 0.05, hd.rz * 1.15, -0.15)), 'head', new THREE.Vector3(0, hd.cy - O[2].y + hd.ry * 0.38, hd.cz)); break;
    case 'Mason': p.attach(acc(P => P.sph(0.03, '#2d6a4f', 0, 0, 0, 1.4, 0.8, 0.8).cone(0.012, 0.04, '#2d6a4f', -0.05, 0, 0, 0, 0, Math.PI / 2)), 'lArmR', handR.clone()); p.attach(acc(P => P.rbox(0.07, 0.03, 0.04, 0.01, '#d62828')), 'lArmL', handL.clone()); break;
    case 'Gary':
      if (outfit.lights) { const L = acc(P => { for (let i = 0; i < 30; i++) { const a = i * 2.4, y = -0.2 + i * 0.02; P.sph(0.012, ['#ff2020', '#ffd700', '#40ff60', '#40a0ff'][i % 4], Math.sin(a) * (0.2 - i * 0.004) * H, y * H, Math.cos(a) * (0.2 - i * 0.004) * H, 1, 1, 1, 5); } }); L.material = new THREE.MeshBasicMaterial({ vertexColors: true }); p.attach(L, 'spine', new THREE.Vector3(0, 0.0, 0)); }
      if (outfit.id === 'trex') p.attach(acc(P => P.sph(0.14, '#4a9a42', 0, 0, 0.06, 1, 0.9, 1.4, 12).box(0.18, 0.03, 0.14, '#f4f4f4', 0, -0.05, 0.2).sph(0.025, '#ffffff', 0.07, 0.07, 0.13).sph(0.025, '#ffffff', -0.07, 0.07, 0.13).sph(0.012, '#111', 0.07, 0.075, 0.15).sph(0.012, '#111', -0.07, 0.075, 0.15)), 'head', new THREE.Vector3(0, hd.cy - O[2].y + hd.ry * 0.9, hd.cz));
      break;
  }
  if (c.name !== 'Charli' && c.name !== 'Mason' && c.name !== 'Harrison' && c.name !== 'Harry' && c.name !== 'Tommy' && Math.random() < 0.35 && !(c.name === 'Gary')) {
    p.crown = p.attach(crown(pick(['#f2c20f', '#e63946', '#2a9d8f', '#3a86ff', '#ff006e'])), 'head', headTop.clone(), new THREE.Euler(-0.12, 0, 0.05));
  }
  if (c.name === 'Tommy') p.crown = p.attach(crown('#3a86ff'), 'head', headTop.clone(), new THREE.Euler(-0.12, 0, 0));
}
export function crown(color) { return acc(P => { const s = 0.92; P.cyl(0.095 * s, 0.095 * s, 0.04, color, 0, 0, 0, 0, 0, 0, 20, true); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P.cone(0.022, 0.03, color, Math.sin(a) * 0.087, 0.035, Math.cos(a) * 0.087, 0, a, 0, 4); } }); }
const phone = (glow) => { const m = acc(P => P.rbox(0.072, 0.15, 0.009, 0.006, '#111').box(0.064, 0.135, 0.002, '#4a8ad8', 0, 0, 0.005)); return m; };
const clipboard = () => acc(P => P.box(0.24, 0.33, 0.012, '#8a6a3a').box(0.21, 0.28, 0.003, '#ffffff', 0, -0.01, 0.007).box(0.08, 0.03, 0.012, '#c0c0c0', 0, 0.15, 0.008));
const wineGlass = () => { const p = new Prop().lathe([[0, -0.1], [0.035, -0.1], [0.005, -0.09], [0.005, -0.02], [0.03, 0], [0.04, 0.05], [0.038, 0.1], [0, 0.0]], '#e8f0f4', 0, 0, 0, 14).cyl(0.034, 0.025, 0.04, '#6a0a1a', 0, 0.025, 0); const m = new THREE.Mesh(p.build(), new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.7, roughness: 0.05 })); return m; };
const pint = () => { const p = new Prop().cyl(0.045, 0.036, 0.16, '#d8a020', 0, 0, 0, 0, 0, 0, 14).cyl(0.046, 0.045, 0.025, '#f8f4e8', 0, 0.075, 0, 0, 0, 0, 14); return new THREE.Mesh(p.build(), new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.85, roughness: 0.1 })); };
