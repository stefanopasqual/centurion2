#!/usr/bin/env python3
"""Geran-2 (famiglia Shahed-136) come drone ostile simulato della missione M12 "Donbass UAV".

- missioni.js: aggiunge GERAN-1 (lato RED, rotta ad anello inventata) ai droni della M12, al briefing
  e un obiettivo secondario di identificazione (le M13-M15 sostituiscono droni, briefing e obiettivi);
  nelle M13-M15 i droni ostili ad ala fissa diventano Geran-2 in circuito d'attesa attorno alla loro
  posizione (i quadricotteri restano generici);
- js/geran.js: rotta in funzione del tempo di missione e traccia rossa sulla mappa tattica;
- engine.js: il drone NPC GERAN-1 segue la stessa rotta (rilevamento, identificazione e uscita
  dalla zona restano quelli di patch_drone_engine.py);
- map.js: niente cerchio generico per i droni con rotta (li disegna geran.js);
- mondo3d.js: modello GLB (modelli/geran2.glb, Karosio / Sketchfab, CC BY-NC-SA 4.0) con elica
  spingente animata, gruppo "DRONI · ostili" nell'elenco telecamere, chase ravvicinata, vista dal muso.
Solo rappresentazione: nessuna logica d'attacco, nessun bersaglio reale.
Da eseguire dopo patch_donbass.py, patch_drone_missions.py, patch_drone_engine.py, patch_visuals.py
e patch_drone_runtime.py.
"""
from pathlib import Path
import shutil
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "extracted/site")
here = Path(__file__).resolve().parent


def patch_text(s, old, new, nome):
    if old not in s:
        raise RuntimeError(f"{nome}: ancora Geran-2 non trovata: {old[:100]}")
    return s.replace(old, new, 1)


# ---- js/geran.js + script tag (dopo map.js: avvolge MAPPA.aggiornaFlights) ----
shutil.copyfile(here / "geran.js", root / "js" / "geran.js")
idx = root / "index.html"
if idx.exists():
    html = idx.read_text(encoding="utf-8")
    tag = '<script src="js/geran.js"></script>'
    if tag not in html:
        html = patch_text(html, '<script src="js/map.js"></script>', '<script src="js/map.js"></script>\n' + tag, "index.html")
        idx.write_text(html, encoding="utf-8")

# ---- missioni.js: GERAN-1 nella M12 ----
p = root / "js" / "missioni.js"
s = p.read_text(encoding="utf-8")
if 'codice:"DONBASS UAV"' not in s:
    raise RuntimeError("missioni.js: la M12 Donbass UAV manca (eseguire prima patch_donbass.py)")
anchor = "  function trova(id) { return ELENCO.find(m => m.id === id); }"
geran_m12 = r'''
  // Geran-2 ostile (simulato) nella M12: si aggiunge ai droni e al briefing senza toccare il resto della missione.
  (function () {
    const m = ELENCO.find(x => x.id === "M12"); if (!m || m._geran) return; m._geran = true;
    const base = m.applica;
    m.descrizione += " Un drone ostile Geran-2 (famiglia Shahed-136, simulato) percorre una rotta inventata: va individuato e seguito.";
    m.applica = sc => {
      base(sc);
      sc.droni = (sc.droni || []).filter(d => d.id !== "GERAN-1").concat([{
        id: "GERAN-1", nome: "Geran-2 (Shahed-136)", tipo: "geran2", lato: "RED", ostile: true,
        lat: 47.90, lon: 38.30, quota_m: 450, vel_ms: 50, raggio_m: 800,
        // anello fittizio dal settore Est verso l'area di osservazione e ritorno (~155 km, ~52 min a 180 km/h)
        rotta: [[47.90, 38.30], [47.95, 37.95], [48.02, 37.62], [48.12, 37.45], [48.20, 37.62], [48.16, 37.98], [48.06, 38.30]]
      }]);
      (sc.obiettivi = sc.obiettivi || []).push({ tipo: "uav_identificati", minimo: 1, primario: false,
        testo: "Identificare il drone ostile Geran-2 (Mondo 3D: CONFERMA UAV SELEZIONATO, dopo il rilevamento)" });
      const B = sc.briefing && sc.briefing.BLUE;
      if (B) {
        if (typeof B.situazione === "string") B.situazione = B.situazione.replace("I tre droni sono non armati.", "I tre droni da ricognizione sono non armati. Un drone ostile Geran-2 (simulato) attraversa l'area su una rotta ad anello inventata.");
        (B.task = B.task || []).push("Individuare il drone ostile Geran-2 (traccia rossa GERAN-1 sulla mappa dopo il rilevamento, circa 15 minuti), seguirlo nella scena 3D e confermarne l'identificazione");
        B.threat = "Un drone ostile Geran-2 (famiglia Shahed-136) simulato: circa 180 km/h, circa 450 m sul terreno, rotta ad anello inventata. Nessun reparto reale rappresentato; meteo e visibilita variabili.";
        (B.intel = B.intel || []).push("Geran-2: ala a delta di 2,5 m, lunghezza 3,5 m, elica spingente; nella scena 3D si segue con la telecamera Chase");
      }
    };
  })();
'''
geran_m13_15 = r'''
  // M13-M15: i droni ostili ad ala fissa sono Geran-2 in circuito d'attesa (ellisse 4x2 volte il raggio originale,
  // ~180 km/h) attorno alla posizione inventata del drone; rilevamento e identificazione restano quelli del motore.
  (function () {
    const anello = (d, k) => {
      const r = Math.max(1200, d.raggio_m || 1800), a = 4 * r, b = 2 * r, rot = 0.4 + k * 0.9, pts = [];
      const ky = 111320, kx = ky * Math.cos(d.lat * Math.PI / 180);
      for (let i = 0; i < 8; i++) {
        const t = i / 8 * Math.PI * 2, x = a * Math.cos(t), y = b * Math.sin(t);
        const est = x * Math.cos(rot) - y * Math.sin(rot), nord = x * Math.sin(rot) + y * Math.cos(rot);
        pts.push([+(d.lat + nord / ky).toFixed(5), +(d.lon + est / kx).toFixed(5)]);
      }
      return pts;
    };
    ["M13", "M14", "M15"].forEach(id => {
      const m = ELENCO.find(x => x.id === id); if (!m || m._geran) return; m._geran = true;
      const base = m.applica;
      m.descrizione += " I droni nemici ad ala fissa sono Geran-2 (famiglia Shahed-136) simulati.";
      m.applica = sc => {
        base(sc);
        let k = 0;
        sc.droni = (sc.droni || []).map(d => (d.lato === "RED" && d.ostile && d.tipo === "fixed" && typeof d.lat === "number") ?
          Object.assign({}, d, { tipo: "geran2", vel_ms: 50, rotta: anello(d, k++) }) : d);
        const B = sc.briefing && sc.briefing.BLUE;
        if (B && k) {
          B.threat = "Contatti UAV ostili simulati: Geran-2 ad ala fissa (famiglia Shahed-136) in circuito d'attesa e quadricotteri. Nel gioco non hanno armi ne obiettivi di attacco.";
          (B.intel = B.intel || []).push("Geran-2: ala a delta di 2,5 m, circa 180 km/h; dopo il rilevamento compaiono come frecce rosse sulla mappa (ID ?) e nella scena 3D nel gruppo «DRONI · ostili»");
        }
      };
    });
  })();
'''
if "m._geran" not in s:
    s = patch_text(s, anchor, geran_m12 + "\n" + anchor, "missioni.js")
if "circuito d'attesa (ellisse" not in s:
    s = patch_text(s, anchor, geran_m13_15 + "\n" + anchor, "missioni.js")
p.write_text(s, encoding="utf-8")

# ---- engine.js: il drone NPC con rotta segue GERAN.stato (stessa posizione di mappa e 3D) ----
p = root / "js" / "engine.js"
if p.exists():
    s = p.read_text(encoding="utf-8")
    old = """      d.lat=d.lat0+Math.sin(phase)*r/111320;
      d.lon=d.lon0+Math.cos(phase*.78)*r/(111320*Math.cos(d.lat0*Math.PI/180));"""
    if "aggiornaDroni(dt)" in s and "GERAN.stato(d,this.t)" not in s:
        s = patch_text(s, old, """      if(d.rotta&&typeof GERAN!=="undefined"){const g=GERAN.stato(d,this.t);d.lat=g.lat;d.lon=g.lon;d.hdg=g.hdg;}
      else{
      d.lat=d.lat0+Math.sin(phase)*r/111320;
      d.lon=d.lon0+Math.cos(phase*.78)*r/(111320*Math.cos(d.lat0*Math.PI/180));
      }""", "engine.js")
        p.write_text(s, encoding="utf-8")

# ---- map.js: i droni con rotta hanno la traccia di geran.js (freccia, scia), non il cerchio generico ----
p = root / "js" / "map.js"
if p.exists():
    s = p.read_text(encoding="utf-8")
    old = "      if(!d.visibile||d.allontanato)continue;\n      const color=d.lato===\"RED\"?\"#e35d50\":\"#71b9e5\";"
    if "layers.droneMarkers" in s and "d.allontanato||d.rotta" not in s:
        s = patch_text(s, old, old.replace("d.allontanato)continue;", "d.allontanato||d.rotta)continue;"), "map.js")
        p.write_text(s, encoding="utf-8")

# ---- mondo3d.js: modello, moto lungo la rotta, telecamere ----
p = root / "js" / "mondo3d.js"
s = p.read_text(encoding="utf-8")
if "function uavTick(dt,now)" not in s:
    raise RuntimeError("mondo3d.js: droni M12 assenti (eseguire prima patch_visuals.py)")
funzioni = r'''  /* --- Geran-2 ostile della M12 (rotta e tempo in js/geran.js): solo rappresentazione, nessuna logica d'attacco. --- */
  function geranElica(){
    // disco dell'elica spingente in rotazione: scie radiali semitrasparenti
    const c=document.createElement("canvas");c.width=c.height=128;const g=c.getContext("2d");
    const grd=g.createRadialGradient(64,64,6,64,64,63);grd.addColorStop(0,"rgba(30,32,34,.55)");grd.addColorStop(.75,"rgba(40,42,44,.22)");grd.addColorStop(1,"rgba(40,42,44,0)");
    g.fillStyle=grd;g.beginPath();g.arc(64,64,63,0,Math.PI*2);g.fill();
    for(const a0 of [0,Math.PI]){g.fillStyle="rgba(20,22,24,.30)";g.beginPath();g.moveTo(64,64);g.arc(64,64,62,a0-.35,a0+.35);g.closePath();g.fill();}
    g.fillStyle="rgba(15,16,18,.9)";g.beginPath();g.arc(64,64,7,0,Math.PI*2);g.fill();
    return srgb(new THREE.CanvasTexture(c));
  }
  function geranSenzaPale(m){
    // nel GLB l'elica e ferma: in volo si tolgono le pale (oltre z -1,68 m nel modello normalizzato, fuori dal mozzo)
    // da una copia della geometria, e resta il disco in rotazione; l'hangar mostra il modello intero
    try{
      m.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(m.matrixWorld).invert(),v=new THREE.Vector3();
      m.traverse(o=>{
        if(!o.isMesh||!o.geometry||!o.geometry.index)return;
        const geo=o.geometry.clone(),pos=geo.attributes.position,ix=geo.index.array,rel=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld),keep=[];
        for(let t=0;t<ix.length;t+=3){
          let pala=true,cx=0,cy=0;
          for(let k=0;k<3;k++){v.fromBufferAttribute(pos,ix[t+k]).applyMatrix4(rel);if(v.z>-1.68)pala=false;cx+=v.x;cy+=v.y;}
          if(pala&&Math.hypot(cx/3,cy/3-.02)>.08)continue;
          keep.push(ix[t],ix[t+1],ix[t+2]);
        }
        geo.setIndex(keep);o.geometry=geo;
      });
    }catch(e){console.warn("Geran-2: elica non separata",e);}
    return m;
  }
  function geranModel(){
    const g=new THREE.Group(),holder=new THREE.Group();g.add(holder);
    // sagoma provvisoria (muso +Z, misure reali) finche il GLB non e caricato; resta se il file manca
    const prov=new THREE.Group();holder.add(prov);
    const pelle=matStd(0x8e918a,{roughness:.72,metalness:.08}),scuro=matStd(0x2b2f33);
    const fus=new THREE.Mesh(new THREE.CylinderGeometry(.17,.15,3.0,12),pelle);fus.rotation.x=Math.PI/2;fus.position.z=-.1;prov.add(fus);
    const muso=new THREE.Mesh(new THREE.SphereGeometry(.17,12,8),pelle);muso.scale.z=2;muso.position.z=1.4;prov.add(muso);
    const forma=new THREE.Shape();forma.moveTo(0,-.45);forma.lineTo(1.25,1.65);forma.lineTo(-1.25,1.65);forma.closePath();
    const ala=new THREE.Mesh(new THREE.ShapeGeometry(forma),matStd(0x8e918a,{roughness:.72,metalness:.08,side:THREE.DoubleSide}));ala.rotation.x=-Math.PI/2;prov.add(ala);
    for(const sx of [-1,1]){const w=new THREE.Mesh(new THREE.BoxGeometry(.03,.5,.42),scuro);w.position.set(sx*1.25,0,-1.45);prov.add(w);}
    const disco=new THREE.Mesh(new THREE.CircleGeometry(.43,28),new THREE.MeshBasicMaterial({map:geranElica(),transparent:true,depthWrite:false,side:THREE.DoubleSide}));
    disco.position.set(0,.03,-1.79);holder.add(disco);
    if(typeof VISTA3D!=="undefined"&&VISTA3D.modelloPromise)VISTA3D.modelloPromise("drone",undefined,{tipoId:"GERAN2"}).then(m=>{
      // solo il GLB del Geran: niente ripiego su un modello di jet
      if(!m||m.name!=="gltf_GERAN2"||!st||!g.parent)return;
      holder.remove(prov);prov.traverse(o=>{if(o.geometry)o.geometry.dispose();});holder.add(geranSenzaPale(m));
    }).catch(()=>{});
    return {g,holder,disco,rotors:[]};
  }
  function geranTick(a,dt,now){
    if(st.gNow!==now){
      st.gNow=now;
      // tempo di missione continuo fra un tick e l'altro del motore (fermo in pausa, come gli altri velivoli)
      const eng=APP.engine,F=st.fixed,tk=eng.tick_sec||10,rate=F?F.speed:(APP.playing?(APP.speed||1):0);
      st.gT=(st.gT==null||Math.abs(st.gT-eng.t)>2*tk+5)?eng.t:Math.min(eng.t+tk,Math.max(eng.t-tk,st.gT+dt*rate));
      if(st.gSel!==st.sel){
        // chase ravvicinata e un po' alta (si vede la pianta a delta) quando si seleziona il drone; distanza precedente al cambio
        const prima=(st.uavs||[]).find(u=>u.geran&&u.cfg.id===st.gSel),ora=(st.uavs||[]).find(u=>u.geran&&u.cfg.id===st.sel);
        if(ora&&!prima){st.gDist=st.chase.dist;st.chase.dist=12;st.chase.yaw=0;st.chase.pitch=.3;}
        else if(prima&&!ora&&st.gDist){st.chase.dist=st.gDist;st.gDist=null;}
        st.gSel=st.sel;
      }
    }
    const s=GERAN.stato(a.cfg,st.gT),q=toXZ(s.lat,s.lon);
    const y=elev(q.x,q.z)+s.quota_m+Math.sin(now*.7+a.i)*1.2;
    a.mesh.rotation.order="YXZ";
    a.mesh.rotation.set(-.015+Math.sin(now*.9+a.i)*.008,Math.PI-s.hdg*Math.PI/180,s.bank*Math.PI/180+Math.sin(now*1.3+a.i)*.015);
    a.mesh.position.set(q.x,y,q.z);
    a.disco.rotation.z+=dt*70;
    const dist=camera.position.distanceTo(a.mesh.position),vicina=st.cam==="cockpit"||st.cam==="insegui";
    const scala=st.scalaGrande&&!vicina?Math.max(1.6,dist*.012/3.5):1;a.holder.scale.setScalar(scala);
    // stato dal motore (patch_drone_engine.py): fuori zona -> nascosto; identificato -> etichetta col tipo
    const live=((APP.engine&&APP.engine.droni)||[]).find(d=>d.id===a.cfg.id),ident=!live||live.identificato;
    a.mesh.visible=!(live&&live.allontanato)&&!(st.cam==="cockpit"&&st.sel===a.cfg.id);
    const ls=Math.max(st.cam==="insegui"?5:60,dist*.028),nasc=vicina&&st.sel===a.cfg.id;
    for(const [lb,on] of [[a.label,!ident],[a.labId,ident]])if(lb){lb.scale.set(ls*4,ls,1);lb.position.y=2*scala+ls*.6;lb.visible=on&&!nasc;}
    a.disp={x:q.x,y,z:q.z,hdg:s.hdg,bank:s.bank};
  }
  function geranHud(c,W,H,a){
    // didascalia in basso al centro: in alto c'e la barra dei comandi della scena
    const d=a.disp,agl=Math.max(0,d.y-elev(d.x,d.z)),bw=Math.min(W-24,430),x0=(W-bw)/2,y0=H-128;
    c.save();c.fillStyle="rgba(40,10,10,.62)";c.fillRect(x0,y0,bw,50);c.strokeStyle="rgba(255,140,128,.8)";c.strokeRect(x0+.5,y0+.5,bw-1,49);
    c.font="600 13px monospace";c.textAlign="center";c.fillStyle="rgba(255,226,218,.96)";
    c.fillText("GERAN-2 · "+a.cfg.id+" · VISTA DAL MUSO (SIMULATA)",W/2,y0+20);
    c.fillText("AGL "+Math.round(agl)+" m · "+Math.round((a.cfg.vel_ms||50)*3.6)+" km/h · HDG "+Math.round(d.hdg)+"° · rotta inventata",W/2,y0+40);
    c.restore();
  }
'''
if "function geranTick(" not in s:
    s = patch_text(s, "  function uavInit(){", funzioni + "  function uavInit(){", "mondo3d.js")
    s = patch_text(s, 'const m=uavModel(cfg.tipo==="quad");scene.add(m.g);',
                   'if(cfg.tipo==="geran2"&&typeof GERAN==="undefined")continue;\n      const m=cfg.tipo==="geran2"?geranModel():uavModel(cfg.tipo==="quad");scene.add(m.g);', "mondo3d.js")
    s = patch_text(s, 'const lab=label(cfg.nome,cfg.lato==="RED"?"#ff9e89":"#d9eaf7",10);lab.position.y=10;m.g.add(lab);',
                   'const lab=label(cfg.tipo==="geran2"?cfg.id+" · ?":cfg.nome,cfg.lato==="RED"?"#ff9e89":"#d9eaf7",10);lab.position.y=10;m.g.add(lab);\n'
                   '      const labId=cfg.tipo==="geran2"?label(/^GERAN/.test(cfg.id)?"GERAN-2 · OSTILE":GERAN.etichetta(cfg,true),"#ff9e89",10):null;if(labId){labId.visible=false;m.g.add(labId);}', "mondo3d.js")
    s = patch_text(s, 'st.uavs.push({cfg,origin,mesh:m.g,rotors:m.rotors,animate:m.animate,label:lab,i,disp:null});',
                   'st.uavs.push({cfg,origin,mesh:m.g,rotors:m.rotors,animate:m.animate,label:lab,i,disp:null,geran:cfg.tipo==="geran2",holder:m.holder,disco:m.disco,labId});', "mondo3d.js")
    s = patch_text(s, 'for(const a of st.uavs){\n      const isQuad=a.cfg.tipo==="quad";',
                   'for(const a of st.uavs){\n      if(a.geran){geranTick(a,dt,now);continue;}\n      const isQuad=a.cfg.tipo==="quad";', "mondo3d.js")
    s = patch_text(s, '(st.uavs || []).forEach(u => list.push({ f: { id:u.cfg.id,nome:u.cfg.nome,tipo:"UAV",lato:u.cfg.lato||"BLUE" }, i:0, aux:true,uav:true }));',
                   '(st.uavs || []).forEach(u => list.push({ f: { id:u.cfg.id,nome:u.cfg.nome,tipo:u.geran?"DRONE OSTILE":"UAV",lato:u.cfg.lato||"BLUE" }, i:0, aux:true,uav:true }));', "mondo3d.js")
    s = patch_text(s, 'const k = f.tipo==="UAV"?"DRONI · osservazione / RED":"Tanker e AWACS";',
                   'const k = f.tipo==="UAV"?"DRONI · osservazione / RED":f.tipo==="DRONE OSTILE"?"DRONI · ostili":"Tanker e AWACS";', "mondo3d.js")
    s = patch_text(s, 'if(drone && drone.disp){',
                   'if(drone && drone.disp && drone.geran){geranHud(c,W,H,drone);}\n      else if(drone && drone.disp){', "mondo3d.js")
    s = patch_text(s, 'const sensor=(st.uavs||[]).find(u=>u.cfg.id===st.sel);',
                   'const sensor=(st.uavs||[]).find(u=>u.cfg.id===st.sel&&!u.geran),gsel=(st.uavs||[]).find(u=>u.cfg.id===st.sel&&u.geran);', "mondo3d.js")
    s = patch_text(s, 'addScaledVector(fwd, sensor?1.2:6).add(new THREE.Vector3(0,sensor?-.22:2.0,0))',
                   'addScaledVector(fwd, sensor?1.2:gsel?2.1:6).add(new THREE.Vector3(0,sensor?-.22:gsel?.3:2.0,0))', "mondo3d.js")
p.write_text(s, encoding="utf-8")
print("Geran-2: drone ostile simulato nella M12 e droni ostili ad ala fissa delle M13-M15 (mappa tattica e Mondo 3D)")
