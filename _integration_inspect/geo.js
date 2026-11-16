/* Geodesia: tutte le distanze in miglia nautiche (NM), angoli in gradi (0=Nord, orario) */
const GEO = (() => {
  const R_NM = 3440.065;       // raggio terrestre medio in NM
  const d2r = d => d * Math.PI / 180, r2d = r => r * 180 / Math.PI;

  function dist(a, b) {        // haversine, a/b = {lat,lon}
    const dLat = d2r(b.lat - a.lat), dLon = d2r(b.lon - a.lon);
    const h = Math.sin(dLat/2)**2 + Math.cos(d2r(a.lat))*Math.cos(d2r(b.lat))*Math.sin(dLon/2)**2;
    return 2 * R_NM * Math.asin(Math.sqrt(h));
  }
  function bearing(a, b) {     // rotta iniziale vera
    const φ1 = d2r(a.lat), φ2 = d2r(b.lat), Δλ = d2r(b.lon - a.lon);
    const y = Math.sin(Δλ)*Math.cos(φ2);
    const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
    return (r2d(Math.atan2(y, x)) + 360) % 360;
  }
  function dest(a, brg, d) {   // punto a distanza d (NM) lungo brg
    const δ = d / R_NM, θ = d2r(brg), φ1 = d2r(a.lat), λ1 = d2r(a.lon);
    const φ2 = Math.asin(Math.sin(φ1)*Math.cos(δ) + Math.cos(φ1)*Math.sin(δ)*Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ)*Math.sin(δ)*Math.cos(φ1), Math.cos(δ) - Math.sin(φ1)*Math.sin(φ2));
    return { lat: r2d(φ2), lon: ((r2d(λ2) + 540) % 360) - 180 };
  }
  const norm = a => ((a % 360) + 360) % 360;
  const angDiff = (from, to) => { let d = norm(to) - norm(from); if (d > 180) d -= 360; if (d < -180) d += 360; return d; };

  /* Triangolo del vento: dato heading (prua), TAS e vento (da dove soffia, kt) → track e ground speed */
  function windTriangle(headingDeg, tasKt, windFromDeg, windKt) {
    const h = d2r(headingDeg), w = d2r(windFromDeg + 180); // direzione verso cui soffia
    const vx = tasKt*Math.sin(h) + windKt*Math.sin(w), vy = tasKt*Math.cos(h) + windKt*Math.cos(w);
    return { track: norm(r2d(Math.atan2(vx, vy))), gs: Math.hypot(vx, vy) };
  }
  /* Heading da tenere per seguire una track desiderata con vento (wind correction angle) */
  function headingForTrack(trackDeg, tasKt, windFromDeg, windKt) {
    const wca = r2d(Math.asin(Math.max(-1, Math.min(1, windKt * Math.sin(d2r(windFromDeg - trackDeg)) / tasKt))));
    return norm(trackDeg + wca);
  }

  function pointInPolygon(p, poly) { // poly: [[lat,lon],...]
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
      const inter = ((yi > p.lat) !== (yj > p.lat)) && (p.lon < (xj - xi) * (p.lat - yi) / (yj - yi) + xi);
      if (inter) inside = !inside;
    }
    return inside;
  }

  /* Griglia operativa: quadrati di lato L NM a partire dall'origine (SW). Colonne A..., righe 1... dal nord */
  function gridCell(p, g) {
    const latMid = g.origine[0] + (g.righe * g.lato_nm / 60) / 2;
    const dLat = g.lato_nm / 60, dLon = g.lato_nm / (60 * Math.cos(d2r(latMid)));
    const col = Math.floor((p.lon - g.origine[1]) / dLon);
    const rowFromSouth = Math.floor((p.lat - g.origine[0]) / dLat);
    const row = g.righe - 1 - rowFromSouth;
    return { col, row, label: (col >= 0 && col < 26 ? String.fromCharCode(65 + col) : "?") + (row + 1), dLat, dLon };
  }
  function gridDistanceSquares(a, b, g) { // distanza in "quadrati" (Chebyshev continua, arrotondata al mezzo quadrato) tra due punti
    const c = gridCell(a, g);
    const d = Math.max(Math.abs(a.lon - b.lon) / c.dLon, Math.abs(a.lat - b.lat) / c.dLat);
    return Math.round(d);
  }

  /* Bullseye: BRA (bearing/range) da un punto di riferimento */
  function bullseye(ref, p) { return { brg: Math.round(bearing(ref, p)), rng: Math.round(dist(ref, p)) }; }
  const fmtBE = (ref, p) => { const b = bullseye(ref, p); return `BULLS ${String(b.brg).padStart(3,"0")}/${b.rng}`; };

  function fmtLatLon(p) {
    const f = (v, pos, neg) => { const a = Math.abs(v), d = Math.floor(a), m = ((a - d) * 60).toFixed(1); return `${d}°${m.padStart(4,"0")}'${v >= 0 ? pos : neg}`; };
    return `${f(p.lat,"N","S")} ${f(p.lon,"E","W")}`;
  }
  return { dist, bearing, dest, norm, angDiff, windTriangle, headingForTrack, pointInPolygon, gridCell, gridDistanceSquares, bullseye, fmtBE, fmtLatLon, R_NM };
})();
