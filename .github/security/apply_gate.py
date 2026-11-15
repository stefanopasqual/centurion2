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
</style>
<script>document.documentElement.classList.add("password-required");</script>
"""
form = """
<div id="centurion-gate" role="main">
  <div class="gate-card">
    <h1>CENTURION2</h1>
    <p>Accesso al simulatore · Inserisci la password per iniziare.</p>
    <form id="centurion-password-form">
      <label for="centurion-password">Password di accesso</label>
      <input id="centurion-password" type="password" autocomplete="off" spellcheck="false" required autofocus>
      <label class="gate-visibility"><input id="centurion-show-password" type="checkbox"> Mostra password</label>
      <button id="centurion-unlock" type="submit">Accedi</button>
      <p id="centurion-gate-message" role="status" aria-live="polite"></p>
    </form>
  </div>
</div>
"""
html = html.replace("<head>", "<head>\n" + css, 1)
html = html.replace("<body>", "<body>\n" + form, 1)
html, count = re.subn(r'<script src="([^"]+)"></script>', lambda m: '<script data-locked-src="' + m.group(1) + '"></script>', html)
assert count >= 15, f"Only {count} application scripts found"
html = html.replace("</body>", '<script src="security/access-lock.js"></script>\n</body>', 1)
index.write_text(html, encoding="utf-8")
(site / "security").mkdir(exist_ok=True)
shutil.copyfile(".github/security/access-lock.js", site / "security" / "access-lock.js")

cache = sw.read_text(encoding="utf-8")
cache = re.sub(r'const VERSIONE = "[^"]+";', 'const VERSIONE = "centurion2-mobile-password-v2";', cache, count=1)
cache = cache.replace('"js/app.js", "manifest.json"', '"js/app.js", "security/access-lock.js", "manifest.json"')
sw.write_text(cache, encoding="utf-8")
print(f"Startup gate applied; {count} app scripts deferred until password verification")
