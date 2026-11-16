#!/usr/bin/env python3
"""Original stylized high-detail EF-2000 3D asset for a WebGL simulator.
Geometry authored parametrically. 1 unit = 1 metre. Three.js Y-up,
nose -> local -Z, wings -> +/-X. No third-party aircraft mesh is used.
"""
from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

OUT=Path(__file__).resolve().parent
SCENE=trimesh.Scene()
NAMES=set()
COLORS={
 'body':('#9AA7B1',.70,.08), 'wing':('#A1ADB6',.76,.05),
 'body_light':('#B2BBC2',.72,.07),'body_dark':('#788792',.78,.07),
 'panel':('#697983',.91,.07),'seam':('#53606A',.96,.04),
 'radome':('#76848A',.87,.03),'titanium':('#777A7E',.42,.63),
 'metal':('#B1B7B8',.34,.63), 'dark_metal':('#44494D',.45,.62),
 'carbon':('#252D33',.87,.08), 'black':('#111A20',.94,.03),
 'glass':('#234151',.23,.25), 'glass_edge':('#283A42',.48,.20),
 'cockpit':('#182831',.92,.06), 'screen':('#184D55',.36,.10),
 'rubber':('#20272B',.96,.02), 'paint_white':('#E6E9E6',.93,.00),
 'paint_red':('#9E3438',.92,.00), 'paint_green':('#2D6A50',.90,.00),
 'light':('#A4DDE2',.18,.12), 'glow':('#D16B35',.19,.22),
 'weapon':('#C0C6C6',.80,.04),'weapon_dark':('#747D81',.84,.03),
 'yellow':('#CCB15C',.80,.02),
}
materials={}
for name,(hexcol,rough,metal) in COLORS.items():
 h=hexcol.lstrip('#')
 c=tuple(int(h[i:i+2],16) for i in (0,2,4))
 alpha=180 if name=='glass' else 255
 materials[name]=PBRMaterial(name=name,baseColorFactor=(*c,alpha),metallicFactor=metal,roughnessFactor=rough,alphaMode='BLEND' if alpha<255 else 'OPAQUE',doubleSided=True)

stats={'meshes':0,'tris':0}
def mesh(name,V,F,mat='body',pivot=None):
    name=''.join(ch if ch.isalnum() or ch in '_-' else '_' for ch in name)
    assert name not in NAMES,name
    NAMES.add(name)
    m=trimesh.Trimesh(vertices=np.array(V,dtype=float),faces=np.array(F,dtype=int),process=False)
    m.visual=trimesh.visual.TextureVisuals(material=materials[mat])
    T=np.eye(4)
    if pivot is not None:
        pivot=np.array(pivot,dtype=float)
        m.apply_translation(-pivot)
        T[:3,3]=pivot
    SCENE.add_geometry(m,geom_name=name,node_name=name,transform=T)
    stats['meshes']+=1;stats['tris']+=len(m.faces)
    return m

def loft(name,sections,mat='body',sides=32,pivot=None):
    """sections=(z,cx,cy,rx,ry), aftward from nose to tail"""
    V=[];F=[]
    for z,cx,cy,rx,ry in sections:
        for k in range(sides):
            th=2*np.pi*k/sides
            V.append([cx+rx*np.cos(th),cy+ry*np.sin(th),z])
    for j in range(len(sections)-1):
        for k in range(sides):
            a=j*sides+k;b=j*sides+(k+1)%sides;c=(j+1)*sides+(k+1)%sides;d=(j+1)*sides+k
            F.extend([[a,b,c],[a,c,d]])
    F.extend([[0,i+1,i] for i in range(1,sides-1)])
    idx=(len(sections)-1)*sides
    F.extend([[idx,idx+i,idx+i+1] for i in range(1,sides-1)])
    return mesh(name,V,F,mat,pivot)

def plate(name,outline,mat='wing',thickness=.05,pivot=None):
    """Plate defined by x,y,z top vertices; vertical thickness"""
    verts=np.array(outline,float);n=len(verts)
    V=np.concatenate([verts,verts-np.array([0,thickness,0])])
    F=[]
    for i in range(1,n-1):F.append([0,i,i+1]);F.append([n,n+i+1,n+i])
    for i in range(n):
        j=(i+1)%n
        F.extend([[i,j,n+j],[i,n+j,n+i]])
    return mesh(name,V,F,mat,pivot)

def tube(name,points,r=.01,mat='seam',segments=6):
    pts=np.asarray(points,float)
    if len(pts)<2:return
    V=[];F=[]
    for j,p in enumerate(pts):
        tangent=(pts[min(j+1,len(pts)-1)]-pts[max(j-1,0)])
        tangent/=max(np.linalg.norm(tangent),1e-7)
        a=np.cross(tangent,[0,1,0]);
        if np.linalg.norm(a)<1e-5:a=np.cross(tangent,[1,0,0])
        a/=np.linalg.norm(a);b=np.cross(tangent,a)
        for k in range(segments):
            ang=2*np.pi*k/segments
            V.append(p+r*(a*np.cos(ang)+b*np.sin(ang)))
    for j in range(len(pts)-1):
        for k in range(segments):
            a=j*segments+k;b=j*segments+(k+1)%segments;c=(j+1)*segments+(k+1)%segments;d=(j+1)*segments+k
            F.extend([[a,b,c],[a,c,d]])
    return mesh(name,V,F,mat)

def cylinder(name,p1,p2,r,mat,segments=18):
    a=np.array(p1,float); b=np.array(p2,float); d=b-a
    if np.linalg.norm(d)<1e-6:return
    m=trimesh.creation.cylinder(radius=r,height=np.linalg.norm(d),sections=segments)
    m.apply_transform(trimesh.geometry.align_vectors([0,0,1],d))
    m.apply_translation((a+b)/2)
    return mesh(name,m.vertices,m.faces,mat)

def ring(name,center,normal,r1,r2,mat,sections=48):
    center=np.asarray(center,float);normal=np.asarray(normal,float);normal/=np.linalg.norm(normal)
    a=np.cross(normal,[1,0,0]);
    if np.linalg.norm(a)<1e-4:a=np.cross(normal,[0,1,0])
    a/=np.linalg.norm(a);b=np.cross(normal,a)
    V=[];F=[]
    for k in range(sections):
        th=2*np.pi*k/sections
        ray=a*np.cos(th)+b*np.sin(th)
        V.extend([center+r1*ray,center+r2*ray])
    for k in range(sections):
        i=2*k;j=2*((k+1)%sections)
        F.extend([[i,j,i+1],[i+1,j,j+1]])
    return mesh(name,V,F,mat)

# Main airframe: authentic Typhoon silhouette. Proportions are visual,
# not engineering-verified section profiles.
SECTION=[
 (-7.98,0,.12,.012,.012),(-7.70,0,.14,.083,.08),
 (-6.95,0,.13,.27,.25),(-6.30,0,.14,.39,.37),
 (-5.45,0,.14,.56,.49),(-4.85,0,.15,.67,.55),
 (-4.05,0,.12,.76,.62),(-3.10,0,.10,.91,.70),
 (-2.25,0,.07,1.02,.71),(-1.30,0,.04,1.10,.72),
 (-.10,0,.02,1.11,.76),(1.2,0,.02,1.24,.78),
 (2.8,0,.02,1.26,.76),(4.4,0,.02,1.27,.71),
 (5.6,0,.02,1.24,.64),(6.65,0,.06,1.18,.57),
 (7.33,0,.10,1.07,.54),(7.56,0,.10,1.04,.53)]
loft('AIRFRAME_Fuselage',SECTION,'body',48)
radosections=[]
for z,cx,cy,rx,ry in SECTION[:5]: radosections.append((z-.001,cx,cy,rx*1.007,ry*1.012))
loft('RADOME_Radar_Nose',radosections,'radome',48)

# Nose radome separation stripe and pitot/sensor apertures
z=-5.46
r=.56;y0=.14; ry=.49
ringpts=[[r*np.cos(t),y0+ry*np.sin(t),z] for t in np.linspace(0,2*np.pi,57)]
tube('NOSE_Radome_Seam',ringpts,.009,'seam')
cylinder('NOSE_Pitot_Probe',[0,.13,-7.98],[0,.13,-8.10],.012,'metal',12)
for side in [-1,1]:
    cylinder(f'NOSE_AngleSensor_{side}',[side*.23,.19,-6.52],[side*.25,.20,-6.44],.012,'dark_metal',10)

# Wings: delta with clipped tips, leading edge slats and trailing elevons.
def wtop(x):return .115+.042*abs(x)/5.475
for side,ss in [('L',-1),('R',1)]:
    W=[(1.06,-.32),(1.65,-.13),(3.55,2.30),(5.42,4.52),(5.475,4.82),
       (5.44,5.62),(4.64,5.67),(3.30,5.88),(1.23,6.20),(.96,5.94)]
    points=[[ss*x,wtop(x),z] for x,z in W]
    plate(f'WING_{side}_Primary_Delta',points,'wing',.16,pivot=[0,0,0])
    # slender leading-edge slat as a separate mesh
    slat=[(1.55,-.10),(3.49,2.34),(5.35,4.54),(5.21,4.68),(3.38,2.63),(1.64,.21)]
    plate(f'WING_{side}_Leading_Slat',[[ss*x,wtop(x)+.008,z] for x,z in slat], 'body_light',.018)
    elevon=[(2.65,5.37),(4.50,5.35),(5.35,5.25),(5.35,5.58),(4.61,5.61),(3.30,5.83),(2.65,5.90)]
    plate(f'CONTROL_Elevon_{side}',[[ss*x,wtop(x)+.022,z] for x,z in elevon], 'body_dark',.033,pivot=[ss*3.85,wtop(3.85),5.35])
    # outermost wingtip pod nav light, wing position light
    cylinder(f'WING_{side}_TipPod',[ss*5.45,wtop(5.45),4.52],[ss*5.45,wtop(5.45),5.75],.060,'body_dark',14)
    cylinder(f'WING_{side}_NavigationLight',[ss*5.45,wtop(5.45)+.06,4.52],[ss*5.45,wtop(5.45)+.06,4.65],.030,'paint_red' if ss==-1 else 'paint_green',12)
    # panel lines + access hatches
    seams=[[(1.68,.38),(3.34,2.77),(5.19,4.81)],
           [(2.12,5.57),(3.42,5.28),(4.7,5.09)],
           [(2.62,1.61),(2.64,5.30)],
           [(3.63,2.58),(3.83,5.37)],
           [(4.68,3.93),(4.84,5.33)]]
    for i,poly in enumerate(seams):
        tube(f'WING_{side}_PanelSeam_{i}',[[ss*x,wtop(x)+.020,z] for x,z in poly],.009,'seam',5)
    # Service inspection hatches rectangles and dotted fasteners
    for i,(px,pz) in enumerate([(2.35,3.65),(3.22,4.34),(1.66,4.25)]):
        rectangle=[[ss*(px+dx),wtop(px+dx)+.026,pz+dz] for dx,dz in [(-.21,-.30),(.21,-.30),(.21,.30),(-.21,.30),(-.21,-.30)]]
        tube(f'WING_{side}_AccessPanel_{i}',rectangle,.006,'panel',5)
    # subdued Italian Air Force cockade (concentric ring sections)
    cx=ss*3.34;cz=3.75
    yc=wtop(3.34)+.034
    ring(f'INSIGNIA_{side}_Green',[cx,yc,cz],[0,1,0],.33,.42,'paint_green',48)
    ring(f'INSIGNIA_{side}_White',[cx,yc+.001,cz],[0,1,0],.19,.33,'paint_white',48)
    ring(f'INSIGNIA_{side}_Red',[cx,yc+.002,cz],[0,1,0],.03,.19,'paint_red',48)
    # underwing pylon and missile racks
    for j,x,z in [(1,2.40,3.34),(2,4.38,4.97)]:
        plate(f'PYLON_{side}_{j}',[[ss*x,-.17,z-.22],[ss*x,-.17,z+.35],
                                  [ss*x,-.56,z+.42],[ss*x,-.56,z-.12]],'dark_metal',.075)

# Canards with separately named control pivot; forward of the wings
for side,ss in [('L',-1),('R',1)]:
    P=[(.53,-3.78),(.83,-3.90),(2.73,-3.22),(3.06,-3.16),(3.08,-2.78),
       (1.31,-1.92),(.70,-1.80)]
    plate(f'CONTROL_Canard_{side}',[[ss*x,.39+.045*x,z] for x,z in P], 'wing',.105,pivot=[ss*.57,.43,-3.1])
    tube(f'CANARD_{side}_Pivot',[[ss*.60,.41,-2.65],[ss*.78,.43,-2.65]],.065,'titanium',8)
    tube(f'CANARD_{side}_RearSeam',[[ss*1.09,.39+.045*1.09,-2.04],[ss*2.94,.39+.045*2.94,-2.83]],.008,'seam',5)

# Twin side intakes, splitter plates, recess and duct sides (facing the nose)
for side,ss in [('L',-1),('R',1)]:
    cx=ss*.65
    plate(f'INTAKE_{side}_Scoop',[[ss*.21,-.48,-1.48],[ss*1.23,-.46,-1.38],
            [ss*1.26,-1.22,-1.12],[ss*.24,-1.20,-1.23]],'body_dark',.09)
    plate(f'INTAKE_{side}_DarkMouth',[[ss*.26,-.55,-1.494],[ss*1.17,-.54,-1.394],
            [ss*1.18,-1.10,-1.137],[ss*.28,-1.10,-1.247]],'black',.005)
    for k,p in enumerate([
      [[ss*.25,-.51,-1.50],[ss*1.21,-.50,-1.40]],
      [[ss*.25,-1.20,-1.25],[ss*1.21,-1.21,-1.15]],
      [[ss*1.22,-.50,-1.40],[ss*1.22,-1.21,-1.15]]]):
      tube(f'INTAKE_{side}_Lip_{k}',p,.040,'metal',9)
    plate(f'INTAKE_{side}_Splitter',[[ss*.15,-.42,-1.68],[ss*.32,-.48,-1.52],
                                  [ss*.26,-1.21,-1.24],[ss*.13,-1.20,-1.35]],'titanium',.035)
    # internal turbine shadow behind intake
    for i in range(6):
        x=ss*(.34+.13*i)
        tube(f'INTAKE_{side}_VanedGrille_{i}',[[x,-.60,-1.375],[x,-1.00,-1.18]],.007,'carbon',5)

# Upper canopy and cockpit tub
plate('COCKPIT_Black_Tub',[[-.52,.65,-4.65],[.52,.65,-4.65],[.63,.66,-1.12],[-.63,.66,-1.12]],'cockpit',.075)
plate('COCKPIT_SeatBack',[[-.28,.85,-1.76],[.28,.85,-1.76],[.27,1.37,-1.64],[-.27,1.37,-1.64]],'carbon',.07)
plate('COCKPIT_Headrest',[[-.20,1.25,-1.69],[.20,1.25,-1.69],[.19,1.57,-1.73],[-.19,1.57,-1.73]],'black',.06)
plate('COCKPIT_Dashboard',[[-.43,.70,-3.49],[.43,.70,-3.49],[.43,1.08,-3.41],[-.43,1.08,-3.41]],'black',.08)
for i,cx in enumerate([-.28,0,.28]):
    plate(f'COCKPIT_MFD_{i}',[[cx-.105,.79,-3.51],[cx+.105,.79,-3.51],
         [cx+.105,1.00,-3.44],[cx-.105,1.00,-3.44]],'screen',.006)
tube('COCKPIT_Center_Stick',[[0,.75,-2.35],[0,1.00,-2.42]],.026,'black',9)
# canopy cross-sections, top semicircular arch: angle 0..pi
C=[(-4.94,.77,.09,.05),(-4.48,.79,.36,.33),(-3.92,.80,.54,.59),
   (-3.20,.78,.59,.78),(-2.42,.77,.59,.81),(-1.64,.76,.47,.63),(-1.22,.76,.20,.29)]
V=[];F=[];S=24
for z,base,rx,h in C:
    for k in range(S+1):
        th=np.pi*k/S
        V.append([rx*np.cos(th),base+h*np.sin(th),z])
for j in range(len(C)-1):
 for k in range(S):
    a=j*(S+1)+k;b=a+1;c=(j+1)*(S+1)+k+1;d=c-1
    F.extend([[a,b,c],[a,c,d]])
mesh('COCKPIT_Transparent_Canopy',V,F,'glass')
for idx,(z,base,rx,h) in enumerate(C):
    if idx in (0,1,3,5,6):
      pts=[[rx*np.cos(th),base+h*np.sin(th),z] for th in np.linspace(0,np.pi,32)]
      tube(f'COCKPIT_ArchFrame_{idx}',pts,.020 if idx not in (3,5) else .031,'glass_edge',9)
for side,ss in [('L',-1),('R',1)]:
    pts=[[ss*rx,base+.012,z] for z,base,rx,h in C]
    tube(f'COCKPIT_Sill_{side}',pts,.027,'glass_edge',9)

# Single swept fin with separate rear rudder
fin=[(4.09,1.00),(5.16,3.97),(5.68,3.98),(6.26,3.87),(7.30,1.08)]
plate('TAIL_VerticalStabilizer',[[0,y,z] for z,y in fin], 'wing',.15)
plate('CONTROL_Rudder',[[.01,y,z] for z,y in [(6.24,3.86),(6.74,2.77),(7.29,1.09),(6.94,1.08),(6.36,2.57)]], 'body_dark',.035,pivot=[0,2.55,6.55])
# fin panel lines and tricolor tail flash side-by-side
for side,ss in [('L',-1),('R',1)]:
  tube(f'TAIL_{side}_RudderHinge',[[ss*.085,3.78,6.22],[ss*.085,2.65,6.46],[ss*.085,1.15,6.91]],.011,'seam',6)
  # Italian tricolour flag on middle side (subtle stylized decoration)
  for i,(z,m) in enumerate([(5.40,'paint_green'),(5.67,'paint_white'),(5.94,'paint_red')]):
    plate(f'TAIL_{side}_Flag_{i}',[[ss*.083,2.32,z],[ss*.083,2.32,z+.25],
           [ss*.083,2.69,z+.25],[ss*.083,2.69,z]],m,.004)

# Twin aft engine housings and 16 nozzle feathers each
for side,ss in [('L',-1),('R',1)]:
    cx=ss*.67;cy=-.18
    loft(f'ENGINE_{side}_Nacelle',[(4.52,cx,cy,.56,.57),(5.5,cx,cy,.58,.58),
        (6.63,cx,cy,.55,.55),(7.15,cx,cy,.50,.50),(7.66,cx,cy,.45,.45)],'body_dark',40)
    ring(f'ENGINE_{side}_NozzleLip',[cx,cy,7.72],[0,0,1],.33,.48,'titanium',64)
    ring(f'ENGINE_{side}_DarkCore',[cx,cy,7.735],[0,0,1],0,.31,'black',64)
    ring(f'ENGINE_{side}_InnerCoreGlow',[cx,cy,7.745],[0,0,1],.20,.23,'glow',64)
    ring(f'ENGINE_{side}_ReheatRing',[cx,cy,7.75],[0,0,1],.115,.127,'dark_metal',64)
    for i in range(20):
        t0=2*np.pi*i/20+.02;t1=2*np.pi*(i+1)/20-.02
        V=[]
        for z,r in [(7.31,.48),(7.86,.38)]:
            for t in (t0,t1):V.append([cx+r*np.cos(t),cy+r*np.sin(t),z])
        mesh(f'ENGINE_{side}_NozzlePetal_{i}',V,[[0,1,3],[0,3,2]],'titanium' if i%2==0 else 'dark_metal')
        tube(f'ENGINE_{side}_PetalRidge_{i}',[[cx+r*np.cos(t0),cy+r*np.sin(t0),z] for z,r in [(7.31,.48),(7.86,.38)]],.008,'metal',5)

# Ventral fins
for side,ss in [('L',-1),('R',1)]:
    plate(f'TAIL_{side}_VentralFin',[[ss*.69,-.44,5.93],[ss*.80,-1.36,6.83],
           [ss*.83,-1.31,7.22],[ss*.81,-.46,7.43]],'body_dark',.07)
# Fuselage dorsal antennas/sensors
for i,(x,y,z,h) in enumerate([(0,.72,-5.03,.23),(0,.82,1.28,.19),(0,.80,3.30,.14)]):
    plate(f'ANTENNA_Dorsal_{i}',[[x,y,z-.15],[x,y+h,z],[x,y,z+.21]],'body_dark',.023)
# static discharge tips on the wing and fin
for side,ss in [('L',-1),('R',1)]:
    for i,x in enumerate([3.8,4.48,5.15]):
        cylinder(f'DISCHARGE_{side}_{i}',[ss*x,wtop(x),5.74],[ss*x,wtop(x),5.86],.006,'dark_metal',6)
cylinder('DISCHARGE_Tail',[0,3.90,6.22],[0,3.92,6.49],.006,'dark_metal',6)

# Airframe panel seams following fuselage ellipse
for i,z in enumerate([-4.9,-4.05,-2.25,-.65,1.35,3.12,4.53,6.45]):
    arr=np.array(SECTION)
    rx=float(np.interp(z,arr[:,0],arr[:,3]));ry=float(np.interp(z,arr[:,0],arr[:,4]));cy=float(np.interp(z,arr[:,0],arr[:,2]));
    tube(f'FUSELAGE_CircumferentialPanel_{i}',[[rx*1.007*np.cos(t),cy+ry*1.009*np.sin(t),z] for t in np.linspace(0,2*np.pi,55)],.007,'seam',5)
for side,ss in [('L',-1),('R',1)]:
    # service and avionics hatch seams at lateral fuselage
    x=ss*.90
    tube(f'FUSELAGE_{side}_SidePanel',[ [x,.33,-1.16],[ss*1.03,.36,-.41],
         [ss*1.10,.33,.30],[ss*.97,.38,.89]],.010,'seam',6)
    cylinder(f'FUSELAGE_{side}_FormationLight',[ss*.90,.36,2.80],[ss*.97,.36,3.48],.013,'paint_white',7)
    for j,z in enumerate([-3.55,-3.19,-2.83]):
        plate(f'FUSELAGE_{side}_CoolingVent_{j}',[[ss*.76,.48,z],[ss*.81,.48,z-.08],
            [ss*.84,.43,z-.08],[ss*.79,.43,z]],'carbon',.009)

# Programmed stores: four short-range/medium-range missiles under the wings.
def missile(label,ss,x,zcent,y=-.63):
    # missile nose points toward negative Z
    z0=zcent-1.65
    parts=[(z0,0,0,.006,.006),(z0+.28,0,0,.070,.070),
           (z0+.60,0,0,.105,.105),(z0+2.72,0,0,.105,.105),
           (z0+2.90,0,0,.087,.087),(z0+3.00,0,0,.043,.043)]
    loft(f'WEAPON_{label}_Body',[(z,x+cx,y+cy,rx,ry) for z,cx,cy,rx,ry in parts],'weapon',24)
    ring(f'WEAPON_{label}_Stripe',[x,y,z0+.48],[0,0,1],.103,.107,'yellow',28)
    ring(f'WEAPON_{label}_Band',[x,y,z0+2.57],[0,0,1],.102,.108,'weapon_dark',28)
    for sgn in [-1,1]:
       wingz=z0+2.48
       plate(f'WEAPON_{label}_RearFin_X_{sgn}',[[x+sgn*.07,y,wingz],[x+sgn*.33,y,wingz+.22],
         [x+sgn*.32,y,wingz+.47],[x+sgn*.07,y,wingz+.59]],'weapon_dark',.020)
       plate(f'WEAPON_{label}_FrontFin_X_{sgn}',[[x+sgn*.08,y,z0+.60],[x+sgn*.19,y,z0+.81],
         [x+sgn*.18,y,z0+.98],[x+sgn*.07,y,z0+1.06]],'weapon_dark',.016)
       # vertical fins
       plate(f'WEAPON_{label}_RearFin_Y_{sgn}',[[x,y+sgn*.08,wingz],[x,y+sgn*.31,wingz+.22],
         [x,y+sgn*.30,wingz+.44],[x,y+sgn*.08,wingz+.58]],'weapon_dark',.020)

# Invisible engine glow is not toggled in source; names allow disabling client-side.
# Separate armed scene generated below with +4 missiles.
BASE=SCENE.copy()
for side,ss in [('L',-1),('R',1)]:
    for j,x,zcent in [(1,2.40,3.35),(2,4.38,4.98)]:
        missile(f'{side}_{j}',ss,ss*x,zcent,y=-.68 if j==1 else -.48)

# Four primary landing wheels and struts are supplied in a separate gear-down variant.
ARMED=SCENE.copy()

def make_gear():
    # Nose gear forward, two main gear assemblies; retract externally in flight by replacing variant.
    for ident,x,y,z,wheel_r in [('N',0,-.52,-4.75,.29),('ML',-1.18,-.63,2.02,.38),('MR',1.18,-.63,2.02,.38)]:
        shaftbottom=-1.92 if ident=='N' else -1.90
        cylinder(f'GEAR_{ident}_Strut',[x,y,z],[x,shaftbottom+.35,z+.06],.065,'metal',18)
        cylinder(f'GEAR_{ident}_Hydraulic',[x,-1.13,z+.02],[x,shaftbottom+.27,z+.055],.034,'titanium',14)
        cylinder(f'GEAR_{ident}_Axle',[x-.18,shaftbottom+.16,z+.06],[x+.18,shaftbottom+.16,z+.06],.052,'titanium',16)
        # wheels rotate around X axis, supported by cylinder sections
        for k,off in enumerate(([-.12,.12] if ident=='N' else [0])):
            m=trimesh.creation.cylinder(radius=wheel_r,height=.15,sections=30)
            m.apply_transform(trimesh.geometry.align_vectors([0,0,1],[1,0,0]))
            m.apply_translation([x+off,shaftbottom+.16,z+.06])
            mesh(f'GEAR_{ident}_Tire_{k}',m.vertices,m.faces,'rubber')
            cylinder(f'GEAR_{ident}_Hub_{k}',[x+off-.083,shaftbottom+.16,z+.06],[x+off+.083,shaftbottom+.16,z+.06],wheel_r*.46,'metal',24)
    for side,ss in [('L',-1),('R',1)]:
        plate(f'GEAR_{side}_Door',[[ss*.90,-.65,1.10],[ss*1.43,-.65,1.30],
             [ss*1.42,-.65,2.67],[ss*.90,-.65,2.75]],'body_dark',.035)

make_gear()
GEAR=SCENE.copy()

for file,scene in [('EF2000_flight_armed.glb',ARMED),('EF2000_flight_clean.glb',BASE),('EF2000_gear_down.glb',GEAR)]:
    output=OUT/file
    scene.export(output,file_type='glb')
    print(file,output.stat().st_size,'bytes')
print(stats)
# all models are original geometry: named subassemblies for rigging in Three.js.