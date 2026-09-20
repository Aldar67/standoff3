// ===== Standoff 3 — cases UI: 3D skin previews/thumbnails, case opening roulette, inventory =====
'use strict';
(function () {
  const S3 = window.S3;
  const $ = (s) => document.querySelector(s); const $$ = (s) => Array.from(document.querySelectorAll(s));
  const R = S3.RARITY;

  // ---------- 3D preview (also used to bake thumbnails) ----------
  class SkinPreview {
    constructor(canvas, w, h, opts) {
      opts = opts || {};
      this.canvas = canvas; this.w = w; this.h = h;
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!opts.bake });
      this.renderer.setPixelRatio(opts.bake ? 1 : Math.min(window.devicePixelRatio, 2)); this.renderer.setSize(w, h, false); this.renderer.setClearColor(0x000000, 0);
      this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(30, w / h, 0.01, 20);
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404850, 1.1));
      const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2, 3, 2); this.scene.add(key);
      const rim = new THREE.DirectionalLight(0xa0c0ff, 0.9); rim.position.set(-3, 1, -2); this.scene.add(rim);
      this.pivot = new THREE.Group(); this.scene.add(this.pivot); this.model = null; this.spin = 0; this.running = false; this.lastT = 0;
    }
    show(skinOrWeaponId) {
      if (this.model) { this.pivot.remove(this.model); this.model = null; }
      const skin = S3.SKINS[skinOrWeaponId]; const w = S3.WEAPONS[skin ? skin.weapon : skinOrWeaponId]; if (!w) return;
      const m = S3.buildWeaponModel(w, 1, skin ? skin.id : null);
      const box = new THREE.Box3().setFromObject(m); const c = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3());
      m.position.sub(c); this.pivot.add(m); this.model = m;
      const len = Math.max(size.x, size.y, size.z, 0.2); this.camera.position.set(len * 1.55, len * 0.35, 0); this.camera.lookAt(0, 0, 0);
      this.pivot.rotation.set(0, 0, 0); this.spin = 0;
    }
    render(t) { this.renderer.render(this.scene, this.camera); }
    start() {
      if (this.running) return; this.running = true; this.lastT = performance.now();
      const loop = (now) => { if (!this.running) return; const dt = Math.min(0.05, (now - this.lastT) / 1000); this.lastT = now; this.pivot.rotation.y += dt * 0.9; this.pivot.rotation.x = Math.sin(now * 0.0007) * 0.12; this.render(); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
    stop() { this.running = false; }
  }
  S3.SkinPreview = SkinPreview;

  // thumbnails: one hidden baking renderer, results cached as data URLs per skin/weapon id
  const thumbs = {}; let baker = null;
  S3.skinThumb = function (id) {
    if (thumbs[id]) return thumbs[id];
    if (!baker) { const c = document.createElement('canvas'); c.width = 220; c.height = 120; baker = new SkinPreview(c, 220, 120, { bake: true }); }
    baker.show(id); baker.pivot.rotation.set(0.15, -0.35, 0); baker.render();
    thumbs[id] = baker.canvas.toDataURL('image/png'); return thumbs[id];
  };

  // ---------- panel state ----------
  const ui = { tab: 'cases', caseId: null, invFilter: 'all', spinning: false, preview: null, modalSkin: null };
  const gold = (n) => `<span class="gold">🪙 ${n}</span>`;
  function skinCard(s, extra) {
    const inv = S3.Inventory; const cnt = inv.count(s.id); const eq = inv.isEquipped(s.id);
    return `<div class="skin-card r-${s.rarity} ${eq ? 'eq' : ''}" data-skin="${s.id}" style="--rc:${R[s.rarity].color}"><img src="${S3.skinThumb(s.id)}" alt=""><div class="skin-name">${s.name}</div><div class="skin-rar">${R[s.rarity].name}${cnt > 1 ? ' · ×' + cnt : ''}${eq ? ' · <b>надето</b>' : ''}</div>${extra || ''}</div>`;
  }
  function refreshGold() { $$('.gold-bal').forEach((e) => e.innerHTML = gold(S3.Inventory.data.gold)); const n = Object.values(S3.Inventory.data.items).reduce((a, b) => a + b, 0); $('#inv-count').textContent = n ? `(${n})` : ''; }
  function switchTab(tab) {
    ui.tab = tab; $$('[data-ctab]').forEach((t) => t.classList.toggle('act', t.dataset.ctab === tab));
    $('#cases-pane').style.display = tab === 'cases' ? 'block' : 'none'; $('#inv-pane').style.display = tab === 'inv' ? 'block' : 'none';
    if (tab === 'inv') renderInventory(); S3.Audio.uiClick();
  }
  function renderCases() {
    refreshGold();
    const list = $('#case-list');
    list.innerHTML = S3.CASES.map((c) => `<div class="card case-card ${ui.caseId === c.id ? 'sel' : ''}" data-case="${c.id}" style="--cc:${c.color}"><div class="case-icon"><div class="case-box"></div></div><div class="card-title">${c.name}</div><div class="card-desc">${c.desc}</div><div class="case-price">${gold(c.price)}</div></div>`).join('');
    list.querySelectorAll('.case-card').forEach((el) => el.addEventListener('click', () => { if (ui.spinning) return; ui.caseId = el.dataset.case; renderCases(); S3.Audio.uiClick(); }));
    const c = S3.CASES.find((x) => x.id === ui.caseId); const det = $('#case-detail'); det.style.display = c ? 'block' : 'none'; if (!c) return;
    const odds = S3.caseOdds(c);
    $('#case-name').textContent = c.name;
    $('#case-odds').innerHTML = odds.map((o) => `<span style="color:${R[o.rarity].color}">${R[o.rarity].name} ${(o.chance * 100).toFixed(o.chance < 0.01 ? 2 : 1)}%</span>`).join(' · ');
    const btn = $('#btn-open-case'); btn.innerHTML = `Открыть за ${c.price} 🪙`; btn.disabled = !S3.Inventory.canAfford(c.price) || ui.spinning; btn.classList.toggle('dis', btn.disabled);
    $('#case-afford').textContent = S3.Inventory.canAfford(c.price) ? '' : 'Недостаточно золота — золото начисляется за каждый сыгранный матч.';
    const contents = S3.caseContents(c); $('#case-contents').innerHTML = contents.map((s) => skinCard(s)).join('');
    bindSkinCards($('#case-contents'));
    if (!ui.spinning) fillStrip(c, null);
  }
  function bindSkinCards(root) { root.querySelectorAll('.skin-card').forEach((el) => el.addEventListener('click', () => { if (ui.spinning) return; openModal(el.dataset.skin, false); })); }

  // ---------- roulette ----------
  const TILE = 132; // px, incl. gap (must match CSS .roulette-tile width + margin)
  function fillStrip(c, winner) {
    const strip = $('#roulette-strip'); const items = S3.caseContents(c); const odds = S3.caseOdds(c);
    const tiles = []; const N = 64, WIN = 54;
    for (let i = 0; i < N; i++) tiles.push(i === WIN && winner ? winner : S3.rollCase(c));
    strip.innerHTML = tiles.map((s) => `<div class="roulette-tile r-${s.rarity}" style="--rc:${R[s.rarity].color}"><img src="${S3.skinThumb(s.id)}" alt=""><div>${s.name}</div></div>`).join('');
    strip.style.transform = 'translateX(0px)'; return WIN;
  }
  function openCase() {
    const c = S3.CASES.find((x) => x.id === ui.caseId); if (!c || ui.spinning) return;
    const won = S3.Inventory.open(c); if (!won) { S3.Audio.error(); return; }
    ui.spinning = true; refreshGold(); $('#btn-open-case').disabled = true; $('#btn-open-case').classList.add('dis');
    const WIN = fillStrip(c, won); const strip = $('#roulette-strip'); const box = $('#roulette');
    const viewW = box.clientWidth; const jitter = (Math.random() - 0.5) * (TILE * 0.7);
    const target = WIN * TILE + TILE / 2 - viewW / 2 + jitter; // px to scroll so the winner sits under the marker
    const dur = 5200; const t0 = performance.now(); let lastIdx = -1;
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    S3.Audio.buy();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur); const x = ease(t) * target; strip.style.transform = `translateX(${-x}px)`;
      const idx = Math.floor((x + viewW / 2) / TILE); if (idx !== lastIdx) { lastIdx = idx; if (t < 0.985) S3.Audio.uiClick(); }
      if (t < 1) requestAnimationFrame(step); else { setTimeout(() => { ui.spinning = false; openModal(won.id, true); renderCases(); }, 350); }
    };
    requestAnimationFrame(step);
  }

  // ---------- inventory ----------
  function renderInventory() {
    refreshGold();
    const inv = S3.Inventory; const owned = Object.keys(inv.data.items).map((id) => S3.SKINS[id]).filter(Boolean);
    const weapons = Array.from(new Set(owned.map((s) => s.weapon)));
    const filt = $('#inv-filters');
    filt.innerHTML = [`<div class="opt ${ui.invFilter === 'all' ? 'sel' : ''}" data-f="all">Все</div>`].concat(weapons.map((w) => `<div class="opt ${ui.invFilter === w ? 'sel' : ''}" data-f="${w}">${S3.WEAPONS[w].name}</div>`)).join('');
    filt.querySelectorAll('.opt').forEach((o) => o.addEventListener('click', () => { ui.invFilter = o.dataset.f; renderInventory(); S3.Audio.uiClick(); }));
    const list = owned.filter((s) => ui.invFilter === 'all' || s.weapon === ui.invFilter).sort((a, b) => S3.RARITY_ORDER.indexOf(b.rarity) - S3.RARITY_ORDER.indexOf(a.rarity) || a.name.localeCompare(b.name));
    const grid = $('#inv-grid');
    grid.innerHTML = list.length ? list.map((s) => skinCard(s)).join('') : '<div class="inv-empty">Инвентарь пуст. Откройте кейс — золото уже начислено, а ещё оно даётся за каждый матч.</div>';
    bindSkinCards(grid);
    $('#inv-summary').innerHTML = `Скинов: <b>${owned.reduce((a, s) => a + inv.count(s.id), 0)}</b> · открыто кейсов: <b>${inv.data.opened}</b> · надето: <b>${Object.keys(inv.data.equipped).length}</b>`;
  }

  // ---------- modal: reveal / inspect ----------
  function openModal(skinId, reveal) {
    const s = S3.SKINS[skinId]; if (!s) return; ui.modalSkin = skinId;
    const m = $('#skin-modal'); m.style.display = 'flex'; m.classList.toggle('reveal', !!reveal); m.style.setProperty('--rc', R[s.rarity].color);
    $('#sm-title').textContent = reveal ? 'Вы получили!' : s.name; $('#sm-name').textContent = s.name; $('#sm-rar').textContent = R[s.rarity].name; $('#sm-rar').style.color = R[s.rarity].color;
    if (!ui.preview) { const c = $('#sm-canvas'); ui.preview = new SkinPreview(c, 640, 360); }
    ui.preview.show(skinId); ui.preview.start();
    if (reveal) { if (S3.RARITY_ORDER.indexOf(s.rarity) >= 3) S3.Audio.levelUp(); else S3.Audio.pickup(); }
    updateModalButtons();
  }
  function updateModalButtons() {
    const s = S3.SKINS[ui.modalSkin]; const inv = S3.Inventory; const cnt = inv.count(s.id); const eq = inv.isEquipped(s.id);
    $('#sm-count').textContent = cnt ? `В инвентаре: ×${cnt}` : 'Нет в инвентаре';
    const eqb = $('#btn-sm-equip'); eqb.style.display = cnt ? '' : 'none'; eqb.textContent = eq ? 'Снять' : 'Экипировать';
    const sell = $('#btn-sm-sell'); sell.style.display = cnt ? '' : 'none'; sell.innerHTML = `Продать за ${R[s.rarity].sell} 🪙`;
  }
  function closeModal() { $('#skin-modal').style.display = 'none'; if (ui.preview) ui.preview.stop(); ui.modalSkin = null; if (ui.tab === 'inv') renderInventory(); else renderCases(); }

  function bind() {
    $$('[data-ctab]').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.ctab)));
    $('#btn-open-case').addEventListener('click', openCase);
    $('#btn-sm-close').addEventListener('click', closeModal);
    $('#btn-sm-equip').addEventListener('click', () => { const s = S3.SKINS[ui.modalSkin]; if (S3.Inventory.isEquipped(s.id)) S3.Inventory.unequip(s.weapon); else S3.Inventory.equip(s.id); S3.Audio.armorEquip(); updateModalButtons(); });
    $('#btn-sm-sell').addEventListener('click', () => { const s = S3.SKINS[ui.modalSkin]; if (!confirm(`Продать ${s.name} за ${R[s.rarity].sell} золота?`)) return; S3.Inventory.sell(s.id); S3.Audio.buy(); refreshGold(); if (!S3.Inventory.count(s.id)) closeModal(); else updateModalButtons(); });
    $('#skin-modal').addEventListener('click', (e) => { if (e.target.id === 'skin-modal') closeModal(); });
  }
  // called by main.js when the panel is shown
  S3.CasesUI = {
    bind, show() { refreshGold(); if (!ui.caseId) ui.caseId = S3.CASES[0].id; renderCases(); if (ui.tab === 'inv') renderInventory(); },
    refreshGold, get open() { return $('#skin-modal').style.display === 'flex'; }, closeModal,
  };
})();
