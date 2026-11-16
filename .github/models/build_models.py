#!/usr/bin/env python3
"""Extract verified user-supplied Sketchfab archives and convert with Blender.
One source is one distinct model. Never download an unlicensed third-party mesh.
To run: python3 build_models.py --input-dir . --output-dir extracted/site/models
"""
import argparse
import json
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

MODELS = [
    ('typhoon', 'eurofighter-typhoon-fighter-jet-free.zip', 'Eurofighter Typhoon', 'https://sketchfab.com/3d-models/eurofighter-typhoon-fighter-jet-free-992bcc8987964ca09d55410330aa8579'),
    ('f15e', 'f-15e-strike-eagle-fighter-jet-free.zip', 'F-15E Strike Eagle', 'https://sketchfab.com/3d-models/f-15e-strike-eagle-fighter-jet-free-fff7d75490474e9b964d90cc031c8d01'),
    ('su57', 'sukhoi-su-57-felon-p-fighter-jet-free.zip', 'Sukhoi Su-57 Felon (P)', 'https://sketchfab.com/3d-models/sukhoi-su-57-felon-p-fighter-jet-free-31127bc63bc048debb694aa88bbaafae'),
    ('weapons', 'missile-bomb-collection-fighter-jets-free.zip', 'Missile & Bomb Collection', 'https://sketchfab.com/3d-models/missile-bomb-collection-fighter-jets-free-d203b678424a43568703bf85ba680f47'),
]


def unpack_safe(path, dest):
    with zipfile.ZipFile(path) as z:
        for info in z.infolist():
            target = (dest / info.filename).resolve()
            if not target.is_relative_to(dest.resolve()):
                raise ValueError('Unsafe archive path: ' + info.filename)
            if info.is_dir():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(info) as src, target.open('wb') as dst:
                shutil.copyfileobj(src, dst)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input-dir', type=Path, default=Path('.'))
    ap.add_argument('--output-dir', type=Path, default=Path('extracted/site/models'))
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--mission-dir', type=Path, default=Path('extracted/site/modelli'))
    args = ap.parse_args()
    root, out = args.input_dir.resolve(), args.output_dir.resolve()
    mission = args.mission_dir.resolve()
    out.mkdir(parents=True, exist_ok=True)
    mission.mkdir(parents=True, exist_ok=True)
    report = []
    mission_manifest = {}
    mission_map = {'typhoon': ('F2000', 15.96), 'f15e': ('F15', 19.43), 'su57': ('SU57', 20.1)}
    exporter = Path(__file__).with_name('export_blend.py').resolve()
    for code, archive, label, url in MODELS:
        zip_path = next((p for p in [root / 'model-sources' / archive, root / archive] if p.is_file()), None)
        state = 'source-missing' if zip_path is None else 'ready-for-conversion'
        if zip_path and not args.dry_run:
            with tempfile.TemporaryDirectory(prefix='centurion_model_') as d:
                stage = Path(d)
                unpack_safe(zip_path, stage)
                sources = list(stage.rglob('*.blend'))
                if len(sources) != 1:
                    raise RuntimeError(f'{archive}: expected one blend file, got {len(sources)}')
                target = out / (code + '.glb')
                subprocess.run(['blender', '-b', '--python-exit-code', '7', '--python', str(exporter), '--', str(sources[0]), str(target), str(stage / 'textures')], check=True)
                if not target.is_file() or target.stat().st_size < 10000:
                    raise RuntimeError(f'{archive}: Blender did not create a valid GLB: {target}')
                with target.open('rb') as fp:
                    if fp.read(4) != b'glTF':
                        raise RuntimeError(f'{archive}: invalid GLB signature')
                state = 'ready'
                if code in mission_map:
                    shutil.copyfile(target, mission / target.name)
                    sim_type, length_m = mission_map[code]
                    mission_manifest[sim_type] = {
                        'file': target.name, 'rot': [0, 0, 0], 'lunghezza_m': length_m,
                        'autore': 'bohmerang', 'licenza': 'CC BY-NC-SA 4.0', 'url': url,
                        'tint': False
                    }
        report.append({'id':code, 'name':label, 'glb':'models/' + code + '.glb' if state=='ready' else None,
                       'source':url, 'author':'bohmerang', 'license':'CC BY-NC-SA 4.0',
                       'status':state, 'attribution':'Model by bohmerang on Sketchfab; converted for CENTURION2.'})
    # Prefer an uploaded user GLB over an archived / converted SU-57.
    # These files are prepared with gear retracted; no geometry is replaced.
    user_su57 = root / 'model-sources' / 'su57.glb'
    if user_su57.is_file():
        if not args.dry_run:
            if user_su57.read_bytes()[:4] != b'glTF':
                raise RuntimeError('Uploaded Su-57 is not a GLB')
            shutil.copyfile(user_su57, out / 'su57.glb')
            shutil.copyfile(user_su57, mission / 'su57.glb')
            mission_manifest['SU57'] = {'file':'su57.glb','rot':[0,0,0],
                'lunghezza_m':20.1,'tint':False,'gear':'up',
                'autore':'user supplied','licenza':'verify upload rights','url':''}
        rec=next(x for x in report if x['id']=='su57')
        rec.update({'status':'ready' if not args.dry_run else 'ready-for-conversion',
                    'glb':'models/su57.glb' if not args.dry_run else None,
                    'source':'user supplied GLB, gear-up','author':'user supplied',
                    'attribution':'User supplied Su-57 geometry with landing gear removed.'})
    # Su-35: published by cutechicken in 3D-Airforce-Simulator (CC BY-NC 4.0).
    # This source is downloaded at a pinned revision by the Pages workflow,
    # validated as GLB and included as a local asset.
    su35_src = root / 'model-sources' / 'su35.glb'
    su35_url = 'https://huggingface.co/spaces/cutechicken/3D-Airforce-Simulator/blob/52946cce65ee642917704c8c4b266a5ee1c04b74/models/su-35.glb'
    su35_state = 'source-missing'
    if su35_src.is_file():
        su35_state = 'ready-for-conversion' if args.dry_run else 'ready'
        if not args.dry_run:
            with su35_src.open('rb') as fh:
                if fh.read(4) != b'glTF':
                    raise RuntimeError('Su-35 source is not a GLB')
            target = out / 'su35.glb'
            shutil.copyfile(su35_src, target)
            shutil.copyfile(target, mission / target.name)
            mission_manifest['SU35'] = {
                'file': target.name, 'rot': [0, 0, 0], 'lunghezza_m': 21.9,
                'autore': 'cutechicken', 'licenza': 'CC BY-NC 4.0',
                'url': su35_url, 'tint': False
            }
    report.append({
        'id': 'su35', 'name': 'Sukhoi Su-35S Flanker-E',
        'glb': 'models/su35.glb' if su35_state == 'ready' else None,
        'source': su35_url, 'author': 'cutechicken', 'license': 'CC BY-NC 4.0',
        'status': su35_state,
        'attribution': 'Model from cutechicken/3D-Airforce-Simulator on Hugging Face; integrated for CENTURION2.'
    })
    # User-provided EA-18G Growler, gear-up variant prepared from CC BY 4.0 GLB.
    growler_src = root / 'model-sources' / 'ea18.glb'
    growler_url = 'https://sketchfab.com/3d-models/mcdonnell-douglas-fa-18eboeing-ea-18g-growler-d69153c8e91744cab2bad239a2cb5d98'
    growler_state = 'source-missing'
    if growler_src.is_file():
        growler_state = 'ready-for-conversion' if args.dry_run else 'ready'
        if not args.dry_run:
            with growler_src.open('rb') as fh:
                if fh.read(4) != b'glTF':
                    raise RuntimeError('EA-18G Growler source is not a GLB')
            target = out / 'ea18.glb'
            shutil.copyfile(growler_src, target)
            shutil.copyfile(target, mission / target.name)
            mission_manifest['EA18'] = {
                'file': target.name, 'rot': [0, 0, 0], 'lunghezza_m': 18.31,
                'autore': 'Rhine_Lab_Muelsyse', 'licenza': 'CC BY 4.0',
                'url': growler_url, 'tint': False, 'gear': 'up'
            }
    report.append({
        'id': 'ea18', 'name': 'Boeing EA-18G Growler',
        'glb': 'models/ea18.glb' if growler_state == 'ready' else None,
        'source': growler_url, 'author': 'Rhine_Lab_Muelsyse',
        'license': 'CC BY 4.0', 'status': growler_state,
        'attribution': 'Model by Rhine_Lab_Muelsyse on Sketchfab (CC BY 4.0).'
    })
    # F-22 from the user-provided ZIP. The local GLB has the extended landing
    # gear geometry removed, with all embedded original textures retained.
    f22_src = root / 'model-sources' / 'f22.glb'
    f22_state = 'source-missing'
    if f22_src.is_file():
        f22_state = 'ready-for-conversion' if args.dry_run else 'ready'
        if not args.dry_run:
            if f22_src.stat().st_size < 1_000_000:
                raise RuntimeError('F-22 GLB too small')
            with f22_src.open('rb') as fh:
                if fh.read(4) != b'glTF':
                    raise RuntimeError('F-22 source is not a GLB')
            target = out / 'f22.glb'
            shutil.copyfile(f22_src, target)
            shutil.copyfile(target, mission / target.name)
            mission_manifest['F22'] = {
                'file': target.name, 'rot': [0, 180, 0],
                'lunghezza_m': 18.9, 'tint': False, 'gear': 'up',
                'autore': 'user-provided model', 'licenza': 'not specified',
                'url': ''
            }
    report.append({
        'id': 'f22', 'name': 'F-22 Raptor (user-supplied)',
        'glb': 'models/f22.glb' if f22_state == 'ready' else None,
        'source': 'user upload: f22-raptor (1).zip',
        'author': 'not specified', 'license': 'not specified',
        'status': f22_state,
        'attribution': 'Original source supplied by user. Redistribution rights not documented.'
    })
    # Original procedural F-16C, separate from the Sketchfab embed.
    # Keep it in both the hangar (models/) and the flying simulation (modelli/).
    f16_target = out / 'f16.glb'
    if not args.dry_run:
        subprocess.run(['blender', '-b', '--python-exit-code', '7', '--python',
                        str(Path(__file__).with_name('generate_f16.py')), '--',
                        str(f16_target)], check=True)
        with f16_target.open('rb') as fp:
            if fp.read(4) != b'glTF' or f16_target.stat().st_size < 10000:
                raise RuntimeError('F-16 generation produced invalid or undersized GLB')
        shutil.copyfile(f16_target, mission / 'f16.glb')
        mission_manifest['F16'] = {
            'file': 'f16.glb', 'rot': [0, 0, 0],
            'lunghezza_m': 15.0, 'tint': False, 'gear': 'up',
            'autore': 'CENTURION2 procedural', 'licenza': 'original approximation',
            'url': ''
        }
    report.append({
        'id': 'f16', 'name': 'F-16C Fighting Falcon',
        'glb': 'models/f16.glb' if not args.dry_run else None,
        'source': 'original CENTURION2 procedural model; not the Sketchfab source',
        'author': 'CENTURION2 procedural', 'license': 'original approximation',
        'status': 'ready' if not args.dry_run else 'ready-for-conversion',
        'attribution': 'Original simplified F-16C reconstruction, not the linked Sketchfab mesh.'
    })
    # Any additional, user supplied model source is automatically published.
    # Uploaded GLBs are not fetched from the local computer by GitHub Actions.
    extras = [
        ('su35','SU35','Sukhoi Su-35S Flanker-E',21.9,[0,0,0]),
        ('ea18','EA18','Boeing EA-18G Growler',18.31,[0,0,0]),
        ('f22','F22','F-22 Raptor',18.9,[0,180,0]),
    ]
    for code,mission_type,label,length,rotation in extras:
        src = root / 'model-sources' / (code+'.glb')
        if not src.is_file():
            continue
        if not args.dry_run:
            if src.stat().st_size < 10000 or src.read_bytes()[:4] != b'glTF':
                raise RuntimeError('Invalid uploaded GLB: '+str(src))
            shutil.copyfile(src, out/(code+'.glb'))
            shutil.copyfile(src, mission/(code+'.glb'))
            mission_manifest[mission_type] = {
                'file':code+'.glb','rot':rotation,'lunghezza_m':length,
                'tint':False,'gear':'up','autore':'user supplied',
                'licenza':'verify upload rights','url':''
            }
        rec=next(x for x in report if x['id']==code)
        rec.update({'name':label,'glb':'models/'+code+'.glb' if not args.dry_run else None,
                    'source':'user supplied GLB (gear-up)','author':'user supplied',
                    'license':'verify upload rights',
                    'status':'ready' if not args.dry_run else 'ready-for-conversion',
                    'attribution':'User supplied mesh, prepared for in-flight rendering.'})
    (out / 'manifest.json').write_text(json.dumps({'models': report, 'notice': 'Third-party aircraft models: bohmerang / Sketchfab (CC BY-NC-SA 4.0) and cutechicken / Hugging Face (CC BY-NC 4.0). Attribution and noncommercial conditions apply.'}, indent=2), encoding='utf-8')
    (mission / 'manifest.json').write_text(json.dumps(mission_manifest, indent=2), encoding='utf-8')
    print(json.dumps({'hangar':report, 'mission':mission_manifest}, indent=2))


if __name__ == '__main__':
    main()