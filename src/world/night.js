// 8pm on Boxing Day, back from the meal out: a clear cold night. Moon & stars, sodium street lamps, the
// neighbours' houses with their own Christmas lights, and the house lit room by room with warm lamps.
import * as THREE from 'three';
import { G, rand, pick, mulberry } from '../core.js';
import { Prop, uvBox, mergeGeometries } from '../engine/geo.js';
import { staticBox } from '../engine/physics.js';
import * as TX from '../engine/textures.js';
import { RoomEnvironment } from '../../lib/addons/RoomEnvironment.js';

const WARM = '#ffc98a', LAMP = '#ffb870', COOL = '#8fa8d8', SODIUM = '#ffae5a';

export function buildLights(H) {
  const s = G.scene; const low = G.settings?.quality === 'low' || /OculusBrowser|Quest/i.test(navigator.userAgent);
  // moonlight + a cool sky fill and a warm bounce from below (wood floors, rugs)
  const hemi = new THREE.HemisphereLight('#3d4c72', '#2a1c12', 0.55); s.add(hemi); H.lights.hemi = hemi;
  const moon = new THREE.DirectionalLight(COOL, 0.55); moon.position.set(-14, 22, -18); moon.target.position.set(0, 0, -3); s.add(moon, moon.target); H.lights.sun = moon;
  moon.castShadow = !!G.settings?.shadows; moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 }); moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.02;
  const mk = (name, color, I, x, y, z, dist = 8, decay = 1.7) => { const l = new THREE.PointLight(color, I, dist, decay); l.position.set(x, y, z); s.add(l); H.lights[name] = l; return l; };
  // living room: dimmed ceiling light, the floor lamp, a table lamp, the tree, the fire (decor.js), the TV glow
  mk('living', WARM, G.settings?.shadows ? 2.4 : 4.2, -2.5, 2.15, -3.3, 8.5);
  if (G.settings?.shadows) { // a soft downlight from the ceiling light that casts real shadows of the family and furniture
    const sp = new THREE.SpotLight(WARM, 9, 9, 1.25, 0.85, 1.6); sp.position.set(-2.5, 2.38, -3.3); sp.target.position.set(-2.5, 0, -3.3); sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0006; sp.shadow.normalBias = 0.02; sp.shadow.radius = 4; s.add(sp, sp.target); H.lights.livingSpot = sp;
    const ks = new THREE.SpotLight('#ffe2bd', 8, 9, 1.2, 0.85, 1.6); ks.position.set(3.9, 2.38, 2.6); ks.target.position.set(3.9, 0, 2.6); ks.castShadow = true; ks.shadow.mapSize.set(1024, 1024); ks.shadow.bias = -0.0006; ks.shadow.normalBias = 0.02; s.add(ks, ks.target); H.lights.kitchenSpot = ks; H.lights.kitchen && (H.lights.kitchen.intensity = 3); }
  mk('lamp', LAMP, 3.0, -1.4, 1.45, -0.85, 5.5);
  if (!low) mk('lamp2', LAMP, 2.0, 0.45, 1.05, -1.8, 4.5);
  mk('tree', '#ffb060', 2.5, -2.47, 1.4, -6.2, 4.5);
  mk('tv', '#8fb0ff', 0.9, -4.6, 1.0, -4.9, 4.5);
  // kitchen: bright for the buffet (pendants over the island + a ceiling light)
  mk('kitchen', '#ffe2bd', G.settings?.shadows ? 3 : 5.5, 3.9, 2.15, 2.6, 9);
  mk('pendants', '#ffcf95', 2.4, 4.0, 1.55, 0.4, 4.5);
  mk('dining', '#ffcf95', 4.0, 3.0, 2.05, -3.3, 7.5);
  mk('hall', '#ffd9a8', 2.6, 0.1, 2.0, 2.9, 6);
  if (!low) { mk('landing', '#ffd9a8', 1.4, -2.1, 4.3, 1.2, 5); mk('toilet', '#fff0dc', 1.4, -2.1, 2.3, 4.6, 3.2); }
  mk('conservatory', '#ffd08a', 1.8, 3.2, 2.3, -7.7, 6);
  mk('garage', '#9aa8d8', 0.12, -5.2, 2.3, 2.5, 7); // the bulb's gone; just a glow from the street through the door
  // outside: porch lantern, patio wall light, two sodium street lamps
  mk('porch', '#ffd890', 2.2, 0.7, 1.9, 6.5, 6);
  mk('patio', '#ffd08a', 3.0, -4.6, 2.25, -6.4, 9);
  mk('street', SODIUM, 9, -5.5, 4.6, 13.2, 16, 1.5);
  if (!low) mk('street2', SODIUM, 9, 8.5, 4.6, 13.2, 16, 1.5);
  H.daylight = 0;
  // subtle reflections for glass, the worktops, the TV screen and baubles
  try { const pm = new THREE.PMREMGenerator(G.renderer); G.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; G.scene.environmentIntensity = 0.18; } catch (e) {}
}
export function setNight() {
  const sky = new THREE.Color('#0d1530'); G.scene.background = sky;
  G.scene.fog = new THREE.Fog('#121a34', 35, 130);
}

export function buildNight(H) {
  const s = G.scene; const rnd = mulberry(77);
  // ---------- sky dome: deep blue with a faint orange town glow at the horizon ----------
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `varying vec3 vp; uniform float t;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){
        vec3 d = normalize(vp); float y = d.y;
        // winter night gradient: inky zenith, deep blue mid-sky, lighter blue towards the horizon
        vec3 zen = vec3(0.010,0.016,0.045), mid = vec3(0.035,0.060,0.150), low = vec3(0.090,0.120,0.240);
        vec3 c = mix(low, mid, smoothstep(0.0, 0.25, y)); c = mix(c, zen, smoothstep(0.25, 0.85, y));
        // sodium glow of the town along the horizon
        c += vec3(0.32,0.16,0.07) * exp(-max(y, 0.0) * 9.0) * 0.8;
        // milky way band
        vec3 ax = normalize(vec3(0.6, 0.35, 0.72)); float band = exp(-pow(dot(d, ax) * 4.5, 2.0));
        vec2 uv = d.xz * 5.0 + d.yy * 3.0; c += vec3(0.07,0.07,0.10) * band * (0.4 + fbm(uv * 1.8)) * smoothstep(0.02, 0.3, y);
        // moon glow
        vec3 md = normalize(vec3(-0.45,0.55,-0.7)); float m = max(0.0, dot(d, md));
        c += vec3(0.10,0.13,0.20) * pow(m, 8.0) + vec3(0.25,0.28,0.35) * pow(m, 90.0);
        // slow moonlit clouds
        vec2 cp = d.xz / (y + 0.35) * 1.3 + vec2(t * 0.004, t * 0.002);
        float cl = smoothstep(0.52, 0.85, fbm(cp)); cl *= smoothstep(0.0, 0.2, y) * (1.0 - smoothstep(0.55, 0.9, y));
        vec3 cloudCol = mix(vec3(0.05,0.06,0.10), vec3(0.20,0.22,0.30), pow(m, 3.0)) + vec3(0.10,0.06,0.03) * exp(-y * 6.0);
        c = mix(c, cloudCol, cl * 0.85);
        // below the horizon: fade into the dark of the land
        c = mix(c, vec3(0.03,0.035,0.06), smoothstep(0.0, -0.08, y));
        gl_FragColor = vec4(c, 1.0); }` });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), skyMat); sky.renderOrder = -10; sky.frustumCulled = false; s.add(sky); H.sky = sky; G.updaters.push((dt) => { skyMat.uniforms.t.value += dt; });
  // stars
  const N = 1800, sp = new Float32Array(N * 3), sc = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const u = rnd(), v = rnd() * 0.95 + 0.05; const th = u * Math.PI * 2, ph = Math.acos(1 - v); const r = 170;
    sp[i * 3] = Math.sin(ph) * Math.cos(th) * r; sp[i * 3 + 1] = Math.cos(ph) * r; sp[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r; const b = 0.4 + rnd() * 0.6; const tint = rnd();
    sc[i * 3] = b * (tint > 0.8 ? 1 : 0.85); sc[i * 3 + 1] = b * 0.9; sc[i * 3 + 2] = b * (tint < 0.3 ? 1.1 : 1); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.0, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false })); stars.renderOrder = -9; s.add(stars); H.stars = stars;
  // the moon (with a soft halo)
  const mc = document.createElement('canvas'); mc.width = mc.height = 256; const g = mc.getContext('2d');
  const halo = g.createRadialGradient(128, 128, 20, 128, 128, 128); halo.addColorStop(0, 'rgba(220,230,255,0.55)'); halo.addColorStop(0.25, 'rgba(160,180,230,0.18)'); halo.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = halo; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#f4f2e6'; g.beginPath(); g.arc(128, 128, 30, 0, 7); g.fill(); g.fillStyle = 'rgba(180,175,160,0.5)'; for (const [x, y, r] of [[118, 120, 7], [138, 135, 5], [125, 142, 4], [140, 116, 3]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  const mt = new THREE.CanvasTexture(mc); mt.colorSpace = THREE.SRGBColorSpace;
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, fog: false, depthWrite: false, transparent: true })); moon.position.set(-0.45, 0.55, -0.7).normalize().multiplyScalar(160); moon.scale.set(34, 34, 1); moon.renderOrder = -8; s.add(moon);
  G.updaters.push(() => { const c = G.camera.getWorldPosition(new THREE.Vector3()); sky.position.copy(c); stars.position.copy(c); moon.position.set(-0.45, 0.55, -0.7).normalize().multiplyScalar(160).add(c); });

  // ---------- ground everywhere (no gaps), side paths, fences down the sides ----------
  const add = (mat, geo) => { const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); s.add(m); return m; };
  const grass = new THREE.MeshStandardMaterial({ map: TX.grass(), roughness: 1, color: '#9ab0a0' });
  add(grass, uvBox(0, -0.1, 0, 120, 0.1, 120, 3));
  const slab = new THREE.MeshStandardMaterial({ map: TX.slabs(), roughness: 0.95 });
  const P = new Prop(), glow = new Prop();
  const fence = (x0, z0, x1, z1, h = 1.8) => { const len = Math.hypot(x1 - x0, z1 - z0); const ang = Math.atan2(x1 - x0, z1 - z0); const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (let t = 0; t < len; t += 0.15) { const x = x0 + (x1 - x0) * t / len, z = z0 + (z1 - z0) * t / len; P.box(0.14, h, 0.02, t % 0.3 < 0.15 ? '#4a3626' : '#523c2a', x, h / 2, z, 0, ang + Math.PI / 2); }
    for (let t = 0; t <= len; t += 1.8) P.box(0.1, h + 0.1, 0.1, '#3a2a1c', x0 + (x1 - x0) * t / len, (h + 0.1) / 2, z0 + (z1 - z0) * t / len);
    staticBox(cx, h / 2, cz, Math.abs(x1 - x0) < 0.01 ? 0.05 : len / 2, h / 2, Math.abs(x1 - x0) < 0.01 ? len / 2 : 0.05); };
  // the front garden is fenced off from the neighbours on both sides
  fence(-7.66, 6.1, -7.66, 12.1); fence(6.62, 6.1, 6.62, 12.1);
  // front garden: low brick wall, gravel, bushes
  const brick = new THREE.MeshStandardMaterial({ map: TX.brick(), roughness: 1 });
  add(brick, mergeGeometries([uvBox(-2.1, 0.35, 12.2, 2.8, 0.7, 0.25, 1.5), uvBox(3.65, 0.35, 12.2, 5.9, 0.7, 0.25, 1.5)].map(x => x.toNonIndexed())));
  staticBox(-2.1, 0.35, 12.2, 1.4, 0.35, 0.13); staticBox(3.65, 0.35, 12.2, 2.95, 0.35, 0.13);
  P.box(2.8, 0.06, 0.32, '#8a8278', -2.1, 0.73, 12.2).box(5.9, 0.06, 0.32, '#8a8278', 3.65, 0.73, 12.2).box(0.4, 0.9, 0.4, '#a85a3a', -3.6, 0.45, 12.2).box(0.4, 0.9, 0.4, '#a85a3a', -7.5, 0.45, 12.2);

  // ---------- the street: pavement, road, kerbs, lamps, parked cars ----------
  const tar = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.85, metalness: 0.05 });
  add(new THREE.MeshStandardMaterial({ map: TX.slabs(), roughness: 0.95, color: '#a8a8a8' }), uvBox(0, -0.02, 13.6, 120, 0.06, 2.6, 1.2));
  add(tar, uvBox(0, -0.04, 19.4, 120, 0.06, 9, 4));
  add(new THREE.MeshStandardMaterial({ map: TX.slabs(), roughness: 0.95, color: '#a8a8a8' }), uvBox(0, -0.02, 25.2, 120, 0.06, 2.6, 1.2));
  for (let x = -58; x < 60; x += 4) P.box(2.0, 0.005, 0.12, '#d8d8d0', x, 0.0, 19.4);
  P.box(120, 0.12, 0.15, '#9a9a96', 0, 0.03, 14.95).box(120, 0.12, 0.15, '#9a9a96', 0, 0.03, 23.85);
  const lamp = (x, z, face) => { P.cyl(0.07, 0.1, 4.6, '#2a2c30', x, 2.3, z, 0, 0, 0, 10).box(0.06, 0.06, 0.9, '#2a2c30', x, 4.6, z + face * 0.4).box(0.32, 0.12, 0.5, '#2a2c30', x, 4.55, z + face * 0.85);
    glow.box(0.26, 0.03, 0.42, '#ffcf8a', x, 4.48, z + face * 0.85); };
  lamp(-5.5, 14.4, -1); lamp(8.5, 14.4, -1); lamp(-30, 14.4, -1); lamp(30, 14.4, -1); lamp(-12, 24.4, 1); lamp(16, 24.4, 1); lamp(40, 24.4, 1);
  for (const [x, z, c, r] of [[-3, 17.0, '#7a1f24', 0], [12, 21.8, '#2a3a5a', Math.PI], [-20, 17.0, '#c0c0c0', 0], [25, 17.0, '#1a1a1a', 0]]) {
    P.rbox(4.2, 0.7, 1.8, 0.2, c, x, 0.55, z, 0, r + Math.PI / 2).rbox(2.2, 0.55, 1.6, 0.2, c, x - 0.2, 1.1, z, 0, r + Math.PI / 2).box(1.5, 0.4, 0.02, '#1a2230', x - 0.2, 1.12, z + 0.81, 0, r + Math.PI / 2);
    for (const sx of [-1.35, 1.35]) for (const sz of [-0.82, 0.82]) P.cyl(0.33, 0.33, 0.22, '#111', x + sx, 0.33, z + sz, Math.PI / 2, 0, 0, 14);
    glow.box(0.02, 0.1, 0.3, '#ff2020', x - 2.1, 0.62, z + 0.6).box(0.02, 0.1, 0.3, '#ff2020', x - 2.1, 0.62, z - 0.6); }
  // the drive: Martin's car with frost on the windscreen
  P.rbox(1.8, 0.7, 4.2, 0.2, '#3a3a3e', -5.3, 0.55, 9.3).rbox(1.6, 0.55, 2.2, 0.2, '#3a3a3e', -5.3, 1.1, 9.1).box(1.5, 0.45, 0.02, '#c8d8e8', -5.3, 1.12, 10.22, -0.5);
  for (const sx of [-0.82, 0.82]) for (const sz of [-1.35, 1.35]) P.cyl(0.33, 0.33, 0.22, '#111', -5.3 + sx, 0.33, 9.3 + sz, 0, 0, Math.PI / 2, 14);
  staticBox(-5.3, 0.7, 9.3, 0.9, 0.7, 2.1);

  // ---------- the neighbours (with their own Christmas lights) ----------
  const bulbs = { data: [] };
  const house = (cx, cz, face, w = 9, d = 9, col = '#b86a4a', lights = 'warm') => {
    const h = 5.2, roofH = 2.6; const bmat = new THREE.MeshStandardMaterial({ map: TX.brick(), roughness: 1, color: col });
    add(bmat, uvBox(cx, h / 2, cz, w, h, d, 1.5)); P.box(w + 0.6, 0.15, d + 0.6, '#2a2220', cx, h, cz);
    const sh = new THREE.Shape(); sh.moveTo(-d / 2 - 0.3, 0); sh.lineTo(d / 2 + 0.3, 0); sh.lineTo(0, roofH); sh.closePath();
    const rg = new THREE.ExtrudeGeometry(sh, { depth: w + 0.6, bevelEnabled: false }); rg.rotateY(Math.PI / 2); rg.translate(cx - w / 2 - 0.3, h, cz); add(new THREE.MeshStandardMaterial({ color: '#3a302c', roughness: 0.9 }), rg);
    // windows facing the street/us: some lit warm, some blue TV glow, some dark; a front door with a wreath
    const fz = cz + face * (d / 2 + 0.02);
    for (const [x, y] of [[-2.4, 1.3], [2.4, 1.3], [-2.4, 3.8], [0, 3.8], [2.4, 3.8]]) { const r = rnd(); glow.box(1.2, 1.1, 0.02, r < 0.45 ? '#ffc477' : r < 0.6 ? '#5a7ad8' : r < 0.75 ? '#ff9a5a' : '#141826', cx + x, y, fz); P.box(1.3, 0.06, 0.06, '#e8e8e8', cx + x, y - 0.58, fz + face * 0.02).box(0.05, 1.1, 0.05, '#e8e8e8', cx + x, y, fz + face * 0.02); }
    P.box(0.9, 2.0, 0.06, pick(['#1d3557', '#2d4a2a', '#5a1a1a', '#222']), cx, 1.0, fz + face * 0.02).torus(0.17, 0.05, '#1f5a2a', cx, 1.55, fz + face * 0.06);
    // their outdoor lights along the eaves
    const cols = lights === 'warm' ? ['#ffcf70', '#ffe0a0'] : lights === 'icy' ? ['#cfe8ff', '#ffffff', '#8fc8ff'] : ['#ff3b3b', '#3bff7a', '#3bb8ff', '#ffd23f'];
    for (let i = 0; i <= 26; i++) { const x = cx - w / 2 + i * w / 26; bulbs.data.push([x, h - 0.15 - Math.sin(i * 0.9) * 0.06, fz + face * 0.15, pick(cols)]); }
    staticBox(cx, h / 2, cz, w / 2, h / 2, d / 2);
  };
  house(-21, -1, 1, 10, 11, '#a86848', 'warm'); house(22, -1, 1, 10, 11, '#9a5a40', 'multi');
  house(-24, 33, -1, 10, 9, '#c88a6a', 'icy'); house(-8, 33, -1, 10, 9, '#a86848', 'multi'); house(8, 33, -1, 10, 9, '#b8805a', 'warm'); house(24, 33, -1, 10, 9, '#9a6040', 'icy');
  // a neighbour's inflatable snowman and a light-up star in a window
  P.sph(0.7, '#f4f4f4', 6, 0.7, 29.5, 1, 1, 1, 12).sph(0.45, '#f4f4f4', 6, 1.75, 29.5, 1, 1, 1, 12).cyl(0.3, 0.3, 0.4, '#111', 6, 2.35, 29.5).cone(0.06, 0.3, '#f77f00', 6, 1.8, 29.05, -Math.PI / 2, 0, 0, 8);
  // trees silhouetted against the sky all round
  const tree = (x, z, h) => { P.cyl(0.18, 0.25, h * 0.45, '#2a1e14', x, h * 0.22, z, 0, 0, 0, 8); P.sph(h * 0.3, '#16261a', x, h * 0.62, z, 1, 1.2, 1, 9).sph(h * 0.22, '#1a2c1e', x + h * 0.12, h * 0.78, z - h * 0.05, 1, 1, 1, 8); };
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; const r = 42 + rnd() * 14; tree(Math.cos(a) * r, Math.sin(a) * r - 2, 7 + rnd() * 6); }
  for (const [x, z] of [[-15, -20], [-4, -24], [6, -23], [17, -21], [-13, 7], [15, 8]]) tree(x, z, 8 + rnd() * 3);

  const pm = new THREE.Mesh(P.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })); pm.receiveShadow = pm.castShadow = true; pm.matrixAutoUpdate = false; pm.updateMatrix(); s.add(pm);
  const gm = new THREE.Mesh(glow.build(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })); gm.matrixAutoUpdate = false; gm.updateMatrix(); s.add(gm);
  const bd = bulbs.data; const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ toneMapped: false }), bd.length); const m4 = new THREE.Matrix4(); const c = new THREE.Color();
  bd.forEach(([x, y, z, col], i) => { m4.makeTranslation(x, y, z); bm.setMatrixAt(i, m4); bm.setColorAt(i, c.set(col)); }); bm.frustumCulled = false; s.add(bm);
  G.updaters.push(() => { if (G.frame % 10) return; bd.forEach(([, , , col], i) => bm.setColorAt(i, c.set(col).multiplyScalar(0.6 + 0.6 * Math.max(0, Math.sin(G.time * 1.7 + i * 0.9))))); bm.instanceColor.needsUpdate = true;
    const t = G.house.lights.tv; if (t && !G.systems?.tvOff && !G.systems?.powerOut) t.intensity = 0.8 + Math.sin(G.time * 9) * 0.15 + Math.sin(G.time * 2.3) * 0.2; });
}
