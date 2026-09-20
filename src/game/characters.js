// ===== Standoff 3 — character models (low-poly humanoids), hitboxes, animation =====
'use strict';
(function () {
  const S3 = window.S3;
  const matCache = {};
  function mat(color, opts) {
    const key = color + '|' + JSON.stringify(opts || {}); if (matCache[key]) return matCache[key];
    const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0.05 }, opts || {})); matCache[key] = m; return m;
  }
  function box(w, h, d, m, x, y, z) { const g = new THREE.BoxGeometry(w, h, d); const mesh = new THREE.Mesh(g, m); mesh.position.set(x || 0, y || 0, z || 0); mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }

  const SKINS = {
    CT: [
      { uniform: 0x3a4a68, vest: 0x2a3040, helmet: 0x2c3444, skin: 0xd9b48f, pants: 0x2f3a52, boots: 0x1c1c22, accent: 0x5090e0 },
      { uniform: 0x2f3e5a, vest: 0x1f2532, helmet: 0x333b4c, skin: 0xc79a70, pants: 0x28324a, boots: 0x1a1a20, accent: 0x5090e0 },
      { uniform: 0x45506a, vest: 0x2a2f3a, helmet: 0x3a4250, skin: 0x8d5a3b, pants: 0x353d52, boots: 0x1c1c22, accent: 0x5090e0 },
    ],
    T: [
      { uniform: 0x8a7a58, vest: 0x4a4436, helmet: 0xa03028, skin: 0xd2a679, pants: 0x5a5040, boots: 0x2a2620, accent: 0xe0a030, bandana: true },
      { uniform: 0x6e6a4a, vest: 0x3a3a2a, helmet: 0x1e1e1e, skin: 0xb8865a, pants: 0x4a4a3a, boots: 0x222220, accent: 0xe0a030, mask: true },
      { uniform: 0x9a8a68, vest: 0x504838, helmet: 0x7a2a22, skin: 0xc9a07a, pants: 0x605848, boots: 0x2a2620, accent: 0xe0a030, bandana: true },
    ],
  };

  // Builds a humanoid rig. root at feet. Height ~1.8
  class CharacterModel {
    constructor(team, skinIdx) {
      const sk = SKINS[team][skinIdx % SKINS[team].length]; this.skin = sk; this.team = team;
      const root = new THREE.Group(); this.root = root;
      const mU = mat(sk.uniform), mV = mat(sk.vest), mS = mat(sk.skin), mP = mat(sk.pants), mB = mat(sk.boots), mH = mat(sk.helmet);
      // torso pivot at hips (y=0.95)
      // The rig is modelled with its face/hands/toes on +Z, but actors look and move along -Z (yaw 0).
      // This flip group turns the whole body around once, so root.rotation.y can simply be the actor's yaw.
      // (Without it every character faced away from where it was looking/walking -- the "moonwalk" bug.)
      this.flip = new THREE.Group(); this.flip.rotation.y = Math.PI; root.add(this.flip);
      this.hips = new THREE.Group(); this.hips.position.y = 0.95; this.flip.add(this.hips);
      this.torso = new THREE.Group(); this.hips.add(this.torso);
      const chest = box(0.44, 0.6, 0.26, mU, 0, 0.32, 0); this.torso.add(chest);
      const vest = box(0.46, 0.4, 0.3, mV, 0, 0.36, 0); this.torso.add(vest);
      const belt = box(0.42, 0.08, 0.26, mB, 0, 0.02, 0); this.torso.add(belt);
      // head
      this.neck = new THREE.Group(); this.neck.position.y = 0.64; this.torso.add(this.neck);
      const head = box(0.24, 0.26, 0.25, mS, 0, 0.15, 0); this.neck.add(head); this.headMesh = head;
      if (sk.mask) { this.neck.add(box(0.25, 0.27, 0.26, mat(0x1e1e1e), 0, 0.15, 0.005)); }
      if (sk.bandana) { this.neck.add(box(0.26, 0.07, 0.27, mH, 0, 0.25, 0)); this.neck.add(box(0.08, 0.12, 0.04, mH, 0.05, 0.2, -0.15)); }
      else { this.neck.add(box(0.28, 0.14, 0.29, mH, 0, 0.26, 0)); this.neck.add(box(0.30, 0.03, 0.06, mat(0x111111), 0, 0.2, 0.15)); } // helmet + visor strap
      // eyes
      const eyeM = mat(0x111111); this.neck.add(box(0.04, 0.03, 0.02, eyeM, -0.06, 0.16, 0.13)); this.neck.add(box(0.04, 0.03, 0.02, eyeM, 0.06, 0.16, 0.13));
      // arms (shoulder pivots)
      this.armL = new THREE.Group(); this.armL.position.set(-0.29, 0.58, 0); this.torso.add(this.armL);
      this.armR = new THREE.Group(); this.armR.position.set(0.29, 0.58, 0); this.torso.add(this.armR);
      for (const [arm, side] of [[this.armL, -1], [this.armR, 1]]) {
        arm.add(box(0.14, 0.3, 0.15, mU, 0, -0.15, 0));
        const fore = new THREE.Group(); fore.position.y = -0.3; arm.add(fore); arm.fore = fore;
        fore.add(box(0.12, 0.3, 0.13, mU, 0, -0.14, 0)); fore.add(box(0.11, 0.1, 0.12, mS, 0, -0.33, 0));
      }
      // legs (hip pivots)
      this.legL = new THREE.Group(); this.legL.position.set(-0.12, 0, 0); this.hips.add(this.legL);
      this.legR = new THREE.Group(); this.legR.position.set(0.12, 0, 0); this.hips.add(this.legR);
      for (const leg of [this.legL, this.legR]) {
        leg.add(box(0.18, 0.46, 0.2, mP, 0, -0.23, 0));
        const shin = new THREE.Group(); shin.position.y = -0.46; leg.add(shin); leg.shin = shin;
        shin.add(box(0.16, 0.42, 0.18, mP, 0, -0.22, 0)); shin.add(box(0.17, 0.1, 0.26, mB, 0, -0.45, 0.03));
      }
      // weapon holder (in right hand)
      this.weaponHolder = new THREE.Group(); this.armR.fore.add(this.weaponHolder); this.weaponHolder.position.set(-0.03, -0.36, 0.05);
      this.weaponMesh = null; this.weaponId = null;
      // team accent (armband)
      this.armL.add(box(0.16, 0.06, 0.17, mat(sk.accent), 0, -0.1, 0));
      this.animT = Math.random() * 10; this.dead = false; this.crouch = 0; this.aimPitch = 0;
      root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.deathT = 0; this.bobPhase = 0;
    }
    setWeapon(id, skinId) {
      skinId = skinId || null; if (this.weaponId === id && this.weaponSkin === skinId) return; this.weaponId = id; this.weaponSkin = skinId;
      if (this.weaponMesh) { this.weaponHolder.remove(this.weaponMesh); }
      const w = S3.WEAPONS[id]; if (!w) { this.weaponMesh = null; return; }
      const m = S3.buildWeaponModel(w, 0.85, skinId);
      // weapon models point down -Z; the forearm's "down the arm" axis is -Y, so tip the model 90deg so the barrel
      // continues along the raised arm (rotation 0 left every third-person gun hanging straight down from the fist)
      m.rotation.set(-Math.PI / 2, 0, Math.PI); m.position.set(0.02, -0.02, 0.06); this.weaponMesh = m; this.weaponHolder.add(m);
    }
    // pose: moving speed (0..1), crouch (0..1), aim pitch (rad), dt
    update(dt, speed, crouch, pitch, firing, twist) {
      if (this.dead) { this.updateDeath(dt); return; }
      this.animT += dt * (6 + speed * 6);
      this.crouch = S3.damp(this.crouch, crouch, 12, dt);
      const c = this.crouch;
      const sw = Math.sin(this.animT) * speed * 0.8;
      // legs walk cycle
      this.legL.rotation.x = sw * (1 - c * 0.6) - c * 0.9; this.legR.rotation.x = -sw * (1 - c * 0.6) - c * 1.1;
      this.legL.shin.rotation.x = Math.max(0, -sw) * 0.9 + c * 1.6; this.legR.shin.rotation.x = Math.max(0, sw) * 0.9 + c * 1.9;
      this.hips.position.y = 0.95 - c * 0.45 + Math.abs(Math.cos(this.animT)) * speed * 0.03;
      this.torso.rotation.x = c * 0.25 + (firing ? 0.02 : 0);
      // torso/weapon twist toward true aim direction while hips/legs keep facing the movement direction
      // (fixes bots visually "moonwalking" when chasing/strafing while aiming at a target)
      this.torso.rotation.y = twist || 0;
      // arms hold weapon: both arms forward, pitch with aim
      const holding = !!this.weaponMesh && this.weaponId !== 'knife';
      const armPitch = -Math.PI / 2 + (pitch || 0) * 0.9;
      this.armR.rotation.x = holding ? armPitch : -0.3 + sw * 0.5; this.armR.rotation.y = holding ? -0.35 : 0; this.armR.rotation.z = holding ? 0.1 : 0;
      this.armR.fore.rotation.x = holding ? -0.15 : -0.4;
      this.armL.rotation.x = holding ? armPitch + 0.15 : -0.3 - sw * 0.5; this.armL.rotation.y = holding ? 0.55 : 0; this.armL.rotation.z = holding ? -0.15 : 0;
      this.armL.fore.rotation.x = holding ? -0.9 : -0.4;
      if (this.weaponId === 'knife' && this.weaponMesh) { this.armR.rotation.x = -0.9 + (pitch || 0) * 0.5; this.armR.fore.rotation.x = -0.9; }
      this.neck.rotation.x = (pitch || 0) * 0.5;
      if (firing) { this.armR.rotation.x -= 0.06; this.armL.rotation.x -= 0.06; }
    }
    die(dirX, dirZ, headshot) {
      this.dead = true; this.deathT = 0; this.deathDir = Math.atan2(dirX, dirZ) + (Math.random() - 0.5) * 0.6; this.deathHead = headshot; this.deathBack = Math.random() < 0.6;
      this.torso.rotation.x = 0; this.legL.rotation.x = 0; this.legR.rotation.x = 0; this.legL.shin.rotation.x = 0; this.legR.shin.rotation.x = 0;
      this.armL.rotation.set(0, 0, 0); this.armR.rotation.set(0, 0, 0); this.armL.fore.rotation.x = 0; this.armR.fore.rotation.x = 0;
    }
    updateDeath(dt) {
      this.deathT += dt; const t = Math.min(1, this.deathT / 0.55); const e = 1 - Math.pow(1 - t, 3);
      // fall: rotate whole body around feet
      this.root.rotation.y = this.root.userData.yaw || 0;
      this.hips.position.y = 0.95 - e * 0.75;
      const fall = e * Math.PI / 2 * (this.deathBack ? -1 : 1);
      this.hips.rotation.x = fall; this.hips.position.z = e * (this.deathBack ? -0.4 : 0.4);
      this.hips.position.y = 0.95 - e * 0.72;
      this.armL.rotation.z = -e * 1.2; this.armR.rotation.z = e * 1.1; this.armR.rotation.x = -e * 0.4; this.neck.rotation.x = e * 0.3 * (this.deathBack ? -1 : 1);
      this.legL.rotation.x = e * 0.3; this.legR.rotation.x = -e * 0.2; this.legR.rotation.z = e * 0.15;
    }
    reset() {
      this.dead = false; this.deathT = 0; this.hips.rotation.set(0, 0, 0); this.hips.position.set(0, 0.95, 0); this.armL.rotation.set(0, 0, 0); this.armR.rotation.set(0, 0, 0); this.legL.rotation.set(0, 0, 0); this.legR.rotation.set(0, 0, 0); this.neck.rotation.set(0, 0, 0);
    }
  }
  S3.CharacterModel = CharacterModel;

  // Shared visual-facing logic for any character-controlled actor (bot AI or a networked
  // human puppet): the hips/legs turn to face the actual movement direction while the torso
  // twists toward the true aim direction, so the model never appears to glide/"moonwalk"
  // when moving in a direction that differs from where it is aiming.
  // Gives any actor (a remote human on the host, or a puppet on a client) a visible
  // third-person body wired up the same way Bot already does it, so shared code (animation,
  // death ragdoll, weapon swaps) all just works without duplicating that logic.
  S3.attachCharacterModel = function (actor, scene, skinIdx) {
    const model = new S3.CharacterModel(actor.team, skinIdx || 0);
    scene.add(model.root); model.root.visible = false;
    actor.model = model;
    actor.onWeaponChange = (w) => model.setWeapon(w.id, w.skin);
    if (actor.current) model.setWeapon(actor.current.id, actor.current.skin);
    return model;
  };

  S3.animateCharacterVisual = function (actor, dt) {
    const m = actor.model; if (!m) return;
    if (actor.bodyYaw === undefined) actor.bodyYaw = actor.yaw;
    if (actor.alive) {
      const wd = actor.wishDir;
      const moving = wd && (wd.x * wd.x + wd.z * wd.z) > 0.04;
      if (moving) {
        const targetYaw = Math.atan2(-wd.x, -wd.z);
        let diff = S3.angleWrap(targetYaw - actor.bodyYaw);
        const maxTurn = 14 * dt; diff = S3.clamp(diff, -maxTurn, maxTurn);
        actor.bodyYaw = S3.angleWrap(actor.bodyYaw + diff);
      } else actor.bodyYaw = actor.yaw;
    }
    m.root.position.copy(actor.pos); m.root.rotation.y = actor.bodyYaw;
    const maxTwist = 150 * S3.DEG;
    const twist = actor.alive ? S3.clamp(S3.angleWrap(actor.yaw - actor.bodyYaw), -maxTwist, maxTwist) : 0;
    m.update(dt, actor.alive ? Math.min(1, actor.speedFrac * 1.2) : 0, actor.crouchAmt, actor.pitch, actor.firing > 0, twist);
  };

  // Hitboxes in local (yaw-aligned) space: relative to feet position. Returns zone or null.
  // Zones: head (sphere), body (box), legs (box)
  S3.hitTestCharacter = function (ox, oy, oz, dx, dy, dz, maxT, ch) {
    // ch: {pos:{x,y,z}, yaw, crouchAmt}
    const c = ch.crouchAmt || 0; const px = ch.pos.x, py = ch.pos.y, pz = ch.pos.z;
    // quick cylinder reject
    const bodyR = 0.55; const h = 1.85 - c * 0.5;
    const tBox = S3.rayAABB(ox, oy, oz, dx, dy, dz, { min: { x: px - bodyR, y: py, z: pz - bodyR }, max: { x: px + bodyR, y: py + h, z: pz + bodyR } }, maxT, null);
    if (tBox < 0) return null;
    // transform ray into local yaw space
    const cy = Math.cos(-ch.yaw), sy = Math.sin(-ch.yaw);
    const lox = (ox - px) * cy - (oz - pz) * sy, loz = (ox - px) * sy + (oz - pz) * cy, loy = oy - py;
    const ldx = dx * cy - dz * sy, ldz = dx * sy + dz * cy, ldy = dy;
    const headY = 1.68 - c * 0.5; const headT = S3.raySphere(lox, loy, loz, ldx, ldy, ldz, 0, headY, 0.02, 0.17, maxT);
    const bodyBox = { min: { x: -0.25, y: 0.95 - c * 0.45, z: -0.16 }, max: { x: 0.25, y: 1.55 - c * 0.5, z: 0.16 } };
    const legsBox = { min: { x: -0.24, y: 0, z: -0.16 }, max: { x: 0.24, y: 0.95 - c * 0.45, z: 0.16 } };
    const armsBox = { min: { x: -0.38, y: 1.0 - c * 0.45, z: -0.35 }, max: { x: 0.38, y: 1.5 - c * 0.5, z: 0.2 } };
    const bodyT = S3.rayAABB(lox, loy, loz, ldx, ldy, ldz, bodyBox, maxT, null);
    const legsT = S3.rayAABB(lox, loy, loz, ldx, ldy, ldz, legsBox, maxT, null);
    const armsT = S3.rayAABB(lox, loy, loz, ldx, ldy, ldz, armsBox, maxT, null);
    let best = null, bestT = Infinity;
    if (headT >= 0 && headT < bestT) { bestT = headT; best = 'head'; }
    if (bodyT >= 0 && bodyT < bestT) { bestT = bodyT; best = 'body'; }
    if (legsT >= 0 && legsT < bestT) { bestT = legsT; best = 'legs'; }
    if (armsT >= 0 && armsT < bestT) { bestT = armsT; best = 'arms'; }
    if (!best) return null;
    return { zone: best, t: bestT };
  };
})();
