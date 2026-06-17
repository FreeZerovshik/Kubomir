/* ============================================================
   КУБОМИР — предметы и инвентарь (data-driven).
   ITEMS: материалы + ставящиеся блоки (place). Инвентарь = слоты хотбара.
   Крафт/верстак/печь добавятся сюда (RECIPES) в Фазе 3.
   ============================================================ */
(function () {
  "use strict";
  const G = window.G;

  // place: id блока из World.BLOCKS, который ставится этим предметом
  const ITEMS = {
    wood:  { id: "wood",  name: "Дерево", icon: "🪵", stack: 64, place: "woodblock" },
    stone: { id: "stone", name: "Камень", icon: "🪨", stack: 64, place: "stonebrick" },
    coal:  { id: "coal",  name: "Уголь",  icon: "⚫", stack: 64 },
    iron:  { id: "iron",  name: "Железо", icon: "🔩", stack: 64 },
    berry: { id: "berry", name: "Ягоды",  icon: "🍒", stack: 64, food: 6 },
    plank: { id: "plank", name: "Доски",  icon: "🟫", stack: 64, place: "woodblock" },
    stick: { id: "stick", name: "Палки",  icon: "🥢", stack: 64 },
    pick_wood:  { id: "pick_wood",  name: "Деревянная кирка", icon: "⛏", stack: 1, tool: "pick", power: 2 },
    pick_stone: { id: "pick_stone", name: "Каменная кирка",   icon: "⛏", stack: 1, tool: "pick", power: 4 },
    pick_iron:  { id: "pick_iron",  name: "Железная кирка",   icon: "⛏", stack: 1, tool: "pick", power: 6 },
    sword_wood:  { id: "sword_wood",  name: "Деревянный меч", icon: "🗡", stack: 1, weapon: 3 },
    sword_stone: { id: "sword_stone", name: "Каменный меч",   icon: "🗡", stack: 1, weapon: 4 },
    sword_iron:  { id: "sword_iron",  name: "Железный меч",   icon: "⚔", stack: 1, weapon: 6 },
    shield_wood: { id: "shield_wood", name: "Деревянный щит", icon: "🛡", stack: 1, shield: 0.3 },
    shield_iron: { id: "shield_iron", name: "Железный щит",   icon: "🛡", stack: 1, shield: 0.5 },
    ingot:   { id: "ingot",   name: "Слиток железа", icon: "⛓", stack: 64 },
    furnace: { id: "furnace", name: "Печь",          icon: "🔥", stack: 64, place: "furnace" },
    torch:   { id: "torch",   name: "Факел",         icon: "🕯", stack: 64, place: "torch" },
    gold:    { id: "gold",    name: "Золото",        icon: "🟡", stack: 64, place: "gold_block" },
    diamond: { id: "diamond", name: "Алмаз",         icon: "💎", stack: 64 },
    pick_diamond:  { id: "pick_diamond",  name: "Алмазная кирка", icon: "⛏", stack: 1, tool: "pick", power: 9 },
    sword_diamond: { id: "sword_diamond", name: "Алмазный меч",   icon: "⚔", stack: 1, weapon: 8 },
    emerald:       { id: "emerald",       name: "Изумруд",        icon: "💚", stack: 64 },
    pick_emerald:  { id: "pick_emerald",  name: "Изумрудная кирка", icon: "⛏", stack: 1, tool: "pick", power: 12 },
    sword_emerald: { id: "sword_emerald", name: "Изумрудный меч",   icon: "⚔", stack: 1, weapon: 11 },
    ember:    { id: "ember",    name: "Эмбер",     icon: "🟠", stack: 64 },                                          // 🌋 материал вулкана (из руды эмбера)
    obsidian: { id: "obsidian", name: "Обсидиан",  icon: "⬛", stack: 64, place: "obsidian" },                       // тёмный камень — материал + строительный блок
    sword_obsidian: { id: "sword_obsidian", name: "Обсидиановый меч", icon: "⚔", stack: 1, weapon: 10 },             // 🌋 сильный меч из вулкана (альтернатива алмазному пути)
    magma_core: { id: "magma_core", name: "Сердце вулкана", icon: "🔆", stack: 64 },                                  // 🌋 трофей с Магма-стража
    pick_obsidian: { id: "pick_obsidian", name: "Обсидиановая кирка", icon: "⛏", stack: 1, tool: "pick", power: 11 }, // завершает обсидиановый сет
    sword_fire:    { id: "sword_fire",    name: "Огненный меч",     icon: "🔥", stack: 1, weapon: 9, elem: "fire" },
    sword_frost:   { id: "sword_frost",   name: "Ледяной меч",      icon: "❄", stack: 1, weapon: 9, elem: "frost" },
    mushroom:      { id: "mushroom",      name: "Гриб",           icon: "🍄", stack: 64, food: 3 },
    mushroom_stew: { id: "mushroom_stew", name: "Грибной суп",    icon: "🍲", stack: 64, food: 8 },
    meat:        { id: "meat",        name: "Мясо",         icon: "🥩", stack: 64, food: 3 },
    cooked_meat: { id: "cooked_meat", name: "Жареное мясо", icon: "🍗", stack: 64, food: 8 },
    clay:  { id: "clay",  name: "Глина",   icon: "🟤", stack: 64 },
    sand:  { id: "sand",  name: "Песок",   icon: "🟨", stack: 64 },
    brick: { id: "brick", name: "Кирпич",  icon: "🧱", stack: 64, place: "brick_block" },
    glass: { id: "glass", name: "Стекло",  icon: "🔲", stack: 64, place: "glass_block" },
    wool:  { id: "wool",  name: "Шерсть",  icon: "☁", stack: 64, place: "wool_block" },
    bed:   { id: "bed",   name: "Кровать", icon: "🛏", stack: 5, place: "bed" },
    seeds: { id: "seeds", name: "Семена",  icon: "🌱", stack: 64 },
    wheat: { id: "wheat", name: "Пшеница", icon: "🌾", stack: 64 },
    bread: { id: "bread", name: "Хлеб",    icon: "🍞", stack: 64, food: 6 },
    cookie:{ id: "cookie",name: "Печенье", icon: "🍪", stack: 64, food: 3 },
    pie:   { id: "pie",   name: "Пирог",   icon: "🥧", stack: 64, food: 12 },
    compass: { id: "compass", name: "Компас", icon: "🧭", stack: 1 },
    ghost_shard: { id: "ghost_shard", name: "Осколок духа", icon: "🔮", stack: 64 },
    portal:      { id: "portal", name: "Портал", icon: "🌀", stack: 9, place: "portal" },
    astral_block:{ id: "astral_block", name: "Эфир-камень", icon: "🟪", stack: 64, place: "astral_block" },
    helmet_iron:    { id: "helmet_iron",    name: "Шлем",          icon: "⛑", stack: 1, armor: 0.12 },
    chest_iron:     { id: "chest_iron",     name: "Нагрудник",     icon: "🦺", stack: 1, armor: 0.20 },
    boots_iron:     { id: "boots_iron",     name: "Ботинки",       icon: "🥾", stack: 1, armor: 0.08 },
    helmet_diamond: { id: "helmet_diamond", name: "Алм. шлем",     icon: "⛑", stack: 1, armor: 0.18 },
    chest_diamond:  { id: "chest_diamond",  name: "Алм. нагрудник", icon: "🦺", stack: 1, armor: 0.30 },
    boots_diamond:  { id: "boots_diamond",  name: "Алм. ботинки",  icon: "🥾", stack: 1, armor: 0.12 },
    bow:   { id: "bow",   name: "Лук",    icon: "🏹", stack: 1 },
    arrow: { id: "arrow", name: "Стрела", icon: "🪶", stack: 64 },
    pet:   { id: "pet",   name: "Львёнок Лев", icon: "🦁", stack: 1 },
    fishing_rod: { id: "fishing_rod", name: "Удочка", icon: "🎣", stack: 1 },
    fish:  { id: "fish",  name: "Рыба",   icon: "🐟", stack: 64, food: 5 },
    chest: { id: "chest", name: "Сундук", icon: "📦", stack: 9, place: "chest" },
    crown: { id: "crown", name: "Корона Короля", icon: "👑", stack: 9 },
    key:   { id: "key",   name: "Ключ Храма",   icon: "🗝", stack: 9 },
    heart_relic: { id: "heart_relic", name: "Сердце Храма", icon: "💗", stack: 9 },
    bucket: { id: "bucket", name: "Ведро", icon: "🪣", stack: 16 },
    water_bucket: { id: "water_bucket", name: "Ведро воды", icon: "💧", stack: 16 },
    boat: { id: "boat", name: "Лодка", icon: "⛵", stack: 1 },
    door: { id: "door", name: "Дверь", icon: "🚪", stack: 16, place: "door" },
    potion_heal:  { id: "potion_heal",  name: "Зелье лечения", icon: "❤", stack: 8, potion: "heal", pcolor: "#ff5d6c" },
    potion_speed: { id: "potion_speed", name: "Зелье скорости", icon: "💨", stack: 8, potion: "speed", pcolor: "#5ac8ff" },
    potion_str:   { id: "potion_str",   name: "Зелье силы",   icon: "💪", stack: 8, potion: "strength", pcolor: "#ffae5a" },
    tome_fire:  { id: "tome_fire",  name: "Том Огня",    icon: "🔥", stack: 1, spell: "fire",  mana: 3 },
    tome_frost: { id: "tome_frost", name: "Том Льда",    icon: "❄", stack: 1, spell: "frost", mana: 3 },
    tome_bolt:  { id: "tome_bolt",  name: "Том Молнии",  icon: "⚡", stack: 1, spell: "bolt",  mana: 5 },
    tome_heal:  { id: "tome_heal",  name: "Том Лечения", icon: "💖", stack: 1, spell: "heal",  mana: 4 },
    lever:   { id: "lever",   name: "Рычаг", icon: "🎚", stack: 16, place: "lever" },
    redlamp: { id: "redlamp", name: "Лампа", icon: "💡", stack: 16, place: "redlamp" },
    rail:    { id: "rail",    name: "Рельсы", icon: "🛤", stack: 32, place: "rail" },
  };
  G.ITEMS = ITEMS;
  G.HOTBAR = 8;       // видимые слоты-хотбар внизу
  G.INV_SIZE = 24;    // всего слотов (хотбар + рюкзак 16)

  // Добавить n предметов: сперва в существующий стек, иначе в пустой слот. false если полно.
  G.invAdd = function (itemId, n) {
    n = n || 1; const inv = G.state.inv, it = G.ITEMS[itemId], cap = (it && it.stack) || 64;   // лимит стопки (как в Minecraft, обычно 64)
    for (let i = 0; i < inv.length && n > 0; i++) { const s = inv[i]; if (s && s.item === itemId && s.n < cap) { const add = Math.min(n, cap - s.n); s.n += add; n -= add; } } // докинуть в существующие
    for (let i = 0; i < inv.length && n > 0; i++) if (!inv[i]) { const add = Math.min(n, cap); inv[i] = { item: itemId, n: add }; n -= add; } // новые стопки ≤ cap
    return n <= 0;   // false — не всё влезло (рюкзак полон)
  };
  G.invSel = function () { return G.state.inv[G.state.sel] || null; };
  G.invConsume = function (n) {
    n = n || 1; const s = G.state.inv[G.state.sel]; if (!s) return false;
    s.n -= n; if (s.n <= 0) G.state.inv[G.state.sel] = null; return true;
  };
  G.invCount = (id) => G.state.inv.reduce((s, slot) => s + (slot && slot.item === id ? slot.n : 0), 0);
  G.invRemove = function (id, c) {
    const inv = G.state.inv;
    for (let i = 0; i < inv.length && c > 0; i++) { const s = inv[i]; if (s && s.item === id) { const t = Math.min(s.n, c); s.n -= t; c -= t; if (s.n <= 0) inv[i] = null; } }
    return c <= 0;
  };

  // РЕЦЕПТЫ (Strategy via data). once:true — нельзя крафтить, если предмет уже есть (инструменты).
  const RECIPES = [
    { out: "plank", n: 4, in: [["wood", 1]] },
    { out: "stick", n: 4, in: [["plank", 2]] },
    { out: "torch", n: 4, in: [["coal", 1], ["stick", 1]] },
    { out: "furnace", n: 1, in: [["stone", 8]] },
    { out: "ingot", n: 1, station: "furnace", in: [["iron", 1], ["coal", 1]] }, // плавка у печи
    { out: "pick_wood",  n: 1, once: true, in: [["plank", 3], ["stick", 2]] },
    { out: "pick_stone", n: 1, once: true, in: [["stone", 3], ["stick", 2]] },
    { out: "pick_iron",  n: 1, once: true, in: [["ingot", 3], ["stick", 2]] },
    { out: "sword_wood",  n: 1, once: true, in: [["plank", 2], ["stick", 1]] },
    { out: "sword_stone", n: 1, once: true, in: [["stone", 2], ["stick", 1]] },
    { out: "sword_iron",  n: 1, once: true, in: [["ingot", 2], ["stick", 1]] },
    { out: "shield_wood", n: 1, once: true, in: [["plank", 6]] },
    { out: "shield_iron", n: 1, once: true, in: [["ingot", 5]] },
    { out: "pick_diamond",  n: 1, once: true, in: [["diamond", 3], ["stick", 2]] },
    { out: "sword_diamond", n: 1, once: true, in: [["diamond", 2], ["stick", 1]] },
    { out: "pick_emerald",  n: 1, once: true, cat: "tools", in: [["emerald", 3], ["stick", 2]] },
    { out: "sword_emerald", n: 1, once: true, cat: "tools", in: [["emerald", 2], ["stick", 1]] },
    { out: "sword_obsidian", n: 1, once: true, cat: "tools", in: [["obsidian", 2], ["ember", 2], ["stick", 1]] },  // 🌋 меч вулкана
    { out: "pick_obsidian",  n: 1, once: true, cat: "tools", in: [["obsidian", 3], ["magma_core", 1]] },          // 🌋 награда за Магма-стража
    { out: "sword_fire",  n: 1, once: true, cat: "tools", in: [["sword_diamond", 1], ["coal", 4]] },          // 🔥 зачарование огнём
    { out: "sword_frost", n: 1, once: true, cat: "tools", in: [["sword_diamond", 1], ["ghost_shard", 2]] },   // ❄ зачарование льдом
    { out: "mushroom_stew", n: 1, cat: "food", in: [["mushroom", 2]] },
    { out: "cooked_meat", n: 1, station: "furnace", in: [["meat", 1]] },
    { out: "brick", n: 1, station: "furnace", in: [["clay", 1]] },  // обжиг глины
    { out: "glass", n: 1, station: "furnace", in: [["sand", 1]] },  // плавка песка
    { out: "bed",   n: 1, in: [["wool", 3], ["plank", 3]] },        // кровать — пропуск ночи
    { out: "bread",   n: 1, cat: "food", in: [["wheat", 3]] },
    { out: "cookie",  n: 4, cat: "food", in: [["wheat", 2]] },
    { out: "pie",     n: 1, cat: "food", in: [["wheat", 3], ["berry", 2]] },
    { out: "compass", n: 1, once: true, cat: "tools", in: [["ingot", 4]] },
    { out: "portal", n: 1, cat: "build", in: [["ghost_shard", 4], ["stone", 4]] },  // врата в Мир Призраков
    { out: "helmet_iron",    n: 1, once: true, cat: "tools", in: [["ingot", 3]] },
    { out: "chest_iron",     n: 1, once: true, cat: "tools", in: [["ingot", 5]] },
    { out: "boots_iron",     n: 1, once: true, cat: "tools", in: [["ingot", 2]] },
    { out: "helmet_diamond", n: 1, once: true, cat: "tools", in: [["diamond", 2]] },
    { out: "chest_diamond",  n: 1, once: true, cat: "tools", in: [["diamond", 3]] },
    { out: "boots_diamond",  n: 1, once: true, cat: "tools", in: [["diamond", 2]] },
    { out: "bow",   n: 1, once: true, cat: "tools", in: [["stick", 3], ["wool", 3]] },
    { out: "arrow", n: 4, cat: "tools", in: [["stick", 1], ["stone", 1]] },
    { out: "pet",   n: 1, once: true, cat: "tools", in: [["meat", 3], ["wool", 2], ["ingot", 1]] },
    { out: "fishing_rod", n: 1, once: true, cat: "tools", in: [["stick", 3], ["wool", 2]] },
    { out: "chest", n: 1, cat: "build", in: [["plank", 6]] },
    { out: "bucket", n: 1, cat: "tools", in: [["ingot", 3]] },
    { out: "boat",  n: 1, cat: "tools", in: [["plank", 5]] },
    { out: "door",  n: 1, cat: "build", in: [["plank", 6]] },
    { out: "potion_heal",  n: 1, cat: "potion", in: [["berry", 3], ["ghost_shard", 1]] },
    { out: "potion_speed", n: 1, cat: "potion", in: [["wheat", 2], ["coal", 1]] },
    { out: "potion_str",   n: 1, cat: "potion", in: [["iron", 2], ["ghost_shard", 1]] },
    { out: "tome_fire",  n: 1, once: true, cat: "potion", in: [["ghost_shard", 2], ["coal", 2]] },
    { out: "tome_frost", n: 1, once: true, cat: "potion", in: [["ghost_shard", 2], ["diamond", 1]] },
    { out: "tome_bolt",  n: 1, once: true, cat: "potion", in: [["ghost_shard", 3], ["gold", 2]] },
    { out: "tome_heal",  n: 1, once: true, cat: "potion", in: [["ghost_shard", 2], ["berry", 3]] },
    { out: "lever",   n: 1, cat: "build", in: [["stick", 1], ["stone", 1]] },
    { out: "redlamp", n: 1, cat: "build", in: [["iron", 1], ["coal", 2]] },
    { out: "rail",    n: 4, cat: "build", in: [["ingot", 1]] },
  ];
  G.RECIPES = RECIPES;
  // категории статичных рецептов (для вкладок крафта)
  const CAT_OF = {
    plank: "base", stick: "base", torch: "base", furnace: "base", ingot: "base",
    pick_wood: "tools", pick_stone: "tools", pick_iron: "tools", pick_diamond: "tools",
    sword_wood: "tools", sword_stone: "tools", sword_iron: "tools", sword_diamond: "tools", shield_wood: "tools", shield_iron: "tools",
    cooked_meat: "food", brick: "build", glass: "build", bed: "build",
  };
  RECIPES.forEach((r) => { if (!r.cat) r.cat = CAT_OF[r.out] || "base"; });
  // === Генерим МНОГО рецептов из данных: красители + цветная шерсть/стекло + стройматериалы ===
  const DYE_ICON = { red: "🟥", orange: "🟧", yellow: "🟨", green: "🟩", blue: "🟦", purple: "🟪", white: "⬜", black: "⬛" };
  const BUILD_ICON = { cobblestone: "🪨", stone_bricks: "🧱", mossy_bricks: "🧱", smooth_stone: "🪨", chiseled_stone: "🪨", sandstone: "🟨", dark_planks: "🟫", bookshelf: "📚", fence: "🪵", lamp: "💡" };
  for (const c in (G.DYE || {})) {
    ITEMS["dye_" + c] = { id: "dye_" + c, name: "Краситель", icon: DYE_ICON[c] || "🎨", stack: 64 };
    ITEMS["wool_" + c] = { id: "wool_" + c, name: "Цв. шерсть", icon: DYE_ICON[c] || "☁", stack: 64, place: "wool_" + c };
    ITEMS["glass_" + c] = { id: "glass_" + c, name: "Цв. стекло", icon: DYE_ICON[c] || "🔲", stack: 64, place: "glass_" + c };
    RECIPES.push({ out: "wool_" + c, n: 1, cat: "color", in: [["wool", 1], ["dye_" + c, 1]] });
    RECIPES.push({ out: "glass_" + c, n: 1, cat: "color", in: [["glass", 1], ["dye_" + c, 1]] });
  }
  for (const b of (G.BUILD_SPEC || [])) {
    ITEMS[b.id] = { id: b.id, name: b.name, icon: BUILD_ICON[b.id] || "🧱", stack: 64, place: b.id };
    RECIPES.push({ out: b.id, n: b.id === "stone_bricks" ? 4 : 1, cat: "build", station: b.station, in: b.rec });
  }
  G.canCraft = (r) => (!r.once || G.invCount(r.out) === 0) && r.in.every((p) => G.invCount(p[0]) >= p[1]);
  G.invRoom = (id) => G.state.inv.some((s) => (s && s.item === id) || !s); // есть куда положить результат
  G.craft = function (r) { if (!G.canCraft(r) || !G.invRoom(r.out)) return false; for (const p of r.in) G.invRemove(p[0], p[1]); G.invAdd(r.out, r.n); return true; };

  // Сила добычи = лучшая кирка в инвентаре (рука = 1). Автоприменяется (дружелюбно ребёнку).
  G.toolPower = function () {
    let best = 1;
    for (const slot of G.state.inv) if (slot) { const it = ITEMS[slot.item]; if (it && it.tool === "pick" && it.power > best) best = it.power; }
    return best;
  };
  // Урон ближнего боя = лучший меч в инвентаре (кулак/кирка = 2). Автоприменяется.
  G.playerAtk = function () {
    let best = 2;
    for (const slot of G.state.inv) if (slot) { const it = ITEMS[slot.item]; if (it && it.weapon && it.weapon > best) best = it.weapon; }
    return best + (G.state.perks && G.state.perks.warrior ? 1 : 0);   // 🆙 перк «Воин»
  };
  // Щит: доля поглощённого урона (0..1) от лучшего щита в инвентаре. Автоприменяется.
  G.shieldReduce = function () {
    let best = 0;
    for (const slot of G.state.inv) if (slot) { const it = ITEMS[slot.item]; if (it && it.shield && it.shield > best) best = it.shield; }
    return best;
  };
  // Броня: суммарная защита надетых частей (шлем/нагрудник/ботинки).
  G.armorDefense = function () {
    let s = 0;
    for (const slot of G.state.inv) if (slot) { const it = ITEMS[slot.item]; if (it && it.armor) s += it.armor; }
    return s;
  };
})();
