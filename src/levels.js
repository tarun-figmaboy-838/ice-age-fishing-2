(function (PopoGame) {
'use strict';
const { trapezium, angled, based, kite, arrowhead, orient } = PopoGame.geometry;

// The trapezium activity: five levels at one frozen lake, their fish, and the story lines.

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

// Every level plays at Quadrilateral Waters, where Popo first saw a trapezium fish.
const SCENE = { name: 'Quadrilateral Waters', background: 3, waterline: 388 };

// Fish bodies, in units (see src/geometry.js). `kind` is the classification the body must
// have (tests/geometry.py checks it) and `correct` whether it is a catch in its level. Level 5
// marks the two corners in `corners` (the ends of one side), which must measure `angles`.
const FISH = [
  // Level 1: trapeziums of every type (some turned or upside down) among quadrilaterals with no
  // parallel sides
  { id: 'L1-a', level: 1, kind: 'trapezium', correct: true, pattern: 'dots', body: trapezium({ bottom: 11, height: 4.6, left: 2.6, right: 3.4 }) },
  { id: 'L1-b', level: 1, kind: 'trapezium', correct: true, pattern: 'waves', body: orient(trapezium({ bottom: 10.5, height: 4.8, left: 2.4, right: 2.4 }), { flipY: true }) },
  { id: 'L1-c', level: 1, kind: 'trapezium', correct: true, pattern: 'stripes', body: trapezium({ bottom: 11.5, height: 4.4, left: 0, right: 3.6 }) },
  { id: 'L1-d', level: 1, kind: 'trapezium', correct: true, pattern: 'diamonds', body: orient(trapezium({ bottom: 10.5, height: 4.8, left: 4, right: 1.6 }), { turn: -8 }) },
  { id: 'L1-e', level: 1, kind: 'trapezium', correct: true, pattern: 'hearts', body: orient(trapezium({ bottom: 12, height: 4.2, left: 3, right: 4 }), { turn: 7, flipY: true }) },
  { id: 'L1-f', level: 1, kind: 'quadrilateral', correct: false, pattern: 'dots', body: [[0, 0], [11, 1.6], [8.5, 4.6], [1.5, 5.6]] },
  { id: 'L1-g', level: 1, kind: 'quadrilateral', correct: false, pattern: 'stripes', body: [[0, 0.8], [9.8, 0], [11.2, 3.9], [2.2, 5.4]] },
  { id: 'L1-h', level: 1, kind: 'kite', correct: false, pattern: 'waves', body: kite({ back: 6.6, front: 3.6, half: 2.8 }) },
  { id: 'L1-i', level: 1, kind: 'kite', correct: false, pattern: 'diamonds', body: kite({ back: 3.6, front: 6.4, half: 2.7 }) },
  { id: 'L1-j', level: 1, kind: 'arrowhead', correct: false, pattern: 'hearts', body: arrowhead({ length: 10, notch: 3.4, half: 3.6 }) },

  // Level 2: non-right scalene trapeziums among isosceles and right trapeziums; whole-unit legs
  { id: 'L2-a', level: 2, kind: 'scalene', correct: true, pattern: 'dots', body: trapezium({ bottom: 12, height: 4.4, legs: [5, 7] }) },
  { id: 'L2-b', level: 2, kind: 'scalene', correct: true, pattern: 'waves', body: trapezium({ bottom: 13.5, height: 5, legs: [6, 8] }) },
  { id: 'L2-c', level: 2, kind: 'scalene', correct: true, pattern: 'stripes', body: trapezium({ bottom: 13, height: 4.8, legs: [7, 5] }) },
  { id: 'L2-d', level: 2, kind: 'scalene', correct: true, pattern: 'diamonds', body: trapezium({ bottom: 13, height: 4.6, legs: [5, 8] }) },
  { id: 'L2-e', level: 2, kind: 'isosceles', correct: false, pattern: 'hearts', body: trapezium({ bottom: 12.5, height: 4.6, legs: [5, 5] }) },
  { id: 'L2-f', level: 2, kind: 'isosceles', correct: false, pattern: 'dots', body: trapezium({ bottom: 13, height: 4.6, legs: [6, 6] }) },
  { id: 'L2-g', level: 2, kind: 'right', correct: false, pattern: 'waves', body: trapezium({ bottom: 11.5, height: 5, legs: [5, 6] }) },
  { id: 'L2-h', level: 2, kind: 'right', correct: false, pattern: 'stripes', body: trapezium({ bottom: 12.5, height: 5, legs: [7, 5] }) },
  // Level 3: isosceles trapeziums among look-alikes whose legs differ a little
  { id: 'L3-a', level: 3, kind: 'isosceles', correct: true, pattern: 'dots', body: trapezium({ bottom: 11, height: 4.6, left: 2.8, right: 2.8 }) },
  { id: 'L3-b', level: 3, kind: 'isosceles', correct: true, pattern: 'waves', body: orient(trapezium({ bottom: 10, height: 4.2, left: 2, right: 2 }), { flipY: true }) },
  { id: 'L3-c', level: 3, kind: 'isosceles', correct: true, pattern: 'stripes', body: trapezium({ bottom: 12, height: 4, left: 3.4, right: 3.4 }) },
  { id: 'L3-d', level: 3, kind: 'isosceles', correct: true, pattern: 'hearts', body: orient(trapezium({ bottom: 10.5, height: 5, left: 2.4, right: 2.4 }), { turn: -6 }) },
  { id: 'L3-e', level: 3, kind: 'scalene', correct: false, pattern: 'diamonds', body: trapezium({ bottom: 11, height: 4.6, left: 1.9, right: 3.7 }) },
  { id: 'L3-f', level: 3, kind: 'scalene', correct: false, pattern: 'dots', body: orient(trapezium({ bottom: 10.5, height: 4.4, left: 3.5, right: 1.6 }), { flipY: true }) },
  { id: 'L3-g', level: 3, kind: 'scalene', correct: false, pattern: 'waves', body: trapezium({ bottom: 12, height: 4, left: 2.4, right: 4.6 }) },

  // Level 4: right trapeziums (right angles at the back or the front, either base longer) among
  // trapeziums with no right angle
  { id: 'L4-a', level: 4, kind: 'right', correct: true, pattern: 'dots', body: trapezium({ bottom: 11, height: 4.6, left: 0, right: 3.6 }) },
  { id: 'L4-b', level: 4, kind: 'right', correct: true, pattern: 'waves', body: trapezium({ bottom: 10.5, height: 4.4, left: 3.4, right: 0 }) },
  { id: 'L4-c', level: 4, kind: 'right', correct: true, pattern: 'stripes', body: orient(trapezium({ bottom: 11.5, height: 4.8, left: 0, right: 4 }), { flipY: true }) },
  { id: 'L4-d', level: 4, kind: 'right', correct: true, pattern: 'hearts', body: orient(trapezium({ bottom: 10, height: 5, left: 2.8, right: 0 }), { flipY: true }) },
  { id: 'L4-e', level: 4, kind: 'isosceles', correct: false, pattern: 'diamonds', body: trapezium({ bottom: 11, height: 4.6, left: 2.6, right: 2.6 }) },
  { id: 'L4-f', level: 4, kind: 'scalene', correct: false, pattern: 'dots', body: trapezium({ bottom: 11, height: 4.4, left: 1.4, right: 3.8 }) },
  { id: 'L4-g', level: 4, kind: 'scalene', correct: false, pattern: 'waves', body: orient(trapezium({ bottom: 10.5, height: 4.8, left: 3.6, right: 2.2 }), { flipY: true }) },
  { id: 'L4-h', level: 4, kind: 'scalene', correct: false, pattern: 'stripes', body: trapezium({ bottom: 12, height: 4, left: 3, right: 4.4 }) },

  // Level 5: the handoff's six fish. The trapeziums show ∠D and ∠A at the ends of leg DA; the
  // distractors show the two angles at the ends of one side
  { id: 'A', level: 5, kind: 'trapezium', correct: true, pattern: 'dots', corners: [0, 3], angles: [70, 110], body: angled({ bottom: 11, side: 5, angles: [70, 110, 60] }) },
  { id: 'B', level: 5, kind: 'quadrilateral', correct: false, pattern: 'waves', corners: [0, 3], angles: [80, 80], body: orient(angled({ bottom: 10, side: 5.5, angles: [80, 80, 55] }), { turn: 10 }) },
  { id: 'C', level: 5, kind: 'trapezium', correct: true, pattern: 'stripes', corners: [0, 3], angles: [65, 115], body: orient(angled({ bottom: 11, side: 5.2, angles: [65, 115, 72] }), { flipY: true }) },
  { id: 'D', level: 5, kind: 'quadrilateral', correct: false, pattern: 'diamonds', corners: [0, 1], angles: [105, 95], body: based({ bottom: 9.5, angles: [105, 95], sides: [2.8, 5] }) },
  { id: 'E', level: 5, kind: 'trapezium', correct: true, pattern: 'hearts', corners: [0, 3], angles: [75, 105], body: angled({ bottom: 11, side: 5, angles: [75, 105, 56] }) },
  { id: 'F', level: 5, kind: 'trapezium', correct: true, pattern: 'waves', corners: [0, 3], angles: [80, 100], body: orient(angled({ bottom: 11.5, side: 4.8, angles: [80, 100, 54] }), { flipY: true }) },
];

// The angle recall before level 5: one trapezium, its left leg, and the angles at its two ends.
const RECALL = { body: angled({ bottom: 10, side: 5, angles: [70, 110, 62] }), corners: [0, 3] };

// school: fish swimming when the level starts; targets: catches among them; least: distractors
// top the school up so it never drops below this. speed: cruising range (stage px/s).
// marks: see layoutMarks in src/geometry.js. sizes: random size range ([1, 1] keeps one scale,
// so the length labels compare across fish). right: Popo's beats after a catch; hint: shown after a
// wrong catch; oops: Popo's beats as he climbs back aboard (instead of "Whoopsie Doopsie!").
// The wording is the handoff's (flow table, feedback examples and storyboard).
const LEVELS = [
  { instruction: 'Catch all the *trapeziums*!', catches: 3,
    school: 4, targets: 2, least: 3, speed: [34, 46], sizes: [0.9, 1.08], marks: ['parallel'],
    right: () => ['*Yes!*', 'One pair of *parallel* sides!'], hint: 'Look for *parallel* sides!' },
  { instruction: 'Catch the *scalene* trapeziums!', catches: 3,
    school: 4, targets: 2, least: 3, speed: [40, 52], sizes: [1, 1], marks: ['parallel', 'legs'],
    right: () => 'The legs have *different* lengths!', hint: 'Check the *leg* lengths!' },
  { instruction: 'Catch the *isosceles* trapeziums!', catches: 3,
    school: 4, targets: 2, least: 4, speed: [44, 58], sizes: [0.96, 1.04], marks: ['parallel', 'ticks'],
    right: () => 'Both legs are *equal!*', hint: 'Are the legs *equal?*' },
  { instruction: 'Catch the trapeziums with *two right angles*!', catches: 3,
    school: 5, targets: 2, least: 4, speed: [44, 58], sizes: [0.96, 1.04], marks: ['parallel', 'right'],
    right: () => 'Two *right* angles!', hint: 'Look for two *right* angles!' },
  { instruction: 'Catch all the *trapeziums*!', catches: 4,
    school: 5, targets: 3, least: 4, speed: [44, 58], sizes: [1, 1], marks: ['angles'], observe: true,
    right: ([a, b]) => ['*Yes!*', `${a}° + ${b}° = *180°!*`, 'That means a pair of *parallel* sides!'],
    hint: 'Add the marked *angles!*', oops: ['Not a *trapezium.*', "These angles don't add up to *180°!*", 'Try *again!*'] },
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
  // the recall card follows these words: it opens on "Remember,", the leg and its angles come on
  // "leg", and the two angles snap into a straight line on "180°!"
  recall: [
    { who: 'swiftee', text: '*Remember,*', cue: [{ word: 0, do: 'recallCard' }, { word: 0, do: 'twirl' }] },
    { who: 'swiftee', text: 'angles on the same *leg* of a trapezium…', cue: { word: 4, do: 'recallLeg' } },
    { who: 'swiftee', text: 'add up to *180°!*', cue: [{ word: 3, do: 'recallSum' }, { word: 3, do: 'twirl' }] },
  ],
  observe: [{ who: 'swiftee', text: 'Look at the marked *angles!*' }],
  observeStep: 'Step 1: *Observe* (2 seconds)',
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

Object.assign(PopoGame, { SHAPES, SCENE, FISH, RECALL, LEVELS, STORY, getShape });
})(window.PopoGame = window.PopoGame || {});
