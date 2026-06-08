/* ============================================================
   КУБОМИР — движок (HTML5 Canvas 2D, чистый JS, без сборки/картинок).
   Глобальный G: состояние, камера, ввод+джойстик, день/ночь, звук,
   частицы, тряска, реестр сцен, сейв, главный цикл. Стек — как в Mars.
   ============================================================ */
(function () {
  "use strict";
  const G = (window.G = {});

  /* ---- Логическое разрешение (iPad ландшафт 4:3) и размер тайла ---- */
  G.VIEW = { w: 1024, h: 768 };
  G.TILE = 48;
  const PI = Math.PI;
  G.PI = PI;

  /* ---- Хелперы ---- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  G.clamp = clamp; G.lerp = lerp; G.dist = dist;
  G.f = (px, w) => `${w ? w + " " : ""}${px}px -apple-system, system-ui, sans-serif`;
  G.rr = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  G.rectHit = (rt, x, y) => x >= rt.x && x <= rt.x + rt.w && y >= rt.y && y <= rt.y + rt.h;

  /* ---- Палитра (яркая дружелюбная) ---- */
  G.PAL = {
    grass1: "#6abe45", grass2: "#5aa838", grassBlade: "#83d35e",
    dirt: "#9a6a3c", dirtDk: "#7c5430",
    sand: "#ecd9a0", sandDk: "#d3bb84",
    water1: "#3f9fd6", water2: "#2f86c2", waterFoam: "#cdeaff",
    stone: "#a8a8b4", stoneDk: "#86868f", stoneCrack: "#6c6c77",
    snow: "#eef4fa", snowDk: "#d4e2ef",
    trunk: "#8a5a2e", trunkDk: "#5e3a1e", leaf: "#3fa83a", leafDk: "#2f8a2c", leafHi: "#76d35a",
    coalBit: "#2a2a32", ironBit: "#d9a86f", ironHi: "#f0cf9c",
    steveSkin: "#c98a5a", steveHair: "#3a2a1a", steveShirt: "#1fb0a0", steveShirtDk: "#178a7e",
    stevePants: "#4b3aa0", steveShoe: "#46464e",
    white: "#ffffff", ink: "#1a1a22", panel: "rgba(18,20,28,0.62)", panelLt: "rgba(255,255,255,0.14)",
    btn: "#ffce4a", btnDk: "#d89a1e", accent: "#ffce4a",
  };

  /* ---- Состояние игры (каркас: ресурсы-счётчики, позиция, сид) ---- */
  G.defaultState = function () {
    return {
      day: 1,
      sound: true,
      seed: 1337,
      hasPet: true,                               // питомец-волк «Лев» с тобой с самого начала (для Льва, 6 лет)
      inv: new Array(24).fill(null),              // 8 хотбар + 16 рюкзак
      sel: 0,                                     // выбранный слот (хотбар)
      hp: 20, maxHp: 20,                          // здоровье
      hunger: 20, maxHunger: 20,                  // сытость
      depth: 0, caveReturn: null,                 // текущий слой (0=поверхность) + точка возврата наверх
      homeX: null, homeY: null,                   // дом (точка старта) — для компаса
      air: 10, maxAir: 10,                        // запас воздуха под водой
      mp: 10, maxMp: 10,                          // ✨ мана для заклинаний (регенерирует)
      xp: 0, level: 1, perks: {},                 // 🆙 RPG-прогрессия: опыт/уровень/выбранные перки
      templeCleared: false,                       // ⚔ Страж Храма повержен (сердце-контейнер получен)
      questId: null, qkills: 0, questBase: 0, questsDone: 0, // 🗨 квесты жителей (Fallout)
      quests: {},                                 // выполненные цели-подсказки (онбординг)
      story: false,                               // режим: false=свободный, true=сюжет
      creative: false,                            // творческий режим: без урона/голода, бесконечные блоки
      bossDefeated: false,                        // Призрачный Король повержен (финал сюжета)
      chests: {},                                 // содержимое сундуков (ключ "depth,tx,ty" → массив слотов)
      px: 0, py: 0, face: 1,
    };
  };
  G.state = G.defaultState();
  G.resetState = function () { G.state = G.defaultState(); G.dayCycle = 0.30; };

  /* ---- Сложность (одна игра для всех возрастов: мирный → хард) ----
     spawn — частота/кол-во мобов, eHp/eDmg — HP/урон врагов, hunger — расход сытости. */
  const DIFFICULTY = [
    { key: "peaceful", name: "Мирный",  icon: "🟢", spawn: 0,   eHp: 1,   eDmg: 0,   hunger: 0,   hint: "без врагов, голод не тратится — чистая песочница" },
    { key: "easy",     name: "Лёгкий",  icon: "🔵", spawn: 0.5, eHp: 0.7, eDmg: 0.5, hunger: 0.5, hint: "для младших: мало слабых врагов, щадящий голод" },
    { key: "normal",   name: "Обычный", icon: "🟡", spawn: 1,   eHp: 1,   eDmg: 1,   hunger: 1,   hint: "как задумано" },
    { key: "hard",     name: "Сложный", icon: "🔴", spawn: 1.6, eHp: 1.5, eDmg: 1.7, hunger: 1.4, hint: "для ветеранов: больно и голодно" },
  ];
  G.DIFFICULTY = DIFFICULTY;
  G.difficulty = 1; // дефолт — лёгкий (доступно новичку, но не «детски»)
  try { const d = localStorage.getItem("cubeworld_difficulty"); if (d != null) G.difficulty = clamp(parseInt(d, 10) || 0, 0, 3); } catch (e) {}
  G.diff = () => DIFFICULTY[G.difficulty] || DIFFICULTY[1];
  G.setDifficulty = (i) => { G.difficulty = clamp(i | 0, 0, 3); try { localStorage.setItem("cubeworld_difficulty", G.difficulty); } catch (e) {} };
  G.cycleDifficulty = () => G.setDifficulty((G.difficulty + 1) % DIFFICULTY.length);

  /* ---- Камера (скроллится за игроком; мир рисуется со смещением) ---- */
  G.cam = { x: 0, y: 0 };
  G.worldToScreen = (wx, wy) => ({ x: wx - G.cam.x, y: wy - G.cam.y });
  G.screenToWorld = (sx, sy) => ({ x: sx + G.cam.x, y: sy + G.cam.y });

  /* ---- День/ночь (как в Mars): 0=полночь .25=рассвет .5=полдень .75=закат ---- */
  G.dayCycle = 0.30;
  const DAY_PERIOD = 300; // полный цикл ~5 минут
  G.sunHeight = () => Math.sin((G.dayCycle - 0.25) * 2 * PI); // -1..1
  G.daylight = () => clamp(G.sunHeight() * 0.6 + 0.5, 0, 1);  // 0 ночь .. 1 день
  G.dayNightOverlay = function (ctx) {
    const d = G.daylight();
    if (d >= 0.98) return;
    const night = 1 - d;
    ctx.save();
    ctx.fillStyle = `rgba(16,24,54,${(night * 0.22).toFixed(3)})`; // лёгкая тонировка (темноту делает drawLight)
    ctx.fillRect(0, 0, G.VIEW.w, G.VIEW.h);
    const sh = G.sunHeight();
    if (sh > -0.28 && sh < 0.28) { // тёплый отлив у горизонта на рассвете/закате
      ctx.fillStyle = `rgba(255,150,70,${(0.15 * (1 - Math.abs(sh) / 0.28)).toFixed(3)})`;
      ctx.fillRect(0, 0, G.VIEW.w, G.VIEW.h);
    }
    ctx.restore();
  };

  /* ---- Свет: темнота с «дырами» вокруг источников (игрок, факелы, печь) ---- */
  // Базовая тьма сцены: поверхность темнеет ночью (но не в ноль — луна); пещеры зададут scene.darkBase.
  G.sceneDark = function (scene) {
    if (scene && scene.darkBase != null) return scene.darkBase;
    return (1 - G.daylight()) * 0.62;
  };
  G._lightCv = null;
  G.drawLight = function (ctx, scene) {
    const dark = G.sceneDark(scene);
    if (dark < 0.05) return;
    // Тьму рисуем на отдельном холсте и «прорезаем» в нём дыры света, иначе
    // destination-out стёр бы и мир под ним (получался чёрный вместо светлого).
    if (!G._lightCv) G._lightCv = document.createElement("canvas");
    const lc = G._lightCv;
    if (lc.width !== G.VIEW.w || lc.height !== G.VIEW.h) { lc.width = G.VIEW.w; lc.height = G.VIEW.h; }
    const lx = lc.getContext("2d");
    lx.globalCompositeOperation = "source-over";
    lx.clearRect(0, 0, lc.width, lc.height);
    lx.fillStyle = `rgba(8,10,24,${dark.toFixed(3)})`;
    lx.fillRect(0, 0, lc.width, lc.height);
    lx.globalCompositeOperation = "destination-out"; // вырезаем свет из слоя тьмы
    const punch = (wx, wy, r) => {
      const sx = wx - G.cam.x, sy = wy - G.cam.y;
      if (sx < -r || sy < -r || sx > G.VIEW.w + r || sy > G.VIEW.h + r) return;
      const g = lx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.55, "rgba(0,0,0,0.82)"); g.addColorStop(1, "rgba(0,0,0,0)");
      lx.fillStyle = g; lx.fillRect(sx - r, sy - r, r * 2, r * 2);
    };
    if (scene && scene.px != null) punch(scene.px, scene.py, scene.lightR || 150); // игрок — слабый источник
    if (G.World && G.World.eachVisibleLight) G.World.eachVisibleLight(punch);       // факелы/печь
    ctx.drawImage(lc, 0, 0, G.VIEW.w, G.VIEW.h); // тьма с прозрачными дырами — поверх мира
  };

  /* ---- Частицы (мировые координаты; рисуются внутри translate камеры) ---- */
  G.fx = {
    parts: [],
    burst(x, y, color, n, spd, life) {
      n = n || 10; spd = spd || 130; life = life || 0.55;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * PI * 2, v = spd * (0.35 + Math.random() * 0.65);
        this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, t: life, c: color, r: 2 + Math.random() * 2.5 });
      }
    },
    ring(x, y, color, maxR, life) {
      this.parts.push({ ring: true, x, y, r: 0, maxR: maxR || 60, life: life || 0.5, t: life || 0.5, c: color });
    },
    update(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.t -= dt;
        if (p.t <= 0) { this.parts.splice(i, 1); continue; }
        if (p.ring) { p.r = p.maxR * (1 - p.t / p.life); }
        else { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; p.vy += 90 * dt; }
      }
    },
    draw(ctx) {
      for (const p of this.parts) {
        ctx.globalAlpha = Math.max(0, p.t / p.life);
        if (p.ring) {
          ctx.strokeStyle = p.c; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, PI * 2); ctx.stroke();
        } else {
          ctx.fillStyle = p.c;
          ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        }
      }
      ctx.globalAlpha = 1;
    },
  };

  /* ---- Тряска экрана / hit-stop ---- */
  G.time = 0; G.shakeAmt = 0; G.hitStopT = 0;
  G.shake = (a) => { G.shakeAmt = Math.max(G.shakeAmt, a); };
  G.hitStop = (s) => { G.hitStopT = Math.max(G.hitStopT, s); };

  /* ---- Ввод: клавиатура + указатель + динамический джойстик (из Mars) ---- */
  const input = (G.input = {
    keys: {},
    joy: { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, dx: 0, dy: 0, mag: 0 },
    pointer: { x: 0, y: 0, down: false },
  });
  G.moveDir = function () {
    let x = 0, y = 0; const k = input.keys;
    if (k.ArrowLeft || k.KeyA) x -= 1;
    if (k.ArrowRight || k.KeyD) x += 1;
    if (k.ArrowUp || k.KeyW) y -= 1;
    if (k.ArrowDown || k.KeyS) y += 1;
    if (input.joy.active && input.joy.mag > 0.12) { x += input.joy.dx; y += input.joy.dy; }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, mag: Math.min(1, m) };
  };
  G.actionPressed = false;
  function toLogical(cx, cy) {
    const r = G.canvas.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * G.VIEW.w, y: ((cy - r.top) / r.height) * G.VIEW.h };
  }
  G.toLogical = toLogical;
  G.uiBlock = []; // зоны UI, по которым НЕ запускается джойстик (сцена задаёт на кадр)
  function inUiBlock(x, y) { for (const b of G.uiBlock) if (G.rectHit(b, x, y)) return true; return false; }

  G.initInput = function () {
    const cv = G.canvas;
    const pointerStarts = {};

    window.addEventListener("keydown", (e) => {
      if (e.repeat) { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault(); return; }
      input.keys[e.code] = true;
      if (e.code === "KeyE" || e.code === "Space" || e.code === "Enter") {
        G.actionPressed = true; const s = G.scene; if (s && s.onAction) s.onAction();
      }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") { const s = G.scene; if (s && s.tryDash) s.tryDash(); } // 🤸 перекат
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => { input.keys[e.code] = false; });

    const onDown = (id, cx, cy) => {
      G.audio.resume();
      const p = toLogical(cx, cy);
      input.pointer.x = p.x; input.pointer.y = p.y; input.pointer.down = true;
      p.id = id; p.t0 = performance.now(); p.moved = 0; p.sx = p.x; p.sy = p.y;
      pointerStarts[id] = p;
      const s = G.scene;
      if (s && s.onPointerDown) s.onPointerDown(p.x, p.y);
      if (s && s.useJoystick && !input.joy.active && !inUiBlock(p.x, p.y)) {
        input.joy.active = true; input.joy.id = id;
        input.joy.ox = p.x; input.joy.oy = p.y; input.joy.x = p.x; input.joy.y = p.y;
        input.joy.dx = 0; input.joy.dy = 0; input.joy.mag = 0;
      }
    };
    const onMove = (id, cx, cy) => {
      const p = toLogical(cx, cy);
      input.pointer.x = p.x; input.pointer.y = p.y;
      const st = pointerStarts[id];
      if (st) st.moved = Math.max(st.moved, dist(st.sx, st.sy, p.x, p.y));
      if (input.joy.active && input.joy.id === id) {
        const R = 78; let dx = p.x - input.joy.ox, dy = p.y - input.joy.oy;
        const m = Math.hypot(dx, dy);
        if (m > R) { dx = (dx / m) * R; dy = (dy / m) * R; }
        input.joy.x = input.joy.ox + dx; input.joy.y = input.joy.oy + dy;
        input.joy.dx = dx / R; input.joy.dy = dy / R; input.joy.mag = Math.min(1, m / R);
      }
      const s = G.scene; if (s && s.onPointerMove) s.onPointerMove(p.x, p.y);
    };
    const onUp = (id, cx, cy) => {
      const p = toLogical(cx, cy);
      const st = pointerStarts[id];
      const s = G.scene;
      if (s && s.onPointerUp) s.onPointerUp(p.x, p.y);
      if (st && st.moved < 14 && performance.now() - st.t0 < 400) { if (s && s.onTap) s.onTap(p.x, p.y); }
      if (input.joy.id === id) { input.joy.active = false; input.joy.id = null; input.joy.dx = input.joy.dy = input.joy.mag = 0; }
      delete pointerStarts[id];
      if (Object.keys(pointerStarts).length === 0) input.pointer.down = false;
    };

    if (window.PointerEvent) {
      cv.addEventListener("pointerdown", (e) => { e.preventDefault(); onDown(e.pointerId, e.clientX, e.clientY); }, { passive: false });
      cv.addEventListener("pointermove", (e) => { onMove(e.pointerId, e.clientX, e.clientY); }, { passive: false });
      window.addEventListener("pointerup", (e) => onUp(e.pointerId, e.clientX, e.clientY));
      window.addEventListener("pointercancel", (e) => onUp(e.pointerId, e.clientX, e.clientY));
    } else {
      cv.addEventListener("touchstart", (e) => { e.preventDefault(); for (const t of e.changedTouches) onDown(t.identifier, t.clientX, t.clientY); }, { passive: false });
      cv.addEventListener("touchmove", (e) => { e.preventDefault(); for (const t of e.changedTouches) onMove(t.identifier, t.clientX, t.clientY); }, { passive: false });
      window.addEventListener("touchend", (e) => { for (const t of e.changedTouches) onUp(t.identifier, t.clientX, t.clientY); });
      cv.addEventListener("mousedown", (e) => { e.preventDefault(); onDown("m", e.clientX, e.clientY); });
      window.addEventListener("mousemove", (e) => onMove("m", e.clientX, e.clientY));
      window.addEventListener("mouseup", (e) => onUp("m", e.clientX, e.clientY));
    }
  };

  // Рисуем динамический джойстик (если активен) — в экранных координатах
  G.drawJoystick = function (ctx) {
    if (!input.joy.active) return;
    const j = input.joy;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath(); ctx.arc(j.ox, j.oy, 78, 0, PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath(); ctx.arc(j.x, j.y, 34, 0, PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---- Звук (синтез WebAudio, как в Mars) ---- */
  G.audio = {
    ctx: null,
    resume() {
      if (!G.state.sound) return;
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === "suspended") this.ctx.resume();
      } catch (e) {}
    },
    tone(freq, dur, type = "square", vol = 0.06) {
      if (!G.state.sound || !this.ctx) return;
      const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur);
    },
    blip() { this.tone(660, 0.07, "square", 0.05); },
    dig() { this.tone(150 + Math.random() * 70, 0.05, "square", 0.045); },
    pop() { this.tone(420, 0.07, "triangle", 0.06); this.tone(700, 0.1, "triangle", 0.05); },
    pickup() { this.tone(640, 0.07, "triangle", 0.06); setTimeout(() => this.tone(960, 0.1, "triangle", 0.05), 55); },
    hit() { this.tone(130, 0.16, "sawtooth", 0.08); },
    death() { this.tone(240, 0.08, "sawtooth", 0.06); setTimeout(() => this.tone(120, 0.18, "sawtooth", 0.06), 55); setTimeout(() => this.tone(70, 0.22, "triangle", 0.05), 120); }, // 💀 нисходящий
    crit() { this.tone(900, 0.05, "square", 0.06); setTimeout(() => this.tone(1350, 0.1, "square", 0.05), 28); },                 // 💥 резкий звон
    fire() { this.tone(170 + Math.random() * 70, 0.06, "sawtooth", 0.05); this.tone(90, 0.1, "square", 0.03); },                  // 🔥 треск
    frost() { this.tone(950, 0.08, "sine", 0.04); setTimeout(() => this.tone(1400, 0.12, "sine", 0.035), 40); },                  // ❄ звон льда
    levelup() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, "triangle", 0.06), i * 70)); },       // 🆙 фанфара
  };

  /* ---- Процедурная фоновая музыка: лёгкий арп по настроению ---- */
  const MUSIC_MOODS = {
    calm:    { bpm: 68,  root: 196.0, scale: [0, 3, 5, 7, 10], arp: [0, 2, 4, 2, 3, 1, 2, 0], type: "sine",     vol: 0.05 },
    mystery: { bpm: 54,  root: 146.8, scale: [0, 2, 3, 7, 8],  arp: [0, 3, 4, 2, 4, 1, 3, 2], type: "triangle", vol: 0.045 },
    tense:   { bpm: 118, root: 110.0, scale: [0, 2, 3, 5, 7],  arp: [0, 4, 2, 5, 3, 1, 4, 2], type: "square",   vol: 0.045 },
  };
  G.music = {
    mood: "calm", _i: 0, _next: 0,
    setMood(m) { if (MUSIC_MOODS[m]) this.mood = m; },
    setScene() {},
    tick() {
      const a = G.audio; if (!G.state.sound || !a.ctx) return;
      const M = MUSIC_MOODS[this.mood] || MUSIC_MOODS.calm, beat = 30 / M.bpm; // длина полудоли
      const now = a.ctx.currentTime;
      if (!this._next) this._next = now;
      if (now >= this._next) {
        const deg = M.scale[M.arp[this._i % M.arp.length] % M.scale.length];
        const oct = (this._i % 8 < 4) ? 1 : 2;
        a.tone(M.root * Math.pow(2, deg / 12) * oct, beat * 1.7, M.type, M.vol);
        if (this._i % 4 === 0) a.tone(M.root / 2, beat * 1.9, "triangle", M.vol * 0.85); // бас
        this._i++; this._next = now + beat;
      }
    },
  };

  /* ---- Сцены + переходы (fade) ---- */
  G.scenes = {}; G.scene = null;
  G.addScene = function (name, sc) { sc.name = name; G.scenes[name] = sc; };
  const fade = { a: 0, dir: 0, next: null };
  function swap(name) { const sc = G.scenes[name]; if (!sc) return; G.scene = sc; if (sc.enter) sc.enter(); }
  G.go = function (name, instant) {
    if (!G.scenes[name]) return;
    if (instant) { fade.a = 0; fade.dir = 0; swap(name); return; }
    fade.dir = 1; fade.next = name;
  };
  function updateFade(dt) {
    if (fade.dir === 1) { fade.a += dt * 3.4; if (fade.a >= 1) { fade.a = 1; swap(fade.next); fade.dir = -1; } }
    else if (fade.dir === -1) { fade.a -= dt * 3.4; if (fade.a <= 0) { fade.a = 0; fade.dir = 0; } }
  }

  /* ---- Сейв (каркас; мердж в дефолт — старые сейвы не ломаются, как в Mars) ---- */
  const SAVE_KEY = "cubeworld_save_v1";
  G.saveGame = function () {
    try {
      const data = { state: G.state, dayCycle: G.dayCycle, edits: (G.World ? G.World.serialize() : null) };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {}
  };
  G.hasSave = function () { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } };
  G.loadGame = function () {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); if (!d) return false;
      G.state = Object.assign(G.defaultState(), d.state || {});
      G.dayCycle = d.dayCycle != null ? d.dayCycle : 0.30;
      G._pendingEdits = d.edits || null;
      return true;
    } catch (e) { return false; }
  };
  G.clearSave = function () { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} };

  /* ---- Главный цикл (ловит сбойный кадр, как в Mars) ---- */
  let last = 0;
  function frameBody(ts) {
    const dtReal = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    let dt = dtReal;
    if (G.hitStopT > 0) { G.hitStopT = Math.max(0, G.hitStopT - dtReal); dt = 0; }
    G.time += dt;
    if (G.scene && G.scene.isWorld && fade.dir !== 1) G.dayCycle = (G.dayCycle + dt / DAY_PERIOD) % 1;
    G.uiBlock = [];
    if (G.scene && G.scene.update && fade.dir !== 1) G.scene.update(dt);
    G.fx.update(dt);
    updateFade(dtReal);
    if (G.music) G.music.tick();
    G.actionPressed = false;

    const ctx = G.ctx;
    ctx.fillStyle = "#0b0f14"; ctx.fillRect(0, 0, G.VIEW.w, G.VIEW.h);
    let shook = false;
    if (G.shakeAmt > 0.4) {
      ctx.save();
      ctx.translate((Math.random() - 0.5) * G.shakeAmt, (Math.random() - 0.5) * G.shakeAmt);
      G.shakeAmt *= Math.pow(0.0025, dtReal); shook = true;
    } else G.shakeAmt = 0;
    try { if (G.scene && G.scene.draw) G.scene.draw(ctx); }
    finally { if (shook) ctx.restore(); }

    if (fade.a > 0) { ctx.fillStyle = `rgba(0,0,0,${fade.a})`; ctx.fillRect(0, 0, G.VIEW.w, G.VIEW.h); }
  }
  function frame(ts) {
    try { frameBody(ts); }
    catch (e) {
      try { if (window.console && console.error) console.error("[frame]", e); } catch (_) {}
      G.shakeAmt = 0; G.hitStopT = 0;
    }
    requestAnimationFrame(frame);
  }
  G.startLoop = function () { requestAnimationFrame(frame); };
})();
