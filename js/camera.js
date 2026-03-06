// ── camera.js ─────────────────────────────────────────────────────────
'use strict';

class Camera {
  constructor(canvasW, canvasH, cellSize) {
    this.x = 0; // world-space top-left
    this.y = 0;
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.cellSize = cellSize;
    this.smoothX = 0;
    this.smoothY = 0;
  }

  resize(w, h) { this.canvasW = w; this.canvasH = h; }

  // Follow a target in world pixels
  follow(targetWorldX, targetWorldY, dt) {
    const tx = targetWorldX - this.canvasW / 2;
    const ty = targetWorldY - this.canvasH / 2;
    const speed = Utils.clamp(dt * 8, 0, 1);
    this.x = Utils.lerp(this.x, tx, speed);
    this.y = Utils.lerp(this.y, ty, speed);
  }

  // Convert world pixel to screen
  worldToScreen(wx, wy) {
    return { sx: wx - this.x, sy: wy - this.y };
  }

  // Get visible cell range
  visibleCells(gridW, gridH) {
    const cs = this.cellSize;
    const minCx = Math.max(0, Math.floor(this.x / cs) - 1);
    const minCy = Math.max(0, Math.floor(this.y / cs) - 1);
    const maxCx = Math.min(gridW - 1, Math.ceil((this.x + this.canvasW) / cs) + 1);
    const maxCy = Math.min(gridH - 1, Math.ceil((this.y + this.canvasH) / cs) + 1);
    return { minCx, minCy, maxCx, maxCy };
  }
}
