// ── player.js ─────────────────────────────────────────────────────────
'use strict';

const CELL_SIZE = 28; // px per cell
const MOVE_INTERVAL = 120; // ms between moves

class Player {
  constructor(id, gridX, gridY, colorSet, isHuman) {
    this.id       = id;         // 1-based
    this.isHuman  = isHuman;
    this.color    = colorSet;

    // Grid position
    this.gx = gridX;
    this.gy = gridY;

    // Direction
    this.dx = 1;
    this.dy = 0;
    this.pendingDx = 1;
    this.pendingDy = 0;

    // Visual interpolation
    this.px = gridX * CELL_SIZE; // pixel position
    this.py = gridY * CELL_SIZE;
    this.prevPx = this.px;
    this.prevPy = this.py;

    this.alive = true;
    this.inTerritory = true; // whether currently on own territory
    this.trailLength = 0;

    this.score = 0;
    this.moveTimer = 0;
    this.moveInterval = MOVE_INTERVAL;

    // For smooth animation
    this.animT = 1; // 0 = just moved, 1 = arrived
  }

  get worldX() { return this.gx * CELL_SIZE + CELL_SIZE / 2; }
  get worldY() { return this.gy * CELL_SIZE + CELL_SIZE / 2; }

  // Returns interpolated screen-space center
  renderX(t) { return Utils.lerp(this.prevPx, this.px, t) + CELL_SIZE / 2; }
  renderY(t) { return Utils.lerp(this.prevPy, this.py, t) + CELL_SIZE / 2; }

  setDir(dx, dy) {
    // Cannot reverse
    if (dx === -this.dx && dy === -this.dy) return;
    this.pendingDx = dx;
    this.pendingDy = dy;
  }

  // Called each frame with delta ms; returns true when a grid step occurs
  tick(dt, grid, particles, onCapture) {
    if (!this.alive) return false;
    this.moveTimer += dt;
    if (this.moveTimer < this.moveInterval) {
      this.animT = Utils.clamp(this.moveTimer / this.moveInterval, 0, 1);
      return false;
    }
    this.moveTimer -= this.moveInterval;
    this.animT = 1;

    // Apply queued direction
    this.dx = this.pendingDx;
    this.dy = this.pendingDy;

    const nx = this.gx + this.dx;
    const ny = this.gy + this.dy;

    // Wall collision → clamp or kill
    if (!grid.inBounds(nx, ny)) {
      this.die(grid, particles);
      return false;
    }

    // Check if stepping on own trail → death
    if (grid.isTrailOf(nx, ny, this.id)) {
      this.die(grid, particles);
      return false;
    }

    // Move
    this.prevPx = this.px;
    this.prevPy = this.py;
    this.gx = nx;
    this.gy = ny;
    this.px = nx * CELL_SIZE;
    this.py = ny * CELL_SIZE;
    this.animT = 0;

    // Check state of new cell
    const isOwn = grid.isTerritory(nx, ny, this.id);

    if (isOwn && !this.inTerritory && this.trailLength > 0) {
      // Closed a loop — capture!
      this._capture(grid, particles, onCapture);
      this.inTerritory = true;
      this.trailLength = 0;
    } else if (isOwn) {
      this.inTerritory = true;
    } else {
      // Paint trail
      if (this.inTerritory) {
        // Just left territory
        this.inTerritory = false;
      }
      // Lay trail on this cell (even if it belonged to enemy)
      grid.setTrail(nx, ny, this.id);
      this.trailLength++;
    }

    return true;
  }

  _capture(grid, particles, onCapture) {
    // Convert our trail to territory
    grid.convertTrailToTerritory(this.id);

    // Flood fill to find enclosed cells
    const trailSet = grid.buildTrailSet(this.id); // empty now, but trail→territory already done, use territory set
    const territorySet = grid.buildTerritorySet(this.id);
    const interior = Utils.floodFillInterior(grid.width, grid.height, new Set(), territorySet, []);

    // Fill interior
    const gained = interior.length;
    grid.fillRegion(interior, this.id);
    this.score += gained * 10 + this.trailLength * 5;

    // Particles on captured cells
    if (particles) {
      const sample = interior.length > 80 ? interior.filter((_,i)=>i%4===0) : interior;
      for (const {x,y} of sample) {
        particles.burst(x * CELL_SIZE + CELL_SIZE/2, y * CELL_SIZE + CELL_SIZE/2, this.color.territory, 3);
      }
    }

    if (onCapture) onCapture(this);
  }

  die(grid, particles) {
    if (!this.alive) return;
    this.alive = false;
    // Particles on death
    if (particles) {
      particles.burst(this.worldX, this.worldY, this.color.trail, 20);
    }
    grid.clearPlayer(this.id);
  }
}
