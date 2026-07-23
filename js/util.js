/* ===========================================================
   util.js — math, random, easing, small helpers
   Everything is attached to the global scope (classic scripts).
   =========================================================== */

const TAU = Math.PI * 2;

const clamp = (v, lo, hi) => v < lo ? lo : (v > hi ? hi : v);
const lerp  = (a, b, t) => a + (b - a) * t;
const inv   = (a, b, v) => (v - a) / (b - a);
const sign  = (v) => v < 0 ? -1 : (v > 0 ? 1 : 0);

// distance helpers -----------------------------------------------------------
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function dist(ax, ay, bx, by)  { return Math.sqrt(dist2(ax, ay, bx, by)); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

// random ---------------------------------------------------------------------
function rand(a = 1, b) { if (b === undefined) { b = a; a = 0; } return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function chance(p) { return Math.random() < p; }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// pick n distinct entries (or fewer if array smaller)
function sample(arr, n) { return shuffle(arr).slice(0, n); }

// easing ---------------------------------------------------------------------
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic  = (t) => t * t * t;

// move a value toward target by max delta
function approach(cur, target, delta) {
  if (cur < target) return Math.min(cur + delta, target);
  if (cur > target) return Math.max(cur - delta, target);
  return cur;
}

// point inside ellipse -------------------------------------------------------
function inEllipse(px, py, cx, cy, rx, ry) {
  const dx = (px - cx) / rx, dy = (py - cy) / ry;
  return dx * dx + dy * dy <= 1;
}
// clamp a point to the inside of an ellipse (with padding margin 0..1 of radius)
function clampToEllipse(px, py, cx, cy, rx, ry, pad = 0) {
  const RX = rx * (1 - pad), RY = ry * (1 - pad);
  const dx = (px - cx) / RX, dy = (py - cy) / RY;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= 1) return { x: px, y: py };
  return { x: cx + (dx / d) * RX, y: cy + (dy / d) * RY };
}

// color: hex -> {r,g,b}, and lighten/darken -----------------------------------
function hexRGB(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function shade(hex, amt) { // amt -1..1 (neg darker)
  const { r, g, b } = hexRGB(hex);
  const f = (c) => clamp(Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// text measure cache not needed; small helper for rounded rects
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
