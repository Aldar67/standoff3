// ===== Standoff 3 — Game core: renderer, scene, loop, combat resolution, spawning =====
'use strict';
(function () {
  const S3 = window.S3;
  const V3 = THREE.Vector3;

  const THEMES = {
    desert: { skyTop: 0x2a6fd6, skyHorizon: 0xcfe3f5, sunDir: [0.45, 0.8, 0.35], sunColor: 0xfff1d6, sunI: 2.6, hemiSky: 0x9ec8ff, hemiGround: 0xb59a6a, hemiI: 0.9, fog: 0xd9e4ee, fogNear: 70, fogFar: 260, ambient: 'desert', exposure: 1.0 },
    industrial: { skyTop: 0x4a5d75, skyHorizon: 0xb9c3cc, sunDir: [-0.35, 0.7, 0.5], sunColor: 0xe8ecf2, sunI: 1.7, hemiSky: 0x9aa8b8, hemiGround: 0x4a4a48, hemiI: 0.8, fog: 0xaeb8c2, fogNear: 40, fogFar: 180, ambient: 'industrial', exposure: 0.95 },
    urban: { skyTop: 0x3572c9, skyHorizon: 0xdbe6f0, sunDir: [0.3, 0.75, -0.5], sunColor: 0xfff4e0, sunI: 2.3, hemiSky: 0xa7cbff, hemiGround: 0x7a705f, hemiI: 0.85, fog: 0xd6e0ea, fogNear: 60, fogFar: 240, ambient: 'desert', exposure: 1.0 },
    sunset: { skyTop: 0x3b3f8a, skyHorizon: 0xf2a86b, sunDir: [-0.7, 0.35, 0.4], sunColor: 0xffc48a, sunI: 2.2, hemiSky: 0x8a7fc9, hemiGround: 0x6a4a3a, hemiI: 0.75, fog: 0xe9b28c, fogNear: 50, fogFar: 200, ambient: 'desert', exposure: 1.0 },
  };

  class Game {
    constructor(opts) {
      this.opts = opts; this.time = 0; this.paused = false; this.menuOpen = false; this.over = false; this.fps = 60; this.friendlyFire = false;
      this.actors = []; this.bots = []; this.player = null; this.playerLoadout = opts.loadout || null;
      this.shakeAmt = 0; this.shakeT = 0; this.tmp = new V3(); this.tmp2 = new V3(); this.tmp3 = new V3(); this.tmpUp = new V3(0, 1, 0);
      this.radarVis = {}; this.radarT = 0; this.pickupT = 0; this.lastFrame = 0; this.frameCount = 0; this.fpsT = 0;
    }
    init(container) {
      const S = S3.Settings.data;
      // renderer
      const canvas = document.getElementById('game-canvas'); this.canvas = canvas;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: S.quality !== 'low', powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5) * (S.resScale || 1)); renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = !!S.shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.autoClear = false;
      this.renderer = renderer;
      this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(S.fov, window.innerWidth / window.innerHeight, 0.05, 600);
      // map
      const def = S3.MAPS[this.opts.map](); this.map = S3.buildMap(def); this.world = this.map.world; this.nav = this.map.nav; this.scene.add(this.map.group);
      const theme = THEMES[def.theme.name || 'desert'] || THEMES.desert; this.theme = theme; renderer.toneMappingExposure = theme.exposure;
      // lighting
      const sun = new THREE.DirectionalLight(theme.sunColor, theme.sunI); const sd = new V3(...theme.sunDir).normalize(); sun.position.copy(sd).multiplyScalar(120); sun.castShadow = !!S.shadows;
      const b = this.map.bounds; const ext = Math.max(b.xmax - b.xmin, b.zmax - b.zmin) * 0.55;
      sun.shadow.camera.left = -ext; sun.shadow.camera.right = ext; sun.shadow.camera.top = ext; sun.shadow.camera.bottom = -ext; sun.shadow.camera.near = 10; sun.shadow.camera.far = 320;
      sun.shadow.mapSize.set(S.quality === 'high' ? 4096 : 2048, S.quality === 'high' ? 4096 : 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
      sun.target.position.set((b.xmin + b.xmax) / 2, 0, (b.zmin + b.zmax) / 2); this.scene.add(sun); this.scene.add(sun.target); this.sun = sun;
      sun.position.copy(sun.target.position).addScaledVector(sd, 150);
      this.hemi = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, theme.hemiI); this.scene.add(this.hemi);
      this.scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
      this.buildSky(theme, sd);
      // subsystems
      this.effects = new S3.Effects(this); this.vm = new S3.Viewmodel(this.camera); this.vm.setLighting(sd, new THREE.Color(theme.sunColor), new THREE.Color(theme.hemiSky), new THREE.Color(theme.hemiGround));
      S3.Input.init(canvas);
      // actors
      const o = this.opts; const net = o.net || null; this.net = null;
      if (net && net.role === 'host') {
        const pTeam = o.playerTeam === 'random' ? S3.pick(['T', 'CT']) : (o.playerTeam || 'CT');
        this.player = new S3.Player(this, { name: S.playerName || 'Игрок', team: pTeam }); this.actors.push(this.player);
        this.net = new S3.HostSync(this, net.net); this.net.setLocalKey();
        for (const r of net.roster || []) this.net.addRemote(r.id, r.name, r.team, r.skinIdx, r.skins);
        const names = S3.shuffle(S3.BOT_NAMES.slice());
        const perTeam = o.botsPerTeam || 5; let ni = 0;
        for (const team of ['CT', 'T']) {
          const humans = this.actors.filter((a) => a.team === team && (a === this.player || a.remoteInput)).length;
          const n = Math.max(0, perTeam - humans);
          for (let i = 0; i < n; i++) { const bot = new S3.Bot(this, { name: names[ni++ % names.length], team, difficulty: o.difficulty || 'medium', skinIdx: i }); this.actors.push(bot); this.bots.push(bot); }
        }
        this.net.tagBots();
      } else if (net && net.role === 'client') {
        const pTeam = net.myTeam || 'CT';
        this.player = new S3.Player(this, { name: S.playerName || 'Игрок', team: pTeam }); this.actors.push(this.player);
        this.clientSync = new S3.ClientSync(this, net.net); this.net = this.clientSync;
      } else {
        const pTeam = o.playerTeam === 'random' ? S3.pick(['T', 'CT']) : (o.playerTeam || 'CT');
        this.player = new S3.Player(this, { name: S.playerName || 'Игрок', team: pTeam }); this.actors.push(this.player);
        const names = S3.shuffle(S3.BOT_NAMES.slice());
        const perTeam = o.botsPerTeam || 5; let ni = 0;
        for (const team of ['CT', 'T']) { const n = team === pTeam ? perTeam - 1 : perTeam; for (let i = 0; i < n; i++) { const bot = new S3.Bot(this, { name: names[ni++ % names.length], team, difficulty: o.difficulty || 'medium', skinIdx: i }); this.actors.push(bot); this.bots.push(bot); } }
        if (o.mode === 'ffa') { this.actors.forEach((a, i) => { a.team = i % 2 ? 'T' : 'CT'; }); }
      }
      this.hud = new S3.HUD(this);
      if (net && net.role === 'client') { this.mode = new S3.RemoteMode(o.mode); }
      else { this.mode = S3.createMode(this, o.mode || 'defuse', { rounds: o.rounds, killLimit: o.killLimit, timeLimit: o.timeLimit }); }
      this.vm.setWeapon('knife', this.player.team, this.player.inv.melee.skin);
      window.addEventListener('resize', () => this.onResize()); this.onResize();
      S3.Audio.startAmbient(theme.ambient);
      if (net && net.role === 'host') { this.wrapHudForBroadcast(); this.mode.start(); }
      else if (!net) { this.mode.start(); }
      this.hud.addChat(net && net.role === 'client' ? `<span class="sys">Подключено к игре хоста. Карта: ${def.title}.</span>` : `<span class="sys">Добро пожаловать в Standoff 3! Карта: ${def.title}. Tab — таблица, B — магазин, Esc — меню.</span>`);
      if (net) net.net.onCloseCb = () => { if (this.onNetLost) this.onNetLost(); };
      this.running = true; this.lastFrame = performance.now(); requestAnimationFrame((t) => this.loop(t));
    }
    // once HostSync/hud/mode exist: banners are broadcast automatically for every future call site
    // (round start/end, match-over, side-swap...) without having to hunt down each one individually.
    wrapHudForBroadcast() {
      const net = this.net, hud = this.hud; const origBanner = hud.showBanner.bind(hud);
      hud.showBanner = (text, sub, dur, color) => { origBanner(text, sub, dur, color); net.broadcastBanner(text, sub, dur, color); };
    }
    buildSky(theme, sd) {
      const geo = new THREE.SphereGeometry(450, 32, 16);
      const mat = new THREE.ShaderMaterial({
        uniforms: { top: { value: new THREE.Color(theme.skyTop) }, horizon: { value: new THREE.Color(theme.skyHorizon) }, sunDir: { value: sd.clone() }, sunColor: { value: new THREE.Color(theme.sunColor) } },
        vertexShader: 'varying vec3 vW; void main(){ vW = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; varying vec3 vW;
          void main(){ vec3 d = normalize(vW); float h = clamp(d.y, -0.1, 1.0); vec3 c = mix(horizon, top, pow(max(h,0.0), 0.55)); float s = max(dot(d, normalize(sunDir)), 0.0); c += sunColor * (pow(s, 600.0) * 1.5 + pow(s, 12.0) * 0.25); if (d.y < 0.0) c = mix(horizon, horizon*0.6, clamp(-d.y*6.0,0.0,1.0)); gl_FragColor = vec4(c, 1.0); }`,
        side: THREE.BackSide, depthWrite: false, fog: false,
      });
      const sky = new THREE.Mesh(geo, mat); sky.frustumCulled = false; this.scene.add(sky); this.sky = sky;
    }
    onResize() { const w = window.innerWidth, h = window.innerHeight; this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    // ---------- helpers ----------
    isEnemy(a, b) { if (a === b) return false; if (this.mode && this.mode.id === 'ffa') return true; return a.team !== b.team; }
    enemiesOf(a) { return this.actors.filter((x) => x.alive && this.isEnemy(x, a)); }
    regionName(x, z) { for (const r of this.map.regions) if (x >= r.min.x && x <= r.max.x && z >= r.min.z && z <= r.max.z) return r.name; return null; }
    spawnCenter(team) { const s = this.map.spawns[team]; if (!s || !s.length) return { x: 0, z: 0 }; let x = 0, z = 0; for (const p of s) { x += p.x; z += p.z; } return { x: x / s.length, z: z / s.length }; }
    inSpawnZone(a) { const c = this.spawnCenter(a.team); return Math.hypot(a.pos.x - c.x, a.pos.z - c.z) < 14; }
    pickSpawn(team, actor, any) {
      let list = any ? this.map.spawns.CT.concat(this.map.spawns.T) : this.map.spawns[team]; if (!list.length) list = this.map.spawns.CT.concat(this.map.spawns.T);
      const enemies = this.actors.filter((x) => x.alive && x !== actor && this.isEnemy(x, actor));
      let best = null, bestScore = -Infinity;
      for (const s of S3.shuffle(list.slice())) {
        let occupied = false; for (const x of this.actors) if (x.alive && x !== actor && Math.hypot(x.pos.x - s.x, x.pos.z - s.z) < 1.2) { occupied = true; break; }
        if (occupied) continue;
        let minE = 999; for (const e of enemies) minE = Math.min(minE, Math.hypot(e.pos.x - s.x, e.pos.z - s.z));
        const score = Math.min(minE, 40) + Math.random() * 8; if (score > bestScore) { bestScore = score; best = s; }
      }
      return best || list[0];
    }
    spawnActor(a, any) { const s = this.pickSpawn(a.team, a, any); const y = this.world.floorAt(s.x, s.z, 30); a.spawnAt(s.x, y, s.z, s.yaw); a.updateModel(0); if (a.isLocal) { this.vm.buildArms(a.team); this.vm.setWeapon(a.current.id, a.team, a.current.skin); } }
    visibleToTeam(a, team) { return !!this.radarVis[a.id]; }
    updateRadarVis() {
      const p = this.player; const vis = {}; const eye = p.eyePos(this.tmp); const fwd = p.forward(this.tmp2);
      for (const a of this.actors) {
        if (!a.alive || !this.isEnemy(a, p)) continue; let v = false;
        // player LOS
        const dx = a.pos.x - p.pos.x, dz = a.pos.z - p.pos.z; const d = Math.hypot(dx, dz);
        if (d < 80 && p.alive) { const dot = (dx * fwd.x + dz * fwd.z) / (d + 1e-6); if (dot > 0.2 && this.world.lineOfSight(eye.x, eye.y, eye.z, a.pos.x, a.pos.y + 1.2, a.pos.z, true)) v = true; }
        if (!v && this.mode.id !== 'ffa') for (const b of this.bots) { if (b.team !== p.team || !b.alive) continue; const m = b.memory[a.id]; if (m && m.visible) { v = true; break; } }
        vis[a.id] = v;
      }
      this.radarVis = vis;
    }
    // per-actor HUD feedback: only touches the local screen it belongs to; for a networked
    // remote human on the host, forwards to that player's own client instead.
    localProgress(actor, label, frac) { if (actor.isLocal) this.hud.setProgress(label, frac); else if (actor.isPlayer && this.net) this.net.sendProgress(actor, label, frac); }
    localHint(actor, text) { if (actor.isLocal) this.hud.setHint(text); else if (actor.isPlayer && this.net) this.net.sendHint(actor, text); }
    localChat(actor, html) { if (actor.isLocal) this.hud.addChat(html); else if (actor.isPlayer && this.net) this.net.sendPrivateChat(actor, html); }
    radio(actor, text) {
      if (this.net && this.net.role === 'host') this.net.broadcastRadio(actor, text);
      if (this.mode.id === 'ffa') return; if (actor.team !== this.player.team) return;
      this.hud.addChat(`<span class="radio">📻</span> <span style="color:${S3.TEAM_COLOR_CSS[actor.team]}">${actor.name}</span>: ${text}`); S3.Audio.radio();
    }
    emitNoise(actor, radius) { for (const b of this.bots) b.onNoise(actor, radius); }
    emitNoiseAt(pos, radius, owner) { for (const b of this.bots) { if (!b.alive) continue; if (b.pos.distanceTo(pos) < radius && b.state === 'idle') { b.holdYaw = Math.atan2(-(pos.x - b.pos.x), -(pos.z - b.pos.z)); b.lookAroundT = 2; } } }
    shake(pos, strength, dur) { const d = pos.distanceTo(this.player.pos); const k = S3.clamp(1 - d / 30, 0, 1); if (k <= 0) return; this.shakeAmt = Math.max(this.shakeAmt, strength * k * 0.02); this.shakeT = dur; }
    nextSpectate() { const p = this.player; const list = this.actors.filter((a) => a.alive && a !== p && (this.mode.id === 'ffa' || a.team === p.team)); if (!list.length) { p.spectateTarget = null; return; } let i = list.indexOf(p.spectateTarget); p.spectateTarget = list[(i + 1) % list.length]; }
    // ---------- combat ----------
    traceBullet(shooter, ox, oy, oz, dx, dy, dz, maxDist) {
      const wh = this.world.raycast(ox, oy, oz, dx, dy, dz, maxDist); let best = wh ? wh.t : maxDist; let res = wh ? { type: 'world', t: wh.t, x: wh.x, y: wh.y, z: wh.z, nx: wh.nx, ny: wh.ny, nz: wh.nz, surface: wh.box.surface || 'concrete', box: wh.box } : null;
      for (const a of this.actors) {
        if (a === shooter || !a.alive) continue;
        const h = S3.hitTestCharacter(ox, oy, oz, dx, dy, dz, best, a); if (h && h.t < best) { best = h.t; res = { type: 'actor', t: h.t, x: ox + dx * h.t, y: oy + dy * h.t, z: oz + dz * h.t, actor: a, zone: h.zone }; }
      }
      return res;
    }
    // Full authoritative shot resolution: raycast, damage, penetration, all local + network feedback.
    // Runs on solo/host for EVERY actor (bots, the host's own player, and remote humans alike).
    // A client never calls this for its own weapon — see actorShootCosmetic() below.
    actorShoot(actor, dirs, recSide, recUp) {
      const w = actor.current, d = w.def; const eye = actor.eyePos(new V3()); const aim = actor.aimDir(new V3());
      const baseYaw = Math.atan2(-aim.x, -aim.z), basePitch = Math.asin(S3.clamp(aim.y, -1, 1));
      // muzzle
      let muzzle;
      if (actor.isLocal) { muzzle = this.vm.muzzleWorld.clone(); this.camera.localToWorld(muzzle); } else { const r = actor.right(this.tmp2); muzzle = eye.clone().addScaledVector(aim, 0.55).addScaledVector(r, 0.18); muzzle.y -= 0.12; }
      const isSil = d.sound === 'silenced';
      let netFeedback = null; // captured from the first pellet, for network replay on remote clients
      for (let pi = 0; pi < dirs.length; pi++) {
        const off = dirs[pi];
        const yaw = baseYaw - off[0] * S3.DEG, pitch = basePitch + off[1] * S3.DEG; const cp = Math.cos(pitch);
        const dir = new V3(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
        let ox = eye.x, oy = eye.y, oz = eye.z; let dmgMul = 1; let penetrations = 0; let travelled = 0;
        for (let pass = 0; pass < 2; pass++) {
          const hit = this.traceBullet(actor, ox, oy, oz, dir.x, dir.y, dir.z, 300 - travelled);
          const endP = hit ? new V3(hit.x, hit.y, hit.z) : new V3(ox, oy, oz).addScaledVector(dir, 120);
          if (pass === 0) this.effects.tracer(muzzle, endP);
          if (!hit) { if (pi === 0 && pass === 0) netFeedback = { end: endP, kind: null }; break; }
          const dist = travelled + hit.t;
          if (hit.type === 'actor') {
            const victim = hit.actor; let dmg = d.damage * Math.pow(d.rangeMod || 0.95, dist / 9.5) * dmgMul;
            const dealt = victim.takeDamage(dmg, actor, hit.zone, d.id, dir.x, dir.z);
            this.effects.blood(hit.x, hit.y, hit.z, dir.x, dir.y, dir.z); S3.Audio.fleshHit(endP);
            if (actor.isLocal && dealt > 0) { this.hud.hitmarkerShow(hit.zone === 'head', !victim.alive); S3.Audio.hitmarker(hit.zone === 'head'); S3.Stats.data.shotsHit++; }
            else if (!actor.isLocal && actor.isPlayer && dealt > 0 && this.net) this.net.sendHitmarker(actor, hit.zone === 'head', !victim.alive);
            if (pi === 0 && pass === 0) netFeedback = { end: endP, kind: 'actor', victim, zone: hit.zone };
            break;
          } else {
            this.effects.impact(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, hit.surface);
            if (endP.distanceTo(this.player.pos) < 45) { S3.Audio.impact(endP, hit.surface); if (Math.random() < 0.15 && hit.surface === 'metal') S3.Audio.ricochet(endP); }
            // near-miss whiz for the player
            if (actor !== this.player && this.player.alive && this.isEnemy(actor, this.player)) { const pe = this.player.eyePos(this.tmp3); const t = (pe.x - ox) * dir.x + (pe.y - oy) * dir.y + (pe.z - oz) * dir.z; if (t > 0 && t < hit.t) { const cx = ox + dir.x * t - pe.x, cy = oy + dir.y * t - pe.y, cz = oz + dir.z * t - pe.z; if (cx * cx + cy * cy + cz * cz < 2.2) S3.Audio.whiz(); } }
            if (pi === 0 && pass === 0) netFeedback = { end: endP, kind: 'world', nx: hit.nx, ny: hit.ny, nz: hit.nz, surface: hit.surface };
            // penetration
            const penPower = d.type === 'sniper' ? 0.8 : d.type === 'rifle' || d.type === 'mg' ? 0.5 : d.type === 'pistol' && d.id === 'deagle' ? 0.35 : d.type === 'shotgun' ? 0 : 0.2;
            if (penPower <= 0 || penetrations > 0) break;
            const box = hit.box; const exitT = this.exitT(hit.x, hit.y, hit.z, dir, box); if (exitT < 0 || exitT > penPower) break;
            penetrations++; dmgMul *= 0.55; travelled = dist + exitT + 0.02; ox = hit.x + dir.x * (exitT + 0.02); oy = hit.y + dir.y * (exitT + 0.02); oz = hit.z + dir.z * (exitT + 0.02);
            this.effects.impact(ox, oy, oz, -hit.nx, -hit.ny, -hit.nz, hit.surface);
          }
        }
      }
      // recoil punch after the shot
      actor.punchPitch += recUp; actor.punchYaw += recSide;
      // sounds / fx
      S3.Audio.gunshot(d.sound, actor.isLocal ? null : actor.pos, 1);
      this.effects.muzzleFlash(muzzle, aim, d.type === 'sniper' || d.type === 'shotgun' || d.type === 'mg');
      if (!isSil && d.type !== 'knife' && (actor.isLocal || actor.pos.distanceTo(this.player.pos) < 25)) { const r = actor.right(new V3()); this.effects.shell(muzzle.clone().addScaledVector(aim, -0.15), r, this.tmpUp); }
      this.emitNoise(actor, isSil ? 18 : 70);
      if (actor.isLocal) { this.vm.onShot(d.type === 'sniper' || d.type === 'shotgun' ? 1.6 : d.type === 'pistol' ? 0.8 : 1); S3.Stats.data.shotsFired++; }
      if (!actor.isLocal && actor.isPlayer && this.net && netFeedback) {
        const nf = netFeedback;
        this.net.sendShotFeedback(actor, d.id, muzzle, nf.end, nf.kind === 'world' ? { x: nf.nx, y: nf.ny, z: nf.nz } : null, nf.kind, nf.victim || null, nf.zone || null, nf.surface || null);
      }
    }
    // Cosmetic-only local echo of firing, used by a CLIENT for its OWN weapon: instant muzzle
    // flash / sound / recoil / shell so the trigger feels responsive, but NO raycast or damage —
    // the authoritative outcome (tracer, impact, blood, hitmarker) arrives moments later from the
    // host's broadcast 'shot' event and is rendered by ClientSync.
    actorShootCosmetic(actor, dirs, recSide, recUp) {
      const w = actor.current, d = w.def; const aim = actor.aimDir(new V3());
      const muzzle = this.vm.muzzleWorld.clone(); this.camera.localToWorld(muzzle);
      actor.punchPitch += recUp; actor.punchYaw += recSide;
      S3.Audio.gunshot(d.sound, null, 1);
      this.effects.muzzleFlash(muzzle, aim, d.type === 'sniper' || d.type === 'shotgun' || d.type === 'mg');
      if (d.sound !== 'silenced' && d.type !== 'knife') { const r = actor.right(new V3()); this.effects.shell(muzzle.clone().addScaledVector(aim, -0.15), r, this.tmpUp); }
      this.vm.onShot(d.type === 'sniper' || d.type === 'shotgun' ? 1.6 : d.type === 'pistol' ? 0.8 : 1); S3.Stats.data.shotsFired++;
    }
    exitT(x, y, z, dir, box) {
      let t = Infinity; const e = 1e-4;
      if (dir.x > e) t = Math.min(t, (box.max.x - x) / dir.x); else if (dir.x < -e) t = Math.min(t, (box.min.x - x) / dir.x);
      if (dir.y > e) t = Math.min(t, (box.max.y - y) / dir.y); else if (dir.y < -e) t = Math.min(t, (box.min.y - y) / dir.y);
      if (dir.z > e) t = Math.min(t, (box.max.z - z) / dir.z); else if (dir.z < -e) t = Math.min(t, (box.min.z - z) / dir.z);
      return t === Infinity ? -1 : t;
    }
    actorKnife(actor, alt) {
      const eye = actor.eyePos(new V3()); const dir = actor.aimDir(new V3()); const range = 2.1; const d = S3.WEAPONS.knife;
      if (actor.isLocal) this.vm.play(alt ? 'knife2' : 'knife1', alt ? 0.5 : 0.3);
      setTimeout(() => {
        if (!actor.alive) return;
        // wide hit test: try center ray and slight offsets
        let hit = null;
        for (const off of [[0, 0], [0.06, 0], [-0.06, 0], [0, 0.06], [0, -0.06]]) {
          const dd = new V3(dir.x + off[0], dir.y + off[1], dir.z).normalize(); const h = this.traceBullet(actor, eye.x, eye.y, eye.z, dd.x, dd.y, dd.z, range); if (h && h.type === 'actor') { hit = h; break; } if (!hit) hit = h;
        }
        if (hit && hit.type === 'actor') {
          const v = hit.actor; const vf = v.flatForward(this.tmp2); const toV = this.tmp3.set(v.pos.x - actor.pos.x, 0, v.pos.z - actor.pos.z).normalize(); const back = vf.dot(toV) > 0.45;
          let dmg = back ? d.backstab : (alt ? d.damageAlt : d.damage); if (hit.zone === 'head') dmg *= 1.2;
          v.takeDamage(dmg, actor, back ? 'body' : hit.zone, 'knife', dir.x, dir.z, { ignoreArmor: back }); this.effects.blood(hit.x, hit.y, hit.z, dir.x, dir.y, dir.z); S3.Audio.knifeHit(actor.isLocal ? null : actor.pos);
          if (actor.isLocal) { this.hud.hitmarkerShow(false, !v.alive); S3.Audio.hitmarker(false); } else if (actor.isPlayer && this.net) this.net.sendHitmarker(actor, false, !v.alive);
          if (!actor.isLocal && actor.isPlayer && this.net) this.net.sendMeleeFeedback(actor, alt, 'actor', new V3(hit.x, hit.y, hit.z), null, v, back ? 'body' : hit.zone, back);
        } else if (hit) {
          this.effects.impact(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, hit.surface); S3.Audio.knifeWall(actor.isLocal ? null : actor.pos);
          if (!actor.isLocal && actor.isPlayer && this.net) this.net.sendMeleeFeedback(actor, alt, 'world', new V3(hit.x, hit.y, hit.z), { x: hit.nx, y: hit.ny, z: hit.nz }, null, null, false);
        } else {
          S3.Audio.knifeSwing(actor.isLocal ? null : actor.pos);
          if (!actor.isLocal && actor.isPlayer && this.net) this.net.sendMeleeFeedback(actor, alt, null, null, null, null, null, false);
        }
      }, alt ? 220 : 90);
      this.emitNoise(actor, 6);
    }
    // Cosmetic-only local echo of a knife swing for a CLIENT's own player: instant viewmodel
    // animation + swing sound; the authoritative hit (if any) arrives via the host's 'melee' event.
    actorKnifeCosmetic(actor, alt) {
      this.vm.play(alt ? 'knife2' : 'knife1', alt ? 0.5 : 0.3);
      setTimeout(() => { if (actor.alive) S3.Audio.knifeSwing(null); }, alt ? 220 : 90);
      this.emitNoise(actor, 6);
    }
    explosionDamage(owner, pos, radius, maxDmg, weaponId) {
      for (const a of this.actors) {
        if (!a.alive) continue; const cx = a.pos.x, cy = a.pos.y + 0.9, cz = a.pos.z; const d = Math.hypot(cx - pos.x, cy - pos.y, cz - pos.z); if (d > radius) continue;
        const clear = this.world.lineOfSight(pos.x, pos.y + 0.2, pos.z, cx, cy, cz, false); let dmg = maxDmg * Math.pow(1 - d / radius, 1.1); if (!clear) dmg *= 0.25;
        if (dmg < 1) continue; const dx = (cx - pos.x) / (d + 0.01), dz = (cz - pos.z) / (d + 0.01);
        const dealt = a.takeDamage(dmg, owner, 'body', weaponId, dx, dz, { grenade: true });
        if (owner && dealt > 0 && a !== owner) { if (owner.isLocal) { this.hud.hitmarkerShow(false, !a.alive); S3.Audio.hitmarker(false); } else if (owner.isPlayer && this.net) this.net.sendHitmarker(owner, false, !a.alive); }
        this.shake(pos, 10, 0.4);
      }
    }
    flashActors(owner, pos, radius) {
      for (const a of this.actors) {
        if (!a.alive) continue; const eye = a.eyePos(this.tmp); const d = eye.distanceTo(pos); if (d > radius) continue;
        if (!this.world.lineOfSight(pos.x, pos.y, pos.z, eye.x, eye.y, eye.z, true)) continue;
        const fwd = a.forward(this.tmp2); const to = this.tmp3.set(pos.x - eye.x, pos.y - eye.y, pos.z - eye.z).normalize(); const dot = fwd.dot(to);
        let dur = 4.5 * (1 - d / radius * 0.5); if (dot > 0.4) dur *= 1; else if (dot > -0.3) dur *= 0.5; else dur *= 0.2;
        if (dur < 0.3) continue; a.flashT = Math.max(a.flashT, dur); a.flashMax = dur; if (a.isLocal) S3.Audio.flashRing(dur * 0.7); else if (a.isPlayer && this.net) this.net.sendFlashed(a, dur); if (a.isBot) { a.target = null; }
      }
    }
    throwGrenade(actor, weapon, strength) {
      if (!weapon || weapon.def.type !== 'grenade' || weapon.count <= 0) return;
      const eye = actor.eyePos(new V3()); const dir = actor.forward(new V3()); const origin = eye.clone().addScaledVector(dir, 0.4); origin.y -= 0.1;
      const vel = dir.clone().multiplyScalar(6 + 13 * strength); vel.y += 2.5 * strength; vel.add(actor.vel);
      // avoid spawning inside a wall
      if (this.world.raycast(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, 0.5)) origin.copy(eye);
      const gObj = this.effects.spawnGrenade(actor, weapon.id, origin, vel); S3.Audio.throwSound(); if (this.net && this.net.role === 'host') this.net.sendNadeThrow(gObj);
      const id = weapon.id; actor.consumeGrenade(weapon);
      if (actor.hasGrenade(id)) { const g = actor.hasGrenade(id); if (actor.current !== g) actor.select(g, true); else { g.draw(); if (actor.isLocal) this.vm.play('draw', 0.4); } }
      else if (actor.isPlayer) { setTimeout(() => { if (actor.alive && actor.current.def.type === 'grenade' && actor.current.count <= 0) actor.select(actor.bestWeapon(), true); }, 350); }
      if (actor.isPlayer) this.radioMaybe(actor, id);
    }
    radioMaybe(actor, id) { if (id === 'flash' && Math.random() < 0.5) this.radio(actor, 'Флешка!'); else if (id === 'he' && Math.random() < 0.3) this.radio(actor, 'Граната!'); }
    dropWeaponFrom(actor, weapon, byPlayer) {
      if (!weapon || weapon === actor.inv.melee) return; if (weapon.def.type === 'bomb') { if (this.mode.bombCarrierDied) { this.mode.bombCarrierDied(actor); } return; }
      const eye = actor.eyePos(new V3()); const dir = actor.forward(new V3()); const vel = dir.clone().multiplyScalar(byPlayer ? 4 : 2); vel.y += 1.5;
      actor.removeWeapon(weapon); this.effects.spawnPickup(weapon, eye.clone().addScaledVector(dir, 0.3), vel, false);
    }
    tryPickup(actor) {
      let best = null, bd = 2.2; for (const p of this.effects.pickups) { const d = p.pos.distanceTo(actor.pos); if (d < bd) { bd = d; best = p; } }
      if (!best) return false; if (best.isBomb) { return false; }
      const w = best.weapon; const slot = w.def.slot; const cur = actor.inv[slot];
      if (cur) { if (actor.isBot) return false; this.dropWeaponFrom(actor, cur, false); }
      actor.inv[slot] = w; w.draw(); this.effects.removePickup(best); if (actor.isPlayer || !actor.inv.primary || slot === 'primary') actor.select(w, true); S3.Audio.pickup();
      if (actor.isLocal) this.hud.addChat(`<span class="sys">Подобрано: ${w.def.name}</span>`);
      return true;
    }
    onActorDeath(v, attacker, weaponId, headshot) {
      const a = attacker && attacker !== v ? attacker : null;
      if (a && this.isEnemy(a, v)) {
        a.kills++; a.roundKills++; a.score += headshot ? 2 : 1; if (headshot) a.headshots++;
        if (a.isLocal) { S3.Stats.data.kills++; if (headshot) S3.Stats.data.headshots++; S3.Audio.killConfirm(); this.hud.hitmarkerShow(headshot, true); }
        else if (a.isPlayer && this.net) this.net.sendKillConfirm(a, headshot);
      }
      else if (a && !this.isEnemy(a, v)) { a.score -= 1; if (a.isLocal) this.hud.addChat('<span class="sys" style="color:#ff6060">Вы убили союзника!</span>'); }
      // assists
      for (const id in v.damagers) { if (+id === (a ? a.id : -1)) continue; const dm = v.damagers[id]; if (dm >= 40) { const helper = this.actors.find((x) => x.id === +id); if (helper && this.isEnemy(helper, v)) { helper.assists++; helper.score += 1; } } }
      if (v.isLocal) { S3.Stats.data.deaths++; S3.Audio.death(); v.spectateTarget = a && this.mode.id !== 'ffa' ? a : null; if (a && a !== v) this.hud.addChat(`<span class="sys">Вас убил ${a.name} (${S3.WEAPONS[weaponId] ? S3.WEAPONS[weaponId].name : weaponId})${headshot ? ' — в голову' : ''}</span>`); }
      else if (v.isPlayer && this.net) this.net.sendDeathFeedback(v, a, weaponId, headshot);
      this.hud.killfeed(a, v, weaponId, headshot);
      if (this.net && this.net.role === 'host') this.net.broadcastKillfeed(a, v, weaponId, headshot);
      if (a && a.isBot && this.isEnemy(a, v) && Math.random() < 0.35) this.radio(a, S3.pick(['Враг уничтожен!', 'Минус один!', 'Готов!', 'Есть!']));
      // drop weapon
      const drop = v.inv.primary || (v.inv.secondary && v.inv.secondary.def.price > 300 ? v.inv.secondary : null);
      if (drop && this.mode.id === 'defuse') { const vel = new V3((Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2); v.removeWeapon(drop); this.effects.spawnPickup(drop, v.pos.clone().add(new V3(0, 1, 0)), vel, false); }
      for (const b of this.bots) { if (b.target === v) { b.target = null; b.targetVisible = false; } }
      this.mode.onDeath(v, a, weaponId, headshot);
      this.effects.blood(v.pos.x, v.pos.y + 1, v.pos.z, 0, 0.5, 0);
    }
    matchOver(winner, text) {
      this.over = true; const p = this.player; const won = winner === p.team; const st = S3.Stats.data; st.matches++; if (winner) { if (won) st.wins++; else st.losses++; } S3.Stats.save();
      this.hud.showBanner(winner === null ? 'НИЧЬЯ' : (won ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ'), text, 6, won ? '#6fdc6f' : '#ff6060'); if (won) S3.Audio.roundWin(); else S3.Audio.roundLose();
      setTimeout(() => { if (this.onMatchOver) this.onMatchOver(winner, text); }, 4500);
    }
    // ---------- loop ----------
    loop(now) {
      if (!this.running) return; requestAnimationFrame((t) => this.loop(t));
      let dt = Math.min(0.05, (now - this.lastFrame) / 1000); this.lastFrame = now; if (dt <= 0) dt = 0.001;
      this.frameCount++; this.fpsT += dt; if (this.fpsT > 0.5) { this.fps = this.frameCount / this.fpsT; this.frameCount = 0; this.fpsT = 0; }
      if (!this.paused) { this.time += dt; this.update(dt); }
      this.render(dt); S3.Input.endFrame();
    }
    update(dt) {
      const I = S3.Input; const p = this.player; const isClient = this.net && this.net.role === 'client';
      if (I.justPressed('scoreboard')) this.hud.toggleScoreboard(true); if (I.justReleased('scoreboard')) this.hud.toggleScoreboard(false);
      p.handleInput(dt);
      if (isClient) {
        // capture the just-computed transient intent BEFORE updateMovement/updateWeapon consume it
        this.net.sendInput(S3.buildInputPacket(p));
        p.updateMovement(dt); p.updateWeapon(dt);
        this.net.update(dt); // puppet interpolation + local reconciliation
      } else {
        if (this.net && this.net.role === 'host') this.net.applyAllInputs(dt);
        this.mode.update(dt);
        for (const a of this.actors) {
          if (a.alive) { if (a.isBot) a.think(dt); a.updateMovement(dt); a.updateWeapon(dt); }
          else { a.deadT += dt; }
          a.updateModel(dt);
        }
        // bots auto pickup weapons if they lack a primary
        this.pickupT -= dt; if (this.pickupT <= 0) { this.pickupT = 0.5; for (const b of this.bots) { if (!b.alive || b.inv.primary) continue; for (const pk of this.effects.pickups) { if (!pk.isBomb && pk.rest && pk.weapon.def.slot === 'primary' && pk.pos.distanceTo(b.pos) < 1.6) { this.tryPickup(b); break; } } } }
        if (this.net && this.net.role === 'host') this.net.tickSnapshot(dt);
      }
      this.effects.update(dt);
      this.radarT -= dt; if (this.radarT <= 0) { this.radarT = 0.15; this.updateRadarVis(); }
      // camera
      p.updateCamera(this.camera, dt);
      if (this.shakeT > 0) { this.shakeT -= dt; const s = this.shakeAmt * Math.min(1, this.shakeT * 2); this.camera.rotation.x += (Math.random() - 0.5) * s; this.camera.rotation.y += (Math.random() - 0.5) * s; this.camera.rotation.z += (Math.random() - 0.5) * s * 0.5; if (this.shakeT <= 0) this.shakeAmt = 0; }
      this.camera.updateMatrixWorld();
      // audio listener
      const fwd = this.tmp.set(0, 0, -1).applyQuaternion(this.camera.quaternion); const up = this.tmp2.set(0, 1, 0).applyQuaternion(this.camera.quaternion); S3.Audio.setListener(this.camera.position, fwd, up);
      // viewmodel
      const w = p.current; this.vm.hidden = !p.alive;
      this.vm.update(dt, { speedFrac: p.speedFrac, onGround: p.body.onGround, mouseDX: p.mouseDX, mouseDY: p.mouseDY, scoped: p.scoped && w && w.def.scope, crouch: p.crouching, aspect: this.camera.aspect, pinPulled: p.pinPulled, lower: this.mode.frozen(p) && this.mode.id === 'defuse' && this.mode.phase === 'freeze' ? false : false });
      this.hud.update(dt);
      if (p.alive && this.hud.hint.style.display === 'block') { this.hud.hintT = (this.hud.hintT || 0) + dt; if (this.hud.hintT > 0.3) { this.hud.setHint(''); this.hud.hintT = 0; } }
    }
    render(dt) {
      const r = this.renderer; r.clear(); r.render(this.scene, this.camera); r.clearDepth(); if (this.vm.root.visible) r.render(this.vm.scene, this.vm.camera);
    }
    setPaused(v) { this.paused = v; if (v) S3.Input.unlock(); }
    destroy() {
      this.running = false; S3.Audio.stopAmbient(); this.hud.setVisible(false);
      this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); this.renderer.dispose(); S3.Input.unlock();
    }
  }
  S3.Game = Game;
})();
