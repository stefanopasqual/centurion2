#!/usr/bin/env python3
"""CENTURION2 original UH-60-class utility helicopter, procedural Blender GLB.

This is independently authored geometry, not a conversion of WR5 / Michał
Flodrowski's Sketchfab model. Nose +Z, up +Y, right +X; metres.
Run: blender -b --python-exit-code 7 --python build_uh60.py -- OUTPUT.glb
"""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Vector

out = Path(sys.argv[sys.argv.index("--") + 1]) if "--" in sys.argv else Path("/tmp/uh60-centurion.glb")
out.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for mat in tuple(bpy.data.materials):
    if not mat.users: bpy.data.materials.remove(mat)

def material(name, rgb, metallic=0, roughness=.77):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    node = m.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = (*rgb, 1)
    node.inputs["Metallic"].default_value = metallic
    node.inputs["Roughness"].default_value = roughness
    return m

olive = material("Centurion olive grey · original color", (.185,.235,.171),.18,.70)
olive_dark = material("Olive dark side panels", (.109,.148,.102),.19,.78)
olive_light = material("Engine cowl fairings", (.274,.310,.227),.2,.69)
trim = material("High visibility rescue orange", (.79,.285,.045),.1,.65)
glass = material("Dark blue tinted cabin glass", (.039,.094,.131),.30,.29)
glass_edge = material("Window seals", (.027,.039,.043),.05,.9)
black = material("Rotor composite dark graphite", (.069,.078,.077),.2,.77)
metal = material("Brushed landing struts", (.335,.365,.362),.61,.45)
tyre = material("Rubber tires", (.032,.034,.031),.05,.95)
nav = material("Navigation lamp", (.85,.88,.78),.02,.35)

def mesh(name, points, faces, mat, parent=None, smooth=True):
    data=bpy.data.meshes.new(name+" Geometry")
    data.from_pydata(points, [], faces)
    data.update()
    obj=bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    if parent: obj.parent=parent
    if smooth:
        for poly in data.polygons: poly.use_smooth=True
    return obj

def cube(name, location, dims, mat, bevel=0, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj=bpy.context.object; obj.name=name
    obj.dimensions=dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod=obj.modifiers.new("soft chamfer","BEVEL")
        mod.width=bevel;mod.segments=2
        norm=obj.modifiers.new("weighted normals","WEIGHTED_NORMAL")
        norm.keep_sharp=True
    if parent: obj.parent=parent
    return obj

def uv(name, location, radii, mat, segments=20, rings=10, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=location)
    obj=bpy.context.object;obj.name=name
    obj.scale=radii;obj.data.materials.append(mat)
    if parent:obj.parent=parent
    for p in obj.data.polygons:p.use_smooth=True
    return obj

def rod(name,p1,p2,r,mat,vertices=12,parent=None):
    a,b=Vector(p1),Vector(p2)
    mid=(a+b)*.5
    direction=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=direction.length,location=mid)
    obj=bpy.context.object;obj.name=name
    obj.rotation_euler=direction.to_track_quat("Z","Y").to_euler()
    obj.data.materials.append(mat)
    if parent:obj.parent=parent
    for face in obj.data.polygons:face.use_smooth=True
    return obj

def loft(name, rings, mat, segments=28):
    vertices=[];faces=[]
    for z,rx,ry,cy in rings:
        for j in range(segments):
            a=2*math.pi*j/segments
            vertices.append((rx*math.cos(a),cy+ry*math.sin(a),z))
    for k in range(len(rings)-1):
        for j in range(segments):
            a=k*segments+j;b=k*segments+(j+1)%segments
            c=(k+1)*segments+j;d=(k+1)*segments+(j+1)%segments
            faces.append((a,c,d,b))
    faces.extend((tuple(reversed(range(segments))), tuple((len(rings)-1)*segments+j for j in range(segments))))
    return mesh(name,vertices,faces,mat)

def plate(name, verts, mat, parent=None):
    # tiny thickness prevents edge-on visual loss in three.js
    points=list(verts)
    n=len(points)
    points.extend([(v[0]+.006,v[1],v[2]) for v in verts])
    faces=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]
    for i in range(n):faces.append((i,(i+1)%n,(i+1)%n+n,i+n))
    return mesh(name,points,faces,mat,parent,smooth=False)

# Low rectangular transport cabin and pointed cockpit.
loft("UH60 Centurion original fuselage",[
    (-4.6,.34,.39,.12),(-4.0,.88,.82,.08),(-3.35,1.22,1.05,.05),
    (-2.35,1.30,1.13,.08),(-.20,1.32,1.16,.1),
    (1.54,1.32,1.13,.10),(2.16,1.27,1.12,.09),
    (2.95,1.13,.96,.05),(3.58,.91,.71,-.02),
    (4.17,.57,.50,-.12),(4.53,.06,.08,-.17)
],olive)
# Slightly squared cabin cladding, panel doors, stepped floor and roof.
cube("Cabin lower keel", (0,-.93,-1.45),(2.13,.29,4.6),olive_dark,.11)
cube("Equipment roof", (0,1.09,-.85),(2.27,.25,3.7),olive_dark,.1)
for side in (-1,1):
    x=side*1.325
    cube("Sliding cabin door right" if side>0 else "Sliding cabin door left",(x,-.05,-1.32),(.043,1.60,1.96),olive_light,.035)
    cube("Sliding cabin door frame",(x+side*.038,.01,-1.32),(.06,1.46,1.77),olive_dark,.045)
    cube("Door glass pane",(x+side*.078,.39,-1.36),(.044,.64,1.25),glass,.08)
    cube("Pilot side window",(side*1.24,.50,2.26),(.06,.71,.83),glass,.08)
    cube("Pilot side window top seal",(side*1.27,.91,2.29),(.1,.075,.86),glass_edge,.035)
    cube("Rear cabin window",(side*1.26,.29,-3.09),(.055,.53,.62),glass,.07)
    # Cockpit windows follow a sloped frontal windshield.
    plate("Windshield port/starboard "+str(side),[
        (side*.12,1.21,3.58),(side*.91,1.15,3.02),
        (side*.93,.37,3.34),(side*.13,.33,4.07)
    ],glass)
    rod("Windshield frame edge", (side*.10,1.18,3.60),(side*.12,.33,4.07),.037,black)
    cube("Sliding door handle",(side*1.385,-.18,-.39),(.065,.11,.27),black,.025)
    cube("Rescue stripe", (side*1.36,-.62,-1.35),(.035,.085,2.28),trim,.015)
    cube("Cabin footstep", (side*1.37,-1.13,-1.22),(.47,.08,1.3),black,.06)
    cube("Antislip step brackets",(side*1.26,-1.07,-2.05),(.26,.08,.18),metal,.03)

# Tail boom and rotor gearbox.
loft("Long tapered tail boom",[
    (-10.05,.16,.18,.52),(-9.5,.31,.3,.51),(-8.0,.39,.37,.39),
    (-6.0,.49,.46,.25),(-4.10,.68,.62,.14)
],olive_dark,segments=18)
cube("Top tail boom reinforcement",(0,.79,-6.1),(.31,.11,3.5),olive_light,.04)
# Vertical stabilizer swept aft (nose forward +Z).
plate("Swept vertical fin",[
    (-.14,.55,-9.30),(-.14,2.72,-10.33),(-.14,2.72,-10.86),(-.14,.22,-10.82)
],olive)
cube("Tail fin leading fairing",(0,1.85,-10.45),(.26,1.3,.28),olive_dark,.06)
# Horizontal tailplane and trim segments.
for side in (-1,1):
    plate("Horizontal stabilator "+str(side),[
        (side*.25,.52,-7.93),(side*2.1,.60,-8.40),
        (side*2.1,.60,-9.05),(side*.24,.52,-8.78)
    ],olive_light)
    cube("Stabilator tip "+str(side),(side*2.05,.64,-8.73),(.16,.12,.44),black,.04)

# Engine and transmission housing over cabin, with two side intakes.
cube("Raised transmission housing",(0,1.59,-.37),(1.86,.69,2.6),olive_dark,.25)
for side in (-1,1):
    uv("T700 class engine nacelle "+str(side),(side*.77,1.41,.38),(.58,.47,1.55),olive_light)
    uv("Turboshaft black intake "+str(side),(side*.75,1.40,1.55),(.45,.33,.12),black)
    uv("Engine exhaust diffuser "+str(side),(side*.87,1.55,-1.15),(.38,.35,.38),black)
    rod("Exhaust channel", (side*.88,1.55,-1.30),(side*1.25,1.53,-1.78),.21,metal)
    cube("Front anti-collision sensor",(side*.65,1.15,1.93),(.25,.12,.19),black,.04)

# Main rotor assembly, 4 independently authored swept blades.
mast=rod("Rotor mast",(0,1.87,-.45),(0,2.85,-.45),.22,metal,16)
hub=bpy.data.objects.new("CENTURION_UH60_MAIN_ROTOR",None)
bpy.context.collection.objects.link(hub)
hub.location=(0,2.91,-.45)
uv("Main rotor center hub",(0,0,0),(.49,.24,.49),black,parent=hub)
for blade in range(4):
    # In hub-local X/Z. One root lies along +X; rotate each blade 90 degrees.
    theta=blade*math.pi/2
    def radial(x,z,y):
        return (x*math.cos(theta)-z*math.sin(theta),y,x*math.sin(theta)+z*math.cos(theta))
    # blades have mild washout, taper and distinctive swept tips.
    verts=[radial(.50,-.32,.02),radial(.50,.32,.02),
           radial(4.6,.36,.20),radial(7.75,.27,.31),
           radial(8.19,.02,.33),radial(7.72,-.24,.31),
           radial(4.7,-.38,.19)]
    plate("Original composite main rotor blade %s"%(blade+1),verts,black,hub)
    rod("Rotor blade attachment",radial(.18,0,0),radial(.88,0,.07),.10,metal,10,hub)

rod("Tail rotor shaft",(.06,2.28,-10.49),(.79,2.28,-10.49),.16,metal,12)
tail=bpy.data.objects.new("CENTURION_UH60_TAIL_ROTOR",None)
bpy.context.collection.objects.link(tail)
tail.location=(.85,2.28,-10.49)
uv("Tail rotor hub",(0,0,0),(.18,.24,.24),metal,parent=tail)
for blade in range(4):
    theta=blade*math.pi/2
    def tail_local(y,z,x=0):
        return (x,y*math.cos(theta)-z*math.sin(theta),y*math.sin(theta)+z*math.cos(theta))
    verts=[tail_local(.22,-.15),tail_local(.22,.15),
           tail_local(1.67,.25),tail_local(1.94,.12),
           tail_local(1.85,-.13)]
    plate("Four-blade tilted tail rotor "+str(blade+1),verts,black,tail)

# Wheeled gear, not skids: two main and a tail wheel.
for side in (-1,1):
    rod("Main gear leg "+str(side),(side*.88,-.75,-1.25),(side*1.72,-1.72,-1.16),.105,metal)
    rod("Main gear damper",(side*1.27,-1.20,-1.24),(side*1.72,-1.72,-1.16),.075,black)
    tire=uv("Main landing tyre "+str(side),(side*1.74,-1.77,-1.16),(.35,.41,.19),tyre,16,9)
    uv("Main wheel hub "+str(side),(side*1.92,-1.77,-1.16),(.055,.18,.18),metal,14,8)
rod("Tail wheel shock",(0,-.22,-8.2),(0,-1.30,-9.16),.10,metal)
uv("Tail landing wheel",(0,-1.42,-9.17),(.22,.28,.18),tyre,14,8)

# SAR-style identification is fictional and original, avoiding external insignia.
for side in (-1,1):
    cube("Centurion side crest plate",(side*1.365,-.22,-2.66),(.045,.38,.43),trim,.025)
    cube("Rescue flash upper side",(side*1.335,.99,-1.21),(.04,.06,2.13),trim,.015)
uv("Nose searchlight",(0,-.55,4.0),(.27,.19,.22),metal,14,8)
uv("Searchlight lens",(0,-.58,4.19),(.22,.13,.08),nav,14,8)
rod("VHF cabin antenna",(0,1.72,1.11),(0,2.21,1.22),.027,black,8)
rod("Tail warning antenna",(0,.98,-8.65),(0,1.38,-8.65),.025,black,8)

# Names are retained in glTF and used by the hangar for animation.
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active=bpy.context.selected_objects[0]
bpy.ops.export_scene.gltf(filepath=str(out),export_format="GLB",
    export_apply=True,export_yup=True,export_animations=False,
    export_materials="EXPORT",export_extras=True)

assert out.is_file() and out.stat().st_size>50000, "GLB export too small"
assert out.read_bytes()[:4]==b"glTF", "Not a binary GLB"
print("CENTURION_UH60_READY",out,out.stat().st_size)
