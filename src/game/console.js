// ===== Standoff 3 — developer console (` / Ё key), CS-style =====
// Commands are registered with S3.Console.register(name, help, fn). `fn(args, ctx)` receives the parsed
// arguments and { game, print }. Commands that change gameplay state are refused for network clients
// (only the host simulates) and cheats are refused whenever other humans are in the match.
'use strict';
(function () {
  const S3 = window.S3;
  const $ = (s) => document.querySelector(s);
  const cmds = {}; const history = []; let histIdx = -1; let open = false; let app = null;

  const C = S3.Console = {
    register(name, help, fn) { cmds[name] = { name, help, fn }; },
    isOpen() { return open; },
    bind(appApi) { // appApi: { getGame, startGame, quitToMenu, setJoinAddr }
      app = appApi;
      const inp = $('#console-input');
      inp.addEventListener('keydown', (e) => {
        if (e.code === 'Enter') { const s = inp.value.trim(); inp.value = ''; if (s) C.exec(s); e.preventDefault(); }
        else if (e.code === 'ArrowUp') { if (history.length) { histIdx = Math.max(0, histIdx < 0 ? history.length - 1 : histIdx - 1); inp.value = history[histIdx]; } e.preventDefault(); }
        else if (e.code === 'ArrowDown') { if (histIdx >= 0) { histIdx = Math.min(history.length, histIdx + 1); inp.value = history[histIdx] || ''; if (histIdx >= history.length) histIdx = -1; } e.preventDefault(); }
        else if (e.code === 'Tab') { const pre = inp.value.trim().toLowerCase(); const m = Object.keys(cmds).filter((k) => k.startsWith(pre)).sort(); if (m.length === 1) inp.value = m[0] + ' '; else if (m.length > 1) C.print(m.join('  '), 'dim'); e.preventDefault(); }
        else if (e.code === 'Escape' || e.code === 'Backquote') { C.toggle(false); e.preventDefault(); }
        e.stopPropagation();
      });
      $('#console').addEventListener('mousedown', (e) => { if (e.target.id === 'console') C.toggle(false); });
      C.print('Standoff 3 v' + S3.VERSION + ' — консоль. Введите help для списка команд.', 'dim');
    },
    toggle(force) {
      open = force !== undefined ? !!force : !open;
      $('#console').style.display = open ? 'flex' : 'none';
      S3.Input.blocked = open;
      if (open) { S3.Input.keys = {}; S3.Input.unlock(); setTimeout(() => $('#console-input').focus(), 0); }
      else { const g = app && app.getGame(); if (g && !g.paused && !g.over && !g.hud.buyOpen) S3.Input.lock(); }
    },
    // called from the global keydown handler; returns true if the key was consumed
    handleKey(e) {
      if (e.code === 'Backquote' && !e.ctrlKey && !e.altKey) { C.toggle(); e.preventDefault(); return true; }
      return open; // while open, every other key belongs to the input box
    },
    print(text, cls) {
      const out = $('#console-out'); const d = document.createElement('div'); d.className = 'con-line ' + (cls || ''); d.textContent = text; out.appendChild(d);
      while (out.children.length > 400) out.firstChild.remove(); out.scrollTop = out.scrollHeight;
    },
    exec(line) {
      history.push(line); if (history.length > 100) history.shift(); histIdx = -1;
      C.print('> ' + line, 'echo');
      const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g) || []; const name = (parts.shift() || '').toLowerCase(); const args = parts.map((p) => p.replace(/^"|"$/g, ''));
      const c = cmds[name]; if (!c) { C.print(`Неизвестная команда: ${name}. help — список команд.`, 'err'); S3.Audio.error(); return; }
      try { const r = c.fn(args, { game: app && app.getGame(), print: C.print }); if (typeof r === 'string') C.print(r); } catch (e) { C.print('Ошибка: ' + e.message, 'err'); console.error(e); }
    },
  };

  // ---------- helpers ----------
  const game = (ctx) => { if (!ctx.game) throw new Error('Команда работает только во время матча'); return ctx.game; };
  const authority = (ctx) => { const g = game(ctx); if (g.net && g.net.role === 'client') throw new Error('Вы клиент — этим управляет хост'); return g; };
  const cheat = (ctx) => { const g = authority(ctx); if (g.net && g.net.role === 'host' && Object.keys(g.net.remotes).length) throw new Error('Читы отключены, когда в матче есть другие игроки'); return g; };
  const num = (s, def) => { const v = parseFloat(s); return isNaN(v) ? def : v; };
  const findActor = (g, name) => g.actors.find((a) => a.name.toLowerCase() === (name || '').toLowerCase());

  // ---------- commands ----------
  C.register('help', 'список команд', (a) => { const names = Object.keys(cmds).filter((k) => !cmds[k].hidden).sort(); if (a[0] && cmds[a[0]]) return `${a[0]} — ${cmds[a[0]].help}`; for (const n of names) C.print(`${n.padEnd(18)} ${cmds[n].help}`); });
  C.register('clear', 'очистить консоль', () => { $('#console-out').innerHTML = ''; });
  C.register('version', 'версия игры', () => `Standoff 3 v${S3.VERSION}`);
  C.register('echo', 'вывести текст', (a) => a.join(' '));
  C.register('quit', 'выйти из игры (в меню, а в exe — закрыть)', () => { if (window.S3_DESKTOP) window.S3_DESKTOP.quit(); else app.quitToMenu(); });
  C.register('disconnect', 'покинуть матч и вернуться в меню', () => { C.toggle(false); app.quitToMenu(); });
  C.register('connect', 'connect ws://адрес:8766 — подключиться к серверу как игрок', (a) => { if (!a[0]) throw new Error('Укажите адрес'); C.toggle(false); app.connect(a[0]); return 'Подключение к ' + a[0]; });
  C.register('map', 'map <sandstone|rust|province|arena> [режим] — начать матч на карте', (a) => { if (!a[0] || !S3.MAPS[a[0]]) throw new Error('Карты: ' + Object.keys(S3.MAPS).join(', ')); C.toggle(false); app.startMap(a[0], a[1]); });
  C.register('restart', 'перезапустить текущий матч', (a, ctx) => { const g = authority(ctx); C.toggle(false); app.restart(); });
  C.register('status', 'список игроков', (a, ctx) => { const g = game(ctx); for (const p of g.actors) C.print(`${(p.isBot ? '[бот] ' : (p.isLocal ? '[вы]  ' : '[игрок]')).padEnd(8)} ${p.name.padEnd(16)} ${p.team.padEnd(3)} ${p.kills}/${p.deaths}  ${p.alive ? 'жив' : 'мёртв'}${p.isBot ? '  ' + p.diffName : ''}`); return `Всего: ${g.actors.length}, карта ${g.opts.map}, режим ${g.mode.id}`; });
  C.register('timeleft', 'время до конца раунда/матча', (a, ctx) => { const g = game(ctx); const st = g.mode.hudState(); return `Таймер: ${st.timer}${st.roundLabel ? ' · ' + st.roundLabel : ''}`; });
  C.register('say', 'say <текст> — написать в чат', (a, ctx) => { const g = game(ctx); const t = a.join(' '); if (!t) return; if (g.net && g.net.role === 'client') g.net.sendChat ? g.net.sendChat(t) : g.hud.addChat(`<b>${g.player.name}:</b> ${t}`); else g.chatFrom(g.player, t); });
  C.register('radio', 'radio <1-9> — радио-команда', (a, ctx) => { const g = game(ctx); const r = S3.RADIO.find((x) => x.key === a[0]); if (!r) throw new Error('radio 1..9'); if (g.net && g.net.role === 'client') g.net.sendRadio(r.key); else g.radio(g.player, r.text); });
  C.register('kill', 'умереть (для теста / чтобы сменить бота)', (a, ctx) => { const g = authority(ctx); if (g.player.alive) g.player.takeDamage(9999, null, 'body', 'fall', 0, 0, { ignoreArmor: true }); });
  C.register('bot_takeover', 'взять под управление бота, за которым наблюдаете (то же, что E после смерти)', (a, ctx) => { const g = game(ctx); if (!g.requestTakeover(g.player)) throw new Error('Нужно быть мёртвым и наблюдать за живым ботом своей команды'); C.toggle(false); });
  C.register('bot_add', 'bot_add [ct|t] [easy|medium|hard|expert] — добавить бота', (a, ctx) => { const g = authority(ctx); const team = (a[0] || '').toUpperCase() === 'T' ? 'T' : (a[0] || '').toUpperCase() === 'CT' ? 'CT' : null; const b = g.addBot(team, a[1]); return `Добавлен бот ${b.name} (${b.team}, ${b.diffName})`; });
  C.register('bot_kick', 'bot_kick <имя|all> — убрать бота', (a, ctx) => { const g = authority(ctx); if ((a[0] || '').toLowerCase() === 'all') { const n = g.bots.length; for (const b of g.bots.slice()) g.kickBot(b); return `Убрано ботов: ${n}`; } const b = findActor(g, a[0]); if (!b || !b.isBot) throw new Error('Нет такого бота (см. status)'); g.kickBot(b); return `Бот ${b.name} убран`; });
  C.register('bot_difficulty', 'bot_difficulty <easy|medium|hard|expert> — сложность всех ботов', (a, ctx) => { const g = authority(ctx); if (!S3.DIFFICULTY[a[0]]) throw new Error('easy | medium | hard | expert'); for (const b of g.bots) { b.diffName = a[0]; b.diff = S3.DIFFICULTY[a[0]]; b.compensation = { easy: 0.25, medium: 0.5, hard: 0.75, expert: 0.92 }[a[0]]; } return `Сложность ботов: ${S3.DIFFICULTY[a[0]].name}`; });
  C.register('give', 'give <оружие> — выдать оружие (чит). Например give awm', (a, ctx) => { const g = cheat(ctx); if (!S3.WEAPONS[a[0]]) throw new Error('Оружие: ' + Object.keys(S3.WEAPONS).join(', ')); g.player.giveWeapon(a[0], false); return 'Выдано: ' + S3.WEAPONS[a[0]].name; });
  C.register('money', 'money <сумма> — установить деньги (чит)', (a, ctx) => { const g = cheat(ctx); g.player.money = Math.max(0, Math.min(S3.ECON.maxMoney, num(a[0], 16000))); return '$' + g.player.money; });
  C.register('hp', 'hp <число> — здоровье (чит)', (a, ctx) => { const g = cheat(ctx); g.player.health = Math.max(1, Math.min(100, num(a[0], 100))); return 'HP ' + g.player.health; });
  C.register('armor', 'armor — броня и шлем (чит)', (a, ctx) => { const g = cheat(ctx); g.player.armor = 100; g.player.helmet = true; return 'Броня 100 + шлем'; });
  C.register('god', 'god — бессмертие вкл/выкл (чит)', (a, ctx) => { const g = cheat(ctx); g.player.god = !g.player.god; return 'Бессмертие: ' + (g.player.god ? 'вкл' : 'выкл'); });
  C.register('respawn', 'respawn — возродиться (чит)', (a, ctx) => { const g = cheat(ctx); if (!g.player.alive) { g.spawnActor(g.player, true); if (!g.player.inv.secondary) g.player.giveWeapon('usp', true); } });
  C.register('noclip', 'noclip — полёт сквозь стены вкл/выкл (чит)', (a, ctx) => { const g = cheat(ctx); g.player.noclip = !g.player.noclip; return 'Noclip: ' + (g.player.noclip ? 'вкл' : 'выкл'); });
  C.register('sensitivity', 'sensitivity <0.2-4> — чувствительность мыши', (a) => { const S = S3.Settings.data; if (a[0] !== undefined) { S.sensitivity = Math.max(0.2, Math.min(4, num(a[0], S.sensitivity))); S3.Settings.save(); } return 'sensitivity ' + S.sensitivity; });
  C.register('fov', 'fov <60-110> — поле зрения', (a, ctx) => { const S = S3.Settings.data; if (a[0] !== undefined) { S.fov = Math.max(60, Math.min(110, num(a[0], S.fov))); S3.Settings.save(); } return 'fov ' + S.fov; });
  C.register('volume', 'volume <0-1> — громкость', (a) => { const S = S3.Settings.data; if (a[0] !== undefined) { S.volume = Math.max(0, Math.min(1, num(a[0], S.volume))); S3.Settings.save(); S3.Audio.applyVolume(); } return 'volume ' + S.volume; });
  C.register('name', 'name <ник> — сменить ник', (a, ctx) => { const S = S3.Settings.data; if (a[0]) { S.playerName = a.join(' ').slice(0, 16); S3.Settings.save(); if (ctx.game) ctx.game.player.name = S.playerName; } return 'name ' + S.playerName; });
  C.register('fps', 'fps — показать/скрыть счётчик FPS', (a, ctx) => { const S = S3.Settings.data; S.showFps = !S.showFps; S3.Settings.save(); if (ctx.game) ctx.game.hud.applySettings(); return 'FPS: ' + (S.showFps ? 'показан' : 'скрыт'); });
  C.register('crosshair_color', 'crosshair_color <#hex> — цвет прицела', (a, ctx) => { const S = S3.Settings.data; if (/^#[0-9a-f]{6}$/i.test(a[0] || '')) { S.crosshairColor = a[0]; S3.Settings.save(); if (ctx.game) ctx.game.hud.applySettings(); } return 'crosshair_color ' + S.crosshairColor; });
  // secret: +20000 gold (not listed in help)
  C.register('kalda', '', () => { S3.Inventory.addGold(20000); S3.Audio.levelUp(); if (S3.CasesUI) S3.CasesUI.refreshGold(); return '💰 +20000 золота! Баланс: ' + S3.Inventory.data.gold; }); cmds.kalda.hidden = true;
  C.register('gold', 'gold — золото и открытые кейсы', () => `Золото: ${S3.Inventory.data.gold} · открыто кейсов: ${S3.Inventory.data.opened} · скинов: ${Object.values(S3.Inventory.data.items).reduce((x, y) => x + y, 0)}`);
  C.register('skins', 'skins [оружие] — список ваших скинов', (a) => { const inv = S3.Inventory; const ids = Object.keys(inv.data.items).filter((id) => !a[0] || S3.SKINS[id].weapon === a[0]); if (!ids.length) return 'Скинов нет'; for (const id of ids) C.print(`${id.padEnd(22)} ${S3.SKINS[id].name}${inv.isEquipped(id) ? '  [надет]' : ''}`); });
  C.register('skin', 'skin <id> — надеть скин из инвентаря (id из команды skins)', (a) => { if (!S3.Inventory.equip(a[0])) throw new Error('Нет такого скина в инвентаре'); return 'Надет: ' + S3.SKINS[a[0]].name; });
})();
