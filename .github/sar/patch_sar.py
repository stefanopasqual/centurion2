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

# Cinematic EJECT: visual upgrade on the actual free-flight path.
modifica("js/volo.js", [
    ("    // seggiolino ACES II con il pilota: si muove lungo l'asse verticale dell'aereo\n    const seg = new THREE.Group(); const sed = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.15, 0.65), matStd(0x2f3336)); sed.position.set(0, 0.2, -0.15); seg.add(sed);\n    const pil = new THREE.Group(); const corpo = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.25, 0.95, 10), matStd(0x56653a)); corpo.position.y = 0.62; const casco = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), matStd(0xd9d8cf)); casco.position.y = 1.22; const visiera = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8, 0, Math.PI), matStd(0x1d2a33)); visiera.position.set(0, 1.21, 0.08); pil.add(corpo, casco, visiera); pil.position.z = 0.1; seg.add(pil);\n    seg.position.copy(ab); seg.up.copy(su); seg.lookAt(ab.clone().add(avanti)); scene.add(seg);\n", "    // EJECT_CINE_V3: cinematic game model, not an engineering replica.\n    const seg = new THREE.Group(), metallo = matStd(0x555b60), scuro = matStd(0x25292b), tessuto = matStd(0x454a3b), giallo = matStd(0xd6a928);\n    const box = (w,h,d,x,y,z,m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); o.position.set(x,y,z); seg.add(o); return o; };\n    const cil = (ra,rb,h,x,y,z,m) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(ra,rb,h,12),m); o.position.set(x,y,z); seg.add(o); return o; };\n    const sed = box(.54,1.04,.13,0,.57,-.27,scuro);\n    box(.58,.17,.61,0,.09,.02,tessuto);\n    box(.55,.34,.34,0,1.17,-.27,scuro);\n    box(.49,.30,.34,0,-.12,.02,tessuto);\n    box(.53,.14,.56,0,-.25,-.02,metallo);\n    for (const lato of [-1,1]) {\n      box(.075,1.35,.13,lato*.34,.49,-.33,metallo);\n      box(.15,.31,.30,lato*.26,1.14,-.19,scuro);\n      box(.09,.12,.58,lato*.34,.21,.05,metallo);\n      box(.13,.37,.19,lato*.30,.39,-.19,tessuto);\n      cil(.065,.065,.44,lato*.29,-.12,.02,metallo).rotation.x=Math.PI/2;\n      const imp = new THREE.Mesh(new THREE.TorusGeometry(.065,.012,8,16),giallo); imp.position.set(lato*.26,.24,.29); seg.add(imp);\n    }\n    const pil = new THREE.Group();\n    // Same owner-supplied rig used by the hangar; primitive fallback only for failed asset loads.\n    const corpo = new THREE.Mesh(new THREE.CylinderGeometry(.21,.25,.95,10),tessuto); corpo.position.y=.62;\n    const casco = new THREE.Mesh(new THREE.SphereGeometry(.17,16,12),matStd(0xd9d8cf)); casco.position.y=1.22;\n    pil.add(corpo,casco); pil.position.z=.1; seg.add(pil);\n    const P3 = window.PILOTA3D;\n    if (P3) {\n      const monta = () => { if (pil.parent && P3.veste(pil)) P3.posa(pil, S && S.eiez && S.eiez.pil===pil && S.eiez.fase===\"paracadute\" ? \"appeso\" : \"seggiolino\"); };\n      if (P3.pronto) monta(); else P3.carica().then(monta);\n    }\n    const drogue = new THREE.Group(), dVela = new THREE.Mesh(new THREE.SphereGeometry(.54,24,10,0,Math.PI*2,.13,1.37),new THREE.MeshStandardMaterial({color:0xd6d4c9,side:THREE.DoubleSide,roughness:.92}));\n    dVela.position.set(0,2.7,-1.8); drogue.add(dVela);\n    const dp=[]; for(let i=0;i<12;i++){const a=i*Math.PI/6;dp.push(0,.95,-.32,Math.cos(a)*.53,2.7+.54*Math.cos(1.5),-1.8+Math.sin(a)*.53);}\n    const dLine=new THREE.BufferGeometry(); dLine.setAttribute(\"position\",new THREE.Float32BufferAttribute(dp,3));\n    drogue.add(new THREE.LineSegments(dLine,new THREE.LineBasicMaterial({color:0xd7d4cd})));\n    drogue.visible=false; seg.add(drogue); seg.userData.ejectDrogue=drogue;\n    seg.position.copy(ab); seg.up.copy(su); seg.lookAt(ab.clone().add(avanti)); scene.add(seg);\n"),
    ("  function creaParacadute() {\n    const g = new THREE.Group(); const R = 4.4, th = Math.PI * 0.42, seg = 24;\n    const geo = new THREE.SphereGeometry(R, seg, 8, 0, Math.PI * 2, 0, th); const col = []; const pa = geo.attributes.position;\n    for (let i = 0; i < pa.count; i++) { const a = Math.atan2(pa.getZ(i), pa.getX(i)); const spic = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 12) % 2; const c = new THREE.Color(spic ? 0xf26a1b : 0xf4f1ea); col.push(c.r, c.g, c.b); }\n    geo.setAttribute(\"color\", new THREE.Float32BufferAttribute(col, 3));\n    const vela = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.95 })); vela.scale.y = 0.72; vela.position.y = 7.2; g.add(vela);\n    const lp = []; const rb = R * Math.sin(th), yb = 7.2 + R * Math.cos(th) * 0.72; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; lp.push(Math.cos(a) * rb, yb, Math.sin(a) * rb, 0, 1.45, 0); }\n    const lg = new THREE.BufferGeometry(); lg.setAttribute(\"position\", new THREE.Float32BufferAttribute(lp, 3)); g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0.8 })));\n    return { g, vela };\n  }\n", "  function creaParacadute() {\n    const g=new THREE.Group(), R=4.4, th=Math.PI*.42, panels=24, u=4, v=10;\n    const p=[], col=[], idx=[], rim=[];\n    for(let j=0;j<panels;j++){\n      const offset=p.length/3, c=new THREE.Color(Math.floor(j/2)%2 ? 0xe36b22 : 0xece8dc);\n      for(let y=0;y<=v;y++) for(let x=0;x<=u;x++){\n        const f=x/u, a=(j+f)*Math.PI*2/panels, t=.12+(th-.12)*y/v;\n        const billow=1+.045*Math.sin(Math.PI*f)*Math.sin(t);\n        p.push(R*Math.sin(t)*Math.cos(a)*billow,R*Math.cos(t)*billow,R*Math.sin(t)*Math.sin(a)*billow);\n        const shade=.83+.17*Math.sin(Math.PI*f); col.push(c.r*shade,c.g*shade,c.b*shade);\n        if(y<v&&x<u){const i=offset+y*(u+1)+x;idx.push(i,i+u+1,i+1,i+1,i+u+1,i+u+2);}\n      }\n      const a=j*Math.PI*2/panels; rim.push(V3(R*Math.sin(th)*Math.cos(a),R*Math.cos(th),R*Math.sin(th)*Math.sin(a)));\n    }\n    const geo=new THREE.BufferGeometry();geo.setAttribute(\"position\",new THREE.Float32BufferAttribute(p,3));geo.setAttribute(\"color\",new THREE.Float32BufferAttribute(col,3));geo.setIndex(idx);geo.computeVertexNormals();\n    const vela=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.92}));vela.position.y=7.2;vela.scale.set(.15,.216,.15);g.add(vela);\n    const lg=new THREE.BufferGeometry();lg.setAttribute(\"position\",new THREE.Float32BufferAttribute(new Float32Array(panels*6),3));\n    const linee=new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0xd8d8d8,transparent:true,opacity:.88}));linee.frustumCulled=false;g.add(linee);\n    const aggiornaFuni=()=>{const attr=lg.attributes.position;for(let i=0;i<panels;i++){const r=rim[i];attr.setXYZ(i*2,r.x*vela.scale.x,vela.position.y+r.y*vela.scale.y,r.z*vela.scale.z);attr.setXYZ(i*2+1,r.x<0?-.22:.22,1.43,.03);}attr.needsUpdate=true;};\n    aggiornaFuni();return {g,vela,linee,aggiornaFuni};\n  }\n"),
    ("E.seg.position.copy(E.pos); E.seg.rotateX(-0.9 * dt);", "E.seg.position.copy(E.pos); E.seg.rotateX(-0.9 * dt);\n      const drogue=E.seg.userData.ejectDrogue;\n      if(drogue){drogue.visible=E.fase===\"seggiolino\";const k=Math.min(1,Math.max(.12,(E.t-.75)*3));drogue.children[0].scale.setScalar(k);}"),
    ("E.seg.remove(E.pil); E.pil.position.set(0, 0, 0);", "if(E.seg.userData.ejectDrogue) E.seg.userData.ejectDrogue.visible=false;\n        E.seg.remove(E.pil); E.pil.position.set(0, 0, 0);"),
    ("E.para.vela.scale.set(0.15 + 0.85 * k, 0.72 * (0.3 + 0.7 * k), 0.15 + 0.85 * k);", "E.para.vela.scale.set(0.15 + 0.85 * k, 0.72 * (0.3 + 0.7 * k), 0.15 + 0.85 * k);\n      E.para.aggiornaFuni(); E.para.linee.visible=E.fase===\"paracadute\";"),
    ("dx.clone().multiplyScalar(13).addScaledVector(avanti, -9).add(V3(0, 3.5, 0))", "dx.clone().multiplyScalar(7).addScaledVector(avanti, -4).add(V3(0, 2.2, 0))"),
    ("camera.up.set(0, 1, 0); camera.fov = 60;", "camera.up.set(0, 1, 0); camera.fov = S.eiez && S.eiez.fase === \"tettuccio\" ? 43 : 60;"),
    ("Q.motivo + \" · pilota salvo sotto il paracadute\"", "Q.motivo + (E.fase === \"a terra\" ? \" · pilota a terra\" : \" · pilota sotto il paracadute, atterraggio non ancora verificato\")"),
], "EJECT_CINE_V3")
