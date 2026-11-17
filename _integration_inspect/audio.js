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
  function badge() { const b = document.getElementById("btn-audio"); if (b) b.innerHTML = (pref.on ? "🔊" : "🔇") + '<span class="lbl"> Audio</span>'; }
  return { init, evento, suono, radio, annuncio, pannello, badge, get pref() { return pref; }, get pronte() { return man && Object.keys(man.radio).length; } };
})();
