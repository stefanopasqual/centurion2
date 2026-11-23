"""Create a compact, static hangar copy of the supplied rigged pilot.

The missions retain the full rig. In the hangar the pilot is stationary, so
the rest-pose geometry can be displayed without GPU skinning or joint buffers.
"""
import copy
import json
import struct


def make_hangar_glb(data):
    magic, version, total, json_size, json_kind = struct.unpack_from('<4sIIII', data)
    if magic != b'glTF' or version != 2 or total != len(data) or json_kind != 0x4e4f534a:
        raise ValueError('Invalid source GLB')
    doc = json.loads(data[20:20 + json_size])
    pos = 20 + json_size
    bin_size, bin_kind = struct.unpack_from('<II', data, pos)
    if bin_kind != 0x004e4942 or pos + 8 + bin_size != len(data):
        raise ValueError('Missing or incomplete binary chunk')
    if len(doc.get('buffers', [])) != 1 or doc.get('images') or doc.get('extensionsUsed'):
        raise ValueError('Unexpected resources in pilot model')
    binary = memoryview(data)[pos + 8:]
    original_accessors = doc['accessors']
    original_views = doc['bufferViews']
    accessors, views, payload = [], [], bytearray()
    acc_map, view_map = {}, {}

    def convert_accessor(index):
        if index in acc_map:
            return acc_map[index]
        item = copy.deepcopy(original_accessors[index])
        if 'sparse' in item or 'bufferView' not in item:
            raise ValueError('Unexpected sparse or unbacked geometry')
        old_view = item['bufferView']
        if old_view not in view_map:
            view = copy.deepcopy(original_views[old_view])
            if view.get('buffer', 0) != 0 or view.get('extensions'):
                raise ValueError('Unexpected geometry resource')
            offset, length = view.get('byteOffset', 0), view['byteLength']
            if offset < 0 or offset + length > len(binary):
                raise ValueError('Geometry lies outside the binary chunk')
            while len(payload) % 4:
                payload.append(0)
            view['byteOffset'] = len(payload)
            payload.extend(binary[offset:offset + length])
            view_map[old_view] = len(views)
            views.append(view)
        item['bufferView'] = view_map[old_view]
        acc_map[index] = len(accessors)
        accessors.append(item)
        return acc_map[index]

    for mesh in doc.get('meshes', []):
        if mesh.get('weights'):
            raise ValueError('Unexpected morph weights')
        for primitive in mesh['primitives']:
            if primitive.get('targets') or primitive.get('extensions'):
                raise ValueError('Unexpected morph target or extension')
            attrs = primitive['attributes']
            attrs.pop('JOINTS_0', None)
            attrs.pop('WEIGHTS_0', None)
            for name, index in list(attrs.items()):
                attrs[name] = convert_accessor(index)
            if 'indices' in primitive:
                primitive['indices'] = convert_accessor(primitive['indices'])
    for node in doc.get('nodes', []):
        node.pop('skin', None)
    doc.pop('skins', None)
    doc.pop('animations', None)
    doc['accessors'], doc['bufferViews'] = accessors, views
    while len(payload) % 4:
        payload.append(0)
    doc['buffers'] = [{'byteLength': len(payload)}]
    text = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    text += b' ' * (-len(text) % 4)
    total_size = 12 + 8 + len(text) + 8 + len(payload)
    return (struct.pack('<4sII', b'glTF', 2, total_size)
            + struct.pack('<II', len(text), 0x4e4f534a) + text
            + struct.pack('<II', len(payload), 0x004e4942) + payload)
