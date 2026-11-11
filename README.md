# The Mason Family Boxing Day Quiz 🎄

A physics comedy party game for **Meta Quest 3** (WebXR, hand tracking) that also plays on **PC, iPad, phone and gamepad**.
You are Tommy, arriving at Uncle Martin's on Boxing Day for the annual quiz. Win it for Team Paul, survive the
mini-games, stop Dad taking the banter too far, keep Auntie Debbie from walking out — or throw Uncle Gary into the tree.

Built to the design doc *The Mason Family Boxing Day Quiz* (same no-PC WebXR route as Ronnie Simulator and Lewis Simulator):
Three.js + Rapier physics, everything procedural, no build step.

## Play it

It's a static website. Host the folder anywhere that serves HTTPS (GitHub Pages works):

1. Repo **Settings → Pages → Deploy from branch → `main` / root**.
2. Open the Pages URL on the Quest 3 browser and press **Enter VR**, or on any other device press **Play on this screen**.

Local test: `python3 -m http.server 8000` in this folder, then open `http://localhost:8000`.
(WebXR needs HTTPS or localhost.)

## What's in it

- **19 people + Chip the dog.** Semi-realistic, mid-to-high poly (~15–25k triangles each, ~370k for the whole family),
  built procedurally per the appearance chart: heights (every man taller than every woman), three builds (Paul, Martin and
  Gary are 15–20% broader), sculpted faces with jaw, eye sockets, brow, cheekbones, nose, ears and lips, stubble painted
  into the skin at three densities (grey for Gary), long hair as layered hair cards over a hair mass (blonde roots darker,
  tips lighter; James's tuck-behind-the-ear hair), knitted jumper patterns (Paul's reindeer with a
  light-up nose, fair isle, snowflake, sparkly, hoodie, quarter-zip…), festive socks (it's a no-shoes house).
- **Face rig:** jaw (lip-sync while talking), blinking eyelids, eyes that track whoever is talking (or you), brows for
  surprise/anger, laughing squint, asleep. Hair sways with a spring.
- **Active ragdolls (Gang Beasts style):** each adult is 11 Rapier rigid bodies with joints and PD "muscles". Grab a
  collar, wrist or ankle and they go floppy; they wobble, try to get up, stagger with cartoon stars, then carry on.
  Heavy class (Paul, Martin, Gary) needs a two-hand lift in VR. Flying relatives knock others over (pile-ups).
  Mason (3), Harrison (1) and Chip can't be grabbed or hit — things bounce off them. People only fall over (and
  comic WHACK pop-ups only appear) when YOU hit, throw or grab them — bumping into furniture on their own never floors them.
- **Martin's ground floor, built to the family's floor plan** (plan pixels → metres, 90 px = 1 m; see `PX`/`PZ` in
  `src/world/house.js`): hallway from the front door, bathroom (basin + toilet) and the stairs (three steps up to a quarter
  landing, then the flight up to a closed-off upstairs landing) on the left with a cupboard beside them, the under-stairs
  cupboard leading through to the garage (fridge, chest freezer with the beer by it, broken light, and an open side door out to the patio), the kitchen on the right (a little wider than the plan, as a single-storey extension: breakfast bar with stools beside the fridge
  top-right, worktop down the side with the hob, sink under the front window), the living room at the top of the hall
  (TV in the corner, fireplace on the left wall, the tree in the bay window, L-shaped sofa, sofa along the bottom wall,
  round coffee table on the rug and Martin's armchair), the dining room through the door beside it (table for six,
  sideboard, plants, the desk with the PC), the conservatory through the walkway (sofa, TV, door out to the patio), the
  L-shaped patio round the back (BBQ, table with eight chairs) and the lawn with a hedge all round. Open doorways
  between rooms, fridge doors with lights, freezer lid, toilet lid, stair gate — all physical.
- **~170 item types / ~260 physical objects.** Small things are grabbable; heavy furniture (sofas, the tree, tables,
  Martin's armchair, appliances, the hoover, wheelbarrow…) stays put. The house is useful: sit on any free seat
  (R / USE), light switches in each room, fill a glass at the kitchen tap, make a tea with the kettle (leave a mug
  next to it). Everyday things: the full buffet (sausage rolls, pigs in blankets,
  cold turkey, cheeseboard + throwable Brie that sticks to windows, Scotch eggs that roll, pork pie, trifle, pudding,
  mince pies…), drinks (lager, cider, bitter, Prosecco with a cork that fires at Martin, wine, Baileys, squash…),
  crackers, crowns, baubles, presents, toys, Duplo, cushions, coasters, the TV remote, kitchen kit, garage junk, garden
  furniture, mini-game props.
- **Gary's outfit of the year** (random each game, or pick one in the menu): mankini, Christmas fairy (wings, wand, tutu), Minion, Smurf, Father Christmas, Elf on the Shelf. The costume is painted onto his real scan from the neck down (keeping the scan's folds and shading), plus hats/wings/wand where needed — his face is never changed, so it's always recognisably Gary.
- **Teams:** Martin hosts. Team Paul — Tommy (you), Charli, Paul, Karen · Team Julie — Sophie, James, Julie ·
  Team Debbie — Debbie, Gary, Jodie, Harry, Mason · Team Hollie — Hollie, Dan, Kirsty, Bradley, Harrison. Chip isn't on
  a team; he's just chaos. Name tags show only the name, edged in the team colour.
- **Jobs in the banter:** Dan's a teacher, Kirsty works in a nursery, Sophie edits films, Martin promotes them.
- **Where everyone is:** living room — Paul (who does the rounds between his family, Martin and Debbie), Karen, Charli, Martin (armchair), Debbie, Kirsty, Gary, Mason;
  kitchen — Julie, Jodie, Hollie & Dan; dining room — Sophie & James, Harry; Bradley (with Harrison) joins Hollie & Dan by the kitchen bar.
- **The quiz:** five rounds (Sport, Telly/Film/Music, News & Nonsense, Picture round drawn on the TV, the Family Round),
  Martin reads from the armchair, Charli whispers the right answer, Paul overrules you (stop him with a mince pie, a
  cushion or a shove), sheets swapped and marked by Team Julie (harshly — Martin hosts and Julie's his wife), the Dispute Wheel (Allow / Half / Deny /
  Google it / Ask Karen), the answer-sheet heist (don't let Debbie see), jokers, Host Points, TV and PC scoreboards that
  disagree by 2, tie-break, the Mason Cup ceremony, awards, and a roll of honour that persists between games.
- **Systems from the doc:** Sibling Banter Meter (fairy lights on the ceiling; Debbie storms out on red; Sibling
  Showdown), Havoc Meter (Mason throws at the TV/whoever's talking/Paul, steals and hides things; Harrison throws rusks
  and sippy cups; Baby Ceasefire), Chip (zoomies, steals food, drops his squeaky toy in your lap, jumps at the TV,
  barks at Gary, lies on the answer sheets), Gary's Outfit Wheel (10 outfits with physics quirks), the Chaos Director
  (24 events: fuse trips, PC blue-screens, dead pens, beer run, pudding fire + smoke alarm, Siri betrayal…),
  drink orders, coaster warnings, 8pm night-time lighting (moon, street lamps, the neighbours' lights), TV damage (crack, wobble, unplugged).
- **MASON TV REPLAY:** the last 15 seconds of every moving thing are recorded (positions, not video) and replayed on
  Martin's TV from the corner camera — slow-mo, second angle, score out of 10, VAR, and the Replay of the Night.
- **Mini-games:** Sprout Pong, Cracker Pull Duel, Pass the Parcel, Stack the Celebrations, Gift Grab.

## Game modes

Pick one on the home screen (or Menu → Change game mode). Personal bests are saved on each device.

| Mode | What it is |
|---|---|
| 🏆 The Boxing Day Quiz | The full night: 5 rounds, marking, disputes, mini-games, the Mason Cup |
| ⚡ Quick Quiz | Two rounds, no mini-games, straight to the cup (~10 min) |
| 💥 Family Chaos | 3 minutes to punch, kick, throw and pile up the relatives; chained hits build a combo (up to x5); a chaos event every ~15 s |
| 🚀 Fling the Family | 10 throws, each scored for distance/height (out of 10) plus bonuses for pile-ups, window splats and TV hits |
| 🍺 Beer Run | 3 minutes of drink orders; right drink to the right person before they give up; the fridges restock |
| 🔍 Mason's Hide & Seek | Find 6 things Mason hid around the house and garden in 4 minutes (sparkle hints after a minute) |
| 🎲 Games Room Marathon | All five mini-games back to back |
| 🎄 Free Roam | No quiz, no timer |

## Real family models

The 15 family members and Chip are the real 3D scans in `assets/models/` (decimated from ~480k to 22k triangles each,
with the colour re-baked from the originals so they still look the same; 256 MB -> 15 MB). They're auto-rigged at
load time onto the ragdoll skeleton (`src/chars/glbrig.js`), so they fall, get thrown and get up exactly like
everyone else. Mason and Harrison (no scans yet) use the procedural models. Chip runs on his own dog skeleton
(`src/chars/dogrig.js`) with walk/trot/gallop gaits and carries things crosswise in his jaws.

## Controls

| | |
|---|---|
| **Quest 3 hands** | fist = grab (both fists on a heavy relative), swing + open = throw, fast fist = punch, pinch = use/write, left pinch-drag = walk, right pinch-drag = turn, palm up = wrist menu (poke buttons), hand above head = challenge, point 1 s = accuse, thumbs up/down, clap, cover ears = mute 3 s, facepalm = eye-roll, food to mouth = eat/drink, palm-down sweep low or stamp = kick |
| **Quest controllers** | grip = grab, trigger = use, left stick move, right stick snap/smooth turn, A = hand up, B = drink, X = kick, Y = menu |
| **PC** | WASD, mouse look, LMB grab/drop, hold RMB + release = throw (power bar), F punch, E kick, R use/give/talk, G eat/drink, Q hand up, X accuse, 1–4 answer, J joker, T torch, Space jump, C crouch, V third person, Tab scores, Enter next, Esc menu |
| **Gamepad** | LS move, RS look, RT grab (release with an RS flick, or RB, to throw), X punch, B kick, A use, Y hand up, LB drink, Start menu, D-pad answers |
| **Touch** | floating joystick on the left, drag the right side to look, **tap a person to knock them over**, tap a thing to pick it up, tap again (or THROW) to throw it where you tapped; no grab button — people can only be grabbed in VR. Buttons (layout editor, size, transparency, left-handed swap in the menu) |

## Edit the quiz

`questions.txt` — one question per line: `round | question | answer | wrong | wrong | wrong | (optional argument)`.
The game loads it when hosted. The real Martin can write next year's quiz in it. If you open the game from disk,
it uses the built-in copy in `src/game/questions.js` (`python3 tools/build_questions.py` regenerates it).

The 2026 questions are the ones from the design doc; the others are evergreen general knowledge and the Family Round
(edit those with real family facts!).

## Honest limits (and what would make it better)

- **Voices** use the device's built-in text-to-speech (British voices where available) with a different voice/pitch per
  person. On iPhone, tap *Play* first (iOS only allows speech after a tap) and turn the silent switch off. They won't sound
  Essex. Recorded lines (Option A in the doc) or ElevenLabs voices can be dropped in later —
  every line goes through `say()` in `src/engine/audio.js`.
- **Characters are procedural**, so they look like *your family's build, hair and colouring*, not their real faces.
  For real likenesses, export Character Creator / MetaPerson GLBs and swap them in for `buildCharacter()` (the
  skeleton and ragdoll mapping are in `src/chars/body.js` / `rig.js`).
- **Performance:** ~500k triangles and ~300 draw calls. Fine on PC; on Quest 3 use Settings → keep shadows off.
  Item types with nothing spawned are skipped.
- No online multiplayer and no upstairs (stair gate), as in the doc's scope.

## Code map

```
index.html            HUD, touch controls, menus
questions.txt         editable question bank
src/main.js           boot + game loop
src/engine/           physics (Rapier), procedural textures, audio + voices, geometry helpers
src/world/            house, item manager, item catalogue (+fridge doors, stair gate), Christmas tree
src/chars/            character builder, ragdoll rig + animation, cast data, people/accessories, AI, Chip
src/input/            desktop/gamepad/touch controls, player (grab/throw/punch/kick), Quest XR hands & gestures
src/game/             quiz, picture round, screens (TV/PC), systems (banter/havoc/chaos), interactions, replay,
                      mini-games, ceremony, UI, settings
lib/                  three.js r170 and Rapier 0.14 (vendored, MIT/Apache-2.0)
tools/                lineup.html (character line-up viewer), build_questions.py
```
