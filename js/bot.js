// ── bot.js ────────────────────────────────────────────────────────────
'use strict';

const BOT_STATES = { EXPAND: 'expand', RETURN: 'return', ROAM: 'roam', HUNT: 'hunt' };
const MAX_TRAIL  = 10; // return home if trail exceeds this

class Bot extends Player {
  constructor(id, gridX, gridY, colorSet) {
    super(id, gridX, gridY, colorSet, false);
    this.state       = BOT_STATES.ROAM;
    this.thinkTimer  = 0;
    this.thinkInterval = Utils.randInt(3, 6) * MOVE_INTERVAL;
    this.targetX     = gridX;
    this.targetY     = gridY;
    this.roamDir     = { dx: Utils.randFrom([-1,1]), dy: 0 };
    this.stuckCount  = 0;
  }

  think(grid, allPlayers) {
    // State transitions
    if (this.trailLength >= MAX_TRAIL) {
      this.state = BOT_STATES.RETURN;
    } else if (this.state === BOT_STATES.RETURN && this.inTerritory) {
      this.state = Utils.Math_random() < 0.4 ? BOT_STATES.EXPAND : BOT_STATES.ROAM;
    }

    // Pick direction based on state
    let dir;
    switch (this.state) {
      case BOT_STATES.RETURN: dir = this._dirReturn(grid); break;
      case BOT_STATES.EXPAND: dir = this._dirExpand(grid); break;
      case BOT_STATES.HUNT:   dir = this._dirHunt(grid, allPlayers); break;
      default:                dir = this._dirRoam(grid); break;
    }

    if (dir) this.setDir(dir.dx, dir.dy);
  }

  _safeDir(grid, dx, dy) {
    const nx = this.gx + dx;
    const ny = this.gy + dy;
    if (!grid.inBounds(nx, ny)) return false;
    if (grid.isTrailOf(nx, ny, this.id)) return false;
    // Avoid other player trails (dangerous)
    const s = grid.getState(nx, ny);
    if (s === 2 && grid.getOwner(nx, ny) !== this.id) return false;
    return true;
  }

  _scoredDirs(grid) {
    const dirs = [
      {dx:1,dy:0}, {dx:-1,dy:0}, {dx:0,dy:1}, {dx:0,dy:-1}
    ];
    return dirs.filter(d => {
      // can't reverse
      if (d.dx === -this.dx && d.dy === -this.dy) return false;
      return this._safeDir(grid, d.dx, d.dy);
    });
  }

  _dirReturn(grid) {
    // Head back to nearest own territory
    const best = this._bfsToTerritory(grid);
    if (best) return best;
    // fallback: safest available dir
    const safe = this._scoredDirs(grid);
    return safe.length ? safe[0] : {dx:this.dx,dy:this.dy};
  }

  _dirExpand(grid) {
    // Prefer moving away from own territory to claim more
    const safe = this._scoredDirs(grid);
    if (!safe.length) {
      this.state = BOT_STATES.ROAM;
      return {dx:this.dx,dy:this.dy};
    }
    // Prefer empty or enemy territory cells
    const ranked = safe.sort((a,b) => {
      const va = this._cellValue(grid, this.gx+a.dx, this.gy+a.dy);
      const vb = this._cellValue(grid, this.gx+b.dx, this.gy+b.dy);
      return vb - va;
    });
    return ranked[0];
  }

  _cellValue(grid, x, y) {
    if (!grid.inBounds(x,y)) return -100;
    const s = grid.getState(x,y);
    const o = grid.getOwner(x,y);
    if (s === 0) return 3;           // empty = good
    if (s === 1 && o !== this.id) return 2; // enemy territory = great
    if (s === 1 && o === this.id) return -1; // own territory = bad
    return 0;
  }

  _dirRoam(grid) {
    // Try to continue in roam direction, or turn
    if (this._safeDir(grid, this.roamDir.dx, this.roamDir.dy) &&
        !(this.roamDir.dx === -this.dx && this.roamDir.dy === -this.dy)) {
      this.stuckCount = 0;
      return this.roamDir;
    }
    // Try to turn
    const safe = this._scoredDirs(grid);
    if (safe.length) {
      this.roamDir = Utils.randFrom(safe);
      this.stuckCount = 0;
      // Random chance to switch to expand
      if (Math.random() < 0.15) this.state = BOT_STATES.EXPAND;
      return this.roamDir;
    }
    this.stuckCount++;
    if (this.stuckCount > 5) {
      // Force random direction including reverse
      const all = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
      const valid = all.filter(d=>grid.inBounds(this.gx+d.dx,this.gy+d.dy)&&!grid.isTrailOf(this.gx+d.dx,this.gy+d.dy,this.id));
      if (valid.length) {
        this.stuckCount=0;
        return Utils.randFrom(valid);
      }
    }
    return {dx:this.dx,dy:this.dy};
  }

  _dirHunt(grid, allPlayers) {
    // Find nearest enemy trail and head toward it
    let best = null, bestD = Infinity;
    for (const p of allPlayers) {
      if (p.id === this.id || !p.alive || p.trailLength === 0) continue;
      const d = Utils.dist2(this.gx, this.gy, p.gx, p.gy);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (!best || bestD > 400) { this.state = BOT_STATES.ROAM; return this._dirRoam(grid); }
    return this._moveToward(grid, best.gx, best.gy);
  }

  _bfsToTerritory(grid) {
    // BFS from current position to nearest own territory cell
    // Returns first direction to take
    const visited = new Set();
    const queue = []; // [x, y, firstDir]
    const start = this.gx + ',' + this.gy;
    visited.add(start);
    const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];

    for (const d of dirs) {
      if (d.dx===-this.dx&&d.dy===-this.dy) continue;
      const nx=this.gx+d.dx, ny=this.gy+d.dy;
      if (!grid.inBounds(nx,ny)) continue;
      if (grid.isTrailOf(nx,ny,this.id)) continue;
      const k=nx+','+ny;
      if (!visited.has(k)) { visited.add(k); queue.push({x:nx,y:ny,fd:d}); }
    }

    let qi=0;
    while (qi<queue.length) {
      const {x,y,fd} = queue[qi++];
      if (grid.isTerritory(x,y,this.id)) return fd;
      for (const d of dirs) {
        const nx=x+d.dx, ny=y+d.dy;
        if (!grid.inBounds(nx,ny)) continue;
        if (grid.isTrailOf(nx,ny,this.id)) continue;
        // avoid enemy trails
        if (grid.getState(nx,ny)===2&&grid.getOwner(nx,ny)!==this.id) continue;
        const k=nx+','+ny;
        if (!visited.has(k)) { visited.add(k); queue.push({x:nx,y:ny,fd}); }
      }
      if (qi>300) break; // search limit
    }
    return null;
  }

  _moveToward(grid, tx, ty) {
    const safe = this._scoredDirs(grid);
    if (!safe.length) return {dx:this.dx,dy:this.dy};
    return safe.sort((a,b) => {
      const da = Utils.dist2(this.gx+a.dx, this.gy+a.dy, tx, ty);
      const db = Utils.dist2(this.gx+b.dx, this.gy+b.dy, tx, ty);
      return da-db;
    })[0];
  }
}

// Patch Math.random alias used in bot
Bot.prototype.constructor = Bot;
Utils.Math_random = Math.random.bind(Math);
