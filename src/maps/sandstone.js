// ===== Standoff 3 — map: Sandstone (desert town, two bomb sites; classic long/mid/tunnels layout) =====
'use strict';
(function () {
  const S3 = window.S3; S3.MAPS = S3.MAPS || {};
  S3.MAPS.sandstone = function () {
    const M = new S3.MapDef({ name: 'sandstone', title: 'Sandstone', bounds: [-60, -66, 60, 64], floor: 'sand', wall: 'sandwall', wallH: 5, theme: { name: 'desert' }, description: 'Пустынный городок. Три пути: длинная A, мид и тоннели на B.' });
    // ---- T spawn (south) ----
    M.area(-18, 40, 24, 62, { floor: 'sand' });
    M.region('T-спавн', -18, 40, 24, 62);
    M.spawnRow('T', -12, 58, 18, 58, 6, 0); M.spawnRow('T', -8, 54, 14, 54, 4, 0);
    M.crate(-10, 44, { size: 1.2 }); M.crate(-8.8, 44, { size: 1.2, stack: 2 }); M.barrels(16, 58, 3); M.lowwall(4, 47, 12, 47, { h: 1.0 });
    M.crate(20, 44, { size: 1.5 }); M.pallet(2, 60);
    // ---- mid ----
    M.area(-6, -36, 6, 41, { floor: 'sandstone' }); M.region('Мид', -6, -35, 6, 40);
    M.crate(0, 12, { size: 1.6 }); M.crate(0, 12, { size: 1.6, y: 1.6, mat: 'crate' }); // "xbox" double stack
    M.lowwall(-5.5, -22, -2, -22, { h: 1.1 }); M.lowwall(2, 2, 5.5, 2, { h: 1.1 });
    M.crate(4.5, -8, { size: 1 });
    // CT mid + doors
    M.area(-12, -46, 12, -35, { floor: 'sandstone' }); M.region('CT-мид', -12, -46, 12, -36);
    M.solid(-6, -38, -1.7, -36, { h: 5 }); M.solid(1.7, -38, 6, -36, { h: 5 });
    M.solid(-12, -38, -6, -36, { h: 5, mat: 'sandwall' }); M.solid(6, -38, 12, -36, { h: 5, mat: 'sandwall' });
    M.sandbags(-10, -42, -7, -42); M.crate(9, -40, { size: 1.2 });
    // ---- CT spawn (north) ----
    M.area(-16, -66, 16, -45, { floor: 'sand' }); M.region('CT-спавн', -16, -66, 16, -45);
    M.spawnRow('CT', -12, -62, 12, -62, 6, 180); M.spawnRow('CT', -8, -58, 8, -58, 4, 180);
    M.crate(-12, -50, { size: 1.2, stack: 2 }); M.barrels(12, -62, 2); M.lowwall(-4, -52, 4, -52, { h: 0.9 });
    // ---- CT -> A ramp ----
    M.ramp(14, -50, 28, -44, { from: 0, to: 1.5, dir: 'x+', floor: 'sandstone' }); M.region('CT-рампа', 14, -50, 28, -44);
    // ---- A site (elevated) ----
    M.area(26, -54, 56, -32, { y: 1.5, floor: 'sandstone', wall: 'plaster' }); M.site('A', 30, -52, 54, -34); M.region('Точка A', 26, -54, 56, -32);
    M.crate(40, -46, { size: 1.5 }); M.crate(41.5, -46, { size: 1.5 }); M.crate(40.75, -46, { size: 1.5, y: 3.0 }); M.crate(50, -38, { size: 1.2, stack: 2 });
    M.sandbags(31, -40, 37, -40); M.crate(34, -50, { size: 1 }); M.pillar(46, -36, { w: 0.8, h: 5 }); M.barrels(52, -50, 3);
    M.lowwall(44, -52, 50, -52, { h: 1.2, mat: 'plaster' });
    M.sign(41, 4.2, -53.7, 'A', { yaw: 0, w: 2.2, h: 1.1 });
    // long ramp up to A
    M.ramp(46, -32, 56, -26, { from: 0, to: 1.5, dir: 'z-', floor: 'sandstone' });
    // ---- long A ----
    M.area(46, -27, 56, 32, { floor: 'sand' }); M.region('Лонг', 46, -27, 56, 32);
    M.solid(46, 18, 48.6, 22, { h: 5 }); M.solid(53.4, 18, 56, 22, { h: 5 }); // long doors
    M.crate(48, 4, { size: 1.3 }); M.crate(54.5, -12, { size: 1.2, stack: 2 }); M.barrels(47, 26, 2); M.crate(54.5, 8, { size: 1 });
    M.lowwall(47, -20, 51, -20, { h: 1.0 });
    // outside long
    M.area(23, 30, 56, 44, { floor: 'sand' }); M.region('Выход на лонг', 23, 30, 45, 44);
    M.crate(30, 41, { size: 1.5, stack: 2 }); M.crate(38, 33, { size: 1.2 }); M.barrels(50, 41, 3);
    // ---- catwalk & short ----
    M.ramp(6, -16, 20, -10, { from: 0, to: 1.5, dir: 'x+', floor: 'sandstone' }); M.region('Катвок', 6, -16, 20, -10);
    M.area(20, -34, 28, -10, { y: 1.5, floor: 'sandstone', wall: 'plaster' }); M.region('Шорт', 20, -34, 28, -10);
    M.crate(26.5, -14, { size: 1.2 }); M.crate(21.5, -28, { size: 1 }); M.lowwall(20.5, -20, 24, -20, { h: 1.0, mat: 'plaster' });
    // ---- B connector (mid -> tunnels) ----
    M.area(-40, -10, -5, -4, { floor: 'cobble', wall: 'stone' }); M.region('Коннектор B', -40, -10, -6, -4);
    M.crate(-20, -8.9, { size: 1 }); M.barrels(-32, -5, 2);
    // ---- tunnels ----
    M.area(-45, -30, -39, 46, { floor: 'cobble', wall: 'stone', wallH: 3.4 }); M.roof(-45.5, -30, -38.5, 46, 3.4, { mat: 'stone', thick: 0.6 }); M.region('Тоннели', -45, -30, -39, 46);
    M.barrels(-44, 20, 2); M.crate(-40, -12, { size: 1 }); M.crate(-44, 34, { size: 1.1 });
    M.lamp(-42, 3.0, 30, { intensity: 5, dist: 12 }); M.lamp(-42, 3.0, 8, { intensity: 5, dist: 12 }); M.lamp(-42, 3.0, -16, { intensity: 5, dist: 12 });
    // outside tunnels
    M.area(-46, 44, -17, 52, { floor: 'sand' }); M.region('Выход из тоннелей', -46, 44, -17, 52);
    M.crate(-24, 50, { size: 1.3 }); M.barrels(-38, 46, 2);
    // ---- B site ----
    M.area(-54, -54, -30, -28, { floor: 'sandstone', wall: 'plaster' }); M.site('B', -52, -52, -32, -30); M.region('Точка B', -54, -54, -30, -28);
    M.crate(-47, -46, { size: 1.5 }); M.crate(-45.5, -46, { size: 1.5 }); M.crate(-46.25, -46, { size: 1.5, y: 1.5 });
    M.solid(-54, -40, -50, -36, { h: 5, mat: 'plaster' }); // closet block
    M.barrels(-35, -33, 3); M.lowwall(-44, -34, -38, -34, { h: 1.1, mat: 'plaster' }); M.crate(-33, -50, { size: 1.2, stack: 2 }); M.sandbags(-52, -32, -47, -32);
    M.pillar(-40, -42, { w: 0.8, h: 5 });
    M.sign(-42, 4.2, -53.7, 'B', { yaw: 0, w: 2.2, h: 1.1 });
    // ---- CT -> B corridor ----
    M.area(-34, -54, -15, -46, { floor: 'sand' }); M.region('CT-проход на B', -34, -54, -15, -46);
    M.crate(-24, -53, { size: 1.2 }); M.barrels(-18, -48, 2);
    return M;
  };
})();
