/* ===========================================================
   audio.js — tiny procedural sound-effect engine (WebAudio)
   No audio files; everything is synthesized. Global: SFX
   =========================================================== */

const SFX = (() => {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  }

  function resume() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); }

  // one blip: freq sweep from f0->f1 over dur with a given wave & volume
  function tone(f0, f1, dur, type = 'square', vol = 0.3, delay = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  // filtered noise burst (for whooshes, crashes, cheers)
  function noise(dur, vol = 0.3, freq = 1200, q = 0.7, delay = 0, type = 'bandpass') {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur);
  }

  const lib = {
    click:  () => tone(420, 620, 0.06, 'square', 0.18),
    hop:    () => tone(260, 520, 0.08, 'sine', 0.10),
    hit:    () => { tone(180, 90, 0.07, 'square', 0.16); noise(0.05, 0.12, 900, 1); },
    crit:   () => { tone(320, 120, 0.10, 'sawtooth', 0.2); noise(0.06, 0.15, 1400, 1); },
    hurt:   () => tone(200, 70, 0.12, 'sawtooth', 0.18),
    shoot:  () => tone(760, 300, 0.09, 'square', 0.12),
    arrow:  () => tone(900, 500, 0.07, 'triangle', 0.10),
    ko:     () => { tone(300, 60, 0.35, 'sawtooth', 0.22); noise(0.2, 0.1, 500, 0.6); },
    boom:   () => { tone(140, 40, 0.5, 'sawtooth', 0.3); noise(0.4, 0.28, 260, 0.4); },
    splash: () => { noise(0.25, 0.2, 1800, 0.5); tone(700, 1400, 0.15, 'sine', 0.08); },
    snack:  () => { tone(500, 780, 0.1, 'triangle', 0.15); tone(680, 980, 0.1, 'triangle', 0.12, 0.06); },
    zap:    () => { tone(1200, 200, 0.12, 'sawtooth', 0.18); noise(0.1, 0.12, 3000, 2); },
    buff:   () => { tone(500, 900, 0.14, 'sine', 0.16); tone(760, 1200, 0.14, 'sine', 0.12, 0.07); },
    heal:   () => { tone(660, 990, 0.12, 'sine', 0.14); tone(880, 1320, 0.1, 'sine', 0.1, 0.06); },
    cheer:  () => { noise(0.6, 0.22, 1400, 0.5); noise(0.6, 0.18, 900, 0.6, 0.02); },
    reward: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.14, 'triangle', 0.16, i * 0.09)); },
    boss:   () => { tone(90, 60, 0.8, 'sawtooth', 0.32); tone(120, 80, 0.8, 'square', 0.18, 0.1); },
    win:    () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, f, 0.2, 'square', 0.16, i * 0.12)); },
    lose:   () => { [400, 340, 280, 200].forEach((f, i) => tone(f, f * 0.9, 0.3, 'sawtooth', 0.18, i * 0.16)); },
    place:  () => tone(300, 460, 0.08, 'sine', 0.14),
    deny:   () => tone(200, 160, 0.12, 'square', 0.14),
  };

  function play(name) { ensure(); if (lib[name]) lib[name](); }
  function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; }
  function isMuted() { return muted; }

  return { play, resume, toggleMute, isMuted };
})();
