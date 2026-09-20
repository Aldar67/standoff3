// ===== Standoff 3 — Actor: shared logic for player & bots (movement, inventory, damage) =====
'use strict';
(function () {
  const S3 = window.S3;
  const PH = S3.PHYS;
  let nextId = 1;

  class Actor {
    constructor(game, opts) {
      this.game = game; this.id = nextId++;
      this.name = opts.name || 'Actor'; this.team = opts.team || 'CT'; this.isBot = !!opts.isBot; this.isPlayer = !this.isBot;
      // isLocal: true only for the actual human sitting at THIS machine (drives viewmodel/HUD/2D-audio/stat-tracking).
      // Defaults to isPlayer (unchanged behaviour for solo play & bots); explicitly false for network puppets/remote humans.
      this.isLocal = opts.isLocal !== undefined ? opts.isLocal : this.isPlayer;
      this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0;
      this.punchPitch = 0; this.punchYaw = 0;
      this.body = { pos: this.pos, vel: this.vel, r: PH.radius, h: PH.height, onGround: false, groundSurface: 'concrete', jumping: false, landSpeed: 0 };
      this.crouching = false; this.crouchAmt = 0; this.walking = false; this.scoped = false; this.zoomLevel = 0;
      this.health = 100; this.armor = 0; this.helmet = false; this.defuser = false; this.alive = false; this.money = S3.ECON.startMoney;
      this.kills = 0; this.deaths = 0; this.assists = 0; this.score = 0; this.roundKills = 0; this.damageDealt = 0; this.mvps = 0; this.headshots = 0;
      this.inv = { primary: null, secondary: null, melee: new S3.Weapon('knife'), grenades: [], bomb: null };
      this.current = this.inv.melee; this.lastWeapon = null;
      this.wishDir = new THREE.Vector3(); this.wantJump = false; this.wantCrouch = false;
      this.lastAttacker = null; this.lastDamageT = -99; this.damagers = {};
      this.spawnProtect = 0; this.stepDist = 0; this.flashT = 0; this.flashMax = 0; this.burnT = 0;
      this.deadT = 0; this.respawnT = 0; this.diedAt = new THREE.Vector3();
      this.model = null; this.skinIdx = opts.skinIdx || 0; this.level = 0;
      this.lossStreak = 0; this.hasBomb = false; this.planting = false; this.plantT = 0; this.defusing = false; this.defuseT = 0;
      this.fireHeld = false; this.firePressed = false; this.altHeld = false; this.altPressed = false;
      this.footstepT = 0; this.tmpV = new THREE.Vector3(); this.speedFrac = 0; this.firing = 0;
      this.lastNoiseT = 0; this.ping = 0;
    }
    // generic third-person visual update for any actor that carries a CharacterModel
    // (bots override this with an identical call; remote-human actors and client puppets use it directly)
    updateModel(dt) { if (this.model) S3.animateCharacterVisual(this, dt); }
    get eyeHeight() { return PH.eyeStand - (PH.eyeStand - PH.eyeCrouch) * this.crouchAmt; }
    eyePos(out) { out = out || this.tmpV; return out.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z); }
    forward(out) { out = out || new THREE.Vector3(); const cp = Math.cos(this.pitch); return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp); }
    aimDir(out) { // includes recoil punch
      out = out || new THREE.Vector3(); const p = this.pitch + this.punchPitch * S3.DEG, y = this.yaw + this.punchYaw * S3.DEG; const cp = Math.cos(p);
      return out.set(-Math.sin(y) * cp, Math.sin(p), -Math.cos(y) * cp);
    }
    flatForward(out) { out = out || new THREE.Vector3(); return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
    right(out) { out = out || new THREE.Vector3(); return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
    get maxSpeed() { const w = this.current; return (w && w.def.moveSpeed) || 5.0; }

    // ---- inventory ----
    giveWeapon(id, silent) {
      const d = S3.WEAPONS[id]; if (!d) return null;
      if (d.type === 'grenade') {
        let g = this.inv.grenades.find((x) => x.id === id);
        if (g) { if (g.count >= (d.max || 1)) return null; g.count++; return g; }
        g = new S3.Weapon(id); g.count = 1; this.inv.grenades.push(g); return g;
      }
      if (d.slot === 'bomb') { this.inv.bomb = new S3.Weapon('bomb'); this.hasBomb = true; return this.inv.bomb; }
      const slot = d.slot; const old = this.inv[slot];
      const w = new S3.Weapon(id); this.inv[slot] = w;
      if (old && !silent) this.game.dropWeaponFrom(this, old);
      if (!silent) this.select(w);
      return w;
    }
    select(w, force) {
      if (!w || (w === this.current && !force)) return;
      if (this.current && this.current !== w) { this.lastWeapon = this.current; }
      this.current = w; w.draw(); this.scoped = false; this.zoomLevel = 0; this.planting = false;
      if (this.onWeaponChange) this.onWeaponChange(w);
      if (this.isLocal) S3.Audio.weaponSwitch(); else S3.Audio.weaponSwitch(this.pos);
    }
    selectSlot(n) {
      const inv = this.inv; let w = null;
      if (n === 1) w = inv.primary; else if (n === 2) w = inv.secondary; else if (n === 3) w = inv.melee; else if (n === 4) {
        if (inv.grenades.length) { const i = inv.grenades.indexOf(this.current); w = inv.grenades[(i + 1) % inv.grenades.length] || inv.grenades[0]; if (this.current === w && inv.grenades.length > 1) w = inv.grenades[(i + 1) % inv.grenades.length]; }
      } else if (n === 5) w = inv.bomb;
      if (w) this.select(w);
    }
    weaponList() { const l = []; const inv = this.inv; if (inv.primary) l.push(inv.primary); if (inv.secondary) l.push(inv.secondary); l.push(inv.melee); for (const g of inv.grenades) l.push(g); if (inv.bomb) l.push(inv.bomb); return l; }
    cycleWeapon(dir) { const l = this.weaponList(); let i = l.indexOf(this.current); i = (i + dir + l.length) % l.length; this.select(l[i]); }
    bestWeapon() { return this.inv.primary || this.inv.secondary || this.inv.melee; }
    removeWeapon(w) {
      if (!w) return; if (w === this.inv.primary) this.inv.primary = null; else if (w === this.inv.secondary) this.inv.secondary = null;
      else if (w === this.inv.bomb) { this.inv.bomb = null; this.hasBomb = false; }
      else { const i = this.inv.grenades.indexOf(w); if (i >= 0) this.inv.grenades.splice(i, 1); }
      if (this.current === w) this.select(this.bestWeapon(), true);
    }
    consumeGrenade(w) { w.count--; if (w.count <= 0) { this.removeWeapon(w); } }
    resetInventory() { this.inv = { primary: null, secondary: null, melee: new S3.Weapon('knife'), grenades: [], bomb: null }; this.hasBomb = false; this.current = this.inv.melee; this.lastWeapon = null; }
    hasGrenade(id) { const g = this.inv.grenades.find((x) => x.id === id); return g && g.count > 0 ? g : null; }

    // ---- spawn / death ----
    spawnAt(x, y, z, yaw) {
      this.pos.set(x, y + 0.05, z); this.vel.set(0, 0, 0); this.yaw = yaw; this.pitch = 0; this.punchPitch = 0; this.punchYaw = 0;
      this.health = 100; this.alive = true; this.crouching = false; this.crouchAmt = 0; this.body.h = PH.height; this.body.onGround = true; this.body.jumping = false;
      this.planting = false; this.plantT = 0; this.defusing = false; this.defuseT = 0; this.flashT = 0; this.burnT = 0; this.damagers = {}; this.lastAttacker = null; this.roundKills = 0;
      this.scoped = false; this.zoomLevel = 0; this.deadT = 0; this.spawnProtect = 0;
      if (this.model) { this.model.reset(); this.model.root.visible = true; }
    }
    die(attacker, weaponId, headshot, dirX, dirZ) {
      if (!this.alive) return; this.alive = false; this.deaths++; this.deadT = 0; this.diedAt.copy(this.pos);
      this.planting = false; this.defusing = false; this.scoped = false; this.zoomLevel = 0;
      if (this.model) { this.model.die(dirX || 0, dirZ || 1, headshot); this.model.root.userData.yaw = this.yaw; }
      this.game.onActorDeath(this, attacker, weaponId, headshot);
    }
    // ---- damage ----
    takeDamage(amount, attacker, zone, weaponId, dirX, dirZ, opts) {
      if (!this.alive || this.spawnProtect > 0) return 0; opts = opts || {};
      const wd = S3.WEAPONS[weaponId] || {};
      let dmg = amount;
      const headshot = zone === 'head';
      if (headshot) dmg *= wd.headMult || 4; else if (zone === 'legs') dmg *= 0.75;
      // armor
      const armored = this.armor > 0 && (zone !== 'head' ? (zone !== 'legs') : this.helmet) && !opts.ignoreArmor;
      if (armored) {
        const pen = wd.armorPen !== undefined ? wd.armorPen : 0.7; const after = dmg * pen; const absorbed = (dmg - after) * 0.5;
        if (absorbed > this.armor) { dmg = after + (absorbed - this.armor); this.armor = 0; } else { this.armor -= absorbed; dmg = after; }
        if (zone === 'head' && this.helmet && this.armor <= 0) this.helmet = false;
      }
      if (opts.grenade) dmg *= 1;
      dmg = Math.max(1, Math.round(dmg));
      if (attacker && attacker !== this && !this.game.isEnemy(attacker, this) && !this.game.friendlyFire) dmg = Math.round(dmg * 0.1);
      this.health -= dmg; this.lastAttacker = attacker; this.lastDamageT = this.game.time;
      if (attacker && attacker !== this) { this.damagers[attacker.id] = (this.damagers[attacker.id] || 0) + dmg; attacker.damageDealt += dmg; }
      if (this.onDamaged) this.onDamaged(dmg, attacker, zone, dirX, dirZ);
      if (this.health <= 0) { this.health = 0; this.die(attacker, weaponId, headshot, dirX, dirZ); }
      return dmg;
    }

    // ---- movement ----
    updateMovement(dt) {
      const b = this.body, v = this.vel;
      // crouch
      if (this.wantCrouch !== this.crouching) {
        if (this.wantCrouch) { this.crouching = true; b.h = PH.crouchHeight; }
        else if (this.game.world.fits(this.pos.x, this.pos.y, this.pos.z, b.r, PH.height)) { this.crouching = false; b.h = PH.height; }
      }
      this.crouchAmt = S3.damp(this.crouchAmt, this.crouching ? 1 : 0, 14, dt);
      let wishSpeed = this.maxSpeed; if (this.crouching) wishSpeed *= 0.52; else if (this.walking) wishSpeed *= 0.5;
      if (this.scoped) wishSpeed *= 0.6;
      if (this.planting || this.defusing) wishSpeed = 0;
      const wd = this.wishDir; const wl = Math.hypot(wd.x, wd.z);
      if (wl > 1e-4) { wd.x /= wl; wd.z /= wl; } else wishSpeed = 0;
      if (b.onGround) {
        // friction
        const sp = Math.hypot(v.x, v.z);
        if (sp > 0.001) { const drop = Math.max(sp, PH.stopSpeed) * PH.friction * dt; const ns = Math.max(0, sp - drop) / sp; v.x *= ns; v.z *= ns; } else { v.x = 0; v.z = 0; }
        if (wishSpeed > 0) { const cur = v.x * wd.x + v.z * wd.z; const add = wishSpeed - cur; if (add > 0) { const acc = Math.min(PH.accelGround * wishSpeed * dt, add); v.x += wd.x * acc; v.z += wd.z * acc; } }
        if (this.wantJump && !this.planting && !this.defusing) { v.y = PH.jumpVel; b.onGround = false; b.jumping = true; this.wantJump = false; if (this.isLocal) S3.Audio.jump(); else S3.Audio.jump(this.pos); this.game.emitNoise(this, 8); }
      } else {
        if (wishSpeed > 0) { const cap = Math.min(wishSpeed, PH.airSpeedCap); const cur = v.x * wd.x + v.z * wd.z; const add = cap - cur; if (add > 0) { const acc = Math.min(PH.accelAir * wishSpeed * dt, add); v.x += wd.x * acc; v.z += wd.z * acc; } }
        v.y -= PH.gravity * dt;
        if (v.y <= 0) b.jumping = false;
      }
      this.wantJump = false;
      const wasGround = b.onGround; b.landSpeed = 0;
      this.game.world.move(b, dt);
      if (!wasGround && b.onGround) {
        if (b.landSpeed > 4) { if (this.isLocal) S3.Audio.land(); else S3.Audio.land(this.pos); this.game.emitNoise(this, 10); }
        if (b.landSpeed > PH.maxFallDamageSpeed) this.takeDamage((b.landSpeed - PH.maxFallDamageSpeed) * 12, null, 'body', 'fall', 0, 0, { ignoreArmor: true });
      }
      const sp = Math.hypot(v.x, v.z); this.speedFrac = sp / 5.5;
      // footsteps
      if (b.onGround && sp > 1.5 && !this.walking && !this.crouching) {
        this.stepDist += sp * dt; if (this.stepDist > 2.3) { this.stepDist = 0; const surf = b.groundSurface || 'concrete'; if (this.isLocal) S3.Audio.footstep(null, surf, 0.6); else S3.Audio.footstep(this.pos, surf, 1); this.game.emitNoise(this, 14); }
      } else if (b.onGround && sp > 0.5) { this.stepDist += sp * dt * 0.4; }
      // recoil recovery
      const rec = (this.current && this.current.def.recoilRecover) || 8;
      this.punchPitch = S3.damp(this.punchPitch, 0, rec * 0.6, dt); this.punchYaw = S3.damp(this.punchYaw, 0, rec * 0.6, dt);
      if (this.flashT > 0) this.flashT -= dt;
      if (this.burnT > 0) { this.burnT -= dt; }
      if (this.spawnProtect > 0) this.spawnProtect -= dt;
    }
    // ---- weapon usage ----
    weaponCtx() {
      const self = this; const w = this.current;
      return {
        speedFrac: this.speedFrac, onGround: this.body.onGround, crouching: this.crouching, scoped: this.scoped, isBot: this.isBot, alt: this.altHeld || this.altPressed,
        onShot: (dirs, rs, ru) => { if (self.isLocal && self.game.net && self.game.net.role === 'client') self.game.actorShootCosmetic(self, dirs, rs, ru); else self.game.actorShoot(self, dirs, rs, ru); },
        onKnife: (alt) => { if (self.isLocal && self.game.net && self.game.net.role === 'client') self.game.actorKnifeCosmetic(self, alt); else self.game.actorKnife(self, alt); },
        onDryFire: () => { if (self.isLocal) S3.Audio.dryfire(); else S3.Audio.dryfire(self.pos); },
        onBolt: (t) => { if (self.isLocal) { self.game.vm.play('bolt', Math.min(0.5, t * 0.5)); setTimeout(() => S3.Audio.boltAction(self.isLocal ? null : self.pos), 150); } else setTimeout(() => S3.Audio.boltAction(self.pos), 150); self.scoped = false; },
        onReloadStage: (st) => {
          const p = self.isLocal ? null : self.pos;
          if (st === 'start') { if (self.isLocal) self.game.vm.play('reload', w.def.reloadTime); self.scoped = false; }
          else if (st === 'magout') S3.Audio.reloadMagOut(p); else if (st === 'magin') S3.Audio.reloadMagIn(p); else if (st === 'done') S3.Audio.reloadSlide(p);
        },
        onReloadShell: () => { S3.Audio.reloadMagIn(self.isLocal ? null : self.pos); if (self.isLocal) self.game.vm.play('reloadShell', 0.35); },
      };
    }
    updateWeapon(dt) {
      const w = this.current; if (!w) return;
      const ctx = this.weaponCtx(); w.update(dt, ctx);
      if (this.alive) {
        const fired = w.trigger(ctx, this.fireHeld, this.firePressed);
        if (fired) this.firing = 0.12;
        // auto reload when empty & idle
        if (w.isGun && w.ammo <= 0 && w.reserve > 0 && !w.reloading && w.cooldown <= 0 && w.boltT <= 0 && !this.fireHeld) w.reload(ctx);
      }
      this.firing = Math.max(0, this.firing - dt); this.firePressed = false; this.altPressed = false;
    }
    // Buying (shared by bots & player)
    canBuy() { return this.game.mode.canBuy(this); }
    buy(id) {
      const g = S3.GEAR[id]; const price = g ? g.price : (S3.WEAPONS[id] ? S3.WEAPONS[id].price : 0);
      if (!this.canBuy()) return { ok: false, reason: 'Покупка недоступна' };
      const free = this.game.mode.freeBuy;
      if (!free && this.money < price) return { ok: false, reason: 'Недостаточно денег' };
      if (g) {
        if (id === 'kevlar') { if (this.armor >= 100 && !this.helmet) return { ok: false, reason: 'Уже есть' }; this.armor = 100; }
        else if (id === 'helmet') { if (this.armor >= 100 && this.helmet) return { ok: false, reason: 'Уже есть' }; if (this.armor >= 100) { if (!free) this.money -= 350; this.helmet = true; return { ok: true }; } this.armor = 100; this.helmet = true; }
        else if (id === 'defuser') { if (this.team !== 'CT') return { ok: false, reason: 'Только для спецназа' }; if (this.defuser) return { ok: false, reason: 'Уже есть' }; this.defuser = true; }
        if (!free) this.money -= price; return { ok: true };
      }
      const d = S3.WEAPONS[id]; if (!d) return { ok: false, reason: '???' };
      if (d.type === 'grenade') { const ex = this.inv.grenades.find((x) => x.id === id); if (ex && ex.count >= (d.max || 1)) return { ok: false, reason: 'Максимум' }; const totalG = this.inv.grenades.reduce((a, x) => a + x.count, 0); if (totalG >= 4) return { ok: false, reason: 'Максимум гранат' }; }
      else { const cur = this.inv[d.slot]; if (cur && cur.id === id) { if (cur.ammo + cur.reserve >= d.mag + d.reserve) return { ok: false, reason: 'Уже есть' }; cur.reserve = d.reserve; cur.ammo = d.mag; if (!free) this.money -= Math.min(price, 200); return { ok: true }; } }
      if (!free) this.money -= price;
      this.giveWeapon(id, false);
      return { ok: true };
    }
  }
  S3.Actor = Actor;
})();
