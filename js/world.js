/* ============================================================
   КУБОМИР — мир: процедурная генерация (value-noise), тайлы,
   таблица блоков (data-driven), рендер с y-сортировкой, коллизии,
   отрисовка персонажа (Стив). Всё процедурно, без картинок.
   ============================================================ */
(function () {
  "use strict";
  const G = window.G;
  const { clamp, lerp } = G;
  const PI = Math.PI;
  const TILE = G.TILE;
  const PAL = G.PAL;

  /* ---- Детерминированный шум (стабильная «текстура» кадр-в-кадр) ---- */
  function ihash(x, y, s) {
    let h = ((x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 1442695041) | 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = (Math.imul(h, 1274126177)) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function smooth(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = ihash(xi, yi, s), b = ihash(xi + 1, yi, s), c = ihash(xi, yi + 1, s), d = ihash(xi + 1, yi + 1, s);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm(x, y, s, oct) {
    let amp = 0.5, fr = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) { sum += amp * smooth(x * fr, y * fr, s + i * 97); norm += amp; amp *= 0.5; fr *= 2; }
    return sum / norm;
  }
  G.ihash = ihash;

  /* ---- Грунт (значения в ground[]) ---- */
  const GROUND = { water: 0, sand: 1, grass: 2, dirt: 3, stone: 4, snow: 5, cavefloor: 6, astral: 7, swamp: 8, jungle: 9, mycelium: 10 };
  /* ---- Объекты (индекс = значение в obj[]; 0 = пусто). Data-driven (OCP) ---- */
  const BLOCKS = [
    null,
    { id: "tree",   name: "Дерево", solid: true,  hardness: 3, drop: "wood",  yield: 3, tier: 1, tall: true },
    { id: "rock",   name: "Камень", solid: true,  hardness: 5, drop: "stone", yield: 1, tier: 2 },
    { id: "coal",   name: "Уголь",  solid: true,  hardness: 5, drop: "coal",  yield: 1, tier: 2 },
    { id: "iron",   name: "Железо", solid: true,  hardness: 6, drop: "iron",  yield: 1, tier: 4 },
    { id: "cactus", name: "Кактус", solid: true,  hardness: 2, drop: "wood",  yield: 1, tier: 1 },
    { id: "flower", name: "Цветок", solid: false, hardness: 0.4, drop: null, special: "dye", deco: true },
    { id: "bush",   name: "Куст",   solid: false, hardness: 1, drop: "berry", yield: 2, tier: 1, deco: true },
    { id: "tuft",   name: "Трава",  solid: false, hardness: 0.3, drop: "seeds", yield: 1, tier: 1, deco: true },
    // ставящиеся постройки (из хотбара) — дописывать ТОЛЬКО в конец (индексы в сейвах)
    { id: "woodblock",  name: "Брусок", solid: true, hardness: 2, drop: "wood",  yield: 1, tier: 1 },
    { id: "stonebrick", name: "Камень", solid: true, hardness: 4, drop: "stone", yield: 1, tier: 2 },
    { id: "furnace",    name: "Печь",   solid: true, hardness: 4, drop: "furnace", yield: 1, tier: 1, light: 130 },
    { id: "torch",      name: "Факел",  solid: false, hardness: 0.5, drop: "torch", yield: 1, tier: 1, deco: true, light: 178 },
    // подземелье (страты-стены, руды, переходы) — дописывать ТОЛЬКО в конец
    { id: "cavestone", name: "Камень", solid: true, hardness: 5, drop: "stone", yield: 1, tier: 2, wall: true },
    { id: "deepslate", name: "Глубинный камень", solid: true, hardness: 7, drop: "stone", yield: 1, tier: 4, wall: true },
    { id: "deeprock",  name: "Глубокая порода",  solid: true, hardness: 9, drop: "stone", yield: 1, tier: 6, wall: true },
    { id: "gold",      name: "Золото", solid: true, hardness: 6, drop: "gold", yield: 1, tier: 4, wall: true },
    { id: "diamond",   name: "Алмаз",  solid: true, hardness: 8, drop: "diamond", yield: 1, tier: 6, wall: true },
    { id: "bedrock",   name: "Бедрок", solid: true, hardness: 999, drop: null, tier: 999, wall: true },
    { id: "cave_entrance", name: "Вход в пещеру", solid: false, hardness: 0, drop: null, trans: "down" },
    { id: "ladder_down",   name: "Лестница вниз", solid: false, hardness: 0, drop: null, trans: "down" },
    { id: "ladder_up",     name: "Лестница вверх", solid: false, hardness: 0, drop: null, trans: "up" },
    // подводный мир (на тайлах воды) — дописывать ТОЛЬКО в конец
    { id: "seakelp",  name: "Водоросли", solid: false, hardness: 0, drop: null, deco: true },
    { id: "coral",    name: "Коралл",    solid: false, hardness: 0, drop: null, deco: true },
    { id: "treasure", name: "Сундук",    solid: false, hardness: 1, drop: null, tier: 1, special: "treasure" },
    // материалы-залежи + постройки из них (дописывать ТОЛЬКО в конец)
    { id: "clay",        name: "Глина",  solid: false, hardness: 1.5, drop: "clay", yield: 2, tier: 1 },
    { id: "sandpile",    name: "Песок",  solid: false, hardness: 1,   drop: "sand", yield: 2, tier: 1 },
    { id: "brick_block", name: "Кирпичи", solid: true, hardness: 4, drop: "brick", yield: 1, tier: 1 },
    { id: "glass_block", name: "Стекло",  solid: true, hardness: 1, drop: "glass", yield: 1, tier: 1 },
    { id: "wool_block",  name: "Шерсть",  solid: true, hardness: 1, drop: "wool",  yield: 1, tier: 1 },
    { id: "gold_block",  name: "Золотой блок", solid: true, hardness: 5, drop: "gold", yield: 1, tier: 1 },
    { id: "bed",         name: "Кровать", solid: false, hardness: 1, drop: "bed", yield: 1, tier: 1, sleep: true },
    // Мир Призраков (астрал) + портал
    { id: "ghost_crystal", name: "Призрачный кристалл", solid: true, hardness: 6, drop: "ghost_shard", yield: 2, tier: 4, light: 120 },
    { id: "astral_block",  name: "Эфир-камень", solid: true, hardness: 4, drop: "astral_block", yield: 1, tier: 2, light: 80, col: "#5a4a8a", colDk: "#3a2e5e", pat: "plain" },
    { id: "portal",        name: "Портал", solid: false, hardness: 2, drop: "portal", yield: 1, tier: 1, light: 150, trans: "astral" },
    { id: "portal_home",   name: "Портал домой", solid: false, hardness: 0, drop: null, light: 150, trans: "home" },
  ];
  // === Генерация блоков из данных: цветная шерсть/стекло + стройматериалы (много рецептов) ===
  const DYE = { red: ["#d24b4b", "#a13636"], orange: ["#e08a3a", "#b06828"], yellow: ["#ffd24a", "#d8a82a"], green: ["#3fa83a", "#2c7a2c"], blue: ["#4f7fe0", "#3858a8"], purple: ["#a86bff", "#7a48c0"], white: ["#f0f0f5", "#c8c8d2"], black: ["#3a3a42", "#222228"] };
  G.DYE = DYE;
  for (const c in DYE) {
    const col = DYE[c];
    BLOCKS.push({ id: "wool_" + c, name: "Шерсть", solid: true, hardness: 1, tier: 1, drop: "wool_" + c, yield: 1, col: col[0], colDk: col[1], pat: "wool" });
    BLOCKS.push({ id: "glass_" + c, name: "Стекло", solid: true, hardness: 1, tier: 1, drop: "glass_" + c, yield: 1, col: col[0], colDk: col[1], glass: true });
  }
  const BUILD_SPEC = [
    { id: "cobblestone",    name: "Булыжник",         col: "#8a8a94", colDk: "#5a5a62", pat: "plain",  hardness: 5, tier: 2, rec: [["stone", 1]] },
    { id: "stone_bricks",   name: "Кам. кирпичи",     col: "#9a9aa4", colDk: "#6a6a74", pat: "brick",  hardness: 5, tier: 2, rec: [["stone", 2]] },
    { id: "mossy_bricks",   name: "Замшелый камень",  col: "#7a8a6a", colDk: "#54643f", pat: "brick",  hardness: 5, tier: 2, rec: [["stone_bricks", 1]] },
    { id: "smooth_stone",   name: "Гладкий камень",   col: "#b0b0ba", colDk: "#86868f", pat: "plain",  hardness: 5, tier: 2, station: "furnace", rec: [["stone", 2]] },
    { id: "chiseled_stone", name: "Резной камень",    col: "#a0a0aa", colDk: "#70707a", pat: "window", hardness: 5, tier: 2, rec: [["stone_bricks", 2]] },
    { id: "sandstone",      name: "Песчаник",         col: "#e6d29a", colDk: "#c0a86a", pat: "plank",  hardness: 3, tier: 1, rec: [["sand", 4]] },
    { id: "dark_planks",    name: "Тёмные доски",     col: "#5e3f28", colDk: "#3c2818", pat: "plank",  hardness: 2, tier: 1, rec: [["plank", 2], ["coal", 1]] },
    { id: "bookshelf",      name: "Книжная полка",    col: "#8a5a34", colDk: "#5e3a1e", pat: "brick",  hardness: 2, tier: 1, rec: [["plank", 3]] },
    { id: "fence",          name: "Забор",            col: "#8a5a34", colDk: "#5e3a1e", pat: "plank",  hardness: 2, tier: 1, rec: [["stick", 4]] },
    { id: "lamp",           name: "Лампа",            col: "#ffe08a", colDk: "#caa12a", pat: "plain",  hardness: 2, tier: 1, light: 165, rec: [["glass", 1], ["coal", 2]] },
    { id: "marble",         name: "Мрамор",           col: "#ececf2", colDk: "#c2c2cc", pat: "plain",  hardness: 6, tier: 2, rec: [["stone", 3]] },
    { id: "obsidian_brick", name: "Обсидиан",         col: "#2c2640", colDk: "#1a1628", pat: "brick",  hardness: 10, tier: 4, rec: [["stone", 2], ["coal", 2]] },
    { id: "vitrazh",        name: "Витраж",           col: "#5ac8ff", colDk: "#bfe6ff", hardness: 1, tier: 1, glass: true, vitrazh: true, rec: [["glass", 2], ["dye_blue", 1]] },
    { id: "tile",           name: "Плитка",           col: "#cfd6e0", colDk: "#9aa2b0", pat: "tile",   hardness: 2, tier: 1, solid: false, floor: true, rec: [["stone", 1], ["clay", 1]] },
    { id: "carpet",         name: "Ковёр",            col: "#d24b6c", colDk: "#a13652", pat: "plain",  hardness: 1, tier: 1, solid: false, floor: true, rec: [["wool", 1]] },
  ];
  G.BUILD_SPEC = BUILD_SPEC;
  for (const b of BUILD_SPEC) BLOCKS.push({ id: b.id, name: b.name, solid: b.solid !== false, hardness: b.hardness, tier: b.tier, drop: b.id, yield: 1, col: b.col, colDk: b.colDk, pat: b.pat, light: b.light, floor: b.floor, glass: b.glass, vitrazh: b.vitrazh });
  // посевы: 4 стадии роста (фермерство)
  for (let st = 0; st <= 3; st++) BLOCKS.push({ id: "crop" + st, name: st < 3 ? "Росток" : "Пшеница", solid: false, hardness: 0.3, drop: null, tier: 1, crop: st });
  BLOCKS.push({ id: "chest", name: "Сундук", solid: false, hardness: 1.5, drop: null, tier: 1, store: true }); // хранилище предметов
  BLOCKS.push({ id: "door", name: "Дверь", solid: true, hardness: 1.2, drop: "door", yield: 1, tier: 1, door: true });           // закрытая (стена)
  BLOCKS.push({ id: "door_open", name: "Дверь", solid: false, hardness: 1.2, drop: "door", yield: 1, tier: 1, door: true, open: true }); // открытая (проход)
  // 🔴 редстоун-лайт: рычаг + лампа
  BLOCKS.push({ id: "lever", name: "Рычаг", solid: false, hardness: 0.4, drop: "lever", yield: 1, tier: 1, lever: true });
  BLOCKS.push({ id: "lever_on", name: "Рычаг", solid: false, hardness: 0.4, drop: "lever", yield: 1, tier: 1, lever: true, on: true });
  BLOCKS.push({ id: "redlamp", name: "Лампа", solid: true, hardness: 1, drop: "redlamp", yield: 1, tier: 1, lamp: true });
  BLOCKS.push({ id: "redlamp_on", name: "Лампа", solid: true, hardness: 1, drop: "redlamp", yield: 1, tier: 1, lamp: true, on: true, light: 168 });
  // 🚂 рельсы
  BLOCKS.push({ id: "rail", name: "Рельсы", solid: false, hardness: 0.6, drop: "rail", yield: 1, tier: 1, rail: true });
  // ⚔ Храм-данж
  BLOCKS.push({ id: "templewall", name: "Камень храма", solid: true, hardness: 6, drop: "stone", yield: 1, tier: 2, col: "#7a6a52", colDk: "#54473a", pat: "brick" });
  BLOCKS.push({ id: "lockdoor", name: "Запертая дверь", solid: true, hardness: 99, drop: null, tier: 9, lock: true });
  BLOCKS.push({ id: "lockdoor_open", name: "Дверь храма", solid: false, hardness: 99, drop: null, tier: 9, lock: true, open: true });
  BLOCKS.push({ id: "temple_entrance", name: "Вход в Храм", solid: false, hardness: 0, drop: null, trans: "temple" });
  BLOCKS.push({ id: "temple_exit", name: "Выход из Храма", solid: false, hardness: 0, drop: null, trans: "home" });
  // 🌿 контент: грибы/лиана/изумруд
  BLOCKS.push({ id: "mushroom_red", name: "Красный гриб", solid: false, hardness: 0.3, drop: "mushroom", yield: 1, tier: 1, deco: true });
  BLOCKS.push({ id: "mushroom_brown", name: "Гриб", solid: false, hardness: 0.3, drop: "mushroom", yield: 1, tier: 1, deco: true });
  BLOCKS.push({ id: "vine", name: "Лиана", solid: false, hardness: 0.3, drop: "stick", yield: 1, tier: 1, deco: true });
  BLOCKS.push({ id: "emerald", name: "Изумруд", solid: true, hardness: 7, drop: "emerald", yield: 1, tier: 4 });
  BLOCKS.push({ id: "giant_mushroom", name: "Гигантский гриб", solid: true, hardness: 2, drop: "mushroom", yield: 2, tier: 1, tall: true, light: 90 }); // 🍄 светится

  const OBJ = {}; BLOCKS.forEach((b, i) => { if (b) OBJ[b.id] = i; });

  const World = (G.World = { W: 0, H: 0, ground: null, obj: null, seed: 0, BLOCKS, OBJ, GROUND });

  /* ---- Слои мира: поверхность (0) + подземные этажи (1..). Активный слой — в World.ground/obj/_edits ---- */
  World.layers = {};
  function applyPending(o, g, key, edits) {
    const pe = G._pendingEdits && G._pendingEdits[key];
    if (!pe) return;
    for (const k in pe) {
      if (k[0] === "g" && k[1] === ":") {                       // правка грунта "g:tx,ty" (ведро)
        const c = k.slice(2).split(","), tx = +c[0], ty = +c[1];
        if (tx >= 0 && ty >= 0 && tx < World.W && ty < World.H) g[ty * World.W + tx] = pe[k];
      } else {
        const c = k.split(","), tx = +c[0], ty = +c[1];
        if (tx >= 0 && ty >= 0 && tx < World.W && ty < World.H) o[ty * World.W + tx] = pe[k];
      }
      edits[k] = pe[k];
    }
  }

  // 🏛 руина: частичные стены из кирпича/булыжника + иногда сокровище
  function placeRuin(o, g, cx, cy, s) {
    const W = World.W, H = World.H, sb = OBJ.stone_bricks, cob = OBJ.cobblestone;
    const w = 3 + ((ihash(cx, cy, s + 3) * 3) | 0), h = 3 + ((ihash(cx, cy, s + 4) * 3) | 0);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const tx = cx + dx, ty = cy + dy; if (tx < 1 || ty < 1 || tx >= W - 1 || ty >= H - 1) continue;
      const i = ty * W + tx; if (g[i] === GROUND.water) continue;
      const edge = (dx === 0 || dy === 0 || dx === w - 1 || dy === h - 1);
      if (edge && ihash(tx, ty, s + 17) < 0.68) o[i] = (ihash(tx, ty, s + 18) < 0.5 ? sb : cob); // разрушенные стены
      else if (!edge) o[i] = 0;
    }
    const mi = (cy + (h >> 1)) * W + (cx + (w >> 1));
    if (g[mi] !== GROUND.water && ihash(cx, cy, s + 19) < 0.5) o[mi] = OBJ.treasure; // клад в центре
  }
  // 🏘 хижина: бруски-стены, дверь снизу, факел внутри
  function placeHut(o, g, cx, cy, s) {
    const W = World.W, H = World.H, w = 5, h = 4;
    if (cx < 1 || cy < 1 || cx + w >= W - 1 || cy + h >= H - 1) return;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const i = (cy + dy) * W + (cx + dx), edge = (dx === 0 || dy === 0 || dx === w - 1 || dy === h - 1);
      if (g[i] === GROUND.water) g[i] = GROUND.grass;
      o[i] = edge ? OBJ.woodblock : 0;
    }
    o[(cy + h - 1) * W + (cx + (w >> 1))] = OBJ.door;   // дверь в нижней стене
    o[(cy + 1) * W + (cx + 1)] = OBJ.torch;             // факел внутри
  }
  function isFlatGrass(g, elev, cx, cy, r) {
    const W = World.W, H = World.H; if (cx < r || cy < r || cx >= W - r || cy >= H - r) return false;
    const e0 = elev[cy * W + cx]; let grass = 0, n = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const i = (cy + dy) * W + (cx + dx); n++;
      if (Math.abs(elev[i] - e0) > 22) return false;
      if (g[i] === GROUND.grass) grass++;
    }
    return grass / n > 0.88;
  }

  World._genSurface = function () {
    const W = World.W, H = World.H, s = World.seed;
    const g = new Uint8Array(W * H), o = new Uint8Array(W * H), elev = new Uint8Array(W * H);
    const cx = W / 2, cy = H / 2, maxd = Math.min(W, H) * 0.5;
    for (let ty = 0; ty < H; ty++) {
      const lat = ty / H;
      for (let tx = 0; tx < W; tx++) {
        const i = ty * W + tx;
        let e = fbm(tx * 0.045, ty * 0.045, s, 5);
        const m = fbm(tx * 0.05 + 70, ty * 0.05 + 30, s + 7, 4);
        const biome = fbm(tx * 0.013 + 200, ty * 0.013 + 90, s + 50, 3); // крупные биом-регионы: лес/луг/пустыня
        const moist = fbm(tx * 0.011 + 420, ty * 0.011 + 180, s + 61, 3); // влажность: болото/джунгли
        const d = Math.hypot(tx - cx, ty - cy) / maxd; // островной спад к краям
        e -= Math.max(0, d - 0.60) * 1.8;
        if (e > 0.6) e = 0.6 + (e - 0.6) * 1.7; // усилить горы: выше пики, круче склоны (→ снег и обрывы)
        elev[i] = Math.max(0, Math.min(254, (e * 200) | 0)); // высота: рельеф + обрывы
        let gnd;
        if (e < 0.30) gnd = GROUND.water;
        else if (e < 0.355) gnd = GROUND.sand;
        else if (e > 0.84) gnd = GROUND.snow;              // снежные пики
        else if (e > 0.72) gnd = GROUND.stone;             // горы
        else if (lat < 0.16 && e > 0.50) gnd = GROUND.snow;
        else if (lat > 0.84 && m < 0.45) gnd = GROUND.sand;
        else if (biome > 0.64) gnd = GROUND.sand;          // 🌵 пустыня
        else if (moist > 0.7 && biome > 0.42) gnd = (ihash(tx, ty, s + 5) < 0.16 ? GROUND.water : GROUND.swamp); // 🐸 болото с лужами
        else if (biome < 0.34 && moist > 0.52) gnd = GROUND.jungle; // 🌴 джунгли
        else if (biome < 0.46 && moist < 0.24) gnd = GROUND.mycelium; // 🍄 грибной лес (сухие прохладные карманы)
        else gnd = GROUND.grass;
        g[i] = gnd;
        const forest = biome < 0.36;                        // 🌲 лесной биом — гуще деревья
        if (gnd === GROUND.grass) {
          const treeP = forest ? 0.34 : (m > 0.55 ? 0.20 : 0.05), h = ihash(tx, ty, s + 555);
          if (h < treeP) o[i] = OBJ.tree;
          else if (h < treeP + 0.03) o[i] = OBJ.bush;
          else if (h < treeP + 0.08) o[i] = (ihash(tx, ty, s + 9) < 0.5 ? OBJ.flower : OBJ.tuft);
        } else if (gnd === GROUND.jungle) {
          const h = ihash(tx, ty, s + 555);
          if (h < 0.46) o[i] = OBJ.tree; else if (h < 0.52) o[i] = OBJ.vine; else if (h < 0.58) o[i] = OBJ.bush;
        } else if (gnd === GROUND.swamp) {
          const h = ihash(tx, ty, s + 556);
          if (h < 0.05) o[i] = OBJ.mushroom_red; else if (h < 0.11) o[i] = OBJ.mushroom_brown; else if (h < 0.15) o[i] = OBJ.tree; else if (h < 0.20) o[i] = OBJ.tuft;
        } else if (gnd === GROUND.mycelium) {
          const h = ihash(tx, ty, s + 557);
          if (h < 0.04) o[i] = OBJ.giant_mushroom; else if (h < 0.12) o[i] = OBJ.mushroom_red; else if (h < 0.20) o[i] = OBJ.mushroom_brown;
        } else if (gnd === GROUND.stone) {
          const ore = smooth(tx * 0.28, ty * 0.28, s + 202), h = ihash(tx, ty, s + 777);
          if (ihash(tx, ty, s + 313) < 0.02) o[i] = OBJ.cave_entrance;   // вход в пещеру (в скалах)
          else if (ore > 0.80 && h < 0.62) o[i] = OBJ.iron;
          else if (ore > 0.72 && h < 0.62) o[i] = OBJ.coal;
          else if (h < 0.34) o[i] = OBJ.rock;
        } else if (gnd === GROUND.sand) {
          if ((lat > 0.84 || biome > 0.64) && ihash(tx, ty, s + 88) < 0.05) o[i] = OBJ.cactus;
          else if (ihash(tx, ty, s + 4) < 0.02) o[i] = OBJ.rock;
          else if (e < 0.345 && ihash(tx, ty, s + 61) < 0.14) o[i] = OBJ.clay;     // глина у самой воды
          else if (ihash(tx, ty, s + 62) < 0.10) o[i] = OBJ.sandpile;             // кучки песка
        } else if (gnd === GROUND.snow) {
          if (ihash(tx, ty, s + 12) < 0.06) o[i] = OBJ.tree;
          else if (ihash(tx, ty, s + 13) < 0.05) o[i] = OBJ.rock;
        } else if (gnd === GROUND.water) {
          const h = ihash(tx, ty, s + 401);
          if (e < 0.18 && h < 0.008) o[i] = OBJ.treasure;   // сокровища в глубокой воде
          else if (h < 0.05) o[i] = OBJ.seakelp;
          else if (h < 0.075) o[i] = OBJ.coral;
        }
      }
    }
    // обрывы: высокий тайл с сильным перепадом к соседу → непроходимый уступ (рисуем стенку)
    const cliff = new Uint8Array(W * H), TH = 16;
    for (let ty = 1; ty < H - 1; ty++) for (let tx = 1; tx < W - 1; tx++) {
      const i = ty * W + tx, eh = elev[i];
      if (eh < 110 || g[i] === GROUND.water) continue;
      let drop = 0, dir = 0;
      const nb = [[0, -1, 1], [1, 0, 2], [0, 1, 3], [-1, 0, 4]];
      for (const n of nb) { const dd = eh - elev[(ty + n[1]) * W + (tx + n[0])]; if (dd > drop) { drop = dd; dir = n[2]; } }
      if (drop > TH) cliff[i] = dir;                // 1=N 2=E 3=S 4=W — куда обрыв
      if (o[i] === OBJ.cave_entrance) cliff[i] = 0; // вход в пещеру должен быть доступен
    }
    // 🏛 руины: разбросаны по карте (детерминированно ~5% ячеек 7×7)
    for (let ry = 4; ry < H - 6; ry += 7) for (let rx = 4; rx < W - 6; rx += 7) {
      if (ihash(rx, ry, s + 8080) > 0.05) continue;
      const bx = rx + ((ihash(rx, ry, s + 1) * 3) | 0), by = ry + ((ihash(rx, ry, s + 2) * 3) | 0);
      const gg = g[by * W + bx]; if (gg === GROUND.grass || gg === GROUND.sand) placeRuin(o, g, bx, by, s);
    }
    // 🏘 деревня у центра острова: 3 хижины на ровной траве
    let vill = null;
    for (let k = 0; k < 240 && !vill; k++) {
      const vx = (cx + (ihash(k, 7, s + 900) - 0.5) * 50) | 0, vy = (cy + (ihash(k, 9, s + 901) - 0.5) * 50) | 0;
      if (isFlatGrass(g, elev, vx, vy, 9)) vill = { x: vx, y: vy };
    }
    if (vill) for (let hi = 0; hi < 3; hi++) placeHut(o, g, vill.x + (hi - 1) * 6 - 2, vill.y - 1, s + hi * 13);
    // ⚔ входы в Храм (2 шт, детерминированно, на доступной траве/песке) — позиции сохраняем для компаса-указателя
    const templeList = [];
    for (let k = 0; k < 500 && templeList.length < 2; k++) {
      const tx = 6 + ((ihash(k, 31, s + 700) * (W - 12)) | 0), ty = 6 + ((ihash(k, 37, s + 701) * (H - 12)) | 0), ii = ty * W + tx;
      if ((g[ii] === GROUND.grass || g[ii] === GROUND.sand) && o[ii] === 0 && !cliff[ii]) { o[ii] = OBJ.temple_entrance; templeList.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }); }
    }
    const edits = {}; applyPending(o, g, "0", edits);
    return { ground: g, obj: o, edits: edits, elev: elev, cliff: cliff, village: vill, temples: templeList };
  };

  World._genCave = function (depth) {
    const W = World.W, H = World.H, s = (World.seed + depth * 131) >>> 0;
    const g = new Uint8Array(W * H), o = new Uint8Array(W * H);
    const wall = depth <= 2 ? OBJ.cavestone : depth === 3 ? OBJ.deepslate : OBJ.deeprock;
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const i = ty * W + tx;
      g[i] = GROUND.cavefloor;
      if (tx < 2 || ty < 2 || tx >= W - 2 || ty >= H - 2) { o[i] = OBJ.bedrock; continue; } // несокрушимая граница
      if (fbm(tx * 0.08, ty * 0.08, s, 4) > 0.56) { o[i] = 0; continue; }                    // открытая пещера
      const h = ihash(tx, ty, s + 91);
      if (depth >= 3 && h < 0.01) o[i] = OBJ.ghost_crystal;     // призрачные кристаллы — для портала
      else if (depth >= 4 && h < 0.026) o[i] = OBJ.diamond;     // алмаз чуть доступнее: гейтит меч босса + базу зачарований
      else if (depth >= 4 && h < 0.032) o[i] = OBJ.emerald;     // 💚 изумруд реже алмаза — настоящий топ-тир (кирка 12 > 9)
      else if (depth >= 3 && h < 0.04) o[i] = OBJ.gold;
      else if (h < 0.07) o[i] = OBJ.iron;
      else if (h < 0.15) o[i] = OBJ.coal;
      else o[i] = wall;
    }
    const ex = (W / 2) | 0, ey = (H / 2) | 0;                  // вход-комната у центра
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.hypot(dx, dy) < 2.5) o[(ey + dy) * W + (ex + dx)] = 0;
    o[ey * W + ex] = OBJ.ladder_up;
    if (depth < 4) o[ey * W + (ex + 2)] = OBJ.ladder_down;
    const edits = {}; applyPending(o, g, "" + depth, edits);
    return { ground: g, obj: o, edits: edits, entry: { x: ex * TILE + TILE / 2, y: ey * TILE + TILE / 2 } };
  };

  World._genTemple = function (depth) {     // ⚔ храм-данж: вход(низ)→хаб→комната ключа(лево) / запертая дверь→босс(верх)
    const W = World.W, H = World.H, s = (World.seed + depth * 271) >>> 0;
    const g = new Uint8Array(W * H), o = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { g[i] = GROUND.cavefloor; o[i] = OBJ.templewall; }
    const ex = (W / 2) | 0, ey = (H / 2) | 0;
    const carve = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x > 1 && y > 1 && x < W - 2 && y < H - 2) o[y * W + x] = 0; };
    carve(ex - 4, ey - 18, 9, 7);    // босс-комната (верх)
    carve(ex, ey - 12, 1, 8);        // коридор босс↔хаб (узкий — запертая дверь его полностью перекрывает)
    carve(ex - 3, ey - 5, 7, 6);     // хаб
    carve(ex - 3, ey + 1, 7, 6);     // вход (низ)
    carve(ex - 9, ey - 1, 7, 3);     // коридор хаб↔ключ
    carve(ex - 16, ey - 3, 8, 7);    // комната ключа (лево)
    o[(ey - 6) * W + ex] = OBJ.lockdoor;                 // запертая дверь (коридор наверх к боссу)
    o[ey * W + (ex - 13)] = OBJ.chest;                   // сундук с ключом (наполняется в goTemple)
    o[(ey + 5) * W + ex] = OBJ.temple_exit;              // выход
    const edits = {}; applyPending(o, g, "" + depth, edits);
    return { ground: g, obj: o, edits: edits, entry: { x: ex * TILE + TILE / 2, y: (ey + 2) * TILE + TILE / 2 }, keyChest: { x: ex - 13, y: ey }, bossPos: { x: ex, y: ey - 15 }, exit: { x: ex, y: ey + 5 } };
  };

  World._genAstral = function () {
    const W = World.W, H = World.H, s = (World.seed + 9999) >>> 0;
    const g = new Uint8Array(W * H), o = new Uint8Array(W * H);
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const i = ty * W + tx;
      g[i] = GROUND.astral;
      if (tx < 2 || ty < 2 || tx >= W - 2 || ty >= H - 2) { o[i] = OBJ.bedrock; continue; }
      const v = fbm(tx * 0.06, ty * 0.06, s, 4);
      if (v > 0.62) o[i] = OBJ.astral_block;                            // эфирные глыбы
      else if (ihash(tx, ty, s + 5) < 0.012) o[i] = OBJ.ghost_crystal;  // осколки
    }
    const ex = (W / 2) | 0, ey = (H / 2) | 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.hypot(dx, dy) < 3.2) o[(ey + dy) * W + (ex + dx)] = 0;
    o[ey * W + ex] = OBJ.portal_home;
    const edits = {}; applyPending(o, g, "9", edits);
    return { ground: g, obj: o, edits: edits, entry: { x: ex * TILE + TILE / 2, y: ey * TILE + TILE / 2 } };
  };

  // Переключить активный слой (генерит при первом визите, кеширует)
  World.use = function (depth) {
    if (!World.layers[depth]) World.layers[depth] = depth === 0 ? World._genSurface() : depth === 9 ? World._genAstral() : depth === 8 ? World._genTemple(depth) : World._genCave(depth);
    const L = World.layers[depth];
    World.ground = L.ground; World.obj = L.obj; World._edits = L.edits; World.depth = depth;
    World.elev = L.elev || null; World.cliff = L.cliff || null;
    G.state.depth = depth;
    return L;
  };

  World.gen = function (seed) {
    World.W = 400; World.H = 400; World.seed = seed >>> 0;
    World.layers = {};
    World.use(0);
    return World.findSpawn();
  };

  World.findSpawn = function () {
    const { W, H, ground, obj } = World;
    const cx = (W / 2) | 0, cy = (H / 2) | 0;
    for (let r = 0; r < Math.max(W, H); r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // только периметр кольца
        const tx = cx + dx, ty = cy + dy;
        if (tx < 2 || ty < 2 || tx >= W - 2 || ty >= H - 2) continue;
        const i = ty * W + tx;
        if ((ground[i] === GROUND.grass || ground[i] === GROUND.sand) && obj[i] === 0 && !(World.cliff && World.cliff[i]))
          return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
      }
    }
    return { x: cx * TILE, y: cy * TILE };
  };

  /* ---- Запросы тайлов ---- */
  World.gTile = (tx, ty) => (tx < 0 || ty < 0 || tx >= World.W || ty >= World.H) ? GROUND.water : World.ground[ty * World.W + tx];
  World.oTile = (tx, ty) => (tx < 0 || ty < 0 || tx >= World.W || ty >= World.H) ? 0 : World.obj[ty * World.W + tx];
  World.edit = function (tx, ty, v) {
    if (tx < 0 || ty < 0 || tx >= World.W || ty >= World.H) return;
    World.obj[ty * World.W + tx] = v;
    if (World._edits) World._edits[tx + "," + ty] = v;
  };
  World.editGround = function (tx, ty, gv) {                     // правка грунта (ведро: суша↔вода)
    if (tx < 0 || ty < 0 || tx >= World.W || ty >= World.H) return;
    World.ground[ty * World.W + tx] = gv;
    if (World._edits) World._edits["g:" + tx + "," + ty] = gv;
  };
  World.serialize = function () { const out = {}; for (const d in World.layers) out[d] = World.layers[d].edits || {}; return out; };

  // твёрдо ли в мировой точке (solid-объект или вода)
  World.solidPx = function (wx, wy, swim) {
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= World.W || ty >= World.H) return true;            // за картой — стена
    if (World.cliff && World.cliff[ty * World.W + tx]) return true;                 // обрыв непроходим
    if (World.gTile(tx, ty) === GROUND.water) return !swim;                         // вода: твёрдо всем, кроме плывущего игрока
    const b = BLOCKS[World.oTile(tx, ty)];
    return !!(b && b.solid);
  };

  // Источники света (факел/печь) в видимой области → cb(x, y, radius)
  World.eachVisibleLight = function (cb) {
    const cam = G.cam, W = World.W;
    const tx0 = Math.max(0, Math.floor(cam.x / TILE) - 1), ty0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
    const tx1 = Math.min(W - 1, Math.ceil((cam.x + G.VIEW.w) / TILE) + 1), ty1 = Math.min(World.H - 1, Math.ceil((cam.y + G.VIEW.h) / TILE) + 1);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const b = BLOCKS[World.obj[ty * W + tx]];
      if (b && b.light) cb(tx * TILE + TILE / 2, ty * TILE + TILE - 16, b.light);
    }
  };
  // Освещена ли точка (рядом факел/печь) — для подавления спавна
  World.litAt = function (wx, wy) {
    const cx = Math.floor(wx / TILE), cy = Math.floor(wy / TILE);
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const b = BLOCKS[World.oTile(cx + dx, cy + dy)];
      if (b && b.light && G.dist(wx, wy, (cx + dx) * TILE + TILE / 2, (cy + dy) * TILE + TILE / 2) < b.light * 0.7) return true;
    }
    return false;
  };

  /* ---- Рендер грунта (база + детерминированная «текстура») ---- */
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2); ctx.fill(); }

  function drawGround(ctx, tx, ty) {
    const i = ty * World.W + tx, g = World.ground[i];
    const x = tx * TILE, y = ty * TILE;
    let base;
    switch (g) {
      case GROUND.water: base = PAL.water1; break;
      case GROUND.sand: base = PAL.sand; break;
      case GROUND.grass: base = (smooth(tx * 0.35, ty * 0.35, 3) < 0.5 ? PAL.grass1 : PAL.grass2); break; // патчи вместо рябящей шахматки
      case GROUND.dirt: base = PAL.dirt; break;
      case GROUND.stone: base = PAL.stone; break;
      case GROUND.snow: base = PAL.snow; break;
      case GROUND.cavefloor: base = "#3b3742"; break;
      case GROUND.astral: base = "#241b3a"; break;
      case GROUND.swamp: base = (smooth(tx * 0.3, ty * 0.3, 8) < 0.5 ? "#46563a" : "#3c4c32"); break;   // 🐸 болото — мутно-зелёное
      case GROUND.jungle: base = (smooth(tx * 0.3, ty * 0.3, 9) < 0.5 ? "#3a7a36" : "#317030"); break;  // 🌴 джунгли — сочное
      case GROUND.mycelium: base = (smooth(tx * 0.3, ty * 0.3, 10) < 0.5 ? "#5a4a6a" : "#52426a"); break; // 🍄 грибной лес — мицелий
      default: base = PAL.grass1;
    }
    ctx.fillStyle = base; ctx.fillRect(x, y, TILE, TILE);

    // рельеф: эмбосс по перепаду высоты к соседу сверху-слева + стенки обрывов (только поверхность)
    if (World.elev) {
      const e0 = World.elev[i], enw = (tx > 0 && ty > 0) ? World.elev[(ty - 1) * World.W + (tx - 1)] : e0, df = e0 - enw;
      if (df > 2) { ctx.globalAlpha = Math.min(0.30, df / 70); ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, TILE, TILE); ctx.globalAlpha = 1; }
      else if (df < -2) { ctx.globalAlpha = Math.min(0.32, -df / 70); ctx.fillStyle = "#000010"; ctx.fillRect(x, y, TILE, TILE); ctx.globalAlpha = 1; }
      const cf = World.cliff && World.cliff[i];
      if (cf) {
        ctx.fillStyle = "rgba(0,0,0,0.34)";
        if (cf === 1) ctx.fillRect(x, y, TILE, 13);
        else if (cf === 2) ctx.fillRect(x + TILE - 13, y, 13, TILE);
        else if (cf === 3) ctx.fillRect(x, y + TILE - 13, TILE, 13);
        else ctx.fillRect(x, y, 13, TILE);
        ctx.fillStyle = "rgba(255,255,255,0.16)"; // светлая кромка уступа
        if (cf === 1) ctx.fillRect(x, y + 13, TILE, 3);
        else if (cf === 3) ctx.fillRect(x, y + TILE - 16, TILE, 3);
        else if (cf === 2) ctx.fillRect(x + TILE - 16, y, 3, TILE);
        else ctx.fillRect(x + 13, y, 3, TILE);
      }
    }

    if (g === GROUND.water) {
      const w = Math.sin(G.time * 1.6 + tx * 0.6 + ty * 0.4);
      ctx.globalAlpha = 0.5; ctx.fillStyle = PAL.water2;
      ctx.fillRect(x, y + TILE * 0.35 + w * 3, TILE, 4);
      ctx.globalAlpha = 1;
      if (ihash(tx, ty, 5) < 0.1) { ctx.globalAlpha = 0.55; ctx.fillStyle = PAL.waterFoam; ctx.fillRect(x + ihash(tx, ty, 6) * TILE, y + ihash(tx, ty, 7) * TILE, 3, 3); ctx.globalAlpha = 1; }
    } else if (g === GROUND.grass) {
      ctx.fillStyle = PAL.grassBlade;
      const gw = Math.sin(G.time * 1.6 + tx * 0.5 + ty * 0.5) * 1.4;            // колыхание травинок на ветру
      for (let d = 0; d < 3; d++) ctx.fillRect(x + ihash(tx, ty, d * 5 + 11) * TILE + gw, y + ihash(tx, ty, d * 5 + 12) * TILE, 2, 4);
    } else if (g === GROUND.swamp) {
      ctx.fillStyle = "#2e3e26"; for (let d = 0; d < 2; d++) ctx.fillRect(x + ihash(tx, ty, d * 7 + 3) * TILE, y + ihash(tx, ty, d * 7 + 4) * TILE, 3, 3); // кочки/ряска
    } else if (g === GROUND.jungle) {
      ctx.fillStyle = "#256a24"; const jw = Math.sin(G.time * 1.4 + tx + ty) * 1.6;
      for (let d = 0; d < 3; d++) ctx.fillRect(x + ihash(tx, ty, d * 5 + 21) * TILE + jw, y + ihash(tx, ty, d * 5 + 22) * TILE, 2, 6); // высокая трава колышется
    } else if (g === GROUND.mycelium) {
      ctx.fillStyle = "rgba(190,150,255,0.55)"; for (let d = 0; d < 3; d++) ctx.fillRect(x + ihash(tx, ty, d * 7 + 31) * TILE, y + ihash(tx, ty, d * 7 + 32) * TILE, 2, 2); // светящиеся споры
    } else if (g === GROUND.sand) {
      ctx.fillStyle = PAL.sandDk;
      for (let d = 0; d < 3; d++) ctx.fillRect(x + ihash(tx, ty, d * 5 + 21) * TILE, y + ihash(tx, ty, d * 5 + 22) * TILE, 2, 2);
    } else if (g === GROUND.stone) {
      ctx.globalAlpha = 0.5; ctx.strokeStyle = PAL.stoneCrack; ctx.lineWidth = 1;
      const hx = ihash(tx, ty, 31) * TILE;
      ctx.beginPath(); ctx.moveTo(x + hx, y + 4); ctx.lineTo(x + hx * 0.6 + 6, y + TILE - 6); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (g === GROUND.snow) {
      ctx.fillStyle = PAL.snowDk;
      for (let d = 0; d < 2; d++) ctx.fillRect(x + ihash(tx, ty, d * 5 + 41) * TILE, y + ihash(tx, ty, d * 5 + 42) * TILE, 2, 2);
    } else if (g === GROUND.dirt) {
      ctx.fillStyle = PAL.dirtDk;
      for (let d = 0; d < 3; d++) ctx.fillRect(x + ihash(tx, ty, d * 5 + 51) * TILE, y + ihash(tx, ty, d * 5 + 52) * TILE, 3, 3);
    } else if (g === GROUND.cavefloor) {
      ctx.fillStyle = "#322e39";
      for (let d = 0; d < 3; d++) ctx.fillRect(x + ihash(tx, ty, d * 5 + 61) * TILE, y + ihash(tx, ty, d * 5 + 62) * TILE, 3, 3);
    } else if (g === GROUND.astral) {
      for (let d = 0; d < 2; d++) { ctx.fillStyle = ihash(tx, ty, d) < 0.5 ? "#7a5fb0" : "#4a3a78"; ctx.fillRect(x + ihash(tx, ty, d * 5 + 71) * TILE, y + ihash(tx, ty, d * 5 + 72) * TILE, 2, 2); }
    }
  }

  /* ---- Рендер объектов (рисуются по нижнему краю тайла для y-сортировки) ---- */
  function drawBoulder(ctx, cxp, by, col, dk) {
    ctx.fillStyle = dk; G.rr(ctx, cxp - 15, by - 24, 30, 22, 9); ctx.fill();
    ctx.fillStyle = col; G.rr(ctx, cxp - 13, by - 24, 26, 17, 8); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.28)"; G.rr(ctx, cxp - 9, by - 22, 12, 6, 3); ctx.fill();
  }
  // Подземная стена — заполняет тайл целиком (прокопка = просвет между стенами)
  function drawWall(ctx, x, y, col, dk) {
    ctx.fillStyle = dk; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = col; ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(x + 2, y + 2, TILE - 4, 4);
    ctx.fillStyle = "rgba(0,0,0,0.20)"; ctx.fillRect(x + 2, y + TILE - 6, TILE - 4, 4);
  }
  function drawFlecks(ctx, x, y, tx, ty, col, hi) {
    for (let d = 0; d < 4; d++) { ctx.fillStyle = d % 2 ? hi : col; ctx.fillRect(x + 8 + ihash(tx, ty, d + 11) * 28, y + 8 + ihash(tx, ty, d + 17) * 28, 5, 5); }
  }
  // Универсальный куб-блок (data-driven через col/pat) — позволяет добавлять блоки данными
  function drawCube(ctx, cxp, by, col, dk, pat) {
    const top = by - 31;
    ctx.fillStyle = dk; G.rr(ctx, cxp - 16, top, 32, 32, 4); ctx.fill();
    ctx.fillStyle = col; G.rr(ctx, cxp - 14, top + 2, 28, 27, 3); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = dk;
    if (pat === "brick") { ctx.beginPath(); ctx.moveTo(cxp - 14, top + 11); ctx.lineTo(cxp + 14, top + 11); ctx.moveTo(cxp - 14, top + 20); ctx.lineTo(cxp + 14, top + 20); ctx.moveTo(cxp, top + 2); ctx.lineTo(cxp, top + 11); ctx.moveTo(cxp - 7, top + 11); ctx.lineTo(cxp - 7, top + 20); ctx.stroke(); }
    else if (pat === "plank") { ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cxp - 14, top + 10); ctx.lineTo(cxp + 14, top + 10); ctx.moveTo(cxp - 14, top + 20); ctx.lineTo(cxp + 14, top + 20); ctx.stroke(); }
    else if (pat === "window") { ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.fillRect(cxp - 9, top + 5, 18, 18); ctx.strokeRect(cxp - 9, top + 5, 18, 18); }
    else if (pat === "wool") { ctx.fillStyle = "rgba(255,255,255,0.16)"; G.rr(ctx, cxp - 12, top + 3, 24, 9, 4); ctx.fill(); }
    else { ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.fillRect(cxp - 12, top + 3, 24, 4); }
  }
  function drawCrop(ctx, cxp, by, st) {
    const h = 6 + st * 6, col = st >= 3 ? "#e0c24a" : "#5aa83a";
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(cxp + k * 6, by - 2); ctx.lineTo(cxp + k * 6, by - 2 - h); ctx.stroke(); }
    if (st >= 3) { ctx.fillStyle = "#f0d24a"; for (let k = -1; k <= 1; k++) ctx.fillRect(cxp + k * 6 - 2, by - 2 - h, 4, 7); } // колосья
  }
  function drawObj(ctx, bi, tx, ty) {
    const b = BLOCKS[bi];
    const x = tx * TILE, y = ty * TILE, cxp = x + TILE / 2, by = y + TILE - 2;
    // мягкая тень под объёмными объектами (стены-тайлы — без тени)
    if (b.solid && !b.wall) { ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.beginPath(); ctx.ellipse(cxp, by - 4, TILE * 0.34, TILE * 0.15, 0, 0, PI * 2); ctx.fill(); }
    switch (b.id) {
      case "tree": {
        ctx.fillStyle = PAL.trunkDk; ctx.fillRect(cxp - 5, by - 22, 10, 22);
        ctx.fillStyle = PAL.trunk; ctx.fillRect(cxp - 5, by - 22, 5, 22);
        const sway = Math.sin(G.time * 1.1 + tx * 0.7 + ty * 0.5) * 2.6, cx2 = cxp + sway, cy0 = by - 34; // крона качается на ветру
        ctx.fillStyle = PAL.leafDk; circle(ctx, cx2 - 11, cy0 + 5, 15); circle(ctx, cx2 + 11, cy0 + 5, 15); circle(ctx, cx2, cy0 - 6, 17);
        ctx.fillStyle = PAL.leaf; circle(ctx, cx2 - 8, cy0 + 2, 12); circle(ctx, cx2 + 8, cy0 + 1, 12); circle(ctx, cx2, cy0 - 6, 13);
        ctx.fillStyle = PAL.leafHi; circle(ctx, cx2 - 4, cy0 - 9, 6);
        break;
      }
      case "rock": drawBoulder(ctx, cxp, by, PAL.stone, PAL.stoneDk); break;
      case "coal":
        drawBoulder(ctx, cxp, by, PAL.stone, PAL.stoneDk);
        ctx.fillStyle = PAL.coalBit;
        for (let d = 0; d < 4; d++) ctx.fillRect(cxp - 10 + ihash(tx, ty, d + 1) * 20, by - 22 + ihash(tx, ty, d + 5) * 12, 4, 4);
        break;
      case "iron":
        drawBoulder(ctx, cxp, by, PAL.stone, PAL.stoneDk);
        for (let d = 0; d < 4; d++) { ctx.fillStyle = d % 2 ? PAL.ironHi : PAL.ironBit; ctx.fillRect(cxp - 10 + ihash(tx, ty, d + 2) * 20, by - 22 + ihash(tx, ty, d + 6) * 12, 4, 4); }
        break;
      case "woodblock": {
        const top = by - 33;
        ctx.fillStyle = PAL.trunkDk; G.rr(ctx, cxp - 16, top, 32, 33, 4); ctx.fill();
        ctx.fillStyle = PAL.trunk; G.rr(ctx, cxp - 14, top + 2, 28, 28, 3); ctx.fill();
        ctx.strokeStyle = PAL.trunkDk; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cxp - 13, top + 12); ctx.lineTo(cxp + 13, top + 12);
        ctx.moveTo(cxp - 13, top + 21); ctx.lineTo(cxp + 13, top + 21);
        ctx.stroke();
        break;
      }
      case "stonebrick": {
        const top = by - 33;
        ctx.fillStyle = PAL.stoneDk; G.rr(ctx, cxp - 16, top, 32, 33, 4); ctx.fill();
        ctx.fillStyle = PAL.stone; G.rr(ctx, cxp - 14, top + 2, 28, 28, 3); ctx.fill();
        ctx.strokeStyle = PAL.stoneDk; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cxp - 13, top + 14); ctx.lineTo(cxp + 13, top + 14);
        ctx.moveTo(cxp, top + 2); ctx.lineTo(cxp, top + 14);
        ctx.moveTo(cxp - 7, top + 14); ctx.lineTo(cxp - 7, top + 28);
        ctx.moveTo(cxp + 7, top + 14); ctx.lineTo(cxp + 7, top + 28);
        ctx.stroke();
        break;
      }
      case "furnace": {
        const top = by - 33;
        ctx.fillStyle = PAL.stoneDk; G.rr(ctx, cxp - 16, top, 32, 33, 4); ctx.fill();
        ctx.fillStyle = PAL.stone; G.rr(ctx, cxp - 14, top + 2, 28, 28, 3); ctx.fill();
        ctx.fillStyle = "#26262c"; G.rr(ctx, cxp - 9, top + 13, 18, 15, 2); ctx.fill();   // топка
        ctx.fillStyle = "#ff8a3a"; G.rr(ctx, cxp - 7, top + 19, 14, 8, 2); ctx.fill();
        ctx.fillStyle = "#ffd24a"; ctx.fillRect(cxp - 3, top + 21, 6, 5);                  // пламя
        break;
      }
      case "torch": {
        ctx.fillStyle = "rgba(255,210,90,0.22)"; circle(ctx, cxp, by - 18, 13);        // ореол
        ctx.fillStyle = "#7a4a26"; ctx.fillRect(cxp - 2, by - 18, 4, 18);              // палка
        ctx.fillStyle = "#ffce4a"; circle(ctx, cxp, by - 21, 5);                       // пламя
        ctx.fillStyle = "#ff8a3a"; circle(ctx, cxp, by - 19, 3);
        break;
      }
      case "cavestone": drawWall(ctx, x, y, "#5a5560", "#46414e"); break;
      case "deepslate": drawWall(ctx, x, y, "#403c4a", "#2c2935"); break;
      case "deeprock":  drawWall(ctx, x, y, "#34313c", "#222029"); break;
      case "bedrock":   drawWall(ctx, x, y, "#262430", "#17151c"); break;
      case "gold":      drawWall(ctx, x, y, "#5a5560", "#46414e"); drawFlecks(ctx, x, y, tx, ty, "#e0a82a", "#ffd24a"); break;
      case "diamond":   drawWall(ctx, x, y, "#403c4a", "#2c2935"); drawFlecks(ctx, x, y, tx, ty, "#5ac8ff", "#8ff1ff"); break;
      case "cave_entrance": {
        ctx.fillStyle = "#1a1620"; circle(ctx, cxp, by - 16, 17);
        ctx.fillStyle = "#0c0a12"; circle(ctx, cxp, by - 16, 12);
        ctx.fillStyle = "#ffce4a"; ctx.font = G.f(15, "bold"); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("▼", cxp, by - 14);
        break;
      }
      case "temple_entrance": {
        ctx.fillStyle = "#6a5a40"; G.rr(ctx, cxp - 16, by - 30, 32, 30, 4); ctx.fill();        // каменная арка
        ctx.fillStyle = "#0c0a12"; G.rr(ctx, cxp - 11, by - 24, 22, 24, 9); ctx.fill();         // тёмный проём
        ctx.fillStyle = "#8a7a58"; ctx.fillRect(cxp - 16, by - 30, 32, 4);                       // притолока
        ctx.fillStyle = "#ffce4a"; ctx.font = G.f(15, "bold"); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("⚔", cxp, by - 13);
        break;
      }
      case "temple_exit": {
        ctx.fillStyle = "#2a6a4a"; circle(ctx, cxp, by - 16, 16); ctx.fillStyle = "#7CFC8A"; circle(ctx, cxp, by - 16, 11);
        ctx.fillStyle = "#0c2a18"; ctx.font = G.f(15, "bold"); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("▲", cxp, by - 14);
        break;
      }
      case "lockdoor": {
        ctx.fillStyle = "#5a4a34"; ctx.fillRect(x + 3, y + 1, TILE - 6, TILE - 2);               // тяжёлая дверь
        ctx.fillStyle = "#7a6648"; ctx.fillRect(x + 6, y + 4, TILE - 12, TILE - 8);
        ctx.fillStyle = "#caa84a"; ctx.fillRect(cxp - 5, y + TILE / 2 - 6, 10, 12);              // золотой замок
        ctx.fillStyle = "#3a2e14"; circle(ctx, cxp, y + TILE / 2 - 1, 2.5);                       // скважина
        break;
      }
      case "lockdoor_open": {
        ctx.fillStyle = "#5a4a34"; ctx.fillRect(x + 3, y + 1, 7, TILE - 2); ctx.fillRect(x + TILE - 10, y + 1, 7, TILE - 2);
        ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(x + 10, y + 3, TILE - 20, TILE - 6);
        break;
      }
      case "ladder_down": {
        ctx.fillStyle = "#0c0a12"; G.rr(ctx, cxp - 12, by - 28, 24, 26, 4); ctx.fill();
        ctx.strokeStyle = "#9a7a4a"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cxp - 7, by - 28); ctx.lineTo(cxp - 7, by - 2); ctx.moveTo(cxp + 7, by - 28); ctx.lineTo(cxp + 7, by - 2); ctx.stroke();
        for (let r = 0; r < 5; r++) { const ry = by - 26 + r * 6; ctx.beginPath(); ctx.moveTo(cxp - 7, ry); ctx.lineTo(cxp + 7, ry); ctx.stroke(); }
        ctx.fillStyle = "#ffce4a"; ctx.font = G.f(13, "bold"); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("▼", cxp, by - 34);
        break;
      }
      case "ladder_up": {
        ctx.strokeStyle = "#caa86a"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cxp - 7, by - 28); ctx.lineTo(cxp - 7, by - 2); ctx.moveTo(cxp + 7, by - 28); ctx.lineTo(cxp + 7, by - 2); ctx.stroke();
        for (let r = 0; r < 5; r++) { const ry = by - 26 + r * 6; ctx.beginPath(); ctx.moveTo(cxp - 7, ry); ctx.lineTo(cxp + 7, ry); ctx.stroke(); }
        ctx.fillStyle = "#9fe06a"; ctx.font = G.f(13, "bold"); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("▲", cxp, by - 34);
        break;
      }
      case "brick_block": {
        const top = by - 33;
        ctx.fillStyle = "#7a3a2e"; G.rr(ctx, cxp - 16, top, 32, 33, 4); ctx.fill();
        ctx.fillStyle = "#a14f3a"; G.rr(ctx, cxp - 14, top + 2, 28, 28, 3); ctx.fill();
        ctx.strokeStyle = "#7a3a2e"; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(cxp - 14, top + 11); ctx.lineTo(cxp + 14, top + 11); ctx.moveTo(cxp - 14, top + 20); ctx.lineTo(cxp + 14, top + 20);
        ctx.moveTo(cxp, top + 2); ctx.lineTo(cxp, top + 11); ctx.moveTo(cxp - 7, top + 11); ctx.lineTo(cxp - 7, top + 20); ctx.moveTo(cxp + 7, top + 20); ctx.lineTo(cxp + 7, top + 30); ctx.stroke();
        break;
      }
      case "glass_block": {
        const top = by - 33;
        ctx.fillStyle = "rgba(150,220,255,0.32)"; G.rr(ctx, cxp - 16, top, 32, 33, 4); ctx.fill();
        ctx.strokeStyle = "#bfe6ff"; ctx.lineWidth = 2; G.rr(ctx, cxp - 15, top + 1, 30, 31, 4); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(cxp - 11, top + 4, 4, 22);
        break;
      }
      case "wool_block": {
        const top = by - 33;
        ctx.fillStyle = "#d4d4dc"; G.rr(ctx, cxp - 16, top, 32, 33, 8); ctx.fill();
        ctx.fillStyle = "#f2f2f6"; G.rr(ctx, cxp - 14, top + 2, 28, 26, 8); ctx.fill();
        break;
      }
      case "gold_block": {
        const top = by - 33;
        ctx.fillStyle = "#caa12a"; G.rr(ctx, cxp - 16, top, 32, 33, 4); ctx.fill();
        ctx.fillStyle = "#ffd24a"; G.rr(ctx, cxp - 14, top + 2, 28, 28, 3); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillRect(cxp - 10, top + 4, 8, 5);
        break;
      }
      case "clay": drawBoulder(ctx, cxp, by, "#9aa0ad", "#6f7682"); break;
      case "sandpile": drawBoulder(ctx, cxp, by, PAL.sand, PAL.sandDk); break;
      case "bed": {
        ctx.fillStyle = "#7a4a26"; G.rr(ctx, cxp - 13, by - 22, 26, 22, 3); ctx.fill();
        ctx.fillStyle = "#d24b4b"; G.rr(ctx, cxp - 11, by - 20, 22, 16, 2); ctx.fill();
        ctx.fillStyle = "#f0f0f5"; G.rr(ctx, cxp - 11, by - 20, 22, 6, 2); ctx.fill();
        break;
      }
      case "ghost_crystal":
        drawBoulder(ctx, cxp, by, "#3a2e5e", "#241b3a");
        for (let d = 0; d < 4; d++) { ctx.fillStyle = d % 2 ? "#cdb0ff" : "#a86bff"; ctx.fillRect(cxp - 10 + ihash(tx, ty, d + 3) * 20, by - 22 + ihash(tx, ty, d + 7) * 12, 5, 5); }
        break;
      case "portal": case "portal_home": {
        const home = b.id === "portal_home", c1 = home ? "#5ad1a0" : "#a86bff", c2 = home ? "#bfffe6" : "#e0c2ff";
        ctx.globalAlpha = 0.30; ctx.fillStyle = c1; circle(ctx, cxp, by - 16, 18); ctx.globalAlpha = 1;
        ctx.strokeStyle = c1; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cxp, by - 16, 12, 16, G.time % (PI * 2), 0, PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.5; ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(cxp, by - 16, 8, 12, 0, 0, PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        break;
      }
      case "seakelp": {
        ctx.strokeStyle = "#2f8a5a"; ctx.lineWidth = 3;
        for (let k = -1; k <= 1; k++) { const wob = Math.sin(G.time * 2 + tx + k) * 4; ctx.beginPath(); ctx.moveTo(cxp + k * 6, by - 2); ctx.quadraticCurveTo(cxp + k * 6 + wob, by - 14, cxp + k * 6 + wob, by - 26); ctx.stroke(); }
        break;
      }
      case "coral": {
        const cols = ["#ff7b9c", "#ff9f43", "#c46bff", "#5ad1ff"]; ctx.fillStyle = cols[(ihash(tx, ty, 51) * cols.length) | 0];
        ctx.fillRect(cxp - 2, by - 16, 4, 16); ctx.fillRect(cxp - 9, by - 18, 4, 11); ctx.fillRect(cxp + 5, by - 20, 4, 13);
        break;
      }
      case "treasure": {
        ctx.fillStyle = "#7a4a26"; G.rr(ctx, cxp - 12, by - 16, 24, 16, 3); ctx.fill();
        ctx.fillStyle = "#caa86a"; G.rr(ctx, cxp - 12, by - 16, 24, 6, 3); ctx.fill();
        ctx.fillStyle = "#ffd24a"; ctx.fillRect(cxp - 2, by - 12, 4, 5); // замочек
        break;
      }
      case "door": {
        ctx.fillStyle = "#5a3a1e"; ctx.fillRect(x + 6, y + 2, TILE - 12, TILE - 4);            // короб
        ctx.fillStyle = "#8a5a2e"; ctx.fillRect(x + 8, y + 4, TILE - 16, TILE - 8);            // полотно
        ctx.fillStyle = "#6b4423"; ctx.fillRect(x + TILE / 2 - 1, y + 5, 2, TILE - 10);        // шов
        ctx.fillStyle = "#ffd24a"; circle(ctx, x + TILE - 15, y + TILE / 2, 2.5);              // ручка
        break;
      }
      case "door_open": {
        ctx.fillStyle = "#5a3a1e"; ctx.fillRect(x + 4, y + 2, 8, TILE - 4);                     // створка отъехала к косяку
        ctx.fillStyle = "#8a5a2e"; ctx.fillRect(x + 5, y + 4, 5, TILE - 8);
        ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(x + 12, y + 4, TILE - 18, TILE - 8);   // тёмный проём
        break;
      }
      case "lever": case "lever_on": {
        ctx.fillStyle = "#5a5560"; G.rr(ctx, cxp - 7, by - 10, 14, 9, 3); ctx.fill();          // основание
        ctx.save(); ctx.translate(cxp, by - 9); ctx.rotate(b.on ? 0.5 : -0.5);
        ctx.fillStyle = "#7a5230"; ctx.fillRect(-2, -16, 4, 16);                                 // ручка
        ctx.fillStyle = b.on ? "#ff5d5d" : "#caa86a"; circle(ctx, 0, -16, 4);                    // набалдашник (красный=вкл)
        ctx.restore(); break;
      }
      case "redlamp": case "redlamp_on": {
        ctx.fillStyle = b.on ? "#ffd24a" : "#3a3a42"; G.rr(ctx, cxp - 15, by - 31, 30, 30, 5); ctx.fill();
        ctx.fillStyle = b.on ? "#fff2b0" : "#52525c"; G.rr(ctx, cxp - 11, by - 27, 22, 22, 4); ctx.fill();
        if (b.on) { ctx.fillStyle = "#fff"; circle(ctx, cxp, by - 16, 5); }                       // яркое ядро
        ctx.lineWidth = 2; ctx.strokeStyle = b.on ? "#e0a82a" : "#26262e"; G.rr(ctx, cxp - 15, by - 31, 30, 30, 5); ctx.stroke();
        break;
      }
      case "rail": {
        ctx.strokeStyle = "#6a5038"; ctx.lineWidth = 3;
        for (let s2 = -10; s2 <= 10; s2 += 10) { ctx.beginPath(); ctx.moveTo(x + 8, y + TILE / 2 + s2); ctx.lineTo(x + TILE - 8, y + TILE / 2 + s2); ctx.stroke(); } // шпалы
        ctx.strokeStyle = "#c2c2cc"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + 12, y + 3); ctx.lineTo(x + 12, y + TILE - 3); ctx.moveTo(x + TILE - 12, y + 3); ctx.lineTo(x + TILE - 12, y + TILE - 3); ctx.stroke(); // рельсы
        break;
      }
      case "chest": {
        ctx.fillStyle = "#6b4423"; G.rr(ctx, cxp - 15, by - 23, 30, 23, 4); ctx.fill();      // корпус
        ctx.fillStyle = "#8a5a2e"; G.rr(ctx, cxp - 15, by - 23, 30, 9, 4); ctx.fill();         // крышка
        ctx.fillStyle = "#caa86a"; ctx.fillRect(cxp - 15, by - 15, 30, 2);                      // обвязка
        ctx.fillStyle = "#ffd24a"; ctx.fillRect(cxp - 3, by - 17, 6, 7);                         // замок
        break;
      }
      case "cactus":
        ctx.fillStyle = PAL.leafDk; G.rr(ctx, cxp - 6, by - 32, 12, 32, 5); ctx.fill();
        ctx.fillStyle = PAL.leaf; G.rr(ctx, cxp - 6, by - 32, 7, 32, 5); ctx.fill();
        ctx.fillStyle = PAL.leafDk; G.rr(ctx, cxp + 4, by - 24, 9, 7, 3); ctx.fill(); ctx.fillRect(cxp + 9, by - 30, 5, 10);
        break;
      case "giant_mushroom": {
        ctx.fillStyle = "#e8e0d0"; ctx.fillRect(cxp - 5, by - 26, 10, 26);                  // толстая ножка
        ctx.fillStyle = "#c8a0e0"; G.rr(ctx, cxp - 18, by - 40, 36, 18, 10); ctx.fill();     // светящаяся шляпка
        ctx.fillStyle = "#a070c8"; G.rr(ctx, cxp - 18, by - 32, 36, 6, 4); ctx.fill();
        ctx.fillStyle = "rgba(230,200,255,0.95)"; for (let d = 0; d < 4; d++) circle(ctx, cxp - 12 + d * 8, by - 34, 2); // светящиеся крапинки
        break;
      }
      case "mushroom_red": case "mushroom_brown": {
        ctx.fillStyle = "#e8e0d0"; ctx.fillRect(cxp - 2, by - 9, 4, 9);                              // ножка
        ctx.fillStyle = b.id === "mushroom_red" ? "#d2412f" : "#9a6a3a"; G.rr(ctx, cxp - 7, by - 15, 14, 8, 4); ctx.fill(); // шляпка
        ctx.fillStyle = "rgba(255,255,255,0.85)"; circle(ctx, cxp - 3, by - 12, 1.4); circle(ctx, cxp + 3, by - 11, 1.4);   // крапинки
        break;
      }
      case "vine": {
        ctx.strokeStyle = "#3a7a30"; ctx.lineWidth = 3;
        for (let v = -1; v <= 1; v++) { const sw = Math.sin(G.time * 1.5 + tx + v) * 3; ctx.beginPath(); ctx.moveTo(cxp + v * 8, by - 30); ctx.quadraticCurveTo(cxp + v * 8 + sw, by - 16, cxp + v * 8 + sw, by - 2); ctx.stroke(); ctx.fillStyle = "#4a8a3a"; circle(ctx, cxp + v * 8 + sw, by - 4, 3); }
        break;
      }
      case "emerald": drawWall(ctx, x, y, "#403c4a", "#2c2935"); drawFlecks(ctx, x, y, tx, ty, "#2aa84a", "#7df0a0"); break;
      case "flower": {
        ctx.strokeStyle = PAL.leafDk; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cxp, by - 4); ctx.lineTo(cxp, by - 14); ctx.stroke();
        const cols = ["#ff5d6c", "#ffd24a", "#ff9f43", "#c46bff", "#ffffff"];
        ctx.fillStyle = cols[(ihash(tx, ty, 71) * cols.length) | 0]; circle(ctx, cxp, by - 17, 5);
        ctx.fillStyle = "#ffe08a"; circle(ctx, cxp, by - 17, 2);
        break;
      }
      case "bush":
        ctx.fillStyle = PAL.leafDk; circle(ctx, cxp - 5, by - 8, 8); circle(ctx, cxp + 5, by - 8, 8);
        ctx.fillStyle = PAL.leaf; circle(ctx, cxp - 4, by - 10, 6); circle(ctx, cxp + 5, by - 9, 6);
        break;
      case "tuft":
        ctx.strokeStyle = PAL.grassBlade; ctx.lineWidth = 2;
        for (let d = -1; d <= 1; d++) { ctx.beginPath(); ctx.moveTo(cxp + d * 5, by - 2); ctx.lineTo(cxp + d * 7, by - 12); ctx.stroke(); }
        break;
      default: // сгенерённые блоки по данным: посевы, пол, витраж, цветные/стройка
        if (b.crop != null) drawCrop(ctx, cxp, by, b.crop);
        else if (b.floor) {
          ctx.fillStyle = b.colDk; ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = b.col; ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
          if (b.pat === "tile") { ctx.fillStyle = b.colDk; const h2 = (TILE - 10) / 2; ctx.fillRect(x + 5, y + 5, h2, h2); ctx.fillRect(x + 5 + h2, y + 5 + h2, h2, h2); }
        } else if (b.glass) {
          const top = by - 31; ctx.globalAlpha = 0.42; ctx.fillStyle = b.col; G.rr(ctx, cxp - 16, top, 32, 32, 4); ctx.fill(); ctx.globalAlpha = 1;
          ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.5)"; G.rr(ctx, cxp - 15, top + 1, 30, 30, 4); ctx.stroke();
          if (b.vitrazh) { ctx.globalAlpha = 0.5; const cs = ["#ff5d6c", "#ffd24a", "#5aa83a", "#a86bff"]; for (let q = 0; q < 4; q++) { ctx.fillStyle = cs[q]; ctx.fillRect(cxp - 13 + (q % 2) * 13, top + 3 + ((q / 2) | 0) * 14, 12, 13); } ctx.globalAlpha = 1; }
        } else if (b.col) drawCube(ctx, cxp, by, b.col, b.colDk || b.col, b.pat);
        break;
    }
  }
  G.drawObjTile = drawObj;

  /* ---- Рендер видимой части мира + спрайтов (игрок), с y-сортировкой ---- */
  World.drawVisible = function (ctx, sprites) {
    const cam = G.cam, W = World.W;
    const tx0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const ty0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
    const tx1 = Math.min(W - 1, Math.ceil((cam.x + G.VIEW.w) / TILE) + 1);
    const ty1 = Math.min(World.H - 1, Math.ceil((cam.y + G.VIEW.h) / TILE) + 1);

    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) drawGround(ctx, tx, ty);

    const list = sprites ? sprites.slice() : [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const bi = World.obj[ty * W + tx];
      if (bi) list.push({ baseY: ty * TILE + TILE, bi, tx, ty });
    }
    list.sort((a, b) => a.baseY - b.baseY);
    for (const it of list) { if (it.sprite) it.sprite(ctx); else drawObj(ctx, it.bi, it.tx, it.ty); }
  };

  /* ---- Персонаж «Стив» (вид сверху ¾, блочный, узнаваемые цвета) ---- */
  G.drawSteve = function (ctx, x, y, face, walk, swing, held) {
    const f = face < 0 ? -1 : 1;
    const sw = Math.sin(walk * PI * 2) * 5;      // мах ног при ходьбе
    const bob = Math.abs(Math.sin(walk * PI * 2)) * 1.6;
    const sg = swing || 0;
    const hasShield = !!(G.shieldReduce && G.shieldReduce() > 0);

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.ellipse(x, y + 17, 15, 7, 0, 0, PI * 2); ctx.fill();
    ctx.translate(x, y - bob);
    ctx.scale(f, 1);

    // ноги
    ctx.fillStyle = PAL.stevePants; ctx.fillRect(-9, 6 - sw, 8, 12); ctx.fillRect(1, 6 + sw, 8, 12);
    ctx.fillStyle = PAL.steveShoe; ctx.fillRect(-9, 16 - sw, 8, 4); ctx.fillRect(1, 16 + sw, 8, 4);

    // дальняя рука + ЩИТ (если экипирован)
    ctx.save(); ctx.translate(-13, -4 + sw);
    ctx.fillStyle = PAL.steveSkin; ctx.fillRect(-2, 0, 5, 12);
    if (hasShield) {
      ctx.fillStyle = "#5a6a7a"; G.rr(ctx, -9, -3, 12, 18, 3); ctx.fill();
      ctx.fillStyle = "#8a9aac"; G.rr(ctx, -7, -1, 8, 14, 2); ctx.fill();
      ctx.fillStyle = "#ffce4a"; circle(ctx, -3, 6, 2.2);
    }
    ctx.restore();

    // тело + голова
    ctx.fillStyle = PAL.steveShirtDk; G.rr(ctx, -12, -9, 24, 21, 5); ctx.fill();
    ctx.fillStyle = PAL.steveShirt; G.rr(ctx, -12, -9, 24, 14, 5); ctx.fill();
    ctx.fillStyle = PAL.steveSkin; G.rr(ctx, -11, -27, 22, 22, 5); ctx.fill();
    ctx.fillStyle = PAL.steveHair; G.rr(ctx, -11, -27, 22, 8, 5); ctx.fill(); ctx.fillRect(-11, -22, 22, 3);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(-6, -16, 4, 5); ctx.fillRect(2, -16, 4, 5);
    ctx.fillStyle = "#2a2a55"; ctx.fillRect(-4, -15, 2, 3); ctx.fillRect(4, -15, 2, 3);
    ctx.fillStyle = PAL.steveHair; ctx.fillRect(-4, -8, 8, 2);

    // 💨 след клинка при ударе мечом (motion-trail)
    if (held === "sword" && sg >= 0.33 && sg <= 0.74) {
      const tt = (sg - 0.33) / 0.41, ang = -1.3 + tt * 2.1;
      ctx.save(); ctx.translate(10, -4); ctx.lineCap = "round";
      ctx.globalAlpha = 0.26 * Math.sin(tt * PI); ctx.strokeStyle = "#cfe6ff"; ctx.lineWidth = 13;
      ctx.beginPath(); ctx.arc(0, 0, 33, ang - 0.75, ang + 0.05); ctx.stroke();
      ctx.globalAlpha = 0.6 * Math.sin(tt * PI); ctx.strokeStyle = "#fff"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, 33, ang - 0.55, ang + 0.05); ctx.stroke();
      ctx.globalAlpha = 1; ctx.restore();
    }

    // ближняя рука + ОРУЖИЕ (поворот вокруг плеча по фазе замаха)
    let armDeg;
    if (held === "sword") armDeg = !sg ? -22 : sg < 0.33 ? -22 - (sg / 0.33) * 48 : sg < 0.7 ? -70 + ((sg - 0.33) / 0.37) * 120 : 50 - ((sg - 0.7) / 0.3) * 72; // замах: −22→−70→+50→−22
    else if (held === "pick") armDeg = -46 + (sg ? Math.sin(sg * PI) * 74 : 0);   // удар сверху
    else if (held === "bow") armDeg = -8;                                          // держит лук ровно
    else if (held === "tome") armDeg = -26 - (sg ? Math.sin(sg * PI) * 14 : 0);    // выпад посохом
    else armDeg = -10 + (sg ? Math.sin(sg * PI) * 52 : 0);                         // кулак
    ctx.save();
    ctx.translate(10, -4); ctx.rotate(armDeg * PI / 180);
    ctx.fillStyle = PAL.steveSkin; ctx.fillRect(0, -2.5, 13, 5);                   // предплечье вперёд
    const hx = 13;                                                                 // кисть
    if (held === "sword") {
      ctx.fillStyle = "#caa86a"; ctx.fillRect(hx - 1, -2, 4, 4);                   // рукоять
      ctx.fillStyle = "#9a9aa4"; ctx.fillRect(hx - 2, -4, 3, 8);                   // гарда
      ctx.fillStyle = "#dfe4ee"; ctx.fillRect(hx + 2, -2.5, 22, 5);               // клинок
      ctx.fillStyle = "#fff"; ctx.fillRect(hx + 2, -2.5, 22, 1.5);                // блик
    } else if (held === "pick") {
      ctx.fillStyle = "#8a6a3a"; ctx.fillRect(hx, -10, 3, 18); ctx.fillStyle = "#c9c9d2"; ctx.fillRect(hx - 4, -14, 11, 6);
    } else if (held === "bow") {
      ctx.strokeStyle = "#9a6a32"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(hx, 0, 13, -1.25, 1.25); ctx.stroke();
      const dr = sg * 6;                                                           // натяжение тетивы
      ctx.strokeStyle = "#eee"; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(hx + Math.cos(1.25) * 13, -Math.sin(1.25) * 13); ctx.lineTo(hx - dr, 0); ctx.lineTo(hx + Math.cos(1.25) * 13, Math.sin(1.25) * 13); ctx.stroke();
      if (sg > 0.25) { ctx.fillStyle = "#caa86a"; ctx.fillRect(hx - dr, -1, 14, 2); ctx.fillStyle = "#cfcfd6"; ctx.beginPath(); ctx.moveTo(hx - dr + 14, -2.5); ctx.lineTo(hx - dr + 18, 0); ctx.lineTo(hx - dr + 14, 2.5); ctx.fill(); }
    } else if (held === "tome") {
      ctx.fillStyle = "#5a3f8a"; G.rr(ctx, hx - 1, -5, 8, 10, 2); ctx.fill();      // книга
      ctx.fillStyle = "#caa84a"; ctx.fillRect(hx + 2, -5, 1.5, 10);
      ctx.fillStyle = "rgba(180,140,255,0.95)"; circle(ctx, hx + 3, -9, 3 + (sg ? Math.abs(Math.sin(sg * PI * 2)) * 2 : 0)); // светящийся шар
    } else {
      ctx.fillStyle = PAL.steveSkin; ctx.fillRect(hx - 1, -3, 6, 6);              // кулак
    }
    ctx.restore();
    ctx.restore();
  };
})();
