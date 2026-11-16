/* =====================================================================
   MODELLI 3D DEI VELIVOLI – costruzione parametrica dettagliata (Three.js r150)
   Sistema di riferimento del modello: muso +Z, alto +Y, destra +X, metri.
   - fusoliera loftata (Catmull-Rom) da 12-16 sezioni super-ellittiche con chine, radome in tono diverso
   - ali / impennaggi a profilo NACA con bordo d'attacco separato, flaperon/alettoni/timoni incernierati
   - prese d'aria con condotto, interno scuro, rampa/cono/splitter; tettuccio con montanti, pilota, seggiolino, HUD
   - ugelli a 12 petali (o 2D vettoriali), anello incandescente, fiamma con diamanti di Mach
   - armamento (AIM-120, AIM-9, R-77, GBU, pod), serbatoi, antenne, pitot, sonda/receptacle, IRST
   - texture procedurali: pannelli + rivetti + usura, coccarde/stella, NO STEP, numero di coda, strisce deriva
   - tipi da supporto: KC30 (A330 MRTT) e E7 (737 Wedgetail)
   API: MODELLI.costruisci(tipoId, {colore, armi, numero}) → THREE.Group con .userData.parti e .userData.anim(stato)
   ===================================================================== */
const MODELLI = (() => {
  const d2r = d => d * Math.PI / 180;
  const texCache = {};
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const rgbStr = (c, f) => { const k = new THREE.Color(c); f = f || 1; return `rgb(${Math.min(255, Math.round(k.r * 255 * f))},${Math.min(255, Math.round(k.g * 255 * f))},${Math.min(255, Math.round(k.b * 255 * f))})`; };
  const rossastro = c => { const k = new THREE.Color(c); return k.r > k.g * 1.45 && k.r > k.b * 1.45; };
  function tela(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h || w; return c; }
  function texDa(c, rip, lin) { const t = new THREE.CanvasTexture(c); if (rip) t.wrapS = t.wrapT = THREE.RepeatWrapping; if (!lin && THREE.sRGBEncoding !== undefined && t.encoding !== undefined) t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }
  // generatore pseudo-casuale riproducibile (stesso disegno pannelli per colore e bump)
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* ---------- pannelli: disegno condiviso tra mappa colore e bump ---------- */
  function disegnaPannelli(g, W, base, bump, stealth) {
    const R = rng(7); g.fillStyle = bump ? "rgb(128,128,128)" : rgbStr(base); g.fillRect(0, 0, W, W);
    const righe = []; let y = 0; while (y < W) { const h = 40 + Math.floor(R() * 70); righe.push([y, h]); y += h; }
    righe.forEach(([y0, h]) => { let x = 0; while (x < W) { const w = 50 + Math.floor(R() * 110); if (!bump) { const f = 0.94 + R() * 0.1; g.fillStyle = rgbStr(base, f); g.fillRect(x, y0, w, h); }
      g.strokeStyle = bump ? "rgba(40,40,40,0.9)" : "rgba(0,0,0,0.32)"; g.lineWidth = 1.2; g.beginPath();
      if (stealth) { const n = 6; g.moveTo(x, y0); for (let i = 1; i <= n; i++) g.lineTo(x + w * i / n, y0 + (i % 2 ? 6 : 0)); } else { g.moveTo(x, y0); g.lineTo(x + w, y0); }
      g.moveTo(x, y0); g.lineTo(x, y0 + h); g.stroke();
      if (!stealth) { g.fillStyle = bump ? "rgba(60,60,60,0.8)" : "rgba(0,0,0,0.28)"; for (let i = 4; i < w; i += 7) { g.fillRect(x + i, y0 + 3, 1.2, 1.2); } for (let j = 4; j < h; j += 7) g.fillRect(x + 3, y0 + j, 1.2, 1.2); }
      if (R() < 0.12 && !bump) { g.strokeStyle = "rgba(0,0,0,0.25)"; g.strokeRect(x + w * 0.3, y0 + h * 0.3, w * 0.3, h * 0.35); } // sportelli d'ispezione
      x += w; } });
    if (!bump) { // usura: colature lungo il flusso (asse v), graffi, macchie
      for (let i = 0; i < 70; i++) { const x = R() * W, y0 = R() * W, l = 20 + R() * 120; const gr = g.createLinearGradient(x, y0, x, y0 + l); gr.addColorStop(0, "rgba(20,20,20,0.10)"); gr.addColorStop(1, "rgba(20,20,20,0)"); g.fillStyle = gr; g.fillRect(x, y0, 1 + R() * 3, l); }
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${R() < 0.5 ? 255 : 0},${R() < 0.5 ? 255 : 0},${R() < 0.5 ? 255 : 0},0.035)`; g.fillRect(R() * W, R() * W, 2, 2); }
      for (let i = 0; i < 14; i++) { g.fillStyle = "rgba(255,255,255,0.05)"; g.beginPath(); g.arc(R() * W, R() * W, 6 + R() * 20, 0, 7); g.fill(); }
    }
  }
  function texPannelli(col, stealth) {
    const key = col + (stealth ? "s" : ""); if (texCache[key]) return texCache[key];
    const c = tela(512); disegnaPannelli(c.getContext("2d"), 512, col, false, stealth); return (texCache[key] = texDa(c, true));
  }
  function texBump(stealth) {
    const key = "bump" + (stealth ? "s" : ""); if (texCache[key]) return texCache[key];
    const c = tela(512); disegnaPannelli(c.getContext("2d"), 512, 0, true, stealth); return (texCache[key] = texDa(c, true, true));
  }
  /* coccarda tricolore (BLUE) o stella rossa (RED) su sfondo trasparente */
  function texInsegna(rosso) {
    const key = "ins" + (rosso ? "R" : "B"); if (texCache[key]) return texCache[key];
    const c = tela(128), g = c.getContext("2d");
    if (rosso) { const st = (r, col) => { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.4 : r; g.lineTo(64 + Math.cos(a) * rr, 66 + Math.sin(a) * rr); } g.closePath(); g.fill(); }; st(62, "#ffffff"); st(54, "#b0161c"); }
    else { [[62, "#0b8a3e"], [42, "#f4f4f4"], [22, "#c8202c"]].forEach(([r, col]) => { g.fillStyle = col; g.beginPath(); g.arc(64, 64, r, 0, Math.PI * 2); g.fill(); }); }
    return (texCache[key] = texDa(c));
  }
  function texTesto(testo, w, h, col, bordo) {
    const key = "txt" + testo + w + col + bordo; if (texCache[key]) return texCache[key];
    const c = tela(w, h), g = c.getContext("2d"); if (bordo) { g.strokeStyle = col; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6); }
    g.fillStyle = col; g.font = `bold ${Math.round(h * 0.6)}px Arial`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(testo, w / 2, h / 2 + 1);
    return (texCache[key] = texDa(c));
  }
  /* deriva: pannelli + strisce in cima + numero di coda; uv normalizzate sul riquadro della deriva */
  function texDeriva(col, numero, rosso, stealth) {
    const key = "der" + col + numero + (rosso ? 1 : 0) + (stealth ? 1 : 0); if (texCache[key]) return texCache[key];
    const c = tela(256), g = c.getContext("2d"); disegnaPannelli(g, 256, col, false, stealth);
    g.save(); g.translate(0, 256); g.scale(1, -1); // v=0 alla radice
    const s1 = rosso ? "#b0161c" : "#1d3f8f", s2 = rosso ? "#f2f2f2" : "#f2c12e";
    g.fillStyle = s1; g.fillRect(0, 196, 256, 22); g.fillStyle = s2; g.fillRect(0, 218, 256, 9); g.fillStyle = s1; g.fillRect(0, 227, 256, 6);
    g.restore();
    if (rosso) { g.fillStyle = "#b0161c"; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 9 : 22; g.lineTo(100 + Math.cos(a) * rr, 96 + Math.sin(a) * rr); } g.closePath(); g.fill(); }
    else { [["#0b8a3e", 0], ["#f4f4f4", 1], ["#c8202c", 2]].forEach(([c2, i]) => { g.fillStyle = c2; g.fillRect(76 + i * 16, 80, 16, 30); }); } // fin flash tricolore
    g.fillStyle = stealth ? "rgba(40,44,50,0.75)" : "rgba(25,25,25,0.85)"; g.font = "bold 46px Arial"; g.textAlign = "center"; g.fillText(numero, 92, 168);
    g.font = "bold 16px Arial"; g.fillText(rosso ? "ВВС" : "AM", 92, 196);
    return (texCache[key] = texDa(c));
  }
  const matSkin = (col, st) => new THREE.MeshStandardMaterial({ color: 0xffffff, map: texPannelli(col, st), bumpMap: texBump(st), bumpScale: 0.6, roughness: st ? 0.62 : 0.5, metalness: st ? 0.25 : 0.38 });
  const matTinta = (col, r, m) => new THREE.MeshStandardMaterial({ color: col, roughness: r == null ? 0.55 : r, metalness: m == null ? 0.3 : m });
  const matGlass = oro => new THREE.MeshPhysicalMaterial({ color: oro ? 0x8a7a3a : 0x3a5878, metalness: 0.3, roughness: 0.04, transparent: true, opacity: 0.42, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false });
  const matAdd = (col, op) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op == null ? 0.85 : op, blending: THREE.AdditiveBlending, depthWrite: false });
  const matDecal = t => new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
  const mesh = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.position.set(x || 0, y || 0, z || 0); return m; };

  /* ---------- loft di sezioni super-ellittiche ----------
     sez: [{z, w, h, y, x, top, bot, sq (2=ellisse, >2 squadrata), ch (spigolo/chine), kz/kx (inclinazione bocca)}] */
  const CAMPI = ["z", "w", "h", "y", "x", "top", "bot", "sq", "ch", "kz", "kx"], DEF = { y: 0, x: 0, top: 1, bot: 1, sq: 2, ch: 0, kz: 0, kx: 0 };
  function interpSez(sez, sub) {
    const n = sez.length, out = [], get = (i, k) => { const s = sez[Math.max(0, Math.min(n - 1, i))]; return s[k] != null ? s[k] : DEF[k]; };
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < sub; j++) { const t = j / sub, o = {};
      CAMPI.forEach(k => { const p0 = get(i - 1, k), p1 = get(i, k), p2 = get(i + 1, k), p3 = get(i + 2, k);
        o[k] = k === "z" ? p1 + (p2 - p1) * t : 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t); });
      o.w = Math.max(0.004, o.w); o.h = Math.max(0.004, o.h); o.sq = Math.max(1.3, o.sq); out.push(o); }
    const l = {}; CAMPI.forEach(k => l[k] = get(n - 1, k)); out.push(l); return out;
  }
  function puntoSez(s, a) {
    const c = Math.cos(a), si = Math.sin(a), e = 2 / s.sq; let x = Math.sign(c) * Math.pow(Math.abs(c), e) * s.w; const y = Math.sign(si) * Math.pow(Math.abs(si), e) * s.h * (si > 0 ? s.top : s.bot);
    if (s.ch) x *= 1 + s.ch * Math.pow(1 - Math.abs(si), 6);
    return [s.x + x, s.y + y, s.z + s.kz * y / s.h + s.kx * x / s.w];
  }
  function loftGeo(rings, n, cap0, cap1) {
    const pos = [], uv = [], idx = [], R = rings.length; let rr = 0; rings.forEach(s => rr = Math.max(rr, (s.w + s.h) / 2)); const per = 2 * Math.PI * rr / 4;
    rings.forEach(s => { for (let i = 0; i <= n; i++) { const p = puntoSez(s, -Math.PI / 2 + i / n * Math.PI * 2); pos.push(p[0], p[1], p[2]); uv.push(i / n * per, s.z / 4); } });
    const m = n + 1; for (let r = 0; r < R - 1; r++) for (let i = 0; i < n; i++) { const a = r * m + i, b = a + 1, c = a + m, d = c + 1; idx.push(a, c, b, b, c, d); }
    if (cap0) { const c0 = pos.length / 3; pos.push(rings[0].x, rings[0].y, rings[0].z); uv.push(0, rings[0].z / 4); for (let i = 0; i < n; i++) idx.push(c0, i, i + 1); }
    if (cap1) { const c1 = pos.length / 3, b0 = (R - 1) * m, L = rings[R - 1]; pos.push(L.x, L.y, L.z); uv.push(0, L.z / 4); for (let i = 0; i < n; i++) idx.push(c1, b0 + i + 1, b0 + i); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const nr = g.attributes.normal; for (let r = 0; r < R; r++) { const a = r * m, b = a + n; const v = V3(nr.getX(a) + nr.getX(b), nr.getY(a) + nr.getY(b), nr.getZ(a) + nr.getZ(b)).normalize(); nr.setXYZ(a, v.x, v.y, v.z); nr.setXYZ(b, v.x, v.y, v.z); } // cucitura liscia
    return g;
  }
  /* loft → mesh; o: {n, sub, cap0, cap1, zSplit (radome), matSplit} */
  function loft(sez, mat, o) {
    o = o || {}; const rings = interpSez(sez, o.sub || 2), n = o.n || 28, c0 = o.cap0 !== false, c1 = o.cap1 !== false;
    if (o.zSplit == null) return mesh(loftGeo(rings, n, c0, c1), mat);
    let k = rings.findIndex(r => r.z <= o.zSplit); if (k < 1) k = 1;
    const g = new THREE.Group(); g.add(mesh(loftGeo(rings.slice(0, k + 1), n, c0, false), o.matSplit)); g.add(mesh(loftGeo(rings.slice(k), n, false, c1), mat)); return g;
  }
  /* sezione interpolata della fusoliera alla quota z (per posare insegne, antenne, ecc.) */
  function sezA(sez, z) { const r = interpSez(sez, 4); for (let i = 0; i < r.length - 1; i++) if (r[i].z >= z && r[i + 1].z <= z) { const t = (r[i].z - z) / ((r[i].z - r[i + 1].z) || 1), o = {}; CAMPI.forEach(k => o[k] = r[i][k] + (r[i + 1][k] - r[i][k]) * t); return o; } return r[r.length - 1]; }
  const specchiaSez = sez => sez.map(s => Object.assign({}, s, { x: -(s.x || 0), kx: -(s.kx || 0) }));

  /* ---------- superfici portanti a profilo NACA ----------
     st: stazioni [{x (apertura), zl (bordo d'attacco), zt (bordo d'uscita), y, t (spessore relativo)}]
     o: {mat, s (+1 destra / -1 sinistra), mob: [{i0, i1, cf, tipo}], le: {cf, mat}, uvBox, cap0} */
  const NP = 9, XS = []; for (let i = 0; i <= NP; i++) XS.push((1 - Math.cos(i / NP * Math.PI)) / 2);
  const naca = x => 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
  function superficie(st, o) {
    const s = o.s || 1, G = new THREE.Group(); G.userData.mob = []; const mob = o.mob || [];
    let zmin = 1e9, zmax = -1e9, xmax = 0; st.forEach(q => { zmin = Math.min(zmin, q.zt); zmax = Math.max(zmax, q.zl); xmax = Math.max(xmax, q.x); });
    const pt = (q, f, lato) => { const c = q.zl - q.zt; return [s * q.x, (q.y || 0) + lato * naca(f) * (q.t || 0.05) * c, q.zl - c * f]; };
    function geo(tratti) { // tratti: [{A, B, a, b, c0, c1}]
      const pos = [], uv = [], idx = [], M = 2 * (NP + 1);
      const anello = (q, a, b) => { const r = []; for (let k = 0; k <= NP; k++) r.push([pt(q, a + (b - a) * XS[k], 1), 1]); for (let k = NP; k >= 0; k--) r.push([pt(q, a + (b - a) * XS[k], -1), -1]); return r; };
      const push = (p, lato) => { pos.push(p[0], p[1], p[2]); if (o.uvBox) { let u = (p[2] - zmin) / (zmax - zmin); if (lato < 0) u = 1 - u; /* lato destro: u invertita, numero leggibile */ uv.push(u, Math.abs(p[0]) / xmax); } else uv.push(p[0] / 4, p[2] / 4); };
      const tri = (a, b, c) => { if (s > 0) idx.push(a, b, c); else idx.push(a, c, b); };
      tratti.forEach(tr => { const b0 = pos.length / 3, rA = anello(tr.A, tr.a, tr.b), rB = anello(tr.B, tr.a, tr.b);
        rA.forEach(p => push(p[0], p[1])); rB.forEach(p => push(p[0], p[1]));
        for (let k = 0; k < M; k++) { const k1 = (k + 1) % M, A0 = b0 + k, A1 = b0 + k1, B0 = b0 + M + k, B1 = b0 + M + k1; tri(A0, B0, A1); tri(A1, B0, B1); }
        [[tr.c0, rA, b0, 1], [tr.c1, rB, b0 + M, -1]].forEach(([on, r, base, verso]) => { if (!on) return; const cc = [0, 0, 0]; r.forEach(p => { cc[0] += p[0][0] / M; cc[1] += p[0][1] / M; cc[2] += p[0][2] / M; }); const ci = pos.length / 3; push(cc, 0);
          for (let k = 0; k < M; k++) { const k1 = (k + 1) % M; if (verso > 0) tri(ci, base + k, base + k1); else tri(ci, base + k1, base + k); } }); });
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    const le = o.le ? o.le.cf : 0, corpo = [], bordo = [];
    for (let j = 0; j < st.length - 1; j++) { const m = mob.find(q => j >= q.i0 && j < q.i1), b = m ? 1 - m.cf : 1, ult = j === st.length - 2;
      corpo.push({ A: st[j], B: st[j + 1], a: le, b, c0: j === 0 && o.cap0, c1: ult }); if (le) bordo.push({ A: st[j], B: st[j + 1], a: 0, b: le, c0: j === 0 && o.cap0, c1: ult }); }
    G.add(mesh(geo(corpo), o.mat)); if (le) G.add(mesh(geo(bordo), o.le.mat));
    mob.forEach(m => { const tr = []; for (let j = m.i0; j < m.i1; j++) tr.push({ A: st[j], B: st[j + 1], a: 1 - m.cf, b: 1, c0: j === m.i0, c1: j === m.i1 - 1 });
      const h0 = pt(st[m.i0], 1 - m.cf, 0), h1 = pt(st[m.i1], 1 - m.cf, 0), H0 = V3(h0[0], h0[1], h0[2]), dir = V3(h1[0], h1[1], h1[2]).sub(H0).normalize();
      const est = new THREE.Group(); est.position.copy(H0); est.quaternion.setFromUnitVectors(V3(1, 0, 0), dir);
      const gg = geo(tr); gg.translate(-H0.x, -H0.y, -H0.z); gg.applyQuaternion(est.quaternion.clone().invert());
      const inn = new THREE.Group(); inn.userData.mob = true; inn.add(mesh(gg, o.matMob || o.mat)); est.add(inn); G.add(est); G.userData.mob.push({ piv: inn, tipo: m.tipo, s }); });
    return G;
  }
  // stazioni da array compatto [x, zl, zt, t] con diedro (gradi) e quota y
  const staz = (arr, diedro, y) => arr.map(([x, zl, zt, t]) => ({ x, zl, zt, t: t || 0.045, y: (y || 0) + x * Math.tan(d2r(diedro || 0)) }));

  /* ---------- tettuccio: vetro, montanti, cornice, interni ----------
     cn: {zf (punta), zb (coda), w, h, y (base), pk (posizione picco 0..1), archi:[f], posti:[z], oro} */
  function secCan(cn, f) {
    let k; if (f <= cn.pk) k = Math.pow(Math.sin(f / cn.pk * Math.PI / 2), 0.55); else { const u = (f - cn.pk) / (1 - cn.pk); k = 1 - 0.8 * Math.pow(u, 1.5); }
    return { z: cn.zf + (cn.zb - cn.zf) * f, w: Math.max(0.01, cn.w * k), h: Math.max(0.01, cn.h * k), y: cn.y, x: 0, top: 1, bot: 0.3, sq: 2.3, ch: 0, kz: 0, kx: 0 };
  }
  function tettuccio(cn, M) {
    const G = new THREE.Group(), FS = [0, 0.02, 0.06, 0.12, 0.2, 0.3, cn.pk, 0.55, 0.65, 0.75, 0.84, 0.92, 1].filter((f, i, a) => i === 0 || f > a[i - 1]);
    const vetro = mesh(loftGeo(FS.map(f => secCan(cn, f)), 22, true, true), M.vetro); vetro.castShadow = false; vetro.renderOrder = 2; G.add(vetro);
    const tubo = (pts, r) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(6, pts.length), r, 4, false), M.telaio);
    (cn.archi || []).forEach(f => { const s = secCan(cn, f), p = []; for (let i = 0; i <= 10; i++) { const q = puntoSez(Object.assign({}, s, { w: s.w * 1.015, h: s.h * 1.015 }), -0.05 + i / 10 * (Math.PI + 0.1)); p.push(V3(q[0], q[1], q[2])); } G.add(tubo(p, 0.035)); });
    [0.06, Math.PI - 0.06].forEach(a => { const p = []; for (let i = 0; i <= 10; i++) { const s = secCan(cn, 0.03 + i / 10 * 0.95), q = puntoSez(Object.assign({}, s, { w: s.w * 1.02 + 0.02 }), a); p.push(V3(q[0], q[1], q[2])); } G.add(tubo(p, 0.04)); }); // cornice/davanzale
    const hc = cn.y + cn.h * 0.62; // centro casco
    (cn.posti || []).forEach((z, i) => {
      G.add(mesh(new THREE.BoxGeometry(0.5, 0.95, 0.14), M.sedile, 0, hc - 0.45, z - 0.3)); G.add(mesh(new THREE.BoxGeometry(0.42, 0.3, 0.2), M.sedile, 0, hc + 0.12, z - 0.26)); // schienale, poggiatesta
      G.add(mesh(new THREE.BoxGeometry(0.14, 0.05, 0.05), M.giallo, 0, hc + 0.3, z - 0.2)); // maniglia eiezione
      G.add(mesh(new THREE.BoxGeometry(0.46, 0.5, 0.3), M.tuta, 0, hc - 0.45, z - 0.08)); // busto
      G.add(mesh(new THREE.SphereGeometry(0.145, 10, 7), M.casco, 0, hc, z));
      G.add(mesh(new THREE.SphereGeometry(0.152, 10, 4, Math.PI / 2 - 1.05, 2.1, 1.05, 0.7), M.visiera, 0, hc, z));
      G.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), M.sedile, 0, hc - 0.1, z + 0.12));
      G.add(mesh(new THREE.BoxGeometry(0.62, 0.07, 0.38), M.sedile, 0, hc - 0.28, z + 0.62)); // cruscotto/paraluce
      if (i === 0) { const hud = mesh(new THREE.PlaneGeometry(0.17, 0.15), M.hud, 0, hc - 0.13, z + 0.72); hud.rotation.x = -0.45; hud.castShadow = false; G.add(hud); G.add(mesh(new THREE.BoxGeometry(0.2, 0.05, 0.14), M.sedile, 0, hc - 0.22, z + 0.72)); }
    });
    return G;
  }
  /* ---------- presa d'aria: condotto aperto, fondo scuro, rampa/cono, splitter ----------
     p: {x, y, z, w, h, l, sq, kz, kx, xi, wi, hi, yi, dop, rampa, cono, split: 'lat'|'h'} */
  function presa(p, M) {
    const G = new THREE.Group(), lato = sx => {
      const x = p.x * sx, xi = (p.xi != null ? p.xi : p.x) * sx, yi = p.yi != null ? p.yi : p.y, base = { sq: p.sq || 2, kz: p.kz || 0, kx: (p.kx || 0) * sx };
      const sez = [Object.assign({ z: p.z, x, y: p.y, w: p.w, h: p.h }, base), Object.assign({}, base, { z: p.z - 0.3, x, y: p.y, w: p.w * 1.04, h: p.h * 1.04 }),
        { z: p.z - p.l * 0.45, x: (x + xi) / 2, y: (p.y + yi) / 2, w: (p.w + p.wi) / 2, h: (p.h + p.hi) / 2, sq: base.sq }, { z: p.z - p.l, x: xi, y: yi, w: p.wi, h: p.hi, sq: base.sq }];
      G.add(loft(sez, M.skinDS, { n: 20, cap0: false }));
      const zIn = p.z - Math.abs(p.kz || 0) - Math.abs(p.kx || 0) - 0.45, fondo = mesh(new THREE.CircleGeometry(1, 20), M.buio, x, p.y, zIn); fondo.scale.set(p.w * 0.97, p.h * 0.97, 1); G.add(fondo);
      const anello = mesh(new THREE.RingGeometry(0.75, 1, 20), M.condotto, x, p.y, zIn + 0.02); anello.scale.set(p.w, p.h, 1); G.add(anello);
      if (p.cono) { const c = mesh(new THREE.ConeGeometry(Math.min(p.w, p.h) * 0.32, 0.35, 10), M.metallo, x, p.y, zIn + 0.18); c.rotation.x = Math.PI / 2; G.add(c); }
      if (p.rampa) { const r = mesh(new THREE.BoxGeometry(p.w * 1.85, 0.04, 1.1), M.condotto, x, p.y + p.h * 0.72, zIn + 0.75); r.rotation.x = 0.16; G.add(r); }
      if (p.split === "lat") G.add(mesh(new THREE.BoxGeometry(0.04, p.h * 1.7, 1.3), M.skin, x - sx * (p.w + 0.07), p.y, p.z - 0.5));
      if (p.split === "h") G.add(mesh(new THREE.BoxGeometry(p.w * 2.1, 0.04, 1.1), M.skin, x, p.y + p.h + 0.07, p.z - 0.45));
      if (p.vmid) G.add(mesh(new THREE.BoxGeometry(0.035, p.h * 1.9, 0.8), M.skin, x, p.y, p.z - 0.5)); // splitter verticale centrale

    };
    lato(1); if (p.dop) lato(-1); return G;
  }
  /* ---------- ugello: carenatura, 12 petali, anello incandescente, fiamma con diamanti di Mach ---------- */
  function fiamma(r, M) {
    const F = new THREE.Group(), mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = false; return m; };
    const cono = (rr, L, seg) => { const g = new THREE.ConeGeometry(rr, L, seg, 1, true); g.rotateX(-Math.PI / 2); g.translate(0, 0, -L / 2); return g; };
    F.add(mk(cono(r * 0.82, 7, 16), M.fiamma)); F.add(mk(cono(r * 0.6, 3.2, 12), M.nucleo));
    const dd = []; for (let i = 0; i < 4; i++) { const d = mk(new THREE.SphereGeometry(r * (0.42 - i * 0.06), 8, 4), M.diamanti); d.scale.z = 2.3; d.position.z = -1.1 - i * 1.25; F.add(d); dd.push(d); }
    F.visible = false; F.userData.mob = true; F.userData.diamanti = dd; return F;
  }
  function ugello(u, M) {
    const [x, y, z, r, tipo] = u, G = new THREE.Group(); G.position.set(x, y, z);
    const mats = { fiamma: matAdd(0xff7a2a, 0.7), nucleo: matAdd(0xa8c8ff, 0.8), diamanti: matAdd(0xfff0c0, 0.7), glow: new THREE.MeshBasicMaterial({ color: 0x3a1a05 }), anello: matAdd(0xff6a10, 0.6) };
    G.userData.mats = mats;
    if (tipo === "2d") { // F-22: ugello rettangolare con flap vettoriali
      const W = r * 1.25, H = r * 0.62;
      [-1, 1].forEach(sx => G.add(mesh(new THREE.BoxGeometry(0.07, H * 2.3, 1.7), M.metallo, sx * W, 0, -0.15)));
      G.add(mesh(new THREE.BoxGeometry(W * 2, H * 2, 0.04), mats.glow, 0, 0, 0.55)); G.add(mesh(new THREE.PlaneGeometry(W * 1.4, H * 0.9), mats.anello, 0, 0, 0.5));
      const flap = []; [-1, 1].forEach(sy => { const pv = new THREE.Group(); pv.position.set(0, sy * H, 0.45); const f = mesh(new THREE.BoxGeometry(W * 2, 0.06, 1.25), M.metallo, 0, 0, -0.62); pv.add(f); pv.userData.mob = true; G.add(pv); flap.push({ pv, sy }); });
      const F = fiamma(r, mats); F.scale.set(1.5, 0.6, 1); F.position.z = -0.3; G.add(F); G.userData.flap = flap; G.userData.fiamma = F; return G;
    }
    const prof = [[r * 1.07, 1.4], [r * 1.05, 0.7], [r * 0.98, 0.05], [r * 0.86, 0], [r * 0.84, 0.9]].map(q => new THREE.Vector2(q[0], q[1]));
    const cas = new THREE.LatheGeometry(prof, 20); cas.rotateX(Math.PI / 2); G.add(mesh(cas, M.metalloDS));
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, pv = new THREE.Group(); pv.rotation.z = a; const pt = mesh(new THREE.BoxGeometry(2 * Math.PI * r * 0.95 / 12 * 1.12, 0.025, 0.85), i % 2 ? M.petalo : M.metallo, 0, r * 0.9, -0.36); pt.rotation.x = -0.15; pv.add(pt); G.add(pv); }
    const fondo = mesh(new THREE.CircleGeometry(r * 0.85, 16), mats.glow, 0, 0, 0.88); fondo.rotation.y = Math.PI; G.add(fondo);
    const an = mesh(new THREE.RingGeometry(r * 0.32, r * 0.72, 18), mats.anello, 0, 0, 0.84); an.rotation.y = Math.PI; an.castShadow = false; G.add(an);
    const cc = mesh(new THREE.ConeGeometry(r * 0.28, 0.5, 10), M.metallo, 0, 0, 0.6); cc.rotation.x = -Math.PI / 2; G.add(cc);
    const F = fiamma(r, mats); F.position.z = -0.75; G.add(F); G.userData.fiamma = F; return G;
  }
  /* ---------- armamento e carichi (asse +Z, centrati) ---------- */
  function corpoLathe(L, r, ogiva, coda, seg) { // profilo di rivoluzione: ogiva in testa, rastremazione in coda
    const p = [[0.001, -L / 2], [r * (1 - coda), -L / 2], [r, -L / 2 + r * 2 * coda + 0.01], [r, L / 2 - r * ogiva], [r * 0.82, L / 2 - r * ogiva * 0.55], [r * 0.5, L / 2 - r * ogiva * 0.2], [0.001, L / 2]];
    const g = new THREE.LatheGeometry(p.map(q => new THREE.Vector2(q[0], q[1])), seg || 10); g.rotateX(Math.PI / 2); return g;
  }
  function pinne(G, mat, n, rr, z, span, cr, ct, sw, off) { // pinne trapezoidali radiali
    const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(span, -sw), new THREE.Vector2(span, -sw - ct), new THREE.Vector2(0, -cr)]);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }); geo.rotateX(Math.PI / 2); geo.translate(rr, 0.006, 0);
    for (let i = 0; i < n; i++) { const m = mesh(geo, mat, 0, 0, z); m.rotation.z = (off == null ? Math.PI / 4 : off) + i * Math.PI * 2 / n; G.add(m); }
  }
  function missile(tipo, M) {
    const G = new THREE.Group();
    if (tipo === "AIM9") { G.add(mesh(corpoLathe(2.87, 0.064, 2.2, 0, 8), M.missile)); pinne(G, M.missile, 4, 0.06, 1.05, 0.1, 0.28, 0.02, 0.24); pinne(G, M.missile, 4, 0.06, -1.05, 0.18, 0.34, 0.12, 0.18);
      G.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), M.vetroScuro, 0, 0, 1.43)); G.add(mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.05, 10).rotateX(Math.PI / 2), M.giallo, 0, 0, 0.75)); return G; }
    if (tipo === "R77") { G.add(mesh(corpoLathe(3.6, 0.1, 2.5, 0.1, 8), M.missileR)); pinne(G, M.missileR, 4, 0.1, 0.9, 0.05, 1.3, 1.1, 0.2);
      for (let i = 0; i < 4; i++) { const pv = new THREE.Group(); pv.rotation.z = Math.PI / 4 + i * Math.PI / 2; pv.position.z = -1.72; const gf = mesh(new THREE.BoxGeometry(0.06, 0.26, 0.05), M.metallo, 0, 0.23, 0); gf.rotation.z = Math.PI / 2; pv.add(gf); pv.add(mesh(new THREE.BoxGeometry(0.22, 0.012, 0.05), M.metallo, 0, 0.23, 0)); G.add(pv); } return G; }
    // AIM-120
    G.add(mesh(corpoLathe(3.65, 0.089, 2.6, 0, 8), M.missile)); pinne(G, M.missile, 4, 0.085, 0.55, 0.22, 0.5, 0.1, 0.4); pinne(G, M.missile, 4, 0.085, -1.4, 0.19, 0.38, 0.14, 0.2);
    G.add(mesh(new THREE.CylinderGeometry(0.091, 0.091, 0.05, 10).rotateX(Math.PI / 2), M.giallo, 0, 0, 0.85)); return G;
  }
  function bombaGbu(M) {
    const G = new THREE.Group(); G.add(mesh(corpoLathe(2.6, 0.18, 2.2, 0.25, 10), M.bomba)); G.add(mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.55, 10).rotateX(Math.PI / 2), M.bomba, 0, 0, 1.5));
    G.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), M.vetroScuro, 0, 0, 1.78)); pinne(G, M.bomba, 4, 0.1, 1.55, 0.16, 0.22, 0.1, 0.06); pinne(G, M.bomba, 4, 0.13, -0.85, 0.32, 0.5, 0.25, 0.3);
    G.add(mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.04, 12).rotateX(Math.PI / 2), M.giallo, 0, 0, 0.6)); return G;
  }
  function podAlq99(M) { // ALQ-99 con turbina ad aria dinamica in testa
    const G = new THREE.Group(); G.add(mesh(corpoLathe(4.6, 0.3, 2.2, 0.4, 14), M.pod)); G.add(mesh(new THREE.ConeGeometry(0.1, 0.25, 8).rotateX(Math.PI / 2), M.metallo, 0, 0, 2.42));
    const el = mesh(new THREE.BoxGeometry(0.85, 0.06, 0.02), M.metallo, 0, 0, 2.32); G.add(el); G.userData.elica = el;
    G.add(mesh(new THREE.BoxGeometry(0.08, 0.28, 2.6), M.pod, 0, -0.3, -0.2)); return G;
  }
  function serbatoio(L, r, M) { const G = new THREE.Group(); G.add(mesh(corpoLathe(L, r, 4.5, 0.55, 12), M.serb)); pinne(G, M.serb, 2, r * 0.6, -L / 2 + 0.7, r * 0.7, 0.5, 0.25, 0.25, Math.PI / 2 + 0.9); return G; }
  function pilone(L, h, mat) { // profilo laterale a trapezio
    const sh = new THREE.Shape([new THREE.Vector2(L / 2, h), new THREE.Vector2(-L / 2, h), new THREE.Vector2(-L / 2 + 0.3, 0), new THREE.Vector2(L / 2 - 0.5, 0)]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }); g.rotateY(-Math.PI / 2); g.translate(0.05, 0, 0); return mesh(g, mat);
  }
  function lama(h, l, mat) { // antenna a lama
    const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-l, 0), new THREE.Vector2(-l * 1.05, h), new THREE.Vector2(-l * 0.65, h)]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: false }); g.rotateY(-Math.PI / 2); g.translate(0.0125, 0, l / 2); return mesh(g, mat);
  }
  function luce(x, y, z, col, sc) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(sc || 0.5); s.position.set(x, y, z); return s; }
  function decal(tex, w, h, mat) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat || matDecal(tex)); m.renderOrder = 1; return m; }

  /* ---------- parametri per tipo ----------
     sezioni compatte [z, w, h, y, top, bot, sq, ch]; stazioni ali [x, zl, zt, t]; derive [h, zl, zt, t]
     armi: {NOME: [[x, z, hp (altezza pilone; -1 = binario d'estremità), yAttacco (omesso = sotto l'ala)]]}; serb: [[x, z, hp, L, r, yAtt]] */
  const S = a => a.map(([z, w, h, y, top, bot, sq, ch]) => ({ z, w, h, y: y || 0, top: top || 1, bot: bot || 1, sq: sq || 2, ch: ch || 0 }));
  const TIPI = {
    F15: { nome: "F-15E Strike Eagle", col: 0x5a646d, len: 19.4,
      fus: S([[9.72, 0.03, 0.03, -0.02], [9.4, 0.18, 0.17], [8.8, 0.34, 0.33], [8.0, 0.48, 0.47], [7.0, 0.62, 0.6], [6.0, 0.74, 0.68, 0, 1.12, 0.92], [5.0, 0.82, 0.75, 0, 1.22, 0.9], [4.0, 0.88, 0.78, 0, 1.25, 0.9], [3.0, 0.98, 0.8, 0, 1.15, 0.9, 2.3], [1.8, 1.15, 0.82, 0, 1.05, 0.9, 2.6], [0.4, 1.4, 0.82, 0, 1, 0.9, 2.9], [-1.5, 1.6, 0.8, 0, 1, 0.9, 3.1], [-3.5, 1.68, 0.76, 0, 1, 0.9, 3.2], [-5.5, 1.62, 0.7, 0, 1, 0.9, 3.2], [-7.4, 1.48, 0.62, 0, 1, 1, 3], [-8.6, 1.28, 0.58, 0, 1, 1, 2.8], [-9.0, 1.18, 0.56, 0, 1, 1, 2.6]]), radome: 7.0,
      cn: { zf: 6.4, zb: 0.6, w: 0.58, h: 0.76, y: 0.62, pk: 0.36, archi: [0.24, 0.6], posti: [4.6, 3.3] },
      prese: [{ x: 1.42, y: -0.02, z: 4.3, w: 0.5, h: 0.62, l: 8.2, sq: 5, kz: 0.45, xi: 1.22, yi: 0, wi: 0.4, hi: 0.55, dop: true, rampa: true, split: "lat" }],
      lofts: [{ sez: S([[2.3, 0.05, 0.05, -0.3], [1.5, 0.3, 0.42, -0.3, 1, 1, 2.6], [-2.0, 0.36, 0.5, -0.3, 1, 1, 2.8], [-4.2, 0.26, 0.36, -0.25], [-4.9, 0.05, 0.05, -0.2]]).map(s => Object.assign(s, { x: 1.78 })), dop: true }], // CFT
      ala: { st: [[1.3, 0.3, -5.5, 0.05], [3.8, -2.2, -6.0, 0.04], [6.52, -4.9, -6.4, 0.035]], diedro: -1, y: 0.38, le: 0.1, mob: [{ i0: 0, i1: 1, cf: 0.24, tipo: "flap" }, { i0: 1, i1: 2, cf: 0.28, tipo: "alettone" }] },
      stab: { st: [[1.5, -6.7, -9.1, 0.04], [4.3, -8.5, -9.6, 0.03]], y: 0.05, piv: -7.6 },
      derive: [-1, 1].map(s => ({ x: 1.45 * s, y: 0.5, cant: 2, st: [[0, -5.6, -9.3, 0.045], [1.6, -6.9, -9.4, 0.04], [3.1, -8.1, -9.45, 0.035]], mob: [{ i0: 0, i1: 1, cf: 0.3, tipo: "timone" }] })),
      ugelli: [[-0.62, 0, -9.0, 0.56], [0.62, 0, -9.0, 0.56]],
      armi: { AMRAAM: [[-1.95, -1.8, 0.04, -0.85], [1.95, -1.8, 0.04, -0.85], [-1.95, 0.9, 0.04, -0.85], [1.95, 0.9, 0.04, -0.85]], GBU48: [[-3.6, -2.8, 0.3], [3.6, -2.8, 0.3], [-1.3, -3.6, 0.15, -0.95], [1.3, -3.6, 0.15, -0.95]], AIM9: [[-3.95, -2.4, 0.42], [3.95, -2.4, 0.42]] },
      serb: [[0, -1.0, 0.25, 7.0, 0.42, -0.88]],
      ext: { recept: 0.0, sondaPitot: [[0.55, 7.6], [-0.55, 7.6]], lame: [[-2.5, 1], [1.0, -1], [-6, 1]], ins: -5.0, form: [5.2, -6.5] } },
    F16: { nome: "F-16C Fighting Falcon", col: 0x6c7682, len: 15.0,
      fus: S([[7.05, 0.03, 0.03, 0.05], [6.7, 0.18, 0.18, 0.05], [6.1, 0.34, 0.34, 0.04], [5.3, 0.47, 0.46, 0.03], [4.5, 0.56, 0.55, 0, 1.05], [3.6, 0.62, 0.6, 0, 1.15], [2.6, 0.68, 0.62, 0, 1.2, 1.15], [1.6, 0.78, 0.65, 0, 1.15, 1.1], [0.6, 0.92, 0.68, 0, 1.08, 1.05, 2.3], [-0.6, 1.0, 0.7, 0, 1, 1, 2.5], [-2.0, 0.98, 0.72, 0, 1, 1, 2.4], [-3.4, 0.9, 0.72, 0.03, 1, 1, 2.2], [-4.8, 0.8, 0.68, 0.05], [-6.0, 0.66, 0.6, 0.05], [-6.8, 0.56, 0.54, 0.05], [-7.1, 0.52, 0.5, 0.05]]), radome: 5.4,
      cn: { zf: 5.0, zb: 0.4, w: 0.5, h: 0.72, y: 0.48, pk: 0.42, archi: [0.83], posti: [3.1] },
      prese: [{ x: 0, y: -0.85, z: 3.0, w: 0.6, h: 0.4, l: 4.6, sq: 2.6, kz: -0.35, xi: 0, yi: -0.45, wi: 0.5, hi: 0.36, cono: true }],
      lerx: { st: [[0.55, 3.2, -1.5, 0.025], [1.45, -0.55, -1.4, 0.025]], y: -0.05 },
      ala: { st: [[0.9, -0.2, -5.2, 0.04], [3.2, -2.13, -4.7, 0.04], [4.72, -3.4, -4.4, 0.035]], diedro: 0, y: -0.05, le: 0.15, mob: [{ i0: 0, i1: 1, cf: 0.22, tipo: "alettone" }] },
      stab: { st: [[0.6, -4.7, -6.6, 0.04], [2.75, -6.2, -7.0, 0.03]], y: -0.05, diedro: -10, piv: -5.6 },
      derive: [{ x: 0, y: 0.6, st: [[0, -3.0, -6.4, 0.05], [1.4, -4.6, -6.6, 0.045], [2.6, -5.7, -6.8, 0.04]], mob: [{ i0: 0, i1: 1, cf: 0.3, tipo: "timone" }] }, { x: 0, y: 0.62, st: [[0, -1.2, -3.2, 0.08], [0.32, -2.9, -3.2, 0.1]] },
        { x: -0.55, y: -0.55, cant: 15, giu: true, st: [[0, -3.3, -4.3, 0.05], [0.55, -3.9, -4.4, 0.05]] }, { x: 0.55, y: -0.55, cant: 15, giu: true, st: [[0, -3.3, -4.3, 0.05], [0.55, -3.9, -4.4, 0.05]] }],
      ugelli: [[0, 0.05, -7.0, 0.52]],
      armi: { AIM9: [[-4.72, -3.9, -1], [4.72, -3.9, -1]], AMRAAM: [[-3.75, -3.4, 0.25], [3.75, -3.4, 0.25]], GBU48: [[-2.65, -2.8, 0.35], [2.65, -2.8, 0.35]] },
      serb: [[-1.7, -2.0, 0.4, 4.6, 0.37], [1.7, -2.0, 0.4, 4.6, 0.37]],
      ext: { pitot: [7.05, 0.7], recept: -0.3, lame: [[0.2, 1], [1.0, -1], [-4.0, -1]], ins: -2.6, form: [4.2, -4.6] } },
    F2000: { nome: "Eurofighter Typhoon", col: 0x7a858f, len: 15.96,
      fus: S([[7.98, 0.03, 0.03], [7.6, 0.2, 0.2], [6.9, 0.38, 0.38], [6.0, 0.52, 0.52], [5.0, 0.6, 0.62, 0, 1.08], [4.0, 0.64, 0.66, 0, 1.18], [3.0, 0.68, 0.68, 0, 1.2, 1.1], [2.0, 0.72, 0.7, 0, 1.12, 1.2], [1.0, 0.78, 0.72, 0, 1.05, 1.25, 2.3], [-0.5, 0.95, 0.72, 0, 1, 1.2, 2.6], [-2.0, 1.05, 0.7, 0, 1, 1.05, 2.8], [-3.5, 1.05, 0.68, 0, 1, 1, 2.8], [-5.0, 1.0, 0.62, 0, 1, 1, 2.6], [-6.5, 0.95, 0.55, 0, 1, 1, 2.4], [-7.5, 0.92, 0.5], [-7.95, 0.9, 0.48]]), radome: 5.6,
      cn: { zf: 5.2, zb: 0.9, w: 0.5, h: 0.68, y: 0.55, pk: 0.4, archi: [0.22], posti: [3.5] },
      prese: [{ x: 0, y: -0.95, z: 2.4, w: 0.62, h: 0.38, l: 4.5, sq: 3.2, kz: -0.2, xi: 0, yi: -0.6, wi: 0.6, hi: 0.4, split: "h", vmid: true, cono: true }],
      canard: { st: [[0.62, 4.3, 3.0, 0.04], [2.25, 3.15, 2.75, 0.035]], y: 0.15, piv: 3.6 },
      ala: { st: [[0.95, -0.3, -6.9, 0.045], [3.0, -3.0, -7.05, 0.04], [5.3, -6.05, -7.25, 0.035]], diedro: -2, y: -0.25, le: 0.12, mob: [{ i0: 0, i1: 1, cf: 0.2, tipo: "elevone" }, { i0: 1, i1: 2, cf: 0.25, tipo: "elevone" }] },
      derive: [{ x: 0, y: 0.55, st: [[0, -3.4, -7.4, 0.05], [1.8, -5.2, -7.5, 0.045], [3.3, -6.6, -7.6, 0.04]], mob: [{ i0: 0, i1: 1, cf: 0.25, tipo: "timone" }] }],
      ugelli: [[-0.48, -0.05, -7.75, 0.48], [0.48, -0.05, -7.75, 0.48]],
      armi: { AMRAAM: [[-0.78, -1.2, 0.02, -0.72], [0.78, -1.2, 0.02, -0.72], [-0.78, -4.0, 0.02, -0.68], [0.78, -4.0, 0.02, -0.68]], GBU48: [[-2.4, -3.6, 0.35], [2.4, -3.6, 0.35], [-3.4, -4.4, 0.3], [3.4, -4.4, 0.3]], AIM9: [[-4.4, -5.4, 0.2], [4.4, -5.4, 0.2]] },
      serb: [[0, -2.6, 0.15, 4.0, 0.4, -0.72]],
      ext: { sonda: [0.55, 0.38, 4.6, 1.2], irst: [-0.36, 5.7, 0.12], podPunta: [1.9, 0.12, -6.4], lame: [[-1.5, 1], [0.5, -1]], ins: -4.2, form: [3.6, -5.2] } },
    F22: { nome: "F-22A Raptor", col: 0x6a7480, len: 18.9, stealth: true,
      fus: S([[9.46, 0.03, 0.02, -0.05], [9.0, 0.22, 0.12, -0.05, 1, 1, 2, 0.5], [8.2, 0.45, 0.28, -0.03, 1, 1, 2, 0.6], [7.2, 0.65, 0.42, 0, 1.1, 0.9, 2, 0.6], [6.2, 0.8, 0.52, 0, 1.2, 0.85, 2, 0.55], [5.2, 0.92, 0.58, 0, 1.28, 0.85, 2, 0.5], [4.2, 1.1, 0.62, 0, 1.25, 0.85, 2.2, 0.45], [3.0, 1.45, 0.64, 0, 1.12, 0.85, 2.6, 0.4], [1.6, 1.85, 0.66, 0, 1, 0.85, 3, 0.3], [0, 2.15, 0.66, 0, 1, 0.85, 3.2, 0.25], [-2.0, 2.3, 0.64, 0, 1, 0.85, 3.4, 0.2], [-4.0, 2.25, 0.6, 0, 1, 0.85, 3.4, 0.2], [-6.0, 2.0, 0.55, 0, 1, 0.85, 3.2, 0.15], [-7.6, 1.75, 0.5, 0, 1, 0.9, 3], [-8.6, 1.6, 0.44, 0, 1, 1, 3], [-9.1, 1.5, 0.4, 0, 1, 1, 3]]), radome: 7.6,
      cn: { zf: 7.0, zb: 1.6, w: 0.56, h: 0.78, y: 0.68, pk: 0.45, archi: [], posti: [4.6], oro: true },
      prese: [{ x: 1.62, y: -0.15, z: 3.6, w: 0.5, h: 0.55, l: 6.0, sq: 3, kz: 0.3, kx: -0.45, xi: 1.3, yi: 0, wi: 0.45, hi: 0.45, dop: true, split: "lat" }],
      ala: { st: [[1.6, 1.2, -6.6, 0.045], [4.0, -0.96, -5.86, 0.038], [6.78, -3.46, -5.0, 0.03]], diedro: -3.25, y: 0, le: 0.12, mob: [{ i0: 0, i1: 1, cf: 0.22, tipo: "flap" }, { i0: 1, i1: 2, cf: 0.25, tipo: "alettone" }] },
      stab: { st: [[1.5, -6.0, -9.6, 0.04], [4.45, -8.6, -9.3, 0.03]], y: 0, piv: -7.4 },
      derive: [-1, 1].map(s => ({ x: 1.65 * s, y: 0.45, cant: 28, st: [[0, -4.6, -7.9, 0.045], [1.5, -5.9, -8.3, 0.04], [2.75, -7.0, -8.4, 0.035]], mob: [{ i0: 0, i1: 1, cf: 0.3, tipo: "timone" }] })),
      ugelli: [[-0.72, 0, -9.0, 0.55, "2d"], [0.72, 0, -9.0, 0.55, "2d"]],
      armi: {}, serb: [],
      ext: { recept: 1.0, lame: [[-1.0, -1]], ins: -5.5, form: [6.0, -6.0] } },
    EA18: { nome: "EA-18G Growler", col: 0x5d6873, len: 18.3,
      fus: S([[9.15, 0.03, 0.03], [8.8, 0.2, 0.2], [8.1, 0.38, 0.38], [7.2, 0.53, 0.53], [6.2, 0.64, 0.64, 0, 1.08], [5.2, 0.72, 0.7, 0, 1.2], [4.2, 0.78, 0.74, 0, 1.25], [3.2, 0.85, 0.76, 0, 1.25], [2.2, 0.98, 0.78, 0, 1.15, 1, 2.3], [1.0, 1.2, 0.8, 0, 1, 1, 2.6], [-0.6, 1.35, 0.8, 0, 1, 1, 2.8], [-2.4, 1.4, 0.76, 0, 1, 1, 2.9], [-4.4, 1.35, 0.7, 0, 1, 1, 2.8], [-6.4, 1.25, 0.62, 0, 1, 1, 2.6], [-8.0, 1.12, 0.55, 0, 1, 1, 2.4], [-8.6, 1.08, 0.52]]), radome: 7.0,
      cn: { zf: 6.6, zb: 1.4, w: 0.55, h: 0.72, y: 0.72, pk: 0.35, archi: [0.2, 0.55], posti: [5.0, 3.6] },
      prese: [{ x: 1.42, y: -0.35, z: 2.2, w: 0.42, h: 0.5, l: 4.5, sq: 3.5, kz: 0.3, kx: -0.3, xi: 1.15, yi: -0.2, wi: 0.38, hi: 0.45, dop: true, split: "lat" }],
      lerx: { st: [[0.75, 5.2, -0.5, 0.03], [2.05, 0.2, -0.8, 0.03]], y: 0.08 },
      ala: { st: [[1.35, -0.6, -4.9, 0.05], [4.2, -2.38, -4.95, 0.04], [6.7, -3.95, -5.25, 0.035]], diedro: 0, y: 0.05, le: 0.15, mob: [{ i0: 0, i1: 1, cf: 0.26, tipo: "flap" }, { i0: 1, i1: 2, cf: 0.28, tipo: "alettone" }] },
      stab: { st: [[1.1, -6.0, -8.6, 0.04], [3.4, -7.7, -8.9, 0.03]], y: 0.1, diedro: 2, piv: -7.0 },
      derive: [-1, 1].map(s => ({ x: 1.2 * s, y: 0.55, cant: 20, punta: true, st: [[0, -4.4, -7.4, 0.045], [1.5, -5.6, -7.6, 0.04], [3.0, -6.6, -7.8, 0.035]], mob: [{ i0: 0, i1: 1, cf: 0.3, tipo: "timone" }] })),
      ugelli: [[-0.56, -0.05, -8.4, 0.5], [0.56, -0.05, -8.4, 0.5]],
      armi: { POD: [[-4.3, -3.3, 0.35], [4.3, -3.3, 0.35], [-2.6, -2.6, 0.35], [2.6, -2.6, 0.35]], AMRAAM: [[-1.15, -3.0, 0.03, -0.8], [1.15, -3.0, 0.03, -0.8]] },
      serb: [[0, -1.8, 0.2, 4.5, 0.4, -0.82]],
      ext: { sonda: [0.45, 0.62, 6.0, 1.0], podPunta: [2.4, 0.16, -4.3], lame: [[-1.0, 1], [0.0, -1], [-5.0, 1]], ins: -4.6, form: [4.8, -6.0] } },
    SU35: { nome: "Su-35S Flanker-E", col: 0x7d8691, len: 21.9,
      fus: S([[10.95, 0.03, 0.03, -0.1], [10.5, 0.22, 0.22, -0.1], [9.7, 0.42, 0.42, -0.08], [8.7, 0.6, 0.6, -0.05], [7.6, 0.72, 0.72, 0, 1.05], [6.5, 0.8, 0.78, 0, 1.2], [5.4, 0.86, 0.82, 0, 1.28], [4.2, 0.92, 0.84, 0, 1.25], [3.0, 1.1, 0.84, 0, 1.12, 1, 2.3], [1.5, 1.6, 0.8, 0, 1, 0.9, 2.8], [0, 2.1, 0.72, 0, 1, 0.7, 3.2], [-2.0, 2.3, 0.66, 0, 1, 0.6, 3.4], [-4.0, 2.2, 0.62, 0, 1, 0.55, 3.4], [-6.0, 1.9, 0.55, 0, 1, 0.5, 3.2], [-7.8, 1.4, 0.48, 0, 1, 0.6, 2.8], [-9.0, 1.0, 0.42], [-9.6, 0.7, 0.35]]), radome: 8.0,
      cn: { zf: 7.6, zb: 2.6, w: 0.6, h: 0.82, y: 0.8, pk: 0.38, archi: [0.22], posti: [5.4] },
      prese: [{ x: 1.15, y: -0.85, z: 3.6, w: 0.55, h: 0.6, l: 5.6, sq: 6, kz: 0.5, xi: 1.1, yi: -0.7, wi: 0.6, hi: 0.62, dop: true, rampa: true, split: "h" }],
      lofts: [{ sez: S([[-2.0, 0.6, 0.62, -0.7, 1, 1, 4], [-5.0, 0.62, 0.62, -0.62, 1, 1, 3], [-8.0, 0.62, 0.6, -0.52, 1, 1, 2.4], [-9.4, 0.6, 0.6, -0.5], [-9.75, 0.58, 0.58, -0.5]]).map(s => Object.assign(s, { x: 1.1 })), dop: true }, // gondole motori
        { sez: S([[-4.6, 0.05, 0.05, -0.15], [-5.6, 0.26, 0.22, -0.15, 1, 1, 2.6], [-9.8, 0.24, 0.2, -0.15, 1, 1, 2.6], [-10.7, 0.12, 0.1, -0.15]]).map(s => Object.assign(s, { x: 2.15 })), dop: true }], // travi di coda
      sting: { z0: -7.5, z1: -11.6, r: 0.45, y: -0.15 },
      lerx: { st: [[0.9, 6.0, 0.2, 0.025], [2.6, 0.5, -0.3, 0.025]], y: -0.05 },
      ala: { st: [[2.0, 0.5, -5.6, 0.045], [4.8, -2.0, -5.9, 0.04], [7.65, -4.6, -6.3, 0.035]], diedro: -2, y: -0.05, le: 0.14, mob: [{ i0: 0, i1: 1, cf: 0.25, tipo: "flap" }, { i0: 1, i1: 2, cf: 0.28, tipo: "alettone" }] },
      stab: { st: [[1.8, -7.1, -9.9, 0.04], [4.95, -9.4, -10.4, 0.03]], y: -0.18, piv: -8.3 },
      derive: [-1, 1].map(s => ({ x: 2.15 * s, y: 0.05, cant: 0, st: [[0, -5.8, -9.0, 0.045], [1.8, -6.9, -9.2, 0.04], [3.4, -7.9, -9.4, 0.035]], mob: [{ i0: 0, i1: 2, cf: 0.28, tipo: "timone" }] })).concat(
        [-1, 1].map(s => ({ x: 2.05 * s, y: -0.3, cant: 10, giu: true, st: [[0, -6.6, -8.4, 0.05], [0.9, -7.6, -8.6, 0.05]] }))),
      ugelli: [[-1.1, -0.5, -9.7, 0.6], [1.1, -0.5, -9.7, 0.6]],
      armi: { ADDER: [[-3.4, -3.0, 0.35], [3.4, -3.0, 0.35], [-5.0, -4.0, 0.3], [5.0, -4.0, 0.3], [-6.3, -4.9, 0.25], [6.3, -4.9, 0.25]] }, serb: [],
      ext: { pitot: [10.95, 0.9], irst: [0.24, 7.9, 0.17], sonda: [-0.6, 0.42, 7.0, 1.1], podPunta: [2.2, 0.17, -4.6], lame: [[-1.5, 1], [2.0, -1]], ins: -5.5, form: [6.0, -7.0] } },
    SU57: { nome: "Su-57 Felon", col: 0x6f7984, len: 20.1, stealth: true,
      fus: S([[10.05, 0.03, 0.02, -0.1], [9.6, 0.24, 0.13, -0.1, 1, 1, 2, 0.6], [8.8, 0.45, 0.27, -0.08, 1, 1, 2, 0.65], [7.8, 0.64, 0.4, 0, 1.1, 0.9, 2, 0.6], [6.8, 0.78, 0.5, 0, 1.2, 0.85, 2, 0.55], [5.8, 0.9, 0.56, 0, 1.3, 0.8, 2, 0.5], [4.6, 1.05, 0.6, 0, 1.28, 0.8, 2.2, 0.45], [3.2, 1.5, 0.6, 0, 1.15, 0.75, 2.8, 0.4], [1.6, 2.1, 0.56, 0, 1, 0.7, 3.4, 0.35], [0, 2.5, 0.5, 0, 1, 0.6, 3.8, 0.3], [-2.0, 2.55, 0.46, 0, 1, 0.55, 4, 0.25], [-4.0, 2.4, 0.44, 0, 1, 0.5, 4, 0.2], [-6.0, 2.1, 0.4, 0, 1, 0.5, 3.8], [-7.8, 1.6, 0.36, 0, 1, 0.6, 3.4], [-9.0, 1.0, 0.32], [-9.6, 0.6, 0.28]]), radome: 8.0,
      cn: { zf: 7.4, zb: 2.4, w: 0.6, h: 0.75, y: 0.66, pk: 0.42, archi: [0.24], posti: [5.2], oro: true },
      prese: [{ x: 1.5, y: -0.72, z: 3.2, w: 0.55, h: 0.5, l: 5.5, sq: 4, kz: 0.35, kx: -0.4, xi: 1.5, yi: -0.6, wi: 0.6, hi: 0.55, dop: true, rampa: true, split: "h" }],
      lofts: [{ sez: S([[-2.3, 0.6, 0.55, -0.6, 1, 1, 4], [-6.0, 0.62, 0.58, -0.5, 1, 1, 3], [-9.4, 0.62, 0.6, -0.4, 1, 1, 2.2], [-9.85, 0.6, 0.58, -0.4]]).map(s => Object.assign(s, { x: 1.5 })), dop: true },
        { sez: S([[-4.8, 0.05, 0.05, -0.1], [-5.8, 0.28, 0.2, -0.1, 1, 1, 3], [-9.6, 0.26, 0.18, -0.1, 1, 1, 3], [-10.3, 0.1, 0.08, -0.1]]).map(s => Object.assign(s, { x: 2.15 })), dop: true }],
      sting: { z0: -8.0, z1: -11.2, r: 0.36, y: -0.05 },
      levcon: { st: [[1.05, 6.4, 3.3, 0.03], [2.35, 3.6, 3.1, 0.03]], y: 0.02, piv: 3.3 },
      ala: { st: [[2.0, 1.6, -6.0, 0.04], [4.6, -1.3, -5.65, 0.035], [7.05, -4.0, -5.3, 0.03]], diedro: -2, y: 0, le: 0.14, mob: [{ i0: 0, i1: 1, cf: 0.22, tipo: "flap" }, { i0: 1, i1: 2, cf: 0.26, tipo: "alettone" }] },
      stab: { st: [[1.9, -6.3, -9.4, 0.04], [4.45, -8.6, -9.6, 0.03]], y: -0.1, piv: -7.8 },
      derive: [-1, 1].map(s => ({ x: 1.95 * s, y: 0.22, cant: 26, tutta: true, st: [[0, -5.0, -7.6, 0.04], [1.3, -6.2, -7.9, 0.035], [2.3, -7.1, -8.0, 0.03]] })),
      ugelli: [[-1.5, -0.4, -9.85, 0.58], [1.5, -0.4, -9.85, 0.58]],
      armi: {}, serb: [],
      ext: { irst: [0.2, 7.9, 0.15], sonda: [-0.62, 0.3, 6.8, 1.0], lame: [[-2.0, -1]], ins: -6.0, form: [6.4, -7.2] } },
    /* --- supporto: struttura "liner" --- */
    KC30: { nome: "A330 MRTT", cat: "liner", col: 0x9aa3ab, len: 58.8,
      fus: S([[29.4, 0.05, 0.05, -0.3], [29.0, 0.9, 0.85, -0.4], [28.2, 1.65, 1.6, -0.3], [27.0, 2.25, 2.25, -0.15], [25.5, 2.65, 2.7, -0.05], [23.5, 2.82, 2.82], [10, 2.82, 2.82], [-10, 2.82, 2.82], [-15, 2.6, 2.6, 0.35], [-19, 2.15, 2.05, 0.8], [-23, 1.55, 1.4, 1.25], [-26.5, 0.95, 0.8, 1.6], [-28.8, 0.45, 0.38, 1.85], [-29.4, 0.18, 0.15, 1.9]]), radome: 27.6,
      ala: { st: [[2.6, 6.0, -5.0, 0.14], [11.5, 0.86, -4.7, 0.12], [22, -5.2, -8.84, 0.105], [30.0, -9.8, -12.0, 0.1]], diedro: 5, y: -1.7, le: 0.1, mob: [{ i0: 0, i1: 1, cf: 0.22, tipo: "flap" }, { i0: 1, i1: 2, cf: 0.22, tipo: "flap" }, { i0: 2, i1: 3, cf: 0.24, tipo: "alettone" }] },
      winglet: { st: [[0, -9.9, -12.0, 0.08], [2.7, -11.7, -12.6, 0.08]], cant: 25 },
      stab: { st: [[1.0, -21.5, -26.5, 0.1], [9.6, -26.8, -28.6, 0.09]], y: 1.3, diedro: 6, mob: [{ i0: 0, i1: 1, cf: 0.3, tipo: "elevatore" }] },
      derive: [{ x: 0, y: 2.3, st: [[0, -18.5, -27.8, 0.11], [4.5, -22.0, -28.6, 0.1], [9.4, -25.8, -29.4, 0.09]], mob: [{ i0: 0, i1: 2, cf: 0.3, tipo: "timone" }] }],
      motori: [{ x: 9.6, y: -3.6, z: 5.6, r: 1.45, l: 6.4 }], ventre: { z0: 7.5, z1: -9.5, w: 2.9, h: 1.0, y: -2.1 },
      boom: { z: -21.5, y: -0.9 }, podAla: [21.5, -5.6], finestre: [22.5, -15.5], cockpit: 26.2, ins: -14, numero: "14-01" },
    E7: { nome: "E-7A Wedgetail", cat: "liner", col: 0x7c858d, len: 33.6,
      fus: S([[16.8, 0.05, 0.05, -0.25], [16.4, 0.65, 0.6, -0.3], [15.6, 1.15, 1.1, -0.2], [14.6, 1.55, 1.55, -0.1], [13.4, 1.8, 1.82], [11.8, 1.88, 1.9], [0, 1.88, 1.9], [-6.5, 1.88, 1.9], [-9.5, 1.7, 1.7, 0.3], [-12.5, 1.3, 1.2, 0.75], [-15.0, 0.8, 0.7, 1.1], [-16.4, 0.35, 0.3, 1.3], [-16.8, 0.15, 0.12, 1.35]]), radome: 15.8,
      ala: { st: [[1.7, 4.6, -3.0, 0.14], [6.0, 2.6, -2.9, 0.12], [13.0, -0.66, -3.85, 0.11], [17.15, -2.6, -4.2, 0.1]], diedro: 6, y: -1.2, le: 0.1, mob: [{ i0: 0, i1: 1, cf: 0.22, tipo: "flap" }, { i0: 1, i1: 2, cf: 0.22, tipo: "flap" }, { i0: 2, i1: 3, cf: 0.25, tipo: "alettone" }] },
      stab: { st: [[0.8, -11.8, -15.4, 0.1], [6.6, -14.8, -16.2, 0.09]], y: 0.95, diedro: 7, mob: [{ i0: 0, i1: 1, cf: 0.3, tipo: "elevatore" }] },
      derive: [{ x: 0, y: 1.5, st: [[0, -9.0, -15.6, 0.11], [3.0, -11.5, -16.0, 0.1], [6.6, -14.4, -16.6, 0.09]], mob: [{ i0: 0, i1: 2, cf: 0.3, tipo: "timone" }] }, { x: 0, y: 1.7, st: [[0, -5.5, -9.8, 0.12], [0.9, -9.4, -9.8, 0.14]] },
        { x: -0.7, y: -0.2, cant: 35, giu: true, st: [[0, -10.8, -13.4, 0.06], [0.8, -12.2, -13.5, 0.06]] }, { x: 0.7, y: -0.2, cant: 35, giu: true, st: [[0, -10.8, -13.4, 0.06], [0.8, -12.2, -13.5, 0.06]] }],
      motori: [{ x: 4.95, y: -1.95, z: 6.0, r: 0.92, l: 4.4, piatto: true }], ventre: { z0: 4.5, z1: -4.0, w: 1.9, h: 0.7, y: -1.45 },
      mesa: true, finestre: null, cockpit: 15.0, ins: -8.5, numero: "A30-001" }
  };
  TIPI.F16b = TIPI.F16; TIPI.TYPHOON = TIPI.F2000;

  /* ---------- materiali condivisi per modello ---------- */
  function materiali(col, st, oro) {
    const c = new THREE.Color(col), M = { skin: matSkin(col, st) };
    M.skinDS = M.skin.clone(); M.skinDS.side = THREE.DoubleSide;
    M.radome = matTinta(c.clone().lerp(new THREE.Color(0x40464c), 0.55), 0.6, 0.1); M.bordo = matTinta(c.clone().multiplyScalar(0.78), 0.45, 0.45);
    M.metallo = matTinta(0x3b3732, 0.38, 0.85); M.metalloDS = M.metallo.clone(); M.metalloDS.side = THREE.DoubleSide; M.petalo = matTinta(0x5a544c, 0.45, 0.8);
    M.buio = new THREE.MeshBasicMaterial({ color: 0x05070a }); M.condotto = matTinta(0xb5b9bd, 0.6, 0.2); M.vetro = matGlass(oro); M.telaio = matTinta(0x2a2e33, 0.6, 0.3);
    M.sedile = matTinta(0x2b2f2a, 0.8, 0.1); M.giallo = matTinta(0xd8b020, 0.5, 0.1); M.tuta = matTinta(0x4b5a3a, 0.9, 0); M.casco = matTinta(0xd9dcd5, 0.35, 0.1);
    M.visiera = new THREE.MeshStandardMaterial({ color: 0x5a3c10, roughness: 0.12, metalness: 0.95 }); M.hud = matAdd(0x44ff88, 0.25);
    M.missile = matTinta(0xe2e4e6, 0.4, 0.3); M.missileR = matTinta(0xbfc4bb, 0.5, 0.3); M.bomba = matTinta(0x4a5440, 0.6, 0.3); M.vetroScuro = matTinta(0x10161c, 0.1, 0.9);
    M.pod = matTinta(0xc9cdd1, 0.5, 0.25); M.serb = M.skin; M.formaz = new THREE.MeshBasicMaterial({ color: 0xc9ff7a, transparent: true, opacity: 0.8 });
    M.irst = new THREE.MeshPhysicalMaterial({ color: 0x9a7a30, roughness: 0.05, metalness: 0.9, clearcoat: 1 }); return M;
  }
  /* ---------- montaggio ---------- */
  function infoAla(a, xa) { // quota, corda e spessore dell'ala alla semi-apertura |x|
    const st = staz(a.st, a.diedro, a.y), x = Math.abs(xa); let i = 0; while (i < st.length - 2 && st[i + 1].x < x) i++;
    const A = st[i], B = st[i + 1], t = Math.max(0, Math.min(1, (x - A.x) / (B.x - A.x))), L = (k) => A[k] + (B[k] - A[k]) * t, c = L("zl") - L("zt"), y = L("y"), h = 0.5 * L("t") * c * 0.95;
    return { zl: L("zl"), zt: L("zt"), c, y, yb: y - h, yt: y + h, xt: st[st.length - 1].x, yTip: st[st.length - 1].y };
  }
  function coppia(def, M) { // superficie destra + sinistra
    const st = staz(def.st, def.diedro, def.y), G = new THREE.Group(), mob = [];
    [1, -1].forEach(s => { const sf = superficie(st, { mat: M.skin, s, mob: def.mob, le: def.le ? { cf: def.le, mat: M.bordo } : null }); G.add(sf); sf.userData.mob.forEach(m => mob.push(m)); });
    return { G, mob };
  }
  function coppiaMobile(def, M) { // stabilizzatori/canard/levcon interamente mobili (perno trasversale)
    const st = staz(def.st, def.diedro, def.y), G = new THREE.Group(), piv = [];
    [1, -1].forEach(s => { const pv = new THREE.Group(); pv.position.set(0, def.y || 0, def.piv); pv.userData.mob = true; const sf = superficie(st, { mat: M.skin, s }); sf.position.set(0, -(def.y || 0), -def.piv); pv.add(sf); G.add(pv); piv.push({ piv: pv, s }); });
    return { G, piv };
  }
  function deriva(dv, M, matFin) {
    const st = dv.st.map(([h, zl, zt, t]) => ({ x: h, zl, zt, t, y: 0 })), sf = superficie(st, { mat: matFin || M.skin, s: 1, mob: dv.mob, uvBox: !!matFin });
    sf.rotation.z = Math.PI / 2; const sx = Math.sign(dv.x) || 1, O = new THREE.Group(), c = d2r(dv.cant || 0), top = st[st.length - 1], zp = (st[0].zl + st[0].zt) / 2;
    O.rotation.z = dv.giu ? Math.PI + sx * c : -sx * c; O.position.set(dv.x, dv.y, dv.tutta ? zp : 0); let I = null;
    if (dv.tutta) { I = new THREE.Group(); I.userData.mob = true; sf.position.z = -zp; I.add(sf); O.add(I); } else O.add(sf);
    if (dv.punta) sf.add(mesh(corpoLathe((top.zl - top.zt) * 1.05, 0.1, 2, 0.3, 10), M.pod, top.x + 0.02, 0, (top.zl + top.zt) / 2)); // carenatura antenne in cima
    if (matFin) sf.add(mesh(new THREE.BoxGeometry(top.x * 0.4, 0.05, 0.07), M.formaz, top.x * 0.45, 0, (st[0].zl + st[0].zt) / 2 - top.x * 0.3)); // luce di formazione
    return { O, mob: sf.userData.mob, tutta: I, top: V3(dv.x + Math.sin(-O.rotation.z) * top.x, dv.y + Math.cos(O.rotation.z) * top.x, top.zt) };
  }
  function lathe(prof, mat, seg) { const g = new THREE.LatheGeometry(prof.map(q => new THREE.Vector2(q[0], q[1])), seg || 16); g.rotateX(Math.PI / 2); return mesh(g, mat); }
  /* unisce le mesh statiche con lo stesso materiale (meno draw call con 40 velivoli in scena) */
  function unisci(g) {
    g.updateMatrixWorld(true); const inv = g.matrixWorld.clone().invert(), gruppi = new Map(), via = [];
    g.traverse(o => { if (!o.isMesh || o.renderOrder) return; let q = o; while (q && q !== g) { if (q.userData.mob) return; q = q.parent; }
      const pos = o.geometry.attributes; if (!pos.position || !pos.normal || !pos.uv) return; if (!gruppi.has(o.material)) gruppi.set(o.material, []); gruppi.get(o.material).push(o); });
    gruppi.forEach((lista, mat) => { if (lista.length < 2) return; const P = [], N = [], U = [], I = []; let off = 0;
      lista.forEach(o => { const geo = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)), a = geo.attributes, n = a.position.count;
        for (let i = 0; i < n; i++) { P.push(a.position.getX(i), a.position.getY(i), a.position.getZ(i)); N.push(a.normal.getX(i), a.normal.getY(i), a.normal.getZ(i)); U.push(a.uv.getX(i), a.uv.getY(i)); }
        if (geo.index) { const ix = geo.index; for (let i = 0; i < ix.count; i++) I.push(ix.getX(i) + off); } else for (let i = 0; i < n; i++) I.push(i + off);
        off += n; via.push(o); });
      const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); gg.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3)); gg.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); gg.setIndex(I);
      g.add(mesh(gg, mat)); });
    via.forEach(o => o.parent.remove(o));
  }
  function decalAla(g, a, frac, tex, w, mat) { // insegna piatta sul dorso dell'ala
    [1, -1].forEach(s => { const inf = infoAla(a, inf0(a) * frac), x = s * inf0(a) * frac, d = decal(tex, w, w, mat); d.rotation.order = "ZYX"; d.rotation.set(-Math.PI / 2, 0, s * d2r(a.diedro || 0)); d.position.set(x, inf.yt + 0.02, inf.zl - inf.c * 0.42); g.add(d); });
  }
  const inf0 = a => a.st[a.st.length - 1][0];
  function decalFus(g, sez, z, tex, w, dy, mat) { const s = sezA(sez, z), xs = s.w * (1 + s.ch) + 0.015; [1, -1].forEach(k => { const d = decal(tex, w, w * (tex.image.height / tex.image.width), mat); d.rotation.y = k * Math.PI / 2; d.position.set(k * (s.x + xs), s.y + (dy || 0), z); g.add(d); }); }
  function supTop(sez, z, x) { const s = sezA(sez, z), k = Math.min(0.98, Math.abs(x || 0) / (s.w || 1)); return s.y + s.h * s.top * Math.sqrt(1 - k * k); }
  function luciNav(g, xt, y, z) { g.add(luce(-xt, y, z, 0xff2a2a)); g.add(luce(xt, y, z, 0x2aff5a)); }

  /* ---------- costruzione caccia ---------- */
  function costruisci(tipoId, opt) {
    opt = opt || {}; const p = TIPI[tipoId] || TIPI.F16, col = opt.colore != null ? opt.colore : p.col, rosso = rossastro(col);
    const numero = opt.numero != null ? String(opt.numero) : (p.numero || "01"), M = materiali(col, p.stealth, p.cn && p.cn.oro);
    const matFin = new THREE.MeshStandardMaterial({ map: texDeriva(col, numero, rosso, p.stealth), roughness: 0.55, metalness: 0.3 }), matIns = matDecal(texInsegna(rosso));
    const g = new THREE.Group(); g.name = "velivolo_" + tipoId;
    if (p.cat === "liner") return liner(p, g, M, matFin, matIns, rosso, opt);
    const ext = p.ext || {};
    g.add(loft(p.fus, M.skin, { n: 28, sub: 2, zSplit: p.radome, matSplit: M.radome }));
    g.add(tettuccio(p.cn, M));
    (p.prese || []).forEach(pr => g.add(presa(pr, M)));
    (p.lofts || []).forEach(l => { g.add(loft(l.sez, M.skin, { n: 20 })); if (l.dop) g.add(loft(specchiaSez(l.sez), M.skin, { n: 20 })); });
    if (p.sting) { const s = p.sting, L = s.z0 - s.z1, st = lathe([[0.001, s.z1], [s.r * 0.35, s.z1 + 0.2], [s.r * 0.75, s.z1 + L * 0.2], [s.r * 0.95, s.z1 + L * 0.45], [s.r, s.z0]], M.skin, 18); st.position.y = s.y; g.add(st);
      const pt = lathe([[0.001, s.z1], [s.r * 0.36, s.z1 + 0.21], [s.r * 0.6, s.z1 + L * 0.12]], M.radome, 18); pt.position.y = s.y; g.add(pt); }
    if (p.lerx) g.add(coppia(Object.assign({ diedro: 0 }, p.lerx), M).G);
    const W = coppia(p.ala, M); g.add(W.G); const ailerons = W.mob;
    let stab = null, canard = null, levcon = null; const stabPiv = [];
    if (p.stab) { const c = coppiaMobile(p.stab, M); g.add(c.G); c.piv.forEach(q => stabPiv.push(q)); stab = c.G; }
    if (p.canard) { const c = coppiaMobile(p.canard, M); g.add(c.G); canard = c.piv; }
    if (p.levcon) { const c = coppiaMobile(p.levcon, M); g.add(c.G); levcon = c.piv; }
    const derive = [], timoni = [], tutte = []; let topFin = null;
    (p.derive || []).forEach(dv => { const grande = !dv.giu && dv.st.length > 2, r = deriva(dv, M, grande ? matFin : null); g.add(r.O); derive.push(r.O); r.mob.forEach(m => timoni.push(m)); if (r.tutta) tutte.push(r.tutta); if (grande && !topFin) topFin = r.top; });
    const ugelli = []; (p.ugelli || []).forEach(u => { const n = ugello(u, M); g.add(n); ugelli.push(n); });
    /* armamento e carichi */
    const armi = opt.armi || {}, eliche = [];
    const attacco = (x, z, hp, yAtt, r, L) => { if (yAtt == null) yAtt = infoAla(p.ala, x).yb + 0.03; if (hp > 0.05) g.add(Object.assign(pilone(L, hp + 0.06, M.bordo), {}).translateX(x).translateY(yAtt - hp - 0.03).translateZ(z)); return yAtt - hp - r; };
    Object.keys(p.armi || {}).forEach(nome => { const pos = p.armi[nome], n = armi[nome] != null ? armi[nome] : pos.length;
      pos.slice(0, Math.max(0, Math.min(pos.length, n))).forEach(([x, z, hp, yAtt]) => {
        const r = nome === "GBU48" ? 0.18 : nome === "POD" ? 0.3 : nome === "ADDER" ? 0.1 : nome === "AIM9" ? 0.064 : 0.09;
        const ogg = nome === "GBU48" ? bombaGbu(M) : nome === "POD" ? podAlq99(M) : missile(nome === "ADDER" ? "R77" : nome === "AIM9" ? "AIM9" : "AIM120", M);
        if (hp === -1) { const inf = infoAla(p.ala, x), sx = Math.sign(x), xr = x + sx * 0.06; g.add(mesh(new THREE.BoxGeometry(0.09, 0.12, 2.8), M.bordo, xr, inf.yTip, z)); ogg.position.set(xr, inf.yTip - 0.13, z); }
        else ogg.position.set(x, attacco(x, z, hp, yAtt, r, nome === "POD" ? 3.0 : 1.9), z);
        if (ogg.userData.elica) { ogg.userData.elica.userData.mob = true; eliche.push(ogg.userData.elica); } g.add(ogg); }); });
    const ns = armi.SERB != null ? armi.SERB : 99; (p.serb || []).slice(0, ns).forEach(([x, z, hp, L, r, yAtt]) => { const t = serbatoio(L, r, M); t.position.set(x, attacco(x, z, hp, yAtt, r, L * 0.45), z); g.add(t); });
    /* sonde, sensori, antenne */
    if (ext.pitot) { const [z, l] = ext.pitot, y = sezA(p.fus, z).y; const pt = mesh(new THREE.CylinderGeometry(0.018, 0.03, l, 6).rotateX(Math.PI / 2), M.metallo, 0, y, z + l / 2 - 0.05); g.add(pt); }
    (ext.sondaPitot || []).forEach(([x, z]) => { const s = sezA(p.fus, z); g.add(mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.4, 5).rotateX(Math.PI / 2), M.metallo, Math.sign(x) * s.w * 0.92, s.y + 0.1, z + 0.15)); });
    if (ext.sonda) { const [x, y, z, l] = ext.sonda; g.add(mesh(new THREE.CylinderGeometry(0.055, 0.07, l, 8).rotateX(Math.PI / 2), M.metallo, x, y, z + l / 2)); g.add(mesh(new THREE.CylinderGeometry(0.035, 0.09, 0.18, 8).rotateX(-Math.PI / 2), M.metallo, x, y, z + l + 0.08)); g.add(mesh(new THREE.BoxGeometry(0.16, 0.12, 0.6), M.skin, x, y - 0.04, z + 0.2)); }
    if (ext.recept != null) { const y = supTop(p.fus, ext.recept, 0); g.add(mesh(new THREE.BoxGeometry(0.44, 0.02, 0.75), M.bordo, 0, y, ext.recept)); g.add(mesh(new THREE.BoxGeometry(0.3, 0.03, 0.52), M.buio, 0, y + 0.005, ext.recept)); }
    if (ext.irst) { const [x, z, r] = ext.irst, y = supTop(p.fus, z, x); g.add(mesh(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.irst, x, y - 0.02, z)); g.add(mesh(new THREE.CylinderGeometry(r * 1.15, r * 1.25, 0.06, 12), M.telaio, x, y - 0.02, z)); }
    const inf = infoAla(p.ala, inf0(p.ala)); let xLuci = inf.xt + 0.03;
    if (ext.podPunta) { const [L, r, z] = ext.podPunta; [1, -1].forEach(s => g.add(mesh(corpoLathe(L, r, 2.2, 0.3, 10), M.pod, s * (inf.xt + r * 0.7), inf.yTip, z))); xLuci = inf.xt + r * 1.5; }
    (ext.lame || []).forEach(([z, su]) => { const s = sezA(p.fus, z), l = lama(0.26, 0.34, M.bordo); if (su > 0) l.position.set(0, s.y + s.h * s.top - 0.01, z); else { l.rotation.z = Math.PI; l.position.set(0, s.y - s.h * s.bot + 0.01, z); } g.add(l); });
    (ext.form || []).forEach(z => { const s = sezA(p.fus, z), xs = s.w * (1 + s.ch) + 0.012; [1, -1].forEach(k => g.add(mesh(new THREE.BoxGeometry(0.02, Math.min(0.5, s.h * 0.7), 0.07), M.formaz, k * xs, s.y + 0.05, z))); });
    /* marcature */
    decalAla(g, p.ala, 0.66, matIns.map, Math.min(1.25, inf.c * 0.9 + 0.2), matIns);
    const noStep = matDecal(texTesto("NO STEP", 128, 32, "rgba(20,20,20,0.85)", true)); [1, -1].forEach(s => { const a = infoAla(p.ala, p.ala.st[0][0] + 0.9), d = decal(null, 0.8, 0.2, noStep); d.rotation.order = "ZYX"; d.rotation.set(-Math.PI / 2, 0, s * d2r(p.ala.diedro || 0)); d.position.set(s * (p.ala.st[0][0] + 0.9), a.yt + 0.02, a.zl - a.c * 0.45); g.add(d); });
    if (ext.ins != null) decalFus(g, p.fus, ext.ins, matIns.map, 0.75, 0, matIns);
    /* luci: navigazione, coda, strobe */
    const zLuci = inf.zl - 0.3; luciNav(g, xLuci, inf.yTip, zLuci); const zc = p.fus[p.fus.length - 1].z; g.add(luce(0, sezA(p.fus, zc + 0.3).y + 0.3, zc - 0.2, 0xffffff, 0.35));
    const strobe = luce(topFin ? topFin.x : 0, topFin ? topFin.y : 1.5, topFin ? topFin.z : zc, 0xffffff, 0.6); g.add(strobe);
    g.traverse(o => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = false; } });
    unisci(g);
    g.userData.parti = { ailerons, derive, timoni, tutte, ugelli, strobe, stab, stabPiv, canard, levcon, eliche, len: p.len };
    /* anim(stato): {rollRate (°/s), pitchRate (°/s), yawRate (°/s), afterburner (0..1), t (s)} */
    g.userData.anim = s => {
      const q = g.userData.parti, t = s.t || 0, cl = THREE.MathUtils.clamp, a = d2r(cl((s.rollRate || 0) / 90 * 20, -20, 20)), e = d2r(cl((s.pitchRate || 0) / 15 * 15, -15, 15)), r = d2r(cl((s.yawRate || 0) / 10 * 12, -12, 12));
      q.ailerons.forEach(m => { m.piv.rotation.x = m.tipo === "alettone" ? a : m.tipo === "elevone" ? cl(a * 0.7 + e * 0.8 * m.s, -0.4, 0.4) : m.tipo === "flap" ? -0.05 * m.s : 0; });
      q.stabPiv.forEach(m => { m.piv.rotation.x = cl(e + m.s * a * 0.4, -0.35, 0.35); });
      if (q.canard) q.canard.forEach(m => { m.piv.rotation.x = -e * 0.8; }); if (q.levcon) q.levcon.forEach(m => { m.piv.rotation.x = -e * 0.6; });
      q.timoni.forEach(m => { m.piv.rotation.x = -r; }); q.tutte.forEach(I => { I.rotation.y = -r * 0.7; });
      q.eliche.forEach(el => { el.rotation.z = t * 45; });
      const ab = s.afterburner || 0;
      q.ugelli.forEach(u => { const F = u.userData.fiamma, mt = u.userData.mats, fl = 0.85 + 0.15 * Math.sin(t * 47 + u.position.x * 3);
        F.visible = ab > 0.05; F.scale.z = (0.3 + ab * 0.95) * fl; mt.fiamma.opacity = 0.3 + 0.45 * ab; mt.nucleo.opacity = 0.5 + 0.4 * ab;
        mt.diamanti.opacity = ab > 0.4 ? (ab - 0.4) * 1.2 * fl : 0; F.userData.diamanti.forEach((d, i) => d.visible = ab > 0.4 + i * 0.1);
        mt.glow.color.setHSL(0.07, 1, 0.1 + 0.4 * ab); mt.anello.opacity = 0.25 + 0.65 * ab;
        if (u.userData.flap) u.userData.flap.forEach(f => { f.pv.rotation.x = cl(e * 0.8, -0.35, 0.35) + f.sy * 0.04 * (1 - ab); }); });
      q.strobe.visible = Math.floor(t * 1.5) % 2 === 0 || (t % 0.6) < 0.08;
    };
    return g;
  }

  /* ---------- velivoli da supporto (A330 MRTT, 737 Wedgetail) ---------- */
  function fascia(sez, z0, z1, a0, a1, k, mat, passo) { // striscia che segue la fusoliera (finestrini)
    const nz = 8, na = 8, pos = [], uv = [], idx = [];
    for (let i = 0; i <= nz; i++) { const z = z0 + (z1 - z0) * i / nz, s = Object.assign({}, sezA(sez, z)); s.w *= k; s.h *= k;
      for (let j = 0; j <= na; j++) { const q = puntoSez(s, a0 + (a1 - a0) * j / na); pos.push(q[0], q[1], z); uv.push(passo ? (z0 - z) / passo : j / na, passo ? j / na : 1 - i / nz); } }
    for (let i = 0; i < nz; i++) for (let j = 0; j < na; j++) { const a = i * (na + 1) + j, b = a + 1, c = a + na + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.renderOrder = 1; return m;
  }
  function texFinestrini() {
    if (texCache.fin) return texCache.fin; const c = tela(64, 64), g = c.getContext("2d"); g.fillStyle = "#11161c"; g.beginPath();
    if (g.roundRect) g.roundRect(22, 14, 20, 36, 8); else g.rect(22, 14, 20, 36); g.fill(); const t = texDa(c, true); t.wrapT = THREE.ClampToEdgeWrapping; return (texCache.fin = t);
  }
  function texCabina() {
    if (texCache.cab) return texCache.cab; const c = tela(256, 64), g = c.getContext("2d"); g.fillStyle = "#0d1218";
    [[8, 30, 40], [56, 18, 52], [116, 14, 56], [176, 18, 52], [218, 30, 40]].forEach(([x, y, w]) => { g.beginPath(); g.moveTo(x, y + 26); g.lineTo(x + 4, y); g.lineTo(x + w - 4, y); g.lineTo(x + w, y + 26); g.closePath(); g.fill(); });
    return (texCache.cab = texDa(c));
  }
  function motore(m, M, sx) { // nacella turbofan con fan visibile, cono di scarico, pilone
    const G = new THREE.Group(), x = m.x * sx, r = m.r, b = m.piatto ? 0.8 : 1, z0 = m.z, l = m.l;
    const sez = [[z0, r * 0.9], [z0 - 0.22, r], [z0 - l * 0.35, r * 1.02], [z0 - l * 0.72, r * 0.92], [z0 - l, r * 0.7]].map(([z, rr]) => ({ z, x, y: m.y, w: rr, h: rr, bot: b }));
    G.add(loft(sez, M.skinDS, { n: 28, cap0: false }));
    const lab = mesh(new THREE.TorusGeometry(r * 0.92, r * 0.07, 4, 24), M.condotto, x, m.y, z0); lab.scale.y = (1 + b) / 2; G.add(lab); // labbro presa
    const fan = new THREE.Group(); fan.position.set(x, m.y, z0 - 0.5); fan.userData.mob = true;
    fan.add(mesh(new THREE.CircleGeometry(r * 0.86, 24), M.buio, 0, 0, -0.05)); const sp = mesh(new THREE.ConeGeometry(r * 0.24, r * 0.5, 14), M.metallo, 0, 0, r * 0.2); sp.rotation.x = Math.PI / 2; fan.add(sp);
    for (let i = 0; i < 18; i++) { const pv = new THREE.Group(); pv.rotation.z = i / 18 * Math.PI * 2; const pa = mesh(new THREE.BoxGeometry(r * 0.13, r * 0.62, 0.03), M.metallo, 0, r * 0.53, 0); pa.rotation.y = 0.55; pv.add(pa); fan.add(pv); }
    G.add(fan); const cono = mesh(new THREE.ConeGeometry(r * 0.42, r * 1.3, 16), M.metallo, x, m.y, z0 - l - r * 0.6); cono.rotation.x = -Math.PI / 2; G.add(cono);
    G.userData.fan = fan; return G;
  }
  function liner(p, g, M, matFin, matIns, rosso, opt) {
    g.add(loft(p.fus, M.skin, { n: 32, sub: 2, zSplit: p.radome, matSplit: M.radome }));
    const v = p.ventre; g.add(loft(S([[v.z0, 0.3, 0.2, v.y + 0.2], [v.z0 - 3, v.w, v.h, v.y], [v.z1 + 3, v.w, v.h, v.y], [v.z1, 0.4, 0.3, v.y + 0.2]]), M.skin, { n: 20 })); // carenatura ala-fusoliera
    g.add(fascia(p.fus, p.cockpit + 1.3, p.cockpit - 0.3, 0.22, Math.PI - 0.22, 1.004, matDecal(texCabina())));
    if (p.finestre) { const mf = matDecal(texFinestrini()); [[-0.1, 0.12], [Math.PI - 0.12, Math.PI + 0.1]].forEach(([a0, a1]) => g.add(fascia(p.fus, p.finestre[0], p.finestre[1], a0, a1, 1.003, mf, 0.53))); }
    const W = coppia(p.ala, M); g.add(W.G); const ailerons = W.mob, inf = infoAla(p.ala, inf0(p.ala));
    let xLuci = inf.xt + 0.05;
    if (p.winglet) [1, -1].forEach(s => g.add(deriva({ x: s * inf.xt, y: inf.yTip, cant: p.winglet.cant, st: p.winglet.st }, M).O));
    const S2 = coppia(p.stab, M); g.add(S2.G); S2.mob.forEach(m => { m.tipo = "elevatore"; ailerons.push(m); });
    const derive = [], timoni = []; let topFin = null;
    p.derive.forEach(dv => { const grande = !dv.giu && dv.st.length > 2, r = deriva(dv, M, grande ? matFin : null); g.add(r.O); derive.push(r.O); r.mob.forEach(m => timoni.push(m)); if (grande && !topFin) topFin = r.top; });
    const fans = []; (p.motori || []).forEach(m => [1, -1].forEach(sx => { const e = motore(m, M, sx); g.add(e); fans.push(e.userData.fan);
      const ia = infoAla(p.ala, m.x), h = ia.yb - (m.y + m.r) + 0.5, pl = pilone(m.l * 1.15, h, M.skin); pl.position.set(sx * m.x, m.y + m.r - 0.4, m.z - m.l * 0.55); g.add(pl); }));
    const eliche = [];
    if (p.podAla) [1, -1].forEach(s => { const [x, z] = p.podAla, ia = infoAla(p.ala, x), y = ia.yb - 0.55 - 0.42; g.add(mesh(corpoLathe(4.2, 0.42, 2.2, 0.35, 14), M.pod, s * x, y, z)); const pl = pilone(2.6, 0.62, M.skin); pl.position.set(s * x, y + 0.38, z); g.add(pl);
      const el = mesh(new THREE.BoxGeometry(0.9, 0.08, 0.03), M.metallo, s * x, y, z + 2.2); el.userData.mob = true; g.add(el); eliche.push(el); });
    let boom = null;
    if (p.boom) { boom = new THREE.Group(); boom.position.set(0, p.boom.y, p.boom.z); boom.userData.mob = true; boom.rotation.x = -0.4;
      boom.add(mesh(new THREE.SphereGeometry(0.55, 12, 8), M.skin)); const tb = new THREE.CylinderGeometry(0.3, 0.24, 11, 12); tb.rotateX(Math.PI / 2); tb.translate(0, 0, -5.5); boom.add(mesh(tb, M.skin));
      const tl = new THREE.CylinderGeometry(0.13, 0.13, 5, 8); tl.rotateX(Math.PI / 2); tl.translate(0, 0, -13.2); boom.add(mesh(tl, M.metallo)); boom.add(mesh(new THREE.ConeGeometry(0.2, 0.5, 8).rotateX(-Math.PI / 2), M.metallo, 0, 0, -15.8));
      [1, -1].forEach(s => { const sf = superficie(staz([[0.2, 0.6, -0.6, 0.08], [1.7, -0.15, -0.75, 0.06]]), { mat: M.skin, s }); sf.position.z = -9.6; sf.rotation.z = s * 0.6; boom.add(sf); }); // alette (ruddevator) a V
      boom.add(luce(0, -0.3, -10.5, 0xfff2c0, 0.4)); g.add(boom); }
    if (p.mesa) { [-1.2, -6.2].forEach(z => g.add(deriva({ x: 0, y: 1.82, st: [[0, z + 0.95, z - 0.95, 0.16], [1.65, z + 0.8, z - 0.7, 0.14]] }, M).O)); // piloni dorsali
      g.add(loft(S([[1.7, 0.05, 0.3, 4.12, 1, 1, 6], [1.2, 0.38, 0.62, 4.12, 1, 1, 8], [-8.6, 0.38, 0.62, 4.12, 1, 1, 8], [-9.1, 0.05, 0.3, 4.12, 1, 1, 6]]), M.radome, { n: 20 })); // trave MESA
      g.add(loft(S([[-0.6, 0.05, 0.05, 4.74, 1, 1, 4], [-1.4, 0.5, 0.3, 4.74, 1, 1, 4], [-6.0, 0.5, 0.3, 4.74, 1, 1, 4], [-6.8, 0.05, 0.05, 4.74, 1, 1, 4]]), M.radome, { n: 20 })); } // "top hat"
    [[3.0, -1], [-4.0, 1], [8.0, 1], [-1.0, -1]].forEach(([z, su]) => { const s = sezA(p.fus, z), l = lama(0.45, 0.6, M.bordo); if (su > 0) l.position.set(0, s.y + s.h - 0.02, z); else { l.rotation.z = Math.PI; l.position.set(0, s.y - s.h + 0.02, z); } g.add(l); });
    /* marcature: coccarde, scritta, numero in deriva */
    decalAla(g, p.ala, 0.72, matIns.map, 2.6, matIns); decalFus(g, p.fus, p.ins, matIns.map, 1.9, 0.2, matIns);
    const tit = matDecal(texTesto(rosso ? "ВВС РОССИИ" : "AERONAUTICA MILITARE", 512, 48, "rgba(25,30,40,0.9)")); [1, -1].forEach(k => { const s = sezA(p.fus, 8), R = s.h, yy = R * 0.42, d = decal(null, 11, 1.03, tit); d.rotation.order = "ZYX"; d.rotation.set(0, k * Math.PI / 2, k * Math.asin(0.42)); d.position.set(k * (Math.sqrt(R * R - yy * yy) + 0.04), s.y + yy, 8); g.add(d); });
    /* luci: navigazione, faro di coda, beacon rossi, strobe d'estremità */
    luciNav(g, xLuci, inf.yTip, inf.zl - 0.4); const zc = p.fus[p.fus.length - 1].z; g.add(luce(0, p.fus[p.fus.length - 1].y, zc - 0.2, 0xffffff, 0.6));
    const strobe = new THREE.Group(); [1, -1].forEach(s => strobe.add(luce(s * xLuci, inf.yTip, inf.zt + 0.2, 0xffffff, 1.0))); if (topFin) strobe.add(luce(topFin.x, topFin.y, topFin.z, 0xffffff, 0.7)); g.add(strobe);
    const s0 = sezA(p.fus, 0), beacon = [luce(0, s0.y + s0.h + 0.15, 0, 0xff2020, 0.9), luce(0, s0.y - s0.h - 0.15, 3, 0xff2020, 0.9)]; beacon.forEach(b => g.add(b));
    g.traverse(o => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = false; } });
    unisci(g);
    g.userData.parti = { ailerons, derive, timoni, tutte: [], ugelli: [], strobe, stab: S2.G, stabPiv: [], canard: null, levcon: null, eliche, fans, boom, beacon, len: p.len };
    g.userData.anim = s => {
      const q = g.userData.parti, t = s.t || 0, cl = THREE.MathUtils.clamp, a = d2r(cl((s.rollRate || 0) / 30 * 15, -15, 15)), e = d2r(cl((s.pitchRate || 0) / 6 * 12, -12, 12)), r = d2r(cl((s.yawRate || 0) / 5 * 10, -10, 10));
      q.ailerons.forEach(m => { m.piv.rotation.x = m.tipo === "alettone" ? a : m.tipo === "elevatore" ? e * m.s : 0; }); q.timoni.forEach(m => { m.piv.rotation.x = -r; });
      q.fans.forEach(f => { f.rotation.z = t * (25 + 15 * (s.afterburner || 0)); }); q.eliche.forEach(el => { el.rotation.z = t * 30; });
      if (q.boom) q.boom.rotation.x = -0.4 + 0.03 * Math.sin(t * 0.7); if (q.boom) q.boom.rotation.y = 0.02 * Math.sin(t * 0.43);
      const ph = t % 1.2; q.strobe.visible = ph < 0.06 || (ph > 0.14 && ph < 0.2); q.beacon.forEach(b => b.visible = (t % 1.0) < 0.12);
    };
    return g;
  }
  return { costruisci, TIPI };
})();
