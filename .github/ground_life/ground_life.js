/* CENTURION2: fictional ambient civilian activity for the 3D world.
 * Procedural scenery, not geolocated real facilities or real activity.
 * Low-poly/mobile bounded, non-targetable, no collisions or combat effects.
 */
(function(){
  'use strict';
  if(window.CENTURION_GROUND_LIFE)return;
  const T=window.THREE;if(!T)return;
  const TAU=Math.PI*2;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const material=(color,extra)=>new T.MeshStandardMaterial({color,roughness:.85,metalness:.05,...(extra||{})});
  const mats={
    concrete:material(0xadb4b1),roof:material(0x697783),brick:material(0x8f6c58),
    asphalt:material(0x41474a),line:material(0xd3c89a),
    steel:material(0x5f6972,{metalness:.45,roughness:.53}),window:material(0x3e6573,{metalness:.23}),
    truck:material(0xb1a492),red:material(0x9f4948),blue:material(0x4a748b),
    human:material(0x526473),skin:material(0xb18e74),dark:material(0x323632),
    animal:material(0xb8ad99),leaf:material(0x607759),wood:material(0x6c5744),
    yellow:material(0xe0a748),smoke:material(0xabb4bb,{transparent:true,opacity:.19,depthWrite:false})
  };
  const boxGeo=(a,b,c)=>new T.BoxGeometry(a,b,c);
  const GEO={sphere:new T.SphereGeometry(1,9,7),cyl:new T.CylinderGeometry(1,1,1,10)};
  const owned=[];
  function box(g,a,b,c,mat,x,y,z){
    const geo=boxGeo(a,b,c);owned.push(geo);
    const m=new T.Mesh(geo,mat);m.position.set(x,y,z);g.add(m);
    m.castShadow=false;m.receiveShadow=true;return m;
  }
  function ball(g,mat,x,y,z,scale){
    const m=new T.Mesh(GEO.sphere,mat);
    m.position.set(x,y,z);m.scale.set(...scale);g.add(m);return m;
  }
  function column(g,mat,r,h,x,y,z){
    const m=new T.Mesh(GEO.cyl,mat);m.position.set(x,y,z);m.scale.set(r,h,r);g.add(m);return m;
  }
  function seed(n){let x=(n>>>0)||213;return()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296;};}
  function human(parent,rng,x,z){
    const g=new T.Group();g.position.set(x,0,z);parent.add(g);
    box(g,.44,.85,.24,mats.human,0,1.24,0);
    ball(g,mats.skin,0,1.85,0,[.17,.19,.17]);
    const arms=[],legs=[];
    for(const side of [-1,1]){
      const arm=new T.Group();arm.position.set(side*.30,1.58,0);g.add(arm);
      box(arm,.15,.6,.17,mats.human,0,-.29,0);arms.push(arm);
      const leg=new T.Group();leg.position.set(side*.14,.76,0);g.add(leg);
      box(leg,.18,.69,.21,mats.dark,0,-.35,0);legs.push(leg);
    }
    return {g,arms,legs,speed:.35+rng()*.65,phase:rng()*TAU,kind:'person',homeX:x,homeZ:z};
  }
  function animal(parent,rng,x,z){
    const g=new T.Group();g.position.set(x,0,z);parent.add(g);
    const scale=.65+rng()*.3;
    ball(g,mats.animal,0,.65,0,[.83*scale,.48*scale,.43*scale]);
    ball(g,mats.animal, .65*scale,.83*scale,0,[.35*scale,.34*scale,.33*scale]);
    for(const xx of [-.5,.47])for(const zz of [-.29,.29])
      box(g,.13*scale,.62*scale,.13*scale,mats.dark,xx*scale,.30*scale,zz*scale);
    return {g,speed:.1+rng()*.18,phase:rng()*TAU,kind:'animal',homeX:x,homeZ:z};
  }
  function vehicle(parent,rng,x,z){
    const g=new T.Group();g.position.set(x,0,z);parent.add(g);
    const truck=rng()>.63;
    box(g,truck?4.8:3.4,truck?1.65:1.10,truck?2.25:1.80,
      truck?mats.truck:(rng()>.5?mats.blue:mats.red),0,1.05,0);
    box(g,truck?1.9:1.9,.66,truck?2:1.5,mats.window,truck?1.0:-.2,truck?2.15:1.84,0);
    for(const xx of [-1.14,1.14])for(const zz of [-.95,.95]){
      const wheel=new T.Mesh(GEO.cyl,mats.dark);
      wheel.position.set(xx,.49,zz);wheel.rotation.x=Math.PI/2;
      wheel.scale.set(.4,.16,.4);g.add(wheel);
    }
    return {g,speed:truck?5+rng()*4:8+rng()*6,phase:rng()*TAU,
      kind:'vehicle',homeX:x,homeZ:z};
  }
  function industrial(g,rng){
    const x=-65+rng()*130,z=-48+rng()*96,w=35+rng()*22,d=26+rng()*22,h=12+rng()*15;
    box(g,w,h,d,mats.concrete,x,h/2,z);
    box(g,w+1.5,.8,d+1.5,mats.roof,x,h+.42,z);
    for(let j=-2;j<=2;j++){
      box(g,2.1,2.0,.10,mats.window,x+j*w*.15,6,z+d/2+.1);
      box(g,.14,h*.8,.14,mats.steel,x+j*w*.17,h/2,z-d/2-.1);
    }
    const smoke=[];
    for(let k=0;k<2;k++){
      const sx=x+(k?17:-17),sz=z-10;
      column(g,mats.brick,2.25,22,sx,22/2,sz);
      column(g,mats.steel,2.35,1.3,sx,22.4,sz);
      for(let i=0;i<3;i++){
        const puff=ball(g,mats.smoke,sx,25+i*4,sz,
          [2+i*1.8,1.5+i*1.5,2+i*1.8]);smoke.push({m:puff,baseX:sx,phase:i*.8+k});
      }
    }
    return smoke;
  }
  function site(rng,index){
    const g=new T.Group();
    const road=box(g,360,.08,9,mats.asphalt,0,.04,0);
    for(let i=-4;i<=4;i++)box(g,12,.085,.22,mats.line,i*37,.09,0);
    const smokestacks=industrial(g,rng);
    for(let j=0;j<6;j++){
      let x=-100+rng()*200,z=(j%2?1:-1)*(23+rng()*70);
      box(g,8+rng()*5,6+rng()*8,7+rng()*5,j%3===0?mats.brick:mats.concrete,x,5,z);
      box(g,11,.3,11,mats.roof,x,11,z);
    }
    for(let j=0;j<9;j++){
      const x=-145+rng()*290,z=(rng()>.5?1:-1)*(35+rng()*115);
      column(g,mats.wood,.35,3,x,1.5,z);
      ball(g,mats.leaf,x,5,z,[2.0,3.7,2.0]);
    }
    const mob=[];
    for(let j=0;j<3;j++)mob.push(vehicle(g,rng,(rng()-.5)*260,0));
    for(let j=0;j<6;j++)mob.push(human(g,rng,(rng()-.5)*170,(rng()>.5?1:-1)*(13+rng()*43)));
    for(let j=0;j<4;j++)mob.push(animal(g,rng,(rng()-.5)*160,60+rng()*90));
    return {g,mob,smokestacks,localX:0,localZ:0,seed:index};
  }
  function create(root,opts){
    if(!root)return null;
    opts=opts||{};
    const mobile=opts.mobile===undefined?innerWidth<900:!!opts.mobile;
    // Densify ONLY Free Flight in max-quality mode; retain lower budgets for
    // tactical missions and low-memory Android devices.
    const memory=navigator.deviceMemory||4;
    const high=opts.quality==="maximum";
    const count=high?(mobile?(memory<=2?4:memory>=6?7:5):9):(mobile?3:6);
    const rng=seed(987667);
    const group=new T.Group();group.name='SIMULATED_CIVILIAN_GROUND_LIFE';root.add(group);
    const sites=Array.from({length:count},(_,i)=>{
      const o=site(rng,i);group.add(o.g);return o;
    });
    let previousX=NaN,previousZ=NaN,secs=0,heightTick=0;
    const temp={};
    function ground(x,z){
      if(!opts.heightAt)return 0;
      const n=opts.heightAt(x,z);
      return Number.isFinite(n)?n:0;
    }
    function redistribute(cx,cz){
      const rng2=seed(Math.floor(cx/900)*21731+Math.floor(cz/900)*38639+54321);
      for(let i=0;i<sites.length;i++){
        const a=(i/count)*TAU+rng2()*.3;
        const r=high?(1150+(i%3)*730+rng2()*530):(2300+(i%3)*1050+rng2()*800);
        const p=sites[i],x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
        const h=ground(x,z),variation=Math.max(
          Math.abs(ground(x+70,z)-h),Math.abs(ground(x,z+70)-h));
        p.g.visible=variation<25;
        p.g.position.set(x,h,z);
        p.localX=x;p.localZ=z;
      }
      previousX=cx;previousZ=cz;
    }
    function update(dt,x,z){
      if(!Number.isFinite(x)||!Number.isFinite(z))return;
      const delta=Math.min(.10,Math.max(0,dt||0));
      secs+=delta;heightTick+=delta;
      if(!Number.isFinite(previousX)||Math.hypot(x-previousX,z-previousZ)>3200)redistribute(x,z);
      if(heightTick>.8){
        heightTick=0;
        for(const site of sites)site.g.position.y=ground(site.localX,site.localZ);
      }
      for(const p of sites){
        if(!p.g.visible)continue;
        for(const o of p.mob){
          const t=secs*o.speed*.14+o.phase;
          if(o.kind==='vehicle'){
            const travel=(secs*o.speed+o.phase*14)%270;
            o.g.position.x=-135+travel;
            o.g.position.z=o.homeZ;
            o.g.rotation.y=0;
          }else{
            o.g.position.x=o.homeX+Math.cos(t)*7;
            o.g.position.z=o.homeZ+Math.sin(t)*5;
            o.g.rotation.y=-t;
            if(o.kind==='person'){
              for(let k=0;k<2;k++){
                o.legs[k].rotation.x=Math.sin(secs*o.speed*5+k*Math.PI)*.37;
                o.arms[k].rotation.x=-Math.sin(secs*o.speed*5+k*Math.PI)*.25;
              }
            }
          }
        }
        for(const smoke of p.smokestacks){
          const age=(secs*.30+smoke.phase)%3;
          smoke.m.position.y=25+age*8;
          smoke.m.position.x=smoke.baseX+Math.sin(secs*.2+smoke.phase)*age;
          smoke.m.material.opacity=.19;
          smoke.m.scale.setScalar(2+age*1.5);
        }
      }
    }
    function dispose(){
      root.remove(group);
      for(const g of owned)g.dispose();
      owned.length=0;
      for(const g of Object.values(GEO))g.dispose();
      for(const m of Object.values(mats))m.dispose();
    }
    return {update,dispose,info:()=>({sites:sites.length,
      people:sites.length*6,animals:sites.length*4,vehicles:sites.length*3,
      factories:sites.length})};
  }
  window.CENTURION_GROUND_LIFE=Object.freeze({create,version:'1'});
})();