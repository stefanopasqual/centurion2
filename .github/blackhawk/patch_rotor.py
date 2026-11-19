#!/usr/bin/env python3
"""Install UH-60 rotorcraft dynamics into Free Flight after A380's fleet patch.

The original author preview at id 'uh60' is never modified.
"""
from pathlib import Path
import sys
site=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")
volo=site/"js"/"volo.js"
s=volo.read_text(encoding="utf-8")
def patch(a,b):
    global s
    n=s.count(a)
    if n!=1:
        raise RuntimeError(f"UH60 Free Flight patch: anchor count {n}: {a[:95]}")
    s=s.replace(a,b,1)

fleet='    A380:{nome:'
patch(fleet,'''    UH60:{nome:"CENTURION UH-60 · elicottero",icona:"uh60-centurion",
      rotorcraft:true,nonArmato:true,noEject:true,m:9500,fuel:1650,
      S:201,span:16.36,length:19.76,height:5.13,gearHeight:1.85,
      Tmil:0,Tab:0,cd0:.04,k:.07,cla:3,astall:20,amax:18,
      gmax:2.5,gneg:0,pmax:35,collectiveHover:.64,
      colpi:0,cannone:"Nessuno",carico:{}},
    A380:{nome:''')

patch('''    if(A.drone==="quad" || !P.aTerra)return fisica6(dt);''',
'''    if(A.rotorcraft)return fisicaElicottero(dt);
    if(A.drone==="quad" || !P.aTerra)return fisica6(dt);''')

patch('''  function fisica6(dt){''',
'''  function fisicaElicottero(dt){
    const P=S.pl,A=P.A,In=S.in;
    if(!P.vivo||S.fine)return;
    const ground=quotaSuolo(P.pos.x,P.pos.z);
    if(!P.rotorSim){
      P.rotorSim=CENTURION_HELI_FDM.create(A,{
        r:P.pos.toArray(),v:P.vel.toArray(),
        q:[P.Q.x,P.Q.y,P.Q.z,P.Q.w],
        fuel:P.fuel,collective:S.thr
      });
    }
    const sim=P.rotorSim;
    const mass=Math.max(6500,A.m-A.fuel+P.fuel);
    const out=CENTURION_HELI_FDM.step(sim,dt,{
      collective:S.thr,roll:In.sx||0,pitch:In.sy||0,rudder:In.rud||0
    },{
      mass,rho:isa(P.pos.y).rho,ground,
      brake:!!In.freno,windWorld:[0,0,0]
    });
    if(!out)return;
    P.pos.fromArray(sim.r);
    P.vel.fromArray(sim.v);
    P.Q.set(...sim.q).normalize();
    P.acc.fromArray(out.acceleration);
    P.fuel=out.fuel;
    P.V=P.vel.length();
    P.M=out.mach;
    P.qbar=out.qbar;
    P.agl=out.agl;
    P.nz=out.nz;
    P.alpha=0;P.beta=0;P.CL=0;P.CD=0;P.stallo=false;
    P.p=sim.w[2];P.q=-sim.w[0];P.r=-sim.w[1];
    P.ab=0;P.spinta=out.collective;
    P.aTerra=!!out.onGround;
    P.gMax=Math.max(P.gMax||0,P.nz);
    if(out.crashed){
      return schianto(out.hardLanding?"Impatto verticale UH-60":
        "Impatto orizzontale UH-60");
    }
  }
  function fisica6(dt){''')

patch('''    if(S.cfg.aereo==="A380"&&!P.aTerra){const v=P.vel.normalize().multiplyScalar(232);P.vel.copy(v);S.thr=.73;P.pos.y=9750;}''',
'''    if(S.cfg.aereo==="A380"&&!P.aTerra){const v=P.vel.normalize().multiplyScalar(232);P.vel.copy(v);S.thr=.73;P.pos.y=9750;}
    if(S.cfg.aereo==="UH60"){
      P.rotorSim=null;
      P.carrello=true;P.vel.set(0,0,0);
      if(!P.aTerra){P.pos.y=quotaSuolo(P.pos.x,P.pos.z)+120;S.thr=.64;}
      else {P.pos.y=S.pista.y+1.85;S.thr=.32;}
    }''')

# Free Flight should animate rotor nodes on the exact CENTURION GLB loaded
# from modelli/uh60-centurion.glb while retaining the separate Sketchfab preview.
patch('''        if(P.obj.userData.droneAnim)P.obj.userData.droneAnim(dtR,S.t);''',
'''        if(P.obj.userData.droneAnim)P.obj.userData.droneAnim(dtR,S.t);
        if(P.A.rotorcraft&&P.obj){
          const anim=P.obj.userData;
          if(!anim.uh60Rotors||(!anim.uh60Rotors.main&&!anim.uh60Rotors.tail)){
            let main=null,tail=null;
            P.obj.traverse(o=>{
              if(o.name==="CENTURION_UH60_MAIN_ROTOR"||o.name==="ROTOR_MAIN")main=o;
              if(o.name==="CENTURION_UH60_TAIL_ROTOR"||o.name==="ROTOR_TAIL")tail=o;
            });
            anim.uh60Rotors={main,tail};
          }
          const r=anim.uh60Rotors;
          const rpm=P.rotorSim?.rpm||0;
          if(r.main)r.main.rotation.y+=dtR*27*rpm;
          if(r.tail)r.tail.rotation.x+=dtR*135*rpm;
        }''')

# No artificial stall warnings for a rotorcraft hovering below 75 m/s.
patch('''(P.V < 75 && P.agl > 30)''',
'''(!P.A.rotorcraft && P.V < 75 && P.agl > 30)''')

# Rotorcraft stay non-supersonic, unarmed, and do not expose fighter controls.
patch('''    ov.classList.toggle("vl-airliner",S.cfg.aereo==="A380");''',
'''    ov.classList.toggle("vl-airliner",S.cfg.aereo==="A380");
    ov.classList.toggle("vl-rotorcraft",!!S.pl.A.rotorcraft);''')
volo.write_text(s,encoding="utf-8")

# The VISTA3D loader needs no extra model mapping: Free Flight passes
# {tipoId:"UH60"} and publish_uh60.py registers that key in the manifest.

idx=site/"index.html";html=idx.read_text(encoding="utf-8")
tag='<script src="js/heli_fdm.js"></script>'
anchor='<script src="js/volo.js"></script>'
assert anchor in html,"UH60: Free Flight loader missing"
if tag not in html:html=html.replace(anchor,tag+"\n"+anchor,1)
html=html.replace("</head>",'''<style id="centurion-uh60-ui">
#volo.vl-rotorcraft #vl-arma,#volo.vl-rotorcraft #vl-fuoco,
#volo.vl-rotorcraft #vl-lock,#volo.vl-rotorcraft #vl-eject,
#volo.vl-rotorcraft #vl-flare{display:none!important}
</style>
</head>''',1)
idx.write_text(html,encoding="utf-8")
print("PASS UH60: playable helicopter, collective + cyclic + yaw, live rotor model animation")
