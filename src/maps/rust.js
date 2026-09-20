// ===== Standoff 3 — map: Rust (industrial container yard, warehouse A, dirt yard B) =====
'use strict';
(function () {
  const S3 = window.S3; S3.MAPS = S3.MAPS || {};
  S3.MAPS.rust = function () {
    const M = new S3.MapDef({ name: 'rust', title: 'Rust', bounds: [-40, -40, 40, 40], floor: 'asphalt', wall: 'metal', wallH: 5, theme: { name: 'industrial' }, description: 'Промзона: контейнерный двор, склад (A) и грязный двор (B). Компактная карта для быстрых боёв.' });
    // spawns
    M.area(-12, 26, 12, 38, { floor: 'concretefloor', wall: 'brick' }); M.region('T-спавн', -12, 26, 12, 38);
    M.spawnRow('T', -9, 35, 9, 35, 5, 0); M.spawnRow('T', -7, 31, 7, 31, 5, 0);
    M.area(-12, -38, 12, -26, { floor: 'concretefloor', wall: 'brick' }); M.region('CT-спавн', -12, -38, 12, -26);
    M.spawnRow('CT', -9, -35, 9, -35, 5, 180); M.spawnRow('CT', -7, -31, 7, -31, 5, 180);
    M.crate(-9, 28, { size: 1.2 }); M.barrels(9, 28, 2); M.crate(9, -28, { size: 1.2 }); M.barrels(-9, -28, 2);
    // yard
    M.area(-24, -22, 24, 22, { floor: 'asphalt' }); M.region('Двор', -24, -22, 24, 22);
    M.area(-8, 21, 8, 27); M.area(-8, -27, 8, -21);
    // central tower
    M.ramp(-3, 6, 3, 12, { from: 2, to: 0, dir: 'z+', floor: 'metal', wall: 'metal' });
    M.area(-6, -6, 6, 6, { y: 2, floor: 'metal', wall: 'rust' }); M.region('Вышка', -6, -6, 6, 6);
    M.ramp(-3, -12, 3, -6, { from: 2, to: 0, dir: 'z-', floor: 'metal', wall: 'metal' });
    M.lowwall(-5.5, -5.5, 5.5, -5.5, { h: 1.0, mat: 'metal', y: 2 }); M.lowwall(-5.5, 5.5, 5.5, 5.5, { h: 1.0, mat: 'metal', y: 2 });
    M.lowwall(-5.5, -3, -5.5, 3, { h: 1.0, mat: 'metal', y: 2 }); M.lowwall(5.5, -3, 5.5, 3, { h: 1.0, mat: 'metal', y: 2 });
    // containers
    M.container(-16, -13, { dir: 'x', mat: 'container_red' }); M.container(-16, -13, { dir: 'x', y: 2.6, mat: 'container_blue' });
    M.container(-16, 13, { dir: 'x', mat: 'container_green' });
    M.container(16, -13, { dir: 'x', mat: 'container_yellow' });
    M.container(16, 13, { dir: 'x', mat: 'container_grey' }); M.container(16, 13, { dir: 'x', y: 2.6, mat: 'container_red' });
    M.container(-13, 0, { dir: 'z', len: 5, mat: 'container_blue' }); M.container(13, 0, { dir: 'z', len: 5, mat: 'container_green' });
    M.container(-4, 17, { dir: 'x', len: 5, mat: 'container_grey' }); M.container(4, -17, { dir: 'x', len: 5, mat: 'container_yellow' });
    M.crates(-9, 8, 3); M.crates(7, -9, 3); M.barrels(-20, 0, 3); M.barrels(19, 3, 2); M.tire(-8, -14, { stack: 3 }); M.tire(9, 15, { stack: 2 }); M.pallet(-20, 18); M.pallet(20, -18);
    // A warehouse (east)
    M.area(24, -18, 38, 6, { floor: 'concretefloor', wall: 'rust', wallH: 6 }); M.roof(24, -18, 38, 6, 6, { mat: 'roofmetal', thick: 0.5 }); M.site('A', 26, -16, 37, 4); M.region('Склад A', 24, -18, 38, 6);
    M.solid(24, -18, 25, -12, { h: 6, mat: 'rust' }); M.solid(24, -8, 25, 0, { h: 6, mat: 'rust' }); M.solid(24, 4, 25, 6, { h: 6, mat: 'rust' });
    M.pillar(31, -6, { w: 0.6, h: 6, mat: 'metal' }); M.crates(33, -12, 4); M.crate(28, 2, { size: 1.2, stack: 2 }); M.block(35, -3, 37.5, 3, { h: 1.6, mat: 'metal' });
    M.lamp(31, 5.3, -12, { intensity: 8, dist: 16, color: 0xfff0d0 }); M.lamp(31, 5.3, 0, { intensity: 8, dist: 16, color: 0xfff0d0 });
    M.sign(31, 4.5, 5.7, 'A', { yaw: 180, w: 2, h: 1 });
    // A from CT side
    M.area(12, -33, 34, -27, { floor: 'concretefloor', wall: 'brick' }); M.area(26, -28, 34, -17, { floor: 'concretefloor', wall: 'rust' }); M.region('Проход CT-A', 12, -33, 34, -17);
    M.barrels(20, -31, 2); M.crate(29, -22, { size: 1 });
    // B yard (west)
    M.area(-38, -6, -24, 18, { floor: 'dirt', wall: 'brick' }); M.site('B', -37, -4, -26, 16); M.region('Двор B', -38, -6, -24, 18);
    M.solid(-25, -6, -24, -2, { h: 5, mat: 'brick' }); M.solid(-25, 2, -24, 8, { h: 5, mat: 'brick' }); M.solid(-25, 12, -24, 18, { h: 5, mat: 'brick' });
    M.crates(-34, 4, 4); M.block(-37, 10, -33, 16, { h: 1.4, mat: 'dark', surface: 'metal' }); M.barrels(-28, 14, 3); M.pallet(-30, -3); M.tire(-35, -4, { stack: 2 }); M.sandbags(-30, 8, -26, 8);
    M.sign(-31, 4.5, -5.7, 'B', { yaw: 0, w: 2, h: 1 });
    // B from T side
    M.area(-34, 26, -12, 32, { floor: 'concretefloor', wall: 'brick' }); M.area(-34, 17, -26, 27, { floor: 'dirt', wall: 'brick' }); M.region('Проход T-B', -34, 17, -12, 32);
    M.crate(-20, 30, { size: 1.2 }); M.barrels(-31, 22, 2);
    // east lane
    M.area(12, 26, 38, 32, { floor: 'concretefloor', wall: 'brick' }); M.area(30, 5, 38, 27, { floor: 'asphalt', wall: 'brick' }); M.region('Восточный проезд', 12, 5, 38, 32);
    M.crate(34, 12, { size: 1.3, stack: 2 }); M.barrels(32, 22, 2); M.tire(36, 18, { stack: 3 });
    // west lane
    M.area(-38, -32, -12, -26, { floor: 'concretefloor', wall: 'brick' }); M.area(-38, -27, -30, -5, { floor: 'asphalt', wall: 'brick' }); M.region('Западный проезд', -38, -32, -12, -5);
    M.crate(-34, -14, { size: 1.3 }); M.barrels(-32, -22, 3); M.pallet(-20, -29);
    M.lamp(0, 4.5, 24, { intensity: 4, dist: 10 }); M.lamp(0, 4.5, -24, { intensity: 4, dist: 10 });
    return M;
  };
})();
