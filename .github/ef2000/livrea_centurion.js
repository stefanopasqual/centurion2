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
// place.fin / place.nose: fractions along the fuselage (fa: 0 nose -> 1
// tail) and height (y: 0 belly -> 1 top); fin.h is the emblem height as a
// fraction of airframe height. Tuned per airframe so the emblem sits
// centred on the stabiliser and the modex on the nose.
export const LIVREA_CENTURION = {
  f22:                 { codice: 'CENT-01', modex: '01', tipo: 'SUPERIORITA ARIA',   place:{ fin:{fa:0.72,y:0.72,h:0.24}, nose:{fa:0.24,y:0.50} } },
  f16:                 { codice: 'CENT-02', modex: '02', tipo: 'MULTIRUOLO',         place:{ fin:{fa:0.80,y:0.74,h:0.28}, nose:{fa:0.26,y:0.52} } },
  'f16-rebuilt':       { codice: 'CENT-02', modex: '02', tipo: 'MULTIRUOLO',         place:{ fin:{fa:0.80,y:0.74,h:0.28}, nose:{fa:0.26,y:0.52} } },
  su57:                { codice: 'CENT-04', modex: '04', tipo: 'STEALTH',            place:{ fin:{fa:0.70,y:0.64,h:0.20}, nose:{fa:0.26,y:0.50} } },
  su35:                { codice: 'CENT-05', modex: '05', tipo: 'SUPERIORITA ARIA',   place:{ fin:{fa:0.76,y:0.68,h:0.24}, nose:{fa:0.26,y:0.52} } },
  ea18:                { codice: 'CENT-06', modex: '06', tipo: 'GUERRA ELETTRONICA', place:{ fin:{fa:0.74,y:0.70,h:0.22}, nose:{fa:0.24,y:0.54} } },
  f15e:                { codice: 'CENT-07', modex: '07', tipo: 'ATTACCO',            place:{ fin:{fa:0.78,y:0.70,h:0.26}, nose:{fa:0.24,y:0.54} } },
  'c130j-hercules':    { codice: 'CENT-08', modex: '08', tipo: 'TRASPORTO TATTICO',  place:{ fin:{fa:0.90,y:0.76,h:0.30}, nose:{fa:0.14,y:0.54} } },
  'mc130j-centurion':  { codice: 'CENT-09', modex: '09', tipo: 'OP. SPECIALI',       place:{ fin:{fa:0.90,y:0.76,h:0.30}, nose:{fa:0.14,y:0.54} } },
  'mq9-centurion':     { codice: 'CENT-10', modex: '10', tipo: 'APR ISR-STRIKE',     place:{ fin:{fa:0.86,y:0.54,h:0.18}, nose:{fa:0.26,y:0.56} } },
  'a10-centurion':     { codice: 'CENT-11', modex: '11', tipo: 'SUPP. RAVVICINATO',  place:{ fin:{fa:0.86,y:0.62,h:0.22}, nose:{fa:0.24,y:0.52} } },
  f14:                 { codice: 'CENT-12', modex: '12', tipo: 'INTERCETTORE',       place:{ fin:{fa:0.74,y:0.70,h:0.26}, nose:{fa:0.24,y:0.52} } },
  'hermes900-centurion': { codice: 'CENT-13', modex: '13', tipo: 'APR ISR',          place:{ fin:{fa:0.86,y:0.56,h:0.18}, nose:{fa:0.26,y:0.56} } },
  typhoon:             { codice: 'CENT-14', modex: '14', tipo: 'MULTIRUOLO',         place:{ fin:{fa:0.82,y:0.74,h:0.28}, nose:{fa:0.26,y:0.52} } },
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

// Spartan helmet + tail code in tactical grey, drawn from the traced
// outline. Sits on the black fin, so a mid grey reads cleanly.
function elmoTex(THREE, codice){
  return canvasTex(THREE, 420, 560, (c,w,h)=>{
    c.save();
    const s = (w*0.80)/399;                 // fit width
    c.translate(w*0.10, h*0.02);
    c.scale(s, s);
    c.translate(0, 487); c.scale(0.1, -0.1); // source transform
    c.fillStyle = '#9aa6b4';                 // tactical grey helmet
    c.fill(new Path2D(ELMO_PATH));
    c.restore();
    // tail code under the helmet, same grey family
    c.fillStyle = '#aeb9c6';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 60px Arial, Helvetica, sans-serif';
    c.fillText(codice || 'CENT', w/2, h*0.905);
  });
}

// Shared airframe analysis: axes, tail/nose ends and a mask that marks the
// vertical tail fin (near the tail, above the local fuselage top). Used by
// both the paint (black fin) and the emblem (centred on the black region).
export function analizzaAirframe(THREE, aircraft, ov){
  aircraft.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(aircraft);
  const size = box.getSize(new THREE.Vector3());
  const min = box.min.clone();
  const meshes = [];
  aircraft.traverse(o=>{ if(o.isMesh && o.geometry && o.visible) meshes.push(o); });
  const samp = [];
  { const v = new THREE.Vector3();
    for(const o of meshes){
      const pa = o.geometry.attributes.position; if(!pa) continue;
      const step = Math.max(1, Math.floor(pa.count/2500));
      for(let i=0;i<pa.count;i+=step){ v.fromBufferAttribute(pa,i).applyMatrix4(o.matrixWorld); samp.push(v.clone()); }
    }
  }
  const ok = samp.length>0 && size.x>0 && size.y>0 && size.z>0;
  // fuselage axis by distribution (robust for wide-span transports)
  const spreadRatio = axis => {
    const ctr=(box.min[axis]+box.max[axis])/2, half=Math.max(1e-6,size[axis]/2);
    const d=samp.map(v=>Math.abs(v[axis]-ctr)).sort((a,b)=>a-b);
    return d.length? d[Math.floor(d.length/2)]/half : 0;
  };
  const foreAft = spreadRatio('x') >= spreadRatio('z') ? 'x' : 'z';
  const lat = foreAft==='x' ? 'z' : 'x';
  const L=size[foreAft], Wl=size[lat], H=size.y;
  const endA=min[foreAft], endB=min[foreAft]+L;
  const endBulk = end => {
    const near=samp.filter(v=>Math.abs(v[foreAft]-end)<L*0.09);
    if(near.length<3) return 0;
    const bb=new THREE.Box3(); near.forEach(v=>bb.expandByPoint(v));
    const s=bb.getSize(new THREE.Vector3()); return s[lat]*0.6 + s.y;
  };
  const tailEnd = endBulk(endA) >= endBulk(endB) ? endA : endB;
  const noseEnd = tailEnd===endA ? endB : endA;
  // Fin region = the vertical tail(s): the rear portion of the airframe,
  // above the rear fuselage spine. Works wherever the fins sit in the rear
  // (fighter tails are well forward of the nozzles) and on twin/canted/T
  // tails. baseY is the spine top near the centreline, so only the fins
  // (which rise above it) are caught, not wings or horizontal stabs below.
  const span = (ov && ov.tail && ov.tail.span) || 0.52;  // fraction of L from the tail end
  const latCtr = (box.min[lat]+box.max[lat])/2;
  const inRear = v => Math.abs(v[foreAft]-tailEnd) < L*span;
  const spine = samp.filter(v=> inRear(v) && Math.abs(v[lat]-latCtr) < Wl*0.14);
  const sy = spine.map(v=>v.y).sort((a,b)=>a-b);
  const spineTop = sy.length ? sy[Math.floor(0.72*(sy.length-1))] : min.y+H*0.5;
  const baseY = (ov && ov.tail && ov.tail.baseY!=null)
    ? (min.y + H*ov.tail.baseY)
    : Math.max(min.y + H*0.42, spineTop + H*0.02);
  const finMask = v => inRear(v) && v.y >= baseY;
  return { ok, box, size, min, meshes, samp, foreAft, lat, latCtr, L, Wl, H, tailEnd, noseEnd, span, baseY, finMask };
}

// Tactical-grey tint with the tail fin painted BLACK, via per-vertex
// colours (works even when the fin shares a mesh with the fuselage).
// Glass/metal/tyres preserved. Clones materials; reversible.
export function verniceCenturion(THREE, aircraft, A){
  A = A || analizzaAirframe(THREE, aircraft);
  const memo = new Map();
  const restore = [];
  const preserve = /glass|canop|vetro|cockpit|windscreen|window|interior|seat|pilot|engine|exhaust|nozzle|burner|turbine|wheel|tire|tyre|gear|rubber|brake|light|screen/i;
  const minY = A.min.y, spanY = Math.max(1e-6, A.H);
  const TOP = new THREE.Color().setRGB(0.25,0.28,0.33);
  const BOT = new THREE.Color().setRGB(0.38,0.41,0.46);
  const BLACK = new THREE.Color().setRGB(0.045,0.055,0.065);   // fin
  const geomTouched = [];
  const wv = new THREE.Vector3();
  aircraft.traverse(object=>{
    if(!object.isMesh || !object.material) return;
    const original = object.material;
    restore.push([object, original]);
    const name = (object.name||'') + ' ' + ((original&&original.name)||'');
    const isPreserve = preserve.test(name);
    // Per-vertex colours: grey body (two-tone by height) + black tail fin.
    if(!isPreserve && object.geometry && object.geometry.attributes.position){
      const g = object.geometry, pa = g.attributes.position, n = pa.count;
      if(!g.getAttribute('__centBaseColor')){
        const col = new Float32Array(n*3);
        for(let i=0;i<n;i++){
          wv.fromBufferAttribute(pa,i).applyMatrix4(object.matrixWorld);
          const c = A.finMask(wv) ? BLACK
            : BOT.clone().lerp(TOP, Math.pow(THREE.MathUtils.clamp((wv.y-minY)/spanY,0,1),0.8));
          col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(col,3));
        g.setAttribute('__centBaseColor', new THREE.BufferAttribute(new Float32Array(1),1)); // marker
        geomTouched.push(g);
      } else if(g.getAttribute('color')===undefined){ /* already */ }
    }
    const transform = m=>{
      if(!m || !('color' in m)) return m;
      if(isPreserve){
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
      clone.map = null;                 // drop baked national colours
      clone.vertexColors = true;        // grey body + black fin from attribute
      clone.color = new THREE.Color(0xffffff);
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
      geomTouched.forEach(g=>{ g.deleteAttribute('color'); g.deleteAttribute('__centBaseColor'); });
    }
  };
}

// Place the grey Spartan emblem (helmet + tail code) centred on the black
// tail fin, on both faces. No nose markings: the whole fin is black, so the
// emblem always sits on a black field and placement cannot miss.
export function applyCenturion(THREE, scene, aircraft, opts = {}){
  const codice = opts.codice || 'CENT';
  const A = opts.A || analizzaAirframe(THREE, aircraft, opts.place || null);
  const nodes = [], resources = [];
  if(!A.ok) return { applied:0, dispose(){} };
  scene.updateMatrixWorld(true);
  const { lat, Wl, foreAft } = A;
  const tex = elmoTex(THREE, codice); resources.push(tex);
  const mat = new THREE.MeshBasicMaterial({ map:tex, transparent:true, opacity:0.98,
    side:THREE.DoubleSide, depthTest:true, depthWrite:false, polygonOffset:true,
    polygonOffsetFactor:-6, polygonOffsetUnits:-6, toneMapped:false });
  resources.push(mat);

  function orient(normal){
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), normal);
    if(Math.abs(normal.y) < 0.7){
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), normal).normalize();
      const up = new THREE.Vector3().crossVectors(normal, right).normalize();
      q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
    }
    return q;
  }
  // Emblem placed on the centroid of the black fin region for this side,
  // sized to the fin so it stays within it.
  const latCtr = A.latCtr;
  const finVerts = A.samp.filter(A.finMask);
  if(finVerts.length >= 3){
    // Tallest fin point: central -> one fin (emblem on both faces);
    // off-centre -> twin tails (one emblem per fin, on its outer face).
    let top = finVerts[0]; for(const v of finVerts) if(v.y>top.y) top=v;
    const d = Math.abs(top[lat]-latCtr);
    const twin = d > Wl*0.12;
    const placements = twin
      ? [{ lat: latCtr+d, side: 1 }, { lat: latCtr-d, side: -1 }]
      : [{ lat: latCtr, side: 1 }, { lat: latCtr, side: -1 }];
    for(const pl of placements){
      let col = finVerts.filter(v=> Math.abs(v[lat]-pl.lat) < Wl*0.16);
      if(col.length < 3) col = finVerts;
      const bb = new THREE.Box3(); col.forEach(v=>bb.expandByPoint(v));
      const ctr = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
      const finH = Math.max(sz.y, 1e-3);
      const eh = Math.min(finH*0.82, A.H*0.42), ew = eh*0.75;
      const c = new THREE.Vector3();
      c[foreAft] = ctr[foreAft];
      c.y = ctr.y + finH*0.04;
      c[lat] = pl.lat;
      const normal = new THREE.Vector3(); normal[lat] = pl.side;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ew, eh), mat);
      mesh.position.copy(c).addScaledVector(normal, Math.max(0.03, Wl*0.02));
      mesh.quaternion.copy(orient(normal));
      mesh.renderOrder = 20; mesh.name = 'CENTURION2_livrea';
      scene.add(mesh); nodes.push(mesh);
    }
  }
  return {
    applied: nodes.length, codice,
    dispose(){
      nodes.forEach(o=>{ scene.remove(o); o.geometry.dispose(); });
      resources.forEach(r=>r.dispose && r.dispose());
    }
  };
}

// Convenience: full livery (grey paint + black fin + emblem) for one airframe.
export function applyLivreaCompleta(THREE, scene, aircraft, id){
  const info = LIVREA_CENTURION[id] || { codice: 'CENT', modex: '00' };
  const A = analizzaAirframe(THREE, aircraft, info.place || null);
  const paint = verniceCenturion(THREE, aircraft, A);
  const marks = applyCenturion(THREE, scene, aircraft, Object.assign({ A }, info));
  return {
    info, applied: marks.applied,
    dispose(){ marks.dispose(); paint.dispose(); }
  };
}
