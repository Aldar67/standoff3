// ===== Standoff 3 — procedural textures & materials =====
'use strict';
(function () {
  const S3 = window.S3;
  const N = S3.Noise;
  const cache = {};
  const matCache = {};

  function makeCanvas(size) { const c = document.createElement('canvas'); c.width = size; c.height = size; return c; }

  // generic pixel painter: fn(x,y,u,v) -> [r,g,b]
  function pixels(size, fn) {
    const c = makeCanvas(size); const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size); const d = img.data;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const col = fn(x, y, x / size, y / size); const i = (y * size + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); return c;
  }
  function toBump(canvas, strength) {
    strength = strength || 1;
    const size = canvas.width; const src = canvas.getContext('2d').getImageData(0, 0, size, size).data;
    const c = makeCanvas(size); const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data;
    for (let i = 0; i < size * size; i++) { const l = (src[i * 4] * 0.3 + src[i * 4 + 1] * 0.59 + src[i * 4 + 2] * 0.11); const v = S3.clamp(128 + (l - 128) * strength, 0, 255); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0); return c;
  }
  function tex(canvas) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8; return t;
  }
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const clampc = (c) => [S3.clamp(c[0], 0, 255), S3.clamp(c[1], 0, 255), S3.clamp(c[2], 0, 255)];

  // brick pattern helper
  function brick(u, v, cols, rows, mortar, offset) {
    mortar = mortar === undefined ? 0.06 : mortar; offset = offset === undefined ? 0.5 : offset;
    const row = Math.floor(v * rows); const off = (row % 2) ? offset : 0;
    const bu = (u * cols + off); const bv = v * rows;
    const fu = bu - Math.floor(bu), fv = bv - Math.floor(bv);
    const eu = Math.min(fu, 1 - fu), ev = Math.min(fv, 1 - fv);
    const inB = fu > mortar && fu < 1 - mortar && fv > mortar * cols / rows && fv < 1 - mortar * cols / rows;
    return { inB: inB, edge: Math.min(eu, ev), id: Math.floor(bu) * 131 + row * 17 };
  }

  const GEN = {
    sand(size) {
      return pixels(size, (x, y, u, v) => {
        const n = N.fbm(u * 8, v * 8, 5) * 0.5 + 0.5; const n2 = N.fbm(u * 40 + 3, v * 40, 3);
        const grain = N.hash2(x, y) * 0.12;
        let c = mix([196, 170, 120], [222, 200, 150], n); c = mul(c, 0.9 + n2 * 0.15 + grain);
        if (N.hash2(x * 3, y * 7) > 0.995) c = mul(c, 0.6);
        return clampc(c);
      });
    },
    sandwall(size) {
      return pixels(size, (x, y, u, v) => {
        const b = brick(u, v, 4, 8, 0.03);
        const n = N.fbm(u * 6 + b.id * 0.01, v * 6, 4) * 0.5 + 0.5; const grain = N.hash2(x, y) * 0.1;
        let c = mix([205, 180, 135], [232, 212, 165], n);
        const idv = N.hash2(b.id, 1); c = mul(c, 0.9 + idv * 0.15 + grain);
        if (!b.inB) c = mul(c, 0.72 + N.hash2(x, y) * 0.1);
        const grime = S3.clamp((v - 0.75) * 3, 0, 1) * 0.25 * (N.fbm(u * 10, v * 3, 2) * 0.5 + 0.5);
        c = mul(c, 1 - grime);
        return clampc(c);
      });
    },
    sandstone(size) {
      return pixels(size, (x, y, u, v) => {
        const b = brick(u, v, 2, 4, 0.02);
        const n = N.fbm(u * 5 + b.id, v * 5, 4) * 0.5 + 0.5;
        let c = mix([178, 158, 118], [214, 196, 150], n);
        c = mul(c, 0.92 + N.hash2(b.id, 2) * 0.12 + N.hash2(x, y) * 0.06);
        if (!b.inB) c = mul(c, 0.7);
        return clampc(c);
      });
    },
    plaster(size) {
      return pixels(size, (x, y, u, v) => {
        const n = N.fbm(u * 6, v * 6, 5) * 0.5 + 0.5;
        let c = mix([200, 196, 186], [236, 232, 222], n); c = mul(c, 0.94 + N.hash2(x, y) * 0.08);
        const crack = Math.abs(N.fbm(u * 3, v * 3, 3)) < 0.008 ? 0.6 : 1; c = mul(c, crack);
        const grime = S3.clamp((v - 0.8) * 5, 0, 1) * 0.3; c = mul(c, 1 - grime);
        return clampc(c);
      });
    },
    concrete(size) {
      return pixels(size, (x, y, u, v) => {
        const n = N.fbm(u * 5, v * 5, 5) * 0.5 + 0.5; const spots = N.hash2(x, y);
        let c = mix([128, 128, 126], [172, 170, 166], n); c = mul(c, 0.9 + spots * 0.15);
        if (spots > 0.985) c = mul(c, 0.7);
        const crack = Math.abs(N.fbm(u * 4 + 9, v * 4, 3)) < 0.006 ? 0.55 : 1; c = mul(c, crack);
        return clampc(c);
      });
    },
    concretefloor(size) {
      return pixels(size, (x, y, u, v) => {
        const n = N.fbm(u * 7, v * 7, 5) * 0.5 + 0.5;
        let c = mix([118, 118, 116], [158, 156, 152], n); c = mul(c, 0.9 + N.hash2(x, y) * 0.15);
        const tile = Math.min(Math.abs(u * 2 - Math.round(u * 2)), Math.abs(v * 2 - Math.round(v * 2))) < 0.006; if (tile) c = mul(c, 0.6);
        return clampc(c);
      });
    },
    asphalt(size) {
      return pixels(size, (x, y, u, v) => {
        const n = N.fbm(u * 10, v * 10, 4) * 0.5 + 0.5; const g = N.hash2(x, y);
        let c = mix([58, 58, 60], [88, 88, 90], n); c = mul(c, 0.85 + g * 0.3);
        return clampc(c);
      });
    },
    brick(size) {
      return pixels(size, (x, y, u, v) => {
        const b = brick(u, v, 6, 16, 0.05);
        const n = N.fbm(u * 8 + b.id, v * 8, 3) * 0.5 + 0.5; const idv = N.hash2(b.id, 5);
        let c = mix([140, 62, 48], [186, 96, 70], idv); c = mul(c, 0.85 + n * 0.25 + N.hash2(x, y) * 0.08);
        if (!b.inB) c = mix([150, 145, 135], [120, 115, 105], N.hash2(x, y));
        return clampc(c);
      });
    },
    redbrick(size) {
      return pixels(size, (x, y, u, v) => {
        const b = brick(u, v, 5, 14, 0.05);
        const idv = N.hash2(b.id, 9);
        let c = mix([120, 48, 40], [170, 80, 60], idv); c = mul(c, 0.85 + N.fbm(u * 9, v * 9, 3) * 0.2 + N.hash2(x, y) * 0.1);
        if (!b.inB) c = [125, 118, 108];
        return clampc(c);
      });
    },
    metal(size) {
      return pixels(size, (x, y, u, v) => {
        const n = N.fbm(u * 4, v * 4, 4) * 0.5 + 0.5;
        let c = mix([96, 100, 104], [140, 144, 148], n); c = mul(c, 0.92 + N.hash2(x, y) * 0.1);
        const pu = u * 2 - Math.floor(u * 2), pv = v * 2 - Math.floor(v * 2);
        if (pu < 0.02 || pv < 0.02) c = mul(c, 0.55);
        const rx = (pu * 12) % 1, ry = (pv * 12) % 1; if ((pu < 0.1 || pu > 0.9 || pv < 0.1 || pv > 0.9) && Math.hypot(rx - 0.5, ry - 0.5) < 0.18) c = mul(c, 1.25);
        return clampc(c);
      });
    },
    rust(size) {
      return pixels(size, (x, y, u, v) => {
        const n = N.fbm(u * 5, v * 5, 5) * 0.5 + 0.5; const r = N.fbm(u * 3 + 7, v * 3 + 2, 4) * 0.5 + 0.5;
        let c = mix([90, 90, 92], [150, 148, 145], n);
        const rustAmt = S3.clamp((r - 0.35) * 2.5, 0, 1); c = mix(c, mix([120, 60, 30], [170, 90, 40], N.hash2(x, y)), rustAmt);
        c = mul(c, 0.9 + N.hash2(x, y) * 0.15);
        return clampc(c);
      });
    },
    container(size) {
      return pixels(size, (x, y, u, v) => {
        const corr = Math.sin(u * Math.PI * 2 * 16); const shade = 0.75 + corr * 0.2;
        const n = N.fbm(u * 6, v * 6, 4) * 0.5 + 0.5; const dirt = N.fbm(u * 3, v * 2, 3) * 0.5 + 0.5;
        let c = [200, 200, 200]; c = mul(c, shade * (0.85 + n * 0.2)); c = mul(c, 1 - S3.clamp((dirt - 0.4), 0, 1) * 0.5);
        if (v > 0.93 || v < 0.05) c = mul(c, 0.6);
        return clampc(c);
      });
    },
    crate(size) {
      return pixels(size, (x, y, u, v) => {
        const n = N.fbm(u * 3, v * 30, 4) * 0.5 + 0.5;
        let c = mix([150, 110, 62], [200, 160, 100], n); c = mul(c, 0.9 + N.hash2(x, y) * 0.15);
        const e = 0.06; const border = u < e || u > 1 - e || v < e || v > 1 - e; const diag = Math.abs(u - v) < 0.035 || Math.abs(u + v - 1) < 0.035;
        if (border || diag) c = mul(c, 0.72);
        const plank = Math.abs((v * 4) - Math.round(v * 4)) < 0.01; if (plank) c = mul(c, 0.6);
        return clampc(c);
      });
    },
    wood(size) {
      return pixels(size, (x, y, u, v) => {
        const n = N.fbm(u * 2, v * 24, 4) * 0.5 + 0.5;
        let c = mix([120, 82, 48], [176, 130, 82], n); c = mul(c, 0.9 + N.hash2(x, y) * 0.12);
        const plank = Math.abs((u * 6) - Math.round(u * 6)) < 0.012; if (plank) c = mul(c, 0.55);
        return clampc(c);
      });
    },
    tiles(size) {
      return pixels(size, (x, y, u, v) => {
        const b = brick(u, v, 8, 8, 0.03, 0);
        const idv = N.hash2(b.id, 3);
        let c = mix([170, 178, 172], [214, 220, 214], idv); c = mul(c, 0.94 + N.hash2(x, y) * 0.08);
        if (!b.inB) c = [110, 112, 110];
        return clampc(c);
      });
    },
    stone(size) {
      return pixels(size, (x, y, u, v) => {
        const b = brick(u, v, 3, 5, 0.04, 0.33);
        const idv = N.hash2(b.id, 7); const n = N.fbm(u * 8 + b.id, v * 8, 3) * 0.5 + 0.5;
        let c = mix([110, 108, 100], [160, 156, 146], idv * 0.6 + n * 0.4); c = mul(c, 0.9 + N.hash2(x, y) * 0.15);
        if (!b.inB) c = [70, 66, 60];
        return clampc(c);
      });
    },
    cobble(size) {
      return pixels(size, (x, y, u, v) => {
        const b = brick(u, v, 10, 10, 0.08, 0.5); const idv = N.hash2(b.id, 11);
        let c = mix([112, 108, 104], [150, 146, 140], idv); c = mul(c, 0.92 + N.hash2(x, y) * 0.12);
        if (!b.inB) c = [72, 68, 62];
        return clampc(c);
      });
    },
    grass(size) {
      return pixels(size, (x, y, u, v) => {
        const n = N.fbm(u * 10, v * 10, 5) * 0.5 + 0.5; const g = N.hash2(x, y);
        let c = mix([70, 96, 40], [110, 140, 60], n); c = mul(c, 0.85 + g * 0.3);
        return clampc(c);
      });
    },
    dirt(size) {
      return pixels(size, (x, y, u, v) => {
        const n = N.fbm(u * 7, v * 7, 5) * 0.5 + 0.5; const g = N.hash2(x, y);
        let c = mix([96, 76, 54], [140, 112, 80], n); c = mul(c, 0.85 + g * 0.25);
        return clampc(c);
      });
    },
    sandbag(size) {
      return pixels(size, (x, y, u, v) => {
        const b = brick(u, v, 3, 6, 0.06); const n = N.fbm(u * 20, v * 20, 3) * 0.5 + 0.5;
        let c = mix([150, 134, 96], [190, 172, 128], n * 0.5 + N.hash2(b.id, 4) * 0.5);
        if (!b.inB) c = mul(c, 0.6); else { const r = 1 - b.edge * 3; c = mul(c, 1 - S3.clamp(r, 0, 1) * 0.25); }
        return clampc(c);
      });
    },
    tarp(size) {
      return pixels(size, (x, y, u, v) => {
        const n = N.fbm(u * 4, v * 4, 4) * 0.5 + 0.5;
        let c = mix([60, 100, 70], [90, 140, 100], n); c = mul(c, 0.9 + N.hash2(x, y) * 0.1);
        return clampc(c);
      });
    },
    roofmetal(size) {
      return pixels(size, (x, y, u, v) => {
        const corr = Math.sin(v * Math.PI * 2 * 12); const n = N.fbm(u * 5, v * 5, 3) * 0.5 + 0.5;
        let c = mix([110, 90, 70], [160, 130, 100], n); c = mul(c, 0.8 + corr * 0.2);
        return clampc(c);
      });
    },
    dark(size) { return pixels(size, (x, y, u, v) => { const n = N.fbm(u * 5, v * 5, 3) * 0.5 + 0.5; return clampc(mul([40, 40, 42], 0.8 + n * 0.4)); }); },
    white(size) { return pixels(size, () => [235, 235, 235]); },
    warning(size) {
      return pixels(size, (x, y, u, v) => { const s = ((u + v) * 8) % 2 < 1; return s ? [230, 190, 40] : [30, 30, 30]; });
    },
    fabric_ct(size) {
      return pixels(size, (x, y, u, v) => { const n = N.fbm(u * 30, v * 30, 2) * 0.5 + 0.5; return clampc(mul([70, 90, 130], 0.85 + n * 0.3)); });
    },
    fabric_t(size) {
      return pixels(size, (x, y, u, v) => { const n = N.fbm(u * 30, v * 30, 2) * 0.5 + 0.5; return clampc(mul([150, 130, 90], 0.85 + n * 0.3)); });
    },
    camo(size) {
      return pixels(size, (x, y, u, v) => {
        const n = N.fbm(u * 6, v * 6, 3); const m = N.fbm(u * 5 + 3, v * 5 + 1, 3);
        let c = [96, 92, 60]; if (n > 0.1) c = [70, 78, 46]; if (m > 0.15) c = [120, 106, 70]; if (n < -0.2) c = [50, 48, 38];
        return c;
      });
    },
  };

  const DEFAULT_SIZE = { sand: 512, sandwall: 512, concrete: 512, asphalt: 256, plaster: 512, container: 256 };

  S3.getTexture = function (name) {
    if (cache[name]) return cache[name];
    const gen = GEN[name] || GEN.concrete;
    const size = DEFAULT_SIZE[name] || 256;
    const canvas = gen(size);
    const t = { map: tex(canvas), bump: null };
    const bumpC = toBump(canvas, 1.0); t.bump = new THREE.CanvasTexture(bumpC); t.bump.wrapS = t.bump.wrapT = THREE.RepeatWrapping; t.bump.anisotropy = 4;
    cache[name] = t; return t;
  };

  // Material descriptors: name -> {tex, scale (meters per tile), color tint, rough, metal, bump}
  const MATS = {
    sand: { tex: 'sand', scale: 4, rough: 1, bump: 0.02 },
    sandwall: { tex: 'sandwall', scale: 3, rough: 0.95, bump: 0.03 },
    sandstone: { tex: 'sandstone', scale: 4, rough: 0.9, bump: 0.03 },
    plaster: { tex: 'plaster', scale: 4, rough: 0.9, bump: 0.02 },
    concrete: { tex: 'concrete', scale: 4, rough: 0.9, bump: 0.02 },
    concretefloor: { tex: 'concretefloor', scale: 4, rough: 0.85, bump: 0.02 },
    asphalt: { tex: 'asphalt', scale: 6, rough: 1, bump: 0.01 },
    brick: { tex: 'brick', scale: 3, rough: 0.9, bump: 0.04 },
    redbrick: { tex: 'redbrick', scale: 3, rough: 0.9, bump: 0.04 },
    metal: { tex: 'metal', scale: 3, rough: 0.5, metal: 0.5, bump: 0.02 },
    rust: { tex: 'rust', scale: 3, rough: 0.7, metal: 0.3, bump: 0.03 },
    container_red: { tex: 'container', scale: 3, color: 0xb04030, rough: 0.6, metal: 0.3, bump: 0.05 },
    container_blue: { tex: 'container', scale: 3, color: 0x3060a0, rough: 0.6, metal: 0.3, bump: 0.05 },
    container_green: { tex: 'container', scale: 3, color: 0x3a7a40, rough: 0.6, metal: 0.3, bump: 0.05 },
    container_yellow: { tex: 'container', scale: 3, color: 0xc0a030, rough: 0.6, metal: 0.3, bump: 0.05 },
    container_grey: { tex: 'container', scale: 3, color: 0x8a8f94, rough: 0.6, metal: 0.3, bump: 0.05 },
    crate: { tex: 'crate', scale: 1, rough: 0.9, bump: 0.03, perBox: true },
    wood: { tex: 'wood', scale: 2, rough: 0.8, bump: 0.02 },
    tiles: { tex: 'tiles', scale: 2, rough: 0.5, bump: 0.02 },
    stone: { tex: 'stone', scale: 3, rough: 0.9, bump: 0.04 },
    cobble: { tex: 'cobble', scale: 3, rough: 0.9, bump: 0.04 },
    grass: { tex: 'grass', scale: 5, rough: 1, bump: 0.01 },
    dirt: { tex: 'dirt', scale: 5, rough: 1, bump: 0.01 },
    sandbag: { tex: 'sandbag', scale: 1.5, rough: 1, bump: 0.05 },
    tarp: { tex: 'tarp', scale: 2, rough: 0.9, bump: 0.01 },
    roofmetal: { tex: 'roofmetal', scale: 3, rough: 0.6, metal: 0.4, bump: 0.03 },
    dark: { tex: 'dark', scale: 2, rough: 0.9 },
    warning: { tex: 'warning', scale: 1, rough: 0.7 },
    barrel: { tex: 'rust', scale: 1.5, color: 0x6a8a5a, rough: 0.7, metal: 0.3 },
    barrel_red: { tex: 'rust', scale: 1.5, color: 0xa04a3a, rough: 0.7, metal: 0.3 },
    barrel_blue: { tex: 'rust', scale: 1.5, color: 0x3a5a9a, rough: 0.7, metal: 0.3 },
  };
  S3.MATS = MATS;

  S3.getMaterial = function (name) {
    if (matCache[name]) return matCache[name];
    const d = MATS[name] || MATS.concrete;
    const t = S3.getTexture(d.tex);
    const m = new THREE.MeshStandardMaterial({
      map: t.map, bumpMap: t.bump, bumpScale: d.bump || 0, roughness: d.rough !== undefined ? d.rough : 0.9, metalness: d.metal !== undefined ? d.metal : 0,
      color: d.color !== undefined ? d.color : 0xffffff,
    });
    m.userData.scale = d.scale || 2; m.userData.perBox = !!d.perBox;
    matCache[name] = m; return m;
  };
  S3.getMatScale = (name) => (MATS[name] || MATS.concrete).scale || 2;
  S3.isPerBox = (name) => !!(MATS[name] || {}).perBox;
})();
