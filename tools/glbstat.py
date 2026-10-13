# Dreiecks-Statistik einer GLB je Knoten bis Tiefe N.  Aufruf: glbstat.py file.glb [tiefe]
import sys, json, struct
f = open(sys.argv[1], 'rb'); maxd = int(sys.argv[2]) if len(sys.argv) > 2 else 2
f.read(12); n, _ = struct.unpack('<I4s', f.read(8)); g = json.loads(f.read(n))
acc = g['accessors']
mt = [sum(acc[p['indices']]['count'] // 3 if 'indices' in p else acc[p['attributes']['POSITION']]['count'] // 3 for p in m['primitives']) for m in g['meshes']]
def tri(i):
    nd = g['nodes'][i]
    return (mt[nd['mesh']] if 'mesh' in nd else 0) + sum(tri(c) for c in nd.get('children', []))
def show(i, d):
    nd = g['nodes'][i]; t = tri(i)
    if d <= maxd and t: print(f"{t:9d} {'  '*d}{nd.get('name','?')[:70]}")
    for c in nd.get('children', []): show(c, d + 1)
for r in g['scenes'][0]['nodes']: show(r, 0)
print('nodes', len(g['nodes']), 'meshes', len(g['meshes']), 'materials', len(g.get('materials', [])))
print([ (m.get('name'), [round(c,2) for c in m.get('pbrMetallicRoughness',{}).get('baseColorFactor',[])]) for m in g.get('materials', [])][:40])
