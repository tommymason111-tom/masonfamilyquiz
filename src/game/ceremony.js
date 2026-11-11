// The Mason Cup ceremony: final scores, recount, cup presented (to Julie's team first, "by mistake"),
// confetti cannons, Replay of the Night, individual awards, team photo, the plaque, and "same time next year".
import * as THREE from 'three';
import { G, on, emit, rand, pick } from '../core.js';
import { sfx, playMusic, stopMusic } from '../engine/audio.js';
import { tvFrame, wrapText } from './screens.js';
import { loadStore, saveStore } from './settings.js';
import { canvasTex } from '../engine/textures.js';
import { OUTFITS, TEAM_IDS } from '../chars/cast.js';

export class Ceremony {
  constructor() { G.ceremony = this; this.buildPlaque(); }
  buildPlaque() {
    // past winners board on the chimney breast, above the mantel (the cup "stays won" between playthroughs)
    const winners = loadStore('winners', [{ year: 2025, team: 'Team Julie', note: '(disputed)' }]);
    const tex = canvasTex(512, 320, (g) => {
      g.fillStyle = '#2a1a10'; g.fillRect(0, 0, 512, 320); g.strokeStyle = '#d4af37'; g.lineWidth = 8; g.strokeRect(6, 6, 500, 308);
      g.fillStyle = '#d4af37'; g.font = 'bold 34px Georgia'; g.fillText('THE MASON CUP', 120, 50); g.font = '22px Georgia'; g.fillText('Roll of honour', 185, 80);
      g.fillStyle = '#f4ecd8'; g.font = '24px Georgia'; winners.slice(-7).forEach((w, i) => g.fillText(`${w.year}  ${w.team} ${w.note || ''}`, 40, 120 + i * 28));
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.375), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    m.position.set(0.78, 1.65, -3.5); m.rotation.y = -Math.PI / 2; G.scene.add(m); this.plaque = m;
  }
  run(winner) {
    const q = G.quiz; q.phase = 'ceremony'; const name = q.teamName(winner);
    const cup = G.items.byType.mason_cup?.[0];
    // everyone gathers in front of the tree
    const spots = [[-1.2, -5.6], [-0.6, -5.8], [0, -5.9], [0.6, -5.8], [1.2, -5.6], [-0.9, -5.0], [0.9, -5.0], [-1.6, -4.8], [1.6, -4.8], [0, -4.8], [-0.4, -4.4], [0.4, -4.4], [-1.2, -4.2], [1.2, -4.2], [-2.0, -5.2], [2.0, -5.2], [0, -5.2]].map(([x, z]) => [x - 2.7, z + 0.35]);
    let i = 0; for (const p of G.chars) { if (p.isPlayer || p.protected || !p.brain) continue; const s = spots[i++ % spots.length]; G.ai.sendTo(p.name, new THREE.Vector3(s[0], 0, s[1]), () => { p.brain.state = 'scripted'; p.brain.timer = 9999; p.base = 'stand'; p.yaw = 0; }); }
    sfx('drum', null, 1);
    G.screens.setTV((g, W, H) => { tvFrame(g, W, H, 'THE MASON CUP'); g.fillStyle = '#ffd700'; g.font = 'bold 60px Georgia'; g.fillText(name.toUpperCase(), 60, 220); g.fillStyle = '#fff'; g.font = '30px sans-serif'; g.fillText('WIN THE MASON CUP ' + new Date().getFullYear(), 60, 290); q.drawBigScores?.call(q, g, W, H); });
    q.mSay(`Congratulations, ${name}. Come and get the cup. It's heavy, mind — two hands.`, 2);
    if (cup) { G.ui?.toast('Lift the Mason Cup over your head (two hands — or grab + look up)!', 6); }
    // confetti cannons
    setTimeout(() => { sfx('pop', null, 1); sfx('cheer', null, 1); for (let k = 0; k < 50; k++) { const c = G.items.spawn('confetti', new THREE.Vector3(rand(-2, 2), 2.3, rand(-6, -3)), null); c?.body.setLinvel({ x: rand(-1, 1), y: rand(-1, 0.5), z: rand(-1, 1) }, true); }
      for (const p of G.chars) if (p.team === winner && !p.isPlayer && !p.protected) { p.gesture = 'cheer'; } if (winner !== 'paul') G.charByName.Paul?.say('Rematch. RIGHT NOW. Best of three.'); else G.charByName.Paul?.say('GET IN! Who\'s the quizmaster now, Martin?!'); }, 3000);
    // the turkey falls off the cup during the presentation; Chip runs off with it
    setTimeout(() => { if (cup) { const t = cup.body.translation(); const tk = G.items.spawn('cup_turkey', new THREE.Vector3(t.x, t.y + 0.3, t.z), null); tk?.body.setLinvel({ x: 0.5, y: 1, z: 0.5 }, true); G.ui?.toast('The little turkey has fallen off the Mason Cup. Chip has it.', 4); G.dog?.goTo(new THREE.Vector3(t.x, 0, t.z), 3); } }, 9000);
    // losers' prizes
    setTimeout(() => { const lose = TEAM_IDS.slice().sort((a, b) => q.total(a) - q.total(b))[0]; G.items.spawn('wooden_spoon_prize', new THREE.Vector3(-1.5, 0.6, -3.6), null); G.items.spawn('certificate', new THREE.Vector3(-1.3, 0.6, -3.6), null); G.ui?.toast(`Wooden spoon and a gravy-stained certificate for ${q.teamName(lose)}.`, 4); }, 12000);
    // Replay of the Night on the TV, then awards
    setTimeout(() => { q.mSay('And now... the Replay of the Night.', 2); G.replay.playHighlights(() => this.awards(winner)); }, 15000);
    // record the win
    const winners = loadStore('winners', [{ year: 2025, team: 'Team Julie', note: '(disputed)' }]); winners.push({ year: new Date().getFullYear(), team: name, note: winner === (G.myTeam || 'paul') ? `(${G.me?.name || 'Tommy'}, captain)` : '' }); saveStore('winners', winners);
    // unlock outfits by winning
    if (winner === (G.myTeam || 'paul')) { const un = loadStore('unlockedOutfits', OUTFITS.map(o => o.id)); saveStore('unlockedOutfits', un); saveStore('pickNextOutfit', true); }
  }
  awards(winner) {
    const q = G.quiz, s = G.systems, pl = G.player;
    const list = [
      ['Mason Cup', q.teamName(winner)],
      ['Argued Against Reality (Paul)', `${q.stats.argued} times`],
      ['Told You So (Charli)', `${q.stats.toldYou} all-time`],
      ['Gary\'s Dignity Medal', `${Math.round(s.dignity)}/100 in the ${G.garyOutfit.label.split(' (')[0].toLowerCase()}`],
      ['Coaster Queen (Julie)', `${s.stats.coaster} warnings`],
      ['Best Throw', `${(s.bestThrow || 0).toFixed(1)}/10`],
      ['Chip\'s Good Boy Rosette', `${s.stats.chipStole} things stolen`],
      ['Biased Rulings (Martin)', `${q.stats.biased}`],
      ['Your throws / disputes won / answers changed in secret', `${pl.stats.throws} / ${q.stats.disputesWon} / ${q.stats.changed}`],
      ['Mason: things thrown / hidden / TV hits', `${s.stats.kidsThrows} / ${s.stats.hidden} / ${s.stats.tvHits}`],
      ['Baby Ceasefires (Harrison)', `${s.stats.ceasefires}`],
      ['Dan\'s jokes landed', `${s.stats.jokes}`],
    ];
    G.screens.setTV((g, W, H) => { tvFrame(g, W, H, 'FAMILY AWARDS'); g.font = '22px sans-serif'; list.forEach(([a, b], i) => { g.fillStyle = '#ffd700'; g.fillText(a, 40, 110 + i * 36); g.fillStyle = '#fff'; g.fillText(b, 640, 110 + i * 36); }); });
    G.ui?.showAwards(list);
    q.phase = 'end';
    setTimeout(() => this.credits(), 25000);
  }
  credits() {
    // "Same time next year": everyone in the hallway hunting for their shoes
    let i = 0; for (const p of G.chars) { if (p.isPlayer || !p.brain) continue; const z = 2.5 + (i % 6) * 0.45, x = -0.6 + Math.floor(i / 6) * 0.6; i++; G.ai.sendTo(p.name, new THREE.Vector3(x, 0, z), () => { p.gesture = 'tidy'; p.brain.state = 'scripted'; p.brain.timer = 9999; }); }
    G.ui?.toast('Same time next year. Everyone is in the hallway hunting for their shoes under the shoe pile.', 8);
    G.screens.setTV((g, W, H) => { tvFrame(g, W, H, 'SAME TIME NEXT YEAR'); g.fillStyle = '#fff'; g.font = '28px sans-serif'; wrapText(g, 'Thanks for coming to the Mason Family Boxing Day Quiz. Martin will now refuse to accept the result until March. Press NEXT to play again (pick Gary\'s outfit for next year in Settings).', 60, 160, 900, 40); });
  }
}
