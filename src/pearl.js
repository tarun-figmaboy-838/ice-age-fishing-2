(function (PopoGame) {
'use strict';

// The recall's seashell, drawn front on: a shallow ribbed bowl on the sand and a ribbed fan for a
// lid, hinged at the back of the bowl. Closed, the fan lies folded down over the bowl with its
// outside towards us; opening, it swings up about the hinge until it stands behind the pearl,
// showing its pearly inside. All sizes are at scale 1, from the point where the shell meets the sand.
const SHELL = { rim: [0, -30], rx: 74, ry: 15, fan: 82, ribs: 11, spread: 0.36, pearl: [0, -39], pearlR: 23 };
const EDGE = '#a4513f';
const TAU = Math.PI * 2;

// the fan, hinged at (0, 0) and pointing up: a scalloped edge and two small ears at the hinge
function fanPath(ctx, R) {
  const a0 = Math.PI + SHELL.spread;
  const step = (Math.PI - 2 * SHELL.spread) / SHELL.ribs;
  ctx.beginPath();
  ctx.moveTo(-15, 4);
  ctx.lineTo(-19, -5);
  ctx.lineTo(Math.cos(a0) * R * 0.98, Math.sin(a0) * R * 0.98);
  for (let i = 0; i < SHELL.ribs; i += 1) {
    const a = a0 + step * (i + 0.5);
    const b = a0 + step * (i + 1);
    ctx.quadraticCurveTo(Math.cos(a) * R * 1.07, Math.sin(a) * R * 1.07, Math.cos(b) * R * 0.98, Math.sin(b) * R * 0.98);
  }
  ctx.lineTo(19, -5);
  ctx.lineTo(15, 4);
  ctx.closePath();
}

// each rib: a soft groove on one side and a light ridge on the other
function fanRibs(ctx, R, outside) {
  const a0 = Math.PI + SHELL.spread;
  const step = (Math.PI - 2 * SHELL.spread) / SHELL.ribs;
  for (let i = 0; i < SHELL.ribs; i += 1) {
    const a = a0 + step * (i + 0.5);
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(Math.cos(a - step * 0.5) * R, Math.sin(a - step * 0.5) * R);
    ctx.lineTo(Math.cos(a - step * 0.08) * R * 1.02, Math.sin(a - step * 0.08) * R * 1.02);
    ctx.closePath();
    ctx.fillStyle = outside ? 'rgba(200, 96, 74, 0.22)' : 'rgba(230, 160, 170, 0.14)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(Math.cos(a + step * 0.12) * R * 0.97, Math.sin(a + step * 0.12) * R * 0.97);
    ctx.lineWidth = outside ? 2.2 : 1.6;
    ctx.strokeStyle = outside ? 'rgba(255, 246, 236, 0.75)' : 'rgba(255, 255, 255, 0.6)';
    ctx.stroke();
  }
}

// sy: the fan's height as seen from the front, -0.4 folded down over the bowl to 0.93 standing up
function drawLid(ctx, sy) {
  const R = SHELL.fan;
  const outside = sy < 0;
  ctx.save();
  ctx.translate(SHELL.rim[0], SHELL.rim[1] - SHELL.ry);
  ctx.scale(1, Math.abs(sy) < 0.02 ? 0.02 * Math.sign(sy || 1) : sy);
  fanPath(ctx, R);
  const g = ctx.createRadialGradient(0, 0, 6, 0, 0, R * 1.05);
  if (outside) {
    g.addColorStop(0, '#fff3e3');
    g.addColorStop(0.55, '#ffc7a6');
    g.addColorStop(1, '#f4977f');
  } else {
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#fff1ec');
    g.addColorStop(1, '#f6c9cf');
  }
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  fanRibs(ctx, R, outside);
  if (outside) {
    for (const k of [0.45, 0.68, 0.86]) { // faint growth rings
      ctx.beginPath();
      ctx.arc(0, 0, R * k, Math.PI + SHELL.spread, TAU - SHELL.spread);
      ctx.lineWidth = 1.4 / Math.max(0.2, Math.abs(sy));
      ctx.strokeStyle = 'rgba(190, 90, 70, 0.22)';
      ctx.stroke();
    }
  } else {
    const sheen = ctx.createLinearGradient(-R, -R, R, 0); // a soft rainbow sheen on the pearly inside
    sheen.addColorStop(0, 'rgba(180, 220, 255, 0)');
    sheen.addColorStop(0.45, 'rgba(190, 225, 255, 0.28)');
    sheen.addColorStop(0.6, 'rgba(255, 220, 240, 0.28)');
    sheen.addColorStop(1, 'rgba(255, 240, 200, 0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 1.4);
  }
  ctx.restore();
  fanPath(ctx, R);
  ctx.restore();
  ctx.lineWidth = 2.6; // stroked outside the squash, so the outline stays even
  ctx.strokeStyle = EDGE;
  ctx.stroke();
}

// the lower valve's outside: from the scalloped front lip, round under to the sand
function bowlPath(ctx) {
  const [cx, cy] = SHELL.rim;
  const { rx, ry } = SHELL;
  const n = SHELL.ribs + 1;
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy);
  for (let i = 0; i < n; i += 1) {
    const t1 = Math.PI - ((i + 0.5) / n) * Math.PI;
    const t2 = Math.PI - ((i + 1) / n) * Math.PI;
    ctx.quadraticCurveTo(cx + Math.cos(t1) * rx * 0.97, cy + Math.sin(t1) * ry * 0.55, cx + Math.cos(t2) * rx, cy + Math.sin(t2) * ry);
  }
  ctx.bezierCurveTo(cx + rx + 2, cy + 18, cx + 40, 4, cx, 4);
  ctx.bezierCurveTo(cx - 40, 4, cx - rx - 2, cy + 18, cx - rx, cy);
  ctx.closePath();
}

function drawBowl(ctx, inside) {
  const [cx, cy] = SHELL.rim;
  const { rx, ry } = SHELL;
  if (inside) { // the inside of the lower valve, deeper at the back
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    const g = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
    g.addColorStop(0, '#e9a3a3');
    g.addColorStop(0.6, '#ffd6d0');
    g.addColorStop(1, '#fff1ea');
    ctx.fillStyle = g;
    ctx.fill();
  }
  bowlPath(ctx);
  const g = ctx.createLinearGradient(0, cy, 0, 4);
  g.addColorStop(0, '#ffd5bb');
  g.addColorStop(1, '#ee9480');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const n = SHELL.ribs + 1;
  for (let i = 1; i < n; i += 1) {
    const x = cx - rx + (i / n) * rx * 2;
    ctx.beginPath();
    ctx.moveTo(x, cy + 8);
    ctx.quadraticCurveTo(x * 0.7, cy + 24, x * 0.35, 8);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 240, 228, 0.6)';
    ctx.stroke();
  }
  ctx.restore();
  bowlPath(ctx);
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = EDGE;
  ctx.stroke();
}

function drawPearl(ctx, size) {
  const [px, py] = SHELL.pearl;
  const r = SHELL.pearlR * size;
  const g = ctx.createRadialGradient(px - r * 0.35, py - r * 0.4, r * 0.1, px, py, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#fff7f0');
  g.addColorStop(0.85, '#f1dbe4');
  g.addColorStop(1, '#d9c0d3');
  ctx.beginPath();
  ctx.arc(px, py, r, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(150, 110, 135, 0.8)';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(px - r * 0.36, py - r * 0.4, r * 0.26, r * 0.15, -0.6, 0, TAU);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fill();
}

// s: { open 0..1, rock (radians about the sand point), squash 0..1, leak 0..1, pearl (size), alpha }
function drawShell(ctx, x, y, size, s) {
  const sy = -0.4 + 1.33 * s.open;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.globalAlpha *= s.alpha;
  ctx.save(); // its shadow on the sand
  ctx.scale(1, 0.16);
  const shadow = ctx.createRadialGradient(0, 0, 6, 0, 0, 92);
  shadow.addColorStop(0, 'rgba(18, 42, 80, 0.32)');
  shadow.addColorStop(1, 'rgba(18, 42, 80, 0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(0, 0, 92, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.rotate(s.rock);
  ctx.scale(1 + 0.05 * s.squash, 1 - 0.08 * s.squash);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (sy > 0) {
    drawLid(ctx, sy);
    drawBowl(ctx, true);
    drawPearl(ctx, s.pearl);
    drawBowl(ctx, false);
  } else {
    drawBowl(ctx, true);
    drawBowl(ctx, false);
    drawLid(ctx, sy);
    if (s.leak > 0) { // light slipping out between the lips
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= s.leak;
      ctx.beginPath();
      ctx.ellipse(SHELL.rim[0], SHELL.rim[1] + 1, SHELL.rx - 8, SHELL.ry, 0, 0.15, Math.PI - 0.15);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255, 228, 150, 0.9)';
      ctx.stroke();
    }
  }
  ctx.restore();
}

// The pearl's light: a warm halo, a few slow rays, and its glow on the sand (k 0..1).
function drawPearlLight(ctx, x, y, size, k, t, still) {
  if (k <= 0) return;
  const [px, py] = [x + SHELL.pearl[0] * size, y + SHELL.pearl[1] * size];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.save();
  ctx.translate(x, y + 2);
  ctx.scale(1, 0.18);
  const sand = ctx.createRadialGradient(0, 0, 10, 0, 0, 190);
  sand.addColorStop(0, `rgba(255, 220, 170, ${0.3 * k})`);
  sand.addColorStop(1, 'rgba(255, 228, 180, 0)');
  ctx.fillStyle = sand;
  ctx.fillRect(-190, -190, 380, 380);
  ctx.restore();
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (i - 2) * 0.42 + (still ? 0 : Math.sin(t * 0.6 + i * 1.7) * 0.06);
    const len = (150 + 40 * Math.sin(t * 0.9 + i)) * k;
    const ray = ctx.createLinearGradient(px, py, px + Math.cos(a) * len, py + Math.sin(a) * len);
    ray.addColorStop(0, `rgba(255, 232, 180, ${0.16 * k})`);
    ray.addColorStop(1, 'rgba(255, 240, 200, 0)');
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(a - 0.07) * len, py + Math.sin(a - 0.07) * len);
    ctx.lineTo(px + Math.cos(a + 0.07) * len, py + Math.sin(a + 0.07) * len);
    ctx.closePath();
    ctx.fillStyle = ray;
    ctx.fill();
  }
  const halo = ctx.createRadialGradient(px, py, size * 20, px, py, 46 + 74 * k);
  halo.addColorStop(0, `rgba(255, 236, 190, ${0.3 * k})`);
  halo.addColorStop(0.4, `rgba(255, 214, 150, ${0.18 * k})`);
  halo.addColorStop(1, 'rgba(255, 222, 160, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(px - 130, py - 130, 260, 260);
  ctx.restore();
}

function pearlPoint(x, y, size) {
  return [x + SHELL.pearl[0] * size, y + SHELL.pearl[1] * size];
}

Object.assign(PopoGame, { drawShell, drawPearlLight, pearlPoint });
})(window.PopoGame = window.PopoGame || {});
