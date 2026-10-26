# Entzerrt die Poster am Ende von Flur 05 aus den Fotos (docs/fotos/poster_*.JPEG) und haengt sie als 'poster_<name>' an
# prototype/cad/tex_lite.js an. Die Ecken des Rahmens sind im Foto ausgemessen; der Rand wird etwas beschnitten (der Alurahmen
# wird im Spiel als Leiste gebaut), dann wird der Helligkeitsverlauf des Blitzes/Fensters gedaempft.
# Aufruf: python tools\postertex.py        braucht: pip install pillow numpy scipy
import base64, io, os, re
import numpy as np
from PIL import Image, ImageOps, ImageFilter
from scipy import ndimage

DST = os.path.join('prototype', 'cad', 'tex_lite.js')
# Name: (Foto, Rahmenecken oben links, oben rechts, unten rechts, unten links im Foto 1536 x 2048, Texturgroesse)
POSTER = {
    'fair':  ('poster_fair.JPEG',  [(248, 238), (1362, 236), (1310, 1757), (288, 1760)], (420, 580)),
    'pb':    ('poster_pb.JPEG',    [(278, 300), (1340, 272), (1320, 1750), (325, 1710)], (400, 560)),
    'ptra':  ('poster_ptra.JPEG',  [(307, 359), (1398, 329), (1361, 1751), (353, 1742)], (400, 560)),
    'inlab': ('poster_inlab.JPEG', [(169, 261), (1146, 301), (1137, 1582), (215, 1644)], (400, 560)),
    'pinnwand': ('pinnwand.JPEG', [(287, 252), (1645, 366), (1650, 1112), (338, 1312)], (840, 560)),   # Meme-Whiteboard im Übergangsraum (Foto 2048 x 1536)
}
RAND = 0.025                      # Anteil, der an jeder Seite wegfaellt (Alurahmen)

def homographie(src, dst):
    A = []
    for (x, y), (X, Y) in zip(src, dst):
        A += [[x, y, 1, 0, 0, 0, -X*x, -X*y, -X], [0, 0, 0, x, y, 1, -Y*x, -Y*y, -Y]]
    h = np.linalg.svd(np.array(A))[2][-1]; return (h / h[-1]).reshape(3, 3)

src = open(DST, encoding='utf-8').read()
tex = dict(re.findall(r'(\w+):"(data:[^"]+)"', src))
for name, (foto, ecken, (w, h)) in POSTER.items():
    im = np.asarray(ImageOps.exif_transpose(Image.open(os.path.join('docs', 'fotos', foto))).convert('RGB'), float)
    Hm = homographie([(0, 0), (1, 0), (1, 1), (0, 1)], ecken)
    U, V = np.meshgrid(RAND + (1 - 2*RAND)*(np.arange(w) + 0.5)/w, RAND + (1 - 2*RAND)*(np.arange(h) + 0.5)/h)
    p = Hm @ np.stack([U.ravel(), V.ravel(), np.ones(U.size)])
    x, y = (p[0]/p[2]).reshape(U.shape), (p[1]/p[2]).reshape(U.shape)
    a = np.stack([ndimage.map_coordinates(im[..., c], [y, x], order=1, mode='nearest') for c in range(3)], -1)
    hell = ndimage.gaussian_filter(a.mean(2), min(w, h)/4)                       # grober Helligkeitsverlauf (Spiegelung, Fensterlicht)
    a = a * np.clip(hell.mean()/np.maximum(hell, 1), 0.75, 1.25)[..., None]
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    buf = io.BytesIO(); img.save(buf, 'JPEG', quality=80, optimize=True)
    tex['poster_' + name] = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
    print(f'poster_{name} {w}x{h}px {len(buf.getvalue())/1024:.0f} kB')
    if os.environ.get('POSTER_DIR'): img.save(os.path.join(os.environ['POSTER_DIR'], name + '.png'))
kopf = [l for l in src.split('\n') if l.startswith('//')]
if not any('postertex' in l for l in kopf): kopf.append('// poster_*: erzeugt von tools/postertex.py')
with open(DST, 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(kopf) + '\n')
    f.write('window.TEX={' + ',\n'.join(f'{k}:"{v}"' for k, v in tex.items()) + '};\n')
print('geschrieben:', DST, round(os.path.getsize(DST)/1024), 'kB')
