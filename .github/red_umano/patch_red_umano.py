#!/usr/bin/env python3
"""Squadra ROSSA giocata da un umano (hot-seat, stessa schermata).

- scenario_default.js: nuova regola `red_umano` (default false).
- engine.js: quando `red_umano` e il lato e RED, niente auto-decollo delle CAP
  e niente auto-scramble; la ROSSA si muove solo sugli ordini dell'umano
  (scramble / CAP / RTB, comandi gia non ristretti al lato). In volo i caccia
  continuano a difendersi da soli: la risoluzione del combattimento non cambia.
- ui.js: interruttore nel briefing, mostrato solo al TRAINER.
- js/red_umano.js: markup dell'interruttore e lettura del cambiamento.

Nessun modello nuovo e nessuna rete: solo IA e interfaccia. Idempotente.
"""
from pathlib import Path
import shutil
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "extracted/site")
here = Path(__file__).resolve().parent
js = root / "js"


def patch(fn, old, new, marker, nome):
    p = js / fn
    s = p.read_text(encoding="utf-8")
    if marker in s:
        return  # gia applicata
    if old not in s:
        raise RuntimeError(f"{nome}: testo da sostituire non trovato in {fn}")
    p.write_text(s.replace(old, new, 1), encoding="utf-8")


# 1) regola di default
patch(
    "scenario_default.js",
    "  regole: {\n",
    "  regole: {\n    red_umano: false,          // ROSSA controllata da un umano (hot-seat): spegne auto-decollo e auto-scramble della ROSSA\n",
    "red_umano: false",
    "scenario_default.js regole",
)

# 2) engine: gate auto-decollo CAP della ROSSA
patch(
    "engine.js",
    "    } else { // RED: schedule CAP\n",
    "    } else { // RED: schedule CAP\n      if (this.sc.regole && this.sc.regole.red_umano) return;   // ROSSA umana (hot-seat): nessun decollo CAP automatico\n",
    "nessun decollo CAP automatico",
    "engine.js schedule CAP",
)

# 3) engine: gate auto-scramble della ROSSA
patch(
    "engine.js",
    "    if (nemici.length === 0 && !f.scramble) return;\n",
    '    const autoScramble = !(f.lato === "RED" && this.sc.regole && this.sc.regole.red_umano);   // ROSSA umana: niente scramble automatico\n    if (!f.scramble && !(autoScramble && nemici.length > 0)) return;\n',
    "autoScramble",
    "engine.js prontezza",
)

# 4) ui: interruttore nel briefing (solo TRAINER)
patch(
    "ui.js",
    "passa alla fase 2 per costruire il piano.</div>",
    'passa alla fase 2 per costruire il piano.</div>${APP.ruolo === "TRAINER" && typeof REDUMANO_TOGGLE === "function" ? REDUMANO_TOGGLE(sc) : ""}',
    "REDUMANO_TOGGLE",
    "ui.js briefing",
)

# 5) script globale + tag
shutil.copyfile(here / "red_umano.js", js / "red_umano.js")
idx = root / "index.html"
html = idx.read_text(encoding="utf-8")
tag = '<script src="js/red_umano.js"></script>'
if tag not in html:
    anchor = '<script src="js/app.js"></script>'
    if anchor not in html:
        raise RuntimeError("index.html: tag di app.js non trovato")
    idx.write_text(html.replace(anchor, anchor + "\n" + tag, 1), encoding="utf-8")

# post-condizioni
eng = (js / "engine.js").read_text(encoding="utf-8")
assert "nessun decollo CAP automatico" in eng and "autoScramble" in eng, "engine.js: gate non applicati"
assert "red_umano: false" in (js / "scenario_default.js").read_text(encoding="utf-8"), "scenario_default.js: regola assente"
assert "REDUMANO_TOGGLE" in (js / "ui.js").read_text(encoding="utf-8"), "ui.js: interruttore assente"
assert (js / "red_umano.js").is_file(), "js/red_umano.js mancante"
print("patch_red_umano: regola, gate motore, interruttore briefing e script applicati")
