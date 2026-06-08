/* ============================================================
   КУБОМИР — bootstrap: настройка холста (letterbox 4:3) + запуск.
   Трогать только при изменении canvas-сетапа.
   ============================================================ */
(function () {
  "use strict";
  const G = window.G;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d", { alpha: false });
  G.canvas = cv;
  G.ctx = ctx;

  // Вписываем логический кадр 1024×768 в окно с сохранением пропорций (letterbox).
  function resize() {
    const ww = window.innerWidth, wh = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let cw = ww, ch = (ww * G.VIEW.h) / G.VIEW.w;
    if (ch > wh) { ch = wh; cw = (wh * G.VIEW.w) / G.VIEW.h; }
    cv.style.width = cw + "px";
    cv.style.height = ch + "px";
    cv.style.left = ((ww - cw) / 2) + "px";
    cv.style.top = ((wh - ch) / 2) + "px";
    cv.width = Math.round(cw * dpr);
    cv.height = Math.round(ch * dpr);
    const s = cv.width / G.VIEW.w;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }
  window.addEventListener("resize", resize);
  resize();

  G.initInput();
  G.go("menu", true);
  G.startLoop();
})();
