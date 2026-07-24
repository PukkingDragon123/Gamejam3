/* ===========================================================
   art.js — detailed procedural pixel-art: fighters, animals,
   the Colosseum, the crowd, and the player's God Hand.
   Global: ART
   =========================================================== */

const ART = (() => {

  // sprite = char-map. S() pads every row to equal width so a short
  // row can never spill stray pixels.
  function S(rows) {
    let w = 0; for (const r of rows) w = Math.max(w, r.length);
    const padded = rows.map(r => r + '.'.repeat(w - r.length));
    return { w, h: padded.length, rows: padded };
  }

  /* ---------------- HUMAN FIGHTER (11 x 17) ----------------
     Palette chars (see data.js gp()):
       o outline · h helmet · H helmet-hi · p plume/crest
       k skin · s skin-shadow · e eye · a armor · A armor-hi
       t tunic · T tunic-shadow · b belt/boot
  */
  const GUY = S([
    ".....p.....",
    "....ppp....",
    "...ppppp...",
    "...ooooo...",
    "..ohHHHho..",
    "..ohkkkho..",
    "..okkkkko..",
    "..okekeko..",
    "...okkko...",
    "..oaaAaao..",
    ".oaAAAAAao.",
    ".oaAaaaAao.",
    ".obbbbbbbo.",
    "..otTtTto..",
    "..otTtTto..",
    "..oko.oko..",
    "..ogo.ogo..",
  ]);

  // bulkier tank (13 x 17)
  const TANK = S([
    "....ooooo....",
    "...ohHHHho...",
    "..ohHHHHHho..",
    "..ohkkkkkho..",
    "..oksekekso..",
    "...okkkkko...",
    "....okkko....",
    "..oaaAAAaao..",
    ".oaAAAAAAAao.",
    "oaAAaaAaaAAao",
    "oaAAaaaaaAAao",
    ".obbbbbbbbbo.",
    "..otTttTto...",
    "..otTtttTo...",
    "..oko...oko..",
    "..oko...oko..",
    "..ogo...ogo..",
  ]);

  /* ---------------- ANGRY GOOSE (12 x 14) ----------------
     chars: o outline · w white · W white-shadow · b beak · e eye · f feet */
  const GOOSE = S([
    "......ooo...",
    ".....owwWo..",
    ".....oweWo..",
    "...bboowwo..",
    "..bb..owwo..",
    ".......owwo.",
    "....ooowwooo",
    "...owwwwWwwo",
    "..owwwwwwwwo",
    "..owWwwwwwwo",
    "..owwwwwwwwo",
    "...oowwwwoo.",
    "....ff.ff...",
    "....ff.ff...",
  ]);

  /* ---------------- WAR DOG (14 x 11) ----------------
     chars: o outline · d fur · D fur-dark · l muzzle-light · e eye · n nose */
  const DOG = S([
    "...........oo.",
    "..o......odddo",
    ".oDo....oddleo",
    ".odo...oddllno",
    ".oddoooddddlo.",
    ".oddddddddddo.",
    ".oDddddddddDo.",
    ".oddddddddddo.",
    ".oo.oo..oo.oo.",
    ".od.od..od.od.",
    ".og.og..og.og.",
  ]);

  /* ---------------- BUGS ---------------- */
  // chars: o outline · B body · W hi · E eye · M mouth · L leg-hint
  const BUG = S([        // stink/acid bug
    "..oo...oo..",
    ".oBBo.oBBo.",
    "..oBBoBBo..",
    ".oBBBBBBBo.",
    "oBBWBBBWBBo",
    "oBBBBBBBBBo",
    "oBEBBBBBEBo",
    "oBBBBBBBBBo",
    ".oBBBBBBBo.",
    "..oBBMBBo..",
    "...oMMMo...",
  ]);
  const ROUNDBUG = S([   // beetle / boss shell
    "...oo.oo...",
    "..oBBoBBo..",
    ".oBBBBBBBo.",
    "oBWWBBBWWBo",
    "oBBBBBBBBBo",
    "oBBBBBBBBBo",
    "oBEBBBBBEBo",
    "oBBBBBBBBBo",
    "oBBBBBBBBBo",
    ".oBBBBBBBo.",
    "..oBBBBBo..",
    "...oMMMo...",
  ]);
  const SLIMBUG = S([    // ant / spider / wasp
    "..o...o..",
    ".oBo.oBo.",
    "..oBBBo..",
    ".oBBBBBo.",
    "oBWBBBWBo",
    "oBEBBBEBo",
    "oBBBBBBBo",
    ".oBBBBBo.",
    "..oBMBo..",
    "...oMo...",
  ]);

  /* ---------------- GOD HAND (11 x 15) ---------------- */
  // chars: o outline · c cuff(gold) · C cuff-hi · k skin · s skin-shadow · n nail
  const HAND = S([
    "..oCCCCo...",
    ".oCcccCo...",
    ".okkkkkco..",
    ".okkskkko..",
    ".okkkkkko..",
    ".okksskko..",
    "..okkkko...",
    "..okkkko...",
    "...okko....",
    "...okko....",
    "...okko....",
    "...okko....",
    "...okno....",
    "...oko.....",
    "....o......",
  ]);
  const HAND_PAL = { o: '#3a2410', c: '#e0b23a', C: '#ffe08a', k: '#f0c89a', s: '#cf9a68', n: '#fff', _: '#3a2410' };

  /* ---------------- sprite drawing ---------------- */
  function drawSprite(ctx, sprite, palette, cx, cy, opts = {}) {
    const px = opts.px || 3;
    const sx = (opts.squashX || 1), sy = (opts.squashY || 1);
    const flip = opts.flip ? -1 : 1;
    const w = sprite.w, h = sprite.h;
    ctx.save();
    ctx.translate(cx, cy);
    if (opts.rot) ctx.rotate(opts.rot);
    ctx.scale(flip * sx, sy);
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    const ox = -(w * px) / 2, oy = -(h * px);
    for (let r = 0; r < h; r++) {
      const row = sprite.rows[r];
      for (let c = 0; c < w; c++) {
        const ch = row[c];
        if (ch === '.' || ch === ' ') continue;
        let col = palette[ch]; if (col === undefined) col = palette._ || '#000';
        if (opts.flash) col = '#ffffff';
        ctx.fillStyle = col;
        ctx.fillRect(Math.floor(ox + c * px), Math.floor(oy + r * px), px + 0.6, px + 0.6);
      }
    }
    ctx.restore();
  }

  function drawShadow(ctx, x, y, w, alpha = 0.28) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.42, 0, 0, TAU); ctx.fill(); ctx.restore();
  }

  // The god hand at a point. mode: 'point'|'pinch'|'flick'|'cast'
  function drawHand(ctx, x, y, mode, anim, t) {
    ctx.save();
    // faint divine glow
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.ellipse(x, y - 4, 20, 20, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    let rot = 0, oy = -6, px = 3.4;
    if (mode === 'flick') { rot = -0.5 + (1 - anim) * 1.3; oy = -10; }
    else if (mode === 'pinch') { oy = -26; px = 3.1; }
    else if (mode === 'cast') { oy = -8 + Math.sin(t * 8) * 2; }
    else { oy = -6 + Math.sin(t * 4) * 2; }
    drawSprite(ctx, HAND, HAND_PAL, x, y + oy + HAND.h * px, { px, rot });
    if (mode === 'flick' && anim < 0.4) {
      ctx.strokeStyle = '#fff'; ctx.globalAlpha = anim / 0.4; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 16, -0.6, 0.6); ctx.stroke();
    }
    ctx.restore();
  }

  /* ================= COLOSSEUM ================= */
  let crowd = null, banners = null;

  function buildCrowd(world) {
    crowd = [];
    const a = world.arena;
    const toga = ['#e8e2d0', '#d9d2be', '#c8433a', '#3f6fb0', '#4b9e54', '#d9a13a', '#8a54b0', '#c96fa0', '#e0e0e0'];
    // several seating rings
    for (let ring = 0; ring < 5; ring++) {
      const rr = 1.14 + ring * 0.13;
      const step = 0.055 - ring * 0.004;
      for (let ang = 0; ang < TAU; ang += step) {
        const x = a.cx + Math.cos(ang) * a.rx * rr;
        const y = a.cy + Math.sin(ang) * a.ry * rr;
        if (y > world.pen.y - 8) continue;
        if (x < 6 || x > world.W - 6 || y < 6) continue;
        crowd.push({ x, y, c: pick(toga), ph: rand(0, TAU), sp: rand(2.5, 5), ang });
      }
    }
    // hanging SPQR banners around the upper wall
    banners = [];
    for (let i = 0; i < 7; i++) {
      const ang = -Math.PI + (i + 0.5) / 7 * Math.PI;
      const x = a.cx + Math.cos(ang) * a.rx * 1.62;
      const y = a.cy + Math.sin(ang) * a.ry * 1.5;
      if (y > world.pen.y - 20) continue;
      banners.push({ x, y, c: i % 2 ? '#8a2018' : '#6a2f8a' });
    }
  }

  function drawArena(ctx, world, t) {
    const a = world.arena, W = world.W;

    // --- stone backdrop ---
    ctx.fillStyle = '#2e2620'; ctx.fillRect(0, 0, W, world.pen.y);

    // outer arcade wall with arches (behind seating)
    drawArcadeRing(ctx, a, world);

    // tiered seating (concentric stone bands, darker outward)
    for (let i = 5; i >= 1; i--) {
      const rr = 1.12 + i * 0.13;
      ctx.strokeStyle = shade('#7a6a54', -0.1 - i * 0.05);
      ctx.lineWidth = a.ry * 0.13;
      ctx.beginPath(); ctx.ellipse(a.cx, a.cy, a.rx * rr, a.ry * rr, 0, Math.PI * 1.02, Math.PI * 2 - 0.02); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(a.cx, a.cy, a.rx * rr, a.ry * rr, 0, 0.02, Math.PI * 0.02 + 0.5); ctx.stroke();
    }
    // seating stairs (radial lines)
    ctx.strokeStyle = '#3a3128'; ctx.lineWidth = 2;
    for (let k = 0; k < 40; k++) {
      const ang = k / 40 * TAU;
      if (Math.sin(ang) > 0.35) continue;
      ctx.beginPath();
      ctx.moveTo(a.cx + Math.cos(ang) * a.rx * 1.12, a.cy + Math.sin(ang) * a.ry * 1.12);
      ctx.lineTo(a.cx + Math.cos(ang) * a.rx * 1.78, a.cy + Math.sin(ang) * a.ry * 1.78);
      ctx.stroke();
    }

    // --- crowd (with a travelling "wave") ---
    if (!crowd) buildCrowd(world);
    const wavePos = (t * 0.6) % TAU;
    for (const d of crowd) {
      let bob = Math.sin(t * d.sp + d.ph) * 1.4;
      const dAng = Math.abs(((d.ang - wavePos + Math.PI * 3) % TAU) - Math.PI);
      if (dAng < 0.5) bob -= (0.5 - dAng) * 10;   // the wave lifts them
      ctx.fillStyle = d.c; ctx.fillRect(d.x - 1.5, d.y - 1 + bob, 3, 4);
      ctx.fillStyle = '#e9c9a0'; ctx.fillRect(d.x - 1, d.y - 3 + bob, 2, 2);
    }

    // banners
    if (banners) for (const b of banners) drawBanner(ctx, b.x, b.y, b.c, t);

    // emperor's box (top-centre canopy)
    drawEmperorBox(ctx, a.cx, a.cy - a.ry * 1.28, t);

    // --- arena floor ---
    const g = ctx.createRadialGradient(a.cx, a.cy - a.ry * 0.3, 12, a.cx, a.cy, a.rx);
    g.addColorStop(0, '#efd39a'); g.addColorStop(1, '#c9a765');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(a.cx, a.cy, a.rx, a.ry, 0, 0, TAU); ctx.fill();

    // arena wall ring
    ctx.lineWidth = 10; ctx.strokeStyle = '#6f5a40';
    ctx.beginPath(); ctx.ellipse(a.cx, a.cy, a.rx, a.ry, 0, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = '#b89a68';
    ctx.beginPath(); ctx.ellipse(a.cx, a.cy, a.rx - 5, a.ry - 5, 0, 0, TAU); ctx.stroke();

    // floor detail (clip to sand)
    ctx.save();
    ctx.beginPath(); ctx.ellipse(a.cx, a.cy, a.rx - 6, a.ry - 6, 0, 0, TAU); ctx.clip();
    // hypogeum planks
    ctx.strokeStyle = '#00000018'; ctx.lineWidth = 2;
    for (let x = -a.rx; x < a.rx; x += 26) { ctx.beginPath(); ctx.moveTo(a.cx + x, a.cy - a.ry); ctx.lineTo(a.cx + x, a.cy + a.ry); ctx.stroke(); }
    // speckles
    ctx.globalAlpha = 0.09; ctx.fillStyle = '#7a5f38';
    for (let i = 0; i < 120; i++) ctx.fillRect(a.cx + rand(-1, 1) * a.rx, a.cy + rand(-1, 1) * a.ry, 2, 2);
    ctx.globalAlpha = 1;
    // centre SPQR laurel medallion
    ctx.strokeStyle = '#a9884f'; ctx.lineWidth = 2; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.ellipse(a.cx, a.cy, 30, 18, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#8a6f45';
    ctx.font = 'bold 13px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.fillText('SPQR', a.cx, a.cy + 4);
    ctx.restore();

    // gates + torches
    drawGate(ctx, a.cx, a.cy - a.ry, 30, 20, t);
    drawGate(ctx, a.cx - a.rx + 4, a.cy, 22, 26, t);
    drawGate(ctx, a.cx + a.rx - 4, a.cy, 22, 26, t);
  }

  function drawArcadeRing(ctx, a, world) {
    // an arched stone facade sweeping across the top
    ctx.save();
    ctx.fillStyle = '#5b4c3b';
    ctx.beginPath(); ctx.ellipse(a.cx, a.cy, a.rx * 1.92, a.ry * 1.92, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#463a2c';
    ctx.beginPath(); ctx.ellipse(a.cx, a.cy, a.rx * 1.7, a.ry * 1.7, 0, Math.PI, TAU); ctx.fill();
    // arches
    for (let k = 0; k < 22; k++) {
      const ang = Math.PI + (k + 0.5) / 22 * Math.PI;
      const x = a.cx + Math.cos(ang) * a.rx * 1.82;
      const y = a.cy + Math.sin(ang) * a.ry * 1.82;
      if (y > world.pen.y) continue;
      ctx.fillStyle = '#20180f';
      ctx.beginPath(); ctx.ellipse(x, y, 6, 9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6b5a45'; ctx.fillRect(x - 8, y + 8, 16, 3);
    }
    ctx.restore();
  }

  function drawBanner(ctx, x, y, color, t) {
    const sway = Math.sin(t * 2 + x) * 2;
    ctx.save();
    ctx.fillStyle = '#3a2a18'; ctx.fillRect(x - 10, y - 4, 20, 3);          // rail
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y);
    ctx.lineTo(x + 8 + sway, y + 30); ctx.lineTo(x, y + 36); ctx.lineTo(x - 8 + sway, y + 30);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e0c060'; ctx.font = 'bold 8px "Courier New",monospace'; ctx.textAlign = 'center';
    ctx.fillText('SPQR', x + sway * 0.5, y + 20);
    ctx.restore();
  }

  function drawEmperorBox(ctx, x, y, t) {
    ctx.save();
    // platform
    ctx.fillStyle = '#4a3a26'; ctx.fillRect(x - 34, y + 10, 68, 16);
    // canopy poles
    ctx.fillStyle = '#c9a24a'; ctx.fillRect(x - 30, y - 6, 3, 20); ctx.fillRect(x + 27, y - 6, 3, 20);
    // canopy
    ctx.fillStyle = '#8a2018';
    ctx.beginPath(); ctx.moveTo(x - 36, y - 4); ctx.lineTo(x + 36, y - 4); ctx.lineTo(x + 30, y - 16); ctx.lineTo(x - 30, y - 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e0c060';
    for (let i = -34; i < 34; i += 8) { ctx.beginPath(); ctx.moveTo(x + i, y - 4); ctx.lineTo(x + i + 4, y - 4); ctx.lineTo(x + i + 2, y); ctx.closePath(); ctx.fill(); }
    // the emperor (goofy laurel head)
    ctx.fillStyle = '#e8bd95'; ctx.fillRect(x - 4, y + 2, 9, 8);
    ctx.fillStyle = '#4b9e54'; ctx.fillRect(x - 5, y + 1, 11, 2);  // laurel
    ctx.fillStyle = '#8a2018'; ctx.fillRect(x - 5, y + 10, 11, 6); // toga
    ctx.restore();
  }

  function drawGate(ctx, x, y, w, h, t) {
    ctx.save();
    // arch
    ctx.fillStyle = '#1c140d';
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y + h / 2); ctx.lineTo(x - w / 2, y - h / 2 + 5);
    ctx.arc(x, y - h / 2 + 5, w / 2, Math.PI, 0); ctx.lineTo(x + w / 2, y + h / 2); ctx.closePath(); ctx.fill();
    // portcullis bars
    ctx.strokeStyle = '#0c0a07'; ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - w / 2 + i * w / 4, y - h / 2 + 4); ctx.lineTo(x - w / 2 + i * w / 4, y + h / 2); ctx.stroke(); }
    ctx.strokeStyle = '#5a4632'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y - h / 2 + 5, w / 2 + 2, w / 2 + 2, 0, Math.PI, 0); ctx.stroke();
    // torches either side
    for (const sx of [-1, 1]) {
      const tx = x + sx * (w / 2 + 7), ty = y - 2;
      ctx.fillStyle = '#3a2a18'; ctx.fillRect(tx - 1, ty, 2, 10);
      const fl = 3 + Math.sin(t * 12 + tx) * 1.5;
      ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.ellipse(tx, ty - 2, 3, 5 + fl, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(tx, ty - 1, 1.6, 3 + fl * 0.6, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawPen(ctx, world, t) {
    const p = world.pen;
    const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    g.addColorStop(0, '#3f2f1e'); g.addColorStop(1, '#281d12');
    ctx.fillStyle = g; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.globalAlpha = 0.16; ctx.fillStyle = '#c9a765';
    for (let i = 0; i < 80; i++) ctx.fillRect(p.x + ((i * 97) % p.w), p.y + ((i * 53) % p.h), 3, 1);
    ctx.globalAlpha = 1;
    // stone kerb + iron railing
    ctx.fillStyle = '#5a4630'; ctx.fillRect(p.x, p.y - 7, p.w, 9);
    ctx.fillStyle = '#7a6242'; ctx.fillRect(p.x, p.y - 7, p.w, 2);
    ctx.fillStyle = '#2a2018';
    for (let x = p.x + 6; x <= p.x + p.w - 6; x += 22) { ctx.fillRect(x, p.y - 16, 3, 10); ctx.beginPath(); ctx.arc(x + 1.5, p.y - 17, 2.5, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#caa24a'; ctx.font = 'bold 10px "Courier New", monospace'; ctx.textAlign = 'left';
    ctx.fillText('▲ THE READY CAGE — drag your Lil Guys up into the arena', p.x + 10, p.y + 15);
  }

  return { GUY, TANK, GOOSE, DOG, BUG, ROUNDBUG, SLIMBUG, drawSprite, drawShadow, drawHand, drawArena, drawPen, buildCrowd };
})();
