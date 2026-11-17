#!/usr/bin/env python3
"""Switch CENTURION Free Flight to rigid-body 6-DOF flight physics.

Fixed wings use the 6-DOF air equations, runway contact remains a constrained
ground roll, and quadrotors use a differential four-rotor thrust model.
"""
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")
p=root/"js"/"volo.js"
s=p.read_text(encoding="utf-8")
def patch(a,b):
    global s
    n=s.count(a)
    if n!=1:raise RuntimeError(f"6DOF anchor count {n}: {a[:130]}")
    s=s.replace(a,b,1)

# Earlier mobile free-flight patch inserts an assisted quadcopter method. We
# replace that dispatch, not the entire legacy fallback, to keep the runway,
# crash, audio, HUD, camera and weapons integration functional.
patch(
'''    if(A.drone==="quad")return fisicaQuad(dt);''',
'''    if(A.drone==="quad" || !P.aTerra)return fisica6(dt);'''
)
patch(
'''  function fisica(dt) {
    const P = S.pl, A = P.A, In = S.in; if (!P.vivo) return;''',
'''  function fisica6(dt){
    const P=S.pl,A=P.A,In=S.in;
    if(!P.vivo || S.fine)return;
    const quad=A.drone==="quad";
    const m=Math.max(.2,A.m-A.fuel/2+P.fuel);
    const at=isa(P.pos.y);
    const speed=P.vel.length();
    const mach=speed/Math.max(1,at.a);
    if(!P.rigid6){
      P.rigid6=CENTURION_FDM6.create(A,{
        r:P.pos.toArray(),v:P.vel.toArray(),
        q:[P.Q.x,P.Q.y,P.Q.z,P.Q.w],
        w:[0,0,0]
      });
    }
    const sim=P.rigid6;
    const terrain=quotaSuolo(P.pos.x,P.pos.z);
    const agl=Math.max(0,P.pos.y-terrain);
    let thrust=0;
    if(!quad){
      const thr=P.danno?Math.min(S.thr,.72):S.thr;
      const mil=thr<=.8?.05+.95*thr/.8:1;
      const ab=thr>.8?(thr-.8)/.2:0;
      P.spinta+=(mil-P.spinta)*(1-Math.exp(-dt/1.4));
      P.ab+=(ab-P.ab)*(1-Math.exp(-dt/.6));
      if(P.fuel<=0){P.spinta=0;P.ab=0;}
      const eng=CENTURION_AERO.engine(A,at,mach,P.spinta,P.ab);
      thrust=eng.thrust;
      const burn=(A.Tmil*P.spinta*2.2e-5+
        Math.max(0,A.Tab-A.Tmil)*P.ab*5.5e-5)*eng.lapse*dt;
      P.fuel=Math.max(0,P.fuel-burn);
    }else{
      P.spinta=Math.max(0,Math.min(1,S.thr));
      P.ab=0;
      P.fuel=Math.max(0,P.fuel-dt*(.00028+.00035*Math.abs(S.thr-.5)));
    }
    const outputs=CENTURION_FDM6.step(sim,dt,{
      roll:In.sx||0,pitch:In.sy||0,rudder:In.rud||0,throttle:P.fuel>0?S.thr:0
    },{
      mass:m,thrust:P.fuel>0?thrust:0,
      agl,gear:P.carrello,
      brake:!!In.freno,
      windWorld:[0,0,0]
    });
    if(!outputs)return;
    P.pos.fromArray(sim.r);
    P.vel.fromArray(sim.v);
    P.Q.set(...sim.q).normalize();
    P.acc.fromArray(outputs.acceleration);
    P.M=outputs.mach;
    P.V=P.vel.length();
    P.qbar=outputs.qbar;
    P.alpha=outputs.alpha;
    P.beta=outputs.beta;
    P.CL=outputs.CL;
    P.CD=outputs.CD;
    P.nz=outputs.nz;
    P.stallo=!!outputs.stalled;
    P.p=sim.w[2];
    P.q=-sim.w[0];
    P.r=-sim.w[1];
    P.agl=P.pos.y-quotaSuolo(P.pos.x,P.pos.z);
    P.gMax=Math.max(P.gMax||0,P.nz);
    if(quad){
      P.carrello=false;
      if(P.agl<2.2){
        P.pos.y+=2.2-P.agl;
        P.rigid6.r[1]=P.pos.y;
        if(P.vel.y<0){P.vel.y=0;P.rigid6.v[1]=0;}
        P.agl=2.2;
        P.aTerra=S.thr<.48;
      }else P.aTerra=false;
      return;
    }
    if(P.agl<2.2){
      assi(P.Q);
      const roll=Math.atan2(-_rt.y,_up.y)*R2D;
      const pitch=Math.asin(clamp(_fwd.y,-1,1))*R2D;
      const sink=-P.vel.y;
      const inPista=S.pista&&
        Math.abs(quotaSuolo(P.pos.x,P.pos.z)-S.pista.y)<.01;
      if(P.carrello&&sink<4.5&&Math.abs(roll)<12&&pitch>-4&&pitch<20&&inPista){
        P.aTerra=true;P.pos.y+=2.2-P.agl;P.vel.y=0;
        P.rigid6=null;P.agl=2.2;P.p=P.q=P.r=0;
        messaggio("TOUCHDOWN",2);
        if(sink>2.8)messaggio("ATTERRAGGIO DURO",2);
      }else schianto(P.carrello&&!inPista?"Atterraggio fuori pista":"Impatto al suolo");
    }
  }
  function fisica(dt) {
    const P = S.pl, A = P.A, In = S.in; if (!P.vivo) return;'''
)
# After the runway lifts off, capture the corrected departing pose on the next
# 6DOF tick. Ensure old state is not retained for a new sortie.
patch(
'''  function partenza() {
    const P = S.pl; const sc = APP.sc;''',
'''  function partenza() {
    const P = S.pl; P.rigid6=null; const sc = APP.sc;'''
)
# No modifications to the mission 3D animation engine, which replays tactical
# positions instead of a continuously controlled pilot aircraft.
p.write_text(s,encoding="utf-8")
print("PASS: 6DOF rigid-body flight integrated with Free Flight aircraft, quadrotors and runway contact")
