/* ===========================================================
   main.js — bootstrap + fixed-ish game loop
   =========================================================== */
(function () {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  window.GAME = game; // handy for debugging

  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;              // avoid huge jumps after tab switch
    try {
      if (game.phase !== 'title' && game.phase !== 'over') {
        game.step(dt);
      } else {
        // keep crowd & idle guys alive on menus
        game.time += dt;
        for (const u of game.units) u.update(dt, game);
        game._updateParticles(dt);
      }
      game.render();
    } catch (err) {
      // never let a single frame error freeze the whole game
      console.error('frame error:', err);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
