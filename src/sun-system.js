import { SUN_CONFIG } from "./sun-config.js";

/** Owns all collectible sun objects and their independent, clock-based lifetimes. */
export class SunSystem {
  constructor(config = SUN_CONFIG) {
    this.config = config;
    this.suns = new Map();
    this.producers = new Map();
    this.nextId = 1;
    this.nextAmbientAt = null;
    this.random = Math.random;
  }

  randomAmbientDelay() {
    const [min, max] = this.config.ambientIntervalMs;
    return min + this.random() * (max - min);
  }

  spawn({ x, y = 0, targetY = y, source = "ambient", now = performance.now(), falling = true } = {}) {
    const id = `sun-${this.nextId++}`;
    this.suns.set(id, {
      id, x, y, startY: y, targetY, source, spawnedAt: now,
      landedAt: null, collectedAt: null, expiredAt: null,
      falling, collected: false, expired: false,
      phase: this.random() * Math.PI * 2,
    });
    return id;
  }

  /** Register a future plant producer: position may be an object or a function. */
  registerProducer(id, { quantity = this.config.quantityPerSpawn, intervalMs = 10000, position } = {}) {
    if (!id || !Number.isFinite(intervalMs) || intervalMs <= 0) return false;
    this.producers.set(id, { quantity: Math.max(1, Math.floor(quantity)), intervalMs, position, nextAt: null });
    return true;
  }
  unregisterProducer(id) { return this.producers.delete(id); }

  update(now, bounds) {
    if (this.nextAmbientAt === null) this.nextAmbientAt = now + this.randomAmbientDelay();
    if (now >= this.nextAmbientAt) {
      const count = this.config.quantityPerSpawn;
      for (let i = 0; i < count; i++) {
        const x = bounds.left + this.random() * bounds.width;
        const targetY = bounds.top + this.random() * bounds.height;
        this.spawn({ x, y: -this.config.radius * 2, targetY, now, source: "ambient", falling: true });
      }
      this.nextAmbientAt = now + this.randomAmbientDelay();
    }

    for (const [id, producer] of this.producers) {
      if (producer.nextAt === null) producer.nextAt = now + producer.intervalMs;
      if (now < producer.nextAt) continue;
      const sourcePosition = typeof producer.position === "function" ? producer.position() : producer.position;
      if (sourcePosition && Number.isFinite(sourcePosition.x) && Number.isFinite(sourcePosition.y)) {
        for (let i = 0; i < producer.quantity; i++) {
          this.spawn({
            x: sourcePosition.x + (i - (producer.quantity - 1) / 2) * this.config.radius * 1.5,
            y: sourcePosition.y, targetY: sourcePosition.y - this.config.radius * 1.4,
            now, source: `plant:${id}`, falling: false,
          });
        }
      }
      producer.nextAt = now + producer.intervalMs;
    }

    for (const [id, sun] of this.suns) {
      if (sun.falling && sun.landedAt === null) {
        const progress = Math.min(1, (now - sun.spawnedAt) / this.config.fallDurationMs);
        const eased = 1 - (1 - progress) ** 3;
        sun.y = sun.startY + (sun.targetY - sun.startY) * eased;
        if (progress >= 1) {
          sun.y = sun.targetY;
          sun.falling = false;
          sun.landedAt = now;
          sun.expiresAt = now + this.config.availableMs;
        }
      } else if (!sun.falling && !sun.collected && !sun.expired && sun.expiresAt === undefined) {
        sun.landedAt = now;
        sun.expiresAt = now + this.config.availableMs;
      }
      if (!sun.collected && !sun.expired && sun.expiresAt !== undefined && now >= sun.expiresAt) {
        sun.expired = true;
        sun.expiredAt = now;
      }
      if ((sun.collected && now - sun.collectedAt >= this.config.collectDurationMs) ||
          (sun.expired && now - sun.expiredAt >= 300)) this.suns.delete(id);
    }
  }

  collect(id, now = performance.now()) {
    const sun = this.suns.get(id);
    if (!sun || sun.collected || sun.expired) return null;
    sun.collected = true;
    sun.collectedAt = now;
    return sun;
  }
}
