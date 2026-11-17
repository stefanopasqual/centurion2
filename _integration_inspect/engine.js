/* =====================================================================
   MOTORE DI SIMULAZIONE – Centurion
   Simulazione a tempo discreto (tick = tempo.tick_sec secondi di simulazione).
   Entità: formazioni (flight di N velivoli), batterie SAM, target, tanker, E-7.
   Le regole numeriche (kill ratio, autonomie, tempi) vengono dallo scenario
   (modificabile da Editor/Excel). La cinematica è in physics.js.
   ===================================================================== */
class Engine {
  constructor(scenario) { this.sc = scenario; this.listeners = []; this.reset(); }

  /* ---------- utilità ---------- */
  static hm2s(hm) { if (!hm) return null; const [h, m] = hm.split(":").map(Number); return h * 3600 + (m || 0) * 60; }
  static s2hm(s) { s = Math.round(s); const h = Math.floor(s / 3600) % 24, m = Math.floor((s % 3600) / 60); return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`; }
  static s2hms(s) { s = Math.round(s); const h = Math.floor(s / 3600) % 24, m = Math.floor((s % 3600) / 60), x = s % 60; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(x).padStart(2,"0")}`; }
  on(fn) { this.listeners.push(fn); }
  emit(ev) { this.listeners.forEach(f => f(ev)); }
  rnd() { // LCG deterministico (seed fisso → stessa partita a parità di piano)
    this._seed = (this._seed * 1103515245 + 12345) & 0x7fffffff; return this._seed / 0x7fffffff;
  }
  roundKill(x) {
    if (this.sc.regole.arrotondamento_kill === "probabilistico") { const f = Math.floor(x); return f + (this.rnd() < (x - f) ? 1 : 0); }
    return Math.floor(x + 0.5);
  }
  find(arr, id) { return (arr || []).find(x => x.id === id); }
  base(id) { return this.find(this.sc.basi, id); }
  tipo(f) { return this.sc.tipi[f.tipo]; }
  get vento() {
    const m = this.sc.meteo; const extra = this.injectAttivo("temporale") ? 15 : 0;
    return { da: m.vento_da_gradi, kt: m.vento_kt + extra };
  }
  injectAttivo(id) { const i = this.find(this.sc.inject, id); return !!(i && i.attivo); }

  /* ---------- reset: costruisce lo stato iniziale ---------- */
  reset() {
    const sc = this.sc; this._seed = 20260614;
    this.t = Engine.hm2s(sc.tempo.inizio); this.tFine = Engine.hm2s(sc.tempo.fine);
    this.tick_sec = sc.tempo.tick_sec || 10;
    this.eventi = []; this.ingaggi = []; this.registrazione = []; this.finita = false;
    this.injectStart = {};
    this.score = { BLUE: { kills: 0, perdite: 0, gbu: 0, target_distrutti: 0, netto_excel: 0 }, RED: { kills: 0, perdite: 0, missili_sam: 0, netto_excel: 0 } };
    this.target = sc.target.map(t => ({ ...t, danni: 0, distrutto: false, presente: true }));
    this.sam = sc.sam.map(s => ({ ...s, lat0: s.lat, lon0: s.lon, dest: null, attivo: true, ultimo_lancio: -1e9, nota_blue: { lat: s.lat, lon: s.lon } }));
    this.tanker = sc.aar.map(a => ({ ...a, occupato_da: null, fine_aar: 0, coda: [], attivo: true }));
    this.e7 = sc.orbite.filter(o => o.tipo === "E7").map(o => ({ ...o, attivo: true }));
    // tipo di velivolo inesistente (rinominato nell'Editor o nell'Excel): si usa il primo tipo disponibile invece di bloccare tutto
    const tipiMancanti = sc.formazioni.filter(f => !sc.tipi[f.tipo]).map(f => [f.callsign, f.tipo]);
    this.flights = sc.formazioni.map(f => this.nuovoFlight(sc.tipi[f.tipo] ? f : { ...f, tipo: Object.keys(sc.tipi)[0] }));
    tipiMancanti.forEach(([cs, t]) => this.evento(cs, `Tipo di velivolo "${t}" inesistente nello scenario → usato ${Object.keys(sc.tipi)[0]}`, "avviso"));
    this.flights.forEach(f => { f.n_iniziale = f.n;   // base cancellata o rinominata nello scenario: la formazione usa la prima base del proprio lato
      if (!this.base(f.base)) { const alt = sc.basi.find(b => b.lato === f.lato) || sc.basi[0]; if (alt) { this.evento(f.callsign, `Base "${f.base}" inesistente nello scenario → assegnata ${alt.nome}`, "avviso"); f.base = alt.id; f.lat = alt.lat; f.lon = alt.lon; } } });
    this.applicaPiani();
    this.evento("SIM", `Simulazione pronta. Finestra ${sc.tempo.inizio}–${sc.tempo.fine}. Vento ${sc.meteo.vento_da_gradi}°/${sc.meteo.vento_kt} kt`, "sistema");
    this.registra();
  }
  // pieno di carburante: in modalità realistica conta il carburante in lb, quindi si riallineano entrambe le grandezze
  pieno(f, extraMin) { const tipo = this.tipo(f); f.autonomia = f.autonomia_max + (extraMin || 0); f.carburante_lb = (tipo.carburante_lb || 0) + (extraMin || 0) * (tipo.consumo_lbh || 0) / 60; }
  nuovoFlight(f) {
    const tipo = this.sc.tipi[f.tipo], b = this.base(f.base) || { lat: 41.78, lon: -124.24 };
    return {
      id: f.id, callsign: f.callsign, lato: f.lato, tipo: f.tipo, n: f.numero, n_iniziale: f.numero, base: f.base, ruolo: f.ruolo,
      lat: b.lat, lon: b.lon, hdg: 90, tas: 0, alt: 0, gs: 0, mach: 0, nG: 1, regime: "terra",
      stato: "terra", fase: "A terra", wps: [], wp_i: 0,
      autonomia: tipo.autonomia_min, autonomia_max: tipo.autonomia_min, carburante_lb: tipo.carburante_lb,
      armi: { ...(tipo.armi || {}) }, bombe_sganciate: false, aar_fatto: false,
      ingaggio: null, cooldown: {}, sortie: 0, t_decollo: null, t_atterraggio: null, disponibile_da: this.t, hold_until: null,
      piano: null, target_commit: null, rtb_motivo: null, distrutto: false, ultimo_sam: -1e9, cap_box: null, cap_fine: null, t_prontezza: null, scramble: false, tanker_id: null
    };
  }

  /* ---------- PIANI → stato iniziale delle formazioni ---------- */
  applicaPiani() {
    const pB = this.sc.piani.BLUE, pR = this.sc.piani.RED;
    this.flights.forEach(f => {
      if (f.lato === "BLUE" && pB && pB.formazioni && pB.formazioni[f.id]) {
        f.piano = { ...pB.formazioni[f.id] };
        f.t_decollo_pianificato = Engine.hm2s(f.piano.decollo);
        this.pieno(f, 40); // carburante interno per raggiungere il tanker
      }
      if (f.lato === "RED" && pR) {
        // copie dei turni CAP: il motore li marca come eseguiti (_fatto) e non deve sporcare il piano salvato (altrimenti dopo ⟲ le CAP non decollano più)
        (pR.cap || []).forEach(c => { delete c._fatto; });
        f.piano = { cap: (pR.cap || []).filter(c => c.formazione === f.id).map(c => ({ ...c })), alert: (pR.prontezza || []).includes(f.id) };
        if (f.piano.alert) { f.stato = "prontezza"; f.fase = "Prontezza al suolo"; }
        this.pieno(f);
      }
    });
    if (pR && pR.sam_moves) pR.sam_moves.forEach(m => { const s = this.find(this.sam, m.sam); if (s) { s.dest = { lat: m.lat, lon: m.lon, da: Engine.hm2s(m.da || this.sc.tempo.inizio) }; } });
    this.commit_nm = (pR && pR.commit_nm) || 60;
  }

  /* ---------- costruzione rotta BLUE (base → AAR → gate → target/CAP → gate → base) ---------- */
  rottaBlue(f, silenzioso) {   // silenzioso: anteprima (mappa, vista 3D) senza eventi nel log e senza toccare il velivolo
    const p = silenzioso ? { ...f.piano } : f.piano, sc = this.sc, b = this.base(f.base) || sc.basi.find(x => x.lato === f.lato) || sc.basi[0], tipo = this.tipo(f), wps = [];
    const avvisa = (chi, testo) => { if (!silenzioso) this.evento(chi, testo, "avviso"); };
    const tk = this.find(this.tanker, p.tanker) || this.tanker[0];
    if (tk && !this.tankerDisponibile(tk)) { const alt = this.tanker.find(t => this.tankerDisponibile(t)); if (alt) avvisa(f.callsign, `Tanker ${tk.nome} non disponibile → dirotto su ${alt.nome}`); }
    const tkUse = (tk && this.tankerDisponibile(tk)) ? tk : this.tanker.find(t => this.tankerDisponibile(t));
    if (tkUse) { wps.push({ lat: tkUse.lat, lon: tkUse.lon, alt: tkUse.quota_ft, nome: tkUse.nome, azione: "aar", tanker: tkUse.id }); if (!silenzioso) f.tanker_id = tkUse.id; }
    const gIn = this.find(sc.gate, p.gate_in) || sc.gate[1];
    wps.push({ lat: gIn.lat, lon: gIn.lon, alt: tipo.quota_ft, nome: gIn.nome, azione: "push", push: Engine.hm2s(p.push) });
    // riferimenti del piano che non esistono più nello scenario: si avvisa e si prosegue senza quella tratta (niente blocco della simulazione)
    if (p.target && !this.find(this.target, p.target)) { avvisa(f.callsign, `Piano: target "${p.target}" inesistente nello scenario → nessun attacco`); p.target = undefined; p.target2 = undefined; }
    if (p.target2 && !this.find(this.target, p.target2)) { avvisa(f.callsign, `Piano: 2º target "${p.target2}" inesistente → ignorato`); p.target2 = undefined; }
    if (p.cap && !this.find(sc.cap_box, p.cap)) { avvisa(f.callsign, `Piano: CAP "${p.cap}" inesistente nello scenario → ignorata`); p.cap = undefined; }
    if (p.target) { const t = this.find(this.target, p.target); const t2 = p.target2 && p.target2 !== p.target ? this.find(this.target, p.target2) : null;
      // due target: sul primo solo le GBU che servono, tutte le rimanenti restano per il secondo
      wps.push({ lat: t.lat, lon: t.lon, alt: tipo.quota_ft - 10000, nome: t.nome, azione: "attacco", target: t.id });
      if (t2) wps.push({ lat: t2.lat, lon: t2.lon, alt: tipo.quota_ft - 10000, nome: t2.nome, azione: "attacco", target: t2.id }); }
    else if (p.cap) { const c = this.find(sc.cap_box, p.cap); wps.push({ lat: c.lat, lon: c.lon, alt: tipo.quota_ft, nome: c.nome, azione: "cap", cap: c.id, durata_min: p.cap_min || 30 }); }
    else if (p.stazione && p.stazione.lat) { wps.push({ lat: p.stazione.lat, lon: p.stazione.lon, alt: tipo.quota_ft, nome: "Stazione EA", azione: "cap", cap: "STAZIONE", durata_min: p.cap_min || 40 }); }
    const gOut = this.find(sc.gate, p.gate_out) || gIn;
    wps.push({ lat: gOut.lat, lon: gOut.lon, alt: tipo.quota_ft, nome: gOut.nome, azione: "egress" });
    wps.push({ lat: b.lat, lon: b.lon, alt: 0, nome: b.nome, azione: "atterraggio" });
    return wps;
  }
  tankerDisponibile(tk) { if (this.injectAttivo("tanker_fallout") && tk.id === "AAR_SUD") return false; return tk.attivo; }

  /* ---------- eventi ---------- */
  evento(chi, testo, tipo, extra) {
    const e = { t: this.t, ora: Engine.s2hms(this.t), chi, testo, tipo: tipo || "info", ...(extra || {}) };
    this.eventi.push(e); this.emit({ tipo: "evento", e }); return e;
  }
  registra() {
    if (this.registrazione.length && this.t - this.registrazione[this.registrazione.length - 1].t < 30) return;
    this.registrazione.push({ t: this.t, f: this.flights.map(f => [f.id, +f.lat.toFixed(4), +f.lon.toFixed(4), Math.round(f.hdg), f.n, f.stato, Math.round(f.alt), Math.round(f.autonomia)]),
      s: this.sam.map(s => [s.id, +s.lat.toFixed(4), +s.lon.toFixed(4), s.missili, s.attivo]), tg: this.target.map(t => t.danni) });
  }

  /* ---------- TICK principale ---------- */
  tick() {
    if (this.finita) return;
    const dt = this.tick_sec; this.t += dt;
    this.aggiornaInject();
    this.target.forEach(t => { const p = this.inFinestra(t); if (t.finestra && p !== t.presente && !t.distrutto) this.evento("INTEL", p ? `POP-UP: ${t.nome} individuato (finestra fino alle ${t.finestra.a})` : `${t.nome} non più localizzabile (finestra chiusa)`, p ? "inject" : "sistema"); t.presente = p; });
    this.aggiornaSam(dt);
    this.aggiornaSead();
    // un dato anomalo in una formazione non deve fermare tutta la simulazione
    this.flights.forEach(f => { if (f.distrutto) return; try { this.aggiornaFlight(f, dt); } catch (e) { if (!f._errore) { f._errore = true; console.error(e); this.evento(f.callsign, `Errore nei dati della formazione (${e.message}): resta ferma`, "avviso"); } } });
    this.aggiornaIngaggi(dt);
    this.aggiornaSamIngaggi();
    this.registra();
    if (this.t >= this.tFine) { this.finita = true; this.evento("SIM", "Fine della finestra operativa. Vai al DEBRIEF.", "sistema"); }
    if (this.flights.filter(f => f.lato === "BLUE" && !f.distrutto && f.sortie > 0 && f.stato !== "atterrato").length === 0 &&
        this.flights.filter(f => f.lato === "BLUE" && f.piano && f.sortie === 0).length === 0 && this.t > Engine.hm2s(this.sc.tempo.inizio) + 600 && !this._avvisoFine) {
      this._avvisoFine = true; this.evento("SIM", "Tutte le formazioni BLUE hanno concluso la missione. Puoi fermare la simulazione e andare al DEBRIEF.", "sistema");
    }
  }

  aggiornaInject() {
    this.sc.inject.forEach(i => {
      if (i.attivo && this.injectStart[i.id] == null) { this.injectStart[i.id] = this.t; this.evento("INJECT", `${i.nome}: ${i.descrizione}`, "inject"); }
      if (!i.attivo && this.injectStart[i.id] != null) { delete this.injectStart[i.id]; this.evento("INJECT", `${i.nome} rientrato`, "inject"); }
    });
    this.sam.forEach(s => { s.attivo = !this.injectAttivo("no_sam") && s.missili > 0; });
    this.e7.forEach(e => { e.attivo = !this.injectAttivo("no_awacs"); });
  }
  baseChiusa(baseId) {
    if (baseId === "TACCOLA" && this.injectAttivo("aeroporto_chiuso") && this.t - this.injectStart["aeroporto_chiuso"] < 1800) return true;
    if (baseId === "REDDING" && this.injectAttivo("terremoto") && this.t - this.injectStart["terremoto"] < 3600) return true;
    return false;
  }

  /* ---------- SAM: movimento a 10 km/h ---------- */
  aggiornaSam(dt) {
    const v = this.sc.regole.sam_velocita_kmh / 1.852; // kt
    this.sam.forEach(s => {
      if (!s.dest || this.t < s.dest.da) return;
      const d = GEO.dist(s, s.dest); if (d < 0.05) { s.lat = s.dest.lat; s.lon = s.dest.lon; this.evento(s.nome, `In posizione (${GEO.fmtBE(this.sc.mappa.bullseye, s)})`, "red"); s.dest = null; return; }
      if (!s._moving) { s._moving = true; this.evento(s.nome, `Inizia lo spostamento (${this.sc.regole.sam_velocita_kmh} km/h, ETA ${Math.round(d / v * 60)} min)`, "red"); }
      const np = GEO.dest(s, GEO.bearing(s, s.dest), Math.min(d, v * dt / 3600)); s.lat = np.lat; s.lon = np.lon;
    });
  }

  /* ---------- FLIGHT: macchina a stati ---------- */
  aggiornaFlight(f, dt) {
    const tipo = this.tipo(f);
    switch (f.stato) {
      case "terra": this.terra(f); return;
      case "prontezza": this.prontezza(f); return;
      case "scramble": if (this.t >= f.t_prontezza) { this.decolla(f, "SCRAMBLE"); } return;
      case "atterrato": return;
    }
    // in volo
    if (f.ingaggio) { this.volaCerchio(f, dt, "ingaggio"); this.consuma(f, "ingaggio", dt);
      // già sul target: allo scadere del tempo sul target le bombe vengono sganciate anche se la formazione è stata ingaggiata nel frattempo
      if (f.stato === "attacco" && this.t >= f.attacco_fine) this.fineAttacco(f);
      return; }
    this.consuma(f, f.regime || "crociera", dt);
    // BINGO → RTB (non durante l'attacco)
    // in coda al tanker la formazione è già dove si rifornisce: niente BINGO (la rimanderebbe allo stesso tanker), ma priorità se il carburante è al minimo
    if (f.stato === "attesa_aar" && f.autonomia <= 10 && !f._minFuel) { const tk = this.find(this.tanker, (this.wp(f) || {}).tanker); if (tk && tk.coda[0] !== f.id) { tk.coda = [f.id, ...tk.coda.filter(x => x !== f.id)]; f._minFuel = true; this.evento(f.callsign, `MINIMUM FUEL in coda al ${tk.nome} → priorità al rifornimento`, "avviso"); } }
    if (this.sc.regole.bingo_auto_rtb && f.stato !== "rtb" && f.stato !== "attacco" && f.stato !== "aar" && f.stato !== "attesa_aar") {
      const homes = this.rifugi(f); const bingo = PHYS.bingoMinutes(f, homes, tipo.tas_crociera_kt, this.vento, 5);
      if (f.autonomia <= bingo) { this.vaiRtb(f, "BINGO"); }
    }
    if (f.autonomia <= 0) { this.perdita(f, f.n, "carburante esaurito (FLAMEOUT)"); return; }
    // commit su nemici (caccia con missili)
    if (["ingresso", "cap", "verso_cap", "egress", "intercetta", "verso_target"].includes(f.stato)) this.valutaCommit(f);
    switch (f.stato) {
      case "verso_aar": this.versoWp(f, dt, () => this.arrivoAar(f)); break;
      case "attesa_aar": this.volaCerchio(f, dt, "cap"); this.provaAar(f); break;
      case "aar": this.volaCerchio(f, dt, "aar");
        { // travaso progressivo: durante il rifornimento il carburante sale (niente FLAMEOUT agganciati al tanker)
          const dur = Math.max(1, f.aar_fine - (f.aar_inizio || f.aar_fine)); const k = Math.max(0, Math.min(1, (this.t - (f.aar_inizio || this.t)) / dur)); const obiettivo = (f.aar_aut0 || 0) + (f.autonomia_max - (f.aar_aut0 || 0)) * k;
          if (f.autonomia < obiettivo) { f.autonomia = obiettivo; if (this.sc.regole.autonomia_modalita === "realistica") f.carburante_lb = obiettivo * this.tipo(f).consumo_lbh / 60; } }
        if (this.t >= f.aar_fine) this.fineAar(f); break;
      case "ingresso": this.versoWp(f, dt, () => this.arrivoGate(f)); break;
      case "attesa_push": this.volaCerchio(f, dt, "cap"); if (this.t >= f.hold_until) { f.hold_until = null; this.evento(f.callsign, `PUSH – ingresso in territorio nemico (${this.wpNome(f)})`, "blue"); this.avanza(f); } break;
      case "verso_target": this.versoWp(f, dt, () => this.arrivoTarget(f)); break;
      case "attesa_target": this.volaCerchio(f, dt, "cap"); if (this.t >= f.hold_until) { f.hold_until = null; this.arrivoTarget(f); } break;
      case "attacco": this.volaCerchio(f, dt, "attacco"); if (this.t >= f.attacco_fine) this.fineAttacco(f); break;
      case "verso_cap": this.versoWp(f, dt, () => this.arrivoCap(f)); break;
      case "cap": this.volaCerchio(f, dt, "cap"); if (f.cap_fine && this.t >= f.cap_fine) { this.evento(f.callsign, `Fine CAP ${f.cap_box || ""} → prossima tratta`, f.lato.toLowerCase()); f.cap_fine = null; f.lato === "RED" ? this.vaiRtb(f, "fine turno CAP") : this.avanza(f); } break;
      case "intercetta": this.intercetta(f, dt); break;
      case "egress": this.versoWp(f, dt, () => { this.evento(f.callsign, `FENCE OUT – fuori dal territorio nemico`, "blue"); this.avanza(f); }); break;
      case "rtb": this.versoWp(f, dt, () => this.atterra(f)); break;
      case "rtb_aar": this.versoWp(f, dt, () => this.arrivoAar(f)); break;
      default: this.versoWp(f, dt, () => this.avanza(f));
    }
  }
  wp(f) { return f.wps[f.wp_i]; }
  wpNome(f) { const w = this.wp(f); return w ? w.nome : ""; }
  rifugi(f) {
    const h = []; const b = this.base(f.base); if (b) h.push(b);
    if (f.lato === "BLUE") this.tanker.forEach(t => { if (this.tankerDisponibile(t)) h.push(t); });
    return h;
  }
  consuma(f, regime, dt) {
    const tipo = this.tipo(f);
    if (this.sc.regole.autonomia_modalita === "realistica") { f.carburante_lb -= PHYS.fuelBurn(tipo, regime, dt, "realistica"); f.autonomia = f.carburante_lb / (tipo.consumo_lbh / 60); }
    else f.autonomia -= PHYS.fuelBurn(tipo, regime, dt, "regole");
  }

  /* ----- a terra ----- */
  terra(f) {
    if (f.lato === "BLUE") {
      if (!f.piano || f.t_decollo_pianificato == null) return;
      const tDec = f.sortie === 0 ? f.t_decollo_pianificato : (f.piano.decollo2 ? Engine.hm2s(f.piano.decollo2) : null);
      if (tDec == null || this.t < tDec || this.t < f.disponibile_da) return;
      if (this.baseChiusa(f.base)) { if (!f._avvisoChiusa) { f._avvisoChiusa = true; this.evento(f.callsign, `Base ${f.base} chiusa: decollo ritardato`, "avviso"); } return; }
      if (f.n <= 0) return;
      f.wps = this.rottaBlue(f); f.wp_i = 0; f.bombe_sganciate = false; f.aar_fatto = false;
      f.armi = { ...(this.tipo(f).armi || {}) }; f.gbu_tot = null; f.harm_spesi = 0;
      this.decolla(f, "decollo pianificato"); f.stato = "verso_aar"; f.fase = "Verso il tanker";
    } else { // RED: schedule CAP
      const c = (f.piano && f.piano.cap || []).find(c => this.t >= Engine.hm2s(c.da) && this.t < Engine.hm2s(c.a) && !c._fatto);
      if (!c || this.t < f.disponibile_da || f.n <= 0) return;
      if (this.baseChiusa(f.base)) return;
      c._fatto = true; const box = this.find(this.sc.cap_box, c.box);
      if (!box) { this.evento(f.callsign, `Piano RED: box CAP "${c.box}" inesistente nello scenario → turno ignorato`, "avviso"); return; }
      f.wps = [{ lat: box.lat, lon: box.lon, alt: this.tipo(f).quota_ft, nome: box.nome, azione: "cap", cap: box.id, fine: Math.min(Engine.hm2s(c.a), this.t + this.sc.regole.cap_max_min * 60) }]; f.wp_i = 0;
      f.armi = { ...(this.tipo(f).armi || {}) }; f.gbu_tot = null; f.harm_spesi = 0; this.pieno(f);
      this.decolla(f, `decollo per ${box.nome}`); f.stato = "verso_cap"; f.fase = `Verso ${box.nome}`;
    }
  }
  prontezza(f) {
    if (f.n <= 0 || this.t < f.disponibile_da) return;
    // scramble automatico se un nemico rilevato è dentro il confine o entro 60 NM dalla base
    const b = this.base(f.base); const nemici = this.rilevati("RED").filter(e => GEO.dist(b, e) < 60 || GEO.pointInPolygon(e, this.sc.mappa.nazioni[0].poligono));
    if (nemici.length === 0 && !f.scramble) return;
    if (this.baseChiusa(f.base)) return;
    f.scramble = false; f.stato = "scramble"; f.t_prontezza = this.t + (this.tipo(f).prontezza_min || 15) * 60; f.fase = "SCRAMBLE – in preparazione";
    f.armi = { ...(this.tipo(f).armi || {}) }; f.gbu_tot = null; f.harm_spesi = 0; this.pieno(f); f.wps = []; f.wp_i = 0;
    this.evento(f.callsign, `SCRAMBLE ordinato (pronti in ${this.tipo(f).prontezza_min || 15} min)`, "red");
  }
  decolla(f, motivo) {
    const b = this.base(f.base); f.lat = b.lat; f.lon = b.lon; f.alt = 0; f.tas = 150; f.sortie++; f.t_decollo = this.t;
    f.hdg = f.wps.length ? GEO.bearing(f, f.wps[0]) : 90;
    this.evento(f.callsign, `AIRBORNE da ${b.nome} – ${f.n}x ${this.tipo(f).nome} (${motivo})`, f.lato.toLowerCase());
    if (f.lato === "RED" && f.stato === "scramble") { f.stato = "intercetta"; f.fase = "Intercettazione"; }
  }
  atterra(f) {
    const b = this.base(f.base);
    if (this.baseChiusa(f.base)) { this.volaCerchio(f, this.tick_sec, "cap"); if (!f._holdLand) { f._holdLand = true; this.evento(f.callsign, `Base chiusa: in attesa (holding)`, "avviso"); } return; }
    f._holdLand = false; f.stato = "atterrato"; f.fase = "Atterrato"; f.tas = 0; f.alt = 0; f.t_atterraggio = this.t; f.lat = b.lat; f.lon = b.lon;
    const r = this.sc.regole; const nPrima = f.n; f.n = Math.round(f.n * r.efficienza_turnaround); f.disponibile_da = this.t + r.turnaround_min * 60;
    this.pieno(f);
    this.evento(f.callsign, `Atterrato a ${b.nome}. Turnaround ${r.turnaround_min} min: ${f.n}/${nPrima} pronti alle ${Engine.s2hm(f.disponibile_da)}`, f.lato.toLowerCase());
    // rendi di nuovo disponibile: BLUE torna "terra" (per una eventuale ondata 2), RED torna "terra"/"prontezza"
    f.stato_post = f.piano && f.piano.alert ? "prontezza" : "terra";
    this._riarmo = this._riarmo || []; this._riarmo.push(f);
  }
  /* ----- navigazione ----- */
  versoWp(f, dt, onArrivo) {
    const w = this.wp(f); if (!w) { this.vaiRtb(f, "fine rotta"); return; }
    const tipo = this.tipo(f);
    const tasT = (f.stato === "verso_target" || f.stato === "intercetta") ? tipo.tas_attacco_kt : tipo.tas_crociera_kt;
    const s = PHYS.step(f, w, tipo, dt, { vento: this.vento, tasTarget: tasT, bank: tipo.bank_nav, regime: "crociera" });
    Object.assign(f, s);
    const raggio = Math.max(1.5, PHYS.turnRadiusNm(f.tas, tipo.bank_nav));
    if (GEO.dist(f, w) <= raggio) onArrivo();
  }
  volaCerchio(f, dt, regime) { // racetrack standard: due gambe di ~8 NM orientate verso la minaccia (est per BLUE, ovest per RED), virate di 180°
    const tipo = this.tipo(f); if (!f.orbita) f.orbita = { c: { lat: f.lat, lon: f.lon }, k: 0, asse: f.lato === "BLUE" ? 90 : 270 };
    const r = Math.max(2.5, PHYS.turnRadiusNm(tipo.tas_crociera_kt, tipo.bank_nav) * 1.2), L = 4; // semi-gamba 4 NM, larghezza = 2 raggi di virata
    const quad = [[0, L], [90, r * 2], [180, L], [270, r * 2]]; // sequenza: avanti, traverso, indietro, traverso (racetrack)
    const kk = f.orbita.k % 4; const base = kk === 0 ? GEO.dest(f.orbita.c, f.orbita.asse, L) : kk === 1 ? GEO.dest(GEO.dest(f.orbita.c, f.orbita.asse, L), f.orbita.asse + 90, r * 2) : kk === 2 ? GEO.dest(GEO.dest(f.orbita.c, f.orbita.asse + 180, L), f.orbita.asse + 90, r * 2) : GEO.dest(f.orbita.c, f.orbita.asse + 180, L);
    const pt = base;
    const s = PHYS.step(f, { ...pt, alt: f.alt }, tipo, dt, { vento: this.vento, tasTarget: regime === "aar" ? 300 : tipo.tas_crociera_kt * 0.85, bank: tipo.bank_nav, regime, alt: f.alt });
    Object.assign(f, s); f.regime = regime;
    if (GEO.dist(f, pt) < 2) f.orbita.k++;
  }
  liberaTanker(f) {   // la formazione lascia ogni coda e, se stava rifornendo, libera il tanker
    this.liberaPrenotazione(f);
    this.tanker.forEach(tk => { if (tk.coda.includes(f.id)) tk.coda = tk.coda.filter(x => x !== f.id); if (tk.occupato_da === f.id) tk.occupato_da = null; }); f._minFuel = false;
  }
  avanza(f) {
    this.liberaTanker(f); f.orbita = null; f.wp_i++;
    const w = this.wp(f); if (!w) { this.vaiRtb(f, "fine rotta"); return; }
    const map = { aar: ["verso_aar", "Verso il tanker"], push: ["ingresso", "Ingress"], attacco: ["verso_target", "Verso il target"], cap: ["verso_cap", "Verso la CAP"], egress: ["egress", "Egress"], atterraggio: ["rtb", "RTB"] };
    const m = map[w.azione] || ["ingresso", "In rotta"]; f.stato = m[0]; f.fase = m[1];
    if (w.azione === "attacco") { const prec = f.wps[f.wp_i - 1]; if (prec && prec.azione === "attacco") { f.fase = "Verso il 2º target"; this.evento(f.callsign, `RETARGET – verso il 2º target ${w.nome} (${this.gbuPerAttacco(f, w) * f.n} GBU-48)`, "blue"); } else this.evento(f.callsign, `FENCE IN – verso il target ${w.nome}`, "blue"); }
  }
  vaiRtb(f, motivo) {
    if (f.stato === "rtb" || f.stato === "rtb_aar") return;
    this.liberaTanker(f); f.orbita = null; f.rtb_motivo = motivo; f.ingaggio_commit = null; f.target_commit = null;
    const b = this.base(f.base);
    // BLUE: se un tanker è più vicino della base e ha senso, passa prima dal tanker (post-strike AAR)
    let viaTanker = null;
    if (f.lato === "BLUE" && motivo !== "WINCHESTER" ) {
      const tk = this.tanker.filter(t => this.tankerDisponibile(t)).sort((a, b2) => GEO.dist(f, a) - GEO.dist(f, b2))[0];
      if (tk && GEO.dist(f, tk) + 20 < GEO.dist(f, b)) viaTanker = tk;
    }
    f.wps = viaTanker ? [{ lat: viaTanker.lat, lon: viaTanker.lon, alt: viaTanker.quota_ft, nome: viaTanker.nome, azione: "aar", tanker: viaTanker.id, rtb: true }, { lat: b.lat, lon: b.lon, alt: 0, nome: b.nome, azione: "atterraggio" }]
                     : [{ lat: b.lat, lon: b.lon, alt: 0, nome: b.nome, azione: "atterraggio" }];
    f.wp_i = 0; f.stato = viaTanker ? "rtb_aar" : "rtb"; f.fase = `RTB (${motivo})`;
    this.evento(f.callsign, `${motivo} → RTB ${viaTanker ? "via " + viaTanker.nome : b.nome}`, motivo === "BINGO" ? "avviso" : f.lato.toLowerCase());
  }

  /* ----- AAR ----- */
  arrivoAar(f) {
    const w = this.wp(f); const tk = this.find(this.tanker, w.tanker);
    if (!tk || !this.tankerDisponibile(tk)) { const alt = this.tanker.find(t => this.tankerDisponibile(t)); if (alt) { w.tanker = alt.id; w.lat = alt.lat; w.lon = alt.lon; w.nome = alt.nome; return; } this.vaiRtb(f, "nessun tanker"); return; }
    f.stato = "attesa_aar"; f.fase = `In coda per ${tk.nome}`; f.orbita = null;
    if (!tk.coda.includes(f.id)) { tk.coda.push(f.id); tk.coda.sort((a, b) => (this.ordineAar(a)) - (this.ordineAar(b))); }
    this.evento(f.callsign, `Al tanker ${tk.nome} – in coda (ordine AAR ${this.ordineAar(f.id)})`, "blue");
    this.provaAar(f);
  }
  etaAar(x, tk) {   // quando la formazione x sarà al tanker tk (secondi di simulazione)
    if (x.stato === "aar" || x.stato === "attesa_aar") return this.t;
    const tipo = this.tipo(x); if (x.stato === "verso_aar") return this.t + PHYS.eta(x, tk, tipo.tas_crociera_kt, this.vento).min * 60;
    if (x.stato === "terra" && x.sortie === 0 && x.t_decollo_pianificato != null) { const b = this.base(x.base); return Math.max(this.t, x.t_decollo_pianificato) + (b ? PHYS.eta(b, tk, tipo.tas_crociera_kt, this.vento).min * 60 : 0); }
    return Infinity;
  }
  precedenteAar(f, tk) {
    const ord = this.ordineAar(f.id);
    return this.flights.filter(x => x !== f && x.lato === "BLUE" && !x.distrutto && x.n > 0 && x.piano && !x.aar_fatto && this.ordineAar(x.id) < ord && (x.sortie > 0 ? x.tanker_id : (x.piano.tanker || (this.tanker[0] || {}).id)) === tk.id && this.etaAar(x, tk) <= this.t + 1200)
      .sort((a, b) => this.ordineAar(a.id) - this.ordineAar(b.id))[0] || null;
  }
  ordineAar(id) { const fl = this.flights.find(x => x.id === id); return (fl && fl.piano && fl.piano.aar_ordine) || 99; }
  provaAar(f) {
    const w = this.wp(f); const tk = this.find(this.tanker, w.tanker); if (!tk) return;
    // MINIMUM FUEL: il KC-30 rifornisce in emergenza anche con il pod alare, senza aspettare chi è già al boom
    const emergenza = f._minFuel || f.autonomia <= 10;
    if (tk.occupato_da && tk.occupato_da !== f.id && !emergenza) return;
    // ordine AAR del piano: si cede il turno a una formazione con ordine più basso se arriva entro 20 minuti
    if (!emergenza) { const prima = this.precedenteAar(f, tk); if (prima) { if (f._cedeA !== prima.id) { f._cedeA = prima.id; f.fase = `In coda: cede il turno a ${prima.callsign} (ordine AAR ${this.ordineAar(prima.id)})`; this.evento(f.callsign, `Al tanker ${tk.nome}: cede il turno a ${prima.callsign} (ordine AAR ${this.ordineAar(prima.id)} contro ${this.ordineAar(f.id)})`, "blue"); } return; } }
    f._cedeA = null;
    if (tk.coda[0] !== f.id && tk.coda.includes(f.id) && !emergenza) return;
    if (emergenza && tk.occupato_da && tk.occupato_da !== f.id) { this.evento(f.callsign, `MINIMUM FUEL – rifornimento d'emergenza dal pod alare di ${tk.nome}`, "avviso"); f._podAlare = true; }
    else tk.occupato_da = f.id;
    tk.coda = tk.coda.filter(x => x !== f.id);
    const durata = this.sc.regole.aar_minuti_per_formazione + (this.injectAttivo("temporale") ? 5 : 0);
    f.stato = "aar"; f.fase = `AAR in corso (${durata} min)`; f.aar_fine = this.t + durata * 60; f.aar_inizio = this.t; f.aar_aut0 = Math.max(0, f.autonomia);
    this.evento(f.callsign, `Rifornimento in volo iniziato con ${tk.nome} (${durata} min)`, "blue");
  }
  fineAar(f) {
    const w = this.wp(f); const tk = this.find(this.tanker, w.tanker); if (tk && tk.occupato_da === f.id) tk.occupato_da = null; f._podAlare = false;
    this.pieno(f); f.aar_fatto = true;
    this.evento(f.callsign, `AAR completato – autonomia ${f.autonomia_max} min. ${w.rtb ? "Prosegue RTB" : "PUSH verso " + (f.wps[f.wp_i + 1] || {}).nome}`, "blue");
    this.avanza(f);
  }
  /* ----- gate / push ----- */
  arrivoGate(f) {
    const w = this.wp(f);
    if (w.push && this.t < w.push) { f.stato = "attesa_push"; f.fase = `Holding al ${w.nome} fino alle ${Engine.s2hm(w.push)}`; f.hold_until = w.push; f.orbita = null; this.evento(f.callsign, `Holding al ${w.nome} – push alle ${Engine.s2hm(w.push)}`, "blue"); return; }
    this.evento(f.callsign, `PUSH – ingresso in territorio nemico (${w.nome})`, "blue"); this.avanza(f);
  }
  /* ----- attacco ----- */
  inFinestra(t) { if (!t || !t.finestra) return true; return this.t >= Engine.hm2s(t.finestra.da) && this.t <= Engine.hm2s(t.finestra.a); }
  arrivoTarget(f) {
    const w = this.wp(f); const tg = this.find(this.target, w.target);
    if (tg && tg.distrutto && tg.gruppo) { this.evento(f.callsign, `${tg.nome}: obiettivo già neutralizzato → egress`, "blue"); this.avanza(f); return; }
    if (tg && tg.finestra && !this.inFinestra(tg)) {
      const da = Engine.hm2s(tg.finestra.da);
      if (this.t < da && da - this.t <= 1800) { f.stato = "attesa_target"; f.hold_until = da; f.orbita = null; f.fase = `In attesa sul target fino alle ${tg.finestra.da}`; this.evento(f.callsign, `${tg.nome} non ancora localizzato: holding fino alle ${tg.finestra.da}`, "avviso"); return; }
      this.evento(f.callsign, `${tg.nome} non presente (finestra ${tg.finestra.da}–${tg.finestra.a}) → nessun attacco, egress`, "avviso"); this.avanza(f); return;
    }
    const disp = this.gbuTot(f);
    if (disp <= 0) { this.evento(f.callsign, `Sul target ${w.nome} ma senza bombe → egress`, "avviso"); this.avanza(f); return; }
    // si sganciano solo le GBU che servono: richieste − danni già fatti − bombe già in arrivo da altre formazioni sullo stesso target
    const tgx = tg || this.find(this.target, w.target); const serve = Math.max(0, tgx.gbu_richieste - tgx.danni - (tgx.prenotate || 0));
    if (serve <= 0) { this.evento(f.callsign, `${tgx.nome}: già coperto (${tgx.danni}/${tgx.gbu_richieste} GBU${tgx.prenotate ? `, ${tgx.prenotate} in arrivo` : ""}) → nessuno sgancio, ${disp} GBU conservate`, "blue"); this.avanza(f); return; }
    const gbu = Math.min(disp, serve); f.gbu_attacco = gbu; f.gbu_attacco_tgt = tgx.id; tgx.prenotate = (tgx.prenotate || 0) + gbu;
    f.stato = "attacco"; f.fase = `Sul target ${w.nome}`; f.attacco_fine = this.t + this.sc.regole.tempo_sul_target_min * 60; f.orbita = null;
    // JOKER: se il carburante non basta per tutto il tempo sul target e il rientro, un solo passaggio (1 minuto) e via
    if (this.sc.regole.bingo_auto_rtb) { const bingo = PHYS.bingoMinutes(f, this.rifugi(f), this.tipo(f).tas_crociera_kt, this.vento, 5); const serve = bingo + this.sc.regole.tempo_sul_target_min * 1.5;
      if (f.autonomia < serve) { f.attacco_fine = this.t + 60; f.fase = `Sul target ${w.nome} – passaggio unico (JOKER)`; this.evento(f.callsign, `JOKER – carburante al limite: passaggio unico su ${w.nome}`, "avviso"); } }
    const t = this.find(this.target, w.target); const danniDopo = t.danni + gbu;
    this.evento(f.callsign, `IN – attacco su ${w.nome} (${this.sc.regole.tempo_sul_target_min} min, ${gbu} GBU-48${gbu < disp ? ` di ${disp} a bordo: ne servono solo ${gbu}` : ""})`, "blue", { v3d: { flight: f.id, target: t.id, n: f.n, gbu, danni: danniDopo, richieste: t.gbu_richieste, distrutto: danniDopo >= t.gbu_richieste } });
  }
  /* GBU della formazione: si contano in totale (non per velivolo), così si sgancia esattamente il numero che serve */
  gbuTot(f) { const max = (f.armi.GBU48 || 0) * f.n; return f.gbu_tot == null ? max : Math.max(0, Math.min(f.gbu_tot, max)); }
  spendiGbu(f, k) { const tot = Math.max(0, this.gbuTot(f) - k); f.gbu_tot = tot; f.armi.GBU48 = f.n > 0 ? Math.ceil(tot / f.n) : 0; }
  liberaPrenotazione(f) { if (!f.gbu_attacco) return; const t = this.find(this.target, f.gbu_attacco_tgt); if (t) t.prenotate = Math.max(0, (t.prenotate || 0) - f.gbu_attacco); f.gbu_attacco = 0; f.gbu_attacco_tgt = null; }
  fineAttacco(f) {
    const w = this.wp(f); const t = this.find(this.target, w.target); const prenotate = f.gbu_attacco || 0; this.liberaPrenotazione(f);
    const gbu = Math.min(prenotate, this.gbuTot(f), Math.max(0, t.gbu_richieste - t.danni));   // velivoli persi durante l'attacco o target già completato: si sgancia di meno
    if (gbu <= 0) { this.evento(f.callsign, `${t.nome}: nessuno sgancio necessario → egress con ${this.gbuTot(f)} GBU`, "blue"); this.avanza(f); return; }
    t.danni += gbu; this.spendiGbu(f, gbu); f.bombe_sganciate = true; this.score.BLUE.gbu += gbu;
    if (t.gruppo) this.target.forEach(x => { if (x !== t && x.gruppo === t.gruppo) x.danni = Math.max(x.danni, t.danni); });   // stesso bersaglio in movimento: i danni restano
    const pct = Math.min(100, Math.round(t.danni / t.gbu_richieste * 100));
    const v3d = { flight: f.id, target: t.id, n: f.n, gbu, danni: t.danni, richieste: t.gbu_richieste, distrutto: t.danni >= t.gbu_richieste };
    if (!t.distrutto && t.danni >= t.gbu_richieste) { t.distrutto = true; t.t_distrutto = this.t; this.score.BLUE.target_distrutti++; this.evento(f.callsign, `SHACK! ${t.nome} DISTRUTTO (${t.danni}/${t.gbu_richieste} GBU)`, "kill", { v3d });
      if (t.gruppo) this.target.forEach(x => { if (x !== t && x.gruppo === t.gruppo && !x.distrutto) { x.distrutto = true; x.t_distrutto = this.t; x.fermato = true; } });
      if (t.sam) this.sopprimiSam(t.sam, t.nome); }
    else this.evento(f.callsign, `PICKLE – ${gbu} GBU-48 su ${t.nome}: danno ${pct}% (${t.danni}/${t.gbu_richieste})`, "blue", { v3d });
    const resto = this.gbuTot(f); this.evento(f.callsign, `OFF target – egress${resto ? ` (${resto} GBU ancora a bordo)` : ""}`, "blue"); this.avanza(f);
  }
  sopprimiSam(id, causa, testo) { const s = this.find(this.sam, id); if (!s || s.soppressa) return; s.soppressa = true; s.missili = 0; s.attivo = false; this.evento(s.nome, testo || `SAM SOPPRESSA – ${causa} distrutto: la batteria non può più guidare missili`, "kill"); }
  /* ----- SEAD: i Growler lanciano AGM-88 HARM sulle batterie SA-10 che emettono, quando sono entro la gittata -----
     Valori (regole, modificabili): harm_nm 50 NM (gittata utile da quota; massima ~80 NM, oltre l'anello SA-10 di 40 NM),
     harm_per_sam 2 (salvo di 2 missili per batteria), velocità media ~1.150 kt (Mach 2): da 50 NM l'impatto arriva in ~2,5 min.
     Un HARM per bersaglio: nessun salvo su una batteria già colpita o con missili già in volo. */
  harmDisp(f) { return Math.max(0, (f.armi.HARM || 0) * f.n - (f.harm_spesi || 0)); }
  aggiornaSead() {
    const r = this.sc.regole; if (r.harm_auto === false) return;
    const nm = r.harm_nm != null ? r.harm_nm : 50, salvo = r.harm_per_sam || 2, kt = r.harm_kt || 1150;
    this.harm = (this.harm || []).filter(h => {
      if (this.t < h.t_impatto) return true;
      const s = this.find(this.sam, h.sam);
      if (s && !s.soppressa) {
        if (s.attivo) { this.score.BLUE.sam_soppresse = (this.score.BLUE.sam_soppresse || 0) + 1; this.sopprimiSam(s.id, "HARM", `SAM SOPPRESSA – ${h.n} AGM-88 HARM di ${h.da} sul radar: la batteria non può più guidare missili`); }
        else this.evento(s.nome, `HARM di ${h.da} a vuoto: la batteria aveva il radar spento`, "red");
      }
      return false;
    });
    this.flights.forEach(f => {
      if (f.lato !== "BLUE" || f.distrutto || f.alt <= 50 || f.n <= 0 || !(this.tipo(f).armi || {}).HARM) return;
      if (this.harmDisp(f) <= 0 || (f.ultimo_harm && this.t - f.ultimo_harm < 30)) return;
      const s = this.sam.filter(x => x.attivo && !x.soppressa && x.missili > 0 && !this.harm.some(h => h.sam === x.id) && GEO.dist(f, x) <= nm).sort((a, b) => GEO.dist(f, a) - GEO.dist(f, b))[0];
      if (!s) return;
      const n = Math.min(salvo, this.harmDisp(f)), d = GEO.dist(f, s), tof = d / kt * 3600;
      f.harm_spesi = (f.harm_spesi || 0) + n; f.ultimo_harm = this.t; this.score.BLUE.harm = (this.score.BLUE.harm || 0) + n;
      this.harm.push({ sam: s.id, da: f.callsign, n, t_impatto: this.t + tof });
      this.evento(f.callsign, `MAGNUM – ${n} AGM-88 HARM su ${s.nome} da ${d.toFixed(0)} NM (impatto tra ${Math.max(1, Math.round(tof / 60))} min, restano ${this.harmDisp(f)} HARM)`, "blue");
    });
  }
  /* ----- obiettivi di missione (scenario.obiettivi): valutati in diretta e nel debrief ----- */
  valutaObiettivi() {
    const fine = this.finita; const fl = this.flights;
    return (this.sc.obiettivi || []).map((o, i) => {
      let ok = false, fallito = false, prog = "";
      if (o.tipo === "distruggi") { const ts = (o.target || []).map(id => this.find(this.target, id)).filter(Boolean); const entro = o.entro ? Engine.hm2s(o.entro) : Infinity; const gruppi = new Set(); let n = 0;
        ts.forEach(t => { if (!t.distrutto || t.t_distrutto > entro) return; if (t.gruppo) { if (gruppi.has(t.gruppo)) return; gruppi.add(t.gruppo); } n++; });
        const min = o.minimo != null ? o.minimo : ts.length; ok = n >= min; prog = `${n}/${min}`; if (!ok && (fine || this.t > entro)) fallito = true; }
      else if (o.tipo === "abbattimenti") { const n = this.score.BLUE.kills; ok = n >= o.minimo; prog = `${n}/${o.minimo}`; if (!ok && fine) fallito = true; }
      else if (o.tipo === "perdite_max") { const n = this.score.BLUE.perdite; ok = n <= o.massimo; fallito = !ok; prog = `${n} (max ${o.massimo})`; }
      else if (o.tipo === "sopprimi_sam") { const ss = (o.sam || []).map(id => this.find(this.sam, id)).filter(Boolean); const n = ss.filter(s => s.soppressa || s.missili <= 0).length; const min = o.minimo != null ? o.minimo : ss.length; ok = n >= min; prog = `${n}/${min}`; if (!ok && fine) fallito = true; }
      else if (o.tipo === "proteggi") { const fs = (o.formazioni || []).map(id => fl.find(x => x.id === id)).filter(Boolean); const persi = fs.reduce((s, x) => s + (x.n_iniziale - Math.max(0, x.n)), 0); const max = o.perdite_max || 0; ok = persi <= max; fallito = !ok; prog = `perdite ${persi} (max ${max})`; }
      return { n: i + 1, testo: o.testo, tipo: o.tipo, primario: o.primario !== false, ok, fallito, prog, stato: ok ? (fine || ["distruggi", "abbattimenti", "sopprimi_sam"].includes(o.tipo) ? "RAGGIUNTO" : "IN CORSO ✓") : fallito ? "FALLITO" : "IN CORSO" };
    });
  }
  esitoMissione() {
    const ob = this.valutaObiettivi(); if (!ob.length) return null; const prim = ob.filter(o => o.primario), sec = ob.filter(o => !o.primario);
    if (prim.every(o => o.ok)) return "MISSION SUCCESS";
    if (prim.some(o => o.ok) || sec.some(o => o.ok && o.tipo !== "perdite_max" && o.tipo !== "proteggi")) return "PARTIAL SUCCESS";
    return "MISSION FAILED";
  }

  /* ----- CAP ----- */
  arrivoCap(f) {
    const w = this.wp(f); f.stato = "cap"; f.fase = `In CAP ${w.nome}`; f.cap_box = w.cap; f.orbita = null;
    f.cap_fine = w.fine || (w.durata_min ? this.t + w.durata_min * 60 : null);
    if (f.lato === "RED") f.cap_fine = Math.min(f.cap_fine || Infinity, f.t_decollo + this.sc.regole.cap_max_min * 60);
    this.evento(f.callsign, `ON STATION ${w.nome}${f.cap_fine ? " fino alle " + Engine.s2hm(f.cap_fine) : ""}`, f.lato.toLowerCase());
  }

  /* ---------- RILEVAMENTO (fog of war) ---------- */
  rilevati(lato) { // ritorna le formazioni nemiche rilevate dal lato
    const nem = this.flights.filter(f => f.lato !== lato && !f.distrutto && f.alt > 50);
    if (!this.sc.regole.fog_of_war) return nem;
    return nem.filter(e => this.rilevato(lato, e));
  }
  rilevato(lato, e) {
    const st = this.tipo(e).stealth || 1;
    if (lato === "BLUE") {
      if (this.e7.some(x => x.attivo && GEO.dist(x, e) <= this.sc.tipi.E7.radar_nm * st)) return true;
      return this.flights.some(f => f.lato === "BLUE" && !f.distrutto && f.alt > 50 && this.tipo(f).radar_nm > 0 && GEO.dist(f, e) <= this.tipo(f).radar_nm * st);
    } else {
      if (this.sam.some(s => s.attivo && GEO.dist(s, e) <= this.sc.tipi.SA10.radar_nm * st)) return true;
      if (this.sc.basi.some(b => b.lato === "RED" && GEO.dist(b, e) <= 100 * st)) return true; // radar EW di base
      return this.flights.some(f => f.lato === "RED" && !f.distrutto && f.alt > 50 && GEO.dist(f, e) <= this.tipo(f).radar_nm * st);
    }
  }

  /* ---------- COMMIT / INTERCETTAZIONE ---------- */
  valutaCommit(f) {
    const tipo = this.tipo(f); if (!(tipo.missili_nm > 0) || this.missili(f) <= 0) return;
    const nem = this.rilevati(f.lato).filter(e => !e.ingaggio && (f.cooldown[e.id] || 0) < this.t);
    if (!nem.length) return;
    const near = nem.map(e => ({ e, d: GEO.dist(f, e) })).sort((a, b) => a.d - b.d)[0];
    const aggressivo = f.lato === "RED" || ["SWEEP/ESCORT", "SWEEP", "ESCORT", "CAP"].includes(f.ruolo) || (f.piano && f.piano.cap);
    const limite = f.lato === "RED" ? this.commit_nm : aggressivo ? (this.sc.regole.commit_nm_blue || 40) : 15; // strike: solo autodifesa ravvicinata
    if (near.d <= limite && f.stato !== "intercetta") {
      f.pre_commit = { stato: f.stato, fase: f.fase }; f.stato = "intercetta"; f.fase = `COMMIT su ${near.e.callsign}`; f.target_commit = near.e.id; f.orbita = null;
      this.evento(f.callsign, `COMMIT – ${near.e.n}x ${this.tipo(near.e).nome} ${GEO.fmtBE(this.sc.mappa.bullseye, near.e)}, ${Math.round(near.d)} NM`, f.lato.toLowerCase());
    }
  }
  missili(f) { const a = f.armi; return (a.AMRAAM || 0) + (a.ADDER || 0); }
  dentroMez(p, f) { const st = (f && this.tipo(f).stealth) || 1; return this.sam.some(s => s.attivo && GEO.dist(s, p) <= s.raggio_nm * st); }
  copertoGrowler(f) { const g = this.sc.mappa.griglia, cop = this.sc.regole.growler_copertura_quadrati; return this.flights.some(gr => gr.lato === "BLUE" && gr.tipo === "EA18" && !gr.distrutto && gr.alt > 50 && GEO.gridDistanceSquares(gr, f, g) <= cop); }
  aggressivo(f) { return f.lato === "RED" || ["SWEEP/ESCORT", "SWEEP", "ESCORT", "CAP"].includes(f.ruolo) || !!(f.piano && f.piano.cap); }
  intercetta(f, dt) {
    const e = this.flights.find(x => x.id === f.target_commit);
    if (!e || e.distrutto || e.alt < 50 || !this.rilevato(f.lato, e) || (f.cooldown[e.id] || 0) > this.t) { this.fineIntercetta(f, "contatto perso"); return; }
    // non inseguire un nemico dentro un anello SAM attivo se non ho copertura Growler (tattica standard: "no-go" nelle MEZ)
    if (f.lato === "BLUE" && this.dentroMez(e, f) && !this.copertoGrowler(f)) { f.cooldown[e.id] = this.t + 300; this.fineIntercetta(f, "bersaglio dentro la MEZ SA-10, abort"); return; }
    // punto di intercettazione: insegui la posizione attuale (pursuit) con bank tattico
    const tipo = this.tipo(f);
    const s = PHYS.step(f, { lat: e.lat, lon: e.lon, alt: e.alt }, tipo, dt, { vento: this.vento, tasTarget: tipo.tas_attacco_kt, bank: tipo.bank_tatt, regime: "attacco" });
    Object.assign(f, s); f.regime = "attacco";
    if (GEO.dist(f, e) > this.commit_nm + 40) this.fineIntercetta(f, "fuori portata");
  }
  fineIntercetta(f, motivo) {
    f.target_commit = null;
    if (f.lato === "RED") {
      // torna alla CAP (se ne ha una) altrimenti CAP box più vicina, poi RTB a fine autonomia
      const w = f.wps[0];
      if (w && w.azione === "cap") { f.stato = "verso_cap"; f.fase = "Ritorno in CAP"; f.wp_i = 0; }
      else { const box = this.sc.cap_box.filter(c => c.lato === "RED").sort((a, b) => GEO.dist(f, a) - GEO.dist(f, b))[0]; f.wps = [{ lat: box.lat, lon: box.lon, alt: this.tipo(f).quota_ft, nome: box.nome, azione: "cap", cap: box.id, fine: f.t_decollo + this.sc.regole.cap_max_min * 60 }]; f.wp_i = 0; f.stato = "verso_cap"; f.fase = "Verso CAP"; }
    } else if (f.pre_commit) { f.stato = f.pre_commit.stato === "intercetta" ? "ingresso" : f.pre_commit.stato; f.fase = f.pre_commit.fase; if (f.stato === "cap") f.orbita = null; }
    else { f.stato = "ingresso"; f.fase = "In rotta"; }
    this.evento(f.callsign, `Fine intercettazione (${motivo}) → ${f.fase}`, f.lato.toLowerCase());
  }

  /* ---------- INGAGGI ARIA-ARIA ---------- */
  aggiornaIngaggi(dt) {
    const air = this.flights.filter(f => !f.distrutto && f.alt > 50 && !f.ingaggio);
    const blues = air.filter(f => f.lato === "BLUE"), reds = air.filter(f => f.lato === "RED");
    blues.forEach(b => reds.forEach(r => {
      if (b.ingaggio || r.ingaggio) return;
      if ((b.cooldown[r.id] || 0) > this.t) return;
      const d = GEO.dist(b, r);
      const tb = this.tipo(b), tr = this.tipo(r);
      // chi può APRIRE l'ingaggio: ha missili, il nemico è rilevato ed è entro la portata (ridotta dallo stealth del bersaglio)
      const bApre = this.missili(b) > 0 && tb.missili_nm > 0 && d <= tb.missili_nm * (tr.stealth || 1) && this.rilevato("BLUE", r) && (b.stato === "intercetta" || b.stato === "cap" || d <= 15);
      const rApre = this.missili(r) > 0 && tr.missili_nm > 0 && d <= tr.missili_nm * (tb.stealth || 1) && this.rilevato("RED", b);
      // una volta al merge, entrambi sparano se hanno missili: il vantaggio tecnologico è già nel kill ratio
      if (bApre || rApre) this.iniziaIngaggio(b, r, this.missili(b) > 0 && tb.missili_nm > 0, this.missili(r) > 0 && tr.missili_nm > 0);
    }));
    // conclusione ingaggi
    this.ingaggi.filter(i => !i.chiuso && this.t >= i.fine).forEach(i => this.risolviIngaggio(i));
  }
  iniziaIngaggio(b, r, bPuo, rPuo) {
    // MUTUAL SUPPORT: se il RED attacca una formazione BLUE non da caccia (strike/EA) e una scorta armata è entro 25 NM, è la scorta a prendere il merge
    if (!this.aggressivo(b)) {
      const scorta = this.flights.filter(e => e.lato === "BLUE" && e !== b && !e.distrutto && !e.ingaggio && e.alt > 50 && this.aggressivo(e) && this.missili(e) > 0 && (e.cooldown[r.id] || 0) < this.t && GEO.dist(e, b) <= 25).sort((x, y) => GEO.dist(x, b) - GEO.dist(y, b))[0];
      if (scorta) { this.evento(scorta.callsign, `ESCORT – interviene a difesa di ${b.callsign} contro ${r.callsign}`, "blue"); b = scorta; bPuo = true; if (b.stato !== "intercetta") { b.pre_commit = { stato: b.stato, fase: b.fase }; } b.stato = "intercetta"; b.target_commit = r.id; b.orbita = null; }
    }
    const ing = { id: this.ingaggi.length + 1, t: this.t, fine: this.t + this.sc.regole.durata_ingaggio_min * 60, blue: b.id, red: r.id, bPuo, rPuo, chiuso: false, lat: (b.lat + r.lat) / 2, lon: (b.lon + r.lon) / 2 };
    this.ingaggi.push(ing); b.ingaggio = ing.id; r.ingaggio = ing.id; b.orbita = null; r.orbita = null;
    const be = GEO.fmtBE(this.sc.mappa.bullseye, ing);
    this.evento(b.callsign, `MERGED con ${r.callsign} (${r.n}x ${this.tipo(r).nome}) ${be} – ${bPuo ? "FOX 3!" : "DEFENSIVE"}`, "ingaggio", { ingaggio: ing.id });
    this.evento(r.callsign, `Ingaggio con ${b.callsign} (${b.n}x ${this.tipo(b).nome}) – ${rPuo ? "lancio ADDER" : "difensivo"}`, "ingaggio", { ingaggio: ing.id });
  }
  kr(att, def) {
    const r = this.sc.regole; const base = (this.sc.kill_ratio[att.tipo] || {})[def.tipo] || 0;
    const half = (this.sc.kill_ratio_con_bombe[att.tipo] || {})[def.tipo];
    const dimezza = r.kr_dimezzato === "mai" ? false : r.kr_dimezzato === "sempre_se_armati_bombe" ? ((this.tipo(att).armi.GBU48 || 0) > 0) : att.bombe_sganciate;
    return dimezza ? (half != null ? half : base / 2) : base;
  }
  risolviIngaggio(i) {
    i.chiuso = true; const b = this.flights.find(f => f.id === i.blue), r = this.flights.find(f => f.id === i.red);
    const nB = b.n, nR = r.n; const krB = i.bPuo ? this.kr(b, r) : 0, krR = i.rPuo ? this.kr(r, b) : 0;
    const scala = this.sc.regole.kr_scala != null ? this.sc.regole.kr_scala : 1;
    const attesoB = nB * krB, attesoR = nR * krR;   // valori "stile Excel" (n × KR)
    const killB = Math.min(nR, this.roundKill(attesoB * scala)), killR = Math.min(nB, this.roundKill(attesoR * scala)); // perdite effettive (× letalità)
    const perM = this.sc.regole.missili_per_ingaggio || 2;
    if (i.bPuo) { if (b.armi.AMRAAM != null) b.armi.AMRAAM = Math.max(0, b.armi.AMRAAM - perM); }
    if (i.rPuo) { if (r.armi.ADDER != null) r.armi.ADDER = Math.max(0, r.armi.ADDER - perM); }
    i.risultato = { nB, nR, krB, krR, attesoB, attesoR, killB, killR, netto: attesoB - attesoR, bombe: b.bombe_sganciate };
    this.score.BLUE.netto_excel += attesoB - attesoR; this.score.RED.netto_excel += attesoR - attesoB;
    this.evento("INGAGGIO", `${b.callsign} (${nB}x${b.tipo}, KR ${krB}${b.bombe_sganciate ? " dimezzato" : ""}) vs ${r.callsign} (${nR}x${r.tipo}, KR ${krR}): atteso ${attesoB.toFixed(2)} – ${attesoR.toFixed(2)} → netto ${(attesoB - attesoR).toFixed(2)} (stile Excel)`, "ingaggio", { ingaggio: i.id });
    if (killB > 0) { this.evento(b.callsign, `SPLASH ${killB}x ${this.tipo(r).nome} (${r.callsign})`, "kill"); this.perdita(r, killB, `abbattuti da ${b.callsign}`); }
    if (killR > 0) { this.evento(r.callsign, `SPLASH ${killR}x ${this.tipo(b).nome} (${b.callsign})`, "kill"); this.perdita(b, killR, `abbattuti da ${r.callsign}`); }
    if (killB === 0 && killR === 0) this.evento("INGAGGIO", `Nessun abbattimento – disingaggio`, "ingaggio");
    b.ingaggio = null; r.ingaggio = null; b.cooldown[r.id] = this.t + 600; r.cooldown[b.id] = this.t + 600;
    [b, r].forEach(f => {
      if (f.distrutto) return;
      if (this.missili(f) <= 0 && this.tipo(f).missili_nm > 0) { this.evento(f.callsign, `WINCHESTER (missili esauriti)`, "avviso"); if (f.lato === "RED" || (f.armi.GBU48 || 0) === 0) this.vaiRtb(f, "WINCHESTER"); }
      if (f.stato === "intercetta") this.fineIntercetta(f, "ingaggio concluso");
    });
  }
  perdita(f, n, motivo) {
    n = Math.min(n, f.n); if (n <= 0) return; f.n -= n;
    if (f.gbu_tot != null) f.gbu_tot = Math.round(f.gbu_tot * f.n / (f.n + n));   // le GBU dei velivoli persi si perdono con loro
    const lato = f.lato; this.score[lato].perdite += n; if (!/FLAMEOUT/.test(motivo)) this.score[lato === "BLUE" ? "RED" : "BLUE"].kills += n;   // il carburante finito non è un abbattimento dell'avversario
    if (f.n <= 0) { this.liberaTanker(f); f.distrutto = true; f.stato = "distrutto"; f.fase = "Distrutta"; f.ingaggio = null; this.ingaggi.filter(i => !i.chiuso && (i.blue === f.id || i.red === f.id)).forEach(i => { i.chiuso = true; const o = this.flights.find(x => x.id === (i.blue === f.id ? i.red : i.blue)); if (o) o.ingaggio = null; });
      this.evento(f.callsign, `Formazione persa: ${motivo}`, "kill"); }
    else this.evento(f.callsign, `-${n} velivoli (${motivo}) – restano ${f.n}`, "kill");
  }

  /* ---------- SAM ---------- */
  aggiornaSamIngaggi() {
    const g = this.sc.mappa.griglia; const cop = this.sc.regole.growler_copertura_quadrati;
    const growlers = this.flights.filter(f => f.lato === "BLUE" && f.tipo === "EA18" && !f.distrutto && f.alt > 50);
    this.flights.filter(f => f.lato === "BLUE" && !f.distrutto && f.alt > 50).forEach(f => {
      const st = this.tipo(f).stealth || 1;
      this.sam.forEach(s => {
        if (!s.attivo || s.missili <= 0) return;
        if (GEO.dist(s, f) > s.raggio_nm * st) return;
        if (this.t - f.ultimo_sam < 120) return;
        const coperto = growlers.some(gr => GEO.gridDistanceSquares(gr, f, g) <= cop);
        if (coperto) { if (!f._magnum || this.t - f._magnum > 600) { f._magnum = this.t; this.evento(f.callsign, `Dentro il ring ${s.nome} – coperto dal Growler (MAGNUM, jamming attivo)`, "blue"); } return; }
        // lancio: regola → intera formazione persa; limitato dai missili disponibili
        const perA = this.sc.regole.sam_missili_per_aereo; const possibili = Math.floor(s.missili / perA); const kill = Math.min(f.n, possibili);
        if (kill <= 0) { s.attivo = false; return; }
        f.ultimo_sam = this.t; s.ultimo_lancio = this.t; s.missili -= kill * perA; this.score.RED.missili_sam += kill * perA;
        this.evento(s.nome, `SAM LAUNCH su ${f.callsign} (${GEO.fmtBE(this.sc.mappa.bullseye, f)}) – nessuna copertura Growler: ${kill * perA} S-300 lanciati`, "kill");
        this.perdita(f, kill, `abbattuti da ${s.nome}`);
        if (s.missili < perA) { s.attivo = false; this.evento(s.nome, `Missili esauriti`, "red"); }
      });
    });
    // riarmo post turnaround
    if (this._riarmo && this._riarmo.length) { this._riarmo = this._riarmo.filter(f => { if (this.t >= f.disponibile_da) { f.stato = f.stato_post; f.fase = f.stato === "prontezza" ? "Prontezza al suolo" : "A terra (pronta)"; this.evento(f.callsign, `Turnaround completato: ${f.n} velivoli pronti`, f.lato.toLowerCase()); return false; } return true; }); }
  }

  /* ---------- COMANDI TRAINER ---------- */
  comando(id, cmd, arg) {
    const f = this.flights.find(x => x.id === id); if (!f) return;
    if (cmd === "rtb") { if (f.alt > 50 && !f.distrutto) this.vaiRtb(f, this._origineOrdine || "ordine del trainer"); return; }   // a terra l'RTB non ha senso: niente velivolo perso né turnaround
    if (cmd === "scramble") { if (f.stato === "terra" || f.stato === "prontezza") { f.scramble = true; f.stato = "prontezza"; this.prontezza(f); } }
    if (cmd === "cap" && arg) { const box = this.find(this.sc.cap_box, arg); if (box && f.alt > 50 && !f.distrutto) { this.liberaTanker(f); f.wps = [{ lat: box.lat, lon: box.lon, alt: this.tipo(f).quota_ft, nome: box.nome, azione: "cap", cap: box.id, fine: this.t + 60 * 60 }]; f.wp_i = 0; f.stato = "verso_cap"; f.fase = "Verso " + box.nome; f.orbita = null; this.evento(f.callsign, `Ordine: CAP su ${box.nome}`, "sistema"); } }
    if (cmd === "decolla_ora" && f.lato === "BLUE" && f.piano) { f.t_decollo_pianificato = this.t; }
    // target assign manuale: riassegna un obiettivo a una formazione BLUE in volo (target → gate di uscita → base)
    if (cmd === "target" && arg && f.lato === "BLUE" && f.alt > 50 && !f.distrutto) {
      const t = this.find(this.target, arg); if (!t) return;
      if (this.gbuTot(f) <= 0) { this.evento(f.callsign, `Ordine target ${t.nome} rifiutato: nessuna bomba a bordo`, "avviso"); return; }
      if (f.stato === "attacco") { this.evento(f.callsign, `Ordine target ${t.nome} rifiutato: già in attacco`, "avviso"); return; }
      const p = f.piano || {}, tipo = this.tipo(f), b = this.base(f.base); const gOut = this.find(this.sc.gate, p.gate_out) || this.find(this.sc.gate, p.gate_in) || this.sc.gate[1];
      f.wps = [{ lat: t.lat, lon: t.lon, alt: tipo.quota_ft - 10000, nome: t.nome, azione: "attacco", target: t.id }, { lat: gOut.lat, lon: gOut.lon, alt: tipo.quota_ft, nome: gOut.nome, azione: "egress" }, { lat: b.lat, lon: b.lon, alt: 0, nome: b.nome, azione: "atterraggio" }];
      this.liberaTanker(f); f.wp_i = 0; f.stato = "verso_target"; f.fase = "Verso il target " + t.nome; f.orbita = null; f.target_commit = null; f.pre_commit = null; f.hold_until = null; f.cap_fine = null;
      f.retask = t.id;   // il piano salvato resta quello del briefing: nel debrief si vede la differenza
      const serve = Math.max(0, t.gbu_richieste - t.danni - (t.prenotate || 0)), gb = this.gbuTot(f);
      this.evento(f.callsign, `Ordine: nuovo target ${t.nome} (${gb} GBU-48 a bordo, ne servono ${serve}${gb > serve ? `: ${gb - serve} restano a bordo` : gb < serve ? `: copertura parziale` : ""}) → egress ${gOut.nome}`, "sistema");
    }
  }
  muoviSam(id, lat, lon) { const s = this.find(this.sam, id); if (s) { s.dest = { lat, lon, da: this.t }; s._moving = false; } }

  /* ---------- VISTA (fog of war) per un lato ---------- */
  vista(lato) {
    if (lato === "TRAINER" || !this.sc.regole.fog_of_war) return { flights: this.flights, sam: this.sam };
    const flights = this.flights.filter(f => f.lato === lato || (!f.distrutto && f.alt > 50 && this.rilevato(lato, f)));
    let sam = this.sam;
    if (lato === "BLUE") { // posizione nota solo se un velivolo BLUE è entro 30 NM, altrimenti ultima nota
      sam = this.sam.map(s => { const vis = this.flights.some(f => f.lato === "BLUE" && !f.distrutto && f.alt > 50 && GEO.dist(f, s) < 30); if (vis) s.nota_blue = { lat: s.lat, lon: s.lon }; return { ...s, lat: s.nota_blue.lat, lon: s.nota_blue.lon, missili: vis ? s.missili : "?" }; });
    }
    return { flights, sam };
  }

  /* ---------- REPORT DEBRIEF ---------- */
  report() {
    const sc = this.sc; const fl = this.flights;
    const perLato = lato => fl.filter(f => f.lato === lato);
    return {
      durata: Engine.s2hm(this.t), score: this.score,
      target: this.target.map(t => ({ id: t.id, categoria: t.categoria, fermato: !!t.fermato, nome: t.nome, danni: t.danni, richieste: t.gbu_richieste, distrutto: t.distrutto, pct: Math.min(100, Math.round(t.danni / t.gbu_richieste * 100)) })),
      formazioni: fl.map(f => ({ callsign: f.callsign, lato: f.lato, tipo: f.tipo, iniziali: f.n_iniziale, rimasti: Math.max(0, f.n), sortite: f.sortie, stato: f.fase, bombe: f.bombe_sganciate, decollo: f.t_decollo ? Engine.s2hm(f.t_decollo) : "-", atterraggio: f.t_atterraggio ? Engine.s2hm(f.t_atterraggio) : "-" })),
      ingaggi: this.ingaggi.filter(i => i.risultato).map(i => ({ ora: Engine.s2hm(i.t), blue: fl.find(f => f.id === i.blue).callsign, red: fl.find(f => f.id === i.red).callsign, ...i.risultato })),
      sam: this.sam.map(s => ({ nome: s.nome, missili_rimasti: s.missili, soppressa: !!s.soppressa, spostata: GEO.dist(s, { lat: s.lat0, lon: s.lon0 }) > 0.5 })),
      obiettiviMissione: this.valutaObiettivi(), esitoMissione: this.esitoMissione(),
      eventi: this.eventi, blue: perLato("BLUE").length, red: perLato("RED").length
    };
  }
}
