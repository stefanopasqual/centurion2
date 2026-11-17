/* CENTURION2 | Aerodynamics coefficient library, version 2.
 *
 * Model scope: point-mass translational flight dynamics with an attitude
 * controller. This is NOT a validated 6-DOF model. Public aircraft geometric
 * envelopes and coefficient ranges are approximate, not flight-test tables.
 *
 * Reference equations:
 * - NASA Glenn: L=q*S*CL, D=q*S*CD, q=.5*rho*V^2
 *   https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-equation/
 * - NASA Glenn: CDi=CL^2/(pi*AR*e), AR=b^2/S
 *   https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/induced-drag-coefficient/
 * - JSBSim forces-and-moments manual explains requirements for full 6-DOF.
 *   https://jsbsim-team.github.io/jsbsim-reference-manual/user/concepts/forces-and-moments/
 */
(function(root,factory){
  'use strict';
  const model=factory();
  if(typeof module==='object'&&module.exports)module.exports=model;
  root.CENTURION_AERO=model;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const PI=Math.PI,GRAVITY=9.80665,RHO0=1.225;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
  // Approximate external geometry only. Coefficient calibration unavailable.
  // Profiles are not exact aircraft-specific CFD or wind-tunnel tables.
  const PROFILES=Object.freeze({
    f16:{span:9.96,criticalMach:.89,waveRise:.092,oswald:.79},
    f15:{span:13.05,criticalMach:.89,waveRise:.099,oswald:.78},
    typhoon:{span:10.95,criticalMach:.91,waveRise:.082,oswald:.70},
    f22:{span:13.56,criticalMach:.91,waveRise:.077,oswald:.72},
    su35:{span:15.30,criticalMach:.89,waveRise:.097,oswald:.78},
    su57:{span:14.0,criticalMach:.91,waveRise:.077,oswald:.75},
    ea18:{span:13.60,criticalMach:.86,waveRise:.094,oswald:.80},
    kc30:{span:60.30,criticalMach:.76,waveRise:.130,oswald:.82},
    e7:{span:35.80,criticalMach:.73,waveRise:.138,oswald:.81},
    'uav-fixed':{span:8.50,criticalMach:.61,waveRise:.025,oswald:.82},
    geran2:{span:2.50,criticalMach:.53,waveRise:.015,oswald:.68}
  });
  function profile(spec){
    const base=PROFILES[String(spec.icona||'').toLowerCase()];
    const span=Number(spec.span||base?.span||Math.sqrt(spec.S*4));
    const area=Number(spec.S);
    const aspectRatio=clamp(span*span/Math.max(0.1,area),1.3,18);
    const oswald=clamp(Number(spec.oswald||base?.oswald||.76),.55,.98);
    // A.k is legacy tuning. Prefer geometry-derived theoretical induced drag,
    // but keep opt-in to a future measured table with kMeasured.
    const kInduced=Number.isFinite(spec.kMeasured)?spec.kMeasured:
      1/(PI*aspectRatio*oswald);
    return {span,area,aspectRatio,oswald,kInduced,
      criticalMach:Number(spec.criticalMach||base?.criticalMach||.84),
      waveRise:Number(spec.waveRise||base?.waveRise||.09)};
  }
  function isa(h){
    const alt=clamp(Number(h)||0,0,30000);
    if(alt<=11000){
      const temp=288.15-.0065*alt;
      return {temp,rho:RHO0*Math.pow(temp/288.15,4.2558797),
        soundSpeed:Math.sqrt(1.4*287.05*temp)};
    }
    const temp=216.65;
    return {temp,rho:.363918*Math.exp(-(alt-11000)/6341.62),
      soundSpeed:Math.sqrt(1.4*287.05*temp)};
  }
  function coefficients(spec,state){
    const geometry=profile(spec);
    const alpha=clamp(Number(state.alpha)||0,-1.5,1.5);
    const beta=clamp(Number(state.beta)||0,-.95,.95);
    const mach=clamp(Number(state.mach)||0,0,4);
    const qbar=Math.max(0,Number(state.qbar)||0);
    const agl=Math.max(0,Number(state.agl)||0);
    const flap=state.gear?.23:0;
    // A mild lift-slope rise in subsonic flow and loss beyond drag divergence.
    // Swept wings vary substantially: kept bounded without tabular data.
    const liftSlope=Math.max(.2,Number(spec.cla)||3.2)
      *(1+.20*smooth(.25,.80,mach))*(1-.27*smooth(.92,1.4,mach));
    const stallAlpha=Math.max(.16,(Number(spec.astall)||27)*PI/180
      -.045*smooth(.75,1.3,mach));
    const magnitude=Math.abs(alpha),sign=Math.sign(alpha);
    const preStall=liftSlope*alpha+flap;
    const clPeak=Math.max(.65,liftSlope*stallAlpha*.93);
    const attached=clamp(preStall,-clPeak,clPeak);
    const lostLift=sign*clPeak*(.38+.62*Math.exp(-3.8*Math.max(0,magnitude-stallAlpha)));
    const stallBlend=smooth(stallAlpha-.035,stallAlpha+.15,magnitude);
    const CL=attached*(1-stallBlend)+lostLift*stallBlend;
    // High aspect ratio jets and transports have different ground effect.
    const hOverB=agl/geometry.span;
    const groundFactor=1-.32/(1+16*hOverB*hOverB);
    const induced=geometry.kInduced*CL*CL*groundFactor;
    // Localized drag rise; positive supersonic residual. This is only a
    // phenomenological model, not validated transonic wave drag.
    const center=geometry.criticalMach+.13;
    const rise=geometry.waveRise*Math.exp(-Math.pow((mach-center)/.19,2));
    const residual=(geometry.waveRise*.25)*smooth(center,center+.48,mach);
    const wave=rise+residual;
    const separation=.25*Math.pow(smooth(stallAlpha-.02,stallAlpha+.21,magnitude),2);
    const CD=Math.max(.001,Number(spec.cd0)||.02)+induced+wave+separation
      +(state.gear?.035:0)+(state.brake?.065:0)+.18*beta*beta;
    const CY=-.68*beta;
    return {CL,CD,CY,liftSlope,stallBlend,stalled:stallBlend>.5,
      induced,wave,separation,groundFactor,geometry,qbar,
      liftN:qbar*geometry.area*CL,dragN:qbar*geometry.area*CD};
  }
  function engine(spec,at,mach,spool,afterburner){
    const m=clamp(Number(mach)||0,0,4);
    const rho=clamp(Number(at.rho)||RHO0,0,RHO0*1.2);
    const ratio=rho/RHO0;
    const ram=1+.08*smooth(.15,1.6,m);
    const inletLoss=1-.18*smooth(1.15,2.4,m);
    const lapse=Math.pow(ratio,.72)*ram*inletLoss;
    const mThrust=Math.max(0,Number(spec.Tmil)||0)*clamp(spool,0,1);
    const abThrust=Math.max(0,Number(spec.Tab||spec.Tmil)||0)-
      Math.max(0,Number(spec.Tmil)||0);
    const thrust=(mThrust+abThrust*clamp(afterburner,0,1))*lapse;
    return {thrust:Math.max(0,thrust),lapse};
  }
  function sample(spec,state){
    const at=isa(state.alt||0);
    const v=Math.max(0,Number(state.speed)||0);
    const mach=v/at.soundSpeed;
    const qbar=.5*at.rho*v*v;
    const coeffs=coefficients(spec,{alpha:state.alpha||0,beta:state.beta||0,
      mach,qbar,agl:state.agl||0,gear:!!state.gear,brake:!!state.brake});
    return {at,mach,qbar,...coeffs};
  }
  return Object.freeze({version:'aero-v2',GRAVITY,PROFILES,profile,isa,
    coefficients,engine,sample});
});