#!/usr/bin/env python3
"""Gyro head-look, cockpit views only, usable together with the stick.
Control scheme (requested):
- The gyroscope is used ONLY in the internal views (cockpit / CASCO) and
  there it moves the head/helmet (S.lookYaw / S.lookPitch) to look around
  the real cockpit.
- It works at the same time as the touch stick (cloche): you fly with the
  stick while the gyro moves your head. Tilting the phone no longer flies
  the aircraft in any view.
Keyboard I/J/K/L/O head-look still works. Run after patch_cockpit.py /
patch_cockpit3d.py."""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "extracted/site")
volo = root / "js" / "volo.js"
t = volo.read_text(encoding="utf-8")

def once(old, new, label):
    global t
    if new in t:
        return
    if t.count(old) != 1:
        raise RuntimeError(f"anchor not found/unique: {label}")
    t = t.replace(old, new, 1)

# 1) Tilt no longer flies: the gyro is reserved for cockpit head-look.
once(
    '    if (TILT.on && TOUCH.id === null) { sx = ex(TILT.sx); sy = ex(TILT.sy); }',
    '    /* il giroscopio non pilota piu: serve solo alla testa nella vista cockpit (vedi sotto) */',
    'disable tilt-to-fly')

# 2) Gyro head-look in the internal views, alongside the stick (no zeroing
#    of the flight input, so the touch cloche flies at the same time).
once(
    '    S.in = { sx: clamp(sx, -1, 1), sy: clamp(sy * inv, -1, 1), rud: clamp(rud, -1, 1)',
    '    if ((S.cam === "cockpit" || S.cam === "helmet") && TILT.on) { '
    'S.lookYaw = clamp(-TILT.sx * 2.1, -2.1, 2.1); '
    'S.lookPitch = clamp(TILT.sy * 1.1, -1.1, 1.1); }\n'
    '    S.in = { sx: clamp(sx, -1, 1), sy: clamp(sy * inv, -1, 1), rud: clamp(rud, -1, 1)',
    'gyro head-look input')

# 3) Apply the head-look camera offset in the cockpit view too (not just CASCO).
once(
    'if (S.cam === "helmet") camera.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(S.lookPitch||0,S.lookYaw||0,0,"YXZ")));',
    'if (S.cam === "cockpit" || S.cam === "helmet") camera.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(S.lookPitch||0,S.lookYaw||0,0,"YXZ")));',
    'head-look offset in cockpit view')

volo.write_text(t, encoding="utf-8")
print("CENTURION2 cockpit look: gyro head-look (cockpit views only, works with the stick)")
