#!/usr/bin/env python3
"""CENTURION · pod di designazione: i Maverick lanciati nel volo libero si vedono sullo schermo del pod.

Prima il pod restava sul punto designato (SPI) con il campo scelto dal pilota: il missile entrava
nell'immagine solo all'ultimo istante e, visto da dietro dall'aereo che lo lancia, era più piccolo
di un pixel. Ora, finché un'arma aria-suolo del giocatore è in volo:

- il reticolo resta sul bersaglio, come in un pod vero, ma il campo si allarga quanto serve a
  includere il missile (fino a 24°) e si stringe da solo man mano che si avvicina, tornando al
  campo del pilota per l'impatto; in alto il display indica «WPN» con l'ampiezza del campo;
- il missile appare come un punto caldo (ugello e attrito dell'aria), di dimensione costante
  sullo schermo: chiaro nell'infrarosso, scuro in TV; esiste solo nell'immagine del pod;
- gli angoli di tracciamento stanno sulla posizione vera del missile nell'immagine, con i secondi
  all'impatto; se il missile è fuori campo una freccia sul bordo indica dove si trova.

Se il pilota sposta il pod a mano (RATES) il campo resta il suo.
Modifica solo js/pod.js (dall'archivio del sito); si ferma con errore se le ancore cambiano.
"""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "extracted/site")
p = root / "js" / "pod.js"
s = p.read_text(encoding="utf-8")
MARK = "function seguiArma(dt, campoDeg, asp)"
if MARK in s:
    print("POD: armi in volo già visibili nel pod"); sys.exit(0)


def rep(old, new):
    global s
    n = s.count(old)
    if n != 1:
        raise RuntimeError(f"pod.js: ancora non trovata o non unica ({n}): {old[:90]}")
    s = s.replace(old, new, 1)


# 1) funzioni: armi in volo, campo automatico, punto caldo del missile, posizione sullo schermo
rep("  function rendi(ho, dt) {",
    """  // ---------- armi del volo libero sullo schermo del pod ----------
  // gruppo 3D del missile (una volta sola): il corpo diventa caldo anche da vicino
  function gruppoArma(a) {
    if (!S.wpnGruppi) S.wpnGruppi = new WeakMap();
    if (S.wpnGruppi.has(a.pos)) return S.wpnGruppi.get(a.pos);
    let g = null;
    H.scene().traverse(o => { if (!g && o.isGroup && o.position.distanceToSquared(a.pos) < 0.01 && o.children.some(c => c.isMesh && c.geometry && c.geometry.type === "CylinderGeometry")) g = o; });
    S.wpnGruppi.set(a.pos, g);
    if (g) g.children.forEach(c => { if (c.isMesh && c.material && !Array.isArray(c.material) && c.material.emissive) { c.material = c.material.clone(); c.material.userData.calore = 1; TERMICI.add(c.material); } });
    return g;
  }
  // campo che include le armi in volo con il reticolo sempre sul bersaglio: si allarga quanto serve e si stringe da solo fino all'impatto
  function seguiArma(dt, campoDeg, asp) {
    const armi = [];
    (H.armiInVolo ? H.armiInVolo() : []).forEach(a => { if (a.bersaglio && a.bersaglio.pos) armi.push({ a, t: a.pos.distanceTo(a.bersaglio.pos) / Math.max(50, a.vel.length()) }); });
    S.wpn = armi;
    if (!armi.length && (S.campoWpn == null || S.campoWpn <= campoDeg * 1.02)) { S.campoWpn = campoDeg; S.wpnAuto = false; return campoDeg; }
    let voluto = campoDeg;
    if (armi.length && S.track !== "RATES") {
      let th = 0;
      armi.forEach(w => { const u = w.a.pos.clone().sub(S.pos); if (u.lengthSq() > 1) th = Math.max(th, u.normalize().angleTo(S.dir)); });
      const k = asp >= 1 ? asp : 1 / Math.max(0.2, asp);
      voluto = clamp(2 * Math.atan(Math.tan(Math.min(th * 1.3, 1.2)) * k) * R2D, campoDeg, 24);
    }
    const prima = S.campoWpn == null ? campoDeg : S.campoWpn;
    S.campoWpn = prima + (voluto - prima) * Math.min(1, dt * (voluto > prima ? 4 : 2.2));
    S.wpnAuto = S.campoWpn > campoDeg * 1.05 + 0.02;
    return S.campoWpn;
  }
  // il missile come punto caldo di dimensione costante, solo durante il disegno del pod
  let TEX_PUNTO = null;
  function texPunto() {
    if (TEX_PUNTO) return TEX_PUNTO;
    const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d");
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,0.85)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    TEX_PUNTO = new THREE.CanvasTexture(c); return TEX_PUNTO;
  }
  function puntiArma(on, cam, hPx, ir) {
    if (!S.wpnPunti) S.wpnPunti = new Map();
    if (!on) { S.wpnPunti.forEach(sp => { sp.visible = false; }); return; }
    const vivi = new Set();
    (S.wpn || []).forEach(w => {
      let sp = S.wpnPunti.get(w.a.pos);
      if (!sp) { const g = gruppoArma(w.a); if (!g) return; sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPunto(), color: 0xffffff, sizeAttenuation: false, depthWrite: false, fog: false, transparent: true })); sp.visible = false; g.add(sp); S.wpnPunti.set(w.a.pos, sp); }
      vivi.add(w.a.pos);
      const ang = (ir ? 6 : 3.5) / Math.max(64, hPx) * cam.fov * D2R;
      sp.scale.set(ang, ang, 1); sp.material.color.setHex(ir ? 0xffffff : 0x262626); sp.visible = true;
    });
    S.wpnPunti.forEach((sp, k) => { if (!vivi.has(k)) { sp.visible = false; if (!sp.parent || !sp.parent.parent) S.wpnPunti.delete(k); } });
  }
  // posizione delle armi nell'immagine del pod (coordinate normalizzate), o direzione verso il bordo se sono fuori campo
  function armiSulloSchermo(cam) {
    S.armiVis = [];
    if (!S.wpn || !S.wpn.length) return;
    const inv = cam.quaternion.clone().invert();
    S.wpn.forEach(w => {
      const v = w.a.pos.clone().project(cam), d = w.a.pos.clone().sub(cam.position).applyQuaternion(inv);
      const dentro = d.z < 0 && Math.abs(v.x) <= 0.97 && Math.abs(v.y) <= 0.97;
      let x = v.x, y = v.y;
      if (!dentro) { const m = Math.max(Math.abs(d.x), Math.abs(d.y), 1e-6); x = d.x / m * 0.9; y = d.y / m * 0.9; }
      S.armiVis.push({ x, y, dentro, t: w.t });
    });
  }
  function rendi(ho, dt) {""")
# 2) campo automatico
rep("cam.fov = 2 * Math.atan(Math.tan(campo.deg * D2R / 2) / Math.max(1, asp)) * R2D;",
    "const campoVis = seguiArma(dt, campo.deg, asp); cam.fov = 2 * Math.atan(Math.tan(campoVis * D2R / 2) / Math.max(1, asp)) * R2D;")
# 3) posizione delle armi nell'immagine, con la telecamera già orientata
rep("cam.updateProjectionMatrix(); cam.updateMatrixWorld();",
    "cam.updateProjectionMatrix(); cam.updateMatrixWorld(); armiSulloSchermo(cam);")
# 4) punto caldo del missile solo nel disegno del pod
rep("rend.setRenderTarget(res.rt); rend.clear(); rend.render(sc, cam); }",
    "rend.setRenderTarget(res.rt); rend.clear(); puntiArma(true, cam, h, ir); rend.render(sc, cam); }")
rep("finally { ripristina(); }", "finally { puntiArma(false); ripristina(); }")
# 5) simbologia: angoli sul missile (o freccia sul bordo) e WPN con il campo in gradi
rep("    // riga in alto",
    """    // armi in volo: angoli sulla posizione del missile nell'immagine con i secondi all'impatto, freccia sul bordo se è fuori campo
    (S.armiVis || []).forEach(a => {
      const px = (a.x + 1) / 2 * W, py = (1 - a.y) / 2 * Hh - su;
      if (a.dentro) { const b = 9 * s, c = 4 * s;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => linea([[px + sx * b, py + sy * (b - c)], [px + sx * b, py + sy * b], [px + sx * (b - c), py + sy * b]], 1.4));
        testo(String(Math.max(0, Math.round(a.t))), px + b + 4 * s, py - b, "left", 10);
      } else { const r = 6 * s; g.save(); g.translate(px, py); g.rotate(Math.atan2(-a.y, a.x)); g.beginPath(); g.moveTo(r, 0); g.lineTo(-r * 0.7, -r * 0.75); g.lineTo(-r * 0.7, r * 0.75); g.closePath();
        g.lineWidth = 2.4; g.strokeStyle = NE; g.stroke(); g.fillStyle = BI; g.fill(); g.restore(); }
    });
    // riga in alto""")
rep('testo(campo.nome + (campo.exp > 1 ? " EXP" + campo.exp : ""), cx, 16 * s, "center");',
    'testo(S.wpnAuto ? "WPN " + Math.round(S.campoWpn) + "°" : campo.nome + (campo.exp > 1 ? " EXP" + campo.exp : ""), cx, 16 * s, "center", 12, !!S.wpnAuto);')
p.write_text(s, encoding="utf-8")
print("POD: armi in volo visibili nel pod (campo automatico, punto caldo, angoli sul missile)")
