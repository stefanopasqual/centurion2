#!/usr/bin/env python3
"""Inject geographic map selector and terrain centers into extracted CENTURION2."""
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")
def patch(rel,old,new):
 p=root/rel
 s=p.read_text(encoding="utf-8")
 if old not in s: raise RuntimeError(f"Map patch anchor missing: {rel}: {old[:70]}")
 p.write_text(s.replace(old,new,1),encoding="utf-8")
patch("js/mondo3d.js","TERRA.lat0 = 41.0; TERRA.lon0 = -122.8;",
      "TERRA.lat0 = sc.mappa.centro[0]; TERRA.lon0 = sc.mappa.centro[1];")
patch("js/volo.js","const root = new THREE.Group(); scene.add(root); pista(root); partenza(); cielo(); terreno(root); bersagliTerra(root);",
      "TERRA.lat0 = APP.sc.mappa.centro[0]; TERRA.lon0 = APP.sc.mappa.centro[1];\n    const root = new THREE.Group(); scene.add(root); pista(root); partenza(); cielo(); terreno(root); creaPiramidi(root); bersagliTerra(root);")
# Add distinguishable Giza pyramids to free flight. DEM remains real; mesh is a lightweight visual landmark.
insert="""
  function creaPiramidi(root) {
    if (!APP.sc.mappa5 || APP.sc.mappa5.id !== "giza") return;
    const group = new THREE.Group(); root.add(group);
    const specs = [[29.9792,31.1342,230,146],[29.9761,31.1308,215,136],[29.9724,31.1285,102,65]];
    specs.forEach(([lat,lon,base,height])=>{
      const at=toXZ(lat,lon);
      const geo=new THREE.ConeGeometry(base / Math.SQRT2,height,4,1);
      geo.rotateY(Math.PI/4);
      const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xd0ae79,roughness:1}));
      mesh.position.set(at.x,Math.max(0,elev(at.x,at.z))+height/2,at.z);
      mesh.userData.map5Pyramid={x:at.x,z:at.z,h:height};
      group.add(mesh);
    });
    const place=()=>{if(!S||!TERRA.ready)return;group.children.forEach(m=>{const x=m.userData.map5Pyramid;m.position.y=elev(x.x,x.z)+x.h/2;});};
    const timer=setInterval(()=>{if(!S||!S.cfg||APP.sc.mappa5?.id!=="giza"){clearInterval(timer);return;}if(TERRA.ready){place();clearInterval(timer);}},350);
    setTimeout(()=>clearInterval(timer),15000);
  }
"""
patch("js/volo.js","  /* ---------- avvio / chiusura ---------- */",insert+"\n  /* ---------- avvio / chiusura ---------- */")
patch("index.html","</body>","<script src=\"js/maps5.js\"></script>\n</body>")
(root/"js"/"maps5.js").write_bytes(Path(__file__).with_name("maps5.js").read_bytes())
print("CENTURION2 maps5: patched map selector, free flight geographic terrain and Giza landmarks")
