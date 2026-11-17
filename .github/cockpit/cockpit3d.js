/* CENTURION 2 - clean cockpit / helmet views.
   Cockpit view: HUD over the outside view only (no 3D shell, no "3D not available" notice).
   Helmet view: the flight HUD of volo.js already shows speed/altitude/heading, so the
   duplicated HMD numbers are not drawn. Loaded after cockpit.js. */
(() => {
  const C = window.CENTURION_COCKPIT;
  if (!C) return;
  const origDraw = C.draw;
  C.draw = function (mode, aircraft, data) {
    // "chase" makes cockpit.js only clear its overlay canvas
    return origDraw.call(C, mode === "cockpit" || mode === "helmet" ? "chase" : mode, aircraft, data);
  };
})();
