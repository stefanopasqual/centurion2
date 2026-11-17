/* CENTURION 2 | Zaporizhzhia-inspired nuclear power station.
 * Recognizable architectural illustration, NOT a survey/digital twin.
 * Only the six-unit silhouette and broad civilian industrial characteristics
 * are represented. Ancillary buildings, plant dimensions and arrangement
 * are invented. No security, access, technical system or vulnerability details.
 */
(() => {
  "use strict";
  if (window.CENTURION_PLANT) return;
  const T=window.THREE;
  if (!T) return;
  const P=Math.PI;
  const mat=(c,rough=.82,metal=.13,extra={})=>new T.MeshStandardMaterial({color:c,roughness:rough,metalness:metal,...extra});
  const concrete=mat(0xa0a4a0,.97,.025), grey=mat(0x646d72,.89,.10),
    dark=mat(0x3a484c,.9,.12), steel=mat(0x929b9d,.49,.49),
    rust=mat(0x9d5445,.84,.13), orange=mat(0xbf5a3e,.65,.28),
    roof=mat(0x64625c,.95,.05), pale=mat(0xb6b9ae,.85,.09),
    road=mat(0x444849,.98,.01), water=mat(0x335f69,.30,.25,{transparent:true,opacity:.9}),
    glass=mat(0x243e49,.31,.33);
  const bx=(x,y,z)=>new T.BoxGeometry(x,y,z);
  const rootObj=(group,geo,material,xyz,rot)=>{
    const o=new T.Mesh(geo,material);
    if(xyz)o.position.set(...xyz);
    if(rot)o.rotation.set(...rot);
    o.castShadow=true;o.receiveShadow=true;group.add(o);return o;
  };
  const box=(g,whd,pos,m,rot)=>rootObj(g,bx(...whd),m,pos,rot);
  const tube=(g,a,b,r,m)=>{
    const va=new T.Vector3(...a),vb=new T.Vector3(...b),v=vb.clone().sub(va);
    const mesh=rootObj(g,new T.CylinderGeometry(r,r,v.length(),8),m,va.clone().add(vb).multiplyScalar(.5).toArray());
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());
    return mesh;
  };
  function label(text){
    const cv=document.createElement("canvas");cv.width=768;cv.height=128;
    const ctx=cv.getContext("2d");
    if(ctx){
      ctx.fillStyle="rgba(11,29,37,.73)";ctx.fillRect(8,15,752,96);
      ctx.fillStyle="#e6f0eb";ctx.font="bold 36px system-ui";
      ctx.textAlign="center";ctx.fillText(text,384,76,720);
    }
    const tx=new T.CanvasTexture(cv),s=new T.Sprite(new T.SpriteMaterial({map:tx,transparent:true,depthWrite:false}));
    s.scale.set(290,48,1);return s;
  }
  function reactor(group,x,z,number,hi){
    const g=new T.Group();g.position.set(x,0,z);group.add(g);
    // Rectangular reinforced building topped by a terracotta-colored rounded
    // containment silhouette. Spatial arrangement is *illustrative*, not a plan.
    box(g,[53,30,55],[0,15,0],concrete);
    box(g,[56,2,58],[0,31,0],steel);
    const drum=rootObj(g,new T.CylinderGeometry(16.8,18.6,13,hi?32:18),pale,[0,39,0]);
    const cap=rootObj(g,new T.SphereGeometry(17.2,hi?32:18,hi?16:10,0,2*P,0,P/2),orange,[0,45.5,0]);
    cap.scale.set(1,.62,1);
    rootObj(g,new T.TorusGeometry(17.4,.32,6,hi?40:20),steel,[0,45.4,0],[P/2,0,0]);
    const hall=box(g,[88,23,39],[0,12,60],grey);
    box(g,[90,2,41],[0,24.0,60],roof);
    // Ribbing and roof lights are for visual readability, without reconstructing
    // actual infrastructure, pipes, or internal equipment.
    for(let k=-3;k<=3;k++){
      box(g,[.48,1.1,39],[k*11,24.8,60],pale);
      if(hi)box(g,[6,.14,13],[k*11,25.5,59],glass);
    }
    for(const side of [-1,1]){
      box(g,[1,11,40],[side*43.5,17,60],dark);
      for(let j=0;j<4;j++){
        box(g,[.12,4.5,1.5],[side*44.15,11.5+j*2.3,45+j*9],steel);
      }
    }
    if(hi){
      for(const xx of [-20,20])for(const zz of [-18,18]){
        box(g,[6,2,7],[xx,32.5,zz],roof);
      }
      box(g,[9,4,5],[17,28,-25],dark);
    }
    const numberLabel=label("UNITÀ "+number);
    numberLabel.scale.set(44,7,1);
    numberLabel.position.set(0,67,0);g.add(numberLabel);
    return g;
  }
  function transformerStyleYard(g,low){
    // Decorative power-grid silhouette only; no true connections or configuration.
    for(let j=0;j<4;j++){
      const x=-240+j*33;
      box(g,[19,.6,24],[x,.7,205],concrete);
      for(let i=0;i<(low?2:4);i++){
        rootObj(g,new T.CylinderGeometry(1.8,2.2,9,10),dark,[x+(i%2)*7-4,5,205+(i>1?8:-7)]);
      }
    }
  }
  function industrial(g,low){
    // Supporting buildings deliberately randomized and NOT site-accurate.
    const list=[
      [-330,118,43,30,78],[325,126,60,27,75],
      [-323,-130,58,22,69],[338,-134,45,29,73],
      [0,230,165,18,38],[145,226,78,16,47],
      [-146,226,78,16,47],[0,-167,105,15,43]
    ];
    for(let i=0;i<list.length;i++){
      const [x,z,w,h,d]=list[i];
      const m=i%3===0?grey:i%3===1?concrete:dark;
      box(g,[w,h,d],[x,h/2,z],m);
      box(g,[w+1,.65,d+1],[x,h+.3,z],roof);
      if(!low)for(let n=-2;n<=2;n++){
        box(g,[.16,h*.6,.15],[x+n*w*.14,h*.5,z+d*.501],steel);
        box(g,[Math.max(2,w*.08),.18,d*.45],[x+n*w*.14,h+.75,z],pale);
      }
    }
  }
  function makeScene(){
    const group=new T.Group();
    const mobile=innerWidth<760||((navigator.hardwareConcurrency||8)<=4);
    group.userData.description="Illustrative Zaporizhzhia-inspired 6-reactor exterior; no real security layout";
    // Ground pad & faint contact shadows.
    rootObj(group,new T.PlaneGeometry(900,720),road,[0,-.08,0],[-P/2,0,0]);
    rootObj(group,new T.PlaneGeometry(920,742),
      mat(0x132023,.99,.01,{transparent:true,opacity:.35}),[0,-.12,0],[-P/2,0,0]);
    // A broad stylized cooling-water waterway, not a measured canal.
    rootObj(group,new T.PlaneGeometry(950,75),water,[0,.06,-330],[-P/2,0,0]);
    rootObj(group,new T.PlaneGeometry(950,4),pale,[0,.07,-291],[-P/2,0,0]);
    rootObj(group,new T.PlaneGeometry(950,4),pale,[0,.07,-369],[-P/2,0,0]);

    // Six reactor structures form the unmistakable visual silhouette.
    // Orientation and spacing are intentionally illustrative.
    for(let i=0;i<6;i++){
      reactor(group,(i-2.5)*119,-115,i+1,!mobile);
      const x=(i-2.5)*119;
      rootObj(group,new T.PlaneGeometry(64,85),
        mat(0x101719,.8,.01,{transparent:true,opacity:.14}),
        [x,.005,-68],[-P/2,0,0]);
    }
    industrial(group,mobile);
    transformerStyleYard(group,mobile);
    // Simplified service lanes, exterior crane and a few generic exhaust towers.
    for(const zz of [-258,35,172]){
      rootObj(group,new T.PlaneGeometry(825,8),concrete,[0,.09,zz],[-P/2,0,0]);
    }
    for(const xx of [-390,390]){
      rootObj(group,new T.PlaneGeometry(5,595),concrete,[xx,.11,-1],[-P/2,0,0]);
    }
    for(const [x,z] of [[-337,105],[330,104]]){
      rootObj(group,new T.CylinderGeometry(3.2,4.8,63,15),grey,[x,31.5,z]);
      rootObj(group,new T.CylinderGeometry(3.0,3.0,6,15),steel,[x,65.5,z]);
      if(!mobile){
        for(let n=0;n<8;n++)box(group,[.25,.6,3],[x,7+n*7.5,z-3.5],dark);
      }
    }
    const banner=label("ZAPORIŽŽJA · CENTRALE NUCLEARE");
    banner.position.set(0,155,270);banner.scale.set(410,66,1);group.add(banner);
    const note=label("RICOSTRUZIONE ILLUSTRATIVA · NON OPERATIVA");
    note.position.set(0,127,270);note.scale.set(385,55,1);group.add(note);
    group.rotation.y=-.24; // cinematic orientation, NOT actual survey alignment
    return group;
  }
  window.CENTURION_PLANT=Object.freeze({create:makeScene,version:"1",illustrative:true});
})();