#!/usr/bin/env python3
"""Missione Veneto «LAGUNA QRA»: installa js/veneto.js e js/veneto_cine.js e aggancia Mondo 3D e modelli.

- index.html: i due script in fondo alla pagina (dopo app.js e missioni.js: la missione si registra da sola);
- mondo3d.js: sei agganci (avvio della scena, aggiornamento per fotogramma, elenco telecamere, gruppo,
  punto seguito dalle telecamere, chiusura) usati solo quando lo scenario ha `sc.veneto`;
- modelli3d.js: tipo procedurale A330 civile (livrea di una compagnia inventata, senza coccarde,
  braccio di rifornimento e pod), derivato dal KC-30 già presente.
"""
from pathlib import Path
import shutil
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "extracted/site")
here = Path(__file__).resolve().parent


def patch(rel, old, new, marker):
    p = root / rel
    s = p.read_text(encoding="utf-8")
    if marker in s:
        return
    if s.count(old) != 1:
        raise RuntimeError(f"{rel}: ancora Veneto non trovata o non unica: {old[:90]}")
    p.write_text(s.replace(old, new, 1), encoding="utf-8")


for f in ("veneto.js", "veneto_cine.js"):
    shutil.copyfile(here / f, root / "js" / f)
idx = root / "index.html"
html = idx.read_text(encoding="utf-8")
tags = '<script src="js/veneto.js"></script>\n<script src="js/veneto_cine.js"></script>'
if 'js/veneto.js' not in html:
    if "</body>" not in html:
        raise RuntimeError("index.html: </body> mancante")
    html = html.replace("</body>", tags + "\n</body>", 1)
    idx.write_text(html, encoding="utf-8")

# ---- mondo3d.js ----
M = "js/mondo3d.js"
patch(M, "terreno(root); statici();",
      "terreno(root); statici(); st.veneto = (typeof VENETO !== \"undefined\" && VENETO.mondo3d) ? VENETO.mondo3d({ scene, st, toXZ, elev, label, matStd, TERRA, lonLatToTile, camera, renderer }) : null;",
      "VENETO.mondo3d({")
patch(M, "aggiornaEntita(now); eventi(now);",
      "aggiornaEntita(now); eventi(now); if (st.veneto) { try { st.veneto.tick(dt, now); } catch (e) { console.warn(\"Veneto 3D\", e); } }",
      "st.veneto.tick(dt, now)")
patch(M, "(st.aux || []).forEach(a => list.push({ f: a, i: 0, aux: true }));",
      "(st.aux || []).forEach(a => list.push({ f: a, i: 0, aux: true })); if (st.veneto) st.veneto.lista().forEach(x => list.push(x));",
      "st.veneto.lista()")
patch(M, "if (aux) { const k = ", "if (aux) { const k = f.gruppo ? f.gruppo : ", "const k = f.gruppo ? f.gruppo : ")
patch(M, "function selDisp() {", "function selDisp() { if (st.veneto) { const dv = st.veneto.disp(st.sel); if (dv) return dv; }", "st.veneto.disp(st.sel)")
patch(M, "cancelAnimationFrame(raf); clearTimeout(raf);",
      "cancelAnimationFrame(raf); clearTimeout(raf); if (st && st.veneto) { try { st.veneto.dispose(); } catch (e) {} st.veneto = null; }",
      "st.veneto.dispose()")

# ---- modelli3d.js: A330 civile ----
D = "js/modelli3d.js"
patch(D, "TIPI.F16b = TIPI.F16; TIPI.TYPHOON = TIPI.F2000;",
      "TIPI.F16b = TIPI.F16; TIPI.TYPHOON = TIPI.F2000;\n"
      "  // Airbus A330 civile (missione Veneto): struttura del KC-30, senza braccio e pod di rifornimento, livrea di una compagnia inventata\n"
      "  TIPI.A330 = Object.assign({}, TIPI.KC30, { nome: \"Airbus A330-200\", col: 0xf3f5f7, boom: null, podAla: null, numero: \"I-LGNA\", civile: { titolo: \"LAGUNA AIR\" } });",
      "TIPI.A330 = ")
patch(D, "  function texDeriva(col, numero, rosso, stealth) {",
      """  function texCodaCivile(numero) {   // deriva di «Laguna Air» (inventata): blu notte, sole d'oro, onde della laguna
    const key = "civ" + numero; if (texCache[key]) return texCache[key];
    const c = tela(256), g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, "#0b2549"); gr.addColorStop(1, "#163f73"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#e8b84a"; g.beginPath(); g.arc(120, 78, 30, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#f4f6f8"; g.lineWidth = 7; for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = 30; x <= 226; x += 4) g.lineTo(x, 132 + k * 22 + Math.sin(x / 18 + k) * 6); g.stroke(); }
    g.fillStyle = "#e8b84a"; g.font = "bold 30px Arial"; g.textAlign = "center"; g.fillText("LAGUNA", 128, 228);
    return (texCache[key] = texDa(c));
  }
  function texDeriva(col, numero, rosso, stealth) {""",
      "function texCodaCivile(")
patch(D, "const matFin = new THREE.MeshStandardMaterial({ map: texDeriva(col, numero, rosso, p.stealth), roughness: 0.55, metalness: 0.3 })",
      "const matFin = new THREE.MeshStandardMaterial({ map: p.civile ? texCodaCivile(numero) : texDeriva(col, numero, rosso, p.stealth), roughness: 0.55, metalness: 0.3 })",
      "p.civile ? texCodaCivile(numero)")
patch(D, "decalAla(g, p.ala, 0.72, matIns.map, 2.6, matIns); decalFus(g, p.fus, p.ins, matIns.map, 1.9, 0.2, matIns);",
      "if (!p.civile) { decalAla(g, p.ala, 0.72, matIns.map, 2.6, matIns); decalFus(g, p.fus, p.ins, matIns.map, 1.9, 0.2, matIns); }\n"
      "    else { const tinta = colore => { const c = tela(8, 8), x = c.getContext(\"2d\"); x.fillStyle = colore; x.fillRect(0, 0, 8, 8); return matDecal(texDa(c)); };   // pancia blu e filetto d'oro sotto i finestrini\n"
      "      g.add(fascia(p.fus, 26.6, -26.0, Math.PI + 0.55, 2 * Math.PI - 0.55, 1.004, tinta(\"#163f73\"))); const oro = tinta(\"#d9a93a\"); g.add(fascia(p.fus, 25.0, -24.0, -0.30, -0.22, 1.0035, oro)); g.add(fascia(p.fus, 25.0, -24.0, Math.PI + 0.22, Math.PI + 0.30, 1.0035, oro)); }",
      "if (!p.civile) { decalAla(")
patch(D, 'texTesto(rosso ? "ВВС РОССИИ" : "AERONAUTICA MILITARE", 512, 48, "rgba(25,30,40,0.9)")',
      'texTesto(p.civile ? p.civile.titolo : (rosso ? "ВВС РОССИИ" : "AERONAUTICA MILITARE"), 512, 48, p.civile ? "rgba(16,48,92,0.95)" : "rgba(25,30,40,0.9)")',
      "p.civile ? p.civile.titolo")
print("Veneto: missione LAGUNA QRA, Mondo 3D e A330 civile installati")
