/* CENTURION · Personnel Recovery con gli STOS (Supporto Tattico alle Operazioni Speciali, Aeronautica Militare).

   Missione dell'Accademia «Soccorso»: un Typhoon colpito da un MANPADS in area non permissiva sul Grappa, il pilota
   (personale isolato) si eietta e attiva il radiofaro PLB; l'elicottero di recupero con a bordo un team STOS Pararescue
   entra a bassa quota sfruttando il terreno, localizza il pilota, atterra nella zona indicata; gli STOS mettono in
   sicurezza l'area, autenticano il pilota, prestano le prime cure (TCCC) e lo imbarcano; poi l'uscita verso il punto
   di consegna.
   Questo modulo contiene il mondo della missione (relitto in fiamme, pilota, minaccia, zona di atterraggio), il
   radiogoniometro del radiofaro, i marcatori e i due filmati (schianto, recupero) girati nel mondo 3D del Free Flight
   con resa ad alta risoluzione (fino a 3840 px di larghezza, "4K", se lo schermo lo consente).
   Scenario illustrativo: nomi, posizioni e procedure semplificati a scopo didattico. */
const SOCCORSO = (() => {
  "use strict";
  const D2R = Math.PI / 180, PI = Math.PI;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix = (a, b, k) => a + (b - a) * k;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const CENTRO = [45.58, 12.22], M_LON = 111320 * Math.cos(CENTRO[0] * D2R);
  const xz = (lat, lon) => ({ x: (lon - CENTRO[1]) * M_LON, z: -(lat - CENTRO[0]) * 111320 });
  const suolo = (x, z) => { try { return VOLO._acc.suolo(x, z) || 0; } catch (e) { return 0; } };
  const I = () => VOLO._int || {};
  // luoghi della missione (versante sud del Grappa)
  const LUOGHI = {
    ip: xz(45.8300, 11.7960),      // dove atterra il pilota
    relitto: xz(45.8352, 11.7885), // impatto del Typhoon
    lz: xz(45.8292, 11.7976),      // zona di atterraggio (prato), segnata con il pannello arancione
    minaccia: xz(45.8455, 11.8190),// squadra con MANPADS
    partenza: xz(45.7700, 11.7850),// elicottero di recupero, 6,5 km a sud
    consegna: xz(45.7520, 11.7700) // punto di consegna (fuori dall'area ostile)
  };
  const R_MINACCIA = 3200, AGL_MINACCIA = 91;   // 300 ft

  /* ======================= texture ======================= */
  let TEX = null;
  function texture() {
    if (TEX) return TEX;
    const fumo = document.createElement("canvas"); fumo.width = fumo.height = 128; let g = fumo.getContext("2d");
    for (let i = 0; i < 26; i++) {   // sbuffo fatto di tanti grumi morbidi
      const a = Math.random() * PI * 2, r = Math.random() * 30, x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r, rr = 18 + Math.random() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, "rgba(255,255,255,0.22)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    const fuoco = document.createElement("canvas"); fuoco.width = fuoco.height = 64; g = fuoco.getContext("2d");
    let gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,0.6)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    TEX = { fumo: new THREE.CanvasTexture(fumo), fuoco: new THREE.CanvasTexture(fuoco) };
    return TEX;
  }

  /* ======================= particelle: billboard istanziati, una sola chiamata di disegno ======================= */
  const VS_P = `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 aPos; attribute float aSize; attribute float aAlpha; attribute vec3 aColor; attribute float aRot;
varying vec2 vUv; varying float vAlpha; varying vec3 vColor; varying float vFogDepth;
void main() {
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  float c = cos(aRot), s = sin(aRot); vec2 q = position.xy * aSize;
  mv.xy += vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  vUv = uv; vAlpha = aAlpha; vColor = aColor; vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;
  const FS_P = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D map; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
varying vec2 vUv; varying float vAlpha; varying vec3 vColor; varying float vFogDepth;
void main() {
  #include <logdepthbuf_fragment>
  vec4 t = texture2D(map, vUv);
  float a = t.a * vAlpha * (1.0 - smoothstep(fogNear, fogFar, vFogDepth));
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor, 1.0);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
  gl_FragColor.a = a;
}`;
  function particelle(scene, n, additivo, mappa) {
    const quad = new THREE.PlaneGeometry(1, 1), geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index; geo.setAttribute("position", quad.attributes.position); geo.setAttribute("uv", quad.attributes.uv);
    const A = (k) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * k), k); a.setUsage(THREE.DynamicDrawUsage); return a; };
    const aPos = A(3), aSize = A(1), aAlpha = A(1), aColor = A(3), aRot = A(1);
    geo.setAttribute("aPos", aPos); geo.setAttribute("aSize", aSize); geo.setAttribute("aAlpha", aAlpha); geo.setAttribute("aColor", aColor); geo.setAttribute("aRot", aRot);
    geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({ vertexShader: VS_P, fragmentShader: FS_P, transparent: true, depthWrite: false, fog: true,
      blending: additivo ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: mappa }, fogColor: { value: new THREE.Color(0) }, fogNear: { value: 1e7 }, fogFar: { value: 2e7 }, fogDensity: { value: 0 } } });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = additivo ? 7 : 6; mesh.raycast = () => {}; scene.add(mesh);
    const P = []; for (let i = 0; i < n; i++) P.push({ vivo: false });
    let prossimo = 0;
    function emetti(o) {
      let p = null; for (let k = 0; k < n; k++) { const q = P[(prossimo + k) % n]; if (!q.vivo) { p = q; prossimo = (prossimo + k + 1) % n; break; } }
      if (!p) { p = P[prossimo]; prossimo = (prossimo + 1) % n; }   // pieno: si ricicla la più vecchia
      p.vivo = true; p.t = 0; p.vita = o.vita || 2; p.x = o.pos.x; p.y = o.pos.y; p.z = o.pos.z;
      const v = o.vel || { x: 0, y: 0, z: 0 }; p.vx = v.x; p.vy = v.y; p.vz = v.z;
      p.s0 = o.s0 || 1; p.s1 = o.s1 == null ? p.s0 : o.s1; p.a0 = o.a0 == null ? 0.8 : o.a0; p.inA = o.inA || 0.08;
      const c0 = new THREE.Color(o.col == null ? 0xffffff : o.col), c1 = new THREE.Color(o.col1 == null ? (o.col == null ? 0xffffff : o.col) : o.col1);
      p.r0 = c0.r; p.g0 = c0.g; p.b0 = c0.b; p.r1 = c1.r; p.g1 = c1.g; p.b1 = c1.b;
      p.rot = Math.random() * PI * 2; p.rv = o.rv == null ? rnd(-0.6, 0.6) : o.rv; p.drag = o.drag == null ? 0.6 : o.drag; p.su = o.su || 0; p.vento = o.vento || 0;
      return p;
    }
    function aggiorna(dt, vento) {
      let k = 0; const w = vento || { x: 0, z: 0 };
      for (const p of P) {
        if (!p.vivo) continue; p.t += dt; if (p.t >= p.vita) { p.vivo = false; continue; }
        const dr = Math.exp(-p.drag * dt); p.vx = (p.vx - w.x * p.vento) * dr + w.x * p.vento; p.vz = (p.vz - w.z * p.vento) * dr + w.z * p.vento; p.vy = p.vy * dr + p.su * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.rv * dt;
        const u = p.t / p.vita, a = p.a0 * ss(0, p.inA, u) * (1 - ss(0.45, 1, u));
        aPos.array[k * 3] = p.x; aPos.array[k * 3 + 1] = p.y; aPos.array[k * 3 + 2] = p.z;
        aSize.array[k] = mix(p.s0, p.s1, 1 - Math.pow(1 - u, 2)); aAlpha.array[k] = a; aRot.array[k] = p.rot;
        aColor.array[k * 3] = mix(p.r0, p.r1, u); aColor.array[k * 3 + 1] = mix(p.g0, p.g1, u); aColor.array[k * 3 + 2] = mix(p.b0, p.b1, u);
        k++;
      }
      geo.instanceCount = k; aPos.needsUpdate = aSize.needsUpdate = aAlpha.needsUpdate = aColor.needsUpdate = aRot.needsUpdate = true;
    }
    function dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); }
    return { emetti, aggiorna, dispose, mesh };
  }

  // scia continua: particelle ogni "passo" metri lungo il tratto percorso dall'ultimo fotogramma (niente file di palline)
  function scia(sys, stato, chiave, pos, passo, fopt) {
    const prima = stato[chiave]; stato[chiave] = pos.clone(); if (!prima) return;
    const d = prima.distanceTo(pos), n = Math.min(40, Math.max(1, Math.round(d / passo)));
    for (let i = 1; i <= n; i++) sys.emetti(fopt(prima.clone().lerp(pos, i / n), i / n));
  }
  // alza la camera finché la linea di vista sul soggetto non è libera dal rilievo
  function libera(cam, tgt) {
    for (let k = 0; k < 15; k++) { let ok = true;
      for (let i = 1; i < 12; i++) { const u = i / 12, x = mix(cam.x, tgt.x, u), z = mix(cam.z, tgt.z, u), y = mix(cam.y, tgt.y, u); if (y < suolo(x, z) + 4) { ok = false; break; } }
      if (ok) break; cam.y += 35; }
    return cam;
  }

  /* ======================= modelli procedurali ======================= */
  const mStd = (c, r, m) => new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? 0.85 : r, metalness: m || 0 });
  // mimetica a macchie (tonalità tipo multiterreno), una sola texture condivisa
  let MIMETICA = null;
  function mimetica() {
    if (MIMETICA) return MIMETICA;
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    g.fillStyle = "#8b7d5d"; g.fillRect(0, 0, 128, 128);
    ["#6d6648", "#5c6a46", "#a8976f", "#3f3a2c", "#7a6e4f"].forEach((col, k) => { g.fillStyle = col;
      for (let i = 0; i < 16; i++) { const x = Math.random() * 128, y = Math.random() * 128, rx = 6 + Math.random() * (k === 3 ? 6 : 14), ry = rx * (0.4 + Math.random() * 0.6);
        g.beginPath(); g.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse((x + 64) % 128, (y + 64) % 128, rx * 0.7, ry * 0.7, Math.random() * Math.PI, 0, Math.PI * 2); g.fill(); } });
    MIMETICA = new THREE.CanvasTexture(c); MIMETICA.wrapS = MIMETICA.wrapT = THREE.RepeatWrapping; MIMETICA.repeat.set(2, 2);
    return MIMETICA;
  }
  function mesh(geo, mat, x, y, z) { const o = new THREE.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; return o; }
  // figura umana articolata (1,78 m): bacino come radice, giunti come gruppi per le pose
  function persona(o) {
    o = o || {};
    const tuta = o.mimetica ? new THREE.MeshStandardMaterial({ map: mimetica(), roughness: 0.92 }) : mStd(o.tuta || 0x8a7a5c), scuro = mStd(o.attrezzi || 0x3b3a33), pelle = mStd(0xb08a6e, 0.7), casco = mStd(o.casco || 0x6f6650, 0.6);
    const R = new THREE.Group(); R.name = o.nome || "persona";
    const bac = new THREE.Group(); bac.position.y = 0.98; R.add(bac);
    const busto = new THREE.Group(); bac.add(busto);
    busto.add(mesh(new THREE.CapsuleGeometry(0.17, 0.38, 4, 10), tuta, 0, 0.3, 0));
    if (o.giubbotto !== false) { const v = mesh(new THREE.CapsuleGeometry(0.19, 0.22, 4, 12), o.giubbotto ? mStd(o.giubbotto) : scuro, 0, 0.34, 0.01); v.scale.set(1.05, 1, 0.82); busto.add(v); }
    if (o.zaino) { const z = mesh(new THREE.CapsuleGeometry(0.13, 0.18, 4, 10), mStd(o.zaino), 0, 0.36, -0.2); z.scale.set(1.1, 1, 0.7); busto.add(z); }
    const collo = new THREE.Group(); collo.position.y = 0.62; busto.add(collo);
    collo.add(mesh(new THREE.SphereGeometry(0.11, 12, 10), pelle, 0, 0.1, 0.01));
    const elmo = mesh(new THREE.SphereGeometry(0.135, 14, 10, 0, PI * 2, 0, PI * 0.6), casco, 0, 0.13, 0); collo.add(elmo);
    if (o.visore) collo.add(mesh(new THREE.BoxGeometry(0.16, 0.06, 0.06), scuro, 0, 0.2, 0.13));
    const arto = (r, l, mat) => { const g = new THREE.Group(); g.add(mesh(new THREE.CapsuleGeometry(r, l, 3, 8), mat, 0, -l / 2 - r, 0)); return g; };
    const spalle = [], gomiti = [], anche = [], ginocchia = [];
    [-1, 1].forEach(s => {
      const sp = arto(0.055, 0.24, tuta); sp.position.set(s * 0.23, 0.5, 0); busto.add(sp); spalle.push(sp);
      const go = arto(0.048, 0.22, tuta); go.position.y = -0.34; sp.add(go); gomiti.push(go);
      go.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), o.guanti ? scuro : pelle, 0, -0.33, 0));
      const an = arto(0.075, 0.36, tuta); an.position.set(s * 0.1, -0.02, 0); bac.add(an); anche.push(an);
      const gi = arto(0.06, 0.36, tuta); gi.position.y = -0.5; an.add(gi); ginocchia.push(gi);
      gi.add(mesh(new THREE.BoxGeometry(0.11, 0.09, 0.24), scuro, 0, -0.5, 0.05));
    });
    let fucile = null;
    if (o.fucile) { fucile = new THREE.Group(); fucile.add(mesh(new THREE.BoxGeometry(0.05, 0.08, 0.7), scuro, 0, 0, 0.12)); fucile.add(mesh(new THREE.BoxGeometry(0.04, 0.14, 0.05), scuro, 0, -0.08, 0.02)); fucile.position.set(0.1, 0.36, 0.26); busto.add(fucile); }
    if (o.borsa) busto.add(mesh(new THREE.BoxGeometry(0.26, 0.2, 0.14), mStd(0x7c1f1f), -0.24, 0.05, -0.05));
    const strobo = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); strobo.position.set(0.14, 0.5, -0.1); strobo.visible = false; busto.add(strobo);
    R.userData.j = { bac, busto, collo, spalle, gomiti, anche, ginocchia, fucile, strobo };
    R.traverse(m => { if (m.isMesh) m.raycast = () => {}; });
    return R;
  }
  // pose: k di passo per camminata/corsa (0..1 ciclico)
  function posa(P, nome, k, f) {
    const j = P.userData.j; if (!j) return; f = f == null ? 1 : f;
    const set = (o, x, y, z) => { o.rotation.set(x || 0, y || 0, z || 0); };
    set(j.busto); set(j.collo); j.bac.position.y = 0.98; j.spalle.forEach(o => set(o)); j.gomiti.forEach(o => set(o)); j.anche.forEach(o => set(o)); j.ginocchia.forEach(o => set(o));
    if (j.fucile) set(j.fucile);
    const sw = Math.sin((k || 0) * PI * 2);
    if (nome === "cammina" || nome === "corsa") {
      const a = nome === "corsa" ? 0.75 : 0.42;
      j.anche[0].rotation.x = sw * a; j.anche[1].rotation.x = -sw * a;
      j.ginocchia[0].rotation.x = Math.max(0, -sw) * a * 1.3 + 0.1; j.ginocchia[1].rotation.x = Math.max(0, sw) * a * 1.3 + 0.1;
      j.spalle[0].rotation.x = -sw * a * 0.6; j.spalle[1].rotation.x = sw * a * 0.6; j.gomiti.forEach(o => o.rotation.x = -0.6);
      j.busto.rotation.x = nome === "corsa" ? 0.25 : 0.06; j.bac.position.y = 0.98 - Math.abs(sw) * 0.04;
      if (j.fucile) { j.spalle[1].rotation.x = -0.9; j.gomiti[1].rotation.x = -0.9; }
    } else if (nome === "ginocchio") {   // in ginocchio, arma pronta verso l'esterno
      j.bac.position.y = 0.55; j.anche[0].rotation.x = -1.4; j.ginocchia[0].rotation.x = 1.45; j.anche[1].rotation.x = 0.35; j.ginocchia[1].rotation.x = 1.9;
      j.spalle.forEach(o => o.rotation.x = -1.2); j.gomiti.forEach(o => o.rotation.x = -0.4); j.busto.rotation.x = 0.12;
    } else if (nome === "seduto") {   // il pilota appoggiato a terra, gamba ferita distesa
      j.bac.position.y = 0.2; j.anche.forEach(o => o.rotation.x = -1.45); j.ginocchia[0].rotation.x = 0.9; j.busto.rotation.x = -0.25; j.spalle.forEach(o => o.rotation.x = -0.3);
    } else if (nome === "saluta") {
      j.spalle[1].rotation.z = -2.6 + 0.35 * Math.sin((k || 0) * PI * 2); j.gomiti[1].rotation.z = -0.3;
    } else if (nome === "cura") {     // chinato sul ferito
      j.bac.position.y = 0.5; j.anche[0].rotation.x = -1.5; j.ginocchia[0].rotation.x = 1.5; j.anche[1].rotation.x = 0.2; j.ginocchia[1].rotation.x = 1.9; j.busto.rotation.x = 0.55;
      j.spalle.forEach((o, i) => o.rotation.x = -1.0 + 0.15 * Math.sin((k || 0) * PI * 2 + i)); j.gomiti.forEach(o => o.rotation.x = -0.5);
    } else if (nome === "appeso") {   // sotto il paracadute
      j.spalle.forEach((o, i) => { o.rotation.z = (i ? -1 : 1) * 2.7; }); j.anche.forEach((o, i) => o.rotation.x = -0.15 * f + i * 0.1); j.ginocchia.forEach(o => o.rotation.x = 0.3);
    } else if (nome === "seggiolino") {
      j.bac.position.y = 0.45; j.anche.forEach(o => o.rotation.x = -1.5); j.ginocchia.forEach(o => o.rotation.x = 1.4); j.spalle.forEach(o => o.rotation.x = -0.2);
    } else if (nome === "sostenuto") {   // zoppica con il braccio sulle spalle dei soccorritori
      j.spalle.forEach((o, i) => o.rotation.z = (i ? -1 : 1) * 1.4); j.anche[0].rotation.x = sw * 0.3; j.anche[1].rotation.x = -0.1; j.ginocchia[0].rotation.x = Math.max(0, -sw) * 0.4;
    }
  }
  // paracadute emisferico a spicchi arancio e bianchi, con fasci funicolari verso le bretelle
  function paracadute() {
    const G = new THREE.Group(), seg = 28, R = 4.4, geo = new THREE.SphereGeometry(R, seg, 10, 0, PI * 2, 0, 1.2);
    const col = []; const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const a = Math.atan2(pos.getZ(i), pos.getX(i)); const s = Math.floor(((a + PI) / (PI * 2)) * seg) % 2; const c = s ? new THREE.Color(0xff6a1a) : new THREE.Color(0xf2efe6); col.push(c.r, c.g, c.b); }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    const calotta = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })); calotta.scale.set(1, 0.62, 1); calotta.position.y = 7.2; G.add(calotta);
    const lp = []; const yb = 7.2 + R * Math.cos(1.2) * 0.62, rb = R * Math.sin(1.2);
    for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2; lp.push(Math.cos(a) * rb, yb, Math.sin(a) * rb, (i % 2 ? 0.2 : -0.2), 1.55, 0); }
    const linee = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(lp, 3)), new THREE.LineBasicMaterial({ color: 0xcfcac0, transparent: true, opacity: 0.7 }));
    G.add(linee); G.userData = { calotta, linee }; G.traverse(m => { if (m.isMesh || m.isLine) m.raycast = () => {}; });
    return G;
  }
  function seggiolino() {
    const G = new THREE.Group(); const grigio = mStd(0x2f3336, 0.6, 0.3);
    G.add(mesh(new THREE.BoxGeometry(0.62, 0.12, 0.6), grigio, 0, 0.45, 0)); G.add(mesh(new THREE.BoxGeometry(0.62, 1.1, 0.14), grigio, 0, 0.95, -0.3));
    G.add(mesh(new THREE.BoxGeometry(0.5, 0.32, 0.16), mStd(0x1a222a), 0, 1.6, -0.28)); G.add(mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.5, 10), mStd(0x616d74, 0.5, 0.5), 0, 0.1, -0.28));
    return G;
  }
  function camion() {   // veicolo della squadra ostile
    const G = new THREE.Group(), v = mStd(0x55593f), s = mStd(0x222222);
    G.add(mesh(new THREE.BoxGeometry(2.3, 1.6, 2.0), v, 0, 1.5, 2.2)); G.add(mesh(new THREE.BoxGeometry(2.4, 1.4, 3.4), mStd(0x4b4f38), 0, 1.6, -0.6));
    [[-1.05, 2.1], [1.05, 2.1], [-1.05, -1.4], [1.05, -1.4]].forEach(([x, z]) => { const r = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 14), s, x, 0.5, z); r.rotation.z = PI / 2; G.add(r); });
    return G;
  }
  function rottami() {   // frammenti del Typhoon: strisce scure, deriva, motore
    const G = new THREE.Group(), m1 = mStd(0x3a3f45, 0.5, 0.4), m2 = mStd(0x1b1c1e, 0.9), m3 = mStd(0x8d949b, 0.5, 0.4);
    for (let i = 0; i < 16; i++) { const p = mesh(new THREE.BoxGeometry(rnd(0.6, 3.2), rnd(0.08, 0.5), rnd(0.5, 2.4)), i % 3 ? m2 : m1, rnd(-14, 14), 0.2, rnd(-18, 10)); p.rotation.set(rnd(-0.6, 0.6), rnd(0, PI), rnd(-0.4, 0.4)); G.add(p); }
    const der = mesh(new THREE.BoxGeometry(0.15, 3.2, 2.6), m3, 4, 1.5, -6); der.rotation.set(0.3, 0.6, 0.5); G.add(der);
    const mot = mesh(new THREE.CylinderGeometry(0.5, 0.42, 3.6, 14), m1, -3, 0.5, 2); mot.rotation.set(PI / 2, 0.4, 0.2); G.add(mot);
    const crat = new THREE.Mesh(new THREE.CircleGeometry(22, 32), new THREE.MeshBasicMaterial({ color: 0x14110e, transparent: true, opacity: 0.85, depthWrite: false })); crat.rotation.x = -PI / 2; crat.position.y = 0.15; G.add(crat);
    G.traverse(m => { if (m.isMesh) m.raycast = () => {}; });
    return G;
  }

  /* ======================= mondo della missione ======================= */
  let W = null;   // stato del mondo
  function piazzaSuolo(o, p, dy) { o.position.set(p.x, suolo(p.x, p.z) + (dy || 0), p.z); }
  function prepara(S) {
    chiudi();
    const sc = I().scene; if (!sc) return null;
    const T = texture();
    W = { S, sc, oggetti: [], fumo: particelle(sc, 900, false, T.fumo), fuoco: particelle(sc, 500, true, T.fuoco), t: 0, vento: { x: 2.2, z: 1.4 }, segnale: false, esposizione: 0, avvisoT: 0 };
    const add = o => { sc.add(o); W.oggetti.push(o); return o; };
    const L = LUOGHI;
    // relitto in fiamme (dopo il filmato)
    W.relitto = add(rottami()); piazzaSuolo(W.relitto, L.relitto); W.relitto.visible = false;
    // pilota isolato, seduto accanto a un albero, paracadute afflosciato e pannello arancione segnaletico
    W.ip = add(persona({ nome: "LUPO 21", tuta: 0x56653a, giubbotto: 0x3d4a2c, casco: 0xd9d8cf, visore: true }));
    piazzaSuolo(W.ip, L.ip); W.ip.rotation.y = 2.4; posa(W.ip, "seduto"); W.ip.visible = false;
    W.calotta = add(paracadute()); W.calotta.scale.set(1, 0.07, 1.25); piazzaSuolo(W.calotta, { x: L.ip.x + 9, z: L.ip.z + 6 }, 0.3); W.calotta.rotation.set(0.08, 0.6, 0.05); W.calotta.userData.linee.visible = false; W.calotta.visible = false;
    W.albero = add(new THREE.Group()); W.albero.add(mesh(new THREE.CylinderGeometry(0.16, 0.3, 4.5, 8), mStd(0x4a3a28), 0, 2.2, 0));
    [[2.6, 3.4, 3.6], [2.1, 3.0, 5.6], [1.5, 2.6, 7.4], [0.9, 2.0, 9.0]].forEach(([r, h, y], i) => { const c = mesh(new THREE.ConeGeometry(r, h, 11), mStd(i % 2 ? 0x2b4527 : 0x30502c, 0.95), 0, y, 0); c.rotation.y = i; W.albero.add(c); });
    piazzaSuolo(W.albero, { x: L.ip.x - 1.6, z: L.ip.z - 1.2 });
    W.pannello = add(new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), new THREE.MeshStandardMaterial({ color: 0xff5a10, roughness: 0.8, emissive: 0x401000 }))); W.pannello.rotation.x = -PI / 2; piazzaSuolo(W.pannello, L.lz, 0.12);
    // minaccia: squadra con MANPADS e veicolo
    W.ostili = add(new THREE.Group()); piazzaSuolo(W.ostili, L.minaccia); W.ostili.add(camion());
    [[3, 1, 0.6], [4.2, -1.5, 2.2], [-2.5, 2.5, 3.6]].forEach(([x, z, r], i) => { const p = persona({ tuta: 0x4a4a3c, giubbotto: 0x2c2c26, casco: 0x3a3a30, fucile: true }); p.position.set(x, 0, z); p.rotation.y = r; posa(p, i ? "in piedi" : "ginocchio"); W.ostili.add(p); });
    // elicottero di recupero: 6,5 km a sud, 400 ft sul terreno, prua a nord, 60 kt
    piazzaElicottero(S, L.partenza, 0, 122, 31);
    return W;
  }
  // il rilievo arriva a riquadri: finché un riquadro non è caricato la quota vale 0. Gli oggetti fissi si riallineano.
  function riallinea() {
    if (!W) return; const L = LUOGHI;
    [[W.relitto, L.relitto, 0], [W.ip, L.ip, 0], [W.albero, { x: L.ip.x - 1.6, z: L.ip.z - 1.2 }, 0], [W.pannello, L.lz, 0.12], [W.ostili, L.minaccia, 0], [W.calotta, { x: L.ip.x + 9, z: L.ip.z + 6 }, 0.3]]
      .forEach(([o, p, dy]) => { if (o) o.position.y = suolo(p.x, p.z) + dy; });
  }
  function terrenoPronto() { const d = VOLO.debug, m = d && /^(\d+)\/(\d+)$/.exec(String(d.terreno || "")); return !!m && +m[2] > 0 && +m[1] >= +m[2]; }
  function piazzaElicottero(S, p, hdgDeg, agl, v) {
    const P = S.pl, h = hdgDeg * D2R; P.pos.set(p.x, suolo(p.x, p.z) + agl, p.z);
    P.Q.copy(VOLO._acc.assetto(h, 0, 0)); P.vel.set(Math.sin(h) * v, 0, -Math.cos(h) * v); P.rigid6 = null; P.rotorSim = null; P.aTerra = false;   // il simulatore del rotore si ricrea dalla nuova posizione P.carrello = true; S.thr = 0.64;
    if (P.obj) { P.obj.position.copy(P.pos); P.obj.quaternion.copy(P.Q); }
  }
  // stato utile alla lezione
  function info(S) {
    const P = S.pl, L = LUOGHI, d = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z), brg = (a) => (Math.atan2(a.x - P.pos.x, -(a.z - P.pos.z)) / D2R + 360) % 360;
    const agl = P.pos.y - suolo(P.pos.x, P.pos.z), v = Math.hypot(P.vel.x, P.vel.z);
    return { dIP: d(L.ip), brgIP: brg(L.ip), dLZ: d(L.lz), brgLZ: brg(L.lz), dMin: d(L.minaccia), dConsegna: d(L.consegna), brgConsegna: brg(L.consegna), agl, aglFt: agl * 3.28084, kt: v * 1.94384, vs: P.vel.y,
      inMinaccia: d(L.minaccia) < R_MINACCIA, esposto: d(L.minaccia) < R_MINACCIA && agl > AGL_MINACCIA, esposizione: W ? W.esposizione : 0, aTerra: !!P.aTerra, vivo: !!P.vivo };
  }
  // aggiornamento a ogni passo della lezione (in volo, non durante i filmati)
  function aggiorna(dt, S) {
    if (!W || W.S !== S) return;
    W.t += dt; effettiFissi(dt); if ((W.allT = (W.allT || 0) - dt) <= 0) { W.allT = 2; riallinea(); }
    const k = info(S);
    if (k.esposto) { W.esposizione += dt; W.avvisoT -= dt; if (W.avvisoT <= 0) { W.avvisoT = 3; try { VOLO._acc.messaggio("MANPADS IN VISTA · scendi sotto 300 ft", 2.5, "warn"); } catch (e) {} } }
    else W.esposizione = Math.max(0, W.esposizione - dt * 0.5);
    if (!W.segnale && k.dIP < 2000) { W.segnale = true; try { VOLO._acc.messaggio("LUPO 21: «vi sento, fumogeno arancione acceso»", 3.5); } catch (e) {} }
    strumenti(S, k);
  }
  // effetti persistenti: colonna di fumo e fuochi del relitto, fumogeno arancione del pilota, strobo
  function effettiFissi(dt) {
    if (!W) return; const L = LUOGHI, tW = W.t;
    if (W.relitto.visible) {
      const y = suolo(L.relitto.x, L.relitto.z);
      W.fumoT = (W.fumoT || 0) - dt; if (W.fumoT <= 0) { W.fumoT = 0.08;
        W.fumo.emetti({ pos: V3(L.relitto.x + rnd(-8, 8), y + 4, L.relitto.z + rnd(-8, 8)), vel: V3(rnd(-1, 1), rnd(7, 11), rnd(-1, 1)), vita: rnd(12, 16), s0: 7, s1: 46, a0: 0.55, col: 0x2a2724, col1: 0x6a6662, drag: 0.15, su: 0.25, vento: 0.9 }); }
      W.fiammaT = (W.fiammaT || 0) - dt; if (W.fiammaT <= 0) { W.fiammaT = 0.05;
        W.fuoco.emetti({ pos: V3(L.relitto.x + rnd(-9, 9), y + rnd(0.5, 2), L.relitto.z + rnd(-10, 8)), vel: V3(0, rnd(3, 6), 0), vita: rnd(0.5, 1.0), s0: rnd(2.5, 4.5), s1: 1, a0: 0.9, col: 0xffc060, col1: 0xff3a08, drag: 0.4 }); }
    }
    if (W.segnale) {
      // il fumogeno segna la LZ e il vento: sta sottovento, così l'elicottero si posa a monte del fumo
      const vd = Math.hypot(W.vento.x, W.vento.z) || 1, fx = L.lz.x + W.vento.x / vd * 25, fz = L.lz.z + W.vento.z / vd * 25, y = suolo(fx, fz);
      W.arancioT = (W.arancioT || 0) - dt; if (W.arancioT <= 0) { W.arancioT = 0.07;
        W.fumo.emetti({ pos: V3(fx, y + 0.4, fz), vel: V3(rnd(-0.4, 0.4), rnd(2, 3.2), rnd(-0.4, 0.4)), vita: rnd(6, 9), s0: 0.9, s1: 10, a0: 0.55, col: 0xff7a1c, col1: 0xf2b07a, drag: 0.3, su: 0.12, vento: 1.0 }); }
    }
    if (W.ip.visible) { const j = W.ip.userData.j; if (j && j.strobo) j.strobo.visible = W.plb && (tW % 1) < 0.08; }
    W.fumo.aggiorna(dt, W.vento); W.fuoco.aggiorna(dt, W.vento);
  }

  /* ======================= strumenti: radiogoniometro del PLB e marcatori ======================= */
  function strumenti(S, k) {
    const ov = I().overlay; if (!ov) return;
    if (!W.df) {
      W.df = document.createElement("canvas"); W.df.id = "soc-df"; W.df.width = 264; W.df.height = 300;
      Object.assign(W.df.style, { position: "absolute", left: "12px", top: "70px", width: "132px", height: "150px", pointerEvents: "none", zIndex: 30 });
      ov.appendChild(W.df);
      W.mk = document.createElement("canvas"); W.mk.id = "soc-mk"; Object.assign(W.mk.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: 29 }); ov.appendChild(W.mk);
    }
    if ((W.uiT = (W.uiT || 0) - 1) > 0) return; W.uiT = 3;
    const g = W.df.getContext("2d"), s = 2, P = S.pl, f = V3(0, 0, 1).applyQuaternion(P.Q), hdg = (Math.atan2(f.x, -f.z) / D2R + 360) % 360;
    g.clearRect(0, 0, 264, 300); g.fillStyle = "rgba(6,14,10,0.72)"; g.strokeStyle = "#5dff8f"; g.lineWidth = 1.5 * s;
    g.beginPath(); g.roundRect ? g.roundRect(2, 2, 260, 296, 16) : g.rect(2, 2, 260, 296); g.fill(); g.stroke();
    g.fillStyle = "#5dff8f"; g.font = `700 ${11 * s}px Consolas, monospace`; g.textAlign = "center"; g.fillText("PLB 406 · DF", 132, 26);
    const cx = 132, cy = 128, r = 74;
    g.beginPath(); g.arc(cx, cy, r, 0, PI * 2); g.stroke();
    for (let a = 0; a < 360; a += 30) { const q = (a - hdg) * D2R; g.beginPath(); g.moveTo(cx + Math.sin(q) * r, cy - Math.cos(q) * r); g.lineTo(cx + Math.sin(q) * (r - (a % 90 ? 7 : 14)), cy - Math.cos(q) * (r - (a % 90 ? 7 : 14))); g.stroke(); if (a % 90 === 0) { g.font = `700 ${9 * s}px Consolas, monospace`; g.fillText("NESW"[a / 90], cx + Math.sin(q) * (r - 26), cy - Math.cos(q) * (r - 26) + 7); } }
    const rel = (k.brgIP - hdg) * D2R, forza = clamp(1 - k.dIP / 12000, 0.08, 1);
    g.strokeStyle = "#ffb04d"; g.fillStyle = "#ffb04d"; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(cx - Math.sin(rel) * 22, cy + Math.cos(rel) * 22); g.lineTo(cx + Math.sin(rel) * (r - 18), cy - Math.cos(rel) * (r - 18)); g.stroke();
    g.beginPath(); const tx = cx + Math.sin(rel) * (r - 6), ty = cy - Math.cos(rel) * (r - 6); g.moveTo(tx, ty); g.lineTo(tx - Math.sin(rel - 0.35) * 16, ty + Math.cos(rel - 0.35) * 16); g.lineTo(tx - Math.sin(rel + 0.35) * 16, ty + Math.cos(rel + 0.35) * 16); g.fill();
    g.fillStyle = "#5dff8f"; g.font = `700 ${11 * s}px Consolas, monospace`; g.fillText(`${(k.dIP / 1000).toFixed(1)} km · ${Math.round(k.brgIP)}°`, 132, 234);
    for (let i = 0; i < 8; i++) { g.fillStyle = i < forza * 8 ? "#5dff8f" : "rgba(93,255,143,0.18)"; g.fillRect(60 + i * 18, 262 - i * 3, 12, 10 + i * 3); }
    if (k.inMinaccia) { g.fillStyle = k.esposto ? "#ff4d4d" : "#ffb04d"; g.font = `700 ${10 * s}px Consolas, monospace`; g.fillText(k.esposto ? `ESPOSTO ${Math.round(k.esposizione)} s` : "MINACCIA · basso", 132, 292); }
    // marcatori sullo schermo: pilota (rombo arancione) e zona di atterraggio
    const cam = I().camera, mk = W.mk, w = mk.clientWidth, h = mk.clientHeight; if (mk.width !== w) mk.width = w; if (mk.height !== h) mk.height = h;
    const m = mk.getContext("2d"); m.clearRect(0, 0, w, h); if (!cam || S.cam === "cockpit") return;
    const segna = (p, testo, col, dist) => { const v = V3(p.x, suolo(p.x, p.z) + 2, p.z).project(cam); if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) return; const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h;
      m.strokeStyle = col; m.lineWidth = 2; m.beginPath(); m.moveTo(x, y - 9); m.lineTo(x + 9, y); m.lineTo(x, y + 9); m.lineTo(x - 9, y); m.closePath(); m.stroke(); m.fillStyle = col; m.font = "700 12px Consolas, monospace"; m.textAlign = "left"; m.fillText(`${testo} ${dist < 1000 ? Math.round(dist) + " m" : (dist / 1000).toFixed(1) + " km"}`, x + 13, y + 4); };
    if (k.dIP < 3500) segna(LUOGHI.ip, "LUPO 21", "#ffb04d", k.dIP);
    if (k.dLZ < 1500) segna(LUOGHI.lz, "LZ", "#5dff8f", k.dLZ);
  }

  /* ======================= cinema: qualità, inquadrature, didascalie ======================= */
  let C = null;
  function stile() {
    if (document.getElementById("soc-stile")) return;
    const st = document.createElement("style"); st.id = "soc-stile";
    st.textContent = `#volo.soc-cine > :not(.soc-tieni){visibility:hidden!important}
#volo.soc-cine .soc-tieni{visibility:visible!important}
#soc-cine{position:absolute;inset:0;pointer-events:none;z-index:60;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
#soc-cine .barra{position:absolute;left:0;right:0;height:9vh;background:#000}
#soc-cine .vign{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,.45) 100%)}
#soc-cine .did{position:absolute;left:6vw;bottom:12vh;max-width:70vw;color:#f3f1ea;text-shadow:0 2px 6px #000;transition:opacity .6s}
#soc-cine .did b{display:block;font-size:clamp(15px,2.2vw,26px);letter-spacing:.06em;text-transform:uppercase}
#soc-cine .did span{font-size:clamp(12px,1.5vw,18px);opacity:.9}
#soc-cine .fade{position:absolute;inset:0;background:#000;opacity:0;transition:opacity .5s}
#soc-cine .lampo{position:absolute;inset:0;background:#fff7e0;opacity:0}
#soc-cine .salta{position:absolute;right:16px;bottom:calc(9vh + 12px);pointer-events:auto;background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:18px;padding:8px 14px;font-size:14px;cursor:pointer}
#soc-cine .q{position:absolute;right:16px;top:calc(9vh + 10px);color:rgba(255,255,255,.55);font:600 11px Consolas,monospace}`;
    document.head.appendChild(st);
  }
  function qualita(on) {
    const r = I().renderer; if (!r) return;
    if (on) { C.prDopo = r.getPixelRatio(); const w = r.domElement.clientWidth || innerWidth; C.pr = Math.min(3, Math.max(C.prDopo, 3840 / Math.max(320, w))); r.setPixelRatio(C.pr); }
    else if (C && C.prDopo) r.setPixelRatio(C.prDopo);
  }
  function cinema(durata, scena, fine) {
    const S = VOLO.stato, it = I(), ov = it.overlay; if (!S || !ov || !it.renderer) { fine && fine(); return; }
    stile(); finisci(true);
    C = { S, t: 0, durata, scena, fine, frames: 0, dtMedio: 1 / 60 };
    S.pausa = true; S.cineHud = false; C.near = it.camera.near; it.camera.near = 0.2;
    it.renderer.domElement.classList.add("soc-tieni"); ov.classList.add("soc-cine");
    const ui = document.createElement("div"); ui.id = "soc-cine"; ui.className = "soc-tieni";
    ui.innerHTML = `<div class="vign"></div><div class="barra" style="top:0"></div><div class="barra" style="bottom:0"></div><div class="did"><b></b><span></span></div><div class="lampo"></div><div class="fade"></div><div class="q"></div><button class="salta" type="button">Salta ›</button>`;
    ov.appendChild(ui); C.ui = ui; ui.querySelector(".salta").onclick = () => { C.t = C.durata; };
    it.renderer.domElement.style.filter = "contrast(1.06) saturate(1.08)";
    qualita(true);
    S.cineCam = (dtR, cam) => {
      if (!C) return; const dt = Math.min(0.05, dtR); C.frames++; C.dtMedio += (dt - C.dtMedio) * 0.05;
      // risoluzione adattiva: se il dispositivo non tiene i 24 fotogrammi al secondo si scende di un gradino
      if (C.frames > 40 && C.dtMedio > 1 / 22 && C.pr > (C.prDopo || 1) + 0.01) { C.pr = Math.max(C.prDopo || 1, C.pr * 0.8); I().renderer.setPixelRatio(C.pr); C.frames = 0; }
      const k = C.scala ? C.scala(C.t) : 1; C.t += dt * k;
      try { C.scena(C.t, dt * k, cam, dt); } catch (e) { console.warn("SOCCORSO filmato", e); C.t = C.durata; }
      cam.updateProjectionMatrix();
      if (W) { W.fumo.aggiorna(dt * k, W.vento); W.fuoco.aggiorna(dt * k, W.vento); }
      const q = C.ui && C.ui.querySelector(".q"); if (q) { const r = I().renderer, w = Math.round(r.domElement.width), h = Math.round(r.domElement.height); q.textContent = `${w}×${h}`; }
      if (C.t >= C.durata) finisci();
    };
  }
  function didascalia(titolo, testo) { if (!C || !C.ui) return; const d = C.ui.querySelector(".did"); d.querySelector("b").textContent = titolo || ""; d.querySelector("span").textContent = testo || ""; d.style.opacity = titolo || testo ? 1 : 0; }
  function dissolvenza(v) { if (C && C.ui) C.ui.querySelector(".fade").style.opacity = v; }
  function lampo(v) { if (C && C.ui) C.ui.querySelector(".lampo").style.opacity = v; }
  function finisci(silenzioso) {
    if (!C) return; const c = C, S = c.S, it = I(); C = null;
    S.cineCam = null; S.cineHud = true; S.pausa = false; if (it.camera && c.near) it.camera.near = c.near;
    if (it.overlay) it.overlay.classList.remove("soc-cine"); if (c.ui) c.ui.remove(); if (it.renderer) { it.renderer.domElement.style.filter = ""; if (c.prDopo) it.renderer.setPixelRatio(c.prDopo); }
    if (!silenzioso && c.fine) try { c.fine(); } catch (e) { console.warn(e); }
  }
  // camera: posizione e punto guardato con inseguimento morbido
  function inquadra(cam, pos, guarda, fov, morbido, dt) {
    if (morbido && C.camPos) { const k = 1 - Math.exp(-dt * morbido); C.camPos.lerp(pos, k); C.camGuarda.lerp(guarda, k); }
    else { C.camPos = pos.clone(); C.camGuarda = guarda.clone(); }
    const g = suolo(C.camPos.x, C.camPos.z) + 1.2; if (C.camPos.y < g) C.camPos.y = g;
    cam.position.copy(C.camPos); cam.up.set(0, 1, 0); cam.lookAt(C.camGuarda); cam.fov = fov || 50;
  }

  /* ======================= filmato 1: abbattimento, eiezione, impatto, atterraggio ======================= */
  // un modello nuovo per ogni Typhoon (clonare perde l'animazione degli ugelli): il glTF resta in cache in vista3d.js
  const nuovoJet = () => typeof VISTA3D === "undefined" ? Promise.resolve(null) : VISTA3D.modelloPromise("typhoon", undefined, { tipoId: "F2000", numero: "21" }).catch(() => null);
  let JET = null;
  function precarica() { if (!JET) JET = nuovoJet(); }
  // animazione degli ugelli anche senza la funzione del modello
  function animatore(m) { if (m && m.userData && typeof m.userData.anim === "function") return m.userData.anim;
    const fiamme = []; if (m) m.traverse(o => { if (o.name === "postbruciatore") fiamme.push(o); }); return st => { if (typeof POSTBRUCIATORE !== "undefined" && fiamme.length) POSTBRUCIATORE.anima(fiamme, st); }; }
  function filmatoSchianto(S, fine) {
    if (!W) { fine && fine(); return; }
    precarica();
    const pronto = JET || nuovoJet(); JET = null;
    const attesa = new Promise(ok => { const t0 = performance.now(); const prova = () => { if (terrenoPronto() || performance.now() - t0 > 10000) ok(); else setTimeout(prova, 300); }; prova(); });
    Promise.all([pronto, attesa]).then(([mod]) => { if (!W) return; riallinea();
      const L = LUOGHI, sc = W.sc, gW = suolo(L.relitto.x, L.relitto.z), Wp = V3(L.relitto.x, gW, L.relitto.z);
      const jet = new THREE.Group(); sc.add(jet); W.oggetti.push(jet);
      const m = mod || VISTA3D.jetFallback(0x6b7680); jet.add(m);
      const anim = animatore(m);
      // il tettuccio del modello sparisce all'eiezione
      let tettoGLB = null; m.traverse(o => { if (o.isMesh && /canopy/i.test(o.name)) tettoGLB = o; });
      // rotta: da sud-est verso il versante, colpito, cabrata, eiezione, picchiata sul versante
      const hdg = 315 * D2R, f = V3(Math.sin(hdg), 0, -Math.cos(hdg)), r = V3(Math.cos(hdg), 0, Math.sin(hdg));
      const K = [[0, 2500, 220, 0], [2.5, 1950, 240, 60], [5.5, 1280, 560, 150], [7.0, 980, 640, 170], [9.5, 430, 330, 90], [11.0, 0, 0, 0]];
      const punti = K.map(([t, d, agl, lat], i) => { const p = Wp.clone().addScaledVector(f, -d).addScaledVector(r, lat); p.y = i === K.length - 1 ? gW : suolo(p.x, p.z) + agl; return p; });
      const curva = new THREE.CatmullRomCurve3(punti, false, "centripetal");
      const uDi = t => { t = clamp(t, 0, 11); for (let i = 0; i < K.length - 1; i++) if (t <= K[i + 1][0]) return (i + (t - K[i][0]) / (K[i + 1][0] - K[i][0])) / (K.length - 1); return 1; };
      const posJet = t => curva.getPoint(uDi(t)), velJet = t => posJet(Math.min(11, t + 0.02)).sub(posJet(Math.max(0, t - 0.02))).multiplyScalar(1 / 0.04);
      const rollio = t => t < 2.6 ? 0 : t < 6.3 ? ss(2.6, 6.3, t) * 28 : 28 + ss(6.3, 11, t) * 105;
      const orient = (t) => { const v = velJet(t); const h = Math.atan2(v.x, -v.z), p = Math.atan2(v.y, Math.hypot(v.x, v.z)); return VOLO._acc.assetto(h, p, rollio(t) * D2R); };
      // missile spalleggiabile dalla squadra ostile verso il motore destro
      const lancio = V3(L.minaccia.x, suolo(L.minaccia.x, L.minaccia.z) + 2, L.minaccia.z), tImp = 2.6, tLancio = 0.6;
      const missile = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8), mStd(0x6a6f5a)); missile.rotation.x = PI / 2; const mg = new THREE.Group(); mg.add(missile); sc.add(mg); W.oggetti.push(mg);
      // eiezione: tettuccio, seggiolino con razzo, pilota, paracadute
      const tet = mesh(new THREE.SphereGeometry(0.85, 14, 8, 0, PI * 2, 0, PI / 2), new THREE.MeshStandardMaterial({ color: 0x9fb4c6, transparent: true, opacity: 0.45, roughness: 0.15, metalness: 0.3, side: THREE.DoubleSide })); tet.scale.set(0.74, 0.64, 2.25); tet.visible = false; sc.add(tet); W.oggetti.push(tet);
      const seg = seggiolino(); seg.visible = false; sc.add(seg); W.oggetti.push(seg);
      const pil = persona({ tuta: 0x56653a, giubbotto: 0x3d4a2c, casco: 0xd9d8cf, visore: true }); pil.visible = false; sc.add(pil); W.oggetti.push(pil);
      const para = paracadute(); para.visible = false; sc.add(para); W.oggetti.push(para);
      const te = 6.3, E = { pos: null, vel: null, sepT: te + 1.05, aperto: te + 1.25, gonfio: te + 2.2 };
      const atterra = V3(L.ip.x, suolo(L.ip.x, L.ip.z), L.ip.z);
      const vento = V3(2.2, 0, 1.4);
      let impattato = false, colpito = false;
      const tetFis = { p: null, v: null, w: V3(rnd(2, 4), rnd(-1, 1), rnd(-1, 1)) };
      // posizione del paracadute dopo l'apertura: discesa vera, poi (dopo lo stacco d'inquadratura) gli ultimi 48 m sopra il punto d'atterraggio
      const posPara = (t) => {
        if (t < 13) { const d = E.dep.clone(); const k = t - E.gonfio; d.y -= k * 6.6; d.addScaledVector(vento, k).addScaledVector(atterra.clone().sub(E.dep).setY(0), k / 60); return d; }
        const k = t - 13, h = Math.max(0, 48 - k * 6.6); return V3(atterra.x - vento.x * h / 6.6, atterra.y + h, atterra.z - vento.z * h / 6.6);
      };
      const tTocco = 13 + 48 / 6.6;
      cinema(27, (t, dt, cam, dtReale) => {
        const J = posJet(t), Q = orient(Math.min(t, 10.98));
        // --- Typhoon ---
        if (!impattato) { jet.visible = true; jet.position.copy(J); jet.quaternion.copy(Q); if (anim) anim({ afterburner: t < 2.6 ? 0.25 : 0, spinta: 1, t }); }
        const fw = V3(0, 0, 1).applyQuaternion(Q), su = V3(0, 1, 0).applyQuaternion(Q), dx = V3(-1, 0, 0).applyQuaternion(Q);
        // --- MANPADS ---
        if (t >= tLancio && t < tImp) { const k = (t - tLancio) / (tImp - tLancio), bersaglio = posJet(tImp).addScaledVector(fw, -6); const p = lancio.clone().lerp(bersaglio, k); p.y += Math.sin(k * PI) * 120; mg.visible = true; mg.position.copy(p); mg.lookAt(bersaglio);
          scia(W.fumo, E, "pMis", p, 2.5, q => ({ pos: q.add(V3(rnd(-0.3, 0.3), rnd(-0.3, 0.3), rnd(-0.3, 0.3))), vel: V3(rnd(-0.6, 0.6), rnd(0, 0.8), rnd(-0.6, 0.6)), vita: rnd(2.8, 4), s0: 0.9, s1: 6, a0: 0.5, col: 0xefede8, drag: 1.2 }));
          W.fuoco.emetti({ pos: p, vita: 0.1, s0: 2.2, s1: 0.6, a0: 1, col: 0xfff0c0, col1: 0xff8a30 }); }
        else mg.visible = false;
        if (t >= tImp && !colpito) { colpito = true; lampo(0.35); const p = J.clone().addScaledVector(fw, -6);
          for (let i = 0; i < 26; i++) W.fuoco.emetti({ pos: p, vel: V3(rnd(-25, 25), rnd(-15, 25), rnd(-25, 25)), vita: rnd(0.4, 0.9), s0: rnd(3, 6), s1: 10, a0: 1, col: 0xfff0b0, col1: 0xff4a10, drag: 2 });
          for (let i = 0; i < 14; i++) W.fumo.emetti({ pos: p, vel: V3(rnd(-8, 8), rnd(-4, 8), rnd(-8, 8)), vita: rnd(2, 4), s0: 3, s1: 14, a0: 0.6, col: 0x2b2826, drag: 1.5 }); }
        if (C && C.ui && colpito) lampo(Math.max(0, 0.35 - (t - tImp) * 2));
        // motore in fiamme e scia nera
        if (colpito && !impattato) { const p = J.clone().addScaledVector(fw, -7.2).addScaledVector(dx, 0.5).addScaledVector(su, -1.2), v = velJet(t);
          W.fuoco.emetti({ pos: p, vel: v.clone().multiplyScalar(0.6).add(V3(rnd(-3, 3), rnd(-3, 3), rnd(-3, 3))), vita: rnd(0.25, 0.5), s0: rnd(2.2, 3.4), s1: 0.8, a0: 1, col: 0xffd070, col1: 0xff3a08, drag: 3 });
          scia(W.fumo, E, "pMot", p, 3.5, q => ({ pos: q, vel: v.clone().multiplyScalar(0.18).add(V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1))), vita: rnd(4, 6.5), s0: 2.2, s1: 15, a0: 0.42, col: 0x2a2725, col1: 0x5c5853, drag: 1.4, su: 0.4 })); }
        // --- eiezione ---
        if (t >= te && !E.pos) { E.pos = J.clone().addScaledVector(fw, 4.6).addScaledVector(su, 1.0); E.vel = velJet(t).multiplyScalar(0.92).addScaledVector(su, 34); E.q = Q.clone();
          tetFis.p = E.pos.clone().addScaledVector(su, 0.6); tetFis.v = velJet(t).multiplyScalar(0.9).addScaledVector(su, 22); tet.visible = true; if (tettoGLB) tettoGLB.visible = false; }
        if (E.pos && t < E.gonfio + 0.01) {
          tetFis.v.y -= 9.8 * dt; tetFis.v.multiplyScalar(Math.exp(-dt * 0.9)); tetFis.p.addScaledVector(tetFis.v, dt); tet.position.copy(tetFis.p); tet.rotation.x += tetFis.w.x * dt; tet.rotation.z += tetFis.w.y * dt;
          const razzo = t < te + 0.28; E.vel.y -= 9.8 * dt; E.vel.multiplyScalar(Math.exp(-dt * 1.1)); if (razzo) E.vel.addScaledVector(su, 160 * dt);
          E.pos.addScaledVector(E.vel, dt);
          if (t < E.sepT) { seg.visible = true; seg.position.copy(E.pos); seg.quaternion.copy(E.q); pil.visible = true; pil.position.copy(E.pos); pil.quaternion.copy(E.q); posa(pil, "seggiolino"); }
          else { seg.position.addScaledVector(E.vel, dt).add(V3(0, -4 * dt, 0)); seg.rotation.x += 2.5 * dt; pil.position.copy(E.pos); pil.quaternion.slerp(new THREE.Quaternion(), Math.min(1, dt * 3)); posa(pil, "appeso", 0, ss(E.sepT, E.gonfio, t)); }
          if (razzo) { W.fuoco.emetti({ pos: E.pos.clone().addScaledVector(su, -0.4), vel: su.clone().multiplyScalar(-30), vita: 0.18, s0: 1.6, s1: 0.5, a0: 1, col: 0xfff2c0, col1: 0xff6a10 }); scia(W.fumo, E, "pSeg", E.pos.clone().addScaledVector(su, -0.6), 0.8, q => ({ pos: q, vel: V3(rnd(-1.5, 1.5), rnd(-1.5, 1.5), rnd(-1.5, 1.5)), vita: rnd(2.5, 3.5), s0: 0.6, s1: 4.5, a0: 0.5, col: 0xdcd8d0, drag: 1.6 })); }
          if (t >= E.aperto) { para.visible = true; const k = ss(E.aperto, E.gonfio, t); para.position.copy(E.pos).add(V3(0, -1.5, 0)); para.scale.set(0.15 + 0.85 * k, 0.4 + 0.6 * k, 0.15 + 0.85 * k); }
          if (t >= E.gonfio - 0.01 && !E.dep) E.dep = E.pos.clone();
        }
        if (E.dep && t >= E.gonfio) {
          seg.visible = t < 12; seg.position.y -= 40 * dt;
          const p = posPara(t), arrivato = t >= tTocco;
          if (!arrivato) { para.visible = true; const resp = 1 + 0.03 * Math.sin(t * 2.3); para.scale.set(resp, 1 / resp, resp); para.position.copy(p).add(V3(0, -1.55, 0)); para.rotation.y += dt * 0.15; pil.position.copy(p).add(V3(0, -1.55, 0)); posa(pil, "appeso", t, 1); }
          else { // a terra: la calotta si affloscia sottovento, il pilota si siede e accende il radiofaro
            const k = ss(tTocco, tTocco + 1.6, t), vd = vento.clone().setY(0).normalize(); para.position.copy(atterra).addScaledVector(vd, 4 + 6 * k); para.position.y = suolo(para.position.x, para.position.z) + 0.3 * (1 - k) + 0.2;
            para.scale.set(1 + 0.15 * k, Math.max(0.06, 1 - k), 1 + 0.15 * k); para.rotation.set(0, 0, -0.08 * k); para.userData.linee.visible = k < 0.6;
            pil.position.copy(atterra); pil.rotation.set(0, 2.4, 0); pil.quaternion.setFromEuler(pil.rotation); posa(pil, t < tTocco + 1.2 ? "cammina" : "seduto", t);
            const j = pil.userData.j; if (j && t > 22.4) j.strobo.visible = (t % 1) < 0.1;
          }
        }
        // --- impatto sul versante ---
        if (t >= 11 && !impattato) { impattato = true; jet.visible = false; lampo(0.8);
          const p = Wp.clone().add(V3(0, 3, 0));
          for (let i = 0; i < 16; i++) W.fuoco.emetti({ pos: p.clone().add(V3(rnd(-6, 6), rnd(0, 6), rnd(-6, 6))), vel: V3(rnd(-10, 10), rnd(4, 14), rnd(-10, 10)), vita: rnd(0.25, 0.5), s0: rnd(26, 40), s1: 50, a0: 0.55, col: 0xfff4d0, col1: 0xffa040, drag: 2 });
          for (let i = 0; i < 120; i++) W.fuoco.emetti({ pos: p.clone().add(V3(rnd(-12, 12), rnd(0, 8), rnd(-12, 12))), vel: V3(rnd(-26, 26), rnd(10, 44), rnd(-26, 26)), vita: rnd(1.2, 3.0), s0: rnd(7, 13), s1: rnd(20, 36), a0: 0.42, inA: 0.04, col: 0xffb347, col1: 0x8a1c04, drag: 1.5, su: 2.5 });
          for (let i = 0; i < 90; i++) W.fumo.emetti({ pos: p.clone().add(V3(rnd(-14, 14), rnd(2, 16), rnd(-14, 14))), vel: V3(rnd(-14, 14), rnd(10, 34), rnd(-14, 14)), vita: rnd(8, 14), s0: 10, s1: 55, a0: 0.8, inA: 0.15, col: 0x1b1917, col1: 0x4d4945, drag: 0.8, su: 0.8, vento: 0.6 });
          for (let i = 0; i < 40; i++) { const a = i / 40 * PI * 2; W.fumo.emetti({ pos: p.clone().add(V3(Math.cos(a) * 6, -1, Math.sin(a) * 6)), vel: V3(Math.cos(a) * 42, 2, Math.sin(a) * 42), vita: rnd(2, 3.4), s0: 5, s1: 20, a0: 0.5, col: 0x7a6a55, drag: 1.4 }); }
          for (let i = 0; i < 60; i++) W.fuoco.emetti({ pos: p, vel: V3(rnd(-60, 60), rnd(20, 75), rnd(-60, 60)), vita: rnd(1.5, 3.2), s0: 1.4, s1: 0.5, a0: 1, col: 0xffd080, col1: 0xff4010, drag: 0.4, su: -9.8 });
          W.relitto.visible = true; }
        if (impattato) { lampo(Math.max(0, 0.8 - (t - 11) * 2.4)); effettiFissiCinema(dt); }   // la colonna di fumo continua
        // --- inquadrature (orizzonte stabile: offset con l'alto del mondo, non con il rollio del jet) ---
        const avH = V3(fw.x, 0, fw.z).normalize(), alto = V3(0, 1, 0), sx = V3(-avH.z, 0, avH.x);   // sx: sinistra del jet sul piano
        if (t < 2.4) { didascalia("Area non permissiva · Monte Grappa", "LUPO 21 · Eurofighter Typhoon in ricognizione armata a bassa quota"); dissolvenza(Math.max(0, 1 - t * 1.5));
          if (!C.sA) { const j = posJet(1.4), b = j.clone().addScaledVector(r, -150); b.y = j.y - 22; C.sA = libera(b, j); }
          inquadra(cam, C.sA, J, 30, 0, dt); }
        else if (t < 6.2) { didascalia(t < 4.5 ? "MANPADS" : "Colpito al motore destro", t < 4.5 ? "Missile spalleggiabile da una squadra ostile sul versante" : "Fuoco al motore, il pilota cabra per guadagnare quota");
          inquadra(cam, J.clone().addScaledVector(avH, -38).addScaledVector(alto, 7).addScaledVector(sx, 8), J.clone().addScaledVector(avH, 20), 50, t < 2.45 ? 0 : 6, dt); }
        else if (t < 8.6) { didascalia("Eiezione", "Tettuccio, razzo del seggiolino, separazione, apertura del paracadute");
          if (!C.ancora) C.ancora = { p: J.clone().addScaledVector(sx, 15).addScaledVector(alto, 3).addScaledVector(avH, 3), v: velJet(t) };
          const kv = t < te + 0.5 ? 1 : Math.max(0.35, 1 - (t - te - 0.5) * 0.9); C.ancora.p.addScaledVector(C.ancora.v, dt * kv);
          const g = E.pos ? E.pos.clone() : J.clone().addScaledVector(fw, 4.6); inquadra(cam, C.ancora.p, g, 40, 6, dt); }
        else if (t < 10.9) { didascalia("Il velivolo senza pilota", "Il paracadute è aperto, il Typhoon scende verso il versante");
          inquadra(cam, J.clone().addScaledVector(avH, -70).addScaledVector(alto, 16), J.clone().addScaledVector(avH, 30), 48, t < 8.65 ? 0 : 4, dt); }
        else if (t < 13.2) { didascalia("Impatto", "Il relitto brucia: la colonna di fumo si vede a chilometri");
          const bers = Wp.clone().add(V3(0, 25, 0)); if (!C.sE) { const b = Wp.clone().addScaledVector(r, 420).add(V3(0, 40, 0)); b.y = Math.max(b.y, suolo(b.x, b.z) + 40); C.sE = libera(b, bers); }
          inquadra(cam, C.sE, bers, 32, 0, dt); }
        else if (t < 20.8) { didascalia("Discesa", "Il pilota scende verso un prato del versante, sottovento al relitto");
          const c = posPara(t).add(V3(0, -1.5, 0)), a = mix(0.5, 2.1, ss(13, 20.8, t)); inquadra(cam, c.clone().add(V3(Math.cos(a) * 24, 3 - ss(13, 20.8, t) * 4, Math.sin(a) * 24)), c.clone().add(V3(0, 2, 0)), 50, t < 13.25 ? 0 : 3, dt); }
        else { const k = ss(20.8, 27, t), vd = vento.clone().setY(0).normalize(), lato = V3(-vd.z, 0, vd.x);
          didascalia(t < 22.4 ? "LUPO 21 a terra" : t < 24.6 ? "PLB 406 MHz attivo" : "Personale isolato", t < 22.4 ? "Ferito a una gamba, si mette al riparo vicino a un albero" : t < 24.6 ? "Il satellite COSPAS-SARSAT localizza il segnale: «Mayday, LUPO 21 a terra»" : "Si attiva il Personnel Recovery: elicottero con il team STOS Pararescue");
          const p = atterra.clone().addScaledVector(vd, -mix(11, 7, k)).addScaledVector(lato, mix(5, 3, k)); p.y = atterra.y + 1.6; inquadra(cam, p, atterra.clone().add(V3(0, 0.8, 0)), 38, 0, dt); dissolvenza(ss(25.8, 27, t)); }
      }, () => {
        // dopo il filmato: restano relitto, pilota al riparo, calotta a terra; si toglie quello che serviva solo al filmato
        [jet, mg, tet, seg, pil, para].forEach(o => { if (o.parent) o.parent.remove(o); });
        W.relitto.visible = true; W.ip.visible = true; W.calotta.visible = true; W.plb = true;
        fine && fine();
      });
      C.scala = t => (t > 6.28 && t < 7.7) ? 0.32 : 1;   // eiezione al rallentatore
    });
  }

  /* ======================= filmato 2: recupero con gli STOS ======================= */
  function filmatoRecupero(S, fine) {
    if (!W) { fine && fine(); return; }
    const sc = W.sc, P = S.pl, L = LUOGHI, it = I();
    const lz = V3(L.lz.x, suolo(L.lz.x, L.lz.z), L.lz.z), ip = V3(L.ip.x, suolo(L.ip.x, L.ip.z), L.ip.z);
    // l'elicottero si posa sulla LZ con la prua verso sud (uscita), qualunque fosse il suo assetto
    // portellone destro verso il pilota: il team corre dritto da lui, lontano dal rotore di coda
    const vIP = ip.clone().sub(lz).setY(0).normalize(), hdgUscita = Math.atan2(vIP.z, vIP.x);
    const P0 = P.pos.clone(), Q0 = P.Q.clone(), Qa = VOLO._acc.assetto(hdgUscita, 0, 0);
    const gh = (P.A && P.A.gearHeight) || 1.85, posaH = lz.clone().add(V3(0, gh, 0));
    const fw = V3(Math.sin(hdgUscita), 0, -Math.cos(hdgUscita)), dx = V3(Math.cos(hdgUscita), 0, Math.sin(hdgUscita));   // dx: lato destro
    const porta = posaH.clone().addScaledVector(dx, 2.2).add(V3(0, -gh + 0.1, 0));
    // team STOS Pararescue: capo squadra, PJ con la borsa medica, due operatori di sicurezza
    const colori = { mimetica: true, giubbotto: 0x4f4b3a, casco: 0x5d5a47, attrezzi: 0x2c2a24, fucile: true, zaino: 0x5a5440, visore: true, guanti: true };
    const team = [persona(Object.assign({ nome: "STOS 1 (capo)" }, colori)), persona(Object.assign({ nome: "STOS PJ" }, colori, { borsa: true })), persona(Object.assign({ nome: "STOS 3" }, colori)), persona(Object.assign({ nome: "STOS 4" }, colori))];
    team.forEach(p => { p.visible = false; sc.add(p); W.oggetti.push(p); });
    const perimetro = [45, 135, 225, 315].map(a => { const q = hdgUscita + a * D2R; return lz.clone().add(V3(Math.sin(q) * 16, 0, -Math.cos(q) * 16)); });
    const versoIP = ip.clone().sub(lz).setY(0).normalize(), presso = ip.clone().addScaledVector(versoIP, -1.6);
    const rotori = () => { const u = P.obj && P.obj.userData; return u && u.uh60Rotors; };
    const ruota = (dt, rpm) => { const r = rotori(); if (!r) return; const a = r.main && r.main.userData.centurionRotorAxis || "z", b = r.tail && r.tail.userData.centurionRotorAxis || "y"; if (r.main) r.main.rotation[a] += dt * 27 * rpm; if (r.tail) r.tail.rotation[b] += dt * 135 * rpm; };
    const scorta = []; [0, 1].forEach(() => nuovoJet().then(mod => { if (!mod || !W) return; mod.visible = false; mod.userData.animSar = animatore(mod); sc.add(mod); W.oggetti.push(mod); scorta.push(mod); }));
    W.segnale = true;
    // in vista cabina il modello esterno è nascosto: per il filmato si passa alla camera esterna e si torna dopo
    const camPrima = S.cam; S.cam = "chase";
    try { if (P.obj && window.CENTURION_COCKPIT) CENTURION_COCKPIT.setView(P.obj, S.cfg.aereo, false); } catch (e) {}
    const terraLungo = (a, b, k) => { const p = a.clone().lerp(b, k); p.y = suolo(p.x, p.z); return p; };
    const metti = (p, pos, guardaVerso) => { p.visible = true; p.position.copy(pos); if (guardaVerso) p.rotation.set(0, Math.atan2(guardaVerso.x - pos.x, guardaVerso.z - pos.z), 0); };
    cinema(31, (t, dt, cam) => {
      // gruppo che rientra (pilota sostenuto): dopo lo stacco parte a 12 m dalla porta e cammina a 1,9 m/s
      const verso = porta.clone().addScaledVector(versoIP, Math.max(0, 12 - Math.max(0, t - 15.6) * 1.9));
      // --- elicottero: atterraggio (se in hovering), a terra, poi decollo e uscita ---
      let H;
      if (t < 2.6) { const k = ss(0, 2.6, t); H = P0.clone().lerp(posaH, k); P.Q.copy(Q0).slerp(Qa, k); }
      else if (t < 25) { H = posaH.clone(); P.Q.copy(Qa); }
      else { const k = t - 25; H = posaH.clone().add(V3(0, Math.min(k, 3) * 3.2 + Math.max(0, k - 3) * 5, 0)).addScaledVector(fw, Math.max(0, k - 2.2) ** 2 * 3.2); P.Q.copy(VOLO._acc.assetto(hdgUscita, -ss(25.5, 28, t) * 10 * D2R, 0)); }
      P.pos.copy(H); if (P.obj) { P.obj.visible = true; P.obj.position.copy(H); P.obj.quaternion.copy(P.Q); } ruota(dt, 1);
      // --- flusso del rotore: polvere ed erba che corrono via radialmente ---
      const hAGL = H.y - suolo(H.x, H.z);
      if (hAGL < 35 && Math.random() < 0.9) for (let i = 0; i < 3; i++) { const a = rnd(0, PI * 2), rr = rnd(3, 9), p = V3(H.x + Math.cos(a) * rr, suolo(H.x + Math.cos(a) * rr, H.z + Math.sin(a) * rr) + 0.4, H.z + Math.sin(a) * rr), sp = rnd(10, 16) * (1 - hAGL / 40);
        W.fumo.emetti({ pos: p, vel: V3(Math.cos(a) * sp, rnd(0.5, 2.5), Math.sin(a) * sp), vita: rnd(1.0, 1.8), s0: 1.4, s1: 6.5, a0: 0.32, col: i ? 0x9a8b6c : 0x7d8a5a, drag: 1.1 }); }
      // --- team STOS ---
      team.forEach((p, i) => {
        const uscita = 2.8 + i * 0.45;
        if (t < uscita) { p.visible = false; return; }
        if (i >= 2) {   // sicurezza: corsa al perimetro, in ginocchio rivolti all'esterno, rientro per ultimi
          const dest = perimetro[i === 2 ? 0 : 1], kc = ss(uscita, uscita + 3, t);
          if (t < 21.0 + i * 0.4) { const pos = terraLungo(porta, dest, kc); metti(p, pos, kc < 1 ? dest : pos.clone().add(dest.clone().sub(lz))); posa(p, kc < 1 ? "corsa" : "ginocchio", t * 1.6); }
          else { const kr = ss(21.0 + i * 0.4, 23.8 + i * 0.3, t); const pos = terraLungo(dest, porta, kr); metti(p, pos, porta); posa(p, "corsa", t * 1.6); p.visible = kr < 0.98; }
        } else {        // capo squadra e PJ: corsa verso il pilota (stacco), autenticazione e cure, poi lo sostengono fino all'elicottero
          const lato = i ? 0.9 : -0.9, laterale = V3(-versoIP.z, 0, versoIP.x), vicino = presso.clone().addScaledVector(laterale, lato);
          if (t < 8.6) { const d = Math.min(30, (t - uscita) * 4.2); const a = porta.clone().addScaledVector(versoIP, d).addScaledVector(laterale, lato); a.y = suolo(a.x, a.z); metti(p, a, vicino); posa(p, "corsa", t * 1.7); }
          else if (t < 15.6) { const k = ss(8.6, 9.4, t); const a = vicino.clone().addScaledVector(versoIP, -3 * (1 - k)); a.y = suolo(a.x, a.z); metti(p, a, ip); posa(p, k < 0.99 ? "corsa" : (i ? "cura" : "ginocchio"), t * 1.2); }
          else if (t < 22) { const a = verso.clone().addScaledVector(laterale, lato * 0.7); a.y = suolo(a.x, a.z); metti(p, a, porta); posa(p, "cammina", t * 1.1); }
          else { p.visible = t < 22.6; }
        }
      });
      // --- il pilota: autenticato, curato, sostenuto fino all'elicottero ---
      W.ip.visible = t < 22.4; const j = W.ip.userData.j;
      if (t < 9.5) { posa(W.ip, t > 6 ? "saluta" : "seduto", t); if (t > 6) { j.bac.position.y = 0.2; j.anche.forEach(o => o.rotation.x = -1.45); } }
      else if (t < 15.6) { posa(W.ip, "seduto"); if (!W.laccio && t > 12) { W.laccio = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.1, 10), mStd(0x111111)); W.laccio.position.set(0, -0.2, 0); j.anche[1].add(W.laccio); } }
      else if (t < 22) { const a = verso.clone(); a.y = suolo(a.x, a.z); W.ip.position.copy(a); W.ip.rotation.set(0, Math.atan2(porta.x - a.x, porta.z - a.z), 0); posa(W.ip, "sostenuto", t * 1.1); }
      // --- scorta: due Typhoon passano sopra durante l'uscita ---
      scorta.forEach((s, i) => { const k = t - 27.2 - i * 0.35; s.visible = k > -1 && k < 3; if (!s.visible) return; const p = posaH.clone().addScaledVector(fw, -900 + k * 260).addScaledVector(dx, -40 + i * 70); p.y = posaH.y + 160 + i * 25; s.position.copy(p); s.quaternion.copy(VOLO._acc.assetto(hdgUscita, 0, (i ? 18 : -10) * D2R)); if (s.userData.animSar) s.userData.animSar({ afterburner: 0, spinta: 1, t }); });
      effettiFissiCinema(dt);
      // --- inquadrature e didascalie ---
      if (t < 3.5) { didascalia("CAESAR 1 · atterraggio nella LZ", "Il flusso del rotore solleva polvere ed erba; il fumogeno arancione indica il vento"); dissolvenza(Math.max(0, 1 - t * 1.6));
        inquadra(cam, lz.clone().addScaledVector(dx, 38).addScaledVector(fw, 14).add(V3(0, 1.6, 0)), H.clone().add(V3(0, 1, 0)), 44, t < 0.05 ? 0 : 2, dt); }
      else if (t < 8.6) { didascalia("Team STOS a terra", "Due operatori formano il perimetro di sicurezza, capo squadra e Pararescue (PJ) vanno verso il pilota");
        // dal fianco del portellone, davanti al muso: si vedono l'elicottero e il team che corre verso il pilota
        inquadra(cam, porta.clone().addScaledVector(fw, 11).addScaledVector(versoIP, 4).add(V3(0, 2.2, 0)), porta.clone().addScaledVector(versoIP, 16).add(V3(0, 1, 0)), 50, t < 3.55 ? 0 : 2, dt); }
      else if (t < 15.6) { didascalia(t < 11.5 ? "Autenticazione" : "Prime cure (TCCC)", t < 11.5 ? "Il PJ verifica l'identità con le domande della scheda ISOPREP: risposta corretta" : "Emorragia controllata, gamba immobilizzata, valutazione e conforto");
        inquadra(cam, ip.clone().addScaledVector(versoIP, -3.2).add(V3(2.4, 1.3, 1.2)), ip.clone().add(V3(0, 0.7, 0)), 36, t < 8.65 ? 0 : 1.5, dt); }
      else if (t < 22) { didascalia("Verso l'elicottero", "Il pilota, sostenuto da capo squadra e PJ; il perimetro resta in posizione fino all'imbarco");
        const c = W.ip.position.clone(); inquadra(cam, c.clone().addScaledVector(dx, 7).addScaledVector(fw, 5).add(V3(0, 1.8, 0)), c.clone().add(V3(0, 1.1, 0)), 44, t < 15.65 ? 0 : 2.5, dt); }
      else if (t < 25) { didascalia("Superstite a bordo", "«CAESAR 1, PJ: superstite a bordo, team completo» · il perimetro rientra per ultimo");
        inquadra(cam, porta.clone().addScaledVector(dx, 11).addScaledVector(fw, -6).add(V3(0, 1.5, 0)), porta.clone().add(V3(0, 1.2, 0)), 46, t < 22.05 ? 0 : 2, dt); }
      else { didascalia("Uscita", "Rotta verso il punto di consegna, a bassa quota, con la scorta dei Typhoon"); dissolvenza(ss(30, 31, t));
        inquadra(cam, posaH.clone().addScaledVector(dx, -60).addScaledVector(fw, 40).add(V3(0, 12, 0)), H.clone().add(V3(0, 2, 0)), 46, t < 25.05 ? 0 : 3, dt); }
    }, () => {
      team.forEach(p => { if (p.parent) p.parent.remove(p); }); scorta.forEach(s => { if (s.parent) s.parent.remove(s); });
      // si riprende il volo: in uscita verso sud, 120 ft sul terreno, 40 kt
      const h = hdgUscita / D2R; piazzaElicottero(S, { x: P.pos.x, z: P.pos.z }, h, 37, 20); S.thr = 0.68; S.cam = camPrima || "chase";
      fine && fine();
    });
  }
  function effettiFissiCinema(dt) { /* i fuochi del relitto e il fumogeno continuano anche nel filmato */ if (!W) return; const t0 = W.t; effettiFissiSenzaAggiorna(dt); W.t = t0 + dt; }
  function effettiFissiSenzaAggiorna(dt) { const f = W.fumo.aggiorna, g = W.fuoco.aggiorna; W.fumo.aggiorna = () => {}; W.fuoco.aggiorna = () => {}; try { effettiFissi(dt); } finally { W.fumo.aggiorna = f; W.fuoco.aggiorna = g; } }

  /* ======================= pulizia ======================= */
  function chiudi() {
    if (C) finisci(true);
    if (!W) return; const w = W; W = null;
    w.oggetti.forEach(o => { if (o.parent) o.parent.remove(o); }); w.fumo.dispose(); w.fuoco.dispose();
    if (w.df) w.df.remove(); if (w.mk) w.mk.remove();
  }

  return { LUOGHI, R_MINACCIA, AGL_MINACCIA, prepara, aggiorna, info, filmatoSchianto, filmatoRecupero, precarica, chiudi, get mondo() { return W; }, get inFilmato() { return !!C; }, get tFilmato() { return C ? C.t : null; },
    _posa: posa, _persona: persona };
})();
