/* CENTURION2 utility rotorcraft dynamics, standalone and testable.
 * Original approximate 6DOF force/moment model for a UH-60-class helicopter.
 * Not FAA-certified or derived from Sikorsky flight-test tables.
 * World: +Y up, body: +Z nose, +Y rotor thrust, +X left/right.
 */
(function(root,factory){
  'use strict';
  const api=factory(root.CENTURION_FDM6 || (typeof module==='object'&&module.exports?require('../aero/fdm6.js'):null));
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CENTURION_HELI_FDM=api;
})(typeof window!=='undefined'?window:globalThis,function(FDM){
  'use strict';
  if(!FDM)throw Error('CENTURION_FDM6 dependency missing');
  const g=9.80665,cl=(x,a,b)=>Math.max(a,Math.min(b,x)),PI=Math.PI;
  const vec=(x,y,z)=>[x,y,z],dot=FDM.dot;
  const add=(a,b)=>a.map((x,i)=>x+b[i]);
  const sub=(a,b)=>a.map((x,i)=>x-b[i]);
  const mul=(a,k)=>a.map(x=>x*k);
  const vlen=a=>Math.hypot(...a);
  const qrot=FDM.rotate;
  function create(spec,initial={}){
    const m=Number(spec.m)||9500;
    return {
      spec,
      r:(initial.r||[0,100,0]).slice(),v:(initial.v||[0,0,0]).slice(),
      q:FDM.qNorm(initial.q||[0,0,0,1]),
      w:(initial.w||[0,0,0]).slice(),
      collective:Number(initial.collective??spec.collectiveHover??.64),rpm:1,rotorPhase:0,tailPhase:0,
      fuel:initial.fuel==null?Number(spec.fuel)||1650:initial.fuel,
      time:0,last:null,mass:m
    };
  }
  function step(s,dt,input={},env={}){
    const h=cl(Number(dt)||0,0,1/60);
    if(!h)return s.last;
    const spec=s.spec||{},m=Math.max(100,Number(env.mass)||spec.m||9500);
    const density=cl(Number(env.rho)||1.225,.2,1.4);
    const ground=Number(env.ground)||0;
    const agl=Math.max(0,s.r[1]-ground);
    const cmdCollective=cl(Number(input.collective??input.throttle??.62),0,1);
    // Turboshaft response and governor. Throttle is mapped to collective:
    // hover is about 64% at sea level, rising with altitude/weight.
    s.collective+=(cmdCollective-s.collective)*(1-Math.exp(-h/1.25));
    const rpmTarget=s.fuel>0?1:0;
    s.rpm+=(rpmTarget-s.rpm)*(1-Math.exp(-h/(s.fuel>0?2.2:7)));
    const cyclicX=cl(Number(input.roll)||0,-1,1);
    const cyclicY=cl(Number(input.pitch)||0,-1,1);
    const pedal=cl(Number(input.rudder)||0,-1,1);
    const inertia=FDM.inertia({icona:'uh60',S:201,span:16.36,length:19.76,height:5.13},m);
    // Self-levelling stabilisation: stick sets target attitude, not position.
    const up=qrot(s.q,[0,1,0]);
    const targetRoll=-cyclicX*.32, targetPitch=cyclicY*.31;
    const rollErr=cl(targetRoll-up[0],-.8,.8);
    const pitchErr=cl(targetPitch-up[2],-.8,.8);
    const targetRates=[
      cl(pitchErr*2.5,-.7,.7),
      -pedal*.65,
      cl(-rollErr*2.5,-.7,.7)
    ];
    const deltaRates=[
      (targetRates[0]-s.w[0])*3.4,
      (targetRates[1]-s.w[1])*2.9,
      (targetRates[2]-s.w[2])*3.4
    ];
    const gyro=FDM.angularAccel(inertia,s.w,[0,0,0]);
    const moments=[
      inertia.ix*(deltaRates[0]-gyro[0]),
      inertia.iy*(deltaRates[1]-gyro[1]),
      inertia.iz*(deltaRates[2]-gyro[2])
    ];
    const ang=FDM.angularAccel(inertia,s.w,moments);
    const oldW=s.w.slice();
    s.w=s.w.map((x,i)=>cl(x+ang[i]*h,-1.1,1.1));
    s.q=FDM.advanceQ(s.q,mul(add(oldW,s.w),.5),h);
    // Main rotor lift from shaft-axis thrust plus translational lift.
    // Slower air at altitude reduces available rotor thrust.
    const airFactor=Math.pow(density/1.225,.70);
    const relative=sub(s.v,env.windWorld||[0,0,0]);
    const forward=qrot(s.q,[0,0,1]),right=qrot(s.q,[1,0,0]);
    const horizontal=Math.hypot(relative[0],relative[2]);
    const translation=1+.11*cl((horizontal-8)/24,0,1);
    const groundEffect=1+.13*Math.exp(-Math.max(0,agl)/5);
    const liftMax=Number(spec.maxRotorThrust)||m*g/0.64;
    let lift=liftMax*s.collective*airFactor*translation*groundEffect*s.rpm*s.rpm;
    // At high speed induced lift is limited; no supersonic rotorcraft.
    lift*=1-.17*cl((horizontal-70)/30,0,1);
    const rotor=qrot(s.q,[0,lift,0]);
    // Independent drag in body axes (longitudinal, lateral, vertical).
    const vb=FDM.inverse(s.q,relative);
    const CdA=[4.8,5.0,2.7];
    const localDrag=vb.map((v,i)=>-.5*density*CdA[i]*v*Math.abs(v));
    const drag=qrot(s.q,localDrag);
    const f=add(rotor,drag);
    const acc=add(mul(f,1/m),[0,-g,0]);
    const lastV=s.v.slice();
    s.v=add(s.v,mul(acc,h));
    s.r=add(s.r,mul(add(s.v,lastV),.5*h));
    // Wheeled landing contact, not a fake hovering clamp in mid-air.
    const gear=Number(spec.gearHeight)||1.85;
    let onGround=false;
    if(s.r[1]<=ground+gear){
      const sink=Math.min(0,s.v[1]);
      s.r[1]=ground+gear;
      s.v[1]=Math.max(0,s.v[1]);
      onGround=true;
      // Finite rolling/braking friction and horizontal wind drag.
      const friction=(env.brake?.40:.075)*g*h;
      for(const i of [0,2])s.v[i]=Math.sign(s.v[i])*Math.max(0,Math.abs(s.v[i])-friction);
      // Soft reset of excessive angular tilt while safely stationary.
      if(horizontal<2&&s.collective<.45){
        s.w=s.w.map(v=>v*.96);
      }
      if(sink<-5.5)onGround=false; // game can report hard touchdown
    }
    // Approximate two turboshaft consumption in kg/s at 100% rotor power.
    s.fuel=Math.max(0,s.fuel-h*(.09+.42*Math.pow(s.collective,1.7))*s.rpm);
    s.rotorPhase=(s.rotorPhase+h*29*s.rpm)%(2*PI);
    s.tailPhase=(s.tailPhase+h*135*s.rpm)%(2*PI);
    s.time+=h;
    const v=vlen(s.v),mach=v/Math.sqrt(1.4*287.05*288.15);
    s.last={r:s.r.slice(),v:s.v.slice(),q:s.q.slice(),w:s.w.slice(),
      acceleration:acc,forceWorld:f,rotorLift:lift,collective:s.collective,
      rotorRPM:s.rpm,rotorPhase:s.rotorPhase,tailPhase:s.tailPhase,
      onGround,mach,qbar:.5*density*v*v,nz:dot(f,up)/(m*g),
      agl:Math.max(0,s.r[1]-ground),fuel:s.fuel};
    return s.last;
  }
  return Object.freeze({version:'uh60-6dof-1',create,step});
});
