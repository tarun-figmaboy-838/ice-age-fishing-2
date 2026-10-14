(function (PopoGame) {
'use strict';
const { assets, preloadBackground, clock, ease, drawShell, drawPearlLight, pearlPoint, Effects, WaterScene, surfaceWave, PAN_OVERLAP, refreshShadows, ShapeFish, ShadowFish, PALETTE, PLACES, FISH, LEVELS, RECALL, STORY, geometry, Popo, correctCatch, wrongCatch, finishLevel, closeCurtain, opening, mouthOf, Cancelled, STAGE_W, STAGE_H, swimArea, raftAnchor, state, PHASE, resetProgress, newToken, isCurrent } = PopoGame;

const HINT_DELAY = 4;
const TAU = Math.PI * 2;
const LEARNED_KEY = 'popo-fishing-learned';

const between = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const shuffle = (list) => list.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);

// The angle recall (before level 5): the lesson card in the open water (its size, where its name,
// its shape, its straight line and its sum go, the shape's scale and the wedges' radius), the shell
// on the sand below it, the two flying wedges' colours, and when each angle step starts after
// "leg" (seconds): the leg, each corner's other side, wedge, number and pulse, the leg again.
const RECALL_CARD = { x: 836, y: 533, w: 900, h: 500, scale: 44, title: -192, shape: [-170, -4], line: [250, 74], sum: 190, sector: 52 };
const PEARL = { x: 836, y: 929, size: 1.12 };
const RECALL_PIECES = ['#ffb347', '#ff8f3a'];
// The bubble the card arrives and leaves in: its size, how big it swells on the pearl before it
// lets go, when it lets go and when it pops on the way in (as shares of the arrival), and how
// high it floats on the way out.
const BUBBLE = { radius: 290, seed: 62, blow: 0.3, pop: 0.78, surface: 440 };
// The penguin that belly-slides along the far shore once a level: how far into the level it may
// come (seconds), how long it takes to cross, and the snow line it slides on.
const PENGUIN = { after: [7, 16], cross: 7.5, y: 309 };
// The old boot at the end: its size, and where it hangs below the rod tip.
const BOOT = { scale: 1.05, hang: [14, 34] };
const RECALL_FONT = '700 34px Fredoka, "Arial Rounded MT Bold", system-ui, sans-serif';
const RECALL_TITLE = '700 42px Fredoka, "Arial Rounded MT Bold", system-ui, sans-serif';
// The card's lesson runs on its own clock, this much slower than real time, so every step reads
// calmly; Swiftee's next line still waits for each step to finish.
const RECALL_PACE = 1.35;
const ANGLE_STEPS = { leg: 0.25, side: [0.85, 2.55], sector: [1.35, 3.05], label: [1.8, 3.5], pulse: [2.1, 3.8], again: 2.2, done: 4.15 };

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

// A soap-film bubble: a clear body, a rainbow rim and a white glint (k: how solid, 0..1).
function drawBubble(ctx, x, y, r, t, still, k = 1) {
  if (r <= 0 || k <= 0) return;
  ctx.save();
  ctx.globalAlpha *= k;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  body.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
  body.addColorStop(0.8, 'rgba(200, 235, 255, 0.03)');
  body.addColorStop(1, 'rgba(210, 240, 255, 0.22)');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  const turn = still ? 0 : t * 0.8;
  const rim = ctx.createLinearGradient(x + Math.cos(turn) * r, y + Math.sin(turn) * r, x - Math.cos(turn) * r, y - Math.sin(turn) * r);
  rim.addColorStop(0, 'rgba(140, 230, 255, 0.75)');
  rim.addColorStop(0.35, 'rgba(255, 190, 240, 0.7)');
  rim.addColorStop(0.65, 'rgba(255, 236, 150, 0.7)');
  rim.addColorStop(1, 'rgba(150, 255, 215, 0.75)');
  ctx.lineWidth = Math.max(1.5, r * 0.035);
  ctx.strokeStyle = rim;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.8, Math.PI * 1.08, Math.PI * 1.42);
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + r * 0.42, y + r * 0.44, Math.max(1, r * 0.06), 0, TAU);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fill();
  ctx.restore();
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
    const [a, b] = PENGUIN.after;
    this.penguin = { wait: a + Math.random() * (b - a), t: 0, dir: Math.random() < 0.5 ? 1 : -1 };
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
    this.wiggleSeaweed(point);
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
      try { this.audio.play('hint'); } catch (e) { /* sound is optional */ }
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
    d.hold = (seconds - d.times[d.times.length - 1]) * 1000 + Math.max(1200, d.words.length * 170);
  }

  placeSpeech() {
    const bird = this.dialogue && this.dialogue.who === 'swiftee' && this.swiftee;
    if (bird) {
      // beside her rather than over her head: clear of her wings, the tail pointing at her beak
      this.ui.placeSpeech(bird.x + 115, bird.bobY() - 100);
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
    } else if (name.startsWith('recall:')) {
      this.recallStep(name.slice(7));
    } else if (name === 'showAngles') {
      if (this.spotlight) this.spotlight.showMarks(1.35);
      this.audio.play('boing');
    } else if (name === 'twirl' && this.swiftee) {
      if (!this.fx.reduced) this.swiftee.twirl();
      this.fx.sparkle(this.swiftee.x, this.swiftee.y - 40, 8);
      this.audio.play('boing');
    }
  }

  updateStoryFx(dt) {
    this.updateFun(dt);
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
        plants: this.fx.plantsFor(index), wiggles: this.plantWiggle, amplitude: this.fx.reduced ? 0.35 : 1,
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

  // --- the angle recall and the hook reminder ----------------------------------------------------
  // G5.1, driven by recallAngles (sequences.js): a shell on the sand opens on a glowing pearl, the
  // lake dims, and the pearl's light lifts the lesson card into the open water. The card then
  // follows Swiftee's lines, each step starting on the word that names it (recallStep). Everything
  // on it comes from the lesson's own shape: its name, its parallel sides, and for each of the two
  // chosen corners the two sides that meet there, the angle between them and its size.
  showRecall() {
    const { body, corners, names } = RECALL;
    const shape = geometry.classify(body);
    const marks = geometry.layoutMarks(body, RECALL_CARD.scale, ['parallel'], {});
    const { px, arrows } = marks;
    const n = px.length;
    const leg = px.findIndex((p, i) => corners.includes(i) && corners.includes((i + 1) % n));
    const far = (side, from) => (side === from ? px[(from + 1) % n] : px[side]);
    const ctx = this.stage.ctx;
    ctx.save();
    ctx.font = RECALL_FONT;
    const angles = corners.map((c) => {
      const v = px[c];
      const other = [(c + n - 1) % n, c].find((side) => side !== leg);
      const [u1, u2] = [far(leg, c), far(other, c)].map((q) => {
        const d = Math.hypot(q[0] - v[0], q[1] - v[1]);
        return [(q[0] - v[0]) / d, (q[1] - v[1]) / d];
      });
      const degrees = Math.round(Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]))) * 180 / Math.PI);
      const text = `${degrees}°`;
      const hw = ctx.measureText(text).width / 2 + 4;
      const hh = 19;
      // on the bisector, at the first distance where the number fits inside, clear of every side
      const b = [u1[0] + u2[0], u1[1] + u2[1]];
      const bl = Math.hypot(b[0], b[1]);
      let at = null;
      for (let d = RECALL_CARD.sector + 12; d < 200 && !at; d += 2) {
        const p = [v[0] + (b[0] / bl) * d, v[1] + (b[1] / bl) * d];
        const box = [[p[0] - hw, p[1] - hh], [p[0] + hw, p[1] - hh], [p[0] + hw, p[1] + hh], [p[0] - hw, p[1] + hh]];
        const clear = box.every((q) => geometry.inside(px, q) && px.every((a, i) => geometry.distanceToSegment(q, a, px[(i + 1) % n]) >= 5));
        const pastArc = box.every((q) => Math.hypot(q[0] - v[0], q[1] - v[1]) >= RECALL_CARD.sector + 6);
        if (clear && pastArc) at = p;
      }
      return { corner: c, name: names[c], v, far: far(other, c), piece: pieceOf({ a: u1, b: u2 }), degrees, text, at, hw, hh };
    });
    ctx.restore();
    // each corner's letter, just outside it on the line that halves its angle
    const letters = px.map((v, i) => {
      const [p, q] = [px[(i + n - 1) % n], px[(i + 1) % n]].map((w) => {
        const d = Math.hypot(w[0] - v[0], w[1] - v[1]);
        return [(w[0] - v[0]) / d, (w[1] - v[1]) / d];
      });
      const out = [-(p[0] + q[0]), -(p[1] + q[1])];
      const l = Math.hypot(out[0], out[1]);
      return { text: names[i], at: [v[0] + (out[0] / l) * 30, v[1] + (out[1] / l) * 30] };
    });
    const side = (i) => [names[i], names[(i + 1) % n]].sort().join('');
    this.recall = {
      t: 0, fired: new Set(), motes: [], pops: [], spawning: false, leaving: false, cardOut: 0,
      shell: { open: 0, rock: 0, squash: 0, leak: 0, pearl: 1, alpha: 0 },
      dim: 0, glow: 0, emerge: 0, flash: 0, beam: 0,
      name: shape.kind[0].toUpperCase() + shape.kind.slice(1),
      px, bases: shape.bases, arrows, leg: [px[corners[0]], px[corners[1]]], angles, letters,
      parallelText: shape.bases.map(side).sort().join(' ∥ '),
      sumText: `${angles.map((g) => `∠${g.name}`).join(' + ')} = ${angles.map((g) => g.text).join(' + ')} = ${angles.reduce((sum, g) => sum + g.degrees, 0)}°`,
      shape: Infinity, parallel: Infinity, angleAt: Infinity, anglesDone: Infinity, sum: Infinity, cheer: Infinity,
    };
    return this.recall;
  }

  recallStep(step) {
    const r = this.recall;
    if (!r) return;
    if (step === 'shape') r.shape = r.t;
    if (step === 'parallel') r.parallel = Math.max(r.t, r.shape + 1.3); // once the shape is drawn
    if (step === 'angles') {
      r.angleAt = Math.max(r.t, r.parallel + 1);
      r.anglesDone = r.angleAt + ANGLE_STEPS.done;
    }
    if (step === 'sum') r.sum = Math.max(r.t, r.anglesDone);
    if (step === 'cheer') r.cheer = r.t;
  }

  // Each drawing step's sound, once, as it starts; gold motes rising while the card emerges; on
  // "Yay!" a chime, a hop from Swiftee and sparkles over the straight line.
  updateRecall(dt) {
    const r = this.recall;
    r.t += dt / RECALL_PACE;
    const once = (key, time, fn) => {
      if (r.t >= time && !r.fired.has(key)) {
        r.fired.add(key);
        fn();
      }
    };
    const sound = (name) => () => this.audio.play(name);
    const A = r.angleAt;
    once('trace', r.shape, sound('trace'));
    once('name', r.shape + 0.5, sound('bloop'));
    once('parallel', r.parallel, sound('pluck'));
    once('arrows', r.parallel + 0.5, sound('tick'));
    once('leg', A + ANGLE_STEPS.leg, sound('pluck'));
    r.angles.forEach((_, i) => {
      once(`side${i}`, A + ANGLE_STEPS.side[i], sound('pluck'));
      once(`sector${i}`, A + ANGLE_STEPS.sector[i], sound('ascend'));
      once(`label${i}`, A + ANGLE_STEPS.label[i], sound('tick'));
    });
    once('landed', r.sum + 0.75, sound('tada'));
    once('cheer', r.cheer, () => {
      this.audio.play('chime');
      if (this.swiftee) this.swiftee.hop();
      const { x, y, line } = RECALL_CARD;
      this.fx.sparkle(x + line[0], y + line[1] - 40, 8);
    });
    if (r.spawning && Math.random() < dt * 9) {
      const [px, py] = pearlPoint(PEARL.x, PEARL.y, PEARL.size);
      this.fx.puff(px + (Math.random() - 0.5) * 30, py - 10, 0, 1, Math.random() < 0.4);
    }
    if ((r.spawning || r.beam > 0.2) && !this.fx.reduced && Math.random() < dt * (r.spawning ? 14 : 4)) {
      const [px, py] = pearlPoint(PEARL.x, PEARL.y, PEARL.size);
      r.motes.push({ x: px + (Math.random() - 0.5) * 24, y: py - 6, vx: (Math.random() - 0.5) * 30, vy: -70 - Math.random() * 60, life: 0 });
    }
    for (const m of r.motes) {
      m.life += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
    }
    r.motes = r.motes.filter((m) => m.life < 1.3 && m.y > RECALL_CARD.y + RECALL_CARD.h / 2);
    if (r.leaving) r.cardOut = Math.min(1, r.cardOut + dt / 1.6);
    // the bubble pops: arriving in the middle, and leaving near the surface
    const burst = (x, y, radius) => {
      this.audio.play('pop');
      for (let i = 0; i < (this.fx.reduced ? 6 : 22); i += 1) {
        const a = (i / 22) * TAU + Math.random() * 0.3;
        const speed = 90 + Math.random() * 160;
        r.pops.push({ x: x + Math.cos(a) * radius, y: y + Math.sin(a) * radius, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 40, r: 4 + Math.random() * 9, life: 0 });
      }
      this.fx.sparkle(x, y - radius * 0.5, 10);
    };
    if (r.emerge >= BUBBLE.pop) once('pop', 0, () => burst(RECALL_CARD.x, RECALL_CARD.y, BUBBLE.radius));
    if (r.cardOut >= 0.85) once('popOut', 0, () => burst(RECALL_CARD.x, BUBBLE.surface, BUBBLE.radius * 0.65));
    for (const p of r.pops) {
      p.life += dt / 0.9;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 2.5;
      p.vy = p.vy * (1 - dt * 2.5) - 60 * dt; // slowing, then drifting up
    }
    r.pops = r.pops.filter((p) => p.life < 1);
  }

  pearlAt() {
    return pearlPoint(PEARL.x, PEARL.y, PEARL.size);
  }

  hideRecall() {
    if (this.recall) this.recall.leaving = true;
  }

  // Under the card: the lake dimmed round the lesson, the shell on the sand, the pearl's light and
  // its rising motes. Popo and the lake dim; Swiftee and the card, drawn after, stay bright.
  drawPearlScene(ctx) {
    const r = this.recall;
    if (!r) return;
    if (r.dim > 0) {
      const { x, y } = RECALL_CARD;
      const dim = ctx.createRadialGradient(x, y, 300, x, y, 1100);
      dim.addColorStop(0, `rgba(4, 14, 40, ${0.46 * r.dim})`);
      dim.addColorStop(1, `rgba(4, 14, 40, ${0.62 * r.dim})`);
      ctx.fillStyle = dim;
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    }
    if (r.shell.alpha <= 0) return;
    drawShell(ctx, PEARL.x, PEARL.y, PEARL.size, r.shell);
    drawPearlLight(ctx, PEARL.x, PEARL.y, PEARL.size, r.glow * r.shell.alpha * Math.min(1, r.shell.open * 2), r.t, this.fx.reduced);
    if (r.motes.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const m of r.motes) {
        const a = Math.sin(Math.min(1, m.life / 1.3) * Math.PI);
        ctx.fillStyle = `rgba(255, 214, 120, ${0.85 * a})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 2.6, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // The pearl blows the card in a bubble: a shimmering bubble swells out of the pearl's light and
  // rises to the middle of the screen with the card small inside it, then pops in a spray of tiny
  // bubbles and twinkles and the card springs out to full size. Leaving, the card shrinks back
  // into a bubble that floats up towards the surface and pops. A faint cone of the pearl's light
  // stays on the card while the lesson runs. On the card the lesson goes step by step: the
  // trapezium traces itself and fills in under its name, and its corners get their letters; its
  // parallel sides light up pink with matching arrows ("AB ∥ CD"); for each corner on the chosen
  // leg the two sides that meet there light up one after the other, the angle between them opens
  // as an orange wedge, and its size pops in on the bisector; finally copies of the two wedges fly
  // onto a straight line: ∠D + ∠A = 180°.
  drawRecall(ctx) {
    const r = this.recall;
    if (!r) return;
    const C = RECALL_CARD;
    const at = (start, length = 0.35) => Math.max(0, Math.min(1, (r.t - start) / length));
    const still = this.fx.reduced;
    const [sx, sy] = pearlPoint(PEARL.x, PEARL.y, PEARL.size);
    if (r.beam > 0) this.drawPearlBeam(ctx, r, sx, sy, C.y + C.h / 2, 1, 1);
    const b = this.recallBubble(r, sx, sy);
    if (b.card > 0) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(b.card, b.card);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.roundRect(-C.w / 2, -C.h / 2, C.w, C.h, 30);
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
      if (r.flash > 0) {
        ctx.fillStyle = `rgba(255, 250, 235, ${0.7 * r.flash})`;
        ctx.fill();
      }
      if (r.t >= r.shape) this.drawLesson(ctx, r, at, still);
      ctx.restore();
    }
    if (b.radius > 0) drawBubble(ctx, b.x, b.y, b.radius, r.t, still);
    if (r.pops.length) {
      ctx.save();
      for (const p of r.pops) drawBubble(ctx, p.x, p.y, p.r * (1 - 0.3 * p.life), r.t + p.r, true, 1 - p.life);
      ctx.restore();
    }
  }

  // Where the bubble and the card are: rising from the pearl and popping at the middle (emerge),
  // then, leaving, closing round the card and floating up to pop near the surface (cardOut).
  recallBubble(r, sx, sy) {
    const C = RECALL_CARD;
    const still = this.fx.reduced;
    const small = (BUBBLE.radius * 1.55) / C.w; // the card's size inside the bubble
    if (r.cardOut > 0) {
      const close = Math.min(1, r.cardOut / 0.3);
      const float = ease.inOut(Math.max(0, Math.min(1, (r.cardOut - 0.3) / 0.55)));
      if (r.cardOut >= 0.85) return { x: C.x, y: 0, radius: 0, card: 0 };
      const y = C.y + (BUBBLE.surface - C.y) * float;
      const shrink = 1 - 0.35 * float;
      return { x: C.x + (still ? 0 : Math.sin(float * Math.PI * 2) * 18), y, radius: BUBBLE.radius * ease.out(close) * shrink, card: (1 + (small - 1) * ease.inOut(close)) * shrink };
    }
    if (r.emerge <= 0) return { x: sx, y: sy, radius: 0, card: 0 };
    // first it swells out of the pearl, sitting on it in the open shell, with a little wobble
    const blow = Math.min(1, r.emerge / BUBBLE.blow);
    if (blow < 1) {
      const radius = 6 + (BUBBLE.seed - 6) * (still ? blow : ease.out(blow));
      const wobble = still ? 0 : Math.sin(blow * Math.PI * 4) * 0.06 * (1 - blow);
      return { x: sx, y: sy - radius * (1 - wobble), radius, card: small * (radius / BUBBLE.radius) * blow };
    }
    // then it lets go and rises, growing, to the middle of the screen
    const rise = Math.min(1, (r.emerge - BUBBLE.blow) / (BUBBLE.pop - BUBBLE.blow));
    if (rise < 1) {
      const k = still ? rise : ease.inOut(rise);
      const radius = BUBBLE.seed + (BUBBLE.radius - BUBBLE.seed) * (still ? rise : ease.inOut(rise));
      const startY = sy - BUBBLE.seed;
      return {
        x: sx + (C.x - sx) * k + (still ? 0 : Math.sin(rise * Math.PI * 2) * 18 * (1 - k)),
        y: startY + (C.y - startY) * k,
        radius,
        card: small * (radius / BUBBLE.radius),
      };
    }
    // ...and out springs the card, settling with the gentlest overshoot
    const spring = Math.min(1, (r.emerge - BUBBLE.pop) / (1 - BUBBLE.pop));
    const settle = 1 + 1.5 * (spring - 1) ** 3 + 0.5 * (spring - 1) ** 2;
    return { x: C.x, y: C.y, radius: 0, card: small + (1 - small) * (still ? 1 : settle) };
  }

  // The pearl's beam: up from the pearl, then open into a cone whose top is the card's bottom edge,
  // tinted like the inside of a shell, with bands of light rippling up it as through water.
  drawPearlBeam(ctx, r, sx, sy, bottom, rise, open) {
    const C = RECALL_CARD;
    const top = sy + (bottom - sy) * ease.out(rise);
    const half = 16 + (C.w / 2 - 16) * open;
    const wave = (k) => (this.fx.reduced ? 0 : Math.sin(r.t * 2.2 + k * 9) * 6 * open);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.moveTo(sx - 6, sy - 4);
    for (let i = 1; i <= 10; i += 1) {
      const k = i / 10;
      ctx.lineTo(sx - 6 + (C.x - half - sx + 6) * k + wave(k), sy + (top - sy) * k);
    }
    for (let i = 10; i >= 1; i -= 1) {
      const k = i / 10;
      ctx.lineTo(sx + 6 + (C.x + half - sx - 6) * k - wave(k + 0.5), sy + (top - sy) * k);
    }
    ctx.lineTo(sx + 6, sy - 4);
    ctx.closePath();
    const cone = ctx.createLinearGradient(0, sy, 0, top);
    cone.addColorStop(0, `rgba(255, 238, 200, ${0.55 * r.beam})`);
    cone.addColorStop(0.5, `rgba(255, 210, 235, ${0.22 * r.beam})`);
    cone.addColorStop(1, `rgba(170, 235, 255, ${0.14 * r.beam})`);
    ctx.fillStyle = cone;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // ripples of light drifting up the cone
    if (!this.fx.reduced) {
      for (let i = 0; i < 5; i += 1) {
        const k = ((r.t * 0.35 + i / 5) % 1);
        const y = sy + (top - sy) * k;
        const band = ctx.createLinearGradient(0, y - 10, 0, y + 10);
        band.addColorStop(0, 'rgba(255, 255, 255, 0)');
        band.addColorStop(0.5, `rgba(255, 255, 245, ${0.16 * r.beam * Math.sin(k * Math.PI)})`);
        band.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = band;
        ctx.beginPath();
        for (let j = 0; j <= 12; j += 1) {
          const x = C.x - C.w / 2 + (j / 12) * C.w;
          const yy = y + Math.sin(j * 1.3 + r.t * 3) * 5;
          if (j) ctx.lineTo(x, yy);
          else ctx.moveTo(x, yy - 10);
        }
        ctx.lineTo(C.x + C.w / 2, y + 12);
        ctx.lineTo(C.x - C.w / 2, y + 12);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
    const core = ctx.createLinearGradient(0, sy, 0, top);
    core.addColorStop(0, `rgba(255, 252, 235, ${0.7 * r.beam})`);
    core.addColorStop(1, 'rgba(255, 252, 235, 0)');
    ctx.beginPath();
    ctx.moveTo(sx - 4, sy - 4);
    ctx.lineTo(C.x - half * 0.2, top);
    ctx.lineTo(C.x + half * 0.2, top);
    ctx.lineTo(sx + 4, sy - 4);
    ctx.closePath();
    ctx.fillStyle = core;
    ctx.fill();
    ctx.restore();
  }

  drawLesson(ctx, r, at, still) {
    const C = RECALL_CARD;
    const A = r.angleAt;
    const S = ANGLE_STEPS;
    const n = r.px.length;
    const line = (p, q, from = 0, to = 1) => {
      ctx.moveTo(p[0] + (q[0] - p[0]) * from, p[1] + (q[1] - p[1]) * from);
      ctx.lineTo(p[0] + (q[0] - p[0]) * to, p[1] + (q[1] - p[1]) * to);
    };
    const stroke = (width, colour, alpha = 1) => {
      if (alpha <= 0) return;
      ctx.globalAlpha *= alpha;
      ctx.lineWidth = width;
      ctx.strokeStyle = colour;
      ctx.stroke();
      ctx.globalAlpha /= alpha;
    };
    // the name
    const named = at(r.shape + 0.5, 0.3);
    if (named > 0) {
      ctx.save();
      ctx.translate(0, C.title);
      const pop = still ? 1 : 0.8 + 0.2 * ease.outBack(named);
      ctx.scale(pop, pop);
      ctx.globalAlpha *= named;
      ctx.font = RECALL_TITLE;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#14284b';
      ctx.fillText(r.name, 0, 0);
      ctx.restore();
    }
    // the shape slides aside to make room for the straight line when the sum begins
    const aside = still ? (r.t >= r.sum ? 1 : 0) : ease.inOut(at(r.sum, 0.5));
    ctx.save();
    ctx.translate(C.shape[0] * aside, C.shape[1]);
    const { px } = r;
    const fill = at(r.shape + 0.85, 0.35);
    if (fill > 0) {
      ctx.beginPath();
      px.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.globalAlpha *= fill;
      ctx.fillStyle = '#d6edff';
      ctx.fill();
      ctx.globalAlpha /= fill;
    }
    // the angle wedges, under the sides: orange, then a firmer arc, pulsing once when complete
    r.angles.forEach((g, i) => {
      const open = at(A + S.sector[i], 0.45);
      if (open <= 0) return;
      const pulse = Math.sin(at(A + S.pulse[i], 0.35) * Math.PI);
      const sweep = g.piece.sweep * (still ? 1 : ease.out(open));
      const radius = C.sector + pulse * 3;
      ctx.beginPath();
      ctx.moveTo(g.v[0], g.v[1]);
      ctx.arc(g.v[0], g.v[1], radius, g.piece.start, g.piece.start + sweep);
      ctx.closePath();
      ctx.fillStyle = `rgba(255, 138, 28, ${0.55 + 0.2 * pulse})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(g.v[0], g.v[1], radius, g.piece.start, g.piece.start + sweep);
      stroke(3.5 + 2 * pulse, '#c4501a');
    });
    // the outline, traced round its real edges
    const lengths = px.map((p, i) => Math.hypot(px[(i + 1) % n][0] - p[0], px[(i + 1) % n][1] - p[1]));
    let left = (still ? 1 : ease.inOut(at(r.shape, 0.9))) * lengths.reduce((a, b) => a + b, 0);
    ctx.beginPath();
    lengths.forEach((len, i) => {
      if (left <= 0) return;
      line(px[i], px[(i + 1) % n], 0, Math.min(1, left / len));
      left -= len;
    });
    stroke(4 + Math.sin(at(r.shape + 1, 0.45) * Math.PI) * 2, '#14284b');
    // the parallel pair: pink along both at once, held until the angles begin
    const pink = at(r.parallel, 0.6) * (1 - at(A, 0.3));
    if (pink > 0) {
      const run = still ? 1 : ease.inOut(at(r.parallel, 0.6));
      ctx.beginPath();
      for (const i of r.bases) line(px[i], px[(i + 1) % n], 0, run);
      stroke(8, '#ff3d8b', pink);
    }
    // matching arrows on the parallel sides (they stay)
    const arrows = at(r.parallel + 0.5, 0.25);
    if (arrows > 0) {
      const pop = still ? 1 : 0.6 + 0.4 * ease.outBack(arrows);
      for (const { at: [x, y], dir: [dx, dy] } of r.arrows) {
        const [ax, ay] = [dx * 9 * pop, dy * 9 * pop];
        const [nx, ny] = [-dy * 8 * pop, dx * 8 * pop];
        ctx.beginPath();
        ctx.moveTo(x - ax + nx, y - ay + ny);
        ctx.lineTo(x + ax, y + ay);
        ctx.lineTo(x - ax - nx, y - ay - ny);
        stroke(3.5, '#14284b', arrows);
      }
    }
    // the leg, from the first corner to the second, then each corner's other side from the corner
    const legOn = at(A + S.leg, 0.45);
    if (legOn > 0) {
      ctx.beginPath();
      line(r.leg[0], r.leg[1], 0, still ? 1 : ease.inOut(legOn));
      stroke(8 + 3 * Math.sin(at(A + S.again, 0.35) * Math.PI), '#ff3d8b');
    }
    r.angles.forEach((g, i) => {
      const on = at(A + S.side[i], 0.4);
      if (on <= 0) return;
      ctx.beginPath();
      line(g.v, g.far, 0, still ? 1 : ease.inOut(on));
      stroke(8, '#ff3d8b');
    });
    // the corners' letters, once the shape is drawn
    const lettered = at(r.shape + 0.9, 0.4);
    if (lettered > 0) {
      ctx.save();
      ctx.globalAlpha *= lettered;
      ctx.font = RECALL_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#14284b';
      for (const { text, at: [x, y] } of r.letters) ctx.fillText(text, x, y + 1);
      ctx.restore();
    }
    // each angle's size, on its bisector
    r.angles.forEach((g, i) => {
      const pop = at(A + S.label[i], 0.3);
      if (pop <= 0 || !g.at) return;
      ctx.save();
      ctx.translate(g.at[0], g.at[1]);
      const grow = still ? 1 : 1 + 0.25 * Math.sin(pop * Math.PI);
      ctx.scale(grow, grow);
      ctx.globalAlpha *= pop;
      ctx.font = RECALL_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#fff8e8';
      ctx.strokeText(g.text, 0, 1);
      ctx.fillStyle = '#14284b';
      ctx.fillText(g.text, 0, 1);
      ctx.restore();
    });
    ctx.restore();
    // copies of the two wedges fly out and snap together on a straight line: 180°
    const fly = at(r.sum + 0.2, 0.75);
    if (fly > 0) {
      const ke = still ? 1 : ease.outBack(fly);
      const [lx, ly] = C.line;
      let start = Math.PI;
      r.angles.forEach((g, i) => {
        const from = g.piece;
        let turn = start - from.start;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        const ox = C.shape[0] * aside + g.v[0];
        const oy = C.shape[1] + g.v[1];
        const cx = ox + (lx - ox) * ke;
        const cy = oy + (ly - oy) * ke - Math.sin(fly * Math.PI) * 30;
        drawPiece(ctx, [cx, cy], { start: from.start + turn * ke, sweep: from.sweep }, C.sector + 16 * ke, RECALL_PIECES[i]);
        start += from.sweep;
      });
      const landed = at(r.sum + 0.9, 0.25);
      if (landed > 0) {
        ctx.globalAlpha *= landed;
        ctx.beginPath();
        ctx.moveTo(lx - 125, ly);
        ctx.lineTo(lx + 125, ly);
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#14284b';
        ctx.stroke();
        const total = r.angles.reduce((sum, g) => sum + g.degrees, 0);
        ctx.font = RECALL_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#14284b';
        ctx.fillText(`${total}°`, lx, ly - C.sector - 40);
        ctx.globalAlpha /= landed;
      }
    }
    // the statement under it all: "AB ∥ CD" while the parallel sides are shown, then the sum
    const said = at(r.parallel + 0.6, 0.3) * (1 - at(A, 0.3));
    if (said > 0) this.drawStatement(ctx, r.parallelText, C.sum, said, false, still);
    const shown = at(r.sum + 1, 0.4);
    if (shown > 0) this.drawStatement(ctx, r.sumText, C.sum, shown, true, still, Math.sin(at(r.cheer, 0.45) * Math.PI));
  }

  // A line of mathematics in a pill: plain for a fact, gold for the answer.
  drawStatement(ctx, text, y, k, gold, still, swell = 0) {
    ctx.save();
    ctx.translate(0, y);
    const grow = (still ? 1 : 0.8 + 0.2 * ease.outBack(k)) * (1 + 0.08 * swell);
    ctx.scale(grow, grow);
    ctx.globalAlpha *= k;
    ctx.font = '700 36px Fredoka, "Arial Rounded MT Bold", system-ui, sans-serif';
    const ink = gold ? '#3b1d00' : '#14284b';
    // the font has no ∥ or ∠, so those two are drawn as shapes, sized to the letters
    const SYMBOL = { '∥': 22, '∠': 26 };
    const parts = text.split(/([∥∠])/).filter(Boolean);
    const widths = parts.map((part) => SYMBOL[part] || ctx.measureText(part).width);
    const tw = widths.reduce((a, b) => a + b, 0) + 48;
    ctx.beginPath();
    ctx.roundRect(-tw / 2, -30, tw, 60, 30);
    ctx.fillStyle = gold ? '#ffe066' : '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let x = -tw / 2 + 24;
    parts.forEach((part, i) => {
      const w = widths[i];
      ctx.beginPath();
      if (part === '∥') {
        for (const dx of [w * 0.32, w * 0.68]) {
          ctx.moveTo(x + dx, -14);
          ctx.lineTo(x + dx, 15);
        }
        ctx.stroke();
      } else if (part === '∠') {
        ctx.moveTo(x + w * 0.85, -12);
        ctx.lineTo(x + w * 0.12, 13);
        ctx.lineTo(x + w * 0.92, 13);
        ctx.stroke();
      } else {
        ctx.fillText(part, x, 2);
      }
      x += w;
    });
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
    this.drawPenguin(ctx);
    this.fx.drawWater(ctx, offset, state.fish);
    for (const f of this.ambient) f.draw(ctx);
    if (this.shadow) this.shadow.draw(ctx);
    this.drawSpeedLines(ctx);
    // a hooked fish goes between the hook and the line: the line runs over it to its lips and
    // the hook sits inside its mouth
    const selected = state.selectedFish;
    const hooked = this.popo.line.mode === 'attached' && selected && !selected.gone ? selected : null;
    for (const f of state.fish) if (f !== hooked) f.draw(ctx);
    for (const f of this.leapers) f.draw(ctx);
    this.fx.drawSplashLayer(ctx, false);
    // the boot and its spout at the end, whatever fish was last on the line
    this.drawTrash(ctx);
    this.drawGeyser(ctx);
    if (hooked) {
      this.popo.drawLine(ctx, 'hook');
      hooked.draw(ctx);
      this.popo.drawLine(ctx, 'line');
    } else {
      this.popo.drawLine(ctx);
    }
    this.drawHandRipple(ctx);
    this.popo.draw(ctx);
    this.drawBucketFish(ctx);
    this.drawConfetti(ctx);
    this.drawWhy(ctx);
    this.drawHookRing(ctx);
    this.drawMark(ctx);
    this.drawRaftWater(ctx);
    this.drawPearlScene(ctx);
    if (this.swiftee) this.swiftee.draw(ctx);
    this.drawPoof(ctx);
    this.drawRecall(ctx);
    this.fx.drawFront(ctx);
    this.drawVignette(ctx);
    if (this.titleFade > 0) this.drawTitle(ctx, this.titleFade);
    this.drawCurtain();
    this.ui.syncHits(state.fish);
  }

  // --- why a wrong fish isn't one -------------------------------------------------------------------
  // A bright card over the fish with the reason in a few words (the level's `why`, which
  // Popo also says), and in level 5 its own angles (95° + 105° = 200°). Meanwhile the fish lights
  // up: its marked angles swell into gold fans, or, with nothing marked, its legs (when they're
  // the reason) or its whole outline glow.
  showWhy(fish) {
    const level = this.level();
    if (!level.why) return;
    const [a, b] = fish.spec.angles || [];
    const detail = level.compare === 'sum' && a !== undefined ? `${a}° + ${b}° = *${a + b}°*` : '';
    const marked = fish.marksFor && fish.marksFor(ShapeFish.labelFont).arcs.length > 0;
    if (marked) fish.showMarks(1.15);
    const legs = !marked && level.glow === 'legs' ? geometry.classify(fish.spec.body).legs : null;
    this.why = { fish, text: level.why, detail, outline: !marked, legs, t: 0, out: 0 };
    this.audio.play('nope');
  }

  hideWhy() {
    if (!this.why || this.why.out) return;
    this.why.out = 0.001;
    this.why.fish.hideMarks();
  }

  updateWhy(dt) {
    const w = this.why;
    if (!w) return;
    w.t += dt;
    if (w.out && (w.out += dt) > 0.35) this.why = null;
  }

  drawWhy(ctx) {
    const w = this.why;
    if (!w || w.fish.gone || w.fish.offstage) return;
    const f = w.fish;
    const still = this.fx.reduced;
    const fade = w.out ? Math.max(0, 1 - w.out / 0.35) : 1;
    // with nothing marked, what gives it away glows: its legs, or its whole outline
    if (w.outline && f.marksFor) {
      const px = f.marksFor(ShapeFish.labelFont).px;
      const glow = (0.6 + 0.4 * Math.sin(w.t * 6)) * fade * Math.min(1, w.t / 0.3);
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (w.legs) {
        for (const s of w.legs) {
          const [x0, y0] = f.toStage(px[s]);
          const [x1, y1] = f.toStage(px[(s + 1) % px.length]);
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
        }
      } else {
        px.forEach((q, i) => {
          const [x, y] = f.toStage(q);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.closePath();
      }
      for (const [width, colour] of [[22, `rgba(255, 220, 90, ${0.4 * glow})`], [8, `rgba(255, 190, 40, ${glow})`]]) {
        ctx.lineWidth = width;
        ctx.strokeStyle = colour;
        ctx.stroke();
      }
      ctx.restore();
    }
    // the card, over the fish (or under it when the fish swims high), never off the stage: white,
    // with the reason in orange, its pointer part of the same outline
    ctx.save();
    const font = (weight, size) => `${weight} ${size}px Fredoka, "Arial Rounded MT Bold", system-ui, sans-serif`;
    // a line in runs: dark brown, its *stressed* words in the game's orange (as in the instruction)
    const runs = (text) => text.split(/(\*[^*]+\*)/).filter(Boolean).map((part) => ({ text: part.replace(/\*/g, ''), em: part.startsWith('*') }));
    const width = (parts) => parts.reduce((sum, p) => sum + ctx.measureText(p.text).width, 0);
    const say = (parts, y) => {
      let x = -width(parts) / 2;
      for (const p of parts) {
        ctx.fillStyle = p.em ? '#e8590c' : '#3b1d00';
        ctx.fillText(p.text, x, y);
        x += ctx.measureText(p.text).width;
      }
    };
    const line = runs(w.text);
    const extra = w.detail ? runs(w.detail) : null;
    ctx.font = font(700, 33);
    const tw = width(line);
    ctx.font = font(700, 29);
    const dw = extra ? width(extra) : 0;
    const W = Math.max(tw, dw) + 52;
    const H = w.detail ? 100 : 72;
    const half = (f.h * f.scale * (f.zoom || 1)) / 2;
    let below = false;
    let top = f.y - half - 36 - H;
    if (top < this.waterline + 14) {
      below = true;
      top = f.y + half + 34;
    }
    top = Math.min(STAGE_H - H - 12, top);
    const left = Math.max(16, Math.min(STAGE_W - W - 16, f.x - W / 2));
    const pop = still ? 1 : ease.outBack(Math.min(1, w.t / 0.4));
    const wobble = still ? 0 : Math.sin(w.t * 9) * 0.05 * Math.max(0, 1 - w.t / 0.8);
    const bob = still ? 0 : Math.sin(w.t * 2.4) * 3;
    ctx.globalAlpha = fade;
    ctx.translate(left + W / 2, top + H / 2 + bob);
    ctx.rotate(wobble);
    ctx.scale(pop, pop);
    ctx.lineJoin = 'round';
    const r = 26;
    const hw = W / 2;
    const hh = H / 2;
    const tail = 15;
    const reach = 20;
    const tx = Math.max(-hw + r + tail, Math.min(hw - r - tail, f.x - (left + W / 2)));
    // one outline round the card and its pointer, so the pointer flows out of it
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(-hw + r, -hh);
      if (below) {
        ctx.lineTo(tx - tail, -hh);
        ctx.lineTo(tx, -hh - reach);
        ctx.lineTo(tx + tail, -hh);
      }
      ctx.lineTo(hw - r, -hh);
      ctx.arcTo(hw, -hh, hw, -hh + r, r);
      ctx.lineTo(hw, hh - r);
      ctx.arcTo(hw, hh, hw - r, hh, r);
      if (!below) {
        ctx.lineTo(tx + tail, hh);
        ctx.lineTo(tx, hh + reach);
        ctx.lineTo(tx - tail, hh);
      }
      ctx.lineTo(-hw + r, hh);
      ctx.arcTo(-hw, hh, -hw, hh - r, r);
      ctx.lineTo(-hw, -hh + r);
      ctx.arcTo(-hw, -hh, -hw + r, -hh, r);
      ctx.closePath();
    };
    shape();
    ctx.fillStyle = 'rgba(0, 20, 60, 0.28)';
    ctx.save();
    ctx.translate(0, 7);
    ctx.fill();
    ctx.restore();
    // white inside, a dark brown edge
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#3b1d00';
    ctx.stroke();
    // the reason, and in level 5 the fish's own angles
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = font(700, 33);
    say(line, extra ? -15 : 3);
    if (extra) {
      ctx.font = font(700, 29);
      say(extra, 25);
    }
    ctx.restore();
  }

  // --- little fun: bubble confetti, curious taps, the fish in the bucket, a penguin -----------------
  updateFun(dt) {
    this.updateWhy(dt);
    for (const c of this.confetti) {
      c.life += dt / 2.2;
      c.vx *= 1 - Math.min(1, dt * 1.8);
      c.vy = c.vy * (1 - Math.min(1, dt * 1.8)) - 45 * dt;
      c.x += (c.vx + Math.sin(c.life * 9 + c.wob) * 18) * dt;
      c.y += c.vy * dt;
    }
    if (this.confetti.length) this.confetti = this.confetti.filter((c) => c.life < 1);
    for (let i = 0; i < this.plantWiggle.length; i += 1) this.plantWiggle[i] = Math.max(0, this.plantWiggle[i] - dt / 1.6);
    const b = this.bucketFish;
    if (b && (b.t += dt) > (b.mode === 'peek' ? 1.6 : 1.2)) this.bucketFish = null;
    const p = this.penguin;
    if (p && state.phase !== PHASE.INTRO) {
      if (p.wait > 0) {
        p.wait -= dt;
        if (p.wait <= 0) this.audio.play('whee');
      } else if ((p.t += dt) > PENGUIN.cross) {
        this.penguin = null; // once a level
      }
    }
  }

  // Bubble confetti: bright bubbles bursting up and drifting away (a three-catch streak).
  confettiFrom(x, y, count = 28) {
    const colours = ['#ff7aa8', '#ffd166', '#7ee0ff', '#9cf28a', '#c9a7ff', '#ffa35c'];
    for (let i = 0; i < (this.fx.reduced ? 8 : count); i += 1) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const v = 170 + Math.random() * 260;
      this.confetti.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 5 + Math.random() * 8, colour: colours[i % colours.length], life: 0, wob: Math.random() * TAU });
    }
  }

  drawConfetti(ctx) {
    for (const c of this.confetti) {
      const pop = c.life > 0.9 ? 1 + (c.life - 0.9) * 4 : 1;
      const fade = c.life > 0.9 ? 1 - (c.life - 0.9) * 10 : 1;
      const r = c.r * pop;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, TAU);
      ctx.fillStyle = c.colour + '55';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = c.colour;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c.x - r * 0.35, c.y - r * 0.35, r * 0.28, 0, TAU);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
      ctx.restore();
    }
  }

  // Little surprises for curious taps: Swiftee twirls, a fish in the bucket peeks out and waves.
  // Returns true when the tap was one of these (so it doesn't also skip a line or splash).
  onCharacterTap(point) {
    if (state.paused || state.phase === PHASE.INTRO || state.phase === PHASE.COMPLETE || this.iris) return false;
    const bird = this.swiftee;
    if (bird && !bird.spin && Math.abs(bird.lean) < 0.03) {
      const y = bird.bobY();
      if (point.x > bird.x - 90 && point.x < bird.x + 90 && point.y > y - 130 && point.y < y + 40) {
        bird.twirl();
        this.fx.sparkle(bird.x, y - 50, 8);
        this.audio.play('chirp');
        return true;
      }
    }
    const rim = this.popo.bucketRim();
    if (!this.popo.mishap && Math.abs(point.x - rim.x) < 42 && point.y > rim.y - 24 && point.y < rim.y + 60) {
      const fish = state.collected[state.collected.length - 1];
      if (fish && !this.bucketFish) {
        this.bucketFish = { mode: 'peek', t: 0, fish };
        this.audio.play('bloop');
      } else {
        this.audio.play('tick');
      }
      return true;
    }
    return false;
  }

  // A tap on a seaweed sets it wiggling for a moment.
  wiggleSeaweed(point) {
    const plants = this.fx.plantsFor(PLACES[this.place].background);
    let hit = false;
    plants.slice(0, 8).forEach((p, i) => {
      if (point.x > p.left && point.x < p.right && point.y > p.top - 10 && point.y < p.root) {
        this.plantWiggle[i] = 1;
        hit = true;
      }
    });
    if (hit) this.audio.play('wiggle');
  }

  // The last fish caught, in the bucket: peeking out to wiggle hello when the bucket is tapped,
  // or (the end of a level) hopping right out with a flip and dropping back in.
  drawBucketFish(ctx) {
    const b = this.bucketFish;
    if (!b) return;
    const rim = this.popo.bucketRim();
    const f = b.fish;
    let x = rim.x;
    let y;
    let angle = 0;
    let size = 0.3;
    if (b.mode === 'peek') {
      // nose first up out of the bucket, a happy waggle, and back down
      const up = Math.min(1, b.t / 0.3);
      const down = Math.max(0, (b.t - 1.25) / 0.3);
      y = rim.y + 34 - 34 * ease.out(up) * (1 - ease.in(down));
      angle = -Math.PI / 2 + (this.fx.reduced ? 0 : Math.sin(b.t * 11) * 0.22 * (1 - down));
    } else {
      // out like a dolphin, nose up, over the top and back in head first
      const k = Math.min(1, b.t / 1.1);
      y = rim.y + 20 - Math.sin(k * Math.PI) * 170;
      x = rim.x + Math.sin(k * Math.PI) * 26;
      angle = -Math.PI / 2 + k * Math.PI;
      size = 0.36;
    }
    // inside the bucket until it rises past the rim
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, STAGE_W, rim.y + 4);
    ctx.clip();
    const keep = { x: f.x, y: f.y, scale: f.scale, gone: f.gone, offstage: f.offstage, dir: f.dir, pitch: f.pitch, frozen: f.frozen };
    Object.assign(f, { x: 0, y: 0, scale: size, gone: false, offstage: false, dir: 1, pitch: 0, frozen: false });
    ctx.translate(x, y);
    ctx.rotate(angle);
    f.draw(ctx);
    Object.assign(f, keep);
    ctx.restore();
  }

  // A penguin belly-slides along the far shore, small with distance, puffing snow behind it.
  drawPenguin(ctx) {
    const p = this.penguin;
    if (!p || p.wait > 0) return;
    const k = p.t / PENGUIN.cross;
    const x = p.dir > 0 ? -60 + (STAGE_W + 120) * k : STAGE_W + 60 - (STAGE_W + 120) * k;
    const hop = k < 0.06 ? Math.sin((k / 0.06) * Math.PI) * 10 : 0; // a little run-up hop, then down on its belly
    const y = PENGUIN.y - hop;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(p.dir * 1.35, 1.35);
    for (let i = 1; i <= 4; i += 1) { // snow puffs behind
      const a = 0.5 - i * 0.1;
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      ctx.beginPath();
      ctx.arc(-16 - i * 8, -2 - (i % 2) * 3 + Math.sin(this.fx.t * 20 + i) * 1.5, 3 + i * 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(20, 40, 70, 0.25)'; // its shadow on the snow
    ctx.beginPath();
    ctx.ellipse(0, 1, 18, 2.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1d2433'; // body, lying flat
    ctx.beginPath();
    ctx.ellipse(0, -6, 17, 7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f4f7fb'; // white belly underneath
    ctx.beginPath();
    ctx.ellipse(1, -3, 14, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1d2433'; // head, looking ahead
    ctx.beginPath();
    ctx.arc(16, -9, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(18, -9, 3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#10141c';
    ctx.beginPath();
    ctx.arc(19, -9.5, 1.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff9a2e'; // beak and feet
    ctx.beginPath();
    ctx.moveTo(21, -9);
    ctx.lineTo(27, -7.5);
    ctx.lineTo(21, -6.5);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-18, -4, 4, 2, 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1d2433'; // flippers out like wings, flapping with glee
    const flap = Math.sin(this.fx.t * 14) * 0.35;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(2, -7);
      ctx.rotate(side * (0.5 + flap));
      ctx.beginPath();
      ctx.ellipse(-7, 0, 8, 2.2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // --- the big catch at the end, and the end card ------------------------------------------------
  // A big, dark fish shadow gliding deep under the raft (it's really an old boot).
  showShadow(x, y) {
    const shadow = new ShadowFish(this.area, -1);
    Object.assign(shadow, { x, baseY: y, y, size: 5.2, depth: 0, speed: 0, fade: 1.7, eyes: 0 });
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
      this.fx.drips({ x: b.x + (16 + (Math.random() - 0.5) * 150) * BOOT.scale / 1.6, y: b.y + 176 * BOOT.scale });
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
    ctx.scale(BOOT.scale, BOOT.scale);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // painted rather than outlined: a soft dark edge, the light from the top left
    const edge = 'rgba(48, 24, 8, 0.6)';
    const shape = (draw, fill, width = 2.2) => {
      ctx.beginPath();
      draw();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    // the pull loop the hook caught
    ctx.beginPath();
    ctx.ellipse(-4, 12, 9, 13, 0, 0, TAU);
    ctx.strokeStyle = '#4a2a14';
    ctx.lineWidth = 5;
    ctx.stroke();
    const bootPath = () => {
      ctx.moveTo(-52, 22);
      ctx.lineTo(40, 22);
      ctx.quadraticCurveTo(44, 70, 46, 104);
      ctx.quadraticCurveTo(70, 104, 104, 118);
      ctx.quadraticCurveTo(132, 132, 128, 158);
      ctx.lineTo(-58, 158);
      ctx.quadraticCurveTo(-62, 90, -52, 22);
    };
    const leather = ctx.createRadialGradient(-22, 52, 8, 6, 92, 175);
    leather.addColorStop(0, '#c98a50');
    leather.addColorStop(0.45, '#94572c');
    leather.addColorStop(1, '#4e2810');
    shape(bootPath, leather);
    ctx.save();
    ctx.beginPath();
    bootPath();
    ctx.clip();
    // shade down the back and under the foot, a cool rim of light from the water on the right
    const shade = ctx.createLinearGradient(-60, 0, 130, 0);
    shade.addColorStop(0, 'rgba(30, 12, 2, 0.45)');
    shade.addColorStop(0.3, 'rgba(30, 12, 2, 0)');
    shade.addColorStop(0.85, 'rgba(30, 12, 2, 0)');
    shade.addColorStop(1, 'rgba(150, 210, 240, 0.35)');
    ctx.fillStyle = shade;
    ctx.fillRect(-70, 0, 210, 170);
    const under = ctx.createLinearGradient(0, 110, 0, 160);
    under.addColorStop(0, 'rgba(30, 12, 2, 0)');
    under.addColorStop(1, 'rgba(30, 12, 2, 0.5)');
    ctx.fillStyle = under;
    ctx.fillRect(-70, 110, 210, 50);
    // creases in the leather at the ankle and across the toe
    ctx.strokeStyle = 'rgba(40, 18, 4, 0.35)';
    ctx.lineWidth = 2;
    for (const [x0, y0, x1, y1, cx, cy] of [[-50, 96, 40, 100, -6, 90], [-46, 108, 44, 112, 0, 104], [60, 112, 92, 150, 84, 120], [76, 118, 108, 150, 100, 126]]) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();
    }
    // wet shine: long soft streaks down the shaft and along the toe
    for (const [w, a] of [[9, 0.18], [4, 0.45]]) {
      ctx.strokeStyle = `rgba(255, 248, 230, ${a})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(-30, 36);
      ctx.quadraticCurveTo(-37, 88, -31, 140);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(56, 113);
      ctx.quadraticCurveTo(88, 114, 112, 128);
      ctx.stroke();
    }
    ctx.restore();
    // the sole, with a shadowed tread
    const sole = ctx.createLinearGradient(0, 152, 0, 176);
    sole.addColorStop(0, '#4a372a');
    sole.addColorStop(1, '#1c140e');
    shape(() => ctx.roundRect(-64, 152, 196, 24, 10), sole);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    for (let x = -50; x < 125; x += 22) ctx.fillRect(x, 168, 10, 7);
    // the cuff, the laces, a patch and a hole in the toe
    const cuff = ctx.createLinearGradient(0, 16, 0, 36);
    cuff.addColorStop(0, '#d8995e');
    cuff.addColorStop(1, '#94562a');
    shape(() => ctx.roundRect(-58, 16, 104, 20, 8), cuff);
    ctx.fillStyle = 'rgba(20, 8, 2, 0.55)'; // the dark opening inside the cuff
    ctx.beginPath();
    ctx.ellipse(-6, 19, 48, 4, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#efe2c2';
    ctx.lineWidth = 3;
    for (let y = 48; y < 100; y += 14) {
      ctx.beginPath();
      ctx.moveTo(14, y);
      ctx.lineTo(38, y + 9);
      ctx.moveTo(38, y);
      ctx.lineTo(14, y + 9);
      ctx.stroke();
    }
    shape(() => ctx.rect(-40, 70, 30, 28), '#5f7a3a', 1.8);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#d9c9a0';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-36, 74, 22, 20);
    ctx.setLineDash([]);
    ctx.fillStyle = '#1b130d';
    ctx.beginPath();
    ctx.ellipse(102, 140, 9, 6, -0.3, 0, TAU);
    ctx.fill();
    // water squirting out of the hole in the toe while it hangs
    if (b.hanging && !this.fx.reduced) {
      const k = Math.max(0, 1 - b.t / 3.5);
      if (k > 0) {
        ctx.save();
        ctx.setLineDash([7, 6]);
        ctx.lineDashOffset = -b.t * 90;
        ctx.strokeStyle = `rgba(200, 238, 255, ${0.85 * k})`;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(108, 142);
        ctx.quadraticCurveTo(150, 132, 166, 196);
        ctx.stroke();
        ctx.restore();
      }
    }
    // a dented tin can stuck on the toe, with a glint
    ctx.save();
    ctx.translate(122, 118);
    ctx.rotate(0.5);
    const tin = ctx.createLinearGradient(-14, 0, 14, 0);
    tin.addColorStop(0, '#8e9aa5');
    tin.addColorStop(0.35, '#e8eef2');
    tin.addColorStop(1, '#7d8994');
    shape(() => ctx.roundRect(-14, -24, 28, 44, 5), tin, 1.8);
    ctx.fillStyle = '#d6533c';
    ctx.fillRect(-12, -10, 24, 14);
    ctx.restore();
    // beads of water on the leather, each with a glint
    for (const [x, y, r] of [[-20, 60, 3.5], [24, 112, 3], [70, 126, 2.5], [-44, 120, 3], [-8, 136, 2.4], [30, 40, 2.2]]) {
      const yy = y + Math.sin(b.t * 2 + x) * 1.5;
      ctx.fillStyle = 'rgba(210, 240, 255, 0.7)';
      ctx.beginPath();
      ctx.ellipse(x, yy, r * 0.8, r * 1.2, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(x - r * 0.25, yy - r * 0.4, r * 0.32, 0, TAU);
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
      ctx.strokeStyle = 'rgba(20, 70, 30, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
  }


  // --- the big catch's drama: a camera push-in and shake, a dark vignette, speed lines, an
  // impact flash and the water column the boot bursts out of
  comicReset() {
    this.vignette = 0;
    this.vignetteTo = 0;
    this.speedLines = 0;
    this.shaking = null;
    this.camera = { zoom: 1, to: 1, x: STAGE_W / 2, y: STAGE_H / 2, on: false };
    this.flash = 0;
    this.geyser = null;
    this.spray = [];
    this.confetti = [];
    this.bucketFish = null;
    this.penguin = null;
    this.why = null;
    this.plantWiggle = new Array(8).fill(0);
    this.panScene(0, 0);
  }

  // A burst of water drops from (x, y): thrown up and out, then falling back.
  sprayFrom(x, y, count, power = 1) {
    if (this.fx.reduced) count = Math.min(count, 8);
    for (let i = 0; i < count; i += 1) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const v = (260 + Math.random() * 420) * power;
      this.spray.push({ x: x + (Math.random() - 0.5) * 40, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 2 + Math.random() * 4.5, life: 0 });
    }
  }

  // Where the boot hangs: just below the rod tip, as a dangling boot would.
  bootHang() {
    const tip = this.popo.rodTip();
    return { x: tip.x + BOOT.hang[0], y: tip.y + BOOT.hang[1] };
  }

  shake(amount, seconds) {
    this.shaking = { amount, t: seconds, total: seconds };
  }

  // Leans the camera in towards (x, y) (zoom 1 lets it ease back out).
  zoomTo(zoom, x = this.camera.x, y = this.camera.y) {
    Object.assign(this.camera, { to: this.fx.reduced ? 1 : zoom, x, y });
  }

  updateComic(dt) {
    this.vignette += (this.vignetteTo - this.vignette) * Math.min(1, dt * 3);
    this.flash = Math.max(0, this.flash - dt / 0.3);
    if (this.geyser && (this.geyser.t += dt) > 1.1) this.geyser = null;
    for (const d of this.spray) {
      d.life += dt;
      d.vy += 900 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }
    if (this.spray.length) this.spray = this.spray.filter((d) => d.y < this.waterline + 10 && d.life < 2);
    const cam = this.camera;
    cam.zoom += (cam.to - cam.zoom) * Math.min(1, dt * 2.5);
    const s = this.shaking;
    if (s && ((s.t -= dt) <= 0 || this.fx.reduced)) this.shaking = null;
    const zoomed = Math.abs(cam.zoom - 1) > 0.002;
    if (!this.shaking && !zoomed) {
      if (cam.on) {
        cam.on = false;
        cam.zoom = 1;
        this.ui.el.scene.style.transform = '';
      }
      return;
    }
    cam.on = true;
    const k = this.stage.scale;
    const jolt = this.shaking ? this.shaking.amount * (this.shaking.t / this.shaking.total) * k : 0;
    const scene = this.ui.el.scene.style;
    scene.transformOrigin = `${(cam.x * k).toFixed(1)}px ${(cam.y * k).toFixed(1)}px`;
    scene.transform = `translate(${((Math.random() - 0.5) * 2 * jolt).toFixed(1)}px, ${((Math.random() - 0.5) * 2 * jolt).toFixed(1)}px) scale(${cam.zoom.toFixed(4)})`;
  }

  // The water column the boot bursts out of: up in a blink, then slumping back in a spray. A
  // see-through body with a brighter core, crowned with round drops.
  drawGeyser(ctx) {
    for (const d of this.spray) {
      ctx.fillStyle = 'rgba(225, 245, 255, 0.85)';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r * 0.8, d.r * 1.25, Math.atan2(d.vy, d.vx) + Math.PI / 2, 0, TAU);
      ctx.fill();
    }
    const g = this.geyser;
    if (!g) return;
    const up = Math.min(1, g.t / 0.2);
    const down = Math.max(0, (g.t - 0.3) / 0.8);
    const h = 300 * ease.out(up) * (1 - ease.in(down));
    if (h < 2) return;
    const wl = this.waterline;
    const w = 68 + 40 * down;
    const column = (width, alpha) => {
      ctx.beginPath();
      ctx.moveTo(g.x - width * 1.7, wl + 6);
      ctx.bezierCurveTo(g.x - width * 0.7, wl - 10, g.x - width * 0.55, wl - h * 0.6, g.x - width * 0.35, wl - h);
      ctx.quadraticCurveTo(g.x, wl - h - width * 0.5, g.x + width * 0.35, wl - h);
      ctx.bezierCurveTo(g.x + width * 0.55, wl - h * 0.6, g.x + width * 0.7, wl - 10, g.x + width * 1.7, wl + 6);
      ctx.closePath();
      const body = ctx.createLinearGradient(0, wl - h, 0, wl);
      body.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      body.addColorStop(1, `rgba(180, 230, 255, ${alpha * 0.7})`);
      ctx.fillStyle = body;
      ctx.fill();
    };
    ctx.save();
    // foam where it leaves the lake, and a mist round its top
    ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * (1 - down)})`;
    ctx.beginPath();
    ctx.ellipse(g.x, wl + 2, w * 2.2, 9, 0, 0, TAU);
    ctx.fill();
    const mist = ctx.createRadialGradient(g.x, wl - h, 4, g.x, wl - h, w * 2.4);
    mist.addColorStop(0, `rgba(255, 255, 255, ${0.45 * (1 - down)})`);
    mist.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = mist;
    ctx.fillRect(g.x - w * 2.4, wl - h - w * 2.4, w * 4.8, w * 4.8);
    column(w, 0.5);
    column(w * 0.55, 0.75);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2;
    for (const dx of [-0.3, 0.05, 0.32]) {
      ctx.beginPath();
      ctx.moveTo(g.x + dx * w, wl - 6);
      ctx.quadraticCurveTo(g.x + dx * w * 0.6, wl - h * 0.5, g.x + dx * w * 0.4, wl - h * 0.92);
      ctx.stroke();
    }
    // the crown: round drops thrown up and out, falling away as it slumps
    for (let i = 0; i < 9; i += 1) {
      const a = -Math.PI / 2 + (i - 4) * 0.33;
      const out = 18 + 30 * up + 60 * down;
      const x = g.x + Math.cos(a) * out;
      const y = wl - h - 8 + Math.sin(a) * out * 0.6 + 140 * down * down;
      const r = (7 - Math.abs(i - 4)) * (1 - 0.6 * down);
      if (r <= 0.5) continue;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * (1 - down)})`;
      ctx.fill();
    }
    ctx.restore();
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
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 252, 240, ${(0.45 * this.flash).toFixed(3)})`;
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    }
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
