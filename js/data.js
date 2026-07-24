/* ===========================================================
   data.js — all game content: Lil Guys, Bugs, Bosses, Spells,
   Companions/Tools, and the reward pool.  Global: DATA
   =========================================================== */

const DATA = (() => {

  // palette for the human sprite chars (o h H p k s e a A t T b).
  // Pass base colours; light/shadow variants are derived automatically.
  const gp = (o, skin, helm, plume, armor, tunic, belt, eye) => ({
    o, h: helm, H: shade(helm, 0.42), p: plume,
    k: skin, s: shade(skin, -0.3), e: eye,
    a: armor, A: shade(armor, 0.38), t: tunic, T: shade(tunic, -0.32), b: belt,
    _: o,
  });
  // palette for BUG sprite chars: o B W E M
  const bp = (o, b, w, e, m) => ({ o, B: b, W: w, E: e, M: m, _: o });

  /* ---------------- LIL GUYS (playable fighters) ----------------
     atk types: melee | ranged | heal | buff
     weapon (drawn in code): sword spear bow fists shield staff drum
     gp(outline, skin, helmet, plume, armor, tunic, belt, eye)
  */
  const GUYS = {
    gladiator: {
      id: 'gladiator', name: 'Gladiator', icon: '🗡️', weapon: 'sword', body: 'GUY',
      hp: 62, dmg: 11, range: 30, cd: 0.72, speed: 62, knock: 40, atk: 'melee',
      pal: gp('#241a12', '#d99a6c', '#c9962f', '#c0392b', '#c39a44', '#efe3c8', '#7a4a22', '#1a1008'),
      blurb: 'Reliable sword-swinger. Good at everything, master of nothing.',
      shouts: ['FOR ROME!', 'HYAA!', 'TASTE STEEL!', 'poke!', 'en garde!'],
    },
    brawler: {
      id: 'brawler', name: 'Lil Boxer', icon: '🥊', weapon: 'fists', body: 'GUY',
      hp: 74, dmg: 7, range: 24, cd: 0.34, speed: 78, knock: 55, atk: 'melee',
      pal: gp('#241a12', '#e2a878', '#8a4a2a', '#e0c04a', '#b2402f', '#c94a3a', '#5a3a1a', '#1a1008'),
      blurb: 'Fast fists, big punches, tiny brain. Knocks bugs flying.',
      shouts: ['ONE-TWO!', 'BONK!', 'jab jab!', 'ha! HA!', 'come here!'],
    },
    spearman: {
      id: 'spearman', name: 'Spearman', icon: '🔱', weapon: 'spear', body: 'GUY',
      hp: 52, dmg: 10, range: 52, cd: 0.82, speed: 58, knock: 30, atk: 'melee',
      pal: gp('#241a12', '#caa07a', '#9aa0b0', '#3a7ab0', '#8a9099', '#d8d2c0', '#4a5a6a', '#1a1008'),
      blurb: 'Pokes from a safe-ish distance. Personal space enthusiast.',
      shouts: ['POKE!', 'stay back!', 'jab!', 'this end sharp!', 'reach!'],
    },
    archer: {
      id: 'archer', name: 'Archer', icon: '🏹', weapon: 'bow', body: 'GUY',
      hp: 40, dmg: 9, range: 210, cd: 1.0, speed: 60, knock: 10, atk: 'ranged',
      proj: { speed: 300, color: '#caa15a', kind: 'arrow' },
      pal: gp('#241a12', '#c99a6a', '#3f6a33', '#7bd66a', '#4d7a3a', '#6b9a54', '#3a5a2a', '#1a1008'),
      blurb: 'Plinks bugs from across the arena. Please protect the archer.',
      shouts: ['thwip!', 'nailed it!', 'FIRE!', 'skoosh!', 'headshot?'],
    },
    tank: {
      id: 'tank', name: 'Shieldbro', icon: '🛡️', weapon: 'shield', body: 'TANK',
      hp: 150, dmg: 5, range: 26, cd: 1.05, speed: 44, knock: 45, atk: 'melee',
      taunt: 1.9, dr: 0.4, // draws aggro; reduces incoming damage 40%
      pal: gp('#241a12', '#d9a173', '#8a8a94', '#b23a30', '#9aa0aa', '#7a808a', '#42424c', '#1a1008'),
      blurb: 'A wall with legs. Bugs love hitting it. Barely notices.',
      shouts: ['THIS WAY!', 'hit ME!', 'nnngh!', 'wall!', 'come at me!'],
    },
    medic: {
      id: 'medic', name: 'Medicus', icon: '➕', weapon: 'staff', body: 'GUY',
      hp: 46, dmg: 0, range: 170, cd: 1.15, speed: 58, heal: 9, atk: 'heal',
      pal: gp('#241a12', '#e8bd95', '#e8e2d2', '#4bbf6a', '#f2ede0', '#f2ede0', '#8a8478', '#1a1008'),
      blurb: 'Waves a leafy stick and your guys stop dying. Very handy.',
      shouts: ['patched!', 'stay alive!', 'boop, healed', 'drink this!', 'nurse!'],
    },
    drummer: {
      id: 'drummer', name: 'War Drummer', icon: '🥁', weapon: 'drum', body: 'GUY',
      hp: 58, dmg: 3, range: 130, cd: 1.4, speed: 56, buffHaste: 0.4, atk: 'buff',
      pal: gp('#241a12', '#c98a5a', '#b0762f', '#e0c04a', '#7a337a', '#8a3a8a', '#4a2149', '#1a1008'),
      blurb: 'Bangs a war-drum — nearby guys attack noticeably faster.',
      shouts: ['BOOM BAP!', 'faster!', 'ratatat!', 'feel it!', 'LOUDER!'],
    },
  };

  /* ---------------- BUGS (enemies) ---------------- */
  const BUGS = {
    ant: {
      id: 'ant', name: 'Fire Ant', body: 'SLIMBUG', hp: 22, dmg: 6, range: 18, cd: 0.85,
      speed: 66, scale: 1, knock: 12, xp: 1, hype: 3,
      pal: bp('#3a1206', '#c0402a', '#e07a4a', '#2a0a04', '#7a1a0a'),
    },
    beetle: {
      id: 'beetle', name: 'Stone Beetle', body: 'ROUNDBUG', hp: 78, dmg: 11, range: 20, cd: 1.15,
      speed: 30, scale: 1.15, knock: 8, tanky: true, xp: 3, hype: 6,
      pal: bp('#141018', '#3b4658', '#5a6b82', '#8fd0e0', '#0a0a10'),
    },
    wasp: {
      id: 'wasp', name: 'Wasp', body: 'SLIMBUG', hp: 30, dmg: 8, range: 20, cd: 0.7,
      speed: 84, scale: 0.95, knock: 10, fly: true, xp: 2, hype: 5,
      pal: bp('#2a2205', '#e0b81f', '#fff07a', '#201800', '#5a4a00'),
    },
    spider: {
      id: 'spider', name: 'Spider', body: 'SLIMBUG', hp: 34, dmg: 7, range: 18, cd: 0.6,
      speed: 74, scale: 1.05, knock: 8, legs: 8, xp: 2, hype: 5,
      pal: bp('#0a0a0e', '#26232e', '#4a4658', '#c02a4a', '#050508'),
    },
    spitter: {
      id: 'spitter', name: 'Acid Spitter', body: 'BUG', hp: 42, dmg: 8, range: 190, cd: 1.7,
      speed: 28, scale: 1.05, knock: 6, xp: 3, hype: 6,
      proj: { speed: 190, color: '#8ce06a', kind: 'acid' },
      pal: bp('#12200a', '#4a7a2a', '#7bd64a', '#c8ff8a', '#0a1405'),
    },
    grub: {
      id: 'grub', name: 'Fat Grub', body: 'ROUNDBUG', hp: 130, dmg: 13, range: 22, cd: 1.3,
      speed: 20, scale: 1.35, knock: 6, tanky: true, splits: 2, xp: 4, hype: 8,
      pal: bp('#3a2a2a', '#d8b0a8', '#f0d8c8', '#5a3a3a', '#8a5a5a'),
    },
  };

  /* ---------------- BOSSES (every 5 waves) ---------------- */
  const BOSSES = {
    queen: {
      id: 'queen', name: 'QUEEN BEETLE', body: 'ROUNDBUG', boss: true,
      hp: 900, dmg: 20, range: 34, cd: 1.6, speed: 24, scale: 3.4, knock: 30,
      xp: 30, hype: 40, ability: 'stomp', summon: 'ant', summonEvery: 4.5, summonN: 3,
      pal: bp('#0e0a14', '#4a2f6a', '#7a4fa0', '#e0b8ff', '#060409'),
      intro: 'The QUEEN BEETLE skitters in! She stomps and spawns swarms!',
    },
    vespa: {
      id: 'vespa', name: 'VESPA MAXIMA', body: 'SLIMBUG', boss: true, fly: true,
      hp: 1300, dmg: 18, range: 200, cd: 1.3, speed: 40, scale: 3.2, knock: 20,
      xp: 40, hype: 50, ability: 'divebomb', summon: 'wasp', summonEvery: 5, summonN: 3,
      proj: { speed: 240, color: '#8ce06a', kind: 'acid' },
      pal: bp('#2a2205', '#e0a81f', '#fff07a', '#201800', '#5a4a00'),
      intro: 'VESPA MAXIMA descends! Dive-bombs, acid, and a wasp entourage!',
    },
    broodmother: {
      id: 'broodmother', name: 'THE BROODMOTHER', body: 'ROUNDBUG', boss: true,
      hp: 1900, dmg: 22, range: 34, cd: 1.4, speed: 30, scale: 3.6, knock: 26,
      xp: 55, hype: 60, ability: 'stomp', summon: 'spider', summonEvery: 3.6, summonN: 4,
      pal: bp('#0a0a0e', '#2a2632', '#5a5468', '#e02a5a', '#050508'),
      intro: 'THE BROODMOTHER emerges! Endless spiders pour from the gates!',
    },
  };
  const BOSS_ORDER = ['queen', 'vespa', 'broodmother'];

  /* ---------------- SPELLS ---------------- */
  // target: 'point' (click arena) | 'self'
  const SPELLS = {
    water: {
      id: 'water', name: 'Water Syringe', icon: '💉', cost: 20, cd: 3.5, target: 'point',
      desc: 'Blast a jet of water — damages & shoves a line of bugs. Cheap & spammable.',
    },
    boulder: {
      id: 'boulder', name: 'Giant Rock', icon: '🪨', cost: 40, cd: 7, target: 'point',
      desc: 'Drops an ENORMOUS boulder from the sky. Huge smash damage + crater.',
    },
    snacks: {
      id: 'snacks', name: 'Snack Toss', icon: '🍗', cd: 5, target: 'point',
      desc: 'Fling snacks: heals your guys and distracts nearby bugs (they stop to eat).',
    },
    cheese: {
      id: 'cheese', name: 'Cheese Lure', icon: '🧀', cost: 16, cd: 6, target: 'point',
      desc: 'Drop a stinky cheese that yanks bugs into a tidy pile. Combo with the rock!',
    },
    bolt: {
      id: 'bolt', name: "Jupiter's Bolt", icon: '⚡', cost: 34, cd: 6.5, target: 'point',
      desc: 'Lightning zaps a bug and chains to nearby bugs. Very theatrical.',
    },
    banana: {
      id: 'banana', name: 'Banana Peel', icon: '🍌', cost: 14, cd: 5, target: 'point',
      desc: 'A slippery patch — bugs that cross it slip, stun, and look ridiculous.',
    },
    oil: {
      id: 'oil', name: 'Olive Oil', icon: '🫒', cost: 24, cd: 9, target: 'self',
      desc: 'Slick your whole squad: +60% attack speed & move speed for 6 seconds.',
    },
    rally: {
      id: 'rally', name: 'Battle Roar', icon: '📣', cd: 8, target: 'self',
      desc: 'A mighty roar: instantly heal your whole squad for a big chunk of HP.',
    },
  };

  /* ---------------- COMPANIONS / TOOLS (passive helpers) ---------------- */
  // kind: 'companion' (roams & fights) | 'turret' (fixed, auto-fires) |
  //       'hazard' (arena floor effect) | 'passive' (stat)
  const COMPANIONS = {
    goose: {
      id: 'goose', name: 'Angry Goose', icon: '🦢', kind: 'companion',
      hp: 60, dmg: 9, range: 26, cd: 0.5, speed: 95, knock: 40, atk: 'melee',
      body: 'GOOSE', scale: 1.15,
      pal: { o: '#2a2018', w: '#f6f5f0', W: '#d2d0c6', b: '#e6a81c', e: '#160e06', f: '#d8901a', _: '#2a2018' },
      shouts: ['HONK!', 'HONK', 'hsss!', 'HONK HONK', 'HOOONK'],
      desc: 'An unhinged goose roams the arena honking and pecking bugs. Fears nothing.',
    },
    dog: {
      id: 'dog', name: 'War Dog', icon: '🐕', kind: 'companion',
      hp: 70, dmg: 8, range: 24, cd: 0.45, speed: 105, knock: 30, atk: 'melee',
      body: 'DOG', scale: 1.15,
      pal: { o: '#20140c', d: '#9a6a3a', D: '#6e4a26', l: '#c8a074', e: '#160e06', n: '#20140c', _: '#20140c' },
      shouts: ['woof!', 'GRR', 'bark!', 'borf!', 'ARF ARF'],
      desc: 'A very good (very bitey) boy. Sprints across the sand mauling bugs.',
    },
    ballista: {
      id: 'ballista', name: 'Scorpio Ballista', icon: '🏹', kind: 'turret',
      dmg: 16, range: 260, cd: 1.3, proj: { speed: 340, color: '#d8c088', kind: 'bolt' },
      desc: 'A fixed war-ballista at the arena edge that auto-snipes the nearest bug.',
    },
    catapult: {
      id: 'catapult', name: 'Onager Catapult', icon: '🪨', kind: 'turret',
      dmg: 28, range: 320, cd: 3.2, splash: 46, lob: true,
      desc: 'Lobs flaming rocks that explode on a cluster of bugs every few seconds.',
    },
    brazier: {
      id: 'brazier', name: 'Oil Brazier', icon: '🔥', kind: 'hazard', hazard: 'fire',
      dmg: 7, radius: 46,
      desc: 'A ring of fire in the arena. Bugs that wander through it get toasty.',
    },
    caltrops: {
      id: 'caltrops', name: 'Caltrops', icon: '✳️', kind: 'hazard', hazard: 'caltrop',
      dmg: 3, slow: 0.5, radius: 70,
      desc: 'Scatter spikes that slow & chip every bug crossing them. Ouch, tiny feet.',
    },
    trumpet: {
      id: 'trumpet', name: 'Golden Trumpet', icon: '🎺', kind: 'passive', passive: 'cdReduce',
      desc: 'A herald sounds the charge: all your god-powers recharge 20% faster.',
    },
    laurel: {
      id: 'laurel', name: 'Laurel Crown', icon: '🌿', kind: 'passive', passive: 'hpBoost',
      desc: 'Champions of the games: +25% max HP to every Lil Guy you command.',
    },
  };

  return { GUYS, BUGS, BOSSES, BOSS_ORDER, SPELLS, COMPANIONS };
})();
