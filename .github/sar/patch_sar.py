#!/usr/bin/env python3
"""CENTURION · missione di Personnel Recovery con gli STOS (Accademia, modulo «Soccorso»).

Copia js/soccorso.js (mondo della missione, radiogoniometro del radiofaro, filmati di schianto e recupero) e prepara
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
