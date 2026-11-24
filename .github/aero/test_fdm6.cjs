/* node .github/aero/test_fdm6.cjs - six-degree-of-freedom physics regression */
'use strict';
const assert=require('node:assert/strict');
const f=require('./fdm6.js');
const a=require('./aero_core.js');
const approx=(x,y,tol,label)=>assert.ok(Math.abs(x-y)<=tol,label+': '+x+' vs '+y);
const norm=q=>Math.hypot(...q);
const jet={icona:'f16',m:12000,S:27.87,span:9.96,Tmil:76300,Tab:127000,cla:3.6,astall:28,cd0:.0175,gmax:9,gneg:3,pmax:240};
const quad={icona:'uav-quad',m:6,S:.55,span:1.4,length:.7,height:.24,drone:'quad'};
const inertia=f.inertia(jet,jet.m);
assert.ok(inertia.det>0&&inertia.ix>0&&inertia.iy>0&&inertia.iz>0,'positive definite inertia tensor');
const torque=[37,-23,11],angular=f.angularAccel(inertia,[0,0,0],torque);
approx(inertia.ix*angular[0],torque[0],1e-10,'inertia inverse preserves pitch torque');
approx(inertia.iy*angular[1]+inertia.iyz*angular[2],torque[1],1e-10,'inertia inverse preserves yaw torque');
approx(inertia.iyz*angular[1]+inertia.iz*angular[2],torque[2],1e-10,'inertia inverse preserves roll torque');
const gravity=f.create(jet,{r:[0,2000,0],v:[0,0,0]});
for(let i=0;i<120;i++)f.stepFixed(gravity,1/120,{},{mass:jet.m,thrust:0,agl:2000});
approx(gravity.v[1],-a.GRAVITY,0.1,'free-fall gravity over 1 second');
approx(gravity.r[1],2000-a.GRAVITY/2,0.2,'free-fall position');
approx(norm(gravity.q),1,1e-10,'normalized quaternion');

const turn=f.create(jet,{r:[0,3000,0],v:[0,0,200]});
turn.w=[.1,-.3,.25];
const q0=turn.q.slice();
for(let i=0;i<100;i++)f.stepFixed(turn,1/120,{roll:.7,pitch:.4,rudder:.15},{mass:jet.m,thrust:28000,agl:3000});
assert.ok(Math.hypot(...turn.w)>.001,'angular velocity must be integrated');
assert.ok(Math.hypot(...turn.q.map((v,i)=>v-q0[i]))>.001,'quaternion must rotate');
approx(norm(turn.q),1,1e-8,'attitude stays normalized');
assert.ok(turn.last.momentBody.every(Number.isFinite),'finite aerodynamic torques');
assert.ok(turn.last.forceWorld.every(Number.isFinite),'finite body-to-world forces');
assert.ok(turn.last.acceleration.every(Number.isFinite),'finite body-to-world acceleration');
assert.ok(turn.last.surfaces.ail<=1&&turn.last.surfaces.ail>=-1,'limited aileron');

const inv=f.create(jet,{q:[0,0,1,0],r:[0,4000,0],v:[0,0,-180]});
for(let i=0;i<100;i++)f.stepFixed(inv,1/120,{pitch:-.4,roll:-.2},{mass:jet.m,thrust:10000,agl:4000});
assert.ok(inv.r.every(Number.isFinite)&&inv.v.every(Number.isFinite),'inverted flight is finite');

const coupled=f.angularAccel(inertia,[1.2,.8,-.55],[0,0,0]);
assert.ok(Math.hypot(...coupled)>1e-6,'gyroscopic coupling generates angular acceleration');

const qr=f.create(quad,{r:[0,100,0],v:[0,0,0]});
for(let i=0;i<120;i++)f.stepRotor(qr,1/120,{throttle:.5,roll:0,pitch:0,rudder:0},{mass:6});
assert.ok(Math.abs(qr.v[1])<8,'mid-throttle rotor hover remains close to hover');
assert.ok(qr.rotor.every(x=>Number.isFinite(x)&&x>=0),'four finite rotor thrusts');

const qrRise=f.create(quad,{r:[0,100,0],v:[0,0,0]});
for(let i=0;i<160;i++)f.stepRotor(qrRise,1/120,{throttle:.78},{mass:6});
assert.ok(qrRise.r[1]>100,'quadrotor must climb with additional thrust');

const qrTurn=f.create(quad,{r:[0,100,0]});
for(let i=0;i<150;i++)f.stepRotor(qrTurn,1/120,{throttle:.58,roll:.6,pitch:-.4,rudder:.4},{mass:6});
assert.ok(Math.hypot(...qrTurn.w)>.0001,'differential rotors produce all-axis angular response');
approx(norm(qrTurn.q),1,1e-8,'rotor quaternion normalized');

let s=f.create(jet,{r:[0,6000,0],v:[0,0,280]});
for(let i=0;i<1200;i++){
 const out=f.stepFixed(s,1/120,{roll:Math.sin(i*.001)*.3,pitch:Math.cos(i*.001)*.25,rudder:0},{mass:jet.m,thrust:65000,agl:6000});
 assert.ok(out,'advanced state');
 if(!s.r.every(Number.isFinite)||!s.v.every(Number.isFinite)||!s.w.every(Number.isFinite))throw Error('Nonfinite 6DOF state at '+i);
 if(Math.hypot(...s.w)>10)throw Error('Angular rate runaway at '+i);
}
console.log('PASS 6DOF: gravity, inertia, attitude, aerodynamic forces/moments, inverted, hover, climb, rotor mixing, 10s stability');
