"""Blender 3.6+ background script for converting a provided .blend to glTF/GLB.
Called by: blender -b --python export_blend.py -- INPUT.blend OUTPUT.glb
Preserves source geometry/materials and reconnects externally supplied textures.
"""
import bpy
import sys
from pathlib import Path


def log(*xs):
    print('CENTURION_IMPORT:', *xs, flush=True)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:]
    if len(argv) != 3:
        raise SystemExit('Usage: export_blend.py -- INPUT.blend OUTPUT.glb TEXTURES_DIR')
    source, output, textures = map(Path, argv)
    textures = textures.resolve()
    bpy.ops.wm.open_mainfile(filepath=str(source.resolve()), load_ui=False)

    matches = {}
    for path in textures.rglob('*'):
        if path.is_file() and path.suffix.lower() in {'.png', '.jpg', '.jpeg', '.webp', '.tga', '.exr'}:
            matches[path.name.lower()] = path
    linked = 0
    for img in bpy.data.images:
        if img.source not in {'FILE', 'SEQUENCE', 'TILED'}:
            continue
        options = [Path(bpy.path.abspath(img.filepath)).name.lower(), img.name.lower()]
        options += [o.rsplit('.', 1)[0].lower() for o in options]
        selected = None
        for cand in options:
            if cand in matches:
                selected = matches[cand]
                break
            for key, val in matches.items():
                if key.startswith(cand + '.'):
                    selected = val
                    break
            if selected:
                break
        if selected is not None:
            try:
                img.filepath = str(selected)
                img.reload()
                linked += 1
            except Exception as exc:
                log('Texture warning', img.name, str(exc))

    # CENTURION2 Typhoon: remove the German Bundeswehr livery at SOURCE.
    # One "Airframe" material carries its flag/crosses and camouflage in the
    # basecolor.png texture. Detach only that channel; keep normal, roughness,
    # metallic textures, topology and transparency untouched.
    if output.name.lower() == 'typhoon.glb' and __import__('os').environ.get('CENTURION_TYPHOON_GRIGIO') == '1':
        changed = 0
        for material in bpy.data.materials:
            if material.name.lower() != 'airframe':
                continue
            material.use_nodes = True
            material.diffuse_color = (0.50, 0.56, 0.61, 1.0)
            for node in material.node_tree.nodes:
                if node.type != 'BSDF_PRINCIPLED':
                    continue
                base = node.inputs.get('Base Color')
                if base is None:
                    continue
                for link in list(base.links):
                    material.node_tree.links.remove(link)
                base.default_value = (0.50, 0.56, 0.61, 1.0)
                changed += 1
        if changed == 0:
            raise RuntimeError('Typhoon Italian conversion failed: Airframe color was not replaced')
        log('TYPHOON_ITALIAN_SKIN: basecolor.png unlinked from', changed, 'Airframe shaders; panel normals retained')

    # Keep authored mesh geometry, UVs, normals, materials and animations.
    # Reuse 3D object's scene transforms. No procedural aircraft substitutions.
    for ob in bpy.data.objects:
        if ob.type in {'MESH', 'CURVE'}:
            ob.hide_set(False)
            ob.hide_viewport = False
            ob.hide_render = False
    selectable = [ob for ob in bpy.context.scene.objects if ob.type in {'MESH', 'CURVE'}]
    if not selectable:
        raise RuntimeError('No mesh geometry in source .blend')
    log('Geometry objects', len(selectable), 'images relinked', linked)
    if output.name == 'typhoon.glb':
        for ob in selectable:
            if ob.name == 'Airframe':
                points = [ob.matrix_world @ __import__('mathutils').Vector(corner) for corner in ob.bound_box]
                log('TYPHOON_AIRFRAME_BOUNDS', [(round(min(v[i] for v in points),3),round(max(v[i] for v in points),3)) for i in range(3)])
        for ob in selectable:
            log('TYPHOON_GEO', ob.name, 'materials:', [m.name if m else 'NONE' for m in ob.data.materials])
        for material in bpy.data.materials:
            if not material.users:
                continue
            if material.use_nodes and material.node_tree:
                nodes = material.node_tree.nodes
                imgs = [(n.name, n.image.name, n.image.size[:]) for n in nodes if n.type == 'TEX_IMAGE' and n.image]
                log('TYPHOON_MAT', material.name, 'images:', imgs, 'diffuse:', list(material.diffuse_color))
        for im in bpy.data.images:
            if im.users and im.source in {'FILE','TILED'}:
                log('TYPHOON_IMAGE', im.name, list(im.size), str(im.filepath))
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output.resolve()),
        export_format='GLB',
        use_selection=False,
        export_cameras=False,
        export_lights=False,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_animations=True,
        export_yup=True,
        export_image_format='AUTO',
        export_apply=False,
    )
    if not output.is_file() or output.stat().st_size < 10000:
        raise RuntimeError('GLB file missing/too small')
    log('Exported', output, output.stat().st_size, 'bytes')


if __name__ == '__main__':
    main()