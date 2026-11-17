#!/usr/bin/env python3
"""CENTURION CADET · Accademia di volo: installa js/accademia.js e aggiunge al Free Flight (js/volo.js)
quattro agganci usati solo quando una lezione è in corso (S.lezione):

- un richiamo per fotogramma dopo la fisica e l'IA nemica (controlli della lezione);
- una guida per i singoli nemici (traiettoria della lezione al posto dell'inseguimento, se non sono minacciati);
- funzioni interne esposte all'accademia (lancio, assetto, messaggi, quote del terreno);
- la fine del volo (schianto, abbattimento) passa alla lezione invece del menu del Free Flight.

Va eseguito DOPO tutte le altre patch di volo.js: le ancore sono quelle del file finale.
"""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "extracted/site")
here = Path(__file__).resolve().parent


def patch(rel, old, new, marker):
    p = root / rel
    s = p.read_text(encoding="utf-8")
    if marker in s:
        return
    if s.count(old) != 1:
        raise RuntimeError(f"{rel}: ancora Accademia non trovata o non unica ({s.count(old)}): {old[:100]}")
    p.write_text(s.replace(old, new, 1), encoding="utf-8")


(root / "js" / "accademia.js").write_bytes((here / "accademia.js").read_bytes())
idx = root / "index.html"
html = idx.read_text(encoding="utf-8")
tag = '<script src="js/accademia.js"></script>'
if tag not in html:
    anchor = '<script src="js/cadet.js"></script>'
    if anchor not in html:
        raise RuntimeError("index.html: cadet.js non caricato, l'accademia va dopo di lui")
    html = html.replace(anchor, anchor + "\n" + tag, 1)
    idx.write_text(html, encoding="utf-8")

V = "js/volo.js"
# 1) richiamo della lezione a ogni fotogramma (solo con la simulazione in corso)
patch(V, "S.t += dtR; aggiornaSonic(dtR); aggiornaNemici(dtR);",
      "S.t += dtR; aggiornaSonic(dtR); aggiornaNemici(dtR); if (S.lezione && S.lezione.tick) { try { S.lezione.tick(dtR, S); } catch (err) { console.warn(\"Accademia\", err); } }",
      "S.lezione.tick(dtR, S)")
# 2) guida dei nemici scelta dalla lezione (se non stanno evitando un missile)
patch(V, 'else { e.stato = "pattuglia"; const c = V3().subVectors(e.casa, e.pos); hdgDes = c.length() > 15000 ? Math.atan2(c.x, -c.z) : e.hdg + 0.15; altDes = e.casa.y; }',
      'else { e.stato = "pattuglia"; const c = V3().subVectors(e.casa, e.pos); hdgDes = c.length() > 15000 ? Math.atan2(c.x, -c.z) : e.hdg + 0.15; altDes = e.casa.y; }\n'
      '      if (typeof e.guida === "function" && !minacce.length) { const gd = e.guida(e, { dist, P, S }); if (gd) { if (gd.hdg != null) hdgDes = gd.hdg; if (gd.alt != null) altDes = gd.alt; if (gd.v != null) vDes = gd.v; if (gd.g != null) gLim = gd.g; if (gd.stato) e.stato = gd.stato; } }',
      "typeof e.guida === \"function\"")
# 3) funzioni interne per l'accademia
patch(V, "return { apri, chiudi, AEREI, ARMI, simula, fotografia,",
      "return { _acc: { lancia: (t, da, b) => lancia(t, da, b), assetto: (h, p, r) => quatDaAssetto(h, p, r), messaggio: (t, d, c) => messaggio(t, d, c), suolo: (x, z) => quotaSuolo(x, z), dlz: (a, r, vc) => dlz(a, r, vc), avvisoMissile: da => avvisoMissile(da) }, apri, chiudi, AEREI, ARMI, simula, fotografia,",
      "_acc: { lancia:")
# 4) fine del volo durante una lezione: decide la lezione (niente menu del Free Flight)
patch(V, 'S.pausa = true; const m = ov.querySelector("#vl-menu"); S.menu = true; const st = S.stats;',
      'if (S.lezione && S.lezione.fine) { S.pausa = true; try { S.lezione.fine(titolo, motivo); } catch (err) { console.warn("Accademia", err); } return; } S.pausa = true; const m = ov.querySelector("#vl-menu"); S.menu = true; const st = S.stats;',
      "S.lezione.fine(titolo, motivo)")
print("Accademia di volo: lezioni del Cadetto installate (js/accademia.js e agganci in js/volo.js)")
