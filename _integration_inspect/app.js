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
    MAPPA.init(A.sc); A.engine = new Engine(A.sc); A.engine.on(onEvento);
    $$(".role-btn").forEach(b => b.onclick = () => { setRuolo(b.dataset.role); $("#splash").classList.add("hidden"); $("#app").classList.remove("hidden"); setTimeout(() => { MAPPA.map.invalidateSize(); MAPPA.fitScenario(); vaiFase("briefing"); }, 50); });
    $("#btn-demo-splash").onclick = () => { $("#splash").classList.add("hidden"); $("#app").classList.remove("hidden"); setTimeout(() => { MAPPA.map.invalidateSize(); MAPPA.fitScenario(); DEMO.avvia(); }, 50); };
    $("#btn-tour-splash").onclick = () => { setRuolo("TRAINER"); $("#splash").classList.add("hidden"); $("#app").classList.remove("hidden"); setTimeout(() => { MAPPA.map.invalidateSize(); MAPPA.fitScenario(); vaiFase("briefing"); UI.tour(0); }, 50); };
    $$("#fasi button").forEach(b => b.onclick = () => vaiFase(b.dataset.fase));
    try { if (typeof AUDIO !== "undefined") { AUDIO.init(); AUDIO.badge(); const ba = $("#btn-audio"); if (ba) ba.onclick = () => AUDIO.pannello(); } } catch (e) { console.warn("audio non disponibile", e); }
    // app installabile (PWA): service worker per l'uso offline + pulsante "Installa" quando il browser lo permette
    if ("serviceWorker" in navigator && (location.protocol === "https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) { navigator.serviceWorker.register("sw.js").catch(e => console.warn("service worker", e)); }
    window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); A._installa = e; const b = $("#btn-installa"); if (b) { b.classList.remove("hidden"); b.onclick = () => { b.classList.add("hidden"); e.prompt(); }; } });
    // Pannelli mobile: backdrop, chiusura accessibile e controlli dimensionati per il touch.
    const bp = $("#btn-pannello"), bl = $("#btn-log"), backdrop = $("#drawer-backdrop");
    function chiudiPannelli() { $("#left").classList.remove("open"); $("#right").classList.remove("open"); backdrop.classList.add("hidden"); bp.setAttribute("aria-expanded", "false"); bl.setAttribute("aria-expanded", "false"); }
    function apriPannello(which) { const el = $(which); const wasOpen = el.classList.contains("open"); chiudiPannelli(); if (!wasOpen && matchMedia("(max-width: 900px)").matches) { el.classList.add("open"); backdrop.classList.remove("hidden"); (which === "#left" ? bp : bl).setAttribute("aria-expanded", "true"); } }
    bp.onclick = () => apriPannello("#left"); bl.onclick = () => apriPannello("#right");
    $("#btn-close-left").onclick = chiudiPannelli; $("#btn-close-right").onclick = chiudiPannelli;
    backdrop.onclick = chiudiPannelli;
    $("#map").addEventListener("pointerdown", chiudiPannelli);
    const toolsButton = $("#btn-maptools"), tools = $("#map-tools");
    function setTools(open) { tools.classList.toggle("open", open); toolsButton.setAttribute("aria-expanded", String(open)); toolsButton.textContent = open ? "✕ Chiudi livelli" : "☷ Livelli"; }
    toolsButton.onclick = () => setTools(!tools.classList.contains("open"));
    $("#map").addEventListener("pointerdown", () => setTools(false));
    window.addEventListener("resize", () => { if (innerWidth > 900) { chiudiPannelli(); setTools(false); } if (MAPPA.map) MAPPA.map.invalidateSize(); });
    $("#btn-demo").onclick = () => DEMO.avvia(); $("#btn-tour").onclick = () => UI.tour(0); $("#btn-ruolo").onclick = () => { play(false); $("#splash").classList.remove("hidden"); };
    $("#tour-next").onclick = UI.tourNext; $("#tour-prev").onclick = UI.tourPrev; $("#tour-end").onclick = UI.tourEnd; $("#modal-close").onclick = UI.chiudiModal;
    $("#btn-play").onclick = () => play(!A.playing); $("#btn-step").onclick = () => { play(false); for (let i = 0; i < 60 / A.engine.tick_sec; i++) A.engine.tick(); refresh(); };
    $("#btn-reset").onclick = () => { play(false); DEMO.stop(); ricostruisci(); UI.toast("Simulazione riportata alle " + A.sc.tempo.inizio); };
    $("#speeds").innerHTML = A.sc.tempo.velocita.map(v => `<button data-v="${v}" class="${v === A.speed ? "active" : ""}">×${v}</button>`).join("");
    $$("#speeds button").forEach(b => b.onclick = () => setSpeed(+b.dataset.v));
    $("#sel-base").value = A.sc.mappa.tile_default; $("#sel-base").onchange = e => MAPPA.setBase(e.target.value);
    $("#chk-sectional").checked = A.sc.mappa.sectional.attivo; $("#chk-sectional").onchange = e => MAPPA.toggle("sectional", e.target.checked); $("#rng-sectional").oninput = e => MAPPA.setSectionalOpacity(+e.target.value);
    $("#chk-griglia").onchange = e => MAPPA.toggle("griglia", e.target.checked); $("#chk-trails").onchange = e => MAPPA.toggle("trails", e.target.checked); $("#chk-radar").onchange = e => MAPPA.radarRings(A.engine.vista(A.ruolo), e.target.checked);
    $("#btn-ruler").onclick = () => { const on = !$("#btn-ruler").classList.toggle("active"); MAPPA.rulerToggle(!on); UI.toast(!on ? "Righello attivo: clicca due o più punti sulla mappa" : "Righello disattivato"); };
    $("#btn-fit").onclick = () => MAPPA.fitScenario(); $("#log-filter").onchange = () => UI.log();
    document.addEventListener("keydown", e => { if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return; if (e.code === "Space") { e.preventDefault(); play(!A.playing); } if (e.key === "Escape") { UI.chiudiModal(); UI.tourEnd(); chiudiPannelli(); setTools(false); } });
    $("#clock-sub").textContent = `Finestra ${A.sc.tempo.inizio} – ${A.sc.tempo.fine}`;
    DATAIO.serverDisponibile().then(ok => { $("#status-msg").textContent = ok ? "Server locale attivo: salvataggi in data/salvataggi" : "Modalità file: salvataggi nel browser + download"; if (typeof VISTA3D !== "undefined") VISTA3D.setProxyTile(ok); });
    refresh();
  }
  function setRuolo(r) { A.ruolo = r; const b = $("#role-badge"); b.textContent = r === "TRAINER" ? "TRAINER" : "SQUADRA " + r; b.className = r; if (A.fase) vaiFase(A.fase); }
  function vaiFase(f) {
    A.fase = f; if (typeof document !== "undefined") { const left = $("#left"), right = $("#right"); left.classList.remove("open"); right.classList.remove("open"); $("#drawer-backdrop").classList.add("hidden"); $("#btn-pannello").setAttribute("aria-expanded", "false"); $("#btn-log").setAttribute("aria-expanded", "false"); } $$("#fasi button").forEach(b => { b.classList.toggle("active", b.dataset.fase === f); });
    const ord = ["briefing", "piano", "esecuzione", "debrief"]; $$("#fasi button").forEach(b => b.classList.toggle("done", ord.indexOf(b.dataset.fase) !== -1 && ord.indexOf(b.dataset.fase) < ord.indexOf(f)));
    $("#left").classList.remove("wide"); UI.tourEnd();
    if (f !== "esecuzione" && f !== "debrief") { play(false); }
    ({ briefing: UI.briefing, piano: UI.piano, esecuzione: UI.esecuzione, debrief: UI.debrief, editor: UI.editor })[f]();
    if (f === "esecuzione" || f === "debrief") { MAPPA.disegnaSam(A.engine.vista(A.ruolo).sam, false); } else if (f === "briefing" || f === "editor") { UI.aggiornaRotteMappa(); MAPPA.disegnaRotte([]); }
    setTimeout(() => MAPPA.map.invalidateSize(), 30);
  }
  function salva() { DATAIO.salvaLocale(A.sc); }
  function ricostruisci() {
    play(false); salva(); MAPPA.reDraw(A.sc); MAPPA.pulisciDinamici(); A.engine = new Engine(A.sc); A.engine.on(onEvento); A.sel = null; A._hlOfferto = false;
    $("#clock-sub").textContent = `Finestra ${A.sc.tempo.inizio} – ${A.sc.tempo.fine}`; $("#log").innerHTML = ""; refresh(); if (A.fase) vaiFase(A.fase);
  }
  function setSpeed(v) { A.speed = v; $$("#speeds button").forEach(b => b.classList.toggle("active", +b.dataset.v === v)); if (A.playing) { play(false); play(true); } }
  function play(on) {
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
    const eraInPlay = A.playing; play(false);
    Object.assign(o, opts || {}); o.onFine = () => { if (eraInPlay && !A.engine.finita) play(true); if (opts && opts.onFine) opts.onFine(); };
    VISTA3D.apri(o);
  }
  function onEvento(ev) { if (ev.tipo !== "evento") return; UI.log(ev.e);
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
  return { get sc() { return A.sc; }, set sc(v) { A.sc = v; }, get engine() { return A.engine; }, get ruolo() { return A.ruolo; }, get fase() { return A.fase; }, get sel() { return A.sel; }, set sel(v) { A.sel = v; }, get noteDebrief() { return A.noteDebrief; }, set noteDebrief(v) { A.noteDebrief = v; }, get speed() { return A.speed; }, get playing() { return A.playing; }, get vista3dAuto() { return A.vista3dAuto; }, set vista3dAuto(v) { A.vista3dAuto = v; }, get meteoNoaa() { return A.meteoNoaa; }, set meteoNoaa(v) { A.meteoNoaa = v; }, apriVista3d, setRuolo, vaiFase, salva, ricostruisci, setSpeed, play, refresh, salvaPiano, caricaPiano };
})();
