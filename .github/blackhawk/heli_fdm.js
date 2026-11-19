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
      time:0,last:null,mass:Number(spec.m)||9500,
      onGround:false,crashed:false,damage:null
    };
  }
  function integrate(s,h,input,env){
    const spec=s.spec||{};
    const mass=Math.max(100,Number(env.mass)||Number(spec.m)||9500);
    const rho=cl(Number(env.rho)||1.225,.18,1.4);
    const ground=Number.isFinite(env.ground)?env.ground:0;
    const agl=Math.max(0,s.r[1]-ground),gear=Number(spec.gearHeight)||1.85;
    const command=cl(Number(input.collective??input.throttle??.64),0,1);
    const cyclicX=cl(Number(input.roll)||0,-1,1);
    const cyclicY=cl(Number(input.pitch)||0,-1,1);
    const pedal=cl(Number(input.rudder)||0,-1,1);
    s.collective+=(command-s.collective)*(1-Math.exp(-h/.8));
    const relative=sub(s.v,env.windWorld||[0,0,0]);
    const horizontal=Math.hypot(relative[0],relative[2]);
    const sink=Math.max(0,-relative[1]);
    const engineOn=s.fuel>0;
    // Freewheeling rotor after engine failure: rotor energy persists and
    // descending airflow sustains a lower autorotative RPM.
    const idleAuto=cl(.37+.040*sink+.0025*horizontal,.37,.94);
    const governor=engineOn?cl(1-.055*Math.max(0,s.collective-.64)/.36,.94,1):idleAuto;
    s.rpm+=(governor-s.rpm)*(1-Math.exp(-h/(engineOn?1.1:5.0)));
    // Stabilization uses body-relative gravity, not world-up components.
    // Cyclic control remains consistent through large heading changes.
    const localUp=FDM.inverse(s.q,[0,1,0]);
    const demand=[
      cl(-cyclicY*.48+localUp[2]*.73,-.65,.65),
      cl(-pedal*.53-.09*(s.collective-(spec.collectiveHover??.64)),-.7,.7),
      cl(cyclicX*.48-localUp[0]*.73,-.65,.65)
    ];
    const inertia=FDM.inertia({icona:'uh60',S:201,span:16.36,length:19.76,height:5.13},mass);
    const gyro=FDM.angularAccel(inertia,s.w,[0,0,0]);
    const gain=[3.0,2.4,3.0];
    const torque=[
      inertia.ix*((demand[0]-s.w[0])*gain[0]-gyro[0]),
      inertia.iy*((demand[1]-s.w[1])*gain[1]-gyro[1]),
      inertia.iz*((demand[2]-s.w[2])*gain[2]-gyro[2])
    ];
    const ang=FDM.angularAccel(inertia,s.w,torque),oldW=s.w.slice();
    s.w=s.w.map((w,i)=>cl(w+ang[i]*h,-1.1,1.1));
    s.q=FDM.advanceQ(s.q,mul(add(oldW,s.w),.5),h);
    // Rotor disk and momentum-theory power ceiling, independent of mass.
    const etl=1+.10*cl((horizontal-7)/20,0,1);
    const ge=1+.12*Math.exp(-agl/4.5);
    const densityFactor=Math.pow(rho/1.225,.45);
    const radius=Number(spec.rotorRadius)||8.18,disk=PI*radius*radius;
    const seaThrust=Number(spec.maxRotorThrust)||
      (Number(spec.m)||9500)*G/(Number(spec.collectiveHover)||.64);
    const requested=seaThrust*s.collective*densityFactor*etl*ge*s.rpm*s.rpm;
    const power=(Number(spec.shaftPower)||3.15e6)*Math.pow(rho/1.225,.65);
    const efficiency=Number(spec.rotorEfficiency)||.74;
    const powerThrust=Math.pow(2*rho*disk*Math.pow(power*s.rpm*efficiency,2),1/3);
    // The unpowered rotor still generates lift while spinning, but cannot hover.
    const autoFactor=cl(.56+.24*cl(sink/12,0,1)+.08*cl(horizontal/30,0,1),.56,.88);
    const limit=engineOn?powerThrust:requested*autoFactor;
    const highSpeed=1-.45*cl((horizontal-68)/32,0,1);
    const vrs=.28*cl((sink-4)/6,0,1)*(1-cl(horizontal/12,0,1));
    const rotorLift=Math.max(0,Math.min(requested,limit)*highSpeed*(1-vrs));
    const rotor=rot(s.q,[0,rotorLift,0]);
    // Stronger parasitic drag prevents unphysical 130m/s acceleration.
    const local=FDM.inverse(s.q,relative),cdA=[11,4.4,10];
    const drag=rot(s.q,local.map((v,i)=>-.5*rho*cdA[i]*v*Math.abs(v)));
    const force=add(rotor,drag);
    const acceleration=add(mul(force,1/mass),[0,-G,0]);
    const oldV=s.v.slice();
    s.v=add(s.v,mul(acceleration,h));
    s.r=add(s.r,mul(add(oldV,s.v),.5*h));
    let onGround=false,hardLanding=false,unsafeLanding=false,impactSink=0,impactSpeed=0;
    const horizontalSpeed=Math.hypot(oldV[0],oldV[2]);
    if(s.r[1]<=ground+gear){
      onGround=true;
      impactSink=Math.max(0,-oldV[1]);impactSpeed=horizontalSpeed;
      const newTouch=!s.onGround||oldV[1]<-1;
      hardLanding=newTouch&&impactSink>5.5;
      unsafeLanding=horizontalSpeed>(newTouch?12:25);
      if(hardLanding||unsafeLanding){
        s.crashed=true;s.damage={hardLanding,unsafeLanding,impactSink,impactSpeed};
      }
      s.r[1]=ground+gear;
      s.v[1]=Math.max(0,s.v[1]);
      if(s.crashed){
        s.v=[0,0,0];s.w=[0,0,0];
      }else{
        const friction=(env.brake?.45:.16)*G*h;
        for(const i of [0,2])s.v[i]=Math.sign(s.v[i])*Math.max(0,Math.abs(s.v[i])-friction);
        if(horizontalSpeed<1&&s.collective<.45)s.w=s.w.map(w=>w*.98);
      }
    }
    s.onGround=onGround;
    s.fuel=Math.max(0,s.fuel-h*(engineOn?.10+.35*Math.pow(s.collective,1.6):0)*s.rpm);
    s.rotorPhase=(s.rotorPhase+h*27.0*s.rpm)%(2*PI);
    s.tailPhase=(s.tailPhase+h*135*s.rpm)%(2*PI);
    s.time+=h;
    const speed=Math.hypot(...relative);
    const upNew=rot(s.q,[0,1,0]);
    s.last={r:s.r.slice(),v:s.v.slice(),q:s.q.slice(),w:s.w.slice(),
      acceleration,forceWorld:force,rotorLift,collective:s.collective,
      rotorRPM:s.rpm,rotorPhase:s.rotorPhase,tailPhase:s.tailPhase,
      onGround,hardLanding,unsafeLanding,crashed:s.crashed,impactSink,impactSpeed,
      mach:speed/340.3,qbar:.5*rho*speed*speed,
      nz:dot(force,upNew)/(mass*G),agl:Math.max(0,s.r[1]-ground),fuel:s.fuel};
  }
  function step(s,dt,input={},env={}){
    if(!Number.isFinite(dt)||dt<=0)return s.last;
    // Preserve impact status across substeps and all of the current frame.
    const total=cl(dt,0,.1),n=Math.max(1,Math.ceil(total/(1/120))),h=total/n;
    let hard=false,unsafe=false,impactSink=0,impactSpeed=0;
    for(let i=0;i<n;i++){
      integrate(s,h,input,env);
      const out=s.last;
      hard=hard||out.hardLanding;unsafe=unsafe||out.unsafeLanding;
      impactSink=Math.max(impactSink,out.impactSink);
      impactSpeed=Math.max(impactSpeed,out.impactSpeed);
      if(s.crashed)break;
    }
    s.last.hardLanding=hard||!!s.damage?.hardLanding;
    s.last.unsafeLanding=unsafe||!!s.damage?.unsafeLanding;
    s.last.crashed=s.crashed;
    s.last.impactSink=impactSink||s.damage?.impactSink||0;
    s.last.impactSpeed=impactSpeed||s.damage?.impactSpeed||0;
    return s.last;
  }
  return Object.freeze({version:'uh60-6dof-3',create,step});
});
