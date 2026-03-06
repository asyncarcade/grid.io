// ── bot.js ────────────────────────────────────────────────────────────
'use strict';

const BOT_STATES = { EXPAND: 'expand', RETURN: 'return', ROAM: 'roam', HUNT: 'hunt' };

// Trail length thresholds — shorter loops = safer, more reliable captures
const TRAIL_SOFT_LIMIT = 22; // prefer returning soon
const TRAIL_HARD_LIMIT = 35; // force return

class Bot extends Player {
  constructor(id, gridX, gridY, colorSet) {
    super(id, gridX, gridY, colorSet, false);
    this.state         = BOT_STATES.EXPAND;
    this.thinkTimer    = 0;
    this.thinkInterval = MOVE_INTERVAL; // re-think every move step for sharp decisions
    this.stuckCount    = 0;

    // Planned expansion path: the bot picks a rectangular sweep target and
    // executes it step-by-step, falling back gracefully if blocked.
    this.expandPath    = [];   // [{dx,dy}, ...] queued moves
    this.expandTarget  = null; // {x,y} grid destination for current sweep leg
    this.huntTarget    = null;
  }

  think(grid, allPlayers) {
    // ── State transition logic ─────────────────────────────────────────
    if (this.trailLength >= TRAIL_HARD_LIMIT) {
      this.state = BOT_STATES.RETURN;
      this.expandPath = [];
    } else if (this.trailLength >= TRAIL_SOFT_LIMIT && !this.inTerritory) {
      // Soft limit: finish current queued move, then return
      if (this.expandPath.length === 0) this.state = BOT_STATES.RETURN;
    } else if (this.state === BOT_STATES.RETURN && this.inTerritory) {
      // Safely home — decide what to do next
      this.state = BOT_STATES.EXPAND;
      this.expandPath = [];
      this.expandTarget = null;
    }

    // ── Pick direction ─────────────────────────────────────────────────
    let dir;
    switch (this.state) {
      case BOT_STATES.RETURN: dir = this._dirReturn(grid); break;
      case BOT_STATES.EXPAND: dir = this._dirExpand(grid, allPlayers); break;
      case BOT_STATES.HUNT:   dir = this._dirHunt(grid, allPlayers); break;
      default:                dir = this._dirRoam(grid); break;
    }

    if (dir) this.setDir(dir.dx, dir.dy);
  }

  // ── Safety helpers ───────────────────────────────────────────────────

  _safeDir(grid, dx, dy, strict) {
    const nx = this.gx + dx, ny = this.gy + dy;
    if (!grid.inBounds(nx, ny)) return false;
    if (grid.isTrailOf(nx, ny, this.id)) return false;
    // Avoid enemy trails
    if (grid.getState(nx, ny) === 2 && grid.getOwner(nx, ny) !== this.id) return false;
    if (strict) {
      // Also avoid cells too close to arena edge
      const margin = 3;
      if (nx < margin || ny < margin || nx >= grid.width - margin || ny >= grid.height - margin) return false;
    }
    return true;
  }

  // All safe directions, excluding reversal
  _safeDirs(grid, strict) {
    return [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}].filter(d => {
      if (d.dx === -this.dx && d.dy === -this.dy) return false;
      return this._safeDir(grid, d.dx, d.dy, strict);
    });
  }

  // Score a cell for expansion desirability
  _cellScore(grid, x, y) {
    if (!grid.inBounds(x, y)) return -999;
    const s = grid.getState(x, y);
    const o = grid.getOwner(x, y);
    // Penalise edges
    const margin = 4;
    const edgePenalty = (x < margin || y < margin || x >= grid.width-margin || y >= grid.height-margin) ? -5 : 0;
    if (s === 0) return 4 + edgePenalty;           // empty = best
    if (s === 1 && o !== this.id) return 3 + edgePenalty; // enemy territory = good
    if (s === 1 && o === this.id) return -2;        // own territory = bad
    return 0 + edgePenalty;
  }

  // ── EXPAND: planned rectangular loop ─────────────────────────────────
  _dirExpand(grid, allPlayers) {
    // Consume pre-planned path first
    if (this.expandPath.length > 0) {
      const next = this.expandPath[0];
      if (this._safeDir(grid, next.dx, next.dy, false)) {
        this.expandPath.shift();
        return next;
      } else {
        // Path blocked — abort plan, fall through to replan
        this.expandPath = [];
        this.expandTarget = null;
      }
    }

    // If on own territory, plan a new rectangular expansion loop
    if (this.inTerritory) {
      const plan = this._planRectLoop(grid);
      if (plan && plan.length > 0) {
        this.expandPath = plan;
        const first = this.expandPath.shift();
        return first;
      }
      // No room for rect loop — opportunistic single-step expansion
    }

    // Opportunistic: pick best adjacent cell
    const safe = this._safeDirs(grid, false);
    if (!safe.length) {
      this.state = BOT_STATES.RETURN;
      return this._dirReturn(grid);
    }

    // Score and prefer moving away from own territory
    const ranked = safe.slice().sort((a, b) => {
      // Look ahead 3 cells for better scoring
      const sa = this._lookaheadScore(grid, a.dx, a.dy, 3);
      const sb = this._lookaheadScore(grid, b.dx, b.dy, 3);
      return sb - sa;
    });

    // Small random tiebreak to avoid loops
    if (ranked.length > 1 && Math.random() < 0.1) return ranked[1];
    return ranked[0];
  }

  // Look ahead N cells in a direction and sum cell scores
  _lookaheadScore(grid, dx, dy, depth) {
    let score = 0, x = this.gx, y = this.gy;
    for (let i = 0; i < depth; i++) {
      x += dx; y += dy;
      score += this._cellScore(grid, x, y);
    }
    return score;
  }

  // Plan a compact rectangular loop from current border-territory position.
  // Returns array of {dx,dy} moves forming a closed rectangle that re-enters
  // own territory — or null if not feasible.
  _planRectLoop(grid) {
    // Try different depths and widths; pick the best scoring one
    const candidates = [];
    const tryDirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];

    for (const outDir of tryDirs) {
      const perpOptions = (outDir.dx !== 0)
        ? [{dx:0,dy:1},{dx:0,dy:-1}]
        : [{dx:1,dy:0},{dx:-1,dy:0}];

      for (const perpDir of perpOptions) {
        for (let depth = 4; depth <= 10; depth += 2) {
          for (let width = 4; width <= 12; width += 2) {
            const path = this._buildRectPath(grid, outDir, perpDir, depth, width);
            if (path) {
              const score = this._scoreRectPath(grid, path);
              candidates.push({ path, score });
            }
          }
        }
      }
    }

    if (!candidates.length) return null;
    // Pick highest scoring plan
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].score > 0 ? candidates[0].path : null;
  }

  // Build a rectangle: go `depth` in outDir, `width` in perpDir,
  // back `depth` in -outDir, back `width` in -perpDir (to close).
  // Returns move array or null if any cell is dangerous.
  _buildRectPath(grid, outDir, perpDir, depth, width) {
    const moves = [];
    let cx = this.gx, cy = this.gy;

    const pushMoves = (d, steps) => {
      for (let i = 0; i < steps; i++) {
        const nx = cx + d.dx, ny = cy + d.dy;
        if (!grid.inBounds(nx, ny)) return false;
        // Can't cross own trail
        if (grid.isTrailOf(nx, ny, this.id)) return false;
        // Can't cross enemy trail
        if (grid.getState(nx, ny) === 2 && grid.getOwner(nx, ny) !== this.id) return false;
        moves.push(d);
        cx = nx; cy = ny;
      }
      return true;
    };

    const back1 = {dx:-outDir.dx, dy:-outDir.dy};
    const back2 = {dx:-perpDir.dx, dy:-perpDir.dy};

    if (!pushMoves(outDir, depth))  return null;
    if (!pushMoves(perpDir, width)) return null;
    if (!pushMoves(back1, depth))   return null;
    if (!pushMoves(back2, width))   return null;

    return moves;
  }

  // Score a path by how many non-own cells it would enclose (rough estimate)
  _scoreRectPath(grid, moves) {
    let score = 0;
    let cx = this.gx, cy = this.gy;
    for (const d of moves) {
      cx += d.dx; cy += d.dy;
      score += this._cellScore(grid, cx, cy);
    }
    return score;
  }

  // ── RETURN: BFS back to own territory ────────────────────────────────
  _dirReturn(grid) {
    const best = this._bfsToTerritory(grid);
    if (best) return best;
    const safe = this._safeDirs(grid, false);
    return safe.length ? safe[0] : {dx:this.dx, dy:this.dy};
  }

  // ── ROAM (fallback) ───────────────────────────────────────────────────
  _dirRoam(grid) {
    const safe = this._safeDirs(grid, false);
    if (!safe.length) {
      // Desperate: allow reversals
      const all = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}]
        .filter(d => grid.inBounds(this.gx+d.dx, this.gy+d.dy) && !grid.isTrailOf(this.gx+d.dx, this.gy+d.dy, this.id));
      return all.length ? Utils.randFrom(all) : {dx:this.dx,dy:this.dy};
    }
    if (Math.random() < 0.2) this.state = BOT_STATES.EXPAND;
    return Utils.randFrom(safe);
  }

  // ── HUNT: chase enemy trailing players ───────────────────────────────
  _dirHunt(grid, allPlayers) {
    // Re-evaluate target validity
    if (this.huntTarget && (!this.huntTarget.alive || this.huntTarget.trailLength === 0)) {
      this.huntTarget = null;
    }
    if (!this.huntTarget) {
      let best = null, bestD = Infinity;
      for (const p of allPlayers) {
        if (p.id === this.id || !p.alive || p.trailLength < 5) continue;
        const d = Utils.dist2(this.gx, this.gy, p.gx, p.gy);
        if (d < bestD) { bestD = d; best = p; }
      }
      if (!best || bestD > 625) { this.state = BOT_STATES.EXPAND; return this._dirExpand(grid, allPlayers); }
      this.huntTarget = best;
    }
    return this._moveToward(grid, this.huntTarget.gx, this.huntTarget.gy);
  }

  // ── BFS to nearest own territory cell ────────────────────────────────
  _bfsToTerritory(grid) {
    const visited = new Set();
    const queue   = [];
    const dirs    = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];

    visited.add(this.gx + ',' + this.gy);

    for (const d of dirs) {
      const nx = this.gx + d.dx, ny = this.gy + d.dy;
      if (!grid.inBounds(nx, ny)) continue;
      if (grid.isTrailOf(nx, ny, this.id)) continue;
      if (grid.getState(nx, ny) === 2 && grid.getOwner(nx, ny) !== this.id) continue;
      const k = nx + ',' + ny;
      if (!visited.has(k)) { visited.add(k); queue.push({x:nx, y:ny, fd:d}); }
    }

    let qi = 0;
    while (qi < queue.length) {
      const {x, y, fd} = queue[qi++];
      if (grid.isTerritory(x, y, this.id)) return fd;
      for (const d of dirs) {
        const nx = x + d.dx, ny = y + d.dy;
        if (!grid.inBounds(nx, ny)) continue;
        if (grid.isTrailOf(nx, ny, this.id)) continue;
        if (grid.getState(nx, ny) === 2 && grid.getOwner(nx, ny) !== this.id) continue;
        const k = nx + ',' + ny;
        if (!visited.has(k)) { visited.add(k); queue.push({x:nx, y:ny, fd}); }
      }
      if (qi > 500) break;
    }
    return null;
  }

  // ── Move toward a grid target ─────────────────────────────────────────
  _moveToward(grid, tx, ty) {
    const safe = this._safeDirs(grid, false);
    if (!safe.length) return {dx:this.dx, dy:this.dy};
    return safe.slice().sort((a, b) => {
      const da = Utils.dist2(this.gx + a.dx, this.gy + a.dy, tx, ty);
      const db = Utils.dist2(this.gx + b.dx, this.gy + b.dy, tx, ty);
      return da - db;
    })[0];
  }
}

Bot.prototype.constructor = Bot;
Utils.Math_random = Math.random.bind(Math);
