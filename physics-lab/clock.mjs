// Wall-clock scheduling for the standalone lab. Time is integer tick * dt.
export function createClock({hz=120,maxSteps=30,maxRecoverySeconds=.25}={}){
  if(!Number.isInteger(hz)||hz<=0||!Number.isInteger(maxSteps)||maxSteps<=0||
     !Number.isFinite(maxRecoverySeconds)||maxRecoverySeconds<=0)throw new RangeError('invalid clock options');
  const dt=1/hz;
  let tick=0,remainder=0,dropped=0;
  return {
    dt,
    get tick(){return tick;},
    get time(){return tick*dt;},
    get droppedSeconds(){return dropped;},
    advance(elapsed,step){
      if(!Number.isFinite(elapsed)||elapsed<0)throw new RangeError('invalid elapsed time');
      const accepted=Math.min(elapsed,maxRecoverySeconds);
      let discarded=elapsed-accepted;
      remainder+=accepted;
      const due=Math.floor((remainder+dt*1e-9)/dt),count=Math.min(due,maxSteps);
      let completed=0;
      for(;completed<count;completed++){
        step(tick*dt,dt,tick);
        tick++;remainder-=dt;
      }
      // Excess backlog is explicitly reported, never silently carried indefinitely.
      const excess=due-count;
      if(excess){discarded+=excess*dt;remainder-=excess*dt;}
      if(Math.abs(remainder)<dt*1e-9)remainder=0;
      dropped+=discarded;
      return {steps:completed,tick,time:tick*dt,alpha:remainder/dt,overrun:discarded>0,droppedSeconds:discarded};
    },
    // Call on pause/visibility change; callers must reset their wall-clock timestamp.
    resetRemainder(){const discarded=remainder;dropped+=discarded;remainder=0;return discarded;}
  };
}
