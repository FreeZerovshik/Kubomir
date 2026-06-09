/* ============================================================
   КУБОМИР — сущности: мобы (таблица видов, ИИ, рендер, спавн-директор).
   Враждебные мобы спавнятся НОЧЬЮ, преследуют игрока, горят на рассвете.
   Сила/урон/частота масштабируются сложностью (G.diff()). Паттерн из Mars.
   ============================================================ */
(function () {
  "use strict";
  const G = window.G;
  const PI = Math.PI, TILE = G.TILE;
  const { clamp, dist } = G;

  // Data-driven виды (OCP: новый моб = строка + case в drawMob).
  const MOB_KINDS = {
    zombie:   { name: "Зомби",  hp: 4, dmg: 2, speed: 54,  r: 16, color: "#6aa84f", colorDk: "#3f6636", atk: 0.8, behavior: "chase", drop: "meat", dropN: 1 },
    spider:   { name: "Паук",   hp: 3, dmg: 1, speed: 104, r: 14, color: "#46414e", colorDk: "#262130", atk: 0.6, behavior: "chase", fast: true, drop: "wool", dropN: 1 },
    skeleton: { name: "Скелет", hp: 3, dmg: 2, speed: 60,  r: 15, color: "#e6e6df", colorDk: "#9a9a90", behavior: "ranged", drop: "arrow", dropN: 2 },
    creeper:  { name: "Крипер", hp: 4, dmg: 6, speed: 52,  r: 16, color: "#5fa84a", colorDk: "#3c7a30", behavior: "fuse", drop: "coal", dropN: 1 },
    // мирные звери (дропают мясо)
    cow:     { name: "Корова", hp: 4, passive: true, speed: 30, r: 16, color: "#cfc3b4", colorDk: "#5a4a3a", drop: "meat", dropN: 2 },
    pig:     { name: "Свинья", hp: 4, passive: true, speed: 34, r: 15, color: "#f0a8b4", colorDk: "#c87888", drop: "meat", dropN: 2 },
    chicken: { name: "Курица", hp: 2, passive: true, speed: 40, r: 11, color: "#f4f0e6", colorDk: "#d8a23a", drop: "meat", dropN: 1 },
    sheep:   { name: "Овца",   hp: 4, passive: true, speed: 28, r: 15, color: "#eef0ee", colorDk: "#c9cbc9", drop: "wool", dropN: 2 },
    villager: { name: "Житель", hp: 6, passive: true, speed: 22, r: 15, color: "#7a5a3a", colorDk: "#5a4128", trader: true },
    golem:   { name: "Страж Храма", hp: 18, dmg: 4, speed: 38, r: 24, color: "#9a8a6a", colorDk: "#5a4a34", behavior: "chase", atk: 1.0, drop: "heart_relic", dropN: 1, miniboss: true },
    slime:   { name: "Слизень", hp: 5, dmg: 2, speed: 46, r: 16, color: "#5aa84a", colorDk: "#3a7a2e", behavior: "chase", atk: 0.9, drop: "mushroom", dropN: 1, split: true }, // 🐸 болото: делится при смерти
    slime_small: { name: "Слизёнок", hp: 2, dmg: 1, speed: 62, r: 10, color: "#7ac85a", colorDk: "#4a8a32", behavior: "chase", atk: 0.7 },
    wasp:    { name: "Оса", hp: 2, dmg: 2, speed: 122, r: 11, color: "#e0b020", colorDk: "#3a2e10", behavior: "chase", fast: true, atk: 0.6 }, // 🌴 джунгли: быстрый летун
    ghost:   { name: "Призрак", hp: 3, dmg: 2, speed: 62, r: 15, color: "#cfc2f0", colorDk: "#8a78c0", behavior: "chase", atk: 0.9, drop: "ghost_shard", dropN: 1, ghostly: true },
    ghost_king: { name: "Призрачный Король", hp: 30, dmg: 4, speed: 46, r: 26, color: "#c2a8ff", colorDk: "#6a3f9a", behavior: "chase", atk: 1.0, drop: "ghost_shard", dropN: 6, boss: true, ghostly: true },
    abyss_lord: { name: "Повелитель Бездны", hp: 40, dmg: 5, speed: 44, r: 28, color: "#9a4fc8", colorDk: "#2e1640", behavior: "ranged", atk: 1.0, boss: true, ghostly: true }, // 🕳 финал Главы 2
  };
  G.MOB_KINDS = MOB_KINDS;

  G.makeMob = function (x, y, kind) {
    const K = MOB_KINDS[kind] || MOB_KINDS.zombie;
    const hp = Math.max(1, Math.round(K.hp * (G.diff().eHp || 1)));
    return { x: x, y: y, kind: kind, K: K, hp: hp, maxHp: hp, face: 1, hurtT: 0, stun: 0, atkCd: 0, shotCd: 0, fuse: 0, burn: 0, _dead: false };
  };

  // ИИ + контактный урон по игроку. s — мировая сцена (s.px,s.py,s.r,s.hurt).
  G.updateMob = function (s, mu, dt) {
    if (mu.hurtT > 0) mu.hurtT -= dt;
    if (mu.atkCd > 0) mu.atkCd -= dt;
    if (mu.shotCd > 0) mu.shotCd -= dt;
    if (mu.onFire > 0) { mu.onFire -= dt; mu._fireDot = (mu._fireDot || 0) + dt; if (mu._fireDot >= 0.5) { mu._fireDot = 0; mu.hp -= 1; G.fx.burst(mu.x, mu.y - 4, "#ff8a3a", 4, 90, 0.3); if (mu.hp <= 0) { G.killMob(s, mu); return; } } } // 🔥 горение от огненного меча
    const K = mu.K;
    if (K.passive) { G._updatePassive(s, mu, dt); return; }   // мирные звери — без горения/атаки
    if (G.state.depth === 0 && G.daylight() > 0.6) { mu.burn += dt; if (mu.burn > 2.5) { mu._dead = true; G.fx.burst(mu.x, mu.y - 8, "#ffae5a", 10, 120, 0.5); return; } } // горят только на поверхности днём
    else mu.burn = 0;
    if (mu.stun > 0) { mu.stun -= dt; return; }
    if (K.boss) {                                  // 👑 босс периодически призывает призраков-адов
      mu.sumCd = (mu.sumCd == null ? 6 : mu.sumCd) - dt;
      const cap = mu.hp <= mu.maxHp * 0.5 ? 5 : 7;  // в ярости призывает чаще, но не плодит бесконечно
      if (mu.sumCd <= 0 && s.mobs.length < 14) { mu.sumCd = cap; for (let q = 0; q < 2; q++) s.mobs.push(G.makeMob(mu.x + (q ? 46 : -46), mu.y, "ghost")); G.fx.ring(mu.x, mu.y, "#a86bff", 60, 0.45); G.audio.tone(140, 0.12, "sawtooth", 0.05); }
      else if (mu.sumCd <= 0) mu.sumCd = cap;
    }
    const beh = K.behavior || "chase";
    const dx = s.px - mu.x, dy = s.py - mu.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
    const move = (vx, vy) => { const tx = mu.x + vx * K.speed * dt, ty = mu.y + vy * K.speed * dt; if (!G.World.solidPx(tx, mu.y)) mu.x = tx; if (!G.World.solidPx(mu.x, ty)) mu.y = ty; mu.face = vx; };

    if (beh === "ranged") {                       // скелет: держит дистанцию и стреляет
      if (d < 180) move(-nx, -ny);
      else if (d > 300) move(nx, ny);
      else mu.face = nx;
      if (d < 340 && mu.shotCd <= 0) { mu.shotCd = 1.6; G.fireArrow(s, mu, nx, ny); }
      return;
    }
    if (beh === "fuse") {                          // крипер: подходит, фитиль → взрыв
      if (mu.fuse > 0 || d < s.r + K.r + 16) {
        const prev = mu.fuse; mu.fuse += dt;
        if (prev === 0 || ((mu.fuse / 0.4) | 0) > ((prev / 0.4) | 0)) G.audio.hiss(); // 🔊 шипение фитиля: старт + тик → «Ssss…ss…BOOM»
        if (mu.fuse > 1.2) { G.creeperBoom(s, mu); mu._dead = true; }
        return;
      }
      move(nx, ny);
      return;
    }
    // chase (зомби/паук)
    let mvx = nx, mvy = ny;
    if (K.fast) { const j = Math.sin(G.time * 8 + mu.x * 0.1) * 0.55; mvx += -ny * j; mvy += nx * j; const m = Math.hypot(mvx, mvy) || 1; mvx /= m; mvy /= m; }
    move(mvx, mvy);
    if (d < s.r + K.r && mu.atkCd <= 0) {
      mu.atkCd = K.atk;
      s.hurt(Math.max(1, Math.round(K.dmg * (G.diff().eDmg || 1))), mu);
      mu.x -= nx * 8; mu.y -= ny * 8;
    }
  };

  // Мирные звери: блуждают, убегают при ударе, дроп мяса — в hitMob
  G._updatePassive = function (s, mu, dt) {
    const K = mu.K;
    if (mu.babyT > 0) mu.babyT -= dt;   // 🐣 малыш взрослеет
    if (mu.flee > 0) mu.flee -= dt;
    mu.wT = (mu.wT || 0) - dt;
    if (mu.wT <= 0) { mu.wT = 1.5 + Math.random() * 2; const a = Math.random() * PI * 2; mu.wvx = Math.cos(a); mu.wvy = Math.sin(a); if (Math.random() < 0.4) { mu.wvx = 0; mu.wvy = 0; } }
    let vx = mu.wvx || 0, vy = mu.wvy || 0, sp = K.speed * 0.5;
    if (mu.flee > 0) { const dx = mu.x - s.px, dy = mu.y - s.py, d = Math.hypot(dx, dy) || 1; vx = dx / d; vy = dy / d; sp = K.speed * 1.4; }
    if (!G.World.solidPx(mu.x + vx * sp * dt, mu.y)) mu.x += vx * sp * dt; else mu.wT = 0;
    if (!G.World.solidPx(mu.x, mu.y + vy * sp * dt)) mu.y += vy * sp * dt; else mu.wT = 0;
    if (vx) mu.face = vx;
  };

  // Стрелы скелета (живут на сцене: s.shots)
  G.fireArrow = function (s, mu, nx, ny) {
    if (!s.shots) s.shots = [];
    s.shots.push({ x: mu.x, y: mu.y - 6, vx: nx * 280, vy: ny * 280, life: 2.2, dmg: Math.max(1, Math.round(mu.K.dmg * (G.diff().eDmg || 1))) });
    G.audio.tone(320, 0.07, "square", 0.04);
  };
  G.updateShots = function (s, dt) {
    if (!s.shots) return;
    for (let i = s.shots.length - 1; i >= 0; i--) {
      const a = s.shots[i]; a.x += a.vx * dt; a.y += a.vy * dt; a.life -= dt;
      if (a.life <= 0 || G.World.solidPx(a.x, a.y)) { s.shots.splice(i, 1); continue; }
      if (G.dist(a.x, a.y, s.px, s.py) < s.r + 5) { s.hurt(a.dmg, { x: a.x, y: a.y, ranged: true }); s.shots.splice(i, 1); }
    }
  };
  G.drawShots = function (ctx, s) {
    if (!s.shots) return;
    for (const a of s.shots) {
      const ang = Math.atan2(a.vy, a.vx);
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang);
      ctx.fillStyle = "#caa86a"; ctx.fillRect(-7, -1.5, 12, 3);
      ctx.fillStyle = "#cfcfd6"; ctx.beginPath(); ctx.moveTo(5, -3); ctx.lineTo(9, 0); ctx.lineTo(5, 3); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  };
  // Взрыв крипера: AoE-урон по игроку + отброс + большой fx (террейн не рушим — дружелюбно)
  G.creeperBoom = function (s, mu) {
    const R = 92;
    G.fx.ring(mu.x, mu.y, "#9fe06a", R, 0.45); G.fx.burst(mu.x, mu.y, "#5fa84a", 26, 230, 0.7);
    G.shake(16); G.hitStop(0.06);
    G.audio.tone(70, 0.4, "sawtooth", 0.11); G.audio.tone(110, 0.3, "square", 0.07);
    const d = G.dist(mu.x, mu.y, s.px, s.py);
    if (d < R) {
      s.hurt(Math.max(1, Math.round(mu.K.dmg * (G.diff().eDmg || 1) * (1 - d / R))), mu);
      const a = Math.atan2(s.py - mu.y, s.px - mu.x); s.px += Math.cos(a) * 30; s.py += Math.sin(a) * 30;
    }
  };

  // Игрок бьёт моба.
  G.killMob = function (s, mu) {        // 💀 смерть моба: FX + дроп + опыт + спец-награды (общий путь: удар И огонь)
    if (mu._dead) return;               // идемпотентно: моб умирает один раз (иначе двойной дроп/опыт при 2 попаданиях в кадр)
    mu._dead = true;
    G.fx.burst(mu.x, mu.y - 8, mu.K.color, 22, 200, 0.65); G.fx.burst(mu.x, mu.y - 6, mu.K.colorDk, 14, 150, 0.5);
    G.fx.ring(mu.x, mu.y, "#fff", 28, 0.22); G.fx.ring(mu.x, mu.y, mu.K.color, 48, 0.45); G.audio.death();
    if (mu.K.drop) { const dn = mu.K.dropN || 1; G.invAdd(mu.K.drop, dn); const di = G.ITEMS[mu.K.drop]; if (s.addFloater) s.addFloater(mu.x, mu.y - 14, "+" + (di ? di.icon : "?") + (dn > 1 ? "×" + dn : ""), "#bdf0a8"); }
    if (!mu.K.passive && G.state.quests) G.state.quests.fight = 1;
    if (!mu.K.passive) G.state.qkills = (G.state.qkills || 0) + 1;
    if (s.addXp) s.addXp(mu.K.boss ? 30 : mu.K.miniboss ? 25 : mu.K.passive ? 2 : 6);
    if (mu.kind === "golem") { G.state.maxHp += 4; G.state.hp = G.state.maxHp; G.state.templeCleared = 1; G.shake(18); G.fx.ring(mu.x, mu.y, "#ff7aa8", 120, 0.9); G.fx.burst(mu.x, mu.y - 8, "#ff8ab0", 24, 200, 0.8); }
    if (mu.K.split && s.mobs.length < 24) { for (let q = 0; q < 2; q++) s.mobs.push(G.makeMob(mu.x + (q ? 16 : -16), mu.y + 6, "slime_small")); }
    if (mu.kind === "ghost_king") { G.state.bossDefeated = 1; G.invAdd("crown", 1); G.shake(20); G.fx.ring(mu.x, mu.y, "#ffce4a", 130, 0.9); G.fx.burst(mu.x, mu.y - 8, "#ffd24a", 26, 220, 0.8); G.audio.tone(520, 0.5, "triangle", 0.06); }
    if (mu.kind === "abyss_lord") { G.state.abyssDefeated = 1; G.invAdd("crown", 1); G.shake(24); G.fx.ring(mu.x, mu.y, "#d24bff", 150, 1.0); G.fx.ring(mu.x, mu.y, "#fff", 90, 0.6); G.fx.burst(mu.x, mu.y - 8, "#c46bff", 30, 240, 0.9); G.audio.levelup(); } // 🕳 финал Главы 2
  };
  G.hitMob = function (s, mu, dmg) {
    if (mu.K.trader) { mu.flee = 4; mu.hurtT = 0.18; const dx = mu.x - s.px, dy = mu.y - s.py, d = Math.hypot(dx, dy) || 1; mu.x += (dx / d) * 18; mu.y += (dy / d) * 18; G.audio.blip(); return; } // житель неуязвим — только отбегает
    if (mu._dead || mu.hp <= 0) return;   // не бьём труп: гасит двойной килл в один кадр + фантомные числа урона/накрутку комбо
    const crit = Math.random() < (0.08 + Math.min(0.42, (s._combo || 0) * 0.03)); if (crit) dmg = Math.round(dmg * 2); // 💥 крит (шанс растёт с комбо)
    mu.hp -= dmg; mu.hurtT = 0.18; mu.flee = 4;
    if (s.addFloater) s.addFloater(mu.x + (Math.random() * 10 - 5), mu.y - mu.K.r - 6, crit ? "−" + dmg + "!" : "−" + dmg, crit ? "#ffe04a" : "#ff8a7a"); // 🔢 число урона (крит жёлтым)
    if (crit) { G.fx.burst(mu.x, mu.y - 6, "#ffe04a", 14, 200, 0.5); G.fx.ring(mu.x, mu.y, "#ffe04a", 30, 0.3); G.shake(9); G.hitStop(0.06); G.audio.crit(); }
    if (!mu.K.passive) { s._combo = (s._combo || 0) + 1; s._comboT = 1.8; }   // 🔥 комбо-счётчик
    const dx = mu.x - s.px, dy = mu.y - s.py, d = Math.hypot(dx, dy) || 1;
    mu.x += (dx / d) * 14; mu.y += (dy / d) * 14; mu.stun = Math.max(mu.stun, 0.12);
    G.fx.burst(mu.x, mu.y - 6, mu.K.colorDk, 8, 130, 0.4);
    if (G.fx.ring) G.fx.ring(mu.x, mu.y - 4, "#fff", 22, 0.22);   // 💥 вспышка удара
    G.shake(5); G.hitStop(0.04);
    if (mu.hp <= 0) G.killMob(s, mu);
    else { G.audio.hit(); if ((s._combo || 0) > 1) G.audio.tone(280 + Math.min(s._combo, 12) * 22, 0.04, "square", 0.035); } // звук растёт с комбо
  };

  // Спавн-директор: ночью, по сложности, в кольце вокруг игрока, не в воде/стене.
  G.spawnMobs = function (s, dt) {
    const diff = G.diff();
    if (diff.spawn <= 0) return;          // мирный — без мобов
    const cap = Math.round(2 + diff.spawn * 3);   // ночной набор гейтится по-видово ниже; биомные (слизень/оса) — днём и ночью
    let hostile = 0; for (const m of s.mobs) if (!m.K.passive) hostile++;
    if (hostile >= cap) return;
    s._spawnT = (s._spawnT || 0) + dt;
    if (s._spawnT < 2.4 / diff.spawn) return;
    s._spawnT = 0;
    for (let tries = 0; tries < 8; tries++) {            // ищем свободную точку (не вода/стена) за один тик
      const a = Math.random() * PI * 2, rr = 300 + Math.random() * 220;
      const x = s.px + Math.cos(a) * rr, y = s.py + Math.sin(a) * rr;
      if (G.World.gTile(Math.floor(x / TILE), Math.floor(y / TILE)) === G.World.GROUND.water) continue;
      if (G.World.solidPx(x, y)) continue;
      if (G.World.litAt(x, y)) continue; // факелы/печь подавляют спавн (как в Minecraft)
      const gt = G.World.gTile(Math.floor(x / TILE), Math.floor(y / TILE));
      let kind = null;
      if (G.state.depth === 0 && gt === G.World.GROUND.swamp && Math.random() < 0.6) kind = "slime";      // 🐸 болото: слизни день и ночь
      else if (G.state.depth === 0 && gt === G.World.GROUND.jungle && Math.random() < 0.5) kind = "wasp"; // 🌴 джунгли: осы
      else if (G.sceneDark(s) >= 0.34) { const roll = Math.random(); kind = G.state.depth === 9 ? "ghost" : roll < 0.4 ? "zombie" : roll < 0.65 ? "spider" : roll < 0.88 ? "skeleton" : "creeper"; } // ночной/подземный набор
      if (!kind) continue;                                  // днём вне биома — не спавним
      s.mobs.push(G.makeMob(x, y, kind));
      return;
    }
  };

  // Мирные звери: днём на траве вокруг игрока (только поверхность)
  G.spawnAnimals = function (s, dt) {
    if (G.state.depth !== 0 || G.daylight() < 0.5) return;
    let passive = 0; for (const m of s.mobs) if (m.K.passive) passive++;
    if (passive >= 5) return;
    s._aniT = (s._aniT || 0) + dt;
    if (s._aniT < 6) return; s._aniT = 0;
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * PI * 2, rr = 260 + Math.random() * 200;
      const x = s.px + Math.cos(a) * rr, y = s.py + Math.sin(a) * rr;
      if (G.World.gTile(Math.floor(x / TILE), Math.floor(y / TILE)) !== G.World.GROUND.grass) continue;
      if (G.World.solidPx(x, y)) continue;
      s.mobs.push(G.makeMob(x, y, ["cow", "pig", "chicken", "sheep"][(Math.random() * 4) | 0]));
      return;
    }
  };

  // Рендер (в мировых координатах, внутри translate камеры).
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2); ctx.fill(); }
  G.drawMob = function (ctx, mu) {
    const K = mu.K, x = mu.x, y = mu.y, f = (mu.face || 1) < 0 ? -1 : 1;
    let flash = mu.hurtT > 0, swell = 1;
    if (mu.kind === "creeper" && mu.fuse > 0) { swell = 1 + Math.min(0.35, mu.fuse * 0.3); if (Math.sin(mu.fuse * 30) > 0) flash = true; } // фитиль: мигает + раздувается
    if (mu.babyT > 0) swell *= 0.5 + 0.5 * (1 - Math.min(1, mu.babyT / 22)); // 🐣 малыш меньше и растёт
    ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.ellipse(x, y + K.r * 0.9, K.r * 0.9, K.r * 0.42, 0, 0, PI * 2); ctx.fill();
    const idleBob = K.passive ? Math.sin(G.time * 2.6 + x * 0.12) * 1.3 : 0;   // дыхание/покачивание зверей
    ctx.save(); ctx.translate(x, y + idleBob); ctx.scale(f * swell, swell);
    if (mu.kind === "zombie") {
      ctx.fillStyle = flash ? "#fff" : K.colorDk; G.rr(ctx, -12, -6, 24, 22, 5); ctx.fill();
      ctx.fillStyle = flash ? "#fff" : K.color; G.rr(ctx, -12, -6, 24, 14, 5); ctx.fill();
      ctx.fillStyle = flash ? "#fff" : K.colorDk; ctx.fillRect(2, -2, 16, 7);
      ctx.fillStyle = flash ? "#fff" : "#7ec06a"; G.rr(ctx, -10, -26, 20, 20, 5); ctx.fill();
      if (!flash) { ctx.fillStyle = "#1c2a16"; ctx.fillRect(-5, -18, 4, 4); ctx.fillRect(3, -18, 4, 4); }
    } else if (mu.kind === "spider") {
      ctx.strokeStyle = flash ? "#fff" : K.colorDk; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const ly = -4 + i * 6; ctx.beginPath(); ctx.moveTo(-4, ly - 2); ctx.lineTo(-16, ly - 6); ctx.moveTo(4, ly - 2); ctx.lineTo(16, ly - 6); ctx.stroke(); }
      ctx.fillStyle = flash ? "#fff" : K.color; circle(ctx, 0, 0, 13);
      ctx.fillStyle = flash ? "#fff" : K.colorDk; circle(ctx, 8, -2, 7);
      if (!flash) { ctx.fillStyle = "#ff5d5d"; ctx.fillRect(6, -5, 3, 3); ctx.fillRect(11, -5, 3, 3); }
    } else if (mu.kind === "skeleton") {
      ctx.fillStyle = flash ? "#fff" : K.color; G.rr(ctx, -10, -6, 20, 22, 4); ctx.fill();        // тело
      if (!flash) { ctx.strokeStyle = K.colorDk; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-8, -1 + i * 6); ctx.lineTo(8, -1 + i * 6); ctx.stroke(); } } // рёбра
      ctx.fillStyle = flash ? "#fff" : K.color; G.rr(ctx, -9, -26, 18, 20, 4); ctx.fill();         // череп
      if (!flash) { ctx.fillStyle = "#3a3a36"; ctx.fillRect(-5, -18, 4, 5); ctx.fillRect(3, -18, 4, 5); }
      ctx.strokeStyle = flash ? "#fff" : "#9a7a4a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(13, 0, 9, -1.4, 1.4); ctx.stroke(); // лук
    } else if (mu.kind === "creeper") {
      ctx.fillStyle = flash ? "#fff" : K.colorDk; G.rr(ctx, -11, -28, 22, 44, 4); ctx.fill();      // высокое тело
      ctx.fillStyle = flash ? "#fff" : K.color; G.rr(ctx, -11, -28, 22, 40, 4); ctx.fill();
      if (!flash) { ctx.fillStyle = "#14320f"; ctx.fillRect(-7, -22, 5, 6); ctx.fillRect(2, -22, 5, 6); ctx.fillRect(-3, -15, 6, 11); } // морда
    } else if (mu.kind === "cow") {
      ctx.fillStyle = flash ? "#fff" : K.color; G.rr(ctx, -13, -8, 26, 22, 6); ctx.fill();
      if (!flash) { ctx.fillStyle = K.colorDk; ctx.fillRect(-9, -4, 8, 7); ctx.fillRect(3, 2, 7, 6); }   // пятна
      ctx.fillStyle = flash ? "#fff" : K.color; G.rr(ctx, 9, -12, 14, 14, 4); ctx.fill();                 // голова
      if (!flash) { ctx.fillStyle = "#e8e4dc"; ctx.fillRect(9, -14, 3, 3); ctx.fillRect(20, -14, 3, 3); ctx.fillStyle = "#2a1f16"; ctx.fillRect(13, -8, 3, 3); ctx.fillRect(18, -8, 3, 3); }
    } else if (mu.kind === "pig") {
      ctx.fillStyle = flash ? "#fff" : K.color; G.rr(ctx, -12, -7, 24, 20, 7); ctx.fill();
      ctx.fillStyle = flash ? "#fff" : K.color; G.rr(ctx, 8, -10, 14, 14, 5); ctx.fill();
      if (!flash) { ctx.fillStyle = K.colorDk; ctx.fillRect(18, -4, 5, 6); ctx.fillStyle = "#5a3a44"; ctx.fillRect(13, -7, 2, 2); ctx.fillRect(18, -7, 2, 2); }
    } else if (mu.kind === "chicken") {
      ctx.fillStyle = flash ? "#fff" : K.color; G.rr(ctx, -8, -6, 16, 17, 6); ctx.fill();
      ctx.fillStyle = flash ? "#fff" : K.color; circle(ctx, 8, -9, 6);
      if (!flash) { ctx.fillStyle = "#e24b4b"; ctx.fillRect(6, -16, 5, 3); ctx.fillStyle = K.colorDk; ctx.fillRect(13, -9, 5, 3); ctx.fillStyle = "#222"; ctx.fillRect(9, -10, 2, 2); }
    } else if (mu.kind === "sheep") {
      ctx.fillStyle = flash ? "#fff" : K.color;                          // пушистое облако-тело
      circle(ctx, -5, 2, 11); circle(ctx, 5, 2, 11); circle(ctx, 0, -5, 11); circle(ctx, -8, -2, 8); circle(ctx, 8, -2, 8);
      ctx.fillStyle = flash ? "#fff" : K.colorDk; G.rr(ctx, 8, -6, 12, 12, 4); ctx.fill();   // голова
      if (!flash) { ctx.fillStyle = "#2a2a2a"; ctx.fillRect(12, -3, 2, 2); ctx.fillRect(17, -3, 2, 2); }
    } else if (mu.kind === "villager") {
      ctx.fillStyle = flash ? "#fff" : K.color; G.rr(ctx, -9, -8, 18, 22, 5); ctx.fill();          // ряса
      ctx.fillStyle = flash ? "#fff" : "#caa07a"; G.rr(ctx, -7, -21, 14, 15, 5); ctx.fill();         // голова
      if (!flash) {
        ctx.fillStyle = "#b88a64"; G.rr(ctx, -2, -16, 4, 9, 2); ctx.fill();                          // большой нос
        ctx.fillStyle = "#2a2a2a"; ctx.fillRect(-5, -17, 3, 2); ctx.fillRect(2, -17, 3, 2);          // глаза
        ctx.fillStyle = "#3a5a7a"; ctx.fillRect(-9, -1, 18, 4);                                       // пояс
        ctx.fillStyle = "#caa07a"; G.rr(ctx, -9, 2, 5, 10, 2); ctx.fill(); G.rr(ctx, 4, 2, 5, 10, 2); ctx.fill(); // руки
      }
    } else if (mu.kind === "slime" || mu.kind === "slime_small") {
      const sq = 1 + Math.sin(G.time * 6 + mu.x) * 0.13;                                              // желейная пульсация
      ctx.fillStyle = flash ? "#fff" : K.color; G.rr(ctx, -K.r * 0.9, -K.r * 0.7 * sq, K.r * 1.8, K.r * 1.4 * sq, K.r * 0.5); ctx.fill();
      ctx.globalAlpha = 0.4; ctx.fillStyle = "#fff"; G.rr(ctx, -K.r * 0.5, -K.r * 0.5 * sq, K.r * 0.5, K.r * 0.3, 3); ctx.fill(); ctx.globalAlpha = 1; // блик
      if (!flash) { ctx.fillStyle = "#173a12"; ctx.fillRect(-K.r * 0.35, -K.r * 0.15, 3, 3); ctx.fillRect(K.r * 0.18, -K.r * 0.15, 3, 3); }
    } else if (mu.kind === "wasp") {
      ctx.globalAlpha = 0.55; ctx.fillStyle = "#dfe8f4"; const fl = Math.abs(Math.sin(G.time * 26)) * 4;
      ctx.beginPath(); ctx.ellipse(-2, -7 - fl, 6, 3, -0.5, 0, PI * 2); ctx.ellipse(2, -7 - fl, 6, 3, 0.5, 0, PI * 2); ctx.fill(); ctx.globalAlpha = 1; // крылья
      ctx.fillStyle = flash ? "#fff" : K.color; G.rr(ctx, -8, -5, 16, 11, 5); ctx.fill();
      ctx.fillStyle = flash ? "#fff" : K.colorDk; ctx.fillRect(-3, -5, 3, 11); ctx.fillRect(3, -5, 3, 11);   // полоски
      if (!flash) { ctx.fillStyle = "#1a1a1a"; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(13, 1); ctx.lineTo(8, 3); ctx.fill(); ctx.fillRect(5, -3, 2, 2); } // жало+глаз
    } else if (mu.kind === "abyss_lord") {
      const enr = mu.hp <= mu.maxHp * 0.4;
      const pz = G.time * (enr ? 4.2 : 2.6);
      if (!flash) {                                          // 🕳 аура Бездны: пульсирующее свечение + орбитальные искры
        const ar = 42 + 5 * Math.sin(pz);
        const grd = ctx.createRadialGradient(0, -4, 6, 0, -4, ar);
        grd.addColorStop(0, enr ? "rgba(255,70,70,0.50)" : "rgba(176,86,210,0.48)");
        grd.addColorStop(0.55, enr ? "rgba(120,24,44,0.20)" : "rgba(92,42,140,0.20)");
        grd.addColorStop(1, "rgba(18,7,28,0)");
        ctx.fillStyle = grd; circle(ctx, 0, -4, ar);
        ctx.fillStyle = enr ? "#ff8a8a" : "#cf9bff";
        for (let i = 0; i < 4; i++) { const aa = pz + i * (Math.PI / 2), orb = 31 + 3 * Math.sin(pz * 1.5 + i); circle(ctx, Math.cos(aa) * orb, -4 + Math.sin(aa) * orb * 0.55, 2.3); }
      }
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = flash ? "#fff" : K.colorDk; G.rr(ctx, -24, -26, 48, 50, 18); ctx.fill();        // тёмный сгусток
      ctx.fillStyle = flash ? "#fff" : K.color; for (let w = -2; w <= 2; w++) circle(ctx, w * 10, 22, 8); // щупальца-низ
      ctx.globalAlpha = 1;
      if (!flash) { ctx.fillStyle = "#1a0a24"; circle(ctx, 0, -6, 13); ctx.fillStyle = enr ? "#ff4b4b" : "#d24bff"; circle(ctx, 0, -6, 9); ctx.fillStyle = "#1a0a24"; circle(ctx, 0, -6, 4); ctx.fillStyle = "#fff"; circle(ctx, 3, -9, 2.5); } // огромный глаз
      ctx.fillStyle = "#5a2f7a"; for (let c = -2; c <= 2; c++) { ctx.beginPath(); ctx.moveTo(c * 11 - 4, -26); ctx.lineTo(c * 11, -41); ctx.lineTo(c * 11 + 4, -26); ctx.closePath(); ctx.fill(); } // корона-шипы
    } else if (mu.kind === "golem") {
      ctx.fillStyle = flash ? "#fff" : K.colorDk; G.rr(ctx, -18, -20, 36, 38, 6); ctx.fill();      // каменное тело
      ctx.fillStyle = flash ? "#fff" : K.color; G.rr(ctx, -14, -16, 28, 18, 5); ctx.fill();          // грудь светлее
      ctx.fillStyle = flash ? "#fff" : K.colorDk; G.rr(ctx, -25, -12, 8, 22, 3); ctx.fill(); G.rr(ctx, 17, -12, 8, 22, 3); ctx.fill(); // руки
      if (!flash) { ctx.fillStyle = "#ffce4a"; ctx.fillRect(-9, -12, 6, 5); ctx.fillRect(3, -12, 6, 5);  // светящиеся глаза
        ctx.fillStyle = "#ff8a3a"; circle(ctx, 0, 2, 4); }                                               // ядро
      ctx.fillStyle = flash ? "#fff" : "#6a5a44"; for (let c = -1; c <= 1; c++) ctx.fillRect(c * 10 - 2, -22, 5, 4); // зубцы на голове
    } else if (mu.kind === "ghost") {
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = flash ? "#fff" : K.color; G.rr(ctx, -11, -14, 22, 24, 11); ctx.fill();        // тело-простыня
      for (let w = -1; w <= 1; w++) circle(ctx, w * 7, 9, 5);                                        // волнистый низ
      ctx.globalAlpha = 1;
      if (!flash) { ctx.fillStyle = "#3a2e5e"; ctx.fillRect(-6, -7, 4, 6); ctx.fillRect(2, -7, 4, 6); } // глаза
    } else if (mu.kind === "ghost_king") {
      const enr = mu.hp <= mu.maxHp * 0.5;
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = flash ? "#fff" : K.color; G.rr(ctx, -20, -24, 40, 44, 16); ctx.fill();          // крупное тело
      for (let w = -2; w <= 2; w++) circle(ctx, w * 9, 18, 7);                                          // волнистый низ
      ctx.globalAlpha = 1;
      if (!flash) { ctx.fillStyle = enr ? "#ff4b4b" : "#e24bff"; ctx.fillRect(-11, -11, 7, 9); ctx.fillRect(4, -11, 7, 9); } // глаза краснеют в ярости
      ctx.fillStyle = "#ffd24a"; ctx.fillRect(-19, -25, 38, 4);                                          // обод короны
      for (let c = -1; c <= 1; c++) { ctx.beginPath(); ctx.moveTo(c * 13 - 5, -25); ctx.lineTo(c * 13, -39); ctx.lineTo(c * 13 + 5, -25); ctx.closePath(); ctx.fill(); }
    }
    if (mu.burn > 0 || mu.onFire > 0) { ctx.fillStyle = "rgba(255,150,60,0.45)"; circle(ctx, 0, -4, K.r + 3); if (mu.onFire > 0) { ctx.fillStyle = "rgba(255,210,90,0.6)"; for (let q = -1; q <= 1; q++) circle(ctx, q * 6, -K.r - 2 - Math.abs(Math.sin(G.time * 12 + q + mu.x)) * 4, 3); } } // 🔥 язычки пламени
    ctx.restore();
    if (mu.hp < mu.maxHp) {
      const w = Math.max(30, K.r * 1.7), p = clamp(mu.hp / mu.maxHp, 0, 1), by2 = y - K.r - 16, h = (K.boss || K.miniboss) ? 7 : 5;
      ctx.fillStyle = "rgba(0,0,0,0.55)"; G.rr(ctx, x - w / 2 - 1, by2 - 1, w + 2, h + 2, 3); ctx.fill();
      ctx.fillStyle = p > 0.5 ? "#5ad15a" : p > 0.25 ? "#e0b020" : "#e24b4b"; G.rr(ctx, x - w / 2, by2, w * p, h, 2); ctx.fill();
    }
    if (mu.stun > 0) { ctx.fillStyle = "#ffe08a"; ctx.font = G.f(13); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("✦", x, y - K.r - 20); }
  };
})();
