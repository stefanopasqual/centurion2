'use strict';
/* Safety/realism acceptance tests. These must fail until the physics
 * handles rotor windmilling and hard/fast ground contact properly.
 * No unvalidated claim that UH-60 flight is realistic.
 */
const rotor=require('./heli_fdm.js');
const spec={icona:'uh60-centurion',m:9500,fuel:1650,gearHeight:1.85,
  collectiveHover:.64,span:16.36,length:19.76,height:5.13,S:201};
let failures=0;
function verify(ok,label,detail){
  console.log((ok?'PASS':'FAIL')+' UH60 REALISM: '+label+' | '+detail);
  if(!ok)failures++;
}
function env(){return {mass:9500,rho:1.225,ground:0,windWorld:[0,0,0]};}
// Turbines flame out: an already spinning rotor must NOT lose ALL
// aerodynamic lift instantly; free-wheeling/autorotation is required.
{
  const s=rotor.create(spec,{r:[0,120,0],v:[0,-5,0],fuel:0,collective:.40,rpm:1});
  const out=rotor.step(s,1/60,{collective:.40},env());
  verify(out.rotorLift>1000,'rotor windmill / nonzero transient lift after engine failure',
    'rotorLift='+out.rotorLift.toFixed(1)+' N');
}
// A high-energy touchdown is not a normal landing. The detector must
// survive a multi-substep 60-Hz update.
{
  const s=rotor.create(spec,{r:[0,1.87,0],v:[0,-15,0],collective:.15});
  const out=rotor.step(s,1/60,{collective:.15},env());
  verify(out.hardLanding===true,'15 m/s vertical touchdown flagged',
    'hardLanding='+out.hardLanding+'; onGround='+out.onGround);
}
// Lateral/forward impact with a runway at 80 m/s must be flagged
// even when the vertical sink rate is small.
{
  const s=rotor.create(spec,{r:[0,1.85,0],v:[0,-.1,80],collective:.15});
  const out=rotor.step(s,1/60,{collective:.15},env());
  verify(out.hardLanding===true||out.unsafeLanding===true,
    '80 m/s horizontal ground impact flagged',
    'groundSpeed='+Math.hypot(s.v[0],s.v[2]).toFixed(1)+' m/s; hardLanding='+out.hardLanding);
}
if(failures){
  console.error('FAIL UH60 REALISM: '+failures+' critical flight-safety cases are unresolved');
  process.exitCode=1;
}else console.log('PASS UH60 REALISM: rotor windmill and hard landing cases');
