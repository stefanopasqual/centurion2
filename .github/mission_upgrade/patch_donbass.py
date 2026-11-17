#!/usr/bin/env python3
"""Add a fictionalized Donbass observation mission and non-weaponized UAVs.
The area tiles correspond to geographic imagery, but every base/track is simulated.
No real unit positions, real combat tactics or attack targets are modeled.
"""
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")
p=root/"js"/"missioni.js"
s=p.read_text(encoding="utf-8")
anchor="  function trova(id) { return ELENCO.find(m => m.id === id); }"
assert anchor in s,"Mission catalog changed"
mission=r'''
  // Training sandbox: fictional facilities/trajectories; regional imagery only.
  ELENCO.push({
    id:"M12", codice:"DONBASS UAV", titolo:"Donbass · ricognizione con droni",
    tipo:"Ricognizione non armata / gestione delle informazioni", difficolta:3,
    durata:"3 h (simulazione)",
    focus:"Qualita delle osservazioni, incertezza, meteo e sicurezza del volo",
    descrizione:"Scenario didattico ambientato nel Donbass con basi e rotte inventate. Droni da ricognizione non armati, telemetria e osservazione 3D. Non rappresenta la situazione militare reale.",
    domande:[
      "Quale informazione era osservata e quale solo ipotizzata?",
      "Come avete gestito una telemetria incompleta?",
      "Avete rispettato la priorita di non mettere persone a rischio?"
    ],
    applica: sc => {
      Object.assign(sc.tempo,{inizio:"09:00",fine:"12:00"});
      Object.assign(sc.mappa,{
        centro:[48.03,37.77],zoom:10,tile_default:"osm",
        bullseye:{nome:"CENTRO ESERCITAZIONE",lat:48.03,lon:37.77},
        nazioni:[],fir_boundary:[],
        sectional:{file:"",bounds:[[47.4,36.8],[48.7,38.8]],opacita:0,attivo:false},
        griglia:{attiva:true,lato_nm:10,origine:[47.4,36.8],colonne:13,righe:10}
      });
      sc.meteo={vento_da_gradi:250,vento_kt:12,descrizione:"Visibilita variabile, nubi sparse; condizioni illustrative, non METAR reali",temporali_costa:false,visibilita_target:"variabile"};
      sc.squadre.BLUE.nome="Squadra osservazione";
      sc.squadre.BLUE.ruolo="Sorveglianza e sicurezza dei voli";
      sc.squadre.RED.nome="Squadra controllo dello spazio aereo";
      sc.squadre.RED.ruolo="Separazione del traffico e procedure di sicurezza";
      sc.basi=[
        {id:"SIM_OVEST",nome:"Campo simulato Ovest (fittizio)",lato:"BLUE",lat:48.10,lon:37.31,nazione:"Area addestrativa",pista_ft:6200},
        {id:"SIM_EST",nome:"Campo simulato Est (fittizio)",lato:"RED",lat:47.97,lon:38.20,nazione:"Area addestrativa",pista_ft:6200}
      ];
      sc.aar=[{id:"AAR_SIM",nome:"Circuito rifornimento simulato",lat:48.1,lon:37.2,quota_ft:20000,orient:90,lunghezza_nm:18}];
      sc.orbite=[];
      sc.gate=[{id:"GATE_N",nome:"Punto esercitazione Nord",lat:48.23,lon:37.76},
               {id:"GATE_C",nome:"Punto esercitazione Centro",lat:48.03,lon:37.65},
               {id:"GATE_S",nome:"Punto esercitazione Sud",lat:47.83,lon:37.68}];
      sc.cap_box=[
        {id:"CAPB_W",nome:"Area sicura di osservazione",lato:"BLUE",lat:48.02,lon:37.64,raggio_nm:14},
        {id:"CAP1",nome:"Area monitoraggio traffico",lato:"RED",lat:47.99,lon:38.02,raggio_nm:14}
      ];
      sc.formazioni=[
        {id:"CENTURION",callsign:"CENTURION",lato:"BLUE",tipo:"F16",numero:2,base:"SIM_OVEST",ruolo:"AIR SAFETY"},
        {id:"TITAN",callsign:"TITAN",lato:"BLUE",tipo:"F22",numero:2,base:"SIM_OVEST",ruolo:"ESCORT"},
        {id:"IVAN1",callsign:"CONTROL",lato:"RED",tipo:"SU35",numero:2,base:"SIM_EST",ruolo:"AIRSPACE CONTROL"}
      ];
      sc.sam=[];sc.target=[];
      sc.droni=[
        {id:"UAV-01",nome:"Ricognitore ad ala fissa",tipo:"fixed",lat:48.02,lon:37.67,quota_m:900,raggio_m:1500},
        {id:"UAV-02",nome:"Multirotore di osservazione",tipo:"quad",lat:48.07,lon:37.78,quota_m:230,raggio_m:420},
        {id:"UAV-03",nome:"Ricognitore ad ala fissa B",tipo:"fixed",lat:47.98,lon:37.87,quota_m:1100,raggio_m:2000}
      ];
      sc.obiettivi=[{tipo:"perdite_max",massimo:0,primario:true,
        testo:"Completare la sessione senza perdere velivoli"}];
      Object.assign(sc.briefing.BLUE,{
        titolo:"DONBASS UAV · SIMULAZIONE NON BELLICA",
        situazione:"Addestramento virtuale in un'area geografica ispirata al Donbass. Basi, rotte e traffico sono interamente fittizi. I tre droni sono non armati.",
        task:["Osservare i tre droni nella scena 3D","Distinguere dati di telemetria reali del simulatore da ipotesi","Concludere senza incidenti"],
        threat:"Solo meteo, visibilita e gestione dello spazio aereo simulati; nessuna forza reale rappresentata.",
        intel:["Droni virtuali con moto continuo e orbite illustrative","Nessun feed video o dato militare reale"],
        roe:["Divieto di impiego delle armi in questa esercitazione"],
        da_sapere:["Visualizza i droni nella scena Mondo 3D","Il terreno e la cartografia sono regionali, non una ricostruzione storica verificata"],
        output_plan:["Monitoraggio dei voli","Valutazione dell'affidabilita dei dati","Debrief"]
      });
      Object.assign(sc.briefing.RED,{
        titolo:"DONBASS UAV · CONTROLLO DELLO SPAZIO AEREO",
        situazione:"Esercitazione di separazione del traffico simulato, senza riferimenti a reparti o infrastrutture reali.",
        task:["Monitorare il traffico dell'esercitazione","Prevenire incidenti","Registrare anomalie di telemetria"],
        threat:"Nessuna minaccia militare reale nel modello.",intel:["Tutti i tracciati sono inventati"],
        roe:["Esercitazione senza ingaggi"],da_sapere:["Tre droni non armati"],
        output_plan:["Segnalazioni","Sicurezza","Debrief"]
      });
    }
  });
'''
s=s.replace(anchor,mission+"\n"+anchor,1)
s=s.replace('if (!m || m.base) { DEMO.pianiDemo(sc); return; }','if (!m || m.base || !m.demo) { DEMO.pianiDemo(sc); return; }',1)
s=s.replace('12 missioni pronte per il workshop','13 missioni nel catalogo',1)
p.write_text(s,encoding="utf-8")
print("Donbass M12: fictional nonweaponized UAV observation mission added")
