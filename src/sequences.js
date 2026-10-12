(function (PopoGame) {
'use strict';
const { clock, ease, Cancelled, state, PHASE, newToken, isCurrent, Fish, Swiftee, STORY, LEVELS, PLACES, STAGE_W, STAGE_H } = PopoGame;

// Where Swiftee hovers to explain the recall card: in the sky between Popo's rod and the card,
// low enough that her bubble fits beside her above it.
const RECALL_PERCH = { x: 560, y: 228 };

// The hook hangs this far below the line's end.
// the line ends at the lip; the hooked fish is drawn over the hook, so it sits inside the mouth
const HOOK_DROP = 2;

// Where the hook grabs a fish: its smile (measured from the art), mirrored when it swims left,
// with the line ending just above it so the hook's bend sits in the mouth.
// The corner of the fish's smile on the stage, through the same bob, tilt and wiggle the fish
// is drawn with, so the hook stays in its mouth however the fish moves.
function mouthOf(fish) {
  const [mx, my] = fish.mouth;
  const lx = fish.dir * (mx - 0.5) * fish.w * fish.scale;
  const ly = (my - 0.5) * fish.h * fish.scale;
  const turn = fish.drawTurn || 0;
  return {
    x: fish.x + lx * Math.cos(turn) - ly * Math.sin(turn),
    y: fish.y + (fish.drawBob || 0) + lx * Math.sin(turn) + ly * Math.cos(turn) - HOOK_DROP,
  };
}

function swallow(e) {
  if (!(e instanceof Cancelled)) throw e;
}

// Popo casts and the hook flies to the chosen fish. Shared by the correct and wrong flows.
async function castTo(game, fish, token) {
  const { popo, fx, audio } = game;
  popo.playFrames('casting', ['lift', 'up', 'back'], 110);
  await clock.wait(340, token);
  audio.play('whoosh');
  popo.playFrames('casting', ['swing', 'follow', 'hold'], 120);
  const from = popo.hookPosition();
  popo.line.mode = 'flight';
  popo.line.hook = { ...from };
  popo.line.tension = 0.6;
  const target = mouthOf(fish);
  const apexY = Math.min(from.y, target.y) - 150;
  let splashed = false;
  await clock.tween(560, token, (t) => {
    const k = ease.out(t);
    const x = from.x + (target.x - from.x) * k;
    const y = (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * apexY + k * k * target.y;
    popo.line.hook.x = x;
    popo.line.hook.y = y;
    popo.line.arc = -0.9 * (1 - k);
    if (!splashed && y >= game.waterline) {
      splashed = true;
      fx.splash(x, game.waterline, false);
      game.startleAround({ x, y: game.waterline + 60 }, 300, fish);
      audio.play('splashSmall');
    }
  });
  popo.line.mode = 'attached';
  popo.line.arc = 0;
  popo.line.tension = 1;
}


async function correctCatch(game, fish) {
  const token = newToken();
  const { popo, fx, audio, ui } = game;
  try {
    state.phase = PHASE.CASTING;
    fish.frozen = true;
    // the right fish turns to face Popo, so the hook flies straight into its mouth
    fish.dir = Math.sign(popo.anchor.x - fish.x) || -1;
    fish.wiggle();
    audio.play('fishTap');
    ui.setHitsEnabled(false);
    await clock.wait(330, token);
    await castTo(game, fish, token);

    fish.wiggle();
    fish.surprise(0.9);
    audio.play('hooked');
    // in level 5 the angles told us; now the fish shows its parallel sides
    if (fish.markedAngles.length && fish.revealParallel()) audio.play('boing');
    await clock.wait(300, token);

    // reeled in towards the rod: it fights the line (less as it tires), tail flicking, nose rising,
    // trailing bubbles; fish in the way dart clear of the line
    state.phase = PHASE.REELING;
    audio.play('reel');
    popo.playFrames('casting', ['reel', 'reel2'], 150, true);
    const start = { x: fish.x, y: fish.y };
    const tip = popo.rodTip();
    const surface = { x: Math.max(popo.raftRight().x + fish.w * 0.5 + 16, tip.x + 10), y: game.waterline + 4 };
    fish.dir = Math.sign(surface.x - fish.x) || -1;
    game.clearPath(start, surface, fish);
    const along = [surface.x - start.x, surface.y - start.y];
    const span = Math.hypot(...along) || 1;
    let bubbled = 0;
    await clock.tween(Math.min(1400, Math.max(850, 500 + span * 0.65)), token, (t) => {
      const k = ease.inOut(t);
      const fight = Math.sin(t * Math.PI * 6) * (1 - t) * 12;
      fish.x = start.x + along[0] * k - (along[1] / span) * fight;
      fish.y = start.y + along[1] * k + (along[0] / span) * fight;
      fish.pitch = Math.sin(t * Math.PI * 7) * 0.12 * (1 - t) - 0.18 * k;
      popo.line.tension = 1.3 + Math.abs(fight) / 30;
      if (t - bubbled > 0.12) { bubbled = t; fx.puff(fish.x - fish.dir * fish.w * 0.4, fish.y, -fish.dir, 2); }
    });

    // out it bursts, and swings up on the line high over Popo's head (never through him), then
    // drops into the bucket, behind its rim
    fx.splash(fish.x, game.waterline, true);
    audio.play('splashSmall');
    popo.stopFrames();
    popo.setPose('casting', 'up');
    fish.dir = -1;
    const from = { x: fish.x, y: fish.y };
    const rim = popo.bucketRim();
    const over = Math.min(popo.headTop().y - 215, from.y - 230); // a clear gap above his head
    const path = [from, { x: from.x, y: over }, { x: rim.x, y: over }, { x: rim.x, y: rim.y + 34 }];
    const at = (k, i) => (1 - k) ** 3 * path[0][i] + 3 * (1 - k) ** 2 * k * path[1][i] + 3 * (1 - k) * k * k * path[2][i] + k ** 3 * path[3][i];
    let dripped = 0;
    let last = { ...from };
    await clock.tween(800, token, (t) => {
      const k = ease.inOut(t);
      fish.x = at(k, 'x');
      fish.y = at(k, 'y');
      fish.scale = 1 - 0.5 * k;
      const v = [fish.x - last.x, fish.y - last.y];
      if (Math.hypot(...v) > 0.5) fish.pitch = Math.max(-0.9, Math.min(0.9, Math.atan2(v[1], Math.abs(v[0])) * 0.7));
      last = { x: fish.x, y: fish.y };
      popo.line.tension = 1;
      if (t - dripped > 0.18 && t < 0.75) { dripped = t; fx.drips({ x: fish.x, y: fish.y + fish.h * 0.3 * fish.scale }); }
    });

    fish.gone = true;
    fx.sparkle(rim.x, rim.y - 14, 12);
    audio.play('collect');
    popo.idle();
    springHome(game, token);
    game.collect(fish);
    state.phase = PHASE.CELEBRATING;
    state.streak += 1;
    const combo = Math.min(3, state.streak);
    popo.act(combo >= 3 ? 'dance' : 'catch');
    game.cheer();
    audio.play('cheer');
    if (combo >= 2) {
      // on a streak, Popo bounces twice and the fish cheer harder
      audio.play(combo >= 3 ? 'combo3' : 'combo2');
      fx.sparkle(rim.x, rim.y - 30, 10 + combo * 6);
      game.cheer();
      clock.wait(380, token).then(() => game.storyCue('hop')).catch(() => {});
    }
    // "Great catch!" and "Keep going!" in turn
    await game.say(STORY.right[(state.collected.length - 1) % STORY.right.length], token);
    game.afterCatch();
  } catch (e) {
    swallow(e);
  }
}

// After a catch the empty hook springs back from the bucket to hang from the rod again.
function springHome(game, token) {
  const { line } = game.popo;
  const from = { ...line.hook };
  const rest = () => {
    line.mode = 'dangle';
    const hook = game.popo.hookPosition();
    line.mode = 'flight';
    return hook;
  };
  line.mode = 'flight';
  line.tension = 0;
  clock.tween(420, token, (t) => {
    const k = ease.out(t);
    const to = rest();
    line.hook = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * 28 };
    line.arc = 0.4 * (1 - k);
  }).then(() => {
    line.mode = 'dangle';
    line.arc = 0;
  }, () => {});
}

// A single game-clock tween owns the complete reaction. No frame-count damping or
// chained waits: dropped frames still cross every event once, in chronological order.
const WRONG_DURATION = 4800;
const REST_LINE = 36; // how far the line hangs while the rod lies on the deck
async function wrongCatch(game, fish) {
  if (state.phase !== PHASE.READY || game.popo.mishap) return;
  const token = newToken();
  const { popo, fx, audio, ui } = game;
  const home = { x: fish.x, y: fish.y };
  const sound = name => { try { audio.play(name); } catch (e) { /* optional audio */ } };
  const restore = () => {
    if (popo.mishap) popo.line.length = REST_LINE; // after the fall it lowers back from a short hang
    popo.endMishap();
    fish.frozen = false;
    state.selectedFish = null;
    state.idleTime = 0;
    state.hintShown = false;
    state.phase = PHASE.READY;
    ui.setHitsEnabled(true);
    game.restoreTutorialHand();
  };
  try {
    state.phase = PHASE.CASTING;
    state.selectedFish = fish;
    state.streak = 0; // a wrong tap ends the streak
    game.instructionRevert = 0;
    ui.setHitsEnabled(false);
    game.showHandOn(null);
    ui.hideHand();
    fish.frozen = true;
    fish.wiggle(true);
    sound('fishTap');
    const castGame = Object.create(game);
    castGame.audio = { play: sound };
    await castTo(castGame, fish, token);
    popo.beginMishap(game.waterline);
    const m = popo.mishap;
    const pull = Math.min(38, game.area.right - fish.w / 2 - home.x);
    const edge = popo.placement('fishing', 'idle').raftRightX;
    const origin = popo.mishapBodyPoint(178, 300);
    const landingX = edge + 76 - origin.x;
    const rotation = fx.reduced ? 0.55 : 1;
    const nodes = [
      // Time, lateral offset, vertical offset, body rotation, acting pose.
      [0, 0, 0, 0, 'idle'],
      // the quick acting changes snap like a cartoon take; a crossfade would ghost the paws
      [180, 4, 0, .025, 'surprise', 'cut'],
      [400, 13, -2, .05, 'surprise'],
      [680, 25, -5, -.055, 'brace', 'cut'],
      [950, landingX * .47, -12, .13, 'brace'],
      [1130, landingX * .70, -30, .20, 'slip', 'cut'],
      [1450, landingX, 22, .30, 'slip'],
      [1750, landingX + 6, 190, .06, 'surface'],
      [2050, landingX + 3, 191, 0, 'surface'],
      [2430, landingX, 63, -.025, 'surface'],
      [2600, landingX - 5, 69, 0, 'blink'],
      [2750, landingX - 12, 68, 0, 'surface'],
      // swim to the edge, grab it, haul up, belly-slide onto the deck, then pop up to sit
      [3000, landingX - 40, 64, 0, 'surface'],
      [3080, 0, 0, 0, 'climb', 'cut'],
      [3380, 0, 0, 0, 'climb'],
      [3640, 0, 0, 0, 'climb', null, .16],
      [3720, 92, 0, 0, 'shake', 'cut', -.14],
      [3940, 30, -5, 0, 'shake', null, .05],
      [4150, 0, 0, 0, 'wet', 'cut'],
      [4450, 0, -2, -.018, 'wet'],
      [4630, 0, 0, 0, 'idle'],
      [4800, 0, 0, 0, 'idle'],
    ];
    // Calibrate submersion and emergence against the actual art, not an assumed
    // foot height. World offsets stay invariant when the viewport is resized.
    const top = popo.poseLocalPoint('surface', 'top').y;
    const underwater = game.waterline - origin.y - top + 8;
    nodes[7][2] = underwater;
    nodes[8][2] = underwater + 2;
    const afloat = underwater - 112;
    for (const i of [9, 10, 11, 12]) nodes[i][2] += afloat - 63;
    // The climb keys place the reaching forepaw: on the raft's edge while hauling up (a small
    // lift, so the legs come up out of the water rather than swinging high), then further in
    // on the deck once the belly has slid aboard.
    const gripPoint = { x: edge-5, y: game.waterline-21 };
    // a key that lands one landmark of a pose on a stage point at a given tilt
    const place = (index, pose, landmark, angle, at) => {
      const local = popo.poseLocalPoint(pose, landmark);
      const theta = angle * rotation;
      nodes[index][3] = angle;
      nodes[index][1] = at.x - origin.x - (local.x * Math.cos(theta) - local.y * Math.sin(theta));
      nodes[index][2] = at.y - origin.y - (local.x * Math.sin(theta) + local.y * Math.cos(theta));
    };
    place(13, 'climb', 'hand', 0, gripPoint);
    place(14, 'climb', 'hand', -.2, gripPoint);
    // belly aboard: the body lies along the back of the deck, clear of the water
    place(15, 'climb', 'pivot', -.03, { x: edge - 96, y: game.waterline - 57 });
    // sit up right where the body lies, then scoot back to the seat
    nodes[16][1] = nodes[15][1] + 14;
    nodes[17][1] = nodes[15][1] * .45;
    // the tug-of-war: three hard yanks before Popo is pulled off his feet
    const YANKS = [60, 360, 660];
    const yank = (ms) => YANKS.reduce((sum, at) => {
      const d = ms - at;
      return sum + (d < 0 || d > 280 ? 0 : d < 50 ? d / 50 : (1 - (d - 50) / 230) ** 2);
    }, 0);
    const lineEntry = () => {
      const tip = popo.rodTip(), hook = popo.line.hook;
      const k = Math.max(0, Math.min(1, (game.waterline - tip.y) / ((hook.y - tip.y) || 1)));
      return tip.x + (hook.x - tip.x) * k;
    };
    const yanked = () => {
      fish.surprise(0.4);
      sound('tug');
      fx.splash(lineEntry(), game.waterline, false);
      fx.puff(fish.x - fish.dir * fish.w * 0.4, fish.y, -fish.dir, 3);
      fish.wiggle();
    };
    let released = null, hookRelease = null, impacted = false;
    let previousContact = null;
    let eventIndex = 0;
    let feedback = Promise.resolve();
    const events = [
      [0, () => { state.phase = PHASE.WRONG_PULL; try { audio.duck(WRONG_DURATION); } catch (e) { /* optional music */ } }],
      [YANKS[0], yanked],
      [YANKS[1], yanked],
      [400, () => { state.phase = PHASE.LOSING_BALANCE; fish.wiggle(); }],
      [YANKS[2], () => { yanked(); sound('reel'); }],
      [950, () => { state.phase = PHASE.FALLING; sound('slip');
        released = { ...popo.mishapRod() }; hookRelease = { ...popo.line.hook };
        popo.line.mode = 'slack'; popo.line.tension = 0;
        fish.frozen = false;
      }],
      [1750, () => { state.phase = PHASE.SUBMERGED; sound('bubbles');
        fx.bubbleBurst(origin.x + landingX, game.waterline + 20); }],
      [2050, () => { state.phase = PHASE.RESURFACING; }],
      [2300, () => { sound('bloop'); fx.ripple(origin.x + landingX, game.waterline, .85); }],
      [2450, () => {
        feedback = game.sayAll(game.wrongLine(), token);
        // Attach cancellation handling immediately, even while the motion is running.
        feedback.catch(() => {});
      }],
      [2600, () => { fx.drips(popo.bodyLandmark('head')); }],
      [2750, () => { state.phase = PHASE.RECOVERING; }],
      [3080, () => { sound('bloop'); fx.ripple(edge + 34, game.waterline + 4, .7); }],
      [3640, () => {
        // his legs leave the water: a splash just off the raft, and the raft settles under his
        // weight with a ripple from each end
        sound('splashSmall');
        fx.splash(edge + 26, game.waterline, false);
        const raft = popo.placement('fishing', 'idle');
        fx.ripple(raft.raftLeftX - 18, game.waterline + 4, .8);
        fx.ripple(raft.raftRightX + 30, game.waterline + 4, .8);
      }],
      [3720, () => { sound('boing'); fx.drips(popo.bodyLandmark('head')); }],
      [3920, () => { sound('drip'); fx.drips(popo.bodyLandmark('head')); }],
      [4150, () => { ui.setInstruction(game.level().hint); }],
    ];
    await clock.tween(WRONG_DURATION, token, progress => {
      const ms = progress * WRONG_DURATION;
      m.time = ms;
      let i = 0;
      while (i < nodes.length - 2 && ms > nodes[i + 1][0]) i++;
      const a = nodes[i], b = nodes[i + 1];
      const t = Math.max(0, Math.min(1, (ms - a[0]) / (b[0] - a[0])));
      // Cubic Hermite position interpolation preserves velocity at interior keys.
      const before = nodes[Math.max(0, i - 1)], after = nodes[Math.min(nodes.length - 1, i + 2)];
      for (const [key, col] of [['x', 1], ['y', 2], ['angle', 3]]) {
        const span = b[0] - a[0];
        const va = i === 0 ? 0 : (b[col] - before[col]) / (b[0] - before[0]);
        const vb = i + 1 === nodes.length - 1 ? 0 : (after[col] - a[col]) / (after[0] - a[0]);
        m[key] = (2*t*t*t-3*t*t+1)*a[col] + (t*t*t-2*t*t+t)*span*va
          + (-2*t*t*t+3*t*t)*b[col] + (t*t*t-t*t)*span*vb;
      }
      m.angle *= rotation;
      // 'cut' switches pose on the key itself (squash and stretch sell the change instead of a
      // see-through blend); otherwise the last 110 ms before a key blend into its pose
      const poseMix = a[4] === b[4] || b[5] === 'cut' ? 0 : ease.inOut(Math.max(0,Math.min(1,(ms-b[0]+110)/110)));
      popo.blendMishapPose(a[4], b[4], poseMix);
      m.squash = (a[6] || 0) + ((b[6] || 0) - (a[6] || 0)) * ease.inOut(t);
      if (ms >= 3080 && ms <= 3380) {
        const paw=popo.bodyLandmark('hand');
        m.x += gripPoint.x-paw.x;
        m.y += gripPoint.y-paw.y;
      }
      const jerk = ms < 950 ? yank(ms) : 0;
      m.x += jerk * 16 * rotation;
      m.angle += jerk * .06 * rotation;
      m.raftAngle = (ms < 1450 ? Math.sin(ms / 1450 * Math.PI) * .012 : 0) + jerk * .03 * rotation;
      m.rodBend = ms < 950 ? Math.sin(ms / 950 * Math.PI) * .06 + jerk * .2 : 0;
      m.deckOcclusion = ms > 2950 && ms < 3720;
      while (eventIndex < events.length && ms >= events[eventIndex][0]) events[eventIndex++][1]();
      if (ms < 950) {
        // the fish darts and dives on each yank, thrashing against the line
        const k = ease.inOut(Math.min(1, ms / 400));
        fish.x = home.x + pull * k + jerk * 26;
        fish.y = home.y + Math.sin(ms / 950 * Math.PI) * 7 + jerk * 16;
        fish.pitch = jerk * .35;
        popo.line.tension = 1 + .8 * Math.sin(Math.min(1, ms / 950) * Math.PI) + jerk * .9;
      }
      if (released) {
        const k = ease.out(Math.max(0, Math.min(1, (ms - 950) / 500)));
        const resting = { x: edge - 88, y: game.waterline - 47, angle: .74 };
        m.rod = { x: released.x + (resting.x - released.x) * k,
          y: released.y + (resting.y - released.y) * k - Math.sin(k * Math.PI) * 18,
          angle: released.angle + (resting.angle - released.angle) * k };
        if (ms > 4150) {
          const grip = popo.bodyLandmark('hand');
          const take = ease.inOut(Math.min(1, (ms - 4150) / 480));
          m.rod.x += (grip.x - m.rod.x) * take;
          m.rod.y += (grip.y - m.rod.y) * take;
          m.rod.angle *= 1 - take;
        }
        const tip = popo.rodTip();
        const reel = ease.inOut(Math.min(1, Math.max(0, (ms - 950) / 850)));
        popo.line.hook.x = hookRelease.x + (tip.x + Math.sin(popo.swayT) * 7 - hookRelease.x) * reel;
        popo.line.hook.y = hookRelease.y + (tip.y + REST_LINE + Math.cos(popo.swayT) * 1.5 - hookRelease.y) * reel;
        popo.line.arc = Math.sin(reel * Math.PI) * .5;
      }
      const contact = popo.bodyLandmark('contact');
      if (!impacted && ms >= 950 && contact.y >= game.waterline && contact.x > edge + 15) {
        impacted = true;
        // Interpolate the crossing, even if an entire contact frame was skipped.
        const k = previousContact ? Math.max(0, Math.min(1,
          (game.waterline - previousContact.y) / (contact.y - previousContact.y || 1))) : 1;
        m.impactX = previousContact ? previousContact.x + (contact.x - previousContact.x) * k : contact.x;
        m.impactTime = ms;
        fx.splash(m.impactX, game.waterline, true);
        sound('splashBig');
      }
      previousContact = contact;
    });
    // play resumes soon after the motion even if a long line (level 5's) is still being said; it
    // carries on over the fishing until the next cast
    await Promise.race([feedback, clock.wait(1200, token)]);
    if (!isCurrent(token)) throw new Cancelled();
    restore();
    popo.act('wet');
    game.speakHint();
    game.revertInstructionIn(3500);
  } catch (e) {
    if (isCurrent(token)) { game.endLine(); audio.stopEffects(); fx.clearTransient(); restore(); }
    else { popo.endMishap(); fish.frozen = false; }
    swallow(e);
  }
}

// Before the first line, a cartoon entrance: Popo zooms in rowing flat out (honk honk!), slams
// on the brakes with a screech, overshoots and springs back boing-boing, swaps paddle for rod
// in a poof (ta-da!), and hops for joy as a fish leaps up to say hello.
const OFFSTAGE = -620; // Popo's raft just out of view on the left

async function popoArrives(game, token) {
  const { popo, fx, audio } = game;
  const reduced = fx.reduced;
  const from = OFFSTAGE;
  const overshoot = reduced ? 0 : 110;
  const stroke = 520; // frantic paddling
  const raftFront = () => popo.placement('fishing', 'idle').raftRightX + popo.travelShift;
  popo.travelShift = from;
  popo.startRowing(stroke);
  try {
    await clock.wait(120, token);
    audio.play('honk');
    audio.play('whoosh');
    audio.setTravel(true);
    let lastBlade = popo.paddleTip();
    let lastWake = 0;
    // a fish or two dart out of the way somewhere ahead of the raft
    const darting = shuffled(JUMPERS);
    const scatter = reduced ? [] : [[darting[0], between(400, 450)], [darting[1], between(500, 560)]].slice(0, Math.random() < 0.4 ? 1 : 2);
    const zoom = reduced ? 1300 : 1500;
    await clock.tween(zoom, token, (t) => {
      const elapsed = t * zoom;
      popo.travelShift = from + (overshoot - from) * (t < 0.15 ? (t * t) / 0.3 : t - 0.075) / 0.925;
      popo.setRowingTime(elapsed);
      popo.tilt = -0.03 - popo.rowRig.sample(elapsed, stroke).power * 0.03; // leaning into it
      const blade = popo.paddleTip();
      if (lastBlade && blade && lastBlade.y < game.waterline && blade.y >= game.waterline) {
        const crossing = (game.waterline - lastBlade.y) / (blade.y - lastBlade.y);
        fx.splash(lastBlade.x + (blade.x - lastBlade.x) * crossing, game.waterline, false);
        audio.play('paddle');
      }
      lastBlade = blade;
      // fish leap out of the way as the raft comes zooming through
      const bow = popo.placement('fishing', 'idle').raftRightX + popo.travelShift;
      if (scatter.length && bow > scatter[0][1] - 60) {
        const [shape, x] = scatter.shift();
        jump(game, token, shape, x, 1, { dx: between(130, 210), height: between(110, 180), ms: between(650, 850), scale: between(0.5, 0.65) }).catch(() => {});
      }
      if (elapsed - lastWake > 160) {
        lastWake = elapsed;
        const stern = popo.placement('fishing', 'idle').raftLeftX + popo.travelShift;
        fx.ripple(stern - 12, game.waterline + 6, 0.9);
        if (stern > 0) fx.splash(stern - 6, game.waterline, false); // spray kicked up behind
        fx.splash(stern + 340, game.waterline, false); // and off the bow
      }
    });
    audio.setTravel(false);
    const held = popo.rowing.time;
    if (overshoot) {
      // brakes! the raft screeches past the spot, squashing up in a fan of spray
      audio.play('skid');
      audio.play('woah');
      let lastSpray = 0;
      await clock.tween(520, token, (t) => {
        popo.travelShift = overshoot + 34 * Math.sin(t * Math.PI / 2);
        popo.tilt = 0.12 * Math.sin(t * Math.PI);
        popo.squash = 0.12 * Math.sin(t * Math.PI);
        popo.setRowingTime(held);
        if (t - lastSpray > 0.18) { lastSpray = t; fx.splash(raftFront() + 10, game.waterline, true); }
      });
      // ...and springs back onto it, boing-boing
      audio.play('boing');
      const back = overshoot + 34;
      let boinged = false;
      await clock.tween(820, token, (t) => {
        popo.travelShift = back * (1 - ease.outBack(t));
        popo.tilt = -Math.sin(t * Math.PI * 3) * 0.08 * (1 - t);
        popo.squash = -Math.sin(t * Math.PI * 3) * 0.1 * (1 - t);
        popo.setRowingTime(held);
        if (!boinged && t > 0.45) { boinged = true; audio.play('boing'); }
      });
    }
    popo.squash = 0;
    popo.tilt = 0;
    // ta-da: a poof, and the paddle has turned into his fishing rod
    const head = popo.headTop();
    game.poof = { x: head.x + 30, y: head.y + 120, t: 0 };
    audio.play('poof');
    await clock.wait(130, token); // the swap happens inside the cloud
  } finally {
    // however the entrance ends (even cancelled by a restart), Popo is left sitting on his spot
    popo.idle();
    popo.travelShift = 0;
    popo.tilt = 0;
    popo.squash = 0;
    if (isCurrent(token)) audio.setTravel(false);
  }
  audio.play('tada');
  fx.sparkle(popo.headTop().x + 40, popo.headTop().y + 50, 18);
  await clock.wait(380, token);
  // a happy hop, and a fish leaps up to say hello
  game.storyCue('hop');
  await fishSaysHello(game, token);
  await clock.wait(250, token);
}

// One fish jumps out of the water in an arc and dives back in, with a splash each way.
async function jump(game, token, shape, x0, dir, { dx = 150, height = 190, ms = 900, scale = 0.7 } = {}) {
  const { fx, audio } = game;
  const wl = game.waterline;
  const fish = new Fish(shape, x0, wl + 30, dir, scale);
  game.leapers.push(fish);
  let out = false;
  let back = false;
  try {
    audio.play('leap');
    await clock.tween(ms, token, (t) => {
      fish.x = x0 + dir * dx * t;
      fish.y = wl + 30 - height * 4 * t * (1 - t);
      fish.pitch = Math.max(-0.8, Math.min(0.8, -(1 - 2 * t) * 0.9));
      if (!out && fish.y < wl) { out = true; fx.splash(fish.x, wl, false); audio.play('splashSmall'); }
      if (out && !back && t > 0.5 && fish.y > wl) { back = true; fx.splash(fish.x, wl, true); audio.play('splashSmall'); }
    });
  } finally {
    game.leapers = game.leapers.filter((f) => f !== fish);
  }
}

// no quadrilaterals: only the trapezium levels' fish are four-sided
const JUMPERS = ['triangle', 'pentagon', 'hexagon', 'circle', 'oval', 'semicircle', 'octagon'];
const between = (a, b) => a + Math.random() * (b - a);
// a different fish each time, in a random order
const shuffled = (list) => list.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);

// A few fish leap for joy around the raft at uneven moments, each its own size, height,
// speed and direction. Resolves after the first ones; the rest finish on their own.
async function fishSaysHello(game, token) {
  const raft = game.popo.placement('fishing', 'idle').raftRightX;
  const count = 3 + Math.floor(Math.random() * 2);
  const fish = shuffled(JUMPERS);
  let at = 0;
  for (let i = 0; i < count; i += 1) {
    at += between(120, 420);
    const dir = Math.random() < 0.65 ? 1 : -1;
    const x0 = between(raft + 60, raft + 620);
    const opts = { dx: between(90, 200), height: between(110, 220), ms: between(700, 980), scale: between(0.5, 0.68) };
    clock.wait(at, token).then(() => jump(game, token, fish[i], x0, dir, opts)).catch(() => {});
  }
  await clock.wait(900, token);
}

// G0: Swiftee flies in from the lesson over the empty lake, welcomes the learner and flies off; then
// Popo rows in to his spot. Level 1's fish swim in; the first time, Swiftee swoops back to remind the
// learner how the rod works and flies off again; then the fishing begins.
async function opening(game) {
  const token = newToken();
  try {
    state.phase = PHASE.TUTORIAL;
    game.ui.setHitsEnabled(false);
    state.fish = [];
    game.ui.setInstruction('');
    game.popo.travelShift = OFFSTAGE; // Popo is still on his way
    await clock.wait(500, token);
    await swifteeArrives(game, STORY.welcome, token);
    await clock.wait(300, token);
    await swifteeLeaves(game, token);
    await clock.wait(250, token);
    await popoArrives(game, token);
    await clock.wait(300, token);
    game.startLevel(0);
    if (!game.controlsLearned()) await remind(game, token);
    game.play();
    game.speakInstruction();
  } catch (e) {
    swallow(e);
  }
}

// The reminder rings the hook and points the tutorial hand at a fish to catch (the hand follows
// it and stays until the first right catch) while Swiftee swoops back to explain the rod.
async function remind(game, token) {
  while (!game.inViewTarget()) await clock.wait(100, token);
  await clock.wait(600, token);
  game.tutorialPending = true;
  game.ui.setInstruction(''); // it comes back with the fishing, clear of Swiftee's bubble
  game.showHandOn(game.inViewTarget());
  game.hookRing = { t: 0 };
  await swifteeArrives(game, STORY.remind, token);
  game.hookRing = null;
  await swifteeLeaves(game, token);
}

// A level's last catch: its fish dash off and the next level's swim in, with the instruction and
// the counter changed over. Before level 5 comes the angle recall and the look at the angles;
// after it, the celebration.
async function finishLevel(game) {
  const token = newToken();
  const { audio, ui } = game;
  const next = state.level + 1;
  try {
    state.phase = PHASE.LEVEL_TRANSITION;
    ui.setHitsEnabled(false);
    game.showHandOn(null);
    ui.hideHand();
    game.clearHint();
    audio.play('complete');
    for (const f of state.fish) {
      if (f.gone) continue;
      f.frozen = false;
      f.escape();
    }
    ui.setInstruction('');
    if (next < LEVELS.length) {
      game.popo.idle();
      game.popo.act('dance');
    }
    await clock.wait(1300, token);
    state.fish = [];
    ui.clearHits();
    if (next >= LEVELS.length) {
      await celebrate(game, token);
      return;
    }
    if (LEVELS[next].place !== game.place) await rowOn(game, LEVELS[next].place, token);
    if (LEVELS[next].observe) {
      await recallAngles(game, token);
      await observeAngles(game, next, token);
    } else {
      game.startLevel(next);
      await clock.wait(400, token);
    }
    game.play();
    game.speakInstruction();
  } catch (e) {
    swallow(e);
  }
}

// Popo paddles on round the lake to the next level's place: the scenery pans to it with depth
// parallax while the raft surges with each stroke and leaves a wake.
async function rowOn(game, to, token) {
  const { popo, fx, audio } = game;
  try {
    await game.prepareTransition(to, token);
  } catch (e) {
    if (e instanceof Cancelled) throw e;
    return; // the next scenery couldn't load: the level starts here rather than get stuck
  }
  if (!isCurrent(token)) throw new Cancelled();
  audio.setTravel(true);
  const fromWater = game.waterline;
  const toWater = PLACES[to].waterline;
  const duration = fx.reduced ? 2400 : 5400;
  const stroke = duration / (fx.reduced ? 1 : 3);
  popo.startRowing(stroke);
  let lastBlade = popo.paddleTip();
  let lastSplashStroke = -1;
  let lastWake = 0;
  try {
    await clock.tween(duration, token, (t) => {
      const k = ease.inOut(t);
      game.transition.k = k;
      game.setWaterline(fromWater + (toWater - fromWater) * k);
      const elapsed = t * duration;
      popo.setRowingTime(elapsed);
      // every pull drives the raft forward and lifts the bow a little; it settles as the blade lifts
      const surge = popo.rowRig.sample(elapsed, stroke).power;
      const pace = Math.sin(t * Math.PI);
      popo.travelShift = pace * (18 + surge * 24);
      popo.tilt = -pace * (0.012 + surge * 0.014);
      const blade = popo.paddleTip();
      const strokeIndex = Math.floor(elapsed / stroke);
      if (strokeIndex !== lastSplashStroke && lastBlade.y < game.waterline && blade.y >= game.waterline) {
        lastSplashStroke = strokeIndex;
        const crossing = (game.waterline - lastBlade.y) / (blade.y - lastBlade.y);
        fx.splash(lastBlade.x + (blade.x - lastBlade.x) * crossing, game.waterline, false);
        audio.play('paddle');
      }
      lastBlade = blade;
      if (elapsed - lastWake > 380 && t > 0.06 && t < 0.94) {
        lastWake = elapsed;
        const stern = popo.placement(popo.pose.sheet, popo.pose.frame).raftLeftX + popo.travelShift;
        fx.ripple(stern - 12, game.waterline + 6, 0.7);
      }
    });
    game.finishTransition();
  } finally {
    // however the row ends (even cancelled by a restart), Popo is left sitting on his spot
    popo.idle();
    popo.travelShift = 0;
    popo.tilt = 0;
    if (isCurrent(token)) audio.setTravel(false);
  }
  await clock.wait(350, token);
}

// G5.1, the angle recall: a shell on the sand wiggles twice (Popo spots it) and opens round its
// hinge on a glowing pearl; the lake darkens, and the pearl blows the big lesson card up into the
// middle of the screen in a bubble that pops, which makes Popo cheer. Then Swiftee flies in beside it and explains, and
// each next line waits until the card has finished drawing the last one. At the end: a moment to
// read, a last sparkle, the card floats away in a bubble, the light fades as the shell closes and
// the lake brightens, and the shell fades from the sand before the fish come.
async function recallAngles(game, token) {
  const { popo, audio, fx } = game;
  const quick = fx.reduced;
  state.phase = PHASE.RECALL;
  game.ui.setInstruction('');
  const r = game.showRecall();
  const { shell } = r;
  const until = async (done) => {
    while (!done()) await clock.wait(50, token);
  };
  const [look, remember, leg, sum, cheer] = STORY.recall;
  const [px, py] = game.pearlAt();
  try {
    audio.play('bubbles');
    await clock.tween(350, token, (t) => { shell.alpha = t; });
    game.mark = { char: '!', t: 0, colour: '#ffd23f' };
    audio.play('boing');
    for (let i = 0; i < 2; i += 1) {
      audio.play('rattle');
      fx.puff(px + (i ? 34 : -34), py - 6, i ? 1 : -1, 2, false); // a few bubbles escape
      await clock.tween(quick ? 220 : 340, token, (t) => {
        shell.rock = quick ? 0 : 0.08 * Math.sin(t * Math.PI * 2) * (i ? -1 : 1);
        shell.leak = 0.35 + 0.3 * (i + t);
        popo.tilt = 0.025 * Math.sin(t * Math.PI * 2) * (1 - t);
      });
    }
    shell.rock = 0;
    popo.tilt = 0;
    await clock.tween(quick ? 60 : 150, token, (t) => { shell.squash = Math.sin((t * Math.PI) / 2); });
    audio.play('shellOpen');
    await clock.tween(quick ? 350 : 700, token, (t) => {
      shell.squash = 1 - t;
      shell.open = quick ? t : ease.outBack(t);
      shell.leak = 1 - t;
      r.glow = 0.6 * t;
    });
    audio.play('shimmer');
    await clock.tween(quick ? 350 : 800, token, (t) => {
      shell.pearl = 1 + 0.16 * Math.sin(t * Math.PI);
      r.glow = 0.6 + 0.4 * t;
      r.dim = ease.inOut(t);
    });
    // the pearl blows the card up in a bubble, which pops in the middle of the screen
    audio.play('rise');
    r.spawning = true;
    await clock.tween(quick ? 600 : 1900, token, (t) => {
      r.emerge = t;
      r.beam = Math.min(1, t * 2);
    });
    r.spawning = false;
    audio.play('land');
    popo.act('catch');
    await clock.tween(600, token, (t) => {
      r.flash = 1 - t;
      r.beam = 1 - 0.65 * t; // it keeps projecting, softly, while Swiftee explains
      r.glow = 1 - 0.6 * t;
    });
    await swifteeArrives(game, [look], token, {
      to: RECALL_PERCH,
      dip: -40,
      onLand: (bird) => { bird.dir = 1; }, // she turns to watch the card
    });
    await until(() => r.t >= r.parallel + 1);
    await game.sayAll([remember, leg], token);
    await until(() => r.t >= r.anglesDone + 0.3);
    await game.sayAll([sum], token);
    await until(() => r.t >= r.sum + 1.4);
    await game.sayAll([cheer], token);
    await clock.wait(1200, token); // a moment to read it all
    audio.play('shimmer');
    fx.sparkle(px, py - 8, 6);
    game.hideRecall(); // the card shrinks into a bubble, which floats up and pops
    audio.play('bubbles');
    await clock.wait(quick ? 600 : 1100, token);
    await clock.tween(500, token, (t) => {
      r.beam = 0.35 * (1 - t);
      r.glow = 0.4 * (1 - t);
    });
    audio.play('click');
    await clock.tween(quick ? 350 : 750, token, (t) => {
      shell.open = 1 - ease.inOut(t);
      r.dim = 1 - t;
    });
    await clock.tween(400, token, (t) => { shell.alpha = 1 - t; });
  } finally {
    popo.tilt = 0;
    if (game.recall === r) game.recall = null;
  }
}

// Where level 5's fish stop for the look, as fractions of the swim area: the first in the middle,
// the others round it.
const STATIONS = [[0.5, 0.5], [0.2, 0.27], [0.8, 0.27], [0.27, 0.8], [0.73, 0.8]];

// G5.2: one of level 5's fish swims into the middle as Swiftee says "Look at the marked angles!",
// and its two angles light up on "angles!"; then the others swim to their places round it. All
// hold still for two seconds just to look (no fishing yet), then swim on from where they are.
async function observeAngles(game, next, token) {
  const { area, ui } = game;
  state.phase = PHASE.OBSERVE;
  game.startLevel(next);
  ui.setInstruction(''); // the catching instruction comes with the fishing
  const first = state.fish.find((f) => f.correct) || state.fish[0];
  const order = [first, ...state.fish.filter((f) => f !== first)];
  const plan = order.map((fish, i) => {
    const [fx, fy] = STATIONS[i % STATIONS.length];
    const to = { x: area.left + fx * (area.right - area.left), y: area.top + fy * (area.bottom - area.top) };
    const dir = i === 0 || to.x < STAGE_W / 2 ? 1 : -1;
    const from = dir > 0 ? -fish.w / 2 - 20 : STAGE_W + fish.w / 2 + 20;
    Object.assign(fish, { offstage: true, frozen: true, dir, x: from, y: to.y, lastY: to.y });
    return { fish, from, to: to.x };
  });
  const swimIn = (group, ms, gap) => clock.tween(ms + gap * (group.length - 1), token, (t) => {
    group.forEach(({ fish, from, to }, i) => {
      const k = ease.out(Math.max(0, Math.min(1, (t * (ms + gap * (group.length - 1)) - i * gap) / ms)));
      if (k > 0) fish.offstage = false;
      fish.x = from + (to - from) * k;
    });
  });
  game.spotlight = first; // the story cue on "angles!" lights up its marks
  const arriving = swimIn(plan.slice(0, 1), 1500, 0);
  arriving.catch(() => {});
  await game.sayAll(STORY.observe, token);
  await arriving;
  game.spotlight = null;
  await swimIn(plan.slice(1), 1300, 140);
  for (const fish of state.fish) fish.showMarks();
  await clock.wait(2000, token); // two seconds just to look
  for (const fish of state.fish) fish.hideMarks();
  for (const fish of state.fish) fish.release();
  await swifteeLeaves(game, token);
}

// G6, after the sixteenth catch: the last fish swim off, Popo cheers, Swiftee flies in with "You
// did it!", then the big-catch gag and the end.
async function celebrate(game, token) {
  const { popo, audio, ui } = game;
  ui.setInstruction('');
  audio.play('success');
  popo.idle();
  popo.act('dance');
  await game.sayAll(STORY.wow, token);
  popo.idle();
  await swifteeArrives(game, STORY.done, token);
  await clock.wait(900, token);
  game.endLine(); // "You did it!" closes before the lake goes dark
  await clock.wait(400, token);
  await bigCatch(game, token);
  await theEnd(game, token);
  game.awaitingNext = true; // the game stays pausable until Next ends it
  ui.showNext();
  audio.play('bloop');
}

// The big catch, before the end: the lake darkens and a giant fish shadow glides in under the
// raft to a slow heartbeat, two pale eyes blinking in the dark. Popo: "Whoa! A giant fish!"
// He hooks it and hauls, the camera leaning in: the water churns and rings spread at the line
// with every heave, the shadow thrashes, everything shakes. Then a flash, a column of water
// bursts up, and out of it flips... an old boot. They stare; "Huh?!"; "Good catch, Popo!"; both
// crack up, and the boot drops back in with a splash while they laugh on.
async function bigCatch(game, token) {
  const { popo, fx, audio } = game;
  const wl = game.waterline;
  const bird = game.swiftee;
  const shadow = game.showShadow(STAGE_W + 420, wl + 250);
  audio.play('drama');
  game.vignetteTo = 0.7;
  let beat = -1;
  await clock.tween(2600, token, (t) => {
    shadow.x = STAGE_W + 420 + (800 - STAGE_W - 420) * ease.out(t);
    shadow.eyes = Math.max(0, Math.min(1, (t - 0.3) / 0.3));
    const b = Math.floor(t * 4);
    if (b !== beat) {
      beat = b;
      audio.play('thump');
    }
    if (Math.random() < 0.1) fx.puff(shadow.x - 150 + Math.random() * 260, shadow.y - 80, 0, 1, true);
  });
  popo.act('catch');
  // Swiftee flutters out to watch from the right, clear of the line, the spout and the boot's
  // swing, so Popo's side and hers each keep their own room
  if (bird) await flyTo(game, bird, { x: 880, y: 200 }, 800, token, -1);
  await game.say(STORY.whoa, token);
  // cast at it, and the line goes tight
  await castTo(game, { x: shadow.x - 150, y: shadow.y - 40, w: 1, h: 1, dir: -1, scale: 1, mouth: [0.5, 0.5] }, token);
  audio.play('hooked');
  game.vignetteTo = 0.4;
  popo.playFrames('casting', ['reel', 'reel2'], 130, true);
  const hold = { x: popo.line.hook.x, y: popo.line.hook.y };
  const shouting = game.say(STORY.heave, token);
  shouting.catch(() => {});
  game.speedLines = 1;
  game.zoomTo(1.07, hold.x - 120, wl);
  let yanks = -1;
  const deep = shadow.baseY;
  await clock.tween(2800, token, (t) => {
    const ms = t * 2800;
    const yank = Math.floor(ms / 560);
    if (yank !== yanks) {
      yanks = yank;
      audio.play('tug');
      audio.play(yank % 2 ? 'thump' : 'creak');
      fx.splash(hold.x + (Math.random() - 0.5) * 30, wl, yank % 2 === 1);
      fx.ripple(hold.x, wl + 4, 1 + 0.4 * (yank % 2));
      fx.puff(hold.x + 20, wl + 30, 0, 3, true);
      if (yank > 0) game.shake(6, 0.28);
      if (bird) bird.hop();
    }
    const jerk = Math.sin((ms / 560) * Math.PI * 2);
    popo.tilt = 0.035 + 0.05 * jerk; // leaning out over the water, heaving back
    popo.lean = 12 * jerk;
    popo.line.tension = 1.7 + 0.5 * Math.abs(jerk);
    popo.line.hook.x = hold.x + jerk * 24;
    popo.line.hook.y = hold.y + Math.abs(jerk) * 10;
    // the shadow thrashes and is dragged up towards the surface
    shadow.x = hold.x + 150 + jerk * 50;
    shadow.baseY = deep - 90 * t + Math.abs(jerk) * 16;
    shadow.wag += 0.35;
  });
  await shouting;
  // up it bursts: a flash, a column of water, rings, a big shake... and it's a boot
  game.speedLines = 0;
  game.zoomTo(1);
  game.vignetteTo = 0;
  game.flash = 1;
  game.geyser = { x: hold.x, t: 0 };
  game.sprayFrom(hold.x, wl - 20, 46, 1.1);
  audio.play('splashBig');
  audio.play('leap');
  fx.splash(hold.x, wl, true);
  fx.splash(hold.x + 40, wl, true);
  fx.ripple(hold.x, wl + 4, 2.2);
  game.shake(14, 0.55);
  game.shadow = null;
  popo.stopFrames();
  popo.tilt = 0;
  popo.lean = 0;
  popo.setPose('casting', 'up');
  // up the middle of the spout it comes (the boot hangs by its loop, so it's centred under it)...
  const centre = hold.x - 34 * 1.05;
  const boot = game.showTrash(centre, wl + 60);
  const top = wl - 250;
  if (bird) {
    bird.hop();
    game.say(STORY.eek, token).catch(() => {});
  }
  await clock.tween(420, token, (t) => {
    boot.y = wl + 60 + (top - wl - 60) * ease.out(t);
    boot.angle = 0.2 * Math.sin(t * Math.PI);
    popo.line.tension = 1;
  });
  // ...and swings in on the line, a flip on the way, to dangle below the rod tip
  const hang = game.bootHang();
  await clock.tween(1100, token, (t) => {
    const k = ease.inOut(t);
    boot.x = centre + (hang.x - centre) * k;
    boot.y = top + (hang.y - top) * k - Math.sin(t * Math.PI) * 70;
    boot.angle = -0.9 * Math.sin(k * Math.PI) + 0.25 * (1 - k);
  });
  boot.hanging = true;
  boot.t = 0;
  audio.play('boing');
  await clock.wait(700, token); // a beat, all staring at it
  await game.say(STORY.huh, token);
  await game.say(STORY.goodCatch, token);
  // both crack up, and Popo lets go of the rod: the boot drops back in with a splash, while
  // Swiftee, laughing, stays on her perch
  if (bird) bird.laughing = true;
  popo.idle();
  popo.act('giggle', true); // one laugh on and on, rod down, through to the end
  audio.play('laugh');
  boot.hanging = false;
  const from = boot.y;
  let splashed = false;
  const drop = clock.tween(800, token, (t) => {
    boot.y = from + 640 * t * t;
    boot.angle = 0.5 * t;
    if (!splashed && boot.y + 150 > wl) {
      splashed = true;
      fx.splash(boot.x + 30, wl, true);
      fx.ripple(boot.x + 30, wl + 4, 1.8);
      game.sprayFrom(boot.x + 40, wl - 10, 24, 0.7);
      audio.play('splashBig');
      game.shake(6, 0.3);
    }
  });
  drop.then(() => {
    game.trash = null;
    popo.line.mode = 'dangle';
    popo.line.tension = 0;
  }).catch(() => {});
  for (const line of STORY.laughs) {
    if (line.who === 'swiftee') audio.play('giggle');
    await game.say(line, token);
  }
  await drop;
}

// Swiftee flutters to a spot in a little arc, then faces `facing` (1 right, -1 left).
async function flyTo(game, bird, to, ms, token, facing) {
  const from = { x: bird.x, y: bird.y };
  bird.dir = to.x < from.x ? -1 : 1;
  await clock.tween(game.fx.reduced ? ms / 2 : ms, token, (t) => {
    const k = ease.inOut(t);
    bird.x = from.x + (to.x - from.x) * k;
    bird.y = from.y + (to.y - from.y) * k - Math.sin(t * Math.PI) * 50;
    bird.lean = 0.22 * Math.sin(t * Math.PI);
    bird.flapRate = 20;
  });
  bird.lean = 0;
  bird.flapRate = 11;
  bird.dir = facing;
}

// The end, cartoon style: an iris closes on Popo and Swiftee laughing, gliding to the middle of the
// screen with them inside it, and stays open while "The End" pops up above it; Next shuts it
// (closeCurtain).
async function theEnd(game, token) {
  const { popo, audio } = game;
  const bird = game.swiftee;
  const head = popo.headTop();
  popo.act('giggle', true); // still laughing (the loop carries on from the gag)
  // Swiftee snuggles in beside Popo, so the circle can frame the two of them whole
  if (bird) await flyTo(game, bird, { x: head.x + 250, y: head.y + 50 }, 700, token, -1);
  const raft = popo.placement('fishing', 'idle');
  const box = { left: raft.raftLeftX - 10, right: raft.raftRightX + 10, top: head.y - 30, bottom: popo.anchor.y + 34 };
  if (bird) {
    box.right = Math.max(box.right, bird.x + 95);
    box.top = Math.min(box.top, bird.y - 110);
  }
  const r = Math.hypot(box.right - box.left, box.bottom - box.top) / 2 + 14;
  // the view inside the circle stays within the painting, so no edge of it shows
  const focus = {
    x: Math.min(STAGE_W - r, Math.max(r, (box.left + box.right) / 2)),
    y: Math.min(STAGE_H - r, Math.max(r, (box.top + box.bottom) / 2)),
  };
  const spot = { x: STAGE_W / 2, y: Math.min(STAGE_H - r - 22, Math.max(575, r + 245)) };
  // the circle closes in place round the two of them, then glides to the middle carrying the live
  // scene with it (only once it's small, so its view never runs off the painting)
  game.iris = { ...focus, r: 1500 };
  audio.play('iris');
  await clock.tween(game.fx.reduced ? 400 : 950, token, (t) => { game.iris.r = 1500 + (r - 1500) * ease.inOut(t); });
  await clock.tween(game.fx.reduced ? 300 : 750, token, (t) => {
    const k = ease.inOut(t);
    game.iris.x = focus.x + (spot.x - focus.x) * k;
    game.iris.y = focus.y + (spot.y - focus.y) * k;
    game.panScene(game.iris.x - focus.x, game.iris.y - focus.y);
  });
  game.showEnding();
  audio.play('tada');
  await clock.wait(1300, token); // "The End" pops in
}

// Next: the iris shuts on them, the title fades with it, and the activity ends.
async function closeCurtain(game) {
  const token = newToken();
  try {
    if (game.iris) {
      game.audio.play('iris');
      const from = game.iris.r;
      await clock.tween(game.fx.reduced ? 250 : 500, token, (t) => {
        game.iris.r = from * (1 - ease.in(t));
        if (game.ending) game.ending.fade = 1 - t;
      });
      await clock.wait(200, token);
    }
  } catch (e) {
    swallow(e);
    return;
  }
  game.complete();
}

// Swiftee swoops in from the right, below the sound and pause buttons, answers Popo while still in
// flight, and settles into a hover beside him, facing him. Options: `to` where she hovers, `dip`
// how far the swoop dips mid-flight (negative arcs up), `onLand` once she has settled.
async function swifteeArrives(game, lines, token, { onLine = () => {}, to = { x: game.popo.anchor.x + 360, y: game.popo.anchor.y - 130 }, dip = 50, onLand = () => {} } = {}) {
  const { fx, audio } = game;
  const [first, ...rest] = [].concat(lines);
  const from = { x: STAGE_W + 140, y: Math.max(230, to.y) };
  const bird = new Swiftee(from.x, from.y);
  bird.faceViewer = lines === STORY.welcome;
  bird.onDownstroke = () => audio.play('flap');
  game.swiftee = bird;
  audio.play('whoosh');
  let talking = null;
  await clock.tween(fx.reduced ? 1200 : 2400, token, (t) => {
    const k = ease.out(t);
    bird.x = from.x + (to.x - from.x) * k;
    // a swoop: dips on the way in and pulls up into the hover
    bird.y = from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * dip;
    bird.lean = 0.32 * (1 - t) ** 1.5;
    bird.flapRate = 11 + 9 * (1 - t);
    if (Math.random() < 0.25 * (1 - t)) fx.sparkle(bird.x + 70, bird.y + (Math.random() - 0.5) * 60, 1);
    if (!talking && t > 0.3) {
      onLine(0);
      talking = game.say(first, token);
      talking.catch(() => {});
    }
  });
  bird.lean = 0;
  bird.onDownstroke = null;
  onLand(bird);
  if (talking) await talking;
  await game.sayAll(rest, token, (i) => onLine(i + 1));
}

// Swiftee flies off to the right, gathering speed.
async function swifteeLeaves(game, token) {
  const bird = game.swiftee;
  if (!bird) return;
  bird.faceViewer = false;
  const from = { x: bird.x, y: bird.y };
  bird.dir = 1;
  bird.onDownstroke = () => game.audio.play('flap');
  game.audio.play('whoosh');
  try {
    // off to the right, staying below the buttons and the instruction
    const end = Math.max(from.y, 230);
    await clock.tween(game.fx.reduced ? 600 : 1300, token, (t) => {
      const k = t * t;
      bird.x = from.x + (STAGE_W + 200 - from.x) * k;
      bird.y = from.y + (end - from.y) * k - 25 * Math.sin(k * Math.PI);
      bird.lean = -0.25 * t;
      bird.flapRate = 14 + 8 * t;
    });
  } finally {
    if (game.swiftee === bird) game.swiftee = null;
  }
}

Object.assign(PopoGame, { mouthOf, correctCatch, wrongCatch, opening, finishLevel, closeCurtain });
})(window.PopoGame = window.PopoGame || {});
