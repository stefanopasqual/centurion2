/* =====================================================================
   APP – stato globale, ciclo di simulazione, navigazione
   ===================================================================== */
const APP = (() => {
  const $ = s => document.querySelector(s); const $$ = s => [...document.querySelectorAll(s)];
  const A = { sc: null, engine: null, ruolo: "TRAINER", fase: "briefing", sel: null, playing: false, speed: 15, timer: null, noteDebrief: "", vista3dAuto: true };

  function init() {
    A.sc = DATAIO.caricaLocale() || DATAIO.clone(SCENARIO_DEFAULT);
    // aggiorna campi mancanti rispetto al default (versioni precedenti)
    Object.keys(SCENARIO_DEFAULT).forEach(k => { if (A.sc[k] === undefined) A.sc[k] = DATAIO.clone(SCENARIO_DEFAULT[k]); });
    Object.keys(SCENARIO_DEFAULT.regole).forEach(k => { if (A.sc.regole[k] === undefined) A.sc.regole[k] = SCENARIO_DEFAULT.regole[k]; });
    MAPPA.init(A.sc); A.engine = new Engine(A.sc); A.engine.on(onEvento); if (typeof RETE !== "undefined") RETE.agganciaEngine(A.engine); A._firmaPiani = JSON.stringify(A.sc.piani);
    $$(".role-btn").forEach(b => b.onclick = () => { setRuolo(b.dataset.role); $("#splash").classList.add("hidden"); $("#app").classList.remove("hidden"); setTimeout(() => { MAPPA.map.invalidateSize(); MAPPA.fitScenario(); vaiFase("briefing"); }, 50); });
    $("#btn-demo-splash").onclick = () => { $("#splash").classList.add("hidden"); $("#app").classList.remove("hidden"); setTimeout(() => { MAPPA.map.invalidateSize(); MAPPA.fitScenario(); DEMO.avvia(); }, 50); };
    $("#btn-tour-splash").onclick = () => { setRuolo("TRAINER"); $("#splash").classList.add("hidden"); $("#app").classList.remove("hidden"); setTimeout(() => { MAPPA.map.invalidateSize(); MAPPA.fitScenario(); vaiFase("briefing"); UI.tour(0); }, 50); };
    $$("#fasi button").forEach(b => b.onclick = () => vaiFase(b.dataset.fase));
    // Free Flight: dalla schermata iniziale (senza scegliere un ruolo) e dalla barra in alto
    const apriVolo = () => { if (typeof VOLO !== "undefined") VOLO.apri(); };
    const bvs = $("#btn-volo-splash"); if (bvs) bvs.onclick = apriVolo; const bv = $("#btn-volo"); if (bv) bv.onclick = apriVolo;
    // catalogo missioni
    const apriMis = () => { if (typeof MISSIONI !== "undefined") MISSIONI.apriCatalogo(); }; const bms = $("#btn-missioni-splash"); if (bms) bms.onclick = apriMis; const bm = $("#btn-missioni"); if (bm) bm.onclick = apriMis;
    try { if (typeof AUDIO !== "undefined") { AUDIO.init(); AUDIO.badge(); const ba = $("#btn-audio"); if (ba) ba.onclick = () => AUDIO.pannello(); } } catch (e) { console.warn("audio non disponibile", e); }
    // app installabile (PWA): service worker per l'uso offline + pulsante "Installa" quando il browser lo permette
    if ("serviceWorker" in navigator && (location.protocol === "https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) { navigator.serviceWorker.register("sw.js").catch(e => console.warn("service worker", e)); }
    window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); A._installa = e; const b = $("#btn-installa"); if (b) { b.classList.remove("hidden"); b.onclick = () => { b.classList.add("hidden"); e.prompt(); }; } });
    // pannelli a scomparsa su schermi piccoli (tablet verticale, smartphone)
    const bp = $("#btn-pannello"), bl = $("#btn-log"); if (bp) bp.onclick = () => { $("#left").classList.toggle("open"); $("#right").classList.remove("open"); }; if (bl) bl.onclick = () => { $("#right").classList.toggle("open"); $("#left").classList.remove("open"); };
    $("#map").addEventListener("pointerdown", () => { $("#left").classList.remove("open"); $("#right").classList.remove("open"); });
    $("#btn-demo").onclick = () => DEMO.avvia(); $("#btn-tour").onclick = () => UI.tour(0); $("#btn-ruolo").onclick = () => { if (typeof RETE !== "undefined") RETE.menu(); else { play(false); $("#splash").classList.remove("hidden"); } };
    $("#tour-next").onclick = UI.tourNext; $("#tour-prev").onclick = UI.tourPrev; $("#tour-end").onclick = UI.tourEnd; $("#modal-close").onclick = UI.chiudiModal;
    const remoto = () => typeof RETE !== "undefined" && RETE.client();
    $("#btn-play").onclick = () => play(!A.playing); $("#btn-step").onclick = () => { if (remoto()) return UI.toast("Il tempo lo gestisce il trainer"); play(false); for (let i = 0; i < 60 / A.engine.tick_sec; i++) A.engine.tick(); refresh(); };
    $("#btn-reset").onclick = () => { if (remoto()) return UI.toast("Solo il trainer può ricominciare la partita"); play(false); DEMO.stop(); ricostruisci(); UI.toast("Simulazione riportata alle " + A.sc.tempo.inizio); };
    $("#speeds").innerHTML = A.sc.tempo.velocita.map(v => `<button data-v="${v}" class="${v === A.speed ? "active" : ""}">×${v}</button>`).join("");
    $$("#speeds button").forEach(b => b.onclick = () => setSpeed(+b.dataset.v));
    $("#sel-base").value = A.sc.mappa.tile_default; $("#sel-base").onchange = e => MAPPA.setBase(e.target.value);
    $("#chk-sectional").checked = A.sc.mappa.sectional.attivo; $("#chk-sectional").onchange = e => MAPPA.toggle("sectional", e.target.checked); $("#rng-sectional").oninput = e => MAPPA.setSectionalOpacity(+e.target.value);
    $("#chk-griglia").onchange = e => MAPPA.toggle("griglia", e.target.checked); $("#chk-trails").onchange = e => MAPPA.toggle("trails", e.target.checked); $("#chk-radar").onchange = e => MAPPA.radarRings(A.engine.vista(A.ruolo), e.target.checked);
    $("#btn-ruler").onclick = () => { const on = !$("#btn-ruler").classList.toggle("active"); MAPPA.rulerToggle(!on); UI.toast(!on ? "Righello attivo: clicca due o più punti sulla mappa" : "Righello disattivato"); };
    $("#btn-fit").onclick = () => MAPPA.fitScenario(); $("#log-filter").onchange = () => UI.log();
    document.addEventListener("keydown", e => { if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return; if (e.code === "Space") { e.preventDefault(); play(!A.playing); } if (e.key === "Escape") { UI.chiudiModal(); UI.tourEnd(); } });
    $("#clock-sub").textContent = `Finestra ${A.sc.tempo.inizio} – ${A.sc.tempo.fine}`;
    DATAIO.serverDisponibile().then(ok => { $("#status-msg").textContent = ok ? "Server locale attivo: salvataggi in data/salvataggi" : "Modalità file: salvataggi nel browser + download"; if (typeof VISTA3D !== "undefined") VISTA3D.setProxyTile(ok); });
    refresh();
    if (typeof RETE !== "undefined") RETE.init();
  }
  function setRuolo(r) { A.ruolo = r; const b = $("#role-badge"); b.textContent = r === "TRAINER" ? "TRAINER" : "SQUADRA " + r; b.className = r; if (A.fase) vaiFase(A.fase); }
  function vaiFase(f) {
    if (f === "esecuzione" && A.fase !== "esecuzione") applicaPianiNuovi();
    A.fase = f; $$("#fasi button").forEach(b => { b.classList.toggle("active", b.dataset.fase === f); });
    const ord = ["briefing", "piano", "esecuzione", "debrief"]; $$("#fasi button").forEach(b => b.classList.toggle("done", ord.indexOf(b.dataset.fase) !== -1 && ord.indexOf(b.dataset.fase) < ord.indexOf(f)));
    $("#left").classList.remove("wide"); UI.tourEnd();
    if (f !== "esecuzione" && f !== "debrief") { play(false); }
    ({ briefing: UI.briefing, piano: UI.piano, esecuzione: UI.esecuzione, debrief: UI.debrief, editor: UI.editor })[f]();
    if (f === "esecuzione" || f === "debrief") { MAPPA.disegnaSam(A.engine.vista(A.ruolo).sam, false); } else if (f === "briefing" || f === "editor") { UI.aggiornaRotteMappa(); MAPPA.disegnaRotte([]); }
    setTimeout(() => MAPPA.map.invalidateSize(), 30);
  }
  function salva() {
    // postazione squadra in una sessione a più postazioni: il proprio piano va al trainer, lo scenario locale non si salva (è del trainer)
    if (typeof RETE !== "undefined" && RETE.client()) { RETE.pianoModificato(); return; }
    DATAIO.salvaLocale(A.sc); if (typeof RETE !== "undefined") RETE.scModificato();
  }
  function ricostruisci() {
    play(false); salva(); MAPPA.reDraw(A.sc); MAPPA.pulisciDinamici(); A.engine = new Engine(A.sc); A.engine.on(onEvento); if (typeof RETE !== "undefined") RETE.agganciaEngine(A.engine); A.sel = null; A._hlOfferto = false; A._firmaPiani = JSON.stringify(A.sc.piani); A._avvisoPiani = false;
    $("#clock-sub").textContent = `Finestra ${A.sc.tempo.inizio} – ${A.sc.tempo.fine}`; $("#log").innerHTML = ""; refresh(); if (A.fase) vaiFase(A.fase);
  }
  // il piano modificato nella fase Piano arriva al motore senza dover premere ⟲: se la missione non è ancora partita si riparte col piano nuovo
  function applicaPianiNuovi() {
    if ((typeof RETE !== "undefined" && RETE.client()) || !A.engine || JSON.stringify(A.sc.piani) === A._firmaPiani) return false;
    if (A.engine.t <= Engine.hm2s(A.sc.tempo.inizio)) { const f = A.fase; A.fase = null; ricostruisci(); A.fase = f; UI.toast("Piano aggiornato: la simulazione usa il piano appena modificato", 3500); return true; }
    if (!A._avvisoPiani) { A._avvisoPiani = true; UI.toast(`Hai modificato il piano a missione iniziata: premi ⟲ per applicarlo ripartendo dalle ${A.sc.tempo.inizio}`, 7000); }
    return false;
  }
  function setSpeed(v) { A.speed = v; $$("#speeds button").forEach(b => b.classList.toggle("active", +b.dataset.v === v)); if (A.playing) { play(false); play(true); } }
  function statoRemoto(m) {   // postazione squadra: play/velocità mostrati come sul PC del trainer (servono anche alla vista 3D)
    A.playing = !!m.playing; if (m.speed) A.speed = m.speed;
    $("#btn-play").textContent = A.playing ? "⏸" : "▶"; $("#btn-play").classList.toggle("playing", A.playing); $$("#speeds button").forEach(b => b.classList.toggle("active", +b.dataset.v === A.speed));
  }
  function play(on) {
    if (typeof RETE !== "undefined" && RETE.client()) { if (on) UI.toast("Il tempo lo gestisce il trainer: la simulazione parte dal suo PC"); return; }
    if (on) applicaPianiNuovi();
    if (on && A.engine.finita) { UI.toast("La finestra operativa è finita: premi ⟲ per ricominciare o vai al Debrief"); on = false; }
    A.playing = on; $("#btn-play").textContent = on ? "⏸" : "▶"; $("#btn-play").classList.toggle("playing", on); clearInterval(A.timer); A.timer = null;
    if (on) { const tps = A.speed / A.engine.tick_sec; const intervallo = Math.max(16, 1000 / tps); const perInt = Math.max(1, Math.round(tps * intervallo / 1000)); let k = 0;
      A.timer = setInterval(() => { for (let i = 0; i < perInt; i++) A.engine.tick(); if (++k % 2 === 0 || A.speed <= 5) refresh(); if (A.engine.finita) play(false); }, intervallo); }
  }
  function refresh() {
    const eng = A.engine; $("#clock").textContent = Engine.s2hms(eng.t);
    const vista = eng.vista(A.ruolo); MAPPA.aggiornaFlights(vista, A.sel, id => { A.sel = id; UI.aggiornaEsecuzione(); });
    if (A.fase === "esecuzione") { MAPPA.disegnaSam(vista.sam, false); UI.aggiornaEsecuzione(); if ($("#chk-radar").checked) MAPPA.radarRings(vista, true); }
    MAPPA.aggiornaTarget(eng.target); UI.score();
  }
  function apriVista3d(v, opts) {
    const o = VISTA3D.daEvento(A.sc, A.engine, v); if (!o) return;
    // a più postazioni la cinematica non ferma la partita degli altri
    const multi = typeof RETE !== "undefined" && RETE.attiva; const eraInPlay = A.playing; if (!multi) play(false);
    Object.assign(o, opts || {}); o.onFine = () => { if (!multi && eraInPlay && !A.engine.finita) play(true); if (opts && opts.onFine) opts.onFine(); };
    VISTA3D.apri(o);
  }
  function onEvento(ev) { if (ev.tipo !== "evento") return; UI.log(ev.e);
    if (typeof RETE !== "undefined" && RETE.bulk) return;   // eventi già passati ricevuti al collegamento: solo nel log, senza audio né cinematiche
    // audio delle comunicazioni (anche in demo); PICKLE/SHACK/OFF della formazione mostrata nella cinematica 3D sono già stati detti lì
    const cinem = A._v3dAttacco && ev.e.chi === A._v3dAttacco && /^(PICKLE|SHACK|OFF target)/.test(ev.e.testo); if (cinem && /^OFF target/.test(ev.e.testo)) A._v3dAttacco = null;
    if (typeof AUDIO !== "undefined" && !cinem) { try { AUDIO.evento(ev.e); } catch (e) {} }
    if (ev.e.v3d && /IN – attacco/.test(ev.e.testo) && A.vista3dAuto && A.ruolo !== "RED" && !VISTA3D.attiva && !DEMO.attiva) { A._v3dAttacco = ev.e.chi; setTimeout(() => apriVista3d(ev.e.v3d), 0); }
    if (/Tutte le formazioni BLUE hanno concluso|Fine della finestra operativa/.test(ev.e.testo) && !A._hlOfferto) { A._hlOfferto = true; const t = document.createElement("div"); t.className = "toast big"; t.style.pointerEvents = "auto"; t.innerHTML = `<b>Missione conclusa.</b> <button class="btn small primary" id="toast-hl">🏆 Vedi gli HIGHLIGHTS</button> <button class="btn small" id="toast-deb">Debrief</button>`; document.getElementById("toast-area").appendChild(t); t.querySelector("#toast-hl").onclick = () => { t.remove(); play(false); HIGHLIGHTS.apri(A.ruolo === "RED" ? "RED" : "BLUE"); }; t.querySelector("#toast-deb").onclick = () => { t.remove(); vaiFase("debrief"); }; setTimeout(() => t.remove(), 60000); } if (ev.e.tipo === "ingaggio" && ev.e.ingaggio) { const i = A.engine.ingaggi.find(x => x.id === ev.e.ingaggio); if (i && !i._flash) { i._flash = true; MAPPA.flashIngaggio(i.lat, i.lon, "MERGE"); } } if (ev.e.tipo === "kill" && /SAM LAUNCH|SHACK/.test(ev.e.testo)) { const f = A.engine.flights.find(x => x.callsign === ev.e.chi) || A.engine.sam.find(x => x.nome === ev.e.chi); if (f) MAPPA.flashIngaggio(f.lat, f.lon, ev.e.testo.split("–")[0].slice(0, 28)); } }
  async function salvaPiano() {
    const nome = prompt("Nome del piano (es. BLUE_squadra1):", "piano_" + (A.ruolo === "TRAINER" ? "completo" : A.ruolo) + "_" + new Date().toISOString().slice(5, 16).replace(/[:T]/g, "-")); if (!nome) return;
    salva(); const ok = await DATAIO.serverSalva(nome, { piani: A.sc.piani, meta: A.sc.meta }); if (!ok) DATAIO.downloadJSON({ piani: A.sc.piani, meta: A.sc.meta }, nome + ".json"); UI.toast(ok ? `Piano salvato sul server come ${nome}` : "Server assente: piano scaricato come file JSON");
  }
  async function caricaPiano() {
    const lista = await DATAIO.serverLista();
    const html = `<p>Dal server locale:</p>${lista.length ? `<ul class="clean">${lista.map(n => `<li><a href="#" data-n="${n}">${n}</a></li>`).join("")}</ul>` : "<small>nessun salvataggio (o server non attivo)</small>"}<p>Oppure da file: <input type="file" id="pl-file" accept=".json,.xlsx"></p>`;
    UI.modal("Carica piano", html);
    $$("#modal-body a[data-n]").forEach(a => a.onclick = async e => { e.preventDefault(); const o = await DATAIO.serverCarica(a.dataset.n); if (o && o.piani) { A.sc.piani = o.piani; } else if (o && o.scenario) { A.sc = o.scenario; } UI.chiudiModal(); ricostruisci(); UI.toast("Piano caricato: " + a.dataset.n); });
    $("#pl-file").onchange = () => { const f = $("#pl-file").files[0]; const r = new FileReader(); if (f.name.endsWith(".json")) { r.onload = () => { const o = JSON.parse(r.result); if (o.piani) A.sc.piani = o.piani; else if (o.scenario) A.sc = o.scenario; else A.sc = o; UI.chiudiModal(); ricostruisci(); }; r.readAsText(f); } else { r.onload = () => { const res = DATAIO.importExcel(new Uint8Array(r.result), A.sc); A.sc = res.sc; UI.chiudiModal(); ricostruisci(); UI.toast("Importato: " + res.log.join(", ")); }; r.readAsArrayBuffer(f); } };
  }
  window.addEventListener("DOMContentLoaded", init);
  return { get sc() { return A.sc; }, set sc(v) { A.sc = v; }, get engine() { return A.engine; }, get ruolo() { return A.ruolo; }, get fase() { return A.fase; }, get sel() { return A.sel; }, set sel(v) { A.sel = v; }, get noteDebrief() { return A.noteDebrief; }, set noteDebrief(v) { A.noteDebrief = v; }, get speed() { return A.speed; }, get playing() { return A.playing; }, get vista3dAuto() { return A.vista3dAuto; }, set vista3dAuto(v) { A.vista3dAuto = v; }, get meteoNoaa() { return A.meteoNoaa; }, set meteoNoaa(v) { A.meteoNoaa = v; }, apriVista3d, setRuolo, vaiFase, salva, ricostruisci, setSpeed, play, refresh, salvaPiano, caricaPiano, statoRemoto, _hlReset: () => { A._hlOfferto = false; } };
})();
/*
  AUDIO – avvisi sonori e annunci vocali durante la simulazione.
  - Radio: clip neurali pre-generate (tools/genera_audio.py → app/audio/manifest.json), una frase per callsign × chiamata,
    con squelch prima/dopo; se la clip non esiste (callsign personalizzato) si usa la sintesi vocale del browser.
  - Avvisi: suoni sintetizzati con Web Audio (RWR missile, master caution, splash, perdita, shack, inject).
  - Annunci: voce italiana per eventi di sistema e inject.
  Filtro per squadra: il TRAINER sente tutto; una squadra sente la propria radio, i kill che la riguardano e i SAM.
  Preferenze in localStorage (centurion_audio).
*/
const AUDIO = (() => {
  const pref = Object.assign({ on: true, radio: true, avvisi: true, annunci: true, vol: 0.8 }, JSON.parse(localStorage.getItem("centurion_audio") || "{}"));
  let ctx = null, man = null, coda = [], playing = false, ultimo = {}, base = "";
  const salva = () => localStorage.setItem("centurion_audio", JSON.stringify(pref));

  function init() {
    if (!man) fetch(base + "audio/manifest.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(m => { man = m || { radio: {}, ann: {} }; }).catch(() => { man = { radio: {}, ann: {} }; });
    const sblocca = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ctx && ctx.state === "suspended") ctx.resume(); };
    ["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, sblocca, { passive: true }));
  }

  /* ---------- suoni sintetizzati ---------- */
  function tono(f, t0, dur, tipo, vol, f1) {
    if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = tipo || "square"; o.frequency.setValueAtTime(f, t0); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol * pref.vol, t0 + 0.01); g.gain.setValueAtTime(vol * pref.vol, t0 + dur - 0.03); g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function rumore(t0, dur, vol, hp) {
    if (!ctx) return; const n = Math.floor(ctx.sampleRate * dur); const b = ctx.createBuffer(1, n, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = hp ? "bandpass" : "lowpass"; f.frequency.value = hp ? 1800 : 180; f.Q.value = hp ? 0.8 : 0.7;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol * pref.vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur); s.connect(f); f.connect(g); g.connect(ctx.destination); s.start(t0); s.stop(t0 + dur);
  }
  const SUONI = {
    squelch: () => { const t = ctx.currentTime; rumore(t, 0.07, 0.25, true); },
    rwr: () => { const t = ctx.currentTime; for (let i = 0; i < 8; i++) tono(i % 2 ? 1800 : 1250, t + i * 0.13, 0.09, "square", 0.08); },           // allarme missile (RWR)
    caution: () => { const t = ctx.currentTime; for (let i = 0; i < 4; i++) tono(i % 2 ? 1100 : 820, t + i * 0.16, 0.13, "triangle", 0.12); },      // master caution
    splash: () => { const t = ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => tono(f, t + i * 0.09, 0.22, "triangle", 0.12)); },
    perdita: () => { const t = ctx.currentTime; [440, 370, 311, 262].forEach((f, i) => tono(f, t + i * 0.16, 0.3, "sawtooth", 0.06)); },
    boom: () => { const t = ctx.currentTime; rumore(t, 1.4, 0.7, false); tono(70, t, 0.9, "sine", 0.35, 35); },
    inject: () => { const t = ctx.currentTime; for (let i = 0; i < 3; i++) tono(600, t + i * 0.35, 0.28, "sawtooth", 0.07, 900); },
    chime: () => { const t = ctx.currentTime; tono(988, t, 0.09, "sine", 0.08); tono(1319, t + 0.1, 0.14, "sine", 0.08); },
  };
  function suono(nome) { if (!pref.on || !pref.avvisi || !ctx) return; const f = SUONI[nome]; if (f) f(); }

  /* ---------- voce: clip pre-generate o sintesi del browser ---------- */
  function clip(url) { return new Promise(res => { const a = new Audio(base + url); a.volume = pref.vol; a.onended = res; a.onerror = res; a.play().catch(res); }); }
  function tts(testo, lingua) {
    return new Promise(res => {
      if (!window.speechSynthesis) return res(); const u = new SpeechSynthesisUtterance(testo); u.lang = lingua; u.rate = 1.05; u.volume = pref.vol;
      const vs = speechSynthesis.getVoices().filter(v => v.lang.replace("_", "-").toLowerCase().startsWith(lingua.slice(0, 2)));
      const pref_ = vs.find(v => /natural|online|neural/i.test(v.name)) || vs.find(v => /guy|mark|david|christopher|ryan|giuseppe|diego/i.test(v.name)) || vs[0]; if (pref_) u.voice = pref_;
      u.onend = res; u.onerror = res; speechSynthesis.speak(u); setTimeout(res, 8000);
    });
  }
  function accoda(item) {
    if (!pref.on) return; const k = item.key || item.testo; const now = performance.now();
    if (ultimo[k] && now - ultimo[k] < 4000) return; ultimo[k] = now;   // niente doppioni ravvicinati
    coda.push(Object.assign({ t: now }, item)); if (coda.length > 4) coda.shift(); if (!playing) prossimo();
  }
  async function prossimo() {
    const it = coda.shift(); if (!it) { playing = false; return; } playing = true;
    if (performance.now() - it.t > 12000) return prossimo();   // messaggio troppo vecchio (velocità alta): salta
    try {
      if (it.radio) {
        if (ctx) SUONI.squelch(); await new Promise(r => setTimeout(r, 90));
        const url = man && man.radio[it.key]; if (url) await clip(url); else await tts(it.testo, "en-US");
        if (ctx) SUONI.squelch();
      } else { const url = man && man.ann[it.key]; if (url) await clip(url); else await tts(it.testo, "it-IT"); }
    } catch (e) {}
    setTimeout(prossimo, 250);
  }
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  function radio(callsign, key, testoFallback, lato) { if (!pref.radio) return; accoda({ radio: true, key: slug(callsign) + "__" + key, testo: testoFallback, lato }); }
  function annuncio(key, testo) { if (!pref.annunci) return; accoda({ radio: false, key, testo }); }

  /* ---------- mappa evento del motore → suono + chiamata ---------- */
  function evento(e) {
    if (!pref.on) return; const eng = APP.engine; const ruolo = APP.ruolo; const t = e.testo || ""; const chi = e.chi || "";
    const f = eng.flights.find(x => x.callsign === chi); const sam = eng.sam.find(x => x.nome === chi);
    const latoEv = f ? f.lato : sam ? "RED" : null; const mio = ruolo === "TRAINER" ? null : ruolo;
    const sente = l => !mio || !l || l === mio;   // la squadra sente solo la propria radio
    const cs = chi; const m = (re) => re.exec(t);
    if (chi === "SIM") { if (/Simulazione pronta/.test(t)) annuncio("sim_pronta", "Simulazione pronta."); else if (/Fine della finestra/.test(t)) { suono("caution"); annuncio("fine_finestra", "Fine della finestra operativa. Andate al debrief."); } else if (/Tutte le formazioni BLUE/.test(t)) annuncio("blue_concluso", "Tutte le formazioni BLUE hanno concluso la missione."); return; }
    if (chi === "INJECT") { suono("inject"); const inj = (APP.sc.inject || []).find(i => t.startsWith(i.nome)); const fine = / rientrato$/.test(t); annuncio(inj ? "inject_" + (fine ? "fine_" : "") + slug(inj.id) : (fine ? "inject_rientrato" : "inject_generico"), fine ? "Inject rientrato: " + t : "Inject: " + t); return; }
    if (sam) {
      if (/^SAM LAUNCH su /.test(t)) { const b = m(/^SAM LAUNCH su (.+?) \(/); const bersaglio = b && eng.flights.find(x => x.callsign === b[1]);
        if (!mio || mio === "RED" || (bersaglio && bersaglio.lato === mio)) { suono("rwr"); if (mio === "BLUE") { if (pref.radio) accoda({ radio: true, key: "_sam_launch", testo: "SAM launch! SAM launch! Break!" }); } else radio(cs, "launch", cs + ", missile launch!", "RED"); } return; }
      if (!sente("RED")) return;
      if (/^Inizia lo spostamento/.test(t)) radio(cs, "moving", cs + ", relocating.", "RED"); else if (/^In posizione/.test(t)) radio(cs, "position", cs + ", in position.", "RED"); else if (/^Missili esauriti/.test(t)) radio(cs, "empty", cs + ", missiles expended.", "RED"); return; }
    if (chi === "INGAGGIO") return;
    if (!f) return;
    const L = f.lato; const own = sente(L); const avversario = mio && L !== mio;
    const call = (key, fallback, s) => { if (own) { if (s) suono(s); radio(cs, key, cs + ", " + fallback, L); } };
    if (/^AIRBORNE/.test(t)) call("airborne", "airborne.", "chime");
    else if (/^PUSH/.test(t)) call("push", "push.");
    else if (/^FENCE IN/.test(t)) call("fence_in", "fence in.");
    else if (/^RETARGET/.test(t)) call("tasking", "copy, second target.", "chime");
    else if (/^FENCE OUT/.test(t)) call("fence_out", "fence out.");
    else if (/^COMMIT/.test(t)) call("commit", "commit.", "chime");
    else if (/^MERGED/.test(t)) { if (own) { suono("rwr"); radio(cs, /FOX 3/.test(t) ? "fox3" : "defensive", cs + (/FOX 3/.test(t) ? ", merged, Fox three!" : ", merged, defensive!"), L); } else if (avversario) suono("rwr"); }
    else if (/^Ingaggio con/.test(t)) { if (own) { suono("rwr"); radio(cs, /lancio/.test(t) ? "fox3" : "defensive", cs + (/lancio/.test(t) ? ", engaged, Fox three!" : ", merged, defensive!"), L); } }
    else if (/^SPLASH (\d)/.test(t)) { const k = Math.min(4, +m(/^SPLASH (\d)/)[1]); if (own) { suono("splash"); radio(cs, "splash" + k, cs + ", splash " + k + ".", L); } else if (avversario) suono("perdita"); }
    else if (/^Formazione persa/.test(t)) { if (own) { suono("perdita"); radio(cs, "lost", "Mayday, " + cs + " is down.", L); } }
    else if (/^-(\d) velivoli/.test(t)) { const k = Math.min(3, +m(/^-(\d)/)[1]); if (own) { suono("perdita"); radio(cs, "down" + k, cs + ", " + k + " down.", L); } }
    else if (/^WINCHESTER/.test(t)) call("winchester", "winchester.", "caution");
    else if (/^BINGO/.test(t)) call("bingo", "bingo fuel, RTB.", "caution");
    else if (/→ RTB/.test(t)) call("rtb", "RTB.");
    else if (/^Al tanker/.test(t)) call("tanker", "joining the tanker.");
    else if (/^Rifornimento in volo iniziato/.test(t)) call("refuel", "contact, taking fuel.");
    else if (/^AAR completato/.test(t)) call("aar_done", "refuel complete.");
    else if (/^Holding/.test(t)) call("holding", "holding at the gate.");
    else if (/^IN – attacco/.test(t)) call("in_hot", "in hot.", "chime");
    else if (/^SHACK/.test(t)) { if (own || mio === "RED") { suono("boom"); if (own) radio(cs, "shack", cs + ", shack! Target destroyed.", L); } }
    else if (/^PICKLE/.test(t)) { if (own) radio(cs, "pickle", cs + ", pickle.", L); else if (avversario) suono("boom"); }
    else if (/^OFF target/.test(t)) call("off", "off target, egress.");
    else if (/^ON STATION/.test(t)) call("on_station", "on station.");
    else if (/^Fine CAP/.test(t)) call("off_station", "off station.");
    else if (/^SCRAMBLE/.test(t)) call("scramble", "scramble, scramble, scramble!", "caution");
    else if (/^ESCORT/.test(t)) call("escort", "escort, engaging.", "chime");
    else if (/MAGNUM/.test(t)) call("magnum", "magnum.");
    else if (/^Atterrato/.test(t)) call("landed", "landed.");
    else if (/^Turnaround completato/.test(t)) call("ready", "ready.");
    else if (/^Fine intercettazione/.test(t)) call("disengage", "disengaged.");
    else if (/senza bombe/.test(t)) call("no_bombs", "no bombs, egress.", "caution");
    else if (/^Base .* chiusa|^Base chiusa/.test(t)) call("closed", "airfield closed, holding.", "caution");
    else if (/^Tanker .* non disponibile/.test(t)) call("divert", "tanker unavailable, diverting.", "caution");
    else if (/^Ordine: nuovo target/.test(t)) call("tasking", "copy, new target.", "chime");
    else if (/^Ordine:/.test(t)) call("tasking", "copy, new tasking.", "chime");
  }

  /* ---------- pannello preferenze ---------- */
  function pannello() {
    const cur = document.getElementById("audio-pop"); if (cur) { cur.remove(); return; }
    const d = document.createElement("div"); d.id = "audio-pop"; d.className = "audio-pop";
    d.innerHTML = `<b>🔊 Audio della simulazione</b>
      <label><input type="checkbox" id="au-on" ${pref.on ? "checked" : ""}> Audio attivo</label>
      <label><input type="checkbox" id="au-radio" ${pref.radio ? "checked" : ""}> Radio dei piloti (chiamate in inglese)</label>
      <label><input type="checkbox" id="au-avvisi" ${pref.avvisi ? "checked" : ""}> Avvisi sonori (RWR, caution, splash…)</label>
      <label><input type="checkbox" id="au-ann" ${pref.annunci ? "checked" : ""}> Annunci in italiano (sistema, inject)</label>
      <label>Volume <input type="range" id="au-vol" min="0" max="1" step="0.05" value="${pref.vol}"></label>
      <div class="row"><button class="btn small" id="au-test">▶ Prova</button><small>${man && Object.keys(man.radio).length ? Object.keys(man.radio).length + " clip radio pronte" : "clip radio assenti: python tools/genera_audio.py"}</small></div>`;
    document.body.appendChild(d);
    const b = document.getElementById("btn-audio").getBoundingClientRect(); d.style.top = (b.bottom + 6) + "px"; d.style.right = Math.max(8, window.innerWidth - b.right) + "px";
    d.querySelector("#au-on").onchange = e => { pref.on = e.target.checked; salva(); badge(); }; d.querySelector("#au-radio").onchange = e => { pref.radio = e.target.checked; salva(); };
    d.querySelector("#au-avvisi").onchange = e => { pref.avvisi = e.target.checked; salva(); }; d.querySelector("#au-ann").onchange = e => { pref.annunci = e.target.checked; salva(); };
    d.querySelector("#au-vol").oninput = e => { pref.vol = +e.target.value; salva(); };
    d.querySelector("#au-test").onclick = () => { const f = APP.engine.flights[0]; suono("rwr"); radio(f ? f.callsign : "TITAN", "fox3", (f ? f.callsign : "Titan") + ", merged, Fox three!", f ? f.lato : "BLUE"); };
    setTimeout(() => document.addEventListener("pointerdown", function h(ev) { if (!d.contains(ev.target) && ev.target.id !== "btn-audio") { d.remove(); document.removeEventListener("pointerdown", h); } }), 0);
  }
  function badge() { const b = document.getElementById("btn-audio"); if (b) b.textContent = pref.on ? "🔊 Audio" : "🔇 Audio"; }
  return { init, evento, suono, radio, annuncio, pannello, badge, get pref() { return pref; }, get pronte() { return man && Object.keys(man.radio).length; } };
})();
/* =====================================================================
   IMPORT / EXPORT DATI – Excel (SheetJS), JSON, server locale, localStorage
   Il formato Excel è lo stesso generato da tools/genera_excel.py
   ===================================================================== */
const DATAIO = (() => {
  const clone = o => JSON.parse(JSON.stringify(o));
  const num = v => (v === "" || v == null || isNaN(+v)) ? v : +v;
  const splitList = v => (v == null || v === "") ? [] : String(v).split(/\s*\|\s*|\r?\n/).map(s => s.trim()).filter(Boolean);

  /* ---------- scenario → fogli Excel ---------- */
  function toSheets(sc) {
    const S = {};
    S["Info"] = [["Chiave", "Valore"], ...Object.entries(sc.meta).map(([k, v]) => [k, v]), ["inizio", sc.tempo.inizio], ["fine", sc.tempo.fine], ["tick_sec", sc.tempo.tick_sec]];
    S["Regole"] = [["Parametro", "Valore", "Descrizione"], ...Object.entries(sc.regole).map(([k, v]) => [k, v, DESCR_REGOLE[k] || ""])];
    S["Meteo"] = [["Parametro", "Valore"], ...Object.entries(sc.meteo).map(([k, v]) => [k, v])];
    const tcols = ["id", "nome", "lato", "icona", "categoria", "gen", "stealth", "tas_crociera_kt", "tas_max_kt", "tas_attacco_kt", "quota_ft", "roc_fpm", "bank_nav", "bank_tatt", "g_max", "autonomia_min", "consumo_lbh", "carburante_lb", "radar_nm", "missili_nm", "prontezza_min", "AMRAAM", "GBU48", "ADDER", "HARM", "S300", "pro", "contro"];
    S["Velivoli"] = [tcols, ...Object.entries(sc.tipi).map(([id, t]) => tcols.map(c => c === "id" ? id : ["AMRAAM", "GBU48", "ADDER", "HARM", "S300"].includes(c) ? ((t.armi || {})[c] ?? "") : (t[c] ?? "")))];
    const att = Object.keys(sc.kill_ratio), def = [...new Set(att.flatMap(a => Object.keys(sc.kill_ratio[a])))];
    S["KRO_KillRatio"] = [["attaccante \\ difensore", ...def], ...att.map(a => [a, ...def.map(d => sc.kill_ratio[a][d] ?? "")])];
    const attB = Object.keys(sc.kill_ratio_con_bombe), defB = [...new Set(attB.flatMap(a => Object.keys(sc.kill_ratio_con_bombe[a])))];
    S["KRO_ConBombe"] = [["attaccante \\ difensore", ...defB], ...attB.map(a => [a, ...defB.map(d => sc.kill_ratio_con_bombe[a][d] ?? "")])];
    S["Formazioni"] = [["id", "callsign", "lato", "tipo", "numero", "base", "ruolo"], ...sc.formazioni.map(f => [f.id, f.callsign, f.lato, f.tipo, f.numero, f.base, f.ruolo])];
    S["Basi"] = [["id", "nome", "lato", "lat", "lon", "nazione", "pista_ft"], ...sc.basi.map(b => [b.id, b.nome, b.lato, b.lat, b.lon, b.nazione, b.pista_ft])];
    S["Target"] = [["id", "nome", "lat", "lon", "gbu_richieste", "descrizione", "categoria", "sam_collegato", "finestra_da", "finestra_a", "gruppo"], ...sc.target.map(t => [t.id, t.nome, t.lat, t.lon, t.gbu_richieste, t.descrizione, t.categoria || "", t.sam || "", t.finestra ? t.finestra.da : "", t.finestra ? t.finestra.a : "", t.gruppo || ""])];
    // obiettivi di missione (liste separate da ; )
    S["Obiettivi"] = [["tipo", "testo", "primario", "target", "minimo", "entro", "massimo", "sam", "formazioni", "perdite_max"], ...(sc.obiettivi || []).map(o => [o.tipo, o.testo, o.primario === false ? 0 : 1, (o.target || []).join(";"), o.minimo ?? "", o.entro || "", o.massimo ?? "", (o.sam || []).join(";"), (o.formazioni || []).join(";"), o.perdite_max ?? ""])];
    S["AAR"] = [["id", "nome", "lat", "lon", "quota_ft", "orient", "lunghezza_nm"], ...sc.aar.map(a => [a.id, a.nome, a.lat, a.lon, a.quota_ft, a.orient, a.lunghezza_nm])];
    S["Orbite"] = [["id", "nome", "tipo", "lat", "lon", "quota_ft"], ...sc.orbite.map(o => [o.id, o.nome, o.tipo, o.lat, o.lon, o.quota_ft])];
    S["Gate"] = [["id", "nome", "lat", "lon"], ...sc.gate.map(g => [g.id, g.nome, g.lat, g.lon])];
    S["CAP"] = [["id", "nome", "lato", "lat", "lon", "raggio_nm"], ...sc.cap_box.map(c => [c.id, c.nome, c.lato, c.lat, c.lon, c.raggio_nm])];
    S["SAM"] = [["id", "nome", "lat", "lon", "missili", "raggio_nm"], ...sc.sam.map(s => [s.id, s.nome, s.lat, s.lon, s.missili, s.raggio_nm])];
    const bri = lato => { const b = sc.briefing[lato]; return [["Campo", "Testo (liste separate da | )"], ["titolo", b.titolo], ["situazione", b.situazione], ["task", b.task.join(" | ")], ["threat", b.threat], ["intel", b.intel.join(" | ")], ["roe", b.roe.join(" | ")], ["da_sapere", b.da_sapere.join(" | ")], ["output_plan", b.output_plan.join(" | ")]]; };
    S["Briefing_BLUE"] = bri("BLUE"); S["Briefing_RED"] = bri("RED");
    S["Squadre"] = [["lato", "squadra", "nazione", "ruolo_squadra", "colore", "membro_nome", "membro_ruolo"], ...["BLUE", "RED"].flatMap(l => sc.squadre[l].membri.map((m, i) => [l, sc.squadre[l].nome, sc.squadre[l].nazione, sc.squadre[l].ruolo, sc.squadre[l].colore, m.nome, m.ruolo]))];
    S["Inject"] = [["id", "nome", "descrizione", "attivo"], ...sc.inject.map(i => [i.id, i.nome, i.descrizione, i.attivo ? 1 : 0])];
    S["Agenda"] = [["ora", "durata_min", "fase"], ...sc.agenda.map(a => [a.ora, a.durata, a.fase])];
    const pB = sc.piani.BLUE || { formazioni: {} };
    S["Piano_BLUE"] = [["formazione", "decollo", "tanker", "aar_ordine", "gate_in", "push", "target", "target2", "cap", "cap_min", "stazione_lat", "stazione_lon", "gate_out", "decollo2"], ...sc.formazioni.filter(f => f.lato === "BLUE").map(f => { const p = pB.formazioni[f.id] || {}; return [f.id, p.decollo || "", p.tanker || "", p.aar_ordine || "", p.gate_in || "", p.push || "", p.target || "", p.target2 || "", p.cap || "", p.cap_min || "", p.stazione ? p.stazione.lat : "", p.stazione ? p.stazione.lon : "", p.gate_out || "", p.decollo2 || ""]; })];
    const pR = sc.piani.RED || { cap: [], prontezza: [], sam_moves: [], commit_nm: 60 };
    S["Piano_RED_CAP"] = [["box", "formazione", "da", "a"], ...(pR.cap || []).map(c => [c.box, c.formazione, c.da, c.a])];
    S["Piano_RED_Prontezza"] = [["formazione_in_prontezza"], ...(pR.prontezza || []).map(p => [p]), [], ["commit_nm", pR.commit_nm || 60]];
    S["Piano_RED_SAM"] = [["sam", "lat", "lon", "da"], ...(pR.sam_moves || []).map(m => [m.sam, m.lat, m.lon, m.da])];
    return S;
  }
  const DESCR_REGOLE = { aar_minuti_per_formazione: "Durata AAR per formazione (min)", tempo_sul_target_min: "Tempo sul target (min)", durata_ingaggio_min: "Durata ingaggio aria-aria (min)", kr_dimezzato: "dopo_sgancio | sempre_se_armati_bombe | mai", arrotondamento_kill: "deterministico | probabilistico", turnaround_min: "Turnaround dopo atterraggio (min)", efficienza_turnaround: "Frazione di velivoli pronti dopo il turnaround", cap_max_min: "Permanenza massima in CAP (min)", prontezza_max_terra: "Max velivoli RED in prontezza al suolo", sam_velocita_kmh: "Velocità spostamento SA-10 (km/h)", growler_copertura_quadrati: "Copertura Growler in quadrati di griglia", sam_missili_per_aereo: "Missili S-300 consumati per velivolo abbattuto", fog_of_war: "1 = ogni squadra vede solo ciò che rileva", autonomia_modalita: "regole (minuti ROE) | realistica (lb/h)", bingo_auto_rtb: "1 = RTB automatico a BINGO", missili_per_ingaggio: "Missili consumati per velivolo per ingaggio" };

  function exportExcel(sc, nome) {
    const wb = XLSX.utils.book_new(); const S = toSheets(sc);
    Object.entries(S).forEach(([n, rows]) => { const ws = XLSX.utils.aoa_to_sheet(rows); ws["!cols"] = rows[0].map((_, i) => ({ wch: Math.min(60, Math.max(10, ...rows.map(r => String(r[i] ?? "").length + 2))) })); XLSX.utils.book_append_sheet(wb, ws, n.slice(0, 31)); });
    XLSX.writeFile(wb, nome || "Centurion_Config.xlsx");
  }

  /* ---------- fogli Excel → scenario (merge sul default) ---------- */
  function importExcel(buf, base) {
    const wb = XLSX.read(buf, { type: "array" }); const sc = clone(base);
    const rows = n => wb.Sheets[n] ? XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "" }) : null;
    const objs = n => wb.Sheets[n] ? XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: "" }) : null;
    const kv = n => { const r = rows(n); if (!r) return null; const o = {}; r.slice(1).forEach(x => { if (x[0] !== "") o[x[0]] = num(x[1]); }); return o; };
    const log = [];
    const info = kv("Info"); if (info) { ["nome", "versione", "data_workshop", "trainer", "note"].forEach(k => { if (info[k] != null) sc.meta[k] = String(info[k]); }); if (info.inizio) sc.tempo.inizio = xlTime(info.inizio); if (info.fine) sc.tempo.fine = xlTime(info.fine); /* Excel salva gli orari come frazioni di giorno */ if (info.tick_sec) sc.tempo.tick_sec = +info.tick_sec; log.push("Info"); }
    const reg = kv("Regole"); if (reg) { Object.keys(reg).forEach(k => { let v = reg[k]; if (typeof sc.regole[k] === "boolean") v = (v === 1 || v === "1" || v === true || v === "true" || v === "VERO"); sc.regole[k] = v; }); log.push("Regole"); }
    const met = kv("Meteo"); if (met) { Object.keys(met).forEach(k => { let v = met[k]; if (typeof sc.meteo[k] === "boolean") v = (v === 1 || v === "1" || v === true || v === "true" || v === "VERO" || v === "TRUE"); sc.meteo[k] = v; }); log.push("Meteo"); }
    const vel = objs("Velivoli"); if (vel) { vel.forEach(r => { if (!r.id) return; const t = sc.tipi[r.id] || (sc.tipi[r.id] = { armi: {} }); Object.keys(r).forEach(k => { if (k === "id") return; if (["AMRAAM", "GBU48", "ADDER", "HARM", "S300"].includes(k)) { t.armi = t.armi || {}; if (r[k] !== "") t.armi[k] = +r[k]; else delete t.armi[k]; } else if (r[k] !== "") t[k] = num(r[k]); }); }); log.push("Velivoli"); }
    const krm = (n, target) => { const r = rows(n); if (!r) return; const def = r[0].slice(1); const out = {}; r.slice(1).forEach(x => { if (!x[0]) return; out[x[0]] = {}; def.forEach((d, i) => { if (x[i + 1] !== "" && d) out[x[0]][d] = +x[i + 1]; }); }); sc[target] = out; log.push(n); };
    krm("KRO_KillRatio", "kill_ratio"); krm("KRO_ConBombe", "kill_ratio_con_bombe");
    const list = (n, map) => { const o = objs(n); if (!o) return null; const out = o.filter(r => r.id !== "").map(map); log.push(n); return out; };
    const f = list("Formazioni", r => ({ id: r.id, callsign: r.callsign, lato: r.lato, tipo: r.tipo, numero: +r.numero, base: r.base, ruolo: r.ruolo })); if (f) sc.formazioni = f;
    const b = list("Basi", r => ({ id: r.id, nome: r.nome, lato: r.lato, lat: +r.lat, lon: +r.lon, nazione: r.nazione, pista_ft: +r.pista_ft })); if (b) sc.basi = b;
    const t = list("Target", r => { const x = { id: r.id, nome: r.nome, lat: +r.lat, lon: +r.lon, gbu_richieste: +r.gbu_richieste, descrizione: r.descrizione }; if (r.categoria) x.categoria = r.categoria; if (r.sam_collegato) x.sam = r.sam_collegato; if (r.finestra_da && r.finestra_a) x.finestra = { da: xlTime(r.finestra_da), a: xlTime(r.finestra_a) }; if (r.gruppo) x.gruppo = r.gruppo; return x; }); if (t) sc.target = t;
    const lst = v => String(v || "").split(";").map(x => x.trim()).filter(Boolean);
    const ob = objs("Obiettivi"); if (ob) { sc.obiettivi = ob.filter(r => r.tipo).map(r => { const o = { tipo: r.tipo, testo: String(r.testo || ""), primario: !(r.primario === 0 || r.primario === "0" || r.primario === false) }; if (r.target !== "") o.target = lst(r.target); if (r.minimo !== "") o.minimo = +r.minimo; if (r.entro !== "") o.entro = xlTime(r.entro); if (r.massimo !== "") o.massimo = +r.massimo; if (r.sam !== "") o.sam = lst(r.sam); if (r.formazioni !== "") o.formazioni = lst(r.formazioni); if (r.perdite_max !== "") o.perdite_max = +r.perdite_max; return o; }); log.push("Obiettivi"); }
    const a = list("AAR", r => ({ id: r.id, nome: r.nome, lat: +r.lat, lon: +r.lon, quota_ft: +r.quota_ft, orient: +r.orient, lunghezza_nm: +r.lunghezza_nm })); if (a) sc.aar = a;
    const o = list("Orbite", r => ({ id: r.id, nome: r.nome, tipo: r.tipo, lat: +r.lat, lon: +r.lon, quota_ft: +r.quota_ft })); if (o) sc.orbite = o;
    const g = list("Gate", r => ({ id: r.id, nome: r.nome, lat: +r.lat, lon: +r.lon })); if (g) sc.gate = g;
    const c = list("CAP", r => ({ id: r.id, nome: r.nome, lato: r.lato, lat: +r.lat, lon: +r.lon, raggio_nm: +r.raggio_nm })); if (c) sc.cap_box = c;
    const s = list("SAM", r => ({ id: r.id, nome: r.nome, lat: +r.lat, lon: +r.lon, missili: +r.missili, raggio_nm: +r.raggio_nm })); if (s) sc.sam = s;
    ["BLUE", "RED"].forEach(l => { const k = kv("Briefing_" + l); if (!k) return; const br = sc.briefing[l]; ["titolo", "situazione", "threat"].forEach(x => { if (k[x] != null) br[x] = String(k[x]); }); ["task", "intel", "roe", "da_sapere", "output_plan"].forEach(x => { if (k[x] != null) br[x] = splitList(k[x]); }); log.push("Briefing_" + l); });
    const sq = objs("Squadre"); if (sq) { ["BLUE", "RED"].forEach(l => { const r = sq.filter(x => x.lato === l); if (!r.length) return; sc.squadre[l].nome = r[0].squadra; sc.squadre[l].nazione = r[0].nazione; sc.squadre[l].ruolo = r[0].ruolo_squadra; if (r[0].colore) sc.squadre[l].colore = r[0].colore; sc.squadre[l].membri = r.map(x => ({ nome: x.membro_nome, ruolo: x.membro_ruolo })); }); log.push("Squadre"); }
    const inj = objs("Inject"); if (inj) { sc.inject = inj.filter(r => r.id).map(r => ({ id: r.id, nome: r.nome, descrizione: r.descrizione, attivo: r.attivo == 1 || r.attivo === true })); log.push("Inject"); }
    const ag = objs("Agenda"); if (ag) { sc.agenda = ag.filter(r => r.fase).map(r => ({ ora: xlTime(r.ora), durata: +r.durata_min, fase: r.fase })); log.push("Agenda"); }
    const pb = objs("Piano_BLUE"); if (pb && pb.some(r => r.decollo)) { const fm = {}; pb.forEach(r => { if (!r.formazione || !r.decollo) return; fm[r.formazione] = { decollo: xlTime(r.decollo), tanker: r.tanker || undefined, aar_ordine: r.aar_ordine ? +r.aar_ordine : undefined, gate_in: r.gate_in || undefined, push: r.push ? xlTime(r.push) : undefined, target: r.target || undefined, target2: r.target2 || undefined, cap: r.cap || undefined, cap_min: r.cap_min ? +r.cap_min : undefined, stazione: r.stazione_lat !== "" ? { lat: +r.stazione_lat, lon: +r.stazione_lon } : undefined, gate_out: r.gate_out || undefined, decollo2: r.decollo2 ? xlTime(r.decollo2) : undefined }; }); sc.piani.BLUE = { formazioni: fm }; log.push("Piano_BLUE"); }
    const pc = objs("Piano_RED_CAP"), pp = rows("Piano_RED_Prontezza"), ps = objs("Piano_RED_SAM");
    // il piano RED si importa se almeno uno dei tre fogli (CAP, prontezza, SAM) contiene dati
    const haRed = (pc && pc.some(r => r.box)) || (pp && pp.slice(1).some(r => r[0] && r[0] !== "commit_nm")) || (ps && ps.some(r => r.sam));
    if (haRed) { const pr = { cap: (pc || []).filter(r => r.box).map(r => ({ box: r.box, formazione: r.formazione, da: xlTime(r.da), a: xlTime(r.a) })), prontezza: [], sam_moves: [], commit_nm: 60 };
      if (pp) pp.slice(1).forEach(r => { if (r[0] === "commit_nm") pr.commit_nm = +r[1]; else if (r[0]) pr.prontezza.push(r[0]); });
      if (ps) pr.sam_moves = ps.filter(r => r.sam).map(r => ({ sam: r.sam, lat: +r.lat, lon: +r.lon, da: xlTime(r.da) }));
      sc.piani.RED = pr; log.push("Piano_RED"); }
    return { sc, log };
  }
  function xlTime(v) { if (typeof v === "number") { const m = Math.round(v * 24 * 60); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; } const m = String(v).trim().match(/^(\d{1,2}):(\d{2})/); return m ? m[1].padStart(2, "0") + ":" + m[2] : String(v).slice(0, 5); }

  /* ---------- JSON / localStorage / server ---------- */
  function downloadJSON(obj, nome) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" })); a.download = nome; a.click(); }
  function downloadText(txt, nome, mime) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: mime || "text/plain" })); a.download = nome; a.click(); }
  const LS = "centurion_scenario_v1";
  function salvaLocale(sc) { try { localStorage.setItem(LS, JSON.stringify(sc)); } catch (e) {} }
  function caricaLocale() { try { const s = localStorage.getItem(LS); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function cancellaLocale() { localStorage.removeItem(LS); }
  async function serverDisponibile() { try { const r = await fetch("/api/ping", { cache: "no-store" }); return r.ok; } catch (e) { return false; } }
  async function serverSalva(nome, contenuto) { const r = await fetch("/api/salva", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome, contenuto }) }); return r.ok ? r.json() : null; }
  async function serverLista() { try { const r = await fetch("/api/salvataggi", { cache: "no-store" }); return r.ok ? r.json() : []; } catch (e) { return []; } }
  async function serverCarica(nome) { const r = await fetch("/api/salvataggi/" + encodeURIComponent(nome), { cache: "no-store" }); return r.ok ? r.json() : null; }
  async function serverExcel(base) { try { const r = await fetch("/data/Centurion_Config.xlsx", { cache: "no-store" }); if (!r.ok) return null; return importExcel(await r.arrayBuffer(), base); } catch (e) { return null; } }
  return { clone, toSheets, exportExcel, importExcel, downloadJSON, downloadText, salvaLocale, caricaLocale, cancellaLocale, serverDisponibile, serverSalva, serverLista, serverCarica, serverExcel, DESCR_REGOLE };
})();
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
    if (p.target) { const t = this.find(this.target, p.target); const t2 = p.target2 && p.target2 !== p.target ? this.find(this.target, p.target2) : null; const gpa = tipo.armi.GBU48 || 0;
      // due target: metà delle GBU per velivolo sul primo (arrotondata per eccesso), il resto sul secondo
      wps.push({ lat: t.lat, lon: t.lon, alt: tipo.quota_ft - 10000, nome: t.nome, azione: "attacco", target: t.id, gbu_pa: t2 ? Math.ceil(gpa / 2) : undefined });
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
      f.armi = { ...(this.tipo(f).armi || {}) };
      this.decolla(f, "decollo pianificato"); f.stato = "verso_aar"; f.fase = "Verso il tanker";
    } else { // RED: schedule CAP
      const c = (f.piano && f.piano.cap || []).find(c => this.t >= Engine.hm2s(c.da) && this.t < Engine.hm2s(c.a) && !c._fatto);
      if (!c || this.t < f.disponibile_da || f.n <= 0) return;
      if (this.baseChiusa(f.base)) return;
      c._fatto = true; const box = this.find(this.sc.cap_box, c.box);
      if (!box) { this.evento(f.callsign, `Piano RED: box CAP "${c.box}" inesistente nello scenario → turno ignorato`, "avviso"); return; }
      f.wps = [{ lat: box.lat, lon: box.lon, alt: this.tipo(f).quota_ft, nome: box.nome, azione: "cap", cap: box.id, fine: Math.min(Engine.hm2s(c.a), this.t + this.sc.regole.cap_max_min * 60) }]; f.wp_i = 0;
      f.armi = { ...(this.tipo(f).armi || {}) }; this.pieno(f);
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
    f.armi = { ...(this.tipo(f).armi || {}) }; this.pieno(f); f.wps = []; f.wp_i = 0;
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
    const gbu = this.gbuPerAttacco(f, w) * f.n;
    if (gbu <= 0) { this.evento(f.callsign, `Sul target ${w.nome} ma senza bombe → egress`, "avviso"); this.avanza(f); return; }
    f.stato = "attacco"; f.fase = `Sul target ${w.nome}`; f.attacco_fine = this.t + this.sc.regole.tempo_sul_target_min * 60; f.orbita = null;
    // JOKER: se il carburante non basta per tutto il tempo sul target e il rientro, un solo passaggio (1 minuto) e via
    if (this.sc.regole.bingo_auto_rtb) { const bingo = PHYS.bingoMinutes(f, this.rifugi(f), this.tipo(f).tas_crociera_kt, this.vento, 5); const serve = bingo + this.sc.regole.tempo_sul_target_min * 1.5;
      if (f.autonomia < serve) { f.attacco_fine = this.t + 60; f.fase = `Sul target ${w.nome} – passaggio unico (JOKER)`; this.evento(f.callsign, `JOKER – carburante al limite: passaggio unico su ${w.nome}`, "avviso"); } }
    const t = this.find(this.target, w.target); const danniDopo = t.danni + gbu;
    this.evento(f.callsign, `IN – attacco su ${w.nome} (${this.sc.regole.tempo_sul_target_min} min, ${gbu} GBU-48)`, "blue", { v3d: { flight: f.id, target: t.id, n: f.n, gbu, danni: danniDopo, richieste: t.gbu_richieste, distrutto: danniDopo >= t.gbu_richieste } });
  }
  /* GBU per velivolo da sganciare su questo waypoint: tutte, oppure la quota del waypoint (piano con due target) */
  gbuPerAttacco(f, w) { const have = f.armi.GBU48 || 0; return w.gbu_pa != null ? Math.min(have, w.gbu_pa) : have; }
  fineAttacco(f) {
    const w = this.wp(f); const t = this.find(this.target, w.target); const pa = this.gbuPerAttacco(f, w); const gbu = pa * f.n;
    t.danni += gbu; f.armi.GBU48 = Math.max(0, (f.armi.GBU48 || 0) - pa); f.bombe_sganciate = true; this.score.BLUE.gbu += gbu;
    if (t.gruppo) this.target.forEach(x => { if (x !== t && x.gruppo === t.gruppo) x.danni = Math.max(x.danni, t.danni); });   // stesso bersaglio in movimento: i danni restano
    const pct = Math.min(100, Math.round(t.danni / t.gbu_richieste * 100));
    const v3d = { flight: f.id, target: t.id, n: f.n, gbu, danni: t.danni, richieste: t.gbu_richieste, distrutto: t.danni >= t.gbu_richieste };
    if (!t.distrutto && t.danni >= t.gbu_richieste) { t.distrutto = true; t.t_distrutto = this.t; this.score.BLUE.target_distrutti++; this.evento(f.callsign, `SHACK! ${t.nome} DISTRUTTO (${t.danni}/${t.gbu_richieste} GBU)`, "kill", { v3d });
      if (t.gruppo) this.target.forEach(x => { if (x !== t && x.gruppo === t.gruppo && !x.distrutto) { x.distrutto = true; x.t_distrutto = this.t; x.fermato = true; } });
      if (t.sam) this.sopprimiSam(t.sam, t.nome); }
    else this.evento(f.callsign, `PICKLE – ${gbu} GBU-48 su ${t.nome}: danno ${pct}% (${t.danni}/${t.gbu_richieste})`, "blue", { v3d });
    this.evento(f.callsign, `OFF target – egress`, "blue"); this.avanza(f);
  }
  sopprimiSam(id, causa) { const s = this.find(this.sam, id); if (!s || s.soppressa) return; s.soppressa = true; s.missili = 0; s.attivo = false; this.evento(s.nome, `SAM SOPPRESSA – ${causa} distrutto: la batteria non può più guidare missili`, "kill"); }
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
      if ((f.armi.GBU48 || 0) <= 0) { this.evento(f.callsign, `Ordine target ${t.nome} rifiutato: nessuna bomba a bordo`, "avviso"); return; }
      if (f.stato === "attacco") { this.evento(f.callsign, `Ordine target ${t.nome} rifiutato: già in attacco`, "avviso"); return; }
      const p = f.piano || {}, tipo = this.tipo(f), b = this.base(f.base); const gOut = this.find(this.sc.gate, p.gate_out) || this.find(this.sc.gate, p.gate_in) || this.sc.gate[1];
      f.wps = [{ lat: t.lat, lon: t.lon, alt: tipo.quota_ft - 10000, nome: t.nome, azione: "attacco", target: t.id }, { lat: gOut.lat, lon: gOut.lon, alt: tipo.quota_ft, nome: gOut.nome, azione: "egress" }, { lat: b.lat, lon: b.lon, alt: 0, nome: b.nome, azione: "atterraggio" }];
      this.liberaTanker(f); f.wp_i = 0; f.stato = "verso_target"; f.fase = "Verso il target " + t.nome; f.orbita = null; f.target_commit = null; f.pre_commit = null; f.hold_until = null; f.cap_fine = null;
      f.retask = t.id;   // il piano salvato resta quello del briefing: nel debrief si vede la differenza
      this.evento(f.callsign, `Ordine: nuovo target ${t.nome} (${(f.armi.GBU48 || 0) * f.n} GBU-48) → egress ${gOut.nome}`, "sistema");
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
/* Geodesia: tutte le distanze in miglia nautiche (NM), angoli in gradi (0=Nord, orario) */
const GEO = (() => {
  const R_NM = 3440.065;       // raggio terrestre medio in NM
  const d2r = d => d * Math.PI / 180, r2d = r => r * 180 / Math.PI;

  function dist(a, b) {        // haversine, a/b = {lat,lon}
    const dLat = d2r(b.lat - a.lat), dLon = d2r(b.lon - a.lon);
    const h = Math.sin(dLat/2)**2 + Math.cos(d2r(a.lat))*Math.cos(d2r(b.lat))*Math.sin(dLon/2)**2;
    return 2 * R_NM * Math.asin(Math.sqrt(h));
  }
  function bearing(a, b) {     // rotta iniziale vera
    const φ1 = d2r(a.lat), φ2 = d2r(b.lat), Δλ = d2r(b.lon - a.lon);
    const y = Math.sin(Δλ)*Math.cos(φ2);
    const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
    return (r2d(Math.atan2(y, x)) + 360) % 360;
  }
  function dest(a, brg, d) {   // punto a distanza d (NM) lungo brg
    const δ = d / R_NM, θ = d2r(brg), φ1 = d2r(a.lat), λ1 = d2r(a.lon);
    const φ2 = Math.asin(Math.sin(φ1)*Math.cos(δ) + Math.cos(φ1)*Math.sin(δ)*Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ)*Math.sin(δ)*Math.cos(φ1), Math.cos(δ) - Math.sin(φ1)*Math.sin(φ2));
    return { lat: r2d(φ2), lon: ((r2d(λ2) + 540) % 360) - 180 };
  }
  const norm = a => ((a % 360) + 360) % 360;
  const angDiff = (from, to) => { let d = norm(to) - norm(from); if (d > 180) d -= 360; if (d < -180) d += 360; return d; };

  /* Triangolo del vento: dato heading (prua), TAS e vento (da dove soffia, kt) → track e ground speed */
  function windTriangle(headingDeg, tasKt, windFromDeg, windKt) {
    const h = d2r(headingDeg), w = d2r(windFromDeg + 180); // direzione verso cui soffia
    const vx = tasKt*Math.sin(h) + windKt*Math.sin(w), vy = tasKt*Math.cos(h) + windKt*Math.cos(w);
    return { track: norm(r2d(Math.atan2(vx, vy))), gs: Math.hypot(vx, vy) };
  }
  /* Heading da tenere per seguire una track desiderata con vento (wind correction angle) */
  function headingForTrack(trackDeg, tasKt, windFromDeg, windKt) {
    const wca = r2d(Math.asin(Math.max(-1, Math.min(1, windKt * Math.sin(d2r(windFromDeg - trackDeg)) / tasKt))));
    return norm(trackDeg + wca);
  }

  function pointInPolygon(p, poly) { // poly: [[lat,lon],...]
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
      const inter = ((yi > p.lat) !== (yj > p.lat)) && (p.lon < (xj - xi) * (p.lat - yi) / (yj - yi) + xi);
      if (inter) inside = !inside;
    }
    return inside;
  }

  /* Griglia operativa: quadrati di lato L NM a partire dall'origine (SW). Colonne A..., righe 1... dal nord */
  function gridCell(p, g) {
    const latMid = g.origine[0] + (g.righe * g.lato_nm / 60) / 2;
    const dLat = g.lato_nm / 60, dLon = g.lato_nm / (60 * Math.cos(d2r(latMid)));
    const col = Math.floor((p.lon - g.origine[1]) / dLon);
    const rowFromSouth = Math.floor((p.lat - g.origine[0]) / dLat);
    const row = g.righe - 1 - rowFromSouth;
    return { col, row, label: (col >= 0 && col < 26 ? String.fromCharCode(65 + col) : "?") + (row + 1), dLat, dLon };
  }
  function gridDistanceSquares(a, b, g) { // distanza in "quadrati" (Chebyshev continua, arrotondata al mezzo quadrato) tra due punti
    const c = gridCell(a, g);
    const d = Math.max(Math.abs(a.lon - b.lon) / c.dLon, Math.abs(a.lat - b.lat) / c.dLat);
    return Math.round(d);
  }

  /* Bullseye: BRA (bearing/range) da un punto di riferimento */
  function bullseye(ref, p) { return { brg: Math.round(bearing(ref, p)), rng: Math.round(dist(ref, p)) }; }
  const fmtBE = (ref, p) => { const b = bullseye(ref, p); return `BULLS ${String(b.brg).padStart(3,"0")}/${b.rng}`; };

  function fmtLatLon(p) {
    const f = (v, pos, neg) => { const a = Math.abs(v), d = Math.floor(a), m = ((a - d) * 60).toFixed(1); return `${d}°${m.padStart(4,"0")}'${v >= 0 ? pos : neg}`; };
    return `${f(p.lat,"N","S")} ${f(p.lon,"E","W")}`;
  }
  return { dist, bearing, dest, norm, angDiff, windTriangle, headingForTrack, pointInPolygon, gridCell, gridDistanceSquares, bullseye, fmtBE, fmtLatLon, R_NM };
})();
/* =====================================================================
   HIGHLIGHTS – reward di fine missione per le squadre
   BLUE: obiettivi distrutti/danneggiati, abbattimenti, attacchi subiti, medaglie
   RED:  attacchi respinti (formazioni nemiche distrutte, SAM kill), obiettivi difesi,
         perdite subite, medaglie
   Sequenza animata a schermo intero, replay 3D degli attacchi, export JSON e
   generazione del video (video/build_highlights.py).
   ===================================================================== */
const HIGHLIGHTS = (() => {
  let overlay, slides = [], idx = 0, timer = null, audio = null, dati = null;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- calcolo ---------- */
  function calcola(eng, sc) {
    const r = eng.report(); const ev = eng.eventi; const fl = eng.flights;
    const byCs = cs => fl.find(f => f.callsign === cs);
    const kills = {}; fl.forEach(f => kills[f.callsign] = { callsign: f.callsign, lato: f.lato, tipo: f.tipo, kills: 0, perdite: f.n_iniziale - Math.max(0, f.n), iniziali: f.n_iniziale });
    ev.forEach(e => { const m = /SPLASH (\d+)x/.exec(e.testo); if (m && kills[e.chi]) kills[e.chi].kills += +m[1]; const s = /SAM LAUNCH su (\S+(?: \d)?)/.exec(e.testo); if (s) { kills[e.chi] = kills[e.chi] || { callsign: e.chi, lato: "RED", tipo: "SA10", kills: 0, perdite: 0, iniziali: 0 }; const k = /:\s*(\d+) S-300/.exec(e.testo); kills[e.chi].kills += 0; } });
    const samKills = ev.filter(e => /abbattuti da SA-10/.test(e.testo)).map(e => { const m = /-(\d+) velivoli|Formazione persa/.exec(e.testo); const f = byCs(e.chi); return { ora: e.ora, vittima: e.chi, n: m && m[1] ? +m[1] : (f ? f.n_iniziale : 4), sam: (/abbattuti da (SA-10[^)]*)/.exec(e.testo) || [])[1] || "SA-10" }; });
    const obiettivi = r.target.map(t => { const attacchi = ev.filter(e => e.v3d && /PICKLE|SHACK/.test(e.testo) && e.testo.includes(t.nome)); return { nome: t.nome, esito: t.distrutto ? "DISTRUTTO" : t.danni > 0 ? "DANNEGGIATO" : "INTATTO", pct: t.pct, danni: t.danni, richieste: t.richieste, formazioni: [...new Set(attacchi.map(a => a.chi))], ora: attacchi.length ? attacchi[attacchi.length - 1].ora : null, v3d: attacchi.length ? attacchi[attacchi.length - 1].v3d : null }; });
    const perdite = lato => fl.filter(f => f.lato === lato && f.n_iniziale - Math.max(0, f.n) > 0).map(f => { const cause = ev.filter(e => e.chi === f.callsign && /abbattuti da/.test(e.testo)).map(e => (/abbattuti da ([^)]+?)\)?(?: –|$)/.exec(e.testo) || [])[1]).filter(Boolean).map(c => c.trim()); return { callsign: f.callsign, tipo: f.tipo, perdite: f.n_iniziale - Math.max(0, f.n), iniziali: f.n_iniziale, distrutta: f.distrutto, cause: [...new Set(cause)], ora: (ev.find(e => e.chi === f.callsign && /abbattuti da|Formazione persa/.test(e.testo)) || {}).ora };
    });
    const top = lato => Object.values(kills).filter(k => k.lato === lato && k.kills > 0).sort((a, b) => b.kills - a.kills);
    const has = re => ev.some(e => re.test(e.testo));
    const bingoBlue = ev.some(e => /BINGO/.test(e.testo) && (byCs(e.chi) || {}).lato === "BLUE");
    const totB = fl.filter(f => f.lato === "BLUE").reduce((s, f) => s + f.n_iniziale, 0), totR = fl.filter(f => f.lato === "RED").reduce((s, f) => s + f.n_iniziale, 0);
    const medB = [
      obiettivi.some(o => o.esito === "DISTRUTTO") && { nome: "PRECISION STRIKE", oro: true, testo: `${obiettivi.filter(o => o.esito === "DISTRUTTO").length} target distrutti` },
      obiettivi.some(o => o.esito !== "INTATTO") && !obiettivi.some(o => o.esito === "DISTRUTTO") && { nome: "ON TARGET", oro: false, testo: "bombe a segno" },
      r.score.BLUE.perdite <= totB * 0.25 && { nome: "PACKAGE INTEGRITY", oro: r.score.BLUE.perdite <= totB * 0.1, testo: `perdite ${r.score.BLUE.perdite}/${totB}` },
      !bingoBlue && { nome: "TANKER DISCIPLINE", oro: true, testo: "nessun BINGO" },
      has(/ESCORT – interviene/) && { nome: "MUTUAL SUPPORT", oro: true, testo: "la scorta ha preso il merge" },
      has(/MAGNUM/) && samKills.length === 0 && { nome: "SEAD", oro: true, testo: "nessuna perdita ai SAM" },
      top("BLUE")[0] && top("BLUE")[0].kills >= 4 && { nome: "ACE OF THE DAY", oro: true, testo: `${top("BLUE")[0].callsign}: ${top("BLUE")[0].kills} abbattimenti` }
    ].filter(Boolean);
    const medR = [
      obiettivi.every(o => o.esito === "INTATTO") && { nome: "FORTRESS", oro: true, testo: "tutti gli obiettivi intatti" },
      obiettivi.some(o => o.esito === "INTATTO") && !obiettivi.every(o => o.esito === "INTATTO") && { nome: "HOLD THE LINE", oro: false, testo: `${obiettivi.filter(o => o.esito === "INTATTO").length} obiettivi difesi` },
      samKills.length > 0 && { nome: "SAM KILL", oro: true, testo: `${samKills.reduce((s, k) => s + k.n, 0)} velivoli abbattuti dai SA-10` },
      has(/AIRBORNE .*SCRAMBLE/) && { nome: "SCRAMBLE", oro: false, testo: "prontezza al suolo decollata" },
      r.score.RED.kills >= totB * 0.5 && { nome: "AIR DENIAL", oro: true, testo: `${r.score.RED.kills} velivoli nemici abbattuti` },
      !has(/PICKLE|SHACK/) && { nome: "NO LEAKERS", oro: true, testo: "nessuna bomba sganciata" },
      top("RED")[0] && top("RED")[0].kills >= 4 && { nome: "TOP DEFENDER", oro: true, testo: `${top("RED")[0].callsign}: ${top("RED")[0].kills} abbattimenti` }
    ].filter(Boolean);
    const respinti = perdite("BLUE").map(p => ({ ...p, titolo: p.distrutta ? "ATTACCO RESPINTO" : "ATTACCO CONTRASTATO" }));
    return { generato: new Date().toISOString(), scenario: sc.meta.nome, durata: r.durata, score: r.score,
      // con gli obiettivi di missione (catalogo) l'esito segue gli obiettivi primari; altrimenti la regola classica sui target
      obiettiviMissione: r.obiettiviMissione || [],
      BLUE: { squadra: sc.squadre.BLUE.nome, obiettivi, kills: top("BLUE"), subiti: perdite("BLUE"), medaglie: medB, esito: r.esitoMissione || (obiettivi.some(o => o.esito === "DISTRUTTO") ? "MISSION SUCCESS" : obiettivi.some(o => o.esito !== "INTATTO") ? "PARTIAL SUCCESS" : "MISSION FAILED") },
      RED: { squadra: sc.squadre.RED.nome, difesi: obiettivi, respinti, samKills, kills: top("RED"), subiti: perdite("RED"), medaglie: medR, esito: r.esitoMissione ? { "MISSION SUCCESS": "DEFENSE BROKEN", "PARTIAL SUCCESS": "PARTIAL DEFENSE", "MISSION FAILED": "DEFENSE HELD" }[r.esitoMissione] : (obiettivi.every(o => o.esito === "INTATTO") ? "DEFENSE HELD" : obiettivi.some(o => o.esito === "INTATTO") ? "PARTIAL DEFENSE" : "DEFENSE BROKEN") } };
  }

  /* ---------- slides ---------- */
  function medaglia(oro, grande) { return `<div class="hl-medal ${oro ? "oro" : "argento"} ${grande ? "grande" : ""}"><span>★</span></div>`; }
  // molte formazioni colpite: una sola scheda riassuntiva invece di tante schede uguali
  function riepilogoPerdite(lista, titolo, lezione) {
    const tot = lista.reduce((s, p) => s + p.perdite, 0);
    return { cls: "card perdita", html: `<div class="hl-medal perdita"><span>✕</span></div><div class="hl-kicker">${titolo}</div><h1>−${tot} velivoli</h1>
      <table class="hl-tab">${lista.map(p => `<tr><td>${esc(p.callsign)}</td><td>−${p.perdite}/${p.iniziali}${p.distrutta ? " · persa" : ""}</td><td>${p.cause.map(esc).join(", ")}</td></tr>`).join("")}</table><div class="hl-lezione">${lezione}</div>` };
  }
  function costruisci(d, lato) {
    const L = d[lato]; const s = []; const col = lato === "BLUE" ? "blue" : "red";
    s.push({ cls: "intro " + col, html: `<div class="hl-kicker">MISSION HIGHLIGHTS</div><h1>${esc(L.squadra)}</h1><div class="hl-sub">${esc(d.scenario)} · ${esc(d.durata)}</div><div class="hl-esito ${/SUCCESS|HELD/.test(L.esito) && !/PARTIAL/.test(L.esito) ? "ok" : /PARTIAL/.test(L.esito) ? "warn" : "bad"}">${esc(L.esito)}</div>` });
    if (d.obiettiviMissione.length) s.push({ cls: "card " + (lato === "BLUE" ? "oro" : "argento"), html: `<div class="hl-kicker">${lato === "BLUE" ? "OBIETTIVI DELLA MISSIONE" : "OBIETTIVI DEL NEMICO"}</div><table class="hl-tab">${d.obiettiviMissione.map(o => `<tr><td>${o.primario ? "★" : "☆"}</td><td>${esc(o.testo)}</td><td>${lato === "BLUE" ? (o.ok ? "✔ raggiunto" : "✕ mancato") : (o.ok ? "✕ ottenuto dal nemico" : "✔ negato")}</td></tr>`).join("")}</table>` });
    if (lato === "BLUE") {
      L.obiettivi.filter(o => o.esito !== "INTATTO").forEach(o => s.push({ cls: "card " + (o.esito === "DISTRUTTO" ? "oro" : "argento"), oro: o.esito === "DISTRUTTO", v3d: o.v3d, html: `${medaglia(o.esito === "DISTRUTTO", true)}<div class="hl-kicker">${o.esito === "DISTRUTTO" ? "TARGET DISTRUTTO · SHACK" : "TARGET DANNEGGIATO"}</div><h1>${esc(o.nome)}</h1><div class="hl-stat"><b>${o.danni}</b> GBU-48 su ${o.richieste} · <b>${o.pct}%</b></div><div class="hl-sub">${o.formazioni.map(esc).join(" · ")}${o.ora ? " · " + o.ora : ""}</div>` }));
      L.kills.slice(0, 3).forEach((k, i) => s.push({ cls: "card " + (i === 0 ? "oro" : "argento"), oro: i === 0, html: `${medaglia(i === 0, true)}<div class="hl-kicker">${i === 0 ? "ACE OF THE DAY" : "SPLASH"}</div><h1>${esc(k.callsign)}</h1><div class="hl-stat"><b>${k.kills}</b> velivoli nemici abbattuti</div><div class="hl-sub">${k.iniziali}x ${esc(k.tipo)} · perdite ${k.perdite}</div>` }));
      if (L.subiti.length > 3) s.push(riepilogoPerdite(L.subiti, "ATTACCHI SUBITI · SAFETY POINT", "Da discutere nel debrief: copertura, timeline, scorta."));
      else L.subiti.forEach(p => s.push({ cls: "card perdita", html: `<div class="hl-medal perdita"><span>✕</span></div><div class="hl-kicker">ATTACCO SUBITO · SAFETY POINT</div><h1>${esc(p.callsign)}</h1><div class="hl-stat"><b>−${p.perdite}</b> velivoli su ${p.iniziali}${p.distrutta ? " · formazione persa" : ""}</div><div class="hl-sub">${p.cause.map(esc).join(", ") || "—"}${p.ora ? " · " + p.ora : ""}</div><div class="hl-lezione">Da discutere nel debrief: copertura, timeline, scorta.</div>` }));
    } else {
      L.respinti.forEach(p => s.push({ cls: "card " + (p.distrutta ? "oro" : "argento"), oro: p.distrutta, html: `${medaglia(p.distrutta, true)}<div class="hl-kicker">${esc(p.titolo)}</div><h1>${esc(p.callsign)}</h1><div class="hl-stat"><b>${p.perdite}</b> velivoli nemici abbattuti su ${p.iniziali}</div><div class="hl-sub">${p.cause.map(esc).join(", ")}${p.ora ? " · " + p.ora : ""}</div>` }));
      L.difesi.filter(o => o.esito === "INTATTO").forEach(o => s.push({ cls: "card argento", html: `${medaglia(false, true)}<div class="hl-kicker">OBIETTIVO DIFESO</div><h1>${esc(o.nome)}</h1><div class="hl-stat"><b>0</b> bombe a segno</div>` }));
      L.kills.slice(0, 3).forEach((k, i) => s.push({ cls: "card " + (i === 0 ? "oro" : "argento"), oro: i === 0, html: `${medaglia(i === 0, true)}<div class="hl-kicker">${i === 0 ? "TOP DEFENDER" : "SPLASH"}</div><h1>${esc(k.callsign)}</h1><div class="hl-stat"><b>${k.kills}</b> velivoli nemici abbattuti</div>` }));
      L.difesi.filter(o => o.esito !== "INTATTO").forEach(o => s.push({ cls: "card perdita", v3d: o.v3d, html: `<div class="hl-medal perdita"><span>✕</span></div><div class="hl-kicker">ATTACCO SUBITO · SAFETY POINT</div><h1>${esc(o.nome)}</h1><div class="hl-stat"><b>${o.esito}</b> · ${o.pct}%</div><div class="hl-sub">${o.formazioni.map(esc).join(" · ")}${o.ora ? " · " + o.ora : ""}</div><div class="hl-lezione">Da discutere nel debrief: CAP, prontezza, posizione dei SAM.</div>` }));
      if (L.subiti.length > 2) s.push(riepilogoPerdite(L.subiti, "PERDITE DELLA SQUADRA", "Da discutere nel debrief: commit, supporto reciproco, uso dei SAM."));
      else L.subiti.forEach(p => s.push({ cls: "card perdita", html: `<div class="hl-medal perdita"><span>✕</span></div><div class="hl-kicker">PERDITE</div><h1>${esc(p.callsign)}</h1><div class="hl-stat"><b>−${p.perdite}</b> velivoli su ${p.iniziali}</div><div class="hl-sub">${p.cause.map(esc).join(", ")}</div>` }));
    }
    s.push({ cls: "medaglie " + col, oro: L.medaglie.some(m => m.oro), html: `<div class="hl-kicker">MEDAGLIE DELLA SQUADRA</div><div class="hl-grid">${L.medaglie.length ? L.medaglie.map(m => `<div class="hl-m">${medaglia(m.oro)}<b>${esc(m.nome)}</b><small>${esc(m.testo)}</small></div>`).join("") : "<div class='hl-m'><small>Nessuna medaglia: ne parliamo nel debrief.</small></div>"}</div>` });
    const sc = d.score; s.push({ cls: "finale " + col, html: `<div class="hl-kicker">SCOREBOARD</div><div class="hl-score"><div><span>${sc.BLUE.kills}</span>kill BLUE</div><div><span>${sc.RED.kills}</span>kill RED</div><div><span>${sc.BLUE.target_distrutti}/${d.BLUE.obiettivi.length}</span>target distrutti</div><div><span>${sc.RED.missili_sam}</span>S-300 lanciati</div></div><h1>${esc(L.esito)}</h1><div class="hl-sub">Have a fighter day.</div>` });
    return s;
  }

  /* ---------- UI ---------- */
  function dom() {
    if (overlay) return; overlay = document.createElement("div"); overlay.id = "highlights"; overlay.className = "hidden";
    overlay.innerHTML = `<canvas id="hl-confetti"></canvas><div id="hl-slide"></div><div class="hl-bar"><button id="hl-prev">‹</button><span id="hl-step"></span><button id="hl-next">›</button><button id="hl-auto">⏸ auto</button><button id="hl-v3d" class="hidden">🎥 Rivedi in 3D</button><span class="sep"></span><button id="hl-lato-b">BLUE</button><button id="hl-lato-r">RED</button><span class="sep"></span><button id="hl-json">⬇ JSON</button><button id="hl-srv">💾 Salva</button><button id="hl-close">✕ Chiudi</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#hl-prev").onclick = () => vai(idx - 1); overlay.querySelector("#hl-next").onclick = () => vai(idx + 1); overlay.querySelector("#hl-close").onclick = chiudi;
    overlay.querySelector("#hl-auto").onclick = e => { if (timer) { clearInterval(timer); timer = null; e.target.textContent = "▶ auto"; } else { avviaAuto(); e.target.textContent = "⏸ auto"; } };
    overlay.querySelector("#hl-lato-b").onclick = () => mostra("BLUE"); overlay.querySelector("#hl-lato-r").onclick = () => mostra("RED");
    overlay.querySelector("#hl-json").onclick = () => DATAIO.downloadJSON(dati, "highlights_centurion.json");
    overlay.querySelector("#hl-srv").onclick = async () => { const ok = await DATAIO.serverSalva("highlights_" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"), dati); UI.toast(ok ? `Highlights salvati in data/salvataggi (${ok.nome}). Per il video: python video/build_highlights.py` : "Server assente: usa ⬇ JSON", 7000); };
    overlay.querySelector("#hl-v3d").onclick = () => { const s = slides[idx]; if (s && s.v3d) { clearInterval(timer); timer = null; APP.apriVista3d(s.v3d); } };
    window.addEventListener("keydown", e => { if (!overlay || overlay.classList.contains("hidden")) return; if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); vai(idx + 1); } if (e.key === "ArrowLeft") vai(idx - 1); if (e.key === "Escape") chiudi(); });
  }
  function sting(oro) {
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); const t = audio.currentTime; const freqs = oro ? [523, 659, 784, 1047] : [440, 554]; freqs.forEach((f, i) => { const o = audio.createOscillator(); o.type = "triangle"; o.frequency.value = f; const g = audio.createGain(); g.gain.setValueAtTime(0.0001, t + i * 0.09); g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.09 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.9); o.connect(g); g.connect(audio.destination); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 1); }); } catch (e) {}
  }
  let confetti = null;
  function confettiStart() { const c = overlay.querySelector("#hl-confetti"); c.width = window.innerWidth; c.height = window.innerHeight; const g = c.getContext("2d"); const P = []; for (let i = 0; i < 160; i++) P.push({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.5, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 160, s: 6 + Math.random() * 8, col: ["#f1c40f", "#ffffff", "#2e86de", "#e67e22"][i % 4], a: Math.random() * 6 }); let last = performance.now(); cancelAnimationFrame(confetti);
    const loop = now => { const dt = (now - last) / 1000; last = now; g.clearRect(0, 0, c.width, c.height); let alive = false; P.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.a += dt * 4; if (p.y < c.height + 20) alive = true; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.col; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }); if (alive) confetti = requestAnimationFrame(loop); else g.clearRect(0, 0, c.width, c.height); }; confetti = requestAnimationFrame(loop); }
  /* filmati reali di sfondo (app/assets/reali/clip.json → {shack: [...], splash: [...], perdita: [...], sam: [...], intro: [...], finale: [...]}) */
  let clipMap = null, clipIdx = {};
  function clipPer(s) { if (!clipMap) return null; const k = /SHACK|TARGET DISTRUTTO|TARGET DANNEGGIATO|OBIETTIVO/.test(s.html) && /oro|argento/.test(s.cls) ? "shack" : /SPLASH|ACE OF THE DAY|TOP DEFENDER|RESPINTO/.test(s.html) ? "splash" : /perdita/.test(s.cls) ? (/SAM|S-300/.test(s.html) ? "sam" : "perdita") : /intro/.test(s.cls) ? "intro" : /finale/.test(s.cls) ? "finale" : null; const lst = k && clipMap[k]; if (!lst || !lst.length) return null; clipIdx[k] = ((clipIdx[k] || 0) + 1) % lst.length; return "assets/reali/" + lst[clipIdx[k]]; }
  function sfondoVideo(src) { let v = overlay.querySelector("#hl-video"); if (!v) { v = document.createElement("video"); v.id = "hl-video"; v.muted = true; v.loop = true; v.playsInline = true; overlay.insertBefore(v, overlay.firstChild); } if (!src) { v.pause(); v.classList.remove("on"); return; } if (v.getAttribute("src") !== src) { v.src = src; } v.classList.add("on"); v.currentTime = 0; v.play().catch(() => {}); }
  function vai(i) { if (!slides.length) return; idx = (i + slides.length) % slides.length; const s = slides[idx]; const el = overlay.querySelector("#hl-slide"); el.className = "hl-s " + s.cls; el.innerHTML = s.html; el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; overlay.querySelector("#hl-step").textContent = `${idx + 1} / ${slides.length}`; overlay.querySelector("#hl-v3d").classList.toggle("hidden", !s.v3d); sfondoVideo(s.clip === undefined ? (s.clip = clipPer(s)) : s.clip); if (s.oro) { sting(true); confettiStart(); } else if (/card/.test(s.cls)) sting(false); }
  function avviaAuto() { clearInterval(timer); timer = setInterval(() => { if (idx < slides.length - 1) vai(idx + 1); else { clearInterval(timer); timer = null; overlay.querySelector("#hl-auto").textContent = "▶ auto"; } }, 4500); }
  function mostra(lato) { slides = costruisci(dati, lato); overlay.querySelector("#hl-lato-b").classList.toggle("active", lato === "BLUE"); overlay.querySelector("#hl-lato-r").classList.toggle("active", lato === "RED"); vai(0); avviaAuto(); overlay.querySelector("#hl-auto").textContent = "⏸ auto"; }
  function apri(lato) { dom(); dati = calcola(APP.engine, APP.sc); overlay.classList.remove("hidden"); const go = () => mostra(lato || (APP.ruolo === "RED" ? "RED" : "BLUE")); if (clipMap) go(); else fetch("assets/reali/clip.json", { cache: "no-store" }).then(r => r.ok ? r.json() : {}).catch(() => ({})).then(m => { clipMap = m || {}; go(); }); }
  function chiudi() { if (!overlay) return; overlay.classList.add("hidden"); clearInterval(timer); timer = null; cancelAnimationFrame(confetti); sfondoVideo(null); }
  return { apri, chiudi, calcola, get attiva() { return !!(overlay && !overlay.classList.contains("hidden")); } };
})();
/* =====================================================================
   MAPPA REALE (Leaflet) – layer tattici, griglia, simboli, animazione
   ===================================================================== */
const MAPPA = (() => {
  let map, sc, layers = {}, flightMarkers = {}, trails = {}, samMarkers = {}, tgtMarkers = {}, routeLayer, ruler = { pts: [], layer: null }, pickCb = null, baseLayers = {};
  const ICON_SIZE = 34;

  function init(scenario) {
    sc = scenario;
    map = L.map("map", { zoomControl: true, preferCanvas: false }).setView(sc.mappa.centro, sc.mappa.zoom);
    baseLayers = {
      topo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { maxZoom: 15, attribution: "© OpenStreetMap, © OpenTopoMap (CC-BY-SA)" }),
      osm: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }),
      sat: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 17, attribution: "Esri World Imagery" }),
      dark: L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 18, attribution: "© OpenStreetMap, © CARTO" })
    };
    baseLayers[sc.mappa.tile_default || "topo"].addTo(map);
    layers.sectional = L.imageOverlay(sc.mappa.sectional.file, sc.mappa.sectional.bounds, { opacity: sc.mappa.sectional.opacita });
    if (sc.mappa.sectional.attivo) layers.sectional.addTo(map);
    layers.nazioni = L.layerGroup().addTo(map); layers.griglia = L.layerGroup().addTo(map); layers.punti = L.layerGroup().addTo(map);
    layers.sam = L.layerGroup().addTo(map); layers.trails = L.layerGroup().addTo(map); layers.flights = L.layerGroup().addTo(map);
    layers.rotte = L.layerGroup().addTo(map); layers.ingaggi = L.layerGroup().addTo(map); layers.ruler = L.layerGroup().addTo(map); layers.radar = L.layerGroup();
    L.control.scale({ metric: true, imperial: true }).addTo(map);
    disegnaStatici();
    map.on("click", e => { if (pickCb) { const cb = pickCb; pickCb = null; document.getElementById("map").classList.remove("picking"); cb({ lat: e.latlng.lat, lon: e.latlng.lng }); } else if (ruler.attivo) rulerClick(e.latlng); });
    map.on("mousemove", e => { const el = document.getElementById("coords"); if (el) { const p = { lat: e.latlng.lat, lon: e.latlng.lng }; el.textContent = `${GEO.fmtLatLon(p)}  |  ${GEO.fmtBE(sc.mappa.bullseye, p)}  |  Quadrato ${GEO.gridCell(p, sc.mappa.griglia).label}`; } });
    return map;
  }
  function setBase(k) { Object.values(baseLayers).forEach(l => map.removeLayer(l)); baseLayers[k].addTo(map); }
  function toggle(k, on) { const l = layers[k]; if (!l) return; if (on) l.addTo(map); else map.removeLayer(l); }
  function setSectionalOpacity(o) { layers.sectional.setOpacity(o); }

  /* ---------- statici ---------- */
  function disegnaStatici() {
    layers.nazioni.clearLayers(); layers.griglia.clearLayers(); layers.punti.clearLayers();
    sc.mappa.nazioni.forEach(n => {
      L.polygon(n.poligono, { color: n.colore, weight: 2, fillOpacity: 0.06, dashArray: "6 4", interactive: false }).addTo(layers.nazioni);
      L.marker(n.etichetta, { icon: L.divIcon({ className: "lbl-nazione", html: `<span style="color:${n.colore}">${n.nome}</span>`, iconSize: [200, 20] }), interactive: false }).addTo(layers.nazioni);
    });
    L.polyline(sc.mappa.fir_boundary, { color: "#e74c3c", weight: 4, opacity: 0.9, interactive: false }).addTo(layers.nazioni);
    // griglia
    const g = sc.mappa.griglia;
    if (g.attiva) {
      const latMid = g.origine[0] + (g.righe * g.lato_nm / 60) / 2; const dLat = g.lato_nm / 60, dLon = g.lato_nm / (60 * Math.cos(latMid * Math.PI / 180));
      for (let c = 0; c <= g.colonne; c++) { const lon = g.origine[1] + c * dLon; L.polyline([[g.origine[0], lon], [g.origine[0] + g.righe * dLat, lon]], { color: "#555", weight: 1, opacity: 0.5, interactive: false }).addTo(layers.griglia); }
      for (let r = 0; r <= g.righe; r++) { const lat = g.origine[0] + r * dLat; L.polyline([[lat, g.origine[1]], [lat, g.origine[1] + g.colonne * dLon]], { color: "#555", weight: 1, opacity: 0.5, interactive: false }).addTo(layers.griglia); }
      for (let c = 0; c < g.colonne; c++) for (let r = 0; r < g.righe; r++) {
        const lat = g.origine[0] + (g.righe - r - 0.5) * dLat, lon = g.origine[1] + (c + 0.5) * dLon;
        L.marker([lat, lon], { icon: L.divIcon({ className: "lbl-grid", html: String.fromCharCode(65 + c) + (r + 1), iconSize: [30, 12] }), interactive: false }).addTo(layers.griglia);
      }
    }
    // bullseye
    const be = sc.mappa.bullseye;
    [10, 20, 40].forEach(r => L.circle([be.lat, be.lon], { radius: r * 1852, color: "#f1c40f", weight: 1, fill: false, dashArray: "2 4", interactive: false }).addTo(layers.punti));
    L.marker([be.lat, be.lon], { icon: L.divIcon({ className: "sym-bulls", html: "◎", iconSize: [20, 20] }) }).bindTooltip(be.nome).addTo(layers.punti);
    // basi
    sc.basi.forEach(b => L.marker([b.lat, b.lon], { icon: L.divIcon({ className: "sym-base " + b.lato.toLowerCase(), html: `<div class="base-ico">✈</div><div class="base-lbl">${b.id}</div>`, iconSize: [60, 30], iconAnchor: [30, 10] }) }).bindTooltip(`${b.nome}<br>Pista ${b.pista_ft} ft – ${b.nazione}`).addTo(layers.punti));
    // target
    sc.target.forEach(t => { tgtMarkers[t.id] = L.marker([t.lat, t.lon], { icon: L.divIcon({ className: "sym-tgt", html: `<div class="tgt-tri">▲</div><div class="tgt-lbl">${t.nome.split(" ")[0]}</div>`, iconSize: [70, 30], iconAnchor: [35, 10] }) }).bindTooltip(`<b>TARGET</b> ${t.nome}<br>${t.descrizione}<br>${t.gbu_richieste} GBU-48 richieste${t.finestra ? `<br><b>Presente solo ${t.finestra.da}–${t.finestra.a}</b>` : ""}${t.sam ? `<br>Distruggerlo spegne la ${t.sam}` : ""}`).addTo(layers.punti); });
    // AAR
    sc.aar.forEach(a => { const p1 = GEO.dest(a, a.orient, a.lunghezza_nm / 2), p2 = GEO.dest(a, a.orient + 180, a.lunghezza_nm / 2);
      L.polyline([[p1.lat, p1.lon], [p2.lat, p2.lon]], { color: "#2e86de", weight: 14, opacity: 0.25, lineCap: "round", interactive: false }).addTo(layers.punti);
      L.marker([a.lat, a.lon], { icon: L.divIcon({ className: "sym-lbl blue", html: a.id.replace("_", " "), iconSize: [80, 14] }) }).bindTooltip(a.nome + " – FL" + a.quota_ft / 100).addTo(layers.punti); });
    // orbite E7
    sc.orbite.forEach(o => { L.circle([o.lat, o.lon], { radius: 8 * 1852, color: "#2e86de", weight: 2, fill: false, interactive: false }).addTo(layers.punti); L.marker([o.lat, o.lon], { icon: L.divIcon({ className: "sym-lbl blue", html: o.id, iconSize: [40, 14] }) }).bindTooltip(o.nome).addTo(layers.punti); });
    // gate
    sc.gate.forEach(g2 => L.marker([g2.lat, g2.lon], { icon: L.divIcon({ className: "sym-gate", html: `<div class="gate-ico">⬢</div><div class="gate-lbl">${g2.nome}</div>`, iconSize: [90, 30], iconAnchor: [45, 10] }) }).bindTooltip("Punto di ingresso/uscita (gate)").addTo(layers.punti));
    // CAP box
    sc.cap_box.forEach(c => { const col = c.lato === "RED" ? "#e74c3c" : "#2e86de";
      L.circle([c.lat, c.lon], { radius: c.raggio_nm * 1852, color: col, weight: 2, fill: true, fillOpacity: 0.04, dashArray: "8 6", interactive: false }).addTo(layers.punti);
      L.marker([c.lat, c.lon], { icon: L.divIcon({ className: "sym-lbl " + c.lato.toLowerCase(), html: c.nome, iconSize: [110, 14] }) }).addTo(layers.punti); });
  }

  /* ---------- SAM ---------- */
  function disegnaSam(sams, editabile, onMove) {
    layers.sam.clearLayers(); samMarkers = {};
    sams.forEach(s => {
      const col = s.attivo === false ? "#7f8c8d" : "#e74c3c";
      const ring = L.circle([s.lat, s.lon], { radius: s.raggio_nm * 1852, color: col, weight: 2, fillColor: col, fillOpacity: 0.08, interactive: false }).addTo(layers.sam);
      const m = L.marker([s.lat, s.lon], { draggable: !!editabile, icon: L.divIcon({ className: "sym-sam", html: `<div class="sam-ico">◆</div><div class="sam-lbl">${s.id.replace("SA10_", "SA-10 ")}</div>`, iconSize: [80, 30], iconAnchor: [40, 10] }) })
        .bindTooltip(`<b>${s.nome}</b><br>Raggio ${s.raggio_nm} NM – missili: ${s.missili}${s.dest ? "<br><i>in movimento</i>" : ""}`).addTo(layers.sam);
      if (editabile) m.on("dragend", e => { const ll = e.target.getLatLng(); onMove && onMove(s.id, ll.lat, ll.lng); });
      if (s.dest) L.polyline([[s.lat, s.lon], [s.dest.lat, s.dest.lon]], { color: col, dashArray: "4 4", weight: 2, interactive: false }).addTo(layers.sam);
      samMarkers[s.id] = { m, ring };
    });
  }

  /* ---------- rotte pianificate ---------- */
  function disegnaRotte(rotte) { // [{id, colore, pts:[{lat,lon,nome}], tratteggio}]
    layers.rotte.clearLayers();
    rotte.forEach(r => {
      const ll = r.pts.map(p => [p.lat, p.lon]);
      L.polyline(ll, { color: r.colore, weight: 3, opacity: 0.8, dashArray: r.tratteggio ? "6 6" : null, interactive: false }).addTo(layers.rotte);
      r.pts.forEach((p, i) => { if (i === 0 || i === r.pts.length - 1) return; L.circleMarker([p.lat, p.lon], { radius: 4, color: r.colore, fillOpacity: 1, interactive: false }).addTo(layers.rotte); });
      if (r.etichetta && ll.length > 1) { const mid = ll[Math.floor(ll.length / 2)]; L.marker(mid, { icon: L.divIcon({ className: "lbl-rotta", html: `<span style="color:${r.colore}">${r.etichetta}</span>`, iconSize: [100, 14] }), interactive: false }).addTo(layers.rotte); }
    });
  }

  /* ---------- flight markers ---------- */
  function iconaFlight(f, tipo, selez) {
    const col = f.lato === "BLUE" ? "#2e86de" : "#e74c3c";
    const img = tipo.icona && tipo.icona !== "sam" ? `<img src="assets/icons/${tipo.icona}.png" style="transform:rotate(${Math.round(f.hdg)}deg)">` : `<div class="dot" style="background:${col}"></div>`;
    const lbl = `${f.callsign} <small>${f.n}x</small>`;
    return L.divIcon({ className: `sym-flight ${f.lato.toLowerCase()} ${selez ? "sel" : ""} ${f.ingaggio ? "eng" : ""}`, html: `<div class="fl-ico">${img}</div><div class="fl-lbl" style="border-color:${col}">${lbl}</div>`, iconSize: [ICON_SIZE, ICON_SIZE], iconAnchor: [ICON_SIZE / 2, ICON_SIZE / 2] });
  }
  function aggiornaFlights(vista, selId, onClick) {
    const presenti = new Set();
    vista.flights.forEach(f => {
      if (f.distrutto || f.stato === "terra" || f.stato === "prontezza" || f.stato === "scramble" || f.stato === "atterrato") { if (flightMarkers[f.id]) { layers.flights.removeLayer(flightMarkers[f.id]); delete flightMarkers[f.id]; } return; }
      presenti.add(f.id); const tipo = sc.tipi[f.tipo];
      if (!flightMarkers[f.id]) { flightMarkers[f.id] = L.marker([f.lat, f.lon], { icon: iconaFlight(f, tipo, f.id === selId), zIndexOffset: 1000 }).addTo(layers.flights); flightMarkers[f.id].on("click", () => onClick && onClick(f.id)); }
      const m = flightMarkers[f.id]; m.setLatLng([f.lat, f.lon]); m.setIcon(iconaFlight(f, tipo, f.id === selId));
      m.bindTooltip(`<b>${f.callsign}</b> – ${f.n}x ${tipo.nome}<br>${f.fase}<br>HDG ${Math.round(f.hdg)}° · GS ${Math.round(f.gs)} kt · M${(f.mach || 0).toFixed(2)}<br>FL${Math.round(f.alt / 100)} · autonomia ${Math.max(0, Math.round(f.autonomia))} min<br>${GEO.fmtBE(sc.mappa.bullseye, f)}`, { direction: "right", offset: [18, 0] });
      // scia
      if (!trails[f.id]) trails[f.id] = L.polyline([], { color: f.lato === "BLUE" ? "#2e86de" : "#e74c3c", weight: 2, opacity: 0.5, interactive: false }).addTo(layers.trails);
      const ll = trails[f.id].getLatLngs(); ll.push([f.lat, f.lon]); if (ll.length > 120) ll.shift(); trails[f.id].setLatLngs(ll);
    });
    Object.keys(flightMarkers).forEach(id => { if (!presenti.has(id)) { layers.flights.removeLayer(flightMarkers[id]); delete flightMarkers[id]; } });
  }
  function flashIngaggio(lat, lon, testo) {
    const m = L.marker([lat, lon], { icon: L.divIcon({ className: "sym-eng", html: `<div class="eng-burst">✸</div><div class="eng-lbl">${testo}</div>`, iconSize: [120, 40], iconAnchor: [60, 20] }), interactive: false }).addTo(layers.ingaggi);
    setTimeout(() => layers.ingaggi.removeLayer(m), 12000);
  }
  function aggiornaTarget(targets) { targets.forEach(t => { const m = tgtMarkers[t.id]; if (!m) return; const el = m.getElement(); if (el) { el.classList.toggle("hit", t.danni > 0 && !t.distrutto); el.classList.toggle("dead", t.distrutto); el.classList.toggle("assente", t.presente === false && !t.distrutto); } }); }
  function pulisciDinamici() { layers.flights.clearLayers(); layers.trails.clearLayers(); layers.ingaggi.clearLayers(); flightMarkers = {}; trails = {}; }

  /* ---------- pick point & righello ---------- */
  function pick(cb) { pickCb = cb; document.getElementById("map").classList.add("picking"); }
  function rulerToggle(on) { ruler.attivo = on; ruler.pts = []; layers.ruler.clearLayers(); document.getElementById("map").classList.toggle("ruler", on); }
  function rulerClick(ll) {
    ruler.pts.push({ lat: ll.lat, lon: ll.lng }); L.circleMarker(ll, { radius: 4, color: "#f1c40f" }).addTo(layers.ruler);
    if (ruler.pts.length >= 2) { const a = ruler.pts[ruler.pts.length - 2], b = ruler.pts[ruler.pts.length - 1]; const d = GEO.dist(a, b), brg = GEO.bearing(a, b);
      const e480 = PHYS.eta(a, b, 480, { da: sc.meteo.vento_da_gradi, kt: sc.meteo.vento_kt });
      L.polyline([[a.lat, a.lon], [b.lat, b.lon]], { color: "#f1c40f", weight: 2, dashArray: "4 4" }).addTo(layers.ruler);
      L.marker([b.lat, b.lon], { icon: L.divIcon({ className: "lbl-ruler", html: `${d.toFixed(0)} NM · ${Math.round(brg)}° · ${e480.min.toFixed(0)} min @480 kt (GS ${Math.round(e480.gs)})`, iconSize: [260, 16], iconAnchor: [-8, 8] }) }).addTo(layers.ruler); }
  }
  function radarRings(vista, on) { layers.radar.clearLayers(); if (!on) { map.removeLayer(layers.radar); return; } layers.radar.addTo(map);
    vista.flights.forEach(f => { const t = sc.tipi[f.tipo]; if (f.alt > 50 && t.radar_nm > 0) L.circle([f.lat, f.lon], { radius: t.radar_nm * 1852, color: f.lato === "BLUE" ? "#2e86de" : "#e74c3c", weight: 1, opacity: 0.4, fill: false, interactive: false }).addTo(layers.radar); }); }
  function fitScenario() { map.fitBounds([[40.0, -125.6], [42.3, -121.0]]); }
  function centra(p, z) { map.setView([p.lat, p.lon], z || map.getZoom()); }
  function reDraw(scenario) { sc = scenario; disegnaStatici(); }
  return { init, setBase, toggle, setSectionalOpacity, disegnaSam, disegnaRotte, aggiornaFlights, flashIngaggio, aggiornaTarget, pulisciDinamici, pick, rulerToggle, radarRings, fitScenario, centra, reDraw, get map() { return map; } };
})();
/* =====================================================================
   METEO REALE NOAA – METAR/TAF (aviationweather.gov), venti in quota (FB),
   previsione oraria NWS (api.weather.gov). Via server locale (/api/meteo) o,
   senza server, direttamente da aviationweather.gov.
   ===================================================================== */
const METEO = (() => {
  const ICAO = { TACCOLA: "KCEC", CANNELLINA: "KLMT", REDDING: "KRDD", REDBLUFF: "KRBL" };
  const COPERTURA = { CLR: 0, SKC: 0, FEW: 0.2, SCT: 0.45, BKN: 0.75, OVC: 1.0, OVX: 1.0 };

  async function scarica(sc, force) {
    const be = sc.mappa.bullseye; const icaos = sc.basi.map(b => ICAO[b.id]).filter(Boolean).join(",") || "KRDD,KRBL,KCEC,KLMT";
    try { const r = await fetch(`/api/meteo?lat=${be.lat}&lon=${be.lon}&icao=${icaos}${force ? "&force=1" : ""}`, { cache: "no-store" }); if (r.ok) return await r.json(); } catch (e) {}
    // senza server: solo METAR diretti (CORS permesso da aviationweather.gov)
    try { const r = await fetch(`https://aviationweather.gov/api/data/metar?ids=${icaos}&format=json`); if (r.ok) return { fonte: "NOAA aviationweather.gov (diretto)", aggiornato: new Date().toLocaleString(), metar: await r.json(), taf: null, venti_quota: {}, nws: null, errori: ["server locale assente: solo METAR"] }; } catch (e) { return { errori: ["Nessuna connessione a NOAA: " + e.message], metar: [] }; }
    return { errori: ["Nessun dato"], metar: [] };
  }

  /* METAR → riassunto per base */
  function decodifica(m) {
    const nubi = (m.clouds || []).filter(c => c.base != null); const peggiore = nubi.reduce((a, c) => (COPERTURA[c.cover] || 0) > (COPERTURA[(a || {}).cover] || 0) ? c : a, null);
    const vis = typeof m.visib === "string" ? parseFloat(m.visib.replace("+", "")) || 10 : (m.visib != null ? m.visib : 10);
    return { icao: m.icaoId, nome: m.name, raw: m.rawOb, temp: m.temp, dewp: m.dewp, wdir: m.wdir === "VRB" ? null : m.wdir, wspd: m.wspd || 0, wgst: m.wgst || null, vis_sm: vis, qnh: m.altim, wx: m.wxString || "", nubi, copertura: peggiore ? COPERTURA[peggiore.cover] : 0, base_ft: peggiore ? peggiore.base : null, cat: m.fltCat, ora: m.obsTime ? new Date(m.obsTime * 1000) : null, temporale: /TS/.test(m.wxString || "") };
  }

  /* applica i dati reali allo scenario (sc.meteo) */
  function applica(sc, dati) {
    const ms = (dati.metar || []).map(decodifica); if (!ms.length) return null;
    const perIcao = Object.fromEntries(ms.map(x => [x.icao, x]));
    const tgt = perIcao.KRDD || ms[0]; const base = perIcao.KCEC || ms[0];
    // venti in quota: FB a RBL (30000/24000 ft) se disponibile, altrimenti stima dal vento al suolo (veering +30°, ×2.2)
    const fb = (dati.venti_quota || {}).RBL || (dati.venti_quota || {}).FOT || null; let vq, fonteVento;
    if (fb && (fb[30000] || fb[24000])) { const l = fb[30000] || fb[24000]; vq = { da: l.dir, kt: l.kt, temp: l.temp }; fonteVento = "FB NOAA (RBL, FL" + (fb[30000] ? "300" : "240") + ")"; }
    else { const sw = tgt.wdir != null ? tgt : base; vq = { da: ((sw.wdir || 270) + 30) % 360, kt: Math.round(Math.max(15, (sw.wspd || 8) * 2.2)), temp: null }; fonteVento = "stima dal vento al suolo METAR (+30°, ×2,2)"; }
    const copMax = Math.max(...ms.map(x => x.copertura)); const temporale = ms.some(x => x.temporale) || /TS/.test((dati.taf || {}).rawTAF || "");
    const nws = dati.nws && dati.nws.ore && dati.nws.ore[0];
    const descr = [`${tgt.icao} (target): vento ${tgt.wdir != null ? tgt.wdir + "°" : "variabile"}/${tgt.wspd} kt${tgt.wgst ? " raffiche " + tgt.wgst : ""}, visibilità ${tgt.vis_sm} SM, ${tgt.nubi.length ? tgt.nubi.map(c => c.cover + " " + c.base + " ft").join(" ") : "cielo sereno"}, ${tgt.temp}°C, QNH ${tgt.qnh} hPa${tgt.wx ? ", " + tgt.wx : ""}`,
      `${base.icao} (base BLUE): vento ${base.wdir != null ? base.wdir + "°" : "variabile"}/${base.wspd} kt, visibilità ${base.vis_sm} SM, ${base.nubi.length ? base.nubi.map(c => c.cover + " " + c.base + " ft").join(" ") : "sereno"}`,
      `Vento in quota ${vq.da}°/${vq.kt} kt (${fonteVento})`, nws ? `NWS ${dati.nws.localita.city || ""}: ${nws.cielo}, ${nws.temp}°${nws.unita}, vento ${nws.vento} da ${nws.da}, pioggia ${nws.pioggia_pct ?? 0}%` : "", temporale ? "TEMPORALI nelle osservazioni/previsioni" : ""].filter(Boolean).join(". ");
    Object.assign(sc.meteo, { vento_da_gradi: vq.da, vento_kt: vq.kt, descrizione: descr, temporali_costa: temporale, visibilita_target: tgt.vis_sm >= 6 ? "buona" : tgt.vis_sm >= 3 ? "ridotta" : "scarsa",
      reale: true, fonte: dati.fonte, aggiornato: dati.aggiornato, giorno: Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000), visibilita_sm: tgt.vis_sm, copertura: copMax, nubi_base_ft: tgt.base_ft, vento_suolo_da: tgt.wdir, vento_suolo_kt: tgt.wspd, temp_c: tgt.temp, qnh: tgt.qnh, wx: tgt.wx, metar_raw: ms.map(x => x.raw).join(" | "), taf_raw: (dati.taf || {}).rawTAF || "" });
    return { ms, vq, fonteVento, temporale, nws };
  }

  function cardHtml(sc, dati, esc) {
    if (!dati) return `<div class="card"><h3>Meteo reale NOAA</h3><button class="btn small primary" id="met-scarica">⟳ Scarica il meteo reale (NOAA)</button> <small>METAR degli aeroporti dello scenario, TAF, venti in quota e previsione NWS. Serve internet.</small></div>`;
    const ms = (dati.metar || []).map(decodifica); const m = sc.meteo;
    return `<div class="card green"><h3>Meteo reale NOAA <span class="pill ok">applicato</span></h3><small>${esc(dati.fonte || "")} · ${esc(dati.aggiornato || "")}</small>
      <table style="margin-top:6px"><tr><th>Stazione</th><th>Vento</th><th>Vis</th><th>Nubi</th><th>T/Td</th><th>QNH</th><th>Cat</th></tr>${ms.map(x => `<tr><td><b>${x.icao}</b><br><small>${esc((x.nome || "").split(",")[0])}</small></td><td>${x.wdir != null ? x.wdir + "°" : "VRB"}/${x.wspd}${x.wgst ? "G" + x.wgst : ""} kt</td><td>${x.vis_sm} SM</td><td><small>${x.nubi.map(c => c.cover + c.base).join(" ") || "CLR"}${x.wx ? " " + esc(x.wx) : ""}</small></td><td>${x.temp}/${x.dewp}</td><td>${x.qnh}</td><td><span class="pill ${x.cat === "VFR" ? "ok" : x.cat === "MVFR" ? "warn" : "bad"}">${x.cat || "-"}</span></td></tr>`).join("")}</table>
      <p><b>Nel simulatore:</b> vento in quota <b>${m.vento_da_gradi}°/${m.vento_kt} kt</b>, visibilità sul target ${esc(m.visibilita_target)}, copertura ${Math.round((m.copertura || 0) * 100)}%${m.nubi_base_ft ? " base " + m.nubi_base_ft + " ft" : ""}${m.temporali_costa ? ", <span class='pill bad'>temporali</span>" : ""}. Il vento entra nel triangolo del vento di ogni rotta; nubi, visibilità e sole entrano nella vista 3D.</p>
      ${m.taf_raw ? `<small><b>TAF</b> ${esc(m.taf_raw)}</small><br>` : ""}${dati.nws && dati.nws.ore ? `<small><b>NWS prossime ore (${esc(dati.nws.localita.city || "")}):</b> ${dati.nws.ore.slice(0, 6).map(o => `${o.ora.slice(11, 16)} ${esc(o.cielo)} ${o.temp}°${o.unita} ${esc(o.vento)} ${o.da}`).join(" · ")}</small>` : ""}
      ${(dati.errori || []).length ? `<br><small class="muted">Note: ${dati.errori.map(esc).join("; ")}</small>` : ""}
      <div class="row" style="margin-top:6px"><button class="btn small" id="met-scarica">⟳ Aggiorna</button><button class="btn small" id="met-reset">↺ Torna al meteo dello scenario</button></div></div>`;
  }
  return { scarica, applica, decodifica, cardHtml, ICAO };
})();
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
/* =====================================================================
   MODELLI 3D DEI VELIVOLI – costruzione parametrica dettagliata (Three.js r150)
   Sistema di riferimento del modello: muso +Z, alto +Y, destra +X, metri.
   - fusoliera loftata (Catmull-Rom) da 12-16 sezioni super-ellittiche con chine, radome in tono diverso
   - ali / impennaggi a profilo NACA con bordo d'attacco separato, flaperon/alettoni/timoni incernierati
   - prese d'aria con condotto, interno scuro, rampa/cono/splitter; tettuccio con montanti, pilota, seggiolino, HUD
   - ugelli a 12 petali (o 2D vettoriali), anello incandescente, fiamma con diamanti di Mach
   - armamento (AIM-120, AIM-9, R-77, GBU, pod), serbatoi, antenne, pitot, sonda/receptacle, IRST
   - texture procedurali: pannelli + rivetti + usura, coccarde/stella, NO STEP, numero di coda, strisce deriva
   - tipi da supporto: KC30 (A330 MRTT) e E7 (737 Wedgetail)
   API: MODELLI.costruisci(tipoId, {colore, armi, numero}) → THREE.Group con .userData.parti e .userData.anim(stato)
   ===================================================================== */
const MODELLI = (() => {
  const d2r = d => d * Math.PI / 180;
  const texCache = {};
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const rgbStr = (c, f) => { const k = new THREE.Color(c); f = f || 1; return `rgb(${Math.min(255, Math.round(k.r * 255 * f))},${Math.min(255, Math.round(k.g * 255 * f))},${Math.min(255, Math.round(k.b * 255 * f))})`; };
  const rossastro = c => { const k = new THREE.Color(c); return k.r > k.g * 1.45 && k.r > k.b * 1.45; };
  function tela(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h || w; return c; }
  function texDa(c, rip, lin) { const t = new THREE.CanvasTexture(c); if (rip) t.wrapS = t.wrapT = THREE.RepeatWrapping; if (!lin && THREE.sRGBEncoding !== undefined && t.encoding !== undefined) t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }
  // generatore pseudo-casuale riproducibile (stesso disegno pannelli per colore e bump)
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* ---------- pannelli: disegno condiviso tra mappa colore e bump ---------- */
  function disegnaPannelli(g, W, base, bump, stealth) {
    const R = rng(7); g.fillStyle = bump ? "rgb(128,128,128)" : rgbStr(base); g.fillRect(0, 0, W, W);
    const righe = []; let y = 0; while (y < W) { const h = 40 + Math.floor(R() * 70); righe.push([y, h]); y += h; }
    righe.forEach(([y0, h]) => { let x = 0; while (x < W) { const w = 50 + Math.floor(R() * 110); if (!bump) { const f = 0.94 + R() * 0.1; g.fillStyle = rgbStr(base, f); g.fillRect(x, y0, w, h); }
      g.strokeStyle = bump ? "rgba(40,40,40,0.9)" : "rgba(0,0,0,0.32)"; g.lineWidth = 1.2; g.beginPath();
      if (stealth) { const n = 6; g.moveTo(x, y0); for (let i = 1; i <= n; i++) g.lineTo(x + w * i / n, y0 + (i % 2 ? 6 : 0)); } else { g.moveTo(x, y0); g.lineTo(x + w, y0); }
      g.moveTo(x, y0); g.lineTo(x, y0 + h); g.stroke();
      if (!stealth) { g.fillStyle = bump ? "rgba(60,60,60,0.8)" : "rgba(0,0,0,0.28)"; for (let i = 4; i < w; i += 7) { g.fillRect(x + i, y0 + 3, 1.2, 1.2); } for (let j = 4; j < h; j += 7) g.fillRect(x + 3, y0 + j, 1.2, 1.2); }
      if (R() < 0.12 && !bump) { g.strokeStyle = "rgba(0,0,0,0.25)"; g.strokeRect(x + w * 0.3, y0 + h * 0.3, w * 0.3, h * 0.35); } // sportelli d'ispezione
      x += w; } });
    if (!bump) { // usura: colature lungo il flusso (asse v), graffi, macchie
      for (let i = 0; i < 70; i++) { const x = R() * W, y0 = R() * W, l = 20 + R() * 120; const gr = g.createLinearGradient(x, y0, x, y0 + l); gr.addColorStop(0, "rgba(20,20,20,0.10)"); gr.addColorStop(1, "rgba(20,20,20,0)"); g.fillStyle = gr; g.fillRect(x, y0, 1 + R() * 3, l); }
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${R() < 0.5 ? 255 : 0},${R() < 0.5 ? 255 : 0},${R() < 0.5 ? 255 : 0},0.035)`; g.fillRect(R() * W, R() * W, 2, 2); }
      for (let i = 0; i < 14; i++) { g.fillStyle = "rgba(255,255,255,0.05)"; g.beginPath(); g.arc(R() * W, R() * W, 6 + R() * 20, 0, 7); g.fill(); }
    }
  }
  function texPannelli(col, stealth) {
    const key = col + (stealth ? "s" : ""); if (texCache[key]) return texCache[key];
    const c = tela(512); disegnaPannelli(c.getContext("2d"), 512, col, false, stealth); return (texCache[key] = texDa(c, true));
  }
  function texBump(stealth) {
    const key = "bump" + (stealth ? "s" : ""); if (texCache[key]) return texCache[key];
    const c = tela(512); disegnaPannelli(c.getContext("2d"), 512, 0, true, stealth); return (texCache[key] = texDa(c, true, true));
  }
  /* coccarda tricolore (BLUE) o stella rossa (RED) su sfondo trasparente */
  function texInsegna(rosso) {
    const key = "ins" + (rosso ? "R" : "B"); if (texCache[key]) return texCache[key];
    const c = tela(128), g = c.getContext("2d");
    if (rosso) { const st = (r, col) => { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.4 : r; g.lineTo(64 + Math.cos(a) * rr, 66 + Math.sin(a) * rr); } g.closePath(); g.fill(); }; st(62, "#ffffff"); st(54, "#b0161c"); }
    else { [[62, "#0b8a3e"], [42, "#f4f4f4"], [22, "#c8202c"]].forEach(([r, col]) => { g.fillStyle = col; g.beginPath(); g.arc(64, 64, r, 0, Math.PI * 2); g.fill(); }); }
    return (texCache[key] = texDa(c));
  }
  function texTesto(testo, w, h, col, bordo) {
    const key = "txt" + testo + w + col + bordo; if (texCache[key]) return texCache[key];
    const c = tela(w, h), g = c.getContext("2d"); if (bordo) { g.strokeStyle = col; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6); }
    g.fillStyle = col; g.font = `bold ${Math.round(h * 0.6)}px Arial`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(testo, w / 2, h / 2 + 1);
    return (texCache[key] = texDa(c));
  }
  /* deriva: pannelli + strisce in cima + numero di coda; uv normalizzate sul riquadro della deriva */
  function texDeriva(col, numero, rosso, stealth) {
    const key = "der" + col + numero + (rosso ? 1 : 0) + (stealth ? 1 : 0); if (texCache[key]) return texCache[key];
    const c = tela(256), g = c.getContext("2d"); disegnaPannelli(g, 256, col, false, stealth);
    g.save(); g.translate(0, 256); g.scale(1, -1); // v=0 alla radice
    const s1 = rosso ? "#b0161c" : "#1d3f8f", s2 = rosso ? "#f2f2f2" : "#f2c12e";
    g.fillStyle = s1; g.fillRect(0, 196, 256, 22); g.fillStyle = s2; g.fillRect(0, 218, 256, 9); g.fillStyle = s1; g.fillRect(0, 227, 256, 6);
    g.restore();
    if (rosso) { g.fillStyle = "#b0161c"; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 9 : 22; g.lineTo(100 + Math.cos(a) * rr, 96 + Math.sin(a) * rr); } g.closePath(); g.fill(); }
    else { [["#0b8a3e", 0], ["#f4f4f4", 1], ["#c8202c", 2]].forEach(([c2, i]) => { g.fillStyle = c2; g.fillRect(76 + i * 16, 80, 16, 30); }); } // fin flash tricolore
    g.fillStyle = stealth ? "rgba(40,44,50,0.75)" : "rgba(25,25,25,0.85)"; g.font = "bold 46px Arial"; g.textAlign = "center"; g.fillText(numero, 92, 168);
    g.font = "bold 16px Arial"; g.fillText(rosso ? "ВВС" : "AM", 92, 196);
    return (texCache[key] = texDa(c));
  }
  const matSkin = (col, st) => new THREE.MeshStandardMaterial({ color: 0xffffff, map: texPannelli(col, st), bumpMap: texBump(st), bumpScale: 0.6, roughness: st ? 0.62 : 0.5, metalness: st ? 0.25 : 0.38 });
  const matTinta = (col, r, m) => new THREE.MeshStandardMaterial({ color: col, roughness: r == null ? 0.55 : r, metalness: m == null ? 0.3 : m });
  const matGlass = oro => new THREE.MeshPhysicalMaterial({ color: oro ? 0x8a7a3a : 0x3a5878, metalness: 0.3, roughness: 0.04, transparent: true, opacity: 0.42, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false });
  const matAdd = (col, op) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op == null ? 0.85 : op, blending: THREE.AdditiveBlending, depthWrite: false });
  const matDecal = t => new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
  const mesh = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.position.set(x || 0, y || 0, z || 0); return m; };

  /* ---------- loft di sezioni super-ellittiche ----------
     sez: [{z, w, h, y, x, top, bot, sq (2=ellisse, >2 squadrata), ch (spigolo/chine), kz/kx (inclinazione bocca)}] */
  const CAMPI = ["z", "w", "h", "y", "x", "top", "bot", "sq", "ch", "kz", "kx"], DEF = { y: 0, x: 0, top: 1, bot: 1, sq: 2, ch: 0, kz: 0, kx: 0 };
  function interpSez(sez, sub) {
    const n = sez.length, out = [], get = (i, k) => { const s = sez[Math.max(0, Math.min(n - 1, i))]; return s[k] != null ? s[k] : DEF[k]; };
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < sub; j++) { const t = j / sub, o = {};
      CAMPI.forEach(k => { const p0 = get(i - 1, k), p1 = get(i, k), p2 = get(i + 1, k), p3 = get(i + 2, k);
        o[k] = k === "z" ? p1 + (p2 - p1) * t : 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t); });
      o.w = Math.max(0.004, o.w); o.h = Math.max(0.004, o.h); o.sq = Math.max(1.3, o.sq); out.push(o); }
    const l = {}; CAMPI.forEach(k => l[k] = get(n - 1, k)); out.push(l); return out;
  }
  function puntoSez(s, a) {
    const c = Math.cos(a), si = Math.sin(a), e = 2 / s.sq; let x = Math.sign(c) * Math.pow(Math.abs(c), e) * s.w; const y = Math.sign(si) * Math.pow(Math.abs(si), e) * s.h * (si > 0 ? s.top : s.bot);
    if (s.ch) x *= 1 + s.ch * Math.pow(1 - Math.abs(si), 6);
    return [s.x + x, s.y + y, s.z + s.kz * y / s.h + s.kx * x / s.w];
  }
  function loftGeo(rings, n, cap0, cap1) {
    const pos = [], uv = [], idx = [], R = rings.length; let rr = 0; rings.forEach(s => rr = Math.max(rr, (s.w + s.h) / 2)); const per = 2 * Math.PI * rr / 4;
    rings.forEach(s => { for (let i = 0; i <= n; i++) { const p = puntoSez(s, -Math.PI / 2 + i / n * Math.PI * 2); pos.push(p[0], p[1], p[2]); uv.push(i / n * per, s.z / 4); } });
    const m = n + 1; for (let r = 0; r < R - 1; r++) for (let i = 0; i < n; i++) { const a = r * m + i, b = a + 1, c = a + m, d = c + 1; idx.push(a, c, b, b, c, d); }
    if (cap0) { const c0 = pos.length / 3; pos.push(rings[0].x, rings[0].y, rings[0].z); uv.push(0, rings[0].z / 4); for (let i = 0; i < n; i++) idx.push(c0, i, i + 1); }
    if (cap1) { const c1 = pos.length / 3, b0 = (R - 1) * m, L = rings[R - 1]; pos.push(L.x, L.y, L.z); uv.push(0, L.z / 4); for (let i = 0; i < n; i++) idx.push(c1, b0 + i + 1, b0 + i); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const nr = g.attributes.normal; for (let r = 0; r < R; r++) { const a = r * m, b = a + n; const v = V3(nr.getX(a) + nr.getX(b), nr.getY(a) + nr.getY(b), nr.getZ(a) + nr.getZ(b)).normalize(); nr.setXYZ(a, v.x, v.y, v.z); nr.setXYZ(b, v.x, v.y, v.z); } // cucitura liscia
    return g;
  }
  /* loft → mesh; o: {n, sub, cap0, cap1, zSplit (radome), matSplit} */
  function loft(sez, mat, o) {
    o = o || {}; const rings = interpSez(sez, o.sub || 2), n = o.n || 28, c0 = o.cap0 !== false, c1 = o.cap1 !== false;
    if (o.zSplit == null) return mesh(loftGeo(rings, n, c0, c1), mat);
    let k = rings.findIndex(r => r.z <= o.zSplit); if (k < 1) k = 1;
    const g = new THREE.Group(); g.add(mesh(loftGeo(rings.slice(0, k + 1), n, c0, false), o.matSplit)); g.add(mesh(loftGeo(rings.slice(k), n, false, c1), mat)); return g;
  }
  /* sezione interpolata della fusoliera alla quota z (per posare insegne, antenne, ecc.) */
  function sezA(sez, z) { const r = interpSez(sez, 4); for (let i = 0; i < r.length - 1; i++) if (r[i].z >= z && r[i + 1].z <= z) { const t = (r[i].z - z) / ((r[i].z - r[i + 1].z) || 1), o = {}; CAMPI.forEach(k => o[k] = r[i][k] + (r[i + 1][k] - r[i][k]) * t); return o; } return r[r.length - 1]; }
  const specchiaSez = sez => sez.map(s => Object.assign({}, s, { x: -(s.x || 0), kx: -(s.kx || 0) }));

  /* ---------- superfici portanti a profilo NACA ----------
     st: stazioni [{x (apertura), zl (bordo d'attacco), zt (bordo d'uscita), y, t (spessore relativo)}]
     o: {mat, s (+1 destra / -1 sinistra), mob: [{i0, i1, cf, tipo}], le: {cf, mat}, uvBox, cap0} */
  const NP = 9, XS = []; for (let i = 0; i <= NP; i++) XS.push((1 - Math.cos(i / NP * Math.PI)) / 2);
  const naca = x => 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
  function superficie(st, o) {
    const s = o.s || 1, G = new THREE.Group(); G.userData.mob = []; const mob = o.mob || [];
    let zmin = 1e9, zmax = -1e9, xmax = 0; st.forEach(q => { zmin = Math.min(zmin, q.zt); zmax = Math.max(zmax, q.zl); xmax = Math.max(xmax, q.x); });
    const pt = (q, f, lato) => { const c = q.zl - q.zt; return [s * q.x, (q.y || 0) + lato * naca(f) * (q.t || 0.05) * c, q.zl - c * f]; };
    function geo(tratti) { // tratti: [{A, B, a, b, c0, c1}]
      const pos = [], uv = [], idx = [], M = 2 * (NP + 1);
      const anello = (q, a, b) => { const r = []; for (let k = 0; k <= NP; k++) r.push([pt(q, a + (b - a) * XS[k], 1), 1]); for (let k = NP; k >= 0; k--) r.push([pt(q, a + (b - a) * XS[k], -1), -1]); return r; };
      const push = (p, lato) => { pos.push(p[0], p[1], p[2]); if (o.uvBox) { let u = (p[2] - zmin) / (zmax - zmin); if (lato < 0) u = 1 - u; /* lato destro: u invertita, numero leggibile */ uv.push(u, Math.abs(p[0]) / xmax); } else uv.push(p[0] / 4, p[2] / 4); };
      const tri = (a, b, c) => { if (s > 0) idx.push(a, b, c); else idx.push(a, c, b); };
      tratti.forEach(tr => { const b0 = pos.length / 3, rA = anello(tr.A, tr.a, tr.b), rB = anello(tr.B, tr.a, tr.b);
        rA.forEach(p => push(p[0], p[1])); rB.forEach(p => push(p[0], p[1]));
        for (let k = 0; k < M; k++) { const k1 = (k + 1) % M, A0 = b0 + k, A1 = b0 + k1, B0 = b0 + M + k, B1 = b0 + M + k1; tri(A0, B0, A1); tri(A1, B0, B1); }
        [[tr.c0, rA, b0, 1], [tr.c1, rB, b0 + M, -1]].forEach(([on, r, base, verso]) => { if (!on) return; const cc = [0, 0, 0]; r.forEach(p => { cc[0] += p[0][0] / M; cc[1] += p[0][1] / M; cc[2] += p[0][2] / M; }); const ci = pos.length / 3; push(cc, 0);
          for (let k = 0; k < M; k++) { const k1 = (k + 1) % M; if (verso > 0) tri(ci, base + k, base + k1); else tri(ci, base + k1, base + k); } }); });
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    const le = o.le ? o.le.cf : 0, corpo = [], bordo = [];
    for (let j = 0; j < st.length - 1; j++) { const m = mob.find(q => j >= q.i0 && j < q.i1), b = m ? 1 - m.cf : 1, ult = j === st.length - 2;
      corpo.push({ A: st[j], B: st[j + 1], a: le, b, c0: j === 0 && o.cap0, c1: ult }); if (le) bordo.push({ A: st[j], B: st[j + 1], a: 0, b: le, c0: j === 0 && o.cap0, c1: ult }); }
    G.add(mesh(geo(corpo), o.mat)); if (le) G.add(mesh(geo(bordo), o.le.mat));
    mob.forEach(m => { const tr = []; for (let j = m.i0; j < m.i1; j++) tr.push({ A: st[j], B: st[j + 1], a: 1 - m.cf, b: 1, c0: j === m.i0, c1: j === m.i1 - 1 });
      const h0 = pt(st[m.i0], 1 - m.cf, 0), h1 = pt(st[m.i1], 1 - m.cf, 0), H0 = V3(h0[0], h0[1], h0[2]), dir = V3(h1[0], h1[1], h1[2]).sub(H0).normalize();
      const est = new THREE.Group(); est.position.copy(H0); est.quaternion.setFromUnitVectors(V3(1, 0, 0), dir);
      const gg = geo(tr); gg.translate(-H0.x, -H0.y, -H0.z); gg.applyQuaternion(est.quaternion.clone().invert());
      const inn = new THREE.Group(); inn.userData.mob = true; inn.add(mesh(gg, o.matMob || o.mat)); est.add(inn); G.add(est); G.userData.mob.push({ piv: inn, tipo: m.tipo, s }); });
    return G;
  }
  // stazioni da array compatto [x, zl, zt, t] con diedro (gradi) e quota y
  const staz = (arr, diedro, y) => arr.map(([x, zl, zt, t]) => ({ x, zl, zt, t: t || 0.045, y: (y || 0) + x * Math.tan(d2r(diedro || 0)) }));

  /* ---------- tettuccio: vetro, montanti, cornice, interni ----------
     cn: {zf (punta), zb (coda), w, h, y (base), pk (posizione picco 0..1), archi:[f], posti:[z], oro} */
  function secCan(cn, f) {
    let k; if (f <= cn.pk) k = Math.pow(Math.sin(f / cn.pk * Math.PI / 2), 0.55); else { const u = (f - cn.pk) / (1 - cn.pk); k = 1 - 0.8 * Math.pow(u, 1.5); }
    return { z: cn.zf + (cn.zb - cn.zf) * f, w: Math.max(0.01, cn.w * k), h: Math.max(0.01, cn.h * k), y: cn.y, x: 0, top: 1, bot: 0.3, sq: 2.3, ch: 0, kz: 0, kx: 0 };
  }
  function tettuccio(cn, M) {
    const G = new THREE.Group(), FS = [0, 0.02, 0.06, 0.12, 0.2, 0.3, cn.pk, 0.55, 0.65, 0.75, 0.84, 0.92, 1].filter((f, i, a) => i === 0 || f > a[i - 1]);
    const vetro = mesh(loftGeo(FS.map(f => secCan(cn, f)), 22, true, true), M.vetro); vetro.castShadow = false; vetro.renderOrder = 2; G.add(vetro);
    const tubo = (pts, r) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(6, pts.length), r, 4, false), M.telaio);
    (cn.archi || []).forEach(f => { const s = secCan(cn, f), p = []; for (let i = 0; i <= 10; i++) { const q = puntoSez(Object.assign({}, s, { w: s.w * 1.015, h: s.h * 1.015 }), -0.05 + i / 10 * (Math.PI + 0.1)); p.push(V3(q[0], q[1], q[2])); } G.add(tubo(p, 0.035)); });
    [0.06, Math.PI - 0.06].forEach(a => { const p = []; for (let i = 0; i <= 10; i++) { const s = secCan(cn, 0.03 + i / 10 * 0.95), q = puntoSez(Object.assign({}, s, { w: s.w * 1.02 + 0.02 }), a); p.push(V3(q[0], q[1], q[2])); } G.add(tubo(p, 0.04)); }); // cornice/davanzale
    const hc = cn.y + cn.h * 0.62; // centro casco
    (cn.posti || []).forEach((z, i) => {
      G.add(mesh(new THREE.BoxGeometry(0.5, 0.95, 0.14), M.sedile, 0, hc - 0.45, z - 0.3)); G.add(mesh(new THREE.BoxGeometry(0.42, 0.3, 0.2), M.sedile, 0, hc + 0.12, z - 0.26)); // schienale, poggiatesta
      G.add(mesh(new THREE.BoxGeometry(0.14, 0.05, 0.05), M.giallo, 0, hc + 0.3, z - 0.2)); // maniglia eiezione
      G.add(mesh(new THREE.BoxGeometry(0.46, 0.5, 0.3), M.tuta, 0, hc - 0.45, z - 0.08)); // busto
      G.add(mesh(new THREE.SphereGeometry(0.145, 10, 7), M.casco, 0, hc, z));
      G.add(mesh(new THREE.SphereGeometry(0.152, 10, 4, Math.PI / 2 - 1.05, 2.1, 1.05, 0.7), M.visiera, 0, hc, z));
      G.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), M.sedile, 0, hc - 0.1, z + 0.12));
      G.add(mesh(new THREE.BoxGeometry(0.62, 0.07, 0.38), M.sedile, 0, hc - 0.28, z + 0.62)); // cruscotto/paraluce
      if (i === 0) { const hud = mesh(new THREE.PlaneGeometry(0.17, 0.15), M.hud, 0, hc - 0.13, z + 0.72); hud.rotation.x = -0.45; hud.castShadow = false; G.add(hud); G.add(mesh(new THREE.BoxGeometry(0.2, 0.05, 0.14), M.sedile, 0, hc - 0.22, z + 0.72)); }
    });
    return G;
  }
  /* ---------- presa d'aria: condotto aperto, fondo scuro, rampa/cono, splitter ----------
     p: {x, y, z, w, h, l, sq, kz, kx, xi, wi, hi, yi, dop, rampa, cono, split: 'lat'|'h'} */
  function presa(p, M) {
    const G = new THREE.Group(), lato = sx => {
      const x = p.x * sx, xi = (p.xi != null ? p.xi : p.x) * sx, yi = p.yi != null ? p.yi : p.y, base = { sq: p.sq || 2, kz: p.kz || 0, kx: (p.kx || 0) * sx };
      const sez = [Object.assign({ z: p.z, x, y: p.y, w: p.w, h: p.h }, base), Object.assign({}, base, { z: p.z - 0.3, x, y: p.y, w: p.w * 1.04, h: p.h * 1.04 }),
        { z: p.z - p.l * 0.45, x: (x + xi) / 2, y: (p.y + yi) / 2, w: (p.w + p.wi) / 2, h: (p.h + p.hi) / 2, sq: base.sq }, { z: p.z - p.l, x: xi, y: yi, w: p.wi, h: p.hi, sq: base.sq }];
      G.add(loft(sez, M.skinDS, { n: 20, cap0: false }));
      const zIn = p.z - Math.abs(p.kz || 0) - Math.abs(p.kx || 0) - 0.45, fondo = mesh(new THREE.CircleGeometry(1, 20), M.buio, x, p.y, zIn); fondo.scale.set(p.w * 0.97, p.h * 0.97, 1); G.add(fondo);
      const anello = mesh(new THREE.RingGeometry(0.75, 1, 20), M.condotto, x, p.y, zIn + 0.02); anello.scale.set(p.w, p.h, 1); G.add(anello);
      if (p.cono) { const c = mesh(new THREE.ConeGeometry(Math.min(p.w, p.h) * 0.32, 0.35, 10), M.metallo, x, p.y, zIn + 0.18); c.rotation.x = Math.PI / 2; G.add(c); }
      if (p.rampa) { const r = mesh(new THREE.BoxGeometry(p.w * 1.85, 0.04, 1.1), M.condotto, x, p.y + p.h * 0.72, zIn + 0.75); r.rotation.x = 0.16; G.add(r); }
      if (p.split === "lat") G.add(mesh(new THREE.BoxGeometry(0.04, p.h * 1.7, 1.3), M.skin, x - sx * (p.w + 0.07), p.y, p.z - 0.5));
      if (p.split === "h") G.add(mesh(new THREE.BoxGeometry(p.w * 2.1, 0.04, 1.1), M.skin, x, p.y + p.h + 0.07, p.z - 0.45));
      if (p.vmid) G.add(mesh(new THREE.BoxGeometry(0.035, p.h * 1.9, 0.8), M.skin, x, p.y, p.z - 0.5)); // splitter verticale centrale

    };
    lato(1); if (p.dop) lato(-1); return G;
  }
  /* ---------- ugello: carenatura, 12 petali, anello incandescente, fiamma con diamanti di Mach ---------- */
  function fiamma(r, M) {
    const F = new THREE.Group(), mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = false; return m; };
    const cono = (rr, L, seg) => { const g = new THREE.ConeGeometry(rr, L, seg, 1, true); g.rotateX(-Math.PI / 2); g.translate(0, 0, -L / 2); return g; };
    F.add(mk(cono(r * 0.82, 7, 16), M.fiamma)); F.add(mk(cono(r * 0.6, 3.2, 12), M.nucleo));
    const dd = []; for (let i = 0; i < 4; i++) { const d = mk(new THREE.SphereGeometry(r * (0.42 - i * 0.06), 8, 4), M.diamanti); d.scale.z = 2.3; d.position.z = -1.1 - i * 1.25; F.add(d); dd.push(d); }
    F.visible = false; F.userData.mob = true; F.userData.diamanti = dd; return F;
  }
  function ugello(u, M) {
    const [x, y, z, r, tipo] = u, G = new THREE.Group(); G.position.set(x, y, z);
    const mats = { fiamma: matAdd(0xff7a2a, 0.7), nucleo: matAdd(0xa8c8ff, 0.8), diamanti: matAdd(0xfff0c0, 0.7), glow: new THREE.MeshBasicMaterial({ color: 0x3a1a05 }), anello: matAdd(0xff6a10, 0.6) };
    G.userData.mats = mats;
    if (tipo === "2d") { // F-22: ugello rettangolare con flap vettoriali
      const W = r * 1.25, H = r * 0.62;
      [-1, 1].forEach(sx => G.add(mesh(new THREE.BoxGeometry(0.07, H * 2.3, 1.7), M.metallo, sx * W, 0, -0.15)));
      G.add(mesh(new THREE.BoxGeometry(W * 2, H * 2, 0.04), mats.glow, 0, 0, 0.55)); G.add(mesh(new THREE.PlaneGeometry(W * 1.4, H * 0.9), mats.anello, 0, 0, 0.5));
      const flap = []; [-1, 1].forEach(sy => { const pv = new THREE.Group(); pv.position.set(0, sy * H, 0.45); const f = mesh(new THREE.BoxGeometry(W * 2, 0.06, 1.25), M.metallo, 0, 0, -0.62); pv.add(f); pv.userData.mob = true; G.add(pv); flap.push({ pv, sy }); });
      const F = fiamma(r, mats); F.scale.set(1.5, 0.6, 1); F.position.z = -0.3; G.add(F); G.userData.flap = flap; G.userData.fiamma = F; return G;
    }
    const prof = [[r * 1.07, 1.4], [r * 1.05, 0.7], [r * 0.98, 0.05], [r * 0.86, 0], [r * 0.84, 0.9]].map(q => new THREE.Vector2(q[0], q[1]));
    const cas = new THREE.LatheGeometry(prof, 20); cas.rotateX(Math.PI / 2); G.add(mesh(cas, M.metalloDS));
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, pv = new THREE.Group(); pv.rotation.z = a; const pt = mesh(new THREE.BoxGeometry(2 * Math.PI * r * 0.95 / 12 * 1.12, 0.025, 0.85), i % 2 ? M.petalo : M.metallo, 0, r * 0.9, -0.36); pt.rotation.x = -0.15; pv.add(pt); G.add(pv); }
    const fondo = mesh(new THREE.CircleGeometry(r * 0.85, 16), mats.glow, 0, 0, 0.88); fondo.rotation.y = Math.PI; G.add(fondo);
    const an = mesh(new THREE.RingGeometry(r * 0.32, r * 0.72, 18), mats.anello, 0, 0, 0.84); an.rotation.y = Math.PI; an.castShadow = false; G.add(an);
    const cc = mesh(new THREE.ConeGeometry(r * 0.28, 0.5, 10), M.metallo, 0, 0, 0.6); cc.rotation.x = -Math.PI / 2; G.add(cc);
    const F = fiamma(r, mats); F.position.z = -0.75; G.add(F); G.userData.fiamma = F; return G;
  }
  /* ---------- armamento e carichi (asse +Z, centrati) ---------- */
  function corpoLathe(L, r, ogiva, coda, seg) { // profilo di rivoluzione: ogiva in testa, rastremazione in coda
    const p = [[0.001, -L / 2], [r * (1 - coda), -L / 2], [r, -L / 2 + r * 2 * coda + 0.01], [r, L / 2 - r * ogiva], [r * 0.82, L / 2 - r * ogiva * 0.55], [r * 0.5, L / 2 - r * ogiva * 0.2], [0.001, L / 2]];
    const g = new THREE.LatheGeometry(p.map(q => new THREE.Vector2(q[0], q[1])), seg || 10); g.rotateX(Math.PI / 2); return g;
  }
  function pinne(G, mat, n, rr, z, span, cr, ct, sw, off) { // pinne trapezoidali radiali
    const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(span, -sw), new THREE.Vector2(span, -sw - ct), new THREE.Vector2(0, -cr)]);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }); geo.rotateX(Math.PI / 2); geo.translate(rr, 0.006, 0);
    for (let i = 0; i < n; i++) { const m = mesh(geo, mat, 0, 0, z); m.rotation.z = (off == null ? Math.PI / 4 : off) + i * Math.PI * 2 / n; G.add(m); }
  }
  function missile(tipo, M) {
    const G = new THREE.Group();
    if (tipo === "AIM9") { G.add(mesh(corpoLathe(2.87, 0.064, 2.2, 0, 8), M.missile)); pinne(G, M.missile, 4, 0.06, 1.05, 0.1, 0.28, 0.02, 0.24); pinne(G, M.missile, 4, 0.06, -1.05, 0.18, 0.34, 0.12, 0.18);
      G.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), M.vetroScuro, 0, 0, 1.43)); G.add(mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.05, 10).rotateX(Math.PI / 2), M.giallo, 0, 0, 0.75)); return G; }
    if (tipo === "R77") { G.add(mesh(corpoLathe(3.6, 0.1, 2.5, 0.1, 8), M.missileR)); pinne(G, M.missileR, 4, 0.1, 0.9, 0.05, 1.3, 1.1, 0.2);
      for (let i = 0; i < 4; i++) { const pv = new THREE.Group(); pv.rotation.z = Math.PI / 4 + i * Math.PI / 2; pv.position.z = -1.72; const gf = mesh(new THREE.BoxGeometry(0.06, 0.26, 0.05), M.metallo, 0, 0.23, 0); gf.rotation.z = Math.PI / 2; pv.add(gf); pv.add(mesh(new THREE.BoxGeometry(0.22, 0.012, 0.05), M.metallo, 0, 0.23, 0)); G.add(pv); } return G; }
    // AIM-120
    G.add(mesh(corpoLathe(3.65, 0.089, 2.6, 0, 8), M.missile)); pinne(G, M.missile, 4, 0.085, 0.55, 0.22, 0.5, 0.1, 0.4); pinne(G, M.missile, 4, 0.085, -1.4, 0.19, 0.38, 0.14, 0.2);
    G.add(mesh(new THREE.CylinderGeometry(0.091, 0.091, 0.05, 10).rotateX(Math.PI / 2), M.giallo, 0, 0, 0.85)); return G;
  }
  function bombaGbu(M) {
    const G = new THREE.Group(); G.add(mesh(corpoLathe(2.6, 0.18, 2.2, 0.25, 10), M.bomba)); G.add(mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.55, 10).rotateX(Math.PI / 2), M.bomba, 0, 0, 1.5));
    G.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), M.vetroScuro, 0, 0, 1.78)); pinne(G, M.bomba, 4, 0.1, 1.55, 0.16, 0.22, 0.1, 0.06); pinne(G, M.bomba, 4, 0.13, -0.85, 0.32, 0.5, 0.25, 0.3);
    G.add(mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.04, 12).rotateX(Math.PI / 2), M.giallo, 0, 0, 0.6)); return G;
  }
  function podAlq99(M) { // ALQ-99 con turbina ad aria dinamica in testa
    const G = new THREE.Group(); G.add(mesh(corpoLathe(4.6, 0.3, 2.2, 0.4, 14), M.pod)); G.add(mesh(new THREE.ConeGeometry(0.1, 0.25, 8).rotateX(Math.PI / 2), M.metallo, 0, 0, 2.42));
    const el = mesh(new THREE.BoxGeometry(0.85, 0.06, 0.02), M.metallo, 0, 0, 2.32); G.add(el); G.userData.elica = el;
    G.add(mesh(new THREE.BoxGeometry(0.08, 0.28, 2.6), M.pod, 0, -0.3, -0.2)); return G;
  }
  function serbatoio(L, r, M) { const G = new THREE.Group(); G.add(mesh(corpoLathe(L, r, 4.5, 0.55, 12), M.serb)); pinne(G, M.serb, 2, r * 0.6, -L / 2 + 0.7, r * 0.7, 0.5, 0.25, 0.25, Math.PI / 2 + 0.9); return G; }
  function pilone(L, h, mat) { // profilo laterale a trapezio
    const sh = new THREE.Shape([new THREE.Vector2(L / 2, h), new THREE.Vector2(-L / 2, h), new THREE.Vector2(-L / 2 + 0.3, 0), new THREE.Vector2(L / 2 - 0.5, 0)]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }); g.rotateY(-Math.PI / 2); g.translate(0.05, 0, 0); return mesh(g, mat);
  }
  function lama(h, l, mat) { // antenna a lama
    const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-l, 0), new THREE.Vector2(-l * 1.05, h), new THREE.Vector2(-l * 0.65, h)]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: false }); g.rotateY(-Math.PI / 2); g.translate(0.0125, 0, l / 2); return mesh(g, mat);
  }
  function luce(x, y, z, col, sc) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(sc || 0.5); s.position.set(x, y, z); return s; }
  function decal(tex, w, h, mat) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat || matDecal(tex)); m.renderOrder = 1; return m; }

  /* ---------- parametri per tipo ----------
     sezioni compatte [z, w, h, y, top, bot, sq, ch]; stazioni ali [x, zl, zt, t]; derive [h, zl, zt, t]
     armi: {NOME: [[x, z, hp (altezza pilone; -1 = binario d'estremità), yAttacco (omesso = sotto l'ala)]]}; serb: [[x, z, hp, L, r, yAtt]] */
  const S = a => a.map(([z, w, h, y, top, bot, sq, ch]) => ({ z, w, h, y: y || 0, top: top || 1, bot: bot || 1, sq: sq || 2, ch: ch || 0 }));
  const TIPI = {
    F15: { nome: "F-15E Strike Eagle", col: 0x5a646d, len: 19.4,
      fus: S([[9.72, 0.03, 0.03, -0.02], [9.4, 0.18, 0.17], [8.8, 0.34, 0.33], [8.0, 0.48, 0.47], [7.0, 0.62, 0.6], [6.0, 0.74, 0.68, 0, 1.12, 0.92], [5.0, 0.82, 0.75, 0, 1.22, 0.9], [4.0, 0.88, 0.78, 0, 1.25, 0.9], [3.0, 0.98, 0.8, 0, 1.15, 0.9, 2.3], [1.8, 1.15, 0.82, 0, 1.05, 0.9, 2.6], [0.4, 1.4, 0.82, 0, 1, 0.9, 2.9], [-1.5, 1.6, 0.8, 0, 1, 0.9, 3.1], [-3.5, 1.68, 0.76, 0, 1, 0.9, 3.2], [-5.5, 1.62, 0.7, 0, 1, 0.9, 3.2], [-7.4, 1.48, 0.62, 0, 1, 1, 3], [-8.6, 1.28, 0.58, 0, 1, 1, 2.8], [-9.0, 1.18, 0.56, 0, 1, 1, 2.6]]), radome: 7.0,
      cn: { zf: 6.4, zb: 0.6, w: 0.58, h: 0.76, y: 0.62, pk: 0.36, archi: [0.24, 0.6], posti: [4.6, 3.3] },
      prese: [{ x: 1.42, y: -0.02, z: 4.3, w: 0.5, h: 0.62, l: 8.2, sq: 5, kz: 0.45, xi: 1.22, yi: 0, wi: 0.4, hi: 0.55, dop: true, rampa: true, split: "lat" }],
      lofts: [{ sez: S([[2.3, 0.05, 0.05, -0.3], [1.5, 0.3, 0.42, -0.3, 1, 1, 2.6], [-2.0, 0.36, 0.5, -0.3, 1, 1, 2.8], [-4.2, 0.26, 0.36, -0.25], [-4.9, 0.05, 0.05, -0.2]]).map(s => Object.assign(s, { x: 1.78 })), dop: true }], // CFT
      ala: { st: [[1.3, 0.3, -5.5, 0.05], [3.8, -2.2, -6.0, 0.04], [6.52, -4.9, -6.4, 0.035]], diedro: -1, y: 0.38, le: 0.1, mob: [{ i0: 0, i1: 1, cf: 0.24, tipo: "flap" }, { i0: 1, i1: 2, cf: 0.28, tipo: "alettone" }] },
      stab: { st: [[1.5, -6.7, -9.1, 0.04], [4.3, -8.5, -9.6, 0.03]], y: 0.05, piv: -7.6 },
      derive: [-1, 1].map(s => ({ x: 1.45 * s, y: 0.5, cant: 2, st: [[0, -5.6, -9.3, 0.045], [1.6, -6.9, -9.4, 0.04], [3.1, -8.1, -9.45, 0.035]], mob: [{ i0: 0, i1: 1, cf: 0.3, tipo: "timone" }] })),
      ugelli: [[-0.62, 0, -9.0, 0.56], [0.62, 0, -9.0, 0.56]],
      armi: { AMRAAM: [[-1.95, -1.8, 0.04, -0.85], [1.95, -1.8, 0.04, -0.85], [-1.95, 0.9, 0.04, -0.85], [1.95, 0.9, 0.04, -0.85]], GBU48: [[-3.6, -2.8, 0.3], [3.6, -2.8, 0.3], [-1.3, -3.6, 0.15, -0.95], [1.3, -3.6, 0.15, -0.95]], AIM9: [[-3.95, -2.4, 0.42], [3.95, -2.4, 0.42]] },
      serb: [[0, -1.0, 0.25, 7.0, 0.42, -0.88]],
      ext: { recept: 0.0, sondaPitot: [[0.55, 7.6], [-0.55, 7.6]], lame: [[-2.5, 1], [1.0, -1], [-6, 1]], ins: -5.0, form: [5.2, -6.5] } },
    F16: { nome: "F-16C Fighting Falcon", col: 0x6c7682, len: 15.0,
      fus: S([[7.05, 0.03, 0.03, 0.05], [6.7, 0.18, 0.18, 0.05], [6.1, 0.34, 0.34, 0.04], [5.3, 0.47, 0.46, 0.03], [4.5, 0.56, 0.55, 0, 1.05], [3.6, 0.62, 0.6, 0, 1.15], [2.6, 0.68, 0.62, 0, 1.2, 1.15], [1.6, 0.78, 0.65, 0, 1.15, 1.1], [0.6, 0.92, 0.68, 0, 1.08, 1.05, 2.3], [-0.6, 1.0, 0.7, 0, 1, 1, 2.5], [-2.0, 0.98, 0.72, 0, 1, 1, 2.4], [-3.4, 0.9, 0.72, 0.03, 1, 1, 2.2], [-4.8, 0.8, 0.68, 0.05], [-6.0, 0.66, 0.6, 0.05], [-6.8, 0.56, 0.54, 0.05], [-7.1, 0.52, 0.5, 0.05]]), radome: 5.4,
      cn: { zf: 5.0, zb: 0.4, w: 0.5, h: 0.72, y: 0.48, pk: 0.42, archi: [0.83], posti: [3.1] },
      prese: [{ x: 0, y: -0.85, z: 3.0, w: 0.6, h: 0.4, l: 4.6, sq: 2.6, kz: -0.35, xi: 0, yi: -0.45, wi: 0.5, hi: 0.36, cono: true }],
      lerx: { st: [[0.55, 3.2, -1.5, 0.025], [1.45, -0.55, -1.4, 0.025]], y: -0.05 },
      ala: { st: [[0.9, -0.2, -5.2, 0.04], [3.2, -2.13, -4.7, 0.04], [4.72, -3.4, -4.4, 0.035]], diedro: 0, y: -0.05, le: 0.15, mob: [{ i0: 0, i1: 1, cf: 0.22, tipo: "alettone" }] },
      stab: { st: [[0.6, -4.7, -6.6, 0.04], [2.75, -6.2, -7.0, 0.03]], y: -0.05, diedro: -10, piv: -5.6 },
      derive: [{ x: 0, y: 0.6, st: [[0, -3.0, -6.4, 0.05], [1.4, -4.6, -6.6, 0.045], [2.6, -5.7, -6.8, 0.04]], mob: [{ i0: 0, i1: 1, cf: 0.3, tipo: "timone" }] }, { x: 0, y: 0.62, st: [[0, -1.2, -3.2, 0.08], [0.32, -2.9, -3.2, 0.1]] },
        { x: -0.55, y: -0.55, cant: 15, giu: true, st: [[0, -3.3, -4.3, 0.05], [0.55, -3.9, -4.4, 0.05]] }, { x: 0.55, y: -0.55, cant: 15, giu: true, st: [[0, -3.3, -4.3, 0.05], [0.55, -3.9, -4.4, 0.05]] }],
      ugelli: [[0, 0.05, -7.0, 0.52]],
      armi: { AIM9: [[-4.72, -3.9, -1], [4.72, -3.9, -1]], AMRAAM: [[-3.75, -3.4, 0.25], [3.75, -3.4, 0.25]], GBU48: [[-2.65, -2.8, 0.35], [2.65, -2.8, 0.35]] },
      serb: [[-1.7, -2.0, 0.4, 4.6, 0.37], [1.7, -2.0, 0.4, 4.6, 0.37]],
      ext: { pitot: [7.05, 0.7], recept: -0.3, lame: [[0.2, 1], [1.0, -1], [-4.0, -1]], ins: -2.6, form: [4.2, -4.6] } },
    F2000: { nome: "Eurofighter Typhoon", col: 0x7a858f, len: 15.96,
      fus: S([[7.98, 0.03, 0.03], [7.6, 0.2, 0.2], [6.9, 0.38, 0.38], [6.0, 0.52, 0.52], [5.0, 0.6, 0.62, 0, 1.08], [4.0, 0.64, 0.66, 0, 1.18], [3.0, 0.68, 0.68, 0, 1.2, 1.1], [2.0, 0.72, 0.7, 0, 1.12, 1.2], [1.0, 0.78, 0.72, 0, 1.05, 1.25, 2.3], [-0.5, 0.95, 0.72, 0, 1, 1.2, 2.6], [-2.0, 1.05, 0.7, 0, 1, 1.05, 2.8], [-3.5, 1.05, 0.68, 0, 1, 1, 2.8], [-5.0, 1.0, 0.62, 0, 1, 1, 2.6], [-6.5, 0.95, 0.55, 0, 1, 1, 2.4], [-7.5, 0.92, 0.5], [-7.95, 0.9, 0.48]]), radome: 5.6,
      cn: { zf: 5.2, zb: 0.9, w: 0.5, h: 0.68, y: 0.55, pk: 0.4, archi: [0.22], posti: [3.5] },
      prese: [{ x: 0, y: -0.95, z: 2.4, w: 0.62, h: 0.38, l: 4.5, sq: 3.2, kz: -0.2, xi: 0, yi: -0.6, wi: 0.6, hi: 0.4, split: "h", vmid: true, cono: true }],
      canard: { st: [[0.62, 4.3, 3.0, 0.04], [2.25, 3.15, 2.75, 0.035]], y: 0.15, piv: 3.6 },
      ala: { st: [[0.95, -0.3, -6.9, 0.045], [3.0, -3.0, -7.05, 0.04], [5.3, -6.05, -7.25, 0.035]], diedro: -2, y: -0.25, le: 0.12, mob: [{ i0: 0, i1: 1, cf: 0.2, tipo: "elevone" }, { i0: 1, i1: 2, cf: 0.25, tipo: "elevone" }] },
      derive: [{ x: 0, y: 0.55, st: [[0, -3.4, -7.4, 0.05], [1.8, -5.2, -7.5, 0.045], [3.3, -6.6, -7.6, 0.04]], mob: [{ i0: 0, i1: 1, cf: 0.25, tipo: "timone" }] }],
      ugelli: [[-0.48, -0.05, -7.75, 0.48], [0.48, -0.05, -7.75, 0.48]],
      armi: { AMRAAM: [[-0.78, -1.2, 0.02, -0.72], [0.78, -1.2, 0.02, -0.72], [-0.78, -4.0, 0.02, -0.68], [0.78, -4.0, 0.02, -0.68]], GBU48: [[-2.4, -3.6, 0.35], [2.4, -3.6, 0.35], [-3.4, -4.4, 0.3], [3.4, -4.4, 0.3]], AIM9: [[-4.4, -5.4, 0.2], [4.4, -5.4, 0.2]] },
      serb: [[0, -2.6, 0.15, 4.0, 0.4, -0.72]],
      ext: { sonda: [0.55, 0.38, 4.6, 1.2], irst: [-0.36, 5.7, 0.12], podPunta: [1.9, 0.12, -6.4], lame: [[-1.5, 1], [0.5, -1]], ins: -4.2, form: [3.6, -5.2] } },
    F22: { nome: "F-22A Raptor", col: 0x6a7480, len: 18.9, stealth: true,
      fus: S([[9.46, 0.03, 0.02, -0.05], [9.0, 0.22, 0.12, -0.05, 1, 1, 2, 0.5], [8.2, 0.45, 0.28, -0.03, 1, 1, 2, 0.6], [7.2, 0.65, 0.42, 0, 1.1, 0.9, 2, 0.6], [6.2, 0.8, 0.52, 0, 1.2, 0.85, 2, 0.55], [5.2, 0.92, 0.58, 0, 1.28, 0.85, 2, 0.5], [4.2, 1.1, 0.62, 0, 1.25, 0.85, 2.2, 0.45], [3.0, 1.45, 0.64, 0, 1.12, 0.85, 2.6, 0.4], [1.6, 1.85, 0.66, 0, 1, 0.85, 3, 0.3], [0, 2.15, 0.66, 0, 1, 0.85, 3.2, 0.25], [-2.0, 2.3, 0.64, 0, 1, 0.85, 3.4, 0.2], [-4.0, 2.25, 0.6, 0, 1, 0.85, 3.4, 0.2], [-6.0, 2.0, 0.55, 0, 1, 0.85, 3.2, 0.15], [-7.6, 1.75, 0.5, 0, 1, 0.9, 3], [-8.6, 1.6, 0.44, 0, 1, 1, 3], [-9.1, 1.5, 0.4, 0, 1, 1, 3]]), radome: 7.6,
      cn: { zf: 7.0, zb: 1.6, w: 0.56, h: 0.78, y: 0.68, pk: 0.45, archi: [], posti: [4.6], oro: true },
      prese: [{ x: 1.62, y: -0.15, z: 3.6, w: 0.5, h: 0.55, l: 6.0, sq: 3, kz: 0.3, kx: -0.45, xi: 1.3, yi: 0, wi: 0.45, hi: 0.45, dop: true, split: "lat" }],
      ala: { st: [[1.6, 1.2, -6.6, 0.045], [4.0, -0.96, -5.86, 0.038], [6.78, -3.46, -5.0, 0.03]], diedro: -3.25, y: 0, le: 0.12, mob: [{ i0: 0, i1: 1, cf: 0.22, tipo: "flap" }, { i0: 1, i1: 2, cf: 0.25, tipo: "alettone" }] },
      stab: { st: [[1.5, -6.0, -9.6, 0.04], [4.45, -8.6, -9.3, 0.03]], y: 0, piv: -7.4 },
      derive: [-1, 1].map(s => ({ x: 1.65 * s, y: 0.45, cant: 28, st: [[0, -4.6, -7.9, 0.045], [1.5, -5.9, -8.3, 0.04], [2.75, -7.0, -8.4, 0.035]], mob: [{ i0: 0, i1: 1, cf: 0.3, tipo: "timone" }] })),
      ugelli: [[-0.72, 0, -9.0, 0.55, "2d"], [0.72, 0, -9.0, 0.55, "2d"]],
      armi: {}, serb: [],
      ext: { recept: 1.0, lame: [[-1.0, -1]], ins: -5.5, form: [6.0, -6.0] } },
    EA18: { nome: "EA-18G Growler", col: 0x5d6873, len: 18.3,
      fus: S([[9.15, 0.03, 0.03], [8.8, 0.2, 0.2], [8.1, 0.38, 0.38], [7.2, 0.53, 0.53], [6.2, 0.64, 0.64, 0, 1.08], [5.2, 0.72, 0.7, 0, 1.2], [4.2, 0.78, 0.74, 0, 1.25], [3.2, 0.85, 0.76, 0, 1.25], [2.2, 0.98, 0.78, 0, 1.15, 1, 2.3], [1.0, 1.2, 0.8, 0, 1, 1, 2.6], [-0.6, 1.35, 0.8, 0, 1, 1, 2.8], [-2.4, 1.4, 0.76, 0, 1, 1, 2.9], [-4.4, 1.35, 0.7, 0, 1, 1, 2.8], [-6.4, 1.25, 0.62, 0, 1, 1, 2.6], [-8.0, 1.12, 0.55, 0, 1, 1, 2.4], [-8.6, 1.08, 0.52]]), radome: 7.0,
      cn: { zf: 6.6, zb: 1.4, w: 0.55, h: 0.72, y: 0.72, pk: 0.35, archi: [0.2, 0.55], posti: [5.0, 3.6] },
      prese: [{ x: 1.42, y: -0.35, z: 2.2, w: 0.42, h: 0.5, l: 4.5, sq: 3.5, kz: 0.3, kx: -0.3, xi: 1.15, yi: -0.2, wi: 0.38, hi: 0.45, dop: true, split: "lat" }],
      lerx: { st: [[0.75, 5.2, -0.5, 0.03], [2.05, 0.2, -0.8, 0.03]], y: 0.08 },
      ala: { st: [[1.35, -0.6, -4.9, 0.05], [4.2, -2.38, -4.95, 0.04], [6.7, -3.95, -5.25, 0.035]], diedro: 0, y: 0.05, le: 0.15, mob: [{ i0: 0, i1: 1, cf: 0.26, tipo: "flap" }, { i0: 1, i1: 2, cf: 0.28, tipo: "alettone" }] },
      stab: { st: [[1.1, -6.0, -8.6, 0.04], [3.4, -7.7, -8.9, 0.03]], y: 0.1, diedro: 2, piv: -7.0 },
      derive: [-1, 1].map(s => ({ x: 1.2 * s, y: 0.55, cant: 20, punta: true, st: [[0, -4.4, -7.4, 0.045], [1.5, -5.6, -7.6, 0.04], [3.0, -6.6, -7.8, 0.035]], mob: [{ i0: 0, i1: 1, cf: 0.3, tipo: "timone" }] })),
      ugelli: [[-0.56, -0.05, -8.4, 0.5], [0.56, -0.05, -8.4, 0.5]],
      armi: { POD: [[-4.3, -3.3, 0.35], [4.3, -3.3, 0.35], [-2.6, -2.6, 0.35], [2.6, -2.6, 0.35]], AMRAAM: [[-1.15, -3.0, 0.03, -0.8], [1.15, -3.0, 0.03, -0.8]] },
      serb: [[0, -1.8, 0.2, 4.5, 0.4, -0.82]],
      ext: { sonda: [0.45, 0.62, 6.0, 1.0], podPunta: [2.4, 0.16, -4.3], lame: [[-1.0, 1], [0.0, -1], [-5.0, 1]], ins: -4.6, form: [4.8, -6.0] } },
    SU35: { nome: "Su-35S Flanker-E", col: 0x7d8691, len: 21.9,
      fus: S([[10.95, 0.03, 0.03, -0.1], [10.5, 0.22, 0.22, -0.1], [9.7, 0.42, 0.42, -0.08], [8.7, 0.6, 0.6, -0.05], [7.6, 0.72, 0.72, 0, 1.05], [6.5, 0.8, 0.78, 0, 1.2], [5.4, 0.86, 0.82, 0, 1.28], [4.2, 0.92, 0.84, 0, 1.25], [3.0, 1.1, 0.84, 0, 1.12, 1, 2.3], [1.5, 1.6, 0.8, 0, 1, 0.9, 2.8], [0, 2.1, 0.72, 0, 1, 0.7, 3.2], [-2.0, 2.3, 0.66, 0, 1, 0.6, 3.4], [-4.0, 2.2, 0.62, 0, 1, 0.55, 3.4], [-6.0, 1.9, 0.55, 0, 1, 0.5, 3.2], [-7.8, 1.4, 0.48, 0, 1, 0.6, 2.8], [-9.0, 1.0, 0.42], [-9.6, 0.7, 0.35]]), radome: 8.0,
      cn: { zf: 7.6, zb: 2.6, w: 0.6, h: 0.82, y: 0.8, pk: 0.38, archi: [0.22], posti: [5.4] },
      prese: [{ x: 1.15, y: -0.85, z: 3.6, w: 0.55, h: 0.6, l: 5.6, sq: 6, kz: 0.5, xi: 1.1, yi: -0.7, wi: 0.6, hi: 0.62, dop: true, rampa: true, split: "h" }],
      lofts: [{ sez: S([[-2.0, 0.6, 0.62, -0.7, 1, 1, 4], [-5.0, 0.62, 0.62, -0.62, 1, 1, 3], [-8.0, 0.62, 0.6, -0.52, 1, 1, 2.4], [-9.4, 0.6, 0.6, -0.5], [-9.75, 0.58, 0.58, -0.5]]).map(s => Object.assign(s, { x: 1.1 })), dop: true }, // gondole motori
        { sez: S([[-4.6, 0.05, 0.05, -0.15], [-5.6, 0.26, 0.22, -0.15, 1, 1, 2.6], [-9.8, 0.24, 0.2, -0.15, 1, 1, 2.6], [-10.7, 0.12, 0.1, -0.15]]).map(s => Object.assign(s, { x: 2.15 })), dop: true }], // travi di coda
      sting: { z0: -7.5, z1: -11.6, r: 0.45, y: -0.15 },
      lerx: { st: [[0.9, 6.0, 0.2, 0.025], [2.6, 0.5, -0.3, 0.025]], y: -0.05 },
      ala: { st: [[2.0, 0.5, -5.6, 0.045], [4.8, -2.0, -5.9, 0.04], [7.65, -4.6, -6.3, 0.035]], diedro: -2, y: -0.05, le: 0.14, mob: [{ i0: 0, i1: 1, cf: 0.25, tipo: "flap" }, { i0: 1, i1: 2, cf: 0.28, tipo: "alettone" }] },
      stab: { st: [[1.8, -7.1, -9.9, 0.04], [4.95, -9.4, -10.4, 0.03]], y: -0.18, piv: -8.3 },
      derive: [-1, 1].map(s => ({ x: 2.15 * s, y: 0.05, cant: 0, st: [[0, -5.8, -9.0, 0.045], [1.8, -6.9, -9.2, 0.04], [3.4, -7.9, -9.4, 0.035]], mob: [{ i0: 0, i1: 2, cf: 0.28, tipo: "timone" }] })).concat(
        [-1, 1].map(s => ({ x: 2.05 * s, y: -0.3, cant: 10, giu: true, st: [[0, -6.6, -8.4, 0.05], [0.9, -7.6, -8.6, 0.05]] }))),
      ugelli: [[-1.1, -0.5, -9.7, 0.6], [1.1, -0.5, -9.7, 0.6]],
      armi: { ADDER: [[-3.4, -3.0, 0.35], [3.4, -3.0, 0.35], [-5.0, -4.0, 0.3], [5.0, -4.0, 0.3], [-6.3, -4.9, 0.25], [6.3, -4.9, 0.25]] }, serb: [],
      ext: { pitot: [10.95, 0.9], irst: [0.24, 7.9, 0.17], sonda: [-0.6, 0.42, 7.0, 1.1], podPunta: [2.2, 0.17, -4.6], lame: [[-1.5, 1], [2.0, -1]], ins: -5.5, form: [6.0, -7.0] } },
    SU57: { nome: "Su-57 Felon", col: 0x6f7984, len: 20.1, stealth: true,
      fus: S([[10.05, 0.03, 0.02, -0.1], [9.6, 0.24, 0.13, -0.1, 1, 1, 2, 0.6], [8.8, 0.45, 0.27, -0.08, 1, 1, 2, 0.65], [7.8, 0.64, 0.4, 0, 1.1, 0.9, 2, 0.6], [6.8, 0.78, 0.5, 0, 1.2, 0.85, 2, 0.55], [5.8, 0.9, 0.56, 0, 1.3, 0.8, 2, 0.5], [4.6, 1.05, 0.6, 0, 1.28, 0.8, 2.2, 0.45], [3.2, 1.5, 0.6, 0, 1.15, 0.75, 2.8, 0.4], [1.6, 2.1, 0.56, 0, 1, 0.7, 3.4, 0.35], [0, 2.5, 0.5, 0, 1, 0.6, 3.8, 0.3], [-2.0, 2.55, 0.46, 0, 1, 0.55, 4, 0.25], [-4.0, 2.4, 0.44, 0, 1, 0.5, 4, 0.2], [-6.0, 2.1, 0.4, 0, 1, 0.5, 3.8], [-7.8, 1.6, 0.36, 0, 1, 0.6, 3.4], [-9.0, 1.0, 0.32], [-9.6, 0.6, 0.28]]), radome: 8.0,
      cn: { zf: 7.4, zb: 2.4, w: 0.6, h: 0.75, y: 0.66, pk: 0.42, archi: [0.24], posti: [5.2], oro: true },
      prese: [{ x: 1.5, y: -0.72, z: 3.2, w: 0.55, h: 0.5, l: 5.5, sq: 4, kz: 0.35, kx: -0.4, xi: 1.5, yi: -0.6, wi: 0.6, hi: 0.55, dop: true, rampa: true, split: "h" }],
      lofts: [{ sez: S([[-2.3, 0.6, 0.55, -0.6, 1, 1, 4], [-6.0, 0.62, 0.58, -0.5, 1, 1, 3], [-9.4, 0.62, 0.6, -0.4, 1, 1, 2.2], [-9.85, 0.6, 0.58, -0.4]]).map(s => Object.assign(s, { x: 1.5 })), dop: true },
        { sez: S([[-4.8, 0.05, 0.05, -0.1], [-5.8, 0.28, 0.2, -0.1, 1, 1, 3], [-9.6, 0.26, 0.18, -0.1, 1, 1, 3], [-10.3, 0.1, 0.08, -0.1]]).map(s => Object.assign(s, { x: 2.15 })), dop: true }],
      sting: { z0: -8.0, z1: -11.2, r: 0.36, y: -0.05 },
      levcon: { st: [[1.05, 6.4, 3.3, 0.03], [2.35, 3.6, 3.1, 0.03]], y: 0.02, piv: 3.3 },
      ala: { st: [[2.0, 1.6, -6.0, 0.04], [4.6, -1.3, -5.65, 0.035], [7.05, -4.0, -5.3, 0.03]], diedro: -2, y: 0, le: 0.14, mob: [{ i0: 0, i1: 1, cf: 0.22, tipo: "flap" }, { i0: 1, i1: 2, cf: 0.26, tipo: "alettone" }] },
      stab: { st: [[1.9, -6.3, -9.4, 0.04], [4.45, -8.6, -9.6, 0.03]], y: -0.1, piv: -7.8 },
      derive: [-1, 1].map(s => ({ x: 1.95 * s, y: 0.22, cant: 26, tutta: true, st: [[0, -5.0, -7.6, 0.04], [1.3, -6.2, -7.9, 0.035], [2.3, -7.1, -8.0, 0.03]] })),
      ugelli: [[-1.5, -0.4, -9.85, 0.58], [1.5, -0.4, -9.85, 0.58]],
      armi: {}, serb: [],
      ext: { irst: [0.2, 7.9, 0.15], sonda: [-0.62, 0.3, 6.8, 1.0], lame: [[-2.0, -1]], ins: -6.0, form: [6.4, -7.2] } },
    /* --- supporto: struttura "liner" --- */
    KC30: { nome: "A330 MRTT", cat: "liner", col: 0x9aa3ab, len: 58.8,
      fus: S([[29.4, 0.05, 0.05, -0.3], [29.0, 0.9, 0.85, -0.4], [28.2, 1.65, 1.6, -0.3], [27.0, 2.25, 2.25, -0.15], [25.5, 2.65, 2.7, -0.05], [23.5, 2.82, 2.82], [10, 2.82, 2.82], [-10, 2.82, 2.82], [-15, 2.6, 2.6, 0.35], [-19, 2.15, 2.05, 0.8], [-23, 1.55, 1.4, 1.25], [-26.5, 0.95, 0.8, 1.6], [-28.8, 0.45, 0.38, 1.85], [-29.4, 0.18, 0.15, 1.9]]), radome: 27.6,
      ala: { st: [[2.6, 6.0, -5.0, 0.14], [11.5, 0.86, -4.7, 0.12], [22, -5.2, -8.84, 0.105], [30.0, -9.8, -12.0, 0.1]], diedro: 5, y: -1.7, le: 0.1, mob: [{ i0: 0, i1: 1, cf: 0.22, tipo: "flap" }, { i0: 1, i1: 2, cf: 0.22, tipo: "flap" }, { i0: 2, i1: 3, cf: 0.24, tipo: "alettone" }] },
      winglet: { st: [[0, -9.9, -12.0, 0.08], [2.7, -11.7, -12.6, 0.08]], cant: 25 },
      stab: { st: [[1.0, -21.5, -26.5, 0.1], [9.6, -26.8, -28.6, 0.09]], y: 1.3, diedro: 6, mob: [{ i0: 0, i1: 1, cf: 0.3, tipo: "elevatore" }] },
      derive: [{ x: 0, y: 2.3, st: [[0, -18.5, -27.8, 0.11], [4.5, -22.0, -28.6, 0.1], [9.4, -25.8, -29.4, 0.09]], mob: [{ i0: 0, i1: 2, cf: 0.3, tipo: "timone" }] }],
      motori: [{ x: 9.6, y: -3.6, z: 5.6, r: 1.45, l: 6.4 }], ventre: { z0: 7.5, z1: -9.5, w: 2.9, h: 1.0, y: -2.1 },
      boom: { z: -21.5, y: -0.9 }, podAla: [21.5, -5.6], finestre: [22.5, -15.5], cockpit: 26.2, ins: -14, numero: "14-01" },
    E7: { nome: "E-7A Wedgetail", cat: "liner", col: 0x7c858d, len: 33.6,
      fus: S([[16.8, 0.05, 0.05, -0.25], [16.4, 0.65, 0.6, -0.3], [15.6, 1.15, 1.1, -0.2], [14.6, 1.55, 1.55, -0.1], [13.4, 1.8, 1.82], [11.8, 1.88, 1.9], [0, 1.88, 1.9], [-6.5, 1.88, 1.9], [-9.5, 1.7, 1.7, 0.3], [-12.5, 1.3, 1.2, 0.75], [-15.0, 0.8, 0.7, 1.1], [-16.4, 0.35, 0.3, 1.3], [-16.8, 0.15, 0.12, 1.35]]), radome: 15.8,
      ala: { st: [[1.7, 4.6, -3.0, 0.14], [6.0, 2.6, -2.9, 0.12], [13.0, -0.66, -3.85, 0.11], [17.15, -2.6, -4.2, 0.1]], diedro: 6, y: -1.2, le: 0.1, mob: [{ i0: 0, i1: 1, cf: 0.22, tipo: "flap" }, { i0: 1, i1: 2, cf: 0.22, tipo: "flap" }, { i0: 2, i1: 3, cf: 0.25, tipo: "alettone" }] },
      stab: { st: [[0.8, -11.8, -15.4, 0.1], [6.6, -14.8, -16.2, 0.09]], y: 0.95, diedro: 7, mob: [{ i0: 0, i1: 1, cf: 0.3, tipo: "elevatore" }] },
      derive: [{ x: 0, y: 1.5, st: [[0, -9.0, -15.6, 0.11], [3.0, -11.5, -16.0, 0.1], [6.6, -14.4, -16.6, 0.09]], mob: [{ i0: 0, i1: 2, cf: 0.3, tipo: "timone" }] }, { x: 0, y: 1.7, st: [[0, -5.5, -9.8, 0.12], [0.9, -9.4, -9.8, 0.14]] },
        { x: -0.7, y: -0.2, cant: 35, giu: true, st: [[0, -10.8, -13.4, 0.06], [0.8, -12.2, -13.5, 0.06]] }, { x: 0.7, y: -0.2, cant: 35, giu: true, st: [[0, -10.8, -13.4, 0.06], [0.8, -12.2, -13.5, 0.06]] }],
      motori: [{ x: 4.95, y: -1.95, z: 6.0, r: 0.92, l: 4.4, piatto: true }], ventre: { z0: 4.5, z1: -4.0, w: 1.9, h: 0.7, y: -1.45 },
      mesa: true, finestre: null, cockpit: 15.0, ins: -8.5, numero: "A30-001" }
  };
  TIPI.F16b = TIPI.F16; TIPI.TYPHOON = TIPI.F2000;

  /* ---------- materiali condivisi per modello ---------- */
  function materiali(col, st, oro) {
    const c = new THREE.Color(col), M = { skin: matSkin(col, st) };
    M.skinDS = M.skin.clone(); M.skinDS.side = THREE.DoubleSide;
    M.radome = matTinta(c.clone().lerp(new THREE.Color(0x40464c), 0.55), 0.6, 0.1); M.bordo = matTinta(c.clone().multiplyScalar(0.78), 0.45, 0.45);
    M.metallo = matTinta(0x3b3732, 0.38, 0.85); M.metalloDS = M.metallo.clone(); M.metalloDS.side = THREE.DoubleSide; M.petalo = matTinta(0x5a544c, 0.45, 0.8);
    M.buio = new THREE.MeshBasicMaterial({ color: 0x05070a }); M.condotto = matTinta(0xb5b9bd, 0.6, 0.2); M.vetro = matGlass(oro); M.telaio = matTinta(0x2a2e33, 0.6, 0.3);
    M.sedile = matTinta(0x2b2f2a, 0.8, 0.1); M.giallo = matTinta(0xd8b020, 0.5, 0.1); M.tuta = matTinta(0x4b5a3a, 0.9, 0); M.casco = matTinta(0xd9dcd5, 0.35, 0.1);
    M.visiera = new THREE.MeshStandardMaterial({ color: 0x5a3c10, roughness: 0.12, metalness: 0.95 }); M.hud = matAdd(0x44ff88, 0.25);
    M.missile = matTinta(0xe2e4e6, 0.4, 0.3); M.missileR = matTinta(0xbfc4bb, 0.5, 0.3); M.bomba = matTinta(0x4a5440, 0.6, 0.3); M.vetroScuro = matTinta(0x10161c, 0.1, 0.9);
    M.pod = matTinta(0xc9cdd1, 0.5, 0.25); M.serb = M.skin; M.formaz = new THREE.MeshBasicMaterial({ color: 0xc9ff7a, transparent: true, opacity: 0.8 });
    M.irst = new THREE.MeshPhysicalMaterial({ color: 0x9a7a30, roughness: 0.05, metalness: 0.9, clearcoat: 1 }); return M;
  }
  /* ---------- montaggio ---------- */
  function infoAla(a, xa) { // quota, corda e spessore dell'ala alla semi-apertura |x|
    const st = staz(a.st, a.diedro, a.y), x = Math.abs(xa); let i = 0; while (i < st.length - 2 && st[i + 1].x < x) i++;
    const A = st[i], B = st[i + 1], t = Math.max(0, Math.min(1, (x - A.x) / (B.x - A.x))), L = (k) => A[k] + (B[k] - A[k]) * t, c = L("zl") - L("zt"), y = L("y"), h = 0.5 * L("t") * c * 0.95;
    return { zl: L("zl"), zt: L("zt"), c, y, yb: y - h, yt: y + h, xt: st[st.length - 1].x, yTip: st[st.length - 1].y };
  }
  function coppia(def, M) { // superficie destra + sinistra
    const st = staz(def.st, def.diedro, def.y), G = new THREE.Group(), mob = [];
    [1, -1].forEach(s => { const sf = superficie(st, { mat: M.skin, s, mob: def.mob, le: def.le ? { cf: def.le, mat: M.bordo } : null }); G.add(sf); sf.userData.mob.forEach(m => mob.push(m)); });
    return { G, mob };
  }
  function coppiaMobile(def, M) { // stabilizzatori/canard/levcon interamente mobili (perno trasversale)
    const st = staz(def.st, def.diedro, def.y), G = new THREE.Group(), piv = [];
    [1, -1].forEach(s => { const pv = new THREE.Group(); pv.position.set(0, def.y || 0, def.piv); pv.userData.mob = true; const sf = superficie(st, { mat: M.skin, s }); sf.position.set(0, -(def.y || 0), -def.piv); pv.add(sf); G.add(pv); piv.push({ piv: pv, s }); });
    return { G, piv };
  }
  function deriva(dv, M, matFin) {
    const st = dv.st.map(([h, zl, zt, t]) => ({ x: h, zl, zt, t, y: 0 })), sf = superficie(st, { mat: matFin || M.skin, s: 1, mob: dv.mob, uvBox: !!matFin });
    sf.rotation.z = Math.PI / 2; const sx = Math.sign(dv.x) || 1, O = new THREE.Group(), c = d2r(dv.cant || 0), top = st[st.length - 1], zp = (st[0].zl + st[0].zt) / 2;
    O.rotation.z = dv.giu ? Math.PI + sx * c : -sx * c; O.position.set(dv.x, dv.y, dv.tutta ? zp : 0); let I = null;
    if (dv.tutta) { I = new THREE.Group(); I.userData.mob = true; sf.position.z = -zp; I.add(sf); O.add(I); } else O.add(sf);
    if (dv.punta) sf.add(mesh(corpoLathe((top.zl - top.zt) * 1.05, 0.1, 2, 0.3, 10), M.pod, top.x + 0.02, 0, (top.zl + top.zt) / 2)); // carenatura antenne in cima
    if (matFin) sf.add(mesh(new THREE.BoxGeometry(top.x * 0.4, 0.05, 0.07), M.formaz, top.x * 0.45, 0, (st[0].zl + st[0].zt) / 2 - top.x * 0.3)); // luce di formazione
    return { O, mob: sf.userData.mob, tutta: I, top: V3(dv.x + Math.sin(-O.rotation.z) * top.x, dv.y + Math.cos(O.rotation.z) * top.x, top.zt) };
  }
  function lathe(prof, mat, seg) { const g = new THREE.LatheGeometry(prof.map(q => new THREE.Vector2(q[0], q[1])), seg || 16); g.rotateX(Math.PI / 2); return mesh(g, mat); }
  /* unisce le mesh statiche con lo stesso materiale (meno draw call con 40 velivoli in scena) */
  function unisci(g) {
    g.updateMatrixWorld(true); const inv = g.matrixWorld.clone().invert(), gruppi = new Map(), via = [];
    g.traverse(o => { if (!o.isMesh || o.renderOrder) return; let q = o; while (q && q !== g) { if (q.userData.mob) return; q = q.parent; }
      const pos = o.geometry.attributes; if (!pos.position || !pos.normal || !pos.uv) return; if (!gruppi.has(o.material)) gruppi.set(o.material, []); gruppi.get(o.material).push(o); });
    gruppi.forEach((lista, mat) => { if (lista.length < 2) return; const P = [], N = [], U = [], I = []; let off = 0;
      lista.forEach(o => { const geo = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)), a = geo.attributes, n = a.position.count;
        for (let i = 0; i < n; i++) { P.push(a.position.getX(i), a.position.getY(i), a.position.getZ(i)); N.push(a.normal.getX(i), a.normal.getY(i), a.normal.getZ(i)); U.push(a.uv.getX(i), a.uv.getY(i)); }
        if (geo.index) { const ix = geo.index; for (let i = 0; i < ix.count; i++) I.push(ix.getX(i) + off); } else for (let i = 0; i < n; i++) I.push(i + off);
        off += n; via.push(o); });
      const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); gg.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3)); gg.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); gg.setIndex(I);
      g.add(mesh(gg, mat)); });
    via.forEach(o => o.parent.remove(o));
  }
  function decalAla(g, a, frac, tex, w, mat) { // insegna piatta sul dorso dell'ala
    [1, -1].forEach(s => { const inf = infoAla(a, inf0(a) * frac), x = s * inf0(a) * frac, d = decal(tex, w, w, mat); d.rotation.order = "ZYX"; d.rotation.set(-Math.PI / 2, 0, s * d2r(a.diedro || 0)); d.position.set(x, inf.yt + 0.02, inf.zl - inf.c * 0.42); g.add(d); });
  }
  const inf0 = a => a.st[a.st.length - 1][0];
  function decalFus(g, sez, z, tex, w, dy, mat) { const s = sezA(sez, z), xs = s.w * (1 + s.ch) + 0.015; [1, -1].forEach(k => { const d = decal(tex, w, w * (tex.image.height / tex.image.width), mat); d.rotation.y = k * Math.PI / 2; d.position.set(k * (s.x + xs), s.y + (dy || 0), z); g.add(d); }); }
  function supTop(sez, z, x) { const s = sezA(sez, z), k = Math.min(0.98, Math.abs(x || 0) / (s.w || 1)); return s.y + s.h * s.top * Math.sqrt(1 - k * k); }
  function luciNav(g, xt, y, z) { g.add(luce(-xt, y, z, 0xff2a2a)); g.add(luce(xt, y, z, 0x2aff5a)); }

  /* ---------- costruzione caccia ---------- */
  function costruisci(tipoId, opt) {
    opt = opt || {}; const p = TIPI[tipoId] || TIPI.F16, col = opt.colore != null ? opt.colore : p.col, rosso = rossastro(col);
    const numero = opt.numero != null ? String(opt.numero) : (p.numero || "01"), M = materiali(col, p.stealth, p.cn && p.cn.oro);
    const matFin = new THREE.MeshStandardMaterial({ map: texDeriva(col, numero, rosso, p.stealth), roughness: 0.55, metalness: 0.3 }), matIns = matDecal(texInsegna(rosso));
    const g = new THREE.Group(); g.name = "velivolo_" + tipoId;
    if (p.cat === "liner") return liner(p, g, M, matFin, matIns, rosso, opt);
    const ext = p.ext || {};
    g.add(loft(p.fus, M.skin, { n: 28, sub: 2, zSplit: p.radome, matSplit: M.radome }));
    g.add(tettuccio(p.cn, M));
    (p.prese || []).forEach(pr => g.add(presa(pr, M)));
    (p.lofts || []).forEach(l => { g.add(loft(l.sez, M.skin, { n: 20 })); if (l.dop) g.add(loft(specchiaSez(l.sez), M.skin, { n: 20 })); });
    if (p.sting) { const s = p.sting, L = s.z0 - s.z1, st = lathe([[0.001, s.z1], [s.r * 0.35, s.z1 + 0.2], [s.r * 0.75, s.z1 + L * 0.2], [s.r * 0.95, s.z1 + L * 0.45], [s.r, s.z0]], M.skin, 18); st.position.y = s.y; g.add(st);
      const pt = lathe([[0.001, s.z1], [s.r * 0.36, s.z1 + 0.21], [s.r * 0.6, s.z1 + L * 0.12]], M.radome, 18); pt.position.y = s.y; g.add(pt); }
    if (p.lerx) g.add(coppia(Object.assign({ diedro: 0 }, p.lerx), M).G);
    const W = coppia(p.ala, M); g.add(W.G); const ailerons = W.mob;
    let stab = null, canard = null, levcon = null; const stabPiv = [];
    if (p.stab) { const c = coppiaMobile(p.stab, M); g.add(c.G); c.piv.forEach(q => stabPiv.push(q)); stab = c.G; }
    if (p.canard) { const c = coppiaMobile(p.canard, M); g.add(c.G); canard = c.piv; }
    if (p.levcon) { const c = coppiaMobile(p.levcon, M); g.add(c.G); levcon = c.piv; }
    const derive = [], timoni = [], tutte = []; let topFin = null;
    (p.derive || []).forEach(dv => { const grande = !dv.giu && dv.st.length > 2, r = deriva(dv, M, grande ? matFin : null); g.add(r.O); derive.push(r.O); r.mob.forEach(m => timoni.push(m)); if (r.tutta) tutte.push(r.tutta); if (grande && !topFin) topFin = r.top; });
    const ugelli = []; (p.ugelli || []).forEach(u => { const n = ugello(u, M); g.add(n); ugelli.push(n); });
    /* armamento e carichi */
    const armi = opt.armi || {}, eliche = [];
    const attacco = (x, z, hp, yAtt, r, L) => { if (yAtt == null) yAtt = infoAla(p.ala, x).yb + 0.03; if (hp > 0.05) g.add(Object.assign(pilone(L, hp + 0.06, M.bordo), {}).translateX(x).translateY(yAtt - hp - 0.03).translateZ(z)); return yAtt - hp - r; };
    Object.keys(p.armi || {}).forEach(nome => { const pos = p.armi[nome], n = armi[nome] != null ? armi[nome] : pos.length;
      pos.slice(0, Math.max(0, Math.min(pos.length, n))).forEach(([x, z, hp, yAtt]) => {
        const r = nome === "GBU48" ? 0.18 : nome === "POD" ? 0.3 : nome === "ADDER" ? 0.1 : nome === "AIM9" ? 0.064 : 0.09;
        const ogg = nome === "GBU48" ? bombaGbu(M) : nome === "POD" ? podAlq99(M) : missile(nome === "ADDER" ? "R77" : nome === "AIM9" ? "AIM9" : "AIM120", M);
        if (hp === -1) { const inf = infoAla(p.ala, x), sx = Math.sign(x), xr = x + sx * 0.06; g.add(mesh(new THREE.BoxGeometry(0.09, 0.12, 2.8), M.bordo, xr, inf.yTip, z)); ogg.position.set(xr, inf.yTip - 0.13, z); }
        else ogg.position.set(x, attacco(x, z, hp, yAtt, r, nome === "POD" ? 3.0 : 1.9), z);
        if (ogg.userData.elica) { ogg.userData.elica.userData.mob = true; eliche.push(ogg.userData.elica); } g.add(ogg); }); });
    const ns = armi.SERB != null ? armi.SERB : 99; (p.serb || []).slice(0, ns).forEach(([x, z, hp, L, r, yAtt]) => { const t = serbatoio(L, r, M); t.position.set(x, attacco(x, z, hp, yAtt, r, L * 0.45), z); g.add(t); });
    /* sonde, sensori, antenne */
    if (ext.pitot) { const [z, l] = ext.pitot, y = sezA(p.fus, z).y; const pt = mesh(new THREE.CylinderGeometry(0.018, 0.03, l, 6).rotateX(Math.PI / 2), M.metallo, 0, y, z + l / 2 - 0.05); g.add(pt); }
    (ext.sondaPitot || []).forEach(([x, z]) => { const s = sezA(p.fus, z); g.add(mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.4, 5).rotateX(Math.PI / 2), M.metallo, Math.sign(x) * s.w * 0.92, s.y + 0.1, z + 0.15)); });
    if (ext.sonda) { const [x, y, z, l] = ext.sonda; g.add(mesh(new THREE.CylinderGeometry(0.055, 0.07, l, 8).rotateX(Math.PI / 2), M.metallo, x, y, z + l / 2)); g.add(mesh(new THREE.CylinderGeometry(0.035, 0.09, 0.18, 8).rotateX(-Math.PI / 2), M.metallo, x, y, z + l + 0.08)); g.add(mesh(new THREE.BoxGeometry(0.16, 0.12, 0.6), M.skin, x, y - 0.04, z + 0.2)); }
    if (ext.recept != null) { const y = supTop(p.fus, ext.recept, 0); g.add(mesh(new THREE.BoxGeometry(0.44, 0.02, 0.75), M.bordo, 0, y, ext.recept)); g.add(mesh(new THREE.BoxGeometry(0.3, 0.03, 0.52), M.buio, 0, y + 0.005, ext.recept)); }
    if (ext.irst) { const [x, z, r] = ext.irst, y = supTop(p.fus, z, x); g.add(mesh(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.irst, x, y - 0.02, z)); g.add(mesh(new THREE.CylinderGeometry(r * 1.15, r * 1.25, 0.06, 12), M.telaio, x, y - 0.02, z)); }
    const inf = infoAla(p.ala, inf0(p.ala)); let xLuci = inf.xt + 0.03;
    if (ext.podPunta) { const [L, r, z] = ext.podPunta; [1, -1].forEach(s => g.add(mesh(corpoLathe(L, r, 2.2, 0.3, 10), M.pod, s * (inf.xt + r * 0.7), inf.yTip, z))); xLuci = inf.xt + r * 1.5; }
    (ext.lame || []).forEach(([z, su]) => { const s = sezA(p.fus, z), l = lama(0.26, 0.34, M.bordo); if (su > 0) l.position.set(0, s.y + s.h * s.top - 0.01, z); else { l.rotation.z = Math.PI; l.position.set(0, s.y - s.h * s.bot + 0.01, z); } g.add(l); });
    (ext.form || []).forEach(z => { const s = sezA(p.fus, z), xs = s.w * (1 + s.ch) + 0.012; [1, -1].forEach(k => g.add(mesh(new THREE.BoxGeometry(0.02, Math.min(0.5, s.h * 0.7), 0.07), M.formaz, k * xs, s.y + 0.05, z))); });
    /* marcature */
    decalAla(g, p.ala, 0.66, matIns.map, Math.min(1.25, inf.c * 0.9 + 0.2), matIns);
    const noStep = matDecal(texTesto("NO STEP", 128, 32, "rgba(20,20,20,0.85)", true)); [1, -1].forEach(s => { const a = infoAla(p.ala, p.ala.st[0][0] + 0.9), d = decal(null, 0.8, 0.2, noStep); d.rotation.order = "ZYX"; d.rotation.set(-Math.PI / 2, 0, s * d2r(p.ala.diedro || 0)); d.position.set(s * (p.ala.st[0][0] + 0.9), a.yt + 0.02, a.zl - a.c * 0.45); g.add(d); });
    if (ext.ins != null) decalFus(g, p.fus, ext.ins, matIns.map, 0.75, 0, matIns);
    /* luci: navigazione, coda, strobe */
    const zLuci = inf.zl - 0.3; luciNav(g, xLuci, inf.yTip, zLuci); const zc = p.fus[p.fus.length - 1].z; g.add(luce(0, sezA(p.fus, zc + 0.3).y + 0.3, zc - 0.2, 0xffffff, 0.35));
    const strobe = luce(topFin ? topFin.x : 0, topFin ? topFin.y : 1.5, topFin ? topFin.z : zc, 0xffffff, 0.6); g.add(strobe);
    g.traverse(o => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = false; } });
    unisci(g);
    g.userData.parti = { ailerons, derive, timoni, tutte, ugelli, strobe, stab, stabPiv, canard, levcon, eliche, len: p.len };
    /* anim(stato): {rollRate (°/s), pitchRate (°/s), yawRate (°/s), afterburner (0..1), t (s)} */
    g.userData.anim = s => {
      const q = g.userData.parti, t = s.t || 0, cl = THREE.MathUtils.clamp, a = d2r(cl((s.rollRate || 0) / 90 * 20, -20, 20)), e = d2r(cl((s.pitchRate || 0) / 15 * 15, -15, 15)), r = d2r(cl((s.yawRate || 0) / 10 * 12, -12, 12));
      q.ailerons.forEach(m => { m.piv.rotation.x = m.tipo === "alettone" ? a : m.tipo === "elevone" ? cl(a * 0.7 + e * 0.8 * m.s, -0.4, 0.4) : m.tipo === "flap" ? -0.05 * m.s : 0; });
      q.stabPiv.forEach(m => { m.piv.rotation.x = cl(e + m.s * a * 0.4, -0.35, 0.35); });
      if (q.canard) q.canard.forEach(m => { m.piv.rotation.x = -e * 0.8; }); if (q.levcon) q.levcon.forEach(m => { m.piv.rotation.x = -e * 0.6; });
      q.timoni.forEach(m => { m.piv.rotation.x = -r; }); q.tutte.forEach(I => { I.rotation.y = -r * 0.7; });
      q.eliche.forEach(el => { el.rotation.z = t * 45; });
      const ab = s.afterburner || 0;
      q.ugelli.forEach(u => { const F = u.userData.fiamma, mt = u.userData.mats, fl = 0.85 + 0.15 * Math.sin(t * 47 + u.position.x * 3);
        F.visible = ab > 0.05; F.scale.z = (0.3 + ab * 0.95) * fl; mt.fiamma.opacity = 0.3 + 0.45 * ab; mt.nucleo.opacity = 0.5 + 0.4 * ab;
        mt.diamanti.opacity = ab > 0.4 ? (ab - 0.4) * 1.2 * fl : 0; F.userData.diamanti.forEach((d, i) => d.visible = ab > 0.4 + i * 0.1);
        mt.glow.color.setHSL(0.07, 1, 0.1 + 0.4 * ab); mt.anello.opacity = 0.25 + 0.65 * ab;
        if (u.userData.flap) u.userData.flap.forEach(f => { f.pv.rotation.x = cl(e * 0.8, -0.35, 0.35) + f.sy * 0.04 * (1 - ab); }); });
      q.strobe.visible = Math.floor(t * 1.5) % 2 === 0 || (t % 0.6) < 0.08;
    };
    return g;
  }

  /* ---------- velivoli da supporto (A330 MRTT, 737 Wedgetail) ---------- */
  function fascia(sez, z0, z1, a0, a1, k, mat, passo) { // striscia che segue la fusoliera (finestrini)
    const nz = 8, na = 8, pos = [], uv = [], idx = [];
    for (let i = 0; i <= nz; i++) { const z = z0 + (z1 - z0) * i / nz, s = Object.assign({}, sezA(sez, z)); s.w *= k; s.h *= k;
      for (let j = 0; j <= na; j++) { const q = puntoSez(s, a0 + (a1 - a0) * j / na); pos.push(q[0], q[1], z); uv.push(passo ? (z0 - z) / passo : j / na, passo ? j / na : 1 - i / nz); } }
    for (let i = 0; i < nz; i++) for (let j = 0; j < na; j++) { const a = i * (na + 1) + j, b = a + 1, c = a + na + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.renderOrder = 1; return m;
  }
  function texFinestrini() {
    if (texCache.fin) return texCache.fin; const c = tela(64, 64), g = c.getContext("2d"); g.fillStyle = "#11161c"; g.beginPath();
    if (g.roundRect) g.roundRect(22, 14, 20, 36, 8); else g.rect(22, 14, 20, 36); g.fill(); const t = texDa(c, true); t.wrapT = THREE.ClampToEdgeWrapping; return (texCache.fin = t);
  }
  function texCabina() {
    if (texCache.cab) return texCache.cab; const c = tela(256, 64), g = c.getContext("2d"); g.fillStyle = "#0d1218";
    [[8, 30, 40], [56, 18, 52], [116, 14, 56], [176, 18, 52], [218, 30, 40]].forEach(([x, y, w]) => { g.beginPath(); g.moveTo(x, y + 26); g.lineTo(x + 4, y); g.lineTo(x + w - 4, y); g.lineTo(x + w, y + 26); g.closePath(); g.fill(); });
    return (texCache.cab = texDa(c));
  }
  function motore(m, M, sx) { // nacella turbofan con fan visibile, cono di scarico, pilone
    const G = new THREE.Group(), x = m.x * sx, r = m.r, b = m.piatto ? 0.8 : 1, z0 = m.z, l = m.l;
    const sez = [[z0, r * 0.9], [z0 - 0.22, r], [z0 - l * 0.35, r * 1.02], [z0 - l * 0.72, r * 0.92], [z0 - l, r * 0.7]].map(([z, rr]) => ({ z, x, y: m.y, w: rr, h: rr, bot: b }));
    G.add(loft(sez, M.skinDS, { n: 28, cap0: false }));
    const lab = mesh(new THREE.TorusGeometry(r * 0.92, r * 0.07, 4, 24), M.condotto, x, m.y, z0); lab.scale.y = (1 + b) / 2; G.add(lab); // labbro presa
    const fan = new THREE.Group(); fan.position.set(x, m.y, z0 - 0.5); fan.userData.mob = true;
    fan.add(mesh(new THREE.CircleGeometry(r * 0.86, 24), M.buio, 0, 0, -0.05)); const sp = mesh(new THREE.ConeGeometry(r * 0.24, r * 0.5, 14), M.metallo, 0, 0, r * 0.2); sp.rotation.x = Math.PI / 2; fan.add(sp);
    for (let i = 0; i < 18; i++) { const pv = new THREE.Group(); pv.rotation.z = i / 18 * Math.PI * 2; const pa = mesh(new THREE.BoxGeometry(r * 0.13, r * 0.62, 0.03), M.metallo, 0, r * 0.53, 0); pa.rotation.y = 0.55; pv.add(pa); fan.add(pv); }
    G.add(fan); const cono = mesh(new THREE.ConeGeometry(r * 0.42, r * 1.3, 16), M.metallo, x, m.y, z0 - l - r * 0.6); cono.rotation.x = -Math.PI / 2; G.add(cono);
    G.userData.fan = fan; return G;
  }
  function liner(p, g, M, matFin, matIns, rosso, opt) {
    g.add(loft(p.fus, M.skin, { n: 32, sub: 2, zSplit: p.radome, matSplit: M.radome }));
    const v = p.ventre; g.add(loft(S([[v.z0, 0.3, 0.2, v.y + 0.2], [v.z0 - 3, v.w, v.h, v.y], [v.z1 + 3, v.w, v.h, v.y], [v.z1, 0.4, 0.3, v.y + 0.2]]), M.skin, { n: 20 })); // carenatura ala-fusoliera
    g.add(fascia(p.fus, p.cockpit + 1.3, p.cockpit - 0.3, 0.22, Math.PI - 0.22, 1.004, matDecal(texCabina())));
    if (p.finestre) { const mf = matDecal(texFinestrini()); [[-0.1, 0.12], [Math.PI - 0.12, Math.PI + 0.1]].forEach(([a0, a1]) => g.add(fascia(p.fus, p.finestre[0], p.finestre[1], a0, a1, 1.003, mf, 0.53))); }
    const W = coppia(p.ala, M); g.add(W.G); const ailerons = W.mob, inf = infoAla(p.ala, inf0(p.ala));
    let xLuci = inf.xt + 0.05;
    if (p.winglet) [1, -1].forEach(s => g.add(deriva({ x: s * inf.xt, y: inf.yTip, cant: p.winglet.cant, st: p.winglet.st }, M).O));
    const S2 = coppia(p.stab, M); g.add(S2.G); S2.mob.forEach(m => { m.tipo = "elevatore"; ailerons.push(m); });
    const derive = [], timoni = []; let topFin = null;
    p.derive.forEach(dv => { const grande = !dv.giu && dv.st.length > 2, r = deriva(dv, M, grande ? matFin : null); g.add(r.O); derive.push(r.O); r.mob.forEach(m => timoni.push(m)); if (grande && !topFin) topFin = r.top; });
    const fans = []; (p.motori || []).forEach(m => [1, -1].forEach(sx => { const e = motore(m, M, sx); g.add(e); fans.push(e.userData.fan);
      const ia = infoAla(p.ala, m.x), h = ia.yb - (m.y + m.r) + 0.5, pl = pilone(m.l * 1.15, h, M.skin); pl.position.set(sx * m.x, m.y + m.r - 0.4, m.z - m.l * 0.55); g.add(pl); }));
    const eliche = [];
    if (p.podAla) [1, -1].forEach(s => { const [x, z] = p.podAla, ia = infoAla(p.ala, x), y = ia.yb - 0.55 - 0.42; g.add(mesh(corpoLathe(4.2, 0.42, 2.2, 0.35, 14), M.pod, s * x, y, z)); const pl = pilone(2.6, 0.62, M.skin); pl.position.set(s * x, y + 0.38, z); g.add(pl);
      const el = mesh(new THREE.BoxGeometry(0.9, 0.08, 0.03), M.metallo, s * x, y, z + 2.2); el.userData.mob = true; g.add(el); eliche.push(el); });
    let boom = null;
    if (p.boom) { boom = new THREE.Group(); boom.position.set(0, p.boom.y, p.boom.z); boom.userData.mob = true; boom.rotation.x = -0.4;
      boom.add(mesh(new THREE.SphereGeometry(0.55, 12, 8), M.skin)); const tb = new THREE.CylinderGeometry(0.3, 0.24, 11, 12); tb.rotateX(Math.PI / 2); tb.translate(0, 0, -5.5); boom.add(mesh(tb, M.skin));
      const tl = new THREE.CylinderGeometry(0.13, 0.13, 5, 8); tl.rotateX(Math.PI / 2); tl.translate(0, 0, -13.2); boom.add(mesh(tl, M.metallo)); boom.add(mesh(new THREE.ConeGeometry(0.2, 0.5, 8).rotateX(-Math.PI / 2), M.metallo, 0, 0, -15.8));
      [1, -1].forEach(s => { const sf = superficie(staz([[0.2, 0.6, -0.6, 0.08], [1.7, -0.15, -0.75, 0.06]]), { mat: M.skin, s }); sf.position.z = -9.6; sf.rotation.z = s * 0.6; boom.add(sf); }); // alette (ruddevator) a V
      boom.add(luce(0, -0.3, -10.5, 0xfff2c0, 0.4)); g.add(boom); }
    if (p.mesa) { [-1.2, -6.2].forEach(z => g.add(deriva({ x: 0, y: 1.82, st: [[0, z + 0.95, z - 0.95, 0.16], [1.65, z + 0.8, z - 0.7, 0.14]] }, M).O)); // piloni dorsali
      g.add(loft(S([[1.7, 0.05, 0.3, 4.12, 1, 1, 6], [1.2, 0.38, 0.62, 4.12, 1, 1, 8], [-8.6, 0.38, 0.62, 4.12, 1, 1, 8], [-9.1, 0.05, 0.3, 4.12, 1, 1, 6]]), M.radome, { n: 20 })); // trave MESA
      g.add(loft(S([[-0.6, 0.05, 0.05, 4.74, 1, 1, 4], [-1.4, 0.5, 0.3, 4.74, 1, 1, 4], [-6.0, 0.5, 0.3, 4.74, 1, 1, 4], [-6.8, 0.05, 0.05, 4.74, 1, 1, 4]]), M.radome, { n: 20 })); } // "top hat"
    [[3.0, -1], [-4.0, 1], [8.0, 1], [-1.0, -1]].forEach(([z, su]) => { const s = sezA(p.fus, z), l = lama(0.45, 0.6, M.bordo); if (su > 0) l.position.set(0, s.y + s.h - 0.02, z); else { l.rotation.z = Math.PI; l.position.set(0, s.y - s.h + 0.02, z); } g.add(l); });
    /* marcature: coccarde, scritta, numero in deriva */
    decalAla(g, p.ala, 0.72, matIns.map, 2.6, matIns); decalFus(g, p.fus, p.ins, matIns.map, 1.9, 0.2, matIns);
    const tit = matDecal(texTesto(rosso ? "ВВС РОССИИ" : "AERONAUTICA MILITARE", 512, 48, "rgba(25,30,40,0.9)")); [1, -1].forEach(k => { const s = sezA(p.fus, 8), R = s.h, yy = R * 0.42, d = decal(null, 11, 1.03, tit); d.rotation.order = "ZYX"; d.rotation.set(0, k * Math.PI / 2, k * Math.asin(0.42)); d.position.set(k * (Math.sqrt(R * R - yy * yy) + 0.04), s.y + yy, 8); g.add(d); });
    /* luci: navigazione, faro di coda, beacon rossi, strobe d'estremità */
    luciNav(g, xLuci, inf.yTip, inf.zl - 0.4); const zc = p.fus[p.fus.length - 1].z; g.add(luce(0, p.fus[p.fus.length - 1].y, zc - 0.2, 0xffffff, 0.6));
    const strobe = new THREE.Group(); [1, -1].forEach(s => strobe.add(luce(s * xLuci, inf.yTip, inf.zt + 0.2, 0xffffff, 1.0))); if (topFin) strobe.add(luce(topFin.x, topFin.y, topFin.z, 0xffffff, 0.7)); g.add(strobe);
    const s0 = sezA(p.fus, 0), beacon = [luce(0, s0.y + s0.h + 0.15, 0, 0xff2020, 0.9), luce(0, s0.y - s0.h - 0.15, 3, 0xff2020, 0.9)]; beacon.forEach(b => g.add(b));
    g.traverse(o => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = false; } });
    unisci(g);
    g.userData.parti = { ailerons, derive, timoni, tutte: [], ugelli: [], strobe, stab: S2.G, stabPiv: [], canard: null, levcon: null, eliche, fans, boom, beacon, len: p.len };
    g.userData.anim = s => {
      const q = g.userData.parti, t = s.t || 0, cl = THREE.MathUtils.clamp, a = d2r(cl((s.rollRate || 0) / 30 * 15, -15, 15)), e = d2r(cl((s.pitchRate || 0) / 6 * 12, -12, 12)), r = d2r(cl((s.yawRate || 0) / 5 * 10, -10, 10));
      q.ailerons.forEach(m => { m.piv.rotation.x = m.tipo === "alettone" ? a : m.tipo === "elevatore" ? e * m.s : 0; }); q.timoni.forEach(m => { m.piv.rotation.x = -r; });
      q.fans.forEach(f => { f.rotation.z = t * (25 + 15 * (s.afterburner || 0)); }); q.eliche.forEach(el => { el.rotation.z = t * 30; });
      if (q.boom) q.boom.rotation.x = -0.4 + 0.03 * Math.sin(t * 0.7); if (q.boom) q.boom.rotation.y = 0.02 * Math.sin(t * 0.43);
      const ph = t % 1.2; q.strobe.visible = ph < 0.06 || (ph > 0.14 && ph < 0.2); q.beacon.forEach(b => b.visible = (t % 1.0) < 0.12);
    };
    return g;
  }
  return { costruisci, TIPI };
})();
/* =====================================================================
   VISTA 3D DELLA MISSIONE (tempo reale, tutta l'area operativa)
   - terreno satellitare Esri + quote AWS Terrarium su ~450 × 270 km
   - tutte le formazioni (modelli dalle sagome), scie, etichette, anelli SAM,
     basi, target, tanker, gate, CAP box, rotte pianificate
   - eventi del motore visualizzati: missili (MERGED), lanci SAM, abbattimenti, bombe
   - 6 telecamere selezionabili: Orbita · Inseguimento · Cockpit (HUD) · Torre · Satellite · Target
   - cielo/sole/nebbia/nubi dal meteo (anche NOAA) e dall'ora simulata
   ===================================================================== */
const MONDO3D = (() => {
  let overlay, canvas, hudCanvas, hudCtx, renderer, scene, camera, raf, st, clock;
  const TERRA = { grids: {}, ready: false, t: null, tileM: 0, lat0: 0, lon0: 0 };
  const M_LAT = 111320;
  const CAM = ["orbita", "insegui", "cockpit", "torre", "satellite", "target"];
  const CAM_NOMI = { orbita: "1 · Orbita libera", insegui: "2 · Chase (gioco)", cockpit: "3 · Cockpit HUD", torre: "4 · Torre", satellite: "5 · Satellite", target: "6 · Target" };
  // posizioni dei gregari nella formazione (metri, locali al leader: x = sinistra, y = alto, z = avanti): combat spread a scalare
  const FORM_OFF = [[0, 0, 0], [-75, -5, -45], [115, 9, -85], [-160, -12, -130]];

  /* ---------- coordinate ---------- */
  const mLon = () => M_LAT * Math.cos(TERRA.lat0 * Math.PI / 180);
  const toXZ = (lat, lon) => ({ x: (lon - TERRA.lon0) * mLon(), z: -(lat - TERRA.lat0) * M_LAT });
  const elev = (x, z) => {
    if (!TERRA.ready) return 0; const fx = TERRA.t.x + x / TERRA.tileM, fy = TERRA.t.y + z / TERRA.tileM; const tx = Math.floor(fx), ty = Math.floor(fy); const g = TERRA.grids[tx + "_" + ty]; if (!g) return 0;
    const px = (fx - tx) * 255, py = (fy - ty) * 255; const x0 = Math.floor(px), y0 = Math.floor(py), x1 = Math.min(255, x0 + 1), y1 = Math.min(255, y0 + 1); const ax = px - x0, ay = py - y0;
    return Math.max(0, g[y0 * 256 + x0] * (1 - ax) * (1 - ay) + g[y0 * 256 + x1] * ax * (1 - ay) + g[y1 * 256 + x0] * (1 - ax) * ay + g[y1 * 256 + x1] * ax * ay) * (st ? st.esag : 1);
  };
  function lonLatToTile(lon, lat, z) { const n = 2 ** z; const x = (lon + 180) / 360 * n; const lr = lat * Math.PI / 180; const y = (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n; return { x, y, n }; }
  function matStd(c, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, metalness: 0.15 }, extra || {})); }
  function srgb(tex) { if (THREE.sRGBEncoding !== undefined && tex.encoding !== undefined) tex.encoding = THREE.sRGBEncoding; else if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace; return tex; }

  /* ---------- DOM ---------- */
  function dom() {
    if (overlay) return;
    overlay = document.createElement("div"); overlay.id = "mondo3d"; overlay.className = "hidden";
    overlay.innerHTML = `<canvas id="m3d-canvas"></canvas><div id="m3d-nvg"><canvas width="192" height="108"></canvas></div><canvas id="m3d-hud"></canvas>
      <div class="m3d-bar"><div class="m3d-cams">${CAM.map(c => `<button data-cam="${c}">${CAM_NOMI[c]}</button>`).join("")}</div>
        <div class="m3d-ctrl"><select id="m3d-sel"></select><button id="m3d-prev">◀</button><button id="m3d-next">▶</button><span class="sep"></span>
        <button id="m3d-nvgb" title="Visore notturno NVG nella camera cockpit (tasto N)">NVG</button><span class="sep"></span><button id="m3d-play">▶</button><span id="m3d-speeds"></span><span class="sep"></span>
        <label><input type="checkbox" id="m3d-scala" checked> velivoli ingranditi</label><label><input type="checkbox" id="m3d-esag"> rilievo ×2</label><label><input type="checkbox" id="m3d-rotte" checked> rotte</label>
        <button id="m3d-close" class="btn">✕ Torna alla mappa</button></div></div>
      <div class="m3d-info"><span id="m3d-clock"></span><span id="m3d-cam"></span><span id="m3d-hint">Orbita: trascina per ruotare, rotella zoom, tasto destro sposta · Chase: trascina attorno al velivolo, rotella zoom, doppio clic reset · tasti 1-6 telecamere · [ ] velivolo precedente/successivo · menu: ogni aereo in volo</span></div>
      <div id="m3d-ticker" class="m3d-ticker"></div>`;
    document.body.appendChild(overlay); canvas = overlay.querySelector("#m3d-canvas"); hudCanvas = overlay.querySelector("#m3d-hud"); hudCtx = hudCanvas.getContext("2d");
    overlay.querySelectorAll("[data-cam]").forEach(b => b.onclick = () => setCam(b.dataset.cam));
    overlay.querySelector("#m3d-close").onclick = chiudi; overlay.querySelector("#m3d-sel").onchange = e => { const v = e.target.value, k = v.lastIndexOf(":"); st.sel = v.slice(0, k); st.selEl = +v.slice(k + 1) || 0; st.orbit.focusFlight = true; if (st.cam === "orbita" || st.cam === "target") setCam("insegui"); };   // la vista "target" non segue i velivoli: si passa al chase
    overlay.querySelector("#m3d-prev").onclick = () => cicla(-1); overlay.querySelector("#m3d-next").onclick = () => cicla(1);
    overlay.querySelector("#m3d-play").onclick = () => APP.play(!APP.playing);
    overlay.querySelector("#m3d-scala").onchange = e => st.scalaGrande = e.target.checked; overlay.querySelector("#m3d-esag").onchange = e => { st.esag = e.target.checked ? 2 : 1; riquota(); };
    overlay.querySelector("#m3d-rotte").onchange = e => { st.rotteOn = e.target.checked; st.rotte.visible = st.rotteOn; };
    const sp = overlay.querySelector("#m3d-speeds"); APP.sc.tempo.velocita.forEach(v => { const b = document.createElement("button"); b.textContent = "×" + v; b.dataset.v = v; b.onclick = () => APP.setSpeed(v); sp.appendChild(b); });
    // mouse orbit
    let drag = null;
    // mouse e touch (pointer events): un dito/tasto sinistro ruota, tasto destro o due dita spostano, rotella o pinch zoomano
    const puntatori = new Map(); let pinch = null;
    const zoom = k => { if (!st) return; if (st.cam === "insegui") { st.chase.dist = Math.max(12, Math.min(4000, st.chase.dist * k)); return; } st.orbit.r = Math.max(60, Math.min(600000, st.orbit.r * k)); };
    const sposta = (dx, dy) => { const o = st.orbit; const k = o.r * 0.0015; const yaw = o.theta; o.target.x -= Math.cos(yaw) * dx * k; o.target.z -= -Math.sin(yaw) * dx * k; o.target.x -= Math.sin(yaw) * dy * k; o.target.z -= Math.cos(yaw) * dy * k; o.focusFlight = false; };
    canvas.addEventListener("pointerdown", e => { if (!st) return; canvas.setPointerCapture(e.pointerId); puntatori.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (puntatori.size === 1) { drag = { x: e.clientX, y: e.clientY, b: e.button, id: e.pointerId }; if (st.cam !== "orbita" && st.cam !== "insegui") setCam("orbita"); }
      if (puntatori.size === 2) { const [a, b] = [...puntatori.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; drag = null; } });
    const fine = e => { puntatori.delete(e.pointerId); if (puntatori.size < 2) pinch = null; if (puntatori.size === 0) drag = null; };
    canvas.addEventListener("pointerup", fine); canvas.addEventListener("pointercancel", fine); canvas.addEventListener("lostpointercapture", fine);
    canvas.addEventListener("pointermove", e => { if (!st) return; const p = puntatori.get(e.pointerId); if (p) { p.x = e.clientX; p.y = e.clientY; }
      if (pinch && puntatori.size === 2) { const [a, b] = [...puntatori.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2; if (d > 0 && pinch.d > 0) zoom(pinch.d / d); if (st.cam === "orbita") sposta(cx - pinch.cx, cy - pinch.cy); pinch = { d, cx, cy }; return; }
      if (!drag || drag.id !== e.pointerId) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      if (st.cam === "insegui") { const c = st.chase; c.yaw -= dx * 0.006; c.pitch = Math.max(-0.6, Math.min(1.3, c.pitch + dy * 0.006)); return; }
      if (drag.b === 2) sposta(dx, dy); else { const o = st.orbit; o.theta -= dx * 0.005; o.phi = Math.max(0.05, Math.min(1.5, o.phi + dy * 0.005)); } });
    canvas.addEventListener("wheel", e => { if (!st) return; e.preventDefault(); zoom(e.deltaY > 0 ? 1.15 : 0.87); }, { passive: false });
    canvas.addEventListener("dblclick", () => { if (st && st.cam === "insegui") { st.chase.yaw = 0; st.chase.pitch = 0.22; st.chase.dist = 60; } });
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    window.addEventListener("keydown", e => { if (!st || overlay.classList.contains("hidden") || e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return; const i = parseInt(e.key); if (i >= 1 && i <= 6) setCam(CAM[i - 1]); if (e.key === "[") cicla(-1); if (e.key === "]") cicla(1); if (e.key === "n" || e.key === "N") nvg(); if (e.key === "Escape") chiudi(); });
    overlay.querySelector("#m3d-nvgb").onclick = () => nvg();
    window.addEventListener("resize", () => { if (renderer && !overlay.classList.contains("hidden")) { renderer.setSize(window.innerWidth, window.innerHeight); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); hudCanvas.width = window.innerWidth; hudCanvas.height = window.innerHeight; } });
  }
  // visore notturno: immagine intensificata verde con grana e campo circolare, solo nella camera cockpit (è il visore del pilota)
  function nvg() { if (!st) return; st.nvg = !st.nvg; if (st.nvg && st.cam !== "cockpit") setCam("cockpit"); }
  let nvgCtx = null, nvgImg = null;
  function aggiornaNvg() {
    const on = !!(st.nvg && st.cam === "cockpit"); overlay.querySelector("#m3d-canvas").classList.toggle("nvg", on); renderer.toneMappingExposure = on ? (st.notte ? 6 : 1.2) : 1; overlay.querySelector("#m3d-nvg").classList.toggle("on", on); overlay.querySelector("#m3d-nvgb").classList.toggle("active", !!st.nvg);
    if (!on || (st.frame || 0) % 2) return; if (!nvgCtx) { const c = overlay.querySelector("#m3d-nvg canvas"); nvgCtx = c.getContext("2d"); nvgImg = nvgCtx.createImageData(c.width, c.height); }
    const px = nvgImg.data; for (let i = 0; i < px.length; i += 4) { const v = Math.random() * 255; px[i] = v * 0.6; px[i + 1] = v; px[i + 2] = v * 0.6; px[i + 3] = 255; } nvgCtx.putImageData(nvgImg, 0, 0);
  }
  function setCam(c) { st.cam = c; overlay.querySelectorAll("[data-cam]").forEach(b => b.classList.toggle("active", b.dataset.cam === c)); overlay.querySelector("#m3d-cam").textContent = CAM_NOMI[c]; if (c === "orbita") st.orbit.focusFlight = true; }
  // elenco di tutti i velivoli in volo (una voce per ogni aereo della formazione), prima la propria squadra
  function inVolo() { const eng = APP.engine; const mio = APP.ruolo === "RED" ? "RED" : "BLUE"; const list = []; eng.flights.filter(f => !f.distrutto && f.alt > 50).sort((a, b) => (a.lato === mio ? 0 : 1) - (b.lato === mio ? 0 : 1)).forEach(f => { for (let i = 0; i < Math.min(4, f.n); i++) list.push({ f, i }); }); (st.aux || []).forEach(a => list.push({ f: a, i: 0, aux: true })); return list; }
  function cicla(d) { const list = inVolo(); if (!list.length) return; let i = list.findIndex(x => x.f.id === st.sel && x.i === (st.selEl || 0)); i = (i + d + list.length) % list.length; st.sel = list[i].f.id; st.selEl = list[i].i; overlay.querySelector("#m3d-sel").value = st.sel + ":" + st.selEl; st.orbit.focusFlight = true; }
  function aggiornaSelect() {
    const eng = APP.engine; const sel = overlay.querySelector("#m3d-sel"); const cur = st.sel + ":" + (st.selEl || 0); const grp = {};
    inVolo().forEach(({ f, i, aux }) => { if (aux) { const k = "Tanker e AWACS"; (grp[k] = grp[k] || []).push(`<option value="${f.id}:0">✈ ${f.nome} · ${(APP.sc.tipi[f.tipo] || {}).nome || f.tipo}</option>`); return; } const k = f.lato + " in volo"; (grp[k] = grp[k] || []).push(`<option value="${f.id}:${i}">✈ ${f.callsign} ${i + 1}${i === 0 ? " (lead)" : ""} · ${(APP.sc.tipi[f.tipo] || {}).nome || f.tipo} · ${f.fase}</option>`); });
    eng.flights.filter(f => !f.distrutto && f.alt <= 50).forEach(f => { const k = f.lato + " a terra"; (grp[k] = grp[k] || []).push(`<option value="${f.id}:0">⌂ ${f.callsign} · ${f.n}x ${f.tipo} · ${f.fase}</option>`); });
    const opts = Object.entries(grp).map(([k, v]) => `<optgroup label="${k}">${v.join("")}</optgroup>`).join("");
    if (sel.innerHTML !== opts) { sel.innerHTML = opts; } if (sel.value !== cur) sel.value = cur;
  }

  /* ---------- terreno ---------- */
  function terreno(root) {
    const sc = APP.sc; const lat0 = TERRA.lat0, lon0 = TERRA.lon0; const z = 10; const t = lonLatToTile(lon0, lat0, z); const tileM = 40075016.686 * Math.cos(lat0 * Math.PI / 180) / t.n;
    Object.assign(TERRA, { grids: {}, ready: false, t, tileM, caricate: 0, totale: 0, immagini: 0 }); const loader = new THREE.TextureLoader(); loader.setCrossOrigin("anonymous");
    const base = new THREE.Mesh(new THREE.PlaneGeometry(3e6, 3e6), matStd(0x2b4a6b, { roughness: 1 })); base.rotation.x = -Math.PI / 2; base.position.y = -40; root.add(base);
    const RX = 7, RY = 4; st.tiles = []; const tx = Math.floor(t.x), ty = Math.floor(t.y);
    // ordine di caricamento: prima le tile vicine al velivolo seguito (o al centro), poi le altre
    const fSel = APP.engine.flights.find(f => f.id === st.sel); const c0 = fSel ? toXZ(fSel.lat, fSel.lon) : { x: 0, z: 0 }; const lista = [];
    for (let dx = -RX; dx <= RX; dx++) for (let dy = -RY; dy <= RY; dy++) { const cx = (tx + dx + 0.5 - t.x) * tileM, cz = (ty + dy + 0.5 - t.y) * tileM; lista.push({ dx, dy, cx, cz, d: Math.hypot(cx - c0.x, cz - c0.z) }); }
    lista.sort((a, b) => a.d - b.d); TERRA.totale = lista.length;
    const SEG = window.innerWidth < 900 ? 32 : 48;   // ~1,2 km (tablet/smartphone) o ~0,8 km tra i vertici: creste e valli restano visibili
    TERRA.byKey = {};
    lista.forEach(({ dx, dy, cx, cz }) => {
      const geo = new THREE.PlaneGeometry(tileM, tileM, SEG, SEG); geo.rotateX(-Math.PI / 2);
      const mat = matStd(0x3f5a3a, { roughness: 1, metalness: 0 }); const mesh = new THREE.Mesh(geo, mat); mesh.position.set(cx, 0, cz); mesh.receiveShadow = false; mesh.userData.key = (tx + dx) + "_" + (ty + dy); mesh.userData.tx = tx + dx; mesh.userData.ty = ty + dy; root.add(mesh); st.tiles.push(mesh); TERRA.byKey[mesh.userData.key] = mesh;
      VISTA3D.caricaTex(loader, VISTA3D.tileUrl("img", z, tx + dx, ty + dy), tex => { srgb(tex); tex.anisotropy = 8; mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; TERRA.immagini++; });
      // quote: applicate tile per tile appena arrivano (non si aspetta l'ultima), con tentativi ripetuti; poi si ricalcolano anche i bordi delle tile vicine
      VISTA3D.caricaDem(VISTA3D.tileUrl("dem", z, tx + dx, ty + dy), img => {
        try { const g = VISTA3D.demGrid(img); TERRA.grids[mesh.userData.key] = g; TERRA.ready = true; let mx = 0; for (let i = 0; i < g.length; i += 7) if (g[i] > mx) mx = g[i]; TERRA.max = Math.max(TERRA.max || 0, mx); mat.normalMap = normalMap(g, tileM / 256); mat.normalScale.set(2.2, 2.2); mat.needsUpdate = true; } catch (e) { TERRA.erroriDem = (TERRA.erroriDem || 0) + 1; }
        TERRA.caricate++; riquotaTile(mesh);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const n = TERRA.byKey[(mesh.userData.tx + a) + "_" + (mesh.userData.ty + b)]; if (n && TERRA.grids[n.userData.key]) riquotaTile(n); });
      }, () => { TERRA.caricate++; TERRA.erroriDem = (TERRA.erroriDem || 0) + 1; });
    });
  }
  /* mappa delle normali dalle quote reali (256×256): l'ombreggiatura mostra creste e valli più fini della maglia 3D */
  function normalMap(g, cella) {
    const c = document.createElement("canvas"); c.width = c.height = 256; const ctx = c.getContext("2d"); const im = ctx.createImageData(256, 256); const d = im.data;
    const h = (x, y) => g[Math.min(255, Math.max(0, y)) * 256 + Math.min(255, Math.max(0, x))];
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const nx = -(h(x + 1, y) - h(x - 1, y)) / (2 * cella), ny = (h(x, y + 1) - h(x, y - 1)) / (2 * cella); const l = Math.hypot(nx, ny, 1); const i = (y * 256 + x) * 4;
      d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
    ctx.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function riquotaTile(m) { if (!st || !TERRA.ready) return; const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, elev(p.getX(i) + m.position.x, p.getZ(i) + m.position.z)); p.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere();
    clearTimeout(TERRA._tStat); TERRA._tStat = setTimeout(() => { if (st) st.statici.forEach(o => { o.position.y = elev(o.position.x, o.position.z) + (o.userData.h || 0); }); }, 300); }
  function riquota() { if (!TERRA.ready || !st) return; st.tiles.forEach(riquotaTile); }

  /* ---------- cielo ---------- */
  function cielo() {
    const m = APP.sc.meteo || {}; const ora = APP.engine.t / 3600; const giorno = m.giorno || 165; const lat = TERRA.lat0;
    const decl = 23.44 * Math.sin(2 * Math.PI * (284 + giorno) / 365) * Math.PI / 180; const H = (ora - 12.5) * 15 * Math.PI / 180; const φ = lat * Math.PI / 180;
    const el = Math.asin(Math.sin(φ) * Math.sin(decl) + Math.cos(φ) * Math.cos(decl) * Math.cos(H)); const az = Math.atan2(-Math.sin(H), Math.tan(decl) * Math.cos(φ) - Math.sin(φ) * Math.cos(H));
    const elN = Math.max(0, Math.sin(el)); const cop = m.copertura || 0; const notte = Math.sin(el) < -0.06; st.notte = notte;
    const zen = new THREE.Color().setHSL(0.6, 0.65 - 0.35 * cop, 0.42 + 0.25 * elN - 0.1 * cop), hor = new THREE.Color().setHSL(0.58, 0.45 - 0.25 * cop, 0.8 - 0.15 * cop); if (elN < 0.25) { hor.setHSL(0.07, 0.75, 0.6); zen.setHSL(0.62, 0.55, 0.25 + elN); }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.4e6, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { zen: { value: zen }, hor: { value: hor } },
      vertexShader: "varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 zen; uniform vec3 hor; varying vec3 vW; void main(){ float h = normalize(vW).y; gl_FragColor = vec4(mix(hor, zen, pow(max(0.0,h),0.45)), 1.0); }" })); scene.add(dome);
    if (notte) { zen.set(0x02040a); hor.set(0x0b1526); }
    const sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    const sun = notte ? new THREE.DirectionalLight(0x9fb2ff, 0.16) : new THREE.DirectionalLight(0xfff2dc, (0.5 + 1.0 * elN) * (1 - 0.5 * cop)); if (notte) sunDir.set(0.5, 0.45, 0.6).normalize(); sun.position.copy(sunDir).multiplyScalar(100000); scene.add(sun);
    scene.add(notte ? new THREE.HemisphereLight(0x1d2b44, 0x040506, 0.14) : new THREE.HemisphereLight(hor, 0x4a4030, 0.55)); scene.background = hor;
    if (notte) { const N = 2000, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, e = Math.asin(Math.random() * 0.98 + 0.02), r = 1.3e6; pos.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3); } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); dome.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.5, sizeAttenuation: false, fog: false, depthWrite: false }))); st.cupola = dome; }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: VISTA3D.puffTexture(true), color: 0xfff4d6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.copy(sunDir).multiplyScalar(1.2e6); sp.scale.setScalar(notte ? 28000 : 120000); if (notte) sp.material.color.set(0xe6ecff); scene.add(sp);
    const visM = Math.max(8000, (m.visibilita_sm != null ? m.visibilita_sm : 10) * 1609); st.visM = visM; scene.fog = new THREE.Fog(hor.clone().lerp(zen, 0.2), 150000, 900000);
    if (cop > 0.3) { const h = (m.nubi_base_ft || 6000) * 0.3048; const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d"); for (let i = 0; i < 60 + 400 * cop; i++) { const x = Math.random() * 512, y = Math.random() * 512, r = 25 + Math.random() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, r); const a = 0.25 + 0.55 * cop; gr.addColorStop(0, `rgba(245,245,250,${a})`); gr.addColorStop(1, "rgba(220,224,232,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
      const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(60, 40); const cl = new THREE.Mesh(new THREE.PlaneGeometry(1.2e6, 1.2e6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); cl.rotation.x = -Math.PI / 2; cl.position.y = h; scene.add(cl); st.nubi = cl; }
  }

  /* ---------- oggetti statici ---------- */
  function label(testo, colore, size) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d"); g.font = "bold 30px Segoe UI, Arial"; g.textAlign = "center"; g.lineWidth = 6; g.strokeStyle = "rgba(0,0,0,0.85)"; g.strokeText(testo, 128, 42); g.fillStyle = colore; g.fillText(testo, 128, 42);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); sp.scale.set(size * 4, size, 1); sp.userData.base = size; return sp;
  }
  function statici() {
    const sc = APP.sc; const eng = APP.engine; const g = new THREE.Group(); scene.add(g); st.statici = [];
    const put = (o, lat, lon, h) => { const p = toXZ(lat, lon); o.position.set(p.x, h || 0, p.z); o.userData.h = h || 0; g.add(o); st.statici.push(o); return o; };
    sc.basi.forEach(b => { const col = b.lato === "BLUE" ? 0x2e86de : 0xe74c3c; put(new THREE.Mesh(new THREE.BoxGeometry(2400, 30, 60), matStd(0x8a8a8a)), b.lat, b.lon, 15); put(label(b.id, b.lato === "BLUE" ? "#9ccbff" : "#ff9c9c", 900), b.lat, b.lon, 400); put(new THREE.Mesh(new THREE.CylinderGeometry(300, 300, 20, 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35 })), b.lat, b.lon, 10); });
    sc.target.forEach(t => { put(new THREE.Mesh(new THREE.ConeGeometry(220, 500, 4), new THREE.MeshBasicMaterial({ color: 0xff6b4a })), t.lat, t.lon, 250); put(label(t.nome.split(" ")[0] + (t.nome.includes("C2") ? " C2" : ""), "#ffb199", 700), t.lat, t.lon, 900); });
    eng.sam.forEach(s => { const dome = new THREE.Mesh(new THREE.SphereGeometry(s.raggio_nm * 1852, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe74c3c, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false })); const o = put(dome, s.lat, s.lon, 0); o.userData.sam = s.id; const ring = new THREE.Mesh(new THREE.RingGeometry(s.raggio_nm * 1852 - 300, s.raggio_nm * 1852, 64), new THREE.MeshBasicMaterial({ color: 0xe74c3c, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; const r2 = put(ring, s.lat, s.lon, 30); r2.userData.sam = s.id; put(label("SA-10", "#ff9c9c", 700), s.lat, s.lon, 600).userData.sam = s.id; });
    // velivoli ausiliari in volo: tanker KC-30 sulle racetrack AAR, E-7 sulla sua orbita (animati, selezionabili dal menu)
    st.aux = []; st.auxT = eng.t;
    const mkAux = (id, tipoId, nome, lato) => { const gg = new THREE.Group(); const holder = new THREE.Group(); gg.add(holder); const att = new THREE.Group(); holder.add(att); att.add(VISTA3D.jetFallback(0x8899aa));
      VISTA3D.modelloPromise("f16", lato === "RED" ? 0x8a3a3a : undefined, { tipoId, numero: "01", callsign: nome }).then(m => { if (!st) return; while (att.children.length) att.remove(att.children[0]); att.add(m); holder.userData.mdl = m; });
      const lb = label(nome, lato === "RED" ? "#ff9c9c" : "#9ccbff", 60); lb.position.y = 60; gg.add(lb); scene.add(gg); const a = { id: "aux:" + id, g: gg, holder, lb, nome, tipo: tipoId, lato }; st.aux.push(a); return a; };
    sc.aar.forEach(a => { const x = mkAux(a.id, "KC30", (a.nome.split("–")[1] || a.id).replace(/\(.*\)/, "").trim(), "BLUE"); const q1 = toXZ(GEO.dest(a, a.orient, a.lunghezza_nm / 2).lat, GEO.dest(a, a.orient, a.lunghezza_nm / 2).lon), q2 = toXZ(GEO.dest(a, a.orient + 180, a.lunghezza_nm / 2).lat, GEO.dest(a, a.orient + 180, a.lunghezza_nm / 2).lon);
      const L = Math.hypot(q2.x - q1.x, q2.z - q1.z), R = 4500, V = 280 * 0.5144; const ux = (q2.x - q1.x) / L, uz = (q2.z - q1.z) / L, nx = -uz, nz = ux; const P = 2 * L + 2 * Math.PI * R;
      x.path = t => { let s = ((t * V) % P + P) % P; let px, pz, hx, hz, turn = 0;
        if (s < L) { px = q1.x + nx * R + ux * s; pz = q1.z + nz * R + uz * s; hx = ux; hz = uz; }
        else if (s < L + Math.PI * R) { const a0 = (s - L) / R; px = q2.x + nx * R * Math.cos(a0) + ux * R * Math.sin(a0); pz = q2.z + nz * R * Math.cos(a0) + uz * R * Math.sin(a0); hx = -nx * Math.sin(a0) + ux * Math.cos(a0); hz = -nz * Math.sin(a0) + uz * Math.cos(a0); turn = 1; }
        else if (s < 2 * L + Math.PI * R) { const k = s - L - Math.PI * R; px = q2.x - nx * R - ux * k; pz = q2.z - nz * R - uz * k; hx = -ux; hz = -uz; }
        else { const a0 = (s - 2 * L - Math.PI * R) / R; px = q1.x - nx * R * Math.cos(a0) - ux * R * Math.sin(a0); pz = q1.z - nz * R * Math.cos(a0) - uz * R * Math.sin(a0); hx = nx * Math.sin(a0) - ux * Math.cos(a0); hz = nz * Math.sin(a0) - uz * Math.cos(a0); turn = 1; }
        return { x: px, z: pz, y: a.quota_ft * 0.3048, hdg: (Math.atan2(hx, -hz) * 180 / Math.PI + 360) % 360, bank: turn ? -22 : 0, tas: 280 }; }; });
    (sc.orbite || []).forEach(o => { const x = mkAux(o.id, "E7", o.nome.replace(/ orbit$/i, ""), "BLUE"); const c = toXZ(o.lat, o.lon); const R = 14000, V = 300 * 0.5144;
      x.path = t => { const a0 = (t * V / R) % (Math.PI * 2); const px = c.x + R * Math.cos(a0), pz = c.z + R * Math.sin(a0); const hx = -Math.sin(a0), hz = Math.cos(a0); return { x: px, z: pz, y: o.quota_ft * 0.3048, hdg: (Math.atan2(hx, -hz) * 180 / Math.PI + 360) % 360, bank: 18, tas: 300 }; }; });   // orbita in senso orario (virata a destra): bank positivo
    sc.aar.forEach(a => { const p1 = GEO.dest(a, a.orient, a.lunghezza_nm / 2), p2 = GEO.dest(a, a.orient + 180, a.lunghezza_nm / 2); const q1 = toXZ(p1.lat, p1.lon), q2 = toXZ(p2.lat, p2.lon); const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(q1.x, a.quota_ft * 0.3048, q1.z), new THREE.Vector3(q2.x, a.quota_ft * 0.3048, q2.z)]); const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9ccbff, transparent: true, opacity: 0.8 })); g.add(l); put(label(a.id.replace("_", " "), "#9ccbff", 800), a.lat, a.lon, a.quota_ft * 0.3048 + 500).userData.h = a.quota_ft * 0.3048 + 500; });
    sc.gate.forEach(gt => put(label(gt.nome, "#f9e79f", 700), gt.lat, gt.lon, 500));
    if (st.notte) [[40.586, -122.39, 220], [40.178, -122.236, 90], [40.80, -124.16, 160], [41.756, -124.20, 70], [42.22, -121.78, 150], [41.735, -122.634, 60], [41.42, -122.386, 40], [41.31, -122.31, 50], [40.448, -122.297, 60], [40.867, -124.08, 70], [40.416, -120.653, 60], [40.882, -121.66, 30], [41.487, -120.542, 30], [41.21, -122.27, 30]].forEach(([la, lo, n]) => {
      const R = 900 + n * 14, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = Math.pow(Math.random(), 0.7) * R; pos.set([Math.cos(a) * d, 0, Math.sin(a) * d], i * 3); }
      const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); const pts = new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xffc67a, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); pts.frustumCulled = false; put(pts, la, lo, 15); });
    sc.cap_box.forEach(c => { const ring = new THREE.Mesh(new THREE.RingGeometry(c.raggio_nm * 1852 - 250, c.raggio_nm * 1852, 48), new THREE.MeshBasicMaterial({ color: c.lato === "RED" ? 0xe74c3c : 0x2e86de, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; put(ring, c.lat, c.lon, 25); });
    sc.mappa.nazioni.forEach(n => { const pts = n.poligono.map(([la, lo]) => { const q = toXZ(la, lo); return new THREE.Vector3(q.x, 40, q.z); }); pts.push(pts[0].clone()); g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: n.colore, transparent: true, opacity: 0.6 }))); });
    const fir = sc.mappa.fir_boundary.map(([la, lo]) => { const q = toXZ(la, lo); return new THREE.Vector3(q.x, 60, q.z); }); g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fir), new THREE.LineBasicMaterial({ color: 0xff3b2f })));
    // rotte pianificate BLUE
    st.rotte = new THREE.Group(); scene.add(st.rotte);
    eng.flights.filter(f => f.lato === "BLUE" && f.piano && f.piano.decollo).forEach(f => { try { const b = sc.basi.find(x => x.id === f.base); const wps = [b, ...eng.rottaBlue(f, true)]; const pts = wps.map(w => { const q = toXZ(w.lat, w.lon); return new THREE.Vector3(q.x, (w.alt != null ? w.alt : 25000) * 0.3048, q.z); }); st.rotte.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x5dade2, transparent: true, opacity: 0.55 }))); } catch (e) {} });
  }

  /* ---------- formazioni ---------- */
  function ent(f) {
    const sc = APP.sc; const tipo = sc.tipi[f.tipo]; const g = new THREE.Group(); const col = f.lato === "RED" ? 0x8a3a3a : undefined; const el = [];
    // una formazione = fino a 4 velivoli, ognuno con il suo modello, in combat spread attorno al leader
    for (let i = 0; i < Math.max(1, Math.min(4, f.n)); i++) {
      const holder = new THREE.Group(); g.add(holder); const att = new THREE.Group(); holder.add(att); att.add(VISTA3D.jetFallback(col != null ? col : 0x6b7280));
      holder.position.set(FORM_OFF[i][0], FORM_OFF[i][1], FORM_OFF[i][2]); holder.userData.att = att; holder.userData.i = i; holder.userData.stato = { roll: 0, pitch: 0, vz: 0, lastY: null, lastT: null };
      VISTA3D.modelloPromise(tipo.icona === "sam" ? "f16" : (tipo.icona || "f16"), col, { tipoId: MODELLI.TIPI[f.tipo] ? f.tipo : undefined, armi: f.armi, numero: String(i + 1).padStart(2, "0"), callsign: f.callsign }).then(m => { if (!st) return; while (att.children.length) att.remove(att.children[0]); att.add(m); holder.userData.mdl = m; });
      el.push(holder);
    }
    const lb = label(`${f.callsign} ${f.n}x`, f.lato === "BLUE" ? "#9ccbff" : "#ff9c9c", 60); lb.position.y = 40; g.add(lb);
    const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: f.lato === "BLUE" ? 0x2e86de : 0xe74c3c, transparent: true, opacity: 0.7 })); scene.add(trail);
    scene.add(g); return { g, holder: el[0], el, lb, trail, pts: [], prev: null, cur: null, t0: 0, dur: 1 };
  }
  // posizione/assetto del velivolo selezionato (leader o gregario) per le telecamere
  function selDisp() { if (String(st.sel).indexOf("aux:") === 0) { const a = (st.aux || []).find(x => x.id === st.sel); return a ? a.disp : null; } const e = st.ent[st.sel]; if (!e || !e.disp) return null; const i = Math.min(st.selEl || 0, e.el.length - 1); if (i <= 0 || !e.el[i].visible) return e.disp; const v = new THREE.Vector3(); e.el[i].getWorldPosition(v); return Object.assign({}, e.disp, { x: v.x, y: v.y, z: v.z }); }
  function posFlight(f) { const q = toXZ(f.lat, f.lon); return { x: q.x, y: Math.max(elev(q.x, q.z) + 3, f.alt * 0.3048 * (st.esag > 1 ? 1 : 1)), z: q.z, hdg: f.hdg, bank: Math.max(-70, Math.min(70, Math.atan((f.turnRate || 0) * Math.PI / 180 * Math.max(50, f.tas) * 0.5144 / 9.81) * 180 / Math.PI)) }; }
  const lerpAng = (a, b, k) => { let d = ((b - a + 540) % 360) - 180; return a + d * k; };
  function aggiornaEntita(now) {
    const eng = APP.engine; const sc = APP.sc;
    eng.flights.forEach(f => {
      const vis = !f.distrutto && f.alt > 50; let e = st.ent[f.id];
      if (!vis) { if (e) { e.g.visible = false; e.trail.visible = false; } return; }
      if (!e) { e = st.ent[f.id] = ent(f); }
      e.g.visible = true; e.trail.visible = true;
      const p = posFlight(f);
      if (!e.cur || e.cur.x !== p.x || e.cur.z !== p.z || e.cur.y !== p.y) { e.prev = e.disp || p; e.cur = p; e.t0 = now; e.dur = Math.max(0.05, Math.min(2.5, eng.tick_sec / Math.max(1, st.fixed ? st.fixed.speed : APP.speed))); e.pts.push(new THREE.Vector3(p.x, p.y, p.z)); if (e.pts.length > 200) e.pts.shift(); if (e.pts.length > 1) e.trail.geometry.setFromPoints(e.pts); }
      const k = e.prev ? Math.min(1, (now - e.t0) / e.dur) : 1; const a = e.prev || p;
      const d = { x: a.x + (p.x - a.x) * k, y: a.y + (p.y - a.y) * k, z: a.z + (p.z - a.z) * k, hdg: lerpAng(a.hdg, p.hdg, k), bank: a.bank + (p.bank - a.bank) * k }; e.disp = d;
      e.g.position.set(d.x, d.y, d.z); e.g.rotation.set(0, Math.PI - d.hdg * Math.PI / 180, 0);
      // ---- assetto di volo: rollio dal rateo di virata, beccheggio dalla velocità verticale + incidenza, limiti di rateo ----
      const S = e.holder.userData.stato; const dtA = Math.max(0.001, now - (S.lastT || now)); const vz = S.lastY != null ? (d.y - S.lastY) / dtA / Math.max(1, APP.speed) : 0; S.vz += (vz - S.vz) * Math.min(1, dtA * 2); S.lastY = d.y; S.lastT = now;
      const v = Math.max(60, (f.tas || 400) * 0.5144); const g = 1 / Math.cos(Math.min(70, Math.abs(d.bank)) * Math.PI / 180); const alpha = 2.5 + 3.5 * (g - 1) + (v < 120 ? (120 - v) * 0.08 : 0);
      const pitchT = Math.atan2(S.vz, v) * 180 / Math.PI + alpha; const rollT = d.bank;
      const rollRate = THREE.MathUtils.clamp((rollT - S.roll) * 4, -120, 120), pitchRate = THREE.MathUtils.clamp((pitchT - S.pitch) * 3, -20, 20);
      S.roll += rollRate * dtA; S.pitch += pitchRate * dtA;
      const regime = f.regime || "crociera"; const ab = regime === "ingaggio" ? 1 : regime === "attacco" || regime === "salita" ? 0.6 : (f.tas > 480 ? 0.35 : 0);
      const dist = camera.position.distanceTo(e.g.position); const vicina = st.cam === "cockpit" || st.cam === "insegui"; const scala = st.scalaGrande && !vicina ? Math.max(1.6, dist * 0.012 / 19) : 1.0;
      e.el.forEach((h, i) => {
        h.visible = i < f.n && !(st.cam === "cockpit" && f.id === st.sel && i === (st.selEl || 0));   // in cockpit non si vede il proprio velivolo (i gregari sì)
        if (!h.visible) return;
        const w = i ? Math.sin(now * (0.7 + 0.13 * i) + i * 2.1) : 0;   // i gregari "respirano" leggermente attorno alla posizione
        // assetto: muso +Z locale; rotation.x negativa = muso su; rotation.z positiva = ala destra giù (bank > 0 = virata a destra)
        h.rotation.set(0, 0, 0); h.rotation.order = "YXZ"; h.rotation.x = -(S.pitch + w * 0.6) * Math.PI / 180; h.rotation.z = (S.roll + w * 2.0) * Math.PI / 180;
        h.position.set(FORM_OFF[i][0] * (vicina ? 1 : scala), FORM_OFF[i][1] * (vicina ? 1 : scala) + w * 1.5, FORM_OFF[i][2] * (vicina ? 1 : scala)); h.scale.setScalar(scala);
        if (h.userData.mdl && h.userData.mdl.userData.anim) h.userData.mdl.userData.anim({ rollRate: rollRate + w * 3, pitchRate, yawRate: (f.turnRate || 0), afterburner: ab, t: now + i * 0.37 });
      });
      e.g.updateMatrixWorld(true);
      const ls = Math.max(st.cam === "insegui" ? 5 : 60, dist * 0.028); e.lb.scale.set(ls * 4, ls, 1); e.lb.position.y = 14 * scala + ls * 0.6; e.lb.visible = !((st.cam === "cockpit" || st.cam === "insegui") && f.id === st.sel);
      if (e.n !== f.n) { e.n = f.n; const nl = label(`${f.callsign} ${f.n}x`, f.lato === "BLUE" ? "#9ccbff" : "#ff9c9c", 60); nl.position.copy(e.lb.position); e.g.remove(e.lb); e.lb = nl; e.g.add(nl); }
    });
    // tanker e AWACS: tempo visivo continuo, riallineato dolcemente al tempo del motore
    st.auxT += (APP.playing || st.fixed ? (st.fixed ? st.fixed.speed : APP.speed) : 0) * (now - (st.auxWall || now)); st.auxWall = now; st.auxT += (eng.t - st.auxT) * 0.02;
    (st.aux || []).forEach(a => { const p = a.path(st.auxT); p.y = Math.max(elev(p.x, p.z) + 50, p.y); a.disp = p; a.g.position.set(p.x, p.y, p.z); a.g.rotation.set(0, Math.PI - p.hdg * Math.PI / 180, 0);
      const dist = camera.position.distanceTo(a.g.position); const vicina = st.cam === "cockpit" || st.cam === "insegui"; const scala = st.scalaGrande && !vicina ? Math.max(1.6, dist * 0.012 / 19) : 1.0; a.holder.scale.setScalar(scala);
      a.holder.rotation.set(0, 0, 0); a.holder.rotation.order = "YXZ"; a.holder.rotation.x = -2 * Math.PI / 180; a.holder.rotation.z = p.bank * Math.PI / 180; a.holder.visible = !(st.cam === "cockpit" && st.sel === a.id);
      if (a.holder.userData.mdl && a.holder.userData.mdl.userData.anim) a.holder.userData.mdl.userData.anim({ rollRate: 0, pitchRate: 0, yawRate: p.bank ? 2 : 0, afterburner: 0, t: now });
      const ls = Math.max(st.cam === "insegui" ? 5 : 60, dist * 0.028); a.lb.scale.set(ls * 4, ls, 1); a.lb.position.y = 20 * scala + ls * 0.6; a.lb.visible = !(vicina && st.sel === a.id); a.g.updateMatrixWorld(true); });
    // SAM in movimento
    eng.sam.forEach(s => st.statici.filter(o => o.userData.sam === s.id).forEach(o => { const q = toXZ(s.lat, s.lon); o.position.x = q.x; o.position.z = q.z; o.position.y = elev(q.x, q.z) + (o.userData.h || 0); o.visible = s.attivo || o.userData.h > 100; }));
  }

  /* ---------- eventi visivi ---------- */
  function eventi(now) {
    const eng = APP.engine; const nuovi = eng.eventi.slice(st.evIdx); st.evIdx = eng.eventi.length;
    nuovi.forEach(e => {
      const fA = eng.flights.find(f => f.callsign === e.chi); const posOf = f => { if (!f) return null; const q = toXZ(f.lat, f.lon); return new THREE.Vector3(q.x, f.alt * 0.3048, q.z); };
      if (/MERGED con/.test(e.testo)) { const other = eng.flights.find(f => e.testo.includes(f.callsign) && f !== fA); if (fA && other) missile(posOf(fA), posOf(other), 0xffd27a, now); }
      if (/SAM LAUNCH su/.test(e.testo)) { const s = eng.sam.find(x => x.nome === e.chi); const tgt = eng.flights.find(f => e.testo.includes(f.callsign)); if (s && tgt) { const q = toXZ(s.lat, s.lon); missile(new THREE.Vector3(q.x, elev(q.x, q.z), q.z), posOf(tgt), 0xff5a2a, now, 2.5); } }
      if (/SPLASH|Formazione persa|velivoli \(abbattuti/.test(e.testo)) { const victim = /Formazione persa|velivoli/.test(e.testo) ? fA : eng.flights.find(f => e.testo.includes("(" + f.callsign + ")")); const p = posOf(victim); if (p) esplosione(p, now, 1); }
      if (/SHACK|PICKLE/.test(e.testo)) { const t = eng.target.find(x => e.testo.includes(x.nome)); if (t) { const q = toXZ(t.lat, t.lon); esplosione(new THREE.Vector3(q.x, elev(q.x, q.z), q.z), now, 2.5); } }
      if (["kill", "ingaggio", "avviso", "inject"].includes(e.tipo) || /AIRBORNE|PUSH|ON STATION|BINGO|SCRAMBLE/.test(e.testo)) ticker(e);
    });
    st.fx = st.fx.filter(fx => { const k = (now - fx.t0) / fx.dur; if (k >= 1) { scene.remove(fx.obj); return false; } fx.step(k); return true; });
  }
  function missile(a, b, col, now, dur) { const geo = new THREE.BufferGeometry().setFromPoints([a.clone(), a.clone()]); const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 1 })); scene.add(line); const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: VISTA3D.puffTexture(true), color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); head.scale.setScalar(260); scene.add(head); const grp = new THREE.Group(); grp.add(line); grp.add(head); scene.add(grp);
    st.fx.push({ obj: grp, t0: now, dur: dur || 1.6, step: k => { const p = a.clone().lerp(b, Math.min(1, k * 1.15)); line.geometry.setFromPoints([a, p]); head.position.copy(p); line.material.opacity = 1 - k * 0.7; if (k > 0.85) esplosione(b, now + 0, 0.6, true); } }); }
  function esplosione(p, now, size, piccola) { if (piccola && st.fx.some(f => f.small && f.p && f.p.distanceTo(p) < 300)) return; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: VISTA3D.puffTexture(false), color: 0xff7a1a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.copy(p); scene.add(sp); const smoke = new THREE.Sprite(new THREE.SpriteMaterial({ map: VISTA3D.puffTexture(false), color: 0x333333, transparent: true, opacity: 0.8, depthWrite: false })); smoke.position.copy(p); scene.add(smoke); const grp = new THREE.Group(); grp.add(sp); grp.add(smoke); scene.add(grp);
    st.fx.push({ obj: grp, t0: now, dur: piccola ? 1.2 : 7, small: !!piccola, p, step: k => { const s = 300 * size; sp.scale.setScalar(s * (0.3 + 2.5 * Math.min(1, k * 3))); sp.material.opacity = Math.max(0, 1 - k * 2.2); smoke.scale.setScalar(s * (0.5 + 4 * k)); smoke.position.y = p.y + 600 * size * k; smoke.material.opacity = piccola ? 0 : 0.8 * (1 - k); } }); }
  function ticker(e) { const el = overlay.querySelector("#m3d-ticker"); const d = document.createElement("div"); d.className = "ev " + e.tipo; d.innerHTML = `<span class="t">${e.ora}</span><b>${e.chi}</b> ${e.testo}`; el.appendChild(d); while (el.children.length > 4) el.removeChild(el.firstChild); setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 9000); }

  /* ---------- telecamere ---------- */
  function cameraUpdate(dt) {
    const eng = APP.engine; const f = eng.flights.find(x => x.id === st.sel); const d = selDisp(); const o = st.orbit;
    const fwd = d ? new THREE.Vector3(Math.sin(d.hdg * Math.PI / 180), 0, -Math.cos(d.hdg * Math.PI / 180)) : new THREE.Vector3(1, 0, 0);
    const k = 1 - Math.exp(-6 * dt);
    if (st.cam === "orbita") { if (o.focusFlight && d) o.target.set(d.x, d.y, d.z); const p = new THREE.Vector3(o.target.x + o.r * Math.sin(o.theta) * Math.cos(o.phi), o.target.y + o.r * Math.sin(o.phi), o.target.z + o.r * Math.cos(o.theta) * Math.cos(o.phi)); p.y = Math.max(p.y, elev(p.x, p.z) + 20); camera.position.copy(p); camera.lookAt(o.target); }
    else if (st.cam === "insegui" && d) { // chase cam stile videogioco: orbita attorno al velivolo (trascina), zoom (rotella), segue la prua con ritardo
      const c = st.chase; const hdgR = d.hdg * Math.PI / 180; const yaw = hdgR + Math.PI + c.yaw; const off = new THREE.Vector3(Math.sin(yaw) * Math.cos(c.pitch), Math.sin(c.pitch), -Math.cos(yaw) * Math.cos(c.pitch)).multiplyScalar(c.dist);
      if (!c.offS) c.offS = off.clone(); c.offS.lerp(off, 1 - Math.exp(-5 * dt));   // smussa solo l'orientamento dell'offset: la camera resta agganciata al velivolo
      const p = new THREE.Vector3(d.x, d.y, d.z).add(c.offS); p.y = Math.max(p.y, elev(p.x, p.z) + 4); camera.position.copy(p);
      const look = new THREE.Vector3(d.x, d.y, d.z).addScaledVector(fwd, Math.min(300, c.dist * 0.8)); const spd = Math.max(0, ((f && f.tas) || 0) - 420) / 400; if (spd > 0) look.add(new THREE.Vector3((Math.random() - 0.5) * spd, (Math.random() - 0.5) * spd, 0)); camera.lookAt(look); camera.fov = THREE.MathUtils.lerp(camera.fov, c.dist < 60 ? 62 : 55, 0.1); camera.updateProjectionMatrix(); }
    else if (st.cam === "cockpit" && d) { const p = new THREE.Vector3(d.x, d.y, d.z).addScaledVector(fwd, 6).add(new THREE.Vector3(0, 2.0, 0)); camera.position.copy(p); const up = new THREE.Vector3(0, 1, 0); camera.up.copy(up.applyAxisAngle(fwd, d.bank * Math.PI / 180)); /* bank destro: l'orizzonte sale a sinistra */ camera.lookAt(p.clone().addScaledVector(fwd, 5000)); }
    else if (st.cam === "torre" && f) { const b = APP.sc.basi.find(x => x.id === f.base) || APP.sc.basi[0]; const q = toXZ(b.lat, b.lon); const p = new THREE.Vector3(q.x, elev(q.x, q.z) + 45, q.z); camera.position.copy(p); camera.lookAt(d ? new THREE.Vector3(d.x, d.y, d.z) : new THREE.Vector3(q.x + 1000, p.y, q.z)); }
    else if (st.cam === "satellite" && d) { const p = new THREE.Vector3(d.x, d.y + 18000, d.z + 1); camera.position.lerp(p, k); camera.up.set(0, 0, -1); camera.lookAt(new THREE.Vector3(d.x, d.y, d.z)); }
    else if (st.cam === "target") { const t = APP.sc.target[0]; const q = toXZ(t.lat, t.lon); const ang = performance.now() * 0.00008; const p = new THREE.Vector3(q.x + Math.cos(ang) * 6000, elev(q.x, q.z) + 2500, q.z + Math.sin(ang) * 6000); camera.position.lerp(p, k); camera.lookAt(new THREE.Vector3(q.x, elev(q.x, q.z), q.z)); }
    else { st.cam = "orbita"; }
    if (st.cam !== "cockpit" && st.cam !== "satellite") camera.up.set(0, 1, 0);
    // nebbia: realistica (visibilità METAR) nelle viste ravvicinate, foschia leggera nelle viste d'insieme
    if (scene.fog) { const vicina = st.cam === "cockpit" || st.cam === "insegui" || st.cam === "torre"; const near = vicina ? st.visM * 1.5 : 150000, far = vicina ? Math.max(st.visM * 6, 60000) : 900000; scene.fog.near += (near - scene.fog.near) * k; scene.fog.far += (far - scene.fog.far) * k; }
    if (!d && st.cam !== "orbita" && st.cam !== "target") { camera.lookAt(o.target); }
  }

  /* ---------- HUD (cockpit) ---------- */
  function hud() {
    const c = hudCtx, W = hudCanvas.width, H = hudCanvas.height; c.clearRect(0, 0, W, H); if (st.cam !== "cockpit") return;
    const eng = APP.engine; const f = eng.flights.find(x => x.id === st.sel); if (!f) return; const sc = APP.sc;
    c.save(); c.strokeStyle = "rgba(120,255,140,0.95)"; c.fillStyle = "rgba(120,255,140,0.95)"; c.lineWidth = 2; c.font = "bold 18px Consolas, monospace"; c.textAlign = "center";
    const cx = W / 2, cy = H / 2; const hdg = f.hdg;
    c.beginPath(); c.moveTo(cx - 260, 60); c.lineTo(cx + 260, 60); c.stroke();
    for (let d = -40; d <= 40; d += 5) { const h = ((Math.round(hdg / 5) * 5 + d) + 360) % 360; const x = cx + ((Math.round(hdg / 5) * 5 + d) - hdg) * 6.5; if (Math.abs(x - cx) > 260) continue; c.beginPath(); c.moveTo(x, 60); c.lineTo(x, h % 10 === 0 ? 48 : 54); c.stroke(); if (h % 10 === 0) c.fillText(String(h / 10).padStart(2, "0"), x, 44); }
    c.beginPath(); c.moveTo(cx, 62); c.lineTo(cx - 7, 74); c.lineTo(cx + 7, 74); c.closePath(); c.fill(); c.fillText(String(Math.round(hdg)).padStart(3, "0"), cx, 94);
    c.textAlign = "right"; c.strokeRect(cx - 330, cy - 22, 110, 44); c.fillText(Math.round(f.gs || f.tas) + " KT", cx - 230, cy + 7); c.font = "14px Consolas, monospace"; c.fillText("M " + (f.mach || 0).toFixed(2), cx - 230, cy + 40); c.fillText("G " + (f.nG || 1).toFixed(1), cx - 230, cy - 32);
    c.font = "bold 18px Consolas, monospace"; c.textAlign = "left"; c.strokeRect(cx + 220, cy - 22, 130, 44); c.fillText(Math.round(f.alt).toLocaleString("it-IT") + " FT", cx + 230, cy + 7); c.font = "14px Consolas, monospace"; c.fillText("FUEL " + Math.max(0, Math.round(f.autonomia)) + " MIN", cx + 230, cy + 40);
    c.textAlign = "center"; c.setLineDash([]); c.beginPath(); c.arc(cx, cy, 9, 0, Math.PI * 2); c.moveTo(cx - 9, cy); c.lineTo(cx - 22, cy); c.moveTo(cx + 9, cy); c.lineTo(cx + 22, cy); c.moveTo(cx, cy - 9); c.lineTo(cx, cy - 18); c.stroke();
    const wp = f.wps[f.wp_i]; c.font = "16px Consolas, monospace"; c.textAlign = "left"; c.fillText(`${f.callsign} ${(st.selEl || 0) + 1}  ${f.n}x ${f.tipo}`, cx - 330, H - 134); c.fillText(f.fase.toUpperCase(), cx - 330, H - 110); if (wp) c.fillText(`WPT ${wp.nome.toUpperCase().slice(0, 22)}  ${Math.round(GEO.dist(f, wp))} NM`, cx - 330, H - 86);
    c.fillText(`${GEO.fmtBE(sc.mappa.bullseye, f)}`, cx - 330, H - 62); c.fillText(Object.entries(f.armi).map(([a, n]) => `${a} ${n}`).join("  "), cx - 330, H - 38);
    const nem = eng.rilevati(f.lato).map(e => ({ e, d: GEO.dist(f, e) })).sort((a, b) => a.d - b.d)[0]; c.textAlign = "right"; if (nem) c.fillText(`CONTACT ${nem.e.callsign} ${Math.round(nem.d)} NM BRG ${Math.round(GEO.bearing(f, nem.e))}`, cx + 330, H - 110); else c.fillText("PICTURE CLEAN", cx + 330, H - 110);
    c.fillText(Engine.s2hms(eng.t), cx + 330, H - 86); c.restore();
  }

  /* ---------- loop ---------- */
  function animate() {
    // modalità registrazione: passo fisso 1/30 s, orologio virtuale e motore avanzato qui (indipendente da visibilità e frame rate)
    const F = st.fixed; if (F) raf = setTimeout(animate, 1000 / 30); else raf = requestAnimationFrame(animate);
    const dt = F ? 1 / 30 : Math.min(0.1, clock.getDelta()); const now = F ? (F.t += dt) : performance.now() / 1000;
    if (F) { F.acc += dt * F.speed; const eng = APP.engine; while (F.acc >= eng.tick_sec && !eng.finita) { eng.tick(); F.acc -= eng.tick_sec; } if (F.t >= F.durata) { chiudi(); return; } }
    aggiornaEntita(now); eventi(now); cameraUpdate(dt);
    if (st.nubi) st.nubi.material.map.offset.x += dt * 0.00002;
    renderer.render(scene, camera); hud(); aggiornaNvg();
    if (st.comp) { st.comp.g.drawImage(canvas, 0, 0, st.comp.c.width, st.comp.c.height); st.comp.g.drawImage(hudCanvas, 0, 0, st.comp.c.width, st.comp.c.height); }
    overlay.querySelector("#m3d-clock").textContent = Engine.s2hms(APP.engine.t) + (APP.playing ? "  ▶ ×" + APP.speed : "  ⏸") + (TERRA.caricate < TERRA.totale ? `  · terreno ${TERRA.caricate}/${TERRA.totale}` : "");
    overlay.querySelector("#m3d-play").textContent = APP.playing ? "⏸" : "▶"; overlay.querySelectorAll("#m3d-speeds button").forEach(b => b.classList.toggle("active", +b.dataset.v === APP.speed));
    if ((st.frame = (st.frame || 0) + 1) % 30 === 0) aggiornaSelect();
  }

  /* ---------- API ---------- */
  let recorder = null, recChunks = [];
  function apri(selId, opt) {
    dom(); if (typeof THREE === "undefined") return; opt = opt || {};
    const sc = APP.sc; TERRA.lat0 = 41.0; TERRA.lon0 = -122.8;
    if (renderer) { try { renderer.dispose(); } catch (e) {} }
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", logarithmicDepthBuffer: true, preserveDrawingBuffer: !!opt.record }); renderer.setPixelRatio(opt.record ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setSize(window.innerWidth, window.innerHeight);
    if (THREE.sRGBEncoding !== undefined && renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    hudCanvas.width = window.innerWidth; hudCanvas.height = window.innerHeight;
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 2, 3e6);
    const q = toXZ(sc.mappa.bullseye.lat, sc.mappa.bullseye.lon);
    st = { ent: {}, fx: [], evIdx: APP.engine.eventi.length, cam: "orbita", sel: selId || (APP.engine.flights.find(f => !f.distrutto && f.alt > 50) || APP.engine.flights[0]).id, selEl: opt.el || 0, orbit: { target: new THREE.Vector3(q.x, 3000, q.z), theta: -0.8, phi: 0.5, r: 60000, focusFlight: !!selId }, chase: { yaw: 0, pitch: 0.18, dist: 42 }, scalaGrande: true, esag: 1, rotteOn: true, statici: [], tiles: [] };
    overlay.classList.remove("hidden"); cielo(); const root = new THREE.Group(); scene.add(root); terreno(root); statici(); aggiornaSelect(); setCam(opt.cam || (selId ? "insegui" : "orbita"));
    if (opt.chase) Object.assign(st.chase, opt.chase); if (opt.orbit) Object.assign(st.orbit, opt.orbit); if (opt.scalaGrande != null) st.scalaGrande = opt.scalaGrande;
    overlay.querySelector("#m3d-sel").value = st.sel + ":" + st.selEl; clock = new THREE.Clock();
    if (opt.record && window.MediaRecorder) { try { APP.play(false); st.fixed = { t: 0, acc: 0, speed: opt.speed || 5, durata: opt.durata || 20 }; st.onFine = opt.onFine;
      const comp = document.createElement("canvas"); comp.width = canvas.width; comp.height = canvas.height; st.comp = { c: comp, g: comp.getContext("2d") };
      const stream = comp.captureStream(30); recChunks = []; recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm", videoBitsPerSecond: 8000000 }); recorder.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); }; recorder.onstop = () => { const blob = new Blob(recChunks, { type: "video/webm" }); if (opt.onRecord) opt.onRecord(blob); }; recorder.start(500); } catch (e) { console.warn("registrazione non disponibile", e); } }
    animate();
  }
  function chiudi() { if (!overlay || overlay.classList.contains("hidden")) return; cancelAnimationFrame(raf); clearTimeout(raf); overlay.classList.add("hidden"); if (recorder && recorder.state !== "inactive") recorder.stop(); recorder = null; if (scene) scene.traverse(x => { if (x.geometry) x.geometry.dispose(); }); scene = null; const fn = st && st.onFine; st = null; hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height); if (fn) fn(); }
  return { apri, chiudi, setCam: c => st && setCam(c), get attiva() { return !!(overlay && !overlay.classList.contains("hidden")); }, get debug() { const e = st && st.ent[st.sel]; return st && { quote: { caricate: TERRA.caricate, totale: TERRA.totale, griglie: Object.keys(TERRA.grids || {}).length, maxM: Math.round(TERRA.max || 0), errori: TERRA.erroriDem || 0, conNormali: (st.tiles || []).filter(m => m.material.normalMap).length }, cam: st.cam, sel: st.sel, terreno: TERRA.ready, ent: Object.keys(st.ent).length, fx: st.fx.length, frame: st.frame, camPos: camera && camera.position.toArray().map(Math.round), orbit: st.orbit && { t: st.orbit.target.toArray().map(Math.round), r: Math.round(st.orbit.r), focus: st.orbit.focusFlight }, chase: st.chase && { yaw: +st.chase.yaw.toFixed(2), pitch: +st.chase.pitch.toFixed(2), dist: Math.round(st.chase.dist) }, mdl: (() => { const e = st.ent[st.sel]; return e && e.holder.userData.mdl && e.holder.userData.mdl.name; })(), disp: e && e.disp && { x: Math.round(e.disp.x), y: Math.round(e.disp.y), z: Math.round(e.disp.z), hdg: Math.round(e.disp.hdg) }, fog: scene && scene.fog && [Math.round(scene.fog.near), Math.round(scene.fog.far)], tiles: st.tiles.length, tileM: Math.round(TERRA.tileM), base: TERRA.t && [Math.round(TERRA.t.x), Math.round(TERRA.t.y)], probe: (() => { const q = toXZ(APP.sc.mappa.bullseye.lat, APP.sc.mappa.bullseye.lon); const f = APP.engine.flights.find(x => x.id === st.sel); return { q, lat0: TERRA.lat0, lon0: TERRA.lon0, mLon: mLon(), el: elev(q.x, q.z), p: f && posFlight(f), f: f && { lat: f.lat, lon: f.lon, alt: f.alt, hdg: f.hdg, tr: f.turnRate, tas: f.tas } }; })() }; } };
})();
/* =====================================================================
   FISICA DEL VOLO (modello a massa puntiforme, standard aeronautici)
   - Virata coordinata: rateo ω = g·tan(φ)/V ; raggio r = V²/(g·tan φ)
   - Salita/discesa: ROC limitata, velocità verticale in fpm
   - Vento: triangolo del vento (TAS + vento = GS/track)
   - Atmosfera ISA: Mach e temperatura in quota (per visualizzazione)
   - Carburante: modalità "regole" (minuti ROE) o "realistica" (lb/h, regime)
   ===================================================================== */
const PHYS = (() => {
  const G_FT = 32.174;           // ft/s²
  const KT2FTS = 1.68781;        // kt → ft/s
  const d2r = d => d * Math.PI / 180;

  /* Rateo di virata (°/s) per bank φ e TAS; 30° bank a 480 kt ≈ 1.4°/s (standard navigazione) */
  function turnRateDegS(tasKt, bankDeg) {
    const V = tasKt * KT2FTS; if (V < 1) return 0;
    return (G_FT * Math.tan(d2r(bankDeg)) / V) * 180 / Math.PI;
  }
  function turnRadiusNm(tasKt, bankDeg) {
    const V = tasKt * KT2FTS;
    return (V * V / (G_FT * Math.tan(d2r(bankDeg)))) / 6076.12;
  }
  const loadFactor = bankDeg => 1 / Math.cos(d2r(bankDeg));   // n = 1/cos φ

  /* ISA: temperatura e velocità del suono in quota (ft) */
  function isa(altFt) {
    const h = altFt * 0.3048;
    const T = h < 11000 ? 288.15 - 0.0065 * h : 216.65;
    const a = Math.sqrt(1.4 * 287.05 * T);  // m/s
    return { tempC: T - 273.15, soundKt: a * 1.94384 };
  }
  const mach = (tasKt, altFt) => tasKt / isa(altFt).soundKt;

  /* Regimi di consumo: moltiplicatore del consumo orario base */
  const REGIME = { terra: 0.05, salita: 1.6, crociera: 1.0, cap: 0.8, attacco: 1.5, ingaggio: 2.5, discesa: 0.5, aar: 0.9 };

  /* Integra un passo dt (s) dello stato di volo verso un punto desiderato (target {lat,lon,alt})
     stato: {lat,lon,hdg,tas,alt} ; tipo: parametri velivolo ; opts: {bank, vento, tasTarget, alt}
     ritorna nuovo stato e informazioni (gs, track, turnRate, nG) */
  function step(stato, dest, tipo, dt, opts) {
    const vento = opts.vento || { da: 0, kt: 0 };
    const tasTarget = opts.tasTarget || tipo.tas_crociera_kt;
    // accelerazione limitata (≈ 5 kt/s in livellato per un caccia, 1 kt/s per un tanker)
    const accMax = (tipo.g_max >= 7 ? 5 : 1) * dt;
    let tas = stato.tas + Math.max(-accMax, Math.min(accMax, tasTarget - stato.tas));
    // rotta desiderata verso destinazione, corretta per il vento
    const brg = GEO.bearing(stato, dest);
    const hdgDesired = GEO.headingForTrack(brg, Math.max(tas, 50), vento.da, vento.kt);
    const bank = opts.bank || tipo.bank_nav || 30;
    const maxTurn = turnRateDegS(Math.max(tas, 100), bank) * dt;
    const diff = GEO.angDiff(stato.hdg, hdgDesired);
    const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
    const hdg = GEO.norm(stato.hdg + turn);
    // quota
    const altTarget = opts.alt != null ? opts.alt : (dest.alt != null ? dest.alt : tipo.quota_ft);
    const roc = tipo.roc_fpm || 5000;
    const dAltMax = roc * dt / 60;
    const alt = stato.alt + Math.max(-dAltMax * 1.5, Math.min(dAltMax, altTarget - stato.alt));
    // movimento con vento
    const wt = GEO.windTriangle(hdg, tas, vento.da, vento.kt);
    const dNm = wt.gs * dt / 3600;
    const np = GEO.dest(stato, wt.track, dNm);
    const bankUsed = Math.abs(diff) > 0.5 ? Math.min(bank, Math.abs(diff) / dt / Math.max(turnRateDegS(tas, 1), 1e-6)) : 0;
    return { lat: np.lat, lon: np.lon, hdg, tas, alt, gs: wt.gs, track: wt.track, turnRate: turn / dt, nG: loadFactor(Math.min(bankUsed, bank)), mach: mach(tas, alt),
             regime: alt < altTarget - 200 ? "salita" : alt > altTarget + 200 ? "discesa" : (opts.regime || "crociera") };
  }

  /* Consumo carburante per un passo dt (s): ritorna minuti di autonomia consumati (modalità regole)
     oppure lb consumate (modalità realistica) */
  function fuelBurn(tipo, regime, dt, modalita) {
    const k = REGIME[regime] != null ? REGIME[regime] : 1;
    if (modalita === "realistica") return tipo.consumo_lbh * k * dt / 3600;   // lb
    return k * dt / 60;                                                       // minuti equivalenti
  }

  /* Tempo (min) e carburante per raggiungere un punto alla velocità di crociera con vento medio */
  function eta(from, to, tasKt, vento) {
    const d = GEO.dist(from, to), brg = GEO.bearing(from, to);
    const hdg = GEO.headingForTrack(brg, tasKt, vento.da, vento.kt);
    const gs = GEO.windTriangle(hdg, tasKt, vento.da, vento.kt).gs;
    return { nm: d, min: d / Math.max(gs, 1) * 60, gs };
  }

  /* BINGO: autonomia (min) necessaria per rientrare alla base/tanker più vicino con riserva */
  function bingoMinutes(from, homes, tasKt, vento, riservaMin) {
    let best = Infinity;
    homes.forEach(h => { const e = eta(from, h, tasKt, vento); if (e.min < best) best = e.min; });
    return best + (riservaMin || 5);
  }

  return { turnRateDegS, turnRadiusNm, loadFactor, isa, mach, REGIME, step, fuelBurn, eta, bingoMinutes };
})();
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
/* =====================================================================
   INTERFACCIA – fasi: Briefing, Piano, Esecuzione, Debrief, Editor dati
   ===================================================================== */
const UI = (() => {
  const $ = s => document.querySelector(s); const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const h = (html) => { const d = document.createElement("div"); d.innerHTML = html; return d; };
  const lati = () => APP.ruolo === "TRAINER" ? ["BLUE", "RED"] : [APP.ruolo];
  const vento = () => ({ da: APP.sc.meteo.vento_da_gradi, kt: APP.sc.meteo.vento_kt });
  const fmtMin = m => `${Math.round(m)} min`;

  /* ---------- toast / modal ---------- */
  function toast(msg, ms, big) { const t = h(`<div class="toast ${big ? "big" : ""}">${msg}</div>`).firstChild; $("#toast-area").appendChild(t); setTimeout(() => t.remove(), ms || 4000); }
  function modal(titolo, html) { $("#modal-title").textContent = titolo; $("#modal-body").innerHTML = html; $("#modal").classList.remove("hidden"); }
  function chiudiModal() { $("#modal").classList.add("hidden"); }

  /* ================= BRIEFING ================= */
  // obiettivi di missione: in briefing (testo), in esecuzione (stato in diretta), nel debrief (esito)
  function obiettiviCard(eng, titolo) {
    const sc = APP.sc; if (!(sc.obiettivi || []).length) return ""; const ob = eng ? eng.valutaObiettivi() : sc.obiettivi.map((o, i) => ({ n: i + 1, testo: o.testo, primario: o.primario !== false, stato: "", prog: "" }));
    const red = APP.ruolo === "RED"; const pill = o => !o.stato ? "" : o.stato === "FALLITO" ? `<span class="pill bad">${red ? "NEGATO ✓" : "FALLITO"}</span>` : o.ok && o.stato === "RAGGIUNTO" ? `<span class="pill ok">${red ? "PERSO" : "RAGGIUNTO"}</span>` : `<span class="pill">${o.stato}</span>`;
    const esito = eng && eng.finita ? eng.esitoMissione() : null;
    return `<div class="card obiettivi"><h3>${titolo || (red ? "Obiettivi del nemico (da negare)" : "Obiettivi della missione")}${esito ? ` · <span class="pill ${/SUCCESS/.test(esito) && !/PARTIAL/.test(esito) ? "ok" : /PARTIAL/.test(esito) ? "warn" : "bad"}">${esito}</span>` : ""}</h3><table>${ob.map(o => `<tr><td>${o.primario ? "<b>Primario</b>" : "<small>Secondario</small>"}</td><td>${esc(o.testo)}</td><td><small>${o.prog || ""}</small></td><td>${pill(o)}</td></tr>`).join("")}</table></div>`;
  }
  function missioneCard() {
    const m = APP.sc.missione; if (!m || !m.id) return ""; return `<div class="card missione"><div class="mis-top"><span class="mis-cod">${esc(m.id)}</span><span class="mis-tipo">${esc(m.tipo)}</span><span class="mis-diff">${"★".repeat(m.difficolta || 3)}${"☆".repeat(5 - (m.difficolta || 3))}</span></div><h2>${esc(m.titolo)}</h2>${APP.ruolo === "TRAINER" ? `<p><b>Focus formativo:</b> ${esc(m.focus)}</p>` : ""}<button class="btn small" onclick="MISSIONI.apriCatalogo()">📋 Cambia missione</button></div>`;
  }
  function briefing() {
    const sc = APP.sc; let html = `<div class="step-hint"><b>FASE 1 – BRIEFING.</b> Leggi lo scenario, il task e le regole. Poi applica la <b>regola delle 5T</b> (Task · Threat · Target · Timeline · Tactics) nel brainstorm e passa alla fase 2 per costruire il piano.</div>` + missioneCard() + obiettiviCard(null, APP.ruolo === "RED" ? "Che cosa vuole ottenere il nemico" : "Obiettivi della missione");
    lati().forEach(l => {
      const b = sc.briefing[l], sq = sc.squadre[l];
      html += `<div class="card ${l.toLowerCase()}"><h3>${l} · ${esc(sq.nome)}</h3><h2>${esc(b.titolo)}</h2><small>${esc(sq.nazione)} – ${esc(sq.ruolo)}</small><p>${esc(b.situazione)}</p></div>
      <div class="card"><h3>Task</h3><ul class="clean">${b.task.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="card"><h3>Threat</h3><p>${esc(b.threat)}</p><h3>Intel update</h3><ul class="clean">${b.intel.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="card"><h3>Target</h3><table><tr><th>Target</th><th>GBU-48</th><th>Note</th></tr>${sc.target.map(t => `<tr><td>${esc(t.nome)}</td><td>${t.gbu_richieste}</td><td><small>${esc(t.descrizione)}${t.finestra ? ` · <b>presente ${t.finestra.da}–${t.finestra.a}</b>` : ""}${t.sam ? ` · spegne la ${esc(t.sam)}` : ""}</small></td></tr>`).join("") || `<tr><td colspan="3"><small>Nessun bersaglio a terra in questa missione</small></td></tr>`}</table></div>
      <div class="card"><h3>ROE – Rules of Engagement</h3><ul class="clean">${b.roe.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="card gold"><h3>Da sapere (regole del gioco)</h3><ul class="clean">${b.da_sapere.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="card"><h3>Cosa deve contenere il piano</h3><ol class="clean">${b.output_plan.map(x => `<li>${esc(x)}</li>`).join("")}</ol></div>
      <div class="card"><h3>Squadra ${l}</h3><table>${sq.membri.map((m, i) => `<tr><td><input data-sq="${l}" data-i="${i}" value="${esc(m.nome)}" placeholder="nome"></td><td><small>${esc(m.ruolo)}</small></td></tr>`).join("")}</table></div>`;
    });
    html += `<div class="card"><h3>Meteo ${sc.meteo.reale ? '<span class="pill ok">REALE NOAA</span>' : '<span class="pill">scenario</span>'}</h3><p>${esc(sc.meteo.descrizione)}</p><span class="pill">Vento in quota ${sc.meteo.vento_da_gradi}° / ${sc.meteo.vento_kt} kt</span></div>
      <div id="meteo-card">${METEO.cardHtml(sc, APP.meteoNoaa, esc)}</div>
      <div class="card"><h3>Capability brief – velivoli</h3><table><tr><th>Velivolo</th><th>Crociera</th><th>Autonomia</th><th>Armi</th><th>Pro / Contro</th></tr>${Object.entries(sc.tipi).filter(([k, t]) => lati().includes(t.lato) || t.categoria === "caccia" || t.categoria === "SAM").map(([k, t]) => `<tr class="${t.lato.toLowerCase()}"><td><b>${esc(t.nome)}</b></td><td>${t.tas_crociera_kt} kt<br><small>FL${Math.round(t.quota_ft / 100)}</small></td><td>${t.autonomia_min} min</td><td><small>${Object.entries(t.armi || {}).map(([a, n]) => n + " " + a).join(", ") || "-"}</small></td><td><small>+ ${esc(t.pro)}<br>− ${esc(t.contro)}</small></td></tr>`).join("")}</table></div>
      <div class="card"><h3>Kill ratio (KRO)</h3>${tabellaKR(sc)}<small>Un velivolo attaccante abbatte in media KR velivoli nemici per ingaggio. Con bombe sganciate il KR si dimezza.</small></div>
      <div class="card green"><h3>Regola delle 5T</h3><div class="checklist">${["TASK – cosa ci viene chiesto? È chiaro a tutti? È raggiungibile? Showstopper?", "THREAT – minacce (aerei, SAM), stress, ambiente. SWOT.", "TARGET – DMPI, TOT, difese.", "TIMELINE – dal brainstorm al debrief. GICOL: dopo il brainstorm non si inventa più.", "TACTICS – basate sull'elemento più debole, note a tutti."].map(x => `<label><input type="checkbox"> ${x}</label>`).join("")}</div></div>
      <button class="btn primary big" onclick="APP.vaiFase('piano')">Vai alla FASE 2 – PIANO →</button>`;
    $("#left-content").innerHTML = html;
    $$("#left-content input[data-sq]").forEach(i => i.addEventListener("change", e => { sc.squadre[e.target.dataset.sq].membri[+e.target.dataset.i].nome = e.target.value; APP.salva(); }));
    const bindMeteo = () => {
      const bs = $("#met-scarica"); if (bs) bs.onclick = async () => { bs.disabled = true; bs.textContent = "⟳ scarico da NOAA…"; const d = await METEO.scarica(sc, !!APP.meteoNoaa); APP.meteoNoaa = d; const r = METEO.applica(sc, d); if (r) { APP.salva(); toast(`Meteo reale applicato: vento in quota ${sc.meteo.vento_da_gradi}°/${sc.meteo.vento_kt} kt (${r.fonteVento})`, 7000); } else toast("Nessun METAR ricevuto: " + (d.errori || []).join("; "), 7000); briefing(); };
      const br = $("#met-reset"); if (br) br.onclick = () => { APP.meteoNoaa = null; sc.meteo = DATAIO.clone(SCENARIO_DEFAULT.meteo); APP.salva(); briefing(); };
    }; bindMeteo();
  }
  function tabellaKR(sc) {
    const att = Object.keys(sc.kill_ratio), def = [...new Set(att.flatMap(a => Object.keys(sc.kill_ratio[a])))];
    return `<table><tr><th>att \\ dif</th>${def.map(d => `<th>${d}</th>`).join("")}</tr>${att.map(a => `<tr class="${(sc.tipi[a] || {}).lato === "RED" ? "red" : "blue"}"><td><b>${a}</b></td>${def.map(d => `<td>${sc.kill_ratio[a][d] ?? "-"}${(sc.kill_ratio_con_bombe[a] || {})[d] != null ? `<br><small>bombe: ${sc.kill_ratio_con_bombe[a][d]}</small>` : ""}</td>`).join("")}</tr>`).join("")}</table>`;
  }

  /* ================= PIANO ================= */
  function piano() {
    const html = `<div class="step-hint"><b>FASE 2 – PIANO.</b> Compila le tabelle: il simulatore costruisce le rotte sulla mappa e verifica carburante, sequenze e timeline in tempo reale. ${APP.ruolo === "TRAINER" ? "Come trainer vedi entrambi i piani." : ""} Quando il piano è <span class="pill ok">verde</span>, salva e vai alla fase 3.</div>
      <div class="row" style="margin-bottom:8px"><button class="btn small" id="p-salva">💾 Salva piano</button><button class="btn small" id="p-carica">📂 Carica</button><button class="btn small" id="p-demo">✨ Piano demo</button><button class="btn small" id="p-reset">🗑 Svuota</button><button class="btn small" id="p-excel">⬇ Excel</button></div><div id="piano-body"></div>
      <button class="btn primary big" onclick="APP.vaiFase('esecuzione')">Vai alla FASE 3 – ESECUZIONE →</button>`;
    $("#left-content").innerHTML = html; $("#left").classList.add("wide");
    $("#p-salva").onclick = () => APP.salvaPiano(); $("#p-carica").onclick = () => APP.caricaPiano(); $("#p-demo").onclick = () => { DEMO.pianiDemo(APP.sc); APP.salva(); piano(); toast("Piani demo caricati per BLUE e RED"); };
    $("#p-reset").onclick = () => { lati().forEach(l => APP.sc.piani[l] = null); APP.salva(); piano(); }; $("#p-excel").onclick = () => DATAIO.exportExcel(APP.sc, "Centurion_Piano.xlsx");
    const body = $("#piano-body"); lati().forEach(l => body.appendChild(l === "BLUE" ? pianoBlue() : pianoRed()));
    aggiornaRotteMappa();
  }
  function pianoBlue() {
    const sc = APP.sc; if (!sc.piani.BLUE) sc.piani.BLUE = { formazioni: {} }; const p = sc.piani.BLUE;
    const forms = sc.formazioni.filter(f => f.lato === "BLUE");
    const opt = (arr, v, vuoto) => (vuoto ? `<option value="">${vuoto}</option>` : "") + arr.map(a => `<option value="${a.id}" ${a.id === v ? "selected" : ""}>${esc(a.nome || a.id)}</option>`).join("");
    const el = h(`<div class="card blue"><h3>Piano BLUE – IMPERIUM PACKAGE</h3><div class="ed-wrap"><table class="ed-table"><tr><th>Formazione</th><th>Decollo</th><th>Tanker</th><th>Ord. AAR</th><th>Gate IN</th><th>Push (opz.)</th><th>Target / CAP</th><th>2º target</th><th>Gate OUT</th><th>2ª ondata</th></tr>
      ${forms.map(f => { const q = p.formazioni[f.id] || {}; const t = sc.tipi[f.tipo]; const isEA = f.tipo === "EA18";
        return `<tr data-f="${f.id}"><td><b>${f.callsign}</b><br><small>${f.numero}x ${t.nome.split(" ")[0]} · ${Object.entries(t.armi).map(([a, n]) => n + a.replace("GBU48", "GBU")).join("/")}</small></td>
        <td><input type="time" data-k="decollo" value="${q.decollo || ""}"></td><td><select data-k="tanker">${opt(sc.aar, q.tanker, "—")}</select></td><td><input type="number" min="1" max="9" data-k="aar_ordine" value="${q.aar_ordine || ""}"></td>
        <td><select data-k="gate_in">${opt(sc.gate, q.gate_in, "—")}</select></td><td><input type="time" data-k="push" value="${q.push || ""}"></td>
        <td><select data-k="obiettivo">${isEA ? `<option value="">—</option><option value="stazione" ${q.stazione ? "selected" : ""}>📍 Stazione EA (clicca mappa)</option>` : opt(sc.target.map(x => ({ id: "T:" + x.id, nome: "🎯 " + x.nome })).concat(sc.cap_box.filter(c => c.lato === "BLUE").map(c => ({ id: "C:" + c.id, nome: "🔄 " + c.nome }))), q.target ? "T:" + q.target : q.cap ? "C:" + q.cap : "", "—")}</select>${(q.cap || q.stazione) ? `<br><small>per <input type="number" data-k="cap_min" value="${q.cap_min || (q.stazione && !q.cap && !q.target ? 40 : 30)}" style="width:50px"> min</small>` : ""}</td>
        <td>${q.target && !isEA ? `<select data-k="target2" title="Secondo target: metà delle GBU per velivolo sul primo, il resto sul secondo">${opt(sc.target.filter(x => x.id !== q.target).map(x => ({ id: x.id, nome: "🎯 " + x.nome })), q.target2, "—")}</select>${q.target2 ? `<br><small>${Math.ceil((t.armi.GBU48 || 0) / 2)}+${(t.armi.GBU48 || 0) - Math.ceil((t.armi.GBU48 || 0) / 2)} GBU/velivolo</small>` : ""}` : "—"}</td>
        <td><select data-k="gate_out">${opt(sc.gate, q.gate_out, "—")}</select></td><td><input type="time" data-k="decollo2" value="${q.decollo2 || ""}"></td></tr>`; }).join("")}</table></div>
      <div id="blue-verifica"></div></div>`).firstChild;
    el.querySelectorAll("[data-k]").forEach(inp => inp.addEventListener("change", e => {
      const fid = e.target.closest("tr").dataset.f; const q = p.formazioni[fid] || (p.formazioni[fid] = {}); const k = e.target.dataset.k; const v = e.target.value;
      if (k === "obiettivo") { delete q.target; delete q.cap; delete q.stazione; delete q.target2; if (v.startsWith("T:")) q.target = v.slice(2); else if (v.startsWith("C:")) q.cap = v.slice(2); else if (v === "stazione") { toast("Clicca sulla mappa il punto della stazione Growler", 5000); MAPPA.pick(pt => { q.stazione = pt; APP.salva(); piano(); }); return; } }
      else if (k === "aar_ordine" || k === "cap_min") q[k] = v ? +v : undefined; else q[k] = v || undefined;
      APP.salva(); verificaBlue(el.querySelector("#blue-verifica")); aggiornaRotteMappa();
      if (k === "obiettivo" || k === "target2") piano();
    }));
    verificaBlue(el.querySelector("#blue-verifica")); return el;
  }
  /* calcolo di fattibilità del piano BLUE (tempi reali con vento) */
  function analisiBlue(sc) {
    const p = sc.piani.BLUE || { formazioni: {} }; const w = vento(); const out = [];
    // 1) tratta base → tanker e orario di arrivo di ogni formazione
    const righe = [];
    sc.formazioni.filter(f => f.lato === "BLUE").forEach(f => {
      const q = p.formazioni[f.id]; if (!q || !q.decollo) return;
      const t = sc.tipi[f.tipo], b = sc.basi.find(x => x.id === f.base) || sc.basi.find(x => x.lato === f.lato) || sc.basi[0]; const legs = []; let clock = Engine.hm2s(q.decollo), errori = [], warn = [];
      const tk = sc.aar.find(a => a.id === q.tanker) || sc.aar[0]; if (!q.tanker) warn.push("tanker non scelto → " + tk.id);
      const e = PHYS.eta(b, tk, t.tas_crociera_kt, w); legs.push({ nome: "→ " + tk.id, da: clock, min: e.min, col: "#4a6fa5" }); clock += e.min * 60;
      righe.push({ f, q, t, b, tk, legs, errori, warn, arrivo: clock, ord: q.aar_ordine || 99 });   // senza ordine passa per ultima, come nel motore
    });
    // 2) coda al tanker come nel motore: chi arriva a tanker libero rifornisce subito; tra chi aspetta passa prima l'ordine AAR più basso (a parità, chi è arrivato prima)
    const durAar = sc.regole.aar_minuti_per_formazione;
    sc.aar.forEach(a => {
      const coda = righe.filter(r => r.tk.id === a.id); let libero = 0;
      while (coda.length) {
        // come nel motore: quando il tanker è libero si serve l'ordine AAR più basso tra chi c'è già o arriva entro 20 minuti
        const t0 = Math.max(libero, Math.min(...coda.map(x => x.arrivo))); const r = coda.filter(x => x.arrivo <= t0 + 1200).sort((x, y) => x.ord - y.ord || x.arrivo - y.arrivo)[0]; coda.splice(coda.indexOf(r), 1);
        const scavalcati = coda.filter(x => x.arrivo < r.arrivo && x.arrivo <= t0 + 1200); scavalcati.forEach(x => x.warn.push(`cede il turno al tanker a ${r.f.callsign} (ordine ${r.ord === 99 ? "–" : r.ord})`));
        const inizio = Math.max(r.arrivo, libero); if (inizio > r.arrivo + 60) { r.legs.push({ nome: "attesa AAR", da: r.arrivo, min: (inizio - r.arrivo) / 60, col: "#7f8c8d" }); r.warn.push(`attesa al tanker ${fmtMin((inizio - r.arrivo) / 60)}`); }
        r.legs.push({ nome: "AAR", da: inizio, min: durAar, col: "#2e86de" }); r.fineAar = inizio + durAar * 60; libero = r.fineAar;
      }
    });
    // 3) dal tanker in poi
    righe.forEach(r => {
      const { f, t, b, tk, legs, errori, warn } = r; let { q } = r; let clock = r.fineAar, pos = tk; let e;
      const tAar = clock; let autonomia = t.autonomia_min;
      const gIn = sc.gate.find(g => g.id === q.gate_in) || sc.gate[1]; if (!q.gate_in) warn.push("gate IN non scelto → " + gIn.id);
      e = PHYS.eta(pos, gIn, t.tas_crociera_kt, w); legs.push({ nome: "→ " + gIn.id.replace("GATE_", "gate "), da: clock, min: e.min, col: "#4a6fa5" }); clock += e.min * 60; pos = gIn;
      if (q.push) { const ps = Engine.hm2s(q.push); if (ps > clock) { legs.push({ nome: "hold", da: clock, min: (ps - clock) / 60, col: "#7f8c8d" }); clock = ps; } else if (ps < clock - 60) warn.push(`push ${q.push} non raggiungibile (arrivo ${Engine.s2hm(clock)})`); }
      const tPush = clock; let obiettivo = null, tot = null;
      // riferimenti che non esistono più nello scenario (target o CAP rinominati/cancellati dall'Editor o dall'Excel)
      if (q.target && !sc.target.some(x => x.id === q.target)) { errori.push(`target "${q.target}" inesistente nello scenario: sceglilo di nuovo`); q = Object.assign({}, q, { target: undefined, target2: undefined }); r.q = q; }
      if (q.target2 && !sc.target.some(x => x.id === q.target2)) warn.push(`2º target "${q.target2}" inesistente: ignorato`);
      if (q.cap && !sc.cap_box.some(x => x.id === q.cap)) { errori.push(`CAP "${q.cap}" inesistente nello scenario: sceglila di nuovo`); q = Object.assign({}, q, { cap: undefined }); r.q = q; }
      if (q.target) { obiettivo = sc.target.find(x => x.id === q.target); e = PHYS.eta(pos, obiettivo, t.tas_attacco_kt, w); legs.push({ nome: "ingress", da: clock, min: e.min, col: "#e67e22" }); clock += e.min * 60; tot = clock;
        // bersaglio presente solo in una finestra: in anticipo fino a 30' si aspetta sul posto, oltre o in ritardo non si trova nulla
        if (obiettivo.finestra) { const fda = Engine.hm2s(obiettivo.finestra.da), fa = Engine.hm2s(obiettivo.finestra.a); if (clock > fa) errori.push(`${obiettivo.nome}: arrivo ${Engine.s2hm(clock)}, la finestra chiude alle ${obiettivo.finestra.a}`); else if (clock < fda - 1800) errori.push(`${obiettivo.nome}: arrivo ${Engine.s2hm(clock)}, troppo presto (finestra dalle ${obiettivo.finestra.da})`); else if (clock < fda) { warn.push(`attesa sul target fino alle ${obiettivo.finestra.da}`); legs.push({ nome: "hold", da: clock, min: (fda - clock) / 60, col: "#7f8c8d" }); clock = fda; tot = clock; } }
        legs.push({ nome: "TGT", da: clock, min: sc.regole.tempo_sul_target_min, col: "#e74c3c" }); clock += sc.regole.tempo_sul_target_min * 60; pos = obiettivo;
        const gbu = (t.armi.GBU48 || 0) * f.numero; if (gbu === 0) errori.push("nessuna bomba a bordo per il target");
        const t2 = q.target2 && q.target2 !== q.target ? sc.target.find(x => x.id === q.target2) : null;
        if (t2) { e = PHYS.eta(pos, t2, t.tas_attacco_kt, w); legs.push({ nome: "→ TGT2", da: clock, min: e.min, col: "#e67e22" }); clock += e.min * 60; legs.push({ nome: "TGT2", da: clock, min: sc.regole.tempo_sul_target_min, col: "#c0392b" }); clock += sc.regole.tempo_sul_target_min * 60; pos = t2; if ((t.armi.GBU48 || 0) < 2) warn.push("una sola GBU per velivolo: sul 2º target non resta nulla"); } }
      else if (q.cap) { obiettivo = sc.cap_box.find(x => x.id === q.cap); e = PHYS.eta(pos, obiettivo, t.tas_crociera_kt, w); legs.push({ nome: "→ CAP", da: clock, min: e.min, col: "#e67e22" }); clock += e.min * 60; legs.push({ nome: "CAP", da: clock, min: q.cap_min || 30, col: "#8e44ad" }); clock += (q.cap_min || 30) * 60; pos = obiettivo; }
      else if (q.stazione) { obiettivo = q.stazione; e = PHYS.eta(pos, obiettivo, t.tas_crociera_kt, w); legs.push({ nome: "→ staz.", da: clock, min: e.min, col: "#e67e22" }); clock += e.min * 60; legs.push({ nome: "EA", da: clock, min: q.cap_min || 40, col: "#8e44ad" }); clock += (q.cap_min || 40) * 60; pos = obiettivo; }
      else warn.push("nessun target/CAP assegnato");
      const gOut = sc.gate.find(g => g.id === q.gate_out) || gIn; e = PHYS.eta(pos, gOut, t.tas_crociera_kt, w); legs.push({ nome: "egress", da: clock, min: e.min, col: "#27ae60" }); clock += e.min * 60; pos = gOut;
      const homes = [b, ...sc.aar]; const home = homes.map(hm => ({ hm, e: PHYS.eta(pos, hm, t.tas_crociera_kt, w) })).sort((a, c) => a.e.min - c.e.min)[0];
      legs.push({ nome: "RTB", da: clock, min: home.e.min, col: "#2c3e50" }); clock += home.e.min * 60;
      // consumo come nel motore: sul target ×1.5, in CAP/hold/stazione ×0.8, in transito ×1 (PHYS.REGIME)
      const K = { TGT: PHYS.REGIME.attacco, TGT2: PHYS.REGIME.attacco, CAP: PHYS.REGIME.cap, EA: PHYS.REGIME.cap, hold: PHYS.REGIME.cap };
      const usati = legs.filter(l => l.da >= tAar).reduce((s, l) => s + l.min * (K[l.nome] || 1), 0); const margine = autonomia - usati;
      if (margine < 0) errori.push(`carburante insufficiente: servono ${fmtMin(usati)} dopo l'AAR, autonomia ${autonomia} min (BINGO anticipato di ${fmtMin(-margine)})`);
      else if (margine < 5) (sc.regole.bingo_auto_rtb ? errori : warn).push(`margine carburante ${fmtMin(margine)}: sotto la riserva di 5 min scatta il BINGO e la formazione rientra prima del previsto`);
      if (clock > Engine.hm2s(sc.tempo.fine)) errori.push("la missione finisce oltre la finestra");
      out.push({ f, q, legs, tAar, tPush, tot, fine: clock, margine, usati, errori, warn, tanker: tk.id, gIn: gIn.id, gOut: gOut.id, obiettivo: q.target ? obiettivo.nome : q.cap ? obiettivo.nome : q.stazione ? "Stazione EA" : "—" });
    });
    // conflitti AAR: stesso ordine sullo stesso tanker
    sc.aar.forEach(a => { const ords = righe.filter(r => r.tk.id === a.id).map(r => r.ord); ords.forEach((o, i) => { if (o !== 99 && ords.indexOf(o) !== i) out.forEach(r => { if (r.tanker === a.id && r.q.aar_ordine === o) r.warn.push(`ordine AAR ${o} duplicato su ${a.id}`); }); }); });
    // copertura GBU
    const gbuSuTarget = {}; out.forEach(r => { if (!r.q.target) return; const gpa = sc.tipi[r.f.tipo].armi.GBU48 || 0; const due = r.q.target2 && r.q.target2 !== r.q.target; const g1 = due ? Math.ceil(gpa / 2) : gpa; gbuSuTarget[r.q.target] = (gbuSuTarget[r.q.target] || 0) + g1 * r.f.numero; if (due) gbuSuTarget[r.q.target2] = (gbuSuTarget[r.q.target2] || 0) + (gpa - g1) * r.f.numero; });
    return { out, gbuSuTarget };
  }
  function verificaBlue(cont) {
    const sc = APP.sc; const { out, gbuSuTarget } = analisiBlue(sc);
    if (!out.length) { cont.innerHTML = `<p class="muted">Inserisci almeno l'orario di decollo di una formazione per vedere la verifica.</p>`; return; }
    const t0 = Math.min(...out.map(r => r.legs[0].da)) - 300, t1 = Math.max(...out.map(r => r.fine)) + 300; const span = t1 - t0;
    let html = `<h3>Verifica automatica</h3><table><tr><th>Form.</th><th>AAR</th><th>Push</th><th>TOT</th><th>Fine</th><th>Carb.</th><th>Esito</th></tr>`;
    out.forEach(r => { const ok = !r.errori.length; html += `<tr><td><b>${r.f.callsign}</b></td><td>${Engine.s2hm(r.tAar)}<br><small>${r.tanker.replace("AAR_", "")}</small></td><td>${Engine.s2hm(r.tPush)}<br><small>${r.gIn.replace("GATE_", "")}</small></td><td>${r.tot ? Engine.s2hm(r.tot) : "-"}<br><small>${esc(r.obiettivo)}</small></td><td>${Engine.s2hm(r.fine)}</td><td>${fmtMin(r.usati)}<br><small>margine ${fmtMin(r.margine)}</small></td><td>${ok ? (r.warn.length ? `<span class="pill warn">ATTENZIONE</span>` : `<span class="pill ok">OK</span>`) : `<span class="pill bad">NO</span>`}<br><small>${[...r.errori, ...r.warn].map(esc).join("<br>")}</small></td></tr>`; });
    html += `</table><div class="gantt" style="margin-top:8px">`;
    out.forEach(r => { html += `<div class="g-row"><div class="g-lbl">${r.f.callsign}</div><div class="g-bar">${r.legs.map(l => `<div class="g-seg" style="left:${(l.da - t0) / span * 100}%;width:${l.min * 60 / span * 100}%;background:${l.col}" title="${l.nome} ${Engine.s2hm(l.da)} (${fmtMin(l.min)})">${l.nome}</div>`).join("")}</div></div>`; });
    const ticks = []; for (let s = Math.ceil(t0 / 1800) * 1800; s < t1; s += 1800) ticks.push(s);
    html += `<div class="g-axis">${ticks.map(s => `<span>${Engine.s2hm(s)}</span>`).join("")}</div></div>`;
    html += `<h3 style="margin-top:10px">Target assign</h3><table>${sc.target.map(t => { const g = gbuSuTarget[t.id] || 0; return `<tr><td>${esc(t.nome)}</td><td>${g}/${t.gbu_richieste} GBU</td><td>${g >= t.gbu_richieste ? `<span class="pill ok">coperto</span>` : g > 0 ? `<span class="pill warn">parziale</span>` : `<span class="pill">non assegnato</span>`}</td></tr>`; }).join("")}</table>`;
    const seqAar = sc.aar.map(a => `<b>${a.id}</b>: ${out.filter(r => r.tanker === a.id).sort((x, y) => (x.q.aar_ordine || 99) - (y.q.aar_ordine || 99) || x.tAar - y.tAar).map(r => r.f.callsign).join(" → ") || "—"}`).join("<br>");
    const ingress = out.filter(r => r.tPush).sort((x, y) => x.tPush - y.tPush).map(r => `${r.f.callsign} (${Engine.s2hm(r.tPush)} ${r.gIn.replace("GATE_", "")})`).join(" → ");
    const egress = out.sort((x, y) => x.fine - y.fine).map(r => `${r.f.callsign} (${r.gOut.replace("GATE_", "")})`).join(" → ");
    html += `<div class="card gold" style="margin-top:8px"><h3>Il piano in 4 righe (da presentare al briefing)</h3><p>1. <b>AAR sequence</b><br>${seqAar}</p><p>2. <b>Ingress flow</b>: ${ingress || "—"}</p><p>3. <b>Target assign</b>: ${out.filter(r => r.q.target).map(r => { const t2 = r.q.target2 && r.q.target2 !== r.q.target ? sc.target.find(x => x.id === r.q.target2) : null; return `${r.f.callsign} → ${r.obiettivo}${t2 ? " poi " + t2.nome : ""}`; }).join("; ") || "—"}</p><p>4. <b>Egress flow</b>: ${egress || "—"}</p></div>`;
    cont.innerHTML = html;
  }
  function pianoRed() {
    const sc = APP.sc; if (!sc.piani.RED) sc.piani.RED = { cap: [], prontezza: [], sam_moves: [], commit_nm: 60 }; const p = sc.piani.RED;
    const forms = sc.formazioni.filter(f => f.lato === "RED"); const boxes = sc.cap_box.filter(c => c.lato === "RED");
    const opt = (arr, v) => arr.map(a => `<option value="${a.id}" ${a.id === v ? "selected" : ""}>${esc(a.nome || a.id)}</option>`).join("");
    const el = h(`<div class="card red"><h3>Piano RED – MILITIA AEREA</h3>
      <h4>1. CAP attive (chi, dove, quando)</h4><table class="ed-table"><tr><th>CAP box</th><th>Formazione</th><th>Dalle</th><th>Alle</th><th></th></tr>
      ${p.cap.map((c, i) => `<tr data-i="${i}"><td><select data-k="box">${opt(boxes, c.box)}</select></td><td><select data-k="formazione">${opt(forms.map(f => ({ id: f.id, nome: f.callsign + " (" + f.numero + "x " + f.tipo + ")" })), c.formazione)}</select></td><td><input type="time" data-k="da" value="${c.da || ""}"></td><td><input type="time" data-k="a" value="${c.a || ""}"></td><td><button class="btn small" data-del="${i}">✕</button></td></tr>`).join("")}</table>
      <button class="btn small" id="r-add">+ Aggiungi turno CAP</button>
      <h4 style="margin-top:10px">2. Prontezza al suolo (max ${sc.regole.prontezza_max_terra} velivoli)</h4><div class="row">${forms.map(f => `<label><input type="checkbox" data-al="${f.id}" ${p.prontezza.includes(f.id) ? "checked" : ""}> ${f.callsign} <small>(${f.numero}x ${f.tipo}, ${sc.tipi[f.tipo].prontezza_min}')</small></label>`).join("")}</div>
      <h4 style="margin-top:10px">3. Sistemi SA-10</h4><p class="muted">Trascina le batterie sulla mappa (si muovono a ${sc.regole.sam_velocita_kmh} km/h). Orario di partenza: <input type="time" id="r-sam-da" value="${(p.sam_moves[0] || {}).da || sc.tempo.inizio}"></p><div id="r-sam-list">${p.sam_moves.map(m => { const s = sc.sam.find(x => x.id === m.sam); const d = GEO.dist(s, m); return `<div>◆ ${esc(s.nome)} → ${GEO.fmtBE(sc.mappa.bullseye, m)} (${d.toFixed(0)} NM ≈ ${Math.round(d * 1.852 / sc.regole.sam_velocita_kmh * 60)} min) <button class="btn small" data-samdel="${m.sam}">annulla</button></div>`; }).join("") || "<small>nessuno spostamento</small>"}</div>
      <h4 style="margin-top:10px">4. Tattica di intercettazione</h4><label>Commit sui nemici rilevati entro <input type="number" id="r-commit" value="${p.commit_nm}" min="20" max="150"> NM</label>
      <div id="red-verifica"></div></div>`).firstChild;
    const save = () => { APP.salva(); verificaRed(el.querySelector("#red-verifica")); aggiornaRotteMappa(); };
    el.querySelectorAll("tr[data-i] [data-k]").forEach(inp => inp.addEventListener("change", e => { p.cap[+e.target.closest("tr").dataset.i][e.target.dataset.k] = e.target.value; save(); }));
    el.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { p.cap.splice(+b.dataset.del, 1); APP.salva(); piano(); });
    el.querySelector("#r-add").onclick = () => { const last = p.cap[p.cap.length - 1]; p.cap.push({ box: boxes[0].id, formazione: forms[Math.min(p.cap.length, forms.length - 1)].id, da: last ? last.a : sc.tempo.inizio, a: last ? Engine.s2hm(Math.min(Engine.hm2s(last.a) + 7200, Engine.hm2s(sc.tempo.fine))) : "11:00" }); APP.salva(); piano(); };
    el.querySelectorAll("[data-al]").forEach(c => c.onchange = () => { p.prontezza = [...el.querySelectorAll("[data-al]:checked")].map(x => x.dataset.al); save(); });
    el.querySelector("#r-commit").onchange = e => { p.commit_nm = +e.target.value; save(); };
    el.querySelector("#r-sam-da").onchange = e => { p.sam_moves.forEach(m => m.da = e.target.value); save(); };
    el.querySelectorAll("[data-samdel]").forEach(b => b.onclick = () => { p.sam_moves = p.sam_moves.filter(m => m.sam !== b.dataset.samdel); APP.salva(); piano(); });
    verificaRed(el.querySelector("#red-verifica")); return el;
  }
  function verificaRed(cont) {
    const sc = APP.sc, p = sc.piani.RED; const forms = sc.formazioni.filter(f => f.lato === "RED"); const nf = id => forms.find(f => f.id === id) || { numero: 0 };
    const errori = [], warn = []; const t0 = Engine.hm2s(sc.tempo.inizio), t1 = Engine.hm2s(sc.tempo.fine);
    const alert = p.prontezza.reduce((s, id) => s + nf(id).numero, 0); if (alert > sc.regole.prontezza_max_terra) errori.push(`prontezza al suolo ${alert} velivoli > max ${sc.regole.prontezza_max_terra}`);
    p.cap.forEach((c, i) => { const d = Engine.hm2s(c.da), a = Engine.hm2s(c.a); if (!(a > d)) errori.push(`turno ${i + 1}: orari non validi`); if (a - d > sc.regole.cap_max_min * 60) warn.push(`turno ${i + 1} (${c.formazione}): ${(a - d) / 60} min > max ${sc.regole.cap_max_min} min in CAP → RTB anticipato`); if (p.prontezza.includes(c.formazione)) warn.push(`${c.formazione} è sia in CAP che in prontezza`); });
    forms.forEach(f => { const turni = p.cap.filter(c => c.formazione === f.id).sort((x, y) => Engine.hm2s(x.da) - Engine.hm2s(y.da)); for (let i = 1; i < turni.length; i++) { const gap = (Engine.hm2s(turni[i].da) - Engine.hm2s(turni[i - 1].a)) / 60; if (gap < sc.regole.turnaround_min) warn.push(`${f.callsign}: turno alle ${turni[i].da} prima della fine del turnaround (${sc.regole.turnaround_min} min, pronti al ${Math.round(sc.regole.efficienza_turnaround * 100)}%)`); } });
    // copertura oraria
    let html = `<h3>Verifica automatica</h3>${errori.length ? `<span class="pill bad">NO</span> ` : warn.length ? `<span class="pill warn">ATTENZIONE</span> ` : `<span class="pill ok">OK</span> `}<small>${[...errori, ...warn].map(esc).join("<br>")}</small><div class="gantt" style="margin-top:8px">`;
    const span = t1 - t0; sc.cap_box.filter(c => c.lato === "RED").forEach(b => { html += `<div class="g-row"><div class="g-lbl">${b.id}</div><div class="g-bar">${p.cap.filter(c => c.box === b.id).map(c => `<div class="g-seg" style="left:${(Engine.hm2s(c.da) - t0) / span * 100}%;width:${(Engine.hm2s(c.a) - Engine.hm2s(c.da)) / span * 100}%;background:#c0392b">${c.formazione} ${nf(c.formazione).numero}x</div>`).join("")}</div></div>`; });
    html += `<div class="g-row"><div class="g-lbl">in volo</div><div class="g-bar">`; for (let s = t0; s < t1; s += 1800) { const n = p.cap.filter(c => Engine.hm2s(c.da) <= s && Engine.hm2s(c.a) > s).reduce((x, c) => x + nf(c.formazione).numero, 0); html += `<div class="g-seg" style="left:${(s - t0) / span * 100}%;width:${1800 / span * 100}%;background:${n === 0 ? "#333" : n < 8 ? "#e67e22" : "#27ae60"}">${n}</div>`; } html += `</div></div>`;
    const ticks = []; for (let s = t0; s < t1; s += 3600) ticks.push(s); html += `<div class="g-axis">${ticks.map(s => `<span>${Engine.s2hm(s)}</span>`).join("")}</div></div><p><small>Prontezza al suolo: <b>${alert}</b>/${sc.regole.prontezza_max_terra} velivoli (${p.prontezza.join(", ") || "nessuno"})</small></p>`;
    html += `<div class="card gold" style="margin-top:8px"><h3>Il piano in 4 righe</h3><p>1. <b>CAP attive</b>: ${p.cap.map(c => `${c.box} ${c.da}–${c.a} ${c.formazione}`).join("; ") || "—"}</p><p>2. <b>Prontezza al suolo</b>: ${alert} velivoli</p><p>3. <b>Orari di massimo sforzo</b>: ${oreMax(sc, p)}</p><p>4. <b>SA-10</b>: ${p.sam_moves.length ? p.sam_moves.map(m => m.sam + " spostato").join(", ") : "in posizione"}</p></div>`;
    cont.innerHTML = html;
  }
  function oreMax(sc, p) { const t0 = Engine.hm2s(sc.tempo.inizio), t1 = Engine.hm2s(sc.tempo.fine); let best = 0, ore = []; for (let s = t0; s < t1; s += 3600) { const n = p.cap.filter(c => Engine.hm2s(c.da) <= s && Engine.hm2s(c.a) > s).reduce((x, c) => x + (sc.formazioni.find(f => f.id === c.formazione) || { numero: 0 }).numero, 0); if (n > best) { best = n; ore = [Engine.s2hm(s)]; } else if (n === best && n > 0) ore.push(Engine.s2hm(s)); } return best ? `${best} velivoli alle ${ore.join(", ")}` : "—"; }
  function aggiornaRotteMappa() {
    const sc = APP.sc; const rotte = [];
    if (lati().includes("BLUE") && sc.piani.BLUE) { const eng = APP.engine; sc.formazioni.filter(f => f.lato === "BLUE").forEach((f, i) => { const q = sc.piani.BLUE.formazioni[f.id]; if (!q || !q.decollo) return; const fl = eng.flights.find(x => x.id === f.id); if (!fl) return; const wps = eng.rottaBlue({ ...fl, piano: q }, true); const b = sc.basi.find(x => x.id === f.base) || sc.basi.find(x => x.lato === "BLUE"); rotte.push({ id: f.id, colore: ["#2e86de", "#5dade2", "#48c9b0", "#85c1e9", "#a569bd"][i % 5], pts: [b, ...wps], etichetta: f.callsign }); }); }
    MAPPA.disegnaRotte(rotte);
    const sams = sc.sam.map(s => { const m = (sc.piani.RED && sc.piani.RED.sam_moves || []).find(x => x.sam === s.id); return { ...s, attivo: true, dest: m ? { lat: m.lat, lon: m.lon } : null }; });
    MAPPA.disegnaSam(sams, lati().includes("RED") && APP.fase === "piano", (id, lat, lon) => { const p = sc.piani.RED || (sc.piani.RED = { cap: [], prontezza: [], sam_moves: [], commit_nm: 60 }); p.sam_moves = p.sam_moves.filter(m => m.sam !== id); p.sam_moves.push({ sam: id, lat, lon, da: ($("#r-sam-da") || {}).value || sc.tempo.inizio }); APP.salva(); piano(); });
  }

  /* ================= ESECUZIONE ================= */
  function esecuzione() {
    const sc = APP.sc, eng = APP.engine;
    const mancaBlue = !sc.piani.BLUE || !Object.values(sc.piani.BLUE.formazioni || {}).some(q => q.decollo), mancaRed = !sc.piani.RED || !(sc.piani.RED.cap || []).length;
    let html = `<div class="step-hint"><b>FASE 3 – ESECUZIONE.</b> Premi <b>▶</b> in basso. I velivoli volano con fisica reale (vento ${sc.meteo.vento_da_gradi}°/${sc.meteo.vento_kt} kt). Nell'execution <b>non si fa planning</b>: si osserva, si registrano gli eventi e si prendono solo le decisioni previste dal piano.${(mancaBlue || mancaRed) ? `<br><span class="pill warn">ATTENZIONE</span> ${mancaBlue ? "manca il piano BLUE. " : ""}${mancaRed ? "manca il piano RED (i RED non decolleranno). " : ""}Usa "Piano demo" nella fase 2 per un esempio.` : ""}</div>`;
    html += `<div id="ob-live"></div>`;
    if (APP.ruolo === "TRAINER") html += `<div class="card gold"><h3>Inject / contingency (solo trainer)</h3><div class="row">${sc.inject.map(i => `<label title="${esc(i.descrizione)}"><input type="checkbox" data-inj="${i.id}" ${i.attivo ? "checked" : ""}> ${esc(i.nome)}</label>`).join("")}</div></div>`;
    html += `<div class="card gold"><button class="btn primary big" id="btn-mondo3d">🌍 VISTA 3D DELLA MISSIONE <small style="color:#dfe9f5">(6 telecamere: orbita, inseguimento, cockpit HUD, torre, satellite, target)</small></button>
      ${APP.ruolo !== "RED" ? `<label style="display:block;margin-top:8px"><input type="checkbox" id="chk-v3d" ${APP.vista3dAuto ? "checked" : ""}> 🎥 <b>Cinematica 3D degli attacchi</b> <small>(la simulazione si ferma durante la cinematica, poi riparte da sola)</small></label>` : ""}</div>`;
    html += `<div class="card"><h3>Formazioni</h3><div id="fl-list"></div></div><div class="card"><h3>Dettaglio</h3><div id="fl-detail"><small>Clicca una formazione (in lista o sulla mappa)</small></div></div>
      <button class="btn primary big" onclick="APP.vaiFase('debrief')">Vai alla FASE 4 – DEBRIEF →</button>`;
    $("#left-content").innerHTML = html; $("#left").classList.remove("wide");
    $$("[data-inj]").forEach(c => c.onchange = e => { const i = sc.inject.find(x => x.id === e.target.dataset.inj); i.attivo = e.target.checked; toast(`Inject ${i.nome} ${i.attivo ? "ATTIVATO" : "disattivato"}`); });
    const cv = $("#chk-v3d"); if (cv) cv.onchange = e => { APP.vista3dAuto = e.target.checked; };
    const bm = $("#btn-mondo3d"); if (bm) bm.onclick = () => MONDO3D.apri(APP.sel);
    aggiornaRotteMappa(); MAPPA.disegnaRotte([]); aggiornaEsecuzione();
  }
  function aggiornaEsecuzione() {
    const sc = APP.sc, eng = APP.engine; const list = $("#fl-list"); if (!list) return;
    const ol = $("#ob-live"); if (ol) { const h = obiettiviCard(eng); if (ol._h !== h) { ol._h = h; ol.innerHTML = h; } }
    const vista = eng.vista(APP.ruolo); const visibili = new Set(vista.flights.map(f => f.id));
    list.innerHTML = eng.flights.filter(f => APP.ruolo === "TRAINER" || f.lato === APP.ruolo).map(f => { const t = sc.tipi[f.tipo]; const pct = Math.max(0, Math.min(100, f.autonomia / (f.autonomia_max + 40) * 100)); return `<div class="fl-row ${f.lato.toLowerCase()} ${f.id === APP.sel ? "sel" : ""} ${f.distrutto ? "dead" : ""}" data-id="${f.id}"><img src="assets/icons/${t.icona === "sam" ? "f22" : t.icona}.png"><span class="cs">${f.callsign}<br><small>${Math.max(0, f.n)}x ${f.tipo}</small></span><span class="st">${esc(f.fase)}${f.alt > 50 ? `<br>FL${Math.round(f.alt / 100)} · ${Math.round(f.gs)} kt` : ""}</span><span class="fuel" title="autonomia ${Math.round(f.autonomia)} min"><i class="${pct < 20 ? "crit" : pct < 40 ? "low" : ""}" style="width:${pct}%"></i></span></div>`; }).join("");
    list.querySelectorAll(".fl-row").forEach(r => r.onclick = () => { APP.sel = r.dataset.id; const f = eng.flights.find(x => x.id === APP.sel); if (f && f.alt > 50) MAPPA.centra(f); aggiornaEsecuzione(); });
    const d = $("#fl-detail"); const f = eng.flights.find(x => x.id === APP.sel);
    if (f) { const t = sc.tipi[f.tipo]; const wp = f.wps[f.wp_i];
      d.innerHTML = `<b>${f.callsign}</b> – ${f.n}x ${t.nome} <span class="pill ${f.lato.toLowerCase()}">${f.lato}</span><br><small>${esc(f.fase)}${wp ? " → " + esc(wp.nome) : ""}</small>
        <table style="margin-top:6px"><tr><td>Prua / Rotta</td><td>${Math.round(f.hdg)}° / ${Math.round(f.track || f.hdg)}°</td><td>GS / TAS</td><td>${Math.round(f.gs)} / ${Math.round(f.tas)} kt</td></tr><tr><td>Quota</td><td>FL${Math.round(f.alt / 100)}</td><td>Mach</td><td>${(f.mach || 0).toFixed(2)}</td></tr><tr><td>Autonomia</td><td>${Math.max(0, Math.round(f.autonomia))} min</td><td>Fattore di carico</td><td>${(f.nG || 1).toFixed(1)} g</td></tr><tr><td>Armi</td><td colspan="3">${Object.entries(f.armi).map(([a, n]) => `${n} ${a}`).join(", ") || "-"}${f.bombe_sganciate ? " · <span class='pill warn'>bombe sganciate – KR dimezzato</span>" : ""}</td></tr><tr><td>Posizione</td><td colspan="3">${GEO.fmtBE(sc.mappa.bullseye, f)} · quadrato ${GEO.gridCell(f, sc.mappa.griglia).label}</td></tr></table>
        ${f.alt > 50 && !f.distrutto ? `<button class="btn small primary" id="btn-m3d-follow" style="margin-top:6px">🌍 Segui in 3D</button>` : ""}
        ${(APP.ruolo === "TRAINER" || APP.ruolo === f.lato) && f.lato === "BLUE" && f.wps.some(w => w.azione === "attacco") && (f.armi.GBU48 || 0) > 0 && !f.distrutto ? `<button class="btn small" id="btn-v3d-prev" style="margin-top:6px">🎥 Anteprima 3D dell'attacco</button>` : ""}
        ${APP.ruolo === "TRAINER" || APP.ruolo === f.lato ? `<div class="row cmds" style="margin-top:6px">${f.alt > 50 && !f.distrutto && f.stato !== "rtb" ? `<button class="btn small" data-cmd="rtb">RTB ora</button>` : ""}${f.lato === "RED" && (f.stato === "terra" || f.stato === "prontezza") ? `<button class="btn small" data-cmd="scramble">SCRAMBLE</button>` : ""}${f.lato === "BLUE" && f.stato === "terra" && f.piano ? `<button class="btn small" data-cmd="decolla_ora">Decolla ora</button>` : ""}${f.alt > 50 ? sc.cap_box.filter(c => c.lato === f.lato).map(c => `<button class="btn small" data-cmd="cap" data-arg="${c.id}">→ ${c.id}</button>`).join("") : ""}</div>${f.lato === "BLUE" && f.alt > 50 && (f.armi.GBU48 || 0) > 0 && f.stato !== "attacco" ? `<div class="row cmds tgt" style="margin-top:4px" title="Target assign manuale: nuova rotta target → gate di uscita → base">${sc.target.map(tg => { const tt = eng.target.find(x => x.id === tg.id) || tg; const cur = (f.wps.find(w => w.azione === "attacco") || {}).target === tg.id; return `<button class="btn small ${cur ? "primary" : tt.distrutto ? "" : "gold"}" data-cmd="target" data-arg="${tg.id}" ${cur || tt.distrutto ? "disabled" : ""} title="${esc(tg.nome)} · ${tt.danni || 0}/${tg.gbu_richieste} GBU a segno${tt.distrutto ? " · DISTRUTTO" : ""}${cur ? " · target attuale" : ""}">🎯 ${esc(tg.id.replace(/^TGT_/, ""))}${tt.distrutto ? " ✓" : ""}</button>`; }).join("")}</div>` : ""}` : ""}`;
      d.querySelectorAll("[data-cmd]").forEach(b => b.onclick = () => { if (b.disabled) return; if (b.dataset.cmd === "target" && !confirm(`Target assign: ${f.callsign} → ${(sc.target.find(x => x.id === b.dataset.arg) || {}).nome}?\nLa formazione lascia la rotta attuale, attacca il nuovo target e rientra dal gate di uscita.`)) return; eng.comando(f.id, b.dataset.cmd, b.dataset.arg); aggiornaEsecuzione(); });
      const bf = d.querySelector("#btn-m3d-follow"); if (bf) bf.onclick = () => MONDO3D.apri(f.id);
      const bp = d.querySelector("#btn-v3d-prev"); if (bp) bp.onclick = () => { const w = f.wps.find(x => x.azione === "attacco"); const t = eng.target.find(x => x.id === w.target); const gbu = (f.armi.GBU48 || 0) * f.n; APP.apriVista3d({ flight: f.id, target: t.id, n: f.n, gbu, danni: t.danni + gbu, richieste: t.gbu_richieste, distrutto: t.danni + gbu >= t.gbu_richieste }); }; }
  }

  /* ================= SCORE + LOG ================= */
  function score() {
    const eng = APP.engine, sc = APP.sc; const s = eng.score; const tg = eng.target;
    $("#score").innerHTML = `<div class="score-grid"><div class="score-side blue"><b>BLUE</b><span class="n">${s.BLUE.kills}</span><small>abbattimenti · perdite ${s.BLUE.perdite}</small><small>target distrutti ${s.BLUE.target_distrutti}/${tg.length} · ${s.BLUE.gbu} GBU</small><small>netto Excel ${s.BLUE.netto_excel.toFixed(1)}</small></div><div class="score-side red"><b>RED</b><span class="n">${s.RED.kills}</span><small>abbattimenti · perdite ${s.RED.perdite}</small><small>S-300 lanciati ${s.RED.missili_sam} · SAM attive ${eng.sam.filter(x => x.attivo).length}</small><small>netto Excel ${s.RED.netto_excel.toFixed(1)}</small></div></div>
      <div style="margin-top:6px">${tg.map(t => `<small>${esc(t.nome.split("(")[0])} ${t.distrutto ? "💥" : ""}</small><div class="tgt-bar"><i style="width:${Math.min(100, t.danni / t.gbu_richieste * 100)}%"></i></div>`).join("")}</div>`;
  }
  function log(ev) {
    const filtro = $("#log-filter").value; const box = $("#log");
    const add = e => { if (filtro && e.tipo !== filtro && !(filtro === "kill" && e.tipo === "kill")) return; if (APP.ruolo !== "TRAINER" && !["sistema", "inject"].includes(e.tipo)) { const chi = APP.engine.flights.find(f => f.callsign === e.chi); if (chi && chi.lato !== APP.ruolo && e.tipo !== "kill" && e.tipo !== "ingaggio") return; } const d = h(`<div class="ev ${e.tipo}"><span class="t">${e.ora}</span><span class="chi">${esc(e.chi)}</span>${esc(e.testo)}</div>`).firstChild; box.appendChild(d); };
    if (ev) { add(ev); box.scrollTop = box.scrollHeight; } else { box.innerHTML = ""; APP.engine.eventi.forEach(add); box.scrollTop = box.scrollHeight; }
  }

  /* ================= DEBRIEF ================= */
  function debrief() {
    const eng = APP.engine, sc = APP.sc; const r = eng.report();
    const kpi = `<div class="deb-kpi"><div><span class="n" style="color:var(--blue)">${r.score.BLUE.kills}</span><small>kill BLUE</small></div><div><span class="n" style="color:var(--red)">${r.score.RED.kills}</span><small>kill RED</small></div><div><span class="n">${r.score.BLUE.target_distrutti}/${r.target.length}</span><small>target distrutti</small></div><div><span class="n">${r.score.BLUE.netto_excel.toFixed(1)}</span><small>netto (stile Excel)</small></div></div>`;
    let html = `<div class="step-hint"><b>FASE 4 – DEBRIEF.</b> L'analysis inizia sempre valutando il <b>risultato</b> (successful?) e i <b>safety point</b>. Poi si ripercorrono le decisioni con la timeline. Niente "secondo me": fatti, orari, numeri.</div>
      <button class="btn primary big" id="d-highlights" style="margin-bottom:8px">🏆 HIGHLIGHTS – reward della squadra (medaglie, obiettivi distrutti, attacchi respinti e subiti)</button>
      <div class="row" style="margin-bottom:8px"><button class="btn small" id="d-print">🖨 Stampa / PDF</button><button class="btn small" id="d-json">⬇ Report JSON</button><button class="btn small" id="d-csv">⬇ Eventi CSV</button><button class="btn small" id="d-salva">💾 Salva sul server</button></div>${kpi}
      ${obiettiviCard(eng, "Obiettivi della missione")}<div class="card"><h3>Replay</h3><div class="replay"><button class="btn small" id="rp-play">▶</button><input type="range" id="rp-range" min="0" max="${Math.max(0, eng.registrazione.length - 1)}" value="${Math.max(0, eng.registrazione.length - 1)}"><span id="rp-time">${r.durata}</span></div><small>Trascina per rivedere le posizioni (campionate ogni 30 s di simulazione).</small></div>
      <div class="card"><h3>Target</h3><table><tr><th>Target</th><th>GBU</th><th>Esito</th></tr>${r.target.map(t => `<tr><td>${esc(t.nome)}</td><td>${t.danni}/${t.richieste}</td><td>${t.distrutto ? `<span class="pill ok">DISTRUTTO</span>` : t.danni ? `<span class="pill warn">${t.pct}%</span>` : `<span class="pill">intatto</span>`}</td></tr>`).join("")}</table></div>
      <div class="card"><h3>Ingaggi aria-aria (formula kill ratio)</h3>${r.ingaggi.length ? `<table><tr><th>Ora</th><th>BLUE</th><th>RED</th><th>Atteso B−R</th><th>Kill B / R</th></tr>${r.ingaggi.map(i => `<tr><td>${i.ora}</td><td>${i.blue} ${i.nB}x (KR ${i.krB}${i.bombe ? "½" : ""})</td><td>${i.red} ${i.nR}x (KR ${i.krR})</td><td>${i.attesoB.toFixed(2)} − ${i.attesoR.toFixed(2)} = <b>${i.netto.toFixed(2)}</b></td><td>${i.killB} / ${i.killR}</td></tr>`).join("")}</table>` : "<small>nessun ingaggio</small>"}</div>
      <div class="card"><h3>Formazioni</h3><table><tr><th>Form.</th><th>Iniz.</th><th>Rim.</th><th>Decollo</th><th>Atterr.</th><th>Stato</th></tr>${r.formazioni.map(f => `<tr class="${f.lato.toLowerCase()}"><td><b>${f.callsign}</b></td><td>${f.iniziali}</td><td>${f.rimasti}</td><td>${f.decollo}</td><td>${f.atterraggio}</td><td><small>${esc(f.stato)}</small></td></tr>`).join("")}</table></div>
      <div class="card"><h3>SAM</h3>${r.sam.map(s => `<div>◆ ${esc(s.nome)}: ${s.missili_rimasti} missili ${s.spostata ? "· spostata" : ""}</div>`).join("")}</div>
      <div class="card green"><h3>Analysis (compila insieme)</h3><div class="checklist"><label><input type="checkbox"> Successful? Il task è stato raggiunto? (quali target, quali perdite)</label><label><input type="checkbox"> Safety point: cosa ha messo a rischio le formazioni (BINGO, SAM senza copertura, ingaggi non previsti)</label><label><input type="checkbox"> Timeline: il piano ha retto? Dove si è scostata l'esecuzione?</label><label><input type="checkbox"> 5T: quale T era debole? (Task, Threat, Target, Timeline, Tactics)</label><label><input type="checkbox"> GICOL rispettata? Qualcuno ha "inventato" in execution?</label><label><input type="checkbox"> Leadership: chi ha deciso cosa, e quando. Decisioni sotto stress.</label>${sc.missione && sc.missione.domande ? sc.missione.domande.map(d => `<label><input type="checkbox"> <b>${esc(sc.missione.codice)}:</b> ${esc(d)}</label>`).join("") : ""}</div><textarea id="d-note" placeholder="Note del trainer / lessons learned">${esc(APP.noteDebrief || "")}</textarea></div>
      <div class="card"><h3>Attacchi – rivedi in 3D</h3>${r.eventi.filter(e => e.v3d && /PICKLE|SHACK/.test(e.testo)).map((e, i) => `<div class="row" style="margin-bottom:4px"><button class="btn small" data-v3d="${i}">🎥 ${e.ora} ${esc(e.chi)}</button><small>${esc(e.testo)}</small></div>`).join("") || "<small>nessun attacco portato a termine</small>"}</div>
      <div class="card"><h3>Timeline eventi chiave</h3><div style="max-height:300px;overflow:auto">${r.eventi.filter(e => ["kill", "ingaggio", "inject", "avviso"].includes(e.tipo) || /AIRBORNE|PUSH|SHACK|ON STATION|PICKLE|AAR completato/.test(e.testo)).map(e => `<div class="ev ${e.tipo}"><span class="t">${e.ora}</span><span class="chi">${esc(e.chi)}</span>${esc(e.testo)}</div>`).join("")}</div></div>`;
    $("#left-content").innerHTML = html; $("#left").classList.add("wide");
    $("#d-highlights").onclick = () => HIGHLIGHTS.apri(APP.ruolo === "RED" ? "RED" : "BLUE");
    $("#d-print").onclick = () => window.print(); $("#d-json").onclick = () => DATAIO.downloadJSON({ scenario: sc.meta, piani: sc.piani, report: r }, "debrief_centurion.json");
    $("#d-csv").onclick = () => DATAIO.downloadText("ora;chi;tipo;testo\n" + r.eventi.map(e => `${e.ora};${e.chi};${e.tipo};"${e.testo.replace(/"/g, "'")}"`).join("\n"), "eventi_centurion.csv", "text/csv");
    $("#d-salva").onclick = async () => { const ok = await DATAIO.serverSalva("debrief_" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"), { scenario: sc, report: r }); toast(ok ? "Debrief salvato in data/salvataggi" : "Server non disponibile: usa ⬇ Report JSON"); };
    $("#d-note").onchange = e => APP.noteDebrief = e.target.value;
    const att = r.eventi.filter(e => e.v3d && /PICKLE|SHACK/.test(e.testo)); $$("[data-v3d]").forEach(b => b.onclick = () => APP.apriVista3d(att[+b.dataset.v3d].v3d));
    const rng = $("#rp-range"); rng.oninput = () => replayA(+rng.value); let rpTimer = null;
    $("#rp-play").onclick = () => { if (rpTimer) { clearInterval(rpTimer); rpTimer = null; $("#rp-play").textContent = "▶"; return; } $("#rp-play").textContent = "⏸"; if (+rng.value >= +rng.max) rng.value = 0; rpTimer = setInterval(() => { rng.value = +rng.value + 1; replayA(+rng.value); if (+rng.value >= +rng.max) { clearInterval(rpTimer); rpTimer = null; $("#rp-play").textContent = "▶"; } }, 120); };
  }
  function replayA(i) {
    const eng = APP.engine; const snap = eng.registrazione[i]; if (!snap) return; $("#rp-time").textContent = Engine.s2hm(snap.t);
    const flights = snap.f.map(([id, lat, lon, hdg, n, stato, alt, aut]) => { const f = eng.flights.find(x => x.id === id); return { ...f, lat, lon, hdg, n, stato, alt, autonomia: aut, distrutto: stato === "distrutto", ingaggio: null, gs: 0, mach: 0 }; });
    MAPPA.aggiornaFlights({ flights }, APP.sel, null);
  }

  /* ================= EDITOR DATI ================= */
  let edTab = "regole";
  function editor() {
    const sc = APP.sc;
    const tabs = [["regole", "Regole"], ["meteo", "Meteo"], ["tipi", "Velivoli"], ["kr", "Kill ratio (KRO)"], ["formazioni", "Formazioni"], ["punti", "Basi / Target / AAR / Gate / CAP / SAM"], ["briefing", "Briefing"], ["squadre", "Squadre"], ["inject", "Inject"], ["agenda", "Agenda"], ["tempo", "Tempo & mappa"]];
    $("#left-content").innerHTML = `<div class="step-hint"><b>EDITOR DATI.</b> Tutto ciò che vedi nel simulatore è modificabile qui o in Excel (<code>data/Centurion_Config.xlsx</code>). Le modifiche si salvano automaticamente nel browser. Dopo aver cambiato formazioni/basi premi "Applica".</div>
      <div class="row" style="margin-bottom:8px"><button class="btn small primary" id="e-applica">✔ Applica e ricostruisci</button><button class="btn small" id="e-excel-out">⬇ Esporta Excel</button><button class="btn small" id="e-excel-srv">⬆ Carica Excel dal server</button><button class="btn small" id="e-json-out">⬇ JSON</button><button class="btn small" id="e-json-in">⬆ JSON</button><button class="btn small" id="e-reset">↺ Ripristina default</button></div>
      <div class="drop-zone" id="e-drop">⬆ Trascina qui un file <b>Centurion_Config.xlsx</b> (o JSON) per importarlo</div>
      <div class="ed-tabs">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${k === edTab ? "active" : ""}">${n}</button>`).join("")}</div><div id="ed-body"></div>`;
    $("#left").classList.add("wide");
    $$("[data-tab]").forEach(b => b.onclick = () => { edTab = b.dataset.tab; editor(); });
    $("#e-applica").onclick = () => { APP.ricostruisci(); toast("Scenario applicato: motore e mappa ricostruiti"); };
    $("#e-excel-out").onclick = () => DATAIO.exportExcel(sc, "Centurion_Config.xlsx");
    $("#e-excel-srv").onclick = async () => { const r = await DATAIO.serverExcel(sc); if (!r) return toast("Server non raggiungibile o file assente (avvia con AVVIA_SIMULATORE.bat)"); APP.sc = r.sc; APP.ricostruisci(); editor(); toast("Excel importato: " + r.log.join(", "), 6000); };
    $("#e-json-out").onclick = () => DATAIO.downloadJSON(sc, "centurion_scenario.json");
    $("#e-json-in").onclick = () => { const i = document.createElement("input"); i.type = "file"; i.accept = ".json,.xlsx"; i.onchange = () => importaFile(i.files[0]); i.click(); };
    $("#e-reset").onclick = () => { if (confirm("Ripristinare lo scenario di default? Le modifiche e i piani andranno persi.")) { DATAIO.cancellaLocale(); APP.sc = DATAIO.clone(SCENARIO_DEFAULT); APP.ricostruisci(); editor(); } };
    const dz = $("#e-drop"); dz.ondragover = e => { e.preventDefault(); dz.classList.add("over"); }; dz.ondragleave = () => dz.classList.remove("over"); dz.ondrop = e => { e.preventDefault(); dz.classList.remove("over"); importaFile(e.dataTransfer.files[0]); };
    const body = $("#ed-body"); const bind = () => { body.querySelectorAll("[data-path]").forEach(inp => inp.addEventListener("change", e => { setPath(sc, e.target.dataset.path, e.target.type === "checkbox" ? e.target.checked : e.target.type === "number" ? +e.target.value : e.target.value); APP.salva(); })); };
    const tabella = (arr, cols, path, add) => `<div class="ed-wrap"><table class="ed-table"><tr>${cols.map(c => `<th>${c}</th>`).join("")}<th></th></tr>${arr.map((r, i) => `<tr>${cols.map(c => `<td><input data-path="${path}.${i}.${c}" value="${esc(r[c] ?? "")}" ${typeof r[c] === "number" ? 'type="number" step="any"' : ""}></td>`).join("")}<td><button class="btn small" data-rm="${path}:${i}">✕</button></td></tr>`).join("")}</table></div><button class="btn small" data-add="${path}">+ riga</button>`;
    switch (edTab) {
      case "regole": body.innerHTML = `<table>${Object.entries(sc.regole).map(([k, v]) => `<tr><td><b>${k}</b><br><small>${esc(DATAIO.DESCR_REGOLE[k] || "")}</small></td><td>${typeof v === "boolean" ? `<input type="checkbox" data-path="regole.${k}" ${v ? "checked" : ""}>` : typeof v === "number" ? `<input type="number" step="any" data-path="regole.${k}" value="${v}">` : `<input data-path="regole.${k}" value="${esc(v)}">`}</td></tr>`).join("")}</table>`; break;
      case "meteo": body.innerHTML = `<table>${Object.entries(sc.meteo).map(([k, v]) => `<tr><td><b>${k}</b></td><td>${typeof v === "boolean" ? `<input type="checkbox" data-path="meteo.${k}" ${v ? "checked" : ""}>` : typeof v === "number" ? `<input type="number" step="any" data-path="meteo.${k}" value="${v}">` : `<input data-path="meteo.${k}" value="${esc(v)}" style="width:100%">`}</td></tr>`).join("")}</table>`; break;
      case "tipi": { const cols = ["nome", "lato", "tas_crociera_kt", "tas_attacco_kt", "quota_ft", "roc_fpm", "bank_nav", "bank_tatt", "autonomia_min", "consumo_lbh", "radar_nm", "missili_nm", "stealth", "prontezza_min"]; body.innerHTML = `<div class="ed-wrap"><table class="ed-table"><tr><th>id</th>${cols.map(c => `<th>${c}</th>`).join("")}<th>armi</th></tr>${Object.entries(sc.tipi).map(([id, t]) => `<tr><td><b>${id}</b></td>${cols.map(c => `<td><input data-path="tipi.${id}.${c}" value="${esc(t[c] ?? "")}" ${typeof t[c] === "number" ? 'type="number" step="any"' : ""}></td>`).join("")}<td>${Object.entries(t.armi || {}).map(([a, n]) => `${a} <input type="number" data-path="tipi.${id}.armi.${a}" value="${n}" style="width:50px">`).join(" ")}</td></tr>`).join("")}</table></div><small>stealth: fattore di riduzione dei raggi radar/missili avversari (1 = nessuna riduzione, 0.3 = molto stealth). Le velocità sono TAS in nodi, le quote in piedi, ROC in ft/min.</small>`; break; }
      case "kr": { const att = Object.keys(sc.kill_ratio), def = [...new Set(att.flatMap(a => Object.keys(sc.kill_ratio[a])))]; body.innerHTML = `<h4>Kill ratio base (attaccante → difensore)</h4><table class="ed-table"><tr><th></th>${def.map(d => `<th>${d}</th>`).join("")}</tr>${att.map(a => `<tr><td><b>${a}</b></td>${def.map(d => `<td><input type="number" step="any" data-path="kill_ratio.${a}.${d}" value="${sc.kill_ratio[a][d] ?? ""}"></td>`).join("")}</tr>`).join("")}</table><h4>Kill ratio con bombe sganciate</h4><table class="ed-table"><tr><th></th>${def.map(d => `<th>${d}</th>`).join("")}</tr>${Object.keys(sc.kill_ratio_con_bombe).map(a => `<tr><td><b>${a}</b></td>${def.map(d => `<td><input type="number" step="any" data-path="kill_ratio_con_bombe.${a}.${d}" value="${(sc.kill_ratio_con_bombe[a] || {})[d] ?? ""}"></td>`).join("")}</tr>`).join("")}</table><small>Fonte: kill & Shot.xlsx (KR5 = vs Su-57, KRL = vs Su-35, KRBomb/KRBLeg = con bombe). Il risultato "stile Excel" di un ingaggio è n_att×KR_att − n_dif×KR_dif.</small>`; break; }
      case "formazioni": body.innerHTML = tabella(sc.formazioni, ["id", "callsign", "lato", "tipo", "numero", "base", "ruolo"], "formazioni") + `<small>tipo ∈ {${Object.keys(sc.tipi).join(", ")}} · base ∈ {${sc.basi.map(b => b.id).join(", ")}} · ruolo: SWEEP/ESCORT, STRIKE, SEAD/EA, DCA</small>`; break;
      case "punti": body.innerHTML = `<h4>Basi</h4>${tabella(sc.basi, ["id", "nome", "lato", "lat", "lon", "nazione", "pista_ft"], "basi")}<h4>Target</h4>${tabella(sc.target, ["id", "nome", "lat", "lon", "gbu_richieste", "descrizione"], "target")}<h4>AAR (tanker)</h4>${tabella(sc.aar, ["id", "nome", "lat", "lon", "quota_ft", "orient", "lunghezza_nm"], "aar")}<h4>Orbite (E-7)</h4>${tabella(sc.orbite, ["id", "nome", "tipo", "lat", "lon", "quota_ft"], "orbite")}<h4>Gate</h4>${tabella(sc.gate, ["id", "nome", "lat", "lon"], "gate")}<h4>CAP box</h4>${tabella(sc.cap_box, ["id", "nome", "lato", "lat", "lon", "raggio_nm"], "cap_box")}<h4>SAM</h4>${tabella(sc.sam, ["id", "nome", "lat", "lon", "missili", "raggio_nm"], "sam")}<small>Suggerimento: muovi il mouse sulla mappa per leggere lat/lon in basso a sinistra.</small>`; break;
      case "briefing": body.innerHTML = ["BLUE", "RED"].map(l => `<h4>${l}</h4>` + Object.entries(sc.briefing[l]).map(([k, v]) => `<label><b>${k}</b>${Array.isArray(v) ? " <small>(una voce per riga)</small>" : ""}<textarea data-path="briefing.${l}.${k}" data-list="${Array.isArray(v)}">${esc(Array.isArray(v) ? v.join("\n") : v)}</textarea></label>`).join("")).join(""); break;
      case "squadre": body.innerHTML = ["BLUE", "RED"].map(l => `<h4>${l}</h4><label>Nome squadra <input data-path="squadre.${l}.nome" value="${esc(sc.squadre[l].nome)}"></label> <label>Nazione <input data-path="squadre.${l}.nazione" value="${esc(sc.squadre[l].nazione)}"></label> <label>Ruolo <input data-path="squadre.${l}.ruolo" value="${esc(sc.squadre[l].ruolo)}"></label>${tabella(sc.squadre[l].membri, ["nome", "ruolo"], `squadre.${l}.membri`)}`).join(""); break;
      case "inject": body.innerHTML = tabella(sc.inject, ["id", "nome", "descrizione"], "inject") + "<small>Gli inject con id tanker_fallout, aeroporto_chiuso, no_awacs, no_sam, temporale, terremoto hanno effetti simulati; gli altri sono solo narrativi (li annuncia il trainer).</small>"; break;
      case "agenda": body.innerHTML = tabella(sc.agenda, ["ora", "durata", "fase"], "agenda"); break;
      case "tempo": body.innerHTML = `<label>Inizio finestra <input type="time" data-path="tempo.inizio" value="${sc.tempo.inizio}"></label> <label>Fine <input type="time" data-path="tempo.fine" value="${sc.tempo.fine}"></label> <label>Tick (s) <input type="number" data-path="tempo.tick_sec" value="${sc.tempo.tick_sec}"></label><h4>Griglia</h4><label>Lato (NM) <input type="number" data-path="mappa.griglia.lato_nm" value="${sc.mappa.griglia.lato_nm}"></label> <label>Colonne <input type="number" data-path="mappa.griglia.colonne" value="${sc.mappa.griglia.colonne}"></label> <label>Righe <input type="number" data-path="mappa.griglia.righe" value="${sc.mappa.griglia.righe}"></label><h4>Bullseye</h4><label>Nome <input data-path="mappa.bullseye.nome" value="${esc(sc.mappa.bullseye.nome)}"></label> <label>Lat <input type="number" step="any" data-path="mappa.bullseye.lat" value="${sc.mappa.bullseye.lat}"></label> <label>Lon <input type="number" step="any" data-path="mappa.bullseye.lon" value="${sc.mappa.bullseye.lon}"></label><h4>Meta</h4>${Object.entries(sc.meta).map(([k, v]) => `<label>${k} <input data-path="meta.${k}" value="${esc(v)}"></label> `).join("")}`; break;
    }
    bind();
    body.querySelectorAll("textarea[data-list='true']").forEach(t => t.addEventListener("change", e => { setPath(sc, e.target.dataset.path, e.target.value.split("\n").map(s => s.trim()).filter(Boolean)); APP.salva(); }));
    body.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { const [p, i] = b.dataset.rm.split(":"); getPath(sc, p).splice(+i, 1); APP.salva(); editor(); });
    body.querySelectorAll("[data-add]").forEach(b => b.onclick = () => { const arr = getPath(sc, b.dataset.add); const tmpl = arr[arr.length - 1] || {}; const n = {}; Object.keys(tmpl).forEach(k => n[k] = typeof tmpl[k] === "number" ? 0 : ""); n.id = (tmpl.id || "NUOVO") + "_2"; arr.push(n); APP.salva(); editor(); });
  }
  function getPath(o, p) { return p.split(".").reduce((a, k) => a[k], o); }
  function setPath(o, p, v) { const ks = p.split("."); const last = ks.pop(); const t = ks.reduce((a, k) => a[k] ?? (a[k] = {}), o); if (typeof t[last] === "number" && typeof v === "string" && v !== "" && !isNaN(+v)) v = +v; t[last] = v; }
  function importaFile(file) {
    if (!file) return; const r = new FileReader();
    if (file.name.endsWith(".json")) { r.onload = () => { try { const o = JSON.parse(r.result); APP.sc = o.scenario && o.scenario.tipi ? o.scenario : o; APP.ricostruisci(); editor(); toast("JSON importato"); } catch (e) { toast("JSON non valido"); } }; r.readAsText(file); }
    else { r.onload = () => { try { const res = DATAIO.importExcel(new Uint8Array(r.result), APP.sc); APP.sc = res.sc; APP.ricostruisci(); editor(); toast("Excel importato: " + res.log.join(", "), 6000); } catch (e) { console.error(e); toast("Errore nell'Excel: " + e.message); } }; r.readAsArrayBuffer(file); }
  }

  /* ================= TOUR ================= */
  const TOUR = [
    ["#fasi", "<b>Le 4 fasi</b> del Fighter Pilot Day sono i 4 pulsanti in alto: Briefing → Piano → Esecuzione → Debrief. L'Editor dati serve al trainer per personalizzare tutto."],
    ["#left", "<b>Pannello di lavoro.</b> Qui leggi il briefing, compili il piano con tabelle semplici, segui le formazioni durante l'esecuzione e leggi il report nel debrief."],
    ["#map", "<b>Mappa reale</b> del Nord California (carta Mt Shasta). Vedi confini, basi, target (▲), tanker (AAR), gate di ingresso (⬢), CAP box, anelli SA-10 e la griglia operativa. Passa il mouse per leggere coordinate, bullseye e quadrato."],
    ["#map-tools", "<b>Strumenti mappa:</b> cambia la mappa di base, sovrapponi la carta aeronautica originale, mostra i raggi radar, misura distanze e tempi con il righello."],
    ["#right", "<b>Punteggio e log eventi</b> in tempo reale, con la fraseologia operativa (AIRBORNE, PUSH, FOX 3, SPLASH, BINGO, MAGNUM...)."],
    ["#bottombar", "<b>Orologio e comandi</b>: ▶ avvia, +1' avanza di un minuto, scegli la velocità (×1 … ×120). Barra spaziatrice = play/pausa."],
    ["#btn-demo", "<b>Demo guidata</b>: carica piani d'esempio per entrambe le squadre e fa girare la missione commentandola. Perfetta per il lancio del workshop."]
  ];
  let tourI = 0;
  function tour(i) { tourI = i == null ? 0 : i; const [sel, txt] = TOUR[tourI]; $$(".tour-hl").forEach(e => e.classList.remove("tour-hl")); const el = $(sel); if (el) el.classList.add("tour-hl"); $("#tour").classList.remove("hidden"); $("#tour-text").innerHTML = txt; $("#tour-step").textContent = `${tourI + 1}/${TOUR.length}`;
    const box = $(".tour-box"); const r = el ? el.getBoundingClientRect() : { left: 100, top: 100, width: 0, height: 0, right: 100, bottom: 100 }; let left = Math.min(window.innerWidth - 380, Math.max(10, r.left + 10)), top = r.bottom + 10; if (top > window.innerHeight - 160) top = Math.max(10, r.top - 150); if (sel === "#left" || sel === "#right") { top = 120; left = sel === "#left" ? r.right + 10 : r.left - 380; } box.style.left = left + "px"; box.style.top = top + "px"; }
  function tourEnd() { $$(".tour-hl").forEach(e => e.classList.remove("tour-hl")); $("#tour").classList.add("hidden"); }

  return { toast, modal, chiudiModal, briefing, piano, esecuzione, aggiornaEsecuzione, score, log, debrief, editor, tour, tourEnd, tourNext: () => tourI < TOUR.length - 1 ? tour(tourI + 1) : tourEnd(), tourPrev: () => tour(Math.max(0, tourI - 1)), aggiornaRotteMappa, analisiBlue, esc };
})();
/* =====================================================================
   VISTA 3D DELL'ATTACCO – v2 (Three.js, locale)
   - terreno con quote reali (AWS Terrarium) + imagery satellitare Esri (zoom 14 e 16)
   - cielo con sole calcolato dall'ora della simulazione, nubi/visibilità/vento dal meteo reale NOAA
   - velivoli estrusi dalle sagome reali (icone del corso) con fusoliera, tettuccio, derive, ugelli
   - GBU guidate, esplosioni con shader particellare (fuoco additivo, fumo, polvere), onda d'urto, flash,
     detriti con scia, incendi persistenti, crateri e bruciature
   - HUD stile caccia nella vista di inseguimento e bomb-cam
   - registrazione WebM (MediaRecorder) per il video di lancio
   ===================================================================== */
const VISTA3D = (() => {
  const TS = 2.5, G = 9.81;
  let overlay, canvas, hudCanvas, hudCtx, renderer, scene, camera, clock, raf, st, audio, recorder, recChunks;
  const TERRA = { grids: {}, ready: false, base: 0, t14: null, tileM: 0 };

  /* ---------- DOM ---------- */
  function dom() {
    if (overlay) return;
    overlay = document.createElement("div"); overlay.id = "vista3d"; overlay.className = "hidden";
    overlay.innerHTML = `<canvas id="v3d-canvas"></canvas><canvas id="v3d-hud-canvas"></canvas>
      <div class="v3d-hud"><div class="v3d-top"><span id="v3d-cs"></span><span id="v3d-tgt"></span></div>
      <div id="v3d-msg" class="v3d-msg"></div><div id="v3d-banner" class="v3d-banner"></div>
      <div class="v3d-bottom"><span id="v3d-info"></span><button id="v3d-skip" class="btn">Salta ▶</button></div></div>`;
    document.body.appendChild(overlay); canvas = overlay.querySelector("#v3d-canvas"); hudCanvas = overlay.querySelector("#v3d-hud-canvas"); hudCtx = hudCanvas.getContext("2d");
    overlay.querySelector("#v3d-skip").onclick = () => chiudi();
    window.addEventListener("resize", ridimensiona);
  }
  function ridimensiona() { if (!renderer || overlay.classList.contains("hidden")) return; renderer.setSize(window.innerWidth, window.innerHeight); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); hudCanvas.width = window.innerWidth; hudCanvas.height = window.innerHeight; }

  /* ---------- audio ---------- */
  function audioInit() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)(); const master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      const dest = ctx.createMediaStreamDestination(); master.connect(dest);
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = buf.getChannelData(0); let last = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      const jet = ctx.createBufferSource(); jet.buffer = buf; jet.loop = true; const jf = ctx.createBiquadFilter(); jf.type = "lowpass"; jf.frequency.value = 220; const jg = ctx.createGain(); jg.gain.value = 0; jet.connect(jf); jf.connect(jg); jg.connect(master); jet.start();
      return { ctx, master, dest, noise: buf, jetGain: jg };
    } catch (e) { return null; }
  }
  function suonoEsplosione(dist) {
    if (!audio) return; const { ctx, master, noise } = audio; const t = ctx.currentTime + Math.min(1.5, dist / 340);
    const src = ctx.createBufferSource(); src.buffer = noise; const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(70, t + 1.8);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.3, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + 2.8);
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(55, t); o.frequency.exponentialRampToValueAtTime(25, t + 1.4); const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.9, t + 0.03); og.gain.exponentialRampToValueAtTime(0.0001, t + 1.8); o.connect(og); og.connect(master); o.start(t); o.stop(t + 2);
  }
  function suonoFischio(durata) {
    if (!audio) return; const { ctx, master } = audio; const t = ctx.currentTime; const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(380, t + durata);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + durata); o.connect(g); g.connect(master); o.start(t); o.stop(t + durata + 0.1);
  }

  /* ---------- utilità ---------- */
  function matStd(c, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7, metalness: 0.3 }, extra || {})); }
  function srgb(tex) { if (THREE.sRGBEncoding !== undefined && tex.encoding !== undefined) tex.encoding = THREE.sRGBEncoding; else if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace; return tex; }
  function lonLatToTile(lon, lat, z) { const n = 2 ** z; const x = (lon + 180) / 360 * n; const lr = lat * Math.PI / 180; const y = (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n; return { x, y, n }; }
  /* ---------- tile: proxy locale con cache (server.py /tile/...) oppure sorgenti dirette; caricamento con tentativi ripetuti ---------- */
  const TILE = { proxy: false };
  function tileUrl(kind, z, x, y) {
    if (TILE.proxy) return `tile/${kind}/${z}/${x}/${y}`;
    return kind === "dem" ? `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png` : `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  }
  function caricaTex(loader, url, onok, onfail, tent) { tent = tent || 0; loader.load(url, onok, undefined, () => { if (tent < 2) setTimeout(() => caricaTex(loader, url, onok, onfail, tent + 1), 900 * (tent + 1)); else if (onfail) onfail(); }); }
  function caricaDem(url, onok, onfail, tent) { tent = tent || 0; const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => onok(img); img.onerror = () => { if (tent < 2) setTimeout(() => caricaDem(url, onok, onfail, tent + 1), 900 * (tent + 1)); else if (onfail) onfail(); }; img.src = url; }
  function demGrid(img) { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, 256, 256).data; const arr = new Float32Array(65536); for (let i = 0; i < 65536; i++) arr[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768; return arr; }
  const elev = (x, z) => {
    if (!TERRA.ready) return 0; const fx = TERRA.t14.x + x / TERRA.tileM, fy = TERRA.t14.y + z / TERRA.tileM; const tx = Math.floor(fx), ty = Math.floor(fy); const g = TERRA.grids[tx + "_" + ty]; if (!g) return 0;
    const px = (fx - tx) * 255, py = (fy - ty) * 255; const x0 = Math.floor(px), y0 = Math.floor(py), x1 = Math.min(255, x0 + 1), y1 = Math.min(255, y0 + 1); const ax = px - x0, ay = py - y0;
    const h = g[y0 * 256 + x0] * (1 - ax) * (1 - ay) + g[y0 * 256 + x1] * ax * (1 - ay) + g[y1 * 256 + x0] * (1 - ax) * ay + g[y1 * 256 + x1] * ax * ay; return h - TERRA.base;
  };

  /* ---------- terreno: quote Terrarium + imagery ---------- */
  function terreno(lat, lon, root) {
    const loader = new THREE.TextureLoader(); loader.setCrossOrigin("anonymous");
    const t14 = lonLatToTile(lon, lat, 14); const tileM = 40075016.686 * Math.cos(lat * Math.PI / 180) / t14.n;
    Object.assign(TERRA, { grids: {}, ready: false, base: 0, t14, tileM });
    const base = new THREE.Mesh(new THREE.PlaneGeometry(90000, 90000), matStd(0x55603f, { roughness: 1, metalness: 0 })); base.rotation.x = -Math.PI / 2; base.position.y = -3; root.add(base);
    const meshes = []; const R14 = 4, R16 = 2;
    const mk = (z, r, y, seg, t) => { const tx = Math.floor(t.x), ty = Math.floor(t.y); const tm = 40075016.686 * Math.cos(lat * Math.PI / 180) / t.n;
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
        const cx = (tx + dx + 0.5 - t.x) * tm, cz = (ty + dy + 0.5 - t.y) * tm; const geo = new THREE.PlaneGeometry(tm, tm, seg, seg); geo.rotateX(-Math.PI / 2);
        const mat = matStd(0x4f5d3a, { roughness: 1, metalness: 0 }); const mesh = new THREE.Mesh(geo, mat); mesh.position.set(cx, y, cz); mesh.receiveShadow = true; mesh.visible = false; root.add(mesh); meshes.push(mesh);
        caricaTex(loader, tileUrl("img", z, tx + dx, ty + dy), tex => { srgb(tex); tex.anisotropy = 8; mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; mesh.visible = true; }, () => { if (z === 14) mesh.visible = true; });
      } };
    mk(14, R14, 0, 32, t14); mk(16, R16, 0.6, 24, lonLatToTile(lon, lat, 16));
    // quote: tile Terrarium (AWS) 256 px, h = R*256 + G + B/256 - 32768
    const tx = Math.floor(t14.x), ty = Math.floor(t14.y); let pending = 0;
    const done = () => { if (--pending > 0) return; TERRA.ready = true; TERRA.base = 0; TERRA.base = elev(0, 0);
      meshes.forEach(m => { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, elev(p.getX(i) + m.position.x, p.getZ(i) + m.position.z)); p.needsUpdate = true; m.geometry.computeVertexNormals(); });
      if (st) st.terrenoPronto = true; };
    for (let dx = -R14; dx <= R14; dx++) for (let dy = -R14; dy <= R14; dy++) {
      pending++;
      caricaDem(tileUrl("dem", 14, tx + dx, ty + dy), img => { try { TERRA.grids[(tx + dx) + "_" + (ty + dy)] = demGrid(img); } catch (e) {} done(); }, done);
    }
  }

  /* ---------- cielo, sole, nubi ---------- */
  function sole(ora, lat, giorno) { // elevazione/azimut approssimati (ora locale solare)
    const decl = 23.44 * Math.sin(2 * Math.PI * (284 + giorno) / 365) * Math.PI / 180; const H = (ora - 12.5) * 15 * Math.PI / 180; const φ = lat * Math.PI / 180;
    const el = Math.asin(Math.sin(φ) * Math.sin(decl) + Math.cos(φ) * Math.cos(decl) * Math.cos(H));
    const az = Math.atan2(-Math.sin(H), Math.tan(decl) * Math.cos(φ) - Math.sin(φ) * Math.cos(H));
    return { el, az };
  }
  function cielo(o) {
    const m = (o.meteo || {}); const s = sole(o.ora != null ? o.ora : 10.5, o.target.lat, m.giorno || 165);
    const elN = Math.max(0, Math.sin(s.el)); const cop = m.copertura || 0;
    const zen = new THREE.Color().setHSL(0.6, 0.65 - 0.35 * cop, 0.45 + 0.25 * elN - 0.12 * cop); const hor = new THREE.Color().setHSL(0.58 - 0.08 * (1 - elN), 0.5 - 0.3 * cop, 0.78 - 0.15 * cop);
    if (elN < 0.25) { hor.setHSL(0.07, 0.75, 0.6); zen.setHSL(0.62, 0.55, 0.25 + elN); }
    const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { zen: { value: zen }, hor: { value: hor } },
      vertexShader: "varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 zen; uniform vec3 hor; varying vec3 vW; void main(){ float h = normalize(vW).y; float k = pow(max(0.0, h), 0.45); gl_FragColor = vec4(mix(hor, zen, k), 1.0); }" });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(38000, 32, 16), skyMat); scene.add(dome);
    const sunDir = new THREE.Vector3(Math.sin(s.az) * Math.cos(s.el), Math.sin(s.el), -Math.cos(s.az) * Math.cos(s.el)).normalize();
    const sun = new THREE.DirectionalLight(new THREE.Color().setHSL(0.1, 0.5, elN < 0.25 ? 0.6 : 0.95), (0.4 + 1.1 * elN) * (1 - 0.55 * cop)); sun.position.copy(sunDir).multiplyScalar(4000); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -700, right: 700, top: 700, bottom: -700, near: 100, far: 9000 }); sun.shadow.bias = -0.0005; scene.add(sun);
    scene.add(new THREE.HemisphereLight(hor.clone().multiplyScalar(1.1), 0x4a4030, 0.5 + 0.25 * cop));
    const sunTex = puffTexture(true); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, color: 0xfff4d6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.copy(sunDir).multiplyScalar(30000); sp.scale.setScalar(4500); scene.add(sp);
    // visibilità → nebbia; nubi → strato a quota base
    const visM = Math.max(2000, (m.visibilita_sm != null ? m.visibilita_sm : 10) * 1609); scene.fog = new THREE.Fog(hor.clone().lerp(zen, 0.25), visM * 0.25, visM * 1.05); scene.background = hor;
    if (cop > 0.1) { const baseFt = m.nubi_base_ft || 6000; const h = baseFt * 0.3048; const tex = nuvoleTexture(cop); const cm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, fog: true }); const cl = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), cm); cl.rotation.x = -Math.PI / 2; cl.position.y = h; cl.renderOrder = -1; scene.add(cl); st.nubi = { mesh: cl, tex }; }
    st.vento = ventoVettore(m); st.sunDir = sunDir;
    overlay.querySelector("#v3d-info").textContent = `VISTA 3D · tempo ×${TS} · quote AWS Terrarium · imagery Esri${m.reale ? " · meteo NOAA " + (m.aggiornato || "") : ""} · sole ${Math.round(s.el * 180 / Math.PI)}°`;
  }
  function ventoVettore(m) { const da = (m.vento_suolo_da != null ? m.vento_suolo_da : m.vento_da_gradi || 270) * Math.PI / 180; const kt = (m.vento_suolo_kt != null ? m.vento_suolo_kt : (m.vento_kt || 10) * 0.4); const v = kt * 0.5144; return new THREE.Vector3(-Math.sin(da) * v, 0, Math.cos(da) * v); }
  function nuvoleTexture(cop) {
    const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d"); g.clearRect(0, 0, 512, 512);
    const n = Math.round(60 + 400 * cop); for (let i = 0; i < n; i++) { const x = Math.random() * 512, y = Math.random() * 512, r = 25 + Math.random() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, r); const a = 0.25 + 0.55 * cop; gr.addColorStop(0, `rgba(245,245,250,${a})`); gr.addColorStop(0.6, `rgba(225,228,235,${a * 0.6})`); gr.addColorStop(1, "rgba(220,224,232,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); return t;
  }
  function puffTexture(soft) {
    const key = soft ? "s" : "p"; puffTexture.c = puffTexture.c || {}; if (puffTexture.c[key]) return puffTexture.c[key];
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    if (soft) { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,0.6)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
    else { for (let i = 0; i < 34; i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * 26; const x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, r = 14 + Math.random() * 28; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,0.32)"); gr.addColorStop(0.5, "rgba(255,255,255,0.12)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
      // maschera radiale morbida: niente bordi netti
      g.globalCompositeOperation = "destination-in"; const mk = g.createRadialGradient(64, 64, 10, 64, 64, 64); mk.addColorStop(0, "rgba(0,0,0,1)"); mk.addColorStop(0.55, "rgba(0,0,0,0.8)"); mk.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = mk; g.fillRect(0, 0, 128, 128); g.globalCompositeOperation = "source-over"; }
    puffTexture.c[key] = new THREE.CanvasTexture(c); return puffTexture.c[key];
  }

  /* ---------- sistema particellare con shader (fuoco / fumo / polvere) ---------- */
  function particelle(n, tipo) {
    const geo = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3).fill(-9000), vel = new Float32Array(n * 3), start = new Float32Array(n).fill(-1e9), life = new Float32Array(n).fill(1), size = new Float32Array(n), rot = new Float32Array(n), seed = new Float32Array(n);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("aVel", new THREE.BufferAttribute(vel, 3)); geo.setAttribute("aStart", new THREE.BufferAttribute(start, 1)); geo.setAttribute("aLife", new THREE.BufferAttribute(life, 1)); geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1)); geo.setAttribute("aRot", new THREE.BufferAttribute(rot, 1)); geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const fire = tipo === "fire";
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: fire ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true,
      uniforms: Object.assign({ map: { value: puffTexture(false) }, uTime: { value: 0 }, uWind: { value: new THREE.Vector3() }, uScale: { value: 900 }, uFire: { value: fire ? 1 : 0 }, uDust: { value: tipo === "dust" ? 1 : 0 } }, THREE.UniformsUtils.clone(THREE.UniformsLib.fog)),
      vertexShader: `attribute vec3 aVel; attribute float aStart, aLife, aSize, aRot, aSeed; uniform float uTime, uScale, uFire; uniform vec3 uWind; varying float vT, vRot, vSeed; varying float vFog;
        void main(){ float t = (uTime - aStart) / aLife; vT = clamp(t, 0.0, 1.0); vRot = aRot + t * 1.2 * (aSeed - 0.5); vSeed = aSeed;
          float tt = max(t, 0.0) * aLife; vec3 p = position + aVel * tt * (1.0 - 0.45 * vT) + uWind * tt + vec3(0.0, (uFire > 0.5 ? 6.0 : 9.0) * tt * (1.0 - 0.3 * vT), 0.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); float grow = uFire > 0.5 ? (0.5 + 1.6 * vT) : (0.35 + 2.4 * vT);
          gl_PointSize = (t < 0.0 || t > 1.0) ? 0.0 : aSize * grow * uScale / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; vFog = -mv.z; }`,
      fragmentShader: `uniform sampler2D map; uniform float uFire, uDust; uniform vec3 fogColor; uniform float fogNear, fogFar; varying float vT, vRot, vSeed, vFog;
        void main(){ vec2 uv = gl_PointCoord - 0.5; float c = cos(vRot), s = sin(vRot); uv = vec2(c*uv.x - s*uv.y, s*uv.x + c*uv.y) + 0.5; vec4 tex = texture2D(map, uv);
          vec3 col; float a;
          if (uFire > 0.5) { col = mix(vec3(1.0, 0.95, 0.65), vec3(1.0, 0.25, 0.03), pow(vT, 0.6)) * (2.2 - 1.6 * vT); a = tex.a * (1.0 - vT) * (1.0 - vT); }
          else if (uDust > 0.5) { col = vec3(0.60, 0.53, 0.40); a = tex.a * 0.42 * (1.0 - vT); }
          else { col = mix(vec3(0.40, 0.37, 0.34), vec3(0.09, 0.09, 0.10), min(1.0, vT * 1.6 + 0.2 * vSeed)); a = tex.a * 0.72 * (1.0 - vT * vT); }
          float f = smoothstep(fogNear, fogFar, vFog); col = mix(col, fogColor, f * (uFire > 0.5 ? 0.0 : 0.8)); a *= (1.0 - f * 0.9);
          gl_FragColor = vec4(col, a); }` });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.userData = { n, next: 0 }; return pts;
  }
  function emit(pts, p, n, vel, spread, life, size) {
    const g = pts.geometry, u = pts.userData; const P = g.attributes.position.array, V = g.attributes.aVel.array, S = g.attributes.aStart.array, L = g.attributes.aLife.array, Z = g.attributes.aSize.array, R = g.attributes.aRot.array, D = g.attributes.aSeed.array;
    for (let k = 0; k < n; k++) { const i = u.next; u.next = (u.next + 1) % u.n; P[i * 3] = p.x + (Math.random() - 0.5) * spread; P[i * 3 + 1] = p.y + Math.random() * spread * 0.4; P[i * 3 + 2] = p.z + (Math.random() - 0.5) * spread;
      const a = Math.random() * Math.PI * 2, r = Math.random(); V[i * 3] = vel.x + Math.cos(a) * vel.w * r; V[i * 3 + 1] = vel.y * (0.4 + Math.random()); V[i * 3 + 2] = vel.z + Math.sin(a) * vel.w * r; S[i] = st.t; L[i] = life * (0.6 + Math.random() * 0.8); Z[i] = size * (0.6 + Math.random() * 0.8); R[i] = Math.random() * 6.28; D[i] = Math.random(); }
    ["position", "aVel", "aStart", "aLife", "aSize", "aRot", "aSeed"].forEach(k => g.attributes[k].needsUpdate = true);
  }

  /* ---------- modelli: estrusione delle sagome reali ---------- */
  const TIPI3D = { f22: { len: 18.9, span: 13.6, code: [-1.6, 1.6], tailZ: -0.33, tailH: 2.6, cant: 0.45, ugelli: 2, col: 0x6b7280 }, f15: { len: 19.4, span: 13.0, code: [-1.5, 1.5], tailZ: -0.36, tailH: 3.2, cant: 0, ugelli: 2, col: 0x5c6670 }, f16: { len: 15.0, span: 9.8, code: [0], tailZ: -0.33, tailH: 3.0, cant: 0, ugelli: 1, col: 0x6a7380 }, typhoon: { len: 15.9, span: 11.0, code: [0], tailZ: -0.3, tailH: 3.2, cant: 0, ugelli: 2, col: 0x717a88 }, f16b: { len: 15.0, span: 9.8, code: [0], tailZ: -0.33, tailH: 3.0, cant: 0, ugelli: 1, col: 0x6a7380 } };
  const sagome = {};
  function caricaSagoma(nome) {
    if (sagome[nome]) return sagome[nome];
    sagome[nome] = new Promise(res => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); const w = 64, h = Math.round(64 * img.height / img.width); c.width = w; c.height = h; const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data; const rows = [];
      for (let y = 0; y < h; y++) { let l = -1, r = -1; for (let x = 0; x < w; x++) { const a = d[(y * w + x) * 4 + 3]; if (a > 100) { if (l < 0) l = x; r = x; } } rows.push([l, r]); } res({ w, h, rows }); }; img.onerror = () => res(null); img.src = "assets/icons/" + nome + ".png"; });
    return sagome[nome];
  }
  function modelloDaSagoma(sg, cfg) {
    const g = new THREE.Group(); const m = matStd(cfg.col, { roughness: 0.55, metalness: 0.45 }); const dark = matStd(0x23272e, { metalness: 0.7, roughness: 0.4 });
    const scale = cfg.len / sg.h; const cx = sg.w / 2;
    const pts = []; const valid = sg.rows.map((r, y) => r[0] >= 0 ? { y, l: r[0], r: r[1] } : null).filter(Boolean);
    valid.forEach(v => pts.push([(v.r + 1 - cx) * scale, -(sg.h / 2 - v.y) * scale])); for (let i = valid.length - 1; i >= 0; i--) { const v = valid[i]; pts.push([(v.l - cx) * scale, -(sg.h / 2 - v.y) * scale]); }
    const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.3, bevelSegments: 2 }); geo.rotateX(-Math.PI / 2); geo.translate(0, -0.3, 0);
    const wing = new THREE.Mesh(geo, m); wing.castShadow = true; g.add(wing);
    // fusoliera a profilo (lathe) lungo Z
    const prof = [[0, 0.5], [0.3, 0.46], [0.75, 0.38], [1.0, 0.3], [1.15, 0.18], [1.2, 0.06], [1.0, -0.1], [0.75, -0.32], [0.45, -0.46], [0.15, -0.5], [0.02, -0.5]].map(([r, z]) => new THREE.Vector2(r * 1.05, z * cfg.len));
    const fus = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), m); fus.rotation.x = -Math.PI / 2; fus.castShadow = true; g.add(fus);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), new THREE.MeshStandardMaterial({ color: 0x1b2a3a, metalness: 0.95, roughness: 0.15 })); canopy.scale.set(1, 0.75, 2.6); canopy.position.set(0, 1.0, cfg.len * 0.22); g.add(canopy);
    cfg.code.forEach(x => { const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, cfg.tailH), new THREE.Vector2(-1.4, cfg.tailH), new THREE.Vector2(-3.2, 0)]); const tg = new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: false }); const fin = new THREE.Mesh(tg, m); fin.rotation.y = Math.PI / 2; fin.position.set(x, 0.6, cfg.tailZ * cfg.len); fin.rotation.z = x > 0 ? -cfg.cant : cfg.cant; fin.castShadow = true; g.add(fin); });
    const ux = cfg.ugelli === 2 ? [-0.75, 0.75] : [0]; ux.forEach(x => { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 1.6, 12, 1, true), dark); e.rotation.x = Math.PI / 2; e.position.set(x, -0.1, -cfg.len * 0.49); g.add(e); const glow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), new THREE.MeshBasicMaterial({ color: 0xffa040 })); glow.position.set(x, -0.1, -cfg.len * 0.49 - 0.8); glow.rotation.y = Math.PI; g.add(glow); });
    return g;
  }
  function jetFallback(colore) { const g = new THREE.Group(); const m = matStd(colore); const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 15, 12), m); fus.rotation.x = Math.PI / 2; g.add(fus); const ws = new THREE.Shape(); ws.moveTo(0, 2); ws.lineTo(6.5, -4.5); ws.lineTo(6.5, -6); ws.lineTo(0, -4.5); ws.lineTo(-6.5, -6); ws.lineTo(-6.5, -4.5); ws.lineTo(0, 2); const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(ws, { depth: 0.25, bevelEnabled: false }), m); wing.rotation.x = Math.PI / 2; g.add(wing); return g; }
  function bomba() { const g = new THREE.Group(); const m = matStd(0x3d4a3a, { metalness: 0.5 }); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.6, 10), m); body.rotation.x = Math.PI / 2; g.add(body); const nose = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 10), m); nose.rotation.x = Math.PI / 2; nose.position.z = 1.75; g.add(nose); [0, Math.PI / 2].forEach(r => { const fin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.7), m); fin.rotation.z = r; fin.position.z = -1.1; g.add(fin); }); return g; }
  function texEdificio(tipo, c) { // texture procedurale: lamiera grecata (hangar) o griglia di finestre (C2)
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 128; const g = cv.getContext("2d"); const col = new THREE.Color(c); g.fillStyle = `rgb(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)})`; g.fillRect(0, 0, 256, 128);
    if (tipo === "hangar") { for (let x = 0; x < 256; x += 6) { g.fillStyle = x % 12 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.08)"; g.fillRect(x, 0, 3, 128); } g.fillStyle = "rgba(20,24,30,0.75)"; g.fillRect(40, 48, 176, 80); g.fillStyle = "rgba(255,255,255,0.15)"; for (let x = 44; x < 216; x += 22) g.fillRect(x, 50, 2, 78); }
    else { for (let y = 10; y < 118; y += 16) for (let x = 8; x < 250; x += 14) { g.fillStyle = Math.random() < 0.7 ? "rgba(40,60,90,0.85)" : "rgba(220,230,240,0.6)"; g.fillRect(x, y, 9, 10); } }
    g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, 0, 256, 6); const t = new THREE.CanvasTexture(cv); srgb(t); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function edificio(w, d, h, c) { const tex = texEdificio(h > 20 ? "c2" : "hangar", c || 0x9aa0a6); tex.repeat.set(Math.max(1, Math.round(w / 40)), 1); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matStd(0xffffff, { map: tex, roughness: 0.85, metalness: 0.1 })); m.position.y = h / 2; m.castShadow = true; m.receiveShadow = true; const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.6, d * 1.02), matStd(0x55595e)); roof.position.y = h / 2; m.add(roof); m.userData.h = h; return m; }
  function elicottero() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 12), matStd(0x4b5a3f)); b.position.y = 1.6; g.add(b); const rot = new THREE.Mesh(new THREE.BoxGeometry(16, 0.12, 0.5), matStd(0x222)); rot.position.y = 3.4; g.add(rot); const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 7), matStd(0x4b5a3f)); tail.position.set(0, 2.2, -9); g.add(tail); g.userData.h = 3.5; return g; }
  function serbatoio() { const m = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 7, 20), matStd(0xd8d8d8, { metalness: 0.6, roughness: 0.4 })); m.position.y = 3.5; m.userData.h = 7; return m; }

  /* ---------- scena ---------- */
  function costruisci(o) {
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 60000);
    st = { o, objs: [], jets: [], bombs: [], impacts: [], debris: [], fires: [], t: 0, released: false, nextRelease: 0, bombsLeft: o.gbu, speed: 220, alt: 2500, pos: new THREE.Vector3(-7200, 2500, 0), shake: 0, resultShown: false, aimIdx: 0, log: [], heading: 90 };
    cielo(o);
    const ground = new THREE.Group(); scene.add(ground); terreno(o.target.lat, o.target.lon, ground);
    const cat = o.target.categoria; const tipoT = cat === "c2" || /C2/i.test(o.target.id) ? "c2" : /BENTON|HELO/i.test(o.target.id + o.target.nome) ? "helo" : cat && cat !== "aeroporto" ? cat : "airfield";
    const add = (m, x, z, ry) => { m.position.x = x; m.position.z = z; if (ry) m.rotation.y = ry; scene.add(m); st.objs.push(m); return m; };
    const box = (w, h, d, c, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matStd(c)); m.position.y = (y || 0) + h / 2; m.castShadow = true; m.receiveShadow = true; m.userData.h = h; return m; };
    const camion = (c, lung) => { const g = new THREE.Group(); g.add(box(2.6, 2.4, lung || 8, c)); const cab = box(2.5, 2.2, 2.2, 0x3b4232); cab.position.z = (lung || 8) / 2 + 1.1; g.add(cab); g.userData.h = 3; return g; };
    if (tipoT === "ponte") { const deck = box(18, 2.5, 420, 0x9c9a92, 22); add(deck, 0, 0); for (let z = -180; z <= 180; z += 60) { const p = box(6, 24, 6, 0x8a877e); add(p, -6, z); const p2 = box(6, 24, 6, 0x8a877e); add(p2, 6, z); } for (let i = 0; i < 4; i++) add(camion(0x4f5a3c), (i % 2 ? 3 : -3), -120 + i * 70); }
    else if (tipoT === "nave") { const scafo = box(26, 9, 150, 0x5d666e, -4); add(scafo, 0, 0); const ponte = box(18, 12, 30, 0x707a83, 5); add(ponte, 0, -25); const alb = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 22, 8), matStd(0x8d959c)); alb.position.y = 28; alb.userData.h = 22; add(alb, 0, -25); const prua = box(14, 6, 30, 0x5d666e, -2); add(prua, 0, 80); [-12, 12].forEach(x => add(box(3, 3, 8, 0x40474d, 5), x, 40)); }
    else if (tipoT === "radar") { add(box(6, 3, 10, 0x55603f), -25, 0); add(box(6, 3, 10, 0x55603f), 25, 10); const ant = box(14, 9, 0.8, 0xc7ccd1, 6); add(ant, 0, -30); const piat = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), matStd(0xe6e9ec)); piat.position.y = 2; piat.userData.h = 7; add(piat, 40, -40); [[-50, 30], [-10, 45], [30, 40]].forEach(([x, z]) => add(camion(0x4f5a3c, 7), x, z, 0.5)); }
    else if (tipoT === "deposito") { for (let i = 0; i < 8; i++) add(serbatoio(), (i % 4) * 40 - 60, Math.floor(i / 4) * 45 - 20); add(box(50, 8, 20, 0x8e9aa6), 0, 70); [[-80, 60], [80, 60]].forEach(([x, z]) => add(camion(0x8a6a2c, 10), x, z, 1.57)); }
    else if (tipoT === "ferrovia") { for (let b = -2; b <= 2; b++) for (let i = 0; i < 10; i++) add(box(3, 3.5, 14, i % 3 ? 0x6a4b3a : 0x3f4a55), b * 9, i * 16 - 80); add(box(30, 10, 60, 0x8e9aa6), 60, 0); add(box(12, 14, 12, 0xa3a7ad), -50, 60); }
    else if (tipoT === "convoglio" || tipoT === "lanciatore") { const n = tipoT === "convoglio" ? 12 : 3; for (let i = 0; i < n; i++) { const c = camion(i % 3 === 0 ? 0x4b5a3f : 0x56603f, tipoT === "lanciatore" ? 13 : 7); if (tipoT === "lanciatore") { const mis = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 11, 10), matStd(0xd9dcd5)); mis.rotation.x = 1.2; mis.position.set(0, 5, -1); c.add(mis); } add(c, (i % 2) * 4 - 2, i * (tipoT === "convoglio" ? 22 : 45) - n * 10); } }
    else if (tipoT === "hangar") { for (let i = 0; i < 4; i++) { const s2 = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 36, 16, 1, false, 0, Math.PI), matStd(0x7c8288)); s2.rotation.z = Math.PI / 2; s2.rotation.y = Math.PI / 2; s2.userData.h = 14; add(s2, i * 50 - 75, 0); } }
    else if (tipoT === "c2") { add(edificio(45, 45, 26, 0xb8bcc2), 0, 0); add(edificio(30, 18, 12, 0xa3a7ad), 60, 30); add(edificio(22, 22, 9, 0xa3a7ad), -55, 35); const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.2, 50, 8), matStd(0xdddddd)); mast.position.y = 25; mast.userData.h = 50; add(mast, 20, -50); }
    else if (tipoT === "helo") { add(edificio(70, 30, 12, 0x8e9aa6), -40, 60); add(edificio(50, 25, 10, 0x8e9aa6), 60, 70); [[-60, -20], [-20, -30], [20, -25], [60, -15], [0, -80]].forEach(([x, z]) => add(elicottero(), x, z, 0.4)); add(serbatoio(), 100, 20); }
    else { add(edificio(80, 35, 14, 0x8e9aa6), -90, 90); add(edificio(80, 35, 14, 0x8e9aa6), 10, 95); add(edificio(40, 40, 30, 0xb8bcc2), 110, 60); add(serbatoio(), 150, 110); add(serbatoio(), 165, 110); [[-120, -20], [-80, -20], [-40, -20], [0, -20], [40, -20], [80, -20]].forEach(([x, z]) => { const j = jetFallback(0x6b7076); j.scale.setScalar(0.9); j.position.y = 1.2; j.userData.h = 3; add(j, x, z, 0.3); }); }
    st.aims = st.objs.map(m => m.position.clone()).concat([new THREE.Vector3(-200, 0, 0), new THREE.Vector3(200, 0, 0), new THREE.Vector3(0, 0, 40), new THREE.Vector3(-100, 0, 20), new THREE.Vector3(100, 0, -40), new THREE.Vector3(0, 0, -60)]);
    // formazione (modelli dalle sagome reali, caricati in modo asincrono)
    const icona = (o.tipo && o.tipo.icona) || "f16"; const cfg = TIPI3D[icona] || TIPI3D.f16; const col = o.lato === "RED" ? 0x7a2b2b : cfg.col;
    const form = new THREE.Group(); st.form = form; scene.add(form);
    const offs = [[0, 0, 0], [45, -5, -40], [-45, -5, -40], [90, -10, -80]].slice(0, Math.max(1, Math.min(4, o.n || 4)));
    offs.forEach(([x, y, z]) => { const holder = new THREE.Group(); holder.position.set(x, y, z); const fb = jetFallback(col); fb.scale.setScalar(1.7); holder.add(fb); form.add(holder); st.jets.push(holder); });
    const tipoId = o.tipo && o.tipo.icona ? (ICONA2TIPO[o.tipo.icona] || "F16") : "F16";
    st.jets.forEach(h => { modelloPromise(icona, o.lato === "RED" ? col : undefined, { tipoId, armi: { AMRAAM: 4, GBU48: 4, ADDER: 6, POD: 4 } }).then(mdl => { if (!st) return; while (h.children.length) h.remove(h.children[0]); mdl.scale.setScalar(1.3); h.add(mdl); h.userData.mdl = mdl; }); });
    st.smoke = particelle(6000, "smoke"); st.fire = particelle(3000, "fire"); st.dust = particelle(2500, "dust"); [st.smoke, st.fire, st.dust].forEach(p => scene.add(p));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    hudSet(o);
  }
  function hudSet(o) { overlay.querySelector("#v3d-cs").textContent = `${o.callsign} · ${o.n}x ${o.tipo ? o.tipo.nome : ""} · IN HOT`; overlay.querySelector("#v3d-tgt").textContent = `TARGET: ${o.target.nome} · ${o.gbu} GBU-48`; msg("Formazione in avvicinamento – FL082 · 430 kt"); const b = overlay.querySelector("#v3d-banner"); b.textContent = ""; b.className = "v3d-banner"; }
  function msg(t) { overlay.querySelector("#v3d-msg").textContent = t; }
  function banner(t, cls) { const b = overlay.querySelector("#v3d-banner"); b.textContent = t; b.className = "v3d-banner show " + (cls || ""); }

  /* ---------- esplosione ---------- */
  function esplosione(p, aim) {
    const d = camera.position.distanceTo(p); suonoEsplosione(d); st.log.push({ x: Math.round(p.x), z: Math.round(p.z), ax: Math.round(aim.x), az: Math.round(aim.z), t: +st.t.toFixed(1) });
    const gy = elev(p.x, p.z); const P = new THREE.Vector3(p.x, gy, p.z);
    // flash + luce
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(true), color: 0xfff0c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); flash.position.set(P.x, gy + 12, P.z); flash.scale.setScalar(10); scene.add(flash);
    const light = new THREE.PointLight(0xffa040, 0, 600, 2); light.position.set(P.x, gy + 25, P.z); scene.add(light);
    // onda d'urto (anello) e cupola di polvere
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); ring.rotation.x = -Math.PI / 2; ring.position.set(P.x, gy + 1.5, P.z); scene.add(ring);
    st.impacts.push({ flash, light, ring, t: 0 });
    // fuoco (core), fumo (colonna), polvere (anello basso)
    emit(st.fire, new THREE.Vector3(P.x, gy + 4, P.z), 160, { x: 0, y: 16, z: 0, w: 14 }, 10, 2.2, 22);
    emit(st.fire, new THREE.Vector3(P.x, gy + 10, P.z), 90, { x: 0, y: 30, z: 0, w: 8 }, 6, 1.6, 16);
    emit(st.smoke, new THREE.Vector3(P.x, gy + 8, P.z), 260, { x: 0, y: 24, z: 0, w: 22 }, 14, 11, 26);
    emit(st.smoke, new THREE.Vector3(P.x, gy + 30, P.z), 120, { x: 0, y: 18, z: 0, w: 10 }, 10, 14, 34);
    emit(st.dust, new THREE.Vector3(P.x, gy + 2, P.z), 260, { x: 0, y: 3, z: 0, w: 55 }, 10, 5, 24);
    // cratere e bruciatura
    const cr = new THREE.Mesh(new THREE.CircleGeometry(13 + Math.random() * 6, 24), new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 1 })); cr.rotation.x = -Math.PI / 2; cr.position.set(P.x, gy + 0.8, P.z); scene.add(cr);
    const sc2 = new THREE.Mesh(new THREE.CircleGeometry(42, 24), new THREE.MeshBasicMaterial({ color: 0x241f18, transparent: true, opacity: 0.5, depthWrite: false })); sc2.rotation.x = -Math.PI / 2; sc2.position.set(P.x, gy + 0.7, P.z); scene.add(sc2);
    for (let i = 0; i < 22; i++) { const db = new THREE.Mesh(new THREE.BoxGeometry(0.8 + Math.random() * 2.2, 0.5 + Math.random(), 0.8 + Math.random() * 1.5), matStd(0x2e2a26, { roughness: 1 })); db.position.set(P.x, gy + 3, P.z); db.userData.v = new THREE.Vector3((Math.random() - 0.5) * 75, 30 + Math.random() * 55, (Math.random() - 0.5) * 75); db.userData.spin = new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6); db.castShadow = true; scene.add(db); st.debris.push(db); }
    st.objs.forEach(m => { if (m.userData.dead) return; const dd = m.position.distanceTo(new THREE.Vector3(P.x, m.position.y, P.z)); if (dd < 55) { m.userData.dead = true; m.scale.y = 0.22; m.position.y *= 0.22; m.rotation.z = (Math.random() - 0.5) * 0.5; m.rotation.x = (Math.random() - 0.5) * 0.3; m.traverse(x => { if (x.isMesh && x.material && x.material.color) { x.material = x.material.clone(); x.material.color.multiplyScalar(0.3); x.material.roughness = 1; } }); st.fires.push({ x: m.position.x, z: m.position.z, r: 12 }); } });
    st.shake = 1.0; st.impactsDone = (st.impactsDone || 0) + 1;
  }

  /* ---------- animazione ---------- */
  function animate() {
    if (!st) return;   // cinematica chiusa: un fotogramma rimasto in coda non deve fare nulla
    // in registrazione: passo fisso 1/30 s e loop a timer (indipendente dal frame rate e dalla visibilità del pannello)
    if (st.fixedDt) raf = setTimeout(animate, 1000 / 30); else raf = requestAnimationFrame(animate);
    const dtReal = st.fixedDt || Math.min(0.1, clock.getDelta()); const dt = dtReal * TS; st.t += dtReal; const s = st; s.k = 1 - Math.exp(-5 * dtReal); s.frames = (s.frames || 0) + 1;
    if (s.nubi) { const d = Math.abs(camera.position.y - s.nubi.mesh.position.y); s.nubi.mesh.material.opacity = 0.85 * Math.min(1, Math.max(0.15, (d - 20) / 120)); }
    [s.smoke, s.fire, s.dust].forEach(p => { p.material.uniforms.uTime.value = s.t; p.material.uniforms.uWind.value.copy(s.vento || new THREE.Vector3()); p.material.uniforms.uScale.value = window.innerHeight * 0.9; });
    if (s.nubi) s.nubi.tex.offset.x += dtReal * 0.0006;
    // formazione
    const pastTarget = s.pos.x > 900;
    if (pastTarget) { s.form.rotation.y += 0.35 * dtReal; s.form.rotation.z = Math.max(-0.9, s.form.rotation.z - 0.6 * dtReal); } else s.form.rotation.y = Math.PI / 2;   // egress: virata a sinistra (rotation.y cresce) → bank sinistro (rotation.z negativa)
    const dir = new THREE.Vector3(Math.sin(s.form.rotation.y), 0, Math.cos(s.form.rotation.y));
    s.pos.addScaledVector(dir, s.speed * dt); s.pos.y = s.alt; s.form.position.copy(s.pos); s.heading = (90 + (s.form.rotation.y - Math.PI / 2) * -180 / Math.PI + 360) % 360;
    if (audio) audio.jetGain.gain.value = Math.min(0.5, 180 / Math.max(60, camera.position.distanceTo(s.pos)));
    // assetto e superfici dei modelli (fiamma durante l'avvicinamento, timone nella virata di egress)
    s.jets.forEach(j => { if (j.userData.mdl && j.userData.mdl.userData.anim) j.userData.mdl.userData.anim({ rollRate: pastTarget ? -35 : 0, pitchRate: 0, yawRate: pastTarget ? -20 : 0, afterburner: s.released ? 0.3 : 0.9, t: s.t }); });
    // scie di scarico
    if (Math.random() < 0.7) s.jets.forEach(j => { const wp = new THREE.Vector3(); j.getWorldPosition(wp); wp.addScaledVector(dir, -10); emit(s.dust, wp, 1, { x: 0, y: 0, z: 0, w: 1 }, 1, 1.2, 4); });
    if (!s.released && s.pos.x > -4300) { s.released = true; s.nextRelease = 0; s.tRelease = s.t; banner("PICKLE", "pickle"); suonoFischio(8); if (typeof AUDIO !== "undefined" && !s.fixedDt) AUDIO.radio(s.o.callsign, "pickle", s.o.callsign + ", pickle.", "BLUE"); setTimeout(() => { const b = overlay.querySelector("#v3d-banner"); if (b && b.classList.contains("pickle")) b.className = "v3d-banner"; }, 1500); }
    if (s.released && !s.resultShown) { const fb0 = s.bombs.find(b => !b.userData.hit); if (fb0) { const vyd = -fb0.userData.v.y, h = Math.max(1, fb0.position.y - elev(fb0.position.x, fb0.position.z)); s.tti = (-vyd + Math.sqrt(vyd * vyd + 2 * G * h)) / G / TS; msg(`PICKLE – ${s.o.gbu} GBU-48 in caduta guidata · impatto tra ${Math.max(0, Math.ceil(s.tti))} s`); } }
    if (s.released && s.bombsLeft > 0) { s.nextRelease -= dtReal; if (s.nextRelease <= 0) { s.nextRelease = 0.28; const jet = s.jets[s.bombs.length % s.jets.length]; const wp = new THREE.Vector3(); jet.getWorldPosition(wp); const b = bomba(); b.position.copy(wp); b.position.y -= 2.5; b.userData = { v: dir.clone().multiplyScalar(s.speed), aim: s.aims[s.aimIdx++ % s.aims.length] }; scene.add(b); s.bombs.push(b); s.bombsLeft--; } }
    s.bombs.forEach(b => { if (b.userData.hit) return; const u = b.userData; u.v.y -= G * dt; u.v.multiplyScalar(1 - 0.012 * dt);
      const toAim = new THREE.Vector3(u.aim.x - b.position.x, 0, u.aim.z - b.position.z); const vyd = -u.v.y; const h = Math.max(1, b.position.y - elev(b.position.x, b.position.z));
      const tfall = Math.max(0.4, (-vyd + Math.sqrt(vyd * vyd + 2 * G * h)) / G); const want = toAim.multiplyScalar(1 / tfall); if (want.length() > 420) want.setLength(420);
      u.v.x += (want.x - u.v.x) * Math.min(1, 1.6 * dt); u.v.z += (want.z - u.v.z) * Math.min(1, 1.6 * dt);
      b.position.addScaledVector(u.v, dt); b.lookAt(b.position.clone().add(u.v));
      if (b.position.y <= elev(b.position.x, b.position.z) + 1) { u.hit = true; b.visible = false; esplosione(new THREE.Vector3(b.position.x, 0, b.position.z), u.aim); } });
    s.impacts.forEach(im => { im.t += dtReal; const k = im.t; im.flash.scale.setScalar(10 + 140 * Math.min(1, k / 0.25)); im.flash.material.opacity = Math.max(0, 1 - k / 0.5); im.light.intensity = Math.max(0, 3 - k * 2.5); const rk = Math.min(1, k / 1.1); im.ring.scale.setScalar(1 + 420 * rk); im.ring.material.opacity = 0.55 * (1 - rk); if (k > 1.2) { scene.remove(im.flash); scene.remove(im.light); scene.remove(im.ring); } });
    s.impacts = s.impacts.filter(im => im.t <= 1.2);
    s.debris.forEach(db => { if (db.userData.fermo) return; db.userData.v.y -= G * dt; db.position.addScaledVector(db.userData.v, dt); db.rotation.x += db.userData.spin.x * dt; db.rotation.y += db.userData.spin.y * dt; const gy = elev(db.position.x, db.position.z) + 0.4; if (db.position.y < gy) { db.position.y = gy; db.userData.fermo = true; } else if (Math.random() < 0.2) emit(s.smoke, db.position, 1, { x: 0, y: 0.5, z: 0, w: 0.5 }, 0.5, 1.6, 2.5); });
    s.fires.forEach(f => { const gy = elev(f.x, f.z); if (Math.random() < 0.8) emit(s.fire, new THREE.Vector3(f.x + (Math.random() - 0.5) * f.r, gy + 2, f.z + (Math.random() - 0.5) * f.r), 3, { x: 0, y: 7, z: 0, w: 3 }, 4, 1.4, 9); if (Math.random() < 0.5) emit(s.smoke, new THREE.Vector3(f.x, gy + 8, f.z), 2, { x: 0, y: 10, z: 0, w: 5 }, 6, 9, 16); });
    const allHit = s.released && s.bombsLeft === 0 && s.bombs.every(b => b.userData.hit);
    if (allHit && !s.resultShown) { s.resultShown = true; s.tResult = s.t; const r = s.o.esito; msg(`${s.o.gbu} GBU-48 a segno · danno ${Math.min(100, Math.round(r.danni / r.richieste * 100))}% (${r.danni}/${r.richieste})`); banner(r.distrutto ? "SHACK – TARGET DISTRUTTO" : `DANNO ${Math.min(100, Math.round(r.danni / r.richieste * 100))}%`, r.distrutto ? "shack" : "partial"); if (typeof AUDIO !== "undefined" && !s.fixedDt) { if (r.distrutto) { AUDIO.suono("boom"); AUDIO.radio(s.o.callsign, "shack", s.o.callsign + ", shack! Target destroyed.", "BLUE"); } } }
    if (s.resultShown && s.t - s.tResult > 4.5 && !s.egress) { s.egress = true; msg("OFF TARGET – EGRESS"); if (typeof AUDIO !== "undefined" && !s.fixedDt) AUDIO.radio(s.o.callsign, "off", s.o.callsign + ", off target, egress.", "BLUE"); }
    if (s.resultShown && s.t - s.tResult > 9 && !s.done) { s.done = true; chiudi(); return; }
    cameraUpdate(dtReal); renderer.render(scene, camera); hud();
    if (s.comp) { s.comp.g.drawImage(canvas, 0, 0, s.comp.c.width, s.comp.c.height); s.comp.g.drawImage(hudCanvas, 0, 0, s.comp.c.width, s.comp.c.height); }
  }
  function cameraUpdate(dtReal) {
    const s = st, t = s.t, k = s.k; const lp = new THREE.Vector3(); s.jets[0].getWorldPosition(lp); let target = new THREE.Vector3(); const firstBomb = s.bombs.find(b => !b.userData.hit);
    s.camMode = "altro";
    if (!s.released) { s.camMode = "chase"; if (!s.camInit) { s.camInit = true; camera.position.copy(lp).add(new THREE.Vector3(-150, 40, 90)); } camera.position.lerp(lp.clone().add(new THREE.Vector3(-130, 32, 80)), k); target.copy(lp).add(new THREE.Vector3(500, -80, 0)); }
    else if (firstBomb && s.bombs.length && !s.impactsDone) {
      if (t - s.tRelease < 2.5) { s.camMode = "chase"; camera.position.lerp(lp.clone().add(new THREE.Vector3(-40, -55, 60)), k * 1.5); target.copy(firstBomb.position); }
      else { s.camMode = "bomb"; const v = firstBomb.userData.v.clone().normalize(); camera.position.copy(firstBomb.position).addScaledVector(v, -22).add(new THREE.Vector3(0, 8, 0)); target.copy(firstBomb.position).addScaledVector(v, 60); }
    } else if (!s.resultShown) { const gp = new THREE.Vector3(-420, elev(-420, 300) + 22, 300); camera.position.lerp(gp, k * 0.8); target.set(0, 25, 0); }
    else { const kk = (t - s.tResult) * 0.18; const px = Math.cos(kk) * 560, pz = Math.sin(kk) * 560; camera.position.lerp(new THREE.Vector3(px, elev(px, pz) + 230 + 40 * Math.sin(kk), pz), k * 0.5); target.set(0, 10, 0); }
    if (s.shake > 0) { s.shake -= dtReal * 1.6; camera.position.add(new THREE.Vector3((Math.random() - 0.5) * 6 * s.shake, (Math.random() - 0.5) * 6 * s.shake, 0)); }
    camera.lookAt(target);
  }

  /* ---------- HUD stile caccia (canvas 2D) ---------- */
  function hud() {
    const c = hudCtx, W = hudCanvas.width, H = hudCanvas.height; c.clearRect(0, 0, W, H); const s = st; if (!s || (s.camMode !== "chase" && s.camMode !== "bomb")) return;
    c.save(); c.strokeStyle = "rgba(120,255,140,0.95)"; c.fillStyle = "rgba(120,255,140,0.95)"; c.lineWidth = 2; c.font = "bold 18px Consolas, monospace"; c.textAlign = "center";
    const cx = W / 2, cy = H / 2; const spdKt = Math.round(s.speed * 1.944), altFt = Math.round((s.camMode === "bomb" ? (s.bombs.find(b => !b.userData.hit) || { position: { y: s.alt } }).position.y : s.alt) * 3.281);
    // nastro di prua
    const hdg = s.heading; c.beginPath(); c.moveTo(cx - 260, 60); c.lineTo(cx + 260, 60); c.stroke();
    for (let d = -40; d <= 40; d += 5) { const h = ((Math.round(hdg / 5) * 5 + d) + 360) % 360; const x = cx + (h - hdg + 540) % 360 * 0 + ((Math.round(hdg / 5) * 5 + d) - hdg) * 6.5; if (Math.abs(x - cx) > 260) continue; c.beginPath(); c.moveTo(x, 60); c.lineTo(x, h % 10 === 0 ? 48 : 54); c.stroke(); if (h % 10 === 0) c.fillText(String(h / 10).padStart(2, "0"), x, 44); }
    c.beginPath(); c.moveTo(cx, 62); c.lineTo(cx - 7, 74); c.lineTo(cx + 7, 74); c.closePath(); c.fill(); c.fillText(String(Math.round(hdg)).padStart(3, "0"), cx, 94);
    // velocità e quota
    c.textAlign = "right"; c.strokeRect(cx - 330, cy - 22, 110, 44); c.fillText(spdKt + " KT", cx - 230, cy + 7); c.font = "14px Consolas, monospace"; c.fillText("M " + (s.speed / 300).toFixed(2), cx - 230, cy + 40); c.fillText("G 1.0", cx - 230, cy - 32);
    c.font = "bold 18px Consolas, monospace"; c.textAlign = "left"; c.strokeRect(cx + 220, cy - 22, 130, 44); c.fillText(altFt.toLocaleString("it-IT") + " FT", cx + 230, cy + 7); c.font = "14px Consolas, monospace"; c.fillText("RALT " + Math.round(altFt - elev(s.pos.x, s.pos.z) * 3.281).toLocaleString("it-IT"), cx + 230, cy + 40);
    // scala di beccheggio e flight path marker
    c.textAlign = "center"; for (let p = -10; p <= 10; p += 5) { if (p === 0) continue; const y = cy - p * 9; c.setLineDash(p < 0 ? [8, 6] : []); c.beginPath(); c.moveTo(cx - 120, y); c.lineTo(cx - 40, y); c.moveTo(cx + 40, y); c.lineTo(cx + 120, y); c.stroke(); c.fillText(String(Math.abs(p)), cx - 135, y + 5); c.fillText(String(Math.abs(p)), cx + 135, y + 5); }
    c.setLineDash([]); c.beginPath(); c.arc(cx, cy, 9, 0, Math.PI * 2); c.moveTo(cx - 9, cy); c.lineTo(cx - 22, cy); c.moveTo(cx + 9, cy); c.lineTo(cx + 22, cy); c.moveTo(cx, cy - 9); c.lineTo(cx, cy - 18); c.stroke();
    // CCRP: linea di caduta e tempo all'impatto
    if (!s.released || s.camMode === "bomb") { c.beginPath(); c.moveTo(cx, cy + 20); c.lineTo(cx, H - 140); c.stroke(); }
    c.font = "bold 20px Consolas, monospace"; c.fillText(s.released ? (s.tti != null ? `TTI ${String(Math.max(0, Math.ceil(s.tti))).padStart(2, "0")}` : "REL") : "A/G  CCRP", cx, H - 110);
    c.font = "16px Consolas, monospace"; c.textAlign = "left"; c.fillText(`GBU-48  ${s.bombsLeft}`, cx - 330, H - 110); c.fillText(`TGT ${Math.round(Math.hypot(s.pos.x, s.pos.z) / 1852 * 10) / 10} NM`, cx - 330, H - 86);
    if (s.released && s.t - s.tRelease < 1.5 && Math.floor(s.t * 6) % 2 === 0) { c.font = "bold 26px Consolas, monospace"; c.textAlign = "center"; c.fillText("RELEASE", cx, cy + 70); }
    c.restore();
  }

  /* ---------- API ---------- */
  function apri(o) {
    dom(); if (typeof THREE === "undefined") { alert("Three.js non caricato (vendor/three.min.js)"); return; }
    cancelAnimationFrame(raf); clearTimeout(raf);   // una cinematica già aperta: si ferma il suo ciclo, altrimenti ne girerebbero due
    if (renderer) { try { renderer.dispose(); } catch (e) {} }
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!o.record, powerPreference: "high-performance" }); renderer.setPixelRatio(o.record ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setSize(window.innerWidth, window.innerHeight);
    if (THREE.sRGBEncoding !== undefined && renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding; else if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    hudCanvas.width = window.innerWidth; hudCanvas.height = window.innerHeight;
    overlay.classList.remove("hidden"); audio = audioInit(); if (audio && audio.ctx.state === "suspended") audio.ctx.resume();
    costruisci(o); clock = new THREE.Clock(); st.onFine = o.onFine; if (o.record) st.fixedDt = 1 / 30;
    if (o.record && window.MediaRecorder) { try { // canvas di composizione (scena + HUD) per la registrazione
      const comp = document.createElement("canvas"); comp.width = canvas.width; comp.height = canvas.height; const cg = comp.getContext("2d"); st.comp = { c: comp, g: cg };
      const stream = comp.captureStream(30); if (audio) audio.dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr)); recChunks = []; recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm", videoBitsPerSecond: 8000000 }); recorder.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); }; recorder.onstop = () => { const blob = new Blob(recChunks, { type: "video/webm" }); if (o.onRecord) o.onRecord(blob); }; recorder.start(500); } catch (e) { console.warn("registrazione non disponibile", e); } }
    animate();
  }
  function chiudi() {
    if (!overlay || overlay.classList.contains("hidden")) return; cancelAnimationFrame(raf); clearTimeout(raf); overlay.classList.add("hidden");
    if (recorder && recorder.state !== "inactive") recorder.stop(); recorder = null;
    if (audio) { try { audio.ctx.close(); } catch (e) {} audio = null; }
    if (scene) { scene.traverse(x => { if (x.geometry) x.geometry.dispose(); }); scene = null; }
    hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
    const fn = st && st.onFine; st = null; if (fn) fn();
  }
  function daEvento(sc, eng, v) {
    const f = eng.flights.find(x => x.id === v.flight); const t = eng.target.find(x => x.id === v.target); if (!f || !t) return null;
    return { callsign: f.callsign, n: Math.max(1, f.n || v.n || 4), tipo: sc.tipi[f.tipo], lato: f.lato, target: t, gbu: v.gbu, esito: { danni: v.danni, richieste: v.richieste, distrutto: v.distrutto }, meteo: sc.meteo, ora: eng.t / 3600 };
  }
  /* modelli condivisi con la vista 3D della missione */
  const ICONA2TIPO = { f22: "F22", f15: "F15", f16: "F16", f16b: "F16", typhoon: "F2000", su35: "SU35", su57: "SU57", kc30: "F15" };
  /* ---------- modelli glTF reali (app/modelli/manifest.json → {TIPO: {file, rot, lunghezza_m, offset, scala}}) ---------- */
  const GLTF = { man: null, cache: {}, loader: null };
  function gltfManifest() {
    if (GLTF.man) return GLTF.man;
    GLTF.man = fetch("modelli/manifest.json", { cache: "no-store" }).then(r => r.ok ? r.json() : {}).catch(() => ({})).then(man => {
      const usa = Object.keys(man).some(k => man[k] && man[k].file);
      if (!usa || typeof THREE.GLTFLoader !== "undefined") return man;
      return new Promise(res => { const s = document.createElement("script"); s.src = "vendor/GLTFLoader.js"; s.onload = () => res(man); s.onerror = () => { console.warn("vendor/GLTFLoader.js mancante: modelli glTF non caricati"); res({}); }; document.head.appendChild(s); });
    });
    return GLTF.man;
  }
  function gltfModello(tipo, col, opt) {
    return gltfManifest().then(man => {
      const m = man && man[tipo]; if (!m || !m.file || typeof THREE.GLTFLoader === "undefined") return null;
      if (!GLTF.cache[m.file]) { GLTF.loader = GLTF.loader || new THREE.GLTFLoader(); GLTF.cache[m.file] = new Promise((res, rej) => GLTF.loader.load("modelli/" + m.file, g => res(g.scene), undefined, rej)).catch(e => { console.warn("glTF non caricabile", m.file, e); return null; }); }
      return GLTF.cache[m.file].then(scene => {
        if (!scene) return null; const g = scene.clone(true); const rot = m.rot || [0, 0, 0]; g.rotation.set(rot[0] * Math.PI / 180, rot[1] * Math.PI / 180, rot[2] * Math.PI / 180); g.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(g); const size = new THREE.Vector3(); box.getSize(size);
        const len = m.lunghezza_m || (typeof MODELLI !== "undefined" && MODELLI.TIPI[tipo] && MODELLI.TIPI[tipo].len) || 15; const s = m.scala || len / Math.max(size.z, 1e-3);
        const wrap = new THREE.Group(); wrap.add(g); g.scale.setScalar(s); g.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(g); const c = new THREE.Vector3(); b2.getCenter(c); g.position.sub(c); if (m.offset) g.position.add(new THREE.Vector3(m.offset[0] || 0, m.offset[1] || 0, m.offset[2] || 0));
        wrap.traverse(o => { if (o.isMesh) { o.castShadow = true; if (col != null && o.material) { o.material = Array.isArray(o.material) ? o.material.map(mm => mm.clone()) : o.material.clone(); [].concat(o.material).forEach(mm => { if (mm.color) mm.color.lerp(new THREE.Color(col), 0.45); }); } } });
        // postbruciatore: fiamme procedurali sugli ugelli dichiarati nel manifest ([x,y,z] in metri, modello orientato con il muso a +Z)
        const fiamme = (m.ugelli || []).map(u => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.45, 5, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); f.rotation.x = Math.PI / 2; f.position.set(u[0], u[1], u[2] - 2.6); f.visible = false; wrap.add(f); return f; });
        wrap.name = "gltf_" + tipo; wrap.userData.parti = { fiamme }; wrap.userData.anim = st => { const ab = st.afterburner || 0; fiamme.forEach(f => { f.visible = ab > 0.05; f.scale.set(1, 1, 0.4 + ab * (0.8 + 0.3 * Math.sin((st.t || 0) * 40))); f.material.opacity = 0.5 + 0.4 * ab; }); };
        return wrap;
      });
    });
  }
  function modelloProcedurale(icona, col, opt) {
    // modelli dettagliati parametrici (modelli3d.js); fallback alla sagoma estrusa
    if (typeof MODELLI !== "undefined") { try { const tipo = (opt && opt.tipoId) || ICONA2TIPO[icona] || "F16"; const m = MODELLI.costruisci(tipo, { colore: col, armi: opt && opt.armi, numero: opt && opt.numero, callsign: opt && opt.callsign });
      // I modelli procedurali hanno muso +Z e ala destra +X: in un sistema destrorso con muso +Z l'ala destra sta a −X, quindi vanno specchiati
      // (così luci di navigazione, alettoni, timone e dettagli asimmetrici finiscono dal lato fisicamente giusto). Lo specchio sta in un gruppo interno: chi riceve il modello può scalarlo liberamente.
      const mir = new THREE.Group(); mir.scale.x = -1; mir.add(m); const W = new THREE.Group(); W.add(mir); W.name = m.name; W.userData.anim = m.userData.anim; W.userData.parti = m.userData.parti; return Promise.resolve(W); } catch (e) { console.warn("modello dettagliato non disponibile", e); } }
    const cfg = TIPI3D[icona] || TIPI3D.f16; return caricaSagoma(TIPI3D[icona] ? icona : "f16").then(sg => sg ? modelloDaSagoma(sg, Object.assign({}, cfg, { col: col != null ? col : cfg.col })) : jetFallback(col != null ? col : cfg.col));
  }
  function modelloPromise(icona, col, opt) {
    // 1) modello glTF reale se presente in app/modelli; 2) altrimenti modello procedurale
    const tipo = (opt && opt.tipoId) || ICONA2TIPO[icona] || "F16";
    return gltfModello(tipo, col, opt).catch(() => null).then(m => m || modelloProcedurale(icona, col, opt));
  }
  return { apri, chiudi, daEvento, modelloPromise, jetFallback, puffTexture, TIPI3D, tileUrl, caricaTex, caricaDem, demGrid, lonLatToTile, setProxyTile: v => { TILE.proxy = !!v; }, get attiva() { return !!(overlay && !overlay.classList.contains("hidden")); }, get debug() { return st && { t: st.t, fps: st.frames && st.t ? +(st.frames / st.t).toFixed(1) : 0, released: st.released, terreno: TERRA.ready, base: TERRA.base, log: st.log, bombs: st.bombs.length, draw: renderer && renderer.info.render }; } };
})();
/* ============================================================
   CENTURION – FREE FLIGHT
   Volo libero in stile videogioco sulla stessa carta 3D della missione (quote e imagery reali):
   - fisica a 6 gradi di libertà semplificata: portanza/resistenza da coefficienti reali (CLα, CD0, polare indotta, resistenza d'onda),
     atmosfera ISA, spinta con perdita in quota e postbruciatore, massa che cala col carburante, controlli fly-by-wire
     (barra = fattore di carico con limite di incidenza, rateo di rollio limitato dalla pressione dinamica, smorzatore d'imbardata)
   - armi: AIM-120 (radar), AIM-9X (infrarosso), AGM-65 (aria-suolo), cannone con mirino a calcolo d'anticipo;
     missili a navigazione proporzionale con motore, resistenza, limite di G, spoletta di prossimità, flare/chaff e notch
   - avversari Su-35/Su-57 con intercettazione, attacco e manovre difensive; SA-10 opzionali
   - comandi: touch (cloche virtuale, manetta, tasti di tiro) con schermo orizzontale, inclinazione del telefono, tastiera, gamepad
   Convenzioni: x = est, z = sud, y = su (metri). Velivolo: muso +Z locale, su +Y, ala destra −X.
   ============================================================ */
const VOLO = (() => {
  const G = 9.81, D2R = Math.PI / 180, R2D = 180 / Math.PI, M_LAT = 111320, KT = 1.94384, FT = 3.28084, NM = 1852;
  let ov, canvas, hudC, hud, renderer, scene, camera, raf = 0, S = null, clock, AU = null;
  const TERRA = { grids: {}, ready: false, t: null, tileM: 0, lat0: 41.0, lon0: -122.8, byKey: {}, caricate: 0, totale: 0 };
  const PREF_KEY = "centurion_volo_pref";

  /* ---------- velivoli (valori indicativi da fonti aperte) ---------- */
  const AEREI = {
    F16:   { nome: "F-16C Fighting Falcon", icona: "f16",     m: 12000, S: 27.87, Tmil: 76300,  Tab: 127000, cd0: 0.0175, k: 0.125, cla: 3.6, amax: 25, astall: 28, pmax: 240, gmax: 9, gneg: 3, fuel: 3200, colpi: 511, cannone: "M61A1 20 mm", carico: { AIM120: 2, AIM9X: 2, AGM65: 2 } },
    F15:   { nome: "F-15E Strike Eagle",    icona: "f15",     m: 24000, S: 56.5,  Tmil: 129600, Tab: 258000, cd0: 0.022,  k: 0.135, cla: 3.4, amax: 26, astall: 30, pmax: 180, gmax: 9, gneg: 3, fuel: 6100, colpi: 512, cannone: "M61A1 20 mm", carico: { AIM120: 4, AIM9X: 2, AGM65: 4 } },
    F2000: { nome: "Eurofighter Typhoon",   icona: "typhoon", m: 15500, S: 51.2,  Tmil: 120000, Tab: 180000, cd0: 0.0175, k: 0.18,  cla: 3.0, amax: 28, astall: 32, pmax: 250, gmax: 9, gneg: 3, fuel: 4500, colpi: 150, cannone: "Mauser BK-27 27 mm", carico: { AIM120: 4, AIM9X: 2, AGM65: 2 } },
    F22:   { nome: "F-22A Raptor",          icona: "f22",     m: 29000, S: 78.0,  Tmil: 232000, Tab: 312000, cd0: 0.018,  k: 0.17,  cla: 3.2, amax: 40, astall: 45, pmax: 200, gmax: 9, gneg: 3, fuel: 8200, colpi: 480, cannone: "M61A2 20 mm", carico: { AIM120: 6, AIM9X: 2, AGM65: 0 } }
  };
  /* ---------- armi ---------- */
  const ARMI = {
    AIM120: { nome: "AIM-120C AMRAAM", sigla: "AIM-120", bersaglio: "aria", guida: "radar", cono: 60, rmin: 1500, burn: 6, acc: 180, maxG: 40, N: 4.5, fuse: 20, vita: 75, pk: 0.85, esca: 0.1, cd: 4.1e-5, lock: 1.2, call: "FOX THREE" },
    AIM9X:  { nome: "AIM-9X Sidewinder",  sigla: "AIM-9X",  bersaglio: "aria", guida: "ir",    cono: 60, rmin: 400,  burn: 5, acc: 200, maxG: 50, N: 4.5, fuse: 11, vita: 25, pk: 0.9, esca: 0.08, cd: 6.5e-5, lock: 0.7, call: "FOX TWO" },
    AGM65:  { nome: "AGM-65 Maverick",    sigla: "AGM-65",  bersaglio: "terra", guida: "tv",   cono: 30, rmin: 900,  burn: 3, acc: 90,  maxG: 20, N: 3, fuse: 10, vita: 60, pk: 0.95, cd: 3.5e-5, lock: 1.5, call: "RIFLE" },
    GUN:    { nome: "Cannone",            sigla: "GUN",     bersaglio: "aria", guida: "gun",   cono: 30, rmin: 0, call: "GUNS" },
    R77:    { nome: "R-77", guida: "radar", burn: 6, acc: 170, maxG: 35, N: 4, fuse: 18, vita: 70, pk: 0.65, esca: 0.18, cd: 4.5e-5 },
    R73:    { nome: "R-73", guida: "ir",    burn: 4, acc: 190, maxG: 45, N: 4, fuse: 10, vita: 22, pk: 0.7, esca: 0.3, cd: 6.5e-5 },
    SA10:   { nome: "48N6 (SA-10)", guida: "radar", burn: 10, acc: 160, maxG: 25, N: 3.5, fuse: 30, vita: 60, pk: 0.7, esca: 0.15, cd: 2.5e-5 }
  };
  const DIFF = { recluta: { nome: "Recluta", cm: 0.5, pkNem: 0.45, cad: 1.6, gNem: 5.5, vNem: 240 }, veterano: { nome: "Veterano", cm: 0.85, pkNem: 0.65, cad: 1.0, gNem: 7, vNem: 270 }, asso: { nome: "Asso", cm: 1.1, pkNem: 0.8, cad: 0.7, gNem: 8.5, vNem: 300 } };

  /* ---------- utilità ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const V3 = (x, y, z) => new THREE.Vector3(x || 0, y || 0, z || 0);
  function isa(h) { h = Math.max(0, h); if (h < 11000) { const T = 288.15 - 0.0065 * h; return { rho: 1.225 * Math.pow(T / 288.15, 4.2559), a: Math.sqrt(1.4 * 287.05 * T) }; } return { rho: 0.3639 * Math.exp(-(h - 11000) / 6341.6), a: 295.07 }; }
  const mLon = () => M_LAT * Math.cos(TERRA.lat0 * D2R);
  const toXZ = (lat, lon) => ({ x: (lon - TERRA.lon0) * mLon(), z: -(lat - TERRA.lat0) * M_LAT });
  function elev(x, z) {
    if (!TERRA.ready) return 0; const fx = TERRA.t.x + x / TERRA.tileM, fy = TERRA.t.y + z / TERRA.tileM; const tx = Math.floor(fx), ty = Math.floor(fy); const g = TERRA.grids[tx + "_" + ty]; if (!g) return 0;
    const px = (fx - tx) * 255, py = (fy - ty) * 255; const x0 = Math.floor(px), y0 = Math.floor(py), x1 = Math.min(255, x0 + 1), y1 = Math.min(255, y0 + 1); const ax = px - x0, ay = py - y0;
    return Math.max(0, g[y0 * 256 + x0] * (1 - ax) * (1 - ay) + g[y0 * 256 + x1] * ax * (1 - ay) + g[y1 * 256 + x0] * (1 - ax) * ay + g[y1 * 256 + x1] * ax * ay);
  }
  function quotaSuolo(x, z) { const p = S && S.pista; if (p) { const dx = x - p.x, dz = z - p.z; const u = dx * p.ux + dz * p.uz, w = -dx * p.uz + dz * p.ux; if (Math.abs(u) < p.L / 2 + 150 && Math.abs(w) < 60) return p.y; } return elev(x, z); }
  function matStd(c, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, metalness: 0.15 }, extra || {})); }
  function srgb(tex) { if (THREE.sRGBEncoding !== undefined && tex.encoding !== undefined) tex.encoding = THREE.sRGBEncoding; else if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace; return tex; }
  const mobile = () => matchMedia("(pointer: coarse)").matches || window.innerWidth < 900;
  function pref() { try { return Object.assign({ aereo: "F16", partenza: "volo", ora: "giorno", nemici: 3, diff: "veterano", sam: true, comandi: "touch", inverti: false, audio: true }, JSON.parse(localStorage.getItem(PREF_KEY) || "{}")); } catch (e) { return { aereo: "F16", partenza: "volo", nemici: 3, diff: "veterano", sam: true, comandi: "touch", inverti: false, audio: true }; } }
  function salvaPref(p) { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) {} }

  /* ---------- DOM ---------- */
  function dom() {
    if (ov) return;
    ov = document.createElement("div"); ov.id = "volo"; ov.className = "hidden";
    ov.innerHTML = `<canvas id="vl-canvas"></canvas><div id="vl-nvg"><canvas id="vl-nvg-rumore" width="192" height="108"></canvas></div><canvas id="vl-hud"></canvas>
      <div id="vl-ruota"><div>⟲</div><b>Ruota il telefono in orizzontale</b><small>Il Free Flight si gioca con lo schermo orizzontale</small></div>
      <div id="vl-comandi">
        <div id="vl-stickzona"><div id="vl-stickbase"><div id="vl-stickpomo"></div></div><span class="vl-hint">CLOCHE</span></div>
        <div id="vl-manetta"><div id="vl-manetta-liv"></div><div id="vl-manetta-ab">AB</div><span>MANETTA</span></div>
        <button id="vl-fuoco" class="vl-b big">FUOCO</button>
        <button id="vl-lock" class="vl-b">LOCK</button>
        <button id="vl-arma" class="vl-b">ARMA</button>
        <button id="vl-flare" class="vl-b">FLARE</button>
        <div id="vl-pedali"><button id="vl-pedsx" class="vl-b sm">◀ PED</button><button id="vl-freno" class="vl-b sm">FRENO</button><button id="vl-peddx" class="vl-b sm">PED ▶</button></div>
      </div>
      <div id="vl-top"><button id="vl-pausa" class="vl-b sm" title="Pausa">⏸</button><button id="vl-cam" class="vl-b sm" title="Telecamera">🎥</button><button id="vl-carrello" class="vl-b sm" title="Carrello">GEAR</button><button id="vl-nvgb" class="vl-b sm" title="Visore notturno (tasto N)">NVG</button><button id="vl-aiuto" class="vl-b sm" title="Istruzioni">?</button><button id="vl-esci" class="vl-b sm" title="Esci">✕</button></div>
      <div id="vl-menu" class="vl-schermo"></div>`;
    document.body.appendChild(ov);
    canvas = ov.querySelector("#vl-canvas"); hudC = ov.querySelector("#vl-hud"); hud = hudC.getContext("2d");
    window.addEventListener("resize", ridimensiona); window.addEventListener("orientationchange", () => setTimeout(ridimensiona, 300));
    window.addEventListener("keydown", e => { if (!attivo()) return; if (S && S.menu && e.key !== "Escape") return; const k = e.key.toLowerCase(); KEYS[k] = true; tastoPremuto(k, e); if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault(); });
    window.addEventListener("keyup", e => { KEYS[e.key.toLowerCase()] = false; });
    comandiTouch();
    ov.querySelector("#vl-pausa").onclick = () => pausa(true);
    ov.querySelector("#vl-cam").onclick = () => cambiaCam();
    ov.querySelector("#vl-carrello").onclick = () => carrello();
    ov.querySelector("#vl-nvgb").onclick = () => nvg();
    ov.querySelector("#vl-aiuto").onclick = () => { pausa(true, true); };
    ov.querySelector("#vl-esci").onclick = () => chiudi();
  }
  function attivo() { return !!(ov && !ov.classList.contains("hidden")); }
  function ridimensiona() {
    if (!ov) return; const w = window.innerWidth, h = window.innerHeight;
    hudC.width = w; hudC.height = h; ov.classList.toggle("verticale", h > w * 1.05 && mobile());
    if (renderer) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  }

  /* ---------- comandi ---------- */
  const KEYS = {};
  const TOUCH = { sx: 0, sy: 0, id: null, ox: 0, oy: 0, fuoco: false, rud: 0, freno: false, thrId: null };
  const TILT = { on: false, b0: null, g0: null, sx: 0, sy: 0 };
  function comandiTouch() {
    const zona = ov.querySelector("#vl-stickzona"), base = ov.querySelector("#vl-stickbase"), pomo = ov.querySelector("#vl-stickpomo"); const R = () => Math.min(70, window.innerHeight * 0.16);
    zona.addEventListener("pointerdown", e => { if (TOUCH.id !== null) return; TOUCH.id = e.pointerId; zona.setPointerCapture(e.pointerId); const r = zona.getBoundingClientRect(); TOUCH.ox = e.clientX; TOUCH.oy = e.clientY; base.style.left = (e.clientX - r.left) + "px"; base.style.top = (e.clientY - r.top) + "px"; base.classList.add("on"); pomo.style.transform = "translate(-50%,-50%)"; e.preventDefault(); });
    zona.addEventListener("pointermove", e => { if (e.pointerId !== TOUCH.id) return; const dx = e.clientX - TOUCH.ox, dy = e.clientY - TOUCH.oy; const r = R(); const l = Math.hypot(dx, dy); const k = l > r ? r / l : 1; TOUCH.sx = clamp(dx / r, -1, 1); TOUCH.sy = clamp(dy / r, -1, 1); pomo.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`; e.preventDefault(); });
    const fine = e => { if (e.pointerId !== TOUCH.id) return; TOUCH.id = null; TOUCH.sx = 0; TOUCH.sy = 0; base.classList.remove("on"); pomo.style.transform = "translate(-50%,-50%)"; };
    zona.addEventListener("pointerup", fine); zona.addEventListener("pointercancel", fine);
    const man = ov.querySelector("#vl-manetta"); const setThr = e => { const r = man.getBoundingClientRect(); if (S) S.thr = clamp(1 - (e.clientY - r.top) / r.height, 0, 1); };
    man.addEventListener("pointerdown", e => { TOUCH.thrId = e.pointerId; man.setPointerCapture(e.pointerId); setThr(e); e.preventDefault(); });
    man.addEventListener("pointermove", e => { if (e.pointerId === TOUCH.thrId) setThr(e); });
    man.addEventListener("pointerup", () => { TOUCH.thrId = null; }); man.addEventListener("pointercancel", () => { TOUCH.thrId = null; });
    const tieni = (id, on, off) => { const b = ov.querySelector(id); b.addEventListener("pointerdown", e => { b.setPointerCapture(e.pointerId); b.classList.add("prem"); on(); e.preventDefault(); }); const f = () => { b.classList.remove("prem"); if (off) off(); }; b.addEventListener("pointerup", f); b.addEventListener("pointercancel", f); };
    tieni("#vl-fuoco", () => { TOUCH.fuoco = true; fuocoPremuto(); }, () => { TOUCH.fuoco = false; });
    tieni("#vl-lock", () => blocca());
    tieni("#vl-arma", () => cambiaArma());
    tieni("#vl-flare", () => { TOUCH.flare = true; contromisure(); }, () => { TOUCH.flare = false; });
    tieni("#vl-pedsx", () => { TOUCH.rud = -1; }, () => { TOUCH.rud = 0; });
    tieni("#vl-peddx", () => { TOUCH.rud = 1; }, () => { TOUCH.rud = 0; });
    tieni("#vl-freno", () => { TOUCH.freno = true; }, () => { TOUCH.freno = false; });
    window.addEventListener("deviceorientation", e => { if (!TILT.on || e.beta == null) return; const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0; if (TILT.b0 === null) { TILT.b0 = e.beta; TILT.g0 = e.gamma; }
      const db = e.beta - TILT.b0, dg = e.gamma - TILT.g0; const s = ang === 90 ? 1 : ang === -90 || ang === 270 ? -1 : 0;
      if (s) { TILT.sx = clamp(s * db / 30, -1, 1); TILT.sy = clamp(-s * dg / 22, -1, 1); } else { TILT.sx = clamp(e.gamma / 30, -1, 1); TILT.sy = clamp((e.beta - TILT.b0) / 22, -1, 1); } });
  }
  function attivaTilt() {
    TILT.b0 = null; const go = () => { TILT.on = true; };
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") DeviceOrientationEvent.requestPermission().then(r => { if (r === "granted") go(); else toast("Inclinazione non autorizzata: si usa la cloche touch"); }).catch(() => toast("Inclinazione non disponibile"));
    else go();
  }
  function gamepad() { const gps = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of gps) if (p && p.connected && p.axes.length >= 2) return p; return null; }
  const PAD = { prev: [] };
  function leggiComandi(dt) {
    const k = KEYS; let sx = 0, sy = 0, rud = 0; const inv = S.cfg.inverti ? -1 : 1;
    // tastiera: frecce/WASD come un simulatore (freccia su = barra avanti = picchia)
    if (k.arrowleft || k.a) sx -= 1; if (k.arrowright || k.d) sx += 1; if (k.arrowup || k.w) sy -= 1; if (k.arrowdown || k.s) sy += 1; if (k.q) rud -= 1; if (k.e) rud += 1;
    S.kbS = S.kbS || { x: 0, y: 0 }; S.kbS.x += (sx - S.kbS.x) * Math.min(1, dt * 6); S.kbS.y += (sy - S.kbS.y) * Math.min(1, dt * 4); sx = S.kbS.x; sy = S.kbS.y;
    if (k.shift || k["+"] || k.r) S.thr = clamp(S.thr + dt * 0.45, 0, 1); if (k.control || k["-"] || k.f) S.thr = clamp(S.thr - dt * 0.45, 0, 1);
    // touch: curva esponenziale per la precisione vicino al centro (barra indietro = trascina verso il basso = cabra)
    const ex = v => Math.sign(v) * Math.pow(Math.abs(v), 1.5);
    if (TOUCH.id !== null) { sx = ex(TOUCH.sx); sy = ex(TOUCH.sy); }
    if (TILT.on && TOUCH.id === null) { sx = ex(TILT.sx); sy = ex(TILT.sy); }
    if (TOUCH.rud) rud = TOUCH.rud;
    const p = gamepad(); if (p) { const dz = v => Math.abs(v) < 0.08 ? 0 : v; if (Math.abs(p.axes[0]) > 0.08 || Math.abs(p.axes[1]) > 0.08) { sx = ex(dz(p.axes[0])); sy = ex(dz(p.axes[1])); } if (p.axes.length > 2 && Math.abs(p.axes[2]) > 0.15) rud = p.axes[2];
      const b = i => p.buttons[i] && p.buttons[i].pressed; const pr = i => b(i) && !PAD.prev[i];
      if (b(7)) S.thr = clamp(S.thr + dt * 0.5 * (p.buttons[7].value || 1), 0, 1); if (b(6)) S.thr = clamp(S.thr - dt * 0.5 * (p.buttons[6].value || 1), 0, 1);
      if (b(4)) rud = -1; if (b(5)) rud = 1; if (pr(0)) fuocoPremuto(); S.padFuoco = b(0); if (pr(1)) contromisure(); if (pr(2)) cambiaArma(); if (pr(3)) blocca(); if (pr(8)) cambiaCam(); if (pr(9)) pausa(true); if (pr(12)) carrello();
      PAD.prev = p.buttons.map(x => x.pressed); }
    S.in = { sx: clamp(sx, -1, 1), sy: clamp(sy * inv, -1, 1), rud: clamp(rud, -1, 1), fuoco: TOUCH.fuoco || k[" "] || S.padFuoco, freno: TOUCH.freno || k.b };
  }
  function tastoPremuto(k, e) {
    if (!S) return; if (e.repeat) return;
    if (k === " ") fuocoPremuto(); else if (k === "t") blocca(); else if (k === "x") cambiaArma(); else if (k === "c") contromisure(); else if (k === "g") carrello(); else if (k === "v") cambiaCam(); else if (k === "p" || k === "escape") pausa(!S.pausa); else if (k === "h") pausa(true, true); else if (k === "n") nvg();
  }

  /* ---------- audio sintetizzato ---------- */
  function audioInit() {
    if (AU) return AU; try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = buf.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      const motore = ctx.createBufferSource(); motore.buffer = buf; motore.loop = true; const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 400; const gm = ctx.createGain(); gm.gain.value = 0; motore.connect(lp); lp.connect(gm); gm.connect(master); motore.start();
      const tono = ctx.createOscillator(); tono.type = "sine"; tono.frequency.value = 900; const gt = ctx.createGain(); gt.gain.value = 0; tono.connect(gt); gt.connect(master); tono.start();
      AU = { ctx, master, lp, gm, tono, gt, buf }; } catch (e) { AU = null; } return AU;
  }
  function suono(tipo, vol) {
    const a = AU; if (!a || !S || !S.cfg.audio) return; const c = a.ctx, t = c.currentTime; vol = vol == null ? 1 : vol;
    const rumore = (dur, f0, f1, g0) => { const s = c.createBufferSource(); s.buffer = a.buf; const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur); const g = c.createGain(); g.gain.setValueAtTime(g0 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(a.master); s.start(t, Math.random()); s.stop(t + dur + 0.05); };
    const bip = (f, dur, g0, quando) => { const o = c.createOscillator(); o.frequency.value = f; o.type = "square"; const g = c.createGain(); const t0 = t + (quando || 0); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(g0 * vol, t0 + 0.01); g.gain.setValueAtTime(g0 * vol, t0 + dur - 0.02); g.gain.linearRampToValueAtTime(0, t0 + dur); o.connect(g); g.connect(a.master); o.start(t0); o.stop(t0 + dur + 0.02); };
    if (tipo === "lancio") rumore(1.6, 3000, 300, 0.9);
    else if (tipo === "esplosione") rumore(2.2, 900, 60, 1.4);
    else if (tipo === "cannone") rumore(0.09, 2500, 900, 0.5);
    else if (tipo === "flare") rumore(0.25, 4000, 1500, 0.25);
    else if (tipo === "lock") { bip(1200, 0.08, 0.12); bip(1600, 0.08, 0.12, 0.1); }
    else if (tipo === "rwr") { bip(1000, 0.06, 0.1); bip(1400, 0.06, 0.1, 0.09); }
    else if (tipo === "missile") { for (let i = 0; i < 4; i++) bip(1700, 0.05, 0.14, i * 0.08); }
    else if (tipo === "pullup") { bip(600, 0.15, 0.15); bip(800, 0.15, 0.15, 0.18); }
    else if (tipo === "click") bip(2200, 0.03, 0.08);
  }
  function voce(testo) { if (!S || !S.cfg.audio || !window.speechSynthesis) return; try { const u = new SpeechSynthesisUtterance(testo); u.lang = "en-US"; u.rate = 1.15; u.pitch = 0.9; u.volume = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {} }
  function audioFrame() {
    const a = AU; if (!a || !S) return; const t = a.ctx.currentTime; const P = S.pl; const on = S.cfg.audio && !S.pausa && P.vivo;
    const eng = on ? 0.12 + 0.35 * P.spinta + 0.25 * P.ab : 0; a.gm.gain.setTargetAtTime(eng * 0.6, t, 0.1); a.lp.frequency.setTargetAtTime(250 + 900 * P.spinta + 1500 * P.ab + P.V * 1.2, t, 0.1);
    // tono del seeker AIM-9: ringhio basso in ricerca, acuto e continuo con il bersaglio agganciato
    let gt = 0, f = 900; if (on && S.arma === "AIM9X") { const tg = S.lock && S.lock.ok ? S.lock.t : null; if (tg) { gt = 0.07; f = 1650; } else if (S.seekerVede) { gt = 0.05 * (0.6 + 0.4 * Math.sin(t * 40)); f = 950; } else { gt = 0.025 * (0.5 + 0.5 * Math.sin(t * 25)); f = 700; } }
    a.gt.gain.setTargetAtTime(gt, t, 0.03); a.tono.frequency.setTargetAtTime(f, t, 0.03);
  }

  /* ---------- terreno, cielo, oggetti ---------- */
  function terreno(root) {
    const lat0 = TERRA.lat0, lon0 = TERRA.lon0, z = 10; const t = VISTA3D.lonLatToTile(lon0, lat0, z); const tileM = 40075016.686 * Math.cos(lat0 * D2R) / t.n;
    Object.assign(TERRA, { grids: {}, ready: false, t, tileM, caricate: 0, totale: 0, byKey: {} }); const loader = new THREE.TextureLoader(); loader.setCrossOrigin("anonymous");
    const mare = new THREE.Mesh(new THREE.PlaneGeometry(3e6, 3e6), matStd(0x24425f, { roughness: 0.6, metalness: 0.1 })); mare.rotation.x = -Math.PI / 2; mare.position.y = -30; root.add(mare);
    const RX = 7, RY = 4, tx = Math.floor(t.x), ty = Math.floor(t.y); const c0 = S.pl.pos; const lista = [];
    for (let dx = -RX; dx <= RX; dx++) for (let dy = -RY; dy <= RY; dy++) { const cx = (tx + dx + 0.5 - t.x) * tileM, cz = (ty + dy + 0.5 - t.y) * tileM; lista.push({ dx, dy, cx, cz, d: Math.hypot(cx - c0.x, cz - c0.z) }); }
    lista.sort((a, b) => a.d - b.d); TERRA.totale = lista.length; const SEG = mobile() ? 32 : 48;
    lista.forEach(({ dx, dy, cx, cz }) => {
      const geo = new THREE.PlaneGeometry(tileM, tileM, SEG, SEG); geo.rotateX(-Math.PI / 2); const mat = matStd(0x3f5a3a, { roughness: 1, metalness: 0 }); const mesh = new THREE.Mesh(geo, mat); mesh.position.set(cx, 0, cz);
      const key = (tx + dx) + "_" + (ty + dy); mesh.userData = { key, tx: tx + dx, ty: ty + dy }; root.add(mesh); TERRA.byKey[key] = mesh;
      VISTA3D.caricaTex(loader, VISTA3D.tileUrl("img", z, tx + dx, ty + dy), tex => { srgb(tex); tex.anisotropy = 8; mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; });
      VISTA3D.caricaDem(VISTA3D.tileUrl("dem", z, tx + dx, ty + dy), img => {
        try { const g = VISTA3D.demGrid(img); TERRA.grids[key] = g; TERRA.ready = true; mat.normalMap = normalMap(g, tileM / 256); mat.normalScale.set(2.0, 2.0); mat.needsUpdate = true; } catch (e) {}
        TERRA.caricate++; riquota(mesh); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const n = TERRA.byKey[(mesh.userData.tx + a) + "_" + (mesh.userData.ty + b)]; if (n && TERRA.grids[n.userData.key]) riquota(n); });
        if (S) S.oggettiSporchi = true;
      }, () => { TERRA.caricate++; });
    });
  }
  function normalMap(g, cella) {
    const c = document.createElement("canvas"); c.width = c.height = 256; const ctx = c.getContext("2d"); const im = ctx.createImageData(256, 256); const d = im.data; const h = (x, y) => g[clamp(y, 0, 255) * 256 + clamp(x, 0, 255)];
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const nx = -(h(x + 1, y) - h(x - 1, y)) / (2 * cella), ny = (h(x, y + 1) - h(x, y - 1)) / (2 * cella); const l = Math.hypot(nx, ny, 1); const i = (y * 256 + x) * 4; d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255; }
    ctx.putImageData(im, 0, 0); return new THREE.CanvasTexture(c);
  }
  function riquota(m) { if (!TERRA.ready) return; const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, elev(p.getX(i) + m.position.x, p.getZ(i) + m.position.z)); p.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere(); }
  function cieloNotte() {
    const zen = new THREE.Color(0x02040a), hor = new THREE.Color(0x0b1526);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.4e6, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { zen: { value: zen }, hor: { value: hor } },
      vertexShader: "varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 zen; uniform vec3 hor; varying vec3 vW; void main(){ float h = normalize(vW - cameraPosition).y; gl_FragColor = vec4(mix(hor, zen, pow(max(0.0,h),0.35)), 1.0); }" }));
    scene.add(dome); S.cupola = dome;
    // stelle: punti sulla volta che segue la camera
    const N = 2200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, e = Math.asin(Math.random() * 0.98 + 0.02); const r = 1.3e6; pos.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3); const k = 0.45 + Math.random() * 0.55; col.set([k * 0.9, k * 0.95, k], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); sg.setAttribute("color", new THREE.BufferAttribute(col, 3));
    dome.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, transparent: true })));
    // luna: luce fredda e debole
    const moonDir = V3(Math.sin(2.4) * Math.cos(0.45), Math.sin(0.45), -Math.cos(2.4) * Math.cos(0.45)).normalize();
    const moon = new THREE.DirectionalLight(0x9fb2ff, 0.16); moon.position.copy(moonDir).multiplyScalar(100000); scene.add(moon);
    scene.add(new THREE.HemisphereLight(0x1d2b44, 0x040506, 0.14)); scene.background = hor; scene.fog = new THREE.Fog(0x070d18, 30000, 280000);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: VISTA3D.puffTexture(true), color: 0xe6ecff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.scale.setScalar(26000); scene.add(sp); S.sole = sp; S.sunDir = moonDir;
  }
  // luci delle città e delle basi (si vedono anche a occhio nudo, con il visore diventano punti brillanti)
  const CITTA = [[40.586, -122.39, 220], [40.178, -122.236, 90], [40.80, -124.16, 160], [41.756, -124.20, 70], [42.22, -121.78, 150], [41.735, -122.634, 60], [41.42, -122.386, 40], [41.31, -122.31, 50], [40.448, -122.297, 60], [40.867, -124.08, 70], [40.416, -120.653, 60], [40.882, -121.66, 30], [41.487, -120.542, 30], [41.21, -122.27, 30], [40.74, -122.94, 25]];
  function luciCitta(root) {
    const pts = []; CITTA.forEach(([lat, lon, n]) => { const c = toXZ(lat, lon); const R = 900 + n * 14; for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = Math.pow(Math.random(), 0.7) * R; pts.push([c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, Math.random()]); } });
    (APP.sc.basi || []).forEach(b => { const c = toXZ(b.lat, b.lon); for (let i = 0; i < 24; i++) pts.push([c.x + (Math.random() - 0.5) * 1800, c.z + (Math.random() - 0.5) * 900, 1]); });
    const pos = new Float32Array(pts.length * 3), col = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => { pos.set([p[0], 0, p[1]], i * 3); const w = p[2]; col.set(w > 0.85 ? [1, 1, 0.92] : [1, 0.72 + 0.15 * w, 0.38 + 0.2 * w], i * 3); });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); p.frustumCulled = false; root.add(p); S.luci = { p, pts };
  }
  function quotaLuci() { if (!S.luci) return; const a = S.luci.p.geometry.attributes.position; S.luci.pts.forEach((q, i) => a.setY(i, elev(q[0], q[1]) + 12)); a.needsUpdate = true; }
  // luci di navigazione: rossa a sinistra, verde a destra, bianca in coda (ala destra = −X locale)
  function luciNav(obj, semiApertura, lung) {
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([semiApertura, 0, -1, -semiApertura, 0, -1, 0, 1.5, -lung / 2]), 3)); g.setAttribute("color", new THREE.BufferAttribute(new Float32Array([1, 0.1, 0.1, 0.1, 1, 0.3, 1, 1, 1]), 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 4, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false })); obj.add(p); obj.userData.nav = p;
  }
  function nvg() { if (!S) return; S.nvg = !S.nvg; suono("click"); messaggio(S.nvg ? (S.cam === "cockpit" ? "NVG ON" : "NVG ON · visibile dal cockpit (V)") : "NVG OFF", 1.4); }
  const NVG_RUM = { ctx: null, img: null };
  function aggiornaNvg() {
    const on = !!(S.nvg && S.cam === "cockpit" && S.pl.vivo); canvas.classList.toggle("nvg", on); renderer.toneMappingExposure = on ? (S.cfg.ora === "notte" ? 6 : 1.2) : 1;   // il tubo amplifica la luce prima di colorarla const d = ov.querySelector("#vl-nvg"); d.classList.toggle("on", on); ov.querySelector("#vl-nvgb").classList.toggle("on", !!S.nvg);
    if (!on || (S.nvgF = (S.nvgF || 0) + 1) % 2) return;   // grana del tubo intensificatore, rinnovata ogni 2 fotogrammi
    if (!NVG_RUM.ctx) { const c = ov.querySelector("#vl-nvg-rumore"); NVG_RUM.ctx = c.getContext("2d"); NVG_RUM.img = NVG_RUM.ctx.createImageData(c.width, c.height); }
    const px = NVG_RUM.img.data; for (let i = 0; i < px.length; i += 4) { const v = Math.random() * 255; px[i] = v * 0.6; px[i + 1] = v; px[i + 2] = v * 0.6; px[i + 3] = 255; } NVG_RUM.ctx.putImageData(NVG_RUM.img, 0, 0);
  }
  function cielo() {
    if (S.cfg.ora === "notte") return cieloNotte();
    const m = (APP.sc && APP.sc.meteo) || {}; const ora = 14.5, giorno = m.giorno || 165, lat = TERRA.lat0;
    const decl = 23.44 * Math.sin(2 * Math.PI * (284 + giorno) / 365) * D2R, H = (ora - 12.5) * 15 * D2R, φ = lat * D2R;
    const el = Math.asin(Math.sin(φ) * Math.sin(decl) + Math.cos(φ) * Math.cos(decl) * Math.cos(H)); const az = Math.atan2(-Math.sin(H), Math.tan(decl) * Math.cos(φ) - Math.sin(φ) * Math.cos(H)); const elN = Math.max(0, Math.sin(el));
    const zen = new THREE.Color().setHSL(0.6, 0.62, 0.36 + 0.2 * elN), hor = new THREE.Color().setHSL(0.58, 0.45, 0.8);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.4e6, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { zen: { value: zen }, hor: { value: hor } },
      vertexShader: "varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 zen; uniform vec3 hor; varying vec3 vW; void main(){ float h = normalize(vW - cameraPosition).y; gl_FragColor = vec4(mix(hor, zen, pow(max(0.0,h),0.45)), 1.0); }" }));
    scene.add(dome); S.cupola = dome;
    const sunDir = V3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize(); const sun = new THREE.DirectionalLight(0xfff2dc, 0.6 + 0.9 * elN); sun.position.copy(sunDir).multiplyScalar(100000); scene.add(sun);
    scene.add(new THREE.HemisphereLight(hor, 0x4a4030, 0.6)); scene.background = hor; scene.fog = new THREE.Fog(hor.clone().lerp(zen, 0.15), 60000, 420000);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: VISTA3D.puffTexture(true), color: 0xfff4d6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.position.copy(sunDir).multiplyScalar(1.2e6); sp.scale.setScalar(110000); scene.add(sp); S.sole = sp; S.sunDir = sunDir;
  }
  function pista(root) {
    const sc = APP.sc; const b = sc.basi.find(x => x.id === S.cfg.base) || sc.basi.find(x => x.lato === "BLUE") || sc.basi[0]; const q = toXZ(b.lat, b.lon); const hdg = (b.pista_hdg != null ? b.pista_hdg : 110) * D2R; const L = 2700;
    S.pista = { x: q.x, z: q.z, y: 0, ux: Math.sin(hdg), uz: -Math.cos(hdg), L, hdg: hdg * R2D, nome: b.nome };
    const g = new THREE.Group(); const asf = new THREE.Mesh(new THREE.PlaneGeometry(45, L), matStd(0x2f3133, { roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -4 })); asf.rotation.x = -Math.PI / 2; g.add(asf);
    for (let i = -L / 2 + 120; i < L / 2 - 120; i += 60) { const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 30), new THREE.MeshBasicMaterial({ color: 0xeeeeee, polygonOffset: true, polygonOffsetFactor: -6 })); s.rotation.x = -Math.PI / 2; s.position.set(0, 0.05, i); g.add(s); }
    [-1, 1].forEach(e => { for (let j = -8; j <= 8; j++) { if (Math.abs(j) < 1) continue; const s = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -6 })); s.rotation.x = -Math.PI / 2; s.position.set(j * 2.4, 0.05, e * (L / 2 - 40)); g.add(s); } });
    const luci = new THREE.InstancedMesh(new THREE.SphereGeometry(0.6, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), Math.floor(L / 60) * 2); let n = 0; const mtx = new THREE.Matrix4();
    for (let i = -L / 2; i < L / 2; i += 60) [-24, 24].forEach(x => { mtx.makeTranslation(x, 0.5, i); luci.setMatrixAt(n++, mtx); }); luci.count = n; g.add(luci);
    g.rotation.y = Math.PI - hdg; g.position.set(q.x, 0, q.z); root.add(g); S.pistaMesh = g;
  }
  function edificio(w, h, d, col) { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matStd(col)); m.position.y = h / 2; g.add(m); return g; }
  function bersagliTerra(root) {
    const sc = APP.sc; S.terra = [];
    sc.target.forEach(t => { const q = toXZ(t.lat, t.lon); const g = new THREE.Group(); const n = 4; for (let i = 0; i < n; i++) { const e = edificio(60 + (i % 2) * 30, 18 + (i % 3) * 6, 40, i % 2 ? 0x8c8f88 : 0x9a9488); e.position.set((i % 2) * 110 - 55, 0, Math.floor(i / 2) * 90 - 45); g.add(e); }
      root.add(g); S.terra.push({ id: t.id, nome: t.nome, tipo: "terra", sotto: "obiettivo", obj: g, pos: V3(q.x, 0, q.z), vel: V3(), vivo: true, hp: 2, raggio: 60, x: q.x, z: q.z }); });
    (sc.sam || []).forEach(s => { const q = toXZ(s.lat, s.lon); const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const tr = edificio(12, 3.2, 3, 0x5b6447); tr.position.set(i * 25 - 25, 0, 0); const tubi = new THREE.Mesh(new THREE.BoxGeometry(10, 2.2, 2.6), matStd(0x6d7552)); tubi.position.set(i * 25 - 25, 4.5, 0); tubi.rotation.z = 0.5; g.add(tr, tubi); }
      const rad = edificio(6, 6, 6, 0x4f5640); rad.position.set(0, 0, 30); const ant = new THREE.Mesh(new THREE.BoxGeometry(9, 6, 0.6), matStd(0x8a8f7a)); ant.position.set(0, 10, 30); g.add(rad, ant); root.add(g);
      S.terra.push({ id: s.id, nome: s.nome || "SA-10", tipo: "terra", sotto: "sam", obj: g, pos: V3(q.x, 0, q.z), vel: V3(), vivo: true, hp: 1, raggio: 35, x: q.x, z: q.z, missili: 4, cad: 12 + Math.random() * 12, antenna: ant }); });
    posizionaTerra();
  }
  function posizionaTerra() { quotaLuci(); (S.terra || []).forEach(t => { const y = elev(t.x, t.z); t.pos.y = y + 6; t.obj.position.set(t.x, y, t.z); }); if (S.pista) { const p = S.pista; let y = 0; for (let k = -0.5; k <= 0.5; k += 0.25) y = Math.max(y, elev(p.x + p.ux * p.L * k, p.z + p.uz * p.L * k)); p.y = y + 0.4; S.pistaMesh.position.y = p.y; } }

  /* ---------- particelle (fumo, fiamme, esplosioni, flare) ---------- */
  function particelle() {
    const N = mobile() ? 260 : 520; const tex = VISTA3D.puffTexture(false), texL = VISTA3D.puffTexture(true); const pool = [];
    for (let i = 0; i < N; i++) { const luce = i % 3 === 0; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: luce ? texL : tex, transparent: true, depthWrite: false, blending: luce ? THREE.AdditiveBlending : THREE.NormalBlending, color: 0xffffff })); sp.visible = false; scene.add(sp); pool.push({ sp, vita: 0, luce }); }
    S.part = { pool, i: 0 };
  }
  function emetti(pos, opt) {
    const P = S.part; const n = P.pool.length; for (let tent = 0; tent < 6; tent++) { const it = P.pool[P.i = (P.i + 1) % n]; if (it.vita > 0 && tent < 5) continue; if (!!opt.luce !== it.luce && tent < 5) continue;
      it.vita = it.vitaMax = opt.vita || 1.5; it.sp.position.copy(pos); it.v = opt.vel ? opt.vel.clone() : V3(); it.s0 = opt.s0 || 4; it.s1 = opt.s1 || 20; it.a0 = opt.a0 == null ? 0.8 : opt.a0; it.sp.material.color.set(opt.col || 0xffffff); it.sp.material.opacity = it.a0; it.sp.scale.setScalar(it.s0); it.sp.visible = true; it.drag = opt.drag || 0.5; it.su = opt.su || 0; return it; }
  }
  function aggiornaParticelle(dt) { S.part.pool.forEach(it => { if (it.vita <= 0) return; it.vita -= dt; if (it.vita <= 0) { it.sp.visible = false; return; } const k = 1 - it.vita / it.vitaMax; it.v.multiplyScalar(Math.max(0, 1 - it.drag * dt)); it.v.y += it.su * dt; it.sp.position.addScaledVector(it.v, dt); it.sp.scale.setScalar(it.s0 + (it.s1 - it.s0) * k); it.sp.material.opacity = it.a0 * (1 - k); }); }
  function esplosione(pos, grande) {
    const k = grande ? 2.2 : 1; for (let i = 0; i < (grande ? 26 : 16); i++) { const d = V3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar((20 + Math.random() * 60) * k); emetti(pos, { luce: true, col: i % 2 ? 0xffb347 : 0xff7a1a, vel: d, vita: 0.6 + Math.random() * 0.6, s0: 8 * k, s1: 40 * k, a0: 1, drag: 2 }); }
    for (let i = 0; i < (grande ? 20 : 12); i++) { const d = V3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).normalize().multiplyScalar((10 + Math.random() * 30) * k); emetti(pos, { col: 0x3a3532, vel: d, vita: 3 + Math.random() * 2, s0: 12 * k, s1: 70 * k, a0: 0.75, drag: 0.8, su: 3 }); }
    const dist = camera.position.distanceTo(pos); suono("esplosione", clamp(1.2 - dist / 20000, 0.15, 1));
  }

  /* ---------- velivoli ---------- */
  function modello(icona, tipoId, col, numero) { const g = new THREE.Group(); const att = new THREE.Group(); g.add(att); att.add(VISTA3D.jetFallback(col != null ? col : 0x6b7280)); VISTA3D.modelloPromise(icona, col, { tipoId, numero, callsign: numero }).then(m => { if (!S) return; while (att.children.length) att.remove(att.children[0]); att.add(m); g.userData.mdl = m; }); scene.add(g); return g; }
  function creaGiocatore() {
    const A = AEREI[S.cfg.aereo] || AEREI.F16; const P = S.pl; P.A = A; P.fuel = A.fuel; P.colpi = A.colpi; P.armi = Object.assign({}, A.carico); P.flare = 60; P.chaff = 60;
    P.obj = modello(A.icona, S.cfg.aereo, undefined, "01"); if (S.cfg.ora === "notte") luciNav(P.obj, 5, 15);
  }
  function quatDaAssetto(hdg, pitch, roll) { const e = new THREE.Euler(-pitch, Math.PI - hdg, roll, "YXZ"); return new THREE.Quaternion().setFromEuler(e); }
  function partenza() {
    const P = S.pl; const sc = APP.sc;
    if (S.cfg.partenza === "pista") { const p = S.pista; const hdg = p.hdg * D2R; P.pos = V3(p.x - p.ux * (p.L / 2 - 120), p.y + 2.2, p.z - p.uz * (p.L / 2 - 120)); P.vel = V3(); P.Q = quatDaAssetto(hdg, 0, 0); P.aTerra = true; P.carrello = true; S.thr = 0; }
    else { const b = S.pista; const tg = sc.target[0] || sc.mappa.bullseye; const a = toXZ(tg.lat, tg.lon); const dir = V3(a.x - b.x, 0, a.z - b.z).normalize(); P.pos = V3(b.x + dir.x * 40000, 6100, b.z + dir.z * 40000); const hdg = Math.atan2(dir.x, -dir.z); P.vel = V3(Math.sin(hdg), 0, -Math.cos(hdg)).multiplyScalar(250); P.Q = quatDaAssetto(hdg, 2 * D2R, 0); P.aTerra = false; P.carrello = false; S.thr = 0.62; }
    P.M = 0; P.agl = 0; P.qbar = 0; P.nInt = 0; P.p = 0; P.q = 0; P.r = 0; P.spinta = S.thr; P.ab = 0; P.vivo = true; P.nz = 1; P.gMax = 1; P.alpha = 0; P.V = P.vel.length(); P.acc = V3(0, 0, 0); P.aN = 0; P.hp = 1;
  }
  function creaNemici(n) {
    const sc = APP.sc; const P = S.pl; const tipi = ["SU35", "SU57"]; const centro = sc.target.length ? toXZ(sc.target[0].lat, sc.target[0].lon) : { x: P.pos.x + 60000, z: P.pos.z };
    const versoNemico = V3(centro.x - P.pos.x, 0, centro.z - P.pos.z); const dist = versoNemico.length(); versoNemico.normalize();
    for (let i = 0; i < n; i++) {
      const tipo = tipi[i % 2]; const d = Math.min(dist, S.cfg.partenza === "pista" ? 110000 : 55000) + (i % 3) * 6000; const lat = (i - (n - 1) / 2) * 7000;
      const pos = V3(P.pos.x + versoNemico.x * d - versoNemico.z * lat, 6500 + (i % 3) * 1200, P.pos.z + versoNemico.z * d + versoNemico.x * lat);
      const hdg = Math.atan2(-versoNemico.x, versoNemico.z); const col = 0x8a3a3a;
      const e = { id: "BANDIT" + (i + 1), nome: (tipo === "SU35" ? "Su-35" : "Su-57") + " #" + (i + 1), tipo: "aria", tipoId: tipo, pos, vel: V3(), hdg, gam: 0, V: S.diff.vNem, bank: 0, vivo: true, hp: 6, raggio: 10, missili: { R77: 4, R73: 2 }, cad: 15 + Math.random() * 20, stato: "pattuglia", casa: pos.clone(), flare: 30, obj: modello(tipo === "SU35" ? "su35" : "su57", tipo, col, String(i + 11)) };
      if (S.cfg.ora === "notte") luciNav(e.obj, 7.5, 21);
      S.nemici.push(e);
    }
  }

  /* ---------- fisica del giocatore ---------- */
  const _v = V3(), _fwd = V3(), _up = V3(), _rt = V3(), _vb = V3(), _L = V3(), _Sd = V3(), _q = new THREE.Quaternion(), _qi = new THREE.Quaternion();
  function assi(Q) { _fwd.set(0, 0, 1).applyQuaternion(Q); _up.set(0, 1, 0).applyQuaternion(Q); _rt.set(-1, 0, 0).applyQuaternion(Q); }
  function fisica(dt) {
    const P = S.pl, A = P.A, In = S.in; if (!P.vivo) return;
    const m = A.m - A.fuel / 2 + P.fuel; const at = isa(P.pos.y); const V = Math.max(0.1, P.vel.length()); const qbar = 0.5 * at.rho * V * V; const M = V / at.a;
    assi(P.Q); _qi.copy(P.Q).invert(); _vb.copy(P.vel).applyQuaternion(_qi);
    const alpha = V > 5 ? Math.atan2(-_vb.y, _vb.z) : 0; const slip = V > 5 ? Math.atan2(-_vb.x, _vb.z) : 0; P.alpha = alpha; P.M = M; P.V = V; P.qbar = qbar;
    // motore: manetta 0-80% = militare, 80-100% = postbruciatore; inerzia del motore
    const thr = S.thr; const milT = thr <= 0.8 ? 0.05 + 0.95 * thr / 0.8 : 1, abT = thr > 0.8 ? (thr - 0.8) / 0.2 : 0;
    P.spinta += (milT - P.spinta) * Math.min(1, dt / 1.4); P.ab += (abT - P.ab) * Math.min(1, dt / 0.6); if (P.fuel <= 0) { P.spinta = 0; P.ab = 0; }
    const lapse = Math.pow(at.rho / 1.225, 0.7) * (1 + 0.25 * Math.min(M, 2)); const T = (A.Tmil * P.spinta + (A.Tab - A.Tmil) * P.ab) * lapse;
    P.fuel = Math.max(0, P.fuel - (A.Tmil * P.spinta * 2.2e-5 + (A.Tab - A.Tmil) * P.ab * 5.5e-5) * lapse * dt);
    // aerodinamica
    const as = A.astall * D2R; const aa = Math.abs(alpha); const flap = P.carrello ? 0.35 : 0;   // con il carrello giù i flap scendono in automatico (come sull'F-16): più portanza a bassa velocità
    let CL = A.cla * alpha + flap; if (aa > as) CL = Math.sign(alpha) * A.cla * as * (1 - 0.55 * smooth(0, 0.5, aa - as)) + flap;
    const onda = 1 + 1.6 * smooth(0.85, 1.05, M) - 0.5 * smooth(1.2, 2.2, M); const CD = A.cd0 * onda + A.k * CL * CL + (P.carrello ? 0.05 : 0) + (In.freno && !P.aTerra ? 0.06 : 0) + (aa > as ? 0.6 * Math.sin(aa) : 0);
    _v.copy(P.vel).normalize(); _L.copy(_up).addScaledVector(_v, -_up.dot(_v)); if (_L.lengthSq() < 1e-6) _L.set(0, 1, 0); _L.normalize(); _Sd.copy(_rt).addScaledVector(_v, -_rt.dot(_v)).normalize();
    const F = V3(); F.addScaledVector(_L, qbar * A.S * CL).addScaledVector(_v, -qbar * A.S * CD).addScaledVector(_Sd, -qbar * A.S * 0.9 * slip).addScaledVector(_fwd, T); F.y -= m * G;
    if (P.aTerra) return fisicaSuolo(dt, m, T, qbar, CL, CD);
    const acc = F.divideScalar(m); P.acc.copy(acc);
    // fly-by-wire: la barra comanda il fattore di carico (1 G a barra centrata) con limite di incidenza; rollio e imbardata a rateo
    // barra al centro = mantiene la traiettoria (come le leggi di controllo di Typhoon/Airbus): G = cos(γ)/cos(φ), compensazione della virata fino a 60°
    const gam = Math.asin(clamp(P.vel.y / V, -1, 1)); const phi = Math.atan2(-_rt.y, _up.y); const ap = Math.abs(phi);
    const n0 = ap <= Math.PI / 2 ? Math.cos(gam) / Math.cos(Math.min(ap, 60 * D2R)) : 0.2;
    const nCmd = In.sy >= 0 ? n0 + In.sy * (A.gmax - n0) : n0 + In.sy * (n0 + A.gneg); const gV = V3().copy(acc); gV.y += G; P.nz = gV.dot(_up) / G;
    // incidenza richiesta: forza normale voluta meno la quota portata dalla spinta, più una correzione integrale lenta sull'errore di G
    const nTraj = (acc.dot(_L) + G * _L.y) / G; P.nInt = clamp((P.nInt || 0) + (nCmd - nTraj) * dt * 0.8, -1.5, 1.5);
    let aCmd = ((nCmd + P.nInt) * m * G - T * Math.sin(alpha) - qbar * A.S * flap) / Math.max(1, qbar * A.S * A.cla); aCmd = clamp(aCmd, -12 * D2R, A.amax * D2R); if (P.nz > A.gmax + 0.3 && alpha > 0) aCmd = Math.min(aCmd, alpha - 0.02);
    const aN = acc.dot(_L); const qCmd = clamp(aN / V + 3.5 * (aCmd - alpha), -0.6, 0.75); P.q += (qCmd - P.q) * Math.min(1, dt / 0.08);
    const eff = clamp(qbar / 15000, 0.12, 1) * (1 - 0.5 * clamp(aa / (A.amax * D2R), 0, 1)); const pCmd = In.sx * A.pmax * D2R * eff; P.p += (pCmd - P.p) * Math.min(1, dt / 0.12);
    const rCmd = In.rud * 0.3 * clamp(qbar / 15000, 0.2, 1) + 2.5 * slip; P.r += (rCmd - P.r) * Math.min(1, dt / 0.2);
    _q.setFromAxisAngle(V3(-P.q, -P.r, P.p).normalize(), Math.hypot(P.q, P.r, P.p) * dt); if (Math.hypot(P.q, P.r, P.p) > 1e-9) { P.Q.multiply(_q).normalize(); }
    P.vel.addScaledVector(acc, dt); P.pos.addScaledVector(P.vel, dt); P.gMax = Math.max(P.gMax, P.nz);
    // contatto col suolo
    const suolo = quotaSuolo(P.pos.x, P.pos.z); P.agl = P.pos.y - suolo;
    if (P.agl < 2.2) {
      assi(P.Q); const pitch = Math.asin(clamp(_fwd.y, -1, 1)) * R2D, roll = Math.atan2(-_rt.y, _up.y) * R2D; const sink = -P.vel.y; const inPista = S.pista && Math.abs(suolo - S.pista.y) < 0.01;
      if (P.carrello && sink < 4.5 && Math.abs(roll) < 12 && pitch > -4 && pitch < 20 && inPista) { P.aTerra = true; P.pos.y = suolo + 2.2; P.vel.y = 0; messaggio("TOUCHDOWN", 2); if (sink > 2.8) messaggio("ATTERRAGGIO DURO", 2); }
      else return schianto(P.carrello && !inPista ? "Atterraggio fuori pista" : "Impatto al suolo");
    }
  }
  function fisicaSuolo(dt, m, T, qbar, CL, CD) {
    const P = S.pl, A = P.A, In = S.in; assi(P.Q);
    let hdg = Math.atan2(_fwd.x, -_fwd.z); let pitch = Math.asin(clamp(_fwd.y, -1, 1)); const V = Math.max(0, P.vel.dot(V3(Math.sin(hdg), 0, -Math.cos(hdg))));
    // rotazione: con abbastanza pressione dinamica la barra alza il muso (max 14°), altrimenti il ruotino tiene il muso giù
    const pitchMax = 14 * D2R; if (In.sy > 0.15 && qbar > 2500) pitch = Math.min(pitchMax, pitch + In.sy * 7 * D2R * dt); else pitch = Math.max(0, pitch - 3 * D2R * dt);
    hdg += (In.rud + In.sx * 0.6) * 18 * D2R * clamp(1 - V / 90, 0.08, 1) * dt * (V > 0.5 ? 1 : 0);
    const Lift = qbar * A.S * (A.cla * pitch + (P.carrello ? 0.35 : 0)); const W = m * G; const mu = (In.freno ? 0.45 : 0.025) * Math.max(0, W - Lift); const D = qbar * A.S * (A.cd0 + A.k * Math.pow(A.cla * pitch, 2) + (P.carrello ? 0.03 : 0));
    const Vn = Math.max(0, V + (T - D - (V > 0.3 || T < mu ? mu : 0)) / m * dt);
    P.Q.copy(quatDaAssetto(hdg, pitch, 0)); P.vel.set(Math.sin(hdg) * Vn, 0, -Math.cos(hdg) * Vn); P.pos.addScaledVector(P.vel, dt);
    const suolo = quotaSuolo(P.pos.x, P.pos.z); P.pos.y = suolo + 2.2; P.agl = 2.2; P.nz = 1; P.nInt = 0; P.alpha = pitch; P.p = P.q = P.r = 0; P.acc.set(0, 0, 0);
    if (S.pista) { const dx = P.pos.x - S.pista.x, dz = P.pos.z - S.pista.z; const w = Math.abs(-dx * S.pista.uz + dz * S.pista.ux), u = Math.abs(dx * S.pista.ux + dz * S.pista.uz); if ((w > 40 || u > S.pista.L / 2 + 140) && Vn > 15) return schianto("Uscita di pista"); }
    if (Lift > W * 1.02 && In.sy > 0.1) { P.aTerra = false; P.vel.y = 1.5; P.pos.y += 0.5; messaggio("LIFT-OFF · ricorda il CARRELLO", 3); }
    if (Vn < 1 && !S.fermoAvvisato && S.t > 5) { S.fermoAvvisato = true; messaggio("FERMO · manetta avanti per il decollo", 3); }
    if (Vn > 1) S.fermoAvvisato = false;
  }
  function schianto(motivo) { const P = S.pl; if (!P.vivo) return; P.vivo = false; P.obj.visible = false; esplosione(P.pos.clone(), true); fineMissione("SCHIANTO", motivo); }

  /* ---------- nemici (intelligenza artificiale) ---------- */
  function aggiornaNemici(dt) {
    const P = S.pl;
    S.nemici.forEach(e => {
      if (!e.vivo) return; const toP = V3().subVectors(P.pos, e.pos); const dist = toP.length(); e.dist = dist;
      const minacce = S.missili.filter(m => m.target === e && m.vivo && !m.perso && m.pos.distanceTo(e.pos) < 14000);
      let hdgDes = e.hdg, altDes = e.pos.y, gLim = 4, vDes = S.diff.vNem;
      if (minacce.length) { e.stato = "difesa"; const m = minacce[0]; const los = V3().subVectors(e.pos, m.pos); const beam = Math.atan2(los.x, -los.z) + (e.lato90 = e.lato90 || (Math.random() < 0.5 ? 1 : -1)) * Math.PI / 2; hdgDes = beam; gLim = S.diff.gNem; if (e.altDifesa == null) e.altDifesa = Math.max(quotaSuolo(e.pos.x, e.pos.z) + 1500, e.pos.y - 2000); altDes = e.altDifesa; vDes = S.diff.vNem + 30;
        if ((e.cmT = (e.cmT || 0) - dt) <= 0 && e.flare > 0 && m.pos.distanceTo(e.pos) < 6000) { e.cmT = 2; e.flare--; lanciaFlare(e); } }
      else if (P.vivo && dist < 90000) { e.stato = "attacco"; e.altDifesa = null; const tl = clamp(dist / 700, 0, 6); const aim = V3().copy(P.pos).addScaledVector(P.vel, tl); hdgDes = Math.atan2(aim.x - e.pos.x, -(aim.z - e.pos.z)); altDes = clamp(aim.y + 300, quotaSuolo(e.pos.x, e.pos.z) + 600, 14000); gLim = dist < 8000 ? S.diff.gNem : 5; e.lato90 = 0; }
      else { e.stato = "pattuglia"; const c = V3().subVectors(e.casa, e.pos); hdgDes = c.length() > 15000 ? Math.atan2(c.x, -c.z) : e.hdg + 0.15; altDes = e.casa.y; }
      // virata coordinata con G limitati, salita/discesa con angolo di traiettoria limitato
      let err = hdgDes - e.hdg; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
      const wMax = G * Math.sqrt(Math.max(0, gLim * gLim - 1)) / Math.max(80, e.V); const w = clamp(err * 1.2, -wMax, wMax); e.hdg += w * dt; const bankT = Math.atan(w * e.V / G); e.bank += (bankT - e.bank) * Math.min(1, dt * 3);
      const ag = quotaSuolo(e.pos.x, e.pos.z); let gamDes = clamp((altDes - e.pos.y) / 3000, -0.35, 0.3); if (e.pos.y - ag < 400) gamDes = 0.3; e.gam += (gamDes - e.gam) * Math.min(1, dt * 1.5);
      const nCur = Math.hypot(w * e.V / G, 1); e.V += ((vDes - e.V) * 0.25 - (nCur - 1) * 2.2 - Math.sin(e.gam) * G * 0.6) * dt; e.V = clamp(e.V, 120, 520);
      e.vel.set(Math.sin(e.hdg) * Math.cos(e.gam), Math.sin(e.gam), -Math.cos(e.hdg) * Math.cos(e.gam)).multiplyScalar(e.V); e.pos.addScaledVector(e.vel, dt);
      e.obj.position.copy(e.pos); e.obj.quaternion.copy(quatDaAssetto(e.hdg, e.gam + 3 * D2R, e.bank)); if (e.obj.userData.mdl && e.obj.userData.mdl.userData.anim) e.obj.userData.mdl.userData.anim({ rollRate: (bankT - e.bank) * R2D * 3, pitchRate: 0, yawRate: w * R2D, afterburner: e.stato === "pattuglia" ? 0 : 0.6, t: S.t });
      if (e.pos.y < ag + 5) { distruggi(e, "si è schiantato"); return; }
      // tiro: R-77 oltre 8 km con il muso sul bersaglio, R-73 a corto raggio
      e.cad -= dt; if (P.vivo && e.stato === "attacco" && e.cad <= 0) { const off = toP.clone().normalize().dot(e.vel.clone().normalize()); const ang = Math.acos(clamp(off, -1, 1)) * R2D;
        if (dist < 26000 && dist > 7000 && ang < 25 && e.missili.R77 > 0) { e.missili.R77--; lancia("R77", e, P); e.cad = (22 + Math.random() * 15) * S.diff.cad; avvisoMissile(e); }
        else if (dist < 7000 && dist > 600 && ang < 35 && e.missili.R73 > 0) { e.missili.R73--; lancia("R73", e, P); e.cad = (14 + Math.random() * 10) * S.diff.cad; avvisoMissile(e); } }
      // illuminazione radar (RWR)
      const angP = Math.acos(clamp(toP.clone().normalize().dot(e.vel.clone().normalize()), -1, 1)) * R2D; e.illumina = P.vivo && dist < 40000 && angP < 35;
    });
    // SA-10 attivi: tirano su chi vola sopra i 200 m dal suolo entro 35 km
    if (S.cfg.sam && P.vivo) S.terra.filter(t => t.sotto === "sam" && t.vivo).forEach(t => { t.cad -= dt; const d = t.pos.distanceTo(P.pos); t.illumina = d < 45000 && P.agl > 200; if (t.antenna) t.antenna.rotation.y += dt * 1.5;
      if (t.cad <= 0 && t.missili > 0 && d < 35000 && P.agl > 200) { t.missili--; t.cad = (30 + Math.random() * 15) * S.diff.cad; lancia("SA10", t, P); avvisoMissile(t); } });
  }
  function avvisoMissile(da) { S.rwrMissile = 4; suono("missile"); messaggio("MISSILE LAUNCH", 2, "warn"); }

  /* ---------- armi ---------- */
  function cambiaArma() {
    if (!S) return; const P = S.pl; const lista = ["AIM120", "AIM9X", "GUN", "AGM65"].filter(a => a === "GUN" || (P.armi[a] || 0) > 0); const i = lista.indexOf(S.arma); S.arma = lista[(i + 1) % lista.length]; S.lock = null; suono("click");
    messaggio(ARMI[S.arma].nome + (S.arma === "GUN" ? ` · ${P.colpi} colpi` : ` · ${P.armi[S.arma] || 0}`), 1.5);
  }
  function candidati() {
    const P = S.pl; const w = ARMI[S.arma]; assi(P.Q); const fwd = _fwd.clone(); const lista = [];
    const pool = w.bersaglio === "terra" ? S.terra : S.nemici; const rmax = w.bersaglio === "terra" ? 25000 : S.arma === "AIM9X" ? 18000 : S.arma === "GUN" ? 4000 : 80000;
    pool.forEach(t => { if (!t.vivo) return; const d = V3().subVectors(t.pos, P.pos); const r = d.length(); if (r > rmax) return; const ang = Math.acos(clamp(d.normalize().dot(fwd), -1, 1)) * R2D; if (ang > w.cono) return; lista.push({ t, r, ang }); });
    return lista.sort((a, b) => a.ang - b.ang);
  }
  function blocca() {
    if (!S || !S.pl.vivo) return; const c = candidati(); if (!c.length) { S.lock = null; messaggio("NESSUN CONTATTO NEL CONO", 1.2); return; }
    let i = S.lock ? c.findIndex(x => x.t === S.lock.t) : -1; const scelto = c[(i + 1) % c.length].t; S.lock = { t: scelto, k: 0, ok: false }; suono("click");
  }
  function aggiornaLock(dt) {
    const P = S.pl; const w = ARMI[S.arma]; S.seekerVede = false;
    if (S.arma === "AIM9X" && !S.lock) { const c = candidati().filter(x => x.ang < 30); if (c.length) { S.seekerVede = true; S.lock = { t: c[0].t, k: 0, ok: false }; } }
    if (!S.lock) return; const t = S.lock.t; if (!t.vivo) { S.lock = null; return; }
    const d = V3().subVectors(t.pos, P.pos); const r = d.length(); assi(P.Q); const ang = Math.acos(clamp(d.clone().normalize().dot(_fwd), -1, 1)) * R2D;
    const rmax = w.bersaglio === "terra" ? 25000 : S.arma === "AIM9X" ? 18000 : S.arma === "GUN" ? 4000 : 80000;
    if (ang > w.cono + 5 || r > rmax * 1.1) { if (S.lock.ok) messaggio("LOCK PERSO", 1); S.lock = null; return; }
    if (!S.lock.ok) { S.lock.k += dt; if (S.lock.k >= (w.lock || 0.5)) { S.lock.ok = true; suono("lock"); } }
    S.lock.r = r; S.lock.ang = ang; S.lock.vc = -V3().subVectors(t.vel, P.vel).dot(d.normalize());
  }
  function dlz(arma, r, vc) { const P = S.pl; const h = P.pos.y; if (arma === "AIM120") return { rmin: 1500, rmax: clamp(28000 + 2.4 * h + 18 * (vc || 0), 8000, 85000) }; if (arma === "AIM9X") return { rmin: 400, rmax: clamp(9000 + 0.5 * h + 6 * (vc || 0), 3000, 18000) }; if (arma === "AGM65") return { rmin: 900, rmax: clamp(12000 + 1.2 * Math.max(0, P.agl || h), 6000, 25000) }; return { rmin: 0, rmax: 1200 }; }
  function fuocoPremuto() {
    if (!S || S.pausa || !S.pl.vivo) return; const P = S.pl;
    if (S.arma === "GUN") return; const n = P.armi[S.arma] || 0; if (n <= 0) { messaggio(ARMI[S.arma].sigla + " ESAURITI", 1.2, "warn"); cambiaArma(); return; }
    if (!S.lock || !S.lock.ok) { messaggio("NESSUN LOCK · premi LOCK", 1.2, "warn"); return; }
    const z = dlz(S.arma, S.lock.r, S.lock.vc); if (S.lock.r < z.rmin) { messaggio("TROPPO VICINO", 1, "warn"); return; }
    P.armi[S.arma] = n - 1; const m = lancia(S.arma, P, S.lock.t); S.ultimoMissile = m; S.stats.lanci++; messaggio(ARMI[S.arma].call, 1.6, "call"); voce(ARMI[S.arma].call.toLowerCase());
    if (S.lock.r > z.rmax) messaggio(ARMI[S.arma].call + " · fuori portata", 1.6, "warn");
  }
  function lancia(tipo, da, bersaglio) {
    const w = ARMI[tipo]; const pos = da.pos.clone(); let vel;
    if (da === S.pl) { assi(S.pl.Q); pos.addScaledVector(_up, -1.5); vel = S.pl.vel.clone().addScaledVector(_fwd, 15); }
    else if (da.tipo === "terra") { pos.y += 8; vel = V3().subVectors(bersaglio.pos, pos).normalize().multiplyScalar(60); vel.y = Math.max(vel.y, 40); }
    else vel = da.vel.clone().addScaledVector(da.vel.clone().normalize(), 10);
    const mesh = new THREE.Group(); const corpo = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.6, 8), matStd(0xe8e8e8)); corpo.rotation.x = Math.PI / 2; mesh.add(corpo);
    const fiamma = new THREE.Sprite(new THREE.SpriteMaterial({ map: VISTA3D.puffTexture(true), color: 0xffc070, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); fiamma.scale.setScalar(6); fiamma.position.z = -2.2; mesh.add(fiamma); scene.add(mesh);
    const m = { tipo, w, da, target: bersaglio, pos, vel, t: 0, vivo: true, perso: false, mesh, fiamma, minD: 1e9, prevD: 1e9, t0chk: S.t, pk: tipo === "R77" || tipo === "R73" || tipo === "SA10" ? w.pk * S.diff.pkNem / 0.65 : w.pk, fumoT: 0 };
    S.missili.push(m); suono("lancio", da === S.pl ? 1 : clamp(1 - pos.distanceTo(S.pl.pos) / 15000, 0.1, 0.8)); return m;
  }
  function aggiornaMissili(dt) {
    S.missili.forEach(m => {
      if (!m.vivo) return; m.t += dt; const w = m.w; const at = isa(m.pos.y); const V = m.vel.length(); const vh = m.vel.clone().normalize();
      let acc = V3(0, -G, 0); if (m.t < w.burn) acc.addScaledVector(vh, w.acc); acc.addScaledVector(vh, -w.cd * at.rho / 1.225 * 1.225 * V * V);
      const tg = m.target; let latA = 0;
      if (!m.perso && tg && tg.vivo !== false && m.t > 0.35) {
        const r = V3().subVectors(tg.pos, m.pos); const R = r.length(); const vrel = V3().subVectors(tg.vel || V3(), m.vel); const rh = r.clone().divideScalar(R);
        const gimbal = Math.acos(clamp(rh.dot(vh), -1, 1)) * R2D; if (gimbal > 60) { m.perso = "gimbal"; }
        else { const Om = V3().crossVectors(r, vrel).divideScalar(R * R); const Vc = -vrel.dot(rh); const a = V3().crossVectors(Om, rh).multiplyScalar(w.N * Math.max(Vc, 100)); a.y += G;
          // navigazione proporzionale aumentata: si aggiunge metà dell'accelerazione del bersaglio perpendicolare alla linea di mira
          if (tg.vel) { if (m.vtPrev && dt > 0) { const aT = V3().subVectors(tg.vel, m.vtPrev).divideScalar(dt); aT.addScaledVector(rh, -aT.dot(rh)); if (aT.length() < 15 * G) m.aT = (m.aT || V3()).lerp(aT, 0.3); } m.vtPrev = tg.vel.clone(); if (m.aT) a.addScaledVector(m.aT, w.N / 2); } a.addScaledVector(vh, -a.dot(vh)); const am = a.length(); const lim = w.maxG * G; if (am > lim) a.multiplyScalar(lim / am); latA = Math.min(am, lim); acc.add(a); }
        // inganno: flare contro i missili IR, chaff e "notch" (traiettoria perpendicolare a bassa quota) contro i radar
        if (tg.cmEvento && tg.cmEvento > m.t0chk && R < 7000 && m.t - (m.tEsame || -9) > 1.5) { m.t0chk = tg.cmEvento; m.tEsame = m.t; if (Math.random() < (w.esca != null ? w.esca : 0.15) * (tg === S.pl ? 1 : S.diff.cm)) { if (w.guida === "ir" && tg.ultimoFlare) { m.target = tg.ultimoFlare; m.ingannato = "flare"; } else m.perso = "chaff"; } }
        if (w.guida === "radar" && tg.vel && R > 1500) { const vt = tg.vel.length(); const radiale = Math.abs(tg.vel.dot(rh)) / Math.max(1, vt); const agl = tg.pos.y - quotaSuolo(tg.pos.x, tg.pos.z); if (radiale < 0.15 && agl < 1500 && Math.random() < 0.12 * dt) m.perso = "notch"; }
      }
      acc.addScaledVector(vh, -0.04 * latA); const p0 = m.pos.clone(); m.vel.addScaledVector(acc, dt); m.pos.addScaledVector(m.vel, dt);
      // spoletta di prossimità: distanza minima del segmento percorso nel passo rispetto al bersaglio
      if (tg && tg.pos && !m.perso) { const t0 = tg.pos.clone().addScaledVector(tg.vel || V3(), -dt); const r0 = V3().subVectors(p0, t0), r1 = V3().subVectors(m.pos, tg.pos); const dr = V3().subVectors(r1, r0); const k = clamp(-r0.dot(dr) / Math.max(1e-6, dr.lengthSq()), 0, 1); const dmin = r0.addScaledVector(dr, k).length();
        if (dmin < w.fuse) return detona(m, tg, 1);
        const d = r1.length(); if (d > m.prevD && m.prevD < w.fuse * 2) return detona(m, tg, 0.5); m.prevD = d; }
      if (m.t > w.vita || m.pos.y < quotaSuolo(m.pos.x, m.pos.z)) { if (m.pos.y < quotaSuolo(m.pos.x, m.pos.z) + 5) esplosione(m.pos.clone(), false); return fineMissile(m); }
      m.mesh.position.copy(m.pos); m.mesh.lookAt(m.pos.clone().add(m.vel)); m.fiamma.visible = m.t < w.burn;
      m.fumoT -= dt; if (m.fumoT <= 0 && m.t < w.burn + 1.5) { m.fumoT = 0.04; emetti(m.pos, { col: 0xdedede, vita: 3.5, s0: 2.5, s1: 16, a0: 0.55, drag: 1.2, su: 1 }); }
    });
    S.missili = S.missili.filter(m => m.vivo);
  }
  function detona(m, tg, fattore) {
    esplosione(m.pos.clone(), false); fineMissile(m);
    if (tg.esca) return; // un flare ha ingannato il missile: nessun danno
    if (Math.random() < m.pk * fattore) colpito(tg, m.da === S.pl ? (tg.tipo === "terra" ? 1 : 99) : 99, m);
    else if (m.da === S.pl) messaggio("MANCATO", 1.2, "warn");
  }
  function fineMissile(m) { m.vivo = false; scene.remove(m.mesh); if (S.ultimoMissile === m) setTimeout(() => { if (S && S.cam === "missile") S.cam = S.camPrima || "cockpit"; }, 1500); }
  function colpito(t, danno, m) {
    if (!t.vivo) return; t.hp -= danno;
    if (t === S.pl) { if (t.hp <= 0) { t.vivo = false; t.obj.visible = false; esplosione(t.pos.clone(), true); fineMissione("ABBATTUTO", "Colpito da " + (m ? ARMI[m.tipo].nome : "fuoco nemico")); } return; }
    if (t.hp <= 0) distruggi(t, m ? "colpito da " + ARMI[m.tipo].sigla : "colpito dal cannone"); else if (m && m.da === S.pl) messaggio("COLPITO · bersaglio danneggiato", 1.5, "call");
  }
  function distruggi(t, come) {
    t.vivo = false; esplosione(t.pos.clone(), true);
    if (t.tipo === "aria") { t.obj.visible = false; S.stats.kill++; const n = S.stats.kill; messaggio(`SPLASH ${["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX"][n - 1] || n}!`, 2.5, "call"); voce("splash " + (["one", "two", "three", "four", "five", "six"][n - 1] || n)); S.stats.punti += 100;
      for (let i = 0; i < 8; i++) emetti(t.pos, { col: 0x222222, vel: t.vel.clone().multiplyScalar(0.3).add(V3(0, -20 * i, 0)), vita: 5, s0: 10, s1: 50, a0: 0.7, drag: 0.4 }); }
    else { S.stats.terra++; S.stats.punti += t.sotto === "sam" ? 150 : 120; messaggio(t.sotto === "sam" ? "SA-10 DISTRUTTO" : "SHACK! " + t.nome.split(" ")[0] + " colpito", 2.5, "call"); t.obj.traverse(o => { if (o.isMesh) o.material = matStd(0x2a2522); }); t.obj.scale.y = 0.35; S.incendi.push({ pos: t.pos.clone(), t: 25 }); }
    if (S.lock && S.lock.t === t) S.lock = null;
    if (S.nemici.length && S.nemici.every(e => !e.vivo) && !S.ondataFinita) { S.ondataFinita = true; setTimeout(() => messaggio("CIELO LIBERO · ⏸ → Nuova ondata", 4, "call"), 2600); }
  }
  /* cannone: proiettili balistici con traccianti; colpi verificati con la distanza minima segmento-bersaglio */
  function aggiornaCannone(dt) {
    const P = S.pl; const fuoco = S.in.fuoco && S.arma === "GUN" && P.vivo && P.colpi > 0 && !S.pausa; S.gunT = (S.gunT || 0) - dt;
    if (fuoco) { const cad = P.A.colpi > 200 ? 1 / 100 : 1 / 28; while (S.gunT <= 0 && P.colpi > 0) { S.gunT += cad; P.colpi--; assi(P.Q); const disp = V3((Math.random() - 0.5) * 0.004, (Math.random() - 0.5) * 0.004, 0).applyQuaternion(P.Q); const v = P.vel.clone().addScaledVector(_fwd, 1050).addScaledVector(disp, 1050);
      S.proiettili.push({ pos: P.pos.clone().addScaledVector(_fwd, 6), vel: v, t: 0, tr: (S.nColpi = (S.nColpi || 0) + 1) % 3 === 0 }); } if ((S.gunSnd = (S.gunSnd || 0) - dt) <= 0) { S.gunSnd = 0.08; suono("cannone"); } }
    else S.gunT = Math.max(S.gunT, 0);
    const bersagli = S.nemici.filter(e => e.vivo).concat(S.terra.filter(t => t.vivo));
    S.proiettili.forEach(b => { const p0 = b.pos.clone(); b.vel.y -= G * dt; b.vel.multiplyScalar(1 - 0.12 * dt); b.pos.addScaledVector(b.vel, dt); b.t += dt;
      for (const t of bersagli) { const r = t.tipo === "aria" ? 9 : 30; const r0 = V3().subVectors(p0, t.pos), dr = V3().subVectors(b.pos, p0); const k = clamp(-r0.dot(dr) / Math.max(1e-6, dr.lengthSq()), 0, 1); if (r0.addScaledVector(dr, k).length() < r) { b.t = 99; emetti(b.pos, { luce: true, col: 0xffd27a, vita: 0.25, s0: 3, s1: 8, a0: 1 }); S.stats.colpi++; if (Math.random() < (t.tipo === "aria" ? 0.35 : 0.15)) colpito(t, 1); break; } }
      if (b.pos.y < quotaSuolo(b.pos.x, b.pos.z)) { b.t = 99; } });
    S.proiettili = S.proiettili.filter(b => b.t < 3);
    const pos = S.traccianti.geometry.attributes.position; let n = 0; S.proiettili.forEach(b => { if (!b.tr || n >= 300) return; const a = b.pos, c = b.pos.clone().addScaledVector(b.vel, -0.025); pos.setXYZ(n * 2, a.x, a.y, a.z); pos.setXYZ(n * 2 + 1, c.x, c.y, c.z); n++; });
    S.traccianti.geometry.setDrawRange(0, n * 2); pos.needsUpdate = true; S.traccianti.geometry.computeBoundingSphere();
  }
  function contromisure() {
    if (!S || !S.pl.vivo || S.pausa) return; const P = S.pl; if (P.flare <= 0 && P.chaff <= 0) { messaggio("CONTROMISURE ESAURITE", 1, "warn"); return; }
    if ((S.cmT || 0) > 0) return; S.cmT = 0.3; if (P.flare > 0) P.flare--; if (P.chaff > 0) P.chaff--; lanciaFlare(P); suono("flare");
  }
  function lanciaFlare(da) {
    const f = { pos: da.pos.clone(), vel: (da.vel || V3()).clone().multiplyScalar(0.6).add(V3((Math.random() - 0.5) * 30, -25, (Math.random() - 0.5) * 30)), vivo: true, esca: true, t: 0 };
    S.flares.push(f); da.ultimoFlare = f; da.cmEvento = (S.t || 0) + 0.001;
  }
  function aggiornaFlare(dt) { S.flares.forEach(f => { f.t += dt; f.vel.y -= 9 * dt; f.vel.multiplyScalar(1 - 0.8 * dt); f.pos.addScaledVector(f.vel, dt); if ((f.e = (f.e || 0) - dt) <= 0) { f.e = 0.05; emetti(f.pos, { luce: true, col: 0xfff1b0, vita: 0.5, s0: 6, s1: 3, a0: 1 }); emetti(f.pos, { col: 0xe8e8e8, vita: 2.5, s0: 2, s1: 10, a0: 0.4, su: 1 }); } if (f.t > 4.5) f.vivo = false; }); S.flares = S.flares.filter(f => f.vivo); }

  /* ---------- telecamere ---------- */
  const CAMS = ["cockpit", "chase", "missile"];
  function cambiaCam() { if (!S) return; let i = CAMS.indexOf(S.cam); let n = CAMS[(i + 1) % CAMS.length]; if (n === "missile" && !(S.ultimoMissile && S.ultimoMissile.vivo)) n = "cockpit"; if (n === "missile") S.camPrima = S.cam; S.cam = n; messaggio({ cockpit: "CAMERA · COCKPIT", chase: "CAMERA · ESTERNA", missile: "CAMERA · MISSILE" }[n], 1); }
  const _cp = V3(), _cu = V3(0, 1, 0);
  function aggiornaCamera(dt) {
    const P = S.pl; assi(P.Q); const vis = S.cam !== "cockpit" || !P.vivo; if (P.obj) P.obj.visible = P.vivo && vis;
    if (S.cam === "missile" && S.ultimoMissile && S.ultimoMissile.vivo) { const m = S.ultimoMissile; const vh = m.vel.clone().normalize(); _cp.copy(m.pos).addScaledVector(vh, -18).add(V3(0, 3, 0)); camera.position.lerp(_cp, Math.min(1, dt * 8)); camera.up.set(0, 1, 0); camera.lookAt(m.pos.clone().addScaledVector(vh, 60)); camera.fov = 60; camera.updateProjectionMatrix(); return; }
    if (S.cam === "cockpit" && P.vivo) { camera.position.copy(P.pos).addScaledVector(_up, 1.1).addScaledVector(_fwd, 5.5); camera.quaternion.copy(P.Q).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), Math.PI)); const sh = Math.max(0, P.nz - 6) * 0.02 + (P.aTerra ? Math.min(0.02, P.V / 4000) : 0); if (sh) camera.rotateX((Math.random() - 0.5) * sh); camera.fov = mobile() ? 62 : 60; camera.updateProjectionMatrix(); return; }
    // esterna stile videogioco: dietro e sopra, con inerzia; segue anche il rollio
    _cp.copy(P.pos).addScaledVector(_fwd, -24).addScaledVector(_up, 6); camera.position.lerp(_cp, Math.min(1, dt * 6)); _cu.lerp(_up, Math.min(1, dt * 3)).normalize(); camera.up.copy(_cu); camera.lookAt(V3().copy(P.pos).addScaledVector(_fwd, 25)); camera.fov = 62; camera.updateProjectionMatrix();
  }

  /* ---------- HUD ---------- */
  function messaggio(t, dur, cls) { if (!S) return; S.msg = { t, fine: S.t + (dur || 2), cls: cls || "" }; }
  function toast(t) { if (typeof UI !== "undefined" && UI.toast) UI.toast(t); }
  const _p = V3();
  function proietta(v) { _p.copy(v).project(camera); if (_p.z > 1 || _p.z < -1) return null; return { x: (_p.x + 1) / 2 * hudC.width, y: (1 - _p.y) / 2 * hudC.height }; }
  function disegnaHud() {
    const W = hudC.width, H = hudC.height, g = hud; g.clearRect(0, 0, W, H); if (!S) return; const P = S.pl; const sc = clamp(Math.min(W, H) / 560, 0.75, 1.6); const verde = "#5dff8f", rosso = "#ff4d4d";
    g.save(); g.strokeStyle = verde; g.fillStyle = verde; g.lineWidth = 1.6 * sc; g.font = `600 ${13 * sc}px Consolas, "Courier New", monospace`; g.shadowColor = "rgba(0,0,0,0.85)"; g.shadowBlur = 3; g.textBaseline = "middle";
    const cx = W / 2, cy = H / 2; assi(P.Q); const theta = Math.asin(clamp(_fwd.y, -1, 1)) * R2D, phi = Math.atan2(-_rt.y, _up.y), hdg = (Math.atan2(_fwd.x, -_fwd.z) * R2D + 360) % 360; const ck = S.cam === "cockpit";
    const ppd = H / camera.fov;
    if (ck && P.vivo) {
      // scala di beccheggio (ruota con il rollio) e indicatore di traiettoria (velocity vector)
      g.save(); g.beginPath(); g.rect(W * 0.18, H * 0.12, W * 0.64, H * 0.74); g.clip(); g.translate(cx, cy); g.rotate(-phi);
      for (let L = -90; L <= 90; L += 5) { const y = (theta - L) * ppd; if (Math.abs(y) > H * 0.45) continue; const w = L === 0 ? W * 0.32 : 62 * sc, gap = L === 0 ? 46 * sc : 26 * sc; g.setLineDash(L < 0 ? [7 * sc, 5 * sc] : []); g.beginPath(); g.moveTo(-w, y); g.lineTo(-gap, y); g.moveTo(gap, y); g.lineTo(w, y);
        if (L !== 0) { const tk = (L > 0 ? 1 : -1) * 8 * sc; g.moveTo(-w, y); g.lineTo(-w, y + tk); g.moveTo(w, y); g.lineTo(w, y + tk); } g.stroke(); if (L !== 0) { g.textAlign = "right"; g.fillText(Math.abs(L), -w - 4 * sc, y); g.textAlign = "left"; g.fillText(Math.abs(L), w + 4 * sc, y); } }
      g.setLineDash([]); g.restore();
      g.beginPath(); g.moveTo(cx - 14 * sc, cy); g.lineTo(cx - 5 * sc, cy); g.lineTo(cx, cy + 5 * sc); g.lineTo(cx + 5 * sc, cy); g.lineTo(cx + 14 * sc, cy); g.stroke();   // riferimento del muso (W)
    }
    if (P.vivo && P.V > 20) { const fp = proietta(V3().copy(P.pos).addScaledVector(P.vel, 3)); if (fp) { g.beginPath(); g.arc(fp.x, fp.y, 7 * sc, 0, 2 * Math.PI); g.moveTo(fp.x - 18 * sc, fp.y); g.lineTo(fp.x - 7 * sc, fp.y); g.moveTo(fp.x + 7 * sc, fp.y); g.lineTo(fp.x + 18 * sc, fp.y); g.moveTo(fp.x, fp.y - 7 * sc); g.lineTo(fp.x, fp.y - 15 * sc); g.stroke(); } }
    // nastro di prua
    g.save(); g.beginPath(); g.rect(cx - 150 * sc, 8 * sc, 300 * sc, 40 * sc); g.clip(); g.textAlign = "center"; for (let h = Math.floor(hdg / 5) * 5 - 30; h <= hdg + 30; h += 5) { const x = cx + (h - hdg) * 5 * sc; g.beginPath(); g.moveTo(x, 34 * sc); g.lineTo(x, (h % 10 ? 40 : 44) * sc); g.stroke(); if (h % 10 === 0) g.fillText(String(((h % 360) + 360) % 360 / 10 | 0).padStart(2, "0"), x, 24 * sc); } g.restore();
    g.beginPath(); g.moveTo(cx, 48 * sc); g.lineTo(cx - 5 * sc, 55 * sc); g.lineTo(cx + 5 * sc, 55 * sc); g.closePath(); g.fill();
    // velocità (KCAS) e quota (ft)
    const at = isa(P.pos.y); const kcas = P.V * Math.sqrt(at.rho / 1.225) * KT; const quota = P.pos.y * FT; const vs = P.vel.y * FT * 60;
    const box = (x, y, testo, al) => { g.strokeRect(x - 42 * sc, y - 13 * sc, 84 * sc, 26 * sc); g.textAlign = "center"; g.font = `700 ${16 * sc}px Consolas, monospace`; g.fillText(testo, x, y + 1); g.font = `600 ${13 * sc}px Consolas, monospace`; };
    const tch = ov.classList.contains("touch"); const xs = W * (tch ? 0.2 : 0.2), xa = W * (tch ? 0.72 : 0.8); box(xs, cy, Math.round(kcas)); box(xa, cy, Math.round(quota / 10) * 10);
    g.textAlign = "left"; g.fillText("KCAS", xs - 42 * sc, cy - 24 * sc); g.fillText(`M ${P.M.toFixed(2)}`, xs - 42 * sc, cy + 28 * sc); g.fillText(`G ${P.nz.toFixed(1)}`, xs - 42 * sc, cy + 46 * sc); g.fillText(`α ${(P.alpha * R2D).toFixed(0)}°`, xs - 42 * sc, cy + 64 * sc); g.fillText(`MAX ${P.gMax.toFixed(1)}`, xs - 42 * sc, cy + 82 * sc);
    g.textAlign = "right"; g.fillText("ALT ft", xa + 42 * sc, cy - 24 * sc); g.fillText(`${vs >= 0 ? "+" : ""}${Math.round(vs / 100) * 100} fpm`, xa + 42 * sc, cy + 28 * sc); if (P.agl * FT < 5000) g.fillText(`R ${Math.round(P.agl * FT / 10) * 10}`, xa + 42 * sc, cy + 46 * sc);
    const xLk = xa + 52 * sc;
    // stato velivolo (in basso a sinistra) e armi (in basso a destra)
    const yb = tch ? cy + 100 * sc : H - 70 * sc, ybR = tch ? cy + 64 * sc : H - 70 * sc; g.textAlign = "left"; const thrPct = Math.round(S.thr * 100);
    g.fillText(`THR ${thrPct}%${P.ab > 0.05 ? "  AB" : ""}`, xs - 42 * sc, yb); g.fillText(`FUEL ${(P.fuel / 1000).toFixed(2)} t`, xs - 42 * sc, yb + 18 * sc); g.fillText(`${P.carrello ? "GEAR DN" : "GEAR UP"}${S.in.freno ? " · BRK" : ""}`, xs - 42 * sc, yb + 36 * sc);
    g.textAlign = "right"; const w = ARMI[S.arma]; g.fillText(S.arma === "GUN" ? `GUN ${P.colpi}` : `${w.sigla} ×${P.armi[S.arma] || 0}`, xa + 42 * sc, ybR); g.fillText(`FLR ${P.flare}  CHF ${P.chaff}`, xa + 42 * sc, ybR + 18 * sc);
    if (!tch) g.fillText(Object.keys(P.armi).filter(k => P.armi[k] > 0).map(k => `${ARMI[k].sigla.replace("AIM-", "").replace("AGM-", "")}:${P.armi[k]}`).join(" "), xa + 42 * sc, ybR + 36 * sc);
    // contatti e bersaglio agganciato
    const pool = w.bersaglio === "terra" ? S.terra : S.nemici; const rmaxVis = w.bersaglio === "terra" ? 30000 : 80000;
    pool.forEach(t => { if (!t.vivo) return; const d = t.pos.distanceTo(P.pos); if (d > rmaxVis) return; const s = proietta(t.pos); if (!s || s.x < 0 || s.x > W || s.y < 0 || s.y > H) return; const lk = S.lock && S.lock.t === t;
      g.strokeStyle = lk ? (S.lock.ok ? verde : "#ffe066") : "rgba(93,255,143,0.75)"; const r = (lk ? 16 : 9) * sc; if (lk) { g.lineWidth = 2.2 * sc; g.strokeRect(s.x - r, s.y - r, 2 * r, 2 * r); if (S.lock.ok) { g.beginPath(); g.moveTo(s.x, s.y - r - 6 * sc); g.lineTo(s.x + r + 6 * sc, s.y); g.lineTo(s.x, s.y + r + 6 * sc); g.lineTo(s.x - r - 6 * sc, s.y); g.closePath(); g.stroke(); } g.lineWidth = 1.6 * sc; }
      else { g.beginPath(); g.moveTo(s.x, s.y - r); g.lineTo(s.x + r, s.y); g.lineTo(s.x, s.y + r); g.lineTo(s.x - r, s.y); g.closePath(); g.stroke(); }
      g.textAlign = "left"; g.fillStyle = g.strokeStyle; g.fillText(`${(d / 1000).toFixed(1)}`, s.x + r + 4 * sc, s.y - r); if (lk) g.fillText(t.nome, s.x + r + 4 * sc, s.y + r); g.fillStyle = verde; g.strokeStyle = verde; });
    if (S.lock) { const t = S.lock.t; const s = proietta(t.pos); if (!s || s.x < 0 || s.x > W || s.y < 0 || s.y > H) { const v = V3().subVectors(t.pos, camera.position).applyQuaternion(camera.quaternion.clone().invert()); const ang = Math.atan2(-v.y, v.x); g.save(); g.translate(cx + Math.cos(ang) * H * 0.3, cy + Math.sin(ang) * H * 0.3); g.rotate(ang); g.beginPath(); g.moveTo(16 * sc, 0); g.lineTo(-6 * sc, -9 * sc); g.lineTo(-6 * sc, 9 * sc); g.closePath(); g.fill(); g.restore(); }
      const z = dlz(S.arma, S.lock.r, S.lock.vc); g.textAlign = "left"; const xi = xLk; g.fillText(`${(S.lock.r / 1000).toFixed(1)} km`, xi, cy - 70 * sc); g.fillText(`Vc ${Math.round((S.lock.vc || 0) * KT)}`, xi, cy - 52 * sc);
      if (S.arma !== "GUN") { const top = cy - 30 * sc, hgt = 120 * sc, scala = hgt / Math.max(z.rmax * 1.3, 1); g.strokeRect(xi, top, 6 * sc, hgt); const yR = top + hgt - Math.min(hgt, S.lock.r * scala); g.beginPath(); g.moveTo(xi + 8 * sc, yR); g.lineTo(xi + 16 * sc, yR - 5 * sc); g.lineTo(xi + 16 * sc, yR + 5 * sc); g.closePath(); g.fill();
        [z.rmax, z.rmin].forEach(v => { const y = top + hgt - v * scala; g.beginPath(); g.moveTo(xi - 4 * sc, y); g.lineTo(xi + 10 * sc, y); g.stroke(); });
        if (S.lock.ok && S.lock.r < z.rmax && S.lock.r > z.rmin && (S.t * 3 | 0) % 2 === 0) { g.font = `700 ${20 * sc}px Consolas, monospace`; g.textAlign = "center"; g.fillText("SHOOT", cx, cy + H * 0.22); g.font = `600 ${13 * sc}px Consolas, monospace`; } } }
    // mirino del cannone a calcolo d'anticipo: punto d'impatto alla distanza del bersaglio (o 1000 m)
    if (S.arma === "GUN" && P.vivo) { const R = S.lock ? clamp(S.lock.r, 300, 2500) : 1000; const tf = R / 1050; assi(P.Q); const pi = V3().copy(P.pos).addScaledVector(P.vel, tf).addScaledVector(_fwd, 1050 * tf); pi.y -= 0.5 * G * tf * tf; const s = proietta(pi); if (s) { g.beginPath(); g.arc(s.x, s.y, 22 * sc, 0, 2 * Math.PI); g.stroke(); g.beginPath(); g.arc(s.x, s.y, 2 * sc, 0, 2 * Math.PI); g.fill(); g.beginPath(); g.arc(s.x, s.y, 27 * sc, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * clamp(R / 2500, 0, 1)); g.stroke(); } }
    if (S.arma === "AIM9X" && P.vivo) { const s = S.lock ? proietta(S.lock.t.pos) : { x: cx, y: cy }; if (s) { g.beginPath(); g.arc(s.x, s.y, 30 * sc, 0, 2 * Math.PI); g.stroke(); } }
    // avvisi
    const avv = []; if (P.vivo && !P.aTerra && P.vel.y < -5 && P.agl / -P.vel.y < 5 && !P.carrello) avv.push(["PULL UP", rosso]); if (P.vivo && !P.aTerra && (P.alpha > P.A.astall * 0.92 * D2R || (P.V < 75 && P.agl > 30))) avv.push(["STALL", rosso]);
    if (P.fuel < P.A.fuel * 0.15) avv.push([P.fuel <= 0 ? "FUEL OUT" : "BINGO FUEL", "#ffb04d"]);
    const inc = S.missili.filter(m => m.vivo && m.target === P && !m.perso); if (inc.length) avv.push(["MISSILE", rosso]); else if (S.nemici.some(e => e.vivo && e.illumina) || S.terra.some(t => t.vivo && t.illumina)) avv.push(["RADAR LOCK", "#ffb04d"]);
    g.textAlign = "center"; avv.forEach(([t, c], i) => { if ((S.t * 4 | 0) % 2 && c === rosso) return; g.fillStyle = c; g.font = `800 ${22 * sc}px Consolas, monospace`; g.fillText(t, cx, H * 0.3 + i * 28 * sc); }); g.fillStyle = verde; g.font = `600 ${13 * sc}px Consolas, monospace`;
    inc.forEach(m => { const v = V3().subVectors(m.pos, P.pos).applyQuaternion(camera.quaternion.clone().invert()); const ang = Math.atan2(v.z, v.x); g.save(); g.translate(cx, cy); g.rotate(ang + Math.PI / 2); g.fillStyle = rosso; g.beginPath(); g.moveTo(0, -H * 0.36); g.lineTo(-10 * sc, -H * 0.36 + 18 * sc); g.lineTo(10 * sc, -H * 0.36 + 18 * sc); g.closePath(); g.fill(); g.restore(); });
    // messaggio centrale
    if (S.msg && S.t < S.msg.fine) { g.textAlign = "center"; g.font = `800 ${(S.msg.cls === "call" ? 26 : 19) * sc}px Consolas, monospace`; g.fillStyle = S.msg.cls === "warn" ? "#ffb04d" : verde; g.fillText(S.msg.t, cx, H * 0.24); g.fillStyle = verde; g.font = `600 ${13 * sc}px Consolas, monospace`; }
    // radar (in alto a destra, prua in alto, 40 km)
    const rr = 62 * sc, rx = W - rr - 14 * sc, ry = rr + 60 * sc; g.save(); g.fillStyle = "rgba(0,20,8,0.45)"; g.beginPath(); g.arc(rx, ry, rr, 0, 2 * Math.PI); g.fill(); g.stroke(); g.beginPath(); g.arc(rx, ry, rr / 2, 0, 2 * Math.PI); g.stroke(); g.fillStyle = verde;
    const plot = (pos, col, forma) => { const dx = pos.x - P.pos.x, dz = pos.z - P.pos.z; const h = hdg * D2R; const xr = dx * Math.cos(h) + dz * Math.sin(h), yr = -(-dx * Math.sin(h) + dz * Math.cos(h)); const k = rr / 40000; let px = xr * k, py = -yr * k; const l = Math.hypot(px, py); if (l > rr) { px *= rr / l; py *= rr / l; } g.fillStyle = col; if (forma === "q") g.fillRect(rx + px - 3 * sc, ry + py - 3 * sc, 6 * sc, 6 * sc); else { g.beginPath(); g.arc(rx + px, ry + py, (forma === "p" ? 1.6 : 3.2) * sc, 0, 2 * Math.PI); g.fill(); } };
    S.terra.forEach(t => t.vivo && plot(t.pos, t.sotto === "sam" ? "#ff7a7a" : "#ffb04d", "q")); S.nemici.forEach(e => e.vivo && plot(e.pos, rosso)); S.missili.forEach(m => plot(m.pos, "#ffffff", "p")); if (S.pista) plot({ x: S.pista.x, z: S.pista.z }, "#6fb6ff", "q");
    g.fillStyle = verde; g.beginPath(); g.moveTo(rx, ry - 6 * sc); g.lineTo(rx - 4 * sc, ry + 5 * sc); g.lineTo(rx + 4 * sc, ry + 5 * sc); g.closePath(); g.fill(); g.textAlign = "center"; g.fillText("40 km", rx, ry + rr + 10 * sc); g.restore();
    // punteggio
    g.textAlign = "left"; const viviN = S.nemici.filter(e => e.vivo).length; g.fillText(`BANDIT ${viviN} · KILL ${S.stats.kill} · TGT ${S.stats.terra} · ${S.stats.punti} pt${TERRA.caricate < TERRA.totale ? ` · terreno ${TERRA.caricate}/${TERRA.totale}` : ""}`, 12, 14 * sc);
    g.restore();
  }

  /* ---------- ciclo principale ---------- */
  function animate() {
    raf = requestAnimationFrame(animate); if (!S) return; const dtR = Math.min(0.05, clock.getDelta());
    aggiorna(dtR); renderer.render(scene, camera); disegnaHud(); audioFrame(); aggiornaUi();
  }
  function aggiorna(dtR) {
    if (!S.pausa && !S.fine) { leggiComandi(dtR); if (TEST.in) { Object.assign(S.in, TEST.in); if (TEST.in.thr != null) S.thr = TEST.in.thr; } const n = Math.max(1, Math.ceil(dtR / (1 / 120))); const dt = dtR / n;
      for (let i = 0; i < n; i++) { fisica(dt); aggiornaMissili(dt); }
      S.t += dtR; aggiornaNemici(dtR); aggiornaLock(dtR); aggiornaCannone(dtR); aggiornaFlare(dtR); S.cmT = (S.cmT || 0) - dtR; if ((TOUCH.flare || KEYS.c) && S.cmT <= 0) contromisure();
      S.rwrT = (S.rwrT || 0) - dtR; if (S.rwrT <= 0 && S.pl.vivo) { if (S.missili.some(m => m.vivo && m.target === S.pl && !m.perso)) { suono("missile"); S.rwrT = 0.6; } else if (S.nemici.some(e => e.vivo && e.illumina) || S.terra.some(t => t.vivo && t.illumina)) { suono("rwr"); S.rwrT = 2.5; } }
      const P = S.pl; if (P.vivo && !P.aTerra && P.vel.y < -5 && P.agl / -P.vel.y < 5 && !P.carrello && (S.puT = (S.puT || 0) - dtR) <= 0) { S.puT = 1.2; suono("pullup"); }
      if (P.vivo && P.fuel < P.A.fuel * 0.15 && !S.bingoDetto) { S.bingoDetto = true; voce("bingo fuel"); }
      if (P.obj && P.vivo) { P.obj.position.copy(P.pos); P.obj.quaternion.copy(P.Q); const md = P.obj.userData.mdl; if (md && md.userData.anim) md.userData.anim({ rollRate: P.p * R2D, pitchRate: P.q * R2D, yawRate: P.r * R2D, afterburner: P.ab, t: S.t }); }
      if (P.vivo && P.ab > 0.3 && S.cam !== "cockpit" && (S.abT = (S.abT || 0) - dtR) <= 0) { S.abT = 0.05; assi(P.Q); emetti(V3().copy(P.pos).addScaledVector(_fwd, -9), { luce: true, col: 0xff9a3c, vita: 0.15, s0: 3, s1: 1.5, a0: 0.8 }); }
      S.incendi.forEach(f => { f.t -= dtR; if ((f.e = (f.e || 0) - dtR) <= 0 && f.t > 0) { f.e = 0.25; emetti(f.pos, { col: 0x2b2725, vel: V3(4, 18, 0), vita: 6, s0: 25, s1: 120, a0: 0.6, su: 4, drag: 0.1 }); emetti(f.pos, { luce: true, col: 0xff7a1a, vita: 0.6, s0: 20, s1: 30, a0: 0.8 }); } }); S.incendi = S.incendi.filter(f => f.t > 0);
      if (S.oggettiSporchi && (S.posT = (S.posT || 0) - dtR) <= 0) { S.posT = 1; S.oggettiSporchi = false; posizionaTerra(); }
    }
    aggiornaParticelle(S.pausa ? 0 : dtR); aggiornaCamera(dtR); if (S.cupola) S.cupola.position.copy(camera.position); if (S.sole && S.sunDir) S.sole.position.copy(camera.position).addScaledVector(S.sunDir, 1.2e6);
  }
  /* collaudo: fa avanzare la simulazione a passo fisso senza disegnare (pannello nascosto, prove automatiche) */
  const TEST = { in: null };
  function simula(sec, inp, ogni) { if (!S) return null; TEST.in = inp || null; const log = []; const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { aggiorna(1 / 60); if (ogni && i % Math.round(ogni * 60) === 0) log.push(fotografia()); if (!S || S.fine) break; } TEST.in = null; if (S) { renderer.render(scene, camera); disegnaHud(); } return log; }
  function fotografia() { if (!S) return null; const P = S.pl; assi(P.Q); return { t: +S.t.toFixed(1), kt: Math.round(P.V * KT), ft: Math.round(P.pos.y * FT), agl: Math.round((P.agl || 0) * FT), g: +P.nz.toFixed(2), a: +(P.alpha * R2D).toFixed(1), M: +(P.M || 0).toFixed(2), pitch: +(Math.asin(clamp(_fwd.y, -1, 1)) * R2D).toFixed(1), roll: +(Math.atan2(-_rt.y, _up.y) * R2D).toFixed(0), hdg: Math.round((Math.atan2(_fwd.x, -_fwd.z) * R2D + 360) % 360), fuel: Math.round(P.fuel), terra: P.aTerra, vivo: P.vivo }; }
  function aggiornaUi() { if (!S) return; aggiornaNvg(); const liv = ov.querySelector("#vl-manetta-liv"); liv.style.height = (S.thr * 100) + "%"; liv.classList.toggle("ab", S.thr > 0.8); ov.querySelector("#vl-carrello").classList.toggle("on", S.pl.carrello); ov.querySelector("#vl-arma").textContent = ARMI[S.arma].sigla; ov.querySelector("#vl-lock").classList.toggle("on", !!(S.lock && S.lock.ok)); }
  function carrello() { if (!S || !S.pl.vivo) return; const P = S.pl; if (P.aTerra) { messaggio("A TERRA: CARRELLO BLOCCATO", 1.2, "warn"); return; } if (!P.carrello && P.V * KT > 300) { messaggio("TROPPO VELOCE PER IL CARRELLO (max 300 kt)", 1.5, "warn"); return; } P.carrello = !P.carrello; suono("click"); messaggio(P.carrello ? "GEAR DOWN" : "GEAR UP", 1.2); }

  /* ---------- schermate: menu iniziale, pausa/istruzioni, fine ---------- */
  function istruzioniHtml() {
    return `<div class="vl-istr">
      <div><h4>📱 Touch (telefono in orizzontale)</h4><ul>
        <li><b>Cloche</b>: appoggia il pollice a sinistra e trascina. Indietro (giù) cabra, avanti (su) picchia, di lato rolla. Lasciata al centro, il fly-by-wire mantiene la traiettoria e compensa la virata fino a 60° di inclinazione; oltre devi tirare tu.</li>
        <li><b>Manetta</b>: la barra a destra. Sopra l'80% entra il <b>postbruciatore</b> (AB): più spinta, molto più carburante.</li>
        <li><b>LOCK</b> aggancia il contatto più vicino al centro del HUD; premilo di nuovo per passare al successivo.</li>
        <li><b>FUOCO</b> lancia il missile agganciato; con il <b>GUN</b> tieni premuto per sparare.</li>
        <li><b>ARMA</b> cambia arma: AIM-120 (radar, lungo raggio), AIM-9X (infrarosso, corto raggio), GUN, AGM-65 (aria-suolo).</li>
        <li><b>FLARE</b> lancia flare e chaff: usali quando senti "MISSILE".</li>
        <li><b>PED</b> pedaliere (timone), <b>FRENO</b> aerofreno in volo / freni ruote a terra, <b>GEAR</b> carrello, <b>🎥</b> cockpit / esterna / missile.</li>
        <li><b>NVG</b> (in alto, o tasto <b>N</b>): visore notturno. Si vede dal cockpit: immagine verde intensificata, grana del tubo e campo visivo circolare. Nella missione notturna senza visore si vedono solo luci di città, piste e luci di navigazione.</li></ul></div>
      <div><h4>⌨ Tastiera</h4><ul><li><b>↑ ↓ ← →</b> o <b>W S A D</b>: cloche (↑ picchia, ↓ cabra) · <b>Q E</b>: timone</li><li><b>Shift / Ctrl</b> (o R / F): manetta · <b>Spazio</b>: fuoco · <b>T</b>: lock · <b>X</b>: arma · <b>C</b>: flare</li><li><b>G</b>: carrello · <b>B</b>: freno · <b>V</b>: camera · <b>N</b>: visore NVG · <b>P</b> o <b>Esc</b>: pausa · <b>H</b>: aiuto</li></ul>
        <h4>🎮 Gamepad</h4><ul><li>Stick sinistro: cloche · grilletti: manetta · dorsali: timone · A: fuoco · Y: lock · X: arma · B: flare · Select: camera · Start: pausa</li></ul>
        <h4>🧭 Come si combatte</h4><ul><li>Il <b>diamante</b> è un contatto; il <b>quadrato</b> è il bersaglio scelto, diventa verde con il lock. A destra la barra <b>DLZ</b>: spara quando il triangolo è tra i due segni e compare <b>SHOOT</b>.</li>
        <li>Il cerchio con il punto è il <b>velocity vector</b>: dove sta andando davvero l'aereo. A forte incidenza è sotto il muso.</li>
        <li>Missile in arrivo: <b>FLARE</b>, poi vira forte mettendo il missile sul fianco (<b>notch</b>) e scendi: il radar lo perde, l'energia del missile finisce.</li>
        <li>Energia: le virate a 9 G fanno perdere velocità in fretta; sotto i 300 kt l'aereo gira meno. Usa il postbruciatore per recuperare.</li>
        <li>Atterraggio: carrello giù sotto i 300 kt, pista allineata, discesa sotto 4,5 m/s, muso leggermente alto.</li></ul></div></div>`;
  }
  function menuIniziale() {
    const p = pref(); const m = ov.querySelector("#vl-menu"); S && (S.menu = true);
    const opt = (k, vals) => vals.map(([v, t]) => `<button class="vl-opt ${String(p[k]) === String(v) ? "on" : ""}" data-k="${k}" data-v="${v}">${t}</button>`).join("");
    m.innerHTML = `<div class="vl-card"><div class="vl-titolo"><span>🕹</span><div><h2>FREE FLIGHT</h2><small>Volo libero sulla carta reale della missione · fisica e armi realistiche</small></div></div>
      <div class="vl-grid">
        <div><h4>Velivolo</h4><div class="vl-opts">${opt("aereo", Object.keys(AEREI).map(k => [k, AEREI[k].nome]))}</div>
          <h4>Partenza</h4><div class="vl-opts">${opt("partenza", [["volo", "In volo · 20.000 ft"], ["pista", "Sulla pista di Taccola"]])}</div>
          <h4>Missione</h4><div class="vl-opts">${opt("ora", [["giorno", "☀ Giorno"], ["notte", "🌙 Notte · visore NVG"]])}</div>
          <h4>Avversari</h4><div class="vl-opts">${opt("nemici", [[0, "Nessuno"], [1, "1"], [2, "2"], [4, "4"], [6, "6"]])}</div>
          <h4>Difficoltà</h4><div class="vl-opts">${opt("diff", Object.keys(DIFF).map(k => [k, DIFF[k].nome]))}</div>
          <h4>Opzioni</h4><div class="vl-opts">${opt("sam", [[true, "SA-10 attivi"], [false, "SA-10 spenti"]])}${opt("comandi", [["touch", "Cloche touch"], ["tilt", "Inclina il telefono"]])}${opt("inverti", [[false, "Giù = cabra"], [true, "Su = cabra"]])}${opt("audio", [[true, "Audio sì"], [false, "Audio no"]])}</div>
          <div class="vl-carico" id="vl-carico"></div></div>
        <div>${istruzioniHtml()}</div></div>
      <div class="vl-azioni"><button class="vl-go" id="vl-go">DECOLLA ▶</button><button class="vl-sec" id="vl-indietro">Torna al simulatore</button></div></div>`;
    const carico = () => { const A = AEREI[p.aereo]; m.querySelector("#vl-carico").innerHTML = `<b>${A.nome}</b> · ${Object.keys(A.carico).filter(k => A.carico[k]).map(k => `${A.carico[k]}× ${ARMI[k].sigla}`).join(" · ")} · ${A.cannone} (${A.colpi} colpi) · spinta/peso ${(A.Tab / (A.m * G)).toFixed(2)} · ${A.gmax} G`; };
    m.querySelectorAll(".vl-opt").forEach(b => b.onclick = () => { const k = b.dataset.k; let v = b.dataset.v; if (v === "true") v = true; else if (v === "false") v = false; else if (k === "nemici") v = +v; p[k] = v; salvaPref(p); m.querySelectorAll(`.vl-opt[data-k="${k}"]`).forEach(x => x.classList.toggle("on", x === b)); carico(); });
    carico(); m.querySelector("#vl-indietro").onclick = () => chiudi();
    m.querySelector("#vl-go").onclick = () => { schermoPieno(); audioInit(); if (AU && AU.ctx.state === "suspended") AU.ctx.resume(); if (p.comandi === "tilt") attivaTilt(); else TILT.on = false; m.classList.add("hidden"); avvia(p); };
    m.classList.remove("hidden");
  }
  function schermoPieno() { if (!mobile()) return; const el = document.documentElement; try { const r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : null; if (r && r.then) r.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {}); }).catch(() => {}); } catch (e) {} }
  function pausa(on, aiuto) {
    if (!S || S.fine) return; S.pausa = on; const m = ov.querySelector("#vl-menu");
    if (!on) { m.classList.add("hidden"); S.menu = false; clock.getDelta(); return; } S.menu = true;
    m.innerHTML = `<div class="vl-card"><div class="vl-titolo"><span>⏸</span><div><h2>PAUSA</h2><small>${S.pl.A.nome} · ${S.stats.kill} abbattimenti · ${S.stats.terra} bersagli a terra · ${S.stats.punti} punti</small></div></div>
      ${aiuto ? istruzioniHtml() : ""}<div class="vl-azioni"><button class="vl-go" id="vl-riprendi">RIPRENDI ▶</button><button class="vl-sec" id="vl-ondata">Nuova ondata di avversari</button><button class="vl-sec" id="vl-aiuto2">Istruzioni</button><button class="vl-sec" id="vl-ricomincia">Ricomincia</button><button class="vl-sec" id="vl-menu-i">Cambia velivolo / opzioni</button><button class="vl-sec" id="vl-esci2">Esci</button></div></div>`;
    m.classList.remove("hidden");
    m.querySelector("#vl-riprendi").onclick = () => pausa(false); m.querySelector("#vl-aiuto2").onclick = () => pausa(true, true);
    m.querySelector("#vl-ondata").onclick = () => { creaNemici(Math.max(2, S.cfg.nemici || 2)); S.ondataFinita = false; pausa(false); messaggio("NUOVA ONDATA IN ARRIVO", 2.5, "warn"); };
    m.querySelector("#vl-ricomincia").onclick = () => { m.classList.add("hidden"); avvia(S.cfg); }; m.querySelector("#vl-menu-i").onclick = () => { distruggiScena(); menuIniziale(); }; m.querySelector("#vl-esci2").onclick = () => chiudi();
  }
  function fineMissione(titolo, motivo) {
    if (!S || S.fine) return; S.fine = true; if (titolo === "ABBATTUTO") voce("you are hit"); setTimeout(() => { if (!S) return; S.pausa = true; const m = ov.querySelector("#vl-menu"); S.menu = true; const st = S.stats; const minuti = (S.t / 60).toFixed(1);
      m.innerHTML = `<div class="vl-card"><div class="vl-titolo"><span>${titolo === "SCHIANTO" ? "💥" : "🎯"}</span><div><h2>${titolo}</h2><small>${motivo}</small></div></div>
        <table class="vl-tab"><tr><td>Tempo di volo</td><td>${minuti} min</td></tr><tr><td>Abbattimenti</td><td>${st.kill}</td></tr><tr><td>Bersagli a terra</td><td>${st.terra}</td></tr><tr><td>Missili lanciati</td><td>${st.lanci}</td></tr><tr><td>Colpi di cannone a segno</td><td>${st.colpi}</td></tr><tr><td>G massimi</td><td>${S.pl.gMax.toFixed(1)}</td></tr><tr><td><b>Punti</b></td><td><b>${st.punti}</b></td></tr></table>
        <div class="vl-azioni"><button class="vl-go" id="vl-ancora">VOLA ANCORA ▶</button><button class="vl-sec" id="vl-menu-f">Cambia velivolo / opzioni</button><button class="vl-sec" id="vl-esci3">Esci</button></div></div>`;
      m.classList.remove("hidden"); m.querySelector("#vl-ancora").onclick = () => { m.classList.add("hidden"); avvia(S.cfg); }; m.querySelector("#vl-menu-f").onclick = () => { distruggiScena(); menuIniziale(); }; m.querySelector("#vl-esci3").onclick = () => chiudi(); }, 2800);
  }

  /* ---------- avvio / chiusura ---------- */
  function distruggiScena() { if (scene) scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); scene = null; S = null; }
  function avvia(cfg) {
    distruggiScena(); ov.querySelector("#vl-menu").classList.add("hidden"); if (!renderer) { renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile(), powerPreference: "high-performance", logarithmicDepthBuffer: true }); if (THREE.sRGBEncoding !== undefined && renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile() ? 1 : 1.5)); scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 3e6); ridimensiona();
    S = { cfg: Object.assign({}, cfg), diff: DIFF[cfg.diff] || DIFF.veterano, t: 0, pl: { pos: V3(), vel: V3(), Q: new THREE.Quaternion(), tipo: "aria", raggio: 10, vivo: true }, nemici: [], missili: [], proiettili: [], flares: [], incendi: [], terra: [], arma: "AIM120", lock: null, cam: "cockpit", thr: 0.6, in: { sx: 0, sy: 0, rud: 0 }, stats: { kill: 0, terra: 0, lanci: 0, colpi: 0, punti: 0 }, pausa: false, fine: false, menu: false };
    const root = new THREE.Group(); scene.add(root); pista(root); partenza(); cielo(); terreno(root); bersagliTerra(root); particelle(); if (cfg.ora === "notte") luciCitta(root); creaGiocatore(); creaNemici(cfg.nemici || 0);
    const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(600 * 3), 3)); S.traccianti = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 })); S.traccianti.frustumCulled = false; scene.add(S.traccianti);
    if (!(S.pl.armi.AIM120 > 0)) S.arma = S.pl.armi.AIM9X > 0 ? "AIM9X" : "GUN";
    ov.classList.toggle("touch", mobile()); clock = new THREE.Clock(); cancelAnimationFrame(raf); animate();
    // in pista si aspetta la quota del terreno sotto la pista (o al massimo 8 s) prima di dare il controllo
    if (cfg.partenza === "pista") { S.pausa = true; const t0 = performance.now(); const attendi = () => { if (!S) return; if (TERRA.ready || performance.now() - t0 > 8000) { posizionaTerra(); const P = S.pl; P.pos.y = S.pista.y + 2.2; S.pausa = false; messaggio("PISTA " + Math.round(S.pista.hdg / 10) + " · manetta avanti, ruota a 150 kt", 4); } else setTimeout(attendi, 300); }; attendi(); }
    else messaggio(cfg.ora === "notte" ? "NOTTE · NVG: tasto N" : "FIGHTS ON · LOCK e FUOCO", 4);
    S.nvg = false;
  }
  function apri() {
    if (typeof THREE === "undefined" || typeof VISTA3D === "undefined") { toast("Il Free Flight richiede la grafica 3D (Three.js)"); return; }
    dom(); if (typeof APP !== "undefined" && APP.play) APP.play(false); ov.classList.remove("hidden"); document.body.classList.add("volo-aperto"); ridimensiona(); menuIniziale();
  }
  function chiudi() { if (!ov) return; cancelAnimationFrame(raf); raf = 0; distruggiScena(); TILT.on = false; if (AU) { try { AU.gm.gain.value = 0; AU.gt.gain.value = 0; } catch (e) {} } ov.classList.add("hidden"); document.body.classList.remove("volo-aperto"); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {} }
  return { apri, chiudi, AEREI, ARMI, simula, fotografia, avvia: c => avvia(Object.assign(pref(), c || {})), fuoco: () => fuocoPremuto(), lock: () => blocca(), arma: a => { if (S) { S.arma = a; S.lock = null; } }, flare: () => contromisure(), carrello: () => carrello(), get attivo() { return attivo(); }, get stato() { return S; }, get debug() { return S && { t: S.t, V: S.pl.V, kt: S.pl.V * KT, alt: S.pl.pos.y, agl: S.pl.agl, nz: S.pl.nz, alpha: S.pl.alpha * R2D, M: S.pl.M, fuel: S.pl.fuel, aTerra: S.pl.aTerra, vivo: S.pl.vivo, nemici: S.nemici.map(e => ({ id: e.id, vivo: e.vivo, dist: Math.round(e.dist || 0), stato: e.stato })), missili: S.missili.length, terreno: TERRA.caricate + "/" + TERRA.totale, lock: S.lock && { t: S.lock.t.id, ok: S.lock.ok, r: Math.round(S.lock.r || 0) }, arma: S.arma, stats: S.stats }; } };
})();
