// ── grid.js ───────────────────────────────────────────────────────────
'use strict';

class Grid {
  constructor(width, height) {
    this.width  = width;
    this.height = height;
    // owner[i] = playerId (1-8) or 0 = empty
    // state[i] = 0=empty, 1=territory, 2=trail
    this.owner = new Uint8Array(width * height);
    this.state = new Uint8Array(width * height);
  }

  idx(x, y) { return y * this.width + x; }

  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }

  getOwner(x, y) { return this.owner[this.idx(x,y)]; }
  getState(x, y) { return this.state[this.idx(x,y)]; }

  setTerritory(x, y, playerId) {
    const i = this.idx(x, y);
    this.owner[i] = playerId;
    this.state[i] = 1;
  }

  setTrail(x, y, playerId) {
    const i = this.idx(x, y);
    this.owner[i] = playerId;
    this.state[i] = 2;
  }

  clear(x, y) {
    const i = this.idx(x, y);
    this.owner[i] = 0;
    this.state[i] = 0;
  }

  isTerritory(x, y, playerId) {
    const i = this.idx(x,y);
    return this.state[i] === 1 && this.owner[i] === playerId;
  }

  isTrail(x, y) { return this.state[this.idx(x,y)] === 2; }
  isTrailOf(x, y, playerId) {
    const i = this.idx(x,y);
    return this.state[i] === 2 && this.owner[i] === playerId;
  }
  isAnyTrail(x, y) { return this.state[this.idx(x,y)] === 2; }
  isEmpty(x, y) { return this.state[this.idx(x,y)] === 0; }

  // Count territory cells for a player
  countTerritory(playerId) {
    let count = 0;
    const n = this.width * this.height;
    for (let i = 0; i < n; i++) {
      if (this.owner[i] === playerId && this.state[i] === 1) count++;
    }
    return count;
  }

  // Convert all trail cells of a player to territory
  convertTrailToTerritory(playerId) {
    const n = this.width * this.height;
    for (let i = 0; i < n; i++) {
      if (this.owner[i] === playerId && this.state[i] === 2) {
        this.state[i] = 1;
      }
    }
  }

  // Clear all cells belonging to a player
  clearPlayer(playerId) {
    const n = this.width * this.height;
    for (let i = 0; i < n; i++) {
      if (this.owner[i] === playerId) {
        this.owner[i] = 0;
        this.state[i] = 0;
      }
    }
  }

  // Remove enemy territory in a filled region and replace with playerId territory
  fillRegion(cells, playerId) {
    for (const {x,y} of cells) {
      const i = this.idx(x,y);
      this.owner[i] = playerId;
      this.state[i] = 1;
    }
  }

  // Clear trail of player (used on death or territory reconnect before fill)
  clearTrail(playerId) {
    const n = this.width * this.height;
    for (let i = 0; i < n; i++) {
      if (this.owner[i] === playerId && this.state[i] === 2) {
        this.owner[i] = 0;
        this.state[i] = 0;
      }
    }
  }

  // Build set of all trail indices for flood fill
  buildTrailSet(playerId) {
    const s = new Set();
    const n = this.width * this.height;
    for (let i = 0; i < n; i++) {
      if (this.state[i] === 2 && this.owner[i] === playerId) s.add(i);
    }
    return s;
  }

  buildTerritorySet(playerId) {
    const s = new Set();
    const n = this.width * this.height;
    for (let i = 0; i < n; i++) {
      if (this.state[i] === 1 && this.owner[i] === playerId) s.add(i);
    }
    return s;
  }
}
