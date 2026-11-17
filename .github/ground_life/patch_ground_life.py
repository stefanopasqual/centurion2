#!/usr/bin/env python3
"""CENTURION2 mobile civilian life and gun audio integrations.
 Run last after Free Flight, Missions, 6-DOF, thermal and sonic patches.
 All civil activity is aesthetic/background, with no game target semantics.
"""
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")
def patch(relative,a,b):
    f=root/relative
    s=f.read_text(encoding="utf-8")
    n=s.count(a)
    if n!=1:raise RuntimeError(f"{relative}: cannon/life anchor {n}: {a[:110]!r}")
    f.write_text(s.replace(a,b,1),encoding="utf-8")

# Replace 90ms nearly inaudible sampled sound with sustained synthetic
# cannon cadence, gated by real projectile creation and player audio settings.
patch("js/volo.js",
    'S.gunT = (S.gunT || 0) - dt;',
    'S.gunT = (S.gunT || 0) - dt; S.gunLive=!!fuoco;')
patch("js/volo.js",
    'suono("cannone");',
    '/* New continuous cannon audio is controlled in audioFrame(). */')
patch("js/volo.js",
    'const a = AU; if (!a || !S) return; const t = a.ctx.currentTime; const P = S.pl; const on = S.cfg.audio && !S.pausa && P.vivo;',
    '''const a = AU; if (!a || !S) return; const t = a.ctx.currentTime; const P = S.pl; const on = S.cfg.audio && !S.pausa && P.vivo;
    if(window.CENTURION_GUN_AUDIO && P.A && P.A.colpi>0){
      if(!S.gunAudio)S.gunAudio=CENTURION_GUN_AUDIO.create(a);
      if(S.gunAudio)S.gunAudio.update(
        !!(on && S.gunLive && S.arma==="GUN" && P.colpi>0),
        S.cfg.aereo,S.cam!=="cockpit"&&S.cam!=="helmet"
      );
    }''')
patch("js/volo.js",
    'function distruggiScena() {',
    '''function distruggiScena() {
    if(S&&S.gunAudio){S.gunAudio.dispose();S.gunAudio=null;}
    if(S&&S.groundLife){S.groundLife.dispose();S.groundLife=null;}''')
patch("js/volo.js",
    'S.root = root; particelle();',
    '''S.root = root;
    if(window.CENTURION_GROUND_LIFE){
      S.groundLife=CENTURION_GROUND_LIFE.create(root,{
        mobile:mobile(),quality:"maximum",heightAt:(x,z)=>elev(x,z)
      });
      S.groundLife.update(.02,S.pl.pos.x,S.pl.pos.z);
    }
    particelle();''')
patch("js/volo.js",
    'S.t += dtR;',
    '''S.t += dtR;
      if(S.groundLife&&S.pl)S.groundLife.update(dtR,S.pl.pos.x,S.pl.pos.z);''')
# Mission 3D civilian life is visual only, and follows the camera as it travels.
patch("js/mondo3d.js",
    'statici();',
    '''statici();
    if(window.CENTURION_GROUND_LIFE){
      st.groundLife=CENTURION_GROUND_LIFE.create(root,{
        mobile:innerWidth<900,heightAt:(x,z)=>elev(x,z)
      });
      st.groundLife.update(.02,camera.position.x,camera.position.z);
    }''')
patch("js/mondo3d.js",
    'if(st.scramble)scrambleTick(dt);',
    '''if(st.scramble)scrambleTick(dt);
    if(st.groundLife)st.groundLife.update(dt,camera.position.x,camera.position.z);''')
patch("js/mondo3d.js",
    'if(st&&st.thermalFx){st.thermalFx.dispose();st.thermalFx=null;}',
    '''if(st&&st.groundLife){st.groundLife.dispose();st.groundLife=null;}
    if(st&&st.thermalFx){st.thermalFx.dispose();st.thermalFx=null;}''')
print("PASS: cannon bursts for armed jets and procedural civilian life in Free Flight and 3D missions")
