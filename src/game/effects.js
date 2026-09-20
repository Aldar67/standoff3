// ===== Standoff 3 — effects: particles, tracers, decals, grenades, smoke, explosions, pickups =====
'use strict';
(function () {
  const S3 = window.S3;
  const MAXP = 3000;

  function softCircleTexture(size, hard) {
    const c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(hard ? 0.5 : 0.2, 'rgba(255,255,255,' + (hard ? 1 : 0.7) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); return t;
  }
  function bulletHoleTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(10,10,10,1)'); g.addColorStop(0.35, 'rgba(20,20,20,0.9)'); g.addColorStop(0.6, 'rgba(40,40,40,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 12; i++) { const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 14; ctx.strokeStyle = 'rgba(20,20,20,0.5)'; ctx.lineWidth = 1 + Math.random(); ctx.beginPath(); ctx.moveTo(32, 32); ctx.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); ctx.stroke(); }
    return new THREE.CanvasTexture(c);
  }

  class Effects {
    constructor(game) {
      this.game = game; const scene = game.scene; this.scene = scene;
      // --- particles ---
      this.pPos = new Float32Array(MAXP * 3); this.pCol = new Float32Array(MAXP * 3); this.pSize = new Float32Array(MAXP); this.pAlpha = new Float32Array(MAXP);
      this.parts = []; for (let i = 0; i < MAXP; i++) this.parts.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, grow: 0, r: 1, g: 1, b: 1, a: 1, grav: 0, drag: 0, fade: 1, add: false });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3)); geo.setAttribute('size', new THREE.BufferAttribute(this.pSize, 1)); geo.setAttribute('alpha', new THREE.BufferAttribute(this.pAlpha, 1));
      const tex = softCircleTexture(64, false);
      const mkMat = (blending) => new THREE.ShaderMaterial({
        uniforms: { map: { value: tex }, scaleF: { value: 800 } }, transparent: true, depthWrite: false, blending,
        vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC; uniform float scaleF;
          void main(){ vA=alpha; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize = size*scaleF/max(1.0,-mv.z); gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `uniform sampler2D map; varying float vA; varying vec3 vC; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC, t.a*vA); }`,
      });
      this.pMatNormal = mkMat(THREE.NormalBlending); this.pMatAdd = mkMat(THREE.AdditiveBlending);
      this.pointsN = new THREE.Points(geo, this.pMatNormal); this.pointsN.frustumCulled = false; scene.add(this.pointsN);
      // additive set
      this.aPos = new Float32Array(MAXP * 3); this.aCol = new Float32Array(MAXP * 3); this.aSize = new Float32Array(MAXP); this.aAlpha = new Float32Array(MAXP);
      const geoA = new THREE.BufferGeometry();
      geoA.setAttribute('position', new THREE.BufferAttribute(this.aPos, 3)); geoA.setAttribute('color', new THREE.BufferAttribute(this.aCol, 3)); geoA.setAttribute('size', new THREE.BufferAttribute(this.aSize, 1)); geoA.setAttribute('alpha', new THREE.BufferAttribute(this.aAlpha, 1));
      this.pointsA = new THREE.Points(geoA, this.pMatAdd); this.pointsA.frustumCulled = false; scene.add(this.pointsA);
      this.geoN = geo; this.geoA = geoA; this.pIdx = 0;
      // --- tracers ---
      this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
      this.tracers = []; for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1), this.tracerMat.clone()); m.visible = false; scene.add(m); this.tracers.push({ mesh: m, life: 0 }); } this.tracerIdx = 0;
      // --- decals ---
      this.decalMat = new THREE.MeshBasicMaterial({ map: bulletHoleTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      this.decals = []; for (let i = 0; i < 220; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), this.decalMat); m.visible = false; scene.add(m); this.decals.push(m); } this.decalIdx = 0;
      // --- muzzle flash sprites ---
      this.flashTex = softCircleTexture(64, true);
      this.flashes = []; for (let i = 0; i < 12; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, color: 0xffcc66, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.visible = false; scene.add(s); this.flashes.push({ s, life: 0 }); } this.flashIdx = 0;
      this.flashLight = new THREE.PointLight(0xffaa44, 0, 8, 2); scene.add(this.flashLight); this.flashLightT = 0;
      // --- explosion flash spheres ---
      this.explMat = new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
      this.expls = []; this.explLight = new THREE.PointLight(0xffa040, 0, 30, 2); scene.add(this.explLight); this.explLightT = 0;
      // --- shells ---
      this.shells = []; const shellGeo = new THREE.BoxGeometry(0.012, 0.012, 0.035); const shellMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.8, roughness: 0.3 });
      for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(shellGeo, shellMat); m.visible = false; scene.add(m); this.shells.push({ m, life: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, floor: 0 }); } this.shellIdx = 0;
      // --- grenades / pickups / fires ---
      this.grenades = []; this.pickups = []; this.fires = []; this.smokeClouds = []; this.bombMesh = null; this.bombLight = null;
      this.tmp = new THREE.Vector3(); this.tmp2 = new THREE.Vector3();
    }
    // ---------- particles ----------
    emit(o) {
      const p = this.parts[this.pIdx]; this.pIdx = (this.pIdx + 1) % MAXP;
      p.alive = true; p.x = o.x; p.y = o.y; p.z = o.z; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0; p.life = 0; p.max = o.life || 1; p.size = o.size || 0.1; p.grow = o.grow || 0;
      p.r = o.r === undefined ? 1 : o.r; p.g = o.g === undefined ? 1 : o.g; p.b = o.b === undefined ? 1 : o.b; p.a = o.a === undefined ? 1 : o.a; p.grav = o.grav || 0; p.drag = o.drag || 0; p.fade = o.fade || 1; p.add = !!o.add; p.bounce = o.bounce || 0;
    }
    burst(x, y, z, n, fn) { for (let i = 0; i < n; i++) this.emit(fn(i)); }
    updateParticles(dt) {
      let ni = 0, ai = 0; const world = this.game.world;
      for (let i = 0; i < MAXP; i++) {
        const p = this.parts[i]; if (!p.alive) continue;
        p.life += dt; if (p.life >= p.max) { p.alive = false; continue; }
        p.vy -= p.grav * dt; if (p.drag) { const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; p.vz *= d; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.bounce && p.vy < 0) { const fy = world.floorAt(p.x, p.z, p.y + 0.5); if (p.y < fy + 0.02) { p.y = fy + 0.02; p.vy = -p.vy * p.bounce; p.vx *= 0.6; p.vz *= 0.6; } }
        const t = p.life / p.max; const alpha = p.a * (p.fade === 1 ? (1 - t) : Math.min(1, (1 - t) * p.fade)); const size = p.size + p.grow * p.life;
        if (p.add) { this.aPos[ai * 3] = p.x; this.aPos[ai * 3 + 1] = p.y; this.aPos[ai * 3 + 2] = p.z; this.aCol[ai * 3] = p.r; this.aCol[ai * 3 + 1] = p.g; this.aCol[ai * 3 + 2] = p.b; this.aSize[ai] = size; this.aAlpha[ai] = alpha; ai++; }
        else { this.pPos[ni * 3] = p.x; this.pPos[ni * 3 + 1] = p.y; this.pPos[ni * 3 + 2] = p.z; this.pCol[ni * 3] = p.r; this.pCol[ni * 3 + 1] = p.g; this.pCol[ni * 3 + 2] = p.b; this.pSize[ni] = size; this.pAlpha[ni] = alpha; ni++; }
      }
      this.geoN.setDrawRange(0, ni); this.geoA.setDrawRange(0, ai);
      for (const g of [this.geoN, this.geoA]) { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true; g.attributes.alpha.needsUpdate = true; }
      const h = this.game.renderer.domElement.height; this.pMatNormal.uniforms.scaleF.value = h * 0.9; this.pMatAdd.uniforms.scaleF.value = h * 0.9;
    }
    // ---------- shots ----------
    tracer(from, to) {
      const t = this.tracers[this.tracerIdx]; this.tracerIdx = (this.tracerIdx + 1) % this.tracers.length;
      const d = from.distanceTo(to); if (d < 1.5) return; const m = t.mesh; m.visible = true; m.position.copy(from).add(to).multiplyScalar(0.5); m.lookAt(to); m.scale.set(1, 1, d); m.material.opacity = 0.7; t.life = 0.07;
    }
    muzzleFlash(pos, dir, big) {
      const f = this.flashes[this.flashIdx]; this.flashIdx = (this.flashIdx + 1) % this.flashes.length;
      f.s.visible = true; f.s.position.copy(pos).addScaledVector(dir, 0.08); const sc = (big ? 0.6 : 0.35) * (0.8 + Math.random() * 0.5); f.s.scale.set(sc, sc, 1); f.s.material.rotation = Math.random() * Math.PI * 2; f.life = 0.045;
      this.flashLight.position.copy(pos).addScaledVector(dir, 0.3); this.flashLight.intensity = big ? 6 : 3; this.flashLightT = 0.05;
      // sparks
      for (let i = 0; i < 3; i++) this.emit({ x: pos.x, y: pos.y, z: pos.z, vx: dir.x * 6 + (Math.random() - 0.5) * 3, vy: dir.y * 6 + (Math.random() - 0.5) * 3, vz: dir.z * 6 + (Math.random() - 0.5) * 3, life: 0.12, size: 0.05, r: 1, g: 0.8, b: 0.4, add: true, drag: 5 });
      this.emit({ x: pos.x + dir.x * 0.2, y: pos.y + dir.y * 0.2, z: pos.z + dir.z * 0.2, vx: dir.x * 1.5, vy: 0.6, vz: dir.z * 1.5, life: 0.5, size: 0.15, grow: 0.6, r: 0.7, g: 0.7, b: 0.7, a: 0.35, drag: 3 });
    }
    impact(x, y, z, nx, ny, nz, surface) {
      // decal
      const d = this.decals[this.decalIdx]; this.decalIdx = (this.decalIdx + 1) % this.decals.length;
      d.visible = true; d.position.set(x + nx * 0.006, y + ny * 0.006, z + nz * 0.006); this.tmp.set(x + nx, y + ny, z + nz); d.lookAt(this.tmp); d.rotation.z = Math.random() * Math.PI * 2; const s = 0.7 + Math.random() * 0.6; d.scale.set(s, s, s);
      // particles
      const metal = surface === 'metal'; const n = metal ? 8 : 10;
      const col = surface === 'sand' ? [0.85, 0.75, 0.55] : surface === 'wood' ? [0.6, 0.45, 0.3] : metal ? [1, 0.85, 0.5] : [0.7, 0.7, 0.68];
      for (let i = 0; i < n; i++) {
        const sp = metal ? 5 : 3; const vx = nx * sp + (Math.random() - 0.5) * sp, vy = ny * sp + (Math.random() - 0.3) * sp, vz = nz * sp + (Math.random() - 0.5) * sp;
        if (metal) this.emit({ x, y, z, vx, vy, vz, life: 0.25 + Math.random() * 0.2, size: 0.03, r: col[0], g: col[1], b: col[2], add: true, grav: 9, drag: 1 });
        else this.emit({ x, y, z, vx: vx * 0.5, vy: vy * 0.5, vz: vz * 0.5, life: 0.3 + Math.random() * 0.3, size: 0.04 + Math.random() * 0.03, r: col[0], g: col[1], b: col[2], grav: 6, drag: 2 });
      }
      this.emit({ x: x + nx * 0.1, y: y + ny * 0.1, z: z + nz * 0.1, vx: nx * 0.5, vy: 0.4, vz: nz * 0.5, life: 0.7, size: 0.15, grow: 0.5, r: col[0] * 0.9, g: col[1] * 0.9, b: col[2] * 0.9, a: 0.45, drag: 2 });
    }
    blood(x, y, z, dx, dy, dz) {
      for (let i = 0; i < 14; i++) { const sp = 1.5 + Math.random() * 2.5; this.emit({ x, y, z, vx: dx * sp + (Math.random() - 0.5) * 2, vy: dy * sp + Math.random() * 1.5, vz: dz * sp + (Math.random() - 0.5) * 2, life: 0.35 + Math.random() * 0.35, size: 0.05 + Math.random() * 0.06, r: 0.55, g: 0.02, b: 0.02, grav: 10, drag: 1.5 }); }
      this.emit({ x, y, z, vx: dx, vy: 0.3, vz: dz, life: 0.5, size: 0.25, grow: 0.5, r: 0.45, g: 0.02, b: 0.02, a: 0.5, drag: 3 });
    }
    shell(pos, right, up) {
      const s = this.shells[this.shellIdx]; this.shellIdx = (this.shellIdx + 1) % this.shells.length;
      s.m.visible = true; s.m.position.copy(pos); s.vx = right.x * (1.5 + Math.random()) + up.x * 2; s.vy = 2 + Math.random(); s.vz = right.z * (1.5 + Math.random()) + up.z * 2; s.life = 3; s.rx = Math.random() * 10; s.ry = Math.random() * 10;
      s.floor = this.game.world.floorAt(pos.x, pos.z, pos.y); s.bounced = false;
    }
    // ---------- explosions ----------
    explosion(x, y, z, big) {
      const sc = big ? 2.5 : 1;
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), this.explMat.clone()); sphere.position.set(x, y, z); sphere.scale.setScalar(0.3); this.scene.add(sphere); this.expls.push({ m: sphere, life: 0, max: 0.35 * sc, size: 3 * sc });
      this.explLight.position.set(x, y + 0.5, z); this.explLight.intensity = 40 * sc; this.explLightT = 0.3 * sc;
      // fireball particles
      for (let i = 0; i < 30 * sc; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2; const sp = (2 + Math.random() * 6) * sc; this.emit({ x, y: y + 0.3, z, vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp + 3, vz: Math.sin(a) * Math.cos(e) * sp, life: 0.4 + Math.random() * 0.5, size: 0.5 * sc, grow: 1.5 * sc, r: 1, g: 0.5 + Math.random() * 0.3, b: 0.1, add: true, drag: 2.5 }); }
      // smoke
      for (let i = 0; i < 40 * sc; i++) { const a = Math.random() * Math.PI * 2; const sp = (1 + Math.random() * 4) * sc; const g = 0.25 + Math.random() * 0.2; this.emit({ x, y: y + 0.5, z, vx: Math.cos(a) * sp, vy: 1.5 + Math.random() * 3, vz: Math.sin(a) * sp, life: 1.5 + Math.random() * 2.5 * sc, size: 0.6 * sc, grow: 1.2 * sc, r: g, g: g, b: g, a: 0.7, drag: 1.2, fade: 2 }); }
      // sparks / debris
      for (let i = 0; i < 40 * sc; i++) { const a = Math.random() * Math.PI * 2; const sp = (5 + Math.random() * 10) * sc; this.emit({ x, y: y + 0.3, z, vx: Math.cos(a) * sp, vy: 3 + Math.random() * 10, vz: Math.sin(a) * sp, life: 0.6 + Math.random() * 1, size: 0.05, r: 1, g: 0.7, b: 0.3, add: true, grav: 14, drag: 0.5, bounce: 0.4 }); }
      for (let i = 0; i < 25 * sc; i++) { const a = Math.random() * Math.PI * 2; const sp = (3 + Math.random() * 8) * sc; this.emit({ x, y: y + 0.3, z, vx: Math.cos(a) * sp, vy: 4 + Math.random() * 8, vz: Math.sin(a) * sp, life: 1 + Math.random() * 1.5, size: 0.06 + Math.random() * 0.06, r: 0.25, g: 0.22, b: 0.2, grav: 16, drag: 0.5, bounce: 0.3 }); }
      // ground scorch decal
      const d = this.decals[this.decalIdx]; this.decalIdx = (this.decalIdx + 1) % this.decals.length; const fy = this.game.world.floorAt(x, z, y + 0.5);
      d.visible = true; d.position.set(x, fy + 0.01, z); d.rotation.set(-Math.PI / 2, 0, Math.random() * 6); d.scale.setScalar(25 * sc);
    }
    flashEffect(x, y, z) {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })); sphere.position.set(x, y, z); this.scene.add(sphere); this.expls.push({ m: sphere, life: 0, max: 0.25, size: 2.5 });
      this.explLight.position.set(x, y, z); this.explLight.color.set(0xffffff); this.explLight.intensity = 60; this.explLightT = 0.2;
      for (let i = 0; i < 20; i++) { const a = Math.random() * Math.PI * 2; const sp = 1 + Math.random() * 3; this.emit({ x, y, z, vx: Math.cos(a) * sp, vy: 1 + Math.random() * 2, vz: Math.sin(a) * sp, life: 1.5, size: 0.4, grow: 0.8, r: 0.8, g: 0.8, b: 0.8, a: 0.5, drag: 1.5, fade: 2 }); }
    }
    smokeCloud(x, y, z, radius, duration) {
      const cloud = { x, y, z, r: radius, life: 0, max: duration, parts: [] }; this.smokeClouds.push(cloud);
      this.game.world.smokes.push(cloud);
      S3.Audio.smokePop(new THREE.Vector3(x, y, z));
      // dense long-lived particles
      for (let i = 0; i < 90; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2; const rr = Math.random() * radius * 0.7; const g = 0.62 + Math.random() * 0.18; this.emit({ x: x + Math.cos(a) * Math.cos(e) * rr, y: y + 0.4 + Math.abs(Math.sin(e)) * rr * 0.8, z: z + Math.sin(a) * Math.cos(e) * rr, vx: Math.cos(a) * 0.6, vy: 0.08, vz: Math.sin(a) * 0.6, life: duration - Math.random() * 3, size: 1.2, grow: 0.9, r: g, g: g, b: g, a: 0.9, drag: 1.5, fade: 3 }); }
    }
    fireArea(x, y, z, radius, duration, owner) { this.fires.push({ x, y, z, r: radius, life: 0, max: duration, owner, tickT: 0, emitT: 0 }); }
    // ---------- grenades ----------
    spawnGrenade(owner, weaponId, pos, vel) {
      const w = S3.WEAPONS[weaponId]; const mesh = S3.buildWeaponModel(w, 1); mesh.position.copy(pos); this.scene.add(mesh);
      const g = { owner, id: weaponId, def: w, mesh, pos: pos.clone(), vel: vel.clone(), fuse: w.fuse, life: 0, spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10), bounces: 0, rest: false };
      this.grenades.push(g); return g;
    }
    updateGrenades(dt) {
      const world = this.game.world; const G = 18;
      for (let i = this.grenades.length - 1; i >= 0; i--) {
        const g = this.grenades[i]; g.life += dt;
        if (!g.rest) {
          g.vel.y -= G * dt; const step = this.tmp.copy(g.vel).multiplyScalar(dt); const len = step.length();
          if (len > 1e-5) {
            const dir = this.tmp2.copy(step).divideScalar(len); const hit = world.raycast(g.pos.x, g.pos.y, g.pos.z, dir.x, dir.y, dir.z, len + 0.08);
            if (hit) {
              g.pos.set(hit.x + hit.nx * 0.09, hit.y + hit.ny * 0.09, hit.z + hit.nz * 0.09);
              const vn = g.vel.x * hit.nx + g.vel.y * hit.ny + g.vel.z * hit.nz; g.vel.x -= (1 + 0.45) * vn * hit.nx; g.vel.y -= (1 + 0.45) * vn * hit.ny; g.vel.z -= (1 + 0.45) * vn * hit.nz; g.vel.multiplyScalar(0.75);
              g.bounces++; if (Math.abs(vn) > 1.5) S3.Audio.grenadeBounce(g.pos);
              if (hit.ny > 0.5 && g.vel.length() < 1.2) { g.rest = true; g.vel.set(0, 0, 0); g.pos.y = hit.y + 0.06; }
            } else g.pos.add(step);
          }
          g.mesh.position.copy(g.pos); g.mesh.rotation.x += g.spin.x * dt; g.mesh.rotation.y += g.spin.y * dt;
        }
        if (g.id === 'molotov' && (g.bounces > 0 || g.rest)) { this.detonate(g); this.grenades.splice(i, 1); continue; }
        if (g.life >= g.fuse) { this.detonate(g); this.grenades.splice(i, 1); }
      }
    }
    detonate(g) {
      this.scene.remove(g.mesh); const p = g.pos; const game = this.game;
      if (g.id === 'he') { this.explosion(p.x, p.y, p.z, false); S3.Audio.explosion(p); game.explosionDamage(g.owner, p, g.def.radius, g.def.damage, 'he'); game.shake(p, 12, 0.5); }
      else if (g.id === 'flash') { this.flashEffect(p.x, p.y, p.z); S3.Audio.flashbang(p); game.flashActors(g.owner, p, g.def.radius); }
      else if (g.id === 'smoke') { this.smokeCloud(p.x, p.y, p.z, g.def.radius, g.def.duration); }
      else if (g.id === 'molotov') { const fy = game.world.floorAt(p.x, p.z, p.y + 0.3); this.fireArea(p.x, fy, p.z, g.def.radius, g.def.duration, g.owner); S3.Audio.explosion(p, false); this.explosion(p.x, fy, p.z, false); }
      game.emitNoiseAt(p, 60, g.owner);
      if (game.net && game.net.role === 'host') game.net.sendNadeEnd(g);
    }
    updateFires(dt) {
      for (let i = this.fires.length - 1; i >= 0; i--) {
        const f = this.fires[i]; f.life += dt; if (f.life > f.max) { this.fires.splice(i, 1); continue; }
        f.emitT -= dt; const inten = f.life < f.max - 2 ? 1 : (f.max - f.life) / 2;
        while (f.emitT <= 0) { f.emitT += 0.02; const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * f.r * Math.min(1, f.life * 2); this.emit({ x: f.x + Math.cos(a) * r, y: f.y + 0.1, z: f.z + Math.sin(a) * r, vx: (Math.random() - 0.5) * 0.5, vy: 1.2 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 0.5, life: 0.5 + Math.random() * 0.5, size: 0.35 * inten, grow: 0.4, r: 1, g: 0.35 + Math.random() * 0.4, b: 0.05, add: true, drag: 1 }); if (Math.random() < 0.3) this.emit({ x: f.x + Math.cos(a) * r, y: f.y + 0.6, z: f.z + Math.sin(a) * r, vx: 0, vy: 1.5, vz: 0, life: 1.5, size: 0.4, grow: 0.8, r: 0.15, g: 0.15, b: 0.15, a: 0.5, drag: 1, fade: 2 }); }
        f.tickT -= dt; if (f.tickT <= 0) { f.tickT = 0.25; for (const a of this.game.actors) { if (!a.alive) continue; if (Math.hypot(a.pos.x - f.x, a.pos.z - f.z) < f.r && Math.abs(a.pos.y - f.y) < 1.5) { a.takeDamage(7, f.owner, 'body', 'molotov', 0, 0, { ignoreArmor: true, grenade: true }); a.burnT = 0.5; } } }
        if (f.life < 0.2 && i === this.fires.length - 1) { /* light */ }
      }
    }
    // ---------- pickups ----------
    spawnPickup(weapon, pos, vel, isBomb) {
      const mesh = S3.buildWeaponModel(weapon.def, 1, weapon.skin); mesh.position.copy(pos); this.scene.add(mesh);
      const p = { weapon, mesh, pos: pos.clone(), vel: vel ? vel.clone() : new THREE.Vector3(), rest: false, life: 0, isBomb: !!isBomb, spin: Math.random() * 6 }; this.pickups.push(p); return p;
    }
    updatePickups(dt) {
      const world = this.game.world;
      for (const p of this.pickups) {
        p.life += dt; if (p.rest) { if (p.isBomb) { p.mesh.rotation.y += dt; } continue; }
        p.vel.y -= 18 * dt; const step = this.tmp.copy(p.vel).multiplyScalar(dt); const len = step.length();
        if (len > 1e-5) { const dir = this.tmp2.copy(step).divideScalar(len); const hit = world.raycast(p.pos.x, p.pos.y, p.pos.z, dir.x, dir.y, dir.z, len + 0.05); if (hit) { if (hit.ny > 0.5) { p.rest = true; p.pos.set(hit.x, hit.y + 0.03, hit.z); p.mesh.rotation.set(Math.PI / 2, 0, p.spin); } else { p.vel.x *= -0.3; p.vel.z *= -0.3; } } else p.pos.add(step); }
        p.mesh.position.copy(p.pos); if (!p.rest) { p.mesh.rotation.x += dt * 6; }
        if (p.life > 8 && !p.rest) { p.rest = true; }
      }
    }
    removePickup(p) { const i = this.pickups.indexOf(p); if (i >= 0) { this.pickups.splice(i, 1); this.scene.remove(p.mesh); } }
    clearPickups() { for (const p of this.pickups) this.scene.remove(p.mesh); this.pickups.length = 0; }
    // ---------- bomb ----------
    placeBomb(pos) {
      this.removeBomb(); const m = S3.buildWeaponModel(S3.WEAPONS.bomb, 1.3); m.position.copy(pos); m.position.y += 0.03; m.rotation.y = Math.random() * 6; this.scene.add(m); this.bombMesh = m;
      const l = new THREE.PointLight(0xff2020, 0, 6, 2); l.position.copy(pos); l.position.y += 0.3; this.scene.add(l); this.bombLight = l;
    }
    removeBomb() { if (this.bombMesh) { this.scene.remove(this.bombMesh); this.bombMesh = null; } if (this.bombLight) { this.scene.remove(this.bombLight); this.bombLight = null; } }
    setBombBlink(on) { if (this.bombLight) this.bombLight.intensity = on ? 4 : 0; }
    // ---------- clear ----------
    clearAll() {
      for (const p of this.parts) p.alive = false; for (const t of this.tracers) { t.life = 0; t.mesh.visible = false; } for (const d of this.decals) d.visible = false;
      for (const g of this.grenades) this.scene.remove(g.mesh); this.grenades.length = 0; this.fires.length = 0;
      for (const e of this.expls) this.scene.remove(e.m); this.expls.length = 0; this.smokeClouds.length = 0; this.game.world.smokes.length = 0;
      this.clearPickups(); this.removeBomb(); for (const s of this.shells) s.m.visible = false;
    }
    update(dt) {
      this.updateParticles(dt); this.updateGrenades(dt); this.updateFires(dt); this.updatePickups(dt);
      for (const t of this.tracers) { if (t.life > 0) { t.life -= dt; t.mesh.material.opacity = Math.max(0, t.life / 0.07) * 0.7; if (t.life <= 0) t.mesh.visible = false; } }
      for (const f of this.flashes) { if (f.life > 0) { f.life -= dt; if (f.life <= 0) f.s.visible = false; } }
      if (this.flashLightT > 0) { this.flashLightT -= dt; if (this.flashLightT <= 0) this.flashLight.intensity = 0; }
      if (this.explLightT > 0) { this.explLightT -= dt; this.explLight.intensity *= Math.max(0, 1 - dt * 6); if (this.explLightT <= 0) { this.explLight.intensity = 0; this.explLight.color.set(0xffa040); } }
      for (let i = this.expls.length - 1; i >= 0; i--) { const e = this.expls[i]; e.life += dt; const t = e.life / e.max; if (t >= 1) { this.scene.remove(e.m); this.expls.splice(i, 1); continue; } e.m.scale.setScalar(0.3 + e.size * Math.pow(t, 0.5)); e.m.material.opacity = (1 - t) * 0.9; }
      for (const s of this.shells) { if (s.life > 0) { s.life -= dt; s.vy -= 14 * dt; s.m.position.x += s.vx * dt; s.m.position.y += s.vy * dt; s.m.position.z += s.vz * dt; s.m.rotation.x += s.rx * dt; s.m.rotation.y += s.ry * dt; if (s.m.position.y < s.floor + 0.01) { s.m.position.y = s.floor + 0.01; if (!s.bounced) { s.vy = -s.vy * 0.3; s.vx *= 0.5; s.vz *= 0.5; s.bounced = true; S3.Audio.shellDrop(s.m.position); } else { s.vy = 0; s.vx = 0; s.vz = 0; s.rx = 0; s.ry = 0; } } if (s.life <= 0) s.m.visible = false; } }
      for (let i = this.smokeClouds.length - 1; i >= 0; i--) { const c = this.smokeClouds[i]; c.life += dt; if (c.life > c.max - 2) { c.r = Math.max(0.1, c.r - dt * 2); } if (c.life > c.max) { this.smokeClouds.splice(i, 1); const wi = this.game.world.smokes.indexOf(c); if (wi >= 0) this.game.world.smokes.splice(wi, 1); } }
      if (this.bombMesh) { /* blink handled by mode */ }
    }
  }
  S3.Effects = Effects;
})();
