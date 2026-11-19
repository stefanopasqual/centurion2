#!/usr/bin/env python3
"""Build UH-60M original artist GLB with articulated rotors; CC BY 4.0."""
import sys,json,struct,copy,hashlib,base64
from pathlib import Path

root=Path(__file__).resolve().parents[2]
source=root/"model-sources"/"uh60m_b64"
out=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site/models/uh60-centurion.glb")
parts=sorted(source.glob("part*.txt"))
assert len(parts)==15, f"Expected 15 chunks, got {len(parts)}"
raw=base64.b64decode("".join(p.read_text(encoding="ascii") for p in parts))
digest=hashlib.sha256(raw).hexdigest()
assert digest=="2e90e0e2fdf4436372c060eea46fe54b7afab810ae6adafd9a218ca5b5f9f046",digest
assert raw[:4]==b"glTF" and struct.unpack_from("<I",raw,8)[0]==len(raw)
jn,jtag=struct.unpack_from("<I4s",raw,12);assert jtag==b"JSON"
g=json.loads(raw[20:20+jn])
off=20+jn
bn,btag=struct.unpack_from("<I4s",raw,off);assert btag==b"BIN\x00"
binary=bytearray(raw[off+8:off+8+bn])
license=g["asset"]["extras"]
assert "CC-BY-4.0" in license["license"]
assert len(g["nodes"])==12 and len(g["meshes"])==10
assert g["nodes"][6]["mesh"]==4
p=g["meshes"][4]["primitives"][0]
def get(accessor):
 a=g["accessors"][accessor];view=g["bufferViews"][a["bufferView"]]
 fmt={5121:"B",5123:"H",5125:"I",5126:"f"}[a["componentType"]]
 width={"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4}[a["type"]]
 size=struct.calcsize(fmt)*width
 start=view.get("byteOffset",0)+a.get("byteOffset",0)
 stride=view.get("byteStride",size)
 return [struct.unpack_from("<"+fmt*width,binary,start+i*stride) for i in range(a["count"])]
points=get(p["attributes"]["POSITION"])
ids=[x[0] for x in get(p["indices"])]
groups={"main":[],"tail":[],"fixed":[]}
for i in range(0,len(ids),3):
 tri=ids[i:i+3]
 x,y,z=[sum(points[t][k] for t in tri)/3 for k in range(3)]
 kind=("main" if .105<z<.165 and x>-.80 and (abs(y)>.18 or abs(x-.24)>.19)
       else "tail" if x<-.98 and z>.16 else "fixed")
 groups[kind].extend(tri)
assert len(groups["main"])>300 and len(groups["tail"])>100
def add_indices(values):
 binary.extend(b"\0"*((-len(binary))%4))
 at=len(binary);binary.extend(struct.pack("<"+"I"*len(values),*values))
 view=len(g["bufferViews"])
 g["bufferViews"].append({"buffer":0,"byteOffset":at,"byteLength":len(values)*4,"target":34963})
 acc=len(g["accessors"])
 g["accessors"].append({"bufferView":view,"componentType":5125,"count":len(values),"type":"SCALAR"})
 return acc
old=g["meshes"][4]
for label in ("fixed","main","tail"):
 prim=copy.deepcopy(p)
 prim["indices"]=add_indices(groups[label])
 if label=="fixed":
  old["primitives"]=[prim];old["name"]="CENTURION_UH60M_STATIC_DETAIL"
 else:
  mesh=len(g["meshes"])
  g["meshes"].append({"name":"CENTURION_UH60M_"+label.upper()+"_BLADES","primitives":[prim]})
  pivot=[.24,0,.13] if label=="main" else [-1.08,-.025,.21]
  group=len(g["nodes"])
  g["nodes"].append({"name":"CENTURION_UH60_"+label.upper()+"_ROTOR","translation":pivot,
     "children":[group+1],"extras":{"centurionRotorAxis":"z" if label=="main" else "y"}})
  g["nodes"].append({"name":"CENTURION_UH60M_"+label.upper()+"_GEOMETRY",
      "mesh":mesh,"translation":[-v for v in pivot]})
  g["nodes"][1]["children"].append(group)
factor=16.36/2.5
matrix=g["nodes"][0]["matrix"]
for col in range(3):
 for row in range(3):matrix[col*4+row]*=factor
g["asset"]["extras"]["centurion"]={
 "original_source":license["source"],"author":license["author"],"license":license["license"],
 "scale_m_per_source_unit":factor,"nose":"+Z","up":"+Y",
 "rotors":"source geometry partitioned; pivots inferred from mesh"}
g["buffers"][0]["byteLength"]=len(binary)
js=json.dumps(g,separators=(",",":"),ensure_ascii=False).encode("utf-8")
js+=b" "*((-len(js))%4)
binary.extend(b"\0"*((-len(binary))%4))
out.parent.mkdir(parents=True,exist_ok=True)
with out.open("wb") as f:
 f.write(struct.pack("<4sII",b"glTF",2,12+8+len(js)+8+len(binary)))
 f.write(struct.pack("<I4s",len(js),b"JSON"));f.write(js)
 f.write(struct.pack("<I4s",len(binary),b"BIN\x00"));f.write(binary)
assert out.stat().st_size>len(raw)
print("PASS UH60M ORIGINAL GLB",out.stat().st_size,
      "bytes, main triangles",len(groups["main"])//3,
      "tail triangles",len(groups["tail"])//3,
      "CC BY 4.0",license["author"])
