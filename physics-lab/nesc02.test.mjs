import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {state,massProperties,createKernel} from './core.mjs';
const data=JSON.parse(readFileSync(new URL('./fixtures/nesc02-rates.json',import.meta.url),'utf8'));
test('NASA NESC case 02: inertial angular-rate subset, four archived solutions',()=>{
  // NASA SimuPy Flight case02: inertial rates 10/20/30 deg/s, not local NED rates.
  // Only the torque-free rotational subsystem is compared; no Earth/translation claim.
  const conv=14.59390294*.3048**2;
  const I=[.001894220,.006211019,.007194665].map(x=>x*conv);
  const props=massProperties(.155404754*14.59390294,[I[0],0,0,0,I[1],0,0,0,I[2]]);
  const k=createKernel(props,{gravity:[0,0,0]}),hz=120,dt=1/hz,deg=180/Math.PI;
  let s=state(undefined,undefined,undefined,[10,20,30].map(x=>x/deg));
  const computed=[s.w.map(x=>x*deg)];
  for(let i=1;i<=30*hz;i++){s=k.step(s,(i-1)*dt,dt);if(i%12===0)computed.push(s.w.map(x=>x*deg));}
  assert.equal(computed.length,301);assert.equal(data.sources.length,4);
  const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
  const metrics=[];
  for(const src of data.sources){
    assert.equal(src.samples.length,301);
    let max=0,sum=0;
    src.samples.forEach((v,i)=>{
      assert.ok(Math.abs(v[0]-i/10)<1e-7);
      const e=distance(computed[i],v.slice(1));max=Math.max(max,e);sum+=e*e;
    });
    metrics.push({sim:src.id,maxDegPerSec:max,rmsDegPerSec:Math.sqrt(sum/301)});
  }
  let spread=0;
  for(let i=0;i<301;i++)for(const a of data.sources)for(const b of data.sources)
    spread=Math.max(spread,distance(a.samples[i].slice(1),b.samples[i].slice(1)));
  console.log('NESC02_INERTIAL_RATE_RESULTS',JSON.stringify({samples:301,comparisons:1204,spreadDegPerSec:spread,metrics}));
  // Predeclared lab tolerance, not a NASA-issued acceptance limit.
  for(const m of metrics){assert.ok(m.maxDegPerSec<.02,JSON.stringify(m));assert.ok(m.rmsDegPerSec<.01,JSON.stringify(m));}
});
