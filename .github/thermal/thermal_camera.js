/* CENTURION 2 — UAV thermal EO camera, simulated.
 * This is an artistic intensity/contrast model from visible-light scene pixels,
 * not a physically calibrated long-wave infrared sensor, true surface
 * temperatures, detection probability or tracking equipment.
 * GPU postprocessing; keeps the original HUD canvas separate.
 */
(function () {
  'use strict';
  if (window.CENTURION_THERMAL) return;
  const T = window.THREE;
  if (!T) return;

  const VERT = [
    'varying vec2 vUv;',
    'void main(){vUv=uv; gl_Position=vec4(position.xy,0.0,1.0);}'
  ].join('\n');
  const FRAG = [
    'uniform sampler2D tScene;',
    'uniform float uPolarity;',
    'uniform float uNight;',
    'uniform float uTick;',
    'uniform vec2 uResolution;',
    'varying vec2 vUv;',
    'float rnd(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}',
    'void main(){',
    '  vec3 c=texture2D(tScene,vUv).rgb;',
    '  float l=dot(c,vec3(.299,.587,.114));',
    '  float warm=max(0.0,c.r-max(c.g,c.b))*.26;',
    '  float v=pow(clamp(l,0.0,1.0),uNight>0.5?.41:.64);',
    '  v=clamp((v-.08)*1.24+warm,0.0,1.0);',
    '  v=smoothstep(.03,.96,v);',
    '  float grain=(rnd(floor(vUv*uResolution*.58)+vec2(floor(uTick*15.0),13.0))-.5)*.027;',
    '  v=clamp(v+grain,0.0,1.0);',
    '  if(uPolarity>1.5)v=1.0-v;',
    '  float vign=1.0-.19*smoothstep(.53,1.25,length((vUv-.5)*vec2(1.6,1.05)));',
    '  v=clamp(v*vign,0.0,1.0);',
    '  gl_FragColor=vec4(vec3(v),1.0);',
    '}'
  ].join('\n');

  function create(renderer) {
    if(!renderer || !renderer.setRenderTarget) return null;
    const isMobile = matchMedia('(pointer:coarse)').matches || innerWidth < 900;
    const mem = navigator.deviceMemory || 4;
    const maxEdge = isMobile ? (mem<=2?840:mem>=6?1440:1100) : 1920;
    const tex = new T.WebGLRenderTarget(64,64,{
      depthBuffer:true,stencilBuffer:false,
      format:T.RGBAFormat,minFilter:T.LinearFilter,magFilter:T.LinearFilter
    });
    tex.texture.generateMipmaps=false;
    const mat = new T.ShaderMaterial({
      uniforms:{
        tScene:{value:tex.texture},
        uPolarity:{value:1},
        uNight:{value:1},
        uTick:{value:0},
        uResolution:{value:new T.Vector2(64,64)}
      },
      vertexShader:VERT,fragmentShader:FRAG,
      depthTest:false,depthWrite:false,toneMapped:false,fog:false
    });
    const plane = new T.PlaneGeometry(2,2);
    const screen = new T.Mesh(plane,mat);
    screen.frustumCulled=false;
    const post=new T.Scene();post.add(screen);
    const ortho=new T.OrthographicCamera(-1,1,1,-1,0,1);
    let closed=false,w=0,h=0;
    function render(scene,camera,mode,night) {
      if(closed || !mode) return renderer.render(scene,camera);
      const cv=renderer.domElement;
      const cw=Math.max(16,cv.width||innerWidth);
      const ch=Math.max(16,cv.height||innerHeight);
      const ratio=Math.min(1,maxEdge/Math.max(cw,ch));
      const tw=Math.max(32,Math.floor(cw*ratio)),th=Math.max(32,Math.floor(ch*ratio));
      if(w!==tw||h!==th){
        tex.setSize(tw,th);w=tw;h=th;mat.uniforms.uResolution.value.set(tw,th);
      }
      mat.uniforms.uPolarity.value=mode===2?2:1;
      mat.uniforms.uNight.value=night?1:0;
      mat.uniforms.uTick.value=performance.now()*.001;
      const prev=renderer.getRenderTarget();
      const prevAuto=renderer.autoClear;
      try {
        renderer.autoClear=true;
        renderer.setRenderTarget(tex);
        renderer.clear(true,true,true);
        renderer.render(scene,camera);
        renderer.setRenderTarget(prev);
        renderer.render(post,ortho);
      } finally {
        renderer.setRenderTarget(prev);
        renderer.autoClear=prevAuto;
      }
    }
    function dispose(){
      if(closed)return;closed=true;
      tex.dispose();mat.dispose();plane.dispose();
    }
    return {render,dispose};
  }

  function overlay(ctx,width,height,mode,title) {
    if(!ctx||!mode)return;
    const w=width,h=height,scale=Math.max(.78,Math.min(1.25,h/650));
    const col=mode===2?'#101010':'#f0f0f0',shadow=mode===2?'#efefef':'#121212';
    const cx=w*.5,cy=h*.5,rr=26*scale;
    ctx.save();ctx.lineWidth=Math.max(1,1.45*scale);ctx.strokeStyle=col;ctx.fillStyle=col;
    ctx.shadowColor=shadow;ctx.shadowBlur=3;
    ctx.beginPath();
    ctx.moveTo(cx-rr*2,cy);ctx.lineTo(cx-rr*.52,cy);
    ctx.moveTo(cx+rr*.52,cy);ctx.lineTo(cx+rr*2,cy);
    ctx.moveTo(cx,cy-rr*1.8);ctx.lineTo(cx,cy-rr*.46);
    ctx.moveTo(cx,cy+rr*.46);ctx.lineTo(cx,cy+rr*1.8);
    ctx.arc(cx,cy,rr*.27,0,Math.PI*2);ctx.stroke();
    ctx.font='bold '+Math.round(12*scale)+'px monospace';
    ctx.textAlign='left';
    ctx.fillText('EO/IR · '+(mode===2?'BLACK HOT':'WHITE HOT'),16*scale,31*scale);
    ctx.font=Math.round(10*scale)+'px monospace';
    ctx.fillText('SIMULATED / NON CALIBRATED',16*scale,49*scale);
    ctx.textAlign='right';
    ctx.fillText(title||'UAV SENSOR',w-16*scale,31*scale);
    ctx.fillText('GAIN AUTO · 1.0x',w-16*scale,49*scale);
    ctx.restore();
  }

  window.CENTURION_THERMAL=Object.freeze({create,overlay});
})();