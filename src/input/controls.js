// Flat-screen input: keyboard + mouse (pointer lock), gamepad, and touch (joystick + buttons from the UI).
// Produces one input frame the Player reads. Buttons: {down, pressed, released}.
import { G, emit } from '../core.js';

const BTN = ['grab', 'throw', 'punch', 'kick', 'use', 'handUp', 'drink', 'jump', 'crouch', 'menu', 'score', 'accuse', 'torch', 'view', 'a1', 'a2', 'a3', 'a4', 'joker', 'next'];
export class Controls {
  constructor() {
    this.state = Object.fromEntries(BTN.map(b => [b, { down: false, pressed: false, released: false }]));
    this.move = { x: 0, z: 0, run: false }; this.look = { x: 0, y: 0 };
    this.touchMove = { x: 0, z: 0 }; this.touchLook = { x: 0, y: 0 };
    this.wheel = 0; this.locked = false; this.keys = new Set();
    const canvas = G.renderer.domElement;
    const keymap = { KeyF: 'punch', KeyE: 'kick', KeyR: 'use', KeyQ: 'handUp', KeyG: 'drink', Space: 'jump', KeyC: 'crouch', Escape: 'menu', Tab: 'score', KeyX: 'accuse', KeyT: 'torch', KeyV: 'view', Digit1: 'a1', Digit2: 'a2', Digit3: 'a3', Digit4: 'a4', KeyJ: 'joker', KeyN: 'next', Enter: 'next' };
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys.add(e.code); const b = keymap[e.code]; if (b) { this.set(b, true); if (e.code === 'Tab' || e.code === 'Space') e.preventDefault(); }
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); const b = keymap[e.code]; if (b) this.set(b, false); });
    canvas.addEventListener('mousedown', (e) => {
      if (G.xr) return;
      if (G.ui?.touchMode) return; // phones: taps are handled by the UI (tap a person to knock them over)
      // the click that captures the mouse only captures it — it never grabs whatever you happen to be looking at
      if (!this.locked) { canvas.requestPointerLock?.(); return; }
      if (e.button === 0) this.set('grab', true); if (e.button === 2) this.set('throw', true);
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.set('grab', false); if (e.button === 2) this.set('throw', false); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => { if (this.locked) { const s = 0.0022 * (G.settings.mouseSens || 1); this.look.x += e.movementX * s; this.look.y += e.movementY * s * (G.settings.invertY ? -1 : 1); } });
    addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; emit('pointerlock', this.locked); });
    this.prevPad = {};
  }
  set(b, v) { const s = this.state[b]; if (!s) return; if (v && !s.down) s.pressed = true; if (!v && s.down) s.released = true; s.down = v; }
  btn(b) { return this.state[b]; }
  poll() {
    // keyboard movement
    const k = this.keys; let x = 0, z = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) z += 1; if (k.has('KeyS') || k.has('ArrowDown')) z -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1; if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    this.move.x = x + this.touchMove.x; this.move.z = z + this.touchMove.z; this.move.run = k.has('ShiftLeft') || k.has('ShiftRight') || Math.hypot(this.touchMove.x, this.touchMove.z) > 0.95;
    this.look.x += this.touchLook.x; this.look.y += this.touchLook.y; this.touchLook.x = this.touchLook.y = 0;
    // gamepad (standard mapping): LS move, RS look, RT grab (flick release = throw), X punch, B kick, A use, Y hand up, LB drink, Start menu
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || p.mapping !== 'standard' || G.xr) continue;
      const dz = (v) => Math.abs(v) < 0.15 ? 0 : v;
      this.move.x += dz(p.axes[0]); this.move.z -= dz(p.axes[1]);
      if (Math.hypot(p.axes[0], p.axes[1]) > 0.95) this.move.run = true;
      this.look.x += dz(p.axes[2]) * 0.05; this.look.y += dz(p.axes[3]) * 0.04 * (G.settings.invertY ? -1 : 1);
      const map = { 7: 'grab', 2: 'punch', 1: 'kick', 0: 'use', 3: 'handUp', 4: 'drink', 9: 'menu', 8: 'score', 10: 'jump', 11: 'crouch', 5: 'throw', 12: 'a1', 13: 'a3', 14: 'a4', 15: 'a2' };
      for (const i in map) { const pressed = p.buttons[i]?.pressed || (i == 7 && p.buttons[7]?.value > 0.5); const key = p.index + ':' + i; if (pressed !== !!this.prevPad[key]) this.set(map[i], pressed); this.prevPad[key] = pressed; }
      // trigger flick to throw: right-stick flick up while releasing grab
      this.padFlick = dz(p.axes[3]) < -0.7;
    }
    const m = Math.hypot(this.move.x, this.move.z); if (m > 1) { this.move.x /= m; this.move.z /= m; }
  }
  endFrame() { for (const b of BTN) { this.state[b].pressed = false; this.state[b].released = false; } this.look.x = this.look.y = 0; this.wheel = 0; }
}
