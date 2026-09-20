// ===== Standoff 3 — Player (input, camera, first-person interactions) =====
'use strict';
(function () {
  const S3 = window.S3;

  class Player extends S3.Actor {
    constructor(game, opts) {
      super(game, Object.assign({ isBot: false }, opts));
      this.onWeaponChange = (w) => { game.vm.setWeapon(w.id, this.team); this.pinPulled = false; };
      this.pinPulled = false; this.throwCooldown = 0; this.crouchToggled = false; this.landDip = 0; this.viewRoll = 0;
      this.mouseDX = 0; this.mouseDY = 0; this.fovZoom = 0; this.spectateTarget = null; this.hitFlash = 0; this.inspectT = 0;
      this.onDamaged = (dmg, attacker, zone, dx, dz) => {
        S3.Audio.hurt(); this.hitFlash = Math.min(1, this.hitFlash + dmg / 60);
        if (attacker && attacker !== this) { const ax = attacker.pos.x - this.pos.x, az = attacker.pos.z - this.pos.z; const ang = Math.atan2(ax, -az) - this.yaw; game.hud.damageIndicator(ang); }
        else if (dx || dz) { const ang = Math.atan2(-dx, dz) - this.yaw; game.hud.damageIndicator(ang); }
      };
    }
    handleInput(dt) {
      const I = S3.Input, game = this.game, S = S3.Settings.data;
      const [dx, dy] = I.consumeMouse(); this.mouseDX = dx; this.mouseDY = dy;
      if (!I.locked || game.paused) { this.wishDir.set(0, 0, 0); this.fireHeld = false; this.fireHeld = false; return; }
      const zoomMul = this.scoped ? (this.zoomLevel === 2 ? 0.25 : 0.5) : 1;
      const sens = S.sensitivity * 0.0022 * zoomMul;
      this.yaw -= dx * sens; this.pitch -= dy * sens * (S.invertY ? -1 : 1);
      this.pitch = S3.clamp(this.pitch, -89 * S3.DEG, 89 * S3.DEG); this.yaw = S3.angleWrap(this.yaw);
      if (!this.alive) { this.wishDir.set(0, 0, 0); this.fireHeld = false; if (I.btnPressed[0]) game.nextSpectate(); return; }
      const frozen = game.mode.frozen(this);
      const f = (I.down('forward') ? 1 : 0) - (I.down('back') ? 1 : 0); const r = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0);
      const wd = this.wishDir; wd.set(0, 0, 0);
      if (!frozen && !game.hud.buyOpen) {
        wd.x = -Math.sin(this.yaw) * f + Math.cos(this.yaw) * r; wd.z = -Math.cos(this.yaw) * f - Math.sin(this.yaw) * r;
        if (I.down('jump') && this.body.onGround) this.wantJump = true;
      }
      if (S.crouchToggle) { if (I.justPressed('crouch')) this.crouchToggled = !this.crouchToggled; this.wantCrouch = this.crouchToggled; } else this.wantCrouch = I.down('crouch');
      this.walking = I.down('walk');
      // weapon selection
      if (I.justPressed('slot1')) this.selectSlot(1); if (I.justPressed('slot2')) this.selectSlot(2); if (I.justPressed('slot3')) this.selectSlot(3); if (I.justPressed('slot4')) this.selectSlot(4); if (I.justPressed('slot5')) this.selectSlot(5);
      if (I.justPressed('lastWeapon') && this.lastWeapon && this.weaponList().includes(this.lastWeapon)) this.select(this.lastWeapon);
      const wheel = I.consumeWheel(); if (wheel) this.cycleWeapon(wheel > 0 ? 1 : -1);
      if (I.justPressed('reload') && this.current) { if (this.current.reload(this.weaponCtx())) { } }
      if (I.justPressed('drop') && this.current && this.current !== this.inv.melee && !frozen) { game.dropWeaponFrom(this, this.current, true); }
      if (I.justPressed('inspect') && this.current && !this.current.busy) { game.vm.play('inspect', 1.6); }
      if (I.justPressed('buy')) game.hud.toggleBuy();
      const w = this.current;
      const canAct = !frozen && !game.hud.buyOpen;
      this.fireHeld = canAct && I.buttons[0]; this.firePressed = canAct && I.btnPressed[0]; this.altHeld = canAct && I.buttons[2]; this.altPressed = canAct && I.btnPressed[2];
      // scoped weapons / zoom
      if (w && w.def.zoom && canAct && I.btnPressed[2] && !w.busy) { this.zoomLevel = (this.zoomLevel + 1) % (w.def.zoom.length + 1); this.scoped = this.zoomLevel > 0; S3.Audio.weaponSwitch(); }
      if (w && !w.def.zoom) { this.scoped = false; this.zoomLevel = 0; }
      if (w && w.reloading) { this.scoped = false; this.zoomLevel = 0; }
      // knife alt
      if (w && w.def.type === 'knife' && canAct) { if (I.btnPressed[2]) { this.altPressed = true; this.firePressed = true; } if (I.buttons[2]) this.altHeld = true; }
      const isNetClient = game.net && game.net.role === 'client';
      // grenades
      if (w && w.def.type === 'grenade' && canAct && w.drawT <= 0) {
        if (!this.pinPulled && (I.buttons[0] || I.buttons[2]) && this.throwCooldown <= 0) { this.pinPulled = true; this.pinAlt = I.buttons[2] && !I.buttons[0]; game.vm.play('pin', 0.3); S3.Audio.pinPull(); }
        else if (this.pinPulled && !I.buttons[0] && !I.buttons[2]) {
          this.pinPulled = false; const strength = this.pinAlt ? 0.45 : 1.0; game.vm.play('throw', 0.5); this.throwCooldown = 0.8; const wid = w.id;
          setTimeout(() => {
            if (!this.alive) return;
            if (isNetClient) {
              S3.Audio.throwSound(); game.net.sendThrow(wid, strength); this.consumeGrenade(w);
              const again = this.hasGrenade(wid); if (again) { if (this.current !== again) this.select(again, true); else again.draw(); } else this.select(this.bestWeapon(), true);
            } else game.throwGrenade(this, w, strength);
          }, 120);
        }
        this.fireHeld = false; this.firePressed = false;
      } else this.pinPulled = false;
      this.throwCooldown -= dt;
      // bomb planting: gameplay is host-authoritative (see HostSync.applyInput); a client only
      // needs the local viewmodel pose here, the progress bar arrives via a targeted network event.
      if (w && w.def.type === 'bomb' && canAct) {
        const wantPlant = I.buttons[0];
        const res = isNetClient ? (wantPlant ? 'planting' : null) : (game.mode.tryPlant ? game.mode.tryPlant(this, dt, wantPlant) : null);
        if (res === 'planting') { if (game.vm.anim !== 'plant') game.vm.play('plant', 99); } else if (game.vm.anim === 'plant') game.vm.anim = null;
        this.fireHeld = false; this.firePressed = false;
      } else if (game.vm.anim === 'plant') game.vm.anim = null;
      // defuse: same story — host runs the real tryDefuse for our remote avatar and pushes us
      // hint/progress events; nothing to simulate locally on a client.
      if (!isNetClient && game.mode.tryDefuse) game.mode.tryDefuse(this, dt, canAct && I.down('use') && !this.pinPulled);
      // pickup
      if (I.justPressed('use') && !isNetClient) game.tryPickup(this);
    }
    updateCamera(camera, dt) {
      const S = S3.Settings.data; const w = this.current;
      let eye = this.eyeHeight;
      if (this.body.landSpeed > 3 && this.body.onGround) this.landDip = Math.min(0.12, this.body.landSpeed * 0.012);
      this.landDip = S3.damp(this.landDip, 0, 10, dt);
      const bobA = this.body.onGround && this.speedFrac > 0.1 ? this.speedFrac * (this.walking ? 0.3 : 1) : 0;
      this.bobT = (this.bobT || 0) + dt * 9 * Math.max(0.3, this.speedFrac);
      const bobY = Math.abs(Math.sin(this.bobT)) * 0.025 * bobA, bobX = Math.cos(this.bobT) * 0.015 * bobA;
      let px = this.pos.x, py = this.pos.y + eye - this.landDip + bobY, pz = this.pos.z;
      if (!this.alive) { // death cam: fall to ground & look at killer / spectate
        const t = Math.min(1, this.deadT / 0.8); py = this.pos.y + S3.lerp(eye, 0.35, t);
        if (this.spectateTarget && this.spectateTarget.alive && this.deadT > 3) { const s = this.spectateTarget; px = s.pos.x; py = s.pos.y + s.eyeHeight; pz = s.pos.z; this.yaw = s.yaw; this.pitch = s.pitch; }
      }
      const rx = Math.cos(this.yaw) * bobX, rz = -Math.sin(this.yaw) * bobX;
      camera.position.set(px + rx, py, pz + rz);
      const roll = S3.damp(this.viewRoll || 0, -(this.vel.x * Math.cos(this.yaw) - this.vel.z * Math.sin(this.yaw)) * 0.003, 8, dt); this.viewRoll = roll;
      camera.rotation.set(0, 0, 0, 'YXZ'); camera.rotation.y = this.yaw + this.punchYaw * S3.DEG; camera.rotation.x = this.pitch + this.punchPitch * S3.DEG; camera.rotation.z = roll + (!this.alive ? Math.min(1, this.deadT / 0.8) * 0.6 : 0);
      let fov = S.fov; if (this.scoped && w && w.def.zoom) fov = w.def.zoom[Math.min(this.zoomLevel, w.def.zoom.length) - 1] || 40;
      this.fovZoom = S3.damp(this.fovZoom, fov, 18, dt);
      if (Math.abs(camera.fov - this.fovZoom) > 0.01) { camera.fov = this.fovZoom; camera.updateProjectionMatrix(); }
      this.hitFlash = Math.max(0, this.hitFlash - dt * 2);
    }
  }
  S3.Player = Player;
})();
