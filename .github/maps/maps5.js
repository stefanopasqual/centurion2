/* CENTURION2 - Five geographic flight arenas. Deployed by GitHub Actions. */
(()=>{
"use strict";
const REGIONS=[
{id:"giza",name:"Egitto · Piramidi di Giza",lat:29.9773,lon:31.1345,zoom:11,icon:"🏜️",desc:"Deserto, Giza, Sfinge e piramidi; monumenti 3D stilizzati."},
{id:"dolomiti",name:"Dolomiti · Tre Cime",lat:46.619,lon:12.303,zoom:10,icon:"🏔️",desc:"Pareti dolomitiche, valli alpine e quote reali."},
{id:"vladivostok",name:"Vladivostok · Russkij",lat:43.067,lon:131.912,zoom:10,icon:"🌉",desc:"Penisola, isole, porto e grandi ponti visibili da satellite."},
{id:"himalaya",name:"Himalaya · Everest",lat:27.9881,lon:86.925,zoom:10,icon:"🏔️",desc:"Everest, ghiacciai e terreno ad alta quota."},
{id:"sardegna",name:"Sardegna · Costa Smeralda",lat:41.025,lon:9.538,zoom:10,icon:"🏝️",desc:"Arcipelago della Maddalena, coste e rilievi sardi."}
];
const BASE=[40.85,-123.0], GEO_FIELDS=new Set(["centro","origine","etichetta","poligono","fir_boundary","bounds"]);
const clone=x=>JSON.parse(JSON.stringify(x));
function trasla(sc,r){
 const dy=r.lat-BASE[0],dx=r.lon-BASE[1];
 function coords(v){if(Array.isArray(v)&&v.length>=2&&typeof v[0]==="number"&&typeof v[1]==="number")return [v[0]+dy,v[1]+dx,...v.slice(2)];if(Array.isArray(v))return v.map(coords);return v;}
 function walk(o){if(!o||typeof o!=="object")return;
  if(!Array.isArray(o)&&typeof o.lat==="number"&&typeof o.lon==="number"){o.lat+=dy;o.lon+=dx;}
  if(Array.isArray(o)){o.forEach(walk);return;}
  for(const [k,v] of Object.entries(o)){if(GEO_FIELDS.has(k)&&Array.isArray(v)){o[k]=coords(v);}else if(v&&typeof v==="object")walk(v);}
 }
 walk(sc);
 sc.mappa.centro=[r.lat,r.lon];sc.mappa.zoom=r.zoom;sc.mappa.tile_default="sat";
 sc.mappa.sectional.attivo=false;sc.mappa.griglia.attiva=false;
 sc.mappa.nazioni=[];sc.mappa.fir_boundary=[];
 sc.meta.nome="CENTURION2 · "+r.name;
 sc.meta.note="Area geografica reale; scenario tattico esercitativo riposizionato. Quote e ortofoto caricate online.";
 sc.meteo.descrizione="Condizioni meteo di addestramento. Vento e visibilità configurabili.";
 if(sc.briefing?.BLUE){sc.briefing.BLUE.titolo="Esercitazione · "+r.name;sc.briefing.BLUE.situazione="Scenario di addestramento aereo nella regione "+r.name+". Basi, rotte, avversari e bersagli del workshop sono riposizionati per l'esercitazione, non rappresentano installazioni militari reali.";}
 if(sc.briefing?.RED){sc.briefing.RED.titolo="Difesa aerea · "+r.name;sc.briefing.RED.situazione="Esercitazione simulata nella regione "+r.name+". Le unità tattiche sono fittizie.";}
 sc.mappa5={id:r.id,nome:r.name,centro:[r.lat,r.lon],hasMonuments:r.id==="giza"};
 return sc;
}
let modal=null;
function show(){
 if(!modal){modal=document.createElement("div");modal.id="centurion-map5-modal";modal.style.cssText="position:fixed;inset:0;z-index:20050;background:#04101bec;overflow:auto;padding:24px 12px;color:#f1f6fc;font:15px system-ui,sans-serif";
 modal.innerHTML='<div style="max-width:890px;margin:auto"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 style="margin:4px 0 16px">🌍 Scenari geografici · CENTURION2</h2><button id="map5-close" style="padding:10px;border-radius:8px">✕ Chiudi</button></div><p style="opacity:.8">Terreno 3D altimetrico e foto satellitari reali online. Seleziona una regione, poi avvia Volo libero oppure lo scenario tattico.</p><div id="map5-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px"></div></div>';
 document.body.appendChild(modal);
 modal.querySelector("#map5-close").onclick=()=>modal.style.display="none";
 modal.addEventListener("click",e=>{if(e.target===modal)modal.style.display="none";});}
 const cards=modal.querySelector("#map5-cards");cards.replaceChildren();
 REGIONS.forEach(r=>{
  const card=document.createElement("div");card.style.cssText="background:#15273c;border:1px solid #466784;border-radius:14px;padding:16px";
  const title=document.createElement("h3");title.textContent=r.icon+" "+r.name;title.style.margin="0 0 8px";
  const desc=document.createElement("p");desc.textContent=r.desc;desc.style.cssText="min-height:44px;color:#d2ddea";
  const buttons=document.createElement("div");buttons.style.cssText="display:flex;gap:8px;flex-wrap:wrap";
  function make(label,mode){const b=document.createElement("button");b.textContent=label;b.style.cssText="flex:1;min-width:98px;background:"+(mode==="free"?"#166387":"#284566")+";color:white;border:1px solid #6b96b4;padding:12px 7px;border-radius:9px;font-weight:700;cursor:pointer";b.onclick=()=>{
   const sc=trasla(clone(SCENARIO_DEFAULT),r);
   if(typeof APP==="undefined"||!APP.ricostruisci){alert("Simulatore non ancora pronto");return;}
   if(typeof MONDO3D!=="undefined"&&MONDO3D.attiva)MONDO3D.chiudi();
   if(typeof VOLO!=="undefined"&&VOLO.attivo)VOLO.chiudi();
   if(typeof APP.play==="function")APP.play(false);
   APP.sc=sc;APP.ricostruisci();
   const base=document.getElementById("sel-base");if(base)base.value="sat";
   modal.style.display="none";
   if(mode==="free"){VOLO.apri();}else{
    document.getElementById("splash")?.classList.add("hidden");
    document.getElementById("app")?.classList.remove("hidden");
    if(APP.setRuolo)APP.setRuolo("TRAINER");APP.vaiFase("briefing");
    setTimeout(()=>{MAPPA.map?.invalidateSize();MAPPA.fitScenario();},80);
   }
  };buttons.appendChild(b);}
  make("🕹 Volo libero","free");make("✈ Missione","mission");
  card.append(title,desc,buttons);cards.appendChild(card);
 });
 modal.style.display="block";
}
function boot(){
 if(document.getElementById("map5-entry"))return;
 const b=document.createElement("button");b.id="map5-entry";b.textContent="🌍 5 MAPPE REALI";b.className="link-btn";b.style.cssText="color:#8ce4ff;font-weight:800";b.onclick=show;
 const links=document.querySelector(".splash-links");if(links)links.prepend(b);
 const top=document.querySelector(".top-right");if(top){const x=document.createElement("button");x.textContent="🌍 Mappe";x.title="Seleziona Egitto, Dolomiti, Vladivostok, Himalaya o Sardegna";x.onclick=show;top.prepend(x);}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
window.CENTURION_MAPPE5={REGIONS,open:show,trasla};
})();