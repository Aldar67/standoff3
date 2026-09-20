// ===== Standoff 3 — navigation grid + A* pathfinding for bots =====
'use strict';
(function () {
  const S3 = window.S3;
  const RES = 1.0; // node size (m)

  class NavGrid {
    constructor(def, world) {
      this.def = def; this.world = world; this.res = RES;
      this.xmin = def.xmin; this.zmin = def.zmin;
      this.NW = Math.floor((def.xmax - def.xmin) / RES); this.NH = Math.floor((def.zmax - def.zmin) / RES);
      const n = this.NW * this.NH;
      this.walk = new Uint8Array(n); this.y = new Float32Array(n); this.cost = new Float32Array(n).fill(1); this.nearWall = new Uint8Array(n); this.cover = new Uint8Array(n);
      this.count = 0;
      const cellsPer = Math.round(RES / 0.5);
      for (let J = 0; J < this.NH; J++) for (let I = 0; I < this.NW; I++) {
        const k = J * this.NW + I; let ok = true, minY = Infinity, maxY = -Infinity, minClear = Infinity;
        for (let dj = 0; dj < cellsPer && ok; dj++) for (let di = 0; di < cellsPer; di++) {
          const ci = I * cellsPer + di, cj = J * cellsPer + dj; if (ci >= def.W || cj >= def.H) { ok = false; break; }
          const ck = def.idx(ci, cj); const h = def.h[ck];
          if (isNaN(h) || def.blocked[ck]) { ok = false; break; }
          minY = Math.min(minY, h); maxY = Math.max(maxY, h); minClear = Math.min(minClear, def.ceil[ck] - h);
        }
        if (ok && (maxY - minY > 0.6 || minClear < 1.85)) ok = false;
        if (ok) { this.walk[k] = 1; this.y[k] = maxY; this.count++; }
      }
      // near-wall / cover flags & costs
      for (let J = 0; J < this.NH; J++) for (let I = 0; I < this.NW; I++) {
        const k = J * this.NW + I; if (!this.walk[k]) continue; let wallN = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; if (!this.walkAt(I + di, J + dj) || Math.abs(this.yAt(I + di, J + dj) - this.y[k]) > 0.6) wallN++; }
        if (wallN > 0) { this.nearWall[k] = 1; this.cost[k] = 1 + wallN * 0.35; }
        if (wallN >= 2 && wallN <= 5) this.cover[k] = 1;
      }
      this.list = []; for (let k = 0; k < n; k++) if (this.walk[k]) this.list.push(k);
      // A* buffers
      this.g = new Float32Array(n); this.f = new Float32Array(n); this.parent = new Int32Array(n); this.closed = new Int32Array(n); this.openStamp = new Int32Array(n); this.searchId = 0;
      this.tmpPath = [];
    }
    walkAt(I, J) { return I >= 0 && J >= 0 && I < this.NW && J < this.NH && this.walk[J * this.NW + I] === 1; }
    yAt(I, J) { return this.y[J * this.NW + I]; }
    nodeX(k) { return this.xmin + ((k % this.NW) + 0.5) * RES; }
    nodeZ(k) { return this.zmin + (Math.floor(k / this.NW) + 0.5) * RES; }
    nodePos(k) { return { x: this.nodeX(k), y: this.y[k], z: this.nodeZ(k) }; }
    nodeAtExact(x, z) { const I = Math.floor((x - this.xmin) / RES), J = Math.floor((z - this.zmin) / RES); if (!this.walkAt(I, J)) return -1; return J * this.NW + I; }
    // nearest walkable node (search radius up to r meters), preferring similar height
    nodeAt(x, z, y, r) {
      r = r || 3; const I0 = Math.floor((x - this.xmin) / RES), J0 = Math.floor((z - this.zmin) / RES);
      if (this.walkAt(I0, J0) && (y === undefined || Math.abs(this.yAt(I0, J0) - y) < 1.2)) return J0 * this.NW + I0;
      let best = -1, bestD = Infinity; const R = Math.ceil(r / RES);
      for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
        const I = I0 + di, J = J0 + dj; if (!this.walkAt(I, J)) continue; const k = J * this.NW + I;
        let d = Math.hypot(this.nodeX(k) - x, this.nodeZ(k) - z); if (y !== undefined) d += Math.abs(this.y[k] - y) * 2;
        if (d < bestD) { bestD = d; best = k; }
      }
      return best;
    }
    canStep(from, to) { const dy = this.y[to] - this.y[from]; return dy <= 0.6 && dy >= -2.6; }
    // A* search from node a to node b; returns array of node indices (a..b) or null
    astar(a, b, maxExpand) {
      if (a < 0 || b < 0) return null; if (a === b) return [a];
      maxExpand = maxExpand || 30000;
      const sid = ++this.searchId; const NW = this.NW, NH = this.NH; const g = this.g, f = this.f, parent = this.parent, closed = this.closed, openStamp = this.openStamp;
      const bI = b % NW, bJ = Math.floor(b / NW);
      const heur = (k) => { const dI = Math.abs((k % NW) - bI), dJ = Math.abs(Math.floor(k / NW) - bJ); return (dI + dJ) + (Math.SQRT2 - 2) * Math.min(dI, dJ); };
      const heap = new S3.MinHeap((k) => f[k]);
      g[a] = 0; f[a] = heur(a); parent[a] = -1; openStamp[a] = sid; heap.push(a);
      let expanded = 0;
      while (heap.size) {
        const cur = heap.pop(); if (closed[cur] === sid) continue; closed[cur] = sid;
        if (cur === b) { const path = []; let n = b; while (n !== -1) { path.push(n); n = parent[n]; } path.reverse(); return path; }
        if (++expanded > maxExpand) return null;
        const I = cur % NW, J = Math.floor(cur / NW);
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue; const nI = I + di, nJ = J + dj; if (!this.walkAt(nI, nJ)) continue;
          const nk = nJ * NW + nI; if (closed[nk] === sid) continue;
          if (di && dj) { if (!this.walkAt(I + di, J) || !this.walkAt(I, J + dj)) continue; }
          if (!this.canStep(cur, nk)) continue;
          const step = (di && dj) ? Math.SQRT2 : 1; const ng = g[cur] + step * this.cost[nk] + (this.y[nk] < this.y[cur] - 0.6 ? 3 : 0);
          if (openStamp[nk] !== sid || ng < g[nk]) { openStamp[nk] = sid; g[nk] = ng; f[nk] = ng + heur(nk); parent[nk] = cur; heap.push(nk); }
        }
      }
      return null;
    }
    // check straight walkable line between two nodes (for smoothing)
    lineWalkable(k0, k1) {
      const x0 = this.nodeX(k0), z0 = this.nodeZ(k0), x1 = this.nodeX(k1), z1 = this.nodeZ(k1);
      const d = Math.hypot(x1 - x0, z1 - z0); if (d < 0.01) return true; const steps = Math.ceil(d / 0.4); const px = -(z1 - z0) / d * 0.38, pz = (x1 - x0) / d * 0.38;
      let lastY = this.y[k0];
      for (let s = 1; s <= steps; s++) {
        const t = s / steps; const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        const kc = this.nodeAtExact(x, z); if (kc < 0) return false; if (Math.abs(this.y[kc] - lastY) > 0.6) return false; lastY = this.y[kc];
        if (this.nodeAtExact(x + px, z + pz) < 0 || this.nodeAtExact(x - px, z - pz) < 0) return false;
      }
      return true;
    }
    findPath(fromX, fromZ, fromY, toX, toZ, toY) {
      const a = this.nodeAt(fromX, fromZ, fromY, 3), b = this.nodeAt(toX, toZ, toY, 4);
      if (a < 0 || b < 0) return null;
      const raw = this.astar(a, b); if (!raw) return null;
      // smoothing (string pulling)
      const out = [raw[0]]; let i = 0;
      while (i < raw.length - 1) {
        let j = raw.length - 1; while (j > i + 1 && !this.lineWalkable(raw[i], raw[j])) j--;
        out.push(raw[j]); i = j;
      }
      return out.map((k) => this.nodePos(k));
    }
    randomNode(filter) { for (let tries = 0; tries < 60; tries++) { const k = this.list[Math.floor(Math.random() * this.list.length)]; if (!filter || filter(k)) return k; } return this.list[0]; }
    randomNodeNear(x, z, r, filter) {
      for (let tries = 0; tries < 40; tries++) {
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r; const k = this.nodeAtExact(x + Math.cos(a) * d, z + Math.sin(a) * d);
        if (k >= 0 && (!filter || filter(k))) return k;
      }
      return this.nodeAt(x, z, undefined, r);
    }
    nodesInRect(min, max) { const out = []; for (const k of this.list) { const x = this.nodeX(k), z = this.nodeZ(k); if (x >= min.x && x <= max.x && z >= min.z && z <= max.z) out.push(k); } return out; }
    pathLength(path) { let d = 0; for (let i = 1; i < path.length; i++) d += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z); return d; }
  }
  S3.NavGrid = NavGrid;
})();
