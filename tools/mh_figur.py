# Läuft in Blender mit dem Zusatz MPFB (MakeHuman): baut eine Figur nach einer Beschreibung (JSON) und exportiert sie als GLB.
# Aufruf (über tools/figuren.py): blender -b --factory-startup -P tools/mh_figur.py -- beschreibung.json ziel.glb
# Beschreibung: {"makro": {...}, "haut": "skins/...mhmat", "assets": [["hair/short02/short02.mhclo", "Hair"], ...], "haarfarbe": [r, g, b]}
# Pfade relativ zum MPFB-Datenordner. Rig: "game_engine" (wenige Knochen, für three.js geeignet).
import bpy, sys, json, os
args = sys.argv[sys.argv.index('--') + 1:]
B = json.load(open(args[0], encoding='utf-8')); ZIEL = args[1]
import addon_utils
addon_utils.enable('bl_ext.blender_org.mpfb', default_set=True)
from bl_ext.blender_org.mpfb.services.humanservice import HumanService
from bl_ext.blender_org.mpfb.services.locationservice import LocationService
from bl_ext.blender_org.mpfb.services.targetservice import TargetService
D = LocationService.get_user_data()

for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bm = HumanService.create_human(macro_detail_dict=B['makro'], scale=0.1)
TD = os.path.join(os.path.dirname(LocationService.get_mpfb_data()), 'data', 'targets') if not os.path.isdir(os.path.join(LocationService.get_mpfb_data(), 'targets')) else os.path.join(LocationService.get_mpfb_data(), 'targets')
for name, wert in B.get('ziele', {}).items():                       # einzelne Formziele (z. B. 'stomach/stomach-pregnant-incr': 0.4)
    try: TargetService.load_target(bm, os.path.join(TD, name + '.target.gz'), weight=wert); print('ZIEL ok', name, wert)
    except Exception as e: print('ZIEL', name, e)
HumanService.add_builtin_rig(bm, B.get('rig', 'game_engine'))
HumanService.set_character_skin(os.path.join(D, B['haut']), bm, skin_type='MAKESKIN')
for pfad, typ in B['assets']:
    HumanService.add_mhclo_asset(os.path.join(D, pfad), bm, asset_type=typ, subdiv_levels=0, material_type='MAKESKIN')
try: HumanService.refit(bm); print('REFIT ok')                     # Kleidung und Haare an die veränderte Form anpassen
except Exception as e: print('REFIT', e)
print('ASSETS fertig', flush=True)

# Formziele fest einrechnen, Hilfsgeometrie entfernen (Maske), Modifikatoren außer Armature anwenden
TargetService.bake_targets(bm)
for ob in [o for o in bpy.data.objects if o.type == 'MESH']:
    bpy.context.view_layer.objects.active = ob
    for mod in list(ob.modifiers):
        if mod.type in ('MASK', 'SUBSURF'):
            try: bpy.ops.object.modifier_apply(modifier=mod.name)
            except Exception as e: print('MOD', ob.name, mod.name, e)
# Haarfarbe (MakeSkin-Material: Grundfarbe multiplizieren)
if 'haarfarbe' in B:
    for ob in bpy.data.objects:
        if ob.type == 'MESH' and 'hair' in ob.name.lower():
            for m in ob.data.materials:
                if m and m.node_tree:
                    for n in m.node_tree.nodes:
                        if n.type == 'BSDF_PRINCIPLED':
                            src = n.inputs['Base Color']
                            if not src.is_linked: src.default_value = (*B['haarfarbe'], 1)
                            else:
                                # Helligkeit der Haartextur (Strähnen) behalten, Farbe ersetzen: auch helle Farben auf dunklen Texturen
                                bw = m.node_tree.nodes.new('ShaderNodeRGBToBW'); mul = m.node_tree.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'
                                mul.inputs['Factor'].default_value = 1.0; l = src.links[0]; m.node_tree.links.new(l.from_socket, bw.inputs[0])
                                hell = bpy.data.images[l.from_node.image.name] if getattr(l.from_node, 'image', None) else None
                                import numpy as _np
                                mittel = 0.35
                                if hell:
                                    _px = _np.empty(hell.size[0]*hell.size[1]*4, _np.float32); hell.pixels.foreach_get(_px); _px = _px.reshape(-1, 4)
                                    _a = _px[:, 3] > 0.5; mittel = float((_px[_a, :3].mean(1)).mean()) if _a.any() else 0.35
                                k = min(4.0, 1.0/max(mittel, 0.05))
                                gamma = m.node_tree.nodes.new('ShaderNodeMath'); gamma.operation = 'MULTIPLY'; gamma.inputs[1].default_value = k
                                m.node_tree.links.new(bw.outputs[0], gamma.inputs[0])
                                m.node_tree.links.new(gamma.outputs[0], mul.inputs[6]); mul.inputs[7].default_value = (*B['haarfarbe'], 1)
                                m.node_tree.links.new(mul.outputs[2], src)
if 'augen' in B:                                                     # Augenfarbe: Bild des Augenmaterials austauschen
    for img in bpy.data.images:
        if img.name.endswith('_eye') or '_eye.' in img.name:
            img.filepath = os.path.join(D, 'eyes', 'materials', B['augen'] + '_eye.png'); img.reload(); print('AUGEN', img.name)
# ---------- Zusatzteile am Kopf (Irokese, Bart um den Mund, Schutzbrille), am Knochen 'head' befestigt ----------
import bmesh, math, random
from mathutils import Vector
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
def kopfmasse():
    me = bm.data; M = bm.matrix_world; gi = bm.vertex_groups.get('head')
    pts = [M @ v.co for v in me.vertices if gi and any(g.group == gi.index and g.weight > 0.5 for g in v.groups)]
    xs, ys, zs = [p.x for p in pts], [p.y for p in pts], [p.z for p in pts]
    return Vector((sum(xs)/len(xs), min(ys), max(zs))), (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs)), pts
def an_kopf(ob):
    ob.parent = rig; ob.parent_type = 'BONE'; ob.parent_bone = 'head'
    pb = rig.pose.bones['head']; mw = rig.matrix_world @ pb.matrix @ __import__('mathutils').Matrix.Translation((0, pb.length, 0))
    ob.matrix_parent_inverse = mw.inverted()
def material(name, farbe, rau=0.6, metall=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*farbe, 1); p.inputs['Roughness'].default_value = rau; p.inputs['Metallic'].default_value = metall
    m.use_backface_culling = False; return m                       # beidseitig (Haare, Bart)
def objekt(name, bmo, mat):
    me = bpy.data.meshes.new(name); bmo.to_mesh(me); bmo.free(); me.materials.append(mat)
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); an_kopf(ob); return ob
Z = B.get('zusatz', {})
if Z:
    mitte, (x0, x1), (y0, y1), (z0, z1), pts = kopfmasse(); random.seed(5)
    vorn = y0                                                    # Gesicht zeigt nach -y (Blender)
    def oberflaeche(x, z, aussen=0.004):                        # Punkt auf der Kopfoberfläche oben (größtes y-Profil ignorieren: nächstgelegener Scheitelpunkt)
        cand = [p for p in pts if abs(p.x - x) < 0.012 and abs(p.z - z) < 0.025]
        return max(cand, key=lambda p: p.z) if cand else Vector((x, mitte.y, z))
    if 'irokese' in Z:                                           # Kamm aus vielen schmalen Strähnen vom Haaransatz bis zum Hinterkopf
        b = bmesh.new()
        ys = [p.y for p in pts if abs(p.x - mitte.x) < 0.015 and p.z > z1 - 0.05]
        ya, yb = min(ys) + 0.02, max(ys) - 0.01
        for i in range(130):
            t = (i % 65)/64; y = ya + (yb - ya)*t
            top = max((p for p in pts if abs(p.x - mitte.x) < 0.02 and abs(p.y - y) < 0.012), key=lambda p: p.z, default=Vector((mitte.x, y, z1)))
            h = (0.07 + 0.035*math.sin(t*math.pi))*(0.8 + 0.35*random.random()); dx = random.uniform(-0.012, 0.012)
            base = top + Vector((dx, 0, -0.004)); tip = base + Vector((random.uniform(-0.006, 0.006), 0.012 + 0.03*t, h))
            w = 0.009
            v = [b.verts.new(base + Vector((-w, -0.004, 0))), b.verts.new(base + Vector((w, -0.004, 0))), b.verts.new(base + Vector((w, 0.004, 0))), b.verts.new(base + Vector((-w, 0.004, 0))), b.verts.new(tip)]
            for f in [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (3, 2, 1, 0)]: b.faces.new([v[k] for k in f])
        objekt('irokese', b, material('irokese', Z['irokese'], 0.55))
        b = bmesh.new(); me = bm.data; Mw = bm.matrix_world; vmap = {}; stirn = z1 - 0.06
        for p in me.polygons:                                     # Kopfhaut über den Ohren und hinten, nicht das Gesicht
            c = Mw @ p.center
            if c.z < stirn - 0.03 or not any(gg.group == bm.vertex_groups['head'].index for gg in me.vertices[p.vertices[0]].groups): continue
            if c.y < vorn + 0.05 and c.z < stirn + 0.02: continue
            vs = []
            for k in p.vertices:
                if k not in vmap: vmap[k] = b.verts.new(Mw @ me.vertices[k].co + (Mw.to_3x3() @ me.vertices[k].normal).normalized()*0.0012)
                vs.append(vmap[k])
            try: b.faces.new(vs)
            except ValueError: pass
        objekt('stoppeln', b, material('stoppeln', (0.13, 0.11, 0.1), 0.95))
    if 'bart' in Z:                                              # Oberlippenbart und Kinnbart als dünne Schale über der Haut
        b = bmesh.new(); mund_z = None
        gesicht = [p for p in pts if p.y < vorn + 0.035]
        nasenspitze = min(gesicht, key=lambda p: p.y)
        kinn = min((p for p in pts if abs(p.x - mitte.x) < 0.01 and p.y < vorn + 0.05), key=lambda p: p.z)
        mz = nasenspitze.z - 0.045                               # Mundhöhe
        breit = 0.09 if Z.get('bartform') == 'vollbart' else 0.04
        form = Z.get('bartform', 'kinnbart')
        def drin(p):
            dx = abs(p.x - mitte.x); oben = p.z > mz + 0.004
            if form == 'schnurrbart':                                   # markanter Schnurrbart: volle Oberlippe, Enden breit bis zum Kinn herunter (Hufeisen)
                return (oben and dx < 0.036 and p.z < mz + 0.02) or (0.021 < dx < 0.04 and p.z > mz - 0.038)
            if form == 'vollbart':                                       # kurzer Vollbart: Oberlippe, Kinn, Wangen bis zum Ohr
                return p.z < mz + 0.02 and (p.z < nasenspitze.z - 0.02 or dx > 0.05 or (oben and dx < 0.032))
            if oben: return dx < 0.03 and p.z < mz + 0.02                                  # Oberlippe
            if p.z < kinn.z + 0.035: return dx < 0.028                                       # Kinn
            return 0.017 < dx < 0.035 or dx < 0.012 and p.z < mz - 0.012                     # Mundwinkel herunter, Mitte unter der Unterlippe frei
        # Bart in die Hauttextur malen: Bartflächen im UV-Raum als Maske, weiche Ränder, Haarstruktur, Bartschatten
        sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '_mh', 'pylib'))   # Pillow für Blenders Python
        import numpy as np
        from PIL import Image as PImg, ImageDraw, ImageFilter
        me = bm.data; Mw = bm.matrix_world; uvl = me.uv_layers.active.data
        bild = None
        for ms in bm.material_slots:
            if ms.material and ms.material.node_tree:
                for nd in ms.material.node_tree.nodes:
                    if nd.type == 'TEX_IMAGE' and nd.image and (bild is None or nd.image.size[0] > bild.size[0]) and 'normal' not in nd.image.name.lower(): bild = nd.image
        if bild:
            if bild.size[0] > 2048: bild.scale(2048, 2048)
            S = bild.size[0]; N = 1024
            maske = PImg.new('L', (N, N), 0); dm = ImageDraw.Draw(maske)
            for p in me.polygons:
                c = Mw @ p.center
                if not (c.y < vorn + (0.11 if breit > 0.05 else 0.06) and kinn.z - 0.012 < c.z < mz + 0.04 and abs(c.x - mitte.x) < breit and drin(c)): continue
                if (Mw.to_3x3() @ p.normal).y > 0.2: continue
                if abs(c.z - mz) < 0.007 and abs(c.x - mitte.x) < 0.024: continue                    # Lippen aussparen
                dichte = 200 if abs(c.x - mitte.x) > 0.026 or c.z > mz + 0.016 else 255
                if form == 'vollbart' and abs(c.x - mitte.x) > 0.06: dichte = 150                       # zu den Ohren hin lichter
                dm.polygon([(uvl[li].uv[0]*N, (1 - uvl[li].uv[1])*N) for li in p.loop_indices], fill=dichte)
            maske = maske.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(N/220))
            # Haarstruktur: viele kurze, leicht schräge Striche (nach unten wachsend)
            haar = PImg.new('L', (N, N), 0); dh = ImageDraw.Draw(haar); rng = np.random.default_rng(3)
            mk = np.asarray(maske); ys, xs = np.nonzero(mk > 20)
            for i in rng.choice(len(ys), size=min(len(ys), 26000), replace=False) if len(ys) else []:
                y, x = ys[i], xs[i]; L2 = rng.uniform(2, 5); a = rng.uniform(-0.5, 0.5)
                dh.line([(x, y), (x + np.sin(a)*L2, y + np.cos(a)*L2)], fill=int(rng.uniform(150, 255)), width=1)
            haar = haar.filter(ImageFilter.GaussianBlur(0.6))
            m = np.asarray(maske.resize((S, S), PImg.BILINEAR), np.float32)/255
            h = np.asarray(haar.resize((S, S), PImg.BILINEAR), np.float32)/255
            alpha = np.clip(m*(0.2 + 0.95*h), 0, 0.85)[::-1, :, None]      # Haarstruktur deutlich, Haut schimmert durch              # Blender-Bilder liegen von unten nach oben
            px = np.empty(S*S*4, np.float32); bild.pixels.foreach_get(px); px = px.reshape(S, S, 4)
            farbe = np.array(Z['bart'], np.float32)
            px[..., :3] = px[..., :3]*(1 - alpha) + farbe*alpha
            bild.pixels.foreach_set(px.ravel()); bild.update(); bild.pack()
            print('BART gemalt in', bild.name, S, flush=True)
    if 'brille' in Z:                                            # Steampunk-Schutzbrille auf der Stirn: Messingringe, getönte Gläser, Lederband
        messing = material('messing', (0.72, 0.52, 0.22), 0.3, 1.0); glas = material('glas', (0.15, 0.22, 0.2), 0.05, 0.3); leder = material('leder', (0.22, 0.13, 0.07), 0.7)
        stirn_z = z1 - 0.045
        for s in (-1, 1):
            p = oberflaeche(mitte.x + s*0.033, stirn_z)
            c = Vector((mitte.x + s*0.033, vorn + 0.012, stirn_z + 0.006))
            for (r1, tiefe, m, name, kappe) in [(0.023, 0.02, messing, 'ring', False), (0.02, 0.002, glas, 'glas', True)]:
                b = bmesh.new(); bmesh.ops.create_cone(b, cap_ends=kappe, segments=24, radius1=r1, radius2=r1*0.9, depth=tiefe)
                bmesh.ops.rotate(b, verts=b.verts, cent=(0, 0, 0), matrix=__import__('mathutils').Matrix.Rotation(math.radians(80), 3, 'X'))
                bmesh.ops.translate(b, verts=b.verts, vec=c + Vector((0, -tiefe/2 - (0.012 if name == 'glas' else 0), 0)))
                objekt('brille_' + name, b, m)
        ring = [p for p in pts if abs(p.z - stirn_z) < 0.008]
        bx0, bx1 = min(p.x for p in ring), max(p.x for p in ring); by0, by1 = min(p.y for p in ring), max(p.y for p in ring)
        b = bmesh.new(); bmesh.ops.create_cone(b, cap_ends=False, segments=40, radius1=(bx1 - bx0)/2 + 0.003, radius2=(bx1 - bx0)/2 + 0.003, depth=0.016)
        bmesh.ops.scale(b, vec=(1, (by1 - by0 + 0.006)/(bx1 - bx0 + 0.006), 1), verts=b.verts)
        bmesh.ops.translate(b, verts=b.verts, vec=Vector(((bx0 + bx1)/2, (by0 + by1)/2, stirn_z)))
        objekt('brille_band', b, leder)
    print('ZUSATZ', list(Z), flush=True)

if B.get('nur_arm'):                                                 # nur rechter Unterarm mit Hand und Ärmel (eigene Hand des Spielers)
    halten = {'lowerarm_r', 'hand_r'} | {f'{f}_{k:02d}_r' for f in ('index', 'middle', 'ring', 'pinky', 'thumb') for k in (1, 2, 3)}
    for ob in [o for o in bpy.data.objects if o.type == 'MESH']:
        idx = {g.index for g in ob.vertex_groups if g.name in halten}
        weg = [v.index for v in ob.data.vertices if sum(g.weight for g in v.groups if g.group in idx) < 0.5]
        if len(weg) == len(ob.data.vertices): bpy.data.objects.remove(ob, do_unlink=True); continue
        b2 = bmesh.new(); b2.from_mesh(ob.data); b2.verts.ensure_lookup_table()
        bmesh.ops.delete(b2, geom=[b2.verts[i] for i in weg], context='VERTS'); b2.to_mesh(ob.data); b2.free()
    print('ARM', [(o.name, len(o.data.vertices)) for o in bpy.data.objects if o.type == 'MESH'], flush=True)
for img in bpy.data.images:                                          # Texturen verkleinern (Ladezeit, Speicher)
    if img.size[0] > 1024: img.scale(1024, 1024 * img.size[1] // img.size[0])
    if 'eye' in img.name.lower() and img.size[0] > 256: img.scale(256, 256)
print('OBJEKTE', [(o.name, o.type, len(o.data.polygons) if o.type == 'MESH' else 0) for o in bpy.data.objects], flush=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=ZIEL, export_format='GLB', use_selection=True, export_apply=True, export_skins=True, export_animations=False,
                          export_morph=False, export_image_format='JPEG', export_jpeg_quality=85, export_yup=True)
print('EXPORT', ZIEL, os.path.getsize(ZIEL), flush=True)
