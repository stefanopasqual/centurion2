#!/usr/bin/env python3
"""Install fictional observation UAVs (M12) and a 3D scramble intro for mission views."""
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")
p=root/"js"/"mondo3d.js"
s=p.read_text(encoding="utf-8")
def patch(old,new):
 global s
 assert old in s, "Mondo3D anchor missing: "+old[:115]
 s=s.replace(old,new,1)

patch("const sc = APP.sc; TERRA.lat0 = 41.0; TERRA.lon0 = -122.8;",
      """const sc = APP.sc;
    // Respect each scenario's map origin, including the fictional Donbass region.
    const origin=(sc.mappa && sc.mappa.centro)||[41.0,-122.8];
    TERRA.lat0=sc.missione && sc.missione.id==="M12"?origin[0]:41.0;
    TERRA.lon0=sc.missione && sc.missione.id==="M12"?origin[1]:-122.8;""")

visuals=r'''
  /* --- Reusable cinematic scramble. Visual-only: does not fake an engine takeoff. --- */
  function scrambleStart(selected) {
    if(!st || !APP.sc || !APP.sc.basi || !APP.sc.basi.length) return;
    const f=APP.engine.flights.find(f=>f.id===selected || f.callsign===selected)||APP.engine.flights.find(f=>f.lato==="BLUE")||APP.engine.flights[0];
    const b=APP.sc.basi.find(b=>f && b.id===f.base)||APP.sc.basi[0];
    const pos=toXZ(b.lat,b.lon), ground=elev(pos.x,pos.z);
    const root=new THREE.Group();root.position.set(pos.x,ground+2.5,pos.z);
    scene.add(root);
    const strip=new THREE.Mesh(new THREE.PlaneGeometry(38,420),
      new THREE.MeshStandardMaterial({color:0x333b43,roughness:0.94,metalness:0.01}));
    strip.rotation.x=-Math.PI/2;root.add(strip);
    const mid=new THREE.MeshBasicMaterial({color:0xdedbd2,side:THREE.DoubleSide});
    for(let i=-8;i<=8;i++){
      const line=new THREE.Mesh(new THREE.PlaneGeometry(.36,6.5),mid);
      line.rotation.x=-Math.PI/2;line.position.set(0,.024,i*21);root.add(line);
    }
    const lampMat=new THREE.MeshBasicMaterial({color:0xe4e6c2});
    for(let side of [-1,1]) for(let i=-9;i<=9;i++){
      const lamp=new THREE.Mesh(new THREE.SphereGeometry(.29,6,4),lampMat);
      lamp.position.set(side*18,.3,i*22);root.add(lamp);
    }
    const hangar=new THREE.Mesh(new THREE.BoxGeometry(32,10,28),matStd(0x424e58));
    hangar.position.set(32,5,-155);root.add(hangar);
    const doorway=new THREE.Mesh(new THREE.PlaneGeometry(23,7),new THREE.MeshBasicMaterial({color:0x080d16}));
    doorway.position.set(32,4.4,-140.8);root.add(doorway);
    const plane=new THREE.Group();root.add(plane);
    plane.position.set(0,3.2,-155);
    const wheels=new THREE.Group();plane.add(wheels);
    const tireMat=matStd(0x13191c,{roughness:1});
    for(const [gx,gz] of [[0,2.0],[-1.3,-1.4],[1.3,-1.4]]){
      const strut=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,1.45,8),matStd(0x8c969b));
      strut.position.set(gx,-1.02,gz);wheels.add(strut);
      const tire=new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,.22,12),tireMat);
      tire.rotation.z=Math.PI/2;tire.position.set(gx,-1.83,gz);wheels.add(tire);
    }
    const meshHolder=new THREE.Group();plane.add(meshHolder);
    // Fallback appears immediately; licensed real GLB replaces it asynchronously.
    meshHolder.add(VISTA3D.jetFallback(0x737c84));
    if(f) VISTA3D.modelloPromise((APP.sc.tipi[f.tipo]||{}).icona||"f16",
      undefined,{tipoId:f.tipo,numero:"01",callsign:f.callsign}).then(m=>{
        if(!st || !st.scramble || st.scramble.root!==root)return;
        while(meshHolder.children.length)meshHolder.remove(meshHolder.children[0]);
        meshHolder.add(m);
      }).catch(()=>{});
    const light=new THREE.PointLight(0xff9c4b,.2,32);light.position.set(0,4,-165);root.add(light);
    const hud=document.createElement("div");hud.id="m3d-scramble";
    hud.style.cssText="position:absolute;inset:auto 3% 8%;z-index:14;color:#f3f7fa;text-shadow:0 2px 5px #000;font:700 clamp(14px,2.4vw,23px) system-ui;pointer-events:none";
    hud.innerHTML='<div style="letter-spacing:.15em;font-size:.65em;color:#b8d7ea">CENTURION // MISSION START</div><div id="m3d-scramble-stage">SCRAMBLE · ALLARME</div>';
    const skip=document.createElement("button");skip.id="m3d-scramble-skip";
    skip.textContent="Salta introduzione ✕";
    skip.style.cssText="position:absolute;right:8px;top:70px;z-index:17;padding:10px 14px;color:white;background:#203b50;border:1px solid #9bb7c9;border-radius:8px;cursor:pointer";
    skip.onclick=()=>scrambleEnd();
    overlay.append(hud,skip);
    st.scramble={root,plane,light,hud,skip,elapsed:0,lastStage:-1,base:b};
  }
  function scrambleEnd(){
    if(!st || !st.scramble)return;
    const c=st.scramble; c.hud.remove(); c.skip.remove();
    scene.remove(c.root);
    c.root.traverse(x=>{if(x.geometry)x.geometry.dispose();});
    st.scramble=null;
    camera.up.set(0,1,0);
  }
  function scrambleTick(dt){
    if(!st || !st.scramble)return;
    const c=st.scramble;
    c.elapsed+=Math.min(dt,.1);
    const t=c.elapsed;
    const stage=t<2.2?0:t<4.5?1:t<9?2:3;
    if(stage!==c.lastStage){
      c.lastStage=stage;
      const txt=["ALLARME · PILOTI AI VELIVOLI","AVVIAMENTO MOTORI · CONTROLLI",
        "RULLAGGIO · INGRESSO PISTA","DECOLLO · ROTAZIONE"];
      const caption=c.hud.querySelector("#m3d-scramble-stage");
      if(caption)caption.textContent="SCRAMBLE · "+txt[stage];
    }
    const f=Math.max(0,t-4.5);
    let z=-155;
    if(t>=4.5 && t<9)z=-155+(f/4.5)*150;
    else if(t>=9)z=-5+Math.min(1,(t-9)/3.2)*170;
    c.plane.position.set(0,3.2+Math.max(0,t-9)*Math.max(0,t-9)*4,z);
    c.plane.rotation.x=t>9?-Math.min(.21,(t-9)*.055):0;
    if(c.plane.children[0])c.plane.children[0].visible=t<10.4;
    c.root.position.y=elev(c.root.position.x,c.root.position.z)+2.5;
    c.light.intensity=t<2.2?.25:t<4.5?2.1:3.2;
    c.light.position.z=z-7;
    const root=c.root, target=root.localToWorld(c.plane.position.clone());
    const side=stage===0?new THREE.Vector3(45,17,-92):stage===1?
      new THREE.Vector3(20,12,-135):stage===2?
      new THREE.Vector3(32,13,z-25):new THREE.Vector3(-36,14,z-35);
    const dest=root.localToWorld(side);
    camera.position.lerp(dest,Math.min(1,dt*5));
    camera.up.set(0,1,0);camera.lookAt(target.clone().add(new THREE.Vector3(0,2,8)));
    camera.fov=stage===3?59:54;camera.updateProjectionMatrix();
    if(t>12.8)scrambleEnd();
  }
  /* --- Observation-only UAVs; deliberately no weapons, detection or attack logic. --- */
  function uavModel(quad) {
    const g=new THREE.Group();
    const body=matStd(0x8797a5,{metalness:.18,roughness:.56});
    const dark=matStd(0x262f38);
    const fus=new THREE.Mesh(new THREE.SphereGeometry(quad?.36:.46,12,8),body);
    fus.scale.set(1,1,quad?1.5:5.5);g.add(fus);
    const rotors=[];
    if(quad){
      for(const x of [-.8,.8])for(const z of [-.8,.8]){
        const arm=new THREE.Mesh(new THREE.BoxGeometry(.09,.08,1.55),dark);
        arm.rotation.y=x*z>0?Math.PI/4:-Math.PI/4;g.add(arm);
        const prop=new THREE.Mesh(new THREE.BoxGeometry(.65,.035,.09),dark);
        prop.position.set(x,.22,z);g.add(prop);rotors.push(prop);
      }
    }else{
      const wing=new THREE.Mesh(new THREE.BoxGeometry(6.2,.08,.52),body);wing.position.set(0,0,-.15);g.add(wing);
      const tail=new THREE.Mesh(new THREE.BoxGeometry(2.3,.07,.32),body);tail.position.set(0,.13,-1.15);g.add(tail);
      const fin=new THREE.Mesh(new THREE.BoxGeometry(.07,.8,.38),dark);fin.position.set(0,.42,-1.15);g.add(fin);
      const prop=new THREE.Mesh(new THREE.BoxGeometry(.8,.055,.07),dark);prop.position.z=1.78;g.add(prop);rotors.push(prop);
    }
    const cameraPod=new THREE.Mesh(new THREE.SphereGeometry(.19,12,8),matStd(0x2a3741));
    cameraPod.position.set(0,-.35,.3);g.add(cameraPod);
    return {g,rotors};
  }
  function uavInit(){
    st.uavs=[];
    if(!APP.sc.droni)return;
    for(const [i,cfg] of APP.sc.droni.entries()){
      const m=uavModel(cfg.tipo==="quad");scene.add(m.g);
      const lab=label(cfg.nome,"#d9eaf7",80);lab.position.y=7;m.g.add(lab);
      const origin=toXZ(cfg.lat,cfg.lon);
      st.uavs.push({cfg,origin,mesh:m.g,rotors:m.rotors,i,disp:null});
    }
  }
  function uavTick(dt,now){
    if(!st || !st.uavs)return;
    const speed=0.13;
    for(const a of st.uavs){
      const isQuad=a.cfg.tipo==="quad";
      const t=now*speed*(isQuad?.75:1)+a.i*2.3;
      const r=a.cfg.raggio_m;
      const x=a.origin.x+Math.sin(t)*r;
      const z=a.origin.z+Math.sin(t*.67)*Math.cos(t)*r*.68;
      const y=elev(x,z)+a.cfg.quota_m+Math.sin(t*.9)*Math.min(18,a.cfg.quota_m*.015);
      const dx=Math.cos(t)*r,dz=r*.68*(.67*Math.cos(t*.67)*Math.cos(t)-Math.sin(t*.67)*Math.sin(t));
      const heading=Math.atan2(dx,dz);
      a.mesh.position.set(x,y,z);a.mesh.rotation.set(isQuad?.025*Math.sin(t*3):-.035,heading,.10*Math.sin(t*.7));
      for(const rotor of a.rotors)rotor.rotation.y+=dt*(isQuad?95:145);
      a.disp={x,y,z,hdg:(heading*180/Math.PI+360)%360,bank:0};
    }
  }
'''
anchor="  /* ---------- loop ---------- */\n  function animate() {"
assert anchor in s
s=s.replace(anchor,visuals+"\n"+anchor,1)
patch("const t = APP.sc.target[0]; const q = toXZ(t.lat, t.lon);",
      "const t = APP.sc.target[0] || APP.sc.basi[0]; const q = toXZ(t.lat, t.lon);")
patch('(st.aux || []).forEach(a => list.push({ f: a, i: 0, aux: true })); return list;',
      '''(st.aux || []).forEach(a => list.push({ f: a, i: 0, aux: true }));
    (st.uavs || []).forEach(u => list.push({ f: { id:u.cfg.id,nome:u.cfg.nome,tipo:"UAV",lato:"BLUE" }, i:0, aux:true,uav:true }));
    return list;''')
patch('if (aux) { const k = "Tanker e AWACS";',
      'if (aux) { const k = f.tipo==="UAV"?"DRONI · osservazione":"Tanker e AWACS";')
patch('function selDisp() { if (String(st.sel).indexOf("aux:") === 0)',
      '''function selDisp() {
    const drone=(st.uavs||[]).find(u=>u.cfg.id===st.sel);
    if(drone)return drone.disp;
    if (String(st.sel).indexOf("aux:") === 0)''')
patch('if (["kill", "ingaggio", "avviso", "inject"].includes(e.tipo) || /AIRBORNE|PUSH|ON STATION|BINGO|SCRAMBLE/.test(e.testo)) ticker(e);',
      'if (["kill", "ingaggio", "avviso", "inject"].includes(e.tipo) || /AIRBORNE|PUSH|ON STATION|BINGO|SCRAMBLE/.test(e.testo)) ticker(e); if(/SCRAMBLE/.test(e.testo) && !st.scramble) scrambleStart(e.chi);')
patch("aggiornaEntita(now); eventi(now); cameraUpdate(dt);",
      "aggiornaEntita(now); eventi(now); uavTick(dt,now); cameraUpdate(dt); if(st.scramble)scrambleTick(dt);")
patch("terreno(root); statici(); aggiornaSelect(); setCam(opt.cam || (selId ? \"insegui\" : \"orbita\"));",
      """terreno(root); statici(); uavInit(); aggiornaSelect(); setCam(opt.cam || (selId ? "insegui" : "orbita"));
    // One cinematic introduction per scene opening (can be skipped instantly).
    if(!opt.record)scrambleStart();""")
patch("cancelAnimationFrame(raf); clearTimeout(raf); overlay.classList.add(\"hidden\");",
      "cancelAnimationFrame(raf); clearTimeout(raf); scrambleEnd(); overlay.classList.add(\"hidden\");")
p.write_text(s,encoding="utf-8")
print("Mission visual upgrade: selectable-area origin, unarmed drones, animated 3D scramble.")
