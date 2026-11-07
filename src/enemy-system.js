export const ENEMY_TYPES = Object.freeze({
  basicClone: Object.freeze({
    id: "basicClone",
    name: "Clon básico de Z-Corp",
    kind: "humanoid",
    maxHealth: 180,
    speed: 0.42,
    attackDamage: 0,
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

/** Tracks lane-bound enemies and recognizes plants without applying damage. */
export class EnemySystem {
  constructor(rows = 5) {
    this.rows = rows;
    this.enemies = new Map();
    this.nextId = 1;
    this.lastUpdateAt = null;
  }

  spawn(type, row, x = 9.65, overrides = {}, now = performance.now()) {
    const definition = ENEMY_TYPES[type];
    if (!definition || !Number.isInteger(row) || row < 0 || row >= this.rows) return { ok: false, reason: "invalid" };
    const id = `enemy-${this.nextId++}`;
    const enemy = {
      id,
      type,
      name: definition.name,
      kind: definition.kind,
      maxHealth: overrides.maxHealth ?? definition.maxHealth,
      health: overrides.health ?? overrides.maxHealth ?? definition.maxHealth,
      speed: Math.max(0, overrides.speed ?? definition.speed),
      attackDamage: overrides.attackDamage ?? definition.attackDamage,
      row,
      x: overrides.x ?? x,
      state: STATES.SPAWNING,
      direction: -1,
      animation: "spawn",
      target: null,
      spawnedAt: now,
      stateStartedAt: now,
      interactionDistance: definition.interactionDistance,
      detectionDistance: definition.detectionDistance,
    };
    this.enemies.set(id, enemy);
    return { ok: true, enemy };
  }

  get(id) { return this.enemies.get(id) ?? null; }

  update(now = performance.now(), plants = []) {
    const dt = this.lastUpdateAt === null ? 0 : Math.min(0.1, Math.max(0, (now - this.lastUpdateAt) / 1000));
    this.lastUpdateAt = now;
    const activePlants = plants.filter((plant) => plant.exists && plant.animationState !== "disappearing");

    for (const enemy of this.enemies.values()) {
      if (enemy.state === STATES.DEAD || enemy.state === STATES.DYING || enemy.state === STATES.DAMAGED) continue;
      if (enemy.state === STATES.SPAWNING) {
        enemy.animation = "spawn";
        if (now - enemy.spawnedAt >= ENEMY_TYPES[enemy.type].spawnDuration) {
          enemy.state = STATES.WALKING;
          enemy.animation = "walk";
          enemy.stateStartedAt = now;
        }
        continue;
      }

      const plant = activePlants
        .filter((item) => item.row === enemy.row && item.column + 0.5 < enemy.x)
        .sort((a, b) => b.column - a.column)[0] ?? null;

      if (!plant) {
        enemy.target = null;
        enemy.state = STATES.WALKING;
        enemy.animation = "walk";
        enemy.x += enemy.direction * enemy.speed * dt;
        continue;
      }

      enemy.target = plant.id;
      const distance = enemy.x - (plant.column + 0.5);
      if (distance <= enemy.interactionDistance) {
        enemy.x = plant.column + 0.5 + enemy.interactionDistance;
        enemy.state = STATES.ATTACKING;
        enemy.animation = "attack-idle";
      } else {
        enemy.state = STATES.DETECTING;
        enemy.animation = "detect";
        const step = Math.min(distance - enemy.interactionDistance, enemy.speed * dt);
        enemy.x -= step;
        if (distance - step <= enemy.interactionDistance) {
          enemy.x = plant.column + 0.5 + enemy.interactionDistance;
          enemy.state = STATES.ATTACKING;
          enemy.animation = "attack-idle";
        }
      }
    }
  }
}

export { STATES as ENEMY_STATES };
