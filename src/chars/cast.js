// The Mason family: appearance chart, voices, personalities, lines, stats.
// Heights/builds/hair/stubble follow the doc's appearance chart. Swap heights for real ones if known.
export const SKIN = ['#efc9ad', '#eac2a5', '#f0cbb2', '#e6bd9f', '#edc6ab', '#f2d0b8'];

// Four teams. Martin hosts (no team); Chip isn't on a team, he's just chaos.
export const TEAMS = {
  paul: { name: 'Team Paul', color: '#d23b3b' },
  julie: { name: 'Team Julie', color: '#2f74c0' },
  debbie: { name: 'Team Debbie', color: '#2fa35a' },
  hollie: { name: 'Team Hollie', color: '#a24fd0' },
};
export const TEAM_IDS = Object.keys(TEAMS);

export const CAST = [
  { name: 'Tommy', team: 'paul', height: 1.84, build: 'standard', sex: 'm', hair: { style: 'short', color: '#5a3c24' }, stubble: 0.25, stubbleColor: '#4a3020',
    top: { pattern: 'fairisle', c1: '#20406a', c2: '#f2f2f2', c3: '#c0282d' }, legs: { type: 'jeans', c1: '#2b3f5e' }, socks: '#c02020', eyes: '#4a6a3a', player: true,
    voice: { pitch: 1, rate: 1, female: false, idx: 0 },
    // Tommy: works in marketing in London, gets wound up by his dad, cracks jokes
    lines: { idle: ["Dad. DAD. It's not your turn.", "In London we'd call this a team-building exercise.", "I do marketing, Martin. I could rebrand this quiz for you.", "Dad, you've been wrong four times and confident every time.", "Can we get through ONE question without Dad arguing?", "This train back to London can't come soon enough.", "Honestly, Dad, Google is right there.", "I'm putting this quiz in a slide deck. It's a case study in chaos.", "Dad, please. People are watching.", "Let's circle back to the sausage rolls."],
      thrown: ["DAD!", "I've got work on Monday!", "Not the face, I've got a client meeting!"], laugh: ["Hahaha, Dad, stop!"], joke: ["What do you call a marketing team at Christmas? Sleigh-les.", "Dad's like a pop-up ad. You close him and he comes straight back.", "I'd pitch this quiz in London but they'd think it was satire."] } },
  { name: 'Paul', role: 'Dad', team: 'paul', height: 1.80, build: 'bigger', sex: 'm', hair: { style: 'short', color: '#1b1612', recede: 0.6 }, stubble: 0.65, stubbleColor: '#1e1814',
    top: { pattern: 'reindeer', c1: '#a8141c', c2: '#ffffff', c3: '#1d4d2b' }, legs: { type: 'jeans', c1: '#24324a' }, socks: '#1d4d2b', face: { jaw: 0.95, nose: 1.15, noseW: 1.2, brow: 0.9 },
    voice: { pitch: 0.55, rate: 1.05, female: false, idx: 1 }, weight: 'heavy', grazer: true,
    lines: {
      idle: ["That's what I put!", "The question was badly worded.", "Martin, you've been marking us harder since 1987.", "I'm not arguing, I'm explaining why I'm right.", "Messi won it. I watched it.", "Who's eaten all the pigs in blankets? Oh. Me."],
      roast: ["Dan, you're a teacher and you still can't mark.", "Kirsty, this isn't the nursery, you can't put me on the naughty step.", "Sophie, edit THIS out, go on.", "Martin, you promote films. Nobody's promoting this quiz.", "Did you write these questions or did the clipboard?", "Martin, nice jumper. Did Julie pick it or did you lose a bet?", "Gary, you look lovely. Is that what you wear to work?", "Debbie, your team's got a baby on it and he's still the brains.", "James, what do you actually do for a living, son? Apart from agree with Sophie?", "Martin's house, Martin's rules, Martin's wrong answers."],
      thrown: ["Oi! My back!", "I'm a big man, Tommy! Mind the telly!", "That's assault, that is. Karen, did you see that?", "I meant to do that.", "Put me DOWN!"],
      wrong: ["That's what I put! Basically.", "Half a point for the spirit of the answer!", "I'm appealing that.", "It's the same thing!"],
      asleep: ["Spain... it was Spain...", "Mmm. Pigs in blankets."],
      eat: ["Mmmf!", "Mmm, lovely, Julie."],
    } },
  { name: 'Karen', role: 'Mum', team: 'paul', height: 1.62, build: 'standard', sex: 'f', hair: { style: 'long', color: '#5c3d26', length: 0.3 }, top: { pattern: 'plain', c1: '#6b2742' },
    legs: { type: 'trousers', c1: '#1b1b22' }, socks: '#d8c8e8', face: { jaw: 0.8 }, voice: { pitch: 1.05, rate: 0.95, female: true, idx: 0 },
    lines: { idle: ["Paul.", "Can we just do the next question?", "I'm not getting involved.", "It was 2014, I was there.", "Has anyone seen my bag?"], thrown: ["Tommy! I'm your mother!", "Not the wine!", "Right, that's it, I'm not getting involved."], warn: ["Paul.", "Paul. Enough."] } },
  { name: 'Charli', role: 'Sister', team: 'paul', height: 1.65, build: 'standard', sex: 'f', hair: { style: 'long', color: '#4a2f1c', length: 0.36, fringe: false }, top: { pattern: 'tree', c1: '#b8202a', c3: '#1d6a2f' },
    legs: { type: 'jeans', c1: '#1e2533' }, socks: '#ffffff', socks2: '#c02020', socksStripe: true, eyes: '#4a3a24', crown: '#f2c20f',
    voice: { pitch: 1.25, rate: 1.12, female: true, idx: 1 },
    lines: { idle: ["I literally said that.", "Dad, sit DOWN.", "That's not even a real answer.", "Did anyone film that?", "I'm putting this on the group chat."], thrown: ["Did anyone film that?", "TOMMY!", "I'm telling Mum."], toldyou: ["I SAID THAT!", "I literally said that. Nobody listens to me.", "Told you so."] } },

  { name: 'Martin', role: 'Uncle, quizmaster', team: 'host', height: 1.81, build: 'bigger', sex: 'm', hair: { style: 'short', color: '#17120f' }, stubble: 0.6, stubbleColor: '#1c1612',
    top: { pattern: 'shirtjumper', c1: '#204a2a' }, legs: { type: 'trousers', c1: '#3a3632' }, socks: '#802020', face: { jaw: 0.92, nose: 1.05, brow: 1 },
    voice: { pitch: 0.7, rate: 0.95, female: false, idx: 2 }, weight: 'heavy', grazer: true,
    lines: { idle: ["Quiet please.", "My house, my quiz, my answers.", "Paul, you get nothing.", "I'll allow it.", "The answer on the sheet is final.", "It's a typo.", "Tonight's quiz: from the studio that brought you last year's quiz. Five stars.", "If this quiz were a film I'd have it on every bus stop in town.", "I've promoted worse films than Paul's answers. Not many.", "Coming soon to a living room near you: the Mason Cup.", "Got a premiere next week. Red carpet. Paul's not invited."], thrown: ["My own house!", "Not near the telly!", "Right. Yellow card, Tommy."], roast: ["Three points, Paul. Same as your age in dog years.", "Paul, remember the barbecue in 2019? The fire brigade do.", "Nice dad-dancing at the wedding, Paul. Very brave.", "Paul's marking himself again, everyone.", "Paul, I've sold trailers with more plot than your excuses."], remote: ["Who's touched my remote?", "Put the remote DOWN."] } },
  { name: 'Julie', role: 'Aunt, host', team: 'julie', height: 1.62, build: 'standard', sex: 'f', hair: { style: 'long', color: '#c9a35a', root: '#7a5a34', tip: '#e8d29a', length: 0.26 }, top: { pattern: 'apron', c1: '#3a4a6a' },
    legs: { type: 'trousers', c1: '#22222a' }, socks: '#f0f0f0', voice: { pitch: 1.1, rate: 1.1, female: true, idx: 3 },
    lines: { idle: ["Coaster!", "Who's touched my trifle?", "Not on the wooden floor!", "There's more sausage rolls if anyone wants them.", "That's it, there's no more."], thrown: ["My floor!", "Mind the baubles!", "Not on the oak!"], coaster: ["Coaster!", "COASTER!", "Tommy. Coaster."] } },
  { name: 'Hollie', role: 'Cousin', team: 'hollie', height: 1.66, build: 'slim', sex: 'f', hair: { style: 'long', color: '#d1b06a', root: '#8a6a3c', tip: '#efe0b0', length: 0.4 }, top: { pattern: 'snowflake', c1: '#e8e2da', c2: '#b02030' },
    legs: { type: 'jeans', c1: '#3a4a6a' }, socks: '#f2c0d0', lip: '#c0606a', voice: { pitch: 1.2, rate: 1.1, female: true, idx: 4 },
    lines: { idle: ["Dan, stop it!", "I just know it, babe!", "I wasn't on my phone, I was checking the time."], thrown: ["Oh my God!", "Dan! Help!"], laugh: ["Hahaha! Dan, STOP!"] } },
  { name: 'Dan', role: "Hollie's husband", team: 'hollie', height: 1.82, build: 'standard', sex: 'm', hair: { style: 'short', color: '#5a3c22' }, stubble: 0.45, stubbleColor: '#3a2818',
    top: { pattern: 'stripes', c1: '#1f5a3a', c2: '#d8c08a' }, legs: { type: 'jeans', c1: '#2e3c50' }, socks: '#e0e0e0', voice: { pitch: 0.8, rate: 1.0, female: false, idx: 3 },
    lines: { idle: ["Martin, is this a quiz or a hostage situation?", "Paul's arguing with Wikipedia again.", "Gary's outfit's got more support than our team.", "I mark thirty books a night. This sheet's getting a 'see me'.", "Hands up if you know the answer. Hands DOWN, Paul.", "Paul, I've got Year 7s who argue less than you.", "Right, eyes on me. Phones away. Yes, Hollie, you too.", "That's a detention, Paul."], thrown: ["Ten from the Russian judge.", "Nailed the landing.", "I'll be feeling that on Monday."], joke: ["Paul, I've seen better arguments on a cereal box.", "Martin's marking is like his barbecue. Overdone.", "If Paul's right, I'm a reindeer.", "This quiz has more disputes than the Premier League.", "Chip's got more points than Team Paul.", "Gary looks like he's about to read the six o'clock news.", "Six weeks off and I spend Boxing Day refereeing Paul.", "Martin, your marking wouldn't pass an Ofsted."] } },
  { name: 'Sophie', role: 'Cousin, getting married', team: 'julie', height: 1.67, build: 'slim', sex: 'f', hair: { style: 'long', color: '#d8b870', root: '#8a6838', tip: '#f2e2b0', length: 0.38, fringe: true }, top: { pattern: 'fairisle', c1: '#f0e8f0', c2: '#c0507a', c3: '#507ac0' },
    legs: { type: 'jeans', c1: '#bcc6d6' }, socks: '#ffffff', lip: '#c86a74', voice: { pitch: 1.3, rate: 1.18, female: true, idx: 5 },
    lines: { idle: ["Martin, can you do the quiz at the wedding? Actually, no.", "Paul's not invited if he keeps this up.", "Speaking of venues...", "Question nine: James.", "I'd cut Paul's bit. Way too long.", "In the edit, Martin, this quiz is ninety seconds.", "That's going in the blooper reel.", "Martin, you'd promote this film. I'd have to edit it.", "Can we get that again from a different angle?"], thrown: ["Not the binder!", "James!"], wedding: ["Speaking of venues, has anyone seen a barn with fairy lights?", "Do we think chair covers or no chair covers?", "Karen, do you like ivory or champagne?"] } },
  { name: 'James', role: "Sophie's fiancé", team: 'julie', height: 1.80, build: 'standard', sex: 'm', hair: { style: 'tuck', color: '#6a4628' }, stubble: 0.4, stubbleColor: '#4a3220',
    top: { pattern: 'shirtjumper', c1: '#2a2f44' }, legs: { type: 'trousers', c1: '#6a5a46' }, socks: '#5a3a70', voice: { pitch: 0.9, rate: 0.95, female: false, idx: 4 },
    lines: { idle: ["Sorry, is this a real question?", "Soph, do I answer that?", "I'll get the drinks.", "What are the rules, sorry?"], thrown: ["Sorry! Sorry. My fault.", "Sorry, was I in the way?"] } },

  { name: 'Debbie', role: 'Aunt, team captain', team: 'debbie', height: 1.61, build: 'standard', sex: 'f', hair: { style: 'long', color: '#5a3a26', length: 0.28 }, top: { pattern: 'sparkly', c1: '#8a1a5a', c2: '#ffd700' },
    legs: { type: 'trousers', c1: '#18181c' }, socks: '#ffd700', lip: '#b23050', tinsel: true, earrings: true, voice: { pitch: 1.12, rate: 1.15, female: true, idx: 6 },
    lines: { idle: ["You two are unbelievable.", "I'm going home.", "Paul, that's NOT funny.", "Can you two act your age for ONE round?", "I had a fiver on I Am Maximus, you know."], thrown: ["Hahahaha! Put me down!", "Tommy! Hahaha!"], storm: ["Right. That's it. I'm getting my coat.", "I'm going home. I mean it this time."], laugh: ["HAHAHAHA!"] } },
  { name: 'Gary', role: 'Uncle', team: 'debbie', height: 1.79, build: 'bigger', sex: 'm', hair: { style: 'short', color: '#8e8c88', recede: 0.4 }, stubble: 0.55, stubbleColor: '#8a8884', browColor: '#6e6c68',
    top: { pattern: 'mankini' }, legs: { type: 'skin' }, bareFeet: true, socks: '#ddd', face: { jaw: 0.9, nose: 1.1 }, voice: { pitch: 0.6, rate: 0.85, female: false, idx: 5 }, weight: 'heavy', grazer: true,
    lines: { idle: ["Fair enough.", "It's a bit draughty, Martin.", "Next question.", "I'm taking this very seriously."], thrown: ["Fair enough.", "Was that necessary.", "Dignity, Tommy. Dignity."] } },
  { name: 'Kirsty', role: 'Cousin', team: 'hollie', height: 1.64, build: 'standard', sex: 'f', hair: { style: 'long', color: '#4e321e', length: 0.34 }, top: { pattern: 'hoodie', c1: '#c98aa2' },
    legs: { type: 'trousers', c1: '#3a3a44' }, socks: '#88c8e8', voice: { pitch: 1.22, rate: 1.1, female: true, idx: 7 },
    lines: { idle: ["I can't breathe!", "Did he actually just say that?", "My tally says different.", "I look after fifteen toddlers all week and Paul's still the worst behaved.", "Mason, gentle hands! Sorry, work habit.", "Paul, do you need some quiet time on the naughty step?", "It's like snack time at the nursery in here.", "Everyone use your indoor voices. Paul."], thrown: ["Hahaha I can't breathe!", "Again! Hahaha!"], laugh: ["Hahahaha I can't breathe!"] } },
  { name: 'Jodie', role: "Cousin, Mason's mum", team: 'debbie', height: 1.64, build: 'standard', sex: 'f', hair: { style: 'long', color: '#5a3b22', length: 0.3 }, top: { pattern: 'plain', c1: '#3a6a7a' },
    legs: { type: 'jeans', c1: '#202838' }, socks: '#f0f0f0', voice: { pitch: 1.18, rate: 1.12, female: true, idx: 8 },
    lines: { idle: ["Mason, NO.", "Stop it, I'm crying!", "Where's Mason gone?"], thrown: ["Tommy! Watch Mason!", "Stop it, I'm crying!"], laugh: ["Stop it, I'm crying!"] } },
  { name: 'Harry', role: "Jodie's husband", team: 'debbie', height: 1.79, build: 'standard', sex: 'm', hair: { style: 'cap', color: '#5a3c22' }, stubble: 0.3, stubbleColor: '#3a2818',
    top: { pattern: 'quarterzip', c1: '#1c2a44' }, legs: { type: 'jeans', c1: '#2a2a30' }, socks: '#333', cap: '#222222', voice: { pitch: 0.75, rate: 0.85, female: false, idx: 6 },
    lines: { idle: ["Spain.", "Nah.", "Leave it, Paul."], thrown: ["...", "Nah."] } },
  { name: 'Bradley', role: "Cousin, Harrison's dad", team: 'hollie', height: 1.81, build: 'standard', sex: 'm', hair: { style: 'short', color: '#6a4a2c' }, stubble: 0.4, stubbleColor: '#4a3020',
    top: { pattern: 'plain', c1: '#5a5a62' }, legs: { type: 'jeans', c1: '#33445e' }, socks: '#2a5a2a', voice: { pitch: 0.85, rate: 0.9, female: false, idx: 7 },
    lines: { idle: ["Yeah, could be.", "I'll take him out for a bit."], thrown: ["Easy, easy.", "Mind the baby!"] } },
  { name: 'Mason', role: 'Toddler (3), dressed as Bluey', team: 'debbie', height: 0.95, build: 'toddler', sex: 'm', hair: { style: 'short', color: '#2f4f8f' }, rosy: 0.45,
    top: { pattern: 'bluey', c1: '#6fa8dc', hood: 'bluey' }, legs: { type: 'onesie', c1: '#6fa8dc' }, socks: '#2f4f8f', eyes: '#3a5a8a', protected: true,
    face: { jaw: 0.98, nose: 0.6, noseW: 0.9, brow: 0.1, cheek: 0.9, lips: 0.8, eyeGap: 0.36 },
    voice: { pitch: 2, rate: 1.25, female: false, idx: 0 },
    lines: { idle: ["BLUEY!", "GARY BUM!", "SPAIN!", "CHIP!", "Again!", "Uh oh.", "KPOP DEMON HUNTERS!"] } },
  { name: 'Harrison', role: 'Toddler (2), dressed as an elf', team: 'hollie', height: 0.86, build: 'toddler', sex: 'm', hair: { style: 'short', color: '#ead6a8' }, rosy: 0.5,
    top: { pattern: 'elf', c1: '#2a9a3a', hat: 'elf' }, legs: { type: 'onesie', c1: '#c41e1e' }, socks: '#c41e1e', eyes: '#4a6a9a', protected: true,
    face: { jaw: 1, nose: 0.5, noseW: 0.9, brow: 0, cheek: 1, lips: 0.75, eyeGap: 0.37 },
    voice: { pitch: 2, rate: 1.3, female: true, idx: 0 }, lines: { idle: ["Daddy!", "ELF!", "Jingle bells!", "Mason!", "Chip! CHIP!", "Uh oh.", "Eeeee!", "Again!"] } },
];

// Personal idles/behaviour flags used by the AI
export const PERSONA = {
  Paul: { idle: ['bellyPat', 'point', 'argue'], seat: 'sofaL', drink: 'lager', loud: 1.4 },
  Tommy: { idle: ['phone', 'laughPolite', 'sip', 'armsFolded'], drink: 'lager', holds: 'phone' },
  Karen: { idle: ['drink', 'tidy'], seat: 'sofaL', drink: 'prosecco', holds: 'wine' },
  Charli: { idle: ['phone', 'film'], seat: 'sofaL', drink: 'prosecco', holds: 'phone' },
  Martin: { idle: ['clipboard', 'whistle', 'straightenTree'], seat: 'armchair', drink: 'lager', holds: 'clipboard' },
  Julie: { idle: ['refill', 'wipe', 'coaster'], seat: 'kitchen', drink: 'small', holds: 'towel' },
  Hollie: { idle: ['phone', 'laugh', 'selfie'], seat: 'sofaR', drink: 'prosecco', holds: 'phone', pair: 'Dan' },
  Dan: { idle: ['pint', 'deadpan'], seat: 'sofaR', drink: 'pint', holds: 'pint', pair: 'Hollie' },
  Sophie: { idle: ['ring', 'binder'], seat: 'dining', drink: 'prosecco', holds: 'binder', pair: 'James' },
  James: { idle: ['tuckHair', 'stand'], seat: 'dining', drink: 'lager', pair: 'Sophie' },
  Debbie: { idle: ['laugh', 'slapArm'], seat: 'sofaR', drink: 'prosecco' },
  Gary: { idle: ['armsFolded', 'adjust'], seat: 'stand', drink: 'bitter' },
  Kirsty: { idle: ['laugh', 'snack'], seat: 'floor', drink: 'wine' },
  Jodie: { idle: ['laugh', 'watchMason'], seat: 'floor', drink: 'prosecco' },
  Harry: { idle: ['armsFolded', 'sip'], seat: 'stand', drink: 'lager' },
  Bradley: { idle: ['bounce'], seat: 'stand', drink: 'lager', holdsBaby: true },
};

export const DRINK_ORDERS = { Tommy: 'lager', Paul: 'lager', Martin: 'lager', Gary: 'bitter', Dan: 'pint', Karen: 'prosecco', Debbie: 'prosecco', Julie: 'small', Mason: 'juice', Hollie: 'prosecco', Sophie: 'prosecco', James: 'lager', Kirsty: 'wine', Jodie: 'prosecco', Harry: 'lager', Bradley: 'lager', Charli: 'prosecco' };

// Gary's Outfit Wheel
// Gary's outfit of the year (one at random each game). On his 3D scan the costume is painted on below the neck
// (see costume.js), so his face is always his own.
export const OUTFITS = [
  { id: 'mankini', label: 'Mankini (the classic)', top: { pattern: 'mankini' }, legs: { type: 'skin' }, bareFeet: true },
  { id: 'fairy', label: 'Christmas fairy (wings, wand and tutu)', top: { pattern: 'plain', c1: '#ec6fb4' }, legs: { type: 'trousers', c1: '#ffffff' }, socks: '#b0186a' },
  { id: 'minion', label: 'Minion (dungarees and all)', top: { pattern: 'plain', c1: '#f5cf14' }, legs: { type: 'jeans', c1: '#2f5d9e' }, socks: '#151515' },
  { id: 'santa', label: 'Father Christmas suit (wrong size)', top: { pattern: 'santa', c1: '#c41e1e', hat: 'santa' }, legs: { type: 'trousers', c1: '#c41e1e' }, socks: '#111', trousersFall: true },
  { id: 'elf', label: 'Elf on the Shelf (tiny)', top: { pattern: 'elf', c1: '#1f8a3a' }, legs: { type: 'trousers', c1: '#c41e1e' }, socks: '#1f8a3a', onShelf: true, height: 1.1 },
];
