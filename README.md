# 🏛️ LIL GUYS COLOSSEUM

> Tiny gladiators. Giant bugs. Maximum chaos.

A goofy **2.5D top-down pixel-art auto-battler** set in a Roman Colosseum. You keep a
squad of bouncy little gladiators ("Lil Guys") in a holding cage, **drag & drop** them
into the sandy arena, and let them auto-brawl waves of enormous bugs. Between waves you
pick **1 of 3 random rewards**, spend **Crowd Hype** on ridiculous spells, entertain the
mob, and try to survive the giant bug bosses.

Everything runs in a single browser tab with **zero dependencies and no build step** —
sprites, sounds, and physics are all generated procedurally in vanilla JS + Canvas.

---

## ▶️ How to play

Just open **`index.html`** in any modern browser (Chrome, Firefox, Edge, Safari).

That's it — no server, no install. (If you prefer a local server:
`python3 -m http.server` then visit `http://localhost:8000`.)

### The loop
1. **Deploy.** Your Lil Guys mill about in the *Ready Cage* at the bottom, bobbing and
   shouting. **Drag them up into the sandy arena** to send them into battle. Drag them
   back down to bench them. Reposition freely.
2. **Fight.** Hit **FIGHT!** — combat is fully automatic. Your guys hop, bob, seek bugs,
   and swing/shoot on their own with physics-based bouncy movement.
3. **Cast.** Combat fills your **Crowd Hype** meter. Spend it on spells: **select a spell**
   in the bottom bar, then **click the arena** to cast (self-buffs cast instantly).
4. **Reward.** Clear the wave and choose **1 of 3** spoils: recruit a new fighter, unlock a
   tool/animal companion, or learn a new spell.
5. **Survive.** Waves escalate; every **5th wave is a boss** (Queen Beetle → Vespa Maxima →
   The Broodmother → …). Lose when every deployed fighter is knocked out.

---

## ✨ Features

- **7 recruitable Lil Guys**, each with distinct behaviour: Gladiator, Lil Boxer,
  Spearman, Archer, Shieldbro (taunt tank), Medicus (healer), Hype Drummer (haste + hype).
- **6 bug types + 3 escalating bosses** — flying wasps, acid spitters, tanky beetles,
  a fat grub that splits into ants, plus bosses that stomp, dive-bomb and summon swarms.
- **8 ridiculous spells** — Water Syringe 💉, Giant Rock 🪨 (with sky-drop telegraph),
  Snack Toss 🍗, Cheese Lure 🧀, Jupiter's Bolt ⚡ (chain lightning), Banana Peel 🍌
  (slip & stun), Olive Oil 🫒 (squad haste) and Crowd Roar 📣 (heal + hype).
- **8 tools & companions** — an unhinged Angry Goose 🦢 and War Dog 🐕 that roam and maul
  bugs, auto-firing Scorpio Ballista & Onager Catapult turrets, an Oil Brazier and
  Caltrops floor hazards, plus permanent boons (Golden Trumpet, Laurel Crown).
- **Physics juice** — springy hop/bob movement, squash-&-stretch, knockback, drop
  shadows for the 2.5D look, screen shake, particles, floating damage numbers, and a
  living crowd that jiggles harder the higher your Hype.
- **Roguelite progression** — a fresh 3-card reward draw every wave; endless scaling.
- **Procedural everything** — no image or audio assets; pixel sprites are char-maps and
  all SFX are synthesized with the Web Audio API. Best score is saved locally.

---

## 🗂️ Project structure

```
index.html          # markup: HUD, canvas stage, overlays, spell bar
css/style.css       # chunky faux-pixel UI styling (theme-aware, responsive)
js/
  util.js           # math, RNG, easing, geometry helpers
  audio.js          # procedural Web Audio sound-effect engine
  art.js            # pixel sprite char-maps + arena / crowd / pen rendering
  data.js           # all content: guys, bugs, bosses, spells, companions
  entities.js       # Unit (bouncy physics + auto-battle AI) & Projectile
  game.js           # state machine, drag & drop, waves, spells, rewards, render
  main.js           # bootstrap + game loop
```

Made for a game jam. Have fun, and please protect the archer. 🏹
