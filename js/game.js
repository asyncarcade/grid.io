// ── game.js ───────────────────────────────────────────────────────────
'use strict';

const GRID_W    = 160;
const GRID_H    = 160;
const NUM_BOTS  = 7;
const START_TERRITORY_RADIUS = 4;

class Game {
  constructor(canvas, minimapCanvas) {
    this.canvas       = canvas;
    this.renderer     = new Renderer(canvas, minimapCanvas);
    this.grid         = new Grid(GRID_W, GRID_H);
    this.players      = [];
    this.human        = null;
    this.camera       = new Camera(canvas.width, canvas.height, CELL_SIZE);
    this.running      = false;
    this.lastTime     = 0;
    this.startTime    = 0;
    this.totalCells   = GRID_W * GRID_H;

    this._raf         = null;
    this._onGameOver  = null;
    this._onWin       = null;
  }

  onGameOver(fn) { this._onGameOver = fn; }
  onWin(fn)      { this._onWin = fn; }

  start() {
    this._init();
    this.running   = true;
    this.lastTime  = performance.now();
    this.startTime = this.lastTime;
    this._raf = requestAnimationFrame(ts => this._loop(ts));
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  _init() {
    this.grid   = new Grid(GRID_W, GRID_H);
    this.players = [];

    // Spread players evenly
    const positions = this._spreadPositions(NUM_BOTS + 1, GRID_W, GRID_H, 30);

    // Human player — id=1
    const hp = positions[0];
    this.human = new Player(1, hp.x, hp.y, Utils.PLAYER_COLORS[0], true);
    this._seedTerritory(this.human, START_TERRITORY_RADIUS);
    this.players.push(this.human);

    // Bots
    for (let i = 0; i < NUM_BOTS; i++) {
      const bp  = positions[i+1];
      const bot = new Bot(i+2, bp.x, bp.y, Utils.PLAYER_COLORS[i+1]);
      bot.moveInterval = MOVE_INTERVAL + Utils.randInt(-20, 30);
      this._seedTerritory(bot, START_TERRITORY_RADIUS);
      this.players.push(bot);
    }

    // Camera snap to human
    const h = this.human;
    this.camera.x = h.worldX - this.canvas.width/2;
    this.camera.y = h.worldY - this.canvas.height/2;
    this.camera.follow(h.worldX, h.worldY, 1);
  }

  _spreadPositions(count, gw, gh, minDist) {
    const result = [];
    const margin = 15;
    let attempts = 0;
    while (result.length < count && attempts < 10000) {
      attempts++;
      const x = Utils.randInt(margin, gw - margin);
      const y = Utils.randInt(margin, gh - margin);
      let ok = true;
      for (const p of result) {
        if (Utils.dist2(x,y,p.x,p.y) < minDist*minDist) { ok=false; break; }
      }
      if (ok) result.push({x,y});
    }
    return result;
  }

  _seedTerritory(player, radius) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx*dx+dy*dy > radius*radius) continue;
        const cx = player.gx + dx;
        const cy = player.gy + dy;
        if (this.grid.inBounds(cx, cy)) {
          this.grid.setTerritory(cx, cy, player.id);
        }
      }
    }
    // Make sure player starts on own territory
    player.inTerritory = true;
  }

  _loop(timestamp) {
    if (!this.running) return;
    const dt = Math.min(timestamp - this.lastTime, 100);
    this.lastTime = timestamp;

    this._update(dt);
    this._render();

    this._raf = requestAnimationFrame(ts => this._loop(ts));
  }

  _update(dt) {
    // Human input
    const dir = Input.consumeDir();
    if (dir && this.human.alive) this.human.setDir(dir.dx, dir.dy);

    const particles = this.renderer.particles;

    for (const p of this.players) {
      if (!p.alive) continue;

      // Bot AI think
      if (!p.isHuman) {
        p.thinkTimer += dt;
        if (p.thinkTimer >= p.thinkInterval) {
          p.thinkTimer -= p.thinkInterval;
          p.think(this.grid, this.players);
        }
      }

      // Move
      const stepped = p.tick(dt, this.grid, particles, null);

      if (stepped && p.alive) {
        // Collision check: did this player step on another player's trail?
        const cell = this.grid.idx(p.gx, p.gy);
        // Already handled own trail in player.tick
        // Check: another player's trail
        const cellOwner = this.grid.owner[cell];
        const cellState = this.grid.state[cell];

        // Edge case: stepping INTO an enemy's trail cell
        if (cellState === 2 && cellOwner !== p.id) {
          // The trail owner gets credit (not implemented as kill, but the stepper dies)
          p.die(this.grid, particles);
        }

        // Check: did this player's movement land on the path of another player's body position?
        for (const other of this.players) {
          if (other.id === p.id || !other.alive) continue;
          if (other.gx === p.gx && other.gy === p.gy) {
            // Head-on: both die
            p.die(this.grid, particles);
            other.die(this.grid, particles);
          }
        }
      }
    }

    // Camera follow human
    if (this.human.alive) {
      this.camera.follow(this.human.worldX, this.human.worldY, dt/1000);
    }

    // Update HUD
    let timestamp = this.lastTime;
    this._updateHUD(timestamp);

    // Win/lose checks
    const alivePlayers = this.players.filter(p => p.alive);
    if (!this.human.alive) {
      this.stop();
      const elapsed = (timestamp - this.startTime) / 1000;
      if (this._onGameOver) this._onGameOver({
        territory: this._territoryPct(this.human),
        score: this.human.score,
        time: elapsed.toFixed(0),
      });
      return;
    }
    if (alivePlayers.length === 1 && alivePlayers[0].isHuman) {
      this.stop();
      if (this._onWin) this._onWin({
        territory: this._territoryPct(this.human),
        score: this.human.score,
      });
    }
  }

  _render() {
    this.renderer.render(this.grid, this.players, this.camera, 1);
  }

  _territoryPct(player) {
    const count = this.grid.countTerritory(player.id);
    return ((count / this.totalCells) * 100).toFixed(1);
  }

  _updateHUD(timestamp) {
    const pct = this._territoryPct(this.human);
    document.getElementById('territory-bar').style.width = pct + '%';
    document.getElementById('territory-pct').textContent  = pct + '%';
    document.getElementById('score-value').textContent    = this.human.score;

    // Rank: sort players by territory
    const alive = this.players.filter(p=>p.alive);
    alive.sort((a,b)=>this.grid.countTerritory(b.id)-this.grid.countTerritory(a.id));
    const rank = alive.findIndex(p=>p.id===this.human.id)+1;
    document.getElementById('rank-value').textContent = '#'+rank;
  }

  resize(w, h) {
    this.renderer.resize(w, h);
    this.camera.resize(w, h);
  }
}
