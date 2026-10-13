# Minimaler GLB-Leser: liefert je Blattnetz (Name-Pfad, Weltmatrix, Positionen, Indizes, Farbe).
import json, struct, numpy as np
def load(path):
    b = open(path, 'rb').read()
    n = struct.unpack('<I', b[12:16])[0]; g = json.loads(b[20:20 + n]); bin_ = b[20 + n + 8:]
    CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
    NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
    def acc(i):
        a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); nc = NC[a['type']]; dt = np.dtype(CT[a['componentType']])
        st = bv.get('byteStride', 0)
        if st and st != dt.itemsize * nc:
            raw = np.frombuffer(bin_, np.uint8, st * (a['count'] - 1) + dt.itemsize * nc, off)
            idx = (np.arange(a['count'])[:, None] * st + np.arange(dt.itemsize * nc)[None, :]).ravel()
            arr = raw[idx].view(dt)
        else: arr = np.frombuffer(bin_, dt, a['count'] * nc, off)
        return arr.reshape(-1, nc) if nc > 1 else arr
    def mat(nd):
        if 'matrix' in nd: return np.array(nd['matrix'], float).reshape(4, 4).T
        m = np.eye(4)
        if 'scale' in nd: m = np.diag(list(nd['scale']) + [1.0])
        if 'rotation' in nd:
            x, y, z, w = nd['rotation']
            r = np.eye(4); r[:3, :3] = [[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]
            m = r @ m
        if 'translation' in nd: t = np.eye(4); t[:3, 3] = nd['translation']; m = t @ m
        return m
    out = []
    def walk(i, M, path):
        nd = g['nodes'][i]; M = M @ mat(nd); path = path + [nd.get('name', '?')]
        if 'mesh' in nd:
            for p in g['meshes'][nd['mesh']]['primitives']:
                if p.get('mode', 4) != 4: continue
                pos = acc(p['attributes']['POSITION']).astype(float)
                idx = acc(p['indices']).astype(np.int64).reshape(-1, 3) if 'indices' in p else np.arange(len(pos)).reshape(-1, 3)
                col = [1, 1, 1, 1]
                if 'material' in p: col = g['materials'][p['material']].get('pbrMetallicRoughness', {}).get('baseColorFactor', col)
                w = pos @ M[:3, :3].T + M[:3, 3]
                # zurück in CAD-Koordinaten (m): x, y = -z_gltf, z = y_gltf
                out.append({'path': path, 'pos': np.stack([w[:, 0], -w[:, 2], w[:, 1]], 1), 'idx': idx, 'col': col})
        for c in nd.get('children', []): walk(c, M, path)
    for r in g['scenes'][0]['nodes']: walk(r, np.eye(4), [])
    return out
