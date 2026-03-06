// ── sound.js ──────────────────────────────────────────────────────────
'use strict';

const Sound = (() => {
  let ctx = null;
  let masterGain = null;
  let enabled = true;

  // Lazily create AudioContext on first user gesture
  function _init() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.35;
      masterGain.connect(ctx.destination);
      return true;
    } catch (e) {
      enabled = false;
      return false;
    }
  }

  function _resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // ── Low-level helpers ──────────────────────────────────────────────

  function _osc(type, freq, startTime, duration, gainVal, detune) {
    if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (detune) osc.detune.setValueAtTime(detune, startTime);
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  function _noise(startTime, duration, gainVal, filterFreq) {
    if (!ctx) return;
    const bufSize = ctx.sampleRate * duration;
    const buf  = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src    = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain   = ctx.createGain();

    src.buffer = buf;
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq || 800;
    filter.Q.value = 0.8;

    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start(startTime);
    src.stop(startTime + duration + 0.01);
  }

  // ── Sound effects ──────────────────────────────────────────────────

  // Short tick on direction change
  function turn() {
    if (!enabled || !_init()) return;
    _resume();
    const t = ctx.currentTime;
    _osc('square', 660, t, 0.045, 0.18);
    _osc('square', 880, t + 0.02, 0.035, 0.10);
  }

  // Soft blip each move step (optional, very quiet)
  function step() {
    if (!enabled || !_init()) return;
    _resume();
    const t = ctx.currentTime;
    _osc('sine', 200, t, 0.025, 0.04);
  }

  // Area captured — rising arpeggio chord
  function capture(cellCount) {
    if (!enabled || !_init()) return;
    _resume();
    const t = ctx.currentTime;
    const big = cellCount > 50;
    const notes = big
      ? [523, 659, 784, 1047, 1319]
      : [440, 554, 659, 880];
    notes.forEach((freq, i) => {
      _osc('sine',     freq,       t + i * 0.06, 0.35, 0.22);
      _osc('triangle', freq * 2,   t + i * 0.06, 0.20, 0.08);
    });
    // Shimmer noise burst
    _noise(t, 0.12, 0.15 * (big ? 1.4 : 1), 3000);
  }

  // An enemy bot is killed
  function kill() {
    if (!enabled || !_init()) return;
    _resume();
    const t = ctx.currentTime;
    _osc('sawtooth', 220, t,        0.15, 0.25);
    _osc('sawtooth', 110, t + 0.05, 0.20, 0.22);
    _osc('sawtooth',  55, t + 0.12, 0.25, 0.18);
    _noise(t, 0.18, 0.2, 400);
  }

  // Human player is eliminated
  function playerDie() {
    if (!enabled || !_init()) return;
    _resume();
    const t = ctx.currentTime;
    // Descending tone sweep
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.9);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 1.0);
    // Noise crash
    _noise(t, 0.5, 0.35, 300);
  }

  // Game over screen
  function gameOver() {
    if (!enabled || !_init()) return;
    _resume();
    const t = ctx.currentTime;
    // Slow descending minor chord
    [220, 261, 311].forEach((freq, i) => {
      _osc('sine', freq, t + i * 0.15, 1.2, 0.18);
    });
    _noise(t + 0.1, 0.6, 0.12, 200);
  }

  // Victory fanfare
  function victory() {
    if (!enabled || !_init()) return;
    _resume();
    const t = ctx.currentTime;
    const fanfare = [
      [523, 0.00], [523, 0.12], [523, 0.24],
      [659, 0.36], [784, 0.50], [1047, 0.68],
    ];
    for (const [freq, delay] of fanfare) {
      _osc('sine',     freq,     t + delay, 0.28, 0.30);
      _osc('triangle', freq * 2, t + delay, 0.15, 0.10);
    }
    _noise(t + 0.68, 0.35, 0.18, 4000);
  }

  // Enemy enters your territory (warning ping)
  function warning() {
    if (!enabled || !_init()) return;
    _resume();
    const t = ctx.currentTime;
    _osc('sine', 880, t,        0.06, 0.15);
    _osc('sine', 880, t + 0.10, 0.06, 0.12);
  }

  return { turn, step, capture, kill, playerDie, gameOver, victory, warning };
})();
