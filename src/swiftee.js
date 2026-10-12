(function (PopoGame) {
'use strict';
const { assets } = PopoGame;

// Swiftee, the little teal bird who drops in at the end of the journey. Four wing beats from
// one atlas, every frame registered on the belly so the body holds still while the wings flap.
const BEAT = [0, 1, 2, 1, 3, 1, 2, 1];
const SCALE = 0.68;

class Swiftee {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.dir = -1; // the art faces right; Swiftee arrives from the right, facing Popo
    this.faceViewer = false; // the opening addresses the player with the frontal flight atlas
    this.time = 0;
    this.beat = 0; // wing-beat phase, in frames; the rate eases down as Swiftee settles
    this.lean = 0;
    this.spin = null;
    this.flapRate = 16;
    this.lastBeat = -1;
    this.onDownstroke = null;
    this.speaking = false;
    this.celebrating = false;
    this.blinkIn = 2.1;
    this.blink = 0;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // a quick loop-de-loop on the stressed word
  twirl() {
    if (this.faceViewer) { this.hop(); return; }
    this.spin = { t: 0 };
  }

  // a little bounce, now and then while waiting for Next
  hop() {
    this.bounce = { t: 0 };
  }

  update(dt) {
    this.time += dt;
    this.blinkIn -= dt;
    this.blink = Math.max(0, this.blink - dt);
    if (this.blinkIn <= 0) { this.blink = .18; this.blinkIn = 2.8 + Math.random() * 2; }
    this.beat += dt * this.flapRate;
    const beat = Math.floor(this.beat);
    if (beat !== this.lastBeat) {
      this.lastBeat = beat;
      const downstroke = this.faceViewer ? beat % 8 === 4 : BEAT[beat % BEAT.length] === 2;
      if (downstroke && this.onDownstroke) this.onDownstroke();
    }
    if (this.spin) {
      this.spin.t += dt / 0.55;
      if (this.spin.t >= 1) this.spin = null;
    }
    if (this.bounce) {
      this.bounce.t += dt / 0.45;
      if (this.bounce.t >= 1) this.bounce = null;
    }
  }

  // where a speech bubble's tail should point: just above Swiftee's head
  head() {
    const d = PopoGame.SWIFTEE_DATA;
    return { x: this.x + 18, y: this.bobY() - d.belly[1] * SCALE + 6 };
  }

  bobY() {
    const hop = this.bounce && !this.reduced ? Math.sin(this.bounce.t * Math.PI) * 26 : 0;
    return this.y + Math.sin(this.time * 7) * (this.reduced ? 1 : 6) - hop;
  }

  personalityFrame() {
    // Retain the established flight cycle during swoops and loop-de-loops.
    if (!assets.swifteePersonality || Math.abs(this.lean) > .025 || this.spin) return null;
    if (this.laughing) return this.reduced ? 7 : [7, 3, 7, 2][Math.floor(this.time * 8) % 4];
    if (this.blink > 0) return this.blink > .13 || this.blink < .04 ? 1 : 2;
    if (this.speaking) return [3, 0, 4, 3, 5, 0][Math.floor(this.time * 10) % 6];
    if (this.celebrating && Math.sin(this.time * 1.8) > .6) return 7;
    return this.reduced ? 0 : [12, 0, 14, 0][Math.floor(this.beat / 2) % 4];
  }

  frontFrame() {
    const beat = this.reduced ? 2 : Math.floor(this.beat) % 8;
    // Four open-beak drawings share the up/level/down/level wing phases.
    return this.speaking && Math.floor(this.time * 9) % 3 !== 0 ? 8 + Math.floor(beat / 2) : beat;
  }

  drawFront(ctx) {
    const data = PopoGame.PERSONALITY_DATA['swiftee-front'];
    const frame = this.frontFrame();
    const [sx, sy, sw, sh] = data.frames[frame].box;
    const k = 178 / data.frames[0].height;
    ctx.save();ctx.translate(this.x, this.bobY() + 45);
    // Gentle banking preserves eye contact; do not mirror or turn toward Popo.
    if (!this.reduced) ctx.rotate(Math.max(-.06, Math.min(.06, this.lean * .18)));
    ctx.scale(k, k);
    ctx.drawImage(assets.swifteeFront, sx, sy, sw, sh, -128, -236, 256, 256);
    ctx.restore();
  }

  draw(ctx) {
    if (this.faceViewer && assets.swifteeFront) { this.drawFront(ctx); return; }
    const d = PopoGame.SWIFTEE_DATA;
    const img = assets.swiftee;
    if (!img || !d) return;
    const personality = this.personalityFrame();
    if (personality !== null) {
      const data = PopoGame.PERSONALITY_DATA.swiftee;
      const k = 178 / data.frames[0].height;
      const [sx, sy, sw, sh] = data.frames[personality].box;
      ctx.save();ctx.translate(this.x, this.bobY() + 45);
      ctx.scale(this.dir * k, k);
      ctx.drawImage(assets.swifteePersonality, sx, sy, sw, sh, -128, -236, 256, 256);
      ctx.restore();
      return;
    }
    const frame = BEAT[Math.floor(this.beat) % BEAT.length];
    const spin = this.spin ? Math.sin(this.spin.t * Math.PI / 2) ** 2 * Math.PI * 2 : 0;
    ctx.save();
    ctx.translate(this.x, this.bobY());
    ctx.rotate(this.dir * (this.lean + spin));
    // a little squash on the downstroke makes the flap read at a glance
    const squash = frame === 2 ? 0.05 : 0;
    ctx.scale(this.dir * SCALE * (1 + squash), SCALE * (1 - squash));
    ctx.drawImage(img, frame * d.width, 0, d.width, d.height, -d.belly[0], -d.belly[1], d.width, d.height);
    ctx.restore();
  }
}

Object.assign(PopoGame, { Swiftee });
})(window.PopoGame = window.PopoGame || {});
