/* CENTURION 2 - cockpit / helmet views.
   Internal view: show the aircraft's REAL cockpit interior from the pilot
   eye point (for models that have one: Su-57, Su-35, EA-18G, F-14, Typhoon,
   F-15E, ...). Aircraft without a modelled interior (e.g. F-22) have
   hasInterior=false, so volo.js keeps the HUD-over-outside view for them.
   The legacy 2D cockpit artwork is suppressed in cockpit/helmet view, since
   the real 3D interior is now drawn. Loaded after cockpit.js. */
(() => {
  const C = window.CENTURION_COCKPIT;
  if (!C) return;
  // setView is left as-is: it shows the real interior and reports the true
  // hasInterior, so the internal camera reveals the actual cockpit.
  const origDraw = C.draw;
  C.draw = function (mode, aircraft, data) {
    // "chase" makes cockpit.js only clear its 2D overlay canvas: the real
    // 3D interior replaces the old flat artwork in cockpit/helmet view.
    return origDraw.call(C, mode === "cockpit" || mode === "helmet" ? "chase" : mode, aircraft, data);
  };
})();
