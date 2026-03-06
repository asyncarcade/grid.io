// ── input.js ──────────────────────────────────────────────────────────
'use strict';

const Input = (() => {
  const keys = {};
  let pendingDir = null; // {dx,dy}

  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    // Map to direction (queue only one pending at a time)
    const map = {
      'ArrowUp':    {dx:0,dy:-1}, 'KeyW': {dx:0,dy:-1},
      'ArrowDown':  {dx:0,dy:1},  'KeyS': {dx:0,dy:1},
      'ArrowLeft':  {dx:-1,dy:0}, 'KeyA': {dx:-1,dy:0},
      'ArrowRight': {dx:1,dy:0},  'KeyD': {dx:1,dy:0},
    };
    if (map[e.code]) {
      pendingDir = map[e.code];
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  function consumeDir() {
    const d = pendingDir;
    pendingDir = null;
    return d;
  }

  return { keys, consumeDir };
})();
