import { ENEMY_TYPES } from "./enemy-system.js";

/** Level-owned wave data. Counts, lanes, pacing, and stat changes are all explicit here. */
export const TEST_LEVEL = Object.freeze({
  id: "jardin-de-prueba",
  rows: 5,
  spawnX: 9.65,
  defeatX: 0,
  waves: Object.freeze([
    { count: 2, enemyCounts: { basicClone: 2 }, rows: [0, 1, 2, 3, 4], intervalMs: 3000, preparationMs: 10000, special: false, difficulty: { speed: 1, health: 1, resistance: 0 } },
    { count: 3, enemyCounts: { basicClone: 3 }, rows: [0, 1, 2, 3, 4], intervalMs: 3000, preparationMs: 8000, special: false, difficulty: { speed: 1.03, health: 1, resistance: 0 } },
    { count: 4, enemyCounts: { basicClone: 4 }, rows: [0, 1, 2, 3, 4], intervalMs: 3000, preparationMs: 8000, special: false, difficulty: { speed: 1.06, health: 1.05, resistance: 0 } },
    { count: 5, enemyCounts: { basicClone: 5 }, rows: [0, 1, 2, 3, 4], intervalMs: 3000, preparationMs: 8000, special: false, difficulty: { speed: 1.09, health: 1.1, resistance: 0 } },
    { count: 8, enemyCounts: { basicClone: 8 }, rows: [0, 1, 2, 3, 4], intervalMs: 3000, preparationMs: 8000, special: true, final: true, difficulty: { speed: 1.12, health: 1.15, resistance: 0 } },
  ]),
});

export function validateLevel(level) {
  if (!level || !Array.isArray(level.waves) || level.waves.length === 0) throw new Error("El nivel debe definir al menos una oleada.");
  for (const [index, wave] of level.waves.entries()) {
    const configuredCount = Object.values(wave.enemyCounts ?? {}).reduce((sum, count) => sum + count, 0);
    if (!Number.isInteger(wave.count) || wave.count < 1 || configuredCount !== wave.count) {
      throw new Error(`La oleada ${index + 1} debe tener una cantidad exacta en enemyCounts.`);
    }
    if (!Number.isFinite(wave.intervalMs) || wave.intervalMs < 0 || !Number.isFinite(wave.preparationMs) || wave.preparationMs < 0) {
      throw new Error(`La oleada ${index + 1} tiene tiempos no válidos.`);
    }
    if (!Array.isArray(wave.rows) || wave.rows.length === 0 || wave.rows.some((row) => !Number.isInteger(row) || row < 0 || row >= level.rows)) {
      throw new Error(`La oleada ${index + 1} debe definir filas válidas.`);
    }
    for (const [type, count] of Object.entries(wave.enemyCounts)) {
      if (!ENEMY_TYPES[type] || !Number.isInteger(count) || count < 0) throw new Error(`Composición no válida en oleada ${index + 1}.`);
    }
  }
  return true;
}
