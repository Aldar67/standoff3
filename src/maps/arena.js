// ===== Standoff 3 — map: Arena (compact open arena for TDM / FFA / Arms Race) =====
'use strict';
(function () {
  const S3 = window.S3; S3.MAPS = S3.MAPS || {};
  S3.MAPS.arena = function () {
    const M = new S3.MapDef({ name: 'arena', title: 'Arena', bounds: [-32, -32, 32, 32], floor: 'dirt', wall: 'stone', wallH: 5, theme: { name: 'sunset' }, description: 'Небольшая арена с центральной площадкой. Для боёв с возрождением.', noDefuse: true });
    M.area(-30, -30, 30, 30, { floor: 'dirt' }); M.region('Арена', -30, -30, 30, 30);
    M.area(-30, -30, -14, -14, { floor: 'grass' }); M.area(14, 14, 30, 30, { floor: 'grass' }); M.area(-30, 14, -14, 30, { floor: 'cobble' }); M.area(14, -30, 30, -14, { floor: 'cobble' });
    // central platform
    M.area(-6, -6, 6, 6, { y: 1.5, floor: 'stone', wall: 'stone' }); M.region('Центр', -8, -8, 8, 8);
    M.ramp(-3, 6, 3, 12, { from: 1.5, to: 0, dir: 'z+', floor: 'stone' }); M.ramp(-3, -12, 3, -6, { from: 1.5, to: 0, dir: 'z-', floor: 'stone' });
    M.ramp(6, -3, 12, 3, { from: 1.5, to: 0, dir: 'x+', floor: 'stone' }); M.ramp(-12, -3, -6, 3, { from: 1.5, to: 0, dir: 'x-', floor: 'stone' });
    M.lowwall(-5.5, -5.5, -3, -5.5, { h: 1.0, y: 1.5, mat: 'stone' }); M.lowwall(3, 5.5, 5.5, 5.5, { h: 1.0, y: 1.5, mat: 'stone' });
    // cover walls and pillars
    M.solid(-22, -21, -14, -19, { h: 3 }); M.solid(14, 19, 22, 21, { h: 3 }); M.solid(-21, 14, -19, 22, { h: 3 }); M.solid(19, -22, 21, -14, { h: 3 });
    M.pillar(12, 12, { w: 1.4, h: 4 }); M.pillar(-12, -12, { w: 1.4, h: 4 }); M.pillar(-12, 12, { w: 1.4, h: 4 }); M.pillar(12, -12, { w: 1.4, h: 4 });
    M.crates(-26, 2, 4); M.crates(24, -4, 4); M.crate(0, 22, { size: 1.5, stack: 2 }); M.crate(0, -22, { size: 1.5, stack: 2 });
    M.barrels(-8, 24, 3); M.barrels(6, -25, 3); M.barrels(24, 8, 2); M.barrels(-25, -8, 2);
    M.sandbags(-16, 0, -10, 0); M.sandbags(10, 0, 16, 0); M.sandbags(0, -16, 0, -10); M.sandbags(0, 10, 0, 16);
    M.container(-18, 26, { dir: 'x', len: 6, mat: 'container_red' }); M.container(18, -26, { dir: 'x', len: 6, mat: 'container_blue' });
    M.tire(26, 24, { stack: 3 }); M.tire(-26, -24, { stack: 2 }); M.pallet(20, 26); M.pallet(-20, -26);
    M.lamp(0, 4.5, 0, { intensity: 4, dist: 14, color: 0xffd0a0 });
    // spawns (both teams on opposite sides + corners)
    M.spawnRow('CT', -10, -27, 10, -27, 5, 180); M.spawnRow('CT', -26, -12, -26, -4, 3, 90); M.spawnRow('CT', 26, -12, 26, -4, 2, -90);
    M.spawnRow('T', -10, 27, 10, 27, 5, 0); M.spawnRow('T', 26, 4, 26, 12, 3, -90); M.spawnRow('T', -26, 4, -26, 12, 2, 90);
    return M;
  };
})();
