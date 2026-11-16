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
