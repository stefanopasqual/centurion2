/* =====================================================================
   RETE – modalità di gioco
   1) POSTAZIONE UNICA: trainer e squadre sullo stesso schermo; il cambio di ruolo mantiene fase e partita
      e, verso una squadra, mostra una schermata di passaggio (nessuno vede le informazioni dell'altro lato).
      PIN opzionale per tornare TRAINER: regole.pin_trainer nell'Editor.
   2) TRE POSTAZIONI: il PC del trainer fa girare il motore e pubblica lo stato sul server locale (server.py /api/sess/*);
      le postazioni BLUE e RED (tablet, portatili, smartphone nella stessa Wi-Fi) ricevono lo stato e vedono solo la propria
      nebbia di guerra, sentono la propria radio, inviano il proprio piano e gli ordini (RTB, CAP, target assign…).
   Si passa da una modalità all'altra in qualunque momento senza perdere la partita.
   ===================================================================== */
const RETE = (() => {
  const S = { modo: "unica", ruolo: null, host: false, id: null, ver: -1, evN: 0, regN: 0, partita: null, scVer: 0, scFirma: "", pianiVer: { BLUE: 0, RED: 0 },
    comN: 0, timer: null, timer2: null, evInviati: 0, regInviati: 0, firma: "", ultimoInvio: 0, faseHost: null, info: null, bulk: false, tScPush: null, tPiano: null, inviando: false };
  const $ = s => document.querySelector(s);
  const NOMI = { TRAINER: "🎓 TRAINER", BLUE: "✈ SQUADRA BLUE", RED: "🛡 SQUADRA RED" };
  const api = (p, body) => fetch(p, body !== undefined ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" })
    .then(r => r.json().catch(() => null)).catch(() => null);
  const toast = (t, ms) => UI.toast(t, ms);
  const salvaSessione = () => { try { sessionStorage.setItem("centurion_rete", JSON.stringify({ modo: S.modo, ruolo: S.ruolo, host: S.host, id: S.id, token: S.token || null })); } catch (e) {} };
  const nuovaPartita = () => Math.random().toString(36).slice(2, 10);

  /* ---------- stato del motore: istantanea e applicazione ---------- */
  const ESCLUSI = new Set(["sc", "listeners", "eventi", "registrazione", "_riarmo", "_partita", "comando", "_comandoLocale"]);
  function istantanea(eng) { const o = {}; Object.keys(eng).forEach(k => { if (!ESCLUSI.has(k)) o[k] = eng[k]; }); o._riarmo = (eng._riarmo || []).map(f => f.id); return o; }
  function applica(eng, s) {
    const note = {}; (eng.sam || []).forEach(x => { if (x.nota_blue) note[x.id] = x.nota_blue; });   // ultima posizione nota dei SAM: è della singola postazione
    Object.keys(s).forEach(k => { if (k !== "_riarmo") eng[k] = s[k]; });
    eng._riarmo = (s._riarmo || []).map(id => eng.flights.find(f => f.id === id)).filter(Boolean);
    (eng.sam || []).forEach(x => { if (note[x.id] && S.ruolo === "BLUE") x.nota_blue = note[x.id]; });
  }
  /* il motore viene ricreato a ogni ricostruisci(): qui lo si collega alla modalità corrente */
  function agganciaEngine(eng) {
    eng._partita = (S.host && S._partitaRipresa) || nuovaPartita(); S._partitaRipresa = null;
    S.evInviati = 0; S.regInviati = 0; S.firma = "";
    eng._comandoLocale = eng.comando.bind(eng);
    if (client()) {   // in una postazione squadra gli ordini vanno al trainer, non al motore locale
      eng.comando = (id, cmd, arg) => { const f = eng.flights.find(x => x.id === id); if (f && f.lato !== S.ruolo) return toast("Puoi dare ordini solo alle tue formazioni");
        api("api/sess/comando", { lato: S.ruolo, ruolo: S.ruolo, id, cmd, arg }).then(r => toast(r && r.ok ? `Ordine inviato al trainer: ${f ? f.callsign : id} → ${cmd.toUpperCase()}${arg ? " " + arg : ""}` : "Ordine non inviato: server non raggiungibile", 4000)); };
      eng.eventi = []; eng.registrazione = []; S.ver = -1; S.evN = 0; S.regN = 0; S.partita = null;   // tutto arriverà dal trainer
    }
  }
  const client = () => S.modo === "multi" && !S.host;
  const host = () => S.modo === "multi" && S.host;

  /* ---------- TRAINER (host): pubblica lo stato, riceve piani e ordini ---------- */
  async function creaSessione() {
    const r = await api("api/sess/crea", { sc: APP.sc, token: S.token });
    if (!r || !r.ok) return toast(r && r.errore ? "Sessione non creata: " + r.errore : "Serve il server locale (AVVIA_SIMULATORE.bat o CENTURION.exe) per giocare a più postazioni", 7000);
    S.modo = "multi"; S.host = true; S.ruolo = "TRAINER"; S.id = r.id; S.token = r.token; S.comN = 0; S.pianiVer = { BLUE: 0, RED: 0 }; salvaSessione();
    APP.setRuolo("TRAINER"); avviaHost(); aggiornaBadge();
    toast(`Sessione ${r.id} creata. Sui dispositivi delle squadre apri ${(r.indirizzi || [])[0] || "l'indirizzo di rete del PC"}`, 9000);
  }
  function avviaHost() {
    fermaCicli(); document.body.classList.add("rete-host"); document.body.classList.remove("rete-client");
    S.evInviati = 0; S.regInviati = 0; S.firma = ""; pubblica(true);
    S.timer = setInterval(() => pubblica(false), 700); S.timer2 = setInterval(ricevi, 1000);
  }
  async function pubblica(forza) {
    if (!host() || S.inviando) return; const eng = APP.engine; if (!eng) return;
    const firma = [eng._partita, eng.t, eng.eventi.length, APP.fase, APP.playing, APP.speed, eng.finita, S.sporco || 0].join("|");
    if (!forza && firma === S.firma && Date.now() - S.ultimoInvio < 5000) return;
    S.inviando = true; const evDa = S.evInviati, regDa = S.regInviati;
    const r = await api("api/sess/stato", { ruolo: "TRAINER", token: S.token, partita: eng._partita, snap: istantanea(eng), meta: { fase: APP.fase, playing: APP.playing, speed: APP.speed, finita: eng.finita, t: eng.t },
      evDa, eventi: eng.eventi.slice(evDa), regDa, reg: eng.registrazione.slice(regDa) });
    S.inviando = false;
    if (r && r.ok) { S.firma = firma; S.ultimoInvio = Date.now(); S.evInviati = Math.min(r.evN, eng.eventi.length); S.regInviati = Math.min(r.regN, eng.registrazione.length); }
    else if (r && r.attiva === false) chiusaDalServer();
    else if (r && /riservata/.test(r.errore || "") && !S.avvisoToken) { S.avvisoToken = true; toast("Questo dispositivo non è autorizzato a pubblicare come TRAINER: riprendi la regia dal PC che fa da server", 8000); }
  }
  async function ricevi() {
    if (!host() || S.ricevendo) return; S.ricevendo = true;   // una richiesta alla volta: niente ordini applicati due volte con la rete lenta
    try { await riceviOra(); } finally { S.ricevendo = false; }
  }
  async function riceviOra() {
    const c = await api("api/sess/comandi?ruolo=TRAINER&da=" + S.comN);
    if (c && c.attiva === false) return chiusaDalServer();
    if (c && c.comandi && c.comandi.length && c.comandi[0].n !== S.comN) return;   // risposta vecchia
    if (c && c.comandi) { c.comandi.forEach(o => { const eng = APP.engine; const f = eng.flights.find(x => x.id === o.id);
        if (f && (o.lato === f.lato || o.lato === "TRAINER")) { eng._origineOrdine = "ordine della SQUADRA " + o.lato; try { (eng._comandoLocale || eng.comando).call(eng, o.id, o.cmd, o.arg); } finally { delete eng._origineOrdine; } toast(`📡 Ordine dalla SQUADRA ${o.lato}: ${f.callsign} → ${String(o.cmd).toUpperCase()}${o.arg ? " " + o.arg : ""}`, 5000); S.sporco = (S.sporco || 0) + 1; } });
      S.comN = c.n; if (c.comandi.length) { APP.refresh(); if (APP.fase === "esecuzione") UI.aggiornaEsecuzione(); pubblica(true); } }
    const p = await api("api/sess/piani?ruolo=TRAINER");
    if (p && p.pianiVer) ["BLUE", "RED"].forEach(l => { if (p.pianiVer[l] > (S.pianiVer[l] || 0)) { S.pianiVer[l] = p.pianiVer[l]; if (p.piani[l]) pianoRicevuto(l, p.piani[l]); } });
  }
  function pianoRicevuto(lato, piano) {
    if (JSON.stringify(APP.sc.piani[lato] || null) === JSON.stringify(piano)) return;   // nessuna modifica reale
    APP.sc.piani[lato] = piano; DATAIO.salvaLocale(APP.sc); scModificato();   // anche sul server: il piano non si perde se il trainer ricarica
    const eng = APP.engine; const iniziata = eng.t > Engine.hm2s(APP.sc.tempo.inizio) || APP.playing;
    if (!iniziata) { APP.ricostruisci(); toast(`📡 Piano della SQUADRA ${lato} aggiornato`, 2500); return; }
    const t = document.createElement("div"); t.className = "toast big"; t.style.pointerEvents = "auto";
    t.innerHTML = `<b>📡 La SQUADRA ${lato} ha inviato un nuovo piano.</b> La missione è già in corso. <button class="btn small primary">Applica e ricomincia dalle ${APP.sc.tempo.inizio}</button> <button class="btn small">Più tardi</button>`;
    document.getElementById("toast-area").appendChild(t); const [b1, b2] = t.querySelectorAll("button"); b1.onclick = () => { t.remove(); APP.ricostruisci(); }; b2.onclick = () => t.remove(); setTimeout(() => t.remove(), 60000);
  }
  function scModificato() { if (!host()) return; clearTimeout(S.tScPush); S.tScPush = setTimeout(() => api("api/sess/sc", { ruolo: "TRAINER", token: S.token, sc: APP.sc }), 600); }

  /* ---------- SQUADRA (client): riceve lo stato, invia piano e ordini ---------- */
  async function unisciti(ruolo, ripresa) {
    const info = await api("api/sess/info"); if (!info || !info.attiva) return toast("Nessuna sessione attiva: il trainer deve crearla dal suo PC", 6000);
    S.modo = "multi"; S.ruolo = ruolo; S.host = ruolo === "TRAINER"; S.id = info.id; salvaSessione();
    const r = await api("api/sess/sc?ruolo=" + ruolo + "&lato=" + (ruolo === "TRAINER" ? "" : ruolo));
    if (!r || !r.sc) return toast("Scenario non ricevuto dal server", 5000);
    S.scVer = r.scVer; S.scFirma = firmaSc(r.sc); S.pianoInviato = JSON.stringify((r.sc.piani || {})[ruolo] || null);
    if (S.host) {   // il trainer riprende la sessione (es. dopo un ricaricamento): ricostruisce lo stato dal server e torna a pubblicare
      APP.sc = r.sc; S.modo = "multi"; S.host = false; APP.setRuolo("TRAINER"); APP.ricostruisci(); document.body.classList.add("rete-client");
      await sincronizza(true); const eraInPlay = APP.playing; S.host = true; S._partitaRipresa = S.partita; APP.engine._partita = S.partita; S.evInviati = APP.engine.eventi.length; S.regInviati = APP.engine.registrazione.length;
      APP.engine.comando = APP.engine._comandoLocale || APP.engine.comando;   // il motore torna del trainer: i suoi ordini si applicano direttamente
      const c = await api("api/sess/comandi?ruolo=TRAINER&da=0"); S.comN = c && c.n || 0; const p = await api("api/sess/piani?ruolo=TRAINER"); S.pianiVer = (p && p.pianiVer) || { BLUE: 0, RED: 0 };
      document.body.classList.remove("rete-client"); if (S.faseHost && S.faseHost !== APP.fase) APP.vaiFase(S.faseHost);
      APP.play(false); if (eraInPlay) APP.play(true);   // il tempo riparte dal punto in cui era
      avviaHost(); aggiornaBadge(); toast("Sessione ripresa: sei di nuovo il TRAINER, la partita continua da dove era", 4000); return;
    }
    APP.sc = r.sc; APP.setRuolo(ruolo); document.body.classList.add("rete-client"); document.body.classList.remove("rete-host");
    APP.play(false); APP.ricostruisci(); fermaCicli(); await sincronizza(true);
    S.timer = setInterval(() => sincronizza(false), 650); aggiornaBadge();
    if (!ripresa) toast(`Collegato alla sessione ${S.id} come ${NOMI[ruolo]}. Il tempo e gli inject li gestisce il trainer.`, 6000);
  }
  function firmaSc(sc) { const c = Object.assign({}, sc, { piani: null }); const s = JSON.stringify(c); let h = 0; for (let i = 0; i < s.length; i += 3) h = (h * 31 + s.charCodeAt(i)) | 0; return s.length + ":" + h; }
  async function sincronizza(prima) {
    if (S.modo !== "multi" || (S.sincronizzando && !prima)) return; S.sincronizzando = true;   // una richiesta alla volta: niente eventi duplicati con la rete lenta
    try { await sincronizzaOra(prima); } finally { S.sincronizzando = false; }
  }
  async function sincronizzaOra(prima) {
    const eng = APP.engine;
    const r = await api(`api/sess/stato?ruolo=${S.ruolo}&id=${S.id}&partita=${S.partita}&ver=${S.ver}&ev=${S.evN}&reg=${S.regN}`);
    if (!r) { aggiornaBadge(false); return; }
    if (APP.engine !== eng) return;   // nel frattempo il motore è stato ricostruito: la risposta non vale più
    if (r.attiva === false || (r.id && r.id !== S.id)) return chiusaDalServer();
    aggiornaBadge(true);
    if (r.scVer && r.scVer !== S.scVer && !S.host) {   // lo scenario è cambiato (editor, meteo…): si ricarica, conservando il proprio piano
      const s2 = await api("api/sess/sc?ruolo=" + S.ruolo + "&lato=" + S.ruolo); S.scVer = r.scVer;
      if (s2 && s2.sc && firmaSc(s2.sc) !== S.scFirma) { const mio = APP.sc.piani[S.ruolo]; APP.sc = s2.sc; APP.sc.piani[S.ruolo] = mio || s2.sc.piani[S.ruolo]; S.scFirma = firmaSc(s2.sc); APP.ricostruisci(); return; }
    }
    if (r.uguale) return;
    if (r.partita !== S.partita || r.evDa === 0 && S.evN > 0) {   // nuova partita (il trainer ha ricominciato): si azzera il log
      eng.eventi = []; eng.registrazione = []; const lg = document.getElementById("log"); if (lg) lg.innerHTML = ""; S.evN = 0; S.regN = 0; APP._hlReset && APP._hlReset();
    }
    if (r.snap) applica(eng, r.snap);
    if (typeof r.evDa === "number" && r.evDa < eng.eventi.length) eng.eventi.length = r.evDa;   // mai eventi doppi
    if (typeof r.regDa === "number" && r.regDa < eng.registrazione.length) eng.registrazione.length = r.regDa;
    S.bulk = prima || (r.eventi || []).length > 25;   // al primo collegamento niente audio/cinematiche per gli eventi già passati
    (r.eventi || []).forEach(e => { eng.eventi.push(e); eng.emit({ tipo: "evento", e }); });
    S.bulk = false;
    (r.reg || []).forEach(x => eng.registrazione.push(x));
    S.partita = r.partita; S.ver = r.ver; S.evN = r.evN; S.regN = r.regN;
    const m = r.meta || {}; APP.statoRemoto(m);
    if (m.fase && m.fase !== S.faseHost) { const prima2 = S.faseHost; S.faseHost = m.fase;   // le squadre seguono il trainer quando avvia l'esecuzione o il debrief (anche se si collegano a missione iniziata)
      if (!S.host && S.ruolo !== "TRAINER" && (m.fase === "esecuzione" || m.fase === "debrief") && APP.fase !== m.fase) { APP.vaiFase(m.fase); if (prima2 !== null) toast(m.fase === "esecuzione" ? "▶ Il trainer ha avviato l'ESECUZIONE" : "Il trainer è passato al DEBRIEF", 5000); } }
    APP.refresh();
  }
  function pianoModificato() {   // la squadra è proprietaria del proprio piano: lo invia al trainer (solo se è davvero cambiato)
    if (!client()) return; clearTimeout(S.tPiano);
    S.tPiano = setTimeout(() => { const js = JSON.stringify(APP.sc.piani[S.ruolo] || null); if (js === S.pianoInviato) return; S.pianoInviato = js;
      api("api/sess/piano", { ruolo: S.ruolo, lato: S.ruolo, piano: APP.sc.piani[S.ruolo] }).then(r => { if (r && r.ok) toast("📡 Piano inviato al trainer", 1800); else S.pianoInviato = null; }); }, 500);
  }
  function chiusaDalServer() { if (S.modo !== "multi") return; const eraHost = S.host; esci(true); toast(eraHost ? "La sessione sul server non esiste più: continui su questa postazione" : "Il trainer ha chiuso la sessione: continui da solo su questo dispositivo con l'ultimo stato", 8000); }
  function fermaCicli() { clearInterval(S.timer); clearInterval(S.timer2); S.timer = S.timer2 = null; }
  function esci(silenzioso) {
    fermaCicli(); const eraHost = S.host; S.modo = "unica"; S.host = false; S.id = null; salvaSessione();
    document.body.classList.remove("rete-client", "rete-host"); aggiornaBadge();
    if (!eraHost && APP.engine) { APP.engine.comando = APP.engine._comandoLocale || APP.engine.comando; }   // da qui la postazione è autonoma
    if (!silenzioso) toast("Ora giochi su una postazione unica: puoi cambiare ruolo dal pulsante ⇄", 5000);
  }
  async function chiudiSessione() { await api("api/sess/chiudi", { ruolo: "TRAINER", token: S.token }); esci(true); toast("Sessione chiusa: continui su una postazione unica con la stessa partita", 5000); }

  /* ---------- POSTAZIONE UNICA: cambio ruolo con passaggio di consegne ---------- */
  function cambiaRuolo(r) {
    if (r === APP.ruolo) return;
    const pin = String((APP.sc.regole || {}).pin_trainer || "").trim();
    if (r === "TRAINER" && pin && prompt("PIN del trainer:") !== pin) return toast("PIN errato");
    if (r === "TRAINER") { APP.setRuolo("TRAINER"); return toast("Ruolo: TRAINER", 2000); }
    passaggio(r, () => APP.setRuolo(r));
  }
  function passaggio(r, poi) {   // schermata di passaggio: copre tutto finché la squadra non è davanti allo schermo
    let o = document.getElementById("passaggio"); if (!o) { o = document.createElement("div"); o.id = "passaggio"; document.body.appendChild(o); }
    o.className = "passaggio " + r.toLowerCase(); poi();
    o.innerHTML = `<div class="pass-box"><div class="pass-ico">${r === "BLUE" ? "✈" : "🛡"}</div><h2>Tocca alla SQUADRA ${r}</h2><p>Passate lo schermo alla squadra ${r}. Le informazioni dell'altra squadra restano nascoste.</p><button class="btn primary" id="pass-ok">Siamo la SQUADRA ${r}: mostra</button></div>`;
    o.querySelector("#pass-ok").onclick = () => o.remove();
  }

  /* ---------- menu ⇄ e badge ---------- */
  function menu() {
    const cur = document.getElementById("rete-pop"); if (cur) { cur.remove(); return; }
    const d = document.createElement("div"); d.id = "rete-pop"; d.className = "audio-pop rete-pop"; let h = "";
    if (S.modo === "unica") {
      h = `<b>Postazione unica</b><small>Cambia ruolo senza perdere la partita. Verso una squadra compare una schermata di passaggio.</small>
        <div class="row">${["TRAINER", "BLUE", "RED"].map(r => `<button class="btn small ${r === APP.ruolo ? "primary" : ""}" data-r="${r}" ${r === APP.ruolo ? "disabled" : ""}>${NOMI[r]}</button>`).join("")}</div>
        <hr><b>📡 Gioca a tre postazioni</b><small>Trainer su questo PC, BLUE e RED su altri dispositivi nella stessa rete. La partita attuale continua.</small>
        <div class="row"><button class="btn small gold" id="rp-crea">Crea la sessione (questo PC = TRAINER)</button><button class="btn small" id="rp-unisci">Unisciti a una sessione…</button></div>`;
    } else if (S.host) {
      const inf = S.info || {}; const pres = inf.presenze || {};
      h = `<b>📡 Sessione ${S.id} · sei il TRAINER</b><small>Sui dispositivi delle squadre apri:</small><div class="rp-url">${(inf.indirizzi || []).map(u => `<code>${u}</code>`).join("") || "<small>indirizzo non disponibile</small>"}</div>
        <div class="rp-pres">${["BLUE", "RED"].map(r => `<span class="${pres[r] != null && pres[r] < 6 ? "on" : ""}">${NOMI[r]} ${pres[r] != null && pres[r] < 6 ? "collegata" : "non collegata"}</span>`).join("")}</div>
        <div class="row"><button class="btn small" id="rp-chiudi">Chiudi la sessione e continua su una postazione</button></div>`;
    } else {
      h = `<b>📡 Sessione ${S.id} · ${NOMI[S.ruolo]}</b><small>Tempo, inject e scenario li gestisce il trainer. Il tuo piano e i tuoi ordini vengono inviati a lui.</small>
        <div class="row"><button class="btn small" id="rp-esci">Esci dalla sessione e gioca da solo</button></div>`;
    }
    h += `<div class="row"><button class="btn small" id="rp-home">⌂ Schermata iniziale</button></div>`;
    d.innerHTML = h; document.body.appendChild(d);
    const b = document.getElementById("btn-ruolo").getBoundingClientRect(); d.style.top = (b.bottom + 6) + "px"; d.style.right = Math.max(8, window.innerWidth - b.right) + "px";
    d.querySelectorAll("[data-r]").forEach(x => x.onclick = () => { d.remove(); cambiaRuolo(x.dataset.r); });
    const on = (id, fn) => { const e = d.querySelector(id); if (e) e.onclick = () => { d.remove(); fn(); }; };
    on("#rp-crea", creaSessione); on("#rp-unisci", () => apriSplash("multi")); on("#rp-chiudi", chiudiSessione); on("#rp-esci", () => esci(false));
    on("#rp-home", () => { APP.play(false); apriSplash(S.modo); });
    setTimeout(() => document.addEventListener("pointerdown", function h2(ev) { if (!d.contains(ev.target) && ev.target.id !== "btn-ruolo") { d.remove(); document.removeEventListener("pointerdown", h2); } }), 0);
  }
  function aggiornaBadge(online) {
    const b = document.getElementById("rete-badge"); if (!b) return;
    if (S.modo !== "multi") { b.className = "hidden"; return; }
    if (online !== undefined) S.online = online;
    const pres = (S.info && S.info.presenze) || {}; const on = r => pres[r] != null && pres[r] < 6;
    b.className = "rete-badge" + (S.online === false ? " off" : "");
    b.innerHTML = S.host ? `📡 ${S.id} <i class="${on("BLUE") ? "on" : ""}">BLUE</i><i class="${on("RED") ? "on" : ""}">RED</i>` : `📡 ${S.id} ${S.online === false ? "· non collegato" : "· collegato"}`;
    b.title = S.host ? "Sessione a più postazioni: squadre collegate" : "Collegato al trainer";
  }
  async function aggiornaInfo() { if (S.modo !== "multi") return; const i = await api("api/sess/info"); if (i) { S.info = i; if (S.host && i.attiva === false) return chiusaDalServer(); aggiornaBadge(true); } else aggiornaBadge(false); }

  /* ---------- schermata iniziale: scelta della modalità ---------- */
  async function renderSplashMulti() {
    const box = document.getElementById("splash-multi"); if (!box) return;
    box.innerHTML = "<small>Cerco il server locale…</small>"; const info = await api("api/sess/info");
    if (!info) { box.innerHTML = `<div class="sm-warn">Per giocare a più postazioni serve il server locale: avvia <b>AVVIA_SIMULATORE.bat</b> o <b>CENTURION.exe</b> sul PC del trainer e apri l'indirizzo che stampa. (Su una versione pubblicata su internet si gioca solo a postazione unica.)</div>`; return; }
    const url = (info.indirizzi || []).map(u => `<code>${u}</code>`).join(" ");
    if (!info.attiva) {
      box.innerHTML = `<div class="sm-step"><b>1 · Sul PC del trainer</b><button class="btn primary" id="sm-crea">🎓 Crea la sessione e entra come TRAINER</button></div>
        <div class="sm-step"><b>2 · Sui dispositivi delle squadre</b> (stessa rete Wi-Fi) apri ${url || "l'indirizzo di rete di questo PC"} e scegli la squadra.</div>`;
      box.querySelector("#sm-crea").onclick = async () => { entraApp(); await creaSessione(); };
      return;
    }
    const pres = info.presenze || {}; const on = r => pres[r] != null && pres[r] < 6;
    box.innerHTML = `<div class="sm-step"><b>Sessione ${info.id} attiva.</b> Scegli questa postazione:</div>
      <div class="splash-roles">${["BLUE", "RED", "TRAINER"].map(r => `<button class="role-btn ${r.toLowerCase()}" data-sm="${r}"><span class="big">${r === "TRAINER" ? "🎓" : r === "BLUE" ? "✈" : "🛡"}</span><b>${NOMI[r].replace(/^\S+ /, "")}</b><small>${on(r) ? "⚠ già collegata da un altro dispositivo" : r === "TRAINER" ? "riprendi la regia della sessione" : "entra con la tua squadra"}</small></button>`).join("")}</div>
      <div class="sm-step"><small>Altri dispositivi: ${url}</small></div>`;
    box.querySelectorAll("[data-sm]").forEach(b => b.onclick = async () => { entraApp(); await unisciti(b.dataset.sm); });
  }
  function entraApp() { document.getElementById("splash").classList.add("hidden"); document.getElementById("app").classList.remove("hidden"); setTimeout(() => { MAPPA.map.invalidateSize(); MAPPA.fitScenario(); APP.vaiFase(APP.fase || "briefing"); }, 50); }
  function apriSplash(modo) { document.getElementById("splash").classList.remove("hidden"); impostaModo(modo || "unica"); }
  function impostaModo(m) {
    document.querySelectorAll(".modo-btn").forEach(b => b.classList.toggle("active", b.dataset.modo === m));
    const multi = m === "multi"; document.querySelectorAll("#splash .splash-roles.unica, #splash .splash-links").forEach(e => e.classList.toggle("hidden", multi));
    const sm = document.getElementById("splash-multi"); if (sm) { sm.classList.toggle("hidden", !multi); if (multi) renderSplashMulti(); }
  }

  /* ---------- avvio ---------- */
  function init() {
    document.querySelectorAll(".modo-btn").forEach(b => b.onclick = () => impostaModo(b.dataset.modo));
    setInterval(aggiornaInfo, 3000);
    // ripresa automatica dopo un ricaricamento della pagina (stessa scheda)
    let s = null; try { s = JSON.parse(sessionStorage.getItem("centurion_rete") || "null"); } catch (e) {}
    if (s && s.modo === "multi" && s.ruolo) api("api/sess/info").then(i => { if (i && i.attiva && i.id === s.id) { S.token = s.token || null; entraApp(); unisciti(s.ruolo, true); } });
    // invito: http://ip:porta/?postazione=BLUE apre direttamente la scelta a tre postazioni
    const q = new URLSearchParams(location.search).get("postazione"); if (q) impostaModo("multi");
  }
  return { init, agganciaEngine, scModificato, pianoModificato, cambiaRuolo, menu, creaSessione, unisciti, esci, chiudiSessione, impostaModo,
    client, host, get attiva() { return S.modo === "multi"; }, get bulk() { return S.bulk; }, get stato() { return { modo: S.modo, ruolo: S.ruolo, host: S.host, id: S.id, ver: S.ver, evN: S.evN, partita: S.partita }; } };
})();
