// ===== Standoff 3 — map definition DSL + builder (heightfield -> brushes -> merged meshes) =====
'use strict';
(function () {
  const S3 = window.S3;
  const CELL = 0.5;

  class MapDef {
    constructor(opts) {
      this.name = opts.name; this.title = opts.title || opts.name; this.theme = opts.theme || {};
      const pad = 2;
      this.xmin = opts.bounds[0] - pad; this.zmin = opts.bounds[1] - pad; this.xmax = opts.bounds[2] + pad; this.zmax = opts.bounds[3] + pad;
      this.W = Math.ceil((this.xmax - this.xmin) / CELL); this.H = Math.ceil((this.zmax - this.zmin) / CELL);
      const n = this.W * this.H;
      this.h = new Float32Array(n).fill(NaN);      // floor height (NaN = solid)
      this.fm = new Array(n).fill(null);           // floor material
      this.wm = new Array(n).fill(null);           // wall material of area (used for adjacent walls)
      this.wh = new Float32Array(n).fill(4.5);     // wall height above floor for adjacent walls
      this.ceil = new Float32Array(n).fill(Infinity);
      this.solidH = new Float32Array(n).fill(NaN); // custom solid block height (relative to neighbor floor)
      this.solidMat = new Array(n).fill(null);
      this.blocked = new Uint8Array(n);            // nav blocked (props)
      this.defaultFloor = opts.floor || 'sand'; this.defaultWall = opts.wall || 'sandwall'; this.defaultWallH = opts.wallH || 4.5;
      this.brushes = [];   // {min,max,mat,faces,uv,collide,surface}
      this.meshes = [];    // custom THREE meshes (props with non-box geometry)
      this.spawns = { T: [], CT: [] };
      this.sites = [];
      this.regions = [];
      this.lights = [];
      this.ambientProps = [];
      this.description = opts.description || '';
    }
    idx(i, j) { return j * this.W + i; }
    cellOf(x, z) { return [Math.floor((x - this.xmin) / CELL), Math.floor((z - this.zmin) / CELL)]; }
    forCells(x1, z1, x2, z2, fn) {
      const [i0, j0] = this.cellOf(Math.min(x1, x2) + 0.001, Math.min(z1, z2) + 0.001);
      const [i1, j1] = this.cellOf(Math.max(x1, x2) - 0.001, Math.max(z1, z2) - 0.001);
      for (let j = Math.max(0, j0); j <= Math.min(this.H - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(this.W - 1, i1); i++) fn(i, j, this.idx(i, j));
    }
    cellCenter(i, j) { return [this.xmin + (i + 0.5) * CELL, this.zmin + (j + 0.5) * CELL]; }

    area(x1, z1, x2, z2, o) {
      o = o || {}; const y = o.y || 0; const fm = o.floor || this.defaultFloor; const wm = o.wall || this.defaultWall; const wh = o.wallH || this.defaultWallH;
      this.forCells(x1, z1, x2, z2, (i, j, k) => { this.h[k] = y; this.fm[k] = fm; this.wm[k] = wm; this.wh[k] = wh; this.solidH[k] = NaN; });
      return this;
    }
    // ramp/stairs: height interpolated from 'from' to 'to' along dir ('x+','x-','z+','z-'), quantized to 'step'
    ramp(x1, z1, x2, z2, o) {
      const from = o.from || 0, to = o.to; const step = o.step || 0.25; const dir = o.dir || 'z-';
      const fm = o.floor || this.defaultFloor; const wm = o.wall || this.defaultWall; const wh = o.wallH || this.defaultWallH;
      const xa = Math.min(x1, x2), xb = Math.max(x1, x2), za = Math.min(z1, z2), zb = Math.max(z1, z2);
      this.forCells(x1, z1, x2, z2, (i, j, k) => {
        const [cx, cz] = this.cellCenter(i, j); let t;
        if (dir === 'x+') t = (cx - xa) / (xb - xa); else if (dir === 'x-') t = (xb - cx) / (xb - xa); else if (dir === 'z+') t = (cz - za) / (zb - za); else t = (zb - cz) / (zb - za);
        t = S3.clamp(t, 0, 1); let y = from + (to - from) * t; y = Math.round(y / step) * step;
        this.h[k] = y; this.fm[k] = fm; this.wm[k] = wm; this.wh[k] = wh; this.solidH[k] = NaN;
      });
      return this;
    }
    // solid block inside an area (pillar, wall segment); h relative to neighbor floor
    solid(x1, z1, x2, z2, o) {
      o = o || {}; const h = o.h || 4.5; const mat = o.mat || null;
      this.forCells(x1, z1, x2, z2, (i, j, k) => { this.h[k] = NaN; this.solidH[k] = h; this.solidMat[k] = mat; });
      return this;
    }
    // thin wall along a segment (axis-aligned), thickness t, height h (relative to floor)
    wall(x1, z1, x2, z2, o) {
      o = o || {}; const t = o.t || 0.5; const h = o.h || this.defaultWallH; const mat = o.mat || null;
      if (Math.abs(x2 - x1) < Math.abs(z2 - z1)) this.solid(x1 - t / 2, z1, x1 + t / 2, z2, { h, mat }); else this.solid(x1, z1 - t / 2, x2, z1 + t / 2, { h, mat });
      return this;
    }
    roof(x1, z1, x2, z2, y, o) {
      o = o || {}; const th = o.thick || 0.4; const mat = o.mat || this.defaultWall;
      this.brush(Math.min(x1, x2), y, Math.min(z1, z2), Math.max(x1, x2), y + th, Math.max(z1, z2), mat, { faces: 'all' });
      this.forCells(x1, z1, x2, z2, (i, j, k) => { this.ceil[k] = Math.min(this.ceil[k], y); });
      return this;
    }
    brush(x1, y1, z1, x2, y2, z2, mat, o) {
      o = o || {};
      const b = { min: { x: Math.min(x1, x2), y: Math.min(y1, y2), z: Math.min(z1, z2) }, max: { x: Math.max(x1, x2), y: Math.max(y1, y2), z: Math.max(z1, z2) }, mat: mat || this.defaultWall, faces: o.faces || 'all', uv: o.uv || 'world', collide: o.collide !== false, surface: o.surface || null, nav: o.nav };
      this.brushes.push(b);
      if (b.collide && o.nav !== false) {
        const top = b.max.y; const bottom = b.min.y;
        // block nav where the brush would obstruct a standing body (from floor up to 1.9m)
        this.forCells(b.min.x, b.min.z, b.max.x, b.max.z, (i, j, k) => {
          const fy = this.h[k]; if (isNaN(fy)) return;
          if (top > fy + 0.55 && bottom < fy + 1.9) this.blocked[k] = 1;
          else if (bottom >= fy + 1.9) this.ceil[k] = Math.min(this.ceil[k], bottom);
        });
      }
      return b;
    }
    mesh(m) { this.meshes.push(m); return this; }
    spawn(team, x, z, yaw) { this.spawns[team].push({ x, z, yaw: (yaw || 0) * S3.DEG }); return this; }
    spawnRow(team, x1, z1, x2, z2, count, yaw) {
      for (let i = 0; i < count; i++) { const t = count === 1 ? 0.5 : i / (count - 1); this.spawn(team, x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, yaw); }
      return this;
    }
    site(name, x1, z1, x2, z2) { this.sites.push({ name, min: { x: Math.min(x1, x2), z: Math.min(z1, z2) }, max: { x: Math.max(x1, x2), z: Math.max(z1, z2) }, cx: (x1 + x2) / 2, cz: (z1 + z2) / 2 }); return this; }
    region(name, x1, z1, x2, z2) { this.regions.push({ name, min: { x: Math.min(x1, x2), z: Math.min(z1, z2) }, max: { x: Math.max(x1, x2), z: Math.max(z1, z2) } }); return this; }
    light(x, y, z, color, intensity, dist) { this.lights.push({ x, y, z, color: color || 0xffddaa, intensity: intensity || 1, dist: dist || 12 }); return this; }
    floorY(x, z) { const [i, j] = this.cellOf(x, z); if (i < 0 || j < 0 || i >= this.W || j >= this.H) return 0; const y = this.h[this.idx(i, j)]; return isNaN(y) ? 0 : y; }

    // ---------- props ----------
    crate(x, z, o) {
      o = o || {}; const s = o.size || 1; const y = o.y !== undefined ? o.y : this.floorY(x, z); const mat = o.mat || 'crate'; const sy = o.h || s;
      this.brush(x - s / 2, y, z - s / 2, x + s / 2, y + sy, z + s / 2, mat, { uv: 'box', surface: 'wood' });
      if (o.stack) for (let i = 1; i < o.stack; i++) this.brush(x - s / 2, y + sy * i, z - s / 2, x + s / 2, y + sy * (i + 1), z + s / 2, mat, { uv: 'box', surface: 'wood' });
      return this;
    }
    crates(x, z, n, o) { // cluster of crates
      o = o || {}; const s = o.size || 1;
      const layout = [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5, 1], [1, 1, 1]];
      for (let i = 0; i < n && i < layout.length; i++) { const L = layout[i]; this.crate(x + L[0] * s, z + L[1] * s, { size: s, y: this.floorY(x, z) + (L[2] || 0) * s, mat: o.mat }); }
      return this;
    }
    barrel(x, z, o) {
      o = o || {}; const r = 0.32, h = 0.92; const y = o.y !== undefined ? o.y : this.floorY(x, z); const mat = o.mat || S3.pick(['barrel', 'barrel_red', 'barrel_blue']);
      this.brush(x - r, y, z - r, x + r, y + h, z + r, mat, { faces: 'none', surface: 'metal' });
      const geo = new THREE.CylinderGeometry(r, r, h, 14, 1); const m = new THREE.Mesh(geo, S3.getMaterial(mat)); m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 6, 16), S3.getMaterial('metal')); ring.rotation.x = Math.PI / 2; ring.position.set(x, y + h * 0.3, z); const ring2 = ring.clone(); ring2.position.y = y + h * 0.7;
      this.meshes.push(m, ring, ring2); return this;
    }
    barrels(x, z, n, o) { const pts = [[0, 0], [0.7, 0], [0.35, 0.6], [1.05, 0.6], [0.7, 1.2]]; for (let i = 0; i < n && i < pts.length; i++) this.barrel(x + pts[i][0], z + pts[i][1], o); return this; }
    container(x, z, o) {
      o = o || {}; const len = o.len || 6, w = o.w || 2.4, h = o.h || 2.6; const dir = o.dir || 'x'; const y = o.y !== undefined ? o.y : this.floorY(x, z);
      const mat = o.mat || S3.pick(['container_red', 'container_blue', 'container_green', 'container_yellow', 'container_grey']);
      const hx = dir === 'x' ? len / 2 : w / 2, hz = dir === 'x' ? w / 2 : len / 2;
      this.brush(x - hx, y, z - hz, x + hx, y + h, z + hz, mat, { surface: 'metal' });
      return this;
    }
    sandbags(x1, z1, x2, z2, o) {
      o = o || {}; const h = o.h || 0.95, t = o.t || 0.7; const y = this.floorY((x1 + x2) / 2, (z1 + z2) / 2);
      if (Math.abs(x2 - x1) >= Math.abs(z2 - z1)) this.brush(Math.min(x1, x2), y, z1 - t / 2, Math.max(x1, x2), y + h, z1 + t / 2, 'sandbag', { surface: 'sand' });
      else this.brush(x1 - t / 2, y, Math.min(z1, z2), x1 + t / 2, y + h, Math.max(z1, z2), 'sandbag', { surface: 'sand' });
      return this;
    }
    lowwall(x1, z1, x2, z2, o) {
      o = o || {}; const h = o.h || 1.1, t = o.t || 0.3; const mat = o.mat || this.defaultWall; const y = o.y !== undefined ? o.y : this.floorY((x1 + x2) / 2, (z1 + z2) / 2);
      if (Math.abs(x2 - x1) >= Math.abs(z2 - z1)) this.brush(Math.min(x1, x2), y, z1 - t / 2, Math.max(x1, x2), y + h, z1 + t / 2, mat);
      else this.brush(x1 - t / 2, y, Math.min(z1, z2), x1 + t / 2, y + h, Math.max(z1, z2), mat);
      return this;
    }
    pillar(x, z, o) { o = o || {}; const w = o.w || 0.6, h = o.h || 4.5; const y = o.y !== undefined ? o.y : this.floorY(x, z); this.brush(x - w / 2, y, z - w / 2, x + w / 2, y + h, z + w / 2, o.mat || this.defaultWall); return this; }
    block(x1, z1, x2, z2, o) { // generic obstacle block on the floor
      o = o || {}; const h = o.h || 1; const y = o.y !== undefined ? o.y : this.floorY((x1 + x2) / 2, (z1 + z2) / 2); this.brush(x1, y, z1, x2, y + h, z2, o.mat || 'concrete', { uv: o.uv || 'world', surface: o.surface }); return this;
    }
    platform(x1, z1, x2, z2, o) { // walkable raised box (climbable via jump if <= 1.0)
      o = o || {}; const h = o.h || 1; const y = o.y !== undefined ? o.y : this.floorY((x1 + x2) / 2, (z1 + z2) / 2); this.brush(x1, y, z1, x2, y + h, z2, o.mat || 'concrete', { uv: 'world', surface: o.surface }); return this;
    }
    pallet(x, z, o) { o = o || {}; const y = this.floorY(x, z); this.brush(x - 0.6, y, z - 0.5, x + 0.6, y + 0.14, z + 0.5, 'wood', { uv: 'box', surface: 'wood' }); return this; }
    tire(x, z, o) {
      o = o || {}; const y = this.floorY(x, z); const geo = new THREE.TorusGeometry(0.32, 0.12, 8, 18); const m = new THREE.Mesh(geo, S3.getMaterial('dark')); m.rotation.x = Math.PI / 2; m.position.set(x, y + 0.12, z); m.castShadow = true; m.receiveShadow = true; this.meshes.push(m);
      if (o.stack) for (let i = 1; i < o.stack; i++) { const c = m.clone(); c.position.y = y + 0.12 + i * 0.24; this.meshes.push(c); }
      this.brush(x - 0.44, y, z - 0.44, x + 0.44, y + 0.24 * (o.stack || 1), z + 0.44, 'dark', { faces: 'none' });
      return this;
    }
    lamp(x, y, z, o) {
      o = o || {}; const color = o.color || 0xffe0b0; this.light(x, y, z, color, o.intensity || 6, o.dist || 14);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.4), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: color, emissiveIntensity: 1.5 })); m.position.set(x, y, z); this.meshes.push(m);
      return this;
    }
    sign(x, y, z, text, o) { // billboard sign with text
      o = o || {}; const c = document.createElement('canvas'); c.width = 256; c.height = 128; const ctx = c.getContext('2d');
      ctx.fillStyle = o.bg || '#202020'; ctx.fillRect(0, 0, 256, 128); ctx.strokeStyle = o.fg || '#f0c040'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, 244, 116);
      ctx.fillStyle = o.fg || '#f0c040'; ctx.font = 'bold 72px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 66);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(o.w || 1.6, o.h || 0.8), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })); m.position.set(x, y, z); m.rotation.y = (o.yaw || 0) * S3.DEG; this.meshes.push(m);
      return this;
    }
  }
  S3.MapDef = MapDef;

  // ---------- Builder ----------
  function mergeRects(W, H, keyAt) {
    const used = new Uint8Array(W * H); const out = [];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i; if (used[k]) continue; const key = keyAt(i, j); if (key === null) continue;
      let i1 = i; while (i1 + 1 < W && !used[j * W + i1 + 1] && keyAt(i1 + 1, j) === key) i1++;
      let j1 = j; outer: while (j1 + 1 < H) { for (let ii = i; ii <= i1; ii++) { if (used[(j1 + 1) * W + ii] || keyAt(ii, j1 + 1) !== key) break outer; } j1++; }
      for (let jj = j; jj <= j1; jj++) for (let ii = i; ii <= i1; ii++) used[jj * W + ii] = 1;
      out.push({ i0: i, j0: j, i1, j1, key });
    }
    return out;
  }

  // Box geometry writer with world-space UVs and face mask
  class GeoBuilder {
    constructor() { this.pos = []; this.nor = []; this.uv = []; this.idx = []; this.n = 0; }
    quad(a, b, c, d, nx, ny, nz, uvs) {
      const base = this.n;
      for (const p of [a, b, c, d]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(nx, ny, nz); }
      for (const u of uvs) this.uv.push(u[0], u[1]);
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3); this.n += 4;
    }
    box(min, max, faces, uvMode, scale) {
      const x0 = min.x, y0 = min.y, z0 = min.z, x1 = max.x, y1 = max.y, z1 = max.z; const s = 1 / scale;
      const F = faces; const world = uvMode === 'world';
      const U = (a, b) => world ? [a * s, b * s] : [a, b];
      // +X
      if (F.px) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, world ? [U(z1, y0), U(z0, y0), U(z0, y1), U(z1, y1)] : [[0, 0], [1, 0], [1, 1], [0, 1]]);
      // -X
      if (F.nx) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, world ? [U(z0, y0), U(z1, y0), U(z1, y1), U(z0, y1)] : [[0, 0], [1, 0], [1, 1], [0, 1]]);
      // +Y
      if (F.py) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0, world ? [U(x0, z1), U(x1, z1), U(x1, z0), U(x0, z0)] : [[0, 0], [1, 0], [1, 1], [0, 1]]);
      // -Y
      if (F.ny) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0, -1, 0, world ? [U(x0, z0), U(x1, z0), U(x1, z1), U(x0, z1)] : [[0, 0], [1, 0], [1, 1], [0, 1]]);
      // +Z
      if (F.pz) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, world ? [U(x0, y0), U(x1, y0), U(x1, y1), U(x0, y1)] : [[0, 0], [1, 0], [1, 1], [0, 1]]);
      // -Z
      if (F.nz) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1, world ? [U(x1, y0), U(x0, y0), U(x0, y1), U(x1, y1)] : [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      g.setIndex(this.idx); g.computeBoundingSphere(); return g;
    }
  }
  const FACES = {
    all: { px: 1, nx: 1, py: 1, ny: 1, pz: 1, nz: 1 }, noBottom: { px: 1, nx: 1, py: 1, ny: 0, pz: 1, nz: 1 }, top: { px: 0, nx: 0, py: 1, ny: 0, pz: 0, nz: 0 },
    sides: { px: 1, nx: 1, py: 0, ny: 0, pz: 1, nz: 1 }, none: { px: 0, nx: 0, py: 0, ny: 0, pz: 0, nz: 0 },
  };

  S3.buildMap = function (def) {
    const W = def.W, H = def.H; const t0 = performance.now();
    const colliders = []; // {min,max,surface,mat}
    const render = [];    // {min,max,mat,faces,uv}
    const c2w = (i, j) => [def.xmin + i * CELL, def.zmin + j * CELL];
    const walk = (i, j) => (i >= 0 && j >= 0 && i < W && j < H && !isNaN(def.h[def.idx(i, j)]));

    // --- wall info for solid cells near walkable cells ---
    const wallTop = new Float32Array(W * H).fill(NaN); const wallMat = new Array(W * H).fill(null); const wallBottom = new Float32Array(W * H).fill(0);
    const R = 2;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = def.idx(i, j); if (walk(i, j)) continue;
      let top = -Infinity, bottom = Infinity, mat = null, bestD = 99, found = false;
      for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
        if (!walk(i + di, j + dj)) continue; const kk = def.idx(i + di, j + dj); found = true;
        const fy = def.h[kk]; const d = Math.abs(di) + Math.abs(dj);
        if (!isNaN(def.solidH[k])) { top = Math.max(top, fy + def.solidH[k]); } else top = Math.max(top, fy + def.wh[kk]);
        bottom = Math.min(bottom, fy);
        if (d < bestD) { bestD = d; mat = def.solidMat[k] || def.wm[kk]; }
      }
      if (!found) continue;
      wallTop[k] = Math.round(top * 4) / 4; wallBottom[k] = bottom - 1; wallMat[k] = mat;
    }
    // merge walls
    const wallRects = mergeRects(W, H, (i, j) => { const k = def.idx(i, j); return isNaN(wallTop[k]) ? null : (wallTop[k] + '|' + wallBottom[k] + '|' + wallMat[k]); });
    for (const r of wallRects) {
      const k = def.idx(r.i0, r.j0); const [x0, z0] = c2w(r.i0, r.j0); const [x1, z1] = c2w(r.i1 + 1, r.j1 + 1);
      const b = { min: { x: x0, y: wallBottom[k], z: z0 }, max: { x: x1, y: wallTop[k], z: z1 }, mat: wallMat[k], faces: 'noBottom', uv: 'world', surface: S3.MATS[wallMat[k]] && S3.MATS[wallMat[k]].tex === 'metal' ? 'metal' : 'concrete' };
      colliders.push(b); render.push(b);
    }
    // merge floors (collision box + top-only render + side render for platforms)
    const floorRects = mergeRects(W, H, (i, j) => { const k = def.idx(i, j); return isNaN(def.h[k]) ? null : (def.h[k] + '|' + def.fm[k] + '|' + def.wm[k]); });
    let minFloor = Infinity; for (let k = 0; k < W * H; k++) if (!isNaN(def.h[k])) minFloor = Math.min(minFloor, def.h[k]);
    for (const r of floorRects) {
      const k = def.idx(r.i0, r.j0); const [x0, z0] = c2w(r.i0, r.j0); const [x1, z1] = c2w(r.i1 + 1, r.j1 + 1); const y = def.h[k];
      const surf = { sand: 'sand', dirt: 'dirt', grass: 'grass', metal: 'metal', wood: 'wood', crate: 'wood', tiles: 'concrete' }[S3.MATS[def.fm[k]] ? S3.MATS[def.fm[k]].tex : ''] || 'concrete';
      colliders.push({ min: { x: x0, y: minFloor - 2, z: z0 }, max: { x: x1, y: y, z: z1 }, surface: surf, mat: def.fm[k] });
      render.push({ min: { x: x0, y: y - 0.1, z: z0 }, max: { x: x1, y: y, z: z1 }, mat: def.fm[k], faces: 'top', uv: 'world' });
      if (y > minFloor + 0.01) render.push({ min: { x: x0, y: minFloor - 1, z: z0 }, max: { x: x1, y: y - 0.001, z: z1 }, mat: def.wm[k], faces: 'sides', uv: 'world' });
    }
    // manual brushes
    for (const b of def.brushes) {
      if (b.collide) colliders.push({ min: b.min, max: b.max, surface: b.surface || 'concrete', mat: b.mat });
      if (b.faces !== 'none') render.push(b);
    }

    // --- build merged meshes per material ---
    const group = new THREE.Group(); group.name = 'map';
    const byMat = {};
    for (const b of render) { (byMat[b.mat] = byMat[b.mat] || []).push(b); }
    for (const matName in byMat) {
      const gb = new GeoBuilder(); const scale = S3.getMatScale(matName); const perBox = S3.isPerBox(matName);
      for (const b of byMat[matName]) gb.box(b.min, b.max, FACES[b.faces] || FACES.all, perBox ? 'box' : b.uv, scale);
      const mesh = new THREE.Mesh(gb.build(), S3.getMaterial(matName)); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'map_' + matName;
      group.add(mesh);
    }
    for (const m of def.meshes) group.add(m);
    const lights = [];
    for (const L of def.lights) { const pl = new THREE.PointLight(L.color, L.intensity, L.dist, 2); pl.position.set(L.x, L.y, L.z); group.add(pl); lights.push(pl); }

    // --- minimap ---
    const mm = document.createElement('canvas'); const MMS = 512; mm.width = MMS; mm.height = MMS; const ctx = mm.getContext('2d');
    const sx = MMS / (def.xmax - def.xmin), sz = MMS / (def.zmax - def.zmin); const mscale = Math.min(sx, sz);
    ctx.fillStyle = '#0a0e14'; ctx.fillRect(0, 0, MMS, MMS);
    let maxH = 0; for (let k = 0; k < W * H; k++) if (!isNaN(def.h[k])) maxH = Math.max(maxH, def.h[k]);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = def.idx(i, j); const y = def.h[k]; if (isNaN(y)) { if (!isNaN(wallTop[k])) { ctx.fillStyle = '#3a4250'; ctx.fillRect(i * CELL * mscale, j * CELL * mscale, CELL * mscale + 0.5, CELL * mscale + 0.5); } continue; }
      const l = 0.35 + 0.45 * (maxH > 0 ? y / maxH : 0); ctx.fillStyle = `rgb(${Math.floor(120 * l + 40)},${Math.floor(130 * l + 45)},${Math.floor(140 * l + 55)})`;
      ctx.fillRect(i * CELL * mscale, j * CELL * mscale, CELL * mscale + 0.5, CELL * mscale + 0.5);
      if (def.blocked[k]) { ctx.fillStyle = 'rgba(20,24,30,0.55)'; ctx.fillRect(i * CELL * mscale, j * CELL * mscale, CELL * mscale + 0.5, CELL * mscale + 0.5); }
    }
    for (const s of def.sites) {
      ctx.fillStyle = 'rgba(255,200,60,0.18)'; ctx.fillRect((s.min.x - def.xmin) * mscale, (s.min.z - def.zmin) * mscale, (s.max.x - s.min.x) * mscale, (s.max.z - s.min.z) * mscale);
      ctx.fillStyle = 'rgba(255,220,100,0.9)'; ctx.font = 'bold ' + Math.floor(mscale * 6) + 'px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(s.name, (s.cx - def.xmin) * mscale, (s.cz - def.zmin) * mscale);
    }

    const world = new S3.World(colliders, def);
    const nav = new S3.NavGrid(def, world);
    console.log(`[map] ${def.name}: ${colliders.length} colliders, ${render.length} render boxes, ${Object.keys(byMat).length} materials, nav ${nav.count} nodes, ${(performance.now() - t0).toFixed(0)}ms`);
    return { def, group, world, nav, minimap: mm, minimapScale: mscale, lights, sites: def.sites, spawns: def.spawns, regions: def.regions, bounds: { xmin: def.xmin, zmin: def.zmin, xmax: def.xmax, zmax: def.zmax } };
  };
})();
