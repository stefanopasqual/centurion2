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
    if(!S||!S.pl||!S.pl.vivo){if(S&&S.fx)S.fx.buffet=0;return;}
    const P=S.pl;
    if(P.A.drone||P.A.nonArmato){if(S.fx)S.fx.buffet=0;return;}
    const mach=Math.max(0,P.M||0);
    const humidity=(APP.sc&&APP.sc.meteo&&APP.sc.meteo.umidita!=null)
      ? Math.max(0,Math.min(1,+APP.sc.meteo.umidita/100)):.68;
    if(!S.sonicVisual&&window.CENTURION_SONIC)
      S.sonicVisual=CENTURION_SONIC.make(scene);
    // cono di vapore in scala con l'aereo (geometria pensata per un caccia di 15 m)
    const LUNGH={F16:15,F15:19.4,F2000:16,F22:18.9,SU35:21.9,SU57:20.1,EA18:18.3};
    if(S.sonicVisual)
      S.sonicVisual.update(P.pos,P.Q,mach,humidity,S.t,(LUNGH[S.cfg.aereo]||15)/15);
    const exterior=S.cam!=="cockpit"&&S.cam!=="helmet";
    // Il muro si passa una volta e si riarma solo tornando sotto Mach 0,97. (Prima serviva un salto da
    // 1,000 a 1,025 in un solo fotogramma, impossibile accelerando: il bang non partiva mai.)
    if(mach<.97)S.sonicArmato=true;
    if(S.sonicArmato!==false&&mach>1.005){
      S.sonicArmato=false;
      // La camera esterna fa da osservatore: l'onda d'urto la raggiunge dopo distanza / velocita' del suono.
      const distance=camera?camera.position.distanceTo(P.pos):25;
      const sos=isa(P.pos.y).a||340;
      S.sonicPending={t:S.t+Math.min(2.5,Math.max(.03,distance/sos))};
      // il pilota non sente il bang di chi sta a terra: in cabina il colpo sordo dell'onda d'urto sul tettuccio
      messaggio(exterior?"MACH 1 · BANG SONICO":"MACH 1 · SUPERSONICO",2.4);
      if(!exterior&&S.cfg.audio&&AU&&window.CENTURION_SONIC)CENTURION_SONIC.boom(AU.ctx,AU.master,.75,{attutito:true});
    }
    if(S.sonicPending&&S.t>=S.sonicPending.t){
      S.sonicPending=null;
      if(S.cam!=="cockpit"&&S.cam!=="helmet"){
        if(S.fx)S.fx.scossa=Math.max(S.fx.scossa||0,.9);
        if(S.cfg.audio&&AU&&window.CENTURION_SONIC)CENTURION_SONIC.boom(AU.ctx,AU.master,1.0);
      }
    }
    // Buffet transonico: da Mach 0,95 le onde d'urto sull'ala oscillano e scuotono la cellula, sempre di piu'
    // avvicinandosi a Mach 1; resta al massimo finche' il bang non arriva, poi appena supersonico (Mach 1,03) il
    // flusso si assesta e il volo torna liscio. Piu' forte a bassa quota (pressione dinamica alta).
    const liscia=(a,b,x)=>{const k=Math.max(0,Math.min(1,(x-a)/(b-a)));return k*k*(3-2*k);};
    let buffet=Math.pow(liscia(.95,.995,mach),1.3)*(1-liscia(1.005,1.03,mach));
    if(S.sonicPending)buffet=1;
    if(S.fx)S.fx.buffet=buffet*Math.max(.45,Math.min(1.25,(P.qbar||0)/25000));
  }
  function aggiorna(dtR) {''')

change("volo.js",
'if(S&&S.thermalFx){S.thermalFx.dispose();S.thermalFx=null;}',
'''if(S&&S.sonicVisual){S.sonicVisual.dispose();S.sonicVisual=null;}
    if(S&&S.thermalFx){S.thermalFx.dispose();S.thermalFx=null;}''')

# Camera: oltre agli scossoni (esplosioni, bang) un canale continuo per il buffet transonico, fitto e piccolo;
# in cabina quasi solo angolare (spostare l'occhio di decimetri dentro l'abitacolo sembrerebbe un terremoto).
change("volo.js",
'const fx = S.fx; if (!fx || fx.scossa < 0.01) return; const a = fx.scossa;',
'''const fx = S.fx; if (!fx) return;
    const bf = S.pausa ? 0 : fx.buffet || 0; if (bf > 0.01) { const den = S.cam === "cockpit" || S.cam === "helmet", kp = den ? 0.035 : 0.55, kr = den ? 0.0075 : 0.005;
      camera.position.add(V3((Math.random() - 0.5) * bf * kp, (Math.random() - 0.5) * bf * kp, (Math.random() - 0.5) * bf * kp)); camera.rotateZ((Math.random() - 0.5) * bf * kr); camera.rotateX((Math.random() - 0.5) * bf * kr * 1.3); }
    if (fx.scossa < 0.01) return; const a = fx.scossa;''')

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
print("Sonic shock propagation, transonic buffet, conditional vapor effect and mission animation integrated.")
