// Persisted settings (per device). Wrapped in try/catch: private windows can throw on storage.
const KEY = 'masonQuiz.settings.v1';
export const DEFAULTS = {
  voices: true, subtitles: true, sfxVol: 1, voiceVol: 1, softDrinks: false, drunkSway: true, shadows: false, quality: 'high',
  seated: false, smoothTurn: false, leftHanded: false, snapAngle: 30, questionsPerRound: 6, thirdPerson: false,
  touchLayout: null, touchScale: 1, touchOpacity: 0.55, mouseSens: 1, invertY: false, garyOutfit: 'random', difficulty: 'normal',
};
export function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  const out = { ...DEFAULTS, ...s };
  if (s.shadows === undefined) out.shadows = !(/OculusBrowser|Quest|Android|iPhone|iPad/i.test(navigator.userAgent) || matchMedia('(pointer: coarse)').matches);
  return out;
}
export function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
export function loadStore(key, def) { try { const v = localStorage.getItem('masonQuiz.' + key); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
export function saveStore(key, v) { try { localStorage.setItem('masonQuiz.' + key, JSON.stringify(v)); } catch (e) {} }
