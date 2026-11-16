/* CENTURION2 - Geographic flight arenas (10000 km2 each). Deployed by GitHub Actions. */
(()=>{
"use strict";
const REGIONS=[
{id:"giza",name:"Egitto · Piramidi di Giza",lat:29.9773,lon:31.1345,zoom:11,icon:"🏜️",desc:"Deserto, Giza, Sfinge e piramidi; monumenti 3D stilizzati."},
{id:"dolomiti",name:"Dolomiti · Tre Cime",lat:46.619,lon:12.303,zoom:10,icon:"🏔️",desc:"Pareti dolomitiche, valli alpine e quote reali."},
{id:"vladivostok",name:"Vladivostok · Russkij",lat:43.067,lon:131.912,zoom:10,icon:"🌉",desc:"Penisola, isole, porto e grandi ponti visibili da satellite."},
{id:"himalaya",name:"Himalaya · Everest",lat:27.9881,lon:86.925,zoom:10,icon:"🏔️",desc:"Everest, ghiacciai e terreno ad alta quota."},
{id:"sardegna",name:"Sardegna · Costa Smeralda",lat:41.025,lon:9.538,zoom:10,icon:"🏝️",desc:"Arcipelago della Maddalena, coste e rilievi sardi."},
{id:"donbass",name:"Donbass · Donetsk",lat:48.03,lon:37.85,zoom:10,quota:3500,icon:"🏭",desc:"Donetsk, Makiivka e Horlivka: pianura steppica, cumuli minerari e la dorsale del Donec."},
{id:"taiwan",name:"Taiwan · Taichung e Catena Centrale",lat:24.2,lon:120.85,zoom:10,quota:5500,icon:"⛰️",desc:"Stretto di Taiwan, pianura costiera di Taichung e vette oltre 3.800 m della Catena Centrale."},
{id:"caracas",name:"Venezuela · Caracas e El Ávila",lat:10.5,lon:-66.9,zoom:10,quota:4500,icon:"🌴",desc:"Valle di Caracas, massiccio di El Ávila oltre 2.700 m e costa caraibica di La Guaira."}
];
const BASE=[40.85,-123.0], EARTH_M=111320, AREA_KM2=10000, SIDE_M=Math.sqrt(AREA_KM2)*1000;
const GEO_FIELDS=new Set(["centro","origine","etichetta","poligono","fir_boundary","bounds"]);
const clone=x=>JSON.parse(JSON.stringify(x));
/* Reproject all exercise entities inside the real 10000 km2 terrain footprint. */
function trasla(sc,r){
 const cos0=Math.cos(BASE[0]*Math.PI/180), cos1=Math.cos(r.lat*Math.PI/180);
 let maxAbs=1;
 function extent(o){
  if(!o||typeof o!=="object")return;
  if(!Array.isArray(o)&&Number.isFinite(o.lat)&&Number.isFinite(o.lon))
   maxAbs=Math.max(maxAbs,Math.abs((o.lat-BASE[0])*EARTH_M),Math.abs((o.lon-BASE[1])*EARTH_M*cos0));
  Object.values(o).forEach(v=>{if(v&&typeof v==="object")extent(v);});
 }
 extent(sc);
 const scale=Math.min(1,(SIDE_M/2-1300)/maxAbs);
 function pair(la,lo){
  const north=(la-BASE[0])*EARTH_M*scale, east=(lo-BASE[1])*EARTH_M*cos0*scale;
  return [r.lat+north/EARTH_M,r.lon+east/(EARTH_M*cos1)];
 }
 function coords(v){
  if(Array.isArray(v)&&v.length>=2&&typeof v[0]==="number"&&typeof v[1]==="number")
   return [...pair(v[0],v[1]),...v.slice(2)];
  if(Array.isArray(v))return v.map(coords);
  return v;
 }
 function walk(o){
  if(!o||typeof o!=="object")return;
  if(Array.isArray(o)){o.forEach(walk);return;}
  if(Number.isFinite(o.lat)&&Number.isFinite(o.lon)){const p=pair(o.lat,o.lon);o.lat=p[0];o.lon=p[1];}
  for(const [k,v] of Object.entries(o)){
   if(GEO_FIELDS.has(k)&&Array.isArray(v))o[k]=coords(v);
   else if(v&&typeof v==="object")walk(v);
  }
 }
 walk(sc);
 sc.mappa.centro=[r.lat,r.lon];sc.mappa.zoom=r.zoom;sc.mappa.tile_default="sat";
 sc.mappa.sectional.attivo=false;sc.mappa.griglia.attiva=false;
 sc.mappa.nazioni=[];sc.mappa.fir_boundary=[];
 sc.aar.forEach(a=>a.lunghezza_nm=Math.min(a.lunghezza_nm,3));
 sc.cap_box.forEach(c=>c.raggio_nm=Math.min(c.raggio_nm,2));
 sc.regole.commit_nm_blue=2;
 sc.meta.nome="CENTURION2 · "+r.name;
 sc.meta.note="Superficie reale 10.000 km² (100 × 100 km), terrain DEM Terrarium e ortofoto Esri online. Basi, obiettivi e difese sono entità simulate, riposizionate entro l'area.";
 sc.meteo.descrizione="Condizioni meteo di addestramento. Vento e visibilità configurabili.";
 if(sc.briefing?.BLUE){sc.briefing.BLUE.titolo="Esercitazione · "+r.name;sc.briefing.BLUE.situazione="Esercitazione aeronautica su 10.000 km² reali nella regione "+r.name+". Basi e bersagli di gioco sono simulati e non corrispondono a infrastrutture locali.";}
 if(sc.briefing?.RED){sc.briefing.RED.titolo="Difesa aerea · "+r.name;sc.briefing.RED.situazione="Scenario esercitativo su 10.000 km² reali nella regione "+r.name+". Unità e installazioni tattiche fittizie.";}
 sc.mappa5={id:r.id,nome:r.name,centro:[r.lat,r.lon],lato_m:SIDE_M,area_km2:AREA_KM2,hasMonuments:r.id==="giza",quotaInizioM:r.quota?r.quota:r.id==="himalaya"?12500:r.id==="dolomiti"?5600:r.id==="sardegna"?3500:4000};
 return sc;
}
let modal=null;
function show(){
 if(!modal){modal=document.createElement("div");modal.id="centurion-map5-modal";modal.style.cssText="position:fixed;inset:0;z-index:20050;background:#04101bec;overflow:auto;padding:24px 12px;color:#f1f6fc;font:15px system-ui,sans-serif";
 modal.innerHTML='<div style="max-width:890px;margin:auto"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 style="margin:4px 0 16px">🌍 Scenari geografici · CENTURION2</h2><button id="map5-close" style="padding:10px;border-radius:8px">✕ Chiudi</button></div><p style="opacity:.8">'+REGIONS.length+' aree reali da 10.000 km² ciascuna (100 × 100 km). Altimetria 3D e immagini satellitari online; edifici e unità tattiche non sono ricostruzioni fotogrammetriche.</p><div id="map5-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px"></div></div>';
 document.body.appendChild(modal);
 modal.querySelector("#map5-close").onclick=()=>modal.style.display="none";
 modal.addEventListener("click",e=>{if(e.target===modal)modal.style.display="none";});}
 const cards=modal.querySelector("#map5-cards");cards.replaceChildren();
 REGIONS.forEach(r=>{
  const card=document.createElement("div");card.style.cssText="background:#15273c;border:1px solid #466784;border-radius:14px;padding:16px";
  const title=document.createElement("h3");title.textContent=r.icon+" "+r.name;title.style.margin="0 0 8px";
  const desc=document.createElement("p");desc.textContent=r.desc+" · Superficie 10.000 km²";desc.style.cssText="min-height:44px;color:#d2ddea";
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
 const b=document.createElement("button");b.id="map5-entry";b.textContent="🌍 "+REGIONS.length+" MAPPE 3D · 10.000 km²";b.className="link-btn";b.style.cssText="color:#8ce4ff;font-weight:800";b.onclick=show;
 const links=document.querySelector(".splash-links");if(links)links.prepend(b);
 const top=document.querySelector(".top-right");if(top){const x=document.createElement("button");x.textContent="🌍 Mappe";x.title="Seleziona "+REGIONS.map(r=>r.name.split(" · ")[0]).join(", ");x.onclick=show;top.prepend(x);}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
window.CENTURION_MAPPE5={REGIONS,open:show,trasla};
})();