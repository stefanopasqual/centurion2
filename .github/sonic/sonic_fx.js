/* CENTURION 2 | Transonic condensation and sonic boom (cinematic simulation).
 * Vapor cone occurs only in humid air near Mach 1, not at all supersonic speeds.
 * Actual shock fronts are not visible; boom is heard by an observer, not pilot.
 */
(function(){
  'use strict';
  if(window.CENTURION_SONIC)return;
  const T=window.THREE;
  if(!T)return;
  const PI=Math.PI,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function make(root){
    const group=new T.Group();group.name="TRANSIENT_CONDENSATION";root.add(group);
    const material=new T.ShaderMaterial({
      transparent:true,depthWrite:false,side:T.DoubleSide,
      blending:T.NormalBlending,
      uniforms:{uTime:{value:0},uOpacity:{value:0}},
      vertexShader:[
        'varying vec2 vUv;',
        'void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}'
      ].join('\n'),
      fragmentShader:[
        'uniform float uTime;uniform float uOpacity;',
        'varying vec2 vUv;',
        'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
        'void main(){',
        'float p=clamp(vUv.y,0.0,1.0);',
        'float rim=smoothstep(0.03,.15,p)*(1.0-smoothstep(.69,1.0,p));',
        'float streak=mix(.78,1.,hash(floor(vec2(vUv.x*22.,uTime*14.))));',
        'float feather=smoothstep(.04,.2,vUv.x)*(1.-smoothstep(.8,.98,vUv.x));',
        'float a=uOpacity*rim*feather*streak*.55;',
        'gl_FragColor=vec4(vec3(.83,.91,.96),a);',
        '}'
      ].join('\n')
    });
    const geo=new T.CylinderGeometry(.32,1.15,1,32,1,true);
    geo.rotateX(PI/2);
    const mesh=new T.Mesh(geo,material);mesh.position.z=-.5;mesh.scale.set(8.5,8.5,15);group.add(mesh);
    group.visible=false;
    let recent=0;
    function update(pos,quat,mach,humidity,t,size){
      if(!pos||!quat){group.visible=false;return;}
      const peaked=Math.exp(-Math.pow((mach-1.015)/.073,2));
      const humid=clamp((humidity-.50)/.30,0,1);
      const target=peaked*humid;
      recent+=(target-recent)*.16;
      group.visible=recent>.025;
      group.position.copy(pos);
      group.quaternion.copy(quat);
      const s=clamp(size||1,.35,3);
      mesh.scale.set(8.5*s,8.5*s,15*s);
      material.uniforms.uTime.value=t||0;
      material.uniforms.uOpacity.value=recent;
    }
    function dispose(){root.remove(group);geo.dispose();material.dispose();}
    return {update,dispose};
  }
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