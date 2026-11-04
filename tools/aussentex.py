# Texturen fuer die Umgebung vor den Fenstern (Rasen, Hecke, Fassade des Nachbargebaeudes) -> prototype/cad/tex_aussen.js
# Rasen: ambientCG Grass005 (CC0); Hecke und Fassade: Ausschnitte aus dem Fensterfoto von Raum 06 (poster_fenster06a in tex_lite.js);
# Stützmauer vor 019: Ausschnitt aus dem Fensterfoto 'fenster019'.
# Aufruf: python tools\aussentex.py [Ordner fuer Downloads]      braucht: pip install pillow
import sys, os, io, re, zipfile, base64, json, urllib.request
from PIL import Image
DL = sys.argv[1] if len(sys.argv) > 1 else os.path.join('tools', '_pbr_download')
os.makedirs(DL, exist_ok=True)
def webp(im, q=85):
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6); return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
z = os.path.join(DL, 'Grass005_1K-JPG.zip')
if not os.path.exists(z):
    req = urllib.request.Request('https://ambientcg.com/get?file=Grass005_1K-JPG.zip', headers={'User-Agent': 'Mozilla/5.0'})
    open(z, 'wb').write(urllib.request.urlopen(req, timeout=120).read())
with zipfile.ZipFile(z) as zf:
    n = [x for x in zf.namelist() if x.endswith('_Color.jpg')][0]
    rasen = Image.open(io.BytesIO(zf.read(n))).convert('RGB').resize((512, 512), Image.LANCZOS)
s = open(os.path.join('prototype', 'cad', 'tex_lite.js'), encoding='utf-8').read()
m = re.search(r'["\']?poster_fenster06a["\']?\s*:\s*["\']data:image/\w+;base64,([^"\']+)', s)
foto = Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert('RGB')        # 380 x 590
fassade = foto.crop((110, 0, 380, 468))          # rechts vom Baum, bis zur Oberkante der Hecke: etwa 4,9 m x 8,5 m
hecke = foto.crop((0, 452, 315, 522))            # dichtes Laub ohne Himmel und Rasen
m = re.search(r'["\']?fenster019["\']?\s*:\s*["\']data:image/\w+;base64,([^"\']+)', s)
f019 = Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert('RGB')     # 640 x 256, zwei Scheiben
stuetzmauer = f019.crop((335, 60, 625, 238))      # rechte Scheibe: fleckiger Beton der Stützmauer vor 019
out = {'rasen': webp(rasen), 'fassade': webp(fassade, 88), 'hecke': webp(hecke), 'stuetzmauer': webp(stuetzmauer)}
dst = os.path.join('prototype', 'cad', 'tex_aussen.js')
with open(dst, 'w', encoding='utf-8') as f:
    f.write('// erzeugt von tools/aussentex.py: Rasen (ambientCG Grass005, CC0), Hecke und Fassade aus dem Fensterfoto von Raum 06\n')
    f.write('window.TEX_AUSSEN=' + json.dumps(out, separators=(',', ':')) + ';\n')
print('->', dst, os.path.getsize(dst)//1024, 'KB')
