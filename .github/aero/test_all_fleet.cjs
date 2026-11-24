'use strict';
// CENTURION2 complete free-flight fleet QA. Uses real flight engines and source configs.
// Not aircraft certification, landing/takeoff testing, or browser rendering QA.
const fs=require('node:fs'),path=require('node:path');
const aero=require('./aero_core.js'),fdm=require('./fdm6.js'),heli=require('../blackhawk/heli_fdm.js');
const expected=['F16','F15','F2000','F22','SU35','F14','SU57','EA18','KC30','E7','UAV_FIXED','UAV_QUAD','GERAN2','A10','C130J','MQ9','A380','UH60'];
const files=['_integration_inspect/volo.js','.github/freeflight/patch_freeflight.py','.github/airbus/patch_a380.py','.github/blackhawk/patch_rotor.py'];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),norm=v=>Math.hypot(...v),rad=Math.PI/180;
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const root=path.resolve(__dirname,'../..'),DT=1/120;
function extract(){
 const found={};
 for(const file of files){
  const data=fs.readFileSync(path.join(root,file),'utf8');
  // A380 and UH60 fleet entries are embedded after Python string prefixes.
  // Match their exact complete object definitions, not later patch anchors.
  const rx=file.includes('airbus/')?/(A380):\{/g:
    file.includes('blackhawk/')?/(UH60):\{/g:
    /^\s*([A-Z][A-Z0-9_]*):\s*\{/gm;
  let match;
  while((match=rx.exec(data))){
   const key=match[1];if(!expected.includes(key)||found[key])continue;
   const start=match.index+match[0].lastIndexOf('{');
   let depth=0,quote=null,escape=false,end=-1;
   for(let i=start;i<data.length;i++){
    const ch=data[i];
    if(quote){
     if(escape){escape=false;continue;}
     if(ch==='\\'){escape=true;continue;}
     if(ch===quote)quote=null;
     continue;
    }
    if(ch==="'"||ch==='"'||ch===String.fromCharCode(96)){quote=ch;continue;}
    if(ch==='{')depth++;
    if(ch==='}'&&--depth===0){end=i+1;break;}
   }
   if(end<0)throw Error('Unclosed spec: '+key);
   const obj=Function('"use strict";return ('+data.slice(start,end)+');')();
   if(!Number.isFinite(obj.m)||!Number.isFinite(obj.S))throw Error('Invalid mass/area for '+key);
   found[key]=obj;
  }
 }
 const missing=expected.filter(x=>!found[x]);
 if(missing.length)throw Error('Uncovered aircraft: '+missing.join(','));
 return found;
}
const fleet=extract();
const START={
 F16:[195,4800],F15:[220,5800],F2000:[215,5800],F22:[245,6500],
 SU35:[205,5400],F14:[205,5600],SU57:[220,5800],EA18:[195,5300],
 KC30:[225,8000],E7:[190,7200],UAV_FIXED:[30,600],UAV_QUAD:[0,95],
 GERAN2:[50,800],A10:[155,4200],C130J:[140,6100],MQ9:[75,4000],
 A380:[232,9500],UH60:[0,120]
};
const PHASES=[{until:12,name:'livello',alt:0,hdg:0},
 {until:34,name:'salita',alt:400,hdg:0},
 {until:55,name:'virata',alt:400,hdg:30*rad},
 {until:72,name:'discesa',alt:100,hdg:30*rad},
 {until:100,name:'recupero',alt:220,hdg:30*rad}];
const phase=t=>PHASES.find(p=>t<p.until)||PHASES.at(-1);
function pose(s){
 const f=fdm.rotate(s.q,[0,0,1]),up=fdm.rotate(s.q,[0,1,0]),right=fdm.rotate(s.q,[-1,0,0]);
 return {heading:Math.atan2(-f[0],f[2]),bank:Math.atan2(-right[1],up[1])};
}
function pilot(s,p,initial,sp){
 const speed=norm(s.v),rot=pose(s),drone=!!sp.drone;
 const heightFactor=drone?.27:sp.nonArmato?.5:1;
 const climb=clamp((initial.h+p.alt*heightFactor-s.r[1])*.065,drone?-4:-12,drone?4:12);
 const desiredBank=clamp(Math.atan2(Math.sin(initial.hdg+p.hdg-rot.heading),Math.cos(initial.hdg+p.hdg-rot.heading))*.75,-.4,.4);
 return {roll:clamp((desiredBank-rot.bank)*1.7-s.w[2]*.18,-.68,.68),
  pitch:clamp((climb-s.v[1])*.036,-.32,.38),rudder:clamp(-s.w[1]*.12,-.2,.2),
  throttle:clamp((sp.nonAB?.78:.75)+.005*(initial.v-speed)+(climb>2?.07:0),.3,.95)};
}
const out=[];
function fixed(key,sp){
 const [speed0,h0]=START[key],s=fdm.create(sp,{r:[0,h0,0],v:[0,0,speed0]});
 const initial={h:h0,v:speed0,hdg:pose(s).heading};
 const issues=[],warnings=[],samples=[];
 let spool=.7,ab=0,fuel=sp.fuel||0,maxG=0,maxH=-Infinity,minH=Infinity,minV=Infinity,stalled=0,bad=0;
 for(let k=0;k<=90/DT;k++){
  const t=k*DT,inp=pilot(s,phase(t),initial,sp),at=aero.isa(s.r[1]);
  const mach=norm(s.v)/at.soundSpeed,nonAB=!!sp.nonAB||sp.Tmil===sp.Tab;
  const mil=nonAB?inp.throttle:(inp.throttle<=.8?.05+.95*inp.throttle/.8:1);
  const reheat=nonAB?0:Math.max(0,(inp.throttle-.8)/.2);
  spool+=(mil-spool)*(1-Math.exp(-DT/(sp.engineTau||1.4)));
  ab+=(reheat-ab)*(1-Math.exp(-DT/.6));
  const engine=aero.engine(sp,at,mach,spool,ab);
  if(k<90/DT){
   fdm.stepFixed(s,DT,inp,{mass:sp.m-(sp.fuel||0)*.5+fuel,
    thrust:fuel>0?engine.thrust:0,agl:s.r[1],gear:false,brake:false,windWorld:[0,0,0]});
   fuel=Math.max(0,fuel-DT*(sp.Tmil*spool*(nonAB?9e-6:2.2e-5)+Math.max(0,sp.Tab-sp.Tmil)*ab*5.5e-5)*engine.lapse);
  }
  if(![...s.r,...s.v,...s.q,...s.w,s.last?.nz||0].every(Number.isFinite)||Math.abs(norm(s.q)-1)>1e-5){
   issues.push('nonfinite dynamics at '+t.toFixed(2));bad=1;break;
  }
  const v=norm(s.v),g=Math.abs(s.last?.nz||0);
  maxG=Math.max(maxG,g);maxH=Math.max(maxH,s.r[1]);minH=Math.min(minH,s.r[1]);minV=Math.min(minV,v);
  if(s.last?.stalled)stalled++;
  if(k%120===0)samples.push({t:Math.round(t),phase:phase(t).name,alt_m:+s.r[1].toFixed(1),
   speed_kts:+(v*1.943844).toFixed(1),G:+(s.last?.nz||0).toFixed(2),
   mach:+(v/aero.isa(s.r[1]).soundSpeed).toFixed(3),
   heading_deg:+(pose(s).heading/rad).toFixed(1),bank_deg:+(pose(s).bank/rad).toFixed(1),
   beta_deg:+(fdm.atmosphere(s,[0,0,0]).beta/rad).toFixed(1),vs_ms:+s.v[1].toFixed(2)});
 }
 if(maxG>(sp.gmax||9)+.15)issues.push('max G '+maxG.toFixed(2)+' > '+sp.gmax);
 if(minH<Math.max(40,h0*.15))issues.push('minimum altitude unsafe: '+minH.toFixed(0));
 if(samples.length<80)issues.push('sortie incomplete');
 if(stalled>10)warnings.push('stall for '+(stalled*DT).toFixed(1)+' s');
 if(minV<speed0*.45)warnings.push('speed decay >55%');
 // A commanded turn must measurably change heading and bank; G-limit alone cannot prove it.
 const turn=samples.filter(x=>x.t>=34&&x.t<=55);
 const turnDegrees=turn.length>1?angleDelta(turn.at(-1).heading_deg*rad,turn[0].heading_deg*rad)/rad:0;
 const turnBank=Math.max(0,...turn.map(x=>Math.abs(x.bank_deg||0)));
 const turnSlip=Math.max(0,...turn.map(x=>Math.abs(x.beta_deg||0)));
 if(Math.abs(turnDegrees)<2)issues.push('commanded turn changed heading only '+turnDegrees.toFixed(1)+' deg');
 if(turnBank<1)issues.push('commanded turn did not bank: '+turnBank.toFixed(1)+' deg');
 if(Math.abs(turnDegrees)>90)issues.push('turn overshot >90 deg: '+turnDegrees.toFixed(1));
 if(turnSlip>25)warnings.push('turn sideslip >25 deg: '+turnSlip.toFixed(1));
 if(maxH<h0+20&&!sp.drone)warnings.push('poor climb response');
 const summary={name:key,type:sp.drone?'UAV':sp.nonArmato?'transport':'fighter',
  outcome:issues.length?'FAIL':warnings.length?'WARN':'PASS',maxG:+maxG.toFixed(2),
  gLimit:sp.gmax,altMin:+minH.toFixed(1),altMax:+maxH.toFixed(1),
  finalKts:samples.at(-1)?.speed_kts,
  turnDeg:+turnDegrees.toFixed(1),turnBankDeg:+turnBank.toFixed(1),turnSlipDeg:+turnSlip.toFixed(1),
  issues,warnings,samples:samples.length};
 console.log('FLEET_RESULT '+JSON.stringify(summary));
 out.push({summary,data:samples});return !bad;
}
function rotor(key,sp){
 const quad=key==='UAV_QUAD',h0=START[key][1],dt=1/120;
 const s=quad?fdm.create(sp,{r:[0,h0,0],v:[0,0,0]}):
  heli.create(sp,{r:[0,h0,0],v:[0,0,0],fuel:sp.fuel,collective:.64,rpm:1});
 let minH=Infinity,maxH=-Infinity,maxG=0;
 const issues=[],warnings=[],samples=[];
 for(let k=0;k<=90/dt;k++){
  const t=k*dt,p=phase(t),goal=h0+p.alt*(quad?.12:.18);
  const desired=clamp((goal-s.r[1])*.12,-3,3);
  const c=quad?{throttle:clamp(.5+.035*(desired-s.v[1]),.27,.76),roll:0,pitch:0,rudder:0}:
   {collective:clamp(.64+.012*(goal-s.r[1])-.04*s.v[1],.33,.85),roll:0,pitch:0,rudder:0};
  if(k<90/dt){
   if(quad)fdm.stepRotor(s,dt,c,{mass:sp.m,windWorld:[0,0,0]});
   else heli.step(s,dt,c,{mass:sp.m,rho:aero.isa(s.r[1]).rho,ground:0,windWorld:[0,0,0]});
  }
  if(![...s.r,...s.v,...s.q,...s.w].every(Number.isFinite)||Math.abs(norm(s.q)-1)>1e-5){
   issues.push('nonfinite rotor dynamics at '+t.toFixed(2));break;
  }
  minH=Math.min(minH,s.r[1]);maxH=Math.max(maxH,s.r[1]);maxG=Math.max(maxG,Math.abs(s.last?.nz||0));
  if(s.last?.crashed){issues.push('rotor impact at '+t.toFixed(2));break;}
  if(k%120===0)samples.push({t:Math.round(t),phase:p.name,alt_m:+s.r[1].toFixed(1),
   speed_kts:+(norm(s.v)*1.943844).toFixed(1),G:+(s.last?.nz||0).toFixed(2),
   heading_deg:+(pose(s).heading/rad).toFixed(1),vs_ms:+s.v[1].toFixed(2)});
 }
 if(minH<Math.max(2,h0*.12))issues.push('unsafe altitude '+minH.toFixed(1));
 if(maxH<h0+8)warnings.push('weak climb response');
 if(samples.length<80)issues.push('sortie incomplete');
 const summary={name:key,type:quad?'quadcopter':'helicopter',outcome:issues.length?'FAIL':warnings.length?'WARN':'PASS',
  maxG:+maxG.toFixed(2),gLimit:sp.gmax,altMin:+minH.toFixed(1),altMax:+maxH.toFixed(1),
  finalKts:samples.at(-1)?.speed_kts,issues,warnings,samples:samples.length};
 console.log('FLEET_RESULT '+JSON.stringify(summary));out.push({summary,data:samples});
}
for(const key of expected){
 if(key==='UH60'||key==='UAV_QUAD')rotor(key,fleet[key]);else fixed(key,fleet[key]);
}
if(out.length!==expected.length)throw Error('Not all aircraft assessed');
const counts={PASS:0,WARN:0,FAIL:0};
for(const r of out)counts[r.summary.outcome]++;
const dir=path.join(__dirname,'reports');
fs.mkdirSync(dir,{recursive:true});
const report={date:new Date().toISOString(),kind:'production-flight-engines',simulatedSeconds:90,
 validated:expected,counts,results:out,
 caveat:'Simulated air sorties, not OEM benchmark, runway test or browser QA'};
fs.writeFileSync(path.join(dir,'all-aircraft-flight-report.json'),JSON.stringify(report,null,2));
const fields=['name','type','outcome','maxG','gLimit','altMin','altMax','finalKts','turnDeg','turnBankDeg','turnSlipDeg','issues','warnings'];
fs.writeFileSync(path.join(dir,'all-aircraft-flight-summary.csv'),fields.join(',')+'\n'+
 out.map(x=>fields.map(k=>JSON.stringify(String(Array.isArray(x.summary[k])?x.summary[k].join(';'):x.summary[k]??''))).join(',')).join('\n')+'\n');
console.log('FLEET_TOTAL '+JSON.stringify({tested:out.length,counts,
 failures:out.filter(x=>x.summary.outcome==='FAIL').map(x=>x.summary.name),
 warnings:out.filter(x=>x.summary.outcome==='WARN').map(x=>x.summary.name)}));
// An existing physical flight-envelope violation must fail fleet QA, not show green.
if(out.some(x=>x.summary.outcome==='FAIL'))process.exitCode=1;
