/* CENTURION 2 · Geran-2 (famiglia Shahed-136): drone ostile simulato della missione M12 "Donbass UAV".
 * Solo rappresentazione: rotta ad anello inventata, quota e velocita costanti, nessuna logica d'attacco.
 * La posizione dipende soltanto dal tempo di missione: motore (APP.engine.droni), mappa tattica 2D e
 * scena Mondo 3D mostrano il drone nello stesso punto e, in pausa, resta fermo come gli altri velivoli.
 * Rilevamento, identificazione e uscita dalla zona seguono i droni NPC del motore (patch_drone_engine.py).
 * Modello 3D: "Geranium-2" di Karosio su Sketchfab, CC BY-NC-SA 4.0 (modelli/geran2.glb).
 */
const GERAN = (() => {
  "use strict";
  const RT = 6371000, G0 = 9.81, PASSI = 64, cache = new WeakMap();
  const rad = d => d * Math.PI / 180;

  // Catmull-Rom centripeta (Barry-Goldman): curve morbide fra i punti della rotta, senza cappi
  function catmull(p0, p1, p2, p3, t) {
    const d = (a, b) => Math.max(1e-6, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3), u = t1 + (t2 - t1) * t;
    const mix = (a, b, ta, tb) => [0, 1].map(j => ((tb - u) * a[j] + (u - ta) * b[j]) / (tb - ta));
    const A1 = mix(p0, p1, 0, t1), A2 = mix(p1, p2, t1, t2), A3 = mix(p2, p3, t2, t3);
    return mix(mix(A1, A2, 0, t2), mix(A2, A3, t1, t3), t1, t2);
  }
  // rotta chiusa campionata in metri (x est, y nord) con lunghezze cumulate
  function curva(cfg) {
    let r = cache.get(cfg); if (r) return r;
    const pts = cfg.rotta, n = pts.length;
    const lat0 = pts.reduce((a, p) => a + p[0], 0) / n, lon0 = pts.reduce((a, p) => a + p[1], 0) / n;
    const ky = rad(1) * RT, kx = ky * Math.cos(rad(lat0));
    const P = pts.map(p => [(p[1] - lon0) * kx, (p[0] - lat0) * ky]);
    const S = [];
    for (let i = 0; i < n; i++) {
      const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      for (let k = 0; k < PASSI; k++) S.push(catmull(p0, p1, p2, p3, k / PASSI));
    }
    const L = [0];
    for (let i = 1; i <= S.length; i++) { const a = S[i - 1], b = S[i % S.length]; L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    r = { lat0, lon0, kx, ky, S, L, tot: L[S.length] }; cache.set(cfg, r); return r;
  }
  function punto(r, s) {
    s = ((s % r.tot) + r.tot) % r.tot;
    let lo = 0, hi = r.S.length;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r.L[m] <= s) lo = m; else hi = m; }
    const a = r.S[lo], b = r.S[(lo + 1) % r.S.length], f = (s - r.L[lo]) / Math.max(1e-6, r.L[lo + 1] - r.L[lo]);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }
  // prua in radianti: 0 = nord, positiva in senso orario
  function prua(r, s) { const a = punto(r, s - 60), b = punto(r, s + 60); return Math.atan2(b[0] - a[0], b[1] - a[1]); }
  function inizio() { try { return Engine.hm2s(APP.sc.tempo.inizio); } catch (e) { return 0; } }

  // stato del drone al tempo di missione t (secondi, come APP.engine.t)
  function stato(cfg, t) {
    const r = curva(cfg), v = cfg.vel_ms || 50, s = v * (t - inizio()) + (cfg.fase_m || 0);
    const p = punto(r, s), h = prua(r, s);
    // virata coordinata: tan(bank) = v^2 * curvatura / g, curvatura stimata su 300 m di rotta
    let dh = prua(r, s + 150) - prua(r, s - 150); dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const bank = Math.max(-35, Math.min(35, Math.atan(v * v * (dh / 300) / G0) * 180 / Math.PI));
    return { lat: r.lat0 + p[1] / r.ky, lon: r.lon0 + p[0] / r.kx, hdg: (h * 180 / Math.PI + 360) % 360, bank, vel_ms: v, quota_m: cfg.quota_m || 450 };
  }
  function droni() {
    const sc = typeof APP !== "undefined" && APP.sc;
    return sc && Array.isArray(sc.droni) ? sc.droni.filter(d => d.tipo === "geran2" && Array.isArray(d.rotta) && d.rotta.length > 2) : [];
  }

  /* ---------- traccia sulla mappa tattica (Leaflet) ---------- */
  const MAP = { mappa: null, layer: null, el: {} };
  const ICONA = '<svg viewBox="-10 -10 20 20" width="24" height="24"><path d="M0,-9 L7.5,6 L0,3.2 L-7.5,6 Z" fill="#e74c3c" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  function aggiornaMappa() {
    if (typeof MAPPA === "undefined" || typeof L === "undefined" || typeof APP === "undefined" || !APP.engine) return;
    const lm = MAPPA.map; if (!lm) return;
    if (MAP.mappa !== lm) { MAP.mappa = lm; MAP.layer = L.layerGroup().addTo(lm); MAP.el = {}; }
    const lista = droni();
    Object.keys(MAP.el).forEach(id => { if (!lista.some(d => d.id === id)) { MAP.layer.removeLayer(MAP.el[id].m); MAP.layer.removeLayer(MAP.el[id].scia); delete MAP.el[id]; } });
    const t = APP.engine.t;
    lista.forEach(cfg => {
      // come gli altri droni NPC: sulla mappa solo dopo il rilevamento e fino all'uscita dalla zona
      const live = (APP.engine.droni || []).find(d => d.id === cfg.id);
      if (live && (!live.visibile || live.allontanato)) {
        const old = MAP.el[cfg.id]; if (old) { MAP.layer.removeLayer(old.m); MAP.layer.removeLayer(old.scia); delete MAP.el[cfg.id]; }
        return;
      }
      const s = stato(cfg, t), ident = !live || live.identificato;
      let e = MAP.el[cfg.id];
      if (!e) {
        const html = `<div class="geran-ico" style="width:24px;height:24px">${ICONA}</div><div class="geran-lbl" style="position:absolute;left:25px;top:3px;white-space:nowrap;font:700 11px system-ui,sans-serif;color:#fff;background:rgba(150,28,28,.88);padding:1px 6px;border-radius:4px"></div>`;
        const m = L.marker([s.lat, s.lon], { icon: L.divIcon({ className: "sym-geran", html, iconSize: [24, 24], iconAnchor: [12, 12] }), zIndexOffset: 900 }).addTo(MAP.layer);
        m.on("click", () => { if (typeof MONDO3D !== "undefined" && !MONDO3D.attiva) { try { MONDO3D.apri(cfg.id, { cam: "insegui" }); } catch (err) { console.warn(err); } } });
        const scia = L.polyline([], { color: "#e74c3c", weight: 2, opacity: 0.75, dashArray: "4 6", interactive: false }).addTo(MAP.layer);
        e = MAP.el[cfg.id] = { m, scia };
      }
      e.m.setLatLng([s.lat, s.lon]);
      const el = e.m.getElement();
      const ico = el && el.querySelector(".geran-ico"); if (ico) ico.style.transform = `rotate(${Math.round(s.hdg)}deg)`;
      const lbl = el && el.querySelector(".geran-lbl"); if (lbl) lbl.textContent = ident ? "GERAN-2" : cfg.id + " ?";
      const tip = `<b>${cfg.id}</b> – ${ident ? "Geran-2 (Shahed-136) · drone ostile simulato" : "eco ostile da identificare (simulato)"}${live ? " · " + live.stato : ""}<br>HDG ${Math.round(s.hdg)}° · ${Math.round(s.vel_ms * 3.6)} km/h · ${s.quota_m} m sul terreno<br>Rotta inventata, nessuna logica d'attacco · tocca per seguirlo nel Mondo 3D`;
      if (e.m.getTooltip()) e.m.setTooltipContent(tip); else e.m.bindTooltip(tip, { direction: "right", offset: [18, 0] });
      // scia: ultimi 4 minuti della rotta
      const ll = []; for (let k = 16; k >= 0; k--) { const q = stato(cfg, t - k * 15); ll.push([q.lat, q.lon]); }
      e.scia.setLatLngs(ll);
    });
  }
  if (typeof MAPPA !== "undefined" && typeof MAPPA.aggiornaFlights === "function" && !MAPPA._geran) {
    const orig = MAPPA.aggiornaFlights;
    MAPPA.aggiornaFlights = function () { const r = orig.apply(this, arguments); try { aggiornaMappa(); } catch (e) { console.warn("Geran-2 mappa", e); } return r; };
    MAPPA._geran = true;
  }
  return { stato, droni, aggiornaMappa };
})();
