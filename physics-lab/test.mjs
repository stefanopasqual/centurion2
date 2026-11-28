import assert from 'node:assert/strict';
import {test} from 'node:test';
import {state,massProperties,createKernel,combineLoads} from './core.mjs';
import {createClock} from './clock.mjs';
const sphere=massProperties(2,[3,0,0,0,3,0,0,0,3]);
const zero={gravity:[0,0,0]};
const dt=1/120;
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<=tol, a+' != '+b+' (tol '+tol+')');
const nearVec=(a,b,tol)=>a.forEach((v,i)=>near(v,b[i],tol));
function evolve(k,s,seconds,h=dt){
  for(let i=0;i<Math.round(seconds/h);i++)s=k.step(s,i*h,h);
  return s;
}
test('free body: exact linear drift and unchanged rotation',()=>{
  const s=evolve(createKernel(sphere,zero),state([1,2,3],[2,-3,4]),10);
  nearVec(s.r,[21,-28,43],1e-9);nearVec(s.v,[2,-3,4],1e-12);nearVec(s.q,[0,0,0,1],1e-12);
});
test('constant gravity: analytic position and velocity',()=>{
  const s=evolve(createKernel(sphere),state([0,0,100],[3,0,0]),2);
  nearVec(s.r,[6,0,100-.5*9.80665*4],1e-10);
  nearVec(s.v,[3,0,-2*9.80665],1e-10);
});
test('body/world force transform and load composition',()=>{
  const loads=combineLoads(()=>({force:[2,0,0],moment:[0,0,0]}),()=>({force:[2,0,0],moment:[0,0,0]}));
  const s=evolve(createKernel(sphere,{...zero,loads}),state([0,0,0],[0,0,0],[0,0,Math.SQRT1_2,Math.SQRT1_2]),2);
  nearVec(s.v,[0,4,0],1e-10);nearVec(s.r,[0,4,0],1e-10);
});
test('constant torque: analytic principal-axis angular velocity and attitude',()=>{
  const k=createKernel(sphere,{...zero,loads:()=>({force:[0,0,0],moment:[0,0,3]})});
  const s=evolve(k,state(),2);
  nearVec(s.w,[0,0,2],1e-10);
  nearVec(s.q,[0,0,Math.sin(1),Math.cos(1)],1e-4);
  near(Math.hypot(...s.q),1,1e-12);
});
test('torque-free generic body: full tensor, convergence and invariants',()=>{
  const props=massProperties(5,[3,.2,.1,.2,4,.3,.1,.3,5]);
  const k=createKernel(props,zero),s0=state([0,0,0],[0,0,0],[0,0,0,1],[.6,.4,.8]);
  const init=k.invariants(s0);
  const a=k.invariants(evolve(k,s0,20,1/60)),b=k.invariants(evolve(k,s0,20,1/120)),c=k.invariants(evolve(k,s0,20,1/240));
  const error=x=>Math.hypot(...x.angularMomentumWorld.map((v,i)=>v-init.angularMomentumWorld[i]));
  assert.ok(error(b)<error(a)/2.5);assert.ok(error(c)<error(b)/2.5);
  nearVec(b.angularMomentumWorld,init.angularMomentumWorld,1e-3);
  near(b.rotationalEnergy,init.rotationalEnergy,1e-4);near(b.quaternionNorm,1,1e-12);
  console.log('MOMENTUM_ERRORS',error(a),error(b),error(c));
});
test('reject invalid mass, inertia, input state and forces',()=>{
  assert.throws(()=>massProperties(NaN,[1,0,0,0,1,0,0,0,1]));
  assert.throws(()=>massProperties(0,[1,0,0,0,1,0,0,0,1]));
  assert.throws(()=>massProperties(1,[1,2,0,2,1,0,0,0,1]));
  assert.throws(()=>massProperties(1,[1,1,0,0,1,0,0,0,1]));
  assert.throws(()=>state([NaN,0,0]));assert.throws(()=>state(undefined,undefined,[0,0,0,0]));
  const k=createKernel(sphere,{...zero,loads:()=>({force:[Infinity,0,0],moment:[0,0,0]})});
  assert.throws(()=>k.step(state(),0,dt));assert.throws(()=>createKernel(sphere).step(state(),0,NaN));
});
test('same timed input at 5, 10, 15, 30, 60, 90, 120 render FPS',()=>{
  const k=createKernel(sphere,{...zero,loads:(_s,t)=>({force:[Math.sin(t),0,0],moment:[0,0,.2*Math.cos(t)]})});
  const run=fps=>{
    const clock=createClock();let s=state();
    for(let i=0;i<fps*10;i++)clock.advance(1/fps,(t,h)=>{s=k.step(s,t,h);});
    assert.equal(clock.tick,1200);near(clock.droppedSeconds,0,1e-12);return s;
  };
  const baseline=run(120);
  for(const fps of [5,10,15,30,60,90])assert.deepEqual(run(fps),baseline);
});
test('clock overload and pause are observable',()=>{
  const c=createClock();let calls=0;
  const result=c.advance(2,()=>calls++);
  assert.equal(calls,30);assert.equal(result.overrun,true);near(result.droppedSeconds,1.75,1e-12);
  c.advance(dt/2,()=>assert.fail('fractional step'));
  near(c.resetRemainder(),dt/2,1e-12);assert.equal(c.tick,30);
  assert.throws(()=>c.advance(NaN,()=>{}));
});
test('120 minute generic body long run, 864000 fixed steps',()=>{
  const k=createKernel(sphere,zero);
  const start=state([0,0,0],[1,0,0],[0,0,0,1],[0,0,.02]);
  const s=evolve(k,start,7200);
  near(s.r[0],7200,1e-5);nearVec(s.v,[1,0,0],1e-12);
  nearVec(s.w,[0,0,.02],1e-12);near(Math.hypot(...s.q),1,1e-12);
});
