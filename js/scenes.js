/* ============================================================
   КУБОМИР — сцены: menu + world (игрок, камера, добыча, HUD).
   Тех-каркас: мир + камера + добыча. Крафт/инвентарь/выживание — позже.
   ============================================================ */
(function () {
  "use strict";
  const G = window.G;
  const { clamp, lerp, dist, rr, rectHit } = { clamp: G.clamp, lerp: G.lerp, dist: G.dist, rr: G.rr, rectHit: G.rectHit };
  const PI = Math.PI;
  const TILE = G.TILE;
  const PAL = G.PAL;
  const VIEW = G.VIEW;
  const World = G.World;
  const QUESTS = [
    { icon: "🌳", text: "Сруби дерево", done: () => G.state.quests.chop },
    { icon: "⛏", text: "Сделай кирку (🛠)", done: () => G.toolPower() > 1 },
    { icon: "🧱", text: "Поставь блок (тапни клетку)", done: () => G.state.quests.build },
    { icon: "🍖", text: "Поешь, когда проголодаешься", done: () => G.state.quests.eat },
    { icon: "⚔", text: "Победи монстра ночью", done: () => G.state.quests.fight },
    { icon: "🛏", text: "Поставь кровать и поспи до утра", done: () => G.state.quests.sleep },
    { icon: "🪜", text: "Спустись в пещеру (▼)", done: () => G.state.quests.cave },
    { icon: "💎", text: "Добудь алмаз в глубине", done: () => G.invCount("diamond") > 0 },
    { icon: "🚪", text: "Построй дом с дверью", done: () => G.state.quests.door },
    { icon: "🏘", text: "Поторгуй с жителем деревни", done: () => G.state.quests.trade },
    { icon: "🗨", text: "Выполни задание жителя", done: () => G.state.questsDone > 0 },
    { icon: "🌾", text: "Вырасти и собери пшеницу", done: () => G.state.quests.harvest },
    { icon: "🐣", text: "Покорми зверей — разведи малыша", done: () => G.state.quests.breed },
    { icon: "🎣", text: "Поймай рыбу удочкой", done: () => G.state.quests.fish },
    { icon: "⛵", text: "Прокатись на лодке по воде", done: () => G.state.quests.boat },
    { icon: "🧪", text: "Свари и выпей зелье", done: () => G.state.quests.potion },
    { icon: "🔴", text: "Зажги лампу рычагом", done: () => G.state.quests.redstone },
    { icon: "🚂", text: "Построй рельсы и прокатись", done: () => G.state.quests.rail },
    { icon: "✨", text: "Сотвори заклинание из тома", done: () => G.state.quests.spell },
    { icon: "👻", text: "Открой Портал в Мир Призраков", done: () => G.state.quests.astral },
    { icon: "👑", text: "Победи Призрачного Короля", done: () => G.state.bossDefeated },
  ];
  const CATS = [
    { k: "base", ic: "🪵", name: "Основа" }, { k: "tools", ic: "⛏", name: "Инстр." },
    { k: "build", ic: "🧱", name: "Стройка" }, { k: "color", ic: "🎨", name: "Цвета" }, { k: "food", ic: "🍖", name: "Еда" },
    { k: "potion", ic: "🧪", name: "Зелья" },
  ];
  const PERKS = [            // 🆙 перки выбора при уровне (Fallout/FF + ❤ Zelda)
    { k: "heart",   ic: "❤", name: "Сердце",    desc: "+4 к макс. ❤ жизни", repeat: true },
    { k: "warrior", ic: "🗡", name: "Воин",      desc: "+1 урон в бою" },
    { k: "miner",   ic: "⛏", name: "Шахтёр",    desc: "копать на 30% быстрее" },
    { k: "swift",   ic: "🏃", name: "Быстрый",   desc: "+15% к скорости" },
    { k: "mage",    ic: "✨", name: "Маг",        desc: "+5 ✨ маны, реген быстрее" },
    { k: "tough",   ic: "🛡", name: "Крепкий",   desc: "−15% получаемого урона" },
    { k: "lucky",   ic: "🍀", name: "Удачливый", desc: "+50% опыта" },
  ];
  const ACHIEVEMENTS = [     // 🏆 ачивки: тост + монеты при выполнении (проверяются раз)
    { id: "wood",    ic: "🪵", name: "Дровосек",          coins: 5,  check: () => G.state.quests.chop },
    { id: "pick",    ic: "⛏",  name: "Первая кирка",       coins: 5,  check: () => G.toolPower() > 1 },
    { id: "cave",    ic: "🪜", name: "В глубины",          coins: 8,  check: () => G.state.quests.cave },
    { id: "home",    ic: "🛏", name: "Свой дом",           coins: 10, check: () => G.state.homeX != null },
    { id: "diamond", ic: "💎", name: "Первый алмаз",       coins: 20, check: () => G.invCount("diamond") > 0 },
    { id: "spell",   ic: "✨", name: "Магия!",             coins: 12, check: () => G.state.quests.spell },
    { id: "obsidian",ic: "⬛", name: "Покоритель вулкана",  coins: 22, check: () => G.invCount("obsidian") > 0 },
    { id: "temple",  ic: "⚔",  name: "Храм очищен",         coins: 25, check: () => G.state.templeCleared },
    { id: "magma",   ic: "🌋", name: "Магма-страж повержен", coins: 35, check: () => G.state.magmaSlain },
    { id: "king",    ic: "👑", name: "Король повержен",      coins: 40, check: () => G.state.bossDefeated },
    { id: "abyss",   ic: "👁", name: "Бездна запечатана",   coins: 60, check: () => G.state.abyssDefeated },
    { id: "rich",    ic: "🪙", name: "Богач — 100 монет",   coins: 0,  check: () => (G.state.coins || 0) >= 100 },
  ];
  const NPC_QUESTS = [       // 🗨 задания жителей (Fallout: принеси/победи → награда)
    { id: "wood", text: "Принеси 8 дерева 🪵", item: "wood", n: 8, xp: 18, give: ["ingot", 2] },
    { id: "meat", text: "Принеси 4 мяса 🍖", item: "meat", n: 4, xp: 18, give: ["gold", 1] },
    { id: "iron", text: "Принеси 3 железа ⛏", item: "iron", n: 3, xp: 25, give: ["diamond", 1] },
    { id: "fish", text: "Принеси 3 рыбы 🐟", item: "fish", n: 3, xp: 15, give: ["coal", 3] },
    { id: "kill", text: "Победи 5 монстров ⚔", kill: 5, xp: 25, give: ["ingot", 3] },
  ];
  const npcQuest = (id) => NPC_QUESTS.find((q) => q.id === id) || NPC_QUESTS[0];
  const TRADES = [           // 🏘 обмен с жителем (отдать → получить)
    { give: ["wheat", 4], get: ["ingot", 1] },
    { give: ["wood", 8], get: ["plank", 12] },
    { give: ["fish", 3], get: ["meat", 2] },
    { give: ["gold", 3], get: ["diamond", 1] },
    { give: ["coal", 6], get: ["torch", 8] },
    { give: ["wool", 4], get: ["bed", 1] },
  ];
  const SHOP = [             // 🪙 магазин жителя: купить за монеты (идея Льва)
    { item: "cooked_meat", n: 3, price: 6 },
    { item: "torch", n: 8, price: 5 },
    { item: "bread", n: 2, price: 8 },
    { item: "ingot", n: 2, price: 14 },
    { item: "potion_heal", n: 1, price: 18 },
    { item: "ember", n: 2, price: 22 },
    { item: "diamond", n: 1, price: 40 },
    { item: "tome_heal", n: 1, price: 32 },
  ];
  const STORY = [   // icon — крупный символ цели для не-читающего игрока (6 лет)
    { icon: "🌳", t: "Глава 1. Остров в беде — из глубин лезут тени. Сруби дерево 🌳", done: () => G.state.quests.chop },
    { icon: "⛏", t: "Глава 2. Сделай кирку ⛏ и спустись в пещеру 🪜", done: () => G.state.quests.cave },
    { icon: "🔮", t: "Глава 3. Найди в глубине осколки духов 🔮 (нужно 4)", done: () => G.invCount("ghost_shard") >= 4 || G.invCount("portal") > 0 || G.state.quests.astral },
    { icon: "🌀", t: "Глава 4. Собери и поставь Портал 🌀", done: () => G.state.quests.portal },
    { icon: "👑", t: "Глава 5. Победи Призрачного Короля 👑 в Мире Призраков!", done: () => G.state.bossDefeated },
    { icon: "✨", t: "Глава 6. Тьма не ушла… Овладей магией — сотвори заклинание ✨", done: () => G.state.quests.spell },
    { icon: "⚔", t: "Глава 7. Древний Страж проснулся — очисти Храм ⚔", done: () => G.state.templeCleared },
    { icon: "🕳", t: "Глава 8. Спустись в глубочайшую пещеру — там Бездна 🕳", done: () => G.state.quests.abyss },
    { icon: "👁", t: "Глава 9. Победи Повелителя Бездны 👁 и запечатай зло!", done: () => G.state.abyssDefeated },
  ];

  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2); ctx.fill(); }

  /* ========================= МЕНЮ ========================= */
  const freeRect = { x: VIEW.w / 2 - 184, y: 352, w: 176, h: 64 };
  const storyRect = { x: VIEW.w / 2 + 8, y: 352, w: 176, h: 64 };
  const contRect = { x: VIEW.w / 2 - 150, y: 426, w: 300, h: 52 };
  const soundRect = { x: VIEW.w / 2 - 150, y: 488, w: 300, h: 46 };
  const diffRect = { x: VIEW.w / 2 - 150, y: 544, w: 300, h: 46 };
  const creativeRect = { x: VIEW.w / 2 - 150, y: 628, w: 300, h: 40 };
  let menuCreative = false;

  function startNew(story) {
    G.resetState();
    G.clearSave();
    G._pendingEdits = null;
    G.state.seed = (Math.random() * 1e9) | 0;
    G.state.story = !!story; G.state.creative = menuCreative;
    const sp = World.gen(G.state.seed);
    G.state.px = sp.x; G.state.py = sp.y; G.state.face = 1;
    G.state.homeX = sp.x; G.state.homeY = sp.y;
    G.go("world");
  }
  function continueGame() {
    if (!G.loadGame()) { startNew(); return; }
    const d = G.state.depth || 0;          // gen→use(0) сбросит depth, поэтому запоминаем
    World.gen(G.state.seed);
    if (d > 0) World.use(d);               // вернуть игрока на сохранённый слой
    G.go("world");
  }

  function drawButton(ctx, r, label, color, sub) {
    ctx.fillStyle = "rgba(0,0,0,0.18)"; rr(ctx, r.x + 3, r.y + 4, r.w, r.h, 14); ctx.fill();
    ctx.fillStyle = color; rr(ctx, r.x, r.y, r.w, r.h, 14); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.22)"; rr(ctx, r.x, r.y, r.w, r.h * 0.45, 14); ctx.fill();
    ctx.fillStyle = PAL.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    let fs = sub ? 26 : 30; ctx.font = G.f(fs, "bold");
    const maxW = r.w - 22;
    while (ctx.measureText(label).width > maxW && fs > 12) { fs -= 1; ctx.font = G.f(fs, "bold"); } // ужать текст под ширину кнопки
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
  }

  G.addScene("menu", {
    enter() { G.cam.x = 0; G.cam.y = 0; },
    update() {},
    onTap(x, y) {
      if (rectHit(freeRect, x, y)) { G.audio.blip(); startNew(false); return; }
      if (rectHit(storyRect, x, y)) { G.audio.blip(); startNew(true); return; }
      if (G.hasSave() && rectHit(contRect, x, y)) { G.audio.blip(); continueGame(); return; }
      if (rectHit(soundRect, x, y)) { G.state.sound = !G.state.sound; if (G.state.sound) G.audio.resume(); G.audio.blip(); return; }
      if (rectHit(diffRect, x, y)) { G.cycleDifficulty(); G.audio.blip(); return; }
      if (rectHit(creativeRect, x, y)) { menuCreative = !menuCreative; G.audio.blip(); }
    },
    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, VIEW.h);
      g.addColorStop(0, "#8fd3f4"); g.addColorStop(0.54, "#cdeeff");
      g.addColorStop(0.541, PAL.grass1); g.addColorStop(1, PAL.grass2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      // солнце + облака
      ctx.fillStyle = "#ffe487"; circle(ctx, 165, 130, 56);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      circle(ctx, 760, 120, 34); circle(ctx, 800, 132, 40); circle(ctx, 840, 118, 30);
      circle(ctx, 300, 200, 26); circle(ctx, 332, 210, 30);
      // маскот-Стив
      ctx.save(); ctx.translate(VIEW.w / 2, 300); ctx.scale(2.0, 2.0); G.drawSteve(ctx, 0, 0, 1, 0, 0); ctx.restore();
      // заголовок
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.font = G.f(86, "900"); ctx.fillText("КУБОМИР", VIEW.w / 2 + 4, 168);
      ctx.fillStyle = "#fff"; ctx.fillText("КУБОМИР", VIEW.w / 2, 164);
      ctx.fillStyle = PAL.ink; ctx.font = G.f(22, "bold");
      ctx.fillText("2D-Майнкрафт · вид сверху · designed for Lev", VIEW.w / 2, 200);
      // кнопки
      drawButton(ctx, freeRect, "🌳 Свободный", PAL.btn, true);
      drawButton(ctx, storyRect, "📖 История", "#c9a0ff", true);
      if (G.hasSave()) drawButton(ctx, contRect, "Продолжить", "#8fd0ff", true);
      drawButton(ctx, soundRect, G.state.sound ? "🔊 Звук: вкл" : "🔇 Звук: выкл", "#e8e8ee", true);
      const df = G.diff();
      drawButton(ctx, diffRect, "Сложность: " + df.icon + " " + df.name, "#e8e8ee", true);
      ctx.fillStyle = "rgba(20,30,20,0.72)"; ctx.font = G.f(15); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(df.hint, VIEW.w / 2, diffRect.y + diffRect.h + 17);
      drawButton(ctx, creativeRect, menuCreative ? "🎨 Творческий: ВКЛ" : "🎨 Творческий: выкл", menuCreative ? "#c9a0ff" : "#e8e8ee", true);
    },
  });

  /* ========================= МИР ========================= */
  const actRect = { x: VIEW.w - 178, y: VIEW.h - 178, w: 148, h: 148 };
  const dashRect = { x: VIEW.w - 272, y: VIEW.h - 148, w: 82, h: 82 };   // 🤸 кнопка переката
  const menuRect = { x: 18, y: 18, w: 54, h: 54 };
  const craftBtn = { x: 82, y: 18, w: 54, h: 54 };
  const invBtn = { x: 146, y: 18, w: 54, h: 54 };
  const BASE_BREAK = 0.34; // сек на единицу твёрдости при toolPower=1

  function dropColor(b) {
    return b.drop === "wood" ? PAL.leaf : b.drop === "coal" ? "#4a4a52" : b.drop === "iron" ? PAL.ironHi : PAL.stone;
  }

  const world = {
    isWorld: true,
    useJoystick: true,
    r: 16, // радиус игрока (коллизия + контакт мобов)

    enter() {
      this.px = G.state.px; this.py = G.state.py;
      this.fx = (G.state.face < 0 ? -1 : 1); this.fy = 0;
      this.walk = 0; this.swingT = 0; this.mineT = 0;
      this.acting = false; this.actHeld = false;
      this.tapTX = -1; this.tapTY = -1; this.target = null;
      this._save = 0; this._t = 0; this._prevCycle = G.dayCycle; this._craftOpen = false; this._weak = false;
      this.mobs = []; this.shots = []; this._invuln = 0; this._dmgFlash = 0; this._deadMsg = 0; this._dead = false;
      this.crops = []; this.pshots = []; this.petX = null;
      if (G.state.depth === 0) for (let i = 0; i < World.obj.length; i++) { const b = World.BLOCKS[World.obj[i]]; if (b && b.crop != null) this.crops.push({ tx: i % World.W, ty: (i / World.W) | 0, t: b.crop * 8, st: b.crop }); }
      if (G.state.depth === 0 && World.layers[0] && World.layers[0].village) { const v = World.layers[0].village; for (let i = 0; i < 3; i++) this.mobs.push(G.makeMob(v.x * TILE + TILE / 2 + (i - 1) * TILE * 2, (v.y + 3) * TILE + TILE / 2, "villager")); } // 🏘 жители
      if (G.state.depth === 4 && G.state.bossDefeated) { G.state.quests.abyss = 1; if (!G.state.abyssDefeated) this.mobs.push(G.makeMob(this.px + TILE * 2, this.py, "abyss_lord")); } // 🕳 Глава 2: Повелитель Бездны в глубочайшей пещере
      this._invOpen = false; this._craftTab = 0; this._craftPage = 0; this._won = false;
      this._lastTransTile = Math.floor(this.px / TILE) + "," + Math.floor(this.py / TILE); // спавн/загрузочный тайл не должен сам сработать как лестница (фикс дрейфа глубины при автосейве на переходе)
      this._chestOpen = false; this._chestKey = null; this._fishT = 0; this._tradeOpen = false; this._tradeMob = null; this._shopTab = 0;
      this.weather = "clear"; this._wxT = 30 + Math.random() * 40; this._flash = 0; this._wxAnim = 0; this._onBoat = false;
      this._goalsDone = null; this._goalFlash = 0; this._floaters = []; this.spellShots = []; this._perkOpen = false; this._perksPending = 0;
      this._achQueue = []; this._achCur = null; this._achT = 0;   // 🏆 очередь тостов ачивок
      this._dashT = 0; this._dashCd = 0; this._dashDX = 1; this._dashDY = 0; this._dashTrail = []; this._combo = 0; this._comboT = 0;
      this.darkBase = G.state.depth > 0 ? Math.min(0.92, 0.5 + G.state.depth * 0.12) : null;
      while (G.state.inv.length < G.INV_SIZE) G.state.inv.push(null); // докинуть слоты старым сейвам
      this._hungerT = 0; this._starveT = 0; this._regenT = 0; this._spawnT = 0; this.mobTarget = null;
      G.cam.x = clamp(this.px - VIEW.w / 2, 0, Math.max(0, World.W * TILE - VIEW.w));
      G.cam.y = clamp(this.py - VIEW.h / 2, 0, Math.max(0, World.H * TILE - VIEW.h));
    },

    sync() { G.state.px = this.px; G.state.py = this.py; G.state.face = this.fx < 0 ? -1 : 1; },

    onPointerDown(x, y) { if (rectHit(actRect, x, y)) this.actHeld = true; },
    onPointerUp() { this.actHeld = false; },
    onTap(x, y) {
      if (this._perkOpen) { this.perkTap(x, y); return; }
      if (this._tradeOpen) { this.tradeTap(x, y); return; }
      if (this._chestOpen) { this.chestTap(x, y); return; }
      if (this._invOpen) { this.invTap(x, y); return; }
      if (this._craftOpen) { this.craftTap(x, y); return; }
      if (rectHit(craftBtn, x, y)) { this._craftOpen = true; this._invOpen = false; G.audio.blip(); return; }
      if (rectHit(invBtn, x, y)) { this._invOpen = true; this._craftOpen = false; G.audio.blip(); return; }
      if (rectHit(dashRect, x, y)) { this.tryDash(); return; }
      if (rectHit(actRect, x, y)) { const t = this.nearestMinable(); if (t) { this.tapTX = t.tx; this.tapTY = t.ty; } return; }
      if (rectHit(menuRect, x, y)) { this.sync(); G.saveGame(); G.go("menu"); return; }
      for (let i = 0; i < G.HOTBAR; i++) if (rectHit(this.slotRect(i), x, y)) {
        const slot = G.state.inv[i], it = slot && G.ITEMS[slot.item];
        if (G.state.sel === i && it && it.food) this.eat();   // тап по выбранной еде — съесть
        else if (G.state.sel === i && it && it.potion) this.drinkPotion(); // тап по выбранному зелью — выпить
        else { G.state.sel = i; G.audio.blip(); }
        return;
      }
      const w = G.screenToWorld(x, y);
      for (const mu of this.mobs) if (mu.K.trader && dist(w.x, w.y, mu.x, mu.y) < mu.K.r + 12 && dist(this.px, this.py, mu.x, mu.y) < TILE * 3) { this._tradeOpen = true; this._tradeMob = mu; if (!G.state.questId) this._offerQuest = NPC_QUESTS[(Math.random() * NPC_QUESTS.length) | 0].id; G.audio.blip(); return; } // 🏘 тап по жителю → задание + торговля
      const _fitem = (G.invSel() || {}).item;                          // 🐣 кормёжка → режим любви
      if (_fitem === "wheat" || _fitem === "seeds") for (const mu of this.mobs) {
        if (!mu.K.passive || mu.K.trader || mu._breedCd > 0 || mu.babyT > 0) continue;
        const okFood = mu.kind === "chicken" ? _fitem === "seeds" : _fitem === "wheat";
        if (okFood && dist(w.x, w.y, mu.x, mu.y) < mu.K.r + 12 && dist(this.px, this.py, mu.x, mu.y) < TILE * 3) { mu._love = 8; G.invConsume(1); G.audio.pickup(); G.fx.burst(mu.x, mu.y - 12, "#ff7aa8", 8, 90, 0.5); return; }
      }
      const tx = Math.floor(w.x / TILE), ty = Math.floor(w.y / TILE);
      if (!this.inRange(tx, ty)) return;
      const oi = World.oTile(tx, ty), b = World.BLOCKS[oi];
      if (b && b.store) { this.openChest(tx, ty); return; }                  // открыть сундук
      if (b && b.id === "furnace") { this._craftOpen = true; this._invOpen = false; this._craftTab = 0; this._craftPage = 0; G.audio.blip(); this.addFloater(tx * TILE + TILE / 2, ty * TILE + TILE / 2 - 16, "🔥 плавильня", "#ffce4a"); return; } // 🔥 печь = станция плавки → крафт (руда→слиток, песок→стекло…)
      if (b && b.sleep) {                                                    // 🛏 тап по кровати: ночью — спать до утра; всегда — точка возрождения
        G.state.homeX = this.px; G.state.homeY = this.py; G.state.quests.sleep = 1;
        if (G.daylight() < 0.5) this.sleep();
        else { G.audio.tone(392, 0.14, "sine", 0.05); G.fx.burst(this.px, this.py - 10, "#cdeaff", 10, 80, 0.5); this.addFloater(this.px, this.py - 22, "🛏 точка возрождения", "#cdeaff"); }
        return;
      }
      if (b && b.door) { World.edit(tx, ty, b.open ? World.OBJ.door : World.OBJ.door_open); G.audio.pop(); return; } // 🚪 открыть/закрыть дверь
      if (b && b.lever) { const on = !b.on; World.edit(tx, ty, on ? World.OBJ.lever_on : World.OBJ.lever); const _lit = this.powerArea(tx, ty, on); if (on && _lit > 0) G.state.quests.redstone = 1; G.audio.pop(); G.shake(2); return; } // 🔴 рычаг
      if (b && b.lock && !b.open) {  // ⚔ запертая дверь Храма — нужен ключ
        if (G.invCount("key") > 0) { World.edit(tx, ty, World.OBJ.lockdoor_open); G.invRemove("key", 1); G.audio.pop(); G.shake(3); this.addFloater(tx * TILE + TILE / 2, ty * TILE + TILE / 2 - 14, "🗝 🔓", "#ffce4a"); }
        else { this.addFloater(tx * TILE + TILE / 2, ty * TILE + TILE / 2 - 14, "нужен 🗝", "#ff8a8a"); G.audio.blip(); }
        return;
      }
      const _bsel = G.invSel(), _bsi = _bsel && _bsel.item;
      if (_bsi === "bucket" && World.gTile(tx, ty) === World.GROUND.water) { // 🪣 набрать воду
        G.invConsume(1); G.invAdd("water_bucket", 1); G.audio.pop(); G.fx.burst(tx * TILE + TILE / 2, ty * TILE + TILE / 2 - 6, "#5ac8ff", 8, 90, 0.4); return;
      }
      if (_bsi === "water_bucket" && oi === 0 && World.gTile(tx, ty) !== World.GROUND.water && !(tx === Math.floor(this.px / TILE) && ty === Math.floor(this.py / TILE))) { // вылить воду → пруд
        World.editGround(tx, ty, World.GROUND.water); G.invConsume(1); G.invAdd("bucket", 1); G.audio.pop(); G.fx.burst(tx * TILE + TILE / 2, ty * TILE + TILE / 2 - 6, "#5ac8ff", 10, 100, 0.45); return;
      }
      if (b && b.hardness > 0) { this.tapTX = tx; this.tapTY = ty; return; } // копать
      if (oi === 0) this.tryPlace(tx, ty);                                   // строить
    },
    slotRect(i) {
      const n = G.HOTBAR, sw = 70, gap = 8, total = n * sw + (n - 1) * gap, x0 = (VIEW.w - total) / 2;
      return { x: x0 + i * (sw + gap), y: VIEW.h - 86, w: sw, h: sw };
    },
    tryPlace(tx, ty) {
      const sel = G.invSel(); if (!sel) return;
      const it = G.ITEMS[sel.item]; if (!it) return;
      if (sel.item === "seeds") {   // посадить пшеницу на траве
        if (World.gTile(tx, ty) === World.GROUND.grass && World.oTile(tx, ty) === 0) {
          World.edit(tx, ty, World.OBJ.crop0); this.crops.push({ tx: tx, ty: ty, t: 0, st: 0 });
          if (!G.state.creative) G.invConsume(1); G.audio.pop(); G.fx.burst(tx * TILE + TILE / 2, ty * TILE + TILE / 2 - 6, "#9fd35a", 6, 80, 0.35);
        }
        return;
      }
      if (!it.place) return;
      if (World.gTile(tx, ty) === World.GROUND.water) return;
      if (tx === Math.floor(this.px / TILE) && ty === Math.floor(this.py / TILE)) return;
      World.edit(tx, ty, World.OBJ[it.place]);
      if (!G.state.creative) G.invConsume(1); G.audio.pop(); G.state.quests.build = 1;
      if (it.place === "portal") G.state.quests.portal = 1;
      if (it.place === "door") G.state.quests.door = 1;
      G.fx.burst(tx * TILE + TILE / 2, ty * TILE + TILE / 2 - 8, PAL.leafHi, 6, 90, 0.35);
    },

    // --- крафт: оверлей со списком рецептов (тап по карточке = сделать) ---
    craftList() { const k = CATS[this._craftTab || 0].k; return G.RECIPES.filter((r) => (r.cat || "base") === k); },
    craftPanel() {
      const cols = 5, ch = 156, n = this.craftList().length, paged = n > cols * 3;   // макс 3 ряда → всегда влезает в экран; больше — страницами
      const rows = paged ? 3 : Math.max(1, Math.ceil(n / cols));
      const w = 900, h = 100 + rows * ch + (rows - 1) * 14 + 20 + (paged ? 46 : 0);
      return { x: (VIEW.w - w) / 2, y: (VIEW.h - h) / 2, w: w, h: h };
    },
    craftCloseRect() { const p = this.craftPanel(); return { x: p.x + p.w - 52, y: p.y + 12, w: 40, h: 40 }; },
    craftTabRect(i) {
      const p = this.craftPanel(), tw = 124, gap = 8, total = CATS.length * tw + (CATS.length - 1) * gap;
      const x0 = p.x + (p.w - total) / 2;
      return { x: x0 + i * (tw + gap), y: p.y + 50, w: tw, h: 36 };
    },
    craftCardRect(i) {        // i — индекс В ПРЕДЕЛАХ СТРАНИЦЫ (0..14)
      const p = this.craftPanel(), cw = 160, gap = 14, cols = 5, ch = 156;
      const x0 = p.x + (p.w - (cols * cw + (cols - 1) * gap)) / 2, y0 = p.y + 98;
      const col = i % cols, row = (i / cols) | 0;
      return { x: x0 + col * (cw + gap), y: y0 + row * (ch + 14), w: cw, h: ch };
    },
    craftPages() { return Math.max(1, Math.ceil(this.craftList().length / 15)); },
    craftPageList() { const pg = this._craftPage || 0; return this.craftList().slice(pg * 15, pg * 15 + 15); },
    craftPrevRect() { const p = this.craftPanel(); return { x: p.x + p.w / 2 - 156, y: p.y + p.h - 42, w: 64, h: 32 }; },
    craftNextRect() { const p = this.craftPanel(); return { x: p.x + p.w / 2 + 92, y: p.y + p.h - 42, w: 64, h: 32 }; },
    nearFurnace() {
      const ptx = Math.floor(this.px / TILE), pty = Math.floor(this.py / TILE), F = World.OBJ.furnace;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (World.oTile(ptx + dx, pty + dy) === F) return true;
      return false;
    },
    craftTap(x, y) {
      if (rectHit(this.craftCloseRect(), x, y)) { this._craftOpen = false; G.audio.blip(); return; }
      for (let i = 0; i < CATS.length; i++) if (rectHit(this.craftTabRect(i), x, y)) { this._craftTab = i; this._craftPage = 0; G.audio.blip(); return; }
      if (this.craftPages() > 1) {
        if (rectHit(this.craftPrevRect(), x, y)) { this._craftPage = Math.max(0, (this._craftPage || 0) - 1); G.audio.blip(); return; }
        if (rectHit(this.craftNextRect(), x, y)) { this._craftPage = Math.min(this.craftPages() - 1, (this._craftPage || 0) + 1); G.audio.blip(); return; }
      }
      const list = this.craftPageList();
      for (let i = 0; i < list.length; i++) if (rectHit(this.craftCardRect(i), x, y)) {
        const r = list[i], stationOk = !r.station || this.nearFurnace();
        if (stationOk && G.canCraft(r)) { G.craft(r); G.audio.pickup(); G.shake(2); } else G.audio.blip();
        return;
      }
      if (!rectHit(this.craftPanel(), x, y)) this._craftOpen = false; // тап мимо панели — закрыть
    },

    inRange(tx, ty) { return dist(this.px, this.py, tx * TILE + TILE / 2, ty * TILE + TILE / 2) < TILE * 2.3; },

    blocked(wx, wy) {
      const r = 15;
      const pts = [[-r, 2], [r, 2], [0, -r * 0.4], [0, r], [-r * 0.7, r * 0.7], [r * 0.7, r * 0.7]];
      for (const [ox, oy] of pts) if (World.solidPx(wx + ox, wy + oy, true)) return true; // swim=true: вода проходима игроку
      return false;
    },

    nearestMinable() {
      const ptx = Math.floor(this.px / TILE), pty = Math.floor(this.py / TILE);
      let best = null, bs = 1e9;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const tx = ptx + dx, ty = pty + dy;
        const b = World.BLOCKS[World.oTile(tx, ty)];
        if (!b || b.hardness <= 0) continue;
        const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
        const dd = dist(this.px, this.py, cx, cy);
        if (dd > TILE * 2.2) continue;
        const dot = ((cx - this.px) * this.fx + (cy - this.py) * this.fy);
        const score = dd - dot * 0.18; // в сторону взгляда — приоритетнее
        if (score < bs) { bs = score; best = { tx, ty, b }; }
      }
      return best;
    },

    breakBlock(t) {
      const cx = t.tx * TILE + TILE / 2, cy = t.ty * TILE + TILE / 2;
      if (t.b.store) {                                          // сундук: вернуть ящик + высыпать содержимое в рюкзак
        const key = G.state.depth + "," + t.tx + "," + t.ty, box = G.state.chests[key];
        if (box) { for (const c of box) if (c) G.invAdd(c.item, c.n); delete G.state.chests[key]; }
        G.invAdd("chest", 1); World.edit(t.tx, t.ty, 0); G.audio.pop(); G.shake(4);
        G.fx.burst(cx, cy - 10, "#caa86a", 12, 140, 0.5); return;
      }
      World.edit(t.tx, t.ty, 0);
      if (t.b.special === "treasure") {
        const loot = ["gold", "gold", "diamond", "iron", "ingot"][(Math.random() * 5) | 0], ln = 1 + ((Math.random() * 3) | 0);
        G.invAdd(loot, ln); G.audio.pickup();
        this.addFloater(cx, cy - 14, "+" + (G.ITEMS[loot] ? G.ITEMS[loot].icon : "?") + (ln > 1 ? "×" + ln : ""), "#ffd24a");
        G.fx.burst(cx, cy - 10, "#ffd24a", 20, 180, 0.6);
      } else if (t.b.special === "dye") {
        const cs = Object.keys(G.DYE); G.invAdd("dye_" + cs[(Math.random() * cs.length) | 0], 1); G.audio.pickup();
        G.fx.burst(cx, cy - 8, "#ff9ec4", 8, 90, 0.4);
      } else if (t.b.crop != null) {                       // урожай
        G.invAdd("seeds", 1); if (t.b.crop === 3) { G.invAdd("wheat", 2); G.state.quests.harvest = 1; } G.audio.pickup();
        G.fx.burst(cx, cy - 8, "#9fd35a", 8, 90, 0.4);
      } else if (t.b.drop) { G.invAdd(t.b.drop, t.b.yield || 1); G.audio.pickup(); if (/coal|iron|gold|diamond|ghost_shard/.test(t.b.drop)) this.addFloater(cx, cy - 14, "+" + (G.ITEMS[t.b.drop] ? G.ITEMS[t.b.drop].icon : "?") + ((t.b.yield || 1) > 1 ? "×" + t.b.yield : ""), "#ffe08a"); }
      else G.audio.pop();
      if (t.b.id === "tree") { G.state.quests.chop = 1; if (Math.random() < 0.35) { G.invAdd("apple", 1); this.addFloater(cx, cy - 14, "+🍎", "#ff7a7a"); } } // 🍎 ~35% яблоко с дерева — простая еда
      G.fx.burst(cx, cy - 10, dropColor(t.b), 14, 160, 0.5);
      this.addXp(t.b.special === "treasure" ? 8 : /coal|iron|gold|diamond|ghost_shard/.test(t.b.drop || "") ? 4 : 1); // 🆙 опыт за добычу
      G.shake(4); G.hitStop(0.03);
    },

    nearestMob() {
      let best = null, bs = 1e9, R = TILE * 1.85;
      for (const mu of this.mobs) {
        const d = dist(this.px, this.py, mu.x, mu.y);
        if (d > R + mu.K.r) continue;
        const dot = (mu.x - this.px) * this.fx + (mu.y - this.py) * this.fy;
        const sc = d - dot * 0.2;
        if (sc < bs) { bs = sc; best = mu; }
      }
      return best;
    },
    addXp(n) {               // 🆙 опыт → уровень → выбор перка
      if (G.state.perks.lucky) n = Math.round(n * 1.5);
      G.state.xp += n;
      while (G.state.xp >= this.xpNeed(G.state.level)) { G.state.xp -= this.xpNeed(G.state.level); G.state.level++; this._perksPending++; }
      if (this._perksPending > 0 && !this._perkOpen) this.openPerks();
    },
    xpNeed(lv) { return 30 + lv * 20; },
    openPerks() { this._perkChoices = this.rollPerks(); this._perkOpen = true; this._craftOpen = this._invOpen = this._chestOpen = this._tradeOpen = false; G.audio.levelup(); G.shake(4); },
    rollPerks() {
      const pool = PERKS.filter(p => p.repeat || !G.state.perks[p.k]).slice(), out = [];
      while (out.length < 3 && pool.length) out.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
      return out;
    },
    applyPerk(k) {
      const p = G.state.perks;
      if (k === "heart") { G.state.maxHp += 4; G.state.hp = G.state.maxHp; p.heart = (p.heart || 0) + 1; }
      else if (k === "mage") { G.state.maxMp += 5; G.state.mp = G.state.maxMp; p.mage = true; }
      else p[k] = true;
    },
    perkPanel() { const w = 760, h = 296; return { x: (VIEW.w - w) / 2, y: (VIEW.h - h) / 2, w: w, h: h }; },
    perkCardRect(i) { const p = this.perkPanel(), cw = 224, gap = 18, x0 = p.x + (p.w - (3 * cw + 2 * gap)) / 2; return { x: x0 + i * (cw + gap), y: p.y + 88, w: cw, h: 172 }; },
    perkTap(x, y) {
      const ch = this._perkChoices || [];
      for (let i = 0; i < ch.length; i++) if (rectHit(this.perkCardRect(i), x, y)) {
        this.applyPerk(ch[i].k); G.audio.pickup(); G.shake(3); G.fx.burst(this.px, this.py - 10, "#ffce4a", 18, 150, 0.6);
        this._perksPending--;
        if (this._perksPending > 0) this._perkChoices = this.rollPerks(); else this._perkOpen = false;
        return;
      }
    },
    drawPerks(ctx) {
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      const p = this.perkPanel();
      ctx.fillStyle = "rgba(30,33,44,0.98)"; rr(ctx, p.x, p.y, p.w, p.h, 18); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = "#ffce4a"; rr(ctx, p.x, p.y, p.w, p.h, 18); ctx.stroke();
      ctx.fillStyle = "#ffce4a"; ctx.font = G.f(28, "900"); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🆙 Уровень " + G.state.level + "! Выбери силу", VIEW.w / 2, p.y + 42);
      const ch = this._perkChoices || [];
      for (let i = 0; i < ch.length; i++) {
        const c = ch[i], r = this.perkCardRect(i);
        ctx.fillStyle = "rgba(255,255,255,0.07)"; rr(ctx, r.x, r.y, r.w, r.h, 12); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,206,74,0.55)"; rr(ctx, r.x, r.y, r.w, r.h, 12); ctx.stroke();
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; ctx.font = G.f(48); ctx.fillText(c.ic, r.x + r.w / 2, r.y + 52);
        ctx.font = G.f(22, "900"); ctx.fillText(c.name + (c.k === "heart" && G.state.perks.heart ? " ×" + (G.state.perks.heart + 1) : ""), r.x + r.w / 2, r.y + 104);
        ctx.font = G.f(15); ctx.fillStyle = "rgba(255,255,255,0.78)"; ctx.fillText(c.desc, r.x + r.w / 2, r.y + 138);
      }
    },
    castSpell(tome) {        // ✨ каст: огонь/лёд (снаряд), молния (AoE), лечение
      if (G.state.mp < tome.mana) { G.audio.blip(); return; }
      G.state.mp -= tome.mana; G.state.quests.spell = 1; G.audio.tone(440, 0.09, "sine", 0.05);
      const sp = tome.spell;
      if (sp === "heal") { G.state.hp = Math.min(G.state.maxHp, G.state.hp + 6); G.fx.burst(this.px, this.py - 10, "#ff8ab0", 16, 120, 0.6); G.fx.ring(this.px, this.py, "#ff8ab0", 38, 0.5); return; }
      if (sp === "bolt") { G.fx.ring(this.px, this.py, "#bfe0ff", 124, 0.5); G.shake(6);
        for (const m of this.mobs) if (!m.K.passive && dist(this.px, this.py, m.x, m.y) < 124) { G.hitMob(this, m, 4); G.fx.burst(m.x, m.y - 6, "#cfe8ff", 8, 120, 0.4); }
        return;
      }
      let dx = this.fx, dy = this.fy, best = null, bd = 1e9;   // снаряд к ближайшему мобу или по взгляду
      for (const m of this.mobs) { if (m.K.passive) continue; const d = dist(this.px, this.py, m.x, m.y); if (d < bd) { bd = d; best = m; } }
      if (best) { dx = best.x - this.px; dy = best.y - this.py; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d; }
      this.spellShots.push({ x: this.px, y: this.py - 6, vx: dx * 320, vy: dy * 320, life: 1.6, elem: sp, dmg: sp === "fire" ? 3 : 1 });
    },
    updateSpellShots(dt) {
      for (let i = this.spellShots.length - 1; i >= 0; i--) {
        const a = this.spellShots[i]; a.x += a.vx * dt; a.y += a.vy * dt; a.life -= dt;
        if (a.life <= 0 || World.solidPx(a.x, a.y)) { G.fx.burst(a.x, a.y, a.elem === "fire" ? "#ff8a3a" : "#9fe6ff", 6, 90, 0.3); this.spellShots.splice(i, 1); continue; }
        for (const m of this.mobs) { if (!m.K.passive && dist(a.x, a.y, m.x, m.y) < m.K.r + 6) {
          G.hitMob(this, m, a.dmg);
          if (a.elem === "frost") { m.stun = Math.max(m.stun || 0, 1.4); G.fx.burst(m.x, m.y - 6, "#9fe6ff", 8, 90, 0.4); }
          else G.fx.burst(m.x, m.y - 6, "#ff8a3a", 10, 120, 0.4);
          this.spellShots.splice(i, 1); break;
        } }
      }
    },
    drawSpellShots(ctx) {
      for (const a of this.spellShots) {
        const c1 = a.elem === "fire" ? "#ffce4a" : "#cfeeff", c2 = a.elem === "fire" ? "#ff6a2a" : "#5ac8ff";
        const sp = Math.hypot(a.vx, a.vy) || 1, ux = a.vx / sp, uy = a.vy / sp;
        for (let t = 4; t >= 1; t--) {                       // 🔥 хвост по направлению полёта
          ctx.globalAlpha = 0.30 * (1 - t / 5); ctx.fillStyle = c2;
          circle(ctx, a.x - ux * t * 7, a.y - uy * t * 7, 5.6 - t * 0.9);
        }
        ctx.globalAlpha = 0.5; ctx.fillStyle = c2; circle(ctx, a.x, a.y, 8); ctx.globalAlpha = 1;
        ctx.fillStyle = c2; circle(ctx, a.x, a.y, 6); ctx.fillStyle = c1; circle(ctx, a.x, a.y, 3.5);
      }
    },
    shootArrow() {
      let best = null, bd = 1e9;
      for (const m of this.mobs) { if (m.K.passive) continue; const d = dist(this.px, this.py, m.x, m.y); if (d < bd) { bd = d; best = m; } }
      let dx = this.fx, dy = this.fy;
      if (best) { dx = best.x - this.px; dy = best.y - this.py; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d; }
      this.pshots.push({ x: this.px, y: this.py - 6, vx: dx * 340, vy: dy * 340, life: 1.6, dmg: 3 });
      G.invRemove("arrow", 1); G.audio.tone(300, 0.06, "square", 0.04);
    },
    nearWater() {
      const ptx = Math.floor(this.px / TILE), pty = Math.floor(this.py / TILE);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
        if (World.gTile(ptx + dx, pty + dy) === World.GROUND.water) return true;
      return false;
    },
    catchFish() {
      const r = Math.random(), got = r < 0.78 ? "fish" : (r < 0.92 ? "wood" : "ghost_shard");
      if (G.invAdd(got, 1)) { G.audio.pickup(); G.fx.burst(this.px, this.py - 10, "#5ac8ff", 10, 110, 0.45); G.state.quests.fish = 1; }
      else G.audio.blip();
    },
    updatePShots(dt) {
      for (let i = this.pshots.length - 1; i >= 0; i--) {
        const a = this.pshots[i]; a.x += a.vx * dt; a.y += a.vy * dt; a.life -= dt;
        if (a.life <= 0 || World.solidPx(a.x, a.y)) { this.pshots.splice(i, 1); continue; }
        for (const m of this.mobs) { if (!m.K.passive && dist(a.x, a.y, m.x, m.y) < m.K.r + 5) { G.hitMob(this, m, a.dmg); this.pshots.splice(i, 1); break; } }
      }
    },
    updatePet(dt) {
      if (G.invCount("pet") <= 0 && !G.state.hasPet) return;
      if (this.petX == null) { this.petX = this.px; this.petY = this.py; }
      this.petX += (this.px - 26 - this.petX) * Math.min(1, dt * 4);
      this.petY += (this.py + 8 - this.petY) * Math.min(1, dt * 4);
      this._petCd = Math.max(0, (this._petCd || 0) - dt);
      if (this._petCd <= 0) for (const m of this.mobs) { if (!m.K.passive && dist(this.petX, this.petY, m.x, m.y) < 66) { G.hitMob(this, m, 1); this._petCd = 1.2; this.petX = m.x; this.petY = m.y; break; } } // 🦁 помощник: 1 урон/1.2с (не убивает с одного удара)
    },
    drawPet(ctx, x, y) {     // 🦁 львёнок «Лев» (по имени Льва — лев!)
      ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(x, y + 10, 11, 5, 0, 0, PI * 2); ctx.fill();              // тень (без качания)
      const bob = Math.sin(G.time * 3.4 + x * 0.1) * 1.4; ctx.save(); ctx.translate(0, bob);                                     // львёнок «дышит»
      ctx.strokeStyle = "#c89a3a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 9, y + 2); ctx.quadraticCurveTo(x - 18, y, x - 15, y - 8); ctx.stroke(); // хвост
      ctx.fillStyle = "#b8822a"; circle(ctx, x - 15, y - 9, 3);                                                                  // кисточка хвоста
      ctx.fillStyle = "#e6ad4c"; rr(ctx, x - 10, y - 3, 19, 13, 6); ctx.fill();                                                  // тело (золотистое)
      ctx.fillStyle = "#d89a3a"; rr(ctx, x - 8, y + 6, 4, 5, 2); ctx.fill(); rr(ctx, x + 3, y + 6, 4, 5, 2); ctx.fill();          // лапки
      ctx.fillStyle = "#c8862a"; circle(ctx, x + 10, y - 5, 11);                                                                 // грива (пушистый ореол)
      ctx.fillStyle = "#f2c869"; circle(ctx, x + 10, y - 5, 8);                                                                  // мордочка
      ctx.fillStyle = "#e6ad4c"; circle(ctx, x + 5, y - 13, 3); circle(ctx, x + 15, y - 13, 3);                                  // ушки
      ctx.fillStyle = "#3a2a18"; ctx.fillRect(x + 6, y - 7, 2, 2); ctx.fillRect(x + 12, y - 7, 2, 2);                            // глазки
      ctx.fillStyle = "#8a4a2a"; circle(ctx, x + 10, y - 3, 1.6);                                                                // носик
      ctx.restore();                                                                                                              // конец качания тела
      ctx.fillStyle = "rgba(0,0,0,0.45)"; rr(ctx, x - 5, y - 30, 30, 13, 5); ctx.fill();                                         // табличка (стабильна)
      ctx.fillStyle = "#ffe08a"; ctx.font = G.f(11, "bold"); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Лев", x + 10, y - 23);
    },
    hurt(dmg, mu, ignoreInvuln) {
      if (this._dead || G.state.creative) return;          // творческий режим — без урона
      if (!ignoreInvuln && this._invuln > 0) {
        if (this._dashT > 0 && mu) {                       // 🛡 идеальный уворот = ПАРИРОВАНИЕ (стан атакующему)
          mu.stun = Math.max(mu.stun || 0, 1.2);
          const dx = mu.x - this.px, dy = mu.y - this.py, d = Math.hypot(dx, dy) || 1; mu.x += (dx / d) * 22; mu.y += (dy / d) * 22;
          this.addFloater(this.px, this.py - 26, "ПАРИРОВАНО!", "#9fe6ff"); G.fx.ring(this.px, this.py, "#cfe6ff", 40, 0.4); G.hitStop(0.08); G.audio.tone(520, 0.1, "triangle", 0.06);
        }
        return;
      }
      if (mu) dmg = Math.max(1, Math.round(dmg * (1 - Math.min(0.85, G.shieldReduce() + G.armorDefense() + (G.state.perks.tough ? 0.15 : 0))))); // щит + броня + перк
      G.state.hp = Math.max(0, G.state.hp - dmg);
      this._invuln = 0.6; this._dmgFlash = 0.4;
      if (mu && isFinite(mu.x) && isFinite(mu.y)) { const dx = this.px - mu.x, dy = this.py - mu.y, d = Math.hypot(dx, dy) || 1, nx = this.px + (dx / d) * 13, ny = this.py + (dy / d) * 13; if (!this.blocked(nx, this.py)) this.px = nx; if (!this.blocked(this.px, ny)) this.py = ny; } // отдача от удара (только от источника с координатами — иначе px стал бы NaN)
      G.shake(8); G.audio.hit();
      if (G.state.hp <= 0) this.die();
    },
    die() {
      this._dead = true;
      G.fx.burst(this.px, this.py - 10, "#e24b4b", 22, 190, 0.7);
      if (G.state.depth !== 0) { World.use(0); G.state.depth = 0; this.darkBase = null; this.crops = []; } // возрождаемся на поверхности
      if (G.state.homeX != null) { this.px = G.state.homeX; this.py = G.state.homeY; } // у кровати-дома (как в Minecraft)
      else { const sp = World.findSpawn(); this.px = sp.x; this.py = sp.y; }
      G.state.hp = G.state.maxHp;
      if (G.diff().hunger > 0) G.state.hunger = Math.max(4, Math.floor(G.state.hunger / 2)); // прощающе
      this.mobs.length = 0;
      this._invuln = 2.0; this._deadMsg = 2.6;
      G.cam.x = clamp(this.px - VIEW.w / 2, 0, Math.max(0, World.W * TILE - VIEW.w));
      G.cam.y = clamp(this.py - VIEW.h / 2, 0, Math.max(0, World.H * TILE - VIEW.h));
      this._dead = false;
    },
    eat() {
      const s = G.invSel(); if (!s) return;
      const it = G.ITEMS[s.item]; if (!it || !it.food) return;
      if (G.state.hunger >= G.state.maxHunger) return;
      G.state.hunger = Math.min(G.state.maxHunger, G.state.hunger + it.food);
      G.invConsume(1); G.audio.pickup(); G.state.quests.eat = 1;
    },
    updateBreeding(dt) {     // 🐣 две накормленные зверюшки рядом → малыш
      for (const mu of this.mobs) { if (mu._love > 0) mu._love -= dt; if (mu._breedCd > 0) mu._breedCd -= dt; }
      for (let i = 0; i < this.mobs.length; i++) {
        const a = this.mobs[i]; if (!(a._love > 0) || a.babyT > 0 || a._breedCd > 0) continue;
        for (let j = i + 1; j < this.mobs.length; j++) {
          const b = this.mobs[j]; if (!(b._love > 0) || b.babyT > 0 || b._breedCd > 0 || b.kind !== a.kind) continue;
          if (dist(a.x, a.y, b.x, b.y) < TILE * 2.2) {
            const baby = G.makeMob((a.x + b.x) / 2, (a.y + b.y) / 2, a.kind); baby.babyT = 22; this.mobs.push(baby);
            a._love = 0; b._love = 0; a._breedCd = 30; b._breedCd = 30; G.state.quests.breed = 1;
            G.fx.burst(baby.x, baby.y - 10, "#ff7aa8", 16, 130, 0.6); G.audio.pickup();
            return;
          }
        }
      }
    },
    drinkPotion() {
      const s = G.invSel(); if (!s) return; const it = G.ITEMS[s.item]; if (!it || !it.potion) return;
      if (it.potion === "heal") { if (G.state.hp >= G.state.maxHp) return; G.state.hp = Math.min(G.state.maxHp, G.state.hp + 8); }
      else if (it.potion === "speed") this._speedT = 18;
      else if (it.potion === "strength") this._strT = 18;
      G.invConsume(1); G.audio.pickup(); G.shake(2); G.state.quests.potion = 1;
      G.fx.burst(this.px, this.py - 10, it.pcolor || "#c46bff", 14, 130, 0.5);
    },

    // --- глубина: спуск/подъём между слоями ---
    caveDark(depth) { return Math.min(0.92, 0.5 + depth * 0.12); },
    descend() {
      const nd = G.state.depth + 1; if (nd > 4) return;
      if (G.state.depth === 0) G.state.caveReturn = { x: this.px, y: this.py }; // запомнить выход
      G.state.quests.cave = 1;
      const L = World.use(nd); this.px = L.entry.x; this.py = L.entry.y; this._afterTrans();
    },
    ascend() {
      const nd = G.state.depth - 1; if (nd < 0) return;
      const L = World.use(nd);
      if (nd === 0 && G.state.caveReturn) { this.px = G.state.caveReturn.x; this.py = G.state.caveReturn.y; }
      else if (L.entry) { this.px = L.entry.x; this.py = L.entry.y; }
      this._afterTrans();
    },
    _afterTrans() {
      this.mobs.length = 0; this.shots.length = 0; this._invuln = 1.0;
      this.darkBase = G.state.depth > 0 ? this.caveDark(G.state.depth) : null;
      this._lastTransTile = Math.floor(this.px / TILE) + "," + Math.floor(this.py / TILE);
      G.cam.x = clamp(this.px - VIEW.w / 2, 0, Math.max(0, World.W * TILE - VIEW.w));
      G.cam.y = clamp(this.py - VIEW.h / 2, 0, Math.max(0, World.H * TILE - VIEW.h));
      G.audio.tone(220, 0.14, "triangle", 0.06); G.fx.burst(this.px, this.py, "#888", 10, 90, 0.4);
    },
    sleep() {
      G.dayCycle = 0.32;                                              // проспали до утра
      G.state.hp = Math.min(G.state.maxHp, G.state.hp + 5);
      if (G.state.depth === 0) { G.state.homeX = this.px; G.state.homeY = this.py; this.addFloater(this.px, this.py - 22, "🛏 дом", "#cdeaff"); } // кровать = точка возрождения (Minecraft)
      this.mobs.length = 0; this.shots.length = 0; this._invuln = 1.2;
      G.audio.tone(392, 0.18, "sine", 0.05); G.fx.burst(this.px, this.py - 10, "#cdeaff", 14, 80, 0.6); G.state.quests.sleep = 1;
    },
    goAstral() {            // портал → Мир Призраков (depth 9)
      if (G.state.depth === 0) G.state.caveReturn = { x: this.px, y: this.py };
      G.state.quests.astral = 1;
      const L = World.use(9); this.px = L.entry.x; this.py = L.entry.y; this._afterTrans();
      G.fx.ring(this.px, this.py, "#a86bff", 80, 0.6);
      if (!G.state.bossDefeated) this.mobs.push(G.makeMob(this.px + TILE * 7, this.py, "ghost_king")); // Король ждёт в бездне
    },
    toSurface() {          // портал домой
      World.use(0);
      if (G.state.caveReturn) { this.px = G.state.caveReturn.x; this.py = G.state.caveReturn.y; }
      else { const sp = World.findSpawn(); this.px = sp.x; this.py = sp.y; }
      this._afterTrans();
    },
    goTemple() {            // ⚔ вход в Храм-данж (depth 8)
      if (G.state.depth === 0) G.state.caveReturn = { x: this.px, y: this.py };
      const L = World.use(8); this.px = L.entry.x; this.py = L.entry.y; this._afterTrans();
      this.darkBase = 0.66;
      const kk = "8," + L.keyChest.x + "," + L.keyChest.y;
      if (!G.state.chests[kk]) { G.state.chests[kk] = new Array(16).fill(null); G.state.chests[kk][0] = { item: "key", n: 1 }; }
      if (!G.state.templeCleared) {   // страж + охрана только пока храм не пройден (без фарма)
        this.mobs.push(G.makeMob(L.bossPos.x * TILE + TILE / 2, L.bossPos.y * TILE + TILE / 2, "golem"));
        this.mobs.push(G.makeMob((L.keyChest.x + 2) * TILE + TILE / 2, L.keyChest.y * TILE + TILE / 2, "zombie"));
        this.mobs.push(G.makeMob((L.keyChest.x + 1) * TILE + TILE / 2, (L.keyChest.y + 1) * TILE + TILE / 2, "spider"));
      }
      G.fx.ring(this.px, this.py, "#c8a84a", 70, 0.6);
    },

    update(dt) {
      this._t += dt;
      G.uiBlock.push(actRect, dashRect, menuRect, craftBtn, invBtn);
      for (let i = 0; i < G.HOTBAR; i++) G.uiBlock.push(this.slotRect(i));
      if (this._craftOpen || this._invOpen || this._chestOpen || this._tradeOpen || this._perkOpen) { G.uiBlock.push({ x: 0, y: 0, w: VIEW.w, h: VIEW.h }); return; }

      // плавание: вода проходима для игрока, но медленнее и тратит воздух
      this.inWater = World.gTile(Math.floor(this.px / TILE), Math.floor(this.py / TILE)) === World.GROUND.water;
      this._onBoat = this.inWater && (function () { const z = G.invSel(); return z && z.item === "boat"; })(); // ⛵ на лодке
      const _rb = World.BLOCKS[World.oTile(Math.floor(this.px / TILE), Math.floor(this.py / TILE))]; this._onRail = !!(_rb && _rb.rail); // 🚂 на рельсах
      if (this._onBoat) G.state.quests.boat = 1; if (this._onRail) G.state.quests.rail = 1;

      // движение + коллизии (+ перекат)
      this._dashCd = Math.max(0, (this._dashCd || 0) - dt);
      const md = G.moveDir();
      const moving = md.mag > 0.12;
      if (this._dashT > 0) {                       // 🤸 перекат: рывок + i-кадры
        this._dashT = Math.max(0, this._dashT - dt);   // не оставляем таймер отрицательным (gotcha #1)
        const dsp = 560, nx = this.px + this._dashDX * dsp * dt, ny = this.py + this._dashDY * dsp * dt;
        if (!this.blocked(nx, this.py)) this.px = nx;
        if (!this.blocked(this.px, ny)) this.py = ny;
        this.px = clamp(this.px, 16, World.W * TILE - 16); this.py = clamp(this.py, 16, World.H * TILE - 16);
        this.walk += dt * 4;
        this._dashTrail.push({ x: this.px, y: this.py, life: 0.26 });
      } else if (moving) {
        const sp = 215 * md.mag * (this.inWater ? (this._onBoat ? 1.25 : 0.55) : 1) * (this._speedT > 0 ? 1.4 : 1) * (this._onRail ? 2.1 : 1) * (G.state.perks.swift ? 1.15 : 1);
        const nx = this.px + md.x * sp * dt;
        if (!this.blocked(nx, this.py)) this.px = nx;
        const ny = this.py + md.y * sp * dt;
        if (!this.blocked(this.px, ny)) this.py = ny;
        this.px = clamp(this.px, 16, World.W * TILE - 16);
        this.py = clamp(this.py, 16, World.H * TILE - 16);
        this.fx = md.x; this.fy = md.y;
        const m = Math.hypot(this.fx, this.fy) || 1; this.fx /= m; this.fy /= m;
        this.walk += dt * 1.9;
      } else this.walk = 0;
      for (let i = this._dashTrail.length - 1; i >= 0; i--) { this._dashTrail[i].life -= dt; if (this._dashTrail[i].life <= 0) this._dashTrail.splice(i, 1); }
      this._comboT = Math.max(0, (this._comboT || 0) - dt); if (this._comboT <= 0) this._combo = 0;

      // 🌡 температура: снег = холод, пустыня днём = жара; факел/печь рядом греют; глубокая ночь прохладна
      { const pg = World.gTile(Math.floor(this.px / TILE), Math.floor(this.py / TILE)), dl = G.daylight(); let tp = 0;
        if (pg === World.GROUND.snow) tp = -1; else if (pg === World.GROUND.sand && dl > 0.62) tp = 1; else if (dl < 0.28) tp = -0.5;
        if (tp < 0 && World.litAt(this.px, this.py)) tp = 0;
        this._temp = G.state.depth === 0 ? tp : 0; }
      // голод: быстрее в движении и при экстремальной температуре
      const diff = G.diff();
      if (diff.hunger > 0 && !G.state.creative) {
        this._hungerT += dt * diff.hunger * (moving ? 1.5 : 1) * (this._temp ? 1.4 : 1);
        if (this._hungerT >= 2.4) { this._hungerT = 0; G.state.hunger = Math.max(0, G.state.hunger - 1); }
      }
      // воздух: тратится под водой, на суше восстанавливается; на нуле — захлёбываемся
      if (this.inWater && !this._onBoat) {
        this._airT = (this._airT || 0) + dt;
        if (this._airT >= 1) { this._airT = 0; G.state.air = Math.max(0, G.state.air - 1); }
        if (G.state.air <= 0) { this._drownT = (this._drownT || 0) + dt; if (this._drownT >= 1.4) { this._drownT = 0; this.hurt(1, null, true); } }
      } else { G.state.air = G.state.maxAir; this._drownT = 0; }

      // переходы между слоями (вход в пещеру / лестницы) — срабатывает при заходе на новый тайл
      const ptx0 = Math.floor(this.px / TILE), pty0 = Math.floor(this.py / TILE), tKey = ptx0 + "," + pty0;
      if (tKey !== this._lastTransTile) {
        const tb = World.BLOCKS[World.oTile(ptx0, pty0)];
        if (tb && tb.trans === "down") this.descend();
        else if (tb && tb.trans === "up") this.ascend();
        else if (tb && tb.trans === "astral") this.goAstral();
        else if (tb && tb.trans === "home") this.toSurface();
        else if (tb && tb.trans === "temple") this.goTemple();
        else this._lastTransTile = null;   // (сон теперь по ТАПУ кровати, а не проходом — см. onTap)
      }

      // действие: сперва моб в зоне удара (бой), иначе добыча блока
      this.acting = this.actHeld || !!(G.input.keys.KeyE || G.input.keys.Space);
      this._bowCd = Math.max(0, (this._bowCd || 0) - dt);
      this._mpT = (this._mpT || 0) + dt; if (this._mpT >= (G.state.perks.mage ? 1.1 : 1.8)) { this._mpT = 0; if (G.state.mp < G.state.maxMp) G.state.mp++; } // ✨ реген маны (быстрее с перком Маг)
      this._speedT = Math.max(0, (this._speedT || 0) - dt); this._strT = Math.max(0, (this._strT || 0) - dt); // баффы зелий
      { const gl = G.state.story ? STORY : QUESTS, nd = gl.filter((q) => q.done()).length; // 🎯 цель выполнена → звон+вспышка
        if (this._goalsDone == null) this._goalsDone = nd;
        else if (nd > this._goalsDone) { this._goalFlash = 1.2; G.audio.tone(660, 0.12, "triangle", 0.05); G.audio.tone(880, 0.13, "triangle", 0.04); G.shake(3); this.addXp(15); this._goalsDone = nd; } // 🆙 опыт за цель
        else this._goalsDone = nd; }
      this._goalFlash = Math.max(0, (this._goalFlash || 0) - dt);
      // 🏆 ачивки: проверка раз → тост + монеты
      if (!G.state.achieved) G.state.achieved = {};
      for (const a of ACHIEVEMENTS) { if (!G.state.achieved[a.id] && a.check()) { G.state.achieved[a.id] = 1; if (a.coins) G.state.coins = (G.state.coins || 0) + a.coins; if (this._achQueue) this._achQueue.push(a); } }
      if (!this._achCur && this._achQueue && this._achQueue.length) { this._achCur = this._achQueue.shift(); this._achT = 2.8; G.audio.levelup(); G.shake(4); }
      if (this._achCur) { this._achT -= dt; if (this._achT <= 0) this._achCur = null; }
      for (let i = this._floaters.length - 1; i >= 0; i--) { const fl = this._floaters[i]; fl.y -= 26 * dt; fl.life -= dt; if (fl.life <= 0) this._floaters.splice(i, 1); } // всплывающий лут
      const _bowSel = (function () { const z = G.invSel(); return z && z.item === "bow" && G.invCount("arrow") > 0; })();
      const _rodSel = (function () { const z = G.invSel(); return z && z.item === "fishing_rod"; })();
      const _fishing = this.acting && _rodSel && this.nearWater();
      const _tome = (function () { const z = G.invSel(), it = z && G.ITEMS[z.item]; return it && it.spell ? it : null; })();
      this._castCd = Math.max(0, (this._castCd || 0) - dt);
      if (!_fishing) this._fishT = 0;
      if (this.acting && _tome) {                            // ✨ каст заклинания
        this.mobTarget = null; this.target = null; this._weak = false; this.mineT = 0;
        this.swingT = Math.min(0.98, this.swingT + dt * 3);
        if (this._castCd <= 0) { this._castCd = 0.55; this.castSpell(_tome); }
      } else if (_fishing) {                                 // 🎣 рыбалка у воды
        this.mobTarget = null; this.target = null; this._weak = false; this.mineT = 0;
        this.swingT = Math.min(0.6, this.swingT + dt * 1.5);
        this._fishT += dt;
        if (this._fishT >= 2.5) { this._fishT = 0; this.catchFish(); }
      } else if (this.acting && _bowSel) {                   // лук: стрельба по мобам
        this.mobTarget = null; this.target = null; this._weak = false; this.mineT = 0;
        this.swingT = Math.min(0.98, this.swingT + dt * 3);
        if (this._bowCd <= 0) { this._bowCd = 0.7; this.shootArrow(); }
      } else if ((this.mobTarget = this.acting ? ((this.swingT > 0 && this.mobTarget && !this.mobTarget._dead && this.mobs.indexOf(this.mobTarget) >= 0) ? this.mobTarget : this.nearestMob()) : null)) { // 🐷 держим цель на время замаха — добиваем убегающее животное
        this.target = null; this._weak = false; this.mineT = 0;
        this.swingT += dt * 3.6;
        if (this.swingT >= 1) { this.swingT = 0; const _eit = G.ITEMS[(G.invSel() || {}).item], _mt = this.mobTarget; G.hitMob(this, _mt, G.playerAtk() + (this._strT > 0 ? 2 : 0));
          if (_mt && !_mt._dead && _eit && _eit.elem) { if (_eit.elem === "fire") { _mt.onFire = 2.5; G.fx.burst(_mt.x, _mt.y - 6, "#ff8a3a", 10, 150, 0.4); G.audio.fire(); } else { _mt.stun = Math.max(_mt.stun || 0, 1.0); G.fx.burst(_mt.x, _mt.y - 6, "#9fe6ff", 10, 130, 0.4); G.audio.frost(); } } } // 🔥❄ зачарованный меч
      } else {
        let target = null;
        if (this.acting) target = this.nearestMinable();
        if (!target && this.tapTX >= 0) {
          const b = World.BLOCKS[World.oTile(this.tapTX, this.tapTY)];
          if (b && b.hardness > 0 && this.inRange(this.tapTX, this.tapTY)) target = { tx: this.tapTX, ty: this.tapTY, b };
          else this.tapTX = -1;
        }
        this.target = target;
        if (target && !G.state.creative && G.toolPower() < (target.b.tier || 1)) {
          this._weak = true; this.mineT = 0; this.swingT = 0;          // нужна кирка покрепче
        } else if (target) {
          this._weak = false;
          this.swingT += dt * 3.2;
          if (this.swingT >= 1) {
            this.swingT = 0; G.audio.dig();
            G.fx.burst(target.tx * TILE + TILE / 2, target.ty * TILE + TILE / 2 - 6, dropColor(target.b), 4, 80, 0.32);
          }
          this.mineT += dt;
          const need = G.state.creative ? 0.04 : (target.b.hardness * BASE_BREAK) / (G.toolPower() * (G.state.perks.miner ? 1.3 : 1));
          if (this.mineT >= need) { this.breakBlock(target); this.mineT = 0; this.swingT = 0; if (!this.acting) this.tapTX = -1; }
        } else { this._weak = false; this.mineT = 0; this.swingT = 0; }
      }

      // мобы: спавн (ночь) + ИИ; голодание/реген; неуязвимость и флэши
      G.spawnMobs(this, dt); G.spawnAnimals(this, dt);
      for (let i = this.mobs.length - 1; i >= 0; i--) { const mu = this.mobs[i]; if (!mu) continue; G.updateMob(this, mu, dt); if (mu._dead) this.mobs.splice(i, 1); } // guard: die() может очистить mobs прямо в цикле
      G.updateShots(this, dt); this.updatePShots(dt); this.updatePet(dt); this.updateBreeding(dt); this.updateSpellShots(dt);
      // рост посевов (только на поверхности; быстрее днём)
      if (G.state.depth === 0) for (let i = this.crops.length - 1; i >= 0; i--) {
        const cr = this.crops[i], cb = World.BLOCKS[World.oTile(cr.tx, cr.ty)];
        if (!cb || cb.crop == null) { this.crops.splice(i, 1); continue; }
        if (cr.st >= 3) continue;
        cr.t += dt * (0.4 + G.daylight() * 0.6) * (this.weather === "clear" ? 1 : 1.6); // дождь ускоряет рост
        const ns = Math.min(3, (cr.t / 8) | 0);
        if (ns !== cr.st) { cr.st = ns; World.edit(cr.tx, cr.ty, World.OBJ["crop" + ns]); }
      }
      // погода (только на поверхности): ясно / дождь / гроза
      if (G.state.depth === 0) {
        this._wxAnim = (this._wxAnim || 0) + dt; this._wxT -= dt;
        if (this._wxT <= 0) {
          const r = Math.random(); this.weather = r < 0.5 ? "clear" : (r < 0.82 ? "rain" : "storm");
          this._wxT = (this.weather === "clear" ? 50 : 35) + Math.random() * 40;
          if (this.weather !== "clear") G.audio.tone(120, 0.3, "sine", 0.03);
        }
        if (this.weather === "storm") { this._flash = Math.max(0, this._flash - dt * 2.5); if (Math.random() < dt * 0.22) { this._flash = 1; G.audio.tone(70, 0.4, "sawtooth", 0.05); } }
        else this._flash = 0;
      } else { this.weather = "clear"; this._flash = 0; }
      if (diff.hunger > 0 && G.state.hunger <= 0) { this._starveT += dt; if (this._starveT >= 2) { this._starveT = 0; this.hurt(1, null, true); } }
      else this._starveT = 0;
      if (G.state.hunger >= G.state.maxHunger * 0.7 && G.state.hp < G.state.maxHp) { this._regenT += dt; if (this._regenT >= 2.5) { this._regenT = 0; G.state.hp = Math.min(G.state.maxHp, G.state.hp + 1); } }
      if (this._invuln > 0) this._invuln -= dt;
      if (this._dmgFlash > 0) this._dmgFlash -= dt;
      if (this._deadMsg > 0) this._deadMsg -= dt;

      // камера
      const tw = clamp(this.px - VIEW.w / 2, 0, Math.max(0, World.W * TILE - VIEW.w));
      const th = clamp(this.py - VIEW.h / 2, 0, Math.max(0, World.H * TILE - VIEW.h));
      G.cam.x = lerp(G.cam.x, tw, Math.min(1, dt * 8));
      G.cam.y = lerp(G.cam.y, th, Math.min(1, dt * 8));

      // счётчик дней (по переходу через полночь)
      if (G.dayCycle < this._prevCycle) G.state.day++;
      this._prevCycle = G.dayCycle;

      // музыка по настроению: пещера → таинственно, ночь+враги → напряжённо, иначе → спокойно
      if (G.music) G.music.setMood(this.darkBase ? "mystery" : (this.mobs.some((m) => !m.K.passive) ? "tense" : "calm"));
      if (G.state.story && !this._won && STORY.every((c) => c.done())) { this._won = true; G.go("victory"); } // сюжет пройден

      // автосейв
      this._save += dt;
      if (this._save > 6) { this._save = 0; this.sync(); G.saveGame(); }
    },

    draw(ctx) {
      ctx.save();
      ctx.translate(-Math.round(G.cam.x), -Math.round(G.cam.y));
      const px = this.px, py = this.py, face = this.fx, walk = this.walk;
      const swing = this.swingT || 0;   // фаза замаха (мин/бой/лук/каст)
      const heldK = (function () { const z = G.invSel(), it = z && G.ITEMS[z.item]; if (!it) return null; if (it.weapon) return "sword"; if (z.item === "bow") return "bow"; if (it.tool === "pick") return "pick"; if (it.spell) return "tome"; if (z.item === "fishing_rod") return "rod"; return "item"; })(); // любой прочий предмет — держим в руке
      const heldMat = (function () { const z = G.invSel(), it = z && G.ITEMS[z.item]; return (it && (it.weapon || it.tool === "pick")) ? G.tierColor(z.item) : null; })(); // 🎨 цвет головы/клинка по тиру
      const heldObj = (function () { const z = G.invSel(); return z ? G.ITEMS[z.item] : null; })();  // предмет для held==="item"
      const me = this;
      const sprites = [{ baseY: py + 16, sprite: (c) => { if (me._onBoat) me.drawBoat(c, px, py); if (me._onRail) me.drawCart(c, px, py); if (me._dashT > 0) { c.save(); c.translate(px, py); c.rotate((1 - me._dashT / 0.2) * (me._dashDX >= 0 ? 1 : -1) * PI * 1.7); c.translate(-px, -py); G.drawSteve(c, px, py, face, walk, swing, heldK, heldMat, heldObj); c.restore(); } else G.drawSteve(c, px, py, face, walk, swing, heldK, heldMat, heldObj); if (me._dmgFlash > 0) { c.globalAlpha = Math.min(0.55, me._dmgFlash * 1.4); c.fillStyle = "#ff3030"; c.fillRect(px - 12, py - 27, 24, 44); c.globalAlpha = 1; } } }];
      for (const mu of this.mobs) sprites.push({ baseY: mu.y + mu.K.r, sprite: (c) => G.drawMob(c, mu) });
      if ((G.invCount("pet") > 0 || G.state.hasPet) && this.petX != null) { const pX = this.petX, pY = this.petY; sprites.push({ baseY: pY + 12, sprite: (c) => this.drawPet(c, pX, pY) }); }
      for (const tr of this._dashTrail) { ctx.globalAlpha = (tr.life / 0.26) * 0.35; ctx.fillStyle = "#bfe0ff"; rr(ctx, tr.x - 9, tr.y - 22, 18, 38, 6); ctx.fill(); } ctx.globalAlpha = 1; // 🤸 след переката
      World.drawVisible(ctx, sprites);
      G.drawShots(ctx, this);
      for (const a of this.pshots) { const ang = Math.atan2(a.vy, a.vx); ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang); ctx.fillStyle = "#caa86a"; ctx.fillRect(-7, -1.5, 12, 3); ctx.fillStyle = "#cfcfd6"; ctx.beginPath(); ctx.moveTo(5, -3); ctx.lineTo(9, 0); ctx.lineTo(5, 3); ctx.closePath(); ctx.fill(); ctx.restore(); }
      this.drawSpellShots(ctx);
      G.fx.draw(ctx);
      for (const fl of this._floaters) { ctx.globalAlpha = clamp(fl.life, 0, 1); ctx.font = G.f(18, "900"); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.strokeText(fl.text, fl.x, fl.y); ctx.fillStyle = fl.color; ctx.fillText(fl.text, fl.x, fl.y); ctx.globalAlpha = 1; }
      this.drawGoalPointer(ctx);
      if (this.target) this.drawMineProgress(ctx, this.target);
      ctx.restore();

      G.dayNightOverlay(ctx);
      G.drawLight(ctx, this);
      this.drawWeather(ctx);
      this.drawTempOverlay(ctx);
      this.drawAbyssAmbient(ctx);
      if (this._dmgFlash > 0) { ctx.fillStyle = `rgba(200,30,30,${(0.45 * this._dmgFlash / 0.4).toFixed(3)})`; ctx.fillRect(0, 0, VIEW.w, VIEW.h); }
      this.drawHUD(ctx);
      this.drawMinimap(ctx);
      this.drawDashButton(ctx);
      if (this._combo >= 2) { ctx.save(); ctx.globalAlpha = clamp(this._comboT, 0, 1); ctx.font = G.f(26, "900"); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#ffce4a"; ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineWidth = 4; const ct = "КОМБО ×" + this._combo; ctx.strokeText(ct, VIEW.w / 2, 162); ctx.fillText(ct, VIEW.w / 2, 162); ctx.restore(); }
      this.drawAchToast(ctx);
      if (this._craftOpen) { this.drawCraft(ctx); return; }
      if (this._perkOpen) { this.drawPerks(ctx); return; }
      if (this._tradeOpen) { this.drawTrade(ctx); return; }
      if (this._chestOpen) { this.drawChest(ctx); return; }
      if (this._invOpen) { this.drawInv(ctx); return; }
      G.drawJoystick(ctx);
      if (this._deadMsg > 0) this.drawBanner(ctx, "💤 Ты очнулся дома…");
      else if (this._t < 9) this.drawHint(ctx);
    },

    drawMineProgress(ctx, t) {
      const cx = t.tx * TILE + TILE / 2, y = t.ty * TILE - 14;
      const need = (t.b.hardness * BASE_BREAK) / this.toolPower;
      const p = clamp(this.mineT / need, 0, 1);
      const W = 52, H = 11, rem = 1 - p;                                      // 🔨 «прочность» блока: убывает по мере ломания
      ctx.fillStyle = "rgba(0,0,0,0.6)"; rr(ctx, cx - W / 2 - 2, y - 2, W + 4, H + 4, 5); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)"; rr(ctx, cx - W / 2, y, W, H, 4); ctx.fill();
      ctx.fillStyle = rem > 0.5 ? "#5fd86a" : rem > 0.22 ? "#ffce4a" : "#ff6b5a"; // зелёный→жёлтый→красный
      rr(ctx, cx - W / 2, y, W * rem, H, 4); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = G.f(11, "900"); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🔨", cx, y - 12);                                          // значок «ломаю» над баром
    },

    // --- торговля с жителем ---
    tradePanel() { const w = 720, h = 224 + Math.max(TRADES.length, SHOP.length) * 56; return { x: (VIEW.w - w) / 2, y: (VIEW.h - h) / 2, w: w, h: h }; },
    tradeCloseRect() { const p = this.tradePanel(); return { x: p.x + p.w - 52, y: p.y + 12, w: 40, h: 40 }; },
    tradeCardRect(i) { const p = this.tradePanel(); return { x: p.x + 24, y: p.y + 190 + i * 56, w: p.w - 48, h: 48 }; },
    shopTabRect(t) { const p = this.tradePanel(); return { x: p.x + 24 + t * 152, y: p.y + 144, w: 144, h: 34 }; },
    questBtnRect() { const p = this.tradePanel(); return { x: p.x + p.w - 192, y: p.y + 76, w: 168, h: 48 }; },
    questDone(q) { return q.kill ? (G.state.qkills - G.state.questBase) >= q.kill : G.invCount(q.item) >= q.n; },
    tradeTap(x, y) {
      if (rectHit(this.tradeCloseRect(), x, y)) { this._tradeOpen = false; G.audio.blip(); return; }
      if (rectHit(this.shopTabRect(0), x, y)) { this._shopTab = 0; G.audio.blip(); return; }
      if (rectHit(this.shopTabRect(1), x, y)) { this._shopTab = 1; G.audio.blip(); return; }
      if (rectHit(this.questBtnRect(), x, y)) {       // 🗨 кнопка задания (взять / сдать)
        if (!G.state.questId) { G.state.questId = this._offerQuest; G.state.questBase = G.state.qkills; G.audio.pickup(); G.shake(2); }
        else { const q = npcQuest(G.state.questId);
          if (this.questDone(q)) { if (q.item) G.invRemove(q.item, q.n); this.addXp(q.xp); if (q.give) G.invAdd(q.give[0], q.give[1]); G.state.questsDone = (G.state.questsDone || 0) + 1; G.state.quests.npcquest = 1; G.state.questId = null; this._offerQuest = NPC_QUESTS[(Math.random() * NPC_QUESTS.length) | 0].id; G.audio.pickup(); G.shake(4); this.addFloater(this.px, this.py - 14, "🗨 +" + q.xp + " опыта", "#bdf0a8"); }
          else G.audio.blip();
        }
        return;
      }
      const LIST = this._shopTab ? SHOP : TRADES;
      for (let i = 0; i < LIST.length; i++) if (rectHit(this.tradeCardRect(i), x, y)) {
        if (this._shopTab) { const sh = SHOP[i];          // 🪙 покупка за монеты
          if ((G.state.coins || 0) >= sh.price && G.invRoom(sh.item)) { G.state.coins -= sh.price; G.invAdd(sh.item, sh.n); G.audio.pickup(); G.shake(2); }
          else G.audio.blip();
        } else { const t = TRADES[i];                     // обмен предметами
          if (G.invCount(t.give[0]) >= t.give[1] && G.invRoom(t.get[0])) { G.invRemove(t.give[0], t.give[1]); G.invAdd(t.get[0], t.get[1]); G.audio.pickup(); G.shake(2); G.state.quests.trade = 1; }
          else G.audio.blip();
        }
        return;
      }
      if (!rectHit(this.tradePanel(), x, y)) this._tradeOpen = false;
    },
    drawTrade(ctx) {
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      const p = this.tradePanel();
      ctx.fillStyle = "rgba(30,33,44,0.98)"; rr(ctx, p.x, p.y, p.w, p.h, 18); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.15)"; rr(ctx, p.x, p.y, p.w, p.h, 18); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = G.f(28, "900"); ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText("🏘 Торговля с жителем", p.x + 26, p.y + 40);
      const cr = this.tradeCloseRect();
      ctx.fillStyle = "rgba(255,255,255,0.12)"; rr(ctx, cr.x, cr.y, cr.w, cr.h, 10); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = G.f(24); ctx.textAlign = "center"; ctx.fillText("✕", cr.x + cr.w / 2, cr.y + cr.h / 2 + 1);
      // 🗨 секция задания (Fallout)
      const q = G.state.questId ? npcQuest(G.state.questId) : npcQuest(this._offerQuest || "wood"), active = !!G.state.questId, done = active && this.questDone(q);
      ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.font = G.f(17, "bold"); ctx.fillStyle = "#ffce4a";
      ctx.fillText("🗨 " + (active ? "Задание: " : "Просьба: ") + q.text, p.x + 26, p.y + 86);
      ctx.font = G.f(14); ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.fillText("Награда: +" + q.xp + " опыта" + (q.give ? "  +" + (G.ITEMS[q.give[0]] ? G.ITEMS[q.give[0]].icon : "?") + "×" + q.give[1] : ""), p.x + 26, p.y + 110);
      const qb = this.questBtnRect(), bl = !active ? "Взять" : done ? "✓ Сдать" : "…в процессе", bc = !active ? "#5aa84a" : done ? "#ffce4a" : "rgba(255,255,255,0.10)";
      ctx.fillStyle = bc; rr(ctx, qb.x, qb.y, qb.w, qb.h, 10); ctx.fill();
      ctx.fillStyle = (!active || done) ? "#0c1a0c" : "#fff"; ctx.font = G.f(18, "900"); ctx.textAlign = "center"; ctx.fillText(bl, qb.x + qb.w / 2, qb.y + qb.h / 2 + 1);
      ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x + 20, p.y + 138); ctx.lineTo(p.x + p.w - 20, p.y + 138); ctx.stroke();
      // 🪙 табы Обмен / Магазин + баланс монет
      const tab = this._shopTab ? 1 : 0, tabs = ["🤝 Обмен", "🪙 Магазин"];
      for (let ti = 0; ti < 2; ti++) { const tr = this.shopTabRect(ti), on = tab === ti;
        ctx.fillStyle = on ? "#ffce4a" : "rgba(255,255,255,0.10)"; rr(ctx, tr.x, tr.y, tr.w, tr.h, 9); ctx.fill();
        ctx.fillStyle = on ? "#26200c" : "#fff"; ctx.font = G.f(16, "900"); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(tabs[ti], tr.x + tr.w / 2, tr.y + tr.h / 2 + 1);
      }
      ctx.textAlign = "right"; ctx.font = G.f(18, "900"); ctx.fillStyle = "#ffd24a"; ctx.textBaseline = "middle"; ctx.fillText("🪙 " + (G.state.coins || 0), p.x + p.w - 26, p.y + 161);
      if (tab === 0) {
        for (let i = 0; i < TRADES.length; i++) {
          const t = TRADES[i], r = this.tradeCardRect(i), gi = G.ITEMS[t.give[0]], go = G.ITEMS[t.get[0]];
          const can = G.invCount(t.give[0]) >= t.give[1] && G.invRoom(t.get[0]);
          ctx.fillStyle = can ? "rgba(90,168,74,0.22)" : "rgba(255,255,255,0.05)"; rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = can ? "#5aa84a" : "rgba(255,255,255,0.14)"; rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.stroke();
          ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.font = G.f(26); ctx.fillStyle = "#fff";
          ctx.fillText((gi ? gi.icon : "?") + " ×" + t.give[1] + "    →    " + (go ? go.icon : "?") + " ×" + t.get[1], r.x + 18, r.y + r.h / 2);
          ctx.textAlign = "right"; ctx.font = G.f(15, "bold"); ctx.fillStyle = can ? "#bdf0a8" : "rgba(255,255,255,0.4)";
          ctx.fillText(can ? "✓ обмен" : "нужно: " + (gi ? gi.name : "") + " ×" + t.give[1], r.x + r.w - 16, r.y + r.h / 2);
        }
      } else {
        for (let i = 0; i < SHOP.length; i++) {
          const sh = SHOP[i], r = this.tradeCardRect(i), it = G.ITEMS[sh.item];
          const can = (G.state.coins || 0) >= sh.price && G.invRoom(sh.item);
          ctx.fillStyle = can ? "rgba(255,206,74,0.18)" : "rgba(255,255,255,0.05)"; rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = can ? "#ffce4a" : "rgba(255,255,255,0.14)"; rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.stroke();
          ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.font = G.f(25); ctx.fillStyle = "#fff";
          ctx.fillText((it ? it.icon : "?") + " ×" + sh.n + "   " + (it ? it.name : sh.item), r.x + 18, r.y + r.h / 2);
          ctx.textAlign = "right"; ctx.font = G.f(16, "900"); ctx.fillStyle = can ? "#ffd24a" : "rgba(255,255,255,0.4)";
          ctx.fillText("🪙 " + sh.price, r.x + r.w - 16, r.y + r.h / 2);
        }
      }
    },
    drawTempOverlay(ctx) {
      const t = this._temp || 0; if (!t) return;
      const g = ctx.createRadialGradient(VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.30, VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.74);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, t < 0 ? "rgba(120,180,255,0.34)" : "rgba(255,140,40,0.30)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    },
    miniColor(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= World.W || ty >= World.H) return "#0a0c10";
      const ob = World.BLOCKS[World.oTile(tx, ty)];
      if (ob) {
        if (ob.id === "tree") return "#2f6b34";
        if (ob.special === "treasure") return "#ffd24a";
        if (ob.store || ob.door || ob.id === "woodblock") return "#7a4a26";
        if (ob.id === "cactus") return "#3a8a4a";
        if (ob.id === "templewall") return "#6a5a40";
        if (ob.id === "temple_entrance" || ob.id === "temple_exit") return "#ffce4a";
        if (ob.lock) return "#caa84a";
        if (ob.light) return "#ffe08a";
      }
      const GR = World.GROUND, g = World.gTile(tx, ty);
      return g === GR.water ? "#3a6ea8" : g === GR.sand ? "#d8c48a" : g === GR.snow ? "#e8eef2" : g === GR.stone ? "#8a8a94" : g === GR.cavefloor ? "#4a4550" : g === GR.astral ? "#3a2e5e" : g === GR.swamp ? "#46563a" : g === GR.jungle ? "#357a32" : g === GR.mycelium ? "#5a4a6a" : "#5a9a4a";
    },
    drawMinimap(ctx) {
      const S = 148, R = 26, x0 = 16, y0 = VIEW.h - S - 16, cell = S / (R * 2 + 1);
      const ptx = Math.floor(this.px / TILE), pty = Math.floor(this.py / TILE);
      ctx.save();
      ctx.fillStyle = "rgba(20,24,30,0.78)"; rr(ctx, x0 - 4, y0 - 4, S + 8, S + 8, 10); ctx.fill();
      ctx.beginPath(); rr(ctx, x0, y0, S, S, 6); ctx.clip();
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        ctx.fillStyle = this.miniColor(ptx + dx, pty + dy);
        ctx.fillRect(x0 + (dx + R) * cell, y0 + (dy + R) * cell, cell + 0.7, cell + 0.7);
      }
      ctx.restore();
      ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.28)"; rr(ctx, x0, y0, S, S, 6); ctx.stroke();
      const v = (G.state.depth === 0 && World.layers[0]) ? World.layers[0].village : null;
      if (v && Math.abs(v.x - ptx) <= R && Math.abs(v.y - pty) <= R) { ctx.font = G.f(13); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🏠", x0 + (v.x - ptx + R) * cell + cell / 2, y0 + (v.y - pty + R) * cell); }
      ctx.fillStyle = "#fff"; circle(ctx, x0 + S / 2, y0 + S / 2, 3.5);
      ctx.lineWidth = 1.5; ctx.strokeStyle = "#1a1a1a"; ctx.beginPath(); ctx.arc(x0 + S / 2, y0 + S / 2, 3.5, 0, PI * 2); ctx.stroke();
    },
    powerArea(tx, ty, on) {     // 🔴 рычаг питает лампы (вкл/выкл) и двери (откр/закр) в радиусе; вернуть число ламп
      const R = 5; let n = 0;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const x = tx + dx, y = ty + dy, b = World.BLOCKS[World.oTile(x, y)]; if (!b) continue;
        if (b.lamp) { World.edit(x, y, on ? World.OBJ.redlamp_on : World.OBJ.redlamp); n++; }
        else if (b.door) World.edit(x, y, on ? World.OBJ.door_open : World.OBJ.door);
      }
      return n;
    },
    tryDash() {              // 🤸 перекат-уворот: рывок + i-кадры
      if (this._dashCd > 0 || this._dashT > 0 || this._dead) return;
      const md = G.moveDir(); let dx = this.fx, dy = this.fy;
      if (md.mag > 0.12) { dx = md.x; dy = md.y; }
      const m = Math.hypot(dx, dy) || 1; this._dashDX = dx / m; this._dashDY = dy / m;
      this._dashT = 0.2; this._dashCd = 0.85; this._invuln = Math.max(this._invuln, 0.26);  // настоящее уклонение
      G.audio.tone(360, 0.08, "sine", 0.05); G.fx.burst(this.px, this.py + 8, "#cfe6ff", 8, 130, 0.35);
    },
    drawDashButton(ctx) {
      const r = dashRect, cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = r.w / 2, ready = this._dashCd <= 0;
      ctx.fillStyle = ready ? "rgba(90,168,224,0.92)" : "rgba(70,80,96,0.85)"; circle(ctx, cx, cy, rad);
      ctx.fillStyle = "#fff"; ctx.font = G.f(30); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🤸", cx, cy - 3);
      ctx.font = G.f(11, "bold"); ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillText("УВОРОТ", cx, cy + 22);
      if (!ready) { ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, rad - 3, -PI / 2, -PI / 2 + (1 - this._dashCd / 0.85) * PI * 2); ctx.stroke(); }
    },
    addFloater(x, y, text, color) { this._floaters.push({ x: x, y: y, text: text, color: color || "#fff", life: 1.1 }); },
    goalTarget() {        // мировая точка текущей визуальной цели (плавающая стрелка + HUD-компас для нечитающего игрока)
      if (G.state.depth !== 0) return null;
      // дальняя цель: Храм (Глава 7) — координаты известны из генерации, не сканом
      if (G.state.story && G.state.bossDefeated && G.state.quests.spell && !G.state.templeCleared) {
        const ts = (World.layers[0] || {}).temples;
        if (ts && ts.length) { let bt = null, btd = 1e9; for (const t of ts) { const d = dist(this.px, this.py, t.x, t.y); if (d < btd) { btd = d; bt = t; } } if (bt) return { x: bt.x, y: bt.y, icon: "⚔" }; }
      }
      // ближние цели: дерево / вход в пещеру — скан вокруг игрока
      let want = null, icon = null;
      if (!G.state.quests.chop) { want = World.OBJ.tree; icon = "🌳"; }              // 1-я цель: дерево
      else if (G.toolPower() > 1 && !G.state.quests.cave) { want = World.OBJ.cave_entrance; icon = "🪜"; } // потом: вход в пещеру
      if (want == null) return null;
      const ptx = Math.floor(this.px / TILE), pty = Math.floor(this.py / TILE), R = 18;
      let best = null, bd = 1e9;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (World.oTile(ptx + dx, pty + dy) !== want) continue;
        const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = { tx: ptx + dx, ty: pty + dy }; }
      }
      return best ? { x: best.tx * TILE + TILE / 2, y: best.ty * TILE + TILE / 2, icon: icon } : null;
    },
    drawGoalPointer(ctx) {
      const t = this.goalTarget(); if (!t) return;
      const bob = Math.sin((this._wxAnim || 0) * 4) * 5, ay = t.y - 40 + bob;
      ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 3; ctx.fillStyle = "#ffce4a";
      ctx.beginPath(); ctx.moveTo(t.x - 11, ay - 10); ctx.lineTo(t.x + 11, ay - 10); ctx.lineTo(t.x, ay + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    },
    drawCart(ctx, x, y) {
      ctx.save(); ctx.translate(x, y + 12);
      ctx.fillStyle = "#3a3a44"; G.rr(ctx, -16, -6, 32, 16, 4); ctx.fill();      // кузов
      ctx.fillStyle = "#5a5a66"; G.rr(ctx, -13, -8, 26, 8, 3); ctx.fill();        // борт
      ctx.fillStyle = "#1a1a1e"; circle(ctx, -9, 11, 4); circle(ctx, 9, 11, 4);    // колёса
      ctx.fillStyle = "#9a9aa6"; circle(ctx, -9, 11, 1.6); circle(ctx, 9, 11, 1.6);
      ctx.restore();
    },
    drawBoat(ctx, x, y) {
      ctx.save(); ctx.translate(x, y + 13);
      ctx.fillStyle = "#5a3a1e"; G.rr(ctx, -21, -3, 42, 15, 7); ctx.fill();      // киль (тень)
      ctx.fillStyle = "#7a4a26"; G.rr(ctx, -20, -5, 40, 13, 7); ctx.fill();      // корпус
      ctx.fillStyle = "#9a6a3a"; G.rr(ctx, -16, -6, 32, 6, 4); ctx.fill();        // борт
      ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.fillRect(-21, 11, 42, 2);     // пенный след
      ctx.restore();
    },
    drawWeather(ctx) {
      const w = this.weather;
      if (w !== "rain" && w !== "storm") return;
      ctx.fillStyle = w === "storm" ? "rgba(20,24,40,0.34)" : "rgba(30,40,60,0.20)"; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      const t = (this._wxAnim || 0) * (w === "storm" ? 950 : 620), n = w === "storm" ? 150 : 90;
      ctx.strokeStyle = w === "storm" ? "rgba(180,200,255,0.5)" : "rgba(170,200,235,0.4)"; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const sx = (i * 137.5) % VIEW.w, base = (i * 89.3) % VIEW.h;
        const y = (base + t) % (VIEW.h + 40) - 20, x = (sx + y * 0.4) % VIEW.w;
        ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 16);
      }
      ctx.stroke();
      if (this._flash > 0) { ctx.fillStyle = "rgba(255,255,255," + (0.5 * this._flash).toFixed(3) + ")"; ctx.fillRect(0, 0, VIEW.w, VIEW.h); }
    },
    drawHUD(ctx) {
      ctx.textBaseline = "middle";
      // кнопка меню
      ctx.fillStyle = PAL.panel; rr(ctx, menuRect.x, menuRect.y, menuRect.w, menuRect.h, 12); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = G.f(30); ctx.textAlign = "center";
      ctx.fillText("≡", menuRect.x + menuRect.w / 2, menuRect.y + menuRect.h / 2 + 1);

      ctx.fillStyle = PAL.panel; rr(ctx, craftBtn.x, craftBtn.y, craftBtn.w, craftBtn.h, 12); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = G.f(28); ctx.fillText("🛠", craftBtn.x + craftBtn.w / 2, craftBtn.y + craftBtn.h / 2 + 1);
      ctx.fillStyle = PAL.panel; rr(ctx, invBtn.x, invBtn.y, invBtn.w, invBtn.h, 12); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = G.f(26); ctx.fillText("🎒", invBtn.x + invBtn.w / 2, invBtn.y + invBtn.h / 2 + 1);

      // здоровье + сытость (слева, после кнопок)
      const bx = 214, bw = 224, st = G.state, dd = G.diff();
      ctx.fillStyle = PAL.panel; rr(ctx, bx, 20, bw, 26, 9); ctx.fill();
      ctx.textAlign = "left"; ctx.font = G.f(18); ctx.fillStyle = "#fff"; ctx.fillText("❤", bx + 9, 34);
      ctx.fillStyle = "rgba(0,0,0,0.35)"; rr(ctx, bx + 36, 27, bw - 48, 12, 6); ctx.fill();
      ctx.fillStyle = "#e24b4b"; rr(ctx, bx + 36, 27, (bw - 48) * clamp(st.hp / st.maxHp, 0, 1), 12, 6); ctx.fill();
      if (dd.hunger > 0) {
        ctx.fillStyle = PAL.panel; rr(ctx, bx, 52, bw, 26, 9); ctx.fill();
        ctx.font = G.f(18); ctx.fillStyle = "#fff"; ctx.fillText("🍗", bx + 9, 66);
        ctx.fillStyle = "rgba(0,0,0,0.35)"; rr(ctx, bx + 36, 59, bw - 48, 12, 6); ctx.fill();
        ctx.fillStyle = "#e0902a"; rr(ctx, bx + 36, 59, (bw - 48) * clamp(st.hunger / st.maxHunger, 0, 1), 12, 6); ctx.fill();
      }
      { const cx2 = bx + bw + 14;                                                    // 🪙 монеты
        ctx.fillStyle = PAL.panel; rr(ctx, cx2, 20, 104, 26, 9); ctx.fill();
        ctx.textAlign = "left"; ctx.font = G.f(18); ctx.fillStyle = "#ffd24a"; ctx.fillText("🪙", cx2 + 9, 34);
        ctx.font = G.f(16, "bold"); ctx.fillStyle = "#fff"; ctx.fillText("" + (st.coins || 0), cx2 + 36, 34); }
      if (this.inWater) {
        ctx.fillStyle = PAL.panel; rr(ctx, bx, 84, bw, 26, 9); ctx.fill();
        ctx.font = G.f(18); ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText("🫧", bx + 9, 98);
        ctx.fillStyle = "rgba(0,0,0,0.35)"; rr(ctx, bx + 36, 91, bw - 48, 12, 6); ctx.fill();
        ctx.fillStyle = "#5ac8ff"; rr(ctx, bx + 36, 91, (bw - 48) * clamp(st.air / st.maxAir, 0, 1), 12, 6); ctx.fill();
      }
      if (G.invCount("tome_fire") + G.invCount("tome_frost") + G.invCount("tome_bolt") + G.invCount("tome_heal") > 0) {  // ✨ мана (если есть магия)
        const my = this.inWater ? 116 : 84;
        ctx.fillStyle = PAL.panel; rr(ctx, bx, my, bw, 26, 9); ctx.fill();
        ctx.font = G.f(18); ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText("✨", bx + 9, my + 14);
        ctx.fillStyle = "rgba(0,0,0,0.35)"; rr(ctx, bx + 36, my + 7, bw - 48, 12, 6); ctx.fill();
        ctx.fillStyle = "#9a6aff"; rr(ctx, bx + 36, my + 7, (bw - 48) * clamp(st.mp / st.maxMp, 0, 1), 12, 6); ctx.fill();
      }
      // 🆙 уровень + опыт (над хотбаром)
      { const lw = 360, lx = (VIEW.w - lw) / 2, ly = VIEW.h - 104, need = this.xpNeed(st.level);
        ctx.fillStyle = PAL.panel; rr(ctx, lx, ly, lw, 17, 8); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.35)"; rr(ctx, lx + 46, ly + 5, lw - 58, 8, 4); ctx.fill();
        ctx.fillStyle = "#7CFC8A"; rr(ctx, lx + 46, ly + 5, (lw - 58) * clamp(st.xp / need, 0, 1), 8, 4); ctx.fill();
        ctx.fillStyle = "#ffce4a"; ctx.font = G.f(13, "900"); ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("⭐" + st.level, lx + 9, ly + 9);
      }

      // часы / день
      const d = G.daylight();
      ctx.fillStyle = PAL.panel; rr(ctx, VIEW.w - 168, 22, 146, 46, 10); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = G.f(24); ctx.textAlign = "left";
      ctx.fillText((this.weather === "rain" ? "🌧" : this.weather === "storm" ? "⛈" : d > 0.5 ? "☀" : "🌙") + " День " + G.state.day, VIEW.w - 156, 22 + 24);
      // бейдж сложности
      ctx.fillStyle = PAL.panel; rr(ctx, VIEW.w - 168, 74, 146, 30, 8); ctx.fill();
      ctx.font = G.f(17, "bold"); ctx.fillStyle = "#fff";
      ctx.fillText(G.diff().icon + " " + G.diff().name, VIEW.w - 156, 74 + 16);
      if (G.state.depth > 0) {
        ctx.fillStyle = PAL.panel; rr(ctx, VIEW.w - 168, 110, 146, 30, 8); ctx.fill();
        ctx.font = G.f(17, "bold"); ctx.fillStyle = "#ffce4a"; ctx.textAlign = "left";
        ctx.fillText(G.state.depth === 8 ? "⚔ Храм" : G.state.depth === 9 ? "👻 Астрал" : "🪜 Глубина " + G.state.depth, VIEW.w - 156, 110 + 16);
      } else if (G.state.homeX != null && G.invCount("compass") > 0) {  // компас → домой
        const dx = G.state.homeX - this.px, dy = G.state.homeY - this.py, d = Math.hypot(dx, dy);
        ctx.fillStyle = PAL.panel; rr(ctx, VIEW.w - 168, 110, 146, 32, 8); ctx.fill();
        ctx.save(); ctx.translate(VIEW.w - 150, 126); ctx.rotate(Math.atan2(dy, dx));
        ctx.fillStyle = "#ff6b6b"; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#fff"; ctx.font = G.f(15, "bold"); ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText("🧭 " + Math.round(d / TILE) + "м", VIEW.w - 124, 126);
      }

      // кнопка «Добыть»
      const cx = actRect.x + actRect.w / 2, cy = actRect.y + actRect.h / 2, rad = actRect.w / 2 - 6;
      ctx.fillStyle = "rgba(0,0,0,0.18)"; circle(ctx, cx, cy + 4, rad);
      ctx.fillStyle = this.acting ? PAL.btnDk : PAL.btn; circle(ctx, cx, cy, rad);
      ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.beginPath(); ctx.arc(cx, cy, rad, PI, PI * 2); ctx.fill();
      ctx.fillStyle = PAL.ink; ctx.textAlign = "center";
      // 👶 кнопка действия адаптируется под выбранный предмет: ребёнок видит ГЛАГОЛ по символу
      // (каст/стрельба/рыбалка иначе скрыты — большая кнопка всегда говорила «ДОБЫТЬ»)
      let _aIcon = "⛏", _aLabel = "ДОБЫТЬ";
      { const _z = G.invSel(), _it = _z && G.ITEMS[_z.item];
        if (_it && _it.spell) { _aIcon = "✨"; _aLabel = "КОЛДУЙ"; }
        else if (_z && _z.item === "bow") { _aIcon = "🏹"; _aLabel = "СТРЕЛЯЙ"; }
        else if (_z && _z.item === "fishing_rod" && this.nearWater()) { _aIcon = "🎣"; _aLabel = "ЛОВИ"; }
        else if (_it && _it.weapon) { _aIcon = "⚔"; _aLabel = "БЕЙ"; }
      }
      ctx.font = G.f(42); ctx.fillText(_aIcon, cx, cy - 6);
      ctx.font = G.f(15, "900"); ctx.fillText(_aLabel, cx, cy + 26);

      this.drawNextGoal(ctx);
      this.drawGoalBeacon(ctx);
      this.drawHotbar(ctx);
    },
    drawNextGoal(ctx) {
      let icon = "🎯", txt, done = false;
      if (G.state.story) {
        let ch = null; for (const c of STORY) if (!c.done()) { ch = c; break; }
        if (ch) { icon = ch.icon || "📖"; txt = ch.t; } else { icon = "🏆"; txt = "История пройдена — играй дальше!"; done = true; }
      } else {
        let g = null; for (const q of QUESTS) if (!q.done()) { g = q; break; }
        if (g) { icon = g.icon; txt = g.text; } else { icon = "🏆"; txt = "Основы пройдены — стройся и исследуй!"; done = true; }
      }
      // 👶 для не-читающего 6-летки: крупная пульсирующая ИКОНКА слева, текст — для тех, кто читает
      ctx.textBaseline = "middle";
      const iconF = G.f(28), txtF = G.f(18, "bold"), gap = 9, pad = 15;
      ctx.font = txtF; const tw = ctx.measureText(txt).width;
      ctx.font = iconF; const iw = ctx.measureText(icon).width;
      const bw = pad * 2 + iw + gap + tw, x0 = VIEW.w / 2 - bw / 2, y = 84, h = 38;
      ctx.fillStyle = PAL.panel; rr(ctx, x0, y, bw, h, 11); ctx.fill();
      const pulse = done ? 1 : 1 + 0.08 * Math.sin(G.time * 4);   // лёгкая пульсация = «смотри сюда»
      ctx.save(); ctx.translate(x0 + pad + iw / 2, y + h / 2); ctx.scale(pulse, pulse);
      ctx.font = iconF; ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.fillText(icon, 0, 1); ctx.restore();
      ctx.textAlign = "left"; ctx.font = txtF; ctx.fillStyle = done ? "#ffce4a" : "#fff"; ctx.fillText(txt, x0 + pad + iw + gap, y + h / 2 + 1);
      ctx.textAlign = "center";
      if (this._goalFlash > 0) { ctx.globalAlpha = clamp(this._goalFlash, 0, 1); ctx.fillStyle = "#7CFC8A"; ctx.font = G.f(20, "900"); ctx.fillText("✅ Цель выполнена!", VIEW.w / 2, 130); ctx.globalAlpha = 1; }
    },
    drawGoalBeacon(ctx) {               // HUD-компас к ДАЛЁКОЙ цели (за краем экрана); ближние ведёт плавающая стрелка drawGoalPointer
      if (this._goalFlash > 0) return;            // не накладываться на «✅ Цель выполнена!»
      const t = this.goalTarget(); if (!t || !t.icon) return;
      const sx = t.x - G.cam.x, sy = t.y - G.cam.y;
      if (sx > 40 && sx < VIEW.w - 40 && sy > 96 && sy < VIEW.h - 130) return;   // цель на экране — хватит стрелки над целью
      const dx = t.x - this.px, dy = t.y - this.py, d = Math.hypot(dx, dy);
      if (d < TILE * 1.5) return;                 // уже на месте
      const txt = t.icon + "  " + Math.max(1, Math.round(d / TILE)) + "м";
      ctx.font = G.f(16, "900"); ctx.textBaseline = "middle"; ctx.textAlign = "left";
      const tw = ctx.measureText(txt).width, aw = 30, pad = 13;
      const bw = pad * 2 + aw + tw, x0 = VIEW.w / 2 - bw / 2, y = 124, h = 30, ay = y + h / 2;
      ctx.fillStyle = PAL.panel; rr(ctx, x0, y, bw, h, 9); ctx.fill();
      const ps = 1 + 0.12 * Math.sin(G.time * 5);     // пульс = «иди сюда»
      ctx.save(); ctx.translate(x0 + pad + 11, ay); ctx.rotate(Math.atan2(dy, dx)); ctx.scale(ps, ps);
      ctx.fillStyle = "#7CFC8A"; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -7); ctx.lineTo(-3, 0); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.fillStyle = "#fff"; ctx.fillText(txt, x0 + pad + aw, ay + 1); ctx.textAlign = "center";
    },
    drawAbyssAmbient(ctx) {
      if (G.state.depth !== 4) return;            // 🕳 атмосфера только в глубочайшей пещере = Бездне
      const g = ctx.createRadialGradient(VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.28, VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.86);
      g.addColorStop(0, "rgba(60,20,90,0)"); g.addColorStop(1, "rgba(44,12,70,0.36)");   // фиолетовая виньетка
      ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      for (let i = 0; i < 18; i++) {              // восходящие искры пустоты (детерминированно от G.time — без мерцания)
        const x = G.ihash(i, 3, 77) * VIEW.w, spd = 13 + (i % 5) * 5;
        const y = VIEW.h + 20 - ((G.time * spd + i * 71) % (VIEW.h + 60));
        const tw = 0.45 + 0.55 * Math.abs(Math.sin(G.time * 2 + i));
        ctx.globalAlpha = 0.55 * tw; ctx.fillStyle = i % 3 === 0 ? "#d24bff" : "#7a4fb8";
        circle(ctx, x, y, 1.6 + (i % 3) * 0.7);
      }
      ctx.globalAlpha = 1;
    },
    drawAchToast(ctx) {       // 🏆 тост достижения (выезжает сверху, фанфара в update)
      if (!this._achCur) return;
      const a = this._achCur, t = this._achT, life = 2.8;
      const inP = Math.min(1, (life - t) / 0.25), alpha = t < 0.45 ? t / 0.45 : 1;
      ctx.save(); ctx.globalAlpha = alpha;
      const w = 372, h = 64, x0 = VIEW.w / 2 - w / 2, y = 150 - (1 - inP) * 34;
      ctx.fillStyle = "rgba(22,17,9,0.92)"; rr(ctx, x0, y, w, h, 13); ctx.fill();
      ctx.strokeStyle = "#ffce4a"; ctx.lineWidth = 2; rr(ctx, x0, y, w, h, 13); ctx.stroke();
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.font = G.f(34); ctx.fillText(a.ic, x0 + 16, y + h / 2 + 1);
      ctx.font = G.f(12, "900"); ctx.fillStyle = "#ffce4a"; ctx.fillText("🏆 ДОСТИЖЕНИЕ", x0 + 62, y + 19);
      ctx.font = G.f(18, "bold"); ctx.fillStyle = "#fff"; ctx.fillText(a.name, x0 + 62, y + 42);
      if (a.coins) { ctx.textAlign = "right"; ctx.font = G.f(17, "900"); ctx.fillStyle = "#ffd24a"; ctx.fillText("🪙+" + a.coins, x0 + w - 16, y + h / 2 + 1); }
      ctx.restore(); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    },

    drawHotbar(ctx) {
      ctx.textBaseline = "middle";
      for (let i = 0; i < G.HOTBAR; i++) {
        const r = this.slotRect(i), slot = G.state.inv[i], seld = (i === G.state.sel);
        ctx.fillStyle = seld ? "rgba(255,206,74,0.28)" : PAL.panel;
        rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.fill();
        ctx.lineWidth = seld ? 4 : 2;
        ctx.strokeStyle = seld ? PAL.btn : "rgba(255,255,255,0.20)";
        rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.stroke();
        if (slot) {
          const it = G.ITEMS[slot.item];
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          if (!G.blockSwatch(ctx, it, r.x + r.w / 2, r.y + r.h / 2 - 1, 20)) {
            G.tierChip(ctx, it, r.x + r.w / 2, r.y + r.h / 2 - 1, 21);
            ctx.font = G.f(34); ctx.fillStyle = "#fff";
            ctx.fillText(it ? it.icon : "?", r.x + r.w / 2, r.y + r.h / 2 - 1);
          }
          ctx.fillStyle = "#fff"; ctx.textAlign = "right"; ctx.font = G.f(17, "bold");
          ctx.fillText("" + slot.n, r.x + r.w - 7, r.y + r.h - 12);
        }
        ctx.textAlign = "left"; ctx.font = G.f(12, "bold"); ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText("" + (i + 1), r.x + 6, r.y + 11);
      }
    },

    drawCraft(ctx) {
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      const p = this.craftPanel();
      ctx.fillStyle = "rgba(30,33,44,0.98)"; rr(ctx, p.x, p.y, p.w, p.h, 18); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.15)"; rr(ctx, p.x, p.y, p.w, p.h, 18); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = G.f(28, "900"); ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText("🛠 Крафт", p.x + 26, p.y + 30);
      const cr = this.craftCloseRect();
      ctx.fillStyle = "rgba(255,255,255,0.12)"; rr(ctx, cr.x, cr.y, cr.w, cr.h, 10); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = G.f(24); ctx.textAlign = "center"; ctx.fillText("✕", cr.x + cr.w / 2, cr.y + cr.h / 2 + 1);
      for (let i = 0; i < CATS.length; i++) {                          // вкладки-категории
        const t = this.craftTabRect(i), act = (i === (this._craftTab || 0));
        ctx.fillStyle = act ? "rgba(255,206,74,0.28)" : "rgba(255,255,255,0.06)"; rr(ctx, t.x, t.y, t.w, t.h, 9); ctx.fill();
        if (act) { ctx.lineWidth = 2; ctx.strokeStyle = PAL.btn; rr(ctx, t.x, t.y, t.w, t.h, 9); ctx.stroke(); }
        ctx.fillStyle = "#fff"; ctx.font = G.f(15, "bold"); ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(CATS[i].ic + " " + CATS[i].name, t.x + t.w / 2, t.y + t.h / 2 + 1);
      }
      const list = this.craftPageList();
      for (let i = 0; i < list.length; i++) this.drawCraftCard(ctx, list[i], this.craftCardRect(i));
      if (this.craftPages() > 1) {                                    // ◀ страница X/Y ▶
        const pg = this._craftPage || 0, pr = this.craftPrevRect(), nr = this.craftNextRect(), last = this.craftPages() - 1;
        ctx.fillStyle = pg > 0 ? PAL.btn : "rgba(255,255,255,0.10)"; rr(ctx, pr.x, pr.y, pr.w, pr.h, 9); ctx.fill();
        ctx.fillStyle = pg < last ? PAL.btn : "rgba(255,255,255,0.10)"; rr(ctx, nr.x, nr.y, nr.w, nr.h, 9); ctx.fill();
        ctx.fillStyle = "#26200c"; ctx.font = G.f(20, "900"); ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("◀", pr.x + pr.w / 2, pr.y + pr.h / 2 + 1); ctx.fillText("▶", nr.x + nr.w / 2, nr.y + nr.h / 2 + 1);
        ctx.fillStyle = "#fff"; ctx.font = G.f(18, "900"); ctx.fillText((pg + 1) + " / " + this.craftPages(), p.x + p.w / 2, pr.y + pr.h / 2 + 1);
      }
    },
    drawCraftCard(ctx, r, c) {
      const stationOk = !r.station || this.nearFurnace();
      const can = stationOk && G.canCraft(r), out = G.ITEMS[r.out];
      ctx.fillStyle = can ? "rgba(106,190,69,0.20)" : "rgba(255,255,255,0.05)";
      rr(ctx, c.x, c.y, c.w, c.h, 12); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = can ? PAL.green : "rgba(255,255,255,0.12)";
      rr(ctx, c.x, c.y, c.w, c.h, 12); ctx.stroke();
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (!G.blockSwatch(ctx, out, c.x + c.w / 2, c.y + 38, 24)) {                   // 🧱 реальный блок / 🎨 чип тира / эмодзи
        G.tierChip(ctx, out, c.x + c.w / 2, c.y + 38, 25);
        ctx.fillStyle = "#fff"; ctx.font = G.f(38); ctx.fillText(out ? out.icon : "?", c.x + c.w / 2, c.y + 38);
      }
      ctx.font = G.f(13, "bold"); ctx.fillText((out ? out.name : r.out) + (r.n > 1 ? " ×" + r.n : ""), c.x + c.w / 2, c.y + 68);
      ctx.font = G.f(16); let iy = c.y + 92;
      for (const pr of r.in) {
        const id = pr[0], cnt = pr[1], have = G.invCount(id), ok = have >= cnt, it = G.ITEMS[id];
        ctx.fillStyle = ok ? "#cfe9c0" : "#ff9b9b";
        ctx.fillText((it ? it.icon : id) + " " + cnt + " (" + have + ")", c.x + c.w / 2, iy);
        iy += 18;
      }
      ctx.font = G.f(13, "900"); ctx.fillStyle = can ? PAL.green : "rgba(255,255,255,0.42)";
      const label = can ? "ТАП — сделать" : (!stationOk ? "нужна 🔥 печь" : (r.once && G.invCount(r.out) > 0 ? "есть" : "не хватает"));
      ctx.fillText(label, c.x + c.w / 2, c.y + c.h - 12);
    },

    // --- рюкзак: хотбар (рука) + хранилище; тап по предмету в рюкзаке = взять в руку ---
    invPanel() { const w = 720, h = 380; return { x: (VIEW.w - w) / 2, y: (VIEW.h - h) / 2, w: w, h: h }; },
    invCloseRect() { const p = this.invPanel(); return { x: p.x + p.w - 52, y: p.y + 12, w: 40, h: 40 }; },
    invSlotRect(i) {
      const p = this.invPanel(), sw = 72, gap = 10, cols = 8;
      const x0 = p.x + (p.w - (cols * sw + (cols - 1) * gap)) / 2;
      const col = i % cols, row = (i / cols) | 0;
      const y0 = p.y + 84 + (row === 0 ? 0 : 16); // зазор между рукой и рюкзаком
      return { x: x0 + col * (sw + gap), y: y0 + row * (sw + 12), w: sw, h: sw };
    },
    invTap(x, y) {
      if (rectHit(this.invCloseRect(), x, y)) { this._invOpen = false; G.audio.blip(); return; }
      for (let i = 0; i < G.INV_SIZE; i++) if (rectHit(this.invSlotRect(i), x, y)) {
        if (i < G.HOTBAR) G.state.sel = i;                                 // выбрать слот руки
        else { const t = G.state.inv[i]; G.state.inv[i] = G.state.inv[G.state.sel]; G.state.inv[G.state.sel] = t; } // в руку
        G.audio.blip(); return;
      }
      if (!rectHit(this.invPanel(), x, y)) this._invOpen = false;
    },

    // --- сундук: хранилище предметов (16 слотов на тайл) ---
    openChest(tx, ty) {
      this._chestKey = G.state.depth + "," + tx + "," + ty;
      if (!G.state.chests[this._chestKey]) G.state.chests[this._chestKey] = new Array(16).fill(null);
      this._chestOpen = true; this._invOpen = false; this._craftOpen = false; G.audio.blip();
    },
    chestPanel() { const w = 760, h = 490; return { x: (VIEW.w - w) / 2, y: (VIEW.h - h) / 2, w: w, h: h }; },
    chestCloseRect() { const p = this.chestPanel(); return { x: p.x + p.w - 52, y: p.y + 12, w: 40, h: 40 }; },
    chestSlotRect(i, where) {
      const p = this.chestPanel(), sw = 58, gap = 9, cols = 8;
      const x0 = p.x + (p.w - (cols * sw + (cols - 1) * gap)) / 2;
      const col = i % cols, row = (i / cols) | 0;
      const y0 = (where === "box" ? p.y + 72 : p.y + 72 + 2 * (sw + 10) + 50);
      return { x: x0 + col * (sw + gap), y: y0 + row * (sw + 10), w: sw, h: sw };
    },
    chestStash(s) {   // положить стак в сундук (стак или пустой слот)
      const box = G.state.chests[this._chestKey], it = G.ITEMS[s.item], max = (it && it.stack) || 99;
      for (let i = 0; i < 16; i++) { const c = box[i]; if (c && c.item === s.item && c.n < max) { const mv = Math.min(max - c.n, s.n); c.n += mv; s.n -= mv; if (s.n <= 0) return true; } }
      for (let i = 0; i < 16; i++) if (!box[i]) { box[i] = { item: s.item, n: s.n }; s.n = 0; return true; }
      return s.n <= 0;
    },
    chestTap(x, y) {
      if (rectHit(this.chestCloseRect(), x, y)) { this._chestOpen = false; G.audio.blip(); return; }
      const box = G.state.chests[this._chestKey]; if (!box) { this._chestOpen = false; return; }
      for (let i = 0; i < 16; i++) if (rectHit(this.chestSlotRect(i, "box"), x, y)) {     // сундук → рюкзак
        const c = box[i]; if (c && G.invAdd(c.item, c.n)) { box[i] = null; G.audio.pickup(); } else if (c) G.audio.blip();
        return;
      }
      for (let i = 0; i < G.INV_SIZE; i++) if (rectHit(this.chestSlotRect(i, "inv"), x, y)) { // рюкзак → сундук
        const s = G.state.inv[i]; if (s && this.chestStash(s)) { G.state.inv[i] = null; G.audio.pickup(); } else if (s) G.audio.blip();
        return;
      }
      if (!rectHit(this.chestPanel(), x, y)) this._chestOpen = false;
    },
    drawChest(ctx) {
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      const p = this.chestPanel();
      ctx.fillStyle = "rgba(30,33,44,0.98)"; rr(ctx, p.x, p.y, p.w, p.h, 18); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.15)"; rr(ctx, p.x, p.y, p.w, p.h, 18); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = G.f(28, "900"); ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText("📦 Сундук", p.x + 26, p.y + 38);
      ctx.font = G.f(14); ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText("тапни предмет — переложить между сундуком и рюкзаком", p.x + 210, p.y + 38);
      const cr = this.chestCloseRect();
      ctx.fillStyle = "rgba(255,255,255,0.12)"; rr(ctx, cr.x, cr.y, cr.w, cr.h, 10); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = G.f(24); ctx.textAlign = "center"; ctx.fillText("✕", cr.x + cr.w / 2, cr.y + cr.h / 2 + 1);
      const box = G.state.chests[this._chestKey] || [];
      const cell = (r, c, sel) => {
        ctx.fillStyle = "rgba(255,255,255,0.07)"; rr(ctx, r.x, r.y, r.w, r.h, 8); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = sel ? PAL.btn : "rgba(255,255,255,0.16)"; rr(ctx, r.x, r.y, r.w, r.h, 8); ctx.stroke();
        if (c) { const it = G.ITEMS[c.item]; ctx.textAlign = "center"; ctx.textBaseline = "middle"; if (!G.blockSwatch(ctx, it, r.x + r.w / 2, r.y + r.h / 2 - 1, 17)) { G.tierChip(ctx, it, r.x + r.w / 2, r.y + r.h / 2 - 1, 18); ctx.font = G.f(28); ctx.fillStyle = "#fff"; ctx.fillText(it ? it.icon : "?", r.x + r.w / 2, r.y + r.h / 2 - 1); } ctx.fillStyle = "#fff"; ctx.textAlign = "right"; ctx.font = G.f(14, "bold"); ctx.fillText("" + c.n, r.x + r.w - 5, r.y + r.h - 8); }
      };
      for (let i = 0; i < 16; i++) cell(this.chestSlotRect(i, "box"), box[i], false);
      const ir0 = this.chestSlotRect(0, "inv");
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.font = G.f(15, "bold"); ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText("🎒 Рюкзак", ir0.x, ir0.y - 8);
      for (let i = 0; i < G.INV_SIZE; i++) cell(this.chestSlotRect(i, "inv"), G.state.inv[i], i === G.state.sel);
    },
    drawInv(ctx) {
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      const p = this.invPanel();
      ctx.fillStyle = "rgba(30,33,44,0.98)"; rr(ctx, p.x, p.y, p.w, p.h, 18); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.15)"; rr(ctx, p.x, p.y, p.w, p.h, 18); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = G.f(30, "900"); ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText("🎒 Рюкзак", p.x + 26, p.y + 40);
      ctx.font = G.f(15); ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText("верхний ряд — рука · тапни предмет в рюкзаке, чтобы взять в руку", p.x + 188, p.y + 40);
      const cr = this.invCloseRect();
      ctx.fillStyle = "rgba(255,255,255,0.12)"; rr(ctx, cr.x, cr.y, cr.w, cr.h, 10); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = G.f(24); ctx.textAlign = "center"; ctx.fillText("✕", cr.x + cr.w / 2, cr.y + cr.h / 2 + 1);
      for (let i = 0; i < G.INV_SIZE; i++) {
        const r = this.invSlotRect(i), slot = G.state.inv[i], sel = (i === G.state.sel), hot = i < G.HOTBAR;
        ctx.fillStyle = sel ? "rgba(255,206,74,0.28)" : (hot ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)");
        rr(ctx, r.x, r.y, r.w, r.h, 9); ctx.fill();
        ctx.lineWidth = sel ? 4 : 2; ctx.strokeStyle = sel ? PAL.btn : "rgba(255,255,255,0.16)";
        rr(ctx, r.x, r.y, r.w, r.h, 9); ctx.stroke();
        if (slot) {
          const it = G.ITEMS[slot.item];
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          if (!G.blockSwatch(ctx, it, r.x + r.w / 2, r.y + r.h / 2 - 1, 20)) {
            G.tierChip(ctx, it, r.x + r.w / 2, r.y + r.h / 2 - 1, 21);
            ctx.font = G.f(34); ctx.fillStyle = "#fff";
            ctx.fillText(it ? it.icon : "?", r.x + r.w / 2, r.y + r.h / 2 - 1);
          }
          ctx.fillStyle = "#fff"; ctx.textAlign = "right"; ctx.font = G.f(16, "bold");
          ctx.fillText("" + slot.n, r.x + r.w - 6, r.y + r.h - 11);
        }
      }
      // 🏷 название выбранного предмета (тапни слот → видно, что это; для не-читающего — иконка крупно + имя)
      const selSlot = G.state.inv[G.state.sel], selIt = selSlot && G.ITEMS[selSlot.item];
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = G.f(20, "900");
      ctx.fillStyle = selIt ? "#ffce4a" : "rgba(255,255,255,0.4)";
      ctx.fillText(selIt ? (selIt.icon + "  " + selIt.name) : "— тапни предмет, чтобы взять и узнать название —", p.x + p.w / 2, p.y + p.h - 24);
    },

    drawHint(ctx) {
      ctx.globalAlpha = clamp(9 - this._t, 0, 1);
      const txt = "Держи ⛏ — копать/бить · 🛠 — крафт · тапни клетку — строить · ночью выходят мобы";
      ctx.font = G.f(21, "bold"); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const w = ctx.measureText(txt).width + 36;
      ctx.fillStyle = PAL.panel; rr(ctx, VIEW.w / 2 - w / 2, VIEW.h - 150, w, 40, 12); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillText(txt, VIEW.w / 2, VIEW.h - 130);
      ctx.globalAlpha = 1;
    },

    drawBanner(ctx, txt) {
      ctx.globalAlpha = clamp(this._deadMsg, 0, 1);
      ctx.font = G.f(30, "900"); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const w = ctx.measureText(txt).width + 48;
      ctx.fillStyle = "rgba(20,22,30,0.88)"; rr(ctx, VIEW.w / 2 - w / 2, VIEW.h / 2 - 34, w, 60, 14); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillText(txt, VIEW.w / 2, VIEW.h / 2 - 2);
      ctx.globalAlpha = 1;
    },
  };
  G.addScene("world", world);

  /* ========================= ПОБЕДА (финал сюжета) ========================= */
  const vPlay = { x: VIEW.w / 2 - 150, y: 470, w: 300, h: 60 };
  const vMenu = { x: VIEW.w / 2 - 150, y: 544, w: 300, h: 52 };
  G.addScene("victory", {
    enter() { this._t = 0; G.state.story = false; }, // сюжет пройден → дальше свободная игра
    update(dt) { this._t = (this._t || 0) + dt; },
    onTap(x, y) {
      if (rectHit(vPlay, x, y)) { G.audio.blip(); G.go("world"); }
      else if (rectHit(vMenu, x, y)) { G.audio.blip(); G.go("menu"); }
    },
    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, VIEW.h);
      g.addColorStop(0, "#241b3a"); g.addColorStop(1, "#3a2e5e");
      ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      for (let i = 0; i < 70; i++) { ctx.fillStyle = "rgba(200,180,255," + (0.25 + 0.5 * (((i * 7) % 5) / 5)) + ")"; ctx.fillRect((i * 137) % VIEW.w, (i * 89) % 430, 2, 2); }
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = G.f(64, "900"); ctx.fillStyle = "#ffce4a"; ctx.fillText(G.state.abyssDefeated ? "🏆 ЛЕГЕНДА!" : "🏆 ПОБЕДА!", VIEW.w / 2, 170);
      ctx.font = G.f(23, "bold"); ctx.fillStyle = "#fff"; ctx.fillText(G.state.abyssDefeated ? "Король повержен, Повелитель Бездны запечатан — ты спас оба мира!" : "Ты прошёл Мир Призраков и спас остров!", VIEW.w / 2, 244);
      ctx.font = G.f(18); ctx.fillStyle = "#cfc2f0"; ctx.fillText("Свободная игра продолжается — строй и исследуй дальше.", VIEW.w / 2, 282);
      ctx.save(); ctx.translate(VIEW.w / 2, 384); ctx.scale(2, 2); G.drawSteve(ctx, 0, 0, 1, 0, 0); ctx.restore();
      drawButton(ctx, vPlay, "▶ Играть дальше", PAL.btn);
      drawButton(ctx, vMenu, "В меню", "#e8e8ee", true);
    },
  });
})();
