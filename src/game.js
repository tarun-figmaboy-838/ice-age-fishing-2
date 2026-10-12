(function (PopoGame) {
'use strict';
const { assets, preloadBackground, clock, ease, Effects, WaterScene, surfaceWave, PAN_OVERLAP, refreshShadows, ShapeFish, ShadowFish, PALETTE, drawLabel, PLACES, FISH, LEVELS, RECALL, STORY, geometry, Popo, correctCatch, wrongCatch, finishLevel, closeCurtain, opening, mouthOf, Cancelled, STAGE_W, STAGE_H, swimArea, raftAnchor, state, PHASE, resetProgress, newToken, isCurrent } = PopoGame;

const HINT_DELAY = 4;
const TAU = Math.PI * 2;
const LEARNED_KEY = 'popo-fishing-learned';

const between = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const shuffle = (list) => list.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);

// The angle recall card (before level 5): where it sits in the water, where its trapezium and
// its straight line go on it, and the colours of the two angle pieces.
const RECALL_CARD = { x: 1050, y: 598, w: 560, h: 400, diagram: -92, line: 78, pieces: ['#ffb347', '#ff7aa8'] };

// The title banner: its water surface, sand line, the open water the decorative fish swim
// in, where the hooked fish splashes, and sparkle points along the logo's snowy edges.
const TITLE = {
  waterline: 610,
  seabed: 860,
  area: { left: 60, right: 1612, top: 680, bottom: 905 },
  // the play button floats in the banner's water
  play: { x: 836, y: 748, r: 108 },
  splash: { left: 760, right: 1010, y: 572 },
  twinkles: [[906, 118], [1062, 66], [1242, 58], [1424, 90], [1598, 160], [1556, 336], [958, 318]],
};


// An angle's corner as a piece of pie: where it starts and how far it turns (always positive).
function pieceOf({ a, b }) {
  const start = Math.atan2(a[1], a[0]);
  let sweep = Math.atan2(b[1], b[0]) - start;
  sweep = Math.atan2(Math.sin(sweep), Math.cos(sweep));
  return sweep < 0 ? { start: start + sweep, sweep: -sweep } : { start, sweep };
}

function drawPiece(ctx, at, { start, sweep }, radius, colour) {
  ctx.beginPath();
  ctx.moveTo(at[0], at[1]);
  ctx.arc(at[0], at[1], Math.max(0.1, radius), start, start + sweep);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#14284b';
  ctx.stroke();
}

class Game {
  constructor({ stage, ui, audio }) {
    this.stage = stage;
    this.ui = ui;
    this.audio = audio;
    this.popo = new Popo();
    this.fx = new Effects();
    this.water = new WaterScene(document.getElementById('water'));
    this.titleFx = new Effects();
    this.titleFx.setWaterline(TITLE.waterline);
    this.playAnim = { hover: 0, hoverTarget: 0, press: 0, burst: 0, bubbleIn: 0.3 };
    this.titleFade = 0;
    this.titleSplashIn = 0.8;
    this.raftRippleIn = 1;
    this.dialogue = null;
    this.leapers = [];
    this.swiftee = null;
    this.poof = null;
    this.awaitingNext = false;
    this.ambient = [];
    this.hop = null;
    this.mark = null;
    this.waterQuality = 1;
    this.frameAvg = 1 / 60;
    this.slowFor = 0;
    this.surfaceColors = [];
    this.tutorialPending = false;
    this.learned = false;
    this.place = LEVELS[0].place; // where on the lake Popo is (PLACES)
    this.transition = null; // rowing on to the next place: { to, k }
    this.waterline = PLACES[this.place].waterline;
    this.area = swimArea(this.waterline);
    this.decoys = [];
    this.recall = null;
    this.hookRing = null;
    this.shadow = null; // the big shadow at the end
    this.trash = null; // ...which is an old boot
    this.iris = null;
    this.ending = null;
    this.comicReset();
    this.handFish = null;
    this.instructionRevert = 0;
    this.lastFrame = 0;
    this.running = false;
    ui.setScale(stage.scale);
    ShapeFish.setStageScale(stage.scale);
  }

  // --- lifecycle ------------------------------------------------------------
  // The world renders behind the start screen as soon as the art is ready.
  showIdleScene() {
    this.applyScene();
    if (!this.running) {
      this.running = true;
      this.lastFrame = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  start() {
    if (state.phase === PHASE.INTRO) this.titleFade = 1;
    this.audio.init();
    this.audio.resume();
    this.audio.startMusic();
    resetProgress();
    this.ui.hideStart();
    this.ui.showHud();
    this.applyScene();
    this.ui.setHitsEnabled(false);
    opening(this);
    this.showIdleScene();
  }

  restart() {
    this.reset();
    opening(this);
  }

  // Cancels every sequence and clears the scene back to the start, ready to play.
  reset() {
    newToken();
    clock.cancelAll();
    this.fx.clearTransient();
    this.audio.stopEffects();
    this.audio.stopVoice();
    this.audio.setTravel(false);
    this.instructionRevert = 0;
    this.ui.showPause(false);
    this.ui.hideHand();
    this.ui.clearHits();
    this.handFish = null;
    const muted = state.muted;
    resetProgress();
    state.muted = muted;
    state.paused = false;
    this.audio.resume();
    this.popo = new Popo();
    this.ambient = [];
    this.hop = null;
    this.mark = null;
    this.recall = null;
    this.hookRing = null;
    this.shadow = null;
    this.trash = null;
    this.iris = null;
    this.ending = null;
    this.spotlight = null;
    this.comicReset();
    this.tutorialPending = false;
    this.endLine();
    this.swiftee = null;
    this.leapers = [];
    this.poof = null;
    this.awaitingNext = false;
    this.ui.hideNext();
    this.ui.setInstruction('');
    this.ui.el.hud.inert = false;
    this.nextNudge = 3;
    this.transition = null;
    this.place = LEVELS[0].place;
    this.applyScene();
  }

  dispose() {
    this.running = false;
    newToken();
    clock.cancelAll();
    this.audio.setTravel(false);
    this.handFish = null;
    this.instructionRevert = 0;
    this.fx.clearTransient();
    this.audio.stopEffects();
    this.audio.stopMusic();
    this.popo.endMishap();
    this.endLine();
    this.ui.hideHand();
    this.ui.setHitsEnabled(false);
    state.selectedFish = null;
    state.phase = PHASE.INTRO;
  }

  applyScene() {
    const place = PLACES[this.place];
    this.setWaterline(place.waterline);
    this.fx.setLocation(place.background);
    const next = LEVELS.find((level) => level.place > this.place);
    if (next) preloadBackground(PLACES[next.place].background);
  }

  // Rowing on: the next place's painting is ready, then the row (sequences.js) moves `k` to 1.
  async prepareTransition(to, token) {
    await preloadBackground(PLACES[to].background);
    if (isCurrent(token)) this.transition = { to, k: 0 };
  }

  finishTransition() {
    this.place = this.transition.to;
    this.transition = null;
    this.applyScene();
  }

  setWaterline(y) {
    this.waterline = y;
    this.area = swimArea(y);
    this.fx.setWaterline(y);
    const a = raftAnchor(y);
    this.popo.setAnchor(a.x, a.y);
  }

  level() {
    return LEVELS[state.level];
  }

  // A level's school: `targets` fish to catch among distractors, all out of view at first and
  // swimming in from either side one after another, in no particular order.
  startLevel(index) {
    state.level = index;
    if (this.place !== LEVELS[index].place) {
      this.place = LEVELS[index].place;
      this.applyScene();
    }
    state.levelCaught = 0;
    state.used = new Set();
    state.selectedFish = null;
    state.fish = [];
    this.decoys = [];
    const level = this.level();
    for (let i = 0; i < level.school; i += 1) this.addFish(i < level.targets);
    const delays = shuffle(state.fish.map((f, i) => i * 0.45 + Math.random() * 0.3));
    state.fish.forEach((f, i) => f.goOffstage(delays[i]));
    this.ambient = refreshShadows(this.ambient, 3, this.area);
    state.idleTime = 0;
    state.hintShown = false;
    this.instructionRevert = 0;
    this.ui.setInstruction(level.instruction);
  }

  // One more fish for the level: a catch not seen yet this level, or the next distractor (they
  // come round in a shuffled order). Its colour is never one already swimming, and colour never
  // tells a catch from a distractor.
  addFish(correct, away = 0) {
    const level = this.level();
    const pool = FISH.filter((f) => f.level === state.level + 1 && f.correct === correct);
    let spec;
    if (correct) {
      const fresh = pool.filter((f) => !state.used.has(f.id));
      spec = pick(fresh.length ? fresh : pool);
      state.used.add(spec.id);
    } else {
      if (!this.decoys.length) this.decoys = shuffle(pool);
      spec = this.decoys.pop();
    }
    const taken = new Set(state.fish.filter((f) => !f.gone).map((f) => f.colour));
    const colours = PALETTE.filter((c) => !taken.has(c));
    const fish = new ShapeFish(spec, level, {
      colour: pick(colours.length ? colours : PALETTE),
      size: between(...level.sizes),
      speed: between(...level.speed),
    });
    fish.goOffstage(away);
    state.fish.push(fish);
    return fish;
  }

  // After a catch, another fish to catch swims in while the level needs more than are left, and
  // distractors keep the school from thinning out below `least`.
  topUpSchool() {
    const level = this.level();
    state.fish = state.fish.filter((f) => !f.gone);
    const needed = level.catches - state.levelCaught;
    if (this.remainingTargets().length < Math.min(level.targets, needed)) this.addFish(true, between(0.4, 1.2));
    while (state.fish.length < level.least) this.addFish(false, between(0.8, 1.8));
  }

  // After a wrong catch the narrator reads the hint, once nobody else is talking.
  speakHint() {
    if (!this.dialogue) this.audio.speak('narrator', this.level().hint);
  }

  // Popo's beats after a wrong catch: the level's own (level 5's from the handoff), else the usual.
  wrongLine() {
    const { oops } = this.level();
    return oops ? oops.map((text) => ({ who: 'popo', text })) : STORY.wrong;
  }

  remainingTargets() {
    return state.fish.filter((f) => !f.gone && f.correct);
  }

  inViewTarget() {
    return this.remainingTargets().find((f) => !f.offstage && !f.escaping) || null;
  }

  // Fish swim in and out of view; while a level is on, at least one fish still to catch is
  // always swimming in sight, and the tutorial hand moves to it when its fish swims off.
  keepTargetsInView() {
    if (state.phase !== PHASE.READY && state.phase !== PHASE.TUTORIAL) return;
    const left = this.remainingTargets();
    if (left.length && !left.some((f) => !f.offstage)) {
      const soonest = left.reduce((a, b) => (a.away <= b.away ? a : b));
      soonest.away = Math.min(soonest.away, 0);
    }
    if (this.handFish && (this.handFish.gone || this.handFish.offstage)) {
      const next = this.inViewTarget();
      if (next) this.handFish = next;
    }
  }

  // After a catch: the level carries on until its catches are done.
  afterCatch() {
    if (state.levelCaught < this.level().catches) {
      this.topUpSchool();
      this.play();
      return;
    }
    finishLevel(this);
  }

  // Fishing is on: the level's instruction is back and the fish can be tapped.
  play() {
    const level = this.level();
    state.selectedFish = null;
    state.idleTime = 0;
    state.hintShown = false;
    this.ui.setInstruction(level.instruction);
    state.phase = PHASE.READY;
    this.ui.setHitsEnabled(true);
  }

  // Reads the instruction aloud (when it has a recording) for children who can't read it yet.
  speakInstruction() {
    if (!this.dialogue) this.audio.speak('narrator', this.level().instruction);
  }

  // The first-time reminder about the rod shows until the learner's first right catch, then
  // never again on this device.
  controlsLearned() {
    if (!this.learned) {
      try { this.learned = localStorage.getItem(LEARNED_KEY) === '1'; } catch (e) { /* storage may be unavailable */ }
    }
    return this.learned;
  }

  learnControls() {
    this.learned = true;
    try { localStorage.setItem(LEARNED_KEY, '1'); } catch (e) { /* storage may be unavailable */ }
  }

  // Next, at the end: the iris shuts and the activity ends.
  next() {
    if (!this.awaitingNext || state.paused) return;
    this.awaitingNext = false;
    if (this.swiftee) this.swiftee.onDownstroke = null;
    this.ui.hideNext();
    this.endLine(false);
    closeCurtain(this);
  }

  // The end of the activity: tell any page hosting the game (its map), then go back to the
  // title, ready to play again.
  complete() {
    state.phase = PHASE.COMPLETE;
    this.ui.setHitsEnabled(false);
    this.audio.play('complete');
    const detail = { catches: state.collected.length, levels: LEVELS.length };
    window.dispatchEvent(new CustomEvent('popo:complete', { detail }));
    if (window.parent !== window) window.parent.postMessage({ type: 'popo:complete', ...detail }, '*');
    this.backToTitle();
  }

  backToTitle() {
    this.reset();
    this.titleFade = 0;
    this.audio.stopMusic();
    this.ui.showStart();
    this.showIdleScene();
  }

  collect(fish) {
    state.collected.push(fish);
    state.levelCaught += 1;
    this.learnControls();
  }

  // --- input ----------------------------------------------------------------
  // Hit targets are larger than the fish, so when two overlap the fish whose body is
  // nearest the pointer wins rather than whichever button happens to be on top.
  fishAt(point, fallback) {
    let best = fallback;
    let bestScore = Infinity;
    for (const f of state.fish) {
      if (f.gone || f.escaping || f.offstage) continue;
      const r = f.hitRect();
      if (point.x < r.x || point.x > r.x + r.w || point.y < r.y || point.y > r.y + r.h) continue;
      const score = Math.hypot((point.x - f.x) / f.w, (point.y - f.y) / f.h);
      if (score < bestScore) {
        bestScore = score;
        best = f;
      }
    }
    return best;
  }

  puffFrom(fish, count, big = false) {
    this.fx.puff(fish.x + fish.dir * fish.w * 0.42 * fish.scale, fish.y + fish.h * 0.1 * fish.scale, fish.dir, count, big);
  }

  // Fish near the line from a to b dart away from it (a hooked fish is reeled along it).
  clearPath(a, b, except) {
    const ab = [b.x - a.x, b.y - a.y];
    const len2 = ab[0] * ab[0] + ab[1] * ab[1] || 1;
    for (const f of state.fish) {
      if (f === except || f.gone || f.offstage) continue;
      const k = Math.max(0, Math.min(1, ((f.x - a.x) * ab[0] + (f.y - a.y) * ab[1]) / len2));
      const near = { x: a.x + ab[0] * k, y: a.y + ab[1] * k };
      if (Math.hypot(f.x - near.x, f.y - near.y) < (f.w + f.h) / 2) f.startle(near);
    }
  }

  // Splashes make nearby fish dart away; a catch makes the others wiggle and blow bubbles.
  startleAround(point, radius = 320, except = null) {
    for (const f of state.fish) {
      if (f === except || f.gone || f === state.selectedFish) continue;
      if (Math.hypot(f.x - point.x, f.y - point.y) < radius) f.startle(point);
    }
  }

  cheer() {
    for (const f of state.fish) {
      if (f.gone || f.frozen) continue;
      f.wiggle();
      f.puffs += 3;
    }
  }

  // Tapping the water is just for fun: bubbles, a soft bloop, and curious fish come to look.
  onWaterTap(point) {
    if (state.phase === PHASE.INTRO) {
      this.onTitleTap(point);
      return;
    }
    if (state.paused || state.phase === PHASE.COMPLETE) return;
    if (point.y < this.waterline) return;
    this.fx.puff(point.x, point.y, 0, 5, true);
    if (point.y < this.waterline + 40) this.fx.ripple(point.x, this.waterline, 0.6);
    this.audio.play('bloop');
    for (const f of state.fish) {
      if (f.gone || f === state.selectedFish) continue;
      if (Math.hypot(f.x - point.x, f.y - point.y) < 300) f.lookAt(point);
    }
    this.fishReacts(point);
  }

  // The fish nearest a tap does something silly: a somersault and a giggle, a burst of
  // bubbles, or a quick dart away. Never the same trick twice running, and not too often.
  fishReacts(point) {
    const now = performance.now();
    let near = null;
    let best = 230;
    for (const f of [...state.fish, ...this.ambient]) {
      if (f.gone || f.frozen || f.escaping || f === state.selectedFish || !f.flip) continue;
      const d = Math.hypot(f.x - point.x, f.y - point.y);
      if (d < best && (f.reactedAt || 0) < now - 1200) { best = d; near = f; }
    }
    if (!near) return;
    near.reactedAt = now;
    const tricks = ['flip', 'bubbles', 'dart'].filter((t) => t !== this.lastTrick);
    const trick = tricks[Math.floor(Math.random() * tricks.length)];
    this.lastTrick = trick;
    if (trick === 'flip') {
      near.flip();
      this.audio.play('giggle');
    } else if (trick === 'bubbles') {
      near.wiggle();
      this.puffFrom(near, 8, true);
      this.audio.play('bubbles');
    } else {
      near.startle(point);
      this.audio.play('puff');
    }
  }

  onTitleTap(point) {
    if (point.y < TITLE.waterline) {
      this.titleFx.sparkle(point.x, point.y, 8);
      return;
    }
    this.titleFx.puff(point.x, point.y, 0, 5, true);
  }

  onPlayHover(on) {
    if (state.phase !== PHASE.INTRO) return;
    this.playAnim.hoverTarget = on ? 1 : 0;
    if (on) this.audio.play('bloop');
  }

  onPlayPress() {
    if (state.phase !== PHASE.INTRO) return;
    this.playAnim.press = 1;
  }

  // Play: the button pops, bubbles and sparkles burst out, the game begins.
  pressPlay() {
    if (state.phase !== PHASE.INTRO || !assets.title) return;
    const { x, y, r } = TITLE.play;
    this.audio.init(); // inside the tap, so phones allow sound
    this.audio.resume();
    if (!assets.ready) {
      // still loading: the button dips, and main.js presses it again once everything is in
      this.playAnim.press = 1;
      this.playQueued = true;
      this.ui.waitForLoad();
      return;
    }
    this.playQueued = false;
    this.playAnim.burst = 0.001;
    this.playAnim.press = 1;
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      this.titleFx.puff(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, Math.cos(a), 2, true);
    }
    this.titleFx.sparkle(x, y - r * 0.4, 14);
    this.audio.play('splashSmall');
    this.audio.play('cheer');
    this.start();
  }

  onFishTap(tapped, point) {
    const fish = point ? this.fishAt(point, tapped) : tapped;
    if (state.paused || state.phase !== PHASE.READY || state.selectedFish || fish.gone || fish.escaping || fish.offstage) return;
    state.selectedFish = fish;
    state.idleTime = 0;
    for (const f of state.fish) if (f !== fish) f.frozen = false;
    this.clearHint();
    this.puffFrom(fish, 4, true);
    this.instructionRevert = 0;
    this.hookRing = null;
    this.ui.setInstruction(this.level().instruction);
    if (fish.correct) {
      this.tutorialPending = false;
      if (this.handFish) { this.ui.hideHand(); this.handFish = null; }
      correctCatch(this, fish);
    } else {
      wrongCatch(this, fish);
    }
  }

  // Where the tutorial hand's fingertip touches its fish: the middle of the body.
  handPoint() {
    return [this.handFish.x + 6, this.handFish.y + this.handFish.h * 0.06];
  }

  // A soft ripple spreads from the fingertip each time the hand taps (in step with its CSS tap).
  drawHandRipple(ctx) {
    if (!this.handFish || this.handFish.gone || this.handFish.offstage || this.ui.el.hand.hidden || this.fx.reduced) return;
    const tap = this.ui.el.hand.getAnimations ? this.ui.el.hand.getAnimations()[0] : null;
    const phase = tap && tap.currentTime !== null ? (tap.currentTime % 1100) / 1100 : (this.fx.t % 1.1) / 1.1;
    const k = (phase - 0.45) / 0.55;
    if (k <= 0) return;
    const [x, y] = this.handPoint();
    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${(0.85 * (1 - k)).toFixed(3)})`;
    ctx.lineWidth = 4 * (1 - k) + 1;
    ctx.beginPath();
    ctx.ellipse(x, y, 8 + k * 34, (8 + k * 34) * 0.7, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  showHandOn(fish) {
    this.handFish = fish || null;
    if (fish) this.ui.showHand();
  }

  // The tutorial hand stays until the first correct tap, so it comes back after a wrong one.
  restoreTutorialHand() {
    if (!this.tutorialPending || state.phase !== PHASE.READY) return;
    this.showHandOn(this.inViewTarget());
  }

  togglePause() {
    if (state.phase === PHASE.INTRO || state.phase === PHASE.COMPLETE) return;
    state.paused = !state.paused;
    this.ui.showPause(state.paused);
    this.ui.el.hud.inert = state.paused; // nothing behind the pause card can be pressed
    if (!state.paused) this.ui.el.pause.focus({ preventScroll: true });
    if (state.paused) this.audio.suspend();
    else this.audio.resume();
    if (!state.paused) this.lastFrame = performance.now();
  }

  toggleSound() {
    state.muted = !state.muted;
    this.audio.setMuted(state.muted);
    this.ui.setSound(state.muted);
    try { localStorage.setItem('popo-muted', state.muted ? '1' : '0'); } catch (e) { /* storage may be unavailable */ }
  }

  resize() {
    this.stage.resize();
    this.ui.setScale(this.stage.scale);
    ShapeFish.setStageScale(this.stage.scale);
    for (const f of state.fish) if (f.setZoom) f.setZoom(ShapeFish.zoom);
    // keep the bubble and the hint hand on their targets even while paused
    if (this.dialogue) this.placeSpeech();
    if (this.handFish && !this.handFish.gone) this.ui.moveHand(...this.handPoint());
    this.ui.showRotateHint(this.stage.portrait);
    this.syncWaterCanvas();
  }

  // The painting is STAGE_W pixels wide, so the water pass never renders more pixels than
  // that; on big or Retina screens the browser scales it up. waterQuality drops on slow devices.
  syncWaterCanvas() {
    const c = this.stage.canvas;
    const k = Math.min(1, STAGE_W / c.width) * this.waterQuality;
    this.water.resize(Math.round(c.width * k), Math.round(c.height * k), c.style.width, c.style.height);
  }

  watchFrameRate(dt) {
    this.frameAvg = this.frameAvg * 0.97 + dt * 0.03;
    this.slowFor = this.frameAvg > 0.026 ? this.slowFor + dt : 0;
    if (this.slowFor > 2 && this.waterQuality > 0.6) {
      this.waterQuality = 0.6;
      this.slowFor = 0;
    }
  }

  // Shows feedback for a while, then brings the level's instruction back.
  revertInstructionIn(ms) {
    this.instructionRevert = ms;
  }

  updateInstruction(dt) {
    if (this.instructionRevert <= 0) return;
    this.instructionRevert -= dt * 1000;
    if (this.instructionRevert <= 0 && state.phase === PHASE.READY) {
      this.ui.setInstruction(this.level().instruction);
    }
  }

  // --- hints ------------------------------------------------------------------
  clearHint() {
    for (const f of state.fish) f.hinted = false;
  }

  updateHint(dt) {
    if (state.phase !== PHASE.READY || state.selectedFish) return;
    state.idleTime += dt;
    if (state.idleTime > HINT_DELAY && !state.hintShown) {
      state.hintShown = true;
      const target = this.inViewTarget();
      if (target) target.hinted = true;
      this.ui.pulseTarget();
      this.audio.play('hint');
      this.speakInstruction();
    }
    if (state.idleTime > HINT_DELAY + 3) {
      this.clearHint();
      state.idleTime = 0;
      state.hintShown = false;
    }
  }

  // --- loop -------------------------------------------------------------------
  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.1, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    try {
      if (!state.paused && !document.hidden) this.update(dt);
      this.draw();
    } finally {
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  // Shows one story line word by word, with comic pauses after punctuation and a boing on
  // *stressed* words. A line's cue fires when its word appears (or when a tap skips ahead).
  // Resolves once the line has been on screen long enough to read; a `stay` line then remains
  // on screen until endLine().
  say(line, token) {
    return new Promise((resolve, reject) => {
      if (this.dialogue) this.endLine();
      const words = line.text.split(' ').map((raw) => ({ text: raw.replace(/\*/g, ''), em: raw.includes('*') }));
      this.dialogue = {
        words, who: line.who, cues: [].concat(line.cue || []).map((c) => ({ ...c })), token, resolve, reject, stay: !!line.stay, settled: false,
        next: 0, wait: 0, held: 0,
        pace: 0.17,
        hold: 1000 + line.text.length * 24,
      };
      this.ui.showLine(line.who, words);
      this.placeSpeech();
      const voiced = this.audio.speak(line.who, line.text);
      if (voiced) this.paceToVoice(this.dialogue, voiced);
    });
  }

  // Spreads the words over the recording by length, with a beat after punctuation, so each
  // word appears as it's spoken. The bubble stays up a moment after the voice finishes.
  paceToVoice(d, seconds) {
    // roughly how long each word takes to say: numbers and symbols are read as words
    // ("110°" is "one hundred and ten degrees", "+" is "plus")
    const said = (t) => (/\d/.test(t) ? t.replace(/\D/g, '').length * 6 + (t.includes('°') ? 7 : 0)
      : t === '+' ? 4 : t === '=' ? 6 : t.replace(/[^a-z0-9']/gi, '').length);
    const weight = (w) => Math.max(2, said(w.text))
      + (w.text.endsWith('…') ? 5 : /[.!?]$/.test(w.text) ? 3 : w.text.endsWith(',') ? 2 : 0);
    const total = d.words.reduce((sum, w) => sum + weight(w), 0);
    let at = 0;
    d.times = d.words.map((w) => {
      const t = (at / total) * seconds * 0.88;
      at += weight(w);
      return t;
    });
    d.elapsed = 0;
    d.voiced = true;
    // after the voice ends, the bubble stays long enough for a young reader to finish it
    d.hold = (seconds - d.times[d.times.length - 1]) * 1000 + Math.max(900, d.words.length * 130);
  }

  placeSpeech() {
    const bird = this.dialogue && this.dialogue.who === 'swiftee' && this.swiftee;
    if (bird) {
      const h = bird.head();
      this.ui.placeSpeech(h.x, h.y);
      return;
    }
    const p = this.popo;
    if (p.mishap) {
      const head = p.bodyLandmark('head');
      this.ui.placeSpeech(head.x + 38, head.y - 63);
      return;
    }
    this.ui.placeSpeech(p.anchor.x + 78 + p.travelShift, p.anchor.y - 238 + p.bob);
  }

  endLine(cancelled = true) {
    const dialogue = this.dialogue;
    this.dialogue = null;
    if (this.swiftee) this.swiftee.speaking = false;
    this.ui.hideLines();
    if (dialogue && dialogue.voiced && cancelled) this.audio.stopVoice();
    if (dialogue) {
      if (cancelled) dialogue.reject(new Cancelled());
      else dialogue.resolve();
    }
  }

  revealWord(d, quiet) {
    const i = d.next;
    const word = d.words[i];
    this.ui.revealWord(i, word.em);
    const due = d.cues.filter((c) => !c.done && c.word <= i);
    if (!quiet && !due.length) {
      try { this.audio.play(word.em ? 'boing' : ({ popo: 'talk', swiftee: 'chirp' })[d.who] || 'word'); }
      catch (e) { /* Optional audio must not stall dialogue or retain input locks. */ }
    }
    for (const c of due) {
      c.done = true;
      this.storyCue(c.do);
    }
    d.next += 1;
    const last = word.text.slice(-1);
    d.wait += d.pace + (word.text.endsWith('…') ? 0.45 : '.!?'.includes(last) ? 0.3 : last === ',' ? 0.15 : 0) + (word.em ? 0.08 : 0);
  }

  skipDialogue() {
    const d = this.dialogue;
    if (!d || d.settled) return false;
    if (d.next < d.words.length) {
      while (d.next < d.words.length) this.revealWord(d, true);
    } else if (d.held >= 600) {
      d.held = d.hold;
    }
    return true;
  }

  updateDialogue(dt) {
    const d = this.dialogue;
    if (!d) return;
    if (!isCurrent(d.token)) {
      this.endLine();
      return;
    }
    if (d.next < d.words.length) {
      if (d.voiced) {
        d.elapsed += dt;
        while (d.next < d.words.length && d.elapsed >= d.times[d.next]) this.revealWord(d, true);
      } else {
        d.wait -= dt;
        while (d.wait <= 0 && d.next < d.words.length) this.revealWord(d, false);
      }
    } else {
      d.held += dt * 1000;
      if (d.held >= d.hold && !d.stay) {
        this.endLine(false);
        return;
      }
      if (d.held >= d.hold && !d.settled) {
        d.settled = true;
        d.resolve();
      }
    }
    this.placeSpeech();
  }

  // A run of short comic beats, one bubble after another. onLine(i) runs as beat i starts.
  async sayAll(lines, token, onLine = () => {}) {
    const beats = [].concat(lines);
    for (let i = 0; i < beats.length; i += 1) {
      if (i) await clock.wait(300, token); // a breath between beats
      onLine(i);
      await this.say(beats[i], token);
    }
  }

  // Moments in the scene that a story line can trigger on one of its words.
  storyCue(name) {
    if (name === 'hop') {
      this.hop = { t: 0 };
      this.audio.play('boing');
    } else if (name === 'exclaim') {
      this.mark = { char: '!', t: 0, colour: '#ffd23f' };
      this.audio.play('woah');
    } else if (name === 'wonder') {
      this.mark = { char: '?', t: 0, colour: '#7fd8ff' };
      this.audio.play('hmm');
    } else if (name === 'recallCard') {
      this.showRecall();
    } else if (name === 'recallLeg') {
      this.recallStep('leg');
    } else if (name === 'recallSum') {
      this.recallStep('sum');
    } else if (name === 'recallParallel') {
      this.recallStep('parallel');
    } else if (name === 'recallCheer') {
      this.recallStep('cheer');
    } else if (name === 'showAngles') {
      if (this.spotlight) this.spotlight.showMarks();
      this.audio.play('boing');
    } else if (name === 'twirl' && this.swiftee) {
      if (!this.fx.reduced) this.swiftee.twirl();
      this.fx.sparkle(this.swiftee.x, this.swiftee.y - 40, 8);
      this.audio.play('boing');
    }
  }

  updateStoryFx(dt) {
    if (this.recall) this.updateRecall(dt);
    if (this.hookRing) this.hookRing.t += dt;
    if (this.shadow) this.shadow.update(dt, this.area);
    this.updateComic(dt);
    if (this.trash) this.updateTrash(dt);
    if (this.ending) this.ending.t += dt;
    if (this.hop) {
      // a happy hop: up out of the water, then a splash down
      this.hop.t += dt;
      const k = this.hop.t / 0.5;
      if (k < 1) {
        this.popo.actorLift = this.fx.reduced ? 0 : -12 * Math.sin(Math.PI * k);
      } else {
        this.popo.actorLift = 0;
        this.hop = null;
        const p = this.popo.placement('fishing', 'idle');
        this.fx.splash((p.raftLeftX + p.raftRightX) / 2, this.waterline, false);
        this.fx.ripple(p.raftRightX, this.waterline + 4, 0.8);
        this.audio.play('splashSmall');
      }
    }
    if (this.mark) {
      this.mark.t += dt;
      if (this.mark.t > 1.9) this.mark = null;
    }
  }

  // A big comic "!" or "?" that pops above Popo's head and wobbles.
  // A cartoon cloud: soft white puffs burst outward and fade, hiding a quick costume change.
  drawPoof(ctx) {
    const p = this.poof;
    if (!p) return;
    const k = Math.min(1, p.t / 0.6);
    const grow = 1 - (1 - k) ** 3;
    ctx.save();
    ctx.globalAlpha = k < 0.35 ? 1 : 1 - (k - 0.35) / 0.65;
    const puffs = [];
    for (let i = 0; i < 11; i += 1) {
      const a = (i / 11) * Math.PI * 2 + 0.3;
      const d = 30 + grow * (i % 2 ? 84 : 62);
      const r = (i % 3 === 0 ? 44 : 34) * (0.75 + grow * 0.45);
      puffs.push([p.x + Math.cos(a) * d * 1.15, p.y + Math.sin(a) * d * 0.75, r]);
    }
    puffs.push([p.x, p.y, 46 * (1 - grow * 0.6)]);
    // outline first, then shade, then the white faces, so the puffs merge into one cloud
    ctx.fillStyle = '#9fc4e4';
    for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#d6eaf8';
    for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x + 3, y + 5, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#ffffff';
    for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x - 2, y - 3, r * 0.92, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  drawMark(ctx) {
    const m = this.mark;
    if (!m) return;
    const head = this.popo.headTop();
    const grow = m.t < 0.25 ? 1 + 2.2 * (m.t / 0.25 - 1) ** 3 + 1.2 * (m.t / 0.25 - 1) ** 2 : 1;
    const alpha = m.t > 1.6 ? Math.max(0, 1 - (m.t - 1.6) / 0.3) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    // pops up from just above Popo's head
    ctx.translate(head.x, head.y - 14 - Math.min(1, m.t / 0.25) * 12);
    ctx.rotate(Math.sin(m.t * 12) * 0.16 * Math.exp(-m.t * 2.5));
    ctx.scale(grow, grow);
    ctx.font = '900 86px "Arial Rounded MT Bold", "Nunito", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#2b1600';
    ctx.strokeText(m.char, 0, 0);
    ctx.fillStyle = m.colour;
    ctx.fillText(m.char, 0, 0);
    ctx.restore();
  }

  // The raft sits on the animated surface: it rises, falls and tilts with the waves under its
  // two ends, and sends out a small ripple now and then.
  rideWaves(dt) {
    const popo = this.popo;
    const p = popo.placement('fishing', 'idle');
    const shift = popo.travelShift + popo.lean;
    const left = p.raftLeftX + shift;
    const right = p.raftRightX + shift;
    if (this.water.ok) {
      const amp = this.fx.reduced ? 0.35 : 1;
      const t = this.fx.t;
      const yl = -surfaceWave(left, t) * amp;
      const yr = -surfaceWave(right, t) * amp;
      const yc = -surfaceWave((left + right) / 2, t) * amp;
      popo.waveY = (yl + yr + 2 * yc) / 4;
      popo.waveAngle = Math.atan2(yr - yl, right - left) * 0.85;
    } else {
      popo.waveY = Math.sin(popo.bobT * 1.65) * 2.4 * (this.fx.reduced ? 0.2 : 1);
      popo.waveAngle = 0;
    }
    this.raftRippleIn -= dt;
    if (this.raftRippleIn <= 0 && state.phase !== PHASE.INTRO && !popo.mishap) {
      this.raftRippleIn = 1.4 + Math.random() * 1.4;
      this.fx.ripple(Math.random() < 0.5 ? left + 8 : right - 8, this.waterline + 4, 0.55);
    }
  }

  // Average colour of the painted water just below the surface, for the water over the raft.
  surfaceColor() {
    const index = PLACES[this.place].background;
    if (this.surfaceColors[index]) return this.surfaceColors[index];
    const img = assets.backgrounds[index];
    if (!img) return null;
    let colour = [40, 170, 240];
    try {
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = 16;
      const cx = c.getContext('2d');
      cx.drawImage(img, 500, this.waterline + 8, 800, 32, 0, 0, 400, 16);
      const d = cx.getImageData(0, 0, 400, 16).data;
      const sum = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) { sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; }
      colour = sum.map((v) => Math.round(v / (d.length / 4)));
    } catch (e) { /* a tainted canvas keeps the default colour */ }
    this.surfaceColors[index] = colour;
    return colour;
  }

  // Water lapping over the bottom of the raft, following the same waves, so the raft sits in
  // the water rather than on top of it. Fades out at both ends into the painted surface.
  drawRaftWater(ctx) {
    const colour = this.surfaceColor();
    if (!colour) return;
    const popo = this.popo;
    const p = popo.placement('fishing', 'idle');
    const shift = popo.travelShift + popo.lean;
    const x0 = Math.floor(p.raftLeftX + shift - 34);
    const x1 = Math.ceil(p.raftRightX + shift + 34);
    const top = Math.floor(this.waterline - 16);
    const w = x1 - x0;
    const h = 60;
    const c = this.raftWaterCanvas || (this.raftWaterCanvas = document.createElement('canvas'));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    const t = this.fx.t;
    const amp = this.water.ok ? (this.fx.reduced ? 0.35 : 1) : 0;
    const lap = this.fx.reduced ? 0.4 : 1.6;
    const edge = (x) => this.waterline - surfaceWave(x, t) * amp + lap * Math.sin(x * 0.08 + t * 2.6) - top;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 5) g.lineTo(x, edge(x0 + x));
    g.lineTo(w, h);
    g.closePath();
    const [r, gr, b] = colour;
    const fill = g.createLinearGradient(0, 10, 0, h);
    fill.addColorStop(0, `rgba(${r}, ${gr}, ${b}, 0.88)`);
    fill.addColorStop(0.45, `rgba(${r}, ${gr}, ${b}, 0.62)`);
    fill.addColorStop(1, `rgba(${r}, ${gr}, ${b}, 0)`);
    g.fillStyle = fill;
    g.fill();
    g.beginPath();
    for (let x = 0; x <= w; x += 5) {
      const y = edge(x0 + x);
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    g.lineWidth = 7;
    g.stroke();
    g.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    g.lineWidth = 2.2;
    g.stroke();
    g.globalCompositeOperation = 'destination-in';
    const ends = g.createLinearGradient(0, 0, w, 0);
    ends.addColorStop(0, 'rgba(0, 0, 0, 0)');
    ends.addColorStop(0.13, 'rgba(0, 0, 0, 1)');
    ends.addColorStop(0.87, 'rgba(0, 0, 0, 1)');
    ends.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = ends;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(c, x0, top);
  }

  // Bubbles and splashes for the title banner. Also runs while it fades out after Play.
  updateTitle(dt) {
    this.titleFx.update(dt);
    const pa = this.playAnim;
    const { x: px, y: py } = TITLE.play;
    pa.hover += (pa.hoverTarget - pa.hover) * Math.min(1, dt * 10);
    pa.press = Math.max(0, pa.press - dt * 4);
    if (pa.burst > 0) pa.burst += dt;
    pa.bubbleIn -= dt;
    if (pa.bubbleIn <= 0) {
      pa.bubbleIn = 0.28 + Math.random() * 0.3;
      this.titleFx.puff(px + (Math.random() - 0.5) * 150, py + 70, 0, 1);
    }
    this.titleSplashIn -= dt;
    if (this.titleSplashIn <= 0) {
      this.titleSplashIn = 0.9 + Math.random() * 1.1;
      const s = TITLE.splash;
      this.titleFx.splash(s.left + Math.random() * (s.right - s.left), s.y, false);
    }
    if (state.phase !== PHASE.INTRO) this.titleFade = Math.max(0, this.titleFade - dt / 0.7);
  }

  update(dt) {
    if (state.phase === PHASE.INTRO || this.titleFade > 0) this.updateTitle(dt);
    if (!assets.sheets.fishing) return; // the title plays while the rest of the art arrives
    clock.update(dt);
    const speaking = this.dialogue && !this.dialogue.settled &&
      (this.dialogue.next < this.dialogue.words.length || this.dialogue.held < 250);
    if (this.swiftee) {
      this.swiftee.speaking = !!speaking && this.dialogue.who === 'swiftee';
      this.swiftee.teaching = !!this.recall && this.recall.t > 1;
      this.swiftee.celebrating = this.awaitingNext;
    }
    this.popo.update(dt);
    this.fx.update(dt);
    this.popo.waterResponse = this.fx.raftResponse(this.popo.anchor.x);
    this.rideWaves(dt);
    if (this.swiftee) this.swiftee.update(dt);
    if (this.poof && (this.poof.t += dt) > 0.6) this.poof = null;
    if (this.awaitingNext && this.swiftee) {
      this.nextNudge = (this.nextNudge || 3) - dt;
      if (this.nextNudge <= 0) {
        this.nextNudge = 3.4;
        this.swiftee.hop(); // Popo keeps laughing (his loop runs until Next)
        this.audio.play('chirp');
      }
    }
    this.updateDialogue(dt);
    this.updateStoryFx(dt);
    this.watchFrameRate(dt);
    for (const f of state.fish) {
      f.update(dt, this.area, state.fish);
      if (f.gone) continue;
      if (f.breath <= 0 && !f.frozen && !f.escaping) {
        f.breath = 1.6 + Math.random() * 2.6;
        f.puffs += 1 + Math.floor(Math.random() * 3);
      }
      if (f.puffs > 0) {
        this.puffFrom(f, f.puffs);
        f.puffs = 0;
      }
      if (f.trail > 0 && Math.random() < dt * 14) {
        this.fx.puff(f.x - f.dir * f.w * 0.45, f.y + (Math.random() - 0.5) * f.h * 0.3, -f.dir * 0.4, 1);
      }
    }
    if (this.ambient.some((f) => f.gone)) this.ambient = this.ambient.filter((f) => !f.gone);
    for (const f of this.ambient) f.update(dt, this.area);
    const hookOut = this.popo.line.mode === 'flight' || this.popo.line.mode === 'attached';
    for (const f of state.fish) f.gaze = hookOut ? this.popo.line.hook : null;
    if (this.popo.line.mode === 'attached' && state.selectedFish) {
      const m = mouthOf(state.selectedFish);
      this.popo.line.hook.x = m.x;
      this.popo.line.hook.y = m.y;
    }
    this.keepTargetsInView();
    if (this.handFish && !this.handFish.gone) this.ui.moveHand(...this.handPoint());
    this.updateHint(dt);
    this.updateInstruction(dt);
  }

  // The painting goes through the per-pixel water pass (src/water.js); without WebGL it is drawn
  // plainly. While Popo rows on, it pans to the next place with depth parallax. Returns the drift
  // the underwater effects follow during a row.
  drawBackground(ctx) {
    const index = PLACES[this.place].background;
    const current = assets.backgrounds[index];
    if (!current) { preloadBackground(index); return 0; }
    const k = this.transition ? this.transition.k : 0;
    const next = this.transition ? assets.backgrounds[PLACES[this.transition.to].background] : null;
    if (this.water.ok) {
      this.syncWaterCanvas();
      const drawn = this.water.render({
        from: current, to: next, mix: k, time: this.fx.t, waterline: this.waterline,
        plants: this.fx.plantsFor(index), amplitude: this.fx.reduced ? 0.35 : 1,
      });
      if (drawn) {
        this.water.show(true);
        return -Math.sin(k * Math.PI) * 18;
      }
    }
    this.water.show(false);
    if (next) this.drawParallaxPlain(ctx, current, next, k);
    else ctx.drawImage(current, 0, 0, STAGE_W, STAGE_H);
    return 0;
  }

  featheredCopy(img) {
    if (this.featheredSource === img) return this.feathered;
    const c = document.createElement('canvas');
    c.width = STAGE_W;
    c.height = STAGE_H;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0, STAGE_W, STAGE_H);
    const mask = cx.createLinearGradient(0, 0, PAN_OVERLAP, 0);
    mask.addColorStop(0, 'rgba(0, 0, 0, 0)');
    mask.addColorStop(1, 'rgba(0, 0, 0, 1)');
    cx.globalCompositeOperation = 'destination-in';
    cx.fillStyle = mask;
    cx.fillRect(0, 0, PAN_OVERLAP, STAGE_H);
    cx.fillStyle = '#000';
    cx.fillRect(PAN_OVERLAP, 0, STAGE_W - PAN_OVERLAP, STAGE_H);
    this.feathered = c;
    this.featheredSource = img;
    return c;
  }

  // Without WebGL: the two paintings slide with a feathered seam.
  drawParallaxPlain(ctx, current, next, k) {
    const pan = STAGE_W - PAN_OVERLAP;
    const ox = -k * pan;
    ctx.drawImage(current, ox, 0, STAGE_W, STAGE_H);
    ctx.save();
    ctx.translate(ox + STAGE_W * 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(current, 0, 0, STAGE_W, STAGE_H);
    ctx.restore();
    const smooth = (a, b, x) => { const v = Math.min(1, Math.max(0, (x - a) / (b - a))); return v * v * (3 - 2 * v); };
    ctx.globalAlpha = smooth(0, 0.07, k);
    ctx.drawImage(this.featheredCopy(next), ox + pan, 0, STAGE_W, STAGE_H);
    ctx.globalAlpha = smooth(0.93, 1, k);
    if (ctx.globalAlpha > 0) ctx.drawImage(next, 0, 0, STAGE_W, STAGE_H);
    ctx.globalAlpha = 1;
  }

  // --- the angle recall card and the hook reminder ---------------------------------------------
  // The card fades up and draws its trapezium on Swiftee's first word; each later step starts on
  // the word that names it (recallStep), so the card follows the voice.
  showRecall() {
    const marks = geometry.layoutMarks(RECALL.body, 30, ['angles'], { corners: RECALL.corners, font: 30 });
    this.recall = {
      t: 0, leaving: 0, trace: 0.25, parallel: Infinity, leg: Infinity, angles: [Infinity, Infinity], sum: Infinity, cheer: Infinity,
      ticked: [], chimed: false, cheered: false, marks,
      bases: geometry.classify(RECALL.body).bases, // the parallel pair, measured from the shape
    };
  }

  recallStep(step) {
    const r = this.recall;
    if (!r) return;
    if (step === 'parallel') r.parallel = Math.max(r.t, r.trace + 1.3); // once the shape is drawn
    if (step === 'leg') Object.assign(r, { leg: r.t + 0.05, angles: [r.t + 0.5, r.t + 1.1] });
    if (step === 'sum') r.sum = r.t + 0.1;
    if (step === 'cheer') r.cheer = r.t;
  }

  // A soft tick as each number appears; a ta-da as the two pieces land on the line; on "Yay!" a
  // chime, a hop from Swiftee, a happy cheer from Popo and a few sparkles at the angles.
  updateRecall(dt) {
    const r = this.recall;
    r.t += dt;
    r.angles.forEach((at, i) => {
      if (r.t >= at + 0.25 && !r.ticked[i]) { r.ticked[i] = true; this.audio.play('tick'); }
    });
    if (r.t >= r.sum + 0.75 && !r.chimed) {
      r.chimed = true;
      this.audio.play('tada');
    }
    if (r.t >= r.cheer && !r.cheered) {
      r.cheered = true;
      this.audio.play('chime');
      if (this.swiftee) this.swiftee.hop();
      this.popo.act('catch');
      const { x, y, diagram } = RECALL_CARD;
      for (const arc of r.marks.arcs) this.fx.sparkle(x + arc.at[0], y + diagram + arc.at[1], 3);
    }
    if (r.leaving && (r.leaving += dt) > 0.35) this.recall = null;
  }

  hideRecall() {
    if (this.recall) this.recall.leaving = 0.001;
  }

  // One trapezium on a card. It traces itself and fills in; its two parallel sides glow gold; its
  // left leg lights up pink and the angle at each end of it opens with its number; then the two
  // pieces fly out and snap together on a straight line, which is 180°, and the sum bounces in.
  // Everything is measured from the drawn trapezium.
  drawRecall(ctx) {
    const r = this.recall;
    if (!r) return;
    const { x, y, w, h, diagram, line, pieces } = RECALL_CARD;
    const { px, arcs, labels } = r.marks;
    const at = (start, length = 0.35) => Math.max(0, Math.min(1, (r.t - start) / length));
    const still = this.fx.reduced;
    // the card: fades in rising 14px into place, with the smallest settle
    const k0 = at(0, 0.55);
    const rise = still ? 0 : 14 * (1 - ease.out(k0)) - 2.5 * Math.sin(k0 * Math.PI) * (1 - k0);
    ctx.save();
    ctx.globalAlpha = ease.out(k0) * (r.leaving ? Math.max(0, 1 - r.leaving / 0.35) : 1);
    ctx.translate(x, y + rise);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 30);
    ctx.fillStyle = 'rgba(0, 20, 60, 0.22)';
    ctx.save();
    ctx.translate(0, 9);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff8e8';
    ctx.fill();
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#3b1d00';
    ctx.stroke();
    ctx.save();
    ctx.translate(0, diagram);
    const side = (i, from = 0, to = 1) => {
      const [p, q] = [px[i], px[(i + 1) % px.length]];
      ctx.moveTo(p[0] + (q[0] - p[0]) * from, p[1] + (q[1] - p[1]) * from);
      ctx.lineTo(p[0] + (q[0] - p[0]) * to, p[1] + (q[1] - p[1]) * to);
    };
    // the shape: its fill fades in once the outline has been traced round its real edges
    const fill = at(r.trace + 0.85, 0.35);
    if (fill > 0) {
      ctx.beginPath();
      px.forEach(([px0, py0], i) => (i ? ctx.lineTo(px0, py0) : ctx.moveTo(px0, py0)));
      ctx.closePath();
      ctx.globalAlpha *= fill;
      ctx.fillStyle = '#d6edff';
      ctx.fill();
      ctx.globalAlpha /= fill;
    }
    const lengths = px.map((p, i) => Math.hypot(px[(i + 1) % px.length][0] - p[0], px[(i + 1) % px.length][1] - p[1]));
    let left = (still ? 1 : ease.inOut(at(r.trace, 0.9))) * lengths.reduce((a, b) => a + b, 0);
    ctx.beginPath();
    lengths.forEach((len, i) => {
      if (left <= 0) return;
      side(i, 0, Math.min(1, left / len));
      left -= len;
    });
    const emphasis = Math.sin(at(r.trace + 1.0, 0.45) * Math.PI);
    ctx.lineWidth = 4 + emphasis * 2;
    ctx.strokeStyle = '#14284b';
    ctx.stroke();
    // the parallel pair: gold travels along both sides together, holds, then fades back
    const gold = at(r.parallel, 0.6) * (1 - at(r.parallel + 2.4, 0.4));
    if (gold > 0) {
      const run = still ? 1 : ease.inOut(at(r.parallel, 0.6));
      const alpha = Math.min(1, gold * 1.5);
      for (const [width, colour] of [[11, 'rgba(255, 255, 255, 0.9)'], [7, '#ffc21e']]) {
        ctx.beginPath();
        for (const i of r.bases) side(i, 0, run);
        ctx.lineWidth = width;
        ctx.strokeStyle = colour;
        ctx.globalAlpha *= alpha;
        ctx.stroke();
        ctx.globalAlpha /= alpha;
      }
    }
    // the leg, from D up to A
    const k = at(r.leg, 0.4);
    if (k > 0) {
      const [d, a] = [px[0], px[3]];
      ctx.beginPath();
      ctx.moveTo(d[0], d[1]);
      ctx.lineTo(d[0] + (a[0] - d[0]) * k, d[1] + (a[1] - d[1]) * k);
      ctx.lineWidth = 9;
      ctx.strokeStyle = '#ff5d8f';
      ctx.stroke();
    }
    // each angle opens round its corner, then its number pops a little and settles
    arcs.forEach((arc, i) => {
      const open = at(r.angles[i], 0.35);
      if (open <= 0) return;
      const piece = pieceOf(arc);
      drawPiece(ctx, arc.at, { start: piece.start, sweep: piece.sweep * (still ? 1 : ease.out(open)) }, 36, pieces[i]);
      const pop = at(r.angles[i] + 0.25, 0.3);
      if (pop <= 0) return;
      const size = 30 * (still ? 1 : 1 + 0.25 * Math.sin(pop * Math.PI));
      ctx.globalAlpha *= pop;
      drawLabel(ctx, labels[i].text, labels[i].at[0], labels[i].at[1], size);
      ctx.globalAlpha /= pop;
    });
    ctx.restore();
    // the two pieces fly down and snap together on the line: a straight angle
    const fly = at(r.sum, 0.75);
    if (fly > 0) {
      const e = still ? 1 : ease.outBack(fly);
      let start = Math.PI;
      arcs.forEach((arc, i) => {
        const from = pieceOf(arc);
        const sweep = from.sweep;
        const to = { start: start, sweep };
        start += sweep;
        let turn = to.start - from.start;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        const cx = arc.at[0] * (1 - e);
        const cy = (arc.at[1] + diagram) * (1 - e) + line * e - Math.sin(fly * Math.PI) * 30;
        drawPiece(ctx, [cx, cy], { start: from.start + turn * e, sweep }, 36 + 22 * e, pieces[i]);
      });
      const landed = at(r.sum + 0.7, 0.25);
      if (landed > 0) {
        ctx.globalAlpha *= landed;
        ctx.beginPath();
        ctx.moveTo(-96, line);
        ctx.lineTo(96, line);
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#14284b';
        ctx.stroke();
        drawLabel(ctx, `${arcs[0].degrees + arcs[1].degrees}°`, 0, line - 76, 30);
        ctx.globalAlpha /= landed;
      }
    }
    const shown = at(r.sum + 0.85, 0.4);
    if (shown > 0) {
      const text = `${arcs[0].degrees}° + ${arcs[1].degrees}° = ${arcs[0].degrees + arcs[1].degrees}°`;
      ctx.translate(0, h / 2 - 50);
      const grow = still ? 1 : 0.8 + 0.2 * ease.outBack(shown);
      ctx.scale(grow, grow);
      ctx.globalAlpha *= shown;
      ctx.font = '700 34px Fredoka, "Arial Rounded MT Bold", system-ui, sans-serif';
      const tw = ctx.measureText(text).width + 44;
      ctx.beginPath();
      ctx.roundRect(-tw / 2, -27, tw, 54, 27);
      ctx.fillStyle = '#ffe066';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#3b1d00';
      ctx.stroke();
      ctx.fillStyle = '#3b1d00';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 2);
    }
    ctx.restore();
  }

  // The first-time reminder circles the hook with a slowly turning dashed ring.
  drawHookRing(ctx) {
    const ring = this.hookRing;
    const hook = ring && this.popo.hookPosition();
    if (!hook) return;
    const pulse = this.fx.reduced ? 0 : (Math.sin(ring.t * 4) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = Math.min(1, ring.t / 0.3);
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = -ring.t * 18;
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 30, 80, 0.45)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(hook.x - 4, hook.y + 8, 27 + pulse * 5, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  // The play button floats in the water: a gentle bob and sway, a breathing warm glow behind
  // it, an occasional shine across its face, a grow on hover and a squash when pressed.
  drawPlayButton(ctx, alpha) {
    const img = assets.play;
    if (!img) return;
    const pa = this.playAnim;
    const t = this.titleFx.t;
    const { x, y, r } = TITLE.play;
    const still = this.fx.reduced;
    const bob = still ? 0 : Math.sin(t * 1.6) * 7;
    const sway = still ? 0 : Math.sin(t * 1.1) * 0.035;
    const breathe = still ? 1 : 1 + Math.sin(t * 2.4) * 0.025;
    const squash = 1 - pa.press * 0.12;
    const pop = pa.burst > 0 ? 1 + Math.sin(Math.min(1, pa.burst / 0.35) * Math.PI) * 0.18 : 1;
    const s = breathe * (1 + pa.hover * 0.07) * pop;
    const cy = y + bob;
    this.ui.placePlay(x, cy, r * s);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'screen';
    const glow = ctx.createRadialGradient(x, cy, r * 0.6, x, cy, r * 1.9);
    glow.addColorStop(0, `rgba(255, 210, 110, ${0.42 + 0.16 * Math.sin(t * 2.4) + pa.hover * 0.15})`);
    glow.addColorStop(1, 'rgba(255, 210, 110, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 2, cy - r * 2, r * 4, r * 4);
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(x, cy);
    ctx.rotate(sway);
    ctx.scale(s * (1 + pa.press * 0.06), s * squash);
    const w = img.width * (r * 2 / img.height);
    ctx.drawImage(img, -w / 2, -r, w, r * 2);
    // shine: a soft diagonal band sweeping across the disc every few seconds
    const sweep = (t % 3.4) / 1.1;
    if (sweep < 1 && !still) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.93, 0, Math.PI * 2);
      ctx.clip();
      const sx = -r * 1.6 + sweep * r * 3.2;
      const band = ctx.createLinearGradient(sx - r * 0.35, -r, sx + r * 0.35, r);
      band.addColorStop(0, 'rgba(255, 255, 255, 0)');
      band.addColorStop(0.5, 'rgba(255, 255, 255, 0.38)');
      band.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = band;
      ctx.fillRect(-r, -r, r * 2, r * 2);
    }
    ctx.restore();
  }

  drawTitle(ctx, alpha) {
    const t = this.fx.t;
    if (alpha >= 1) {
      // the banner runs through the water pass, with the surface band kept still because the
      // raft and the leaping fish sit on it; without WebGL it is drawn plainly
      this.syncWaterCanvas();
      const drawn = this.water.ok && this.water.render({
        from: assets.title, to: null, mix: 0, time: this.titleFx.t, waterline: TITLE.waterline,
        plants: [], amplitude: this.fx.reduced ? 0.35 : 1, surface: 0, seabed: TITLE.seabed,
      });
      this.water.show(Boolean(drawn));
      if (!drawn) ctx.drawImage(assets.title, 0, 0, STAGE_W, STAGE_H);
    } else {
      ctx.globalAlpha = alpha;
      ctx.drawImage(assets.title, 0, 0, STAGE_W, STAGE_H);
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    this.titleFx.drawWater(ctx, 0, []);
    ctx.restore();
    this.drawPlayButton(ctx, alpha);
    ctx.save();
    ctx.globalAlpha = alpha;
    this.titleFx.drawFront(ctx);
    // a warm, breathing sun glow in the corner and twinkles on the logo's snowy rim
    ctx.globalCompositeOperation = 'screen';
    const sun = ctx.createRadialGradient(1650, 18, 10, 1650, 18, 300);
    sun.addColorStop(0, `rgba(255, 250, 220, ${(0.32 + Math.sin(t * 0.9) * 0.08) * alpha})`);
    sun.addColorStop(1, 'rgba(255, 250, 220, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(1350, 0, STAGE_W - 1350, 320);
    ctx.globalCompositeOperation = 'source-over';
    TITLE.twinkles.forEach(([x, y], i) => {
      const k = Math.max(0, Math.sin(t * 1.3 + i * 1.7)) ** 4;
      if (k < 0.02) return;
      const r = 4 + k * 9;
      ctx.fillStyle = `rgba(255, 255, 255, ${k * alpha})`;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.quadraticCurveTo(x, y, x, y + r);
      ctx.quadraticCurveTo(x, y, x - r, y);
      ctx.quadraticCurveTo(x, y, x, y - r);
      ctx.fill();
    });
    ctx.restore();
  }

  draw() {
    const ctx = this.stage.begin();
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    if (state.phase === PHASE.INTRO) {
      this.drawTitle(ctx, 1);
      return;
    }
    const offset = this.drawBackground(ctx);
    this.fx.drawWater(ctx, offset, state.fish);
    for (const f of this.ambient) f.draw(ctx);
    if (this.shadow) this.shadow.draw(ctx);
    this.drawSpeedLines(ctx);
    // a hooked fish goes between the hook and the line: the line runs over it to its lips and
    // the hook sits inside its mouth
    const hooked = this.popo.line.mode === 'attached' ? state.selectedFish : null;
    for (const f of state.fish) if (f !== hooked) f.draw(ctx);
    for (const f of this.leapers) f.draw(ctx);
    this.fx.drawSplashLayer(ctx, false);
    if (hooked) {
      this.popo.drawLine(ctx, 'hook');
      hooked.draw(ctx);
      this.popo.drawLine(ctx, 'line');
    } else {
      this.drawTrash(ctx);
      this.popo.drawLine(ctx);
    }
    this.drawHandRipple(ctx);
    this.popo.draw(ctx);
    this.drawHookRing(ctx);
    this.drawMark(ctx);
    this.drawRaftWater(ctx);
    if (this.swiftee) this.swiftee.draw(ctx);
    this.drawPoof(ctx);
    this.drawRecall(ctx);
    this.fx.drawFront(ctx);
    this.drawVignette(ctx);
    this.drawBursts(ctx);
    if (this.titleFade > 0) this.drawTitle(ctx, this.titleFade);
    this.drawCurtain();
    this.ui.syncHits(state.fish);
  }

  // --- the big catch at the end, and the end card ------------------------------------------------
  // A big, dark fish shadow gliding deep under the raft (it's really an old boot).
  showShadow(x, y) {
    const shadow = new ShadowFish(this.area, -1);
    Object.assign(shadow, { x, baseY: y, y, size: 3.4, depth: 0, speed: 0, fade: 1.25 });
    this.shadow = shadow;
    return shadow;
  }

  // The boot hangs from the hook by its pull loop at (x, y) and swings, dripping and dangling
  // seaweed, with a tin can stuck on its toe.
  showTrash(x, y) {
    this.trash = { x, y, angle: 0.6, t: 0, hanging: false, dripIn: 0 };
    return this.trash;
  }

  updateTrash(dt) {
    const b = this.trash;
    b.t += dt;
    if (b.hanging) b.swing = Math.sin(b.t * 2.6) * 0.16 * Math.exp(-b.t * 0.35);
    if (this.popo.line.mode === 'attached') {
      this.popo.line.hook.x = b.x;
      this.popo.line.hook.y = b.y;
    }
    b.dripIn -= dt;
    if (b.y < this.waterline && b.dripIn <= 0) {
      b.dripIn = 0.22 + Math.random() * 0.2;
      this.fx.drips({ x: b.x + 16 + (Math.random() - 0.5) * 150, y: b.y + 250 });
    }
  }

  drawTrash(ctx) {
    const b = this.trash;
    if (!b) return;
    const sway = this.fx.reduced ? 0 : Math.sin(b.t * 3) * 4;
    ctx.save();
    // only the part above the water shows: it rises out of the lake and sinks back in
    ctx.beginPath();
    ctx.rect(0, 0, STAGE_W, this.waterline + 6);
    ctx.clip();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle + (b.swing || 0));
    ctx.scale(1.6, 1.6); // a huge one
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const ink = '#3d2210';
    const shape = (draw, fill, width = 4.5) => {
      ctx.beginPath();
      draw();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    // the pull loop the hook caught
    ctx.beginPath();
    ctx.ellipse(-4, 12, 9, 13, 0, 0, Math.PI * 2);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 6;
    ctx.stroke();
    // shaft and foot in one piece, shaded round like the painted scene: lit from the top left
    const bootPath = () => {
      ctx.moveTo(-52, 22);
      ctx.lineTo(40, 22);
      ctx.quadraticCurveTo(44, 70, 46, 104);
      ctx.quadraticCurveTo(70, 104, 104, 118);
      ctx.quadraticCurveTo(132, 132, 128, 158);
      ctx.lineTo(-58, 158);
      ctx.quadraticCurveTo(-62, 90, -52, 22);
    };
    const leather = ctx.createRadialGradient(-18, 60, 10, 10, 90, 170);
    leather.addColorStop(0, '#c5844c');
    leather.addColorStop(0.55, '#8f5229');
    leather.addColorStop(1, '#5c3015');
    shape(bootPath, leather);
    ctx.save();
    ctx.beginPath();
    bootPath();
    ctx.clip();
    // a soft shade down the back and under the foot, a wet sheen down the front of the shaft
    const shade = ctx.createLinearGradient(-60, 0, 130, 0);
    shade.addColorStop(0, 'rgba(40, 18, 5, 0.35)');
    shade.addColorStop(0.25, 'rgba(40, 18, 5, 0)');
    ctx.fillStyle = shade;
    ctx.fillRect(-70, 0, 210, 170);
    const under = ctx.createLinearGradient(0, 120, 0, 160);
    under.addColorStop(0, 'rgba(40, 18, 5, 0)');
    under.addColorStop(1, 'rgba(40, 18, 5, 0.4)');
    ctx.fillStyle = under;
    ctx.fillRect(-70, 120, 210, 40);
    ctx.strokeStyle = 'rgba(255, 245, 225, 0.42)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-30, 40);
    ctx.quadraticCurveTo(-36, 90, -30, 140);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(56, 114);
    ctx.quadraticCurveTo(90, 116, 112, 130);
    ctx.stroke();
    ctx.restore();
    // the sole, with a shadowed tread
    const sole = ctx.createLinearGradient(0, 152, 0, 176);
    sole.addColorStop(0, '#4a372a');
    sole.addColorStop(1, '#1f1610');
    shape(() => ctx.roundRect(-64, 152, 196, 24, 10), sole);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    for (let x = -50; x < 125; x += 22) ctx.fillRect(x, 168, 10, 8);
    // the cuff, the laces, a patch and a hole in the toe
    const cuff = ctx.createLinearGradient(0, 16, 0, 36);
    cuff.addColorStop(0, '#d39258');
    cuff.addColorStop(1, '#9c5d2f');
    shape(() => ctx.roundRect(-58, 16, 104, 20, 8), cuff, 4);
    ctx.strokeStyle = '#f2e6c8';
    ctx.lineWidth = 3;
    for (let y = 48; y < 100; y += 14) {
      ctx.beginPath();
      ctx.moveTo(14, y);
      ctx.lineTo(38, y + 9);
      ctx.moveTo(38, y);
      ctx.lineTo(14, y + 9);
      ctx.stroke();
    }
    shape(() => ctx.rect(-40, 70, 30, 28), '#5f7a3a', 3);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#d9c9a0';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-36, 74, 22, 20);
    ctx.setLineDash([]);
    ctx.fillStyle = '#1b130d';
    ctx.beginPath();
    ctx.ellipse(102, 140, 9, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // a dented tin can stuck on the toe, with a glint
    ctx.save();
    ctx.translate(122, 118);
    ctx.rotate(0.5);
    const tin = ctx.createLinearGradient(-14, 0, 14, 0);
    tin.addColorStop(0, '#8e9aa5');
    tin.addColorStop(0.35, '#e3e9ee');
    tin.addColorStop(1, '#7d8994');
    shape(() => ctx.roundRect(-14, -24, 28, 44, 5), tin, 3.5);
    ctx.fillStyle = '#d6533c';
    ctx.fillRect(-12, -10, 24, 14);
    ctx.restore();
    // drips of water shining on the leather
    ctx.fillStyle = 'rgba(220, 245, 255, 0.85)';
    for (const [x, y, r] of [[-20, 60, 3.5], [24, 112, 3], [70, 126, 2.5], [-44, 120, 3]]) {
      ctx.beginPath();
      ctx.ellipse(x, y + Math.sin(b.t * 2 + x) * 1.5, r * 0.8, r * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // seaweed ribbons draped over the top and down the sides, swaying
    for (const [x0, len, k, w] of [[-46, 130, 1, 9], [-20, 76, -1, 7], [30, 100, 1, 8]]) {
      const s1 = x0 + 18 * k + sway;
      const s2 = x0 - 16 * k - sway;
      const end = [x0 + 6 * k + sway, 20 + len];
      const weed = ctx.createLinearGradient(0, 20, 0, 20 + len);
      weed.addColorStop(0, '#4fbf5c');
      weed.addColorStop(1, '#22703a');
      ctx.beginPath();
      ctx.moveTo(x0 - w / 2, 18);
      ctx.bezierCurveTo(s1 - w / 2, 20 + len * 0.35, s2 - w / 2, 20 + len * 0.7, end[0], end[1]);
      ctx.bezierCurveTo(s2 + w / 2, 20 + len * 0.7, s1 + w / 2, 20 + len * 0.35, x0 + w / 2, 18);
      ctx.closePath();
      ctx.fillStyle = weed;
      ctx.fill();
      ctx.strokeStyle = 'rgba(20, 70, 30, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- comic flourishes for the big catch: lettering bursts, a shake, a dark vignette, speed lines
  comicReset() {
    this.bursts = [];
    this.vignette = 0;
    this.vignetteTo = 0;
    this.speedLines = 0;
    this.shaking = null;
    this.panScene(0, 0);
  }

  // A comic sound word ("YANK!") on a jagged yellow starburst that pops up and fades.
  burst(text, x, y, size = 1) {
    this.bursts.push({ text, x, y, size, t: 0, spin: (Math.random() - 0.5) * 0.3 });
  }

  shake(amount, seconds) {
    this.shaking = { amount, t: seconds, total: seconds };
  }

  updateComic(dt) {
    if (this.bursts.length) this.bursts = this.bursts.filter((b) => (b.t += dt) < 0.95);
    this.vignette += (this.vignetteTo - this.vignette) * Math.min(1, dt * 3);
    const s = this.shaking;
    if (!s) return;
    const scene = this.ui.el.scene;
    if ((s.t -= dt) > 0 && !this.fx.reduced) {
      const k = s.amount * (s.t / s.total) * this.stage.scale;
      scene.style.transform = `translate(${((Math.random() - 0.5) * 2 * k).toFixed(1)}px, ${((Math.random() - 0.5) * 2 * k).toFixed(1)}px)`;
    } else {
      this.shaking = null;
      scene.style.transform = '';
    }
  }

  drawBursts(ctx) {
    for (const b of this.bursts) {
      const pop = this.fx.reduced ? 1 : ease.outBack(Math.min(1, b.t / 0.18));
      ctx.save();
      ctx.globalAlpha = b.t > 0.7 ? Math.max(0, 1 - (b.t - 0.7) / 0.25) : 1;
      ctx.translate(b.x, b.y);
      ctx.rotate(b.spin);
      ctx.scale(pop * b.size, pop * b.size);
      ctx.font = '700 46px Fredoka, "Arial Rounded MT Bold", system-ui, sans-serif';
      const R = ctx.measureText(b.text).width / 2 + 38;
      ctx.beginPath();
      for (let i = 0; i < 28; i += 1) {
        const a = (i / 28) * TAU;
        const rad = i % 2 ? R * 0.74 : R;
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad * 0.6);
      }
      ctx.closePath();
      ctx.fillStyle = '#ffe14d';
      ctx.fill();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#3b1d00';
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 9;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(b.text, 0, 3);
      ctx.fillStyle = '#e8401c';
      ctx.fillText(b.text, 0, 3);
      ctx.restore();
    }
  }

  // Action lines streaking out from Popo across the sky while he hauls.
  drawSpeedLines(ctx) {
    if (this.speedLines < 0.01 || this.fx.reduced) return;
    const head = this.popo.headTop();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, STAGE_W, this.waterline);
    ctx.clip();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * this.speedLines})`;
    ctx.lineCap = 'round';
    for (let i = 0; i < 28; i += 1) {
      const a = (i / 28) * TAU + Math.random() * 0.08;
      const r0 = 170 + Math.random() * 70;
      const r1 = r0 + 180 + Math.random() * 280;
      ctx.lineWidth = 2 + Math.random() * 3;
      ctx.beginPath();
      ctx.moveTo(head.x + Math.cos(a) * r0, head.y + Math.sin(a) * r0);
      ctx.lineTo(head.x + Math.cos(a) * r1, head.y + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawVignette(ctx) {
    if (this.vignette < 0.01) return;
    const g = ctx.createRadialGradient(STAGE_W / 2, STAGE_H * 0.42, STAGE_H * 0.3, STAGE_W / 2, STAGE_H * 0.42, STAGE_W * 0.72);
    g.addColorStop(0, 'rgba(2, 10, 30, 0)');
    g.addColorStop(1, `rgba(2, 10, 30, ${(0.78 * this.vignette).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  }

  // The iris and "The End" are drawn on the curtain layer, above the scene. The scene slides under
  // it (panScene), so the circle always shows the live game.
  drawCurtain() {
    const busy = this.iris || this.ending;
    if (!busy && !this.curtainShown) return;
    const ctx = this.stage.beginCurtain();
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    this.curtainShown = Boolean(busy);
    if (this.iris) this.drawIris(ctx);
    if (this.ending) this.drawEnding(ctx);
  }

  // Slides the scene (painting, water, Popo, Swiftee) by (dx, dy) stage pixels.
  panScene(dx, dy) {
    const k = this.stage.scale;
    this.ui.el.scene.style.transform = dx || dy ? `translate(${(dx * k).toFixed(1)}px, ${(dy * k).toFixed(1)}px)` : '';
  }

  // The cartoon iris: everything but a circle is covered in a warm sunburst, and a cream ring
  // frames the circle.
  drawIris(ctx) {
    const iris = this.iris;
    const r = Math.max(0, iris.r);
    const t = this.fx.t;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-10, -10, STAGE_W + 20, STAGE_H + 20);
    ctx.arc(iris.x, iris.y, r, 0, TAU);
    ctx.clip('evenodd');
    const glow = ctx.createRadialGradient(iris.x, iris.y, r, iris.x, iris.y, r + STAGE_W);
    glow.addColorStop(0, '#ffb347');
    glow.addColorStop(0.18, '#ff6f61');
    glow.addColorStop(0.45, '#d9437f');
    glow.addColorStop(1, '#4b2a9b');
    ctx.fillStyle = glow;
    ctx.fillRect(-10, -10, STAGE_W + 20, STAGE_H + 20);
    // sunburst rays turning slowly around the circle
    ctx.translate(iris.x, iris.y);
    ctx.rotate(this.fx.reduced ? 0 : t * 0.08);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * TAU;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, STAGE_W * 1.5, a, a + TAU / 32);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    if (r < 4) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(iris.x, iris.y, r, 0, TAU);
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#3b1d00';
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#fff3d6';
    ctx.stroke();
    ctx.restore();
  }

  // The end: "The End" pops up above the iris, which stays open on Popo and Swiftee laughing, with a
  // few twinkles around the title.
  showEnding() {
    this.ending = { t: 0, fade: 1 };
  }

  drawEnding(ctx) {
    const { t, fade } = this.ending;
    const iris = this.iris;
    const still = this.fx.reduced;
    const cx = iris ? iris.x : STAGE_W / 2;
    const cy = iris ? Math.max(120, iris.y - iris.r - 115) : STAGE_H / 2;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = '700 168px Fredoka, "Arial Rounded MT Bold", system-ui, sans-serif';
    const text = 'The End';
    const widths = [...text].map((c) => ctx.measureText(c).width);
    let x = cx - widths.reduce((a, b) => a + b, 0) / 2;
    [...text].forEach((c, i) => {
      const k = Math.max(0, Math.min(1, (t - i * 0.08) / 0.4));
      const lx = x + widths[i] / 2;
      x += widths[i];
      if (k <= 0 || c === ' ') return;
      const pop = still ? 1 : ease.outBack(k);
      ctx.save();
      ctx.translate(lx, cy + (still ? 0 : Math.sin(t * 2.6 + i * 0.8) * 6));
      ctx.scale(pop, pop);
      ctx.lineWidth = 18;
      ctx.strokeStyle = '#3b1d00';
      ctx.strokeText(c, 0, 0);
      const fill = ctx.createLinearGradient(0, -64, 0, 64);
      fill.addColorStop(0, '#fffbe9');
      fill.addColorStop(1, '#ffc94d');
      ctx.fillStyle = fill;
      ctx.fillText(c, 0, 0);
      ctx.restore();
    });
    // twinkles around the title, like the ones on the title banner
    for (let i = 0; i < 7; i += 1) {
      const k = Math.max(0, Math.sin(t * 1.7 + i * 1.9)) ** 4;
      if (k < 0.03 || t < 0.6) continue;
      const tx = cx + Math.cos(i * 2.4) * (360 + (i % 3) * 40);
      const ty = cy + Math.sin(i * 2.4) * 70;
      const r = 6 + k * 12;
      ctx.globalAlpha = fade * k;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.moveTo(tx, ty - r);
      ctx.quadraticCurveTo(tx, ty, tx + r, ty);
      ctx.quadraticCurveTo(tx, ty, tx, ty + r);
      ctx.quadraticCurveTo(tx, ty, tx - r, ty);
      ctx.quadraticCurveTo(tx, ty, tx, ty - r);
      ctx.fill();
    }
    ctx.restore();
  }
}

Object.assign(PopoGame, { Game });
})(window.PopoGame = window.PopoGame || {});
