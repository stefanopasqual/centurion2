#!/usr/bin/env python3
"""Publish the supplied GLB collection as selectable hangar models."""
import json
import shutil
import struct
from pathlib import Path

MODELS = (
    ('f16-rebuilt', 'F-16 Fighting Falcon · dettagliato', False),
    ('a10-centurion', 'A-10 Thunderbolt II', False),
    ('mc130j-centurion', 'MC-130J · adattamento da C-130J', True),
    ('c130j-hercules', 'C-130J Super Hercules', False),
    ('mh6-centurion', 'MH-6 Little Bird', True),
    ('ah6-centurion', 'AH-6 Little Bird', True),
    ('uh60-pack', 'UH-60 Black Hawk · versione aggiuntiva', True),
    ('mq9-centurion', 'MQ-9 Reaper', True),
    ('hermes900-centurion', 'Hermes 900', True),
    ('pj-operator', 'Pararescue Jumper (PJ) · operatore CSAR', False),
    ('pj-mk18', 'Mk18 Mod0 · carabina del PJ', False),
    ('pj-m18', 'SIG M18 · pistola del PJ', False),
    ('pj-nvg', 'Visore notturno quadritubo del PJ', False),
    ('pj-radio', 'Radio PRC-152 del PJ', False),
    ('pj-ifak', 'Kit medico IFAK del PJ', False),
)

def inspect_glb(path, expect_animation):
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError(f'{path}: GLB too short')
    magic, version, size, json_size, chunk_type = struct.unpack_from('<4sIIII', data)
    if magic != b'glTF' or version != 2 or size != len(data) or chunk_type != 0x4E4F534A:
        raise ValueError(f'{path}: invalid GLB header')
    if json_size > len(data) - 20:
        raise ValueError(f'{path}: incomplete GLB JSON chunk')
    gltf = json.loads(data[20:20 + json_size])
    if not gltf.get('scenes') or not gltf.get('meshes'):
        raise ValueError(f'{path}: missing scene or mesh')
    for resource in gltf.get('buffers', []) + gltf.get('images', []):
        if resource.get('uri') and not resource['uri'].startswith('data:'):
            raise ValueError(f'{path}: external resource {resource["uri"]}')
    if expect_animation and not gltf.get('animations'):
        raise ValueError(f'{path}: expected propeller or rotor animation')

def add_hangar_models(root, out, report, dry_run=False):
    assets = Path(root) / 'model-sources' / 'hangar'
    out = Path(out)
    ids = {item[0] for item in MODELS}
    if len(ids) != len(MODELS):
        raise ValueError('Duplicate hangar model IDs')
    if any(item.get('id') in ids for item in report):
        raise ValueError('Hangar model ID collides with an existing model')
    for model_id, name, expect_animation in MODELS:
        source = assets / (model_id + '.glb')
        target = out / (model_id + '.glb')
        if not dry_run:
            if model_id == 'c130j-hercules':
                # Concatenate source bytes before validating the complete GLB.
                parts = [assets / 'c130j-hercules.part00', assets / 'c130j-hercules.part01']
                with target.open('wb') as output:
                    for part in parts:
                        with part.open('rb') as inp:
                            shutil.copyfileobj(inp, output)
                inspect_glb(target, expect_animation)
            elif model_id == 'mc130j-centurion':
                # The detailed variant is stored in four bounded-size source
                # parts. Validate the reconstructed GLB including animations.
                parts = [assets / f'mc130j-centurion.part{i:02}' for i in range(4)]
                with target.open('wb') as output:
                    for part in parts:
                        with part.open('rb') as inp:
                            shutil.copyfileobj(inp, output)
                inspect_glb(target, expect_animation)
            else:
                inspect_glb(source, expect_animation)
                shutil.copyfile(source, target)
        item = {'id': model_id, 'name': name,
                'glb': None if dry_run else f'models/{model_id}.glb',
                'status': 'ready-for-conversion' if dry_run else 'ready',
                'source': 'CENTURION2 hangar collection'}
        if model_id in ('f16-rebuilt', 'a10-centurion'):
            source = {
                'f16-rebuilt': 'https://sketchfab.com/3d-models/f-16-fighting-falcon-fighter-jet-free-f0b00989e5634764848ef2c235c64db5',
                'a10-centurion': 'https://sketchfab.com/3d-models/a-10-thunderbolt-ii-free-f297968397534b59bd41fe989497ffcb',
            }[model_id]
            item.update(author='bohmerang', license='CC BY-NC-SA 4.0',
                        license_url='https://creativecommons.org/licenses/by-nc-sa/4.0/',
                        source=source, attribution='Orientamento adattato per CENTURION2; carrello F-16 rimosso.')
        if model_id == 'c130j-hercules':
            item.update(author='KOG_THORNS', license='CC BY 4.0',
                        license_url='https://creativecommons.org/licenses/by/4.0/',
                        source='https://sketchfab.com/3d-models/lockheed-martin-c130jsuper-hercules-reupload-223b4ff4abb945038fe35726bedd0db1')
        if model_id == 'mc130j-centurion':
            item.update(author='KOG_THORNS', license='CC BY 4.0',
                        license_url='https://creativecommons.org/licenses/by/4.0/',
                        source='https://sketchfab.com/3d-models/lockheed-martin-c130jsuper-hercules-reupload-223b4ff4abb945038fe35726bedd0db1',
                        attribution='C-130J adapted to suggest the MC-130J, with refuelling pods, sensor and animated propellers; approximate variant.')
        if model_id == 'pj-operator':
            item.update(author='DanlyVostok', license='CC BY 4.0',
                        license_url='https://creativecommons.org/licenses/by/4.0/',
                        source='https://sketchfab.com/3d-models/soldier-full-tactical-gear-lowpolygameready-850593a8c7114c188395ba1849a66eb9',
                        attribution='Soldier Full Tactical Gear by DanlyVostok, adapted as a Pararescue Jumper: helmet, plate carrier and pouches tinted coyote, textures reduced to 1024 px.')
        if model_id == 'pj-mk18':
            item.update(author='notcplkerry', license='CC BY 4.0',
                        license_url='https://creativecommons.org/licenses/by/4.0/',
                        source='https://sketchfab.com/3d-models/low-poly-mk18-mod0-full-loadout-9d913f52f59049219185cbccf688d5f1',
                        attribution='Low-Poly Mk18 Mod0 full loadout by notcplkerry, carried slung by the PJ in the hangar.')
        if model_id == 'pj-m18':
            item.update(author='k4rmax', license='CC BY 4.0',
                        license_url='https://creativecommons.org/licenses/by/4.0/',
                        source='https://sketchfab.com/3d-models/sig-p320-m18-643cf5792c8e4ce5954d7929543857d3',
                        attribution='SIG P320 M18 by k4rmax, packed as GLB and holstered on the PJ in the hangar.')
        if model_id in ('pj-nvg', 'pj-radio', 'pj-ifak'):
            author, url, note = {
                'pj-nvg': ('karmy2k', 'https://sketchfab.com/3d-models/night-vision-goggles-navy-seals-6cf9c96971fb4dc19a225d68a14d1458',
                           'Night Vision Goggles Navy Seals by karmy2k: original helmet removed, material converted to metallic-roughness.'),
                'pj-radio': ('r4m', 'https://sketchfab.com/3d-models/prc-152-00e19a0326c84dabb2a995d92985470b',
                             'PRC 152 by r4m: packed as GLB, textures reduced to 512 px.'),
                'pj-ifak': ('yronthal', 'https://sketchfab.com/3d-models/medical-kit-bag-abc2f95bce4c4e69bfc0d8742d37e78b',
                            'Medical Kit Bag by yronthal: packed as GLB, textures reduced to 512 px.'),
            }[model_id]
            item.update(author=author, license='CC BY 4.0',
                        license_url='https://creativecommons.org/licenses/by/4.0/', source=url, attribution=note)
        if model_id == 'mq9-centurion':
            item.update(author='IProZenoN', license='CC BY 4.0',
                        license_url='https://creativecommons.org/licenses/by/4.0/',
                        source='https://sketchfab.com/3d-models/mq-9-fabe963feb354c5584b51f9c470c3f7e',
                        attribution='MQ-9 adapted from an optimized derivative: extended gear removed and propeller animated.')
        if model_id in ('mh6-centurion', 'ah6-centurion'):
            item.update(author='Muhamad Mirza Arrafi', license='CC BY 4.0',
                        license_url='https://creativecommons.org/licenses/by/4.0/',
                        source='https://sketchfab.com/3d-models/mh-6-little-bird-low-poly-d7068144bfeb4d91bde5d30755657d97',
                        attribution='Low-poly original adapted for CENTURION2 with animated rotors; the transport variant includes added benches.')
        report.append(item)
        print(f'PASS hangar {model_id}' + ('' if dry_run else f': {target.stat().st_size} bytes'))


