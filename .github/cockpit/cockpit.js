/* CENTURION 2 - cockpit / helmet visual instruments.
   Approximate layouts inspired by aircraft instrument philosophies.
   NOT authentic cockpit geometry or certified avionics. */
window.CENTURION_COCKPIT = (() => {
  const profiles = {
    F16: {name:"F-16C",panels:2,accent:"#66ffa3",style:"f16",labels:["FCR","HSD"],title:"ICP / DED"},
    F15: {name:"F-15E",panels:3,accent:"#79f6b9",style:"f15",labels:["RADAR","TSD","FLIR"],title:"UFC"},
    F2000:{name:"EUROFIGHTER",panels:3,accent:"#81e5cf",style:"typhoon",labels:["TACTICAL","NAV","SYSTEM"],title:"MIDS"},
    F22: {name:"F-22A",panels:3,accent:"#80e6cc",style:"f22",labels:["TACTICAL","PFD","SYSTEM"],title:"ICP"},
    SU57:{name:"SU-57",panels:2,accent:"#85ffba",style:"sukhoi",labels:["RADAR","NAV"],title:"MULTIFUNCTION"},
    SU35:{name:"SU-35",panels:2,accent:"#9bedbe",style:"sukhoi",labels:["RADAR","ENGINE"],title:"MULTIFUNCTION"},
    EA18:{name:"EA-18G",panels:3,accent:"#9ceba5",style:"hornet",labels:["EW","RADAR","NAV"],title:"UFCD"}
  };

  // Local eye offsets (metres): X lateral, Y up, Z nose-forward.
  const eyes={F16:[0,1.13,3.1],F15:[0,1.45,4.6],F2000:[0,1.38,3.5],
    F22:[0,1.42,4.1],SU57:[0,1.35,4.7],SU35:[0,1.54,4.9],EA18:[0,1.42,4.1]};
  const interiorRe=/cockpit|instrument|panel|hud|seat|console|dashboard|mfd/i;
  const canopyRe=/canopy|glass|windscreen|windshield/i;
  const occludeRe=/pilotbody|pilothead|pilothelmet|pilot_mesh|occupant/i;
  const modelCache=new WeakMap();
  function inspect(root,type){
    if(!root||!root.userData||!root.userData.mdl)return null;
    const mdl=root.userData.mdl;
    const cached=modelCache.get(root);
    if(cached&&cached.model===mdl)return cached;
    const interiors=[],canopies=[];
    mdl.traverse(o=>{
      if(!o.isMesh)return;
      const name=(o.name||"")+" "+(o.parent&&o.parent.name||"");
      if(interiorRe.test(name)&&!canopyRe.test(name))interiors.push(o);
      if(canopyRe.test(name))canopies.push(o);
    });
    const eye=new THREE.Vector3(...(eyes[type]||eyes.F16));
    // Prefer named pilot viewpoint nodes, then model-specific default offsets.
    let camNode=null;
    mdl.traverse(o=>{if(!camNode&&/pilot.?eye|eye.?point|camera.?pilot/i.test(o.name||""))camNode=o;});
    if(camNode){
      const w=camNode.getWorldPosition(new THREE.Vector3());
      root.worldToLocal(w); eye.copy(w);
    }
    const data={model:mdl,eye,hasInterior:interiors.length>0,interiors,canopies};
    modelCache.set(root,data);return data;
  }
  function setView(root,type,inside){
    if(!root)return null;
    const d=inspect(root,type);
    if(!d){root.visible=!inside;return null;}
    d.model.traverse(o=>{
      if(!o.isMesh)return;
      const name=(o.name||"")+" "+(o.parent&&o.parent.name||"");
      if(occludeRe.test(name)){o.visible=!inside;return;}
      o.visible=true;
      if(canopyRe.test(name)&&inside){
        if(!o.userData.origMaterial)o.userData.origMaterial=o.material;
        if(!o.userData.cockpitMaterial && !Array.isArray(o.material)){
          const m=o.material.clone();m.transparent=true;m.opacity=Math.min(.25,m.opacity===undefined?1:m.opacity);
          m.depthWrite=false;o.userData.cockpitMaterial=m;
        }
        if(o.userData.cockpitMaterial)o.material=o.userData.cockpitMaterial;
      }else if(!inside && o.userData.origMaterial)o.material=o.userData.origMaterial;
    });
    root.visible=!inside||d.hasInterior;
    return d;
  }
  function cameraEye(root,type){
    const d=inspect(root,type);
    if(!root)return null;
    root.updateMatrixWorld(true);
    const eye=d?d.eye:new THREE.Vector3(...(eyes[type]||eyes.F16));
    return root.localToWorld(eye.clone());
  }
  function diagnose(camera,root,type){
    const d=inspect(root,type);
    if(!d)return {ready:false,reason:"model loading"};
    const ray=new THREE.Raycaster(camera.position.clone(),new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion),.06,100);
    const hits=d.hasInterior?ray.intersectObject(d.model,true):[];
    const first=hits.find(h=>h.object.visible&&!canopyRe.test(h.object.name||""));
    return {ready:true,type,interior:d.hasInterior,eye:d.eye.toArray(),interiorMeshes:d.interiors.length,
      canopyMeshes:d.canopies.length,obstruction:first?{mesh:first.object.name,meters:+first.distance.toFixed(2)}:null};
  }

  let overlay=null,ctx=null;
  function attach(parent) {
    overlay=parent.querySelector("#vl-cockpit-art");
    if(!overlay){overlay=document.createElement("canvas");overlay.id="vl-cockpit-art";
      overlay.style.cssText="position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none";
      const hud=parent.querySelector("#vl-hud");hud.parentNode.insertBefore(overlay,hud);
    }
    ctx=overlay.getContext("2d");
    resize();
  }
  function resize(){if(!overlay)return;const d=Math.min(window.devicePixelRatio||1,1.5);
    overlay.width=Math.round(innerWidth*d);overlay.height=Math.round(innerHeight*d);}
  const fmt=(v,n=0)=>Number.isFinite(v)?v.toFixed(n):"--";
  function text(g,s,x,y,z=12,col="#a0ffc7",align="center"){g.font="600 "+z+"px monospace";g.fillStyle=col;g.textAlign=align;g.fillText(String(s),x,y);}
  function poly(g,pts,stroke,width=2){g.strokeStyle=stroke;g.lineWidth=width;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.stroke();}
  function frame(g,x,y,w,h,accent,label){
    g.fillStyle="rgba(8,17,23,.97)";g.fillRect(x,y,w,h);g.strokeStyle="#3b4b51";g.lineWidth=5;g.strokeRect(x,y,w,h);
    g.strokeStyle="#84989e";g.lineWidth=1;g.strokeRect(x+5,y+5,w-10,h-10);
    text(g,label,x+w/2,y+17,11,accent);
    for(let i=0;i<4;i++){let py=y+h*(.22+i*.18);g.fillStyle="#434d52";g.fillRect(x-8,py-4,6,8);g.fillRect(x+w+2,py-4,6,8);}
  }
  function instrument(g,x,y,w,h,label,index,data,accent){
    frame(g,x,y,w,h,accent,label);const cx=x+w/2,cy=y+h*.51;
    g.save();g.beginPath();g.rect(x+9,y+23,w-18,h-34);g.clip();
    g.strokeStyle="rgba(91,250,161,.32)";g.lineWidth=1;
    for(let j=1;j<5;j++){g.beginPath();g.moveTo(x+10,y+22+j*(h-32)/5);g.lineTo(x+w-10,y+22+j*(h-32)/5);g.stroke();}
    if(index===0){
      g.strokeStyle=accent;g.beginPath();g.arc(cx,cy,Math.min(w,h)*.28,0,Math.PI*2);g.stroke();
      g.beginPath();g.moveTo(cx-16,cy);g.lineTo(cx+16,cy);g.moveTo(cx,cy-16);g.lineTo(cx,cy+16);g.stroke();
      for(let j=0;j<4;j++){let a=j*Math.PI/2+data.hdg*Math.PI/180;
        poly(g,[[cx,cy],[cx+Math.cos(a)*w*.28,cy+Math.sin(a)*h*.24]],"rgba(100,255,160,.32)",1);}
      text(g,fmt(data.hdg,0)+"°",cx,y+h-15,11,accent);
    }else if(index===1){
      text(g,"SPD  "+fmt(data.kt)+" KT",cx,cy-25,12,accent);
      text(g,"ALT  "+fmt(data.alt)+" FT",cx,cy-3,12,accent);
      text(g,"M    "+fmt(data.mach,2),cx,cy+19,12,accent);
      text(g,"G    "+fmt(data.nz,1),cx,cy+41,12,accent);
    }else{
      text(g,"FUEL  "+fmt(data.fuel)+" KG",cx,cy-24,12,accent);
      text(g,"HDG   "+fmt(data.hdg)+"°",cx,cy,12,accent);
      text(g,"GEAR  "+(data.gear?"DOWN":"UP"),cx,cy+24,12,data.gear?"#ffbf7c":accent);
    }
    g.restore();
  }
  function draw(mode,aircraft,data) {
    if(!ctx||!overlay)return;
    const g=ctx, W=overlay.width,H=overlay.height;g.clearRect(0,0,W,H);
    if(mode!=="helmet"&&mode!=="cockpit")return;
    const p=profiles[aircraft]||profiles.F16,accent=p.accent,scale=Math.min(W/1366,H/768);
    g.save();
    if(mode==="helmet"){
      g.strokeStyle="rgba(165,237,197,.55)";g.lineWidth=4*scale;
      g.beginPath();g.ellipse(W/2,H*.53,W*.465,H*.47,0,Math.PI*.12,Math.PI*.88);g.stroke();
      g.beginPath();g.ellipse(W/2,H*.53,W*.465,H*.47,0,Math.PI*1.12,Math.PI*1.88);g.stroke();
      text(g,"HMD · "+p.name,W*.5,H*.075,14*scale,accent);
      text(g,fmt(data.kt)+" KT",W*.19,H*.5,15*scale,accent);
      text(g,fmt(data.alt)+" FT",W*.82,H*.5,15*scale,accent);
      text(g,"HDG "+fmt(data.hdg)+"°",W*.5,H*.16,15*scale,accent);
      text(g,"G "+fmt(data.nz,1)+"    M "+fmt(data.mach,2),W*.5,H*.81,14*scale,accent);
      text(g,"HEAD LOOK  I/J/K/L · CENTER O",W*.5,H*.90,11*scale,"#acd9bc");
    } else if(data.hasInterior){
      text(g,p.name+" · 3D COCKPIT",W*.5,H*.95,11*scale,accent);
    } else {
      // Approximate panel fallback when a real interior is unavailable.
      const deskTop=H*.72, deskBottom=H*1.12;
      g.fillStyle="#151b22";
      g.beginPath();g.moveTo(0,H);g.lineTo(0,deskTop+H*.06);g.lineTo(W*.16,deskTop);
      g.lineTo(W*.84,deskTop);g.lineTo(W,deskTop+H*.06);g.lineTo(W,H);g.closePath();g.fill();
      g.strokeStyle="#59656a";g.lineWidth=6*scale;
      poly(g,[[W*.08,H*.92],[W*.13,H*.43],[W*.26,H*.26]],"#65737b",5*scale);
      poly(g,[[W*.92,H*.92],[W*.87,H*.43],[W*.74,H*.26]],"#65737b",5*scale);
      const px=W*.22, total=W*.56, gap=13*scale,n=p.panels;
      const screenW=Math.min(205*scale,(total-gap*(n-1))/n),screenH=145*scale;
      const start=W/2-(screenW*n+gap*(n-1))/2;
      for(let i=0;i<n;i++)instrument(g,start+i*(screenW+gap),deskTop+18*scale,screenW,screenH,p.labels[i],i,data,accent);
      g.fillStyle="#262e36";g.fillRect(W*.45,deskTop-19*scale,W*.10,25*scale);
      text(g,p.title,W*.5,deskTop-2*scale,10*scale,accent);
      // HUD combiner frame ahead of the instrument panel.
      g.strokeStyle="rgba(121,202,167,.6)";g.lineWidth=4*scale;
      poly(g,[[W*.43,H*.70],[W*.43,H*.37],[W*.57,H*.37],[W*.57,H*.70]],"rgba(121,202,167,.5)",4*scale);
      text(g,p.name+" · SIMULATED PANEL",W*.5,H*.955,11*scale,"#8ea0a8");
    }
    g.restore();
  }
  return {attach,resize,draw,profiles,eyes,inspect,setView,cameraEye,diagnose};
})();