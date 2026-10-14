"""Mathematical and layout checks for every trapezium-level fish: python3 tests/geometry.py.

Runs the game's own geometry and fish code in headless Chromium (Python Playwright) and checks,
for every fish in src/levels.js:
  - four corners, a simple outline, and the classification the fish claims (exclusive trapezium,
    scalene, isosceles, right, a quadrilateral with no parallel sides, kite, arrowhead), with no
    parallelogram, rectangle, square or rhombus anywhere;
  - each level's rule for its catches and distractors, and level 5's exact angle pairs, both at
    the ends of one side;
  - the markings: arrows only on the parallel sides, ticks that match only on equal legs,
    squares only in right angles, arcs only in the marked corners, and every number equal to
    the drawn geometry; the same after turning, mirroring and resizing;
  - at the smallest and largest label size: every label inside the body, clear of the other
    labels, of the face and of every other marking.
Prints one line per fish and exits non-zero on any failure.
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = (ROOT / 'index.html').as_uri() + '?debug'

CHECK = r'''() => {
  const { FISH, LEVELS, RECALL, ShapeFish, PALETTE, geometry: G } = PopoGame;
  const M = G.MARK;
  const fails = [];
  const rows = [];
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const fail = (id, what) => fails.push(`${id}: ${what}`);

  function shapeChecks(f, c) {
    if (f.body.length !== 4) fail(f.id, 'not four corners');
    if (!c.simple) fail(f.id, 'outline crosses itself');
    if (c.parallel.length === 2) fail(f.id, 'parallelogram family (excluded)');
    const kind = f.kind;
    if (['trapezium', 'scalene', 'isosceles', 'right'].includes(kind)) {
      if (c.kind !== 'trapezium') fail(f.id, `should be a trapezium, is ${c.kind}`);
      if (!c.convex) fail(f.id, 'trapezium not convex');
      if (kind !== 'trapezium' && c.type !== kind) fail(f.id, `should be ${kind}, is ${c.type}`);
      if (kind === 'scalene' && (c.right.length || c.equalLegs)) fail(f.id, 'scalene must have unequal legs and no right angle');
      if (kind === 'right' && !(c.right.length === 2 && c.rightLeg !== undefined)) fail(f.id, 'right angles not both on one leg');
    } else {
      if (c.parallel.length !== 0) fail(f.id, `${kind} must have no parallel sides`);
      const L = c.sides.map((s) => s.length);
      if (kind === 'kite') {
        const pairs = (near(L[0], L[3], 1e-9) && near(L[1], L[2], 1e-9)) || (near(L[0], L[1], 1e-9) && near(L[2], L[3], 1e-9));
        if (!pairs || near(L[0], L[1], 1e-6) && near(L[1], L[2], 1e-6)) fail(f.id, 'not a non-rhombus kite');
      }
      if (kind === 'arrowhead' && c.angles.filter((a) => a > 180).length !== 1) fail(f.id, 'arrowhead needs one reflex corner');
      if (kind === 'quadrilateral' && !c.convex) fail(f.id, 'irregular quadrilateral should be convex');
    }
  }

  function levelChecks(f, c) {
    const L = f.level;
    if (L === 1 && f.correct && c.kind !== 'trapezium') fail(f.id, 'level 1 catch not a trapezium');
    if (L === 1 && !f.correct && c.parallel.length) fail(f.id, 'level 1 distractor has parallel sides');
    if (L === 2 && f.correct && c.type !== 'scalene') fail(f.id, 'level 2 catch not a non-right scalene trapezium');
    if (L === 2 && !f.correct && c.type !== 'isosceles') fail(f.id, 'level 2 distractor not isosceles (no right-angled fish in level 2)');
    if (L !== 4 && c.right.length) fail(f.id, 'right angles only in level 4');
    if (f.corners) {
      // the two marked corners: the ends of one side, measuring exactly the whole degrees shown
      const [i, j] = f.corners;
      if ((i + 1) % 4 !== j && (j + 1) % 4 !== i) fail(f.id, 'marked corners are not the two ends of one side');
      f.angles.forEach((a, k) => {
        if (!near(c.angles[f.corners[k]], a, 1e-6)) fail(f.id, `corner ${f.corners[k]} is ${c.angles[f.corners[k]]}, should be ${a}`);
        if (a !== Math.round(a)) fail(f.id, `angle ${a} is not whole degrees`);
      });
    } else if (LEVELS[L - 1].marks.includes('angles')) fail(f.id, 'a level that shows angles needs marked corners');
    if (L === 2 || L === 3) {
      // the base angles tell isosceles (equal) from scalene (different)
      if ((f.angles[0] === f.angles[1]) !== c.equalLegs) fail(f.id, 'base angles do not match the legs');
    }
    if (L === 4 && f.correct && !(f.angles[0] === 90 && f.angles[1] === 90)) fail(f.id, 'a right trapezium shows its two right angles');
    if (L === 3 && f.correct !== (c.kind === 'trapezium' && c.equalLegs)) fail(f.id, 'level 3: catch must have equal legs, distractors unequal');
    if (L === 3 && !f.correct && c.kind !== 'trapezium') fail(f.id, 'level 3 distractor not a trapezium');
    if (L === 4 && f.correct && c.type !== 'right') fail(f.id, 'level 4 catch not a right trapezium');
    if (L === 4 && !f.correct && (c.kind !== 'trapezium' || c.right.length)) fail(f.id, 'level 4 distractor must be a trapezium with no right angle');
    if (L === 5) {
      const sum = f.angles[0] + f.angles[1];
      if (f.correct !== (sum === 180)) fail(f.id, 'catch must have a 180° pair, distractors not');
      if (f.correct !== (c.kind === 'trapezium')) fail(f.id, 'catch must be a trapezium, distractor not');
    }
  }

  const L_OF = (f) => f.level;
  function markChecks(f, c, m, id = f.id) {
    const marks = LEVELS[f.level - 1].marks;
    if (marks.includes('parallel') && c.kind === 'trapezium') {
      if (m.arrows.length !== 2) fail(id, 'needs one arrow on each parallel side');
      const sides = m.arrows.map((a) => a.side).sort();
      if (sides.join() !== [...c.bases].sort().join()) fail(id, 'arrows not on the parallel sides');
      if (m.arrows.length === 2 && Math.abs(m.arrows[0].dir[0] * m.arrows[1].dir[0] + m.arrows[0].dir[1] * m.arrows[1].dir[1] - 1) > 1e-9) fail(id, 'arrows point different ways');
    } else if (m.arrows.length) fail(id, 'arrows on a body without parallel sides (or in level 5)');
    if (marks.includes('ticks')) {
      const same = m.ticks[0].count === m.ticks[1].count;
      if (same !== c.equalLegs) fail(id, 'ticks do not match the leg lengths');
      if (m.ticks.map((t) => t.side).sort().join() !== [...c.legs].sort().join()) fail(id, 'ticks not on the legs');
    }
    if (m.squares.map((q) => q.corner).sort().join() !== (marks.includes('right') ? c.right : []).slice().sort().join()) fail(id, 'right-angle squares not exactly on the right angles');
    if (L_OF(f) < 5 && (m.ticks.length || m.labels.some((l) => l.side !== undefined))) fail(id, 'levels 1 to 4 show only degrees (no lengths or ticks)');
    if (marks.includes('angles') && m.arcs.map((a) => a.corner).sort().join() !== [...f.corners].sort().join()) fail(id, 'arcs not on the marked corners');
    for (const l of m.labels) {
      if (l.side !== undefined) {
        const k = c.legs.indexOf(l.side);
        if (k < 0 || !near(l.value, c.legLengths[k], 0.005) || l.text !== `${l.value} units`) fail(id, `length label ${l.text} does not match its leg`);
      } else if (!near(l.value, c.angles[l.corner], 0.25) || l.text !== `${l.value}°`) fail(id, `angle label ${l.text} does not match corner ${l.corner}`);
    }
  }

  // label boxes must sit inside the body, apart from each other, the face and other markings
  function clarity(fish, font) {
    const m = fish.marksFor(font);
    const id = `${fish.spec.id}@${font}`;
    const boxes = m.labels.map((l) => ({ x0: l.at[0] - l.hw, x1: l.at[0] + l.hw, y0: l.at[1] - l.hh, y1: l.at[1] + l.hh, l }));
    const overlap = (a, b, pad = 2) => a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;
    // a circle (centre, radius) against a box, or against a length label turned along its leg
    const hits = (c, b, pad = 0) => {
      const l = b.l;
      if (l && l.angle !== undefined) {
        const u = [Math.cos(l.angle), Math.sin(l.angle)], d = [c.at[0] - l.at[0], c.at[1] - l.at[1]];
        return Math.hypot(Math.max(Math.abs(d[0] * u[0] + d[1] * u[1]) - l.len, 0), Math.max(Math.abs(-d[0] * u[1] + d[1] * u[0]) - l.thick, 0)) < c.r + pad;
      }
      return Math.hypot(Math.max(b.x0 - c.at[0], 0, c.at[0] - b.x1), Math.max(b.y0 - c.at[1], 0, c.at[1] - b.y1)) < c.r + pad;
    };
    const circles = [
      ...m.arrows.map((a) => ({ at: a.at, r: M.chevron + M.gap / 2 + 1.5 })),
      ...m.ticks.map((t) => ({ at: t.at, r: M.tick + 1 })),
      ...m.arcs.map((a) => ({ at: a.at, r: a.radius + 1.5 })),
    ];
    const squares = m.squares.map((q) => {
      const far = [q.at[0] + (q.a[0] + q.b[0]) * M.square, q.at[1] + (q.a[1] + q.b[1]) * M.square];
      return { x0: Math.min(q.at[0], far[0]), x1: Math.max(q.at[0], far[0]), y0: Math.min(q.at[1], far[1]), y1: Math.max(q.at[1], far[1]) };
    });
    const eye = { at: fish.face.eye, r: fish.eyeR * 1.12 };
    const smile = { at: fish.face.smile, r: fish.eyeR * 0.5 };
    // a label's own corners: a length turned along its leg, or an upright box
    const corners = (l) => {
      if (l.angle === undefined) return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [l.at[0] + sx * l.hw, l.at[1] + sy * l.hh]);
      const u = [Math.cos(l.angle), Math.sin(l.angle)], n = [-u[1], u[0]];
      return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [l.at[0] + u[0] * a * l.len + n[0] * b * l.thick, l.at[1] + u[1] * a * l.len + n[1] * b * l.thick]);
    };
    boxes.forEach((b, i) => {
      for (const p of corners(b.l)) {
        if (!G.inside(fish.px, p)) { fail(id, `label ${b.l.text} pokes out of the body`); break; }
      }
      if (b.l.side !== undefined) {
        // a length sits beside the middle of its own leg, nearer that leg than any other side
        const d = fish.px.map((p, k) => G.distanceToSegment(b.l.at, p, fish.px[(k + 1) % 4]));
        if (d.indexOf(Math.min(...d)) !== b.l.side) fail(id, `label ${b.l.text} is nearer another side than its leg`);
      }
      boxes.slice(i + 1).forEach((o) => { if (overlap(b, o)) fail(id, `labels ${b.l.text} and ${o.l.text} overlap`); });
      if (hits(eye, b, 2) || hits(smile, b, 2)) fail(id, `label ${b.l.text} touches the face`);
      if (circles.some((c) => hits(c, b)) || squares.some((q) => overlap(b, q, 0))) fail(id, `label ${b.l.text} touches a marking`);
    });
    if (!G.inside(fish.px, eye.at) || G.edgeClearance(fish.px, eye.at) < eye.r) fail(id, 'eye not inside the body');
    const eyeBox = { x0: eye.at[0] - eye.r, x1: eye.at[0] + eye.r, y0: eye.at[1] - eye.r, y1: eye.at[1] + eye.r };
    if (circles.some((c) => Math.hypot(c.at[0] - eye.at[0], c.at[1] - eye.at[1]) < c.r + eye.r) || squares.some((q) => hits(eye, q)))
      fail(id, 'eye touches a marking');
    if (squares.some((q) => overlap(eyeBox, q, -eye.r * 0.3))) fail(id, 'eye touches a right-angle mark');
  }

  for (const f of FISH) {
    const c = G.classify(f.body);
    shapeChecks(f, c);
    levelChecks(f, c);
    const level = LEVELS[f.level - 1];
    const fish = new ShapeFish(f, level, { colour: PALETTE[0] });
    for (const font of [ShapeFish.LABEL.min, ShapeFish.LABEL.max]) {
      markChecks(f, c, fish.marksFor(font), `${f.id}@${font}`);
      clarity(fish, font);
    }
    // turning, mirroring and resizing keep the classification, the markings and their numbers
    for (const [opts, scale] of [[{ turn: 37 }, 12], [{ flipX: true }, 19], [{ flipY: true, turn: -20 }, 30]]) {
      const moved = G.orient(f.body, opts);
      const cm = G.classify(moved);
      if (cm.kind !== c.kind || cm.type !== c.type || cm.parallel.length !== c.parallel.length || cm.right.length !== c.right.length)
        fail(f.id, `classification changes when turned ${JSON.stringify(opts)}`);
      markChecks(f, cm, G.layoutMarks(moved, scale, level.marks, { corners: f.corners, font: 16 }), `${f.id} ${JSON.stringify(opts)} x${scale}`);
    }
    rows.push(`${f.id.padEnd(5)} L${f.level} ${f.correct ? 'catch     ' : 'distractor'} ${c.kind}${c.type ? '/' + c.type : ''}  angles ${c.angles.map((a) => a.toFixed(1)).join(' ')}` +
      (c.legLengths ? `  legs ${c.legLengths.map((l) => l.toFixed(3)).join(' & ')}` : '') + (f.angles ? `  marked ${f.angles.join(' + ')} = ${f.angles[0] + f.angles[1]}` : ''));
  }
  const r = G.classify(RECALL.body);
  const ra = RECALL.corners.map((i) => r.angles[i]);
  if (r.kind !== 'trapezium' || !near(ra[0], 70, 1e-6) || !near(ra[1], 110, 1e-6) || !RECALL.corners.includes(3) || !RECALL.corners.includes(0))
    fail('recall', 'the recall card must show 70° and 110° on one leg of a trapezium');
  for (const [i, lvl] of LEVELS.entries()) {
    const pool = FISH.filter((f) => f.level === i + 1);
    if (pool.filter((f) => f.correct).length < (i === 4 ? 4 : lvl.targets + lvl.catches - 1)) fail(`level ${i + 1}`, 'too few distinct catches');
  }
  const l5 = FISH.filter((f) => f.level === 5).map((f) => f.id).sort().join('');
  if (l5 !== 'ABCDEF') fail('level 5', `fish are ${l5}`);
  return { fails, rows };
}'''

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_function('!!(window.PopoGame && PopoGame.ShapeFish && PopoGame.FISH)')
    result = page.evaluate(CHECK)
    browser.close()

for row in result['rows']:
    print(row)
for f in result['fails']:
    print('FAIL', f)
if errors:
    print('FAIL page errors:', errors)
ok = not result['fails'] and not errors
print(('PASS' if ok else 'FAIL') + f": {len(result['rows'])} fish checked; {len(result['fails'])} problems")
sys.exit(0 if ok else 1)
