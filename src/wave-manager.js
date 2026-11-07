import { ENEMY_TYPES } from "./enemy-system.js";
import { validateLevel } from "./wave-config.js";

export const WAVE_STATES = Object.freeze({
  PREPARING: "PREPARING",
  COUNTDOWN: "COUNTDOWN",
  SPAWNING: "SPAWNING",
  IN_PROGRESS: "IN_PROGRESS",
  FINAL_WAVE: "FINAL_WAVE",
  COMPLETED: "COMPLETED",
  DEFEAT: "DEFEAT",
});

const shuffle = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

/** Owns one complete match. It only advances after every scheduled enemy is gone. */
export class WaveManager {
  constructor(level, { spawnEnemy, enemySystem }) {
    validateLevel(level);
    this.level = level;
    this.spawnEnemy = spawnEnemy;
    this.enemySystem = enemySystem;
    this.totalWaves = level.waves.length;
    this.totalScheduled = level.waves.reduce((sum, wave) => sum + wave.count, 0);
    this.listeners = new Set();
    this.currentWave = 0;
    this.state = WAVE_STATES.PREPARING;
    this.wave = null;
    this.plan = [];
    this.spawnedEnemies = 0;
    this.aliveIds = new Set();
    this.waveStartIndex = 0;
    this.totalSpawned = 0;
    this.deadline = 0;
    this.nextSpawnAt = 0;
    this.lastCountdownSecond = null;
    this.started = false;
    this.pausedAt = null;
    this.stateChangedAt = 0;
    this.now = performance.now();
    this.message = "Preparando el jardín";
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  emit() {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  snapshot(now = this.now) {
    const effectiveNow = this.pausedAt ?? now;
    const remaining = [WAVE_STATES.PREPARING, WAVE_STATES.COUNTDOWN].includes(this.state)
      ? Math.max(0, this.deadline - effectiveNow) : 0;
    const pending = Math.max(0, (this.wave?.count ?? 0) - this.spawnedEnemies);
    return {
      state: this.state,
      currentWave: this.currentWave,
      totalWaves: this.totalWaves,
      scheduledEnemies: this.wave?.count ?? 0,
      spawnedEnemies: this.spawnedEnemies,
      aliveEnemies: this.aliveIds.size,
      pendingEnemies: pending,
      remainingTimeMs: remaining,
      totalScheduled: this.totalScheduled,
      totalSpawned: this.totalSpawned,
      progress: this.totalScheduled ? this.totalSpawned / this.totalScheduled : 0,
      isFinalWave: Boolean(this.wave?.final || this.currentWave === this.totalWaves),
      special: Boolean(this.wave?.special),
      paused: this.pausedAt !== null,
      stateChangedAt: this.stateChangedAt,
      message: this.message,
    };
  }

  setState(state, message, now) {
    this.state = state;
    this.message = message;
    this.stateChangedAt = now;
    this.lastCountdownSecond = null;
    this.emit();
  }

  reset(now = performance.now()) {
    this.now = now;
    this.currentWave = 0;
    this.state = WAVE_STATES.PREPARING;
    this.wave = null;
    this.plan = [];
    this.spawnedEnemies = 0;
    this.aliveIds.clear();
    this.waveStartIndex = 0;
    this.totalSpawned = 0;
    this.deadline = 0;
    this.nextSpawnAt = 0;
    this.lastCountdownSecond = null;
    this.started = false;
    this.pausedAt = null;
    this.stateChangedAt = now;
    this.message = "Preparando el jardín";
    this.emit();
  }

  start(now = performance.now()) {
    if (this.started) return false;
    this.now = now;
    this.started = true;
    this.activateWave(1, now);
    return true;
  }

  activateWave(number, now) {
    this.currentWave = number;
    this.wave = this.level.waves[number - 1];
    this.waveStartIndex = this.totalSpawned;
    this.spawnedEnemies = 0;
    this.aliveIds.clear();
    this.plan = [];
    this.deadline = now + this.wave.preparationMs;
    const message = number === 1 ? "Preparación inicial" : "Descanso: próxima oleada";
    this.setState(WAVE_STATES.COUNTDOWN, message, now);
  }

  buildPlan() {
    const wave = this.wave;
    const entries = [];
    for (const [type, count] of Object.entries(wave.enemyCounts)) {
      const permittedRows = wave.enemyRows?.[type] ?? wave.rows;
      if (!ENEMY_TYPES[type] || !permittedRows?.length) throw new Error(`Tipo o filas no válidos: ${type}`);
      for (let i = 0; i < count; i++) entries.push({ type, rows: permittedRows });
    }
    const order = shuffle(entries);
    const laneOrder = shuffle(wave.rows);
    const laneCounts = new Map(laneOrder.map((row) => [row, 0]));
    return order.map((entry, index) => {
      const lanes = entry.rows;
      // Cycle through permitted lanes for balanced coverage, with per-type restrictions honored.
      const compatible = laneOrder.filter((row) => lanes.includes(row));
      const candidates = compatible.length ? compatible : lanes;
      const minCount = Math.min(...candidates.map((row) => laneCounts.get(row) ?? 0));
      const leastUsed = candidates.filter((row) => (laneCounts.get(row) ?? 0) === minCount);
      const row = leastUsed[index % leastUsed.length];
      laneCounts.set(row, (laneCounts.get(row) ?? 0) + 1);
      return { type: entry.type, row };
    });
  }

  beginSpawning(now) {
    this.plan = this.buildPlan();
    this.nextSpawnAt = now;
    this.setState(WAVE_STATES.SPAWNING, this.currentWave === this.totalWaves ? "Oleada final" : "Oleada en marcha", now);
  }

  update(now = performance.now(), enemySystem = this.enemySystem) {
    this.now = now;
    if (!this.started || this.pausedAt !== null || [WAVE_STATES.COMPLETED, WAVE_STATES.DEFEAT].includes(this.state)) return;

    for (const id of [...this.aliveIds]) {
      const enemy = enemySystem.get(id);
      if (!enemy || !enemy.alive) {
        this.aliveIds.delete(id);
        this.emit();
        continue;
      }
      if (enemy.x <= this.level.defeatX) {
        this.end(WAVE_STATES.DEFEAT, "¡Invasión! El jardín ha caído", now);
        return;
      }
    }

    if (this.state === WAVE_STATES.COUNTDOWN) {
      const seconds = Math.ceil(Math.max(0, this.deadline - now) / 1000);
      if (seconds !== this.lastCountdownSecond) {
        this.lastCountdownSecond = seconds;
        this.emit();
      }
      if (now >= this.deadline) this.beginSpawning(now);
      return;
    }

    if ([WAVE_STATES.SPAWNING, WAVE_STATES.FINAL_WAVE].includes(this.state)) {
      if (this.spawnedEnemies < this.plan.length && now >= this.nextSpawnAt) {
        const next = this.plan[this.spawnedEnemies];
        const difficulty = this.wave.difficulty ?? {};
        const definition = ENEMY_TYPES[next.type];
        const result = this.spawnEnemy(next.type, next.row, this.level.spawnX, {
          maxHealth: Math.max(1, Math.round(definition.maxHealth * (difficulty.health ?? 1))),
          speed: definition.speed * (difficulty.speed ?? 1),
          damageResistance: difficulty.resistance ?? definition.damageResistance,
        }, now);
        if (result?.ok && result.enemy?.id && !this.aliveIds.has(result.enemy.id)) {
          this.aliveIds.add(result.enemy.id);
          this.spawnedEnemies += 1;
          this.totalSpawned += 1;
          this.nextSpawnAt = now + this.wave.intervalMs;
          if (this.currentWave === this.totalWaves) this.setState(WAVE_STATES.FINAL_WAVE, "¡OLEADA FINAL!", now);
          else this.emit();
        }
      }
      if (this.spawnedEnemies >= this.wave.count && this.aliveIds.size > 0 && this.state !== WAVE_STATES.IN_PROGRESS && this.state !== WAVE_STATES.FINAL_WAVE) {
        this.setState(WAVE_STATES.IN_PROGRESS, "Elimina a los enemigos restantes", now);
      }
    }

    const spawningFinished = this.spawnedEnemies === this.wave?.count && this.aliveIds.size === 0;
    if (spawningFinished) {
      if (this.currentWave >= this.totalWaves) {
        this.end(WAVE_STATES.COMPLETED, "¡Jardín defendido!", now);
      } else {
        this.activateWave(this.currentWave + 1, now);
      }
    }
  }

  end(state, message, now) {
    this.plan = [];
    this.aliveIds.clear();
    this.setState(state, message, now);
  }

  pause(now = this.now) {
    if (this.pausedAt !== null || [WAVE_STATES.COMPLETED, WAVE_STATES.DEFEAT].includes(this.state)) return false;
    this.now = now;
    this.pausedAt = now;
    this.emit();
    return true;
  }

  resume(now = this.now) {
    if (this.pausedAt === null) return 0;
    this.now = now;
    const elapsed = Math.max(0, now - this.pausedAt);
    if (this.deadline) this.deadline += elapsed;
    if (this.nextSpawnAt) this.nextSpawnAt += elapsed;
    this.pausedAt = null;
    this.emit();
    return elapsed;
  }
}
