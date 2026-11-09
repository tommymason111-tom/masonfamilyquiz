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
import { MiniGames } from './game/minigames.js';
import { loadSettings } from './game/settings.js';

const status = (t) => { const el = document.getElementById('loadStatus'); if (el) el.textContent = t; };

async function boot() {
  G.settings = loadSettings();
  status('Starting physics…');
  await initPhysics();
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, G.settings.quality === 'low' ? 1 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !!G.settings.shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFoveation?.(0.5);
  document.getElementById('app').appendChild(renderer.domElement);
  G.renderer = renderer;
  const scene = new THREE.Scene(); G.scene = scene;
  scene.background = new THREE.Color('#aebfd0');
  scene.fog = new THREE.Fog('#aebfd0', 30, 70);
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.03, 120); G.camera = camera;
  G.clock = new THREE.Clock();
  status('Building Martin\'s house…');
  buildHouse();
  status('Filling it with stuff…');
  new Items().build();
  buildTree(new THREE.Vector3(0, 0, -7.45));
  status('The family are arriving…');
  createPeople();
  new Dog();
  new AI();
  G.player = new Player();
  new Systems(); new Replay(); new Quiz(); new MiniGames();
  initUI();
  setDaylight(1);
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
  const unlock = () => { initAudio(); resumeAudio(); };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock); addEventListener('touchstart', unlock);
  status('');
  emit('ready'); window.__G = G;
  renderer.setAnimationLoop(loop);
}

let acc = 0;
function loop(t, xrFrame) {
  const dt = Math.min(G.clock.getDelta(), 0.05);
  G.dt = dt; G.time += dt; G.frame++;
  G.xr = G.renderer.xr.isPresenting;
  G.player.preUpdate(dt, xrFrame);
  for (const p of G.chars) p.update(dt);
  G.dog?.update(dt);
  G.physUpdaters.length || G.physUpdaters.push(ragdollPhysStep);
  stepPhysics(dt);
  G.items.update(dt);
  G.tree?.update(dt);
  for (const f of G.updaters) f(dt);
  G.player.postUpdate(dt);
  updateListener(G.player.headObject());
  G.replay?.render();
  G.renderer.render(G.scene, G.camera);
}

boot().catch(e => { console.error(e); status('Error: ' + e.message); });
