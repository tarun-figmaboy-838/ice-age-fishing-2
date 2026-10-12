(function (PopoGame) {
'use strict';

const PHASE = {
  INTRO: 'intro',
  TUTORIAL: 'tutorial',
  READY: 'ready',
  CASTING: 'casting',
  REELING: 'reeling',
  CELEBRATING: 'celebrating',
  WRONG_PULL: 'wrongPull',
  LOSING_BALANCE: 'losingBalance',
  FALLING: 'falling',
  SUBMERGED: 'submerged',
  RESURFACING: 'resurfacing',
  RECOVERING: 'recovering',
  LEVEL_TRANSITION: 'levelTransition',
  RECALL: 'recall',
  OBSERVE: 'observe',
  COMPLETE: 'complete',
};

const state = {
  phase: PHASE.INTRO,
  paused: false,
  level: 0,
  levelCaught: 0, // right catches in the current level
  used: new Set(), // the current level's fish to catch that have already swum in
  fish: [],
  selectedFish: null,
  collected: [], // every fish caught, in order; they fill the basket at the end
  muted: false,
  token: 0,
  idleTime: 0,
  hintShown: false,
  streak: 0, // right catches in a row, with no wrong tap between
};

function resetProgress() {
  state.phase = PHASE.INTRO;
  state.paused = false;
  state.level = 0;
  state.levelCaught = 0;
  state.used = new Set();
  state.fish = [];
  state.selectedFish = null;
  state.collected = [];
  state.idleTime = 0;
  state.hintShown = false;
  state.streak = 0;
}

// Every sequence captures a token; bumping it cancels anything still waiting.
function newToken() {
  state.token += 1;
  return state.token;
}

function isCurrent(token) {
  return token === state.token;
}

Object.assign(PopoGame, { PHASE, state, resetProgress, newToken, isCurrent });
})(window.PopoGame = window.PopoGame || {});
