/* CENTURION2 rotorcraft flight model: calibrated gameplay approximation.
 * Body +X left, +Y up, +Z nose; world +Y up; units SI.
 * Collective adjusts rotor blade pitch/thrust, cyclic tilts the aircraft,
 * pedals command yaw. No flight-test or certification claim.
 */
(function(root,factory){
  'use strict';
  const dep=root.CENTURION_FDM6 ||
    (typeof module==='object'&&module.exports?require('../aero/fdm6.js'):null);
  const api=factory(dep);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CENTURION_HELI_FDM=api;
})(typeof window!=='undefined'?window:globalThis,function(FDM){
  'use strict';
  if(!FDM)throw Error('CENTURION_FDM6 dependency missing');
  const G=9.80665,PI=Math.PI,cl=(x,a,b)=>Math.max(a,Math.min(b,x));
  const add=(a,b)=>a.map((v,i)=>v+b[i]);
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const mul=(a,k)=>a.map(v=>v*k);
  const dot=FDM.dot,rot=FDM.rotate;
  function create(spec,initial={}){
    return {
      spec,
      r:(initial.r||[0,100,0]).slice(),
      v:(initial.v||[0,0,0]).slice(),
      q:FDM.qNorm(initial.q||[0,0,0,1]),
      w:(initial.w||[0,0,0]).slice(),
      collective:Number(initial.collective??spec.collectiveHover??.64),
      rpm:Number(initial.rpm??1),
      rotorPhase:0,tailPhase:0,
      fuel:initial.fuel==null?Number(spec.fuel)||1650:Number(initial.fuel),
      time:0,last:null,mass:Number(spec.m)||9500
    };
  }
  function integrate(s,h,input,env){
    const spec=s.spec||{};
    const mass=Math.max(100,Number(env.mass)||Number(spec.m)||9500);
    const rho=cl(Number(env.rho)||1.225,.18,1.4);
    const ground=Number.isFinite(env.ground)?env.ground:0;
    const agl=Math.max(0,s.r[1]-ground);
    const cmd=cl(Number(input.collective??input.throttle??.64),0,1);
    const cyclicX=cl(Number(input.roll)||0,-1,1);
    const cyclicY=cl(Number(input.pitch)||0,-1,1);
    const pedal=cl(Number(input.rudder)||0,-1,1);
    // Turboshaft/governor inertia. Rotor RPM is separate from collective.
    s.collective+=(cmd-s.collective)*(1-Math.exp(-h/.75));
    const engineOn=s.fuel>0;
    const governor=engineOn?cl(1-.055*Math.max(0,s.collective-.64)/.36,.94,1):0;
    s.rpm+=(governor-s.rpm)*(1-Math.exp(-h/(engineOn?1.0:5.5)));
    // UH-60 has SAS, not position hold: cyclic commands pitch/roll rates
    // with weak attitude damping and actual angular inertia.
    // Positive longitudinal stick = nose UP = negative body X.
    const up=rot(s.q,[0,1,0]);
    const demand=[
      cl(-cyclicY*.53-up[2]*.44,-.72,.72),
      cl(-pedal*.55-.085*(s.collective-(spec.collectiveHover??.64)),-.75,.75),
      cl(cyclicX*.53+up[0]*.44,-.72,.72)
    ];
    const inertia=FDM.inertia({icona:'uh60',S:201,span:16.36,length:19.76,height:5.13},mass);
    const gyro=FDM.angularAccel(inertia,s.w,[0,0,0]);
    const gain=[2.8,2.0,2.8];
    const torque=[
      inertia.ix*((demand[0]-s.w[0])*gain[0]-gyro[0]),
      inertia.iy*((demand[1]-s.w[1])*gain[1]-gyro[1]),
      inertia.iz*((demand[2]-s.w[2])*gain[2]-gyro[2])
    ];
    const ang=FDM.angularAccel(inertia,s.w,torque);
    const oldW=s.w.slice();
    s.w=s.w.map((w,i)=>cl(w+ang[i]*h,-1.15,1.15));
    s.q=FDM.advanceQ(s.q,mul(add(oldW,s.w),.5),h);
    // Rotor disk and momentum-theory power ceiling, independent of mass.
    const relative=sub(s.v,env.windWorld||[0,0,0]);
    const horizontal=Math.hypot(relative[0],relative[2]);
    const etl=1+.10*cl((horizontal-7)/20,0,1);
    const ge=1+.12*Math.exp(-agl/4.5);
    const densityFactor=Math.pow(rho/1.225,.45);
    const radius=Number(spec.rotorRadius)||8.18,disk=PI*radius*radius;
    const seaThrust=Number(spec.maxRotorThrust)||
      (Number(spec.m)||9500)*G/(Number(spec.collectiveHover)||.64);
    const requested=seaThrust*s.collective*densityFactor*etl*ge*s.rpm*s.rpm;
    const power=(Number(spec.shaftPower)||3.15e6)*Math.pow(rho/1.225,.65);
    const efficiency=Number(spec.rotorEfficiency)||.74;
    const available=engineOn?power*s.rpm:0;
    const powerThrust=Math.pow(2*rho*disk*Math.pow(available*efficiency,2),1/3);
    // Advancing/retreating-blade effects limit high-speed lift.
    const highSpeed=1-.28*cl((horizontal-65)/35,0,1);
    const sink=Math.max(0,-relative[1]);
    const vrs=.26*cl((sink-4)/6,0,1)*(1-cl(horizontal/12,0,1));
    const rotorLift=Math.max(0,Math.min(requested,powerThrust*etl)*highSpeed*(1-vrs));
    const rotor=rot(s.q,[0,rotorLift,0]);
    // Quadratic parasite drag in body axes, including lateral slip.
    const local=FDM.inverse(s.q,relative),cdA=[5.3,4.4,6.5];
    const drag=rot(s.q,local.map((v,i)=>-.5*rho*cdA[i]*v*Math.abs(v)));
    const force=add(rotor,drag);
    const acceleration=add(mul(force,1/mass),[0,-G,0]);
    const oldV=s.v.slice();
    s.v=add(s.v,mul(acceleration,h));
    s.r=add(s.r,mul(add(oldV,s.v),.5*h));
    const gear=Number(spec.gearHeight)||1.85;
    let onGround=false,hardLanding=false;
    if(s.r[1]<=ground+gear){
      hardLanding=s.v[1]<-5.5;
      s.r[1]=ground+gear;
      s.v[1]=Math.max(0,s.v[1]);
      onGround=true;
      const friction=(env.brake?.40:.085)*G*h;
      for(const i of [0,2])s.v[i]=Math.sign(s.v[i])*Math.max(0,Math.abs(s.v[i])-friction);
      if(Math.hypot(s.v[0],s.v[2])<1&&s.collective<.45)s.w=s.w.map(w=>w*.98);
    }
    s.fuel=Math.max(0,s.fuel-h*(engineOn?.10+.35*Math.pow(s.collective,1.6):0)*s.rpm);
    s.rotorPhase=(s.rotorPhase+h*27.0*s.rpm)%(2*PI);
    s.tailPhase=(s.tailPhase+h*135*s.rpm)%(2*PI);
    s.time+=h;
    const speed=Math.hypot(...relative);
    const upNew=rot(s.q,[0,1,0]);
    s.last={r:s.r.slice(),v:s.v.slice(),q:s.q.slice(),w:s.w.slice(),
      acceleration,forceWorld:force,rotorLift,collective:s.collective,
      rotorRPM:s.rpm,rotorPhase:s.rotorPhase,tailPhase:s.tailPhase,
      onGround,hardLanding,mach:speed/340.3,qbar:.5*rho*speed*speed,
      nz:dot(force,upNew)/(mass*G),agl:Math.max(0,s.r[1]-ground),fuel:s.fuel};
  }
  function step(s,dt,input={},env={}){
    if(!Number.isFinite(dt)||dt<=0)return s.last;
    // Frame-rate independence: advance all elapsed time, never drop 30-fps frames.
    const total=cl(dt,0,.10),n=Math.max(1,Math.ceil(total/(1/120)));
    const h=total/n;
    for(let i=0;i<n;i++)integrate(s,h,input,env);
    return s.last;
  }
  return Object.freeze({version:'uh60-6dof-2',create,step});
});
