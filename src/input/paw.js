// Chip's front paws, for when you play as Chip: a furry foreleg in his beige coat, a cream paw with four toes,
// black toe beans and a big pad underneath, and little dark claws. Built pointing along -z (toes forward), pads
// facing down (-y), origin at the middle of the paw so it can sit where a hand would.
import * as THREE from 'three';
import { Prop } from '../engine/geo.js';

const BEIGE = '#d8b685', DARK = '#b8925e', CREAM = '#ecd3a8', PAD = '#2a1c18', CLAW = '#3a2c24';
export function makePaw(side = 1) {
  const p = new Prop();
  // foreleg rising up and back from the paw (towards your chest), with tufts of fur round it
  const L = 0.34, ang = 1.2, dy = Math.cos(ang), dz = Math.sin(ang);
  p.cyl(0.042, 0.034, L, BEIGE, 0, dy * L / 2 + 0.005, dz * L / 2, ang, 0, 0, 14);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const f = 0.25 + (k % 3) * 0.2; p.cone(0.011, 0.03, k % 2 ? BEIGE : CREAM, Math.cos(a) * 0.035, dy * L * f + Math.sin(a) * 0.03, dz * L * f, ang + Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5, 6); }
  // the paw itself
  p.sph(0.05, CREAM, 0, 0.004, -0.004, 1.1, 0.66, 1.15, 16).sph(0.03, DARK, 0, 0.026, 0.02, 1, 0.5, 1.2, 10);
  for (let t = 0; t < 4; t++) { const x = (t - 1.5) * 0.022; const z = -0.042 - (t === 1 || t === 2 ? 0.008 : 0);
    p.sph(0.019, CREAM, x * 1.12, 0.0, z - 0.004, 1, 0.85, 1.1, 10); // toe
    p.sph(0.009, PAD, x, -0.017, z - 0.002, 1, 0.5, 1.1, 8); // toe bean
    p.cone(0.004, 0.014, CLAW, x, -0.006, z - 0.017, -Math.PI / 2 - 0.3, 0, 0, 5); } // claw
  p.sph(0.022, PAD, 0, -0.024, 0.006, 1.2, 0.45, 1, 10); // main pad
  p.sph(0.012, PAD, side * 0.03, -0.012, 0.03, 0.8, 0.5, 1, 8); // dew claw pad
  const m = new THREE.Mesh(p.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  m.castShadow = false; const g = new THREE.Group(); g.add(m); return g;
}
