"""CENTURION2 · F-14 Tomcat originale procedurale (GLB).
Geometria costruita da quote pubbliche del velivolo (lunghezza 19,1 m, apertura 19,55 m ali avanti,
altezza 4,88 m), non derivata da modelli di terzi. Metri, muso verso +Z, alto +Y, carrello retratto.
Uso: python genera_f14.py uscita.glb [freccia_ala_gradi]"""
import sys, json, struct, math
import numpy as np

OUT = sys.argv[1] if len(sys.argv) > 1 else "f14.glb"
SWEEP = float(sys.argv[2]) if len(sys.argv) > 2 else 25.0

parts = {}  # materiale -> lista di (V, N, I)

def add(mat, V, I, N=None, smooth=True):
    V = np.asarray(V, np.float32); I = np.asarray(I, np.uint32).reshape(-1, 3)
    if N is None:
        N = np.zeros_like(V)
        fn = np.cross(V[I[:, 1]] - V[I[:, 0]], V[I[:, 2]] - V[I[:, 0]])
        for k in range(3): np.add.at(N, I[:, k], fn)
        N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    parts.setdefault(mat, []).append((V, np.asarray(N, np.float32), I))

def flat(mat, V, I):
    """facce piane: vertici duplicati per triangolo (spigoli vivi)"""
    V = np.asarray(V, np.float32); I = np.asarray(I, np.uint32).reshape(-1, 3)
    VV = V[I.reshape(-1)]; fn = np.cross(VV[1::3] - VV[0::3], VV[2::3] - VV[0::3])
    fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-9)
    add(mat, VV, np.arange(len(VV)), np.repeat(fn, 3, axis=0))

# ---------- sezioni loftate (fusoliera, gondole, ugelli) ----------
def superellisse(n, rx, ry, p=2.0, cy=0.0, top=1.0, bot=1.0):
    t = np.linspace(0, 2 * math.pi, n, endpoint=False)
    c, s = np.cos(t), np.sin(t)
    x = rx * np.sign(c) * np.abs(c) ** (2 / p); y = ry * np.sign(s) * np.abs(s) ** (2 / p)
    y = np.where(y > 0, y * top, y * bot)
    return np.stack([x, y + cy], 1)

def loft(mat, sez, chiudi=(True, True), cx=0.0):
    """sez: lista di (z, punti2D[n,2]) con lo stesso n"""
    n = len(sez[0][1]); V = []; I = []
    for z, P in sez:
        for x, y in P: V.append((x + cx, y, z))
    for i in range(len(sez) - 1):
        for j in range(n):
            a, b = i * n + j, i * n + (j + 1) % n; c, d = a + n, b + n
            I += [a, c, b, b, c, d]
    if chiudi[0]:
        V.append((cx + sez[0][1][:, 0].mean(), sez[0][1][:, 1].mean(), sez[0][0])); k = len(V) - 1
        for j in range(n): I += [k, (j + 1) % n, j]
    if chiudi[1]:
        o = (len(sez) - 1) * n; V.append((cx + sez[-1][1][:, 0].mean(), sez[-1][1][:, 1].mean(), sez[-1][0])); k = len(V) - 1
        for j in range(n): I += [k, o + j, o + (j + 1) % n]
    add(mat, V, I)

GRIGIO, SCURO, VETRO, UGELLO, NERO = "grigio", "scuro", "vetro", "ugello", "nero"
N = 40
lerp = lambda a, b, u: a + (b - a) * u

# fusoliera anteriore: radome, abitacolo, dorso fino alla zona delle prese d'aria
staz = [(9.55, .02, .02, 0), (9.3, .16, .17, .02), (8.8, .32, .34, .03), (8.0, .48, .5, .05), (7.0, .6, .62, .1),
        (6.0, .68, .72, .14), (5.0, .74, .8, .18), (4.0, .8, .86, .2), (3.0, .86, .9, .22), (2.0, .95, .92, .22),
        (0.5, 1.05, .82, .2), (-1.5, 1.0, .7, .18), (-4.0, .8, .55, .12), (-6.5, .55, .42, .08), (-8.2, .38, .3, .04)]
loft(GRIGIO, [(z, superellisse(N, rx, ry, 2.3, cy)) for z, rx, ry, cy in staz])
# sonda del muso
loft(SCURO, [(9.55 + u, superellisse(8, .03 * (1 - u / .7) + .005, .03 * (1 - u / .7) + .005)) for u in (0, .35, .7)])

# tettuccio a bolla (due posti in tandem), vetro scuro
can = []
for z, rx, ry in [(6.3, .02, .02), (6.0, .3, .22), (5.4, .45, .42), (4.5, .5, .5), (3.6, .48, .48), (2.8, .42, .38), (2.0, .3, .22), (1.4, .1, .06)]:
    P = superellisse(N, rx, ry, 2.0); P[:, 1] = np.maximum(P[:, 1], 0) + .78
    can.append((z, P))
loft(VETRO, can)

# corpo centrale piatto ("pancake") e tunnel fra le gondole
pan = []
for z, w, h in [(3.8, 1.3, .3), (2.8, 2.5, .34), (1.2, 2.9, .38), (-1.0, 2.9, .38), (-3.5, 2.7, .34), (-6.0, 2.4, .28), (-7.8, 2.0, .2)]:
    pan.append((z, superellisse(N, w, h, 6.0, .05)))
loft(GRIGIO, pan)

# gondole motori: prese d'aria rettangolari inclinate in avanti, sezione che diventa tonda verso gli ugelli
for sx in (-1, 1):
    X = 1.8 * sx; g = []
    for z, rx, ry, p, cy in [(3.2, .68, .78, 6, -.28), (2.0, .72, .8, 5, -.25), (0.0, .74, .8, 4, -.22), (-3.0, .74, .76, 3, -.2),
                              (-6.0, .7, .7, 2.4, -.16), (-7.8, .62, .62, 2.0, -.13), (-8.6, .58, .58, 2.0, -.13)]:
        g.append((z, superellisse(N, rx, ry, p, cy)))
    loft(GRIGIO, g, chiudi=(False, False), cx=X)
    # bocca della presa d'aria (fondo scuro) e ugello
    loft(NERO, [(3.2, superellisse(N, .6, .7, 6, -.28)), (2.8, superellisse(N, .58, .66, 6, -.28))], chiudi=(False, True), cx=X)
    loft(UGELLO, [(-8.6, superellisse(N, .58, .58, 2, -.13)), (-9.2, superellisse(N, .56, .56, 2, -.13)), (-9.6, superellisse(N, .52, .52, 2, -.13))], chiudi=(False, False), cx=X)
    loft(NERO, [(-9.35, superellisse(N, .47, .47, 2, -.13)), (-9.0, superellisse(N, .34, .34, 2, -.13))], chiudi=(False, True), cx=X)
    # labbro della presa d'aria (cornice)
    loft(GRIGIO, [(3.25, superellisse(N, .7, .8, 6, -.28)), (3.2, superellisse(N, .6, .7, 6, -.28))], chiudi=(False, False), cx=X)

# ---------- superfici portanti (profilo simmetrico, rastremazione) ----------
def ala(mat, radice, punta, t_rad, t_pun, ns=14, y0=0.0, roll=0.0, perno=None):
    """radice/punta: ((x,z) bordo d'attacco, (x,z) bordo d'uscita). Superficie sottile con profilo NACA a 4 cifre."""
    f = np.linspace(0, 1, ns)
    prof = 5 * (.2969 * np.sqrt(f) - .126 * f - .3516 * f ** 2 + .2843 * f ** 3 - .1036 * f ** 4)
    V = []
    for (le, te), t in ((radice, t_rad), (punta, t_pun)):
        le, te = np.array(le), np.array(te); c = np.linalg.norm(te - le)
        for s in (1, -1):
            for k in range(ns):
                p = le + (te - le) * f[k]; V.append((p[0], y0 + s * prof[k] * t * c, p[1]))
    V = np.array(V, np.float64)
    if roll:  # rotazione attorno all'asse del bordo d'attacco della radice (per le derive inclinate)
        a = math.radians(roll); c, s = math.cos(a), math.sin(a)
        o = np.array([radice[0][0], y0, radice[0][1]]); d = V - o
        x, y = d[:, 0] * c - d[:, 1] * s, d[:, 0] * s + d[:, 1] * c; V = np.stack([x, y, d[:, 2]], 1) + o
    I = []
    R, T = 0, 2 * ns  # radice: [0..ns) sopra, [ns..2ns) sotto
    for s in (0, ns):
        for k in range(ns - 1):
            a, b = R + s + k, R + s + k + 1; c, d = T + s + k, T + s + k + 1
            I += ([a, c, b, b, c, d] if s == 0 else [a, b, c, b, d, c])
    for k in range(ns - 1):  # chiusura punta e radice
        I += [T + k, T + ns + k, T + k + 1, T + k + 1, T + ns + k, T + ns + k + 1]
        I += [k, k + 1, ns + k, k + 1, ns + k + 1, ns + k]
    flat(mat, V, I)

def ruota_y(p, centro, gradi):
    a = math.radians(gradi); c, s = math.cos(a), math.sin(a); x, z = p[0] - centro[0], p[1] - centro[1]
    return (centro[0] + x * c + z * s, centro[1] - x * s + z * c)

for sx in (-1, 1):
    # guanto fisso (molto a freccia, raccorda il muso al perno dell'ala)
    ala(GRIGIO, ((1.0 * sx, 5.0), (1.0 * sx, -2.6)), ((3.2 * sx, -.6), (3.2 * sx, -2.6)), .03, .05, y0=.44)
    # ala a geometria variabile: perno a 2,7 m dall'asse, freccia regolabile (20° = ali avanti)
    perno = (2.9 * sx, -1.7)
    le_r, te_r = (2.9 * sx, -1.2), (2.9 * sx, -4.6)
    le_t, te_t = (9.78 * sx, -3.7), (9.78 * sx, -5.0)
    rot = lambda p: ruota_y(p, perno, -sx * (SWEEP - 20.0))
    ala(GRIGIO, (rot(le_r), rot(te_r)), (rot(le_t), rot(te_t)), .07, .05, y0=.4)
    # stabilatori orizzontali
    ala(GRIGIO, ((2.3 * sx, -5.6), (2.3 * sx, -9.4)), ((5.0 * sx, -8.5), (5.0 * sx, -9.6)), .05, .04, y0=-.02)

# derive: ricostruite come superfici verticali (piano YZ) inclinate di 5° verso l'esterno
def deriva(sx):
    ns = 14; f = np.linspace(0, 1, ns)
    prof = 5 * (.2969 * np.sqrt(f) - .126 * f - .3516 * f ** 2 + .2843 * f ** 3 - .1036 * f ** 4)
    base_y, alt = .45, 3.0
    radice = ((-3.3, 0.0), (-8.1, 0.0)); punta = ((-6.7, alt), (-8.35, alt))
    V = []
    for (le, te), t in ((radice, .045), (punta, .035)):
        c = abs(te[0] - le[0])
        for s in (1, -1):
            for k in range(ns):
                z = le[0] + (te[0] - le[0]) * f[k]; y = base_y + le[1]
                V.append((s * prof[k] * t * c, y, z))
    V = np.array(V, np.float64)
    cant = math.radians(5 * sx); c, s = math.cos(cant), math.sin(cant)
    x, y = V[:, 0] * c + (V[:, 1] - base_y) * s, -V[:, 0] * s + (V[:, 1] - base_y) * c
    V = np.stack([x + 1.8 * sx, y + base_y, V[:, 2]], 1)
    I = []; T = 2 * ns
    for o in (0, ns):
        for k in range(ns - 1):
            a, b = o + k, o + k + 1; cc, d = T + o + k, T + o + k + 1
            I += ([a, b, cc, b, d, cc] if o == 0 else [a, cc, b, b, cc, d])
    for k in range(ns - 1):
        I += [T + k, T + k + 1, T + ns + k, T + k + 1, T + ns + k + 1, T + ns + k]
        I += [k, ns + k, k + 1, k + 1, ns + k, ns + k + 1]
    flat(GRIGIO, V, I)
    return V
for sx in (-1, 1): deriva(sx)

# pinne ventrali sotto le gondole
for sx in (-1, 1):
    X = 1.8 * sx
    V = [(X, -.75, -4.8), (X, -.75, -7.6), (X, -1.25, -7.3), (X + .03 * sx, -.75, -4.8), (X + .03 * sx, -.75, -7.6), (X + .03 * sx, -1.25, -7.3)]
    flat(GRIGIO, V, [0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 2, 0, 3, 2, 3, 5])

# coda piatta "a castoro" fra gli ugelli
bt = [(-6.5, -1.0, .1), (-10.0, -.75, .06), (-10.3, -.45, .04)]
V = []; 
for z, w, h in [(-6.5, 1.0, .1), (-9.9, .8, .06), (-10.25, .45, .04)]:
    for x, y in ((-w, -h), (w, -h), (w, h), (-w, h)): V.append((x, y - .05, z))
I = []
for i in range(2):
    for j in range(4):
        a, b = i * 4 + j, i * 4 + (j + 1) % 4; I += [a, b, a + 4, b, b + 4, a + 4]
I += [8, 9, 10, 8, 10, 11]
flat(GRIGIO, V, I)

# ---------- scrittura GLB ----------
MAT = {GRIGIO: ([.24, .26, .29, 1], .15, .68), SCURO: ([.12, .12, .13, 1], .2, .6), VETRO: ([.09, .13, .17, 1], .6, .12),
       UGELLO: ([.32, .3, .28, 1], .8, .45), NERO: ([.03, .03, .03, 1], 0, .9)}
nomi = list(parts)
buf = bytearray(); views = []; accs = []; prims = []
def blob(data, target=None):
    while len(buf) % 4: buf.append(0)
    views.append({"buffer": 0, "byteOffset": len(buf), "byteLength": len(data), **({"target": target} if target else {})}); buf.extend(data); return len(views) - 1
for mi, m in enumerate(nomi):
    V = np.concatenate([p[0] for p in parts[m]]); Nn = np.concatenate([p[1] for p in parts[m]])
    off = np.cumsum([0] + [len(p[0]) for p in parts[m]][:-1]); I = np.concatenate([p[2] + o for p, o in zip(parts[m], off)]).astype(np.uint32)
    vp = blob(V.astype(np.float32).tobytes(), 34962); vn = blob(Nn.astype(np.float32).tobytes(), 34962); vi = blob(I.tobytes(), 34963)
    accs.append({"bufferView": vp, "componentType": 5126, "count": len(V), "type": "VEC3", "min": V.min(0).tolist(), "max": V.max(0).tolist()})
    accs.append({"bufferView": vn, "componentType": 5126, "count": len(Nn), "type": "VEC3"})
    accs.append({"bufferView": vi, "componentType": 5125, "count": int(I.size), "type": "SCALAR"})
    prims.append({"attributes": {"POSITION": len(accs) - 3, "NORMAL": len(accs) - 2}, "indices": len(accs) - 1, "material": mi})
materials = [{"name": m, "doubleSided": True, "pbrMetallicRoughness": {"baseColorFactor": MAT[m][0], "metallicFactor": MAT[m][1], "roughnessFactor": MAT[m][2]}} for m in nomi]
gltf = {"asset": {"version": "2.0", "generator": "CENTURION2 genera_f14.py", "extras": {"title": "F-14 Tomcat (CENTURION2 original procedural)", "license": "original CENTURION2 geometry from public dimensions"}},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"name": "CENTURION_F14", "mesh": 0}],
        "meshes": [{"name": "F14", "primitives": prims}], "materials": materials, "accessors": accs, "bufferViews": views, "buffers": [{"byteLength": 0}]}
while len(buf) % 4: buf.append(0)
gltf["buffers"][0]["byteLength"] = len(buf)
js = json.dumps(gltf, separators=(",", ":")).encode(); js += b" " * ((4 - len(js) % 4) % 4)
tot = 12 + 8 + len(js) + 8 + len(buf)
with open(OUT, "wb") as f:
    f.write(struct.pack("<4sII", b"glTF", 2, tot)); f.write(struct.pack("<I4s", len(js), b"JSON")); f.write(js); f.write(struct.pack("<I4s", len(buf), b"BIN\x00")); f.write(buf)
allv = np.concatenate([p[0] for m in nomi for p in parts[m]])
print("scritto", OUT, round(tot / 1e3), "kB, triangoli", sum(len(p[2]) for m in nomi for p in parts[m]), "ingombro", (allv.max(0) - allv.min(0)).round(2).tolist())
