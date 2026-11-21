/* Run: node .github/aero/test_aero.cjs */
'use strict';
const assert=require('node:assert/strict');
const aero=require('./aero_core.js');
const base={icona:'f16',m:12000,S:27.87,cla:3.6,astall:28,cd0:.0175,Tmil:76300,Tab:127000};
const near=(a,b,tol,desc)=>assert.ok(Math.abs(a-b)<tol,desc+': '+a+' expected '+b);
function sample(speed,alt,alphaDeg,extra={}){
 return aero.sample(base,{speed,alt,alpha:alphaDeg*Math.PI/180,
   agl:1000,...extra});
}
const sea=aero.isa(0),high=aero.isa(10000);
near(sea.rho,1.225,.0001,'ISA sea level');
near(sea.soundSpeed,340.294,1,'ISA speed of sound');
assert.ok(high.rho<sea.rho,'Air density decreases with altitude');
assert.ok(high.soundSpeed<sea.soundSpeed,'Temperature affects sound speed');
for(const v of [60,100,150,250]) {
 const p=sample(v,0,5);
 assert.ok(Number.isFinite(p.CL)&&Number.isFinite(p.CD)&&p.CD>0,'No NaN coefficients');
 const n=sample(v,0,5,{agl:3});
 assert.ok(n.groundFactor<p.groundFactor,'Ground effect must reduce induced drag');
}
const slow=sample(120,0,6),fast=sample(240,0,6);
near(fast.qbar/slow.qbar,4,.02,'Dynamic pressure increases with speed squared');
assert.ok(fast.liftN>slow.liftN,'Lift increases with speed at fixed alpha');
const slight=sample(140,0,8),deep=sample(140,0,45);
assert.ok(deep.stalled&&!slight.stalled,'Stall onset depends on AoA');
assert.ok(deep.separation>slight.separation,'Separation increases drag');
assert.ok(deep.CL<slight.CL*2,'Deep stall should not increase lift without bound');
const a0=sample(100,0,0),a1=sample(100,0,5),a2=sample(100,0,10);
assert.ok(a0.CL<a1.CL&&a1.CL<a2.CL,'Pre-stall lift slope positive');
const nearM=sample(350,0,3),lowM=sample(250,0,3);
assert.ok(nearM.wave>lowM.wave,'Transonic wave drag rise');
const geom=aero.profile(base);
near(geom.kInduced,1/(Math.PI*geom.aspectRatio*geom.oswald),1e-10,'Induced drag polar uses aspect ratio');
const thrust0=aero.engine(base,sea,0.6,1,0).thrust;
const thrustHi=aero.engine(base,high,.6,1,0).thrust;
assert.ok(thrust0>thrustHi,'Installed thrust decreases with altitude');
assert.ok(aero.engine(base,sea,.6,1,1).thrust>thrust0,'Afterburner thrust higher than dry');
const spec={...base,icona:'kc30',S:361,cla:5.1,astall:16};
assert.ok(aero.profile(spec).aspectRatio>aero.profile(base).aspectRatio,'Airliner wing has higher AR');
const numerical=[...Array(100)].map((_,i)=>aero.sample(base,{speed:i*10,alt:Math.min(30000,i*380),alpha:(i%48-24)*Math.PI/180,agl:i%40}));
for(const s of numerical)for(const key of ['CL','CD','induced','wave','liftN','dragN','qbar','mach'])
 assert.ok(Number.isFinite(s[key]),'Finite '+key);
// Supersonic behaviour in level flight (lift = weight): reheat goes through the
// transonic drag rise, military power stops near Mach 1, the F-22 supercruises.
function surplus(spec,alt,mach,ab){
 const at=aero.isa(alt),W=spec.m*aero.GRAVITY,v=mach*at.soundSpeed,q=.5*at.rho*v*v;
 let lo=-.2,hi=.6;
 for(let i=0;i<40;i++){const mid=(lo+hi)/2;const c=aero.coefficients(spec,{alpha:mid,mach,qbar:q,agl:5000});if(c.CL*q*spec.S<W)lo=mid;else hi=mid;}
 const c=aero.coefficients(spec,{alpha:lo,mach,qbar:q,agl:5000});
 return aero.engine(spec,at,mach,1,ab).thrust-c.CD*q*spec.S;
}
assert.ok(surplus(base,9000,1.2,1)>0,'F-16 on reheat accelerates through Mach 1.2 at 9 km');
assert.ok(surplus(base,9000,1.1,0)<0,'F-16 at military power stays below Mach 1.1 at 9 km');
const raptor={icona:'f22',m:29000,S:78,cla:3.2,astall:45,cd0:.018,Tmil:232000,Tab:312000};
assert.ok(surplus(raptor,12500,1.45,0)>0,'F-22 supercruises at military power');
assert.ok(!aero.profile({icona:'a380',S:845}).supersonico,'Transports keep their transonic model');
assert.ok(aero.engine(base,high,1.5,1,1).abRam>aero.engine(base,high,.2,1,1).abRam,'Reheat ram gain grows with Mach');
console.log('PASS: 21 aero regression groups, ISA, qS, stall, transonic, supersonic, engine and geometry');
