// ===== Standoff 3 — voice chat (push-to-talk) over the relay =====
// No WebRTC: the mic is captured with an AudioContext, downsampled to 16 kHz Int16, base64'd and sent as
// {t:'voice', k:<netKey>, d:<base64>} packets (~40 KB/s while the key is held). The relay fans a packet out to
// everyone else in the room; receivers schedule the chunks back-to-back on their own AudioContext.
'use strict';
(function () {
  const S3 = window.S3;
  const RATE = 16000, CHUNK = 2048;

  const V = S3.Voice = {
    game: null, net: null, ctx: null, mic: null, proc: null, stream: null, talking: false, peers: {}, speakingT: {}, gain: null, warned: false, hudT: 0,
    attach(game) {
      this.game = game; this.net = game.net && game.net.net; if (!this.net) return;
      this.myKey = game.net.role === 'host' ? 'host' : ('h' + this.net.myId);
      this.net.on('voice', (msg) => this.onPacket(msg));
      this.peers = {}; this.speakingT = {};
      this.loop = this.loop || (() => { if (!this.game) return; this.tick(); requestAnimationFrame(this.loop); });
      requestAnimationFrame(this.loop);
    },
    detach() { this.stopTalking(); this.game = null; this.net = null; this.peers = {}; this.speakingT = {}; },
    ensureCtx() {
      if (!this.ctx) { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.gain = this.ctx.createGain(); this.gain.connect(this.ctx.destination); }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.gain.gain.value = S3.Settings.data.voiceVolume !== undefined ? S3.Settings.data.voiceVolume : 1;
    },
    // ---- capture ----
    async startTalking() {
      if (this.talking || !this.net || !S3.Settings.data.voiceEnabled) return; this.talking = true;
      try {
        this.ensureCtx();
        if (!this.stream) this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        if (!this.talking) return; // key released while waiting for permission
        this.mic = this.ctx.createMediaStreamSource(this.stream);
        this.proc = this.ctx.createScriptProcessor(CHUNK, 1, 1);
        const ratio = this.ctx.sampleRate / RATE; let acc = [];
        this.proc.onaudioprocess = (e) => {
          if (!this.talking) return;
          const input = e.inputBuffer.getChannelData(0); const outLen = Math.floor(input.length / ratio); const pcm = new Int16Array(outLen);
          for (let i = 0; i < outLen; i++) { const v = input[Math.floor(i * ratio)]; pcm[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767))); }
          let bin = ''; const bytes = new Uint8Array(pcm.buffer); for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          this.net.send({ t: 'voice', k: this.myKey, d: btoa(bin) });
        };
        this.mic.connect(this.proc); this.proc.connect(this.gain); // (processor must be connected to run; it outputs silence)
        this.speakingT[this.myKey] = performance.now();
      } catch (e) {
        this.talking = false;
        if (!this.warned && this.game) { this.warned = true; this.game.hud.addChat('<span class="sys">Микрофон недоступен: ' + (e.message || e.name) + '</span>'); }
      }
    },
    stopTalking() {
      if (!this.talking) return; this.talking = false;
      try { if (this.proc) { this.proc.disconnect(); this.proc.onaudioprocess = null; } if (this.mic) this.mic.disconnect(); } catch (e) { }
      this.proc = null; this.mic = null;
    },
    // ---- playback ----
    onPacket(msg) {
      if (!this.game || S3.Settings.data.voiceMuteOthers || !msg.d || typeof msg.k !== 'string') return;
      this.ensureCtx();
      const bin = atob(msg.d); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const pcm = new Int16Array(bytes.buffer); const buf = this.ctx.createBuffer(1, pcm.length, RATE); const ch = buf.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
      const key = msg.k; let peer = this.peers[key]; if (!peer) peer = this.peers[key] = { next: 0 };
      const now = this.ctx.currentTime; if (peer.next < now + 0.02) peer.next = now + 0.06; // small jitter buffer
      const src = this.ctx.createBufferSource(); src.buffer = buf; src.connect(this.gain); src.start(peer.next); peer.next += buf.duration;
      this.speakingT[key] = performance.now();
    },
    tick() {
      const g = this.game; if (!g) return;
      const I = S3.Input; const want = !g.paused && !g.over && !I.blocked && I.down('voice') && S3.Settings.data.voiceEnabled;
      if (want && !this.talking) this.startTalking(); else if (!want && this.talking) this.stopTalking();
      // HUD: who is speaking
      const now = performance.now(); if (now - this.hudT > 120) {
        this.hudT = now; const names = [];
        for (const k in this.speakingT) { if (now - this.speakingT[k] > 400) continue; const a = k === this.myKey ? g.player : g.actors.find((x) => x.netKey === k); names.push((a ? a.name : 'Игрок') + (k === this.myKey ? ' (вы)' : '')); }
        g.hud.showTalking(names);
      }
    },
  };
})();
