#!/usr/bin/env python3
"""Enable all actual CENTURION airframes in Free Flight with cockpit POV/FPV.
Postprocesses volo.js after cockpit and render fixes; gameplay physics only.
"""
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")
p=root/"js"/"volo.js";s=p.read_text(encoding="utf-8")
def patch(a,b):
 global s
 n=s.count(a)
 if n!=1:raise RuntimeError("Fleet anchor mismatch: "+str(n)+" "+a[:90])
 s=s.replace(a,b,1)

extra=r'''
    SU35:{nome:"Sukhoi Su-35S Flanker-E",icona:"su35",m:24000,S:62,Tmil:172000,Tab:284000,cd0:.020,k:.135,cla:3.35,amax:29,astall:34,pmax:210,gmax:9,gneg:3,fuel:9000,colpi:150,cannone:"30 mm",carico:{AIM120:4,AIM9X:2,AGM65:0}},
    SU57:{nome:"Sukhoi Su-57 Felon",icona:"su57",m:27000,S:78,Tmil:186000,Tab:300000,cd0:.018,k:.145,cla:3.55,amax:34,astall:38,pmax:235,gmax:9,gneg:3,fuel:10300,colpi:150,cannone:"30 mm",carico:{AIM120:4,AIM9X:2,AGM65:0}},
    EA18:{nome:"Boeing EA-18G Growler",icona:"ea18",m:23400,S:46.5,Tmil:96000,Tab:156000,cd0:.025,k:.17,cla:3.15,amax:24,astall:28,pmax:160,gmax:7.5,gneg:3,fuel:5800,colpi:0,cannone:"Nessuno",carico:{AIM120:2,AIM9X:2,AGM65:0}},
    KC30:{nome:"Airbus KC-30 / A330 MRTT",icona:"kc30",nonArmato:true,noEject:true,m:160000,S:361,Tmil:480000,Tab:480000,cd0:.025,k:.061,cla:5.1,amax:14,astall:16,pmax:42,gmax:2.5,gneg:1,fuel:72000,colpi:0,cannone:"Nessuno",carico:{}},
    E7:{nome:"Boeing E-7 Wedgetail",icona:"e7",nonArmato:true,noEject:true,m:65000,S:125,Tmil:225000,Tab:225000,cd0:.026,k:.076,cla:4.7,amax:14,astall:17,pmax:55,gmax:2.5,gneg:1,fuel:23000,colpi:0,cannone:"Nessuno",carico:{}},
    UAV_FIXED:{nome:"UAV ad ala fissa · ricognizione",icona:"uav-fixed",drone:"fixed",nonArmato:true,noEject:true,m:28,S:4.7,Tmil:115,Tab:115,cd0:.041,k:.095,cla:3.7,amax:18,astall:19,pmax:80,gmax:3.5,gneg:1.5,fuel:10,colpi:0,cannone:"Nessuno",carico:{}},
    UAV_QUAD:{nome:"UAV quadricottero · osservazione",icona:"uav-quad",drone:"quad",nonArmato:true,noEject:true,m:6,S:.55,Tmil:75,Tab:75,cd0:.07,k:.10,cla:2.5,amax:15,astall:20,pmax:90,gmax:2,gneg:1.5,fuel:3,colpi:0,cannone:"Nessuno",carico:{}}
'''
patch('  };\n  /* ---------- armi ---------- */',',\n'+extra+'  };\n  /* ---------- armi ---------- */')

patch('''    P.obj = modello(A.icona, S.cfg.aereo, undefined, "01"); if (S.cfg.ora === "notte") luciNav(P.obj, 5, 15);''',
'''    if(A.drone){
      const factory=window.CENTURION_REALISM;
      if(!factory || !factory.drone)throw new Error("Missing shared drone model generator");
      const d=factory.drone(A.drone==="quad");
      const g=new THREE.Group();g.add(d.g);g.userData.mdl=d.g;g.userData.droneAnim=d.animate;
      P.obj=g;scene.add(g);
    }else P.obj=modello(A.icona,S.cfg.aereo,undefined,"01");
    if(S.cfg.ora==="notte")luciNav(P.obj,A.drone?2:5,A.drone?4:15);''')
patch('''    P.M = 0; P.agl = 0; P.qbar = 0;''','''    if(AEREI[S.cfg.aereo]?.drone){
      const kind=AEREI[S.cfg.aereo].drone,b=S.pista,hdg=b.hdg*D2R;
      P.pos.set(b.x,b.y+(kind==="quad"?95:450),b.z);
      P.Q.copy(quatDaAssetto(hdg,0,0));
      P.vel=kind==="quad"?V3():V3(Math.sin(hdg),0,-Math.cos(hdg)).multiplyScalar(29);
      P.aTerra=false;P.carrello=false;S.thr=kind==="quad"?.5:.58;
    }
    P.M = 0; P.agl = 0; P.qbar = 0;''')
patch('''  function fisica(dt) {
    const P = S.pl, A = P.A, In = S.in; if (!P.vivo) return;''',
'''  function fisicaQuad(dt){
    const P=S.pl;if(!P.vivo)return;
    const In=S.in;
    const yaw=(In.sx*.65+In.rud*.9)*dt;
    P.Q.premultiply(new THREE.Quaternion().setFromAxisAngle(V3(0,1,0),yaw));
    assi(P.Q);
    const wanted=_fwd.clone().setY(0).normalize().multiplyScalar(In.sy*13)
      .addScaledVector(_rt.clone().setY(0).normalize(),In.rud*7);
    wanted.y=(S.thr-.5)*15;
    P.vel.lerp(wanted,Math.min(1,dt*2.7));
    P.pos.addScaledVector(P.vel,dt);
    const ground=quotaSuolo(P.pos.x,P.pos.z);
    if(P.pos.y<ground+2.4){P.pos.y=ground+2.4;P.vel.y=Math.max(0,P.vel.y);}
    P.aTerra=P.pos.y<=ground+2.45&&S.thr<.46;P.agl=P.pos.y-ground;P.V=P.vel.length();
    P.M=P.V/isa(P.pos.y).a;P.alpha=0;P.nz=1;P.p=0;P.q=0;P.r=yaw/Math.max(dt,.0001);
    P.ab=0;P.spinta=Math.max(0,S.thr);
    P.fuel=Math.max(0,P.fuel-dt*(.00028+.00035*Math.abs(S.thr-.5)));
  }
  function fisica(dt) {
    const P = S.pl, A = P.A, In = S.in; if (!P.vivo) return;
    if(A.drone==="quad")return fisicaQuad(dt);''')
patch('''  function avvia(cfg) {
    distruggiScena();''',
'''  function avvia(cfg) {
    if(AEREI[cfg.aereo]?.drone)cfg.partenza="volo";
    distruggiScena();''')
patch('''    if (!S || S.pausa || !S.pl.vivo) return; const P = S.pl;
    if (S.arma === "GUN") return;''',
'''    if (!S || S.pausa || !S.pl.vivo) return; const P = S.pl;
    if(P.A.nonArmato){messaggio("VELIVOLO NON ARMATO",1.5);return;}
    if (S.arma === "GUN") return;''')
patch('''    const P = S.pl; const fuoco = S.in.fuoco && S.arma === "GUN"''',
'''    const P = S.pl; const fuoco = !P.A.nonArmato && S.in.fuoco && S.arma === "GUN"''')
patch('''  function blocca() {
    if (!S || !S.pl.vivo) return;''',
'''  function blocca() {
    if (!S || !S.pl.vivo) return;
    if(S.pl.A.nonArmato){messaggio("NESSUN SISTEMA D'ARMA",1.5);return;}''')
patch('''  function cambiaArma() {
    if (!S) return; const P = S.pl;''',
'''  function cambiaArma() {
    if (!S) return; const P = S.pl;if(P.A.nonArmato)return;''')
patch('''    if (!S || S.pausa || S.fine || S.eiez) return; const P = S.pl;''',
'''    if (!S || S.pausa || S.fine || S.eiez) return; const P = S.pl;
    if(P.A.noEject){messaggio("EIEZIONE NON DISPONIBILE",1.5);return;}''')
patch('''  function carrello() { if (!S || !S.pl.vivo) return; const P = S.pl;''',
'''  function carrello() { if (!S || !S.pl.vivo) return; const P = S.pl;
    if(P.A.drone)return;''')
patch('''      if (P.obj && P.vivo) { P.obj.position.copy(P.pos); P.obj.quaternion.copy(P.Q); const md = P.obj.userData.mdl; if (md && md.userData.anim) md.userData.anim({ rollRate: P.p * R2D, pitchRate: P.q * R2D, yawRate: P.r * R2D, afterburner: P.ab, t: S.t }); }''',
'''      if(P.obj&&P.vivo){
        P.obj.position.copy(P.pos);P.obj.quaternion.copy(P.Q);
        const md=P.obj.userData.mdl;
        if(md&&md.userData.anim)md.userData.anim({rollRate:P.p*R2D,pitchRate:P.q*R2D,yawRate:P.r*R2D,afterburner:P.ab,t:S.t});
        if(P.obj.userData.droneAnim)P.obj.userData.droneAnim(dtR,S.t);
        if(P.A.drone==="quad"&&md){
          md.rotation.z+=(Math.max(-.13,Math.min(.13,S.in.rud*.13))-md.rotation.z)*Math.min(1,dtR*5);
          md.rotation.x+=(Math.max(-.15,Math.min(.15,S.in.sy*.15))-md.rotation.x)*Math.min(1,dtR*5);
        }
      }''')
patch('''camera.position.copy(seat || P.pos.clone().addScaledVector(_up,1.2).addScaledVector(_fwd,3.2));''',
'''camera.position.copy(P.A.drone
        ? P.pos.clone().addScaledVector(_fwd,P.A.drone==="quad"?.55:1.85).addScaledVector(_up,P.A.drone==="quad"?-.08:.18)
        : (seat || P.pos.clone().addScaledVector(_up,1.2).addScaledVector(_fwd,3.2)));''')
patch('''    if(window.CENTURION_COCKPIT){
      const p=S.pl; assi(p.Q);''',
'''    if(S.pl.A.drone && (S.cam==="cockpit"||S.cam==="helmet")){
      const p=S.pl;hud.save();hud.font="600 13px monospace";hud.textAlign="left";hud.fillStyle="#a8ffcd";
      hud.fillText("UAV FPV · SIMULAZIONE NON ARMATA",18,Math.min(100,hudC.height*.14));
      hud.fillText("AGL "+Math.round((p.agl||0)*FT)+" ft · "+Math.round(p.V*KT)+" kt",18,Math.min(122,hudC.height*.18));
      hud.restore();
    }
    if(window.CENTURION_COCKPIT){
      const p=S.pl; assi(p.Q);''')
patch('''    ov.classList.toggle("touch", mobile()); clock = new THREE.Clock();''',
'''    ov.classList.toggle("touch", mobile());
    ov.classList.toggle("vl-unarmed",!!S.pl.A.nonArmato);
    ov.classList.toggle("vl-drone",!!S.pl.A.drone);
    ov.classList.toggle("vl-no-eject",!!S.pl.A.noEject);
    clock = new THREE.Clock();''')
patch('''const carico = () => { const A = AEREI[p.aereo]; m.querySelector("#vl-carico").innerHTML =''',
'''const carico = () => { const A = AEREI[p.aereo]||AEREI.F16;
      m.querySelectorAll('[data-k="partenza"][data-v="pista"]').forEach(b=>b.style.display=A.drone?"none":"");
      if(A.nonArmato){
        m.querySelector("#vl-carico").textContent=A.nome+" · NON ARMATO · POV/FPV · fisica approssimata";
        return;
      }
      m.querySelector("#vl-carico").innerHTML =''')
patch('''p[k] = v; salvaPref(p);''',
'''p[k] = v;
      if(k==="aereo"&&AEREI[v]?.nonArmato){p.nemici=0;p.sam=false;}
      if(k==="aereo"&&AEREI[v]?.drone)p.partenza="volo";
      salvaPref(p);''')
p.write_text(s,encoding="utf-8")
idx=root/"index.html";html=idx.read_text(encoding="utf-8")
style="""<style id="centurion-freeflight-fleet">
#volo.vl-unarmed #vl-fuoco,#volo.vl-unarmed #vl-lock,#volo.vl-unarmed #vl-arma,
#volo.vl-unarmed #vl-flare,#volo.vl-no-eject #vl-eject,
#volo.vl-drone #vl-carrello,#volo.vl-drone #vl-freno{display:none!important}
</style>"""
if "centurion-freeflight-fleet" not in html:
 assert "</head>" in html
 html=html.replace("</head>",style+"\n</head>",1)
idx.write_text(html,encoding="utf-8")
print("PASS: 11 flyable aircraft: 7 fighters, KC30, E7, two original UAVs.")
