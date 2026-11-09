// Shared game context. Every module reads/writes through G so they stay loosely coupled.
import * as THREE from 'three';

export const G = {
  THREE,
  scene: null, camera: null, renderer: null, clock: null,
  R: null, world: null, eventQueue: null,
  time: 0, dt: 0, frame: 0,
  xr: false,              // currently presenting in a headset
  settings: null,
  player: null,
  chars: [],              // all people (incl. kids)
  charByName: {},
  dog: null,
  items: null,            // item manager
  house: null,
  quiz: null, systems: null, replay: null, minigames: null, ui: null, audio: null,
  colliderMap: new Map(), // collider handle -> {kind:'item'|'char'|'static'|'dog'|'door', ref, part}
  updaters: [],           // per-frame callbacks (dt)
  physUpdaters: [],       // called before each physics step (dt)
  events: {},
};

export function on(name, fn) { (G.events[name] ||= []).push(fn); }
export function emit(name, ...args) { const l = G.events[name]; if (l) for (const f of l) f(...args); }

// Collision groups (membership << 16 | filter)
export const GR = {
  STATIC: 1, ITEM: 2, CHAR: 4, PLAYER: 8, HELD: 16, PROTECTED: 32, DOOR: 64, SENSOR: 128,
};
export function groups(member, filter) { return ((member & 0xffff) << 16) | (filter & 0xffff); }
export const ALL = 0xffff;

export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Deterministic PRNG for per-character variation
export function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// Cheap value noise (3D) for displacement/colour variation
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const h = (a, b, c) => { let n = a * 374761393 + b * 668265263 + c * 1274126177; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) & 0xffff) / 65535; };
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w);
}

export const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
export const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
export const _m1 = new THREE.Matrix4();
