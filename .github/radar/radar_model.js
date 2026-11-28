/* Indicative game mechanic: dimensionless factors, not measured radar signatures. */
(function (root) {
  "use strict";
  function rangeFactor(base, headingDeg, bearingDeg) {
    const b = Number.isFinite(base) && base > 0 ? base : 1;
    if (!Number.isFinite(headingDeg) || !Number.isFinite(bearingDeg)) return b;
    const angle = (bearingDeg - headingDeg) * Math.PI / 180;
    // shortcut: a smooth symmetric angle curve, until measured game data exists.
    return b * (0.85 + 0.30 * Math.sin(angle) ** 2);
  }
  const api = Object.freeze({ rangeFactor });
  root.CENTURION_RADAR = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
