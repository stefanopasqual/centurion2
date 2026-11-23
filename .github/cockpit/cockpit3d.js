/* CENTURION 2 - cockpit / helmet views.
   - Aircraft WITH a modelled 3D interior (Su-57, Su-35, EA-18G, F-14,
     Typhoon, F-15E, ...): the internal camera shows the real 3D cockpit
     from the pilot eye; the legacy 2D cockpit artwork is suppressed.
   - Aircraft WITHOUT a modelled interior (e.g. F-22): no 3D cockpit to
     show, so the 2D instrument cockpit (frame + MFDs, from cockpit.js) is
     drawn over the outside view instead of a bare HUD.
   Loaded after cockpit.js. */
(() => {
  const C = window.CENTURION_COCKPIT;
  if (!C) return;
  // setView stays a passthrough (shows the real interior when present) but
  // records whether the current aircraft has a 3D interior, for draw().
  const origSetView = C.setView;
  C.setView = function (root, type, inside) {
    const d = origSetView.call(C, root, type, inside);
    C.__hasInterior = !!(d && d.hasInterior);
    return d;
  };
  const origDraw = C.draw;
  C.draw = function (mode, aircraft, data) {
    const inside = mode === "cockpit" || mode === "helmet";
    // With a real 3D interior, clear the 2D overlay (the 3D cockpit shows).
    // Without one, draw the 2D instrument cockpit (treated as a normal panel).
    if (inside && C.__hasInterior) return origDraw.call(C, "chase", aircraft, data);
    return origDraw.call(C, mode, aircraft, data);
  };
})();
