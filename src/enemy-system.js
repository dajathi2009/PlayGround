export const ENEMY_TYPES = Object.freeze({
  basicClone: Object.freeze({
    id: "basicClone",
    name: "Clon básico de Z-Corp",
    kind: "humanoid",
    maxHealth: 100,
    speed: 15,
    attackDamage: 20,
    attackIntervalMs: 1000,
    damageResistance: 0,
    interactionDistance: 0.78,
    detectionDistance: 1.45,
    spawnDuration: 620,
  }),
});

const STATES = Object.freeze({
  SPAWNING: "SPAWNING",
  WALKING: "WALKING",
  DETECTING: "DETECTING",
  ATTACKING: "ATTACKING",
  DAMAGED: "DAMAGED",
  DYING: "DYING",
  DEAD: "DEAD",
});

/** Owns active enemies and short-lived death animations. Positions are in board-cell units. */
export class EnemySystem {
  constructor(rows = 5) {
    this.rows = rows;
    this.enemies = new Map();
    this.corpses = new Map();
    this.nextId = 1;
    this.lastUpdateAt = null;
  }

  spawn(type, row, x = 9.65, overrides = {}, now = performance.now()) {
    const definition = ENEMY_TYPES[type];
    if (!definition || !Number.isInteger(row) || row < 0 || row >= this.rows) return { ok: false, reason: "invalid" };
    const id = `enemy-${this.nextId++}`;
    const maxHealth = Math.max(1, overrides.maxHealth ?? definition.maxHealth);
    const enemy = {
      id,
      type,
      name: definition.name,
      kind: definition.kind,
      maxHealth,
      health: Math.min(maxHealth, Math.max(0, overrides.health ?? maxHealth)),
      damageResistance: Math.max(0, overrides.damageResistance ?? definition.damageResistance),
      alive: true,
      speed: Math.max(0, overrides.speed ?? definition.speed),
      attackDamage: Math.max(0, overrides.attackDamage ?? definition.attackDamage),
      attackIntervalMs: Math.max(1, overrides.attackIntervalMs ?? definition.attackIntervalMs),
      row,
      x: overrides.x ?? x,
      state: STATES.SPAWNING,
      direction: -1,
      animation: "spawn",
      target: null,
      spawnedAt: now,
      stateStartedAt: now,
      nextAttackAt: now,
      damagedUntil: 0,
      interactionDistance: overrides.interactionDistance ?? definition.interactionDistance,
      detectionDistance: overrides.detectionDistance ?? definition.detectionDistance,
    };
    this.enemies.set(id, enemy);
    return { ok: true, enemy };
  }

  get(id) { return this.enemies.get(id) ?? null; }

  damage(id, amount, now = performance.now()) {
    const enemy = this.get(id);
    if (!enemy || !enemy.alive) return false;
    const applied = Math.max(0, amount - enemy.damageResistance);
    if (applied <= 0) return true;
    enemy.health = Math.max(0, enemy.health - applied);
    enemy.hitAt = now;
    if (enemy.health === 0) {
      enemy.alive = false;
      enemy.state = STATES.DYING;
      enemy.animation = "death";
      enemy.stateStartedAt = now;
      enemy.target = null;
      this.enemies.delete(id);
      this.corpses.set(id, enemy);
    } else {
      enemy.damagedUntil = now + 150;
      enemy.state = STATES.DAMAGED;
      enemy.animation = "damaged";
    }
    return true;
  }

  update(now = performance.now(), plants = [], plantSystem = null, cellWidth = 100) {
    const dt = this.lastUpdateAt === null ? 0 : Math.min(0.1, Math.max(0, (now - this.lastUpdateAt) / 1000));
    this.lastUpdateAt = now;
    const activePlants = plants.filter((plant) => plant.alive && plant.animationState !== "disappearing");

    for (const enemy of [...this.enemies.values()]) {
      if (!enemy.alive) continue;
      if (enemy.state === STATES.SPAWNING) {
        enemy.animation = "spawn";
        if (now - enemy.spawnedAt >= ENEMY_TYPES[enemy.type].spawnDuration) {
          enemy.state = STATES.WALKING;
          enemy.animation = "walk";
          enemy.stateStartedAt = now;
        }
        continue;
      }
      if (enemy.state === STATES.DAMAGED) {
        if (now < enemy.damagedUntil) continue;
        enemy.state = STATES.WALKING;
        enemy.animation = "walk";
      }

      // Plants expose boardX derived from their current rendered position, not just their cell index.
      const plant = activePlants
        .filter((item) => item.row === enemy.row && item.boardX < enemy.x)
        .sort((a, b) => b.boardX - a.boardX)[0] ?? null;

      if (!plant) {
        enemy.target = null;
        enemy.state = STATES.WALKING;
        enemy.animation = "walk";
        enemy.x += enemy.direction * enemy.speed * dt / Math.max(1, cellWidth);
        continue;
      }

      enemy.target = plant.id;
      const distance = enemy.x - plant.boardX;
      if (distance <= enemy.interactionDistance) {
        enemy.x = plant.boardX + enemy.interactionDistance;
        enemy.state = STATES.ATTACKING;
        enemy.animation = now < enemy.nextAttackAt ? "attack-idle" : "attack";
        if (now >= enemy.nextAttackAt) {
          plantSystem?.damage(plant.id, enemy.attackDamage, now);
          enemy.nextAttackAt = now + enemy.attackIntervalMs;
        }
      } else {
        enemy.state = distance < enemy.detectionDistance ? STATES.DETECTING : STATES.WALKING;
        enemy.animation = enemy.state === STATES.DETECTING ? "detect" : "walk";
        const step = Math.min(distance - enemy.interactionDistance, enemy.speed * dt / Math.max(1, cellWidth));
        enemy.x -= step;
        if (distance - step <= enemy.interactionDistance) {
          enemy.x = plant.boardX + enemy.interactionDistance;
          enemy.state = STATES.ATTACKING;
          enemy.animation = "attack";
          if (now >= enemy.nextAttackAt) {
            plantSystem?.damage(plant.id, enemy.attackDamage, now);
            enemy.nextAttackAt = now + enemy.attackIntervalMs;
          }
        }
      }
    }
    for (const [id, enemy] of this.corpses) {
      if (now - enemy.stateStartedAt >= 650) this.corpses.delete(id);
    }
  }
}

export { STATES as ENEMY_STATES };
