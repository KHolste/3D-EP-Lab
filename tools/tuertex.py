# Macht aus dem Foto der Glastuer am Ostende von Flur 05 (docs/fotos/tuer_flur05.JPEG) eine entzerrte Textur der ganzen Tueranlage
# und haengt sie als 'tuer05' an prototype/cad/tex_lite.js an (die uebrigen Eintraege bleiben unveraendert).
# Aufruf: python tools\tuertex.py        braucht: pip install pillow numpy scipy
#
# Entzerrt wird ueber die Glasscheibe des rechten Fluegels, die in Wirklichkeit ein Rechteck ist (Ecken im Foto ausgemessen).
# Das Foto zeigt den linken Fluegel nur zum Teil: was links fehlt, wird vom rechten Fluegel gespiegelt ergaenzt.
# Vor dem dunklen Seitenteil rechts steht ein Fahrrad; das Seitenteil wird deshalb als glatte dunkle Flaeche gemalt.
import base64, io, os, re
import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage

SRC = os.path.join('docs', 'fotos', 'tuer_flur05.JPEG')
DST = os.path.join('prototype', 'cad', 'tex_lite.js')
PX_M = 256                                   # Pixel je Meter in der Textur

# Tueranlage in Metern, s von links (Blick nach Osten), h vom Boden. Breite 2,7 m (Flur 2,87 m, links bleibt ein Streifen Wand)
W, H = 2.7, 2.25
MITTE = 1.35                                 # Stoss der beiden Fluegel
FL = 1.0                                     # Fluegelbreite
PANEL = W - MITTE - FL                       # dunkles Seitenteil rechts (0,35 m), links gleich breit gespiegelt

# Glasscheibe rechter Fluegel: u = Abstand vom Fluegelstoss, v = Hoehe; im Foto (1536 x 2048) ausgemessene Ecken
REAL = [(0.0, 2.10), (0.92, 2.10), (0.92, 0.15), (0.0, 0.15)]
FOTO = [(130.3, 2.3), (620.0, 42.0), (630.0, 937.0), (243.8, 948.6)]

def homographie(src, dst):
    A = []
    for (x, y), (X, Y) in zip(src, dst):
        A += [[x, y, 1, 0, 0, 0, -X*x, -X*y, -X], [0, 0, 0, x, y, 1, -Y*x, -Y*y, -Y]]
    h = np.linalg.svd(np.array(A))[2][-1]; return (h / h[-1]).reshape(3, 3)

Hm = homographie(REAL, FOTO)
foto = np.asarray(ImageOps.exif_transpose(Image.open(SRC)).convert('RGB'), float)
fh, fw = foto.shape[:2]

nx, ny = int(W*PX_M), int(H*PX_M)
s = (np.arange(nx) + 0.5)/PX_M; h = H - (np.arange(ny) + 0.5)/PX_M
S, Hh = np.meshgrid(s, h)
U = S - MITTE

def abbild(u, v):
    p = Hm @ np.stack([u.ravel(), v.ravel(), np.ones(u.size)])
    return (p[0]/p[2]).reshape(u.shape), (p[1]/p[2]).reshape(u.shape)

def probe(x, y):
    return np.stack([ndimage.map_coordinates(foto[..., c], [y, x], order=1, mode='nearest') for c in range(3)], -1)

x, y = abbild(U, Hh); direkt = probe(x, y)
xm, ym = abbild(np.abs(U), Hh); gespiegelt = probe(xm, ym)
# links vom Fluegelstoss: echtes Foto, solange es im Bild liegt, mit weichem Uebergang zur gespiegelten Ergaenzung
a = np.clip((x - 15) / 60, 0, 1)[..., None] * (U < 0)[..., None]
out = np.where((U >= 0)[..., None], direkt, a*direkt + (1 - a)*gespiegelt)

# Seitenteile und Rahmen: dunkel lackiertes Aluminium
dunkel = np.array([24, 25, 27], float)
out[np.abs(U) > 0.905] = dunkel              # Fluegelrahmen aussen und Seitenteile (verdeckt auch den Fahrradreifen am Glasrand)
out[Hh > 2.11] = dunkel                       # Rahmen oben und Sturz (das Foto endet knapp ueber der Scheibe)
out[Hh < 0.05] = dunkel                       # unterste Reihe: im Foto schon Fussboden
img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

buf = io.BytesIO(); img.save(buf, 'JPEG', quality=80, optimize=True)
data = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
src = open(DST, encoding='utf-8').read()
tex = dict(re.findall(r'(\w+):"(data:[^"]+)"', src)); tex['tuer05'] = data
kopf = [l for l in src.split('\n') if l.startswith('//')]
if not any('tuer05' in l for l in kopf): kopf.append('// tuer05: erzeugt von tools/tuertex.py')
with open(DST, 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(kopf) + '\n')
    f.write('window.TEX={' + ',\n'.join(f'{k}:"{v}"' for k, v in tex.items()) + '};\n')
print(f'tuer05 {nx}x{ny}px {len(buf.getvalue())/1024:.0f} kB -> {DST}')
if os.environ.get('TUER_PNG'): img.save(os.environ['TUER_PNG'])
