/* CENTURION · postbruciatore: la fiamma degli ugelli in volo libero, Mondo 3D, viste 3D e filmati.

   Ogni ugello ha tre parti:
   - il getto: un cilindro "contenitore" dentro cui lo shader integra, lungo il raggio visivo, la luce del gas
     caldo (nucleo bianco-giallo, involucro arancio che sfuma, diamanti d'urto). Così la fiamma è giusta da
     qualunque angolo: di lato è una lingua con i diamanti, da dietro (camera esterna) un disco incandescente;
   - il bagliore dell'ugello: l'interno incandescente visto da dietro (rosso cupo anche senza postbruciatore, di notte);
   - un alone morbido, quasi invisibile di giorno e più forte di notte.

   Il colore segue la spinta: con poco postbruciatore la fiamma è corta, trasparente, blu-viola con diamanti rosati;
   al massimo è lunga, giallo-arancio, con 5-6 diamanti. In quota il getto è più espanso e i diamanti più distanti
   (pressione esterna più bassa). All'accensione c'è un breve lampo.

   API: POSTBRUCIATORE.monta(wrap, tipo, voceManifest) aggiunge le fiamme a un modello glTF impaginato da vista3d.js;
        POSTBRUCIATORE.crea({rx, ry}) crea una fiamma (origine sul piano di uscita, getto verso -Z);
        POSTBRUCIATORE.anima(fiamme, {afterburner 0..1, spinta 0..1, t secondi}) le aggiorna. */
const POSTBRUCIATORE = (() => {
  "use strict";
  /* Ugelli dei modelli glTF, nelle coordinate del modello impaginato da vista3d.js (muso +Z, box centrato
     nell'origine, metri), misurati sulla mappa di profondità vista da dietro: [x, y, z del piano di uscita, raggio],
     per gli ugelli 2D dell'F-22 [x, y, z, semilarghezza, semialtezza]. "box" è il modello misurato: se il file
     cambia dimensioni le posizioni si scalano con il nuovo box. */
  const UGELLI = {
    F16:   { box: [10.12, 4.2, 15.0],   u: [[0, -1.07, -7.5, 0.39]] },
    F2000: { box: [10.82, 4.64, 15.96], u: [[0.495, -1.252, -6.895, 0.31], [-0.495, -1.252, -6.895, 0.31]] },
    F15:   { box: [13.06, 5.1, 19.42],  u: [[0.782, -0.991, -8.11, 0.39], [-0.782, -0.991, -8.11, 0.39]] },
    F22:   { box: [13.66, 4.24, 18.9],  u: [[0.677, -1.112, -7.35, 0.6, 0.26], [-0.677, -1.112, -7.35, 0.6, 0.26]] },
    SU35:  { box: [14.8, 4.86, 21.9],   u: [[1.049, -1.404, -8.96, 0.43], [-1.049, -1.404, -8.96, 0.43]] },
    SU57:  { box: [13.54, 2.96, 20.1],  u: [[1.344, -0.664, -8.767, 0.39], [-1.344, -0.664, -8.767, 0.39]] },
    EA18:  { box: [13.64, 4.64, 18.3],  u: [[0.418, -0.588, -8.205, 0.33], [-0.418, -0.588, -8.205, 0.33]] }
  };
  const mobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "") || Math.min(screen.width || 9999, screen.height || 9999) < 760;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /* ---------- risorse condivise ---------- */
  let GEO = null;
  function risorse() {
    if (GEO) return GEO;
    const cil = new THREE.CylinderGeometry(1, 1, 1, 18, 1, false); cil.rotateX(-Math.PI / 2); cil.translate(0, 0, -0.5);   // raggio 1, z da 0 a -1
    const disco = new THREE.CircleGeometry(1, 28); disco.rotateY(Math.PI);                                                   // guarda indietro (-Z)
    const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.45)"); gr.addColorStop(0.6, "rgba(255,255,255,0.1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    GEO = { cil, disco, alone: new THREE.CanvasTexture(c), passi: mobile() ? 10 : 16 };
    return GEO;
  }

  /* ---------- getto volumetrico ---------- */
  const VS_GETTO = `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec3 uScala;
varying vec3 vP;
varying float vFogDepth;
void main() {
  vP = position * uScala;                       // spazio della fiamma (origine sul piano di uscita, getto verso -Z)
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;
  const FS_GETTO = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uCam;        // camera nello spazio della fiamma
uniform vec3 uScala;      // semiassi del contenitore (x, y) e lunghezza del getto (z)
uniform vec2 uR;          // semiassi dell'ugello
uniform float uAB, uT, uSeme, uNotte, uPasso, uIntens, uEspans;
uniform vec3 fogColor;
uniform float fogNear, fogFar;
varying vec3 vP;
varying float vFogDepth;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  #include <logdepthbuf_fragment>
  vec3 o = uCam, d = normalize(vP - uCam);
  // ingresso e uscita del raggio nel cilindro ellittico, fra il piano di uscita (z = 0) e la coda (z = -L)
  vec2 oo = o.xy / uScala.xy, dd = d.xy / uScala.xy;
  float a = dot(dd, dd), b = 2.0 * dot(oo, dd), c = dot(oo, oo) - 1.0;
  float t0 = 0.0, t1 = 1.0e6;
  if (a > 1.0e-8) { float D = b * b - 4.0 * a * c; if (D <= 0.0) discard; float sD = sqrt(D); t0 = (-b - sD) / (2.0 * a); t1 = (-b + sD) / (2.0 * a); }
  else if (c > 0.0) discard;
  if (abs(d.z) > 1.0e-6) { float za = -o.z / d.z, zb = (-uScala.z - o.z) / d.z; t0 = max(t0, min(za, zb)); t1 = min(t1, max(za, zb)); }
  else if (o.z > 0.0 || o.z < -uScala.z) discard;
  t0 = max(t0, 0.0);
  if (t1 <= t0) discard;
  float L = uScala.z, ab = uAB;
  float caldo = smoothstep(0.15, 0.85, ab);
  vec3 cNucleo = mix(vec3(0.52, 0.58, 1.0), vec3(1.0, 0.79, 0.48), caldo);
  vec3 cDiam = mix(vec3(1.0, 0.52, 0.76), vec3(1.0, 0.84, 0.58), caldo);
  vec3 cInv0 = mix(vec3(0.58, 0.34, 1.0), vec3(1.0, 0.46, 0.11), caldo);
  float sNucleo = 0.30 + 0.16 * ab;              // il nucleo luminoso si chiude a questa frazione del getto
  // diamanti piu' evidenti di notte; di giorno restano accennati
  float nDiam = 1.5 + 4.5 * ab, kDiam = smoothstep(0.2, 0.55, ab) * (0.45 + 0.55 * uNotte);
  float rm = sqrt(uR.x * uR.y);
  float ds = (t1 - t0) / float(PASSI);
  float t = t0 + ds * hash(gl_FragCoord.xy);
  vec3 E = vec3(0.0); float tau = 0.0;
  for (int i = 0; i < PASSI; i++) {
    vec3 p = o + d * t;
    float x = max(0.0, -p.z), s = x / L;
    // sezione: dalla forma dell'ugello (piatta per l'F-22) verso il tondo, con una leggera espansione
    // il getto si allarga appena uscito, poi la parte visibile si assottiglia verso la punta
    vec2 ax = mix(uR, vec2(rm), smoothstep(0.0, 0.6, s)) * (1.0 + 0.35 * s) * (1.0 - 0.55 * s * s) * uEspans;
    vec2 qv = p.xy / ax; float q2 = dot(qv, qv);
    // nucleo: proiettile bianco-giallo che si chiude
    float rc = max(0.04, 0.88 * pow(max(0.0, 1.0 - s / sNucleo), 0.7));
    float nucleo = s < sNucleo ? exp(-q2 / (rc * rc) * 1.6) : 0.0;
    // involucro: turbolento, sfuma verso la coda
    float turb = 0.74 + 0.26 * sin(x * 5.7 - uT * 41.0 + uSeme + p.y * 7.0) * sin(x * 2.3 - uT * 23.0 + uSeme * 1.7 - p.x * 7.0);
    float inv = exp(-q2 * 1.4) * (1.0 - smoothstep(0.35, 1.0, s)) * turb;
    // diamanti d'urto: lenti allungate sull'asse, piu' strette del getto e sempre piu' deboli
    float ph = x / uPasso - 0.7; float k = floor(ph + 0.5); float f = ph - k;
    float dia = (k >= 0.0 && k < nDiam) ? exp(-f * f / 0.05) * exp(-q2 / (0.16 * (1.0 - 0.08 * k))) * exp(-0.3 * k) : 0.0;
    vec3 cInv = mix(cInv0, vec3(0.9, 0.2, 0.04), s);
    E += (cNucleo * nucleo * 2.3 + cInv * inv * 1.05 + cDiam * dia * 1.9 * kDiam) * ds;
    tau += (nucleo * 0.9 + inv * 0.5 + dia * kDiam) * ds;
    t += ds;
  }
  float nebbia = smoothstep(fogNear, fogFar, vFogDepth);
  float kI = uIntens * (1.0 - nebbia);
  // esposizione: di giorno l'occhio (e la camera) e' adattato alla luce e la fiamma appare meno abbagliante e piu' colorata;
  // un po' di copertura del cielo dietro la mantiene arancio invece che bianca
  float esp = mix(0.42, 1.0, uNotte);
  float alfa = (1.0 - exp(-tau * 0.9)) * mix(0.5, 0.18, uNotte) * kI;
  gl_FragColor = vec4(E * kI * esp, clamp(alfa, 0.0, 0.85));
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`;
  /* ---------- bagliore dell'ugello (interno incandescente) ---------- */
  const VS_DISCO = `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vQ;
varying float vFogDepth;
void main() {
  vQ = position.xy;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;
  const FS_DISCO = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uAB, uMil, uIntens, uNotte;
uniform vec3 fogColor;
uniform float fogNear, fogFar;
varying vec2 vQ;
varying float vFogDepth;
void main() {
  #include <logdepthbuf_fragment>
  float r = length(vQ);
  float caldo = smoothstep(0.1, 0.8, uAB);
  // centro giallo-bianco, bordo arancio (i petali sono meno caldi); con poco postbruciatore una sfumatura viola
  vec3 cAB = mix(mix(vec3(1.0, 0.86, 0.6), vec3(1.0, 0.45, 0.12), smoothstep(0.15, 0.95, r)), vec3(0.78, 0.62, 1.0), (1.0 - caldo) * 0.45 * (1.0 - r));
  vec3 cMil = vec3(0.9, 0.22, 0.04) * (1.0 - 0.5 * r * r);
  // anello dei petali piu' scuro al bordo
  float bordo = 1.0 - smoothstep(0.82, 1.0, r);
  float mil = uMil * 0.32 * uNotte;                // a motore militare l'interno e' rosso cupo: si vede solo di notte
  vec3 col = (cAB * uAB * (1.9 - 0.9 * r * r) + cMil * mil) * bordo;
  float nebbia = smoothstep(fogNear, fogFar, vFogDepth);
  float kI = uIntens * (1.0 - nebbia);
  gl_FragColor = vec4(col * kI * mix(0.55, 1.0, uNotte), clamp((uAB * 0.85 + mil * 0.4) * bordo * kI, 0.0, 0.9));
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`;
  const fogU = () => ({ fogColor: { value: new THREE.Color(0) }, fogNear: { value: 1e7 }, fogFar: { value: 2e7 }, fogDensity: { value: 0 } });   // senza nebbia nella scena: nessun effetto
  const BLEND = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    transparent: true, depthWrite: false, depthTest: true, fog: true };
  function materialeGetto(rx, ry, seme) {
    return new THREE.ShaderMaterial(Object.assign({
      uniforms: Object.assign({ uCam: { value: new THREE.Vector3() }, uScala: { value: new THREE.Vector3(1, 1, 1) }, uR: { value: new THREE.Vector2(rx, ry) },
        uAB: { value: 0 }, uT: { value: 0 }, uSeme: { value: seme }, uNotte: { value: 0 }, uPasso: { value: 1 }, uIntens: { value: 1 }, uEspans: { value: 1 } }, fogU()),
      defines: { PASSI: risorse().passi }, vertexShader: VS_GETTO, fragmentShader: FS_GETTO, side: THREE.BackSide }, BLEND));
  }
  function materialeDisco() {
    return new THREE.ShaderMaterial(Object.assign({
      uniforms: Object.assign({ uAB: { value: 0 }, uMil: { value: 0 }, uIntens: { value: 1 }, uNotte: { value: 0 } }, fogU()),
      vertexShader: VS_DISCO, fragmentShader: FS_DISCO, side: THREE.FrontSide }, BLEND));
  }

  /* ---------- ambiente: notte (luminosità dello sfondo) e quota ---------- */
  const _m = new THREE.Matrix4(), _v = new THREE.Vector3();
  function notteDa(scene) {
    const bg = scene && scene.background; if (!bg || !bg.isColor) return 0;
    return 1 - ss(0.05, 0.24, 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b);
  }
  /* La visibilità delle parti la decide solo questo modulo: altri moduli (la vista cockpit) a ogni fotogramma rimettono
     visible = true su tutte le mesh del modello, e la fiamma comparirebbe anche a motore al minimo. */
  function proteggi(o) {
    if (!o || o.pbProtetto) return o;
    let vis = false;
    Object.defineProperty(o, "visible", { configurable: true, get: () => vis, set: () => {} });
    Object.defineProperty(o, "pbVisibile", { configurable: true, get: () => vis, set: v => { vis = !!v; } });
    // luce, non materia: niente ombre (anche se qualcuno le attiva su tutto il modello) e niente raycast
    Object.defineProperty(o, "castShadow", { configurable: true, get: () => false, set: () => {} });
    o.raycast = () => {}; o.pbProtetto = true;
    return o;
  }
  const STATO = new WeakMap();
  function stato(F) {
    let st = STATO.get(F);
    if (!st) {   // fiamma clonata (Object3D.clone non copia i riferimenti): li ricostruisce dai nomi
      st = { getto: proteggi(F.getObjectByName("pb_getto")), disco: proteggi(F.getObjectByName("pb_disco")), alone: proteggi(F.getObjectByName("pb_alone")), quota: 0, abPrima: 0, lampo: -9, kAlone: 0,
        rx: F.userData.pb_rx || 0.4, ry: F.userData.pb_ry || F.userData.pb_rx || 0.4, seme: F.userData.pb_seme || 0 };
      STATO.set(F, st); collega(F, st);
    }
    return st;
  }
  // ogni passata di disegno (vista principale, pod con il suo sfondo infrarosso, ...) legge il proprio sfondo
  function collega(F, st) {
    if (st.getto) st.getto.onBeforeRender = (renderer, scene, camera) => {
      const u = st.getto.material && st.getto.material.uniforms; if (!u || !u.uCam) return;
      _m.copy(F.matrixWorld).invert(); u.uCam.value.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(_m);
      u.uNotte.value = notteDa(scene);
      st.quota = _v.setFromMatrixPosition(F.matrixWorld).y;
      st.getto.material.uniformsNeedUpdate = true;
    };
    if (st.disco) st.disco.onBeforeRender = (renderer, scene) => {
      const m = st.disco.material; if (m && m.uniforms && m.uniforms.uNotte) { m.uniforms.uNotte.value = notteDa(scene); m.uniformsNeedUpdate = true; }
      st.quota = _v.setFromMatrixPosition(F.matrixWorld).y;
    };
    if (st.alone) st.alone.onBeforeRender = (renderer, scene) => {
      // alone quasi invisibile di giorno, ampio di notte: dimensione e opacità della passata in corso
      const n = notteDa(scene), rm = Math.sqrt(st.rx * st.ry);
      st.alone.material.opacity = Math.min(1, (0.12 + 0.55 * n) * (st.kAlone || 0));
      const sz = rm * (3.2 + 2.5 * n) * (0.8 + 0.4 * (st.abPrima || 0)); st.alone.scale.set(sz, sz, 1); st.alone.updateMatrixWorld();
    };
  }

  /* ---------- una fiamma ---------- */
  let SEMI = 0;
  function crea(o) {
    const R = risorse(), rx = (o && o.rx) || 0.4, ry = (o && o.ry) || rx, seme = (SEMI++ * 2.399) % 6.283;
    const F = new THREE.Group(); F.name = "postbruciatore";
    F.userData.postbruciatore = true; F.userData.mob = true; F.userData.pb_rx = rx; F.userData.pb_ry = ry; F.userData.pb_seme = seme;
    // ordine fra le parti trasparenti per distanza: da dietro bagliore (più avanti di 1 cm), poi getto, poi alone
    const getto = new THREE.Mesh(R.cil, materialeGetto(rx, ry, seme)); getto.name = "pb_getto";
    const disco = new THREE.Mesh(R.disco, materialeDisco()); disco.name = "pb_disco"; disco.scale.set(rx * 0.96, ry * 0.96, 1); disco.position.z = 0.012;
    const alone = new THREE.Sprite(new THREE.SpriteMaterial({ map: R.alone, color: 0xff8a3a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    alone.name = "pb_alone"; alone.position.z = -0.25;
    // spente sono puntiformi: non allargano i box dei modelli calcolati da altri moduli (inquadrature, aggancio in volo)
    getto.scale.setScalar(1e-3); alone.scale.setScalar(1e-3);
    [getto, disco, alone].forEach(proteggi);
    F.add(getto, disco, alone);
    const st = { getto, disco, alone, quota: 0, abPrima: 0, lampo: -9, kAlone: 0, rx, ry, seme }; STATO.set(F, st); collega(F, st);
    return F;
  }

  /* ---------- aggiornamento: lunghezza, colore, tremolio, lampo di accensione ---------- */
  function anima(lista, s) {
    if (!lista) return;
    const arr = Array.isArray(lista) ? lista : [lista];
    const ab = Math.min(1, Math.max(0, (s && s.afterburner) || 0)), mil = Math.min(1, Math.max(0, (s && s.spinta) || 0));
    const t = s && s.t != null ? s.t : performance.now() / 1000;
    arr.forEach(F => {
      if (!F || !F.userData || !F.userData.postbruciatore) return;
      const st = stato(F), rm = Math.sqrt(st.rx * st.ry);
      if (st.abPrima < 0.04 && ab >= 0.04) st.lampo = t;
      st.abPrima = ab;
      const lampo = t >= st.lampo ? 1 + 0.9 * Math.exp(-(t - st.lampo) / 0.09) : 1;
      const fl = 0.93 + 0.07 * Math.sin(t * 53 + st.seme) * Math.sin(t * 19.7 + st.seme * 2.3);
      // in quota la pressione esterna è più bassa: getto più espanso e diamanti più distanti
      const pr = Math.exp(-Math.min(15000, Math.max(0, st.quota || 0)) / 8434), esp = Math.min(1.25, Math.pow(1 / pr, 0.16)), passo = 2.25 * rm * Math.min(1.5, Math.pow(1 / pr, 0.42));
      const on = ab > 0.02;
      if (st.getto) {
        st.getto.pbVisibile = on;
        const u = st.getto.material && st.getto.material.uniforms;
        if (!on) st.getto.scale.setScalar(1e-3);
        else if (u && u.uScala) {
          const L = rm * (4.2 + 11.5 * ab) * Math.sqrt(esp) * (0.97 + 0.03 * Math.sin(t * 11 + st.seme));
          const Rb = Math.max(st.rx, st.ry) * 1.65 * esp;
          st.getto.scale.set(Rb, Rb, L); u.uScala.value.set(Rb, Rb, L);
          u.uAB.value = ab; u.uT.value = t % 1000; u.uPasso.value = passo; u.uEspans.value = esp;
          u.uIntens.value = (0.55 + 0.45 * ab) * fl * lampo;
        }
      }
      if (st.disco) {
        // il bagliore resta in scena anche a motore al minimo: di notte l'interno dell'ugello è rosso cupo
        const u = st.disco.material && st.disco.material.uniforms;
        st.disco.pbVisibile = on || mil > 0.02;
        if (u && u.uAB) { u.uAB.value = on ? 0.35 + 0.65 * ab : 0; u.uMil.value = mil; u.uIntens.value = fl * lampo; }
      }
      if (st.alone) {
        st.alone.pbVisibile = on; st.kAlone = on ? ab * fl * lampo : 0;
        if (!on) st.alone.scale.setScalar(1e-3);
      }
    });
  }

  /* ---------- fiamme sugli ugelli di un modello glTF ---------- */
  function monta(wrap, tipo, man) {
    let lista = null;
    if (man && Array.isArray(man.ugelli) && man.ugelli.length) lista = man.ugelli.map(u => [u[0], u[1], u[2], u[3] || 0.4, u[4]]);
    else if (UGELLI[tipo]) {
      const def = UGELLI[tipo], size = new THREE.Box3().setFromObject(wrap).getSize(new THREE.Vector3());
      const k = [size.x / def.box[0], size.y / def.box[1], size.z / def.box[2]].map(v => (isFinite(v) && v > 0.5 && v < 2 ? v : 1)), kr = Math.sqrt(k[0] * k[1]);
      lista = def.u.map(u => [u[0] * k[0], u[1] * k[1], u[2] * k[2], u[3] * kr, u[4] != null ? u[4] * kr : undefined]);
    }
    if (!lista) return [];
    return lista.map(u => { const F = crea({ rx: u[3], ry: u[4] != null ? u[4] : u[3] }); F.position.set(u[0], u[1], u[2] - 0.02); wrap.add(F); return F; });
  }

  return { UGELLI, crea, anima, monta };
})();
