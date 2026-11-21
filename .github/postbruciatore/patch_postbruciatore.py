#!/usr/bin/env python3
"""CENTURION · postbruciatore realistico su tutti i jet (volo libero, Mondo 3D, viste 3D, filmati).

Prima la fiamma era un cono arancione pieno (modelli glTF: e solo se il manifest indicava gli ugelli, cosa che non
fa) e nel volo libero una scia di sfere di luce emesse 9 m dietro il baricentro: da dietro si vedeva una palla
bianca, non una fiamma. Ora js/postbruciatore.js mette su ogni ugello, misurato sui modelli, una fiamma
volumetrica (nucleo, involucro, diamanti d'urto), il bagliore dell'ugello e un alone, aggiornati dalla manetta.

Modifica: index.html (carica il modulo), js/vista3d.js (fiamme sui modelli glTF), js/modelli3d.js (fiamme sui
modelli procedurali), js/volo.js (niente più sfere di luce; la spinta militare arriva al modello per il bagliore
dell'ugello). Si ferma con errore se le ancore cambiano.
"""
from pathlib import Path
import shutil
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "extracted/site")
qui = Path(__file__).resolve().parent
shutil.copyfile(qui / "postbruciatore.js", root / "js" / "postbruciatore.js")


def modifica(nome, cambi, segno):
    p = root / nome
    s = p.read_text(encoding="utf-8")
    if segno in s:
        return False
    for vecchio, nuovo in cambi:
        n = s.count(vecchio)
        if n != 1:
            raise RuntimeError(f"{nome}: ancora non trovata o non unica ({n}): {vecchio[:90]}")
        s = s.replace(vecchio, nuovo, 1)
    p.write_text(s, encoding="utf-8")
    return True


# pagina: il modulo prima dei modelli
modifica("index.html", [
    ('<script src="js/modelli3d.js"></script>', '<script src="js/postbruciatore.js"></script>\n<script src="js/modelli3d.js"></script>'),
], 'src="js/postbruciatore.js"')

# modelli glTF: fiamme sugli ugelli misurati (o su quelli del manifest, se presenti)
modifica("js/vista3d.js", [
    ("const fiamme = (m.ugelli || []).map(u => {",
     'const fiamme = typeof POSTBRUCIATORE !== "undefined" ? POSTBRUCIATORE.monta(wrap, tipo, m) : (m.ugelli || []).map(u => {'),
    ("wrap.userData.anim = st => { const ab = st.afterburner || 0; fiamme.forEach(f => {",
     'wrap.userData.anim = st => { if (typeof POSTBRUCIATORE !== "undefined") { POSTBRUCIATORE.anima(fiamme, st); return; } const ab = st.afterburner || 0; fiamme.forEach(f => {'),
], "POSTBRUCIATORE.monta(")

# modelli procedurali (anche durante il caricamento dei glTF): stessa fiamma, nella posizione del loro ugello
modifica("js/modelli3d.js", [
    ("  function fiamma(r, M) {\n",
     '  function fiamma(r, M) {\n    if (typeof POSTBRUCIATORE !== "undefined") { const P = POSTBRUCIATORE.crea({ rx: r * 0.84 }); P.userData.diamanti = []; return P; }\n'),
    ("F.visible = ab > 0.05; F.scale.z = (0.3 + ab * 0.95) * fl; mt.fiamma.opacity = 0.3 + 0.45 * ab; mt.nucleo.opacity = 0.5 + 0.4 * ab;",
     "if (F.userData.postbruciatore) POSTBRUCIATORE.anima(F, s); else { F.visible = ab > 0.05; F.scale.z = (0.3 + ab * 0.95) * fl; mt.fiamma.opacity = 0.3 + 0.45 * ab; mt.nucleo.opacity = 0.5 + 0.4 * ab; }"),
], "F.userData.postbruciatore")

# volo libero: via le sfere di luce dietro l'aereo; al modello arrivano anche la spinta militare e lo stato del motore
modifica("js/volo.js", [
    ('if (P.vivo && P.ab > 0.3 && S.cam !== "cockpit" && (S.abT = (S.abT || 0) - dtR) <= 0) {',
     'if (typeof POSTBRUCIATORE === "undefined" && P.vivo && P.ab > 0.3 && S.cam !== "cockpit" && (S.abT = (S.abT || 0) - dtR) <= 0) {'),
    ("afterburner:P.ab,t:S.t}", "afterburner:P.vivo?P.ab:0,spinta:P.vivo&&P.fuel>0?P.spinta:0,t:S.t}"),
], 'typeof POSTBRUCIATORE === "undefined" && P.vivo')

print("POSTBRUCIATORE: fiamme volumetriche sugli ugelli di " + ", ".join(sorted(
    k for k in ("F16", "F2000", "F15", "F22", "SU35", "SU57", "EA18")
    if f"{k}:" in (root / "js" / "postbruciatore.js").read_text(encoding="utf-8"))) + " e dei modelli procedurali")
