/* =====================================================================
   CENTURION – cinematica del RIFORNIMENTO IN VOLO (massimo 4 secondi)
   In ogni missione, quando una formazione inizia il rifornimento dal tanker,
   la simulazione si ferma per una breve scena 3D ravvicinata:
   - braccio rigido (boom) del KC-30 nel ricettacolo per F-15E, F-16, F-22;
   - sonda nel cestello del tubo sotto l'ala per EA-18G ed Eurofighter;
   poi riparte da sola. Si disattiva dal pannello Esecuzione. Richiede three.js e vista3d.js.
   ===================================================================== */
const AAR_CINE = (() => {
  const DURATA = 4000, KEY = "centurion_cine_aar", VEL_REL = 154;   // m/s: 300 kt, velocità tipica di rifornimento
  const V3 = (x, y, z) => new THREE.Vector3(x || 0, y || 0, z || 0);
  const lerp = (a, b, k) => a + (b - a) * k, ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
  /* Tipo di rifornimento e punto di aggancio di ciascun velivolo, misurati sui riferimenti del suo modello 3D
     (tettuccio, deriva), non su percentuali della lunghezza. Sistema del modello: muso +Z, alto +Y, x positivo = lato SINISTRO; metri.
     - F-15E: braccio rigido; ricettacolo (UARRSI) nella radice dell'ala sinistra, dietro uno sportello: il pilota si sposta
       leggermente a destra per allinearsi (The Aviationist, F-15I; Fighter Sweep, NASA F-15D).
     - F-16: braccio rigido; ricettacolo sul dorso, a metà fra il bordo posteriore del tettuccio e la base della deriva (Fighter Sweep).
     - F-22: braccio rigido; ricettacolo sul dorso subito dietro l'abitacolo, coperto da due portelli a farfalla con luci (GlobalSecurity).
     - EA-18G: sonda e cestello; sonda retrattile sul lato destro del muso, davanti al parabrezza: base e punta sono quelle della
       sonda estratta modellata nel GLB stesso (nodo f18e_refuelOn), riportate rispetto al tettuccio.
     - Eurofighter: sonda e cestello; sonda retrattile sul lato destro della fusoliera, davanti al parabrezza (WeaponSpecs).
     - Su-35: sonda e cestello; sonda retrattile sul lato sinistro del muso (Airforce Technology, Migflug).
     - Su-57: sonda e cestello; sonda retrattile fuori asse sul muso (TWZ); lato sinistro come il Su-35, non confermato da fonti scritte.
     Per le sonde: base e punta = [x, y rispetto alla sommità del tettuccio, z rispetto al bordo anteriore del tettuccio]. */
  const RIC = {
    F15: { metodo: "boom", rif: "dietroTettuccio", dz: -1.35, x: 1.6, punto: "il ricettacolo nella radice dell'ala sinistra" },
    F16: { metodo: "boom", rif: "metaDorso", x: 0, punto: "il ricettacolo sul dorso, fra tettuccio e deriva" },
    F22: { metodo: "boom", rif: "dietroTettuccio", dz: -1.0, x: 0, portelli: true, punto: "il ricettacolo dietro l'abitacolo, fra i portelli a farfalla" },
    EA18: { metodo: "drogue", esatta: true, base: [-0.32, -0.92, 0.38], punta: [-0.37, -0.96, 1.60], punto: "la sonda sul lato destro del muso" },
    F2000: { metodo: "drogue", base: [-0.42, -0.55, 0.15], punta: [-0.55, -0.25, 1.75], punto: "la sonda sul lato destro, davanti al parabrezza" },
    SU35: { metodo: "drogue", base: [0.45, -0.6, 0.25], punta: [0.6, -0.2, 2.0], punto: "la sonda sul lato sinistro del muso" },
    SU57: { metodo: "drogue", base: [0.42, -0.55, 0.25], punta: [0.55, -0.2, 1.8], punto: "la sonda sul lato sinistro del muso" }
  };
  const NOMI = { F16: "F-16C", F15: "F-15E", F22: "F-22A", EA18: "EA-18G", F2000: "Eurofighter", SU35: "Su-35", SU57: "Su-57" };
  const ICONA = { F16: "f16", F15: "f15", F22: "f22", EA18: "ea18", F2000: "typhoon", SU35: "su35", SU57: "su57" };
  let abil = true; try { abil = localStorage.getItem(KEY) !== "0"; } catch (e) {}
  let ov = null, renderer = null, scene = null, camera = null, cielo = null, envTex = null, nuvole = [], raf = 0;
  let tanker = null, tankerP = null, pods = [], tubi = [];
  const S = { attiva: false, inCorso: false, sequenza: false, coda: [], visti: {}, eraInPlay: false, scena: null };

  /* ---------- scena fissa: cielo, mare, nuvole, luci, tanker con tubi e cestelli ---------- */
  function prepara() {
    if (renderer) return;
    ov = document.createElement("div"); ov.id = "aar-cine"; ov.className = "aar-off";
    ov.innerHTML = `<canvas></canvas><div class="aar-top"><div class="aar-kick">⛽ RIFORNIMENTO IN VOLO</div><div class="aar-chi"></div></div><div class="aar-cap"></div><div class="aar-met"></div><div class="aar-bar"><span></span></div><div class="aar-skip">tocca per saltare</div>`;
    document.body.appendChild(ov); stile();
    renderer = new THREE.WebGLRenderer({ canvas: ov.querySelector("canvas"), antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    if (THREE.sRGBEncoding !== undefined && renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xcad9e7, 2500, 16000);
    camera = new THREE.PerspectiveCamera(42, 1, 0.3, 40000);
    // cielo a gradiente
    const g = new THREE.SphereGeometry(25000, 32, 16), pos = g.attributes.position, col = [];
    const top = new THREE.Color(0x3b6db4), hor = new THREE.Color(0xd5e3ef), bot = new THREE.Color(0x7b93a8);
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 25000; const c = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.55)) : hor.clone().lerp(bot, Math.pow(-y, 0.5)); col.push(c.r, c.g, c.b); }
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    cielo = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); scene.add(cielo);
    // mare 7.600 m più in basso (FL250) e nuvole basse che scorrono
    const mare = new THREE.Mesh(new THREE.PlaneGeometry(90000, 90000), new THREE.MeshStandardMaterial({ color: 0x2a5675, roughness: 0.55, metalness: 0.05 }));
    mare.rotation.x = -Math.PI / 2; mare.position.y = -7600; scene.add(mare);
    const tex = (typeof VISTA3D !== "undefined" && VISTA3D.puffTexture) ? VISTA3D.puffTexture(false) : puff();
    for (let i = 0; i < 40; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0.8 + Math.random() * 0.2, depthWrite: false }));
      s.position.set((Math.random() - 0.5) * 7000, -300 - Math.random() * 1100, (Math.random() - 0.5) * 9000); const k = 260 + Math.random() * 520; s.scale.set(k * 1.9, k, 1); scene.add(s); nuvole.push(s);
    }
    scene.add(new THREE.HemisphereLight(0xe8f1ff, 0x4a5d6f, 0.85));
    const sole = new THREE.DirectionalLight(0xfff3df, 1.75); sole.position.set(-420, 900, 520); scene.add(sole);
    envTex = ambiente();
    ov.addEventListener("pointerdown", () => { if (S.attiva) fine(); });   // tocco: salta
    window.addEventListener("keydown", e => { if (S.attiva && e.key === "Escape") fine(); });
    window.addEventListener("resize", dimensiona);
    tankerP = VISTA3D.modelloProcedurale("kc30", undefined, { tipoId: "KC30", numero: "01" }).then(w => { tanker = w; scene.add(w); dettagliTanker(w); return w; });
  }
  function puff() {
    const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), gr = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(0.6, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  }
  // luce ambientale propria (la texture PMREM appartiene a questo renderer)
  function ambiente() {
    try {
      const top = new THREE.Color(0x9cc4ff), hor = new THREE.Color(0xe8eef5), bot = new THREE.Color(0x5f7486);
      const geo = new THREE.SphereGeometry(10, 32, 16), pos = geo.attributes.position, col = [];
      for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 10; const c = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(bot, Math.pow(-y, 0.4)); col.push(c.r, c.g, c.b); }
      geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      const sc = new THREE.Scene(); sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      const sun = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 5) })); sun.position.set(-4, 7, 5); sc.add(sun);
      const pm = new THREE.PMREMGenerator(renderer); const t = pm.fromScene(sc, 0.02).texture; pm.dispose(); return t;
    } catch (e) { return null; }
  }
  // tubi flessibili e cestelli dai pod alari, luci guida dell'operatore sotto la fusoliera
  function dettagliTanker(w) {
    w.updateMatrixWorld(true);
    const cand = [];
    w.traverse(o => { if (!o.isMesh) return; const b = new THREE.Box3().setFromObject(o), c = b.getCenter(V3()), s = b.getSize(V3());
      if (Math.abs(Math.abs(c.x) - 21.5) < 2 && c.z < -2.5 && c.z > -9 && s.z > 2.8 && s.z < 5.5 && s.x < 1.6) cand.push({ c, min: b.min }); });
    [1, -1].forEach(lato => {
      const p = cand.filter(q => Math.sign(q.c.x) === lato).sort((a, b) => a.min.z - b.min.z)[0];
      const p0 = p ? V3(p.c.x, p.c.y - 0.05, p.min.z + 0.1) : V3(lato * 21.5, -0.8, -7.7); pods.push(p0);
      const curva = new THREE.CatmullRomCurve3([p0, p0.clone().add(V3(0, -0.45, -4)), p0.clone().add(V3(0, -1.7, -9)), p0.clone().add(V3(0, -3.3, -14.5))]);
      const tubo = new THREE.Mesh(new THREE.TubeGeometry(curva, 48, 0.07, 8, false), new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.2 })); w.add(tubo); const obj = [tubo];
      const bianco = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });
      [0.86, 0.9, 0.94].forEach(u => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.03, 6, 14), bianco); r.position.copy(curva.getPointAt(u)); r.lookAt(curva.getPointAt(u).add(curva.getTangentAt(u))); w.add(r); obj.push(r); });
      const fine = curva.getPointAt(1), cest = new THREE.Group(); cest.position.copy(fine);
      const cono = new THREE.ConeGeometry(0.44, 0.8, 18, 1, true); cono.rotateX(Math.PI / 2); cono.translate(0, 0, -0.45);
      cest.add(new THREE.Mesh(cono, new THREE.MeshStandardMaterial({ color: 0xcfd3d6, wireframe: true })));
      const bordo = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.045, 8, 24), bianco); bordo.position.z = -0.85; cest.add(bordo);
      const mozzo = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.32, 12).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a9096, metalness: 0.7, roughness: 0.35 })); cest.add(mozzo);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, l = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), new THREE.MeshBasicMaterial({ color: 0x9dffb0 })); l.position.set(Math.cos(a) * 0.44, Math.sin(a) * 0.44, -0.85); cest.add(l); }
      w.add(cest); obj.push(cest); tubi.push({ curva, cest, obj, aggancio: fine.clone().add(V3(0, 0, -0.18)) });
    });
    // luci guida per il pilota (Pilot Director Lights) ai lati del ventre, davanti al braccio
    [[1.7, 0x6dff7a], [-1.7, 0xffcf5a]].forEach(([x, c]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 2.4), new THREE.MeshBasicMaterial({ color: c })); b.position.set(x, -2.85, -12.5); w.add(b); });
  }

  /* ---------- ricevitore ---------- */
  async function ricevitore(tipo) {
    const ic = ICONA[tipo] || "f16"; let m = null;
    try { m = await Promise.race([VISTA3D.modelloPromise(ic, undefined, { tipoId: tipo }), new Promise(r => setTimeout(() => r(null), 700))]); } catch (e) {}
    if (!m) m = await VISTA3D.modelloProcedurale(ic, undefined, { tipoId: tipo });
    // materiali propri: quelli del GLB sono condivisi con le altre viste 3D, che hanno la loro luce ambientale
    m.traverse(o => { if (!o.isMesh) return; o.material = Array.isArray(o.material) ? o.material.map(x => x.clone()) : o.material.clone(); [].concat(o.material).forEach(x => { if (envTex && "envMap" in x) { x.envMap = envTex; x.envMapIntensity = (x.userData && x.userData.vernice) || 1; x.needsUpdate = true; } }); });
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.updateMatrixWorld(true);
    return m;
  }
  // riferimenti del modello: tettuccio (per tutti) e deriva (per l'F-16), cercati per nome delle parti
  function riferimenti(m) {
    const can = new THREE.Box3(), fin = new THREE.Box3(); m.updateMatrixWorld(true);
    m.traverse(o => { if (!o.isMesh) return; const nm = ((o.name || "") + " " + ((o.parent && o.parent.name) || "")).toLowerCase();
      if (/canopy|window_lf/.test(nm)) can.expandByObject(o);
      if (/vertical.?stabilizer|deriva/.test(nm)) fin.expandByObject(o); });
    return { can: can.isEmpty() ? null : can, fin: fin.isEmpty() ? null : fin };
  }
  const suSuperficie = (m, x, z, box) => { const h = new THREE.Raycaster(V3(x, box.max.y + 5, z), V3(0, -1, 0), 0, box.max.y - box.min.y + 12).intersectObject(m, true)[0]; return h ? h.point.y : null; };
  function puntoAggancio(m, spec) {
    const box = new THREE.Box3().setFromObject(m), size = box.getSize(V3()), c = box.getCenter(V3()), L = size.z, rif = riferimenti(m);
    m.userData.muso = V3(0, c.y + 0.15 * size.y, box.max.z);
    const met = new THREE.MeshStandardMaterial({ color: 0x4f565d, metalness: 0.7, roughness: 0.4 });
    if (spec.metodo === "drogue") {
      // sonda estratta: base e punta rispetto al bordo anteriore e alla sommità del tettuccio del modello
      const ref = rif.can ? { y: rif.can.max.y, z: rif.can.max.z } : { y: c.y + 0.2 * size.y, z: box.max.z - 0.28 * L };
      const a = V3(spec.base[0], ref.y + spec.base[1], ref.z + spec.base[2]), p = V3(spec.punta[0], ref.y + spec.punta[1], ref.z + spec.punta[2]);
      const lato = Math.sign(spec.base[0]) || -1;
      if (!spec.esatta) {   // la base si appoggia sul fianco vero della fusoliera: raggio dall'esterno verso l'asse
        const h = new THREE.Raycaster(V3(lato * (size.x / 2 + 3), a.y, a.z), V3(-lato, 0, 0), 0, size.x / 2 + 3).intersectObject(m, true)[0];
        if (h && Math.abs(h.point.x) < Math.abs(a.x) + 0.6) { const dx = h.point.x + lato * 0.03 - a.x; a.x += dx; p.x += dx; }
      }
      const d = p.clone().sub(a), asta = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, d.length(), 10), met);
      asta.position.copy(a).addScaledVector(d, 0.5); asta.quaternion.setFromUnitVectors(V3(0, 1, 0), d.clone().normalize()); m.add(asta);
      const ugello = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.2, 10), met); ugello.position.copy(p); ugello.quaternion.copy(asta.quaternion); m.add(ugello);
      if (!spec.esatta) {   // carenatura della sonda (sull'EA-18G c'è già quella del modello)
        const car = new THREE.Mesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.1, 0.6, 4, 10) : new THREE.CylinderGeometry(0.1, 0.1, 0.8, 10), new THREE.MeshStandardMaterial({ color: 0xb9c0c6, metalness: 0.3, roughness: 0.6 }));
        car.rotation.x = Math.PI / 2; car.position.copy(a).add(V3(0, 0, -0.2)); m.add(car);
      }
      m.userData.aggancio = { metodo: "drogue", base: a.toArray(), punta: p.toArray(), tettuccio: rif.can ? [rif.can.min.z, rif.can.max.z, rif.can.max.y] : null };
      return p;
    }
    // braccio rigido: punto del ricettacolo sulla superficie superiore del modello
    let z;
    if (spec.rif === "metaDorso" && rif.can && rif.fin) z = (rif.can.min.z + rif.fin.max.z) / 2;   // a metà fra tettuccio e base della deriva
    else if (rif.can) z = rif.can.min.z + (spec.dz || -1);                                         // dietro il bordo posteriore del tettuccio
    else z = box.max.z - 0.36 * L;
    const y = suSuperficie(m, spec.x, z, box), p = V3(spec.x, y != null ? y + 0.03 : box.max.y - size.y * 0.3, z);
    // vano del ricettacolo con la sua luce; sull'F-22 i due portelli a farfalla aperti
    const vano = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.56), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.9 })); vano.position.copy(p); m.add(vano);
    const luce = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff1b0 })); luce.position.copy(p).add(V3(0, 0.03, -0.4)); m.add(luce);
    if (spec.portelli) [1, -1].forEach(s => {
      const pv = new THREE.Group(); pv.position.copy(p).add(V3(s * 0.2, 0, 0)); pv.rotation.z = s * 1.05;
      const porta = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.58), new THREE.MeshStandardMaterial({ color: 0x9aa1a8, metalness: 0.4, roughness: 0.5 })); porta.position.y = 0.21; pv.add(porta);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06, 0.4), new THREE.MeshBasicMaterial({ color: 0xc8ffd8 })); l.position.set(-s * 0.02, 0.33, 0); pv.add(l); m.add(pv);
    });
    m.userData.aggancio = { metodo: "boom", ricettacolo: p.toArray(), tettuccio: rif.can ? [rif.can.min.z, rif.can.max.z] : null, deriva: rif.fin ? rif.fin.max.z : null };
    return p;
  }

  /* ---------- una scena ---------- */
  async function mostra(r) {
    prepara(); await tankerP; dimensiona();
    // ogni velivolo usa sempre il suo sistema: F-15E, F-16 e F-22 hanno solo il ricettacolo per il braccio, gli altri solo la sonda
    const spec = RIC[r.tipo] || RIC.F16, metodo = spec.metodo, specM = spec;
    // via la scena precedente (geometrie dei GLB condivise con le altre viste: si liberano solo i materiali clonati qui)
    if (S.scena) { S.scena.forEach(o => { scene.remove(o); o.traverse(x => { if (x.material) [].concat(x.material).forEach(mm => mm.dispose && mm.dispose()); }); }); S.scena = null; }
    const parti = tanker.userData.parti || {}, boom = parti.boom;
    if (boom) { boom.rotation.set(-0.55, 0, 0); boom.visible = true; }
    tubi.forEach(t => t.obj.forEach(o => { o.visible = metodo === "drogue"; }));   // con il braccio rigido i tubi alari restano ritirati
    tanker.updateMatrixWorld(true);
    const m = await ricevitore(r.tipo), pr = puntoAggancio(m, specM), oggetti = [];
    let C, flusso;
    if (metodo === "boom" && boom) {
      const piv = boom.localToWorld(V3(0, 0, 0)), tip = boom.localToWorld(V3(0, 0, -16.05)); C = tip;
      m.position.copy(tip).sub(pr); flusso = u => piv.clone().lerp(tip, u);
    } else {
      // pod dal lato della sonda: sonda a destra (EA-18G, Eurofighter) → pod destro (−X); a sinistra (Su-35, Su-57) → pod sinistro (+X)
      const iPod = (spec.base && spec.base[0] > 0) ? 0 : 1; S.iPod = iPod;
      const t = tubi[iPod] || tubi[0]; C = t.aggancio.clone(); tanker.localToWorld(C);
      m.position.copy(C).sub(pr); flusso = u => tanker.localToWorld(t.curva.getPointAt(u).clone());
    }
    scene.add(m); oggetti.push(m);
    // gregari: un secondo ricevitore sull'altro cestello (sonda) o in attesa a sinistra del tanker
    const n = Math.min(3, Math.max(0, (r.n || 1) - 1));
    for (let k = 0; k < n; k++) {
      const w = m.clone(true);
      const altro = tubi[1 - (S.iPod || 0)];
      if (metodo === "drogue" && k === 0 && altro) { const C2 = tanker.localToWorld(altro.aggancio.clone()); w.position.copy(C2).sub(pr); }   // secondo velivolo sull'altro pod
      else { const j = metodo === "drogue" ? k - 1 : k; w.position.set(31 + 15 * j, -5 - 1.5 * j, -16 - 7 * j); }
      scene.add(w); oggetti.push(w);
    }
    // carburante che scorre e bagliore al contatto
    const gocce = []; const matG = new THREE.MeshBasicMaterial({ color: 0xa8e6ff, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), matG); s.visible = false; scene.add(s); gocce.push(s); oggetti.push(s); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: (typeof VISTA3D !== "undefined" && VISTA3D.puffTexture) ? VISTA3D.puffTexture(true) : puff(), color: 0xbfeaff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.copy(C); glow.scale.set(0.01, 0.01, 1); scene.add(glow); oggetti.push(glow);
    S.scena = oggetti;
    // testi
    const q = s => ov.querySelector(s);
    q(".aar-chi").textContent = `${r.callsign} · ${r.n}× ${NOMI[r.tipo] || r.tipo}  ←  ${r.tanker}`;
    q(".aar-met").textContent = metodo === "boom" ? "Braccio rigido (boom): F-15E, F-16 e F-22 hanno il ricettacolo, non la sonda" : "Sonda e cestello (probe & drogue): EA-18G, Eurofighter, Su-35 e Su-57 hanno la sonda, non il ricettacolo";
    const didascalie = [r.emergenza ? "Carburante al minimo: rifornimento d'emergenza" : "In formazione dietro il tanker, a 25.000 piedi",
      metodo === "boom" ? `L'operatore guida il braccio verso ${spec.punto || "il ricettacolo"}` : `Il pilota infila nel cestello ${spec.punto || "la sonda"}`,
      "CONTATTO · travaso del carburante in corso"];
    // camera: inquadratura larga → avvicinamento con zoom → primo piano sul contatto
    const lato = C.x < -1 ? -1 : 1, mezzo = V3(C.x * 0.55, C.y * 0.5, C.z * 0.62);
    // con la sonda si guarda fra cestello e muso del ricevitore, da dietro e un po' più in basso
    m.updateMatrixWorld(true); const muso = m.localToWorld(m.userData.muso.clone()); S.dbg = { C: C.toArray().map(v => +v.toFixed(2)), pr: pr.toArray().map(v => +v.toFixed(2)), m: m.position.toArray().map(v => +v.toFixed(2)), muso: muso.toArray().map(v => +v.toFixed(2)), punta: m.localToWorld(pr.clone()).toArray().map(v => +v.toFixed(2)), aggancio: m.userData.aggancio }; const F = metodo === "boom" ? C.clone() : C.clone().lerp(muso, 0.45);
    const A0 = C.clone().add(V3(lato * 50, -11, -48)), A1 = C.clone().add(V3(lato * 42, -9, -38)), D = F.clone().add(metodo === "boom" ? V3(lato * 7.2, 1.3, -8.2) : V3(lato * 5.6, -1.25, -7.4));
    const vD = D.clone().sub(F), r0 = Math.hypot(vD.x, vD.z), ang0 = Math.atan2(vD.x, vD.z);
    // shader compilati e primo fotogramma disegnato PRIMA di mostrare: i 4 secondi partono da quello che si vede
    camera.position.copy(A0); camera.lookAt(mezzo); camera.fov = 42; camera.updateProjectionMatrix(); cielo.position.copy(camera.position);
    try { renderer.compile(scene, camera); } catch (e) {} renderer.render(scene, camera);
    if (!S.inCorso) return;   // saltata mentre si preparava
    S.attiva = true; ov.className = "aar-on"; const t0 = performance.now(); let fase = -1, tPrec = 0;
    // un fotogramma all'istante t (secondi dall'inizio): usato dall'animazione e, per i controlli, da _fotogramma(t)
    const disegna = t => {
      const dt = Math.max(0, Math.min(0.25, t - tPrec)); tPrec = t;
      nuvole.forEach(s => { s.position.z -= VEL_REL * dt; if (s.position.z < -4500) s.position.z += 9000; });
      if (tanker.userData.anim) { try { tanker.userData.anim({ t, afterburner: 0 }); } catch (e) {} }
      if (boom) boom.rotation.set(-0.55, 0, 0);
      let p, look, fov;
      if (t < 1.4) { const k = ease(t / 1.4); p = A0.clone().lerp(A1, k); look = mezzo; fov = 42; }
      else if (t < 2.8) { const k = ease((t - 1.4) / 1.4); p = A1.clone().lerp(D, k); look = mezzo.clone().lerp(F, k); fov = lerp(42, 30, k); }
      else { const k = Math.min(1, (t - 2.8) / 1.2), a = ang0 + lato * 0.38 * k, rr = r0 * lerp(1, 0.9, k); p = V3(F.x + Math.sin(a) * rr, D.y - 0.2 * k, F.z + Math.cos(a) * rr); look = F; fov = lerp(30, 26, k); }
      camera.position.copy(p); camera.lookAt(look); camera.fov = fov; camera.updateProjectionMatrix(); cielo.position.copy(camera.position);
      // flusso di carburante dopo il contatto
      const flow = t > 1.9;
      gocce.forEach((s, i) => { s.visible = flow; if (flow) s.position.copy(flusso(((t * 1.25) + i / gocce.length) % 1)); });
      const g = flow ? 0.7 + 0.25 * Math.sin(t * 18) : 0; glow.scale.set(g, g, 1);
      const f = t < 1.4 ? 0 : t < 2.8 ? 1 : 2; if (f !== fase) { fase = f; q(".aar-cap").textContent = didascalie[f]; q(".aar-cap").classList.toggle("contatto", f === 2); }
      q(".aar-bar span").style.width = Math.min(100, t / (DURATA / 1000) * 100) + "%";
      if (t * 1000 >= DURATA - 280) ov.classList.add("aar-esce");
      renderer.render(scene, camera);
    };
    S.disegna = disegna;
    const passo = now => {
      if (!S.attiva) return; const t = (now - t0) / 1000;
      disegna(t);
      if (t * 1000 >= DURATA) { fine(); return; }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
  }
  function dimensiona() { if (!renderer) return; renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / Math.max(1, window.innerHeight); camera.updateProjectionMatrix(); }

  /* ---------- quando mostrarla ---------- */
  const multi = () => typeof RETE !== "undefined" && (RETE.attiva || (RETE.client && RETE.client()));
  const cadetCard = () => typeof CADET !== "undefined" && CADET.attiva && CADET.stato && CADET.stato.card;
  function avvia(r) {
    // all'inizio di una sequenza (una o più formazioni di fila) si ricorda se la simulazione stava andando
    if (!S.sequenza) { S.sequenza = true; S.eraInPlay = APP.playing; }
    if (!multi()) APP.play(false);
    S.inCorso = true;
    mostra(r).catch(e => { console.warn("cinematica rifornimento", e); fine(); });
  }
  function fine() {
    if (!S.inCorso) return; S.inCorso = false; S.attiva = false;
    cancelAnimationFrame(raf); if (ov) ov.className = "aar-off";
    const prossima = S.coda.shift(); if (prossima) { setTimeout(() => avvia(prossima), 120); return; }
    S.sequenza = false;
    // riparte se stava andando (o se una missione Cadetto senza schede aperte deve proseguire)
    const cadetVuole = typeof CADET !== "undefined" && CADET.attiva && CADET.stato && !CADET.stato.card && !CADET.stato.fine;
    if (!multi() && (S.eraInPlay || cadetVuole) && !cadetCard() && APP.engine && !APP.engine.finita && !(typeof VISTA3D !== "undefined" && VISTA3D.attiva)) APP.play(true);
    S.eraInPlay = false;
  }
  function suEvento(e, eng) {
    if (!abil || !e || eng !== APP.engine) return;
    const m = /^Rifornimento in volo iniziato con (.+) \(\d+ min\)$/.exec(e.testo || "") || /^MINIMUM FUEL – rifornimento d'emergenza dal pod alare di (.+)$/.exec(e.testo || "");
    if (!m || APP.ruolo === "RED" || (typeof RETE !== "undefined" && RETE.bulk) || document.hidden) return;
    const f = eng.flights.find(x => x.callsign === e.chi || x.id === e.chi); if (!f || !RIC[f.tipo]) return;
    const k = f.id + ":" + f.sortie; if (S.visti[k]) return; S.visti[k] = true;   // una volta per formazione e per sortita
    const r = { callsign: f.callsign, n: f.n, tipo: f.tipo, tanker: m[1], emergenza: /MINIMUM/.test(e.testo) };
    if (S.inCorso || S.coda.length) { if (S.coda.length < 3) S.coda.push(r); return; }
    setTimeout(() => avvia(r), 0);
  }
  // si aggancia a ogni nuovo motore di simulazione (ogni ⟲, missione caricata, Cadetto…)
  let engCorrente = null;
  setInterval(() => {
    if (typeof APP === "undefined" || !APP.engine || APP.engine === engCorrente) return;
    const eng = APP.engine; engCorrente = eng; S.visti = {};
    eng.on(ev => { if (ev && ev.tipo === "evento") { try { suEvento(ev.e, eng); } catch (x) { console.warn(x); } } });
  }, 300);
  // interruttore nel pannello Esecuzione, accanto a quello della cinematica degli attacchi
  window.addEventListener("DOMContentLoaded", () => setTimeout(() => {
    if (typeof UI === "undefined" || !UI.esecuzione) return; const orig = UI.esecuzione;
    UI.esecuzione = function () { const out = orig.apply(this, arguments); try { interruttore(); } catch (e) {} return out; };
  }, 0));
  function interruttore() {
    const v = document.getElementById("chk-v3d"); if (!v || document.getElementById("chk-aar-cine")) return;
    const lab = document.createElement("label"); lab.style.cssText = "display:block;margin-top:6px";
    lab.innerHTML = `<input type="checkbox" id="chk-aar-cine" ${abil ? "checked" : ""}> ⛽ <b>Cinematica del rifornimento in volo</b> <small>(4 secondi per formazione, poi la simulazione riparte)</small>`;
    (v.closest("label") || v).insertAdjacentElement("afterend", lab);
    lab.querySelector("input").onchange = e => { abil = e.target.checked; try { localStorage.setItem(KEY, abil ? "1" : "0"); } catch (x) {} };
  }
  function stile() {
    if (document.getElementById("aar-style")) return; const st = document.createElement("style"); st.id = "aar-style";
    st.textContent = `#aar-cine{position:fixed;inset:0;z-index:100050;background:#000;transition:opacity .25s ease;font-family:"Segoe UI",Roboto,Arial,sans-serif;color:#eef5fb;cursor:pointer}
      #aar-cine.aar-off{opacity:0;pointer-events:none;visibility:hidden}#aar-cine.aar-on{opacity:1}#aar-cine.aar-esce{opacity:0}
      #aar-cine canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
      #aar-cine .aar-top{position:absolute;top:14px;left:16px;text-shadow:0 2px 6px #000c}#aar-cine .aar-kick{font-weight:900;letter-spacing:.14em;font-size:14px;color:#f7dc6f}#aar-cine .aar-chi{font-size:15px;font-weight:700;margin-top:3px}
      #aar-cine .aar-cap{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);background:#0b1220cc;border:1px solid #ffffff30;border-radius:12px;padding:8px 16px;font-size:17px;font-weight:700;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis}
      #aar-cine .aar-cap.contatto{border-color:#7dffb0;color:#b9ffd1}
      #aar-cine .aar-met{position:absolute;left:16px;bottom:14px;font-size:12px;color:#c9d7e4;text-shadow:0 1px 4px #000}
      #aar-cine .aar-skip{position:absolute;right:16px;bottom:14px;font-size:12px;color:#c9d7e4;opacity:.8}
      #aar-cine .aar-bar{position:absolute;left:0;right:0;top:0;height:3px;background:#ffffff22}#aar-cine .aar-bar span{display:block;height:100%;width:0;background:#f7dc6f}
      @media (max-height:460px){#aar-cine .aar-cap{font-size:14px;bottom:34px;padding:6px 12px}#aar-cine .aar-chi{font-size:13px}#aar-cine .aar-kick{font-size:12px}}
      @media (max-width:560px){#aar-cine .aar-cap{white-space:normal;text-align:center;width:88vw;bottom:40px;font-size:15px}#aar-cine .aar-met{display:none}#aar-cine .aar-chi{font-size:13px;max-width:92vw}}`;
    document.head.appendChild(st);
  }
  return { get attiva() { return S.attiva; }, get abilitata() { return abil; }, set abilitata(v) { abil = !!v; }, mostra: r => avvia(r),
    // per i controlli automatici: ferma l'animazione e disegna l'istante t
    _fotogramma: t => { cancelAnimationFrame(raf); if (S.disegna) S.disegna(t); }, _S: S };
})();
