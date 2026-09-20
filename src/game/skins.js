// ===== Standoff 3 — skins: rarities, finishes (procedural textures), skin catalog, cases, inventory =====
'use strict';
(function () {
  const S3 = window.S3;

  // ---------- rarities ----------
  S3.RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'arcane'];
  S3.RARITY = {
    common: { name: 'Обычный', color: '#b0b8c0', weight: 50, sell: 15 },
    uncommon: { name: 'Необычный', color: '#4b8cff', weight: 27, sell: 40 },
    rare: { name: 'Редкий', color: '#9a5cff', weight: 13, sell: 120 },
    epic: { name: 'Эпический', color: '#e040e0', weight: 6.5, sell: 350 },
    legendary: { name: 'Легендарный', color: '#ff5a4a', weight: 3, sell: 900 },
    arcane: { name: 'Арканный', color: '#ffd24a', weight: 0.5, sell: 2500 },
  };

  // ---------- finishes: how a skin looks (pattern + palette + material params) ----------
  // pattern generators draw onto a 256x256 canvas; the result is shared by every weapon using this finish
  const F = {};
  function fin(id, o) { o.id = id; F[id] = o; return o; }
  // common
  fin('sand', { name: 'Песок', rarity: 'common', pattern: 'solid', colors: ['#b8a170', '#a08a5a'] });
  fin('olive', { name: 'Олива', rarity: 'common', pattern: 'solid', colors: ['#5c6a3c', '#48542e'] });
  fin('graphite', { name: 'Графит', rarity: 'common', pattern: 'solid', colors: ['#3c3f45', '#2a2c30'], metalness: 0.6, roughness: 0.4 });
  fin('urban', { name: 'Урбан', rarity: 'common', pattern: 'digital', colors: ['#5a5e64', '#8a8e94', '#3a3c40', '#b0b4b8'] });
  fin('forest', { name: 'Лесной', rarity: 'common', pattern: 'camo', colors: ['#4a5e32', '#2e3d22', '#7a7a4a', '#1e2818'] });
  fin('rust', { name: 'Ржавчина', rarity: 'common', pattern: 'splash', colors: ['#5a3a22', '#8a5a2a', '#3a2a1a', '#a0622a'] });
  fin('desert', { name: 'Пустыня', rarity: 'common', pattern: 'camo', colors: ['#c2a878', '#9a825a', '#d8c090', '#7a6a4a'] });
  // uncommon
  fin('tiger', { name: 'Тигр', rarity: 'uncommon', pattern: 'tiger', colors: ['#e08a20', '#1a1410'] });
  fin('ocean', { name: 'Океан', rarity: 'uncommon', pattern: 'waves', colors: ['#0d3a6a', '#2a7ab8', '#6ad0ff'] });
  fin('hex', { name: 'Гексагон', rarity: 'uncommon', pattern: 'hex', colors: ['#2a2e36', '#6a7a90'], metalness: 0.5, roughness: 0.45 });
  fin('blood', { name: 'Кровавый', rarity: 'uncommon', pattern: 'splash', colors: ['#2a2a2c', '#a01818', '#701010', '#c82828'] });
  fin('winter', { name: 'Зима', rarity: 'uncommon', pattern: 'camo', colors: ['#e8ecf0', '#b8c4d0', '#8a98a8', '#f8f8f8'] });
  fin('stripes', { name: 'Полосы', rarity: 'uncommon', pattern: 'stripes', colors: ['#202428', '#ffb020'] });
  // rare
  fin('carbon', { name: 'Карбон', rarity: 'rare', pattern: 'carbon', colors: ['#1a1c20', '#3a3e46'], metalness: 0.7, roughness: 0.3 });
  fin('neon', { name: 'Неон', rarity: 'rare', pattern: 'circuit', colors: ['#0a0c14', '#20f0ff'], emissive: 1.0, metalness: 0.3, roughness: 0.5 });
  fin('marble', { name: 'Мрамор', rarity: 'rare', pattern: 'marble', colors: ['#e8e6e0', '#8a8880', '#c8c4b8'], roughness: 0.25 });
  fin('lava', { name: 'Лава', rarity: 'rare', pattern: 'cracks', colors: ['#1a1210', '#ff6a10', '#ffd040'], emissive: 0.8 });
  fin('toxic', { name: 'Токсин', rarity: 'rare', pattern: 'splash', colors: ['#141a14', '#40ff30', '#20a018', '#a0ff60'], emissive: 0.35 });
  // epic
  fin('galaxy', { name: 'Галактика', rarity: 'epic', pattern: 'galaxy', colors: ['#0a0620', '#4a20a0', '#2060c0', '#ff80c0'], emissive: 0.45, roughness: 0.35 });
  fin('dragon', { name: 'Дракон', rarity: 'epic', pattern: 'flames', colors: ['#1a0c08', '#c02010', '#ff8020', '#ffe060'], emissive: 0.25 });
  fin('candy', { name: 'Конфета', rarity: 'epic', pattern: 'stripes', colors: ['#ff70b0', '#ffffff', '#60d0ff'], roughness: 0.2 });
  fin('phantom', { name: 'Фантом', rarity: 'epic', pattern: 'lightning', colors: ['#100818', '#b060ff', '#e0c0ff'], emissive: 0.7 });
  // legendary
  fin('gold', { name: 'Золото', rarity: 'legendary', pattern: 'metal', colors: ['#ffd24a', '#c89a20', '#fff0a0'], metalness: 1.0, roughness: 0.22 });
  fin('inferno', { name: 'Инферно', rarity: 'legendary', pattern: 'flames', colors: ['#080404', '#ff2000', '#ff9000', '#ffffff'], emissive: 0.6 });
  fin('frost', { name: 'Вечная мерзлота', rarity: 'legendary', pattern: 'frost', colors: ['#d8f0ff', '#60b0ff', '#ffffff'], metalness: 0.4, roughness: 0.15, emissive: 0.2 });
  fin('chrome', { name: 'Хром', rarity: 'legendary', pattern: 'metal', colors: ['#e8ecf0', '#8a929a', '#ffffff'], metalness: 1.0, roughness: 0.1 });
  // arcane
  fin('diamond', { name: 'Алмаз', rarity: 'arcane', pattern: 'facets', colors: ['#c8f4ff', '#60c0ff', '#ffffff', '#a0e0ff'], metalness: 0.6, roughness: 0.05, emissive: 0.3 });
  fin('royal', { name: 'Королевский', rarity: 'arcane', pattern: 'ornament', colors: ['#7a0a18', '#ffd24a', '#fff0a0'], metalness: 0.8, roughness: 0.25, emissive: 0.15 });
  S3.FINISHES = F;

  // ---------- procedural pattern textures ----------
  const texCache = {};
  function rgbaOf(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  function drawPattern(ctx, f, rnd) {
    const S = 256, C = f.colors;
    ctx.fillStyle = C[0]; ctx.fillRect(0, 0, S, S);
    switch (f.pattern) {
      case 'solid': {
        for (let i = 0; i < 1400; i++) { ctx.fillStyle = rgbaOf(rnd() < 0.5 ? C[1] : '#ffffff', 0.06 + rnd() * 0.08); ctx.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 3, 1 + rnd() * 3); }
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1; for (let i = 0; i < 14; i++) { ctx.beginPath(); const x = rnd() * S, y = rnd() * S; ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * 60, y + (rnd() - 0.5) * 60); ctx.stroke(); }
        break;
      }
      case 'camo': {
        for (let i = 0; i < 90; i++) { ctx.fillStyle = C[1 + Math.floor(rnd() * (C.length - 1))]; ctx.beginPath(); const x = rnd() * S, y = rnd() * S; ctx.moveTo(x, y); for (let k = 0; k < 7; k++) ctx.lineTo(x + (rnd() - 0.5) * 70, y + (rnd() - 0.5) * 70); ctx.closePath(); ctx.fill(); }
        break;
      }
      case 'digital': {
        const cell = 12; for (let y = 0; y < S; y += cell) for (let x = 0; x < S; x += cell) { if (rnd() < 0.55) { ctx.fillStyle = C[Math.floor(rnd() * C.length)]; ctx.fillRect(x, y, cell * (1 + Math.floor(rnd() * 2)), cell); } }
        break;
      }
      case 'splash': {
        for (let i = 0; i < 40; i++) { ctx.fillStyle = C[1 + Math.floor(rnd() * (C.length - 1))]; const x = rnd() * S, y = rnd() * S, r = 4 + rnd() * 22; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); for (let k = 0; k < 6; k++) { const a = rnd() * 6.28, d = r + rnd() * 30; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 1 + rnd() * 4, 0, 7); ctx.fill(); } }
        break;
      }
      case 'tiger': {
        ctx.strokeStyle = C[1]; ctx.lineCap = 'round';
        for (let i = 0; i < 18; i++) { ctx.lineWidth = 6 + rnd() * 12; ctx.beginPath(); let x = rnd() * S; ctx.moveTo(x, -10); for (let y = 0; y <= S + 20; y += 24) { x += (rnd() - 0.5) * 40; ctx.lineTo(x, y); } ctx.stroke(); }
        break;
      }
      case 'waves': {
        for (let i = 0; i < 26; i++) { ctx.strokeStyle = rgbaOf(C[1 + (i % (C.length - 1))], 0.8); ctx.lineWidth = 3 + rnd() * 4; ctx.beginPath(); const y0 = i * 11; for (let x = 0; x <= S; x += 6) ctx.lineTo(x, y0 + Math.sin(x * 0.05 + i) * 9); ctx.stroke(); }
        break;
      }
      case 'hex': {
        ctx.strokeStyle = C[1]; ctx.lineWidth = 2; const r = 14;
        for (let row = -1; row < 14; row++) for (let col = -1; col < 12; col++) { const cx = col * r * 1.75 + (row % 2 ? r * 0.875 : 0), cy = row * r * 1.5; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + Math.PI / 6; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } ctx.closePath(); ctx.stroke(); }
        break;
      }
      case 'stripes': {
        ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(-0.6); const w = 22;
        for (let i = -14; i < 14; i++) { ctx.fillStyle = C[1 + ((i + 100) % (C.length - 1))]; if ((i + 100) % 2) ctx.fillRect(i * w, -S, w, S * 2); }
        ctx.restore(); break;
      }
      case 'carbon': {
        const c = 8; for (let y = 0; y < S; y += c) for (let x = 0; x < S; x += c) { const odd = ((x / c) + (y / c)) % 2; ctx.fillStyle = odd ? C[1] : C[0]; ctx.fillRect(x, y, c, c); ctx.fillStyle = 'rgba(255,255,255,0.12)'; if (odd) ctx.fillRect(x, y, c, 2); else ctx.fillRect(x, y, 2, c); }
        break;
      }
      case 'circuit': {
        ctx.strokeStyle = C[1]; ctx.fillStyle = C[1]; ctx.lineWidth = 2;
        for (let i = 0; i < 40; i++) { let x = Math.floor(rnd() * 16) * 16, y = Math.floor(rnd() * 16) * 16; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { if (rnd() < 0.5) x += (rnd() < 0.5 ? -1 : 1) * 16 * (1 + Math.floor(rnd() * 3)); else y += (rnd() < 0.5 ? -1 : 1) * 16 * (1 + Math.floor(rnd() * 3)); ctx.lineTo(x, y); } ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
        break;
      }
      case 'marble': {
        ctx.strokeStyle = C[1]; ctx.lineWidth = 1.5; ctx.shadowColor = C[1]; ctx.shadowBlur = 6;
        for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.moveTo(rnd() * S, rnd() * S); ctx.bezierCurveTo(rnd() * S, rnd() * S, rnd() * S, rnd() * S, rnd() * S, rnd() * S); ctx.stroke(); }
        ctx.shadowBlur = 0; ctx.strokeStyle = rgbaOf(C[2], 0.5); for (let i = 0; i < 20; i++) { ctx.beginPath(); ctx.moveTo(rnd() * S, rnd() * S); ctx.bezierCurveTo(rnd() * S, rnd() * S, rnd() * S, rnd() * S, rnd() * S, rnd() * S); ctx.stroke(); }
        break;
      }
      case 'cracks': {
        ctx.strokeStyle = C[1]; ctx.shadowColor = C[2]; ctx.shadowBlur = 8; ctx.lineCap = 'round';
        for (let i = 0; i < 30; i++) { ctx.lineWidth = 2 + rnd() * 4; ctx.beginPath(); let x = rnd() * S, y = rnd() * S; ctx.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 50; y += (rnd() - 0.5) * 50; ctx.lineTo(x, y); } ctx.stroke(); }
        ctx.shadowBlur = 0; break;
      }
      case 'galaxy': {
        for (let i = 0; i < 9; i++) { const g = ctx.createRadialGradient(rnd() * S, rnd() * S, 0, rnd() * S, rnd() * S, 60 + rnd() * 80); g.addColorStop(0, rgbaOf(C[1 + Math.floor(rnd() * (C.length - 1))], 0.7)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, S, S); }
        for (let i = 0; i < 260; i++) { ctx.fillStyle = rgbaOf('#ffffff', 0.4 + rnd() * 0.6); const r = rnd() < 0.9 ? 1 : 2; ctx.fillRect(rnd() * S, rnd() * S, r, r); }
        break;
      }
      case 'flames': {
        const g = ctx.createLinearGradient(0, S, 0, 0); g.addColorStop(0, C[1]); g.addColorStop(0.5, C[2]); g.addColorStop(1, C[0]); ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
        for (let i = 0; i < 24; i++) { ctx.fillStyle = i % 3 === 0 ? C[3] : (i % 3 === 1 ? C[2] : C[1]); const x = rnd() * S; ctx.beginPath(); ctx.moveTo(x - 20, S + 10); ctx.quadraticCurveTo(x - 14 + (rnd() - 0.5) * 30, S * 0.6, x + (rnd() - 0.5) * 20, 30 + rnd() * 100); ctx.quadraticCurveTo(x + 14 + (rnd() - 0.5) * 30, S * 0.6, x + 20, S + 10); ctx.closePath(); ctx.globalAlpha = 0.75; ctx.fill(); ctx.globalAlpha = 1; }
        break;
      }
      case 'lightning': {
        ctx.strokeStyle = C[1]; ctx.shadowColor = C[2]; ctx.shadowBlur = 10; ctx.lineWidth = 2;
        for (let i = 0; i < 14; i++) { ctx.beginPath(); let x = rnd() * S, y = 0; ctx.moveTo(x, y); while (y < S) { x += (rnd() - 0.5) * 40; y += 10 + rnd() * 20; ctx.lineTo(x, y); } ctx.stroke(); }
        ctx.shadowBlur = 0; break;
      }
      case 'metal': {
        const g = ctx.createLinearGradient(0, 0, S, S); g.addColorStop(0, C[1]); g.addColorStop(0.45, C[0]); g.addColorStop(0.55, C[2]); g.addColorStop(1, C[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 80; i++) { ctx.beginPath(); const y = rnd() * S; ctx.moveTo(0, y); ctx.lineTo(S, y + (rnd() - 0.5) * 8); ctx.stroke(); }
        break;
      }
      case 'frost': {
        ctx.strokeStyle = rgbaOf(C[2], 0.9); ctx.lineWidth = 1.5;
        for (let i = 0; i < 40; i++) { const x = rnd() * S, y = rnd() * S; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + rnd() * 0.2; const l = 10 + rnd() * 30; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); } }
        ctx.fillStyle = rgbaOf(C[1], 0.35); for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.arc(rnd() * S, rnd() * S, 6 + rnd() * 20, 0, 7); ctx.fill(); }
        break;
      }
      case 'facets': {
        for (let i = 0; i < 120; i++) { ctx.fillStyle = C[Math.floor(rnd() * C.length)]; const x = rnd() * S, y = rnd() * S, r = 14 + rnd() * 26; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r, y + (rnd() - 0.5) * r); ctx.lineTo(x + (rnd() - 0.5) * r, y + r); ctx.closePath(); ctx.fill(); }
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.moveTo(rnd() * S, rnd() * S); ctx.lineTo(rnd() * S, rnd() * S); ctx.stroke(); }
        break;
      }
      case 'ornament': {
        ctx.strokeStyle = C[1]; ctx.lineWidth = 3; const cell = 64;
        for (let y = 0; y < S; y += cell) for (let x = 0; x < S; x += cell) { ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, cell * 0.36, 0, 7); ctx.stroke(); ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; ctx.moveTo(x + cell / 2, y + cell / 2); ctx.quadraticCurveTo(x + cell / 2 + Math.cos(a + 0.5) * cell * 0.5, y + cell / 2 + Math.sin(a + 0.5) * cell * 0.5, x + cell / 2 + Math.cos(a) * cell * 0.5, y + cell / 2 + Math.sin(a) * cell * 0.5); } ctx.stroke(); ctx.fillStyle = C[2]; ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, 5, 0, 7); ctx.fill(); }
        break;
      }
    }
  }
  S3.finishTexture = function (finishId) {
    if (texCache[finishId]) return texCache[finishId];
    const f = F[finishId]; const c = document.createElement('canvas'); c.width = 256; c.height = 256; const ctx = c.getContext('2d');
    const rnd = S3.seededRandom(finishId.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0);
    drawPattern(ctx, f, rnd);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    texCache[finishId] = t; return t;
  };
  // Fake studio environment (cube texture from canvases) so metallic finishes (gold/chrome) reflect
  // something instead of rendering black: a CubeTexture is plain image data, so unlike a PMREM render
  // target it works in every renderer (game, menu preview, thumbnail baker) without rebaking.
  let envTex = null;
  S3.skinEnvMap = function () {
    if (envTex) return envTex;
    const faces = [];
    for (let i = 0; i < 6; i++) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const ctx = c.getContext('2d');
      if (i === 2) { ctx.fillStyle = '#dfe6ee'; ctx.fillRect(0, 0, 64, 64); } // +Y: bright ceiling
      else if (i === 3) { ctx.fillStyle = '#23272c'; ctx.fillRect(0, 0, 64, 64); } // -Y: dark floor
      else { const g = ctx.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#c8d2dc'); g.addColorStop(0.5, '#6a7480'); g.addColorStop(1, '#2a2e34'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(10 + i * 6, 8, 14, 22); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(40, 14, 10, 12); } // softbox highlights
      faces.push(c);
    }
    envTex = new THREE.CubeTexture(faces); envTex.colorSpace = THREE.SRGBColorSpace; envTex.needsUpdate = true; return envTex;
  };
  // materials per finish: primary (main body parts) and secondary (darker: handguards, mags, stocks)
  const matCache = {};
  S3.finishMaterials = function (finishId) {
    if (matCache[finishId]) return matCache[finishId];
    const f = F[finishId]; const map = S3.finishTexture(finishId);
    const base = { map, metalness: f.metalness !== undefined ? f.metalness : 0.35, roughness: f.roughness !== undefined ? f.roughness : 0.55, envMap: S3.skinEnvMap(), envMapIntensity: 0.8 };
    if (f.emissive) { base.emissiveMap = map; base.emissive = new THREE.Color(0xffffff); base.emissiveIntensity = f.emissive * 0.45; }
    const primary = new THREE.MeshStandardMaterial(Object.assign({}, base));
    const secondary = new THREE.MeshStandardMaterial(Object.assign({}, base, { color: 0x8a8a8a }));
    if (f.emissive) secondary.emissiveIntensity = f.emissive * 0.25;
    matCache[finishId] = { primary, secondary }; return matCache[finishId];
  };

  // ---------- skin catalog: each skinnable weapon gets a deterministic subset of finishes ----------
  const SKINS = {};
  const skinnable = Object.keys(S3.WEAPONS).filter((id) => { const t = S3.WEAPONS[id].type; return t !== 'grenade' && t !== 'bomb'; });
  const byRarity = {}; for (const id in F) { (byRarity[F[id].rarity] = byRarity[F[id].rarity] || []).push(id); }
  const ARCANE_WEAPONS = ['knife', 'akr', 'm4', 'awm', 'deagle', 'usp', 'akr12', 'aug'];
  const COUNT = { common: 3, uncommon: 3, rare: 2, epic: 2, legendary: 2, arcane: 1 };
  function pickN(list, n, rnd) { const a = list.slice(); const out = []; while (a.length && out.length < n) out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); return out; }
  for (const wid of skinnable) {
    const rnd = S3.seededRandom(wid.split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 11) >>> 0);
    for (const r of S3.RARITY_ORDER) {
      if (r === 'arcane' && !ARCANE_WEAPONS.includes(wid)) continue;
      let n = COUNT[r]; if (wid === 'knife') n = Math.min(byRarity[r].length, n + 2);
      for (const fid of pickN(byRarity[r], n, rnd)) { const id = wid + '_' + fid; SKINS[id] = { id, weapon: wid, finish: fid, rarity: r, name: S3.WEAPONS[wid].name + ' | ' + F[fid].name }; }
    }
  }
  S3.SKINS = SKINS;
  S3.skinsFor = (wid) => Object.values(SKINS).filter((s) => s.weapon === wid);

  // ---------- cases ----------
  const TYPE = (ids) => (s) => ids.includes(S3.WEAPONS[s.weapon].type);
  S3.CASES = [
    { id: 'starter', name: 'Кейс новичка', price: 250, color: '#7aa0c8', desc: 'Пистолеты, пистолеты-пулемёты и дробовики.', filter: TYPE(['pistol', 'smg', 'shotgun']) },
    { id: 'assault', name: 'Штурмовой кейс', price: 400, color: '#e0a040', desc: 'Штурмовые винтовки и пулемёт.', filter: TYPE(['rifle', 'mg']) },
    { id: 'sniper', name: 'Снайперский кейс', price: 400, color: '#60c890', desc: 'Снайперские винтовки, AUG и G3SG1.', filter: (s) => S3.WEAPONS[s.weapon].type === 'sniper' || s.weapon === 'aug' || s.weapon === 'g3sg1' },
    { id: 'knife', name: 'Кейс ножей', price: 900, color: '#d060d0', desc: 'Только скины на нож — включая арканный Алмаз.', filter: (s) => s.weapon === 'knife' },
    { id: 'gold', name: 'Золотой кейс', price: 1200, color: '#ffd24a', desc: 'Только редкие и выше. Повышенный шанс легендарных и арканных.', filter: (s) => S3.RARITY_ORDER.indexOf(s.rarity) >= 2, weights: { rare: 45, epic: 32, legendary: 18, arcane: 5 } },
  ];
  S3.caseContents = function (c) { return Object.values(SKINS).filter(c.filter).sort((a, b) => S3.RARITY_ORDER.indexOf(a.rarity) - S3.RARITY_ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name)); };
  S3.caseOdds = function (c) {
    const items = S3.caseContents(c); const present = S3.RARITY_ORDER.filter((r) => items.some((s) => s.rarity === r));
    const w = present.map((r) => (c.weights && c.weights[r] !== undefined) ? c.weights[r] : S3.RARITY[r].weight); const total = w.reduce((a, b) => a + b, 0);
    return present.map((r, i) => ({ rarity: r, chance: w[i] / total, items: items.filter((s) => s.rarity === r) }));
  };
  S3.rollCase = function (c, rnd) {
    rnd = rnd || Math.random; const odds = S3.caseOdds(c); let x = rnd();
    for (const o of odds) { if (x < o.chance) return o.items[Math.floor(rnd() * o.items.length)]; x -= o.chance; }
    const last = odds[odds.length - 1]; return last.items[Math.floor(rnd() * last.items.length)];
  };
  // random cosmetic loadout for bots: a few skins so matches don't look all-stock
  S3.randomBotSkins = function (rnd) {
    rnd = rnd || Math.random; const m = {};
    for (const wid of skinnable) { if (rnd() > 0.3) continue; const list = S3.skinsFor(wid).filter((s) => S3.RARITY_ORDER.indexOf(s.rarity) <= (rnd() < 0.15 ? 5 : 2)); if (list.length) m[wid] = list[Math.floor(rnd() * list.length)].id; }
    return m;
  };
  // validate a skin map coming from the network / storage
  S3.cleanSkinMap = function (m) { const out = {}; if (!m || typeof m !== 'object') return out; for (const wid in m) { const s = SKINS[m[wid]]; if (s && s.weapon === wid) out[wid] = s.id; } return out; };

  // ---------- inventory (persistent) ----------
  S3.Inventory = {
    data: { gold: 2000, items: {}, equipped: {}, opened: 0, earned: 0 },
    load() { try { const s = localStorage.getItem('standoff3_inventory'); if (s) Object.assign(this.data, JSON.parse(s)); } catch (e) { } this.data.equipped = S3.cleanSkinMap(this.data.equipped); for (const id in this.data.items) if (!SKINS[id] || !(this.data.items[id] > 0)) delete this.data.items[id]; return this.data; },
    save() { try { localStorage.setItem('standoff3_inventory', JSON.stringify(this.data)); } catch (e) { } },
    count(id) { return this.data.items[id] || 0; },
    add(id) { this.data.items[id] = (this.data.items[id] || 0) + 1; this.save(); },
    remove(id) { if (!this.data.items[id]) return false; this.data.items[id]--; if (this.data.items[id] <= 0) { delete this.data.items[id]; const s = SKINS[id]; if (s && this.data.equipped[s.weapon] === id) delete this.data.equipped[s.weapon]; } this.save(); return true; },
    equip(id) { const s = SKINS[id]; if (!s || !this.count(id)) return false; this.data.equipped[s.weapon] = id; this.save(); return true; },
    unequip(wid) { delete this.data.equipped[wid]; this.save(); },
    isEquipped(id) { const s = SKINS[id]; return !!s && this.data.equipped[s.weapon] === id; },
    equippedMap() { return Object.assign({}, this.data.equipped); },
    addGold(n) { this.data.gold = Math.max(0, Math.round(this.data.gold + n)); if (n > 0) this.data.earned += n; this.save(); },
    canAfford(n) { return this.data.gold >= n; },
    open(c) { if (!this.canAfford(c.price)) return null; this.data.gold -= c.price; this.data.opened++; const s = S3.rollCase(c); this.add(s.id); return s; },
    sell(id) { const s = SKINS[id]; if (!s || !this.count(id)) return 0; const price = S3.RARITY[s.rarity].sell; this.remove(id); this.addGold(price); return price; },
    // gold reward for a finished match (kills/win) — the player's main income
    matchReward(kills, won, headshots) { return 150 + kills * 8 + (headshots || 0) * 4 + (won ? 120 : 0); },
  };
})();
