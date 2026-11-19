/* CENTURION2 A380-800: shared lightweight 3D geometry for Hangar + Free Flight.
 * Original approximation; not an Airbus official CAD asset. Units: metres.
 * Local airframe: nose +Z, up +Y, wings +/-X.
 */
(function(root){
'use strict';
const SPEC=Object.freeze({id:'A380',name:'Airbus A380-800',length:72.7,span:79.8,height:24.1,wingArea:845,
  mtow:575000,engineCount:4,cruiseMach:.85});
function build(THREE,opts={}){
  const g=new THREE.Group();g.name='Airbus A380-800 · CENTURION SKY (fictional)';
  const mat=(c,metal=.12,rough=.73)=>new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough,side:THREE.DoubleSide});
  const white=mat(0xe9eef4,.28,.51),pale=mat(0xcbd6e1,.24,.55),blue=mat(0x15416c,.3,.53),
    navy=mat(0x13314d,.21,.53),silver=mat(0x87949d,.65,.4),black=mat(0x121c24,.06,.9),
    glass=mat(0x193b58,.1,.25),wheel=mat(0x14191d,.02,.97),red=mat(0xb94b58);
  const add=(name,geo,material,x=0,y=0,z=0,group=g)=>{
    const m=new THREE.Mesh(geo,material);m.name=name;m.position.set(x,y,z);group.add(m);return m;
  };
  function cylinder(name,r1,r2,len,material,x,y,z,axis='z',group=g){
    const m=add(name,new THREE.CylinderGeometry(r1,r2,len,12),material,x,y,z,group);
    if(axis==='z')m.rotation.x=Math.PI/2;
    return m;
  }
  function ellipticalFuselage(){
    // Double-decker broad upper fuselage, tapering nose/radome and aft tail cone.
    const sections=[
      [-36.35,.12,.16,0],[-34.9,.88,1.15,.2],[-31,2.3,2.85,.7],
      [-25,3.38,4.02,1.17],[-19,3.54,4.14,1.36],[-5,3.55,4.17,1.38],
      [12,3.55,4.17,1.38],[23.3,3.4,4.00,1.37],
      [27.3,2.9,3.36,1.16],[31.4,1.65,2.15,.72],[34.6,.55,.65,.18],[36.35,.02,.04,0]
    ];
    const segments=28,v=[],f=[];
    for(let k=0;k<sections.length;k++){
      const [z,rx,ry,cy]=sections[k];
      for(let i=0;i<segments;i++){
        const a=i*2*Math.PI/segments;
        const c=Math.cos(a),sn=Math.sin(a);
        v.push(rx*c,cy+ry*sn,z);
      }
    }
    for(let k=0;k<sections.length-1;k++)for(let i=0;i<segments;i++){
      const j=(i+1)%segments,a=k*segments+i,b=k*segments+j,c=(k+1)*segments+i,d=(k+1)*segments+j;
      f.push(a,b,c,b,d,c);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setIndex(f);geo.computeVertexNormals();
    add('Double deck 72.7 m fuselage',geo,white);
  }
  ellipticalFuselage();
  // Wide-body passenger cabin: upper + lower deck, 2 rows of windows each side.
  const frame=new THREE.SphereGeometry(.115,6,5);
  for(const side of [-1,1]){
    const n=112,windows=new THREE.InstancedMesh(frame,glass,n);
    windows.name='Upper and main deck passenger windows '+side;
    const tmp=new THREE.Object3D();let count=0;
    for(const y of [1.0,3.25])for(let i=0;i<56;i++){
      const z=-26+i*.95;if(z>27)continue;
      const taper=Math.abs(z)>22?Math.max(.70,1-(Math.abs(z)-22)*.018):1;
      const x=side*3.58*taper;
      tmp.position.set(x,y,z);tmp.scale.set(1,.57,1);tmp.updateMatrix();
      windows.setMatrixAt(count++,tmp.matrix);
    }
    windows.count=count;windows.instanceMatrix.needsUpdate=true;g.add(windows);
    for(const z of [-24,-12,10,25]){
      const d=add('Passenger door '+side+' '+z,new THREE.BoxGeometry(.05,1.85,.68),pale,side*3.53,1.9,z);
      d.rotation.y=side*.01;
    }
  }
  // Four flight-deck windscreens.
  for(const side of [-1,1]){
    const windshield=add('Flight deck window '+side,new THREE.BoxGeometry(1.7,.70,.12),glass,side*.98,3.40,31.9);
    windshield.rotation.y=side*-.23;windshield.rotation.x=.18;
  }
  function wing(side){
    const shape=new THREE.Shape();
    const coordinates=[
      [2.8,11.3],[8,9.3],[16,4.1],[28,-4.1],[39.9,-10.5],
      [39.9,-13.8],[35,-14.6],[25,-14.8],[16,-14.1],[2.8,-13.3]
    ];
    shape.moveTo(...coordinates[0]);coordinates.slice(1).forEach(([x,z])=>shape.lineTo(x,z));shape.closePath();
    const geom=new THREE.ExtrudeGeometry(shape,{depth:.46,bevelEnabled:false,steps:1});
    geom.rotateX(Math.PI/2);
    if(side<0)geom.scale(-1,1,1);
    const mesh=add('Main wing '+side,geom,white,0,-.55,0);
    mesh.rotation.z=side*.045;
    const flap=add('Double-slotted flap fairing '+side,new THREE.BoxGeometry(17,.26,1.1),pale,side*16.8,-.70,-13.5);
    flap.rotation.y=side*.08;
    const winglet=add('Wingtip fence '+side,new THREE.BoxGeometry(.22,3.6,1.3),blue,side*39.4,2.2,-12.0);
    winglet.rotation.z=-side*.08;
    add('Landing light '+side,new THREE.SphereGeometry(.35,8,6),pale,side*4.2,-.4,10.2);
  }
  wing(-1);wing(1);
  for(const side of [-1,1]){
    // Four-engine A380 geometry, 2 nacelles per wing.
    for(const [i,x,z] of [[0,14.9,1.4],[1,26.0,-5.6]]){
      const sx=side*x;
      const nacelle=add('Trent-900 style engine '+side+' '+i,
        new THREE.CylinderGeometry(2.05,1.62,5.1,20,1),pale,sx,-3.20,z);
      nacelle.rotation.x=Math.PI/2;
      cylinder('Fan intake '+side+' '+i,1.58,1.58,.09,black,sx,-3.20,z+2.62);
      cylinder('Fan disc '+side+' '+i,1.22,1.22,.10,silver,sx,-3.20,z+2.67);
      const spinner=add('Spinner '+side+' '+i,new THREE.ConeGeometry(.38,1.08,12),silver,sx,-3.20,z+2.85);
      spinner.rotation.x=Math.PI/2;
      cylinder('Exhaust nozzle '+side+' '+i,1.19,1.36,.24,navy,sx,-3.20,z-2.55);
      add('Engine pylon '+side+' '+i,new THREE.BoxGeometry(.75,1.5,2.3),pale,sx,-1.1,z);
    }
    const tailShape=new THREE.Shape();
    const coords=[[0,-33],[3,-31.5],[13.2,-35.0],[16.7,-36.1],[16.7,-37],[3,-36.8]];
    tailShape.moveTo(...coords[0]);coords.slice(1).forEach(p=>tailShape.lineTo(...p));tailShape.closePath();
    const tailGeo=new THREE.ExtrudeGeometry(tailShape,{depth:.27,bevelEnabled:false});tailGeo.rotateX(Math.PI/2);
    if(side<0)tailGeo.scale(-1,1,1);
    add('Horizontal stabilizer '+side,tailGeo,pale,0,1.8,0);
  }
  const finGeo=new THREE.BufferGeometry();
  const fpos=[0,3.5,-31,0,20,-36,0,20,-37,0,3.5,-37.5, .22,3.5,-31,.22,20,-36,.22,20,-37,.22,3.5,-37.5];
  const fi=[0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,2,6,7,2,7,3];
  finGeo.setAttribute('position',new THREE.Float32BufferAttribute(fpos,3));finGeo.setIndex(fi);finGeo.computeVertexNormals();
  add('Large A380 fin',finGeo,blue);
  add('Rudder trim',new THREE.BoxGeometry(.08,12.3,.48),navy,.2,11.2,-36.9);
  // Fictional branding (not an actual airline or Airbus trademark livery).
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');
  ctx.fillStyle='#15416c';ctx.font='bold 52px Arial';ctx.textAlign='center';ctx.fillText('CENTURION SKY',256,81);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  const signMat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  for(const side of [-1,1]){
    const mark=add('Operator fuselage title '+side,new THREE.PlaneGeometry(13.5,3.0),signMat,side*3.64,2.35,5.2);
    mark.rotation.y=side*Math.PI/2;
  }
  // Distinctive A380 multi-bogie retractable main gear; 22 tyres simplified.
  const gear=new THREE.Group();gear.name='Retractable A380 landing gear';g.add(gear);
  const axle=(x,y,z,qty,spread)=>{
    const stem=add('Gear strut',new THREE.CylinderGeometry(.23,.31,5.2,8),silver,x,y+2,z,'',gear);
    for(let k=0;k<qty;k++){
      const wz=z+(k-(qty-1)/2)*spread;
      const tyre=add('Tyre',new THREE.CylinderGeometry(.82,.82,.47,10),wheel,x,y,wz,gear);
      tyre.rotation.z=Math.PI/2;
      add('Wheel hub',new THREE.CylinderGeometry(.30,.30,.5,10),silver,x,y,wz,gear).rotation.z=Math.PI/2;
    }
  };
  axle(0,-6.7,28,2,1.8);
  for(const side of [-1,1]){axle(side*7.2,-6.7,-8,4,2.0);axle(side*3.6,-6.7,-17.5,6,1.55);}
  // Rear altitude tail extends to approx 24.1 m from wheels to fin.
  g.userData.gear=gear;
  g.userData.setGear=down=>{gear.visible=!!down;};
  g.userData.dimensions=SPEC;
  g.userData.anim=()=>{};
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return g;
}
root.CENTURION_A380=Object.freeze({spec:SPEC,create:build});
})(typeof window!=='undefined'?window:globalThis);
