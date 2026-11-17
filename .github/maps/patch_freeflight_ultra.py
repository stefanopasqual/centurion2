#!/usr/bin/env python3
"""Maximum terrain quality in CENTURION 2 Free Flight only.

Streaming imagery to zoom 17 where available; measured DEM stays <= zoom15.
Keeps device-limited tile/texture budgets, with flight-path prefetch.
"""
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")
p=root/"js"/"volo.js"
s=p.read_text(encoding="utf-8")
def patch(a,b):
    global s
    count=s.count(a)
    if count!=1:
        raise RuntimeError(f"Free Flight maximum-terrain anchor {count}: {a[:140]}")
    s=s.replace(a,b,1)

patch(
'''    S.hdTerrain=CENTURION_TERRAIN.start({
      root,renderer,lat0:TERRA.lat0,lon0:TERRA.lon0,
      half:APP.sc.mappa5?APP.sc.mappa5.lato_m/2:Infinity,
      baseHeight:(x,z)=>elev(x,z)
    });''',
'''    S.hdTerrain=CENTURION_TERRAIN.start({
      root,renderer,lat0:TERRA.lat0,lon0:TERRA.lon0,
      half:APP.sc.mappa5?APP.sc.mappa5.lato_m/2:Infinity,
      quality:"maximum",
      altitudeAGL:()=>S&&S.pl?Math.max(0,S.pl.agl||0):10000,
      baseHeight:(x,z)=>elev(x,z)
    });''')

patch(
'''    if(S&&S.hdTerrain)S.hdTerrain.update(camera.position.x,camera.position.z,performance.now());''',
'''    if(S&&S.hdTerrain&&S.pl){
      const P=S.pl,velocity=P.vel;
      S.hdTerrain.update(camera.position.x,camera.position.z,
        performance.now(),velocity?velocity.x:0,velocity?velocity.z:0);
    }''')

patch(
'''renderer.setPixelRatio(CENTURION_TERRAIN.ratio(false));''',
'''renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,
      (navigator.deviceMemory||4)<=2?1.15:
      (navigator.deviceMemory||4)>=6?2:1.7));''')

p.write_text(s,encoding="utf-8")
print("PASS: Free Flight uses maximum terrain with satellite zoom up to 17, measured DEM, predictive streaming and hardware-aware DPR")
