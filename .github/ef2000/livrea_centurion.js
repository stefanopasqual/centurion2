import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';
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
  'orion-e':             { codice: 'CENT-13', modex: '13', tipo: 'APR ISR MALE' },
  typhoon:             { codice: 'CENT-14', modex: '14', tipo: 'MULTIRUOLO',         place:{ fin:{fa:0.82,y:0.74,h:0.28}, nose:{fa:0.26,y:0.52} } },
};

// Airframes that must NOT receive the livery (rotary-wing, people,
// ordnance, hostile drones, generic UAV placeholders).
export const SENZA_LIVREA = new Set([
  'mh6-centurion','ah6-centurion','uh60-pack','uh60','uh60-centurion','uh60m-wtiger',
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
// outline. Sits on the black fin, so a mid grey reads cleanly. The source
// helmet faces left; `mirror` flips only the helmet (the code stays
// readable) so its face can point toward the aircraft nose on either side.
function elmoTex(THREE, codice, mirror){
  return canvasTex(THREE, 420, 560, (c,w,h)=>{
    c.save();
    if(mirror){ c.translate(w,0); c.scale(-1,1); }   // mirror the helmet only
    c.save();
    const s = (w*0.80)/399;                 // fit width
    c.translate(w*0.10, h*0.02);
    c.scale(s, s);
    c.translate(0, 487); c.scale(0.1, -0.1); // source transform
    c.fillStyle = '#9aa6b4';                 // tactical grey helmet
    c.fill(new Path2D(ELMO_PATH));
    c.restore();
    c.restore();                             // undo mirror before the text
    // tail code under the helmet, same grey family, always readable
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

// Vernice originale INTATTA: nessuna modifica a material, map, vertexColors
// o geometry dei modelli sorgenti. Solo un rivestimento nero separato sulle
// facce verticali delle derive, rimosso quando la livrea e' disattivata.
export function verniceCenturion(THREE, aircraft, A){
  A=A||analizzaAirframe(THREE,aircraft);
  aircraft.updateMatrixWorld(true);
  const rootInverse=new THREE.Matrix4().copy(aircraft.matrixWorld).invert();
  const overlays=[];
  const dark=new THREE.MeshStandardMaterial({
    color:0x101218,roughness:0.72,metalness:0.12,
    side:THREE.DoubleSide,depthTest:true,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3
  });
  const omit=/glass|canop|vetro|cockpit|windscreen|window|interior|seat|pilot|engine|exhaust|nozzle|burner|turbine|wheel|tire|tyre|gear|rubber|brake|light|screen/i;
  const axis=A.foreAft;
  const rearDirection=A.tailEnd===A.box.min[axis] ? 1 : -1;
  const limit=A.tailEnd+rearDirection*A.L*A.span;
  // A-10: le due derive sono molto esterne, fuori dal limite generico del 27%.
  // Estendi la regione soltanto per questo velivolo, non per le altre livree.
  const lateralLimit=A.Wl*(A.airframeId==='a10-centurion'?.495:.27);
  const p0=new THREE.Vector3(),p1=new THREE.Vector3(),p2=new THREE.Vector3();
  const ab=new THREE.Vector3(),ac=new THREE.Vector3(),normal=new THREE.Vector3();
  const byAxis=(p,k)=>p[k];
  // Clipping su base della deriva, parte posteriore e ingombro laterale.
  // Evita di annerire ali, superfici orizzontali e resto della fusoliera.
  function clip(poly,dist){
    if(!poly.length)return poly;
    const out=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];
      const da=dist(a),db=dist(b);
      if(da>=0)out.push(a);
      if((da<0&&db>0)||(da>0&&db<0))
        out.push(a.clone().lerp(b,da/(da-db)));
    }
    return out;
  }
  for(const object of A.meshes){
    const g=object.geometry,attr=g?.getAttribute('position');
    if(!attr||!object.material)continue;
    const mats=Array.isArray(object.material)?object.material:[object.material];
    if(omit.test(object.name||''))continue;
    const idx=g.index,groups=g.groups||[];
    const triCount=Math.floor((idx?idx.count:attr.count)/3);
    const vertices=[];
    for(let tri=0;tri<triCount;tri++){
      const i=tri*3;
      if(groups.length){
        const group=groups.find(h=>i>=h.start&&i<h.start+h.count);
        if(group&&omit.test(mats[group.materialIndex||0]?.name||''))continue;
      }else if(mats.length===1&&omit.test(mats[0]?.name||''))continue;
      p0.fromBufferAttribute(attr,idx?idx.getX(i):i).applyMatrix4(object.matrixWorld);
      p1.fromBufferAttribute(attr,idx?idx.getX(i+1):i+1).applyMatrix4(object.matrixWorld);
      p2.fromBufferAttribute(attr,idx?idx.getX(i+2):i+2).applyMatrix4(object.matrixWorld);
      ab.subVectors(p1,p0);ac.subVectors(p2,p0);
      normal.crossVectors(ab,ac);
      if(normal.lengthSq()<1e-12)continue;
      normal.normalize();
      // La deriva e' verticale: normale prevalentemente laterale.
      if(Math.abs(normal[A.lat])<.38||Math.abs(normal.y)>.78)continue;
      let poly=[p0.clone(),p1.clone(),p2.clone()];
      poly=clip(poly,v=>v.y-A.baseY);
      poly=clip(poly,v=>(limit-byAxis(v,axis))*rearDirection);
      poly=clip(poly,v=>lateralLimit-Math.abs(v[A.lat]-A.latCtr));
      if(poly.length<3)continue;
      for(let n=1;n<poly.length-1;n++){
        for(const p of [poly[0],poly[n],poly[n+1]]){
          const local=p.clone().applyMatrix4(rootInverse);
          vertices.push(local.x,local.y,local.z);
        }
      }
    }
    if(!vertices.length)continue;
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geo.computeVertexNormals();
    const overlay=new THREE.Mesh(geo,dark);
    overlay.name='CENTURION2_black_vertical_tail';
    overlay.frustumCulled=false;
    overlay.renderOrder=5;
    aircraft.add(overlay);
    overlays.push(overlay);
  }
  if(!overlays.length)dark.dispose();
  return {
    changed:overlays.length,
    overlays,
    dispose(){
      overlays.forEach(o=>{o.parent?.remove(o);o.geometry.dispose();});
      if(overlays.length)dark.dispose();
    }
  };
}

// Cimiero centrato sull'effettiva superficie nera di ogni deriva.
// La maschera e' realizzata esclusivamente dai triangoli di verniciatura,
// quindi nessun punto dell'emblema puo' uscire dalla superficie della pinna.
// Le texture e i materiali dei GLB originali rimangono invariati.
export function applyCenturion(THREE, scene, aircraft, opts = {}){
  const A=opts.A||analizzaAirframe(THREE,aircraft,opts.place||null);
  const black=opts.blackSurfaces||[];
  const resources=[],nodes=[];
  const empty=()=>({applied:0,dispose(){}});
  if(!A.ok||!black.length)return empty();
  aircraft.updateMatrixWorld(true);

  // Ogni triangolo qui proviene da CENTURION2_black_vertical_tail:
  // e' davvero nero e appartiene a una superficie verticale.
  const faces=[];
  const va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3();
  const ab=new THREE.Vector3(),ac=new THREE.Vector3(),n=new THREE.Vector3();
  for(const mesh of black){
    const positions=mesh.geometry.getAttribute('position');
    if(!positions)continue;
    for(let i=0;i+2<positions.count;i+=3){
      va.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
      vb.fromBufferAttribute(positions,i+1).applyMatrix4(mesh.matrixWorld);
      vc.fromBufferAttribute(positions,i+2).applyMatrix4(mesh.matrixWorld);
      ab.subVectors(vb,va);ac.subVectors(vc,va);
      n.crossVectors(ab,ac);
      const area=n.length()*0.5;
      if(area<1e-10)continue;
      const normal=n.clone().normalize();
      if(Math.abs(normal[A.lat])<.35||Math.abs(normal.y)>.78)continue;
      faces.push({
        vertices:[va.clone(),vb.clone(),vc.clone()],
        center:va.clone().add(vb).add(vc).multiplyScalar(1/3),
        normal,area
      });
    }
  }
  if(!faces.length)return empty();

  let minY=Infinity,maxY=-Infinity;
  for(const face of faces){minY=Math.min(minY,face.center.y);maxY=Math.max(maxY,face.center.y);}
  const upper=faces.filter(f=>f.center.y>minY+(maxY-minY)*.45);
  const main=upper.length?upper:faces;
  const separation=Math.max(A.Wl*.048,A.H*.03);
  const left=main.filter(f=>f.center[A.lat]<A.latCtr-separation);
  const right=main.filter(f=>f.center[A.lat]>A.latCtr+separation);
  const areaOf=set=>set.reduce((s,f)=>s+f.area,0);
  const upperArea=areaOf(main);
  // A-10: due derive fisicamente separate. Non dedurre una deriva singola
  // dalla disposizione delle normali (i GLB possono invertirne il verso).
  const isA10=opts.airframeId==='a10-centurion';
  const twin=isA10||(areaOf(left)>upperArea*.085&&areaOf(right)>upperArea*.085);

  // Due derive: un cimiero sulla faccia esterna di ciascuna.
  // Deriva singola: un cimiero su ognuno dei suoi due lati.
  const sides=twin
    ?[{side:-1,outer:-1},{side:1,outer:1}]
    :[{side:-1,outer:0},{side:1,outer:0}];

  function clip(poly,dist){
    if(!poly.length)return poly;
    const out=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];
      const da=dist(a),db=dist(b);
      if(da>=-1e-8)out.push(a);
      if((da<0&&db>0)||(da>0&&db<0))
        out.push(a.clone().lerp(b,da/(da-db)));
    }
    return out;
  }

  // Sezione orizzontale della pinna: scegli il segmento nero continuo
  // piu' ampio; il centro non deriva dalla geometria di ali/fusoliera.
  function section(facesAt,y){
    const spans=[];
    for(const face of facesAt){
      const v=face.vertices,ints=[];
      for(let i=0;i<3;i++){
        const a=v[i],b=v[(i+1)%3],dy=b.y-a.y;
        if(Math.abs(dy)<1e-8){
          if(Math.abs(a.y-y)<1e-6)ints.push(a[A.foreAft],b[A.foreAft]);
        }else{
          const t=(y-a.y)/dy;
          if(t>=-1e-7&&t<=1+1e-7)
            ints.push(a[A.foreAft]+(b[A.foreAft]-a[A.foreAft])*t);
        }
      }
      if(ints.length>=2){
        const lo=Math.min(...ints),hi=Math.max(...ints);
        if(hi-lo>1e-7)spans.push([lo,hi]);
      }
    }
    if(!spans.length)return null;
    spans.sort((a,b)=>a[0]-b[0]);
    const merged=[spans[0].slice()];
    const epsilon=Math.max(A.L*1e-5,1e-6);
    for(const [lo,hi] of spans.slice(1)){
      const curr=merged[merged.length-1];
      if(lo<=curr[1]+epsilon)curr[1]=Math.max(curr[1],hi);
      else merged.push([lo,hi]);
    }
    return merged.reduce((best,p)=>!best||p[1]-p[0]>best[1]-best[0]?p:best,null);
  }

  const front=Math.sign(A.noseEnd-A.tailEnd)||1;
  for(const config of sides){
    const side=config.side;
    const relevant=faces.filter(f=>
      // Per l'A-10 raggruppa per posizione della pinna, indipendentemente
      // dalla normale esportata. Le due facce restano entrambe visibili.
      (isA10?Math.abs(f.normal[A.lat])>.25:f.normal[A.lat]*side>.35)&&
      (!twin||((f.center[A.lat]-A.latCtr)*config.outer>separation*.5)));
    if(!relevant.length)continue;
    let ylo=Infinity,yhi=-Infinity;
    for(const face of relevant)for(const v of face.vertices){
      ylo=Math.min(ylo,v.y);yhi=Math.max(yhi,v.y);
    }
    const height=yhi-ylo;
    if(height<1e-4)continue;
    // Centro geometrico verticale della regione nera.
    const centerY=(ylo+yhi)*.5;
    const midSpan=section(relevant,centerY);
    if(!midSpan)continue;
    // Centro orizzontale della corda della deriva a mezza altezza.
    let centerX=(midSpan[0]+midSpan[1])*.5;
    const midChord=midSpan[1]-midSpan[0];
    const requested=opts.place?.fin?.h;
    let h=Math.min(height*.64,midChord*.72/.75,
      Number.isFinite(requested)?A.H*requested:A.H*.26);
    if(h<Math.max(.04,A.H*.012))continue;

    // Riduci proporzionalmente se il trapezio si restringe: il disegno
    // mantiene margini simmetrici e resta entro la pinna nera.
    for(let attempt=0;attempt<12;attempt++){
      const yA=centerY-h*.49,yB=centerY+h*.49;
      const low=section(relevant,yA),high=section(relevant,yB);
      const width=h*.75;
      if(low&&high){
        const xmin=Math.max(low[0],high[0],midSpan[0]);
        const xmax=Math.min(low[1],high[1],midSpan[1]);
        if(xmax-xmin>=width*1.14){
          centerX=Math.max(xmin+width*.5*1.07,
            Math.min(xmax-width*.5*1.07,centerX));
          break;
        }
      }
      h*=.83;
    }
    if(h<Math.max(.04,A.H*.012))continue;

    // Una deriva A-10 ha due pelli, interna ed esterna. La vecchia
    // applicazione usava la normale dei triangoli GLB, che puo' puntare
    // all'interno della fusoliera: i cimieri erano creati ma occultati.
    // Qui campioniamo la pelle effettiva da ogni lato e disegniamo il
    // simbolo appena ALL'ESTERNO della superficie nera, senza alterare
    // texture, materiali o geometria originali del velivolo.
    for(const skin of (isA10?[1,-1]:[1])){
      const facing=isA10?side*skin:side;
      const outward=new THREE.Vector3();outward[A.lat]=facing;
      const viewRight=new THREE.Vector3().crossVectors(
        new THREE.Vector3(0,1,0),outward).normalize();
      const rightSign=Math.sign(viewRight[A.foreAft])||1;
      const mirror=rightSign*front>0;
      const tex=elmoTex(THREE,opts.codice||'CENT',mirror);
      resources.push(tex);
      const mat=new THREE.MeshBasicMaterial({
        map:tex,transparent:true,opacity:.99,side:THREE.DoubleSide,
        depthTest:true,depthWrite:false,polygonOffset:true,
        polygonOffsetFactor:-8,polygonOffsetUnits:-8,toneMapped:false
      });
      resources.push(mat);
      const halfW=h*.75*.5,halfH=h*.5;
      const x0=centerX-halfW,x1=centerX+halfW;
      const y0=centerY-halfH,y1=centerY+halfH;
      const vertices=[],uv=[];
      const push=p=>{
        const u=.5+(p[A.foreAft]-centerX)*rightSign/(h*.75);
        const v=.5+(p.y-centerY)/h;
        vertices.push(p.x,p.y,p.z);
        uv.push(u,v);
      };
      if(isA10){
        // Proiezione 2D della deriva (asse avanti-indietro, altezza).
        // Per ogni punto sceglie la pelle piu' esterna sul lato richiesto,
        // quindi il decal non puo' rimanere nascosto dentro il modello.
        const triangles=[];
        for(const f of relevant){
          const [a,b,c]=f.vertices;
          const ax=a[A.foreAft],bx=b[A.foreAft],cx=c[A.foreAft];
          const ay=a.y,by=b.y,cy=c.y;
          const det=(bx-ax)*(cy-ay)-(cx-ax)*(by-ay);
          if(Math.abs(det)<1e-10)continue;
          triangles.push({a,b,c,ax,ay,bx,by,cx,cy,det,
            xmin:Math.min(ax,bx,cx),xmax:Math.max(ax,bx,cx),
            ymin:Math.min(ay,by,cy),ymax:Math.max(ay,by,cy)});
        }
        const bias=Math.max(.012,A.H*.004);
        const sample=(x,y)=>{
          let best=skin>0?-Infinity:Infinity;
          let found=false;
          for(const t of triangles){
            if(x<t.xmin-1e-6||x>t.xmax+1e-6||
               y<t.ymin-1e-6||y>t.ymax+1e-6)continue;
            const u=((x-t.ax)*(t.cy-t.ay)-(t.cx-t.ax)*(y-t.ay))/t.det;
            const v=((t.bx-t.ax)*(y-t.ay)-(x-t.ax)*(t.by-t.ay))/t.det;
            if(u< -1e-5||v< -1e-5||u+v>1.00001)continue;
            const lat=t.a[A.lat]+u*(t.b[A.lat]-t.a[A.lat])+
              v*(t.c[A.lat]-t.a[A.lat]);
            const distance=side*lat;
            if(!found||skin*distance>skin*best){best=distance;found=true;}
          }
          if(!found)return null;
          const p=new THREE.Vector3();
          p[A.foreAft]=x;p.y=y;p[A.lat]=side*(best+skin*bias);
          return p;
        };
        const nx=30,ny=34,grid=[];
        for(let iy=0;iy<=ny;iy++){
          const y=y0+(y1-y0)*iy/ny;
          for(let ix=0;ix<=nx;ix++)
            grid.push(sample(x0+(x1-x0)*ix/nx,y));
        }
        for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){
          const k=iy*(nx+1)+ix;
          const a=grid[k],b=grid[k+1],c=grid[k+nx+1],d=grid[k+nx+2];
          if(a&&b&&c&&d){
            push(a);push(b);push(d);
            push(a);push(d);push(c);
          }
        }
      }else{
        // Livree degli altri velivoli invariate.
        for(const face of relevant){
          let poly=face.vertices.map(v=>v.clone());
          poly=clip(poly,p=>p[A.foreAft]-x0);
          poly=clip(poly,p=>x1-p[A.foreAft]);
          poly=clip(poly,p=>p.y-y0);
          poly=clip(poly,p=>y1-p.y);
          if(poly.length<3)continue;
          const offset=Math.max(.003,A.H*.001);
          for(let i=1;i<poly.length-1;i++){
            for(const p of [poly[0],poly[i],poly[i+1]])
              push(p.clone().addScaledVector(face.normal,offset));
          }
        }
      }
      if(!vertices.length){
        tex.dispose();mat.dispose();
        resources.pop();resources.pop();
        console.warn('CENTURION: cimiero senza superficie visibile',
          opts.codice,side,skin);
        continue;
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      geometry.computeVertexNormals();
      const decal=new THREE.Mesh(geometry,mat);
      decal.name='CENTURION2_livrea';
      decal.userData.centurionFin=side;
      decal.userData.centurionSkin=skin;
      decal.userData.centurionTriangles=vertices.length/9;
      decal.renderOrder=20;
      decal.frustumCulled=false;
      scene.add(decal);nodes.push(decal);
      console.info('CENTURION: cimiero sulla pelle della deriva',opts.codice,
        {fin:side,skin,triangles:vertices.length/9,
         X:centerX,Y:centerY,h,finHeight:height,midChord});
    }
  }
  return {applied:isA10 ? sides.filter(c=>nodes.some(n=>n.userData.centurionFin===c.side)).length : nodes.length,codice:opts.codice||'CENT',dispose(){
    nodes.forEach(o=>{scene.remove(o);o.geometry.dispose();});
    resources.forEach(r=>r.dispose&&r.dispose());
  }};
}

// Convenience: full livery (grey paint + black fin + emblem) for one airframe.
export function applyLivreaCompleta(THREE, scene, aircraft, id){
  const info = LIVREA_CENTURION[id] || { codice: 'CENT', modex: '00' };
  const A = analizzaAirframe(THREE, aircraft, info.place || null);
  A.airframeId=id;
  const paint = verniceCenturion(THREE, aircraft, A);
  const marks = applyCenturion(THREE, scene, aircraft, Object.assign({ A, airframeId:id, blackSurfaces: paint.overlays }, info));
  return {
    info, applied: marks.applied,
    dispose(){ marks.dispose(); paint.dispose(); }
  };
}
