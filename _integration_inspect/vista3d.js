/* =====================================================================
   VISTA 3D DELL'ATTACCO – v2 (Three.js, locale)
   - terreno con quote reali (AWS Terrarium) + imagery satellitare Esri (zoom 14 e 16)
   - cielo con sole calcolato dall'ora della simulazione, nubi/visibilità/vento dal meteo reale NOAA
   - velivoli estrusi dalle sagome reali (icone del corso) con fusoliera, tettuccio, derive, ugelli
   - GBU guidate, esplosioni con shader particellare (fuoco additivo, fumo, polvere), onda d'urto, flash,
     detriti con scia, incendi persistenti, crateri e bruciature
   - HUD stile caccia nella vista di inseguimento e bomb-cam
   - registrazione WebM (MediaRecorder) per il video di lancio
   ===================================================================== */
const VISTA3D = (() => {
  const TS = 2.5, G = 9.81;
  let overlay, canvas, hudCanvas, hudCtx, renderer, scene, camera, clock, raf, st, audio, recorder, recChunks;
  const TERRA = { grids: {}, ready: false, base: 0, t14: null, tileM: 0 };

  /* ---------- DOM ---------- */
  function dom() {
    if (overlay) return;
    overlay = document.createElement("div"); overlay.id = "vista3d"; overlay.className = "hidden";
    overlay.innerHTML = `<canvas id="v3d-canvas"></canvas><canvas id="v3d-hud-canvas"></canvas>
      <div class="v3d-hud"><div class="v3d-top"><span id="v3d-cs"></span><span id="v3d-tgt"></span></div>
      <div id="v3d-msg" class="v3d-msg"></div><div id="v3d-banner" class="v3d-banner"></div>
      <div class="v3d-bottom"><span id="v3d-info"></span><button id="v3d-skip" class="btn">Salta ▶</button></div></div>`;
    document.body.appendChild(overlay); canvas = overlay.querySelector("#v3d-canvas"); hudCanvas = overlay.querySelector("#v3d-hud-canvas"); hudCtx = hudCanvas.getContext("2d");
    overlay.querySelector("#v3d-skip").onclick = () => chiudi();
    window.addEventListener("resize", ridimensiona);
  }
  function ridimensiona() { if (!renderer || overlay.classList.contains("hidden")) return; renderer.setSize(window.innerWidth, window.innerHeight); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); hudCanvas.width = window.innerWidth; hudCanvas.height = window.innerHeight; }

  /* ---------- audio ---------- */
  function audioInit() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)(); const master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      const dest = ctx.createMediaStreamDestination(); master.connect(dest);
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = buf.getChannelData(0); let last = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      const jet = ctx.createBufferSource(); jet.buffer = buf; jet.loop = true; const jf = ctx.createBiquadFilter(); jf.type = "lowpass"; jf.frequency.value = 220; const jg = ctx.createGain(); jg.gain.value = 0; jet.connect(jf); jf.connect(jg); jg.connect(master); jet.start();
      return { ctx, master, dest, noise: buf, jetGain: jg };
    } catch (e) { return null; }
  }
  function suonoEsplosione(dist) {
    if (!audio) return; const { ctx, master, noise } = audio; const t = ctx.currentTime + Math.min(1.5, dist / 340);
    const src = ctx.createBufferSource(); src.buffer = noise; const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(70, t + 1.8);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.3, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + 2.8);
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(55, t); o.frequency.exponentialRampToValueAtTime(25, t + 1.4); const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.9, t + 0.03); og.gain.exponentialRampToValueAtTime(0.0001, t + 1.8); o.connect(og); og.connect(master); o.start(t); o.stop(t + 2);
  }
  function suonoFischio(durata) {
    if (!audio) return; const { ctx, master } = audio; const t = ctx.currentTime; const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(380, t + durata);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + durata); o.connect(g); g.connect(master); o.start(t); o.stop(t + durata + 0.1);
  }

  /* ---------- utilità ---------- */
  function matStd(c, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7, metalness: 0.3 }, extra || {})); }
  function srgb(tex) { if (THREE.sRGBEncoding !== undefined && tex.encoding !== undefined) tex.encoding = THREE.sRGBEncoding; else if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace; return tex; }
  function lonLatToTile(lon, lat, z) { const n = 2 ** z; const x = (lon + 180) / 360 * n; const lr = lat * Math.PI / 180; const y = (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n; return { x, y, n }; }
  /* ---------- tile: proxy locale con cache (server.py /tile/...) oppure sorgenti dirette; caricamento con tentativi ripetuti ---------- */
  const TILE = { proxy: false };
  function tileUrl(kind, z, x, y) {
    if (TILE.proxy) return `tile/${kind}/${z}/${x}/${y}`;
    return kind === "dem" ? `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png` : `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  }
  function caricaTex(loader, url, onok, onfail, tent) { tent = tent || 0; loader.load(url, onok, undefined, () => { if (tent < 2) setTimeout(() => caricaTex(loader, url, onok, onfail, tent + 1), 900 * (tent + 1)); else if (onfail) onfail(); }); }
  function caricaDem(url, onok, onfail, tent) { tent = tent || 0; const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => onok(img); img.onerror = () => { if (tent < 2) setTimeout(() => caricaDem(url, onok, onfail, tent + 1), 900 * (tent + 1)); else if (onfail) onfail(); }; img.src = url; }
  function demGrid(img) { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, 256, 256).data; const arr = new Float32Array(65536); for (let i = 0; i < 65536; i++) arr[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768; return arr; }
  const elev = (x, z) => {
    if (!TERRA.ready) return 0; const fx = TERRA.t14.x + x / TERRA.tileM, fy = TERRA.t14.y + z / TERRA.tileM; const tx = Math.floor(fx), ty = Math.floor(fy); const g = TERRA.grids[tx + "_" + ty]; if (!g) return 0;
    const px = (fx - tx) * 255, py = (fy - ty) * 255; const x0 = Math.floor(px), y0 = Math.floor(py), x1 = Math.min(255, x0 + 1), y1 = Math.min(255, y0 + 1); const ax = px - x0, ay = py - y0;
    const h = g[y0 * 256 + x0] * (1 - ax) * (1 - ay) + g[y0 * 256 + x1] * ax * (1 - ay) + g[y1 * 256 + x0] * (1 - ax) * ay + g[y1 * 256 + x1] * ax * ay; return h - TERRA.base;
  };

  /* ---------- terreno: quote Terrarium + imagery ---------- */
  function terreno(lat, lon, root) {
    const loader = new THREE.TextureLoader(); loader.setCrossOrigin("anonymous");
    const t14 = lonLatToTile(lon, lat, 14); const tileM = 40075016.686 * Math.cos(lat * Math.PI / 180) / t14.n;
    Object.assign(TERRA, { grids: {}, ready: false, base: 0, t14, tileM });
    const base = new THREE.Mesh(new THREE.PlaneGeometry(90000, 90000), matStd(0x55603f, { roughness: 1, metalness: 0 })); base.rotation.x = -Math.PI / 2; base.position.y = -3; root.add(base);
    const meshes = []; const R14 = 4, R16 = 2;
    const mk = (z, r, y, seg, t) => { const tx = Math.floor(t.x), ty = Math.floor(t.y); const tm = 40075016.686 * Math.cos(lat * Math.PI / 180) / t.n;
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
        const cx = (tx + dx + 0.5 - t.x) * tm, cz = (ty + dy + 0.5 - t.y) * tm; const geo = new THREE.PlaneGeometry(tm, tm, seg, seg); geo.rotateX(-Math.PI / 2);
        const mat = matStd(0x4f5d3a, { roughness: 1, metalness: 0 }); const mesh = new THREE.Mesh(geo, mat); mesh.position.set(cx, y, cz); mesh.receiveShadow = true; mesh.visible = false; root.add(mesh); meshes.push(mesh);
        caricaTex(loader, tileUrl("img", z, tx + dx, ty + dy), tex => { srgb(tex); tex.anisotropy = 8; mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; mesh.visible = true; }, () => { if (z === 14) mesh.visible = true; });
      } };
    mk(14, R14, 0, 32, t14); mk(16, R16, 0.6, 24, lonLatToTile(lon, lat, 16));
    // quote: tile Terrarium (AWS) 256 px, h = R*256 + G + B/256 - 32768
    const tx = Math.floor(t14.x), ty = Math.floor(t14.y); let pending = 0;
    const done = () => { if (--pending > 0) return; TERRA.ready = true; TERRA.base = 0; TERRA.base = elev(0, 0);
      meshes.forEach(m => { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, elev(p.getX(i) + m.position.x, p.getZ(i) + m.position.z)); p.needsUpdate = true; m.geometry.computeVertexNormals(); });
      if (st) st.terrenoPronto = true; };
    for (let dx = -R14; dx <= R14; dx++) for (let dy = -R14; dy <= R14; dy++) {
      pending++;
      caricaDem(tileUrl("dem", 14, tx + dx, ty + dy), img => { try { TERRA.grids[(tx + dx) + "_" + (ty + dy)] = demGrid(img); } catch (e) {} done(); }, done);
    }
  }

  /* ---------- cielo, sole, nubi ---------- */
  function sole(ora, lat, giorno) { // elevazione/azimut approssimati (ora locale solare)
    const decl = 23.44 * Math.sin(2 * Math.PI * (284 + giorno) / 365) * Math.PI / 180; const H = (ora - 12.5) * 15 * Math.PI / 180; const φ = lat * Math.PI / 180;
    const el = Math.asin(Math.sin(φ) * Math.sin(decl) + Math.cos(φ) * Math.cos(decl) * Math.cos(H));
    const az = Math.atan2(-Math.sin(H), Math.tan(decl) * Math.cos(φ) - Math.sin(φ) * Math.cos(H));
    return { el, az };
  }
  function cielo(o) {
    const m = (o.meteo || {}); const s = sole(o.ora != null ? o.ora : 10.5, o.target.lat, m.giorno || 165);
    const elN = Math.max(0, Math.sin(s.el)); const cop = m.copertura || 0;
    const zen = new THREE.Color().setHSL(0.6, 0.65 - 0.35 * cop, 0.45 + 0.25 * elN - 0.12 * cop); const hor = new THREE.Color().setHSL(0.58 - 0.08 * (1 - elN), 0.5 - 0.3 * cop, 0.78 - 0.15 * cop);
    if (elN < 0.25) { hor.setHSL(0.07, 0.75, 0.6); zen.setHSL(0.62, 0.55, 0.25 + elN); }
    const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { zen: { value: zen }, hor: { value: hor } },
      vertexShader: "varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 zen; uniform vec3 hor; varying vec3 vW; void main(){ float h = normalize(vW).y; float k = pow(max(0.0, h), 0.45); gl_FragColor = vec4(mix(hor, zen, k), 1.0); }" });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(38000, 32, 16), skyMat); scene.add(dome);
    const sunDir = new THREE.Vector3(Math.sin(s.az) * Math.cos(s.el), Math.sin(s.el), -Math.cos(s.az) * Math.cos(s.el)).normalize();
    const sun = new THREE.DirectionalLight(new THREE.Color().setHSL(0.1, 0.5, elN < 0.25 ? 0.6 : 0.95), (0.4 + 1.1 * elN) * (1 - 0.55 * cop)); sun.position.copy(sunDir).multiplyScalar(4000); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -700, right: 700, top: 700, bottom: -700, near: 100, far: 9000 }); sun.shadow.bias = -0.0005; scene.add(sun);
    scene.add(new THREE.HemisphereLight(hor.clone().multiplyScalar(1.1), 0x4a4030, 0.5 + 0.25 * cop));
    const sunTex = puffTexture(true); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, color: 0xfff4d6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.copy(sunDir).multiplyScalar(30000); sp.scale.setScalar(4500); scene.add(sp);
    // visibilità → nebbia; nubi → strato a quota base
    const visM = Math.max(2000, (m.visibilita_sm != null ? m.visibilita_sm : 10) * 1609); scene.fog = new THREE.Fog(hor.clone().lerp(zen, 0.25), visM * 0.25, visM * 1.05); scene.background = hor;
    if (cop > 0.1) { const baseFt = m.nubi_base_ft || 6000; const h = baseFt * 0.3048; const tex = nuvoleTexture(cop); const cm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, fog: true }); const cl = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), cm); cl.rotation.x = -Math.PI / 2; cl.position.y = h; cl.renderOrder = -1; scene.add(cl); st.nubi = { mesh: cl, tex }; }
    st.vento = ventoVettore(m); st.sunDir = sunDir;
    overlay.querySelector("#v3d-info").textContent = `VISTA 3D · tempo ×${TS} · quote AWS Terrarium · imagery Esri${m.reale ? " · meteo NOAA " + (m.aggiornato || "") : ""} · sole ${Math.round(s.el * 180 / Math.PI)}°`;
  }
  function ventoVettore(m) { const da = (m.vento_suolo_da != null ? m.vento_suolo_da : m.vento_da_gradi || 270) * Math.PI / 180; const kt = (m.vento_suolo_kt != null ? m.vento_suolo_kt : (m.vento_kt || 10) * 0.4); const v = kt * 0.5144; return new THREE.Vector3(-Math.sin(da) * v, 0, Math.cos(da) * v); }
  function nuvoleTexture(cop) {
    const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d"); g.clearRect(0, 0, 512, 512);
    const n = Math.round(60 + 400 * cop); for (let i = 0; i < n; i++) { const x = Math.random() * 512, y = Math.random() * 512, r = 25 + Math.random() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, r); const a = 0.25 + 0.55 * cop; gr.addColorStop(0, `rgba(245,245,250,${a})`); gr.addColorStop(0.6, `rgba(225,228,235,${a * 0.6})`); gr.addColorStop(1, "rgba(220,224,232,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); return t;
  }
  function puffTexture(soft) {
    const key = soft ? "s" : "p"; puffTexture.c = puffTexture.c || {}; if (puffTexture.c[key]) return puffTexture.c[key];
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    if (soft) { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,0.6)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
    else { for (let i = 0; i < 34; i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * 26; const x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, r = 14 + Math.random() * 28; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,0.32)"); gr.addColorStop(0.5, "rgba(255,255,255,0.12)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
      // maschera radiale morbida: niente bordi netti
      g.globalCompositeOperation = "destination-in"; const mk = g.createRadialGradient(64, 64, 10, 64, 64, 64); mk.addColorStop(0, "rgba(0,0,0,1)"); mk.addColorStop(0.55, "rgba(0,0,0,0.8)"); mk.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = mk; g.fillRect(0, 0, 128, 128); g.globalCompositeOperation = "source-over"; }
    puffTexture.c[key] = new THREE.CanvasTexture(c); return puffTexture.c[key];
  }

  /* ---------- sistema particellare con shader (fuoco / fumo / polvere) ---------- */
  function particelle(n, tipo) {
    const geo = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3).fill(-9000), vel = new Float32Array(n * 3), start = new Float32Array(n).fill(-1e9), life = new Float32Array(n).fill(1), size = new Float32Array(n), rot = new Float32Array(n), seed = new Float32Array(n);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("aVel", new THREE.BufferAttribute(vel, 3)); geo.setAttribute("aStart", new THREE.BufferAttribute(start, 1)); geo.setAttribute("aLife", new THREE.BufferAttribute(life, 1)); geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1)); geo.setAttribute("aRot", new THREE.BufferAttribute(rot, 1)); geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const fire = tipo === "fire";
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: fire ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true,
      uniforms: Object.assign({ map: { value: puffTexture(false) }, uTime: { value: 0 }, uWind: { value: new THREE.Vector3() }, uScale: { value: 900 }, uFire: { value: fire ? 1 : 0 }, uDust: { value: tipo === "dust" ? 1 : 0 } }, THREE.UniformsUtils.clone(THREE.UniformsLib.fog)),
      vertexShader: `attribute vec3 aVel; attribute float aStart, aLife, aSize, aRot, aSeed; uniform float uTime, uScale, uFire; uniform vec3 uWind; varying float vT, vRot, vSeed; varying float vFog;
        void main(){ float t = (uTime - aStart) / aLife; vT = clamp(t, 0.0, 1.0); vRot = aRot + t * 1.2 * (aSeed - 0.5); vSeed = aSeed;
          float tt = max(t, 0.0) * aLife; vec3 p = position + aVel * tt * (1.0 - 0.45 * vT) + uWind * tt + vec3(0.0, (uFire > 0.5 ? 6.0 : 9.0) * tt * (1.0 - 0.3 * vT), 0.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); float grow = uFire > 0.5 ? (0.5 + 1.6 * vT) : (0.35 + 2.4 * vT);
          gl_PointSize = (t < 0.0 || t > 1.0) ? 0.0 : aSize * grow * uScale / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; vFog = -mv.z; }`,
      fragmentShader: `uniform sampler2D map; uniform float uFire, uDust; uniform vec3 fogColor; uniform float fogNear, fogFar; varying float vT, vRot, vSeed, vFog;
        void main(){ vec2 uv = gl_PointCoord - 0.5; float c = cos(vRot), s = sin(vRot); uv = vec2(c*uv.x - s*uv.y, s*uv.x + c*uv.y) + 0.5; vec4 tex = texture2D(map, uv);
          vec3 col; float a;
          if (uFire > 0.5) { col = mix(vec3(1.0, 0.95, 0.65), vec3(1.0, 0.25, 0.03), pow(vT, 0.6)) * (2.2 - 1.6 * vT); a = tex.a * (1.0 - vT) * (1.0 - vT); }
          else if (uDust > 0.5) { col = vec3(0.60, 0.53, 0.40); a = tex.a * 0.42 * (1.0 - vT); }
          else { col = mix(vec3(0.40, 0.37, 0.34), vec3(0.09, 0.09, 0.10), min(1.0, vT * 1.6 + 0.2 * vSeed)); a = tex.a * 0.72 * (1.0 - vT * vT); }
          float f = smoothstep(fogNear, fogFar, vFog); col = mix(col, fogColor, f * (uFire > 0.5 ? 0.0 : 0.8)); a *= (1.0 - f * 0.9);
          gl_FragColor = vec4(col, a); }` });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.userData = { n, next: 0 }; return pts;
  }
  function emit(pts, p, n, vel, spread, life, size) {
    const g = pts.geometry, u = pts.userData; const P = g.attributes.position.array, V = g.attributes.aVel.array, S = g.attributes.aStart.array, L = g.attributes.aLife.array, Z = g.attributes.aSize.array, R = g.attributes.aRot.array, D = g.attributes.aSeed.array;
    for (let k = 0; k < n; k++) { const i = u.next; u.next = (u.next + 1) % u.n; P[i * 3] = p.x + (Math.random() - 0.5) * spread; P[i * 3 + 1] = p.y + Math.random() * spread * 0.4; P[i * 3 + 2] = p.z + (Math.random() - 0.5) * spread;
      const a = Math.random() * Math.PI * 2, r = Math.random(); V[i * 3] = vel.x + Math.cos(a) * vel.w * r; V[i * 3 + 1] = vel.y * (0.4 + Math.random()); V[i * 3 + 2] = vel.z + Math.sin(a) * vel.w * r; S[i] = st.t; L[i] = life * (0.6 + Math.random() * 0.8); Z[i] = size * (0.6 + Math.random() * 0.8); R[i] = Math.random() * 6.28; D[i] = Math.random(); }
    ["position", "aVel", "aStart", "aLife", "aSize", "aRot", "aSeed"].forEach(k => g.attributes[k].needsUpdate = true);
  }

  /* ---------- modelli: estrusione delle sagome reali ---------- */
  const TIPI3D = { f22: { len: 18.9, span: 13.6, code: [-1.6, 1.6], tailZ: -0.33, tailH: 2.6, cant: 0.45, ugelli: 2, col: 0x6b7280 }, f15: { len: 19.4, span: 13.0, code: [-1.5, 1.5], tailZ: -0.36, tailH: 3.2, cant: 0, ugelli: 2, col: 0x5c6670 }, f16: { len: 15.0, span: 9.8, code: [0], tailZ: -0.33, tailH: 3.0, cant: 0, ugelli: 1, col: 0x6a7380 }, typhoon: { len: 15.9, span: 11.0, code: [0], tailZ: -0.3, tailH: 3.2, cant: 0, ugelli: 2, col: 0x717a88 }, f16b: { len: 15.0, span: 9.8, code: [0], tailZ: -0.33, tailH: 3.0, cant: 0, ugelli: 1, col: 0x6a7380 } };
  const sagome = {};
  function caricaSagoma(nome) {
    if (sagome[nome]) return sagome[nome];
    sagome[nome] = new Promise(res => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); const w = 64, h = Math.round(64 * img.height / img.width); c.width = w; c.height = h; const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data; const rows = [];
      for (let y = 0; y < h; y++) { let l = -1, r = -1; for (let x = 0; x < w; x++) { const a = d[(y * w + x) * 4 + 3]; if (a > 100) { if (l < 0) l = x; r = x; } } rows.push([l, r]); } res({ w, h, rows }); }; img.onerror = () => res(null); img.src = "assets/icons/" + nome + ".png"; });
    return sagome[nome];
  }
  function modelloDaSagoma(sg, cfg) {
    const g = new THREE.Group(); const m = matStd(cfg.col, { roughness: 0.55, metalness: 0.45 }); const dark = matStd(0x23272e, { metalness: 0.7, roughness: 0.4 });
    const scale = cfg.len / sg.h; const cx = sg.w / 2;
    const pts = []; const valid = sg.rows.map((r, y) => r[0] >= 0 ? { y, l: r[0], r: r[1] } : null).filter(Boolean);
    valid.forEach(v => pts.push([(v.r + 1 - cx) * scale, -(sg.h / 2 - v.y) * scale])); for (let i = valid.length - 1; i >= 0; i--) { const v = valid[i]; pts.push([(v.l - cx) * scale, -(sg.h / 2 - v.y) * scale]); }
    const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.3, bevelSegments: 2 }); geo.rotateX(-Math.PI / 2); geo.translate(0, -0.3, 0);
    const wing = new THREE.Mesh(geo, m); wing.castShadow = true; g.add(wing);
    // fusoliera a profilo (lathe) lungo Z
    const prof = [[0, 0.5], [0.3, 0.46], [0.75, 0.38], [1.0, 0.3], [1.15, 0.18], [1.2, 0.06], [1.0, -0.1], [0.75, -0.32], [0.45, -0.46], [0.15, -0.5], [0.02, -0.5]].map(([r, z]) => new THREE.Vector2(r * 1.05, z * cfg.len));
    const fus = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), m); fus.rotation.x = -Math.PI / 2; fus.castShadow = true; g.add(fus);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), new THREE.MeshStandardMaterial({ color: 0x1b2a3a, metalness: 0.95, roughness: 0.15 })); canopy.scale.set(1, 0.75, 2.6); canopy.position.set(0, 1.0, cfg.len * 0.22); g.add(canopy);
    cfg.code.forEach(x => { const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, cfg.tailH), new THREE.Vector2(-1.4, cfg.tailH), new THREE.Vector2(-3.2, 0)]); const tg = new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: false }); const fin = new THREE.Mesh(tg, m); fin.rotation.y = Math.PI / 2; fin.position.set(x, 0.6, cfg.tailZ * cfg.len); fin.rotation.z = x > 0 ? -cfg.cant : cfg.cant; fin.castShadow = true; g.add(fin); });
    const ux = cfg.ugelli === 2 ? [-0.75, 0.75] : [0]; ux.forEach(x => { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 1.6, 12, 1, true), dark); e.rotation.x = Math.PI / 2; e.position.set(x, -0.1, -cfg.len * 0.49); g.add(e); const glow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), new THREE.MeshBasicMaterial({ color: 0xffa040 })); glow.position.set(x, -0.1, -cfg.len * 0.49 - 0.8); glow.rotation.y = Math.PI; g.add(glow); });
    return g;
  }
  function jetFallback(colore) { const g = new THREE.Group(); const m = matStd(colore); const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 15, 12), m); fus.rotation.x = Math.PI / 2; g.add(fus); const ws = new THREE.Shape(); ws.moveTo(0, 2); ws.lineTo(6.5, -4.5); ws.lineTo(6.5, -6); ws.lineTo(0, -4.5); ws.lineTo(-6.5, -6); ws.lineTo(-6.5, -4.5); ws.lineTo(0, 2); const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(ws, { depth: 0.25, bevelEnabled: false }), m); wing.rotation.x = Math.PI / 2; g.add(wing); return g; }
  function bomba() { const g = new THREE.Group(); const m = matStd(0x3d4a3a, { metalness: 0.5 }); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.6, 10), m); body.rotation.x = Math.PI / 2; g.add(body); const nose = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 10), m); nose.rotation.x = Math.PI / 2; nose.position.z = 1.75; g.add(nose); [0, Math.PI / 2].forEach(r => { const fin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.7), m); fin.rotation.z = r; fin.position.z = -1.1; g.add(fin); }); return g; }
  function texEdificio(tipo, c) { // texture procedurale: lamiera grecata (hangar) o griglia di finestre (C2)
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 128; const g = cv.getContext("2d"); const col = new THREE.Color(c); g.fillStyle = `rgb(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)})`; g.fillRect(0, 0, 256, 128);
    if (tipo === "hangar") { for (let x = 0; x < 256; x += 6) { g.fillStyle = x % 12 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.08)"; g.fillRect(x, 0, 3, 128); } g.fillStyle = "rgba(20,24,30,0.75)"; g.fillRect(40, 48, 176, 80); g.fillStyle = "rgba(255,255,255,0.15)"; for (let x = 44; x < 216; x += 22) g.fillRect(x, 50, 2, 78); }
    else { for (let y = 10; y < 118; y += 16) for (let x = 8; x < 250; x += 14) { g.fillStyle = Math.random() < 0.7 ? "rgba(40,60,90,0.85)" : "rgba(220,230,240,0.6)"; g.fillRect(x, y, 9, 10); } }
    g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, 0, 256, 6); const t = new THREE.CanvasTexture(cv); srgb(t); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function edificio(w, d, h, c) { const tex = texEdificio(h > 20 ? "c2" : "hangar", c || 0x9aa0a6); tex.repeat.set(Math.max(1, Math.round(w / 40)), 1); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matStd(0xffffff, { map: tex, roughness: 0.85, metalness: 0.1 })); m.position.y = h / 2; m.castShadow = true; m.receiveShadow = true; const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.6, d * 1.02), matStd(0x55595e)); roof.position.y = h / 2; m.add(roof); m.userData.h = h; return m; }
  function elicottero() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 12), matStd(0x4b5a3f)); b.position.y = 1.6; g.add(b); const rot = new THREE.Mesh(new THREE.BoxGeometry(16, 0.12, 0.5), matStd(0x222)); rot.position.y = 3.4; g.add(rot); const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 7), matStd(0x4b5a3f)); tail.position.set(0, 2.2, -9); g.add(tail); g.userData.h = 3.5; return g; }
  function serbatoio() { const m = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 7, 20), matStd(0xd8d8d8, { metalness: 0.6, roughness: 0.4 })); m.position.y = 3.5; m.userData.h = 7; return m; }

  /* ---------- scena ---------- */
  function costruisci(o) {
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 60000);
    st = { o, objs: [], jets: [], bombs: [], impacts: [], debris: [], fires: [], t: 0, released: false, nextRelease: 0, bombsLeft: o.gbu, speed: 220, alt: 2500, pos: new THREE.Vector3(-7200, 2500, 0), shake: 0, resultShown: false, aimIdx: 0, log: [], heading: 90 };
    cielo(o);
    const ground = new THREE.Group(); scene.add(ground); terreno(o.target.lat, o.target.lon, ground);
    const cat = o.target.categoria; const tipoT = cat === "c2" || /C2/i.test(o.target.id) ? "c2" : /BENTON|HELO/i.test(o.target.id + o.target.nome) ? "helo" : cat && cat !== "aeroporto" ? cat : "airfield";
    const add = (m, x, z, ry) => { m.position.x = x; m.position.z = z; if (ry) m.rotation.y = ry; scene.add(m); st.objs.push(m); return m; };
    const box = (w, h, d, c, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matStd(c)); m.position.y = (y || 0) + h / 2; m.castShadow = true; m.receiveShadow = true; m.userData.h = h; return m; };
    const camion = (c, lung) => { const g = new THREE.Group(); g.add(box(2.6, 2.4, lung || 8, c)); const cab = box(2.5, 2.2, 2.2, 0x3b4232); cab.position.z = (lung || 8) / 2 + 1.1; g.add(cab); g.userData.h = 3; return g; };
    if (tipoT === "ponte") { const deck = box(18, 2.5, 420, 0x9c9a92, 22); add(deck, 0, 0); for (let z = -180; z <= 180; z += 60) { const p = box(6, 24, 6, 0x8a877e); add(p, -6, z); const p2 = box(6, 24, 6, 0x8a877e); add(p2, 6, z); } for (let i = 0; i < 4; i++) add(camion(0x4f5a3c), (i % 2 ? 3 : -3), -120 + i * 70); }
    else if (tipoT === "nave") { const scafo = box(26, 9, 150, 0x5d666e, -4); add(scafo, 0, 0); const ponte = box(18, 12, 30, 0x707a83, 5); add(ponte, 0, -25); const alb = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 22, 8), matStd(0x8d959c)); alb.position.y = 28; alb.userData.h = 22; add(alb, 0, -25); const prua = box(14, 6, 30, 0x5d666e, -2); add(prua, 0, 80); [-12, 12].forEach(x => add(box(3, 3, 8, 0x40474d, 5), x, 40)); }
    else if (tipoT === "radar") { add(box(6, 3, 10, 0x55603f), -25, 0); add(box(6, 3, 10, 0x55603f), 25, 10); const ant = box(14, 9, 0.8, 0xc7ccd1, 6); add(ant, 0, -30); const piat = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), matStd(0xe6e9ec)); piat.position.y = 2; piat.userData.h = 7; add(piat, 40, -40); [[-50, 30], [-10, 45], [30, 40]].forEach(([x, z]) => add(camion(0x4f5a3c, 7), x, z, 0.5)); }
    else if (tipoT === "deposito") { for (let i = 0; i < 8; i++) add(serbatoio(), (i % 4) * 40 - 60, Math.floor(i / 4) * 45 - 20); add(box(50, 8, 20, 0x8e9aa6), 0, 70); [[-80, 60], [80, 60]].forEach(([x, z]) => add(camion(0x8a6a2c, 10), x, z, 1.57)); }
    else if (tipoT === "ferrovia") { for (let b = -2; b <= 2; b++) for (let i = 0; i < 10; i++) add(box(3, 3.5, 14, i % 3 ? 0x6a4b3a : 0x3f4a55), b * 9, i * 16 - 80); add(box(30, 10, 60, 0x8e9aa6), 60, 0); add(box(12, 14, 12, 0xa3a7ad), -50, 60); }
    else if (tipoT === "convoglio" || tipoT === "lanciatore") { const n = tipoT === "convoglio" ? 12 : 3; for (let i = 0; i < n; i++) { const c = camion(i % 3 === 0 ? 0x4b5a3f : 0x56603f, tipoT === "lanciatore" ? 13 : 7); if (tipoT === "lanciatore") { const mis = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 11, 10), matStd(0xd9dcd5)); mis.rotation.x = 1.2; mis.position.set(0, 5, -1); c.add(mis); } add(c, (i % 2) * 4 - 2, i * (tipoT === "convoglio" ? 22 : 45) - n * 10); } }
    else if (tipoT === "hangar") { for (let i = 0; i < 4; i++) { const s2 = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 36, 16, 1, false, 0, Math.PI), matStd(0x7c8288)); s2.rotation.z = Math.PI / 2; s2.rotation.y = Math.PI / 2; s2.userData.h = 14; add(s2, i * 50 - 75, 0); } }
    else if (tipoT === "c2") { add(edificio(45, 45, 26, 0xb8bcc2), 0, 0); add(edificio(30, 18, 12, 0xa3a7ad), 60, 30); add(edificio(22, 22, 9, 0xa3a7ad), -55, 35); const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.2, 50, 8), matStd(0xdddddd)); mast.position.y = 25; mast.userData.h = 50; add(mast, 20, -50); }
    else if (tipoT === "helo") { add(edificio(70, 30, 12, 0x8e9aa6), -40, 60); add(edificio(50, 25, 10, 0x8e9aa6), 60, 70); [[-60, -20], [-20, -30], [20, -25], [60, -15], [0, -80]].forEach(([x, z]) => add(elicottero(), x, z, 0.4)); add(serbatoio(), 100, 20); }
    else { add(edificio(80, 35, 14, 0x8e9aa6), -90, 90); add(edificio(80, 35, 14, 0x8e9aa6), 10, 95); add(edificio(40, 40, 30, 0xb8bcc2), 110, 60); add(serbatoio(), 150, 110); add(serbatoio(), 165, 110); [[-120, -20], [-80, -20], [-40, -20], [0, -20], [40, -20], [80, -20]].forEach(([x, z]) => { const j = jetFallback(0x6b7076); j.scale.setScalar(0.9); j.position.y = 1.2; j.userData.h = 3; add(j, x, z, 0.3); }); }
    st.aims = st.objs.map(m => m.position.clone()).concat([new THREE.Vector3(-200, 0, 0), new THREE.Vector3(200, 0, 0), new THREE.Vector3(0, 0, 40), new THREE.Vector3(-100, 0, 20), new THREE.Vector3(100, 0, -40), new THREE.Vector3(0, 0, -60)]);
    // formazione (modelli dalle sagome reali, caricati in modo asincrono)
    const icona = (o.tipo && o.tipo.icona) || "f16"; const cfg = TIPI3D[icona] || TIPI3D.f16; const col = o.lato === "RED" ? 0x7a2b2b : cfg.col;
    const form = new THREE.Group(); st.form = form; scene.add(form);
    const offs = [[0, 0, 0], [45, -5, -40], [-45, -5, -40], [90, -10, -80]].slice(0, Math.max(1, Math.min(4, o.n || 4)));
    offs.forEach(([x, y, z]) => { const holder = new THREE.Group(); holder.position.set(x, y, z); const fb = jetFallback(col); fb.scale.setScalar(1.7); holder.add(fb); form.add(holder); st.jets.push(holder); });
    const tipoId = o.tipo && o.tipo.icona ? (ICONA2TIPO[o.tipo.icona] || "F16") : "F16";
    st.jets.forEach(h => { modelloPromise(icona, o.lato === "RED" ? col : undefined, { tipoId, armi: { AMRAAM: 4, GBU48: 4, ADDER: 6, POD: 4 } }).then(mdl => { if (!st) return; while (h.children.length) h.remove(h.children[0]); mdl.scale.setScalar(1.3); h.add(mdl); h.userData.mdl = mdl; }); });
    st.smoke = particelle(6000, "smoke"); st.fire = particelle(3000, "fire"); st.dust = particelle(2500, "dust"); [st.smoke, st.fire, st.dust].forEach(p => scene.add(p));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    hudSet(o);
  }
  function hudSet(o) { overlay.querySelector("#v3d-cs").textContent = `${o.callsign} · ${o.n}x ${o.tipo ? o.tipo.nome : ""} · IN HOT`; overlay.querySelector("#v3d-tgt").textContent = `TARGET: ${o.target.nome} · ${o.gbu} GBU-48`; msg("Formazione in avvicinamento – FL082 · 430 kt"); const b = overlay.querySelector("#v3d-banner"); b.textContent = ""; b.className = "v3d-banner"; }
  function msg(t) { overlay.querySelector("#v3d-msg").textContent = t; }
  function banner(t, cls) { const b = overlay.querySelector("#v3d-banner"); b.textContent = t; b.className = "v3d-banner show " + (cls || ""); }

  /* ---------- esplosione ---------- */
  function esplosione(p, aim) {
    const d = camera.position.distanceTo(p); suonoEsplosione(d); st.log.push({ x: Math.round(p.x), z: Math.round(p.z), ax: Math.round(aim.x), az: Math.round(aim.z), t: +st.t.toFixed(1) });
    const gy = elev(p.x, p.z); const P = new THREE.Vector3(p.x, gy, p.z);
    // flash + luce
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(true), color: 0xfff0c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); flash.position.set(P.x, gy + 12, P.z); flash.scale.setScalar(10); scene.add(flash);
    const light = new THREE.PointLight(0xffa040, 0, 600, 2); light.position.set(P.x, gy + 25, P.z); scene.add(light);
    // onda d'urto (anello) e cupola di polvere
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); ring.rotation.x = -Math.PI / 2; ring.position.set(P.x, gy + 1.5, P.z); scene.add(ring);
    st.impacts.push({ flash, light, ring, t: 0 });
    // fuoco (core), fumo (colonna), polvere (anello basso)
    emit(st.fire, new THREE.Vector3(P.x, gy + 4, P.z), 160, { x: 0, y: 16, z: 0, w: 14 }, 10, 2.2, 22);
    emit(st.fire, new THREE.Vector3(P.x, gy + 10, P.z), 90, { x: 0, y: 30, z: 0, w: 8 }, 6, 1.6, 16);
    emit(st.smoke, new THREE.Vector3(P.x, gy + 8, P.z), 260, { x: 0, y: 24, z: 0, w: 22 }, 14, 11, 26);
    emit(st.smoke, new THREE.Vector3(P.x, gy + 30, P.z), 120, { x: 0, y: 18, z: 0, w: 10 }, 10, 14, 34);
    emit(st.dust, new THREE.Vector3(P.x, gy + 2, P.z), 260, { x: 0, y: 3, z: 0, w: 55 }, 10, 5, 24);
    // cratere e bruciatura
    const cr = new THREE.Mesh(new THREE.CircleGeometry(13 + Math.random() * 6, 24), new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 1 })); cr.rotation.x = -Math.PI / 2; cr.position.set(P.x, gy + 0.8, P.z); scene.add(cr);
    const sc2 = new THREE.Mesh(new THREE.CircleGeometry(42, 24), new THREE.MeshBasicMaterial({ color: 0x241f18, transparent: true, opacity: 0.5, depthWrite: false })); sc2.rotation.x = -Math.PI / 2; sc2.position.set(P.x, gy + 0.7, P.z); scene.add(sc2);
    for (let i = 0; i < 22; i++) { const db = new THREE.Mesh(new THREE.BoxGeometry(0.8 + Math.random() * 2.2, 0.5 + Math.random(), 0.8 + Math.random() * 1.5), matStd(0x2e2a26, { roughness: 1 })); db.position.set(P.x, gy + 3, P.z); db.userData.v = new THREE.Vector3((Math.random() - 0.5) * 75, 30 + Math.random() * 55, (Math.random() - 0.5) * 75); db.userData.spin = new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6); db.castShadow = true; scene.add(db); st.debris.push(db); }
    st.objs.forEach(m => { if (m.userData.dead) return; const dd = m.position.distanceTo(new THREE.Vector3(P.x, m.position.y, P.z)); if (dd < 55) { m.userData.dead = true; m.scale.y = 0.22; m.position.y *= 0.22; m.rotation.z = (Math.random() - 0.5) * 0.5; m.rotation.x = (Math.random() - 0.5) * 0.3; m.traverse(x => { if (x.isMesh && x.material && x.material.color) { x.material = x.material.clone(); x.material.color.multiplyScalar(0.3); x.material.roughness = 1; } }); st.fires.push({ x: m.position.x, z: m.position.z, r: 12 }); } });
    st.shake = 1.0; st.impactsDone = (st.impactsDone || 0) + 1;
  }

  /* ---------- animazione ---------- */
  function animate() {
    if (!st) return;   // cinematica chiusa: un fotogramma rimasto in coda non deve fare nulla
    // in registrazione: passo fisso 1/30 s e loop a timer (indipendente dal frame rate e dalla visibilità del pannello)
    if (st.fixedDt) raf = setTimeout(animate, 1000 / 30); else raf = requestAnimationFrame(animate);
    const dtReal = st.fixedDt || Math.min(0.1, clock.getDelta()); const dt = dtReal * TS; st.t += dtReal; const s = st; s.k = 1 - Math.exp(-5 * dtReal); s.frames = (s.frames || 0) + 1;
    if (s.nubi) { const d = Math.abs(camera.position.y - s.nubi.mesh.position.y); s.nubi.mesh.material.opacity = 0.85 * Math.min(1, Math.max(0.15, (d - 20) / 120)); }
    [s.smoke, s.fire, s.dust].forEach(p => { p.material.uniforms.uTime.value = s.t; p.material.uniforms.uWind.value.copy(s.vento || new THREE.Vector3()); p.material.uniforms.uScale.value = window.innerHeight * 0.9; });
    if (s.nubi) s.nubi.tex.offset.x += dtReal * 0.0006;
    // formazione
    const pastTarget = s.pos.x > 900;
    if (pastTarget) { s.form.rotation.y += 0.35 * dtReal; s.form.rotation.z = Math.max(-0.9, s.form.rotation.z - 0.6 * dtReal); } else s.form.rotation.y = Math.PI / 2;   // egress: virata a sinistra (rotation.y cresce) → bank sinistro (rotation.z negativa)
    const dir = new THREE.Vector3(Math.sin(s.form.rotation.y), 0, Math.cos(s.form.rotation.y));
    s.pos.addScaledVector(dir, s.speed * dt); s.pos.y = s.alt; s.form.position.copy(s.pos); s.heading = (90 + (s.form.rotation.y - Math.PI / 2) * -180 / Math.PI + 360) % 360;
    if (audio) audio.jetGain.gain.value = Math.min(0.5, 180 / Math.max(60, camera.position.distanceTo(s.pos)));
    // assetto e superfici dei modelli (fiamma durante l'avvicinamento, timone nella virata di egress)
    s.jets.forEach(j => { if (j.userData.mdl && j.userData.mdl.userData.anim) j.userData.mdl.userData.anim({ rollRate: pastTarget ? -35 : 0, pitchRate: 0, yawRate: pastTarget ? -20 : 0, afterburner: s.released ? 0.3 : 0.9, t: s.t }); });
    // scie di scarico
    if (Math.random() < 0.7) s.jets.forEach(j => { const wp = new THREE.Vector3(); j.getWorldPosition(wp); wp.addScaledVector(dir, -10); emit(s.dust, wp, 1, { x: 0, y: 0, z: 0, w: 1 }, 1, 1.2, 4); });
    if (!s.released && s.pos.x > -4300) { s.released = true; s.nextRelease = 0; s.tRelease = s.t; banner("PICKLE", "pickle"); suonoFischio(8); if (typeof AUDIO !== "undefined" && !s.fixedDt) AUDIO.radio(s.o.callsign, "pickle", s.o.callsign + ", pickle.", "BLUE"); setTimeout(() => { const b = overlay.querySelector("#v3d-banner"); if (b && b.classList.contains("pickle")) b.className = "v3d-banner"; }, 1500); }
    if (s.released && !s.resultShown) { const fb0 = s.bombs.find(b => !b.userData.hit); if (fb0) { const vyd = -fb0.userData.v.y, h = Math.max(1, fb0.position.y - elev(fb0.position.x, fb0.position.z)); s.tti = (-vyd + Math.sqrt(vyd * vyd + 2 * G * h)) / G / TS; msg(`PICKLE – ${s.o.gbu} GBU-48 in caduta guidata · impatto tra ${Math.max(0, Math.ceil(s.tti))} s`); } }
    if (s.released && s.bombsLeft > 0) { s.nextRelease -= dtReal; if (s.nextRelease <= 0) { s.nextRelease = 0.28; const jet = s.jets[s.bombs.length % s.jets.length]; const wp = new THREE.Vector3(); jet.getWorldPosition(wp); const b = bomba(); b.position.copy(wp); b.position.y -= 2.5; b.userData = { v: dir.clone().multiplyScalar(s.speed), aim: s.aims[s.aimIdx++ % s.aims.length] }; scene.add(b); s.bombs.push(b); s.bombsLeft--; } }
    s.bombs.forEach(b => { if (b.userData.hit) return; const u = b.userData; u.v.y -= G * dt; u.v.multiplyScalar(1 - 0.012 * dt);
      const toAim = new THREE.Vector3(u.aim.x - b.position.x, 0, u.aim.z - b.position.z); const vyd = -u.v.y; const h = Math.max(1, b.position.y - elev(b.position.x, b.position.z));
      const tfall = Math.max(0.4, (-vyd + Math.sqrt(vyd * vyd + 2 * G * h)) / G); const want = toAim.multiplyScalar(1 / tfall); if (want.length() > 420) want.setLength(420);
      u.v.x += (want.x - u.v.x) * Math.min(1, 1.6 * dt); u.v.z += (want.z - u.v.z) * Math.min(1, 1.6 * dt);
      b.position.addScaledVector(u.v, dt); b.lookAt(b.position.clone().add(u.v));
      if (b.position.y <= elev(b.position.x, b.position.z) + 1) { u.hit = true; b.visible = false; esplosione(new THREE.Vector3(b.position.x, 0, b.position.z), u.aim); } });
    s.impacts.forEach(im => { im.t += dtReal; const k = im.t; im.flash.scale.setScalar(10 + 140 * Math.min(1, k / 0.25)); im.flash.material.opacity = Math.max(0, 1 - k / 0.5); im.light.intensity = Math.max(0, 3 - k * 2.5); const rk = Math.min(1, k / 1.1); im.ring.scale.setScalar(1 + 420 * rk); im.ring.material.opacity = 0.55 * (1 - rk); if (k > 1.2) { scene.remove(im.flash); scene.remove(im.light); scene.remove(im.ring); } });
    s.impacts = s.impacts.filter(im => im.t <= 1.2);
    s.debris.forEach(db => { if (db.userData.fermo) return; db.userData.v.y -= G * dt; db.position.addScaledVector(db.userData.v, dt); db.rotation.x += db.userData.spin.x * dt; db.rotation.y += db.userData.spin.y * dt; const gy = elev(db.position.x, db.position.z) + 0.4; if (db.position.y < gy) { db.position.y = gy; db.userData.fermo = true; } else if (Math.random() < 0.2) emit(s.smoke, db.position, 1, { x: 0, y: 0.5, z: 0, w: 0.5 }, 0.5, 1.6, 2.5); });
    s.fires.forEach(f => { const gy = elev(f.x, f.z); if (Math.random() < 0.8) emit(s.fire, new THREE.Vector3(f.x + (Math.random() - 0.5) * f.r, gy + 2, f.z + (Math.random() - 0.5) * f.r), 3, { x: 0, y: 7, z: 0, w: 3 }, 4, 1.4, 9); if (Math.random() < 0.5) emit(s.smoke, new THREE.Vector3(f.x, gy + 8, f.z), 2, { x: 0, y: 10, z: 0, w: 5 }, 6, 9, 16); });
    const allHit = s.released && s.bombsLeft === 0 && s.bombs.every(b => b.userData.hit);
    if (allHit && !s.resultShown) { s.resultShown = true; s.tResult = s.t; const r = s.o.esito; msg(`${s.o.gbu} GBU-48 a segno · danno ${Math.min(100, Math.round(r.danni / r.richieste * 100))}% (${r.danni}/${r.richieste})`); banner(r.distrutto ? "SHACK – TARGET DISTRUTTO" : `DANNO ${Math.min(100, Math.round(r.danni / r.richieste * 100))}%`, r.distrutto ? "shack" : "partial"); if (typeof AUDIO !== "undefined" && !s.fixedDt) { if (r.distrutto) { AUDIO.suono("boom"); AUDIO.radio(s.o.callsign, "shack", s.o.callsign + ", shack! Target destroyed.", "BLUE"); } } }
    if (s.resultShown && s.t - s.tResult > 4.5 && !s.egress) { s.egress = true; msg("OFF TARGET – EGRESS"); if (typeof AUDIO !== "undefined" && !s.fixedDt) AUDIO.radio(s.o.callsign, "off", s.o.callsign + ", off target, egress.", "BLUE"); }
    if (s.resultShown && s.t - s.tResult > 9 && !s.done) { s.done = true; chiudi(); return; }
    cameraUpdate(dtReal); renderer.render(scene, camera); hud();
    if (s.comp) { s.comp.g.drawImage(canvas, 0, 0, s.comp.c.width, s.comp.c.height); s.comp.g.drawImage(hudCanvas, 0, 0, s.comp.c.width, s.comp.c.height); }
  }
  function cameraUpdate(dtReal) {
    const s = st, t = s.t, k = s.k; const lp = new THREE.Vector3(); s.jets[0].getWorldPosition(lp); let target = new THREE.Vector3(); const firstBomb = s.bombs.find(b => !b.userData.hit);
    s.camMode = "altro";
    if (!s.released) { s.camMode = "chase"; if (!s.camInit) { s.camInit = true; camera.position.copy(lp).add(new THREE.Vector3(-150, 40, 90)); } camera.position.lerp(lp.clone().add(new THREE.Vector3(-130, 32, 80)), k); target.copy(lp).add(new THREE.Vector3(500, -80, 0)); }
    else if (firstBomb && s.bombs.length && !s.impactsDone) {
      if (t - s.tRelease < 2.5) { s.camMode = "chase"; camera.position.lerp(lp.clone().add(new THREE.Vector3(-40, -55, 60)), k * 1.5); target.copy(firstBomb.position); }
      else { s.camMode = "bomb"; const v = firstBomb.userData.v.clone().normalize(); camera.position.copy(firstBomb.position).addScaledVector(v, -22).add(new THREE.Vector3(0, 8, 0)); target.copy(firstBomb.position).addScaledVector(v, 60); }
    } else if (!s.resultShown) { const gp = new THREE.Vector3(-420, elev(-420, 300) + 22, 300); camera.position.lerp(gp, k * 0.8); target.set(0, 25, 0); }
    else { const kk = (t - s.tResult) * 0.18; const px = Math.cos(kk) * 560, pz = Math.sin(kk) * 560; camera.position.lerp(new THREE.Vector3(px, elev(px, pz) + 230 + 40 * Math.sin(kk), pz), k * 0.5); target.set(0, 10, 0); }
    if (s.shake > 0) { s.shake -= dtReal * 1.6; camera.position.add(new THREE.Vector3((Math.random() - 0.5) * 6 * s.shake, (Math.random() - 0.5) * 6 * s.shake, 0)); }
    camera.lookAt(target);
  }

  /* ---------- HUD stile caccia (canvas 2D) ---------- */
  function hud() {
    const c = hudCtx, W = hudCanvas.width, H = hudCanvas.height; c.clearRect(0, 0, W, H); const s = st; if (!s || (s.camMode !== "chase" && s.camMode !== "bomb")) return;
    c.save(); c.strokeStyle = "rgba(120,255,140,0.95)"; c.fillStyle = "rgba(120,255,140,0.95)"; c.lineWidth = 2; c.font = "bold 18px Consolas, monospace"; c.textAlign = "center";
    const cx = W / 2, cy = H / 2; const spdKt = Math.round(s.speed * 1.944), altFt = Math.round((s.camMode === "bomb" ? (s.bombs.find(b => !b.userData.hit) || { position: { y: s.alt } }).position.y : s.alt) * 3.281);
    // nastro di prua
    const hdg = s.heading; c.beginPath(); c.moveTo(cx - 260, 60); c.lineTo(cx + 260, 60); c.stroke();
    for (let d = -40; d <= 40; d += 5) { const h = ((Math.round(hdg / 5) * 5 + d) + 360) % 360; const x = cx + (h - hdg + 540) % 360 * 0 + ((Math.round(hdg / 5) * 5 + d) - hdg) * 6.5; if (Math.abs(x - cx) > 260) continue; c.beginPath(); c.moveTo(x, 60); c.lineTo(x, h % 10 === 0 ? 48 : 54); c.stroke(); if (h % 10 === 0) c.fillText(String(h / 10).padStart(2, "0"), x, 44); }
    c.beginPath(); c.moveTo(cx, 62); c.lineTo(cx - 7, 74); c.lineTo(cx + 7, 74); c.closePath(); c.fill(); c.fillText(String(Math.round(hdg)).padStart(3, "0"), cx, 94);
    // velocità e quota
    c.textAlign = "right"; c.strokeRect(cx - 330, cy - 22, 110, 44); c.fillText(spdKt + " KT", cx - 230, cy + 7); c.font = "14px Consolas, monospace"; c.fillText("M " + (s.speed / 300).toFixed(2), cx - 230, cy + 40); c.fillText("G 1.0", cx - 230, cy - 32);
    c.font = "bold 18px Consolas, monospace"; c.textAlign = "left"; c.strokeRect(cx + 220, cy - 22, 130, 44); c.fillText(altFt.toLocaleString("it-IT") + " FT", cx + 230, cy + 7); c.font = "14px Consolas, monospace"; c.fillText("RALT " + Math.round(altFt - elev(s.pos.x, s.pos.z) * 3.281).toLocaleString("it-IT"), cx + 230, cy + 40);
    // scala di beccheggio e flight path marker
    c.textAlign = "center"; for (let p = -10; p <= 10; p += 5) { if (p === 0) continue; const y = cy - p * 9; c.setLineDash(p < 0 ? [8, 6] : []); c.beginPath(); c.moveTo(cx - 120, y); c.lineTo(cx - 40, y); c.moveTo(cx + 40, y); c.lineTo(cx + 120, y); c.stroke(); c.fillText(String(Math.abs(p)), cx - 135, y + 5); c.fillText(String(Math.abs(p)), cx + 135, y + 5); }
    c.setLineDash([]); c.beginPath(); c.arc(cx, cy, 9, 0, Math.PI * 2); c.moveTo(cx - 9, cy); c.lineTo(cx - 22, cy); c.moveTo(cx + 9, cy); c.lineTo(cx + 22, cy); c.moveTo(cx, cy - 9); c.lineTo(cx, cy - 18); c.stroke();
    // CCRP: linea di caduta e tempo all'impatto
    if (!s.released || s.camMode === "bomb") { c.beginPath(); c.moveTo(cx, cy + 20); c.lineTo(cx, H - 140); c.stroke(); }
    c.font = "bold 20px Consolas, monospace"; c.fillText(s.released ? (s.tti != null ? `TTI ${String(Math.max(0, Math.ceil(s.tti))).padStart(2, "0")}` : "REL") : "A/G  CCRP", cx, H - 110);
    c.font = "16px Consolas, monospace"; c.textAlign = "left"; c.fillText(`GBU-48  ${s.bombsLeft}`, cx - 330, H - 110); c.fillText(`TGT ${Math.round(Math.hypot(s.pos.x, s.pos.z) / 1852 * 10) / 10} NM`, cx - 330, H - 86);
    if (s.released && s.t - s.tRelease < 1.5 && Math.floor(s.t * 6) % 2 === 0) { c.font = "bold 26px Consolas, monospace"; c.textAlign = "center"; c.fillText("RELEASE", cx, cy + 70); }
    c.restore();
  }

  /* ---------- API ---------- */
  function apri(o) {
    dom(); if (typeof THREE === "undefined") { alert("Three.js non caricato (vendor/three.min.js)"); return; }
    cancelAnimationFrame(raf); clearTimeout(raf);   // una cinematica già aperta: si ferma il suo ciclo, altrimenti ne girerebbero due
    if (renderer) { try { renderer.dispose(); } catch (e) {} }
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!o.record, powerPreference: "high-performance" }); renderer.setPixelRatio(o.record ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setSize(window.innerWidth, window.innerHeight);
    if (THREE.sRGBEncoding !== undefined && renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding; else if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    hudCanvas.width = window.innerWidth; hudCanvas.height = window.innerHeight;
    overlay.classList.remove("hidden"); audio = audioInit(); if (audio && audio.ctx.state === "suspended") audio.ctx.resume();
    costruisci(o); clock = new THREE.Clock(); st.onFine = o.onFine; if (o.record) st.fixedDt = 1 / 30;
    if (o.record && window.MediaRecorder) { try { // canvas di composizione (scena + HUD) per la registrazione
      const comp = document.createElement("canvas"); comp.width = canvas.width; comp.height = canvas.height; const cg = comp.getContext("2d"); st.comp = { c: comp, g: cg };
      const stream = comp.captureStream(30); if (audio) audio.dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr)); recChunks = []; recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm", videoBitsPerSecond: 8000000 }); recorder.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); }; recorder.onstop = () => { const blob = new Blob(recChunks, { type: "video/webm" }); if (o.onRecord) o.onRecord(blob); }; recorder.start(500); } catch (e) { console.warn("registrazione non disponibile", e); } }
    animate();
  }
  function chiudi() {
    if (!overlay || overlay.classList.contains("hidden")) return; cancelAnimationFrame(raf); clearTimeout(raf); overlay.classList.add("hidden");
    if (recorder && recorder.state !== "inactive") recorder.stop(); recorder = null;
    if (audio) { try { audio.ctx.close(); } catch (e) {} audio = null; }
    if (scene) { scene.traverse(x => { if (x.geometry) x.geometry.dispose(); }); scene = null; }
    hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
    const fn = st && st.onFine; st = null; if (fn) fn();
  }
  function daEvento(sc, eng, v) {
    const f = eng.flights.find(x => x.id === v.flight); const t = eng.target.find(x => x.id === v.target); if (!f || !t) return null;
    return { callsign: f.callsign, n: Math.max(1, f.n || v.n || 4), tipo: sc.tipi[f.tipo], lato: f.lato, target: t, gbu: v.gbu, esito: { danni: v.danni, richieste: v.richieste, distrutto: v.distrutto }, meteo: sc.meteo, ora: eng.t / 3600 };
  }
  /* modelli condivisi con la vista 3D della missione */
  const ICONA2TIPO = { f22: "F22", f15: "F15", f16: "F16", f16b: "F16", typhoon: "F2000", su35: "SU35", su57: "SU57", kc30: "F15" };
  /* ---------- modelli glTF reali (app/modelli/manifest.json → {TIPO: {file, rot, lunghezza_m, offset, scala}}) ---------- */
  const GLTF = { man: null, cache: {}, loader: null };
  function gltfManifest() {
    if (GLTF.man) return GLTF.man;
    GLTF.man = fetch("modelli/manifest.json", { cache: "no-store" }).then(r => r.ok ? r.json() : {}).catch(() => ({})).then(man => {
      const usa = Object.keys(man).some(k => man[k] && man[k].file);
      if (!usa || typeof THREE.GLTFLoader !== "undefined") return man;
      return new Promise(res => { const s = document.createElement("script"); s.src = "vendor/GLTFLoader.js"; s.onload = () => res(man); s.onerror = () => { console.warn("vendor/GLTFLoader.js mancante: modelli glTF non caricati"); res({}); }; document.head.appendChild(s); });
    });
    return GLTF.man;
  }
  function gltfModello(tipo, col, opt) {
    return gltfManifest().then(man => {
      const m = man && man[tipo]; if (!m || !m.file || typeof THREE.GLTFLoader === "undefined") return null;
      if (!GLTF.cache[m.file]) { GLTF.loader = GLTF.loader || new THREE.GLTFLoader(); GLTF.cache[m.file] = new Promise((res, rej) => GLTF.loader.load("modelli/" + m.file, g => res(g.scene), undefined, rej)).catch(e => { console.warn("glTF non caricabile", m.file, e); return null; }); }
      return GLTF.cache[m.file].then(scene => {
        if (!scene) return null; const g = scene.clone(true); const rot = m.rot || [0, 0, 0]; g.rotation.set(rot[0] * Math.PI / 180, rot[1] * Math.PI / 180, rot[2] * Math.PI / 180); g.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(g); const size = new THREE.Vector3(); box.getSize(size);
        const len = m.lunghezza_m || (typeof MODELLI !== "undefined" && MODELLI.TIPI[tipo] && MODELLI.TIPI[tipo].len) || 15; const s = m.scala || len / Math.max(size.z, 1e-3);
        const wrap = new THREE.Group(); wrap.add(g); g.scale.setScalar(s); g.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(g); const c = new THREE.Vector3(); b2.getCenter(c); g.position.sub(c); if (m.offset) g.position.add(new THREE.Vector3(m.offset[0] || 0, m.offset[1] || 0, m.offset[2] || 0));
        wrap.traverse(o => { if (o.isMesh) { o.castShadow = true; if (col != null && o.material) { o.material = Array.isArray(o.material) ? o.material.map(mm => mm.clone()) : o.material.clone(); [].concat(o.material).forEach(mm => { if (mm.color) mm.color.lerp(new THREE.Color(col), 0.45); }); } } });
        // postbruciatore: fiamme procedurali sugli ugelli dichiarati nel manifest ([x,y,z] in metri, modello orientato con il muso a +Z)
        const fiamme = (m.ugelli || []).map(u => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.45, 5, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); f.rotation.x = Math.PI / 2; f.position.set(u[0], u[1], u[2] - 2.6); f.visible = false; wrap.add(f); return f; });
        wrap.name = "gltf_" + tipo; wrap.userData.parti = { fiamme }; wrap.userData.anim = st => { const ab = st.afterburner || 0; fiamme.forEach(f => { f.visible = ab > 0.05; f.scale.set(1, 1, 0.4 + ab * (0.8 + 0.3 * Math.sin((st.t || 0) * 40))); f.material.opacity = 0.5 + 0.4 * ab; }); };
        return wrap;
      });
    });
  }
  function modelloProcedurale(icona, col, opt) {
    // modelli dettagliati parametrici (modelli3d.js); fallback alla sagoma estrusa
    if (typeof MODELLI !== "undefined") { try { const tipo = (opt && opt.tipoId) || ICONA2TIPO[icona] || "F16"; const m = MODELLI.costruisci(tipo, { colore: col, armi: opt && opt.armi, numero: opt && opt.numero, callsign: opt && opt.callsign });
      // I modelli procedurali hanno muso +Z e ala destra +X: in un sistema destrorso con muso +Z l'ala destra sta a −X, quindi vanno specchiati
      // (così luci di navigazione, alettoni, timone e dettagli asimmetrici finiscono dal lato fisicamente giusto). Lo specchio sta in un gruppo interno: chi riceve il modello può scalarlo liberamente.
      const mir = new THREE.Group(); mir.scale.x = -1; mir.add(m); const W = new THREE.Group(); W.add(mir); W.name = m.name; W.userData.anim = m.userData.anim; W.userData.parti = m.userData.parti; return Promise.resolve(W); } catch (e) { console.warn("modello dettagliato non disponibile", e); } }
    const cfg = TIPI3D[icona] || TIPI3D.f16; return caricaSagoma(TIPI3D[icona] ? icona : "f16").then(sg => sg ? modelloDaSagoma(sg, Object.assign({}, cfg, { col: col != null ? col : cfg.col })) : jetFallback(col != null ? col : cfg.col));
  }
  function modelloPromise(icona, col, opt) {
    // 1) modello glTF reale se presente in app/modelli; 2) altrimenti modello procedurale
    const tipo = (opt && opt.tipoId) || ICONA2TIPO[icona] || "F16";
    return gltfModello(tipo, col, opt).catch(() => null).then(m => m || modelloProcedurale(icona, col, opt));
  }
  return { apri, chiudi, daEvento, modelloPromise, jetFallback, puffTexture, TIPI3D, tileUrl, caricaTex, caricaDem, demGrid, lonLatToTile, setProxyTile: v => { TILE.proxy = !!v; }, get attiva() { return !!(overlay && !overlay.classList.contains("hidden")); }, get debug() { return st && { t: st.t, fps: st.frames && st.t ? +(st.frames / st.t).toFixed(1) : 0, released: st.released, terreno: TERRA.ready, base: TERRA.base, log: st.log, bombs: st.bombs.length, draw: renderer && renderer.info.render }; } };
})();
