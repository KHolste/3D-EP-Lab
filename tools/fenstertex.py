# Fenster fuer Raum 019 aus dem Foto docs/fotos/raum019.JPEG: Rahmen und Mittelpfosten werden gemalt, in die beiden Scheiben kommt je ein
# Ausschnitt der Aussicht aus dem Foto (links Baeume und Auto, rechts die Stuetzmauer). Die unteren Teile der Scheiben verdeckt im Foto
# ein Kranausleger; die Ausschnitte liegen darueber. Haengt 'fenster019' an prototype/cad/tex_lite.js an (uebrige Eintraege bleiben).
# Aufruf: python tools\fenstertex.py        braucht: pip install pillow numpy
import base64, io, os, re
import numpy as np
from PIL import Image, ImageOps, ImageDraw, ImageFilter

SRC = os.path.join('docs', 'fotos', 'raum019.JPEG')
DST = os.path.join('prototype', 'cad', 'tex_lite.js')
W, H = 640, 256                                  # Textur fuer ein Fenster von 2,5 x 1,0 m
RAHMEN, PFOSTEN = 14, 18
LINKS = (2120, 615, 2560, 790)                   # Ausschnitte im Foto (4032 x 3024): Aussicht durch die linke und die rechte Scheibe
RECHTS = (2700, 605, 3130, 755)

foto = ImageOps.exif_transpose(Image.open(SRC)).convert('RGB')
img = Image.new('RGB', (W, H), (30, 33, 36))
sw = (W - 2*RAHMEN - PFOSTEN)//2; sh = H - 2*RAHMEN
for i, box in enumerate((LINKS, RECHTS)):
    a = np.asarray(foto.crop(box).resize((sw, sh), Image.LANCZOS), float)
    a = a*0.92 + np.linspace(28, 0, sh)[:, None, None]          # leichter Himmelsschein oben, etwas Glas
    img.paste(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)), (RAHMEN + i*(sw + PFOSTEN), RAHMEN))
d = ImageDraw.Draw(img)
d.rectangle([W//2 - 6, H//2 - 22, W//2 - 2, H//2 + 22], fill=(200, 203, 206))   # Griff am Mittelpfosten
d.line([(RAHMEN, RAHMEN), (W - RAHMEN, RAHMEN)], fill=(70, 74, 78), width=2)

buf = io.BytesIO(); img.save(buf, 'JPEG', quality=80, optimize=True)
data = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
src = open(DST, encoding='utf-8').read()
tex = dict(re.findall(r'(\w+):"(data:[^"]+)"', src)); tex['fenster019'] = data
kopf = [l for l in src.split('\n') if l.startswith('//')]
if not any('fenster019' in l for l in kopf): kopf.append('// fenster019: erzeugt von tools/fenstertex.py')
with open(DST, 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(kopf) + '\n')
    f.write('window.TEX={' + ',\n'.join(f'{k}:"{v}"' for k, v in tex.items()) + '};\n')
print(f'fenster019 {W}x{H}px {len(buf.getvalue())/1024:.0f} kB -> {DST}')
if os.environ.get('FENSTER_PNG'): img.save(os.environ['FENSTER_PNG'])
