#!/usr/bin/env python3
"""Install the procedural 3D cockpit shell (cockpit3d.js) after cockpit.js. Run after patch_cockpit.py."""
from pathlib import Path
import sys
root = Path(sys.argv[1] if len(sys.argv) > 1 else "extracted/site")
(root / "js" / "cockpit3d.js").write_bytes(Path(__file__).with_name("cockpit3d.js").read_bytes())
index = root / "index.html"
html = index.read_text(encoding="utf-8")
anchor, tag = '<script src="js/cockpit.js"></script>', '<script src="js/cockpit3d.js"></script>'
if tag not in html:
    if anchor not in html:
        raise RuntimeError("cockpit.js script tag missing: run patch_cockpit.py first")
    html = html.replace(anchor, anchor + "\n" + tag, 1)
    index.write_text(html, encoding="utf-8")
print("CENTURION2 cockpit3d: procedural 3D cockpit for models without interior")
