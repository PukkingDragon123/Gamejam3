/* ===========================================================
   entities.js — Unit (guys / bugs / companions) + Projectile
   Physics-based bouncy movement, auto-battle AI, rendering.
   Globals: Unit, Projectile
   =========================================================== */

const GRAVITY = 620;     // z-axis gravity (px/s^2)
const FRICTION = 6;      // knockback decay

class Unit {
  constructor(def, side, kind, x, y) {
    this.def = def;
    this.side = side;                 // 'ally' | 'enemy'
    this.kind = kind;                 // 'guy' | 'bug' | 'companion'
    this.x = x; this.y = y;
    this.z = 0; this.vz = 0;
    this.vx = 0; this.vy = 0;
    this.kx = 0; this.ky = 0;         // knockback velocity
    this.hp = def.hp; this.maxHp = def.hp;
    this.dmg = def.dmg || 0;
    this.range = def.range || 24;
    this.cd = def.cd || 1;
    this.atkTimer = rand(0, this.cd);
    this.speed = def.speed || 50;
    this.knock = def.knock || 10;
    this.atk = def.atk || 'melee';
    this.scale = def.scale || 1;
    this.radius = 8 * (def.scale || 1) * (kind === 'guy' ? 1 : 1);
    this.fly = !!def.fly;
    this.hoverZ = this.fly ? 26 : 0;
    this.facing = side === 'enemy' ? -1 : 1;
    this.aim = side === 'enemy' ? Math.PI : 0;
    this.state = kind === 'guy' ? 'penned' : 'idle';
    this.target = null;
    this.hopTimer = rand(0, 0.4);
    this.squash = 0;                  // land squash amount (0..1) decays
    this.atkAnim = 0;                 // swing animation (1..0)
    this.hitFlash = 0;
    this.stun = 0;
    this.boss = !!def.boss;
    this.abilityTimer = 2;
    this.summonTimer = def.summonEvery || 0;
    this.shoutText = ''; this.shoutTimer = 0;
    this.shoutCooldown = rand(1, 4);
    this.ko = false; this.removed = false; this.koTimer = 0;
    this.spawnPop = 1;                // spawn scale-in
    this.buffHaste = 0;               // remaining haste time
    this.wander = { x, y, t: 0 };
    this.slow = 0;                    // hazard slow timer
    this.id = Unit._id++;
  }

  get alive() { return this.hp > 0 && !this.ko && !this.removed; }
  get drawH() { const spr = ART[this.def.body || 'GUY']; return (spr ? spr.h : 14) * this.pixel(); }
  pixel() { return 3 * this.scale; }

  shout(text) {
    if (this.shoutTimer > 0) return;
    this.shoutText = text; this.shoutTimer = 1.1;
  }

  /* ---------------- DAMAGE ---------------- */
  hurt(amount, srcX, srcY, knock, game, crit = false) {
    if (!this.alive) return;
    if (this.def.dr) amount *= (1 - this.def.dr);
    amount = Math.max(1, Math.round(amount));
    this.hp -= amount;
    this.hitFlash = 0.09;
    // knockback
    if (knock) {
      const a = angleTo(srcX, srcY, this.x, this.y);
      const k = knock * (this.boss ? 0.12 : (this.def.tanky ? 0.5 : 1));
      this.kx += Math.cos(a) * k; this.ky += Math.sin(a) * k;
      if (!this.fly) this.vz = Math.max(this.vz, 60 + k * 0.6);
    }
    game.floatText(this.x, this.y - this.drawH, '-' + amount, crit ? '#ffd23f' : '#ffffff', crit);
    game.spawnHit(this.x, this.y - this.drawH * 0.5, this.side === 'enemy' ? this.def.pal.B : '#c94a3a', crit ? 10 : 5);
    game.sfx(crit ? 'crit' : 'hit');
    if (this.hp <= 0) this.die(game);
    else if (this.kind === 'bug' && chance(0.25)) game.sfx('hurt');
  }

  die(game) {
    if (this.ko || this.removed) return;
    this.hp = 0;
    if (this.kind === 'bug') {
      this.removed = true;
      game.onKill(this);
    } else {
      // allies/companions get KO'd (flattened) until wave ends
      this.ko = true; this.koTimer = 0;
      game.floatText(this.x, this.y - this.drawH, this.kind === 'guy' ? 'K.O.!' : 'down!', '#ff6a6a', true);
      game.spawnHit(this.x, this.y - 6, '#ffffff', 12);
      game.sfx('ko');
      game.onAllyDown(this);
    }
  }

  revive() {
    this.hp = this.maxHp; this.ko = false; this.removed = false;
    this.kx = this.ky = 0; this.stun = 0; this.buffHaste = 0; this.slow = 0;
  }

  /* ---------------- UPDATE ---------------- */
  update(dt, game) {
    this.spawnPop = approach(this.spawnPop, 1, dt * 4);
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.shoutTimer > 0) this.shoutTimer -= dt;
    if (this.atkAnim > 0) this.atkAnim = Math.max(0, this.atkAnim - dt * 6);
    if (this.buffHaste > 0) this.buffHaste -= dt;
    if (this.stun > 0) this.stun -= dt;
    if (this.slow > 0) this.slow -= dt;

    if (this.ko) { this.koTimer += dt; this.squash = approach(this.squash, 1, dt * 6); this.applyPhysics(dt, game); return; }

    // vertical bounce (the signature bobbing) --------------------------------
    this.hopTimer -= dt;
    const grounded = this.z <= (this.fly ? this.hoverZ + 0.5 : 0.5);
    if (this.fly) {
      // float around hover height with a gentle sine
      const targetZ = this.hoverZ + Math.sin(game.time * 4 + this.id) * 5;
      this.z = lerp(this.z, targetZ, clamp(dt * 6, 0, 1));
    } else {
      this.vz -= GRAVITY * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) {
        if (this.vz < -20) { this.squash = clamp(-this.vz / 260, 0, 1); if (chance(0.35)) game.sfx('hop'); }
        this.z = 0; this.vz = 0;
      }
      if (grounded && this.hopTimer <= 0 && this.stun <= 0) {
        const moving = (Math.abs(this.vx) + Math.abs(this.vy)) > 4 || this.state === 'penned';
        this.vz = (moving ? rand(120, 165) : rand(55, 90));
        this.hopTimer = moving ? rand(0.14, 0.28) : rand(0.5, 1.2);
      }
    }
    this.squash = approach(this.squash, 0, dt * 5);

    // AI (skipped while dragging / stunned decides movement only)
    if (this.state === 'dragging') { this.applyPhysics(dt, game); return; }
    if (this.stun > 0) { this.vx *= 0.8; this.vy *= 0.8; this.applyPhysics(dt, game); return; }

    if (game.phase === 'battle') this.battleAI(dt, game);
    else this.idleAI(dt, game);

    this.applyPhysics(dt, game);
    this.maybeShout(dt);
  }

  applyPhysics(dt, game) {
    // knockback velocity
    this.x += this.kx * dt; this.y += this.ky * dt;
    const decay = Math.exp(-FRICTION * dt);
    this.kx *= decay; this.ky *= decay;
    // steering velocity
    this.x += this.vx * dt; this.y += this.vy * dt;

    // containment
    if (this.state === 'dragging') return;          // pointer owns the position
    const a = game.world.arena;
    if (this.state === 'penned') {
      this.confineToPen(game);
    } else if (this.side === 'ally') {
      // deployed guys & companions stay inside the arena
      const c = clampToEllipse(this.x, this.y, a.cx, a.cy, a.rx, a.ry, 0.06);
      this.x = c.x; this.y = c.y;
    } else {
      // bugs may sit slightly outside near the gates
      const c = clampToEllipse(this.x, this.y, a.cx, a.cy, a.rx * 1.12, a.ry * 1.12, 0);
      this.x = c.x; this.y = c.y;
    }
  }

  confineToPen(game) {
    const p = game.world.pen, r = this.radius;
    if (this.x < p.x + r) { this.x = p.x + r; this.vx = Math.abs(this.vx); }
    if (this.x > p.x + p.w - r) { this.x = p.x + p.w - r; this.vx = -Math.abs(this.vx); }
    if (this.y < p.y + r + 10) { this.y = p.y + r + 10; this.vy = Math.abs(this.vy); }
    if (this.y > p.y + p.h - r) { this.y = p.y + p.h - r; this.vy = -Math.abs(this.vy); }
  }

  /* ---------------- IDLE / PEN behaviour ---------------- */
  idleAI(dt, game) {
    this.wander.t -= dt;
    if (this.wander.t <= 0) {
      this.wander.t = rand(0.7, 1.8);
      if (this.state === 'penned') {
        const p = game.world.pen;
        this.wander.x = rand(p.x + 14, p.x + p.w - 14);
        this.wander.y = rand(p.y + 20, p.y + p.h - 12);
      } else {
        // deployed but pre-battle: mill about near current spot
        this.wander.x = this.x + rand(-30, 30);
        this.wander.y = this.y + rand(-24, 24);
      }
    }
    const a = angleTo(this.x, this.y, this.wander.x, this.wander.y);
    const d = dist(this.x, this.y, this.wander.x, this.wander.y);
    const sp = this.speed * 0.5;
    if (d > 6) { this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp; this.facing = Math.cos(a) < 0 ? -1 : 1; }
    else { this.vx *= 0.8; this.vy *= 0.8; }
    this.separate(game, 0.6);
  }

  /* ---------------- BATTLE AI ---------------- */
  battleAI(dt, game) {
    this.atkTimer -= dt;
    const haste = this.buffHaste > 0 ? 1.6 : 1;

    // Boss special abilities
    if (this.boss) this.bossAbilities(dt, game);

    // Cheese lure yanks non-boss bugs into a pile
    if (this.side === 'enemy' && !this.boss && game.lure && game.lure.t > 0) {
      const L = game.lure;
      const a = angleTo(this.x, this.y, L.x, L.y);
      const d = dist(this.x, this.y, L.x, L.y);
      this.facing = Math.cos(a) < 0 ? -1 : 1;
      if (d > 16) { this.vx = Math.cos(a) * this.speed; this.vy = Math.sin(a) * this.speed; }
      else { this.vx *= 0.6; this.vy *= 0.6; if (chance(0.02)) this.shout('nom'); }
      this.separate(game, 1);
      return;
    }

    // choose behaviour by role
    if (this.atk === 'heal') return this.healAI(dt, game, haste);
    if (this.atk === 'buff') return this.buffAI(dt, game, haste);

    // acquire target
    if (!this.target || !this.target.alive) this.target = this.pickTarget(game);
    const tgt = this.target;
    if (!tgt) { this.vx *= 0.85; this.vy *= 0.85; this.separate(game, 1); return; }

    const d = dist(this.x, this.y, tgt.x, tgt.y);
    const a = angleTo(this.x, this.y, tgt.x, tgt.y);
    this.aim = a; this.facing = Math.cos(a) < 0 ? -1 : 1;
    const ranged = this.atk === 'ranged' || (this.def.proj && this.side === 'enemy' && this.range > 60);

    let desired = 0; // -1 back, 0 hold, 1 forward
    const reach = this.range + this.radius + tgt.radius * 0.6;
    if (ranged) {
      if (d > reach * 0.95) desired = 1;
      else if (d < reach * 0.5) desired = -1;   // kite
    } else {
      if (d > reach) desired = 1;
    }

    const sp = this.speed * haste * (this.slow > 0 ? 0.5 : 1);
    if (desired !== 0) {
      this.vx = Math.cos(a) * sp * desired;
      this.vy = Math.sin(a) * sp * desired;
    } else { this.vx *= 0.7; this.vy *= 0.7; }
    this.separate(game, 1);

    // attack
    if (d <= reach * 1.05 && this.atkTimer <= 0 && this.dmg > 0) {
      this.performAttack(game, tgt, a, ranged);
      this.atkTimer = this.cd / haste;
    }
  }

  performAttack(game, tgt, a, ranged) {
    this.atkAnim = 1;
    if (this.z < 4 && !this.fly) this.vz = Math.max(this.vz, 70);
    if (ranged || (this.def.proj && this.atk !== 'melee')) {
      const p = this.def.proj;
      const sx = this.x + Math.cos(a) * (this.radius + 6);
      const sy = this.y - this.drawH * 0.5;
      game.addProjectile(new Projectile({
        x: sx, y: sy, z: this.drawH * 0.5 + this.z,
        tx: tgt.x, ty: tgt.y - tgt.drawH * 0.4,
        speed: p.speed, dmg: this.dmg, side: this.side, knock: this.knock,
        color: p.color, kind: p.kind,
      }));
      game.sfx(p.kind === 'arrow' ? 'arrow' : (p.kind === 'acid' ? 'shoot' : 'shoot'));
    } else {
      // melee: hit the target (+ tiny cleave for brawler-y knock)
      const crit = chance(0.12);
      tgt.hurt(this.dmg * (crit ? 1.8 : 1), this.x, this.y, this.knock, game, crit);
      // small forward lunge
      this.kx += Math.cos(a) * 30; this.ky += Math.sin(a) * 30;
      if (this.def.weapon === 'fists') this.shout(pick(['ONE-TWO!', 'BONK!']));
    }
  }

  healAI(dt, game, haste) {
    // find most-hurt living ally in range (not self-priority unless hurt)
    let best = null, bestMiss = 6;
    for (const u of game.units) {
      if (u.side !== 'ally' || !u.alive) continue;
      const miss = u.maxHp - u.hp;
      if (miss <= 5) continue;
      const d = dist(this.x, this.y, u.x, u.y);
      if (d > this.range * 1.4) continue;
      if (miss > bestMiss) { bestMiss = miss; best = u; }
    }
    // move toward wounded (or toward ally centroid / away from enemies)
    const c = game.allyCentroid();
    let mx = c.x, my = c.y;
    if (best) { mx = best.x; my = best.y; }
    const a = angleTo(this.x, this.y, mx, my);
    const d = dist(this.x, this.y, mx, my);
    if (d > this.range * 0.8) { this.vx = Math.cos(a) * this.speed * haste; this.vy = Math.sin(a) * this.speed * haste; this.facing = Math.cos(a) < 0 ? -1 : 1; }
    else { this.vx *= 0.7; this.vy *= 0.7; }
    // keep distance from nearest enemy
    const e = this.pickTarget(game);
    if (e && dist(this.x, this.y, e.x, e.y) < 60) {
      const fa = angleTo(e.x, e.y, this.x, this.y);
      this.vx += Math.cos(fa) * this.speed; this.vy += Math.sin(fa) * this.speed;
    }
    this.separate(game, 0.8);
    if (best && this.atkTimer <= 0) {
      const heal = this.def.heal;
      best.hp = Math.min(best.maxHp, best.hp + heal);
      this.atkTimer = this.cd / haste; this.atkAnim = 1;
      game.floatText(best.x, best.y - best.drawH, '+' + heal, '#7bd66a');
      game.healSparkle(best.x, best.y - best.drawH * 0.5);
      game.sfx('heal');
    }
  }

  buffAI(dt, game, haste) {
    const c = game.allyCentroid();
    const a = angleTo(this.x, this.y, c.x, c.y);
    const d = dist(this.x, this.y, c.x, c.y);
    if (d > 40) { this.vx = Math.cos(a) * this.speed; this.vy = Math.sin(a) * this.speed; this.facing = Math.cos(a) < 0 ? -1 : 1; }
    else { this.vx *= 0.6; this.vy *= 0.6; }
    const e = this.pickTarget(game);
    if (e && dist(this.x, this.y, e.x, e.y) < 70) { const fa = angleTo(e.x, e.y, this.x, this.y); this.vx += Math.cos(fa) * this.speed * 0.9; this.vy += Math.sin(fa) * this.speed * 0.9; }
    this.separate(game, 0.8);
    if (this.atkTimer <= 0) {
      this.atkTimer = this.cd; this.atkAnim = 1;
      let n = 0;
      for (const u of game.units) {
        if (u.side !== 'ally' || !u.alive || u === this) continue;
        if (dist(this.x, this.y, u.x, u.y) <= this.range) { u.buffHaste = Math.max(u.buffHaste, 2.2); n++; }
      }
      game.pulse(this.x, this.y, this.range, '#e0c04a');
      game.sfx('buff');
      this.shout(pick(this.def.shouts));
    }
  }

  bossAbilities(dt, game) {
    this.abilityTimer -= dt;
    // periodic summon
    if (this.def.summon) {
      this.summonTimer -= dt;
      if (this.summonTimer <= 0) {
        this.summonTimer = this.def.summonEvery;
        game.bossSummon(this, this.def.summon, this.def.summonN);
        game.floatText(this.x, this.y - this.drawH, 'SUMMON!', '#ff8adf', true);
      }
    }
    if (this.abilityTimer <= 0) {
      this.abilityTimer = rand(3.5, 5.5);
      if (this.def.ability === 'stomp') {
        game.bossStomp(this);
      } else if (this.def.ability === 'divebomb') {
        game.bossDive(this);
      }
    }
  }

  /* ---------------- targeting & flocking ---------------- */
  pickTarget(game) {
    let best = null, bestScore = Infinity;
    const wantSide = this.side === 'ally' ? 'enemy' : 'ally';
    for (const u of game.units) {
      if (u.side !== wantSide || !u.alive) continue;
      if (u.benched) continue;               // benched guys sit safely in the cage
      let d = dist(this.x, this.y, u.x, u.y);
      // enemies are drawn toward taunting tanks
      if (this.side === 'enemy' && u.def.taunt) d /= u.def.taunt;
      if (d < bestScore) { bestScore = d; best = u; }
    }
    return best;
  }

  separate(game, strength) {
    let sx = 0, sy = 0, n = 0;
    for (const u of game.units) {
      if (u === this || !u.alive) continue;
      if (u.fly !== this.fly) continue;       // fliers ignore groundlings
      const dd = dist2(this.x, this.y, u.x, u.y);
      const minD = (this.radius + u.radius) * 1.05;
      if (dd < minD * minD && dd > 0.01) {
        const d = Math.sqrt(dd);
        sx += (this.x - u.x) / d; sy += (this.y - u.y) / d; n++;
      }
    }
    if (n) { this.vx += (sx / n) * this.speed * strength; this.vy += (sy / n) * this.speed * strength; }
  }

  maybeShout(dt) {
    this.shoutCooldown -= dt;
    if (this.shoutCooldown <= 0 && this.shoutTimer <= 0) {
      this.shoutCooldown = rand(3, 7);
      if (this.def.shouts && chance(0.6)) this.shout(pick(this.def.shouts));
    }
  }

  /* ---------------- RENDER ---------------- */
  draw(ctx, game) {
    const px = this.pixel();
    const spr = ART[this.def.body || 'GUY'];
    const groundY = this.y;
    const drawY = this.y - this.z;

    // shadow (shrinks with height)
    const shW = this.radius * (this.fly ? 1.0 : (1 - Math.min(this.z, 60) / 130)) * 1.2;
    ART.drawShadow(ctx, this.x, groundY + 2, Math.max(3, shW), this.ko ? 0.15 : 0.3);

    // squash/stretch
    let sy = 1 + (this.vz > 0 ? this.vz / 900 : 0) - this.squash * 0.45;
    let sx = 1 - (this.vz > 0 ? this.vz / 1400 : 0) + this.squash * 0.4;
    sy *= this.spawnPop; sx *= this.spawnPop;
    if (this.ko) { sy = 0.4; sx = 1.25; }

    // enemy fliers get little wings behind
    if (this.fly && !this.ko) this.drawWings(ctx, drawY, game);
    // bug legs / antennae
    if (this.kind === 'bug' && !this.ko) this.drawBugLegs(ctx, drawY, px, game);

    ART.drawSprite(ctx, spr, this.def.pal, this.x, drawY, {
      px, flip: this.facing < 0, squashX: sx, squashY: sy, flash: this.hitFlash > 0,
    });

    // ko stars
    if (this.ko) {
      ctx.fillStyle = '#ffd23f'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillText('✦ ✦', this.x, drawY - this.drawH * 0.25);
    }

    // weapon / accessory (guys & companions only, when alive)
    if (!this.ko && this.kind !== 'bug') this.drawWeapon(ctx, drawY, game);

    // HP bar (skip full-hp idle allies to reduce clutter; always for enemies in battle)
    const showBar = (this.hp < this.maxHp) && this.alive;
    if (showBar || (this.boss && this.alive)) this.drawHpBar(ctx, drawY);

    // shout bubble
    if (this.shoutTimer > 0 && this.shoutText) this.drawShout(ctx, drawY);
  }

  drawHpBar(ctx, drawY) {
    const w = this.boss ? 60 : Math.max(16, this.radius * 2.4);
    const h = this.boss ? 6 : 4;
    const x = this.x - w / 2, y = drawY - this.drawH - (this.boss ? 12 : 7);
    ctx.fillStyle = '#000a'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    const frac = clamp(this.hp / this.maxHp, 0, 1);
    ctx.fillStyle = this.side === 'ally' ? '#7bd66a' : (this.boss ? '#ff5fa2' : '#e05a4a');
    ctx.fillRect(x, y, w * frac, h);
    if (this.boss) {
      ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 9px "Courier New",monospace'; ctx.textAlign = 'center';
      ctx.fillText(this.def.name, this.x, y - 4);
    }
  }

  drawShout(ctx, drawY) {
    const a = clamp(this.shoutTimer / 1.1, 0, 1);
    ctx.save(); ctx.globalAlpha = Math.min(1, a * 1.4);
    ctx.font = 'bold 9px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center';
    const w = ctx.measureText(this.shoutText).width + 10;
    const y = drawY - this.drawH - 15 - (1 - a) * 6;
    ctx.fillStyle = '#fff'; roundRect(ctx, this.x - w / 2, y - 11, w, 14, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(this.x - 3, y + 2); ctx.lineTo(this.x + 3, y + 2); ctx.lineTo(this.x, y + 6); ctx.fill();
    ctx.fillStyle = '#2a1d14'; ctx.fillText(this.shoutText, this.x, y - 1);
    ctx.restore();
  }

  drawWeapon(ctx, drawY, game) {
    const w = this.def.weapon; if (!w) return;
    const face = this.facing;
    const thrust = easeOutCubic(this.atkAnim) * 10;
    const hx = this.x + face * (this.radius + 2 + thrust);
    const hy = drawY - this.drawH * 0.45;
    ctx.save();
    ctx.lineCap = 'round';
    if (w === 'sword') {
      ctx.strokeStyle = '#d8d8e0'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + face * 11, hy - 9 + this.atkAnim * 6); ctx.stroke();
      ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx - face * 2, hy + 3); ctx.lineTo(hx + face * 2, hy - 2); ctx.stroke();
    } else if (w === 'spear') {
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hx - face * 6, hy + 6); ctx.lineTo(hx + face * 22, hy - 10); ctx.stroke();
      ctx.fillStyle = '#d8d8e0'; ctx.beginPath();
      ctx.moveTo(hx + face * 22, hy - 10); ctx.lineTo(hx + face * 16, hy - 6); ctx.lineTo(hx + face * 18, hy - 12); ctx.fill();
    } else if (w === 'bow') {
      ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hx, hy, 9, -1.2 * face + (face < 0 ? Math.PI : 0), 1.2 * face + (face < 0 ? Math.PI : 0), face < 0); ctx.stroke();
      ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.beginPath();
      const bt = this.atkAnim;
      ctx.moveTo(hx - face * 5 * bt, hy - 8); ctx.lineTo(hx, hy); ctx.lineTo(hx - face * 5 * bt, hy + 8); ctx.stroke();
    } else if (w === 'fists') {
      const punch = this.atkAnim;
      ctx.fillStyle = '#c94a3a';
      ctx.beginPath(); ctx.arc(hx + face * punch * 6, hy - 2, 3.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(this.x - face * 3, hy + 3, 3.5, 0, TAU); ctx.fill();
    } else if (w === 'shield') {
      ctx.fillStyle = '#9aa0aa'; ctx.strokeStyle = '#4a4a52'; ctx.lineWidth = 2;
      roundRect(ctx, hx - 2, hy - 8, 7, 16, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#b23a30'; ctx.fillRect(hx, hy - 3, 3, 6);
    } else if (w === 'staff') {
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hx, hy + 6); ctx.lineTo(hx + face * 3, hy - 10); ctx.stroke();
      const glow = 3 + Math.sin(game.time * 6) * 1;
      ctx.fillStyle = '#7bd66a'; ctx.shadowColor = '#7bd66a'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(hx + face * 3, hy - 11, glow, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    } else if (w === 'drum') {
      ctx.fillStyle = '#b0762f'; ctx.strokeStyle = '#5a2a5a'; ctx.lineWidth = 2;
      roundRect(ctx, this.x - 7, hy - 1, 14, 9, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f2ede0'; ctx.fillRect(this.x - 7, hy - 1, 14, 2);
      ctx.strokeStyle = '#e9b98a'; ctx.lineWidth = 2;
      const s = this.atkAnim * 4;
      ctx.beginPath(); ctx.moveTo(this.x - 9, hy - 6 - s); ctx.lineTo(this.x - 4, hy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(this.x + 9, hy - 6 - s); ctx.lineTo(this.x + 4, hy); ctx.stroke();
    } else if (w === 'beak') { // goose
      ctx.fillStyle = '#e0a81f';
      const p = this.atkAnim * 4;
      ctx.beginPath(); ctx.moveTo(hx + face * p, hy); ctx.lineTo(hx + face * (7 + p), hy - 2); ctx.lineTo(hx + face * (7 + p), hy + 2); ctx.fill();
    } else if (w === 'teeth') { // dog
      ctx.fillStyle = '#fff';
      const p = this.atkAnim * 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(hx + face * (i * 3 + p), hy); ctx.lineTo(hx + face * (i * 3 + 1.5 + p), hy + 3); ctx.lineTo(hx + face * (i * 3 + 3 + p), hy); ctx.fill(); }
    }
    ctx.restore();
  }

  drawBugLegs(ctx, drawY, px, game) {
    const n = this.def.legs || 6;
    const bodyW = (this.def.body === 'SLIMBUG' ? 9 : 11) * px * 0.5;
    const cy = drawY - this.drawH * 0.4;
    const wig = Math.sin(game.time * 16 + this.id) * 2;
    ctx.strokeStyle = shade(this.def.pal.B, -0.4); ctx.lineWidth = Math.max(1, px * 0.5);
    for (let i = 0; i < n / 2; i++) {
      const oy = (i - n / 4) * px * 1.3;
      const ph = (i % 2 ? wig : -wig);
      ctx.beginPath(); ctx.moveTo(this.x - bodyW * 0.6, cy + oy); ctx.lineTo(this.x - bodyW - 5, cy + oy + ph + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(this.x + bodyW * 0.6, cy + oy); ctx.lineTo(this.x + bodyW + 5, cy + oy - ph + 4); ctx.stroke();
    }
    // antennae
    ctx.beginPath(); ctx.moveTo(this.x - bodyW * 0.3, drawY - this.drawH); ctx.lineTo(this.x - bodyW * 0.3 - 3, drawY - this.drawH - 6 + wig); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(this.x + bodyW * 0.3, drawY - this.drawH); ctx.lineTo(this.x + bodyW * 0.3 + 3, drawY - this.drawH - 6 - wig); ctx.stroke();
  }

  drawWings(ctx, drawY, game) {
    const flap = Math.abs(Math.sin(game.time * 30 + this.id)) * 4 + 2;
    const cy = drawY - this.drawH * 0.6;
    ctx.save(); ctx.globalAlpha = 0.65; ctx.fillStyle = '#eafcff';
    ctx.beginPath(); ctx.ellipse(this.x - this.radius, cy - flap, 6 * this.scale, 3, -0.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(this.x + this.radius, cy - flap, 6 * this.scale, 3, 0.5, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
Unit._id = 1;

/* ===========================================================
   Projectile
   =========================================================== */
class Projectile {
  constructor(o) {
    this.x = o.x; this.y = o.y; this.z = o.z || 8;
    this.side = o.side; this.dmg = o.dmg; this.knock = o.knock || 0;
    this.color = o.color || '#fff'; this.kind = o.kind || 'arrow';
    this.splash = o.splash || 0;
    this.life = o.life || 2.2;
    this.dead = false;
    this.lob = !!o.lob;
    const a = angleTo(o.x, o.y, o.tx, o.ty);
    this.angle = a;
    this.vx = Math.cos(a) * o.speed;
    this.vy = Math.sin(a) * o.speed;
    if (this.lob) {
      const d = dist(o.x, o.y, o.tx, o.ty);
      this.tx = o.tx; this.ty = o.ty;
      const flight = d / o.speed;
      this.vz = (GRAVITY * flight) / 2;   // arc that lands at target
      this.groundGrav = GRAVITY;
    } else { this.vz = 0; this.groundGrav = 0; }
    this.trail = [];
  }

  update(dt, game) {
    this.life -= dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.lob) { this.vz -= this.groundGrav * dt; this.z += this.vz * dt; }
    this.trail.push({ x: this.x, y: this.y - this.z }); if (this.trail.length > 6) this.trail.shift();

    // out of world / expired
    if (this.life <= 0) { this.dead = true; return; }
    const w = game.world;
    if (this.x < -20 || this.x > w.W + 20 || this.y < -20 || this.y > w.pen.y + 20) { this.dead = true; return; }

    if (this.lob && this.z <= 0) { this.explode(game); return; }

    // collision with opposing units
    const wantSide = this.side === 'ally' ? 'enemy' : 'ally';
    for (const u of game.units) {
      if (u.side !== wantSide || !u.alive || u.benched) continue;
      const rr = u.radius + 4;
      if (dist2(this.x, this.y, u.x, u.y - u.z) < rr * rr) {
        if (this.splash) this.explode(game);
        else {
          u.hurt(this.dmg, this.x - this.vx * 0.02, this.y, this.knock, game, false);
          this.impact(game);
          this.dead = true;
        }
        return;
      }
    }
  }

  explode(game) {
    this.dead = true;
    game.boom(this.x, this.y, this.splash, this.color);
    const wantSide = this.side === 'ally' ? 'enemy' : 'ally';
    for (const u of game.units) {
      if (u.side !== wantSide || !u.alive) continue;
      if (dist(this.x, this.y, u.x, u.y) <= this.splash + u.radius) {
        u.hurt(this.dmg, this.x, this.y, this.knock, game, false);
      }
    }
    game.sfx('boom'); game.shake(4);
  }

  impact(game) {
    game.spawnHit(this.x, this.y, this.color, 4);
    if (this.kind === 'acid') game.puddle(this.x, this.y);
  }

  draw(ctx) {
    const dy = this.y - this.z;
    // trail
    ctx.strokeStyle = this.color; ctx.globalAlpha = 0.4; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < this.trail.length; i++) { const p = this.trail[i]; i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
    ctx.stroke(); ctx.globalAlpha = 1;
    if (this.kind === 'arrow' || this.kind === 'bolt') {
      ctx.save(); ctx.translate(this.x, dy); ctx.rotate(this.angle);
      ctx.strokeStyle = this.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(5, 0); ctx.stroke();
      ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(1, -2); ctx.lineTo(1, 2); ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(this.x, dy, this.kind === 'acid' ? 4 : 3, 0, TAU); ctx.fill();
      if (this.lob) { ART.drawShadow(ctx, this.x, this.y, 4, 0.25); }
    }
  }
}
