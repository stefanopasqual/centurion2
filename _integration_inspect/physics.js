/* =====================================================================
   FISICA DEL VOLO (modello a massa puntiforme, standard aeronautici)
   - Virata coordinata: rateo ω = g·tan(φ)/V ; raggio r = V²/(g·tan φ)
   - Salita/discesa: ROC limitata, velocità verticale in fpm
   - Vento: triangolo del vento (TAS + vento = GS/track)
   - Atmosfera ISA: Mach e temperatura in quota (per visualizzazione)
   - Carburante: modalità "regole" (minuti ROE) o "realistica" (lb/h, regime)
   ===================================================================== */
const PHYS = (() => {
  const G_FT = 32.174;           // ft/s²
  const KT2FTS = 1.68781;        // kt → ft/s
  const d2r = d => d * Math.PI / 180;

  /* Rateo di virata (°/s) per bank φ e TAS; 30° bank a 480 kt ≈ 1.4°/s (standard navigazione) */
  function turnRateDegS(tasKt, bankDeg) {
    const V = tasKt * KT2FTS; if (V < 1) return 0;
    return (G_FT * Math.tan(d2r(bankDeg)) / V) * 180 / Math.PI;
  }
  function turnRadiusNm(tasKt, bankDeg) {
    const V = tasKt * KT2FTS;
    return (V * V / (G_FT * Math.tan(d2r(bankDeg)))) / 6076.12;
  }
  const loadFactor = bankDeg => 1 / Math.cos(d2r(bankDeg));   // n = 1/cos φ

  /* ISA: temperatura e velocità del suono in quota (ft) */
  function isa(altFt) {
    const h = altFt * 0.3048;
    const T = h < 11000 ? 288.15 - 0.0065 * h : 216.65;
    const a = Math.sqrt(1.4 * 287.05 * T);  // m/s
    return { tempC: T - 273.15, soundKt: a * 1.94384 };
  }
  const mach = (tasKt, altFt) => tasKt / isa(altFt).soundKt;

  /* Regimi di consumo: moltiplicatore del consumo orario base */
  const REGIME = { terra: 0.05, salita: 1.6, crociera: 1.0, cap: 0.8, attacco: 1.5, ingaggio: 2.5, discesa: 0.5, aar: 0.9 };

  /* Integra un passo dt (s) dello stato di volo verso un punto desiderato (target {lat,lon,alt})
     stato: {lat,lon,hdg,tas,alt} ; tipo: parametri velivolo ; opts: {bank, vento, tasTarget, alt}
     ritorna nuovo stato e informazioni (gs, track, turnRate, nG) */
  function step(stato, dest, tipo, dt, opts) {
    const vento = opts.vento || { da: 0, kt: 0 };
    const tasTarget = opts.tasTarget || tipo.tas_crociera_kt;
    // accelerazione limitata (≈ 5 kt/s in livellato per un caccia, 1 kt/s per un tanker)
    const accMax = (tipo.g_max >= 7 ? 5 : 1) * dt;
    let tas = stato.tas + Math.max(-accMax, Math.min(accMax, tasTarget - stato.tas));
    // rotta desiderata verso destinazione, corretta per il vento
    const brg = GEO.bearing(stato, dest);
    const hdgDesired = GEO.headingForTrack(brg, Math.max(tas, 50), vento.da, vento.kt);
    const bank = opts.bank || tipo.bank_nav || 30;
    const maxTurn = turnRateDegS(Math.max(tas, 100), bank) * dt;
    const diff = GEO.angDiff(stato.hdg, hdgDesired);
    const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
    const hdg = GEO.norm(stato.hdg + turn);
    // quota
    const altTarget = opts.alt != null ? opts.alt : (dest.alt != null ? dest.alt : tipo.quota_ft);
    const roc = tipo.roc_fpm || 5000;
    const dAltMax = roc * dt / 60;
    const alt = stato.alt + Math.max(-dAltMax * 1.5, Math.min(dAltMax, altTarget - stato.alt));
    // movimento con vento
    const wt = GEO.windTriangle(hdg, tas, vento.da, vento.kt);
    const dNm = wt.gs * dt / 3600;
    const np = GEO.dest(stato, wt.track, dNm);
    const bankUsed = Math.abs(diff) > 0.5 ? Math.min(bank, Math.abs(diff) / dt / Math.max(turnRateDegS(tas, 1), 1e-6)) : 0;
    return { lat: np.lat, lon: np.lon, hdg, tas, alt, gs: wt.gs, track: wt.track, turnRate: turn / dt, nG: loadFactor(Math.min(bankUsed, bank)), mach: mach(tas, alt),
             regime: alt < altTarget - 200 ? "salita" : alt > altTarget + 200 ? "discesa" : (opts.regime || "crociera") };
  }

  /* Consumo carburante per un passo dt (s): ritorna minuti di autonomia consumati (modalità regole)
     oppure lb consumate (modalità realistica) */
  function fuelBurn(tipo, regime, dt, modalita) {
    const k = REGIME[regime] != null ? REGIME[regime] : 1;
    if (modalita === "realistica") return tipo.consumo_lbh * k * dt / 3600;   // lb
    return k * dt / 60;                                                       // minuti equivalenti
  }

  /* Tempo (min) e carburante per raggiungere un punto alla velocità di crociera con vento medio */
  function eta(from, to, tasKt, vento) {
    const d = GEO.dist(from, to), brg = GEO.bearing(from, to);
    const hdg = GEO.headingForTrack(brg, tasKt, vento.da, vento.kt);
    const gs = GEO.windTriangle(hdg, tasKt, vento.da, vento.kt).gs;
    return { nm: d, min: d / Math.max(gs, 1) * 60, gs };
  }

  /* BINGO: autonomia (min) necessaria per rientrare alla base/tanker più vicino con riserva */
  function bingoMinutes(from, homes, tasKt, vento, riservaMin) {
    let best = Infinity;
    homes.forEach(h => { const e = eta(from, h, tasKt, vento); if (e.min < best) best = e.min; });
    return best + (riservaMin || 5);
  }

  return { turnRateDegS, turnRadiusNm, loadFactor, isa, mach, REGIME, step, fuelBurn, eta, bingoMinutes };
})();
