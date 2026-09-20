// ===== Standoff 3 — input (keyboard / mouse / pointer lock) =====
'use strict';
(function () {
  const S3 = window.S3;
  const I = {
    keys: {}, pressed: {}, released: {},
    mouseDX: 0, mouseDY: 0, wheel: 0,
    buttons: [false, false, false], btnPressed: [false, false, false], btnReleased: [false, false, false],
    locked: false, wantLock: false, enabled: true, canvas: null,
    bindings: {
      forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
      jump: ['Space'], crouch: ['ControlLeft', 'KeyC'], walk: ['ShiftLeft'], reload: ['KeyR'], use: ['KeyE'], drop: ['KeyG'],
      buy: ['KeyB'], scoreboard: ['Tab'], lastWeapon: ['KeyQ'], slot1: ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'], slot4: ['Digit4'], slot5: ['Digit5'],
      inspect: ['KeyF'], radio: ['KeyZ'], chat: ['KeyY'], teamchat: ['KeyU'], voice: ['KeyK'], pause: ['Escape'],
    },
    // human-readable names + order for the rebinding UI
    ACTIONS: [['forward', 'Вперёд'], ['back', 'Назад'], ['left', 'Влево'], ['right', 'Вправо'], ['jump', 'Прыжок'], ['crouch', 'Присед'], ['walk', 'Тихий шаг'], ['reload', 'Перезарядка'], ['use', 'Использовать / подобрать / играть за бота'], ['drop', 'Выбросить оружие'], ['buy', 'Магазин'], ['scoreboard', 'Таблица'], ['lastWeapon', 'Предыдущее оружие'], ['slot1', 'Слот 1 — основное'], ['slot2', 'Слот 2 — пистолет'], ['slot3', 'Слот 3 — нож'], ['slot4', 'Слот 4 — гранаты'], ['slot5', 'Слот 5 — бомба'], ['inspect', 'Осмотр оружия'], ['radio', 'Радио'], ['chat', 'Чат всем'], ['teamchat', 'Чат команде'], ['voice', 'Говорить (голос)']],
    defaultBindings: null,
    applyBindings(saved) { if (!this.defaultBindings) this.defaultBindings = JSON.parse(JSON.stringify(this.bindings)); const b = JSON.parse(JSON.stringify(this.defaultBindings)); for (const k in (saved || {})) if (b[k] && Array.isArray(saved[k]) && saved[k].length) b[k] = saved[k].slice(); this.bindings = b; },
    keyName(code) { if (!code) return '—'; const m = { Space: 'Space', ControlLeft: 'Ctrl', ControlRight: 'Правый Ctrl', ShiftLeft: 'Shift', ShiftRight: 'Правый Shift', AltLeft: 'Alt', AltRight: 'Правый Alt', Tab: 'Tab', Escape: 'Esc', Enter: 'Enter', Backquote: '`', CapsLock: 'Caps', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' }; if (m[code]) return m[code]; if (code.startsWith('Key')) return code.slice(3); if (code.startsWith('Digit')) return code.slice(5); if (code.startsWith('Numpad')) return 'Num ' + code.slice(6); return code; },
    init(canvas) {
      this.canvas = canvas;
      window.addEventListener('keydown', (e) => {
        if (e.repeat || this.blocked) return;
        this.keys[e.code] = true; this.pressed[e.code] = true;
        if (['Tab', 'Space', 'KeyF', 'KeyB'].includes(e.code) && this.locked) e.preventDefault();
        if (e.code === 'Tab') e.preventDefault();
        if (e.altKey) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => { if (this.blocked) return; this.keys[e.code] = false; this.released[e.code] = true; });
      window.addEventListener('blur', () => { this.keys = {}; for (let i = 0; i < 3; i++) this.buttons[i] = false; });
      document.addEventListener('mousemove', (e) => {
        if (!this.locked) return;
        let dx = e.movementX || 0, dy = e.movementY || 0;
        if (Math.abs(dx) > 300 || Math.abs(dy) > 300) return; // pointer-lock glitch guard
        this.mouseDX += dx; this.mouseDY += dy;
      });
      document.addEventListener('mousedown', (e) => {
        if (e.button < 3) { this.buttons[e.button] = true; this.btnPressed[e.button] = true; }
        if (this.locked && e.button !== 0) e.preventDefault();
      });
      document.addEventListener('mouseup', (e) => { if (e.button < 3) { this.buttons[e.button] = false; this.btnReleased[e.button] = true; } });
      document.addEventListener('contextmenu', (e) => { if (this.locked || e.target === canvas) e.preventDefault(); });
      document.addEventListener('wheel', (e) => { if (this.locked) { this.wheel += Math.sign(e.deltaY); e.preventDefault(); } }, { passive: false });
      document.addEventListener('pointerlockchange', () => {
        this.locked = document.pointerLockElement === canvas;
        if (!this.locked) { this.keys = {}; this.buttons = [false, false, false]; }
        if (this.onLockChange) this.onLockChange(this.locked);
      });
      document.addEventListener('pointerlockerror', () => { this.locked = false; });
    },
    lock() {
      if (!this.canvas || this.locked) return;
      const plain = () => { try { const q = this.canvas.requestPointerLock(); if (q && q.catch) q.catch(() => { }); } catch (e) { } };
      try { const p = this.canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => plain()); } catch (e) { plain(); }
    },
    unlock() { if (document.pointerLockElement) document.exitPointerLock(); },
    down(action) { const b = this.bindings[action]; if (!b) return false; for (const k of b) if (this.keys[k]) return true; return false; },
    justPressed(action) { const b = this.bindings[action]; if (!b) return false; for (const k of b) if (this.pressed[k]) return true; return false; },
    justReleased(action) { const b = this.bindings[action]; if (!b) return false; for (const k of b) if (this.released[k]) return true; return false; },
    consumeMouse() { const dx = this.mouseDX, dy = this.mouseDY; this.mouseDX = 0; this.mouseDY = 0; return [dx, dy]; },
    consumeWheel() { const w = this.wheel; this.wheel = 0; return w; },
    endFrame() { this.pressed = {}; this.released = {}; this.btnPressed = [false, false, false]; this.btnReleased = [false, false, false]; this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0; },
  };
  S3.Input = I;
})();
