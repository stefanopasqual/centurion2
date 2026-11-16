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
