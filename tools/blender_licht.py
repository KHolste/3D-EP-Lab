# Laeuft in Blender (wird von tools/lichtbake.py gestartet): berechnet das Licht der Nachbarraeume mit Cycles
# und schreibt eine Lightmap samt Lightmap-Koordinaten je Objekt.
# Aufruf: blender -b --factory-startup -P tools/blender_licht.py -- export.json ausgabeordner [groesse] [samples]
#
# Eingabe (aus dem Spiel, ?bakeexport=1): je Objekt Dreiecke in Weltkoordinaten (Punkte in Spielreihenfolge), Materialfarben,
# Lampenpositionen. Grosse Flaechen (Waende, Boeden, Decken, grosse Moebel) bekommen eine Lightmap, kleine Teile das Licht
# an ihren Eckpunkten (sonst zerfiele die Lightmap in zehntausende winzige Inseln).
# Ausgabe: lightmap.npy (Licht ohne Materialfarbe, float RGB), uv.bin (Float32, 2 Werte pro Punkt), ecken.bin (Float32, RGB pro Punkt),
# index.json (Name, Art lm/ecken, Punktzahl, Versatz) - Punkte jeweils in derselben Reihenfolge wie im Spiel.
import bpy, bmesh, sys, json, base64, math, os
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]
SIZE = int(argv[2]) if len(argv) > 2 else 2048
SAMPLES = int(argv[3]) if len(argv) > 3 else 128
LAMPE_W = 60.0                    # Leistung je Deckenleuchte (Flaechenlicht, Watt in Blender-Einheiten)
os.makedirs(OUT, exist_ok=True)
d = json.load(open(SRC, encoding='utf-8'))

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = SAMPLES
sc.cycles.max_bounces = 4; sc.cycles.diffuse_bounces = 3; sc.cycles.glossy_bounces = 1
w = bpy.data.worlds.new('Welt'); sc.world = w
try: w.use_nodes = True
except Exception: pass
for n in w.node_tree.nodes:
    if n.type == 'BACKGROUND': n.inputs[1].default_value = 0.0        # Innenraeume: kein Himmelslicht

# Materialien: nur Farbe zaehlt fuer das zurueckgeworfene Licht; Metalle als matte Flaechen (sonst kein Diffuslicht in der Lightmap)
mats = []
for i, m in enumerate(d['mats']):
    mt = bpy.data.materials.new(f'm{i}')
    try: mt.use_nodes = True
    except Exception: pass
    nt = mt.node_tree; p = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*m['farbe'], 1)
    p.inputs['Metallic'].default_value = 0.0
    p.inputs['Roughness'].default_value = max(0.5, m['rau'])
    if m['lampe']:
        p.inputs['Emission Color'].default_value = (1, 1, 1, 1); p.inputs['Emission Strength'].default_value = 4.0
    mats.append(mt)

img = bpy.data.images.new('Lightmap', SIZE, SIZE, alpha=False, float_buffer=True)
for mt in mats:                    # aktiver Bildknoten = Ziel der Berechnung
    t = mt.node_tree.nodes.new('ShaderNodeTexImage'); t.image = img; mt.node_tree.nodes.active = t

# Objekte: Dreiecke wie im Spiel, Flaechen-Nummer merken, gleiche Punkte verschmelzen (damit zusammenhaengende Inseln entstehen)
objs, lampen_objs = [], []
for o in d['objekte']:
    pos = np.frombuffer(base64.b64decode(o['pos']), dtype=np.float32).reshape(-1, 3)
    nrm = np.frombuffer(base64.b64decode(o['nrm']), dtype=np.float32).reshape(-1, 3, 3).sum(1)
    t = pos.reshape(-1, 3, 3); geo_n = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
    dreh = (geo_n*nrm).sum(1) < 0                                    # Dreieck zeigt gegen seine Normale (beidseitige Flaechen): umdrehen
    bm = bmesh.new(); lay = bm.faces.layers.int.new('jgf'); lay_k = bm.faces.layers.int.new('jgk')
    vs = [bm.verts.new((float(x), float(-z), float(y))) for x, y, z in pos]     # Spiel (y oben) -> Blender (z oben)
    for f in range(len(pos)//3):
        try:
            fa = bm.faces.new((vs[3*f], vs[3*f + 2], vs[3*f + 1]) if dreh[f] else (vs[3*f], vs[3*f + 1], vs[3*f + 2])); fa[lay] = f; fa[lay_k] = int(dreh[f])
        except ValueError: pass                                      # doppelte Flaeche
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    for e in bm.edges: e.smooth = not (len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(35))
    for f in bm.faces: f.smooth = True
    me = bpy.data.meshes.new(o['name']); bm.to_mesh(me); bm.free()
    me.materials.append(mats[o['mat']])
    ob = bpy.data.objects.new(o['name'], me); sc.collection.objects.link(ob)
    ob['punkte'] = len(pos)
    flaeche = 0.5*np.linalg.norm(geo_n, axis=1)
    ob['art'] = 'lm' if flaeche.sum() > 3 and flaeche.mean() > 0.2 else 'ecken'      # Waende, Boeden, Decken: Lightmap; Moebel und Kleinteile: Eckpunkte
    (lampen_objs if d['mats'][o['mat']]['lampe'] else objs).append(ob)

for a in d['anker']:               # Flaechenlichter unter den Leuchten, nach unten gerichtet
    L = bpy.data.lights.new('Lampe', 'AREA'); L.size = 0.6; L.energy = LAMPE_W; L.color = (1.0, 0.97, 0.92)
    lo = bpy.data.objects.new('Lampe', L); lo.location = (a['x'], -a['z'], a['y'] + 0.1); sc.collection.objects.link(lo)

lm_objs = [ob for ob in objs if ob['art'] == 'lm']; ecken_objs = [ob for ob in objs if ob['art'] == 'ecken']
print('Lightmap:', len(lm_objs), 'Objekte, Eckpunkte:', len(ecken_objs), 'Objekte', flush=True)
# Lightmap-Koordinaten: alle grossen Objekte gemeinsam aufklappen, gleiche Dichte, in ein Bild packen
for ob in lm_objs: ob.data.uv_layers.new(name='lm'); ob.data.uv_layers.active = ob.data.uv_layers['lm']
bpy.ops.object.select_all(action='DESELECT')
for ob in lm_objs: ob.select_set(True)
bpy.context.view_layer.objects.active = lm_objs[0]
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
bpy.ops.uv.select_all(action='SELECT')
bpy.ops.uv.average_islands_scale()
bpy.ops.uv.pack_islands(rotate=True, margin=4.0/SIZE)
bpy.ops.object.mode_set(mode='OBJECT')
print('UV fertig', flush=True)

sc.render.bake.margin = 4
sc.render.bake.use_clear = True
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=4, use_clear=True, target='IMAGE_TEXTURES')
print('Lightmap berechnet', flush=True)
# kleine Teile: Licht je Eckpunkt (Farbattribut je Flaechenecke)
bpy.ops.object.select_all(action='DESELECT')
for ob in ecken_objs:
    ca = ob.data.color_attributes.new('jgv', 'FLOAT_COLOR', 'CORNER'); ob.data.color_attributes.active_color = ca; ob.select_set(True)
if ecken_objs:
    bpy.context.view_layer.objects.active = ecken_objs[0]
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, use_clear=True, target='VERTEX_COLORS')
print('Eckpunkte berechnet', flush=True)
px = np.empty(SIZE*SIZE*4, dtype=np.float32); img.pixels.foreach_get(px)
np.save(os.path.join(OUT, 'lightmap.npy'), px.reshape(SIZE, SIZE, 4)[..., :3])

# Ergebnisse in Spielreihenfolge zurueckschreiben (Flaechen-Nummer f, Ecke c -> Punkt 3f + c)
def je_punkt(me, n, werte, k):
    out = np.zeros((n, k), dtype=np.float32)
    fl = np.empty(len(me.polygons), dtype=np.int32); me.attributes['jgf'].data.foreach_get('value', fl)
    fk = np.empty(len(me.polygons), dtype=np.int32); me.attributes['jgk'].data.foreach_get('value', fk)
    for p, f, k in zip(me.polygons, fl, fk):
        for c, li in enumerate(p.loop_indices): out[3*f + ((0, 2, 1)[c] if k else c)] = werte[li]
    return out.ravel()
uvs, ecken, index, off_uv, off_e = [], [], [], 0, 0
for ob in lm_objs:
    me = ob.data; n = ob['punkte']; luv = np.empty(len(me.loops)*2, dtype=np.float32); me.uv_layers['lm'].data.foreach_get('uv', luv)
    uvs.append(je_punkt(me, n, luv.reshape(-1, 2), 2)); index.append({'name': ob.name, 'art': 'lm', 'punkte': n, 'versatz': off_uv}); off_uv += n*2
for ob in ecken_objs:
    me = ob.data; n = ob['punkte']; col = np.empty(len(me.loops)*4, dtype=np.float32); me.color_attributes['jgv'].data.foreach_get('color', col)
    ecken.append(je_punkt(me, n, col.reshape(-1, 4)[:, :3], 3)); index.append({'name': ob.name, 'art': 'ecken', 'punkte': n, 'versatz': off_e}); off_e += n*3
np.concatenate(uvs).astype(np.float32).tofile(os.path.join(OUT, 'uv.bin'))
(np.concatenate(ecken) if ecken else np.zeros(0)).astype(np.float32).tofile(os.path.join(OUT, 'ecken.bin'))
json.dump({'objekte': index, 'groesse': SIZE}, open(os.path.join(OUT, 'index.json'), 'w'))
print('fertig', len(objs), 'Objekte', flush=True)
