/* CENTURION 2 · gun-audio engine
 * Original synthesized weapon SFX; no external sound recordings.
 * Separate cadence for simulated 20 mm and 27/30 mm aircraft cannons.
 * Audio only for aircraft that actually have a gun, and only while firing.
 */
(function(){
  'use strict';
  if(window.CENTURION_GUN_AUDIO)return;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function buffer(ctx,caliber){
    const high=caliber===20,rate=high?100:caliber===27?28:25;
    const sr=ctx.sampleRate,n=sr,buf=ctx.createBuffer(1,n,sr);
    const data=buf.getChannelData(0);
    let seed=high?1024385:9384715;
    const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
    let lowNoise=0;
    for(let i=0;i<n;i++){
      const t=i/sr,phase=(t*rate)%1,shotTime=phase/rate;
      const attack=1-Math.exp(-shotTime*12000);
      const crack=Math.exp(-shotTime*(high?480:320))*attack;
      const thump=Math.exp(-shotTime*(high?125:85))*attack;
      const freq=high?145:caliber===27?115:92;
      lowNoise+=(rand()-lowNoise)*.12;
      let v=.51*crack*rand()+.36*thump*Math.sin(2*Math.PI*freq*shotTime)+
        .13*thump*lowNoise;
      data[i]=clamp(v,-1,1);
    }
    return buf;
  }
  function create(AU){
    if(!AU||!AU.ctx||!AU.master)return null;
    const ctx=AU.ctx,out=AU.master;
    const compressor=ctx.createDynamicsCompressor();
    compressor.threshold.value=-17;compressor.knee.value=8;
    compressor.ratio.value=3;compressor.attack.value=.003;
    compressor.release.value=.13;compressor.connect(out);
    const echo=ctx.createDelay(.3);
    echo.delayTime.value=.10;
    const echoFilter=ctx.createBiquadFilter();echoFilter.type='lowpass';echoFilter.frequency.value=450;
    const echoGain=ctx.createGain();echoGain.gain.value=.10;
    echo.connect(echoFilter);echoFilter.connect(echoGain);echoGain.connect(compressor);
    const tracks={};
    for(const caliber of [20,27,30]){
      const src=ctx.createBufferSource();src.buffer=buffer(ctx,caliber);src.loop=true;
      const tone=ctx.createBiquadFilter();tone.type='lowpass';tone.frequency.value=caliber===20?2400:1850;
      const gain=ctx.createGain();gain.gain.value=0;
      src.connect(tone);tone.connect(gain);gain.connect(compressor);gain.connect(echo);
      src.start();tracks[caliber]={src,tone,gain};
    }
    let last=0,disposed=false;
    function update(active,model,external){
      if(disposed)return;
      const id=String(model||'').toLowerCase();
      const caliber=/^(f16|f22|f15)/.test(id)?20:/typhoon|eurofighter|ef2000/.test(id)?27:30;
      const now=ctx.currentTime;
      if(active&&ctx.state==='suspended'){
        // Context is unlocked by the original Start/Fire user gesture.
        // Never start audio unprompted from the animation loop.
      }
      const volume=external?.73:.55;
      for(const [name,track] of Object.entries(tracks)){
        const on=active&&+name===caliber&&ctx.state==='running';
        const target=on?volume:0;
        track.gain.gain.cancelScheduledValues(now);
        track.gain.gain.setTargetAtTime(target,now,on?.008:.028);
      }
      last=now;
    }
    function dispose(){
      if(disposed)return;disposed=true;
      for(const {src,tone,gain}of Object.values(tracks)){
        try{src.stop();}catch(_){}
        src.disconnect();tone.disconnect();gain.disconnect();
      }
      echo.disconnect();echoFilter.disconnect();echoGain.disconnect();compressor.disconnect();
    }
    return {update,dispose,kind:'synth-gun-v1'};
  }
  window.CENTURION_GUN_AUDIO=Object.freeze({create});
})();