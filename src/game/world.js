// ===== Standoff 3 — world collision: AABB colliders, spatial hash, raycasts, body movement =====
'use strict';
(function () {
  const S3 = window.S3;
  const HC = 4; // hash cell size (m)
  const EPS = 0.001;

  class World {
    constructor(colliders, def) {
      this.boxes = colliders; this.def = def;
      this.xmin = def.xmin - 8; this.zmin = def.zmin - 8; this.xmax = def.xmax + 8; this.zmax = def.zmax + 8;
      this.gw = Math.ceil((this.xmax - this.xmin) / HC); this.gh = Math.ceil((this.zmax - this.zmin) / HC);
      this.cells = new Array(this.gw * this.gh); for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
      this.stamp = new Int32Array(colliders.length); this.stampId = 1;
      for (let i = 0; i < colliders.length; i++) {
        const b = colliders[i]; b.id = i;
        const i0 = this.cx(b.min.x), i1 = this.cx(b.max.x), j0 = this.cz(b.min.z), j1 = this.cz(b.max.z);
        for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) this.cells[j * this.gw + ii].push(b);
      }
      this.smokes = []; // {x,y,z,r} for LOS blocking
      this.tmpOut = { nx: 0, ny: 0, nz: 0 };
      this.dynamic = []; // dynamic colliders (dropped weapons etc) not used for movement
    }
    cx(x) { return S3.clamp(Math.floor((x - this.xmin) / HC), 0, this.gw - 1); }
    cz(z) { return S3.clamp(Math.floor((z - this.zmin) / HC), 0, this.gh - 1); }
    // Query boxes overlapping an AABB (returns array; reused)
    query(min, max, out) {
      out = out || []; out.length = 0; const sid = ++this.stampId;
      const i0 = this.cx(min.x), i1 = this.cx(max.x), j0 = this.cz(min.z), j1 = this.cz(max.z);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const cell = this.cells[j * this.gw + i];
        for (let k = 0; k < cell.length; k++) {
          const b = cell[k]; if (this.stamp[b.id] === sid) continue; this.stamp[b.id] = sid;
          if (b.min.x < max.x && b.max.x > min.x && b.min.y < max.y && b.max.y > min.y && b.min.z < max.z && b.max.z > min.z) out.push(b);
        }
      }
      return out;
    }
    // Raycast against static world. Returns null or {t, x,y,z, nx,ny,nz, box}
    raycast(ox, oy, oz, dx, dy, dz, maxDist) {
      const out = this.tmpOut; let best = maxDist, bestBox = null, bnx = 0, bny = 0, bnz = 0;
      const sid = ++this.stampId;
      // 2D DDA over hash grid
      let i = this.cx(ox), j = this.cz(oz);
      const stepI = dx > 0 ? 1 : (dx < 0 ? -1 : 0), stepJ = dz > 0 ? 1 : (dz < 0 ? -1 : 0);
      const tDeltaX = stepI !== 0 ? Math.abs(HC / dx) : Infinity, tDeltaZ = stepJ !== 0 ? Math.abs(HC / dz) : Infinity;
      let tMaxX = stepI !== 0 ? ((this.xmin + (i + (stepI > 0 ? 1 : 0)) * HC) - ox) / dx : Infinity;
      let tMaxZ = stepJ !== 0 ? ((this.zmin + (j + (stepJ > 0 ? 1 : 0)) * HC) - oz) / dz : Infinity;
      let tEnter = 0; let guard = 0;
      while (guard++ < 400) {
        if (i < 0 || j < 0 || i >= this.gw || j >= this.gh) break;
        if (tEnter > best) break;
        const cell = this.cells[j * this.gw + i];
        for (let k = 0; k < cell.length; k++) {
          const b = cell[k]; if (this.stamp[b.id] === sid) continue; this.stamp[b.id] = sid;
          const t = S3.rayAABB(ox, oy, oz, dx, dy, dz, b, best, out);
          if (t >= 0 && t < best) { best = t; bestBox = b; bnx = out.nx; bny = out.ny; bnz = out.nz; }
        }
        if (tMaxX < tMaxZ) { tEnter = tMaxX; tMaxX += tDeltaX; i += stepI; } else { tEnter = tMaxZ; tMaxZ += tDeltaZ; j += stepJ; }
        if (stepI === 0 && stepJ === 0) break;
      }
      if (!bestBox) return null;
      return { t: best, x: ox + dx * best, y: oy + dy * best, z: oz + dz * best, nx: bnx, ny: bny, nz: bnz, box: bestBox };
    }
    // LOS between two points (static world + smokes). Returns true if clear.
    lineOfSight(ax, ay, az, bx, by, bz, checkSmoke) {
      let dx = bx - ax, dy = by - ay, dz = bz - az; const d = Math.hypot(dx, dy, dz); if (d < 1e-4) return true;
      dx /= d; dy /= d; dz /= d;
      const h = this.raycast(ax, ay, az, dx, dy, dz, d - 0.05); if (h) return false;
      if (checkSmoke !== false) for (const s of this.smokes) { if (S3.raySphere(ax, ay, az, dx, dy, dz, s.x, s.y, s.z, s.r, d) >= 0) return false; }
      return true;
    }
    floorAt(x, z, fromY) { // find floor top at x,z at or below fromY+0.1
      const h = this.raycast(x, (fromY === undefined ? 50 : fromY + 0.1), z, 0, -1, 0, 100); return h ? h.y : 0;
    }
    isSolidPoint(x, y, z) {
      const q = this.query({ x: x - 0.01, y: y - 0.01, z: z - 0.01 }, { x: x + 0.01, y: y + 0.01, z: z + 0.01 }, this._q = this._q || []); return q.length > 0;
    }

    // ---- Body movement (feet position, AABB radius r, height h) ----
    // body: {pos:Vector3, vel:Vector3, r, h, onGround, groundSurface}
    sweep(body, axis, delta, tmpMin, tmpMax) {
      if (delta === 0) return false;
      const p = body.pos; p[axis] += delta; let blocked = false;
      for (let iter = 0; iter < 3; iter++) {
        tmpMin.x = p.x - body.r; tmpMin.y = p.y; tmpMin.z = p.z - body.r; tmpMax.x = p.x + body.r; tmpMax.y = p.y + body.h; tmpMax.z = p.z + body.r;
        const q = this.query(tmpMin, tmpMax, this._sq = this._sq || []);
        if (q.length === 0) break;
        // resolve against the box with the largest penetration along axis direction
        let fixed = false;
        for (let k = 0; k < q.length; k++) {
          const b = q[k];
          if (axis === 'y') { if (delta > 0) { p.y = b.min.y - body.h - EPS; } else { p.y = b.max.y + EPS; body.groundSurface = b.surface; body.groundBox = b; } }
          else if (axis === 'x') { if (delta > 0) p.x = b.min.x - body.r - EPS; else p.x = b.max.x + body.r + EPS; }
          else { if (delta > 0) p.z = b.min.z - body.r - EPS; else p.z = b.max.z + body.r + EPS; }
          blocked = true; fixed = true;
        }
        if (!fixed) break;
      }
      return blocked;
    }
    move(body, dt) {
      const p = body.pos, v = body.vel; const tmin = this._tmin = this._tmin || { x: 0, y: 0, z: 0 }, tmax = this._tmax = this._tmax || { x: 0, y: 0, z: 0 };
      const dx = v.x * dt, dz = v.z * dt, dy = v.y * dt;
      const wasGround = body.onGround; const stepH = S3.PHYS.stepHeight;
      const ox = p.x, oy = p.y, oz = p.z;
      // horizontal
      let bx = this.sweep(body, 'x', dx, tmin, tmax); let bz = this.sweep(body, 'z', dz, tmin, tmax);
      if ((bx || bz) && (wasGround || v.y <= 0.01)) {
        // attempt step-up
        const rx = p.x, rz = p.z; const ry = p.y;
        p.x = ox; p.y = oy; p.z = oz;
        const upBlocked = this.sweep(body, 'y', stepH, tmin, tmax);
        const lifted = p.y - oy;
        const bx2 = this.sweep(body, 'x', dx, tmin, tmax); const bz2 = this.sweep(body, 'z', dz, tmin, tmax);
        const downBlocked = this.sweep(body, 'y', -lifted, tmin, tmax);
        const prog1 = (rx - ox) * (rx - ox) + (rz - oz) * (rz - oz); const prog2 = (p.x - ox) * (p.x - ox) + (p.z - oz) * (p.z - oz);
        if (!upBlocked && prog2 > prog1 + 1e-6 && p.y <= oy + stepH + 0.01) { bx = bx2; bz = bz2; if (downBlocked) body.onGround = true; }
        else { p.x = rx; p.y = ry; p.z = rz; }
      }
      if (bx) v.x = 0; if (bz) v.z = 0;
      // vertical
      body.onGround = false;
      const by = this.sweep(body, 'y', dy, tmin, tmax);
      if (by) { if (dy < 0) { body.onGround = true; body.landSpeed = -v.y; } v.y = 0; }
      // ground snap when walking down slopes/stairs
      if (!body.onGround && wasGround && v.y <= 0 && !body.jumping) {
        const yBefore = p.y; const snapped = this.sweep(body, 'y', -stepH, tmin, tmax);
        if (snapped) { body.onGround = true; v.y = 0; } else { p.y = yBefore; }
      }
      // ground probe (tiny)
      if (!body.onGround) {
        tmin.x = p.x - body.r; tmin.y = p.y - 0.03; tmin.z = p.z - body.r; tmax.x = p.x + body.r; tmax.y = p.y + 0.01; tmax.z = p.z + body.r;
        const q = this.query(tmin, tmax, this._gq = this._gq || []); if (q.length && v.y <= 0) { body.onGround = true; body.groundSurface = q[0].surface; body.groundBox = q[0]; }
      }
      // world bounds safety
      if (p.y < -30) { p.y = 5; v.set(0, 0, 0); }
    }
    fits(x, y, z, r, h) { const q = this.query({ x: x - r, y: y + 0.02, z: z - r }, { x: x + r, y: y + h, z: z + r }, this._fq = this._fq || []); return q.length === 0; }
  }
  S3.World = World;
})();
