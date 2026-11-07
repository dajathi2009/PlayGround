import { ResourceManager } from "./resource-manager.js";

export const PLANT_TYPES = Object.freeze({
  peashooter: Object.freeze({
    id: "peashooter",
    name: "Lanzaguisantes",
    cost: 100,
    health: 300,
    damage: 20,
    attackIntervalMs: 1500,
    projectileSpeed: 180,
    rechargeMs: 4200,
  }),
});

/** Owns plant data, board occupancy, resources, and card recharge state. */
export class PlantSystem {
  constructor(rows = 5, columns = 9, resources = 100) {
    this.rows = rows;
    this.columns = columns;
    this.resources = resources instanceof ResourceManager ? resources : new ResourceManager(resources);
    Object.defineProperty(this, "sun", { enumerable: true, get: () => this.resources.getBalance() });
    this.occupancy = Array.from({ length: rows }, () => Array(columns).fill(null));
    this.plants = new Map();
    this.cardReadyAt = new Map(Object.keys(PLANT_TYPES).map((type) => [type, 0]));
    this.nextId = 1;
  }

  getPlant(id) { return this.plants.get(id) ?? null; }
  getAt(row, column) {
    if (!this.isCellInBounds(row, column)) return null;
    const id = this.occupancy[row][column];
    return id ? this.getPlant(id) : null;
  }
  isCellInBounds(row, column) {
    return Number.isInteger(row) && Number.isInteger(column) &&
      row >= 0 && row < this.rows && column >= 0 && column < this.columns;
  }
  cooldownRemaining(type, now = performance.now()) {
    return Math.max(0, (this.cardReadyAt.get(type) ?? 0) - now);
  }
  canPlace(type, row, column, now = performance.now()) {
    const definition = PLANT_TYPES[type];
    if (!definition || !this.isCellInBounds(row, column)) return { ok: false, reason: "outside" };
    if (this.occupancy[row][column]) return { ok: false, reason: "occupied" };
    if (!this.resources.canBuyPlant(definition.cost)) return { ok: false, reason: "sun" };
    if (this.cooldownRemaining(type, now) > 0) return { ok: false, reason: "cooldown" };
    return { ok: true };
  }
  place(type, row, column, worldPosition, now = performance.now()) {
    const check = this.canPlace(type, row, column, now);
    if (!check.ok) return check;
    const definition = PLANT_TYPES[type];
    if (!this.resources.spend(definition.cost, `plant:${type}`)) return { ok: false, reason: "sun" };
    const id = `plant-${this.nextId++}`;
    const plant = {
      id,
      type,
      name: definition.name,
      cost: definition.cost,
      maxHealth: definition.health,
      health: definition.health,
      alive: true,
      damage: definition.damage,
      attackIntervalMs: definition.attackIntervalMs,
      projectileSpeed: definition.projectileSpeed,
      attackState: "IDLE",
      targetId: null,
      nextAttackAt: now,
      attackStartedAt: 0,
      row,
      column,
      worldPosition: { x: worldPosition.x, y: worldPosition.y },
      exists: true,
      animationState: "placing",
      animationStartedAt: now,
      rechargeMs: definition.rechargeMs,
    };
    this.occupancy[row][column] = id;
    this.plants.set(id, plant);
    this.cardReadyAt.set(type, now + definition.rechargeMs);
    return { ok: true, plant };
  }
  /** Starts the death animation and frees the board cell immediately. */
  remove(id, now = performance.now()) {
    const plant = this.getPlant(id);
    if (!plant || !plant.alive || plant.animationState === "disappearing") return false;
    plant.alive = false;
    plant.animationState = "disappearing";
    plant.animationStartedAt = now;
    plant.attackState = "IDLE";
    plant.targetId = null;
    if (this.occupancy[plant.row][plant.column] === id) this.occupancy[plant.row][plant.column] = null;
    return true;
  }
  damage(id, amount, now = performance.now()) {
    const plant = this.getPlant(id);
    if (!plant || !plant.alive) return false;
    plant.health = Math.max(0, plant.health - Math.max(0, amount));
    plant.hitAt = now;
    if (plant.health === 0) this.remove(id, now);
    return true;
  }
  update(now = performance.now()) {
    for (const [id, plant] of this.plants) {
      const age = now - plant.animationStartedAt;
      if (plant.animationState === "placing" && age >= 460) plant.animationState = "idle";
      if (plant.animationState === "disappearing" && age >= 360) {
        plant.exists = false;
        if (this.occupancy[plant.row][plant.column] === id) this.occupancy[plant.row][plant.column] = null;
        this.plants.delete(id);
      }
    }
  }
}
