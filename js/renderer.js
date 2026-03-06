// ── renderer.js ───────────────────────────────────────────────────────
'use strict';

// ── Particle System ────────────────────────────────────────────────────
class ParticleSystem {
  constructor() { this.particles = []; }

  burst(wx, wy, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2.5;
      this.particles.push({
        x: wx, y: wy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1, decay: 0.025 + Math.random() * 0.04,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  update(dt) {
    const factor = dt / 16;
    this.particles = this.particles.filter(p => {
      p.x += p.vx * factor;
      p.y += p.vy * factor;
      p.vy += 0.04 * factor;
      p.life -= p.decay * factor;
      return p.life > 0;
    });
  }

  draw(ctx, camX, camY) {
    for (const p of this.particles) {
      ctx.globalAlpha = p.life * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - camX, p.y - camY, p.size * p.life, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ── Main Renderer ──────────────────────────────────────────────────────
class Renderer {
  constructor(canvas, minimapCanvas) {
    this.canvas    = canvas;
    this.ctx       = canvas.getContext('2d');
    this.mmCanvas  = minimapCanvas;
    this.mmCtx     = minimapCanvas.getContext('2d');
    this.particles = new ParticleSystem();

    // Off-screen territory/trail cache
    this._offCanvas  = document.createElement('canvas');
    this._offCtx     = this._offCanvas.getContext('2d');
    this._dirty      = true; // rebuild off-screen
  }

  resize(w, h) {
    this.canvas.width  = w;
    this.canvas.height = h;
    this._dirty = true;
  }

  markDirty() { this._dirty = true; }

  render(grid, players, camera, animT) {
    const ctx = this.ctx;
    const cs  = CELL_SIZE;
    const { minCx, minCy, maxCx, maxCy } = camera.visibleCells(grid.width, grid.height);

    // Clear
    ctx.fillStyle = '#0a0b12';
    ctx.fillRect(0, 0, camera.canvasW, camera.canvasH);

    // Draw grid cells
    this._drawGrid(ctx, grid, camera, minCx, minCy, maxCx, maxCy, cs);

    // Draw players
    this._drawPlayers(ctx, players, camera, animT, cs);

    // Particles
    this.particles.update(16);
    this.particles.draw(ctx, camera.x, camera.y);

    // Grid lines (faint)
    this._drawGridLines(ctx, camera, minCx, minCy, maxCx, maxCy, cs);

    // Minimap
    this._drawMinimap(grid, players);
  }

  _drawGrid(ctx, grid, camera, minCx, minCy, maxCx, maxCy, cs) {
    const colors = Utils.PLAYER_COLORS;
    const camX = camera.x, camY = camera.y;

    for (let y = minCy; y <= maxCy; y++) {
      for (let x = minCx; x <= maxCx; x++) {
        const sx = x * cs - camX;
        const sy = y * cs - camY;
        const i = grid.idx(x, y);
        const state = grid.state[i];
        if (state === 0) continue;
        const owner = grid.owner[i];
        const col   = colors[owner - 1];
        if (!col) continue;

        if (state === 1) {
          // Territory — filled + subtle inner glow
          ctx.fillStyle = col.territory + '55'; // translucent base
          ctx.fillRect(sx, sy, cs, cs);
          // Brighter center square
          ctx.fillStyle = col.territory + '99';
          ctx.fillRect(sx+2, sy+2, cs-4, cs-4);
        } else {
          // Trail
          ctx.fillStyle = col.trail;
          ctx.fillRect(sx, sy, cs, cs);
          // Glowing trail highlight
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(sx+3, sy+3, cs-6, cs-6);
        }
      }
    }
  }

  _drawGridLines(ctx, camera, minCx, minCy, maxCx, maxCy, cs) {
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    const camX = camera.x, camY = camera.y;
    ctx.beginPath();
    for (let x = minCx; x <= maxCx+1; x++) {
      const sx = x * cs - camX;
      ctx.moveTo(sx, minCy*cs-camY);
      ctx.lineTo(sx, (maxCy+1)*cs-camY);
    }
    for (let y = minCy; y <= maxCy+1; y++) {
      const sy = y * cs - camY;
      ctx.moveTo(minCx*cs-camX, sy);
      ctx.lineTo((maxCx+1)*cs-camX, sy);
    }
    ctx.stroke();
  }

  _drawPlayers(ctx, players, camera, animT, cs) {
    for (const p of players) {
      if (!p.alive) continue;
      const rx = p.renderX(animT) - camera.x;
      const ry = p.renderY(animT) - camera.y;
      const col = p.color;
      const r   = cs * 0.38;

      // Outer glow
      const grad = ctx.createRadialGradient(rx, ry, r*0.1, rx, ry, r*1.8);
      grad.addColorStop(0, col.trail + 'cc');
      grad.addColorStop(1, col.trail + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(rx, ry, r*1.8, 0, Math.PI*2);
      ctx.fill();

      // Player circle
      ctx.fillStyle = col.trail;
      ctx.beginPath();
      ctx.arc(rx, ry, r, 0, Math.PI*2);
      ctx.fill();

      // White highlight
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(rx - r*0.25, ry - r*0.25, r*0.3, 0, Math.PI*2);
      ctx.fill();

      // Human indicator (ring)
      if (p.isHuman) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rx, ry, r + 5, 0, Math.PI*2);
        ctx.stroke();
      }

      // Direction arrow
      const ax = rx + p.dx * r * 1.5;
      const ay = ry + p.dy * r * 1.5;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(ax, ay, 3, 0, Math.PI*2);
      ctx.fill();
    }
  }

  _drawMinimap(grid, players) {
    const mm  = this.mmCanvas;
    const ctx = this.mmCtx;
    const W   = mm.width, H = mm.height;
    const gw  = grid.width, gh = grid.height;
    const sx  = W / gw, sy = H / gh;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0,0,W,H);

    const colors = Utils.PLAYER_COLORS;
    const n = gw * gh;
    for (let i = 0; i < n; i++) {
      const s = grid.state[i];
      if (s === 0) continue;
      const o = grid.owner[i];
      const col = colors[o-1];
      if (!col) continue;
      const gx = i % gw, gy = Math.floor(i / gw);
      ctx.fillStyle = s===1 ? col.territory : col.trail;
      ctx.fillRect(gx*sx, gy*sy, Math.max(1,sx), Math.max(1,sy));
    }

    // Draw player dots
    for (const p of players) {
      if (!p.alive) continue;
      ctx.fillStyle = '#fff';
      ctx.fillRect(p.gx*sx-1, p.gy*sy-1, 3, 3);
    }
  }
}
