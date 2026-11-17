/* =====================================================================
   CENTURION 2 · MISSIONE VENETO – «LAGUNA QRA»
   Un Airbus A330 diretto a Venezia smette di rispondere al controllo (COMLOSS):
   la coppia QRA di Istrana decolla su allarme (scramble), lo intercetta, lo identifica
   a vista (VID) e lo scorta fino all'atterraggio sulla pista 04R di Venezia Tessera.
   - rotta dell'Airbus a scelta (Nord, Ovest, Est, Sud) con discesa e avvicinamento ILS 04R;
   - motore: QRA (allarme, scramble, intercettazione, conversione in coda, VID, scorta,
     rientro) e obiettivi, aggiunti a Engine senza toccare le altre missioni;
   - mappa tattica: piste, finale ILS, limite VID, rotte e traccia del volo civile;
   - Mondo 3D: Airbus selezionabile, piste con segnaletica e luci, immagini satellitari
     ad alta risoluzione su Tessera, Venezia e Istrana, Campanile di San Marco.
   Testate delle piste: OurAirports (dati aperti). Compagnia, marche, procedure e nomi dei
   punti sono inventati; nessuna arma viene impiegata.
   ===================================================================== */
const VENETO = (() => {
  "use strict";
  const KEY = "centurion_veneto_rotta", NM = 1852, FT = 0.3048, KT = 0.514444, G0 = 9.81;
  const PRONTEZZA_S = 300, VID_S = 60, CIV_ID = "CIV:LGN451";
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const norm = a => ((a % 360) + 360) % 360, angd = (a, b) => ((b - a + 540) % 360) - 180;

  /* ---------- aeroporti e piste (testate OurAirports) ---------- */
  const LIPZ = { id: "LIPZ", nome: "Venezia Tessera", lat: 45.505299, lon: 12.3519, elev_ft: 7 };
  const LIPS = { id: "LIPS", nome: "Istrana", lat: 45.684382, lon: 12.086594, elev_ft: 137 };
  const PISTE = {
    "LIPZ-04R": { aeroporto: "LIPZ", nomi: ["04R", "22L"], a: [45.494098, 12.3377], b: [45.516201, 12.366], larghezza: 45, ils: true },
    "LIPZ-04L": { aeroporto: "LIPZ", nomi: ["04L", "22R"], a: [45.495201, 12.3356], b: [45.513699, 12.359399], larghezza: 45, soglia_a: 94 },
    "LIPS-08": { aeroporto: "LIPS", nomi: ["08", "26"], a: [45.682598, 12.0682], b: [45.686298, 12.1062], larghezza: 32, soglia_a: 291, soglia_b: 290 },
    "LIPH-07": { aeroporto: "LIPH", nomi: ["07", "25"], a: [45.6445, 12.1799], b: [45.6523, 12.209], larghezza: 44, soglia_a: 77, soglia_b: 119 }
  };
  const CAMPANILE = { lat: 45.43427, lon: 12.33907, h: 98.6 };

  /* ---------- geometria locale (metri) ---------- */
  const COS0 = Math.cos(rad(LIPZ.lat));
  const xy = p => ({ x: (p.lon - LIPZ.lon) * 111320 * COS0, y: (p.lat - LIPZ.lat) * 111320 });
  const ll = (x, y) => ({ lat: LIPZ.lat + y / 111320, lon: LIPZ.lon + x / (111320 * COS0) });
  const distM = (a, b) => { const k = Math.cos(rad((a.lat + b.lat) / 2)); return Math.hypot((b.lat - a.lat) * 111320, (b.lon - a.lon) * 111320 * k); };
  const brg = (a, b) => { const k = Math.cos(rad((a.lat + b.lat) / 2)); return norm(deg(Math.atan2((b.lon - a.lon) * k, b.lat - a.lat))); };
  const destM = (p, h, m) => ({ lat: p.lat + m * Math.cos(rad(h)) / 111320, lon: p.lon + m * Math.sin(rad(h)) / (111320 * Math.cos(rad(p.lat))) });

  /* ---------- avvicinamento ILS 04R (comune a tutte le rotte) ---------- */
  const R04 = PISTE["LIPZ-04R"], THR = { lat: R04.a[0], lon: R04.a[1] }, QFU = brg(THR, { lat: R04.b[0], lon: R04.b[1] });
  const suFinale = nmDist => destM(THR, QFU + 180, nmDist * NM);
  const W = (nome, lat, lon, alt, kt, extra) => Object.assign({ nome, lat, lon, alt, kt }, extra || {});
  const FINALE = [
    W("IF · 15 NM", suFinale(15).lat, suFinale(15).lon, 4000, 205, { finale: true, ifx: true }),
    W("FAF · 9,4 NM", suFinale(9.4).lat, suFinale(9.4).lon, 3000, 172),
    W("4 NM", suFinale(4).lat, suFinale(4).lon, 1280, 152),
    W("Soglia 04R", THR.lat, THR.lon, 55, 142, { soglia: true }),
    W("Toccata", destM(THR, QFU, 420).lat, destM(THR, QFU, 420).lon, 7, 136, { toccata: true }),
    W("Fine corsa", destM(THR, QFU, 1900).lat, destM(THR, QFU, 1900).lon, 7, 18, { fineCorsa: true })
  ];
  /* Rotte dell'Airbus: punti su località reali, quote e velocità al suolo illustrative (non procedure pubblicate). */
  const ROTTE = [
    { id: "nord", nome: "Nord · dalle Alpi", origine: "Monaco di Baviera", via: "Innsbruck, Brennero, Bolzano, Trento, Bassano, Padova",
      descr: "Discesa lungo la valle dell'Adige e la pedemontana: passa a ovest di Istrana e gira in finale sopra Piove di Sacco.",
      punti: [W("Innsbruck", 47.26, 11.40, 32000, 440), W("Brennero", 47.00, 11.51, 30000, 435), W("Bolzano", 46.50, 11.35, 26000, 425),
        W("Trento", 46.07, 11.12, 20000, 405), W("Bassano del Grappa", 45.77, 11.73, 13000, 340), W("Padova", 45.41, 11.88, 8000, 265)] },
    { id: "ovest", nome: "Ovest · da Milano", origine: "Parigi Charles de Gaulle", via: "Milano, Brescia, Verona, Lonigo, Este, Conselve",
      descr: "Lungo la pianura padana: scende a sud dei Colli Euganei e si allinea alla finale dalla bassa padovana.",
      punti: [W("Milano", 45.45, 9.40, 32000, 450), W("Brescia", 45.54, 10.22, 30000, 445), W("Verona", 45.40, 10.90, 24000, 425),
        W("Lonigo", 45.39, 11.39, 16000, 380), W("Este", 45.23, 11.66, 10000, 300), W("Conselve", 45.23, 11.87, 7000, 255)] },
    { id: "est", nome: "Est · dall'Adriatico", origine: "Vienna", via: "Lubiana, Trieste, Grado, Caorle, Jesolo, Pellestrina",
      descr: "Dal golfo di Trieste al largo della costa veneta, poi verso Chioggia e virata in finale da sud. La più lontana da Istrana.",
      punti: [W("Lubiana", 46.05, 14.51, 32000, 445), W("Trieste", 45.65, 13.78, 27000, 430), W("Golfo di Trieste", 45.55, 13.35, 21000, 410),
        W("Al largo di Caorle", 45.40, 12.95, 14000, 350), W("Al largo di Chioggia", 45.16, 12.55, 9000, 290), W("Sottomarina", 45.17, 12.30, 6000, 245)] },
    { id: "sud", nome: "Sud · da Roma", origine: "Roma Fiumicino", via: "Firenze, Bologna, Ferrara, Rovigo, Cavarzere",
      descr: "Dagli Appennini alla bassa padana: arriva da sud e si allinea alla finale con una virata di soli 40 gradi.",
      punti: [W("Firenze", 43.77, 11.25, 32000, 445), W("Bologna", 44.53, 11.30, 28000, 435), W("Ferrara", 44.84, 11.62, 22000, 415),
        W("Rovigo", 45.07, 11.79, 15000, 360), W("Cavarzere", 45.14, 12.08, 9000, 290)] }
  ];
  const CIVILE = { cs: "LAGUNA 451", tipo: "Airbus A330-200", marche: "I-LGNA", compagnia: "Laguna Air (compagnia inventata)" };
  const QRA = { id: "FALCO", cs: "FALCO" };
  const rotta = id => ROTTE.find(r => r.id === id) || ROTTE[0];
  function rottaScelta() { try { return rotta(localStorage.getItem(KEY)).id; } catch (e) { return ROTTE[0].id; } }

  /* ---------- profilo del volo civile: posizione = funzione del tempo di missione ---------- */
  function catmull(p0, p1, p2, p3, t) {   // centripeta (Barry-Goldman), senza cappi
    const d = (a, b) => Math.max(1e-6, Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y)));
    const t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3), u = t1 + (t2 - t1) * t;
    const mix = (a, b, ta, tb) => ({ x: ((tb - u) * a.x + (u - ta) * b.x) / (tb - ta), y: ((tb - u) * a.y + (u - ta) * b.y) / (tb - ta) });
    const A1 = mix(p0, p1, 0, t1), A2 = mix(p1, p2, t1, t2), A3 = mix(p2, p3, t2, t3);
    return mix(mix(A1, A2, 0, t2), mix(A2, A3, t1, t3), t1, t2);
  }
  const cacheProf = {};
  function profilo(idRotta) {
    const r = rotta(idRotta); if (cacheProf[r.id]) return cacheProf[r.id];
    const wp = r.punti.concat(r.saltaIF ? FINALE.slice(1) : FINALE).map(w => Object.assign({}, w, xy(w)));
    const iFin = wp.findIndex(w => w.finale);
    const S = [];   // campioni {x, y, alt, kt, w (indice del punto di partenza del tratto)}
    for (let i = 0; i < wp.length - 1; i++) {
      const a = wp[i], b = wp[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(2, Math.ceil(L / 350));
      for (let k = (i === 0 ? 0 : 1); k <= n; k++) {
        const u = k / n; let p;
        if (iFin < 0 || i < iFin) p = catmull(wp[Math.max(0, i - 1)], a, b, wp[Math.min(wp.length - 1, i + 2)], u);
        else p = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
        S.push({ x: p.x, y: p.y, alt: a.alt + (b.alt - a.alt) * u, kt: a.kt + (b.kt - a.kt) * u, w: i + (k === n ? 1 : 0) });
      }
    }
    let s = 0, t = 0; S[0].s = 0; S[0].t = 0;
    for (let k = 1; k < S.length; k++) {
      const ds = Math.hypot(S[k].x - S[k - 1].x, S[k].y - S[k - 1].y), v = Math.max(5, (S[k].kt + S[k - 1].kt) / 2 * KT);
      s += ds; t += ds / v; S[k].s = s; S[k].t = t;
    }
    const idx = f => S.findIndex(c => wp[c.w] && wp[c.w][f]);
    const P = { rotta: r, wp, S, durata: t, lung: s, iSoglia: idx("soglia"), iToccata: idx("toccata"), iFine: S.length - 1 };
    P.tSoglia = S[P.iSoglia].t; P.tToccata = S[P.iToccata].t; P.sSoglia = S[P.iSoglia].s; P.tFinale = S[Math.max(0, S.findIndex(c => c.w >= iFin))].t;
    return (cacheProf[r.id] = P);
  }
  function campione(P, tau) {
    const S = P.S; if (tau <= 0) return Object.assign({}, S[0], { k: 0 }); if (tau >= P.durata) return Object.assign({}, S[S.length - 1], { k: S.length - 1 });
    let lo = 0, hi = S.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m].t <= tau) lo = m; else hi = m; }
    const a = S[lo], b = S[hi], u = (tau - a.t) / Math.max(1e-6, b.t - a.t);
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, alt: a.alt + (b.alt - a.alt) * u, kt: a.kt + (b.kt - a.kt) * u, s: a.s + (b.s - a.s) * u, t: tau, k: lo };
  }
  function inizio(sc) { try { return Engine.hm2s(sc.tempo.inizio); } catch (e) { return 9 * 3600; } }
  /* Stato del volo civile al tempo di missione T (secondi, come engine.t). */
  function civile(sc, T) {
    const P = profilo(sc && sc.veneto ? sc.veneto.rotta : ROTTE[0].id), tau = T - inizio(sc);
    const c = campione(P, tau), a = campione(P, tau - 2), b = campione(P, tau + 2);
    const pos = ll(c.x, c.y);
    let hdg = Math.hypot(b.x - a.x, b.y - a.y) > 0.5 ? norm(deg(Math.atan2(b.x - a.x, b.y - a.y))) : QFU;
    const h1 = campione(P, tau - 4), h2 = campione(P, tau + 4), h3 = campione(P, tau + 8);
    const hA = norm(deg(Math.atan2(h2.x - h1.x, h2.y - h1.y))), hB = norm(deg(Math.atan2(h3.x - c.x, h3.y - c.y)));
    const w = angd(hA, hB) / 6, v = c.kt * KT;   // deg/s
    const bank = tau > 0 && tau < P.tSoglia ? clamp(deg(Math.atan(v * rad(w) / G0)), -28, 28) : 0;
    const vs = (b.alt - a.alt) / 4 * 60;   // ft/min
    const fase = tau <= 0 ? "in arrivo" : tau < P.tFinale ? (c.alt > 24000 ? "crociera" : "discesa") : tau < P.tSoglia ? "avvicinamento ILS 04R" : tau < P.tToccata ? "richiamata" : tau < P.durata ? "corsa d'atterraggio" : "atterrato";
    const gamma = deg(Math.atan2(vs * FT / 60, Math.max(v, 1)));
    const pitch = fase === "atterrato" || fase === "corsa d'atterraggio" ? 0 : fase === "richiamata" ? 5.5 : clamp(gamma + (c.kt < 190 ? 4.5 : 2), -4, 10);
    return { lat: pos.lat, lon: pos.lon, alt: c.alt, hdg, kt: tau >= P.durata ? 0 : c.kt, vs, bank, pitch, fase, tau, s: c.s,
      dSoglia: Math.max(0, P.sSoglia - c.s), aTerra: tau >= P.tToccata, fermo: tau >= P.durata, P };
  }

  /* ---------- motore: QRA e volo civile (estensione di Engine, solo per questa missione) ---------- */
  function initMotore(eng) {
    eng.veneto = null; const sc = eng.sc; if (!sc.veneto) return;
    const t0 = inizio(sc), P = profilo(sc.veneto.rotta);
    eng.veneto = { civ: T => civile(sc, T), t0, P, tComloss: t0 + 60, tAllarme: t0 + 120, comloss: false, allarme: false,
      decollo: null, contatto: null, vid: null, radio: null, rilascio: null, toccata: null, libera: false, tToccata: t0 + P.tToccata };
    eng.flights.forEach(f => { if (f.ruolo === "QRA") { f.qra = true; f.fase = "QRA in allerta a " + ((eng.base(f.base) || {}).nome || f.base); } });
  }
  function aggiornaCivile(eng) {
    const V = eng.veneto, t = eng.t, cs = CIVILE.cs; if (!V || eng.finita) return;
    if (!V.comloss && t >= V.tComloss) { V.comloss = true; const c = V.civ(t);
      eng.evento("PADOVA ACC", `${cs} (${CIVILE.tipo} da ${eng.sc.veneto.origine}) non risponde da 6 minuti: COMLOSS a FL${Math.round(c.alt / 100)}`, "avviso"); }
    if (!V.allarme && t >= V.tAllarme) { V.allarme = true;
      eng.evento("COA", `Allarme alla QRA di Istrana: identificare il ${cs} prima dell'ingresso nell'area di Venezia`, "inject"); }
    if (V.toccata == null && t >= V.tToccata) { V.toccata = t; eng.evento(cs, `Atterrato sulla pista 04R di ${LIPZ.nome}`, "blue"); }
    if (!V.libera && V.toccata != null && t >= V.t0 + V.P.durata + 30) { V.libera = true; eng.evento(cs, "Libera la pista e rulla al parcheggio: emergenza conclusa", "sistema"); }
  }
  function aLocale(c, f) {   // posizione di f nel riferimento del velivolo civile (m): x = sinistra, y = avanti, z = alto
    const k = Math.cos(rad(c.lat)), e = (f.lon - c.lon) * 111320 * k, n = (f.lat - c.lat) * 111320, h = rad(c.hdg);
    return { x: -e * Math.cos(h) + n * Math.sin(h), y: e * Math.sin(h) + n * Math.cos(h), z: (f.alt - c.alt) * FT };
  }
  // insegue in formazione: l'offset attuale si sposta verso quello voluto a velocità relativa limitata
  function segui(eng, f, c, off, dt, vRel) {
    const o = f.qraOff || (f.qraOff = aLocale(c, f));
    const dx = off.x - o.x, dy = off.y - o.y, dz = off.z - o.z, d = Math.hypot(dx, dy, dz), passo = Math.min(d, vRel * dt);
    if (d > 0.01) { o.x += dx / d * passo; o.y += dy / d * passo; o.z += dz / d * passo; }
    const h = rad(c.hdg), e = o.y * Math.sin(h) - o.x * Math.cos(h), n = o.y * Math.cos(h) + o.x * Math.sin(h), k = Math.cos(rad(c.lat));
    const vLat = d > 0.01 ? dx / d * passo / dt : 0, vFwd = c.kt * KT + (d > 0.01 ? dy / d * passo / dt : 0);
    f.lat = c.lat + n / 111320; f.lon = c.lon + e / (111320 * k); f.alt = Math.max(0, c.alt + o.z / FT);
    f.hdg = norm(c.hdg - deg(Math.atan2(vLat, Math.max(vFwd, 30)))); f.tas = vFwd / KT; f.gs = f.tas; f.track = f.hdg;
    f.mach = typeof PHYS !== "undefined" && PHYS.mach ? PHYS.mach(f.tas, f.alt) : f.tas / 600; f.turnRate = 0; f.nG = 1; f.regime = "crociera";
    return d - passo;
  }
  function vola(eng, f, tipo, dt, dest, altFt, tasKt, bank) {
    const s = PHYS.step(f, { lat: dest.lat, lon: dest.lon, alt: altFt }, tipo, dt, { vento: eng.vento, tasTarget: tasKt, bank: bank || 45, regime: "crociera", alt: altFt });
    Object.assign(f, s);
  }
  const OFF_VID = { x: 200, y: 12, z: 0 }, OFF_SCORTA = { x: 170, y: -420, z: 60 };
  function qraFlight(eng, f, dt) {
    const V = eng.veneto, tipo = eng.tipo(f), cs = CIVILE.cs; if (!V) return false;
    switch (f.stato) {
      case "terra":
        if (!V.allarme || f.sortie > 0) return true;
        f.stato = "scramble"; f.t_prontezza = eng.t + PRONTEZZA_S; f.fase = "SCRAMBLE – QRA in preparazione";
        f.armi = { ...(tipo.armi || {}) }; eng.pieno(f, 30); f.wps = []; f.wp_i = 0;
        eng.evento(f.callsign, `SCRAMBLE QRA da ${(eng.base(f.base) || {}).nome || f.base}: decollo entro ${PRONTEZZA_S / 60} minuti per identificare il ${cs}`, "blue");
        return true;
      case "scramble":
        if (eng.t < f.t_prontezza) return true;
        eng.decolla(f, "SCRAMBLE QRA"); V.decollo = eng.t;
        f.hdg = norm(brg({ lat: PISTE["LIPS-08"].a[0], lon: PISTE["LIPS-08"].a[1] }, { lat: PISTE["LIPS-08"].b[0], lon: PISTE["LIPS-08"].b[1] }));
        f.alt = 300; f.tas = 220; f.stato = "qra_intercetta"; f.fase = "Intercettazione"; f.regime = "salita";
        return true;
      case "qra_intercetta": {
        const c = V.civ(eng.t); let T = 0, p = c;
        for (let k = 0; k < 4; k++) { p = V.civ(eng.t + T); T = distM(f, p) / ((Math.max(f.tas, 350) + p.kt * 0.6) * KT); }
        p = V.civ(eng.t + T * 0.9);
        vola(eng, f, tipo, dt, p, Math.max(3000, c.alt + 1500), 600, 45); eng.consuma(f, "crociera", dt);
        if (distM(f, c) < 9 * NM) { f.stato = "qra_conversione"; f.fase = "Conversione in coda al " + cs; V.contatto = eng.t;
          eng.evento(f.callsign, `Contatto sul ${cs} a 9 NM, FL${Math.round(c.alt / 100)}: conversione in coda`, "blue"); }
        return true;
      }
      case "qra_conversione": {
        const c = V.civ(eng.t), dietro = destM(c, c.hdg + 180, 1.0 * NM), d = distM(f, dietro);
        const tas = Math.min(620, c.kt + (d > 4 * NM ? 250 : d > 1.5 * NM ? 160 : 80));
        vola(eng, f, tipo, dt, dietro, c.alt + 300, tas, 60); eng.consuma(f, "crociera", dt);
        if (d < 0.6 * NM && Math.abs(angd(f.hdg, c.hdg)) < 60) { f.qraOff = null; f.stato = "qra_vid"; f.fase = "Avvicinamento per l'identificazione"; f.qraVidT0 = null; }
        return true;
      }
      case "qra_vid": {
        const c = V.civ(eng.t), resto = segui(eng, f, c, OFF_VID, dt, 70); eng.consuma(f, "crociera", dt);
        if (resto < 25 && f.qraVidT0 == null) { f.qraVidT0 = eng.t; f.fase = "Identificazione visiva (VID)";
          eng.evento(f.callsign, `Sul lato sinistro del ${cs}, all'altezza della cabina: identificazione visiva in corso`, "blue"); }
        if (f.qraVidT0 != null && eng.t - f.qraVidT0 >= VID_S) {
          V.vid = { t: eng.t, nm: distM(c, THR) / NM, lat: c.lat, lon: c.lon, fl: Math.round(c.alt / 100) };
          eng.evento(f.callsign, `VID a ${Math.round(V.vid.nm)} NM da Venezia: ${CIVILE.tipo}, ${CIVILE.compagnia.split(" (")[0]}, marche ${CIVILE.marche}, nessuna anomalia visibile`, "blue");
          eng.evento(cs, "Risponde ai segnali a vista e torna in contatto radio: guasto alla radio, chiede di proseguire per Venezia", "info");
          V.radio = eng.t; f.stato = "qra_scorta"; f.fase = "Scorta fino a Venezia";
        }
        return true;
      }
      case "qra_scorta": {
        const c = V.civ(eng.t); segui(eng, f, c, OFF_SCORTA, dt, 30); eng.consuma(f, "crociera", dt);
        if ((c.dSoglia <= 4 * NM || c.aTerra) && V.rilascio == null) {
          V.rilascio = { t: eng.t, nm: c.dSoglia / NM };
          eng.evento(f.callsign, `Scorta conclusa: ${cs} in corto finale per la pista 04R. Rientro a Istrana`, "blue");
          f.qraOff = null; f.stato = "qra_rientro"; f.fase = "Rientro a Istrana";
        }
        return true;
      }
      case "qra_rientro": {
        const b = eng.base(f.base), d = distM(f, b), alt = d > 9 * NM ? 4000 : Math.max(0, (d - 1.5 * NM) / (7.5 * NM) * 4000);
        vola(eng, f, tipo, dt, b, alt, d > 6 * NM ? 380 : 220, 35); eng.consuma(f, "crociera", dt);
        if (d < 1.4 * NM) { f.qraOff = null; eng.atterra(f); }
        return true;
      }
    }
    return false;   // a terra dopo l'atterraggio, riarmo: come sempre nel motore
  }
  function valutaQra(eng, o) {
    const V = eng.veneto, def = (eng.sc.obiettivi || [])[o.n - 1] || {}, fine = eng.finita; if (!V || !/^qra_/.test(o.tipo)) return o;
    let ok = false, fallito = false, prog = "";
    if (o.tipo === "qra_vid") { const min = def.min_nm || 20; ok = !!(V.vid && V.vid.nm >= min); fallito = !ok && ((V.vid && V.vid.nm < min) || (!V.vid && (V.toccata != null || fine)));
      prog = V.vid ? `VID a ${V.vid.nm.toFixed(0)} NM (minimo ${min})` : V.contatto ? "intercettazione in corso" : V.decollo ? "QRA in volo" : V.allarme ? "scramble" : ""; }
    else if (o.tipo === "qra_scorta") { ok = !!(V.vid && V.rilascio && V.toccata != null); fallito = !ok && (V.toccata != null && !V.vid || fine);
      prog = ok ? `rilascio a ${V.rilascio.nm.toFixed(1)} NM, atterrato alle ${Engine.s2hm(V.toccata)}` : V.rilascio ? "in corto finale" : V.radio ? "in scorta" : ""; }
    else if (o.tipo === "qra_rientro") { const q = eng.flights.find(f => f.qra); ok = !!(q && q.sortie > 0 && q.stato === "atterrato" || (q && q.sortie > 0 && q.t_atterraggio)); fallito = !ok && fine;
      prog = ok ? `atterrati alle ${Engine.s2hm(q.t_atterraggio)}` : q && q.stato === "qra_rientro" ? "in rientro" : ""; }
    return Object.assign({}, o, { ok, fallito, prog, stato: ok ? "RAGGIUNTO" : fallito ? "FALLITO" : "IN CORSO" });
  }
  function installaMotore() {
    if (typeof Engine === "undefined" || Engine.prototype._veneto) return; Engine.prototype._veneto = true;
    const reset0 = Engine.prototype.reset, flight0 = Engine.prototype.aggiornaFlight, tick0 = Engine.prototype.tick, ob0 = Engine.prototype.valutaObiettivi;
    Engine.prototype.reset = function () { const r = reset0.apply(this, arguments); try { initMotore(this); } catch (e) { console.warn("Veneto: init", e); } return r; };
    Engine.prototype.aggiornaFlight = function (f, dt) { if (f.qra && this.veneto && qraFlight(this, f, dt)) return; return flight0.call(this, f, dt); };
    Engine.prototype.tick = function () { const r = tick0.apply(this, arguments); if (this.veneto) { try { aggiornaCivile(this); } catch (e) { console.warn("Veneto: civile", e); } } return r; };
    Engine.prototype.valutaObiettivi = function () { const r = ob0.apply(this, arguments); return this.veneto ? r.map(o => valutaQra(this, o)) : r; };
  }
  installaMotore();

  /* ---------- la missione nel catalogo ---------- */
  function limiti(r) {
    const pts = r.punti.concat(FINALE, [LIPS]);
    const la = pts.map(p => p.lat), lo = pts.map(p => p.lon);
    return [[Math.min(...la) - 0.08, Math.min(...lo) - 0.12], [Math.max(...la) + 0.08, Math.max(...lo) + 0.12]];
  }
  function applica(sc) {
    const r = rotta(rottaScelta()), P = profilo(r.id);
    Object.assign(sc.tempo, { inizio: "09:00", fine: "09:50", tick_sec: 5 });
    Object.assign(sc.mappa, { centro: [45.58, 12.22], zoom: 9, tile_default: "sat", bounds: limiti(r),
      bullseye: { nome: "VENEZIA (LIPZ)", lat: LIPZ.lat, lon: LIPZ.lon }, nazioni: [], fir_boundary: [],
      sectional: { file: "", bounds: [[44.5, 10.5], [47.5, 14.6]], opacita: 0, attivo: false },
      griglia: { attiva: false, lato_nm: 10, origine: [44.6, 10.6], colonne: 18, righe: 16 } });
    // terreno 3D più dettagliato (tile z11, maglia fitta) su 110 × 110 km fra Padova, Treviso, Istrana e la laguna
    sc.mappa5 = { id: "veneto", nome: "Veneto · Laguna di Venezia", centro: [45.58, 12.22], lato_m: 110000, area_km2: 12100, quotaInizioM: 3000 };
    sc.meteo = Object.assign({}, sc.meteo, { vento_da_gradi: 40, vento_kt: 10, descrizione: "Bora debole da nord-est, visibilità oltre 10 km, nubi sparse a 3.500 piedi (condizioni illustrative, non un METAR reale)", temporali_costa: false });
    Object.assign(sc.squadre.BLUE, { nome: "QRA Istrana (simulata)", nazione: "Italia", ruolo: "Polizia aerea: identificazione e scorta di un volo civile" });
    Object.assign(sc.squadre.RED, { nome: "Traffico civile", nazione: "—", ruolo: `${CIVILE.cs}, ${CIVILE.tipo}: equipaggio senza contatto radio` });
    sc.basi = [
      { id: "LIPS", nome: "Istrana (QRA)", lato: "BLUE", lat: LIPS.lat, lon: LIPS.lon, nazione: "Italia", pista_ft: 9816 },
      { id: "LIPZ", nome: "Venezia Tessera", lato: "BLUE", lat: LIPZ.lat, lon: LIPZ.lon, nazione: "Italia", pista_ft: 10827 }
    ];
    sc.aar = []; sc.orbite = []; sc.gate = []; sc.cap_box = []; sc.sam = []; sc.target = []; sc.droni = []; sc.inject = [];
    sc.formazioni = [{ id: QRA.id, callsign: QRA.cs, lato: "BLUE", tipo: "F2000", numero: 2, base: "LIPS", ruolo: "QRA" }];
    sc.piani = { BLUE: { formazioni: {} }, RED: { cap: [], prontezza: [], sam_moves: [], commit_nm: 40 } };
    sc.veneto = { rotta: r.id, origine: r.origine, civile: Object.assign({}, CIVILE), atterraggioPrevisto: Engine.s2hm(Engine.hm2s("09:00") + P.tToccata) };
    sc.obiettivi = [
      { tipo: "qra_vid", min_nm: 20, primario: true, testo: `Identificazione visiva del ${CIVILE.cs} ad almeno 20 NM da Venezia` },
      { tipo: "qra_scorta", primario: true, testo: `Scorta del ${CIVILE.cs} fino al corto finale e atterraggio sicuro a Venezia` },
      { tipo: "perdite_max", massimo: 0, primario: true, testo: "Nessun incidente" },
      { tipo: "qra_rientro", primario: false, testo: "Rientro della coppia QRA a Istrana" }
    ];
    Object.assign(sc.briefing.BLUE, {
      titolo: "LAGUNA QRA · SCRAMBLE E SCORTA",
      situazione: `Mattina sul Veneto. Il volo ${CIVILE.cs}, ${CIVILE.tipo} di ${CIVILE.compagnia} in arrivo da ${r.origine} via ${r.via.split(", ").slice(-3).join(", ")}, smette di rispondere al controllo di Padova. La coppia QRA di Istrana, due Eurofighter, è in allerta a ${PRONTEZZA_S / 60} minuti.`,
      task: ["Decollare su allarme (scramble) entro il tempo di prontezza", `Intercettare il ${CIVILE.cs} e portarsi in coda`, "Identificarlo a vista dal lato sinistro, all'altezza della cabina", "Scortarlo fino al corto finale della pista 04R di Venezia, poi rientrare a Istrana"],
      threat: "Nessuna minaccia militare: un aereo di linea senza contatto radio (COMLOSS). Le ipotesi vanno da un guasto alla radio a un'emergenza a bordo.",
      intel: [`Rotta prevista: ${r.via}`, `Atterraggio previsto alle ${sc.veneto.atterraggioPrevisto} sulla pista 04R (ILS)`, `Marche ${CIVILE.marche}; compagnia e marche sono inventate`],
      roe: ["Missione di polizia aerea: nessun impiego di armi", "Distanza di sicurezza dal velivolo civile, avvicinamento solo da dietro e dal lato sinistro", "Segnali a vista secondo le procedure di intercettazione civile"],
      da_sapere: [`Prontezza QRA: ${PRONTEZZA_S / 60} minuti (scelta di gioco)`, "Identificazione visiva: circa un minuto in posizione", "Obiettivo: VID prima dei 20 NM da Venezia, cerchio tratteggiato sulla mappa", "La rotta dell'Airbus si sceglie nel briefing o nella fase Piano"],
      output_plan: ["Rotta dell'Airbus scelta", "Tempi: allarme, decollo, intercettazione, VID", "Punto di rilascio della scorta"]
    });
    Object.assign(sc.briefing.RED, {
      titolo: `${CIVILE.cs} · EQUIPAGGIO CIVILE`,
      situazione: `Siete l'equipaggio del ${CIVILE.cs}: la radio non funziona e non vi accorgete subito di essere fuori contatto.`,
      task: ["Proseguire secondo il piano di volo", "Rispondere ai segnali dei caccia intercettori", "Atterrare a Venezia"],
      threat: "Nessuna.", intel: ["Il controllo non vi sente: qualcuno verrà a vedere"], roe: ["Seguire le istruzioni degli intercettori"],
      da_sapere: ["Il volo civile segue la rotta scelta dal trainer"], output_plan: ["Nessun piano: il volo civile è automatico"]
    });
    return sc;
  }
  const MISSIONE = {
    codice: "LAGUNA QRA", titolo: "Veneto · scramble, identificazione e scorta a Venezia", tipo: "Polizia aerea (QRA) su traffico civile",
    difficolta: 2, durata: "50 min (simulazione)",
    focus: "Tempi dello scramble, geometria d'intercettazione, identificazione visiva e scorta sicura di un aereo di linea",
    descrizione: "Un Airbus A330 diretto a Venezia non risponde al controllo. La coppia QRA di Istrana decolla su allarme, lo intercetta, lo identifica a vista e lo scorta fino all'atterraggio sulla pista 04R di Tessera. Rotta dell'Airbus a scelta, mappa satellitare dettagliata del Veneto, cinematiche di scramble e atterraggio.",
    domande: ["Quanto tempo è passato fra l'allarme e il decollo?", "A che distanza da Venezia è avvenuta l'identificazione visiva, e perché lì?", "Come cambia l'intercettazione con le diverse rotte dell'Airbus?"],
    applica
  };
  let ID = null;
  function registra() {
    if (typeof MISSIONI === "undefined" || !MISSIONI.ELENCO || ID) return;
    const gia = MISSIONI.ELENCO.find(m => m.codice === MISSIONE.codice); if (gia) { ID = gia.id; return; }
    ID = ["M16", "M17", "M18", "M19", "M20"].find(x => !MISSIONI.ELENCO.some(m => m.id === x)) || "MV1";
    MISSIONI.ELENCO.push(Object.assign({ id: ID }, MISSIONE));
    if (typeof MISSIONI.pianiDemo === "function") {   // demo guidata: nessun piano da caricare (la QRA decolla su allarme)
      const p0 = MISSIONI.pianiDemo;
      MISSIONI.pianiDemo = function (id, sc) { if (id === ID) { sc.piani = { BLUE: { formazioni: {} }, RED: { cap: [], prontezza: [], sam_moves: [], commit_nm: 40 } }; return; } return p0.apply(this, arguments); };
    }
  }
  registra();
  const attiva = () => typeof APP !== "undefined" && APP.sc && APP.sc.veneto && APP.sc.missione && APP.sc.missione.id === ID;

  /* ---------- interfaccia: scelta della rotta (briefing e piano) ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function cardRotte() {
    const cur = APP.sc.veneto.rotta, multi = typeof RETE !== "undefined" && RETE.client && RETE.client();
    return `<div class="card gold" id="veneto-rotte"><h3>✈ Rotta dell'Airbus ${esc(CIVILE.cs)}</h3>
      <p><small>Da dove arriva il volo senza contatto radio. Cambiando rotta la simulazione riparte dalle 09:00.</small></p>
      ${ROTTE.map(r => { const P = profilo(r.id), att = Engine.s2hm(Engine.hm2s("09:00") + P.tToccata);
        return `<label style="display:block;margin:8px 0;padding:8px;border-radius:9px;border:1px solid ${r.id === cur ? "#f7dc6f" : "#ffffff22"}"><input type="radio" name="veneto-rotta" value="${r.id}" ${r.id === cur ? "checked" : ""} ${multi ? "disabled" : ""}> <b>${esc(r.nome)}</b> <small>da ${esc(r.origine)} · ${Math.round(P.lung / NM)} NM · atterraggio previsto ${att}</small><br><small style="opacity:.85">${esc(r.via)} — ${esc(r.descr)}</small></label>`; }).join("")}
      <p><small>Allarme alle 09:02, QRA in volo alle ${Engine.s2hm(Engine.hm2s("09:02") + PRONTEZZA_S)}. Obiettivo: identificazione visiva prima dei 20 NM.</small></p></div>`;
  }
  function legaRotte() {
    document.querySelectorAll('#veneto-rotte input[name="veneto-rotta"]').forEach(i => i.onchange = e => {
      const v = e.target.value; try { localStorage.setItem(KEY, v); } catch (x) {}
      if (typeof MISSIONI !== "undefined" && MISSIONI.carica(ID, { silenzioso: true })) { if (typeof UI !== "undefined" && UI.toast) UI.toast(`Rotta dell'Airbus: <b>${esc(rotta(v).nome)}</b>`, 3000, true); }
    });
  }
  function agganciaUI() {
    if (typeof UI === "undefined" || UI._veneto) return; UI._veneto = true;
    const b0 = UI.briefing, p0 = UI.piano, e0 = UI.esecuzione;
    UI.briefing = function () { const r = b0.apply(this, arguments); try { if (attiva()) { const m = document.querySelector("#left-content .card.missione"); if (m) { m.insertAdjacentHTML("afterend", cardRotte()); legaRotte(); } } } catch (e) { console.warn(e); } return r; };
    UI.piano = function () {
      if (!attiva()) return p0.apply(this, arguments);
      const lc = document.getElementById("left-content"); if (!lc) return p0.apply(this, arguments);
      lc.innerHTML = `<div class="step-hint"><b>FASE 2 – PIANO.</b> La coppia QRA non segue un piano di volo: decolla su allarme. Qui si sceglie da dove arriva l'Airbus, cioè la geometria dell'intercettazione.</div>${cardRotte()}
        <div class="card"><h3>Sequenza della QRA</h3><ol class="clean"><li>09:01 COMLOSS dichiarato da Padova</li><li>09:02 allarme e SCRAMBLE a Istrana (prontezza ${PRONTEZZA_S / 60} min)</li><li>Intercettazione e conversione in coda all'Airbus</li><li>Identificazione visiva dal lato sinistro (circa un minuto)</li><li>Scorta fino a 4 NM dalla soglia 04R, poi rientro a Istrana</li></ol></div>
        <button class="btn primary big" onclick="APP.vaiFase('esecuzione')">Vai alla FASE 3 – ESECUZIONE →</button>`;
      document.getElementById("left") && document.getElementById("left").classList.remove("wide"); legaRotte(); return undefined;
    };
    UI.esecuzione = function () { const r = e0.apply(this, arguments); try { if (attiva()) {
      const h = document.querySelector("#left-content .step-hint"); if (h) h.innerHTML = `<b>FASE 3 – ESECUZIONE.</b> Premi <b>▶</b> in basso. Alle 09:01 il ${esc(CIVILE.cs)} perde il contatto radio, alle 09:02 suona l'allarme: segui scramble, intercettazione, identificazione e scorta (rotta ${esc(rotta(APP.sc.veneto.rotta).nome)}, atterraggio previsto ${esc(APP.sc.veneto.atterraggioPrevisto)}).`;
    } } catch (e) { console.warn(e); } return r; };
  }

  /* ---------- mappa tattica ---------- */
  const MAP = { mappa: null, statico: null, dinamico: null, marker: null, scia: null, rottaDisegnata: null };
  const SVG_AIRBUS = '<svg viewBox="-20 -20 40 40" width="34" height="34"><path d="M0,-17 C1.6,-17 2,-14 2,-11 L2,-3 L16,5 L16,8 L2,3.5 L1.6,11 L6,15 L6,17 L0,15.5 L-6,17 L-6,15 L-1.6,11 L-2,3.5 L-16,8 L-16,5 L-2,-3 L-2,-11 C-2,-14 -1.6,-17 0,-17 Z" fill="#ffffff" stroke="#16324f" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  function pistaPoligono(p) {
    const a = { lat: p.a[0], lon: p.a[1] }, b = { lat: p.b[0], lon: p.b[1] }, h = brg(a, b), w = p.larghezza / 2 + 6;
    return [destM(a, h - 90, w), destM(b, h - 90, w), destM(b, h + 90, w), destM(a, h + 90, w)].map(q => [q.lat, q.lon]);
  }
  function disegnaStatico() {
    if (typeof MAPPA === "undefined" || typeof L === "undefined" || !MAPPA.map) return;
    const lm = MAPPA.map;
    if (MAP.mappa !== lm) { MAP.mappa = lm; MAP.statico = L.layerGroup().addTo(lm); MAP.dinamico = L.layerGroup().addTo(lm); MAP.marker = null; MAP.scia = null; }
    MAP.statico.clearLayers(); MAP.dinamico.clearLayers(); MAP.marker = null; MAP.scia = null;
    if (!APP.sc || !APP.sc.veneto) return;
    const sel = APP.sc.veneto.rotta;
    // rotte: le altre tenui, quella scelta piena con i punti
    ROTTE.forEach(r => { const P = profilo(r.id); const pts = P.S.filter((c, i) => i % 6 === 0 || i === P.S.length - 1).map(c => { const q = ll(c.x, c.y); return [q.lat, q.lon]; });
      L.polyline(pts, { color: r.id === sel ? "#ffb347" : "#c9d6e3", weight: r.id === sel ? 3 : 1.5, opacity: r.id === sel ? 0.95 : 0.35, dashArray: r.id === sel ? null : "6 8", interactive: false }).addTo(MAP.statico);
      if (r.id === sel) r.punti.forEach(w => { L.circleMarker([w.lat, w.lon], { radius: 3, color: "#ffb347", weight: 2, fillOpacity: 1, interactive: false }).addTo(MAP.statico);
        L.marker([w.lat, w.lon], { icon: L.divIcon({ className: "", html: `<span style="font:700 11px system-ui;color:#ffe2b8;text-shadow:0 1px 3px #000;white-space:nowrap">${esc(w.nome)} · ${w.alt >= 10000 ? "FL" + Math.round(w.alt / 100) : w.alt + " ft"}</span>`, iconSize: [140, 14], iconAnchor: [-6, 7] }), interactive: false }).addTo(MAP.statico); });
    });
    // finale ILS 04R, IF e FAF, limite VID a 20 NM
    const fin = [suFinale(15), THR].map(q => [q.lat, q.lon]);
    L.polyline(fin, { color: "#7dffb0", weight: 2, dashArray: "10 6", interactive: false }).addTo(MAP.statico);
    [[15, "IF 15 NM · 4000 ft"], [9.4, "FAF · 3000 ft"]].forEach(([d, t]) => { const q = suFinale(d); L.circleMarker([q.lat, q.lon], { radius: 4, color: "#7dffb0", weight: 2, fillOpacity: 1 }).bindTooltip(t).addTo(MAP.statico); });
    L.circle([THR.lat, THR.lon], { radius: 20 * NM, color: "#ff9b7a", weight: 1.5, dashArray: "4 8", fill: false, interactive: false }).addTo(MAP.statico);
    L.marker(destM(THR, 205, 20 * NM), { icon: L.divIcon({ className: "", html: '<span style="font:700 11px system-ui;color:#ffc2ad;text-shadow:0 1px 3px #000;white-space:nowrap">20 NM · limite VID</span>', iconSize: [120, 14] }), interactive: false }).addTo(MAP.statico);
    // piste di Tessera, Istrana e Treviso
    Object.values(PISTE).forEach(p => L.polygon(pistaPoligono(p), { color: "#f4f6f8", weight: 1, fillColor: "#3b4249", fillOpacity: 0.9 }).bindTooltip(`${p.aeroporto} · pista ${p.nomi.join("/")}`).addTo(MAP.statico));
  }
  function aggiornaDinamico() {
    if (!MAP.dinamico || typeof APP === "undefined" || !APP.engine || !APP.sc.veneto) return;
    const eng = APP.engine, V = eng.veneto, c = civile(APP.sc, eng.t);
    if (c.fermo && eng.t > (V ? V.t0 + V.P.durata + 240 : Infinity)) { if (MAP.marker) { MAP.dinamico.removeLayer(MAP.marker); MAP.marker = null; } return; }
    const stato = !V ? "" : V.toccata != null ? "ATTERRATO" : V.vid ? "IDENTIFICATO · in contatto" : V.comloss ? "COMLOSS" : "in contatto";
    const col = V && V.toccata != null ? "#9fb3c8" : V && V.vid ? "#7dffb0" : V && V.comloss ? "#ffb347" : "#ffffff";
    const testo = `${CIVILE.cs} · ${c.fermo || c.aTerra ? "a terra" : c.alt >= 10000 ? "FL" + Math.round(c.alt / 100) : Math.round(c.alt) + " ft"} · ${Math.round(c.kt)} kt`;
    if (!MAP.marker) {
      const html = `<div class="veneto-ico" style="width:34px;height:34px">${SVG_AIRBUS}</div><div class="veneto-lbl" style="position:absolute;left:34px;top:4px;white-space:nowrap;font:700 11px system-ui,sans-serif;color:#0b1220;background:#ffb347;padding:1px 6px;border-radius:4px"></div>`;
      MAP.marker = L.marker([c.lat, c.lon], { icon: L.divIcon({ className: "sym-civile", html, iconSize: [34, 34], iconAnchor: [17, 17] }), zIndexOffset: 950 }).addTo(MAP.dinamico);
      MAP.marker.on("click", () => { if (typeof MONDO3D !== "undefined" && !MONDO3D.attiva) { try { MONDO3D.apri(CIV_ID, { cam: "insegui" }); } catch (e) { console.warn(e); } } });
      MAP.scia = L.polyline([], { color: "#ffffff", weight: 2, opacity: 0.6, dashArray: "3 5", interactive: false }).addTo(MAP.dinamico);
    }
    MAP.marker.setLatLng([c.lat, c.lon]);
    const el = MAP.marker.getElement();
    if (el) { const i = el.querySelector(".veneto-ico"); if (i) i.style.transform = `rotate(${Math.round(c.hdg)}deg)`; const l = el.querySelector(".veneto-lbl"); if (l) { l.textContent = testo; l.style.background = col; } }
    const tip = `<b>${CIVILE.cs}</b> – ${CIVILE.tipo} · ${CIVILE.compagnia}<br>${stato || c.fase} · ${c.fase}<br>HDG ${Math.round(c.hdg)}° · ${Math.round(c.kt)} kt · ${Math.round(c.alt)} ft<br>Tocca per seguirlo nel Mondo 3D`;
    if (MAP.marker.getTooltip()) MAP.marker.setTooltipContent(tip); else MAP.marker.bindTooltip(tip, { direction: "right", offset: [20, 0] });
    const ll2 = []; for (let k = 20; k >= 0; k--) { const q = civile(APP.sc, eng.t - k * 12); if (q.tau > 0) ll2.push([q.lat, q.lon]); }
    MAP.scia.setLatLngs(ll2);
  }
  function agganciaMappa() {
    if (typeof MAPPA === "undefined" || MAPPA._veneto) return; MAPPA._veneto = true;
    const r0 = MAPPA.reDraw, a0 = MAPPA.aggiornaFlights;
    MAPPA.reDraw = function () { const r = r0.apply(this, arguments); try { disegnaStatico(); } catch (e) { console.warn("Veneto mappa", e); } return r; };
    MAPPA.aggiornaFlights = function () { const r = a0.apply(this, arguments); try { if (!MAP.statico && APP.sc && APP.sc.veneto) disegnaStatico(); aggiornaDinamico(); } catch (e) { console.warn("Veneto mappa", e); } return r; };
  }

  /* ---------- 3D: piste con segnaletica e luci, condivise da Mondo 3D e cinematiche ---------- */
  const texCache = {};
  function tela(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function texDa(c, rip) { const t = new THREE.CanvasTexture(c); if (rip) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } if (THREE.sRGBEncoding !== undefined && t.encoding !== undefined) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t; }
  // fascia asfaltata ripetuta: bordi bianchi e tratteggio centrale (30 m di tratto, 20 m di vuoto)
  function texAsfalto(larg) {
    const k = "asf" + larg; if (texCache[k]) return texCache[k];
    const W = 256, H = 256, c = tela(W, H), g = c.getContext("2d");
    g.fillStyle = "#3a3f44"; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { const v = 52 + Math.random() * 18; g.fillStyle = `rgba(${v},${v + 2},${v + 4},0.5)`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    g.fillStyle = "rgba(20,20,22,0.35)"; g.fillRect(W * 0.38, 0, W * 0.24, H);   // gomma al centro
    const px = W / larg; g.fillStyle = "#e9ecef"; g.fillRect(px * 0.8, 0, px * 0.9, H); g.fillRect(W - px * 1.7, 0, px * 0.9, H);
    g.fillRect(W / 2 - px * 0.45, 0, px * 0.9, H * 0.6);
    return (texCache[k] = texDa(c, true));
  }
  function texScritta(testo, w, h) {
    const k = "scr" + testo + w; if (texCache[k]) return texCache[k];
    const c = tela(w, h), g = c.getContext("2d"); g.clearRect(0, 0, w, h); g.fillStyle = "#eef1f3"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `bold ${Math.round(h * 0.9)}px Arial`; g.save(); g.translate(w / 2, h / 2); g.scale(1, 1.6); g.fillText(testo, 0, 2); g.restore();
    return (texCache[k] = texDa(c));
  }
  function puntoLuce() {
    if (texCache.luce) return texCache.luce; const c = tela(64, 64), g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 1, 32, 32, 31);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.75)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (texCache.luce = new THREE.CanvasTexture(c));
  }
  /* Pista nel suo riferimento: origine a metà pista, asse +Z verso la testata "b", larghezza su X. */
  function pista(p, opt) {
    opt = opt || {}; const a = { lat: p.a[0], lon: p.a[1] }, b = { lat: p.b[0], lon: p.b[1] }, L = distM(a, b), Wd = p.larghezza;
    const G = new THREE.Group(); G.userData = { lung: L, larg: Wd, hdg: brg(a, b) };
    const piatto = (w, l, mat, x, z, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat); m.rotation.x = -Math.PI / 2; m.position.set(x || 0, y || 0, z || 0); m.renderOrder = 2; G.add(m); return m; };
    const pof = (m, f) => { m.polygonOffset = true; m.polygonOffsetFactor = f; m.polygonOffsetUnits = f; return m; };
    piatto(Wd + 12, L + 120, pof(new THREE.MeshStandardMaterial({ color: new THREE.Color(0x4d524f).convertSRGBToLinear(), roughness: 0.95 }), -1), 0, 0, 0.05);   // banchine
    const tAsf = texAsfalto(Wd).clone(); tAsf.needsUpdate = true; tAsf.repeat.set(1, L / 50);
    piatto(Wd, L, pof(new THREE.MeshStandardMaterial({ map: tAsf, roughness: 0.9 }), -2), 0, 0, 0.1);
    const bianco = pof(new THREE.MeshBasicMaterial({ color: 0xeef1f3 }), -3);
    [[-1, p.soglia_a || 0, p.nomi[0]], [1, p.soglia_b || 0, p.nomi[1]]].forEach(([s, spost, nome]) => {
      const zT = -s * (L / 2 - 6 - spost);   // soglia (eventualmente spostata) di questa testata
      const n = Wd >= 45 ? 16 : 12, bw = 1.8, gap = (Wd - 6 - n * bw) / (n - 1);
      for (let i = 0; i < n; i++) { const x = -Wd / 2 + 3 + bw / 2 + i * (bw + gap); if (Math.abs(x) < 1.6) continue; piatto(bw, 30, bianco, x, zT + s * 15 * 1, 0.13); }   // "piano keys"
      const sc = piatto(Math.min(18, Wd * 0.42), 9, pof(new THREE.MeshBasicMaterial({ map: texScritta(nome, 256, 96), transparent: true }), -3), 0, zT + s * 48, 0.14);
      sc.rotation.z = s > 0 ? 0 : Math.PI;   // si legge arrivando da quella testata
      piatto(10, 45, bianco, -Wd / 2 + 9, zT + s * 340, 0.13); piatto(10, 45, bianco, Wd / 2 - 9, zT + s * 340, 0.13);   // punto di mira
      [150, 450, 600, 750, 900].forEach(dz => [-1, 1].forEach(lx => piatto(3, 22, bianco, lx * (Wd / 2 - 8), zT + s * dz, 0.13)));   // zona di contatto
      if (spost > 30) for (let q = 20; q < spost - 10; q += 30) piatto(1.2, 12, bianco, 0, -s * (L / 2 - q), 0.13);   // frecce della soglia spostata
    });
    if (opt.luci !== false) {
      const pts = [], col = [], add = (x, z, c, y) => { pts.push(x, y || 0.7, z); col.push(c.r, c.g, c.b); };
      const Wl = new THREE.Color(0xfff6e0), Gr = new THREE.Color(0x3dff7a), Rd = new THREE.Color(0xff3b30), Am = new THREE.Color(0xffc040);
      for (let z = -L / 2; z <= L / 2; z += 60) { add(-Wd / 2 - 1.5, z, Math.abs(z) > L / 2 - 600 ? Am : Wl); add(Wd / 2 + 1.5, z, Math.abs(z) > L / 2 - 600 ? Am : Wl); }
      for (let z = -L / 2 + 30; z < L / 2; z += 30) add(0, z, Wl, 0.3);
      for (let x = -Wd / 2; x <= Wd / 2; x += 3) { add(x, -L / 2 + 2, Gr, 0.4); add(x, L / 2 - 2, Rd, 0.4); }
      if (p.ils) {   // sentiero luminoso d'avvicinamento (900 m, barrette e croce a 300 m) e PAPI a sinistra
        for (let d = 30; d <= 900; d += 30) for (let x = -2; x <= 2; x += 1) add(x * 1.1, -L / 2 - d, Wl, 1 + d * 0.004);
        for (let x = -15; x <= 15; x += 1.5) add(x, -L / 2 - 300, Wl, 2.3);
        [0, 1, 2, 3].forEach(i => add(-Wd / 2 - 15 - i * 9, -L / 2 + 340, i < 2 ? Rd : Wl, 0.9));
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      const luci = new THREE.Points(g, new THREE.PointsMaterial({ size: opt.dimLuci || 3, sizeAttenuation: false, vertexColors: true, map: puntoLuce(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      luci.frustumCulled = false; luci.renderOrder = 3; G.add(luci); G.userData.luci = luci;
    }
    return G;
  }
  // campanile di San Marco (98,6 m): fusto in mattoni, cella campanaria, dado e cuspide
  function campanile() {
    const G = new THREE.Group(), m = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
    const box = (w, h, d, c, y) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(c)); o.position.y = y + h / 2; G.add(o); return o; };
    box(12.8, 50, 12.8, 0x9a5a3e, 0); box(12.4, 10, 12.4, 0xe8e2d4, 50); box(12.6, 1.4, 12.6, 0xd9d2c3, 60); box(11.6, 9, 11.6, 0x9a5a3e, 61.4);
    const cusp = new THREE.Mesh(new THREE.ConeGeometry(8.2, 24, 4), m(0x6f8f7c)); cusp.rotation.y = Math.PI / 4; cusp.position.y = 70.4 + 12; G.add(cusp);
    const ang = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8b04a, metalness: 0.8, roughness: 0.3 })); ang.position.y = 96.5; G.add(ang);
    return G;
  }
  // carrello d'atterraggio procedurale: anteriore e due carrelli principali a 4 ruote (misure A330, metri)
  function carrelloA330() {
    const G = new THREE.Group(), gomma = new THREE.MeshStandardMaterial({ color: 0x16191c, roughness: 0.95 }), met = new THREE.MeshStandardMaterial({ color: 0xa9b2b8, metalness: 0.6, roughness: 0.4 });
    const ruota = (x, y, z, r) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.42, 16), gomma); w.rotation.z = Math.PI / 2; w.position.set(x, y, z); G.add(w); };
    const gamba = (x, y0, y1, z, r) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y0 - y1, 10), met); c.position.set(x, (y0 + y1) / 2, z); G.add(c); };
    gamba(0, -2.4, -4.9, 19.5, 0.16); ruota(0.32, -5.0, 19.5, 0.56); ruota(-0.32, -5.0, 19.5, 0.56);
    [5.35, -5.35].forEach(x => { gamba(x, -2.6, -4.7, -1.4, 0.24); [[-0.45, -0.35], [-0.45, 0.85], [0.45, -0.35], [0.45, 0.85]].forEach(([dx, dz]) => ruota(x + dx, -5.0, -1.4 + dz * 1.6 - 0.4, 0.62));
      const bog = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 3.0), met); bog.position.set(x, -4.9, -1.6); G.add(bog); });
    G.userData.terra = -5.62;   // quota del suolo nel riferimento del modello
    return G;
  }
  function modelloAirbus() {
    if (typeof VISTA3D === "undefined" || !VISTA3D.modelloProcedurale) return Promise.resolve(null);
    return VISTA3D.modelloProcedurale("kc30", undefined, { tipoId: "A330", numero: CIVILE.marche }).then(m => {
      const gear = carrelloA330(); gear.visible = false; const inner = m.children[0] || m; inner.add(gear); m.userData.carrello = gear;
      // fari d'atterraggio sulle radici alari
      const tl = puntoLuce(), fari = new THREE.Group();
      [[2.6, -2.2, 6.2], [-2.6, -2.2, 6.2]].forEach(([x, y, z]) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tl, color: 0xfff4d8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.set(x, y, z); s.scale.set(3.2, 3.2, 1); fari.add(s); });
      fari.visible = false; inner.add(fari); m.userData.fari = fari; return m;
    });
  }

  /* ---------- Mondo 3D: chiamato da mondo3d.js (patch) con le sue funzioni interne ---------- */
  function mondo3d(api) {
    if (typeof APP === "undefined" || !APP.sc || !APP.sc.veneto) return null;
    const { scene, st, toXZ, elev, label, TERRA, lonLatToTile, camera } = api, sc = APP.sc, piccolo = window.innerWidth < 900;
    const oggetti = [], rimuovi = [];
    // via le sagome generiche delle basi (parallelepipedo grigio da 2,4 km): ci sono le piste vere
    (st.statici || []).forEach(o => { const g = o.geometry, q = g && g.parameters; if (q && ((q.width === 2400 && q.depth === 60) || (q.radiusTop === 300 && q.height === 20))) { o.visible = false; rimuovi.push(o); } });
    const etichetteBasi = (st.statici || []).filter(o => o.isSprite && o.userData && o.userData.h === 400);   // «LIPZ», «LIPS»: solo da lontano
    // posizione coerente con le immagini e le quote del terreno (proiezione delle tile, non lat/lon lineari)
    const C = 40075016.686 * Math.cos(rad(TERRA.lat0));
    const merc = (lat, lon) => { const x = (lon + 180) / 360, lr = rad(lat), y = (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2; return { u: x, v: y }; };
    const m0 = merc(TERRA.lat0, TERRA.lon0), aMondo = (lat, lon) => { const q = merc(lat, lon); return { x: (q.u - m0.u) * C, z: (q.v - m0.v) * C }; };
    const quota = (x, z) => Math.max(0, elev(x, z));
    // con il terreno HD in streaming (terrain_mobile.js) le tile z15 stanno 1,5 m sopra la quota misurata: si posa tutto sopra di esse
    const suolo = (x, z) => { const hd = st.hdTerrain && st.hdTerrain.heightAt ? st.hdTerrain.heightAt(x, z) : NaN; return Number.isFinite(hd) ? Math.max(quota(x, z), hd + 1.5) : quota(x, z); };
    // piste
    const piste = [];
    Object.values(PISTE).forEach(p => {
      const g = pista(p, { dimLuci: piccolo ? 2 : 3 }), A = aMondo(p.a[0], p.a[1]), B = aMondo(p.b[0], p.b[1]);
      g.position.set((A.x + B.x) / 2, 0, (A.z + B.z) / 2); g.rotation.y = Math.atan2(B.x - A.x, B.z - A.z); scene.add(g); oggetti.push(g); piste.push(g);
    });
    // immagini satellitari ad alta risoluzione (z15, ~3,4 m per pixel) su Tessera, Venezia e Istrana
    const insetti = [];
    if (typeof VISTA3D !== "undefined" && VISTA3D.tileUrl && !window.CENTURION_TERRAIN) {   // il terreno HD in streaming le carica già attorno alla telecamera
      const zona = (la0, lo0, la1, lo1, z) => { const n = 2 ** z; const t0 = lonLatToTile(lo0, la1, z), t1 = lonLatToTile(lo1, la0, z); const out = []; for (let x = Math.floor(t0.x); x <= Math.floor(t1.x); x++) for (let y = Math.floor(t0.y); y <= Math.floor(t1.y); y++) out.push({ x, y, z, n }); return out; };
      const zone = [[45.478, 12.300, 45.535, 12.395]].concat(piccolo ? [] : [[45.425, 12.300, 45.447, 12.365], [45.672, 12.050, 45.697, 12.125]]);
      const loader = new THREE.TextureLoader(); loader.setCrossOrigin("anonymous");
      zone.forEach(([a, b, c, d]) => zona(a, b, c, d, 15).forEach(t => {
        const u0 = t.x / t.n, v0 = t.y / t.n, w = C / t.n, x = (u0 - m0.u) * C + w / 2, z = (v0 - m0.v) * C + w / 2;
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, transparent: true, opacity: 0 });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w), mat); mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 0.6, z); mesh.renderOrder = 1; scene.add(mesh); oggetti.push(mesh); insetti.push(mesh);
        loader.load(VISTA3D.tileUrl("sat", t.z, t.x, t.y), tex => { if (THREE.sRGBEncoding !== undefined && tex.encoding !== undefined) tex.encoding = THREE.sRGBEncoding; mat.map = tex; mat.opacity = 1; mat.transparent = false; mat.needsUpdate = true; }, undefined, () => { mesh.visible = false; });
      }));
    }
    // campanile di San Marco
    const camp = campanile(), cp = aMondo(CAMPANILE.lat, CAMPANILE.lon); camp.position.set(cp.x, 0, cp.z); scene.add(camp); oggetti.push(camp);
    // l'Airbus
    const g = new THREE.Group(), holder = new THREE.Group(); g.add(holder); g.rotation.order = "YXZ"; scene.add(g); oggetti.push(g);
    holder.add(VISTA3D.jetFallback ? VISTA3D.jetFallback(0xdfe5ea) : new THREE.Group()); holder.scale.setScalar(3);
    let mdl = null;
    modelloAirbus().then(m => { if (!m || !st || !g.parent) return; while (holder.children.length) holder.remove(holder.children[0]); holder.scale.setScalar(1); holder.add(m); mdl = m; }).catch(() => {});
    const lab = label(CIVILE.cs, "#ffe0b0", 60); lab.position.y = 60; g.add(lab);
    let gT = null, selPrec = null, distPrec = null, disp = null, tPos = 0;
    const api3d = {
      lista: () => [{ f: { id: CIV_ID, nome: CIVILE.cs, tipo: "Airbus A330", lato: "CIVILE", gruppo: "TRAFFICO CIVILE" }, i: 0, aux: true }],
      disp: sel => sel === CIV_ID ? disp : null,
      tick(dt, now) {
        const eng = APP.engine; if (!eng) return;
        const F = st.fixed, tk = eng.tick_sec || 10, rate = F ? F.speed : (APP.playing ? (APP.speed || 1) : 0);
        gT = (gT == null || Math.abs(gT - eng.t) > 2 * tk + 5) ? eng.t : Math.min(eng.t + tk, Math.max(eng.t - tk, gT + dt * rate));
        const c = civile(sc, gT), q = toXZ(c.lat, c.lon), terra = c.aTerra || c.alt < 400 ? suolo(q.x, q.z) + 0.9 : quota(q.x, q.z);
        const gear = mdl && mdl.userData.carrello, alto = (gear ? -gear.userData.terra : 5.6);
        const y = c.aTerra || c.fermo ? terra + alto : Math.max(terra + alto, c.alt * FT);
        g.position.set(q.x, y, q.z);
        g.rotation.set(-rad(c.pitch), Math.PI - rad(c.hdg), rad(c.bank));
        if (gear) gear.visible = c.alt < 2600 || c.aTerra; if (mdl && mdl.userData.fari) mdl.userData.fari.visible = c.alt < 9000 && !c.fermo;
        if (mdl && mdl.userData.anim) { tPos += dt; try { mdl.userData.anim({ t: tPos, afterburner: 0 }); } catch (e) {} }
        const dist = camera.position.distanceTo(g.position), vicina = st.cam === "cockpit" || st.cam === "insegui";
        holder.scale.setScalar(mdl ? (st.scalaGrande && !vicina ? Math.max(1, dist * 0.0096 / 58.8 * 4) : 1) : 3);
        g.visible = !(st.cam === "cockpit" && st.sel === CIV_ID) && !(c.fermo && eng.t > inizio(sc) + c.P.durata + 240);
        const ls = Math.max(st.cam === "insegui" ? 6 : 60, dist * 0.028); lab.scale.set(ls * 4, ls, 1); lab.position.y = 34 + ls * 0.6; lab.visible = !(vicina && st.sel === CIV_ID);
        // punto seguito dalle telecamere: 20 m avanti al baricentro (in cabina la vista cade sul cockpit)
        const h = rad(c.hdg); disp = { x: q.x + Math.sin(h) * 20, y: y + 0.4, z: q.z - Math.cos(h) * 20, hdg: c.hdg, bank: c.bank };
        // chase più lontana sull'Airbus (59 m), ripristinata quando si cambia velivolo
        if (st.sel !== selPrec) { if (st.sel === CIV_ID) { distPrec = st.chase.dist; st.chase.dist = 140; st.chase.pitch = 0.12; } else if (selPrec === CIV_ID && distPrec) { st.chase.dist = distPrec; distPrec = null; } selPrec = st.sel; }
        piste.forEach(p => { if (!p.userData.y || st.frame % 60 === 0) {   // sopra le immagini ad alta risoluzione: testate e centro, si prende la quota più alta
          const L = p.userData.lung / 2, s = Math.sin(p.rotation.y), c = Math.cos(p.rotation.y), x = p.position.x, z = p.position.z;
          const y0 = Math.max(suolo(x, z), suolo(x + s * L, z + c * L), suolo(x - s * L, z - c * L)) + 0.9; p.position.y = y0; p.userData.y = y0; } });
        if (st.frame % 60 === 0) { camp.position.y = suolo(camp.position.x, camp.position.z); insetti.forEach(m => { m.position.y = quota(m.position.x, m.position.z) + 0.6; }); }
        etichetteBasi.forEach(l => { l.visible = camera.position.distanceTo(l.position) > 9000; });
      },
      dispose() { oggetti.forEach(o => { scene && scene.remove(o); o.traverse && o.traverse(x => { if (x.geometry && !x.isSprite) x.geometry.dispose(); }); }); rimuovi.concat(etichetteBasi).forEach(o => { o.visible = true; }); }
    };
    return api3d;
  }

  if (typeof window !== "undefined") {
    const avvio = () => { try { registra(); agganciaUI(); agganciaMappa(); } catch (e) { console.warn("Veneto", e); } };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(avvio, 0)); else avvio();
  }
  return { get ID() { return ID; }, ROTTE, PISTE, LIPZ, LIPS, CIVILE, QRA, THR, QFU, CAMPANILE, CIV_ID, NM, FT, KT,
    profilo, civile, rotta, rottaScelta, attiva, pista, campanile, carrelloA330, modelloAirbus, mondo3d, destM, distM, brg, puntoLuce,
    _qra: { PRONTEZZA_S, VID_S, OFF_VID, OFF_SCORTA }, _applica: applica };
})();
