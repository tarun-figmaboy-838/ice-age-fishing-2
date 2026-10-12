(function (PopoGame) {
'use strict';
const { assets, getShape, STAGE_W, geometry } = PopoGame;
const { classify, layoutMarks, inside, edgeClearance, crossings, round, MARK } = geometry;

const TAU = Math.PI * 2;
const FISH_SCALE = 0.58;

// How a fish swims, turns, darts, startles and comes and goes. The art fish (Fish) and the
// trapezium levels' shape fish (ShapeFish) only differ in what they draw.
class Swimmer {
  constructor(x, y, dir, w, h) {
    this.w = w;
    this.h = h;
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.cruise = 52 + Math.random() * 34;
    this.speed = this.cruise;
    this.turn = null;
    this.turnIn = 9 + Math.random() * 8;
    this.wanderIn = 1 + Math.random() * 2.5;
    this.dartIn = 4 + Math.random() * 8;
    this.dart = null;
    this.calm = false; // a calm fish never darts off on its own and only startles a little
    this.lingers = false; // a lingering fish usually turns back at the edge instead of leaving
    this.atEdge = false;
    this.puffs = 0;
    this.trail = 0;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.driftPhase = Math.random() * TAU;
    this.driftAmp = 8 + Math.random() * 8;
    this.driftFreq = 0.25 + Math.random() * 0.2;
    // Start on the drift curve so the first frame never jumps vertically.
    this.baseY = y - Math.sin(this.driftPhase) * this.driftAmp;
    this.targetY = this.baseY;
    this.bobPhase = Math.random() * TAU;
    this.frozen = false;
    this.wiggleT = -1;
    this.scale = 1;
    this.alpha = 1;
    this.hinted = false;
    this.gone = false;
    this.offstage = false; // swimming out of view between visits
    this.away = 0;
    this.escaping = false;
    this.breath = 2 + Math.random() * 4;
    this.pitch = 0;
    this.lastY = y;
  }

  // Leave the stage for a while, then swim back in from either side at a new depth.
  goOffstage(seconds) {
    this.offstage = true;
    this.away = seconds;
    this.turn = null;
    this.dart = null;
  }

  // The depth with the most room around x (from fish within `reach` of it), and that room.
  clearDepth(area, others, x, reach) {
    const near = others.filter((o) => o !== this && !o.gone && !o.offstage && Math.abs(o.x - x) < (o.w + this.w) / 2 + reach);
    const top = area.top + this.h / 2;
    const span = Math.max(0, area.bottom - area.top - this.h);
    let best = { y: top + Math.random() * span, room: Infinity };
    if (!near.length) return best;
    best.room = -Infinity;
    for (let i = 0; i <= 10; i += 1) {
      const y = top + (span * i) / 10;
      const room = Math.min(...near.map((o) => Math.abs(o.y - y) - (o.h + this.h) / 2)) + Math.random() * 6;
      if (room > best.room) best = { y, room };
    }
    return best;
  }

  // Back into view on the side it left from (a first visit picks a side), at the clearest depth
  // near that edge; while that edge is crowded it waits a moment longer out of view.
  enter(area, others = []) {
    const dir = this.exitSide ? -this.exitSide : Math.random() < 0.5 ? 1 : -1;
    const x = dir > 0 ? -this.w / 2 - 12 : STAGE_W + this.w / 2 + 12;
    const lane = this.clearDepth(area, others, x, 320);
    if (lane.room < 0) {
      this.away = 0.4;
      return;
    }
    this.offstage = false;
    this.dir = dir;
    this.x = x;
    this.baseY = lane.y;
    this.targetY = this.baseY;
    this.y = this.baseY;
    this.lastY = this.y;
    this.speed = this.cruise * 2.4; // in briskly, then easing to cruising speed once in view
    this.turnIn = 9 + Math.random() * 8;
  }

  // 0 while the fish is wholly in view; otherwise how far out it is (it crosses the edge briskly).
  offEdge() {
    return Math.max(0, this.w / 2 + 16 - this.x, this.x + this.w / 2 + 16 - STAGE_W);
  }

  // Swim on from where the fish is held, easing up to speed with no jump in depth.
  release() {
    this.frozen = false;
    this.speed = 0;
    this.baseY = this.y - Math.sin(this.driftPhase) * this.driftAmp;
    this.targetY = this.baseY;
    this.lastY = this.y;
    this.turnIn = 4 + Math.random() * 5;
  }

  startTurn() {
    if (!this.turn) this.turn = { stage: 'slow', t: 0 };
  }

  wiggle(subtle = false) {
    this.subtleWiggle = subtle;
    this.wiggleT = 0;
  }

  // a cheeky somersault with a little hop
  flip() {
    this.flipT = 0;
  }

  // A quick playful burst of speed, leaving a short bubble trail.
  startDart(boost = 2.6) {
    if (this.reduced || this.frozen || this.escaping) return;
    this.dart = { t: 0, dur: 0.6, boost: this.calm ? 1 + (boost - 1) * 0.4 : boost };
    this.trail = 0.4;
  }

  // Swim toward something interesting (a tap in the water), then carry on.
  lookAt(point) {
    if (this.frozen || this.escaping) return;
    if (Math.sign(point.x - this.x) !== this.dir) this.startTurn();
    this.targetY = point.y;
    this.wanderIn = 2.5;
    this.puffs += 1;
  }

  // A moment of surprise: wide eyes and an open mouth (shape fish).
  surprise(seconds = 0.7) {
    this.surprised = Math.max(this.surprised || 0, seconds);
  }

  // Startled by a splash: dart away from it.
  startle(point) {
    this.surprise(0.5);
    if (this.frozen || this.escaping) return;
    const away = Math.sign(this.x - point.x) || 1;
    if (away !== this.dir) { this.dir = away; this.turn = null; this.speed = this.cruise * 0.4; }
    this.wiggle(true);
    this.startDart(3);
    this.puffs += 2;
  }

  // Dash off to the right, then come back in from the edge at cruising speed.
  // Off it swims at the end of a level: to the nearer edge (turning round first if that edge is
  // behind it), speeding up as it goes. Never faded, so it keeps its whole look to the edge.
  escape() {
    this.escaping = true;
    this.frozen = false;
    this.dart = null;
    const ahead = this.dir > 0 ? STAGE_W - this.x : this.x;
    this.turn = ahead > STAGE_W / 2 ? { stage: 'slow', t: 0, from: this.speed } : null;
  }

  update(dt, area, others) {
    this.bobPhase += dt * 2.2;
    this.breath -= dt;
    // nose follows the vertical motion a little, smoothed so the body never jitters
    const vy = (this.y - this.lastY) / Math.max(dt, 0.001);
    this.lastY = this.y;
    const want = this.frozen || this.escaping ? 0 : Math.max(-0.09, Math.min(0.09, vy / 900));
    this.pitch += (want - this.pitch) * Math.min(1, dt * 3);
    if (this.flipT >= 0 && (this.flipT += dt) > 0.6) this.flipT = -1;
    if (this.wiggleT >= 0) {
      this.wiggleT += dt;
      if (this.wiggleT > (this.subtleWiggle ? 0.16 : 0.45)) this.wiggleT = -1;
    }
    if (this.frozen) return;
    if (this.offstage) {
      if (!this.escaping && (this.away -= dt) <= 0) this.enter(area, others);
      return;
    }
    if (this.escaping) {
      if (this.turn) {
        // a quick turn round, towards the nearer edge
        this.turn.t += dt;
        const k = Math.min(1, this.turn.t / 0.22);
        if (this.turn.stage === 'slow') {
          this.speed = this.turn.from * (1 - k);
          if (k >= 1) {
            this.dir *= -1;
            this.turn = { stage: 'go', t: 0 };
            this.wiggle(true);
          }
        } else if (k >= 1) {
          this.turn = null;
        }
      }
      if (!this.turn || this.turn.stage === 'go') this.speed = Math.min(620, this.speed + 1300 * dt);
      this.x += this.dir * this.speed * dt;
      if (this.x > STAGE_W + this.w || this.x < -this.w) this.goOffstage(Infinity);
      return;
    }

    // turning: slow to a stop, flip, speed back up (no mid-flip squash of the body)
    if (this.turn) {
      this.turn.t += dt;
      const progress = Math.min(1, this.turn.t / 0.35);
      const k = progress * progress * (3 - 2 * progress);
      if (this.turn.stage === 'slow') {
        this.speed = this.cruise * (1 - k);
        if (k >= 1) {
          this.dir *= -1;
          this.turn = { stage: 'speed', t: 0 };
          this.wiggle(true);
          if (Math.random() < 0.5) this.puffs += 1;
        }
      } else {
        this.speed = this.cruise * k;
        if (k >= 1) this.turn = null;
      }
    } else {
      this.turnIn -= dt;
      if (this.turnIn <= 0) {
        this.turnIn = 5 + Math.random() * 6;
        this.startTurn();
      }
      // reaching the edge ahead: a lingering fish usually turns back (decided once per visit)
      const ahead = this.dir > 0 ? STAGE_W - (this.x + this.w / 2) : this.x - this.w / 2;
      if (ahead < 24 && ahead > -this.w / 3 && !this.atEdge) {
        this.atEdge = true;
        if (this.lingers && Math.random() < 0.7) this.startTurn();
      } else if (ahead > 160) {
        this.atEdge = false;
      }
    }

    if (!this.turn) {
      let cruise = this.cruise * (1 + Math.sin(this.bobPhase * 0.37) * 0.06) * (this.offEdge() > 0 ? 2.4 : 1);
      if (this.dart) {
        this.dart.t += dt;
        const k = this.dart.t / this.dart.dur;
        cruise *= 1 + (this.dart.boost - 1) * Math.max(0, Math.sin(Math.min(1, k) * Math.PI));
        if (k >= 1) this.dart = null;
      } else if (!this.calm) {
        this.dartIn -= dt;
        if (this.dartIn <= 0) {
          this.dartIn = 6 + Math.random() * 9;
          this.startDart();
        }
      }
      this.speed += (cruise - this.speed) * Math.min(1, dt * (this.dart ? 6 : 1.4));
    }
    if (this.trail > 0) this.trail -= dt;
    this.x += this.dir * this.speed * dt;
    if ((this.dir > 0 && this.x > STAGE_W + this.w / 2 + 14) || (this.dir < 0 && this.x < -this.w / 2 - 14)) {
      this.exitSide = this.dir; // 1: left on the right, -1: on the left; it comes back that way
      this.goOffstage(0.8 + Math.random() * 2.2);
      return;
    }

    // slow wandering between depths plus a gentle drift
    this.wanderIn -= dt;
    if (this.wanderIn <= 0) {
      this.wanderIn = 2.5 + Math.random() * 3.5;
      const lane = this.clearDepth(area, others, this.x + this.dir * 200, 420);
      if (lane.room > 0) this.targetY = lane.y; // only wander somewhere clear
    }
    this.baseY += (this.targetY - this.baseY) * Math.min(1, dt * 0.55);
    this.driftPhase += dt * this.driftFreq * TAU;

    // keep clear of the other fish. There's only room for two or three at different depths, so fish
    // sharing a depth keep apart along it: one catching up follows at the other's pace, one meeting
    // another head-on turns away in good time (never while still swimming into view), and two that
    // touch ease apart in depth.
    let pace = Infinity;
    for (const o of others) {
      if (o === this || o.gone || o.offstage) continue;
      const dx = o.x - this.x;
      const dy = o.y - this.y;
      if (Math.abs(dy) >= (this.h + o.h) / 2 + 16) continue;
      const gap = Math.abs(dx) - (this.w + o.w) / 2;
      if (gap < 30) {
        const sign = dy > 0 || (dy === 0 && this.y < o.y) ? -1 : 1;
        this.baseY += sign * Math.min(40, 30 - gap) * Math.min(1, dt * 4);
        this.targetY = this.baseY;
      }
      if (Math.sign(dx) !== this.dir || gap > 160) continue;
      if (o.dir === this.dir && !o.turn && !o.frozen) pace = Math.min(pace, o.speed * (gap < 60 ? 0.7 : 0.97));
      else if (!this.turn && !this.offEdge()) this.startTurn();
    }
    if (pace < this.speed) this.speed = pace;
    const minY = area.top + this.h / 2;
    const maxY = area.bottom - this.h / 2;
    this.baseY = Math.min(maxY, Math.max(minY, this.baseY));
    this.targetY = Math.min(maxY, Math.max(minY, this.targetY));
    this.y = this.baseY + Math.sin(this.driftPhase) * this.driftAmp;
  }

  draw(ctx) {
    if (this.gone || this.offstage) return;
    const bob = this.frozen && this.subtleWiggle ? 0 : Math.sin(this.bobPhase) * 2;
    let rot = 0;
    if (this.wiggleT >= 0) {
      const t = this.wiggleT;
      if (this.subtleWiggle) {
        rot = Math.sin(t / 0.16 * Math.PI * 2) * 0.045 * (1 - t / 0.16);
      } else {
        rot = Math.sin(t * 38) * 0.14 * Math.max(0, 1 - t / 0.45);
      }
    }
    if (this.flipT >= 0) {
      const p = this.flipT / 0.6;
      rot += this.dir * -(p * p * (3 - 2 * p)) * TAU;
    }
    const hop = this.flipT >= 0 ? -Math.sin((this.flipT / 0.6) * Math.PI) * 22 : 0;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y + bob + hop);
    if (this.hinted) {
      const r = Math.max(this.w, this.h) * 0.62 * this.scale;
      const glow = 0.35 + Math.sin(this.bobPhase * 1.5) * 0.2;
      const g = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.15);
      g.addColorStop(0, `rgba(255, 240, 180, ${glow})`);
      g.addColorStop(1, 'rgba(255, 240, 180, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.15, 0, TAU);
      ctx.fill();
    }
    // remembered so the hook can follow the mouth exactly (see mouthOf)
    this.drawBob = bob + hop;
    this.drawTurn = rot + this.pitch * this.dir;
    ctx.rotate(this.drawTurn);
    ctx.scale(this.dir * this.scale, this.scale);
    this.drawBody(ctx);
    ctx.restore();
    this.drawOverlay(ctx);
  }

  drawOverlay() {}

  // Generous touch target around the visible fish.
  hitRect() {
    const margin = 14;
    const w = this.w * this.scale + margin * 2;
    const h = this.h * this.scale + margin * 2;
    return { x: this.x - w / 2, y: this.y - h / 2, w, h };
  }
}

// A fish from the art sheet (assets/sprites/fish.webp).
class Fish extends Swimmer {
  constructor(key, x, y, dir, sizeScale = 1) {
    const shape = getShape(key);
    const box = assets.fish.boxes[shape.atlas];
    super(x, y, dir, (box[2] - box[0]) * FISH_SCALE * sizeScale, (box[3] - box[1]) * FISH_SCALE * sizeScale);
    this.key = key;
    this.shape = shape;
    this.box = box;
    this.mouth = assets.fish.mouths[shape.atlas];
    this.label = `${shape.name} fish`;
  }

  drawBody(ctx) {
    const [x0, y0, x1, y1] = this.box;
    ctx.drawImage(assets.fish.img, x0, y0, x1 - x0, y1 - y0, -this.w / 2, -this.h / 2, this.w, this.h);
  }
}

// --- the trapezium levels' fish ------------------------------------------------------------

// Stage pixels per unit of body length. The colours come from the uploaded fish sheet
// (asset/trapezium-fish.png), leaving out its blue, which melts into the water; colour never
// tells a catch from a distractor.
const UNIT = 22;
const PALETTE = [
  { body: '#fd3a30', fin: '#fda5a2' },
  { body: '#fd8004', fin: '#fec994' },
  { body: '#fdc51a', fin: '#fde3a0' },
  { body: '#37d92b', fin: '#a7e5b8' },
  { body: '#fd48a1', fin: '#fda4c6' },
  { body: '#9c37fd', fin: '#ca95fc' },
  { body: '#02c9c0', fin: '#a3e6d2' },
  { body: '#9ce537', fin: '#cdeba6' },
];
const INK = '#14284b';
// Label sizes in stage pixels: bigger on small screens so they stay readable (see Game.resize).
const LABEL = { min: 17, max: 20 };

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.min(255, Math.round(v * k)));
  return `rgb(${c.join(', ')})`;
}

// A repeatable random sequence, so a body's pattern never changes as it swims.
function seeded(text) {
  let s = [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const LABEL_FONT = 'Fredoka, "Arial Rounded MT Bold", system-ui, sans-serif';

// An angle's arc in the corner at `at`, between its sides along a and b: a lighter tint of the
// body fills the corner and a white arc edged in the body's dark tone, printed on the fish.
// `shown` (0 to 1) sweeps it in; the lines thicken with the radius.
function drawAngleArc(ctx, { at, a, b, radius }, edge, shown = 1) {
  const from = Math.atan2(a[1], a[0]);
  let sweep = Math.atan2(b[1], b[0]) - from;
  sweep = Math.atan2(Math.sin(sweep), Math.cos(sweep)) * shown;
  const k = radius / MARK.arc;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(at[0], at[1]);
  ctx.arc(at[0], at[1], radius, from, from + sweep, sweep < 0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(at[0], at[1], radius, from, from + sweep, sweep < 0);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 6.4 * k;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3.2 * k;
  ctx.stroke();
  ctx.restore();
}

// A measurement printed on a fish: a bold white number edged in the body's dark tone and, for a
// length, a smaller "units" beside it.
function drawPrinted(ctx, label, x, y, size, edge) {
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = edge;
  ctx.fillStyle = '#ffffff';
  const big = `700 ${size.toFixed(1)}px ${LABEL_FONT}`;
  const small = `700 ${(size * 0.66).toFixed(1)}px ${LABEL_FONT}`;
  ctx.font = big;
  const nw = ctx.measureText(label.number).width;
  ctx.font = small;
  const uw = label.unit ? ctx.measureText(label.unit).width + size * 0.18 : 0;
  const left = x - (nw + uw) / 2;
  ctx.textAlign = 'left';
  const parts = [[big, label.number, left, y + size * 0.05, size * 0.3]];
  if (label.unit) parts.push([small, label.unit, left + nw + size * 0.18, y + size * 0.12, size * 0.24]);
  for (const [font, text, tx, ty, width] of parts) {
    ctx.font = font;
    ctx.lineWidth = width;
    ctx.strokeText(text, tx, ty);
    ctx.fillText(text, tx, ty);
  }
  ctx.restore();
}

// Text with a white outline, readable on any colour (the recall card's numbers).
function drawLabel(ctx, text, x, y, size) {
  ctx.save();
  ctx.font = `600 ${size.toFixed(1)}px ${LABEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.28;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeText(text, x, y + size * 0.04);
  ctx.fillStyle = INK;
  ctx.fillText(text, x, y + size * 0.04);
  ctx.restore();
}

function pathOf(ctx, px) {
  ctx.beginPath();
  px.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function distanceToBox(p, box) {
  const dx = Math.max(Math.abs(p[0] - box.at[0]) - box.hw, 0);
  const dy = Math.max(Math.abs(p[1] - box.at[1]) - box.hh, 0);
  return Math.hypot(dx, dy);
}

// Everything that sits on or inside the body for this level (for keeping the face clear).
function keepOut(marks) {
  const spots = [];
  for (const l of marks.labels) spots.push({ box: l });
  const half = MARK.square / 2;
  for (const s of marks.squares) spots.push({ at: [s.at[0] + (s.a[0] + s.b[0]) * half, s.at[1] + (s.a[1] + s.b[1]) * half], r: MARK.square * 0.75 });
  for (const t of marks.ticks) spots.push({ at: t.at, r: MARK.tick + 2 });
  for (const a of marks.arrows) spots.push({ at: a.at, r: MARK.chevron + MARK.gap + 2 });
  for (const a of marks.arcs) spots.push({ at: a.at, r: a.radius + 4 });
  return spots;
}

// The eye goes as far forward as it fits, a little above the middle, clear of the outline and of
// every marking; the smile sits under it. Returns null when nothing fits.
function placeFace(px, box, eyeR, spots) {
  const height = box.bottom - box.top;
  const smileAt = (e) => [e[0] + eyeR * 0.55, e[1] + eyeR * 1.45];
  const clear = (p, r) => spots.every((s) => (s.box ? distanceToBox(p, s.box) : Math.hypot(p[0] - s.at[0], p[1] - s.at[1]) - s.r) >= r);
  let best = null;
  for (let x = box.left; x <= box.right; x += 3) {
    for (let y = box.top; y <= box.bottom; y += 3) {
      const eye = [x, y];
      const smile = smileAt(eye);
      if (!inside(px, eye) || edgeClearance(px, eye) < eyeR * 1.12 + 4) continue;
      if (!inside(px, smile) || edgeClearance(px, smile) < eyeR * 0.8) continue;
      if (!clear(eye, eyeR * 1.12 + 4) || !clear(smile, eyeR * 0.75)) continue;
      const score = 3 * (x - box.left) / (box.right - box.left) - 1.5 * Math.abs(y - (box.top + height * 0.4)) / height;
      if (!best || score > best.score) best = { eye, smile, score };
    }
  }
  return best;
}

// Fins sit behind the body: the tail on the back at mid-height, a dorsal fin on the top and a
// smaller one underneath, each attached where the outline actually is and moved back clear of
// any parallel arrows on the top or bottom side.
function placeFins(px, box, arrows) {
  // fins keep a steady size from fish to fish (a tall body doesn't grow a huge tail)
  const h = Math.max(80, Math.min(100, box.bottom - box.top));
  const w = box.right - box.left;
  const mid = (box.top + box.bottom) / 2;
  const top = (x) => Math.min(...crossings(px, 'x', x));
  const bottom = (x) => Math.max(...crossings(px, 'x', x));
  const tailX = Math.min(...crossings(px, 'y', mid));
  const clearOf = (x, half, above) => {
    for (const { at } of arrows) {
      if ((at[1] < mid) === above && Math.abs(at[0] - x) < half + 14) x = at[0] - half - 14;
    }
    return Math.max(box.left + w * 0.16, x);
  };
  const dorsalX = clearOf(box.left + w * 0.4, h * 0.26, true);
  const ventralX = clearOf(box.left + w * 0.52, h * 0.2, false);
  return {
    tail: { root: [tailX + 12, mid], length: h * 0.46, spread: h * 0.34 },
    dorsal: { a: [dorsalX - h * 0.26, top(dorsalX - h * 0.26) + 7], b: [dorsalX + h * 0.2, top(dorsalX + h * 0.2) + 7], tip: [dorsalX - h * 0.34, top(dorsalX) - h * 0.4] },
    ventral: { a: [ventralX - h * 0.2, bottom(ventralX - h * 0.2) - 6], b: [ventralX + h * 0.12, bottom(ventralX + h * 0.12) - 6], tip: [ventralX - h * 0.28, bottom(ventralX) + h * 0.32] },
  };
}

// A trapezium-level fish: an exact polygon body in the style of the uploaded fish sheet, the
// level's markings drawn from its own geometry, and labels that stay upright whichever way it swims.
class ShapeFish extends Swimmer {
  constructor(spec, level, { colour = PALETTE[0], size = 1, speed = null } = {}) {
    const unit = UNIT * size;
    const marks = layoutMarks(spec.body, unit, level.marks, { corners: spec.corners, font: LABEL.max });
    const small = layoutMarks(spec.body, unit, level.marks, { corners: spec.corners, font: LABEL.min });
    const px = marks.px;
    const xs = px.map((p) => p[0]);
    const ys = px.map((p) => p[1]);
    const box = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
    const bodyH = box.bottom - box.top;
    const fins = placeFins(px, box, marks.arrows);
    // the face keeps clear of the markings at every label size; a smaller eye before none at all
    const spots = [...keepOut(marks), ...keepOut(small)];
    let eyeR = Math.max(12, Math.min(18, bodyH * 0.17));
    let face = placeFace(px, box, eyeR, spots);
    if (!face) {
      eyeR *= 0.85;
      face = placeFace(px, box, eyeR, spots) || placeFace(px, box, eyeR, []);
    }
    if (!face) {
      const eye = [box.left + (box.right - box.left) * 0.62, box.top + bodyH * 0.38];
      face = { eye, smile: [eye[0] + eyeR * 0.55, eye[1] + eyeR * 1.45] };
    }
    // the fish's own frame is centred on everything it draws, fins included
    const left = Math.min(box.left, fins.tail.root[0] - fins.tail.length - 4);
    const right = box.right + 2;
    const top = Math.min(box.top, fins.dorsal.tip[1]) - 2;
    const bottom = Math.max(box.bottom, fins.ventral.tip[1]) + 2;
    super(-999, 0, 1, right - left, bottom - top);
    this.frame = { w: this.w, h: this.h };
    this.setZoom(ShapeFish.zoom);
    this.spec = spec;
    this.level = level;
    this.correct = spec.correct;
    this.unit = unit;
    this.colour = colour;
    this.px = px;
    this.box = box;
    this.fins = fins;
    this.face = face;
    this.eyeR = eyeR;
    this.offset = [-(left + right) / 2, -(top + bottom) / 2];
    this.mouth = [(face.smile[0] + eyeR * 0.3 + this.offset[0]) / this.frame.w + 0.5, (face.smile[1] + this.offset[1]) / this.frame.h + 0.5];
    this.shape = classify(spec.body);
    this.marks = { [LABEL.max]: marks };
    this.wag = Math.random() * TAU;
    this.lingers = true;
    this.blinkIn = 1.5 + Math.random() * 4;
    this.blink = 0;
    this.gaze = null; // a stage point the eyes follow (the hook while Popo casts)
    this.look = [0, 0];
    this.calm = true;
    if (speed) this.cruise = speed;
    this.speed = this.cruise;
    this.label = this.describe();
  }

  // On small screens the whole fish is drawn a little bigger: a uniform scale, so every distance
  // between its markings, labels and face keeps its proportion.
  setZoom(zoom) {
    this.zoom = zoom;
    this.w = this.frame.w * zoom;
    this.h = this.frame.h * zoom;
  }

  // the two marked angles, as measured (level 5)
  get markedAngles() {
    return (this.spec.corners || []).map((i) => Math.round(this.shape.angles[i]));
  }

  get legLengths() {
    return (this.shape.legLengths || []).map((l) => round(l));
  }

  // what the markings say, for screen readers: no more than a sighted player sees
  describe() {
    const m = this.marksFor(LABEL.max);
    const parts = [];
    if (m.arrows.length) parts.push('parallel arrows');
    if (this.level.marks.includes('legs') && this.legLengths.length) parts.push(`legs ${this.legLengths.join(' units and ')} units`);
    if (m.ticks.length) parts.push(m.ticks[0].count === m.ticks[1].count ? 'matching leg ticks' : 'different leg ticks');
    if (m.squares.length) parts.push('two right-angle marks');
    if (m.arcs.length) parts.push(`angles ${this.markedAngles.join('° and ')}°`);
    return parts.length ? `Fish with ${parts.join(', ')}` : 'Fish';
  }

  marksFor(font) {
    if (!this.marks[font]) {
      this.marks[font] = layoutMarks(this.spec.body, this.unit, this.level.marks, { corners: this.spec.corners, font });
    }
    return this.marks[font];
  }

  // Pops parallel arrows onto the parallel sides (a level 5 catch, once its angles have said so).
  revealParallel() {
    const marks = layoutMarks(this.spec.body, this.unit, ['parallel']);
    if (!marks.arrows.length) return false;
    this.reveal = { t: 0, arrows: marks.arrows };
    return true;
  }

  // Lights up the fish's marked angles (gold fans over its corners) until hideMarks(); `swell`
  // grows the whole fish meanwhile (marks and numbers too), so the one being pointed out stands out.
  showMarks(swell = 1) {
    if (!this.shine || this.shine.until !== Infinity) this.shine = { t: 0, until: Infinity };
    this.swellTo = swell;
  }

  hideMarks() {
    if (this.shine) this.shine.until = Math.min(this.shine.until, this.shine.t + 0.4);
    this.swellTo = 1;
  }

  update(dt, area, others) {
    if (this.reveal) this.reveal.t += dt;
    if (this.shine && (this.shine.t += dt) > this.shine.until) this.shine = null;
    if (this.swellTo) {
      this.swell = (this.swell || 1) + (this.swellTo - (this.swell || 1)) * Math.min(1, dt * (this.reduced ? 30 : 5));
      this.setZoom(ShapeFish.zoom * this.swell);
      if (this.swellTo === 1 && Math.abs(this.swell - 1) < 0.002) this.swellTo = 0;
    }
    this.wag += dt * (2.4 + (this.frozen ? 0 : this.speed / 24) + (this.surprised > 0 ? 6 : 0));
    if (this.surprised > 0) this.surprised -= dt;
    // a blink every few seconds, quick enough not to hide the eye for long
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blink = 0.14;
      this.blinkIn = 2.5 + Math.random() * 4.5;
    }
    if (this.blink > 0) this.blink -= dt;
    // the pupils drift toward whatever the fish is watching, or forward
    let want = [0.18, 0.02];
    if (this.gaze) {
      const dx = (this.gaze.x - this.x) * this.dir;
      const dy = this.gaze.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      want = [(dx / d) * 0.3, (dy / d) * 0.3];
    }
    const k = Math.min(1, dt * 6);
    this.look = [this.look[0] + (want[0] - this.look[0]) * k, this.look[1] + (want[1] - this.look[1]) * k];
    super.update(dt, area, others);
  }

  drawBody(ctx) {
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(this.offset[0], this.offset[1]);
    this.drawFins(ctx);
    this.paintBody(ctx);
    this.drawMarks(ctx, this.marksFor(ShapeFish.labelFont));
    if (this.reveal) {
      const k = Math.min(1, this.reveal.t / 0.35);
      const grow = this.reduced ? 1 : 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;
      for (const arrow of this.reveal.arrows) {
        ctx.save();
        ctx.globalAlpha *= k;
        ctx.translate(arrow.at[0], arrow.at[1]);
        ctx.scale(grow, grow);
        ctx.translate(-arrow.at[0], -arrow.at[1]);
        this.drawMarks(ctx, { arrows: [arrow], ticks: [], squares: [], arcs: [] });
        ctx.restore();
      }
    }
  }

  // Soft, see-through fins like the uploaded fish: no outline, a gradient towards the tip, faint
  // rays and a blurred edge. The tail bends in a travelling wave (the far end lags and swings
  // more, and narrows as it turns edge-on); the dorsal and lower fins ripple.
  drawFins(ctx) {
    const { tail, dorsal, ventral } = this.fins;
    const sway = this.reduced ? 0.3 : 1;
    const w = this.wag;
    const { fin, body } = this.colour;
    ctx.save();
    const paint = (root, tip) => {
      const g = ctx.createLinearGradient(root[0], root[1], tip[0], tip[1]);
      g.addColorStop(0, fin);
      g.addColorStop(1, shade(fin, 1.04).replace('rgb(', 'rgba(').replace(')', ', 0.7)'));
      ctx.globalAlpha *= 0.92;
      ctx.fillStyle = g;
      ctx.fill();
      ctx.globalAlpha /= 0.92;
    };
    const rays = (root, ends) => {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = shade(body, 0.95);
      ctx.globalAlpha *= 0.22;
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      for (const [x, y] of ends) {
        ctx.beginPath();
        ctx.moveTo(root[0], root[1]);
        ctx.lineTo(root[0] + (x - root[0]) * 0.8, root[1] + (y - root[1]) * 0.8);
        ctx.stroke();
      }
      ctx.restore();
    };
    // the tail
    const [rx, ry] = tail.root;
    const { length: L, spread: S } = tail;
    const bend = (k) => Math.sin(w - k * 1.6) * S * 0.3 * k * sway;
    const narrow = 1 - 0.14 * Math.abs(Math.sin(w)) * sway;
    ctx.save();
    ctx.translate(rx, ry);
    ctx.scale(narrow, 1);
    const top = [-L, -S + bend(1)];
    const bottom = [-L, S + bend(1)];
    const notch = [-L * 0.66, bend(0.66)];
    ctx.beginPath();
    ctx.moveTo(6, -S * 0.3);
    ctx.bezierCurveTo(-L * 0.35, -S * 0.42 + bend(0.35), -L * 0.75, -S * 1.02 + bend(0.75), top[0], top[1]);
    ctx.quadraticCurveTo(-L * 1.04, -S * 0.7 + bend(1), notch[0], notch[1]);
    ctx.quadraticCurveTo(-L * 1.04, S * 0.7 + bend(1), bottom[0], bottom[1]);
    ctx.bezierCurveTo(-L * 0.75, S * 1.02 + bend(0.75), -L * 0.35, S * 0.42 + bend(0.35), 6, S * 0.3);
    ctx.closePath();
    paint([0, 0], [-L, bend(1)]);
    rays([0, 0], [[top[0] + L * 0.12, top[1] * 0.8], [notch[0] - L * 0.05, notch[1]], [bottom[0] + L * 0.12, bottom[1] * 0.8]]);
    ctx.restore();
    // the dorsal fin (up) and the lower fin (down): a curved leading edge sweeping back to a
    // rounded tip, then a hollow trailing edge
    const ripple = Math.sin(w * 0.8 + 1) * 3.5 * sway;
    for (const [f, up] of [[dorsal, 1], [ventral, -1]]) {
      const [ax, ay] = f.a; // back root
      const [bx, by] = f.b; // front root
      const tip = [f.tip[0] + ripple, f.tip[1]];
      const reachUp = (by - tip[1]) * up;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.bezierCurveTo(bx - (bx - tip[0]) * 0.15, by - reachUp * 0.75 * up, tip[0] + (bx - tip[0]) * 0.45, tip[1] - 2 * up, tip[0], tip[1]);
      ctx.quadraticCurveTo(tip[0] - 5, tip[1] + 4 * up, tip[0] + (ax - tip[0]) * 0.3, tip[1] + (ay - tip[1]) * 0.45);
      ctx.quadraticCurveTo(ax + (tip[0] - ax) * 0.1, ay - 4 * up, ax, ay);
      ctx.closePath();
      paint([(ax + bx) / 2, (ay + by) / 2], tip);
      rays([(ax + bx) / 2 + 4, (ay + by) / 2], [tip, [tip[0] + (ax - tip[0]) * 0.4, tip[1] + (ay - tip[1]) * 0.5]]);
    }
    ctx.restore();
  }

  // The body, its pattern, shine, outline and face, all vector, so it is sharp at any size.
  paintBody(g) {
    const { px, box, eyeR, face, colour } = this;
    g.save();
    g.lineJoin = 'round';
    g.lineCap = 'round';
    pathOf(g, px);
    g.save();
    g.shadowColor = 'rgba(0, 35, 90, 0.28)';
    g.shadowBlur = 14;
    g.shadowOffsetY = 9;
    g.fillStyle = colour.body;
    g.fill();
    g.restore();
    g.save();
    pathOf(g, px);
    g.clip();
    this.paintPattern(g);
    const shine = g.createLinearGradient(0, box.top, 0, box.bottom);
    shine.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    shine.addColorStop(0.35, 'rgba(255, 255, 255, 0.04)');
    shine.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
    shine.addColorStop(1, 'rgba(0, 0, 0, 0.16)');
    g.fillStyle = shine;
    g.fillRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
    // the outline moved down shows a light bevel inside the top edges; moved up, a shade inside
    // the bottom ones
    for (const [dy, colourOf, width] of [[4, 'rgba(255, 255, 255, 0.5)', 2.4], [-5, 'rgba(0, 20, 60, 0.14)', 7]]) {
      g.save();
      g.translate(0, dy);
      pathOf(g, px);
      g.strokeStyle = colourOf;
      g.lineWidth = width;
      g.stroke();
      g.restore();
    }
    // a soft specular shine near the top front
    const sx0 = box.left + (box.right - box.left) * 0.62;
    const sy0 = box.top + (box.bottom - box.top) * 0.16;
    const spec = g.createRadialGradient(sx0, sy0, 1, sx0, sy0, (box.bottom - box.top) * 0.42);
    spec.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
    spec.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = spec;
    g.fillRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
    g.restore();
    pathOf(g, px);
    g.strokeStyle = shade(colour.body, 0.62);
    g.lineWidth = 3.4;
    g.stroke();
    // face: a rosy cheek, a big glossy eye that blinks and looks about, and a smile that becomes
    // an "O" when the fish is surprised
    const [ex, ey] = face.eye;
    const surprised = this.surprised > 0;
    const r = eyeR * (surprised ? 1.12 : 1);
    g.fillStyle = 'rgba(255, 120, 150, 0.32)';
    g.beginPath();
    g.ellipse(ex - eyeR * 0.1, ey + eyeR * 1.35, eyeR * 0.55, eyeR * 0.3, 0, 0, TAU);
    g.fill();
    if (this.blink > 0) {
      g.strokeStyle = '#1b1325';
      g.lineWidth = 2.4;
      g.beginPath();
      g.arc(ex, ey - eyeR * 0.35, eyeR * 0.9, Math.PI * 0.2, Math.PI * 0.8);
      g.stroke();
    } else {
      const white = g.createRadialGradient(ex + r * 0.2, ey - r * 0.25, r * 0.2, ex, ey, r);
      white.addColorStop(0, '#ffffff');
      white.addColorStop(1, '#e4eaf2');
      g.fillStyle = white;
      g.beginPath();
      g.arc(ex, ey, r, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(40, 20, 40, 0.35)';
      g.lineWidth = 1.2;
      g.stroke();
      const [lx, ly] = this.look;
      const px0 = ex + r * (0.06 + lx);
      const py0 = ey + r * ly;
      const pupil = r * (surprised ? 0.44 : 0.56);
      g.fillStyle = '#1f3d8a';
      g.beginPath();
      g.arc(px0, py0, pupil, 0, TAU);
      g.fill();
      g.fillStyle = '#0d1430';
      g.beginPath();
      g.arc(px0, py0, pupil * 0.78, 0, TAU);
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(px0 + pupil * 0.36, py0 - pupil * 0.38, pupil * 0.34, 0, TAU);
      g.arc(px0 - pupil * 0.28, py0 + pupil * 0.4, pupil * 0.14, 0, TAU);
      g.fill();
    }
    const [sx, sy] = face.smile;
    g.strokeStyle = '#2b1622';
    g.lineWidth = 2;
    g.beginPath();
    if (surprised) {
      g.fillStyle = '#5a1a2e';
      g.ellipse(sx, sy - eyeR * 0.05, eyeR * 0.26, eyeR * 0.32, 0, 0, TAU);
      g.fill();
      g.stroke();
    } else {
      g.arc(sx, sy - eyeR * 0.22, eyeR * 0.4, Math.PI * 0.18, Math.PI * 0.82);
      g.stroke();
    }
    g.restore();
  }

  paintPattern(g) {
    const { box } = this;
    const h = box.bottom - box.top;
    const rand = seeded(this.spec.id);
    g.fillStyle = 'rgba(255, 255, 255, 0.16)';
    g.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    const pattern = this.spec.pattern;
    if (pattern === 'dots') {
      g.fillStyle = 'rgba(0, 0, 0, 0.07)'; // the sheet's spots are a shade darker than the body
      for (let x = box.left + h * 0.2; x < box.right; x += h * 0.42) {
        for (let y = box.top + h * 0.2; y < box.bottom; y += h * 0.42) {
          g.beginPath();
          g.arc(x + (rand() - 0.5) * h * 0.2, y + (rand() - 0.5) * h * 0.2, h * (0.07 + rand() * 0.05), 0, TAU);
          g.fill();
        }
      }
    } else if (pattern === 'waves') {
      g.lineWidth = h * 0.07;
      for (let y = box.top + h * 0.22; y < box.bottom; y += h * 0.3) {
        g.beginPath();
        for (let x = box.left; x <= box.right; x += 4) g.lineTo(x, y + Math.sin((x - box.left) / (h * 0.11)) * h * 0.045);
        g.stroke();
      }
    } else if (pattern === 'stripes') {
      g.lineWidth = h * 0.13;
      g.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      for (let x = box.left - h; x < box.right + h; x += h * 0.34) {
        g.beginPath();
        g.moveTo(x, box.bottom);
        g.lineTo(x + h * 0.6, box.top);
        g.stroke();
      }
    } else if (pattern === 'diamonds') {
      const d = h * 0.2;
      g.fillStyle = 'rgba(255, 255, 255, 0.12)';
      for (let x = box.left, i = 0; x < box.right + d; x += d * 2, i += 1) {
        for (let y = box.top + (i % 2) * d; y < box.bottom + d; y += d * 4) {
          g.beginPath();
          g.moveTo(x, y - d);
          g.lineTo(x + d, y);
          g.lineTo(x, y + d);
          g.lineTo(x - d, y);
          g.closePath();
          g.fill();
        }
      }
    } else if (pattern === 'hearts') {
      g.fillStyle = 'rgba(255, 255, 255, 0.2)';
      for (let i = 0; i < 6; i += 1) {
        const x = box.left + (0.12 + rand() * 0.6) * (box.right - box.left);
        const y = box.top + (0.2 + rand() * 0.65) * h;
        const s = h * (0.07 + rand() * 0.04);
        g.beginPath();
        g.moveTo(x, y + s);
        g.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4);
        g.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s);
        g.fill();
      }
    }
  }

  // Arrows, ticks, right-angle squares and arcs, in the body's own frame so they turn and mirror
  // with it. Each line gets a thin white halo so it reads on every body colour.
  drawMarks(ctx, marks) {
    const strokes = [];
    const { chevron: L, spread: W, tick: T, square: S } = MARK;
    // one arrowhead on each parallel side, both pointing the same way: the one pair of parallel
    // sides (a double arrowhead would mean a second pair)
    for (const { at, dir } of marks.arrows) {
      const n = [-dir[1], dir[0]];
      const tip = [at[0] + dir[0] * (L / 2), at[1] + dir[1] * (L / 2)];
      strokes.push([[tip[0] - dir[0] * L + n[0] * W, tip[1] - dir[1] * L + n[1] * W], tip, [tip[0] - dir[0] * L - n[0] * W, tip[1] - dir[1] * L - n[1] * W]]);
    }
    for (const { at, dir, count } of marks.ticks) {
      const n = [-dir[1], dir[0]];
      for (const k of count === 1 ? [0] : [-4, 4]) {
        const c = [at[0] + dir[0] * k, at[1] + dir[1] * k];
        strokes.push([[c[0] - n[0] * T, c[1] - n[1] * T], [c[0] + n[0] * T, c[1] + n[1] * T]]);
      }
    }
    for (const { at, a, b } of marks.squares) {
      const corner = [[at[0] + a[0] * S, at[1] + a[1] * S], [at[0] + (a[0] + b[0]) * S, at[1] + (a[1] + b[1]) * S], [at[0] + b[0] * S, at[1] + b[1] * S]];
      ctx.beginPath();
      ctx.moveTo(at[0], at[1]);
      corner.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.fill();
      strokes.push(corner);
    }
    const edge = shade(this.colour.body, 0.45);
    if (this.shine) {
      // while the angles are pointed out, each one fills with gold, sweeping open round its
      // corner, swells once and fades back to the plain mark
      const t = this.shine.t;
      const fade = Math.max(0, Math.min(1, (this.shine.until - t) / 0.4));
      const open = this.reduced ? 1 : Math.min(1, t / 0.35);
      const swell = this.reduced ? 0 : Math.sin(Math.max(0, Math.min(1, (t - 0.35) / 0.5)) * Math.PI);
      for (const { at, a, b, radius } of marks.arcs) {
        const from = Math.atan2(a[1], a[0]);
        let sweep = Math.atan2(b[1], b[0]) - from;
        sweep = Math.atan2(Math.sin(sweep), Math.cos(sweep)) * (1 - (1 - open) ** 3);
        const reach = radius * (1.75 + 0.12 * swell);
        ctx.beginPath();
        ctx.moveTo(at[0], at[1]);
        ctx.arc(at[0], at[1], reach, from, from + sweep, sweep < 0);
        ctx.closePath();
        ctx.fillStyle = `rgba(255, 214, 70, ${(0.92 * fade).toFixed(3)})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(at[0], at[1], reach, from, from + sweep, sweep < 0);
        ctx.lineWidth = 3.4;
        ctx.strokeStyle = `rgba(255, 255, 255, ${(0.95 * fade).toFixed(3)})`;
        ctx.stroke();
      }
    }
    for (const arc of marks.arcs) drawAngleArc(ctx, arc, edge);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [width, colour] of [[6.6, edge], [3.2, '#ffffff']]) {
      ctx.lineWidth = width;
      ctx.strokeStyle = colour;
      for (const line of strokes) {
        ctx.beginPath();
        line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // A point of the body's frame on the stage, through the same bob, tilt, mirror and scale.
  toStage([x, y]) {
    const lx = (x + this.offset[0]) * this.dir * this.scale * this.zoom;
    const ly = (y + this.offset[1]) * this.scale * this.zoom;
    const turn = this.drawTurn || 0;
    return [this.x + lx * Math.cos(turn) - ly * Math.sin(turn), this.y + (this.drawBob || 0) + lx * Math.sin(turn) + ly * Math.cos(turn)];
  }

  // Lengths and degrees, upright on the stage beside the geometry they measure.
  drawOverlay(ctx) {
    if (this.gone || this.offstage) return;
    const font = ShapeFish.labelFont;
    const labels = this.marksFor(font).labels;
    if (!labels.length) return;
    // the numbers give a little bounce while the marks are being pointed out
    const bounce = this.shine && !this.reduced ? 1 + 0.22 * Math.max(0, Math.sin(Math.min(1, this.shine.t / 0.5) * Math.PI)) : 1;
    const size = font * this.scale * this.zoom * bounce;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    const edge = shade(this.colour.body, 0.45);
    for (const label of labels) {
      const [x, y] = this.toStage(label.at);
      if (label.angle === undefined) {
        drawPrinted(ctx, label, x, y, size * 1.08, edge);
        continue;
      }
      // a length runs along its leg, turned with the fish (mirrored or tilted) but never upside down
      const [ex, ey] = this.toStage([label.at[0] + Math.cos(label.angle) * 10, label.at[1] + Math.sin(label.angle) * 10]);
      let angle = Math.atan2(ey - y, ex - x);
      if (angle > Math.PI / 2 + 1e-6) angle -= Math.PI;
      else if (angle < -Math.PI / 2 - 1e-6) angle += Math.PI;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      drawPrinted(ctx, label, 0, 0, size * 1.08, edge);
      ctx.restore();
    }
    ctx.restore();
  }

}

ShapeFish.LABEL = LABEL;
ShapeFish.labelFont = LABEL.min;
ShapeFish.zoom = 1;
ShapeFish.setStageScale = (scale) => {
  ShapeFish.labelFont = Math.round(Math.max(LABEL.min, Math.min(LABEL.max, 12.5 / scale)));
  ShapeFish.zoom = scale < 0.55 ? 1.15 : 1;
};

// Background life in the gameplay water: soft, translucent fish shadows (never shapes, so
// nothing in the background looks like an answer). They swim straight across at their own
// depth and pace, wag their tails, wrap around off-screen and are never tappable.
const SHADOW = { w: 128, h: 64, frames: 8 };
let shadowSheet = null;

function shadowPath(ctx, wag) {
  const c = Math.cos(wag);
  const s = Math.sin(wag);
  const tail = (x, y) => [-34 + (x + 34) * c - y * s, (x + 34) * s + y * c];
  ctx.beginPath();
  ctx.moveTo(46, 0);
  ctx.bezierCurveTo(40, -17, 8, -23, -18, -14);
  ctx.bezierCurveTo(-28, -10, -34, -5, -36, 0);
  ctx.bezierCurveTo(-34, 5, -28, 10, -18, 14);
  ctx.bezierCurveTo(8, 23, 40, 17, 46, 0);
  ctx.closePath();
  const pts = [[-34, 0], [-58, -19], [-51, 0], [-58, 19]].map(([x, y]) => tail(x, y));
  ctx.moveTo(...pts[0]);
  for (const p of pts.slice(1)) ctx.lineTo(...p);
  ctx.closePath();
  ctx.moveTo(-4, -19);
  ctx.quadraticCurveTo(6, -33, 18, -18);
  ctx.closePath();
}

// Eight tail positions, drawn once. Each silhouette is drawn far off the canvas and only its
// blurred shadow lands in the cell, which gives soft edges in every browser.
function shadowSprites() {
  if (shadowSheet) return shadowSheet;
  const c = document.createElement('canvas');
  c.width = SHADOW.w * SHADOW.frames;
  c.height = SHADOW.h;
  const ctx = c.getContext('2d');
  for (let i = 0; i < SHADOW.frames; i += 1) {
    ctx.save();
    ctx.translate(i * SHADOW.w + SHADOW.w / 2 + 4 - 4000, SHADOW.h / 2);
    ctx.shadowColor = 'rgb(6, 40, 96)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 4000;
    ctx.fillStyle = '#000';
    shadowPath(ctx, Math.sin((i / SHADOW.frames) * TAU) * 0.3);
    ctx.fill();
    ctx.restore();
  }
  shadowSheet = c;
  return c;
}

class ShadowFish {
  constructor(area, dir, fromEdge = false) {
    this.dir = dir;
    this.depth = Math.random();
    this.size = 0.5 + (1 - this.depth) * 0.6;
    this.speed = (22 + Math.random() * 30) * (1.2 - this.depth * 0.5);
    this.wag = Math.random() * SHADOW.frames;
    this.phase = Math.random() * TAU;
    this.fade = 1;
    this.leaving = false;
    this.gone = false;
    this.place(area, !fromEdge);
  }

  get w() {
    return SHADOW.w * this.size;
  }

  place(area, anywhere) {
    this.baseY = area.top + 30 + Math.random() * (area.bottom - area.top - 60);
    this.x = anywhere ? area.left + Math.random() * (area.right - area.left) : (this.dir > 0 ? -this.w : STAGE_W + this.w);
  }

  leave() {
    this.leaving = true;
    this.speed = Math.max(this.speed, 80);
  }

  update(dt, area) {
    this.x += this.dir * this.speed * dt;
    this.phase += dt * 0.9;
    this.wag += dt * (5 + this.speed / 12);
    this.y = this.baseY + Math.sin(this.phase) * 6;
    if ((this.dir > 0 && this.x > STAGE_W + this.w) || (this.dir < 0 && this.x < -this.w)) {
      if (this.leaving) {
        this.gone = true;
        return;
      }
      this.place(area, false);
    }
  }

  draw(ctx) {
    const sheet = shadowSprites();
    const frame = Math.floor(this.wag) % SHADOW.frames;
    ctx.save();
    ctx.globalAlpha = (0.2 + (1 - this.depth) * 0.22) * this.fade;
    ctx.translate(this.x, this.y + Math.sin(this.phase * 2.3) * 1.5);
    ctx.scale(this.dir * this.size, this.size);
    ctx.drawImage(sheet, frame * SHADOW.w, 0, SHADOW.w, SHADOW.h, -SHADOW.w / 2, -SHADOW.h / 2, SHADOW.w, SHADOW.h);
    if (this.eyes > 0) {
      // the giant's two pale eyes glinting in the dark, blinking now and then, looking ahead
      const blink = (this.phase * 0.9) % 3 < 0.14 ? 0.12 : 1;
      ctx.globalAlpha = Math.min(1, this.fade) * this.eyes;
      for (const ex of [24, 35]) {
        ctx.save();
        ctx.translate(ex, -6);
        ctx.scale(1, blink);
        ctx.beginPath();
        ctx.ellipse(0, 0, 4.4, 3.6, 0, 0, TAU);
        ctx.fillStyle = '#fffbe6';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(1.5, 0.5, 2, 0, TAU);
        ctx.fillStyle = '#10213f';
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }
}

// Keeps the shadows already swimming, sends any extra away and brings newcomers in from the
// edges, so the set changes between levels without anything popping in or out.
function refreshShadows(current, count, area) {
  const live = current.filter((s) => !s.leaving && !s.gone);
  const staying = live.slice(0, count);
  for (const s of live.slice(count)) s.leave();
  const fresh = Array.from({ length: count - staying.length }, (_, i) =>
    new ShadowFish(area, (staying.length + i) % 2 ? 1 : -1, current.length > 0));
  // far shadows first, so nearer ones swim over them
  return [...current.filter((s) => s.leaving && !s.gone), ...staying, ...fresh].sort((a, b) => b.depth - a.depth);
}

Object.assign(PopoGame, { FISH_SCALE, Fish, ShapeFish, ShadowFish, PALETTE, drawLabel, refreshShadows });
})(window.PopoGame = window.PopoGame || {});
