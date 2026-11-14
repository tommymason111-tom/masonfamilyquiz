// Entry point: renderer, scene, physics, world, people, systems, loop. Works on Quest 3 (WebXR) and flat screens.
import * as THREE from 'three';
import { G, on, emit } from './core.js';
import { initPhysics, stepPhysics } from './engine/physics.js';
import { initAudio, resumeAudio, updateListener } from './engine/audio.js';
import * as TX from './engine/textures.js';
import { buildHouse, setDaylight } from './world/house.js';
import { Items } from './world/items.js';
import { buildTree } from './world/tree.js';
import { createPeople } from './chars/people.js';
import { ragdollPhysStep } from './chars/rig.js';
import { Player } from './input/player.js';
import { initUI } from './game/ui.js';
import { Systems } from './game/systems.js';
import { Quiz } from './game/quiz.js';
import { Replay } from './game/replay.js';
import { AI } from './chars/ai.js';
import { Dog } from './chars/dog.js';
import { DogProc } from './chars/dogproc.js';
import { models } from './chars/glbrig.js';
import { MiniGames } from './game/minigames.js';
import { loadSettings, loadStore, saveStore } from './game/settings.js';
import { loadModels } from './chars/glbrig.js';
import { FX } from './game/fx.js';
import { Modes, buildModePicker, modeById } from './game/modes.js';
import { initHome, homeProgress, renderPortraits, teamCards, orbitCamera } from './game/home.js';
// shown on the home screen so you can tell whether your browser has the latest version (bump on every change)
export const BUILD = '13 Nov 2026 · simple home v52';
const _b = document.getElementById('build'); if (_b) _b.textContent = 'Version: ' + BUILD;
import { CAST } from './chars/cast.js';

const T0 = performance.now(); G.bootLog = [];
const status = (t, f) => { G.bootLog.push([Math.round(performance.now() - T0), t]); const el = document.getElementById('loadStatus'); if (el) el.textContent = t; if (f !== undefined) homeProgress(f); };

async function boot() {
  document.body.classList.add('booting');
  G.settings = loadSettings();
  initHome();
  // start downloading the family straight away, while physics starts and the house is built (they used to wait until after)
  let arrived = 0; const familyP = loadModels((f, n) => { arrived = f; status(`The family are arriving… ${n} is here`, 0.25 + f * 0.6); });
  const breathe = () => new Promise(r => setTimeout(r, 0)); // let the loading screen draw a frame between the big steps
  status('Starting physics…', 0.05);
  await initPhysics(); await breathe();
  const quest = /OculusBrowser|Quest/i.test(navigator.userAgent), phone = !quest && (matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent));
  // phones: no multisampling (costly on a high-DPI screen) and a capped resolution that adapts to keep it smooth; the Quest keeps AA for the headset
  const renderer = new THREE.WebGLRenderer({ antialias: !phone, powerPreference: 'high-performance' });
  const maxPR = Math.min(devicePixelRatio, G.settings.quality === 'low' ? 1 : phone ? 1.6 : 2); renderer.setPixelRatio(maxPR); G.pr = { max: maxPR, cur: maxPR, slow: 0, fast: 0, ema: 16 };
  renderer.setSize(document.documentElement.clientWidth || innerWidth, document.documentElement.clientHeight || innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = !!G.settings.shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFoveation?.(1); renderer.xr.setFramebufferScaleFactor?.(quest ? 0.9 : 1); // the headset: full fixed foveation, a touch under native resolution
  document.getElementById('app').appendChild(renderer.domElement);
  G.renderer = renderer; renderer.debug.checkShaderErrors = false; // don't stall on every shader to read its log: lets the browser compile them in parallel (much faster start-up)
  const scene = new THREE.Scene(); G.scene = scene;
  scene.background = new THREE.Color('#0d1530');
  scene.fog = new THREE.Fog('#0b1022', 28, 110);
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.03, 600); G.camera = camera;
  // field of view: keep at least ~78° across the screen, so a phone held upright isn't zoomed in and held things aren't cut off
  // the screen size: the layout viewport (not affected by pinch-zoom or a half-finished rotation)
  const vw = () => document.documentElement.clientWidth || innerWidth, vh = () => document.documentElement.clientHeight || innerHeight;
  const fitFov = () => { const a = vw() / vh(); const hf = THREE.MathUtils.degToRad(a < 1 ? 80 : 90); const vf = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hf / 2) / a)); camera.fov = Math.min(a < 1 ? 98 : 80, Math.max(70, vf)); camera.aspect = a; camera.updateProjectionMatrix(); };
  fitFov();
  G.clock = new THREE.Clock();
  status('Building Martin\'s house…', 0.12);
  buildHouse(); await breathe();
  status('Filling it with stuff…', 0.2);
  new Items().build();
  buildTree(G.house.spots.tree.clone()); await breathe();
  if (arrived < 1) status('The family are arriving…');
  await familyP; await breathe();
  status('Everyone\'s taking their coats off…', 0.88); await breathe();
  createPeople();
  if (models.Chip) new Dog(); else new DogProc();
  new AI();
  G.physUpdaters.push(ragdollPhysStep); // ragdoll muscles + joint limits
  G.player = new Player();
  new Systems(); new Replay(); new Quiz(); new MiniGames(); new FX(); new Modes();
  initUI();
  setDaylight(1);
  // keep the 3D view exactly the size of the screen. iOS can report a smaller size mid-zoom/rotation and never send
  // another resize, which left the game drawn in one corner of a black screen, so this is re-checked constantly
  const fitView = () => { if (G.xr) return; const w = vw(), h = vh(); const s = renderer.getSize(new THREE.Vector2()); if (Math.abs(s.x - w) > 1 || Math.abs(s.y - h) > 1) { renderer.setSize(w, h, false); fitFov(); } };
  addEventListener('resize', () => { fitView(); setTimeout(fitView, 300); }); addEventListener('orientationchange', () => setTimeout(fitView, 300)); window.visualViewport?.addEventListener('resize', fitView);
  G.updaters.push(() => { if (G.frame % 20 === 0) fitView(); });
  document.addEventListener('gesturestart', (e) => e.preventDefault()); // no pinch-zoom of the whole page on iOS
  const unlock = () => { initAudio(); resumeAudio(); };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock); addEventListener('touchstart', unlock);
  // the family photos: saved on the device after the first time, so later loads don't redo them; the first time they're taken
  // just after the game is up, so they don't hold up PLAY
  const PKEY = 'portraits.v2.' + Object.keys(G.charByName).length; const cached = loadStore(PKEY, null);
  if (cached && G.chars.every(p => cached[p.name])) { G.portraits = cached; try { teamCards(true, G.portraits); } catch (e) { /* cosmetic */ } }
  else setTimeout(() => requestAnimationFrame(() => { try { G.portraits = renderPortraits(); teamCards(true, G.portraits); saveStore(PKEY, G.portraits); } catch (e) { console.warn(e); } }), 250);
  renderer.compile(scene, camera); // warm up the shaders now (in parallel, see above) rather than on the first frames
  document.getElementById('loading').classList.add('live');
  const facts = document.getElementById('facts'); if (facts) facts.innerHTML = [`${G.chars.length - 1} relatives`, '1 dog', `${G.items.count()} things to throw`, `${G.quiz.bank.length + 12} questions`, '5 rounds', '25 things that go wrong'].map(t => `<span>${t}</span>`).join('');
  status('Ready! Everyone\'s here.', 1);
  document.body.classList.remove('booting');
  emit('ready'); window.__G = G;
  renderer.setAnimationLoop(loop);
}

let acc = 0; const seenErr = new Set();
// people are skinned meshes that three can't cull by itself (their bounds move with the bones), so they were all drawn every
// frame, even behind you or through walls. Skip anyone outside the view this frame (on a phone / Quest that's a lot of triangles).
// keep it smooth on a phone: if frames are slow for a couple of seconds drop the resolution a notch, raise it again when there's room
function adaptRes(now, dt) {
  const P = G.pr; if (!P || G.renderer.xr.isPresenting || document.hidden) return; P.ema = P.ema * 0.95 + dt * 1000 * 0.05;
  if (P.ema > 24) { P.slow += dt; P.fast = 0; } else if (P.ema < 15) { P.fast += dt; P.slow = 0; } else { P.slow = 0; P.fast = 0; }
  if (P.slow > 2 && P.cur > 0.75) { P.cur = Math.max(0.75, +(P.cur - 0.15).toFixed(2)); G.renderer.setPixelRatio(P.cur); P.slow = 0; }
  if (P.fast > 5 && P.cur < P.max) { P.cur = Math.min(P.max, +(P.cur + 0.1).toFixed(2)); G.renderer.setPixelRatio(P.cur); P.fast = 0; }
}
const _fr = new THREE.Frustum(), _m4 = new THREE.Matrix4(), _sph = new THREE.Sphere();
function cullPeople() {
  const xrCam = G.renderer.xr.isPresenting ? G.renderer.xr.getCamera() : null; const cam = xrCam || G.camera;
  if (!xrCam) cam.updateMatrixWorld(); _m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _fr.setFromProjectionMatrix(_m4);
  const test = (obj, x, y, z, r) => { if (!obj._skins) { obj._skins = []; obj.traverse(o => { if (o.isSkinnedMesh) obj._skins.push(o); }); } _sph.center.set(x, y, z); _sph.radius = r; const vis = _fr.intersectsSphere(_sph); for (const m of obj._skins) m.visible = vis; };
  for (const p of G.chars) { if (!p.root) continue; const w0 = p.state !== 'anim' && p.world?.[0]?.p; const H = p.H || 1.7; if (w0) test(p.root, w0.x, w0.y, w0.z, H); else test(p.root, p.pos.x, (p.pos.y || 0) + H * 0.5, p.pos.z, H * 0.75 + 0.3); }
  const d = G.dog; if (d?.rig?.root) test(d.rig.root, d.pos.x, 0.35, d.pos.z, 0.9);
}
G.perf = {}; // ms spent per system (averaged), for tuning: __G.perf
function safe(what, fn) { const t0 = performance.now(); try { fn(); } catch (e) { const k = what + ':' + e.message; if (!seenErr.has(k)) { seenErr.add(k); console.error('[' + what + ']', e); } } const pf = G.perf[what] || (G.perf[what] = { ms: 0, n: 0 }); pf.ms += performance.now() - t0; pf.n++; }
function loop(t, xrFrame) {
  let dt = Math.min(G.clock.getDelta(), 0.05);
  adaptRes(G.clock.elapsedTime, dt);
  if (G.fx && G.fx.hitStop > 0) { G.fx.hitStop -= dt; dt *= 0.15; }
  G.dt = dt; G.time += dt; G.frame++;
  G.xr = G.renderer.xr.isPresenting;
  // each part is guarded: one bad frame in one system must never stop the picture (in the headset that throws you out of VR)
  safe('player', () => { if (!G.ui?.started && !G.xr) { orbitCamera(dt); G.player.controls.poll(); G.player.controls.endFrame(); } else G.player.preUpdate(dt, xrFrame); });
  for (const p of G.chars) safe('char', () => p.update(dt));
  safe('dog', () => G.dog?.update(dt));
  safe('physics', () => stepPhysics(dt));
  safe('items', () => G.items.update(dt));
  safe('tree', () => G.tree?.update(dt));
  for (const f of G.updaters) safe('updater', () => f(dt));
  safe('post', () => { if (G.ui?.started || G.xr) G.player.postUpdate(dt); else G.player.fp.setVisible(false); });
  safe('audio', () => updateListener(G.player.headObject()));
  safe('replay', () => G.replay?.render());
  safe('cull', cullPeople);
  const tr = performance.now(); G.renderer.render(G.scene, G.camera); const pr = G.perf.render || (G.perf.render = { ms: 0, n: 0 }); pr.ms += performance.now() - tr; pr.n++;
}

boot().catch(e => { console.error(e); status('Error: ' + e.message); });
