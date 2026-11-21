/* =====================================================================
   CENTURION CADET · ACCADEMIA DI VOLO
   Il percorso del Cadetto: 12 lezioni pratiche nel Free Flight sul Veneto (Eurofighter Typhoon
   della base di Istrana) e 2 missioni conclusive del simulatore.
   - Modulo 1 · Volo: assetto e potenza, virate e fattore di carico, energia e limiti, decollo, atterraggio
   - Modulo 2 · Armi: cannone, AIM-9X (infrarosso), AIM-120 (radar, oltre il raggio visivo), AGM-65 (aria-suolo)
   - Modulo 3 · Attacco: penetrazione a bassa quota contro un SA-10; strategia «Il corridoio»
   - Modulo 4 · Difesa: difesa dai missili, difesa aerea con la CAP; polizia aerea «LAGUNA QRA»
   Ogni lezione ha teoria con i numeri reali e quelli del simulatore, fasi verificate in tempo reale
   (quota, velocità, inclinazione, G, sentiero di discesa, armi, minacce), un pannello in volo, il
   debriefing con le stelle e i progressi salvati nel browser.
   Fisica, armi, missili, contromisure e IA sono quelli del Free Flight (js/volo.js): l'accademia li
   configura e li osserva con gli agganci aggiunti da patch_accademia.py.
   ===================================================================== */
const ACCADEMIA = (() => {
  "use strict";
  const KEY = "centurion_accademia_v1", KEY_VOCE = "centurion_accademia_voce";
  const FT = 3.28084, KT = 1.94384, NM = 1852, D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n, d) => Number(n).toLocaleString("it-IT", { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 });
  const angd = (a, b) => ((b - a + 540) % 360) - 180;
  const fascia = (v, a, b) => v >= a && v <= b;
  const D = (n, v, ok, obj) => ({ n, v, ok, obj });

  /* ---------- area addestrativa: Veneto, base di Istrana (stessa carta della missione LAGUNA QRA) ---------- */
  const CENTRO = [45.58, 12.22];
  const ISTRANA = { lat: 45.684382, lon: 12.086594, hdg: 82 };   // pista 08/26, rotta vera 082° (testate OurAirports)
  const TESSERA = { lat: 45.505299, lon: 12.3519 };
  const mLon = () => 111320 * Math.cos(CENTRO[0] * D2R);
  const xz = (lat, lon) => ({ x: (lon - CENTRO[1]) * mLon(), z: -(lat - CENTRO[0]) * 111320 });   // come il Free Flight
  const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const brgXZ = (a, b) => (Math.atan2(b.x - a.x, -(b.z - a.z)) * R2D + 360) % 360;
  const avanti = (p, hdg, m) => ({ x: p.x + Math.sin(hdg * D2R) * m, z: p.z - Math.cos(hdg * D2R) * m });

  function scenario(L) {
    const sc = JSON.parse(JSON.stringify(SCENARIO_DEFAULT));
    Object.assign(sc.tempo, { inizio: "10:00", fine: "11:00", tick_sec: 5 });
    Object.assign(sc.mappa, { centro: CENTRO.slice(), zoom: 9, tile_default: "sat", bounds: [[45.05, 11.45], [46.1, 12.98]],
      bullseye: { nome: "ISTRANA", lat: ISTRANA.lat, lon: ISTRANA.lon }, nazioni: [], fir_boundary: [] });
    if (sc.mappa.griglia) sc.mappa.griglia.attiva = false;
    sc.mappa5 = { id: "veneto", nome: "Veneto · area addestrativa", centro: CENTRO.slice(), lato_m: 110000, area_km2: 12100, quotaInizioM: 3000 };
    sc.meteo = Object.assign({}, sc.meteo, { vento_da_gradi: 40, vento_kt: 10, descrizione: "Bora debole da nord-est, visibilità oltre 10 km (condizioni illustrative)" });
    sc.basi = [{ id: "LIPS", nome: "Istrana", lato: "BLUE", lat: ISTRANA.lat, lon: ISTRANA.lon, nazione: "Italia", pista_ft: 9816, pista_hdg: ISTRANA.hdg }];
    sc.target = (L.target || []).map(t => Object.assign({ gbu_richieste: 2, categoria: "addestrativo", descrizione: "Bersaglio addestrativo" }, t));
    sc.sam = (L.sam || []).map(s => Object.assign({ missili: 4 }, s));
    sc.formazioni = [{ id: "ALLIEVO", callsign: "ALLIEVO", lato: "BLUE", tipo: "F2000", numero: 1, base: "LIPS", ruolo: "ADDESTRAMENTO" }];
    sc.aar = []; sc.orbite = []; sc.gate = []; sc.cap_box = []; sc.droni = []; sc.inject = []; sc.agenda = [];
    sc.piani = { BLUE: { formazioni: {} }, RED: { cap: [], prontezza: [], sam_moves: [], commit_nm: 40 } };
    sc.obiettivi = [];
    sc.meta = Object.assign(sc.meta || {}, { nome: "Accademia · " + L.titolo, missione: "ACC-" + L.id });
    sc.missione = { id: "ACC-" + L.id, codice: "ACCADEMIA", titolo: "Accademia · " + L.titolo, tipo: "Lezione", difficolta: 1, cadet: true, accademia: L.id };
    delete sc.veneto;
    return sc;
  }

  /* ---------- stato del velivolo letto dal Free Flight ---------- */
  // densità ISA (kg/m³): la velocità indicata del visore è V·√(ρ/ρ0), come in volo.js
  function rho(h) { h = Math.max(0, h); if (h < 11000) { const T = 288.15 - 0.0065 * h; return 1.225 * Math.pow(T / 288.15, 4.2559); } return 0.3639 * Math.exp(-(h - 11000) / 6341.6); }
  function stato(S) {
    const P = S.pl, T = THREE;
    const fwd = new T.Vector3(0, 0, 1).applyQuaternion(P.Q), up = new T.Vector3(0, 1, 0).applyQuaternion(P.Q), rt = new T.Vector3(-1, 0, 0).applyQuaternion(P.Q);
    const V = P.vel.length();
    return { t: S.t, V, kt: V * Math.sqrt(rho(P.pos.y) / 1.225) * KT, ktas: V * KT, ft: P.pos.y * FT, aglFt: (P.agl || 0) * FT, agl: P.agl || 0, g: P.nz || 1, alfa: (P.alpha || 0) * R2D, M: P.M || 0,
      pitch: Math.asin(clamp(fwd.y, -1, 1)) * R2D, roll: Math.atan2(-rt.y, up.y) * R2D, hdg: (Math.atan2(fwd.x, -fwd.z) * R2D + 360) % 360,
      trk: (Math.atan2(P.vel.x, -P.vel.z) * R2D + 360) % 360, vs: P.vel.y * 196.85, terra: !!P.aTerra, carrello: !!P.carrello,
      thr: S.thr, vivo: P.vivo, arma: S.arma, lock: S.lock, x: P.pos.x, z: P.pos.z, y: P.pos.y, P, S };
  }
  const nemico = (S, i) => S.nemici[i];
  const nemiciVivi = S => S.nemici.filter(e => e.vivo).length;
  const missiliMiei = (S, tipo) => S.missili.filter(m => m.da === S.pl && (!tipo || m.tipo === tipo));
  const missiliControDiMe = S => S.missili.filter(m => m.vivo && m.target === S.pl && !m.perso);
  const bersaglio = (S, sotto) => S.terra.find(t => t.sotto === sotto);
  // angolo fra la prua del giocatore e la direzione di un punto (gradi, 0 = davanti)
  const fuoriAsse = (s, p) => Math.abs(angd(s.hdg, brgXZ(s, p)));
  // angolo d'aspetto: quanto il giocatore è "in coda" al bersaglio (0° = esattamente dietro)
  function aspetto(s, e) { const b = brgXZ(e.pos, s); const h = e.hdg * R2D; return Math.abs(angd(h + 180, b)); }
  // D2: conta i missili del giocatore che il bersaglio ha ingannato (traverso, contromisure, lancio troppo di lato)
  function contaInganni(s, c) {
    missiliMiei(s.S).forEach(m => { const motivo = m.perso || m.ingannato; if (!motivo || m.accContato) return;
      m.accContato = true; c.persi = (c.persi || 0) + 1; c.persoT = s.S.t; c.persoMotivo = motivo; c["perso_" + motivo] = (c["perso_" + motivo] || 0) + 1; });
  }
  // D2: consiglio di tiro secondo l'arma, la distanza e quello che è appena successo ai missili
  function consiglioTiro(s, c) {
    const S = s.S, P = s.P, lk = s.lock && s.lock.ok && S.nemici.includes(s.lock.t) ? s.lock.t : null;
    if (c.persoT != null && S.t - c.persoT < 6) return c.persoMotivo === "gimbal" ? "Missile perso: bersaglio troppo di lato al lancio."
      : c.persoMotivo === "notch" ? "Ingannato dal traverso (notch): chiudi sotto i 10 km."
      : "Ingannato dalle contromisure: rilancia più vicino.";
    if (P.armi.AIM120 <= 0 && P.armi.AIM9X > 0 && s.arma !== "AIM9X") return "AMRAAM finiti: ARMA (X) fino al Sidewinder.";
    if (missiliMiei(S).some(m => m.vivo && !m.perso && !m.ingannato)) return "Missile in volo: tieni il bersaglio davanti.";
    if (!lk) return "LOCK (T) sull'incursore più vicino.";
    const d = lk.pos.distanceTo(P.pos), lim = 10000;
    if (fuoriAsse(s, lk.pos) > 30) return "Porta l'incursore davanti al muso, poi lancia.";
    if (d > lim) return s.arma === "AIM9X" ? "Sidewinder: chiudi sotto i 10 km." : `SHOOT, ma a ${fmt(d / 1000)} km sfugge: chiudi sotto i 10.`;
    return "Distanza buona, bersaglio davanti: FUOCO.";
  }
  function datiTiro(s, c) {
    const lk = s.lock && s.lock.ok && s.S.nemici.includes(s.lock.t) ? s.lock.t : null, d = lk ? lk.pos.distanceTo(s.P.pos) : null, lim = 10000;
    return [D("Bersaglio agganciato", d != null ? fmt(d / 1000, 1) + " km" : "—", d != null && d < lim, "< 10 km"),
      D("Più vicino a Venezia", c.dMin < 1e8 ? fmt(c.dMin / 1000) + " km" : "—", c.dMin > 15000, "> 15"),
      D("Abbattuti", s.S.nemici.filter(e => !e.vivo).length + " di 2", nemiciVivi(s.S) === 0, "")];
  }

  /* ---------- posizionamento dopo l'avvio del Free Flight ---------- */
  function quat(hdg, pitch, roll) { return VOLO._acc.assetto(hdg * D2R, (pitch || 0) * D2R, (roll || 0) * D2R); }
  const mil = thr => thr <= 0.8 ? 0.05 + 0.95 * thr / 0.8 : 1;
  function piazza(S, o) {
    const P = S.pl, p = o.x != null ? o : xz(o.lat, o.lon), y = o.y != null ? o.y : o.ft / FT, h = o.hdg * D2R;
    const V = o.kcas != null ? o.kcas / KT / Math.sqrt(rho(y) / 1.225) : o.kt / KT;   // velocità indicata → vera
    P.pos.set(p.x, y, p.z); P.vel.set(Math.sin(h), 0, -Math.cos(h)).multiplyScalar(V); P.Q.copy(quat(o.hdg, o.pitch != null ? o.pitch : 2, 0));
    P.aTerra = false; P.carrello = !!o.gear; P.rigid6 = null; P.p = 0; P.q = 0; P.r = 0; P.nInt = 0; P.V = V; P.nz = 1; P.gMax = 1; P.alpha = 0;
    S.thr = o.thr != null ? o.thr : 0.6; P.spinta = mil(S.thr); P.ab = 0;
    if (P.obj) { P.obj.position.copy(P.pos); P.obj.quaternion.copy(P.Q); }
  }
  function piazzaNemico(S, i, o) {
    const e = S.nemici[i]; if (!e) return null;
    const p = o.x != null ? o : xz(o.lat, o.lon);
    e.pos.set(p.x, o.ft / FT, p.z); e.hdg = o.hdg * D2R; e.V = o.kt / KT; e.gam = 0; e.bank = 0; e.casa = e.pos.clone();
    e.vel.set(Math.sin(e.hdg), 0, -Math.cos(e.hdg)).multiplyScalar(e.V);
    e.missili = Object.assign({ R77: 0, R73: 0 }, o.missili || {}); if (o.hp) e.hp = o.hp; if (o.cad != null) e.cad = o.cad; if (o.flare != null) e.flare = o.flare;
    e.guida = o.guida || null; if (o.nome) e.nome = o.nome; e.stato = "addestramento";
    if (e.obj) { e.obj.position.copy(e.pos); e.obj.quaternion.copy(quat(o.hdg, 3, 0)); }
    return e;
  }
  function armi(S, a) { const P = S.pl; P.armi = { AIM120: a.AIM120 || 0, AIM9X: a.AIM9X || 0, AGM65: a.AGM65 || 0 }; P.colpi = a.colpi != null ? a.colpi : P.A.colpi; S.arma = a.sel || "AIM120"; S.lock = null; }
  // guida dei bersagli: volo livellato o virata costante (radianti, metri, m/s)
  const dritto = (alt, v) => e => ({ hdg: e.hdgFisso != null ? e.hdgFisso : (e.hdgFisso = e.hdg), alt, v, g: 3, stato: "addestramento" });
  const virata = (alt, v, g, verso) => e => ({ hdg: e.hdg + (verso || 1) * 0.6, alt, v, g, stato: "addestramento" });
  // circuito d'addestramento al tiro: tratti rettilinei di tDritto secondi alternati a virate di 180° a g costanti
  const circuito = (alt, v, g, verso, tDritto) => (e, k) => {
    const t = k.S.t; if (!e.cir) e.cir = { fase: "dritto", t0: t + 10, h0: e.hdg };   // il primo tratto dura 10 s in più
    const c = e.cir;
    if (c.fase === "dritto") { if (t - c.t0 > tDritto) { c.fase = "virata"; c.h0 = e.hdg; } return { hdg: c.h0, alt, v, g: 3, stato: "addestramento" }; }
    if (Math.abs(angd(c.h0 * R2D, e.hdg * R2D)) > 172) { c.fase = "dritto"; c.t0 = t; c.h0 = e.hdg; }
    return { hdg: e.hdg + (verso || 1) * 0.6, alt, v, g, stato: "addestramento" };
  };

  /* ======================================================================
     LE LEZIONI
     ====================================================================== */
  const COMANDI = "Barra: frecce o W/S/A/D (freccia su = muso giù) · Manetta: Shift o R (+), Ctrl o F (−) · Pedaliera: Q/E · Carrello: G · Freni/aerofreno: B · Arma: X · Aggancio: T · Fuoco: barra spaziatrice · Chaff/flare: C · Telecamera: V. Su telefono: cloche a sinistra, manetta a destra, tasti FUOCO/LOCK/ARMA/FLARE.";
  const MODULI = [
    { id: "volo", ico: "✈", titolo: "Modulo 1 · Rudimenti di volo", sotto: "Le basi del pilotaggio sul Typhoon: assetto e potenza, virate, energia, decollo e atterraggio." },
    { id: "armi", ico: "🎯", titolo: "Modulo 2 · Sistemi d'arma", sotto: "Cannone, missili aria-aria a infrarossi e radar, missile aria-superficie: come funzionano e quando si usano." },
    { id: "attacco", ico: "💥", titolo: "Modulo 3 · Attacco", sotto: "Penetrare una difesa missilistica a bassa quota, poi pianificare un attacco come un comandante." },
    { id: "difesa", ico: "🛡", titolo: "Modulo 4 · Difesa", sotto: "Sopravvivere ai missili, difendere lo spazio aereo, la polizia aerea in tempo di pace." },
    { id: "soccorso", ico: "⛑", titolo: "Modulo 5 · Personnel Recovery", sotto: "Con gli STOS dell'Aeronautica Militare: localizzare, mettere in sicurezza, soccorrere e recuperare personale isolato in area ostile." }
  ];

  const LEZIONI = [
    /* ---------------- MODULO 1 · VOLO ---------------- */
    { id: "V1", modulo: "volo", titolo: "Assetto e potenza", sotto: "Volo rettilineo livellato", durata: "6 min",
      obiettivo: "Tenere quota e velocità costanti, poi cambiare velocità senza cambiare quota.",
      teoria: [
        ["Le quattro forze", "In volo agiscono quattro forze: la portanza L (prodotta dall'ala, verso l'alto), il peso W, la spinta T dei motori e la resistenza D dell'aria. In volo rettilineo livellato a velocità costante si equilibrano a coppie: L = W e T = D."],
        ["La portanza", "L = ½·ρ·V²·S·CL. ρ è la densità dell'aria (1,225 kg/m³ al livello del mare, circa 0,90 a 10.000 ft), V la velocità, S la superficie alare (51,2 m² sul Typhoon), CL il coefficiente di portanza, che cresce con l'incidenza (l'angolo fra l'ala e il vento relativo). Se la velocità aumenta, per avere la stessa portanza serve meno incidenza e il muso scende; se diminuisce, il muso sale."],
        ["Manetta e barra", "La regola dei piloti: la manetta comanda l'energia, la barra la traiettoria. Per accelerare restando in quota si dà manetta e si abbassa un poco il muso; per rallentare si toglie manetta e si alza il muso. Prima si imposta la potenza, poi l'assetto, poi si aspetta che l'aereo si stabilizzi: potenza + assetto = prestazioni. Il Typhoon ha poca resistenza: per rallentare in fretta si usa l'aerofreno dorsale."],
        ["Velocità indicata e vera", "Il visore mostra la velocità indicata (KCAS), quella che 'sente' l'ala: dipende dalla pressione dinamica ½·ρ·V². In quota l'aria è meno densa, quindi la velocità vera (TAS) è più alta di quella indicata: a 10.000 ft 350 nodi indicati sono circa 405 nodi veri. I piloti volano con la velocità indicata; in questa accademia tutte le velocità richieste sono indicate, come nel visore."],
        ["Il fly-by-wire", "Il Typhoon è instabile per progetto e vola grazie ai computer di volo. La barra non muove direttamente le superfici: chiede un fattore di carico. Barra al centro = 1 g, cioè l'aereo mantiene la traiettoria; barra indietro = più g e il muso sale; barra avanti = meno g e il muso scende. Movimenti piccoli e dolci."]
      ],
      numeri: [["Massa nella lezione", "15,5 t (vuoto circa 11 t, massimo al decollo 23,5 t)"], ["Superficie alare", "51,2 m²"], ["Motori", "2 Eurojet EJ200: 60 kN a secco, 90 kN con postbruciatore ciascuno"], ["Manetta nel simulatore", "0–80% potenza militare, oltre l'80% postbruciatore (AB)"], ["350 nodi indicati a 10.000 ft", "circa 405 nodi veri, Mach 0,63"]],
      setup(S) { piazza(S, { lat: 45.47, lon: 11.68, ft: 10000, kcas: 350, hdg: 75, thr: 0.5 }); armi(S, { AIM120: 0, AIM9X: 0, AGM65: 0, colpi: 0, sel: "GUN" }); },
      fasi: [
        { titolo: "Livella", testo: "Tieni la quota fra 9.700 e 10.300 ft e la velocità fra 330 e 370 kt per 20 secondi.", tenere: 20,
          check: s => { const a = fascia(s.ft, 9700, 10300), v = fascia(s.kt, 330, 370);
            return { ok: a && v, dati: [D("Quota", fmt(s.ft) + " ft", a, "9.700–10.300"), D("Velocità", fmt(s.kt) + " kt", v, "330–370")],
              msg: !v ? (s.kt > 370 ? "Troppo veloce: togli un po' di manetta." : "Troppo lento: dai manetta.") : !a ? (s.ft > 10300 ? "Troppo alto: muso un filo giù." : "Troppo basso: muso un filo su.") : "Bene: piccole correzioni e aspetta che l'aereo si stabilizzi." }; } },
        { titolo: "Accelera a 450 kt", testo: "Porta la velocità fra 430 e 470 kt restando fra 9.600 e 10.400 ft per 15 secondi. Nota come il muso si abbassa.", tenere: 15,
          check: s => { const a = fascia(s.ft, 9600, 10400), v = fascia(s.kt, 430, 470);
            return { ok: a && v, dati: [D("Velocità", fmt(s.kt) + " kt", v, "430–470"), D("Quota", fmt(s.ft) + " ft", a, "9.600–10.400"), D("Assetto", fmt(s.pitch, 1) + "°", true, "")],
              msg: s.kt < 430 ? "Dai manetta (non serve il postbruciatore) e abbassa poco il muso mentre acceleri." : s.kt > 470 ? "Troppo veloce: riduci la manetta." : !a ? "Correggi la quota con la barra, piano." : "Così: più velocità, meno incidenza, muso più basso." }; } },
        { titolo: "Rallenta a 300 kt", testo: "Ora riduci fra 285 e 315 kt, sempre fra 9.600 e 10.400 ft, per 15 secondi. Il muso dovrà salire.", tenere: 15,
          check: s => { const a = fascia(s.ft, 9600, 10400), v = fascia(s.kt, 285, 315);
            return { ok: a && v, dati: [D("Velocità", fmt(s.kt) + " kt", v, "285–315"), D("Quota", fmt(s.ft) + " ft", a, "9.600–10.400"), D("Assetto", fmt(s.pitch, 1) + "°", true, "")],
              msg: s.kt > 315 ? "Manetta al minimo e aerofreno (B o FRENO): il Typhoon è molto 'pulito' e rallenta piano. Alza il muso quanto basta per restare in quota." : s.kt < 285 ? "Troppo lento: un po' di manetta." : !a ? "Correggi la quota con piccoli movimenti." : "Più lento = più incidenza = muso più alto." }; } }
      ],
      debrief: c => [`Assetto a 450 kt: ${fmt(c.pitch450 || 0, 1)}°; a 300 kt: ${fmt(c.pitch300 || 0, 1)}°. Con più velocità serve meno incidenza per la stessa portanza.`],
      sempre(s, c) { if (fascia(s.kt, 430, 470)) c.pitch450 = s.pitch; if (fascia(s.kt, 285, 315)) c.pitch300 = s.pitch; },
      stelle: (c, R) => R.durata < 150 ? 3 : R.durata < 260 ? 2 : 1 },

    { id: "V2", modulo: "volo", titolo: "Virate e fattore di carico", sotto: "Virate coordinate a 30° e 45°", durata: "7 min",
      obiettivo: "Virare a inclinazione costante (30° e 45°) senza perdere quota e sentire il fattore di carico.",
      teoria: [
        ["Perché si inclina", "Per virare l'aereo si inclina: la portanza, perpendicolare alle ali, si divide in una parte verticale che sostiene il peso e una orizzontale che fa curvare. Per non perdere quota la portanza totale deve crescere: si tira un poco la barra."],
        ["Il fattore di carico", "n = 1/cos φ, con φ l'inclinazione. A 30° si tirano 1,15 g, a 45° 1,41 g, a 60° 2 g, a 75° 3,9 g. Pilota e aereo pesano n volte tanto: in virata livellata a 60° un pilota di 80 kg pesa 160 kg."],
        ["Raggio e rateo", "Raggio r = V²/(g·tan φ), rateo ω = g·tan φ / V. Con una velocità vera di 350 kt (180 m/s) e 60° il raggio è di circa 1,9 km e un giro completo dura circa 66 secondi; a 30° il raggio sale a 5,7 km. Conta la velocità vera, che in quota è maggiore di quella indicata. Più velocità = virate più larghe; più inclinazione = virate più strette ma più G."],
        ["Il Typhoon in virata", "Con la barra al centro il controllo di volo aumenta da solo il fattore di carico quando inclini, ma non tiene il muso sull'orizzonte: a 30° basta una correzione minima, a 60° bisogna tenere la barra un poco indietro e guardare il muso. Il timone serve poco: sui caccia fly-by-wire la coordinazione è automatica."],
        ["La spirale discendente", "Se in virata stretta il muso scende sotto l'orizzonte, la velocità cresce e la virata si stringe in una spirale sempre più ripida: tirare la barra da inclinati la stringe ancora di più. Per uscirne prima si livellano le ali, poi si tira per riportare il muso sull'orizzonte e infine si toglie manetta. È un errore classico, anche di notte o in nube, quando non si vede l'orizzonte."]
      ],
      numeri: [["30° di inclinazione", "1,15 g · raggio 5,7 km a 350 kt veri"], ["45°", "1,41 g · raggio 3,3 km"], ["60°", "2 g · raggio 1,9 km · 5,4°/s"], ["Limiti del Typhoon", "+9 g / −3 g"], ["Uscita da una spirale", "ali livellate, poi barra indietro, poi manetta"]],
      setup(S) { piazza(S, { lat: 45.47, lon: 11.75, ft: 10000, kcas: 350, hdg: 75, thr: 0.55 }); armi(S, { colpi: 0, sel: "GUN" }); },
      fasi: [
        { titolo: "Virata a 30°", testo: "Inclina di 30° (fra 25° e 35°) da un lato e cambia prua di 90°, restando fra 9.600 e 10.400 ft.",
          inizio: (s, c) => { c.giro = 0; c.hPrec = s.hdg; },
          check: (s, c) => { const inc = fascia(Math.abs(s.roll), 25, 35), a = fascia(s.ft, 9600, 10400), dh = angd(c.hPrec, s.hdg); c.hPrec = s.hdg;
            if (inc && a) c.giro += Math.abs(dh); return { ok: c.giro >= 90, prog: c.giro / 90, dati: [D("Inclinazione", fmt(Math.abs(s.roll)) + "°", inc, "25–35"), D("Quota", fmt(s.ft) + " ft", a, "9.600–10.400"), D("G", fmt(s.g, 2), true, "≈ 1,15"), D("Prua cambiata", fmt(c.giro) + "°", c.giro >= 90, "90°")],
              msg: !inc ? (Math.abs(s.roll) < 25 ? "Più inclinazione: rollio fino a 30°." : "Troppa inclinazione: torna a 30°.") : !a ? "Correggi la quota con la barra." : "Tieni 30°: la prua gira da sola." }; } },
        { titolo: "Virata stretta a 45°", testo: "Ora 45° di inclinazione (fra 40° e 50°), circa 1,4 g: un giro completo di 360° fra 9.500 e 10.500 ft. È la virata stretta classica dell'addestramento.",
          inizio: (s, c) => { c.giro = 0; c.hPrec = s.hdg; c.gSom = 0; c.gT = 0; c.verso = 0; },
          check: (s, c, dt) => { const inc = fascia(Math.abs(s.roll), 40, 50), a = fascia(s.ft, 9500, 10500), dh = angd(c.hPrec, s.hdg); c.hPrec = s.hdg;
            if (inc && a) { c.giro += Math.abs(dh); c.gSom += s.g * dt; c.gT += dt; c.verso = Math.sign(s.roll); }
            return { ok: c.giro >= 360, prog: c.giro / 360, dati: [D("Inclinazione", fmt(Math.abs(s.roll)) + "°", inc, "40–50"), D("Quota", fmt(s.ft) + " ft", a, "9.500–10.500"), D("G", fmt(s.g, 2), fascia(s.g, 1.2, 1.8), "≈ 1,4"), D("Giro", fmt(c.giro) + "°", c.giro >= 360, "360°")],
              msg: s.pitch < -8 ? "SPIRALE: livella le ali, poi tira e riporta il muso sull'orizzonte." : !inc ? "Porta l'inclinazione a 45°." : !a ? (s.ft < 9500 ? "Il muso è sceso: un poco di barra indietro, tieni il muso sull'orizzonte." : "Stai salendo: allenta la barra.") : "A 45° servono 1,4 g: un poco di barra indietro e muso sull'orizzonte." }; } },
        { titolo: "Inversione", testo: "Rovescia la virata: 45° dall'altra parte per 180°, sempre fra 9.500 e 10.500 ft.",
          inizio: (s, c) => { c.giro2 = 0; c.hPrec = s.hdg; c.verso1 = c.verso || 1; },
          check: (s, c) => { const giusto = Math.sign(s.roll) === -c.verso1, inc = fascia(Math.abs(s.roll), 40, 50) && giusto, a = fascia(s.ft, 9500, 10500), dh = angd(c.hPrec, s.hdg); c.hPrec = s.hdg;
            if (inc && a) c.giro2 += Math.abs(dh); return { ok: c.giro2 >= 180, prog: c.giro2 / 180, dati: [D("Lato", giusto ? "giusto" : "rovescia", giusto, c.verso1 > 0 ? "sinistra" : "destra"), D("Inclinazione", fmt(Math.abs(s.roll)) + "°", fascia(Math.abs(s.roll), 40, 50), "40–50"), D("Quota", fmt(s.ft) + " ft", a, "9.500–10.500"), D("Giro", fmt(c.giro2) + "°", c.giro2 >= 180, "180°")],
              msg: !giusto ? "Rolla dall'altra parte passando per le ali livellate." : !inc ? "45° di inclinazione." : "Bene: stessa virata, lato opposto." }; } }
      ],
      debrief: c => [`Fattore di carico medio nella virata a 45°: ${fmt(c.gT ? c.gSom / c.gT : 0, 2)} g (teorico 1,41; nel simulatore di solito 1,6–1,8, perché in virata l'aereo derapa un poco e parte della portanza va persa).`, "Più inclinazione stringe la virata ma chiede più G e più portanza: per questo la barra va tenuta un poco indietro. A 60° servirebbero 2 g, a 75° quasi 4."],
      stelle: (c, R) => (c.gT && Math.abs(c.gSom / c.gT - 1.55) < 0.35 ? 1 : 0) + (R.durata < 260 ? 2 : R.durata < 380 ? 1 : 0) || 1 },

    { id: "V3", modulo: "volo", titolo: "Energia e limiti", sotto: "Salita, picchiata, virata a 5 g", durata: "7 min",
      obiettivo: "Capire come quota e velocità si scambiano e quanta energia costa una virata stretta.",
      teoria: [
        ["Energia totale", "Un aereo ha energia cinetica (velocità) e potenziale (quota) e le può scambiare: salendo perde velocità, scendendo ne guadagna. L'energia specifica Es = h + V²/2g è il conto in banca del pilota: passare da 400 a 500 kt vale circa 4.000 ft di quota."],
        ["Potenza in eccesso", "Ps = (T − D)·V / W indica quanti metri al secondo di energia l'aereo guadagna o perde. Con il postbruciatore il Typhoon ha Ps positivo anche in salita ripida; in virata stretta la resistenza indotta cresce con il quadrato dei G e Ps diventa negativo: l'aereo rallenta, 'brucia' energia."],
        ["Velocità d'angolo", "La velocità d'angolo (corner speed) è la velocità minima alla quale si possono tirare i G massimi: sotto, l'ala arriva all'incidenza massima prima dei 9 g; sopra, si vira più largo. Per un caccia moderno è intorno ai 330–360 kt: è la velocità della virata più stretta e più rapida."],
        ["Limiti e corpo umano", "Il controllo di volo non lascia superare +9 g / −3 g né l'incidenza massima (28° nel simulatore). Il pilota indossa la tuta anti-G e fa la manovra di contrazione muscolare: senza, sopra i 5-6 g il sangue lascia il cervello, si perde la vista e poi la coscienza (G-LOC)."]
      ],
      numeri: [["Limiti strutturali", "+9 g / −3 g"], ["Incidenza massima (simulatore)", "28°"], ["Velocità d'angolo indicativa", "330–360 kt"], ["Postbruciatore", "manetta oltre l'80%: +50% di spinta (da 60 a 90 kN per motore), consumo circa triplo"]],
      setup(S) { piazza(S, { lat: 45.45, lon: 11.75, ft: 10000, kcas: 400, hdg: 70, thr: 0.7 }); armi(S, { colpi: 0, sel: "GUN" }); },
      fasi: [
        { titolo: "Salita", testo: "Sali a 15.000 ft senza scendere sotto i 250 kt: manetta piena (postbruciatore) e muso su di 15–25°.",
          check: s => { const a = s.ft >= 15000, v = s.kt >= 250;
            return { ok: a && v, prog: clamp((s.ft - 10000) / 5000, 0, 1), dati: [D("Quota", fmt(s.ft) + " ft", a, "≥ 15.000"), D("Velocità", fmt(s.kt) + " kt", v, "≥ 250"), D("Manetta", fmt(s.thr * 100) + "%", s.thr > 0.8, "AB > 80%")],
              msg: !v ? "Stai perdendo troppa velocità: abbassa il muso." : s.thr <= 0.8 ? "Manetta oltre l'80% per il postbruciatore." : "Guarda la velocità calare mentre sali: energia cinetica che diventa quota." }; } },
        { titolo: "Picchiata", testo: "Muso giù: scendi verso 9.000 ft e accelera oltre i 480 kt senza andare sotto gli 8.000 ft.",
          check: s => { const v = s.kt >= 480, a = fascia(s.ft, 8000, 12000);
            return { ok: v && a, dati: [D("Velocità", fmt(s.kt) + " kt", v, "≥ 480"), D("Quota", fmt(s.ft) + " ft", s.ft >= 8000, "≥ 8.000")],
              msg: s.ft < 8000 ? "Troppo bassa: richiama!" : !v ? "Quota che diventa velocità: muso giù di 10–15°." : "Livella fra 8.000 e 12.000 ft." }; } },
        { titolo: "Virata a 5 g", testo: "Togli il postbruciatore (manetta sotto l'80%), inclina a circa 80° e tira fino a 5 g: tienili fra 4,5 e 6,5 g per 8 secondi. Guarda la velocità che cala.", tenere: 8,
          inizio: (s, c) => { c.vIn = null; },
          check: (s, c) => { const g = fascia(s.g, 4.5, 6.5), mil = s.thr <= 0.8, ok = g && mil; if (ok) { if (c.vIn == null) c.vIn = s.kt; c.vOut = s.kt; }
            return { ok, dati: [D("G", fmt(s.g, 1), g, "4,5–6,5"), D("Manetta", fmt(s.thr * 100) + "%", mil, "≤ 80%"), D("Velocità", fmt(s.kt) + " kt", true, ""), D("Quota", fmt(s.ft) + " ft", s.ft > 3000, "")],
              msg: !mil ? "Senza postbruciatore: manetta sotto l'80%." : s.g < 4.5 ? "Più inclinazione e tira la barra." : s.g > 6.5 ? "Troppi G: allenta." : "Senti come calano i nodi: la virata stretta costa energia." }; } },
        { titolo: "Recupera", testo: "Livella le ali (meno di 10°) e riporta la velocità sopra i 400 kt fra 8.000 e 14.000 ft.",
          check: s => { const r = Math.abs(s.roll) < 10, v = s.kt >= 400, a = fascia(s.ft, 8000, 14000);
            return { ok: r && v && a, dati: [D("Ali", fmt(Math.abs(s.roll)) + "°", r, "< 10°"), D("Velocità", fmt(s.kt) + " kt", v, "≥ 400"), D("Quota", fmt(s.ft) + " ft", a, "8.000–14.000")],
              msg: !r ? "Ali livellate." : !v ? "Postbruciatore e muso leggermente giù per riguadagnare energia." : "Quota fra 8.000 e 14.000 ft." }; } }
      ],
      debrief: c => [c.vIn && c.vOut ? `Durante gli 8 secondi a 5 g la velocità è passata da ${fmt(c.vIn)} a ${fmt(c.vOut)} kt: ${fmt(c.vIn - c.vOut)} kt di energia spesi in una sola virata.` : "La virata stretta consuma energia: in combattimento si vira forte solo quando serve.", "Salita e picchiata trasformano energia, non la creano: solo il motore la aggiunge."],
      stelle: (c, R) => R.durata < 200 ? 3 : R.durata < 320 ? 2 : 1 },

    { id: "V4", modulo: "volo", titolo: "Decollo", sotto: "Dalla pista 08 di Istrana", durata: "5 min", partenza: "pista",
      obiettivo: "Decollare in postbruciatore, ruotare alla velocità giusta, retrarre il carrello e salire.",
      teoria: [
        ["La pista di Istrana", "La pista 08/26 di Istrana, sede del 51° Stormo, è lunga circa 3 km e orientata a 082° (rotta vera). Si decolla controvento: con il vento da 040° a 10 kt si usa la 08, con circa 7 kt di componente frontale che accorciano la corsa e 7 kt di vento al traverso."],
        ["La corsa di decollo", "Freni, manetta al massimo (postbruciatore per lo scramble o con carico pesante), rilascio dei freni. A circa 150 kt si tira dolcemente la barra (rotazione) fino a 10–12° di assetto e l'aereo si stacca da solo quando l'ala porta il suo peso: nel simulatore, con 15,5 t, fra 180 e 200 kt. Una rotazione brusca fa strisciare la coda sulla pista."],
        ["Dopo lo stacco", "Con il variometro positivo si retrae il carrello: gambe e portelle hanno un limite di velocità (nel simulatore 300 kt) oltre il quale si danneggiano. Poi si toglie il postbruciatore e si sale a 300–400 kt."],
        ["Se qualcosa va storto", "Prima della velocità di decisione si interrompe il decollo con manetta al minimo e freni; dopo, si decolla comunque e si gestisce l'avaria in volo: c'è più pista dietro di te che davanti."]
      ],
      numeri: [["Pista 08/26 di Istrana", "circa 3.000 m, rotta vera 082°, quota 137 ft"], ["Vento", "040° 10 kt: 7 kt frontali, 7 kt al traverso"], ["Rotazione e stacco nel simulatore", "rotazione a circa 150 kt, stacco a 180–200 kt"], ["Carrello su", "prima di 300 kt"]],
      setup(S) { armi(S, { colpi: 0, sel: "GUN" }); S.thr = 0; },
      fasi: [
        { titolo: "Manetta e corsa", testo: "Porta la manetta oltre l'80% (postbruciatore) e lascia correre l'aereo sulla pista.",
          check: s => ({ ok: s.thr > 0.8 && s.kt > 40, dati: [D("Manetta", fmt(s.thr * 100) + "%", s.thr > 0.8, "> 80%"), D("Velocità", fmt(s.kt) + " kt", s.kt > 40, "")], msg: s.thr <= 0.8 ? "Manetta avanti fino al postbruciatore (Shift o R; su telefono la manetta a destra)." : "Corsa di decollo: tieni l'asse." }) },
        { titolo: "Rotazione e stacco", testo: "A circa 150 kt tira dolcemente la barra fino a 10–12° di assetto: staccati dalla pista.",
          check: (s, c) => { if (!s.terra && c.vStacco == null) c.vStacco = s.kt; const ok = !s.terra && s.agl > 15;
            return { ok, dati: [D("Velocità", fmt(s.kt) + " kt", s.kt >= 140, "rotazione ≈ 150"), D("Assetto", fmt(s.pitch, 1) + "°", fascia(s.pitch, 6, 16), "10–12°"), D("Altezza", fmt(s.aglFt) + " ft", ok, "> 50")],
              msg: s.terra && s.kt < 140 ? "Aspetta la velocità di rotazione." : s.terra ? "Ora: barra indietro, dolcemente." : "Staccato: tieni 10–12° di assetto." }; } },
        { titolo: "Carrello su", testo: "Con il variometro positivo retrai il carrello (tasto G o GEAR) prima di superare 300 kt.",
          check: s => ({ ok: !s.carrello, dati: [D("Carrello", s.carrello ? "fuori" : "dentro", !s.carrello, "dentro"), D("Velocità", fmt(s.kt) + " kt", s.kt < 300, "< 300"), D("Variometro", fmt(s.vs) + " ft/min", s.vs > 0, "> 0")],
            msg: s.vs <= 0 ? "Prima il variometro positivo, poi il carrello." : "Carrello su: tasto G o GEAR." }) },
        { titolo: "Salita a 5.000 ft", testo: "Sali a 5.000 ft e stabilizza la velocità fra 300 e 450 kt per 5 secondi.", tenere: 5,
          check: s => { const a = s.ft >= 5000, v = fascia(s.kt, 300, 450);
            return { ok: a && v, dati: [D("Quota", fmt(s.ft) + " ft", a, "≥ 5.000"), D("Velocità", fmt(s.kt) + " kt", v, "300–450")], msg: !a ? "Continua a salire." : !v ? (s.kt > 450 ? "Togli il postbruciatore." : "Più manetta.") : "Ottimo decollo." }; } }
      ],
      fallimento: (s, c) => s.carrello && !s.terra && s.kt > 300 ? "Carrello esteso oltre 300 kt: portelle e gambe danneggiate." : null,
      debrief: c => [c.vStacco ? `Stacco a ${fmt(c.vStacco)} kt.` : "", "Il decollo è una sequenza fissa: potenza, controlli, rotazione, carrello, salita."].filter(Boolean),
      stelle: (c, R) => (c.vStacco && fascia(c.vStacco, 150, 215) ? 2 : 1) + (R.durata < 150 ? 1 : 0) },

    { id: "V5", modulo: "volo", titolo: "Avvicinamento e atterraggio", sotto: "Sentiero di 3° sulla pista 08", durata: "6 min",
      obiettivo: "Configurare l'aereo, seguire il sentiero di discesa e toccare dolcemente la pista.",
      teoria: [
        ["Il sentiero di 3°", "Gli avvicinamenti seguono un sentiero di 3°: si scende di circa 300 ft per ogni miglio nautico. A 8 NM dalla pista si è a circa 2.500 ft sopra la soglia, a 4 NM a 1.300 ft, a 2 NM a 650 ft. Regola rapida: variometro (ft/min) ≈ 5 × velocità al suolo (kt), cioè circa 850 ft/min a 170 kt."],
        ["La configurazione", "Carrello giù prima del sentiero e velocità stabile. I caccia volano l'avvicinamento a incidenza costante: la velocità giusta dipende dal peso e dal carburante rimasto. Nel simulatore si atterra bene fra 160 e 180 kt."],
        ["Asse e richiamata", "Il prolungamento dell'asse pista si intercetta presto, con correzioni piccole e continue. Sopra la soglia si riduce la manetta, si alza leggermente il muso (richiamata) e si tocca prima con le ruote principali."],
        ["Avvicinamento stabilizzato", "A 2 NM dalla soglia l'aereo deve essere stabilizzato: sul sentiero, sull'asse, alla velocità giusta e configurato. Se non lo è, non si 'salva' l'atterraggio: si dà motore, si riattacca (go-around) e si rifà il circuito. È una delle regole che evitano più incidenti."],
        ["Contatto e frenata", "Un buon atterraggio tocca con meno di 600 ft/min di discesa (circa 3 m/s): oltre 885 ft/min (4,5 m/s) il carrello del simulatore cede. Dopo il contatto: manetta al minimo e freni (tasto B o FRENO) fino a fermarsi in pista."]
      ],
      numeri: [["Sentiero", "3°: circa 300 ft per miglio nautico"], ["A 8 / 4 / 2 NM", "2.500 / 1.300 / 650 ft sopra la soglia"], ["Discesa al contatto", "meno di 600 ft/min (il carrello cede oltre 885)"], ["Pista", "08 di Istrana, rotta vera 082°"]],
      setup(S, c) { const p = S.pista, thr = { x: p.x - p.ux * p.L / 2, z: p.z - p.uz * p.L / 2 }, d = 8 * NM;
        c.thr = thr; piazza(S, { x: thr.x - p.ux * d, z: thr.z - p.uz * d, y: p.y + d * Math.tan(3 * D2R), kcas: 200, hdg: p.hdg, thr: 0.3, pitch: 0 }); armi(S, { colpi: 0, sel: "GUN" }); },
      sempre(s, c) { const p = s.S.pista, dx = s.x - c.thr.x, dz = s.z - c.thr.z; c.d = -(dx * p.ux + dz * p.uz); c.lat = dx * -p.uz + dz * p.ux;
        c.gs = Math.atan2(s.y - p.y, Math.max(1, c.d)) * R2D; c.loc = Math.atan2(c.lat, Math.max(200, c.d)) * R2D; if (!s.terra) c.vsUlt = s.vs; },
      fasi: [
        { titolo: "Configura", testo: "Abbassa il carrello (G o GEAR) e stabilizza la velocità fra 160 e 190 kt.", tenere: 3,
          check: s => ({ ok: s.carrello && fascia(s.kt, 160, 190), dati: [D("Carrello", s.carrello ? "fuori" : "dentro", s.carrello, "fuori"), D("Velocità", fmt(s.kt) + " kt", fascia(s.kt, 160, 190), "160–190")],
            msg: !s.carrello ? "Carrello giù: tasto G o GEAR." : s.kt > 190 ? "Riduci la manetta (puoi usare l'aerofreno: B)." : s.kt < 160 ? "Un po' di manetta." : "Configurato." }) },
        { titolo: "Sul sentiero", testo: "Segui il sentiero di 3° allineato alla pista fino a 2 NM: fra 2° e 4° di sentiero e entro 2° dall'asse.",
          inizio: (s, c) => { c.tIn = 0; c.tTot = 0; },
          check: (s, c, dt) => { const gs = fascia(c.gs, 2, 4), loc = Math.abs(c.loc) <= 2; c.tTot += dt; if (gs && loc) c.tIn += dt;
            return { ok: c.d <= 2 * NM, prog: clamp(1 - (c.d - 2 * NM) / (6 * NM), 0, 1), dati: [D("Distanza", fmt(c.d / NM, 1) + " NM", true, "fino a 2"), D("Sentiero", fmt(c.gs, 1) + "°", gs, "2–4°"), D("Asse", fmt(c.loc, 1) + "°", loc, "± 2°"), D("Velocità", fmt(s.kt) + " kt", fascia(s.kt, 155, 195), "160–190")],
              msg: !loc ? (c.loc > 0 ? "Sei a destra dell'asse: correggi verso sinistra." : "Sei a sinistra dell'asse: correggi verso destra.") : c.gs > 4 ? "Troppo alto: scendi di più (muso giù, manetta giù)." : c.gs < 2 ? "Troppo basso: risali sul sentiero (manetta)." : `Sul sentiero: variometro circa ${fmt(5 * s.kt, 0)} ft/min.` }; } },
        { titolo: "Atterraggio", testo: "Sopra la soglia riduci, richiama dolcemente e tocca la pista con meno di 600 ft/min.",
          check: (s, c) => { if (s.terra && c.vsTocco == null) c.vsTocco = Math.abs(c.vsUlt || 0);
            return { ok: s.terra, dati: [D("Altezza", fmt(s.aglFt) + " ft", true, ""), D("Variometro", fmt(s.vs) + " ft/min", s.vs > -600, "> −600"), D("Velocità", fmt(s.kt) + " kt", s.kt < 200, "")],
              msg: s.aglFt > 100 ? "Mira alla soglia, velocità stabile." : s.vs < -600 ? "Scendi troppo forte: un filo di barra indietro." : "Richiamata dolce..." }; } },
        { titolo: "Frenata", testo: "Manetta al minimo e freni (B o FRENO): fermati sulla pista sotto i 20 kt.",
          check: s => ({ ok: s.terra && s.kt < 20, dati: [D("Velocità", fmt(s.kt) + " kt", s.kt < 20, "< 20"), D("Manetta", fmt(s.thr * 100) + "%", s.thr < 0.1, "minimo")], msg: s.thr > 0.1 ? "Manetta al minimo." : "Freni: tieni premuto B o FRENO." }) }
      ],
      fallimento: (s, c) => { if (c.d == null || s.terra) return null;
        if (!c.stab && c.d <= 2 * NM) { c.stab = true; if (!(fascia(c.gs, 1.5, 5) && Math.abs(c.loc) <= 4 && fascia(s.kt, 150, 200))) return `Avvicinamento non stabilizzato a 2 NM (sentiero ${fmt(c.gs, 1)}°, asse ${fmt(c.loc, 1)}°, ${fmt(s.kt)} kt): in realtà si riattacca e si riprova.`; }
        if (c.d < -s.S.pista.L) return "Pista superata senza atterrare: riattaccata.";
        return null; },
      debrief: c => [c.vsTocco != null ? `Discesa al contatto: ${fmt(c.vsTocco)} ft/min${c.vsTocco < 600 ? " (ottimo)" : " (duro)"}.` : "", c.tTot ? `Sul sentiero e sull'asse per il ${fmt(100 * c.tIn / c.tTot)}% del tempo.` : ""].filter(Boolean),
      stelle: c => (c.vsTocco != null && c.vsTocco < 600 ? 2 : 1) + (c.tTot && c.tIn / c.tTot > 0.6 ? 1 : 0) },

    /* ---------------- MODULO 2 · ARMI ---------------- */
    { id: "A1", modulo: "armi", titolo: "Il cannone", sotto: "Mauser BK-27 contro un bersaglio in virata", durata: "5 min", nemici: 1,
      obiettivo: "Selezionare il cannone, inseguire un bersaglio in virata e colpirlo con raffiche brevi.",
      teoria: [
        ["Il Mauser BK-27", "Il Typhoon ha un cannone revolver Mauser BK-27 da 27 mm: 1.700 colpi al minuto, circa 1.025 m/s alla volata, 150 colpi a bordo, cioè 5 secondi di fuoco. Si spara a raffiche brevi, mezzo secondo alla volta."],
        ["Tempo di volo e anticipo", "I proiettili impiegano circa un secondo per fare 1.000 m: nel frattempo il bersaglio si sposta e i colpi cadono per gravità. Il mirino a calcolo d'anticipo (il 'pipper' nel visore) mostra dove passeranno: lo si porta sul bersaglio, lo si tiene fermo (tracking) e si spara. Distanza utile 300–900 m."],
        ["Inseguimento", "Per sparare a un aereo in virata bisogna stare dentro la sua virata con il muso in anticipo (lead pursuit). Con il muso indietro (lag) i colpi passano dietro; con troppa velocità si finisce davanti a lui (overshoot) e i ruoli si invertono."],
        ["Il bersaglio", "In addestramento si spara a bersagli trainati o a droni. Qui l'avversario simulato è un Su-35 disarmato che vola un circuito a circa 320 kt: tratti rettilinei di 25 secondi e virate di 180° a destra a 1,5 g, come un bersaglio cooperativo. Sul tratto dritto la mira è più facile; in virata serve più anticipo. Si parte dalla posizione classica d'esercitazione ('perch'): 1,8 km dietro, 1.000 ft più alti e 30° fuori dalla sua coda. Da lì si entra nella sua virata, si scende verso la sua coda usando la quota in più e si chiude fino a 500–900 m."]
      ],
      numeri: [["Cannone", "Mauser BK-27 · 27 mm · 1.700 colpi/min · 150 colpi"], ["Velocità alla volata", "circa 1.025 m/s"], ["Distanza di tiro", "300–900 m (simulatore: fino a 1.200 m)"], ["Bersaglio", "Su-35 disarmato, circa 320 kt: tratti dritti di 25 s e virate di 180° a destra a 1,5 g"], ["Partenza", "perch: 1,8 km dietro, 1.000 ft più alto, 30° fuori dalla sua coda"]],
      setup(S, c) { const t0 = avanti(xz(45.30, 12.55), 45, 1800), p0 = avanti(t0, 255, 1800);   // perch: 1,8 km dietro, 30° fuori dalla coda (lato esterno della virata)
        piazza(S, Object.assign({}, p0, { ft: 16000, kcas: 300, hdg: 45, thr: 0.6 })); armi(S, { AIM120: 2, AIM9X: 2, sel: "AIM120" });
        piazzaNemico(S, 0, Object.assign({}, t0, { ft: 15000, kt: 320, hdg: 45, hp: 3, nome: "Bersaglio (Su-35)", guida: circuito(15000 / FT, 165, 1.5, 1, 25) })); c.colpi0 = S.pl.colpi; },
      fasi: [
        { titolo: "Seleziona il cannone", testo: "Premi ARMA (tasto X) finché nel visore compare GUN.",
          check: s => ({ ok: s.arma === "GUN", dati: [D("Arma", s.arma, s.arma === "GUN", "GUN")], msg: "Tasto X o ARMA." }) },
        { titolo: "Insegui", testo: "Portati in coda al bersaglio entro 900 m, dentro la sua virata, e restaci 2 secondi.", tenere: 2,
          check: s => { const e = nemico(s.S, 0), d = e.pos.distanceTo(s.P.pos), asp = aspetto(s, e), ok = d < 900 && asp < 60;
            return { ok: ok || !e.vivo, dati: [D("Distanza", fmt(d) + " m", d < 900, "< 900"), D("In coda", fmt(asp) + "°", asp < 60, "< 60°")], msg: d > 900 ? "Taglia dentro la sua virata per accorciare." : asp >= 60 ? "Spostati dietro di lui." : "In posizione." }; } },
        { titolo: "Fuoco", testo: "Metti il pipper sul bersaglio e spara raffiche brevi (barra spaziatrice o FUOCO) fino ad abbatterlo.",
          check: s => { const e = nemico(s.S, 0), d = e.pos.distanceTo(s.P.pos);
            return { ok: !e.vivo, dati: [D("Distanza", fmt(d) + " m", fascia(d, 300, 900), "300–900"), D("Colpi rimasti", s.P.colpi, s.P.colpi > 0, ""), D("A segno", s.S.stats.colpi, true, "")], msg: d < 300 ? "Troppo vicino: rischi l'urto con i rottami." : d > 900 ? "Troppo lontano per il cannone." : "Pipper sul bersaglio, raffica breve." }; } }
      ],
      sempre(s, c) { if (c.lanciPrima == null) c.lanciPrima = s.S.stats.lanci; },
      fallimento: (s, c) => { if (c.lanciPrima != null && s.S.stats.lanci > c.lanciPrima) return "Hai lanciato un missile: in questa lezione si spara solo con il cannone (GUN).";
        const e = nemico(s.S, 0); return e && e.vivo && s.P.colpi <= 0 ? "Munizioni finite: con raffiche più brevi e più vicino si spreca meno." : null; },
      debrief: (c, R) => { const sp = c.colpi0 - R.S.pl.colpi, a = R.S.stats.colpi; return [`Colpi sparati ${sp}, a segno ${a} (${fmt(sp ? 100 * a / sp : 0)}%).`, "Anche al poligono la maggior parte dei colpi va a vuoto: conta la posizione prima della mira, poi raffiche brevi con il pipper fermo sul bersaglio."]; },
      stelle: (c, R) => { const sp = c.colpi0 - R.S.pl.colpi, p = sp ? R.S.stats.colpi / sp : 0; return p >= 0.15 ? 3 : p >= 0.08 ? 2 : 1; } },

    { id: "A2", modulo: "armi", titolo: "Missile a infrarosso", sotto: "AIM-9X Sidewinder", durata: "5 min", nemici: 1,
      obiettivo: "Agganciare con il sensore a infrarossi e lanciare dentro la zona di lancio.",
      teoria: [
        ["Come funziona", "L'AIM-9X Sidewinder segue il calore del bersaglio con un sensore a immagine infrarossa ed è 'spara e dimentica': dopo il lancio si guida da solo con la navigazione proporzionale, cioè vira in proporzione a quanto ruota la linea di mira verso il bersaglio."],
        ["Il tono", "Il sensore aggancia da solo un bersaglio nel suo campo (nel simulatore entro 30° dal muso) e in cuffia si sente il tono acuto. Con il visore nel casco l'AIM-9X reale può agganciare fino a circa 90° dal muso."],
        ["La zona di lancio", "Troppo vicino il missile non fa in tempo ad armarsi e a manovrare (minimo circa 400 m); troppo lontano finisce l'energia. La portata cresce con la quota e con la velocità di avvicinamento: in coda a un bersaglio che si allontana è molto più corta che frontalmente. Nel simulatore va da 3 a 18 km."],
        ["Contromisure", "Il bersaglio può lanciare flare, esche più calde del motore, e virare. I sensori a immagine li riconoscono meglio dei vecchi missili, ma non sempre: per questo si lancia da vicino e da dietro, dove il calore degli scarichi è massimo."]
      ],
      numeri: [["AIM-9X", "lunghezza 3 m, massa 85 kg, sensore IR a immagine, ugello orientabile"], ["Portata nel simulatore", "minimo 0,4 km; massimo 3–18 km secondo quota e avvicinamento"], ["Chiamata radio", "«FOX TWO»"], ["Carico", "2 AIM-9X e cannone scarico, come in un tiro d'addestramento"], ["Bersaglio", "Su-35 disarmato 5 km davanti, in volo rettilineo; lancia flare se minacciato"]],
      setup(S) { const p0 = xz(45.22, 12.42); piazza(S, Object.assign({}, p0, { ft: 15000, kcas: 350, hdg: 60, thr: 0.65 })); armi(S, { AIM9X: 2, colpi: 0, sel: "GUN" });
        piazzaNemico(S, 0, Object.assign(avanti(p0, 60, 5000), { ft: 15000, kt: 330, hdg: 60, nome: "Bersaglio (Su-35)", guida: dritto(15000 / FT, 170) })); },
      fasi: [
        { titolo: "Seleziona l'AIM-9X", testo: "Premi ARMA (tasto X) finché compare AIM-9X.", check: s => ({ ok: s.arma === "AIM9X", dati: [D("Arma", s.arma, s.arma === "AIM9X", "AIM-9X")], msg: "Tasto X o ARMA." }) },
        { titolo: "Tono e aggancio", testo: "Porta il bersaglio entro 30° dal muso: il sensore aggancia da solo (LOCK).",
          check: s => { const e = nemico(s.S, 0), off = fuoriAsse(s, e.pos), ok = !!(s.lock && s.lock.ok && s.lock.t === e);
            return { ok, dati: [D("Fuori asse", fmt(off) + "°", off < 30, "< 30°"), D("Distanza", fmt(e.pos.distanceTo(s.P.pos) / 1000, 1) + " km", true, ""), D("Aggancio", ok ? "LOCK" : "—", ok, "LOCK")], msg: off >= 30 ? "Punta il muso verso il bersaglio." : "Aspetta il tono..." }; } },
        { titolo: "Lancio in portata", testo: "Quando la distanza è dentro la zona di lancio premi FUOCO (barra spaziatrice).",
          check: (s, c) => { const e = nemico(s.S, 0), r = e.pos.distanceTo(s.P.pos), z = VOLO._acc.dlz("AIM9X", r, s.lock && s.lock.vc), dentro = r > z.rmin && r < z.rmax;
            const lanciato = s.S.stats.lanci > (c.lanciPrima || 0); if (lanciato && c.rLancio == null) { c.rLancio = r; c.zLancio = z; }
            return { ok: lanciato, dati: [D("Distanza", fmt(r / 1000, 1) + " km", dentro, `${fmt(z.rmin / 1000, 1)}–${fmt(z.rmax / 1000, 1)} km`), D("Aggancio", s.lock && s.lock.ok ? "LOCK" : "—", !!(s.lock && s.lock.ok), "LOCK")], msg: !dentro ? (r > z.rmax ? "Troppo lontano: avvicinati." : "Troppo vicino.") : "Dentro la zona: FUOCO!" }; } },
        { titolo: "Splash", testo: "Segui il missile. Se il bersaglio sfugge, hai un secondo AIM-9X.",
          check: s => { const e = nemico(s.S, 0); return { ok: !e.vivo, dati: [D("Bersaglio", e.vivo ? "in volo" : "abbattuto", !e.vivo, ""), D("AIM-9X rimasti", s.P.armi.AIM9X, true, "")], msg: e.vivo && !missiliMiei(s.S).some(m => m.vivo) ? "Mancato: riaggancia e rilancia." : "Il missile vola da solo." }; } }
      ],
      sempre(s, c) { if (c.lanciPrima == null) c.lanciPrima = s.S.stats.lanci; },
      fallimento: s => { const e = nemico(s.S, 0); return e.vivo && s.P.armi.AIM9X <= 0 && !missiliMiei(s.S).some(m => m.vivo) ? "AIM-9X esauriti: il bersaglio ha schivato con flare e virata. Lancia più vicino e più in coda." : null; },
      debrief: c => [c.rLancio ? `Lancio a ${fmt(c.rLancio / 1000, 1)} km, con zona di lancio fra ${fmt(c.zLancio.rmin / 1000, 1)} e ${fmt(c.zLancio.rmax / 1000, 1)} km.` : "", "In coda il missile insegue un bersaglio che si allontana: la portata utile è molto più corta della portata massima."].filter(Boolean),
      stelle: (c, R) => R.S.pl.armi.AIM9X >= 1 ? 3 : 2 },

    { id: "A3", modulo: "armi", titolo: "Oltre il raggio visivo", sotto: "AIM-120 AMRAAM contro un Su-35 armato", durata: "6 min", nemici: 1, diff: "recluta",
      obiettivo: "Agganciare con il radar, lanciare dentro Rmax, virare per mantenere la distanza (crank) e sopravvivere.",
      teoria: [
        ["Il combattimento BVR", "Oltre il raggio visivo (Beyond Visual Range) si combatte con il radar: chi lancia per primo con buone probabilità di colpire ha un grande vantaggio. L'AIM-120 AMRAAM vola guidato dai dati del caccia, poi negli ultimi chilometri accende il proprio radar ('pitbull') e diventa autonomo."],
        ["Rmax e Rne", "Rmax è la portata massima contro un bersaglio che non manovra; Rne (no escape) la distanza entro cui il bersaglio non riesce a sfuggire nemmeno invertendo la rotta. Nel simulatore Rmax cresce con la quota (2,4 km ogni 1.000 m) e con la velocità di avvicinamento: a 25.000 ft, frontali, circa 55 km."],
        ["Crank e F-pole", "Dopo il lancio si vira di 40–60° rispetto al bersaglio (crank): il radar continua a vederlo ma la velocità di avvicinamento cala, così un eventuale missile nemico deve volare di più. L'F-pole è la distanza dal bersaglio quando il tuo missile lo colpisce: più è grande, più sei al sicuro."],
        ["L'avversario", "Un Su-35 armato di un R-77, missile radar attivo simile all'AMRAAM, ti viene incontro. Lancerà appena sarai sotto i 26 km con il suo muso su di te: devi colpirlo prima, oppure difenderti (lo imparerai nel modulo Difesa)."]
      ],
      numeri: [["AIM-120C", "lunghezza 3,7 m, massa circa 160 kg, radar attivo"], ["Portata nel simulatore", "Rmax ≈ 28 km + 2,4 km ogni 1.000 m di quota + avvicinamento; minimo 1,5 km"], ["R-77 nemico", "lancio sotto i 26 km con il muso su di te"], ["Chiamata", "«FOX THREE»"]],
      setup(S) { const p0 = xz(45.30, 11.80); piazza(S, Object.assign({}, p0, { ft: 25000, kcas: 350, hdg: 90, thr: 0.7 })); armi(S, { AIM120: 4, AIM9X: 2, sel: "AIM9X" });
        piazzaNemico(S, 0, Object.assign(avanti(p0, 90, 60000), { ft: 25000, kt: 480, hdg: 270, missili: { R77: 1 }, cad: 0, nome: "Su-35" })); },
      fasi: [
        { titolo: "Radar e aggancio", testo: "Seleziona l'AIM-120 (ARMA) e aggancia il Su-35 con LOCK (tasto T) quando è sotto gli 80 km.",
          check: s => { const e = nemico(s.S, 0), r = e.pos.distanceTo(s.P.pos), ok = s.arma === "AIM120" && !!(s.lock && s.lock.ok && s.lock.t === e);
            return { ok, dati: [D("Arma", s.arma, s.arma === "AIM120", "AIM-120"), D("Distanza", fmt(r / 1000) + " km", r < 80000, "< 80"), D("Aggancio", s.lock && s.lock.ok ? "LOCK" : "—", ok, "LOCK")], msg: s.arma !== "AIM120" ? "ARMA fino a AIM-120." : "LOCK (tasto T) con il bersaglio davanti." }; } },
        { titolo: "Lancio in portata", testo: "Lancia quando la distanza è inferiore a Rmax: FOX THREE.",
          check: (s, c) => { const e = nemico(s.S, 0), r = e.pos.distanceTo(s.P.pos), z = VOLO._acc.dlz("AIM120", r, s.lock && s.lock.vc), lanciato = missiliMiei(s.S, "AIM120").length > 0 || s.P.armi.AIM120 < 4;
            if (lanciato && c.rLancio == null) { c.rLancio = r; c.rmax = z.rmax; }
            return { ok: lanciato, dati: [D("Distanza", fmt(r / 1000, 1) + " km", r < z.rmax, `Rmax ${fmt(z.rmax / 1000)} km`), D("Aggancio", s.lock && s.lock.ok ? "LOCK" : "—", !!(s.lock && s.lock.ok), "")], msg: r > z.rmax ? "Fuori portata: aspetta di entrare in Rmax." : "In portata: FUOCO." }; } },
        { titolo: "Crank", testo: "Vira di 40–60° rispetto alla direzione del Su-35 e tienilo lì per 8 secondi, mentre il missile vola.", tenere: 8,
          check: s => { const e = nemico(s.S, 0), off = e.vivo ? fuoriAsse(s, e.pos) : 50, ok = fascia(off, 35, 70) || !e.vivo;
            return { ok, dati: [D("Angolo dal bersaglio", fmt(off) + "°", fascia(off, 35, 70), "40–60°"), D("Distanza", fmt(e.pos.distanceTo(s.P.pos) / 1000, 1) + " km", true, "")], msg: off < 35 ? "Vira di più: porta il bersaglio di lato." : off > 70 ? "Troppo: non perderlo dal radar." : "Crank: il missile vola, tu non ti avvicini troppo." }; } },
        { titolo: "Splash", testo: "Aspetta l'impatto. Se lancia il suo R-77: vira al traverso, scendi e lancia chaff (C).",
          check: (s, c) => { const e = nemico(s.S, 0); if (!e.vivo && c.fpole == null) c.fpole = e.pos.distanceTo(s.P.pos);
            const minaccia = missiliControDiMe(s.S).length > 0; return { ok: !e.vivo, dati: [D("Su-35", e.vivo ? "in volo" : "abbattuto", !e.vivo, ""), D("Missile nemico", minaccia ? "IN ARRIVO" : "nessuno", !minaccia, "")], msg: minaccia ? "MISSILE: vira a 90° dal missile, scendi, chaff!" : e.vivo && !missiliMiei(s.S).some(m => m.vivo) ? "Mancato: riaggancia e rilancia." : "Il missile è in volo." }; } }
      ],
      sempre(s, c) { if (c.lanciPrima == null) c.lanciPrima = s.S.stats.lanci; const e = nemico(s.S, 0); if (e && e.missili.R77 === 0 && !c.r77) { c.r77 = true; c.r77dist = e.pos.distanceTo(s.P.pos); } },
      fallimento: s => { const e = nemico(s.S, 0); if (!e.vivo && R && R.i < 2) return "Su-35 abbattuto prima di lanciare l'AIM-120: in questa lezione il primo colpo è l'AMRAAM, oltre il raggio visivo.";
        return e.vivo && s.P.armi.AIM120 <= 0 && s.P.armi.AIM9X <= 0 && !missiliMiei(s.S).some(m => m.vivo) ? "Missili esauriti." : null; },
      debrief: (c, R) => [c.rLancio ? `Lancio a ${fmt(c.rLancio / 1000, 1)} km (Rmax ${fmt(c.rmax / 1000)} km).` : "", c.fpole ? `F-pole: ${fmt(c.fpole / 1000, 1)} km dal Su-35 al momento dell'impatto.` : "", c.r77 ? `Il Su-35 ha lanciato il suo R-77 a ${fmt(c.r77dist / 1000, 1)} km${R.esito === "ok" ? ": sei sopravvissuto." : "."}` : R.esito === "ok" ? "Il Su-35 non ha fatto in tempo a lanciare: chi tira per primo e bene vince." : ""].filter(Boolean),
      stelle: c => c.r77 ? 2 : 3 },

    { id: "A4", modulo: "armi", titolo: "Aria-superficie", sotto: "AGM-65 Maverick su un deposito", durata: "5 min",
      target: [{ id: "ACC_DEP", nome: "Capannone del deposito addestrativo", lat: 45.17, lon: 12.07 }],
      obiettivo: "Agganciare il bersaglio a terra prima del lancio e colpirlo da dentro la portata.",
      teoria: [
        ["Il Maverick", "L'AGM-65 Maverick è un missile aria-superficie con sensore televisivo o a infrarossi: si aggancia il bersaglio PRIMA del lancio, poi il missile si guida da solo. Si usa contro mezzi, bunker, radar e navi. Sul Typhoon italiano le armi aria-suolo reali sono altre (soprattutto bombe a guida laser e satellitare): il simulatore usa il Maverick."],
        ["La portata", "Dipende dalla quota: più alti si lancia più lontano. Nel simulatore va da 0,9 km a circa 12 km + 1,2 km ogni 1.000 m di quota sul terreno, fino a 25 km. Il bersaglio deve stare entro 30° dal muso."],
        ["L'attacco", "Si arriva in volo livellato, si mette il bersaglio nel campo del sensore, si aggancia, si controlla la distanza, si lancia ('RIFLE') e si vira via: non serve sorvolare il bersaglio, dove si sarebbe più esposti."],
        ["Il bersaglio", "Un capannone di un deposito addestrativo nella campagna fra Cona e Cavarzere, senza difese: basta un colpo."]
      ],
      numeri: [["AGM-65", "lunghezza 2,5 m, massa 210–300 kg, guida TV o IR"], ["Portata nel simulatore", "0,9 km – (12 km + 1,2 km ogni 1.000 m di quota), massimo 25 km"], ["Campo del sensore", "30° dal muso"], ["Chiamata", "«RIFLE»"]],
      setup(S) { const t = xz(45.17, 12.07), p0 = avanti(t, 20, 35000); piazza(S, Object.assign({}, p0, { ft: 8000, kcas: 380, hdg: 200, thr: 0.6 })); armi(S, { AIM120: 2, AIM9X: 2, AGM65: 2, sel: "AIM120" });
        const b = bersaglio(S, "obiettivo"); if (b) b.hp = 1; },
      fasi: [
        { titolo: "Seleziona l'AGM-65", testo: "Premi ARMA (tasto X) finché compare AGM-65.", check: s => ({ ok: s.arma === "AGM65", dati: [D("Arma", s.arma, s.arma === "AGM65", "AGM-65")], msg: "Tasto X o ARMA." }) },
        { titolo: "Aggancio", testo: "Punta il deposito entro 30° dal muso e sotto i 25 km, poi premi LOCK (T).",
          check: s => { const t = bersaglio(s.S, "obiettivo"), r = t.pos.distanceTo(s.P.pos), off = fuoriAsse(s, t.pos), ok = !!(s.lock && s.lock.ok && s.lock.t === t);
            return { ok, dati: [D("Distanza", fmt(r / 1000, 1) + " km", r < 25000, "< 25"), D("Fuori asse", fmt(off) + "°", off < 30, "< 30°"), D("Aggancio", ok ? "LOCK" : "—", ok, "")], msg: r > 25000 ? "Avvicinati." : off >= 30 ? "Muso sul bersaglio." : "LOCK (tasto T)." }; } },
        { titolo: "Lancio", testo: "Lancia dentro la portata: RIFLE.",
          check: (s, c) => { const t = bersaglio(s.S, "obiettivo"), r = t.pos.distanceTo(s.P.pos), z = VOLO._acc.dlz("AGM65", r), lanciato = missiliMiei(s.S, "AGM65").length > 0 || (s.P.armi.AGM65 < 2);
            if (lanciato && c.rLancio == null) { c.rLancio = r; c.rmax = z.rmax; }
            return { ok: lanciato, dati: [D("Distanza", fmt(r / 1000, 1) + " km", r < z.rmax && r > z.rmin, `${fmt(z.rmin / 1000, 1)}–${fmt(z.rmax / 1000, 1)} km`)], msg: r > z.rmax ? "Ancora fuori portata." : "FUOCO." }; } },
        { titolo: "Bersaglio distrutto", testo: "Vira via e aspetta l'impatto.",
          check: s => { const t = bersaglio(s.S, "obiettivo"); return { ok: !t.vivo, dati: [D("Deposito", t.vivo ? "intatto" : "distrutto", !t.vivo, "")], msg: t.vivo && !missiliMiei(s.S).some(m => m.vivo) ? "Riaggancia e rilancia il secondo." : "Missile in volo." }; } }
      ],
      fallimento: s => { const t = bersaglio(s.S, "obiettivo"); if (!t.vivo && R && R.i < 3) return "Deposito distrutto senza lanciare il Maverick: in questa lezione si attacca con l'AGM-65 da fuori portata delle difese.";
        return t.vivo && s.P.armi.AGM65 <= 0 && !missiliMiei(s.S).some(m => m.vivo) ? "Maverick esauriti." : null; },
      debrief: c => [c.rLancio ? `Lancio a ${fmt(c.rLancio / 1000, 1)} km (portata massima a quella quota: ${fmt(c.rmax / 1000, 1)} km).` : "", "Lanciare da lontano tiene l'aereo fuori dalle difese ravvicinate del bersaglio."].filter(Boolean),
      stelle: (c, R) => R.S.pl.armi.AGM65 >= 1 ? 3 : 2 },

    /* ---------------- MODULO 3 · ATTACCO ---------------- */
    { id: "T1", modulo: "attacco", titolo: "Sotto il radar", sotto: "Attacco a bassa quota contro un deposito difeso da un SA-10", durata: "8 min", sam: true,
      target: [{ id: "ACC_DEP2", nome: "Deposito difeso", lat: 45.24, lon: 11.80 }], samDef: [{ id: "ACC_SA10", nome: "SA-10", lat: 45.21, lon: 11.91, raggio_nm: 16.2 }],
      obiettivo: "Scendere sotto l'orizzonte radar prima della portata della batteria, colpire il deposito e uscire senza essere ingaggiati.",
      teoria: [
        ["La minaccia", "Una batteria di missili terra-aria SA-10 (S-300) difende il deposito. Il suo radar vede lontano gli aerei in quota e guida missili molto veloci: chi entra nella sua portata in quota viene ingaggiato. Nel simulatore la batteria tira fino a 30 km (le versioni reali molto più lontano)."],
        ["L'orizzonte radar", "Il radar non vede sotto l'orizzonte né dietro i rilievi. Un aereo a 3.000 m è sopra l'orizzonte di un radar fino a circa 240 km; a 60 m solo entro circa 50 km, e basta una collina per nasconderlo. Volando bassissimi ci si nasconde anche nel disturbo dovuto al suolo (clutter): è il terrain masking. Nel simulatore la batteria non riesce a ingaggiare chi vola sotto i 200 m dal suolo."],
        ["Il volo a bassa quota", "Si vola a 100–200 m dal suolo a 450–500 kt: tutto succede in fretta e il terreno è il pericolo principale. Le virate si fanno con poca inclinazione, si guarda fuori, si tiene d'occhio l'altezza sul suolo."],
        ["Pop-up e uscita", "Vicino al bersaglio si può salire di qualche centinaio di metri per vederlo e lanciare (pop-up), poi si torna subito bassi e si esce dalla portata della batteria. Il Maverick lanciato da bassa quota arriva a circa 12 km."]
      ],
      numeri: [["SA-10 nel simulatore", "portata 30 km, ingaggia sopra i 200 m dal suolo"], ["Quota di penetrazione", "100–200 m dal suolo (330–650 ft)"], ["Velocità", "450–500 kt"], ["Maverick da bassa quota", "portata circa 12 km"]],
      setup(S) { const t = xz(45.24, 11.80), p0 = avanti(t, 40, 72000); piazza(S, Object.assign({}, p0, { ft: 10000, kcas: 420, hdg: 220, thr: 0.65 })); armi(S, { AIM9X: 2, AGM65: 2, sel: "AIM9X" });
        const b = bersaglio(S, "obiettivo"); if (b) b.hp = 1; },
      sempre(s, c) { const sam = bersaglio(s.S, "sam"); c.dSam = sam ? sam.pos.distanceTo(s.P.pos) : 1e9; if (!c.ingaggiato && s.S.missili.some(m => m.da && m.da.sotto === "sam")) c.ingaggiato = true; },
      fasi: [
        { titolo: "Scendi sotto il radar", testo: "Prima di entrare nei 30 km della batteria scendi sotto i 200 m dal suolo (650 ft) e tieni 450 kt.",
          check: (s, c) => { const basso = s.aglFt < 650; return { ok: basso && s.kt > 380, dati: [D("Altezza dal suolo", fmt(s.aglFt) + " ft", basso, "< 650"), D("Batteria", fmt(c.dSam / 1000, 1) + " km", c.dSam > 30000, "> 30 km"), D("Velocità", fmt(s.kt) + " kt", s.kt > 380, "≈ 450")],
            msg: c.dSam < 36000 && !basso ? "SCENDI SUBITO: sei quasi nella portata!" : !basso ? "Muso giù: scendi a 100–200 m dal suolo." : "Basso e veloce: occhio al terreno." }; } },
        { titolo: "Penetrazione", testo: "Resta sotto i 200 m e avvicinati al deposito fino a 14 km.",
          check: (s, c) => { const t = bersaglio(s.S, "obiettivo"), r = t.pos.distanceTo(s.P.pos), basso = s.aglFt < 650;
            return { ok: r < 14000, prog: clamp(1 - (r - 14000) / 30000, 0, 1), dati: [D("Deposito", fmt(r / 1000, 1) + " km", r < 14000, "< 14"), D("Altezza dal suolo", fmt(s.aglFt) + " ft", basso, "< 650"), D("Batteria", fmt(c.dSam / 1000, 1) + " km", true, "")], msg: !basso ? "Troppo alto: la batteria ti vede!" : "Segui il terreno." }; } },
        { titolo: "Attacco", testo: "Seleziona l'AGM-65, aggancia il deposito e lancia; se serve sali di poco (pop-up) e torna giù subito.",
          check: s => { const t = bersaglio(s.S, "obiettivo"), r = t.pos.distanceTo(s.P.pos);
            return { ok: !t.vivo, dati: [D("Arma", s.arma, s.arma === "AGM65", "AGM-65"), D("Deposito", fmt(r / 1000, 1) + " km", r < 12500, "< 12"), D("Aggancio", s.lock && s.lock.ok ? "LOCK" : "—", !!(s.lock && s.lock.ok), ""), D("Altezza dal suolo", fmt(s.aglFt) + " ft", s.aglFt < 650, "< 650")],
              msg: s.arma !== "AGM65" ? "ARMA fino a AGM-65." : !(s.lock && s.lock.ok) ? "Muso sul deposito e LOCK." : !t.vivo ? "" : "FUOCO e poi giù!" }; } },
        { titolo: "Uscita", testo: "Torna basso e allontanati dalla batteria oltre i 30 km.",
          check: (s, c) => ({ ok: c.dSam > 30000, prog: clamp(c.dSam / 30000, 0, 1), dati: [D("Batteria", fmt(c.dSam / 1000, 1) + " km", c.dSam > 30000, "> 30"), D("Altezza dal suolo", fmt(s.aglFt) + " ft", s.aglFt < 650, "< 650")], msg: s.aglFt >= 650 ? "Giù!" : "Fuori dalla portata e a casa." }) }
      ],
      fallimento: (s, c) => c.ingaggiato ? "La batteria ti ha visto e ha lanciato: eri sopra i 200 m dentro la sua portata." : (() => { const t = bersaglio(s.S, "obiettivo"); return t && t.vivo && s.P.armi.AGM65 <= 0 && !missiliMiei(s.S).some(m => m.vivo) ? "Maverick esauriti." : null; })(),
      debrief: (c, R) => [R.esito === "ok" ? "La batteria non ti ha mai ingaggiato: il terreno e la bassa quota sono stati la tua protezione." : c.ingaggiato ? `La batteria ti ha ingaggiato a ${fmt((c.dSam || 0) / 1000, 1)} km: eri sopra i 200 m dal suolo dentro la sua portata. Scendi prima dei 30 km e resta basso fino all'uscita.` : "", "In una missione vera l'attacco a bassa quota si coordina con aerei che sopprimono i radar (SEAD) o li accecano con il disturbo."],
      stelle: (c, R) => R.durata < 420 ? 3 : 2 },

    { id: "T2", modulo: "attacco", tipo: "cadet", titolo: "Strategia d'attacco", sotto: "Missione «Il corridoio»: tre decisioni da comandante", durata: "20 min",
      obiettivo: "Pianificare un attacco con bombardieri, scorta e disturbatore, poi vedere le conseguenze nel debriefing." },

    /* ---------------- MODULO 4 · DIFESA ---------------- */
    { id: "D1", modulo: "difesa", titolo: "Difesa dai missili", sotto: "Notch, chaff e sopravvivenza", durata: "6 min", nemici: 1, diff: "recluta",
      obiettivo: "Riconoscere il lancio, mettersi al traverso, scendere, usare il chaff e sopravvivere a due missili radar.",
      teoria: [
        ["L'allarme", "Il ricevitore d'allarme radar (RWR) avvisa quando un radar nemico ti illumina e quando parte un missile ('MISSILE LAUNCH'). Da quel momento ogni secondo conta: un missile come l'R-77 vola a 3–4 volte la velocità del suono."],
        ["Il notch", "Radar e missili radar usano l'effetto Doppler: per non vedere il terreno ignorano ciò che non si avvicina né si allontana. Se voli perpendicolare alla linea di vista del missile (al traverso, 'beam') la tua velocità radiale è quasi nulla e ti confondi con il suolo, soprattutto volando basso: è il notch. Nel simulatore funziona sotto i 1.500 m dal suolo con meno del 15% di velocità verso il missile, cioè con il missile fra 81° e 99° dalla tua direzione: va tenuto con precisione, correggendo la prua mentre il missile si avvicina."],
        ["Chaff e flare", "Il chaff (nuvole di strisce metallizzate) crea falsi echi per i radar; i flare (esche calde) ingannano i missili a infrarossi. Si lanciano quando il missile è vicino (nel simulatore entro 7 km), a raffiche, insieme alla manovra: da soli non bastano."],
        ["Scappare o girare", "Il motore di un missile brucia per pochi secondi, poi il missile plana e perde energia: virando via (drag) e accelerando lo si costringe a inseguire finché non 'muore'. Da vicino serve una virata stretta all'ultimo momento, quando non riesce più a correggere."]
      ],
      numeri: [["R-77 (AA-12 Adder)", "radar attivo; nel simulatore lancio fra 7 e 26 km"], ["Notch nel simulatore", "sotto 1.500 m dal suolo, missile fra 81° e 99° dalla tua direzione (velocità radiale < 15%)"], ["Contromisure", "60 cariche; efficaci entro 7 km dal missile"], ["Tasti", "C o FLARE per chaff/flare"]],
      setup(S) { const p0 = xz(45.40, 11.80); piazza(S, Object.assign({}, p0, { ft: 9000, kcas: 420, hdg: 90, thr: 0.65 })); armi(S, { colpi: 0, sel: "GUN" });
        piazzaNemico(S, 0, Object.assign(avanti(p0, 90, 34000), { ft: 12000, kt: 480, hdg: 270, missili: { R77: 2 }, cad: 0, nome: "Su-35" })); },
      sempre(s, c, dt) { const e = nemico(s.S, 0); const inArrivo = missiliControDiMe(s.S); if (c.dot == null) { c.dot = 2; c.rilanci = 0; } c.lanciati = c.dot - e.missili.R77;
        if (c.lanciati === 1 && !c.secondo) { c.secondo = true; e.cad = 16; }   // il secondo R-77 arriva circa 16 secondi dopo
        const via = en => ({ hdg: Math.atan2(en.pos.x - s.P.pos.x, -(en.pos.z - s.P.pos.z)), alt: en.pos.y, v: 270, g: 5, stato: "rientro" });
        if (e.vivo && s.vivo && e.missili.R77 === 0 && !inArrivo.length) {
          const manca = R && R.i >= 1 && R.i <= 2;   // missili sconfitti prima del traverso o del chaff
          if (manca && c.rilanci < 4) {   // come in addestramento: l'istruttore fa ripetere, il Su-35 si allontana, rientra e lancia ancora
            c.dot++; c.rilanci++; e.missili.R77 = 1; e.cad = 3; c.via = false; e.lontano = true;
            e.guida = (en, k) => { if (k.dist > 18000) en.lontano = false; else if (k.dist < 11000) en.lontano = true; return en.lontano ? via(en) : null; };
            toast("Il Su-35 si riposiziona: lancerà un altro R-77"); parla("Il Su-35 si riposiziona e lancerà ancora.");
          } else if (manca) c.esaurito = true;
          else if (!c.via) { c.via = true; e.guida = via; }
        }
        const m = inArrivo.sort((a, b) => a.pos.distanceTo(s.P.pos) - b.pos.distanceTo(s.P.pos))[0]; c.m = m || null;
        if (m) { const los = m.pos.clone().sub(s.P.pos).normalize(), v = s.P.vel.clone().normalize(); c.beam = Math.acos(clamp(los.dot(v), -1, 1)) * R2D; c.dm = m.pos.distanceTo(s.P.pos); } else { c.beam = null; c.dm = null; }
        if (c.ch0 == null) { c.ch0 = s.P.chaff; c.chPrev = s.P.chaff; c.chaffUtili = 0; } c.chaffUsati = c.ch0 - s.P.chaff;
        if (s.P.chaff < c.chPrev && c.dm != null && c.dm < 7000) c.chaffUtili += c.chPrev - s.P.chaff; c.chPrev = s.P.chaff;
        if (c.m && c.beam != null && fascia(c.beam, 81, 99) && s.agl < 1500) c.tNotch = (c.tNotch || 0) + (dt || 0); },
      fasi: [
        { titolo: "Allarme", testo: "Vola verso il Su-35 e aspetta l'allarme: lancerà appena sarai sotto i 26 km.",
          check: (s, c) => { const e = nemico(s.S, 0), r = e.pos.distanceTo(s.P.pos); return { ok: c.lanciati > 0, dati: [D("Su-35", fmt(r / 1000, 1) + " km", true, "lancio sotto 26"), D("RWR", e.illumina ? "ILLUMINATO" : "—", true, "")], msg: "Tieni la prua: preparati a virare appena senti MISSILE LAUNCH." }; } },
        { titolo: "Traverso e quota", testo: "Vira a 90° rispetto al missile (beam, fra 81° e 99°) e scendi sotto i 1.500 m dal suolo (5.000 ft): tienilo 3 secondi.", tenere: 3,
          check: (s, c) => { const b = c.beam != null && fascia(c.beam, 81, 99), basso = s.agl < 1500;
            return { ok: b && basso, dati: [D("Angolo dal missile", c.beam != null ? fmt(c.beam) + "°" : "—", b, "81–99°"), D("Altezza dal suolo", fmt(s.aglFt) + " ft", basso, "< 5.000"), D("Missile", c.dm != null ? fmt(c.dm / 1000, 1) + " km" : "—", true, "")],
              msg: !c.m ? (c.rilanci ? "Il Su-35 si riposiziona: aspetta il nuovo lancio." : "Nessun missile in volo ora.") : !b ? (c.beam < 81 ? "Vira di più: il missile deve stare di fianco a te." : "Hai girato troppo: riportalo al traverso.") : !basso ? "Muso giù: sotto i 5.000 ft dal suolo." : "Notch: ti confondi con il terreno." }; } },
        { titolo: "Chaff", testo: "Quando un missile è entro 7 km lancia chaff (C o FLARE) almeno 3 volte, restando al traverso.",
          check: (s, c) => ({ ok: c.chaffUtili >= 3, dati: [D("Chaff entro 7 km", c.chaffUtili, c.chaffUtili >= 3, "≥ 3"), D("Missile", c.dm != null ? fmt(c.dm / 1000, 1) + " km" : "—", c.dm != null && c.dm < 7000, "< 7 km")], msg: c.dm != null && c.dm < 7000 ? "ORA: C, C, C!" : !c.m && c.rilanci ? "Il Su-35 si riposiziona: aspetta il nuovo lancio." : "Aspetta che il missile sia entro 7 km." }) },
        { titolo: "Sopravvivi", testo: "Il Su-35 ha due R-77: sopravvivi a entrambi.",
          check: (s, c) => ({ ok: c.lanciati >= 2 && !missiliControDiMe(s.S).length && s.vivo, dati: [D("Missili lanciati", c.lanciati + " di 2", c.lanciati >= 2, ""), D("In arrivo", missiliControDiMe(s.S).length, !missiliControDiMe(s.S).length, "0"), D("Angolo dal missile", c.beam != null ? fmt(c.beam) + "°" : "—", c.beam == null || fascia(c.beam, 81, 99), "81–99°"), D("Altezza dal suolo", fmt(s.aglFt) + " ft", s.agl < 1500, "< 5.000")], msg: c.m ? "Traverso, basso, chaff!" : c.lanciati < 2 ? "Aspetta il secondo lancio, pronto a ripetere." : "" }) }
      ],
      fallimento: (s, c) => c.esaurito ? "Quattro lanci in più senza riuscire traverso e chaff: rileggi la teoria e riprova." : null,
      debrief: (c, R) => [R.esito === "ok" ? "Ogni missile è stato sconfitto: notch, quota bassa e chaff insieme funzionano meglio di ciascuno da solo." : "Un missile è arrivato a segno. Nessuna difesa è garantita, ma ognuna aumenta le probabilità: traverso preciso (81–99°), sotto i 5.000 ft dal suolo e chaff entro 7 km, tutti insieme e fino alla fine.", `Tempo al traverso e basso con un missile in volo: ${fmt(c.tNotch || 0)} s.`, `Chaff usati: ${c.chaffUsati || 0} su 60, di cui ${c.chaffUtili || 0} con un missile entro 7 km.`, c.rilanci ? `Il Su-35 ha dovuto lanciare ${c.rilanci} ${c.rilanci === 1 ? "missile" : "missili"} in più perché la manovra non era ancora riuscita.` : ""].filter(Boolean),
      stelle: c => (c.rilanci || 0) === 0 ? ((c.chaffUsati || 0) <= 12 ? 3 : 2) : c.rilanci === 1 ? 2 : 1 },

    { id: "D2", modulo: "difesa", titolo: "Difesa aerea", sotto: "CAP sopra Treviso contro due incursori", durata: "7 min", nemici: 2, diff: "recluta",
      obiettivo: "Lasciare la pattuglia al momento giusto e abbattere i due incursori prima che arrivino a 15 km da Venezia, lanciando da vicino, dove non fanno in tempo a difendersi.",
      teoria: [
        ["La difesa aerea", "La difesa aerea (DCA, Defensive Counter Air) protegge un'area: i caccia restano in pattuglia (CAP, Combat Air Patrol) fra la minaccia e ciò che difendono, guidati dai radar a terra o da un aereo radar (AWACS)."],
        ["Il commit", "Quando gli incursori superano una linea stabilita (criterio di commit) i caccia lasciano la pattuglia e li intercettano. Più avanti li si ingaggia, più tempo resta per un secondo tentativo prima che arrivino sull'obiettivo."],
        ["La rotta di collisione", "Non si punta dove sono, ma dove saranno: rotta di collisione. Così la distanza si chiude in fretta e l'incursore resta davanti al muso, dentro il cono del radar e del missile (60°): un missile lanciato con il bersaglio di lato lo perde appena partito."],
        ["SHOOT non vuol dire colpito", "Il SHOOT del visore compare appena il bersaglio entra in Rmax, la portata contro un bersaglio che continua dritto: qui 40–50 km. Da così lontano l'AMRAAM arriva dopo più di mezzo minuto e un incursore basso fa in tempo a virare di traverso: con la velocità tutta di lato il radar del missile, che scarta gli echi fermi rispetto al suolo, lo confonde con il terreno e lo perde (notch). Nel simulatore, contro questi incursori, l'AMRAAM colpisce circa tre volte su quattro da 8 km, poco più di metà da 10 km, una su tre da 20 km e quasi mai da 40. Da lontano si lancia per costringere l'avversario a difendersi; per abbatterlo serve il colpo da vicino."],
        ["Il Sidewinder", "Sotto i 10 km l'AIM-9X (tasto X) è l'arma migliore: segue il calore dei motori, il traverso non lo inganna e solo ogni tanto un flare lo devia. Colpisce circa quattro volte su cinque, anche da dietro. Con quattro AMRAAM e due Sidewinder per due incursori puoi permetterti un secondo tentativo, non di sprecarli da lontano."],
        ["Regole d'ingaggio", "In tempo di pace serve l'identificazione visiva (come nella QRA); in uno scenario di guerra l'identificazione è elettronica (IFF, radar, AWACS). Qui gli incursori sono dichiarati ostili: volano bassi e veloci verso Venezia e si difendono solo se li minacci da vicino."]
      ],
      numeri: [["Incursori", "un Su-35 e un Su-57 a 1.500 m, 480 kt, diretti su Venezia"], ["Linea da difendere", "15 km da Venezia Tessera"], ["Armamento", "4 AIM-120 + 2 AIM-9X"], ["La tua CAP", "FL200 sopra Treviso"], ["Lancio consigliato", "sotto i 10 km con l'incursore davanti al muso, AMRAAM o Sidewinder"]],
      setup(S) { piazza(S, { lat: 45.66, lon: 12.25, ft: 20000, kcas: 330, hdg: 60, thr: 0.6 }); armi(S, { AIM120: 4, AIM9X: 2, sel: "AIM120" });
        const ves = xz(TESSERA.lat, TESSERA.lon);
        const verso = e => { const toP = Math.hypot(e.pos.x - S.pl.pos.x, e.pos.z - S.pl.pos.z); const avant = Math.abs(angd(e.hdg * R2D, brgXZ(e.pos, S.pl.pos))) < 35;
          return { hdg: Math.atan2(ves.x - e.pos.x, -(ves.z - e.pos.z)), alt: 1500, v: 247, g: 3, stato: toP < 8000 && avant ? "attacco" : "transito" }; };
        piazzaNemico(S, 0, { lat: 45.93, lon: 12.86, ft: 4900, kt: 480, hdg: 230, missili: { R73: 1 }, nome: "Incursore 1", guida: verso });
        piazzaNemico(S, 1, { lat: 45.88, lon: 12.92, ft: 4900, kt: 480, hdg: 230, missili: { R73: 1 }, nome: "Incursore 2", guida: verso }); },
      sempre(s, c) { const ves = xz(TESSERA.lat, TESSERA.lon); c.dMin = Math.min(...s.S.nemici.filter(e => e.vivo).map(e => distXZ(e.pos, ves)), 1e9);
        c.lanci = Math.max(0, 4 - s.P.armi.AIM120) + Math.max(0, 2 - s.P.armi.AIM9X);
        if (c.lanci > 0 && c.rPrimo == null) { const t = s.lock && s.lock.t && s.S.nemici.includes(s.lock.t) ? s.lock.t : null; c.rPrimo = t ? t.pos.distanceTo(s.P.pos) : 0; }
        contaInganni(s, c); },
      fasi: [
        { titolo: "Commit e aggancio", testo: "Gli incursori arrivano da nord-est. Vai verso di loro e agganciane uno con il radar (AIM-120, LOCK).",
          check: (s, c) => { const ok = (s.arma === "AIM120" && !!(s.lock && s.lock.ok && s.S.nemici.includes(s.lock.t))) || s.S.nemici.some(e => !e.vivo);
            return { ok, dati: [D("Incursore più vicino a Venezia", fmt(c.dMin / 1000) + " km", c.dMin > 15000, "> 15"), D("Aggancio", ok ? "LOCK" : "—", ok, "")], msg: "Rotta verso nord-est, poi LOCK." }; } },
        { titolo: "Primo abbattimento", testo: "Chiudi in rotta di collisione e lancia sotto i 10 km, con l'incursore davanti al muso.",
          check: (s, c) => ({ ok: s.S.nemici.filter(e => !e.vivo).length >= 1, dati: datiTiro(s, c), msg: consiglioTiro(s, c) }) },
        { titolo: "Secondo abbattimento", testo: "Abbatti il secondo prima della linea dei 15 km; se ti ha superato, inseguilo col Sidewinder.",
          check: (s, c) => ({ ok: nemiciVivi(s.S) === 0, dati: datiTiro(s, c), msg: consiglioTiro(s, c) }) }
      ],
      fallimento: (s, c) => c.dMin < 15000 ? "Un incursore ha superato la linea dei 15 km da Venezia." : (s.P.armi.AIM120 + s.P.armi.AIM9X <= 0 && nemiciVivi(s.S) && !missiliMiei(s.S).some(m => m.vivo && !m.perso && !m.ingannato) ? "Missili esauriti." : null),
      debrief: (c, R) => [R.esito === "ok" ? "Entrambi gli incursori abbattuti prima della linea di difesa." : "",
        c.lanci ? `Missili lanciati: ${c.lanci}${c.persi ? `, ingannati ${c.persi}` : ", nessuno ingannato"}${c.perso_notch ? ` (${c.perso_notch} dal traverso a bassa quota, il notch)` : ""}${c.perso_gimbal ? ` · ${c.perso_gimbal} lanciati con il bersaglio troppo di lato` : ""}.` : "",
        c.rPrimo > 15000 ? `Primo lancio a ${fmt(c.rPrimo / 1000)} km: da così lontano un incursore basso fa in tempo a difendersi. Sotto i 10 km il colpo è molto più sicuro.` : "",
        "La CAP serve a essere già in quota e nel punto giusto: il tempo guadagnato vale un secondo tentativo."].filter(Boolean),
      stelle: c => c.lanci <= 3 ? 3 : c.lanci <= 5 ? 2 : 1 },

    { id: "D3", modulo: "difesa", tipo: "missione", titolo: "Polizia aerea", sotto: "Missione «LAGUNA QRA»: scramble e intercettazione di un aereo di linea", durata: "20 min",
      obiettivo: "In tempo di pace la difesa è la QRA: decollo su ordine, intercettazione ICAO in tre fasi, scorta a distanza." },

    { id: "S1", modulo: "soccorso", titolo: "SOS · pilota isolato", sotto: "Personnel Recovery con il team STOS Pararescue sul Grappa", durata: "10 min", aereo: "UH60", partenza: "volo",
      obiettivo: "Raggiungere a bassa quota il pilota abbattuto volando sulle coordinate GPS inviate dalla sua radio di sopravvivenza, riconoscerlo dai segnali a vista, atterrare nella zona indicata, far lavorare gli STOS e portarlo fuori dall'area ostile.",
      teoria: [
        ["Personnel Recovery", "È l'insieme delle attività per riportare a casa personale rimasto isolato (un equipaggio abbattuto, una squadra separata) in un'area ostile o non permissiva. Si articola in cinque compiti: segnalare (report), localizzare (locate), sostenere (support), recuperare (recover) e reintegrare (reintegrate), cioè cure, rientro e debriefing."],
        ["Gli STOS", "Gli STOS (Supporto Tattico alle Operazioni Speciali) sono operatori dell'Aeronautica Militare del comparto operazioni speciali (COMOS). Gli STOS Pararescue sono specializzati nel Personnel Recovery: individuano il personale isolato, mettono in sicurezza la zona, prestano le prime cure e lo recuperano, operando con gli elicotteri (per esempio gli HH-101) e con i reparti di forze speciali. Svolgono anche ricognizione di zone di atterraggio e aviolancio e supporto tattico."],
        ["Localizzare", "In area ostile il pilota tiene spento il radiofaro personale (PLB): le sue emissioni a 406 MHz e 121,5/243 MHz le capterebbe anche il nemico, che con un radiogoniometro arriverebbe dritto da lui. Usa invece la radio di sopravvivenza con GPS integrato (come le CSEL o le PRC-112G): trasmette brevi raffiche cifrate, difficili da intercettare, con la sua posizione GPS e qualche messaggio di testo. Il centro di coordinamento passa le coordinate all'elicottero, che le carica nel navigatore e ci vola sopra: niente radiogoniometro. Da vicino contano i segnali a vista, solo quando l'elicottero è lì: fumogeno arancione di giorno, pannello segnaletico, luce infrarossa di notte."],
        ["Autenticare", "In area ostile il nemico può tendere trappole con falsi segnali. Prima della missione ogni equipaggio compila la scheda ISOPREP con domande personali e codici: il soccorritore le usa per verificare che la persona a terra sia davvero il pilota."],
        ["Entrare e uscire", "L'elicottero vola basso e usa il terreno per nascondersi alle armi contraeree spalleggiabili (MANPADS) e alle armi leggere: creste e vallate interrompono la linea di vista. I caccia di scorta proteggono dall'alto. La zona di atterraggio (LZ) va scelta pianeggiante, sgombra da ostacoli e il più vicina possibile al personale isolato."],
        ["A terra", "Gli operatori formano un perimetro di sicurezza; il Pararescue raggiunge il pilota, lo autentica e applica le regole del soccorso in combattimento (TCCC): controllo delle emorragie, vie aeree, immobilizzazione, poi l'evacuazione. L'elicottero resta a terra il meno possibile."]
      ],
      numeri: [["Posizione del pilota", "45°49,80′ N · 11°47,76′ E, dalla radio di sopravvivenza (radiofaro spento)"], ["Navigatore GPS", "riquadro in alto a sinistra: punto attivo, distanza, rotta, tempo stimato e mappa con la zona della minaccia in rosso"], ["Minaccia nel simulatore", "squadra con MANPADS a nord-est del pilota: entro 3,2 km sopra 300 ft dal suolo sei esposto; 12 s di esposizione e ti ingaggiano"], ["Zona di atterraggio", "prato con pannello arancione, 150 m a sud-est del pilota: posati entro 60 m, oppure hovering sotto 15 m e 10 kt per 3 s"], ["Elicottero (UH-60M nel simulatore)", "collettivo con la manetta (circa 64% per l'hovering), ciclico con la barra, pedaliera Q/E"], ["Punto di consegna", "8 km a sud del pilota, fuori dall'area ostile"]],
      setup(S, c) { c.t0 = S.t; if (typeof SOCCORSO === "undefined") return; SOCCORSO.precarica(); SOCCORSO.prepara(S); c.pronto = true;
        setTimeout(() => { if (VOLO.stato === S) SOCCORSO.filmatoSchianto(S, () => { c.film1 = true; }); }, 600); },
      sempre(s, c, dt) { if (typeof SOCCORSO !== "undefined") SOCCORSO.aggiorna(dt, s.S); if (typeof SOCCORSO !== "undefined") { const k = SOCCORSO.info(s.S); c.espMax = Math.max(c.espMax || 0, k.esposizione); } },
      chiusura() { if (typeof SOCCORSO !== "undefined") SOCCORSO.chiudi(); },
      fasi: [
        { titolo: "Allarme SOS", testo: "LUPO 21 è stato abbattuto sul Grappa e si è eiettato. Radiofaro spento: la sua radio invia la posizione GPS e parte il Personnel Recovery.",
          check: (s, c) => ({ ok: !!c.film1 || typeof SOCCORSO === "undefined", dati: [D("Filmato", c.film1 ? "concluso" : "in corso", !!c.film1, "")], msg: "Guarda il filmato, poi si parte." }) },
        { titolo: "Ingresso a bassa quota", testo: "Vola sul punto GPS «LZ» del navigatore, seguendo la linea viola. Nell'area della minaccia, in rosso, resta sotto 300 ft dal suolo.",
          inizio: (s, c) => { c.tIngresso = s.S.t; },
          check: (s, c) => { const k = SOCCORSO.info(s.S); return { ok: k.dLZ < 2500, dati: [D("LZ (GPS)", fmt(k.dLZ / 1000, 1) + " km", k.dLZ < 2500, "< 2,5"), D("Rotta GPS", Math.round(k.brgLZ) + "°", true, ""), D("Quota", fmt(k.aglFt) + " ft", !k.esposto, k.inMinaccia ? "< 300" : ""), D("Esposizione", fmt(k.esposizione, 1) + " s", k.esposizione < 6, "< 12")],
            msg: k.esposto ? "Sei in vista della squadra ostile: scendi sotto 300 ft." : k.kt < 40 ? "Ciclico avanti per accelerare verso il punto GPS." : "Tieni la linea viola del navigatore davanti al muso." }; } },
        { titolo: "Localizzazione", testo: "Sei sulle coordinate: LUPO 21 ti sente e accende il fumogeno arancione. Cerca il pannello arancione della zona di atterraggio (LZ), 150 m a sud-est di lui.",
          check: (s, c) => { const k = SOCCORSO.info(s.S), ok = k.dLZ < 400 && k.aglFt < 400; return { ok, dati: [D("Distanza LZ", fmt(k.dLZ) + " m", k.dLZ < 400, "< 400"), D("Quota", fmt(k.aglFt) + " ft", k.aglFt < 400, "< 400"), D("Velocità", fmt(k.kt) + " kt", k.kt < 80, "")],
            msg: k.dLZ > 1200 ? "Rombo arancione: posizione GPS del pilota; verde: la LZ." : "Riduci velocità e quota: avvicinati alla LZ." }; } },
        { titolo: "Atterraggio nella LZ", testo: "Posati sul prato entro 60 m dal pannello arancione, oppure tieni l'hovering sotto 15 m dal suolo e sotto 10 kt.", tenere: 3,
          check: (s, c) => { const k = SOCCORSO.info(s.S), posato = k.aTerra && k.dLZ < 70, hover = k.dLZ < 60 && k.agl < 15 && k.kt < 10; c.tLZ = c.tLZ || (posato || hover ? s.S.t : null);
            return { ok: posato || hover, dati: [D("Distanza LZ", fmt(k.dLZ) + " m", k.dLZ < 60, "< 60"), D("Altezza", fmt(k.agl) + " m", k.agl < 15 || k.aTerra, "< 15"), D("Velocità", fmt(k.kt) + " kt", k.kt < 10, "< 10")],
              msg: k.kt > 10 ? "Ciclico indietro: rallenta sopra il pannello." : k.agl > 15 ? "Collettivo giù (manetta sotto il 60%): scendi piano." : "Così: tieni fermo l'elicottero." }; } },
        { titolo: "Recupero con gli STOS", testo: "Il team STOS mette in sicurezza la zona; il Pararescue autentica il pilota, lo cura e lo porta a bordo.",
          inizio: (s, c) => { c.tRecupero = s.S.t; SOCCORSO.filmatoRecupero(s.S, () => { c.film2 = true; }); },
          check: (s, c) => ({ ok: !!c.film2, dati: [D("Recupero", c.film2 ? "superstite a bordo" : "in corso", !!c.film2, "")], msg: "Gli STOS sono a terra." }) },
        { titolo: "Uscita e consegna", testo: "Il navigatore passa al punto GPS «CONSEGNA», 8 km a sud: esci a bassa quota e consegna il pilota alle cure mediche.",
          check: (s, c) => { const k = SOCCORSO.info(s.S); return { ok: k.dConsegna < 1500, dati: [D("Consegna (GPS)", fmt(k.dConsegna / 1000, 1) + " km", k.dConsegna < 1500, "< 1,5"), D("Rotta GPS", Math.round(k.brgConsegna) + "°", true, ""), D("Quota", fmt(k.aglFt) + " ft", !k.esposto, k.inMinaccia ? "< 300" : "")],
            msg: k.esposto ? "Ancora esposto: giù sotto 300 ft." : "Rotta sud, bassi e veloci." }; } }
      ],
      fallimento: (s, c) => { if (typeof SOCCORSO === "undefined") return null; const k = SOCCORSO.info(s.S); if (k.esposizione >= 12) return "Ingaggiato da un MANPADS: in area ostile l'elicottero vola basso, nascosto dal terreno.";
        return k.dIP > 22000 ? "Troppo lontano dall'area del pilota: il recupero è fallito." : null; },
      debrief: c => [c.espMax > 0.5 ? `Esposizione massima alla minaccia: ${fmt(c.espMax, 1)} s.` : "Mai esposto alla minaccia: ingresso mascherato dal terreno.",
        "Personnel Recovery: report, locate, support, recover, reintegrate. Con il radiofaro spento per non farsi trovare dal nemico, il pilota è stato raggiunto sulle coordinate GPS della sua radio di sopravvivenza e riconosciuto dai segnali a vista, autenticato e curato dagli STOS, consegnato alle cure mediche."],
      stelle: (c, R) => 1 + ((c.espMax || 0) < 4 ? 1 : 0) + (R.durata < 600 ? 1 : 0) }
  ];
  LEZIONI.forEach(L => { if (L.samDef) { L.sam = L.samDef; } });

  /* ---------- progressi ---------- */
  const prog = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } };
  function salvaProg(id, rec) { const p = prog(); const old = p[id]; if (!old || !old.ok || rec.stelle >= (old.stelle || 0)) p[id] = rec; try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  const prossima = () => LEZIONI.find(L => !(prog()[L.id] || {}).ok);

  /* ---------- voce ---------- */
  let voce = true; try { voce = localStorage.getItem(KEY_VOCE) !== "0"; } catch (e) {}
  function parla(t) { try { if (!voce || !window.speechSynthesis) return; const u = new SpeechSynthesisUtterance(String(t)); u.lang = "it-IT"; u.rate = 1.05; const v = speechSynthesis.getVoices().find(x => /^it/i.test(x.lang)); if (v) u.voice = v; speechSynthesis.speak(u); } catch (e) {} }

  /* ======================================================================
     ESECUZIONE DI UNA LEZIONE NEL FREE FLIGHT
     ====================================================================== */
  let R = null, prima = null, mon = 0;
  function salvaStato() {
    if (prima) return; prima = { sc: JSON.parse(JSON.stringify(APP.sc)), v3d: APP.vista3dAuto, speed: APP.speed };
    try { if (!(APP.sc.missione && APP.sc.missione.cadet)) localStorage.setItem("centurion_cadet_backup", JSON.stringify(APP.sc)); } catch (e) {}
  }
  function ripristinaStato() {
    const p = prima; prima = null; if (!p) return;
    try { APP.play(false); } catch (e) {}
    APP.sc = p.sc; APP.vista3dAuto = p.v3d; try { APP.ricostruisci(); APP.setSpeed(p.speed); } catch (e) { console.warn("Accademia", e); }
    try { localStorage.removeItem("centurion_cadet_backup"); } catch (e) {}
  }
  function avviaLezione(L) {
    if (!L.fasi) return capstone(L);   // le missioni conclusive si aprono dalla loro schermata
    if (typeof VOLO === "undefined" || !VOLO._acc || typeof THREE === "undefined") { alert("Le lezioni pratiche richiedono il Free Flight 3D."); return; }
    chiudiSchermo(); salvaStato();
    try { APP.play(false); } catch (e) {}
    APP.sc = scenario(L); APP.vista3dAuto = false; try { APP.ricostruisci(); } catch (e) { console.warn("Accademia", e); }
    if (!VOLO.attivo) VOLO.apri();
    VOLO.avvia({ aereo: L.aereo || "F2000", partenza: L.partenza || "volo", nemici: L.nemici || 0, sam: !!L.sam, diff: L.diff || "recluta", ora: L.ora || "giorno" });
    const S = VOLO.stato; if (!S) return;
    R = { L, S, i: 0, hold: 0, c: {}, t0: S.t, tempi: [], finita: false, esito: null, uiT: 0, avviata: false };
    S.ondataFinita = true; S.msg = null;
    try { L.setup && L.setup(S, R.c); } catch (e) { console.warn("Accademia setup", e); }
    S.lezione = { tick: (dt, s) => tick(dt, s), fine: (titolo, motivo) => { if (R && R.S === S && !R.finita) fallisci(`${titolo === "SCHIANTO" ? "Schianto" : titolo === "EIETTATO" ? "Eiettato" : titolo}: ${motivo}`); } };
    pannello(true); avviaFase(0);
    clearInterval(mon); mon = setInterval(sorveglia, 300);
  }
  function avviaFase(i) {
    R.i = i; R.hold = 0; R.tFase = R.S.t; const F = R.L.fasi[i];
    try { if (F.inizio) F.inizio(stato(R.S), R.c); } catch (e) { console.warn(e); }
    parla(F.testo); pannello(true);
  }
  function tick(dt, S) {
    if (!R || R.S !== S || R.finita) return;
    const s = stato(S), L = R.L, c = R.c, F = L.fasi[R.i];
    if (L.sempre) L.sempre(s, c, dt);
    const motivo = L.fallimento ? L.fallimento(s, c) : null; if (motivo) return fallisci(motivo);
    const r = F.check(s, c, dt) || {}; R.r = r;
    if (F.tenere) { R.hold = r.ok ? R.hold + dt : Math.max(0, R.hold - dt); if (R.hold >= F.tenere) faseFatta(); }
    else if (r.ok) faseFatta();
    R.fuori = Math.max(Math.abs(s.x), Math.abs(s.z)) > 50000;
    if ((R.uiT -= dt) <= 0) { R.uiT = 0.2; pannello(); }
  }
  function faseFatta() {
    R.tempi.push(R.S.t - R.tFase); toast(`✔ ${R.L.fasi[R.i].titolo}`);
    if (R.i + 1 < R.L.fasi.length) avviaFase(R.i + 1); else completa();
  }
  function completa() {
    R.finita = true; R.esito = "ok"; R.durata = R.S.t - R.t0;
    let st = 1; try { st = clamp(Math.round(R.L.stelle ? R.L.stelle(R.c, R) : 3), 1, 3); } catch (e) {}
    R.stelle = st; salvaProg(R.L.id, { ok: true, stelle: st, durata: Math.round(R.durata), data: new Date().toISOString().slice(0, 10) });
    parla("Lezione superata."); pannello(true);
    const S = R.S; setTimeout(() => { if (R && R.S === S) { S.pausa = true; debrief(); } }, 1600);
  }
  function fallisci(motivo) {
    if (!R || R.finita) return; R.finita = true; R.esito = "ko"; R.motivo = motivo; R.durata = R.S.t - R.t0;
    parla("Lezione non superata."); pannello(true);
    const S = R.S; setTimeout(() => { if (R && R.S === S) { S.pausa = true; debrief(); } }, 1200);
  }
  function sorveglia() {
    if (!R) { clearInterval(mon); return; }
    if (!VOLO.attivo || VOLO.stato !== R.S) { if (!R.uscita) esci(); return; }   // Free Flight chiuso o riavviato dal suo menu: si torna all'accademia
  }
  function esci(versoAccademia) {
    if (!R) return; R.uscita = true; clearInterval(mon); const S = R.S; if (S) S.lezione = null; try { R.L.chiusura && R.L.chiusura(); } catch (e) {} R = null;
    togliPannello(); chiudiSchermo(); try { if (VOLO.attivo) VOLO.chiudi(); } catch (e) {}
    try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
    ripristinaStato(); if (versoAccademia !== false) apri();
  }

  /* ---------- pannello in volo ---------- */
  let pan = null, posAscolto = false;
  // Posto del pannello: fra la scala di beccheggio e il radar del visore, sopra la quota, con la stessa
  // geometria del Free Flight (js/volo.js: sc = min(W, H) / 560 fra 0,75 e 1,6; radar di raggio 62·sc a destra).
  function posPannello() {
    if (!pan) return; const W = innerWidth, H = innerHeight, sc = clamp(Math.min(W, H) / 560, 0.75, 1.6);
    const sx = W / 2 + 88 * sc + 6, dx = W - 138 * sc - 8, top = Math.round(52 * sc + 6), giu = Math.round(H / 2 - 36 * sc - 6);
    const larg = Math.min(400, dx - sx), alt = giu - top;
    if (larg >= 200 && alt >= 110) { pan.style.cssText = `left:auto;right:${Math.round(W - dx)}px;top:${top}px;width:${Math.round(larg)}px;max-height:${alt}px`; pan.classList.toggle("compatto", larg < 300 || alt < 200); }
    else { pan.style.cssText = ""; pan.classList.add("compatto"); }   // schermi molto piccoli: posizione predefinita
  }
  function pannello(forza) {
    if (!R) return; const ov = document.getElementById("volo"); if (!ov) return;
    if (!pan || !pan.isConnected) { pan = document.createElement("div"); pan.id = "acc-pan"; ov.appendChild(pan); stile();
      posPannello(); if (!posAscolto) { posAscolto = true; addEventListener("resize", () => posPannello()); }
      pan.addEventListener("click", e => { const b = e.target.closest("[data-acc]"); if (!b) return; const a = b.dataset.acc;
        if (a === "min") pan.classList.toggle("min"); else if (a === "testo") { R.tTesto = R.S.t; pannello(true); } else if (a === "teoria") teoriaInVolo(); else if (a === "esci") { if (confirm("Uscire dalla lezione?")) esci(); } else if (a === "voce") { voce = !voce; try { localStorage.setItem(KEY_VOCE, voce ? "1" : "0"); } catch (x) {} if (!voce) try { speechSynthesis.cancel(); } catch (x) {} pannello(true); } }); }
    const L = R.L, F = L.fasi[R.i], r = R.r || {}, n = L.fasi.length;
    const prog = F.tenere ? R.hold / F.tenere : r.prog != null ? r.prog : null;
    pan.innerHTML = `<div class="acc-ph"><span class="acc-code">${esc(L.id)}</span><b>${esc(L.titolo)}</b><span class="acc-sp"></span><button data-acc="voce" title="Voce">${voce ? "🔊" : "🔇"}</button><button data-acc="teoria" title="Teoria">📖</button><button data-acc="min" title="Riduci">▾</button><button data-acc="esci" title="Esci dalla lezione">✕</button></div>
      <div class="acc-pb">${R.finita ? `<div class="acc-esito ${R.esito}">${R.esito === "ok" ? "✔ LEZIONE SUPERATA" : "✖ " + esc(R.motivo || "")}</div>` : `
        <div class="acc-fase" data-acc="testo">Fase ${R.i + 1} di ${n} · <b>${esc(F.titolo)}</b></div>${!pan.classList.contains("compatto") || R.S.t - Math.max(R.tFase, R.tTesto || -1e9) < 10 ? `<div class="acc-testo">${esc(F.testo)}</div>` : ""}
        ${(r.dati || []).map(d => `<div class="acc-dato ${d.ok ? "ok" : "ko"}"><span>${esc(d.n)}</span><b>${esc(d.v)}</b>${d.obj ? `<small>${esc(d.obj)}</small>` : ""}</div>`).join("")}
        ${prog != null ? `<div class="acc-bar"><i style="width:${Math.round(clamp(prog, 0, 1) * 100)}%"></i></div>${F.tenere ? `<small class="acc-hold">${fmt(Math.min(R.hold, F.tenere), 1)} / ${F.tenere} s</small>` : ""}` : ""}
        ${r.msg ? `<div class="acc-msg">${esc(r.msg)}</div>` : ""}${R.fuori ? `<div class="acc-msg warn">Stai uscendo dall'area addestrativa: vira verso l'interno.</div>` : ""}`}</div>`;
  }
  function togliPannello() { if (pan) { pan.remove(); pan = null; } const t = document.getElementById("acc-toast"); if (t) t.remove(); }
  function toast(t) { const ov = document.getElementById("volo"); if (!ov) return; let el = document.getElementById("acc-toast"); if (!el) { el = document.createElement("div"); el.id = "acc-toast"; ov.appendChild(el); } el.textContent = t; el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); }
  function teoriaInVolo() {
    if (!R) return; const S = R.S, eraPausa = S.pausa; S.pausa = true;
    const L = R.L, w = document.createElement("div"); w.className = "acc-modal"; document.getElementById("volo").appendChild(w);
    w.innerHTML = `<div class="acc-card"><h3>${esc(L.id)} · ${esc(L.titolo)}</h3>${teoriaHtml(L)}<div class="acc-az"><span class="acc-sp"></span><button class="acc-btn primary" data-chiudi>Riprendi il volo ▶</button></div></div>`;
    w.querySelector("[data-chiudi]").onclick = () => { w.remove(); if (R && R.S === S && !R.finita) S.pausa = eraPausa; };
  }

  /* ---------- debriefing ---------- */
  function debrief() {
    if (!R) return; const L = R.L, ok = R.esito === "ok", ov = document.getElementById("volo"); if (!ov) return;
    const w = document.createElement("div"); w.className = "acc-modal"; ov.appendChild(w);
    let note = []; try { note = (L.debrief ? L.debrief(R.c, R) : []).filter(Boolean); } catch (e) {}
    const idx = LEZIONI.indexOf(L), dopo = LEZIONI.slice(idx + 1).find(x => !x.tipo) || null;
    w.innerHTML = `<div class="acc-card"><div class="acc-kick">${esc(L.id)} · DEBRIEFING</div><h3>${ok ? "Lezione superata" : "Lezione non superata"} · ${esc(L.titolo)}</h3>
      ${ok ? `<div class="acc-stelle">${"★".repeat(R.stelle)}${"☆".repeat(3 - R.stelle)}</div>` : `<p class="acc-ko">${esc(R.motivo)}</p>`}
      <table class="acc-tab">${L.fasi.map((F, i) => `<tr><td>${i < R.tempi.length ? "✔" : i === R.i && !ok ? "✖" : "·"} ${esc(F.titolo)}</td><td>${i < R.tempi.length ? fmt(R.tempi[i]) + " s" : "—"}</td></tr>`).join("")}<tr><td><b>Tempo totale</b></td><td><b>${fmt(R.durata / 60, 1)} min</b></td></tr></table>
      ${note.length ? `<h4>Cosa hai visto</h4><ul>${note.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      <div class="acc-az"><button class="acc-btn" data-a="acc">Accademia</button><span class="acc-sp"></span><button class="acc-btn" data-a="rip">↻ Ripeti</button>${ok && dopo ? `<button class="acc-btn primary" data-a="next">Prossima: ${esc(dopo.titolo)} ▶</button>` : ""}</div></div>`;
    w.querySelector('[data-a="acc"]').onclick = () => { w.remove(); esci(); };
    w.querySelector('[data-a="rip"]').onclick = () => { w.remove(); const l = R.L; R.S.lezione = null; R.uscita = true; R = null; togliPannello(); avviaLezione(l); };
    const nx = w.querySelector('[data-a="next"]'); if (nx) nx.onclick = () => { w.remove(); esci(false); briefing(dopo); };
  }

  /* ======================================================================
     SCHERMATE: ACCADEMIA E BRIEFING
     ====================================================================== */
  let scr = null;
  function schermo(html) { stile(); if (!scr) { scr = document.createElement("div"); scr.id = "accademia"; document.body.appendChild(scr); } scr.innerHTML = `<div class="acc-box">${html}</div>`; scr.scrollTop = 0; scr.classList.remove("hidden"); return scr; }
  function chiudiSchermo() { if (scr) { scr.remove(); scr = null; } }
  const testata = (k, t) => `<div class="acc-top"><div><div class="acc-kick">${esc(k)}</div><h2>${t}</h2></div><div class="acc-top-az"><button class="acc-btn ghost" data-voce title="Voce narrante">${voce ? "🔊" : "🔇"}</button><button class="acc-btn ghost" data-chiudi title="Chiudi">✕</button></div></div>`;
  function aggancia(r) {
    r.querySelectorAll("[data-chiudi]").forEach(b => b.onclick = () => chiudiSchermo());
    r.querySelectorAll("[data-voce]").forEach(b => b.onclick = () => { voce = !voce; try { localStorage.setItem(KEY_VOCE, voce ? "1" : "0"); } catch (e) {} b.textContent = voce ? "🔊" : "🔇"; });
  }
  function apri() {
    try { if (typeof CADET !== "undefined" && CADET.attiva === false && document.getElementById("cadet")) CADET.chiudi(); } catch (e) {}
    const p = prog(), fatte = LEZIONI.filter(L => (p[L.id] || {}).ok).length, nx = prossima();
    const r = schermo(`${testata("CENTURION CADET", "Accademia di volo")}
      <p class="acc-lead">Il percorso del pilota da caccia, dalle basi al combattimento, sull'<b>Eurofighter Typhoon</b> della base di Istrana. Ogni lezione: teoria con i numeri veri, volo con controlli in tempo reale, debriefing. Fisica, armi e missili sono quelli del simulatore completo.</p>
      <div class="acc-progresso"><div><b>${fatte}</b> di ${LEZIONI.length} lezioni completate</div><div class="acc-bar"><i style="width:${Math.round(fatte / LEZIONI.length * 100)}%"></i></div>${nx ? `<button class="acc-btn primary" data-l="${nx.id}">▶ Continua: ${esc(nx.id)} · ${esc(nx.titolo)}</button>` : `<span class="acc-pill ok">Percorso completato</span>`}</div>
      ${MODULI.map(M => `<section class="acc-mod"><h3>${M.ico} ${esc(M.titolo)}</h3><p>${esc(M.sotto)}</p><div class="acc-grid">${LEZIONI.filter(L => L.modulo === M.id).map(L => { const q = p[L.id] || {};
        return `<button class="acc-lez ${q.ok ? "fatta" : ""} ${nx === L ? "cons" : ""}" data-l="${L.id}"><span class="acc-code">${esc(L.id)}</span><span class="acc-lt"><b>${esc(L.titolo)}</b><small>${esc(L.sotto)}</small><small class="acc-meta">${L.tipo ? "missione completa" : "volo guidato"} · ${esc(L.durata)}</small></span><span class="acc-st">${q.ok ? (L.tipo ? "✔" : "★".repeat(q.stelle || 1)) : nx === L ? "▶" : ""}</span></button>`; }).join("")}</div></section>`).join("")}
      <details class="acc-reale"><summary>Come si diventa pilota da caccia in Italia</summary><p>Il percorso reale dell'Aeronautica Militare: Accademia Aeronautica di Pozzuoli; selezione e volo basico sull'SF-260 al 70° Stormo di Latina; addestramento avanzato e alla caccia sui T-345 e T-346 del 61° Stormo di Galatina (Lecce); conversione operativa sull'Eurofighter al 4° Stormo di Grosseto; infine un reparto operativo come il 51° Stormo di Istrana. Servono anni: l'accademia del simulatore ne riprende i concetti, non sostituisce l'addestramento.</p></details>
      <p class="acc-nota">${esc(COMANDI)}</p>`);
    aggancia(r); r.querySelectorAll("[data-l]").forEach(b => b.onclick = () => { const L = LEZIONI.find(x => x.id === b.dataset.l); if (L) briefing(L); });
  }
  const teoriaHtml = L => `${(L.teoria || []).map(([t, p]) => `<h4>${esc(t)}</h4><p>${esc(p)}</p>`).join("")}${L.numeri ? `<table class="acc-tab">${L.numeri.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</table>` : ""}`;
  function briefing(L) {
    if (L.tipo) return capstone(L);
    const q = prog()[L.id] || {};
    const r = schermo(`${testata(`ACCADEMIA · ${MODULI.find(M => M.id === L.modulo).titolo}`, `${esc(L.id)} · ${esc(L.titolo)}`)}
      <p class="acc-lead"><b>Obiettivo.</b> ${esc(L.obiettivo)}${q.ok ? ` <span class="acc-pill ok">già superata ${"★".repeat(q.stelle || 1)}</span>` : ""}</p>
      <div class="acc-split"><div class="acc-pan">${teoriaHtml(L)}</div>
        <div class="acc-pan blue"><h4>Le fasi del volo</h4><ol>${L.fasi.map(F => `<li><b>${esc(F.titolo)}.</b> ${esc(F.testo)}</li>`).join("")}</ol>
          <h4>Comandi</h4><p class="acc-small">${esc(COMANDI)}</p>
          <p class="acc-small">Velivolo: Eurofighter Typhoon · durata indicativa ${esc(L.durata)} · durante il volo il pannello in alto a destra mostra la fase, i valori da rispettare e i consigli; 📖 riapre la teoria in pausa.</p></div></div>
      <div class="acc-az"><button class="acc-btn" data-ind>◀ Accademia</button><span class="acc-sp"></span><button class="acc-btn primary big" data-via>✈ Inizia il volo</button></div>`);
    aggancia(r); parla(`${L.titolo}. ${L.obiettivo}`);
    r.querySelector("[data-ind]").onclick = apri; r.querySelector("[data-via]").onclick = () => { try { speechSynthesis.cancel(); } catch (e) {} avviaLezione(L); };
  }
  function capstone(L) {
    const r = schermo(`${testata(`ACCADEMIA · ${MODULI.find(M => M.id === L.modulo).titolo}`, `${esc(L.id)} · ${esc(L.titolo)}`)}
      <p class="acc-lead">${esc(L.sotto)}.</p><div class="acc-pan">${L.tipo === "cadet"
        ? "<p>Una missione completa del simulatore, da comandante: scegli il percorso, la protezione e quanti bombardieri rischiare contro una difesa nemica che non conosci. Gli aerei eseguono il piano, la simulazione si ferma nei momenti decisivi e il debriefing mostra che cosa sarebbe successo con scelte diverse.</p><p>È il passo dalla tecnica (modulo 3: penetrare una difesa) alla strategia: coordinare tempi, protezione e rischio.</p>"
        : "<p>In tempo di pace la difesa aerea italiana è la QRA: due Eurofighter pronti a decollare su ordine del CAOC NATO di Torrejón. Un Airbus diretto a Venezia perde il contatto radio: scramble da Istrana, eventuale supersonico, intercettazione secondo la procedura ICAO in tre fasi, identificazione visiva e scorta fino all'atterraggio.</p><p>La missione si gioca nel simulatore completo (mappa tattica, Mondo 3D, cinematiche).</p>"}</div>
      <div class="acc-az"><button class="acc-btn" data-ind>◀ Accademia</button><span class="acc-sp"></span><button class="acc-btn primary big" data-via>▶ Apri la missione</button></div>`);
    aggancia(r); r.querySelector("[data-ind]").onclick = apri;
    r.querySelector("[data-via]").onclick = () => {
      chiudiSchermo(); salvaProg(L.id, { ok: true, stelle: 3, data: new Date().toISOString().slice(0, 10) });
      if (L.tipo === "cadet" && typeof CADET !== "undefined") { CADET.apri(); setTimeout(() => { const b = document.querySelector("#cadet [data-inizia]"); if (b) b.click(); }, 0); }
      else if (typeof VENETO !== "undefined" && VENETO.ID && typeof MISSIONI !== "undefined") { try { MISSIONI.carica(VENETO.ID); APP.setRuolo("TRAINER"); APP.vaiFase("briefing"); } catch (e) { console.warn(e); } }
    };
  }

  function stile() {
    if (document.getElementById("acc-style")) return; const st = document.createElement("style"); st.id = "acc-style";
    st.textContent = `
    #accademia{position:fixed;inset:0;z-index:99000;overflow-y:auto;-webkit-overflow-scrolling:touch;background:radial-gradient(1200px 600px at 50% -10%,#1b3350,#0f1419 60%);color:#e6edf3;font-family:"Segoe UI",Roboto,Arial,sans-serif}
    #accademia .acc-box{max-width:1100px;margin:0 auto;padding:16px 16px 28px}
    #accademia .acc-top{display:flex;gap:12px;align-items:flex-start}#accademia .acc-top>div:first-child{flex:1}#accademia .acc-top-az{display:flex;gap:6px}
    #accademia .acc-kick,.acc-modal .acc-kick{color:#f1c40f;font-weight:800;letter-spacing:.12em;font-size:12px;text-transform:uppercase}
    #accademia h2{font-size:26px;margin:4px 0}#accademia h3{margin:6px 0 2px;font-size:19px}#accademia h4,.acc-modal h4{margin:10px 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#9ccbff}
    #accademia .acc-lead{font-size:16px;line-height:1.5;color:#d6e2ee}#accademia .acc-nota,#accademia .acc-small{color:#8b98a8;font-size:13px;line-height:1.45}
    .acc-btn{background:#1d2530;color:#e6edf3;border:1px solid #2a3441;border-radius:10px;padding:10px 14px;font-weight:700;font-size:15px;cursor:pointer;min-height:44px}
    .acc-btn.primary{background:#2e86de;border-color:#2e86de}.acc-btn.ghost{background:transparent}.acc-btn.big{font-size:18px;padding:13px 22px}
    .acc-az{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}.acc-sp{flex:1}
    #accademia .acc-progresso{display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#161c24;border:1px solid #2a3441;border-radius:12px;padding:10px 12px;margin:8px 0}
    .acc-bar{flex:1;min-width:120px;height:8px;background:#2a3441;border-radius:5px;overflow:hidden}.acc-bar i{display:block;height:100%;background:#2ecc71}
    #accademia .acc-mod{margin-top:14px}#accademia .acc-mod>p{margin:2px 0 8px;color:#aab7c6;font-size:14px}
    #accademia .acc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}
    #accademia .acc-lez{display:flex;gap:10px;align-items:center;text-align:left;background:#161c24;border:2px solid #2a3441;border-radius:12px;padding:10px;color:#e6edf3;cursor:pointer}
    #accademia .acc-lez.fatta{border-color:#2ecc7188}#accademia .acc-lez.cons{border-color:#f1c40f}
    .acc-code{flex:none;min-width:34px;height:34px;padding:0 4px;border-radius:9px;background:#2a3441;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:13px}
    #accademia .acc-lt{flex:1}#accademia .acc-lt b{display:block;font-size:15px}#accademia .acc-lt small{display:block;color:#aab7c6;font-size:12.5px;margin-top:1px}#accademia .acc-meta{color:#7f8fa3!important}
    #accademia .acc-st{color:#f1c40f;font-weight:900;white-space:nowrap}
    .acc-pill{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:800;background:#2a3441}.acc-pill.ok{background:#2ecc71;color:#052}
    #accademia .acc-split{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px;align-items:start}
    #accademia .acc-pan{background:#161c24;border:1px solid #2a3441;border-left:4px solid #f1c40f;border-radius:12px;padding:10px 14px;font-size:15px;line-height:1.5}#accademia .acc-pan.blue{border-left-color:#2e86de}#accademia .acc-pan p{margin:4px 0 8px}#accademia .acc-pan ol{padding-left:20px;margin:4px 0}#accademia .acc-pan li{margin:4px 0}
    .acc-tab{width:100%;border-collapse:collapse;margin:8px 0}.acc-tab td{border-bottom:1px solid #2a3441;padding:5px 4px;font-size:14px;vertical-align:top}.acc-tab td:first-child{color:#aab7c6;width:44%}
    #accademia .acc-reale{margin-top:16px;background:#0b2a4a;border:1px solid #2e86de;border-radius:12px;padding:10px 14px;font-size:14px;line-height:1.5}#accademia .acc-reale summary{cursor:pointer;font-weight:800}
    #acc-pan{position:absolute;top:calc(max(6px,env(safe-area-inset-top)) + 6px);right:max(8px,env(safe-area-inset-right));z-index:6;width:min(360px,44vw);max-height:36vh;overflow:auto;background:#0b1220dd;border:1px solid #f1c40f88;border-radius:12px;color:#e6edf3;font:13px/1.35 "Segoe UI",Roboto,Arial,sans-serif;box-shadow:0 6px 24px #0008}
    #acc-pan.min .acc-pb{display:none}
    #acc-pan .acc-ph{display:flex;gap:6px;align-items:center;padding:6px 8px;border-bottom:1px solid #ffffff1c;position:sticky;top:0;background:#0b1220f0}
    #acc-pan .acc-ph b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#acc-pan .acc-code{min-width:28px;height:24px;font-size:11px;background:#f1c40f;color:#221a00}
    #acc-pan button{background:#1d2530;border:1px solid #2a3441;color:#e6edf3;border-radius:7px;min-width:30px;height:28px;font-size:13px;cursor:pointer}
    #acc-pan .acc-pb{padding:6px 9px 8px}#acc-pan .acc-fase{color:#f7dc6f;font-size:12px}#acc-pan .acc-testo{margin:3px 0 6px;font-size:13.5px}
    #acc-pan .acc-dato{display:flex;gap:6px;align-items:baseline;padding:2px 0;border-bottom:1px dashed #ffffff14}#acc-pan .acc-dato span{flex:1;color:#aab7c6}#acc-pan .acc-dato b{font-variant-numeric:tabular-nums}#acc-pan .acc-dato small{color:#7f8fa3;min-width:64px;text-align:right}
    #acc-pan .acc-dato.ok b{color:#7dffb0}#acc-pan .acc-dato.ko b{color:#ffb38a}
    #acc-pan .acc-bar{margin-top:6px;height:7px}#acc-pan .acc-hold{color:#aab7c6}
    #acc-pan .acc-msg{margin-top:5px;padding:5px 7px;border-radius:7px;background:#16324f;color:#d6ecff}#acc-pan .acc-msg.warn{background:#5a2a12;color:#ffd7b8}
    #acc-pan .acc-esito{font-weight:800;font-size:15px;padding:4px 0}#acc-pan .acc-esito.ok{color:#7dffb0}#acc-pan .acc-esito.ko{color:#ffb38a}
    #acc-pan.compatto{font-size:12px}#acc-pan.compatto .acc-ph{padding:4px 6px}#acc-pan.compatto .acc-ph b{font-size:12px}#acc-pan.compatto button{height:24px;min-width:26px;font-size:12px}#acc-pan.compatto .acc-pb{padding:4px 7px 6px}#acc-pan.compatto .acc-testo{font-size:12px;margin:2px 0 4px}#acc-pan.compatto .acc-dato small{min-width:44px}#acc-pan.compatto .acc-msg{padding:3px 6px}
    #acc-pan.compatto:not(.min) .acc-pb{display:flex;flex-direction:column}#acc-pan.compatto .acc-testo{order:1}#acc-pan.compatto .acc-msg{order:2;margin:2px 0 4px}#acc-pan.compatto .acc-bar,#acc-pan.compatto .acc-hold{order:3}#acc-pan.compatto .acc-dato{order:4}
    #acc-toast{position:absolute;left:50%;top:22%;transform:translateX(-50%);z-index:6;background:#1e8449ee;color:#fff;font:800 16px "Segoe UI",Roboto,Arial,sans-serif;padding:8px 16px;border-radius:999px;opacity:0;pointer-events:none}
    #acc-toast.on{animation:accT 2.2s ease}@keyframes accT{0%{opacity:0}10%{opacity:1}75%{opacity:1}100%{opacity:0}}
    .acc-modal{position:absolute;inset:0;z-index:8;background:#060c14d9;display:flex;align-items:center;justify-content:center;padding:12px;overflow:auto}
    .acc-modal .acc-card{max-width:680px;width:100%;max-height:92vh;overflow:auto;background:#0f1722;border:2px solid #f1c40f;border-radius:14px;padding:14px 16px;color:#e6edf3;font:15px/1.5 "Segoe UI",Roboto,Arial,sans-serif}
    .acc-modal h3{margin:4px 0 6px;font-size:21px}.acc-modal p{margin:4px 0 8px}.acc-modal ul{padding-left:18px}
    .acc-stelle{font-size:30px;color:#f1c40f;letter-spacing:.1em}.acc-ko{color:#ffb38a;font-weight:700}
    @media (max-width:760px){#accademia .acc-split{grid-template-columns:1fr}#accademia h2{font-size:21px}}
    @media (max-height:460px){#acc-pan{max-height:33vh;width:min(320px,40vw);font-size:12px}#acc-pan .acc-testo{font-size:12.5px}#acc-pan button{height:26px;min-width:28px}.acc-modal .acc-card{font-size:13.5px;padding:10px 12px}.acc-modal h3{font-size:18px}}`;
    document.head.appendChild(st);
  }

  return { apri, briefing: id => { const L = LEZIONI.find(x => x.id === id); if (L) briefing(L); }, avvia: id => { const L = LEZIONI.find(x => x.id === id); if (L) (L.tipo ? capstone(L) : avviaLezione(L)); }, esci,
    LEZIONI, MODULI, get attiva() { return !!R; }, get stato() { return R && { id: R.L.id, fase: R.i, hold: R.hold, esito: R.esito, motivo: R.motivo, c: R.c, r: R.r }; }, _R: () => R, _xz: xz };
})();
