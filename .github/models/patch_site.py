#!/usr/bin/env python3
"""Patch the extracted CENTURION2 site so every real aircraft flies gear-up."""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'extracted/site')
p = root / 'js' / 'vista3d.js'
s = p.read_text(encoding='utf-8')
needle = 'if (!scene) return null; const g = scene.clone(true); const rot = m.rot || [0, 0, 0];'
replacement = '''if (!scene) return null; const g = scene.clone(true);
        // GEAR UP: keep *Off (retracted) meshes; remove *On (extended).
        const gearDown = [];
        g.traverse(o => {
          const n = (o.name || "").toLowerCase().replace(/[\\s_.-]/g, "");
          if (/landingon|gearon|geardown|gearout|refuelon|landinglights|undercarriage(?!off|up)|wheel(?!off|up)|tire(?!off|up)|tyre(?!off|up)/.test(n)) gearDown.push(o);
        });
        gearDown.forEach(o => { if (o.parent) o.parent.remove(o); });
        const rot = m.rot || [0, 0, 0];'''
if needle not in s:
    raise RuntimeError('Cannot find glTF loader insertion point in vista3d.js')
s = s.replace(needle, replacement, 1)
needle2 = 'if (col != null && o.material) {'
if needle2 not in s:
    raise RuntimeError('Cannot find material tint insertion point in vista3d.js')
s = s.replace(needle2, 'if (col != null && m.tint !== false && o.material) {', 1)
p.write_text(s, encoding='utf-8')
print('CENTURION2: gear-up filter and original material colours patched into', p)
