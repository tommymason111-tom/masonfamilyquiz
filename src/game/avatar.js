// Who you play as. Anyone in the family (or Chip): the old "you" becomes an AI relative again, the new one loses
// their physics body and follows the player controller, the camera drops to their eye height, and your team is theirs.
// Playing Martin makes Julie the quizmaster. Chip, Mason and Harrison just roam the house at their own height.
import * as THREE from 'three';
import { G } from '../core.js';

export const FAMILIES = [
  { id: 'martin', name: 'The Masons', sub: "Martin's family", people: ['Martin', 'Julie', 'Hollie', 'Dan', 'Sophie', 'James', 'Bradley', 'Harrison', 'Chip'] },
  { id: 'paul', name: 'The Masons', sub: "Paul's family", people: ['Paul', 'Karen', 'Tommy', 'Charli'] },
  { id: 'debbie', name: 'The Hoopers', sub: "Debbie's family", people: ['Debbie', 'Gary', 'Kirsty', 'Jodie', 'Harry', 'Mason'] },
];
export const ROAMERS = ['Chip', 'Mason', 'Harrison']; // no game mode: just roam and cause trouble

export function setAvatar(name) {
  const pl = G.player; const prevMe = G.me;
  // whoever was you goes back to being a relative
  for (const c of G.chars) if (c.isPlayer && c.name !== name) { c.setPlayer(false); G.ai?.setPlayer(c, false); }
  if (G.dog) G.dog.playerControlled = false;
  if (name === 'Chip' && G.dog) {
    G.dog.playerControlled = true; G.dog.isPlayer = true; G.me = G.dog; G.tommy = null; G.myTeam = null;
    pl.eyeH = 0.52; pl.small = true; pl.teleport(-2.2, -1.3, 0.67); G.dog.pos.set(-2.2, 0, -1.3); // middle of the living room, facing everyone
  } else {
    const p = G.charByName[name] || G.charByName.Tommy; G.ai?.setPlayer(p, true); p.setPlayer(true); G.tommy = p; G.me = p;
    if (p.name === 'Martin') { p.team = 'julie'; const j = G.charByName.Julie; if (j) j.team = 'host'; }
    G.myTeam = p.team === 'host' ? 'julie' : p.team;
    pl.eyeH = Math.max(0.55, p.H * 0.93); pl.small = p.H < 1.3;
    const h = G.ai?.plan?.[p.name]; const at = p.pos.lengthSq() < 0.01 && h ? h.pos.clone().add(h.stand ? new THREE.Vector3() : new THREE.Vector3(Math.sin(h.yaw) * 0.7, 0, Math.cos(h.yaw) * 0.7)) : p.pos; // Tommy has never been placed: use his planned spot
    pl.teleport(at.x, at.z, (p.pos.lengthSq() < 0.01 && h ? h.yaw : p.yaw) + Math.PI);
    if (p.name === 'Harrison' && G.ai) { G.ai.harrison = null; p.base = 'stand'; }
  }
  G.quiz?.jokers && (G.quiz.jokers = Object.fromEntries(Object.keys(G.quiz.jokers).map(t => [t, t === G.myTeam ? null : G.quiz.jokers[t] ?? 2])));
  document.body.classList.toggle('as-dog', name === 'Chip');
  document.body.classList.toggle('as-little', name === 'Mason' || name === 'Harrison');
  G.ui?.buildTouch?.(true);
  return G.me;
}
