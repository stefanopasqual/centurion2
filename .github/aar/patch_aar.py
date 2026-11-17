#!/usr/bin/env python3
"""Install the air-to-air refuelling cinematic (aar_cine.js, max 4 s) after app.js.
Needs vista3d.js patched by patch_render.py (modelloProcedurale, puffTexture)."""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "extracted/site")
(root / "js" / "aar_cine.js").write_bytes((Path(__file__).parent / "aar_cine.js").read_bytes())
index = root / "index.html"
html = index.read_text(encoding="utf-8")
anchor, tag = '<script src="js/app.js"></script>', '<script src="js/aar_cine.js"></script>'
if tag not in html:
    if anchor not in html:
        raise RuntimeError("index.html: app.js script tag missing")
    html = html.replace(anchor, anchor + "\n" + tag, 1)
    index.write_text(html, encoding="utf-8")
vista = (root / "js" / "vista3d.js").read_text(encoding="utf-8")
if "modelloProcedurale, ambiente, precarica" not in vista:
    raise RuntimeError("vista3d.js not patched by patch_render.py: run it first")
print("CENTURION2 aar: refuelling cinematic installed (max 4 s)")
