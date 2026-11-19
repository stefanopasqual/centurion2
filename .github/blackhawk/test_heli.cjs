'use strict';
const assert=require('node:assert/strict');
const rotor=require('./heli_fdm.js');
const aero=require('../aero/aero_core.js');
const spec={icona:'uh60-centurion',m:9500,fuel:1650,gearHeight:1.85,
  collectiveHover:.64,length:19.76,span:16.36,height:5.13,S:201};
const test=(collective,seconds,extra={})=>{
  const s=rotor.create(spec,{r:[0,120,0],v:[0,0,0],collective:.64,fuel:1650});
  const steps=Math.round(seconds*60);
  for(let k=0;k<steps;k++){
    const o=rotor.step(s,1/60,{collective,roll:extra.roll||0,
      pitch:extra.pitch||0,rudder:extra.rudder||0},{
      mass:9500,rho:1.225,ground:0,windWorld:[0,0,0]
    });
    assert.ok(s.r.every(Number.isFinite)&&s.v.every(Number.isFinite),'finite position/velocity');
    assert.ok(s.w.every(Number.isFinite)&&s.q.every(Number.isFinite),'finite attitude');
    assert.ok(Math.abs(Math.hypot(...s.q)-1)<1e-8,'quaternion normalized');
    assert.ok(o.rotorLift>=0&&Number.isFinite(o.rotorLift),'nonnegative rotor lift');
    assert.ok(s.fuel>=0,'fuel not negative');
  }
  return s;
};
let s=test(.64,8);
assert.ok(Math.abs(s.r[1]-120)<12,'UH60 hover at .64 collective stays within +-12m: '+s.r[1]);
s=test(.85,6);
assert.ok(s.r[1]>125,'UH60 high collective climbs: '+s.r[1]);
s=test(.37,6);
assert.ok(s.r[1]<115,'UH60 low collective descends: '+s.r[1]);
s=test(.64,5,{rudder:.55});
assert.ok(Math.abs(s.q[1])>.05,'UH60 anti-torque pedals must yaw');
s=test(.64,5,{roll:.35,pitch:.3});
assert.ok(Math.abs(s.r[0])+Math.abs(s.r[2])>.5,'UH60 cyclic must induce horizontal flight');
const landed=rotor.create(spec,{r:[0,1.85,0],v:[0,-.4,0],collective:.2});
const touchdown=rotor.step(landed,1/60,{collective:.2},{mass:9500,rho:1.225,ground:0});
assert.ok(touchdown.onGround && Math.abs(landed.r[1]-1.85)<1e-6,'UH60 must settle on wheels');
assert.equal(rotor.version,'uh60-6dof-1');
const a380={icona:'a380',m:445000,S:845,span:79.8,oswald:.83,
  Tmil:1240000,Tab:1240000,cd0:.0205,cla:5.2,astall:17,amax:14,
  criticalMach:.8,waveRise:.085,gmax:2.5,gneg:1,pmax:22,
  length:72.7,height:24.1,servoTau:.5};
const rho=aero.isa(9750).rho,at=aero.isa(9750);
const q=.5*rho*232*232;
const nominalAlpha=445000*aero.GRAVITY/(q*845*5.2);
const level=aero.coefficients(a380,{alpha:nominalAlpha,beta:0,mach:232/at.soundSpeed,qbar:q,agl:9750});
assert.ok(level.liftN>445000*aero.GRAVITY*.75 && level.liftN<445000*aero.GRAVITY*1.3,
  'A380 level lift physically sensible');
const stall=aero.coefficients(a380,{alpha:.70,beta:0,mach:.20,qbar:q,agl:500});
assert.ok(stall.stalled,'A380 at high alpha must stall');
const eng=aero.engine(a380,at,.85,1,0);
assert.ok(eng.thrust>0&&eng.thrust<1240000,'A380 realistic four-engine thrust lapse');
const fdm=require('../aero/fdm6.js');
const I=fdm.inertia(a380,a380.m);
assert.ok(I.det>0&&I.ix>1e8,'A380 mass and geometric inertia finite');
console.log('PASS AIRLINER/ROTOR: UH60 hover climb descent cyclic yaw touchdown; A380 lift stall thrust inertia');
