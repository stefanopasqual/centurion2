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
