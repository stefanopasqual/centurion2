'use strict';
/*
 * CENTURION2: virtual flight-test pilot (deterministic and repeatable).
 * Uses EXACT production AERO and FDM6 code, with no mock flight equations.
 * NOT an OEM or simulator certification. Run: node .github/aero/test_pilota_prova.cjs
 */
const fdm=require('./fdm6.js');
const aero=require('./aero_core.js');
const fs=require('node:fs');
const path=require('node:path');
const DT=1/120,DEG=180/Math.PI;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
const norm=v=>Math.hypot(...v);
const MODELS={
  F16:{icona:'f16',m:12000,S:27.87,span:9.96,Tmil:76300,Tab:127000,cla:3.6,astall:28,amax:25,cd0:.0175,gmax:9,gneg:3,pmax:240,fuel:3200,v0:195,alt0:4800},
  F22:{icona:'f22',m:29000,S:78,span:13.56,Tmil:232000,Tab:312000,cla:3.2,astall:45,amax:40,cd0:.018,gmax:9,gneg:3,pmax:200,fuel:8200,v0:245,alt0:6500},
  A10:{icona:'a10',m:20000,S:47,span:17.53,Tmil:80600,Tab:80600,cla:4.6,astall:24,amax:20,cd0:.032,gmax:7.33,gneg:3,pmax:110,nonAB:true,fuel:4850,v0:155,alt0:4200},
  A380:{icona:'a380',m:445000,S:845,span:79.8,length:72.7,height:24.1,Tmil:1240000,Tab:1240000,cla:5.2,astall:17,amax:14,cd0:.0205,gmax:2.5,gneg:1,pmax:22,nonAB:true,servoTau:.5,fuel:170000,v0:232,alt0:9500}
};
const PHASES=[
  {from:0,to:12,name:'livellamento',deltaAlt:0,deltaHdg:0},
  {from:12,to:34,name:'salita',deltaAlt:400,deltaHdg:0},
  {from:34,to:55,name:'virata',deltaAlt:400,deltaHdg:Math.PI/6},
  {from:55,to:72,name:'discesa',deltaAlt:100,deltaHdg:Math.PI/6},
  {from:72,to:90,name:'recupero',deltaAlt:220,deltaHdg:Math.PI/6}
];
function pose(s){
  const nose=fdm.rotate(s.q,[0,0,1]),up=fdm.rotate(s.q,[0,1,0]),right=fdm.rotate(s.q,[-1,0,0]);
  return {heading:Math.atan2(-nose[0],nose[2]),bank:Math.atan2(-right[1],up[1]),
    pitch:Math.asin(clamp(nose[1],-1,1))};
}
function pilot(s,phase,initial,spec){
  const p=pose(s),speed=norm(s.v),delta=phase.deltaAlt* (spec.icona==='a380'?.5:1);
  const vGoal=clamp((initial.alt+delta-s.r[1])*.065,-12,12);
  const speedBase=spec.nonAB?.78:.75;
  const throttle=clamp(speedBase+.005*(initial.speed-speed)+(vGoal>2?.07:0),
    spec.nonAB?.38:.38,spec.nonAB?.95:.96);
  const errorH=wrap(initial.heading+phase.deltaHdg-p.heading);
  const bankGoal=clamp(errorH*.75,-.40,.40);
  return {
    pitch:clamp((vGoal-s.v[1])*.036,-.32,.38),
    roll:clamp((bankGoal-p.bank)*1.7-s.w[2]*.18,-.68,.68),
    rudder:clamp(-s.w[1]*.12,-.2,.2),
    throttle
  };
}
function sortie(name,spec){
  const s=fdm.create(spec,{r:[0,spec.alt0,0],v:[0,0,spec.v0]});
  const initial={alt:s.r[1],heading:pose(s).heading,speed:norm(s.v)};
  const rows=[],issues=[],tot=Math.round(90/DT);
  let spool=.7,ab=0,fuel=spec.fuel,maxG=0,minAlt=Infinity,maxAlt=0;
  for(let tick=0;tick<=tot;tick++){
    const t=tick*DT,phase=PHASES.find(p=>t>=p.from&&t<p.to)||PHASES[PHASES.length-1];
    const c=pilot(s,phase,initial,spec);
    const speed=norm(s.v),at=aero.isa(s.r[1]),mach=speed/at.soundSpeed;
    const mil=spec.nonAB?c.throttle:(c.throttle<=.8?.05+.95*c.throttle/.8:1);
    const after=spec.nonAB?0:Math.max(0,(c.throttle-.8)/.2);
    spool+=(mil-spool)*(1-Math.exp(-DT/(spec.nonAB?3:1.4)));
    ab+=(after-ab)*(1-Math.exp(-DT/.6));
    const engine=aero.engine(spec,at,mach,spool,ab);
    const mass=spec.m-spec.fuel*.5+fuel;
    if(tick<tot){
      fdm.stepFixed(s,DT,c,{mass,thrust:engine.thrust,agl:s.r[1],gear:false,brake:false,windWorld:[0,0,0]});
      fuel=Math.max(0,fuel-(spec.Tmil*spool*2.2e-5+(spec.Tab-spec.Tmil)*ab*5.5e-5)*engine.lapse*DT);
    }
    if(![...s.r,...s.v,...s.q,...s.w,s.last?.nz||0].every(Number.isFinite)){
      issues.push('nonfinite state at t='+t.toFixed(2));
      break;
    }
    const qnorm=norm(s.q);
    if(Math.abs(qnorm-1)>1e-5){issues.push('quaternion drift t='+t.toFixed(2));break;}
    const actualG=Math.abs(s.last?.nz||0);
    maxG=Math.max(maxG,actualG);
    minAlt=Math.min(minAlt,s.r[1]);maxAlt=Math.max(maxAlt,s.r[1]);
    if(tick%120===0){
      const p=pose(s);
      rows.push({t:Math.round(t),phase:phase.name,
        alt_m:+s.r[1].toFixed(2),speed_kts:+(norm(s.v)*1.943844).toFixed(2),
        mach:+(norm(s.v)/aero.isa(s.r[1]).soundSpeed).toFixed(3),
        g:+(s.last?.nz||0).toFixed(3),bank_deg:+(p.bank*DEG).toFixed(2),
        heading_deg:+(p.heading*DEG).toFixed(2),vs_ms:+s.v[1].toFixed(2),
        pitch_deg:+(p.pitch*DEG).toFixed(2),fuel_kg:+fuel.toFixed(1)});
    }
  }
  const hi=spec.icona==='a380'?3.5:11;
  if(maxG>hi)issues.push('excessive G '+maxG.toFixed(1));
  if(minAlt<100)issues.push('terrain collision risk at '+minAlt.toFixed(1)+' m');
  if(rows.length<80)issues.push('sortie ended early');
  const summary={name,result:issues.length?'FLAG':'PASS',minAlt:+minAlt.toFixed(1),
    maxAlt:+maxAlt.toFixed(1),maxG:+maxG.toFixed(2),
    finalSpeed:rows.at(-1)?.speed_kts,initialSpeed:rows[0]?.speed_kts,
    issues,samples:rows.length};
  console.log('SORTIE '+JSON.stringify(summary));
  return {summary,rows};
}
const sorties=Object.entries(MODELS).map(([k,v])=>sortie(k,v));
const report={version:'freeflight-test-pilot-v1',dt:DT,source:'production aero_core.js + fdm6.js',
  caveat:'Model and AI pilot are approximate, not OEM flight-test data',sorties,phases:PHASES};
const output=path.join(__dirname,'reports');
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'freeflight-test-pilot.json'),JSON.stringify(report,null,2));
for(const x of sorties){
  const h=Object.keys(x.rows[0]);
  fs.writeFileSync(path.join(output,x.summary.name+'.csv'),h.join(',')+'\n'+x.rows.map(row=>h.map(k=>row[k]).join(',')).join('\n')+'\n');
}
console.log('GRAPHIFY_DATA '+JSON.stringify(sorties.map(x=>({name:x.summary.name,summary:x.summary,data:x.rows.filter(y=>y.t%5===0)}))));
console.log('TEST_PILOT_RESULT '+sorties.map(x=>x.summary.result).join(','));
if(sorties.some(x=>x.summary.issues.some(y=>y.startsWith('nonfinite'))))process.exitCode=1;
