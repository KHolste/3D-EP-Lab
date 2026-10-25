# Schneidet aus den Hallenfotos (docs/fotos) kachelbare Texturen und haengt sie an prototype/cad/tex_lite.js an.
# Bereits vorhandene Eintraege, die hier nicht erzeugt werden (z.B. coolpak), bleiben erhalten.
# Aufruf: tools\cadenv\Scripts\python.exe tools\fototex.py
import base64, io, os, re
import numpy as np
from PIL import Image, ImageFilter, ImageOps

SRC, DST = os.path.join('docs', 'fotos'), os.path.join('prototype', 'cad', 'tex_lite.js')

# Name: (Foto, Ausschnitt links/oben/rechts/unten als Anteil, Kantenlaenge px oder (Breite, Hoehe), Zielfarbe (Mittelwert), Kontrast,
#        JPEG-Qualitaet [, um 90 Grad drehen [, nahtlos kachelbar machen]])
TEX = {
    'boden':  ('textur_hallenboden.JPEG',             (0.04, 0.12, 0.96, 0.81), 512, (150, 150, 146), 1.0, 70),   # Hallenboden: grauer Beton mit Rissen
    'buehne': ('textur_bühne_oben.JPEG',              (0.30, 0.35, 0.70, 0.65), 256, (58, 47, 43),    0.8, 72),   # Buehnenbelag: dunkelbraune Siebdruckplatte
    'klappe': ('texutr_große_klappe_zum_keller.JPEG', (0.10, 0.30, 0.90, 0.90), 384, (150, 151, 147), 1.0, 70),   # Kellerklappe: grau gestrichenes Riffelblech
    'wand':   ('IMG_0841.JPEG',                       (0.01, 0.04, 0.35, 0.50), 512, (232, 232, 227), 0.5, 70),   # Wand: weiss gestrichener, brettgeschalter Beton
    'aussen': ('textur_boden_aussen.png',             (0.0, 0.0, 1.0, 1.0),    (224, 512), (113, 98, 81), 1.0, 75, True),   # Boden der Nachbarraeume: graubrauner Belag, Streifen laengs
    # Flure (Foto am Ostende von Flur 05): Wand glatt weiss gestrichen mit leichter Struktur, Boden hellgrau mit dunklen Sprenkeln.
    # Im Foto liegen beide im Schatten; Farbe daher nach Augenschein, die Struktur aus dem Foto
    'flurwand':  ('tuer_flur05.JPEG', (0.814, 0.415, 0.996, 0.610), (256, 384), (228, 229, 229), 1.3, 75, False, True),
    'flurboden': ('tuer_flur05.JPEG', (0.163, 0.859, 0.508, 0.991), (512, 256), (160, 161, 158), 1.2, 72, False, True),
}

def make(name, foto, crop, size, target, contrast, quality, drehen=False, nahtlos=False):
    im = ImageOps.exif_transpose(Image.open(os.path.join(SRC, foto))).convert('RGB')
    w, h = im.size
    im = im.crop((int(crop[0]*w), int(crop[1]*h), int(crop[2]*w), int(crop[3]*h)))
    if drehen: im = im.transpose(Image.Transpose.ROTATE_90)
    size = size if isinstance(size, tuple) else (size, size)
    im = im.resize(size, Image.LANCZOS)
    a = np.asarray(im, float)
    # Beleuchtungsverlauf des Fotos herausrechnen (sonst sieht man beim Kacheln helle und dunkle Felder)
    blur = np.asarray(im.filter(ImageFilter.GaussianBlur(min(size)/5)), float)
    g = a / np.maximum(blur, 1) * blur.mean()
    g = (g - g.mean()) * contrast
    grey = g.mean(axis=2, keepdims=True)
    out = np.array(target, float) * (1 + grey/128.0) + (g - grey)*0.5
    if nahtlos:   # mit dem um eine halbe Kachel verschobenen Bild ueberblenden: an den Raendern liegt dann die Bildmitte, die Kanten passen aneinander
        hh, ww = out.shape[:2]; r = np.roll(out, (hh//2, ww//2), (0, 1))
        m = np.minimum.outer(np.minimum(np.arange(hh), hh-1-np.arange(hh))/(hh/2), np.minimum(np.arange(ww), ww-1-np.arange(ww))/(ww/2))
        m = np.clip(m*2.5, 0, 1)[..., None]; out = out*m + r*(1-m)
    out = np.clip(out, 0, 255).astype(np.uint8)
    buf = io.BytesIO(); Image.fromarray(out).save(buf, 'JPEG', quality=quality, optimize=True)
    print(f'{name:7s} {size[0]}x{size[1]}px {len(buf.getvalue())/1024:.0f} kB  Mittelwert {out.reshape(-1, 3).mean(0).round()}')
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()

old = {}
if os.path.exists(DST):
    old = dict(re.findall(r'(\w+):"(data:[^"]+)"', open(DST, encoding='utf-8').read()))
for name, spec in TEX.items(): old[name] = make(name, *spec)
with open(DST, 'w', encoding='utf-8', newline='\n') as f:
    f.write('// Fototexturen der leichten Variante (Ausschnitte aus docs/fotos), als Daten eingebettet, damit sie auch per Doppelklick laden\n')
    f.write('// boden, buehne, klappe, wand, aussen, flurwand, flurboden: erzeugt von tools/fototex.py\n')
    f.write('// tuer05: erzeugt von tools/tuertex.py; fenster019: erzeugt von tools/fenstertex.py\n')
    f.write('window.TEX={' + ',\n'.join(f'{k}:"{v}"' for k, v in old.items()) + '};\n')
print('geschrieben:', DST, round(os.path.getsize(DST)/1024), 'kB')
