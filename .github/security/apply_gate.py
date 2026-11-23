#!/usr/bin/env python3
"""Apply a UI-only password gate to the CENTURION2 GitHub Pages artifact."""
from pathlib import Path
import re
import shutil
import sys

site = Path(sys.argv[1])
index = site / "index.html"
sw = site / "sw.js"
html = index.read_text(encoding="utf-8")
assert "<head>" in html and "<body>" in html and "</body>" in html
assert "data-locked-src" not in html, "Source ZIP already contains a gate; review the workflow"

css = """
<style>
html.password-required #splash, html.password-required #app {display:none !important}
#centurion-gate {position:fixed;inset:0;z-index:2147483647;background:#0b121e;color:#edf3ff;display:flex;justify-content:center;align-items:center;padding:20px;font-family:system-ui,-apple-system,BlinkMacSystemFont,Arial,sans-serif;overflow:auto}
#centurion-gate * {box-sizing:border-box}
#centurion-gate .gate-card {width:100%;max-width:410px;padding:30px 24px;border:1px solid #38506c;border-radius:18px;background:#172234;box-shadow:0 14px 60px #0009}
#centurion-gate h1 {font-size:26px;letter-spacing:1px;margin:0 0 8px}
#centurion-gate p {line-height:1.5;color:#c0ccde}
#centurion-gate label {display:block;margin:20px 0 9px}
#centurion-password {width:100%;padding:14px;border:1px solid #7289a7;border-radius:10px;background:#101a28;color:#fff;font-size:18px;outline-offset:3px}
#centurion-unlock {width:100%;padding:14px;margin-top:16px;border:0;border-radius:10px;background:#53a8ff;color:#071525;font-weight:800;font-size:17px;cursor:pointer;min-height:48px}
#centurion-unlock:disabled {opacity:.6}
#centurion-gate .gate-visibility {display:flex;align-items:center;gap:9px;font-size:14px;margin:10px 0 0}
#centurion-gate .gate-visibility input {width:18px;height:18px}
#centurion-gate-message {min-height:1.5em;font-size:14px}
#centurion-gate {align-items:flex-start}
#centurion-gate .gate-card {margin:auto 0}
#centurion-gate h2 {font-size:17px;margin:22px 0 4px}
#centurion-gate .gate-sep {border:0;border-top:1px solid #38506c;margin:22px 0 0}
#centurion-free {width:100%;padding:14px;margin-top:14px;border:1px solid #6794b4;border-radius:10px;background:#163c59;color:#fff;font-weight:800;font-size:17px;cursor:pointer;min-height:48px}
#centurion-free small {display:block;font-weight:400;font-size:13px;color:#c0ccde}
#centurion-team-password {width:100%;padding:14px;border:1px solid #7289a7;border-radius:10px;background:#101a28;color:#fff;font-size:18px;outline-offset:3px}
#centurion-gate .gate-teams {display:flex;gap:10px;margin:10px 0 0}
#centurion-gate .gate-teams label {flex:1;margin:0;padding:10px;border:1px solid #4b6584;border-radius:10px;text-align:center;font-weight:700;cursor:pointer}
#centurion-gate .gate-teams label:has(input:checked) {background:#1f3a5c;border-color:#8fc3ff}
#centurion-gate .gate-teams label.red:has(input:checked) {background:#5c1f24;border-color:#ff9b9b}
#centurion-gate .gate-teams input {margin-right:6px}
#centurion-main-password {width:100%;padding:14px;border:1px solid #7289a7;border-radius:10px;background:#101a28;color:#fff;font-size:18px;outline-offset:3px}
#centurion-main-form button, #centurion-team-form button, #centurion-password-form button {width:100%;padding:14px;margin-top:12px;border:0;border-radius:10px;background:#53a8ff;color:#071525;font-weight:800;font-size:17px;cursor:pointer;min-height:48px}
</style>
<script>document.documentElement.classList.add("password-required");</script>
"""
form = """
<div id="centurion-gate" role="main">
  <div class="gate-card">
    <h1>CENTURION2</h1>
    <form id="centurion-main-form">
      <p>Accesso al simulatore · Inserisci la password per iniziare.</p>
      <label for="centurion-main-password">Password di accesso</label>
      <input id="centurion-main-password" type="password" autocomplete="off" spellcheck="false" required autofocus>
      <button type="submit">Accedi</button>
    </form>
    <div id="centurion-levels" hidden>
    <p>Scegli come entrare.</p>
    <button id="centurion-free" type="button">✈ Volo libero e Hangar<small>solo volo libero e hangar</small></button>
    <hr class="gate-sep">
    <form id="centurion-team-form">
      <h2>🎮 Gioca in squadra</h2>
      <div class="gate-teams"><label class="blue"><input type="radio" name="centurion-team" value="BLUE" checked>BLU</label><label class="red"><input type="radio" name="centurion-team" value="RED">ROSSA</label></div>
      <label for="centurion-team-password">Password della squadra</label>
      <input id="centurion-team-password" type="password" autocomplete="off" spellcheck="false" required>
      <button type="submit">Entra nella squadra</button>
    </form>
    <hr class="gate-sep">
    <form id="centurion-password-form">
      <h2>🛠 Costruttori · Trainer e Comandante</h2>
      <label for="centurion-password">Password dei costruttori</label>
      <input id="centurion-password" type="password" autocomplete="off" spellcheck="false" required>
      <button id="centurion-unlock" type="submit">Accedi</button>
    </form>
    </div>
    <label class="gate-visibility"><input id="centurion-show-password" type="checkbox"> Mostra password</label>
    <p id="centurion-gate-message" role="status" aria-live="polite"></p>
  </div>
</div>
"""
html = html.replace("<head>", "<head>\n" + css, 1)
html = html.replace("<body>", "<body>\n" + form, 1)
html, count = re.subn(r'<script src="([^"]+)"></script>', lambda m: '<script data-locked-src="' + m.group(1) + '"></script>', html)
assert count >= 15, f"Only {count} application scripts found"
# Access levels: accesso.js is the last app script (restrictions applied after every other module).
html = html.replace("</body>", '<script data-locked-src="security/accesso.js"></script>\n<script src="security/access-lock.js"></script>\n</body>', 1)
index.write_text(html, encoding="utf-8")
(site / "security").mkdir(exist_ok=True)
lock = Path(".github/security/access-lock.js").read_text(encoding="utf-8")
# Team (and optional new builder) password fingerprints, created in the app by the builders.
livelli_path = Path(".github/security/livelli.json")
livelli = "null"
if livelli_path.is_file():
    import json
    data = json.loads(livelli_path.read_text(encoding="utf-8"))
    ok = re.compile(r"^[0-9a-f]{64}$")
    assert re.fullmatch(r"[0-9a-f]{32}", data.get("salt", "")) and int(data.get("iterations", 0)) >= 100000, "livelli.json: salt/iterations not valid"
    for k in ("BLUE", "RED", "COSTRUTTORI"):
        assert k not in data or ok.match(data[k]), f"livelli.json: {k} is not a 64-hex fingerprint"
    clean = {k: data[k] for k in ("salt", "iterations", "BLUE", "RED", "COSTRUTTORI") if k in data}
    livelli = json.dumps(clean)
    print("Access levels: team passwords " + ("set" if "BLUE" in clean and "RED" in clean else "missing") + ("; new builder password" if "COSTRUTTORI" in clean else ""))
else:
    print("Access levels: livelli.json absent, team access disabled until the builders create it")
marker = "/*LIVELLI*/null/*FINE_LIVELLI*/"
assert marker in lock, "access-lock.js: levels marker missing"
(site / "security" / "access-lock.js").write_text(lock.replace(marker, "/*LIVELLI*/" + livelli + "/*FINE_LIVELLI*/"), encoding="utf-8")
shutil.copyfile(".github/security/accesso.js", site / "security" / "accesso.js")

cache = sw.read_text(encoding="utf-8")
# Preserve the content-derived VERSIONE generated by deploy-pages.yml.
# A static version previously prevented installed/PWA clients from refreshing.
if not re.search(r'^const VERSIONE = "[^"]+";', cache, re.M):
    raise RuntimeError("sw.js missing content-derived VERSIONE")
cache = cache.replace('"js/app.js", "manifest.json"', '"js/app.js", "security/access-lock.js", "security/accesso.js", "manifest.json"')
sw.write_text(cache, encoding="utf-8")
print(f"Startup gate applied; {count} app scripts deferred until password verification")
