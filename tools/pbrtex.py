# Laedt Oberflaechentexturen von ambientCG (Lizenz CC0, frei nutzbar) und packt sie fuer das Spiel
# als prototype/cad/tex_pbr.js (per <script> ladbar, funktioniert daher auch bei Doppelklick auf die HTML-Datei).
# Aufruf: python tools\pbrtex.py [Ordner fuer die Downloads]
#   braucht: pip install pillow numpy
#
# Je Materialklasse entsteht ein RGBA-Bild (512 x 512, WebP), das der Shader in grafik.js aus drei Richtungen projiziert.
#   Art 'struktur': R = Helligkeitsstruktur, G = Rauheit (beide relativ zum Mittelwert, 0.5 = unveraendert), B/A = Relief (Normalenkarte x/y).
#   Art 'farbe':    RGB = Farbe relativ zum Mittelwert (z. B. Holzmaserung), A = Rauheit relativ; ohne Relief.
# Die Grundfarben der Objekte im Spiel bleiben erhalten; die Texturen veraendern sie nur um ihren Mittelwert herum.
import sys, os, io, zipfile, base64, json, urllib.request
import numpy as np
from PIL import Image

KLASSEN = {                          # Klasse: (ambientCG-Asset, Art)
    'metall':    ('Metal012', 'struktur'),          # gebuerstetes Metall
    'lack':      ('Metal027', 'struktur'),          # pulverbeschichtetes Blech
    'putz':      ('PaintedPlaster017', 'struktur'), # weiss gestrichener Putz
    'beton':     ('Concrete034', 'struktur'),       # glatter, heller Beton
    'boden':     ('Concrete046', 'struktur'),       # glatter Bodenbelag
    'holz':      ('Wood095', 'farbe'),              # helles Holz mit Maserung (Tischplatten)
    'kunststoff':('Plastic010', 'struktur'),        # glatter Kunststoff
}
DL = sys.argv[1] if len(sys.argv) > 1 else os.path.join('tools', '_pbr_download')
DST = os.path.join('prototype', 'cad', 'tex_pbr.js')
N = 512
os.makedirs(DL, exist_ok=True)

def lade(asset):
    z = os.path.join(DL, asset + '_1K-JPG.zip')
    if not os.path.exists(z):
        url = f'https://ambientcg.com/get?file={asset}_1K-JPG.zip'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Jumbo-Game pbrtex.py)'})
        with urllib.request.urlopen(req, timeout=120) as r, open(z, 'wb') as f: f.write(r.read())
    bilder = {}
    with zipfile.ZipFile(z) as zf:
        for name in zf.namelist():
            for teil in ('Color', 'Roughness', 'NormalGL'):
                if name.lower().endswith(f'_{teil.lower()}.jpg'):
                    bilder[teil] = Image.open(io.BytesIO(zf.read(name)))
    return bilder

out = {}
for klasse, (asset, art) in KLASSEN.items():
    b = lade(asset)
    gr = lambda im, mode: np.asarray(im.convert(mode).resize((N, N), Image.LANCZOS), dtype=np.float32)/255
    lum = gr(b['Color'], 'L')
    detail = np.clip(0.5*lum/max(lum.mean(), 1e-3), 0, 1)       # Helligkeit relativ zum Mittelwert, 0.5 = Mittel
    rau = gr(b['Roughness'], 'L') if 'Roughness' in b else np.full((N, N), 0.5, np.float32)
    nrm = gr(b['NormalGL'], 'RGB') if 'NormalGL' in b else np.full((N, N, 3), 0.5, np.float32)
    rau_rel = np.clip(0.5*rau/max(rau.mean(), 1e-3), 0, 1)       # Rauheit relativ: das Objekt behaelt seinen Glanz, bekommt nur Unregelmaessigkeiten
    if art == 'farbe':
        col = gr(b['Color'], 'RGB'); col = np.clip(0.5*col/np.maximum(col.reshape(-1, 3).mean(0), 1e-3), 0, 1)
        rgba = np.dstack([col, rau_rel])
    else:
        rgba = np.dstack([detail, rau_rel, nrm[..., 0], nrm[..., 1]])
    im = Image.fromarray((rgba*255 + 0.5).astype(np.uint8), 'RGBA')
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=88, alpha_quality=90, method=6)
    out[klasse] = {'art': art, 'bild': 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()}
    print(f'{klasse:10s} {asset:18s} {len(buf.getvalue())//1024:4d} KB, Rauheit mittel {rau.mean():.2f}')

with open(DST, 'w', encoding='utf-8') as f:
    f.write('// erzeugt von tools/pbrtex.py - Oberflaechentexturen von ambientCG.com (CC0): '
            + ', '.join(f'{k}={v[0]}' for k, v in KLASSEN.items()) + '\n')
    f.write('// je Klasse {art, bild}: struktur = R Helligkeit, G Rauheit (relativ, 0.5 = Mittel), B/A Normalenkarte; farbe = RGB Farbe, A Rauheit (relativ)\n')
    f.write('window.TEX_PBR=' + json.dumps(out, separators=(',', ':')) + ';\n')
print(f'-> {DST} ({os.path.getsize(DST)//1024} KB)')
