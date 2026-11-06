const outline = "#315c25";

function pathLeaf(ctx, points, fill, stroke = outline) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  ctx.bezierCurveTo(points[2], points[3], points[4], points[5], points[6], points[7]);
  ctx.bezierCurveTo(points[8], points[9], points[10], points[11], points[0], points[1]);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  ctx.quadraticCurveTo((points[0] + points[6]) / 2, (points[1] + points[7]) / 2 - 3, points[6], points[7]);
  ctx.strokeStyle = "rgba(229,255,140,.72)";
  ctx.lineWidth = 1.15;
  ctx.stroke();
}

/** Draws a complete procedural peashooter. Origin is its feet; size is its height. */
export function drawPeashooter(ctx, x, y, size, time = 0, options = {}) {
  const ghost = Boolean(options.ghost);
  const age = Math.max(0, options.age ?? 1000);
  const disappearing = Boolean(options.disappearing);
  const phase = time * 0.0025;
  const breathe = Math.sin(phase) * 1.6;
  const leafSwing = Math.sin(phase * 1.35 + 0.8) * 3.2;
  let scale = size / 100;
  let alpha = ghost ? 0.48 : 1;
  if (age < 460 && !ghost) {
    const t = Math.max(0, age / 460);
    const ease = 1 - Math.pow(1 - t, 3);
    scale *= 0.68 + 0.32 * ease;
  }
  if (disappearing) {
    const t = Math.min(1, age / 360);
    scale *= 1 - t * 0.34;
    alpha *= 1 - t;
  }
  ctx.save();
  ctx.translate(x, y + (ghost ? 0 : -Math.abs(Math.sin(phase)) * size * 0.008));
  ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;
  if (ghost) ctx.filter = "saturate(.8)";

  // Soft ground shadow and rounded leafy foot.
  ctx.beginPath();
  ctx.ellipse(0, -2, 32, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(32,66,23,.20)";
  ctx.fill();
  const base = ctx.createLinearGradient(-18, -17, 18, -1);
  base.addColorStop(0, "#80bd37"); base.addColorStop(.55, "#4e932e"); base.addColorStop(1, "#377129");
  ctx.beginPath();
  ctx.moveTo(-26, -5);
  ctx.quadraticCurveTo(-31, -15, -20, -18);
  ctx.quadraticCurveTo(0, -25, 21, -16);
  ctx.quadraticCurveTo(31, -12, 24, -4);
  ctx.quadraticCurveTo(0, 1, -26, -5);
  ctx.closePath();
  ctx.fillStyle = base; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = outline; ctx.stroke();

  // Leaves sway independently around the stem.
  ctx.save(); ctx.translate(-2, -17); ctx.rotate((-0.15 + leafSwing * 0.006));
  pathLeaf(ctx, [-1, 0, -12, -8, -31, -28, -34, -42, -17, -34, -2, -15], "#65b936");
  ctx.restore();
  ctx.save(); ctx.translate(2, -18); ctx.rotate(0.10 - leafSwing * 0.007);
  pathLeaf(ctx, [1, 1, 12, -8, 33, -20, 38, -37, 20, -32, 3, -13], "#79ca3d");
  ctx.restore();

  // Stem, with a bright edge and a small joint.
  const stem = ctx.createLinearGradient(-7, 0, 8, 0);
  stem.addColorStop(0, "#367b2e"); stem.addColorStop(.42, "#82c842"); stem.addColorStop(1, "#4a9630");
  ctx.beginPath(); ctx.moveTo(-5, -12); ctx.quadraticCurveTo(-8 + breathe * .3, -28, -1, -43);
  ctx.lineWidth = 11; ctx.lineCap = "round"; ctx.strokeStyle = outline; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-5, -13); ctx.quadraticCurveTo(-7, -28, -1, -42);
  ctx.lineWidth = 6.5; ctx.strokeStyle = stem; ctx.stroke();

  // Rounded head.
  ctx.save(); ctx.translate(0, breathe);
  const head = ctx.createRadialGradient(-12, -70, 5, 0, -56, 35);
  head.addColorStop(0, "#a4e84d"); head.addColorStop(.48, "#71c936"); head.addColorStop(1, "#438d2d");
  ctx.beginPath(); ctx.ellipse(-3, -56, 29, 27, -0.12, 0, Math.PI * 2);
  ctx.fillStyle = head; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = outline; ctx.stroke();
  // Cheek highlight.
  ctx.beginPath(); ctx.ellipse(-16, -69, 7, 3.2, -.42, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(237,255,174,.6)"; ctx.fill();

  // Eyes with pupils directed towards the planting direction.
  const blink = Math.sin(time * 0.0011 + 0.4) > .997 ? .18 : 1;
  ctx.fillStyle = "#fffdf0"; ctx.strokeStyle = outline; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(-7, -68, 7.3, 9.2 * blink, -.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(8, -66, 7.3, 9.2 * blink, .12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (blink > .4) {
    ctx.fillStyle = "#243c20";
    ctx.beginPath(); ctx.ellipse(-4.3, -67, 2.8, 4.2, .15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10.5, -65, 2.8, 4.2, .15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "white";
    ctx.beginPath(); ctx.arc(-5, -69, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(9.8, -67, 1.1, 0, Math.PI * 2); ctx.fill();
  }
  // Tube mouth, pointing to the right; the dark opening makes the silhouette clear.
  ctx.beginPath(); ctx.moveTo(11, -56);
  ctx.bezierCurveTo(18, -61, 20, -69, 26, -69);
  ctx.lineTo(35, -69); ctx.quadraticCurveTo(41, -68, 41, -62);
  ctx.lineTo(41, -49); ctx.quadraticCurveTo(40, -44, 34, -44);
  ctx.lineTo(25, -44); ctx.bezierCurveTo(18, -44, 16, -51, 10, -52);
  ctx.closePath();
  const tube = ctx.createLinearGradient(13, -68, 40, -46);
  tube.addColorStop(0, "#82d943"); tube.addColorStop(.55, "#5eaf32"); tube.addColorStop(1, "#43842b");
  ctx.fillStyle = tube; ctx.fill(); ctx.lineWidth = 2.7; ctx.strokeStyle = outline; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(38.5, -56.5, 4.8, 8.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#26451f"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#315d28"; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(38.7, -57, 2.2, 5.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#172f1d"; ctx.fill();
  ctx.restore();
  ctx.restore();
}
