/* =====================================================================
   DEMO GUIDATA – piani d'esempio e narrazione automatica
   ===================================================================== */
const DEMO = (() => {
  function pianiDemo(sc) {
    /* Timeline coerente: Growler per primo sulla stazione, TITAN in sweep davanti, strike che "pushano" alle 10:30 con TOT 10:37-10:46 */
    sc.piani.BLUE = { formazioni: {
      TITAN:     { decollo: "09:55", tanker: "AAR_NORD", aar_ordine: 1, gate_in: "GATE_C", push: "10:28", cap: "CAPB_W", cap_min: 15, gate_out: "GATE_C" },
      GLADIATOR: { decollo: "09:50", tanker: "AAR_NORD", aar_ordine: 2, gate_in: "GATE_C", push: "10:38", target: "TGT_REDDING", gate_out: "GATE_S" },
      GROWLER:   { decollo: "09:45", tanker: "AAR_SUD",  aar_ordine: 1, gate_in: "GATE_C", push: "10:28", stazione: { lat: 40.55, lon: -122.90 }, cap_min: 35, gate_out: "GATE_C" },
      CENTURION: { decollo: "09:50", tanker: "AAR_SUD",  aar_ordine: 2, gate_in: "GATE_C", push: "10:32", target: "TGT_C2", gate_out: "GATE_C" },   // niente 2º target: l'F-16 (50 min dopo AAR) non ha carburante per due attacchi
      ROMA:      { decollo: "10:00", tanker: "AAR_SUD",  aar_ordine: 3, gate_in: "GATE_C", push: "10:36", target: "TGT_BENTON", gate_out: "GATE_C" }
    } };
    /* RED ("most likely" sbagliato): una sola CAP la mattina, massimo sforzo dalle 11 alle 15, 8 velivoli in prontezza, SA-10 di Red Bluff spostata verso ovest */
    sc.piani.RED = {
      cap: [ { box: "CAP1", formazione: "IVAN1", da: "09:00", a: "11:00" }, { box: "CAP1", formazione: "IVAN2", da: "11:00", a: "13:00" }, { box: "CAP2", formazione: "IVAN5", da: "11:00", a: "13:00" },
             { box: "CAP3", formazione: "VLADIMIR1", da: "11:00", a: "13:00" }, { box: "CAP1", formazione: "IVAN3", da: "13:00", a: "15:00" }, { box: "CAP3", formazione: "VLADIMIR2", da: "13:00", a: "15:00" },
             { box: "CAP2", formazione: "IVAN4", da: "15:00", a: "17:00" } ],
      prontezza: ["IVAN6", "VLADIMIR3"], sam_moves: [ { sam: "SA10_C", lat: 40.33, lon: -122.60, da: "09:00" } ], commit_nm: 60
    };
  }
  const PASSI = [
    { fase: "briefing", ms: 9000, msg: "<b>1 · BRIEFING.</b> Due squadre, una carta reale del Nord California. BLUE attacca Redding (Operazione Rolling Thunder), RED difende (Odyssey Dawn). Tutto parte dalla regola delle 5T." },
    { fase: "piano", ms: 14000, msg: "<b>2 · PIANO.</b> Nessun joystick: si decide. Orari di decollo, tanker e ordine di rifornimento, gate di ingresso, target, uscita. Il simulatore disegna le rotte e verifica carburante e timeline in tempo reale." },
    { fase: "esecuzione", ms: 0, msg: "<b>3 · ESECUZIONE.</b> Ora si vola. Fisica reale: 480 nodi, vento da est 50 nodi, virate a 30° di bank, autonomie da ROE. Nessuno fa planning: si osserva e si registra." }
  ];
  let attiva = false, timers = [];
  function avvia(idMissione) {
    if (attiva) return;
    // demo di una missione del catalogo: si carica la missione e i suoi piani d'esempio
    const M = typeof MISSIONI !== "undefined" ? MISSIONI : null; const info = idMissione && M ? M.demoInfo(idMissione) : null;
    if (idMissione && M) { M.carica(idMissione, { silenzioso: true }); M.pianiDemo(idMissione, APP.sc); } else pianiDemo(APP.sc);
    attiva = true; APP.salva(); APP.setRuolo("TRAINER"); APP.ricostruisci();
    const passi = info ? info.passi.map((msg, i) => ({ fase: ["briefing", "piano", "esecuzione"][i], ms: [11000, 14000, 0][i], msg })) : PASSI;
    let acc = 0;
    passi.forEach(p => { timers.push(setTimeout(() => { APP.vaiFase(p.fase); UI.toast(p.msg, p.ms || 9000, true); if (p.fase === "esecuzione") { APP.setSpeed(60); APP.play(true); } }, acc)); acc += p.ms; });
    APP.engine.on(ev => { if (!attiva || ev.tipo !== "evento") return; const e = ev.e; const commento = COMMENTI.find(c => c.test(e)); if (commento) UI.toast(commento.msg(e), 7000, true); if (/Tutte le formazioni BLUE|Fine della finestra/.test(e.testo)) { timers.push(setTimeout(() => { APP.play(false); APP.vaiFase("debrief"); UI.toast("<b>4 · DEBRIEF.</b> Risultato, safety point, timeline, formula del kill ratio ingaggio per ingaggio. È qui che il workshop produce valore: decisioni, non emozioni.", 12000, true); attiva = false; }, 2500)); } });
    UI.toast("<b>DEMO GUIDATA avviata</b> – premi ⟲ in basso per interrompere in qualsiasi momento.", 6000);
  }
  function stop() { attiva = false; timers.forEach(clearTimeout); timers = []; }
  const COMMENTI = [
    { test: e => /AIRBORNE/.test(e.testo) && e.chi === "GROWLER" || (e.chi === "GRIZZLY" && /AIRBORNE/.test(e.testo)), msg: e => `<b>Decollo.</b> Il Growler parte per primo: senza la sua copertura elettronica, chi entra nel ring SA-10 viene abbattuto.` },
    { test: e => /Rifornimento in volo iniziato/.test(e.testo) && e.chi === "TITAN", msg: () => `<b>AAR.</b> Dieci minuti a formazione, un tanker alla volta: l'ordine di rifornimento è la prima decisione di leadership del piano.` },
    { test: e => /Holding al/.test(e.testo), msg: e => `<b>Timeline.</b> ${e.chi} è in anticipo e tiene l'holding al gate fino all'orario di push: la sincronizzazione del pacchetto conta più della velocità.` },
    { test: e => /PUSH/.test(e.testo) && e.chi === "GLADIATOR", msg: () => `<b>PUSH.</b> Le formazioni strike entrano in territorio nemico. Da qui la picture dell'E-7 e il commit dei Raptor decidono tutto.` },
    { test: e => /COMMIT/.test(e.testo) && e.chi === "TITAN", msg: e => `<b>COMMIT.</b> TITAN rileva i Flanker e va a ingaggiare: il kill ratio F-22 vs Su-35 è 2, quello inverso 0,5.` },
    { test: e => e.tipo === "ingaggio" && /stile Excel/.test(e.testo), msg: e => `<b>Formula.</b> ${e.testo.split(":").slice(1).join(":")}` },
    { test: e => /SHACK/.test(e.testo), msg: e => `<b>Target distrutto.</b> ${e.chi}: ${e.testo}` },
    { test: e => /SAM LAUNCH/.test(e.testo), msg: e => `<b>SAM!</b> ${e.testo} – è il classico safety point del debrief.` },
    { test: e => /BINGO/.test(e.testo), msg: e => `<b>BINGO.</b> ${e.chi} ha raggiunto il carburante minimo e rientra: la fisica non perdona i piani ottimisti.` },
    { test: e => /SCRAMBLE ordinato/.test(e.testo), msg: e => `<b>Scramble.</b> I RED in prontezza al suolo decollano: Su-35 pronti in 15 minuti, Su-57 in 25.` },
    { test: e => e.tipo === "inject" && e.chi === "INTEL", msg: e => `<b>Intelligence.</b> ${e.testo}. Una formazione pronta può essere mandata subito con il target assign 🎯.` },
    { test: e => e.tipo === "inject", msg: e => `<b>INJECT.</b> ${e.testo}` },
    { test: e => /SAM SOPPRESSA/.test(e.testo), msg: e => `<b>Porta aperta.</b> ${e.chi}: ${e.testo.replace("SAM SOPPRESSA – ", "")}. Chi entra dopo corre meno rischi.` },
    { test: e => /holding fino alle/.test(e.testo) && /non ancora localizzato/.test(e.testo), msg: e => `<b>Attesa sul bersaglio.</b> ${e.chi} è arrivato prima della finestra e aspetta: essere in anticipo è un vantaggio solo se c'è carburante.` },
    { test: e => /non presente \(finestra/.test(e.testo), msg: e => `<b>Finestra mancata.</b> ${e.chi}: ${e.testo}. Il tempismo è parte del bersaglio.` },
    { test: e => /già neutralizzato/.test(e.testo), msg: e => `<b>Obiettivo già raggiunto.</b> ${e.chi} rientra senza sganciare: le risorse risparmiate valgono quanto quelle spese.` }
  ];
  return { pianiDemo, avvia, stop, get attiva() { return attiva; } };
})();
