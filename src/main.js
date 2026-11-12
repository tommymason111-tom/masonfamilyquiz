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
import { loadSettings } from './game/settings.js';
import { loadModels } from './chars/glbrig.js';
import { FX } from './game/fx.js';
import { Modes, buildModePicker, modeById } from './game/modes.js';
import { initHome, homeProgress, renderPortraits, teamCards, orbitCamera } from './game/home.js';
// shown on the home screen so you can tell whether your browser has the latest version (bump on every change)
export const BUILD = '13 Nov 2026 · warnings v30';
const _b = document.getElementById('build'); if (_b) _b.textContent = 'Version: ' + BUILD;
import { CAST } from './chars/cast.js';

const status = (t, f) => { const el = document.getElementById('loadStatus'); if (el) el.textContent = t; if (f !== undefined) homeProgress(f); };

async function boot() {
  G.settings = loadSettings();
  initHome();
  status('Starting physics…', 0.05);
  await initPhysics();
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, G.settings.quality === 'low' ? 1 : 2));
  renderer.setSize(document.documentElement.clientWidth || innerWidth, document.documentElement.clientHeight || innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = !!G.settings.shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFoveation?.(0.5);
  document.getElementById('app').appendChild(renderer.domElement);
  G.renderer = renderer;
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
  buildHouse();
  status('Filling it with stuff…', 0.2);
  new Items().build();
  buildTree(G.house.spots.tree.clone());
  status('The family are arriving…');
  await loadModels((f, n) => status(`The family are arriving… ${n} is here`, 0.25 + f * 0.65));
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
  status('Taking the family photo…', 0.95);
  renderer.compile(scene, camera);
  try { G.portraits = renderPortraits(); teamCards(true, G.portraits); } catch (e) { console.warn(e); }
  document.getElementById('loading').classList.add('live');
  const facts = document.getElementById('facts'); if (facts) facts.innerHTML = [`${G.chars.length - 1} relatives`, '1 dog', `${G.items.count()} things to throw`, `${G.quiz.bank.length + 12} questions`, '5 rounds', '25 things that go wrong'].map(t => `<span>${t}</span>`).join('');
  status('Ready! Everyone\'s here.', 1);
  emit('ready'); window.__G = G;
  renderer.setAnimationLoop(loop);
}

let acc = 0;
function loop(t, xrFrame) {
  let dt = Math.min(G.clock.getDelta(), 0.05);
  if (G.fx && G.fx.hitStop > 0) { G.fx.hitStop -= dt; dt *= 0.15; }
  G.dt = dt; G.time += dt; G.frame++;
  G.xr = G.renderer.xr.isPresenting;
  if (!G.ui?.started && !G.xr) { orbitCamera(dt); G.player.controls.poll(); G.player.controls.endFrame(); } else G.player.preUpdate(dt, xrFrame);
  for (const p of G.chars) p.update(dt);
  G.dog?.update(dt);
  stepPhysics(dt);
  G.items.update(dt);
  G.tree?.update(dt);
  for (const f of G.updaters) f(dt);
  if (G.ui?.started || G.xr) G.player.postUpdate(dt); else G.player.fp.setVisible(false);
  updateListener(G.player.headObject());
  G.replay?.render();
  G.renderer.render(G.scene, G.camera);
}

boot().catch(e => { console.error(e); status('Error: ' + e.message); });
