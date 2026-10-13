# Verschlankt die aus STEP erzeugte GLB für das Spiel und schreibt prototype/cad/halle_data.js
# (per <script> ladbar, funktioniert daher auch bei Doppelklick auf die HTML-Datei).
# Aufruf: python tools\glb_opt.py prototype\cad\halle_full.glb prototype\cad\halle_data.js
#   oder: python tools\glb_opt.py prototype\cad\halle_full.glb prototype\cad\halle_lite.js lite
#         (leichte Variante: nur grosse Flaechen, Netze stark vereinfacht, EMV-Kabine entfaellt und wird im Spiel als Kasten gebaut)
import sys, json, base64, collections
import numpy as np
sys.path.insert(0, 'tools')
import glblib

src, dst = sys.argv[1], sys.argv[2]

# --- Auswahl -------------------------------------------------------------------------------
DROP = [                      # Namensteile, die komplett entfallen
    'MANIKIN', 'Manikin',
    'BEAMDUMP', 'HONEYCOMB',                    # Einbauten im EMV-Tank, von außen unsichtbar
    'GITTERROST',                               # liegt unter dem Belag der oberen Bühne, sehr viele Dreiecke
    'Product.1', '20018_Modell_Buehne',         # doppelte (tessellierte) Kopien der Stahlunterkonstruktion
    'ZYL_M_IN', 'MUTTER', 'SCHEIBE_DIN', 'SECHSKANT', 'GEWINDE', 'O_RING', 'SENK_M', 'RINGSCHRAUBE', 'LEHRE',
]
JUMBO_OLD = 'JUMBO_20200120'  # Tank Stand 2020: liefert Tuer, Anbauten, Leiter, Auflager
JUMBO_NEW = 'VAKUUMTANK_JUMBO'  # Ueberarbeitung 2026 desselben Tanks: Mantel, Handrad-Deckel, Fahrwerk
DOOR_X = -3.86                # Flaechen des 2020er Modells, die ganz rechts davon liegen, gehoeren zur fahrbaren Tuer
YELLOW, BROWN, SILVER, RED, DECK, BLUE, CREAM = (236, 190, 0), (96, 54, 42), (188, 192, 198), (196, 40, 30), (72, 58, 54), (28, 95, 196), (226, 222, 208)
MIN_DIAG = 0.03               # kleinere Einzelflächen (Fasen, Bohrungen, Kleinteile) entfallen
MIN_DIAG_PART = {'EMV_TANK': 0.15, 'STAHLUNTERK': 0.08}   # groeber, wo man im Spiel nicht nah herankommt (spart Dreiecke)

ms = glblib.load(src)
LITE = len(sys.argv) > 3 and sys.argv[3] == 'lite'
RATIO = {}                    # Anteil der Dreiecke, der je Bauteilgruppe nach dem Vereinfachen bleibt
if LITE:
    DROP += ['WABEN', 'SPANNER']                # Einbauten und Spannverschluesse des EMV-Tanks
    MIN_DIAG = 0.06; MIN_DIAG_PART = {'EMV_TANK': 0.3, 'STAHLUNTERK': 0.25, 'BUHNE_3D': 0.25}
    RATIO = {'tank': 0.45, 'tuer': 0.45, 'emv': 0.15, 'stahl': 0.2}

def simplify(p, idx, ratio, crease=35):
    """Flaechen verschweissen, Dreiecke zusammenlegen (Quadrik-Verfahren), danach an scharfen Kanten wieder auftrennen"""
    import pyfqmr
    u, inv = np.unique(np.round(p / 0.0005).astype(np.int64), axis=0, return_inverse=True); inv = inv.ravel()
    v = np.zeros((len(u), 3)); v[inv] = p
    f = inv[idx]; f = f[(f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])]
    sp = pyfqmr.Simplify(); sp.setMesh(v, f.astype(np.int32))
    sp.simplify_mesh(target_count=int(len(f) * ratio), aggressiveness=7, preserve_border=False, verbose=False)
    v, f, _ = sp.getMesh(); f = f.astype(np.int64)
    n = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]]); l = np.linalg.norm(n, axis=1); ok = l > 1e-14
    f, n = f[ok], n[ok] / l[ok, None]
    cv, cf = f.ravel(), np.repeat(np.arange(len(f)), 3); order = np.argsort(cv, kind='stable')
    new = np.empty(len(cv), np.int64); out = []; cos = np.cos(np.radians(crease))
    for seg in np.split(order, np.flatnonzero(np.diff(cv[order])) + 1):
        reps = []                                # je Ecke: Flaechen mit aehnlicher Richtung teilen sich einen Punkt
        for c in seg:
            nf = n[cf[c]]
            for r in reps:
                if r[0] @ nf > cos: new[c] = r[1]; break
            else:
                reps.append((nf, len(out))); new[c] = len(out); out.append(v[cv[c]])
    return np.array(out), new.reshape(-1, 3)
groups = collections.defaultdict(lambda: {'pos': [], 'idx': [], 'n': 0})
stat = collections.Counter(); shell = []
for m in ms:
    path = ' / '.join(m['path']); p = m['pos']; tri = len(m['idx'])
    if any(d in path for d in DROP): stat['drop_name'] += tri; continue
    lo, hi = p.min(0), p.max(0); ext = hi - lo
    if np.linalg.norm(ext) < next((v for k, v in MIN_DIAG_PART.items() if k in path), MIN_DIAG): stat['drop_klein'] += tri; continue
    col = tuple(int(round(c * 255)) for c in m['col'][:3])
    lilac, teal = col == (164, 164, 255), col == (0, 43, 102)
    part = 'halle'
    if JUMBO_OLD in path:
        part = 'tuer' if lo[0] > DOOR_X else 'tank'
        if part == 'tank' and 3 < ext[0] < 5 and ext[1] > 2:        # Mantel: deckungsgleich mit dem 2026er Mantel -> nur messen
            shell.append(p); stat['drop_mantel_alt'] += tri; continue
        if part == 'tank': col = YELLOW if lilac else BROWN if teal else SILVER
        else:
            big = ext[1] > 1.5 and ext[2] > 1.5                      # Deckelflaechen (Klopperboden, Flanschring)
            low = hi[2] < 3.0 and not big                            # Fahrgestell der Tuer
            col = YELLOW if big else BROWN if (teal or (lilac and low)) else SILVER
    elif JUMBO_NEW in path:
        part = 'tank'
        col = RED if 'HANDRAD' in path else BROWN if ('FAHRWERK' in path or 'KLOTZ' in path or 'axis_part' in path) else YELLOW
    elif 'KELLER' in path: part = 'keller'
    elif 'GEBAEUDE' in path: part = 'gebaeude'
    elif 'BUEHNE_JUMBO' in path: part = 'buehne'; col = DECK
    elif 'PFOSTEN' in path: part = 'buehne'; col = BLUE
    elif 'KRAN' in path: part = 'kran'
    elif 'EMV_TANK' in path: part = 'emv'
    elif 'STAHLUNTERK' in path or 'BUHNE_3D' in path: part = 'stahl'
    g = groups[(part, col)]
    g['pos'].append(p); g['idx'].append(m['idx'] + g['n']); g['n'] += len(p); stat[part] += tri
# rein tessellierte Teile (EMV-Kabine) aus tools/step_tess.py
import os
tx = os.path.join(os.path.dirname(dst), 'tess_extra.npz')
if os.path.exists(tx) and not LITE:
    z = np.load(tx)
    for k in range(len(z['names'])):
        p = z[f'p{k}'].astype(float); g = groups[('kabine', CREAM)]
        g['pos'].append(p); g['idx'].append(np.arange(len(p)).reshape(-1, 3) + g['n']); g['n'] += len(p); stat['kabine'] += len(p) // 3

# --- Maße für das Spiel --------------------------------------------------------------------
info = {}
if shell:
    s = np.vstack(shell)
    info['tank'] = {'x0': float(s[:, 0].min()), 'x1': float(s[:, 0].max()), 'yc': float((s[:, 1].min() + s[:, 1].max()) / 2),
                    'zc': float((s[:, 2].min() + s[:, 2].max()) / 2), 'r': float((s[:, 2].max() - s[:, 2].min()) / 2)}
for part in ('tuer', 'tank'):
    pp = [np.vstack(g['pos']) for (pt, _), g in groups.items() if pt == part]
    if pp: a = np.vstack(pp); info[part + '_bb'] = [a.min(0).round(3).tolist(), a.max(0).round(3).tolist()]

for (part, col), g in groups.items():
    if part in RATIO:
        p, i = simplify(np.vstack(g['pos']), np.vstack(g['idx']), RATIO[part]); g['pos'], g['idx'], g['n'] = [p], [i], len(p)

# --- Schreiben: Positionen als uint16 (quantisiert), Indizes uint32 ------------------------
allp = np.vstack([np.vstack(g['pos']) for g in groups.values()])
lo = allp.min(0); scale = (allp.max(0) - lo).max() / 65535.0
blob = bytearray(); meta = []
for (part, col), g in sorted(groups.items()):
    p = np.vstack(g['pos']); i = np.vstack(g['idx']).astype(np.uint32)
    # in Spielkoordinaten (wie glTF): X = CAD x, Y = CAD z (hoch), Z = -CAD y
    q = np.round((p - lo) / scale).astype(np.uint16)
    while len(blob) % 4: blob.append(0)
    o1 = len(blob); blob += q.tobytes()
    while len(blob) % 4: blob.append(0)
    o2 = len(blob); blob += i.tobytes()
    meta.append({'part': part, 'col': list(col), 'nv': len(p), 'ni': int(i.size), 'ov': o1, 'oi': o2})
out = {'lo': lo.tolist(), 'scale': float(scale), 'groups': meta, 'info': info}
with open(dst, 'w', encoding='ascii') as f:
    f.write('// erzeugt von tools/glb_opt.py aus der STEP-Datei der Halle - nicht von Hand bearbeiten\n')
    f.write('window.HALLE=' + json.dumps(out, separators=(',', ':')) + ';\nwindow.HALLE.b64="' + base64.b64encode(bytes(blob)).decode() + '";\n')
print('Dreiecke:', dict(stat)); print('gesamt behalten:', sum(m['ni'] for m in meta) // 3, 'in', len(meta), 'Gruppen;', round(len(blob) / 1e6, 1), 'MB binär')
print(json.dumps(info, indent=1))
