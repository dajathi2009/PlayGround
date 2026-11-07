/** Procedural pea projectiles; all positions and speeds are canvas pixels. */
export class ProjectileSystem {
  constructor() {
    this.projectiles = [];
    this.nextId = 1;
    this.lastUpdateAt = null;
  }

  reset() {
    this.projectiles = [];
    this.nextId = 1;
    this.lastUpdateAt = null;
  }

  spawn({ x, y, row, damage, speed, ownerId }, now = performance.now()) {
    const projectile = {
      id: `projectile-${this.nextId++}`,
      x,
      y,
      row,
      damage,
      speed,
      ownerId,
      exists: true,
      radius: 7,
      spawnedAt: now,
    };
    this.projectiles.push(projectile);
    return projectile;
  }

  update(now, enemies, { left, top, cellW, cellH, width }, enemySystem) {
    const dt = this.lastUpdateAt === null ? 0 : Math.max(0, (now - this.lastUpdateAt) / 1000);
    this.lastUpdateAt = now;
    const active = [...enemies.values()].filter((enemy) => enemy.alive);
    for (const projectile of this.projectiles) {
      if (!projectile.exists) continue;
      const previousX = projectile.x;
      projectile.x += projectile.speed * dt;
      const radius = Math.max(4, cellW * 0.065);
      projectile.radius = radius;

      // Swept horizontal circle-vs-body test prevents fast peas from tunneling through clones.
      const candidates = active
        .filter((enemy) => enemy.row === projectile.row)
        .sort((a, b) => a.x - b.x);
      for (const enemy of candidates) {
        if (!enemy.alive) continue;
        const enemyX = left + enemy.x * cellW;
        const baseline = top + (enemy.row + 0.88) * cellH;
        const enemySize = cellH * 0.96;
        const hitLeft = enemyX - enemySize * 0.27 - radius;
        const hitRight = enemyX + enemySize * 0.27 + radius;
        const hitTop = baseline - enemySize * 0.91 - radius;
        const hitBottom = baseline - enemySize * 0.06 + radius;
        if (projectile.y < hitTop || projectile.y > hitBottom) continue;
        if (Math.max(previousX, projectile.x) < hitLeft || Math.min(previousX, projectile.x) > hitRight) continue;
        projectile.exists = false;
        enemySystem.damage(enemy.id, projectile.damage, now);
        break;
      }
      if (projectile.x - radius > width || projectile.x < left - cellW) projectile.exists = false;
    }
    this.projectiles = this.projectiles.filter((projectile) => projectile.exists);
  }
}
