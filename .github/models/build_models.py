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
from publish_hangar_assets import add_hangar_models

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
                if code == 'typhoon':
                    # texture originale con insegne tedesche, croci e codice 30+47 cancellati: resta la mimetica
                    clean = Path(__file__).with_name('typhoon_basecolor_senza_insegne.png')
                    found = list(stage.rglob('basecolor.png'))
                    if not clean.is_file() or len(found) != 1:
                        raise RuntimeError('typhoon: texture senza insegne o basecolor.png mancante')
                    shutil.copyfile(clean, found[0])
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
                        'file': target.name, 'rot': [0, -90, 0], 'lunghezza_m': length_m,
                        'autore': 'bohmerang', 'licenza': 'CC BY-NC-SA 4.0', 'url': url,
                        'tint': False
                    }
        report.append({'id':code, 'name':label, 'glb':'models/' + code + '.glb' if state=='ready' else None,
                       'source':url, 'author':'bohmerang', 'license':'CC BY-NC-SA 4.0',
                       'status':state, 'attribution':'Model by bohmerang on Sketchfab; converted for CENTURION2.'})
    # Prefer an uploaded user GLB over an archived / converted SU-57.
    # Sketchfab GLBs of Su-57, Su-35 and EA-18G have the nose on +X: rot Y -90 puts it on +Z.
    # These files are prepared with gear retracted; no geometry is replaced.
    user_su57 = root / 'model-sources' / 'su57.glb'
    if user_su57.is_file():
        if not args.dry_run:
            if user_su57.read_bytes()[:4] != b'glTF':
                raise RuntimeError('Uploaded Su-57 is not a GLB')
            shutil.copyfile(user_su57, out / 'su57.glb')
            shutil.copyfile(user_su57, mission / 'su57.glb')
            mission_manifest['SU57'] = {'file':'su57.glb','rot':[0,-90,0],
                'lunghezza_m':20.1,'tint':False,'gear':'up',
                'autore':'bohmerang','licenza':'CC BY-NC-SA 4.0',
                'url':'https://sketchfab.com/3d-models/sukhoi-su-57-felon-p-fighter-jet-free-31127bc63bc048debb694aa88bbaafae'}
        rec=next(x for x in report if x['id']=='su57')
        rec.update({'status':'ready' if not args.dry_run else 'ready-for-conversion',
                    'glb':'models/su57.glb' if not args.dry_run else None,
                    'source':'https://sketchfab.com/3d-models/sukhoi-su-57-felon-p-fighter-jet-free-31127bc63bc048debb694aa88bbaafae',
                    'author':'bohmerang','license':'CC BY-NC-SA 4.0',
                    'attribution':'Model by bohmerang on Sketchfab (CC BY-NC-SA 4.0), landing gear hidden.'})
    # Su-35: bohmerang on Sketchfab (CC BY-NC-SA 4.0), gear-up GLB in model-sources/.
    su35_src = root / 'model-sources' / 'su35.glb'
    su35_url = 'https://sketchfab.com/3d-models/sukhoi-su-35-fighter-jet-free-3213a404e5cb4fb68f778b9acae5109c'
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
                'file': target.name, 'rot': [0, -90, 0], 'lunghezza_m': 21.9,
                'autore': 'bohmerang', 'licenza': 'CC BY-NC-SA 4.0',
                'url': su35_url, 'tint': False
            }
    report.append({
        'id': 'su35', 'name': 'Sukhoi Su-35S Flanker-E',
        'glb': 'models/su35.glb' if su35_state == 'ready' else None,
        'source': su35_url, 'author': 'bohmerang', 'license': 'CC BY-NC-SA 4.0',
        'status': su35_state,
        'attribution': 'Model by bohmerang on Sketchfab (CC BY-NC-SA 4.0), landing gear hidden.'
    })
    # F-14 Tomcat: original CENTURION2 procedural model built from public dimensions by
    # .github/models/genera_f14.py (nose +Z, up +Y, metres, gear up, wing sweep 25 deg).
    f14_src = root / 'model-sources' / 'f14.glb'
    f14_url = ''
    f14_state = 'source-missing'
    if f14_src.is_file():
        f14_state = 'ready-for-conversion' if args.dry_run else 'ready'
        if not args.dry_run:
            with f14_src.open('rb') as fh:
                if fh.read(4) != b'glTF':
                    raise RuntimeError('F-14 source is not a GLB')
            target = out / 'f14.glb'
            shutil.copyfile(f14_src, target)
            shutil.copyfile(target, mission / target.name)
            mission_manifest['F14'] = {
                'file': target.name, 'rot': [0, 0, 0], 'lunghezza_m': 19.1,
                'autore': 'CENTURION2 procedural', 'licenza': 'original approximation',
                'url': f14_url, 'tint': False, 'gear': 'up'
            }
    report.append({
        'id': 'f14', 'name': 'Grumman F-14 Tomcat',
        'glb': 'models/f14.glb' if f14_state == 'ready' else None,
        'source': f14_url, 'author': 'CENTURION2 procedural', 'license': 'original approximation',
        'status': f14_state,
        'attribution': 'Original CENTURION2 model from public F-14 dimensions (genera_f14.py).'
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
                'file': target.name, 'rot': [0, -90, 0], 'lunghezza_m': 18.31,
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
                'autore': 'sxnneh', 'licenza': 'Sketchfab Standard',
                'url': 'https://sketchfab.com/3d-models/f22-raptor-ec44bd6cffa649b4927799a7b19c703b'
            }
    report.append({
        'id': 'f22', 'name': 'F-22 Raptor (user-supplied)',
        'glb': 'models/f22.glb' if f22_state == 'ready' else None,
        'source': 'https://sketchfab.com/3d-models/f22-raptor-ec44bd6cffa649b4927799a7b19c703b',
        'author': 'sxnneh', 'license': 'Sketchfab Standard',
        'status': f22_state,
        'attribution': 'F22 RAPTOR by sxnneh on Sketchfab (Sketchfab Standard license), landing gear hidden.'
    })
    # Detailed, gear-up F-16 by bohmerang. The source is calibrated to nose -Z,
    # up +Y; the existing mission rotation turns the nose to +Z.
    f16_source = root / 'model-sources' / 'hangar' / 'f16-rebuilt.glb'
    f16_url = 'https://sketchfab.com/3d-models/f-16-fighting-falcon-fighter-jet-free-f0b00989e5634764848ef2c235c64db5'
    f16_target = out / 'f16.glb'
    if not args.dry_run:
        if not f16_source.is_file():
            raise RuntimeError('Detailed F-16 source missing: ' + str(f16_source))
        shutil.copyfile(f16_source, f16_target)
        with f16_target.open('rb') as fp:
            if fp.read(4) != b'glTF' or f16_target.stat().st_size < 10000:
                raise RuntimeError('Detailed F-16 source is invalid or undersized')
        shutil.copyfile(f16_target, mission / 'f16.glb')
        mission_manifest['F16'] = {
            'file': 'f16.glb', 'rot': [0, 180, 0],
            'lunghezza_m': 15.0, 'tint': False, 'gear': 'up',
            'autore': 'bohmerang', 'licenza': 'CC BY-NC-SA 4.0',
            'url': f16_url
        }
    report.append({
        'id': 'f16', 'name': 'F-16C Fighting Falcon',
        'glb': 'models/f16.glb' if not args.dry_run else None,
        'source': f16_url,
        'author': 'bohmerang', 'license': 'CC BY-NC-SA 4.0',
        'status': 'ready' if not args.dry_run else 'ready-for-conversion',
        'attribution': 'Model by bohmerang; orientation adjusted and landing gear removed.'
    })
    # Geran-2 (famiglia Shahed-136): drone ostile della missione M12 Donbass e dell'hangar.
    # GLB fornito dall'utente, "Geranium-2" di Karosio su Sketchfab (CC BY-NC-SA 4.0).
    # Assi verificati sul mesh: muso verso -Z, dorso +Y -> rotazione 180 gradi su Y.
    geran_src = root / 'model-sources' / 'geran2.glb'
    geran_url = 'https://sketchfab.com/3d-models/geranium-2-8f12f601efe44a73b47e30a7077cf249'
    geran_state = 'source-missing'
    if geran_src.is_file():
        geran_state = 'ready-for-conversion' if args.dry_run else 'ready'
        if not args.dry_run:
            with geran_src.open('rb') as fh:
                if fh.read(4) != b'glTF':
                    raise RuntimeError('Geran-2 source is not a GLB')
            target = out / 'geran2.glb'
            shutil.copyfile(geran_src, target)
            shutil.copyfile(target, mission / target.name)
            mission_manifest['GERAN2'] = {
                'file': target.name, 'rot': [0, 180, 0], 'lunghezza_m': 3.5,
                'tint': False, 'autore': 'Karosio', 'licenza': 'CC BY-NC-SA 4.0',
                'url': geran_url
            }
    report.append({
        'id': 'geran2', 'name': 'Geran-2 (Shahed-136) drone',
        'glb': 'models/geran2.glb' if geran_state == 'ready' else None,
        'source': geran_url, 'author': 'Karosio', 'license': 'CC BY-NC-SA 4.0',
        'status': geran_state,
        'attribution': 'Geranium-2 by Karosio on Sketchfab (CC BY-NC-SA 4.0).'
    })
    add_hangar_models(root, out, report, args.dry_run)
    # Uploaded aircraft have already been copied and mapped above.
    # Do not overwrite calibrated rotations and real author/license metadata.
    (out / 'manifest.json').write_text(json.dumps({'models': report, 'notice': 'Third-party models: bohmerang / Sketchfab (CC BY-NC-SA 4.0), Rhine_Lab_Muelsyse / Sketchfab (CC BY 4.0), sxnneh / Sketchfab (Sketchfab Standard) and Karosio / Sketchfab (CC BY-NC-SA 4.0, Geran-2 drone). Attribution and noncommercial conditions apply.'}, indent=2), encoding='utf-8')
    (mission / 'manifest.json').write_text(json.dumps(mission_manifest, indent=2), encoding='utf-8')
    print(json.dumps({'hangar':report, 'mission':mission_manifest}, indent=2))


if __name__ == '__main__':
    main()

