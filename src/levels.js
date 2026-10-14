(function (PopoGame) {
'use strict';
const { trapezium, angled, kite, arrowhead, orient } = PopoGame.geometry;

// The trapezium activity: five levels at one frozen lake, their fish, and the story lines.

// A trapezium from its bottom base, its height and its two base angles in whole degrees (the top
// corners lean in by height / tan(angle); 90° stands straight up).
function byAngles(bottom, height, [a, b]) {
  const lean = (deg) => (deg === 90 ? 0 : height / Math.tan((deg * Math.PI) / 180));
  return trapezium({ bottom, height, left: lean(a), right: lean(b) });
}

// The art fish (assets/sprites/fish.webp) swim on the title and leap during Popo's entrance;
// none is four-sided, so only the trapezium levels' fish are quadrilaterals.
// atlas: sprite index (row-major, see FISH_ATLAS).
const SHAPES = {
  triangle: { shape: 'triangle', name: 'Triangle', atlas: 'triangle', sides: 3 },
  'triangle-right': { shape: 'triangle', name: 'Triangle', atlas: 'triangle-right', sides: 3 },
  pentagon: { shape: 'pentagon', name: 'Pentagon', atlas: 'pentagon', sides: 5 },
  hexagon: { shape: 'hexagon', name: 'Hexagon', atlas: 'hexagon', sides: 6 },
  octagon: { shape: 'octagon', name: 'Octagon', atlas: 'octagon', sides: 8 },
  decagon: { shape: 'decagon', name: 'Decagon', atlas: 'decagon', sides: 10 },
  circle: { shape: 'circle', name: 'Circle', atlas: 'circle', curved: true },
  oval: { shape: 'oval', name: 'Oval', atlas: 'oval', curved: true },
  semicircle: { shape: 'semicircle', name: 'Semicircle', atlas: 'semicircle' },
};

function getShape(key) {
  return SHAPES[key];
}

// Popo rows round the frozen lake, a new place for every level: Triangle Bay, Pentagon Cove,
// Hexagon Pass, Quadrilateral Waters (where he first saw a trapezium fish), and the first bay
// seen from across the lake. background: the painting (src/background-data.js).
const PLACES = [
  { name: 'Triangle Bay', background: 0, waterline: 388 },
  { name: 'Pentagon Cove', background: 1, waterline: 390 },
  { name: 'Hexagon Pass', background: 2, waterline: 387 },
  { name: 'Quadrilateral Waters', background: 3, waterline: 388 },
  { name: 'Far Shore', background: 4, waterline: 388 },
];

// Fish bodies, in units (see src/geometry.js). `kind` is the classification the body must
// have (tests/geometry.py checks it) and `correct` whether it is a catch in its level. Level 5
// marks the two corners in `corners` (the ends of one side), which must measure `angles`.
const FISH = [
  // Level 1: trapeziums of every type (some turned or upside down) among quadrilaterals with no
  // parallel sides
  { id: 'L1-a', level: 1, kind: 'trapezium', correct: true, pattern: 'dots', body: trapezium({ bottom: 11, height: 4.6, left: 2.6, right: 3.4 }) },
  { id: 'L1-b', level: 1, kind: 'trapezium', correct: true, pattern: 'waves', body: orient(trapezium({ bottom: 10.5, height: 4.8, left: 2.4, right: 2.4 }), { flipY: true }) },
  { id: 'L1-c', level: 1, kind: 'trapezium', correct: true, pattern: 'stripes', body: trapezium({ bottom: 11.5, height: 4.4, left: 1.2, right: 3.6 }) },
  { id: 'L1-d', level: 1, kind: 'trapezium', correct: true, pattern: 'diamonds', body: orient(trapezium({ bottom: 10.5, height: 4.8, left: 4, right: 1.6 }), { turn: -8 }) },
  { id: 'L1-e', level: 1, kind: 'trapezium', correct: true, pattern: 'hearts', body: orient(trapezium({ bottom: 12, height: 4.2, left: 3, right: 4 }), { turn: 7, flipY: true }) },
  { id: 'L1-f', level: 1, kind: 'quadrilateral', correct: false, pattern: 'dots', body: [[0, 0], [11, 1.6], [8.5, 4.6], [1.5, 5.6]] },
  { id: 'L1-g', level: 1, kind: 'quadrilateral', correct: false, pattern: 'stripes', body: [[0, 0.8], [9.8, 0], [11.2, 3.9], [2.2, 5.4]] },
  { id: 'L1-h', level: 1, kind: 'kite', correct: false, pattern: 'waves', body: kite({ back: 6.6, front: 3.6, half: 2.8 }) },
  { id: 'L1-i', level: 1, kind: 'kite', correct: false, pattern: 'diamonds', body: kite({ back: 3.6, front: 6.4, half: 2.7 }) },
  { id: 'L1-j', level: 1, kind: 'arrowhead', correct: false, pattern: 'hearts', body: arrowhead({ length: 10, notch: 3.4, half: 3.6 }) },

  // Levels 2 to 4 show no markings: the learner judges legs and angles by eye. The bodies are
  // built from whole-degree base angles (byAngles).
  // Level 2: non-right scalene trapeziums (different base angles) among isosceles ones (equal)
  { id: 'L2-a', level: 2, kind: 'scalene', correct: true, pattern: 'dots', body: byAngles(12, 4.4, [56, 72]) },
  { id: 'L2-b', level: 2, kind: 'scalene', correct: true, pattern: 'waves', body: byAngles(13, 4.8, [64, 50]) },
  { id: 'L2-c', level: 2, kind: 'scalene', correct: true, pattern: 'stripes', body: byAngles(12.5, 4.6, [74, 58]) },
  { id: 'L2-d', level: 2, kind: 'scalene', correct: true, pattern: 'diamonds', body: byAngles(13, 4.6, [52, 68]) },
  { id: 'L2-e', level: 2, kind: 'isosceles', correct: false, pattern: 'hearts', body: byAngles(12.5, 4.6, [62, 62]) },
  { id: 'L2-f', level: 2, kind: 'isosceles', correct: false, pattern: 'dots', body: byAngles(13, 4.6, [55, 55]) },
  { id: 'L2-g', level: 2, kind: 'isosceles', correct: false, pattern: 'waves', body: byAngles(12, 4.8, [68, 68]) },
  { id: 'L2-h', level: 2, kind: 'isosceles', correct: false, pattern: 'stripes', body: orient(byAngles(11.5, 4.2, [60, 60]), { flipY: true }) },
  // Level 3: isosceles trapeziums among look-alikes whose base angles differ a little
  { id: 'L3-a', level: 3, kind: 'isosceles', correct: true, pattern: 'dots', body: byAngles(11, 4.6, [60, 60]) },
  { id: 'L3-b', level: 3, kind: 'isosceles', correct: true, pattern: 'waves', body: orient(byAngles(10, 4.2, [66, 66]), { flipY: true }) },
  { id: 'L3-c', level: 3, kind: 'isosceles', correct: true, pattern: 'stripes', body: byAngles(12, 4, [54, 54]) },
  { id: 'L3-d', level: 3, kind: 'isosceles', correct: true, pattern: 'hearts', body: orient(byAngles(10.5, 5, [64, 64]), { turn: -6 }) },
  { id: 'L3-e', level: 3, kind: 'scalene', correct: false, pattern: 'diamonds', body: byAngles(11, 4.6, [68, 52]) },
  { id: 'L3-f', level: 3, kind: 'scalene', correct: false, pattern: 'dots', body: orient(byAngles(10.5, 4.4, [52, 70]), { flipY: true }) },
  { id: 'L3-g', level: 3, kind: 'scalene', correct: false, pattern: 'waves', body: byAngles(12, 4, [60, 44]) },

  // Level 4: right trapeziums (both ends of one leg 90°) among trapeziums with no right angle
  { id: 'L4-a', level: 4, kind: 'right', correct: true, pattern: 'dots', body: byAngles(11, 4.6, [90, 52]) },
  { id: 'L4-b', level: 4, kind: 'right', correct: true, pattern: 'waves', body: byAngles(10.5, 4.4, [54, 90]) },
  { id: 'L4-c', level: 4, kind: 'right', correct: true, pattern: 'stripes', body: orient(byAngles(11.5, 4.8, [90, 50]), { flipY: true }) },
  { id: 'L4-d', level: 4, kind: 'right', correct: true, pattern: 'hearts', body: orient(byAngles(10, 5, [60, 90]), { flipY: true }) },
  { id: 'L4-e', level: 4, kind: 'isosceles', correct: false, pattern: 'diamonds', body: byAngles(11, 4.6, [62, 62]) },
  { id: 'L4-f', level: 4, kind: 'scalene', correct: false, pattern: 'dots', body: byAngles(11, 4.4, [72, 50]) },
  { id: 'L4-g', level: 4, kind: 'scalene', correct: false, pattern: 'waves', body: orient(byAngles(10.5, 4.8, [56, 66]), { flipY: true }) },
  { id: 'L4-h', level: 4, kind: 'scalene', correct: false, pattern: 'stripes', body: byAngles(12, 4, [58, 46]) },

  // Level 5: the handoff's six fish, each showing ∠D and ∠A at the two ends of its left side DA
  { id: 'A', level: 5, kind: 'trapezium', correct: true, pattern: 'dots', corners: [0, 3], angles: [70, 110], body: angled({ bottom: 11, side: 5, angles: [70, 110, 60] }) },
  { id: 'B', level: 5, kind: 'quadrilateral', correct: false, pattern: 'waves', corners: [0, 3], angles: [80, 80], body: orient(angled({ bottom: 10, side: 5.5, angles: [80, 80, 55] }), { turn: 10 }) },
  { id: 'C', level: 5, kind: 'trapezium', correct: true, pattern: 'stripes', corners: [0, 3], angles: [65, 115], body: orient(angled({ bottom: 11, side: 5.2, angles: [65, 115, 72] }), { flipY: true }) },
  { id: 'D', level: 5, kind: 'quadrilateral', correct: false, pattern: 'diamonds', corners: [0, 3], angles: [95, 105], body: angled({ bottom: 10.5, side: 4.6, angles: [95, 105, 38] }) },
  { id: 'E', level: 5, kind: 'trapezium', correct: true, pattern: 'hearts', corners: [0, 3], angles: [75, 105], body: angled({ bottom: 11, side: 5, angles: [75, 105, 56] }) },
  { id: 'F', level: 5, kind: 'trapezium', correct: true, pattern: 'waves', corners: [0, 3], angles: [80, 100], body: orient(angled({ bottom: 11.5, side: 4.8, angles: [80, 100, 54] }), { flipY: true }) },
];

// The angle recall before level 5: one trapezium, its left leg, and the angles at its two ends.
const RECALL = { body: angled({ bottom: 10, side: 5, angles: [70, 110, 62] }), corners: [0, 3], names: ['D', 'C', 'B', 'A'] };

// place: where on the lake it plays (PLACES). school: fish swimming when the level starts;
// targets: catches among them; least: distractors top the school up so it never drops below this.
// speed: cruising range (stage px/s). marks: see layoutMarks in src/geometry.js (levels 1 to 4
// mark nothing, so spotting the shape is the learner's job; level 5 shows its angles). compare:
// how a wrong fish's angles read on its "why" card (sum: 95° + 105° = 200°). glow: what lights up
// on a wrong fish with nothing marked (legs, else its outline). sizes: random size
// range ([1, 1] keeps one scale, so the length labels compare across fish). hint: shown after a
// wrong catch; why: the reason a wrong fish isn't one, on a card over it and said by Popo; oops:
// Popo's beats as he climbs back aboard.
// The instructions and hints are the handoff's.
const LEVELS = [
  { place: 0, instruction: 'Catch all the *trapeziums*!', catches: 3,
    school: 4, targets: 2, least: 3, speed: [34, 46], sizes: [0.9, 1.08], marks: [],
    hint: 'Look for *parallel* sides!', why: 'No *parallel* sides!', oops: ['Whoopsie Doopsie!', 'No *parallel* sides!'] },
  { place: 1, instruction: 'Catch the *scalene* trapeziums!', catches: 3,
    school: 4, targets: 2, least: 3, speed: [40, 52], sizes: [1, 1], marks: [], glow: 'legs',
    hint: 'Check the *leg* lengths!', why: 'Its legs are *equal!*', oops: ['Whoopsie Doopsie!', 'Its legs are *equal!*'] },
  { place: 2, instruction: 'Catch the *isosceles* trapeziums!', catches: 3,
    school: 4, targets: 2, least: 4, speed: [44, 58], sizes: [0.96, 1.04], marks: [], glow: 'legs',
    hint: 'Are the legs *equal?*', why: 'Its legs are *different!*', oops: ['Whoopsie Doopsie!', 'Its legs are *different!*'] },
  { place: 3, instruction: 'Catch the right-angled *trapeziums*!', catches: 3,
    school: 5, targets: 2, least: 4, speed: [44, 58], sizes: [0.96, 1.04], marks: [],
    hint: 'Look for two *right* angles!', why: 'No *right* angles!', oops: ['Whoopsie Doopsie!', 'No *right* angles!'] },
  { place: 4, instruction: 'Catch all the *trapeziums*!', catches: 4,
    school: 5, targets: 3, least: 4, speed: [44, 58], sizes: [1, 1], marks: ['angles'], compare: 'sum', observe: true,
    hint: 'Add the marked *angles!*', why: "These angles don't add up to *180°!*",
    oops: ['Not a *trapezium.*', "These angles don't add up to *180°!*", 'Try *again!*'] },
];

// Story lines, in short comic beats delivered word by word. *Stressed* words land bigger with a
// boing, and a cue fires a moment in the scene when its word appears (see Game.storyCue).
const STORY = {
  welcome: [
    { who: 'swiftee', text: '*Great* job!', cue: { word: 0, do: 'twirl' } },
    { who: 'swiftee', text: 'You know all about *trapeziums!*' },
    { who: 'swiftee', text: "Now, let's help Popo catch some *fish!*", cue: { word: 6, do: 'hop' } },
  ],
  remind: [
    { who: 'swiftee', text: 'Use the fishing rod to *aim*…' },
    { who: 'swiftee', text: '…and drop the hook on the *correct* fish.' },
  ],
  // the recall card follows these words: it opens and draws its trapezium on "Look!", the parallel
  // sides light up on "parallel!", the leg and its angles come on "leg", the two angles snap into a
  // straight line on "180°!", and a little celebration on "Yay!"
  recall: [
    { who: 'swiftee', text: 'Look! These two sides are *parallel!*', cue: [{ word: 0, do: 'recall:shape' }, { word: 5, do: 'recall:parallel' }] },
    { who: 'swiftee', text: '*Remember,*' },
    { who: 'swiftee', text: 'angles on the same *leg* of a trapezium…', cue: { word: 4, do: 'recall:angles' } },
    { who: 'swiftee', text: 'add up to *180°!*', cue: { word: 3, do: 'recall:sum' } },
    { who: 'swiftee', text: 'Yay! Shape *detective!*', cue: { word: 0, do: 'recall:cheer' } },
  ],
  observe: [{ who: 'swiftee', text: 'Look at the marked *angles!*', cue: { word: 4, do: 'showAngles' } }],
  // after a right catch Popo says this
  right: [
    { who: 'popo', text: '*Great* catch!', cue: { word: 0, do: 'hop' } },
  ],
  wrong: { who: 'popo', text: 'Whoopsie Doopsie!' },
  wow: [
    { who: 'popo', text: '*Wow!*', cue: { word: 0, do: 'exclaim' } },
    { who: 'popo', text: 'What a *catch!*', cue: { word: 2, do: 'hop' } },
  ],
  done: { who: 'swiftee', text: 'You *did* it!', cue: { word: 1, do: 'twirl' }, stay: true },
  // the big catch before the end: a giant shadow, a tug-of-war, and up comes an old boot
  whoa: { who: 'popo', text: 'Whoa! A *giant* fish!', cue: { word: 0, do: 'exclaim' } },
  heave: { who: 'popo', text: 'Come *on*, big fish!' },
  eek: { who: 'swiftee', text: '*Eek!*' },
  huh: { who: 'popo', text: 'Huh?!', cue: { word: 0, do: 'wonder' } },
  goodCatch: { who: 'swiftee', text: 'Good catch, *Popo!*' },
  laughs: [{ who: 'popo', text: 'Ha ha *ha!*' }, { who: 'swiftee', text: 'Hee hee *hee!*' }],
};

Object.assign(PopoGame, { SHAPES, PLACES, FISH, RECALL, LEVELS, STORY, getShape });
})(window.PopoGame = window.PopoGame || {});
