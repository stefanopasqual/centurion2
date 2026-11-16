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


# 500 km2: crop real elevation and satellite tile meshes to an exact projected 22.3607 km square.
def replace_exact(rel, old, new):
    p=root/rel
    s=p.read_text(encoding="utf-8")
    if old not in s:
        raise RuntimeError("Cannot find 500 km2 patch anchor in "+rel+": "+old[:90])
    p.write_text(s.replace(old,new,1),encoding="utf-8")

replace_exact("js/volo.js",
    "const lat0 = TERRA.lat0, lon0 = TERRA.lon0, z = 10;",
    "const lat0 = TERRA.lat0, lon0 = TERRA.lon0, z = APP.sc.mappa5 ? (mobile() ? 12 : 13) : 10;")
replace_exact("js/mondo3d.js",
    "const sc = APP.sc; const lat0 = TERRA.lat0, lon0 = TERRA.lon0; const z = 10;",
    "const sc = APP.sc; const lat0 = TERRA.lat0, lon0 = TERRA.lon0; const z = sc.mappa5 ? (window.innerWidth < 900 ? 12 : 13) : 10;")
# A clipped mesh reuses its full satellite and height tile, remapping UVs to its actual world position.
clipmesh = """
      const arena=APP.sc.mappa5, half=arena ? arena.lato_m/2 : Infinity;
      const xmin=arena?Math.max(-half,cx-tileM/2):cx-tileM/2;
      const xmax=arena?Math.min(half,cx+tileM/2):cx+tileM/2;
      const zmin=arena?Math.max(-half,cz-tileM/2):cz-tileM/2;
      const zmax=arena?Math.min(half,cz+tileM/2):cz+tileM/2;
      if (xmin>=xmax || zmin>=zmax) return;
      const geo = new THREE.PlaneGeometry(xmax-xmin, zmax-zmin, SEG, SEG);
      if(arena){
        const uv=geo.attributes.uv, u0=(xmin-(cx-tileM/2))/tileM, du=(xmax-xmin)/tileM;
        const v0=1-(zmax-(cz-tileM/2))/tileM, dv=(zmax-zmin)/tileM;
        for(let k=0;k<uv.count;k++)uv.setXY(k,u0+du*uv.getX(k),v0+dv*uv.getY(k));
      }
      geo.rotateX(-Math.PI/2);
"""
# Match each original contiguous main tile loop and its geometry line.
replace_exact("js/volo.js",
    "const RX = 7, RY = 4, tx = Math.floor(t.x), ty = Math.floor(t.y);",
    "const half = APP.sc.mappa5 ? APP.sc.mappa5.lato_m / 2 : 0; const RX = half ? Math.ceil(half/tileM)+1 : 7, RY = half ? Math.ceil(half/tileM)+1 : 4, tx = Math.floor(t.x), ty = Math.floor(t.y);")
replace_exact("js/volo.js",
    "const geo = new THREE.PlaneGeometry(tileM, tileM, SEG, SEG); geo.rotateX(-Math.PI / 2); const mat = matStd",
    clipmesh + "      const mat = matStd")
replace_exact("js/volo.js",
    "mesh.position.set(cx, 0, cz);",
    "mesh.position.set((xmin+xmax)/2, 0, (zmin+zmax)/2);")
replace_exact("js/mondo3d.js",
    "const RX = 7, RY = 4; st.tiles = []; const tx = Math.floor(t.x), ty = Math.floor(t.y);",
    "const half = sc.mappa5 ? sc.mappa5.lato_m / 2 : 0; const RX = half ? Math.ceil(half/tileM)+1 : 7, RY = half ? Math.ceil(half/tileM)+1 : 4; st.tiles = []; const tx = Math.floor(t.x), ty = Math.floor(t.y);")
replace_exact("js/mondo3d.js",
    "const geo = new THREE.PlaneGeometry(tileM, tileM, SEG, SEG); geo.rotateX(-Math.PI / 2);",
    clipmesh)
replace_exact("js/mondo3d.js",
    "mesh.position.set(cx, 0, cz);",
    "mesh.position.set((xmin+xmax)/2, 0, (zmin+zmax)/2);")
# The original free-flight spawn is 40 km from a base; new arena starts close to the region center.
replace_exact("js/volo.js",
    "P.pos = V3(b.x + dir.x * 40000, 6100, b.z + dir.z * 40000);",
    "P.pos = APP.sc.mappa5 ? V3(0, APP.sc.mappa5.quotaInizioM, 0) : V3(b.x + dir.x * 40000, 6100, b.z + dir.z * 40000);")
# Draw the correct region in 2D, rather than hardcoded Californian map bounds.
replace_exact("js/map.js",
    "function fitScenario() { map.fitBounds([[40.0, -125.6], [42.3, -121.0]]); }",
    """function fitScenario() {
    if(sc.mappa5){
      const lat=sc.mappa.centro[0],lon=sc.mappa.centro[1], d=sc.mappa5.lato_m/2/111320;
      map.fitBounds([[lat-d,lon-d/Math.cos(lat*Math.PI/180)],[lat+d,lon+d/Math.cos(lat*Math.PI/180)]]);
    } else map.fitBounds([[40.0,-125.6],[42.3,-121.0]]);
  }""")
replace_exact("js/map.js",
    "function reDraw(scenario) { sc = scenario; disegnaStatici(); }",
    "function reDraw(scenario) { sc = scenario; disegnaStatici(); if(sc.mappa5){setBase('sat');fitScenario();} }")
