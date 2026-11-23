/*
 * CENTURION2 - Eurofighter 51° Stormo "Gatti Neri", Istrana
 * Visual livery overlays for the licensed original GLB (hangar only).
 * Non-destructive: no source meshes or source textures are modified.
 *
 * Reference aircraft: MM7316 / 51-01, 132° Gruppo, 51° Stormo.
 * The black-cat drawing is an original simplified interpretation,
 * not an official vector insignia.
 */
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
    c.lineTo(146,146); c.lineTo(158,204); c.closePath(); c.fill();
    // Tail curled upwards with a broad rounded end.
    c.beginPath(); c.moveTo(333,286);
    c.bezierCurveTo(428,291,433,218,405,174);
    c.bezierCurveTo(381,134,337,154,341,181);
    c.lineWidth=26; c.lineCap='round'; c.strokeStyle='#20282d'; c.stroke();
    // Forelegs / hindlegs.
    c.beginPath(); c.moveTo(152,324); c.lineTo(87,396); c.lineTo(103,414);
    c.lineTo(205,359); c.lineTo(297,341); c.lineTo(359,409);
    c.lineTo(387,391); c.lineTo(344,304); c.closePath(); c.fill();
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

// Replace original baked German color markings, not merely cover them.
function replaceOriginalSkin(THREE, aircraft) {
  const memo = new Map();
  let changed = 0;
  const preserve = /glass|canopy|cockpit|windscreen|window|interior|seat|pilot|engine|exhaust|nozzle|turbine|wheel|tire|tyre|gear|rubber|brake|metal|chrome|light|intake/i;
  aircraft.traverse(object => {
    if (!object.isMesh || !object.material) return;
    const transformMaterial = m => {
      if (!m || !('color' in m)) return m;
      const name = (object.name || '') + ' ' + (m.name || '');
      if (preserve.test(name) || m.transparent || m.opacity < 0.96) return m;
      if (memo.has(m)) return memo.get(m);
      const clone = m.clone();
      // The source German colors and crosses are baked into base-color maps.
      // Do not modify normal, metallic, roughness, or geometry detail maps.
      clone.map = null;
      clone.color = new THREE.Color('#8d9da9');
      clone.metalness = Math.min(Number(clone.metalness) || 0, 0.25);
      clone.roughness = Math.max(Number(clone.roughness) || 0.6, 0.65);
      clone.needsUpdate = true;
      memo.set(m, clone);
      changed++;
      return clone;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(transformMaterial) : transformMaterial(object.material);
  });
  return changed;
}

export function apply51Stormo(THREE, scene, aircraft) {
  const neutralizedMaterials = replaceOriginalSkin(THREE, aircraft);
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
  function decal(hit,key,w,h,placement) {
    // Surface-mounted planar insignia. The previous DecalGeometry projection
    // clipped every marking on parts of the imported Typhoon mesh.
    // PlaneGeometry follows the hit surface normal and is drawn just above it.
    let point, normal;
    if (hit) {
      normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
      point=hit.point.clone();
    } else if (placement) {
      point=placement.point.clone();
      normal=placement.normal.clone();
    } else return false;
    if(normal.lengthSq()<0.5) return false;
    const orientation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), normal);
    // The side markers must be upright in world-space, not aligned at an
    // arbitrary rotation of the target mesh normal.
    if(Math.abs(normal.y)<0.65) {
      const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),normal).normalize();
      const up=new THREE.Vector3().crossVectors(normal,right).normalize();
      const rotation=new THREE.Matrix4().makeBasis(right,up,normal);
      orientation.setFromRotationMatrix(rotation);
    }
    const geom=new THREE.PlaneGeometry(w,h);
    const d=new THREE.Mesh(geom,material[key]);
    d.position.copy(point).addScaledVector(normal,Math.max(.025,size.x*.002));
    d.quaternion.copy(orientation);
    d.renderOrder=20;
    d.name='CENTURION2_51Stormo_'+key;
    scene.add(d); nodes.push(d);
    return true;
  }
  const sideFallback=(fx,fy,side)=>({
    point:new THREE.Vector3(min.x+size.x*fx,min.y+size.y*fy,side>0?box.max.z+0.015:box.min.z-0.015),
    normal:new THREE.Vector3(0,0,side)
  });
  const topFallback=(fx,depth)=>({
    point:new THREE.Vector3(min.x+size.x*fx,box.max.y+.015,min.z+size.z*depth),
    normal:new THREE.Vector3(0,1,0)
  });
  const L=size.x;const W=size.z;const H=size.y;
  // Italian AF roundel and 51-01 fuselage codes, both port and starboard.
  for(const side of [-1,1]){
    decal(locate(.70,.42,side), 'roundel',L*.055,L*.055,sideFallback(.70,.42,side));
    decal(locate(.54,.42,side), 'code',L*.17,H*.18,sideFallback(.54,.42,side));
    // Gatti Neri insignia on both vertical-stabilizer faces.
    decal(locate(.17,.75,side), 'cat',L*.105,H*.26,sideFallback(.17,.75,side));
    decal(locate(.27,.73,side), 'unit',L*.085,H*.16,sideFallback(.27,.73,side));
    // Roundels on wing upper surfaces (approximate positions).
    decal(locate(.46,.5,side*.28,true),'roundel',L*.058,L*.058,topFallback(.46,.5+side*.22));
  }
  return {
    applied:nodes.length,
    neutralizedMaterials,
    dispose() {
      nodes.forEach(o=>{scene.remove(o);o.geometry.dispose();});
      resources.forEach(o=>o.dispose());
    }
  };
}

// Eurofighter dell'hangar senza livrea di reparto: niente insegne né codici, solo vernice.
// La texture del modello è già ripulita dalle insegne tedesche: resta (pannelli, scritte tecniche)
// e viene scurita al grigio Eurofighter usato anche in volo; il tettuccio diventa vetro scuro.
export function verniceTyphoon(THREE, aircraft) {
  const memo = new Map();
  let changed = 0;
  aircraft.traverse(object => {
    if (!object.isMesh || !object.material) return;
    const tratta = m => {
      if (!m || !('color' in m)) return m;
      if (memo.has(m)) return memo.get(m);
      const name = (object.name || '') + ' ' + (m.name || '');
      let c = null;
      if (/glass|canopy|windscreen/i.test(name)) {
        if (m.map) return m;
        c = m.clone(); c.color = new THREE.Color('#1d2a33'); c.metalness = 0.1; c.roughness = 0.15;
      } else if (/airframe|fuselage|body|skin/i.test(name)) {
        c = m.clone();
        if (c.map) c.color = new THREE.Color().setRGB(0.6, 0.63, 0.68);
        else {
          c.color = new THREE.Color('#626c75');
          if (!c.metalnessMap) c.metalness = 0.2;
          if (!c.roughnessMap) c.roughness = 0.6;
        }
      } else return m;
      c.needsUpdate = true; memo.set(m, c); changed++;
      return c;
    };
    object.material = Array.isArray(object.material) ? object.material.map(tratta) : tratta(object.material);
  });
  return changed;
}
