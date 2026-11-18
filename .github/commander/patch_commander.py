#!/usr/bin/env python3
"""Install Commander editor after applying main simulation patches."""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")
src = Path(__file__).parent
(root/"js").mkdir(exist_ok=True)
(root/"css").mkdir(exist_ok=True)
for f in ("core.js","commander.js"):
    (root/"js"/("commander_"+f)).write_bytes((src/f).read_bytes())
(root/"css"/"commander.css").write_bytes((src/"commander.css").read_bytes())
index = root/"index.html"
html = index.read_text(encoding="utf-8")
css = '<link rel="stylesheet" href="css/commander.css">'
assert "</head>" in html and "</body>" in html
if css not in html: html = html.replace("</head>", css+"\n</head>",1)
for file in ("commander_core.js","commander_commander.js"):
    tag = '<script src="js/'+file+'"></script>'
    if tag not in html: html = html.replace("</body>",tag+"\n</body>",1)
index.write_text(html,encoding="utf-8")
print("COMMANDER installed: map editing, formations, objectives and mission library")
