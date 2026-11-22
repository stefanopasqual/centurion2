#!/usr/bin/env python3
"""Publish the supplied GLB collection as selectable hangar models."""
import json
import shutil
import struct
from pathlib import Path

MODELS = (
    ('f16-rebuilt', 'F-16 Fighting Falcon · dettagliato', False),
    ('a10-centurion', 'A-10 Thunderbolt II', False),
    ('mc130j-centurion', 'MC-130J Commando II', True),
    ('c130j-hercules', 'C-130J Super Hercules', False),
    ('mh6-centurion', 'MH-6 Little Bird', True),
    ('ah6-centurion', 'AH-6 Little Bird', True),
    ('uh60-pack', 'UH-60 Black Hawk · versione aggiuntiva', True),
    ('mq9-centurion', 'MQ-9 Reaper', True),
    ('hermes900-centurion', 'Hermes 900', True),
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
        report.append(item)
        print(f'PASS hangar {model_id}' + ('' if dry_run else f': {target.stat().st_size} bytes'))

