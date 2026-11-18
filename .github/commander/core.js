/* CENTURION2 - Commander mission authoring core. No real-world operational data. */
(function (root) {
  "use strict";
  const STORE = "centurion2_commander_library_v1";
  const CATEGORIES = ["basi", "target", "sam", "cap_box", "gate", "aar", "orbite"];
  const clone = value => JSON.parse(JSON.stringify(value));
  const finite = v => Number.isFinite(Number(v));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const latOK = n => finite(n) && Math.abs(Number(n)) <= 84;
  const lonOK = n => finite(n) && Math.abs(Number(n)) <= 180;
  const fmtCoord = p => Number(p.lat).toFixed(5) + ", " + Number(p.lon).toFixed(5);
  function pos(lat, lon, north, east) {
    const y = clamp(Number(lat) + north, -83.8, 83.8);
    const factor = Math.max(0.18, Math.cos(y * Math.PI / 180));
    let x = Number(lon) + east / factor;
    x = ((x + 180) % 360 + 360) % 360 - 180;
    return { lat: Number(y.toFixed(5)), lon: Number(x.toFixed(5)) };
  }
  function point(id, nome, p, extra) { return Object.assign({ id: id, nome: nome, lat: p.lat, lon: p.lon }, extra || {}); }
  function uid(prefix, arr) {
    const used = new Set(arr.map(x => x.id));
    let i = 1; while (used.has(prefix + i)) i++;
    return prefix + i;
  }
  function clockMinutes(value) {
    if (!/^\d\d:\d\d$/.test(String(value || ""))) return NaN;
    const h = +value.slice(0, 2), m = +value.slice(3);
    return h < 24 && m < 60 ? 60 * h + m : NaN;
  }
  function addEntity(sc, category, ll, side) {
    if (!CATEGORIES.includes(category)) throw new Error("Tipo di punto sconosciuto");
    if (!latOK(ll.lat) || !lonOK(ll.lon)) throw new Error("Coordinate non valide");
    const ids = { basi: "BASE", target: "TGT", sam: "SAM", cap_box: "CAP", gate: "GATE", aar: "AAR", orbite: "ORBIT" };
    const names = { basi: "Base", target: "Obiettivo", sam: "Batteria SAM", cap_box: "Zona CAP", gate: "Gate", aar: "Tanker", orbite: "Orbita AEW" };
    const arr = sc[category], id = uid(ids[category], arr);
    const extras = {
      basi: { lato: side || "BLUE", pista_ft: 7500, nazione: "Scenario personalizzato" },
      target: { gbu_richieste: 2, descrizione: "Bersaglio simulato", primario: true },
      sam: { missili: 10, raggio_nm: 40 },
      cap_box: { lato: side || "RED", raggio_nm: 16 },
      gate: {},
      aar: { quota_ft: 25000, orient: 0, lunghezza_nm: 30 },
      orbite: { tipo: "E7", quota_ft: 33000 }
    };
    const p = point(id, names[category] + " " + arr.length, { lat: +ll.lat, lon: +ll.lon }, extras[category]);
    arr.push(p); return p;
  }
  function addFormation(sc, side, type) {
    side = side === "RED" ? "RED" : "BLUE";
    const typeOptions = Object.keys(sc.tipi || {}).filter(k => sc.tipi[k].lato === side && k !== "SA10" && sc.tipi[k].categoria !== "SAM");
    const tipo = typeOptions.includes(type) ? type : typeOptions[0];
    if (!tipo) throw new Error("Nessun velivolo disponibile per " + side);
    const base = sc.basi.find(b => b.lato === side);
    if (!base) throw new Error("Aggiungi prima una base " + side);
    const id = uid(side === "BLUE" ? "BLUE" : "RED", sc.formazioni);
    const f = { id: id, callsign: id, lato: side, tipo: tipo, numero: 2, base: base.id, ruolo: side === "BLUE" ? "STRIKE" : "DCA" };
    sc.formazioni.push(f);
    sc.piani.BLUE = sc.piani.BLUE || { formazioni: {} };
    sc.piani.BLUE.formazioni = sc.piani.BLUE.formazioni || {};
    sc.piani.RED = sc.piani.RED || { cap: [], prontezza: [], sam_moves: [], commit_nm: 60 };
    if (side === "BLUE") {
      sc.piani.BLUE.formazioni[id] = { decollo: "09:10", push: "09:40",
        tanker: sc.aar[0] ? sc.aar[0].id : "", aar_ordine: 1,
        gate_in: sc.gate[0] ? sc.gate[0].id : "", gate_out: sc.gate[1] ? sc.gate[1].id : (sc.gate[0] ? sc.gate[0].id : ""),
        target: sc.target[0] ? sc.target[0].id : "" };
    } else if (sc.cap_box.some(c => c.lato === "RED")) {
      const cap = sc.cap_box.find(c => c.lato === "RED");
      sc.piani.RED.cap.push({ box: cap.id, formazione: id, da: "09:00", a: "11:00" });
    }
    return f;
  }
  function fresh(lat, lon) {
    if (!latOK(lat) || !lonOK(lon)) throw new Error("Centro mappa non valido");
    const sc = clone(SCENARIO_DEFAULT);
    const P = (n, e) => pos(lat, lon, n, e);
    sc.meta.nome = "Nuova missione Comandante";
    sc.meta.note = "Scenario personalizzato creato con la Modalita Comandante";
    sc.missione = { id: "CUSTOM", codice: "COMANDANTE", titolo: sc.meta.nome,
      tipo: "Missione personalizzata", focus: "Pianificazione e simulazione", domande: [], difficolta: 3 };
    sc.mappa.centro = [+lat, +lon]; sc.mappa.zoom = 10; sc.mappa.tile_default = "osm";
    sc.mappa.nazioni = []; sc.mappa.fir_boundary = [];
    sc.mappa.sectional.attivo = false; sc.mappa.griglia.attiva = false;
    sc.mappa.griglia.origine = [clamp(+lat - 1, -84, 84), +lon];
    sc.mappa.bullseye = point("BULLSEYE", "BULLSEYE", P(0, 0));
    sc.basi = [point("BLUE_BASE", "Base BLUE", P(0.28, -0.65), { lato: "BLUE", nazione: "BLUE", pista_ft: 9000 }),
      point("RED_BASE", "Base RED", P(-0.18, 0.55), { lato: "RED", nazione: "RED", pista_ft: 9000 })];
    sc.target = [point("TGT1", "Obiettivo principale", P(0, 0.42), { gbu_richieste: 2, descrizione: "Obiettivo di addestramento", primario: true })];
    sc.sam = [point("SAM1", "Difesa SAM", P(0.15, 0.50), { missili: 10, raggio_nm: 30 })];
    sc.gate = [point("GATE1", "Ingresso BLUE", P(0.12, -0.15)),
      point("GATE2", "Uscita BLUE", P(-0.12, -0.13))];
    sc.aar = [point("AAR1", "Tanker BLUE", P(0.22, -0.48), { quota_ft: 25000, orient: 0, lunghezza_nm: 30 })];
    sc.orbite = [];
    sc.cap_box = [point("CAPRED1", "CAP difensiva", P(0.22, 0.25), { lato: "RED", raggio_nm: 16 }),
      point("CAPBLUE1", "CAP di scorta", P(0.1, -0.22), { lato: "BLUE", raggio_nm: 12 })];
    sc.formazioni = []; sc.piani = { BLUE: { formazioni: {} }, RED: { cap: [], prontezza: [], sam_moves: [], commit_nm: 60 } };
    addFormation(sc, "BLUE", "F16"); addFormation(sc, "RED", "SU35");
    sc.tempo.inizio = "09:00"; sc.tempo.fine = "15:00";
    sc.meteo.vento_da_gradi = 270; sc.meteo.vento_kt = 10;
    sc.meteo.descrizione = "Condizioni meteorologiche del simulatore";
    sc.squadre.BLUE.nome = "Squadra BLUE"; sc.squadre.RED.nome = "Squadra RED";
    sc.briefing.BLUE.titolo = "Attacco - Missione personalizzata";
    sc.briefing.BLUE.situazione = "Scenario di simulazione creato dal Comandante";
    sc.briefing.BLUE.task = ["Eseguire gli obiettivi selezionati nella mappa"];
    sc.briefing.BLUE.threat = "Difese e pattuglie presenti nella mappa";
    sc.briefing.RED.titolo = "Difesa - Missione personalizzata";
    sc.briefing.RED.situazione = "Organizzare la difesa delle posizioni assegnate";
    sc.briefing.RED.task = ["Proteggere le installazioni e contrastare gli attacchi"];
    sc.briefing.RED.threat = "Formazioni di attacco BLUE";
    updateGoals(sc);
    return sc;
  }
  function copyCurrent(current) {
    if (!current) return fresh(40.85, -123);
    const sc = clone(current);
    sc.missione = { id: "CUSTOM", codice: "COMANDANTE", titolo: (sc.meta.nome || "Missione") + " - personalizzata",
      tipo: "Missione personalizzata", focus: "Missione personalizzata", domande: [], difficolta: 3 };
    sc.meta.nome = sc.missione.titolo;
    (sc.target || []).forEach(t => { if (t.primario == null) t.primario = true; });
    return sc;
  }
  function updateGoals(sc) {
    const other = (sc.obiettivi || []).filter(o => o.tipo !== "distruggi" && o.tipo !== "sopprimi_sam");
    const destroy = sc.target.filter(t => t.primario !== null).map(t => ({
      tipo: "distruggi", target: [t.id], minimo: 1, primario: t.primario !== false, testo: "Colpire " + t.nome
    }));
    sc.obiettivi = destroy.concat(other);
    sc.missione = sc.missione || {};
    sc.missione.titolo = sc.meta.nome;
  }
  function reconcile(sc) {
    if (!sc || !sc.mappa || !Array.isArray(sc.basi) || !Array.isArray(sc.formazioni)) throw new Error("Scenario non valido");
    for (const cat of CATEGORIES) {
      if (!Array.isArray(sc[cat])) throw new Error("Manca la sezione " + cat);
      const ids = new Set();
      for (const p of sc[cat]) {
        if (!p || typeof p.id !== "string" || !p.id || ids.has(p.id)) throw new Error("ID duplicato o non valido in " + cat);
        ids.add(p.id);
        if (!latOK(p.lat) || !lonOK(p.lon)) throw new Error("Coordinate non valide: " + p.id);
      }
    }
    if (!sc.basi.some(b => b.lato === "BLUE") || !sc.basi.some(b => b.lato === "RED"))
      throw new Error("Servono almeno una base BLUE e una RED");
    if (sc.gate.length < 2) throw new Error("Servono almeno due Gate per le rotte");
    if (!sc.aar.length) throw new Error("Serve almeno un punto AAR (tanker)");
    if (!sc.mappa.centro || !latOK(sc.mappa.centro[0]) || !lonOK(sc.mappa.centro[1])) throw new Error("Centro mappa non valido");
    if (!sc.tempo || !(clockMinutes(sc.tempo.inizio) < clockMinutes(sc.tempo.fine))) throw new Error("Finestra temporale non valida");
    if (!sc.meta || !String(sc.meta.nome || "").trim()) throw new Error("Dai un nome alla missione");
    const flightIds = new Set();
    for (const f of sc.formazioni) {
      if (!f.id || flightIds.has(f.id)) throw new Error("ID formazione duplicato");
      flightIds.add(f.id);
      if (!sc.basi.some(b => b.id === f.base && b.lato === f.lato)) throw new Error("Base non valida per " + f.id);
      if (!sc.tipi[f.tipo] || sc.tipi[f.tipo].lato !== f.lato) throw new Error("Aereo non valido per " + f.id);
      if (!Number.isInteger(+f.numero) || +f.numero < 1 || +f.numero > 24) throw new Error("Numero aerei non valido: " + f.id);
    }
    const B = (sc.piani && sc.piani.BLUE) || { formazioni: {} };
    const R = (sc.piani && sc.piani.RED) || { cap: [], prontezza: [], sam_moves: [], commit_nm: 60 };
    B.formazioni = B.formazioni || {}; R.cap = R.cap || []; R.prontezza = R.prontezza || []; R.sam_moves = R.sam_moves || [];
    for (const id of Object.keys(B.formazioni)) if (!sc.formazioni.some(f => f.id === id && f.lato === "BLUE")) delete B.formazioni[id];
    const idsOf = category => sc[category].map(p => p.id);
    for (const p of Object.values(B.formazioni)) {
      if (!idsOf("target").includes(p.target)) delete p.target;
      if (!idsOf("target").includes(p.target2)) delete p.target2;
      if (!idsOf("cap_box").includes(p.cap)) delete p.cap;
      if (!idsOf("gate").includes(p.gate_in)) p.gate_in = sc.gate[0].id;
      if (!idsOf("gate").includes(p.gate_out)) p.gate_out = sc.gate[1].id;
      if (!idsOf("aar").includes(p.tanker)) p.tanker = sc.aar[0].id;
      if (!clockMinutes(p.decollo) && p.decollo !== "00:00") p.decollo = sc.tempo.inizio;
      if (!Number.isFinite(clockMinutes(p.push))) p.push = sc.tempo.inizio;
    }
    R.cap = R.cap.filter(c => flightIds.has(c.formazione) && idsOf("cap_box").includes(c.box));
    R.prontezza = R.prontezza.filter(id => flightIds.has(id));
    R.sam_moves = R.sam_moves.filter(m => idsOf("sam").includes(m.sam));
    sc.piani = { BLUE: B, RED: R };
    updateGoals(sc);
    return sc;
  }
  function readLibrary() {
    try { const a = JSON.parse(localStorage.getItem(STORE) || "[]"); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function listSaved() {
    return readLibrary().map(x => ({ id: x.id, nome: x.nome, savedAt: x.savedAt, count: (x.scenario && x.scenario.target || []).length }))
      .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  }
  function readSaved(id) { const entry = readLibrary().find(x => x.id === id); return entry ? clone(entry) : null; }
  function save(sc, id) {
    reconcile(sc);
    const all = readLibrary();
    const key = id || "CM-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e7).toString(36);
    const entry = { id: key, nome: String(sc.meta.nome).trim(), savedAt: new Date().toISOString(), scenario: clone(sc), schema: 1 };
    const idx = all.findIndex(x => x.id === key);
    if (idx >= 0) all[idx] = entry; else all.push(entry);
    try { localStorage.setItem(STORE, JSON.stringify(all)); }
    catch (e) { throw new Error("Spazio di salvataggio esaurito: esporta la missione in JSON"); }
    return entry;
  }
  function remove(id) { localStorage.setItem(STORE, JSON.stringify(readLibrary().filter(x => x.id !== id))); }
  function importMission(data) {
    const body = data && (data.scenario || data.sc);
    if (!body || !body.meta || !body.mappa || !body.piani) throw new Error("Importa un file missione JSON di CENTURION2");
    const sc = clone(body);
    if (!sc.missione || sc.missione.id !== "CUSTOM") sc.missione = { id: "CUSTOM", codice: "COMANDANTE", titolo: String(sc.meta.nome || "Missione importata"), tipo: "Missione personalizzata", difficolta: 3, focus: "", domande: [] };
    reconcile(sc); return sc;
  }
  root.COMMANDER_CORE = { clone: clone, pos: pos, uid: uid, fmtCoord: fmtCoord, latOK: latOK, lonOK: lonOK,
    fresh: fresh, copyCurrent: copyCurrent, addEntity: addEntity, addFormation: addFormation,
    reconcile: reconcile, updateGoals: updateGoals, listSaved: listSaved, readSaved: readSaved,
    save: save, remove: remove, importMission: importMission, clockMinutes: clockMinutes, categories: CATEGORIES };
})(window);
