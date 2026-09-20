// ===== Standoff 3 — Bot AI (perception, navigation, combat, objectives) =====
'use strict';
(function () {
  const S3 = window.S3;
  const V = () => new THREE.Vector3();

  class Bot extends S3.Actor {
    constructor(game, opts) {
      super(game, Object.assign({ isBot: true }, opts));
      this.diffName = opts.difficulty || 'medium'; this.diff = S3.DIFFICULTY[this.diffName];
      this.model = new S3.CharacterModel(this.team, this.skinIdx); game.scene.add(this.model.root); this.model.root.visible = false;
      this.state = 'idle'; this.memory = {}; this.target = null; this.targetVisible = false; this.reactionT = 0; this.trackT = 0;
      this.path = null; this.pathIdx = 0; this.goal = null; this.repathT = 0; this.arrived = false;
      this.perceptT = Math.random() * 0.12; this.decideT = 0; this.holdT = 0; this.strafeT = 0; this.strafeDir = 1; this.moveMode = 'stand';
      this.burstLeft = 0; this.pauseT = 0; this.aimErr = new THREE.Vector3(); this.aimErrT = 0; this.aimPoint = V(); this.lookYaw = 0; this.lookPitch = 0;
      this.stuckT = 0; this.lastProgress = V(); this.progressT = 0; this.jumpCooldown = 0; this.crouchT = 0;
      this.objective = null; this.objT = 0; this.radioT = 0; this.grenadeT = 5 + Math.random() * 10; this.lookAroundT = 0; this.wanderT = 0;
      this.tmpA = V(); this.tmpB = V(); this.tmpC = V(); this.tmpD = V(); this.bodyYaw = 0; this.personality = { aggression: Math.random(), patience: Math.random(), camper: Math.random() < 0.25 };
      this.onWeaponChange = (w) => this.model.setWeapon(w.id);
      this.model.setWeapon('knife');
      this.compensation = { easy: 0.25, medium: 0.5, hard: 0.75, expert: 0.92 }[this.diffName];
      this.onDamaged = (dmg, attacker) => { if (attacker && this.game.isEnemy(attacker, this) && attacker.alive) { const m = this.remember(attacker); m.lastPos.copy(attacker.pos); m.lastSeen = this.game.time - 0.2; if (!this.target) { this.target = attacker; this.reactionT = this.diff.reaction * 0.5; } } };
    }
    setDifficulty(name) { this.diffName = name; this.diff = S3.DIFFICULTY[name]; this.compensation = { easy: 0.25, medium: 0.5, hard: 0.75, expert: 0.92 }[name]; }
    remember(actor) { let m = this.memory[actor.id]; if (!m) { m = this.memory[actor.id] = { actor, lastPos: V(), lastSeen: -99, visible: false, firstSeen: 0 }; } return m; }
    forgetAll() { this.memory = {}; this.target = null; this.targetVisible = false; }
    // ---- noise from game ----
    onNoise(actor, radius) {
      if (!this.alive || actor === this || !this.game.isEnemy(actor, this) || !actor.alive) return;
      const d = this.pos.distanceTo(actor.pos); if (d > radius * (this.diff.hearRange / 40)) return;
      const m = this.remember(actor); if (this.game.time - m.lastSeen < 0.5) return;
      m.lastPos.copy(actor.pos); m.lastPos.x += (Math.random() - 0.5) * d * 0.15; m.lastPos.z += (Math.random() - 0.5) * d * 0.15; m.lastSeen = this.game.time - 0.6; m.heard = true;
    }
    onTeamReport(actor, pos) { if (!this.alive || !actor.alive) return; const m = this.remember(actor); if (this.game.time - m.lastSeen < 1) return; m.lastPos.copy(pos); m.lastSeen = this.game.time - 1.0; m.heard = true; }

    // ---- perception ----
    perceive() {
      const game = this.game, t = game.time, eye = this.eyePos(this.tmpA); const fwd = this.flatForward(this.tmpB);
      const blind = this.flashT > 0.3;
      let bestT = null, bestScore = -Infinity; this.targetVisible = false;
      for (const e of game.actors) {
        if (e === this || !game.isEnemy(e, this) || !e.alive) continue;
        const m = this.remember(e); m.visible = false;
        const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z; const d = Math.hypot(dx, dz);
        if (blind || d > this.diff.visionRange) continue;
        // FOV check (wider when close)
        const dot = (dx * fwd.x + dz * fwd.z) / (d + 1e-6); const fovCos = d < 3 ? -1 : (d < 8 ? -0.2 : 0.3);
        if (dot < fovCos) continue;
        // LOS to head or chest
        const hy = e.pos.y + 1.6 - e.crouchAmt * 0.5, cy = e.pos.y + 1.1 - e.crouchAmt * 0.4;
        let vis = game.world.lineOfSight(eye.x, eye.y, eye.z, e.pos.x, hy, e.pos.z, true) || game.world.lineOfSight(eye.x, eye.y, eye.z, e.pos.x, cy, e.pos.z, true);
        if (!vis) continue;
        // spotting chance vs distance / target crouching-still
        if (t - m.lastSeen > 1.5) { const p = 1 - this.diff.spot * (d / 40) - (e.crouching && e.speedFrac < 0.05 ? 0.2 : 0); if (Math.random() > p) continue; m.firstSeen = t; }
        m.visible = true; m.lastSeen = t; m.lastPos.copy(e.pos); m.heard = false;
        const score = -d + (e.health < 40 ? 8 : 0) + (e === this.target ? 6 : 0) + (e.isPlayer ? 1 : 0);
        if (score > bestScore) { bestScore = score; bestT = e; }
      }
      if (bestT) {
        if (this.target !== bestT) { if (!this.target || !this.memory[this.target.id].visible) { this.target = bestT; const m = this.memory[bestT.id]; this.reactionT = (t - m.firstSeen < 0.2) ? this.diff.reaction * (0.7 + Math.random() * 0.7) : this.diff.reaction * 0.3; this.trackT = 0; this.reportEnemy(bestT); } }
        this.targetVisible = this.target && this.memory[this.target.id] && this.memory[this.target.id].visible;
      }
      if (this.target && (!this.target.alive || t - this.memory[this.target.id].lastSeen > 6)) { this.target = null; this.targetVisible = false; }
    }
    reportEnemy(e) {
      if (this.game.time - this.radioT < 6) return; this.radioT = this.game.time;
      for (const a of this.game.actors) if (a !== this && a.team === this.team && a.isBot) a.onTeamReport(e, e.pos);
      const region = this.game.regionName(e.pos.x, e.pos.z);
      this.game.radio(this, region ? `Враг замечен: ${region}!` : 'Враг замечен!');
      if (this.game.mode.onEnemySpotted) this.game.mode.onEnemySpotted(this, e);
    }
    // ---- navigation ----
    setGoal(x, z, radius, type) {
      const gx = this.goal ? this.goal.x : 1e9, gz = this.goal ? this.goal.z : 1e9;
      const same = this.goal && Math.hypot(gx - x, gz - z) < 1.5 && this.goal.type === type;
      this.goal = { x, z, radius: radius || 1.2, type: type || 'goto' }; this.arrived = false;
      if (!same || !this.path) this.computePath();
    }
    computePath() {
      if (!this.goal) return; const nav = this.game.nav;
      const p = nav.findPath(this.pos.x, this.pos.z, this.pos.y, this.goal.x, this.goal.z);
      this.path = p; this.pathIdx = p && p.length > 1 ? 1 : 0; this.repathT = 2.5 + Math.random();
      if (!p) { this.arrived = true; this.pathFail = (this.pathFail || 0) + 1; }
    }
    clearGoal() { this.goal = null; this.path = null; this.arrived = true; this.wishDir.set(0, 0, 0); }
    followPath(dt) {
      const wd = this.wishDir; wd.set(0, 0, 0);
      if (!this.goal || this.arrived) return true;
      this.repathT -= dt; if (this.repathT <= 0) this.computePath();
      if (!this.path || this.pathIdx >= this.path.length) {
        const d = Math.hypot(this.goal.x - this.pos.x, this.goal.z - this.pos.z);
        if (d <= this.goal.radius + 0.3) { this.arrived = true; return true; }
        // direct move fallback
        wd.set(this.goal.x - this.pos.x, 0, this.goal.z - this.pos.z); if (d < 0.3) this.arrived = true; return this.arrived;
      }
      const wp = this.path[this.pathIdx]; const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z; const d = Math.hypot(dx, dz);
      const last = this.pathIdx === this.path.length - 1; const reach = last ? Math.max(0.35, this.goal.radius) : 0.55;
      if (d < reach) { this.pathIdx++; if (this.pathIdx >= this.path.length) { this.arrived = true; return true; } return false; }
      wd.set(dx / d, 0, dz / d);
      if (wp.y > this.pos.y + 0.55 && d < 1.2 && this.body.onGround && this.jumpCooldown <= 0) { this.wantJump = true; this.jumpCooldown = 1; }
      // stuck detection
      this.progressT += dt;
      if (this.progressT > 1.2) { const moved = this.pos.distanceTo(this.lastProgress); this.lastProgress.copy(this.pos); this.progressT = 0; if (moved < 0.35) { this.stuckT++; if (this.body.onGround && this.jumpCooldown <= 0) { this.wantJump = true; this.jumpCooldown = 1.2; } if (this.stuckT >= 2) { this.computePath(); this.stuckT = 0; if (this.stuckT === 0 && Math.random() < 0.4) { this.goal = null; this.arrived = true; } } } else this.stuckT = 0; }
      return false;
    }
    // ---- aiming ----
    lookToward(x, y, z, dt, speedMul) {
      const eye = this.eyePos(this.tmpC); const dx = x - eye.x, dy = y - eye.y, dz = z - eye.z; const dh = Math.hypot(dx, dz);
      const ty = Math.atan2(-dx, -dz), tp = Math.atan2(dy, dh);
      this.turnTo(ty, tp, dt, speedMul);
    }
    turnTo(ty, tp, dt, speedMul) {
      const sp = this.diff.turnSpeed * (speedMul || 1);
      let dy = S3.angleWrap(ty - this.yaw), dp = S3.clamp(tp, -1.5, 1.5) - this.pitch;
      const maxStep = sp * dt; const k = 1 - Math.exp(-sp * 1.2 * dt);
      let sy = dy * k, spch = dp * k; const mag = Math.hypot(sy, spch);
      if (mag > maxStep) { sy *= maxStep / mag; spch *= maxStep / mag; }
      this.yaw = S3.angleWrap(this.yaw + sy); this.pitch += spch;
    }
    updateAimError(dt, target, dist) {
      this.aimErrT -= dt;
      if (this.aimErrT <= 0) {
        this.aimErrT = 0.22 + Math.random() * 0.2;
        const focus = S3.clamp(this.trackT / 1.6, 0, 0.65); const moveP = 1 + this.speedFrac * (1.5 - this.diff.accuracyMove) + target.speedFrac * 0.5 + (this.flashT > 0 ? 3 : 0);
        const err = this.diff.aimError * S3.DEG * (1 - focus) * moveP * (0.5 + Math.random());
        const a = Math.random() * Math.PI * 2; const r = Math.tan(err) * dist;
        this.aimErr.set(Math.cos(a) * r, Math.sin(a) * r * 0.6, 0);
        this.aimHead = Math.random() < this.diff.headshot * (dist < 25 ? 1 : 0.5);
      }
    }
    // ---- combat ----
    combat(dt) {
      const t = this.target; const game = this.game; const m = this.memory[t.id]; const vis = m.visible;
      const dist = this.pos.distanceTo(t.pos); const w = this.current;
      this.trackT = vis ? this.trackT + dt : 0; this.reactionT -= dt;
      // aim point
      if (vis) {
        this.updateAimError(dt, t, dist);
        const ay = t.pos.y + (this.aimHead ? 1.62 - t.crouchAmt * 0.5 : 1.15 - t.crouchAmt * 0.4);
        // lead a little
        const lead = Math.min(0.15, dist * 0.004) * (this.diffName === 'expert' ? 1 : 0.5);
        this.aimPoint.set(t.pos.x + t.vel.x * lead, ay, t.pos.z + t.vel.z * lead);
        // error in view-perpendicular plane
        const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
        this.aimPoint.x += rx * this.aimErr.x; this.aimPoint.z += rz * this.aimErr.x; this.aimPoint.y += this.aimErr.y;
        // compensate recoil
        const compP = this.punchPitch * S3.DEG * this.compensation;
        this.lookToward(this.aimPoint.x, this.aimPoint.y - Math.tan(compP) * dist, this.aimPoint.z, dt, 1.3);
      } else { this.lookToward(m.lastPos.x, m.lastPos.y + 1.4, m.lastPos.z, dt, 1); }
      // weapon choice for the situation
      this.chooseWeapon(dist);
      // scope for snipers
      if (w.def.zoom) { const want = vis && dist > 10 && !w.reloading; if (want !== this.scoped) { this.scoped = want; this.zoomLevel = want ? 1 : 0; } }
      // fire control
      this.fireHeld = false; this.firePressed = false;
      if (vis && this.reactionT <= 0 && !w.reloading && this.flashT < 0.5) {
        const eye = this.eyePos(this.tmpA); const dir = this.aimDir(this.tmpB);
        const tx = t.pos.x - eye.x, ty = t.pos.y + 1.1 - t.crouchAmt * 0.4 - eye.y, tz = t.pos.z - eye.z; const td = Math.hypot(tx, ty, tz);
        const cosA = (tx * dir.x + ty * dir.y + tz * dir.z) / td; const ang = Math.acos(S3.clamp(cosA, -1, 1));
        const tol = Math.atan2(0.75 + (w.def.type === 'shotgun' ? 0.6 : 0), td);
        if (ang < tol) {
          if (w.def.type === 'knife') { if (dist < 2.2) { this.firePressed = true; this.fireHeld = true; } }
          else if (this.pauseT > 0) { this.pauseT -= dt; }
          else if (w.def.fireMode === 'auto') {
            if (this.burstLeft <= 0) { const [a, b] = this.diff.burst; this.burstLeft = S3.randInt(a, b) * (dist > 25 ? 0.5 : 1) | 0; if (this.burstLeft < 1) this.burstLeft = 1; this.burstStart = true; }
            this.fireHeld = true; this.firePressed = this.burstStart; this.burstStart = false;
            if (w.sinceShot < 0.02) { this.burstLeft--; if (this.burstLeft <= 0) { const [pa, pb] = this.diff.pause; this.pauseT = S3.rand(pa, pb) * (dist > 25 ? 1.3 : 1); } }
          } else { // semi/bolt/pump/burst: tap
            if (w.cooldown <= 0 && w.boltT <= 0 && w.burstLeft === 0) { this.firePressed = true; this.fireHeld = true; const [pa, pb] = this.diff.pause; this.pauseT = w.def.type === 'sniper' ? S3.rand(0.2, 0.5) : S3.rand(pa, pb) * 0.6; }
          }
        }
      }
      // movement while engaging
      const wd = this.wishDir; wd.set(0, 0, 0);
      const wantClose = (w.def.type === 'knife' || w.def.type === 'shotgun' || (w.def.type === 'smg' && dist > 14)) || !vis;
      const tooClose = w.def.type === 'sniper' && dist < 6;
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        const standP = 0.35 + this.diff.strafe * 0.25 + (dist > 25 ? 0.25 : 0);
        this.moveMode = Math.random() < standP ? 'stand' : 'strafe'; this.strafeDir = S3.randSign();
        this.strafeT = this.moveMode === 'stand' ? S3.rand(0.35, 0.9) : S3.rand(0.3, 0.8);
        this.wantCrouch = this.moveMode === 'stand' && dist > 12 && Math.random() < 0.3 + (this.personality.camper ? 0.3 : 0);
      }
      if (this.health < 35 && vis && w.reloading && this.state !== 'retreat') { this.state = 'retreat'; this.retreatT = 2.5; this.pickCover(t); }
      if (this.state === 'retreat') { this.followPath(dt); this.retreatT -= dt; if (this.retreatT <= 0 || this.arrived) this.state = 'engage'; return; }
      if (wantClose && !tooClose) {
        // path toward target/last pos, but strafe if visible & close
        const tp = vis ? t.pos : m.lastPos;
        if (dist > (vis ? 6 : 1.5)) { this.setGoal(tp.x, tp.z, vis ? 4 : 1.2, 'chase'); this.followPath(dt); }
        else if (vis && this.moveMode === 'strafe') { const r = this.right(this.tmpC); wd.set(r.x * this.strafeDir, 0, r.z * this.strafeDir); }
      } else if (tooClose) { const f = this.flatForward(this.tmpC); const r = this.right(this.tmpD); const kd = this.strafeDir || 1; wd.set(-f.x * 0.85 + r.x * kd * 0.45, 0, -f.z * 0.85 + r.z * kd * 0.45); }
      else if (vis && this.moveMode === 'strafe' && this.diff.strafe > 0.2) { const r = this.right(this.tmpC); wd.set(r.x * this.strafeDir, 0, r.z * this.strafeDir); }
      // if not visible for a while: hunt
      if (!vis && game.time - m.lastSeen > 0.8) { this.state = 'hunt'; this.setGoal(m.lastPos.x, m.lastPos.z, 1.5, 'hunt'); }
    }
    pickCover(threat) {
      const nav = this.game.nav; const world = this.game.world; let best = null, bestD = Infinity;
      for (let i = 0; i < 25; i++) {
        const k = nav.randomNodeNear(this.pos.x, this.pos.z, 8); if (k < 0) continue; const x = nav.nodeX(k), z = nav.nodeZ(k), y = nav.y[k];
        const dToThreat = Math.hypot(x - threat.pos.x, z - threat.pos.z); if (dToThreat < 4) continue;
        const hidden = !world.lineOfSight(x, y + 1.2, z, threat.pos.x, threat.pos.y + 1.4, threat.pos.z, false);
        if (!hidden) continue; const d = Math.hypot(x - this.pos.x, z - this.pos.z); if (d < bestD) { bestD = d; best = { x, z }; }
      }
      if (best) this.setGoal(best.x, best.z, 0.8, 'cover'); else this.state = 'engage';
    }
    chooseWeapon(dist) {
      const inv = this.inv; const cur = this.current; let want = cur;
      const primaryOk = inv.primary && inv.primary.totalAmmo > 0; const secOk = inv.secondary && inv.secondary.totalAmmo > 0;
      if (cur.def.type === 'grenade' || cur.def.type === 'bomb') want = primaryOk ? inv.primary : (secOk ? inv.secondary : inv.melee);
      else if (cur.isGun && cur.ammo === 0 && cur.reserve === 0) want = primaryOk && cur !== inv.primary ? inv.primary : (secOk && cur !== inv.secondary ? inv.secondary : inv.melee);
      else if (cur === inv.melee && (primaryOk || secOk)) want = primaryOk ? inv.primary : inv.secondary;
      else if (cur.isGun && cur.ammo === 0 && cur.reloading && dist < 8 && secOk && cur !== inv.secondary) want = inv.secondary; // quick switch
      else if (cur === inv.secondary && primaryOk && (dist > 10 || inv.primary.ammo > 0) && !cur.reloading && cur.ammo > 0 && Math.random() < 0.02) want = inv.primary;
      if (want && want !== cur) this.select(want);
    }
    considerGrenade() {
      const d = this.diff; if (Math.random() > d.grenades) return false;
      const he = this.hasGrenade('he'), fl = this.hasGrenade('flash'), sm = this.hasGrenade('smoke');
      if (!he && !fl && !sm) return false;
      // target: last known enemy position that we can't see, 8..30m away
      let best = null;
      for (const id in this.memory) { const m = this.memory[id]; if (!m.actor.alive || m.visible) continue; const age = this.game.time - m.lastSeen; if (age > 8) continue; const dist = this.pos.distanceTo(m.lastPos); if (dist > 8 && dist < 30) { best = m; break; } }
      if (!best) return false;
      const g = he || fl || sm; this.select(g); this.throwAt = best.lastPos.clone(); this.throwT = 0.6; this.state = 'throw';
      return true;
    }
    // ---- objective handling (delegated to mode) ----
    runObjective(dt) {
      const mode = this.game.mode; this.objT -= dt;
      if (!this.objective || this.objT <= 0) { this.objective = mode.botObjective(this); this.objT = 4 + Math.random() * 4; if (this.objective) this.setGoal(this.objective.x, this.objective.z, this.objective.radius || 1.5, this.objective.type); }
      const o = this.objective; if (!o) { this.wishDir.set(0, 0, 0); return; }
      const arrived = this.followPath(dt);
      if (!arrived) { // look ahead along movement, with occasional glances
        const wd = this.wishDir; if (wd.lengthSq() > 0.01) { this.lookAroundT -= dt; if (this.lookAroundT <= 0) { this.lookAroundT = S3.rand(1.5, 4); this.glance = (Math.random() - 0.5) * 1.6; } const ty = Math.atan2(-wd.x, -wd.z) + (this.glance || 0) * Math.max(0, 1 - this.lookAroundT); this.turnTo(ty, 0, dt, 0.8); }
        this.wantCrouch = false; return;
      }
      // arrived: act based on objective type
      if (o.type === 'plant') { if (mode.tryPlant) { const r = mode.tryPlant(this, dt, true); if (r === 'planted' || r === 'notinsite') { this.objective = null; } } this.turnTo(this.yaw, -0.6, dt, 1); return; }
      if (o.type === 'defuse') { if (mode.tryDefuse) { const r = mode.tryDefuse(this, dt, true); if (r === 'defused' || r === 'far') this.objective = null; else if (r === 'busy') { this.lookAroundT -= dt; if (this.lookAroundT <= 0) { this.lookAroundT = S3.rand(1.5, 3); this.holdYaw = this.yaw + (Math.random() - 0.5) * 3; } if (this.holdYaw !== undefined) this.turnTo(this.holdYaw, 0, dt, 0.6); } } return; }
      // hold: face expected direction, crouch sometimes, re-pick after a while
      this.holdT -= dt;
      if (o.faceX !== undefined) this.lookToward(o.faceX, this.pos.y + 1.5, o.faceZ, dt, 0.7); else { this.lookAroundT -= dt; if (this.lookAroundT <= 0) { this.lookAroundT = S3.rand(2, 5); this.holdYaw = this.yaw + (Math.random() - 0.5) * 2.5; } if (this.holdYaw !== undefined) this.turnTo(this.holdYaw, 0, dt, 0.4); }
      if (this.holdT <= 0) { this.holdT = S3.rand(6, 16) * (this.personality.camper ? 2 : 1); this.wantCrouch = Math.random() < 0.35; if (Math.random() < 0.5 + this.personality.aggression * 0.4) { this.objective = null; } }
    }
    // ---- main think ----
    think(dt) {
      if (!this.alive) return;
      const game = this.game; const frozen = game.mode.frozen(this);
      this.jumpCooldown -= dt;
      this.perceptT -= dt; if (this.perceptT <= 0) { this.perceptT = 0.12; this.perceive(); }
      if (frozen) { this.wishDir.set(0, 0, 0); this.fireHeld = false; this.firePressed = false; if (this.target && this.targetVisible) this.lookToward(this.target.pos.x, this.target.pos.y + 1.2, this.target.pos.z, dt, 1); return; }
      // grenade throw state
      if (this.state === 'throw') {
        this.wishDir.set(0, 0, 0); this.throwT -= dt; const tp = this.throwAt;
        this.lookToward(tp.x, tp.y + 1.2 + this.pos.distanceTo(tp) * 0.25, tp.z, dt, 1);
        if (this.throwT <= 0 && this.current.def.type === 'grenade' && this.current.drawT <= 0) { game.throwGrenade(this, this.current, 1.0); this.state = 'idle'; this.chooseWeapon(20); this.grenadeT = 12 + Math.random() * 15; }
        else if (this.current.def.type !== 'grenade') this.state = 'idle';
        return;
      }
      // reload when safe
      const w = this.current;
      if (w.isGun && !this.targetVisible && w.ammo < w.def.mag * 0.4 && w.reserve > 0 && !w.reloading && w.cooldown <= 0) w.reload(this.weaponCtx());
      if (this.target && (this.targetVisible || game.time - this.memory[this.target.id].lastSeen < 5)) {
        if (this.state !== 'retreat' && this.state !== 'hunt') this.state = 'engage';
        if (this.state === 'hunt') {
          // hunting: move to last pos; if visible -> engage
          if (this.targetVisible) { this.state = 'engage'; }
          else { const arrived = this.followPath(dt); const m = this.memory[this.target.id]; if (arrived) { this.lookAroundT -= dt; if (this.lookAroundT <= 0) { this.lookAroundT = 1; this.holdYaw = this.yaw + (Math.random() - 0.5) * 3; } if (this.holdYaw !== undefined) this.turnTo(this.holdYaw, 0, dt, 0.7); if (game.time - m.lastSeen > 3) { this.target = null; this.state = 'idle'; this.objective = null; } } else { const wd = this.wishDir; if (wd.lengthSq() > 0.01) this.turnTo(Math.atan2(-wd.x, -wd.z), 0, dt, 0.9); } this.fireHeld = false; this.firePressed = false; }
        }
        if (this.state === 'engage' || this.state === 'retreat') { this.combat(dt); }
        this.grenadeT -= dt; if (!this.targetVisible && this.grenadeT <= 0 && this.state !== 'throw') { this.grenadeT = 6; this.considerGrenade(); }
        return;
      }
      // no target: objectives
      this.state = 'idle'; this.fireHeld = false; this.firePressed = false; this.scoped = false; this.zoomLevel = 0;
      if (w.def.type === 'grenade' || (w === this.inv.melee && (this.inv.primary || this.inv.secondary))) this.chooseWeapon(20);
      this.grenadeT -= dt; if (this.grenadeT <= 0) { this.grenadeT = 8 + Math.random() * 10; if (this.considerGrenade()) return; }
      this.runObjective(dt);
    }
    // buying logic
    autoBuy() {
      const mode = this.game.mode; if (!mode.canBuy(this)) return; const T = this.team === 'T'; const free = mode.freeBuy;
      if (free) { // TDM/FFA: pick a loadout
        const prim = S3.pick(T ? ['akr', 'akr12', 'famas', 'm4', 'awm', 'p90', 'ump45', 'nova', 'm249', 'g3sg1', 'm16'] : ['m4', 'aug', 'famas', 'm16', 'akr', 'awm', 'p90', 'mp5', 'm1014', 'm249', 'm40']);
        this.buy(prim); this.buy(S3.pick(['deagle', 'usp', 'p350', 'fn57', 'tec9', 'g22'])); this.buy('helmet'); if (Math.random() < 0.6) this.buy('he'); if (Math.random() < 0.5) this.buy('flash'); return;
      }
      let money = this.money; const hasPrimary = !!this.inv.primary;
      const rnd = Math.random();
      const eco = money < 2200 && this.game.mode.roundNumber > 1 && rnd < 0.55 && !hasPrimary; // save round
      if (eco) { if (money >= 1000 && Math.random() < 0.6) { this.buy('kevlar'); } if (this.money >= 700 && Math.random() < 0.5) this.buy(S3.pick(['deagle', 'p350', 'fn57', 'tec9'])); return; }
      if (!hasPrimary) {
        if (money >= 5800 && Math.random() < 0.22) this.buy('awm');
        else if (money >= 4300) this.buy(S3.pick(T ? ['akr', 'akr', 'akr12', 'famas', 'aug', 'm16'] : ['m4', 'm4', 'aug', 'famas', 'm16', 'akr']));
        else if (money >= 3400) this.buy(S3.pick(T ? ['akr', 'famas', 'm16'] : ['m4', 'famas', 'm16']));
        else if (money >= 2600) this.buy(S3.pick(['m40', 'p90', 'ump45', 'mp5', 'famas']));
        else if (money >= 1700) this.buy(S3.pick(['mp5', 'ump45', 'mac10', 'nova', 'mp7']));
      }
      if (this.money >= 1000) this.buy('helmet'); else if (this.money >= 650) this.buy('kevlar');
      if (this.money >= 700 && !this.inv.secondary || (this.inv.secondary && this.inv.secondary.def.price <= 200 && this.money >= 1500 && Math.random() < 0.4)) this.buy(S3.pick(['deagle', 'p350', 'fn57', 'tec9']));
      if (this.money >= 300 && Math.random() < 0.6) this.buy('he');
      if (this.money >= 200 && Math.random() < 0.5) this.buy('flash');
      if (this.money >= 300 && Math.random() < 0.35) this.buy('smoke');
      if (!T && this.money >= 400 && Math.random() < 0.6) this.buy('defuser');
    }
    updateModel(dt) {
      S3.animateCharacterVisual(this, dt);
    }
  }
  S3.Bot = Bot;
})();
