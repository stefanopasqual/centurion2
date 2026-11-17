/* =====================================================================
   CENTURION – A Fighter Pilot Day
   Scenario di default: "Operazione ROLLING THUNDER / ODYSSEY DAWN"
   Tutti i valori sono personalizzabili dall'Editor dati o dall'Excel
   (data/Centurion_Config.xlsx). Le coordinate sono REALI (Nord California,
   carta aeronautica "Mt Shasta Sectional").
   ===================================================================== */
const SCENARIO_DEFAULT = {
  meta: {
    nome: "A Fighter Pilot Day – Centurion",
    versione: "1.0",
    data_workshop: "",
    trainer: "",
    note: "Scenario base ricavato da: Regole del gioco, Operazione Rolling Thunder, Operazione Odyssey Dawn, Capability Brief, kill & Shot.xlsx"
  },

  /* ---------------- MAPPA ---------------- */
  mappa: {
    centro: [40.85, -123.0],
    zoom: 8,
    tile_default: "osm",
    sectional: { file: "assets/sectional_mt_shasta.jpg", bounds: [[40.0, -125.0], [42.0, -120.0]], opacita: 0.55, attivo: false },
    griglia: { attiva: true, lato_nm: 15, origine: [40.0, -125.0], colonne: 16, righe: 9 },
    bullseye: { nome: "BULLSEYE", lat: 40.509, lon: -122.2934 },
    nazioni: [
      { nome: "Fagiolistan", colore: "#c0392b", etichetta: [41.6, -122.4],
        poligono: [[42.0,-123.47],[40.82,-123.75],[40.0,-123.37],[40.0,-120.0],[42.0,-120.0]] },
      { nome: "Repubblica dei Piselli", colore: "#2e86de", etichetta: [41.4, -124.6],
        poligono: [[42.0,-125.0],[42.0,-123.47],[40.82,-123.75],[40.0,-123.37],[40.0,-125.0]] },
      { nome: "Cannellina", colore: "#8e44ad", etichetta: [42.3, -121.7],
        poligono: [[42.0,-125.0],[42.0,-120.0],[42.6,-120.0],[42.6,-125.0]] }
    ],
    fir_boundary: [[42.0,-123.47],[40.82,-123.75],[40.0,-123.37]]
  },

  /* ---------------- CLOCK / FINESTRA ---------------- */
  tempo: {
    inizio: "09:00", fine: "21:00", tick_sec: 10,
    velocita: [1, 5, 15, 30, 60, 120]
  },

  /* ---------------- METEO ---------------- */
  meteo: {
    vento_da_gradi: 90, vento_kt: 50, descrizione: "Vento da est 50 kt in quota. Possibili temporali sulla costa fino a FL360. Parzialmente nuvoloso sui target.",
    temporali_costa: false, visibilita_target: "buona"
  },

  /* ---------------- SQUADRE ---------------- */
  squadre: {
    BLUE: { nome: "IMPERIUM PACKAGE", nazione: "Coalizione ONU (Ris. 2544)", colore: "#2e86de", ruolo: "OCA – Offensive Counter Air (attaccanti)",
      membri: [ { nome: "", ruolo: "Team Leader / Mission Commander" }, { nome: "", ruolo: "Moderatore brainstorm" }, { nome: "", ruolo: "Lead TITAN (F-22)" }, { nome: "", ruolo: "Lead GLADIATOR (F-15E)" }, { nome: "", ruolo: "Lead ROMA (Typhoon)" }, { nome: "", ruolo: "Lead CENTURION (F-16)" }, { nome: "", ruolo: "Timeline keeper" } ] },
    RED: { nome: "MILITIA AEREA", nazione: "Fagiolistan", colore: "#c0392b", ruolo: "DCA – Defensive Counter Air (difensori)",
      membri: [ { nome: "", ruolo: "Team Leader / Air Defence Commander" }, { nome: "", ruolo: "Moderatore brainstorm" }, { nome: "", ruolo: "Lead IVAN (Su-35)" }, { nome: "", ruolo: "Lead VLADIMIR (Su-57)" }, { nome: "", ruolo: "SAM Commander (SA-10)" }, { nome: "", ruolo: "Timeline keeper" } ] }
  },

  /* ---------------- BRIEFING ---------------- */
  briefing: {
    BLUE: {
      titolo: "Operazione ROLLING THUNDER",
      situazione: "La tua nazione partecipa a una coalizione nata dalla risoluzione ONU 2544, con l'obiettivo di limitare il potere militare del regime dittatoriale di Fagiolistan. Dopo un colpo di stato guidato da una giunta militare che ha deposto il presidente democratico Borlotti, il Fagiolistan minaccia la Repubblica dei Piselli per avere uno sbocco sul mare; quest'ultima ha chiesto assistenza all'ONU. L'operazione Rolling Thunder mira a neutralizzare le forze aeree di Fagiolistan per proteggere la Repubblica.",
      task: ["Impedire il decollo per almeno 72 ore dei Sukhoi e degli elicotteri Mi-17", "Distruggere il C2 (comando e controllo) di Redding"],
      threat: "L'area è protetta da sistemi SA-10 ed è distante circa 200 miglia dal punto di rifornimento in volo. Il Fagiolistan impiega Su-35 e Su-57 con tattiche sovietiche: 24 Su-35 (12 Redding, 12 Red Bluff), 12 Su-57 su Cannellina, 2 batterie SA-10 su Redding, 1 su Red Bluff.",
      intel: ["CAP H24 osservate con velivoli armati con 8 missili, principalmente a protezione di Redding", "Osservati voli cargo dalla fabbrica Sukhoi", "Nelle prossime 48h previsti voli per acquisire ulteriori SA-10"],
      roe: ["Autorizzati all'ingaggio dei velivoli del Fagiolistan", "Autorizzati alla distruzione dei sistemi di difesa aerea", "Autorizzati a distruggere infrastrutture militari di Fagiolistan", "Autorizzati all'autodifesa da qualsiasi minaccia"],
      da_sapere: ["Finestra di 12 ore (0900L–2100L) per eseguire l'attacco", "Formazioni: una alla volta, 2+2 o tutte insieme", "Rifornimento in volo pre-missione obbligatorio: ~10 minuti a formazione", "Autonomia dopo AAR: F-15E 80 min, gli altri 50 min", "Tratta costa→target ~20 min, tempo sul target 5 min, ingaggio ~3 min", "Se una formazione sgancia le bombe il suo kill ratio aria-aria si dimezza"],
      output_plan: ["AAR sequence – ordine di rifornimento al tanker", "Ingress flow – ordine di ingresso nel territorio nemico", "Target assign – quale formazione bombarda quale target", "Egress flow – ordine di uscita"]
    },
    RED: {
      titolo: "Operazione ODYSSEY DAWN",
      situazione: "Un nuovo sole sta nascendo dopo la sconfitta del vecchio presidente Borlotti! Il Fagiolistan ha finalmente un governo forte. I nemici storici del Pisellistan hanno chiesto l'intervento dell'ONU per distruggere la nostra amata terra. Sta a voi, eroici combattenti, difendere le nostre famiglie e i nostri territori. Lo scopo di ODYSSEY DAWN è proteggere il territorio abbattendo ogni aereo che oserà violare i nostri confini.",
      task: ["Massimizzare la prontezza difensiva nella finestra 0900L–2100L", "Proteggere Redding, Benton, Red Bluff e il C2"],
      threat: "Fino a 8 F-22, 6 F-15E, 8 Typhoon, 8 F-16 con AMRAAM e bombe. Most likely COA: 4 jet per tipo (16). Most dangerous COA: 8 F-22 + 4 per tipo legacy (20).",
      intel: ["Attacco in massa atteso domani nella finestra 0900L–2100L", "La coalizione dispone di tanker, E-7 e Growler"],
      roe: ["Autorizzati all'ingaggio dei velivoli della Coalizione", "Autorizzati all'autodifesa da qualsiasi minaccia", "Autorizzati a distruggere infrastrutture militari di Pisellistan"],
      da_sapere: ["Potete alimentare 1-2-3 CAP continuamente o tenere gli assetti in prontezza al suolo (max 12)", "Ogni aereo può stare in CAP per un massimo di 2 ore", "Dopo l'atterraggio pronti a ridecollare dopo 2 ore con efficienza 0,75 (es. 3 su 4); gli altri in manutenzione >12h", "Su-35 in prontezza: pronti 15' dopo l'attivazione; Su-57: 25'", "I sistemi SA-10 si spostano a 10 km/h"],
      output_plan: ["Quante CAP sono attive e in che orario", "Quanti aerei in prontezza al suolo (max 12)", "Se alimentare più CAP negli orari di attacco più probabile", "Se e dove spostare i sistemi SA-10"]
    }
  },

  /* ---------------- REGOLE DEL GIOCO (ROE numeriche) ---------------- */
  regole: {
    aar_minuti_per_formazione: 10,
    tempo_sul_target_min: 5,
    durata_ingaggio_min: 3,
    kr_dimezzato: "dopo_sgancio",          // "dopo_sgancio" | "sempre_se_armati_bombe" | "mai"
    arrotondamento_kill: "deterministico",   // "deterministico" | "probabilistico"
    turnaround_min: 120,
    efficienza_turnaround: 0.75,
    cap_max_min: 120,
    prontezza_max_terra: 12,
    sam_velocita_kmh: 10,
    growler_copertura_quadrati: 2,
    harm_auto: true,               // i Growler lanciano HARM da soli sulle SA-10 che emettono entro la gittata
    harm_nm: 50,                   // gittata utile AGM-88 da quota (massima ~80 NM): oltre l'anello SA-10 di 40 NM
    harm_per_sam: 2,               // HARM per salvo su una batteria (salvo andato a segno = batteria soppressa)
    sam_missili_per_aereo: 2,
    fog_of_war: true,
    autonomia_modalita: "regole",  // "regole" (minuti da ROE) | "realistica" (lb/h)
    bingo_auto_rtb: true,
    missili_per_ingaggio: 2,
    kr_scala: 0.5,                 // letalità: perdite reali = n × KR × kr_scala per merge di 3 min (1.0 = tabella letterale). Il "netto Excel" resta n × KR
    commit_nm_blue: 40             // distanza di commit dei caccia BLUE in SWEEP/ESCORT/CAP
  },

  /* ---------------- TIPI VELIVOLO (fisica + capability) ---------------- */
  tipi: {
    F22:   { nome: "F-22 Raptor",        lato: "BLUE", icona: "f22",     categoria: "caccia", gen: 5, stealth: 0.3,
             tas_crociera_kt: 480, tas_max_kt: 1200, tas_attacco_kt: 540, quota_ft: 35000, roc_fpm: 10000, bank_nav: 30, bank_tatt: 70, g_max: 9,
             autonomia_min: 50, consumo_lbh: 9000, carburante_lb: 18000, radar_nm: 90, missili_nm: 40,
             armi: { AMRAAM: 6, GBU48: 0 }, pro: "5ª gen, stealth, avionica", contro: "autonomia, armamento" },
    F15:   { nome: "F-15E Strike Eagle", lato: "BLUE", icona: "f15",     categoria: "caccia-bombardiere", gen: 4, stealth: 1.0,
             tas_crociera_kt: 480, tas_max_kt: 1400, tas_attacco_kt: 520, quota_ft: 30000, roc_fpm: 9000, bank_nav: 30, bank_tatt: 60, g_max: 9,
             autonomia_min: 80, consumo_lbh: 10000, carburante_lb: 23000, radar_nm: 80, missili_nm: 40,
             armi: { AMRAAM: 4, GBU48: 4 }, pro: "autonomia >3h, armamento", contro: "manovrabilità, segnatura radar" },
    F2000: { nome: "Eurofighter Typhoon", lato: "BLUE", icona: "typhoon", categoria: "caccia multiruolo", gen: 4.5, stealth: 0.8,
             tas_crociera_kt: 480, tas_max_kt: 1300, tas_attacco_kt: 540, quota_ft: 33000, roc_fpm: 12000, bank_nav: 30, bank_tatt: 70, g_max: 9,
             autonomia_min: 50, consumo_lbh: 8500, carburante_lb: 11000, radar_nm: 80, missili_nm: 40,
             armi: { AMRAAM: 4, GBU48: 2 }, pro: "manovrabilità, armamento A/A, avionica", contro: "autonomia, armamento A/G" },
    F16:   { nome: "F-16 Fighting Falcon", lato: "BLUE", icona: "f16",   categoria: "caccia multiruolo", gen: 4, stealth: 0.9,
             tas_crociera_kt: 470, tas_max_kt: 1200, tas_attacco_kt: 520, quota_ft: 28000, roc_fpm: 9000, bank_nav: 30, bank_tatt: 70, g_max: 9,
             autonomia_min: 50, consumo_lbh: 7000, carburante_lb: 7000, radar_nm: 70, missili_nm: 40,
             armi: { AMRAAM: 2, GBU48: 2 }, pro: "manovrabilità", contro: "autonomia, armamento" },
    SU57:  { nome: "Su-57 Felon",        lato: "RED",  icona: "su57",    categoria: "caccia", gen: 5, stealth: 0.4,
             tas_crociera_kt: 480, tas_max_kt: 1300, tas_attacco_kt: 540, quota_ft: 33000, roc_fpm: 10000, bank_nav: 30, bank_tatt: 70, g_max: 9,
             autonomia_min: 120, consumo_lbh: 9500, carburante_lb: 22000, radar_nm: 80, missili_nm: 45, prontezza_min: 25,
             armi: { ADDER: 6 }, pro: "autonomia >3h, manovrabilità, 5ª gen, stealth", contro: "addestramento piloti, bassa efficienza" },
    SU35:  { nome: "Su-35 Flanker",      lato: "RED",  icona: "su35",    categoria: "caccia", gen: 4.5, stealth: 1.0,
             tas_crociera_kt: 480, tas_max_kt: 1300, tas_attacco_kt: 540, quota_ft: 30000, roc_fpm: 11000, bank_nav: 30, bank_tatt: 70, g_max: 9,
             autonomia_min: 120, consumo_lbh: 9000, carburante_lb: 25000, radar_nm: 80, missili_nm: 45, prontezza_min: 15,
             armi: { ADDER: 10 }, pro: "autonomia >3h, manovrabilità", contro: "avionica/software, addestramento, tattiche obsolete" },
    KC30:  { nome: "KC-30 MRTT (tanker)", lato: "BLUE", icona: "kc30",   categoria: "supporto", gen: 0, stealth: 1.0,
             tas_crociera_kt: 300, tas_max_kt: 480, tas_attacco_kt: 300, quota_ft: 25000, roc_fpm: 2500, bank_nav: 25, bank_tatt: 25, g_max: 2.5,
             autonomia_min: 480, consumo_lbh: 12000, carburante_lb: 240000, radar_nm: 0, missili_nm: 0, armi: {}, pro: "offload", contro: "vulnerabile" },
    E7:    { nome: "E-7 Wedgetail (AEW&C)", lato: "BLUE", icona: "kc30", categoria: "supporto", gen: 0, stealth: 1.0,
             tas_crociera_kt: 380, tas_max_kt: 480, tas_attacco_kt: 380, quota_ft: 33000, roc_fpm: 2500, bank_nav: 25, bank_tatt: 25, g_max: 2.5,
             autonomia_min: 600, consumo_lbh: 11000, carburante_lb: 150000, radar_nm: 270, missili_nm: 0, armi: {}, pro: "vede fino a 500 km", contro: "vulnerabile" },
    EA18:  { nome: "EA-18G Growler",     lato: "BLUE", icona: "f15",     categoria: "guerra elettronica", gen: 4.5, stealth: 1.0,
             tas_crociera_kt: 470, tas_max_kt: 1000, tas_attacco_kt: 480, quota_ft: 28000, roc_fpm: 8000, bank_nav: 30, bank_tatt: 60, g_max: 7.5,
             autonomia_min: 70, consumo_lbh: 9000, carburante_lb: 14000, radar_nm: 70, missili_nm: 0, armi: { HARM: 2 }, pro: "sopprime i radar SA-10", contro: "non ingaggia aerei" },
    SA10:  { nome: "SA-10 Grumble (S-300)", lato: "RED", icona: "sam",   categoria: "SAM", gen: 0, stealth: 1.0,
             tas_crociera_kt: 5.4, tas_max_kt: 5.4, quota_ft: 0, roc_fpm: 0, bank_nav: 0, bank_tatt: 0, g_max: 0,
             autonomia_min: 99999, consumo_lbh: 0, carburante_lb: 0, radar_nm: 150, missili_nm: 40, armi: { S300: 32 }, pro: "range >40 NM, mobile", contro: "avionica datata, Growler" }
  },

  /* ---------------- KILL RATIO (KRO) – da kill & Shot.xlsx ---------------- */
  /* kill_ratio[attaccante][difensore] = aerei nemici abbattuti per ogni aereo attaccante in un ingaggio */
  kill_ratio: {
    F22:   { SU57: 1.5,  SU35: 2.0 },
    F15:   { SU57: 0.5,  SU35: 1.0 },
    F2000: { SU57: 0.5,  SU35: 1.0 },
    F16:   { SU57: 0.25, SU35: 0.5 },
    SU57:  { F22: 1.0, F15: 1.5, F2000: 1.5, F16: 1.5, EA18: 1.5, KC30: 2, E7: 2 },
    SU35:  { F22: 0.5, F15: 1.0, F2000: 1.0, F16: 1.0, EA18: 1.0, KC30: 2, E7: 2 }
  },
  kill_ratio_con_bombe: { F15: { SU57: 0.25, SU35: 0.5 }, F2000: { SU57: 0.25, SU35: 0.5 }, F16: { SU57: 0.125, SU35: 0.25 } },

  /* ---------------- PUNTI GEOGRAFICI REALI ---------------- */
  basi: [
    { id: "TACCOLA",    nome: "Taccola (Crescent City – KCEC)", lato: "BLUE", lat: 41.7802, lon: -124.2365, nazione: "Repubblica dei Piselli", pista_ft: 5000 },
    { id: "CANNELLINA", nome: "Cannellina (Klamath Falls – KLMT)", lato: "RED", lat: 42.1561, lon: -121.7333, nazione: "Cannellina", pista_ft: 10300 },
    { id: "REDDING",    nome: "Redding Municipal (KRDD)", lato: "RED", lat: 40.5090, lon: -122.2934, nazione: "Fagiolistan", pista_ft: 7000 },
    { id: "REDBLUFF",   nome: "Red Bluff Municipal (KRBL)", lato: "RED", lat: 40.1507, lon: -122.2523, nazione: "Fagiolistan", pista_ft: 5900 }
  ],
  target: [
    { id: "TGT_REDDING", nome: "Redding Municipal Airport", lat: 40.5090, lon: -122.2934, gbu_richieste: 10, descrizione: "12 Su-35 + Mi-17. Impedire il decollo per 72h" },
    { id: "TGT_C2",      nome: "C2 Redding (Comando e Controllo)", lat: 40.5865, lon: -122.3917, gbu_richieste: 3, descrizione: "Quartier generale controllo tattico" },
    { id: "TGT_BENTON",  nome: "Benton Helo Airport (O85)", lat: 40.5747, lon: -122.4077, gbu_richieste: 11, descrizione: "Elicotteri Mi-17/Mi-24" },
    { id: "TGT_REDBLUFF", nome: "Red Bluff Airport", lat: 40.1507, lon: -122.2523, gbu_richieste: 8, descrizione: "12 Su-35" }
  ],
  aar: [
    { id: "AAR_NORD", nome: "AAR NORD – Tanker 1 (KC-30)", lat: 41.05, lon: -125.35, quota_ft: 25000, orient: 0, lunghezza_nm: 30 },
    { id: "AAR_SUD",  nome: "AAR SUD – Tanker 2 (KC-30)",  lat: 40.70, lon: -125.35, quota_ft: 25000, orient: 0, lunghezza_nm: 30 }
  ],
  orbite: [
    { id: "E7", nome: "E-7 Wedgetail orbit", tipo: "E7", lat: 40.45, lon: -124.75, quota_ft: 33000 }
  ],
  gate: [
    { id: "GATE_N", nome: "Gate NORD",   lat: 41.55, lon: -123.60 },
    { id: "GATE_C", nome: "Gate CENTRO", lat: 40.85, lon: -123.72 },
    { id: "GATE_S", nome: "Gate SUD",    lat: 40.25, lon: -123.45 }
  ],
  cap_box: [
    { id: "CAP1", nome: "CAP 1 (Nord)",  lato: "RED",  lat: 41.00, lon: -122.35, raggio_nm: 12 },
    { id: "CAP2", nome: "CAP 2 (Ovest)", lato: "RED",  lat: 40.55, lon: -122.95, raggio_nm: 12 },
    { id: "CAP3", nome: "CAP 3 (Sud)",   lato: "RED",  lat: 40.12, lon: -122.05, raggio_nm: 12 },
    { id: "CAPB_N", nome: "CAP Blue Nord", lato: "BLUE", lat: 41.30, lon: -122.60, raggio_nm: 12 },
    { id: "CAPB_W", nome: "CAP Blue Ovest", lato: "BLUE", lat: 40.75, lon: -123.20, raggio_nm: 12 },
    { id: "CAPB_S", nome: "CAP Blue Sud", lato: "BLUE", lat: 40.20, lon: -122.10, raggio_nm: 12 }
  ],

  /* ---------------- FORMAZIONI ---------------- */
  formazioni: [
    { id: "TITAN",     callsign: "TITAN",     lato: "BLUE", tipo: "F22",   numero: 4, base: "TACCOLA",    ruolo: "SWEEP/ESCORT" },
    { id: "GLADIATOR", callsign: "GLADIATOR", lato: "BLUE", tipo: "F15",   numero: 4, base: "TACCOLA",    ruolo: "STRIKE" },
    { id: "ROMA",      callsign: "ROMA",      lato: "BLUE", tipo: "F2000", numero: 4, base: "TACCOLA",    ruolo: "STRIKE" },
    { id: "CENTURION", callsign: "CENTURION", lato: "BLUE", tipo: "F16",   numero: 4, base: "TACCOLA",    ruolo: "STRIKE" },
    { id: "GROWLER",   callsign: "GRIZZLY",   lato: "BLUE", tipo: "EA18",  numero: 4, base: "TACCOLA",    ruolo: "SEAD/EA" },
    { id: "IVAN1",     callsign: "IVAN 1",    lato: "RED",  tipo: "SU35",  numero: 4, base: "REDDING",    ruolo: "DCA" },
    { id: "IVAN2",     callsign: "IVAN 2",    lato: "RED",  tipo: "SU35",  numero: 4, base: "REDDING",    ruolo: "DCA" },
    { id: "IVAN3",     callsign: "IVAN 3",    lato: "RED",  tipo: "SU35",  numero: 4, base: "REDDING",    ruolo: "DCA" },
    { id: "IVAN4",     callsign: "IVAN 4",    lato: "RED",  tipo: "SU35",  numero: 4, base: "REDBLUFF",   ruolo: "DCA" },
    { id: "IVAN5",     callsign: "IVAN 5",    lato: "RED",  tipo: "SU35",  numero: 4, base: "REDBLUFF",   ruolo: "DCA" },
    { id: "IVAN6",     callsign: "IVAN 6",    lato: "RED",  tipo: "SU35",  numero: 4, base: "REDBLUFF",   ruolo: "DCA" },
    { id: "VLADIMIR1", callsign: "VLADIMIR 1", lato: "RED", tipo: "SU57",  numero: 4, base: "CANNELLINA", ruolo: "DCA" },
    { id: "VLADIMIR2", callsign: "VLADIMIR 2", lato: "RED", tipo: "SU57",  numero: 4, base: "CANNELLINA", ruolo: "DCA" },
    { id: "VLADIMIR3", callsign: "VLADIMIR 3", lato: "RED", tipo: "SU57",  numero: 4, base: "CANNELLINA", ruolo: "DCA" }
  ],
  sam: [
    { id: "SA10_A", nome: "SA-10 Redding Nord", lat: 40.58, lon: -122.22, missili: 11, raggio_nm: 40 },
    { id: "SA10_B", nome: "SA-10 Redding Sud",  lat: 40.44, lon: -122.38, missili: 11, raggio_nm: 40 },
    { id: "SA10_C", nome: "SA-10 Red Bluff",    lat: 40.15, lon: -122.20, missili: 10, raggio_nm: 40 }
  ],

  /* ---------------- INJECT / CONTINGENCY ---------------- */
  inject: [
    { id: "tanker_fallout", nome: "Tanker fallout", descrizione: "Il Tanker 2 (AAR SUD) non è disponibile", attivo: false },
    { id: "aeroporto_chiuso", nome: "Aeroporto chiuso", descrizione: "Taccola chiusa 30 min per detriti in pista", attivo: false },
    { id: "no_awacs", nome: "No AWACS", descrizione: "E-7 avaria: nessuna picture per i Blue", attivo: false },
    { id: "no_sam", nome: "No SAM", descrizione: "Le batterie SA-10 sono fuori uso", attivo: false },
    { id: "temporale", nome: "Thunderstorm", descrizione: "Temporali sulla costa fino a FL360: +15 kt vento, AAR rallentato", attivo: false },
    { id: "terremoto", nome: "Terremoto", descrizione: "Pista di Redding danneggiata: Su-35 di Redding non possono decollare per 60 min", attivo: false }
  ],

  /* ---------------- AGENDA WORKSHOP ---------------- */
  agenda: [
    { ora: "09:00", durata: 15, fase: "Intro e presentazione" },
    { ora: "09:15", durata: 40, fase: "Pilot V, 5T process, presentazione scenario" },
    { ora: "10:10", durata: 40, fase: "Brainstorm" },
    { ora: "11:10", durata: 50, fase: "Plan" },
    { ora: "12:10", durata: 50, fase: "Briefing" },
    { ora: "13:00", durata: 60, fase: "Pranzo" },
    { ora: "14:00", durata: 40, fase: "Execution (simulazione) + Debrief" },
    { ora: "15:00", durata: 50, fase: "Analysis" },
    { ora: "16:00", durata: 30, fase: "Tips to go" }
  ],

  /* ---------------- PIANI (vuoti; compilati in fase PLAN) ---------------- */
  piani: { BLUE: null, RED: null }
};
