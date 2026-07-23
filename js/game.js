/* ===========================================================
   game.js — the Game: state machine, input (drag & drop),
   waves, spells, companions, rendering & UI. Global: Game
   =========================================================== */

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const W = 900, H = 600;
    this.world = {
      W, H,
      arena: { cx: 450, cy: 242, rx: 382, ry: 184 },
      pen:   { x: 12, y: 472, w: 876, h: 118 },
    };
    canvas.width = W; canvas.height = H;

    this.time = 0;
    this.phase = 'title';           // title | prep | battle | reward | over
    this.units = [];
    this.roster = [];               // persistent ally Unit objects (guys)
    this.projectiles = [];
    this.particles = [];
    this.floaters = [];
    this.hazards = [];
    this.turrets = [];
    this.telegraphs = [];           // delayed casts (e.g. boulder)
    this.pulses = [];
    this.lure = null;

    this.spells = ['water'];
    this.spellCd = {};
    this.armed = null;

    this.passives = { hypeRegen: 1, maxHype: 100, startBonus: 0 };
    this.ownedTools = [];

    this.hype = 35;
    this.wave = 1;
    this.score = 0;
    this.kills = 0;
    this.shakeAmt = 0;
    this.pointer = { x: 450, y: 300, down: false };
    this.dragging = null;
    this.bossBanner = null;
    this.spawnQueue = [];
    this.best = +(localStorage.getItem('lgc_best') || 0);

    this.el = {};
    this._bindDom();
    this._bindInput();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    ART.buildCrowd(this.world);
  }

  /* ============================ DOM ============================ */
  _bindDom() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      waveVal: $('wave-val'), rosterVal: $('roster-val'), scoreVal: $('score-val'),
      hypeFill: $('hype-fill'), hypeTxt: $('hype-txt'),
      banner: $('banner'), waveSub: $('wave-sub'),
      fightBtn: $('fight-btn'), toast: $('toast'),
      titleScreen: $('title-screen'), startBtn: $('start-btn'),
      rewardScreen: $('reward-screen'), rewardCards: $('reward-cards'),
      rewardTitle: $('reward-title'), rewardSub: $('reward-sub'),
      overScreen: $('over-screen'), overTitle: $('over-title'), overSub: $('over-sub'),
      overStats: $('over-stats'), restartBtn: $('restart-btn'),
      spells: $('spells'), companions: $('companions'),
      muteBtn: $('mute-btn'), hint: $('hint'),
    };
    this.el.startBtn.onclick = () => { SFX.resume(); SFX.play('click'); this.startRun(); };
    this.el.restartBtn.onclick = () => { SFX.play('click'); this.startRun(); };
    this.el.fightBtn.onclick = () => { SFX.play('click'); this.startWave(); };
    this.el.muteBtn.onclick = () => { const m = SFX.toggleMute(); this.el.muteBtn.textContent = m ? '🔇' : '🔊'; };
  }

  _bindInput() {
    const c = this.canvas;
    const toWorld = (e) => {
      const r = c.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX);
      const cy = (e.touches ? e.touches[0].clientY : e.clientY);
      return { x: (cx - r.left) / r.width * this.world.W, y: (cy - r.top) / r.height * this.world.H };
    };
    const down = (e) => {
      SFX.resume();
      const p = toWorld(e); this.pointer.x = p.x; this.pointer.y = p.y; this.pointer.down = true;
      this.onPointerDown(p);
    };
    const move = (e) => { const p = toWorld(e); this.pointer.x = p.x; this.pointer.y = p.y; this.onPointerMove(p); };
    const up = (e) => { this.pointer.down = false; this.onPointerUp(this.pointer); };
    c.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _resize() {
    const stage = this.canvas.parentElement;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const scale = Math.min(sw / this.world.W, sh / this.world.H);
    this.canvas.style.width = Math.floor(this.world.W * scale) + 'px';
    this.canvas.style.height = Math.floor(this.world.H * scale) + 'px';
  }

  /* ============================ RUN / STATE ============================ */
  startRun() {
    this.units = []; this.roster = []; this.projectiles = []; this.particles = [];
    this.floaters = []; this.hazards = []; this.turrets = []; this.telegraphs = [];
    this.pulses = []; this.lure = null; this.spawnQueue = [];
    this.spells = ['water']; this.spellCd = {}; this.armed = null;
    this.passives = { hypeRegen: 1, maxHype: 100, startBonus: 0 };
    this.ownedTools = [];
    this.hype = 35; this.wave = 1; this.score = 0; this.kills = 0;
    this.bossBanner = null;

    // starting roster
    this.addGuy('gladiator'); this.addGuy('brawler');

    this.el.titleScreen.classList.add('hidden');
    this.el.overScreen.classList.add('hidden');
    this.el.rewardScreen.classList.add('hidden');
    this.buildSpellBar();
    this.enterPrep();
  }

  addGuy(id) {
    const def = DATA.GUYS[id];
    const p = this.world.pen;
    const u = new Unit(def, 'ally', 'guy', rand(p.x + 30, p.x + p.w - 30), rand(p.y + 24, p.y + p.h - 16));
    u.benched = true; u.state = 'penned';
    this.roster.push(u); this.units.push(u);
    return u;
  }

  enterPrep() {
    this.phase = 'prep';
    this.armed = null;
    // clear battle junk
    this.units = this.units.filter(u => u.side === 'ally');
    this.projectiles = []; this.spawnQueue = [];
    this.hazards = this.hazards.filter(h => h.persistent);
    this.lure = null;
    // revive & reposition allies
    for (const u of this.units) {
      u.revive();
      if (u.kind === 'guy') {
        if (u.benched) { const p = this.world.pen; u.x = rand(p.x + 30, p.x + p.w - 30); u.y = rand(p.y + 24, p.y + p.h - 16); u.state = 'penned'; }
        else { u.state = 'idle'; }
      } else { // companions roam arena
        u.state = 'idle';
        const a = this.world.arena; u.x = a.cx + rand(-60, 60); u.y = a.cy + rand(-40, 40);
      }
    }
    this.hype = clamp(this.hype + 12 + this.passives.startBonus, 0, this.passives.maxHype);

    const boss = (this.wave % 5 === 0);
    this.setBanner(boss ? `⚠ WAVE ${this.wave} — BOSS ⚠` : `WAVE ${this.wave}`,
      'Drag your Lil Guys between the cage & arena, then FIGHT!');
    this.el.fightBtn.classList.remove('hidden');
    this.el.fightBtn.textContent = boss ? 'FACE THE BOSS! 💀' : 'FIGHT! ⚔️';
    if (this.wave === 1) this.toast('Drag your two Lil Guys UP into the sandy arena!', 3.5);
    this.updateHUD();
  }

  startWave() {
    if (this.phase !== 'prep') return;
    const fighters = this.units.filter(u => u.side === 'ally' && !u.benched);
    if (fighters.length === 0) { this.toast('Drag at least one Lil Guy into the arena!'); SFX.play('deny'); return; }

    this.phase = 'battle';
    this.el.fightBtn.classList.add('hidden');
    this.armed = null;
    this.buildWave(this.wave);
    // benched allies just spectate
    for (const u of this.units) if (u.side === 'ally' && u.benched) u.state = 'penned';
    this.setBanner(`WAVE ${this.wave}`, 'Cast spells to help — battle is automatic!');
    this.updateHUD();
    SFX.play('cheer');
  }

  /* ============================ WAVES ============================ */
  buildWave(n) {
    this.spawnQueue = [];
    this.battleClock = 0;
    const hpMult = 1 + (n - 1) * 0.07;
    const dmgMult = 1 + (n - 1) * 0.035;

    if (n % 5 === 0) {
      // BOSS WAVE
      const idx = Math.floor(n / 5) - 1;
      const bossId = DATA.BOSS_ORDER[Math.min(idx, DATA.BOSS_ORDER.length - 1)];
      const extra = Math.max(0, idx - (DATA.BOSS_ORDER.length - 1)); // scale repeats
      const bScale = 1 + extra * 0.4;
      this.spawnQueue.push({ t: 1.2, id: bossId, boss: true, hpMult: bScale, dmgMult: 1 + extra * 0.15 });
      // some appetizers
      const minions = ['ant', 'spider', 'ant'];
      for (let i = 0; i < 4 + idx; i++) this.spawnQueue.push({ t: 2.5 + i * 0.9, id: pick(minions), hpMult, dmgMult });
      this.bossBanner = { text: DATA.BOSSES[bossId].intro, t: 3.4 };
      SFX.play('boss');
    } else {
      // normal wave: unlock types by progression
      const pool = [{ id: 'ant', w: 5 }];
      if (n >= 2) pool.push({ id: 'spider', w: 3 });
      if (n >= 3) pool.push({ id: 'wasp', w: 2.5 }, { id: 'beetle', w: 2 });
      if (n >= 4) pool.push({ id: 'spitter', w: 2 });
      if (n >= 6) pool.push({ id: 'grub', w: 1.4 });
      const count = Math.round(4 + n * 1.5);
      let t = 0.5;
      for (let i = 0; i < count; i++) {
        const id = this._weighted(pool);
        this.spawnQueue.push({ t, id, hpMult, dmgMult });
        t += rand(0.35, 0.8) * clamp(1.2 - n * 0.03, 0.5, 1.2);
      }
    }
    this.spawnQueue.sort((a, b) => a.t - b.t);
    this.spawnIndex = 0;
  }

  _weighted(pool) {
    let tot = 0; for (const p of pool) tot += p.w;
    let r = Math.random() * tot;
    for (const p of pool) { r -= p.w; if (r <= 0) return p.id; }
    return pool[0].id;
  }

  spawnEnemy(spec) {
    const def = spec.boss ? DATA.BOSSES[spec.id] : DATA.BUGS[spec.id];
    const a = this.world.arena;
    // spawn at a gate (top / left / right) just outside the ring
    const gate = pick(['top', 'left', 'right', 'top']);
    let ang;
    if (gate === 'top') ang = -Math.PI / 2 + rand(-0.5, 0.5);
    else if (gate === 'left') ang = Math.PI + rand(-0.4, 0.4);
    else ang = 0 + rand(-0.4, 0.4);
    const rr = 1.08;
    const x = a.cx + Math.cos(ang) * a.rx * rr;
    const y = a.cy + Math.sin(ang) * a.ry * rr;
    const u = new Unit(def, 'enemy', 'bug', x, y);
    u.hp = u.maxHp = Math.round(def.hp * (spec.hpMult || 1));
    u.dmg = Math.round(def.dmg * (spec.dmgMult || 1));
    u.spawnPop = 0.2;
    this.units.push(u);
    if (spec.boss) { this.shake(8); }
    return u;
  }

  /* ============================ MAIN LOOP ============================ */
  step(dt) {
    dt = Math.min(dt, 0.05);
    this.time += dt;

    // spawn queue (battle)
    if (this.phase === 'battle') {
      this.battleClock += dt;
      while (this.spawnIndex < this.spawnQueue.length && this.spawnQueue[this.spawnIndex].t <= this.battleClock) {
        this.spawnEnemy(this.spawnQueue[this.spawnIndex]); this.spawnIndex++;
      }
    }

    // hype regen
    if (this.phase === 'battle') this.addHype(3 * this.passives.hypeRegen * dt, true);
    else if (this.phase === 'prep') this.addHype(1.5 * dt, true);

    // spell cooldowns
    for (const k in this.spellCd) if (this.spellCd[k] > 0) this.spellCd[k] = Math.max(0, this.spellCd[k] - dt);

    // entities
    for (const u of this.units) { u.slipCd = (u.slipCd || 0) - dt; u.update(dt, this); }
    for (const p of this.projectiles) p.update(dt, this);
    this._updateTurrets(dt);
    this._updateHazards(dt);
    this._updateTelegraphs(dt);
    this._updateParticles(dt);
    if (this.lure) { this.lure.t -= dt; if (this.lure.t <= 0) this.lure = null; }
    if (this.bossBanner) { this.bossBanner.t -= dt; if (this.bossBanner.t <= 0) this.bossBanner = null; }
    if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);

    // cull
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.units = this.units.filter(u => !u.removed);

    // win / lose
    if (this.phase === 'battle') this._checkOutcome();

    this.updateHUD();
  }

  _checkOutcome() {
    const enemiesLeft = this.units.some(u => u.side === 'enemy' && u.alive);
    const queueLeft = this.spawnIndex < this.spawnQueue.length;
    const fightersLeft = this.units.some(u => u.side === 'ally' && !u.benched && u.alive);

    if (!fightersLeft) { this.gameOver(); return; }
    if (!enemiesLeft && !queueLeft) this.waveCleared();
  }

  /* ============================ OUTCOMES ============================ */
  waveCleared() {
    this.phase = 'reward';
    this.score += 20 + this.wave * 5;
    this.confetti();
    SFX.play('win');
    this.setBanner(`WAVE ${this.wave} CLEARED!`, 'The crowd goes wild!');
    // clear leftover projectiles/enemies
    this.projectiles = [];
    setTimeout(() => this.showRewards(), 700);
  }

  gameOver() {
    if (this.phase === 'over') return;
    this.phase = 'over';
    SFX.play('lose');
    this.best = Math.max(this.best, this.score);
    localStorage.setItem('lgc_best', this.best);
    this.el.overStats.innerHTML =
      `Waves survived: <b>${this.wave - 1}</b><br>Bugs squashed: <b>${this.kills}</b><br>Final score: <b>${this.score}</b><br>Best score: <b>${this.best}</b>`;
    this.el.overTitle.textContent = pick(['DEFEATED', 'SWARMED!', 'BUGGED OUT', 'THUMBS DOWN 👎']);
    this.el.overSub.textContent = pick([
      'The crowd is not amused.', 'The bugs win this round.',
      'Rome will remember your… effort.', 'Somewhere, a Caesar sighs.',
    ]);
    this.el.overScreen.classList.remove('hidden');
  }

  /* ============================ CALLBACKS FROM ENTITIES ============================ */
  onKill(u) {
    this.kills++;
    this.score += (u.def.xp || 1) * 4 + this.wave;
    this.addHype(u.def.hype || 3);
    this.poof(u.x, u.y, u.def.pal.B, u.boss ? 30 : 8);
    this.floatText(u.x, u.y - u.drawH, '✕', '#fff');
    if (chance(0.4) || u.boss) this.cheerBurst(u.boss ? 40 : 8);
    if (u.boss) { this.shake(14); SFX.play('cheer'); this.toast('BOSS DOWN! 🏆', 2.5); this.score += 100; }
    // grub splits into little ants
    if (u.def.splits) {
      for (let i = 0; i < u.def.splits; i++) {
        const s = new Unit(DATA.BUGS.ant, 'enemy', 'bug', u.x + rand(-10, 10), u.y + rand(-10, 10));
        s.spawnPop = 0.2; s.vz = rand(80, 140);
        this.units.push(s);
      }
    }
  }

  onAllyDown(u) { this.shake(4); this.cheerBurst(0); }

  allyCentroid() {
    let x = 0, y = 0, n = 0;
    for (const u of this.units) if (u.side === 'ally' && !u.benched && u.alive) { x += u.x; y += u.y; n++; }
    if (!n) return { x: this.world.arena.cx, y: this.world.arena.cy };
    return { x: x / n, y: y / n };
  }

  bossSummon(boss, id, n) {
    for (let i = 0; i < n; i++) {
      const s = new Unit(DATA.BUGS[id], 'enemy', 'bug', boss.x + rand(-24, 24), boss.y + rand(-16, 16));
      s.spawnPop = 0.2; s.vz = rand(60, 120);
      this.units.push(s);
    }
    this.poof(boss.x, boss.y, '#ff8adf', 12);
  }

  bossStomp(boss) {
    this.pulse(boss.x, boss.y, 90, '#ffcaa0');
    this.shake(9); SFX.play('boom');
    for (const u of this.units) {
      if (u.side !== 'ally' || !u.alive || u.benched) continue;
      if (dist(boss.x, boss.y, u.x, u.y) < 90) u.hurt(boss.dmg, boss.x, boss.y, 120, this, true);
    }
    this.telegraphs.push({ kind: 'shock', x: boss.x, y: boss.y, r: 10, max: 90, t: 0.35, life: 0.35 });
  }

  bossDive(boss) {
    const tgt = boss.pickTarget(this);
    if (!tgt) return;
    boss.kx += (tgt.x - boss.x) * 3; boss.ky += (tgt.y - boss.y) * 3;
    this.floatText(boss.x, boss.y - boss.drawH, 'DIVE!', '#ff5fa2', true);
    SFX.play('shoot');
  }

  /* ============================ SPELLS ============================ */
  buildSpellBar() {
    const box = this.el.spells; box.innerHTML = '';
    for (const id of this.spells) {
      const s = DATA.SPELLS[id];
      const b = document.createElement('div');
      b.className = 'spell'; b.dataset.id = id;
      b.innerHTML = `<div class="s-icon">${s.icon}</div><div class="s-cost">${s.cost}</div><div class="s-cd"></div>`;
      b.title = `${s.name} — ${s.desc}`;
      b.onclick = () => this.onSpellClick(id);
      box.appendChild(b);
    }
    // companions summary
    const cbox = this.el.companions; cbox.innerHTML = '';
    const counts = {};
    for (const t of this.ownedTools) counts[t] = (counts[t] || 0) + 1;
    for (const id in counts) {
      const def = DATA.COMPANIONS[id];
      const d = document.createElement('div'); d.className = 'comp'; d.title = `${def.name} — ${def.desc}`;
      d.innerHTML = `<span>${def.icon}</span>${counts[id] > 1 ? `<span class="c-count">${counts[id]}</span>` : ''}`;
      cbox.appendChild(d);
    }
  }

  onSpellClick(id) {
    if (this.phase !== 'battle') { this.toast('Spells can only be cast during battle!'); SFX.play('deny'); return; }
    const s = DATA.SPELLS[id];
    if ((this.spellCd[id] || 0) > 0) { SFX.play('deny'); return; }
    if (this.hype < s.cost) { this.toast('Not enough Crowd Hype!'); SFX.play('deny'); return; }
    if (s.target === 'self') { this.castSpell(id, this.world.arena.cx, this.world.arena.cy); return; }
    this.armed = (this.armed === id) ? null : id;
    SFX.play('click');
    this._refreshSpellButtons();
  }

  castSpell(id, x, y) {
    const s = DATA.SPELLS[id];
    if (this.hype < s.cost || (this.spellCd[id] || 0) > 0) { SFX.play('deny'); return; }
    this.hype -= s.cost;
    this.spellCd[id] = s.cd;
    this.armed = null;
    this._refreshSpellButtons();

    const enemies = () => this.units.filter(u => u.side === 'enemy' && u.alive);

    if (id === 'water') {
      SFX.play('splash'); this.pulse(x, y, 55, '#8fd0e0');
      for (let i = 0; i < 16; i++) this.particles.push(this._p(x, y, 8, rand(60, 200), rand(-1, 1), '#bfeaff', rand(2, 4), 260));
      this.puddle(x, y, 44, 3);
      for (const u of enemies()) if (dist(x, y, u.x, u.y) < 60 + u.radius) u.hurt(15, x - 30, y, 90, this, false);
    }
    else if (id === 'boulder') {
      this.toast('☁️ Look up…', 0.8);
      this.telegraphs.push({ kind: 'shadow', x, y, r: 8, max: 46, t: 0.7, life: 0.7, fn: () => {
        this.shake(14); SFX.play('boom'); this.boom(x, y, 70, '#8a7a66');
        this.crater(x, y, 50);
        for (const u of enemies()) if (dist(x, y, u.x, u.y) < 74 + u.radius) u.hurt(72, x, y, 160, this, true);
        for (let i = 0; i < 26; i++) this.particles.push(this._p(x, y, 4, rand(80, 260), rand(1, 4), '#9a8a72', rand(2, 5), 500));
      } });
    }
    else if (id === 'snacks') {
      SFX.play('snack'); this.addHype(14);
      for (let i = 0; i < 14; i++) this.particles.push(this._p(x, y - 30, 30, rand(40, 130), rand(-2, 0), pick(['#e0a54a', '#c96a3a', '#f0d060']), rand(2, 4), 300, '🍗'));
      this.floatText(x, y - 40, 'SNACKS! +hype', '#ffd23f', true);
      for (const u of this.units) {
        if (u.side === 'ally' && !u.benched && u.alive && dist(x, y, u.x, u.y) < 90) { u.hp = Math.min(u.maxHp, u.hp + 22); this.floatText(u.x, u.y - u.drawH, '+22', '#7bd66a'); }
        if (u.side === 'enemy' && u.alive && !u.boss && dist(x, y, u.x, u.y) < 80) { u.stun = Math.max(u.stun, 2.2); if (chance(0.5)) u.shout('yum!'); }
      }
    }
    else if (id === 'cheese') {
      SFX.play('snack'); this.lure = { x, y, t: 3.5 };
      this.hazards.push({ kind: 'cheese', x, y, radius: 20, life: 3.5, dmg: 0 });
      this.floatText(x, y - 20, 'STINKY!', '#ffe08a', true);
    }
    else if (id === 'bolt') {
      SFX.play('zap'); this.shake(5);
      const es = enemies().sort((a, b) => dist2(x, y, a.x, a.y) - dist2(x, y, b.x, b.y));
      let chain = es.slice(0, 5); let prev = { x, y };
      chain.forEach((u, i) => {
        this._lightning(prev.x, prev.y, u.x, u.y - u.z);
        u.hurt(30 - i * 3, prev.x, prev.y, 30, this, i === 0);
        u.stun = Math.max(u.stun, 0.5);
        prev = { x: u.x, y: u.y - u.z };
      });
      if (!chain.length) { this._lightning(x, y - 120, x, y); }
    }
    else if (id === 'banana') {
      SFX.play('snack');
      this.hazards.push({ kind: 'banana', x, y, radius: 26, life: 6, dmg: 0 });
      this.floatText(x, y - 16, 'slippery!', '#f0e04a');
    }
    else if (id === 'oil') {
      SFX.play('buff'); this.pulse(this.world.arena.cx, this.world.arena.cy, 200, '#e0d060');
      for (const u of this.units) if (u.side === 'ally' && !u.benched && u.alive) { u.buffHaste = 6; this.floatText(u.x, u.y - u.drawH, 'SLICK!', '#ffe08a'); }
    }
    else if (id === 'rally') {
      SFX.play('cheer'); this.cheerBurst(30); this.confetti(); this.addHype(10);
      for (const u of this.units) if (u.side === 'ally' && !u.benched && u.alive) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.35); this.floatText(u.x, u.y - u.drawH, 'ROAR!', '#7bd66a'); }
    }
  }

  _refreshSpellButtons() {
    for (const b of this.el.spells.children) {
      const id = b.dataset.id; const s = DATA.SPELLS[id];
      b.classList.toggle('armed', this.armed === id);
      const cd = this.spellCd[id] || 0;
      const cdEl = b.querySelector('.s-cd');
      if (cd > 0) { cdEl.style.height = (cd / s.cd * 100) + '%'; cdEl.textContent = Math.ceil(cd); }
      else { cdEl.style.height = '0%'; cdEl.textContent = ''; }
      b.classList.toggle('disabled', this.phase === 'battle' && (this.hype < s.cost || cd > 0));
    }
  }

  /* ============================ TURRETS / HAZARDS ============================ */
  addTurret(id) {
    const def = DATA.COMPANIONS[id];
    const a = this.world.arena;
    const idxSame = this.turrets.filter(t => t.id === id).length;
    const ang = -Math.PI / 2 + (this.turrets.length - 1.5) * 0.5 + idxSame * 0.3;
    const x = a.cx + Math.cos(ang) * a.rx * 0.92;
    const y = a.cy + Math.sin(ang) * a.ry * 0.92;
    this.turrets.push({ id, def, x, y, timer: def.cd, angle: 0 });
  }

  _updateTurrets(dt) {
    if (this.phase !== 'battle') return;
    for (const t of this.turrets) {
      const def = t.def;
      // aim at nearest enemy
      let best = null, bd = Infinity;
      for (const u of this.units) { if (u.side !== 'enemy' || !u.alive) continue; const d = dist(t.x, t.y, u.x, u.y); if (d < bd && d < def.range) { bd = d; best = u; } }
      if (best) t.angle = angleTo(t.x, t.y, best.x, best.y);
      t.timer -= dt;
      if (t.timer <= 0 && best) {
        t.timer = def.cd;
        if (def.lob) {
          this.projectiles.push(new Projectile({ x: t.x, y: t.y, z: 10, tx: best.x, ty: best.y, speed: 220, dmg: def.dmg, side: 'ally', knock: 40, color: '#d87a3a', kind: 'rock', splash: def.splash, lob: true }));
          SFX.play('shoot');
        } else {
          this.projectiles.push(new Projectile({ x: t.x, y: t.y - 6, z: 12, tx: best.x, ty: best.y - best.z, speed: def.proj.speed, dmg: def.dmg, side: 'ally', knock: 20, color: def.proj.color, kind: def.proj.kind }));
          SFX.play('arrow');
        }
      }
    }
  }

  addHazardTool(id) {
    const def = DATA.COMPANIONS[id];
    const a = this.world.arena;
    const x = a.cx + rand(-a.rx * 0.4, a.rx * 0.4);
    const y = a.cy + rand(-a.ry * 0.4, a.ry * 0.4);
    this.hazards.push({ kind: def.hazard, x, y, radius: def.radius, dmg: def.dmg, slow: def.slow || 0, persistent: true, tick: 0 });
  }

  _updateHazards(dt) {
    for (const h of this.hazards) {
      if (!h.persistent && h.life !== undefined) { h.life -= dt; }
      h.tick = (h.tick || 0) - dt;
      const doTick = h.tick <= 0;
      if (doTick) h.tick = 0.3;
      if (this.phase !== 'battle') continue;
      for (const u of this.units) {
        if (u.side !== 'enemy' || !u.alive) continue;
        const d = dist(h.x, h.y, u.x, u.y);
        if (d > h.radius + u.radius) continue;
        if (h.kind === 'fire' && doTick) { u.hurt(h.dmg, h.x, h.y, 0, this, false); this.particles.push(this._p(u.x, u.y - 10, 6, 40, -2, pick(['#ff8a3a', '#ffd23f']), 3, 60)); }
        else if (h.kind === 'caltrop') { if (doTick) u.hurt(h.dmg, h.x, h.y, 0, this, false); u.slow = 0.3; }
        else if (h.kind === 'banana') {
          if ((u.slipCd || 0) <= 0 && !u.boss) {
            u.slipCd = 2.5; u.stun = Math.max(u.stun, 1.1); u.vz = 130;
            u.kx += rand(-120, 120); u.ky += rand(-120, 120);
            this.floatText(u.x, u.y - u.drawH, 'SLIP!', '#ffe08a', true); SFX.play('hop');
          }
        }
        else if (h.kind === 'acidpuddle' && doTick) { u.slow = 0.3; }
      }
    }
    this.hazards = this.hazards.filter(h => h.persistent || h.life === undefined || h.life > 0);
  }

  _updateTelegraphs(dt) {
    for (const t of this.telegraphs) { t.life -= dt; if (t.life <= 0 && t.fn && !t.done) { t.done = true; t.fn(); } }
    this.telegraphs = this.telegraphs.filter(t => t.life > -0.2);
  }

  /* ============================ POINTER / DRAG & DROP ============================ */
  onPointerDown(p) {
    if (this.phase === 'prep') {
      const u = this._guyAt(p.x, p.y);
      if (u) { this.dragging = u; u.state = 'dragging'; u.vx = u.vy = 0; SFX.play('place'); return; }
    }
    if (this.phase === 'battle' && this.armed) {
      const s = DATA.SPELLS[this.armed];
      if (this._validCastPoint(p.x, p.y)) this.castSpell(this.armed, p.x, p.y);
      else { this.toast('Aim inside the arena!'); SFX.play('deny'); }
    }
  }

  onPointerMove(p) {
    if (this.dragging) {
      this.dragging.x = clamp(p.x, 8, this.world.W - 8);
      this.dragging.y = clamp(p.y, 8, this.world.pen.y + this.world.pen.h - 8);
      this.dragging.z = 34;
    }
  }

  onPointerUp(p) {
    if (!this.dragging) return;
    const u = this.dragging; this.dragging = null; u.z = 0; u.vz = 40;
    const a = this.world.arena;
    if (inEllipse(u.x, u.y, a.cx, a.cy, a.rx * 0.96, a.ry * 0.96)) {
      u.benched = false; u.state = 'idle'; SFX.play('place');
    } else {
      // send to cage
      u.benched = true; u.state = 'penned';
      const pen = this.world.pen;
      u.y = clamp(u.y, pen.y + 20, pen.y + pen.h - 14);
      if (u.y < pen.y + 18) { u.x = clamp(u.x, pen.x + 20, pen.x + pen.w - 20); u.y = pen.y + 40; }
      SFX.play('place');
    }
    this.updateHUD();
  }

  _guyAt(x, y) {
    // grab any guy whose body column contains the pointer (forgiving; they bob)
    let best = null, bestD = 1e9;
    for (const u of this.units) {
      if (u.side !== 'ally' || u.kind !== 'guy') continue;
      const by = u.y - u.z;                 // feet on screen
      const dx = Math.abs(x - u.x);
      if (dx < 18 && y > by - u.drawH - 10 && y < u.y + 10) {
        const d = dx + Math.abs(y - (by - u.drawH * 0.5));
        if (d < bestD) { bestD = d; best = u; }
      }
    }
    return best;
  }

  _validCastPoint(x, y) {
    const a = this.world.arena;
    return inEllipse(x, y, a.cx, a.cy, a.rx * 1.05, a.ry * 1.05);
  }

  /* ============================ REWARDS ============================ */
  showRewards() {
    this.el.rewardScreen.classList.remove('hidden');
    const boss = (this.wave % 5 === 0);
    this.el.rewardTitle.textContent = boss ? 'BOSS SLAIN!' : `WAVE ${this.wave} CLEARED!`;
    this.el.rewardSub.textContent = 'The crowd roars! Choose your spoils:';
    const cards = this.rollRewards();
    this.el.rewardCards.innerHTML = '';
    for (const c of cards) {
      const el = document.createElement('div');
      el.className = 'rcard';
      el.innerHTML = `<div class="rc-icon">${c.icon}</div><div class="rc-tag ${c.type}">${c.type}</div>` +
        `<div class="rc-name">${c.name}</div><div class="rc-desc">${c.desc}</div>`;
      el.onclick = () => { SFX.play('reward'); this.applyReward(c); };
      this.el.rewardCards.appendChild(el);
    }
    SFX.play('reward');
  }

  rollRewards() {
    const cat = { recruit: [], spell: [], tool: [] };
    // recruits — any guy type (duplicates allowed, roster grows)
    for (const id of shuffle(Object.keys(DATA.GUYS)).slice(0, 4)) {
      const g = DATA.GUYS[id];
      cat.recruit.push({ type: 'recruit', id, icon: g.icon, name: g.name, desc: g.blurb });
    }
    // spells not owned
    for (const id of Object.keys(DATA.SPELLS)) {
      if (this.spells.includes(id)) continue;
      const s = DATA.SPELLS[id];
      cat.spell.push({ type: 'spell', id, icon: s.icon, name: s.name, desc: s.desc });
    }
    // tools/companions: unique passives+companions; turrets/hazards repeatable
    for (const id of Object.keys(DATA.COMPANIONS)) {
      const d = DATA.COMPANIONS[id];
      const unique = (d.kind === 'passive' || d.kind === 'companion');
      if (unique && this.ownedTools.includes(id)) continue;
      cat.tool.push({ type: 'tool', id, icon: d.icon, name: d.name, desc: d.desc });
    }
    // fallback tool so a category never runs dry
    const feast = { type: 'tool', id: 'feast', icon: '🍖', name: 'Grand Feast', desc: 'Fully heal your squad & +18 max Crowd Hype. Always tasty.' };

    // pick 3, prefer one from each category
    const order = shuffle(['recruit', 'spell', 'tool']);
    const chosen = []; const usedIds = new Set();
    const drawFrom = (arr) => {
      const opts = shuffle(arr).filter(c => !usedIds.has(c.type + c.id));
      if (!opts.length) return null; const c = opts[0]; usedIds.add(c.type + c.id); return c;
    };
    for (const k of order) { const c = drawFrom(cat[k]); if (c) chosen.push(c); }
    // fill remaining slots from any pool (spells might be empty later, etc.)
    const all = [...cat.recruit, ...cat.spell, ...cat.tool, feast];
    while (chosen.length < 3) {
      const c = drawFrom(all);
      if (!c) { chosen.push(feast); break; }
      chosen.push(c);
    }
    return chosen.slice(0, 3);
  }

  applyReward(c) {
    this.el.rewardScreen.classList.add('hidden');
    if (c.type === 'recruit') {
      const u = this.addGuy(c.id);
      // auto-deploy the recruit into the arena so they join right away
      const a = this.world.arena; u.benched = false; u.state = 'idle';
      u.x = a.cx + rand(-80, 80); u.y = a.cy + rand(-50, 50);
      this.toast(`Recruited a ${c.name}! 🎉`, 2.2);
    } else if (c.type === 'spell') {
      this.spells.push(c.id); this.buildSpellBar();
      this.toast(`New spell: ${c.name} ${c.icon}`, 2.2);
    } else if (c.type === 'tool') {
      this.applyTool(c);
    }
    this.wave++;
    this.enterPrep();
  }

  applyTool(c) {
    if (c.id === 'feast') {
      this.passives.maxHype += 18;
      for (const u of this.units) if (u.side === 'ally') u.revive();
      this.toast('A grand feast! Squad healed. 🍖', 2.2);
      return;
    }
    const def = DATA.COMPANIONS[c.id];
    this.ownedTools.push(c.id);
    if (def.kind === 'companion') {
      const a = this.world.arena;
      const u = new Unit(def, 'ally', 'companion', a.cx + rand(-60, 60), a.cy + rand(-40, 40));
      u.benched = false; u.state = 'idle';
      this.units.push(u); this.roster.push(u);
      this.toast(`${def.name} joins the arena! ${def.icon}`, 2.2);
    } else if (def.kind === 'turret') {
      this.addTurret(c.id); this.toast(`${def.name} deployed! ${def.icon}`, 2.2);
    } else if (def.kind === 'hazard') {
      this.addHazardTool(c.id); this.toast(`${def.name} placed! ${def.icon}`, 2.2);
    } else if (def.kind === 'passive') {
      if (def.passive === 'hypeRegen') this.passives.hypeRegen += 0.5;
      if (def.passive === 'maxHype') { this.passives.maxHype += 30; this.passives.startBonus += 15; }
      this.toast(`${def.name} — permanent boon! ${def.icon}`, 2.2);
    }
    this.buildSpellBar();
  }

  /* ============================ FX HELPERS ============================ */
  addProjectile(p) { this.projectiles.push(p); }
  sfx(n) { SFX.play(n); }
  shake(a) { this.shakeAmt = Math.min(20, this.shakeAmt + a); }
  addHype(n, silent) { this.hype = clamp(this.hype + n, 0, this.passives.maxHype); }
  setBanner(a, b) { this.el.banner.textContent = a; this.el.waveSub.textContent = b; }

  _p(x, y, z, sp, vzMul, color, size, grav, glyph) {
    const a = rand(0, TAU);
    return { x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rand(40, 160) * (vzMul === undefined ? 1 : 1) + (vzMul || 0) * 40, life: rand(0.4, 0.9), color, size: size || 3, grav: grav || 200, glyph };
  }
  spawnHit(x, y, color, n) {
    for (let i = 0; i < n; i++) this.particles.push(this._p(x, y, 0, rand(40, 140), 1, color, rand(2, 4), 260));
  }
  poof(x, y, color, n) {
    for (let i = 0; i < n; i++) this.particles.push(this._p(x, y, rand(0, 8), rand(30, 130), 1, i % 3 ? color : '#fff', rand(2, 5), 220));
  }
  boom(x, y, r, color) {
    this.pulse(x, y, r, color);
    for (let i = 0; i < 22; i++) this.particles.push(this._p(x, y, 4, rand(80, 260), 2, i % 2 ? color : '#ffd23f', rand(2, 5), 320));
  }
  puddle(x, y, r, dur) { this.hazards.push({ kind: 'acidpuddle', x, y, radius: r || 40, life: dur || 3, dmg: 0, slow: 0.5, tick: 0, color: '#8fd0e0' }); }
  crater(x, y, r) { this.hazards.push({ kind: 'crater', x, y, radius: r, life: 6, dmg: 0 }); }
  pulse(x, y, r, color) { this.pulses.push({ x, y, r: 6, max: r, life: 0.45, t: 0.45, color }); }
  healSparkle(x, y) { for (let i = 0; i < 6; i++) this.particles.push(this._p(x, y, 0, rand(10, 40), 2, '#7bd66a', 3, -30, '✚')); }
  cheerBurst(n) {
    // confetti from the stands
    for (let i = 0; i < (n || 6); i++) {
      const x = rand(40, this.world.W - 40), y = rand(20, this.world.arena.cy - 40);
      this.particles.push({ x, y, z: 0, vx: rand(-30, 30), vy: rand(20, 80), vz: 0, life: rand(0.8, 1.6), color: pick(['#ff5fa2', '#ffd23f', '#7bd66a', '#5fa2ff', '#fff']), size: 3, grav: -20, glyph: null, confetti: true });
    }
  }
  confetti() { this.cheerBurst(60); }
  floatText(x, y, text, color, big) { this.floaters.push({ x, y, text, color, big, life: big ? 1.1 : 0.8, vy: -34 }); }
  _lightning(x1, y1, x2, y2) { this.pulses.push({ kind: 'bolt', x1, y1, x2, y2, life: 0.18, t: 0.18, color: '#bfe0ff' }); }

  _updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (!p.confetti) { p.z += (p.vz || 0) * dt; p.vz -= (p.grav || 200) * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.4; p.vx *= 0.6; } }
      else { p.x += Math.sin((p.life + p.x) * 8) * 20 * dt; }
    }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const f of this.floaters) { f.life -= dt; f.y += f.vy * dt; f.vy += 30 * dt; }
    this.floaters = this.floaters.filter(f => f.life > 0);
    for (const pl of this.pulses) pl.life -= dt;
    this.pulses = this.pulses.filter(pl => pl.life > 0);
  }

  /* ============================ RENDER ============================ */
  render() {
    const ctx = this.ctx, w = this.world;
    ctx.save();
    if (this.shakeAmt > 0.2) ctx.translate(rand(-this.shakeAmt, this.shakeAmt), rand(-this.shakeAmt, this.shakeAmt));

    ART.drawArena(ctx, w, this.time, this.hype);

    // ground decals & hazards (under units)
    this._drawHazards(ctx);
    this._drawTelegraphs(ctx, false);
    this._drawPulses(ctx, false);

    // pen
    ART.drawPen(ctx, w, this.time);

    // depth-sorted actors
    const actors = [];
    for (const u of this.units) actors.push({ y: u.y, d: u, kind: 'u' });
    for (const t of this.turrets) actors.push({ y: t.y, d: t, kind: 't' });
    for (const p of this.projectiles) actors.push({ y: p.y, d: p, kind: 'p' });
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) {
      if (a.kind === 'u') a.d.draw(ctx, this);
      else if (a.kind === 't') this._drawTurret(ctx, a.d);
      else a.d.draw(ctx);
    }

    // overhead fx
    this._drawTelegraphs(ctx, true);
    this._drawPulses(ctx, true);
    this._drawParticles(ctx);
    this._drawFloaters(ctx);

    // drag hint / spell aim
    if (this.dragging) this._drawDropHint(ctx);
    if (this.armed && this.phase === 'battle') this._drawAim(ctx);

    // boss banner
    if (this.bossBanner) this._drawBossBanner(ctx);

    // subtle vignette
    const vg = ctx.createRadialGradient(w.W / 2, w.arena.cy, 200, w.W / 2, w.arena.cy, 620);
    vg.addColorStop(0, '#0000'); vg.addColorStop(1, '#0007');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w.W, w.H);

    ctx.restore();
  }

  _drawHazards(ctx) {
    for (const h of this.hazards) {
      ctx.save();
      if (h.kind === 'crater') {
        ctx.globalAlpha = clamp(h.life / 6, 0, 1) * 0.6; ctx.fillStyle = '#5a4a34';
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.radius, h.radius * 0.5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3a2e20'; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.radius * 0.6, h.radius * 0.3, 0, 0, TAU); ctx.fill();
      } else if (h.kind === 'acidpuddle') {
        ctx.globalAlpha = clamp(h.life / 3, 0, 1) * 0.5; ctx.fillStyle = h.color || '#8fd0e0';
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.radius, h.radius * 0.45, 0, 0, TAU); ctx.fill();
      } else if (h.kind === 'fire') {
        ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff6a2a';
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.radius, h.radius * 0.45, 0, 0, TAU); ctx.fill();
        for (let i = 0; i < 5; i++) { const a = this.time * 3 + i; ctx.fillStyle = i % 2 ? '#ffd23f' : '#ff8a3a'; ctx.globalAlpha = 0.7; const fx = h.x + Math.cos(a) * h.radius * 0.6, fy = h.y + Math.sin(a * 1.3) * h.radius * 0.3; ctx.fillRect(fx - 2, fy - 6 - (Math.sin(this.time * 8 + i) + 1) * 3, 4, 8); }
      } else if (h.kind === 'caltrop') {
        ctx.globalAlpha = 0.7; ctx.fillStyle = '#8a8a94';
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; const cx = h.x + Math.cos(a) * h.radius * rand(0.3, 0.95), cy = h.y + Math.sin(a) * h.radius * 0.5 * rand(0.3, 0.95); ctx.fillRect(cx - 1, cy - 1, 2, 2); }
        ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.radius, h.radius * 0.5, 0, 0, TAU); ctx.fill();
      } else if (h.kind === 'cheese') {
        const pop = Math.sin(this.time * 6) * 2;
        ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.fillText('🧀', h.x, h.y + 6 + pop);
        ctx.globalAlpha = 0.2 + Math.sin(this.time * 5) * 0.1; ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, 40 + pop, 20, 0, 0, TAU); ctx.stroke();
      } else if (h.kind === 'banana') {
        ctx.globalAlpha = clamp(h.life / 6, 0, 1);
        ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.fillText('🍌', h.x, h.y + 6);
        ctx.globalAlpha *= 0.25; ctx.fillStyle = '#f0e04a'; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.radius, h.radius * 0.5, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  _drawTelegraphs(ctx, overhead) {
    for (const t of this.telegraphs) {
      const prog = 1 - clamp(t.life / (t.max2 || 0.7), 0, 1);
      if (t.kind === 'shadow' && !overhead) {
        const r = lerp(8, t.max, prog);
        ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(t.x, t.y, r, r * 0.5, 0, 0, TAU); ctx.fill();
        // falling rock
        const rz = lerp(-260, 0, prog);
        ctx.fillStyle = '#7a6a52'; ctx.strokeStyle = '#4a3e2e'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(t.x, t.y + rz, t.max * 0.8, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
      } else if (t.kind === 'shock' && overhead) {
        const r = lerp(10, t.max, 1 - t.life / 0.35);
        ctx.save(); ctx.globalAlpha = clamp(t.life / 0.35, 0, 1); ctx.strokeStyle = '#ffcaa0'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.ellipse(t.x, t.y, r, r * 0.5, 0, 0, TAU); ctx.stroke(); ctx.restore();
      }
    }
  }

  _drawPulses(ctx, overhead) {
    for (const p of this.pulses) {
      const a = clamp(p.life / p.t, 0, 1);
      if (p.kind === 'bolt') {
        if (!overhead) continue;
        ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.shadowColor = '#bfe0ff'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(p.x1, p.y1);
        const seg = 5; for (let i = 1; i < seg; i++) { const tt = i / seg; ctx.lineTo(lerp(p.x1, p.x2, tt) + rand(-6, 6), lerp(p.y1, p.y2, tt) + rand(-6, 6)); }
        ctx.lineTo(p.x2, p.y2); ctx.stroke(); ctx.restore();
      } else {
        if (overhead) continue;
        const r = lerp(p.max, p.r, a);
        ctx.save(); ctx.globalAlpha = a * 0.7; ctx.strokeStyle = p.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.5, 0, 0, TAU); ctx.stroke(); ctx.restore();
      }
    }
  }

  _drawParticles(ctx) {
    for (const p of this.particles) {
      const a = clamp(p.life / 0.9, 0, 1);
      const dy = p.y - (p.z || 0);
      ctx.globalAlpha = a;
      if (p.glyph) { ctx.font = (p.size * 4) + 'px serif'; ctx.textAlign = 'center'; ctx.fillText(p.glyph, p.x, dy); }
      else { ctx.fillStyle = p.color; if (p.confetti) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 8); ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 2); ctx.restore(); } else ctx.fillRect(p.x - p.size / 2, dy - p.size / 2, p.size, p.size); }
    }
    ctx.globalAlpha = 1;
  }

  _drawFloaters(ctx) {
    ctx.textAlign = 'center';
    for (const f of this.floaters) {
      const a = clamp(f.life / 0.8, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `bold ${f.big ? 15 : 11}px "Courier New", monospace`;
      ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  _drawTurret(ctx, t) {
    ART.drawShadow(ctx, t.x, t.y + 2, 12, 0.3);
    ctx.save(); ctx.translate(t.x, t.y);
    // base
    ctx.fillStyle = '#5a3f27'; ctx.fillRect(-8, -4, 16, 10);
    ctx.fillStyle = '#3a2716'; ctx.fillRect(-8, 4, 16, 3);
    // arm rotates to aim
    ctx.rotate(t.angle);
    if (t.def.lob) { ctx.fillStyle = '#6b4a2a'; ctx.fillRect(-4, -3, 16, 6); ctx.fillStyle = '#d87a3a'; ctx.beginPath(); ctx.arc(12, 0, 4, 0, TAU); ctx.fill(); }
    else { ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(14, 0); ctx.stroke(); ctx.strokeStyle = '#c9b088'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(2, -6); ctx.lineTo(2, 6); ctx.stroke(); }
    ctx.restore();
    ctx.font = '10px serif'; ctx.textAlign = 'center'; ctx.fillText(t.def.icon, t.x, t.y - 12);
  }

  _drawDropHint(ctx) {
    const a = this.world.arena;
    ctx.save(); ctx.setLineDash([8, 6]); ctx.lineWidth = 3;
    const inArena = inEllipse(this.dragging.x, this.dragging.y, a.cx, a.cy, a.rx * 0.96, a.ry * 0.96);
    ctx.strokeStyle = inArena ? '#7bd66a' : '#e0c04a'; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.ellipse(a.cx, a.cy, a.rx * 0.96, a.ry * 0.96, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  _drawAim(ctx) {
    const s = DATA.SPELLS[this.armed];
    const r = { water: 60, boulder: 74, snacks: 80, cheese: 60, bolt: 50, banana: 26 }[this.armed] || 40;
    const ok = this._validCastPoint(this.pointer.x, this.pointer.y);
    ctx.save(); ctx.globalAlpha = 0.6; ctx.lineWidth = 2; ctx.strokeStyle = ok ? '#ff5fa2' : '#e05a4a'; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.ellipse(this.pointer.x, this.pointer.y, r, r * 0.5, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]); ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.fillText(s.icon, this.pointer.x, this.pointer.y + 6);
    ctx.restore();
  }

  _drawBossBanner(ctx) {
    const b = this.bossBanner; const a = clamp(b.t / 3.4, 0, 1);
    ctx.save(); ctx.globalAlpha = Math.min(1, a * 2);
    ctx.fillStyle = '#000a'; ctx.fillRect(0, this.world.arena.cy - 34, this.world.W, 68);
    ctx.fillStyle = '#ff5fa2'; ctx.font = 'bold 24px "Courier New", monospace'; ctx.textAlign = 'center';
    ctx.fillText('⚠ BOSS ⚠', this.world.W / 2, this.world.arena.cy - 6);
    ctx.fillStyle = '#ffe08a'; ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
    ctx.fillText(b.text, this.world.W / 2, this.world.arena.cy + 18);
    ctx.restore();
  }

  /* ============================ HUD ============================ */
  updateHUD() {
    const guys = this.units.filter(u => u.side === 'ally' && u.kind === 'guy').length;
    this.el.waveVal.textContent = this.wave;
    this.el.rosterVal.textContent = guys;
    this.el.scoreVal.textContent = this.score;
    const frac = clamp(this.hype / this.passives.maxHype, 0, 1) * 100;
    this.el.hypeFill.style.width = frac + '%';
    this.el.hypeTxt.textContent = Math.floor(this.hype) + '/' + this.passives.maxHype;
    if (this.phase === 'battle') this._refreshSpellButtons();
  }

  toast(msg, dur) {
    const t = this.el.toast; t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.add('hidden'), (dur || 2) * 1000);
  }
}
