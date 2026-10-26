# Macht aus dem Foto vom Ende von Flur 05 (docs/fotos/tuer_flur05.JPEG, Blick frontal auf die Tuer nach draussen) eine entzerrte Textur
# der ganzen dunklen Tueranlage samt Fluegeln, Blick nach draussen und Notausgangsschild, und haengt sie als 'tuer05' an
# prototype/cad/tex_lite.js an (die uebrigen Eintraege bleiben unveraendert).
# Aufruf: python tools\tuertex.py        braucht: pip install pillow numpy scipy
import base64, io, os, re
import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage

SRC = os.path.join('docs', 'fotos', 'tuer_flur05.JPEG')
DST = os.path.join('prototype', 'cad', 'tex_lite.js')
W, H = 2.872, 2.4                 # Tueranlage: volle Flurbreite, 2,4 m hoch (darueber die weisse Wand)
PX_M = 280
# Ecken der dunklen Tueranlage im Foto (1536 x 2048): oben links, oben rechts, unten rechts, unten links
FOTO = [(509, 712), (1135, 705), (1116, 1229), (512, 1219)]
REAL = [(0, H), (W, H), (W, 0), (0, 0)]

def homographie(src, dst):
    A = []
    for (x, y), (X, Y) in zip(src, dst):
        A += [[x, y, 1, 0, 0, 0, -X*x, -X*y, -X], [0, 0, 0, x, y, 1, -Y*x, -Y*y, -Y]]
    h = np.linalg.svd(np.array(A))[2][-1]; return (h / h[-1]).reshape(3, 3)

Hm = homographie(REAL, FOTO)
foto = np.asarray(ImageOps.exif_transpose(Image.open(SRC)).convert('RGB'), float)
nx, ny = int(W*PX_M), int(H*PX_M)
S, Hh = np.meshgrid((np.arange(nx) + 0.5)/PX_M, H - (np.arange(ny) + 0.5)/PX_M)
p = Hm @ np.stack([S.ravel(), Hh.ravel(), np.ones(S.size)])
x, y = (p[0]/p[2]).reshape(S.shape), (p[1]/p[2]).reshape(S.shape)
out = np.stack([ndimage.map_coordinates(foto[..., c], [y, x], order=1, mode='nearest') for c in range(3)], -1)
img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

buf = io.BytesIO(); img.save(buf, 'JPEG', quality=82, optimize=True)
data = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
src = open(DST, encoding='utf-8').read()
tex = dict(re.findall(r'(\w+):"(data:[^"]+)"', src)); tex['tuer05'] = data
kopf = [l for l in src.split('\n') if l.startswith('//')]
with open(DST, 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(kopf) + '\n')
    f.write('window.TEX={' + ',\n'.join(f'{k}:"{v}"' for k, v in tex.items()) + '};\n')
print(f'tuer05 {nx}x{ny}px {len(buf.getvalue())/1024:.0f} kB -> {DST}')
if os.environ.get('TUER_PNG'): img.save(os.environ['TUER_PNG'])
