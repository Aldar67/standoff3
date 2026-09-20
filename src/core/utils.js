// ===== Standoff 3 — core utilities =====
'use strict';
const S3 = window.S3 = window.S3 || {};

S3.clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
S3.lerp = (a, b, t) => a + (b - a) * t;
S3.damp = (a, b, lambda, dt) => S3.lerp(a, b, 1 - Math.exp(-lambda * dt));
S3.rand = (a = 0, b = 1) => a + Math.random() * (b - a);
S3.randInt = (a, b) => Math.floor(S3.rand(a, b + 1));
S3.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
S3.randSign = () => Math.random() < 0.5 ? -1 : 1;
S3.DEG = Math.PI / 180;
S3.gauss = () => { // approx normal (-3..3)
  let s = 0; for (let i = 0; i < 6; i++) s += Math.random(); return (s - 3);
};
S3.angleWrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
S3.dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
S3.fmtTime = (t) => { t = Math.max(0, Math.ceil(t)); const m = Math.floor(t / 60), s = t % 60; return m + ':' + (s < 10 ? '0' : '') + s; };
S3.fmtMoney = (m) => '$' + Math.floor(m);
S3.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

// Seeded RNG (mulberry32)
S3.seededRandom = function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};

// Value noise 2D
S3.Noise = (function () {
  const PERM = new Uint8Array(512);
  const rnd = S3.seededRandom(1337);
  const p = [];
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y) => { switch (h & 3) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; default: return -x - y; } };
  function perlin(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const A = PERM[X] + Y, B = PERM[X + 1] + Y;
    return S3.lerp(
      S3.lerp(grad(PERM[A], x, y), grad(PERM[B], x - 1, y), u),
      S3.lerp(grad(PERM[A + 1], x, y - 1), grad(PERM[B + 1], x - 1, y - 1), u), v);
  }
  function fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * perlin(x * f, y * f); n += a; a *= gain; f *= lac; }
    return s / n;
  }
  function hash2(x, y) { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
  return { perlin, fbm, hash2 };
})();

// ---- AABB helpers (min/max as {x,y,z}) ----
S3.aabbOverlap = (a, b) =>
  a.min.x < b.max.x && a.max.x > b.min.x &&
  a.min.y < b.max.y && a.max.y > b.min.y &&
  a.min.z < b.max.z && a.max.z > b.min.z;

// Ray vs AABB slab. Returns t (>=0) or -1. Also outputs normal via out object.
S3.rayAABB = function (ox, oy, oz, dx, dy, dz, box, maxT, out) {
  let tmin = 0, tmax = maxT, nAxis = -1, nSign = 0;
  // X
  if (Math.abs(dx) < 1e-9) { if (ox < box.min.x || ox > box.max.x) return -1; }
  else {
    const inv = 1 / dx; let t1 = (box.min.x - ox) * inv, t2 = (box.max.x - ox) * inv, s = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
    if (t1 > tmin) { tmin = t1; nAxis = 0; nSign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dy) < 1e-9) { if (oy < box.min.y || oy > box.max.y) return -1; }
  else {
    const inv = 1 / dy; let t1 = (box.min.y - oy) * inv, t2 = (box.max.y - oy) * inv, s = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
    if (t1 > tmin) { tmin = t1; nAxis = 1; nSign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dz) < 1e-9) { if (oz < box.min.z || oz > box.max.z) return -1; }
  else {
    const inv = 1 / dz; let t1 = (box.min.z - oz) * inv, t2 = (box.max.z - oz) * inv, s = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
    if (t1 > tmin) { tmin = t1; nAxis = 2; nSign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (out) {
    out.nx = 0; out.ny = 0; out.nz = 0;
    if (nAxis === 0) out.nx = nSign; else if (nAxis === 1) out.ny = nSign; else if (nAxis === 2) out.nz = nSign;
    else { out.ny = 1; }
  }
  return tmin;
};

// Ray vs sphere: returns t or -1
S3.raySphere = function (ox, oy, oz, dx, dy, dz, cx, cy, cz, r, maxT) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return -1;
  const thc = Math.sqrt(r2 - d2);
  let t0 = tca - thc, t1 = tca + thc;
  if (t0 < 0) t0 = t1;
  if (t0 < 0 || t0 > maxT) return -1;
  return t0;
};

// Simple binary heap for A*
S3.MinHeap = class {
  constructor(scoreFn) { this.a = []; this.score = scoreFn; }
  get size() { return this.a.length; }
  push(v) { const a = this.a; a.push(v); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (this.score(a[p]) <= this.score(a[i])) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; const n = a.length; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < n && this.score(a[l]) < this.score(a[m])) m = l; if (r < n && this.score(a[r]) < this.score(a[m])) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
};

// Event bus
S3.Events = class { constructor() { this.m = {}; } on(e, f) { (this.m[e] = this.m[e] || []).push(f); return this; } emit(e, ...a) { const l = this.m[e]; if (l) for (const f of l) f(...a); } };

// Settings storage
S3.Settings = {
  data: {
    sensitivity: 1.0, fov: 80, volume: 0.7, music: 0.4, shadows: true, quality: 'high', crosshairColor: '#33ff66',
    crosshairSize: 6, crosshairGap: 4, crosshairThick: 2, crosshairDot: false, lang: 'ru', invertY: false, resScale: 1.0, showFps: false,
    crouchToggle: false, hudScale: 1.0, playerName: 'Игрок',
  },
  load() { try { const s = localStorage.getItem('standoff3_settings'); if (s) Object.assign(this.data, JSON.parse(s)); } catch (e) { } return this.data; },
  save() { try { localStorage.setItem('standoff3_settings', JSON.stringify(this.data)); } catch (e) { } },
};
S3.Stats = {
  data: { kills: 0, deaths: 0, headshots: 0, wins: 0, losses: 0, matches: 0, bombPlants: 0, bombDefuses: 0, shotsFired: 0, shotsHit: 0 },
  load() { try { const s = localStorage.getItem('standoff3_stats'); if (s) Object.assign(this.data, JSON.parse(s)); } catch (e) { } return this.data; },
  save() { try { localStorage.setItem('standoff3_stats', JSON.stringify(this.data)); } catch (e) { } },
};
