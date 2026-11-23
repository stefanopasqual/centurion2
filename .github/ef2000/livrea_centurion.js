/*
 * CENTURION2 - Livrea CENTURION (reparto)
 * Low-visibility tactical-grey livery with the Spartan-helmet emblem,
 * tail code and nose modex, for every fixed-wing airframe (helicopters
 * excluded). Non-destructive overlay: no source mesh or texture is
 * modified; everything is disposable so the livery can be toggled off.
 *
 * The helmet is the owner-supplied Corinthian/Spartan mark, embedded as
 * the original traced vector outline and rasterised on a canvas, so no
 * binary asset is required. Rendered in a light tint over a dark tail
 * field so it reads on any base colour.
 */

// Traced outline of the supplied Spartan helmet (potrace), in a
// 0..3990 x 0..4870 space drawn flipped, exactly as the source SVG.
const ELMO_PATH = 'M1520 4864 c-385 -47 -663 -131 -995 -302 -218 -113 -487 -293 -518 -347 -5 -10 21 -32 93 -80 182 -120 338 -249 543 -449 48 -47 91 -86 95 -86 4 0 43 27 87 60 280 211 763 346 1110 311 694 -71 1172 -433 1376 -1041 105 -313 114 -459 68 -1015 -16 -191 -6 -542 19 -686 60 -333 185 -561 385 -698 64 -44 190 -102 200 -92 4 4 -11 41 -34 81 -100 177 -169 403 -190 620 -20 214 4 394 115 883 77 336 86 401 86 608 0 906 -412 1597 -1189 1992 -334 170 -606 236 -996 242 -121 2 -236 1 -255 -1z M1577 3864 c-171 -27 -363 -87 -508 -159 -82 -42 -249 -153 -249 -166 0 -11 158 -209 166 -209 3 0 49 27 101 60 351 220 900 255 1259 81 444 -215 713 -639 733 -1156 l6 -160 114 -23 c82 -17 116 -21 124 -13 16 16 21 294 8 408 -81 666 -483 1145 -1086 1297 -212 54 -479 70 -668 40z M1605 3476 c-358 -59 -676 -260 -886 -561 -87 -124 -166 -302 -144 -324 6 -6 94 -24 195 -40 431 -70 1068 -216 958 -220 -42 -2 -502 63 -854 120 -177 29 -328 50 -336 47 -8 -4 -31 -66 -57 -154 -93 -327 -195 -667 -244 -819 -29 -88 -53 -166 -55 -172 -5 -19 21 -16 157 19 97 25 125 36 132 52 13 29 138 467 157 546 8 36 18 69 22 73 26 29 597 54 638 29 18 -12 -37 -90 -102 -147 -95 -84 -228 -140 -456 -193 l-74 -17 -18 -60 c-10 -33 -45 -190 -78 -350 -51 -248 -148 -713 -244 -1160 -30 -137 -30 -145 -14 -145 6 0 93 43 192 97 100 53 213 113 251 133 484 258 1170 627 1217 657 31 19 40 33 53 80 32 117 86 282 94 287 4 3 21 -50 38 -117 39 -153 69 -235 91 -241 9 -3 168 -28 352 -56 184 -27 393 -59 463 -70 128 -20 187 -25 187 -15 0 3 -31 41 -69 86 -249 288 -290 490 -216 1079 58 468 47 622 -63 878 -123 286 -390 533 -679 628 -177 58 -434 79 -608 50z';

// Per-airframe identification: tail code, 2-digit nose modex, role.
// Fixed-wing only; anything not listed gets a code derived from the id.
export const LIVREA_CENTURION = {
  f22:                 { codice: 'CENT-01', modex: '01', tipo: 'SUPERIORITA ARIA' },
  f16:                 { codice: 'CENT-02', modex: '02', tipo: 'MULTIRUOLO' },
  'f16-rebuilt':       { codice: 'CENT-02', modex: '02', tipo: 'MULTIRUOLO' },
  su57:                { codice: 'CENT-04', modex: '04', tipo: 'STEALTH' },
  su35:                { codice: 'CENT-05', modex: '05', tipo: 'SUPERIORITA ARIA' },
  ea18:                { codice: 'CENT-06', modex: '06', tipo: 'GUERRA ELETTRONICA' },
  f15e:                { codice: 'CENT-07', modex: '07', tipo: 'ATTACCO' },
  'c130j-hercules':    { codice: 'CENT-08', modex: '08', tipo: 'TRASPORTO TATTICO' },
  'mc130j-centurion':  { codice: 'CENT-09', modex: '09', tipo: 'OP. SPECIALI' },
  'mq9-centurion':     { codice: 'CENT-10', modex: '10', tipo: 'APR ISR-STRIKE' },
  'a10-centurion':     { codice: 'CENT-11', modex: '11', tipo: 'SUPPORTO RAVVICINATO' },
  f14:                 { codice: 'CENT-12', modex: '12', tipo: 'INTERCETTORE' },
  'hermes900-centurion': { codice: 'CENT-13', modex: '13', tipo: 'APR ISR' },
  typhoon:             { codice: 'CENT-14', modex: '14', tipo: 'MULTIRUOLO' },
};

// Airframes that must NOT receive the livery (rotary-wing, people,
// ordnance, hostile drones, generic UAV placeholders).
export const SENZA_LIVREA = new Set([
  'mh6-centurion','ah6-centurion','uh60-pack','uh60','uh60-centurion',
  'pilota','pj-operator','weapons','uav-fixed','uav-quad','geran2',
]);

export function haLivrea(id){ return !!id && !SENZA_LIVREA.has(id); }

function canvasTex(THREE, w, h, painter){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  painter(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Dark tail field (rounded panel) so the light emblem reads on any paint.
function campoTex(THREE){
  return canvasTex(THREE, 256, 320, (c,w,h)=>{
    const r = 26;
    c.fillStyle = 'rgba(22,26,31,0.92)';
    c.beginPath();
    c.moveTo(r,2); c.arcTo(w-2,2,w-2,h-2,r); c.arcTo(w-2,h-2,2,h-2,r);
    c.arcTo(2,h-2,2,2,r); c.arcTo(2,2,w-2,2,r); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(150,164,180,0.35)'; c.lineWidth = 3; c.stroke();
  });
}

// Spartan helmet + tail code, light, drawn from the traced outline.
function elmoTex(THREE, codice){
  return canvasTex(THREE, 420, 560, (c,w,h)=>{
    // helmet occupies the top ~72%
    c.save();
    const s = (w*0.80)/399;                 // fit width
    c.translate(w*0.10, h*0.015);
    c.scale(s, s);
    c.translate(0, 487); c.scale(0.1, -0.1); // source transform
    c.fillStyle = '#e9eef3';
    c.fill(new Path2D(ELMO_PATH));
    c.restore();
    // tail code under the helmet
    c.fillStyle = '#eef3f7';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 62px Arial, Helvetica, sans-serif';
    c.fillText(codice || 'CENT', w/2, h*0.90);
  });
}

// Nose modex: large 2-digit number + small code, dark on light skin.
function modexTex(THREE, modex, codice){
  return canvasTex(THREE, 512, 320, (c,w,h)=>{
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(26,30,36,0.92)';
    c.font = '800 190px Arial, Helvetica, sans-serif';
    c.fillText(String(modex||'').slice(0,2), w/2, h*0.42);
    c.font = '700 60px Arial, Helvetica, sans-serif';
    c.fillText(codice || '', w/2, h*0.82);
  });
}

// Tactical-grey tint. Two-tone by mesh height (darker spine, lighter
// belly), glass/metal/tyres preserved. Clones materials; reversible via
// the returned restore list.
export function verniceCenturion(THREE, aircraft){
  const memo = new Map();
  const restore = [];
  const preserve = /glass|canop|vetro|cockpit|windscreen|window|interior|seat|pilot|engine|exhaust|nozzle|burner|turbine|wheel|tire|tyre|gear|rubber|brake|light|screen/i;
  const box = new THREE.Box3().setFromObject(aircraft);
  const minY = box.min.y, spanY = Math.max(1e-6, box.max.y - box.min.y);
  const TOP = new THREE.Color().setRGB(0.25,0.28,0.33);
  const BOT = new THREE.Color().setRGB(0.38,0.41,0.46);
  aircraft.traverse(object=>{
    if(!object.isMesh || !object.material) return;
    const original = object.material;
    restore.push([object, original]);
    const transform = m=>{
      if(!m || !('color' in m)) return m;
      const name = (object.name||'') + ' ' + (m.name||'');
      if(preserve.test(name)){
        if(/glass|canop|vetro|windscreen/i.test(name) && !m.map){
          if(memo.has(m)) return memo.get(m);
          const g = m.clone(); g.color = new THREE.Color('#0e141b');
          g.metalness = 0.25; g.roughness = 0.09; g.needsUpdate = true;
          memo.set(m,g); return g;
        }
        return m;
      }
      if(memo.has(m)) return memo.get(m);
      const clone = m.clone();
      let f = 0.5;
      try{
        object.geometry.computeBoundingBox();
        const wc = object.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(object.matrixWorld);
        f = THREE.MathUtils.clamp((wc.y-minY)/spanY, 0, 1);
      }catch(e){}
      clone.map = null;                       // drop baked national colours
      clone.color = BOT.clone().lerp(TOP, Math.pow(f,0.8));
      clone.metalness = Math.min(Number(clone.metalness)||0, 0.25);
      clone.roughness = Math.max(Number(clone.roughness)||0.6, 0.6);
      clone.needsUpdate = true;
      memo.set(m, clone);
      return clone;
    };
    object.material = Array.isArray(original) ? original.map(transform) : transform(original);
  });
  return {
    changed: memo.size,
    dispose(){
      restore.forEach(([o,m])=>{ o.material = m; });
      memo.forEach(c=>c.dispose && c.dispose());
    }
  };
}

// Place the emblem on both fin faces, the modex on both nose sides, over
// the current airframe. Uses raycasting against the skin with fractional
// fallbacks, like the 51° Stormo overlay. Returns a disposable handle.
export function applyCenturion(THREE, scene, aircraft, opts = {}){
  const codice = opts.codice || 'CENT';
  const modex  = opts.modex  || '00';
  const nodes = [], resources = [];
  scene.updateMatrixWorld(true);
  aircraft.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(aircraft);
  const size = box.getSize(new THREE.Vector3());
  const min = box.min.clone();
  if(!size.x || !size.y || !size.z) return { applied:0, dispose(){} };
  const meshes = [];
  aircraft.traverse(o=>{ if(o.isMesh && o.geometry && o.visible) meshes.push(o); });
  if(!meshes.length) return { applied:0, dispose(){} };

  const tex = { campo:campoTex(THREE), elmo:elmoTex(THREE,codice), modex:modexTex(THREE,modex,codice) };
  Object.values(tex).forEach(t=>resources.push(t));
  const mkMat = (t, order)=>{
    const m = new THREE.MeshBasicMaterial({ map:t, transparent:true, opacity:0.97,
      side:THREE.DoubleSide, depthTest:true, depthWrite:false, polygonOffset:true,
      polygonOffsetFactor:-4-order, polygonOffsetUnits:-4-order, toneMapped:false });
    resources.push(m); return m;
  };
  const matCampo = mkMat(tex.campo,0), matElmo = mkMat(tex.elmo,1), matModex = mkMat(tex.modex,0);

  // Sample the skin in world space to anchor markings on real geometry
  // (raycasting a thin fin from the side misses too often on low-poly
  // imports and parks the decal out at the wingtip).
  const samp = [];
  { const v = new THREE.Vector3();
    for(const o of meshes){
      const pa = o.geometry.attributes.position; if(!pa) continue;
      const step = Math.max(1, Math.floor(pa.count/2500));
      for(let i=0;i<pa.count;i+=step){ v.fromBufferAttribute(pa,i).applyMatrix4(o.matrixWorld); samp.push(v.clone()); }
    }
  }
  if(!samp.length) return { applied:0, dispose(){} };

  // Fore-aft axis = the fuselage axis. The longest horizontal axis is NOT
  // reliable (transports/drones span wider than they are long), so pick by
  // distribution: along the wingspan most of the skin hugs the centreline
  // with a few points out at the tips (low median/extent ratio), while
  // along the fuselage the skin is spread end to end (high ratio).
  function spreadRatio(axis){
    const ctr = (box.min[axis]+box.max[axis])/2, half = Math.max(1e-6, size[axis]/2);
    const d = samp.map(v=>Math.abs(v[axis]-ctr)).sort((a,b)=>a-b);
    return (d[Math.floor(d.length/2)]/half);
  }
  const foreAft = spreadRatio('x') >= spreadRatio('z') ? 'x' : 'z';
  const lat = foreAft === 'x' ? 'z' : 'x';
  const L = size[foreAft], Wl = size[lat], H = size.y;
  // Identify the tail end: of the two fore-aft extremes, the one with the
  // taller geometry nearby carries the vertical stabiliser (the nose is
  // low and pointed). This avoids mistaking the canopy for the fin.
  const endA = min[foreAft], endB = min[foreAft] + L;
  const maxYNear = end => samp.reduce((m,v)=> (Math.abs(v[foreAft]-end) < L*0.22 && v.y>m) ? v.y : m, -Infinity);
  const tailEnd = maxYNear(endA) >= maxYNear(endB) ? endA : endB;
  const noseEnd = tailEnd === endA ? endB : endA;

  // Centroid of a region of the skin on one side; the marking sits on the
  // middle of that region's face, not on an edge vertex. Height band is
  // chosen RELATIVE to the near-tail geometry, so a low V-tail or a tall
  // single fin are both found.
  function anchor(targetEnd, faSpan, mode, side){
    let near = samp.filter(v=> Math.abs(v[foreAft]-targetEnd) < L*faSpan);
    if(near.length < 6) near = samp.filter(v=> Math.abs(v[foreAft]-targetEnd) < L*(faSpan+0.12));
    if(!near.length) return null;
    const ys = near.map(v=>v.y).sort((a,b)=>a-b);
    const q = f => ys[Math.min(ys.length-1, Math.max(0, Math.floor(f*(ys.length-1))))];
    const yLo = mode==='fin' ? q(0.62) : q(0.28);   // fin = upper geometry only
    const yHi = mode==='fin' ? q(1.00) : q(0.68);    // nose = mid fuselage
    const band = v => v.y >= yLo && v.y <= yHi;
    let pool = near.filter(v=> band(v) && (side>0 ? v[lat] >= -Wl*0.03 : v[lat] <= Wl*0.03));
    if(pool.length < 4) pool = near.filter(band);
    if(pool.length < 2) pool = near;
    // centroid of the region (the fin's mid-face / the fuselage side);
    // do NOT drag the anchor out to the horizontal-tail tip.
    const c = new THREE.Vector3();
    pool.forEach(v=>c.add(v)); c.multiplyScalar(1/pool.length);
    const n = new THREE.Vector3(); n[lat] = side>0 ? 1 : -1;
    return { point:c, normal:n };
  }
  function decal(spot, mat, w, h){
    if(!spot) return false;
    const point = spot.point.clone(), normal = spot.normal.clone().normalize();
    if(normal.lengthSq() < 0.5) return false;
    // upright in world space on near-vertical faces
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), normal);
    if(Math.abs(normal.y) < 0.7){
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), normal).normalize();
      const up = new THREE.Vector3().crossVectors(normal, right).normalize();
      quat.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
    }
    const d = new THREE.Mesh(new THREE.PlaneGeometry(w,h), mat);
    d.position.copy(point).addScaledVector(normal, Math.max(0.02, Wl*0.01));
    d.quaternion.copy(quat);
    d.renderOrder = 20;
    d.name = 'CENTURION2_livrea';
    scene.add(d); nodes.push(d);
    return true;
  }

  for(const side of [-1,1]){
    // Fin: dark field + helmet + code, on the mid of the stabiliser face.
    const fin = anchor(tailEnd, 0.22, 'fin', side);
    decal(fin, matCampo, L*0.11, H*0.30);
    decal(fin, matElmo,  L*0.10, H*0.28);
    // Nose modex, forward on the fuselage side.
    const nose = anchor(noseEnd, 0.24, 'nose', side);
    decal(nose, matModex, L*0.075, H*0.11);
  }

  return {
    applied: nodes.length, codice, modex,
    dispose(){
      nodes.forEach(o=>{ scene.remove(o); o.geometry.dispose(); });
      resources.forEach(r=>r.dispose && r.dispose());
    }
  };
}

// Convenience: full livery (paint + markings) for one airframe.
export function applyLivreaCompleta(THREE, scene, aircraft, id){
  const info = LIVREA_CENTURION[id] || { codice: 'CENT', modex: '00' };
  const paint = verniceCenturion(THREE, aircraft);
  const marks = applyCenturion(THREE, scene, aircraft, info);
  return {
    info, applied: marks.applied,
    dispose(){ marks.dispose(); paint.dispose(); }
  };
}
