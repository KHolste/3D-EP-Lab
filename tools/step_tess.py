# Liest die rein tessellierten Bauteile (AP242 TESSELLATED_SHAPE_REPRESENTATION, z. B. die EMV-Kabine)
# direkt aus der STEP-Datei, weil OpenCascade sie beim Import ohne Geometrie laesst.
# Ergebnis: prototype/cad/tess_extra.npz mit Dreiecken in CAD-Weltkoordinaten (Meter).
# Aufruf: python tools\step_tess.py <datei.stp> prototype\cad\tess_extra.npz
import sys, re
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
SKIP = ['EMV_TANK']          # liegt bereits als B-Rep vor
MIN_DIAG_MM = 120
E = {}
with open(src, 'r', encoding='latin-1') as f:
    for line in f:
        if line.startswith('#'):
            i = line.find('=')
            E[int(line[1:i])] = line[i + 1:].strip().rstrip(';').strip()
print(len(E), 'Entitaeten')

def typ(i): return E[i].split('(', 1)[0].strip()
def refs(s): return [int(x) for x in re.findall(r'#(\d+)', s)]
def args(i):
    """oberste Argumentliste einer einfachen Entitaet als Strings"""
    s = E[i]; s = s[s.index('(') + 1:s.rindex(')')]
    out, depth, cur, q = [], 0, '', False
    for ch in s:
        if ch == "'": q = not q
        if not q:
            if ch == '(': depth += 1
            elif ch == ')': depth -= 1
            elif ch == ',' and depth == 0: out.append(cur.strip()); cur = ''; continue
        cur += ch
    out.append(cur.strip()); return out
def nums(s): return [float(x) for x in re.findall(r'-?\d+\.?\d*(?:[eE][-+]?\d+)?', s)]

def placement(i):
    a = args(i); loc = np.array(nums(E[int(a[1][1:])].split(',', 1)[1])[:3])
    z = np.array(nums(E[int(a[2][1:])].split(',', 1)[1])[:3]) if a[2] != '$' else np.array([0, 0, 1.])
    x = np.array(nums(E[int(a[3][1:])].split(',', 1)[1])[:3]) if a[3] != '$' else np.array([1., 0, 0])
    z = z / np.linalg.norm(z); x = x - z * (x @ z); x = x / np.linalg.norm(x); y = np.cross(z, x)
    M = np.eye(4); M[:3, 0] = x; M[:3, 1] = y; M[:3, 2] = z; M[:3, 3] = loc; return M

# --- Baugruppenstruktur: Kind-PD -> (Eltern-PD, Transformation) ----------------------------
pds_of = {}                                   # NAUO/PD -> PRODUCT_DEFINITION_SHAPE
for i, s in E.items():
    if s.startswith('PRODUCT_DEFINITION_SHAPE'): pds_of[refs(s)[-1]] = i
trans_of_pds = {}
for i, s in E.items():
    if s.startswith('CONTEXT_DEPENDENT_SHAPE_REPRESENTATION'):
        rr, pds = refs(s); idt = [r for r in refs(E[rr]) if typ(r) == 'ITEM_DEFINED_TRANSFORMATION']
        if idt:
            a1, a2 = refs(E[idt[0]])[-2:]
            # welche Seite Kind/Eltern ist, steht in rep_1/rep_2 der Beziehung; CATIA: item_1 = Kind-Achse, item_2 = Lage im Elternteil
            trans_of_pds[pds] = placement(a2) @ np.linalg.inv(placement(a1))
parent = {}
for i, s in E.items():
    if s.startswith('NEXT_ASSEMBLY_USAGE_OCCURRENCE'):
        r = refs(s); par, child = r[0], r[1]
        parent.setdefault(child, []).append((par, trans_of_pds.get(pds_of.get(i), np.eye(4))))
def world(pd):
    Ms = []
    def up(pd, M):
        if pd not in parent: Ms.append(M); return
        for par, T in parent[pd]: up(par, T @ M)
    up(pd, np.eye(4)); return Ms

# --- Kontext -> PRODUCT_DEFINITION (ueber SHAPE_REPRESENTATION und SHAPE_DEFINITION_REPRESENTATION) ----
ctx_pd = {}; name_pd = {}
for i, s in E.items():
    if s.startswith('SHAPE_DEFINITION_REPRESENTATION'):
        pds, rep = refs(s); d = refs(E[pds])[-1]
        if typ(d) == 'PRODUCT_DEFINITION': ctx_pd[refs(E[rep])[-1]] = d
for i, s in E.items():
    if s.startswith('PRODUCT_DEFINITION('):
        pdf = refs(s)[0]; prod = refs(E[pdf])[0]; name_pd[i] = args(prod)[0].strip("'")

def face_tris(i):
    a = args(i); coords = int(a[1][1:])
    pn = [int(x) for x in re.findall(r'\d+', a[5])]
    tris = []
    def idx(k): return (pn[k - 1] if pn else k) - 1
    for strip in re.findall(r'\(([\d,\s]+)\)', a[6][1:-1] if a[6] != '()' else ''):
        v = [int(x) for x in strip.split(',')]
        for k in range(len(v) - 2):
            t = (v[k], v[k + 1], v[k + 2]) if k % 2 == 0 else (v[k + 1], v[k], v[k + 2])
            tris.append([idx(t[0]), idx(t[1]), idx(t[2])])
    for fan in re.findall(r'\(([\d,\s]+)\)', a[7][1:-1] if a[7] != '()' else ''):
        v = [int(x) for x in fan.split(',')]
        for k in range(1, len(v) - 1): tris.append([idx(v[0]), idx(v[k]), idx(v[k + 1])])
    return coords, tris

coord_cache = {}
def coords(i):
    if i not in coord_cache:
        s = E[i]; s = s[s.index('(('):]
        coord_cache[i] = np.array(nums(s)).reshape(-1, 3)
    return coord_cache[i]

out_pos, out_name, total = [], [], 0
for i, s in list(E.items()):
    if not s.startswith('TESSELLATED_SHAPE_REPRESENTATION'): continue
    r = refs(s); ctx = r[-1]; pd = ctx_pd.get(ctx); nm = name_pd.get(pd, '?')
    if any(k in nm for k in SKIP): continue
    faces = []
    def collect(j, M):
        s2 = E[j]
        if s2.startswith('('):                              # zusammengesetzte Entitaet (CATIA: verschobener Satz)
            m = re.search(r'REPOSITIONED_TESSELLATED_ITEM\(#(\d+)\)', s2)
            if m: M = M @ placement(int(m.group(1)))
            m = re.search(r'TESSELLATED_(?:GEOMETRIC_SET|SOLID|SHELL)\(\(?([^)]*)\)', s2)
            for k in refs(m.group(1)) if m else []: collect(k, M)
            return
        t = typ(j)
        if t == 'COMPLEX_TRIANGULATED_FACE': faces.append((j, M))
        elif t.startswith('TESSELLATED'):
            for k in refs(s2):
                if E[k].startswith('(') or typ(k).startswith(('TESSELLATED', 'COMPLEX_TRI')): collect(k, M)
    for j in r[:-1]: collect(j, np.eye(4))
    P = []
    for fc, M in faces:
        c, tris = face_tris(fc)
        if tris:
            q = coords(c)[np.array(tris)].reshape(-1, 3)
            if np.linalg.norm(q.max(0) - q.min(0)) < MIN_DIAG_MM: continue      # Kleinteile (Schrauben, Fasen) weglassen
            P.append(q @ M[:3, :3].T + M[:3, 3])
    if not P: print('  ', nm, ': keine Dreiecke'); continue
    P = np.vstack(P); Ms = world(pd) if pd else [np.eye(4)]
    for M in Ms:
        W = (P @ M[:3, :3].T + M[:3, 3]) / 1000.0
        out_pos.append(W.astype(np.float32)); out_name.append(nm); total += len(W) // 3
        print(f'  {nm}: {len(W)//3} Dreiecke, bb {W.min(0).round(2)} {W.max(0).round(2)}')
np.savez_compressed(dst, names=np.array(out_name), **{f'p{k}': p for k, p in enumerate(out_pos)})
print('gesamt', total, 'Dreiecke ->', dst)
