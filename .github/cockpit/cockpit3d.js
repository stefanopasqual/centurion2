/* CENTURION 2 - clean cockpit / helmet views.
   Cockpit view: HUD over the outside view only (no 3D shell, no "3D not available" notice).
   Helmet view: the flight HUD of volo.js already shows speed/altitude/heading, so the
   duplicated HMD numbers are not drawn.
   In both views the whole external model is hidden: on F-15E / Typhoon a stray HUD/cockpit
   mesh used to float in front of the eye. Loaded after cockpit.js. */
(() => {
  const C = window.CENTURION_COCKPIT;
  if (!C) return;
  const origSetView = C.setView;
  C.setView = function (root, type, inside) {
    const d = origSetView.call(C, root, type, inside);
    // volo.js hides the aircraft when hasInterior is false: never keep partial meshes in view
    return inside && d ? Object.assign({}, d, { hasInterior: false }) : d;
  };
  const origDraw = C.draw;
  C.draw = function (mode, aircraft, data) {
    // "chase" makes cockpit.js only clear its overlay canvas
    return origDraw.call(C, mode === "cockpit" || mode === "helmet" ? "chase" : mode, aircraft, data);
  };
})();
