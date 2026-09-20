// ===== Standoff 3 — procedural audio engine (Web Audio) =====
'use strict';
(function () {
  const S3 = window.S3;

  const A = {
    ctx: null, master: null, sfx: null, music: null, noiseBuf: null, ready: false,
    listenerPos: new THREE.Vector3(), listenerFwd: new THREE.Vector3(0, 0, -1),
    ambientNodes: null,

    init() {
      if (this.ready) return;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain(); this.sfx.connect(this.master);
      this.music = this.ctx.createGain(); this.music.connect(this.master);
      const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
      this.sfx.disconnect(); this.sfx.connect(comp); comp.connect(this.master);
      // noise buffer
      const len = this.ctx.sampleRate * 2; const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.ready = true;
      this.applyVolume();
    },
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    applyVolume() {
      if (!this.ready) return;
      this.sfx.gain.value = S3.Settings.data.volume; this.music.gain.value = S3.Settings.data.music * 0.6;
    },
    setListener(pos, fwd, up) {
      if (!this.ready) return; this.listenerPos.copy(pos); this.listenerFwd.copy(fwd);
      const L = this.ctx.listener; const t = this.ctx.currentTime;
      if (L.positionX) {
        L.positionX.setTargetAtTime(pos.x, t, 0.02); L.positionY.setTargetAtTime(pos.y, t, 0.02); L.positionZ.setTargetAtTime(pos.z, t, 0.02);
        L.forwardX.setTargetAtTime(fwd.x, t, 0.02); L.forwardY.setTargetAtTime(fwd.y, t, 0.02); L.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
        L.upX.setTargetAtTime(up.x, t, 0.02); L.upY.setTargetAtTime(up.y, t, 0.02); L.upZ.setTargetAtTime(up.z, t, 0.02);
      } else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
    },
    // output node for a sound: either direct (2D) or a panner (3D)
    out(pos, refDist, maxDist, rolloff) {
      if (!pos) return this.sfx;
      const p = this.ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
      p.refDistance = refDist || 2; p.maxDistance = maxDist || 120; p.rolloffFactor = rolloff || 1.2;
      p.positionX ? (p.positionX.value = pos.x, p.positionY.value = pos.y, p.positionZ.value = pos.z) : p.setPosition(pos.x, pos.y, pos.z);
      p.connect(this.sfx); return p;
    },
    noise(dur, out, opts) {
      opts = opts || {};
      const c = this.ctx; const t = c.currentTime + (opts.delay || 0);
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true; src.playbackRate.value = opts.rate || 1;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(opts.vol || 1, t + (opts.attack || 0.002));
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      let node = src;
      if (opts.bp) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = opts.bp; f.Q.value = opts.q || 0.7; node.connect(f); node = f; }
      if (opts.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(opts.lp, t); if (opts.lpEnd) f.frequency.exponentialRampToValueAtTime(opts.lpEnd, t + dur); node.connect(f); node = f; }
      if (opts.hp) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = opts.hp; node.connect(f); node = f; }
      node.connect(g); g.connect(out); src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
    },
    tone(freq, dur, out, opts) {
      opts = opts || {};
      const c = this.ctx; const t = c.currentTime + (opts.delay || 0);
      const o = c.createOscillator(); o.type = opts.type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (opts.freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(opts.vol || 0.5, t + (opts.attack || 0.003));
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      let node = o;
      if (opts.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; node.connect(f); node = f; }
      node.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    },

    // ---- high-level sounds ----
    // kind: pistol, rifle, smg, sniper, shotgun, silenced, mg
    gunshot(kind, pos, volMul) {
      if (!this.ready) return; volMul = volMul || 1;
      const out = this.out(pos, 3, 200, 1.0);
      const far = pos ? S3.clamp(pos.distanceTo(this.listenerPos) / 60, 0, 1) : 0; // far shots: more low-passed
      const v = volMul * (pos ? 1.0 : 0.9);
      const rnd = 0.9 + Math.random() * 0.2;
      switch (kind) {
        case 'pistol':
          this.noise(0.12, out, { vol: 0.9 * v, lp: 6000 - far * 3000, lpEnd: 400, rate: rnd });
          this.tone(200 * rnd, 0.1, out, { vol: 0.6 * v, freqEnd: 50, type: 'triangle' });
          this.noise(0.03, out, { vol: 0.6 * v, hp: 3000, rate: rnd });
          break;
        case 'silenced':
          this.noise(0.08, out, { vol: 0.4 * v, lp: 1800, lpEnd: 300, rate: rnd });
          this.tone(150, 0.06, out, { vol: 0.25 * v, freqEnd: 60 });
          break;
        case 'smg':
          this.noise(0.09, out, { vol: 0.8 * v, lp: 7000 - far * 4000, lpEnd: 500, rate: rnd * 1.2 });
          this.tone(230 * rnd, 0.07, out, { vol: 0.5 * v, freqEnd: 70, type: 'triangle' });
          break;
        case 'rifle':
          this.noise(0.16, out, { vol: 1.0 * v, lp: 5500 - far * 3000, lpEnd: 300, rate: rnd });
          this.tone(140 * rnd, 0.14, out, { vol: 0.8 * v, freqEnd: 40, type: 'triangle' });
          this.noise(0.04, out, { vol: 0.7 * v, hp: 2500, rate: rnd });
          break;
        case 'mg':
          this.noise(0.14, out, { vol: 1.0 * v, lp: 5000 - far * 3000, lpEnd: 300, rate: rnd * 0.9 });
          this.tone(120 * rnd, 0.14, out, { vol: 0.8 * v, freqEnd: 40, type: 'triangle' });
          break;
        case 'sniper':
          this.noise(0.35, out, { vol: 1.2 * v, lp: 4500 - far * 2500, lpEnd: 150, rate: rnd * 0.8 });
          this.tone(90 * rnd, 0.35, out, { vol: 1.0 * v, freqEnd: 30, type: 'triangle' });
          this.noise(0.05, out, { vol: 0.8 * v, hp: 2000, rate: rnd });
          this.noise(0.6, out, { vol: 0.25 * v, lp: 600, lpEnd: 80, delay: 0.05 });
          break;
        case 'shotgun':
          this.noise(0.3, out, { vol: 1.2 * v, lp: 4000 - far * 2000, lpEnd: 150, rate: rnd * 0.7 });
          this.tone(80 * rnd, 0.3, out, { vol: 1.0 * v, freqEnd: 30, type: 'triangle' });
          this.noise(0.06, out, { vol: 0.7 * v, hp: 1500, rate: rnd });
          break;
      }
    },
    dryfire(pos) { if (!this.ready) return; const out = this.out(pos, 1, 10); this.noise(0.03, out, { vol: 0.5, bp: 2500, q: 2 }); },
    reloadMagOut(pos) { if (!this.ready) return; const out = this.out(pos, 1.5, 25); this.noise(0.06, out, { vol: 0.45, bp: 1200, q: 1.5 }); this.tone(400, 0.05, out, { vol: 0.15, freqEnd: 200, type: 'square', lp: 1200 }); },
    reloadMagIn(pos) { if (!this.ready) return; const out = this.out(pos, 1.5, 25); this.noise(0.05, out, { vol: 0.55, bp: 900, q: 1.2 }); this.tone(220, 0.06, out, { vol: 0.2, freqEnd: 120, type: 'triangle' }); },
    reloadSlide(pos) { if (!this.ready) return; const out = this.out(pos, 1.5, 25); this.noise(0.04, out, { vol: 0.6, bp: 3000, q: 2 }); this.noise(0.05, out, { vol: 0.5, bp: 1800, q: 2, delay: 0.06 }); },
    boltAction(pos) { if (!this.ready) return; const out = this.out(pos, 1.5, 25); this.noise(0.05, out, { vol: 0.5, bp: 2500, q: 2 }); this.noise(0.06, out, { vol: 0.5, bp: 1500, q: 2, delay: 0.12 }); },
    shellDrop(pos) { if (!this.ready) return; const out = this.out(pos, 1, 8); const f = 3000 + Math.random() * 2000; this.tone(f, 0.05, out, { vol: 0.08, freqEnd: f * 0.7, type: 'triangle', delay: 0.3 + Math.random() * 0.2 }); this.tone(f * 1.3, 0.04, out, { vol: 0.05, type: 'triangle', delay: 0.42 + Math.random() * 0.2 }); },
    weaponSwitch(pos) { if (!this.ready) return; const out = this.out(pos, 1, 10); this.noise(0.04, out, { vol: 0.35, bp: 1500, q: 1.5 }); this.noise(0.03, out, { vol: 0.3, bp: 2500, q: 2, delay: 0.08 }); },
    footstep(pos, mat, vol) {
      if (!this.ready) return; const out = this.out(pos, 1.2, 30, 1.5); const r = 0.8 + Math.random() * 0.4; vol = vol || 1;
      switch (mat) {
        case 'metal': this.noise(0.09, out, { vol: 0.35 * vol, bp: 900 * r, q: 2 }); this.tone(500 * r, 0.08, out, { vol: 0.1 * vol, freqEnd: 200, type: 'triangle' }); break;
        case 'wood': this.noise(0.07, out, { vol: 0.35 * vol, bp: 500 * r, q: 1.5 }); this.tone(150 * r, 0.06, out, { vol: 0.15 * vol, freqEnd: 80 }); break;
        case 'sand': case 'dirt': case 'grass': this.noise(0.12, out, { vol: 0.32 * vol, lp: 1800 * r, lpEnd: 400, rate: r }); break;
        default: this.noise(0.07, out, { vol: 0.3 * vol, bp: 1300 * r, q: 1.2 }); this.noise(0.05, out, { vol: 0.2 * vol, lp: 500, rate: r }); break;
      }
    },
    land(pos) { if (!this.ready) return; const out = this.out(pos, 1.5, 30); this.noise(0.15, out, { vol: 0.5, lp: 900, lpEnd: 200 }); this.tone(90, 0.12, out, { vol: 0.3, freqEnd: 40 }); },
    jump(pos) { if (!this.ready) return; const out = this.out(pos, 1.5, 20); this.noise(0.08, out, { vol: 0.25, bp: 1200, q: 1 }); },
    impact(pos, mat) {
      if (!this.ready) return; const out = this.out(pos, 2, 60, 1.3); const r = 0.8 + Math.random() * 0.4;
      if (mat === 'metal') { this.tone(1800 * r, 0.12, out, { vol: 0.3, freqEnd: 900, type: 'triangle' }); this.noise(0.04, out, { vol: 0.3, bp: 3000, q: 3 }); }
      else if (mat === 'wood') { this.noise(0.06, out, { vol: 0.4, bp: 700 * r, q: 1.5 }); }
      else { this.noise(0.05, out, { vol: 0.45, bp: 2200 * r, q: 1.2 }); this.noise(0.08, out, { vol: 0.25, lp: 600, rate: r }); }
    },
    ricochet(pos) { if (!this.ready) return; const out = this.out(pos, 2, 60); const f = 2000 + Math.random() * 1500; this.tone(f, 0.18, out, { vol: 0.2, freqEnd: f * 0.4, type: 'sine' }); },
    whiz() { if (!this.ready) return; this.noise(0.12, this.sfx, { vol: 0.35, bp: 3000 + Math.random() * 2000, q: 6, rate: 1.5 }); },
    fleshHit(pos) { if (!this.ready) return; const out = this.out(pos, 2, 40); this.noise(0.08, out, { vol: 0.5, lp: 900, lpEnd: 200 }); this.tone(180, 0.07, out, { vol: 0.25, freqEnd: 70 }); },
    hitmarker(head) { if (!this.ready) return; if (head) { this.tone(1400, 0.09, this.sfx, { vol: 0.28, type: 'square', lp: 3000 }); this.tone(2100, 0.12, this.sfx, { vol: 0.2, delay: 0.04, type: 'sine' }); } else { this.tone(900, 0.05, this.sfx, { vol: 0.25, type: 'square', lp: 2500 }); } },
    killConfirm() { if (!this.ready) return; this.tone(660, 0.08, this.sfx, { vol: 0.2, type: 'triangle' }); this.tone(990, 0.12, this.sfx, { vol: 0.2, type: 'triangle', delay: 0.07 }); },
    hurt() { if (!this.ready) return; this.noise(0.15, this.sfx, { vol: 0.4, lp: 700, lpEnd: 150 }); this.tone(120, 0.15, this.sfx, { vol: 0.3, freqEnd: 50 }); },
    death() { if (!this.ready) return; this.noise(0.5, this.sfx, { vol: 0.5, lp: 500, lpEnd: 80 }); this.tone(100, 0.5, this.sfx, { vol: 0.3, freqEnd: 30 }); },
    knifeSwing(pos) { if (!this.ready) return; const out = this.out(pos, 1.5, 15); this.noise(0.12, out, { vol: 0.35, bp: 1500, q: 1, rate: 1.4 }); },
    knifeHit(pos) { if (!this.ready) return; const out = this.out(pos, 1.5, 20); this.noise(0.09, out, { vol: 0.5, lp: 1200, lpEnd: 200 }); this.tone(300, 0.08, out, { vol: 0.2, freqEnd: 80 }); },
    knifeWall(pos) { if (!this.ready) return; const out = this.out(pos, 1.5, 20); this.tone(2500, 0.08, out, { vol: 0.2, freqEnd: 1200, type: 'triangle' }); this.noise(0.04, out, { vol: 0.3, bp: 3000, q: 2 }); },
    explosion(pos, big) {
      if (!this.ready) return; const out = this.out(pos, 6, 300, 0.8); const s = big ? 1.8 : 1;
      this.noise(0.5 * s, out, { vol: 1.5, lp: 3000, lpEnd: 60, rate: 0.6 });
      this.tone(60, 0.7 * s, out, { vol: 1.2, freqEnd: 20, type: 'triangle' });
      this.noise(1.6 * s, out, { vol: 0.5, lp: 400, lpEnd: 40, delay: 0.1 });
      this.noise(0.08, out, { vol: 0.9, hp: 1500 });
    },
    flashbang(pos) { if (!this.ready) return; const out = this.out(pos, 6, 300, 0.8); this.noise(0.25, out, { vol: 1.2, lp: 6000, lpEnd: 200 }); this.tone(3000, 0.4, out, { vol: 0.6, type: 'sine' }); this.tone(90, 0.3, out, { vol: 0.8, freqEnd: 30, type: 'triangle' }); },
    flashRing(dur) { if (!this.ready) return; this.tone(3800, dur, this.sfx, { vol: 0.35, type: 'sine', attack: 0.01 }); },
    smokePop(pos) { if (!this.ready) return; const out = this.out(pos, 4, 80); this.noise(0.4, out, { vol: 0.5, lp: 2500, lpEnd: 300 }); this.noise(2.5, out, { vol: 0.15, lp: 1200, rate: 0.8, delay: 0.2 }); },
    grenadeBounce(pos) { if (!this.ready) return; const out = this.out(pos, 2, 40); this.tone(1200, 0.08, out, { vol: 0.25, freqEnd: 500, type: 'triangle' }); this.noise(0.03, out, { vol: 0.3, bp: 2000, q: 2 }); },
    pinPull() { if (!this.ready) return; this.noise(0.03, this.sfx, { vol: 0.3, bp: 3500, q: 3 }); this.tone(2500, 0.06, this.sfx, { vol: 0.1, type: 'triangle', delay: 0.03 }); },
    throwSound() { if (!this.ready) return; this.noise(0.12, this.sfx, { vol: 0.3, bp: 1000, q: 1, rate: 1.2 }); },
    bombBeep(pos, urgent) { if (!this.ready) return; const out = this.out(pos, 4, 150, 0.9); this.tone(urgent ? 1400 : 1100, 0.09, out, { vol: 0.5, type: 'square', lp: 3000 }); },
    bombPlantTick() { if (!this.ready) return; this.tone(800, 0.04, this.sfx, { vol: 0.15, type: 'square', lp: 2000 }); },
    bombPlanted() { if (!this.ready) return; this.tone(600, 0.15, this.sfx, { vol: 0.35, type: 'square', lp: 2000 }); this.tone(600, 0.15, this.sfx, { vol: 0.35, type: 'square', lp: 2000, delay: 0.2 }); this.tone(450, 0.3, this.sfx, { vol: 0.35, type: 'square', lp: 2000, delay: 0.4 }); },
    bombDefused() { if (!this.ready) return; [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, this.sfx, { vol: 0.3, type: 'triangle', delay: i * 0.12 })); },
    defuseTick() { if (!this.ready) return; this.noise(0.03, this.sfx, { vol: 0.2, bp: 2500, q: 3 }); },
    roundStart() { if (!this.ready) return; [440, 554, 659].forEach((f, i) => this.tone(f, 0.3, this.sfx, { vol: 0.25, type: 'triangle', delay: i * 0.1 })); },
    roundWin() { if (!this.ready) return; [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.35, this.sfx, { vol: 0.3, type: 'triangle', delay: i * 0.11 })); },
    roundLose() { if (!this.ready) return; [440, 415, 370, 311].forEach((f, i) => this.tone(f, 0.45, this.sfx, { vol: 0.3, type: 'triangle', delay: i * 0.16 })); },
    buy() { if (!this.ready) return; this.tone(1200, 0.06, this.sfx, { vol: 0.2, type: 'square', lp: 3000 }); this.tone(1800, 0.1, this.sfx, { vol: 0.2, type: 'square', lp: 3000, delay: 0.07 }); },
    uiClick() { if (!this.ready) return; this.tone(900, 0.04, this.sfx, { vol: 0.12, type: 'square', lp: 2500 }); },
    uiHover() { if (!this.ready) return; this.tone(1400, 0.02, this.sfx, { vol: 0.05, type: 'sine' }); },
    error() { if (!this.ready) return; this.tone(220, 0.15, this.sfx, { vol: 0.2, type: 'square', lp: 1000 }); },
    armorEquip() { if (!this.ready) return; this.noise(0.15, this.sfx, { vol: 0.3, bp: 800, q: 1 }); this.noise(0.1, this.sfx, { vol: 0.3, bp: 1500, q: 1, delay: 0.15 }); },
    pickup() { if (!this.ready) return; this.noise(0.06, this.sfx, { vol: 0.3, bp: 1200, q: 1.5 }); this.tone(700, 0.08, this.sfx, { vol: 0.12, type: 'triangle', delay: 0.05 }); },
    levelUp() { if (!this.ready) return; [660, 880, 1320].forEach((f, i) => this.tone(f, 0.2, this.sfx, { vol: 0.25, type: 'triangle', delay: i * 0.08 })); },
    radio() { if (!this.ready) return; this.noise(0.05, this.sfx, { vol: 0.2, bp: 2000, q: 4 }); this.tone(1500, 0.05, this.sfx, { vol: 0.1, type: 'square', lp: 3000, delay: 0.05 }); },

    startAmbient(theme) {
      if (!this.ready) return; this.stopAmbient();
      const c = this.ctx; const g = c.createGain(); g.gain.value = 0; g.connect(this.music);
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = theme === 'industrial' ? 300 : 500;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.08; const lg = c.createGain(); lg.gain.value = 150; lfo.connect(lg); lg.connect(f.frequency);
      src.connect(f); f.connect(g); src.start(); lfo.start();
      g.gain.linearRampToValueAtTime(theme === 'industrial' ? 0.25 : 0.18, c.currentTime + 2);
      let hum = null;
      if (theme === 'industrial') { hum = c.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 50; const hg = c.createGain(); hg.gain.value = 0.02; const hf = c.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 120; hum.connect(hf); hf.connect(hg); hg.connect(this.music); hum.start(); }
      this.ambientNodes = { g, src, lfo, hum };
    },
    stopAmbient() {
      if (!this.ambientNodes) return; const n = this.ambientNodes; const t = this.ctx.currentTime;
      n.g.gain.linearRampToValueAtTime(0, t + 0.5); setTimeout(() => { try { n.src.stop(); n.lfo.stop(); if (n.hum) n.hum.stop(); } catch (e) { } }, 700);
      this.ambientNodes = null;
    },
    // simple menu music: slow arpeggio loop
    musicTimer: null, musicOn: false,
    startMenuMusic() {
      if (!this.ready || this.musicOn) return; this.musicOn = true;
      const c = this.ctx; const notes = [110, 130.8, 164.8, 196, 164.8, 130.8]; let i = 0;
      const step = () => {
        if (!this.musicOn) return;
        const f = notes[i % notes.length]; i++;
        this.tone(f, 1.2, this.music, { vol: 0.12, type: 'triangle', attack: 0.05, lp: 800 });
        this.tone(f * 2, 0.6, this.music, { vol: 0.05, type: 'sine', attack: 0.02 });
        if (i % 6 === 0) this.tone(55, 2.4, this.music, { vol: 0.15, type: 'sine', attack: 0.1 });
        this.musicTimer = setTimeout(step, 400);
      };
      step();
    },
    stopMenuMusic() { this.musicOn = false; if (this.musicTimer) clearTimeout(this.musicTimer); this.musicTimer = null; },
  };
  S3.Audio = A;
})();
