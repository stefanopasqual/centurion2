#!/usr/bin/env python3
"""Install streamlined four-choice landing screen and Trainer tool hub."""
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")
source=Path(__file__).parent
(root/"js"/"home_hub.js").write_bytes((source/"home_hub.js").read_bytes())
(root/"css"/"home_hub.css").write_bytes((source/"home_hub.css").read_bytes())
index=root/"index.html"
html=index.read_text(encoding="utf-8")
css='<link rel="stylesheet" href="css/home_hub.css">'
js='<script src="js/home_hub.js"></script>'
if css not in html:
    assert '</head>' in html, "Missing document head"
    html=html.replace('</head>',css+'\n</head>',1)
if js not in html:
    assert '</body>' in html, "Missing closing body"
    html=html.replace('</body>',js+'\n</body>',1)
for role in ('data-role="TRAINER"','data-role="BLUE"','data-role="RED"'):
    assert role in html,role
for button in ('btn-volo-splash','btn-demo-splash','btn-tour-splash','btn-missioni-splash','btn-installa','splash-multi'):
    assert button in html,button
index.write_text(html,encoding="utf-8")
print("CENTURION HOME: four home choices; remaining functions in Trainer")
