/* ===========================================================
   art.js — procedural pixel-art sprites + arena rendering
   Sprites are tiny char-maps drawn as chunky pixels so we ship
   zero image assets. Accessories (weapons, legs, wings) are drawn
   in code so they can animate.  Global: ART
   =========================================================== */

const ART = (() => {

  // A sprite = { w, h, rows:[...strings] }. Palette is passed at draw
  // time so we can recolor the same body per class/enemy.
  function S(rows) { return { w: rows[0].length, h: rows.length, rows }; }

  // --- LIL GUY body (9 x 13). Legs come from the sprite, weapon from code.
  // chars: . transparent, O outline, H helmet, P plume, S skin, E eye,
  //        T tunic, B belt, L leg
  const GUY = S([
    "...PP....",
    "..PPPP...",
    "..OOOO...",
    ".OHHHHO..",
    ".OHHHHO..",
    ".OSEESO..",
    ".OSSSSO..",
    "..TTTT...",
    ".TTTTTT..",
    ".BTTTTB..",
    "..T..T...",
    "..L..L...",
    "..O..O...",
  ]);

  // A chunkier body for the TANK (11 x 13)
  const TANK = S([
    "...OOO.....",
    "..OHHHO....",
    ".OHHHHHO...",
    ".OSEE ESO..".replace(' ', 'S'),
    ".OSSSSSSO..",
    "..OTTTTO...",
    ".OTTTTTTO..",
    "OTTTTTTTTO.",
    "OBTTTTTTBO.",
    ".OTTTTTTO..",
    "..T....T...",
    "..L....L...",
    "..O....O...",
  ]);

  // --- BUG bodies (just the shell + eyes; legs/antennae drawn in code) ---
  // chars: . transparent, O outline, B body, W highlight, E eye, M mouth
  const BUG = S([
    "..OOOOO..",
    ".OBBBBBO.",
    "OBWBBBWBO",
    "OBBBBBBBO",
    "OBBBBBBBO",
    "OBEBBBEBO".replace(/E/g, 'E'),
    ".OBBBBBO.",
    "..OBMBO..",
  ]);

  const ROUNDBUG = S([   // beetle-ish, rounder (for beetle/boss)
    "...OOOOO...",
    "..OBBBBBO..",
    ".OBWWBWWBO.",
    "OBBBBBBBBBO",
    "OBBBBBBBBBO",
    "OBBEBBBEBBO",
    "OBBBBBBBBBO",
    ".OBBBBBBBO.",
    "..OBBBBBO..",
    "...OMMMO...",
  ]);

  const SLIMBUG = S([    // ant / spider slim body
    "..OOO..",
    ".OBBBO.",
    "OBWBWBO",
    "OBBBBBO",
    "OBEBEBO",
    ".OBBBO.",
    "..OMO..",
  ]);

  // Precompute nothing — draw straight from char maps (counts are tiny).
  // draw a sprite so its FEET/bottom-center sits at (cx, cy).
  // opts: {flip, alpha, px, squashX, squashY, flash, outline}
  function drawSprite(ctx, sprite, palette, cx, cy, opts = {}) {
    const px = opts.px || 3;
    const sx = (opts.squashX || 1);
    const sy = (opts.squashY || 1);
    const flip = opts.flip ? -1 : 1;
    const w = sprite.w, h = sprite.h;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(flip * sx, sy);
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    const ox = -(w * px) / 2;
    const oy = -(h * px);          // bottom-anchored
    for (let r = 0; r < h; r++) {
      const row = sprite.rows[r];
      for (let c = 0; c < w; c++) {
        const ch = row[c];
        if (ch === '.' || ch === ' ') continue;
        let col = palette[ch];
        if (col === undefined) col = palette._ || '#000';
        if (opts.flash) col = '#ffffff';
        ctx.fillStyle = col;
        ctx.fillRect(Math.floor(ox + c * px), Math.floor(oy + r * px), px + 0.5, px + 0.5);
      }
    }
    ctx.restore();
  }

  // pixel-ish soft shadow ellipse on the ground
  function drawShadow(ctx, x, y, w, alpha = 0.28) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.42, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* ---------------- ARENA ---------------- */
  // Draw the whole colosseum: crowd stands, sandy oval, cage.
  // world = {W,H, arena:{cx,cy,rx,ry}, pen:{x,y,w,h}}
  let crowdSeed = null;
  function buildCrowd(world) {
    // pre-place crowd dots in a ring around the arena
    const dots = [];
    const a = world.arena;
    const cols = ['#c8433a', '#3f6fb0', '#4b9e54', '#d9a13a', '#8a54b0', '#d5d0c4', '#c96fa0'];
    for (let i = 0; i < 520; i++) {
      const ang = rand(0, TAU);
      const ringGap = a.ry * 1.06;
      const rr = rand(1.06, 1.9);
      const x = a.cx + Math.cos(ang) * a.rx * rr;
      const y = a.cy + Math.sin(ang) * a.ry * rr;
      if (y > world.pen.y - 6) continue;          // don't draw over the cage
      if (x < 4 || x > world.W - 4 || y < 4) continue;
      dots.push({ x, y, c: pick(cols), ph: rand(0, TAU), sp: rand(2, 5) });
    }
    crowdSeed = dots;
  }

  function drawArena(ctx, world, t, hype) {
    const a = world.arena;
    const { W, H } = world;

    // stone backdrop of the stands
    ctx.fillStyle = '#4a3d30';
    ctx.fillRect(0, 0, W, world.pen.y);
    // concentric stone tiers (ellipse rings) for depth
    for (let i = 5; i >= 1; i--) {
      const rr = 1 + i * 0.16;
      ctx.fillStyle = i % 2 ? '#54463705' : '#3a2f2508';
      ctx.strokeStyle = shade('#6b5d4f', -0.15 - i * 0.03);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(a.cx, a.cy, a.rx * rr, a.ry * rr, 0, 0, TAU);
      ctx.stroke();
    }

    // crowd
    if (!crowdSeed) buildCrowd(world);
    const cheer = clamp(hype / 100, 0, 1);
    for (const d of crowdSeed) {
      const bob = Math.sin(t * d.sp + d.ph) * (1 + cheer * 3);
      ctx.fillStyle = d.c;
      ctx.fillRect(d.x - 1.5, d.y - 1.5 + bob, 3, 3);
      // heads
      ctx.fillStyle = '#e9c9a0';
      ctx.fillRect(d.x - 1, d.y - 3.5 + bob, 2, 2);
    }

    // arena sand (filled ellipse)
    const g = ctx.createRadialGradient(a.cx, a.cy - a.ry * 0.3, 10, a.cx, a.cy, a.rx);
    g.addColorStop(0, '#eecf94');
    g.addColorStop(1, '#c9a765');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(a.cx, a.cy, a.rx, a.ry, 0, 0, TAU);
    ctx.fill();

    // sand ring border (arena wall)
    ctx.lineWidth = 8; ctx.strokeStyle = '#7a6448';
    ctx.beginPath(); ctx.ellipse(a.cx, a.cy, a.rx, a.ry, 0, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = '#a98a5f';
    ctx.beginPath(); ctx.ellipse(a.cx, a.cy, a.rx - 4, a.ry - 4, 0, 0, TAU); ctx.stroke();

    // faint sand texture: scattered speckles + a couple of cracks (static)
    ctx.save();
    ctx.beginPath(); ctx.ellipse(a.cx, a.cy, a.rx - 6, a.ry - 6, 0, 0, TAU); ctx.clip();
    ctx.globalAlpha = 0.10; ctx.fillStyle = '#8a6f45';
    for (let i = 0; i < 90; i++) {
      const x = a.cx + rand(-1, 1) * a.rx, y = a.cy + rand(-1, 1) * a.ry;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    // center medallion
    ctx.strokeStyle = '#b89762'; ctx.lineWidth = 2; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.ellipse(a.cx, a.cy, 26, 16, 0, 0, TAU); ctx.stroke();
    ctx.restore();

    // gates (4 dark arches at the sides where bugs come from)
    drawGate(ctx, a.cx, a.cy - a.ry, 26, 16);
    drawGate(ctx, a.cx - a.rx + 2, a.cy, 20, 22);
    drawGate(ctx, a.cx + a.rx - 2, a.cy, 20, 22);
  }

  function drawGate(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = '#241a12';
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y + h / 2);
    ctx.lineTo(x - w / 2, y - h / 2 + 4);
    ctx.arc(x, y - h / 2 + 4, w / 2, Math.PI, 0);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#12100b'; ctx.lineWidth = 2;
    for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - w / 2 + i * w / 3, y - h / 2 + 3); ctx.lineTo(x - w / 2 + i * w / 3, y + h / 2); ctx.stroke(); }
    ctx.restore();
  }

  // the cage / barracks pen at the bottom where idle guys bounce
  function drawPen(ctx, world, t) {
    const p = world.pen;
    // floor
    const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    g.addColorStop(0, '#3b2c1d'); g.addColorStop(1, '#2a1f14');
    ctx.fillStyle = g;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    // straw specks
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#c9a765';
    for (let i = 0; i < 60; i++) ctx.fillRect(p.x + ((i * 97) % p.w), p.y + ((i * 53) % p.h), 3, 1);
    ctx.globalAlpha = 1;
    // top wooden rail + posts
    ctx.fillStyle = '#5a3f27';
    ctx.fillRect(p.x, p.y - 6, p.w, 8);
    ctx.fillStyle = '#3a2716';
    for (let x = p.x; x <= p.x + p.w; x += 40) ctx.fillRect(x, p.y - 6, 5, 10);
    ctx.fillStyle = '#7a5738';
    ctx.fillRect(p.x, p.y - 6, p.w, 2);
    // label
    ctx.fillStyle = '#8a6f45'; ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('▼ THE READY CAGE — drag your Lil Guys up into the arena', p.x + 8, p.y + 14);
  }

  return { GUY, TANK, BUG, ROUNDBUG, SLIMBUG, drawSprite, drawShadow, drawArena, drawPen, buildCrowd };
})();
