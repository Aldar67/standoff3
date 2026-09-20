// ===== Standoff 3 — game modes: Defuse (rounds/economy/bomb), TDM, FFA, Arms Race =====
'use strict';
(function () {
  const S3 = window.S3;
  const R = S3.ROUND, E = S3.ECON;

  class BaseMode {
    constructor(game, opts) {
      this.game = game; this.opts = opts || {}; this.score = { CT: 0, T: 0 }; this.phase = 'freeze'; this.phaseT = 0; this.roundNumber = 1; this.over = false;
      this.bombPlanted = false; this.bombPos = null; this.bombDropped = null; this.bombTimeLeft = 0; this.freeBuy = false; this.respawnTime = null; this.timeLeft = 0;
    }
    get id() { return 'base'; }
    canBuy(a) { return false; }
    frozen(a) { return this.phase === 'freeze' || this.phase === 'over'; }
    hudState() { return { timer: S3.fmtTime(this.timeLeft), scoreCT: this.score.CT, scoreT: this.score.T, roundLabel: '' }; }
    onDeath(v, a, w, hs) { }
    botObjective(bot) { return null; }
    onEnemySpotted(bot, e) { }
    spawnAll() { for (const a of this.game.actors) this.game.spawnActor(a); }
    randomSpawnAway(actor) { return this.game.pickSpawn(actor.team, actor); }
    endMatch(winner, text) { if (this.over) return; this.over = true; this.phase = 'over'; this.game.matchOver(winner, text); }
  }

  // ================= DEFUSE =================
  class DefuseMode extends BaseMode {
    constructor(game, opts) {
      super(game, opts); this.maxRounds = opts.rounds || 16; this.winsNeeded = Math.floor(this.maxRounds / 2) + 1; this.half = this.maxRounds / 2; this.halfDone = false;
      this.planter = null; this.plantProgress = 0; this.defuser = null; this.defuseProgress = 0; this.beepT = 0; this.roundEndReason = ''; this.plan = null; this.lossStreak = { CT: 0, T: 0 };
      this.roundStartT = 0; this.rushT = 0;
    }
    get id() { return 'defuse'; }
    canBuy(a) { if (this.over) return false; if (this.phase === 'freeze') return true; if (this.phase === 'live' && this.phaseT < R.buyTime && this.game.inSpawnZone(a)) return true; return false; }
    start() { for (const a of this.game.actors) { a.money = E.startMoney; a.resetInventory(); a.armor = 0; a.helmet = false; a.defuser = false; } this.startRound(true); }
    startRound(first) {
      const g = this.game; this.phase = 'freeze'; this.phaseT = 0; this.timeLeft = R.roundTime; this.bombPlanted = false; this.bombPos = null; this.bombDropped = null; this.planter = null; this.defuser = null; this.plantProgress = 0; this.defuseProgress = 0;
      g.effects.clearAll(); g.hud.setProgress('', null);
      for (const a of g.actors) {
        if (!a.alive || first) { a.resetInventory(); a.armor = 0; a.helmet = false; a.defuser = false; }
        if (a.inv.bomb) a.removeWeapon(a.inv.bomb); a.hasBomb = false;
        // pistols for new rounds if none
        if (!a.inv.secondary) { const w = a.giveWeapon(a.team === 'CT' ? 'usp' : 'g22', true); }
        a.select(a.bestWeapon(), true); a.roundKills = 0;
        g.spawnActor(a);
        if (a.isBot) { a.forgetAll(); a.objective = null; a.goal = null; a.path = null; }
      }
      // give bomb to a random T
      const ts = g.actors.filter((a) => a.team === 'T'); if (ts.length) { const carrier = S3.pick(ts); carrier.giveWeapon('bomb', true); g.localChat(carrier, '<span class="sys">У вас бомба! Установите её на точке A или B (слот 5, удерживайте ЛКМ).</span>'); }
      // bots buy
      for (const a of g.actors) if (a.isBot) a.autoBuy();
      this.makePlan();
      g.hud.showBanner(`Раунд ${this.roundNumber}`, first ? 'Купите снаряжение (B)' : '', 3); S3.Audio.roundStart();
      g.hud.addChat(`<span class="sys">Раунд ${this.roundNumber}. Счёт ${S3.TEAM_NAME.CT} ${this.score.CT} : ${this.score.T} ${S3.TEAM_NAME.T}</span>`);
      if (g.net && g.net.role === 'host') g.net.broadcastChat(`<span class="sys">Раунд ${this.roundNumber}. Счёт ${S3.TEAM_NAME.CT} ${this.score.CT} : ${this.score.T} ${S3.TEAM_NAME.T}</span>`);
      this.roundStartT = g.time; this.rushT = 40 + Math.random() * 40;
    }
    makePlan() {
      const sites = this.game.map.sites; if (!sites.length) { this.plan = null; return; }
      const primary = S3.pick(sites); const split = Math.random() < 0.3 && sites.length > 1;
      const ts = this.game.actors.filter((a) => a.team === 'T' && a.isBot); const cts = this.game.actors.filter((a) => a.team === 'CT' && a.isBot);
      const plan = { tSite: primary, tSplit: split, assign: {}, ctAssign: {}, rotate: null, ctRotated: false, tDelay: {} };
      ts.forEach((b, i) => { plan.assign[b.id] = (split && i % 2 === 1) ? S3.pick(sites.filter((s) => s !== primary)) : primary; plan.tDelay[b.id] = b.hasBomb ? 0 : Math.random() * 6; });
      const others = sites.slice(); cts.forEach((b, i) => { plan.ctAssign[b.id] = others[i % others.length]; });
      this.plan = plan;
    }
    update(dt) {
      const g = this.game; if (this.over) return; this.phaseT += dt;
      if (this.phase === 'freeze') { if (this.phaseT >= R.freezeTime) { this.phase = 'live'; this.phaseT = 0; g.hud.showBanner('Бой!', '', 1.2); S3.Audio.radio(); } return; }
      if (this.phase === 'live') {
        if (!this.bombPlanted) { this.timeLeft = Math.max(0, R.roundTime - this.phaseT); if (this.timeLeft <= 0) return this.endRound('CT', 'time'); }
        else {
          this.bombTimeLeft -= dt; this.timeLeft = 0; g.effects.setBombBlink(Math.floor(this.bombTimeLeft * (2 + (1 - this.bombTimeLeft / R.bombTime) * 10)) % 2 === 0);
          this.beepT -= dt; if (this.beepT <= 0) { this.beepT = 0.15 + 0.85 * (this.bombTimeLeft / R.bombTime); S3.Audio.bombBeep(this.bombPos, this.bombTimeLeft < 10); }
          if (this.bombTimeLeft <= 0) { this.explode(); return; }
        }
        // eliminations
        const aliveCT = g.actors.some((a) => a.team === 'CT' && a.alive), aliveT = g.actors.some((a) => a.team === 'T' && a.alive);
        if (!aliveCT && !aliveT) return this.endRound(this.bombPlanted ? 'T' : 'CT', 'elim');
        if (!aliveCT) return this.endRound('T', 'elim');
        if (!aliveT && !this.bombPlanted) return this.endRound('CT', 'elim');
        // bomb pickup by T
        if (this.bombDropped) { for (const a of g.actors) { if (a.alive && a.team === 'T' && a.pos.distanceTo(this.bombDropped.pos) < 1.4) { g.effects.removePickup(this.bombDropped); this.bombDropped = null; a.giveWeapon('bomb', true); S3.Audio.pickup(); g.localChat(a, '<span class="sys">Вы подобрали бомбу</span>'); g.radio(a, 'Бомба у меня!'); break; } } }
        // planter/defuser progress reset if they stopped
        if (this.planter && (g.time - this.planter._plantTick > 0.2)) { this.planter.planting = false; this.planter = null; this.plantProgress = 0; if (g.player.alive) g.hud.setProgress('', null); }
        if (this.defuser && (g.time - this.defuser._defuseTick > 0.2)) { this.defuser.defusing = false; this.defuser = null; this.defuseProgress = 0; if (g.player.alive) g.hud.setProgress('', null); }
        return;
      }
      if (this.phase === 'end') { if (this.phaseT >= R.endTime) { this.nextRound(); } }
    }
    // ---- bomb ----
    inSite(x, z) { for (const s of this.game.map.sites) if (x >= s.min.x && x <= s.max.x && z >= s.min.z && z <= s.max.z) return s; return null; }
    tryPlant(actor, dt, want) {
      if (this.phase !== 'live' || !actor.alive || !actor.hasBomb || this.bombPlanted) return null;
      const site = this.inSite(actor.pos.x, actor.pos.z);
      if (!want) { if (this.planter === actor) { this.planter = null; actor.planting = false; this.plantProgress = 0; this.game.localProgress(actor, '', null); } return site ? 'insite' : 'notinsite'; }
      if (!site) { this.game.localHint(actor, 'Бомбу можно установить только на точке A или B'); return 'notinsite'; }
      if (!actor.body.onGround) return null;
      if (this.planter !== actor) { this.planter = actor; this.plantProgress = 0; actor.planting = true; }
      actor._plantTick = this.game.time; this.plantProgress += dt;
      this.game.localProgress(actor, 'Установка бомбы...', this.plantProgress / R.plantTime); if (actor.isLocal && Math.floor(this.plantProgress * 6) !== Math.floor((this.plantProgress - dt) * 6)) S3.Audio.bombPlantTick();
      if (this.plantProgress >= R.plantTime) { this.plant(actor, site); return 'planted'; }
      return 'planting';
    }
    plant(actor, site) {
      const g = this.game; this.bombPlanted = true; this.bombPos = actor.pos.clone(); this.bombTimeLeft = R.bombTime; this.bombSite = site; this.planter = null; actor.planting = false; this.plantProgress = 0;
      actor.removeWeapon(actor.inv.bomb); actor.money = Math.min(E.maxMoney, actor.money + E.plantBonus); actor.score += 2; actor.bombPlants = (actor.bombPlants || 0) + 1; if (actor.isLocal) { S3.Stats.data.bombPlants++; } g.localProgress(actor, '', null);
      g.effects.placeBomb(this.bombPos); S3.Audio.bombPlanted(); g.hud.showBanner('Бомба установлена!', `Точка ${site.name} · 40 секунд`, 3, '#ffb040');
      if (g.net && g.net.role === 'host') g.net.sendBombEvent('bombplant', this.bombPos, site.name);
      g.hud.addChat(`<span class="sys">${actor.name} установил бомбу на точке ${site.name}</span>`);
      if (g.net && g.net.role === 'host') g.net.broadcastChat(`<span class="sys">${actor.name} установил бомбу на точке ${site.name}</span>`); g.emitNoiseAt(this.bombPos, 40, actor);
      for (const a of g.actors) if (a.isBot) { a.objective = null; a.objT = 0; }
      this.timeLeft = 0;
    }
    tryDefuse(actor, dt, want) {
      if (this.phase !== 'live' || !actor.alive || actor.team !== 'CT' || !this.bombPlanted) return null;
      const d = actor.pos.distanceTo(this.bombPos);
      if (d > 1.6) { if (this.defuser === actor) { this.defuser = null; actor.defusing = false; this.defuseProgress = 0; this.game.localProgress(actor, '', null); } return 'far'; }
      if (!want) this.game.localHint(actor, 'Удерживайте E, чтобы обезвредить бомбу');
      if (!want) { if (this.defuser === actor) { this.defuser = null; actor.defusing = false; this.defuseProgress = 0; this.game.localProgress(actor, '', null); } return 'near'; }
      if (this.defuser && this.defuser !== actor && this.defuser.alive && this.game.time - this.defuser._defuseTick < 0.3) { this.game.localHint(actor, `${this.defuser.name} уже обезвреживает бомбу`); return 'busy'; }
      if (this.defuser !== actor) { this.defuser = actor; this.defuseProgress = 0; actor.defusing = true; if (actor.isBot && this.game.time - (this._defRadioT || -99) > 8) { this._defRadioT = this.game.time; this.game.radio(actor, 'Обезвреживаю бомбу, прикройте!'); } }
      actor._defuseTick = this.game.time; this.defuseProgress += dt; const need = actor.defuser ? R.defuseKitTime : R.defuseTime;
      this.game.localProgress(actor, actor.defuser ? 'Обезвреживание (набор сапёра)...' : 'Обезвреживание...', this.defuseProgress / need); if (actor.isLocal && Math.floor(this.defuseProgress * 4) !== Math.floor((this.defuseProgress - dt) * 4)) S3.Audio.defuseTick();
      if (this.defuseProgress >= need) { this.defused(actor); return 'defused'; }
      return 'defusing';
    }
    defused(actor) {
      const g = this.game; actor.defusing = false; this.defuser = null; actor.score += 2; actor.money = Math.min(E.maxMoney, actor.money + 300); actor.bombDefuses = (actor.bombDefuses || 0) + 1; if (actor.isLocal) { S3.Stats.data.bombDefuses++; } g.localProgress(actor, '', null);
      S3.Audio.bombDefused(); g.effects.removeBomb(); g.hud.addChat(`<span class="sys">${actor.name} обезвредил бомбу</span>`);
      if (g.net && g.net.role === 'host') g.net.broadcastChat(`<span class="sys">${actor.name} обезвредил бомбу</span>`);
      if (g.net && g.net.role === 'host') g.net.sendBombEvent('bombdefuse', null, null);
      this.endRound('CT', 'defused', actor);
    }
    explode() {
      const g = this.game; const p = this.bombPos; g.effects.removeBomb(); g.effects.explosion(p.x, p.y, p.z, true); S3.Audio.explosion(p, true); g.shake(p, 40, 1.5);
      if (g.net && g.net.role === 'host') g.net.sendBombEvent('bombexplode', p, null);
      for (const a of g.actors) { if (!a.alive) continue; const d = a.pos.distanceTo(p); if (d < 22) { const dmg = Math.max(0, 1 - d / 22) * 500; a.takeDamage(dmg, this.planterActor || null, 'body', 'bomb', 0, 0, { ignoreArmor: true }); } }
      this.bombPlanted = false; this.endRound('T', 'exploded');
    }
    bombCarrierDied(actor) { if (actor.inv.bomb) { const p = this.game.effects.spawnPickup(actor.inv.bomb, actor.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), new THREE.Vector3((Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2), true); this.bombDropped = p; actor.removeWeapon(actor.inv.bomb); this.game.hud.addChat('<span class="sys">Бомба сброшена!</span>'); for (const a of this.game.actors) if (a.isBot && a.team === 'T') { a.objective = null; } } }
    // ---- round end / economy ----
    endRound(winner, reason, hero) {
      if (this.phase !== 'live') return; const g = this.game; this.phase = 'end'; this.phaseT = 0; this.roundEndReason = reason; this.score[winner]++;
      for (const a of g.actors) { a.planting = false; a.defusing = false; }
      const loser = winner === 'CT' ? 'T' : 'CT';
      const winMoney = reason === 'exploded' ? E.winBomb : reason === 'defused' ? E.winDefuse : winner === 'CT' && reason === 'time' ? E.winTime : E.winElim;
      this.lossStreak[winner] = 0; this.lossStreak[loser] = Math.min(4, this.lossStreak[loser] + 1);
      const lossMoney = Math.min(E.lossMax, E.lossBase + (this.lossStreak[loser] - 1) * E.lossStep);
      for (const a of g.actors) {
        if (a.team === winner) a.money += winMoney; else { a.money += lossMoney + (this.bombPlanted || reason === 'exploded' ? (a.team === 'T' ? E.lossPlantBonus : 0) : 0); }
        a.money = Math.min(E.maxMoney, a.money);
      }
      // MVP
      let mvp = hero || null; if (!mvp) { let best = 0; for (const a of g.actors) if (a.team === winner && a.roundKills > best) { best = a.roundKills; mvp = a; } }
      if (mvp) { mvp.mvps++; mvp.score += 1; }
      const reasonText = { elim: 'Противник уничтожен', time: 'Время вышло', exploded: 'Бомба взорвана', defused: 'Бомба обезврежена' }[reason] || '';
      const pTeam = g.player.team; const won = pTeam === winner;
      g.hud.showBanner(won ? 'ПОБЕДА В РАУНДЕ' : 'ПОРАЖЕНИЕ В РАУНДЕ', reasonText + (mvp ? ` · MVP: ${mvp.name}` : ''), R.endTime - 0.5, won ? '#6fdc6f' : '#ff6060');
      if (won) S3.Audio.roundWin(); else S3.Audio.roundLose();
      g.hud.addChat(`<span class="sys">${S3.TEAM_NAME[winner]} выиграли раунд (${reasonText}). ${won ? '+' + winMoney : '+' + lossMoney + '$ за поражение'}</span>`);
      if (g.net && g.net.role === 'host') g.net.broadcastChat(`<span class="sys">${S3.TEAM_NAME[winner]} выиграли раунд (${reasonText}). ${won ? '+' + winMoney : '+' + lossMoney + '$ за поражение'}</span>`);
      this.bombPlanted = false; g.effects.removeBomb();
      if (this.score[winner] >= this.winsNeeded) { setTimeout(() => this.endMatch(winner, `${S3.TEAM_NAME[winner]} побеждают ${this.score.CT}:${this.score.T}`), 2500); }
      // (per-round MVP tally is derived from match result in Game.matchOver; nothing to do here)
    }
    nextRound() {
      if (this.over) return; this.roundNumber++;
      if (!this.halfDone && this.roundNumber > this.half) { this.halfDone = true; this.swapSides(); }
      this.startRound(false);
    }
    swapSides() {
      const g = this.game; for (const a of g.actors) { a.team = a.team === 'CT' ? 'T' : 'CT'; a.money = E.startMoney; a.resetInventory(); a.armor = 0; a.helmet = false; a.defuser = false; a.alive = false; if (a.isBot) { g.scene.remove(a.model.root); a.model = new S3.CharacterModel(a.team, a.skinIdx); g.scene.add(a.model.root); a.onWeaponChange = (w) => a.model.setWeapon(w.id); } }
      const s = this.score.CT; this.score.CT = this.score.T; this.score.T = s; this.lossStreak = { CT: 0, T: 0 };
      g.vm.buildArms(g.player.team); g.hud.showBanner('Смена сторон', `Вы теперь за ${S3.TEAM_NAME[g.player.team]}`, 4, '#ffd060');
      g.hud.addChat('<span class="sys">Смена сторон! Деньги сброшены.</span>');
      if (g.net && g.net.role === 'host') g.net.broadcastChat('<span class="sys">Смена сторон! Деньги сброшены.</span>');
    }
    onDeath(v, a, w, hs) {
      if (v.hasBomb) this.bombCarrierDied(v);
      if (a && a !== v && a.team !== v.team) { const rw = (S3.WEAPONS[w] && S3.WEAPONS[w].killReward) || 300; a.money = Math.min(E.maxMoney, a.money + rw); }
      else if (a && a !== v && a.team === v.team) { a.money = Math.max(0, a.money - 300); }
      if (v.isBot && v.planting) { v.planting = false; }
    }
    frozen(a) { return this.phase === 'freeze' || this.phase === 'over'; }
    hudState() {
      let timer, cls = ''; if (this.phase === 'freeze') { timer = S3.fmtTime(R.freezeTime - this.phaseT); cls = 'freeze'; } else if (this.bombPlanted) { timer = '🧨 ' + S3.fmtTime(this.bombTimeLeft); cls = 'bomb'; } else if (this.phase === 'end') { timer = '0:00'; } else { timer = S3.fmtTime(this.timeLeft); if (this.timeLeft < 20) cls = 'low'; }
      return { timer, timerClass: cls, scoreCT: this.score.CT, scoreT: this.score.T, roundLabel: `Раунд ${this.roundNumber} / до ${this.winsNeeded}` };
    }
    onEnemySpotted(bot, e) {
      // CT rotation logic: if enemies spotted at a site, some CT bots at other sites rotate after a delay
      if (bot.team !== 'CT' || !this.plan || this.bombPlanted) return; const site = this.inSite(e.pos.x, e.pos.z) || this.inSite(bot.pos.x, bot.pos.z); if (!site) return;
      if (this.plan.rotate === site) return; this.plan.rotate = site; this.plan.rotateT = this.game.time;
      for (const a of this.game.actors) if (a.isBot && a.team === 'CT' && a !== bot && this.plan.ctAssign[a.id] !== site && Math.random() < 0.6) { setTimeout(() => { if (a.alive && this.phase === 'live') { this.plan.ctAssign[a.id] = site; a.objective = null; } }, 3000 + Math.random() * 6000); }
    }
    botObjective(bot) {
      const g = this.game, nav = g.nav, map = g.map, plan = this.plan; if (this.phase !== 'live' || !plan) return null;
      const sites = map.sites; if (!sites.length) return { type: 'goto', x: 0, z: 0, radius: 3 };
      const coverNear = (site, r) => { const k = nav.randomNodeNear(site.cx, site.cz, r || 9, (kk) => nav.cover[kk]); return k >= 0 ? { x: nav.nodeX(k), z: nav.nodeZ(k) } : { x: site.cx, z: site.cz }; };
      const enemySpawn = g.spawnCenter(bot.team === 'T' ? 'CT' : 'T');
      if (bot.team === 'T') {
        if (this.bombPlanted) { const p = this.bombPos; const k = nav.randomNodeNear(p.x, p.z, 10, (kk) => nav.cover[kk]); const pos = k >= 0 ? { x: nav.nodeX(k), z: nav.nodeZ(k) } : { x: p.x, z: p.z }; return { type: 'hold', x: pos.x, z: pos.z, radius: 1, faceX: enemySpawn.x, faceZ: enemySpawn.z }; }
        if (this.bombDropped && !g.actors.some((a) => a.hasBomb && a.alive)) { const p = this.bombDropped.pos; const dNear = g.actors.filter((a) => a.alive && a.team === 'T' && a.isBot).sort((a, b) => a.pos.distanceTo(p) - b.pos.distanceTo(p)); if (dNear[0] === bot || Math.random() < 0.3) return { type: 'goto', x: p.x, z: p.z, radius: 0.8 }; }
        const site = plan.assign[bot.id] || plan.tSite; const elapsed = g.time - this.roundStartT;
        if (bot.hasBomb) { const k = nav.randomNodeNear(site.cx, site.cz, Math.min(site.max.x - site.min.x, site.max.z - site.min.z) * 0.4, (kk) => this.inSite(nav.nodeX(kk), nav.nodeZ(kk)) === site); const pos = k >= 0 ? { x: nav.nodeX(k), z: nav.nodeZ(k) } : { x: site.cx, z: site.cz }; return { type: 'plant', x: pos.x, z: pos.z, radius: 0.8 }; }
        if (elapsed < (plan.tDelay[bot.id] || 0)) { return { type: 'hold', x: bot.pos.x, z: bot.pos.z, radius: 1 }; }
        // escort: go to site area, hold near cover
        const c = coverNear(site, elapsed > this.rushT ? 6 : 12); return { type: 'hold', x: c.x, z: c.z, radius: 1.2, faceX: enemySpawn.x, faceZ: enemySpawn.z };
      } else {
        if (this.bombPlanted) { const p = this.bombPos; return { type: 'defuse', x: p.x, z: p.z, radius: 1.0 }; }
        const site = plan.ctAssign[bot.id] || S3.pick(sites);
        const elapsed = g.time - this.roundStartT;
        // known enemy positions? hunt handled by bot itself. Otherwise hold defensive cover positions around the site
        const c = coverNear(site, elapsed > 50 && Math.random() < 0.4 ? 18 : 10);
        return { type: 'hold', x: c.x, z: c.z, radius: 1.2, faceX: enemySpawn.x, faceZ: enemySpawn.z };
      }
    }
  }

  // ================= TEAM DEATHMATCH / FFA =================
  class TDMMode extends BaseMode {
    constructor(game, opts, ffa) {
      super(game, opts); this.ffa = !!ffa; this.killLimit = opts.killLimit || (ffa ? 30 : 60); this.timeLimit = opts.timeLimit || 600; this.freeBuy = true; this.respawnTime = 3; this.elapsed = 0; this.playerKills = {};
    }
    get id() { return this.ffa ? 'ffa' : 'tdm'; }
    canBuy(a) { return !this.over && (a.spawnProtect > 0 || a.timeSinceSpawn < 10 || this.game.inSpawnZone(a)); }
    frozen(a) { return this.phase === 'freeze' || this.over; }
    start() { this.phase = 'freeze'; this.phaseT = 0; for (const a of this.game.actors) { a.resetInventory(); a.armor = 0; a.helmet = false; a.money = 16000; this.spawnOne(a, true); } this.game.hud.showBanner(this.ffa ? 'Каждый за себя' : 'Командный бой', `До ${this.killLimit} убийств`, 3); S3.Audio.roundStart(); }
    spawnOne(a, initial) {
      const g = this.game; a.resetInventory(); a.armor = 0; a.helmet = false; a.money = 16000;
      g.spawnActor(a, this.ffa); a.spawnProtect = 2.5; a.timeSinceSpawn = 0;
      if (a.isBot) { a.autoBuy(); a.forgetAll(); a.objective = null; a.select(a.bestWeapon(), true); }
      else { // player: keep loadout preference
        const L = g.playerLoadout || { primary: 'akr', secondary: 'usp' }; a.giveWeapon(L.secondary || 'usp', true); a.giveWeapon(L.primary || 'akr', true); a.armor = 100; a.helmet = true; a.giveWeapon('he', true); a.giveWeapon('flash', true); a.select(a.inv.primary, true);
      }
    }
    update(dt) {
      const g = this.game; if (this.over) return; this.phaseT += dt;
      if (this.phase === 'freeze') { if (this.phaseT >= 3) { this.phase = 'live'; this.phaseT = 0; g.hud.showBanner('Бой!', '', 1); } return; }
      this.elapsed += dt; this.timeLeft = Math.max(0, this.timeLimit - this.elapsed);
      for (const a of g.actors) {
        a.timeSinceSpawn = (a.timeSinceSpawn || 0) + dt;
        if (!a.alive) { a.respawnT -= dt; if (a.respawnT <= 0) this.spawnOne(a); }
      }
      if (this.timeLeft <= 0) { const w = this.winnerNow(); this.endMatch(w.team, w.text); }
    }
    winnerNow() {
      if (this.ffa) { const best = this.game.actors.slice().sort((a, b) => b.kills - a.kills)[0]; return { team: best.isLocal ? this.game.player.team : null, text: `${best.name} побеждает (${best.kills} убийств)`, actor: best }; }
      const w = this.score.CT === this.score.T ? null : (this.score.CT > this.score.T ? 'CT' : 'T'); return { team: w, text: w ? `${S3.TEAM_NAME[w]} побеждают ${this.score.CT}:${this.score.T}` : `Ничья ${this.score.CT}:${this.score.T}` };
    }
    onDeath(v, a, w, hs) {
      v.respawnT = this.respawnTime;
      if (a && a !== v && this.game.isEnemy(a, v)) {
        if (this.ffa) { if (a.kills >= this.killLimit) this.endMatch(a.isLocal ? this.game.player.team : null, `${a.name} побеждает!`); }
        else { this.score[a.team]++; if (this.score[a.team] >= this.killLimit) this.endMatch(a.team, `${S3.TEAM_NAME[a.team]} побеждают ${this.score.CT}:${this.score.T}`); }
      }
    }
    hudState() { const top = this.ffa ? this.game.actors.slice().sort((a, b) => b.kills - a.kills)[0] : null; return { timer: S3.fmtTime(this.timeLeft), timerClass: this.timeLeft < 30 ? 'low' : '', scoreCT: this.ffa ? this.game.player.kills : this.score.CT, scoreT: this.ffa ? (top ? top.kills : 0) : this.score.T, roundLabel: this.ffa ? `Вы / Лидер (${top ? top.name : ''}) · до ${this.killLimit}` : `До ${this.killLimit} убийств` }; }
    botObjective(bot) {
      const g = this.game, nav = g.nav;
      // go toward a random enemy's general area (with error) or random node
      const enemies = g.actors.filter((a) => a.alive && g.isEnemy(a, bot)); let tx, tz;
      if (enemies.length && Math.random() < 0.6) { const e = S3.pick(enemies); tx = e.pos.x + (Math.random() - 0.5) * 16; tz = e.pos.z + (Math.random() - 0.5) * 16; }
      else { const k = nav.randomNode(); tx = nav.nodeX(k); tz = nav.nodeZ(k); }
      const k = nav.nodeAt(tx, tz, undefined, 6); if (k < 0) return null; return { type: 'hold', x: nav.nodeX(k), z: nav.nodeZ(k), radius: 1.5 };
    }
  }

  // ================= ARMS RACE =================
  class ArmsRaceMode extends TDMMode {
    constructor(game, opts) { super(game, opts, false); this.order = S3.ARMS_RACE_ORDER; }
    get id() { return 'armsrace'; }
    canBuy() { return false; }
    start() { this.phase = 'freeze'; this.phaseT = 0; for (const a of this.game.actors) { a.level = 0; this.spawnOne(a, true); } this.game.hud.showBanner('Гонка вооружений', `${this.order.length} уровней · последний — нож`, 3); S3.Audio.roundStart(); }
    giveLevelWeapon(a) { a.resetInventory(); a.armor = 100; a.helmet = true; const id = this.order[Math.min(a.level, this.order.length - 1)]; if (id !== 'knife') a.giveWeapon(id, true); a.select(a.bestWeapon(), true); }
    spawnOne(a) { const g = this.game; g.spawnActor(a, false); a.spawnProtect = 2.5; a.timeSinceSpawn = 0; this.giveLevelWeapon(a); if (a.isBot) { a.forgetAll(); a.objective = null; } }
    update(dt) { const g = this.game; if (this.over) return; this.phaseT += dt; if (this.phase === 'freeze') { if (this.phaseT >= 3) { this.phase = 'live'; this.phaseT = 0; g.hud.showBanner('Бой!', '', 1); } return; } this.elapsed += dt; this.timeLeft = Math.max(0, this.timeLimit - this.elapsed); for (const a of g.actors) { a.timeSinceSpawn = (a.timeSinceSpawn || 0) + dt; if (!a.alive) { a.respawnT -= dt; if (a.respawnT <= 0) this.spawnOne(a); } } if (this.timeLeft <= 0) { const best = g.actors.slice().sort((a, b) => b.level - a.level)[0]; this.endMatch(best.team, `${best.name} лидирует (уровень ${best.level + 1})`); } }
    onDeath(v, a, w, hs) {
      v.respawnT = this.respawnTime;
      if (a && a !== v && a.team !== v.team) {
        const last = a.level >= this.order.length - 1;
        if (last) { this.endMatch(a.team, `${a.name} побеждает в гонке вооружений!`); return; }
        a.level += (w === 'knife' ? 2 : 1); if (a.level > this.order.length - 1) a.level = this.order.length - 1;
        if (a.alive) { this.giveLevelWeapon(a); }
        if (a.isLocal) { S3.Audio.levelUp(); this.game.hud.showBanner(`Уровень ${a.level + 1}`, S3.WEAPONS[this.order[a.level]].name, 1.5, '#ffd060'); } else if (a.isPlayer && this.game.net) this.game.net.sendLevelUp(a);
        this.score[a.team] = Math.max(this.score[a.team], a.level + 1);
        if (a.level === this.order.length - 1) {
          this.game.hud.addChat(`<span class="sys">${a.name} на последнем уровне — нож!</span>`);
          if (this.game.net && this.game.net.role === 'host') this.game.net.broadcastChat(`<span class="sys">${a.name} на последнем уровне — нож!</span>`);
        }
      }
    }
    hudState() { const top = this.game.actors.slice().sort((a, b) => b.level - a.level)[0]; return { timer: S3.fmtTime(this.timeLeft), timerClass: '', scoreCT: this.game.player.level + 1, scoreT: top ? top.level + 1 : 1, roundLabel: `Ваш уровень / Лидер (${top ? top.name : ''})` }; }
  }

  S3.createMode = function (game, id, opts) {
    if (id === 'defuse') return new DefuseMode(game, opts); if (id === 'tdm') return new TDMMode(game, opts, false); if (id === 'ffa') return new TDMMode(game, opts, true); if (id === 'armsrace') return new ArmsRaceMode(game, opts);
    return new DefuseMode(game, opts);
  };
})();
