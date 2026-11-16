#!/usr/bin/env python3
"""Use licensed GLBs in flight and hide extended landing gear on imported models."""
from pathlib import Path
import sys
root = Path(sys.argv[1] if len(sys.argv) > 1 else "extracted/site")
p = root / "js" / "vista3d.js"
s = p.read_text(encoding="utf-8")
needle = 'if (!scene) return null; const g = scene.clone(true); const rot = m.rot || [0, 0, 0];'
replacement = r'''if (!scene) return null; const g = scene.clone(true);
        // Airborne presentation: remove extended landing gear only.
        // "off"/"up"/"retracted" variants are kept; undercarriage wheels,
        // bogies, doors-open and extended struts are removed.
        const removed = [];
        g.traverse(o => {
          if (!o.isMesh && !o.isGroup) return;
          const name = (o.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const keep = /gearup|landingoff|gearoff|retracted|stowed|doorclosed|wheelwell/.test(name);
          const down = /landingon|gearon|geardown|gearout|gearopen|landinggear|undercarriage|nosewheel|mainwheel|wheel(?!well)|tire|tyre|bogie|oleostrut|gearstrut|do[o]?ropen|dooropened/.test(name);
          if (!keep && down) removed.push(o);
        });
        // Never remove the full GLTF root or non-gear visual hierarchy.
        removed.forEach(o => { if (o.parent && o.parent !== g.parent) o.parent.remove(o); });
        const rot = m.rot || [0, 0, 0];'''
if needle not in s:
    raise RuntimeError("GLTF load anchor missing: " + str(p))
s = s.replace(needle, replacement, 1)
needle2 = 'if (col != null && o.material) {'
if needle2 not in s:
    raise RuntimeError("Material anchor missing: " + str(p))
s = s.replace(needle2, 'if (col != null && m.tint !== false && o.material) {', 1)
p.write_text(s, encoding="utf-8")
print("CENTURION2: original GLBs preferred in missions; airborne landing gear hidden; texture colors retained")
