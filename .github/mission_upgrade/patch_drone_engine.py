#!/usr/bin/env python3
"""Nonweaponized adversarial drone NPCs and observation-only mission objectives."""
from pathlib import Path
import sys
p=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")/"js"/"engine.js"
s=p.read_text(encoding="utf-8")
def patch(old,new):
 global s
 assert s.count(old)==1,"Drone engine anchor missing/multiple: "+old[:100]
 s=s.replace(old,new,1)
patch("this.flights = sc.formazioni.map(f => this.nuovoFlight(sc.tipi[f.tipo] ? f : { ...f, tipo: Object.keys(sc.tipi)[0] }));",
"""this.flights = sc.formazioni.map(f => this.nuovoFlight(sc.tipi[f.tipo] ? f : { ...f, tipo: Object.keys(sc.tipi)[0] }));
    this.droni=(sc.droni||[]).map((d,i)=>({
      ...d,index:i,lat0:d.lat,lon0:d.lon,visibile:false,
      identificato:false,allontanato:false,tApertura:this.t+360+i*180,
      tFine:this.t+2250+i*220,stato:"non rilevato"
    }));""")
patch("    this.aggiornaSamIngaggi();\n    this.registra();",
      "    this.aggiornaSamIngaggi();\n    this.aggiornaDroni(dt);\n    this.registra();")
anchor="  aggiornaInject() {"
extra=r'''
  // All UAV trajectories are invented, nonweaponized and not intended to
  // model real-world surveillance or engagement capabilities.
  aggiornaDroni(dt) {
    if(!this.droni || !this.droni.length)return;
    const elapsed=this.t-Engine.hm2s(this.sc.tempo.inizio);
    this.droni.forEach(d=>{
      const phase=elapsed/(d.tipo==="quad"?580:710)+d.index*1.41;
      const r=Math.max(200,Math.min(2600,d.raggio_m||800));
      d.lat=d.lat0+Math.sin(phase)*r/111320;
      d.lon=d.lon0+Math.cos(phase*.78)*r/(111320*Math.cos(d.lat0*Math.PI/180));
      d.tempo=elapsed;
      if(this.t>=d.tApertura&&!d.visibile) {
        d.visibile=true;d.stato=d.ostile?"eco sconosciuto":"osservazione";
        this.evento("UAV",d.nome+" - contatto aereo simulato da classificare","avviso");
      }
      if(d.ostile&&d.identificato&&!d.allontanato&&this.t>=d.tFine){
        d.allontanato=true;d.stato="allontanato";
        this.evento("UAV",d.nome+" - contatto uscito dalla zona simulata","sistema");
      }
    });
  }
  identificaDrone(id) {
    const d=(this.droni||[]).find(x=>x.id===id);
    if(!d)return {ok:false,msg:"Contatto UAV non disponibile"};
    if(!d.visibile)return {ok:false,msg:"Traccia non ancora rilevata"};
    if(d.identificato)return {ok:true,msg:"Contatto gia identificato"};
    d.identificato=true;d.stato=d.ostile?"UAV RED identificato":"UAV osservazione";
    this.evento("UAV",d.nome+" - classificazione confermata dal Trainer","blue");
    return {ok:true,msg:d.nome+" identificato"};
  }
'''
patch(anchor,extra+"\n"+anchor)
patch("      return { n: i + 1, testo: o.testo",
'''      else if (o.tipo === "uav_identificati") {
        const n=(this.droni||[]).filter(d=>d.ostile&&d.identificato).length;
        const min=o.minimo||1;ok=n>=min;prog=n+"/"+min;
        if(!ok&&fine)fallito=true;
      } else if (o.tipo === "uav_allontanati") {
        const n=(this.droni||[]).filter(d=>d.ostile&&d.allontanato).length;
        const min=o.minimo||1;ok=n>=min;prog=n+"/"+min;
        if(!ok&&fine)fallito=true;
      }
      return { n: i + 1, testo: o.testo''')
p.write_text(s,encoding="utf-8")
print("Drone NPCs and non-kinetic observation objectives installed.")
