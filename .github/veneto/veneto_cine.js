/* =====================================================================
   CENTURION 2 · Missione Veneto – cinematiche di SCRAMBLE (Istrana) e ATTERRAGGIO (Venezia Tessera)
   Quando la coppia QRA decolla su ordine di scramble e quando l'Airbus tocca la pista 04R, la simulazione si
   ferma per una scena 3D ravvicinata (9-10 secondi), poi riparte da sola. Si salta toccando lo schermo
   o con Esc, si disattiva dal pannello Esecuzione. Non parte se è aperto il Mondo 3D (lì la scena si
   vede dal vivo). Piste e luci con le coordinate reali (OurAirports); terreno con le immagini
   satellitari z15 attorno alle piste se raggiungibili, altrimenti campi o laguna disegnati.
   Richiede three.js, vista3d.js e veneto.js.
   ===================================================================== */
const VENETO_CINE = (() => {
  "use strict";
  const KEY = "centurion_cine_veneto", DURATE = { scramble: 9000, atterraggio: 10000 };
  const V3 = (x, y, z) => new THREE.Vector3(x || 0, y || 0, z || 0), lerp = (a, b, k) => a + (b - a) * k;
  const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lin = h => { const c = new THREE.Color(h); return c.convertSRGBToLinear ? c.convertSRGBToLinear() : c; };   // colori piani come appaiono nelle texture
  let abil = true; try { abil = localStorage.getItem(KEY) !== "0"; } catch (e) {}
  let ov = null, renderer = null, camera = null, raf = 0, envTex = null;
  const S = { attiva: false, inCorso: false, sequenza: false, coda: [], visti: {}, eraInPlay: false, scene: {}, disegna: null };

  /* ---------- overlay e renderer (una sola volta) ---------- */
  function prepara() {
    if (renderer) return;
    ov = document.createElement("div"); ov.id = "ven-cine"; ov.className = "vc-off";
    ov.innerHTML = `<canvas></canvas><div class="vc-top"><div class="vc-kick"></div><div class="vc-chi"></div></div><div class="vc-cap"></div><div class="vc-met"></div><div class="vc-bar"><span></span></div><div class="vc-skip">tocca per saltare</div>`;
    document.body.appendChild(ov); stile();
    renderer = new THREE.WebGLRenderer({ canvas: ov.querySelector("canvas"), antialias: true, powerPreference: "high-performance" });   // profondità normale: gli strati della pista usano polygonOffset
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    if (THREE.sRGBEncoding !== undefined && renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    camera = new THREE.PerspectiveCamera(45, 1, 1.0, 40000);
    envTex = ambiente();
    ov.addEventListener("pointerdown", () => { if (S.attiva) fine(); });
    window.addEventListener("keydown", e => { if (S.attiva && e.key === "Escape") fine(); });
    window.addEventListener("resize", dimensiona);
  }
  function dimensiona() { if (!renderer) return; renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / Math.max(1, window.innerHeight); camera.updateProjectionMatrix(); }
  // luce ambientale propria: la texture PMREM vale solo per questo renderer
  function ambiente() {
    try {
      const top = new THREE.Color(0x9cc4ff), hor = new THREE.Color(0xe8eef5), bot = new THREE.Color(0x6d7563);
      const geo = new THREE.SphereGeometry(10, 32, 16), pos = geo.attributes.position, col = [];
      for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 10; const c = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(bot, Math.pow(-y, 0.4)); col.push(c.r, c.g, c.b); }
      geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      const sc = new THREE.Scene(); sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      const sun = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 5) })); sun.position.set(5, 4, 4); sc.add(sun);
      const pm = new THREE.PMREMGenerator(renderer); const t = pm.fromScene(sc, 0.02).texture; pm.dispose(); return t;
    } catch (e) { return null; }
  }

  /* ---------- elementi comuni ---------- */
  const merc = (lat, lon) => { const lr = lat * Math.PI / 180; return { u: (lon + 180) / 360, v: (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 }; };
  function riferimento(o) { const C = 40075016.686 * Math.cos(o.lat * Math.PI / 180), m0 = merc(o.lat, o.lon); return { C, m0, xz: (lat, lon) => { const q = merc(lat, lon); return { x: (q.u - m0.u) * C, z: (q.v - m0.v) * C }; } }; }
  function cielo(sc) {
    const g = new THREE.SphereGeometry(30000, 32, 16), pos = g.attributes.position, col = [];
    const top = new THREE.Color(0x3f74bd), hor = new THREE.Color(0xdbe7f1), bot = new THREE.Color(0x9fb2c0);
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 30000; const c = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.5)) : hor.clone().lerp(bot, Math.pow(-y, 0.5)); col.push(c.r, c.g, c.b); }
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); m.renderOrder = -1; sc.add(m);
    sc.fog = new THREE.Fog(0xd3dee8, 3000, 24000);
    sc.add(new THREE.HemisphereLight(0xeaf2ff, 0x56604e, 0.8));
    const sole = new THREE.DirectionalLight(0xfff1dc, 1.8); sole.position.set(740, 420, 520); sc.add(sole);   // mattino, sole da est-sud-est
    return m;
  }
  function texSuolo(tipo) {
    const c = document.createElement("canvas"); c.width = c.height = 1024; const g = c.getContext("2d");
    if (tipo === "laguna") {
      g.fillStyle = "#4f7f86"; g.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 900; i++) { const v = Math.random(); g.fillStyle = v < 0.5 ? "rgba(98,140,140,0.35)" : "rgba(60,98,106,0.35)"; g.beginPath(); g.ellipse(Math.random() * 1024, Math.random() * 1024, 20 + Math.random() * 80, 8 + Math.random() * 30, Math.random() * 3, 0, Math.PI * 2); g.fill(); }
      for (let i = 0; i < 70; i++) { g.fillStyle = "rgba(128,140,104,0.55)"; g.beginPath(); g.ellipse(Math.random() * 1024, Math.random() * 1024, 18 + Math.random() * 60, 6 + Math.random() * 20, Math.random() * 3, 0, Math.PI * 2); g.fill(); }   // barene
    } else {
      const col = ["#6f8a4b", "#7c9455", "#8b8f58", "#a29a68", "#5f7d43", "#768a50", "#9c8f60"];
      for (let y = 0; y < 1024; y += 64) for (let x = 0; x < 1024; x += 48) { g.fillStyle = col[(Math.random() * col.length) | 0]; g.fillRect(x, y, 48, 64); }
      g.strokeStyle = "rgba(60,70,40,0.5)"; g.lineWidth = 2; for (let y = 0; y < 1024; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
      for (let i = 0; i < 600; i++) { g.fillStyle = "rgba(40,60,30,0.6)"; g.beginPath(); g.arc(Math.random() * 1024, Math.random() * 1024, 2 + Math.random() * 4, 0, Math.PI * 2); g.fill(); }   // alberi
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (THREE.sRGBEncoding !== undefined && t.encoding !== undefined) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  }
  // suolo: piano disegnato largo 50 km + immagini satellitari z15 della zona (si attendono al massimo 1,5 s)
  function suolo(sc, R, zona, tipo) {
    const tex = texSuolo(tipo); tex.repeat.set(tipo === "laguna" ? 60 : 90, tipo === "laguna" ? 60 : 90);
    const base = new THREE.Mesh(new THREE.PlaneGeometry(50000, 50000, 40, 40), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })); base.rotation.x = -Math.PI / 2; base.position.y = -0.3; sc.add(base);
    if (typeof VISTA3D === "undefined" || !VISTA3D.tileUrl) return Promise.resolve();
    const z = 15, n = 2 ** z, [la0, lo0, la1, lo1] = zona, x0 = Math.floor((lo0 + 180) / 360 * n), x1 = Math.floor((lo1 + 180) / 360 * n);
    const y0 = Math.floor(merc(la1, lo0).v * n), y1 = Math.floor(merc(la0, lo0).v * n), w = R.C / n, loader = new THREE.TextureLoader(); loader.setCrossOrigin("anonymous");
    const attese = [];
    for (let X = x0; X <= x1; X++) for (let Y = y0; Y <= y1; Y++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), mat); m.rotation.x = -Math.PI / 2; m.visible = false;
      m.position.set(((X + 0.5) / n - R.m0.u) * R.C, 0.02, ((Y + 0.5) / n - R.m0.v) * R.C); sc.add(m);
      attese.push(new Promise(res => loader.load(VISTA3D.tileUrl("sat", z, X, Y), t => { if (THREE.sRGBEncoding !== undefined && t.encoding !== undefined) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; mat.map = t; mat.needsUpdate = true; m.visible = true; res(); }, undefined, () => res())));
    }
    return Promise.race([Promise.all(attese), new Promise(r => setTimeout(r, 1500))]);
  }
  function materialiPropri(m) {   // i materiali dei GLB sono condivisi con le altre viste: qui si usano copie con la luce di questo renderer
    m.traverse(o => { if (o.isMesh && o.material) { o.material = Array.isArray(o.material) ? o.material.map(x => x.clone()) : o.material.clone(); [].concat(o.material).forEach(x => { if ("envMap" in x) { x.envMap = envTex; x.envMapIntensity = (x.userData && x.userData.vernice) || 1; x.needsUpdate = true; } }); } });
    return m;
  }
  const puff = () => (typeof VISTA3D !== "undefined" && VISTA3D.puffTexture) ? VISTA3D.puffTexture(false) : VENETO.puntoLuce();
  // Eurofighter: GLB con carrello procedurale e postbruciatori
  async function typhoon(conCarrello) {
    let m = null; try { m = await VISTA3D.modelloPromise("typhoon", undefined, { tipoId: "F2000", numero: "01" }); } catch (e) {}
    if (!m) m = VISTA3D.jetFallback(0x6b7680); else { materialiPropri(m); if (VENETO.livreaItaliana) VENETO.livreaItaliana(m); }   // materiali già copiati: insegne italiane
    const W = new THREE.Group(); W.add(m); W.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(m), size = bb.getSize(V3()), yN = bb.min.y + size.y * 0.3;
    const fiamme = [];
    // il modello glTF ha già le fiamme vere sugli ugelli (js/postbruciatore.js): coni propri solo per il modello di riserva
    const animMdl = typeof POSTBRUCIATORE !== "undefined" && m.userData && m.userData.anim && m.getObjectByName("postbruciatore") ? m.userData.anim : null;
    if (!animMdl) [-0.5, 0.5].forEach(x => {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.42, 3.6, 14, 1, true), new THREE.MeshBasicMaterial({ color: lin(0xff7a1e), transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide })); f.rotation.x = -Math.PI / 2; f.position.set(x, yN, bb.min.z - 1.75); W.add(f); fiamme.push(f);
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.6, 12, 1, true), new THREE.MeshBasicMaterial({ color: lin(0xffe2a0), transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })); c.rotation.x = -Math.PI / 2; c.position.set(x, yN, bb.min.z - 0.75); W.add(c); fiamme.push(c);
      const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: VENETO.puntoLuce(), color: 0xff9440, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 })); g.position.set(x, yN, bb.min.z + 0.05); g.scale.set(1.2, 1.2, 1); W.add(g); fiamme.push(g);
    });
    fiamme.forEach(f => { f.visible = false; });
    W.userData = { fiamme, bb, terra: bb.min.y - 1.35, animMdl };
    if (conCarrello) {
      const G = new THREE.Group(), gomma = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.95 }), met = new THREE.MeshStandardMaterial({ color: 0xb7bfc5, metalness: 0.6, roughness: 0.35 }), yT = W.userData.terra;
      const gamba = (x, z, r) => { const h = bb.min.y + 0.35 - (yT + r); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, h, 8), met); c.position.set(x, yT + r + h / 2, z); G.add(c);
        const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.22, 14), gomma); w.rotation.z = Math.PI / 2; w.position.set(x, yT + r, z); G.add(w); };
      gamba(0, bb.max.z - size.z * 0.24, 0.3); gamba(1.35, bb.min.z + size.z * 0.42, 0.38); gamba(-1.35, bb.min.z + size.z * 0.42, 0.38);
      W.add(G); W.userData.carrello = G;
    }
    return W;
  }
  function fumo(sc, n) {   // nuvolette (pneumatici, inversori): sprite riutilizzati
    const out = []; for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff(), color: 0xdfe3e6, transparent: true, opacity: 0, depthWrite: false })); s.visible = false; sc.add(s); out.push(s); } return out;
  }
  function postbruciatore(W, k, t) { if (W.userData.animMdl) { W.userData.animMdl({ afterburner: k, spinta: 1, t }); return; } (W.userData.fiamme || []).forEach((f, i) => { f.visible = k > 0.02; if (f.isMesh) { f.scale.set(1, 0.45 + k * (0.75 + 0.1 * Math.sin(t * 43 + i)), 1); f.material.opacity = (i % 3 === 1 ? 0.5 : 0.25) + 0.4 * k; } else { f.material.opacity = 0.25 + 0.45 * k; const s = 0.9 + 0.9 * k; f.scale.set(s, s, 1); } }); }

  /* ---------- scena 1: SCRAMBLE a Istrana, pista 08 ---------- */
  async function scenaScramble() {
    const p = VENETO.PISTE["LIPS-08"], A = { lat: p.a[0], lon: p.a[1] }, B = { lat: p.b[0], lon: p.b[1] };
    const O = { lat: (A.lat + B.lat) / 2, lon: (A.lon + B.lon) / 2 }, R = riferimento(O), sc = new THREE.Scene(); const cupola = cielo(sc);
    const pronto = suolo(sc, R, [45.668, 12.045, 45.701, 12.130], "campi");
    const pg = VENETO.pista(p, { dimLuci: 4 }), a = R.xz(A.lat, A.lon), b = R.xz(B.lat, B.lon); pg.position.set((a.x + b.x) / 2, 0.05, (a.z + b.z) / 2); pg.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); sc.add(pg);
    const L = pg.userData.lung, z08 = -L / 2 + (p.soglia_a || 0) + 40;   // inizio corsa: subito dopo la soglia spostata della 08
    const F = new THREE.Group(); pg.add(F);   // riferimento pista: +Z verso est (decollo), +X a nord
    // raccordo e due rifugi corazzati a nord della pista, con lampeggiante d'allarme
    const cem = new THREE.MeshStandardMaterial({ color: lin(0x8f8c84), roughness: 0.95 }), cemScuro = new THREE.MeshStandardMaterial({ color: lin(0x6a6862), roughness: 0.95 });
    const rac = new THREE.Mesh(new THREE.PlaneGeometry(140, 22), new THREE.MeshStandardMaterial({ color: lin(0x585b5c), roughness: 0.95 })); rac.rotation.x = -Math.PI / 2; rac.position.set(85, 0.08, z08 + 178); F.add(rac);
    const piazzale = new THREE.Mesh(new THREE.PlaneGeometry(60, 110), new THREE.MeshStandardMaterial({ color: lin(0x6b6d6c), roughness: 0.95 })); piazzale.rotation.x = -Math.PI / 2; piazzale.position.set(150, 0.07, z08 + 178); F.add(piazzale);
    const beacon = [];
    [z08 + 150, z08 + 205].forEach(zs => {
      const H = new THREE.Group(); H.position.set(160, 0, zs); F.add(H);
      const volta = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 34, 24, 1, true, 0, Math.PI), cem); volta.rotation.z = Math.PI / 2; volta.material.side = THREE.DoubleSide; H.add(volta);   // asse lungo X, apertura verso la pista (-X)
      const fondo = new THREE.Mesh(new THREE.CircleGeometry(11, 24, 0, Math.PI), cemScuro); fondo.position.x = 17; fondo.rotation.y = -Math.PI / 2; H.add(fondo);
      const anello = new THREE.Mesh(new THREE.RingGeometry(10.2, 11.6, 24, 1, 0, Math.PI), cemScuro); anello.position.x = -17.05; anello.rotation.y = -Math.PI / 2; anello.material.side = THREE.DoubleSide; H.add(anello);   // portale
      const buio = new THREE.Mesh(new THREE.CircleGeometry(10.4, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x0b0d10 })); buio.position.x = 16.6; buio.rotation.y = -Math.PI / 2; H.add(buio);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff8a1c })); lamp.position.set(-17.2, 11.2, 0); H.add(lamp);
      const alone = new THREE.Sprite(new THREE.SpriteMaterial({ map: VENETO.puntoLuce(), color: 0xff8a1c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); alone.position.copy(lamp.position); alone.scale.set(5, 5, 1); H.add(alone);
      const pl = new THREE.PointLight(0xff8a1c, 0, 60); pl.position.copy(lamp.position); H.add(pl); beacon.push({ lamp, alone, pl });
    });
    const j1 = await typhoon(true), j2 = await typhoon(true); F.add(j1, j2);
    const yA = -j1.userData.terra;   // quota del velivolo appoggiato sulle ruote
    const vapori = fumo(F, 14);
    const pos = (W, x, y, z, yaw, pitch) => { W.position.set(x, y, z); W.rotation.set(-(pitch || 0), yaw, 0, "YXZ"); };
    const did = ["SCRAMBLE · ordine del CAOC: FALCO 1-2 escono dalle hangarette QRA", "Postbruciatore · decollo in coppia dalla pista 08 di Istrana, controvento", "FALCO 1-2 in salita verso il LAGUNA 451, guidati dal radar"];
    const cam = (p0, look, fov) => { camera.position.copy(F.localToWorld(p0.clone())); camera.lookAt(F.localToWorld(look.clone())); camera.fov = Math.min(80, fov * (camera.aspect < 1 ? 1.6 : 1)); camera.updateProjectionMatrix(); cupola.position.copy(camera.position); };   // in verticale serve più campo
    const disegna = t => {
      beacon.forEach((b, i) => { const on = Math.sin(t * 9 + i * 1.7) > 0.2; b.lamp.visible = on; b.alone.visible = on; b.pl.intensity = on ? 3 : 0; });
      vapori.forEach(v => { v.visible = false; });
      let fase;
      if (t < 2.4) {   // escono dai rifugi verso la pista (direzione -X)
        fase = 0; const k = ease(t / 2.4);
        pos(j1, 160 - 14 - 26 * k, yA, z08 + 150, -Math.PI / 2); pos(j2, 160 - 10 - 8 * clamp((t - 1.0) / 1.4, 0, 1), yA, z08 + 205, -Math.PI / 2);
        postbruciatore(j1, 0, t); postbruciatore(j2, 0, t);
        cam(V3(112, 3.4, z08 + 118), V3(lerp(146, 126, k), 3.0, z08 + 168), 46);
      } else if (t < 5.4) {   // allineati sulla pista, postbruciatori accesi, rilascio dei freni
        fase = 1; const u = t - 2.4, ab = clamp((u - 0.25) / 0.8, 0, 1), s1 = u > 1.2 ? 3.4 * (u - 1.2) ** 2 : 0, s2 = u > 1.6 ? 3.2 * (u - 1.6) ** 2 : 0;
        pos(j1, 7, yA, z08 + s1, 0); pos(j2, -8, yA, z08 - 45 + s2, 0);
        postbruciatore(j1, ab, t); postbruciatore(j2, clamp((u - 0.5) / 0.8, 0, 1), t);
        vapori.forEach((v, i) => { const age = (t * 1.6 + i / vapori.length * 2) % 2, j = i % 2 ? j2 : j1; v.visible = ab > 0.3; v.position.set(j.position.x + Math.sin(i * 3.7) * 2, 1.2 + age * 2.2, j.position.z - 9 - age * 16); const s = 3 + age * 9; v.scale.set(s, s, 1); v.material.opacity = (1 - age / 2) * 0.22; });
        cam(V3(-24, 3.4, z08 - 92 + u * 3), V3(2, 2.6, z08 + 90), 44);
      } else {   // stacco e salita: in coda il gregario, carrello che rientra
        fase = 2; const u = t - 5.4, zL = z08 + 900, v0 = 66;
        const voloLead = q => { const s = zL + v0 * q + 3.2 * q * q, h = q < 0.5 ? 0 : 7 * (q - 0.5) ** 2 + 12 * (q - 0.5); return [s, h, q < 0.5 ? 0.05 + 0.14 * (q / 0.5) : Math.min(0.32, 0.19 + 0.05 * (q - 0.5))]; };
        const [s1, h1, p1] = voloLead(u + 0.2), [s2, h2, p2] = voloLead(u - 0.95);
        pos(j1, 7, yA + h1, s1, 0, p1); pos(j2, -8, yA + Math.max(0, h2), s2 - 240, 0, Math.max(0.03, p2));
        [j1, j2].forEach((j, i) => { if (j.userData.carrello) j.userData.carrello.visible = (i ? u - 0.95 : u + 0.2) < 2.2; });
        postbruciatore(j1, 1, t); postbruciatore(j2, 1, t);
        // telecamera di lato al punto di stacco che segue il capofila mentre sale e si allontana
        cam(V3(-62, 2.0, zL + 70), V3(lerp(6, 7, ease(u / 3)), yA + h1 * 0.85, s1 - 6), lerp(38, 30, ease(u / 3.6)));
      }
      return { fase, didascalia: did[fase] };
    };
    await pronto;
    return { scene: sc, disegna, kick: "🚨 SCRAMBLE · QRA ISTRANA", met: "Prontezza QRA 15 minuti, in volo dopo 8 · pista 08/26 di Istrana (coordinate OurAirports)" };
  }

  /* ---------- scena 2: ATTERRAGGIO a Venezia Tessera, pista 04R ---------- */
  async function scenaAtterraggio() {
    const p = VENETO.PISTE["LIPZ-04R"], A = { lat: p.a[0], lon: p.a[1] }, B = { lat: p.b[0], lon: p.b[1] };
    const O = { lat: (A.lat + B.lat) / 2, lon: (A.lon + B.lon) / 2 }, R = riferimento(O), sc = new THREE.Scene(); const cupola = cielo(sc);
    // laguna disegnata ovunque e prato attorno alle piste (le immagini satellitari li coprono se arrivano)
    const pronto = suolo(sc, R, [45.474, 12.296, 45.532, 12.392], "laguna");
    const p2 = VENETO.PISTE["LIPZ-04L"];
    [p, p2].forEach(q => { const g = VENETO.pista(q, { dimLuci: 4 }), a = R.xz(q.a[0], q.a[1]), b = R.xz(q.b[0], q.b[1]); g.position.set((a.x + b.x) / 2, 0.05, (a.z + b.z) / 2); g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); sc.add(g); if (q === p) sc.userData.pista = g; });
    const pg = sc.userData.pista, L = pg.userData.lung, zThr = -L / 2, zTd = zThr + 420, F = new THREE.Group(); pg.add(F);   // +Z = direzione d'atterraggio, +X = sinistra
    const prato = new THREE.Mesh(new THREE.PlaneGeometry(900, L + 900), new THREE.MeshStandardMaterial({ map: texSuolo("campi"), roughness: 1 })); prato.material.map.repeat.set(1, (L + 900) / 900);
    prato.rotation.x = -Math.PI / 2; prato.position.set(110, -0.22, 0); prato.material.polygonOffset = true; prato.material.polygonOffsetFactor = 1; prato.material.polygonOffsetUnits = 1; pg.add(prato);   // 04L è circa 190 m a sinistra della 04R
    let ab = await VENETO.modelloAirbus(); if (!ab) ab = VISTA3D.jetFallback(0xe5e9ec);
    F.add(ab); const gear = ab.userData && ab.userData.carrello, yG = gear ? -gear.userData.terra : 5.6;
    if (gear) gear.visible = true; if (ab.userData && ab.userData.fari) ab.userData.fari.visible = true;
    const gomme = fumo(F, 10), inv = fumo(F, 12);
    const quota = z => { const g = 0.0524 * (zTd - z); if (z < zTd - 200) return g; const u = clamp((z - (zTd - 200)) / 200, 0, 1); return 10.48 * (1 - u) * (1 - u); };
    const setAb = (z, beccheggio) => { ab.position.set(0, yG + quota(z), z); ab.rotation.set(-beccheggio, 0, 0, "YXZ"); };
    const did = ["Corto finale · LAGUNA 451 senza radio: luce verde fissa dalla torre, autorizzato ad atterrare", "Touchdown sulla pista 04R di Venezia Tessera", "Inversori di spinta · FALCO 1-2 in attesa a nord-ovest, poi rientro a Istrana"];
    const cam = (p0, look, fov) => { camera.position.copy(F.localToWorld(p0.clone())); camera.lookAt(F.localToWorld(look.clone())); camera.fov = Math.min(80, fov * (camera.aspect < 1 ? 1.6 : 1)); camera.updateProjectionMatrix(); cupola.position.copy(camera.position); };   // in verticale serve più campo
    let tAnim = 0;
    const disegna = t => {
      gomme.forEach(s => { s.visible = false; }); inv.forEach(s => { s.visible = false; });
      if (ab.userData && ab.userData.anim) { try { ab.userData.anim({ t, afterburner: 0 }); } catch (e) {} }
      let fase;
      if (t < 3.4) {   // corto finale sopra la laguna: i caccia hanno lasciato l'Airbus a 8 NM e sono in attesa a nord-ovest
        fase = 0; const z = zThr - 1300 + 72 * t; setAb(z, 0.045);
        cam(V3(-95, 12, zThr - 560), V3(30, yG + quota(z) + 12, z - 60), lerp(24, 19, t / 3.4));
      } else if (t < 6.8) {   // richiamata e contatto: fumo dai carrelli principali
        fase = 1; const u = t - 3.4, z = zTd - 200 + 70 * u, toccato = z >= zTd; setAb(Math.min(z, zTd + 5000), toccato ? 0.035 : 0.07 + 0.02 * clamp(u / 2.5, 0, 1));
        if (toccato) { const zz = z; ab.position.set(0, yG, zz); const a0 = (z - zTd) / 70;
          gomme.forEach((s, i) => { const age = a0 - i * 0.04; s.visible = age > 0 && age < 1.6; if (!s.visible) return; s.position.set((i % 2 ? 5.35 : -5.35) + Math.sin(i) * 0.6, 0.8 + age * 1.6, zTd - 1.5 + (i * 0.04) * 70 - 6 - age * 6); const k = 3 + age * 7; s.scale.set(k, k * 0.7, 1); s.material.opacity = (1 - age / 1.6) * 0.55; }); }
        cam(V3(-82, 2.4, zTd + 70), V3(0, yG + 4, lerp(zTd - 140, zTd + 10, ease(u / 3.2))), 38);
      } else {   // corsa d'atterraggio con gli inversori di spinta: la telecamera resta a bordo pista e lo segue
        fase = 2; const u = t - 6.8, v = 54 - 3.6 * u, z = zTd + 330 + 54 * u - 1.8 * u * u; ab.position.set(0, yG, z); ab.rotation.set(0, 0, 0);
        inv.forEach((s, i) => { const age = (u * 1.4 + i / inv.length * 1.2) % 1.2; s.visible = v > 25; s.position.set((i % 2 ? 9.6 : -9.6) + Math.sin(i * 2.1) * 0.8, 1.2 + age * 2.4, z + 3 - age * 14); const k = 3.5 + age * 9; s.scale.set(k, k * 0.75, 1); s.material.opacity = (1 - age / 1.2) * 0.3; });
        cam(V3(-70, 2.2, zTd + 470), V3(0, yG + 2.5, z + 8), lerp(34, 24, ease(u / 3.2)));
      }
      tAnim = t; return { fase, didascalia: did[fase] };
    };
    await pronto;
    return { scene: sc, disegna, kick: "🛬 ATTERRAGGIO · VENEZIA TESSERA", met: "Pista 04R/22L (3.300 m) · avvicinamento ILS da sud-ovest sopra la laguna (coordinate OurAirports)" };
  }

  /* ---------- riproduzione ---------- */
  async function mostra(r) {
    prepara(); dimensiona();
    if (!S.scene[r.tipo]) S.scene[r.tipo] = await (r.tipo === "scramble" ? scenaScramble() : scenaAtterraggio());
    const Sc = S.scene[r.tipo], q = s => ov.querySelector(s), durata = DURATE[r.tipo];
    q(".vc-kick").textContent = Sc.kick; q(".vc-met").textContent = Sc.met;
    q(".vc-chi").textContent = r.tipo === "scramble" ? `${r.cs || "FALCO"} · ${r.n || 2}× Eurofighter Typhoon · in volo alle ${r.ora || ""}` : `${VENETO.CIVILE.cs} · ${VENETO.CIVILE.tipo} · ${VENETO.CIVILE.marche} · senza radio (7600), scortato da FALCO 1-2 fino a 8 NM`;
    let fase = -1;
    const disegna = t => {
      const info = Sc.disegna(t); if (info.fase !== fase) { fase = info.fase; q(".vc-cap").textContent = info.didascalia; }
      q(".vc-bar span").style.width = Math.min(100, t / (durata / 1000) * 100) + "%";
      if (t * 1000 >= durata - 300) ov.classList.add("vc-esce");
      renderer.render(Sc.scene, camera);
    };
    S.disegna = disegna;
    // shader compilati e primo fotogramma prima di mostrare: la durata parte da quello che si vede
    Sc.disegna(0); try { renderer.compile(Sc.scene, camera); } catch (e) {} renderer.render(Sc.scene, camera);
    if (!S.inCorso) return;
    S.attiva = true; ov.className = "vc-on"; const t0 = performance.now();
    const passo = now => { if (!S.attiva) return; const t = (now - t0) / 1000; disegna(t); if (t * 1000 >= durata) { fine(); return; } raf = requestAnimationFrame(passo); };
    raf = requestAnimationFrame(passo);
  }
  const multi = () => typeof RETE !== "undefined" && (RETE.attiva || (RETE.client && RETE.client()));
  function avvia(r) {
    if (!S.sequenza) { S.sequenza = true; S.eraInPlay = typeof APP !== "undefined" && APP.playing; }
    if (!multi() && typeof APP !== "undefined") APP.play(false);
    S.inCorso = true;
    mostra(r).catch(e => { console.warn("cinematica Veneto", e); fine(); });
  }
  function fine() {
    if (!S.inCorso) return; S.inCorso = false; S.attiva = false;
    cancelAnimationFrame(raf); if (ov) ov.className = "vc-off";
    const prossima = S.coda.shift(); if (prossima) { setTimeout(() => avvia(prossima), 150); return; }
    S.sequenza = false;
    if (!multi() && S.eraInPlay && typeof APP !== "undefined" && APP.engine && !APP.engine.finita) APP.play(true);
    S.eraInPlay = false;
  }
  function suEvento(e, eng) {
    if (!abil || !e || typeof APP === "undefined" || eng !== APP.engine || typeof VENETO === "undefined" || !VENETO.attiva()) return;
    if ((typeof RETE !== "undefined" && RETE.bulk) || document.hidden || (typeof MONDO3D !== "undefined" && MONDO3D.attiva)) return;
    let r = null;
    if (/^AIRBORNE da .*\(SCRAMBLE QRA\)$/.test(e.testo || "")) { const f = eng.flights.find(x => x.callsign === e.chi || x.id === e.chi); r = { tipo: "scramble", cs: e.chi, n: f ? f.n : 2, ora: (e.ora || "").slice(0, 5) }; }
    else if (e.chi === VENETO.CIVILE.cs && /^Atterrato sulla pista 04R/.test(e.testo || "")) r = { tipo: "atterraggio" };
    if (!r || S.visti[r.tipo]) return; S.visti[r.tipo] = true;
    if (S.inCorso || (typeof AAR_CINE !== "undefined" && AAR_CINE.attiva)) { if (S.coda.length < 2) S.coda.push(r); if (!S.inCorso) setTimeout(() => { const x = S.coda.shift(); if (x) avvia(x); }, 4500); return; }
    setTimeout(() => avvia(r), 0);
  }
  let engCorrente = null;
  setInterval(() => {
    if (typeof APP === "undefined" || !APP.engine || APP.engine === engCorrente) return;
    const eng = APP.engine; engCorrente = eng; S.visti = {};
    eng.on(ev => { if (ev && ev.tipo === "evento") { try { suEvento(ev.e, eng); } catch (x) { console.warn(x); } } });
  }, 300);
  // interruttore nel pannello Esecuzione (solo nella missione Veneto)
  window.addEventListener("DOMContentLoaded", () => setTimeout(() => {
    if (typeof UI === "undefined" || !UI.esecuzione) return; const orig = UI.esecuzione;
    UI.esecuzione = function () { const out = orig.apply(this, arguments); try { interruttore(); } catch (e) {} return out; };
  }, 0));
  function interruttore() {
    if (typeof VENETO === "undefined" || !VENETO.attiva() || document.getElementById("chk-ven-cine")) return;
    const v = document.getElementById("chk-aar-cine") || document.getElementById("chk-v3d"), dove = v ? (v.closest("label") || v) : document.querySelector("#btn-mondo3d");
    if (!dove) return;
    const lab = document.createElement("label"); lab.style.cssText = "display:block;margin-top:6px";
    lab.innerHTML = `<input type="checkbox" id="chk-ven-cine" ${abil ? "checked" : ""}> 🎬 <b>Cinematiche di scramble e atterraggio</b> <small>(9-10 secondi, poi la simulazione riparte; non partono con il Mondo 3D aperto)</small>`;
    dove.insertAdjacentElement("afterend", lab);
    lab.querySelector("input").onchange = e => { abil = e.target.checked; try { localStorage.setItem(KEY, abil ? "1" : "0"); } catch (x) {} };
  }
  function stile() {
    if (document.getElementById("ven-cine-style")) return; const st = document.createElement("style"); st.id = "ven-cine-style";
    st.textContent = `#ven-cine{position:fixed;inset:0;z-index:100060;background:#000;transition:opacity .25s ease;font-family:"Segoe UI",Roboto,Arial,sans-serif;color:#eef5fb;cursor:pointer}
      #ven-cine.vc-off{opacity:0;pointer-events:none;visibility:hidden}#ven-cine.vc-on{opacity:1}#ven-cine.vc-esce{opacity:0}
      #ven-cine canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
      #ven-cine .vc-top{position:absolute;top:14px;left:16px;text-shadow:0 2px 6px #000c}#ven-cine .vc-kick{font-weight:900;letter-spacing:.12em;font-size:14px;color:#ffb347}#ven-cine .vc-chi{font-size:15px;font-weight:700;margin-top:3px}
      #ven-cine .vc-cap{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);background:#0b1220cc;border:1px solid #ffffff30;border-radius:12px;padding:8px 16px;font-size:17px;font-weight:700;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis}
      #ven-cine .vc-met{position:absolute;left:16px;bottom:14px;font-size:12px;color:#c9d7e4;text-shadow:0 1px 4px #000;max-width:70vw}
      #ven-cine .vc-skip{position:absolute;right:16px;bottom:14px;font-size:12px;color:#c9d7e4;opacity:.8}
      #ven-cine .vc-bar{position:absolute;left:0;right:0;top:0;height:3px;background:#ffffff22}#ven-cine .vc-bar span{display:block;height:100%;width:0;background:#ffb347}
      @media (max-height:460px){#ven-cine .vc-cap{font-size:14px;bottom:34px;padding:6px 12px}#ven-cine .vc-chi{font-size:13px}#ven-cine .vc-kick{font-size:12px}}
      @media (max-width:560px){#ven-cine .vc-cap{white-space:normal;text-align:center;width:88vw;bottom:40px;font-size:15px}#ven-cine .vc-met{display:none}#ven-cine .vc-chi{font-size:13px;max-width:92vw}}`;
    document.head.appendChild(st);
  }
  return { get attiva() { return S.attiva; }, get abilitata() { return abil; }, set abilitata(v) { abil = !!v; }, mostra: r => avvia(typeof r === "string" ? { tipo: r } : r),
    // per i controlli automatici: ferma l'animazione e disegna l'istante t
    _fotogramma: t => { cancelAnimationFrame(raf); if (S.disegna) S.disegna(t); }, _S: S };
})();
