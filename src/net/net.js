// ===== Standoff 3 — LAN networking: WebSocket client wrapper + remote input state =====
'use strict';
(function () {
  const S3 = window.S3;

  // ---------- Net: thin wrapper around a WebSocket connection to the relay server ----------
  class Net {
    constructor() {
      this.ws = null; this.myId = null; this.hostId = null; this.role = null; // 'host' | 'client'
      this.name = 'Игрок'; this.connected = false; this.handlers = {}; this.onCloseCb = null; this.onErrorCb = null;
    }
    on(type, fn) { this.handlers[type] = fn; return this; }
    connect(url, name, wantHost) {
      return new Promise((resolve, reject) => {
        let settled = false;
        this.name = name || 'Игрок';
        let ws;
        try { ws = new WebSocket(url); } catch (e) { reject(e); return; }
        this.ws = ws;
        const timeout = setTimeout(() => { if (!settled) { settled = true; try { ws.close(); } catch (e) { } reject(new Error('timeout')); } }, 6000);
        ws.onopen = () => { this.connected = true; if (wantHost) this.send({ t: 'hostclaim', name: this.name }); else this.send({ t: 'hello', name: this.name, skins: this.skins || {} }); };
        ws.onmessage = (ev) => {
          let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
          if (msg.t === 'welcome') {
            this.myId = msg.id;
            // a joining player is "connected" as soon as the relay greets them, even if nobody has created a game yet
            if (!wantHost && !settled) { settled = true; clearTimeout(timeout); this.role = 'client'; this.hostId = null; resolve(this); }
          }
          else if (msg.t === 'sys' && msg.event === 'hostset') {
            const had = this.hostId; this.hostId = msg.id;
            if (wantHost && !settled) {
              settled = true; clearTimeout(timeout);
              if (this.myId === this.hostId) { this.role = 'host'; resolve(this); }
              else { try { ws.close(); } catch (e) { } reject(new Error('busy')); } // somebody else already holds the host seat on this relay
            } else if (!wantHost) {
              // the host appeared after we joined: our hello was dropped by the relay, send it again so we show up in the lobby
              if (had !== this.hostId) this.send({ t: 'hello', name: this.name, skins: this.skins || {} });
              if (this.handlers.hostset) this.handlers.hostset(msg);
            }
          } else if (msg.t === 'sys' && msg.event === 'hostleft') { if (this.handlers.hostleft) this.handlers.hostleft(); }
          else if (msg.t === 'sys' && msg.event === 'leave') { if (this.handlers.leave) this.handlers.leave(msg.id); }
          else { const h = this.handlers[msg.t]; if (h) h(msg); else if (this.handlers.message) this.handlers.message(msg); }
        };
        ws.onclose = () => { this.connected = false; if (this.onCloseCb) this.onCloseCb(); if (!settled) { settled = true; clearTimeout(timeout); reject(new Error('closed')); } };
        ws.onerror = () => { if (this.onErrorCb) this.onErrorCb(); };
      });
    }
    send(obj) { if (this.ws && this.connected) { try { this.ws.send(JSON.stringify(obj)); } catch (e) { } } }
    close() { if (this.ws) { try { this.ws.close(); } catch (e) { } } this.connected = false; }
  }
  S3.Net = Net;

  // ---------- RemoteInput: HOST-side per-connection mailbox for one remote human's intent ----------
  // Continuous fields (down/wishdir/yaw/pitch) always reflect the latest packet. One-shot fields
  // (pressed edges) are OR-accumulated between host ticks and consumed exactly once via take*().
  class RemoteInput {
    constructor() {
      this.wx = 0; this.wz = 0; this.yaw = 0; this.pitch = 0; this.crouch = false; this.walk = false; this.jump = false;
      this.fire = false; this.alt = false; this.useDown = false;
      this._firePressed = false; this._altPressed = false; this._useTap = false; this._reload = false; this._drop = false; this._lastw = false;
      this._slot = [false, false, false, false, false];
      this.lastPacketT = 0; this.ready = false;
    }
    applyPacket(pkt, now) {
      this.wx = pkt.wx || 0; this.wz = pkt.wz || 0; this.yaw = pkt.yaw || 0; this.pitch = pkt.pitch || 0;
      this.crouch = !!pkt.crouch; this.walk = !!pkt.walk; this.jump = !!pkt.jump; this.fire = !!pkt.fire; this.alt = !!pkt.alt; this.useDown = !!pkt.useDown;
      if (pkt.firePressed) this._firePressed = true; if (pkt.altPressed) this._altPressed = true; if (pkt.useTap) this._useTap = true;
      if (pkt.reload) this._reload = true; if (pkt.drop) this._drop = true; if (pkt.lastw) this._lastw = true;
      if (pkt.slot) for (let i = 0; i < 5; i++) if (pkt.slot[i]) this._slot[i] = true;
      this.lastPacketT = now; this.ready = true;
    }
    takeFirePressed() { const v = this._firePressed; this._firePressed = false; return v; }
    takeAltPressed() { const v = this._altPressed; this._altPressed = false; return v; }
    takeUseTap() { const v = this._useTap; this._useTap = false; return v; }
    takeReload() { const v = this._reload; this._reload = false; return v; }
    takeDrop() { const v = this._drop; this._drop = false; return v; }
    takeLastWeapon() { const v = this._lastw; this._lastw = false; return v; }
    takeSlot() { for (let i = 0; i < 5; i++) if (this._slot[i]) { this._slot[i] = false; return i + 1; } return 0; }
  }
  S3.RemoteInput = RemoteInput;

  // ---------- Client-side: build one input packet per local frame from the local Player + S3.Input ----------
  // Call AFTER player.handleInput(dt) has run (so yaw/pitch/wishDir/fire flags are up to date) and
  // BEFORE player.updateMovement/updateWeapon consume one-shot state.
  S3.buildInputPacket = function (player) {
    const I = S3.Input;
    return {
      t: 'input', wx: player.wishDir.x, wz: player.wishDir.z, yaw: player.yaw, pitch: player.pitch,
      crouch: player.wantCrouch, walk: player.walking, jump: player.wantJump,
      fire: player.fireHeld, firePressed: player.firePressed, alt: player.altHeld, altPressed: player.altPressed,
      useDown: I.down('use'), useTap: I.justPressed('use'),
      reload: I.justPressed('reload'), drop: I.justPressed('drop'), lastw: I.justPressed('lastWeapon'),
      slot: [I.justPressed('slot1'), I.justPressed('slot2'), I.justPressed('slot3'), I.justPressed('slot4'), I.justPressed('slot5')],
    };
  };
})();
