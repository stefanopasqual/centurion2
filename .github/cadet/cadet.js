/* =====================================================================
   CENTURION CADET – "La tua prima missione"
   Modalità guidata per civili: briefing narrato, tre decisioni semplici,
   missione 3D che si ferma nei momenti decisivi, debrief con le alternative.
   Il motore (Engine), gli aerei e le regole restano quelli del simulatore:
   cambia solo il modo di interagire. Richiede cadet_core.js.
   ===================================================================== */
const CADET = (() => {
  const C = CADET_CORE;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const S = { scelte: { percorso: null, protezione: null, forza: null }, difesa: null, voce: true, attiva: false, backup: null, prima: null, eng: null, visti: new Set(), coda: [], cardAperta: false, fine: false, passo: 0, splash: [] };
  let root = null;

  /* ---------------- testi ---------------- */
  const DECISIONI = [
    { chiave: "percorso", domanda: "Come vuoi raggiungere l'obiettivo?", contesto: "Hai poco tempo. Il percorso più breve attraversa una zona sorvegliata.",
      pro: { diretto: ["Si arriva prima: più margine sulla scadenza delle 10:30"], esterno: ["Si evita la zona sorvegliata"], divisi: ["Se un gruppo viene fermato, l'altro può arrivare"] },
      contro: { diretto: ["Senza protezione adatta, la zona sorvegliata abbatte chi la attraversa"], esterno: ["Circa 4 minuti di volo in più", "Non si sa se il nemico sorveglia anche il nord"], divisi: ["Ogni gruppo è più piccolo e più vulnerabile", "La protezione non può stare con tutti e due"] },
      istruttore: ["Che cosa sai con certezza della zona sorvegliata? E che cosa non sai dei caccia nemici?", "Quanto vale il tempo, con la scadenza alle 10:30?", "Se dividi le forze, chi protegge chi?"] },
    { chiave: "protezione", domanda: "Come proteggi i bombardieri?", contesto: "Le minacce possibili sono due: i missili della zona sorvegliata e i caccia nemici. Ogni protezione ne ferma una sola.",
      pro: { scorta: ["Ottima contro i caccia nemici", "Si parte subito alle 09:10"], disturbo: ["Rende innocua la zona sorvegliata", "Si parte subito alle 09:10"], entrambi: ["Protetti contro entrambe le minacce"] },
      contro: { scorta: ["Non può nulla contro i missili da terra: anche la scorta deve evitare la zona"], disturbo: ["I bombardieri restano soli contro i caccia nemici"], entrambi: ["Si parte alle 09:40: meno margine sulla scadenza", "Il nemico ha mezz'ora in più per organizzarsi"] },
      istruttore: ["Quale minaccia incontrerà la rotta che hai scelto?", "Una protezione che non corrisponde alla minaccia serve a qualcosa?", "Quanto ti costa mezz'ora di ritardo, rispetto a quello che guadagni?"] },
    { chiave: "forza", domanda: "Quanti bombardieri rischi?", contesto: "Per interrompere il ponte servono 8 bombe. Ogni bombardiere ne porta 4.",
      pro: { tutti: ["Anche perdendone due, le bombe bastano"], riserva: ["Se il primo gruppo riesce, la riserva non rischia nulla", "C'è un piano B"], pochi: ["Pochi aerei esposti"] },
      contro: { tutti: ["Più aerei esposti al pericolo"], riserva: ["Se serve, la riserva parte tardi: rischia di sforare le 10:30"], pochi: ["Basta perdere un aereo per non riuscire"] },
      istruttore: ["Qual è la tua priorità: il ponte in tempo o riportare tutti a casa?", "Quanti aerei puoi permetterti di perdere?", "Se qualcosa va storto, hai un piano B?"] }
  ];
  const GLOSSARIO = [
    ["Zona sorvegliata", "Area difesa da una batteria di missili terra-aria (un SA-10). Il suo radar vede gli aerei e guida i missili."],
    ["Disturbatore", "Aereo da guerra elettronica (EA-18G Growler): confonde i radar e può colpirli con missili anti-radar."],
    ["Scorta", "Caccia (F-22 Raptor) che accompagnano i bombardieri e affrontano gli aerei nemici."],
    ["Bombardieri", "F-15E Strike Eagle: portano le bombe guidate, ma hanno poche armi per difendersi dagli altri aerei."],
    ["Caccia nemici", "Su-35 Flanker: decollano dall'aeroporto di Redding per intercettare chi entra nel loro territorio."],
    ["Rifornimento in volo", "Prima di entrare in territorio nemico gli aerei fanno il pieno da un aereo cisterna, in volo."]
  ];
  const nomeScelta = (k, id) => (C.SCELTE[k].find(o => o.id === id) || {}).titolo || "";
  const NOMI = Object.assign({}, C.NOMI, { GRIZZLY: "Disturbatore", CENTURION: "Bombardieri di riserva", "IVAN 1": "Caccia nemici", TITAN: "Scorta", GLADIATOR: "Bombardieri", ROMA: "Bombardieri (gruppo nord)" });
  const nome = chi => NOMI[chi] || chi;
  // soggetto con articolo, per frasi corrette: "i bombardieri hanno…", "la scorta ha…"
  const ART = { GLADIATOR: ["i bombardieri", true], ROMA: ["i bombardieri del gruppo nord", true], RISERVA: ["i bombardieri di riserva", true], TITAN: ["la scorta", false], GROWLER: ["il disturbatore", false] };
  const sogg = (id, maiusc) => { const a = (ART[id] || [nome(id).toLowerCase(), true])[0]; return maiusc ? a[0].toUpperCase() + a.slice(1) : a; };
  const plur = id => (ART[id] || [null, true])[1];
  const verbo = (id, sing, pl) => plur(id) ? pl : sing;

  /* ---------------- voce ---------------- */
  function parla(testo) {
    try { if (!S.voce || !window.speechSynthesis) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(testo).replace(/<[^>]+>/g, " ")); u.lang = "it-IT"; u.rate = 1.0;
      const v = speechSynthesis.getVoices().find(x => /^it/i.test(x.lang)); if (v) u.voice = v; speechSynthesis.speak(u); } catch (e) {}
  }
  const zitto = () => { try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {} };

  /* ---------------- mappa schematica ---------------- */
  const B = { latN: 42.0, latS: 40.35, lonW: -124.6, lonE: -122.05 }, W = 600, H = Math.round(W * (B.latN - B.latS) / ((B.lonE - B.lonW) * Math.cos(41.2 * Math.PI / 180)));
  const px = p => [+((p.lon - B.lonW) / (B.lonE - B.lonW) * W).toFixed(1), +((B.latN - p.lat) / (B.latN - B.latS) * H).toFixed(1)];
  function mappa(o) {
    o = o || {}; const G = C.GEO_M, sc = SCENARIO_DEFAULT; const base = sc.basi.find(b => b.id === "TACCOLA"), red = sc.basi.find(b => b.id === "REDDING");
    const poli = (pts, col) => `<polygon points="${pts.map(q => px({ lat: q[0], lon: q[1] }).join(",")).join(" ")}" fill="${col}" />`;
    const naz = sc.mappa.nazioni;
    const rNm = nm => nm / 60 / (B.latN - B.latS) * H;
    const [bx, by] = px(base), [tx, ty] = px(G.target), [sx, sy] = px(G.sam), [rx, ry] = px(red);
    const rotta = gate => { const pts = [base, G.tanker, gate, G.target].map(px); return `<polyline points="${pts.map(q => q.join(",")).join(" ")}" fill="none" stroke="#5dade2" stroke-width="3" stroke-dasharray="9 6" stroke-linecap="round"/>`; };
    let rotte = "";
    if (o.percorso === "diretto" || o.percorso === "divisi") rotte += rotta(G.gateDiretto);
    if (o.percorso === "esterno" || o.percorso === "divisi") rotte += rotta(G.gateEsterno);
    const hl = k => o.evidenzia === k ? ' class="cd-pulse"' : "";
    const label = (x, y, t, col, anchor) => `<text x="${x}" y="${y}" fill="${col}" font-size="17" font-weight="700" text-anchor="${anchor || "middle"}" paint-order="stroke" stroke="#0b0f14" stroke-width="4">${esc(t)}</text>`;
    let prot = "";
    if (o.protezione === "scorta" || o.protezione === "entrambi") { const [ex, ey] = px({ lat: 40.80, lon: -122.78 }); prot += `<g>${label(ex, ey - 16, "🛡 scorta", "#9ccbff")}<circle cx="${ex}" cy="${ey}" r="7" fill="#2e86de"/></g>`; }
    if (o.protezione === "disturbo" || o.protezione === "entrambi") { const [jx, jy] = px({ lat: 40.86, lon: -123.45 }); prot += `<g>${label(jx, jy - 16, "⚡ disturbatore", "#f7dc6f")}<circle cx="${jx}" cy="${jy}" r="7" fill="#f1c40f"/></g>`; }
    return `<svg viewBox="0 0 ${W} ${H}" class="cd-map" role="img" aria-label="Mappa della missione">
      <rect width="${W}" height="${H}" fill="#0d1b2a"/>${poli(naz[1].poligono, "#123a5e")}${poli(naz[0].poligono, "#4a1d1d")}
      ${label(px({ lat: 40.55, lon: -124.05 })[0], px({ lat: 40.55, lon: -124.05 })[1], "territorio amico", "#7fb3e6")}${label(px({ lat: 41.75, lon: -122.6 })[0], px({ lat: 41.75, lon: -122.6 })[1], "territorio nemico", "#e6a0a0")}
      ${rotte}
      <g${hl("zona")}><circle cx="${sx}" cy="${sy}" r="${rNm(G.sam.raggio_nm)}" fill="rgba(231,76,60,.28)" stroke="#e74c3c" stroke-width="2"/>${label(sx, sy + rNm(G.sam.raggio_nm) + 20, "zona pericolosa", "#ff8a80")}</g>
      ${o.nemici ? `<g>${label(rx + 12, ry + 30, "caccia nemici: dove? quando?", "#ff8a80", "end")}<text x="${rx}" y="${ry + 7}" font-size="22" text-anchor="middle">❓</text></g>` : ""}
      ${prot}
      <g${hl("partenza")}><circle cx="${bx}" cy="${by}" r="9" fill="#2ecc71"/>${label(bx + 14, by + 6, "PARTENZA", "#7dffb0", "start")}</g>
      <g${hl("obiettivo")}><circle cx="${tx}" cy="${ty}" r="10" fill="#f1c40f" stroke="#fff" stroke-width="2"/>${label(tx, ty - 16, "OBIETTIVO · il ponte", "#f7dc6f")}</g>
    </svg>`;
  }

  /* ---------------- interfaccia ---------------- */
  function overlay() {
    if (root) return root;
    root = document.createElement("div"); root.id = "cadet"; document.body.appendChild(root); stile();
    return root;
  }
  function schermo(html, cls) { overlay(); root.className = "cd-schermo " + (cls || ""); root.innerHTML = `<div class="cd-box">${html}</div>`; root.scrollTop = 0; return root; }
  const testata = (sopra, titolo) => `<div class="cd-top"><div><div class="cd-kicker">${esc(sopra)}</div><h2>${titolo}</h2></div><div class="cd-top-az"><button class="cd-btn ghost" data-voce title="Voce narrante">${S.voce ? "🔊" : "🔇"}</button><button class="cd-btn ghost" data-esci title="Esci">✕</button></div></div>`;
  function aggancia(r) {
    r.querySelectorAll("[data-esci]").forEach(b => b.onclick = () => { if (!S.attiva || confirm("Vuoi uscire dalla missione Cadetto?")) chiudi(); });
    r.querySelectorAll("[data-voce]").forEach(b => b.onclick = () => { S.voce = !S.voce; b.textContent = S.voce ? "🔊" : "🔇"; if (!S.voce) zitto(); });
  }

  /* 0 · livelli */
  function apri() {
    S.attiva = false; zitto();
    const r = schermo(`${testata("CENTURION CADET", "La tua prima missione")}
      <p class="cd-lead">Impari a <b>decidere con informazioni incomplete</b>: priorità, rischi, conseguenze. Non serve conoscere il gergo militare.</p>
      <div class="cd-livelli">
        <div class="cd-livello on"><div class="cd-liv-tit">🎓 Cadetto</div><div class="cd-liv-sub">Missione 01 · Il corridoio · 20 minuti · completamente guidata</div><button class="cd-btn primary" data-inizia>Inizia</button></div>
        <div class="cd-livello on"><div class="cd-liv-tit">✈ Accademia di volo</div><div class="cd-liv-sub">12 lezioni di volo guidato e 2 missioni complete: volo, armi, attacco, difesa sul Typhoon, con teoria e debriefing</div><button class="cd-btn primary" data-accademia>Apri</button></div>
        <div class="cd-livello"><div class="cd-liv-tit">⭐ Comandante</div><div class="cd-liv-sub">La simulazione completa: due squadre, pianificazione libera</div><button class="cd-btn" data-comandante>Apri</button></div>
      </div>
      <p class="cd-nota">Fisica di volo, aerei, missili e conseguenze sono quelli del simulatore completo: cambia solo il modo di decidere.</p>`);
    aggancia(r);
    r.querySelector("[data-inizia]").onclick = () => { S.scelte = { percorso: null, protezione: null, forza: null }; briefing(0); };
    r.querySelector("[data-comandante]").onclick = chiudi;
    const acc = r.querySelector("[data-accademia]"); if (acc) acc.onclick = () => { chiudi(); if (typeof ACCADEMIA !== "undefined") ACCADEMIA.apri(); };
  }

  /* 1 · briefing narrato */
  const BRIEF = [
    { ev: "partenza", t: "Sei al comando di una piccola squadra di aerei. La vostra base è qui, sulla costa, in territorio amico." },
    { ev: "obiettivo", t: "L'obiettivo è il ponte di Whiskeytown. Alle 10:30 ci passeranno i rifornimenti nemici: va interrotto prima. Poi tutti devono tornare alla base." },
    { ev: "zona", nemici: true, t: "Il pericolo: una zona sorvegliata da missili terra-aria. Chi la attraversa senza protezione viene colpito. Il nemico ha anche due caccia, ma non sai dove e quando voleranno." },
    { ev: null, nemici: true, t: "Prenderai tre decisioni. Poi gli aerei eseguiranno il tuo piano, e la simulazione si fermerà nei momenti importanti per spiegarti cosa succede e perché. Non esiste la scelta perfetta: conta ragionare sulle conseguenze." }
  ];
  function briefing(i) {
    S.passo = i; const b = BRIEF[i];
    const r = schermo(`${testata("MISSIONE 01 — IL CORRIDOIO", "Briefing")}
      <div class="cd-split"><div class="cd-mapbox">${mappa({ evidenzia: b.ev, nemici: b.nemici })}</div>
      <div class="cd-side"><div class="cd-dots">${BRIEF.map((x, k) => `<span class="${k <= i ? "on" : ""}"></span>`).join("")}</div><p class="cd-narra">${esc(b.t)}</p>
      <div class="cd-az">${i > 0 ? `<button class="cd-btn" data-ind>Indietro</button>` : ""}<button class="cd-btn primary" data-av>${i < BRIEF.length - 1 ? "Avanti" : "Alle decisioni"}</button></div></div></div>`);
    aggancia(r); parla(b.t);
    r.querySelector("[data-av]").onclick = () => i < BRIEF.length - 1 ? briefing(i + 1) : decisione(0);
    const ind = r.querySelector("[data-ind]"); if (ind) ind.onclick = () => briefing(i - 1);
  }

  /* 2 · tre decisioni */
  function decisione(i) {
    const d = DECISIONI[i], opz = C.SCELTE[d.chiave], sel = S.scelte[d.chiave];
    const anteprima = Object.assign({}, S.scelte); const mapOpts = { percorso: anteprima.percorso, protezione: anteprima.protezione, nemici: true };
    const o = sel && opz.find(x => x.id === sel);
    const r = schermo(`${testata(`MISSIONE 01 — IL CORRIDOIO · Decisione ${i + 1} di 3`, esc(d.domanda))}
      <p class="cd-lead">${esc(d.contesto)}</p>
      <div class="cd-split"><div class="cd-side">
        <div class="cd-opz">${opz.map(x => `<button class="cd-op ${sel === x.id ? "sel" : ""}" data-op="${x.id}"><span class="cd-let">${x.lettera}</span><span><b>${esc(x.titolo)}</b><small>${esc(x.breve)}</small></span></button>`).join("")}</div>
        <div class="cd-cons">${o ? `<h4>Conseguenze da valutare</h4><p>${esc(o.dettaglio)}</p><div class="cd-pc"><div><b class="ok">A favore</b><ul>${(d.pro[o.id] || []).map(t => `<li>${esc(t)}</li>`).join("")}</ul></div><div><b class="ko">Contro</b><ul>${(d.contro[o.id] || []).map(t => `<li>${esc(t)}</li>`).join("")}</ul></div></div>` : `<p class="cd-muted">Scegli un'alternativa per vederne le conseguenze.</p>`}</div>
        <div class="cd-az"><button class="cd-btn" data-istr>🎓 Chiedi all'istruttore</button><span class="cd-sp"></span><button class="cd-btn" data-ind>Indietro</button><button class="cd-btn primary" data-conf ${sel ? "" : "disabled"}>Conferma la scelta</button></div>
        <div class="cd-istr hidden"><b>L'istruttore non ti dice cosa scegliere. Prova a rispondere a queste domande:</b><ul>${d.istruttore.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
          <details><summary>Le parole della missione</summary><dl>${GLOSSARIO.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></details></div>
      </div><div class="cd-mapbox">${mappa(mapOpts)}</div></div>`);
    aggancia(r); if (!sel) parla(`Decisione ${i + 1}. ${d.domanda} ${d.contesto}`);
    r.querySelectorAll("[data-op]").forEach(b => b.onclick = () => { S.scelte[d.chiave] = b.dataset.op; decisione(i); const x = opz.find(z => z.id === b.dataset.op); parla(`${x.titolo}. ${x.dettaglio}`); });
    r.querySelector("[data-istr]").onclick = () => { const p = r.querySelector(".cd-istr"); p.classList.toggle("hidden"); if (!p.classList.contains("hidden")) { parla(d.istruttore.join(" ")); p.scrollIntoView({ block: "nearest" }); } };
    r.querySelector("[data-ind]").onclick = () => i > 0 ? decisione(i - 1) : briefing(BRIEF.length - 1);
    r.querySelector("[data-conf]").onclick = () => i < DECISIONI.length - 1 ? decisione(i + 1) : riepilogo();
  }

  function riepilogo() {
    const sc = S.scelte;
    const r = schermo(`${testata("MISSIONE 01 — IL CORRIDOIO", "Il tuo piano")}
      <div class="cd-split"><div class="cd-side">
        ${DECISIONI.map((d, i) => `<div class="cd-rie"><span class="cd-let">${C.SCELTE[d.chiave].find(o => o.id === sc[d.chiave]).lettera}</span><div><small>${esc(d.domanda)}</small><b>${esc(nomeScelta(d.chiave, sc[d.chiave]))}</b></div><button class="cd-btn small" data-mod="${i}">Cambia</button></div>`).join("")}
        <p class="cd-lead">La difesa nemica ha già deciso cosa fare. <b>Tu non sai cosa.</b> Lo scoprirai durante la missione e nel debrief.</p>
        <div class="cd-az"><button class="cd-btn primary big" data-via>▶ Avvia la missione</button></div>
      </div><div class="cd-mapbox">${mappa({ percorso: sc.percorso, protezione: sc.protezione, nemici: true })}</div></div>`);
    aggancia(r); parla("Il tuo piano è pronto. La difesa nemica ha già deciso cosa fare, e tu non sai cosa. Avvia la missione quando vuoi.");
    r.querySelectorAll("[data-mod]").forEach(b => b.onclick = () => decisione(+b.dataset.mod));
    r.querySelector("[data-via]").onclick = avviaMissione;
  }

  /* 3 · missione 3D */
  function salvaStato() {
    if (S.prima) return;
    S.prima = { sc: JSON.parse(JSON.stringify(APP.sc)), ruolo: APP.ruolo, v3d: APP.vista3dAuto, speed: APP.speed };
    try { if (!(APP.sc.missione && APP.sc.missione.cadet)) localStorage.setItem("centurion_cadet_backup", JSON.stringify(APP.sc)); } catch (e) {}
  }
  function ripristinaStato() {
    const p = S.prima; S.prima = null; if (!p) return;
    try { APP.play(false); if (typeof MONDO3D !== "undefined" && MONDO3D.attiva) MONDO3D.chiudi(); } catch (e) {}
    APP.sc = p.sc; APP.vista3dAuto = p.v3d; APP.ricostruisci(); APP.setRuolo(p.ruolo); APP.setSpeed(p.speed);
    try { localStorage.removeItem("centurion_cadet_backup"); } catch (e) {}
  }
  function avviaMissione() {
    zitto(); salvaStato(); S.attiva = true; S.fine = false; S.visti = new Set(); S.coda = []; S.cardAperta = false; S.diario = [];
    // difesa nemica casuale; un formatore può fissarla con ?cadet_difesa=presto|tardi|allerta nell'indirizzo
    let forzata = null; try { forzata = new URLSearchParams(location.search).get("cadet_difesa"); } catch (e) {}
    S.difesa = C.DIFESE.some(d => d.id === forzata) ? forzata : C.DIFESE[Math.floor(Math.random() * C.DIFESE.length)].id;
    APP.play(false); APP.vista3dAuto = false;
    APP.sc = C.scenario(S.scelte, S.difesa); APP.ricostruisci(); APP.setRuolo("BLUE");
    const eng = APP.engine; S.eng = eng; const tick = eng.tick.bind(eng);
    eng.tick = () => { C.regolaRiserva(eng); tick(); controllaScadenza(eng); };
    eng.on(ev => { if (ev.tipo === "evento") try { suEvento(ev.e); } catch (e) { console.warn("cadet", e); } });
    document.body.classList.add("cadet-attivo");
    overlay(); root.className = "cd-volo"; root.innerHTML = `<div class="cd-hud"><span class="cd-ora" id="cd-ora">09:00</span><span id="cd-stato">Gli aerei si preparano al decollo…</span><span class="cd-sp"></span><span class="cd-scad">Scadenza ponte <b>${C.SCADENZA}</b></span><button class="cd-btn small" data-voce>${S.voce ? "🔊" : "🔇"}</button><button class="cd-btn small" data-esci>✕</button></div><div class="cd-cardwrap" id="cd-cardwrap"></div>`;
    aggancia(root);
    S.oraTimer = setInterval(() => { const o = document.getElementById("cd-ora"); if (o && S.eng) o.textContent = Engine.s2hm(S.eng.t); ritmo(); }, 250);
    APP.setSpeed(120); APP.play(true);
  }
  const stato = t => { const s = document.getElementById("cd-stato"); if (s) s.textContent = t; };
  // ritmo: lento quando c'è azione (verso il ponte, sul ponte, scontri), veloce nei trasferimenti
  function ritmo() {
    const e = S.eng; if (!e || !APP.playing || S.cardAperta) return;
    const inVolo = e.flights.some(f => f.lato === "BLUE" && f.sortie > 0);
    const calda = e.ingaggi.some(i => !i.chiuso) || e.flights.some(f => !f.distrutto && f.alt > 50 && ["verso_target", "attacco", "attesa_target", "intercetta"].includes(f.stato));
    const v = !inVolo ? 120 : calda ? 15 : 60;
    if (APP.speed !== v) APP.setSpeed(v);
  }
  function segui(id) {
    if (typeof MONDO3D === "undefined") return;
    if (!MONDO3D.attiva) { try { MONDO3D.apri(id, { cam: "insegui" }); } catch (e) { console.warn(e); } return; }
    const sel = document.getElementById("m3d-sel"); if (!sel) return; const opt = [...sel.options].find(o => o.value.split(":")[0] === id);
    if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event("change")); }
  }
  const flight = id => S.eng && S.eng.flights.find(f => f.id === id || f.callsign === id);
  function controllaScadenza(eng) {
    if (S.visti.has("scadenza") || eng.t < Engine.hm2s(C.SCADENZA)) return; S.visti.add("scadenza");
    const tg = eng.target[0]; if (tg && tg.distrutto) return;
    card("⏰ Sono le 10:30", "I rifornimenti nemici stanno passando sul ponte, ancora in piedi.", "Da adesso, anche se il ponte cadesse, l'obiettivo principale non sarebbe raggiunto in tempo. Conta riportare a casa gli aerei.");
  }
  // momenti decisivi → pausa con spiegazione
  function suEvento(e) {
    if (!S.attiva || S.fine) return; const t = e.testo || "", chi = e.chi;
    S.diario.push(e);
    const f = flight(chi), blu = f && f.lato === "BLUE";
    if (/AIRBORNE/.test(t) && blu) {
      if (!S.visti.has("decollo")) { S.visti.add("decollo"); setTimeout(() => segui(f.id), 50); }
      if (/GLADIATOR|ROMA/.test(f.id) && !S.visti.has("dec_bomb")) { S.visti.add("dec_bomb"); stato("I bombardieri sono decollati: rifornimento in volo, poi ingresso"); setTimeout(() => segui(f.id), 80); }
      if (f.id === "RISERVA") { segui("RISERVA"); }
      return;
    }
    if (/AIRBORNE/.test(t) && f && f.lato === "RED") {
      if (S.visti.has("red_air")) return; S.visti.add("red_air");
      const scramble = /SCRAMBLE/.test(t);
      return card("🛫 Caccia nemici in volo", scramble ? "I due caccia nemici tenuti pronti a terra sono decollati da Redding." : "Due caccia nemici sono decollati da Redding per pattugliare la zona del ponte.",
        scramble ? "Vi hanno visti arrivare al confine un quarto d'ora fa: era il tempo che serviva per prepararli." : "Il nemico aveva deciso in anticipo quando sorvegliare il ponte. Chi si troverà lì in quel momento li incontrerà.", f.id);
    }
    if (/SCRAMBLE ordinato/.test(t)) { if (S.visti.has("scr")) return; S.visti.add("scr"); return card("👀 Il nemico vi ha visti", "I radar nemici hanno visto i vostri aerei avvicinarsi al confine: due caccia si preparano a decollare. Saranno in volo fra 15 minuti.", "Ogni minuto conta: chi colpisce e torna indietro in fretta può evitarli."); }
    if (/^MAGNUM – .*HARM/.test(t)) { stato("Il disturbatore lancia i missili anti-radar contro la zona sorvegliata"); return; }
    if (/SAM SOPPRESSA/.test(t)) {
      return card("⚡ Zona sorvegliata spenta", "Il disturbatore ha colpito il radar della zona sorvegliata con i suoi missili anti-radar: la batteria non può più guidare missili.",
        S.scelte.percorso === "esterno" ? "Avevate scelto la rotta esterna, che non attraversa la zona: questa protezione, qui, non era indispensabile." : "È quello che serviva per attraversare il percorso diretto: da adesso è sicuro.", "GROWLER");
    }
    if (/^PUSH/.test(t) && f && /GLADIATOR|ROMA|RISERVA/.test(f.id) && !S.visti.has("push_" + f.id)) {
      S.visti.add("push_" + f.id); stato("In territorio nemico: verso il ponte");
      const ingresso = (/nord/i.test(t) ? "l'ingresso nord (rotta esterna)" : "l'ingresso diretto");
      if (S.visti.has("push_any")) return; S.visti.add("push_any");
      return card("➡ Ingresso in territorio nemico", `${sogg(f.id, true)} ${verbo(f.id, "entra", "entrano")} da ${ingresso}.`, spiegaIngresso(), f.id);
    }
    if (/SAM LAUNCH su/.test(t)) {
      const vit = (t.match(/su ([A-Z0-9 ]+?) \(/) || [])[1]; const v = flight(vit);
      const vid = v ? v.id : vit;
      return card("🚀 Missili dalla zona sorvegliata!", `${sogg(vid, true)} ${verbo(vid, "è entrato", "sono entrati")} nella zona sorvegliata e la batteria ha lanciato i suoi missili.`,
        vid === "TITAN" ? "La scorta difende dagli aerei, non dai missili da terra: senza un disturbatore vicino, anche lei viene colpita." : "Nessun disturbatore era abbastanza vicino da accecarne il radar. La scorta o la velocità non bastano contro i missili da terra.", v && !v.distrutto ? v.id : null);
    }
    if (/^ESCORT – interviene/.test(t)) { S.visti.add("escort_" + chi); return; }
    if (/^MERGED con/.test(t) && blu) {
      const k = "merge_" + f.id; if (S.visti.has(k)) return; S.visti.add(k);
      const scorta = f.id === "TITAN";
      return card("⚔ Caccia nemici!", scorta ? "La scorta si mette fra i caccia nemici e i bombardieri e li affronta." : f.id === "GROWLER" ? "I caccia nemici hanno trovato il disturbatore, che non ha armi per difendersi." : `I caccia nemici hanno intercettato ${sogg(f.id)}, che ${verbo(f.id, "deve", "devono")} difendersi da soli.`,
        scorta ? "Era il compito per cui l'avevate scelta: gli F-22 sono molto superiori ai Su-35." : S.scelte.protezione === "disturbo" ? "Avevate scelto il disturbatore: protegge dai missili da terra, non dagli aerei." : "Senza scorta vicina, i bombardieri hanno poche armi aria-aria: è il rischio che avevate accettato.", f.id);
    }
    if (e.tipo === "ingaggio" && chi === "INGAGGIO") {
      // esito del duello: si raccolgono le perdite annunciate subito dopo
      const id = e.ingaggio; if (S.visti.has("ing_" + id)) return; S.visti.add("ing_" + id);
      setTimeout(() => { const ing = S.eng.ingaggi.find(x => x.id === id); if (!ing || !ing.risultato) return; const r = ing.risultato; const b = flight(ing.blue);
        card("📋 Esito dello scontro", `${r.killB ? (r.killB === 1 ? "Abbattuto 1 caccia nemico." : `Abbattuti ${r.killB} caccia nemici.`) : "Nessun caccia nemico abbattuto."} ${r.killR ? `${r.killR === 1 ? "Perso 1" : `Persi ${r.killR}`} dei nostri (${sogg(b.id)}).` : "Nessuna perdita fra i nostri."}`,
          b && b.id === "TITAN" ? "Gli F-22 sono più moderni dei Su-35: in questo simulatore valgono il doppio in combattimento." : b && b.id === "GROWLER" ? "Il disturbatore non ha missili aria-aria: contro i caccia può solo subire, se nessuno lo protegge." : "Un F-15E carico di bombe combatte alla pari con un Su-35: senza scorta lo scontro costa caro.", b && !b.distrutto ? b.id : null); }, 0);
      return;
    }
    if (/^RISERVA$/.test(chi)) {
      if (/resta a terra/.test(t)) return card("🟢 La riserva resta a terra", "Il ponte è già interrotto: i due bombardieri di riserva non decollano.", "Due aerei in meno esposti al rischio: è il vantaggio di tenere una riserva.");
      if (/riserva decolla/.test(t)) { stato("La riserva decolla"); return card("🔁 Scatta il piano B", "Il primo gruppo non ce l'ha fatta e il ponte è ancora in piedi: i due bombardieri di riserva decollano ora.", `Arriveranno sul ponte fra circa mezz'ora: la scadenza è alle ${C.SCADENZA}.`, "RISERVA"); }
    }
    if (/SHACK!/.test(t)) {
      const ora = Engine.s2hm(S.eng.t), ok = S.eng.t <= Engine.hm2s(C.SCADENZA); stato("Ponte interrotto: rientro alla base");
      return card(ok ? "🎯 Ponte interrotto!" : "🎯 Ponte interrotto, ma tardi", `${sogg(f ? f.id : chi, true)} ${verbo(f ? f.id : chi, "ha", "hanno")} colpito il ponte alle ${ora}.`, ok ? `In tempo: i rifornimenti delle ${C.SCADENZA} non passeranno. Ora conta tornare a casa.` : `La scadenza era alle ${C.SCADENZA}: i rifornimenti sono già passati.`, f && f.id);
    }
    if (/PICKLE/.test(t) && f) { stato(`${nome(f.id)}: bombe sul ponte, danno parziale`); return; }
    if (/Formazione persa/.test(t) && blu) { stato(`${nome(f.id)}: formazione persa`); return; }
    if (/BINGO/.test(t) && blu) { stato(`${nome(f.id)}: carburante al minimo, rientro`); return; }
    if (/Tutte le formazioni BLUE hanno concluso/.test(t) || /Fine della finestra operativa/.test(t)) {
      if (S.visti.has("fine")) return; S.visti.add("fine");
      const x = C.esito(S.eng); stato("Missione conclusa");
      card("🏁 Missione conclusa", x.rientrati === 0 ? "Nessun aereo è tornato alla base." : x.rientrati === x.esposti ? `Tutti gli aerei sono tornati alla base: ${x.rientrati} su ${x.esposti}.` : `Sono tornati alla base ${x.rientrati} aerei su ${x.esposti}.`, "Nel debrief scoprirai che cosa aveva deciso la difesa nemica e che cosa sarebbe successo con scelte diverse.", null, () => { S.fine = true; fineMissione(); });
    }
  }
  function spiegaIngresso() {
    const s = S.scelte;
    if (s.percorso === "diretto") return s.protezione === "scorta" ? "Il percorso diretto passa nella zona sorvegliata, e avete scelto la scorta: protegge dagli aerei, non dai missili da terra." : "Il percorso diretto passa nella zona sorvegliata: il disturbatore deve averla resa innocua.";
    if (s.percorso === "esterno") return "La rotta esterna gira intorno alla zona sorvegliata: più lunga, ma lontana dai missili da terra. Resta l'incognita dei caccia nemici.";
    return "Due gruppi: uno passa dal diretto, uno dal nord. Se uno viene fermato, l'altro può arrivare, ma ognuno è più piccolo.";
  }
  function card(titolo, cosa, perche, segue, poi) {
    S.coda.push({ titolo, cosa, perche, segue, poi }); if (!S.cardAperta) prossimaCard();
  }
  function prossimaCard() {
    const c = S.coda.shift(); const w = document.getElementById("cd-cardwrap"); if (!c || !w) { S.cardAperta = false; if (w) w.innerHTML = ""; if (S.attiva && !S.fine && !APP.playing && !(typeof AAR_CINE !== "undefined" && AAR_CINE.attiva)) APP.play(true); return; }
    S.cardAperta = true; APP.play(false); if (c.segue) segui(c.segue);
    w.innerHTML = `<div class="cd-card"><div class="cd-card-t">${esc(c.titolo)} <small>${S.eng ? Engine.s2hm(S.eng.t) : ""}</small></div><p><b>Cosa succede.</b> ${esc(c.cosa)}</p><p><b>${c.poi ? "E adesso." : "Perché."}</b> ${esc(c.perche)}</p><div class="cd-az"><span class="cd-sp"></span><button class="cd-btn primary" data-cont>${c.poi ? "Vai al debrief ▶" : "Continua ▶"}</button></div></div>`;
    parla(`${c.titolo}. ${c.cosa} ${c.perche}`);
    w.querySelector("[data-cont]").onclick = () => { zitto(); if (c.poi) { S.coda = []; S.cardAperta = false; w.innerHTML = ""; c.poi(); return; } prossimaCard(); };
  }
  function fineMissione() {
    clearInterval(S.oraTimer); APP.play(false); S.coda = []; S.cardAperta = false;
    try { if (MONDO3D.attiva) MONDO3D.chiudi(); } catch (e) {}
    document.body.classList.remove("cadet-attivo"); debrief();
  }

  /* 4 · debrief */
  function riga(x) {
    const p = x.inTempo ? `<span class="cd-pill ok">✔ ponte in tempo (${x.ora})</span>` : x.ponte ? `<span class="cd-pill warn">⏱ ponte in ritardo (${x.ora})</span>` : `<span class="cd-pill ko">✖ ponte in piedi</span>`;
    return `${p} <span class="cd-pill ${x.persi ? "ko" : "ok"}">${x.persi ? aerei(x.persi, "perso", "persi") : "tutti a casa"}</span>`;
  }
  const aerei = (n, sing, plur) => n === 1 ? `1 aereo ${sing}` : `${n} aerei ${plur}`;
  function analisi(x, ev) {
    const s = S.scelte, out = [];
    const sam = ev.filter(e => /SAM LAUNCH/.test(e.testo)), duelli = S.eng.ingaggi.filter(i => i.risultato);
    const persiSam = sam.length ? ev.filter(e => /abbattuti da Zona sorvegliata/.test(e.testo)).length : 0;
    if (sam.length) out.push(`La zona sorvegliata ha lanciato i suoi missili ${sam.length === 1 ? "una volta" : sam.length + " volte"}: chi l'ha attraversata senza un disturbatore vicino è stato colpito.`);
    if (sam.length && s.protezione === "scorta" && s.percorso !== "esterno") out.push("La protezione non corrispondeva alla minaccia: la scorta difende dagli aerei, ma sul percorso diretto il pericolo erano i missili da terra.");
    if ((s.protezione === "disturbo" || s.protezione === "entrambi") && s.percorso === "esterno") out.push("Il disturbatore ha spento la zona sorvegliata, ma sulla rotta esterna non la attraversavate: quella protezione qui non era necessaria.");
    if ((s.protezione === "disturbo" || s.protezione === "entrambi") && s.percorso !== "esterno" && !sam.length) out.push("Il disturbatore ha reso innocua la zona sorvegliata: il passaggio diretto ha funzionato.");
    const conScorta = duelli.filter(i => i.blue === "TITAN"), senza = duelli.filter(i => i.blue !== "TITAN");
    if (conScorta.length) { const k = conScorta.reduce((a, i) => a + i.risultato.killB, 0), p = conScorta.reduce((a, i) => a + i.risultato.killR, 0); out.push(`La scorta ha affrontato i caccia nemici: ${k} abbattuti, ${p} ${p === 1 ? "perso" : "persi"} fra i nostri.`); }
    if (senza.length) { const p = senza.reduce((a, i) => a + i.risultato.killR, 0); out.push(`${senza.length === 1 ? "Uno scontro" : senza.length + " scontri"} senza scorta: ${p ? (p === 1 ? "perso 1 aereo" : `persi ${p} aerei`) : "nessuna perdita, per fortuna"}.`); }
    if (!duelli.length) out.push("Non avete incontrato i caccia nemici: la difesa li ha impiegati in un altro momento.");
    if (s.protezione === "entrambi") out.push(`Partire alle 09:40 ha dato la protezione completa; il ponte ${x.ponte ? `è caduto alle ${x.ora}` : "non è caduto"} (scadenza ${C.SCADENZA}).`);
    if (x.riserva === "a terra") out.push("La riserva è rimasta a terra: due aerei in meno esposti.");
    if (x.riserva === "partita") out.push(`La riserva è partita perché il primo gruppo non ce l'aveva fatta${x.inTempo ? ", e ha completato in tempo" : x.ponte ? ", ma è arrivata dopo la scadenza" : ", senza riuscirci"}.`);
    if (s.forza === "pochi" && !x.ponte) out.push("Con solo due bombardieri non c'era margine: perdendone uno, le bombe non bastavano più.");
    if (s.percorso === "divisi" && persiSam) out.push("Dividendo i gruppi, quello sul percorso diretto era senza protezione adatta: l'altro ha dovuto fare da solo.");
    return out;
  }
  function debrief() {
    S.attiva = false; const x = C.esito(S.eng), ev = S.eng.eventi, s = S.scelte, d = C.DIFESE.find(z => z.id === S.difesa);
    const titolo = x.inTempo && !x.persi ? "Missione riuscita" : x.inTempo ? "Obiettivo raggiunto, con un prezzo" : x.ponte ? "Ponte interrotto, ma in ritardo" : "Obiettivo non raggiunto";
    // alternative: stesso piano cambiando una decisione alla volta, contro la stessa difesa (motore vero)
    const alt = [];
    DECISIONI.forEach(dd => C.SCELTE[dd.chiave].filter(o => o.id !== s[dd.chiave]).forEach(o => { const sc2 = Object.assign({}, s, { [dd.chiave]: o.id }); alt.push({ dom: dd.domanda, tit: o.titolo, x: C.simula(sc2, S.difesa).esito }); }));
    const altreDif = C.DIFESE.filter(z => z.id !== S.difesa).map(z => ({ tit: z.titolo, x: C.simula(s, z.id).esito }));
    const r = schermo(`${testata("MISSIONE 01 — IL CORRIDOIO · Debrief", esc(titolo))}
      <div class="cd-grid">
        <div class="cd-pan"><h4>Risultato</h4><p>${riga(x)}</p><ul class="cd-num"><li>Ponte: <b>${x.ponte ? `interrotto alle ${x.ora}` : x.danni ? `danneggiato ${Math.round(x.danni / x.richieste * 100)}%, ancora in piedi` : "intatto"}</b> (scadenza ${C.SCADENZA})</li><li>Aerei tornati a casa: <b>${x.rientrati} su ${x.esposti}</b></li><li>Caccia nemici abbattuti: <b>${x.abbattutiNemici}</b></li></ul>
          <h4>Le tue scelte</h4><ul>${DECISIONI.map(dd => `<li>${esc(nomeScelta(dd.chiave, s[dd.chiave]))}</li>`).join("")}</ul></div>
        <div class="cd-pan gold"><h4>Cosa aveva deciso la difesa</h4><p><b>${esc(d.titolo)}.</b> ${esc(d.testo)}</p><h4>Cosa è successo e perché</h4><ul>${analisi(x, ev).map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>
        <div class="cd-pan"><h4>E se avessi scelto diversamente?</h4><small>Stessa difesa nemica, cambiando una sola decisione. Le partite sono simulate dal motore vero.</small>
          <table class="cd-tab">${alt.map(a => `<tr><td><small>${esc(a.dom)}</small><br>${esc(a.tit)}</td><td>${riga(a.x)}</td></tr>`).join("")}</table></div>
        <div class="cd-pan"><h4>Il tuo piano, contro le altre difese possibili</h4><small>Non sapevi cosa avrebbe fatto il nemico: il tuo piano era robusto?</small>
          <table class="cd-tab">${altreDif.map(a => `<tr><td>${esc(a.tit)}</td><td>${riga(a.x)}</td></tr>`).join("")}</table></div>
        <div class="cd-pan blue"><h4>Portalo nel lavoro di squadra</h4><ul><li>Quale informazione ti mancava, e come avresti potuto ottenerla?</li><li>Qual era la tua priorità: il risultato in tempo o riportare tutti a casa? L'avevi detta ad alta voce alla squadra?</li><li>Quale scelta rifaresti uguale anche sapendo com'è andata? Perché?</li></ul></div>
      </div>
      <div class="cd-az"><button class="cd-btn" data-esci>Esci</button><span class="cd-sp"></span><button class="cd-btn primary" data-rigioca>↻ Rigioca con altre scelte</button></div>`);
    aggancia(r); r.querySelector("[data-esci]").onclick = chiudi;
    r.querySelector("[data-rigioca]").onclick = () => { ripristinaStato(); decisione(0); };
    parla(`${titolo}. ${d.titolo}. ${d.testo}`);
  }

  function chiudi() {
    zitto(); clearInterval(S.oraTimer); S.attiva = false; S.fine = true; document.body.classList.remove("cadet-attivo");
    ripristinaStato(); if (root) { root.remove(); root = null; }
  }

  /* ---------------- ingresso dalla schermata iniziale ---------------- */
  function installa() {
    // scenario Cadetto rimasto salvato (pagina chiusa a missione in corso): si rimette quello del giocatore
    try { const b = localStorage.getItem("centurion_cadet_backup"); if (b && APP.sc && APP.sc.missione && APP.sc.missione.cadet) { APP.sc = JSON.parse(b); APP.ricostruisci(); } localStorage.removeItem("centurion_cadet_backup"); } catch (e) {}
    const box = document.querySelector("#splash .splash-box"); if (!box || document.getElementById("btn-cadet-splash")) return;
    const b = document.createElement("button"); b.id = "btn-cadet-splash"; b.className = "cd-entry";
    b.innerHTML = `<span class="cd-entry-ico">🎓</span><span><b>CENTURION CADET · Accademia e prima missione</b><small>Lezioni di volo, armi, attacco e difesa sul Typhoon, poi una missione da comandante: nessuna conoscenza militare richiesta</small></span><span class="cd-entry-go">Inizia ▶</span>`;
    b.onclick = apri; const sub = box.querySelector(".splash-sub"); (sub || box.firstChild).insertAdjacentElement(sub ? "afterend" : "beforebegin", b);
    stile();
  }
  function stile() { if (document.getElementById("cd-style")) return; const st = document.createElement("style"); st.id = "cd-style"; st.textContent = CSS; document.head.appendChild(st); }
  window.addEventListener("DOMContentLoaded", () => setTimeout(installa, 0));

  const CSS = `
  .cd-entry{display:flex;align-items:center;gap:14px;width:100%;max-width:820px;margin:14px auto 6px;padding:14px 18px;border-radius:14px;border:2px solid var(--gold,#f1c40f);background:linear-gradient(90deg,#2a2410,#16202c);color:var(--txt,#e6edf3);text-align:left;cursor:pointer}
  .cd-entry b{display:block;font-size:17px;letter-spacing:.02em}.cd-entry small{display:block;color:#c9d4e0;font-size:13px;margin-top:2px}.cd-entry-ico{font-size:30px}.cd-entry-go{margin-left:auto;background:var(--gold,#f1c40f);color:#221a00;font-weight:800;border-radius:999px;padding:8px 14px;white-space:nowrap}
  #cadet{position:fixed;inset:0;z-index:100000;color:#e6edf3;font-family:"Segoe UI",Roboto,Arial,sans-serif}
  #cadet.cd-schermo{background:radial-gradient(1200px 600px at 50% -10%,#1b3350,#0f1419 60%);overflow-y:auto;-webkit-overflow-scrolling:touch}
  #cadet .cd-box{max-width:1100px;margin:0 auto;padding:18px 18px 28px}
  #cadet .cd-top{display:flex;align-items:flex-start;gap:12px;margin-bottom:6px}#cadet .cd-top>div:first-child{flex:1}#cadet .cd-top-az{display:flex;gap:6px}
  #cadet .cd-kicker{color:var(--gold,#f1c40f);font-weight:800;letter-spacing:.12em;font-size:12px;text-transform:uppercase}
  #cadet h2{font-size:26px;margin:4px 0 6px}#cadet h4{margin:4px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#9ccbff}
  #cadet .cd-lead{font-size:16px;color:#d6e2ee;line-height:1.5;margin:6px 0 12px}#cadet .cd-nota,#cadet .cd-muted{color:#8b98a8;font-size:13px}
  #cadet .cd-btn{background:#1d2530;color:#e6edf3;border:1px solid #2a3441;border-radius:10px;padding:10px 16px;font-weight:700;font-size:15px;cursor:pointer;min-height:44px}
  #cadet .cd-btn.primary{background:#2e86de;border-color:#2e86de}#cadet .cd-btn.primary:disabled{opacity:.45;cursor:not-allowed}#cadet .cd-btn.ghost{background:transparent}#cadet .cd-btn.small{padding:6px 10px;font-size:13px;min-height:34px}#cadet .cd-btn.big{font-size:18px;padding:14px 22px}
  #cadet .cd-az{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}#cadet .cd-sp{flex:1}
  #cadet .cd-livelli{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:10px 0}
  #cadet .cd-livello{background:#161c24;border:2px solid #2a3441;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px}#cadet .cd-livello.on{border-color:var(--gold,#f1c40f)}#cadet .cd-livello.off{opacity:.6}
  #cadet .cd-liv-tit{font-size:19px;font-weight:800}#cadet .cd-liv-sub{color:#c0ccde;font-size:14px;flex:1}
  #cadet .cd-pill{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:800;background:#2a3441;margin:2px 4px 2px 0}#cadet .cd-pill.ok{background:#2ecc71;color:#052}#cadet .cd-pill.warn{background:#f39c12;color:#210}#cadet .cd-pill.ko{background:#e74c3c;color:#fff}
  #cadet .cd-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:16px;align-items:start}
  #cadet .cd-mapbox{background:#0b0f14;border:1px solid #2a3441;border-radius:14px;overflow:hidden}#cadet .cd-map{display:block;width:100%;height:auto}
  #cadet .cd-pulse{animation:cdp 1.4s ease-in-out infinite}@keyframes cdp{50%{opacity:.35}}
  #cadet .cd-dots{display:flex;gap:6px;margin-bottom:8px}#cadet .cd-dots span{width:28px;height:5px;border-radius:3px;background:#2a3441}#cadet .cd-dots span.on{background:var(--gold,#f1c40f)}
  #cadet .cd-narra{font-size:19px;line-height:1.55}
  #cadet .cd-opz{display:flex;flex-direction:column;gap:8px}
  #cadet .cd-op{display:flex;gap:12px;align-items:center;text-align:left;background:#161c24;border:2px solid #2a3441;border-radius:12px;padding:12px;color:#e6edf3;cursor:pointer}#cadet .cd-op.sel{border-color:#2e86de;background:#10263d}
  #cadet .cd-op b{display:block;font-size:16px}#cadet .cd-op small{display:block;color:#aab7c6;font-size:14px;margin-top:2px}
  #cadet .cd-let{flex:none;width:34px;height:34px;border-radius:50%;background:#2a3441;display:flex;align-items:center;justify-content:center;font-weight:900}#cadet .cd-op.sel .cd-let{background:#2e86de}
  #cadet .cd-cons{background:#161c24;border:1px solid #2a3441;border-radius:12px;padding:12px;margin-top:10px;font-size:15px;line-height:1.45}
  #cadet .cd-pc{display:grid;grid-template-columns:1fr 1fr;gap:10px}#cadet .cd-pc ul{margin:4px 0 0;padding-left:18px}#cadet .ok{color:#2ecc71}#cadet .ko{color:#ff6b5b}
  #cadet .cd-istr{background:#0b2a4a;border:1px solid #2e86de;border-radius:12px;padding:12px;margin-top:10px;font-size:15px;line-height:1.45}#cadet .cd-istr ul{padding-left:18px}#cadet .cd-istr dt{font-weight:800;margin-top:6px}#cadet .cd-istr dd{margin:0 0 0 0;color:#c9d4e0}
  #cadet .hidden{display:none!important}
  #cadet .cd-rie{display:flex;gap:12px;align-items:center;background:#161c24;border:1px solid #2a3441;border-radius:12px;padding:10px;margin-bottom:8px}#cadet .cd-rie>div{flex:1}#cadet .cd-rie small{display:block;color:#8b98a8}#cadet .cd-rie b{font-size:16px}
  #cadet.cd-volo{pointer-events:none;background:transparent}
  #cadet .cd-hud{pointer-events:auto;position:absolute;top:0;left:0;right:0;display:flex;gap:10px;align-items:center;padding:8px 12px;background:linear-gradient(#0b0f14ee,#0b0f1400);font-size:15px;flex-wrap:wrap}
  #cadet .cd-ora{font:700 22px/1 monospace;color:#f7dc6f}#cadet .cd-scad{color:#c9d4e0}
  #cadet .cd-cardwrap{position:absolute;left:0;right:0;bottom:12px;display:flex;justify-content:center;padding:0 10px}
  #cadet .cd-card{pointer-events:auto;max-width:620px;width:100%;max-height:62vh;overflow:auto;background:#0f1722f2;border:2px solid var(--gold,#f1c40f);border-radius:14px;padding:12px 16px;box-shadow:0 10px 40px #000a;font-size:16px;line-height:1.45}
  #cadet .cd-card-t{font-size:20px;font-weight:800;margin-bottom:4px}#cadet .cd-card-t small{color:#8b98a8;font-weight:600;font-size:13px;margin-left:6px}#cadet .cd-card p{margin:6px 0}
  #cadet .cd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}
  #cadet .cd-pan{background:#161c24;border:1px solid #2a3441;border-left:4px solid #2a3441;border-radius:12px;padding:12px 14px;font-size:15px;line-height:1.45}#cadet .cd-pan.gold{border-left-color:var(--gold,#f1c40f)}#cadet .cd-pan.blue{border-left-color:#2e86de}#cadet .cd-pan ul{padding-left:18px;margin:6px 0}
  #cadet .cd-tab{width:100%;border-collapse:collapse;margin-top:6px}#cadet .cd-tab td{border-bottom:1px solid #2a3441;padding:6px 4px;vertical-align:top;font-size:14px}#cadet .cd-num{list-style:none;padding:0}
  body.cadet-attivo #mondo3d .m3d-bar,body.cadet-attivo #mondo3d .m3d-info,body.cadet-attivo #mondo3d #m3d-ticker{display:none!important}
  @media (max-width:760px){#cadet .cd-split{grid-template-columns:1fr}#cadet .cd-split .cd-mapbox{order:-1}#cadet h2{font-size:21px}#cadet .cd-narra{font-size:17px}#cadet .cd-pc{grid-template-columns:1fr}#cadet .cd-grid{grid-template-columns:1fr}}
  @media (max-height:460px){#cadet .cd-card{max-height:58vh;font-size:14px;padding:8px 12px}#cadet .cd-card-t{font-size:17px}#cadet .cd-hud{font-size:13px;padding:4px 8px}#cadet .cd-ora{font-size:18px}#cadet .cd-btn{min-height:38px;padding:7px 12px;font-size:14px}}
  `;
  return { apri, chiudi, get attiva() { return S.attiva; }, get stato() { return { scelte: S.scelte, difesa: S.difesa, fine: S.fine, coda: S.coda.length, card: S.cardAperta }; }, _S: S };
})();
