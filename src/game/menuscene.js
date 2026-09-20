// ===== Standoff 3 — main-menu 3D backdrop: your character with the equipped weapons on a slice of Sandstone =====
'use strict';
(function () {
  const S3 = window.S3;
  const V3 = THREE.Vector3;

  const MS = S3.MenuScene = {
    running: false, renderer: null, scene: null, camera: null, model: null, key: '', t: 0, lastT: 0, weaponIdx: 0, weaponT: 0, cfg: null,
    init(canvas) {
      if (this.renderer) return;
      const S = S3.Settings.data;
      const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
      this.renderer = r; this.scene = new THREE.Scene(); this.scene.fog = new THREE.Fog(0xd9e4ee, 30, 120);
      this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 300);
      // lighting: warm late-afternoon sun from the side, soft sky fill
      const sun = new THREE.DirectionalLight(0xfff0d8, 2.4); sun.position.set(6, 9, -5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -14; sun.shadow.camera.right = 14; sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14; sun.shadow.camera.near = 1; sun.shadow.camera.far = 40; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
      this.scene.add(sun); this.scene.add(new THREE.HemisphereLight(0x9ec8ff, 0xb59a6a, 0.9));
      const rim = new THREE.DirectionalLight(0xa0c0ff, 0.8); rim.position.set(-5, 4, 6); this.scene.add(rim);
      this.buildSky(new V3(6, 9, -5).normalize()); this.buildSet();
      this.stage = new THREE.Group(); this.scene.add(this.stage);
      window.addEventListener('resize', () => this.resize());
      this.resize();
    },
    buildSky(sd) {
      const geo = new THREE.SphereGeometry(200, 24, 12);
      const mat = new THREE.ShaderMaterial({
        uniforms: { top: { value: new THREE.Color(0x2a6fd6) }, horizon: { value: new THREE.Color(0xcfe3f5) }, sunDir: { value: sd.clone() }, sunColor: { value: new THREE.Color(0xfff1d6) } },
        vertexShader: 'varying vec3 vW; void main(){ vW = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; varying vec3 vW;
          void main(){ vec3 d = normalize(vW); float h = clamp(d.y, -0.1, 1.0); vec3 c = mix(horizon, top, pow(max(h,0.0), 0.55)); float s = max(dot(d, normalize(sunDir)), 0.0); c += sunColor * (pow(s, 600.0) * 1.5 + pow(s, 12.0) * 0.25); if (d.y < 0.0) c = mix(horizon, horizon*0.6, clamp(-d.y*6.0,0.0,1.0)); gl_FragColor = vec4(c, 1.0); }`,
        side: THREE.BackSide, depthWrite: false, fog: false,
      });
      const sky = new THREE.Mesh(geo, mat); sky.frustumCulled = false; this.scene.add(sky);
    },
    // a corner of a Sandstone street: ground, two walls with an archway, crates, barrels, a palm and distant town blocks
    buildSet() {
      const g = new THREE.Group(); const mat = (n) => S3.getMaterial(n);
      const box = (w, h, d, m, x, y, z, ry) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); const uv = b.geometry.attributes.uv; const sc = m.userData.scale || 3; const sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * sizes[f][0] / sc, uv.getY(i) * sizes[f][1] / sc); } uv.needsUpdate = true; b.position.set(x, y + h / 2, z); b.rotation.y = ry || 0; b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), mat('sand')); { const uv = ground.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 40, uv.getY(i) * 40); uv.needsUpdate = true; }
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
      const tiles = box(8, 0.06, 10, mat('tiles'), 0.5, -0.03, 0, 0); tiles.receiveShadow = true; // paved patch under the character
      box(22, 5, 0.8, mat('sandwall'), 1, 0, 9.5, 0);             // back wall
      box(0.8, 5, 20, mat('sandwall'), -9.5, 0, 0, 0);            // left wall
      box(3, 4, 0.8, mat('plaster'), 8.5, 0, 9.5, 0);             // plaster section
      box(1.2, 5.6, 1.2, mat('sandstone'), 4.2, 0, 9.4, 0); box(1.2, 5.6, 1.2, mat('sandstone'), 9.2, 0, 9.4, 0); box(6.2, 0.9, 1.2, mat('sandstone'), 6.7, 4.7, 9.4, 0); // archway pillars + lintel
      box(1.2, 1.2, 1.2, mat('crate'), -5.5, 0, 5.2, 0.3); box(1.2, 1.2, 1.2, mat('crate'), -4.3, 0, 5.6, -0.2); box(1.2, 1.2, 1.2, mat('crate'), -4.9, 1.2, 5.4, 0.1);
      box(2.4, 1.1, 0.8, mat('sandbag'), 5.5, 0, 4.5, -0.35); box(2.4, 0.9, 0.8, mat('sandbag'), 5.9, 1.1, 4.6, -0.35);
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 14), mat(['barrel', 'barrel_red', 'barrel_blue'][i])); b.position.set(-7.8 + i * 0.95, 0.6, 1 + (i % 2) * 0.4); b.castShadow = true; b.receiveShadow = true; g.add(b); }
      // palm + distant town silhouettes
      const palmT = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 7, 6), new THREE.MeshStandardMaterial({ color: 0x6a4a2a })); palmT.position.set(11.5, 3.5, 6.5); palmT.castShadow = true; g.add(palmT);
      for (let k = 0; k < 6; k++) { const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.4, 4), new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 0.8 })); leaf.position.set(11.5, 7.3, 6.5); leaf.rotation.set(Math.PI / 2 + 0.6, 0, k * Math.PI / 3); leaf.rotateOnAxis(new V3(1, 0, 0), -0.4); leaf.castShadow = true; g.add(leaf); }
      const rnd = S3.seededRandom(4242);
      for (let i = 0; i < 26; i++) { const a = -0.3 + rnd() * 2.2, r = 26 + rnd() * 40; const w = 5 + rnd() * 8, h = 4 + rnd() * 9; box(w, h, 5 + rnd() * 6, [mat('sandwall'), mat('sandstone'), mat('plaster')][Math.floor(rnd() * 3)], Math.cos(a) * r, 0, Math.sin(a) * r + 10, rnd()); }
      const dome = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6a8aa8, roughness: 0.5 })); dome.position.set(-20, 8, 34); g.add(dome);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 18, 10), mat('plaster')); tower.position.set(18, 9, 40); g.add(tower);
      this.scene.add(S3.mergeStaticGroup(g));
    },
    // (re)builds the character for the given team / weapons / skins; cheap no-op when nothing changed
    refresh(cfg) {
      if (!this.renderer) return; this.cfg = cfg;
      const key = JSON.stringify(cfg); if (key === this.key) return; this.key = key;
      if (this.model) this.stage.remove(this.model.root);
      this.model = new S3.CharacterModel(cfg.team, cfg.skinIdx || 0); this.model.root.position.set(0.9, 0, -0.2); this.model.root.rotation.y = 0.35; this.model.root.visible = true;
      this.stage.add(this.model.root); this.weaponIdx = 0; this.weaponT = 0; this.applyWeapon();
    },
    applyWeapon() {
      const list = (this.cfg.weapons || []).filter((w) => S3.WEAPONS[w]); if (!list.length) return;
      const id = list[this.weaponIdx % list.length]; this.model.setWeapon(id, (this.cfg.skins || {})[id] || null);
    },
    resize() { if (!this.renderer) return; const w = window.innerWidth, h = window.innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); },
    start() { if (this.running || !this.renderer) return; this.running = true; this.lastT = performance.now(); requestAnimationFrame((t) => this.loop(t)); },
    stop() { this.running = false; },
    loop(now) {
      if (!this.running) return; requestAnimationFrame((t) => this.loop(t));
      const dt = Math.min(0.05, (now - this.lastT) / 1000); this.lastT = now; this.t += dt;
      if (this.model) {
        // idle: breathing, slow look-around, weapon swap every few seconds
        this.weaponT += dt; if (this.weaponT > 7) { this.weaponT = 0; this.weaponIdx++; this.applyWeapon(); }
        const look = Math.sin(this.t * 0.35) * 0.35; const pitch = Math.sin(this.t * 0.5) * 0.08;
        this.model.update(dt, 0, 0, pitch, false, look); this.model.hips.position.y = 0.95 + Math.sin(this.t * 1.6) * 0.008;
        this.model.neck.rotation.y = look * 0.6;
      }
      // camera drifts gently around the character
      const a = 0.3 + Math.sin(this.t * 0.12) * 0.25; const cx = 0.6 + Math.sin(a) * 5.4, cz = -5.4 * Math.cos(a) - 0.2;
      this.camera.position.set(cx, 1.55 + Math.sin(this.t * 0.2) * 0.08, cz); this.camera.lookAt(1.0, 1.0, 0.2);
      this.renderer.render(this.scene, this.camera);
    },
  };
})();
