(function (PopoGame) {
'use strict';

// The world is designed in a fixed 1672x941 logical space (the background's native size)
// and scaled to fit the viewport. Everything in the game thinks in logical pixels.
const STAGE_W = 1672;
const STAGE_H = 941;
const SEABED_Y = 805;

class Stage {
  constructor(root, canvas) {
    this.root = root;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.curtain = root.querySelector('#curtain');
    this.curtainCtx = this.curtain.getContext('2d');
    this.scale = 1;
    this.dpr = 1;
    this.portrait = false;
    this.resize();
  }

  resize() {
    const app = this.root.parentElement;
    let vw = window.innerWidth;
    let vh = window.innerHeight;
    // a phone or tablet held upright turns the game sideways to fill its screen
    this.rotated = vh > vw && window.matchMedia('(pointer: coarse)').matches;
    app.classList.toggle('rotated', this.rotated);
    app.style.width = this.rotated ? `${vh}px` : '';
    app.style.height = this.rotated ? `${vw}px` : '';
    if (this.rotated) {
      [vw, vh] = [vh, vw];
    } else {
      const pad = getComputedStyle(app);
      vw -= parseFloat(pad.paddingLeft) + parseFloat(pad.paddingRight);
      vh -= parseFloat(pad.paddingTop) + parseFloat(pad.paddingBottom);
    }
    this.portrait = vh > vw * 1.15;
    const scale = Math.min(vw / STAGE_W, vh / STAGE_H);
    const w = Math.round(STAGE_W * scale);
    const h = Math.round(STAGE_H * scale);
    this.scale = scale;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.root.style.width = `${w}px`;
    this.root.style.height = `${h}px`;
    this.root.style.setProperty('--em', `${scale * 10}px`);
    for (const c of [this.canvas, this.curtain]) {
      c.width = Math.round(w * this.dpr);
      c.height = Math.round(h * this.dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    }
  }

  // Resets the transform so drawing code can use logical coordinates.
  begin() {
    const k = this.dpr * this.scale;
    this.ctx.setTransform(k, 0, 0, k, 0, 0);
    return this.ctx;
  }

  beginCurtain() {
    const k = this.dpr * this.scale;
    this.curtainCtx.setTransform(k, 0, 0, k, 0, 0);
    return this.curtainCtx;
  }

  // A screen point in stage pixels (turned back first when the game is on its side).
  toStage(clientX, clientY) {
    if (this.rotated) {
      const x = clientY - this.root.offsetLeft;
      const y = window.innerWidth - clientX - this.root.offsetTop;
      return { x: x / this.scale, y: y / this.scale };
    }
    const r = this.root.getBoundingClientRect();
    return { x: (clientX - r.left) / this.scale, y: (clientY - r.top) / this.scale };
  }
}

// Where the answer fish may swim: deep water, clear of the surface, seabed, Popo's raft and the HUD strip.
// Fish use the whole underwater stage, from just below the raft down over the sand.
function swimArea(waterline) {
  return { left: 40, right: STAGE_W - 40, top: waterline + 55, bottom: SEABED_Y + 70 };
}

function raftAnchor(waterline) {
  return { x: 238, y: waterline + 12 };
}

Object.assign(PopoGame, { STAGE_W, STAGE_H, SEABED_Y, Stage, swimArea, raftAnchor });
})(window.PopoGame = window.PopoGame || {});
