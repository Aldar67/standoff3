// ===== Standoff 3 — LAN multiplayer: CLIENT side sync =====
// A client never runs bot AI, mode logic or authoritative hit detection. It renders exactly
// what the host tells it to: puppets (bots + other humans) interpolated from snapshots, and
// discrete events replayed through the same Effects/Audio/HUD calls solo play already uses.
// Its own avatar is a real local S3.Player (so the camera/viewmodel/local prediction all work
// normally) whose authoritative scalar fields (health, money, ammo, ...) are overwritten from
// each snapshot, and whose position is gently reconciled toward the host's version of it.
'use strict';
(function () {
  const S3 = window.S3;

  // Minimal stand-in for a real game mode: HUD/scoreboard code only ever reads these few
  // properties/methods, so this is all a client needs — no rules, just the latest numbers.
  class RemoteMode {
    constructor(id) { this.id = id || 'defuse'; this.phase = 'freeze'; this.over = false; this.score = { CT: 0, T: 0 }; this.freeBuy = false; this.bombPlanted = false; this.bombPos = null; this.bombTimeLeft = 0; this._st = { timer: '0:00', scoreCT: 0, scoreT: 0, roundLabel: '' }; }
    apply(m) {
      this.id = m.id; this.phase = m.phase; this.over = m.over; this.freeBuy = m.freeBuy; this.bombPlanted = m.bombPlanted; this.bombPos = m.bombPos; this.bombTimeLeft = m.bombTimeLeft;
      this.score.CT = m.scoreCT; this.score.T = m.scoreT;
      this._st = { timer: m.timer, timerClass: m.timerClass, scoreCT: m.scoreCT, scoreT: m.scoreT, roundLabel: m.roundLabel };
    }
    canBuy(actor) { if (this.over) return false; if (this.phase === 'freeze') return true; if (this.freeBuy) return actor.spawnProtect > 0 || (actor.timeSinceSpawn !== undefined && actor.timeSinceSpawn < 10); return false; }
    frozen() { return this.phase === 'freeze' || this.phase === 'over'; }
    hudState() { return this._st; }
  }
  S3.RemoteMode = RemoteMode;

  class ClientSync {
    constructor(game, net, myTeam) {
      this.game = game; this.net = net; this.role = 'client';
      this.localKey = 'h' + net.myId;
      this.puppets = {}; // netKey -> Actor (with model), interpolated only
      this.nadePuppets = {}; // network grenade id -> {mesh, pos, kind}
      this.serverPos = null; this.serverPosT = 0; this.gotFirstSnap = false;
      net.on('snap', (msg) => this.applySnapshot(msg));
      net.on('ev', (msg) => this.applyEvent(msg));
      net.on('hostleft', () => { if (game.onNetLost) game.onNetLost(); });
    }
    // ---- outgoing (this human's discrete actions) ----
    sendInput(pkt) { this.net.send(pkt); }
    sendBuy(id) { this.net.send({ t: 'buy', id }); }
    sendBuyOpen(open) { this.net.send({ t: 'buyopen', open: !!open }); }
    sendThrow(wid, strength) { this.net.send({ t: 'throw', wid, strength }); }
    sendRadio(key) { this.net.send({ t: 'radio', key }); }
    // ---- puppets ----
    getOrCreatePuppet(entry) {
      let p = this.puppets[entry.k];
      if (!p) {
        p = new S3.Actor(this.game, { name: entry.name, team: entry.team, isBot: entry.isBot, isLocal: false, skinIdx: Math.abs(hash(entry.k)) % 3 });
        p.netKey = entry.k; p.diffName = entry.diff || 'medium';
        S3.attachCharacterModel(p, this.game.scene, Math.abs(hash(entry.k)) % 3);
        p.pos.set(entry.x, entry.y, entry.z); p.yaw = entry.yaw; p.pitch = entry.pitch;
        p.targetPos = new THREE.Vector3(entry.x, entry.y, entry.z);
        this.puppets[entry.k] = p; this.game.actors.push(p); p.model.root.visible = true;
      }
      return p;
    }
    applySnapshot(msg) {
      const game = this.game; this.gotFirstSnap = true;
      game.mode.apply(msg.mode);
      if (msg.mode.bombPlanted && !game.effects.bombMesh) game.effects.placeBomb(new THREE.Vector3(msg.mode.bombPos.x, msg.mode.bombPos.y, msg.mode.bombPos.z));
      else if (!msg.mode.bombPlanted && game.effects.bombMesh) game.effects.removeBomb();
      if (game.effects.bombMesh) game.effects.setBombBlink(Math.floor(msg.mode.bombTimeLeft * 3) % 2 === 0);
      for (const entry of msg.actors) {
        if (entry.k === this.localKey) { this.applyLocalAuthoritative(entry); continue; }
        const p = this.getOrCreatePuppet(entry);
        p.name = entry.name; p.team = entry.team; p.health = entry.hp; p.armor = entry.armor; p.helmet = entry.helmet; p.alive = entry.alive;
        p.kills = entry.kills; p.deaths = entry.deaths; p.assists = entry.assists; p.score = entry.score; p.money = entry.money; p.level = entry.level;
        p.hasBomb = entry.hasBomb; p.defuser = entry.defuser; p.firing = entry.firing ? 0.12 : 0; p.scoped = entry.scoped; p.crouchAmt = entry.crouch;
        if (!p.current || p.current.id !== entry.wid) { const def = S3.WEAPONS[entry.wid]; if (def) { p.current = { id: entry.wid, def, ammo: entry.ammo, reserve: entry.reserve, count: entry.gcount, isGun: def.type !== 'knife' && def.type !== 'grenade' && def.type !== 'bomb', reloading: entry.reloading }; if (p.model) p.model.setWeapon(entry.wid); } }
        else { p.current.ammo = entry.ammo; p.current.reserve = entry.reserve; p.current.count = entry.gcount; p.current.reloading = entry.reloading; }
        if (!p.targetPos) p.targetPos = new THREE.Vector3();
        p.targetPos.set(entry.x, entry.y, entry.z); p.targetYaw = entry.yaw; p.targetPitch = entry.pitch;
        if (!p.alive && p.model && !p.model.dead) { p.model.die(0, 1, false); }
        else if (p.alive && p.model && p.model.dead) { p.model.reset(); p.pos.copy(p.targetPos); }
      }
      // grenades in flight: sync any the host is still tracking that we don't yet have a puppet for
      const seen = {}; for (const g of msg.grenades) { seen[g.id] = true; this.updateNadePuppet(g); }
      for (const id in this.nadePuppets) if (!seen[id]) { this.removeNadePuppet(id); }
    }
    applyLocalAuthoritative(entry) {
      const p = this.game.player;
      p.health = entry.hp; p.armor = entry.armor; p.helmet = entry.helmet; p.money = entry.money; p.level = entry.level;
      p.kills = entry.kills; p.deaths = entry.deaths; p.assists = entry.assists; p.score = entry.score; p.hasBomb = entry.hasBomb; p.defuser = entry.defuser;
      if (entry.alive && !p.alive) { p.alive = true; } // host-driven respawn (TDM/FFA/ArmsRace)
      if (!entry.alive && p.alive) { p.alive = false; p.deadT = 0; }
      // inventory self-heal: if the weapon the host thinks we're holding differs, snap to it
      if (p.current && p.current.id !== entry.wid && entry.wid) { const w = p.giveWeapon(entry.wid, true); if (w) { p.select(w, true); w.ammo = entry.ammo; w.reserve = entry.reserve; } }
      else if (p.current && p.current.isGun) { if (Math.abs(p.current.ammo - entry.ammo) > 1) p.current.ammo = entry.ammo; if (Math.abs(p.current.reserve - entry.reserve) > 2) p.current.reserve = entry.reserve; }
      this.serverPos = new THREE.Vector3(entry.x, entry.y, entry.z); this.serverPosT = this.game.time;
    }
    updateNadePuppet(g) {
      let np = this.nadePuppets[g.id];
      if (!np) { const mesh = S3.buildWeaponModel(S3.WEAPONS[g.wid], 1); this.game.scene.add(mesh); np = { mesh, target: new THREE.Vector3(g.x, g.y, g.z) }; mesh.position.copy(np.target); this.nadePuppets[g.id] = np; }
      np.target.set(g.x, g.y, g.z);
    }
    removeNadePuppet(id) { const np = this.nadePuppets[id]; if (np) { this.game.scene.remove(np.mesh); delete this.nadePuppets[id]; } }
    // ---- discrete events (mirror the exact Effects/Audio/HUD calls the host used) ----
    applyEvent(msg) {
      const game = this.game, myId = this.net.myId;
      if (msg.for !== undefined && msg.for !== myId) return; // targeted at someone else
      switch (msg.k) {
        case 'chat': game.hud.addChat(msg.html); break;
        case 'banner': game.hud.showBanner(msg.text, msg.sub, msg.dur, msg.color); break;
        case 'kf': {
          const att = msg.att ? { name: msg.attName, team: msg.attTeam, isLocal: msg.att === this.localKey } : null;
          const vic = { name: msg.vicName, team: msg.vicTeam, isLocal: msg.vic === this.localKey };
          game.hud.killfeed(att, vic, msg.wid, msg.hs);
          break;
        }
        case 'radio': if (msg.team === game.player.team) { game.hud.addChat(`<span class="radio">📻</span> <span style="color:${S3.TEAM_COLOR_CSS[msg.team]}">${msg.name}</span>: ${msg.text}`); S3.Audio.radio(); } break;
        case 'shot': {
          const w = S3.WEAPONS[msg.wid] || {}; const muzzle = new THREE.Vector3(msg.mx, msg.my, msg.mz); const end = new THREE.Vector3(msg.ex, msg.ey, msg.ez);
          const mine = msg.shooter === this.localKey;
          if (!mine) {
            const dir = end.clone().sub(muzzle).normalize();
            S3.Audio.gunshot(w.sound, muzzle, 1); game.effects.muzzleFlash(muzzle, dir, w.type === 'sniper' || w.type === 'shotgun' || w.type === 'mg');
            if (w.sound !== 'silenced' && w.type !== 'knife') { const up = new THREE.Vector3(0, 1, 0); const r = new THREE.Vector3(dir.z, 0, -dir.x).normalize(); game.effects.shell(muzzle.clone().addScaledVector(dir, -0.15), r, up); }
          }
          game.effects.tracer(muzzle, end);
          if (msg.hit === 'actor') { const dir = end.clone().sub(muzzle).normalize(); game.effects.blood(end.x, end.y, end.z, dir.x, dir.y, dir.z); S3.Audio.fleshHit(end); }
          else if (msg.hit === 'world') { game.effects.impact(end.x, end.y, end.z, msg.nx, msg.ny, msg.nz, msg.surface); if (end.distanceTo(game.player.pos) < 45) { S3.Audio.impact(end, msg.surface); if (Math.random() < 0.15 && msg.surface === 'metal') S3.Audio.ricochet(end); } }
          break;
        }
        case 'melee': {
          const mine = msg.shooter === this.localKey; const p = new THREE.Vector3(msg.x, msg.y, msg.z); const shooterActor = mine ? game.player : this.puppets[msg.shooter];
          const pos = shooterActor ? shooterActor.pos : p;
          if (msg.hit === 'actor') { game.effects.blood(p.x, p.y, p.z, msg.nx, msg.ny, msg.nz); S3.Audio.knifeHit(mine ? null : pos); }
          else if (msg.hit === 'world') { game.effects.impact(p.x, p.y, p.z, msg.nx, msg.ny, msg.nz, 'concrete'); S3.Audio.knifeWall(mine ? null : pos); }
          else S3.Audio.knifeSwing(mine ? null : pos);
          break;
        }
        case 'nade': this.updateNadePuppet(msg); break;
        case 'nadeend': {
          this.removeNadePuppet(msg.id); const p = new THREE.Vector3(msg.x, msg.y, msg.z);
          if (msg.wid === 'he') { game.effects.explosion(p.x, p.y, p.z, false); S3.Audio.explosion(p); game.shake(p, 12, 0.5); }
          else if (msg.wid === 'flash') { game.effects.flashEffect(p.x, p.y, p.z); S3.Audio.flashbang(p); }
          else if (msg.wid === 'smoke') { game.effects.smokeCloud(p.x, p.y, p.z, S3.WEAPONS.smoke.radius, S3.WEAPONS.smoke.duration); }
          else if (msg.wid === 'molotov') { game.effects.fireArea(p.x, p.y, p.z, S3.WEAPONS.molotov.radius, S3.WEAPONS.molotov.duration, null); game.effects.explosion(p.x, p.y, p.z, false); S3.Audio.explosion(p, false); }
          break;
        }
        case 'bombplant': { const p = new THREE.Vector3(msg.x, msg.y, msg.z); game.effects.placeBomb(p); S3.Audio.bombPlanted(); break; }
        case 'bombdefuse': game.effects.removeBomb(); S3.Audio.bombDefused(); break;
        case 'bombexplode': { const p = new THREE.Vector3(msg.x, msg.y, msg.z); game.effects.removeBomb(); game.effects.explosion(p.x, p.y, p.z, true); S3.Audio.explosion(p, true); game.shake(p, 40, 1.5); break; }
        case 'hitmarker': game.hud.hitmarkerShow(msg.head, msg.kill); S3.Audio.hitmarker(msg.head); break;
        case 'killconfirm': S3.Audio.killConfirm(); break;
        case 'death': { const att = msg.attacker ? (msg.attacker === this.localKey ? game.player : this.puppets[msg.attacker]) : null; S3.Audio.death(); game.player.spectateTarget = att || null; if (att) game.hud.addChat(`<span class="sys">Вас убил ${msg.attackerName} (${S3.WEAPONS[msg.wid] ? S3.WEAPONS[msg.wid].name : msg.wid})${msg.hs ? ' — в голову' : ''}</span>`); break; }
        case 'flashed': { const p = game.player; p.flashT = Math.max(p.flashT, msg.dur); p.flashMax = msg.dur; S3.Audio.flashRing(msg.dur * 0.7); break; }
        case 'progress': game.hud.setProgress(msg.label, msg.frac); break;
        case 'hint': game.hud.setHint(msg.text); break;
        case 'levelup': S3.Audio.levelUp(); game.hud.showBanner(`Уровень ${msg.level + 1}`, S3.WEAPONS[msg.wid] ? S3.WEAPONS[msg.wid].name : '', 1.5, '#ffd060'); break;
      }
    }
    // ---- per-frame ----
    update(dt) {
      // interpolate puppets toward their latest reported transform
      for (const k in this.puppets) {
        const p = this.puppets[k]; if (!p.targetPos) continue;
        const delta = this.game.tmp.copy(p.targetPos).sub(p.pos);
        const dist = delta.length();
        if (dist > 4) p.pos.copy(p.targetPos); else if (dist > 0.001) p.pos.addScaledVector(delta, Math.min(1, dt * 14));
        p.wishDir = p.wishDir || new THREE.Vector3(); p.wishDir.copy(delta); if (dist < 0.05) p.wishDir.set(0, 0, 0);
        p.speedFrac = Math.min(1, dist * 6);
        if (p.targetYaw !== undefined) p.yaw = S3.angleWrap(p.yaw + S3.angleWrap(p.targetYaw - p.yaw) * Math.min(1, dt * 16));
        if (p.targetPitch !== undefined) p.pitch += (p.targetPitch - p.pitch) * Math.min(1, dt * 16);
        p.updateModel(dt);
      }
      for (const id in this.nadePuppets) { const np = this.nadePuppets[id]; np.mesh.position.lerp(np.target, Math.min(1, dt * 12)); np.mesh.rotation.x += dt * 6; }
      // gentle reconciliation of the local player's predicted position toward the host's version
      const p = this.game.player;
      if (this.serverPos && p.alive) {
        const drift = p.pos.distanceTo(this.serverPos);
        if (drift > 3.5) { p.pos.copy(this.serverPos); p.vel.set(0, 0, 0); }
        else if (drift > 0.25) p.pos.lerp(this.serverPos, Math.min(1, dt * 6));
      }
    }
  }
  S3.ClientSync = ClientSync;
  function hash(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return h; }
})();
