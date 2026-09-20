// ===== Standoff 3 — LAN multiplayer: HOST side sync =====
// The host runs the exact same authoritative simulation as solo play (map, physics, bots,
// modes, hit detection). This module's only jobs are: (1) turn each connected human into a
// plain Actor driven by network packets instead of AI/keyboard, (2) broadcast periodic world
// snapshots + one-off events so every client can render the same game, and (3) route the
// per-player-only feedback (hitmarkers, progress bars, private chat) to the right client.
//
// Identity scheme: every actor gets a stable string `netKey` used in snapshots/puppet maps
// (bots: "bot"+id, the host's own avatar: "host", a remote human: "h"+<their relay id>).
// Humans additionally get a numeric `netConnId` (their relay connection id) used only to
// address a single client with a *targeted* event (the relay itself only supports
// broadcast-from-host / forward-to-host, so targeted delivery is done by broadcasting with a
// `for: connId` tag that every client checks against its own id and ignores otherwise).
'use strict';
(function () {
  const S3 = window.S3;
  const SNAP_HZ = 20;

  class HostSync {
    constructor(game, net) {
      this.game = game; this.net = net; this.role = 'host';
      this.remotes = {}; // connId -> { actor, input: RemoteInput }
      this.nadeIds = new Map(); this.nadeCounter = 1;
      this.snapT = 0; this.tick = 0;
      net.on('input', (msg) => { const r = this.remotes[msg._from]; if (r) r.input.applyPacket(msg, game.time); });
      net.on('buy', (msg) => { const r = this.remotes[msg._from]; if (r && r.actor.alive && this.game.mode.canBuy(r.actor)) r.actor.buy(msg.id); });
      net.on('buyopen', (msg) => { const r = this.remotes[msg._from]; if (r) r.actor.remoteBuyOpen = !!msg.open; });
      net.on('throw', (msg) => { const r = this.remotes[msg._from]; if (r && r.actor.alive) { const w = r.actor.hasGrenade(msg.wid) || (r.actor.current && r.actor.current.id === msg.wid ? r.actor.current : null); if (w) game.throwGrenade(r.actor, w, msg.strength || 1); } });
      net.on('radio', (msg) => { const r = this.remotes[msg._from]; if (r) { const rd = S3.RADIO.find((x) => x.key === msg.key); if (rd) game.radio(r.actor, rd.text); } });
      net.on('takeover', (msg) => { const r = this.remotes[msg._from]; if (!r) return; const bot = game.bots.find((b) => b.netKey === msg.key); if (bot) game.takeOverBot(r.actor, bot); });
      net.on('chat', (msg) => { const r = this.remotes[msg._from]; if (r && typeof msg.text === 'string') game.chatFrom(r.actor, msg.text.slice(0, 120)); });
      net.on('leave', (id) => { const r = this.remotes[id]; if (r && r.actor.alive) { r.actor.health = 0; r.actor.alive = false; if (r.actor.model) r.actor.model.root.visible = false; this.broadcastChat(`<span class="sys">${r.actor.name} отключился</span>`); } });
      net.on('hello', (msg) => { net.send({ t: 'ev', k: 'toolate', for: msg._from }); }); // match already started
    }
    // called once per connected human before match start, in join order (the host's own player
    // is NOT added here -- see setLocalKey() below).
    addRemote(connId, name, team, skinIdx, skins) {
      const game = this.game;
      const actor = new S3.Actor(game, { name: name || ('Игрок ' + connId), team, isBot: false, isLocal: false, skinIdx });
      actor.setSkins(skins);
      actor.netKey = 'h' + connId; actor.netConnId = connId; actor.remoteInput = true; actor.remoteBuyOpen = false;
      S3.attachCharacterModel(actor, game.scene, skinIdx || 0);
      game.actors.push(actor);
      this.remotes[connId] = { actor, input: new S3.RemoteInput() };
      return actor;
    }
    setLocalKey() { this.game.player.netKey = 'host'; this.game.player.netConnId = this.net.myId; }
    tagBots() { for (const b of this.game.bots) if (!b.netKey) b.netKey = 'bot' + b.id; }

    // ---- per-tick input application for one remote human (mirrors what Player.handleInput does
    // for the local human, minus anything HUD/viewmodel-specific which lives on that human's own client) ----
    applyInput(actor, dt) {
      const game = this.game; const inp = this.remotes[actor.netConnId] && this.remotes[actor.netConnId].input;
      if (!inp || !inp.ready) { actor.wishDir.set(0, 0, 0); actor.fireHeld = false; actor.firePressed = false; return; }
      const frozen = game.mode.frozen(actor); const canAct = !frozen && !actor.remoteBuyOpen;
      actor.yaw = inp.yaw; actor.pitch = S3.clamp(inp.pitch, -89 * S3.DEG, 89 * S3.DEG);
      if (canAct) { actor.wishDir.set(inp.wx, 0, inp.wz); if (inp.jump && actor.body.onGround) actor.wantJump = true; }
      else actor.wishDir.set(0, 0, 0);
      actor.wantCrouch = inp.crouch; actor.walking = inp.walk;
      actor.fireHeld = canAct && inp.fire; actor.firePressed = canAct && inp.takeFirePressed();
      actor.altHeld = canAct && inp.alt; const altPressed = inp.takeAltPressed(); actor.altPressed = canAct && altPressed;
      const w = actor.current;
      if (canAct && w && w.def.zoom && altPressed && !w.busy) { actor.zoomLevel = (actor.zoomLevel + 1) % (w.def.zoom.length + 1); actor.scoped = actor.zoomLevel > 0; }
      if (w && !w.def.zoom) { actor.scoped = false; actor.zoomLevel = 0; }
      if (w && w.def.type === 'knife' && canAct && altPressed) { actor.altPressed = true; actor.firePressed = true; }
      if (canAct && inp.takeReload() && actor.current) actor.current.reload(actor.weaponCtx());
      if (canAct && inp.takeLastWeapon() && actor.lastWeapon && actor.weaponList().includes(actor.lastWeapon)) actor.select(actor.lastWeapon);
      const slot = canAct ? inp.takeSlot() : 0; if (slot) actor.selectSlot(slot);
      if (canAct && inp.takeUseTap()) game.tryPickup(actor);
      if (w && w.def.type === 'bomb') { if (canAct && game.mode.tryPlant) game.mode.tryPlant(actor, dt, actor.fireHeld); actor.fireHeld = false; actor.firePressed = false; }
      if (game.mode.tryDefuse) game.mode.tryDefuse(actor, dt, canAct && inp.useDown);
    }
    // split in two so the per-tick order in Game.update() can apply input BEFORE physics and
    // broadcast the snapshot AFTER physics (reflecting this tick's resolved positions).
    applyAllInputs(dt) { for (const id in this.remotes) this.applyInput(this.remotes[id].actor, dt); }
    tickSnapshot(dt) { this.snapT -= dt; if (this.snapT <= 0) { this.snapT = 1 / SNAP_HZ; this.broadcastSnapshot(); } }
    modeSnapshot() {
      const m = this.game.mode; const st = m.hudState();
      return { id: m.id, phase: m.phase, timer: st.timer, timerClass: st.timerClass || '', roundLabel: st.roundLabel || '',
        scoreCT: st.scoreCT, scoreT: st.scoreT, freeBuy: !!m.freeBuy, over: !!m.over,
        bombPlanted: !!m.bombPlanted, bombPos: m.bombPos ? { x: m.bombPos.x, y: m.bombPos.y, z: m.bombPos.z } : null, bombTimeLeft: m.bombTimeLeft || 0 };
    }
    broadcastSnapshot() {
      const game = this.game; this.tick++;
      const actors = game.actors.filter((a) => a.netKey).map((a) => {
        const w = a.current;
        return { k: a.netKey, name: a.name, team: a.team, x: +a.pos.x.toFixed(2), y: +a.pos.y.toFixed(2), z: +a.pos.z.toFixed(2), yaw: +a.yaw.toFixed(3), pitch: +a.pitch.toFixed(3), hp: Math.round(a.health), armor: Math.round(a.armor), helmet: !!a.helmet, alive: !!a.alive, hid: !!a.takenOver, wid: w ? w.id : null, ws: (w && w.skin) || null, ammo: w ? w.ammo : 0, reserve: w ? w.reserve : 0, gcount: w && w.def.type === 'grenade' ? w.count : 0, reloading: !!(w && w.reloading), crouch: +a.crouchAmt.toFixed(2), level: a.level || 0, kills: a.kills, deaths: a.deaths, assists: a.assists, score: a.score, money: Math.round(a.money), hasBomb: !!a.hasBomb, defuser: !!a.defuser, firing: a.firing > 0, isBot: !!a.isBot, diff: a.isBot ? a.diffName : null, scoped: !!a.scoped };
      });
      const grenades = game.effects.grenades.map((g) => { if (!this.nadeIds.has(g)) this.nadeIds.set(g, this.nadeCounter++); return { id: this.nadeIds.get(g), wid: g.id, x: +g.pos.x.toFixed(2), y: +g.pos.y.toFixed(2), z: +g.pos.z.toFixed(2) }; });
      this.net.send({ t: 'snap', tick: this.tick, time: +game.time.toFixed(2), mode: this.modeSnapshot(), actors, grenades });
    }
    // ---- public/broadcast helpers ----
    broadcastChat(html) { this.net.send({ t: 'ev', k: 'chat', html }); }
    broadcastBanner(text, sub, dur, color) { this.net.send({ t: 'ev', k: 'banner', text, sub: sub || '', dur: dur || 3, color: color || '#fff' }); }
    broadcastKillfeed(att, vic, weaponId, headshot) { this.net.send({ t: 'ev', k: 'kf', att: att ? att.netKey : null, attName: att ? att.name : null, attTeam: att ? att.team : null, vic: vic.netKey, vicName: vic.name, vicTeam: vic.team, wid: weaponId, hs: !!headshot }); }
    broadcastRadio(actor, text) { this.net.send({ t: 'ev', k: 'radio', team: actor.team, name: actor.name, text }); }
    // ---- targeted per-player feedback (for: relay connection id of the recipient) ----
    sendShotFeedback(actor, weaponId, muzzle, endPoint, normal, hitKind, victim, zone, surface) {
      normal = normal || { x: 0, y: 1, z: 0 };
      this.net.send({ t: 'ev', k: 'shot', shooter: actor.netKey, wid: weaponId, mx: +muzzle.x.toFixed(2), my: +muzzle.y.toFixed(2), mz: +muzzle.z.toFixed(2), ex: +endPoint.x.toFixed(2), ey: +endPoint.y.toFixed(2), ez: +endPoint.z.toFixed(2), nx: +normal.x.toFixed(2), ny: +normal.y.toFixed(2), nz: +normal.z.toFixed(2), hit: hitKind, victim: victim ? victim.netKey : null, zone: zone || null, surface: surface || null });
    }
    sendMeleeFeedback(actor, alt, hitKind, point, normal, victim, zone, back) {
      normal = normal || { x: 0, y: 1, z: 0 };
      this.net.send({ t: 'ev', k: 'melee', shooter: actor.netKey, alt: !!alt, hit: hitKind, x: point ? +point.x.toFixed(2) : 0, y: point ? +point.y.toFixed(2) : 0, z: point ? +point.z.toFixed(2) : 0, nx: +normal.x.toFixed(2), ny: +normal.y.toFixed(2), nz: +normal.z.toFixed(2), victim: victim ? victim.netKey : null, zone: zone || null, back: !!back });
    }
    sendNadeThrow(g) { this.nadeIds.set(g, this.nadeCounter++); this.net.send({ t: 'ev', k: 'nade', id: this.nadeIds.get(g), wid: g.id, x: +g.pos.x.toFixed(2), y: +g.pos.y.toFixed(2), z: +g.pos.z.toFixed(2), vx: +g.vel.x.toFixed(2), vy: +g.vel.y.toFixed(2), vz: +g.vel.z.toFixed(2) }); }
    sendNadeEnd(g, extra) { const id = this.nadeIds.get(g) || 0; this.net.send(Object.assign({ t: 'ev', k: 'nadeend', id, wid: g.id, x: +g.pos.x.toFixed(2), y: +g.pos.y.toFixed(2), z: +g.pos.z.toFixed(2) }, extra || {})); }
    sendBombEvent(kind, pos, site) { this.net.send({ t: 'ev', k: kind, x: pos ? +pos.x.toFixed(2) : 0, y: pos ? +pos.y.toFixed(2) : 0, z: pos ? +pos.z.toFixed(2) : 0, site: site || null }); }
    sendHitmarker(actor, head, kill) { this.net.send({ t: 'ev', k: 'hitmarker', for: actor.netConnId, head: !!head, kill: !!kill }); }
    sendKillConfirm(actor) { this.net.send({ t: 'ev', k: 'killconfirm', for: actor.netConnId }); }
    sendDeathFeedback(victim, attacker, weaponId, headshot) { this.net.send({ t: 'ev', k: 'death', for: victim.netConnId, attacker: attacker ? attacker.netKey : null, attackerName: attacker ? attacker.name : null, wid: weaponId, hs: !!headshot }); }
    sendFlashed(actor, dur) { this.net.send({ t: 'ev', k: 'flashed', for: actor.netConnId, dur: +dur.toFixed(2) }); }
    sendProgress(actor, label, frac) { this.net.send({ t: 'ev', k: 'progress', for: actor.netConnId, label: label || '', frac: frac === null || frac === undefined ? null : +frac.toFixed(3) }); }
    sendHint(actor, text) { this.net.send({ t: 'ev', k: 'hint', for: actor.netConnId, text: text || '' }); }
    sendPrivateChat(actor, html) { this.net.send({ t: 'ev', k: 'chat', for: actor.netConnId, html }); }
    sendLevelUp(actor) { this.net.send({ t: 'ev', k: 'levelup', for: actor.netConnId, level: actor.level, wid: S3.ARMS_RACE_ORDER[actor.level] }); }
  }
  S3.HostSync = HostSync;
})();
