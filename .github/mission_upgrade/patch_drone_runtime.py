#!/usr/bin/env python3
"""Link fictional civilian landmark, UAV identification and region map to runtime."""
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")
def apply(rel,patches):
 p=root/rel;s=p.read_text(encoding="utf-8")
 for old,new in patches:
  assert s.count(old)==1,"Runtime anchor mismatch ("+rel+"): "+old[:90]
  s=s.replace(old,new,1)
 p.write_text(s,encoding="utf-8")

apply("js/mondo3d.js",[
 ('''    st.uavs=[];
    if(!APP.sc.droni)return;''',
 '''    st.uavs=[];
    st.plant=null;
    if(APP.sc.znpp && window.CENTURION_PLANT){
      const loc=toXZ(APP.sc.znpp.lat,APP.sc.znpp.lon);
      const plant=CENTURION_PLANT.create();
      plant.position.set(loc.x,elev(loc.x,loc.z),loc.z);
      scene.add(plant);st.plant={mesh:plant,x:loc.x,z:loc.z};
      const focus=document.createElement("button");
      focus.id="m3d-plant-focus";
      focus.textContent="CENTRALE 3D";
      focus.title="Visita esterna illustrativa. Non riproduce la struttura operativa reale.";
      focus.style.cssText="position:absolute;top:71px;left:12px;z-index:30;background:#163b4b;border:1px solid #80a8b6;border-radius:8px;padding:10px 13px;color:white;font:bold 12px system-ui;cursor:pointer";
      focus.onclick=()=>{
        st.orbit.target.set(loc.x,elev(loc.x,loc.z)+65,loc.z);
        st.orbit.r=1800;st.orbit.theta=-.9;st.orbit.phi=.32;
        st.orbit.focusFlight=false;setCam("orbita");
      };
      overlay.appendChild(focus);
    }
    if(APP.sc.droni&&APP.sc.droni.some(d=>d.lato==="RED")){
      const control=document.createElement("button");control.id="m3d-identify-uav";
      control.textContent="CONFERMA UAV SELEZIONATO";
      control.title="Identifica il drone selezionato dopo il rilevamento (non usa armi)";
      control.style.cssText="position:absolute;bottom:68px;right:12px;z-index:30;background:#66332b;border:1px solid #f3a488;border-radius:8px;padding:11px 13px;color:white;font:bold 12px system-ui;cursor:pointer";
      control.onclick=()=>{
        const engine=APP.engine;
        const out=engine&&engine.identificaDrone?engine.identificaDrone(st.sel):
          {ok:false,msg:"Seleziona un drone RED nel menu dei velivoli"};
        if(typeof UI!=="undefined"&&UI.toast)UI.toast(out.msg,3500);
      };
      overlay.appendChild(control);
    }
    if(!APP.sc.droni)return;'''),
 ('const lab=label(cfg.nome,"#d9eaf7",10);lab.position.y=10;m.g.add(lab);',
  'const lab=label(cfg.nome,cfg.lato==="RED"?"#ff9e89":"#d9eaf7",10);lab.position.y=10;m.g.add(lab);'),
 ('const x=a.origin.x+Math.sin(t)*r;', 'let x=a.origin.x+Math.sin(t)*r;'),
 ('''const z=a.origin.z+Math.sin(t*.67)*Math.cos(t)*r*.68;''',
 '''let z=a.origin.z+Math.sin(t*.67)*Math.cos(t)*r*.68;
      const live=((APP.engine&&APP.engine.droni)||[]).find(d=>d.id===a.cfg.id);
      if(live){
        const loc=toXZ(live.lat,live.lon);x=loc.x;z=loc.z;
        a.mesh.visible=!live.allontanato;
      }'''),
 ('if(!st || !st.uavs)return;\n    const speed=0.13;',
  '''if(!st || !st.uavs)return;
    if(st.plant)st.plant.mesh.position.y=elev(st.plant.x,st.plant.z);
    const speed=0.13;'''),
 ('(st.uavs || []).forEach(u => list.push({ f: { id:u.cfg.id,nome:u.cfg.nome,tipo:"UAV",lato:"BLUE" }, i:0, aux:true,uav:true }));',
  '(st.uavs || []).forEach(u => list.push({ f: { id:u.cfg.id,nome:u.cfg.nome,tipo:"UAV",lato:u.cfg.lato||"BLUE" }, i:0, aux:true,uav:true }));'),
 ('if (aux) { const k = f.tipo==="UAV"?"DRONI · osservazione":"Tanker e AWACS";',
  'if (aux) { const k = f.tipo==="UAV"?"DRONI · osservazione / RED":"Tanker e AWACS";'),
 ('cancelAnimationFrame(raf); clearTimeout(raf); scrambleEnd(); overlay.classList.add("hidden");',
  '''cancelAnimationFrame(raf); clearTimeout(raf); scrambleEnd();
    for(const id of ["m3d-plant-focus","m3d-identify-uav"]){
      const button=overlay.querySelector("#"+id);if(button)button.remove();
    }
    overlay.classList.add("hidden");''')
])
apply("js/map.js",[
 ('''function fitScenario() {
    if(sc.mappa5){''',
  '''function fitScenario() {
    if(sc.mappa && sc.mappa.bounds) map.fitBounds(sc.mappa.bounds,{padding:[18,18]});
    else if(sc.mappa5){'''),
 ('''    layers.nazioni.clearLayers(); layers.griglia.clearLayers(); layers.punti.clearLayers();''',
  '''    layers.nazioni.clearLayers(); layers.griglia.clearLayers(); layers.punti.clearLayers();
    if(sc.znpp && sc.znpp.illustrative){
      L.marker([sc.znpp.lat,sc.znpp.lon],{
        icon:L.divIcon({className:"znpp-illustrative",html:"<span style='font-size:24px;filter:drop-shadow(0 1px 3px black)'>🏭</span>",iconSize:[28,28]})
      }).bindTooltip("Centrale civile illustrativa a sei unità: NON è una pianta reale").addTo(layers.punti);
    }'''),
 ('''function aggiornaFlights(vista, selId, onClick) {
    const presenti = new Set();''',
  '''function aggiornaFlights(vista, selId, onClick) {
    if(!layers.droneMarkers)layers.droneMarkers=L.layerGroup().addTo(map);
    layers.droneMarkers.clearLayers();
    const droni=((typeof APP!=="undefined"&&APP.engine&&APP.engine.droni)||[]);
    for(const d of droni){
      if(!d.visibile||d.allontanato)continue;
      const color=d.lato==="RED"?"#e35d50":"#71b9e5";
      L.circleMarker([d.lat,d.lon],{radius:6,color,fillColor:color,fillOpacity:.8,weight:2})
        .bindTooltip(d.nome+" · "+d.stato+" · simulato").addTo(layers.droneMarkers);
    }
    const presenti = new Set();''')
])
print("Zaporizhzhia landmark, drone classification and broad regional map integrated.")
