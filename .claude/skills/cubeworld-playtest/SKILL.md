---
name: cubeworld-playtest
description: Проверить игру «Кубомир» после изменений кода — поднять/найти dev-сервер, перевести preview на localhost:8137, проверить консоль на ошибки и прогнать механику через дешёвый preview_eval (вместо дорогих скриншотов). Использовать при словах «проверь игру», «протестируй», «запусти кубомир», «работает ли», после правок js/*.js в IdeaProjects/Minecraft.
---

# Кубомир — playtest (eval-driven, экономно по токенам)

Цель: убедиться, что правка работает, **минимумом токенов**. eval с JSON-отчётом дешёв; `preview_screenshot` ~1500 ткн — только для визуала.

## Шаги

1. **Сервер на 8137.** Проверь: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8137/index.html`. Если не `200` — подними: `cd /Users/matveypopchenko/IdeaProjects/Minecraft && (python3 -m http.server 8137 >/tmp/cubeworld_http.log 2>&1 &)`.
2. **serverId.** `preview_list` → возьми любой serverId (preview-вкладка — общий браузер). `preview_start` из основного проекта поднимает Mars (8123), не Кубомир — поэтому вкладку переводим вручную.
3. **Перевести вкладку на Кубомир:** `preview_eval(serverId, "location.href='http://localhost:8137/index.html'")`. Подожди такт (скрипты грузятся мгновенно на localhost).
4. **Ошибки консоли:** `preview_console_logs(serverId, level:'error')`. Должно быть пусто.
5. **Прогон механики (шаблон eval):** правь под задачу.

```js
(function(){ try {
  const G=window.G, W=G.World, T=G.TILE;
  G.resetState();
  const sp=W.gen(20240604);
  G.state.px=sp.x; G.state.py=sp.y;
  G.go("world", true);
  const s=G.scene;
  // поставить игрока к ближайшему добываемому блоку
  const stx=Math.floor(sp.x/T), sty=Math.floor(sp.y/T);
  let found=null;
  outer: for(let r=1;r<40;r++) for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){
    const b=W.BLOCKS[W.oTile(stx+dx,sty+dy)]; if(b&&b.hardness>0){found={tx:stx+dx,ty:sty+dy,id:b.id};break outer;}
  }
  s.px=found.tx*T+24-40; s.py=found.ty*T+24;
  s.actHeld=true; for(let i=0;i<300;i++) s.update(0.016); s.actHeld=false;
  return JSON.stringify({ scene:s.name, found, inv:G.state.inv, sel:G.state.sel });
} catch(e){ return "ERR "+e.message+" @ "+(e.stack||"").split("\n")[1]; } })()
```

6. **Скриншот — только для визуала** (новые блоки/иконки/раскладка/анимация). Перед ним: поставь игрока на спавн и сними камеру `G.cam.x=Math.max(0,s.px-G.VIEW.w/2)` чтобы кадр был осмысленным.

## Заметки
- Цикл засыпает при скрытой вкладке → симулируй кадры `s.update(0.016)` вручную, не надейся на rAF.
- Скипай скриншот для проверки стейта (счётчики, инвентарь, переходы сцен) — хватает eval.
- Враги (когда появятся): `s.mobs.length=0` для пост-боевых стейтов.
