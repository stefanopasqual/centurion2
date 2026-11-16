/* =====================================================================
   MAPPA REALE (Leaflet) – layer tattici, griglia, simboli, animazione
   ===================================================================== */
const MAPPA = (() => {
  let map, sc, layers = {}, flightMarkers = {}, trails = {}, samMarkers = {}, tgtMarkers = {}, routeLayer, ruler = { pts: [], layer: null }, pickCb = null, baseLayers = {};
  const ICON_SIZE = 34;

  function init(scenario) {
    sc = scenario;
    map = L.map("map", { zoomControl: true, preferCanvas: false }).setView(sc.mappa.centro, sc.mappa.zoom);
    baseLayers = {
      topo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { maxZoom: 15, attribution: "© OpenStreetMap, © OpenTopoMap (CC-BY-SA)" }),
      osm: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }),
      sat: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 17, attribution: "Esri World Imagery" }),
      dark: L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 18, attribution: "© OpenStreetMap, © CARTO" })
    };
    baseLayers[sc.mappa.tile_default || "topo"].addTo(map);
    layers.sectional = L.imageOverlay(sc.mappa.sectional.file, sc.mappa.sectional.bounds, { opacity: sc.mappa.sectional.opacita });
    if (sc.mappa.sectional.attivo) layers.sectional.addTo(map);
    layers.nazioni = L.layerGroup().addTo(map); layers.griglia = L.layerGroup().addTo(map); layers.punti = L.layerGroup().addTo(map);
    layers.sam = L.layerGroup().addTo(map); layers.trails = L.layerGroup().addTo(map); layers.flights = L.layerGroup().addTo(map);
    layers.rotte = L.layerGroup().addTo(map); layers.ingaggi = L.layerGroup().addTo(map); layers.ruler = L.layerGroup().addTo(map); layers.radar = L.layerGroup();
    L.control.scale({ metric: true, imperial: true }).addTo(map);
    disegnaStatici();
    map.on("click", e => { if (pickCb) { const cb = pickCb; pickCb = null; document.getElementById("map").classList.remove("picking"); cb({ lat: e.latlng.lat, lon: e.latlng.lng }); } else if (ruler.attivo) rulerClick(e.latlng); });
    map.on("mousemove", e => { const el = document.getElementById("coords"); if (el) { const p = { lat: e.latlng.lat, lon: e.latlng.lng }; el.textContent = `${GEO.fmtLatLon(p)}  |  ${GEO.fmtBE(sc.mappa.bullseye, p)}  |  Quadrato ${GEO.gridCell(p, sc.mappa.griglia).label}`; } });
    return map;
  }
  function setBase(k) { Object.values(baseLayers).forEach(l => map.removeLayer(l)); baseLayers[k].addTo(map); }
  function toggle(k, on) { const l = layers[k]; if (!l) return; if (on) l.addTo(map); else map.removeLayer(l); }
  function setSectionalOpacity(o) { layers.sectional.setOpacity(o); }

  /* ---------- statici ---------- */
  function disegnaStatici() {
    layers.nazioni.clearLayers(); layers.griglia.clearLayers(); layers.punti.clearLayers();
    sc.mappa.nazioni.forEach(n => {
      L.polygon(n.poligono, { color: n.colore, weight: 2, fillOpacity: 0.06, dashArray: "6 4", interactive: false }).addTo(layers.nazioni);
      L.marker(n.etichetta, { icon: L.divIcon({ className: "lbl-nazione", html: `<span style="color:${n.colore}">${n.nome}</span>`, iconSize: [200, 20] }), interactive: false }).addTo(layers.nazioni);
    });
    L.polyline(sc.mappa.fir_boundary, { color: "#e74c3c", weight: 4, opacity: 0.9, interactive: false }).addTo(layers.nazioni);
    // griglia
    const g = sc.mappa.griglia;
    if (g.attiva) {
      const latMid = g.origine[0] + (g.righe * g.lato_nm / 60) / 2; const dLat = g.lato_nm / 60, dLon = g.lato_nm / (60 * Math.cos(latMid * Math.PI / 180));
      for (let c = 0; c <= g.colonne; c++) { const lon = g.origine[1] + c * dLon; L.polyline([[g.origine[0], lon], [g.origine[0] + g.righe * dLat, lon]], { color: "#555", weight: 1, opacity: 0.5, interactive: false }).addTo(layers.griglia); }
      for (let r = 0; r <= g.righe; r++) { const lat = g.origine[0] + r * dLat; L.polyline([[lat, g.origine[1]], [lat, g.origine[1] + g.colonne * dLon]], { color: "#555", weight: 1, opacity: 0.5, interactive: false }).addTo(layers.griglia); }
      for (let c = 0; c < g.colonne; c++) for (let r = 0; r < g.righe; r++) {
        const lat = g.origine[0] + (g.righe - r - 0.5) * dLat, lon = g.origine[1] + (c + 0.5) * dLon;
        L.marker([lat, lon], { icon: L.divIcon({ className: "lbl-grid", html: String.fromCharCode(65 + c) + (r + 1), iconSize: [30, 12] }), interactive: false }).addTo(layers.griglia);
      }
    }
    // bullseye
    const be = sc.mappa.bullseye;
    [10, 20, 40].forEach(r => L.circle([be.lat, be.lon], { radius: r * 1852, color: "#f1c40f", weight: 1, fill: false, dashArray: "2 4", interactive: false }).addTo(layers.punti));
    L.marker([be.lat, be.lon], { icon: L.divIcon({ className: "sym-bulls", html: "◎", iconSize: [20, 20] }) }).bindTooltip(be.nome).addTo(layers.punti);
    // basi
    sc.basi.forEach(b => L.marker([b.lat, b.lon], { icon: L.divIcon({ className: "sym-base " + b.lato.toLowerCase(), html: `<div class="base-ico">✈</div><div class="base-lbl">${b.id}</div>`, iconSize: [60, 30], iconAnchor: [30, 10] }) }).bindTooltip(`${b.nome}<br>Pista ${b.pista_ft} ft – ${b.nazione}`).addTo(layers.punti));
    // target
    sc.target.forEach(t => { tgtMarkers[t.id] = L.marker([t.lat, t.lon], { icon: L.divIcon({ className: "sym-tgt", html: `<div class="tgt-tri">▲</div><div class="tgt-lbl">${t.nome.split(" ")[0]}</div>`, iconSize: [70, 30], iconAnchor: [35, 10] }) }).bindTooltip(`<b>TARGET</b> ${t.nome}<br>${t.descrizione}<br>${t.gbu_richieste} GBU-48 richieste${t.finestra ? `<br><b>Presente solo ${t.finestra.da}–${t.finestra.a}</b>` : ""}${t.sam ? `<br>Distruggerlo spegne la ${t.sam}` : ""}`).addTo(layers.punti); });
    // AAR
    sc.aar.forEach(a => { const p1 = GEO.dest(a, a.orient, a.lunghezza_nm / 2), p2 = GEO.dest(a, a.orient + 180, a.lunghezza_nm / 2);
      L.polyline([[p1.lat, p1.lon], [p2.lat, p2.lon]], { color: "#2e86de", weight: 14, opacity: 0.25, lineCap: "round", interactive: false }).addTo(layers.punti);
      L.marker([a.lat, a.lon], { icon: L.divIcon({ className: "sym-lbl blue", html: a.id.replace("_", " "), iconSize: [80, 14] }) }).bindTooltip(a.nome + " – FL" + a.quota_ft / 100).addTo(layers.punti); });
    // orbite E7
    sc.orbite.forEach(o => { L.circle([o.lat, o.lon], { radius: 8 * 1852, color: "#2e86de", weight: 2, fill: false, interactive: false }).addTo(layers.punti); L.marker([o.lat, o.lon], { icon: L.divIcon({ className: "sym-lbl blue", html: o.id, iconSize: [40, 14] }) }).bindTooltip(o.nome).addTo(layers.punti); });
    // gate
    sc.gate.forEach(g2 => L.marker([g2.lat, g2.lon], { icon: L.divIcon({ className: "sym-gate", html: `<div class="gate-ico">⬢</div><div class="gate-lbl">${g2.nome}</div>`, iconSize: [90, 30], iconAnchor: [45, 10] }) }).bindTooltip("Punto di ingresso/uscita (gate)").addTo(layers.punti));
    // CAP box
    sc.cap_box.forEach(c => { const col = c.lato === "RED" ? "#e74c3c" : "#2e86de";
      L.circle([c.lat, c.lon], { radius: c.raggio_nm * 1852, color: col, weight: 2, fill: true, fillOpacity: 0.04, dashArray: "8 6", interactive: false }).addTo(layers.punti);
      L.marker([c.lat, c.lon], { icon: L.divIcon({ className: "sym-lbl " + c.lato.toLowerCase(), html: c.nome, iconSize: [110, 14] }) }).addTo(layers.punti); });
  }

  /* ---------- SAM ---------- */
  function disegnaSam(sams, editabile, onMove) {
    layers.sam.clearLayers(); samMarkers = {};
    sams.forEach(s => {
      const col = s.attivo === false ? "#7f8c8d" : "#e74c3c";
      const ring = L.circle([s.lat, s.lon], { radius: s.raggio_nm * 1852, color: col, weight: 2, fillColor: col, fillOpacity: 0.08, interactive: false }).addTo(layers.sam);
      const m = L.marker([s.lat, s.lon], { draggable: !!editabile, icon: L.divIcon({ className: "sym-sam", html: `<div class="sam-ico">◆</div><div class="sam-lbl">${s.id.replace("SA10_", "SA-10 ")}</div>`, iconSize: [80, 30], iconAnchor: [40, 10] }) })
        .bindTooltip(`<b>${s.nome}</b><br>Raggio ${s.raggio_nm} NM – missili: ${s.missili}${s.dest ? "<br><i>in movimento</i>" : ""}`).addTo(layers.sam);
      if (editabile) m.on("dragend", e => { const ll = e.target.getLatLng(); onMove && onMove(s.id, ll.lat, ll.lng); });
      if (s.dest) L.polyline([[s.lat, s.lon], [s.dest.lat, s.dest.lon]], { color: col, dashArray: "4 4", weight: 2, interactive: false }).addTo(layers.sam);
      samMarkers[s.id] = { m, ring };
    });
  }

  /* ---------- rotte pianificate ---------- */
  function disegnaRotte(rotte) { // [{id, colore, pts:[{lat,lon,nome}], tratteggio}]
    layers.rotte.clearLayers();
    rotte.forEach(r => {
      const ll = r.pts.map(p => [p.lat, p.lon]);
      L.polyline(ll, { color: r.colore, weight: 3, opacity: 0.8, dashArray: r.tratteggio ? "6 6" : null, interactive: false }).addTo(layers.rotte);
      r.pts.forEach((p, i) => { if (i === 0 || i === r.pts.length - 1) return; L.circleMarker([p.lat, p.lon], { radius: 4, color: r.colore, fillOpacity: 1, interactive: false }).addTo(layers.rotte); });
      if (r.etichetta && ll.length > 1) { const mid = ll[Math.floor(ll.length / 2)]; L.marker(mid, { icon: L.divIcon({ className: "lbl-rotta", html: `<span style="color:${r.colore}">${r.etichetta}</span>`, iconSize: [100, 14] }), interactive: false }).addTo(layers.rotte); }
    });
  }

  /* ---------- flight markers ---------- */
  function iconaFlight(f, tipo, selez) {
    const col = f.lato === "BLUE" ? "#2e86de" : "#e74c3c";
    const img = tipo.icona && tipo.icona !== "sam" ? `<img src="assets/icons/${tipo.icona}.png" style="transform:rotate(${Math.round(f.hdg)}deg)">` : `<div class="dot" style="background:${col}"></div>`;
    const lbl = `${f.callsign} <small>${f.n}x</small>`;
    return L.divIcon({ className: `sym-flight ${f.lato.toLowerCase()} ${selez ? "sel" : ""} ${f.ingaggio ? "eng" : ""}`, html: `<div class="fl-ico">${img}</div><div class="fl-lbl" style="border-color:${col}">${lbl}</div>`, iconSize: [ICON_SIZE, ICON_SIZE], iconAnchor: [ICON_SIZE / 2, ICON_SIZE / 2] });
  }
  function aggiornaFlights(vista, selId, onClick) {
    const presenti = new Set();
    vista.flights.forEach(f => {
      if (f.distrutto || f.stato === "terra" || f.stato === "prontezza" || f.stato === "scramble" || f.stato === "atterrato") { if (flightMarkers[f.id]) { layers.flights.removeLayer(flightMarkers[f.id]); delete flightMarkers[f.id]; } return; }
      presenti.add(f.id); const tipo = sc.tipi[f.tipo];
      if (!flightMarkers[f.id]) { flightMarkers[f.id] = L.marker([f.lat, f.lon], { icon: iconaFlight(f, tipo, f.id === selId), zIndexOffset: 1000 }).addTo(layers.flights); flightMarkers[f.id].on("click", () => onClick && onClick(f.id)); }
      const m = flightMarkers[f.id]; m.setLatLng([f.lat, f.lon]); m.setIcon(iconaFlight(f, tipo, f.id === selId));
      m.bindTooltip(`<b>${f.callsign}</b> – ${f.n}x ${tipo.nome}<br>${f.fase}<br>HDG ${Math.round(f.hdg)}° · GS ${Math.round(f.gs)} kt · M${(f.mach || 0).toFixed(2)}<br>FL${Math.round(f.alt / 100)} · autonomia ${Math.max(0, Math.round(f.autonomia))} min<br>${GEO.fmtBE(sc.mappa.bullseye, f)}`, { direction: "right", offset: [18, 0] });
      // scia
      if (!trails[f.id]) trails[f.id] = L.polyline([], { color: f.lato === "BLUE" ? "#2e86de" : "#e74c3c", weight: 2, opacity: 0.5, interactive: false }).addTo(layers.trails);
      const ll = trails[f.id].getLatLngs(); ll.push([f.lat, f.lon]); if (ll.length > 120) ll.shift(); trails[f.id].setLatLngs(ll);
    });
    Object.keys(flightMarkers).forEach(id => { if (!presenti.has(id)) { layers.flights.removeLayer(flightMarkers[id]); delete flightMarkers[id]; } });
  }
  function flashIngaggio(lat, lon, testo) {
    const m = L.marker([lat, lon], { icon: L.divIcon({ className: "sym-eng", html: `<div class="eng-burst">✸</div><div class="eng-lbl">${testo}</div>`, iconSize: [120, 40], iconAnchor: [60, 20] }), interactive: false }).addTo(layers.ingaggi);
    setTimeout(() => layers.ingaggi.removeLayer(m), 12000);
  }
  function aggiornaTarget(targets) { targets.forEach(t => { const m = tgtMarkers[t.id]; if (!m) return; const el = m.getElement(); if (el) { el.classList.toggle("hit", t.danni > 0 && !t.distrutto); el.classList.toggle("dead", t.distrutto); el.classList.toggle("assente", t.presente === false && !t.distrutto); } }); }
  function pulisciDinamici() { layers.flights.clearLayers(); layers.trails.clearLayers(); layers.ingaggi.clearLayers(); flightMarkers = {}; trails = {}; }

  /* ---------- pick point & righello ---------- */
  function pick(cb) { pickCb = cb; document.getElementById("map").classList.add("picking"); }
  function rulerToggle(on) { ruler.attivo = on; ruler.pts = []; layers.ruler.clearLayers(); document.getElementById("map").classList.toggle("ruler", on); }
  function rulerClick(ll) {
    ruler.pts.push({ lat: ll.lat, lon: ll.lng }); L.circleMarker(ll, { radius: 4, color: "#f1c40f" }).addTo(layers.ruler);
    if (ruler.pts.length >= 2) { const a = ruler.pts[ruler.pts.length - 2], b = ruler.pts[ruler.pts.length - 1]; const d = GEO.dist(a, b), brg = GEO.bearing(a, b);
      const e480 = PHYS.eta(a, b, 480, { da: sc.meteo.vento_da_gradi, kt: sc.meteo.vento_kt });
      L.polyline([[a.lat, a.lon], [b.lat, b.lon]], { color: "#f1c40f", weight: 2, dashArray: "4 4" }).addTo(layers.ruler);
      L.marker([b.lat, b.lon], { icon: L.divIcon({ className: "lbl-ruler", html: `${d.toFixed(0)} NM · ${Math.round(brg)}° · ${e480.min.toFixed(0)} min @480 kt (GS ${Math.round(e480.gs)})`, iconSize: [260, 16], iconAnchor: [-8, 8] }) }).addTo(layers.ruler); }
  }
  function radarRings(vista, on) { layers.radar.clearLayers(); if (!on) { map.removeLayer(layers.radar); return; } layers.radar.addTo(map);
    vista.flights.forEach(f => { const t = sc.tipi[f.tipo]; if (f.alt > 50 && t.radar_nm > 0) L.circle([f.lat, f.lon], { radius: t.radar_nm * 1852, color: f.lato === "BLUE" ? "#2e86de" : "#e74c3c", weight: 1, opacity: 0.4, fill: false, interactive: false }).addTo(layers.radar); }); }
  function fitScenario() { map.fitBounds([[40.0, -125.6], [42.3, -121.0]]); }
  function centra(p, z) { map.setView([p.lat, p.lon], z || map.getZoom()); }
  function reDraw(scenario) { sc = scenario; disegnaStatici(); }
  return { init, setBase, toggle, setSectionalOpacity, disegnaSam, disegnaRotte, aggiornaFlights, flashIngaggio, aggiornaTarget, pulisciDinamici, pick, rulerToggle, radarRings, fitScenario, centra, reDraw, get map() { return map; } };
})();
