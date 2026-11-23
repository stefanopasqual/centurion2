#!/usr/bin/env python3
"""Install the owner's rigged OBJ-derived pilot in the hangar and missions."""
import hashlib
import json
import struct
import sys
from pathlib import Path
from static_pilot import make_hangar_glb

site = Path(sys.argv[1])
parts = [Path('model-sources/pilot') / f'pilot.part{i:02}' for i in range(9)]
data = b''.join(part.read_bytes() for part in parts)
if hashlib.sha256(data).hexdigest() != '2ebab52fb3de36277bc2f97c5a71210c9d597a8c2a4aaa651f116d7f136ddb2c':
    raise RuntimeError('Pilot parts do not match the verified model')
if len(data) < 20:
    raise RuntimeError('Pilot model is incomplete')
magic, version, size, json_size, kind = struct.unpack_from('<4sIIII', data)
if magic != b'glTF' or version != 2 or size != len(data) or kind != 0x4E4F534A:
    raise RuntimeError('Pilot is not a complete GLB 2.0 file')
document = json.loads(data[20:20 + json_size])
if not document.get('skins') or len(document['skins'][0].get('joints', [])) < 10:
    raise RuntimeError('Pilot skeleton is missing')
names = {node.get('name') for node in document.get('nodes', [])}
required = {'spine', 'head', 'thigh_L', 'thigh_R', 'shin_L', 'shin_R', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R'}
if not required.issubset(names):
    raise RuntimeError('Pilot bones are incomplete')
for resource in document.get('buffers', []) + document.get('images', []):
    if resource.get('uri') and not resource['uri'].startswith('data:'):
        raise RuntimeError('Pilot has an external resource')

asset = site / 'assets/pilota.glb'
asset.parent.mkdir(parents=True, exist_ok=True)
asset.write_bytes(data)
# A smaller, non-skinned rest pose avoids GPU skinning for the mobile hangar.
# A distinct URL also bypasses a previous cached hangar model on the device.
hangar_asset = site / 'assets/pilota-hangar-v2.glb'
hangar_asset.write_bytes(make_hangar_glb(data))
script = site / 'js/pilota3d.js'
script.write_bytes(Path('.github/pilot/pilota3d.js').read_bytes())

mission = site / 'js/csar_zagros.js'
text = mission.read_text(encoding='utf-8')
old = 'PILOTA3D.posa(P, nome);'
new = 'PILOTA3D.posa(P, nome, k);'
if text.count(old) == 1:
    text = text.replace(old, new, 1)
elif text.count(new) != 1:
    raise RuntimeError('Could not find the rescue mission pose hook')
# The recovered WSO also appears in the later departure cinematic.  Use the
# same pilot there, instead of reverting to the old procedural figure.
old_wso = 'const wso = persona({ tuta: 0x5d6447, giubbotto: 0x3b4230, casco: 0x8b8d84 });'
new_wso = 'const wso = vestiPilota(persona({ tuta: 0x5d6447, giubbotto: 0x3b4230, casco: 0x8b8d84 }));'
if text.count(old_wso) == 1:
    text = text.replace(old_wso, new_wso, 1)
elif text.count(new_wso) != 1:
    raise RuntimeError('Could not find the rescued WSO in the departure cinematic')
mission.write_text(text, encoding='utf-8')

# The academy's Grappa rescue module has a second pilot implementation. Dress
# only the rescued pilot and the ejection pilot; rescuers/enemies stay intact.
rescue = site / 'js/soccorso.js'
text = rescue.read_text(encoding='utf-8')
def replace_once(old, new, label):
    global text
    if text.count(new) == 1:
        return
    if text.count(old) == 1:
        text = text.replace(old, new, 1)
    else:
        raise RuntimeError(f'Could not patch {label}')

helper = '''  function vestiPilota(g) {
    const P3 = window.PILOTA3D; if (!P3 || !g) return g;
    const fai = () => { if (P3.veste(g)) P3.posa(g, g.userData.posaP3 || g.userData.posaNome, g.userData.posaK); };
    if (P3.pronto) fai(); else P3.carica().then(fai);
    return g;
  }
  function persona(o) {'''
replace_once('  function persona(o) {', helper, 'academy pilot loader')
old_pose = '  function posa(P, nome, k, f) {\n    const j = P.userData.j;'
new_pose = '''  function posa(P, nome, k, f) {
    P.userData.posaNome = nome; P.userData.posaK = k;
    P.userData.posaP3 = nome === "saluta" && W && P === W.ip ? "saluta_seduto" : nome;
    if (P.userData.p3d && window.PILOTA3D) PILOTA3D.posa(P, P.userData.posaP3, k);
    const j = P.userData.j;'''
replace_once(old_pose, new_pose, 'academy pose hook')
old_rescued = 'W.ip = add(persona({ nome: "LUPO 21", tuta: 0x56653a, giubbotto: 0x3d4a2c, casco: 0xd9d8cf, visore: true }));'
new_rescued = 'W.ip = add(vestiPilota(persona({ nome: "LUPO 21", tuta: 0x56653a, giubbotto: 0x3d4a2c, casco: 0xd9d8cf, visore: true })));'
replace_once(old_rescued, new_rescued, 'rescued pilot')
old_eject = 'const pil = persona({ tuta: 0x56653a, giubbotto: 0x3d4a2c, casco: 0xd9d8cf, visore: true });'
new_eject = 'const pil = vestiPilota(persona({ tuta: 0x56653a, giubbotto: 0x3d4a2c, casco: 0xd9d8cf, visore: true }));'
replace_once(old_eject, new_eject, 'academy ejection pilot')
rescue.write_text(text, encoding='utf-8')

html = (site / 'index.html').read_text(encoding='utf-8')
if 'js/pilota3d.js' not in html or 'js/csar_zagros.js' not in html:
    raise RuntimeError('Pilot or rescue mission script is not loaded')
print(f'PASS: owner pilot installed in hangar and rescue/ejection scenes ({len(data)} bytes)')
