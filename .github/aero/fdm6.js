/* CENTURION 2 - six degrees of freedom rigid-body flight dynamics.
 * State: position world [x,y,z] m, velocity world m/s, attitude quaternion
 * [x,y,z,w] local -> world, angular velocity body [x,y,z] rad/s.
 * Local axes +X left, +Y up, +Z nose: right-handed coordinate frame.
 *
 * Governing mechanics:
 *   r_dot = v,   v_dot = R(q) F_body / m + g
 *   I omega_dot = M_body - omega x (I omega)
 *   q_dot = 0.5 q multiply [omega,0]  (body-fixed rotation)
 * Aerodynamics: F = qbar*S*[CL,CD,CY], M=qbar*S*[b,c].
 *
 * Fixed-wing airfoils / inertias / effectiveness are estimates for gameplay,
 * not flight-test-certified aircraft data or a validation of any specific jet.
 * Flat-Earth, rigid airframe, simplified engine / FBW / landing-gear models.
 */
(function(root,factory){
  'use strict';
  const obj=factory(root.CENTURION_AERO||(typeof module==='object'&&module.exports?require('./aero_core.js'):null));
  if(typeof module==='object'&&module.exports)module.exports=obj;
  root.CENTURION_FDM6=obj;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:this,function(AERO){
  'use strict';
  if(!AERO)throw Error('CENTURION_AERO must load before CENTURION_FDM6');
  const pi=Math.PI,g=AERO.GRAVITY,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const vec=(x=0,y=0,z=0)=>[x,y,z];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const scale=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
  const mag=a=>Math.hypot(a[0],a[1],a[2]);
  const unit=(a,otherwise)=>{const m=mag(a);return m>1e-8?scale(a,1/m):otherwise.slice();};
  const project=(ref,wind)=>unit(sub(ref,scale(wind,dot(ref,wind))),ref);
  function qNorm(q){const s=Math.hypot(...q);return s>1e-12?q.map(v=>v/s):[0,0,0,1];}
  function qMult(a,b){
    return [
      a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
      a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
      a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
      a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]
    ];
  }
  function rotate(q,v){
    // vec under a unit Hamilton quaternion
    const t=scale(cross(q.slice(0,3),v),2);
    return add(v,add(scale(t,q[3]),cross(q.slice(0,3),t)));
  }
  const inverse=(q,v)=>rotate([-q[0],-q[1],-q[2],q[3]],v);
  function advanceQ(q,omega,dt){
    const rate=mag(omega);
    if(rate<1e-12)return q.slice();
    const angle=rate*dt,half=angle*.5,si=Math.sin(half)/rate;
    return qNorm(qMult(q,[omega[0]*si,omega[1]*si,omega[2]*si,Math.cos(half)]));
  }
  const getGeometry=spec=>AERO.profile(spec);
  function inertia(spec,mass){
    const geo=getGeometry(spec),b=geo.span;
    const len=Number(spec.length)||b*(spec.nonArmato&&b>30?1.03:1.48);
    const h=Number(spec.height)||b*.29;
    // Triaxial non-spherical inertia approximation including a symmetric
    // vertical/longitudinal cross term (local body y/z).
    const ix=mass*(len*len+h*h)*.055;
    const iy=mass*(len*len+b*b)*.052;
    const iz=mass*(b*b+h*h)*.051;
    const iyz=.025*Math.sqrt(iy*iz);
    return {ix,iy,iz,iyz,det:iy*iz-iyz*iy};
  }
  function Iw(I,w){return [I.ix*w[0],I.iy*w[1]+I.iyz*w[2],I.iyz*w[1]+I.iz*w[2]];}
  function angularAccel(I,w,M){
    const gy=cross(w,Iw(I,w)),net=sub(M,gy);
    return [net[0]/I.ix,
      (I.iz*net[1]-I.iyz*net[2])/I.det,
      (I.iy*net[2]-I.iyz*net[1])/I.det];
  }
  function create(spec,initial){
    const source=initial||{};
    return {
      r:(source.r||[0,1500,0]).slice(),
      v:(source.v||[0,0,200]).slice(),
      q:qNorm(source.q||[0,0,0,1]),
      w:(source.w||[0,0,0]).slice(),
      actuator:{ail:0,elev:0,rud:0},
      rotor:[0,0,0,0],
      time:0,last:null,
      spec:spec||{}
    };
  }
  function atmosphere(state,wind){
    const airWorld=sub(state.v,wind||[0,0,0]);
    const vb=inverse(state.q,airWorld);
    const V=Math.max(.01,mag(vb)),hat=unit(vb,[0,0,1]);
    return {
      V,vb,hat,alpha:clamp(Math.atan2(-vb[1],vb[2]),-1.45,1.45),
      beta:clamp(Math.atan2(-vb[0],Math.max(.01,vb[2])),-.8,.8),
      isa:AERO.isa(state.r[1])
    };
  }
  function integrate(s,dt,forceWorld,moment,I,mass){
    const accel=add(scale(forceWorld,1/mass),[0,-g,0]);
    const wOld=s.w.slice();
    // Midpoint angular-rate update improves integration of inertial coupling.
    const aw0=angularAccel(I,s.w,moment);
    const wMid=add(s.w,scale(aw0,dt*.5));
    const awMid=angularAccel(I,wMid,moment);
    const wNew=add(s.w,scale(awMid,dt));
    // Physical angular rate can become large in departure, but must remain finite.
    const omegaCap=9;
    const magW=mag(wNew);
    s.w=magW>omegaCap?scale(wNew,omegaCap/magW):wNew;
    const wAvg=scale(add(wOld,s.w),.5);
    s.q=advanceQ(s.q,wAvg,dt);
    const oldV=s.v.slice();
    s.v=add(s.v,scale(accel,dt));
    s.r=add(s.r,scale(add(oldV,s.v),.5*dt));
    return accel;
  }
  function stepFixed(s,dt,command,environment){
    const input=command||{},env=environment||{},spec=s.spec;
    const mass=Math.max(.05,Number(env.mass)||spec.m||1000),I=inertia(spec,mass);
    const atm=atmosphere(s,env.windWorld),V=atm.V,at=atm.isa;
    const mach=V/at.soundSpeed,qbar=.5*at.rho*V*V;
    const aero=AERO.coefficients(spec,{alpha:atm.alpha,beta:atm.beta,
      mach,qbar,agl:env.agl==null?Math.max(0,s.r[1]):env.agl,
      gear:!!env.gear,brake:!!env.brake});
    const span=aero.geometry.span,chord=spec.chord||spec.S/span;
    const surfaceQ=qbar*spec.S,armPitch=surfaceQ*chord,armRoll=surfaceQ*span;
    const safeV=Math.max(25,V);
    const pitchRate=s.w[0]*chord/(2*safeV);
    const rollRate=s.w[2]*span/(2*safeV);
    const yawRate=s.w[1]*span/(2*safeV);
    const stabilizer=.28*atm.alpha-.63*pitchRate;
    const yawStabilizer=-.23*atm.beta-.72*yawRate;
    const rollStabilizer=-.28*rollRate+.045*atm.beta;

    // FBW virtual stick -> actuator deflections; aerodynamics create ALL torques.
    // No angular-rate assignment directly to attitude.
    const pitchSign=clamp(input.pitch||0,-1,1);
    const bankUp=rotate(s.q,[0,1,0]);
    const n0=bankUp[1]>.28?Math.min(2.8,1/Math.max(.28,bankUp[1])):.5;
    const targetG=clamp(n0+(pitchSign>=0?
      pitchSign*((spec.gmax||9)-n0):pitchSign*(n0+(spec.gneg||3))),
      -(spec.gneg||3),spec.gmax||9);
    const liftTarget=mass*g*targetG/Math.max(300,surfaceQ);
    const maxAoA=Math.min(.68,Math.max(.25,(spec.amax||30)*pi/180));
    const alphaTarget=clamp(liftTarget/Math.max(.25,aero.liftSlope),-.24,maxAoA);
    const pitchOmegaWanted=-clamp((alphaTarget-atm.alpha)*3.2,-.95,.95);
    const pitchMomentWanted=I.ix*clamp((pitchOmegaWanted-s.w[0])*3.1,-4.5,4.5);
    const elevTarget=clamp((armPitch*stabilizer-pitchMomentWanted)/
      Math.max(2,armPitch*.46),-1,1);
    const pmax=Math.min(3.5,(spec.pmax||170)*pi/180);
    const rollOmegaWanted=clamp(input.roll||0,-1,1)*pmax*
      clamp(qbar/9000,.12,1);
    const rollMomentWanted=I.iz*clamp((rollOmegaWanted-s.w[2])*4,-6,6);
    const ailTarget=clamp((rollMomentWanted-armRoll*rollStabilizer)/
      Math.max(3,armRoll*.135),-1,1);
    const right=rotate(s.q,[-1,0,0]);
    const bank=Math.atan2(-right[1],bankUp[1]);
    const turnWanted=-g*Math.tan(clamp(bank,-1.1,1.1))/Math.max(65,V);
    const yawOmegaWanted=clamp(turnWanted-clamp(input.rudder||0,-1,1)*.52,-.9,.9);
    const yawMomentWanted=I.iy*clamp((yawOmegaWanted-s.w[1])*2.8,-3,3);
    const rudTarget=clamp((armRoll*yawStabilizer-yawMomentWanted)/
      Math.max(3,armRoll*.20),-1,1);

    const response=1-Math.exp(-dt/Math.max(.07,spec.servoTau||.18));
    s.actuator.ail+=clamp(ailTarget-s.actuator.ail,-response,response);
    s.actuator.elev+=clamp(elevTarget-s.actuator.elev,-response,response);
    s.actuator.rud+=clamp(rudTarget-s.actuator.rud,-response,response);
    const eff=clamp(qbar/14000,.12,1)*(1-.65*aero.stallBlend)*
      (1-.18*Math.min(1,Math.max(0,mach-1)));
    const moments=[
      armPitch*(stabilizer-.46*s.actuator.elev*eff),
      armRoll*(yawStabilizer-.20*s.actuator.rud*eff+.018*s.actuator.ail),
      armRoll*(rollStabilizer+.135*s.actuator.ail*eff+.018*s.actuator.rud)
    ];

    // Full body-coordinate wind-axis aerodynamic force projection.
    // Lift follows the wing plane, not global "up" (inverted flight works).
    const liftDir=project([0,1,0],atm.hat);
    const sideDir=project([-1,0,0],atm.hat);
    const thrust=Math.max(0,Number(env.thrust)||0);
    const fBody=add(
      add(scale(liftDir,aero.liftN),scale(atm.hat,-aero.dragN)),
      add(scale(sideDir,surfaceQ*aero.CY),[0,0,thrust])
    );
    const fWorld=rotate(s.q,fBody);
    const nonGravAcc=scale(fWorld,1/mass);
    const nz=dot(nonGravAcc,bankUp)/g;
    const acceleration=integrate(s,dt,fWorld,moments,I,mass);
    s.time+=dt;
    s.last={
      mach,qbar,alpha:atm.alpha,beta:atm.beta,nz,
      forceBody:fBody,forceWorld:fWorld,momentBody:moments,
      acceleration,CL:aero.CL,CD:aero.CD,
      liftN:aero.liftN,dragN:aero.dragN,stalled:aero.stalled,
      targetG,alphaTarget,
      angularAcceleration:angularAccel(I,s.w,moments),
      surfaces:{...s.actuator},mass,I
    };
    return s.last;
  }
  function stepRotor(s,dt,command,environment){
    const input=command||{},env=environment||{},spec=s.spec;
    const mass=Math.max(.05,Number(env.mass)||spec.m||5);
    const I=inertia(spec,mass),atm=atmosphere(s,env.windWorld);
    const arm=Number(spec.arm)||.46;
    const throttle=clamp(Number(input.throttle)||0,0,1);
    const right=rotate(s.q,[-1,0,0]),up=rotate(s.q,[0,1,0]);
    const worldUpLocal=inverse(s.q,[0,1,0]);
    // Stabilized attitude (sensor-driven conceptual autopilot); differential
    // thrust remains the *only* torque actuator (no scripted rotation).
    const rollTarget=clamp(input.roll||0,-1,1)*.32;
    const pitchTarget=clamp(input.pitch||0,-1,1)*.32;
    const rollError=rollTarget-worldUpLocal[0];
    const pitchError=worldUpLocal[2]-pitchTarget;
    const yawWanted=-clamp(input.rudder||0,-1,1)*.65;
    const desiredMoment=[
      I.ix*(8*pitchError-4.6*s.w[0]),
      I.iy*(3*(yawWanted-s.w[1])),
      I.iz*(8*rollError-4.6*s.w[2])
    ];
    const base=mass*g*2*throttle/4,maxEach=mass*g*.9;
    const dRoll=clamp(desiredMoment[2]/Math.max(1e-4,4*arm*base),-.36,.36);
    const dPitch=clamp(-desiredMoment[0]/Math.max(1e-4,4*arm*base),-.36,.36);
    const dragCoef=.055;
    const dYaw=clamp(-desiredMoment[1]/Math.max(1e-4,4*base*dragCoef),-.23,.23);
    const k=1-Math.exp(-dt/.055);
    let thrustSum=0,torque=vec();
    const sites=[
      {x:arm,z:arm,spin:1},
      {x:-arm,z:arm,spin:-1},
      {x:arm,z:-arm,spin:-1},
      {x:-arm,z:-arm,spin:1}
    ];
    for(let i=0;i<4;i++){
      const p=sites[i];
      const goal=clamp(base*(1+dRoll*Math.sign(p.x)+dPitch*Math.sign(p.z)
        +dYaw*p.spin),0,maxEach);
      s.rotor[i]+=(goal-s.rotor[i])*k;
      const f=s.rotor[i];thrustSum+=f;
      torque[0]+=-p.z*f;torque[1]+=p.spin*dragCoef*f;torque[2]+=p.x*f;
    }
    const windLocal=atm.vb;
    const v=atm.V;
    const dragWorld=scale(rotate(s.q,windLocal),
      -.5*atm.isa.rho*.52*v);
    const fWorld=add(rotate(s.q,[0,thrustSum,0]),dragWorld);
    torque=sub(torque,scale(s.w,Math.max(.02,thrustSum*.012)));
    const nz=dot(scale(fWorld,1/mass),up)/g;
    const acceleration=integrate(s,dt,fWorld,torque,I,mass);
    s.time+=dt;
    s.last={mach:v/atm.isa.soundSpeed,qbar:.5*atm.isa.rho*v*v,
      alpha:0,beta:0,nz,CL:0,CD:0,stalled:false,
      forceWorld:fWorld,momentBody:torque,acceleration,
      rotors:s.rotor.slice(),mass,I};
    return s.last;
  }
  function step(s,dt,input,env){
    const h=clamp(Number(dt)||0,0,1/60);
    if(h===0)return s.last;
    return s.spec.drone==='quad'?stepRotor(s,h,input,env):stepFixed(s,h,input,env);
  }
  return Object.freeze({version:'6dof-v1',create,step,stepFixed,stepRotor,
    inertia,angularAccel,rotate,inverse,qMult,qNorm,advanceQ,atmosphere,
    cross,dot});
});