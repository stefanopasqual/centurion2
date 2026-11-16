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
