/* =====================================================================
   CENTURION – CATALOGO MISSIONI
   10 missioni pronte per i clienti, ognuna con obiettivi propri, briefing per le due squadre,
   focus formativo, domande per il debrief e demo guidata (piani d'esempio + narrazione).
   Ogni missione parte dallo scenario base e ne sostituisce solo le parti che cambiano.
   Coordinate reali (Nord California), tutte dentro l'area del terreno 3D.
   ===================================================================== */
const MISSIONI = (() => {
  const BK = "centurion_scenario_backup";
  const clone = o => JSON.parse(JSON.stringify(o));
  const F = (id, tipo, numero, base, ruolo, lato, callsign) => ({ id, callsign: callsign || id, lato: lato || "BLUE", tipo, numero, base, ruolo });
  // formazioni riusate (stessi callsign = stesse clip radio)
  const B = {
    TITAN: (n, base) => F("TITAN", "F22", n || 4, base || "TACCOLA", "SWEEP/ESCORT"),
    GLADIATOR: (n, base) => F("GLADIATOR", "F15", n || 4, base || "TACCOLA", "STRIKE"),
    ROMA: (n, base) => F("ROMA", "F2000", n || 4, base || "TACCOLA", "STRIKE"),
    CENTURION: (n, base) => F("CENTURION", "F16", n || 4, base || "TACCOLA", "STRIKE"),
    GROWLER: (n, base) => F("GROWLER", "EA18", n || 2, base || "TACCOLA", "SEAD/EA", "BLUE", "GRIZZLY")
  };
  const R = {
    IVAN: (i, base, n) => F("IVAN" + i, "SU35", n || 4, base, "DCA", "RED", "IVAN " + i),
    VLAD: (i, base, n) => F("VLADIMIR" + i, "SU57", n || 4, base, "DCA", "RED", "VLADIMIR " + i)
  };
  const BASI_STD = () => clone(SCENARIO_DEFAULT.basi);
  const SAM_STD = id => clone(SCENARIO_DEFAULT.sam.find(s => s.id === id));
  const T = (id, nome, lat, lon, gbu, categoria, descrizione, extra) => Object.assign({ id, nome, lat, lon, gbu_richieste: gbu, categoria, descrizione }, extra || {});
  // tanker più vicini alla costa (sempre in territorio amico): più autonomia utile verso Redding
  const AAR_VICINI = () => [{ id: "AAR_NORD", nome: "AAR NORD – Tanker 1 (KC-30)", lat: 41.05, lon: -124.10, quota_ft: 25000, orient: 0, lunghezza_nm: 30 }, { id: "AAR_SUD", nome: "AAR SUD – Tanker 2 (KC-30)", lat: 40.65, lon: -124.10, quota_ft: 25000, orient: 0, lunghezza_nm: 30 }];
  const finestraTesto = (a, b) => `Finestra operativa ${a}L–${b}L`;
  // briefing: si parte da quello di default e si cambiano i campi della missione
  function brief(sc, lato, o) { const b = sc.briefing[lato]; Object.assign(b, o); return b; }
  const DA_SAPERE_BLUE = (inizio, fine, extra) => [finestraTesto(inizio, fine), "Rifornimento in volo pre-missione obbligatorio: ~10 minuti a formazione, un tanker alla volta", "Autonomia dopo AAR: F-15E 80 min, gli altri 50 min", "Tempo sul target 5 min, ingaggio aria-aria ~3 min", "Senza copertura del Growler (2 quadrati di griglia) chi entra nel ring di un SAM viene abbattuto", "Se una formazione sgancia le bombe il suo kill ratio aria-aria si dimezza", ...(extra || [])];
  const DA_SAPERE_RED = (inizio, fine, extra) => [finestraTesto(inizio, fine), "Potete alimentare CAP continue o tenere velivoli in prontezza al suolo (max 12)", "Ogni aereo può stare in CAP al massimo 2 ore; dopo l'atterraggio 2 ore di turnaround (efficienza 0,75)", "Su-35 in prontezza pronti in 15', Su-57 in 25'", "I SAM si spostano a 10 km/h", ...(extra || [])];

  /* ======================= LE MISSIONI ======================= */
  const ELENCO = [
    { id: "M00", codice: "ROLLING THUNDER", titolo: "Rolling Thunder · scenario base", tipo: "Strike OCA su aeroporti e C2", difficolta: 3, durata: "12 h di finestra",
      focus: "Il metodo completo: 5T, pianificazione condivisa, timeline e debrief sui fatti.",
      descrizione: "Lo scenario originale del workshop: attaccare Redding, Benton, Red Bluff e il C2 difesi da Su-35, Su-57 e tre SA-10.",
      domande: ["Il task era chiaro a tutti prima del piano?", "Quale delle 5T è stata la più debole?", "Chi ha deciso l'ordine di rifornimento, e con quali informazioni?"],
      applica: sc => sc, base: true },

    { id: "M01", codice: "IRON GATE", titolo: "Iron Gate · soppressione delle difese aeree", tipo: "SEAD/DEAD", difficolta: 3, durata: "6 h",
      focus: "Rimuovere i vincoli prima di inseguire il risultato: sequenza, dipendenze, chi apre la porta a chi.",
      descrizione: "Prima di ogni attacco su Redding bisogna spegnere i tre SA-10. Si distruggono i radar di tiro (2 GBU ciascuno): il SAM collegato smette di sparare. Il Growler è la chiave d'accesso.",
      domande: ["Avete messo il Growler al centro del piano o lo avete aggiunto alla fine?", "Che cosa sarebbe successo se il primo radar non fosse caduto?", "Chi nel vostro lavoro 'apre la porta' agli altri, e lo riconoscete?"],
      applica: sc => {
        Object.assign(sc.tempo, { inizio: "09:00", fine: "15:00" }); sc.aar = AAR_VICINI();
        sc.target = [
          T("RAD_A", "Radar di tiro SA-10 Redding Nord", 40.586, -122.214, 2, "radar", "Radar 'Flap Lid' della batteria Nord: distruggerlo spegne la SA-10 Redding Nord", { sam: "SA10_A" }),
          T("RAD_B", "Radar di tiro SA-10 Redding Sud", 40.446, -122.372, 2, "radar", "Radar della batteria Sud: distruggerlo spegne la SA-10 Redding Sud", { sam: "SA10_B" }),
          T("RAD_C", "Radar di tiro SA-10 Red Bluff", 40.156, -122.206, 2, "radar", "Radar della batteria di Red Bluff: distruggerlo spegne la SA-10 Red Bluff", { sam: "SA10_C" }),
          T("RAD_EW", "Radar di scoperta Black Butte", 41.366, -122.338, 3, "radar", "Radar di sorveglianza a lungo raggio che allerta le CAP")
        ];
        sc.formazioni = [B.TITAN(), B.GLADIATOR(), B.ROMA(), B.CENTURION(), B.GROWLER(4), R.IVAN(1, "REDDING"), R.IVAN(2, "REDDING"), R.IVAN(3, "REDDING"), R.IVAN(4, "REDBLUFF"), R.VLAD(1, "CANNELLINA"), R.VLAD(2, "CANNELLINA")];
        sc.obiettivi = [
          { tipo: "sopprimi_sam", sam: ["SA10_A", "SA10_B", "SA10_C"], minimo: 2, primario: true, testo: "Sopprimere almeno 2 batterie SA-10 su 3 distruggendo i radar di tiro" },
          { tipo: "distruggi", target: ["RAD_EW"], primario: false, testo: "Distruggere il radar di scoperta di Black Butte" },
          { tipo: "perdite_max", massimo: 4, primario: false, testo: "Non perdere più di 4 velivoli" }];
        brief(sc, "BLUE", { titolo: "Operazione IRON GATE", situazione: "Il Fagiolistan ha chiuso il cielo sopra la valle di Redding con tre batterie SA-10. Finché sono attive nessun attacco è possibile. IRON GATE apre la porta: si colpiscono i radar di tiro, il cervello di ogni batteria, e si lascia il campo libero alle operazioni successive.",
          task: ["Sopprimere almeno 2 delle 3 batterie SA-10 distruggendone il radar di tiro", "Se possibile, distruggere il radar di scoperta di Black Butte", "Riportare a casa il pacchetto: massimo 4 velivoli persi"],
          threat: "3 SA-10 (raggio 40 NM, 10-11 missili ciascuna), 16 Su-35 tra Redding e Red Bluff, 8 Su-57 a Cannellina. Il radar di Black Butte allerta le CAP sui settori nord.",
          intel: ["Ogni radar di tiro richiede 2 GBU-48", "Senza radar la batteria non può guidare missili", "Le CAP del mattino coprono soprattutto il nord di Redding"],
          da_sapere: DA_SAPERE_BLUE("09:00", "15:00", ["Il Growler copre chi è entro 2 quadrati di griglia: decide dove si può entrare"]),
          output_plan: ["Dove sta il Growler e a che ora", "Ordine di attacco dei radar (quale porta si apre per prima)", "Chi scorta chi", "Egress e rientro"] });
        brief(sc, "RED", { titolo: "Operazione STEEL DOME", situazione: "I SA-10 sono la cupola d'acciaio del Fagiolistan. La coalizione sa che senza spegnerli non può colpire Redding: proverà ad accecare le batterie. Difendete i radar.",
          task: ["Proteggere i radar di tiro delle tre batterie SA-10", "Proteggere il radar di Black Butte", "Abbattere il pacchetto SEAD prima che arrivi sui radar"],
          threat: "Growler EA-18G con jamming, F-22 in sweep, F-15E, Typhoon e F-16 con GBU-48 contro i radar.", intel: ["Attacco atteso in mattinata", "La coalizione impiegherà il Growler per coprire l'ingresso"],
          da_sapere: DA_SAPERE_RED("09:00", "15:00", ["Se un radar di tiro cade la sua batteria smette di sparare: spostarla non basta"]),
          output_plan: ["CAP attive e orari", "Prontezza al suolo", "Se spostare le batterie", "Distanza di commit"] });
      },
      demo: { redRitardo: 60, prontezzaMax: 0,
        blue: { formazioni: {
          GROWLER:   { decollo: "09:40", tanker: "AAR_SUD", aar_ordine: 1, gate_in: "GATE_C", push: "10:24", stazione: { lat: 40.45, lon: -122.78 }, cap_min: 30, gate_out: "GATE_C" },
          TITAN:     { decollo: "09:50", tanker: "AAR_NORD", aar_ordine: 1, gate_in: "GATE_C", push: "10:24", cap: "CAPB_W", cap_min: 20, gate_out: "GATE_C" },
          CENTURION: { decollo: "09:45", tanker: "AAR_SUD", aar_ordine: 2, gate_in: "GATE_C", push: "10:30", target: "RAD_B", gate_out: "GATE_C" },
          GLADIATOR: { decollo: "09:50", tanker: "AAR_NORD", aar_ordine: 2, gate_in: "GATE_C", push: "10:32", target: "RAD_A", target2: "RAD_C", gate_out: "GATE_S" },
          ROMA:      { decollo: "09:55", tanker: "AAR_SUD", aar_ordine: 3, gate_in: "GATE_N", push: "10:35", target: "RAD_EW", gate_out: "GATE_N" } } },
        red: { cap: [{ box: "CAP1", formazione: "IVAN1", da: "09:00", a: "11:00" }, { box: "CAP2", formazione: "IVAN2", da: "10:00", a: "12:00" }, { box: "CAP3", formazione: "IVAN4", da: "11:00", a: "13:00" }], prontezza: ["IVAN3", "VLADIMIR1"], sam_moves: [], commit_nm: 50 },
        passi: ["<b>IRON GATE · SEAD.</b> L'obiettivo non è colpire Redding ma aprire la porta: i tre SA-10 si spengono solo distruggendo i loro radar di tiro.",
          "<b>Il piano.</b> Il Growler parte per primo e si mette al centro; CENTURION va sul radar Sud, GLADIATOR divide le bombe tra radar Nord e Red Bluff, ROMA prende il radar di scoperta a nord, TITAN pulisce il cielo.",
          "<b>Esecuzione.</b> Guardate gli eventi SAM SOPPRESSA: ogni radar distrutto toglie una minaccia a chi viene dopo."] } },

    { id: "M02", codice: "BROKEN ARROW", titolo: "Broken Arrow · interdizione dei ponti", tipo: "Interdizione con scadenza", difficolta: 2, durata: "5 h",
      focus: "Priorità sotto pressione di tempo: meglio due risultati alle 11:30 che tre alle 13:00.",
      descrizione: "Una colonna corazzata si prepara a scendere verso sud. Bisogna interrompere i ponti sulla I-5 e sul Sacramento prima delle 12:00: ogni ponte richiede 4 GBU.",
      domande: ["Il vostro piano partiva dalla scadenza o dalle risorse disponibili?", "Quale ponte avete sacrificato e perché?", "Chi ha controllato la timeline durante l'esecuzione?"],
      applica: sc => {
        Object.assign(sc.tempo, { inizio: "09:00", fine: "14:00" }); sc.aar = AAR_VICINI();
        sc.target = [
          T("PONTE_PIT", "Ponte Pit River (I-5, lago Shasta)", 40.7543, -122.3196, 4, "ponte", "Ponte stradale e ferroviario sul lago Shasta"),
          T("PONTE_ANTLERS", "Ponte Antlers (I-5, Lakehead)", 40.8750, -122.3810, 4, "ponte", "Unica via a nord del lago"),
          T("PONTE_ANDERSON", "Ponte sul Sacramento ad Anderson", 40.4520, -122.2880, 4, "ponte", "Passaggio verso sud della colonna")];
        sc.sam = [SAM_STD("SA10_A"), SAM_STD("SA10_B")];
        sc.formazioni = [B.TITAN(), B.GLADIATOR(), B.ROMA(), B.CENTURION(), B.GROWLER(2), R.IVAN(1, "REDDING"), R.IVAN(2, "REDDING"), R.IVAN(3, "REDDING"), R.IVAN(4, "REDBLUFF"), R.IVAN(5, "REDBLUFF"), R.VLAD(1, "CANNELLINA")];
        sc.obiettivi = [
          { tipo: "distruggi", target: ["PONTE_PIT", "PONTE_ANTLERS", "PONTE_ANDERSON"], minimo: 2, entro: "12:00", primario: true, testo: "Interrompere almeno 2 ponti entro le 12:00" },
          { tipo: "distruggi", target: ["PONTE_PIT", "PONTE_ANTLERS", "PONTE_ANDERSON"], minimo: 3, entro: "13:30", primario: false, testo: "Interrompere tutti e 3 i ponti entro le 13:30" },
          { tipo: "perdite_max", massimo: 4, primario: false, testo: "Non perdere più di 4 velivoli" }];
        brief(sc, "BLUE", { titolo: "Operazione BROKEN ARROW", situazione: "Una colonna corazzata del Fagiolistan si sta ammassando a nord del lago Shasta. Alle 12:00 inizierà a scendere verso la Repubblica dei Piselli. Gli unici passaggi sono tre ponti: se cadono in tempo la colonna resta bloccata per giorni.",
          task: ["Interrompere almeno 2 ponti entro le 12:00", "Interrompere il terzo ponte entro le 13:30", "Non perdere più di 4 velivoli"],
          threat: "2 SA-10 attorno a Redding, 20 Su-35 tra Redding e Red Bluff, Su-57 da Cannellina.", intel: ["Ogni ponte richiede 4 GBU-48", "La colonna si muoverà alle 12:00 in punto", "Le CAP RED proteggono soprattutto il lago"],
          da_sapere: DA_SAPERE_BLUE("09:00", "14:00", ["Un ponte colpito dopo le 12:00 conta solo per l'obiettivo secondario"]),
          output_plan: ["Quali ponti, con quali formazioni, a che ora (TOT)", "Ordine di rifornimento coerente con la scadenza", "Piano B se una formazione non arriva"] });
        brief(sc, "RED", { titolo: "Operazione IRON RIVER", situazione: "La colonna corazzata partirà alle 12:00. Il nemico sa che può fermarla solo distruggendo i ponti. Tenete aperti i passaggi fino a mezzogiorno.",
          task: ["Proteggere i tre ponti almeno fino alle 12:00", "Abbattere i bombardieri prima del lago"], threat: "F-15E, Typhoon e F-16 con GBU-48, scorta F-22, Growler.", intel: ["Attacco atteso tra le 10:00 e le 12:00"],
          da_sapere: DA_SAPERE_RED("09:00", "14:00"), output_plan: ["CAP sui ponti e orari", "Prontezza al suolo", "Posizione dei SAM"] });
      },
      demo: { redRitardo: 60, prontezzaMax: 0,
        blue: { formazioni: {
          GROWLER:   { decollo: "09:35", tanker: "AAR_SUD", aar_ordine: 1, gate_in: "GATE_C", push: "10:15", stazione: { lat: 40.70, lon: -122.85 }, cap_min: 30, gate_out: "GATE_C" },
          TITAN:     { decollo: "09:40", tanker: "AAR_NORD", aar_ordine: 1, gate_in: "GATE_C", push: "10:15", cap: "CAPB_W", cap_min: 20, gate_out: "GATE_C" },
          GLADIATOR: { decollo: "09:45", tanker: "AAR_NORD", aar_ordine: 2, gate_in: "GATE_C", push: "10:22", target: "PONTE_PIT", target2: "PONTE_ANTLERS", gate_out: "GATE_C" },
          CENTURION: { decollo: "09:45", tanker: "AAR_SUD", aar_ordine: 2, gate_in: "GATE_S", push: "10:25", target: "PONTE_ANDERSON", gate_out: "GATE_S" },
          ROMA:      { decollo: "09:55", tanker: "AAR_SUD", aar_ordine: 3, gate_in: "GATE_C", push: "10:32", target: "PONTE_ANTLERS", gate_out: "GATE_C" } } },
        red: { cap: [{ box: "CAP1", formazione: "IVAN1", da: "09:00", a: "11:00" }, { box: "CAP2", formazione: "IVAN2", da: "10:00", a: "12:00" }, { box: "CAP1", formazione: "IVAN3", da: "11:00", a: "13:00" }], prontezza: ["IVAN4", "VLADIMIR1"], sam_moves: [], commit_nm: 50 },
        passi: ["<b>BROKEN ARROW · interdizione.</b> Tre ponti, una scadenza: alle 12:00 la colonna parte. L'obiettivo primario vale solo se i ponti cadono prima.",
          "<b>Il piano.</b> GLADIATOR divide le bombe tra Pit River e Antlers, CENTURION va su Anderson, ROMA rinforza Antlers. Tutti i TOT sono prima delle 11:00: il margine è la vera risorsa.",
          "<b>Esecuzione.</b> Tenete d'occhio il riquadro Obiettivi: diventa verde solo se due ponti cadono entro mezzogiorno."] } },

    { id: "M03", codice: "SEA HAWK", titolo: "Sea Hawk · attacco alla flotta da sbarco", tipo: "Anti-nave", difficolta: 3, durata: "4 h",
      focus: "Reagire a una minaccia che si avvicina: decidere con informazioni incomplete e poco tempo.",
      descrizione: "Una flotta del Fagiolistan è al largo di Humboldt Bay. La fregata di scorta ha un SAM navale: affondarla spegne la difesa. Le navi da sbarco vanno colpite prima delle 12:00.",
      domande: ["Avete colpito prima la scorta o direttamente le navi da sbarco? Con quali conseguenze?", "Come avete gestito l'urgenza senza perdere la sicurezza?", "Quando è giusto cambiare il piano in corsa?"],
      applica: sc => {
        Object.assign(sc.tempo, { inizio: "09:00", fine: "13:00" });
        sc.basi = BASI_STD().concat([{ id: "WEAVERVILLE", nome: "Weaverville (O54) – base avanzata", lato: "RED", lat: 40.7476, lon: -122.9220, nazione: "Fagiolistan", pista_ft: 3600 }]);
        sc.target = [
          T("NAVE_FAVA", "Nave d'assalto anfibio 'Fava'", 40.95, -124.42, 6, "nave", "Trasporta i mezzi da sbarco"),
          T("NAVE_LENT", "Fregata di scorta 'Lenticchia'", 40.86, -124.46, 4, "nave", "Difesa aerea della flotta (SA-N-6)", { sam: "SAN6" }),
          T("NAVE_CECE", "Nave da sbarco 'Cece'", 40.78, -124.40, 6, "nave", "Trasporta la fanteria di marina")];
        sc.sam = [{ id: "SAN6", nome: "SA-N-6 fregata Lenticchia", lat: 40.86, lon: -124.46, missili: 8, raggio_nm: 15 }];
        sc.gate = [{ id: "GATE_N", nome: "Gate MARE NORD", lat: 41.30, lon: -124.55 }, { id: "GATE_C", nome: "Gate MARE CENTRO", lat: 41.05, lon: -124.75 }, { id: "GATE_S", nome: "Gate MARE SUD", lat: 40.45, lon: -124.75 }];
        sc.cap_box = [{ id: "CAP_COSTA", nome: "CAP Costa (sopra la flotta)", lato: "RED", lat: 40.90, lon: -124.10, raggio_nm: 12 }, { id: "CAP2", nome: "CAP 2 (Ovest)", lato: "RED", lat: 40.55, lon: -122.95, raggio_nm: 12 },
          { id: "CAPB_MARE", nome: "CAP Blue Mare", lato: "BLUE", lat: 41.18, lon: -124.25, raggio_nm: 12 }, { id: "CAPB_W", nome: "CAP Blue Ovest", lato: "BLUE", lat: 40.75, lon: -123.20, raggio_nm: 12 }];
        sc.formazioni = [B.TITAN(), B.GLADIATOR(), B.ROMA(), B.CENTURION(), B.GROWLER(2), R.IVAN(1, "WEAVERVILLE"), R.IVAN(2, "WEAVERVILLE"), R.IVAN(3, "REDDING"), R.IVAN(4, "REDDING"), R.VLAD(1, "CANNELLINA")];
        sc.meteo = Object.assign(sc.meteo, { vento_da_gradi: 270, vento_kt: 30, descrizione: "Vento da ovest 30 kt, mare mosso, buona visibilità sulla costa." });
        sc.obiettivi = [
          { tipo: "distruggi", target: ["NAVE_FAVA", "NAVE_CECE"], entro: "12:00", primario: true, testo: "Fermare lo sbarco: affondare 'Fava' e 'Cece' entro le 12:00" },
          { tipo: "sopprimi_sam", sam: ["SAN6"], primario: false, testo: "Neutralizzare la fregata 'Lenticchia' e il suo SA-N-6" },
          { tipo: "perdite_max", massimo: 3, primario: false, testo: "Non perdere più di 3 velivoli" }];
        brief(sc, "BLUE", { titolo: "Operazione SEA HAWK", situazione: "All'alba una flotta da sbarco del Fagiolistan è comparsa al largo di Humboldt Bay. Lo sbarco è previsto per mezzogiorno. La fregata 'Lenticchia' protegge le navi con un SAM navale a corto raggio. È l'unica occasione per fermarli in mare.",
          task: ["Affondare le navi 'Fava' e 'Cece' entro le 12:00", "Neutralizzare la fregata di scorta", "Massimo 3 velivoli persi"],
          threat: "SA-N-6 sulla fregata (raggio 15 NM, 8 missili), Su-35 dalla base avanzata di Weaverville e da Redding in CAP sopra la costa.", intel: ["Le navi da sbarco richiedono 6 GBU, la fregata 4", "Le CAP RED arriveranno sulla costa dalle 10:00"],
          da_sapere: DA_SAPERE_BLUE("09:00", "13:00"), output_plan: ["Ordine di attacco: scorta o navi da sbarco?", "Copertura Growler sulla flotta", "Chi tiene lontani i Su-35"] });
        brief(sc, "RED", { titolo: "Operazione GRAND LANDING", situazione: "La flotta è in posizione. Lo sbarco inizia alle 12:00: fino ad allora le navi sono vulnerabili. Proteggetele con le CAP sulla costa.",
          task: ["Proteggere 'Fava' e 'Cece' fino alle 12:00", "Difendere la fregata 'Lenticchia'"], threat: "F-15E, Typhoon, F-16 con GBU, F-22 e Growler dalla base di Taccola.", intel: ["Il nemico deve attraversare il mare aperto: niente rilievi dove nascondersi"],
          da_sapere: DA_SAPERE_RED("09:00", "13:00", ["Weaverville è a soli 10 minuti di volo dalla costa"]), output_plan: ["CAP Costa: chi e quando", "Prontezza a Weaverville", "Commit"] });
      },
      demo: { redRitardo: 60,
        blue: { formazioni: {
          GROWLER:   { decollo: "09:25", tanker: "AAR_SUD", aar_ordine: 1, gate_in: "GATE_C", push: "10:00", stazione: { lat: 41.05, lon: -124.55 }, cap_min: 30, gate_out: "GATE_C" },
          TITAN:     { decollo: "09:30", tanker: "AAR_NORD", aar_ordine: 1, gate_in: "GATE_N", push: "10:00", cap: "CAPB_MARE", cap_min: 25, gate_out: "GATE_N" },
          ROMA:      { decollo: "09:35", tanker: "AAR_SUD", aar_ordine: 2, gate_in: "GATE_C", push: "10:08", target: "NAVE_LENT", gate_out: "GATE_C" },
          GLADIATOR: { decollo: "09:40", tanker: "AAR_NORD", aar_ordine: 2, gate_in: "GATE_C", push: "10:15", target: "NAVE_FAVA", target2: "NAVE_CECE", gate_out: "GATE_S" },
          CENTURION: { decollo: "09:45", tanker: "AAR_SUD", aar_ordine: 3, gate_in: "GATE_S", push: "10:20", target: "NAVE_CECE", gate_out: "GATE_S" } } },
        red: { cap: [{ box: "CAP_COSTA", formazione: "IVAN1", da: "09:30", a: "11:30" }, { box: "CAP_COSTA", formazione: "IVAN2", da: "11:00", a: "13:00" }, { box: "CAP2", formazione: "IVAN3", da: "09:00", a: "11:00" }], prontezza: ["IVAN4", "VLADIMIR1"], sam_moves: [], commit_nm: 45 },
        passi: ["<b>SEA HAWK · anti-nave.</b> La minaccia viene verso di noi: la flotta sbarca a mezzogiorno. Le navi sono in mare aperto, la fregata le difende con un SAM navale.",
          "<b>Il piano.</b> ROMA colpisce per prima la fregata per spegnere il SAM; GLADIATOR e CENTURION vanno sulle navi da sbarco. TITAN tiene lontani i Su-35 sopra la costa.",
          "<b>Esecuzione.</b> Se la fregata cade, SAM SOPPRESSA: da quel momento le navi da sbarco sono indifese."] } },

    { id: "M04", codice: "SHADOW HUNT", titolo: "Shadow Hunt · caccia ai lanciatori mobili", tipo: "Time Sensitive Targeting", difficolta: 4, durata: "6 h",
      focus: "Agilità: pianificare l'imprevedibile, tenere una riserva, decidere in pochi secondi.",
      descrizione: "Tre lanciatori mobili compaiono solo per 45 minuti ciascuno, in posti diversi. Chi arriva fuori finestra non trova nulla. Servono riserve in volo e il target assign manuale.",
      domande: ["Avete tenuto una riserva o avete impegnato tutto subito?", "Chi poteva riassegnare un bersaglio in volo, e l'ha fatto?", "Quanto tempo è servito per decidere dopo un POP-UP?"],
      applica: sc => {
        Object.assign(sc.tempo, { inizio: "09:00", fine: "15:00" });
        sc.aar = [{ id: "AAR_NORD", nome: "AAR NORD – Tanker 1 (KC-30)", lat: 41.15, lon: -124.05, quota_ft: 25000, orient: 0, lunghezza_nm: 30 }, { id: "AAR_SUD", nome: "AAR SUD – Tanker 2 (KC-30)", lat: 40.55, lon: -124.05, quota_ft: 25000, orient: 0, lunghezza_nm: 30 }];
        sc.target = [
          T("TEL_1", "Lanciatore mobile 'Hat Creek'", 40.817, -121.473, 2, "lanciatore", "TEL con missili balistici: visibile solo dalle 10:30 alle 11:15", { finestra: { da: "10:30", a: "11:15" } }),
          T("TEL_2", "Lanciatore mobile 'Burney'", 40.882, -121.667, 2, "lanciatore", "Visibile solo dalle 11:45 alle 12:30", { finestra: { da: "11:45", a: "12:30" } }),
          T("TEL_3", "Lanciatore mobile 'Lassen'", 40.530, -121.600, 2, "lanciatore", "Visibile solo dalle 13:00 alle 13:45", { finestra: { da: "13:00", a: "13:45" } }),
          T("DEP_MISSILI", "Deposito missili Fall River Mills", 41.0188, -121.4335, 4, "deposito", "Rifornisce i lanciatori: fisso, sempre attaccabile")];
        sc.sam = [{ id: "SA10_D", nome: "SA-10 Lassen (mobile)", lat: 40.55, lon: -121.75, missili: 8, raggio_nm: 20 }];
        sc.cap_box = clone(SCENARIO_DEFAULT.cap_box).concat([{ id: "CAPB_E", nome: "CAP Blue Est (riserva)", lato: "BLUE", lat: 40.95, lon: -121.95, raggio_nm: 12 }]);
        sc.formazioni = [B.TITAN(), B.GLADIATOR(), B.ROMA(), B.CENTURION(), B.GROWLER(2), R.IVAN(1, "REDDING"), R.IVAN(2, "REDDING"), R.IVAN(3, "REDDING"), R.VLAD(1, "CANNELLINA"), R.VLAD(2, "CANNELLINA")];
        sc.obiettivi = [
          { tipo: "distruggi", target: ["TEL_1", "TEL_2", "TEL_3"], minimo: 2, primario: true, testo: "Distruggere almeno 2 lanciatori mobili su 3 durante le loro finestre" },
          { tipo: "distruggi", target: ["DEP_MISSILI"], primario: false, testo: "Distruggere il deposito missili di Fall River Mills" },
          { tipo: "perdite_max", massimo: 4, primario: false, testo: "Non perdere più di 4 velivoli" }];
        brief(sc, "BLUE", { titolo: "Operazione SHADOW HUNT", situazione: "Il Fagiolistan ha schierato lanciatori di missili balistici nell'altopiano a est del Lassen. Si spostano di continuo e si fermano solo per lanciare: l'intelligence li vede per 45 minuti alla volta. Vanno colpiti in quella finestra.",
          task: ["Distruggere almeno 2 lanciatori su 3 nelle loro finestre", "Distruggere il deposito missili di Fall River Mills", "Massimo 4 velivoli persi"],
          threat: "SA-10 Lassen (mobile, 20 NM) a protezione del lanciatore più a sud, Su-35 da Redding, Su-57 da Cannellina.", intel: ["Finestre stimate: Hat Creek 10:30–11:15, Burney 11:45–12:30, Lassen 13:00–13:45", "Una formazione in anticipo fino a 30' può aspettare sul target", "Ogni lanciatore richiede 2 GBU"],
          da_sapere: DA_SAPERE_BLUE("09:00", "15:00", ["I tanker sono più vicini alla costa: più autonomia utile a est", "Con il target assign manuale una formazione in volo può essere mandata su un lanciatore appena compare"]),
          output_plan: ["Chi copre ogni finestra", "La riserva: chi resta in volo e dove", "Chi decide le riassegnazioni in volo"] });
        brief(sc, "RED", { titolo: "Operazione HIDDEN ARROW", situazione: "I nostri lanciatori sono la nostra forza: il nemico non sa dove saranno. Proteggete le loro finestre di lancio.",
          task: ["Proteggere i lanciatori durante le finestre", "Difendere il deposito di Fall River"], threat: "Pacchetto della coalizione con riserve in volo e Growler.", intel: ["Finestre: 10:30, 11:45, 13:00 (45 minuti ciascuna)"],
          da_sapere: DA_SAPERE_RED("09:00", "15:00"), output_plan: ["CAP nelle finestre", "Prontezza", "SA-10 Lassen: dove metterla"] });
      },
      demo: { redRitardo: 60, prontezzaMax: 0,
        blue: { formazioni: {
          GROWLER:   { decollo: "12:10", tanker: "AAR_NORD", aar_ordine: 1, gate_in: "GATE_C", push: "12:32", stazione: { lat: 40.62, lon: -121.95 }, cap_min: 30, gate_out: "GATE_C" },
          GLADIATOR: { decollo: "09:55", tanker: "AAR_NORD", aar_ordine: 1, gate_in: "GATE_N", push: "10:15", target: "TEL_1", target2: "DEP_MISSILI", gate_out: "GATE_C" },
          TITAN:     { decollo: "10:00", tanker: "AAR_NORD", aar_ordine: 2, gate_in: "GATE_C", push: "10:23", cap: "CAPB_E", cap_min: 15, gate_out: "GATE_C" },
          ROMA:      { decollo: "11:10", tanker: "AAR_SUD", aar_ordine: 2, gate_in: "GATE_C", push: "11:28", target: "TEL_2", gate_out: "GATE_C" },
          CENTURION: { decollo: "12:25", tanker: "AAR_SUD", aar_ordine: 3, gate_in: "GATE_C", push: "12:49", target: "TEL_3", gate_out: "GATE_C" } } },
        red: { cap: [{ box: "CAP1", formazione: "IVAN1", da: "10:00", a: "12:00" }, { box: "CAP3", formazione: "IVAN2", da: "12:45", a: "14:45" }], prontezza: ["VLADIMIR1"], sam_moves: [], commit_nm: 50 },
        passi: ["<b>SHADOW HUNT · bersagli a tempo.</b> I lanciatori compaiono per 45 minuti e poi spariscono. Un attacco fuori finestra non trova nulla.",
          "<b>Il piano.</b> Una formazione per finestra, decolli scaglionati: GLADIATOR su Hat Creek e poi sul deposito, ROMA su Burney, CENTURION su Lassen con il Growler decollato apposta per coprirlo dal SA-10. TITAN resta in CAP a est come riserva.",
          "<b>Esecuzione.</b> Guardate gli avvisi POP-UP dell'intelligence: è il momento in cui il trainer può riassegnare un bersaglio con i tasti 🎯."] } },

    { id: "M05", codice: "NIGHT OWL", titolo: "Night Owl · strike notturno nel maltempo", tipo: "Strike notturno, meteo avverso", difficolta: 4, durata: "6 h (17–23)",
      focus: "Gestire il rischio con margini ridotti: carburante, meteo, stanchezza. Sapere quando rinunciare.",
      descrizione: "Di notte, con un fronte temporalesco sulla costa e vento da ovest a 60 nodi. Il rifornimento è più lento, i margini di carburante si assottigliano. Primario: il deposito carburante di Anderson.",
      domande: ["Avete ridotto le ambizioni del piano per il meteo o avete tenuto il piano del giorno?", "Chi aveva l'autorità di annullare una formazione?", "Quale margine di sicurezza avete scelto e perché?"],
      applica: sc => {
        Object.assign(sc.tempo, { inizio: "17:00", fine: "23:00" }); sc.aar = AAR_VICINI();
        sc.meteo = Object.assign(sc.meteo, { vento_da_gradi: 270, vento_kt: 60, temporali_costa: true, visibilita_target: "scarsa", descrizione: "Notte senza luna. Fronte temporalesco sulla costa fino a FL360: vento da ovest 60 kt in quota, turbolenza, rifornimento rallentato." });
        sc.inject = clone(SCENARIO_DEFAULT.inject).map(i => i.id === "temporale" ? Object.assign(i, { attivo: true }) : i);
        sc.target = [
          T("DEP_ANDERSON", "Deposito carburante di Anderson", 40.462, -122.315, 6, "deposito", "Alimenta le basi di Redding e Red Bluff"),
          T("SCALO_DUNSMUIR", "Scalo ferroviario di Dunsmuir", 41.211, -122.272, 5, "ferrovia", "Nodo logistico verso nord")];
        sc.sam = [SAM_STD("SA10_A"), SAM_STD("SA10_B")];
        sc.formazioni = [B.TITAN(), B.GLADIATOR(), B.CENTURION(), B.ROMA(), B.GROWLER(2), R.IVAN(1, "REDDING"), R.IVAN(2, "REDDING"), R.IVAN(3, "REDDING"), R.IVAN(4, "REDBLUFF"), R.VLAD(1, "CANNELLINA")];
        sc.agenda = [{ ora: "17:00", durata: 30, fase: "Briefing notturno" }, { ora: "17:30", durata: 60, fase: "Plan" }, { ora: "18:30", durata: 90, fase: "Execution" }, { ora: "20:00", durata: 60, fase: "Debrief" }];
        sc.obiettivi = [
          { tipo: "distruggi", target: ["DEP_ANDERSON"], primario: true, testo: "Distruggere il deposito carburante di Anderson" },
          { tipo: "distruggi", target: ["SCALO_DUNSMUIR"], primario: false, testo: "Distruggere lo scalo ferroviario di Dunsmuir" },
          { tipo: "perdite_max", massimo: 2, primario: true, testo: "Di notte la sicurezza viene prima: massimo 2 velivoli persi" }];
        brief(sc, "BLUE", { titolo: "Operazione NIGHT OWL", situazione: "Il Fagiolistan rifornisce le sue basi con un grande deposito ad Anderson. Di giorno è troppo difeso: si colpisce di notte, sfruttando il buio. Ma un fronte temporalesco sta arrivando dalla costa.",
          task: ["Distruggere il deposito di Anderson", "Se possibile, colpire lo scalo di Dunsmuir", "Massimo 2 velivoli persi"],
          threat: "2 SA-10 su Redding, Su-35 in prontezza notturna, Su-57 da Cannellina.", intel: ["Temporali sulla costa: rifornimento 15 minuti a formazione", "Vento da ovest 60 kt: andata veloce, ritorno lento"],
          da_sapere: DA_SAPERE_BLUE("17:00", "23:00", ["Inject Thunderstorm attivo dall'inizio: AAR +5 minuti, vento +15 kt"]), output_plan: ["Quante formazioni rischiare", "Margini di carburante al rientro", "Criteri di abort"] });
        brief(sc, "RED", { titolo: "Operazione DARK WATCH", situazione: "Di notte il nemico pensa di sorprenderci. Il deposito di Anderson è vitale: proteggetelo.", task: ["Difendere il deposito di Anderson", "Difendere lo scalo di Dunsmuir"],
          threat: "Strike notturno della coalizione.", intel: ["Il maltempo rallenta il nemico sulla costa"], da_sapere: DA_SAPERE_RED("17:00", "23:00"), output_plan: ["CAP notturne", "Prontezza", "SAM"] });
      },
      demo: { redRitardo: 60, prontezzaMax: 0,
        blue: { formazioni: {
          GROWLER:   { decollo: "17:40", tanker: "AAR_SUD", aar_ordine: 1, gate_in: "GATE_C", push: "18:04", stazione: { lat: 40.85, lon: -122.55 }, cap_min: 30, gate_out: "GATE_C" },
          TITAN:     { decollo: "17:45", tanker: "AAR_NORD", aar_ordine: 1, gate_in: "GATE_C", push: "18:04", cap: "CAPB_W", cap_min: 15, gate_out: "GATE_C" },
          GLADIATOR: { decollo: "17:50", tanker: "AAR_NORD", aar_ordine: 2, gate_in: "GATE_N", push: "18:16", target: "SCALO_DUNSMUIR", gate_out: "GATE_N" },
          ROMA:      { decollo: "17:50", tanker: "AAR_SUD", aar_ordine: 2, gate_in: "GATE_C", push: "18:12", target: "DEP_ANDERSON", gate_out: "GATE_C" } } },
        red: { cap: [{ box: "CAP2", formazione: "IVAN1", da: "17:00", a: "19:00" }, { box: "CAP1", formazione: "IVAN2", da: "18:00", a: "20:00" }], prontezza: ["IVAN3", "IVAN4", "VLADIMIR1"], sam_moves: [], commit_nm: 40 },
        passi: ["<b>NIGHT OWL · notte e maltempo.</b> Fronte temporalesco, vento da ovest a 60 nodi, rifornimento rallentato. La sicurezza è un obiettivo primario: massimo 2 velivoli persi.",
          "<b>Il piano prudente.</b> Solo quattro formazioni: niente CENTURION, l'F-16 ha i margini più stretti. ROMA sul deposito, GLADIATOR (il più autonomo) sullo scalo lontano, Growler e TITAN a protezione.",
          "<b>Esecuzione.</b> Osservate il carburante: il vento contrario al rientro trasforma un piano ottimista in un BINGO."] } },

    { id: "M06", codice: "AIR SUPERIORITY", titolo: "Air Superiority · conquista del cielo", tipo: "Fighter sweep (aria-aria)", difficolta: 3, durata: "6 h",
      focus: "Concentrazione delle forze e rischio calcolato: vincere senza bruciare la squadra.",
      descrizione: "Nessun bersaglio a terra: bisogna abbattere almeno 12 caccia nemici. Il kill ratio dipende da chi incontra chi: F-22 contro Su-35 è un vantaggio, F-16 contro Su-57 è una trappola.",
      domande: ["Avete scelto voi dove e contro chi combattere, o vi siete fatti scegliere?", "Avete concentrato le forze o le avete sparpagliate?", "Quando conviene NON ingaggiare?"],
      applica: sc => {
        Object.assign(sc.tempo, { inizio: "09:00", fine: "15:00" }); sc.aar = AAR_VICINI();
        sc.target = [];
        sc.formazioni = [B.TITAN(), F("RAPTOR", "F22", 4, "TACCOLA", "SWEEP"), B.GLADIATOR(), B.ROMA(), B.CENTURION(), B.GROWLER(2),
          R.IVAN(1, "REDDING"), R.IVAN(2, "REDDING"), R.IVAN(3, "REDDING"), R.IVAN(4, "REDBLUFF"), R.IVAN(5, "REDBLUFF"), R.IVAN(6, "REDBLUFF"), R.VLAD(1, "CANNELLINA"), R.VLAD(2, "CANNELLINA"), R.VLAD(3, "CANNELLINA")];
        sc.obiettivi = [
          { tipo: "abbattimenti", minimo: 12, primario: true, testo: "Abbattere almeno 12 velivoli nemici" },
          { tipo: "perdite_max", massimo: 12, primario: true, testo: "Non perdere più di 12 velivoli" },
          { tipo: "abbattimenti", minimo: 20, primario: false, testo: "Superiorità totale: almeno 20 abbattimenti" },
          { tipo: "perdite_max", massimo: 6, primario: false, testo: "Vittoria pulita: non più di 6 velivoli persi" }];
        brief(sc, "BLUE", { titolo: "Operazione CLEAR SKY", situazione: "Prima di qualsiasi altra operazione la coalizione deve conquistare la superiorità aerea sopra la valle di Redding. Oggi non si bombarda: si combatte in cielo.",
          task: ["Abbattere almeno 12 velivoli nemici", "Massimo 12 velivoli persi (vittoria pulita: 6)", "Obiettivo ambizioso: 20 abbattimenti"],
          threat: "24 Su-35 tra Redding e Red Bluff, 12 Su-57 a Cannellina, 3 SA-10.", intel: ["KR F-22 contro Su-35: 2. KR F-16 contro Su-57: 0,25", "I Su-57 decollano in 25 minuti"],
          da_sapere: DA_SAPERE_BLUE("09:00", "15:00", ["Le CAP blu hanno commit a 40 NM: scegliere i box giusti decide gli incontri"]), output_plan: ["Quali CAP, quando e con chi", "Chi evita i Su-57", "Rotazione con i tanker"] });
        brief(sc, "RED", { titolo: "Operazione IRON SKY", situazione: "Il nemico vuole il nostro cielo. Fategli pagare ogni minuto sopra il Fagiolistan.", task: ["Abbattere più velivoli di quanti ne perdiamo", "Proteggere Redding"],
          threat: "8 F-22, F-15E, Typhoon e F-16 in sweep.", intel: ["Nessun attacco a terra previsto: solo caccia"], da_sapere: DA_SAPERE_RED("09:00", "15:00"), output_plan: ["CAP", "Prontezza", "Uso dei Su-57"] });
      },
      demo: { redRitardo: 60, prontezzaMax: 1,
        blue: { formazioni: {
          GROWLER:   { decollo: "09:40", tanker: "AAR_SUD", aar_ordine: 1, gate_in: "GATE_C", push: "10:20", stazione: { lat: 40.70, lon: -122.95 }, cap_min: 30, gate_out: "GATE_C" },
          TITAN:     { decollo: "09:45", tanker: "AAR_NORD", aar_ordine: 1, gate_in: "GATE_C", push: "10:20", cap: "CAPB_W", cap_min: 25, gate_out: "GATE_C" },
          RAPTOR:    { decollo: "09:50", tanker: "AAR_NORD", aar_ordine: 2, gate_in: "GATE_S", push: "10:25", cap: "CAPB_S", cap_min: 12, gate_out: "GATE_S" },
          GLADIATOR: { decollo: "09:50", tanker: "AAR_SUD", aar_ordine: 2, gate_in: "GATE_C", push: "10:30", cap: "CAPB_W", cap_min: 40, gate_out: "GATE_C" },
          ROMA:      { decollo: "10:40", tanker: "AAR_SUD", aar_ordine: 3, gate_in: "GATE_N", push: "11:15", cap: "CAPB_N", cap_min: 15, gate_out: "GATE_N" },
          CENTURION: null } },
        red: { cap: [{ box: "CAP1", formazione: "IVAN1", da: "09:00", a: "11:00" }, { box: "CAP2", formazione: "IVAN2", da: "10:00", a: "12:00" }, { box: "CAP3", formazione: "IVAN4", da: "10:00", a: "12:00" }, { box: "CAP1", formazione: "VLADIMIR1", da: "11:00", a: "13:00" }, { box: "CAP2", formazione: "IVAN3", da: "12:00", a: "14:00" }, { box: "CAP3", formazione: "IVAN5", da: "12:00", a: "14:00" }], prontezza: ["IVAN6", "VLADIMIR2"], sam_moves: [], commit_nm: 60 },
        passi: ["<b>AIR SUPERIORITY · solo aria-aria.</b> Nessun bersaglio a terra: vince chi sceglie dove e contro chi combattere.",
          "<b>Il piano.</b> I due gruppi di F-22 aprono a ovest e a sud contro i Su-35; F-15E e Typhoon arrivano dopo per sfruttare il vantaggio; l'F-16 resta a terra: contro i Su-57 il suo kill ratio è 0,25.",
          "<b>Esecuzione.</b> Ogni ingaggio mostra la formula del kill ratio: guardate quanto pesa la scelta dell'avversario."] } },

    { id: "M07", codice: "SHIELD", titolo: "Shield · scorta in profondità", tipo: "Strike con scorta (proteggi il pacchetto)", difficolta: 4, durata: "6 h",
      focus: "I ruoli di supporto: il successo dipende da chi protegge chi colpisce. Fiducia e comunicazione tra team.",
      descrizione: "La base avanzata dei Su-57 ad Alturas è a 250 km dal confine: solo l'F-15E arriva fin lì. Il pacchetto GLADIATOR deve tornare a casa: la scorta di F-22 e il Growler ne rispondono.",
      domande: ["La scorta sapeva esattamente chi proteggere e fino a dove?", "Chi ha avuto il merito del risultato? E chi lo meritava?", "Nel vostro lavoro, chi fa la 'scorta' e viene riconosciuto?"],
      applica: sc => {
        Object.assign(sc.tempo, { inizio: "09:00", fine: "15:00" });
        sc.basi = BASI_STD().concat([{ id: "ALTURAS", nome: "Alturas (KAAT) – base avanzata Su-57", lato: "RED", lat: 41.4831, lon: -120.5654, nazione: "Fagiolistan", pista_ft: 4300 }]);
        sc.aar = [{ id: "AAR_NORD", nome: "AAR NORD – Tanker 1 (KC-30)", lat: 41.60, lon: -124.05, quota_ft: 25000, orient: 0, lunghezza_nm: 30 }, { id: "AAR_SUD", nome: "AAR SUD – Tanker 2 (KC-30)", lat: 41.10, lon: -124.05, quota_ft: 25000, orient: 0, lunghezza_nm: 30 }];
        sc.target = [
          T("ALT_PISTA", "Base aerea di Alturas", 41.4831, -120.5654, 6, "aeroporto", "Pista e rampa dei Su-57 avanzati"),
          T("ALT_RADAR", "Radar di Alturas", 41.505, -120.610, 2, "radar", "Radar di controllo della base")];
        sc.sam = [{ id: "SA10_E", nome: "SA-10 Alturas", lat: 41.40, lon: -120.75, missili: 8, raggio_nm: 30 }];
        sc.cap_box = [{ id: "CAP_E", nome: "CAP Est (Alturas)", lato: "RED", lat: 41.60, lon: -121.10, raggio_nm: 12 }, { id: "CAP1", nome: "CAP 1 (Nord)", lato: "RED", lat: 41.00, lon: -122.35, raggio_nm: 12 },
          { id: "CAPB_E", nome: "CAP Blue Est (scorta)", lato: "BLUE", lat: 41.48, lon: -121.25, raggio_nm: 12 }, { id: "CAPB_N", nome: "CAP Blue Nord", lato: "BLUE", lat: 41.30, lon: -122.60, raggio_nm: 12 }];
        sc.formazioni = [B.GLADIATOR(), B.TITAN(), B.GROWLER(2), B.ROMA(), R.VLAD(1, "ALTURAS"), R.VLAD(2, "ALTURAS"), R.VLAD(3, "CANNELLINA"), R.IVAN(1, "REDDING"), R.IVAN(2, "REDDING")];
        sc.obiettivi = [
          { tipo: "distruggi", target: ["ALT_PISTA"], primario: true, testo: "Distruggere la base avanzata di Alturas" },
          { tipo: "proteggi", formazioni: ["GLADIATOR"], perdite_max: 1, primario: true, testo: "Riportare a casa GLADIATOR: al massimo 1 velivolo perso" },
          { tipo: "proteggi", formazioni: ["GROWLER"], perdite_max: 0, primario: false, testo: "Nessuna perdita per il Growler" },
          { tipo: "distruggi", target: ["ALT_RADAR"], primario: false, testo: "Distruggere il radar di Alturas" }];
        brief(sc, "BLUE", { titolo: "Operazione SHIELD", situazione: "Il Fagiolistan ha spostato i Su-57 ad Alturas, fuori dalla portata dei nostri caccia leggeri. Solo l'F-15E può arrivare. Ma un F-15E carico di bombe, da solo, contro i Su-57 non torna: serve uno scudo.",
          task: ["Distruggere la base di Alturas", "Riportare a casa GLADIATOR (max 1 perso)", "Proteggere il Growler"],
          threat: "8 Su-57 ad Alturas, 4 a Cannellina, SA-10 Alturas (30 NM), Su-35 da Redding.", intel: ["Distanza confine–Alturas circa 135 NM", "F-22 e Typhoon hanno 50' di autonomia dopo l'AAR: la scorta può restare poco"],
          da_sapere: DA_SAPERE_BLUE("09:00", "15:00", ["Tanker più a nord e più vicini al confine"]), output_plan: ["Chi scorta GLADIATOR e dove", "Sincronizzazione scorta-strike", "Rientro insieme"] });
        brief(sc, "RED", { titolo: "Operazione FAR SHIELD", situazione: "Ad Alturas i nostri Su-57 sono al sicuro: il nemico dovrà fare un viaggio lunghissimo per raggiungerli. Fategli pagare la distanza.", task: ["Difendere Alturas", "Abbattere i bombardieri F-15E"],
          threat: "F-15E con GBU, F-22 di scorta, Growler.", intel: ["Solo l'F-15E ha l'autonomia per arrivare ad Alturas"], da_sapere: DA_SAPERE_RED("09:00", "15:00", ["Su-57 in prontezza ad Alturas: pronti in 25'"]), output_plan: ["CAP Est", "Prontezza ad Alturas", "SA-10 Alturas"] });
      },
      demo: { prontezzaMax: 0,
        blue: { formazioni: {
          GROWLER:   { decollo: "09:40", tanker: "AAR_SUD", aar_ordine: 1, gate_in: "GATE_N", push: "10:06", stazione: { lat: 41.55, lon: -121.20 }, cap_min: 30, gate_out: "GATE_N" },
          TITAN:     { decollo: "09:45", tanker: "AAR_NORD", aar_ordine: 2, gate_in: "GATE_N", push: "10:09", cap: "CAPB_E", cap_min: 15, gate_out: "GATE_N" },
          GLADIATOR: { decollo: "09:45", tanker: "AAR_NORD", aar_ordine: 1, gate_in: "GATE_N", push: "10:12", target: "ALT_PISTA", target2: "ALT_RADAR", gate_out: "GATE_N" },
          ROMA:      { decollo: "09:50", tanker: "AAR_SUD", aar_ordine: 2, gate_in: "GATE_N", push: "10:09", cap: "CAPB_N", cap_min: 20, gate_out: "GATE_N" } } },
        red: { cap: [{ box: "CAP_E", formazione: "VLADIMIR1", da: "11:00", a: "13:00" }, { box: "CAP1", formazione: "IVAN1", da: "09:00", a: "11:00" }], prontezza: ["IVAN2"], sam_moves: [], commit_nm: 50 },
        passi: ["<b>SHIELD · scorta in profondità.</b> Solo l'F-15E arriva ad Alturas. L'obiettivo primario è doppio: distruggere la base e riportare a casa GLADIATOR.",
          "<b>Il piano.</b> TITAN e Growler entrano con GLADIATOR e lo coprono sopra il bersaglio; ROMA tiene la CAP a nord per proteggere il rientro.",
          "<b>Esecuzione.</b> Guardate gli eventi ESCORT: è la scorta che prende il merge al posto del pacchetto d'attacco. In questa demo il RED ha lasciato i Su-57 di Alturas a terra senza prontezza: un errore da discutere nel debrief."] } },

    { id: "M08", codice: "NORTHERN STAR", titolo: "Northern Star · un solo tanker", tipo: "OCA con risorse scarse", difficolta: 3, durata: "6 h",
      focus: "Risorse scarse: un solo tanker per cinque formazioni. Negoziare, sequenziare, accettare di non avere tutto.",
      descrizione: "Attacco alla base dei Su-57 di Cannellina (Klamath Falls) con un unico tanker: dieci minuti a formazione, una alla volta. L'ordine di rifornimento decide l'ora d'attacco di tutti.",
      domande: ["Chi ha deciso l'ordine al tanker e con quale criterio?", "Qualcuno ha rinunciato a qualcosa per il team?", "Come gestite in azienda una risorsa condivisa e scarsa?"],
      applica: sc => {
        Object.assign(sc.tempo, { inizio: "09:00", fine: "15:00" });
        sc.aar = [{ id: "AAR_UNICO", nome: "AAR UNICO – Tanker 1 (KC-30)", lat: 41.75, lon: -124.05, quota_ft: 25000, orient: 0, lunghezza_nm: 30 }];
        sc.inject = clone(SCENARIO_DEFAULT.inject).filter(i => i.id !== "tanker_fallout");
        sc.gate = [{ id: "GATE_NN", nome: "Gate NORD-NORD", lat: 41.95, lon: -123.55 }, { id: "GATE_N", nome: "Gate NORD", lat: 41.55, lon: -123.60 }, { id: "GATE_C", nome: "Gate CENTRO", lat: 40.85, lon: -123.72 }];
        sc.target = [
          T("KLA_PISTA", "Pista di Cannellina (Klamath Falls)", 42.1561, -121.7333, 8, "aeroporto", "Pista principale dei Su-57"),
          T("KLA_HANGAR", "Hangar Su-57 di Cannellina", 42.1650, -121.7450, 4, "hangar", "Shelter dei Su-57"),
          T("KLA_MUNIZ", "Deposito munizioni di Cannellina", 42.1350, -121.7000, 3, "deposito", "Missili aria-aria e bombe")];
        sc.sam = [{ id: "SA10_N", nome: "SA-10 Cannellina", lat: 42.05, lon: -121.95, missili: 10, raggio_nm: 35 }];
        sc.cap_box = [{ id: "CAP_N", nome: "CAP Nord (Cannellina)", lato: "RED", lat: 41.95, lon: -122.30, raggio_nm: 12 }, { id: "CAP1", nome: "CAP 1 (Nord)", lato: "RED", lat: 41.00, lon: -122.35, raggio_nm: 12 },
          { id: "CAPB_N", nome: "CAP Blue Nord", lato: "BLUE", lat: 41.75, lon: -122.55, raggio_nm: 12 }];
        sc.formazioni = [B.TITAN(), B.GLADIATOR(), B.ROMA(), B.CENTURION(), B.GROWLER(2), R.VLAD(1, "CANNELLINA"), R.VLAD(2, "CANNELLINA"), R.VLAD(3, "CANNELLINA"), R.IVAN(1, "REDDING"), R.IVAN(2, "REDDING")];
        sc.obiettivi = [
          { tipo: "distruggi", target: ["KLA_PISTA", "KLA_HANGAR"], primario: true, testo: "Distruggere pista e hangar dei Su-57 di Cannellina" },
          { tipo: "distruggi", target: ["KLA_MUNIZ"], primario: false, testo: "Distruggere il deposito munizioni" },
          { tipo: "perdite_max", massimo: 5, primario: false, testo: "Non perdere più di 5 velivoli" }];
        brief(sc, "BLUE", { titolo: "Operazione NORTHERN STAR", situazione: "I Su-57 di Cannellina sono la minaccia più seria per la coalizione. Oggi si colpisce la loro base. Ma uno dei due tanker è in manutenzione: tutto il pacchetto dovrà rifornirsi da un solo KC-30.",
          task: ["Distruggere pista e hangar di Cannellina", "Distruggere il deposito munizioni", "Massimo 5 velivoli persi"],
          threat: "12 Su-57 a Cannellina, SA-10 Cannellina (35 NM), Su-35 da Redding.", intel: ["Un solo tanker: 10 minuti a formazione, chi aspetta consuma", "La pista richiede 8 GBU, l'hangar 4, il deposito 3"],
          da_sapere: DA_SAPERE_BLUE("09:00", "15:00", ["Un solo tanker (AAR UNICO): la coda si allunga, le formazioni in attesa bruciano carburante"]), output_plan: ["Ordine al tanker", "TOT di ogni formazione", "Chi rinuncia se la coda si allunga"] });
        brief(sc, "RED", { titolo: "Operazione NORTH WALL", situazione: "Il nemico punta ai nostri Su-57 a Cannellina. Ha un solo tanker: arriverà a ondate, non tutto insieme. Colpitelo una formazione alla volta.", task: ["Difendere pista e hangar di Cannellina", "Abbattere le formazioni in arrivo"],
          threat: "Pacchetto completo della coalizione, un solo tanker.", intel: ["Il nemico arriverà scaglionato"], da_sapere: DA_SAPERE_RED("09:00", "15:00"), output_plan: ["CAP Nord", "Prontezza a Cannellina", "SA-10"] });
      },
      demo: { redRitardo: 60, prontezzaMax: 0,
        blue: { formazioni: {
          GROWLER:   { decollo: "09:35", tanker: "AAR_UNICO", aar_ordine: 2, gate_in: "GATE_NN", push: "10:00", stazione: { lat: 42.00, lon: -122.10 }, cap_min: 30, gate_out: "GATE_NN" },
          TITAN:     { decollo: "09:30", tanker: "AAR_UNICO", aar_ordine: 1, gate_in: "GATE_NN", push: "09:46", cap: "CAPB_N", cap_min: 25, gate_out: "GATE_NN" },
          GLADIATOR: { decollo: "09:40", tanker: "AAR_UNICO", aar_ordine: 3, gate_in: "GATE_NN", push: "10:04", target: "KLA_PISTA", gate_out: "GATE_NN" },
          ROMA:      { decollo: "09:55", tanker: "AAR_UNICO", aar_ordine: 4, gate_in: "GATE_NN", push: "10:14", target: "KLA_HANGAR", gate_out: "GATE_NN" },
          CENTURION: { decollo: "10:05", tanker: "AAR_UNICO", aar_ordine: 5, gate_in: "GATE_N", push: "10:24", target: "KLA_MUNIZ", gate_out: "GATE_N" } } },
        red: { cap: [{ box: "CAP_N", formazione: "VLADIMIR1", da: "09:30", a: "11:30" }, { box: "CAP1", formazione: "IVAN1", da: "09:00", a: "11:00" }, { box: "CAP_N", formazione: "VLADIMIR2", da: "11:00", a: "13:00" }], prontezza: ["VLADIMIR3", "IVAN2"], sam_moves: [], commit_nm: 50 },
        passi: ["<b>NORTHERN STAR · un solo tanker.</b> Cinque formazioni, un KC-30, dieci minuti a testa. L'ordine di rifornimento è la decisione che condiziona tutte le altre.",
          "<b>Il piano.</b> Prima TITAN, che ripulisce il settore nord, poi il Growler che copre dal SA-10; poi GLADIATOR sulla pista, ROMA sull'hangar, CENTURION per ultimo sul deposito.",
          "<b>Esecuzione.</b> Guardate la coda al tanker e le formazioni in attesa: ogni minuto di coda è carburante che manca sul bersaglio."] } },

    { id: "M09", codice: "CONVOY", titolo: "Convoy · fermare la colonna corazzata", tipo: "Interdizione su bersaglio in movimento", difficolta: 3, durata: "5 h",
      focus: "Pianificare su un bersaglio che si muove: anticipare, non inseguire. L'intelligence vale quanto le bombe.",
      descrizione: "Una colonna corazzata scende lungo la I-5: Montague alle 10:00, Weed alle 10:45, Dunsmuir alle 11:30. I danni restano: si può colpirla in più tappe. Va fermata prima delle 12:15.",
      domande: ["Dove avete deciso di intercettare la colonna, e perché lì?", "Avete inseguito il bersaglio o l'avete anticipato?", "Che valore avete dato alle informazioni di intelligence?"],
      applica: sc => {
        Object.assign(sc.tempo, { inizio: "09:00", fine: "14:00" });
        sc.aar = [{ id: "AAR_NORD", nome: "AAR NORD – Tanker 1 (KC-30)", lat: 41.60, lon: -124.15, quota_ft: 25000, orient: 0, lunghezza_nm: 30 }, { id: "AAR_SUD", nome: "AAR SUD – Tanker 2 (KC-30)", lat: 41.15, lon: -124.15, quota_ft: 25000, orient: 0, lunghezza_nm: 30 }];
        const conv = { gruppo: "CONVOGLIO" };
        sc.target = [
          T("CONV_1", "Colonna corazzata – Montague", 41.730, -122.550, 6, "convoglio", "Prima tappa della colonna (10:00–10:45)", Object.assign({ finestra: { da: "10:00", a: "10:45" } }, conv)),
          T("CONV_2", "Colonna corazzata – Weed", 41.420, -122.400, 6, "convoglio", "Seconda tappa (10:45–11:30)", Object.assign({ finestra: { da: "10:45", a: "11:30" } }, conv)),
          T("CONV_3", "Colonna corazzata – Dunsmuir", 41.215, -122.285, 6, "convoglio", "Ultima tappa prima della valle (11:30–12:15)", Object.assign({ finestra: { da: "11:30", a: "12:15" } }, conv)),
          T("SCALO_DUNSMUIR", "Scalo ferroviario di Dunsmuir", 41.211, -122.272, 5, "ferrovia", "Dove la colonna dovrebbe imbarcarsi")];
        sc.sam = [{ id: "SA10_M", nome: "SA-10 Mount Shasta", lat: 41.32, lon: -122.31, missili: 8, raggio_nm: 30 }];
        sc.cap_box = [{ id: "CAP_SHASTA", nome: "CAP Shasta (scorta colonna)", lato: "RED", lat: 41.45, lon: -122.60, raggio_nm: 12 }, { id: "CAP1", nome: "CAP 1 (Nord)", lato: "RED", lat: 41.00, lon: -122.35, raggio_nm: 12 },
          { id: "CAPB_N", nome: "CAP Blue Nord", lato: "BLUE", lat: 41.62, lon: -122.95, raggio_nm: 12 }];
        sc.formazioni = [B.TITAN(), B.GLADIATOR(), B.ROMA(), B.CENTURION(), B.GROWLER(2), R.IVAN(1, "REDDING"), R.IVAN(2, "REDDING"), R.IVAN(3, "REDDING"), R.VLAD(1, "CANNELLINA"), R.VLAD(2, "CANNELLINA")];
        sc.obiettivi = [
          { tipo: "distruggi", target: ["CONV_1", "CONV_2", "CONV_3"], minimo: 1, entro: "12:15", primario: true, testo: "Fermare la colonna corazzata prima delle 12:15" },
          { tipo: "distruggi", target: ["SCALO_DUNSMUIR"], primario: false, testo: "Distruggere lo scalo ferroviario di Dunsmuir" },
          { tipo: "perdite_max", massimo: 3, primario: false, testo: "Non perdere più di 3 velivoli" }];
        brief(sc, "BLUE", { titolo: "Operazione CONVOY", situazione: "Una colonna corazzata del Fagiolistan scende da Cannellina lungo la I-5. Se arriva a Dunsmuir si imbarca sul treno e in poche ore sarà in valle. L'intelligence ne conosce le tappe: è l'occasione per fermarla.",
          task: ["Fermare la colonna prima delle 12:15", "Distruggere lo scalo di Dunsmuir", "Massimo 3 velivoli persi"],
          threat: "SA-10 Mount Shasta (30 NM) a protezione delle ultime tappe, CAP di Su-35 sopra la colonna, Su-57 da Cannellina.", intel: ["Tappe: Montague 10:00–10:45, Weed 10:45–11:30, Dunsmuir 11:30–12:15", "La colonna richiede 6 GBU: i danni si sommano tra una tappa e l'altra"],
          da_sapere: DA_SAPERE_BLUE("09:00", "14:00", ["Più a sud la colonna è dentro il ring della SA-10 Mount Shasta"]), output_plan: ["Dove intercettare la colonna", "Chi colpisce in quale tappa", "Copertura Growler sulle tappe protette"] });
        brief(sc, "RED", { titolo: "Operazione STEEL COLUMN", situazione: "La colonna deve arrivare a Dunsmuir. Scortatela lungo la I-5: le prime tappe sono le più esposte.", task: ["Portare la colonna a Dunsmuir entro le 12:15", "Proteggere lo scalo"],
          threat: "Strike della coalizione sulla I-5.", intel: ["Il nemico conosce le nostre tappe?"], da_sapere: DA_SAPERE_RED("09:00", "14:00", ["La SA-10 Mount Shasta copre Weed e Dunsmuir, non Montague"]), output_plan: ["CAP sulla colonna", "Prontezza", "Posizione SA-10"] });
      },
      demo: { prontezzaMax: 0,
        blue: { formazioni: {
          GROWLER:   { decollo: "09:25", tanker: "AAR_SUD", aar_ordine: 1, gate_in: "GATE_N", push: "09:58", stazione: { lat: 41.55, lon: -122.85 }, cap_min: 30, gate_out: "GATE_N" },
          TITAN:     { decollo: "09:30", tanker: "AAR_NORD", aar_ordine: 1, gate_in: "GATE_N", push: "10:00", cap: "CAPB_N", cap_min: 20, gate_out: "GATE_N" },
          GLADIATOR: { decollo: "09:35", tanker: "AAR_NORD", aar_ordine: 2, gate_in: "GATE_N", push: "10:05", target: "CONV_1", gate_out: "GATE_N" },
          ROMA:      { decollo: "10:05", tanker: "AAR_NORD", aar_ordine: 3, gate_in: "GATE_N", push: "10:25", target: "SCALO_DUNSMUIR", gate_out: "GATE_N" },
          CENTURION: { decollo: "10:20", tanker: "AAR_SUD", aar_ordine: 2, gate_in: "GATE_N", push: "10:37", target: "CONV_2", gate_out: "GATE_N" } } },
        red: { cap: [{ box: "CAP_SHASTA", formazione: "IVAN1", da: "09:30", a: "11:30" }, { box: "CAP1", formazione: "IVAN2", da: "10:00", a: "12:00" }], prontezza: ["IVAN3", "VLADIMIR1", "VLADIMIR2"], sam_moves: [], commit_nm: 45 },
        passi: ["<b>CONVOY · bersaglio in movimento.</b> La colonna passa da Montague, Weed e Dunsmuir: ogni tappa è aperta 45 minuti. I danni si sommano da una tappa all'altra.",
          "<b>Il piano.</b> Anticipare, non inseguire: GLADIATOR colpisce a Montague, fuori dal ring del SAM; CENTURION completa a Weed se serve; ROMA si occupa dello scalo.",
          "<b>Esecuzione.</b> Quando la colonna è fermata compare l'evento SHACK: le tappe successive spariscono."] } },

    { id: "M10", codice: "FULL SPECTRUM", titolo: "Full Spectrum · campagna combinata", tipo: "Missione composita in due ondate", difficolta: 5, durata: "12 h",
      focus: "Integrazione e priorità: tanti obiettivi, risorse limitate, delega ai capi formazione.",
      descrizione: "Tutto insieme: C2, difese aeree, ponte, deposito e aeroporto di Redding, in due ondate. Non si può fare tutto: vince chi sceglie bene le priorità e le comunica.",
      domande: ["Come avete deciso cosa lasciare fuori?", "Il piano della seconda ondata dipendeva dai risultati della prima?", "Quanto avete delegato ai capi formazione?"],
      applica: sc => {
        sc.aar = AAR_VICINI();
        sc.target = [clone(SCENARIO_DEFAULT.target[1]), clone(SCENARIO_DEFAULT.target[0]),
          T("RAD_A", "Radar di tiro SA-10 Redding Nord", 40.586, -122.214, 2, "radar", "Distruggerlo spegne la SA-10 Redding Nord", { sam: "SA10_A" }),
          T("PONTE_PIT", "Ponte Pit River (I-5)", 40.7543, -122.3196, 4, "ponte", "Linea di rifornimento da nord"),
          T("DEP_ANDERSON", "Deposito carburante di Anderson", 40.462, -122.315, 6, "deposito", "Carburante per Redding e Red Bluff")];
        sc.target[0].categoria = "c2"; sc.target[1].categoria = "aeroporto";
        sc.obiettivi = [
          { tipo: "distruggi", target: ["TGT_C2"], primario: true, testo: "Distruggere il C2 di Redding" },
          { tipo: "sopprimi_sam", sam: ["SA10_A", "SA10_B", "SA10_C"], minimo: 1, primario: true, testo: "Sopprimere almeno una batteria SA-10" },
          { tipo: "distruggi", target: ["TGT_REDDING", "PONTE_PIT", "DEP_ANDERSON"], minimo: 2, primario: false, testo: "Distruggere almeno 2 tra aeroporto, ponte e deposito" },
          { tipo: "abbattimenti", minimo: 8, primario: false, testo: "Abbattere almeno 8 velivoli nemici" },
          { tipo: "perdite_max", massimo: 8, primario: false, testo: "Non perdere più di 8 velivoli" }];
        brief(sc, "BLUE", { titolo: "Operazione FULL SPECTRUM", situazione: "È il giorno decisivo della campagna. Il comando chiede di colpire il C2, aprire un varco nelle difese aeree e tagliare la logistica di Redding. Le risorse bastano per due ondate, non per tutto.",
          task: ["Distruggere il C2 di Redding", "Sopprimere almeno una batteria SA-10", "Distruggere almeno 2 tra aeroporto, ponte e deposito", "Abbattere almeno 8 velivoli, massimo 8 persi"],
          threat: "Difesa completa: 24 Su-35, 12 Su-57, 3 SA-10.", intel: ["Il radar di tiro della SA-10 Nord richiede 2 GBU", "Dopo il turnaround (2 h) torna in volo il 75% di ogni formazione"],
          output_plan: ["Priorità degli obiettivi", "Prima ondata: chi, cosa, quando", "Seconda ondata (decollo2) e criteri per cambiarla", "Deleghe ai capi formazione"] });
      },
      demo: { redRitardo: 60, prontezzaMax: 0,
        blue: { formazioni: {
          GROWLER:   { decollo: "09:40", tanker: "AAR_SUD", aar_ordine: 1, gate_in: "GATE_C", push: "10:25", stazione: { lat: 40.50, lon: -122.85 }, cap_min: 30, gate_out: "GATE_C", decollo2: "13:30" },
          TITAN:     { decollo: "09:50", tanker: "AAR_NORD", aar_ordine: 1, gate_in: "GATE_C", push: "10:25", cap: "CAPB_W", cap_min: 20, gate_out: "GATE_C", decollo2: "13:40" },
          CENTURION: { decollo: "09:45", tanker: "AAR_SUD", aar_ordine: 2, gate_in: "GATE_C", push: "10:30", target: "RAD_A", gate_out: "GATE_C", decollo2: "13:45" },
          GLADIATOR: { decollo: "09:50", tanker: "AAR_NORD", aar_ordine: 2, gate_in: "GATE_C", push: "10:35", target: "TGT_C2", target2: "PONTE_PIT", gate_out: "GATE_S" },
          ROMA:      { decollo: "10:00", tanker: "AAR_SUD", aar_ordine: 3, gate_in: "GATE_S", push: "10:38", target: "DEP_ANDERSON", gate_out: "GATE_S", decollo2: "14:00" } } },
        red: clone(null),
        passi: ["<b>FULL SPECTRUM · tutto insieme.</b> Cinque obiettivi, due ondate, le stesse forze di sempre. Il punto non è fare tutto: è scegliere.",
          "<b>Il piano.</b> Prima ondata: CENTURION apre il varco sul radar Nord, GLADIATOR colpisce C2 e ponte, ROMA il deposito. Nel pomeriggio le stesse formazioni ripartono con il 75% dei velivoli.",
          "<b>Esecuzione.</b> Osservate il riquadro Obiettivi: primari e secondari si accendono uno alla volta."] } }
    ,
    { id: "M11", codice: "NIGHT STALKER", titolo: "Night Stalker · incursione notturna con visori NVG", tipo: "Strike notturno a bassa luminosità", difficolta: 4, durata: "2 h 30 (21:30–24:00)",
      focus: "Operare al buio: fidarsi degli strumenti e dei compagni, comunicazione essenziale, disciplina delle luci.",
      descrizione: "Notte senza luna. Gli elicotteri d'assalto di Benton decolleranno alle 23:00 per un'incursione: vanno colpiti a terra prima. Nella vista 3D (camera cockpit) e nel Free Flight notturno si vola con il visore NVG.",
      domande: ["Al buio avete semplificato il piano o lo avete tenuto uguale a quello diurno?", "Quali informazioni sono diventate essenziali senza vedere?", "Come avete gestito la fiducia reciproca quando nessuno vedeva gli altri?"],
      applica: sc => {
        Object.assign(sc.tempo, { inizio: "21:30", fine: "23:59" }); sc.aar = AAR_VICINI();
        sc.meteo = Object.assign(sc.meteo, { vento_da_gradi: 60, vento_kt: 25, temporali_costa: false, visibilita_target: "notte senza luna", descrizione: "Notte senza luna, cielo sereno, vento da nord-est 25 kt. Si vola con i visori notturni (NVG)." });
        sc.target = [
          T("BENTON_HELO", "Elicotteri d'assalto di Benton", 40.5747, -122.4077, 6, "elicotteri", "Mi-24 e Mi-17 pronti al decollo alle 23:00: colpirli a terra", { finestra: { da: "21:30", a: "23:00" } }),
          T("RAD_EW", "Radar di scoperta Black Butte", 41.366, -122.338, 3, "radar", "Vede chi arriva da nord"),
          T("DEP_ANDERSON", "Deposito carburante di Anderson", 40.462, -122.315, 6, "deposito", "Rifornisce gli elicotteri")];
        sc.target[0].categoria = "helo";
        sc.sam = [SAM_STD("SA10_B")];
        sc.formazioni = [B.TITAN(), B.GLADIATOR(), B.ROMA(), B.GROWLER(2), R.IVAN(1, "REDDING"), R.IVAN(2, "REDDING"), R.IVAN(4, "REDBLUFF"), R.VLAD(1, "CANNELLINA")];
        sc.agenda = [{ ora: "21:30", durata: 20, fase: "Briefing notturno" }, { ora: "21:50", durata: 40, fase: "Plan" }, { ora: "22:30", durata: 60, fase: "Execution con NVG" }, { ora: "23:30", durata: 30, fase: "Debrief" }];
        sc.obiettivi = [
          { tipo: "distruggi", target: ["BENTON_HELO"], entro: "23:00", primario: true, testo: "Distruggere gli elicotteri di Benton prima del decollo (23:00)" },
          { tipo: "perdite_max", massimo: 2, primario: true, testo: "Al buio la sicurezza viene prima: massimo 2 velivoli persi" },
          { tipo: "distruggi", target: ["RAD_EW", "DEP_ANDERSON"], minimo: 1, primario: false, testo: "Colpire il radar di Black Butte o il deposito di Anderson" }];
        brief(sc, "BLUE", { titolo: "Operazione NIGHT STALKER", situazione: "L'intelligence ha scoperto che alle 23:00 gli elicotteri d'assalto di Benton partiranno per un'incursione oltre il confine. Di giorno la base è inavvicinabile; di notte, senza luna, la coalizione ha un vantaggio: i visori notturni.",
          task: ["Distruggere gli elicotteri di Benton prima delle 23:00", "Massimo 2 velivoli persi", "Se possibile, colpire il radar di Black Butte o il deposito di Anderson"],
          threat: "SA-10 Redding Sud (40 NM), Su-35 di Redding e Red Bluff in prontezza notturna, Su-57 da Cannellina.", intel: ["Gli elicotteri sono a terra fino alle 23:00, poi decollano", "Di notte le CAP RED sono ridotte"],
          da_sapere: DA_SAPERE_BLUE("21:30", "24:00", ["Notte senza luna: nella vista 3D usate la camera cockpit con il visore NVG (pulsante NVG o tasto N)"]),
          output_plan: ["Chi colpisce Benton e a che ora", "Copertura del Growler sulla SA-10", "Regole di separazione tra le formazioni al buio"] });
        brief(sc, "RED", { titolo: "Operazione DARK STORM", situazione: "Alle 23:00 i nostri elicotteri partono. Fino ad allora sono vulnerabili a terra: difendete Benton nella notte.", task: ["Difendere gli elicotteri di Benton fino alle 23:00", "Difendere radar e deposito"],
          threat: "Strike notturno della coalizione con visori NVG.", intel: ["Il nemico preferisce la notte"], da_sapere: DA_SAPERE_RED("21:30", "24:00"), output_plan: ["CAP notturne", "Prontezza", "SA-10"] });
      },
      demo: { redRitardo: 45, prontezzaMax: 0,
        blue: { formazioni: {
          GROWLER:   { decollo: "21:35", tanker: "AAR_SUD", aar_ordine: 1, gate_in: "GATE_C", push: "22:00", stazione: { lat: 40.62, lon: -122.80 }, cap_min: 30, gate_out: "GATE_C" },
          TITAN:     { decollo: "21:35", tanker: "AAR_NORD", aar_ordine: 1, gate_in: "GATE_C", push: "21:58", cap: "CAPB_W", cap_min: 20, gate_out: "GATE_C" },
          GLADIATOR: { decollo: "21:40", tanker: "AAR_NORD", aar_ordine: 2, gate_in: "GATE_C", push: "22:08", target: "BENTON_HELO", gate_out: "GATE_C" },
          ROMA:      { decollo: "21:45", tanker: "AAR_SUD", aar_ordine: 2, gate_in: "GATE_S", push: "22:10", target: "DEP_ANDERSON", gate_out: "GATE_S" } } },
        red: { cap: [{ box: "CAP2", formazione: "IVAN1", da: "21:30", a: "23:30" }, { box: "CAP1", formazione: "IVAN2", da: "22:00", a: "23:59" }], prontezza: ["IVAN4", "VLADIMIR1"], sam_moves: [], commit_nm: 40 },
        passi: ["<b>NIGHT STALKER · notte senza luna.</b> Gli elicotteri di Benton partono alle 23:00: vanno colpiti a terra prima. Nella vista 3D si vola con il visore NVG.",
          "<b>Il piano.</b> Pochi assetti e semplici: TITAN e il Growler aprono, GLADIATOR su Benton, ROMA sul deposito di Anderson. Al buio la semplicità è sicurezza.",
          "<b>Esecuzione.</b> Aprite la vista 3D, camera cockpit, e premete NVG: la notte diventa verde e si vedono terreno, luci e velivoli."] } }
  ];
  // la campagna combinata usa il piano RED della demo base
  const m10 = ELENCO.find(m => m.id === "M10"); m10.demo.red = null;

  /* ======================= COSTRUZIONE ======================= */
  function trova(id) { return ELENCO.find(m => m.id === id); }
  function scenario(id) {
    const m = trova(id); if (!m) return null; const sc = clone(SCENARIO_DEFAULT);
    sc.piani = { BLUE: null, RED: null }; m.applica(sc);
    sc.meta = Object.assign(sc.meta, { nome: m.base ? sc.meta.nome : `${m.codice} – ${m.titolo.split("·")[1] ? m.titolo.split("·")[1].trim() : m.titolo}`, missione: m.id, note: m.descrizione });
    sc.missione = { id: m.id, codice: m.codice, titolo: m.titolo, tipo: m.tipo, focus: m.focus, domande: m.domande, difficolta: m.difficolta };
    if (!sc.obiettivi) sc.obiettivi = [];
    return sc;
  }
  function pianiDemo(id, sc) {
    const m = trova(id); if (!m || m.base) { DEMO.pianiDemo(sc); return; }
    sc.piani.BLUE = clone(m.demo.blue); const P = sc.piani.BLUE.formazioni; Object.keys(P).forEach(k => { if (!P[k]) delete P[k]; });
    if (m.demo.red) sc.piani.RED = clone(m.demo.red); else { const tmp = clone(SCENARIO_DEFAULT); tmp.piani = {}; DEMO.pianiDemo(tmp); sc.piani.RED = tmp.piani.RED; }
    // la demo mostra un RED "most likely" sbagliato: CAP in ritardo rispetto all'attacco e poca prontezza al suolo (è il tema del debrief)
    const R = sc.piani.RED; const d = m.demo;
    if (d.redRitardo) R.cap = R.cap.map(c => ({ ...c, da: Engine.s2hm(Engine.hm2s(c.da) + d.redRitardo * 60), a: Engine.s2hm(Engine.hm2s(c.a) + d.redRitardo * 60) }));
    if (d.prontezzaMax != null) R.prontezza = (R.prontezza || []).slice(0, d.prontezzaMax);
    // scorta: TITAN in CAP sopra la stazione del Growler, 4 minuti prima di lui
    if (d.scorta && P.GROWLER && P.GROWLER.stazione && P.TITAN) { sc.cap_box.push({ id: "CAPB_SC", nome: "CAP Blue scorta Growler", lato: "BLUE", lat: P.GROWLER.stazione.lat, lon: P.GROWLER.stazione.lon, raggio_nm: 10 }); delete P.TITAN.target; delete P.TITAN.target2; P.TITAN.cap = "CAPB_SC"; P.TITAN.cap_min = 20; P.TITAN.push = Engine.s2hm(Engine.hm2s(P.GROWLER.push) - 240); }
  }

  /* ======================= INTERFACCIA ======================= */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const stelle = n => "★".repeat(n) + "☆".repeat(5 - n);
  function backup() { try { const cur = APP.sc; if (cur && !(cur.missione && cur.missione.id)) localStorage.setItem(BK, JSON.stringify({ quando: new Date().toISOString(), sc: cur })); } catch (e) {} }
  function haBackup() { try { return JSON.parse(localStorage.getItem(BK) || "null"); } catch (e) { return null; } }
  function carica(id, opt) {
    opt = opt || {}; if (typeof RETE !== "undefined" && RETE.client()) { UI.toast("Le missioni le sceglie il trainer"); return false; }
    const sc = scenario(id); if (!sc) return false; backup();
    if (typeof DEMO !== "undefined") DEMO.stop(); APP.play(false); APP.sc = sc; APP.salva(); APP.ricostruisci(); if (typeof MAPPA !== "undefined" && MAPPA.fitScenario) MAPPA.fitScenario();
    if (!opt.silenzioso) UI.toast(`📋 Missione caricata: <b>${esc(trova(id).titolo)}</b>`, 4000, true);
    return true;
  }
  function ripristina() { const b = haBackup(); if (!b) return; APP.play(false); APP.sc = b.sc; APP.salva(); APP.ricostruisci(); localStorage.removeItem(BK); UI.toast("Scenario personalizzato ripristinato"); chiudiCatalogo(); }
  function obiettiviHtml(m) { const sc = scenario(m.id); const ob = sc.obiettivi || []; if (!ob.length) return `<li>Distruggere i target di Redding, Benton, Red Bluff e il C2 (valutazione classica)</li>`; return ob.map(o => `<li class="${o.primario !== false ? "prim" : ""}">${o.primario !== false ? "<b>Primario</b>" : "Secondario"} · ${esc(o.testo)}</li>`).join(""); }
  function catalogoHtml() {
    const att = APP.sc && APP.sc.missione && APP.sc.missione.id; const b = haBackup();
    return `<div class="mis-head"><div><h2>📋 Catalogo missioni</h2><small>12 missioni pronte per il workshop, ognuna con obiettivi, briefing per le due squadre, focus formativo e demo guidata.</small></div><button class="btn" id="mis-chiudi">✕ Chiudi</button></div>
      ${b ? `<div class="mis-backup">Hai uno scenario personalizzato salvato il ${new Date(b.quando).toLocaleString("it-IT")}. <button class="btn small" id="mis-ripristina">Ripristinalo</button></div>` : ""}
      <div class="mis-grid">${ELENCO.map(m => `<div class="mis-card ${att === m.id ? "attiva" : ""}"><div class="mis-top"><span class="mis-cod">${m.id}</span><span class="mis-tipo">${esc(m.tipo)}</span><span class="mis-diff" title="Difficoltà">${stelle(m.difficolta)}</span></div>
        <h3>${esc(m.titolo)}</h3><p>${esc(m.descrizione)}</p><div class="mis-focus"><b>Focus formativo:</b> ${esc(m.focus)}</div><ul class="mis-ob">${obiettiviHtml(m)}</ul><div class="mis-meta">⏱ ${esc(m.durata)}${att === m.id ? ' · <b class="ok">in uso</b>' : ""}</div>
        <div class="mis-az"><button class="btn small primary" data-gioca="${m.id}">▶ Gioca</button><button class="btn small gold" data-demo="${m.id}">🎬 Demo guidata</button></div></div>`).join("")}</div>`;
  }
  let modal = null;
  function apriCatalogo() {
    if (!modal) { modal = document.createElement("div"); modal.id = "missioni"; modal.className = "mis-modal hidden"; document.body.appendChild(modal); }
    modal.innerHTML = `<div class="mis-box">${catalogoHtml()}</div>`; modal.classList.remove("hidden");
    modal.querySelector("#mis-chiudi").onclick = chiudiCatalogo; const r = modal.querySelector("#mis-ripristina"); if (r) r.onclick = ripristina;
    modal.onclick = e => { if (e.target === modal) chiudiCatalogo(); };
    modal.querySelectorAll("[data-gioca]").forEach(b => b.onclick = () => { const id = b.dataset.gioca; if (APP.sc && !(APP.sc.missione && APP.sc.missione.id) && !confirm("Lo scenario attuale verrà sostituito dalla missione. Una copia viene salvata e si può ripristinare dal catalogo. Procedo?")) return; entraApp(); if (carica(id)) { APP.setRuolo(APP.ruolo || "TRAINER"); APP.vaiFase("briefing"); chiudiCatalogo(); } });
    modal.querySelectorAll("[data-demo]").forEach(b => b.onclick = () => { const id = b.dataset.demo; entraApp(); chiudiCatalogo(); DEMO.avvia(id); });
  }
  function entraApp() { const sp = document.getElementById("splash"); if (sp && !sp.classList.contains("hidden")) { sp.classList.add("hidden"); document.getElementById("app").classList.remove("hidden"); if (!APP.ruolo) APP.setRuolo("TRAINER"); setTimeout(() => { if (typeof MAPPA !== "undefined") { MAPPA.map.invalidateSize(); MAPPA.fitScenario(); } }, 60); } }
  function chiudiCatalogo() { if (modal) modal.classList.add("hidden"); }
  // narrazione e commenti della demo di una missione
  function demoInfo(id) { const m = trova(id); return m && !m.base ? m.demo : null; }

  return { ELENCO, trova, scenario, pianiDemo, carica, apriCatalogo, chiudiCatalogo, demoInfo, ripristina };
})();
