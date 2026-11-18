#!/usr/bin/env python3
"""CENTURION · pod di designazione: segue sullo schermo i Maverick lanciati nel volo libero.

Prima il pod restava sempre puntato sul punto designato (SPI): il missile entrava nell'immagine
solo all'ultimo istante. Ora, finché un'arma aria-suolo del giocatore è in volo, la telecamera del
pod inquadra il missile (campo regolato per mostrare circa 120 m di scena attorno a lui, con gli angoli di tracciamento) e, negli
ultimi 3,5 secondi prima dell'impatto, torna dolcemente sul bersaglio per mostrare l'esplosione.
Durante l'inseguimento il display indica WPN al posto del modo di tracciamento e, nell'infrarosso,
il missile ha una firma termica (motore e attrito) su una copia del suo materiale. Se il pilota
sposta il pod a mano (RATES) l'inseguimento si interrompe.

Modifica solo js/pod.js (dall'archivio del sito); si ferma con errore se le ancore cambiano.
"""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "extracted/site")
p = root / "js" / "pod.js"
s = p.read_text(encoding="utf-8")
MARK = "function seguiArma(dt, campoDeg)"
if MARK in s:
    print("POD: inseguimento delle armi già presente"); sys.exit(0)


def rep(old, new):
    global s
    n = s.count(old)
    if n != 1:
        raise RuntimeError(f"pod.js: ancora non trovata o non unica ({n}): {old[:90]}")
    s = s.replace(old, new, 1)


# 1) funzione di inseguimento, subito prima del rendering del pod
rep("  function rendi(ho, dt) {",
    """  // il Maverick in volo è caldo (motore e attrito dell'aria): una copia del materiale del corpo entra fra i termici del pod
  function caldoArma(a) {
    if (!S.seguiMesh) S.seguiMesh = new WeakMap();
    if (S.seguiMesh.has(a.pos)) return;
    let g = null;
    H.scene().traverse(o => { if (!g && o.isGroup && o.position.distanceToSquared(a.pos) < 0.01 && o.children.some(c => c.isMesh && c.geometry && c.geometry.type === "CylinderGeometry")) g = o; });
    S.seguiMesh.set(a.pos, g);
    if (g) g.children.forEach(c => { if (c.isMesh && c.material && !Array.isArray(c.material) && c.material.emissive) { c.material = c.material.clone(); c.material.userData.calore = 1; TERMICI.add(c.material); } });
  }
  // dopo il lancio di un Maverick il pod inquadra il missile in volo e torna sul bersaglio negli ultimi secondi (impatto)
  function seguiArma(dt, campoDeg) {
    let arma = null;   // l'arma più vicina all'impatto; negli ultimi 3,5 s si guarda il bersaglio (anche con altre armi in volo)
    if (S.track !== "RATES") (H.armiInVolo ? H.armiInVolo() : []).forEach(a => {
      if (!a.bersaglio || !a.bersaglio.pos) return;
      const t = a.pos.distanceTo(a.bersaglio.pos) / Math.max(50, a.vel.length());
      if (!arma || t < arma.t) arma = { a, t };
    });
    if (arma && arma.t <= 3.5) arma = null;
    S.seguiK = clamp((S.seguiK || 0) + (arma ? 2.5 : -2.5) * dt, 0, 1);
    if (arma) { try { caldoArma(arma.a); } catch (e) {} S.seguiP = arma.a.pos.clone(); }   // sul missile, senza ritardo: la dolcezza sta solo nel passaggio missile ↔ bersaglio
    if (S.seguiK <= 0 || !S.seguiP) { S.seguiGuarda = null; if (S.seguiK <= 0) S.seguiP = null; return campoDeg; }
    const k = S.seguiK * S.seguiK * (3 - 2 * S.seguiK);
    S.seguiGuarda = S.spi.clone().lerp(S.seguiP, k);
    const fovArma = clamp(2 * Math.atan(60 / Math.max(30, S.pos.distanceTo(S.seguiP))) * R2D, 0.35, 12);   // circa 120 m di scena attorno al missile
    return campoDeg + (fovArma - campoDeg) * k;
  }
  function rendi(ho, dt) {""")
# 2) campo e direzione della telecamera
rep("cam.fov = 2 * Math.atan(Math.tan(campo.deg * D2R / 2) / Math.max(1, asp)) * R2D;",
    "const campoVis = seguiArma(dt, campo.deg); cam.fov = 2 * Math.atan(Math.tan(campoVis * D2R / 2) / Math.max(1, asp)) * R2D;")
rep("cam.lookAt(S.spi);", "cam.lookAt(S.seguiGuarda || S.spi);")
# 3) simbologia: WPN durante l'inseguimento
rep('testo(S.track === "INR" ? "INR" : S.track, W - 10 * s, 32 * s, "right", 11, S.track === "POINT");',
    'testo(S.seguiK > 0.5 ? "WPN" : S.track === "INR" ? "INR" : S.track, W - 10 * s, 32 * s, "right", 11, S.track === "POINT" || S.seguiK > 0.5);')
# 4) angoli di tracciamento attorno al missile, come per un bersaglio inseguito
rep('if (S.track === "POINT" || S.track === "INR") { const b = 13 * s, c = 5 * s;',
    'if (S.track === "POINT" || S.track === "INR" || S.seguiK > 0.5) { const b = 13 * s, c = 5 * s;')
p.write_text(s, encoding="utf-8")
print("POD: il pod segue i Maverick lanciati e torna sul bersaglio prima dell'impatto")
