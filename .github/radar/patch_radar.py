#!/usr/bin/env python3
"""Integrate the indicative radar game mechanic into the generated website."""
from pathlib import Path
import shutil
import sys

site = Path(sys.argv[1])
engine_path = site / "js/engine.js"
flight_path = site / "js/volo.js"
index_path = site / "index.html"
engine = engine_path.read_text(encoding="utf-8")
flight = flight_path.read_text(encoding="utf-8")
index = index_path.read_text(encoding="utf-8")


def replace_once(text, old, new, label):
    if text.count(old) != 1:
        raise RuntimeError(f"{label}: expected exactly one matching location")
    return text.replace(old, new, 1)


if "radarFactor(sensor, target)" in engine or "function fattoreRadar(" in flight:
    raise RuntimeError("Radar patch has already been applied")

old_detect = '''  rilevato(lato, e) {
    const st = this.tipo(e).stealth || 1;
    if (lato === "BLUE") {
      if (this.e7.some(x => x.attivo && GEO.dist(x, e) <= this.sc.tipi.E7.radar_nm * st)) return true;
      return this.flights.some(f => f.lato === "BLUE" && !f.distrutto && f.alt > 50 && this.tipo(f).radar_nm > 0 && GEO.dist(f, e) <= this.tipo(f).radar_nm * st);
    } else {
      if (this.sam.some(s => s.attivo && GEO.dist(s, e) <= this.sc.tipi.SA10.radar_nm * st)) return true;
      if (this.sc.basi.some(b => b.lato === "RED" && GEO.dist(b, e) <= 100 * st)) return true; // radar EW di base
      return this.flights.some(f => f.lato === "RED" && !f.distrutto && f.alt > 50 && GEO.dist(f, e) <= this.tipo(f).radar_nm * st);
    }
  }'''
new_detect = '''  // Game-only approximation: the legacy coefficient remains the reference range factor.
  radarFactor(sensor, target) {
    const st = this.tipo(target).stealth || 1;
    if (typeof CENTURION_RADAR === "undefined" || !Number.isFinite(target.hdg) ||
        !Number.isFinite(target.lat) || !Number.isFinite(target.lon) ||
        !Number.isFinite(sensor.lat) || !Number.isFinite(sensor.lon)) return st;
    return CENTURION_RADAR.rangeFactor(st, target.hdg, GEO.bearing(target, sensor));
  }
  rilevato(lato, e) {
    if (lato === "BLUE") {
      if (this.e7.some(x => x.attivo && GEO.dist(x, e) <= this.sc.tipi.E7.radar_nm * this.radarFactor(x, e))) return true;
      return this.flights.some(f => f.lato === "BLUE" && !f.distrutto && f.alt > 50 && this.tipo(f).radar_nm > 0 && GEO.dist(f, e) <= this.tipo(f).radar_nm * this.radarFactor(f, e));
    } else {
      if (this.sam.some(s => s.attivo && GEO.dist(s, e) <= this.sc.tipi.SA10.radar_nm * this.radarFactor(s, e))) return true;
      if (this.sc.basi.some(b => b.lato === "RED" && GEO.dist(b, e) <= 100 * this.radarFactor(b, e))) return true;
      return this.flights.some(f => f.lato === "RED" && !f.distrutto && f.alt > 50 && GEO.dist(f, e) <= this.tipo(f).radar_nm * this.radarFactor(f, e));
    }
  }'''
engine = replace_once(engine, old_detect, new_detect, "mission detection")
old_mez = '  dentroMez(p, f) { const st = (f && this.tipo(f).stealth) || 1; return this.sam.some(s => s.attivo && GEO.dist(s, p) <= s.raggio_nm * st); }'
new_mez = '''  dentroMez(p, f) {
    return this.sam.some(s => {
      const d = GEO.dist(s, p);
      if (!s.attivo || d > s.raggio_nm) return false;
      return !f || d <= this.sc.tipi.SA10.radar_nm * this.radarFactor(s, { ...f, lat: p.lat, lon: p.lon });
    });
  }'''
engine = replace_once(engine, old_mez, new_mez, "SAM threat area")
engine = replace_once(engine, '      // chi può APRIRE l\'ingaggio: ha missili, il nemico è rilevato ed è entro la portata (ridotta dallo stealth del bersaglio)', '      // Detection and missile range are separate gameplay checks.', "engagement comment")
engine = replace_once(engine, 'd <= tb.missili_nm * (tr.stealth || 1) && this.rilevato("BLUE", r)', 'd <= tb.missili_nm && this.rilevato("BLUE", r)', "blue missile range")
engine = replace_once(engine, 'd <= tr.missili_nm * (tb.stealth || 1) && this.rilevato("RED", b)', 'd <= tr.missili_nm && this.rilevato("RED", b)', "red missile range")
old_sam = '''      const st = this.tipo(f).stealth || 1;
      this.sam.forEach(s => {
        if (!s.attivo || s.missili <= 0) return;
        if (GEO.dist(s, f) > s.raggio_nm * st) return;'''
new_sam = '''      this.sam.forEach(s => {
        if (!s.attivo || s.missili <= 0) return;
        const d = GEO.dist(s, f);
        if (d > s.raggio_nm || d > this.sc.tipi.SA10.radar_nm * this.radarFactor(s, f)) return;'''
engine = replace_once(engine, old_sam, new_sam, "SAM launch")

flight_helper = '''  // The reference factors come from the current scenario; no real RCS is implied.
  function fattoreRadar(sensore, bersaglio) {
    const tipi = typeof APP !== "undefined" && APP.sc && APP.sc.tipi || {};
    const codice = bersaglio === S.pl ? S.cfg.aereo : bersaglio.tipoId;
    const base = (tipi[codice] && tipi[codice].stealth) || 1;
    if (typeof CENTURION_RADAR === "undefined" || !sensore.pos || !bersaglio.pos) return base;
    const dx = sensore.pos.x - bersaglio.pos.x, dz = sensore.pos.z - bersaglio.pos.z;
    if (!Number.isFinite(dx) || !Number.isFinite(dz) || Math.hypot(dx, dz) < 0.001) return base;
    let heading = Number.isFinite(bersaglio.hdg) ? bersaglio.hdg * R2D : NaN;
    if (bersaglio === S.pl && bersaglio.Q) {
      const forward = V3(0, 0, 1).applyQuaternion(bersaglio.Q);
      heading = Math.atan2(forward.x, -forward.z) * R2D;
    }
    return CENTURION_RADAR.rangeFactor(base, heading, Math.atan2(dx, -dz) * R2D);
  }

'''
flight = replace_once(flight, '  function aggiornaNemici(dt) {', flight_helper + '  function aggiornaNemici(dt) {', "flight helper")
flight = replace_once(flight, 'else if (P.vivo && dist < 90000) { e.stato = "attacco";', 'else if (P.vivo && dist < 90000 * fattoreRadar(e, P)) { e.stato = "attacco";', "enemy detection")
flight = replace_once(flight, 'if (dist < 26000 && dist > 7000 && ang < 25 && e.missili.R77 > 0)', 'if (dist < 26000 && dist < 40000 * fattoreRadar(e, P) && dist > 7000 && ang < 25 && e.missili.R77 > 0)', "enemy radar lock")
flight = replace_once(flight, 'e.illumina = P.vivo && dist < 40000 && angP < 35;', 'e.illumina = P.vivo && dist < 40000 * fattoreRadar(e, P) && angP < 35;', "enemy radar warning")
flight = replace_once(flight, 't.illumina = d < gt * 1.3 && P.agl > 200;', 't.illumina = d < gt * 1.3 * fattoreRadar(t, P) && P.agl > 200;', "SAM detection")
flight = replace_once(flight, 'if (t.cad <= 0 && t.missili > 0 && d < gt && P.agl > 200)', 'if (t.cad <= 0 && t.missili > 0 && d < gt && t.illumina)', "SAM range")
flight = replace_once(flight, 'const r = d.length(); if (r > rmax) return; const ang', 'const r = d.length(); if (r > rmax || (w.guida === "radar" && r > rmax * fattoreRadar(P, t))) return; const ang', "player radar candidates")
flight = replace_once(flight, 'if (ang > w.cono + 5 || r > rmax * 1.1) { if (S.lock.ok)', 'if (ang > w.cono + 5 || r > rmax * 1.1 || (w.guida === "radar" && r > rmax * fattoreRadar(P, t) * 1.1)) { if (S.lock.ok)', "player radar lock")

for attr in ("src", "data-locked-src"):
    anchor = f'<script {attr}="js/engine.js"></script>'
    if anchor in index:
        index = replace_once(index, anchor, f'<script {attr}="js/radar_model.js"></script>\n' + anchor, "script loading")
        break
else:
    raise RuntimeError("Could not locate engine script in index.html")

shutil.copyfile(Path(__file__).with_name("radar_model.js"), site / "js/radar_model.js")
engine_path.write_text(engine, encoding="utf-8")
flight_path.write_text(flight, encoding="utf-8")
index_path.write_text(index, encoding="utf-8")
print("Patched mission and free-flight radar game mechanics")
