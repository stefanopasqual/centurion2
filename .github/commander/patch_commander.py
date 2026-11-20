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
# The legacy Fit button was hardcoded to northern California: support any map region.
map_path = root/"js"/"map.js"
map_text = map_path.read_text(encoding="utf-8")
old_fit = 'function fitScenario() { map.fitBounds([[40.0, -125.6], [42.3, -121.0]]); }'
new_fit = '''function fitScenario() {
    if (sc.missione && sc.missione.id === "CUSTOM") {
      const objects = [].concat(sc.basi || [], sc.target || [], sc.sam || [], sc.aar || [], sc.gate || [], sc.cap_box || []);
      const points = objects.filter(p => Number.isFinite(+p.lat) && Number.isFinite(+p.lon)).map(p => [p.lat, p.lon]);
      if (points.length > 1) { map.fitBounds(points, { padding: [28, 28], maxZoom: 12 }); return; }
      map.setView(sc.mappa.centro, sc.mappa.zoom || 9); return;
    }
    map.fitBounds([[40.0, -125.6], [42.3, -121.0]]);
  }'''
if old_fit in map_text:
    map_path.write_text(map_text.replace(old_fit,new_fit,1),encoding="utf-8")
else:
    # Other map patches may replace fitScenario first. The Commander map is independent.
    # Do not abort publishing the entire site for a missing optional fit override.
    print("COMMANDER: keeping existing map fitScenario implementation")
print("COMMANDER installed: map editing, formations, objectives and mission library")
