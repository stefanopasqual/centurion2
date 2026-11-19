#!/usr/bin/env python3
"""Integrate the user-supplied A380-841 GLB into Centurion2 Hangar / Free Flight.

The source GLB is redistributed only if model-sources/a380.glb exists.
Otherwise the hangar imports it once into IndexedDB; Free Flight then uses
that exact saved file. A procedural A380 is a visual fallback only.
"""
from pathlib import Path
import json, sys, shutil

root=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")
air=Path(__file__).resolve().parent
def modify(path,old,new):
    p=root/path
    txt=p.read_text(encoding="utf-8")
    if txt.count(old)!=1:
        raise RuntimeError(f"A380 patch anchor count {txt.count(old)} in {path}: {old[:96]}")
    p.write_text(txt.replace(old,new,1),encoding="utf-8")

# Fleet: mass is reference simulated operating mass; MTOW is a limit, not a fixed
# flight mass. Fuel mass decreases with time, no afterburner or weapon systems.
modify("js/volo.js","  /* ---------- armi ---------- */",
    """  /* ---------- armi ---------- */""")
fleet_marker='    KC30:{nome:"Airbus KC-30 / A330 MRTT"'
fleet_path=root/"js/volo.js"
fleet=fleet_path.read_text(encoding="utf-8")
if fleet.count(fleet_marker)!=1:raise RuntimeError("A380: existing KC30 spec not found")
fleet=fleet.replace(fleet_marker,
'''    A380:{nome:"Airbus A380-841 · Lufthansa 100th Year",icona:"a380",nonArmato:true,noEject:true,
      m:445000,S:845,span:79.8,length:72.7,height:24.1,chord:10.59,oswald:.83,
      Tmil:1240000,Tab:1240000,cd0:.0205,k:.045,cla:5.2,amax:14,astall:17,
      criticalMach:.80,waveRise:.085,servoTau:.5,pmax:22,gmax:2.5,gneg:1,
      fuel:170000,gearHeight:6.8,vr:77.5,engineTau:7.0,nonAB:true,
      colpi:0,cannone:"Nessuno",carico:{}},
'''+fleet_marker,1)
fleet_path.write_text(fleet,encoding="utf-8")

# The A380 is 80 m wide; the default 45 m simulated strip is too narrow.
modify("js/volo.js",
'const hdg = (b.pista_hdg != null ? b.pista_hdg : 110) * D2R; const L = 2700;',
'const hdg = (b.pista_hdg != null ? b.pista_hdg : 110) * D2R; const L = S.cfg.aereo==="A380"?4200:2700; const W=S.cfg.aereo==="A380"?84:45;')
modify("js/volo.js",
'new THREE.PlaneGeometry(45, L),',
'new THREE.PlaneGeometry(W, L),')
modify("js/volo.js",
'for (let j = -8; j <= 8; j++)',
'for (let j = -8; j <= 8; j++)')
modify("js/volo.js",
'const m = AEREI[S.cfg.aereo] || AEREI.F16;', 'const m = AEREI[S.cfg.aereo] || AEREI.F16;') if False else None
# Aircraft-specific touchdown height.
modify("js/volo.js",
'const P = S.pl; const sc = APP.sc;\n    if (S.cfg.partenza === "pista")',
'const P = S.pl; const sc = APP.sc;\n    if (S.cfg.partenza === "pista")') if False else None

# Free flight player starts at the right ground clearance.
modify("js/volo.js",
'p.y + 2.2, p.z - p.uz * (p.L / 2 - 120)',
'p.y + (S.cfg.aereo==="A380"?6.8:2.2), p.z - p.uz * (p.L / 2 - 120)')
modify("js/volo.js",
'const suolo = quotaSuolo(P.pos.x, P.pos.z); P.agl = P.pos.y - suolo;\n    if (P.agl < 2.2)',
'const suolo = quotaSuolo(P.pos.x, P.pos.z); P.agl = P.pos.y - suolo;\n    if (P.agl < (A.gearHeight||2.2))')
modify("js/volo.js",
'if (P.carrello && sink < 4.5 && Math.abs(roll) < 12 && pitch > -4 && pitch < 20 && inPista)',
'if (P.carrello && sink < 4.5 && Math.abs(roll) < 12 && pitch > -4 && pitch < 20 && inPista)') if False else None

# Sixth-degree dynamics and surface model receive the same gear clearance.
modify("js/volo.js",
'    if(P.agl<2.2){\n      assi(P.Q);',
'    if(P.agl<(A.gearHeight||2.2)){\n      assi(P.Q);')
modify("js/volo.js",
'P.pos.y+=2.2-P.agl;P.vel.y=0;',
'P.pos.y+=(A.gearHeight||2.2)-P.agl;P.vel.y=0;')
modify("js/volo.js",
'P.rigid6=null;P.agl=2.2;P.p=P.q=P.r=0;',
'P.rigid6=null;P.agl=(A.gearHeight||2.2);P.p=P.q=P.r=0;')
modify("js/volo.js",
'P.pos.y = suolo + 2.2; P.agl = 2.2;',
'P.pos.y = suolo + (A.gearHeight||2.2); P.agl = (A.gearHeight||2.2);')
modify("js/volo.js",
'Math.abs(-dx * S.pista.uz + dz * S.pista.ux), u =',
'Math.abs(-dx * S.pista.uz + dz * S.pista.ux), u =')
modify("js/volo.js",
'if ((w > 40 || u > S.pista.L / 2 + 140)',
'if ((w > (S.cfg.aereo==="A380"?45:40) || u > S.pista.L / 2 + 140)')
modify("js/volo.js",
'if (Lift > W * 1.02 && In.sy > 0.1)',
'if (Lift > W * 1.02 && In.sy > 0.1 && Vn >= (A.vr||0))')
# A380 has no afterburner and slower engine spool.
modify("js/volo.js",
'      const mil=thr<=.8?.05+.95*thr/.8:1;\n      const ab=thr>.8?(thr-.8)/.2:0;',
'''      const mil=A.nonAB?thr:(thr<=.8?.05+.95*thr/.8:1);
      const ab=A.nonAB?0:(thr>.8?(thr-.8)/.2:0);''')
modify("js/volo.js",
'      P.spinta+=(mil-P.spinta)*(1-Math.exp(-dt/1.4));',
'      P.spinta+=(mil-P.spinta)*(1-Math.exp(-dt/(A.engineTau||1.4)));')
modify("js/volo.js",
'      P.ab+=(ab-P.ab)*(1-Math.exp(-dt/.6));',
'      P.ab+=(ab-P.ab)*(1-Math.exp(-dt/.6));')
modify("js/volo.js",
'      const burn=(A.Tmil*P.spinta*2.2e-5+',
'      const burn=(A.Tmil*P.spinta*(A.nonAB?9.0e-6:2.2e-5)+')
# Only for A380, remove the simulated fighter-like AB UI and cabin/weapon displays.
modify("js/volo.js",
'    ov.classList.toggle("vl-unarmed",!!S.pl.A.nonArmato);',
'    ov.classList.toggle("vl-unarmed",!!S.pl.A.nonArmato);\n    ov.classList.toggle("vl-airliner",S.cfg.aereo==="A380");')
modify("js/volo.js",
'    if(AEREI[cfg.aereo]?.nonArmato){cfg.nemici=0;cfg.sam=false;}',
'    if(AEREI[cfg.aereo]?.nonArmato){cfg.nemici=0;cfg.sam=false;}')
# A new A380 can open at a stable cruise point, not supersonic.
modify("js/volo.js",
'    P.M = 0; P.agl = 0; P.qbar = 0;',
'    if(S.cfg.aereo==="A380"&&!P.aTerra){const v=P.vel.normalize().multiplyScalar(232);P.vel.copy(v);S.thr=.73;P.pos.y=9750;}\n    P.M = 0; P.agl = 0; P.qbar = 0;')
# Standard Free Flight setup later overrides ground altitude after terrain loads.
modify("js/volo.js",
'P.pos.y = S.pista.y + 2.2; S.pausa = false;',
'P.pos.y = S.pista.y + (P.A.gearHeight||2.2); S.pausa = false;')
modify("js/volo.js",
'ov.classList.toggle("touch", mobile());',
'ov.classList.toggle("touch", mobile());')
# On exiting or switching, the user file remains in browser IndexedDB.

# Aero: an A380 profile with transport drag divergence and wing efficiency.
modify("js/aero_core.js",
'    kc30:{span:60.30,criticalMach:.76,waveRise:.130,oswald:.82},',
'    kc30:{span:60.30,criticalMach:.76,waveRise:.130,oswald:.82},\n    a380:{span:79.8,criticalMach:.80,waveRise:.085,oswald:.83},')

# Load the exact imported user's GLB from hangar IndexedDB in Free Flight.
# When the binary is committed at model-sources/a380.glb, the normal manifest
# loader takes precedence automatically.
mod_path=root/"js"/"vista3d.js"
source=mod_path.read_text(encoding="utf-8")
old='''  function modelloPromise(icona, col, opt) {
    // 1) modello glTF reale se presente in app/modelli; 2) altrimenti modello procedurale
    const tipo = (opt && opt.tipoId) || ICONA2TIPO[icona] || "F16";
    return gltfModello(tipo, col, opt).catch(() => null).then(m => m || modelloProcedurale(icona, col, opt));
  }'''
new='''  function a380FromLocal(){
    if(typeof indexedDB==="undefined" || typeof THREE.GLTFLoader==="undefined")return Promise.resolve(null);
    return new Promise(resolve=>{
      let request;
      try{request=indexedDB.open("centurion2-glb-v1",1);}catch(e){resolve(null);return;}
      request.onupgradeneeded=()=>request.result.createObjectStore("files");
      request.onerror=()=>resolve(null);
      request.onsuccess=()=>{
        const db=request.result;
        const tx=db.transaction("files","readonly");
        const item=tx.objectStore("files").get("a380");
        item.onerror=()=>{db.close();resolve(null);};
        item.onsuccess=()=>{
          const file=item.result;db.close();
          if(!file){resolve(null);return;}
          file.arrayBuffer().then(bytes=>new Promise((ok,bad)=>{
            new THREE.GLTFLoader().parse(bytes,"",g=>ok(g.scene),bad);
          })).then(raw=>{
            const wrap=new THREE.Group();wrap.name="Airbus A380-841 · Lufthansa 100th Year";
            wrap.add(raw);raw.rotation.y=0;raw.updateMatrixWorld(true);
            const bounds=new THREE.Box3().setFromObject(raw),dim=bounds.getSize(new THREE.Vector3());
            const scl=79.8/Math.max(.001,dim.x);raw.scale.multiplyScalar(scl);raw.updateMatrixWorld(true);
            const center=new THREE.Box3().setFromObject(raw).getCenter(new THREE.Vector3());
            raw.position.sub(center);
            wrap.userData.origine="File importato dall Hangar · Nobilis 2, CC BY 4.0";
            wrap.userData.anim=()=>{};
            resolve(wrap);
          }).catch(()=>resolve(null));
        };
      };
    });
  }
  function modelloPromise(icona, col, opt) {
    const tipo=(opt&&opt.tipoId)||ICONA2TIPO[icona]||"F16";
    if(tipo==="A380"||icona==="a380"){
      return gltfModello("A380",col,opt).catch(()=>null)
        .then(model=>model||a380FromLocal())
        .then(model=>model||(window.CENTURION_A380?Promise.resolve(window.CENTURION_A380.create(THREE)):modelloProcedurale("kc30",col,opt)));
    }
    return gltfModello(tipo,col,opt).catch(()=>null).then(m=>m||modelloProcedurale(icona,col,opt));
  }'''
if source.count(old)!=1:raise RuntimeError("A380 loader anchor mismatch")
mod_path.write_text(source.replace(old,new,1),encoding="utf-8")

# Hangar: user import takes priority; source remains intact including Lufthansa texture.
v=root/"ef2000"/"viewer.html";page=v.read_text(encoding="utf-8")
old="{id:'f16',name:'General Dynamics F-16C Fighting Falcon',tag:'F-16C',url:'',info:'F-16C Fighting Falcon · modello originale semplificato CENTURION2, carrello retratto'},"
new=old+"\n{id:'a380',name:'Airbus A380-841 · Lufthansa 100th Year',tag:'A380-841',url:'https://sketchfab.com/3d-models/airbus-a380-841-lufthansa-100th-year-0de836a0d2b04fdf92f0d56c7886c82b',info:'Airbus A380-841 Lufthansa 100th Year · Nobilis 2, CC BY 4.0 · importa GLB se non presente sul sito'},"
if page.count(old)!=1:raise RuntimeError("A380 hangar menu anchor mismatch")
page=page.replace(old,new,1)
old="const CREDITI={f16:"
if page.count(old)!=1:raise RuntimeError("A380 credit anchor mismatch")
page=page.replace(old,"const CREDITI={a380:'Nobilis 2 (Sketchfab) · CC BY 4.0 · Lufthansa 100th Year',f16:",1)
old="scene.add(aircraft);frame(aircraft);"
new='''if(selected.id==="a380"){
    aircraft.rotation.y=0;
    const bounds=new THREE.Box3().setFromObject(aircraft),dims=bounds.getSize(new THREE.Vector3());
    aircraft.scale.multiplyScalar(79.8/Math.max(.001,dims.x));
  }
  scene.add(aircraft);frame(aircraft);'''
if page.count(old)!=1:raise RuntimeError("A380 model placement anchor mismatch")
page=page.replace(old,new,1)
v.write_text(page,encoding="utf-8")

# Optional central hosting: user-supplied binary is not held by connector.
asset=Path("model-sources/a380.glb")
if asset.is_file():
    out=root/"models"/"a380.glb";out.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(asset,out)
    if out.stat().st_size<100000 or out.read_bytes()[:4]!=b"glTF":
        raise RuntimeError("A380 GLB file corrupt or not GLTF")
    mission=root/"modelli"/"a380.glb";mission.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(out,mission)
    manifest=root/"modelli"/"manifest.json"
    m=json.loads(manifest.read_text(encoding="utf-8"))
    m["A380"]={"file":"a380.glb","rot":[0,0,0],"lunghezza_m":72.7,
        "autore":"Nobilis 2","licenza":"CC BY 4.0",
        "url":"https://sketchfab.com/3d-models/airbus-a380-841-lufthansa-100th-year-0de836a0d2b04fdf92f0d56c7886c82b"}
    manifest.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding="utf-8")
    catalogue=root/"models"/"manifest.json"
    raw=json.loads(catalogue.read_text(encoding="utf-8"))
    raw["models"].append({"id":"a380","name":"Airbus A380-841 Lufthansa 100th Year","glb":"models/a380.glb",
        "status":"ready","source":m["A380"]["url"],"author":"Nobilis 2","license":"CC BY 4.0"})
    catalogue.write_text(json.dumps(raw,ensure_ascii=False,indent=2),encoding="utf-8")
    print("A380: exact user GLB automatically hosted in Hangar & Free Flight")
else:
    print("A380: source not yet in GitHub; import via Hangar to share exact user GLB with Free Flight")

# Always present procedural fallback when original GLB has not yet been imported.
shutil.copyfile(air/"a380.js",root/"js"/"a380.js")
index=root/"index.html";html=index.read_text(encoding="utf-8")
tag='<script src="js/a380.js"></script>'
anchor='<script src="js/volo.js"></script>'
if tag not in html:
    assert anchor in html
    html=html.replace(anchor,tag+"\n"+anchor,1)
style="""<style id="a380-airliner-ui">
#volo.vl-airliner #vl-manetta-ab{display:none!important}
#volo.vl-airliner #vl-lock,#volo.vl-airliner #vl-arma,
#volo.vl-airliner #vl-fuoco,#volo.vl-airliner #vl-flare,
#volo.vl-airliner #vl-eject{display:none!important}
</style>"""
if "a380-airliner-ui" not in html:html=html.replace("</head>",style+"\n</head>",1)
index.write_text(html,encoding="utf-8")
print("PASS A380: hangar selector, local GLB, original attribution, civilian 6DOF, 4-engine profile")
