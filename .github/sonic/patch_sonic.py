#!/usr/bin/env python3
"""CENTURION2 supersonic visual effects; realistic conditions approximated.
Visual vapor is conditional on humidity and transonic Mach; sonic boom is
heard externally (Chase) after propagation delay, never by the pilot inside.
"""
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")
def change(path,a,b):
 p=root/"js"/path;s=p.read_text(encoding="utf-8")
 if s.count(a)!=1:raise RuntimeError(f"{path} sonic anchor count {s.count(a)}: {a[:100]}")
 p.write_text(s.replace(a,b,1),encoding="utf-8")

change("volo.js",
'    S.t += dtR; aggiornaNemici(dtR);',
'    S.t += dtR; aggiornaSonic(dtR); aggiornaNemici(dtR);')

change("volo.js",
'  function aggiorna(dtR) {',
'''  function aggiornaSonic(dt){
    if(!S||!S.pl||!S.pl.vivo)return;
    const P=S.pl;
    if(P.A.drone||P.A.nonArmato)return;
    const mach=Math.max(0,P.M||0);
    const humidity=(APP.sc&&APP.sc.meteo&&APP.sc.meteo.umidita!=null)
      ? Math.max(0,Math.min(1,+APP.sc.meteo.umidita/100)):.68;
    if(!S.sonicVisual&&window.CENTURION_SONIC)
      S.sonicVisual=CENTURION_SONIC.make(scene);
    if(S.sonicVisual)
      S.sonicVisual.update(P.pos,P.Q,mach,humidity,S.t,1);
    const exterior=S.cam!=="cockpit"&&S.cam!=="helmet";
    if(mach>1.025 && (S.sonicLastMach||0)<=1.0 && exterior
        && AU&&S.cfg.audio && window.CENTURION_SONIC){
      // Camera is a simulated outside observer. Shock-front arrival delay
      // approximated by current separation from aircraft / local sound speed.
      const distance=camera?camera.position.distanceTo(P.pos):25;
      const sos=isa(P.pos.y).a||340;
      const delay=Math.min(2.5,Math.max(.03,distance/sos));
      S.sonicPending={t:S.t+delay,played:false};
    }
    S.sonicLastMach=mach;
    if(S.sonicPending&&!S.sonicPending.played&&S.t>=S.sonicPending.t){
      S.sonicPending.played=true;
      if(S.cfg.audio&&AU&&exterior){
        CENTURION_SONIC.boom(AU.ctx,AU.master,.21);
        messaggio("ONDA D'URTO · MACH "+mach.toFixed(2),1.3);
      }
      S.sonicPending=null;
    }
  }
  function aggiorna(dtR) {''')

change("volo.js",
'if(S&&S.thermalFx){S.thermalFx.dispose();S.thermalFx=null;}',
'''if(S&&S.sonicVisual){S.sonicVisual.dispose();S.sonicVisual=null;}
    if(S&&S.thermalFx){S.thermalFx.dispose();S.thermalFx=null;}''')

# Add a subtle visual wave during mission flights when supersonic.
# The tactical engine holds estimated speed in knots, altitude in feet.
change("mondo3d.js",
'      e.g.updateMatrixWorld(true);',
'''      e.g.updateMatrixWorld(true);
      if(window.CENTURION_SONIC && !/UAV|GERAN|KC30|E7/i.test(f.tipo||"")){
        const sound=295.07*Math.sqrt(Math.max(.25,1-.00002256*((f.alt||0)*.3048)));
        const mach=(f.tas||0)*.514444/sound;
        if(!e.sonic)e.sonic=CENTURION_SONIC.make(scene);
        const model=e.el[0];
        const q=model?model.getWorldQuaternion(new THREE.Quaternion()):e.g.quaternion;
        const humidity=(APP.sc&&APP.sc.meteo&&APP.sc.meteo.umidita!=null)?
          Math.max(0,Math.min(1,APP.sc.meteo.umidita/100)):.68;
        e.sonic.update(e.g.position,q,mach,humidity,now,.95);
      }''')

change("mondo3d.js",
'if(st&&st.thermalFx){st.thermalFx.dispose();st.thermalFx=null;}',
'''if(st&&st.ent)Object.values(st.ent).forEach(e=>{if(e.sonic){e.sonic.dispose();e.sonic=null;}});
    if(st&&st.thermalFx){st.thermalFx.dispose();st.thermalFx=null;}''')
print("Sonic shock propagation, conditional vapor effect and mission animation integrated.")
