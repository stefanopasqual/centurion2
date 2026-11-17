#!/usr/bin/env python3
"""Better presentation of the GLB jets in Free Flight and in the mission chase camera.

- environment lighting (PMREM of a sky/ground gradient) on GLB materials only, so PBR metal does not render black;
- the detailed procedural model is shown while the GLB loads, instead of the grey placeholder;
- GLTFLoader is loaded with the page and the GLBs are preloaded when Free Flight opens;
- Free Flight chase camera attached to the aircraft (the position lerp fell ~50 m behind at speed);
  the horizon-stabilized framing from patch_cockpit.py is kept.
Run after patch_site.py and patch_cockpit.py.
"""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "extracted/site")


def patch(rel, old, new):
    p = root / rel
    s = p.read_text(encoding="utf-8")
    if old not in s:
        raise RuntimeError(f"{rel}: render patch anchor not found: {old[:90]}")
    p.write_text(s.replace(old, new, 1), encoding="utf-8")


# ---- vista3d.js: environment map, preload, procedural model export ----
patch("js/vista3d.js", "  function modelloPromise(icona, col, opt) {", r'''  // Luce ambientale per i materiali PBR dei GLB: senza environment il metallo appare nero.
  // La texture PMREM appartiene al contesto WebGL del renderer che la crea: una per renderer (volo, vista missione, cinematiche).
  const AMB = { perRenderer: new WeakMap(), corrente: null };
  function ambiente(renderer, notte) {
    const key = notte ? "notte" : "giorno";
    let cache = AMB.perRenderer.get(renderer); if (!cache) { cache = {}; AMB.perRenderer.set(renderer, cache); }
    if (key in cache) { AMB.corrente = cache[key]; return cache[key]; }
    try {
      const top = new THREE.Color(notte ? 0x0c1424 : 0x9cc4ff), hor = new THREE.Color(notte ? 0x1a2230 : 0xe8eef5), bot = new THREE.Color(notte ? 0x06080c : 0x6d7563);
      const geo = new THREE.SphereGeometry(10, 32, 16), pos = geo.attributes.position, col = [];
      for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 10; const c = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(bot, Math.pow(-y, 0.4)); col.push(c.r, c.g, c.b); }
      geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      const sc = new THREE.Scene(); sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      if (!notte) { const sun = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 5) })); sun.position.set(4, 7, 5); sc.add(sun); }
      const pm = new THREE.PMREMGenerator(renderer); cache[key] = pm.fromScene(sc, 0.02).texture; pm.dispose();
    } catch (e) { console.warn("ambiente PBR non disponibile", e); cache[key] = null; }
    AMB.corrente = cache[key]; return cache[key];
  }
  function precarica(tipi) {
    return gltfManifest().then(man => (tipi || []).forEach(t => { const m = man && man[t]; if (!m || !m.file || GLTF.cache[m.file] || typeof THREE.GLTFLoader === "undefined") return; GLTF.loader = GLTF.loader || new THREE.GLTFLoader(); GLTF.cache[m.file] = new Promise((res, rej) => GLTF.loader.load("modelli/" + m.file, g => res(g.scene), undefined, rej)).catch(e => { console.warn("glTF non caricabile", m.file, e); return null; }); })).catch(() => {});
  }
  function conAmbiente(m) {
    // environment solo sui materiali dei GLB: terreno e modelli procedurali restano come prima
    if (m && AMB.corrente) m.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(mm => { if (mm && "envMap" in mm) { mm.envMap = AMB.corrente; mm.envMapIntensity = 1; mm.needsUpdate = true; } }); });
    return m;
  }
  function modelloPromise(icona, col, opt) {''')
patch("js/vista3d.js", "return gltfModello(tipo, col, opt).catch(() => null).then(m => m || modelloProcedurale(icona, col, opt));",
      "return gltfModello(tipo, col, opt).catch(() => null).then(m => m ? conAmbiente(m) : modelloProcedurale(icona, col, opt));")
patch("js/vista3d.js", "return { apri, chiudi, daEvento, modelloPromise, jetFallback,",
      "return { apri, chiudi, daEvento, modelloPromise, modelloProcedurale, ambiente, precarica, jetFallback,")

# ---- volo.js (Free Flight) ----
patch("js/volo.js",
      "scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 3e6); ridimensiona();",
      "scene = new THREE.Scene(); if (VISTA3D.ambiente) VISTA3D.ambiente(renderer, cfg.ora === \"notte\"); camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 3e6); ridimensiona();")
# detailed procedural model while the GLB loads
patch("js/volo.js",
      "att.add(VISTA3D.jetFallback(col != null ? col : 0x6b7280)); VISTA3D.modelloPromise(icona, col, { tipoId, numero, callsign: numero }).then(m => {",
      "att.add(VISTA3D.jetFallback(col != null ? col : 0x6b7280)); if (VISTA3D.modelloProcedurale) VISTA3D.modelloProcedurale(icona, col, { tipoId, numero, callsign: numero }).then(m => { if (!S || g.userData.mdl || !m) return; while (att.children.length) att.remove(att.children[0]); att.add(m); }).catch(() => {}); VISTA3D.modelloPromise(icona, col, { tipoId, numero, callsign: numero }).then(m => {")
# preload GLBs as soon as the Free Flight menu opens
patch("js/volo.js", "function apri() {",
      "function apri() { try { if (VISTA3D.precarica) VISTA3D.precarica([pref().aereo, \"SU35\", \"SU57\"]); } catch (e) {}")
# chase camera (after patch_cockpit's horizon-stabilized version): keep the world-up horizon,
# but smooth only the offset direction, so the camera no longer falls ~50 m behind at speed.
patch("js/volo.js",
      "_cp.copy(P.pos).addScaledVector(_fwd, -28).add(V3(0, 8, 0));\n    camera.position.lerp(_cp, Math.min(1, dt * 5));",
      "_cp.set(0, 0, 0).addScaledVector(_fwd, -28).add(V3(0, 8, 0)); if (!S.chaseOff) S.chaseOff = _cp.clone(); S.chaseOff.lerp(_cp, Math.min(1, dt * 5)); camera.position.copy(P.pos).add(S.chaseOff);")

# ---- mondo3d.js (mission 3D view, chase "insegui") ----
patch("js/mondo3d.js",
      "scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 2, 3e6);",
      "scene = new THREE.Scene(); if (VISTA3D.ambiente) VISTA3D.ambiente(renderer, false); camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 2, 3e6);")

# ---- index.html: GLTFLoader with the page (no extra round trip before the first GLB) ----
idx = root / "index.html"
html = idx.read_text(encoding="utf-8")
tag = '<script src="vendor/GLTFLoader.js"></script>'
if tag not in html:
    anchor = '<script src="js/vista3d.js"></script>'
    if anchor not in html:
        raise RuntimeError("index.html: vista3d.js anchor missing")
    html = html.replace(anchor, tag + "\n" + anchor, 1)
    idx.write_text(html, encoding="utf-8")
print("CENTURION2 render: PBR environment, GLB preload, procedural model while loading, locked chase camera")
