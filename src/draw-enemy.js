const ink = "#473c3b";

function limb(ctx, startX, startY, endX, endY, width, color) {
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.quadraticCurveTo((startX + endX) / 2 + 3, (startY + endY) / 2, endX, endY);
  ctx.lineWidth = width + 2;
  ctx.strokeStyle = ink;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** Procedurally draws the Z-Corp clone. Origin is centered between its feet. */
export function drawBasicClone(ctx, x, y, size, time = 0, enemy = {}) {
  const scale = size / 100;
  const spawning = enemy.state === "SPAWNING";
  const dying = enemy.state === "DYING";
  const age = Math.max(0, time - (dying ? enemy.stateStartedAt : (enemy.spawnedAt ?? time)));
  const walk = enemy.state === "WALKING" || enemy.state === "DETECTING";
  const attacking = enemy.state === "ATTACKING";
  const phase = time * (walk || attacking ? 0.008 : 0.0025) + (enemy.row ?? 0) * 1.7;
  const step = walk ? Math.sin(phase) : 0;
  const punch = attacking ? Math.max(0, Math.sin(phase * 2)) : 0;
  const bob = walk ? Math.abs(Math.sin(phase * 2)) * 1.4 : Math.sin(phase) * .55;
  const spawnProgress = Math.min(1, age / 620);

  ctx.save();
  ctx.translate(x + (enemy.state === "DAMAGED" ? -2.5 * scale : 0), y + bob * scale);
  ctx.scale(scale, scale * (spawning ? .78 + .22 * spawnProgress : dying ? .82 : 1));
  ctx.globalAlpha *= spawning ? spawnProgress : dying ? Math.max(0, 1 - age / 650) : 1;
  if (enemy.state === "DAMAGED") {
    ctx.globalAlpha *= .65 + Math.sin(time * .05) * .35;
    ctx.filter = "brightness(1.45)";
  }

  // Soft shadow and scuffed shoes.
  ctx.beginPath(); ctx.ellipse(0, -2, 26, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(42,48,38,.22)"; ctx.fill();

  // Narrow legs in worn hospital trousers, alternating at the hip.
  const legColor = "#73817d";
  limb(ctx, -8, -31, -10 + step * 7, -13, 8, legColor);
  limb(ctx, -10 + step * 7, -13, -12 + step * 12, -3, 7, "#a5a49a");
  limb(ctx, 7, -31, 9 - step * 7, -13, 8, legColor);
  limb(ctx, 9 - step * 7, -13, 13 - step * 12, -3, 7, "#aaa69b");
  ctx.fillStyle = "#514944";
  ctx.beginPath(); ctx.ellipse(-13 + step * 12, -3, 8, 3.2, -.08, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(14 - step * 12, -3, 8, 3.2, .08, 0, Math.PI * 2); ctx.fill();

  // Slumped torso: faded, torn clinical tunic with a crooked collar.
  ctx.save(); ctx.rotate(-.07 + (enemy.state === "ATTACKING" ? -.035 : 0));
  ctx.beginPath();
  ctx.moveTo(-14, -61); ctx.quadraticCurveTo(-18, -57, -17, -45);
  ctx.lineTo(-13, -28); ctx.quadraticCurveTo(0, -24, 13, -29);
  ctx.lineTo(17, -47); ctx.lineTo(12, -62); ctx.closePath();
  const shirt = ctx.createLinearGradient(-14, -62, 15, -29);
  shirt.addColorStop(0, "#d2d0bd"); shirt.addColorStop(1, "#969e91");
  ctx.fillStyle = shirt; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = "#59645e"; ctx.stroke();
  // Collar, buttons and ripped hem.
  ctx.fillStyle = "#e4dfcb"; ctx.beginPath(); ctx.moveTo(-8, -61); ctx.lineTo(0, -54); ctx.lineTo(-3, -48); ctx.lineTo(-12, -56); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, -61); ctx.lineTo(0, -54); ctx.lineTo(4, -48); ctx.lineTo(13, -56); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(73,67,57,.6)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-11, -32); ctx.lineTo(-6, -34); ctx.lineTo(-2, -31); ctx.moveTo(4, -31); ctx.lineTo(9, -34); ctx.lineTo(13, -31); ctx.stroke();
  ctx.fillStyle = "#7d695b"; ctx.beginPath(); ctx.arc(3, -43, 1.2, 0, Math.PI * 2); ctx.arc(4, -37, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Long, uneven arms swing opposite the legs.
  const armColor = "#c2baa7";
  limb(ctx, -13, -57, -21 - step * 5, -43, 7, armColor);
  limb(ctx, -21 - step * 5, -43, -18 - step * 8, -32, 6, "#c6bda9");
  limb(ctx, 13, -57, 21 + step * 5, -44, 7, armColor);
  limb(ctx, 21 + step * 5, -44, 18 + step * 8, -34, 6, "#c6bda9");
  ctx.fillStyle = "#c4bca9";
  ctx.beginPath(); ctx.ellipse(-18 - step * 8, -31, 4.3, 5.2, -.2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(18 + step * 8, -33, 4.3, 5.2, .2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Pale, slightly misshapen head and neck.
  ctx.fillStyle = "#b3b09e"; ctx.fillRect(-4, -66, 9, 10);
  ctx.beginPath(); ctx.ellipse(1, -75, 15, 17, -.12 + Math.sin(phase) * .025, 0, Math.PI * 2);
  ctx.fillStyle = "#d0cbbb"; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = "#655c53"; ctx.stroke();
  // One raised temple and a small ear.
  ctx.beginPath(); ctx.ellipse(-11, -82, 5, 6, -.35, 0, Math.PI * 2); ctx.fillStyle = "#c2bdad"; ctx.fill(); ctx.stroke();
  // Uneven eyes, low brows, pinched nose, and a crooked mouth.
  ctx.fillStyle = "#f1e7d4";
  ctx.beginPath(); ctx.ellipse(-5, -78, 3.2, 2.1, -.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6, -77, 2.6, 1.8, .12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#433d39"; ctx.beginPath(); ctx.arc(-4, -78, 1.25, 0, Math.PI * 2); ctx.arc(6, -77, 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#62584f"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-9, -82); ctx.lineTo(-2, -81); ctx.moveTo(3, -81); ctx.lineTo(9, -82); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1, -76); ctx.lineTo(-1, -70); ctx.lineTo(2, -69); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-3, -66); ctx.quadraticCurveTo(2, -68, 7, -65); ctx.stroke();
  // A few restrained blemishes make the failed-clone look biological, not gory.
  ctx.fillStyle = "rgba(130,105,91,.38)";
  ctx.beginPath(); ctx.arc(-8, -70, 1.3, 0, Math.PI * 2); ctx.arc(9, -73, 1, 0, Math.PI * 2); ctx.arc(-3, -87, 1, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}
