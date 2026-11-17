/* CENTURION 2 - cinematic procedural assets.
 * Original fictional unarmed drones and airbase scenery, no external asset/license dependency.
 * Units: metres, forward +Z, up +Y. Fast mobile LOD.
 */
(() => {
  'use strict';
  if (window.CENTURION_REALISM) return;
  const T=window.THREE, PI=Math.PI;
  if(!T)return;
  const M=(c,rough=.7,metal=.12,extra={})=>new T.MeshStandardMaterial({color:c,roughness:rough,metalness:metal,...extra});
  const dark=M(0x212c32,.75,.28), rubber=M(0x161a1d,.95,.06),
    metal=M(0x697d87,.43,.68), paint=M(0x859397,.61,.24),
    panel=M(0x51636d,.75,.2), glass=M(0x0c202c,.12,.21,{transparent:true,opacity:.91}),
    white=M(0xd4ddd9,.47,.11), black=M(0x080d12,.4,.15);
  const geoBox=(x,y,z)=>new T.BoxGeometry(x,y,z);
  const capsule=(r,len)=>T.CapsuleGeometry?new T.CapsuleGeometry(r,len,4,7):new T.CylinderGeometry(r,r,len+2*r,10);
  function obj(g,geo,material,pos,rot,scale){
    const o=new T.Mesh(geo,material);
    if(pos)o.position.set(...pos);
    if(rot)o.rotation.set(...rot);
    if(scale)o.scale.set(...scale);
    o.castShadow=true; o.receiveShadow=true;g.add(o);return o;
  }
  function sph(g,m,pos,scale,seg=18){
    return obj(g,new T.SphereGeometry(1,seg,Math.max(8,seg>>1)),m,pos,null,scale);
  }
  function rod(g,a,b,r,m){
    const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va);
    const mesh=obj(g,new T.CylinderGeometry(r*.9,r,d.length(),9),m,va.clone().add(vb).multiplyScalar(.5).toArray());
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return mesh;
  }
  function airfoil(g,side,paintMat,lo){
    // Tapered, swept, mildly cambered continuous wing: positions in metres.
    const sections=[
      {x:.32,z0:1.03,z1:-.78,t:.105},
      {x:1.1,z0:.88,z1:-.74,t:.095},
      {x:2.8,z0:.61,z1:-.56,t:.065},
      {x:4.25,z0:.38,z1:-.37,t:.028}
    ];
    const pts=[0,.12,.32,.58,.84,1],vertices=[],indices=[];
    for(const q of sections){
      for(let surface=0;surface<2;surface++){
        for(const u of pts){
          const chord=q.z0*(1-u)+q.z1*u;
          const thick=Math.sin(Math.PI*u)*q.t*(surface===0?1:-.65);
          vertices.push(side*q.x, .06+thick, chord);
        }
      }
    }
    const n=pts.length*2;
    for(let j=0;j<sections.length-1;j++)
      for(let k=0;k<pts.length-1;k++)
        for(const offset of [0,pts.length]){
          const a=j*n+offset+k,b=(j+1)*n+offset+k;
          if(side===1){indices.push(a,b,a+1,b,b+1,a+1);}
          else {indices.push(a,a+1,b,b,a+1,b+1);}
        }
    for(let j=0;j<sections.length-1;j++){
      for(const e of [0,pts.length-1]){
        const a=j*n+e,b=(j+1)*n+e,aa=a+pts.length,bb=b+pts.length;
        indices.push(a,aa,b,b,aa,bb);
      }
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geo.setIndex(indices);geo.computeVertexNormals();
    const m=obj(g,geo,paintMat);
    m.material.side=T.DoubleSide;
    const tip=obj(g,geoBox(.16,.06,.56),panel,[side*4.15,.063,.0]);
    tip.rotation.y=side*.04;
    // Aileron and servo housings provide a believable mechanical silhouette.
    obj(g,geoBox(1.35,.034,.18),panel,[side*3.1,.044,-.51],[0,-side*.16,0]);
    if(!lo){
      for(const x of [1.3,2.05,2.8,3.55]){
        obj(g,geoBox(.018,.012,.54),metal,[side*x,.132,-.02],[0,0,0]);
      }
    }
    return m;
  }
  function gimbal(g,at,quality){
    const pivot=new T.Group();pivot.position.set(...at);g.add(pivot);
    const collar=obj(pivot,new T.CylinderGeometry(.24,.27,.24,12),metal,[0,.14,0]);
    const ball=sph(pivot,panel,[0,-.12,.04],[.31,.28,.31],quality?20:12);
    const lens=sph(pivot,glass,[0,-.12,.30],[.17,.14,.06],quality?18:12);
    sph(pivot,black,[0,-.12,.345],[.073,.075,.019],12);
    const hoop=obj(pivot,new T.TorusGeometry(.20,.018,7,22),metal,[0,-.12,.31]);
    return pivot;
  }
  function lights(g,span){
    const left=obj(g,new T.SphereGeometry(.055,8,6),new T.MeshBasicMaterial({color:0xff3832}),[-span,.09,.02]);
    const right=obj(g,new T.SphereGeometry(.055,8,6),new T.MeshBasicMaterial({color:0x54ff76}),[span,.09,.02]);
    return [left,right];
  }
  function fixedUav(low){
    const g=new T.Group(), detail=!low, control={};
    // Medium endurance civilian-style fictional UAV: composite skin and tapered wings.
    sph(g,paint,[0,.02,.08],[.47,.44,2.20],detail?28:18);
    sph(g,white,[0,-.03,1.75],[.37,.33,.57],detail?24:14);
    sph(g,panel,[0,.28,-.2],[.36,.15,1.25]);
    sph(g,glass,[0,.08,1.96],[.12,.09,.30],detail?16:10);
    airfoil(g,1,paint,low);airfoil(g,-1,paint,low);
    // Twin booms / high stabilizer / vertical fins.
    for(const side of [-1,1]){
      rod(g,[side*1.05,-.035,-.25],[side*1.13,.03,-3.0],.084,paint);
      obj(g,geoBox(.10,.65,.45),panel,[side*1.14,.32,-2.78],[0,0,side*.04]);
      obj(g,geoBox(.58,.046,.23),paint,[side*1.15,.58,-3.1]);
      obj(g,geoBox(.26,.04,.7),panel,[side*.43,-.1,-2.89]);
    }
    obj(g,geoBox(2.28,.06,.36),paint,[0,.57,-3.04]);
    const bearing=obj(g,new T.CylinderGeometry(.21,.21,.34,16),metal,[0,.03,-2.16],[PI/2,0,0]);
    const prop=new T.Group();prop.position.set(0,.03,-2.40);g.add(prop);
    obj(prop,new T.CylinderGeometry(.12,.16,.11,14),metal,[0,0,-.04],[PI/2,0,0]);
    for(let i=0;i<3;i++){
      const blade=obj(prop,geoBox(.105,1.11,.022),black,[0,.56,0],[0,0,i*2*PI/3]);
      // Pivot blades about the propulsion axis without forcing per-frame allocations.
      blade.position.applyAxisAngle(new T.Vector3(0,0,1),i*2*PI/3);
    }
    obj(g,geoBox(.18,.07,.5),panel,[0,.45,1.2]);
    rod(g,[0,.43,1.33],[0,.68,1.63],.023,metal);
    const sensor=gimbal(g,[0,-.52,.70],detail);
    const nav=lights(g,4.16);
    if(detail){
      for(const x of [-1,1]){
        obj(g,geoBox(.68,.019,.055),white,[x*2.97,.145,.15]);
        // Panel access covers, small but readable up close.
        obj(g,geoBox(.65,.009,.45),panel,[x*1.06,.155,-.28]);
      }
      for(let z=-1.45;z<=1.3;z+=.44){
        const seam=obj(g,new T.TorusGeometry(.38,.005,4,32),metal,[0,.02,z],[PI/2,0,0],[1,.92,1]);
        seam.material.transparent=true;seam.material.opacity=.36;
      }
    }
    g.userData.kind='fixed-unarmed-surveillance';
    const animate=(dt,t)=>{
      prop.rotation.z+=Math.min(.05,dt)*65;
      sensor.rotation.y=Math.sin(t*.25)*.23;
      sensor.rotation.x=Math.sin(t*.33)*.13;
      nav[0].visible=Math.sin(t*6)>0;
      nav[1].visible=Math.sin(t*6)>0;
    };
    return {g,rotors:[],animate};
  }
  function quadUav(low){
    const g=new T.Group(), detail=!low, motors=[],nav=[];
    // Carbon-fibre quad, damping mount, camera pod, GPS mast and blade discs.
    sph(g,dark,[0,.07,0],[.55,.17,.78],detail?24:16);
    sph(g,paint,[0,.20,-.03],[.37,.12,.56]);
    obj(g,geoBox(.44,.12,.34),panel,[0,.0,.04]);
    for(const x of [-1,1])for(const z of [-1,1]){
      rod(g,[x*.23,.07,z*.20],[x*1.08,.15,z*1.03],.072,black);
      obj(g,new T.CylinderGeometry(.17,.19,.18,16),metal,[x*1.08,.18,z*1.03]);
      const rotor=new T.Group();rotor.position.set(x*1.08,.31,z*1.03);g.add(rotor);motors.push(rotor);
      obj(rotor,new T.CylinderGeometry(.095,.11,.09,10),dark,[0,0,0]);
      for(let i=0;i<2;i++)obj(rotor,geoBox(.95,.018,.12),black,[0,.06,0],[0,i*PI/2,0]);
      // Translucent rotor blur produces motion without hundreds of blades.
      const disc=obj(rotor,new T.CircleGeometry(.64,detail?30:18),
        new T.MeshBasicMaterial({color:0xa4b2b7,transparent:true,opacity:.12,
          depthWrite:false,side:T.DoubleSide}),[0,.05,0],[-PI/2,0,0]);
      nav.push(obj(g,new T.SphereGeometry(.045,8,6),
        new T.MeshBasicMaterial({color:z>0?0xb7f1ff:0xff4a40}),[x*1.08,.05,z*1.03]));
    }
    for(const side of [-1,1]){
      rod(g,[side*.33,-.02,-.34],[side*.52,-.49,-.57],.055,metal);
      rod(g,[side*.33,-.02,.42],[side*.52,-.49,.60],.055,metal);
      rod(g,[side*.52,-.49,-.78],[side*.52,-.49,.79],.045,metal);
    }
    const sensor=gimbal(g,[0,-.34,.53],detail);
    rod(g,[0,.2,-.12],[0,.53,-.1],.022,metal);
    obj(g,geoBox(.18,.035,.18),black,[0,.53,-.1]);
    if(detail){
      for(const side of [-1,1]){
        obj(g,geoBox(.07,.02,.18),metal,[side*.25,.3,.1]);
      }
      obj(g,geoBox(.21,.024,.28),white,[0,.34,.21]);
    }
    g.userData.kind='quad-unarmed-observation';
    const animate=(dt,t)=>{
      const step=Math.min(dt,.05);
      for(let i=0;i<motors.length;i++)motors[i].rotation.y+=(i%2?1:-1)*step*118;
      sensor.rotation.y=Math.sin(t*.38)*.24;
      sensor.rotation.x=Math.cos(t*.27)*.12;
      for(const l of nav) l.visible=Math.sin(t*7)>-.35;
    };
    return {g,rotors:[],animate};
  }
  function drone(quad){
    const low=innerWidth<720||((navigator.hardwareConcurrency||8)<=4);
    return quad?quadUav(low):fixedUav(low);
  }

  function asphaltTexture(){
    const c=document.createElement('canvas');c.width=c.height=256;
    const ctx=c.getContext('2d');if(!ctx)return null;
    ctx.fillStyle='#363e42';ctx.fillRect(0,0,256,256);
    // Deterministic grain; zero network requests and no large embedded texture.
    let seed=587142;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    for(let i=0;i<3200;i++){
      const v=Math.floor(45+rnd()*65);
      ctx.fillStyle='rgba('+v+','+(v+2)+','+(v+3)+','+(.06+rnd()*.25)+')';
      ctx.fillRect(rnd()*256,rnd()*256,1+rnd()*3,1+rnd()*3);
    }
    for(let x=0;x<256;x+=64){ctx.fillStyle='#2b3234';ctx.fillRect(x,0,1,256);}
    const tx=new T.CanvasTexture(c);
    tx.wrapS=tx.wrapT=T.RepeatWrapping;tx.repeat.set(1,5);
    if(T.sRGBEncoding!==undefined)tx.encoding=T.sRGBEncoding;
    return tx;
  }
  function human(group,x,z,vest,orientation){
    const g=new T.Group();g.position.set(x,0,z);g.rotation.y=orientation||0;group.add(g);
    const uniform=M(vest,.85,.05), skin=M(0x97836d,.88,.02);
    const torso=obj(g,capsule(.24,.52),uniform,[0,1.25,0]);
    sph(g,skin,[0,1.96,0],[.17,.20,.17],10);
    obj(g,new T.CylinderGeometry(.19,.21,.13,10),white,[0,2.13,0]);
    const arm=[];
    for(const side of [-1,1]){
      const a=new T.Group();a.position.set(side*.28,1.57,0);g.add(a);arm.push(a);
      obj(a,capsule(.075,.44),uniform,[side*.05,-.34,.05],[0,0,side*.08]);
      rod(g,[side*.12,.87,0],[side*.16,.12,.09],.115,dark);
    }
    return {g,arm};
  }
  function truck(g,x,z){
    const v=new T.Group();v.position.set(x,0,z);g.add(v);
    obj(v,geoBox(3.4,.83,5.6),M(0x596e71,.82,.08),[0,.92,0]);
    obj(v,geoBox(3.0,.97,1.9),paint,[0,1.81,1.38]);
    obj(v,geoBox(2.6,.5,.035),glass,[0,1.99,2.36]);
    for(const side of [-1,1])for(const z0 of [-1.8,1.75]){
      obj(v,new T.CylinderGeometry(.46,.46,.22,12),rubber,[side*1.61,.49,z0],[0,0,PI/2]);
      obj(v,new T.CylinderGeometry(.17,.17,.23,12),metal,[side*1.68,.49,z0],[0,0,PI/2]);
    }
    const lamp=new T.MeshBasicMaterial({color:0xffecaf});
    for(const side of [-1,1])obj(v,geoBox(.33,.18,.08),lamp,[side*1.05,1.13,2.86]);
    return v;
  }
  function hangar(g,x,z,material){
    const h=new T.Group();h.position.set(x,0,z);g.add(h);
    obj(h,geoBox(36,9,34),material,[0,5,0]);
    obj(h,geoBox(38,.65,36),metal,[0,9.7,0]);
    obj(h,geoBox(24,7,.10),black,[0,3.65,17.09]);
    for(const side of [-1,1])obj(h,geoBox(5.9,7,.14),panel,[side*15.25,3.65,17.18]);
    const rib=M(0x77888b,.74,.2);
    for(let i=-16;i<=16;i+=2.5)obj(h,geoBox(.075,8,.09),rib,[i,4.6,17.25]);
    obj(h,geoBox(5.3,1.0,.16),white,[0,8.1,17.22]);
    return h;
  }
  function stage(root,plane){
    const d=new T.Group();root.add(d);
    const low=innerWidth<720;
    const tex=asphaltTexture();
    const tar=M(tex?0xffffff:0x384044,.94,.03,tex?{map:tex}:{}),stripe=M(0xd6d4bb,.88,.04),
      yellow=M(0xd4b544,.8,.04),concrete=M(0x596366,.95,.025),
      hazard=M(0xe3a248,.8,.04);
    const ground=obj(d,new T.PlaneGeometry(140,460),concrete,[0,-.012,-30],[-PI/2,0,0]);
    const asphalt=obj(d,new T.PlaneGeometry(42,440),tar,[0,.013,-10],[-PI/2,0,0]);
    const taxi=obj(d,new T.PlaneGeometry(30,220),tar,[40,.018,-113],[-PI/2,0,0]);
    for(let n=-9;n<=9;n++){
      const z=n*21;
      obj(d,geoBox(.28,.015,7),stripe,[0,.04,z]);
    }
    // Runway threshold and white side bars, blue taxiway lamps and sun-faded markings.
    for(let side of [-1,1]){
      obj(d,geoBox(.27,.015,435),white,[side*20,.04,-10]);
      for(let j=-8;j<=8;j++){
        const z=j*24;
        obj(d,new T.SphereGeometry(.18,8,5),
          new T.MeshBasicMaterial({color:0xd3e6ff}),[side*20.6,.19,z]);
      }
      for(let j=0;j<6;j++)obj(d,geoBox(2.25,.014,8.5),stripe,[side*(4.0+j*2.8),.045,-183]);
    }
    obj(d,geoBox(.22,.016,160),yellow,[38,.052,-116]);
    const yellowMark=yellow;
    for(let j=0;j<6;j++)obj(d,geoBox(.3,.02,2),yellowMark,[39,.054,-203+j*20]);
    hangar(d,49,-167,M(0x626e77,.82,.12));
    hangar(d,-63,-173,M(0x434e59,.9,.06));
    // Perimeter tower and antenna: no concrete locations or real installations represented.
    const tower=new T.Group();tower.position.set(-78,0,-115);d.add(tower);
    for(let side of [-1,1])for(let s2 of [-1,1])
      rod(tower,[side*2.0,0,s2*2],[side*1.0,15,s2*1.0],.11,metal);
    obj(tower,geoBox(8,2.2,8),glass,[0,16,0]);
    obj(tower,geoBox(9,.45,9),panel,[0,17.2,0]);
    rod(tower,[0,17.5,0],[0,23.0,0],.06,metal);
    const tug=truck(d,29,-139);
    const crew=[
      human(d,14,-138,0xd1a137,-PI/2),
      human(d,11,-142,0xc4b445,-PI/2),
      human(d,29,-150,0xc98a36,.4)
    ];
    // Safety cones and jet intake covers on the apron.
    for(const [x,z] of [[8,-140],[8,-154],[19,-145],[19,-158]]){
      obj(d,new T.ConeGeometry(.35,.85,10),hazard,[x,.43,z]);
      obj(d,geoBox(.75,.07,.75),rubber,[x,.03,z]);
    }
    const smoke=[],smokeMaterial=new T.SpriteMaterial({
      color:0xb1b0ac,transparent:true,opacity:.13,depthWrite:false
    });
    for(let i=0;i<(low?7:14);i++){
      const q=new T.Sprite(smokeMaterial.clone());q.visible=false;root.add(q);smoke.push(q);
    }
    const exhaust=new T.Group();plane.add(exhaust);
    const jetMat=new T.MeshBasicMaterial({
      color:0xffb56b,transparent:true,opacity:.55,depthWrite:false,
      blending:T.AdditiveBlending,side:T.DoubleSide
    });
    const heatMat=new T.MeshBasicMaterial({
      color:0x9abacc,transparent:true,opacity:.09,depthWrite:false,side:T.DoubleSide
    });
    for(const side of [-1,1]){
      const jet=obj(exhaust,new T.ConeGeometry(.35,4.2,12,1,true),jetMat,[side*.72,.0,-7.1],[PI/2,0,0]);
      jet.scale.set(.8,.9,.8);
      obj(exhaust,new T.ConeGeometry(.7,7,12,1,true),heatMat,[side*.72,0,-8.2],[PI/2,0,0]);
    }
    const navMatL=new T.MeshBasicMaterial({color:0xe34441}),navMatR=new T.MeshBasicMaterial({color:0x58f0a5});
    const navL=obj(plane,new T.SphereGeometry(.15,8,5),navMatL,[-6,0,.3]);
    const navR=obj(plane,new T.SphereGeometry(.15,8,5),navMatR,[6,0,.3]);
    const contact=new T.Mesh(new T.PlaneGeometry(18,8),new T.MeshBasicMaterial({
      color:0x0e1011,transparent:true,opacity:.16,depthWrite:false
    }));
    contact.rotation.x=-PI/2;contact.position.set(0,.06,-155);root.add(contact);
    const tick=(t,dt,p)=>{
      const active=t>=2.0;
      const n=Math.min(1,Math.max(0,(t-2)/1.2));
      const move=Math.max(0,Math.min(1,(t-4)/5));
      tug.position.z=-139+move*3;
      crew[0].arm[0].rotation.z=t<4?Math.sin(t*5)*.55:-.3;
      crew[0].arm[1].rotation.z=t<4?Math.sin(t*5+PI)*.55:.3;
      for(let i=0;i<crew.length;i++){
        const c=crew[i];
        c.g.position.x+=(i%2?-.58:.65)*Math.min(dt,.06)*(t>3?1:0);
        c.g.rotation.y+=dt*(t>4?.11:0);
      }
      exhaust.visible=active&&t<12.8;
      exhaust.scale.z=.6+n*.6+Math.sin(t*38)*.08;
      jetMat.opacity=active?.26+n*.45:0;
      navL.visible=navR.visible=Math.sin(t*7)>-.35;
      const z=p.position.z;
      contact.position.z=z;
      contact.material.opacity=Math.max(0,.22-Math.max(0,p.position.y-3)*.012);
      for(let i=0;i<smoke.length;i++){
        const q=smoke[i],age=(t*2.0+i*.41)%2.9;
        q.visible=t>3.7&&t<12.5;
        q.position.set(Math.sin(i*3.1)*1.8, .75+age*.45,
          z-8-age*(4+(t>8?9:2)));
        q.scale.setScalar(1.3+age*2.7);
        q.material.opacity=(1-age/2.9)*.14;
      }
    };
    const dispose=()=>{
      for(const sp of smoke){root.remove(sp);sp.material.dispose();}
      root.remove(contact);contact.geometry.dispose();contact.material.dispose();
      d.traverse(o=>{if(o.geometry)o.geometry.dispose();
        if(o.material){const materials=Array.isArray(o.material)?o.material:[o.material];
          for(const m of materials){if(m!==paint&&m!==dark&&m!==rubber&&m!==metal&&m!==white&&m!==black&&m!==glass&&m!==panel){m.dispose();}}}});
      if(tex)tex.dispose();plane.remove(exhaust);
      for(const child of [navL,navR]){plane.remove(child);child.geometry.dispose();child.material.dispose();}
      exhaust.traverse(o=>{if(o.geometry)o.geometry.dispose();});
      jetMat.dispose();heatMat.dispose();root.remove(d);
    };
    return {tick,dispose};
  }

  window.CENTURION_REALISM=Object.freeze({version:'20',drone,stage});
})();
