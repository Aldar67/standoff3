// ===== Standoff 3 — map: Province (old-town streets, two courtyard bomb sites, flanking shops) =====
'use strict';
(function () {
  const S3 = window.S3; S3.MAPS = S3.MAPS || {};
  S3.MAPS.province = function () {
    const M = new S3.MapDef({ name: 'province', title: 'Province', bounds: [-50, -50, 50, 50], floor: 'cobble', wall: 'brick', wallH: 7, theme: { name: 'urban' }, description: 'Улочки старого города: главная улица, два двора с точками и магазины для обходов.' });
    // spawns
    M.area(-14, 34, 14, 48, { floor: 'asphalt', wall: 'plaster' }); M.region('T-спавн', -14, 34, 14, 48);
    M.spawnRow('T', -10, 45, 10, 45, 6, 0); M.spawnRow('T', -8, 41, 8, 41, 4, 0);
    M.area(-14, -48, 14, -34, { floor: 'asphalt', wall: 'plaster' }); M.region('CT-спавн', -14, -48, 14, -34);
    M.spawnRow('CT', -10, -45, 10, -45, 6, 180); M.spawnRow('CT', -8, -41, 8, -41, 4, 180);
    M.block(-12, 36, -8, 40, { h: 1.4, mat: 'dark', surface: 'metal' }); M.block(8, -40, 12, -36, { h: 1.4, mat: 'dark', surface: 'metal' });
    M.barrels(11, 37, 2); M.crate(-11, -37, { size: 1.2 });
    // streets
    M.area(-6, -35, 6, 35, { floor: 'asphalt' }); M.region('Главная улица', -6, -28, 6, 28);
    M.area(30, -35, 38, 35, { floor: 'asphalt' }); M.region('Восточная улица', 30, -28, 38, 28);
    M.area(-38, -35, -30, 35, { floor: 'asphalt' }); M.region('Западная улица', -38, -28, -30, 28);
    M.area(-38, -35, 38, -28, { floor: 'cobble' }); M.region('Северный переулок', -30, -35, 30, -28);
    M.area(-38, 28, 38, 35, { floor: 'cobble' }); M.region('Южный переулок', -30, 28, 30, 35);
    M.area(-38, -3, 38, 3, { floor: 'cobble' }); M.region('Центр', -30, -3, 30, 3);
    M.block(-1.5, -1.5, 1.5, 1.5, { h: 1.3, mat: 'stone' }); // fountain base
    M.mesh((() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.2, 12), S3.getMaterial('stone')); m.position.set(0, 1.9, 0); m.castShadow = true; return m; })());
    // street props
    M.block(2, 14, 4, 18.5, { h: 1.4, mat: 'dark', surface: 'metal' }); M.block(-4, -20, -2, -15.5, { h: 1.4, mat: 'dark', surface: 'metal' });
    M.crate(34, 20, { size: 1.2, stack: 2 }); M.barrels(31, -20, 3); M.crate(-34, -22, { size: 1.3 }); M.barrels(-36, 18, 2);
    M.block(33, -10, 37, -6, { h: 1.4, mat: 'dark', surface: 'metal' }); M.block(-37, 6, -33, 10, { h: 1.4, mat: 'dark', surface: 'metal' });
    M.pillar(20, -31.5, { w: 0.8, h: 7 }); M.pillar(-20, 31.5, { w: 0.8, h: 7 });
    // A courtyard (east, raised 0.5)
    M.area(12, -22, 30, -6, { y: 0.5, floor: 'tiles', wall: 'plaster', wallH: 6 }); M.site('A', 14, -20, 29, -8); M.region('Двор A', 12, -22, 30, -6);
    M.ramp(6, -16, 12, -10, { from: 0, to: 0.5, dir: 'x+', floor: 'tiles', wall: 'plaster' });
    M.ramp(18, -28, 24, -22, { from: 0, to: 0.5, dir: 'z+', floor: 'tiles', wall: 'plaster' });
    M.solid(29, -22, 30, -18, { h: 6, mat: 'plaster' }); M.solid(29, -14, 30, -6, { h: 6, mat: 'plaster' }); M.ramp(28, -18, 30, -14, { from: 0.5, to: 0, dir: 'x+', floor: 'tiles', wall: 'plaster' });
    M.crates(20, -14, 4); M.sandbags(14, -12, 18, -12); M.barrels(27, -20, 2); M.lowwall(24, -9, 28, -9, { h: 1.0, mat: 'plaster' }); M.pillar(15, -20, { w: 0.7, h: 6, mat: 'plaster' });
    M.sign(21, 4.4, -21.7, 'A', { yaw: 0, w: 2, h: 1 });
    // B courtyard (west)
    M.area(-30, 6, -12, 22, { floor: 'tiles', wall: 'plaster', wallH: 6 }); M.site('B', -29, 8, -14, 20); M.region('Двор B', -30, 6, -12, 22);
    M.area(-12, 10, -6, 14, { floor: 'tiles', wall: 'plaster' }); M.area(-24, 22, -18, 28, { floor: 'tiles', wall: 'plaster' });
    M.solid(-30, 6, -29, 14, { h: 6, mat: 'plaster' }); M.solid(-30, 18, -29, 22, { h: 6, mat: 'plaster' });
    M.crates(-24, 10, 3); M.crate(-16, 18, { size: 1.5 }); M.crate(-16, 18, { size: 1.5, y: 1.5 }); M.barrels(-27, 19, 3); M.sandbags(-22, 20, -18, 20); M.pillar(-27, 8, { w: 0.7, h: 6, mat: 'plaster' }); M.lowwall(-14, 8, -14, 12, { h: 1.0, mat: 'plaster' });
    M.sign(-21, 4.4, 21.7, 'B', { yaw: 180, w: 2, h: 1 });
    // shop 1 (east flank between center and south)
    M.area(12, 8, 24, 20, { floor: 'wood', wall: 'plaster', wallH: 4 }); M.roof(12, 8, 24, 20, 4, { mat: 'plaster', thick: 0.5 }); M.region('Магазин', 12, 8, 24, 20);
    M.area(6, 12, 12, 16, { floor: 'wood', wall: 'plaster', wallH: 4 }); M.area(24, 12, 30, 16, { floor: 'wood', wall: 'plaster', wallH: 4 });
    M.block(14, 9, 22, 10.5, { h: 1.1, mat: 'wood', surface: 'wood' }); M.crate(21, 17, { size: 1 }); M.lamp(18, 3.6, 14, { intensity: 6, dist: 12 });
    // shop 2 (west flank between center and north)
    M.area(-24, -20, -12, -8, { floor: 'wood', wall: 'plaster', wallH: 4 }); M.roof(-24, -20, -12, -8, 4, { mat: 'plaster', thick: 0.5 }); M.region('Кафе', -24, -20, -12, -8);
    M.area(-12, -16, -6, -12, { floor: 'wood', wall: 'plaster', wallH: 4 }); M.area(-30, -16, -24, -12, { floor: 'wood', wall: 'plaster', wallH: 4 });
    M.block(-22, -19, -14, -17.5, { h: 1.1, mat: 'wood', surface: 'wood' }); M.barrels(-15, -10, 2); M.lamp(-18, 3.6, -14, { intensity: 6, dist: 12 });
    return M;
  };
})();
