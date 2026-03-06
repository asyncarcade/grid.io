// ── input.js ──────────────────────────────────────────────────────────
'use strict';

const Input = (() => {
  const keys = {};
  let pendingDir = null; // {dx,dy}

  // ── Keyboard ──────────────────────────────────────────────────────────
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
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

  // ── Touch / Swipe ─────────────────────────────────────────────────────
  const MIN_SWIPE_PX = 18; // minimum swipe distance to register
  let touchStartX = 0;
  let touchStartY = 0;
  let touchActive = false;

  window.addEventListener('touchstart', e => {
    // Only track single-finger swipes
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchActive = true;
    // Don't preventDefault here — allow taps on buttons to work
  }, { passive: true });

  window.addEventListener('touchmove', e => {
    if (!touchActive || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist >= MIN_SWIPE_PX) {
      // Determine dominant axis
      if (Math.abs(dx) >= Math.abs(dy)) {
        pendingDir = dx > 0 ? {dx:1,dy:0} : {dx:-1,dy:0};
      } else {
        pendingDir = dy > 0 ? {dx:0,dy:1} : {dx:0,dy:-1};
      }
      // Reset origin so continuous dragging keeps turning
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      e.preventDefault(); // prevent scroll while swiping on canvas
    }
  }, { passive: false });

  window.addEventListener('touchend', () => { touchActive = false; }, { passive: true });
  window.addEventListener('touchcancel', () => { touchActive = false; }, { passive: true });

  // ── API ───────────────────────────────────────────────────────────────
  function consumeDir() {
    const d = pendingDir;
    pendingDir = null;
    return d;
  }

  return { keys, consumeDir };
})();
