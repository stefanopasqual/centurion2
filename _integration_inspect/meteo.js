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
