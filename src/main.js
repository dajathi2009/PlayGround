import { PLANT_TYPES, PlantSystem } from "./plant-system.js";
import { drawPeashooter } from "./draw-plant.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const liveStatus = document.querySelector("#game-status");
const game = new PlantSystem(5, 9, 100);
const pointer = { x: -1, y: -1, down: null, inside: false };
const state = { selected: null, hoveredCell: null, toast: "¡Tu jardín está listo!", toastUntil: performance.now() + 2600 };
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

function drawCard(now) {
  const { x, y, w, h } = layout.card;
  const definition = PLANT_TYPES.peashooter;
  const remaining = game.cooldownRemaining("peashooter", now);
  const affordable = game.sun >= definition.cost;
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

function drawCounter() {
  const { x, y, w, h } = layout.counter;
  ctx.save();
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
    drawPeashooter(ctx, plant.worldPosition.x, plant.worldPosition.y, cellW * .83, now,
      { age: now - plant.animationStartedAt, disappearing: plant.animationState === "disappearing" });
  }
  const cell = state.hoveredCell;
  if (state.selected && cell) {
    const occupant = game.getAt(cell.row, cell.column);
    const centerX = left + (cell.column + .5) * cellW;
    const baseline = top + (cell.row + .87) * cellH;
    if (!occupant && game.sun >= PLANT_TYPES[state.selected].cost && game.cooldownRemaining(state.selected, now) <= 0) {
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
    const toastY = Math.max(layout.top + layout.boardH + 58, height - 54);
    fillRound(ctx, width / 2 - toastW / 2, toastY - 17, toastW, 34, 17, "rgba(48,75,37,.9)", "rgba(240,242,196,.8)", 1);
    ctx.fillStyle = "#fff8d8"; ctx.fillText(state.toast, width / 2, toastY);
    ctx.restore();
  }
}

function setMessage(message, duration = 1900) {
  state.toast = message;
  state.toastUntil = performance.now() + duration;
  if (liveStatus) liveStatus.textContent = message;
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function updatePointer(point) {
  pointer.x = point.x; pointer.y = point.y; pointer.inside = true;
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
  if (button === 2) {
    const plant = state.hoveredCell && game.getAt(state.hoveredCell.row, state.hoveredCell.column);
    if (plant && game.remove(plant.id)) setMessage(`Retirando ${plant.name.toLowerCase()}…`);
    return;
  }
  if (button !== 0) return;
  const { x, y, w, h } = layout.card;
  if (point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h) {
    const type = "peashooter";
    if (state.selected === type) {
      state.selected = null;
      setMessage("Selección cancelada.");
      return;
    }
    const reason = game.canPlace(type, 0, 0).reason;
    if (game.sun < PLANT_TYPES[type].cost) {
      showCardError(type, "sun"); state.selected = null; return;
    }
    if (game.cooldownRemaining(type) > 0) {
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
  const result = game.place(state.selected, cell.row, cell.column, worldPosition);
  if (!result.ok) { showCardError(state.selected, result.reason); return; }
  state.selected = null;
  setMessage(`¡${result.plant.name} plantada!  −${result.plant.cost} soles.`);
}

function draw(time) {
  game.update(time);
  drawBackground(time);
  drawBrand(time);
  drawCard(time);
  drawCounter();
  drawBoard(time);
  drawFooter(time);
  requestAnimationFrame(draw);
}

canvas.addEventListener("pointermove", (event) => updatePointer(canvasPoint(event)));
canvas.addEventListener("pointerleave", () => {
  if (pointer.down === null) { pointer.inside = false; state.hoveredCell = null; }
});
canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 && event.button !== 2) return;
  event.preventDefault(); pointer.down = event.button; updatePointer(canvasPoint(event));
  try { canvas.setPointerCapture(event.pointerId); } catch { /* capture can be unavailable in embedded browsers */ }
});
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", () => { pointer.down = null; });
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("resize", resize, { passive: true });
resize();
requestAnimationFrame(draw);
