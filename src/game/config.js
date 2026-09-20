// ===== Standoff 3 — game configuration: weapons, economy, bots, texts =====
'use strict';
(function () {
  const S3 = window.S3;
  S3.VERSION = '3.5.0';

  // --- Player physics ---
  S3.PHYS = {
    gravity: 22, jumpVel: 6.6, radius: 0.36, height: 1.8, crouchHeight: 1.25, eyeStand: 1.62, eyeCrouch: 1.08,
    stepHeight: 0.52, accelGround: 60, accelAir: 12, friction: 9, stopSpeed: 1.5, airSpeedCap: 1.2, maxFallDamageSpeed: 11,
  };

  // --- Weapons ---
  // spread values are degrees; recoil in degrees per shot
  const W = {};
  function def(id, o) { o.id = id; W[id] = o; return o; }

  def('knife', { name: 'Нож', slot: 'melee', type: 'knife', price: 0, killReward: 1500, damage: 42, damageAlt: 65, backstab: 180, rpm: 90, fireMode: 'semi', mag: 0, reserve: 0, reloadTime: 0, moveSpeed: 5.6, sound: 'knife', model: 'knife', range: 2.0 });

  // Pistols
  def('g22', { name: 'G22', slot: 'secondary', type: 'pistol', price: 200, killReward: 300, damage: 28, headMult: 4, armorPen: 0.47, rangeMod: 0.75, rpm: 400, fireMode: 'semi', mag: 20, reserve: 120, reloadTime: 2.2, spreadBase: 0.5, spreadMove: 1.2, spreadJump: 5, spreadFire: 0.7, spreadDecay: 6, recoilUp: 1.4, recoilSide: 0.5, recoilRecover: 9, moveSpeed: 5.4, sound: 'pistol', model: 'pistol', color: 0x222226 });
  def('usp', { name: 'USP', slot: 'secondary', type: 'pistol', price: 200, killReward: 300, damage: 35, headMult: 4, armorPen: 0.5, rangeMod: 0.8, rpm: 352, fireMode: 'semi', mag: 12, reserve: 24, reloadTime: 2.2, spreadBase: 0.4, spreadMove: 1.1, spreadJump: 5, spreadFire: 0.55, spreadDecay: 6, recoilUp: 1.6, recoilSide: 0.5, recoilRecover: 9, moveSpeed: 5.4, sound: 'silenced', model: 'pistol_s', color: 0x2a2c30 });
  def('p350', { name: 'P350', slot: 'secondary', type: 'pistol', price: 300, killReward: 300, damage: 38, headMult: 4, armorPen: 0.64, rangeMod: 0.78, rpm: 400, fireMode: 'semi', mag: 13, reserve: 26, reloadTime: 2.2, spreadBase: 0.5, spreadMove: 1.2, spreadJump: 5, spreadFire: 0.7, spreadDecay: 6, recoilUp: 1.8, recoilSide: 0.6, recoilRecover: 9, moveSpeed: 5.4, sound: 'pistol', model: 'pistol', color: 0x303236 });
  def('fn57', { name: 'FN57', slot: 'secondary', type: 'pistol', price: 500, killReward: 300, damage: 32, headMult: 4, armorPen: 0.91, rangeMod: 0.8, rpm: 400, fireMode: 'semi', mag: 20, reserve: 100, reloadTime: 2.2, spreadBase: 0.5, spreadMove: 1.2, spreadJump: 5, spreadFire: 0.6, spreadDecay: 6, recoilUp: 1.5, recoilSide: 0.5, recoilRecover: 9, moveSpeed: 5.4, sound: 'pistol', model: 'pistol', color: 0x3a3a3c });
  def('tec9', { name: 'TEC-9', slot: 'secondary', type: 'pistol', price: 500, killReward: 300, damage: 33, headMult: 4, armorPen: 0.9, rangeMod: 0.78, rpm: 500, fireMode: 'semi', mag: 18, reserve: 90, reloadTime: 2.4, spreadBase: 0.7, spreadMove: 1.6, spreadJump: 6, spreadFire: 0.9, spreadDecay: 6, recoilUp: 1.8, recoilSide: 0.8, recoilRecover: 9, moveSpeed: 5.4, sound: 'pistol', model: 'tec9', color: 0x2a2a2a });
  def('deagle', { name: 'Deagle', slot: 'secondary', type: 'pistol', price: 700, killReward: 300, damage: 63, headMult: 4, armorPen: 0.93, rangeMod: 0.81, rpm: 267, fireMode: 'semi', mag: 7, reserve: 35, reloadTime: 2.2, spreadBase: 0.6, spreadMove: 1.8, spreadJump: 7, spreadFire: 1.6, spreadDecay: 4.5, recoilUp: 4.5, recoilSide: 1.2, recoilRecover: 8, moveSpeed: 5.3, sound: 'pistol', model: 'deagle', color: 0x8a8a90 });

  // SMG
  def('mac10', { name: 'MAC-10', slot: 'primary', type: 'smg', price: 1050, killReward: 600, damage: 29, headMult: 4, armorPen: 0.57, rangeMod: 0.7, rpm: 800, fireMode: 'auto', mag: 30, reserve: 100, reloadTime: 2.6, spreadBase: 0.9, spreadMove: 0.6, spreadJump: 6, spreadFire: 0.35, spreadDecay: 7, recoilUp: 1.2, recoilSide: 0.7, recoilRecover: 12, moveSpeed: 5.5, sound: 'smg', model: 'smg', color: 0x2a2a2c });
  def('mp5', { name: 'MP5', slot: 'primary', type: 'smg', price: 1500, killReward: 600, damage: 27, headMult: 4, armorPen: 0.62, rangeMod: 0.75, rpm: 750, fireMode: 'auto', mag: 30, reserve: 120, reloadTime: 2.7, spreadBase: 0.6, spreadMove: 0.5, spreadJump: 5, spreadFire: 0.28, spreadDecay: 7, recoilUp: 1.0, recoilSide: 0.5, recoilRecover: 12, moveSpeed: 5.5, sound: 'smg', model: 'smg', color: 0x1f1f22 });
  def('mp7', { name: 'MP7', slot: 'primary', type: 'smg', price: 1500, killReward: 600, damage: 29, headMult: 4, armorPen: 0.62, rangeMod: 0.75, rpm: 750, fireMode: 'auto', mag: 30, reserve: 120, reloadTime: 3.0, spreadBase: 0.6, spreadMove: 0.5, spreadJump: 5, spreadFire: 0.3, spreadDecay: 7, recoilUp: 1.1, recoilSide: 0.5, recoilRecover: 12, moveSpeed: 5.4, sound: 'smg', model: 'smg', color: 0x2e2e30 });
  def('ump45', { name: 'UMP45', slot: 'primary', type: 'smg', price: 1200, killReward: 600, damage: 35, headMult: 4, armorPen: 0.65, rangeMod: 0.75, rpm: 670, fireMode: 'auto', mag: 25, reserve: 100, reloadTime: 3.2, spreadBase: 0.7, spreadMove: 0.6, spreadJump: 5, spreadFire: 0.32, spreadDecay: 7, recoilUp: 1.3, recoilSide: 0.6, recoilRecover: 12, moveSpeed: 5.4, sound: 'smg', model: 'smg', color: 0x26262a });
  def('p90', { name: 'P90', slot: 'primary', type: 'smg', price: 2350, killReward: 300, damage: 26, headMult: 4, armorPen: 0.69, rangeMod: 0.75, rpm: 857, fireMode: 'auto', mag: 50, reserve: 100, reloadTime: 3.3, spreadBase: 0.7, spreadMove: 0.45, spreadJump: 5, spreadFire: 0.25, spreadDecay: 8, recoilUp: 0.9, recoilSide: 0.6, recoilRecover: 13, moveSpeed: 5.4, sound: 'smg', model: 'p90', color: 0x3a3a30 });

  // Rifles
  def('famas', { name: 'FAMAS', slot: 'primary', type: 'rifle', price: 2050, killReward: 300, damage: 30, headMult: 4, armorPen: 0.7, rangeMod: 0.84, rpm: 666, fireMode: 'auto', mag: 25, reserve: 90, reloadTime: 3.3, spreadBase: 0.45, spreadMove: 2.2, spreadJump: 7, spreadFire: 0.28, spreadDecay: 6, recoilUp: 1.4, recoilSide: 0.6, recoilRecover: 10, moveSpeed: 5.0, sound: 'rifle', model: 'famas', color: 0x2c2c2c });
  def('m4', { name: 'M4', slot: 'primary', type: 'rifle', price: 3100, killReward: 300, damage: 33, headMult: 4, armorPen: 0.7, rangeMod: 0.97, rpm: 666, fireMode: 'auto', mag: 30, reserve: 90, reloadTime: 3.1, spreadBase: 0.35, spreadMove: 2.4, spreadJump: 7, spreadFire: 0.27, spreadDecay: 6, recoilUp: 1.5, recoilSide: 0.7, recoilRecover: 10, moveSpeed: 4.9, sound: 'rifle', model: 'm4', color: 0x222224 });
  def('akr', { name: 'AKR', slot: 'primary', type: 'rifle', price: 2700, killReward: 300, damage: 36, headMult: 4, armorPen: 0.775, rangeMod: 0.98, rpm: 600, fireMode: 'auto', mag: 30, reserve: 90, reloadTime: 2.5, spreadBase: 0.4, spreadMove: 2.6, spreadJump: 7, spreadFire: 0.32, spreadDecay: 6, recoilUp: 1.9, recoilSide: 0.9, recoilRecover: 9, moveSpeed: 4.8, sound: 'rifle', model: 'ak', color: 0x5a3c22 });
  def('akr12', { name: 'AKR12', slot: 'primary', type: 'rifle', price: 2900, killReward: 300, damage: 34, headMult: 4, armorPen: 0.75, rangeMod: 0.96, rpm: 650, fireMode: 'auto', mag: 30, reserve: 90, reloadTime: 2.7, spreadBase: 0.38, spreadMove: 2.5, spreadJump: 7, spreadFire: 0.3, spreadDecay: 6, recoilUp: 1.7, recoilSide: 0.8, recoilRecover: 9.5, moveSpeed: 4.8, sound: 'rifle', model: 'ak', color: 0x2a2a2a });
  def('m16', { name: 'M16', slot: 'primary', type: 'rifle', price: 2500, killReward: 300, damage: 34, headMult: 4, armorPen: 0.72, rangeMod: 0.96, rpm: 800, fireMode: 'burst', burstCount: 3, burstDelay: 0.32, mag: 30, reserve: 90, reloadTime: 3.0, spreadBase: 0.3, spreadMove: 2.4, spreadJump: 7, spreadFire: 0.25, spreadDecay: 7, recoilUp: 1.3, recoilSide: 0.5, recoilRecover: 11, moveSpeed: 4.9, sound: 'rifle', model: 'm4', color: 0x2a2c2a });
  def('aug', { name: 'AUG', slot: 'primary', type: 'rifle', price: 3300, killReward: 300, damage: 32, headMult: 4, armorPen: 0.9, rangeMod: 0.98, rpm: 600, fireMode: 'auto', mag: 30, reserve: 90, reloadTime: 3.8, spreadBase: 0.3, spreadMove: 2.2, spreadJump: 7, spreadFire: 0.26, spreadDecay: 6, recoilUp: 1.5, recoilSide: 0.6, recoilRecover: 10, moveSpeed: 4.8, sound: 'rifle', model: 'aug', color: 0x3a4a3a, zoom: [45] });
  def('g3sg1', { name: 'G3SG1', slot: 'primary', type: 'rifle', price: 5000, killReward: 300, damage: 80, headMult: 4, armorPen: 0.82, rangeMod: 0.98, rpm: 240, fireMode: 'semi', mag: 20, reserve: 90, reloadTime: 4.5, spreadBase: 0.25, spreadMove: 4, spreadJump: 8, spreadFire: 1.1, spreadDecay: 5, recoilUp: 3.2, recoilSide: 1.2, recoilRecover: 8, moveSpeed: 4.6, sound: 'rifle', model: 'g3', color: 0x2a2a2a, zoom: [40, 20], scope: true });

  // Snipers
  def('m40', { name: 'M40', slot: 'primary', type: 'sniper', price: 1700, killReward: 300, damage: 88, headMult: 4, armorPen: 0.85, rangeMod: 0.98, rpm: 48, fireMode: 'bolt', boltTime: 1.25, mag: 10, reserve: 90, reloadTime: 2.0, spreadBase: 0.25, spreadMove: 1.5, spreadJump: 4, spreadFire: 2, spreadDecay: 4, recoilUp: 4, recoilSide: 1, recoilRecover: 6, moveSpeed: 5.3, sound: 'sniper', model: 'scout', color: 0x3a3a2a, zoom: [40, 15], scope: true, noscopeSpread: 8 });
  def('awm', { name: 'AWM', slot: 'primary', type: 'sniper', price: 4750, killReward: 100, damage: 115, headMult: 4, armorPen: 0.97, rangeMod: 0.99, rpm: 41, fireMode: 'bolt', boltTime: 1.45, mag: 5, reserve: 30, reloadTime: 3.6, spreadBase: 0.2, spreadMove: 2.5, spreadJump: 5, spreadFire: 2, spreadDecay: 4, recoilUp: 5, recoilSide: 1.2, recoilRecover: 6, moveSpeed: 4.2, sound: 'sniper', model: 'awp', color: 0x3a4a30, zoom: [40, 12], scope: true, noscopeSpread: 9 });

  // Shotguns
  def('nova', { name: 'Nova', slot: 'primary', type: 'shotgun', price: 1050, killReward: 900, damage: 26, pellets: 9, headMult: 2.5, armorPen: 0.5, rangeMod: 0.45, rpm: 68, fireMode: 'pump', boltTime: 0.85, mag: 8, reserve: 32, reloadTime: 0.6, reloadPerShell: true, spreadBase: 3.5, spreadMove: 1, spreadJump: 3, spreadFire: 0.5, spreadDecay: 6, recoilUp: 4, recoilSide: 1.5, recoilRecover: 7, moveSpeed: 5.1, sound: 'shotgun', model: 'shotgun', color: 0x2a2a2a });
  def('m1014', { name: 'M1014', slot: 'primary', type: 'shotgun', price: 2000, killReward: 900, damage: 20, pellets: 6, headMult: 2.5, armorPen: 0.8, rangeMod: 0.5, rpm: 171, fireMode: 'semi', mag: 7, reserve: 32, reloadTime: 0.5, reloadPerShell: true, spreadBase: 3.5, spreadMove: 1, spreadJump: 3, spreadFire: 0.8, spreadDecay: 6, recoilUp: 3.5, recoilSide: 1.3, recoilRecover: 8, moveSpeed: 5.1, sound: 'shotgun', model: 'shotgun', color: 0x1e1e20 });

  // MG
  def('m249', { name: 'M249', slot: 'primary', type: 'mg', price: 5200, killReward: 300, damage: 32, headMult: 4, armorPen: 0.8, rangeMod: 0.97, rpm: 750, fireMode: 'auto', mag: 100, reserve: 200, reloadTime: 5.7, spreadBase: 0.7, spreadMove: 3, spreadJump: 8, spreadFire: 0.22, spreadDecay: 6, recoilUp: 1.6, recoilSide: 1.0, recoilRecover: 9, moveSpeed: 4.4, sound: 'mg', model: 'mg', color: 0x2c3a2c });

  // Grenades
  def('he', { name: 'Осколочная', slot: 'grenade', type: 'grenade', price: 300, killReward: 300, damage: 98, radius: 6.5, fuse: 1.6, moveSpeed: 5.5, model: 'he', color: 0x3a4a3a, max: 1 });
  def('flash', { name: 'Светошумовая', slot: 'grenade', type: 'grenade', price: 200, killReward: 300, damage: 0, radius: 18, fuse: 1.5, moveSpeed: 5.5, model: 'flash', color: 0x4a4a52, max: 2 });
  def('smoke', { name: 'Дымовая', slot: 'grenade', type: 'grenade', price: 300, killReward: 300, damage: 0, radius: 4.5, fuse: 1.4, duration: 16, moveSpeed: 5.5, model: 'smoke', color: 0x5a5a5a, max: 1 });
  def('molotov', { name: 'Зажигательная', slot: 'grenade', type: 'grenade', price: 400, killReward: 300, damage: 8, radius: 4.5, fuse: 1.4, duration: 7, moveSpeed: 5.5, model: 'he', color: 0x8a4a2a, max: 1 });

  def('bomb', { name: 'Бомба C4', slot: 'bomb', type: 'bomb', price: 0, killReward: 0, moveSpeed: 5.6, model: 'bomb', plantTime: 3.2 });

  S3.WEAPONS = W;
  S3.GEAR = {
    kevlar: { name: 'Бронежилет', price: 650 }, helmet: { name: 'Броня + Шлем', price: 1000 }, defuser: { name: 'Набор сапёра', price: 400 },
  };
  S3.BUY_CATEGORIES = [
    { name: 'Пистолеты', ids: ['g22', 'usp', 'p350', 'fn57', 'tec9', 'deagle'] },
    { name: 'ПП', ids: ['mac10', 'mp5', 'mp7', 'ump45', 'p90'] },
    { name: 'Винтовки', ids: ['famas', 'm16', 'akr', 'akr12', 'm4', 'aug', 'g3sg1'] },
    { name: 'Снайперские', ids: ['m40', 'awm'] },
    { name: 'Дробовики / Пулемёты', ids: ['nova', 'm1014', 'm249'] },
    { name: 'Гранаты', ids: ['he', 'flash', 'smoke', 'molotov'] },
    { name: 'Снаряжение', ids: ['kevlar', 'helmet', 'defuser'] },
  ];
  S3.ARMS_RACE_ORDER = ['g22', 'usp', 'p350', 'fn57', 'tec9', 'deagle', 'mac10', 'mp5', 'ump45', 'p90', 'nova', 'm1014', 'famas', 'm16', 'akr', 'm4', 'aug', 'akr12', 'm249', 'g3sg1', 'm40', 'awm', 'knife'];

  // --- Economy (Defuse) ---
  S3.ECON = {
    startMoney: 800, maxMoney: 16000, winBomb: 3500, winElim: 3250, winDefuse: 3500, winTime: 3250,
    lossBase: 1400, lossStep: 500, lossMax: 3400, plantBonus: 300, lossPlantBonus: 800, teamPlantBonusT: 800,
  };
  S3.ROUND = { freezeTime: 6, roundTime: 115, bombTime: 40, endTime: 6, buyTime: 25, defuseTime: 10, defuseKitTime: 5, plantTime: 3.2 };

  // --- Bot difficulty ---
  S3.DIFFICULTY = {
    easy: { name: 'Лёгкий', reaction: 0.75, aimError: 6.5, turnSpeed: 4, burst: [2, 4], pause: [0.5, 1.0], headshot: 0.05, hearRange: 25, visionRange: 45, accuracyMove: 0.4, strafe: 0.3, grenades: 0.1, spot: 0.5 },
    medium: { name: 'Средний', reaction: 0.45, aimError: 3.8, turnSpeed: 7, burst: [3, 6], pause: [0.3, 0.6], headshot: 0.15, hearRange: 35, visionRange: 60, accuracyMove: 0.6, strafe: 0.5, grenades: 0.3, spot: 0.3 },
    hard: { name: 'Сложный', reaction: 0.28, aimError: 2.2, turnSpeed: 11, burst: [4, 8], pause: [0.2, 0.4], headshot: 0.28, hearRange: 45, visionRange: 80, accuracyMove: 0.75, strafe: 0.7, grenades: 0.5, spot: 0.18 },
    expert: { name: 'Эксперт', reaction: 0.15, aimError: 1.2, turnSpeed: 16, burst: [5, 12], pause: [0.12, 0.3], headshot: 0.4, hearRange: 60, visionRange: 100, accuracyMove: 0.9, strafe: 0.85, grenades: 0.7, spot: 0.1 },
  };

  S3.BOT_NAMES = ['Zver', 'Tiger', 'Skif', 'Kolyan', 'Dimasik', 'Maxim_PRO', 'NoName', 'Ghost', 'Volk', 'Sanya228', 'Kirill_TV', 'Hunter', 'Spartak', 'Nikita', 'Vlad_007', 'Boss', 'Medved', 'Sokol', 'Rex', 'Danila', 'Kot', 'Stalker', 'Yarik', 'Legend', 'Shadow', 'Grom', 'Mongol', 'Batyr', 'Timur', 'Arslan', 'Baatar', 'Chingis', 'Aidar', 'Sultan', 'Ruslan', 'Ivan_Killer', 'Pasha', 'Lexa', 'Vova', 'Denis', 'Igor', 'Semen', 'Zheka', 'Tolik'];

  S3.TEAM = { T: 'T', CT: 'CT' };
  S3.TEAM_NAME = { T: 'Террористы', CT: 'Спецназ' };
  S3.TEAM_COLOR = { T: 0xe0a030, CT: 0x4090e0 };
  S3.TEAM_COLOR_CSS = { T: '#e8b040', CT: '#50a0f0' };

  S3.RADIO = [
    { key: '1', text: 'Прикройте меня!' }, { key: '2', text: 'Враг замечен!' }, { key: '3', text: 'Нужна помощь!' },
    { key: '4', text: 'Идём на A' }, { key: '5', text: 'Идём на B' }, { key: '6', text: 'Держим позиции' },
    { key: '7', text: 'Отступаем!' }, { key: '8', text: 'Чисто' }, { key: '9', text: 'Хорошо сработано!' },
  ];

  S3.MODES = {
    defuse: { name: 'Разминирование', desc: 'Классика: T устанавливают бомбу, CT защищают точки. Раунды, экономика, покупка оружия.' },
    tdm: { name: 'Командный бой', desc: 'Две команды, возрождение, побеждает команда, первой набравшая нужное число убийств.' },
    armsrace: { name: 'Гонка вооружений', desc: 'Каждое убийство даёт новое оружие. Побеждает первый, кто убьёт ножом на последнем уровне.' },
    ffa: { name: 'Каждый за себя', desc: 'Все против всех, возрождение, побеждает первый набравший нужное число убийств.' },
  };
})();
