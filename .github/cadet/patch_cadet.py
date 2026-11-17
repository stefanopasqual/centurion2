#!/usr/bin/env python3
"""Install CENTURION CADET (guided civilian mode) into the built site: copies cadet_core.js and
cadet.js into js/ and loads them after app.js. The engine and the other scripts are not modified."""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "extracted/site")
here = Path(__file__).parent
for name in ("cadet_core.js", "cadet.js"):
    (root / "js" / name).write_bytes((here / name).read_bytes())
index = root / "index.html"
html = index.read_text(encoding="utf-8")
anchor = '<script src="js/app.js"></script>'
tags = '<script src="js/cadet_core.js"></script>\n<script src="js/cadet.js"></script>'
if 'src="js/cadet.js"' not in html:
    if anchor not in html:
        raise RuntimeError("index.html: app.js script tag missing")
    html = html.replace(anchor, anchor + "\n" + tags, 1)
    index.write_text(html, encoding="utf-8")
print("CENTURION2 cadet: guided mission 'Il corridoio' installed")
