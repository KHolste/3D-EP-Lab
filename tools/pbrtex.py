# Laedt Oberflaechentexturen von ambientCG (Lizenz CC0, frei nutzbar) und packt sie fuer das Spiel
# als prototype/cad/tex_pbr.js (per <script> ladbar, funktioniert daher auch bei Doppelklick auf die HTML-Datei).
# Aufruf: python tools\pbrtex.py [Ordner fuer die Downloads]
#   braucht: pip install pillow numpy
#
# Je Materialklasse entsteht ein RGBA-Bild (512 x 512, WebP), das der Shader in grafik.js aus drei Richtungen projiziert:
#   R = Helligkeitsstruktur, G = Rauheit (beide relativ zum Mittelwert, 0.5 = unveraendert), B/A = Relief (Normalenkarte x/y).
# Die Farben der Objekte im Spiel bleiben erhalten; die Texturen liefern nur Struktur, Glanz und Relief.
import sys, os, io, zipfile, base64, urllib.request
import numpy as np
from PIL import Image

KLASSEN = {                          # Klasse: ambientCG-Asset
    'metall':    'Metal012',         # gebuerstetes Metall
    'lack':      'Metal027',         # pulverbeschichtetes Blech
    'putz':      'PaintedPlaster017',# weiss gestrichener Putz
    'beton':     'Concrete034',      # glatter, heller Beton
    'boden':     'Concrete046',      # glatter Bodenbelag
    'holz':      'Wood095',          # helles Holz (Tischplatten)
    'kunststoff':'Plastic010',       # glatter Kunststoff
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
for klasse, asset in KLASSEN.items():
    b = lade(asset)
    gr = lambda im, mode: np.asarray(im.convert(mode).resize((N, N), Image.LANCZOS), dtype=np.float32)/255
    lum = gr(b['Color'], 'L')
    detail = np.clip(0.5*lum/max(lum.mean(), 1e-3), 0, 1)       # Helligkeit relativ zum Mittelwert, 0.5 = Mittel
    rau = gr(b['Roughness'], 'L') if 'Roughness' in b else np.full((N, N), 0.5, np.float32)
    nrm = gr(b['NormalGL'], 'RGB') if 'NormalGL' in b else np.full((N, N, 3), 0.5, np.float32)
    rau_rel = np.clip(0.5*rau/max(rau.mean(), 1e-3), 0, 1)       # Rauheit relativ: das Objekt behaelt seinen Glanz, bekommt nur Unregelmaessigkeiten
    rgba = np.dstack([detail, rau_rel, nrm[..., 0], nrm[..., 1]])
    im = Image.fromarray((rgba*255 + 0.5).astype(np.uint8), 'RGBA')
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=88, alpha_quality=90, method=6)
    out[klasse] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
    print(f'{klasse:10s} {asset:18s} {len(buf.getvalue())//1024:4d} KB, Rauheit mittel {rau.mean():.2f}')

with open(DST, 'w', encoding='utf-8') as f:
    f.write('// erzeugt von tools/pbrtex.py - Oberflaechentexturen von ambientCG.com (CC0): '
            + ', '.join(f'{k}={v}' for k, v in KLASSEN.items()) + '\n')
    f.write('// je Klasse RGBA: R Helligkeitsstruktur, G Rauheit (beide relativ, 0.5 = Mittel), B/A Normalenkarte x/y\n')
    f.write('window.TEX_PBR=' + '{' + ','.join(f'"{k}":"{v}"' for k, v in out.items()) + '};\n')
print(f'-> {DST} ({os.path.getsize(DST)//1024} KB)')
