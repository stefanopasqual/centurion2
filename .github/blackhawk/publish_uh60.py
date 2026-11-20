#!/usr/bin/env python3
"""Register independently authored UH-60 helicopter GLB in CENTURION2 site.

Michał Flodrowski's Sketchfab viewer remains untouched and retains attribution.
"""
import json
import shutil
import struct
import sys
from pathlib import Path

site=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")
model=site/"models"/"uh60-centurion.glb"
if not model.is_file() or model.stat().st_size<50000:
    raise RuntimeError("UH-60 original GLB missing or too small")
with model.open("rb") as f:
    magic,version,size=struct.unpack("<4sII",f.read(12))
    assert magic==b"glTF" and version==2 and size==model.stat().st_size
    chunk,tag=struct.unpack("<I4s",f.read(8))
    assert tag==b"JSON"
    obj=json.loads(f.read(chunk))
allnames={o.get("name","") for o in obj.get("nodes",[])}
assert "CENTURION_UH60_MAIN_ROTOR" in allnames, "Main rotor node absent"
assert "CENTURION_UH60_TAIL_ROTOR" in allnames, "Tail rotor node absent"
assert len(obj.get("meshes",[]))>=12, "Helicopter geometry incomplete"
out=site/"modelli"/"uh60-centurion.glb"
out.parent.mkdir(parents=True,exist_ok=True)
shutil.copyfile(model,out)
hangar=site/"models"/"manifest.json"
h=json.loads(hangar.read_text(encoding="utf-8"))
h["models"]=[entry for entry in h["models"] if entry.get("id")!="uh60-centurion"]
h["models"].append({
  "id":"uh60-centurion","name":"Sikorsky UH-60M Black Hawk · CENTURION",
  "glb":"models/uh60-centurion.glb",
  "status":"ready","source":"https://sketchfab.com/3d-models/sikorsky-uh-60m-blackhawk-12b4e525676a49678ac3006b360c8750",
  "author":"Muhamad Mirza Arrafi","license":"CC-BY-4.0",
  "attribution":"Sikorsky UH-60M Blackhawk by Muhamad Mirza Arrafi (Sketchfab), CC BY 4.0; rotor mesh partition and simulator scale by CENTURION2."
})
hangar.write_text(json.dumps(h,ensure_ascii=False,indent=2),encoding="utf-8")
mission=site/"modelli"/"manifest.json"
m=json.loads(mission.read_text(encoding="utf-8"))
m["UH60"]={
  "file":"uh60-centurion.glb",
  "rot":[0,0,0],"lunghezza_m":19.76,
  "autore":"Muhamad Mirza Arrafi (Sketchfab)","licenza":"CC-BY-4.0",
  "gear":"down","tint":False
}
mission.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding="utf-8")
print("PASS UH60M CC BY original",model.stat().st_size,"bytes,",len(obj.get("meshes",[])),
      "meshes, both rotor animation nodes")
