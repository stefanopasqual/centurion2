import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium,firefox,webkit,devices} from 'playwright';
import {state,massProperties,createKernel} from './core.mjs';
const engines={chromium,firefox,webkit},name=process.argv[2];
assert.ok(engines[name],'expected chromium, firefox or webkit');
const routes=new Set(['/core.mjs','/clock.mjs']);
const server=createServer(async(req,res)=>{
  try{
    if(req.url==='/'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><meta name="viewport" content="width=device-width"><title>Rigid body test lab</title>');return;}
    if(!routes.has(req.url)){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'content-type':'text/javascript'});
    res.end(await readFile(new URL('.'+req.url,import.meta.url)));
  }catch(e){res.writeHead(500);res.end(String(e));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await engines[name].launch({headless:true});
  const profiles=[{label:'desktop',options:{}}];
  if(name==='chromium')profiles.push({label:'Pixel 7 emulation',options:devices['Pixel 7']});
  if(name==='webkit')profiles.push({label:'iPhone 13 emulation',options:devices['iPhone 13']});
  const I=[3,.2,.1,.2,4,.3,.1,.3,5],w=[.6,.4,.8],dt=1/120;
  const k=createKernel(massProperties(5,I),{gravity:[0,0,0]});
  let expected=state(undefined,undefined,undefined,w);
  for(let i=0;i<1200;i++)expected=k.step(expected,i*dt,dt);
  for(const {label,options} of profiles){
    const context=await browser.newContext(options),page=await context.newPage();
    try{
      await page.goto('http://127.0.0.1:'+server.address().port+'/');
      const result=await page.evaluate(async()=>{
        const {state,massProperties,createKernel}=await import('/core.mjs');
        const {createClock}=await import('/clock.mjs');
        const dt=1/120,k=createKernel(massProperties(5,[3,.2,.1,.2,4,.3,.1,.3,5]),{gravity:[0,0,0]});
        const initial=()=>state(undefined,undefined,undefined,[.6,.4,.8]);
        const run=n=>{let s=initial();for(let i=0;i<n;i++)s=k.step(s,i*dt,dt);return s;};
        const expected=run(1200);
        const clock=createClock();let actual=initial(),frames=0,wall=0,alpha=0;
        const first=await new Promise(resolve=>requestAnimationFrame(resolve));
        let last=first;
        await new Promise(resolve=>{
          const frame=now=>{
            const d=(now-last)/1000;last=now;wall+=d;frames++;
            const r=clock.advance(d,(t,h)=>{actual=k.step(actual,t,h);});alpha=r.alpha;
            if(now-first>=1500)resolve();else requestAnimationFrame(frame);
          };requestAnimationFrame(frame);
        });
        const replay=run(clock.tick);
        const batches=[];let bench=initial();
        for(let b=0;b<100;b++){
          const start=performance.now();for(let j=0;j<120;j++)bench=k.step(bench,(b*120+j)*dt,dt);
          batches.push(performance.now()-start);
        }
        batches.sort((a,b)=>a-b);
        return {expected,actual,replay,frames,wall,alpha,tick:clock.tick,sim:clock.time,dropped:clock.droppedSeconds,
          medianBatchMs:batches[49],p95BatchMs:batches[94],userAgent:navigator.userAgent};
      });
      for(const field of ['r','v','q','w']){
        result.expected[field].forEach((v,i)=>assert.ok(Math.abs(v-expected[field][i])<1e-10,field+' cross-engine tolerance'));
        assert.deepEqual(result.actual[field],result.replay[field]);
      }
      assert.ok(result.frames>0&&result.tick>0);
      assert.ok(Math.abs(result.wall-result.sim-result.alpha*dt-result.dropped)<1e-8,'clock accounting');
      console.log('BROWSER_RESULT',JSON.stringify({engine:name,version:browser.version(),profile:label,frames:result.frames,
        wallSeconds:result.wall,acceptedTicks:result.tick,droppedSeconds:result.dropped,
        median120StepsMs:result.medianBatchMs,p95_120StepsMs:result.p95BatchMs,userAgent:result.userAgent}));
    }finally{await context.close();}
  }
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
