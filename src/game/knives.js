// ===== Standoff 3 — knife models: blades from 2D outlines (extruded), one builder per knife type =====
// Coordinate convention matches the other weapon models: forward (tip) = -Z, up = +Y, origin at the grip top.
// Blade meshes use color BLADE and handles use HANDLE so the skin system can re-material them
// (primary finish on the blade, secondary on the handle) exactly like it does for guns.
'use strict';
(function () {
  const S3 = window.S3;
  const BLADE = 0xc0c4c8, HANDLE = 0x1a1a1c, STEEL = 0x8a8c90, BRASS = 0x9a8250;
  const mcache = {};
  function M(color, opts) { const k = color + '|' + JSON.stringify(opts || {}); if (mcache[k]) return mcache[k]; mcache[k] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.35, metalness: 0.7 }, opts || {})); return mcache[k]; }
  const bladeM = () => M(BLADE, { metalness: 0.9, roughness: 0.22 });
  const handleM = () => M(HANDLE, { metalness: 0.2, roughness: 0.7 });

  // shape points are [u, v]: u along the blade (0 = guard, positive = toward the tip), v = width (up positive).
  // Extruded along the shape's z (= thickness), then rotated so u -> -Z, v -> +Y, thickness -> X.
  function extrude(points, thickness, material, opts) {
    const sh = new THREE.Shape(); sh.moveTo(points[0][0], points[0][1]); for (let i = 1; i < points.length; i++) sh.lineTo(points[i][0], points[i][1]); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, Object.assign({ depth: thickness, bevelEnabled: true, bevelThickness: thickness * 0.35, bevelSize: thickness * 0.35, bevelSegments: 2 }, opts || {}));
    g.translate(0, 0, -thickness / 2);
    // shape units are metres (~0.1-0.3), scale the UVs so a skin pattern tiles a few times along the blade
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 6);
    const m = new THREE.Mesh(g, material); m.rotation.y = Math.PI / 2; m.castShadow = true; return m;
  }
  function edgeBevel(root, mesh) { root.add(mesh); return mesh; }
  function box(root, w, h, d, m, x, y, z, rx) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (rx) b.rotation.x = rx; b.castShadow = true; root.add(b); return b; }
  function cyl(root, r0, r1, len, m, x, y, z, axis) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 12), m); if (axis === 'z') c.rotation.x = Math.PI / 2; if (axis === 'x') c.rotation.z = Math.PI / 2; c.position.set(x, y, z); c.castShadow = true; root.add(c); return c; }
  // a grip: rounded-ish handle behind the guard (u negative), slightly angled down like a real grip
  function grip(root, len, h, w, m, drop) {
    const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, len), m); b.position.z = len / 2; b.castShadow = true; g.add(b);
    const rings = 3; for (let i = 0; i < rings; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(w * 1.12, h * 0.92, 0.008), M(HANDLE, { metalness: 0.4, roughness: 0.5, color: 0x2e2e32 })); r.position.z = len * (0.25 + i * 0.25); g.add(r); }
    g.rotation.x = -(drop || 0.12); root.add(g); return g;
  }

  const K = {};
  // classic combat knife: clip point, small fuller, finger guard
  K.default = (root) => {
    const bl = extrude([[0, -0.012], [0.11, -0.014], [0.16, -0.004], [0.19, 0.012], [0.15, 0.016], [0.04, 0.018], [0, 0.017]], 0.0035, bladeM());
    root.add(bl);
    const fuller = box(root, 0.002, 0.004, 0.09, M(0x8a8e94, { metalness: 0.8, roughness: 0.3 }), 0.0022, 0.006, -0.08);
    box(root, 0.018, 0.045, 0.012, M(STEEL), 0, 0.002, 0.004); // guard
    grip(root, 0.115, 0.03, 0.02, handleM(), 0.14);
    box(root, 0.02, 0.026, 0.012, M(STEEL), 0, -0.014, 0.118, -0.14); // pommel
    return new THREE.Vector3(0, 0.01, -0.19);
  };
  // karambit: curved claw blade, safety ring at the end of the grip
  K.karambit = (root) => {
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([t * 0.13, -0.006 - Math.sin(t * Math.PI) * 0.03 - t * t * 0.055]); }
    for (let i = 12; i >= 0; i--) { const t = i / 12; pts.push([t * 0.13 - (t > 0.9 ? (t - 0.9) * 0.02 : 0), 0.012 - Math.sin(t * Math.PI) * 0.018 - t * t * 0.06]); }
    root.add(extrude(pts, 0.003, bladeM()));
    grip(root, 0.1, 0.028, 0.018, handleM(), 0.05);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 8, 20), M(STEEL, { metalness: 0.85, roughness: 0.3 })); ring.rotation.y = Math.PI / 2; ring.position.set(0, -0.006, 0.118); root.add(ring);
    return new THREE.Vector3(0, -0.07, -0.13);
  };
  // bayonet: long straight blade with a wide fuller and a cross guard
  K.bayonet = (root) => {
    root.add(extrude([[0, -0.013], [0.18, -0.013], [0.235, 0.002], [0.2, 0.014], [0, 0.014]], 0.0035, bladeM()));
    box(root, 0.0022, 0.005, 0.14, M(0x7a7e84, { metalness: 0.8, roughness: 0.3 }), 0.0022, 0.003, -0.1);
    box(root, 0.016, 0.06, 0.01, M(STEEL), 0, 0.0, 0.004); // cross guard
    grip(root, 0.12, 0.03, 0.022, handleM(), 0.06);
    cyl(root, 0.012, 0.012, 0.014, M(STEEL), 0, -0.004, 0.126, 'z');
    return new THREE.Vector3(0, 0.005, -0.235);
  };
  // butterfly (balisong): blade plus two split handles
  K.butterfly = (root) => {
    root.add(extrude([[0, -0.01], [0.12, -0.012], [0.16, 0.0], [0.13, 0.013], [0, 0.013]], 0.003, bladeM()));
    cyl(root, 0.006, 0.006, 0.02, M(STEEL), 0, 0, 0.004, 'x'); // pivot
    for (const side of [-1, 1]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.026, 0.115), handleM()); h.position.set(side * 0.006, -0.004, 0.062); h.rotation.x = -0.08; root.add(h); for (let i = 0; i < 4; i++) { const hole = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.008, 0.012), M(0x101012, { metalness: 0.1, roughness: 0.9 })); hole.position.set(side * 0.006, -0.004, 0.02 + i * 0.025); hole.rotation.x = -0.08; root.add(hole); } }
    return new THREE.Vector3(0, 0, -0.16);
  };
  // flip knife: slim swept blade, thin handle
  K.flip = (root) => {
    root.add(extrude([[0, -0.008], [0.1, -0.011], [0.15, 0.004], [0.16, 0.014], [0.1, 0.012], [0, 0.01]], 0.0028, bladeM()));
    box(root, 0.012, 0.028, 0.008, M(STEEL), 0, 0, 0.004);
    grip(root, 0.105, 0.024, 0.014, handleM(), 0.06);
    return new THREE.Vector3(0, 0.01, -0.16);
  };
  // bowie: big wide blade with a deep clip point and brass guard
  K.bowie = (root) => {
    root.add(extrude([[0, -0.018], [0.13, -0.02], [0.2, -0.006], [0.23, 0.014], [0.17, 0.026], [0.04, 0.026], [0, 0.024]], 0.004, bladeM()));
    box(root, 0.018, 0.055, 0.012, M(BRASS, { metalness: 0.9, roughness: 0.3 }), 0, 0.002, 0.004);
    grip(root, 0.12, 0.034, 0.024, M(0x4a3020, { metalness: 0.05, roughness: 0.8 }), 0.14);
    box(root, 0.024, 0.03, 0.012, M(BRASS, { metalness: 0.9, roughness: 0.3 }), 0, -0.016, 0.124, -0.14);
    return new THREE.Vector3(0, 0.012, -0.23);
  };
  // tanto: straight back, angled chisel tip
  K.tanto = (root) => {
    root.add(extrude([[0, -0.011], [0.12, -0.011], [0.17, 0.012], [0.12, 0.013], [0, 0.013]], 0.0035, bladeM()));
    box(root, 0.016, 0.04, 0.01, M(STEEL), 0, 0, 0.004);
    grip(root, 0.11, 0.028, 0.02, handleM(), 0.06);
    return new THREE.Vector3(0, 0.01, -0.17);
  };
  // kukri: forward-curved heavy blade
  K.kukri = (root) => {
    const pts = [[0, -0.01], [0.06, -0.016], [0.13, -0.045], [0.21, -0.03], [0.22, -0.012], [0.16, 0.0], [0.08, 0.008], [0, 0.012]];
    root.add(extrude(pts, 0.004, bladeM()));
    box(root, 0.016, 0.03, 0.01, M(BRASS, { metalness: 0.9, roughness: 0.3 }), 0, 0, 0.004);
    grip(root, 0.11, 0.03, 0.022, M(0x3a2a1c, { metalness: 0.05, roughness: 0.85 }), 0.16);
    return new THREE.Vector3(0, -0.02, -0.22);
  };
  // stiletto: needle-thin dagger with a slim symmetric blade
  K.stiletto = (root) => {
    root.add(extrude([[0, -0.007], [0.19, -0.001], [0.2, 0], [0.19, 0.001], [0, 0.007]], 0.004, bladeM()));
    box(root, 0.014, 0.036, 0.008, M(STEEL), 0, 0, 0.004);
    cyl(root, 0.009, 0.011, 0.11, handleM(), 0, -0.004, 0.06, 'z');
    cyl(root, 0.012, 0.012, 0.01, M(STEEL), 0, -0.006, 0.118, 'z');
    return new THREE.Vector3(0, 0, -0.2);
  };
  S3.KNIFE_TYPES = {
    default: { name: 'Штык-нож', rarity: 'common' }, flip: { name: 'Флип-нож', rarity: 'rare' }, tanto: { name: 'Танто', rarity: 'rare' }, stiletto: { name: 'Стилет', rarity: 'rare' },
    bayonet: { name: 'Байонет', rarity: 'epic' }, bowie: { name: 'Боуи', rarity: 'epic' }, kukri: { name: 'Кукри', rarity: 'epic' },
    karambit: { name: 'Керамбит', rarity: 'legendary' }, butterfly: { name: 'Бабочка', rarity: 'legendary' },
  };
  // builds the knife into `root`, returns the tip position (used as the "muzzle" for knife effects)
  S3.buildKnifeModel = function (root, type) { return (K[type] || K.default)(root); };
})();
