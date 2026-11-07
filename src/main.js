import { PLANT_TYPES, PlantSystem } from "./plant-system.js";
import { drawPeashooter } from "./draw-plant.js";
import { EnemySystem } from "./enemy-system.js";
import { drawBasicClone } from "./draw-enemy.js";
import { ProjectileSystem } from "./projectile-system.js";
import { ResourceManager } from "./resource-manager.js";
import { SunSystem } from "./sun-system.js";
import { SUN_CONFIG } from "./sun-config.js";
import { TEST_LEVEL } from "./wave-config.js";
import { WaveManager, WAVE_STATES } from "./wave-manager.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const liveStatus = document.querySelector("#game-status");
const waveTitle = document.querySelector("#wave-title");
const waveProgress = document.querySelector("#wave-progress");
const waveTrack = document.querySelector(".wave-track");
const waveDetails = document.querySelector("#wave-details");
const waveCountdown = document.querySelector("#wave-countdown");
const pauseButton = document.querySelector("#pause-game");
const resultOverlay = document.querySelector("#result-overlay");
const resultTitle = document.querySelector("#result-title");
const resultMessage = document.querySelector("#result-message");
const restartButton = document.querySelector("#restart-game");
const resources = new ResourceManager(SUN_CONFIG.startingBalance);
const game = new PlantSystem(5, 9, resources);
const enemies = new EnemySystem(game.rows);
const projectiles = new ProjectileSystem();
const suns = new SunSystem(SUN_CONFIG);
const waveManager = new WaveManager(TEST_LEVEL, {
  spawnEnemy: (type, row, x, overrides, now) => enemies.spawn(type, row, x, overrides, now),
  enemySystem: enemies,
});
const pointer = { x: -1, y: -1, down: null, inside: false, hoveredSun: null };
const state = { selected: null, hoveredCell: null, toast: "¡Tu jardín está listo!", toastUntil: performance.now() + 2600, counterChangedAt: -1e9, counterChangeType: null };
let pausedAtReal = null;
let totalPausedMs = 0;
function simulationTime(realNow = performance.now()) {
  return (pausedAtReal === null ? realNow : pausedAtReal) - totalPausedMs;
}

function updateWaveInterface(snapshot) {
  state.waveSnapshot = snapshot;
  if (!waveTitle) return;
  const terminal = snapshot.state === WAVE_STATES.COMPLETED || snapshot.state === WAVE_STATES.DEFEAT;
  const title = snapshot.state === WAVE_STATES.COMPLETED ? "Jardín defendido"
    : snapshot.state === WAVE_STATES.DEFEAT ? "El jardín está en peligro"
      : snapshot.currentWave === 0 ? "Preparando el jardín"
        : snapshot.isFinalWave ? `OLEADA FINAL · ${snapshot.currentWave}/${snapshot.totalWaves}`
          : `OLEADA ${snapshot.currentWave}/${snapshot.totalWaves}`;
  waveTitle.textContent = title;
  const progress = Math.round(snapshot.progress * 100);
  if (waveProgress) waveProgress.style.width = `${progress}%`;
  if (waveTrack) waveTrack.setAttribute("aria-valuenow", String(progress));
  if (waveDetails) waveDetails.textContent = `Oleada ${snapshot.currentWave || 1} de ${snapshot.totalWaves} · ${snapshot.aliveEnemies} vivos · ${snapshot.pendingEnemies} por aparecer`;
  if (waveCountdown) {
    const seconds = Math.ceil(snapshot.remainingTimeMs / 1000);
    if (snapshot.paused) waveCountdown.textContent = "Partida en pausa";
    else if (snapshot.state === WAVE_STATES.COUNTDOWN) waveCountdown.textContent = `${snapshot.message}: ${seconds} s`;
    else if ([WAVE_STATES.SPAWNING, WAVE_STATES.FINAL_WAVE].includes(snapshot.state)) waveCountdown.textContent = snapshot.pendingEnemies ? "Llegan más enemigos…" : "Elimina a los enemigos restantes";
    else if (snapshot.state === WAVE_STATES.IN_PROGRESS) waveCountdown.textContent = "Elimina a los enemigos restantes";
    else if (snapshot.state === WAVE_STATES.COMPLETED) waveCountdown.textContent = "Todas las oleadas superadas";
    else if (snapshot.state === WAVE_STATES.DEFEAT) waveCountdown.textContent = "Un clon alcanzó el jardín";
    else waveCountdown.textContent = snapshot.message;
  }
  if (pauseButton) {
    pauseButton.disabled = terminal || !waveManager.started;
    pauseButton.textContent = snapshot.paused ? "Reanudar" : "Pausar";
    pauseButton.setAttribute("aria-pressed", String(snapshot.paused));
  }
  if (terminal && resultOverlay) {
    resultTitle.textContent = snapshot.state === WAVE_STATES.COMPLETED ? "¡Jardín defendido!" : "¡Invasión!";
    resultMessage.textContent = snapshot.state === WAVE_STATES.COMPLETED
      ? `Has eliminado a los ${snapshot.totalScheduled} clones y superado las ${snapshot.totalWaves} oleadas.`
      : "Un clon consiguió cruzar el jardín. Vuelve a intentarlo y protege todas las filas.";
    resultOverlay.hidden = false;
    restartButton?.focus({ preventScroll: true });
  }
  if (liveStatus) liveStatus.textContent = `${title}. ${waveDetails?.textContent ?? ""}. ${waveCountdown?.textContent ?? ""}`;
}

waveManager.subscribe(updateWaveInterface);
resources.subscribe((change) => {
  state.counterChangedAt = simulationTime();
  state.counterChangeType = change.type;
});
let width = 0;
let height = 0;
let dpr = 1;
let layout;

function resize() {
  const rect = canvas.getBoundingClientRect();
  width = Math.max(1, rect.width);
  height = Math.max(1, rect.height);
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layout = makeLayout();
  for (const plant of game.plants.values()) {
    plant.worldPosition.x = layout.left + (plant.column + .5) * layout.cellW;
    plant.worldPosition.y = layout.top + (plant.row + .87) * layout.cellH;
  }
}

function makeLayout() {
  const compact = width < 600;
  const short = height < 500;
  const cellW = compact ? Math.min(60, (width - 28) / 9) : Math.min(105, (width - 100) / 9);
  const gridTop = compact ? (short ? 124 : 148) : (short ? 116 : 224);
  const cellH = Math.max(34, Math.min(compact ? 65 : 94, cellW * (compact ? 1.0 : .92), (height - gridTop - 34) / 5));
  const boardW = cellW * 9;
  const boardH = cellH * 5;
  return {
    compact, short, cellW, cellH, boardW, boardH,
    left: (width - boardW) / 2,
    top: gridTop,
    card: compact ? { x: 12, y: short ? 26 : 34, w: 154, h: 91 } : { x: 34, y: short ? 10 : 80, w: 220, h: 122 },
    counter: compact ? { x: 176, y: short ? 28 : 36, w: Math.max(106, width - 190), h: 48 } : { x: 275, y: short ? 17 : 91, w: 188, h: 66 },
  };
}

function roundedRect(c, x, y, w, h, r) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
}
function fillRound(c, x, y, w, h, r, fill, stroke = null, lineWidth = 1) {
  roundedRect(c, x, y, w, h, r);
  c.fillStyle = fill; c.fill();
  if (stroke) { c.lineWidth = lineWidth; c.strokeStyle = stroke; c.stroke(); }
}
function drawHealthBar(x, y, w, health, maxHealth) {
  const ratio = Math.max(0, Math.min(1, health / maxHealth));
  fillRound(ctx, x - 1, y - 1, w + 2, 6, 3, "rgba(34,42,28,.8)");
  if (ratio > 0) fillRound(ctx, x, y, w * ratio, 4, 2, ratio > .5 ? "#75d34d" : ratio > .25 ? "#f1c84f" : "#e45c4a");
}
function drawCloud(x, y, scale, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = "#fffbe6";
  ctx.beginPath(); ctx.ellipse(x, y, 34 * scale, 12 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 15 * scale, y - 5 * scale, 17 * scale, 13 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 2 * scale, y - 10 * scale, 21 * scale, 17 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 19 * scale, y - 4 * scale, 16 * scale, 12 * scale, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.restore();
}

function drawBackground(time) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#8dd8e1"); sky.addColorStop(.42, "#d8edbd"); sky.addColorStop(1, "#91c956");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
  drawCloud(width * .15 + Math.sin(time * .00012) * 12, height * .12, .8, .83);
  drawCloud(width * .75 - Math.sin(time * .00009) * 17, height * .19, 1.08, .74);
  // Distant rounded tree line.
  const horizon = layout.top + layout.boardH + 10;
  ctx.fillStyle = "#9acc63";
  ctx.beginPath(); ctx.moveTo(0, horizon + 16);
  for (let x = 0; x <= width + 60; x += 55) ctx.quadraticCurveTo(x + 18, horizon - 27 - (x % 3) * 5, x + 55, horizon + 15);
  ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath(); ctx.fill();
  // Quiet fence behind the playable lawn.
  const fenceY = layout.top - 13;
  ctx.fillStyle = "#c98e4c";
  for (let x = 10; x < width; x += 52) {
    fillRound(ctx, x, fenceY, 8, Math.max(26, layout.boardH + 28), 4, "#bb8248", "#986337", 1);
    ctx.beginPath(); ctx.arc(x + 4, fenceY + 4, 4, Math.PI, 0); ctx.fillStyle = "#d8a25c"; ctx.fill();
  }
  ctx.fillStyle = "#d6a15e";
  ctx.fillRect(0, fenceY + 19, width, 8); ctx.fillRect(0, fenceY + layout.boardH + 5, width, 8);
  // Soft lawn below the fence.
  const lawn = ctx.createLinearGradient(0, horizon, 0, height);
  lawn.addColorStop(0, "rgba(143,196,74,.12)"); lawn.addColorStop(1, "rgba(54,128,50,.28)");
  ctx.fillStyle = lawn; ctx.fillRect(0, horizon, width, height - horizon);
  // Tiny grass strokes, all drawn from simple paths.
  ctx.strokeStyle = "rgba(52,119,42,.27)"; ctx.lineWidth = 1.4;
  for (let i = 0; i < Math.floor(width / 30); i++) {
    const x = (i * 73 + 19) % width; const y = horizon + 22 + (i * 37) % Math.max(35, height - horizon - 24);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 3, y - 8, x - 5, y - 11); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 3, y - 7, x + 5, y - 10); ctx.stroke();
  }
}

function drawBrand(time) {
  if (layout.compact) {
    ctx.fillStyle = "#315d2d"; ctx.font = "900 14px Trebuchet MS, sans-serif"; ctx.textAlign = "left";
    ctx.fillText("EL JARDÍN", 14, height < 500 ? 14 : 19);
    return;
  }
  ctx.save();
  ctx.shadowColor = "rgba(45,76,37,.22)"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#fff5ce"; ctx.font = "900 24px Trebuchet MS, sans-serif"; ctx.textAlign = "left";
  ctx.fillText("EL JARDÍN", 36, 43);
  ctx.shadowColor = "transparent"; ctx.fillStyle = "#507840"; ctx.font = "700 12px Trebuchet MS, sans-serif";
  ctx.fillText("DEFENSA VEGETAL  ·  PREPARA TU HUERTO", 38, 61);
  // Leaf flourish.
  ctx.save(); ctx.translate(207, 34); ctx.rotate(Math.sin(time * .001) * .08);
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, -.35, 0, Math.PI * 2); ctx.fillStyle = "#58a83b"; ctx.fill();
  ctx.restore(); ctx.restore();
}

function drawSunIcon(x, y, radius) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#d18021"; ctx.lineWidth = Math.max(1.5, radius * .14); ctx.lineCap = "round";
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(0, -radius - 2); ctx.lineTo(0, -radius - 6); ctx.stroke();
  }
  const g = ctx.createRadialGradient(-radius * .3, -radius * .35, 1, 0, 0, radius);
  g.addColorStop(0, "#fff99a"); g.addColorStop(1, "#f6b934");
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = "#c88023"; ctx.stroke(); ctx.restore();
}

function drawSun(sun, now) {
  const age = now - sun.spawnedAt;
  const fadeIn = Math.min(1, age / SUN_CONFIG.spawnFadeMs);
  let alpha = fadeIn;
  let scale = 1;
  let lift = 0;
  if (sun.collected) {
    const progress = Math.min(1, (now - sun.collectedAt) / SUN_CONFIG.collectDurationMs);
    alpha *= 1 - progress;
    scale = 1 + progress * .65;
    lift = progress * 24;
  } else if (sun.expired) {
    alpha *= Math.max(0, 1 - (now - sun.expiredAt) / 300);
  }
  const hovered = pointer.hoveredSun === sun.id && !sun.collected && !sun.expired;
  const radius = SUN_CONFIG.radius * (hovered ? 1.12 : 1) * scale;
  const sway = Math.sin(now * .0024 + sun.phase) * (sun.falling ? 2.8 : 1.7);
  const pulse = 1 + Math.sin(now * .004 + sun.phase) * .045;
  const x = sun.x + sway;
  const y = sun.y - lift + Math.sin(now * .0018 + sun.phase) * 1.5;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = hovered ? "rgba(255,244,95,.95)" : "rgba(255,203,48,.72)";
  ctx.shadowBlur = hovered ? 24 : 15;
  ctx.fillStyle = "rgba(255,218,74,.25)";
  ctx.beginPath(); ctx.arc(0, 0, radius + 5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.rotate(now * .00035 + sun.phase);
  ctx.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    ctx.save(); ctx.rotate(i * Math.PI / 6);
    ctx.strokeStyle = i % 2 ? "#e89a23" : "#d9851d";
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(0, -radius * .78); ctx.lineTo(0, -radius - (i % 3 === 0 ? 9 : 7)); ctx.stroke();
    ctx.restore();
  }
  const gradient = ctx.createRadialGradient(-radius * .32, -radius * .38, 1, 0, 0, radius);
  gradient.addColorStop(0, "#fffeb0"); gradient.addColorStop(.52, "#ffe35a"); gradient.addColorStop(1, "#f6ad2e");
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = "#d68520"; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, radius * .57, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,249,139,.68)"; ctx.fill();
  ctx.beginPath(); ctx.ellipse(-radius * .28, -radius * .34, radius * .22, radius * .12, -.55, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,225,.84)"; ctx.fill();
  if (hovered) {
    ctx.beginPath(); ctx.arc(0, 0, radius + 12, 0, Math.PI * 2);
    ctx.setLineDash([3, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,207,.9)"; ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawSuns(now) {
  for (const sun of suns.suns.values()) drawSun(sun, now);
}

function drawCard(now) {
  const { x, y, w, h } = layout.card;
  const definition = PLANT_TYPES.peashooter;
  const remaining = game.cooldownRemaining("peashooter", now);
  const affordable = resources.canBuyPlant(definition.cost);
  const selected = state.selected === "peashooter";
  ctx.save();
  ctx.shadowColor = "rgba(54,58,27,.26)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
  fillRound(ctx, x, y, w, h, 13, "#59401f", selected ? "#fff17a" : "#543c21", selected ? 4 : 2);
  ctx.shadowColor = "transparent";
  const panel = ctx.createLinearGradient(x, y, x + w, y + h);
  panel.addColorStop(0, "#f6df9d"); panel.addColorStop(.48, "#e9c574"); panel.addColorStop(1, "#c69148");
  fillRound(ctx, x + 4, y + 4, w - 8, h - 8, 10, panel, "#f9e9b7", 1.2);
  const artSize = layout.compact ? h * .72 : h * .73;
  const artX = x + (layout.compact ? 8 : 13);
  const artY = y + h - (layout.compact ? 8 : 12);
  fillRound(ctx, x + 8, y + 9, artSize + 5, h - 18, 8, "#91b951", "#8c682e", 1.3);
  ctx.save(); roundedRect(ctx, x + 8, y + 9, artSize + 5, h - 18, 8); ctx.clip();
  const garden = ctx.createLinearGradient(0, y + 9, 0, y + h - 9);
  garden.addColorStop(0, "#b8d77b"); garden.addColorStop(1, "#76a849");
  ctx.fillStyle = garden; ctx.fillRect(x + 8, y + 9, artSize + 5, h - 18);
  drawPeashooter(ctx, artX + artSize * .54, artY - 5, artSize * .85, now * .7);
  ctx.restore();
  const tx = x + artSize + (layout.compact ? 18 : 25);
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#3e2d1d"; ctx.font = `900 ${layout.compact ? 12 : 10}px Trebuchet MS, sans-serif`;
  ctx.fillText(layout.compact ? "LANZA" : "LANZAGUISANTES", tx, y + (layout.compact ? 24 : 30));
  if (!layout.compact) {
    ctx.fillStyle = "#76552c"; ctx.font = "700 10px Trebuchet MS, sans-serif";
    ctx.fillText("PLANTA DEFENSIVA", tx, y + 48);
  }
  const costY = y + h - (layout.compact ? 20 : 25);
  drawSunIcon(tx + 8, costY, layout.compact ? 7 : 9);
  ctx.fillStyle = "#4e351d"; ctx.font = `900 ${layout.compact ? 13 : 16}px Trebuchet MS, sans-serif`;
  ctx.fillText(`${definition.cost}`, tx + 23, costY + .5);
  if (selected) {
    fillRound(ctx, x + w - 59, y + 7, 51, 20, 8, "#559b35", "#39752a", 1);
    ctx.fillStyle = "#fff9d6"; ctx.textAlign = "center"; ctx.font = "900 10px Trebuchet MS, sans-serif";
    ctx.fillText("ELEGIDA", x + w - 33.5, y + 17);
  }
  if (remaining > 0) {
    const progress = Math.max(0, Math.min(1, 1 - remaining / definition.rechargeMs));
    ctx.save(); roundedRect(ctx, x + 4, y + 4, w - 8, h - 8, 10); ctx.clip();
    ctx.fillStyle = "rgba(41,43,29,.48)"; ctx.fillRect(x + 4, y + 4, w - 8, (h - 8) * (1 - progress));
    ctx.fillStyle = "#fff6cf"; ctx.font = "900 13px Trebuchet MS, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`${(remaining / 1000).toFixed(1)} s`, x + w * .67, y + h * .68);
    ctx.restore();
  } else if (!affordable) {
    ctx.save(); roundedRect(ctx, x + 4, y + 4, w - 8, h - 8, 10); ctx.clip();
    ctx.fillStyle = "rgba(47,42,33,.43)"; ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    ctx.fillStyle = "#fff4d6"; ctx.font = "900 11px Trebuchet MS, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("FALTAN SOLES", x + w * .68, y + h * .76);
    ctx.restore();
  }
  ctx.restore();
}

function drawCounter(now) {
  const { x, y, w, h } = layout.counter;
  const changeAge = now - state.counterChangedAt;
  const pulse = changeAge >= 0 && changeAge < 360 ? 1 + Math.sin((1 - changeAge / 360) * Math.PI) * .045 : 1;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.scale(pulse, pulse); ctx.translate(-(x + w / 2), -(y + h / 2));
  if (changeAge >= 0 && changeAge < 300) {
    ctx.fillStyle = state.counterChangeType === "add" ? "rgba(255,235,105,.28)" : "rgba(240,166,81,.24)";
    roundedRect(ctx, x - 2, y - 2, w + 4, h + 4, 15); ctx.fill();
  }
  ctx.shadowColor = "rgba(57,68,31,.18)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
  fillRound(ctx, x, y, w, h, 14, "#f9edc9", "#986b35", 2);
  ctx.shadowColor = "transparent";
  drawSunIcon(x + 27, y + h / 2, layout.compact ? 12 : 17);
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#70512b"; ctx.font = `800 ${layout.compact ? 9 : 11}px Trebuchet MS, sans-serif`;
  ctx.fillText("SOLES", x + (layout.compact ? 47 : 54), y + h * .34);
  ctx.fillStyle = "#3f4828"; ctx.font = `900 ${layout.compact ? 21 : 27}px Trebuchet MS, sans-serif`;
  ctx.fillText(String(game.sun), x + (layout.compact ? 47 : 54), y + h * .69);
  if (!layout.compact) {
    ctx.fillStyle = "#8b744b"; ctx.font = "700 10px Trebuchet MS, sans-serif";
    ctx.fillText("RECURSOS", x + 128, y + h / 2 + 1);
  }
  ctx.restore();
}

function updateCombat(now) {
  const { left, top, cellW, cellH } = layout;
  const targets = [...enemies.enemies.values()].filter((enemy) => enemy.alive);
  for (const plant of game.plants.values()) {
    if (!plant.alive || !plant.exists) {
      plant.attackState = "IDLE";
      plant.targetId = null;
      continue;
    }
    plant.boardX = (plant.worldPosition.x - left) / cellW;
    const target = targets
      .filter((enemy) => enemy.row === plant.row && enemy.x > plant.boardX)
      .sort((a, b) => a.x - b.x)[0] ?? null;
    plant.targetId = target?.id ?? null;
    if (!target) {
      plant.attackState = "IDLE";
      continue;
    }
    if (now >= plant.nextAttackAt) {
      const plantSize = cellW * .83;
      projectiles.spawn({
        x: plant.worldPosition.x + plantSize * .39,
        y: plant.worldPosition.y - plantSize * .565,
        row: plant.row,
        damage: plant.damage,
        speed: plant.projectileSpeed,
        ownerId: plant.id,
      }, now);
      plant.attackState = "SHOOTING";
      plant.attackStartedAt = now;
      plant.nextAttackAt = now + plant.attackIntervalMs;
    } else {
      plant.attackState = now - plant.attackStartedAt < 180 ? "SHOOTING" : "AIMING";
    }
  }
  projectiles.update(now, enemies.enemies, { ...layout, width, left, top, cellW, cellH }, enemies);
}

function drawProjectile(projectile, time) {
  const pulse = 1 + Math.sin((time - projectile.spawnedAt) * .018) * .08;
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.shadowColor = "rgba(38,77,25,.35)"; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
  const glow = ctx.createRadialGradient(-2, -3, 1, 0, 0, projectile.radius * pulse);
  glow.addColorStop(0, "#e4ff8a"); glow.addColorStop(.55, "#83d63e"); glow.addColorStop(1, "#438a2c");
  ctx.beginPath(); ctx.arc(0, 0, projectile.radius * pulse, 0, Math.PI * 2);
  ctx.fillStyle = glow; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = "#315d25"; ctx.stroke();
  ctx.shadowColor = "transparent";
  ctx.beginPath(); ctx.ellipse(-projectile.radius * .3, -projectile.radius * .35, projectile.radius * .22, projectile.radius * .12, -.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,220,.8)"; ctx.fill();
  ctx.restore();
}

function drawBoard(now) {
  const { left, top, cellW, cellH, boardW, boardH } = layout;
  ctx.save();
  ctx.shadowColor = "rgba(46,66,34,.28)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
  fillRound(ctx, left - 12, top - 12, boardW + 24, boardH + 24, 16, "#a96e39", "#754a2c", 3);
  ctx.shadowColor = "transparent";
  const frame = ctx.createLinearGradient(0, top - 12, 0, top + boardH + 12);
  frame.addColorStop(0, "#d49a55"); frame.addColorStop(.5, "#bd7f41"); frame.addColorStop(1, "#99602f");
  fillRound(ctx, left - 8, top - 8, boardW + 16, boardH + 16, 11, frame, "#e4b46f", 2);
  // These cells are the sole source of row/column hit-testing and occupancy visuals.
  for (let row = 0; row < game.rows; row++) {
    for (let column = 0; column < game.columns; column++) {
      const x = left + column * cellW; const y = top + row * cellH;
      const plant = game.getAt(row, column);
      const hovered = state.hoveredCell?.row === row && state.hoveredCell?.column === column;
      const shade = (row + column) % 2 === 0;
      fillRound(ctx, x + 1, y + 1, cellW - 2, cellH - 2, 4, shade ? "#88c750" : "#7fbd48", "rgba(49,101,39,.33)", 1);
      ctx.strokeStyle = "rgba(238,255,177,.15)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 6, y + cellH - 6); ctx.lineTo(x + cellW - 7, y + 7); ctx.stroke();
      if (state.selected) {
        ctx.fillStyle = plant ? "rgba(193,61,44,.20)" : "rgba(220,255,161,.15)";
        ctx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);
        ctx.strokeStyle = plant ? "rgba(163,48,38,.68)" : "rgba(242,255,193,.8)";
        ctx.lineWidth = plant ? 2 : 1.3; ctx.setLineDash(plant ? [4, 3] : [5, 5]);
        ctx.strokeRect(x + 4, y + 4, cellW - 8, cellH - 8); ctx.setLineDash([]);
      }
      if (hovered) {
        ctx.strokeStyle = state.selected && plant ? "#cf5141" : "#fff39a";
        ctx.lineWidth = 3; ctx.strokeRect(x + 3, y + 3, cellW - 6, cellH - 6);
      }
    }
  }
  ctx.restore();

  // Plant data is rendered independently from occupancy and placement rules.
  for (const plant of game.plants.values()) {
    if (!plant.exists) continue;
    const target = plant.targetId ? enemies.get(plant.targetId) : null;
    const plantSize = cellW * .83;
    const muzzleX = plant.worldPosition.x + plantSize * .39;
    const muzzleY = plant.worldPosition.y - plantSize * .565;
    const targetX = target ? left + target.x * cellW : muzzleX + cellW;
    const targetY = target ? top + (target.row + .88) * cellH - cellH * .96 * .55 : muzzleY;
    drawPeashooter(ctx, plant.worldPosition.x, plant.worldPosition.y, plantSize, now, {
      age: now - plant.animationStartedAt,
      disappearing: plant.animationState === "disappearing",
      attackState: plant.attackState,
      aimAngle: plant.targetId ? Math.atan2(targetY - muzzleY, targetX - muzzleX) : 0,
    });
    if (plant.alive) drawHealthBar(plant.worldPosition.x - cellW * .2, plant.worldPosition.y - plantSize * .96, cellW * .4, plant.health, plant.maxHealth);
  }
  // Enemies are drawn above plants so a clone approaching an obstacle stays legible.
  for (const enemy of enemies.enemies.values()) {
    if (enemy.state === "DEAD") continue;
    const enemyX = left + enemy.x * cellW;
    const enemyY = top + (enemy.row + .88) * cellH;
    drawBasicClone(ctx, enemyX, enemyY, cellH * .96, now, enemy);
    drawHealthBar(enemyX - cellH * .21, enemyY - cellH * .98, cellH * .42, enemy.health, enemy.maxHealth);
    if (enemy.state === "DETECTING" || enemy.state === "ATTACKING") {
      const label = enemy.state === "DETECTING" ? "¡PLANTA!" : "DETENIDO";
      ctx.save();
      ctx.font = `900 ${layout.compact ? 8 : 9}px Trebuchet MS, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const labelW = ctx.measureText(label).width + 12;
      fillRound(ctx, enemyX - labelW / 2, enemyY - cellH * .99, labelW, 16, 8,
        enemy.state === "ATTACKING" ? "rgba(116,65,48,.9)" : "rgba(69,83,47,.88)", "rgba(255,244,206,.8)", 1);
      ctx.fillStyle = "#fff4d5"; ctx.fillText(label, enemyX, enemyY - cellH * .99 + 8);
      ctx.restore();
    }
  }
  for (const corpse of enemies.corpses.values()) {
    const corpseX = left + corpse.x * cellW;
    const corpseY = top + (corpse.row + .88) * cellH;
    drawBasicClone(ctx, corpseX, corpseY, cellH * .96, now, corpse);
  }
  for (const projectile of projectiles.projectiles) drawProjectile(projectile, now);
  const cell = state.hoveredCell;
  if (state.selected && cell) {
    const occupant = game.getAt(cell.row, cell.column);
    const centerX = left + (cell.column + .5) * cellW;
    const baseline = top + (cell.row + .87) * cellH;
    if (!occupant && resources.canBuyPlant(PLANT_TYPES[state.selected].cost) && game.cooldownRemaining(state.selected, now) <= 0) {
      drawPeashooter(ctx, centerX, baseline, cellW * .83, now, { ghost: true });
    } else if (occupant) {
      const markY = top + (cell.row + .2) * cellH;
      ctx.save(); ctx.strokeStyle = "rgba(143,43,36,.9)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(centerX, markY, Math.max(8, cellW * .1), 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(centerX - 4, markY - 4); ctx.lineTo(centerX + 4, markY + 4);
      ctx.moveTo(centerX + 4, markY - 4); ctx.lineTo(centerX - 4, markY + 4); ctx.stroke(); ctx.restore();
    }
  }
}

function drawFooter(now) {
  const bottom = layout.top + layout.boardH;
  if (bottom + 38 < height - 10) {
    const text = state.selected ? "CASILLAS VERDES: LIBRES     ·     ROJAS: OCUPADAS" : "5 FILAS  ·  9 COLUMNAS  ·  PREPARA TU JARDÍN";
    ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `800 ${layout.compact ? 9 : 11}px Trebuchet MS, sans-serif`;
    const tw = ctx.measureText(text).width + 26;
    fillRound(ctx, width / 2 - tw / 2, bottom + 19, tw, 25, 12, "rgba(255,249,217,.78)", "rgba(111,131,62,.3)", 1);
    ctx.fillStyle = "#526d39"; ctx.fillText(text, width / 2, bottom + 31.5);
    ctx.restore();
  }
  if (state.toast && now < state.toastUntil) {
    const fade = Math.min(1, (state.toastUntil - now) / 280);
    ctx.save(); ctx.globalAlpha = fade; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `900 ${layout.compact ? 12 : 14}px Trebuchet MS, sans-serif`;
    const label = ctx.measureText(state.toast).width;
    const toastW = Math.min(width - 32, label + 38);
    const toastY = layout.compact
      ? Math.min(height - 54, layout.top + layout.boardH + 58)
      : Math.max(layout.top + layout.boardH + 58, height - 54);
    fillRound(ctx, width / 2 - toastW / 2, toastY - 17, toastW, 34, 17, "rgba(48,75,37,.9)", "rgba(240,242,196,.8)", 1);
    ctx.fillStyle = "#fff8d8"; ctx.fillText(state.toast, width / 2, toastY);
    ctx.restore();
  }
}

function setMessage(message, duration = 1900) {
  state.toast = message;
  state.toastUntil = simulationTime() + duration;
  if (liveStatus) liveStatus.textContent = message;
}

function drawPauseOverlay() {
  ctx.save();
  ctx.fillStyle = "rgba(26, 42, 22, .42)";
  ctx.fillRect(0, 0, width, height);
  const panelW = Math.min(330, width - 36);
  const panelH = 118;
  const panelX = (width - panelW) / 2;
  const panelY = (height - panelH) / 2;
  fillRound(ctx, panelX, panelY, panelW, panelH, 20, "rgba(255, 248, 218, .97)", "#d8bd79", 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#3e5b2e";
  ctx.font = "900 26px Trebuchet MS, sans-serif";
  ctx.fillText("Partida en pausa", width / 2, panelY + 43);
  ctx.fillStyle = "#76613b";
  ctx.font = "700 13px Trebuchet MS, sans-serif";
  ctx.fillText("Pulsa «Reanudar» para continuar", width / 2, panelY + 79);
  ctx.restore();
}

function togglePause() {
  if (!waveManager.started || [WAVE_STATES.COMPLETED, WAVE_STATES.DEFEAT].includes(waveManager.state)) return;
  const realNow = performance.now();
  if (pausedAtReal === null) {
    pausedAtReal = realNow;
    waveManager.pause(simulationTime(realNow));
  } else {
    totalPausedMs += realNow - pausedAtReal;
    pausedAtReal = null;
    waveManager.resume(simulationTime(realNow));
  }
}

function restartGame() {
  const now = performance.now();
  pausedAtReal = null;
  totalPausedMs = 0;
  state.selected = null;
  state.hoveredCell = null;
  state.toast = "¡Tu jardín está listo!";
  state.toastUntil = now + 2600;
  state.counterChangedAt = -1e9;
  state.counterChangeType = null;
  pointer.down = null;
  pointer.hoveredSun = null;
  resources.reset(SUN_CONFIG.startingBalance);
  game.reset();
  enemies.reset();
  projectiles.reset();
  suns.reset();
  resultOverlay.hidden = true;
  waveManager.reset(now);
  canvas.style.cursor = "crosshair";
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function updatePointer(point) {
  pointer.x = point.x; pointer.y = point.y; pointer.inside = true;
  pointer.hoveredSun = null;
  const liveSuns = [...suns.suns.values()];
  for (let i = liveSuns.length - 1; i >= 0; i--) {
    const sun = liveSuns[i];
    if (sun.collected || sun.expired) continue;
    const dx = point.x - sun.x; const dy = point.y - sun.y;
    if (dx * dx + dy * dy <= (SUN_CONFIG.radius + 11) ** 2) { pointer.hoveredSun = sun.id; break; }
  }
  canvas.style.cursor = pointer.hoveredSun ? "pointer" : "crosshair";
  const { left, top, cellW, cellH, boardW, boardH } = layout;
  if (point.x >= left && point.x < left + boardW && point.y >= top && point.y < top + boardH) {
    const column = Math.floor((point.x - left) / cellW);
    const row = Math.floor((point.y - top) / cellH);
    state.hoveredCell = game.isCellInBounds(row, column) ? { row, column } : null;
  } else {
    state.hoveredCell = null;
  }
}

function showCardError(type, reason) {
  const name = PLANT_TYPES[type]?.name ?? "Planta";
  if (reason === "sun") setMessage(`No hay soles suficientes para ${name}.`);
  else if (reason === "cooldown") setMessage("La tarjeta todavía está recargando.");
  else if (reason === "occupied") setMessage("Esa casilla ya está ocupada.");
  else if (reason === "outside") setMessage("Coloca la planta dentro del tablero.");
}

function handlePointerUp(event) {
  if (pointer.down !== event.button) return;
  const button = pointer.down;
  pointer.down = null;
  const point = canvasPoint(event); updatePointer(point);
  if (waveManager.pausedAt !== null || [WAVE_STATES.COMPLETED, WAVE_STATES.DEFEAT].includes(waveManager.state)) return;
  const now = simulationTime();
  if (button === 2) {
    const plant = state.hoveredCell && game.getAt(state.hoveredCell.row, state.hoveredCell.column);
    if (plant && game.remove(plant.id)) setMessage(`Retirando ${plant.name.toLowerCase()}…`);
    return;
  }
  if (button !== 0) return;
  if (pointer.hoveredSun) {
    const collected = suns.collect(pointer.hoveredSun, now);
    if (collected) {
      resources.add(SUN_CONFIG.value, "sun-pickup");
      setMessage(`¡+${SUN_CONFIG.value} soles!`, 1100);
    }
    pointer.hoveredSun = null;
    return;
  }
  const { x, y, w, h } = layout.card;
  if (point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h) {
    const type = "peashooter";
    if (state.selected === type) {
      state.selected = null;
      setMessage("Selección cancelada.");
      return;
    }
    const reason = game.canPlace(type, 0, 0).reason;
    if (!resources.canBuyPlant(PLANT_TYPES[type].cost)) {
      showCardError(type, "sun"); state.selected = null; return;
    }
    if (game.cooldownRemaining(type, now) > 0) {
      showCardError(type, "cooldown"); state.selected = null; return;
    }
    state.selected = type;
    setMessage("Lanzaguisantes elegida: apunta a una casilla libre.");
    return;
  }
  if (!state.hoveredCell) {
    if (state.selected) setMessage("Elige una casilla dentro del tablero.");
    return;
  }
  if (!state.selected) {
    if (game.getAt(state.hoveredCell.row, state.hoveredCell.column)) setMessage("Esta casilla ya está ocupada.");
    return;
  }
  const cell = state.hoveredCell;
  const { left, top, cellW, cellH } = layout;
  const worldPosition = {
    x: left + (cell.column + .5) * cellW,
    y: top + (cell.row + .87) * cellH,
  };
  const result = game.place(state.selected, cell.row, cell.column, worldPosition, now);
  if (!result.ok) { showCardError(state.selected, result.reason); return; }
  state.selected = null;
  setMessage(`¡${result.plant.name} plantada!  −${result.plant.cost} soles.`);
}

function draw(time) {
  const now = simulationTime(time);
  if (!waveManager.started) waveManager.start(now);
  game.update(now);
  const activePlants = [...game.plants.values()].filter((plant) => plant.alive && plant.exists);
  for (const plant of activePlants) plant.boardX = (plant.worldPosition.x - layout.left) / layout.cellW;
  enemies.update(now, activePlants, game, layout.cellW);
  updateCombat(now);
  suns.update(now, { left: layout.left + SUN_CONFIG.radius + 3, top: layout.top + 6, width: Math.max(1, layout.boardW - (SUN_CONFIG.radius + 6) * 2), height: Math.max(1, layout.boardH - 12) });
  waveManager.update(now);
  drawBackground(now);
  drawBrand(now);
  drawCard(now);
  drawCounter(now);
  drawBoard(now);
  drawSuns(now);
  drawFooter(now);
  if (waveManager.pausedAt !== null) drawPauseOverlay();
  requestAnimationFrame(draw);
}

canvas.addEventListener("pointermove", (event) => updatePointer(canvasPoint(event)));
canvas.addEventListener("pointerleave", () => {
  if (pointer.down === null) { pointer.inside = false; pointer.hoveredSun = null; state.hoveredCell = null; canvas.style.cursor = "crosshair"; }
});
canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 && event.button !== 2) return;
  event.preventDefault(); pointer.down = event.button; updatePointer(canvasPoint(event));
  try { canvas.setPointerCapture(event.pointerId); } catch { /* capture can be unavailable in embedded browsers */ }
});
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", () => { pointer.down = null; });
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
pauseButton?.addEventListener("click", togglePause);
restartButton?.addEventListener("click", restartGame);
window.addEventListener("resize", resize, { passive: true });
resize();
requestAnimationFrame(draw);
