import assert from 'node:assert/strict';
import {test} from 'node:test';
import {state,rotate,massProperties,createKernel} from './core.mjs';
import {createClock} from './clock.mjs';
const zero={gravity:[0,0,0]},h=1/120;
const diag=(a,b,c)=>[a,0,0,0,b,0,0,0,c];
const mag=x=>Math.hypot(...x);
const err=(a,b)=>mag(a.map((x,i)=>x-b[i]));
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<=tol, a+' != '+b+' tol '+tol);
const rng=seed=>()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
const matrix=q=>{const [x,y,z,w]=q;return [
  1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),
  2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),
  2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)];};
const matvec=(a,v)=>[0,1,2].map(i=>a[3*i]*v[0]+a[3*i+1]*v[1]+a[3*i+2]*v[2]);
const eye=[1,0,0,0,1,0,0,0,1];
test('1000 seeded rotations: independent matrix, sign equivalence and inverse',()=>{
  const rand=rng(20261128);
  for(let i=0;i<1000;i++){
    let q=Array.from({length:4},()=>2*rand()-1);const n=mag(q);q=q.map(x=>x/n);
    const v=Array.from({length:3},()=>2*rand()-1),r=rotate(q,v);
    assert.ok(err(r,matvec(matrix(q),v))<=1e-13*Math.max(1,mag(v)));
    assert.ok(err(r,rotate(q.map(x=>-x),v))<1e-13);
    assert.ok(err(v,rotate([-q[0],-q[1],-q[2],q[3]],r))<1e-13);
  }
});
test('physical inertia, symmetry tolerance and conditioning',()=>{
  assert.throws(()=>massProperties(1,diag(1,1,3)),/physically/);
  assert.ok(massProperties(1,diag(1,1,3),{physical:false}).condition>=3);
  assert.ok(massProperties(1,diag(1,1,2)).condition<=2.000000001);
  assert.throws(()=>massProperties(1,diag(1e-14,1,1)),/ill-conditioned/);
  const p=massProperties(1,[3,.2,0,.2+1e-14,4,0,0,0,5]);
  assert.equal(p.inertia[1],p.inertia[3]);
  assert.throws(()=>massProperties(1,[3,.2,0,.21,4,0,0,0,5]),/symmetric/);
});
test('read-only callbacks, overflow and invalid intermediate time',()=>{
  const p=massProperties(1,diag(2,2,2));
  const s=state();
  const mutating=createKernel(p,{...zero,loads:x=>{x.w[0]=5;return {force:[0,0,0],moment:[0,0,0]};}});
  assert.throws(()=>mutating.step(s,0,h),TypeError);assert.deepEqual(s,state());
  const over=createKernel(p,{...zero,loads:()=>({force:[Number.MAX_VALUE,0,0],moment:[0,0,0]})});
  assert.throws(()=>over.step(s,0,10),RangeError);
  assert.throws(()=>createKernel(p,zero).step(s,Number.MAX_VALUE,Number.MAX_VALUE),RangeError);
});
test('analytic symmetric-top precession: trajectory error and order',()=>{
  const p=massProperties(1,diag(2,2,3)),k=createKernel(p,zero);
  const a=.7,b=.8,f=(3-2)/2*b;
  const run=hz=>{
    const dt=1/hz;let s=state(undefined,undefined,undefined,[a,0,b]),max=0;
    for(let i=1;i<=10*hz;i++){
      s=k.step(s,(i-1)*dt,dt);const t=i*dt;
      max=Math.max(max,err(s.w,[a*Math.cos(f*t),a*Math.sin(f*t),b]));
    }
    return max;
  };
  const e=[60,120,240].map(run);
  console.log('SYMMETRIC_TOP_MAX_ERROR',JSON.stringify(e));
  for(let i=0;i<2;i++){const p=Math.log2(e[i]/e[i+1]);assert.ok(p>=1.8&&p<=2.2);}
  assert.ok(e[1]<1e-4);
});
// Independent reference: RK4 on a rotation matrix, not the kernel quaternion equations.
function referenceDerivative(y,I,torque){
  const [a,b,c]=y.slice(0,3),[ix,iy,iz]=I;
  const rate=[(torque[0]+(iy-iz)*b*c)/ix,(torque[1]+(iz-ix)*c*a)/iy,(torque[2]+(ix-iy)*a*b)/iz];
  const S=[0,-c,b,c,0,-a,-b,a,0],R=y.slice(3);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)
    rate.push(R[i*3]*S[j]+R[i*3+1]*S[3+j]+R[i*3+2]*S[6+j]);
  return rate;
}
function referenceStep(y,dt,I,M){
  const d=x=>referenceDerivative(x,I,M),add=(x,k,h)=>x.map((v,i)=>v+h*k[i]);
  const a=d(y),b=d(add(y,a,dt/2)),c=d(add(y,b,dt/2)),e=d(add(y,c,dt));
  return y.map((v,i)=>v+dt*(a[i]+2*b[i]+2*c[i]+e[i])/6);
}
function referenceCase(I,M,w0,seconds){
  const result=new Map();let y=[...w0,...eye];const hz=1920;
  for(let i=1;i<=seconds*hz;i++){y=referenceStep(y,1/hz,I,M);if(i%(hz/4)===0)result.set(i/(hz/4),y);}
  return result;
}
for(const scenario of [
  {name:'non-principal constant torque',I:[3,4,5],M:[.03,-.04,.05],w:[.6,.4,.8],seconds:20},
  {name:'intermediate-axis perturbation',I:[3,4,5],M:[0,0,0],w:[.02,.8,.01],seconds:30}
]){
  test('independent RK4 matrix reference: '+scenario.name,()=>{
    const {I,M,w,seconds}=scenario,ref=referenceCase(I,M,w,seconds);
    const k=createKernel(massProperties(1,diag(...I)),{...zero,loads:()=>({force:[0,0,0],moment:M})});
    const run=hz=>{
      let s=state(undefined,undefined,undefined,w),maxW=0,maxR=0,sumW2=0,count=0;
      for(let i=1;i<=seconds*hz;i++){
        s=k.step(s,(i-1)/hz,1/hz);
        if(i%(hz/4)===0){
          const y=ref.get(i/(hz/4)),ew=err(s.w,y.slice(0,3)),er=err(matrix(s.q),y.slice(3));
          maxW=Math.max(maxW,ew);maxR=Math.max(maxR,er);sumW2+=ew*ew;count++;
        }
      }return {maxW,maxR,rmsW:Math.sqrt(sumW2/count)};
    };
    const e=[60,120,240].map(run);
    console.log('REFERENCE_ERRORS',scenario.name,JSON.stringify(e));
    for(let i=0;i<2;i++)for(const key of ['maxW','maxR']){
      const p=Math.log2(e[i][key]/e[i+1][key]);assert.ok(p>=1.7&&p<=2.3,key+' order '+p);
    }
    assert.ok(e[1].maxW<.001&&e[1].maxR<.005);
  });
}
test('120-minute asymmetric body: invariant envelope measured every step',()=>{
  const p=massProperties(5,[3,.2,.1,.2,4,.3,.1,.3,5]),k=createKernel(p,zero);
  let s=state(undefined,undefined,undefined,[.6,.4,.8]);
  const initial=k.invariants(s),energy=initial.rotationalEnergy,H=initial.angularMomentumWorld;
  let maxH=0,maxE=0,maxQ=0;
  for(let i=0;i<864000;i++){
    s=k.step(s,i*h,h);const a=k.invariants(s);
    maxH=Math.max(maxH,err(a.angularMomentumWorld,H)/mag(H));
    maxE=Math.max(maxE,Math.abs(a.rotationalEnergy-energy)/energy);
    maxQ=Math.max(maxQ,Math.abs(a.quaternionNorm-1));
  }
  console.log('ASYMMETRIC_120MIN_ENVELOPE',JSON.stringify({maxH,maxE,maxQ,steps:864000}));
  assert.ok(maxH<1e-3,'momentum envelope '+maxH);
  assert.ok(maxE<1e-3,'energy envelope '+maxE);assert.ok(maxQ<1e-12);
});
test('seeded clock jitter, burst and repeated overrun accounting',()=>{
  const c=createClock(),rand=rng(17);let remaining=60,total=0,steps=0;
  while(remaining>1e-12){
    const d=Math.min(remaining,.001+rand()*.239);remaining-=d;total+=d;
    const r=c.advance(d,()=>steps++);assert.equal(r.overrun,false);
    assert.ok(r.alpha>=0&&r.alpha<1+1e-9);near(c.time+r.alpha*c.dt+c.droppedSeconds,total,1e-9);
  }
  assert.equal(steps,7200);near(c.time,60,1e-12);
  for(const d of [.016,.016,.08,1,60,.002,2,.249,.009]){
    total+=d;const r=c.advance(d,()=>steps++);
    near(c.time+r.alpha*c.dt+c.droppedSeconds,total,1e-9);
  }
  const before=c.tick;c.resetRemainder();assert.equal(c.tick,before);
  near(c.time+c.droppedSeconds,total,1e-9);
});
