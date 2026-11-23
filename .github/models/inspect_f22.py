#!/usr/bin/env python3
"""Read the original F-22 GLB and compare port/starboard mesh geometry."""
import json, struct
from pathlib import Path
from collections import Counter
import numpy as np

p=Path("model-sources/f22.glb")
b=p.read_bytes()
assert b[:4]==b'glTF'
at=12; meta=None; binary=None
while at<len(b):
    size,typ=struct.unpack_from('<II',b,at); at+=8
    chunk=b[at:at+size];at+=size
    if typ==0x4E4F534A:meta=json.loads(chunk)
    if typ==0x004E4942:binary=chunk
assert meta and binary
print('JSON nodes',len(meta.get('nodes',[])),'meshes',len(meta.get('meshes',[])),'materials',len(meta.get('materials',[])))
for i,x in enumerate(meta.get('materials',[])):
    print('MATERIAL',i,x.get('name'),x.get('pbrMetallicRoughness',{}).get('baseColorTexture'),x.get('alphaMode','OPAQUE'))

access=meta['accessors']; views=meta['bufferViews']
def attrs(ai):
    ac=access[ai];vw=views[ac['bufferView']]
    comps={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[ac['type']]
    dt={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}[ac['componentType']]
    dtype=np.dtype(dt); pos=vw.get('byteOffset',0)+ac.get('byteOffset',0)
    stride=vw.get('byteStride',dtype.itemsize*comps)
    data=np.ndarray((ac['count'],comps),dtype=dtype,buffer=binary,offset=pos,strides=(stride,dtype.itemsize))
    return data.astype(np.float64,copy=False)

def matrix(node):
    if 'matrix' in node:return np.array(node['matrix']).reshape(4,4).T
    pos=np.eye(4)
    q=np.array(node.get('rotation',[0,0,0,1]),float)
    x,y,z,w=q
    pos[:3,:3]=np.array([
       [1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
       [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
       [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
    pos[:3,:3]*=np.array(node.get('scale',[1,1,1]))
    pos[:3,3]=node.get('translation',[0,0,0])
    return pos

nodes=meta['nodes']; mi=meta['meshes']; pieces=[]
seen=set()
def walk(idx,parent):
    if idx in seen:return
    seen.add(idx)
    node=nodes[idx];mat=parent@matrix(node)
    if 'mesh' in node:
        mesh=mi[node['mesh']]
        for j,prim in enumerate(mesh.get('primitives',[])):
            v=attrs(prim['attributes']['POSITION'])
            V=v@mat[:3,:3].T+mat[:3,3]
            low=V.min(axis=0);high=V.max(axis=0)
            extent=high-low
            center=(low+high)*.5
            desc={'node':node.get('name',str(idx)),'mesh':mesh.get('name',str(node['mesh'])),'primitive':j,'material':prim.get('material'), 'vertices':len(V),'min':low.tolist(),'max':high.tolist(),'centroid':V.mean(axis=0).tolist(),'extent':extent.tolist()}
            pieces.append((desc,V))
            print("PART",json.dumps(desc,ensure_ascii=False))
    for ch in node.get('children',[]):walk(ch,mat)

scenes=meta.get('scenes') or [{'nodes':list(range(len(nodes)))}]
root=scenes[meta.get('scene',0)]
for idx in root['nodes']:walk(idx,np.eye(4))
allv=np.concatenate([v for _,v in pieces],axis=0)
mi=np.min(allv,axis=0);ma=np.max(allv,axis=0)
print("GLOBAL bounds",mi.round(4).tolist(),ma.round(4).tolist(),"n",len(allv))
ctr=(mi+ma)/2
extent=ma-mi
for axis in (0,1,2):
    v=allv[:,axis]-ctr[axis]
    levels=[0.1,0.25,0.4]
    for t in levels:
      d=t*extent[axis]/2
      neg=np.count_nonzero(v < -d);pos=np.count_nonzero(v > d)
      print("SIDECOUNTS",axis,t,neg,pos,round(neg/max(1,pos),3))
# Show coarse symmetry of mesh geometry around each candidate center plane.
for a in (0,2):
    mirrored=allv.copy()
    mirrored[:,a]=2*ctr[a]-mirrored[:,a]
    for tol in (.05,.1,.25):
        pts=np.round(allv/tol).astype(np.int64)
        reflected=np.round(mirrored/tol).astype(np.int64)
        t={tuple(x) for x in pts[::max(1,len(pts)//250000)]}
        both=sum(tuple(x) in t for x in reflected[::max(1,len(reflected)//250000)])
        n=len(reflected[::max(1,len(reflected)//250000)])
        print("SYM",a,tol,round(both/max(1,n),4))
print("ANALYSIS COMPLETE")