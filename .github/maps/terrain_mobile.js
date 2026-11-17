/* CENTURION 2 | Mobile terrain streaming / high-resolution real DEM
 * Nearby satellite imagery is loaded at a higher native zoom than the
 * wide-area terrain. Elevation from AWS Terrarium is sampled, never invented.
 * No bundled terrain data: online Esri imagery and public DEM must be available.
 * All meshes/requests are bounded to avoid exhausting phone GPU memory.
 */
(() => {
  'use strict';
  if (window.CENTURION_TERRAIN) return;
  const R=Math.PI/180;
  const max=(a,b)=>Math.max(a,b),min=(a,b)=>Math.min(a,b);
  const clamp=(v,a,b)=>max(a,min(b,v));
  const mem=(navigator.deviceMemory||4);
  const cores=(navigator.hardwareConcurrency||4);
  const touch=matchMedia('(pointer:coarse)').matches;
  const budget=mem<=2||cores<=3?'low':mem>=6&&cores>=6?'ultra':'balanced';
  const mobile=touch||innerWidth<900;
  const isLow=budget==='low';
  const profile=Object.freeze({
    mobile,budget,
    dpr:mobile?(isLow?1:budget==='ultra'?1.8:1.45):min(devicePixelRatio||1,2),
    segmentBase:mobile?(isLow?40:budget==='ultra'?72:56):96,
    anisotropy:mobile?(isLow?2:budget==='ultra'?8:4):12,
    maxTiles:isLow?12:mobile?18:32,
    concurrent:isLow?3:mobile?4:6
  });
  function ratio(record){return record?1:min(devicePixelRatio||1,profile.dpr);}
  function texture(tex,renderer){
    if(!tex)return tex;
    if(window.THREE){
      const T=window.THREE;
      if(T.sRGBColorSpace)tex.colorSpace=T.SRGBColorSpace;
      else if(T.sRGBEncoding!==undefined)tex.encoding=T.sRGBEncoding;
      tex.generateMipmaps=true;
      tex.minFilter=T.LinearMipmapLinearFilter;
      tex.magFilter=T.LinearFilter;
      let cap=profile.anisotropy;
      try{if(renderer&&renderer.capabilities)cap=min(cap,renderer.capabilities.getMaxAnisotropy());}catch(_){}
      tex.anisotropy=max(1,cap);tex.needsUpdate=true;
    }
    return tex;
  }
  function tileAt(lat,lon,z){
    const n=Math.pow(2,z),phi=clamp(lat,-85.051,85.051)*R;
    return {x:(lon+180)/360*n,y:(1-Math.log(Math.tan(phi)+1/Math.cos(phi))/Math.PI)/2*n,n};
  }
  function bilinear(grid,u,v){
    const x=clamp(u*255,0,255),y=clamp(v*255,0,255);
    const x0=Math.floor(x),y0=Math.floor(y),x1=min(255,x0+1),y1=min(255,y0+1);
    const fx=x-x0,fy=y-y0,a=grid[y0*256+x0],b=grid[y0*256+x1],
          c=grid[y1*256+x0],d=grid[y1*256+x1];
    return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;
  }
  function start(opts){
    const T=window.THREE, source=typeof VISTA3D!== 'undefined'?VISTA3D:window.VISTA3D;
    if(!T||!source||!opts||!opts.root)return null;
    const center={lat:opts.lat0,lon:opts.lon0};
    const half=Number.isFinite(opts.half)&&opts.half>0?opts.half:Infinity;
    const levels=(mobile?[[12,1,profile.segmentBase,0.7],
                         [isLow?14:15,1,isLow?28:40,1.5]]:
                        [[13,2,96,.7],[15,1,56,1.5]]);
    const group=new T.Group();group.name='CENTURION_HD_REAL_ELEVATION';opts.root.add(group);
    const texLoader=new T.TextureLoader();texLoader.setCrossOrigin('anonymous');
    const tiles=new Map(),queue=[];let active=0,closed=false,lastX=Infinity,lastZ=Infinity,lastTime=0;
    const world={};
    for(const level of levels){
      const z=level[0],ref=tileAt(center.lat,center.lon,z);
      world[z]={ref,size:40075016.686*Math.cos(center.lat*R)/ref.n};
    }
    const key=(z,x,y)=>z+'_'+x+'_'+y;
    const coords=(z,x,y)=>{
      const m=world[z],size=m.size;
      return {x:(x+.5-m.ref.x)*size,z:(y+.5-m.ref.y)*size,size};
    };
    function baseH(x,z){
      const v=opts.baseHeight(x,z);
      return Number.isFinite(v)?v:0;
    }
    function sampleHeight(z,x,y,px,pz,grid){
      const p=coords(z,x,y);
      const u=(px-(p.x-p.size/2))/p.size,v=(pz-(p.z-p.size/2))/p.size;
      return (bilinear(grid,u,v)-(opts.datum?opts.datum():0))*(opts.exaggeration?opts.exaggeration():1);
    }
    function heightAt(x,z){
      for(let i=levels.length-1;i>=0;i--){
        const level=levels[i],z0=level[0],m=world[z0];
        const ix=Math.floor(m.ref.x+x/m.size),iy=Math.floor(m.ref.y+z/m.size);
        const entry=tiles.get(key(z0,ix,iy));
        if(entry&&entry.grid&&!entry.disposed){
          return sampleHeight(z0,ix,iy,x,z,entry.grid);
        }
      }
      return NaN;
    }
    function build(entry){
      if(closed||entry.disposed||!entry.grid)return;
      const pos=coords(entry.z,entry.x,entry.y),size=pos.size;
      const seg=entry.seg,geo=new T.PlaneGeometry(size,size,seg,seg);
      geo.rotateX(-Math.PI/2);
      const vertices=geo.attributes.position;
      // Blend towards measured base heights at the outer edge of each tile.
      // This avoids cliff-like seams while neighbouring tiles arrive.
      for(let j=0;j<vertices.count;j++){
        const lx=vertices.getX(j),lz=vertices.getZ(j);
        const x=pos.x+lx,z=pos.z+lz;
        const u=clamp(lx/size+.5,0,1),v=clamp(.5+lz/size,0,1);
        const hi=(bilinear(entry.grid,u,v)-(opts.datum?opts.datum():0))*(opts.exaggeration?opts.exaggeration():1);
        const edge=clamp(min(u,1-u,v,1-v)*8,0,1);
        const lo=baseH(x,z);
        vertices.setY(j,hi*edge+lo*(1-edge)+entry.lift);
      }
      vertices.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingSphere();
      const mat=new T.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0,side:T.FrontSide,
        polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
      if(entry.tex){mat.map=entry.tex;texture(entry.tex,opts.renderer);}
      else mat.color.set(0x59695b);
      const mesh=new T.Mesh(geo,mat);
      mesh.position.set(pos.x,0,pos.z);mesh.receiveShadow=true;
      mesh.renderOrder=entry.z;
      group.add(mesh);entry.mesh=mesh;
      if(entry.tex)mesh.visible=true;else mesh.visible=false;
    }
    function evict(entry){
      entry.disposed=true;
      if(entry.mesh){
        group.remove(entry.mesh);entry.mesh.geometry.dispose();
        entry.mesh.material.dispose();entry.mesh=null;
      }
      if(entry.tex)entry.tex.dispose();
      entry.grid=null;entry.tex=null;
    }
    function next(){
      if(closed)return;
      while(active<profile.concurrent&&queue.length){
        const e=queue.shift();
        if(e.disposed||tiles.get(e.key)!==e)continue;
        active++;
        let finish=0;
        const done=()=>{finish++;if(finish===2){active--;next();}};
        const imgUrl=source.tileUrl('img',e.z,e.x,e.y);
        const demUrl=source.tileUrl('dem',e.z,e.x,e.y);
        source.caricaTex(texLoader,imgUrl,tex=>{
          if(e.disposed){tex.dispose();done();return;}
          e.tex=texture(tex,opts.renderer);
          if(e.mesh){e.mesh.material.map=e.tex;e.mesh.material.color.set(0xffffff);
            e.mesh.material.needsUpdate=true;e.mesh.visible=true;}
          done();
        },()=>done());
        source.caricaDem(demUrl,img=>{
          if(!e.disposed){
            try{e.grid=source.demGrid(img);build(e);}catch(err){console.warn('HD DEM fallback',err);}
          }
          done();
        },()=>done());
      }
    }
    function desiredAt(x,z){
      const target=new Map();
      for(const lev of levels){
        const [zz,rad,seg,lift]=lev,m=world[zz];
        const cx=Math.floor(m.ref.x+x/m.size),cy=Math.floor(m.ref.y+z/m.size);
        for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++){
          const xx=cx+dx,yy=cy+dy,where=coords(zz,xx,yy);
          // Preserve 100 km² maps' actual square clipping: omit crossing tiles.
          if(Math.abs(where.x)-m.size/2>=half||Math.abs(where.z)-m.size/2>=half)continue;
          target.set(key(zz,xx,yy),{key:key(zz,xx,yy),z:zz,x:xx,y:yy,
            seg,lift,dist:Math.hypot(where.x-x,where.z-z)});
        }
      }
      // Limit mesh count across mobile profiles, favouring close fine tiles.
      const chosen=[...target.values()].sort((a,b)=>a.dist-b.dist||b.z-a.z).slice(0,profile.maxTiles);
      return new Map(chosen.map(t=>[t.key,t]));
    }
    function update(x,z,time){
      if(closed)return;
      if(!Number.isFinite(x)||!Number.isFinite(z))return;
      const now=Number.isFinite(time)?time:performance.now();
      if(now-lastTime<1100&&Math.hypot(x-lastX,z-lastZ)<750)return;
      lastX=x;lastZ=z;lastTime=now;
      const wanted=desiredAt(x,z);
      for(const [k,v] of tiles){if(!wanted.has(k)){evict(v);tiles.delete(k);}}
      queue.length=0;
      for(const [k,d] of wanted){
        if(!tiles.has(k)){tiles.set(k,{...d,grid:null,tex:null,mesh:null,disposed:false});
          queue.push(tiles.get(k));}
      }
      queue.sort((a,b)=>a.dist-b.dist||b.z-a.z);
      next();
    }
    function dispose(){
      closed=true;queue.length=0;
      for(const t of tiles.values())evict(t);
      tiles.clear();opts.root.remove(group);
    }
    // Respect all devices: maximum concurrent tile loads and bounded GPU assets.
    const info=()=>({quality:profile.budget,tiles:tiles.size,
      loaded:[...tiles.values()].filter(t=>t.mesh&&t.tex).length,
      nativeZooms:levels.map(l=>l[0])});
    return {update,heightAt,dispose,info};
  }
  window.CENTURION_TERRAIN=Object.freeze({profile,ratio,texture,start});
})();
