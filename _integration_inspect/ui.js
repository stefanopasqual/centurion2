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
        <td>${q.target && !isEA ? `<select data-k="target2" title="Secondo target: sul primo solo le GBU che servono, tutte le altre sul secondo">${opt(sc.target.filter(x => x.id !== q.target).map(x => ({ id: x.id, nome: "🎯 " + x.nome })), q.target2, "—")}</select>${q.target2 ? `<br><small>1º: solo le necessarie · 2º: il resto</small>` : ""}` : "—"}</td>
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
      const tPush = clock; let obiettivo = null, tot = null, tot2 = null;
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
        if (t2) { e = PHYS.eta(pos, t2, t.tas_attacco_kt, w); legs.push({ nome: "→ TGT2", da: clock, min: e.min, col: "#e67e22" }); clock += e.min * 60; tot2 = clock; legs.push({ nome: "TGT2", da: clock, min: sc.regole.tempo_sul_target_min, col: "#c0392b" }); clock += sc.regole.tempo_sul_target_min * 60; pos = t2; if ((t.armi.GBU48 || 0) < 2) warn.push("una sola GBU per velivolo: sul 2º target non resta nulla"); } }
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
      out.push({ f, q, legs, tAar, tPush, tot, tot2, fine: clock, margine, usati, errori, warn, tanker: tk.id, gIn: gIn.id, gOut: gOut.id, obiettivo: q.target ? obiettivo.nome : q.cap ? obiettivo.nome : q.stazione ? "Stazione EA" : "—" });
    });
    // conflitti AAR: stesso ordine sullo stesso tanker
    sc.aar.forEach(a => { const ords = righe.filter(r => r.tk.id === a.id).map(r => r.ord); ords.forEach((o, i) => { if (o !== 99 && ords.indexOf(o) !== i) out.forEach(r => { if (r.tanker === a.id && r.q.aar_ordine === o) r.warn.push(`ordine AAR ${o} duplicato su ${a.id}`); }); }); });
    // copertura GBU
    // copertura GBU come nel motore: attacchi in ordine di TOT, ognuno sgancia solo ciò che manca al target; il resto resta a bordo (e va al 2º target, se c'è)
    const gbuSuTarget = {}, gbuPortate = {}, manca = {}; sc.target.forEach(t => { manca[t.id] = t.gbu_richieste; gbuSuTarget[t.id] = 0; gbuPortate[t.id] = 0; });
    const bordo = new Map(out.map(r => [r, (sc.tipi[r.f.tipo].armi.GBU48 || 0) * r.f.numero])), att = [];
    out.forEach(r => { if (!r.q.target) return; r.sganci = []; att.push({ r, tg: r.q.target, t: r.tot || 0 }); if (r.q.target2 && r.q.target2 !== r.q.target && sc.target.some(x => x.id === r.q.target2)) att.push({ r, tg: r.q.target2, t: r.tot2 || r.tot || 0 }); });
    att.sort((a, b) => a.t - b.t).forEach(a => { if (manca[a.tg] == null) return; const b = bordo.get(a.r); const d = Math.min(b, Math.max(0, manca[a.tg])); gbuPortate[a.tg] += b; gbuSuTarget[a.tg] += d; manca[a.tg] -= d; bordo.set(a.r, b - d);
      const tn = (sc.target.find(x => x.id === a.tg) || {}).nome || a.tg; a.r.sganci.push({ tg: a.tg, n: d, bordo: b });
      if (b > 0 && d === 0) a.r.warn.push(`${tn}: già coperto da chi arriva prima → nessuno sgancio`); });
    out.forEach(r => { if (!r.sganci) return; r.info = r.sganci.map(s => `${(sc.target.find(x => x.id === s.tg) || {}).nome || s.tg}: sgancia ${s.n} di ${s.bordo} GBU`).concat(bordo.get(r) > 0 ? [`${bordo.get(r)} GBU tornano a casa`] : []); });
    return { out, gbuSuTarget, gbuPortate };
  }
  function verificaBlue(cont) {
    const sc = APP.sc; const { out, gbuSuTarget, gbuPortate } = analisiBlue(sc);
    if (!out.length) { cont.innerHTML = `<p class="muted">Inserisci almeno l'orario di decollo di una formazione per vedere la verifica.</p>`; return; }
    const t0 = Math.min(...out.map(r => r.legs[0].da)) - 300, t1 = Math.max(...out.map(r => r.fine)) + 300; const span = t1 - t0;
    let html = `<h3>Verifica automatica</h3><table><tr><th>Form.</th><th>AAR</th><th>Push</th><th>TOT</th><th>Fine</th><th>Carb.</th><th>Esito</th></tr>`;
    out.forEach(r => { const ok = !r.errori.length; html += `<tr><td><b>${r.f.callsign}</b></td><td>${Engine.s2hm(r.tAar)}<br><small>${r.tanker.replace("AAR_", "")}</small></td><td>${Engine.s2hm(r.tPush)}<br><small>${r.gIn.replace("GATE_", "")}</small></td><td>${r.tot ? Engine.s2hm(r.tot) : "-"}<br><small>${esc(r.obiettivo)}</small></td><td>${Engine.s2hm(r.fine)}</td><td>${fmtMin(r.usati)}<br><small>margine ${fmtMin(r.margine)}</small></td><td>${ok ? (r.warn.length ? `<span class="pill warn">ATTENZIONE</span>` : `<span class="pill ok">OK</span>`) : `<span class="pill bad">NO</span>`}<br><small>${[...r.errori, ...r.warn].map(esc).join("<br>")}</small>${r.info && r.info.length ? `<br><small class="muted">💣 ${r.info.map(esc).join(" · ")}</small>` : ""}</td></tr>`; });
    html += `</table><div class="gantt" style="margin-top:8px">`;
    out.forEach(r => { html += `<div class="g-row"><div class="g-lbl">${r.f.callsign}</div><div class="g-bar">${r.legs.map(l => `<div class="g-seg" style="left:${(l.da - t0) / span * 100}%;width:${l.min * 60 / span * 100}%;background:${l.col}" title="${l.nome} ${Engine.s2hm(l.da)} (${fmtMin(l.min)})">${l.nome}</div>`).join("")}</div></div>`; });
    const ticks = []; for (let s = Math.ceil(t0 / 1800) * 1800; s < t1; s += 1800) ticks.push(s);
    html += `<div class="g-axis">${ticks.map(s => `<span>${Engine.s2hm(s)}</span>`).join("")}</div></div>`;
    html += `<h3 style="margin-top:10px">Target assign</h3><p class="muted" style="margin:2px 0 6px">Su ogni target si sganciano solo le GBU richieste: chi arriva dopo sgancia solo ciò che manca, le altre restano a bordo.</p><table><tr><th>Target</th><th>Sganciate / richieste</th><th>A bordo all'arrivo</th><th></th></tr>${sc.target.map(t => { const g = gbuSuTarget[t.id] || 0, pt = gbuPortate[t.id] || 0; return `<tr><td>${esc(t.nome)}</td><td>${g}/${t.gbu_richieste} GBU</td><td>${pt}${pt > g ? ` <small>(${pt - g} restano a bordo)</small>` : ""}</td><td>${g >= t.gbu_richieste ? `<span class="pill ok">coperto</span>` : g > 0 ? `<span class="pill warn">parziale</span>` : `<span class="pill">non assegnato</span>`}</td></tr>`; }).join("")}</table>`;
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
      d.querySelectorAll("[data-cmd]").forEach(b => b.onclick = () => { if (b.disabled) return; if (b.dataset.cmd === "target") { const tt = eng.target.find(x => x.id === b.dataset.arg) || {}; const serve = Math.max(0, (tt.gbu_richieste || 0) - (tt.danni || 0) - (tt.prenotate || 0)), gb = eng.gbuTot(f);
          if (!confirm(`Target assign: ${f.callsign} → ${tt.nome}?\nA bordo ${gb} GBU, ne servono ${serve}: sgancerà ${Math.min(gb, serve)}${gb > serve ? ` e ne terrà ${gb - serve}` : ""}.\nLa formazione lascia la rotta attuale, attacca il nuovo target e rientra dal gate di uscita.`)) return; } eng.comando(f.id, b.dataset.cmd, b.dataset.arg); aggiornaEsecuzione(); });
      const bf = d.querySelector("#btn-m3d-follow"); if (bf) bf.onclick = () => MONDO3D.apri(f.id);
      const bp = d.querySelector("#btn-v3d-prev"); if (bp) bp.onclick = () => { const w = f.wps.find(x => x.azione === "attacco"); const t = eng.target.find(x => x.id === w.target); const gbu = Math.min(eng.gbuTot(f), Math.max(0, t.gbu_richieste - t.danni - (t.prenotate || 0))); APP.apriVista3d({ flight: f.id, target: t.id, n: f.n, gbu, danni: t.danni + gbu, richieste: t.gbu_richieste, distrutto: t.danni + gbu >= t.gbu_richieste }); }; }
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
