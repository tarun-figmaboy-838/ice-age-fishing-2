(function (PopoGame) {
'use strict';

// The trapezium levels' fish bodies are exact quadrilaterals, built in units (y up) from a few
// measurements. Every arrow, tick, length and angle the game shows is measured from the
// polygon itself; tests/geometry.py checks every body against its classification.

const DEG = Math.PI / 180;
const ANGLE_TOLERANCE = 0.25; // degrees
// Marking sizes in fish pixels: the parallel arrowhead (length, half-width, and the room kept
// clear around it), tick half-length, right-angle square side and angle-arc radius. Big enough to
// spot while a fish swims.
const MARK = { chevron: 12, spread: 9.5, gap: 6, tick: 10, square: 17, arc: 23 };
const LENGTH_TOLERANCE = 0.01; // units

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const norm = (a) => Math.hypot(a[0], a[1]);
const unit = (a) => mul(a, 1 / norm(a));
const heading = (deg) => [Math.cos(deg * DEG), Math.sin(deg * DEG)];

// The trapezium family is built as D, C, B, A: DC is the bottom base and DA the left leg.

// left/right: how far each top corner sits in from the corner below it (negative leans out).
// With `legs`, both legs lean in and the insets come from the leg lengths at that height.
function trapezium({ bottom, height, left, right, legs }) {
  if (legs) [left, right] = legs.map((leg) => Math.sqrt(leg * leg - height * height));
  return [[0, 0], [bottom, 0], [bottom - right, height], [left, height]];
}

// ∠D and ∠A at the two ends of the left side DA, plus ∠C: B is where the top side from A meets
// the right side from C. When ∠D + ∠A = 180°, AB comes out parallel to DC.
function angled({ bottom, side, angles: [atD, atA, atC] }) {
  const a = mul(heading(atD), side);
  const c = [bottom, 0];
  const top = heading(atD + atA - 180);
  const rise = heading(180 - atC);
  const t = cross(sub(c, a), rise) / cross(top, rise);
  return [[0, 0], c, add(a, mul(top, t)), a];
}

// A kite along a horizontal axis: tail tip, bottom, nose, top. back !== front keeps it from
// being a rhombus.
function kite({ back, front, half }) {
  return [[-back, 0], [0, -half], [front, 0], [0, half]];
}

// An arrowhead (a dart) pointing right: the notch, the bottom barb, the nose, the top barb.
function arrowhead({ length, notch, half }) {
  return [[notch, 0], [0, -half], [length, 0], [0, half]];
}

function orient(points, { turn = 0, flipX = false, flipY = false } = {}) {
  const [c, s] = heading(turn);
  return points.map(([x, y]) => {
    const fx = flipX ? -x : x;
    const fy = flipY ? -y : y;
    return [fx * c - fy * s, fx * s + fy * c];
  });
}

function segmentsCross(a, b, c, d) {
  const side = (p, q, r) => Math.sign(cross(sub(q, p), sub(r, p)));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

// Side lengths, interior angles (degrees; a reflex corner is over 180) and the opposite sides that
// are parallel, for any simple quadrilateral in any orientation.
function measure(points) {
  const n = points.length;
  const at = (i) => points[(i + n) % n];
  const area = points.reduce((sum, p, i) => sum + cross(p, at(i + 1)), 0) / 2;
  const turn = Math.sign(area);
  const sides = points.map((p, i) => ({ from: i, to: (i + 1) % n, length: norm(sub(at(i + 1), p)), dir: unit(sub(at(i + 1), p)) }));
  const angles = points.map((p, i) => {
    const into = sub(p, at(i - 1));
    const out = sub(at(i + 1), p);
    return 180 - Math.atan2(turn * cross(into, out), dot(into, out)) / DEG;
  });
  const parallel = [[0, 2], [1, 3]].filter(([i, j]) =>
    Math.abs(cross(sides[i].dir, sides[j].dir)) < Math.sin(ANGLE_TOLERANCE * DEG));
  const simple = n === 4 && !segmentsCross(at(0), at(1), at(2), at(3)) && !segmentsCross(at(1), at(2), at(3), at(0));
  return { area: Math.abs(area), turn, sides, angles, parallel, simple, convex: angles.every((a) => a < 180) };
}

// The classroom (exclusive) convention: a trapezium has exactly one pair of parallel sides.
// Its legs are the other two sides; a right trapezium has its two right angles on one leg.
function classify(points) {
  const m = measure(points);
  const right = m.angles.flatMap((a, i) => (Math.abs(a - 90) < ANGLE_TOLERANCE ? [i] : []));
  const result = { ...m, right, kind: 'quadrilateral' };
  if (!m.simple) return { ...result, kind: 'invalid' };
  if (m.parallel.length === 2) return { ...result, kind: 'parallelogram' };
  if (m.parallel.length === 0) return result;
  const bases = m.parallel[0];
  const legs = bases[0] === 0 ? [1, 3] : [0, 2];
  const legLengths = legs.map((i) => m.sides[i].length);
  const rightLeg = legs.find((i) => right.includes(m.sides[i].from) && right.includes(m.sides[i].to));
  const equalLegs = Math.abs(legLengths[0] - legLengths[1]) < LENGTH_TOLERANCE;
  let type = equalLegs ? 'isosceles' : 'scalene';
  if (right.length) type = right.length === 2 && rightLeg !== undefined ? 'right' : 'invalid';
  return { ...result, kind: 'trapezium', type, bases, legs, legLengths, equalLegs, rightLeg };
}

const round = (value, places = 1) => Number(value.toFixed(places));

// --- markings, laid out in fish pixels (y down) ------------------------------------------------

// The body in pixels: y flipped and centred on its bounding box, `scale` pixels to the unit.
function toPixels(points, scale) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return points.map(([x, y]) => [(x - cx) * scale, -(y - cy) * scale]);
}

// Inward unit normal of side i (works for either winding).
function inward(px, i) {
  const m = measure(px);
  const d = m.sides[i].dir;
  return mul([-d[1], d[0]], m.turn);
}

// The half-width of a box measured across a line with unit normal n.
const reach = (n, hw, hh) => hw * Math.abs(n[0]) + hh * Math.abs(n[1]);


// Unit vectors from corner i along its two sides (towards the previous and the next corner).
function cornerSides(px, i) {
  const n = px.length;
  const a = unit(sub(px[(i + n - 1) % n], px[i]));
  const b = unit(sub(px[(i + 1) % n], px[i]));
  return { a, b };
}

// A label box inside corner i: on the corner's bisector just past its arc, the way a textbook
// labels an angle; where that would crowd another label or leave the body, slid towards the
// corner's other side (`along` is that side's far end).
function inCorner(px, i, along, hw, hh, gap, arc, placed = []) {
  const v = px[i];
  const { a, b } = cornerSides(px, i);
  const dir = unit(add(a, b));
  const sides = [a, b].map((d) => mul([-d[1], d[0]], Math.sign(cross(d, dir)) || 1));
  const clearOf = (p) => sides.every((n) => dot(sub(p, v), n) >= reach(n, hw, hh) + gap)
    && Math.hypot(Math.max(Math.abs(p[0] - v[0]) - hw, 0), Math.max(Math.abs(p[1] - v[1]) - hh, 0)) >= arc + 3
    && [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([sx, sy]) => inside(px, [p[0] + sx * hw, p[1] + sy * hh]))
    && placed.every((l) => Math.abs(l.at[0] - p[0]) > l.hw + hw + 4 || Math.abs(l.at[1] - p[1]) > l.hh + hh + 4);
  for (let d = arc; d < arc + 70; d += 1) {
    const p = add(v, mul(dir, d));
    if (clearOf(p)) return p;
  }
  return hugCorner(px, i, along, hw, hh, gap, arc);
}

function hugCorner(px, i, along, hw, hh, gap, arc) {
  const n = px.length;
  const v = px[i];
  const marked = (i + 1) % n === along ? (i + n - 1) % n : (i + 1) % n;
  const u = unit(sub(px[along], v));
  const hug = inward(px, (i + 1) % n === along ? i : along);
  const edge = inward(px, (i + 1) % n === marked ? i : marked);
  const off = reach(hug, hw, hh) + gap;
  for (let t = 0; ; t += 1) {
    const p = add(v, add(mul(u, t), mul(hug, off)));
    const gapToArc = Math.hypot(Math.max(Math.abs(p[0] - v[0]) - hw, 0), Math.max(Math.abs(p[1] - v[1]) - hh, 0));
    if (dot(sub(p, v), edge) >= reach(edge, hw, hh) + gap && gapToArc >= arc + 3) return p;
  }
}

// Everything a level draws on one body. `marks` lists the kinds of marking:
//   parallel: matching arrows on the one pair of parallel sides (never on a body without one)
//   legs:     the two legs' lengths
//   ticks:    the same tick on legs of equal length, different ticks on legs that differ
//   right:    a square in each right-angled corner
//   angles:   arcs and degrees in the corners listed in `corners`
// `font` is the label size in pixels; label boxes are sized for it.
function layoutMarks(points, scale, marks, { corners = [], font = 16 } = {}) {
  const shape = classify(points);
  const px = toPixels(points, scale);
  const out = { px, arrows: [], ticks: [], squares: [], arcs: [], labels: [] };
  const mid = (i) => mul(add(px[i], px[(i + 1) % 4]), 0.5);
  // label sizes: a bold number (and a small "units" beside it for a length)
  const chip = (width) => ({ hw: (width + 0.9) * font / 2, hh: font * 0.74 });
  if (marks.includes('parallel') && shape.kind === 'trapezium') {
    // both arrows point the same way along the parallel sides
    const [i, j] = shape.bases;
    const d = unit(sub(px[(i + 1) % 4], px[i]));
    for (const s of [i, j]) out.arrows.push({ at: mid(s), dir: d, side: s });
  }
  if (marks.includes('legs') && shape.kind === 'trapezium') {
    shape.legs.forEach((s, k) => {
      const number = `${round(shape.legLengths[k])}`;
      const text = `${number} units`;
      const { hw: len, hh: thick } = chip(number.length * 0.6 + 0.3 + 1.75);
      // written along its leg, at the middle and just inside it, the way a ruler laid on that side
      // is read; turned so it never reads upside down
      const [p, q] = [px[s], px[(s + 1) % 4]];
      let u = unit(sub(q, p));
      if (u[0] < -1e-9 || (Math.abs(u[0]) <= 1e-9 && u[1] > 0)) u = mul(u, -1);
      // at the middle if it fits inside the body there, else nudged along the leg to where it does
      const n = inward(px, s);
      const across = [-u[1], u[0]];
      const clearOf = (c, at, r) => {
        const d = sub(at, c);
        return Math.hypot(Math.max(Math.abs(dot(d, u)) - len, 0), Math.max(Math.abs(dot(d, across)) - thick, 0)) >= r;
      };
      const fits = (c) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([a, b]) => inside(px, add(c, add(mul(u, a * len), mul(across, b * thick)))))
        && out.arrows.every((arrow) => clearOf(c, arrow.at, MARK.chevron + MARK.gap / 2 + 3));
      let at = null;
      for (const t of [0.5, 0.56, 0.44, 0.62, 0.38, 0.68, 0.32]) {
        for (const gap of [7, 4]) {
          const c = add(add(p, mul(sub(q, p), t)), mul(n, thick + gap));
          if (!at && fits(c)) at = c;
        }
      }
      at = at || add(mul(add(p, q), 0.5), mul(n, thick + 7));
      // hw/hh: the upright box round the turned label, for keeping other things clear of it
      const hw = Math.abs(u[0]) * len + Math.abs(u[1]) * thick;
      const hh = Math.abs(u[1]) * len + Math.abs(u[0]) * thick;
      out.labels.push({ text, number, unit: 'units', value: round(shape.legLengths[k]), at, hw, hh, len, thick, angle: Math.atan2(u[1], u[0]), side: s });
    });
  }
  if (marks.includes('ticks') && shape.kind === 'trapezium') {
    const order = shape.equalLegs ? [1, 1] : shape.legLengths[0] < shape.legLengths[1] ? [1, 2] : [2, 1];
    shape.legs.forEach((s, k) => out.ticks.push({ at: mid(s), dir: unit(sub(px[(s + 1) % 4], px[s])), count: order[k], side: s }));
  }
  if (marks.includes('right')) {
    for (const i of shape.right) {
      const { a, b } = cornerSides(px, i);
      out.squares.push({ at: px[i], a, b, corner: i });
    }
  }
  if (marks.includes('angles')) {
    for (const i of corners) {
      const { a, b } = cornerSides(px, i);
      const degrees = Math.round(shape.angles[i]);
      const text = `${degrees}°`;
      const { hw, hh } = chip(text.length * 0.58);
      const other = corners.find((c) => c !== i);
      const along = (i + 1) % 4 === other ? (i + 3) % 4 : (i + 1) % 4;
      out.arcs.push({ at: px[i], a, b, radius: MARK.arc, corner: i, degrees });
      out.labels.push({ text, number: text, value: degrees, at: inCorner(px, i, along, hw, hh, 4, MARK.arc + 2, out.labels), hw, hh, corner: i });
    }
  }
  return out;
}

// --- point and polygon helpers for the fish renderer ------------------------------------------

function inside(px, p) {
  let hit = false;
  for (let i = 0, j = px.length - 1; i < px.length; j = i, i += 1) {
    const [xi, yi] = px[i];
    const [xj, yj] = px[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function distanceToSegment(p, a, b) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
  return norm(sub(p, add(a, mul(ab, t))));
}

function edgeClearance(px, p) {
  return Math.min(...px.map((a, i) => distanceToSegment(p, a, px[(i + 1) % px.length])));
}

// Where the line y = value (axis 'y') or x = value (axis 'x') crosses the outline: the other
// coordinate of each crossing.
function crossings(px, axis, value) {
  const [k, o] = axis === 'y' ? [1, 0] : [0, 1];
  const hits = [];
  px.forEach((a, i) => {
    const b = px[(i + 1) % px.length];
    if ((a[k] - value) * (b[k] - value) > 0 || a[k] === b[k]) return;
    hits.push(a[o] + ((value - a[k]) / (b[k] - a[k])) * (b[o] - a[o]));
  });
  return hits;
}

Object.assign(PopoGame, {
  geometry: {
    DEG, ANGLE_TOLERANCE, LENGTH_TOLERANCE, MARK, trapezium, angled, kite, arrowhead, orient, measure, classify,
    layoutMarks, toPixels, inside, distanceToSegment, edgeClearance, crossings, round,
  },
});
})(window.PopoGame = window.PopoGame || {});
