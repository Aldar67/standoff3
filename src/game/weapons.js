// ===== Standoff 3 — weapon models, weapon logic, first-person viewmodel =====
'use strict';
(function () {
  const S3 = window.S3;
  const mcache = {};
  function M(color, opts) { const k = color + '|' + (opts ? JSON.stringify(opts) : ''); if (mcache[k]) return mcache[k]; const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.35 }, opts || {})); mcache[k] = m; return m; }
  function P(g, w, h, d, color, x, y, z, opts) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(color, opts)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; }
  function CYL(g, r, len, color, x, y, z, axis) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), M(color)); if (axis === 'z') m.rotation.x = Math.PI / 2; else if (axis === 'x') m.rotation.z = Math.PI / 2; m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; }

  const WOOD = 0x6a4a2a, BLACK = 0x1a1a1c, DARK = 0x2a2a2e, STEEL = 0x8a8c90, GUN = 0x3a3a3e, TAN = 0x9a8a68, GREEN = 0x4a5a3a;

  // Models: forward = -Z, origin at grip top. Sets userData.muzzle (Vector3 local)
  // skinId (optional): a key of S3.SKINS -- body parts get the finish's primary material, dark furniture the secondary
  S3.buildWeaponModel = function (w, scale, skinId) {
    const g = new THREE.Group(); const c = w.color || GUN; scale = scale || 1;
    let muzzle = new THREE.Vector3(0, 0.02, -0.5);
    switch (w.model) {
      case 'pistol': case 'pistol_s': case 'deagle': {
        const big = w.model === 'deagle'; const L = big ? 0.24 : 0.19;
        P(g, 0.03, 0.045, L, c, 0, 0.03, -L / 2 + 0.03); // slide
        P(g, 0.03, 0.035, L * 0.8, DARK, 0, 0.0, -L / 2 + 0.03); // frame
        P(g, 0.028, 0.1, 0.035, big ? BLACK : DARK, 0, -0.06, 0.02); g.children[2].rotation.x = -0.25; // grip
        P(g, 0.01, 0.02, 0.02, BLACK, 0, -0.005, -0.04); // trigger guard
        CYL(g, 0.008, L, STEEL, 0, 0.03, -L / 2 + 0.03, 'z');
        if (w.model === 'pistol_s') { CYL(g, 0.014, 0.1, BLACK, 0, 0.03, -L + 0.03 - 0.05, 'z'); muzzle = new THREE.Vector3(0, 0.03, -L - 0.07); } else muzzle = new THREE.Vector3(0, 0.03, -L + 0.02);
        P(g, 0.006, 0.012, 0.01, BLACK, 0, 0.058, -L + 0.05); P(g, 0.02, 0.012, 0.01, BLACK, 0, 0.058, 0.02);
        break;
      }
      case 'tec9': {
        P(g, 0.035, 0.06, 0.22, c, 0, 0.02, -0.06); P(g, 0.03, 0.14, 0.04, BLACK, 0, -0.06, 0.0); CYL(g, 0.012, 0.12, STEEL, 0, 0.03, -0.22, 'z'); P(g, 0.025, 0.09, 0.03, DARK, 0, -0.05, -0.08);
        muzzle = new THREE.Vector3(0, 0.03, -0.28); break;
      }
      case 'smg': {
        P(g, 0.05, 0.07, 0.36, c, 0, 0.03, -0.14); // receiver
        CYL(g, 0.011, 0.16, STEEL, 0, 0.045, -0.4, 'z'); // barrel
        P(g, 0.04, 0.06, 0.12, DARK, 0, 0.035, -0.3); // handguard
        P(g, 0.03, 0.11, 0.04, BLACK, 0, -0.06, 0.02); g.children[3].rotation.x = -0.2; // grip
        P(g, 0.028, 0.16, 0.04, DARK, 0, -0.08, -0.14); // magazine
        P(g, 0.03, 0.03, 0.18, DARK, 0, 0.03, 0.14); P(g, 0.03, 0.08, 0.03, DARK, 0, 0.0, 0.22); // stock
        P(g, 0.008, 0.02, 0.01, BLACK, 0, 0.075, -0.3); P(g, 0.03, 0.02, 0.01, BLACK, 0, 0.075, 0.0);
        muzzle = new THREE.Vector3(0, 0.045, -0.5); break;
      }
      case 'p90': {
        P(g, 0.06, 0.09, 0.42, c, 0, 0.02, -0.1); P(g, 0.05, 0.03, 0.3, DARK, 0, 0.08, -0.1); // top mag
        P(g, 0.03, 0.06, 0.05, BLACK, 0, -0.05, 0.0); P(g, 0.03, 0.06, 0.05, BLACK, 0, -0.05, -0.16);
        CYL(g, 0.011, 0.08, STEEL, 0, 0.03, -0.35, 'z'); P(g, 0.025, 0.03, 0.06, BLACK, 0, 0.11, -0.05);
        muzzle = new THREE.Vector3(0, 0.03, -0.4); break;
      }
      case 'famas': case 'aug': {
        P(g, 0.05, 0.08, 0.36, c, 0, 0.03, 0.04); // body (bullpup)
        P(g, 0.04, 0.06, 0.26, DARK, 0, 0.03, -0.26); CYL(g, 0.011, 0.28, STEEL, 0, 0.045, -0.5, 'z');
        P(g, 0.03, 0.1, 0.04, BLACK, 0, -0.06, -0.08); P(g, 0.028, 0.14, 0.05, DARK, 0, -0.06, 0.12);
        if (w.model === 'aug') { CYL(g, 0.022, 0.12, BLACK, 0, 0.1, -0.05, 'z'); } else { P(g, 0.02, 0.05, 0.3, DARK, 0, 0.09, -0.05); }
        P(g, 0.03, 0.05, 0.04, DARK, 0, 0.0, -0.3);
        muzzle = new THREE.Vector3(0, 0.045, -0.64); break;
      }
      case 'm4': {
        P(g, 0.05, 0.075, 0.26, c, 0, 0.03, -0.08); // upper+lower
        P(g, 0.045, 0.06, 0.24, DARK, 0, 0.035, -0.32); // handguard
        CYL(g, 0.01, 0.2, STEEL, 0, 0.045, -0.54, 'z'); CYL(g, 0.014, 0.05, BLACK, 0, 0.045, -0.63, 'z');
        P(g, 0.03, 0.1, 0.04, BLACK, 0, -0.06, 0.0); g.children[4].rotation.x = -0.25;
        P(g, 0.03, 0.15, 0.05, DARK, 0, -0.08, -0.12); g.children[5].rotation.x = 0.15;
        P(g, 0.035, 0.035, 0.04, DARK, 0, 0.09, -0.06); // carry handle
        P(g, 0.03, 0.05, 0.2, DARK, 0, 0.02, 0.15); P(g, 0.04, 0.09, 0.04, DARK, 0, 0.0, 0.26); // stock
        P(g, 0.008, 0.02, 0.01, BLACK, 0, 0.08, -0.4); P(g, 0.03, 0.02, 0.01, BLACK, 0, 0.085, -0.02);
        muzzle = new THREE.Vector3(0, 0.045, -0.66); break;
      }
      case 'ak': {
        const wood = w.color === 0x5a3c22 ? WOOD : DARK;
        P(g, 0.05, 0.07, 0.24, c === 0x5a3c22 ? GUN : c, 0, 0.03, -0.06); // receiver
        P(g, 0.045, 0.055, 0.2, wood, 0, 0.03, -0.3); // handguard
        CYL(g, 0.01, 0.3, STEEL, 0, 0.05, -0.55, 'z'); P(g, 0.02, 0.03, 0.03, BLACK, 0, 0.05, -0.68);
        P(g, 0.03, 0.1, 0.04, wood, 0, -0.06, 0.02); g.children[4].rotation.x = -0.3;
        P(g, 0.03, 0.17, 0.05, DARK, 0, -0.09, -0.1); g.children[5].rotation.x = 0.35; // curved mag
        P(g, 0.03, 0.05, 0.22, wood, 0, 0.015, 0.17); P(g, 0.04, 0.08, 0.03, wood, 0, 0.0, 0.28); // stock
        P(g, 0.02, 0.02, 0.04, DARK, 0, 0.07, -0.42); P(g, 0.03, 0.02, 0.02, DARK, 0, 0.075, -0.04);
        muzzle = new THREE.Vector3(0, 0.05, -0.7); break;
      }
      case 'g3': {
        P(g, 0.05, 0.075, 0.3, c, 0, 0.03, -0.08); P(g, 0.045, 0.06, 0.24, DARK, 0, 0.035, -0.34); CYL(g, 0.011, 0.26, STEEL, 0, 0.045, -0.58, 'z');
        P(g, 0.03, 0.1, 0.04, BLACK, 0, -0.06, 0.0); P(g, 0.03, 0.16, 0.05, DARK, 0, -0.08, -0.1);
        P(g, 0.03, 0.05, 0.22, DARK, 0, 0.02, 0.17); P(g, 0.04, 0.09, 0.04, DARK, 0, 0.0, 0.28);
        CYL(g, 0.022, 0.16, BLACK, 0, 0.1, -0.1, 'z'); P(g, 0.03, 0.03, 0.03, BLACK, 0, 0.075, -0.1);
        muzzle = new THREE.Vector3(0, 0.045, -0.72); break;
      }
      case 'scout': case 'awp': {
        const body = w.model === 'awp' ? 0x3a4a30 : 0x5a4a30;
        P(g, 0.045, 0.07, 0.5, body, 0, 0.02, 0.0); // stock+body
        CYL(g, 0.012, 0.5, STEEL, 0, 0.05, -0.5, 'z'); P(g, 0.03, 0.04, 0.4, body, 0, 0.03, -0.35);
        P(g, 0.03, 0.09, 0.05, body, 0, -0.05, 0.03); P(g, 0.04, 0.1, 0.05, body, 0, -0.02, 0.24);
        CYL(g, 0.02, 0.22, BLACK, 0, 0.1, -0.08, 'z'); P(g, 0.03, 0.03, 0.03, BLACK, 0, 0.07, -0.02); P(g, 0.03, 0.03, 0.03, BLACK, 0, 0.07, -0.15); // scope
        P(g, 0.028, 0.1, 0.04, DARK, 0, -0.06, -0.1); // mag
        CYL(g, 0.006, 0.05, STEEL, 0.03, 0.06, 0.02, 'x'); // bolt
        muzzle = new THREE.Vector3(0, 0.05, -0.76); break;
      }
      case 'shotgun': {
        P(g, 0.045, 0.065, 0.24, c, 0, 0.03, -0.04); CYL(g, 0.013, 0.5, STEEL, 0, 0.05, -0.42, 'z'); CYL(g, 0.014, 0.4, DARK, 0, 0.02, -0.36, 'z');
        P(g, 0.04, 0.045, 0.14, WOOD, 0, 0.02, -0.3); P(g, 0.03, 0.1, 0.05, WOOD, 0, -0.05, 0.03); P(g, 0.035, 0.06, 0.22, WOOD, 0, 0.01, 0.2); P(g, 0.04, 0.09, 0.03, DARK, 0, 0.0, 0.31);
        muzzle = new THREE.Vector3(0, 0.05, -0.68); break;
      }
      case 'mg': {
        P(g, 0.06, 0.09, 0.34, c, 0, 0.03, -0.08); P(g, 0.05, 0.06, 0.24, DARK, 0, 0.04, -0.34); CYL(g, 0.014, 0.28, STEEL, 0, 0.05, -0.58, 'z');
        P(g, 0.08, 0.1, 0.12, DARK, -0.06, -0.02, -0.06); // box mag
        P(g, 0.03, 0.1, 0.04, BLACK, 0, -0.06, 0.03); P(g, 0.035, 0.05, 0.2, DARK, 0, 0.02, 0.18); P(g, 0.04, 0.1, 0.04, DARK, 0, 0.0, 0.28);
        CYL(g, 0.006, 0.2, STEEL, 0.02, -0.06, -0.4, 'y'); CYL(g, 0.006, 0.2, STEEL, -0.02, -0.06, -0.4, 'y'); // bipod
        muzzle = new THREE.Vector3(0, 0.05, -0.72); break;
      }
      case 'knife': {
        P(g, 0.025, 0.12, 0.03, BLACK, 0, -0.04, 0); g.children[0].rotation.x = -0.2; // handle
        const blade = P(g, 0.005, 0.03, 0.16, STEEL, 0, 0.03, -0.1); blade.material = M(0xc0c4c8, { metalness: 0.9, roughness: 0.25 });
        P(g, 0.03, 0.01, 0.03, STEEL, 0, 0.025, 0.0);
        muzzle = new THREE.Vector3(0, 0.03, -0.2); break;
      }
      case 'he': case 'flash': case 'smoke': {
        const col = w.model === 'he' ? 0x3a4a3a : (w.model === 'flash' ? 0x5a5a62 : 0x6a6a6a);
        const b = new THREE.Mesh(w.model === 'flash' ? new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10) : new THREE.SphereGeometry(0.05, 10, 8), M(col)); b.position.y = -0.02; g.add(b);
        P(g, 0.02, 0.03, 0.02, STEEL, 0, 0.045, 0); P(g, 0.012, 0.05, 0.03, STEEL, 0.02, 0.02, 0);
        if (w.model === 'he') { for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 4, 12), M(0x2a2a2a)); r.rotation.x = Math.PI / 2; r.position.y = -0.05 + i * 0.03; g.add(r); } }
        if (w.model === 'smoke') b.material = M(0x7a7a80);
        if (w.id === 'molotov') b.material = M(0x8a4a2a);
        muzzle = new THREE.Vector3(0, 0, 0); break;
      }
      case 'bomb': {
        P(g, 0.16, 0.05, 0.1, DARK, 0, 0, 0); P(g, 0.03, 0.03, 0.03, 0x2a2a2a, 0, 0.035, 0); P(g, 0.05, 0.015, 0.03, 0x22aa33, 0.03, 0.03, 0, { emissive: 0x22aa33, emissiveIntensity: 0.6 });
        for (let i = 0; i < 3; i++) P(g, 0.03, 0.05, 0.09, 0xa08a60, -0.05 + i * 0.05, 0.0, 0.0);
        P(g, 0.15, 0.02, 0.02, 0xaa2222, 0, 0.0, -0.05); muzzle = new THREE.Vector3(0, 0, 0); break;
      }
      default: P(g, 0.04, 0.06, 0.3, c, 0, 0, -0.1);
    }
    if (skinId && S3.SKINS && S3.SKINS[skinId]) {
      const mats = S3.finishMaterials(S3.SKINS[skinId].finish);
      const prim = new Set([c, GUN, 0x3a4a30, 0x5a4a30]); const sec = new Set([DARK, WOOD]);
      if (w.model === 'knife') { prim.clear(); prim.add(0xc0c4c8); sec.add(BLACK); }
      g.traverse((o) => { if (!o.isMesh) return; const h = o.material.color.getHex(); if (prim.has(h)) o.material = mats.primary; else if (sec.has(h)) o.material = mats.secondary; });
      g.userData.skin = skinId;
    }
    g.userData.muzzle = muzzle.clone().multiplyScalar(scale); g.scale.setScalar(scale);
    return g;
  };

  // ---------- Weapon instance (state machine) ----------
  class Weapon {
    constructor(id) {
      this.id = id; this.def = S3.WEAPONS[id]; const d = this.def;
      this.ammo = d.mag || 0; this.reserve = d.reserve || 0; this.count = d.type === 'grenade' ? 1 : 0;
      this.cooldown = 0; this.reloading = false; this.reloadT = 0; this.reloadTotal = 0; this.spreadAcc = 0; this.shotIdx = 0; this.sinceShot = 10;
      this.boltT = 0; this.burstLeft = 0; this.burstT = 0; this.drawT = 0; this.pattern = Weapon.pattern(id);
      this.pinPulled = false; this.pinT = 0; this.inspectT = 0; this.fireInterval = d.rpm ? 60 / d.rpm : 0.5;
      this.skin = null; // S3.SKINS id; travels with the weapon instance (drops/pickups keep it)
    }
    static pattern(id) {
      const d = S3.WEAPONS[id]; const rnd = S3.seededRandom(id.length * 7919 + id.charCodeAt(0) * 31); const arr = [];
      let dir = rnd() < 0.5 ? 1 : -1;
      for (let i = 0; i < 40; i++) {
        let up = (d.recoilUp || 1) * (i < 2 ? 0.8 : (i < 8 ? 1.0 : 0.55)); let side = 0;
        if (i >= 4) { if (i === 10 || i === 18 || i === 27) dir = -dir; side = (d.recoilSide || 0.5) * dir * (0.6 + rnd() * 0.8); }
        else side = (d.recoilSide || 0.5) * (rnd() - 0.5) * 0.5;
        arr.push([side, up]);
      }
      return arr;
    }
    get isGun() { return this.def.type !== 'knife' && this.def.type !== 'grenade' && this.def.type !== 'bomb'; }
    get busy() { return this.reloading || this.boltT > 0 || this.drawT > 0; }
    get totalAmmo() { return this.ammo + this.reserve; }
    draw() { this.drawT = this.def.type === 'knife' ? 0.25 : 0.45; this.reloading = false; this.burstLeft = 0; this.pinPulled = false; this.inspectT = 0; }
    update(dt, ctx) {
      this.cooldown -= dt; this.sinceShot += dt;
      if (this.drawT > 0) this.drawT -= dt;
      if (this.boltT > 0) this.boltT -= dt;
      if (this.inspectT > 0) this.inspectT -= dt;
      const d = this.def;
      // spread & recoil recovery
      const decay = d.spreadDecay || 6; this.spreadAcc = Math.max(0, this.spreadAcc - decay * dt * (0.5 + this.spreadAcc * 0.3));
      if (this.sinceShot > (d.type === 'sniper' ? 0.8 : 0.45) && this.shotIdx > 0) { this.shotIdx = Math.max(0, this.shotIdx - dt * 40); }
      // reload
      if (this.reloading) {
        this.reloadT += dt;
        if (d.reloadPerShell) {
          if (this.reloadT >= d.reloadTime) { this.reloadT = 0; if (this.reserve > 0 && this.ammo < d.mag) { this.ammo++; this.reserve--; if (ctx && ctx.onReloadShell) ctx.onReloadShell(); } if (this.ammo >= d.mag || this.reserve <= 0) { this.reloading = false; this.boltT = 0.4; } }
        } else {
          if (!this._magOut && this.reloadT >= d.reloadTime * 0.3) { this._magOut = true; if (ctx && ctx.onReloadStage) ctx.onReloadStage('magout'); }
          if (!this._magIn && this.reloadT >= d.reloadTime * 0.65) { this._magIn = true; if (ctx && ctx.onReloadStage) ctx.onReloadStage('magin'); }
          if (this.reloadT >= d.reloadTime) { const need = d.mag - this.ammo; const take = Math.min(need, this.reserve); this.ammo += take; this.reserve -= take; this.reloading = false; if (ctx && ctx.onReloadStage) ctx.onReloadStage('done'); }
        }
      }
      // burst continuation
      if (this.burstLeft > 0) { this.burstT -= dt; if (this.burstT <= 0) { this.burstT = this.fireInterval; if (this.ammo > 0) { this.burstLeft--; this.doShot(ctx); if (this.burstLeft === 0) this.cooldown = d.burstDelay || 0.3; } else this.burstLeft = 0; } }
    }
    canReload() { const d = this.def; return this.isGun && !this.reloading && this.reserve > 0 && this.ammo < d.mag && this.drawT <= 0 && this.boltT <= 0 && this.burstLeft === 0; }
    reload(ctx) { if (!this.canReload()) return false; this.reloading = true; this.reloadT = 0; this._magOut = false; this._magIn = false; this.burstLeft = 0; if (ctx && ctx.onReloadStage) ctx.onReloadStage('start'); return true; }
    spread(ctx) {
      const d = this.def; if (!this.isGun) return 0;
      let s = d.spreadBase + d.spreadMove * S3.clamp(ctx.speedFrac || 0, 0, 1) + (ctx.onGround ? 0 : d.spreadJump) + this.spreadAcc;
      if (ctx.crouching && ctx.onGround) s *= 0.72;
      if (d.scope && !ctx.scoped) s += d.noscopeSpread || 6; else if (ctx.scoped) s *= 0.7;
      return s;
    }
    // returns true if a shot was fired this call
    trigger(ctx, held, pressed) {
      const d = this.def;
      if (this.drawT > 0 || this.reloading && !d.reloadPerShell) return false;
      if (this.reloading && d.reloadPerShell && (held || pressed)) { this.reloading = false; this.boltT = 0.3; return false; }
      if (this.cooldown > 0 || this.boltT > 0 || this.burstLeft > 0) return false;
      if (d.type === 'knife') { if (!pressed && !(held && ctx.isBot)) return false; this.cooldown = ctx.alt ? 1.0 : 0.45; if (ctx.onKnife) ctx.onKnife(ctx.alt); return true; }
      if (d.type === 'grenade' || d.type === 'bomb') return false;
      const fire = d.fireMode === 'auto' ? held : pressed;
      if (!fire) return false;
      if (this.ammo <= 0) { this.cooldown = 0.25; if (ctx.onDryFire) ctx.onDryFire(); if (this.reserve > 0) this.reload(ctx); return false; }
      if (d.fireMode === 'burst') { this.burstLeft = (d.burstCount || 3) - 1; this.burstT = this.fireInterval; }
      this.doShot(ctx);
      if (d.fireMode === 'bolt' || d.fireMode === 'pump') { this.boltT = d.boltTime || 1; if (ctx.onBolt) ctx.onBolt(d.boltTime || 1); }
      this.cooldown = this.fireInterval;
      return true;
    }
    doShot(ctx) {
      const d = this.def; this.ammo--; this.sinceShot = 0;
      const idx = Math.min(this.pattern.length - 1, Math.floor(this.shotIdx)); const rec = this.pattern[idx]; this.shotIdx++;
      const sp = this.spread(ctx); const dirs = [];
      const n = d.pellets || 1;
      for (let i = 0; i < n; i++) {
        const r = Math.sqrt(Math.random()) * sp; const a = Math.random() * Math.PI * 2;
        dirs.push([Math.cos(a) * r, Math.sin(a) * r]); // degrees offset (yaw, pitch)
      }
      this.spreadAcc += d.spreadFire || 0.3;
      if (ctx.onShot) ctx.onShot(dirs, rec[0] * (ctx.recoilMul || 1), rec[1] * (ctx.recoilMul || 1));
      if (this.ammo <= 0 && d.reloadPerShell === undefined && this.reserve > 0 && ctx.autoReload) { /* auto reload handled by owner */ }
    }
  }
  S3.Weapon = Weapon;

  // ---------- Viewmodel (first person) ----------
  class Viewmodel {
    constructor(camera) {
      this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
      this.root = new THREE.Group(); this.scene.add(this.root);
      this.hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 0.9); this.scene.add(this.hemi);
      this.sun = new THREE.DirectionalLight(0xffffff, 1.2); this.sun.position.set(1, 2, 1); this.scene.add(this.sun);
      this.weaponGroup = new THREE.Group(); this.root.add(this.weaponGroup);
      this.model = null; this.weaponId = null; this.team = 'CT';
      // arms
      this.arms = new THREE.Group(); this.root.add(this.arms); this.buildArms('CT');
      this.bobT = 0; this.kick = 0; this.kickRot = 0; this.swayX = 0; this.swayY = 0; this.anim = null; this.animT = 0; this.animDur = 0; this.lower = 0; this.scoped = 0;
      this.basePos = new THREE.Vector3(0.2, -0.2, -0.42); this.baseRot = new THREE.Euler(0, 0, 0);
      this.muzzleWorld = new THREE.Vector3(); this.hidden = false;
    }
    buildArms(team) {
      while (this.arms.children.length) this.arms.remove(this.arms.children[0]);
      const sleeve = team === 'CT' ? 0x3a4a68 : 0x8a7a58; const skin = 0xd2a679;
      const mk = (x, rotY) => { const g = new THREE.Group(); const a = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.36), M(sleeve, { metalness: 0, roughness: 0.9 })); a.position.z = 0.16; g.add(a); const h = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.08), M(skin, { metalness: 0, roughness: 0.9 })); h.position.z = -0.03; g.add(h); g.position.set(x, -0.05, 0.02); g.rotation.y = rotY; return g; };
      this.armR = mk(0.02, -0.1); this.armL = mk(-0.16, 0.5); this.arms.add(this.armR); this.arms.add(this.armL);
      this.team = team;
    }
    setWeapon(id, team, skinId) {
      if (team && team !== this.team) this.buildArms(team);
      if (this.model) this.weaponGroup.remove(this.model);
      this.weaponId = id; this.skinId = skinId || null; const w = S3.WEAPONS[id]; this.model = S3.buildWeaponModel(w, 1, skinId); this.weaponGroup.add(this.model);
      // per-type placement
      const t = w.type;
      if (t === 'pistol') this.basePos.set(0.16, -0.19, -0.38); else if (t === 'knife') this.basePos.set(0.2, -0.2, -0.3); else if (t === 'grenade') this.basePos.set(0.18, -0.2, -0.32); else if (t === 'bomb') this.basePos.set(0.14, -0.22, -0.34);
      else if (t === 'sniper') this.basePos.set(0.17, -0.2, -0.36); else this.basePos.set(0.19, -0.21, -0.4);
      this.armL.visible = t !== 'pistol' && t !== 'knife' && t !== 'grenade';
      this.armL.position.set(t === 'sniper' || t === 'rifle' || t === 'mg' || t === 'shotgun' ? -0.12 : -0.14, -0.06, t === 'sniper' ? -0.1 : -0.05);
      this.play('draw', w.type === 'knife' ? 0.25 : 0.45);
    }
    play(name, dur) { this.anim = name; this.animT = 0; this.animDur = dur || 1; }
    onShot(strength) { this.kick = Math.min(1, this.kick + 0.6 * (strength || 1)); this.kickRot = Math.min(1, this.kickRot + 0.5 * (strength || 1)); }
    update(dt, ctx) {
      // ctx: {speedFrac, onGround, mouseDX, mouseDY, scoped, crouch}
      const w = S3.WEAPONS[this.weaponId] || {}; this.camera.aspect = ctx.aspect; this.camera.updateProjectionMatrix();
      this.bobT += dt * (ctx.speedFrac > 0.05 && ctx.onGround ? 9 : 2);
      const bobA = (ctx.speedFrac > 0.05 && ctx.onGround ? 1 : 0.15) * (ctx.crouch ? 0.5 : 1);
      const bx = Math.sin(this.bobT) * 0.012 * bobA, by = Math.abs(Math.cos(this.bobT)) * 0.01 * bobA - 0.005;
      this.swayX = S3.damp(this.swayX, -S3.clamp(ctx.mouseDX, -60, 60) * 0.0004, 10, dt); this.swayY = S3.damp(this.swayY, S3.clamp(ctx.mouseDY, -60, 60) * 0.0004, 10, dt);
      this.kick = S3.damp(this.kick, 0, 14, dt); this.kickRot = S3.damp(this.kickRot, 0, 9, dt);
      this.scoped = S3.damp(this.scoped, ctx.scoped ? 1 : 0, 14, dt);
      const g = this.weaponGroup;
      g.position.set(this.basePos.x + bx + this.swayX, this.basePos.y + by + this.swayY, this.basePos.z + this.kick * 0.06);
      g.rotation.set(-this.kickRot * 0.12 + this.swayY * 2, this.swayX * 3 + Math.sin(this.bobT * 0.5) * 0.004, this.kickRot * 0.04);
      // ADS/scope: move to center and down/out of view
      if (this.scoped > 0.01) { g.position.x = S3.lerp(g.position.x, 0, this.scoped); g.position.y = S3.lerp(g.position.y, -0.05, this.scoped); g.position.z = S3.lerp(g.position.z, -0.2, this.scoped); }
      // animations
      if (this.anim) {
        this.animT += dt; const t = Math.min(1, this.animT / this.animDur); const s = Math.sin(t * Math.PI);
        switch (this.anim) {
          case 'draw': g.position.y -= (1 - t) * 0.35; g.rotation.x -= (1 - t) * 0.8; g.rotation.z += (1 - t) * 0.3; break;
          case 'reload': g.position.y -= s * 0.1; g.rotation.x -= s * 0.5; g.rotation.z -= s * 0.35; g.position.x += Math.sin(t * Math.PI * 2) * 0.03; break;
          case 'reloadShell': g.rotation.x -= s * 0.25; g.position.y -= s * 0.03; break;
          case 'bolt': g.rotation.z -= s * 0.3; g.position.x += s * 0.05; g.position.y -= s * 0.03; break;
          case 'knife1': g.position.z -= s * 0.15; g.rotation.y += s * 1.0; g.position.x -= s * 0.15; break;
          case 'knife2': g.position.z -= s * 0.22; g.rotation.x -= s * 0.8; g.position.y += s * 0.05; break;
          case 'pin': g.position.x += Math.min(1, t * 2) * 0.05; g.rotation.z += Math.min(1, t * 2) * 0.4; g.position.y += Math.min(1, t * 2) * 0.03; break;
          case 'throw': g.position.z -= s * 0.3; g.rotation.x -= s * 1.6; g.position.y += s * 0.15; if (t > 0.5 && this.model) this.model.visible = false; break;
          case 'plant': g.position.y -= 0.25; g.rotation.x -= 0.9; g.position.x -= 0.05; g.position.y += Math.sin(this.animT * 12) * 0.01; break;
          case 'inspect': g.rotation.y += s * 1.4; g.rotation.z += s * 0.6; g.position.x -= s * 0.1; g.position.z += s * 0.05; break;
        }
        if (t >= 1 && this.anim !== 'plant') { this.anim = null; if (this.model) this.model.visible = true; }
      }
      // pin held pose
      if (ctx.pinPulled && !this.anim) { g.position.x += 0.05; g.rotation.z += 0.4; g.position.y += 0.03; }
      this.lower = S3.damp(this.lower, ctx.lower ? 1 : 0, 8, dt);
      if (this.lower > 0.01) { g.position.y -= this.lower * 0.15; g.rotation.x -= this.lower * 0.6; }
      // arms follow weapon
      this.arms.position.copy(g.position); this.arms.rotation.copy(g.rotation);
      this.root.visible = !this.hidden && this.scoped < 0.95;
      // muzzle world position (for effects) — computed in main camera space by caller using camera matrix
      if (this.model) { this.muzzleWorld.copy(this.model.userData.muzzle); this.model.localToWorld(this.muzzleWorld); }
    }
    setLighting(sunDir, sunColor, hemiSky, hemiGround) { this.sun.position.copy(sunDir); this.sun.color.copy(sunColor); this.hemi.color.copy(hemiSky); this.hemi.groundColor.copy(hemiGround); }
  }
  S3.Viewmodel = Viewmodel;
})();
