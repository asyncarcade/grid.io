// ── utils.js ──────────────────────────────────────────────────────────
'use strict';

const Utils = (() => {
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function randFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function dist2(ax, ay, bx, by) { const dx=ax-bx,dy=ay-by; return dx*dx+dy*dy; }

  // Flood-fill to find interior cells when a loop is closed
  // Returns array of {x,y} cells that are inside the loop polygon
  function floodFillInterior(gridW, gridH, trailSet, territorySet, startCells) {
    // BFS from all border cells, cells not reached are interior
    const outside = new Uint8Array(gridW * gridH);
    const queue = [];

    const idx = (x,y) => y * gridW + x;
    const blocked = (x,y) => trailSet.has(idx(x,y)) || territorySet.has(idx(x,y));

    // Seed all border cells
    for (let x = 0; x < gridW; x++) {
      if (!blocked(x,0)) { outside[idx(x,0)]=1; queue.push(x,0); }
      if (!blocked(x,gridH-1)) { outside[idx(x,gridH-1)]=1; queue.push(x,gridH-1); }
    }
    for (let y = 1; y < gridH-1; y++) {
      if (!blocked(0,y)) { outside[idx(0,y)]=1; queue.push(0,y); }
      if (!blocked(gridW-1,y)) { outside[idx(gridW-1,y)]=1; queue.push(gridW-1,y); }
    }

    let qi = 0;
    while (qi < queue.length) {
      const x = queue[qi++], y = queue[qi++];
      const neighbors = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
      for (const [nx,ny] of neighbors) {
        if (nx<0||ny<0||nx>=gridW||ny>=gridH) continue;
        const ni = idx(nx,ny);
        if (!outside[ni] && !blocked(nx,ny)) {
          outside[ni] = 1;
          queue.push(nx, ny);
        }
      }
    }

    // Interior = not outside, not blocked
    const interior = [];
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const i = idx(x,y);
        if (!outside[i] && !blocked(x,y)) interior.push({x,y});
      }
    }
    return interior;
  }

  // Generate distinct neon-ish player colors
  const PLAYER_COLORS = [
    { territory: '#1a3aff', trail: '#4d6fff', light: 'rgba(77,111,255,0.25)' }, // blue (human)
    { territory: '#ff2d55', trail: '#ff6b81', light: 'rgba(255,45,85,0.25)' },
    { territory: '#34c759', trail: '#6de38b', light: 'rgba(52,199,89,0.25)' },
    { territory: '#ff9f0a', trail: '#ffcc60', light: 'rgba(255,159,10,0.25)' },
    { territory: '#bf5af2', trail: '#d68fff', light: 'rgba(191,90,242,0.25)' },
    { territory: '#00c7be', trail: '#5aeae5', light: 'rgba(0,199,190,0.25)' },
    { territory: '#ff6b35', trail: '#ff9970', light: 'rgba(255,107,53,0.25)' },
    { territory: '#e8e000', trail: '#f5f06e', light: 'rgba(232,224,0,0.25)' },
  ];

  return { clamp, lerp, randInt, randFrom, dist2, floodFillInterior, PLAYER_COLORS };
})();
