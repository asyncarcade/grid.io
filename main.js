// ── main.js ───────────────────────────────────────────────────────────
'use strict';

(function () {
  const canvas   = document.getElementById('gameCanvas');
  const minimap  = document.getElementById('minimap');

  let game = null;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    if (game) game.resize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);
  resize();

  function startGame() {
    document.getElementById('screen-start').classList.add('hidden');
    document.getElementById('screen-gameover').classList.add('hidden');
    document.getElementById('screen-win').classList.add('hidden');
    document.getElementById('ui-overlay').style.display = 'block';

    if (game) game.stop();
    game = new Game(canvas, minimap);

    game.onGameOver(({ territory, score, time }) => {
      document.getElementById('go-territory').textContent = territory + '%';
      document.getElementById('go-score').textContent     = score;
      document.getElementById('go-time').textContent      = time + 's';
      document.getElementById('screen-gameover').classList.remove('hidden');
    });

    game.onWin(({ territory, score }) => {
      document.getElementById('win-territory').textContent = territory + '%';
      document.getElementById('win-score').textContent     = score;
      document.getElementById('screen-win').classList.remove('hidden');
    });

    game.start();
  }

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-restart').addEventListener('click', startGame);
  document.getElementById('btn-win-restart').addEventListener('click', startGame);

  // Keyboard shortcut to start
  window.addEventListener('keydown', e => {
    if (e.code === 'Enter' || e.code === 'Space') {
      const start = document.getElementById('screen-start');
      const over  = document.getElementById('screen-gameover');
      const win   = document.getElementById('screen-win');
      if (!start.classList.contains('hidden')) startGame();
      if (!over.classList.contains('hidden'))  startGame();
      if (!win.classList.contains('hidden'))   startGame();
    }
  });
})();
