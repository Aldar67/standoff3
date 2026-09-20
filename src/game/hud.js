// ===== Standoff 3 — HUD (DOM overlay): crosshair, stats, radar, killfeed, buy menu, scoreboard =====
'use strict';
(function () {
  const S3 = window.S3;
  const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
  const WEAPON_ICON = { knife: '🔪', he: '💣', flash: '✨', smoke: '☁', molotov: '🔥', bomb: '🧨' };
  function wIcon(id) { const w = S3.WEAPONS[id]; if (!w) return id; if (WEAPON_ICON[id]) return WEAPON_ICON[id]; return w.name; }

  class HUD {
    constructor(game) {
      this.game = game; const root = document.getElementById('hud'); root.innerHTML = ''; this.root = root;
      // overlays
      this.hurt = el('div', 'hurt-overlay', root); this.flash = el('div', 'flash-overlay', root); this.scope = el('div', 'scope-overlay', root); this.scope.innerHTML = '<div class="scope-circle"></div><div class="scope-h"></div><div class="scope-v"></div>';
      this.burn = el('div', 'burn-overlay', root);
      // crosshair
      this.cross = el('div', 'crosshair', root); this.cross.innerHTML = '<div class="ch l"></div><div class="ch r"></div><div class="ch t"></div><div class="ch b"></div><div class="ch dot"></div>';
      this.hitmarker = el('div', 'hitmarker', root); this.hitmarker.innerHTML = '<div></div><div></div><div></div><div></div>';
      this.dmgRoot = el('div', 'dmg-root', root);
      // top bar
      this.top = el('div', 'hud-top', root);
      this.top.innerHTML = '<div class="score ct"><span class="lbl">CT</span><span class="num" id="score-ct">0</span></div><div class="timer-box"><div class="timer" id="timer">1:55</div><div class="round" id="round-lbl">Раунд 1</div></div><div class="score t"><span class="num" id="score-t">0</span><span class="lbl">T</span></div>';
      this.scoreCT = this.top.querySelector('#score-ct'); this.scoreT = this.top.querySelector('#score-t'); this.timer = this.top.querySelector('#timer'); this.roundLbl = this.top.querySelector('#round-lbl');
      this.aliveBar = el('div', 'alive-bar', root); this.aliveBar.innerHTML = '<div class="alive ct" id="alive-ct"></div><div class="alive t" id="alive-t"></div>'; this.aliveCT = this.aliveBar.querySelector('#alive-ct'); this.aliveT = this.aliveBar.querySelector('#alive-t');
      // radar
      this.radarBox = el('div', 'radar-box', root); this.radar = el('canvas', 'radar', this.radarBox); this.radar.width = 200; this.radar.height = 200; this.rctx = this.radar.getContext('2d');
      this.radarName = el('div', 'radar-name', this.radarBox, '');
      // killfeed
      this.feed = el('div', 'killfeed', root);
      // bottom left: health/armor
      this.bl = el('div', 'hud-bl', root);
      this.bl.innerHTML = '<div class="stat hp"><span class="ico">✚</span><div class="bar"><div class="fill" id="hp-fill"></div></div><span class="val" id="hp-val">100</span></div><div class="stat ar"><span class="ico">⛨</span><div class="bar"><div class="fill" id="ar-fill"></div></div><span class="val" id="ar-val">0</span></div>';
      this.hpFill = this.bl.querySelector('#hp-fill'); this.hpVal = this.bl.querySelector('#hp-val'); this.arFill = this.bl.querySelector('#ar-fill'); this.arVal = this.bl.querySelector('#ar-val');
      // chat
      this.chat = el('div', 'chat', root);
      // bottom right: ammo + weapon
      this.br = el('div', 'hud-br', root);
      this.br.innerHTML = '<div class="money" id="money">$800</div><div class="weapon-name" id="weapon-name">Нож</div><div class="ammo"><span class="mag" id="ammo-mag">30</span><span class="sep">/</span><span class="res" id="ammo-res">90</span></div><div class="slots" id="slots"></div>';
      this.money = this.br.querySelector('#money'); this.weaponName = this.br.querySelector('#weapon-name'); this.ammoMag = this.br.querySelector('#ammo-mag'); this.ammoRes = this.br.querySelector('#ammo-res'); this.slots = this.br.querySelector('#slots');
      // center messages
      this.banner = el('div', 'banner', root); this.bannerT = 0; this.sub = el('div', 'banner-sub', root);
      this.hint = el('div', 'center-hint', root); this.progress = el('div', 'progress', root); this.progress.innerHTML = '<div class="plabel"></div><div class="pbar"><div class="pfill"></div></div>';
      this.bombInd = el('div', 'bomb-ind', root, '🧨');
      this.spectate = el('div', 'spectate', root);
      this.fps = el('div', 'fps', root);
      this.levelInd = el('div', 'level-ind', root);
      // scoreboard
      this.sb = el('div', 'scoreboard', root); this.sbVisible = false;
      // buy menu
      this.buy = el('div', 'buymenu', root); this.buyOpen = false; this.buyCat = 0;
      this.pauseHint = el('div', 'pause-hint', root, 'Нажмите, чтобы продолжить');
      this.applySettings();
      this.hitT = 0; this.lastHp = 100; this.bannerTimer = null; this.feedItems = [];
      this.visible = true;
    }
    applySettings() {
      const S = S3.Settings.data; const c = S.crosshairColor; const size = S.crosshairSize, gap = S.crosshairGap, th = S.crosshairThick;
      this.cross.style.setProperty('--cc', c); this.cross.style.setProperty('--cs', size + 'px'); this.cross.style.setProperty('--cg', gap + 'px'); this.cross.style.setProperty('--ct', th + 'px');
      this.cross.querySelector('.dot').style.display = S.crosshairDot ? 'block' : 'none';
      this.root.style.setProperty('--hudscale', S.hudScale); this.fps.style.display = S.showFps ? 'block' : 'none';
    }
    setVisible(v) { this.visible = v; this.root.style.display = v ? 'block' : 'none'; }
    // ---- feedback ----
    hitmarkerShow(head, kill) { this.hitmarker.className = 'hitmarker show' + (head ? ' head' : '') + (kill ? ' kill' : ''); this.hitT = 0.18; }
    damageIndicator(angle) { const d = el('div', 'dmg-ind', this.dmgRoot); d.style.transform = `translate(-50%,-50%) rotate(${-angle}rad)`; setTimeout(() => d.remove(), 900); }
    killfeed(att, vic, weaponId, headshot, extra) {
      const item = el('div', 'kf', this.feed);
      const aName = att ? `<span style="color:${S3.TEAM_COLOR_CSS[att.team]}">${att.name}</span>` : '';
      const wName = weaponId === 'he' ? '💣' : weaponId === 'molotov' ? '🔥' : weaponId === 'bomb' ? '🧨' : weaponId === 'fall' ? '⤓' : weaponId === 'knife' ? '🔪' : (S3.WEAPONS[weaponId] ? S3.WEAPONS[weaponId].name : weaponId);
      item.innerHTML = `${aName} <span class="kf-w">${wName}${headshot ? ' <b class="hs">HS</b>' : ''}</span> <span style="color:${S3.TEAM_COLOR_CSS[vic.team]}">${vic.name}</span>${extra ? ' ' + extra : ''}`;
      if (att && att.isLocal) item.classList.add('mine'); if (vic.isLocal) item.classList.add('me');
      this.feedItems.push(item); if (this.feedItems.length > 6) { const old = this.feedItems.shift(); old.remove(); }
      setTimeout(() => { item.classList.add('fade'); setTimeout(() => { item.remove(); const i = this.feedItems.indexOf(item); if (i >= 0) this.feedItems.splice(i, 1); }, 500); }, 6000);
    }
    showBanner(text, sub, dur, color) {
      this.banner.textContent = text; this.banner.style.color = color || '#fff'; this.banner.classList.add('show'); this.sub.textContent = sub || ''; this.sub.classList.toggle('show', !!sub);
      if (this.bannerTimer) clearTimeout(this.bannerTimer); this.bannerTimer = setTimeout(() => { this.banner.classList.remove('show'); this.sub.classList.remove('show'); }, (dur || 3) * 1000);
    }
    addChat(html, cls) { const m = el('div', 'chat-msg ' + (cls || ''), this.chat); m.innerHTML = html; setTimeout(() => { m.classList.add('fade'); setTimeout(() => m.remove(), 600); }, 9000); while (this.chat.children.length > 7) this.chat.firstChild.remove(); }
    setHint(text) { this.hint.textContent = text || ''; this.hint.style.display = text ? 'block' : 'none'; }
    setProgress(label, frac) { if (frac === null || frac === undefined) { this.progress.style.display = 'none'; return; } this.progress.style.display = 'block'; this.progress.querySelector('.plabel').textContent = label; this.progress.querySelector('.pfill').style.width = (frac * 100) + '%'; }
    // ---- scoreboard ----
    toggleScoreboard(v) { this.sbVisible = v; this.sb.style.display = v ? 'block' : 'none'; if (v) this.renderScoreboard(); }
    renderScoreboard() {
      const g = this.game; const mode = g.mode;
      const roleLabel = (a) => a.isBot ? ((S3.DIFFICULTY[a.diffName] || {}).name || '') : (a.isLocal ? 'Вы' : 'Игрок');
      const rows = (team) => g.actors.filter((a) => a.team === team).sort((a, b) => b.score - a.score || b.kills - a.kills).map((a) => `<tr class="${a.isLocal ? 'me' : ''} ${a.alive ? '' : 'dead'}"><td>${a.name}${a.hasBomb ? ' 🧨' : ''}${a.defuser ? ' 🧰' : ''}</td><td>${a.kills}</td><td>${a.assists}</td><td>${a.deaths}</td><td>${a.score}</td><td>${mode.freeBuy ? '-' : S3.fmtMoney(a.money)}</td><td>${roleLabel(a)}</td></tr>`).join('');
      const head = '<tr><th>Имя</th><th>У</th><th>П</th><th>С</th><th>Очки</th><th>$</th><th></th></tr>';
      const ffa = mode.id === 'ffa';
      const allRows = ffa ? g.actors.slice().sort((a, b) => b.kills - a.kills).map((a) => `<tr class="${a.isLocal ? 'me' : ''} ${a.alive ? '' : 'dead'}"><td>${a.name}</td><td>${a.kills}</td><td>${a.assists}</td><td>${a.deaths}</td><td>${a.score}</td><td>-</td><td>${roleLabel(a)}</td></tr>`).join('') : '';
      this.sb.innerHTML = `<div class="sb-head"><div class="sb-title">${g.map.def.title} — ${S3.MODES[mode.id].name}</div><div class="sb-score">${ffa ? '' : `<span class="ct">${S3.TEAM_NAME.CT}: ${mode.score.CT}</span> — <span class="t">${S3.TEAM_NAME.T}: ${mode.score.T}</span>`}</div></div>` +
        (ffa ? `<table class="sb-table">${head}${allRows}</table>` : `<table class="sb-table ct"><caption>${S3.TEAM_NAME.CT}</caption>${head}${rows('CT')}</table><table class="sb-table t"><caption>${S3.TEAM_NAME.T}</caption>${head}${rows('T')}</table>`);
    }
    // ---- buy menu ----
    toggleBuy(force) {
      const open = force !== undefined ? force : !this.buyOpen; const g = this.game;
      if (open && !g.mode.canBuy(g.player)) { this.addChat('<span class="sys">Покупка сейчас недоступна</span>'); S3.Audio.error(); return; }
      this.buyOpen = open; this.buy.style.display = open ? 'flex' : 'none';
      if (open) { this.renderBuy(); S3.Input.unlock(); S3.Audio.uiClick(); } else { S3.Input.lock(); }
      if (g.net && g.net.role === 'client') g.net.sendBuyOpen(open);
    }
    renderBuy() {
      const g = this.game, p = g.player; const cats = S3.BUY_CATEGORIES; const free = g.mode.freeBuy;
      let html = `<div class="buy-head"><span>МАГАЗИН</span><span class="buy-money">${free ? 'Бесплатно' : S3.fmtMoney(p.money)}</span><span class="buy-close" data-close="1">✕ (B)</span></div><div class="buy-body"><div class="buy-cats">`;
      cats.forEach((c, i) => { html += `<div class="buy-cat ${i === this.buyCat ? 'act' : ''}" data-cat="${i}"><span class="key">${i + 1}</span>${c.name}</div>`; });
      html += '</div><div class="buy-items">';
      const cat = cats[this.buyCat];
      cat.ids.forEach((id, i) => {
        const w = S3.WEAPONS[id], gear = S3.GEAR[id]; const name = w ? w.name : gear.name; const price = w ? w.price : gear.price;
        const owned = w && ((w.slot === 'primary' && p.inv.primary && p.inv.primary.id === id) || (w.slot === 'secondary' && p.inv.secondary && p.inv.secondary.id === id) || (w.type === 'grenade' && p.hasGrenade(id) && p.hasGrenade(id).count >= (w.max || 1)));
        const can = free || p.money >= price; const stats = w && w.damage !== undefined && w.type !== 'grenade' ? `<div class="bi-stats">Урон ${w.damage}${w.pellets ? '×' + w.pellets : ''} · ${w.rpm ? Math.round(w.rpm) + ' в/мин' : ''} · Маг ${w.mag}</div>` : (w && w.type === 'grenade' ? `<div class="bi-stats">${w.id === 'he' ? 'Урон ' + w.damage : w.id === 'flash' ? 'Ослепляет' : w.id === 'smoke' ? 'Дым ' + w.duration + 'с' : 'Огонь ' + w.duration + 'с'}</div>` : '');
        html += `<div class="buy-item ${owned ? 'owned' : ''} ${can ? '' : 'poor'}" data-id="${id}"><span class="key">${i + 1}</span><div class="bi-main"><div class="bi-name">${name}</div>${stats}</div><div class="bi-price">${free ? '' : S3.fmtMoney(price)}</div>${w && w.type !== 'grenade' && w.slot !== 'melee' ? `<div class="bi-icon">${this.weaponSvg(w)}</div>` : ''}</div>`;
      });
      html += '</div></div><div class="buy-foot">Цифры 1-7 — категория, затем 1-7 — предмет. Esc/B — закрыть. Колёсико/клик — купить.</div>';
      this.buy.innerHTML = html;
      this.buy.querySelectorAll('.buy-cat').forEach((c) => c.addEventListener('click', () => { this.buyCat = +c.dataset.cat; this.renderBuy(); S3.Audio.uiClick(); }));
      this.buy.querySelectorAll('.buy-item').forEach((c) => c.addEventListener('click', () => this.tryBuy(c.dataset.id)));
      this.buy.querySelector('[data-close]').addEventListener('click', () => this.toggleBuy(false));
    }
    weaponSvg(w) { const len = Math.min(80, 30 + (w.type === 'sniper' ? 50 : w.type === 'rifle' || w.type === 'mg' ? 40 : w.type === 'shotgun' ? 42 : w.type === 'smg' ? 26 : 12)); return `<svg width="90" height="24" viewBox="0 0 90 24"><rect x="4" y="9" width="${len}" height="6" rx="2" fill="#cfd6e0"/><rect x="${len - 6}" y="9" width="8" height="12" rx="1" fill="#9aa3b0"/><rect x="${Math.max(10, len * 0.45)}" y="14" width="6" height="8" rx="1" fill="#9aa3b0"/></svg>`; }
    tryBuy(id) {
      const g = this.game, p = g.player; const r = p.buy(id);
      if (r.ok) { S3.Audio.buy(); const w = S3.WEAPONS[id]; if (!w) S3.Audio.armorEquip(); this.renderBuy(); if (g.net && g.net.role === 'client') g.net.sendBuy(id); } else { S3.Audio.error(); this.addChat(`<span class="sys">${r.reason}</span>`); }
    }
    buyKey(code) {
      if (!this.buyOpen) return false;
      const n = /^Digit([1-9])$/.exec(code); if (!n) { if (code === 'Escape' || code === 'KeyB') { this.toggleBuy(false); return true; } return false; }
      const k = +n[1] - 1;
      if (this.buyPick === undefined) { if (k < S3.BUY_CATEGORIES.length) { this.buyCat = k; this.buyPick = true; this.renderBuy(); } }
      else { const ids = S3.BUY_CATEGORIES[this.buyCat].ids; if (k < ids.length) this.tryBuy(ids[k]); this.buyPick = undefined; }
      return true;
    }
    // ---- radar ----
    drawRadar() {
      const g = this.game, p = g.player, map = g.map; const ctx = this.rctx; const S = 200; const R = S / 2; const scale = 4.2; // px per meter
      ctx.clearRect(0, 0, S, S); ctx.save(); ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = 'rgba(8,12,18,0.85)'; ctx.fillRect(0, 0, S, S);
      const cam = p.alive || !p.spectateTarget ? p : p.spectateTarget; const px = cam.pos.x, pz = cam.pos.z, yaw = cam.yaw;
      ctx.translate(R, R); ctx.rotate(yaw); ctx.scale(scale, scale); ctx.translate(-px, -pz);
      // minimap image: world coords -> image coords
      const ms = map.minimapScale; const b = map.bounds; const imgW = map.minimap.width;
      ctx.drawImage(map.minimap, 0, 0, imgW, imgW, b.xmin, b.zmin, imgW / ms, imgW / ms);
      // sites
      ctx.font = 'bold 4px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const s of map.sites) { ctx.save(); ctx.translate(s.cx, s.cz); ctx.rotate(-yaw); ctx.fillStyle = 'rgba(255,220,100,0.95)'; ctx.fillText(s.name, 0, 0); ctx.restore(); }
      // bomb
      const mode = g.mode;
      if (mode.bombPlanted && mode.bombPos) { ctx.save(); ctx.translate(mode.bombPos.x, mode.bombPos.z); ctx.rotate(-yaw); ctx.fillStyle = (Math.floor(g.time * 4) % 2) ? '#ff3030' : '#ffa030'; ctx.beginPath(); ctx.arc(0, 0, 1.2, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      else if (mode.bombDropped) { ctx.save(); ctx.translate(mode.bombDropped.pos.x, mode.bombDropped.pos.z); ctx.rotate(-yaw); ctx.fillStyle = '#ffd040'; ctx.fillRect(-0.8, -0.8, 1.6, 1.6); ctx.restore(); }
      // actors
      for (const a of g.actors) {
        if (a === cam) continue; const mate = a.team === p.team && mode.id !== 'ffa';
        let show = mate || (a.alive && g.visibleToTeam(a, p.team)) ; if (!a.alive && !mate) continue;
        if (!show) continue;
        ctx.save(); ctx.translate(a.pos.x, a.pos.z); ctx.rotate(-yaw);
        if (!a.alive) { ctx.fillStyle = 'rgba(200,200,200,0.5)'; ctx.font = 'bold 3px Arial'; ctx.fillText('✕', 0, 0); ctx.restore(); continue; }
        ctx.rotate(yaw); ctx.rotate(-a.yaw);
        ctx.fillStyle = mate ? (a.hasBomb ? '#ffd040' : '#4aa0ff') : '#ff4040'; ctx.beginPath(); ctx.moveTo(0, -1.6); ctx.lineTo(1.0, 0.9); ctx.lineTo(-1.0, 0.9); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      // player arrow
      ctx.save(); ctx.translate(R, R); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.restore();
      // view cone
      ctx.save(); ctx.translate(R, R); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.stroke();
    }
    // ---- per-frame ----
    update(dt) {
      const g = this.game, p = g.player, mode = g.mode; const w = p.current;
      // health/armor
      const hp = Math.max(0, Math.round(p.health)); this.hpVal.textContent = hp; this.hpFill.style.width = hp + '%'; this.hpFill.style.background = hp > 50 ? '#5fd35f' : (hp > 25 ? '#e8c040' : '#e04040');
      this.arVal.textContent = Math.round(p.armor) + (p.helmet ? ' ⛑' : ''); this.arFill.style.width = Math.round(p.armor) + '%';
      this.hurt.style.opacity = Math.min(0.8, p.hitFlash * 0.9 + (hp < 30 && p.alive ? (0.25 + Math.sin(g.time * 6) * 0.1) : 0));
      this.flash.style.opacity = p.flashT > 0 ? S3.clamp(p.flashT / Math.max(0.5, p.flashMax) * 1.4, 0, 1) : 0;
      this.burn.style.opacity = p.burnT > 0 ? 0.6 : 0;
      // scope
      const scoped = p.scoped && w && w.def.scope && p.alive; this.scope.style.display = scoped ? 'block' : 'none'; this.cross.style.display = scoped || !p.alive || this.buyOpen ? 'none' : 'block';
      // crosshair spread
      if (w) { const sp = w.isGun ? w.spread({ speedFrac: p.speedFrac, onGround: p.body.onGround, crouching: p.crouching, scoped: p.scoped }) : 0; this.cross.style.setProperty('--cg', (S3.Settings.data.crosshairGap + sp * 6) + 'px'); }
      // ammo / weapon
      if (w) {
        this.weaponName.textContent = w.def.name + (w.def.type === 'grenade' ? ' ×' + w.count : '');
        if (w.isGun) { this.ammoMag.textContent = w.ammo; this.ammoRes.textContent = w.reserve; this.ammoMag.style.color = w.ammo === 0 ? '#e04040' : (w.ammo <= w.def.mag * 0.25 ? '#e8c040' : '#fff'); this.br.classList.toggle('reloading', w.reloading); }
        else { this.ammoMag.textContent = w.def.type === 'grenade' ? w.count : '—'; this.ammoRes.textContent = ''; this.br.classList.remove('reloading'); }
      }
      this.money.textContent = mode.freeBuy ? '' : S3.fmtMoney(p.money);
      // slots
      let sh = ''; const inv = p.inv;
      const slot = (n, ww, label) => { if (!ww) return ''; return `<div class="slot ${ww === w ? 'act' : ''}"><span class="k">${n}</span>${label}</div>`; };
      sh += slot(1, inv.primary, inv.primary ? inv.primary.def.name : ''); sh += slot(2, inv.secondary, inv.secondary ? inv.secondary.def.name : ''); sh += slot(3, inv.melee, '🔪');
      for (const gr of inv.grenades) sh += `<div class="slot ${gr === w ? 'act' : ''}"><span class="k">4</span>${WEAPON_ICON[gr.id]}${gr.count > 1 ? '×' + gr.count : ''}</div>`;
      if (inv.bomb) sh += slot(5, inv.bomb, '🧨');
      if (this.slots.innerHTML !== sh) this.slots.innerHTML = sh;
      // top: timer/scores
      const st = mode.hudState();
      this.timer.textContent = st.timer; this.timer.className = 'timer' + (st.timerClass ? ' ' + st.timerClass : ''); this.roundLbl.textContent = st.roundLabel || '';
      this.scoreCT.textContent = st.scoreCT; this.scoreT.textContent = st.scoreT; this.top.classList.toggle('ffa', mode.id === 'ffa');
      // alive counters
      const aliveCT = g.actors.filter((a) => a.team === 'CT' && a.alive).length, aliveT = g.actors.filter((a) => a.team === 'T' && a.alive).length;
      this.aliveCT.innerHTML = '●'.repeat(aliveCT); this.aliveT.innerHTML = '●'.repeat(aliveT);
      this.bombInd.style.display = (mode.bombPlanted ? 'block' : 'none'); this.bombInd.style.opacity = mode.bombPlanted ? (0.5 + 0.5 * Math.abs(Math.sin(g.time * (2 + (1 - mode.bombTimeLeft / S3.ROUND.bombTime) * 8)))) : 0;
      this.levelInd.style.display = mode.id === 'armsrace' ? 'block' : 'none'; if (mode.id === 'armsrace') this.levelInd.innerHTML = `Уровень ${p.level + 1}/${S3.ARMS_RACE_ORDER.length} · <b>${S3.WEAPONS[S3.ARMS_RACE_ORDER[p.level]].name}</b>`;
      // hitmarker
      if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.hitmarker.className = 'hitmarker'; }
      // spectate text
      if (!p.alive) { const s = p.spectateTarget; this.spectate.style.display = 'block'; this.spectate.innerHTML = s && s.alive && p.deadT > 3 ? `Наблюдение: <b style="color:${S3.TEAM_COLOR_CSS[s.team]}">${s.name}</b> — ЛКМ: следующий` + (s.isBot && s.team === p.team ? ' · <b>E</b>: играть за этого бота' : '') + (mode.respawnTime ? ` · Возрождение через ${Math.ceil(p.respawnT)}` : '') : (mode.respawnTime && p.respawnT > 0 ? `Возрождение через ${Math.ceil(p.respawnT)}` : (p.deadT < 3 ? 'Вы погибли' : '')); }
      else this.spectate.style.display = 'none';
      this.drawRadar(); this.radarName.textContent = g.regionName(p.pos.x, p.pos.z) || g.map.def.title;
      if (this.sbVisible) this.renderScoreboard();
      if (S3.Settings.data.showFps) this.fps.textContent = g.fps.toFixed(0) + ' FPS';
      this.pauseHint.style.display = (!S3.Input.locked && !g.paused && !this.buyOpen && !g.menuOpen) ? 'block' : 'none';
    }
  }
  S3.HUD = HUD;
})();
