#!/usr/bin/env python3
"""Gyro head-look in the CASCO (helmet) view.
The cockpit/helmet internal views and the real-interior rendering already
exist (patch_cockpit.py + cockpit3d.js). This adds device-tilt head-look:
in the helmet view, tilting the phone moves the head/helmet (S.lookYaw /
S.lookPitch) instead of flying, so you can look around the real cockpit;
fly with the touch stick there. The plain cockpit view and all other views
keep tilt-to-fly unchanged. Keyboard I/J/K/L/O head-look still works.
Run after patch_cockpit.py / patch_cockpit3d.py."""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "extracted/site")
volo = root / "js" / "volo.js"
t = volo.read_text(encoding="utf-8")

anchor = '    S.in = { sx: clamp(sx, -1, 1), sy: clamp(sy * inv, -1, 1), rud: clamp(rud, -1, 1)'
inject = ('    if (S.cam === "helmet" && TILT.on && TOUCH.id === null) { '
          'S.lookYaw = clamp(-TILT.sx * 2.1, -2.1, 2.1); '
          'S.lookPitch = clamp(TILT.sy * 1.1, -1.1, 1.1); '
          'sx = 0; sy = 0; rud = 0; }\n')

if 'S.cam === "helmet" && TILT.on' not in t:
    if t.count(anchor) != 1:
        raise RuntimeError("volo.js head-look anchor (S.in) not found/unique")
    t = t.replace(anchor, inject + anchor, 1)
    volo.write_text(t, encoding="utf-8")

print("CENTURION2 cockpit look: gyro head-look in the CASCO view")
