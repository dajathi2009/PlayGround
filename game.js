(() => {
  'use strict';

  const canvas = document.getElementById('garden');
  const ctx = canvas.getContext('2d');
  const scene = canvas.parentElement;
  const targets = document.createElement('div');
  targets.className = 'cell-targets';
  targets.setAttribute('role', 'grid');
  targets.setAttribute('aria-label', 'Tablero de combate, 5 filas por 9 columnas');
  scene.appendChild(targets);

  const ROWS = 5;
  const COLUMNS = 9;
  let width = 0;
  let height = 0;
  let board = null;
  let hoveredCell = null;
  let keyboardCell = null;
  let pinnedCell = null;
  let skyTime = 0;

  const selectionTitle = document.getElementById('selection-title');
  const selectionHint = document.getElementById('selection-hint');
  const coordValue = document.getElementById('coord-value');
  const coordDetail = document.getElementById('coord-detail');

  // Geometría lógica del tablero. row/column son siempre índices base cero.
  function isInsideBoard(x, y) {
    return !!board && x >= board.x && y >= board.y && x < board.x + board.width && y < board.y + board.height;
  }

  function screenToCell(screenX, screenY) {
    if (!isInsideBoard(screenX, screenY)) return null;
    const column = Math.floor((screenX - board.x) / board.cellWidth);
    const row = Math.floor((screenY - board.y) / board.cellHeight);
    return row >= 0 && row < ROWS && column >= 0 && column < COLUMNS ? { row, column } : null;
  }

  function getCellPosition(row, column) {
    if (!isValidCell(row, column) || !board) return null;
    return {
      x: board.x + (column + 0.5) * board.cellWidth,
      y: board.y + (row + 0.5) * board.cellHeight
    };
  }

  function isValidCell(row, column) {
    return Number.isInteger(row) && Number.isInteger(column) && row >= 0 && row < ROWS && column >= 0 && column < COLUMNS;
  }

  // Coordenadas CSS locales: equivalen a las coordenadas del mundo de la escena.
  function screenToCellFromPointer(event) {
    const rect = canvas.getBoundingClientRect();
    return screenToCell(event.clientX - rect.left, event.clientY - rect.top);
  }

  // API pequeña y reutilizable para las siguientes etapas del juego.
  window.GardenBoard = Object.freeze({
    rows: ROWS,
    columns: COLUMNS,
    isInsideBoard,
    screenToCell,
    screenToPointer: screenToCellFromPointer,
    getCellPosition,
    isValidCell
  });

  function roundedRect(x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fillEllipse(x, y, rx, ry, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function polygon(points, color) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawCloud(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    fillEllipse(0, 12, 31, 12, '#fffdf0d9');
    fillEllipse(-17, 7, 17, 13, '#fffdf0e8');
    fillEllipse(2, 0, 19, 18, '#fffdf0ee');
    fillEllipse(20, 8, 18, 12, '#fffdf0df');
    ctx.restore();
  }

  function drawHouse(x, y, w, h) {
    ctx.save();
    // Sombra suave bajo el alero.
    fillEllipse(x + w * .5, y + h * .91, w * .58, h * .07, '#416d4a3b');
    polygon([[x - 12, y + h * .32], [x + w * .5, y], [x + w + 13, y + h * .32], [x + w * .92, y + h * .4], [x + w * .5, y + h * .16], [x + w * .06, y + h * .4]], '#7d4938');
    polygon([[x + w * .04, y + h * .33], [x + w * .5, y + h * .08], [x + w * .96, y + h * .33], [x + w * .91, y + h * .39], [x + w * .5, y + h * .17], [x + w * .09, y + h * .39]], '#a45e44');
    roundedRect(x + w * .1, y + h * .32, w * .8, h * .53, 5);
    ctx.fillStyle = '#f3d9a8'; ctx.fill();
    // Fachada y zócalo.
    ctx.fillStyle = '#e9c995'; ctx.fillRect(x + w * .1, y + h * .76, w * .8, h * .09);
    ctx.fillStyle = '#cfad79'; ctx.fillRect(x + w * .08, y + h * .83, w * .84, h * .045);
    // Ventanas con marcos claros.
    const wy = y + h * .43, ww = w * .2, wh = h * .2;
    [x + w * .19, x + w * .61].forEach(wx => {
      roundedRect(wx - 3, wy - 3, ww + 6, wh + 6, 4); ctx.fillStyle = '#fff1cb'; ctx.fill();
      roundedRect(wx, wy, ww, wh, 2); ctx.fillStyle = '#82c6c6'; ctx.fill();
      ctx.fillStyle = '#b7e0d9'; ctx.fillRect(wx + 3, wy + 3, ww * .42, wh * .42);
      ctx.fillStyle = '#f4e3b9'; ctx.fillRect(wx + ww * .47, wy, 3, wh);
      ctx.fillRect(wx, wy + wh * .48, ww, 3);
      ctx.fillStyle = '#d79170'; ctx.fillRect(wx - 4, wy + wh + 2, ww + 8, 4);
    });
    // Puerta y pequeño escalón.
    const dw = w * .17, dx = x + w * .415, dy = y + h * .58;
    roundedRect(dx, dy, dw, h * .27, 4); ctx.fillStyle = '#6f4935'; ctx.fill();
    ctx.fillStyle = '#a9734e'; ctx.fillRect(dx + 4, dy + 5, dw - 8, h * .12);
    fillEllipse(dx + dw * .8, dy + h * .18, 2.2, 2.2, '#f2ce75');
    ctx.fillStyle = '#f6e5c4'; ctx.fillRect(dx - 5, y + h * .84, dw + 10, 5);
    // Chimenea.
    roundedRect(x + w * .68, y + h * .045, w * .12, h * .17, 3); ctx.fillStyle = '#b36b4c'; ctx.fill();
    ctx.fillStyle = '#d69065'; ctx.fillRect(x + w * .665, y + h * .045, w * .15, h * .04);
    ctx.restore();
  }

  function drawTree(x, ground, scale) {
    ctx.save(); ctx.translate(x, ground); ctx.scale(scale, scale);
    fillEllipse(0, 0, 67, 12, '#4e794544');
    polygon([[-13, -4], [-8, -76], [8, -76], [15, -3]], '#805436');
    polygon([[-6, -8], [-3, -75], [4, -75], [7, -7]], '#a36a43');
    fillEllipse(-32, -98, 39, 43, '#4c8a4d');
    fillEllipse(9, -113, 45, 50, '#5d9b4e');
    fillEllipse(42, -89, 34, 38, '#468149');
    fillEllipse(-5, -133, 25, 26, '#76ad58');
    fillEllipse(-47, -104, 13, 16, '#6ca654');
    ctx.restore();
  }

  function drawBush(x, y, scale, hue = 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    fillEllipse(0, 1, 64, 13, '#4b774337');
    const colors = hue ? ['#668e4d', '#769d53', '#82a957'] : ['#47804a', '#58914b', '#68a150'];
    fillEllipse(-30, -12, 27, 23, colors[0]);
    fillEllipse(0, -21, 33, 30, colors[1]);
    fillEllipse(32, -12, 27, 23, colors[0]);
    fillEllipse(-6, -34, 19, 16, colors[2]);
    ctx.restore();
  }

  function drawFence(y) {
    ctx.save();
    ctx.globalAlpha = .83;
    ctx.fillStyle = '#f2e8c9'; ctx.fillRect(0, y + 13, width, 6);
    ctx.fillStyle = '#d8d0b1'; ctx.fillRect(0, y + 34, width, 5);
    const gap = Math.max(33, width / 23);
    for (let x = 8; x < width; x += gap) {
      polygon([[x, y + 5], [x + gap * .42, y - 4], [x + gap * .84, y + 5], [x + gap * .84, y + 42], [x, y + 42]], '#f5edcf');
      ctx.fillStyle = '#fff8df'; ctx.fillRect(x + gap * .12, y + 5, 2, 32);
    }
    ctx.restore();
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#9ed8e0'); sky.addColorStop(.48, '#d4e5b3'); sky.addColorStop(.49, '#98c96f'); sky.addColorStop(1, '#72ae55');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    const horizon = height * (width < 620 ? .34 : .4);
    // Luz del sol y nubes.
    const sx = width * .82, sy = height * .16;
    const sunGlow = ctx.createRadialGradient(sx, sy, 3, sx, sy, Math.min(width, height) * .17);
    sunGlow.addColorStop(0, '#fff2b577'); sunGlow.addColorStop(1, '#fff2b500');
    ctx.fillStyle = sunGlow; ctx.fillRect(sx - height * .2, sy - height * .2, height * .4, height * .4);
    fillEllipse(sx, sy, Math.min(24, width * .035), Math.min(24, width * .035), '#ffe59a');
    drawCloud(width * .55, height * .16, Math.min(1, width / 1000));
    drawCloud(width * .79, height * .3, Math.min(.78, width / 1250));
    drawCloud(width * .23, height * .12, Math.min(.72, width / 1300));

    // Jardín vecino y setos que dan profundidad.
    fillEllipse(width * .52, horizon + 16, width * .48, height * .07, '#80b76a');
    fillEllipse(width * .93, horizon + 13, width * .29, height * .075, '#78ae62');
    const houseW = Math.min(width * (width < 620 ? .34 : .235), 315);
    const houseH = Math.min(height * (width < 620 ? .32 : .37), 245);
    drawHouse(width * .055, Math.max(10, horizon - houseH * .84), houseW, houseH);
    drawTree(width * .91, horizon + 23, Math.min(1.05, width / 1150));
    drawBush(width * .39, horizon + 27, Math.min(1, width / 1300), 1);
    drawBush(width * .69, horizon + 30, Math.min(.87, width / 1380));

    drawFence(horizon + 14);
    // Césped con ondas de color y un par de matas al frente.
    const grass = ctx.createLinearGradient(0, horizon + 30, 0, height);
    grass.addColorStop(0, '#91c96e'); grass.addColorStop(.52, '#82bd5c'); grass.addColorStop(1, '#73ad50');
    ctx.fillStyle = grass; ctx.fillRect(0, horizon + 35, width, height - horizon - 35);
    fillEllipse(width * .16, height * .76, width * .35, height * .2, '#a0d2713a');
    fillEllipse(width * .86, height * .91, width * .36, height * .22, '#518d4630');

    // Delicadas briznas decorativas, fuera de las casillas.
    for (let i = 0; i < 38; i++) {
      const x = ((i * 137 + 41) % 997) / 997 * width;
      const y = horizon + 48 + ((i * 83 + 17) % 421) / 421 * Math.max(1, height - horizon - 60);
      ctx.strokeStyle = i % 2 ? '#e5f1a94a' : '#396f3d3a'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.quadraticCurveTo(x + 2, y, x + 4, y - 3); ctx.stroke();
    }
    return horizon;
  }

  function drawCellLabels() {
    if (!board) return;
    ctx.save();
    ctx.font = `500 ${Math.max(8, Math.min(10, board.cellWidth * .075))}px "DM Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#eff7d47c';
    for (let row = 0; row < ROWS; row++) {
      for (let column = 0; column < COLUMNS; column++) {
        const cx = board.x + (column + .5) * board.cellWidth;
        const cy = board.y + (row + .5) * board.cellHeight;
        ctx.fillText(`${row} · ${column}`, cx, cy);
      }
    }
    ctx.restore();
  }

  function drawBoard() {
    if (!board) return;
    const { x, y, width: bw, height: bh, cellWidth: cw, cellHeight: ch } = board;
    // Sombra proyectada sobre el césped.
    ctx.save();
    ctx.shadowColor = '#254c2c75'; ctx.shadowBlur = 21; ctx.shadowOffsetY = 12;
    roundedRect(x - 5, y - 5, bw + 10, bh + 10, 14); ctx.fillStyle = '#557d43'; ctx.fill();
    ctx.restore();
    roundedRect(x - 5, y - 5, bw + 10, bh + 10, 14); ctx.fillStyle = '#416e3a'; ctx.fill();
    roundedRect(x - 2, y - 2, bw + 4, bh + 4, 11); ctx.fillStyle = '#b7d27b'; ctx.fill();

    for (let row = 0; row < ROWS; row++) {
      for (let column = 0; column < COLUMNS; column++) {
        const cx = x + column * cw, cy = y + row * ch;
        const inset = 1.5;
        roundedRect(cx + inset, cy + inset, cw - inset * 2, ch - inset * 2, Math.min(6, ch * .1));
        ctx.fillStyle = (row + column) % 2 === 0 ? '#a0ca70' : '#96c369'; ctx.fill();
        // Sutil textura de césped dibujada dentro de cada casilla.
        ctx.strokeStyle = '#edf3bd32'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx + cw * .16, cy + ch * .75); ctx.lineTo(cx + cw * .18, cy + ch * .66); ctx.moveTo(cx + cw * .83, cy + ch * .27); ctx.lineTo(cx + cw * .85, cy + ch * .2); ctx.stroke();
        ctx.strokeStyle = '#56884b68'; ctx.lineWidth = 1;
        roundedRect(cx + inset, cy + inset, cw - inset * 2, ch - inset * 2, Math.min(6, ch * .1)); ctx.stroke();
      }
    }
    drawCellLabels();
    const active = hoveredCell || keyboardCell || pinnedCell;
    if (active && isValidCell(active.row, active.column)) drawHighlight(active.row, active.column);
    // Contorno exterior fino: estructura clara del 5 x 9.
    roundedRect(x - 2, y - 2, bw + 4, bh + 4, 11); ctx.strokeStyle = '#f2f5c9'; ctx.lineWidth = 2; ctx.stroke();
  }

  function drawHighlight(row, column) {
    const x = board.x + column * board.cellWidth, y = board.y + row * board.cellHeight;
    const pad = 2.2;
    roundedRect(x + pad, y + pad, board.cellWidth - pad * 2, board.cellHeight - pad * 2, Math.min(7, board.cellHeight * .11));
    ctx.fillStyle = '#fff7ab4a'; ctx.fill();
    ctx.strokeStyle = '#fff5a8'; ctx.lineWidth = 2.5; ctx.stroke();
    // Pequeño punto de mira sin tapar la casilla.
    const r = Math.max(4, Math.min(7, board.cellHeight * .09));
    fillEllipse(x + board.cellWidth - 11, y + 11, r, r, '#fff3a8');
    ctx.strokeStyle = '#54763e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + board.cellWidth - 11, y + 11, r + 2, 0, Math.PI * 2); ctx.stroke();
  }

  function drawScene() {
    if (!width || !height) return;
    const horizon = drawBackground();
    const boardWidth = width * (width < 620 ? .94 : .88);
    const cellWidth = boardWidth / COLUMNS;
    const cellHeight = Math.min(82, Math.max(width < 620 ? 38 : 34, Math.min(cellWidth * .59, height * .115)));
    const boardHeight = cellHeight * ROWS;
    const minY = horizon + height * .025;
    const maxY = height - boardHeight - Math.max(22, height * .04);
    const boardY = Math.max(minY, Math.min(height * (width < 620 ? .52 : .42), maxY));
    board = { x: (width - boardWidth) / 2, y: boardY, width: boardWidth, height: boardHeight, cellWidth, cellHeight };
    drawBoard();
  }

  function updateSelection(cell) {
    if (cell && !isValidCell(cell.row, cell.column)) cell = null;
    hoveredCell = cell;
    if (cell) {
      selectionTitle.textContent = `Fila ${cell.row} · Columna ${cell.column}`;
      selectionHint.textContent = `Casilla ${String(cell.row + 1).padStart(2, '0')} / ${String(cell.column + 1).padStart(2, '0')} — señalada`;
      coordValue.innerHTML = `${cell.row} <i>/</i> ${cell.column}`;
      coordDetail.textContent = 'fila · columna';
    } else if (!keyboardCell && !pinnedCell) {
      selectionTitle.textContent = 'Explora el tablero';
      selectionHint.textContent = 'Señala una casilla para ver sus coordenadas';
      coordValue.innerHTML = '— <i>/</i> —';
      coordDetail.textContent = 'fila · columna';
    }
    drawScene();
  }

  function buildTargets() {
    targets.replaceChildren();
    for (let row = 0; row < ROWS; row++) {
      for (let column = 0; column < COLUMNS; column++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cell-target';
        button.setAttribute('role', 'gridcell');
        button.setAttribute('aria-label', `Fila ${row}, columna ${column}`);
        button.dataset.row = String(row);
        button.dataset.column = String(column);
        button.addEventListener('pointerenter', event => {
          if (event.pointerType !== 'touch') { keyboardCell = null; pinnedCell = null; updateSelection({ row, column }); }
        });
        button.addEventListener('pointerleave', event => {
          if (event.pointerType !== 'touch' && document.activeElement !== button) updateSelection(null);
        });
        button.addEventListener('focus', () => {
          pinnedCell = null; keyboardCell = { row, column }; updateSelection(keyboardCell);
        });
        button.addEventListener('blur', () => {
          keyboardCell = null;
          if (!pinnedCell && !hoveredCell) updateSelection(null);
        });
        button.addEventListener('click', () => {
          pinnedCell = { row, column }; keyboardCell = null; updateSelection(pinnedCell);
        });
        targets.appendChild(button);
      }
    }
  }

  function resize() {
    const rect = scene.getBoundingClientRect();
    width = rect.width; height = rect.height;
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    targets.style.setProperty('--board-x', '0px');
    drawScene();
    syncTargets();
  }

  function syncTargets() {
    if (!board) return;
    targets.style.left = `${board.x}px`;
    targets.style.top = `${board.y}px`;
    targets.style.width = `${board.width}px`;
    targets.style.height = `${board.height}px`;
    targets.style.gridTemplateColumns = `repeat(${COLUMNS}, 1fr)`;
    targets.style.gridTemplateRows = `repeat(${ROWS}, 1fr)`;
  }

  // Coordenadas CSS locales: equivalen a las coordenadas del mundo de la escena.
  function screenToCellFromPointer(event) {
    const rect = canvas.getBoundingClientRect();
    return screenToCell(event.clientX - rect.left, event.clientY - rect.top);
  }

  buildTargets();
  new ResizeObserver(resize).observe(scene);
  window.addEventListener('resize', resize, { passive: true });
  resize();

})();
