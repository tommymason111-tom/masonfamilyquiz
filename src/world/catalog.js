// The things in Martin's house. ~150 item types / ~420 physical objects, every one grabbable.
// shape: ['box',hx,hy,hz] | ['ball',r] | ['cyl',halfH,r] | ['cap',halfH,r]   (geometry is centred on the body)
import * as THREE from 'three';
import { G, GR, groups, ALL } from '../core.js';
import { Prop } from '../engine/geo.js';
import * as TX from '../engine/textures.js';
import { staticBox } from '../engine/physics.js';

const P = () => new Prop();
const texMat = (t, opts = {}) => () => new THREE.MeshStandardMaterial({ map: t(), roughness: 0.6, ...opts });
const glassMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45 });
const BRIGHT = ['#d62828', '#f77f00', '#fcbf49', '#2a9d8f', '#3a86ff', '#8338ec', '#ff006e', '#06d6a0'];
const BAUBLE = ['#c1121f', '#d4af37', '#c0c0c0', '#1d3557', '#2d6a4f', '#e63946', '#ffd60a', '#7b2cbf'];

// ---- reusable shapes ----
const can = (c1, c2) => P().cyl(0.033, 0.033, 0.105, c1, 0, 0, 0, 0, 0, 0, 16).cyl(0.034, 0.034, 0.03, c2, 0, 0.01, 0).cyl(0.028, 0.033, 0.012, '#c8c8c8', 0, 0.058, 0).cyl(0.03, 0.03, 0.004, '#aaa', 0, 0.064, 0).box(0.015, 0.003, 0.025, '#999', 0, 0.067, 0.01).build();
const bottle = (glass, label, cap, h = 0.3, r = 0.038) => P().lathe([[0, -h / 2], [r, -h / 2], [r, h * 0.12], [r * 0.4, h * 0.3], [r * 0.32, h * 0.48], [0, h * 0.5]], glass, 0, 0, 0, 16)
  .cyl(r * 1.01, r * 1.01, h * 0.25, label, 0, -h * 0.1, 0).cyl(r * 0.36, r * 0.36, h * 0.07, cap, 0, h * 0.47, 0).build();
const box = (w, h, d, c) => P().box(w, h, d, c).build();
const rbox = (w, h, d, r, c) => P().rbox(w, h, d, r, c).build();
const plate = (r, c) => P().cyl(r, r * 0.8, 0.02, c, 0, 0, 0, 0, 0, 0, 24).build();
const bowl = (r, h, c, fill) => { const p = P().lathe([[0, -h / 2], [r * 0.6, -h / 2], [r, h / 2], [r * 0.94, h / 2], [r * 0.56, -h / 2 + 0.01], [0, -h / 2 + 0.01]], c, 0, 0, 0, 24); if (fill) p.cyl(r * 0.9, r * 0.6, 0.02, fill, 0, h / 2 - 0.02, 0, 0, 0, 0, 20); return p.build(); };

export const CATALOG = {
  // ===================== LIVING ROOM =====================
  cushion: { name: 'Cushion', geo: () => P().rbox(0.44, 0.14, 0.44, 0.06, '#ffffff', 0, 0, 0, 0, 0, 0, 3).box(0.2, 0.002, 0.2, '#dddddd', 0, 0.071, 0).build(), shape: ['box', 0.22, 0.07, 0.22], mass: 0.4, sound: 'cushion', tints: ['#b23a48', '#e9c46a', '#264653', '#f4f1de', '#2a9d8f', '#6d597a'], bounce: 0.3, throwSquad: true },
  coffee_table: { name: 'Coffee table', geo: () => P().box(1.2, 0.05, 0.62, '#4a2e1c', 0, 0.185, 0).box(1.1, 0.03, 0.55, '#3a2216', 0, -0.1, 0).box(0.05, 0.4, 0.05, '#3a2216', -0.55, 0, -0.27).box(0.05, 0.4, 0.05, '#3a2216', 0.55, 0, -0.27).box(0.05, 0.4, 0.05, '#3a2216', -0.55, 0, 0.27).box(0.05, 0.4, 0.05, '#3a2216', 0.55, 0, 0.27).build(), shape: ['box', 0.6, 0.21, 0.31], mass: 18, sound: 'thud', fixed: true },
  armchair: { name: "Martin's armchair", geo: () => P().rbox(0.9, 0.42, 0.85, 0.05, '#6b4a3a', 0, -0.2, 0).rbox(0.9, 0.6, 0.2, 0.08, '#7a5543', 0, 0.3, -0.33).rbox(0.16, 0.3, 0.85, 0.07, '#7a5543', -0.37, 0.12, 0).rbox(0.16, 0.3, 0.85, 0.07, '#7a5543', 0.37, 0.12, 0).rbox(0.58, 0.12, 0.62, 0.05, '#8a6553', 0, 0.06, 0.06).build(), shape: ['box', 0.45, 0.42, 0.42], mass: 32, sound: 'thud', angDamp: 1.5, fixed: true },
  pouffe: { name: 'Pouffe', geo: () => P().cyl(0.25, 0.25, 0.38, '#8a3a3a', 0, 0, 0, 0, 0, 0, 20).torus(0.25, 0.02, '#6a2a2a', 0, 0.19, 0, Math.PI / 2).build(), shape: ['cyl', 0.19, 0.25], mass: 4, sound: 'cushion', fixed: true },
  remote: { name: 'TV remote', geo: () => { const p = P().rbox(0.05, 0.022, 0.18, 0.008, '#1a1a1a'); for (let i = 0; i < 12; i++) p.box(0.009, 0.004, 0.009, i === 0 ? '#c22' : '#555', -0.013 + (i % 3) * 0.013, 0.012, -0.05 + Math.floor(i / 3) * 0.022); return p.build(); }, shape: ['box', 0.025, 0.011, 0.09], mass: 0.15, use: 'remote', important: true },
  answer_sheet: { name: 'Answer sheet (clipboard)', geo: () => P().box(0.24, 0.012, 0.33, '#8a6a3a').box(0.21, 0.002, 0.28, '#ffffff', 0, 0.007, -0.01).box(0.08, 0.01, 0.03, '#c0c0c0', 0, 0.01, -0.15).build(), shape: ['box', 0.12, 0.008, 0.165], mass: 0.3, sound: 'tap', use: 'sheet', important: true, extra: 0 },
  pen: { name: 'Biro', geo: () => P().cyl(0.004, 0.004, 0.14, '#ffffff', 0, 0, 0, 0, 0, Math.PI / 2, 8).cone(0.004, 0.012, '#222', 0.076, 0, 0, 0, 0, -Math.PI / 2, 8).cyl(0.0045, 0.0045, 0.02, '#1d4ed8', -0.065, 0, 0, 0, 0, Math.PI / 2, 8).build(), shape: ['cap', 0.065, 0.005], mass: 0.01, tints: ['#1d4ed8', '#111111', '#c1121f'], use: 'pen' },
  cracker: { name: 'Christmas cracker', geo: () => P().cyl(0.025, 0.025, 0.14, '#ffffff', 0, 0, 0, 0, 0, Math.PI / 2, 12).cyl(0.018, 0.025, 0.04, '#ffffff', -0.09, 0, 0, 0, 0, Math.PI / 2, 12).cyl(0.025, 0.018, 0.04, '#ffffff', 0.09, 0, 0, 0, 0, Math.PI / 2, 12).cyl(0.026, 0.026, 0.03, '#d4af37', 0, 0, 0, 0, 0, Math.PI / 2, 12).build(), shape: ['cap', 0.1, 0.026], mass: 0.05, tints: ['#c1121f', '#2d6a4f', '#1d3557', '#7b2cbf', '#d4af37'], use: 'cracker', sound: 'tap' },
  paper_crown: { name: 'Paper crown', geo: () => { const p = P().cyl(0.095, 0.095, 0.04, '#ffffff', 0, -0.01, 0, 0, 0, 0, 20, true); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; p.cone(0.022, 0.03, '#ffffff', Math.sin(a) * 0.093, 0.025, Math.cos(a) * 0.093, 0, a, 0, 4); } return p.build(); }, shape: ['cyl', 0.03, 0.095], mass: 0.01, tints: ['#f2c20f', '#e63946', '#2a9d8f', '#3a86ff', '#ff006e'], linDamp: 1.5, use: 'crown', extra: 20 },
  celeb_tin: { name: 'Tin of Celebrations', geo: () => P().cyl(0.12, 0.12, 0.16, '#d4af37', 0, 0, 0, 0, 0, 0, 24).cyl(0.122, 0.122, 0.03, '#7b2cbf', 0, 0.07, 0, 0, 0, 0, 24).cyl(0.121, 0.121, 0.05, '#c1121f', 0, -0.03, 0, 0, 0, 0, 24).build(), shape: ['cyl', 0.08, 0.12], mass: 0.9, sound: 'clink', use: 'tin' },
  celebration: { name: 'Chocolate', geo: () => P().rbox(0.04, 0.02, 0.025, 0.006, '#ffffff').cone(0.008, 0.012, '#ffffff', 0.025, 0, 0, 0, 0, -Math.PI / 2, 6).cone(0.008, 0.012, '#ffffff', -0.025, 0, 0, 0, 0, Math.PI / 2, 6).build(), shape: ['box', 0.03, 0.01, 0.013], mass: 0.015, tints: ['#c1121f', '#ffd60a', '#3a86ff', '#ff006e', '#2d6a4f', '#ffffff', '#7b2cbf'], food: 'chocolate', use: 'eat', extra: 40 },
  quality_tin: { name: 'Tin of Quality Street', geo: () => P().cyl(0.11, 0.11, 0.12, '#7b2cbf', 0, 0, 0, 0, 0, 0, 8).cyl(0.112, 0.112, 0.02, '#d4af37', 0, 0.05, 0, 0, 0, 0, 8).build(), shape: ['cyl', 0.06, 0.11], mass: 0.8, sound: 'clink', use: 'tin' },
  sweet: { name: 'Sweet', geo: () => P().sph(0.014, '#ffffff', 0, 0, 0, 1.3, 0.8, 1, 8).cone(0.01, 0.012, '#ffffff', 0.022, 0, 0, 0, 0, -Math.PI / 2, 5).cone(0.01, 0.012, '#ffffff', -0.022, 0, 0, 0, 0, Math.PI / 2, 5).build(), shape: ['ball', 0.015], mass: 0.01, tints: ['#7b2cbf', '#2d6a4f', '#ffd60a', '#e63946', '#f77f00'], food: 'sweet', use: 'eat' },
  bauble: { name: 'Bauble', geo: () => P().sph(0.04, '#ffffff', 0, 0, 0, 1, 1, 1, 14).cyl(0.01, 0.01, 0.015, '#d4af37', 0, 0.044, 0, 0, 0, 0, 8).build(), shape: ['ball', 0.04], mass: 0.03, tints: BAUBLE, sound: 'bauble', bounce: 0.55, extra: 34 },
  tree_star: { name: 'Angel tree-topper', geo: () => P().cone(0.06, 0.16, '#f4f4f4', 0, -0.02, 0, 0, 0, 0, 10).sph(0.03, '#f2d0b0', 0, 0.08, 0).box(0.14, 0.06, 0.01, '#fff8d0', 0, 0.03, -0.03).torus(0.025, 0.004, '#ffd700', 0, 0.12, 0, Math.PI / 2).build(), shape: ['cyl', 0.09, 0.06], mass: 0.1, important: true },
  present_s: { name: 'Small present', geo: () => P().box(0.16, 0.12, 0.16, '#ffffff').box(0.03, 0.125, 0.165, '#f0e0a0').box(0.165, 0.125, 0.03, '#f0e0a0').sph(0.03, '#f0e0a0', 0, 0.07, 0, 1.4, 0.6, 1.4, 8).build(), shape: ['box', 0.08, 0.06, 0.08], mass: 0.4, tints: BRIGHT, use: 'present', sound: 'tap', extra: 12 },
  present_m: { name: 'Present', geo: () => P().box(0.3, 0.2, 0.25, '#ffffff').box(0.04, 0.205, 0.255, '#f0e0a0').box(0.305, 0.205, 0.04, '#f0e0a0').sph(0.04, '#f0e0a0', 0, 0.11, 0, 1.4, 0.6, 1.4, 8).build(), shape: ['box', 0.15, 0.1, 0.125], mass: 1.2, tints: BRIGHT, use: 'present', sound: 'tap', extra: 12 },
  present_l: { name: 'Big present', geo: () => P().box(0.45, 0.35, 0.4, '#ffffff').box(0.05, 0.355, 0.405, '#f0e0a0').box(0.455, 0.355, 0.05, '#f0e0a0').sph(0.06, '#f0e0a0', 0, 0.19, 0, 1.4, 0.6, 1.4, 8).build(), shape: ['box', 0.225, 0.175, 0.2], mass: 3, tints: BRIGHT, use: 'present', sound: 'thud' },
  coaster: { name: 'Coaster', geo: () => P().cyl(0.05, 0.05, 0.008, '#3a2216', 0, 0, 0, 0, 0, 0, 16).cyl(0.045, 0.045, 0.009, '#c8b090', 0, 0, 0, 0, 0, 0, 16).build(), shape: ['cyl', 0.004, 0.05], mass: 0.03 },
  wine_glass: { name: 'Wine glass', geo: () => P().lathe([[0, -0.1], [0.035, -0.1], [0.035, -0.095], [0.005, -0.09], [0.005, -0.02], [0.03, 0.0], [0.04, 0.05], [0.038, 0.1], [0.036, 0.1], [0.037, 0.05], [0, 0.0]], '#e8f0f4', 0, 0, 0, 18).build(), mat: glassMat, shape: ['cyl', 0.1, 0.038], mass: 0.15, sound: 'clink', fragile: 5, kind: 'glass' },
  card: { name: 'Christmas card', geo: () => P().box(0.003, 0.18, 0.13, '#ffffff', -0.03, 0, 0, 0, 0, 0.2).box(0.003, 0.18, 0.13, '#ffffff', 0.03, 0, 0, 0, 0, -0.2).build(), mat: texMat(() => TX.photo(4)), shape: ['box', 0.04, 0.09, 0.065], mass: 0.03, linDamp: 0.8 },
  mason_cup: { name: 'The Mason Cup', geo: () => P().box(0.2, 0.06, 0.2, '#3a2216', 0, -0.2, 0).box(0.21, 0.015, 0.21, '#d4af37', 0, -0.165, 0).cyl(0.03, 0.05, 0.12, '#d4af37', 0, -0.1, 0).lathe([[0, -0.04], [0.04, -0.04], [0.11, 0.08], [0.1, 0.1], [0.03, -0.02], [0, -0.02]], '#e6c14a', 0, 0, 0, 24).torus(0.05, 0.01, '#e6c14a', -0.12, 0.03, 0, 0, 0, 0).torus(0.05, 0.01, '#e6c14a', 0.12, 0.03, 0, 0, 0, 0).torus(0.05, 0.016, '#d0d0d0', -0.12, 0.03, 0, 0, 0, 0.4).torus(0.05, 0.016, '#c0c0c0', 0.12, 0.03, 0, 0, 0, -0.4).box(0.12, 0.03, 0.002, '#e8d8a8', 0, -0.2, 0.101).build(), shape: ['cyl', 0.23, 0.11], mass: 3.5, sound: 'clink', important: true, extra: 0 },
  cup_turkey: { name: 'Plastic turkey (off the Mason Cup)', geo: () => P().sph(0.03, '#8a5a2a', 0, 0, 0, 1.2, 1, 1).sph(0.012, '#8a5a2a', 0.03, 0.02, 0).cone(0.005, 0.01, '#e8a030', 0.043, 0.02, 0, 0, 0, -Math.PI / 2, 4).box(0.005, 0.05, 0.05, '#6a3a1a', -0.03, 0.02, 0).build(), shape: ['ball', 0.035], mass: 0.02, important: true, extra: 3 },
  photo_frame: { name: 'Family photo', geo: () => P().box(0.2, 0.25, 0.02, '#3a2a1a').box(0.17, 0.22, 0.004, '#ffffff', 0, 0, 0.011).build(), mat: texMat(() => TX.photo(9)), shape: ['box', 0.1, 0.125, 0.01], mass: 0.3, fragile: 9, sound: 'clink' },
  candle: { name: 'Candle', geo: () => P().cyl(0.03, 0.03, 0.15, '#c1121f', 0, 0, 0, 0, 0, 0, 12).cyl(0.002, 0.002, 0.02, '#222', 0, 0.085, 0).build(), shape: ['cyl', 0.075, 0.03], mass: 0.2 },
  nutcracker: { name: 'Nutcracker', geo: () => P().box(0.06, 0.08, 0.04, '#1d3557', 0, -0.08, 0).box(0.07, 0.07, 0.05, '#c1121f', 0, 0, 0).sph(0.03, '#f2d0b0', 0, 0.06, 0).cyl(0.032, 0.032, 0.05, '#111', 0, 0.1, 0).box(0.07, 0.015, 0.05, '#d4af37', 0, 0.04, 0).build(), shape: ['box', 0.035, 0.13, 0.025], mass: 0.3 },
  snow_globe: { name: 'Snow globe', geo: () => P().cyl(0.05, 0.055, 0.04, '#3a2216', 0, -0.05, 0, 0, 0, 0, 16).sph(0.05, '#d8ecf4', 0, 0.02, 0, 1, 1, 1, 14).cone(0.02, 0.04, '#2d6a4f', 0, 0.01, 0).build(), shape: ['ball', 0.055], mass: 0.5, use: 'shake', sound: 'clink' },
  book: { name: 'Book', geo: () => P().box(0.15, 0.03, 0.22, '#ffffff').box(0.14, 0.025, 0.215, '#f4f0e0', 0.008, 0, 0).build(), shape: ['box', 0.075, 0.015, 0.11], mass: 0.4, tints: ['#7a2a2a', '#2a4a7a', '#3a6a3a', '#d8c08a', '#444'] },
  tv_guide: { name: 'TV guide (Christmas double issue)', geo: () => box(0.22, 0.01, 0.29, '#ffffff'), mat: texMat(() => TX.label('tvguide', 256, 340, '#c1121f', [{ text: 'TV', size: 90, bold: true, y: 70 }, { text: 'GUIDE', size: 40, y: 140 }, { text: 'XMAS', size: 50, color: '#ffd60a', y: 230 }, { text: 'DOUBLE ISSUE', size: 22, y: 300 }])), shape: ['box', 0.11, 0.005, 0.145], mass: 0.15, linDamp: 0.5 },
  phone: { name: 'Mobile phone', geo: () => P().rbox(0.075, 0.009, 0.155, 0.006, '#111111').box(0.068, 0.002, 0.145, '#1a3a5a', 0, 0.005, 0).build(), shape: ['box', 0.037, 0.0045, 0.077], mass: 0.2, use: 'phone', tints: ['#ffffff', '#ffd0e0', '#d0e0ff'] },
  tissues: { name: 'Box of tissues', geo: () => P().box(0.24, 0.1, 0.12, '#a8d8e8').box(0.06, 0.03, 0.05, '#ffffff', 0, 0.06, 0).build(), shape: ['box', 0.12, 0.05, 0.06], mass: 0.15 },
  nut_bowl: { name: 'Bowl of walnuts', geo: () => { const p = P().lathe([[0, -0.04], [0.06, -0.04], [0.1, 0.04], [0.095, 0.04], [0.055, -0.035], [0, -0.035]], '#6a4a2a', 0, 0, 0, 20); for (let i = 0; i < 9; i++) p.sph(0.02, '#a07040', Math.cos(i) * 0.05, 0.02, Math.sin(i * 1.3) * 0.05, 1, 0.9, 1, 6); return p.build(); }, shape: ['cyl', 0.04, 0.1], mass: 0.8, food: 'nuts', use: 'eat', uses: 5 },
  duplo: { name: 'Duplo brick', geo: () => P().box(0.064, 0.038, 0.032, '#ffffff').cyl(0.009, 0.009, 0.01, '#ffffff', -0.016, 0.024, 0, 0, 0, 0, 8).cyl(0.009, 0.009, 0.01, '#ffffff', 0.016, 0.024, 0, 0, 0, 0, 8).build(), shape: ['box', 0.032, 0.024, 0.016], mass: 0.02, tints: ['#d62828', '#3a86ff', '#ffd60a', '#06d6a0', '#f77f00'], toy: true, slip: true },
  toy_car: { name: 'Toy car', geo: () => P().rbox(0.1, 0.03, 0.05, 0.01, '#ffffff', 0, 0, 0).rbox(0.055, 0.025, 0.045, 0.01, '#ffffff', -0.008, 0.025, 0).cyl(0.012, 0.012, 0.055, '#111', 0.03, -0.014, 0, Math.PI / 2, 0, 0, 10).cyl(0.012, 0.012, 0.055, '#111', -0.03, -0.014, 0, Math.PI / 2, 0, 0, 10).build(), shape: ['box', 0.05, 0.028, 0.028], mass: 0.06, tints: ['#d62828', '#3a86ff', '#ffd60a', '#06d6a0'], toy: true, slip: true, friction: 0.08 },
  toy_dino: { name: 'Toy dinosaur', geo: () => P().sph(0.05, '#ffffff', 0, 0, 0, 1.4, 0.8, 0.8).sph(0.03, '#ffffff', 0.07, 0.05, 0).cone(0.025, 0.09, '#ffffff', -0.09, 0.0, 0, 0, 0, Math.PI / 2, 8).cyl(0.012, 0.012, 0.05, '#ffffff', 0.03, -0.05, 0.02).cyl(0.012, 0.012, 0.05, '#ffffff', -0.03, -0.05, 0.02).cyl(0.012, 0.012, 0.05, '#ffffff', 0.03, -0.05, -0.02).cyl(0.012, 0.012, 0.05, '#ffffff', -0.03, -0.05, -0.02).build(), shape: ['box', 0.1, 0.06, 0.04], mass: 0.15, tints: ['#2d6a4f', '#7b2cbf', '#f77f00'], toy: true, sound: 'squeak' },
  teddy: { name: 'Teddy bear', geo: () => P().sph(0.07, '#a0703a', 0, -0.03, 0, 1, 1.1, 0.9).sph(0.05, '#a0703a', 0, 0.08, 0).sph(0.018, '#a0703a', -0.04, 0.12, 0).sph(0.018, '#a0703a', 0.04, 0.12, 0).sph(0.02, '#c8a070', 0, 0.07, 0.04).sph(0.025, '#a0703a', -0.07, -0.02, 0.02).sph(0.025, '#a0703a', 0.07, -0.02, 0.02).sph(0.03, '#a0703a', -0.04, -0.1, 0.03).sph(0.03, '#a0703a', 0.04, -0.1, 0.03).torus(0.04, 0.008, '#c1121f', 0, 0.035, 0, Math.PI / 2).build(), shape: ['box', 0.07, 0.12, 0.06], mass: 0.2, toy: true, sound: 'cushion' },
  dog_toy: { name: "Chip's squeaky toy", geo: () => P().sph(0.035, '#ff6b35', 0, 0, 0, 1.6, 0.9, 0.9, 10).sph(0.02, '#ffd60a', 0.06, 0, 0).sph(0.02, '#ffd60a', -0.06, 0, 0).build(), shape: ['cap', 0.035, 0.035], mass: 0.06, sound: 'squeak', use: 'squeak', important: true, bounce: 0.5 },
  tennis_ball: { name: 'Tennis ball', geo: () => P().sph(0.033, '#d4e157', 0, 0, 0, 1, 1, 1, 12).torus(0.033, 0.002, '#ffffff', 0, 0, 0, 0.6, 0, 0).build(), shape: ['ball', 0.033], mass: 0.06, bounce: 0.75, sound: 'tap' },
  football: { name: 'Football', geo: () => { const p = P().sph(0.11, '#ffffff', 0, 0, 0, 1, 1, 1, 18); for (let i = 0; i < 12; i++) { const a = i * 2.39996, y = 1 - (i + 0.5) / 6; const r = Math.sqrt(1 - y * y); p.sph(0.03, '#111', Math.cos(a) * r * 0.1, y * 0.1, Math.sin(a) * r * 0.1, 1, 1, 1, 5); } return p.build(); }, shape: ['ball', 0.11], mass: 0.43, bounce: 0.65, sound: 'boing', kickable: true },
  paper_ball: { name: 'Screwed-up wrapping paper', geo: () => P().sph(0.06, '#ffffff', 0, 0, 0, 1, 0.85, 1.1, 6).build(), shape: ['ball', 0.06], mass: 0.02, tints: ['#c1121f', '#2d6a4f', '#d4af37', '#3a86ff', '#e0e0e0'], linDamp: 1.2, extra: 30, sound: 'rip' },
  bow: { name: 'Gift bow', geo: () => P().sph(0.03, '#ffffff', 0, 0, 0, 1.3, 0.5, 1.3, 8).torus(0.02, 0.008, '#ffffff', 0.02, 0.01, 0, Math.PI / 2).torus(0.02, 0.008, '#ffffff', -0.02, 0.01, 0, Math.PI / 2).build(), shape: ['ball', 0.03], mass: 0.01, tints: BRIGHT, linDamp: 1.0 },
  gamepad: { name: 'Games controller', geo: () => P().rbox(0.15, 0.03, 0.08, 0.02, '#222').sph(0.03, '#222', -0.055, -0.005, 0.025, 1, 0.8, 1.3).sph(0.03, '#222', 0.055, -0.005, 0.025, 1, 0.8, 1.3).cyl(0.009, 0.009, 0.01, '#555', -0.035, 0.018, -0.005).cyl(0.009, 0.009, 0.01, '#555', 0.02, 0.018, 0.01).build(), shape: ['box', 0.075, 0.02, 0.05], mass: 0.25 },
  // ===================== KITCHEN BUFFET =====================
  sausage_roll: { name: 'Sausage roll', geo: () => P().rbox(0.09, 0.035, 0.045, 0.015, '#d8a050').box(0.092, 0.012, 0.03, '#a86a3a', 0, 0.01, 0).build(), shape: ['box', 0.045, 0.018, 0.023], mass: 0.05, food: 'sausageRoll', use: 'eat', sound: 'crunch' },
  pig_blanket: { name: 'Pig in blanket', geo: () => P().cyl(0.012, 0.012, 0.06, '#9a4a2a', 0, 0, 0, 0, 0, Math.PI / 2, 8).cyl(0.014, 0.014, 0.035, '#c06a5a', 0, 0, 0, 0, 0, Math.PI / 2, 8).build(), shape: ['cap', 0.025, 0.013], mass: 0.02, food: 'pig', use: 'eat' },
  pig_tray: { name: 'Pigs-in-blankets tray', geo: () => P().box(0.36, 0.02, 0.26, '#c0c0c0').box(0.36, 0.03, 0.01, '#aaa', 0, 0.015, 0.13).box(0.36, 0.03, 0.01, '#aaa', 0, 0.015, -0.13).box(0.01, 0.03, 0.26, '#aaa', 0.18, 0.015, 0).box(0.01, 0.03, 0.26, '#aaa', -0.18, 0.015, 0).build(), shape: ['box', 0.18, 0.012, 0.13], mass: 0.4, sound: 'clink' },
  turkey: { name: 'Cold turkey', geo: () => P().sph(0.13, '#c8854a', 0, 0, 0, 1.2, 0.75, 1).sph(0.04, '#b87a40', 0.15, -0.02, 0.06, 1.6, 0.7, 0.7).sph(0.04, '#b87a40', 0.15, -0.02, -0.06, 1.6, 0.7, 0.7).cyl(0.01, 0.01, 0.04, '#f4e8d8', 0.22, -0.02, 0.06, 0, 0, Math.PI / 2).cyl(0.01, 0.01, 0.04, '#f4e8d8', 0.22, -0.02, -0.06, 0, 0, Math.PI / 2).build(), shape: ['box', 0.16, 0.1, 0.13], mass: 3, food: 'turkey', use: 'eat', uses: 8, sound: 'splat' },
  platter: { name: 'Turkey & ham platter', geo: () => { const p = P().cyl(0.25, 0.22, 0.02, '#f4f4f4', 0, 0, 0, 0, 0, 0, 28); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; p.box(0.08, 0.008, 0.06, i % 2 ? '#e8b0a0' : '#f2e2cc', Math.cos(a) * 0.15, 0.015, Math.sin(a) * 0.15, 0, -a, 0.1); } return p.build(); }, shape: ['cyl', 0.012, 0.25], mass: 1.2, sound: 'clink', food: 'ham', use: 'eat', uses: 10 },
  cheeseboard: { name: 'Cheeseboard', geo: () => P().box(0.42, 0.025, 0.28, '#8a6a3a').box(0.12, 0.05, 0.07, '#f2c84a', -0.1, 0.035, 0.05).box(0.1, 0.04, 0.08, '#e8e0c8', 0.08, 0.03, -0.05).cyl(0.04, 0.04, 0.03, '#fff2d0', 0.1, 0.03, 0.07).sph(0.02, '#5a2a6a', -0.15, 0.03, -0.07).sph(0.02, '#5a2a6a', -0.12, 0.03, -0.09).build(), shape: ['box', 0.21, 0.025, 0.14], mass: 1.5, food: 'cheese', use: 'eat', uses: 8 },
  brie: { name: 'Whole Brie', geo: () => P().cyl(0.09, 0.09, 0.035, '#f4ecd8', 0, 0, 0, 0, 0, 0, 24).cyl(0.085, 0.085, 0.036, '#fff6dc', 0, 0, 0, 0, 0, 0, 24).build(), shape: ['cyl', 0.018, 0.09], mass: 0.5, sticky: true, splat: false, food: 'brie', use: 'eat', uses: 4, sound: 'splat' },
  cracker_bis: { name: 'Cracker (biscuit)', geo: () => P().box(0.06, 0.006, 0.06, '#e8c890').build(), shape: ['box', 0.03, 0.003, 0.03], mass: 0.008, food: 'cracker', use: 'eat', sound: 'crunch' },
  coleslaw: { name: 'Bowl of coleslaw', geo: () => bowl(0.09, 0.07, '#f4f4f4', '#f0ecd0'), shape: ['cyl', 0.035, 0.09], mass: 0.6, splat: true, food: 'coleslaw', use: 'eat', uses: 6 },
  potato_salad: { name: 'Potato salad', geo: () => bowl(0.09, 0.07, '#d8e8f0', '#f4ecc0'), shape: ['cyl', 0.035, 0.09], mass: 0.6, splat: true, food: 'potato', use: 'eat', uses: 6 },
  scotch_egg: { name: 'Scotch egg', geo: () => P().sph(0.035, '#a8642a', 0, 0, 0, 1, 1.15, 1, 12).build(), shape: ['ball', 0.037], mass: 0.08, food: 'scotchEgg', use: 'eat', bounce: 0.3, friction: 0.3, linDamp: 0.02, angDamp: 0.05 },
  pork_pie: { name: 'Pork pie', geo: () => P().cyl(0.07, 0.075, 0.07, '#c88a40', 0, 0, 0, 0, 0, 0, 20).torus(0.065, 0.008, '#b07a30', 0, 0.035, 0, Math.PI / 2).build(), shape: ['cyl', 0.035, 0.075], mass: 0.4, food: 'porkPie', use: 'eat', uses: 3 },
  crisps_bowl: { name: 'Bowl of crisps', geo: () => { const p = P().lathe([[0, -0.04], [0.07, -0.04], [0.12, 0.04], [0.115, 0.04], [0.065, -0.035], [0, -0.035]], '#2a6aa8', 0, 0, 0, 20); for (let i = 0; i < 14; i++) p.box(0.03, 0.003, 0.025, '#f0c860', Math.cos(i * 2.1) * 0.06, 0.02 + (i % 3) * 0.006, Math.sin(i * 1.7) * 0.06, i, i * 0.5, 0); return p.build(); }, shape: ['cyl', 0.04, 0.12], mass: 0.5, food: 'crisps', use: 'eat', uses: 6, sound: 'crunch' },
  crisps_packet: { name: 'Packet of crisps', geo: () => P().rbox(0.13, 0.18, 0.04, 0.015, '#ffffff').box(0.1, 0.05, 0.042, '#f0c860', 0, -0.02, 0).build(), shape: ['box', 0.065, 0.09, 0.02], mass: 0.05, tints: ['#c1121f', '#3a86ff', '#2d6a4f', '#ffd60a'], food: 'crisps', use: 'eat', uses: 3, sound: 'rip' },
  trifle: { name: "Julie's trifle", geo: () => P().lathe([[0, -0.08], [0.1, -0.08], [0.14, 0.08], [0.135, 0.08], [0.095, -0.075], [0, -0.075]], '#e8f2f8', 0, 0, 0, 24).cyl(0.13, 0.1, 0.05, '#c1121f', 0, -0.045, 0, 0, 0, 0, 20).cyl(0.135, 0.13, 0.04, '#f4d36a', 0, 0.0, 0, 0, 0, 0, 20).cyl(0.138, 0.135, 0.04, '#fff8ec', 0, 0.045, 0, 0, 0, 0, 20).sph(0.012, '#c1121f', 0.05, 0.07, 0).sph(0.012, '#c1121f', -0.04, 0.07, 0.04).build(), shape: ['cyl', 0.08, 0.14], mass: 2, splat: true, food: 'trifle', use: 'eat', uses: 8, important: true, sound: 'splat' },
  pudding: { name: 'Christmas pudding', geo: () => P().sph(0.09, '#3a1e12', 0, 0, 0, 1, 0.85, 1, 16).sph(0.06, '#fff8e8', 0, 0.05, 0, 1.3, 0.4, 1.3, 10).sph(0.012, '#1d6a2f', 0.01, 0.085, 0, 1.6, 0.5, 0.8).sph(0.008, '#c1121f', -0.01, 0.09, 0.01).build(), shape: ['ball', 0.08], mass: 0.9, food: 'pudding', use: 'pudding', uses: 6, splat: true },
  cream_jug: { name: 'Jug of cream', geo: () => P().lathe([[0, -0.06], [0.04, -0.06], [0.045, 0.04], [0.052, 0.06], [0.048, 0.06], [0, 0.04]], '#f4f4f4', 0, 0, 0, 16).torus(0.025, 0.006, '#f4f4f4', -0.05, 0.0, 0, 0, 0, 0).build(), shape: ['cyl', 0.06, 0.048], mass: 0.4, use: 'pour', fragile: 7 },
  mince_pie: { name: 'Mince pie', geo: () => P().cyl(0.035, 0.03, 0.02, '#d8a050', 0, 0, 0, 0, 0, 0, 14).cone(0.012, 0.004, '#f4f0e8', 0, 0.012, 0, 0, 0, 0, 5).build(), shape: ['cyl', 0.012, 0.035], mass: 0.05, food: 'mincePie', use: 'eat', sound: 'crunch' },
  yorkshire: { name: 'Yorkshire pudding', geo: () => P().lathe([[0, -0.015], [0.04, -0.015], [0.05, 0.025], [0.042, 0.025], [0.03, -0.005], [0, -0.005]], '#d8a050', 0, 0, 0, 12).build(), shape: ['cyl', 0.02, 0.05], mass: 0.03, food: 'yorkshire', use: 'eat' },
  sprout: { name: 'Sprout', geo: () => P().sph(0.016, '#4a8a2a', 0, 0, 0, 1, 1.05, 1, 8).sph(0.012, '#6aaa3a', 0.006, 0.004, 0.006, 1, 1, 1, 6).build(), shape: ['ball', 0.016], mass: 0.012, food: 'sprout', use: 'eat', bounce: 0.35, sound: 'splat', extra: 30 },
  paper_plate: { name: 'Paper plate', geo: () => P().cyl(0.11, 0.09, 0.012, '#ffffff', 0, 0, 0, 0, 0, 0, 20).torus(0.1, 0.006, '#f4f4f4', 0, 0.006, 0, Math.PI / 2).build(), shape: ['cyl', 0.006, 0.11], mass: 0.015, plate: true, linDamp: 0.6, sound: 'tap', tints: ['#ffffff', '#ffe8e8', '#e8ffe8'] },
  napkins: { name: 'Pile of napkins', geo: () => box(0.16, 0.03, 0.16, '#c1121f'), shape: ['box', 0.08, 0.015, 0.08], mass: 0.1 },
  tongs: { name: 'Tongs', geo: () => P().box(0.22, 0.008, 0.015, '#c0c0c0', 0, 0, 0.012).box(0.22, 0.008, 0.015, '#c0c0c0', 0, 0, -0.012).build(), shape: ['box', 0.11, 0.004, 0.02], mass: 0.08, sound: 'clink' },
  serving_spoon: { name: 'Serving spoon', geo: () => P().box(0.2, 0.006, 0.018, '#c0c0c0', 0.05, 0, 0).sph(0.03, '#c0c0c0', -0.07, 0, 0, 1.3, 0.3, 1).build(), shape: ['box', 0.12, 0.008, 0.03], mass: 0.06, sound: 'clink' },
  // ===================== DRINKS =====================
  lager: { name: 'Can of lager', geo: () => can('#d4a017', '#1d3557'), shape: ['cyl', 0.06, 0.033], mass: 0.38, drink: 'lager', use: 'drink', uses: 5, sound: 'clink', extra: 6 },
  cider: { name: 'Can of cider', geo: () => can('#2d6a4f', '#ffd60a'), shape: ['cyl', 0.06, 0.033], mass: 0.38, drink: 'cider', use: 'drink', uses: 5, sound: 'clink' },
  bitter: { name: 'Bottle of bitter', geo: () => bottle('#4a2a10', '#d8c080', '#d4af37', 0.25, 0.032), shape: ['cyl', 0.125, 0.032], mass: 0.55, drink: 'bitter', use: 'drink', uses: 5, sound: 'clink', fragile: 8 },
  prosecco: { name: 'Prosecco', geo: () => bottle('#1f4a2a', '#f4ecd8', '#d4af37', 0.32, 0.04), shape: ['cyl', 0.16, 0.04], mass: 1.4, drink: 'prosecco', use: 'drink', uses: 6, sound: 'clink', fragile: 9, cork: true },
  red_wine: { name: 'Red wine', geo: () => bottle('#2a0a12', '#f4ecd8', '#6a0a1a', 0.32, 0.038), shape: ['cyl', 0.16, 0.038], mass: 1.3, drink: 'wine', use: 'drink', uses: 6, sound: 'clink', fragile: 9, spill: true },
  white_wine: { name: 'White wine', geo: () => bottle('#c8d890', '#f4ecd8', '#d4af37', 0.32, 0.038), shape: ['cyl', 0.16, 0.038], mass: 1.3, drink: 'wine', use: 'drink', uses: 6, sound: 'clink', fragile: 9 },
  baileys: { name: 'Baileys', geo: () => P().lathe([[0, -0.13], [0.045, -0.13], [0.045, 0.05], [0.02, 0.11], [0.018, 0.13], [0, 0.13]], '#3a2a1e', 0, 0, 0, 16).cyl(0.046, 0.046, 0.1, '#f4ecd8', 0, -0.04, 0).cyl(0.019, 0.019, 0.03, '#d4af37', 0, 0.13, 0).build(), shape: ['cyl', 0.13, 0.045], mass: 1.2, drink: 'baileys', use: 'drink', uses: 6, fragile: 9 },
  brandy: { name: 'Brandy', geo: () => bottle('#7a3a10', '#f4ecd8', '#222', 0.28, 0.042), shape: ['cyl', 0.14, 0.042], mass: 1.1, drink: 'brandy', use: 'drink', uses: 4, fragile: 9 },
  squash: { name: 'Orange squash', geo: () => bottle('#f77f00', '#ffffff', '#f77f00', 0.28, 0.045), shape: ['cyl', 0.14, 0.045], mass: 1.0, drink: 'squash', use: 'drink', uses: 8 },
  juice: { name: 'Juice carton', geo: () => P().box(0.07, 0.18, 0.07, '#ffd60a').box(0.072, 0.07, 0.072, '#f77f00', 0, -0.02, 0).box(0.07, 0.02, 0.05, '#ffffff', 0, 0.1, 0, 0.6).build(), shape: ['box', 0.035, 0.1, 0.035], mass: 0.6, drink: 'juice', use: 'drink', uses: 6 },
  milk: { name: 'Milk', geo: () => P().rbox(0.1, 0.22, 0.1, 0.02, '#f4f8f8').cyl(0.018, 0.018, 0.03, '#1d6a2f', 0.02, 0.12, 0).box(0.02, 0.06, 0.06, '#f4f8f8', -0.06, 0.03, 0).build(), shape: ['box', 0.05, 0.11, 0.05], mass: 1.1, drink: 'milk', use: 'drink', uses: 6 },
  cream_can: { name: 'Squirty cream', geo: () => P().cyl(0.03, 0.03, 0.17, '#ffffff', 0, 0, 0).cone(0.012, 0.04, '#e8e8e8', 0, 0.105, 0).build(), shape: ['cyl', 0.1, 0.03], mass: 0.3 },
  pint_glass: { name: 'Pint glass', geo: () => P().lathe([[0, -0.08], [0.036, -0.08], [0.045, 0.08], [0.043, 0.08], [0.034, -0.075], [0, -0.075]], '#e8f0f4', 0, 0, 0, 18).build(), mat: glassMat, shape: ['cyl', 0.08, 0.045], mass: 0.4, fragile: 6, sound: 'clink', kind: 'glass' },
  tumbler: { name: 'Tumbler', geo: () => P().lathe([[0, -0.045], [0.04, -0.045], [0.042, 0.045], [0.039, 0.045], [0.037, -0.04], [0, -0.04]], '#e8f0f4', 0, 0, 0, 16).build(), mat: glassMat, shape: ['cyl', 0.045, 0.042], mass: 0.25, fragile: 6, sound: 'clink', kind: 'glass' },
  mug: { name: 'Mug', geo: () => P().cyl(0.042, 0.04, 0.1, '#ffffff', 0, 0, 0, 0, 0, 0, 16).torus(0.03, 0.008, '#ffffff', 0.05, 0, 0, 0, 0, 0).build(), shape: ['cyl', 0.05, 0.045], mass: 0.3, tints: ['#ffffff', '#c1121f', '#1d3557', '#2d6a4f', '#ffd60a'], fragile: 7, sound: 'clink' },
  beer_crate: { name: 'Crate of beer', geo: () => P().box(0.4, 0.04, 0.27, '#2a2a2a', 0, -0.11, 0).box(0.4, 0.24, 0.02, '#c1121f', 0, 0, 0.125).box(0.4, 0.24, 0.02, '#c1121f', 0, 0, -0.125).box(0.02, 0.24, 0.27, '#c1121f', 0.19, 0, 0).box(0.02, 0.24, 0.27, '#c1121f', -0.19, 0, 0).box(0.3, 0.06, 0.02, '#ffffff', 0, 0.02, 0.137).build(), shape: ['box', 0.2, 0.12, 0.135], mass: 2.5, sound: 'thud', crate: true },
  // ===================== KITCHEN GEAR =====================
  kettle: { name: 'Kettle', geo: () => P().lathe([[0, -0.1], [0.08, -0.1], [0.085, 0.0], [0.065, 0.09], [0, 0.1]], '#c0c4c8', 0, 0, 0, 20).torus(0.06, 0.012, '#222', -0.03, 0.08, 0, 0, Math.PI / 2, 0, Math.PI).cone(0.015, 0.06, '#c0c4c8', 0.09, 0.02, 0, 0, 0, -1.0).build(), shape: ['cyl', 0.1, 0.085], mass: 1.2, use: 'kettle', sound: 'clink' },
  toaster: { name: 'Toaster', geo: () => P().rbox(0.28, 0.18, 0.15, 0.03, '#c1121f').box(0.2, 0.01, 0.03, '#111', 0, 0.09, 0.03).box(0.2, 0.01, 0.03, '#111', 0, 0.09, -0.03).build(), shape: ['box', 0.14, 0.09, 0.075], mass: 1.5, sound: 'clink', fixed: true },
  microwave: { name: 'Microwave', geo: () => P().rbox(0.48, 0.28, 0.36, 0.02, '#e8e8e8').box(0.3, 0.2, 0.01, '#222', -0.05, 0, 0.18).box(0.09, 0.2, 0.01, '#bbb', 0.18, 0, 0.18).build(), shape: ['box', 0.24, 0.14, 0.18], mass: 12, sound: 'thud', fixed: true },
  tea_towel: { name: 'Tea towel', geo: () => P().box(0.3, 0.01, 0.45, '#f4f4f4').box(0.3, 0.011, 0.04, '#c1121f', 0, 0, 0.15).box(0.3, 0.011, 0.04, '#c1121f', 0, 0, -0.15).build(), shape: ['box', 0.15, 0.005, 0.22], mass: 0.08, linDamp: 1.5, angDamp: 2, use: 'wave' },
  kitchen_roll: { name: 'Kitchen roll', geo: () => P().cyl(0.055, 0.055, 0.24, '#fafafa', 0, 0, 0, 0, 0, 0, 16).cyl(0.02, 0.02, 0.245, '#c8a070').build(), shape: ['cyl', 0.12, 0.055], mass: 0.2, use: 'clean', important: true },
  oven_glove: { name: 'Oven glove', geo: () => P().rbox(0.12, 0.03, 0.25, 0.012, '#c1121f').rbox(0.04, 0.025, 0.08, 0.01, '#c1121f', 0.07, 0, 0.03, 0, 0.5).build(), shape: ['box', 0.07, 0.015, 0.125], mass: 0.1 },
  frying_pan: { name: 'Frying pan', geo: () => P().cyl(0.13, 0.11, 0.04, '#222', 0, 0, 0, 0, 0, 0, 20).cyl(0.012, 0.012, 0.2, '#333', 0.22, 0.01, 0, 0, 0, Math.PI / 2).build(), shape: ['cyl', 0.02, 0.13], mass: 1.4, sound: 'clink' },
  saucepan: { name: 'Saucepan', geo: () => P().lathe([[0, -0.06], [0.09, -0.06], [0.09, 0.06], [0.085, 0.06], [0.085, -0.055], [0, -0.055]], '#c0c4c8', 0, 0, 0, 18).cyl(0.012, 0.012, 0.16, '#222', 0.17, 0.04, 0, 0, 0, Math.PI / 2).build(), shape: ['cyl', 0.06, 0.09], mass: 1.0, sound: 'clink' },
  roasting_tin: { name: 'Roasting tin', geo: () => P().box(0.36, 0.015, 0.26, '#888').box(0.36, 0.06, 0.01, '#888', 0, 0.03, 0.13).box(0.36, 0.06, 0.01, '#888', 0, 0.03, -0.13).box(0.01, 0.06, 0.26, '#888', 0.18, 0.03, 0).box(0.01, 0.06, 0.26, '#888', -0.18, 0.03, 0).build(), shape: ['box', 0.18, 0.02, 0.13], mass: 0.8, sound: 'clink' },
  wooden_spoon: { name: 'Wooden spoon', geo: () => P().box(0.25, 0.012, 0.015, '#c8a070', 0.03, 0, 0).sph(0.025, '#c8a070', -0.11, 0, 0, 1.4, 0.4, 1).build(), shape: ['box', 0.14, 0.01, 0.025], mass: 0.05 },
  rolling_pin: { name: 'Rolling pin', geo: () => P().cyl(0.03, 0.03, 0.3, '#d8b080', 0, 0, 0, 0, 0, Math.PI / 2).cyl(0.012, 0.012, 0.42, '#c8a070', 0, 0, 0, 0, 0, Math.PI / 2).build(), shape: ['cap', 0.18, 0.03], mass: 0.6 },
  whisk: { name: 'Whisk', geo: () => P().cyl(0.012, 0.012, 0.12, '#c0c0c0', 0.08, 0, 0, 0, 0, Math.PI / 2).sph(0.035, '#d0d0d0', -0.03, 0, 0, 1.6, 0.9, 0.9, 6).build(), shape: ['cap', 0.08, 0.03], mass: 0.1, sound: 'clink' },
  chopping_board: { name: 'Chopping board', geo: () => box(0.4, 0.02, 0.28, '#c8a070'), shape: ['box', 0.2, 0.01, 0.14], mass: 0.8 },
  fruit_bowl: { name: 'Fruit bowl', geo: () => bowl(0.14, 0.07, '#5a3a22'), shape: ['cyl', 0.035, 0.14], mass: 0.7, fixed: true },
  satsuma: { name: 'Satsuma', geo: () => P().sph(0.03, '#f77f00', 0, 0, 0, 1, 0.85, 1, 12).sph(0.006, '#2d6a4f', 0, 0.026, 0).build(), shape: ['ball', 0.03], mass: 0.08, food: 'satsuma', use: 'eat', bounce: 0.3 },
  apple: { name: 'Apple', geo: () => P().sph(0.037, '#b22222', 0, 0, 0, 1, 0.95, 1, 12).cyl(0.003, 0.003, 0.02, '#4a3020', 0, 0.04, 0).build(), shape: ['ball', 0.037], mass: 0.15, food: 'apple', use: 'eat', bounce: 0.25 },
  banana: { name: 'Banana', geo: () => P().torus(0.08, 0.018, '#ffd60a', 0, 0, 0, Math.PI / 2, 0, 0, 1.6).build(), shape: ['cap', 0.06, 0.02], mass: 0.12, food: 'banana', use: 'eat' },
  cereal: { name: 'Cereal box', geo: () => box(0.2, 0.3, 0.07, '#ffffff'), mat: texMat(() => TX.label('cereal', 256, 384, '#e8a020', [{ text: 'CRUNCHY', size: 40, bold: true, color: '#c1121f', y: 70 }, { text: 'FLAKES', size: 56, bold: true, color: '#fff', y: 140 }, { text: '🥣', size: 90, y: 260 }])), shape: ['box', 0.1, 0.15, 0.035], mass: 0.5 },
  tea_caddy: { name: 'Tea caddy', geo: () => P().cyl(0.06, 0.06, 0.14, '#1d3557', 0, 0, 0, 0, 0, 0, 16).cyl(0.062, 0.062, 0.03, '#d4af37', 0, 0.06, 0).build(), shape: ['cyl', 0.07, 0.062], mass: 0.4, sound: 'clink' },
  coffee_jar: { name: 'Coffee jar', geo: () => P().cyl(0.05, 0.05, 0.14, '#3a2216', 0, 0, 0).cyl(0.051, 0.051, 0.04, '#c1121f', 0, 0.06, 0).build(), shape: ['cyl', 0.07, 0.051], mass: 0.4, fragile: 9 },
  biscuit_tin: { name: 'Biscuit tin', geo: () => P().cyl(0.12, 0.12, 0.09, '#1d3557', 0, 0, 0, 0, 0, 0, 24).cyl(0.122, 0.122, 0.02, '#c1121f', 0, 0.035, 0, 0, 0, 0, 24).build(), shape: ['cyl', 0.045, 0.122], mass: 0.7, food: 'biscuit', use: 'eat', uses: 6, sound: 'clink' },
  salt: { name: 'Salt', geo: () => P().cyl(0.02, 0.022, 0.09, '#ffffff', 0, 0, 0).sph(0.02, '#c0c0c0', 0, 0.045, 0, 1, 0.5, 1).build(), shape: ['cyl', 0.045, 0.022], mass: 0.1 },
  pepper: { name: 'Pepper', geo: () => P().cyl(0.02, 0.022, 0.09, '#222', 0, 0, 0).sph(0.02, '#c0c0c0', 0, 0.045, 0, 1, 0.5, 1).build(), shape: ['cyl', 0.045, 0.022], mass: 0.1 },
  ketchup: { name: 'Ketchup', geo: () => P().rbox(0.07, 0.18, 0.05, 0.02, '#c1121f').cyl(0.018, 0.018, 0.03, '#ffffff', 0, -0.1, 0).build(), shape: ['box', 0.035, 0.1, 0.025], mass: 0.5, splat: true },
  spray: { name: 'Kitchen spray', geo: () => P().cyl(0.035, 0.035, 0.18, '#ffffff', 0, 0, 0).box(0.03, 0.05, 0.06, '#3a86ff', 0, 0.11, 0.01).build(), shape: ['cyl', 0.11, 0.035], mass: 0.5, use: 'clean' },
  foil: { name: 'Leftovers in foil', geo: () => P().rbox(0.2, 0.06, 0.14, 0.03, '#d8d8d8').build(), shape: ['box', 0.1, 0.03, 0.07], mass: 0.4, food: 'leftovers', use: 'eat', uses: 3, sound: 'rip' },
  bin: { name: 'Kitchen bin', geo: () => P().cyl(0.17, 0.15, 0.6, '#c0c4c8', 0, 0, 0, 0, 0, 0, 20).cyl(0.175, 0.175, 0.04, '#a0a4a8', 0, 0.3, 0, 0, 0, 0, 20).build(), shape: ['cyl', 0.32, 0.175], mass: 4, sound: 'clink', fixed: true },
  stool: { name: 'Bar stool', geo: () => P().cyl(0.18, 0.18, 0.05, '#2a2a2a', 0, 0.33, 0, 0, 0, 0, 18).cyl(0.025, 0.025, 0.6, '#c0c0c0', 0, 0, 0).cyl(0.2, 0.2, 0.02, '#c0c0c0', 0, -0.34, 0).torus(0.14, 0.01, '#c0c0c0', 0, -0.05, 0, Math.PI / 2).build(), shape: ['cyl', 0.355, 0.19], mass: 6, sound: 'thud', fixed: true },
  // ===================== BABY / KIDS =====================
  sippy_cup: { name: 'Sippy cup', geo: () => P().cyl(0.035, 0.03, 0.1, '#06d6a0', 0, 0, 0).cone(0.03, 0.04, '#ffffff', 0, 0.07, 0).cyl(0.01, 0.01, 0.06, '#ffd60a', 0.04, 0, 0, 0, 0, Math.PI / 2).build(), shape: ['cyl', 0.06, 0.035], mass: 0.2, splat: false, bounce: 0.4, toy: true },
  rusk: { name: 'Rusk', geo: () => box(0.07, 0.012, 0.03, '#d8b070'), shape: ['box', 0.035, 0.006, 0.015], mass: 0.01, food: 'rusk', use: 'eat' },
  dummy: { name: 'Dummy', geo: () => P().cyl(0.025, 0.025, 0.008, '#3a86ff', 0, 0, 0, Math.PI / 2).sph(0.01, '#f4e8c8', 0, 0, 0.015, 1, 1, 1.4).torus(0.012, 0.003, '#3a86ff', 0, 0, -0.012).build(), shape: ['ball', 0.022], mass: 0.01, toy: true },
  baby_bottle: { name: 'Baby bottle', geo: () => P().cyl(0.03, 0.03, 0.12, '#f4f8f8', 0, 0, 0).cone(0.012, 0.04, '#e8c890', 0, 0.08, 0).cyl(0.032, 0.032, 0.02, '#ff006e', 0, 0.06, 0).build(), shape: ['cyl', 0.08, 0.032], mass: 0.2, drink: 'milk', use: 'drink' },
  squeaky_toy: { name: 'Squeaky giraffe', geo: () => P().cyl(0.015, 0.025, 0.14, '#ffd60a', 0, 0, 0).sph(0.025, '#ffd60a', 0, 0.08, 0.015).sph(0.006, '#5a3a22', 0.01, 0.0, 0.025).build(), shape: ['cap', 0.06, 0.025], mass: 0.05, sound: 'squeak', toy: true, use: 'squeak' },
  // ===================== HALL / TOILET =====================
  shoe: { name: 'Shoe', geo: () => P().rbox(0.1, 0.07, 0.27, 0.03, '#ffffff', 0, 0, 0).box(0.105, 0.015, 0.275, '#222', 0, -0.035, 0).rbox(0.07, 0.05, 0.08, 0.02, '#ffffff', 0, 0.03, -0.08).build(), shape: ['box', 0.05, 0.04, 0.135], mass: 0.4, tints: ['#222222', '#5a3a22', '#ffffff', '#8a1a2a', '#1d3557', '#aaaaaa'], sound: 'thud', slip: true },
  slipper: { name: 'Slipper', geo: () => P().rbox(0.1, 0.05, 0.26, 0.025, '#ffffff').build(), shape: ['box', 0.05, 0.025, 0.13], mass: 0.15, tints: ['#c1121f', '#7a5a8a', '#3a5a3a'], sound: 'cushion' },
  no_shoes_sign: { name: '"No shoes" sign', geo: () => box(0.3, 0.2, 0.01, '#ffffff'), mat: texMat(() => TX.label('noshoes', 300, 200, '#f4ecd8', [{ text: 'NO SHOES', size: 52, bold: true, color: '#7a1f24', y: 70 }, { text: 'on the oak please x', size: 26, color: '#333', y: 130 }, { text: '- Julie', size: 22, color: '#666', y: 170 }], { border: '#7a1f24' })), shape: ['box', 0.15, 0.1, 0.005], mass: 0.2 },
  umbrella: { name: 'Umbrella', geo: () => P().cyl(0.04, 0.02, 0.8, '#1d3557', 0, 0, 0, 0, 0, 0, 10).torus(0.04, 0.008, '#3a2216', 0.04, -0.42, 0, 0, 0, 0, Math.PI).build(), shape: ['cap', 0.38, 0.04], mass: 0.5 },
  keys: { name: 'Car keys', geo: () => P().torus(0.015, 0.003, '#c0c0c0', 0, 0, 0, Math.PI / 2).box(0.06, 0.004, 0.02, '#c0c0c0', 0.04, 0, 0).rbox(0.03, 0.012, 0.05, 0.005, '#222', -0.03, 0, 0).build(), shape: ['box', 0.05, 0.006, 0.025], mass: 0.05, sound: 'clink' },
  handbag: { name: "Karen's bag", geo: () => P().rbox(0.32, 0.22, 0.12, 0.04, '#5a2a3a').torus(0.1, 0.008, '#3a1a2a', 0, 0.12, 0, 0, 0, 0, Math.PI).build(), shape: ['box', 0.16, 0.11, 0.06], mass: 1.0, sound: 'cushion' },
  toilet_roll: { name: 'Toilet roll', geo: () => P().cyl(0.055, 0.055, 0.1, '#fafafa', 0, 0, 0, 0, 0, 0, 16).cyl(0.02, 0.02, 0.102, '#c8a070').build(), shape: ['cyl', 0.05, 0.055], mass: 0.1, bounce: 0.3 },
  air_freshener: { name: 'Air freshener', geo: () => P().cyl(0.03, 0.03, 0.18, '#8a5ad8', 0, 0, 0).cyl(0.025, 0.03, 0.03, '#ffffff', 0, 0.1, 0).build(), shape: ['cyl', 0.1, 0.03], mass: 0.3, use: 'spray' },
  rubber_duck: { name: 'Rubber duck', geo: () => P().sph(0.04, '#ffd60a', 0, 0, 0, 1.2, 0.8, 1).sph(0.025, '#ffd60a', 0.03, 0.04, 0).cone(0.01, 0.02, '#f77f00', 0.06, 0.04, 0, 0, 0, -Math.PI / 2, 6).build(), shape: ['ball', 0.045], mass: 0.05, sound: 'squeak', use: 'squeak' },
  soap: { name: 'Hand soap', geo: () => P().cyl(0.03, 0.035, 0.12, '#a8d8b8', 0, 0, 0).box(0.012, 0.04, 0.012, '#ffffff', 0, 0.08, 0).box(0.04, 0.008, 0.012, '#ffffff', 0.015, 0.1, 0).build(), shape: ['cyl', 0.07, 0.035], mass: 0.3 },
  // ===================== UNDER STAIRS / GARAGE =====================
  hoover: { name: 'Hoover', geo: () => P().rbox(0.3, 0.35, 0.3, 0.06, '#ff006e', 0, -0.25, 0).cyl(0.02, 0.02, 0.7, '#888', 0, 0.25, 0.1, 0.15).box(0.2, 0.04, 0.04, '#222', 0, 0.6, 0.15).build(), shape: ['box', 0.15, 0.42, 0.15], mass: 7, use: 'hoover', sound: 'thud', fixed: true },
  deco_box: { name: 'Christmas decorations box', geo: () => P().box(0.45, 0.3, 0.35, '#c8a070').box(0.46, 0.04, 0.36, '#b89060', 0, 0.13, 0).build(), shape: ['box', 0.225, 0.15, 0.175], mass: 2.5, sound: 'thud', use: 'box', fixed: true },
  folding_chair: { name: 'Spare folding chair', geo: () => P().box(0.42, 0.03, 0.4, '#555', 0, 0, 0).box(0.42, 0.35, 0.03, '#555', 0, 0.2, -0.2).box(0.03, 0.45, 0.03, '#888', -0.19, -0.22, 0.18).box(0.03, 0.45, 0.03, '#888', 0.19, -0.22, 0.18).box(0.03, 0.45, 0.03, '#888', -0.19, -0.22, -0.18).box(0.03, 0.45, 0.03, '#888', 0.19, -0.22, -0.18).build(), shape: ['box', 0.21, 0.22, 0.2], mass: 4, sound: 'thud' },
  outfit_box: { name: "Gary's outfit box", geo: () => box(0.6, 0.35, 0.4, '#ffffff'), mat: texMat(() => TX.label('outfit', 300, 200, '#7a1f24', [{ text: "GARY'S", size: 44, bold: true, color: '#ffd60a', y: 70 }, { text: 'OUTFITS', size: 48, bold: true, y: 130 }, { text: 'DO NOT OPEN', size: 22, color: '#fff', y: 180 }])), shape: ['box', 0.3, 0.175, 0.2], mass: 3, sound: 'thud', fixed: true },
  paint_tin: { name: 'Paint tin', geo: () => P().cyl(0.09, 0.09, 0.15, '#c0c0c0', 0, 0, 0).cyl(0.091, 0.091, 0.08, '#ffffff', 0, 0, 0).torus(0.08, 0.004, '#888', 0, 0.075, 0, Math.PI / 2).build(), shape: ['cyl', 0.075, 0.091], mass: 2.5, tints: ['#f4f0e8', '#9fb0a0', '#d9d0c1'], sound: 'clink', fixed: true },
  toolbox: { name: 'Toolbox', geo: () => P().rbox(0.45, 0.2, 0.22, 0.02, '#c1121f').box(0.2, 0.03, 0.03, '#222', 0, 0.13, 0).build(), shape: ['box', 0.225, 0.1, 0.11], mass: 5, sound: 'clink', fixed: true },
  traffic_cone: { name: 'Traffic cone (from a night out in 2009)', geo: () => P().box(0.32, 0.03, 0.32, '#f77f00', 0, -0.3, 0).cone(0.13, 0.6, '#f77f00', 0, 0.0, 0).cyl(0.075, 0.095, 0.1, '#ffffff', 0, 0.05, 0).build(), shape: ['cyl', 0.31, 0.15], mass: 1.5, use: 'cone', fixed: true },
  mop_bucket: { name: 'Mop bucket', geo: () => P().cyl(0.15, 0.12, 0.28, '#3a86ff', 0, 0, 0, 0, 0, 0, 16).torus(0.13, 0.006, '#888', 0, 0.16, 0, 0, 0, 0, Math.PI).build(), shape: ['cyl', 0.14, 0.15], mass: 1.2, fixed: true },
  mop: { name: 'Mop', geo: () => P().cyl(0.012, 0.012, 1.2, '#c8a070', 0, 0.05, 0).sph(0.08, '#e8e8e8', 0, -0.6, 0, 1, 0.6, 1, 8).build(), shape: ['cap', 0.6, 0.04], mass: 0.8, use: 'clean' },
  cool_box: { name: 'Cool box', geo: () => P().rbox(0.45, 0.3, 0.3, 0.03, '#ffffff').box(0.46, 0.06, 0.31, '#3a86ff', 0, 0.13, 0).build(), shape: ['box', 0.225, 0.15, 0.15], mass: 3, fixed: true },
  sledge: { name: 'Sledge', geo: () => P().box(0.4, 0.03, 0.9, '#c1121f').box(0.03, 0.08, 0.9, '#c0c0c0', -0.18, -0.05, 0).box(0.03, 0.08, 0.9, '#c0c0c0', 0.18, -0.05, 0).build(), shape: ['box', 0.2, 0.06, 0.45], mass: 3, friction: 0.05, fixed: true },
  torch: { name: 'Torch', geo: () => P().cyl(0.02, 0.02, 0.18, '#222', 0, 0, 0, 0, 0, Math.PI / 2).cyl(0.03, 0.02, 0.05, '#555', 0.11, 0, 0, 0, 0, Math.PI / 2).build(), shape: ['cap', 0.1, 0.03], mass: 0.3, use: 'torch' },
  // ===================== DINING / GAMES ROOM =====================
  dining_chair: { name: 'Dining chair', geo: () => P().box(0.44, 0.04, 0.42, '#4a2e1c', 0, -0.02, 0).box(0.44, 0.48, 0.04, '#4a2e1c', 0, 0.26, -0.19).box(0.4, 0.05, 0.37, '#8a3a3a', 0, 0.02, 0.01).box(0.04, 0.44, 0.04, '#3a2216', -0.19, -0.26, 0.18).box(0.04, 0.44, 0.04, '#3a2216', 0.19, -0.26, 0.18).box(0.04, 0.44, 0.04, '#3a2216', -0.19, -0.26, -0.18).box(0.04, 0.44, 0.04, '#3a2216', 0.19, -0.26, -0.18).build(), shape: ['box', 0.22, 0.48, 0.21], mass: 5, sound: 'thud' },
  dining_table: { name: 'Dining table', geo: () => P().box(0.95, 0.05, 2.2, '#4a2e1c', 0, 0.36, 0).box(0.07, 0.72, 0.07, '#3a2216', -0.42, 0, -1.03).box(0.07, 0.72, 0.07, '#3a2216', 0.42, 0, -1.03).box(0.07, 0.72, 0.07, '#3a2216', -0.42, 0, 1.03).box(0.07, 0.72, 0.07, '#3a2216', 0.42, 0, 1.03).build(), shape: ['box', 0.475, 0.385, 1.1], mass: 45, sound: 'bigthud', angDamp: 2, fixed: true },
  office_chair: { name: 'Office chair', geo: () => P().rbox(0.48, 0.08, 0.46, 0.03, '#222', 0, 0.05, 0).rbox(0.44, 0.5, 0.06, 0.03, '#222', 0, 0.35, -0.21).cyl(0.03, 0.03, 0.3, '#888', 0, -0.15, 0).cyl(0.28, 0.28, 0.03, '#333', 0, -0.32, 0, 0, 0, 0, 5).build(), shape: ['box', 0.24, 0.35, 0.23], mass: 9, sound: 'thud', angDamp: 0.2, fixed: true },
  pong_cup: { name: 'Pong cup', geo: () => P().lathe([[0, -0.06], [0.03, -0.06], [0.045, 0.06], [0.042, 0.06], [0.028, -0.055], [0, -0.055]], '#d62828', 0, 0, 0, 14).build(), shape: ['cyl', 0.06, 0.04], mass: 0.02, extra: 0 },
  parcel: { name: 'Pass the Parcel', geo: () => P().rbox(0.3, 0.22, 0.25, 0.04, '#ffffff').build(), shape: ['box', 0.15, 0.11, 0.125], mass: 0.6, tints: ['#c1121f', '#2d6a4f', '#3a86ff', '#ffd60a', '#7b2cbf', '#ff006e', '#f77f00', '#06d6a0'], use: 'parcel', important: true },
  board_game: { name: 'Property-trading board game', geo: () => box(0.5, 0.06, 0.25, '#ffffff'), mat: texMat(() => TX.label('board', 400, 200, '#c1121f', [{ text: 'PROPERTY', size: 54, bold: true, y: 70 }, { text: 'TYCOON', size: 54, bold: true, y: 130 }, { text: '40-min argument included', size: 20, color: '#ffd60a', y: 180 }])), shape: ['box', 0.25, 0.03, 0.125], mass: 1.2, use: 'boardgame' },
  cards: { name: 'Pack of cards', geo: () => P().rbox(0.065, 0.02, 0.09, 0.004, '#1d3557').build(), shape: ['box', 0.033, 0.01, 0.045], mass: 0.1 },
  dice: { name: 'Die', geo: () => { const p = P().rbox(0.025, 0.025, 0.025, 0.004, '#ffffff'); p.sph(0.003, '#111', 0, 0.0126, 0, 1, 0.3, 1, 5); return p.build(); }, shape: ['box', 0.0125, 0.0125, 0.0125], mass: 0.01, bounce: 0.5 },
  buzzer: { name: 'Quiz buzzer', geo: () => P().cyl(0.06, 0.07, 0.04, '#222', 0, -0.01, 0, 0, 0, 0, 16).sph(0.045, '#ffffff', 0, 0.015, 0, 1, 0.5, 1).build(), shape: ['cyl', 0.03, 0.07], mass: 0.3, tints: ['#d23b3b', '#2f74c0', '#2fa35a'], use: 'buzzer' },
  postit: { name: 'Post-it pad', geo: () => box(0.076, 0.012, 0.076, '#ffe066'), shape: ['box', 0.038, 0.006, 0.038], mass: 0.03, use: 'postit' },
  blindfold: { name: 'Blindfold', geo: () => P().box(0.4, 0.004, 0.05, '#111').build(), shape: ['box', 0.2, 0.004, 0.025], mass: 0.02, linDamp: 1 },
  highchair: { name: "Harrison's highchair", geo: () => P().box(0.4, 0.04, 0.4, '#f4f4f4', 0, 0.2, 0).box(0.4, 0.35, 0.04, '#f4f4f4', 0, 0.4, -0.18).box(0.5, 0.03, 0.25, '#f4f4f4', 0, 0.38, 0.2).cyl(0.02, 0.03, 0.75, '#c0c0c0', -0.2, -0.2, -0.2).cyl(0.02, 0.03, 0.75, '#c0c0c0', 0.2, -0.2, -0.2).cyl(0.02, 0.03, 0.75, '#c0c0c0', -0.2, -0.2, 0.2).cyl(0.02, 0.03, 0.75, '#c0c0c0', 0.2, -0.2, 0.2).build(), shape: ['box', 0.25, 0.58, 0.25], mass: 7, sound: 'thud', fixed: true },
  bouncer: { name: 'Baby bouncer', geo: () => P().box(0.4, 0.04, 0.6, '#c0c0c0', 0, -0.1, 0).rbox(0.36, 0.1, 0.55, 0.05, '#7ac8e8', 0, 0.0, 0, -0.35).torus(0.15, 0.01, '#c0c0c0', 0, 0.15, 0.1, 0, Math.PI / 2, 0, Math.PI).build(), shape: ['box', 0.2, 0.12, 0.3], mass: 2.5, fixed: true },
  rudolph_poster: { name: 'Pin-the-nose Rudolph poster', geo: () => P().box(0.5, 0.7, 0.01, '#c8a070').sph(0.12, '#7a4a22', 0, 0.05, 0.01, 1, 1.2, 0.2).build(), shape: ['box', 0.25, 0.35, 0.006], mass: 0.2, linDamp: 1 },
  red_nose: { name: 'Red nose', geo: () => P().sph(0.03, '#e63946', 0, 0, 0, 1, 1, 1, 10).build(), shape: ['ball', 0.03], mass: 0.01, bounce: 0.6 },
  // ===================== CONSERVATORY / GARDEN =====================
  wicker_chair: { name: 'Wicker chair', geo: () => P().cyl(0.36, 0.3, 0.42, '#b88a50', 0, -0.15, 0, 0, 0, 0, 12).cyl(0.4, 0.38, 0.55, '#c89a60', 0, 0.3, -0.12, 0.25, 0, 0, 12, true).cyl(0.3, 0.3, 0.08, '#e8d8b8', 0, 0.08, 0.02).build(), shape: ['cyl', 0.36, 0.36], mass: 6, sound: 'cushion', fixed: true },
  wicker_table: { name: 'Wicker table', geo: () => P().cyl(0.35, 0.35, 0.03, '#d8e8f0', 0, 0.2, 0, 0, 0, 0, 18).cyl(0.3, 0.25, 0.4, '#b88a50', 0, -0.02, 0, 0, 0, 0, 12).build(), shape: ['cyl', 0.22, 0.35], mass: 8, sound: 'thud', fixed: true },
  plant_pot: { name: 'Plant pot', geo: () => P().cyl(0.13, 0.1, 0.22, '#b5562e', 0, -0.08, 0, 0, 0, 0, 16).sph(0.17, '#3a7a32', 0, 0.1, 0, 1, 0.9, 1, 8).sph(0.1, '#4a8a3a', 0.06, 0.2, 0.03, 1, 1, 1, 6).build(), shape: ['cyl', 0.2, 0.14], mass: 3, sound: 'thud', fragile: 8, fixed: true },
  watering_can: { name: 'Watering can', geo: () => P().cyl(0.09, 0.1, 0.22, '#2d6a4f', 0, 0, 0).cyl(0.012, 0.02, 0.28, '#2d6a4f', 0.15, 0.06, 0, 0, 0, -0.9).torus(0.07, 0.01, '#2d6a4f', -0.02, 0.13, 0, 0, 0, 0, Math.PI).build(), shape: ['cyl', 0.11, 0.1], mass: 1.2 },
  microphone: { name: 'Karaoke microphone', geo: () => P().cyl(0.015, 0.012, 0.16, '#222', 0, 0, 0).sph(0.03, '#888', 0, 0.1, 0, 1, 1, 1, 10).build(), shape: ['cap', 0.08, 0.025], mass: 0.25, use: 'mic' },
  magazine: { name: 'Magazine', geo: () => box(0.21, 0.006, 0.28, '#ffffff'), tints: ['#ff006e', '#3a86ff', '#ffd60a'], shape: ['box', 0.105, 0.003, 0.14], mass: 0.15, linDamp: 0.6 },
  patio_table: { name: 'Patio table', geo: () => P().cyl(0.5, 0.5, 0.03, '#e8e8e8', 0, 0.36, 0, 0, 0, 0, 20).cyl(0.025, 0.025, 0.72, '#ddd', 0, 0, 0).cyl(0.25, 0.3, 0.03, '#ccc', 0, -0.35, 0).build(), shape: ['cyl', 0.37, 0.5], mass: 7, sound: 'thud', fixed: true },
  patio_chair: { name: 'Patio chair', geo: () => P().box(0.45, 0.03, 0.45, '#e8e8e8', 0, 0, 0).box(0.45, 0.45, 0.03, '#e8e8e8', 0, 0.24, -0.21, -0.15).box(0.03, 0.44, 0.03, '#ddd', -0.2, -0.22, 0.2).box(0.03, 0.44, 0.03, '#ddd', 0.2, -0.22, 0.2).box(0.03, 0.44, 0.03, '#ddd', -0.2, -0.22, -0.2).box(0.03, 0.44, 0.03, '#ddd', 0.2, -0.22, -0.2).build(), shape: ['box', 0.225, 0.45, 0.225], mass: 2.5, sound: 'tap' },
  gnome: { name: 'Garden gnome', geo: () => P().cyl(0.07, 0.09, 0.16, '#1d3557', 0, -0.08, 0).sph(0.06, '#f2d0b0', 0, 0.04, 0).cone(0.06, 0.14, '#c1121f', 0, 0.14, 0).sph(0.055, '#f4f4f4', 0, 0.0, 0.03, 1, 1.1, 0.7).build(), shape: ['cyl', 0.16, 0.09], mass: 2, sound: 'thud', fragile: 10 },
  wheelbarrow: { name: 'Wheelbarrow', geo: () => P().box(0.6, 0.3, 0.8, '#2d6a4f', 0, 0.05, 0).cyl(0.15, 0.15, 0.06, '#222', 0, -0.15, 0.45, 0, 0, Math.PI / 2).box(0.04, 0.04, 0.6, '#888', -0.25, 0.0, -0.6).box(0.04, 0.04, 0.6, '#888', 0.25, 0.0, -0.6).build(), shape: ['box', 0.3, 0.22, 0.6], mass: 12, sound: 'thud', fixed: true },
  bird_feeder: { name: 'Bird feeder', geo: () => P().cyl(0.04, 0.04, 0.2, '#e8f0f4', 0, 0, 0).cone(0.07, 0.06, '#2d6a4f', 0, 0.13, 0).cyl(0.06, 0.06, 0.02, '#2d6a4f', 0, -0.1, 0).build(), shape: ['cyl', 0.13, 0.06], mass: 0.4 },
  // ===================== MINI-GAME PROPS / MISC =====================
  wooden_spoon_prize: { name: 'Wooden spoon (losers\' prize)', geo: () => P().box(0.35, 0.015, 0.02, '#c8a070', 0.05, 0, 0).sph(0.04, '#c8a070', -0.15, 0, 0, 1.4, 0.4, 1).build(), shape: ['box', 0.2, 0.012, 0.035], mass: 0.08, extra: 1 },
  certificate: { name: '"Better Luck Next Year" certificate', geo: () => box(0.3, 0.004, 0.21, '#ffffff'), mat: texMat(() => TX.label('cert', 420, 300, '#f4ecd8', [{ text: 'BETTER LUCK', size: 44, bold: true, color: '#7a1f24', y: 80 }, { text: 'NEXT YEAR', size: 44, bold: true, color: '#7a1f24', y: 140 }, { text: '(gravy stain courtesy of Paul)', size: 20, color: '#6a4a2a', y: 220 }], { border: '#d4af37' })), shape: ['box', 0.15, 0.002, 0.105], mass: 0.02, linDamp: 1, extra: 1 },
  cork: { name: 'Prosecco cork', geo: () => P().cyl(0.012, 0.016, 0.03, '#d8b080', 0, 0, 0, 0, 0, 0, 10).sph(0.016, '#d8b080', 0, 0.016, 0, 1, 0.6, 1, 8).build(), shape: ['ball', 0.017], mass: 0.008, bounce: 0.6, extra: 6, sound: 'tap' },
  santa_trousers: { name: "Gary's Santa trousers", geo: () => P().rbox(0.5, 0.06, 0.7, 0.03, '#c41e1e').box(0.5, 0.065, 0.06, '#f4f4f4', 0, 0, 0.33).build(), shape: ['box', 0.25, 0.03, 0.35], mass: 0.4, linDamp: 1.5, extra: 2 },
  confetti: { name: 'Confetti', geo: () => box(0.02, 0.002, 0.012, '#ffffff'), shape: ['box', 0.01, 0.001, 0.006], mass: 0.001, linDamp: 4, angDamp: 1, tints: BRIGHT, extra: 60 },
  cracker_toy: { name: 'Cracker toy', geo: () => P().sph(0.015, '#ffffff', 0, 0, 0, 1, 1, 1, 8).box(0.03, 0.005, 0.01, '#ffffff', 0.02, 0, 0).build(), shape: ['ball', 0.018], mass: 0.01, tints: BRIGHT, toy: true, extra: 12 },
};

// [typeId, x, surfaceY, z, yaw, count, dx, dz, dy]
export const PLACEMENTS = [
  // ---- living room ----
  ['coffee_table', 0, 0, -3.6, 0], ['armchair', -1.9, 0, -6.1, Math.PI * 0.82], ['pouffe', 1.2, 0, -5.2],
  // cushions stand up against the sofa backs at the ends (people sit on the seats, not in the cushions)
  ['cushion', -3.06, 0.72, -4.32, Math.PI / 2, 1, 0, 0, 0, -1.2], ['cushion', -3.06, 0.72, -2.08, Math.PI / 2, 1, 0, 0, 0, -1.2], ['cushion', 2.92, 0.72, -4.62, -Math.PI / 2, 1, 0, 0, 0, -1.2], ['cushion', 2.92, 0.72, -2.62, -Math.PI / 2, 1, 0, 0, 0, -1.2], ['cushion', 0.8, 0.02, -2.3],
  ['answer_sheet', -0.35, 0.42, -3.75, 0], ['answer_sheet', 0.3, 0.42, -3.5, 0.3], ['answer_sheet', -2.0, 0.6, -5.9, 0],
  ['pen', -0.1, 0.42, -3.85, 0, 2, 0.05, 0.02], ['pen', 0.45, 0.42, -3.75, 1],
  ['remote', 0.1, 0.42, -3.35, 0.4], ['cracker', -0.45, 0.42, -3.4, 0.2, 3, 0.06, 0.05],
  ['celeb_tin', 0.3, 0.42, -3.9], ['quality_tin', -0.25, 0.42, -3.25],
  ['coaster', 0.5, 0.42, -3.35], ['coaster', -0.55, 0.42, -3.85],
  ['wine_glass', -2.9, 0.62, -1.75], ['wine_glass', 0.52, 0.43, -3.33], ['wine_glass', -0.52, 0.43, -3.85],
  ['card', -2.95, 1.25, -0.3, 0, 3, 0.2, 0], ['mason_cup', -2.2, 1.25, -0.3, 0], ['photo_frame', -1.55, 1.25, -0.25, -0.3], ['candle', -1.45, 1.25, -0.42],
  ['nutcracker', -1.65, 1.25, -0.4], ['snow_globe', -3.25, 1.2, -0.75],
  ['tv_guide', 0.0, 0.42, -3.95, 0.2], ['tissues', -3.2, 0.5, -5.25],
  ['present_s', -0.7, 0, -6.85, 0.3, 2, 0.5, 0.0], ['present_m', 0.7, 0, -6.85, -0.4], ['present_l', -0.1, 0, -6.6, 0.2],
  ['duplo', -0.6, 0.012, -2.7, 0, 3, 0.08, 0.03], ['toy_car', -0.8, 0.012, -4.4, 0.5], ['toy_dino', 0.9, 0.012, -2.8, 2], ['teddy', -2.85, 0.45, -1.9, Math.PI / 2],
  ['dog_toy', -0.8, 0.02, -0.5], ['tennis_ball', -1.1, 0.02, -0.7], ['celebration', 0.3, 0.6, -3.9, 0, 3, 0.01, 0.0, 0.03], ['sweet', -0.25, 0.55, -3.25, 0, 2, 0.01, 0, 0.03],
  ['phone', -2.95, 0.62, -1.65, 1.2],
  ['gamepad', 2.75, 0.5, -3.0, -1.5],
  // ---- hallway ----
  ['shoe', -0.4, 0, 5.55, 0.3, 4, 0.18, -0.04], ['shoe', 0.3, 0, 5.3, -0.6, 2, 0.1, 0.12], ['slipper', 0.6, 0, 5.0, 2.5],
  ['no_shoes_sign', -0.93, 0.87, 2.0, Math.PI / 2], ['keys', -0.9, 0.87, 2.4], ['handbag', -0.9, 0.87, 2.6, Math.PI / 2],
  ['photo_frame', -0.93, 0.87, 2.25, Math.PI / 2],
  // ---- toilet ----
  ['toilet_roll', -1.4, 0, 5.8], ['air_freshener', -1.85, 0.93, 5.85], ['rubber_duck', -2.15, 0.93, 5.85],
  // ---- under stairs / garage ----
  ['hoover', -1.4, 0, 0.4], ['deco_box', -2.5, 0, 0.35, 0, 2, 0, 0, 0.3], ['deco_box', -2.55, 0, 1.2], ['folding_chair', -1.9, 0, 1.5, 0.2, 2, 0.05, 0.06, 0.05], ['outfit_box', -2.4, 1.43, 0.25],
  ['paint_tin', -8.15, 0.52, 0.6, 0, 2, 0, 0.3], ['toolbox', -5.2, 0.93, 0.4], ['traffic_cone', -7.8, 0, 4.8], ['mop_bucket', -7.6, 0, 0.6], ['mop', -7.4, 0.62, 0.5], ['cool_box', -4.8, 0, 2.0],
  ['sledge', -8.0, 0, 3.2, 0.1], ['football', -4.5, 0, 1.5], ['torch', -5.5, 0.93, 0.5],
  ['beer_crate', -4.0, 0.92, 5.5, 0], ['beer_crate', -3.5, 0.92, 5.5, 0], 
  ['lager', -4.12, 0.96, 5.5, 0, 4, 0.08, 0], ['lager', -3.62, 0.96, 5.5, 0, 4, 0.08, 0],
  // garage fridge contents (fridge at x=-4.9,z=5.6, shelves y=0.12/0.57/1.02)
  ['lager', -5.08, 0.13, 5.62, 0, 3, 0.1, 0], ['cider', -5.08, 0.58, 5.62, 0, 2, 0.12, 0], ['bitter', -5.05, 1.03, 5.65, 0, 2, 0.12, 0], ['prosecco', -4.75, 1.03, 5.7], ['pork_pie', -4.9, 0.58, 5.45],
  // ---- kitchen buffet along the worktop: from the sink round to the fridge ----
  ['paper_plate', 1.45, 0.91, 5.62, 0, 4, 0, 0, 0.014], ['napkins', 1.75, 0.91, 5.65],
  ['sausage_roll', 2.05, 0.92, 5.6, 0, 5, 0.07, 0],
  ['pig_tray', 2.75, 0.91, 5.62, 0], ['pig_blanket', 2.62, 0.94, 5.6, 0, 5, 0.06, 0],
  ['platter', 3.35, 0.91, 5.62], ['tongs', 3.35, 0.95, 5.4, 0.3],
  ['trifle', 4.95, 0.91, 5.62], ['serving_spoon', 4.75, 0.91, 5.4, 0.4],
  ['cheeseboard', 5.6, 0.91, 5.6], ['brie', 5.62, 0.95, 5.45], ['cracker_bis', 5.95, 0.91, 5.5, 0, 3, 0, 0, 0.007],
  ['coleslaw', 6.25, 0.91, 5.62], ['potato_salad', 6.65, 0.91, 5.62],
  ['scotch_egg', 6.6, 0.95, 5.0, 0, 3, 0, -0.1], ['pork_pie', 6.65, 0.91, 4.4], ['crisps_bowl', 6.65, 0.91, 4.0],
  ['pudding', 6.65, 0.91, 2.3], ['cream_jug', 6.6, 0.91, 2.0], ['brandy', 6.75, 0.91, 1.85],
  ['mince_pie', 6.65, 0.91, 1.4, 0, 5, 0, -0.08],
  ['sprout', 4.1, 0.95, 3.0, 0, 4, 0.04, 0.03], ['roasting_tin', 6.7, 0.92, 3.0], ['turkey', 6.7, 0.96, 3.0],
  
  // drinks station on the island + kettle corner
  ['kettle', 5.6, 0.91, 5.75], ['mug', 5.85, 0.91, 5.75, 0, 3, 0.12, 0], ['tea_caddy', 6.3, 0.91, 5.8],
  ['wine_glass', 3.6, 0.925, 2.7, 0, 2, 0.14, 0], ['pint_glass', 4.1, 0.925, 2.65, 0, 2, 0.14, 0], ['coaster', 3.6, 0.925, 3.2],
  ['squash', 4.9, 0.925, 2.65], ['juice', 5.0, 0.925, 3.15], ['baileys', 3.5, 0.925, 3.1],
  ['toaster', 1.6, 0.91, 0.35], ['microwave', 2.5, 0.91, 0.38], ['tea_towel', 3.0, 0.91, 0.3], ['kitchen_roll', 4.0, 0.91, 5.8], ['oven_glove', 6.6, 0.91, 3.4],
  ['frying_pan', 6.72, 0.92, 2.75], ['chopping_board', 2.9, 0.91, 5.1, 0.1],
  ['fruit_bowl', 3.9, 0.925, 3.2], ['satsuma', 3.9, 0.98, 3.2, 0, 2, 0.04, 0.03, 0.01], ['banana', 3.95, 1.04, 3.25],
  ['biscuit_tin', 1.8, 1.47, 0.14], ['spray', 4.6, 0.91, 5.85], ['bin', 1.5, 0, 1.2],
  ['stool', 3.6, 0, 2.15], ['stool', 4.8, 0, 2.15],
  // kitchen fridge contents (fridge x=3.8, z≈0.45; shelves y=0.12, 0.57, 1.02, 1.42)
  ['prosecco', 3.55, 0.13, 0.45], ['white_wine', 3.75, 0.13, 0.45], ['red_wine', 3.95, 0.13, 0.4], ['lager', 4.05, 0.58, 0.35, 0, 3, 0.07, 0.12],
  ['milk', 3.5, 0.58, 0.5], ['juice', 3.65, 0.58, 0.5], ['foil', 3.8, 1.03, 0.45], ['squash', 3.55, 1.43, 0.45], ['baileys', 3.75, 1.43, 0.45],
  // ---- dining / games room ----
  ['dining_table', 6.45, 0, -3.5], ['dining_chair', 5.75, 0, -4.6, Math.PI / 2], ['dining_chair', 5.75, 0, -3.5, Math.PI / 2], ['dining_chair', 5.75, 0, -2.4, Math.PI / 2], ['dining_chair', 6.45, 0, -1.95, Math.PI], ['dining_chair', 6.45, 0, -5.05, 0], ['dining_chair', 4.6, 0, -6.3, 0.8],
  ['office_chair', 6.0, 0, -6.0, Math.PI], ['highchair', 4.3, 0, -1.6, 0.4], ['bouncer', 4.6, 0, -4.5, 1.2],
  ['pong_cup', 6.2, 0.77, -4.3, 0, 3, 0.11, 0], ['pong_cup', 6.25, 0.77, -4.2, 0, 2, 0.11, 0], ['pong_cup', 6.3, 0.77, -4.1, 0, 1],
  ['parcel', 6.4, 0.77, -3.2], ['board_game', 6.5, 0.77, -2.3, 0.2], ['buzzer', 6.6, 0.77, -3.9, 0, 3, 0, 0.18],
  ['sippy_cup', 4.35, 0.77, -1.45], ['rusk', 4.3, 0.77, -1.4], ['baby_bottle', 3.85, 0.86, -2.8],
  ['cracker', 3.85, 0.86, -4.0, 0, 2, 0, 0.12], ['present_s', 4.9, 0, -5.4, 0, 2, 0.4, 0],
  // ---- conservatory ----
  ['wicker_chair', 4.2, 0, -8.6, 0.5], ['wicker_chair', 6.4, 0, -9.5, -0.5],  ['wicker_table', 5.3, 0, -9.0],
  ['plant_pot', 7.0, 0, -7.4], ['plant_pot', 3.6, 0, -10.2], ['watering_can', 6.9, 0, -9.4], ['microphone', 4.0, 0.62, -10.2], ['magazine', 5.3, 0.43, -9.0, 0.4],
  // ---- garden / patio ----
  ['patio_table', -1.2, 0, -9.4], ['patio_chair', -1.9, 0, -9.4, Math.PI / 2], ['patio_chair', -0.5, 0, -9.4, -Math.PI / 2], ['patio_chair', -1.2, 0, -10.1, 0], ['patio_chair', -1.2, 0, -8.7, Math.PI],
  ['gnome', -4.0, 0, -10.5, 0.4], ['football', -3.0, 0, -12.5], ['wheelbarrow', 6.5, 0, -16.0, 0.6], ['plant_pot', -2.6, 0, -7.3], ['bird_feeder', -6.0, 0, -15.5],
  // ---- tree baubles are spawned by the tree; extras spare ----
];

// ---------------- hinged things (doors, fridge doors, lids, stair gate) ----------------
export function buildHinged() {
  const R = G.R, out = [];
  const mkMesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat || G.items.vcMat); m.castShadow = true; G.scene.add(m); return m; };
  function hinge({ name, size, center, hinge: hp, axis, limits, mass = 12, geo, mat, damping = 3, closeSpring = 0, kind = 'door', glass = false }) {
    const body = G.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(center.x, center.y, center.z).setAngularDamping(damping).setLinearDamping(0.5).setCanSleep(true).setSleeping(true));
    const col = G.world.createCollider(R.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2).setMass(mass).setFriction(0.5).setCollisionGroups(groups(GR.DOOR, ALL)), body);
    const anchor = G.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(hp.x, hp.y, hp.z));
    const data = R.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: hp.x - center.x, y: hp.y - center.y, z: hp.z - center.z }, axis);
    data.limitsEnabled = true; data.limits = limits;
    const joint = G.world.createImpulseJoint(data, anchor, body, true);
    const mesh = mkMesh(geo, mat);
    const h = { name, body, collider: col, mesh, kind, closed: true, openT: 0, locked: false, closeSpring, axis, limits, hingePos: hp.clone(), center0: center.clone(),
      update(dt) {
        const t = body.translation(), r = body.rotation(); mesh.position.set(t.x, t.y, t.z); mesh.quaternion.set(r.x, r.y, r.z, r.w);
        const q = mesh.quaternion; const ang = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
        this.angle = ang; this.closed = ang < 0.12;
        this.openT = this.closed ? 0 : this.openT + dt;
        if (this.closeSpring && !this.closed && !this.held) { const s = axis.y ? { x: 0, y: 1, z: 0 } : axis.x ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 }; const sign = (limits[0] + limits[1]) > 0 ? -1 : 1; body.applyTorqueImpulse({ x: s.x * sign * closeSpring * dt, y: s.y * sign * closeSpring * dt, z: s.z * sign * closeSpring * dt }, true); }
      },
      lock(on) { this.locked = on; body.setBodyType(on ? R.RigidBodyType.Fixed : R.RigidBodyType.Dynamic, true); },
    };
    G.colliderMap.set(col.handle, { kind: 'hinged', ref: h });
    h.update(0); out.push(h); return h;
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const doorGeo = (w, h, d, color, handleSide = 1, glassPanel = false) => { const p = new Prop().box(w, h, d, color); const along = w > d; for (const s of [-1, 1]) { if (along) p.box(0.1, 0.02, 0.04, '#c0a050', handleSide * (w / 2 - 0.08), -0.03, s * (d / 2 + 0.03)); else p.box(0.04, 0.02, 0.1, '#c0a050', s * (w / 2 + 0.03), -0.03, handleSide * (d / 2 - 0.08)); }
    if (!glassPanel) for (const s of [-1, 1]) for (const yy of [0.45, -0.35]) { if (along) p.box(w * 0.7, h * 0.32, 0.005, new THREE.Color(color).multiplyScalar(0.92).getStyle(), 0, yy * h / 2 * 1.1, s * (d / 2 + 0.002)); else p.box(0.005, h * 0.32, d * 0.7, new THREE.Color(color).multiplyScalar(0.92).getStyle(), s * (w / 2 + 0.002), yy * h / 2 * 1.1, 0); }
    return p.build(); };
  // room doors (swing into the smaller rooms)
  hinge({ name: 'Toilet door', size: [0.04, 2.0, 0.78], center: V(-1.1, 1.0, 5.05), hinge: V(-1.1, 1.0, 4.67), axis: { x: 0, y: 1, z: 0 }, limits: [-1.7, 0.02], geo: doorGeo(0.04, 2.0, 0.78, '#f4f1ea') });
  hinge({ name: 'Under-stairs door', size: [0.04, 2.0, 0.78], center: V(-1.1, 1.0, 1.15), hinge: V(-1.1, 1.0, 0.77), axis: { x: 0, y: 1, z: 0 }, limits: [-1.7, 0.02], geo: doorGeo(0.04, 2.0, 0.78, '#f4f1ea') });
  const gd = hinge({ name: 'Garage door', size: [0.05, 2.0, 0.83], center: V(-3.0, 1.0, 1.03), hinge: V(-3.0, 1.0, 0.62), axis: { x: 0, y: 1, z: 0 }, limits: [-1.7, 0.02], geo: doorGeo(0.05, 2.0, 0.83, '#d8d0c0'), closeSpring: 8 });
  gd.isGarage = true;
  const glassDoorGeo = (w, h, d) => new Prop().box(w, 0.08, d, '#f6f6f6', 0, h / 2 - 0.04, 0).box(w, 0.08, d, '#f6f6f6', 0, -h / 2 + 0.04, 0).box(w > d ? 0.06 : w, h, w > d ? d : 0.06, '#f6f6f6', w > d ? -w / 2 + 0.03 : 0, 0, w > d ? 0 : -d / 2 + 0.03).box(w > d ? 0.06 : w, h, w > d ? d : 0.06, '#f6f6f6', w > d ? w / 2 - 0.03 : 0, 0, w > d ? 0 : d / 2 - 0.03).box(w > d ? w - 0.1 : 0.01, h - 0.15, w > d ? 0.01 : d - 0.1, '#bcd8e4').build();
  hinge({ name: 'Conservatory door', size: [1.16, 2.05, 0.05], center: V(5.0, 1.03, -7.0), hinge: V(4.42, 1.03, -7.0), axis: { x: 0, y: 1, z: 0 }, limits: [-0.02, 1.7], geo: glassDoorGeo(1.16, 2.05, 0.05), glass: true });
  hinge({ name: 'Patio door', size: [0.05, 2.05, 1.26], center: V(3.2, 1.03, -8.95), hinge: V(3.2, 1.03, -9.58), axis: { x: 0, y: 1, z: 0 }, limits: [-1.7, 0.02], geo: glassDoorGeo(0.05, 2.05, 1.26), glass: true });
  // stair gate (Mason's)
  const gateGeo = (() => { const p = new Prop().box(0.86, 0.04, 0.03, '#f4f4f4', 0, 0.38, 0).box(0.86, 0.04, 0.03, '#f4f4f4', 0, -0.38, 0); for (let i = 0; i < 10; i++) p.box(0.02, 0.76, 0.02, '#f4f4f4', -0.4 + i * 0.089, 0, 0); return p.build(); })();
  hinge({ name: 'Stair gate', size: [0.86, 0.8, 0.03], center: V(-1.55, 0.42, 4.36), hinge: V(-1.98, 0.42, 4.36), axis: { x: 0, y: 1, z: 0 }, limits: [-1.5, 0.02], mass: 3, geo: gateGeo, kind: 'gate', closeSpring: 3 });
  // fridges: hollow carcass (static walls) + hinged door with a light inside
  const fridge = (name, cx, cz, facing, w, h, d, color, shelves) => {
    const s = facing; // +1 opens towards +z, -1 towards -z
    const backZ = cz - s * d / 2, frontZ = cz + s * d / 2;
    const P2 = new Prop().box(w, 0.04, d, color, 0, 0.02, 0).box(w, 0.04, d, color, 0, h - 0.02, 0).box(0.04, h, d, color, -w / 2 + 0.02, h / 2, 0).box(0.04, h, d, color, w / 2 - 0.02, h / 2, 0).box(w, h, 0.04, color, 0, h / 2, -s * (d / 2 - 0.02))
      .box(w - 0.08, h - 0.08, 0.005, '#f4f8fa', 0, h / 2, -s * (d / 2 - 0.045));
    for (const y of shelves) P2.box(w - 0.08, 0.012, d - 0.1, '#dde8ee', 0, y, s * 0.03);
    const m = mkMesh(P2.build()); m.position.set(cx, 0, cz);
    staticBox(cx, 0.02, cz, w / 2, 0.02, d / 2); staticBox(cx, h - 0.02, cz, w / 2, 0.02, d / 2);
    staticBox(cx - w / 2 + 0.02, h / 2, cz, 0.02, h / 2, d / 2); staticBox(cx + w / 2 - 0.02, h / 2, cz, 0.02, h / 2, d / 2); staticBox(cx, h / 2, backZ + s * 0.02, w / 2, h / 2, 0.02);
    for (const y of shelves) staticBox(cx, y, cz + s * 0.03, w / 2 - 0.04, 0.006, d / 2 - 0.05);
    const light = new THREE.PointLight('#e8f4ff', 0, 1.6, 2); light.position.set(cx, h * 0.8, cz + s * 0.05); G.scene.add(light);
    const dg = new Prop().rbox(w, h, 0.06, 0.02, color).box(0.03, h * 0.5, 0.04, '#999', w / 2 - 0.08, 0.1, s * 0.05);
    for (let i = 0; i < 3; i++) dg.box(w - 0.12, 0.02, 0.1, '#e8eef2', 0, -h * 0.3 + i * h * 0.3, -s * 0.08).box(w - 0.12, 0.08, 0.01, '#e8eef2', 0, -h * 0.27 + i * h * 0.3, -s * 0.13);
    const hingeX = cx - w / 2;
    const door = hinge({ name, size: [w, h, 0.06], center: V(cx, h / 2, frontZ + s * 0.035), hinge: V(hingeX, h / 2, frontZ + s * 0.035), axis: { x: 0, y: 1, z: 0 }, limits: s > 0 ? [-2.0, 0.02] : [-0.02, 2.0], mass: 8, geo: dg.build(), kind: 'fridge' });
    door.light = light; door.isFridge = true;
    const up = door.update.bind(door); door.update = (dt) => { up(dt); light.intensity = door.closed ? 0 : 2.5; };
    return door;
  };
  const kf = fridge('Kitchen fridge', 3.8, 0.42, 1, 0.92, 1.85, 0.68, '#d4d8dc', [0.1, 0.55, 1.0, 1.4]); kf.kitchen = true;
  const gf = fridge('Garage fridge', -4.9, 5.6, -1, 0.62, 1.4, 0.6, '#f2f2f2', [0.1, 0.55, 1.0]); gf.garage = true;
  // chest freezer lid
  hinge({ name: 'Chest freezer lid', size: [1.2, 0.06, 0.7], center: V(-3.75, 0.88, 5.55), hinge: V(-3.75, 0.88, 5.9), axis: { x: 1, y: 0, z: 0 }, limits: [-1.6, 0.02], mass: 4, geo: new Prop().rbox(1.2, 0.06, 0.7, 0.02, '#f4f4f4').box(0.25, 0.03, 0.04, '#bbb', 0, 0.02, -0.33).build(), kind: 'lid' });
  // toilet lid
  hinge({ name: 'Toilet seat lid', size: [0.36, 0.025, 0.42], center: V(-2.55, 0.43, 5.0), hinge: V(-2.76, 0.43, 5.0), axis: { x: 0, y: 0, z: 1 }, limits: [-0.02, 1.6], mass: 1, geo: new Prop().rbox(0.42, 0.025, 0.36, 0.01, '#f8f8f8', 0, 0, 0, 0, Math.PI / 2).build(), kind: 'lid' });
  return out;
}
