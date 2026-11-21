/* CENTURION 2 | Condensazione transonica (cono di vapore) e bang sonico.
 *
 * Cono di vapore: vicino a Mach 1, in aria umida, l'espansione dietro l'onda d'urto raffredda l'aria e il vapore
 * condensa attorno all'aereo. Come nelle foto reali la nuvola parte già larga (circa 2/3 dell'apertura alare)
 * all'altezza dell'ala, dove sta l'onda d'urto, con un fronte netto, e si allarga poco fino oltre la coda diradandosi
 * in sbuffi turbolenti. Compare fra circa Mach 0,93 e 1,07 e sparisce quando l'aereo è pienamente supersonico; in
 * aria secca resta solo un velo.
 * Resa: un volume (cilindro contenitore) in cui lo shader integra la densità del vapore lungo il raggio visivo, così
 * da dietro è un disco bianco pieno e sfrangiato, di lato un cono con il bordo netto.
 * L'onda d'urto in sé non si vede: il bang lo sente un osservatore esterno quando il cono d'urto lo raggiunge, non il pilota.
 *
 * API invariata: make(root) -> {update(pos, quat, mach, umidita 0..1, t, scala), dispose()}; boom(ctx, uscita, guadagno).
 */
(function(){
  'use strict';
  if(window.CENTURION_SONIC)return;
  const T=window.THREE;
  if(!T)return;
  const PI=Math.PI,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  // contenitore per un caccia di 15 m (l'aereo ha il centro nell'origine e il muso verso +Z)
  const RB=5.2,Z0=1.8,Z1=-9.6;
  const passi=()=>(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'')?10:16);
  let GEO=null;
  function geometria(){
    if(GEO)return GEO;
    GEO=new T.CylinderGeometry(RB,RB,Z0-Z1,24,1,false);
    GEO.rotateX(-PI/2);GEO.translate(0,0,(Z0+Z1)/2);
    return GEO;
  }
  const VS=[
    '#include <common>',
    '#include <logdepthbuf_pars_vertex>',
    'varying vec3 vP;varying float vFogDepth;',
    'void main(){',
    ' vP=position;',
    ' vec4 mv=modelViewMatrix*vec4(position,1.0);vFogDepth=-mv.z;',
    ' gl_Position=projectionMatrix*mv;',
    ' #include <logdepthbuf_vertex>',
    '}'
  ].join('\n');
  const FS=[
    '#include <common>',
    '#include <logdepthbuf_pars_fragment>',
    'uniform vec3 uCam;uniform float uTime;uniform float uOpacity;uniform float uSeme;uniform float uNotte;',
    'uniform vec3 fogColor;uniform float fogNear;uniform float fogFar;',
    'varying vec3 vP;varying float vFogDepth;',
    'float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}',
    'float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
    ' return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),',
    '            mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}',
    // densita\' del vapore nel punto p (metri, caccia di 15 m)
    'float densita(vec3 p,out float su){',
    ' float r=length(p.xy);',
    ' float d=(0.9-0.12*r)-p.z;',                       // distanza dietro il fronte d'urto (leggermente conico)
    ' if(d<0.0){su=0.0;return 0.0;}',
    ' float R=3.1+0.36*d-0.012*d*d;',                   // raggio della nuvola: 3,1 m al fronte, 5 m in coda
    ' float u=r/R;su=p.y/R;',
    ' float bordo=1.0-smoothstep(0.78,1.0,u);',
    ' float cavo=0.25+0.75*smoothstep(0.08,0.45,u);',   // piu\' rada sull\'asse, dove sta l\'aereo
    ' float fronte=smoothstep(0.0,0.12,d)*exp(-d/4.6)*(1.0-smoothstep(6.0,9.6,d));',
    ' vec3 q=p*0.95+vec3(uSeme,0.0,uTime*6.5);',        // sbuffi che scorrono verso la coda
    ' float n=0.65*n3(q)+0.35*n3(q*2.3+7.1);',
    ' float sfr=smoothstep(0.22+0.07*d,0.8,n);',       // verso la coda resta solo qualche sbuffo
    ' return bordo*cavo*fronte*mix(1.0,0.12+1.05*sfr,smoothstep(0.4,3.2,d));',   // netto e uniforme al fronte, sfrangiato dietro
    '}',
    'void main(){',
    ' #include <logdepthbuf_fragment>',
    ' vec3 o=uCam,dir=normalize(vP-uCam);',
    // ingresso e uscita del raggio nel cilindro contenitore
    ' vec2 oo=o.xy/'+RB.toFixed(2)+',dd=dir.xy/'+RB.toFixed(2)+';',
    ' float a=dot(dd,dd),b=2.0*dot(oo,dd),c=dot(oo,oo)-1.0,t0=0.0,t1=1.0e6;',
    ' if(a>1.0e-8){float D=b*b-4.0*a*c;if(D<=0.0)discard;float sD=sqrt(D);t0=(-b-sD)/(2.0*a);t1=(-b+sD)/(2.0*a);}else if(c>0.0)discard;',
    ' if(abs(dir.z)>1.0e-6){float za=('+Z0.toFixed(2)+'-o.z)/dir.z,zb=('+Z1.toFixed(2)+'-o.z)/dir.z;t0=max(t0,min(za,zb));t1=min(t1,max(za,zb));}',
    ' t0=max(t0,0.0);if(t1<=t0)discard;',
    ' float ds=(t1-t0)/float(PASSI),t=t0+ds*fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);',
    ' float tau=0.0,luce=0.0;',
    ' for(int i=0;i<PASSI;i++){float su;float k=densita(o+dir*t,su);tau+=k*ds;luce+=k*ds*(0.78+0.22*clamp(su,-1.0,1.0));t+=ds;}',
    ' float alfa=1.0-exp(-tau*1.05*uOpacity);',
    ' if(alfa<0.003)discard;',
    // bianco al sole sopra, ombra azzurrina sotto; di notte grigio scuro
    ' float l=luce/max(tau,1.0e-4);',
    ' vec3 col=mix(vec3(0.72,0.78,0.87),vec3(1.0),clamp((l-0.56)/0.44,0.0,1.0))*mix(1.0,0.22,uNotte);',
    ' float nebbia=smoothstep(fogNear,fogFar,vFogDepth);',
    ' alfa*=1.0-nebbia;',
    // prima tono e sRGB sul colore, poi la premoltiplicazione: altrimenti le zone quasi trasparenti si schiariscono
    ' gl_FragColor=vec4(col,1.0);',
    ' #include <tonemapping_fragment>',
    ' #include <encodings_fragment>',
    ' gl_FragColor=vec4(gl_FragColor.rgb*alfa,alfa);',
    '}'
  ].join('\n');
  function notteDa(scene){
    const bg=scene&&scene.background;if(!bg||!bg.isColor)return 0;
    const l=.2126*bg.r+.7152*bg.g+.0722*bg.b;return 1-clamp((l-.05)/.19,0,1);
  }
  const _m=new T.Matrix4();
  function make(root){
    const group=new T.Group();group.name="TRANSIENT_CONDENSATION";root.add(group);
    // premoltiplicato: il vapore copre lo sfondo quanto e' denso
    const material=new T.ShaderMaterial({
      transparent:true,depthWrite:false,depthTest:true,side:T.BackSide,fog:true,
      blending:T.CustomBlending,blendEquation:T.AddEquation,blendSrc:T.OneFactor,blendDst:T.OneMinusSrcAlphaFactor,
      defines:{PASSI:passi()},
      uniforms:{uCam:{value:new T.Vector3()},uTime:{value:0},uOpacity:{value:0},uSeme:{value:Math.random()*40},uNotte:{value:0},
        fogColor:{value:new T.Color(0)},fogNear:{value:1e7},fogFar:{value:2e7},fogDensity:{value:0}},
      vertexShader:VS,fragmentShader:FS
    });
    const mesh=new T.Mesh(geometria(),material);mesh.name="cono_vapore";mesh.renderOrder=4;mesh.raycast=()=>{};
    // la camera nello spazio della nuvola, a ogni passata di disegno (vista principale, pod, ...)
    mesh.onBeforeRender=(renderer,scene,camera)=>{
      _m.copy(group.matrixWorld).invert();
      material.uniforms.uCam.value.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(_m);
      material.uniforms.uNotte.value=notteDa(scene);material.uniformsNeedUpdate=true;
    };
    group.add(mesh);
    group.visible=false;
    let recent=0;
    function update(pos,quat,mach,humidity,t,size){
      if(!pos||!quat){group.visible=false;return;}
      // transonico: massimo appena sotto Mach 1, sparisce in pieno supersonico
      const picco=Math.exp(-Math.pow((mach-.995)/.05,2));
      // aria secca: solo un velo; aria umida (default 68%): nuvola piena
      const umido=clamp((humidity-.35)/.35,.18,1);
      const target=picco*umido;
      recent+=(target-recent)*(target>recent?.22:.1);
      group.visible=recent>.02;
      group.position.copy(pos);
      group.quaternion.copy(quat);
      group.scale.setScalar(clamp(size||1,.35,3));
      material.uniforms.uTime.value=(t||0)%1000;
      material.uniforms.uOpacity.value=recent;
    }
    function dispose(){root.remove(group);material.dispose();}
    return {update,dispose};
  }
  // bang a "N": due impulsi (onda d'urto di prua e di coda) a 0,19 s, con coda di rimbombo
  function boom(ctx,output,gain){
    if(!ctx||!output)return;
    const duration=1.55,rate=ctx.sampleRate;
    const n=Math.floor(duration*rate),buffer=ctx.createBuffer(1,n,rate);
    const v=buffer.getChannelData(0);
    let seed=1845769,noise=0;
    function impulse(t){
      if(t<0)return 0;
      if(t<.008)return Math.sin(t/.008*PI/2);
      if(t<.055)return 1-1.7*(t-.008)/.047;
      if(t<.11)return -.7*(1-(t-.055)/.055);
      return .28*Math.exp(-(t-.11)*7)*Math.sin((t-.11)*2*PI*29);
    }
    for(let i=0;i<n;i++){
      const t=i/rate;
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      noise+=((seed/4294967296*2-1)-noise)*.08;
      const p=impulse(t)*.65+impulse(t-.19)*.50;
      const tail=t>.03?Math.exp(-t*4)*noise*.35:0;
      v[i]=clamp((p+tail)*.62,-1,1);
    }
    const src=ctx.createBufferSource();src.buffer=buffer;
    const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=1700;
    const g=ctx.createGain();const t0=ctx.currentTime;
    g.gain.setValueAtTime(Math.min(.5,Math.max(.03,gain||.22)),t0);
    g.gain.exponentialRampToValueAtTime(.001,t0+duration);
    src.connect(low);low.connect(g);g.connect(output);
    src.start(t0);src.stop(t0+duration+.02);
    src.onended=()=>{src.disconnect();low.disconnect();g.disconnect();};
  }
  window.CENTURION_SONIC=Object.freeze({make,boom});
})();
