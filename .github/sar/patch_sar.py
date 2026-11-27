#!/usr/bin/env python3
"""CENTURION · missione di Personnel Recovery con gli STOS (Accademia, modulo «Soccorso»).

Copia js/soccorso.js (mondo della missione, navigatore GPS, filmati di schianto e recupero) e prepara
il Free Flight ai filmati girati nel suo mondo 3D:
- la camera può essere guidata da un filmato (S.cineCam) al posto delle inquadrature di gioco;
- il visore si spegne durante i filmati (S.cineHud = false);
- VOLO._int dà accesso a scena, camera, renderer e contenitore della pagina.
Si ferma con errore se le ancore cambiano.
"""
from pathlib import Path
import shutil
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "extracted/site")
qui = Path(__file__).resolve().parent
shutil.copyfile(qui / "soccorso.js", root / "js" / "soccorso.js")


def modifica(nome, cambi, segno):
    p = root / nome
    s = p.read_text(encoding="utf-8")
    if segno in s:
        return
    for vecchio, nuovo in cambi:
        n = s.count(vecchio)
        if n != 1:
            raise RuntimeError(f"{nome}: ancora non trovata o non unica ({n}): {vecchio[:90]}")
        s = s.replace(vecchio, nuovo, 1)
    p.write_text(s, encoding="utf-8")


modifica("index.html", [
    ('<script src="js/accademia.js"></script>', '<script src="js/accademia.js"></script>\n<script src="js/soccorso.js"></script>'),
], 'src="js/soccorso.js"')

modifica("js/volo.js", [
    ("function aggiornaCamera(dt) { if (!cameraSequenza(dt)) aggiornaCameraBase(dt); scossaCamera(dt); }",
     "function aggiornaCamera(dt) { if (S && S.cineCam) { try { S.cineCam(dt, camera); } catch (e) { console.warn(\"filmato\", e); S.cineCam = null; } return; } "
     "if (!cameraSequenza(dt)) aggiornaCameraBase(dt); scossaCamera(dt); }"),
    ("const W = hudC.width, H = hudC.height, g = hud; g.clearRect(0, 0, W, H); if (!S) return;",
     "const W = hudC.width, H = hudC.height, g = hud; g.clearRect(0, 0, W, H); if (!S) return; if (S.cineHud === false) return;"),
    ("return { _acc: {",
     "return { _int: { get scene() { return scene; }, get camera() { return camera; }, get renderer() { return renderer; }, get overlay() { return ov; } }, _acc: {"),
], "S.cineCam")

print("SOCCORSO: missione di Personnel Recovery con gli STOS, filmati nel mondo 3D del Free Flight")

# Visual-only cinematic upgrade; anchors also act as a build-time regression check.
modifica("js/volo.js", [
    ("seg.position.copy(ab); seg.up.copy(su); seg.lookAt(ab.clone().add(avanti)); scene.add(seg);", "// EJECT_CINE_V2: visual seat detail, independent of flight dynamics.\n    const struttura = matStd(0x555b60), imbottitura = matStd(0x25292b);\n    const pezzo = (w,h,d,x,y,z,mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); seg.add(m); };\n    pezzo(0.64,0.12,0.65,0,0.06,0.12,imbottitura);\n    pezzo(0.43,0.36,0.22,0,1.18,-0.23,imbottitura);\n    for (const lato of [-1,1]) {\n      pezzo(0.075,1.35,0.13,lato*0.34,0.48,-0.32,struttura);\n      pezzo(0.085,0.11,0.58,lato*0.35,0.14,0.11,struttura);\n      pezzo(0.13,0.24,0.25,lato*0.23,-0.18,-0.05,struttura);\n    }\n    const drogue = new THREE.Group();\n    const dVela = new THREE.Mesh(new THREE.SphereGeometry(0.55,12,6,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0xd6d4c9,side:THREE.DoubleSide,roughness:0.9}));\n    dVela.position.set(0,2.7,-1.8); drogue.add(dVela);\n    const dLine = new THREE.BufferGeometry().setFromPoints([V3(0,0.95,-0.32),dVela.position]);\n    drogue.add(new THREE.Line(dLine,new THREE.LineBasicMaterial({color:0xcccccc})));\n    drogue.visible = false; seg.add(drogue); seg.userData.ejectDrogue = drogue;\n    seg.position.copy(ab); seg.up.copy(su); seg.lookAt(ab.clone().add(avanti)); scene.add(seg);"),
    ("E.seg.position.copy(E.pos); E.seg.rotateX(-0.9 * dt);", "E.seg.position.copy(E.pos); E.seg.rotateX(-0.9 * dt);\n      const drogue = E.seg.userData.ejectDrogue;\n      if (drogue) { drogue.visible = E.fase === \"seggiolino\"; drogue.children[0].scale.setScalar(Math.min(1, Math.max(0.12, (E.t - 0.75) * 3))); }"),
    ("E.seg.remove(E.pil); E.pil.position.set(0, 0, 0);", "if (E.seg.userData.ejectDrogue) E.seg.userData.ejectDrogue.visible = false;\n        E.seg.remove(E.pil); E.pil.position.set(0, 0, 0);"),
    ("g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0.8 })));", "const linee = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0.8 })); g.add(linee);"),
    ("return { g, vela };", "return { g, vela, linee };"),
    ("E.para.vela.scale.set(0.15 + 0.85 * k, 0.72 * (0.3 + 0.7 * k), 0.15 + 0.85 * k);", "E.para.vela.scale.set(0.15 + 0.85 * k, 0.72 * (0.3 + 0.7 * k), 0.15 + 0.85 * k);\n      const linee = E.para.linee, attr = linee.geometry.attributes.position;\n      for (let i = 0; i < 12; i++) {\n        const a = i / 12 * Math.PI * 2, r = 4.4 * Math.sin(Math.PI * 0.42) * E.para.vela.scale.x;\n        attr.setXYZ(i*2, Math.cos(a)*r, 7.2 + 4.4*Math.cos(Math.PI*0.42)*E.para.vela.scale.y, Math.sin(a)*r);\n      }\n      attr.needsUpdate = true; linee.visible = E.fase === \"paracadute\";"),
    ("camera.up.set(0, 1, 0); camera.fov = 60;", "camera.up.set(0, 1, 0); camera.fov = S.eiez && S.eiez.fase === \"tettuccio\" ? 43 : 60;"),
], "EJECT_CINE_V2")
