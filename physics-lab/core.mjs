// Standalone educational rigid-body laboratory; not an aircraft or mission model.
// World: right-handed local ENU, body: right-handed XYZ, SI, q=[x,y,z,w] body->world.
// r is center-of-mass position, omega is body angular velocity. Constant mass/inertia.
const finite=(x,name)=>{if(!Number.isFinite(x))throw new RangeError(name+' must be finite');return x;};
function vec(a,n,name){
  if(!a||a.length!==n)throw new RangeError(name+' must have '+n+' components');
  return Array.from(a,(x,i)=>finite(x,name+'['+i+']'));
}
const add=(a,b)=>a.map((x,i)=>x+b[i]),scale=(a,k)=>a.map(x=>x*k);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
function normalize(q){
  const n=Math.hypot(...q);
  if(!Number.isFinite(n)||n<1e-12)throw new RangeError('invalid quaternion');
  return q.map(x=>x/n);
}
function quaternionRate(q,w){
  const a=q.slice(0,3),v=add(scale(w,q[3]),cross(a,w));
  return [...scale(v,.5),-.5*dot(a,w)];
}
export function rotate(q,v){
  const a=q.slice(0,3),t=scale(cross(a,v),2);
  return add(v,add(scale(t,q[3]),cross(a,t)));
}
export function state(r=[0,0,0],v=[0,0,0],q=[0,0,0,1],w=[0,0,0]){
  const quat=vec(q,4,'q');
  if(Math.abs(Math.hypot(...quat)-1)>1e-8)throw new RangeError('non-unit quaternion');
  return {r:vec(r,3,'r'),v:vec(v,3,'v'),q:normalize(quat),w:vec(w,3,'omega')};
}
// Inertia entries are actual signed matrix entries, not products of inertia.
export function massProperties(mass,inertia,{physical=true}={}){
  finite(mass,'mass');
  if(mass<=0)throw new RangeError('mass must be positive');
  const I=vec(inertia,9,'inertia');
  const magnitude=Math.max(...I.map(Math.abs));
  if(magnitude===0)throw new RangeError('zero inertia');
  for(const [a,b] of [[1,3],[2,6],[5,7]]){
    if(Math.abs(I[a]/magnitude-I[b]/magnitude)>1e-12)throw new RangeError('inertia must be symmetric');
    I[a]=I[b]=I[a]/2+I[b]/2;
  }
  if(physical){
    // A physical inertia requires (trace(I)/2)*Id - I to be positive semidefinite.
    // Check all principal minors on the scaled matrix; tolerance covers round-off.
    const J=I.map(x=>x/magnitude),h=(J[0]+J[4]+J[8])/2;
    const a=h-J[0],b=h-J[4],c=h-J[8],d=-J[1],e=-J[2],f=-J[5];
    const minors=[a,b,c,a*b-d*d,a*c-e*e,b*c-f*f,a*b*c+2*d*e*f-a*f*f-b*e*e-c*d*d];
    if(minors.some(x=>x < -1e-12))throw new RangeError('inertia is not physically realizable');
  }
  // Cholesky validates positive definiteness and solves I*x=b without a matrix inverse.
  const l00=Math.sqrt(I[0]),l10=I[3]/l00,l20=I[6]/l00;
  const l11=Math.sqrt(I[4]-l10*l10),l21=(I[7]-l20*l10)/l11;
  const l22=Math.sqrt(I[8]-l20*l20-l21*l21);
  if(![l00,l11,l22].every(x=>Number.isFinite(x)&&x>0)||![l10,l20,l21].every(Number.isFinite))
    throw new RangeError('inertia must be positive definite');
  const multiply=w=>[dot(I.slice(0,3),w),dot(I.slice(3,6),w),dot(I.slice(6,9),w)];
  const solve=b=>{
    const y0=b[0]/l00,y1=(b[1]-l10*y0)/l11,y2=(b[2]-l20*y0-l21*y1)/l22;
    const x2=y2/l22,x1=(y1-l21*x2)/l11,x0=(y0-l10*x1-l20*x2)/l00;
    return [x0,x1,x2];
  };
  const cols=[[1,0,0],[0,1,0],[0,0,1]].map(solve);
  const norm=Math.max(...[0,1,2].map(i=>I.slice(3*i,3*i+3).reduce((s,x)=>s+Math.abs(x/magnitude),0)));
  const invNorm=Math.max(...[0,1,2].map(i=>cols.reduce((s,col)=>s+Math.abs(col[i]*magnitude),0)));
  const condition=norm*invNorm;
  if(!Number.isFinite(condition)||condition>1e10)throw new RangeError('ill-conditioned inertia');
  return Object.freeze({mass,inertia:Object.freeze(I),multiply,solve,condition,physical});
}
export const noLoads=()=>({force:[0,0,0],moment:[0,0,0]});
// Pure, time-dependent force/moment providers, all expressed about the CG in body axes.
export function combineLoads(...providers){
  return (s,t)=>{
    let force=[0,0,0],moment=[0,0,0];
    for(const provider of providers){
      const load=provider(s,t);
      force=add(force,vec(load.force,3,'force'));moment=add(moment,vec(load.moment,3,'moment'));
    }
    return {force,moment};
  };
}
export function createKernel(props,{gravity=[0,0,-9.80665],loads=noLoads}={}){
  const g=vec(gravity,3,'gravity');
  // The mass/inertia contract is constant within a trajectory; variable mass needs separate EOM.
  const derivative=(s,t)=>{
    // Read-only stage state; determinism of the provider's own external state is its responsibility.
    for(const a of [s.r,s.v,s.q,s.w])Object.freeze(a);
    const load=loads(Object.freeze(s),finite(t,'stage time'));
    const force=vec(load.force,3,'force'),moment=vec(load.moment,3,'moment');
    const accel=add(scale(rotate(s.q,force),1/props.mass),g);
    const angular=props.solve(add(moment,scale(cross(s.w,props.multiply(s.w)),-1)));
    return {r:s.v,v:accel,q:quaternionRate(s.q,s.w),w:angular};
  };
  const advance=(s,k,h)=>({
    r:add(s.r,scale(k.r,h)),v:add(s.v,scale(k.v,h)),
    q:normalize(add(s.q,scale(k.q,h))),w:add(s.w,scale(k.w,h))
  });
  return Object.freeze({
    // Full-state explicit midpoint; providers evaluated at both stages.
    step(s,t,dt){
      finite(t,'time');finite(dt,'dt');
      if(dt<=0)throw new RangeError('dt must be positive');
      const start=state(s.r,s.v,s.q,s.w);
      const m=advance(start,derivative(start,t),dt/2);
      const mid=state(m.r,m.v,m.q,m.w);
      const next=advance(start,derivative(mid,t+dt/2),dt);
      return state(next.r,next.v,next.q,next.w);
    },
    invariants(s){
      const H=props.multiply(s.w);
      return {angularMomentumWorld:rotate(s.q,H),rotationalEnergy:.5*dot(s.w,H),quaternionNorm:Math.hypot(...s.q)};
    }
  });
}
