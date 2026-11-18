/* CENTURION2 - Modalita Comandante: map-based scenario editor */
(function(root) {
 "use strict";
 const C=()=>root.COMMANDER_CORE, $=s=>document.querySelector(s);
 const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const state={sc:null,savedId:null,selection:null,placing:null,layer:null,panel:null,open:false,copy:null};
 const titles={basi:"Basi aeree",target:"Obiettivi da attaccare",sam:"Difese antiaeree",cap_box:"Pattuglie CAP",gate:"Punti ingresso/uscita",aar:"Rifornimento aereo",orbite:"Sorveglianza AEW"};
 const icons={basi:"✈",target:"▲",sam:"◆",cap_box:"◯",gate:"⬡",aar:"⛽",orbite:"◎"};
 const colorFor=(k,e)=>k==="sam"?"#e85c62":k==="target"?"#facd64":e.lato==="RED"?"#f47576":"#66b5ee";
 function toast(s){if(typeof UI!=="undefined")UI.toast(esc(s));else alert(s);}
 function top(){return $("#commander-overlay")}
 function render() {
  const root=top();if(!root||!state.sc)return;
  const s=state.sc;
  const key=state.selection, selected=key&&s[key.kind]&&s[key.kind].find(x=>x.id===key.id);
  const choice=(arr,id)=>arr.map(x=>'<option value="'+esc(x.id)+'"'+(id===x.id?' selected':'')+'>'+esc(x.nome||x.callsign||x.id)+'</option>').join("");
  const list=(cat)=>'<details'+(state.selection&&state.selection.kind===cat?' open':'')+'><summary>'+icons[cat]+' '+titles[cat]+' <b>'+s[cat].length+'</b></summary>'+
   '<div class="cmd-items">'+s[cat].map(x=>'<button type="button" data-select="'+cat+':'+esc(x.id)+'">'+esc(x.nome||x.id)+'</button>').join("")+'</div></details>';
  const field=(label,key,val,type,step)=>'<label>'+label+'<input data-field="'+key+'" type="'+(type||"text")+'" value="'+esc(val??"")+'"'+(step?' step="'+step+'"':'')+'></label>';
  const elementFields=selected?'<div class="cmd-card"><h3>Modifica '+esc(selected.id)+'</h3>'+
   field("Nome","nome",selected.nome)+field("Latitudine","lat",selected.lat,"number","any")+
   field("Longitudine","lon",selected.lon,"number","any")+
   (["basi","cap_box"].includes(key.kind)?'<label>Squadra<select data-field="lato"><option'+(selected.lato==="BLUE"?' selected':'')+'>BLUE</option><option'+(selected.lato==="RED"?' selected':'')+'>RED</option></select></label>':"")+
   (key.kind==="sam"?field("Missili","missili",selected.missili,"number"): "")+
   (["sam","cap_box"].includes(key.kind)?field("Raggio NM","raggio_nm",selected.raggio_nm,"number"): "")+
   (key.kind==="target"?field("Colpi necessari","gbu_richieste",selected.gbu_richieste,"number"): "")+
   (key.kind==="target"?'<label><input data-field="primario" type="checkbox" '+(selected.primario!==false?'checked':'')+'> Obiettivo primario</label>':"")+
   (key.kind==="basi"?field("Lunghezza pista (ft)","pista_ft",selected.pista_ft,"number"): "")+
   (key.kind==="aar"?field("Quota (ft)","quota_ft",selected.quota_ft,"number"): "")+
   '<p>Trascina il punto sulla mappa per spostarlo.</p><button data-action="delete-point">Elimina punto</button></div>':"";
  const forming=s.formazioni.map(f=>{
   const optTypes=Object.keys(s.tipi).filter(t=>s.tipi[t].lato===f.lato && t!=="SA10"&&s.tipi[t].categoria!=="SAM");
   const base=s.basi.filter(b=>b.lato===f.lato);
   const p=s.piani.BLUE&&s.piani.BLUE.formazioni&&s.piani.BLUE.formazioni[f.id];
   return '<details class="cmd-formation"><summary>'+esc(f.callsign)+' · '+esc(f.tipo)+' · '+f.lato+'</summary>'+
   '<label>Callsign<input data-form="'+esc(f.id)+':callsign" value="'+esc(f.callsign)+'"></label>'+
   '<label>Velivolo<select data-form="'+esc(f.id)+':tipo">'+optTypes.map(x=>'<option'+(x===f.tipo?' selected':'')+'>'+esc(x)+'</option>').join("")+'</select></label>'+
   '<label>Quantità<input type="number" min="1" max="24" data-form="'+esc(f.id)+':numero" value="'+esc(f.numero)+'"></label>'+
   '<label>Base<select data-form="'+esc(f.id)+':base">'+choice(base,f.base)+'</select></label>'+
   (p?'<h4>Rotta e attacco BLUE</h4>'+
   '<label>Decollo<input type="time" data-plan="'+esc(f.id)+':decollo" value="'+esc(p.decollo||"09:10")+'"></label>'+
   '<label>Push<input type="time" data-plan="'+esc(f.id)+':push" value="'+esc(p.push||"09:40")+'"></label>'+
   '<label>Tanker<select data-plan="'+esc(f.id)+':tanker">'+choice(s.aar,p.tanker)+'</select></label>'+
   '<label>Gate ingresso<select data-plan="'+esc(f.id)+':gate_in">'+choice(s.gate,p.gate_in)+'</select></label>'+
   '<label>Target primario<select data-plan="'+esc(f.id)+':target"><option value="">Nessuno</option>'+choice(s.target,p.target)+'</select></label>'+
   '<label>Secondo target<select data-plan="'+esc(f.id)+':target2"><option value="">Nessuno</option>'+choice(s.target,p.target2)+'</select></label>'+
   '<label>Gate uscita<select data-plan="'+esc(f.id)+':gate_out">'+choice(s.gate,p.gate_out)+'</select></label>':"")+
   '<button data-remove-formation="'+esc(f.id)+'">Elimina formazione</button></details>';
  }).join("");
  const caps=s.piani.RED.cap.map((p,i)=>'<div class="cmd-card"><b>CAP '+(i+1)+'</b><label>Formazione<select data-red-cap="'+i+':formazione">'+choice(s.formazioni.filter(f=>f.lato==="RED"),p.formazione)+'</select></label>'+
   '<label>Zona<select data-red-cap="'+i+':box">'+choice(s.cap_box.filter(c=>c.lato==="RED"),p.box)+'</select></label>'+
   '<label>Da<input type="time" data-red-cap="'+i+':da" value="'+esc(p.da)+'"></label><label>A<input type="time" data-red-cap="'+i+':a" value="'+esc(p.a)+'"></label>'+
   '<button data-remove-cap="'+i+'">Rimuovi CAP</button></div>').join("");
  const saved=C().listSaved();
  root.innerHTML='<header class="cmd-header"><div><b>✪ MODALITÀ COMANDANTE</b><small>Crea e salva le tue missioni</small></div><button data-action="close">✕</button></header>'+
   '<div class="cmd-layout"><aside class="cmd-controls">'+
   '<div class="cmd-card"><h3>Scenario</h3>'+field("Nome missione","meta.nome",s.meta.nome)+
   field("Centro mappa (lat)","mappa.centro.lat",s.mappa.centro[0],"number","any")+
   field("Centro mappa (lon)","mappa.centro.lon",s.mappa.centro[1],"number","any")+
   '<button data-action="go-location">Vai alla posizione</button><button data-action="use-map-center">Usa centro mappa</button>'+
   '<label>Base cartografica<select data-field="mappa.tile_default">'+["osm","topo","sat","dark"].map(x=>'<option value="'+x+'"'+(x===s.mappa.tile_default?' selected':'')+'>'+({osm:"Stradale",topo:"Topografica",sat:"Satellite",dark:"Scura"}[x])+'</option>').join("")+'</select></label>'+
   field("Inizio","tempo.inizio",s.tempo.inizio,"time")+field("Fine","tempo.fine",s.tempo.fine,"time")+
   field("Vento da (°)","meteo.vento_da_gradi",s.meteo.vento_da_gradi,"number")+
   field("Vento (kt)","meteo.vento_kt",s.meteo.vento_kt,"number")+'</div>'+
   '<div class="cmd-card"><h3>Posiziona sulla mappa</h3><div class="cmd-tools">'+
   C().categories.map(k=>'<button type="button" class="'+(state.placing===k?'on':'')+'" data-place="'+k+'">'+icons[k]+' '+titles[k]+'</button>').join("")+
   '</div><label>Nuovo punto per squadra<select id="cmd-side"><option>BLUE</option><option>RED</option></select></label><small>Seleziona un tipo e tocca la mappa. Per annullare seleziona di nuovo lo strumento.</small></div>'+
   '<div class="cmd-card"><h3>Installazioni e zone</h3>'+C().categories.map(list).join("")+'</div>'+
   elementFields+
   '<div class="cmd-card"><h3>Aerei e attacchi</h3><button data-action="add-blue">+ Formazione BLUE</button><button data-action="add-red">+ Formazione RED</button>'+forming+'</div>'+
   '<div class="cmd-card"><h3>Difesa aerea RED</h3><button data-action="add-cap">+ Turno CAP</button>'+caps+'</div>'+
   '<div class="cmd-card"><h3>Missioni salvate</h3>'+saved.map(x=>'<div class="cmd-saved"><span>'+esc(x.nome)+'<small>'+esc(new Date(x.savedAt).toLocaleString("it-IT"))+'</small></span><button data-load="'+esc(x.id)+'">Apri</button><button data-erase="'+esc(x.id)+'">✕</button></div>').join("")+
   (saved.length?"":'<p>Nessuna missione salvata</p>')+'</div></aside>'+
   '<section class="cmd-world"><div class="cmd-map" id="cmd-map"></div><div class="cmd-toolbar"><span id="cmd-hint">'+(state.placing?"Tocca la mappa per posizionare: "+titles[state.placing]:"Trascina i simboli per riposizionarli")+'</span>'+
   '<div class="cmd-buttons"><button data-action="new">Nuova</button><button data-action="duplicate">Copia attuale</button><button data-action="save">💾 Salva</button><button data-action="export">⇩ JSON</button><button data-action="import">⇧ Importa</button><button data-action="play">▶ Avvia missione</button></div></div>'+
   '<input type="file" id="cmd-import" accept=".json,application/json" hidden></section></div>';
  state.selection=selected?state.selection:null;
  attach(); drawMap();
 }
 function redrawDetails(preserveView=true) {
  const a=state.layer&&state.layer.getCenter&&state.layer.getCenter(),z=state.layer&&state.layer.getZoom&&state.layer.getZoom();
  if(a&&preserveView){state.sc.mappa.centro=[a.lat,a.lng];state.sc.mappa.zoom=z;}
  if(state.layer){state.layer.remove();state.layer=null;}
  render();
 }
 function attach() {
  const dom=top();
  dom.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",()=>action(b.dataset.action)));
  dom.querySelectorAll("[data-place]").forEach(b=>b.addEventListener("click",()=>{state.placing=state.placing===b.dataset.place?null:b.dataset.place;dom.querySelectorAll("[data-place]").forEach(x=>x.classList.toggle("on",x.dataset.place===state.placing));$("#cmd-hint").textContent=state.placing?"Tocca la mappa per posizionare: "+titles[state.placing]:"Trascina i simboli per riposizionarli";}));
  dom.querySelectorAll("[data-select]").forEach(b=>b.addEventListener("click",()=>{const [kind,id]=b.dataset.select.split(":");state.selection={kind,id};redrawDetails();}));
  dom.querySelectorAll("[data-field]").forEach(el=>el.addEventListener("change",()=>fieldChange(el)));
  dom.querySelectorAll("[data-form]").forEach(el=>el.addEventListener("change",()=>{const [id,k]=el.dataset.form.split(":");const f=state.sc.formazioni.find(x=>x.id===id);if(f){f[k]=k==="numero"?Number(el.value):el.value;redrawDetails();}}));
  dom.querySelectorAll("[data-plan]").forEach(el=>el.addEventListener("change",()=>{const [id,k]=el.dataset.plan.split(":");state.sc.piani.BLUE.formazioni[id][k]=el.value;redrawDetails();}));
  dom.querySelectorAll("[data-red-cap]").forEach(el=>el.addEventListener("change",()=>{const [i,k]=el.dataset.redCap.split(":");state.sc.piani.RED.cap[Number(i)][k]=el.value;redrawDetails();}));
  dom.querySelectorAll("[data-remove-formation]").forEach(el=>el.addEventListener("click",()=>{state.sc.formazioni=state.sc.formazioni.filter(x=>x.id!==el.dataset.removeFormation);C().reconcile(state.sc);redrawDetails();}));
  dom.querySelectorAll("[data-remove-cap]").forEach(el=>el.addEventListener("click",()=>{state.sc.piani.RED.cap.splice(+el.dataset.removeCap,1);redrawDetails();}));
  dom.querySelectorAll("[data-load]").forEach(el=>el.addEventListener("click",()=>{const v=C().readSaved(el.dataset.load);if(v){state.savedId=v.id;state.sc=C().importMission(v);state.selection=null;state.placing=null;redrawDetails(false);}}));
  dom.querySelectorAll("[data-erase]").forEach(el=>el.addEventListener("click",()=>{if(confirm("Eliminare definitivamente la missione salvata?")){C().remove(el.dataset.erase);if(state.savedId===el.dataset.erase)state.savedId=null;redrawDetails();}}));
  $("#cmd-import").addEventListener("change",async ev=>{const f=ev.target.files[0];if(!f)return;try{const o=JSON.parse(await f.text());state.sc=C().importMission(o);state.savedId=null;state.selection=null;redrawDetails(false);toast("Missione importata");}catch(e){alert("Importazione non riuscita: "+e.message);}});
 }
 function fieldChange(el) {
  const k=el.dataset.field,val=el.type==="checkbox"?el.checked:(el.type==="number"?Number(el.value):el.value),s=state.sc;
  const loc=s.mappa.centro;
  if(k==="meta.nome")s.meta.nome=String(val);
  else if(k==="mappa.centro.lat")loc[0]=Number(val);
  else if(k==="mappa.centro.lon")loc[1]=Number(val);
  else if(k==="mappa.tile_default")s.mappa.tile_default=val;
  else if(k==="tempo.inizio")s.tempo.inizio=val;
  else if(k==="tempo.fine")s.tempo.fine=val;
  else if(k==="meteo.vento_da_gradi")s.meteo.vento_da_gradi=val;
  else if(k==="meteo.vento_kt")s.meteo.vento_kt=val;
  else if(state.selection) {
   const p=s[state.selection.kind].find(x=>x.id===state.selection.id);
   if(p){p[k]=val;if(k==="lato"&&state.selection.kind==="basi")state.sc.formazioni.filter(f=>f.base===p.id&&f.lato!==val).forEach(f=>{const b=state.sc.basi.find(x=>x.lato===f.lato);if(b)f.base=b.id;});}
  }
  if(k==="mappa.centro.lat"||k==="mappa.centro.lon")redrawDetails(false);
  else redrawDetails();
 }
 function drawMap() {
  const s=state.sc;const el=$("#cmd-map"); if(!el||typeof L==="undefined")return;
  const map=state.layer=L.map(el,{zoomControl:true,preferCanvas:false}).setView(s.mappa.centro,s.mappa.zoom||10);
  const layers={
   osm:L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap"}),
   topo:L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",{maxZoom:15,attribution:"© OpenTopoMap"}),
   sat:L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:17,attribution:"Esri"}),
   dark:L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:18,attribution:"© CARTO"})
  };
  layers[s.mappa.tile_default]?.addTo(map);
  map.on("click",e=>{if(!state.placing)return;const kind=state.placing,side=$("#cmd-side").value;try{const p=C().addEntity(s,kind,{lat:e.latlng.lat,lon:e.latlng.lng},side);state.selection={kind,id:p.id};state.placing=null;redrawDetails();}catch(err){alert(err.message);}});
  for(const kind of C().categories)for(const item of s[kind]){
   const color=colorFor(kind,item);const html='<span class="cmd-marker" style="border-color:'+color+';color:'+color+'">'+icons[kind]+'</span>';
   const marker=L.marker([item.lat,item.lon],{draggable:true,icon:L.divIcon({className:"cmd-icon",html,iconSize:[30,30],iconAnchor:[15,15]})}).addTo(map);
   marker.bindTooltip(esc(item.nome||item.id));
   marker.on("click",()=>{state.selection={kind,id:item.id};redrawDetails();});
   marker.on("dragend",e=>{const p=e.target.getLatLng();item.lat=+p.lat.toFixed(5);item.lon=+p.lng.toFixed(5);state.selection={kind,id:item.id};redrawDetails();});
   if(kind==="sam"||kind==="cap_box")L.circle([item.lat,item.lon],{radius:(+item.raggio_nm||10)*1852,color,weight:1,fillOpacity:.035,interactive:false}).addTo(map);
  }
  for(const f of s.formazioni.filter(x=>x.lato==="BLUE")) {
   const p=s.piani.BLUE.formazioni[f.id];const base=s.basi.find(x=>x.id===f.base);
   if(!p||!base)continue;const route=[base,s.aar.find(x=>x.id===p.tanker),s.gate.find(x=>x.id===p.gate_in),
    s.target.find(x=>x.id===p.target),s.target.find(x=>x.id===p.target2),s.gate.find(x=>x.id===p.gate_out),base]
    .filter(x=>x&&Number.isFinite(+x.lat)&&Number.isFinite(+x.lon));
   if(route.length>1)L.polyline(route.map(x=>[x.lat,x.lon]),{color:"#58baf7",weight:2,opacity:.7,dashArray:"7 5",interactive:false}).bindTooltip(esc(f.callsign)).addTo(map);
  }
  map.on("moveend",()=>{if(state.layer!==map)return;const p=map.getCenter();s.mappa.centro=[+p.lat.toFixed(5),+p.lng.toFixed(5)];s.mappa.zoom=map.getZoom();});
  setTimeout(()=>map.invalidateSize(),60);
 }
 function action(name) {
  try{
   const s=state.sc;
   if(name==="close"){close();return;}
   if(name==="new"){if(!confirm("Creare una nuova missione? Le modifiche non salvate andranno perse."))return;const p=state.layer.getCenter();state.sc=C().fresh(p.lat,p.lng);state.savedId=null;state.selection=null;redrawDetails(false);return;}
   if(name==="duplicate"){state.sc=C().copyCurrent(APP.sc);state.savedId=null;state.selection=null;redrawDetails(false);return;}
   if(name==="save"){C().reconcile(s);const e=C().save(s,state.savedId);state.savedId=e.id;toast("Missione salvata sul dispositivo: "+e.nome);redrawDetails();return;}
   if(name==="import"){$("#cmd-import").click();return;}
   if(name==="export"){C().reconcile(s);const payload={schema:"centurion-commander-1",exportedAt:new Date().toISOString(),scenario:s};DATAIO.downloadJSON(payload,(s.meta.nome||"missione").replace(/[^a-z0-9_-]/gi,"_")+".json");return;}
   if(name==="play"){
    C().reconcile(s);
    const hasBlue=s.formazioni.some(f=>f.lato==="BLUE"&&s.piani.BLUE.formazioni[f.id]&&s.piani.BLUE.formazioni[f.id].target);
    if(!hasBlue)throw Error("Assegna almeno un bersaglio a una formazione BLUE prima di avviare");
    APP.play(false);
    APP.sc=C().clone(s); APP.salva(); APP.ricostruisci();
    close();$("#splash").classList.add("hidden");$("#app").classList.remove("hidden");
    APP.setRuolo("TRAINER");APP.vaiFase("briefing");
    MAPPA.map.invalidateSize();MAPPA.map.setView(s.mappa.centro,s.mappa.zoom||10);
    try{MAPPA.setBase(s.mappa.tile_default||"osm");}catch(e){}
    toast("Missione ad hoc pronta: scegli Piano o Esecuzione");
    return;
   }
   if(name==="delete-point"){
    if(!state.selection||!confirm("Eliminare il punto selezionato?"))return;
    const {kind,id}=state.selection;
    if(kind==="basi"&&state.sc.formazioni.some(f=>f.base===id))throw Error("Sposta le formazioni prima di eliminare la base");
    s[kind]=s[kind].filter(x=>x.id!==id);state.selection=null;redrawDetails();return;
   }
   if(name==="go-location"){const a=+s.mappa.centro[0],b=+s.mappa.centro[1];if(!C().latOK(a)||!C().lonOK(b))throw Error("Coordinate fuori intervallo");state.layer.setView([a,b],s.mappa.zoom||10);return;}
   if(name==="use-map-center"){const p=state.layer.getCenter();s.mappa.centro=[p.lat,p.lng];redrawDetails();return;}
   if(name==="add-blue"||name==="add-red"){C().addFormation(s,name==="add-blue"?"BLUE":"RED");redrawDetails();return;}
   if(name==="add-cap"){const f=s.formazioni.find(x=>x.lato==="RED"),p=s.cap_box.find(x=>x.lato==="RED");if(!f||!p)throw Error("Servono una formazione RED e una CAP RED");s.piani.RED.cap.push({box:p.id,formazione:f.id,da:s.tempo.inizio,a:s.tempo.fine});redrawDetails();return;}
  }catch(e){alert("Comandante: "+e.message);}
 }
 function open() {
  if(typeof APP==="undefined"||typeof MAPPA==="undefined"||!APP.sc)return alert("Simulatore non ancora caricato");
  if(typeof RETE!=="undefined"&&RETE.client())return toast("Solo il comandante della sessione può modificare missioni");
  if(state.open)return;
  state.sc=C().copyCurrent(APP.sc);state.savedId=null;state.selection=null;state.placing=null;state.open=true;
  const e=document.createElement("section");e.id="commander-overlay";e.setAttribute("role","dialog");e.setAttribute("aria-label","Modalita Comandante");
  document.body.appendChild(e);render();
 }
 function close(){if(state.layer){state.layer.remove();state.layer=null;}top()?.remove();state.open=false;state.placing=null;}
 function init(){
  if($("#cmd-open"))return;
  const topbar=$("#topbar .top-right");if(!topbar)return;
  const btn=document.createElement("button");btn.id="cmd-open";btn.textContent="✪ Comandante";btn.title="Crea missioni e difese personalizzate";
  btn.addEventListener("click",open);topbar.insertBefore(btn,topbar.firstChild);
  const home=document.querySelector("#splash .splash-roles.unica");
  if(home){const entry=document.createElement("button");entry.id="cmd-home";entry.className="role-btn home-card commander";entry.innerHTML='<span class="big">✪</span><b>COMANDANTE</b><small>Crea mappe, difese e missioni su misura</small>';entry.addEventListener("click",open);home.appendChild(entry);}
 }
 document.addEventListener("DOMContentLoaded",init);
 root.COMANDANTE={open,close,get scenario(){return state.sc;}};
})(window);
