#!/usr/bin/env python3
"""Improve ALL terrain engines: Mondo3D, Free Flight, attack cinematic and 2D.
Apply AFTER all other model/map/mission patches to operate on deployed code.
Real elevation data are streamed from public Terrarium DEM; satellite tiles
come from Esri. No invented elevation and no promise of unlimited resolution.
"""
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")

def patch(rel,old,new):
    p=root/rel;s=p.read_text(encoding="utf-8")
    count=s.count(old)
    if count!=1:raise RuntimeError(f"{rel}: mobile map anchor count {count}: {old[:100]}")
    p.write_text(s.replace(old,new,1),encoding="utf-8")

def inject_after(rel,old,addition):
    patch(rel,old,old+addition)

# Avoid asking for more pixels than a mobile device can render and keep 2D overlays
# independent from the high resolution ground surface.
patch("js/mondo3d.js",
      "renderer.setPixelRatio(opt.record ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));",
      "renderer.setPixelRatio(CENTURION_TERRAIN.ratio(!!opt.record));")
patch("js/volo.js",
      "renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile() ? 1 : 1.5));",
      "renderer.setPixelRatio(CENTURION_TERRAIN.ratio(false));")
patch("js/vista3d.js",
      "renderer.setPixelRatio(o.record ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));",
      "renderer.setPixelRatio(CENTURION_TERRAIN.ratio(!!o.record));")

# Geometry resolution for broad LOD: focus detailed, outer tiles moderate.
# These are separate from the streamed DEM+satellite patch quads.
patch("js/mondo3d.js",
      "const SEG = sc.mappa5 ? (window.innerWidth < 900 ? 72 : 112) : (window.innerWidth < 900 ? 32 : 48);",
      "const SEG = sc.mappa5 ? (CENTURION_TERRAIN.profile.mobile ? 64 : 112) : CENTURION_TERRAIN.profile.segmentBase;")
patch("js/volo.js",
      "const SEG = APP.sc.mappa5 ? (mobile() ? 72 : 112) : (mobile() ? 32 : 48);",
      "const SEG = APP.sc.mappa5 ? (CENTURION_TERRAIN.profile.mobile ? 64 : 112) : CENTURION_TERRAIN.profile.segmentBase;")

# Respect device anisotropy and use mipmaps, avoiding shimmer during mobile chase.
patch("js/mondo3d.js",
      "srgb(tex); tex.anisotropy = 8; mat.map = tex;",
      "CENTURION_TERRAIN.texture(tex,renderer); mat.map = tex;")
patch("js/volo.js",
      "srgb(tex); tex.anisotropy = 8; mat.map = tex;",
      "CENTURION_TERRAIN.texture(tex,renderer); mat.map = tex;")
patch("js/vista3d.js",
      "srgb(tex); tex.anisotropy = 8; mat.map = tex;",
      "CENTURION_TERRAIN.texture(tex,renderer); mat.map = tex;")

# Streaming upgrade: two nested terrain LOD tiers follow the currently rendered
# viewpoint. Stays bounded; fallback geographic surface remains at all times.
patch("js/mondo3d.js",
      "terreno(root); statici();",
      '''terreno(root);
    st.hdTerrain=CENTURION_TERRAIN.start({
      root,renderer,lat0:TERRA.lat0,lon0:TERRA.lon0,
      half:APP.sc.mappa5 ? APP.sc.mappa5.lato_m/2:Infinity,
      baseHeight:(x,z)=>elev(x,z),exaggeration:()=>st?st.esag:1
    });
    statici();''')
patch("js/mondo3d.js",
      "renderer.render(scene, camera); hud(); aggiornaNvg();",
      '''if(st.hdTerrain)st.hdTerrain.update(camera.position.x,camera.position.z,performance.now());
    renderer.render(scene, camera); hud(); aggiornaNvg();''')
patch("js/mondo3d.js",
      'if (scene) scene.traverse(x => { if (x.geometry) x.geometry.dispose(); }); scene = null;',
      '''if(st&&st.hdTerrain){st.hdTerrain.dispose();st.hdTerrain=null;}
    if (scene) scene.traverse(x => { if (x.geometry) x.geometry.dispose(); }); scene = null;''')

patch("js/volo.js",
      "terreno(root); creaPiramidi(root);",
      '''terreno(root);
    S.hdTerrain=CENTURION_TERRAIN.start({
      root,renderer,lat0:TERRA.lat0,lon0:TERRA.lon0,
      half:APP.sc.mappa5?APP.sc.mappa5.lato_m/2:Infinity,
      baseHeight:(x,z)=>elev(x,z)
    });
    creaPiramidi(root);''')
patch("js/volo.js",
      "aggiorna(dtR); renderer.render(scene, camera);",
      '''aggiorna(dtR);
    if(S&&S.hdTerrain)S.hdTerrain.update(camera.position.x,camera.position.z,performance.now());
    renderer.render(scene, camera);''')
patch("js/volo.js",
      'function distruggiScena() { if (scene) scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });',
      '''function distruggiScena() { if(S&&S.hdTerrain){S.hdTerrain.dispose();S.hdTerrain=null;}
    if (scene) scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });''')

# Cinematic view already has zoom-14/16 imagery. Stream measured tiles near
# camera (zoom 15 DEM) only while camera approaches ground in a mobile cinematic.
patch("js/vista3d.js",
      "terreno(o.target.lat, o.target.lon, ground);",
      '''terreno(o.target.lat, o.target.lon, ground);
    st.hdTerrain=CENTURION_TERRAIN.start({
      root:ground,renderer,lat0:o.target.lat,lon0:o.target.lon,
      baseHeight:(x,z)=>elev(x,z),datum:()=>TERRA.base
    });''')
patch("js/vista3d.js",
      "renderer.render(scene, camera); hud();",
      '''if(s.hdTerrain&&TERRA.ready)s.hdTerrain.update(camera.position.x,camera.position.z,performance.now());
    renderer.render(scene, camera); hud();''')
patch("js/vista3d.js",
      "if (scene) { scene.traverse(x => { if (x.geometry) x.geometry.dispose(); }); scene = null; }",
      '''if(st&&st.hdTerrain){st.hdTerrain.dispose();st.hdTerrain=null;}
    if (scene) { scene.traverse(x => { if (x.geometry) x.geometry.dispose(); }); scene = null; }''')

# Sharper 2D satellite maps with retina requests where supported, bounded cache
# and lazy redraw while the user drags the tactical map.
patch("js/map.js",
      'map = L.map("map", { zoomControl: true, preferCanvas: false }).setView(sc.mappa.centro, sc.mappa.zoom);',
      '''map = L.map("map", {zoomControl:true,preferCanvas:false,
      zoomSnap:0.5,wheelPxPerZoomLevel:100}).setView(sc.mappa.centro,sc.mappa.zoom);''')
patch("js/map.js",
      '''sat: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 17, attribution: "Esri World Imagery" }),''',
      '''sat: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{
        maxZoom:19,maxNativeZoom:19,detectRetina:true,updateWhenIdle:true,keepBuffer:2,
        attribution:"Esri World Imagery"
      }),''')
patch("js/map.js",
      '''topo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { maxZoom: 15, attribution: "© OpenStreetMap, © OpenTopoMap (CC-BY-SA)" }),''',
      '''topo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",{
        maxNativeZoom:15,maxZoom:18,updateWhenIdle:true,keepBuffer:2,
        attribution:"© OpenStreetMap, © OpenTopoMap (CC-BY-SA)"
      }),''')

idx=root/"index.html";html=idx.read_text(encoding="utf-8")
tag='<script src="js/terrain_mobile.js"></script>'
before='<script src="js/vista3d.js"></script>'
if tag not in html:
    if before not in html:raise RuntimeError("index.html: vista3d.js loader anchor missing")
    html=html.replace(before,tag+"\n"+before,1)
    idx.write_text(html,encoding="utf-8")
print("PASS: mobile quality streaming integrated into 3D mission, Free Flight, cinematic and 2D map.")
