#!/usr/bin/env python3
"""Create an original, lightweight F-16C-style GLB for CENTURION2.
Procedural approximation, not the Sketchfab mesh. Blender required.
Coordinates: nose +Y, wings +/-X, up +Z. Gear retracted.
"""
import bpy, math, sys
from mathutils import Vector
from pathlib import Path
out=Path(sys.argv[-1]); out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(n,c,metal=0,rough=.55):
 m=bpy.data.materials.new(n); m.diffuse_color=(*c,1); m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
 return m
body=mat('Aircraft grey',(0.38,.43,.48),.35); light=mat('Panel grey',(.50,.55,.59),.35); dark=mat('Radar nose',(.15,.17,.19),.15); glass=mat('Tinted canopy',(.06,.17,.22),.15,.12); black=mat('Engine exhaust',(.10,.11,.12),.65)
def mesh(n,verts,faces,m):
 me=bpy.data.meshes.new(n);me.from_pydata(verts,[],faces);me.update()
 ob=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(ob);ob.data.materials.append(m)
 for p in ob.data.polygons:p.use_smooth=True
 return ob
def loft(n,rings,m):
 verts=[];faces=[];num=20
 for y,rx,rz,z in rings:
  for k in range(num):
   t=2*math.pi*k/num;verts.append((rx*math.cos(t),y,z+rz*math.sin(t)))
 for j in range(len(rings)-1):
  for k in range(num):
   a=j*num+k;b=j*num+(k+1)%num;faces.append((a,b,b+num,a+num))
 faces.extend([tuple(reversed(tuple(range(num)))),tuple((len(rings)-1)*num+k for k in range(num))])
 return mesh(n,verts,faces,m)
def wing(n,points,z,thick,m):
 verts=[(x,y,z+thick/2) for x,y in points]+[(x,y,z-thick/2) for x,y in points]
 N=len(points); faces=[tuple(range(N)),tuple(range(2*N-1,N-1,-1))]
 faces += [(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
 return mesh(n,verts,faces,m)
# 15.0 m long, 10.0 m span: roughly F-16C proportions.
loft('Fuselage',[
 (-7.5,.22,.29,0),(-6.6,.48,.48,0),(-5.3,.65,.63,.02),
 (-3.5,.77,.70,.05),(-1.5,.92,.72,.08),(.3,.78,.63,.10),
 (2.1,.64,.54,.12),(3.7,.52,.45,.14),(5.0,.40,.35,.16),
 (6.3,.22,.20,.16),(7.5,.015,.018,.16)],body)
loft('Nose radome',[(5.0,.41,.36,.16),(6.35,.23,.21,.16),(7.5,.012,.014,.16)],dark)
# Forward bubble canopy, upper fuselage.
loft('Canopy frame',[(.25,.51,.14,.69),(1.2,.51,.27,.82),(2.6,.46,.25,.82),(3.6,.25,.08,.69)],dark)
loft('Canopy glass',[(.33,.47,.11,.73),(1.2,.47,.24,.85),(2.55,.42,.22,.85),(3.50,.20,.055,.73)],glass)
# Main trapezoidal swept wings and wingtip rails.
for side in (-1,1):
 pts=[(.72,-1.5),(2.15,-1.75),(5.02,-3.55),(4.87,-4.10),(1.03,-3.72)]
 wing('Main wing '+str(side),[(side*x,y) for x,y in pts],-.06,.12,body)
 wing('Horizontal stabilizer '+str(side),[(side*x,y) for x,y in [(.48,-5.08),(2.9,-5.83),(2.63,-6.83),(.55,-6.40)]],.08,.09,light)
 wing('Wingtip rail '+str(side),[(side*x,y) for x,y in [(4.94,-3.41),(5.06,-3.48),(5.08,-4.05),(4.95,-4.10)]],-.07,.08,dark)
# Vertical tail, swept back with distinctive F-16 silhouette.
verts=[(-.09,-5.92,.39),(.09,-5.92,.39),(-.09,-6.68,3.18),(.09,-6.68,3.18),
       (-.09,-4.52,.46),(.09,-4.52,.46),(-.09,-5.65,3.09),(.09,-5.65,3.09)]
mesh('Vertical stabilizer',verts,[(0,1,3,2),(4,6,7,5),(0,2,6,4),(1,5,7,3),(2,3,7,6)],body)
# Chin intake: dark rectangular opening under cockpit.
wing('Ventral intake mouth',[(-.51,2.05),(.51,2.05),(.48,1.71),(-.48,1.71)],-.62,.18,black)
loft('Intake duct',[(1.9,.48,.25,-.70),(1.1,.47,.28,-.76),(-1.35,.44,.30,-.67)],light)
# Engine exhaust and ring.
loft('Afterburner nozzle',[(-7.55,.34,.35,0),(-7.33,.42,.42,0),(-7.14,.43,.43,0)],black)
for side in (-1,1):
 wing('Wing leading edge '+str(side),[(side*x,y) for x,y in [(.82,-1.47),(2.14,-1.72),(5.03,-3.54),(4.95,-3.62)]],.009,.018,light)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_apply=True)
print('Created',out,out.stat().st_size)
