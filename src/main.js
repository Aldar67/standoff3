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

  function showPanel(id) { $$('.panel').forEach((p) => p.classList.toggle('show', p.id === id)); S3.Audio.uiClick(); }
  function renderPlay() {
    const modes = $('#mode-list'); modes.innerHTML = Object.keys(S3.MODES).map((m) => `<div class="card mode ${state.mode === m ? 'sel' : ''}" data-mode="${m}"><div class="card-title">${S3.MODES[m].name}</div><div class="card-desc">${S3.MODES[m].desc}</div></div>`).join('');
    modes.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => { state.mode = c.dataset.mode; const m = MAP_LIST.find((x) => x.id === state.map); if (!m.modes.includes(state.mode)) state.map = MAP_LIST.find((x) => x.modes.includes(state.mode)).id; renderPlay(); S3.Audio.uiClick(); }));
    const maps = $('#map-list'); maps.innerHTML = MAP_LIST.map((m) => { const ok = m.modes.includes(state.mode); return `<div class="card map ${state.map === m.id ? 'sel' : ''} ${ok ? '' : 'dis'}" data-map="${m.id}"><img src="${mapPreview(m.id)}" alt=""><div class="card-title">${m.title}</div><div class="card-desc">${m.desc}</div></div>`; }).join('');
    maps.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => { if (c.classList.contains('dis')) return; state.map = c.dataset.map; renderPlay(); S3.Audio.uiClick(); }));
    $$('#team-sel .opt').forEach((o) => { o.classList.toggle('sel', o.dataset.team === state.team); o.onclick = () => { state.team = o.dataset.team; renderPlay(); S3.Audio.uiClick(); }; });
    $$('#diff-sel .opt').forEach((o) => { o.classList.toggle('sel', o.dataset.diff === state.difficulty); o.onclick = () => { state.difficulty = o.dataset.diff; renderPlay(); S3.Audio.uiClick(); }; });
    $('#bots-range').value = state.bots; $('#bots-val').textContent = state.bots + ' на команду';
    $('#rounds-row').style.display = state.mode === 'defuse' ? 'flex' : 'none'; $('#kills-row').style.display = (state.mode === 'tdm' || state.mode === 'ffa') ? 'flex' : 'none'; $('#loadout-row').style.display = (state.mode === 'tdm' || state.mode === 'ffa') ? 'flex' : 'none';
    $$('#rounds-sel .opt').forEach((o) => { o.classList.toggle('sel', +o.dataset.r === state.rounds); o.onclick = () => { state.rounds = +o.dataset.r; renderPlay(); }; });
    $$('#kills-sel .opt').forEach((o) => { o.classList.toggle('sel', +o.dataset.k === state.killLimit); o.onclick = () => { state.killLimit = +o.dataset.k; renderPlay(); }; });
    const prim = $('#loadout-primary'), sec = $('#loadout-secondary');
    if (!prim.options.length) { for (const cat of S3.BUY_CATEGORIES.slice(1, 5)) for (const id of cat.ids) { const o = document.createElement('option'); o.value = id; o.textContent = S3.WEAPONS[id].name; prim.appendChild(o); } for (const id of S3.BUY_CATEGORIES[0].ids) { const o = document.createElement('option'); o.value = id; o.textContent = S3.WEAPONS[id].name; sec.appendChild(o); } }
    prim.value = state.primary; sec.value = state.secondary; prim.onchange = () => state.primary = prim.value; sec.onchange = () => state.secondary = sec.value;
  }
  function renderSettings() {
    const S = S3.Settings.data; const f = $('#settings-form');
    f.querySelector('[name=sensitivity]').value = S.sensitivity; f.querySelector('[name=fov]').value = S.fov; f.querySelector('[name=volume]').value = S.volume; f.querySelector('[name=music]').value = S.music;
    f.querySelector('[name=shadows]').checked = S.shadows; f.querySelector('[name=quality]').value = S.quality; f.querySelector('[name=crosshairColor]').value = S.crosshairColor; f.querySelector('[name=crosshairSize]').value = S.crosshairSize; f.querySelector('[name=crosshairGap]').value = S.crosshairGap; f.querySelector('[name=crosshairThick]').value = S.crosshairThick; f.querySelector('[name=crosshairDot]').checked = S.crosshairDot;
    f.querySelector('[name=invertY]').checked = S.invertY; f.querySelector('[name=crouchToggle]').checked = S.crouchToggle; f.querySelector('[name=resScale]').value = S.resScale; f.querySelector('[name=showFps]').checked = S.showFps; f.querySelector('[name=playerName]').value = S.playerName; f.querySelector('[name=hudScale]').value = S.hudScale;
    updateSettingLabels();
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
    $('#menu').style.display = 'none'; $('#hud').style.display = 'block'; $('#loading').style.display = 'flex';
    setTimeout(() => {
      try {
        const opts = Object.assign({ map: state.map, mode: state.mode, playerTeam: state.team, botsPerTeam: state.bots, difficulty: state.difficulty, rounds: state.rounds, killLimit: state.killLimit, loadout: { primary: state.primary, secondary: state.secondary } }, extra || {});
        game = new S3.Game(opts);
        window.game = game; game.onMatchOver = onMatchOver; game.onNetLost = onNetLost; game.init();
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
    if (game) { game.destroy(); game = null; window.game = null; }
    resetNetLobby();
    $('#pause').style.display = 'none'; $('#matchover').style.display = 'none'; $('#hud').style.display = 'none'; $('#menu').style.display = 'flex'; showPanel('panel-main'); S3.Audio.startMenuMusic();
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
    for (const p of net.players) { const team = ct <= t ? 'CT' : 'T'; rows.push({ id: p.id, name: p.name, team, skins: p.skins || {} }); if (team === 'CT') ct++; else t++; }
    return rows;
  }
  function renderNetPlayers() {
    const rows = computeRoster();
    $('#net-players').innerHTML = rows.map((p) => `<div class="net-player-row ${p.isHost ? 'self' : ''}"><span>${p.name}${p.isHost ? ' (вы, хост)' : ''}</span><span class="np-team ${p.team === 'CT' ? 'ct' : 't'}">${p.team}</span></div>`).join('');
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
    const name = $('#net-host-name').value.trim() || 'Хост'; const addr = $('#net-host-addr').value.trim() || 'ws://localhost:8766';
    S3.Settings.data.playerName = name; S3.Settings.data.netHostAddr = addr; S3.Settings.save();
    const status = $('#net-host-status'); status.textContent = 'Подключение к серверу...'; status.className = 'net-status';
    const n = new S3.Net();
    n.on('hello', (msg) => { if (!net.players.find((p) => p.id === msg._from)) net.players.push({ id: msg._from, name: msg.name, skins: S3.cleanSkinMap(msg.skins) }); renderNetPlayers(); });
    n.on('leave', (id) => { net.players = net.players.filter((p) => p.id !== id); renderNetPlayers(); });
    n.connect(addr, name, true).then(() => {
      net.conn = n; net.role = 'host';
      status.textContent = 'Сервер подключен. Настройте матч и нажмите «Начать игру».'; status.className = 'net-status ok';
      $('#net-lobby').style.display = 'block'; renderNetLobby();
    }).catch((e) => { status.textContent = 'Не удалось подключиться — убедитесь, что запущен Standoff3-Host.bat. (' + e.message + ')'; status.className = 'net-status err'; });
  }
  function netStartGame() {
    if (!net.conn) return;
    const roster = computeRoster(); const hostEntry = roster.find((r) => r.isHost); const others = roster.filter((r) => !r.isHost);
    net.conn.send({ t: 'ev', k: 'start', map: state.map, mode: state.mode, rounds: state.rounds, killLimit: state.killLimit, timeLimit: state.mode === 'tdm' ? 600 : 900, botsPerTeam: state.bots, difficulty: state.difficulty, roster: others.map((o) => ({ id: o.id, name: o.name, team: o.team })) });
    const connForGame = net.conn; net.conn = null; // ownership moves to the Game/HostSync now
    startGame({ playerTeam: hostEntry.team, botsPerTeam: state.bots, net: { role: 'host', net: connForGame, roster: others } });
  }
  function joinConnect() {
    const name = $('#net-join-name').value.trim() || 'Игрок'; const addr = $('#net-join-addr').value.trim();
    const status = $('#net-join-status');
    if (!addr) { status.textContent = 'Введите адрес хоста'; status.className = 'net-status err'; return; }
    S3.Settings.data.playerName = name; S3.Settings.data.netJoinAddr = addr; S3.Settings.save();
    status.textContent = 'Подключение...'; status.className = 'net-status';
    const n = new S3.Net(); n.skins = S3.Inventory.equippedMap();
    n.on('ev', (msg) => {
      if (msg.k === 'start') {
        const me = msg.roster.find((r) => r.id === n.myId); const connForGame = n; net.conn = null;
        startGame({ map: msg.map, mode: msg.mode, rounds: msg.rounds, killLimit: msg.killLimit, timeLimit: msg.timeLimit, botsPerTeam: msg.botsPerTeam, difficulty: msg.difficulty, net: { role: 'client', net: connForGame, myTeam: me ? me.team : 'CT' } });
      } else if (msg.k === 'toolate' && msg.for === n.myId) { status.textContent = 'Хост уже начал матч. Дождитесь следующего.'; status.className = 'net-status err'; }
    });
    n.on('hostleft', () => { if (!game) { status.textContent = 'Хост отключился.'; status.className = 'net-status err'; } });
    n.connect(addr, name, false).then(() => { net.conn = n; net.role = 'client'; status.textContent = 'Подключено. Ожидание запуска матча хостом...'; status.className = 'net-status ok'; })
      .catch((e) => { status.textContent = 'Не удалось подключиться (' + e.message + ')'; status.className = 'net-status err'; });
  }
  // Desktop build (Electron): config.json carries the relay address of the owner's VPS; it becomes the default for
  // both hosting and joining so nobody has to type it (the owner's config wins over a previously typed address).
  function applyNetDefaults(cfg) {
    const S = S3.Settings.data; const def = (cfg && cfg.defaultServer && !/ВАШ_VPS/.test(cfg.defaultServer)) ? cfg.defaultServer : '';
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
  function bindNetworkMenu() {
    $$('.net-tab').forEach((t) => t.addEventListener('click', () => netTabSwitch(t.dataset.nettab)));
    $('#net-host-name').value = S3.Settings.data.playerName || 'Игрок'; $('#net-join-name').value = S3.Settings.data.playerName || 'Игрок';
    $('#btn-net-host-connect').addEventListener('click', hostConnect);
    $('#btn-net-start').addEventListener('click', netStartGame);
    $('#btn-net-join-connect').addEventListener('click', joinConnect);
    $('#net-bots-range').addEventListener('input', (e) => { state.bots = +e.target.value; $('#net-bots-val').textContent = state.bots; });
  }

  let fsOn = false;
  function bindMenu() {
    $$('[data-panel]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.panel;
      if (id === 'panel-main' && net.conn && !game) resetNetLobby(); // leaving the network panel without starting: drop the lobby connection
      if (id === 'panel-play') renderPlay(); if (id === 'panel-settings') renderSettings(); if (id === 'panel-stats') renderStats();
      if (id === 'panel-network') { $('#net-host-name').value = S3.Settings.data.playerName || 'Игрок'; $('#net-join-name').value = S3.Settings.data.playerName || 'Игрок'; }
      if (id === 'panel-cases') S3.CasesUI.show();
      showPanel(id);
    }));
    bindNetworkMenu(); S3.CasesUI.bind();
    $('#btn-start').addEventListener('click', () => startGame());
    $('#bots-range').addEventListener('input', (e) => { state.bots = +e.target.value; $('#bots-val').textContent = state.bots + ' на команду'; });
    $('#settings-form').addEventListener('input', applySettingsFromForm); $('#settings-form').addEventListener('change', applySettingsFromForm);
    $('#btn-reset-stats').addEventListener('click', () => { if (confirm('Сбросить статистику?')) { Object.keys(S3.Stats.data).forEach((k) => S3.Stats.data[k] = 0); S3.Stats.save(); renderStats(); } });
    $('#btn-resume').addEventListener('click', resumeGame); $('#btn-quit').addEventListener('click', () => { if (confirm('Выйти в меню? Матч будет потерян.')) quitToMenu(); });
    $('#btn-pause-settings').addEventListener('click', () => { renderSettings(); const s = $('#panel-settings-pause'); s.style.display = s.style.display === 'block' ? 'none' : 'block'; s.appendChild($('#settings-form')); });
    $('#btn-mo-menu').addEventListener('click', quitToMenu); $('#btn-mo-again').addEventListener('click', () => { quitToMenu(); startGame(); });
    $$('.hover-snd').forEach((e) => e.addEventListener('mouseenter', () => S3.Audio.uiHover()));
    document.addEventListener('click', () => { S3.Audio.init(); S3.Audio.resume(); if (!game) S3.Audio.startMenuMusic(); }, { once: true });
    // canvas click to lock
    document.getElementById('game-canvas').addEventListener('click', () => { if (game && !game.paused && !game.hud.buyOpen && !game.over) S3.Input.lock(); });
    S3.Input.onLockChange = (locked) => { if (!game) return; if (!locked && !game.hud.buyOpen && !game.paused && !game.over) { pauseGame(); } };
    window.addEventListener('keydown', (e) => {
      if (!game) { if (e.code === 'Escape') { if (S3.CasesUI.open) S3.CasesUI.closeModal(); else showPanel('panel-main'); } return; }
      if (game.hud.buyOpen) { if (game.hud.buyKey(e.code)) e.preventDefault(); return; }
      if (e.code === 'Escape' && game.paused && !game.over) { resumeGame(); return; }
      if (e.code === 'Escape' && !game.paused && !S3.Input.locked) { pauseGame(); return; }
      if (e.code === 'F11') { e.preventDefault(); if (window.S3_DESKTOP) { fsOn = !fsOn; window.S3_DESKTOP.setFullscreen(fsOn); } else if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { }); else document.exitFullscreen(); }
      // radio menu (Z + number)
      if (e.code === 'KeyZ' && game.player.alive) { game.radioOpen = !game.radioOpen; game.hud.setHint(game.radioOpen ? 'Радио: ' + S3.RADIO.map((r) => r.key + '-' + r.text).join('  ') : ''); if (game.radioOpen) game.hud.hintT = -5; }
      else if (game.radioOpen && /^Digit[1-9]$/.test(e.code)) { const r = S3.RADIO.find((x) => x.key === e.code.slice(5)); if (r) { if (game.net && game.net.role === 'client') game.net.sendRadio(r.key); else game.radio(game.player, r.text); } game.radioOpen = false; game.hud.setHint(''); e.preventDefault(); }
    });
    $('#menu-version').textContent = 'v' + S3.VERSION + ' · Three.js r158 · процедурные текстуры, модели и звук';
  }
  function init() {
    S3.Settings.load(); S3.Stats.load(); S3.Inventory.load(); bindMenu(); bindDesktop(); renderPlay(); showPanel('panel-main'); $('#menu').style.display = 'flex';
    if (!window.THREE) { alert('Three.js не загрузился. Проверьте файл lib/three.min.js'); }
  }
  window.addEventListener('DOMContentLoaded', init);
})();
