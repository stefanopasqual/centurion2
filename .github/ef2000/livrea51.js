/*
 * CENTURION2 - Eurofighter 51° Stormo "Gatti Neri", Istrana
 * Visual livery overlays for the licensed original GLB (hangar only).
 * Non-destructive: no source meshes or source textures are modified.
 *
 * Reference aircraft: MM7316 / 51-01, 132° Gruppo, 51° Stormo.
 * The black-cat drawing is an original simplified interpretation,
 * not an official vector insignia.
 */
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

function texture(THREE, painter, width = 512, height = 512) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  painter(ctx, width, height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function roundel(THREE) {
  return texture(THREE, (c, w, h) => {
    c.translate(w / 2, h / 2);
    c.fillStyle = '#a23b3c'; c.beginPath(); c.arc(0, 0, w * .43, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e9e9e5'; c.beginPath(); c.arc(0, 0, w * .32, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#18734d'; c.beginPath(); c.arc(0, 0, w * .19, 0, Math.PI * 2); c.fill();
  });
}

function airframeCode(THREE) {
  return texture(THREE, (c,w,h) => {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(39,52,60,.88)';
    c.font = '600 170px Arial, Helvetica, sans-serif';
    c.fillText('51-01', w/2, h*.53);
  }, 1024, 256);
}

function catInsignia(THREE) {
  return texture(THREE, (c,w,h) => {
    c.save(); c.translate(w*.08,h*.04); c.scale(w/512,h/512);
    // Original stylized leaping black cat, recognizable on either fin side.
    c.fillStyle = '#20282d';
    c.beginPath(); c.ellipse(230, 290, 123, 75, -.25, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(128, 236, 54, 0, Math.PI*2); c.fill();
    c.beginPath();
    c.moveTo(87,201); c.lineTo(95,148); c.lineTo(121,186);
    c.lineTo(146,146); c.lineTo(158,204); c.close(); c.fill();
    // Tail curled upwards with a broad rounded end.
    c.beginPath(); c.moveTo(333,286);
    c.bezierCurveTo(428,291,433,218,405,174);
    c.bezierCurveTo(381,134,337,154,341,181);
    c.lineWidth=26; c.lineCap='round'; c.strokeStyle='#20282d'; c.stroke();
    // Forelegs / hindlegs.
    c.beginPath(); c.moveTo(152,324); c.lineTo(87,396); c.lineTo(103,414);
    c.lineTo(205,359); c.lineTo(297,341); c.lineTo(359,409);
    c.lineTo(387,391); c.lineTo(344,304); c.close(); c.fill();
    // Green mice identify the Gatti Neri tradition (simplified artwork).
    c.fillStyle='#567c59';
    [[143,441],[239,451],[337,451]].forEach(([x,y])=>{
      c.beginPath(); c.ellipse(x,y,23,11,0,0,2*Math.PI); c.fill();
      c.beginPath(); c.arc(x-17,y-4,7,0,2*Math.PI); c.fill();
      c.strokeStyle='#567c59'; c.lineWidth=3; c.beginPath(); c.moveTo(x+20,y); c.quadraticCurveTo(x+43,y-17,x+49,y+6); c.stroke();
    });
    // Cat-eye detail.
    c.fillStyle='#d1d3b6'; c.beginPath(); c.arc(115,235,5,0,2*Math.PI); c.fill();
    c.restore();
  });
}

function verticalMark(THREE) {
  return texture(THREE, (c,w,h)=>{
    c.fillStyle='rgba(36,45,51,.92)';
    c.textAlign='center'; c.textBaseline='middle';
    c.font='700 120px Arial'; c.fillText('51°',w/2,h*.40);
    c.font='600 51px Arial'; c.fillText('STORMO',w/2,h*.68);
  },512,256);
}

export function apply51Stormo(THREE, scene, aircraft) {
  const nodes=[]; const resources=[];
  const box=new THREE.Box3().setFromObject(aircraft);
  const size=box.getSize(new THREE.Vector3());
  const min=box.min.clone();
  if(!size.x || !size.y || !size.z) return {applied:0,dispose(){}};
  scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  const meshes=[];
  aircraft.traverse(o=>{if(o.isMesh && o.geometry && o.visible) meshes.push(o);});
  if(!meshes.length)return {applied:0,dispose(){}};
  const t={roundel:roundel(THREE),code:airframeCode(THREE),cat:catInsignia(THREE),unit:verticalMark(THREE)};
  Object.values(t).forEach(x=>resources.push(x));
  const mat=(tex)=>new THREE.MeshBasicMaterial({
    map:tex,transparent:true,opacity:.96,side:THREE.DoubleSide,
    depthTest:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,
    polygonOffsetUnits:-4,toneMapped:false
  });
  const material={};
  Object.keys(t).forEach(k=>{material[k]=mat(t[k]);resources.push(material[k]);});
  // Mission export confirms the original Typhoon's longitudinal nose axis is +X.
  const locate=(fx,fy,side,above=false)=>{
    const xs=[fx,fx-.025,fx+.025,fx-.055,fx+.055], ys=[fy,fy-.045,fy+.045,fy-.085,fy+.085];
    for(const xf of xs)for(const yf of ys){
      const org=above ? new THREE.Vector3(min.x+size.x*xf,box.max.y+1,min.z+size.z*side)
        : new THREE.Vector3(min.x+size.x*xf,min.y+size.y*yf,side>0?box.max.z+1:box.min.z-1);
      const dir=above?new THREE.Vector3(0,-1,0):new THREE.Vector3(0,0,-side);
      ray.set(org,dir);ray.far=100;
      const hits=ray.intersectObjects(meshes,false);
      const hit=hits.find(h=>h.face && h.object && h.distance>0.001);
      if(hit)return hit;
    }
    return null;
  };
  function decal(hit,key,w,h) {
    if(!hit)return false;
    const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
    if(normal.lengthSq()<.5)return false;
    const vertical=new THREE.Vector3(0,1,0);
    if(Math.abs(normal.dot(vertical))>.90)vertical.set(1,0,0);
    const horizontal=new THREE.Vector3().crossVectors(vertical,normal).normalize();
    const up=new THREE.Vector3().crossVectors(normal,horizontal).normalize();
    const basis=new THREE.Matrix4().makeBasis(horizontal,up,normal);
    const euler=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(basis));
    const point=hit.point.clone().addScaledVector(normal,.008);
    const thick=Math.max(.12,Math.min(.65,w*.45));
    try{
      const geometry=new DecalGeometry(hit.object,point,euler,new THREE.Vector3(w,h,thick));
      if(!geometry.getAttribute('position') || geometry.getAttribute('position').count===0){
        geometry.dispose();return false;
      }
      const d=new THREE.Mesh(geometry,material[key]);d.renderOrder=5;
      d.name='CENTURION2_51Stormo_'+key;
      scene.add(d);nodes.push(d);
      return true;
    }catch(e){console.warn('CENTURION2 livery decal:',e);return false;}
  }
  const L=size.x;const W=size.z;const H=size.y;
  // Italian AF roundel and 51-01 fuselage codes, both port and starboard.
  for(const side of [-1,1]){
    decal(locate(.70,.42,side), 'roundel',L*.055,L*.055);
    decal(locate(.54,.42,side), 'code',L*.17,H*.18);
    // Gatti Neri insignia on both vertical-stabilizer faces.
    decal(locate(.17,.75,side), 'cat',L*.105,H*.26);
    decal(locate(.27,.73,side), 'unit',L*.085,H*.16);
    // Roundels on wing upper surfaces (approximate positions).
    decal(locate(.46,.5,side*.28,true),'roundel',L*.058,L*.058);
  }
  return {
    applied:nodes.length,
    dispose() {
      nodes.forEach(o=>{scene.remove(o);o.geometry.dispose();});
      resources.forEach(o=>o.dispose());
    }
  };
}
