// ===== Standoff 3 — main: menus, settings, game lifecycle =====
'use strict';
(function () {
  const S3 = window.S3;
  const $ = (s) => document.querySelector(s); const $$ = (s) => Array.from(document.querySelectorAll(s));
  const MAP_LIST = [
    { id: 'sandstone', title: 'Sandstone', desc: 'Пустынный город · 2 точки · классический лонг/мид/тоннели', modes: ['defuse', 'tdm', 'ffa', 'armsrace'] },
    { id: 'rust', title: 'Rust', desc: 'Промзона · контейнеры · склад A и двор B', modes: ['defuse', 'tdm', 'ffa', 'armsrace'] },
    { id: 'province', title: 'Province', desc: 'Старый город · дворы · магазины для обходов', modes: ['defuse', 'tdm', 'ffa', 'armsrace'] },
    { id: 'arena', title: 'Arena', desc: 'Компактная арена · для режимов с возрождением', modes: ['tdm', 'ffa', 'armsrace'] },
  ];
  const state = { mode: 'defuse', map: 'sandstone', team: 'CT', bots: 5, difficulty: 'medium', rounds: 16, killLimit: 60, primary: 'akr', secondary: 'usp' };
  let game = null; let previews = {};
  const net = { conn: null, role: null, players: [] }; // lobby-time connection, before a Game exists

  function mapPreview(id) {
    if (previews[id]) return previews[id];
    const def = S3.MAPS[id](); const c = document.createElement('canvas'); const S = 160; c.width = S; c.height = S; const ctx = c.getContext('2d');
    const sc = S / Math.max(def.xmax - def.xmin, def.zmax - def.zmin); ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, S, S);
    let maxH = 0; for (let k = 0; k < def.W * def.H; k++) if (!isNaN(def.h[k])) maxH = Math.max(maxH, def.h[k]);
    for (let j = 0; j < def.H; j++) for (let i = 0; i < def.W; i++) { const y = def.h[def.idx(i, j)]; if (isNaN(y)) continue; const l = 0.4 + 0.5 * (maxH ? y / maxH : 0); ctx.fillStyle = `rgb(${Math.floor(110 * l + 50)},${Math.floor(120 * l + 55)},${Math.floor(135 * l + 65)})`; ctx.fillRect(i * 0.5 * sc, j * 0.5 * sc, 0.5 * sc + 0.6, 0.5 * sc + 0.6); }
    ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd860';
    for (const s of def.sites) ctx.fillText(s.name, (s.cx - def.xmin) * sc, (s.cz - def.zmin) * sc);
    ctx.fillStyle = '#e8b040'; for (const p of def.spawns.T) { ctx.beginPath(); ctx.arc((p.x - def.xmin) * sc, (p.z - def.zmin) * sc, 2, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#50a0f0'; for (const p of def.spawns.CT) { ctx.beginPath(); ctx.arc((p.x - def.xmin) * sc, (p.z - def.zmin) * sc, 2, 0, 7); ctx.fill(); }
    previews[id] = c.toDataURL(); return previews[id];
  }

  // panel-main is the always-visible navigation column; every other panel opens in the content area next to it
  function showPanel(id) { $$('.panel').forEach((p) => { if (p.id === 'panel-main') return; p.classList.toggle('show', p.id === id); }); S3.Audio.uiClick(); }
  function menuSceneRefresh() {
    const S = S3.Settings.data; const inv = S3.Inventory;
    S3.MenuScene.refresh({ team: state.team === 'random' ? 'CT' : state.team, weapons: [state.primary, state.secondary, 'knife'], skins: inv.equippedMap() });
    const n = Object.values(inv.data.items).reduce((a, b) => a + b, 0); const st = S3.Stats.data;
    $('#side-profile').innerHTML = `<b>${S.playerName || 'Игрок'}</b> · ${S3.TEAM_NAME[state.team === 'random' ? 'CT' : state.team]}<br><span class="gold">🪙 ${inv.data.gold}</span> · скинов: ${n}<br>матчей: ${st.matches} · побед: ${st.wins} · K/D ${st.deaths ? (st.kills / st.deaths).toFixed(2) : st.kills}`;
  }
  function renderPlay() {
    const modes = $('#mode-list'); modes.innerHTML = Object.keys(S3.MODES).map((m) => `<div class="card mode ${state.mode === m ? 'sel' : ''}" data-mode="${m}"><div class="card-title">${S3.MODES[m].name}</div><div class="card-desc">${S3.MODES[m].desc}</div></div>`).join('');
    modes.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => { state.mode = c.dataset.mode; const m = MAP_LIST.find((x) => x.id === state.map); if (!m.modes.includes(state.mode)) state.map = MAP_LIST.find((x) => x.modes.includes(state.mode)).id; renderPlay(); S3.Audio.uiClick(); }));
    const maps = $('#map-list'); maps.innerHTML = MAP_LIST.map((m) => { const ok = m.modes.includes(state.mode); return `<div class="card map ${state.map === m.id ? 'sel' : ''} ${ok ? '' : 'dis'}" data-map="${m.id}"><img src="${mapPreview(m.id)}" alt=""><div class="card-title">${m.title}</div><div class="card-desc">${m.desc}</div></div>`; }).join('');
    maps.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => { if (c.classList.contains('dis')) return; state.map = c.dataset.map; renderPlay(); S3.Audio.uiClick(); }));
    $$('#team-sel .opt').forEach((o) => { o.classList.toggle('sel', o.dataset.team === state.team); o.onclick = () => { state.team = o.dataset.team; renderPlay(); menuSceneRefresh(); S3.Audio.uiClick(); }; });
    $$('#diff-sel .opt').forEach((o) => { o.classList.toggle('sel', o.dataset.diff === state.difficulty); o.onclick = () => { state.difficulty = o.dataset.diff; renderPlay(); S3.Audio.uiClick(); }; });
    $('#bots-range').value = state.bots; $('#bots-val').textContent = state.bots + ' на команду';
    $('#rounds-row').style.display = state.mode === 'defuse' ? 'flex' : 'none'; $('#kills-row').style.display = (state.mode === 'tdm' || state.mode === 'ffa') ? 'flex' : 'none'; $('#loadout-row').style.display = (state.mode === 'tdm' || state.mode === 'ffa') ? 'flex' : 'none';
    $$('#rounds-sel .opt').forEach((o) => { o.classList.toggle('sel', +o.dataset.r === state.rounds); o.onclick = () => { state.rounds = +o.dataset.r; renderPlay(); }; });
    $$('#kills-sel .opt').forEach((o) => { o.classList.toggle('sel', +o.dataset.k === state.killLimit); o.onclick = () => { state.killLimit = +o.dataset.k; renderPlay(); }; });
    const prim = $('#loadout-primary'), sec = $('#loadout-secondary');
    if (!prim.options.length) { for (const cat of S3.BUY_CATEGORIES.slice(1, 5)) for (const id of cat.ids) { const o = document.createElement('option'); o.value = id; o.textContent = S3.WEAPONS[id].name; prim.appendChild(o); } for (const id of S3.BUY_CATEGORIES[0].ids) { const o = document.createElement('option'); o.value = id; o.textContent = S3.WEAPONS[id].name; sec.appendChild(o); } }
    prim.value = state.primary; sec.value = state.secondary; prim.onchange = () => { state.primary = prim.value; menuSceneRefresh(); }; sec.onchange = () => { state.secondary = sec.value; menuSceneRefresh(); };
  }
  function renderSettings() {
    const S = S3.Settings.data; const f = $('#settings-form');
    f.querySelector('[name=sensitivity]').value = S.sensitivity; f.querySelector('[name=fov]').value = S.fov; f.querySelector('[name=volume]').value = S.volume; f.querySelector('[name=music]').value = S.music;
    f.querySelector('[name=shadows]').checked = S.shadows; f.querySelector('[name=quality]').value = S.quality; f.querySelector('[name=crosshairColor]').value = S.crosshairColor; f.querySelector('[name=crosshairSize]').value = S.crosshairSize; f.querySelector('[name=crosshairGap]').value = S.crosshairGap; f.querySelector('[name=crosshairThick]').value = S.crosshairThick; f.querySelector('[name=crosshairDot]').checked = S.crosshairDot;
    f.querySelector('[name=invertY]').checked = S.invertY; f.querySelector('[name=crouchToggle]').checked = S.crouchToggle; f.querySelector('[name=resScale]').value = S.resScale; f.querySelector('[name=showFps]').checked = S.showFps; f.querySelector('[name=playerName]').value = S.playerName; f.querySelector('[name=hudScale]').value = S.hudScale;
    f.querySelector('[name=voiceVolume]').value = S.voiceVolume; f.querySelector('[name=voiceEnabled]').checked = S.voiceEnabled; f.querySelector('[name=voiceMuteOthers]').checked = S.voiceMuteOthers;
    f.querySelector('[name=radarSize]').value = S.radarSize; f.querySelector('[name=radarZoom]').value = S.radarZoom; f.querySelector('[name=radarRotate]').checked = S.radarRotate; f.querySelector('[name=radarSquare]').checked = S.radarSquare;
    renderBinds(); updateSettingLabels();
  }
  // ---- settings tabs + key rebinding ----
  function settingsTab(id) { $$('[data-stab]').forEach((t) => t.classList.toggle('act', t.dataset.stab === id)); $$('.stab-pane').forEach((p) => p.style.display = p.dataset.pane === id ? 'block' : 'none'); }
  let bindWait = null; // action currently waiting for a key
  function renderBinds() {
    const I = S3.Input; const box = $('#binds'); if (!box) return;
    box.innerHTML = I.ACTIONS.map(([a, label]) => `<div class="bind-row"><span>${label}</span><button type="button" class="bind-key ${bindWait === a ? 'wait' : ''}" data-action="${a}">${bindWait === a ? 'нажмите клавишу…' : (I.bindings[a] || []).map((k) => I.keyName(k)).join(' / ')}</button></div>`).join('');
    box.querySelectorAll('.bind-key').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); bindWait = bindWait === b.dataset.action ? null : b.dataset.action; renderBinds(); }));
  }
  function bindKeyCapture(e) {
    if (!bindWait) return false;
    e.preventDefault(); e.stopPropagation();
    if (e.code === 'Escape') { bindWait = null; renderBinds(); return true; }
    const I = S3.Input; const S = S3.Settings.data;
    for (const a in I.bindings) if (a !== bindWait) I.bindings[a] = I.bindings[a].filter((k) => k !== e.code); // a key can serve one action
    I.bindings[bindWait] = [e.code]; S.bindings = JSON.parse(JSON.stringify(I.bindings)); S3.Settings.save();
    bindWait = null; renderBinds(); S3.Audio.uiClick(); return true;
  }
  function updateSettingLabels() { $$('#settings-form input[type=range]').forEach((r) => { const l = r.parentElement.querySelector('.rv'); if (l) l.textContent = r.value; }); drawCrosshairPreview(); }
  function drawCrosshairPreview() {
    const f = $('#settings-form'); const c = $('#ch-preview'); const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); ctx.fillStyle = '#4a5a6a'; ctx.fillRect(0, 0, c.width, c.height);
    const col = f.querySelector('[name=crosshairColor]').value, size = +f.querySelector('[name=crosshairSize]').value, gap = +f.querySelector('[name=crosshairGap]').value, th = +f.querySelector('[name=crosshairThick]').value, dot = f.querySelector('[name=crosshairDot]').checked;
    const cx = c.width / 2, cy = c.height / 2; ctx.fillStyle = col; ctx.fillRect(cx - gap - size, cy - th / 2, size, th); ctx.fillRect(cx + gap, cy - th / 2, size, th); ctx.fillRect(cx - th / 2, cy - gap - size, th, size); ctx.fillRect(cx - th / 2, cy + gap, th, size); if (dot) ctx.fillRect(cx - th / 2, cy - th / 2, th, th);
  }
  function applySettingsFromForm() {
    const f = $('#settings-form'); const S = S3.Settings.data;
    S.sensitivity = +f.querySelector('[name=sensitivity]').value; S.fov = +f.querySelector('[name=fov]').value; S.volume = +f.querySelector('[name=volume]').value; S.music = +f.querySelector('[name=music]').value;
    S.shadows = f.querySelector('[name=shadows]').checked; S.quality = f.querySelector('[name=quality]').value; S.crosshairColor = f.querySelector('[name=crosshairColor]').value; S.crosshairSize = +f.querySelector('[name=crosshairSize]').value; S.crosshairGap = +f.querySelector('[name=crosshairGap]').value; S.crosshairThick = +f.querySelector('[name=crosshairThick]').value; S.crosshairDot = f.querySelector('[name=crosshairDot]').checked;
    S.invertY = f.querySelector('[name=invertY]').checked; S.crouchToggle = f.querySelector('[name=crouchToggle]').checked; S.resScale = +f.querySelector('[name=resScale]').value; S.showFps = f.querySelector('[name=showFps]').checked; S.playerName = f.querySelector('[name=playerName]').value.trim() || 'Игрок'; S.hudScale = +f.querySelector('[name=hudScale]').value;
    S.voiceVolume = +f.querySelector('[name=voiceVolume]').value; S.voiceEnabled = f.querySelector('[name=voiceEnabled]').checked; S.voiceMuteOthers = f.querySelector('[name=voiceMuteOthers]').checked;
    S.radarSize = +f.querySelector('[name=radarSize]').value; S.radarZoom = +f.querySelector('[name=radarZoom]').value; S.radarRotate = f.querySelector('[name=radarRotate]').checked; S.radarSquare = f.querySelector('[name=radarSquare]').checked;
    S3.Settings.save(); S3.Audio.applyVolume(); if (game) { game.hud.applySettings(); game.player.name = S.playerName; game.renderer.shadowMap.enabled = S.shadows; game.sun.castShadow = S.shadows; game.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5) * S.resScale); game.onResize(); }
    updateSettingLabels();
  }
  function renderStats() {
    const s = S3.Stats.data; const kd = s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(2); const acc = s.shotsFired ? Math.round(s.shotsHit / s.shotsFired * 100) : 0; const hs = s.kills ? Math.round(s.headshots / s.kills * 100) : 0;
    $('#stats-body').innerHTML = `<div class="stat-grid">
      <div><b>${s.matches}</b><span>Матчей</span></div><div><b>${s.wins}</b><span>Побед</span></div><div><b>${s.losses}</b><span>Поражений</span></div>
      <div><b>${s.kills}</b><span>Убийств</span></div><div><b>${s.deaths}</b><span>Смертей</span></div><div><b>${kd}</b><span>K/D</span></div>
      <div><b>${hs}%</b><span>В голову</span></div><div><b>${acc}%</b><span>Точность</span></div><div><b>${s.bombPlants}/${s.bombDefuses}</b><span>Установок / обезвр.</span></div></div>`;
  }

  // ---- game lifecycle ----
  function startGame(extra) {
    S3.Audio.init(); S3.Audio.resume(); S3.Audio.stopMenuMusic();
    S3.MenuScene.stop(); $('#menu').style.display = 'none'; $('#hud').style.display = 'block'; $('#loading').style.display = 'flex';
    setTimeout(() => {
      try {
        const opts = Object.assign({ map: state.map, mode: state.mode, playerTeam: state.team, botsPerTeam: state.bots, difficulty: state.difficulty, rounds: state.rounds, killLimit: state.killLimit, loadout: { primary: state.primary, secondary: state.secondary } }, extra || {});
        game = new S3.Game(opts);
        window.game = game; game.onMatchOver = onMatchOver; game.onNetLost = onNetLost; game.init();
        if (game.net) S3.Voice.attach(game);
        $('#loading').style.display = 'none'; S3.Input.lock();
      } catch (e) { console.error(e); $('#loading').style.display = 'none'; alert('Ошибка запуска: ' + e.message); quitToMenu(); }
    }, 60);
  }
  function onNetLost() {
    if (!game) return;
    const wasHost = game.net && game.net.role === 'host';
    game.setPaused(true);
    if (confirm(wasHost ? 'Связь с сетевым сервером потеряна. Вернуться в меню?' : 'Хост отключился. Вернуться в меню?')) quitToMenu();
  }
  function quitToMenu() {
    S3.Voice.detach();
    if (game) { game.destroy(); game = null; window.game = null; }
    resetNetLobby();
    $('#pause').style.display = 'none'; $('#matchover').style.display = 'none'; $('#hud').style.display = 'none'; $('#menu').style.display = 'flex'; showPanel('panel-main'); S3.Audio.startMenuMusic();
    menuSceneRefresh(); S3.MenuScene.resize(); S3.MenuScene.start();
  }
  function resetNetLobby() {
    if (net.conn) { net.conn.close(); net.conn = null; } net.role = null; net.players = [];
    $('#net-lobby').style.display = 'none'; $('#net-host-status').textContent = ''; $('#net-host-status').className = 'net-status';
    $('#net-join-status').textContent = ''; $('#net-join-status').className = 'net-status';
  }
  function onMatchOver(winner, text) {
    if (!game) return; game.setPaused(true); const p = game.player; const won = winner === p.team;
    $('#mo-title').textContent = winner === null ? 'Ничья' : (won ? 'Победа!' : 'Поражение'); $('#mo-title').style.color = won ? '#6fdc6f' : (winner === null ? '#fff' : '#ff6060'); $('#mo-text').textContent = text;
    game.hud.renderScoreboard(); $('#mo-board').innerHTML = game.hud.sb.innerHTML; $('#matchover').style.display = 'flex';
    const acc = S3.Stats.data.shotsFired ? Math.round(S3.Stats.data.shotsHit / S3.Stats.data.shotsFired * 100) : 0;
    const reward = S3.Inventory.matchReward(p.kills, won, p.headshots); S3.Inventory.addGold(reward);
    $('#mo-me').innerHTML = `Ваш результат: <b>${p.kills}</b> убийств · <b>${p.deaths}</b> смертей · <b>${p.assists}</b> помощи · <b>${p.headshots}</b> в голову · MVP ×${p.mvps}<br><span class="gold">+${reward} 🪙 золота</span> за матч — потратьте в разделе «Кейсы и скины»`;
  }
  function pauseGame() { if (!game || game.over) return; game.setPaused(true); $('#pause').style.display = 'flex'; }
  function resumeGame() { if (!game) return; $('#pause').style.display = 'none'; $('#panel-settings-pause').style.display = 'none'; game.paused = false; game.lastFrame = performance.now(); S3.Input.lock(); }

  // ---- network menu ----
  // ---- version check for multiplayer: everyone should run the same build ----
  const REPO = 'Aldar67/standoff3'; let latestChecked = null;
  const verNum = (v) => String(v || '0').replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);
  const verCmp = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
  function checkLatestVersion() {
    const box = $('#net-version-warn'); box.style.display = 'none';
    const show = (html, cls) => { box.innerHTML = html; box.className = 'net-version ' + (cls || ''); box.style.display = 'block'; };
    if (latestChecked) { if (verCmp(latestChecked, S3.VERSION) > 0) show(`⬆ Доступна версия <b>${latestChecked}</b> (у вас ${S3.VERSION}). Для игры по сети у всех должна быть одна версия. <a href="https://github.com/${REPO}/releases/latest" target="_blank" rel="noopener">Скачать</a>`, 'warn'); return; }
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((j) => {
      if (!j || !j.tag_name) return; latestChecked = j.tag_name.replace(/^v/, '');
      if (verCmp(latestChecked, S3.VERSION) > 0) show(`⬆ Доступна версия <b>${latestChecked}</b> (у вас ${S3.VERSION}). Для игры по сети у всех должна быть одна версия. <a href="https://github.com/${REPO}/releases/latest" target="_blank" rel="noopener">Скачать</a>`, 'warn');
      else show(`✓ У вас последняя версия ${S3.VERSION}`, 'ok');
    }).catch(() => { });
  }
  function netTabSwitch(which) {
    $$('.net-tab').forEach((t) => t.classList.toggle('act', t.dataset.nettab === which));
    $('#net-host-pane').style.display = which === 'host' ? 'flex' : 'none';
    $('#net-join-pane').style.display = which === 'join' ? 'flex' : 'none';
    S3.Audio.uiClick();
  }
  function computeRoster() {
    const rows = [{ isHost: true, name: $('#net-host-name').value.trim() || S3.Settings.data.playerName || 'Хост' }];
    let ct = state.team === 'CT' ? 1 : 0, t = state.team === 'T' ? 1 : 0;
    rows[0].team = state.team;
    for (const p of net.players) { const team = ct <= t ? 'CT' : 'T'; rows.push({ id: p.id, name: p.name, team, ver: p.ver, skins: p.skins || {} }); if (team === 'CT') ct++; else t++; }
    return rows;
  }
  function renderNetPlayers() {
    const rows = computeRoster();
    $('#net-players').innerHTML = rows.map((p) => { const bad = !p.isHost && p.ver !== S3.VERSION; return `<div class="net-player-row ${p.isHost ? 'self' : ''}"><span>${p.name}${p.isHost ? ' (вы, хост)' : ''}${bad ? ` <span class="np-ver">⚠ версия ${p.ver} — нужна ${S3.VERSION}</span>` : ''}</span><span class="np-team ${p.team === 'CT' ? 'ct' : 't'}">${p.team}</span></div>`; }).join('');
  }
  function renderNetLobby() {
    const modes = $('#net-mode-list'); modes.innerHTML = Object.keys(S3.MODES).map((m) => `<div class="card mode ${state.mode === m ? 'sel' : ''}" data-mode="${m}"><div class="card-title">${S3.MODES[m].name}</div><div class="card-desc">${S3.MODES[m].desc}</div></div>`).join('');
    modes.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => { state.mode = c.dataset.mode; const m = MAP_LIST.find((x) => x.id === state.map); if (!m.modes.includes(state.mode)) state.map = MAP_LIST.find((x) => x.modes.includes(state.mode)).id; renderNetLobby(); S3.Audio.uiClick(); }));
    const maps = $('#net-map-list'); maps.innerHTML = MAP_LIST.map((m) => { const ok = m.modes.includes(state.mode); return `<div class="card map ${state.map === m.id ? 'sel' : ''} ${ok ? '' : 'dis'}" data-map="${m.id}"><img src="${mapPreview(m.id)}" alt=""><div class="card-title">${m.title}</div><div class="card-desc">${m.desc}</div></div>`; }).join('');
    maps.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => { if (c.classList.contains('dis')) return; state.map = c.dataset.map; renderNetLobby(); S3.Audio.uiClick(); }));
    $$('#net-team-sel .opt').forEach((o) => { o.classList.toggle('sel', o.dataset.team === state.team); o.onclick = () => { state.team = o.dataset.team; renderNetLobby(); }; });
    $$('#net-diff-sel .opt').forEach((o) => { o.classList.toggle('sel', o.dataset.diff === state.difficulty); o.onclick = () => { state.difficulty = o.dataset.diff; renderNetLobby(); }; });
    $('#net-bots-range').value = state.bots; $('#net-bots-val').textContent = state.bots;
    renderNetPlayers();
  }
  function hostConnect() {
    const name = $('#net-host-name').value.trim() || 'Хост'; const addr = $('#net-host-addr').value.trim() || 'ws://localhost:8766'; const room = $('#net-host-room').value.trim() || name; const pass = $('#net-host-pass').value;
    S3.Settings.data.playerName = name; S3.Settings.data.netHostAddr = addr; S3.Settings.save();
    const status = $('#net-host-status'); status.textContent = 'Подключение к серверу...'; status.className = 'net-status';
    const n = new S3.Net();
    n.on('hello', (msg) => { if (!net.players.find((p) => p.id === msg._from)) net.players.push({ id: msg._from, name: msg.name, ver: msg.ver || '?', skins: S3.cleanSkinMap(msg.skins) }); renderNetPlayers(); });
    n.on('leave', (id) => { net.players = net.players.filter((p) => p.id !== id); renderNetPlayers(); });
    n.connect(addr, name, true, room, pass).then(() => {
      net.conn = n; net.role = 'host';
      status.textContent = `Комната «${n.room}» создана${pass ? ' (с паролем)' : ''}. Скажите друзьям её название, настройте матч и нажмите «Начать игру».`; status.className = 'net-status ok';
      $('#net-lobby').style.display = 'block'; renderNetLobby();
    }).catch((e) => {
      status.className = 'net-status err';
      if (e.message === 'busy') status.textContent = `Комната «${room}» уже создана другим игроком. Придумайте другое название комнаты или присоединитесь к нему через вкладку «Присоединиться».`;
      else status.textContent = 'Не удалось подключиться к серверу ' + addr + ' (' + e.message + '). Проверьте адрес и что сервер запущен.';
    });
  }
  function netStartGame() {
    if (!net.conn) return;
    const roster = computeRoster(); const hostEntry = roster.find((r) => r.isHost); const others = roster.filter((r) => !r.isHost);
    net.conn.send({ t: 'ev', k: 'start', ver: S3.VERSION, map: state.map, mode: state.mode, rounds: state.rounds, killLimit: state.killLimit, timeLimit: state.mode === 'tdm' ? 600 : 900, botsPerTeam: state.bots, difficulty: state.difficulty, roster: others.map((o) => ({ id: o.id, name: o.name, team: o.team })) });
    const connForGame = net.conn; net.conn = null; // ownership moves to the Game/HostSync now
    startGame({ playerTeam: hostEntry.team, botsPerTeam: state.bots, net: { role: 'host', net: connForGame, roster: others } });
  }
  function joinConnect() {
    const name = $('#net-join-name').value.trim() || 'Игрок'; const addr = $('#net-join-addr').value.trim(); const room = $('#net-join-room').value.trim(); const pass = $('#net-join-pass').value;
    const status = $('#net-join-status');
    if (!addr) { status.textContent = 'Введите адрес хоста'; status.className = 'net-status err'; return; }
    S3.Settings.data.playerName = name; S3.Settings.data.netJoinAddr = addr; S3.Settings.save();
    status.textContent = 'Подключение...'; status.className = 'net-status';
    const n = new S3.Net(); n.skins = S3.Inventory.equippedMap();
    n.on('ev', (msg) => {
      if (msg.k === 'start') {
        if (msg.ver && msg.ver !== S3.VERSION) { status.textContent = `У хоста версия ${msg.ver}, у вас ${S3.VERSION} — обновите игру, иначе матч может работать неправильно.`; status.className = 'net-status err'; if (!confirm(`Версии не совпадают: хост ${msg.ver}, вы ${S3.VERSION}. Всё равно подключиться?`)) return; }
        const me = msg.roster.find((r) => r.id === n.myId); const connForGame = n; net.conn = null;
        startGame({ map: msg.map, mode: msg.mode, rounds: msg.rounds, killLimit: msg.killLimit, timeLimit: msg.timeLimit, botsPerTeam: msg.botsPerTeam, difficulty: msg.difficulty, net: { role: 'client', net: connForGame, myTeam: me ? me.team : 'CT' } });
      } else if (msg.k === 'toolate' && msg.for === n.myId) { status.textContent = 'Хост уже начал матч. Дождитесь следующего.'; status.className = 'net-status err'; }
    });
    n.on('hostleft', () => { if (!game) { status.textContent = 'Хост вышел. Ждём, пока кто-нибудь создаст игру...'; status.className = 'net-status'; } });
    n.on('hostset', () => { if (!game) { status.textContent = 'Хост создал игру — вы в лобби. Ожидание запуска матча...'; status.className = 'net-status ok'; } });
    n.on('badpass', () => { if (!game) { status.textContent = 'Неверный пароль комнаты.'; status.className = 'net-status err'; } });
    n.connect(addr, name, false, room, pass).then(() => { net.conn = n; net.role = 'client'; status.textContent = n.hostId !== null && n.hostId !== undefined ? `Вы в комнате «${n.room}». Ожидание запуска матча хостом...` : `Вы в комнате «${n.room}», но хост её ещё не создал — как только создаст, вы попадёте в лобби.`; status.className = 'net-status ok'; })
      .catch((e) => { status.textContent = e.message === 'badpass' ? 'Неверный пароль комнаты.' : 'Не удалось подключиться (' + e.message + ')'; status.className = 'net-status err'; });
  }
  // Desktop build (Electron): config.json carries the relay address of the owner's VPS; it becomes the default for
  // both hosting and joining so nobody has to type it (the owner's config wins over a previously typed address).
  function applyNetDefaults(cfg) {
    const S = S3.Settings.data; let def = (cfg && cfg.defaultServer && !/ВАШ_VPS/.test(cfg.defaultServer)) ? cfg.defaultServer : '';
    if (!def && window.S3_DEFAULT_SERVER) def = window.S3_DEFAULT_SERVER; // browser build: server-config.js next to index.html
    $('#net-host-addr').value = def || S.netHostAddr || 'ws://localhost:8766';
    $('#net-join-addr').value = def || S.netJoinAddr || '';
    if (def) { $('#net-host-info').innerHTML = `Адрес вашего сервера (VPS) уже подставлен: <code>${def}</code>. Нажмите «Подключиться как хост», дождитесь остальных в списке и запустите матч. Для игры по локальной сети без VPS запустите <b>Standoff3-LAN-Server.bat</b> из папки <b>server</b> и укажите <code>ws://localhost:8766</code>.`; $('#net-join-info').innerHTML = `Адрес сервера уже подставлен — впишите ник и нажмите «Подключиться», затем ждите, пока хост запустит матч.`; }
  }
  function bindDesktop() {
    const D = window.S3_DESKTOP; if (!D) { applyNetDefaults(null); return; }
    document.body.classList.add('desktop'); $('#btn-quit-app').style.display = '';
    $('#btn-quit-app').addEventListener('click', () => { if (confirm('Выйти из игры?')) D.quit(); });
    D.getConfig().then(applyNetDefaults).catch(() => applyNetDefaults(null));
  }
  function refreshRooms() {
    const addr = $('#net-join-addr').value.trim(); const box = $('#net-rooms'); if (!addr) { box.innerHTML = '<div class="dim-note">Введите адрес сервера</div>'; return; }
    box.innerHTML = '<div class="dim-note">Загрузка списка комнат...</div>';
    S3.Net.listRooms(addr).then((rooms) => {
      const open = rooms.filter((r) => r.host);
      if (!open.length) { box.innerHTML = '<div class="dim-note">Открытых комнат нет — попросите хоста создать игру, или впишите название комнаты и ждите его там.</div>'; return; }
      box.innerHTML = open.map((r) => `<div class="room-row ${r.started ? 'started' : ''}" data-room="${r.code.replace(/"/g, '&quot;')}"><span class="room-name">${r.locked ? '🔒 ' : ''}${r.code.replace(/[<>]/g, '')}</span><span class="room-info">хост: ${String(r.host).replace(/[<>]/g, '')} · игроков: ${r.players}${r.started ? ' · матч идёт' : ' · сбор'}</span></div>`).join('');
      box.querySelectorAll('.room-row').forEach((el) => el.addEventListener('click', () => { $('#net-join-room').value = el.dataset.room; box.querySelectorAll('.room-row').forEach((x) => x.classList.toggle('sel', x === el)); S3.Audio.uiClick(); }));
    }).catch((e) => { box.innerHTML = `<div class="dim-note">Не удалось получить список (${e.message})</div>`; });
  }
  function bindNetworkMenu() {
    $$('.net-tab').forEach((t) => t.addEventListener('click', () => { netTabSwitch(t.dataset.nettab); if (t.dataset.nettab === 'join') refreshRooms(); }));
    $('#btn-net-rooms').addEventListener('click', refreshRooms);
    $('#net-host-name').value = S3.Settings.data.playerName || 'Игрок'; $('#net-join-name').value = S3.Settings.data.playerName || 'Игрок';
    $('#btn-net-host-connect').addEventListener('click', hostConnect);
    $('#btn-net-start').addEventListener('click', netStartGame);
    $('#btn-net-join-connect').addEventListener('click', joinConnect);
    $('#net-bots-range').addEventListener('input', (e) => { state.bots = +e.target.value; $('#net-bots-val').textContent = state.bots; });
  }

  function toggleFullscreen() {
    if (window.S3_DESKTOP) window.S3_DESKTOP.setFullscreen(); // the window toggles based on its real state
    else if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { }); else document.exitFullscreen();
  }
  function bindMenu() {
    $('#btn-fullscreen').addEventListener('click', toggleFullscreen);
    $$('[data-panel]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.panel;
      if (id === 'panel-main' && net.conn && !game) resetNetLobby(); // leaving the network panel without starting: drop the lobby connection
      if (id === 'panel-play') renderPlay(); if (id === 'panel-settings') { renderSettings(); settingsTab(b.dataset.stab || 'video'); } if (id === 'panel-stats') renderStats();
      if (id === 'panel-network') { $('#net-host-name').value = S3.Settings.data.playerName || 'Игрок'; $('#net-join-name').value = S3.Settings.data.playerName || 'Игрок'; checkLatestVersion(); }
      if (id === 'panel-cases') S3.CasesUI.show();
      showPanel(id); menuSceneRefresh();
    }));
    bindNetworkMenu(); S3.CasesUI.bind(); S3.CasesUI.onChange = menuSceneRefresh;
    $('#btn-start').addEventListener('click', () => startGame());
    $('#bots-range').addEventListener('input', (e) => { state.bots = +e.target.value; $('#bots-val').textContent = state.bots + ' на команду'; });
    $('#settings-form').addEventListener('input', applySettingsFromForm); $('#settings-form').addEventListener('change', applySettingsFromForm);
    $$('.net-tab[data-stab]').forEach((t) => t.addEventListener('click', () => { settingsTab(t.dataset.stab); S3.Audio.uiClick(); }));
    $('#btn-binds-reset').addEventListener('click', () => { S3.Input.applyBindings({}); S3.Settings.data.bindings = {}; S3.Settings.save(); bindWait = null; renderBinds(); });
    window.addEventListener('keydown', bindKeyCapture, true);
    $('#btn-reset-stats').addEventListener('click', () => { if (confirm('Сбросить статистику?')) { Object.keys(S3.Stats.data).forEach((k) => S3.Stats.data[k] = 0); S3.Stats.save(); renderStats(); } });
    $('#btn-resume').addEventListener('click', resumeGame); $('#btn-quit').addEventListener('click', () => { if (confirm('Выйти в меню? Матч будет потерян.')) quitToMenu(); });
    $('#btn-pause-settings').addEventListener('click', () => { renderSettings(); const s = $('#panel-settings-pause'); s.style.display = s.style.display === 'block' ? 'none' : 'block'; s.appendChild($('#settings-form')); });
    $('#btn-mo-menu').addEventListener('click', quitToMenu); $('#btn-mo-again').addEventListener('click', () => { quitToMenu(); startGame(); });
    $$('.hover-snd').forEach((e) => e.addEventListener('mouseenter', () => S3.Audio.uiHover()));
    document.addEventListener('click', () => { S3.Audio.init(); S3.Audio.resume(); if (!game) S3.Audio.startMenuMusic(); }, { once: true });
    // canvas click to lock
    document.getElementById('game-canvas').addEventListener('click', () => { if (game && !game.paused && !game.hud.buyOpen && !game.over) S3.Input.lock(); });
    S3.Input.onLockChange = (locked) => { if (!game) return; if (!locked && !game.hud.buyOpen && !game.paused && !game.over && !S3.Console.isOpen()) { pauseGame(); } };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F11') { e.preventDefault(); toggleFullscreen(); return; }
      if (S3.Console.handleKey(e)) return;
      if (!game) { if (e.code === 'Escape') { if (S3.CasesUI.open) S3.CasesUI.closeModal(); else showPanel('panel-main'); } return; }
      if (game.hud.chatOpen) return; // the chat box handles its own keys
      if (!game.paused && !game.over && !game.hud.buyOpen) { const B = S3.Input.bindings; if (B.chat.includes(e.code)) { game.hud.openChat(false); e.preventDefault(); return; } if (B.teamchat.includes(e.code)) { game.hud.openChat(true); e.preventDefault(); return; } }
      if (game.hud.buyOpen) { if (game.hud.buyKey(e.code)) e.preventDefault(); return; }
      if (e.code === 'Escape' && game.paused && !game.over) { resumeGame(); return; }
      if (e.code === 'Escape' && !game.paused && !S3.Input.locked) { pauseGame(); return; }
      // radio menu (Z + number)
      if (e.code === 'KeyZ' && game.player.alive) { game.radioOpen = !game.radioOpen; game.hud.setHint(game.radioOpen ? 'Радио: ' + S3.RADIO.map((r) => r.key + '-' + r.text).join('  ') : ''); if (game.radioOpen) game.hud.hintT = -5; }
      else if (game.radioOpen && /^Digit[1-9]$/.test(e.code)) { const r = S3.RADIO.find((x) => x.key === e.code.slice(5)); if (r) { if (game.net && game.net.role === 'client') game.net.sendRadio(r.key); else game.radio(game.player, r.text); } game.radioOpen = false; game.hud.setHint(''); e.preventDefault(); }
    });
    $('#menu-version').textContent = 'v' + S3.VERSION + ' · Three.js r158 · процедурные текстуры, модели и звук';
  }
  function init() {
    S3.Settings.load(); S3.Input.applyBindings(S3.Settings.data.bindings); S3.Stats.load(); S3.Inventory.load(); bindMenu(); bindDesktop();
    try { S3.MenuScene.init($('#menu-canvas')); menuSceneRefresh(); S3.MenuScene.start(); } catch (e) { console.error('menu scene', e); }
    S3.Console.bind({
      getGame: () => game, quitToMenu,
      startMap: (map, mode) => { if (game) quitToMenu(); state.map = map; if (mode && S3.MODES[mode]) state.mode = mode; startGame(); },
      restart: () => { if (!game || game.net) return; quitToMenu(); startGame(); },
      connect: (addr) => { if (game) quitToMenu(); showPanel('panel-network'); netTabSwitch('join'); $('#net-join-addr').value = addr; joinConnect(); },
    }); renderPlay(); showPanel('panel-main'); $('#menu').style.display = 'flex';
    if (!window.THREE) { alert('Three.js не загрузился. Проверьте файл lib/three.min.js'); }
  }
  window.addEventListener('DOMContentLoaded', init);
})();
