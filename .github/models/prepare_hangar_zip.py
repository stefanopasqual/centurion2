#!/usr/bin/env python3
"""Prepare a mobile-site ZIP with extra hangar GLBs; never deploy or overwrite the input."""
import argparse
import tempfile
import zipfile
from pathlib import Path

from publish_hangar_aircraft import publish_hangar


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path('.'))
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    original = root / 'CENTURION2_GITHUB_MOBILE.zip'
    target = args.output.resolve()
    if target == original.resolve() or target.exists():
        raise ValueError('Choose a new output path; this script does not overwrite files.')
    with tempfile.TemporaryDirectory(prefix='centurion-hangar-') as temp:
        assets = Path(temp) / 'models'
        publish_hangar(root, assets)
        with zipfile.ZipFile(original) as source, zipfile.ZipFile(target, 'x') as dest:
            names = set(source.namelist())
            additions = [(f'site/models/{p.name}', p) for p in sorted(assets.glob('*.glb'))]
            if any(name in names for name, _ in additions):
                raise ValueError('A hangar model already exists in the site ZIP; review before replacing it.')
            for item in source.infolist():
                dest.writestr(item, source.read(item.filename))
            for name, file in additions:
                dest.write(file, name, compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)
    print(f'Prepared {target} with {len(additions)} new hangar GLBs. No deployment was performed.')


if __name__ == '__main__':
    main()
