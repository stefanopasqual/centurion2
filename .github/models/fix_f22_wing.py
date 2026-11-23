#!/usr/bin/env python3
"""Mirror the intact F-22 starboard wing into the port wing in the WEB GLB.

Does not alter the user-supplied source or its materials/textures.
Only six matched wing panel nodes are replaced. Fuselage, engines,
tailplanes and both vertical stabilizers remain untouched.
"""
import argparse
import json
import struct
from pathlib import Path

import numpy as np

PAIR_NAMES = (
    # Existing left node, original matching right-wing node
    ("Object_119", "Object_21"),  # inboard strip
    ("Object_120", "Object_22"),  # primary wing panel
    ("Object_121", "Object_23"),  # wingtip/light
    ("Object_94", "Object_98"),   # main outer wing skin
    ("Object_92", "Object_100"),  # outer trailing control surface
    ("Object_96", "Object_102"),  # inner trailing control surface
)


def read_glb(path):
    data = Path(path).read_bytes()
    magic, version, total = struct.unpack_from("<4sII", data)
    if (magic, version, total) != (b"glTF", 2, len(data)):
        raise ValueError("Expected a complete glTF 2.0 GLB")
    offset = 12
    chunks = []
    doc = None
    while offset < len(data):
        length, kind = struct.unpack_from("<II", data, offset)
        offset += 8
        content = data[offset:offset+length]
        offset += length
        chunks.append((kind, content))
        if kind == 0x4e4f534a:
            doc = json.loads(content)
    if doc is None:
        raise ValueError("GLB JSON missing")
    return doc, chunks


def local_matrix(node):
    if "matrix" in node:
        return np.array(node["matrix"], dtype=np.float64).reshape((4, 4), order="F")
    x, y, z, w = node.get("rotation", (0, 0, 0, 1))
    rotation = np.array([
        [1-2*(y*y+z*z), 2*(x*y-z*w),   2*(x*z+y*w)],
        [2*(x*y+z*w),   1-2*(x*x+z*z), 2*(y*z-x*w)],
        [2*(x*z-y*w),   2*(y*z+x*w),   1-2*(x*x+y*y)]
    ])
    m = np.eye(4)
    m[:3, :3] = rotation @ np.diag(node.get("scale", [1, 1, 1]))
    m[:3, 3] = node.get("translation", [0, 0, 0])
    return m


def calculate_world(nodes, scenes):
    world, parents = {}, {}
    def visit(index, parent, parent_idx):
        if index in world:
            return
        world[index] = parent @ local_matrix(nodes[index])
        parents[index] = parent_idx
        for child in nodes[index].get("children", []):
            visit(child, world[index], index)
    for scene in scenes:
        for node in scene["nodes"]:
            visit(node, np.eye(4), None)
    return world, parents


def accessor_positions(doc, chunks, index):
    acc = doc["accessors"][index]
    if acc["componentType"] != 5126 or acc["type"] != "VEC3":
        raise ValueError("Wing position attribute must be float32 VEC3")
    bv = doc["bufferViews"][acc["bufferView"]]
    binary = next(data for kind, data in chunks if kind == 0x004e4942)
    offset = bv.get("byteOffset", 0)+acc.get("byteOffset", 0)
    stride = bv.get("byteStride", 12)
    v = np.ndarray(
        (acc["count"], 3), dtype="<f4",
        buffer=binary, offset=offset, strides=(stride, 4))
    return v.astype(np.float64)


def bounds(doc, chunks, node, world_matrix):
    mesh = doc["meshes"][node["mesh"]]
    all_positions = []
    for prim in mesh["primitives"]:
        v = accessor_positions(doc, chunks, prim["attributes"]["POSITION"])
        result = v @ world_matrix[:3, :3].T + world_matrix[:3, 3]
        all_positions.append(result)
    v = np.concatenate(all_positions)
    return v.min(axis=0), v.max(axis=0), v.mean(axis=0), len(v)


def repair(source, target):
    doc, chunks = read_glb(source)
    nodes = doc["nodes"]
    world, parents = calculate_world(nodes, doc["scenes"])
    by_name = {n.get("name"): i for i, n in enumerate(nodes)}
    if len(by_name) != len(nodes):
        raise ValueError("F-22 must have unique node names")
    mirror = np.diag([-1., 1., 1., 1.])
    original = set()
    for left, right in PAIR_NAMES:
        if left not in by_name or right not in by_name:
            raise ValueError("Missing wing node pair: %s / %s" % (left, right))
        li, ri = by_name[left], by_name[right]
        if li not in world or ri not in world:
            raise ValueError("Wing is not attached to the active glTF scene")
        lnode, rnode = nodes[li], nodes[ri]
        if "skin" in lnode or "skin" in rnode:
            raise ValueError("Refusing to modify skinned aircraft mesh")
        if "mesh" not in lnode or "mesh" not in rnode:
            raise ValueError("Wing node is not a mesh")
        old_left_bounds = bounds(doc, chunks, lnode, world[li])
        src_bounds = bounds(doc, chunks, rnode, world[ri])
        if src_bounds[0][0] < .1 or old_left_bounds[1][0] > -.1:
            raise ValueError("Expected right-side X>0 and left-side X<0")
        original.add(li)
        parent = parents[li]
        parent_world = world[parent] if parent is not None else np.eye(4)
        # Reference wing geometry + exact mirror through the aircraft's X=0 plane.
        new_local = np.linalg.inv(parent_world) @ mirror @ world[ri]
        lnode["mesh"] = rnode["mesh"]
        for key in ("translation", "rotation", "scale"):
            lnode.pop(key, None)
        lnode["matrix"] = new_local.reshape(16, order="F").tolist()
        mirrored_world = parent_world @ new_local
        lo, hi, centroid, vertices = bounds(doc, chunks, lnode, mirrored_world)
        expected_lo = src_bounds[0].copy()
        expected_hi = src_bounds[1].copy()
        expected_lo[0] = -src_bounds[1][0]
        expected_hi[0] = -src_bounds[0][0]
        if (not np.allclose(lo, expected_lo, atol=1e-4) or
            not np.allclose(hi, expected_hi, atol=1e-4)):
            raise AssertionError("F-22 wing pair did not mirror accurately: "+left)
        print("F22-WING-PASS", left, "<=", right, "vertices", vertices,
              "world bounds", np.round(lo, 3).tolist(), np.round(hi, 3).tolist())

    # Ensure no other scene node, material, texture or animation is changed.
    if any(ani.get("channels", [{}])[0].get("target", {}).get("node") in original
           for ani in doc.get("animations", []) if ani.get("channels")):
        raise ValueError("Animated wing node detected; refuse nonanimated remap")
    encoded = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    encoded += b" " * (-len(encoded) % 4)
    output = []
    for kind, data in chunks:
        output.append((kind, encoded if kind == 0x4e4f534a else data))
    total = 12 + sum(8 + len(data) for _, data in output)
    content = bytearray(struct.pack("<4sII", b"glTF", 2, total))
    for kind, data in output:
        content.extend(struct.pack("<II", len(data), kind))
        content.extend(data)
    Path(target).write_bytes(content)
    print("F22-WING-SYMMETRY", len(PAIR_NAMES), "pairs, untouched source",
          "original textures", len(doc.get("textures", [])))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("target")
    args = ap.parse_args()
    repair(args.source, args.target)
