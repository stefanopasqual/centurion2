'use strict';
/*
 * CENTURION2 -- UH-60 VIRTUAL TEST PILOT (deterministic, 60 Hz).
 * Flies the same rotorcraft FDM imported by Free Flight, not a mock.
 * This is an automated simulated pilot, NOT a human pilot evaluation,
 * not browser/WebGL QA and not certification or OEM flight-test data.
 */
const fs=require('node:fs');
const path=require('node:path');
const fdm=require('../aero/fdm6.js');
const heli=require('./heli_fdm.js');
const G=9.80665,PI=Math.PI,DT=1/60;
const spec={icona:'uh60-centurion',m:9500,fuel:1650,gearHeight:1.85,
 collectiveHover:.64,length:19.76,span:16.36,height:5.13,S:201,
 rotorRadius:8.18,shaftPower:3150000};
const environment={mass:9500,rho:1.225,ground:0,windWorld:[0,0,0]};
const results=[],telemetry=[];
let failures=0;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
const norm=a=>Math.hypot(...a);
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
const finite=s=>s.r.every(Number.isFinite)&&s.v.every(Number.isFinite)&&
  s.q.every(Number.isFinite)&&s.w.every(Number.isFinite)&&
  Math.abs(norm(s.q)-1)<1e-6;
function orientation(s){
  const nose=fdm.rotate(s.q,[0,0,1]);
  const right=fdm.rotate(s.q,[-1,0,0]);
  return {nose,right,heading:Math.atan2(-nose[0],nose[2])};
}
function record(s,phase){
  const o=s.last||{},body=orientation(s);
  telemetry.push({
    t:+s.time.toFixed(2),phase,
    x:+s.r[0].toFixed(3),agl:+s.r[1].toFixed(3),z:+s.r[2].toFixed(3),
    vx:+s.v[0].toFixed(3),vs:+s.v[1].toFixed(3),vz:+s.v[2].toFixed(3),
    speed:+Math.hypot(s.v[0],s.v[2]).toFixed(3),
    heading:+(body.heading*180/PI).toFixed(2),
    collective:+s.collective.toFixed(3),
    rpm:+s.rpm.toFixed(3),
    lift:+(o.rotorLift||0).toFixed(1),
    fuel:+s.fuel.toFixed(3),
    onGround:!!o.onGround,hardLanding:!!o.hardLanding,
    unsafeLanding:!!o.unsafeLanding,crashed:!!o.crashed
  });
}
function grade(name,ok,details){
  results.push({name,pass:!!ok,details});
  if(!ok)failures++;
  console.log((ok?'PASS':'FAIL')+' TEST-PILOT '+name+' | '+details);
}
function create(initial){
  return heli.create(spec,Object.assign({r:[0,120,0],v:[0,0,0],fuel:1650,
    collective:.64,rpm:1},initial||{}));
}
function fly(s,phase,seconds,controller,wind=[0,0,0]){
  const count=Math.round(seconds/DT),start=s.time;
  let minAlt=Infinity,maxAlt=-Infinity,maxSpeed=0,maxSink=0,contact=false,anyCrash=false;
  const env=Object.assign({},environment,{windWorld:wind});
  for(let k=0;k<count;k++){
    const input=controller(s,k*DT);
    const previousV=s.v.slice();
    const o=heli.step(s,DT,input,env);
    if(!finite(s))throw Error('Non-finite dynamics in '+phase+' at '+k);
    if(o.onGround)contact=true;
    if(o.crashed)anyCrash=true;
    if(o.onGround && previousV[1]<-5.5)maxSink=Math.min(maxSink,previousV[1]);
    minAlt=Math.min(minAlt,s.r[1]); maxAlt=Math.max(maxAlt,s.r[1]);
    maxSpeed=Math.max(maxSpeed,Math.hypot(s.v[0],s.v[2]));
    if(k%30===0)record(s,phase);
  }
  const att=orientation(s);
  const end={phase,start:+start.toFixed(2),end:+s.time.toFixed(2),
    alt:+s.r[1].toFixed(2),x:+s.r[0].toFixed(2),z:+s.r[2].toFixed(2),
    vs:+s.v[1].toFixed(2),speed:+Math.hypot(s.v[0],s.v[2]).toFixed(2),
    heading:+(att.heading*180/PI).toFixed(2),minAlt:+minAlt.toFixed(2),
    maxAlt:+maxAlt.toFixed(2),maxSpeed:+maxSpeed.toFixed(2),
    maxImpactSink:+maxSink.toFixed(2),contact,anyCrash,
    rotorRPM:+s.rpm.toFixed(3),fuel:+s.fuel.toFixed(2)};
  console.log('FLIGHT-PHASE '+JSON.stringify(end));
  return end;
}
/* A deliberately simple pilot model: visual-height-hold collective,
 * speed-hold cyclic, heading-hold pedals. It uses simulated position/velocity
 * feedback; results assess the flight model AND this test pilot, not a human.
 */
function virtualPilot(target){
  return s=>{
    if(target.idle)return {collective:.20,roll:0,pitch:0,rudder:0};
    const att=orientation(s);
    const forwardSpeed=dot(s.v,att.nose);
    const rightSpeed=dot(s.v,att.right);
    const altitude=typeof target.alt==='function'?target.alt(s):(target.alt??120);
    const altError=altitude-s.r[1];
    const collective=clamp(.64+.012*altError-.042*s.v[1],.24,.84);
    const pitch=clamp(-.035*((target.speed||0)-forwardSpeed),-.32,.32);
    const roll=clamp(-.032*rightSpeed,-.28,.28);
    const yawError=angle((target.heading||0)-att.heading);
    const rudder=clamp(.80*yawError,-.48,.48);
    return {collective,roll,pitch,rudder};
  };
}
console.log('VIRTUAL TEST PILOT | version '+heli.version+' | step='+DT+
  's | world +Y up, body +Z nose | results are NOT OEM-validated');
let s=create({r:[0,1.85,0],collective:.20});
const idle=fly(s,'ground-idle',3,virtualPilot({idle:true}));
grade('preflight idle stays grounded',idle.alt<=1.88&&idle.speed<1.0,
  'alt='+idle.alt+'m speed='+idle.speed+'m/s');
const takeoff=fly(s,'powered-takeoff',16,virtualPilot({alt:28}));
grade('controlled takeoff',takeoff.alt>10&&!s.last.onGround&&!takeoff.anyCrash,
  'alt='+takeoff.alt+'m max='+takeoff.maxAlt+'m');
const hovering=fly(s,'hover-height-hold',16,virtualPilot({alt:28}));
grade('stabilized height hold',Math.abs(hovering.alt-28)<2&&Math.abs(hovering.vs)<1&&!hovering.anyCrash,
  'alt='+hovering.alt+'m verticalSpeed='+hovering.vs+'m/s');
const beforeForward=s.r.slice();
const forward=fly(s,'forward-transition',14,virtualPilot({alt:28,speed:14}));
const forwardTravel=Math.hypot(s.r[0]-beforeForward[0],s.r[2]-beforeForward[2]);
grade('cyclic forward motion',forwardTravel>80&&forward.speed>8&&forward.speed<25&&!forward.anyCrash,
  'distance='+forwardTravel.toFixed(1)+'m speed='+forward.speed+'m/s');
const beforeTurn=orientation(s).heading;
const turn=fly(s,'ninety-degree-turn',16,virtualPilot({alt:28,speed:10,heading:PI/2}));
const angleTurn=Math.abs(angle(orientation(s).heading-beforeTurn));
grade('pedal heading turn',angleTurn>1.0&&Math.abs(angle(orientation(s).heading-PI/2))<.35&&turn.speed<25&&!turn.anyCrash,
  'yaw='+((angleTurn*180/PI).toFixed(1))+'deg heading='+turn.heading+'deg');
const braking=fly(s,'forward-braking',15,virtualPilot({alt:28,heading:PI/2,speed:0}));
grade('braking toward hover',braking.speed<2&&!braking.anyCrash,
  'horizontal speed='+braking.speed+'m/s');
const approachStart=s.time,approachAlt=s.r[1];
const approach=fly(s,'precision-approach',28,virtualPilot({
  alt:state=>Math.max(1.85,approachAlt-1.25*(state.time-approachStart)),
  heading:PI/2,speed:0
}));
const settled=fly(s,'landing-settle',5,virtualPilot({idle:true}));
grade('gentle landing completed',!!s.last.onGround&&settled.speed<2&&
  !approach.anyCrash&&!settled.anyCrash&&!s.crashed,
  'ground='+!!s.last.onGround+' horizontal='+settled.speed+
  'm/s sinkOnContact='+approach.maxImpactSink+'m/s');
// Isolated hazard cases, flown directly through the same actual FDM.
const stationary=create({r:[0,120,0]});
const trim=fly(stationary,'hands-off-trim',20,()=>({collective:.64,roll:0,pitch:0,rudder:0}));
grade('hands-off nominal hover',Math.abs(trim.alt-120)<1.0&&trim.speed<1,
  'height drift='+(trim.alt-120).toFixed(3)+'m speed='+trim.speed+'m/s');
const crosswind=create({r:[0,120,0]});
const wind=fly(crosswind,'crosswind-hover-12mps',12,virtualPilot({alt:120}),[12,0,0]);
grade('crosswind test remains finite',finite(crosswind)&&wind.alt>100&&wind.speed<12&&!wind.anyCrash,
  'alt='+wind.alt+'m drift='+Math.hypot(crosswind.r[0],crosswind.r[2]).toFixed(1)+'m');
const failedEngine=create({r:[0,120,0],v:[0,-5,0],fuel:0,collective:.4,rpm:1});
heli.step(failedEngine,DT,{collective:.4},environment);
record(failedEngine,'engine-out-instant');
grade('engine-out rotor windmilling',failedEngine.last.rotorLift>1000,
  'lift='+failedEngine.last.rotorLift.toFixed(1)+'N, rpm='+failedEngine.rpm.toFixed(3));
const hard=create({r:[0,1.87,0],v:[0,-15,0],collective:.15});
heli.step(hard,DT,{collective:.15},environment);
record(hard,'hard-touchdown');
grade('hard vertical landing detected',hard.last.hardLanding===true,
  'sink=15m/s hardLanding='+hard.last.hardLanding);
const runOn=create({r:[0,1.85,0],v:[0,-.1,80],collective:.15});
heli.step(runOn,DT,{collective:.15},environment);
record(runOn,'high-speed-ground-contact');
grade('high-speed ground contact detected',
  runOn.last.hardLanding===true||runOn.last.unsafeLanding===true,
  'horizontal='+Math.hypot(runOn.v[0],runOn.v[2]).toFixed(1)+
  'm/s hardLanding='+runOn.last.hardLanding+' unsafe='+runOn.last.unsafeLanding);
function rateProfile(dt){
  const t=create({r:[0,120,0]});
  for(let i=0;i<Math.round(10/dt);i++)
    heli.step(t,dt,{collective:.65,pitch:-.08},environment);
  return t;
}
const r30=rateProfile(1/30),r60=rateProfile(1/60),r120=rateProfile(1/120);
const error=Math.max(Math.hypot(...r30.r.map((v,i)=>v-r60.r[i])),
                     Math.hypot(...r120.r.map((v,i)=>v-r60.r[i])));
grade('30/60/120 Hz repeatability',error<.4,
  'max endpoint difference='+error.toFixed(4)+'m');
// Record inspectable telemetry even when validation fails.
const outDir=path.join(__dirname,'reports');
fs.mkdirSync(outDir,{recursive:true});
const report={generatedAt:new Date().toISOString(),commit:process.env.GITHUB_SHA||'local',
  modelVersion:heli.version,kind:'deterministic virtual pilot (not human/browser QA)',
  status:failures===0?'PASS':'FAIL',failures,
  phases:telemetry.map(x=>x.phase).filter((x,i,a)=>a.indexOf(x)===i),results,telemetry};
fs.writeFileSync(path.join(outDir,'pilot-report.json'),JSON.stringify(report,null,2));
const cols=Object.keys(telemetry[0]);
fs.writeFileSync(path.join(outDir,'pilot-telemetry.csv'),cols.join(',')+'\n'+
  telemetry.map(r=>cols.map(k=>String(r[k])).join(',')).join('\n')+'\n');
console.log('VIRTUAL PILOT FINAL: '+(failures===0?'PASS':'FAIL')+
  ' | '+(results.length-failures)+'/'+results.length+' checks pass | '+
  telemetry.length+' flight telemetry samples | '+outDir);
process.exitCode=failures?1:0;
