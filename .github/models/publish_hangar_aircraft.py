#!/usr/bin/env python3
"""Publish the user-selected GLBs to the hangar without changing flight physics."""
import argparse
import io
import json
import struct
import zipfile
from pathlib import Path


AIRCRAFT = (
    ('mc130j-centurion', 'MC-130J_Commando_II.glb', 'MC-130J Commando II'),
    ('mh6-centurion', 'MH-6_Little_Bird.glb', 'MH-6 Little Bird'),
    ('ah6-centurion', 'AH-6_Little_Bird.glb', 'AH-6 Little Bird'),
    ('a10-centurion', 'A-10_Thunderbolt_II.glb', 'A-10 Thunderbolt II'),
    ('hermes900-centurion', 'Hermes_900.glb', 'Hermes 900'),
    ('mq9-centurion', 'MQ-9_Reaper.glb', 'MQ-9 Reaper'),
    ('uh60-new', 'UH-60_Black_Hawk.glb', 'UH-60 Black Hawk'),
)


def verify_glb(data, name):
    if len(data) < 20:
        raise ValueError(f'{name}: GLB too short')
    magic, version, length, json_length, chunk_type = struct.unpack_from('<4sIIII', data)
    if magic != b'glTF' or version != 2 or length != len(data) or chunk_type != 0x4E4F534A:
        raise ValueError(f'{name}: invalid GLB header')
    if json_length > len(data) - 20:
        raise ValueError(f'{name}: invalid JSON chunk length')
    doc = json.loads(data[20:20 + json_length])
    if not doc.get('meshes') or any(item.get('uri') for item in doc.get('buffers', []) + doc.get('images', [])):
        raise ValueError(f'{name}: missing meshes or external resources')


def publish(out, records, model_id, name, data, author, license_name, source=''):
    verify_glb(data, model_id)
    (out / (model_id + '.glb')).write_bytes(data)
    records.append({'id': model_id, 'name': name, 'glb': f'models/{model_id}.glb',
                    'source': source, 'author': author, 'license': license_name,
                    'status': 'ready'})


def publish_hangar(input_dir, output_dir):
    sources = input_dir / 'model-sources'
    out = output_dir
    out.mkdir(parents=True, exist_ok=True)
    manifest_path = out / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {'models': []}
    ids = {item[0] for item in AIRCRAFT} | {'f16-rebuilt', 'c130j-detailed'}
    records = [record for record in manifest['models'] if record['id'] not in ids]
    with zipfile.ZipFile(sources / 'hangar-aircraft.zip') as archive:
        for model_id, filename, name in AIRCRAFT:
            author = 'CENTURION2' if model_id != 'uh60-new' else 'Source asset author unverified'
            license_name = 'original approximation' if model_id != 'uh60-new' else 'unverified'
            publish(out, records, model_id, name, archive.read(filename), author, license_name)
    publish(out, records, 'f16-rebuilt', 'F-16 Fighting Falcon (ricostruzione)',
            (sources / 'f16-rebuilt.glb').read_bytes(), 'CENTURION2', 'original approximation')
    # Keep each repository blob below the transport limit; ZIP CRCs are checked on read.
    c130_zip = b''.join((sources / f'c130j-highdetail.zip.{i:02d}').read_bytes() for i in range(3))
    with zipfile.ZipFile(io.BytesIO(c130_zip)) as archive:
        publish(out, records, 'c130j-detailed', 'C-130J Super Hercules',
                archive.read('lockheed_martin_c130jsuper_hercules_reupload.glb'), 'KOG_THORNS', 'CC BY 4.0',
                'https://sketchfab.com/3d-models/lockheed-martin-c130jsuper-hercules-reupload-223b4ff4abb945038fe35726bedd0db1')
    manifest['models'] = records
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'Published {len(ids)} aircraft to the hangar')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', type=Path, default=Path('.'))
    parser.add_argument('--output-dir', type=Path, default=Path('extracted/site/models'))
    args = parser.parse_args()
    publish_hangar(args.input_dir, args.output_dir)


if __name__ == '__main__':
    main()
