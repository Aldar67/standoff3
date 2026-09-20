// ===== Standoff 3 — scenery: the world beyond the playable map (ground, skyline, props, clouds) =====
// Purely decorative: nothing here has collision, everything sits outside the map bounds so it is only
// ever seen over the walls / through gaps. Built per theme so each map gets its own backdrop.
'use strict';
(function () {
  const S3 = window.S3;
  const V3 = THREE.Vector3;

  function mat(name, color) { const m = S3.getMaterial(name); if (!color) return m; const c = m.clone(); c.color = new THREE.Color(color); return c; }
  function setUv(mesh, scale) {
    // world-sized tiling for box props so textures don't stretch (same idea as the map builder's 'world' uv)
    const g = mesh.geometry; if (!g.attributes.uv || !g.parameters) return;
    const p = g.parameters; const w = p.width || 1, h = p.height || 1, d = p.depth || 1; const uv = g.attributes.uv;
    // BoxGeometry face order: +x,-x,+y,-y,+z,-z ; 4 verts each
    const sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * sizes[f][0] / scale, uv.getY(i) * sizes[f][1] / scale); }
    uv.needsUpdate = true;
  }
  function box(group, w, h, d, m, x, y, z, ry, shadow) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); setUv(mesh, m.userData.scale || 3);
    mesh.position.set(x, y + h / 2, z); mesh.rotation.y = ry || 0; mesh.castShadow = !!shadow; mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  function cyl(group, r0, r1, h, m, x, y, z, seg) { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg || 10), m); mesh.position.set(x, y + h / 2, z); mesh.castShadow = true; group.add(mesh); return mesh; }
  const plainCache = {};
  function plain(color, rough) { const k = color + '|' + rough; if (!plainCache[k]) plainCache[k] = new THREE.MeshStandardMaterial({ color, roughness: rough !== undefined ? rough : 0.9, metalness: 0 }); return plainCache[k]; }

  function cloudTexture(rnd) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const ctx = c.getContext('2d');
    for (let i = 0; i < 26; i++) { const x = 40 + rnd() * 176, y = 40 + rnd() * 48, r = 18 + rnd() * 30; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 128); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  // Ring of positions around the map, between radius r0 and r1 from the map centre, that stay outside the bounds box.
  function ringSpots(b, n, r0, r1, rnd) {
    const cx = (b.xmin + b.xmax) / 2, cz = (b.zmin + b.zmax) / 2; const out = [];
    let tries = 0;
    while (out.length < n && tries++ < n * 20) {
      const a = rnd() * Math.PI * 2, r = r0 + rnd() * (r1 - r0); const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (x > b.xmin - 6 && x < b.xmax + 6 && z > b.zmin - 6 && z < b.zmax + 6) continue;
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 7)) continue;
      out.push({ x, z, a });
    }
    return out;
  }

  const BUILDERS = {
    desert(g, b, y0, rnd, near) {
      const wall = mat('sandwall'), stone = mat('sandstone'), plaster = mat('plaster', 0xe8dcc0), dome = plain(0x6a8aa8, 0.5), palmT = plain(0x6a4a2a), palmL = plain(0x3f7a3a, 0.8);
      // low-rise town blocks just past the walls
      for (const s of ringSpots(b, 34, near, near + 45, rnd)) {
        const w = 6 + rnd() * 10, d = 6 + rnd() * 10, h = 4 + rnd() * 7; const m = [wall, stone, plaster][Math.floor(rnd() * 3)];
        box(g, w, h, d, m, s.x, y0, s.z, rnd() * 0.5, true);
        if (rnd() < 0.3) { const dm = new THREE.Mesh(new THREE.SphereGeometry(Math.min(w, d) * 0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), dome); dm.position.set(s.x, y0 + h, s.z); g.add(dm); }
        else if (rnd() < 0.4) box(g, 1.2, 1 + rnd() * 2, 1.2, wall, s.x + w * 0.3, y0 + h, s.z + d * 0.3);
      }
      // minarets / towers
      for (const s of ringSpots(b, 3, near + 10, near + 50, rnd)) { cyl(g, 1.4, 1.8, 16 + rnd() * 8, plaster, s.x, y0, s.z, 10); const cap = new THREE.Mesh(new THREE.ConeGeometry(2, 3, 10), dome); cap.position.set(s.x, y0 + 18 + 4, s.z); g.add(cap); }
      // palms
      for (const s of ringSpots(b, 24, near - 2, near + 30, rnd)) { const h = 5 + rnd() * 4; cyl(g, 0.18, 0.28, h, palmT, s.x, y0, s.z, 6); for (let k = 0; k < 6; k++) { const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.2, 4), palmL); leaf.position.set(s.x, y0 + h + 0.3, s.z); leaf.rotation.set(Math.PI / 2 + 0.6, 0, k * Math.PI / 3); leaf.rotateOnAxis(new V3(1, 0, 0), -0.4); g.add(leaf); } }
      // dunes & mountains on the horizon
      for (const s of ringSpots(b, 18, near + 60, near + 150, rnd)) { const r = 30 + rnd() * 50; const dn = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), plain(0xc9b184, 1)); dn.scale.y = 0.18 + rnd() * 0.15; dn.position.set(s.x, y0 - 0.5, s.z); g.add(dn); }
      for (const s of ringSpots(b, 8, near + 90, near + 170, rnd)) { const mt = new THREE.Mesh(new THREE.ConeGeometry(40 + rnd() * 40, 25 + rnd() * 30, 7), plain(0x9a8262, 1)); mt.position.set(s.x, y0, s.z); mt.position.y += mt.geometry.parameters.height / 2 - 1; g.add(mt); }
    },
    industrial(g, b, y0, rnd, near) {
      const metal = mat('roofmetal'), rust = mat('rust'), conc = mat('concrete'), dark = plain(0x2a2c30, 0.7), red = plain(0xb03a2a, 0.6), yellow = plain(0xd0a020, 0.6);
      // warehouses
      for (const s of ringSpots(b, 16, near, near + 50, rnd)) { const w = 14 + rnd() * 18, d = 10 + rnd() * 12, h = 6 + rnd() * 4; box(g, w, h, d, [conc, rust][Math.floor(rnd() * 2)], s.x, y0, s.z, rnd() * 0.4, true); const roof = box(g, w + 0.6, 0.5, d + 0.6, metal, s.x, y0 + h, s.z, 0); roof.rotation.y = 0; }
      // chimneys with smoke plumes
      for (const s of ringSpots(b, 5, near + 20, near + 70, rnd)) { const h = 24 + rnd() * 16; cyl(g, 1.6, 2.4, h, conc, s.x, y0, s.z, 12); cyl(g, 1.7, 1.7, 1.2, red, s.x, y0 + h - 4, s.z, 12); for (let k = 0; k < 5; k++) { const sm = new THREE.Mesh(new THREE.SphereGeometry(2 + k * 1.3, 8, 6), new THREE.MeshStandardMaterial({ color: 0xb8bcc0, transparent: true, opacity: 0.35 - k * 0.05, roughness: 1 })); sm.position.set(s.x + k * 2.5 + rnd(), y0 + h + 2 + k * 3, s.z + k * 1.5); g.add(sm); } }
      // cranes
      for (const s of ringSpots(b, 3, near + 15, near + 60, rnd)) { const h = 22 + rnd() * 8; box(g, 1.6, h, 1.6, yellow, s.x, y0, s.z, 0, true); box(g, 30, 1.2, 1.4, yellow, s.x + 8, y0 + h, s.z, s.a); box(g, 8, 1.2, 1.4, yellow, s.x - 5, y0 + h, s.z, s.a); cyl(g, 0.08, 0.08, h * 0.6, dark, s.x + 14, y0 + h * 0.4, s.z, 4); }
      // tanks, poles, stacked containers
      for (const s of ringSpots(b, 8, near, near + 45, rnd)) cyl(g, 4 + rnd() * 3, 4 + rnd() * 3, 5 + rnd() * 4, [rust, conc][Math.floor(rnd() * 2)], s.x, y0, s.z, 16);
      for (const s of ringSpots(b, 14, near - 3, near + 40, rnd)) { const cm = mat(['container_red', 'container_blue', 'container_green', 'container_grey'][Math.floor(rnd() * 4)]); const n = 1 + Math.floor(rnd() * 3); for (let k = 0; k < n; k++) box(g, 12, 2.6, 2.5, cm, s.x, y0 + k * 2.6, s.z, s.a + Math.PI / 2, true); }
      for (const s of ringSpots(b, 20, near - 3, near + 60, rnd)) { cyl(g, 0.15, 0.2, 9, dark, s.x, y0, s.z, 6); box(g, 2.4, 0.15, 0.15, dark, s.x, y0 + 8.2, s.z, s.a); }
      for (const s of ringSpots(b, 6, near + 90, near + 170, rnd)) { const mt = new THREE.Mesh(new THREE.ConeGeometry(50 + rnd() * 40, 22 + rnd() * 20, 6), plain(0x4e565e, 1)); mt.position.set(s.x, y0 + mt.geometry.parameters.height / 2 - 2, s.z); g.add(mt); }
    },
    urban(g, b, y0, rnd, near) {
      const brick = mat('brick'), red = mat('redbrick'), plaster = mat('plaster'), roofM = plain(0x7a3a2a, 0.9), roofG = plain(0x4a5560, 0.8), treeT = plain(0x5a3a22), treeL = plain(0x3a7a34, 0.9), glass = plain(0x9ab8d0, 0.2);
      // houses with pitched roofs
      for (const s of ringSpots(b, 30, near, near + 55, rnd)) {
        const w = 7 + rnd() * 8, d = 6 + rnd() * 6, h = 4 + rnd() * 5; const m = [brick, red, plaster][Math.floor(rnd() * 3)];
        box(g, w, h, d, m, s.x, y0, s.z, s.a, true);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 3 + rnd() * 2, 4), rnd() < 0.5 ? roofM : roofG); roof.position.set(s.x, y0 + h + 1.5 + rnd(), s.z); roof.rotation.y = s.a + Math.PI / 4; g.add(roof);
        for (let k = 0; k < 3; k++) { const win = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.3), glass); win.position.set(s.x + Math.cos(s.a) * (-w / 2 + 1.5 + k * 2.2) + Math.sin(s.a) * (d / 2 + 0.02), y0 + 2.2, s.z - Math.sin(s.a) * (-w / 2 + 1.5 + k * 2.2) + Math.cos(s.a) * (d / 2 + 0.02)); win.rotation.y = s.a; g.add(win); }
      }
      // church tower + apartment blocks
      for (const s of ringSpots(b, 2, near + 20, near + 60, rnd)) { box(g, 6, 22, 6, plaster, s.x, y0, s.z, 0, true); const spire = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 4), roofG); spire.position.set(s.x, y0 + 26.5, s.z); spire.rotation.y = Math.PI / 4; g.add(spire); }
      for (const s of ringSpots(b, 6, near + 40, near + 90, rnd)) box(g, 16 + rnd() * 10, 14 + rnd() * 12, 12, [brick, plaster][Math.floor(rnd() * 2)], s.x, y0, s.z, s.a, true);
      // trees
      for (const s of ringSpots(b, 40, near - 4, near + 70, rnd)) { const h = 2.5 + rnd() * 2; cyl(g, 0.2, 0.3, h, treeT, s.x, y0, s.z, 6); const cr = new THREE.Mesh(new THREE.SphereGeometry(1.6 + rnd() * 1.4, 8, 6), treeL); cr.position.set(s.x, y0 + h + 1.2, s.z); cr.scale.y = 1.2; g.add(cr); }
      // hills
      for (const s of ringSpots(b, 12, near + 80, near + 170, rnd)) { const hl = new THREE.Mesh(new THREE.SphereGeometry(40 + rnd() * 50, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), plain(0x5f7d4a, 1)); hl.scale.y = 0.25 + rnd() * 0.2; hl.position.set(s.x, y0 - 0.5, s.z); g.add(hl); }
    },
    sunset(g, b, y0, rnd, near) {
      const stone = mat('stone'), rock = plain(0x6a5a52, 1), dark = plain(0x2a2226, 0.8), lamp = new THREE.MeshStandardMaterial({ color: 0xffd080, emissive: 0xffb050, emissiveIntensity: 1.2 });
      // rocky outcrops and boulders
      for (const s of ringSpots(b, 30, near - 2, near + 50, rnd)) { const r = 1.5 + rnd() * 4; const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rock); rk.position.set(s.x, y0 + r * 0.5, s.z); rk.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); rk.castShadow = true; g.add(rk); }
      // ruined walls / columns
      for (const s of ringSpots(b, 14, near, near + 40, rnd)) { box(g, 4 + rnd() * 6, 2 + rnd() * 3, 1, stone, s.x, y0, s.z, s.a, true); if (rnd() < 0.5) cyl(g, 0.6, 0.7, 3 + rnd() * 3, stone, s.x + 2, y0, s.z + 1, 8); }
      // arena lamp masts (lit) around the outside
      for (const s of ringSpots(b, 10, near - 1, near + 12, rnd)) { cyl(g, 0.15, 0.25, 11, dark, s.x, y0, s.z, 6); const l = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.6), lamp); l.position.set(s.x, y0 + 11, s.z); l.lookAt((b.xmin + b.xmax) / 2, y0 + 11, (b.zmin + b.zmax) / 2); g.add(l); }
      // mountain range
      for (const s of ringSpots(b, 16, near + 50, near + 160, rnd)) { const mt = new THREE.Mesh(new THREE.ConeGeometry(30 + rnd() * 45, 30 + rnd() * 45, 6), plain(0x4e3c50, 1)); mt.position.set(s.x, y0 + mt.geometry.parameters.height / 2 - 2, s.z); mt.rotation.y = rnd() * 2; g.add(mt); }
    },
  };
  const GROUND = { desert: 'sand', industrial: 'asphalt', urban: 'grass', sunset: 'dirt' };

  S3.buildScenery = function (scene, def, themeName, bounds, floorY) {
    const g = new THREE.Group(); g.name = 'scenery';
    const rnd = S3.seededRandom(def.name.length * 977 + 13);
    const b = bounds; const y0 = (floorY !== undefined ? floorY : 0) - 0.02;
    const cx = (b.xmin + b.xmax) / 2, cz = (b.zmin + b.zmax) / 2;
    // endless ground so the horizon isn't a hard edge
    const gm = mat(GROUND[themeName] || 'dirt'); const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 1, 1), gm);
    const uv = ground.geometry.attributes.uv; const sc = 1400 / (gm.userData.scale || 4); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sc, uv.getY(i) * sc); uv.needsUpdate = true;
    ground.rotation.x = -Math.PI / 2; ground.position.set(cx, y0 - 0.15, cz); ground.receiveShadow = true; g.add(ground);
    const near = Math.max(b.xmax - b.xmin, b.zmax - b.zmin) * 0.5 + 12;
    (BUILDERS[themeName] || BUILDERS.desert)(g, b, y0, rnd, near);
    // clouds: a few soft billboards high up
    const ct = cloudTexture(rnd);
    for (let i = 0; i < 9; i++) { const cm = new THREE.MeshBasicMaterial({ map: ct, transparent: true, opacity: 0.55 + rnd() * 0.3, depthWrite: false, fog: false }); const cl = new THREE.Mesh(new THREE.PlaneGeometry(90 + rnd() * 80, 45 + rnd() * 40), cm); const a = rnd() * Math.PI * 2, r = 120 + rnd() * 220; cl.position.set(cx + Math.cos(a) * r, 95 + rnd() * 60, cz + Math.sin(a) * r); cl.rotation.x = -Math.PI / 2 + 0.25; cl.rotation.z = rnd() * 6; g.add(cl); }
    // hundreds of little props -> one mesh per material (clouds/smoke stay separate: transparent)
    const merged = S3.mergeStaticGroup(g); merged.name = 'scenery';
    scene.add(merged); return merged;
  };
})();
