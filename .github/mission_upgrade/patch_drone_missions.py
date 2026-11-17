#!/usr/bin/env python3
"""Expand Donbass toward Zaporizhzhia with three fictional adversarial-UAV scenarios.
The power station is a recognizable but deliberately non-operational illustration.
"""
from pathlib import Path
import sys
p=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")/"js"/"missioni.js"
s=p.read_text(encoding="utf-8")
for old,new in [
 ('centro:[48.03,37.77],zoom:10,tile_default:"osm",',
  'centro:[47.94,36.48],zoom:8,tile_default:"sat",bounds:[[47.20,34.40],[48.38,38.48]],'),
 ('sectional:{file:"",bounds:[[47.4,36.8],[48.7,38.8]],opacita:0,attivo:false},',
  'sectional:{file:"",bounds:[[47.20,34.40],[48.38,38.48]],opacita:0,attivo:false},'),
 ('griglia:{attiva:true,lato_nm:10,origine:[47.4,36.8],colonne:13,righe:10}',
  'griglia:{attiva:true,lato_nm:15,origine:[47.20,34.42],colonne:13,righe:5}'),
 ('      sc.sam=[];sc.target=[];',
  '''      // Civilian landmark, deliberately NOT at the actual facility footprint.
      sc.znpp={lat:47.63,lon:35.06,
        descrizione:"Complesso civile illustrativo ispirato a Zaporižžja; geometria e posizione inventate",
        illustrative:true,protected:true};
      sc.sam=[];sc.target=[];''')
]:
 assert s.count(old)==1,"Donbass patch anchor missing: "+old[:50]
 s=s.replace(old,new,1)
anchor='  function trova(id) { return ELENCO.find(m => m.id === id); }'
assert s.count(anchor)==1
addition=r'''
  /* Donbass/Zaporizhzhia UAV scenarios: enemy is a fictional, unarmed drone
     NPC. No real operational approach routes or target positions. */
  const uavBase=ELENCO.find(m=>m.id==="M12");
  function setDroneMission(sc,mode) {
    uavBase.applica(sc);
    sc.formazioni=[
      {id:"CENTURION",callsign:"CENTURION",lato:"BLUE",tipo:"F16",numero:2,base:"SIM_OVEST",ruolo:"AIR SAFETY"},
      {id:"TITAN",callsign:"TITAN",lato:"BLUE",tipo:"F22",numero:2,base:"SIM_OVEST",ruolo:"AIR SAFETY"}
    ];
    sc.squadre.RED.nome="Droni avversari simulati";
    sc.squadre.RED.ruolo="Contatti non cooperativi, senza armamento";
    const drone=(id,lat,lon,quad=false)=>({id,nome:"ECO OSTILE "+id,tipo:quad?"quad":"fixed",
      lato:"RED",ostile:true,lat,lon,quota_m:quad?220:840,raggio_m:quad?510:1800});
    sc.droni=mode==="identify" ? [
      drone("ALFA",48.04,37.12),drone("BRAVO",47.91,36.74),
      drone("CHARLIE",47.84,36.02,true)
    ] : mode==="civilian" ? [
      drone("KILO",48.02,36.51),drone("LIMA",47.81,36.22,true),
      drone("MIKE",48.15,37.01)
    ] : [
      drone("01",48.09,37.13,true),drone("02",47.97,36.73,true),
      drone("03",48.16,36.64,true),drone("04",47.73,36.19),
      drone("05",48.24,37.54)
    ];
    const min=mode==="swarm"?4:2;
    sc.obiettivi=[
      {tipo:"uav_identificati",minimo:min,primario:true,
       testo:"Identificare almeno "+min+" droni RED tramite osservazione"},
      {tipo:"perdite_max",massimo:0,primario:true,
       testo:"Nessuna perdita di velivoli: proteggere il traffico civile"},
      {tipo:"uav_allontanati",minimo:2,primario:false,
       testo:"Confermare l'allontanamento di almeno due contatti simulati"}
    ];
    sc.briefing.BLUE.titolo=mode==="civilian"?"ZAPORIŽŽJA · SPAZIO CIVILE PROTETTO":
      mode==="swarm"?"DONBASS · SCIAME FANTASMA":"DONBASS · DRONE SHADOW";
    sc.briefing.BLUE.situazione="Droni NPC RED non cooperativi nel Donbass occidentale. La regione geografica esiste, ma le unità, i campi e le traiettorie sono fittizi.";
    sc.briefing.BLUE.task=["Identificare e classificare i droni avversari",
      "Leggere gli avvisi e la telemetria simulata",
      "Proteggere lo spazio civile senza attacchi cinetici"];
    sc.briefing.BLUE.threat="Contatti UAV ostili simulati, privi di armi e di obiettivi di attacco.";
    sc.briefing.BLUE.intel=["Telemetria generata dal gioco","Nessun dato operativo reale"];
    sc.briefing.BLUE.roe=["Nessun attacco alle infrastrutture civili","Nessun bersaglio reale"];
    sc.briefing.BLUE.da_sapere=[
      "La centrale 3D è una ricostruzione esterna illustrativa, non un gemello digitale",
      "La cartografia si estende fino a Zaporižžja"];
    sc.briefing.RED.titolo="DRONI RED · CONTROLLO NPC";
    sc.briefing.RED.situazione="Traffico aereo avversario interamente simulato";
    sc.briefing.RED.task=["Osservare i contatti RED","Analizzare gli errori di identificazione"];
    sc.briefing.RED.intel=["Nessun volo o schieramento militare reale"];
    sc.briefing.RED.roe=["Nessuna azione offensiva"];
    sc.piani={BLUE:null,RED:null};
  }
  [
    {id:"M13",codice:"DRONE SHADOW",titolo:"Donbass · droni nemici",
      tipo:"Riconoscimento droni RED",mode:"identify",difficolta:3,
      focus:"Identificare contatti ostili senza armi",
      descrizione:"Tre droni RED non cooperativi si muovono in uno scenario inventato nell'area del Donbass."},
    {id:"M14",codice:"CIVILIAN SHIELD",titolo:"Zaporižžja · centrale e droni",
      tipo:"Protezione spazio aereo civile",mode:"civilian",difficolta:3,
      focus:"Prudenza attorno alle infrastrutture civili",
      descrizione:"Centrale nucleare illustrativa a sei unità e droni avversari non armati. Nessuna simulazione di attacco."},
    {id:"M15",codice:"GHOST SWARM",titolo:"Donbass · sciame nemico",
      tipo:"Identificazione simultanea di droni",mode:"swarm",difficolta:4,
      focus:"Numerosi contatti e carico decisionale",
      descrizione:"Cinque droni RED da riconoscere e seguire senza impiego delle armi."}
  ].forEach(spec=>ELENCO.push({
    id:spec.id,codice:spec.codice,titolo:spec.titolo,tipo:spec.tipo,
    difficolta:spec.difficolta,durata:"3 h",focus:spec.focus,descrizione:spec.descrizione,
    domande:["Quali tracce erano state identificate correttamente?",
      "Avete evitato rischi per i civili?","Quali dati erano incerti?"],
    applica:sc=>setDroneMission(sc,spec.mode)
  }));
'''
s=s.replace(anchor,addition+"\n"+anchor,1)
needle='if (!m || m.base || !m.demo) { DEMO.pianiDemo(sc); return; }'
if needle in s:
 s=s.replace(needle,'''if (!m || m.base || !m.demo) {
      if(m && /^M1[2-5]$/.test(m.id)){
        sc.piani.BLUE={formazioni:{
          CENTURION:{decollo:"09:04",gate_in:"GATE_C",push:"09:15",cap:"CAPB_W",cap_min:55,gate_out:"GATE_C"},
          TITAN:{decollo:"09:08",gate_in:"GATE_N",push:"09:18",cap:"CAPB_W",cap_min:55,gate_out:"GATE_N"}
        }};
        sc.piani.RED={cap:[],prontezza:[],sam_moves:[],commit_nm:40};
      } else DEMO.pianiDemo(sc);
      return;
    }''',1)
s=s.replace("13 missioni nel catalogo","Missioni disponibili nel catalogo")
p.write_text(s,encoding="utf-8")
print("Donbass extended to Zaporizhzhia; three unarmed RED UAV NPC missions installed.")
