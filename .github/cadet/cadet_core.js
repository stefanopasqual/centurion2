/* =====================================================================
   CENTURION CADET – nucleo della missione 01 "Il corridoio"
   Trasforma tre decisioni in linguaggio semplice in uno scenario e in un piano
   per il motore di simulazione esistente (Engine), che resta invariato.
   Usato sia dall'interfaccia Cadetto sia dalla simulazione delle alternative nel debrief.
   ===================================================================== */
const CADET_CORE = (() => {
  const clone = o => JSON.parse(JSON.stringify(o));
  const hm = s => Engine.s2hm(s), s = h => Engine.hm2s(h);

  // geografia della missione (Nord California, dentro il terreno 3D)
  const GEO_M = {
    gateDiretto: { id: "C_DIRETTO", nome: "Ingresso diretto", lat: 40.85, lon: -123.72 },
    gateEsterno: { id: "C_ESTERNO", nome: "Ingresso nord", lat: 41.62, lon: -123.25 },
    tanker: { id: "C_TANKER", nome: "Rifornimento in volo", lat: 41.20, lon: -124.30, quota_ft: 25000, orient: 0, lunghezza_nm: 20 },
    target: { id: "C_PONTE", nome: "Ponte di Whiskeytown", lat: 40.70, lon: -122.62 },
    sam: { id: "C_ZONA", nome: "Zona sorvegliata (SA-10)", lat: 40.80, lon: -123.37, raggio_nm: 10, missili: 10 },
    capPonte: { id: "C_CAP_PONTE", nome: "Pattuglia nemica sul ponte", lato: "RED", lat: 40.62, lon: -122.40, raggio_nm: 8 }
  };
  const SCADENZA = "10:30";
  const DECOLLO = "09:10";

  const SCELTE = {
    percorso: [
      { id: "diretto", lettera: "A", titolo: "Percorso diretto", breve: "Più veloce, maggior rischio", dettaglio: "La strada più corta: attraversa la zona sorvegliata dai missili terra-aria." },
      { id: "esterno", lettera: "B", titolo: "Percorso esterno", breve: "Più lungo, minore esposizione", dettaglio: "Si gira intorno alla zona sorvegliata passando da nord: circa 30 miglia in più." },
      { id: "divisi", lettera: "C", titolo: "Due gruppi separati", breve: "Più flessibilità, meno protezione reciproca", dettaglio: "Metà dei bombardieri passa dal diretto, metà dall'esterno: se un gruppo viene fermato, l'altro può arrivare." }
    ],
    protezione: [
      { id: "scorta", lettera: "A", titolo: "Due caccia di scorta", breve: "Difendono dagli aerei nemici", dettaglio: "Due F-22 volano davanti ai bombardieri e affrontano i caccia nemici. Non possono nulla contro i missili da terra." },
      { id: "disturbo", lettera: "B", titolo: "Un aereo disturbatore", breve: "Acceca i radar dei missili da terra", dettaglio: "Un EA-18G disturba i radar della zona sorvegliata: chi gli sta vicino può attraversarla. Non ferma gli aerei nemici." },
      { id: "entrambi", lettera: "C", titolo: "Scorta e disturbatore", breve: "Massima protezione, ma 30 minuti più tardi", dettaglio: "Il disturbatore è pronto solo fra mezz'ora: si parte tutti insieme alle 09:40 invece che alle 09:10." }
    ],
    forza: [
      { id: "tutti", lettera: "A", titolo: "Tutti e quattro i bombardieri", breve: "Più potenza, più aerei esposti", dettaglio: "Quattro F-15E: anche perdendone due restano bombe sufficienti." },
      { id: "riserva", lettera: "B", titolo: "Due ora, due di riserva", breve: "Si rischia meno, ma la riserva arriva tardi", dettaglio: "Partono due F-15E. Gli altri due aspettano alla base: decollano solo se il primo gruppo non riesce a interrompere il ponte, quindi arrivano almeno mezz'ora dopo." },
      { id: "pochi", lettera: "C", titolo: "Solo due bombardieri", breve: "Meno aerei a rischio, nessun margine", dettaglio: "Due F-15E portano esattamente le bombe che servono: basta perderne uno per non riuscire." }
    ]
  };
  // difesa RED (nascosta ai giocatori, rivelata nel debrief)
  const DIFESE = [
    { id: "presto", titolo: "Pattuglia del mattino", testo: "La difesa ha messo due caccia sopra il ponte dalle 09:00 alle 10:05, aspettandosi un attacco all'alba." },
    { id: "tardi", titolo: "Pattuglia di metà mattina", testo: "La difesa ha messo due caccia sopra il ponte dalle 10:00 in poi, pensando che avreste aspettato di essere tutti pronti." },
    { id: "allerta", titolo: "Caccia pronti a terra", testo: "La difesa ha tenuto due caccia a terra, pronti a decollare 15 minuti dopo avervi visti entrare." }
  ];
  const NOMI = { GLADIATOR: "Bombardieri (gruppo 1)", ROMA: "Bombardieri (gruppo 2)", RISERVA: "Bombardieri di riserva", TITAN: "Scorta", GROWLER: "Disturbatore", IVAN1: "Caccia nemici", IVAN2: "Caccia nemici (2)" };

  const F = (id, tipo, numero, base, ruolo, lato, callsign) => ({ id, callsign: callsign || id, lato, tipo, numero, base, ruolo });

  function scenario(scelte, difesa) {
    const sc = clone(SCENARIO_DEFAULT);
    sc.tempo = Object.assign(sc.tempo, { inizio: "09:00", fine: "11:45" });
    sc.regole = Object.assign(sc.regole, { aar_minuti_per_formazione: 5, commit_nm_blue: 10 });
    sc.aar = [clone(GEO_M.tanker), Object.assign(clone(GEO_M.tanker), { id: "C_TANKER2", nome: "Rifornimento in volo 2", lat: 41.05 })];
    sc.gate = [clone(GEO_M.gateDiretto), clone(GEO_M.gateEsterno)];
    sc.sam = [clone(GEO_M.sam)];
    sc.target = [Object.assign(clone(GEO_M.target), { gbu_richieste: 8, categoria: "ponte", descrizione: "Unico ponte su cui passeranno i rifornimenti nemici alle 10:30" })];
    sc.cap_box = [clone(GEO_M.capPonte)];
    sc.inject = []; sc.agenda = [];
    sc.obiettivi = [
      { tipo: "distruggi", target: ["C_PONTE"], entro: SCADENZA, primario: true, testo: `Interrompere il ponte entro le ${SCADENZA}` },
      { tipo: "perdite_max", massimo: 0, primario: false, testo: "Riportare tutti a casa" }];
    sc.meta = Object.assign(sc.meta || {}, { nome: "CADET 01 – Il corridoio", missione: "C01" });
    sc.missione = { id: "C01", codice: "IL CORRIDOIO", titolo: "Cadet 01 · Il corridoio", tipo: "Missione guidata", difficolta: 1, cadet: true };
    const p = piani(scelte, difesa, sc); sc.formazioni = p.formazioni; sc.piani = { BLUE: p.blue, RED: p.red };
    return sc;
  }

  function piani(scelte, difesa, sc) {
    const t0 = s(DECOLLO) + (scelte.protezione === "entrambi" ? 1800 : 0);
    const gate = id => id === "esterno" ? GEO_M.gateEsterno.id : GEO_M.gateDiretto.id;
    const formazioni = [], blue = { formazioni: {} };
    const push = s0 => hm(s0 + 25 * 60);
    // bombardieri
    const nTot = scelte.forza === "tutti" ? 4 : 2;
    if (scelte.percorso === "divisi") {
      const n1 = Math.ceil(nTot / 2), n2 = nTot - n1;
      formazioni.push(F("GLADIATOR", "F15", n1, "TACCOLA", "STRIKE", "BLUE"), F("ROMA", "F15", n2, "TACCOLA", "STRIKE", "BLUE"));
      blue.formazioni.GLADIATOR = { decollo: hm(t0), tanker: "C_TANKER", aar_ordine: 2, gate_in: gate("diretto"), push: push(t0), target: "C_PONTE", gate_out: gate("diretto") };
      blue.formazioni.ROMA = { decollo: hm(t0), tanker: "C_TANKER2", aar_ordine: 2, gate_in: gate("esterno"), push: push(t0), target: "C_PONTE", gate_out: gate("esterno") };
    } else {
      formazioni.push(F("GLADIATOR", "F15", nTot, "TACCOLA", "STRIKE", "BLUE"));
      blue.formazioni.GLADIATOR = { decollo: hm(t0), tanker: "C_TANKER", aar_ordine: 2, gate_in: gate(scelte.percorso), push: push(t0), target: "C_PONTE", gate_out: gate(scelte.percorso) };
    }
    if (scelte.forza === "riserva") {
      // orario di riserva lontano: la decisione vera la prende regolaRiserva appena si sa com'è andato il primo gruppo
      const tr = t0 + 120 * 60; const g = scelte.percorso === "divisi" ? "esterno" : scelte.percorso;
      formazioni.push(F("RISERVA", "F15", 2, "TACCOLA", "STRIKE", "BLUE", "CENTURION"));
      blue.formazioni.RISERVA = { decollo: hm(tr), tanker: "C_TANKER2", aar_ordine: 3, gate_in: gate(g), push: push(tr), target: "C_PONTE", gate_out: gate(g), riserva: true };
    }
    // protezione: parte 5 minuti prima ed entra 4 minuti prima dei bombardieri
    const ts = t0 - 300, pushP = hm(t0 + 21 * 60);
    if (scelte.protezione === "scorta" || scelte.protezione === "entrambi") {
      formazioni.push(F("TITAN", "F22", 2, "TACCOLA", "SWEEP/ESCORT", "BLUE"));
      // la scorta pattuglia sulla rotta dei bombardieri, a metà strada fra ingresso e ponte
      // la scorta entra dallo stesso ingresso dei bombardieri (con due gruppi: da nord) e li aspetta vicino al ponte
      const g = scelte.percorso === "diretto" ? GEO_M.gateDiretto : GEO_M.gateEsterno;
      const box = { lat: 40.80, lon: -122.78 };
      sc.cap_box.push({ id: "C_SCORTA", nome: "Scorta sulla rotta", lato: "BLUE", lat: +box.lat.toFixed(3), lon: +box.lon.toFixed(3), raggio_nm: 8 });
      blue.formazioni.TITAN = { decollo: hm(ts), tanker: "C_TANKER2", aar_ordine: 1, gate_in: g.id, push: pushP, cap: "C_SCORTA", cap_min: 30, gate_out: g.id };
    }
    if (scelte.protezione === "disturbo" || scelte.protezione === "entrambi") {
      formazioni.push(F("GROWLER", "EA18", 1, "TACCOLA", "SEAD/EA", "BLUE", "GRIZZLY"));
      // stazione davanti alla zona sorvegliata, sul percorso diretto: copre chi la attraversa
      blue.formazioni.GROWLER = { decollo: hm(ts), tanker: "C_TANKER", aar_ordine: 1, gate_in: gate("diretto"), push: pushP, stazione: { lat: 40.86, lon: -123.45 }, cap_min: 20, gate_out: gate("diretto") };
    }
    // RED: due Su-35 da Redding; la difesa nascosta decide QUANDO pattugliano il ponte
    formazioni.push(F("IVAN1", "SU35", 2, "REDDING", "DCA", "RED", "IVAN 1"));
    const red = { cap: [], prontezza: [], sam_moves: [], commit_nm: 10 };
    if (difesa === "presto") red.cap.push({ box: "C_CAP_PONTE", formazione: "IVAN1", da: "09:00", a: "10:05" });
    else if (difesa === "tardi") red.cap.push({ box: "C_CAP_PONTE", formazione: "IVAN1", da: "10:00", a: "11:45" });
    else red.prontezza.push("IVAN1");
    return { formazioni, blue, red };
  }

  // riserva: resta a terra se il ponte cade; decolla appena il primo gruppo non può più riuscirci
  // (abbattuto, senza bombe, oppure già in uscita con il ponte ancora in piedi)
  function regolaRiserva(eng) {
    const r = eng.flights.find(f => f.id === "RISERVA"); if (!r || !r.piano || r.sortie > 0 || r._decisa) return;
    const tg = eng.target[0]; if (!tg) return;
    if (tg.distrutto) { r._decisa = true; r.piano = null; r.t_decollo_pianificato = null; eng.evento("RISERVA", "Il ponte è interrotto: la riserva resta a terra", "blue"); return; }
    const primi = eng.flights.filter(f => f.lato === "BLUE" && f.id !== "RISERVA" && f.tipo === "F15");
    const finiti = primi.every(f => f.distrutto || f.n <= 0 || (f.sortie > 0 && (eng.gbuTot(f) <= 0 || ["egress", "rtb", "rtb_aar", "atterrato"].includes(f.stato))));
    if (!finiti) return;
    r._decisa = true; r.t_decollo_pianificato = eng.t; r.piano.decollo = hm(eng.t); r.piano.push = hm(eng.t + 25 * 60);
    eng.evento("RISERVA", "Il primo gruppo non ce l'ha fatta e il ponte è ancora in piedi: la riserva decolla", "blue");
  }

  // esito sintetico di una partita (per debrief e confronto alternative)
  function esito(eng) {
    const tg = eng.target[0]; const blue = eng.flights.filter(f => f.lato === "BLUE");
    const partiti = blue.filter(f => f.sortie > 0), persi = eng.score.BLUE.perdite;
    const esposti = partiti.reduce((a, f) => a + f.n_iniziale, 0);
    const inTempo = !!(tg.distrutto && tg.t_distrutto <= s(SCADENZA));
    const ev = eng.eventi;
    return {
      ponte: !!tg.distrutto, inTempo, ora: tg.t_distrutto ? Engine.s2hm(tg.t_distrutto) : null, danni: tg.danni, richieste: tg.gbu_richieste,
      persi, esposti, rientrati: esposti - persi, abbattutiNemici: eng.score.BLUE.kills,
      sam: ev.filter(e => /SAM LAUNCH/.test(e.testo)).length, duelli: eng.ingaggi.length,
      riserva: ev.some(e => e.chi === "RISERVA" && /riserva decolla/.test(e.testo)) ? "partita" : ev.some(e => e.chi === "RISERVA" && /resta a terra/.test(e.testo)) ? "a terra" : null,
      voto: (inTempo ? 2 : tg.distrutto ? 1 : 0) * 10 - persi
    };
  }

  // partita completa senza grafica (motore vero, deterministico)
  function simula(scelte, difesa) {
    const eng = new Engine(scenario(scelte, difesa)); let guard = 0;
    while (!eng.finita && guard++ < 5000) {
      regolaRiserva(eng); eng.tick();
      if (eng._avvisoFine) break;
    }
    return { eng, esito: esito(eng) };
  }

  return { GEO_M, SCELTE, DIFESE, NOMI, SCADENZA, DECOLLO, scenario, piani, regolaRiserva, esito, simula };
})();
