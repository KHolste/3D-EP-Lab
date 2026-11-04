# Baut die Spielfiguren mit MakeHuman (Blender-Zusatz MPFB) und packt sie als prototype/cad/figuren_data.js
# (GLB als Base64, per <script> ladbar, funktioniert daher auch bei Doppelklick auf die HTML-Datei).
# Aufruf: python tools\figuren.py [name ...]
#   braucht: Blender mit dem Zusatz MPFB und den MakeHuman-Grundbausteinen (makehuman_system_assets_cc0, im MPFB-Datenordner),
#            pip install pillow numpy
import sys, os, json, base64, shutil, subprocess, glob
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARB = os.path.join(ROOT, 'tools', '_mh'); os.makedirs(ARB, exist_ok=True)
DATA = os.path.join(os.environ['APPDATA'], 'Blender Foundation', 'Blender', '5.2', 'extensions', '.user', 'blender_org', 'mpfb', 'data')
BLENDER = (glob.glob(r'C:\Program Files\Blender Foundation\Blender*\blender.exe') or ['blender'])[-1]

def kleidung(name, basis, shirt, hose, aufdruck=None):
    if basis == 'male_casualsuit05': return kleidung_umfaerben(name, basis, shirt)
    """Kopie eines MakeHuman-Kleidungsstücks mit umgefärbtem Oberteil (obere Texturhälfte, Logo entfernt) und Hose (untere Hälfte)."""
    ziel = os.path.join(DATA, 'clothes', name)
    if os.path.isdir(ziel): shutil.rmtree(ziel)
    shutil.copytree(os.path.join(DATA, 'clothes', basis), ziel)
    p = os.path.join(ziel, basis + '_diffuse.png'); a = np.asarray(Image.open(p).convert('RGB'), dtype=np.float32)/255
    H = a.shape[0]; oben = np.zeros(a.shape[:2], bool); oben[:int(H*0.43)] = True
    lum = a.mean(-1); sat = a.max(-1) - a.min(-1)
    # Logo und Aufdruck im Oberteil: durch die mittlere Helligkeit des Stoffs ersetzen
    stoff = oben & (sat < 0.08) & (lum > 0.6); ml = np.median(lum[stoff]) if stoff.any() else 0.85
    logo = oben & ((sat >= 0.06) | (lum < 0.62)) & (lum > 0.15)
    from scipy import ndimage
    logo = ndimage.binary_dilation(logo, iterations=4) & oben & (lum > 0.15)
    lum2 = np.where(logo, ml, lum)
    rel = np.clip(lum2/ml, 0, 1.2)[..., None]
    a = np.where(oben[..., None], np.array(shirt)*rel, a)
    unten = ~oben & (sat > 0.05)                                       # Jeans: Helligkeitsstruktur behalten, Farbe der Hose
    rh = np.clip(lum/np.median(lum[unten]), 0, 1.6)[..., None] if unten.any() else 1
    a = np.where(unten[..., None], np.array(hose)*rh, a)
    im = Image.fromarray((np.clip(a, 0, 1)*255 + 0.5).astype(np.uint8))
    if aufdruck:                                                       # gestickter Schriftzug auf der Brust (helles Garn, dezent)
        from PIL import ImageDraw, ImageFont
        text, (fx, fy), hoehe = aufdruck
        f = ImageFont.truetype(r'C:\Windows\Fonts\segoeprb.ttf', int(H*hoehe))
        d = ImageDraw.Draw(im); d.text((int(H*fx), int(H*fy)), text, font=f, fill=(226, 214, 218), anchor='mm')
    im.save(p)
    return f'clothes/{name}/{basis}.mhclo'

def kleidung_umfaerben(name, basis, farbe):
    """Grünliche Jacke (male_casualsuit05) in eine Lederfarbe umfärben; Hemd, Hose und braune Besätze bleiben."""
    ziel = os.path.join(DATA, 'clothes', name)
    if os.path.isdir(ziel): shutil.rmtree(ziel)
    shutil.copytree(os.path.join(DATA, 'clothes', basis), ziel)
    p = os.path.join(ziel, basis + '_diffuse.png'); a = np.asarray(Image.open(p).convert('RGB'), dtype=np.float32)/255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]; lum = a.mean(-1)
    gruen = (g >= r - 0.01) & (g >= b - 0.03) & (lum > 0.12)
    ml = np.median(lum[gruen]) if gruen.any() else 0.5
    neu = np.array(farbe)*np.clip(lum/ml, 0, 1.8)[..., None]
    a = np.where(gruen[..., None], neu, a)
    Image.fromarray((np.clip(a, 0, 1)*255 + 0.5).astype(np.uint8)).save(p)
    return f'clothes/{name}/{basis}.mhclo'

def ganz_umfaerben(name, basis, farbe):
    """Kleidungsstück komplett in eine Farbe umfärben, Helligkeitsstruktur (Falten, Nähte) bleibt."""
    ziel = os.path.join(DATA, 'clothes', name)
    if os.path.isdir(ziel): shutil.rmtree(ziel)
    shutil.copytree(os.path.join(DATA, 'clothes', basis), ziel)
    p = os.path.join(ziel, basis + '_diffuse.png'); a = np.asarray(Image.open(p).convert('RGB'), dtype=np.float32)/255
    lum = a.mean(-1); m = np.median(lum[lum > 0.1]); a = np.array(farbe)*np.clip(lum/m, 0, 1.8)[..., None]
    Image.fromarray((np.clip(a, 0, 1)*255 + 0.5).astype(np.uint8)).save(p)
    return f'clothes/{name}/{basis}.mhclo'

def umfaerben(name, basis, farbe):
    """Beliebiges Kleidungsstück (auch aus den Community-Paketen) komplett umfärben: alle Farbbilder im Ordner, Normalen-/Glanzbilder bleiben."""
    quelle = os.path.join(DATA, 'clothes', basis); ziel = os.path.join(DATA, 'clothes', name)
    if os.path.isdir(ziel): shutil.rmtree(ziel)
    shutil.copytree(quelle, ziel)
    for f in os.listdir(ziel):
        if not f.lower().endswith('.png') or any(k in f.lower() for k in ('norm', 'nrm', 'spec', '_ao', 'bump', 'rough')): continue
        p = os.path.join(ziel, f); im = Image.open(p); alpha = im.getchannel('A') if im.mode == 'RGBA' else None
        a = np.asarray(im.convert('RGB'), dtype=np.float32)/255; lum = a.mean(-1); m = np.median(lum[lum > 0.05]) if (lum > 0.05).any() else 0.5
        a = np.array(farbe)*np.clip(lum/m, 0, 1.8)[..., None]; out = Image.fromarray((np.clip(a, 0, 1)*255 + 0.5).astype(np.uint8))
        if alpha is not None: out.putalpha(alpha)
        out.save(p)
    mh = [f for f in os.listdir(ziel) if f.endswith('.mhclo')][0]
    return f'clothes/{name}/{mh}'

def muster(name, basis, art, farben):
    """Kleidungsstück mit Stoffmuster im Texturraum: 'karo' (Flanell, Farben: Grund + Streifen) oder 'tupfen' (helles Hemd mit kleinen Strichen).
    Die Helligkeit des Originals (Falten, Nähte) bleibt erhalten."""
    quelle = os.path.join(DATA, 'clothes', basis); ziel = os.path.join(DATA, 'clothes', name)
    if os.path.isdir(ziel): shutil.rmtree(ziel)
    shutil.copytree(quelle, ziel); rng = np.random.default_rng(7)
    for f in os.listdir(ziel):
        if not f.lower().endswith('.png') or any(k in f.lower() for k in ('norm', 'nrm', 'spec', '_ao', 'bump', 'rough')): continue
        p = os.path.join(ziel, f); im = Image.open(p); alpha = im.getchannel('A') if im.mode == 'RGBA' else None
        a = np.asarray(im.convert('RGB'), dtype=np.float32)/255; H, W = a.shape[:2]; lum = a.mean(-1)
        sh = np.clip(lum/np.median(lum[lum > 0.05]), 0.4, 1.4)[..., None]
        y, x = np.mgrid[0:H, 0:W]/H
        if art == 'karo':
            grund, *str_ = [np.array(c, dtype=np.float32) for c in farben]; t = grund*np.ones((H, W, 3), np.float32)
            P = 0.055                                                              # Rapport im Texturraum
            for k, c in enumerate(str_):
                bx = ((x*1/P + k*0.37) % 1) < (0.28 if k == 0 else 0.1); by = ((y*1/P + k*0.29) % 1) < (0.28 if k == 0 else 0.1)
                t = np.where((bx | by)[..., None], t*0.45 + c*0.55, t); t = np.where((bx & by)[..., None], t*0.7 + c*0.3, t)
        else:
            t = np.array(farben[0], dtype=np.float32)*np.ones((H, W, 3), np.float32)
            n = int(H*W/180); ys, xs = rng.integers(0, H, n), rng.integers(0, W, n)
            for dy, dx in ((0, 0), (0, 1), (1, 1)): t[np.clip(ys + dy, 0, H - 1), np.clip(xs + dx, 0, W - 1)] = farben[1]
        out = Image.fromarray((np.clip(t*sh, 0, 1)*255 + 0.5).astype(np.uint8))
        if alpha is not None: out.putalpha(alpha)
        out.save(p)
    mh = [f for f in os.listdir(ziel) if f.endswith('.mhclo')][0]
    return f'clothes/{name}/{mh}'

FIGUREN = {
    'udo': lambda: {        # etwa 55 Jahre, 1,85 m, 108 kg; rundes, volles Gesicht, kurze braune Haare mit hoher Stirn, blaue Augen, glatt rasiert, weinrotes Polo
        'makro': {'gender': 1.0, 'age': 0.82, 'muscle': 0.42, 'weight': 0.95, 'height': 0.72, 'proportions': 0.45,
                  'race': {'african': 0.0, 'asian': 0.0, 'caucasian': 1.0}},
        'ziele': {'stomach/stomach-pregnant-incr': 0.45, 'head/head-round': 0.5, 'head/head-fat-incr': 0.6, 'cheek/l-cheek-volume-incr': 0.5,
                  'cheek/r-cheek-volume-incr': 0.5, 'neck/neck-double-incr': 0.35, 'forehead/forehead-scale-vert-incr': 0.3},
        'haut': 'skins/old_caucasian_male/old_caucasian_male.mhmat',      # ältere Haut (Falten, Augenringe): wirkt wie Ende 50
        'haarfarbe': [0.36, 0.27, 0.2], 'augen': 'blue',
        'assets': [['eyes/low-poly/low-poly.mhclo', 'Eyes'], ['eyebrows/eyebrow001/eyebrow001.mhclo', 'Eyebrows'],
                   ['eyelashes/eyelashes01/eyelashes01.mhclo', 'Eyelashes'],
                   ['hair/short02/short02.mhclo', 'Hair'],
                   [kleidung('udo_kleidung', 'male_casualsuit06', shirt=[0.42, 0.1, 0.17], hose=[0.19, 0.2, 0.23], aufdruck=('Peters Strandarena', (0.205, 0.17), 0.0085)), 'Clothes'],
                   ['clothes/shoes01/shoes01.mhclo', 'Clothes']]},
    'kalle': lambda: {      # 27 Jahre, 1,86 m, 75 kg; Punk im Steampunk-Look: schwarzer Irokese (Seiten rasiert), Bart um den Mund,
                            # Messing-Schutzbrille auf der Stirn, dunkelbraune Lederjacke, dunkle Hose, schwere Schuhe; keine Brille
        'makro': {'gender': 1.0, 'age': 0.52, 'muscle': 0.55, 'weight': 0.4, 'height': 0.74, 'proportions': 0.6,
                  'race': {'african': 0.0, 'asian': 0.0, 'caucasian': 1.0}},
        'ziele': {'head/head-oval': 0.4, 'chin/chin-prominent-incr': 0.3, 'cheek/l-cheek-bones-incr': 0.3, 'cheek/r-cheek-bones-incr': 0.3},
        'haut': 'skins/young_caucasian_male/young_caucasian_male.mhmat', 'augen': 'green',
        'zusatz': {'irokese': [0.025, 0.022, 0.022], 'brille': True},
        'assets': [['eyes/low-poly/low-poly.mhclo', 'Eyes'], ['eyebrows/eyebrow010/eyebrow010.mhclo', 'Eyebrows'],
                   ['eyelashes/eyelashes01/eyelashes01.mhclo', 'Eyelashes'],
                   [kleidung('kalle_kleidung', 'male_casualsuit05', shirt=[0.3, 0.17, 0.09], hose=[0.12, 0.11, 0.1]), 'Clothes'],
                   ['clothes/mindfront_shoes_biker_boots_male/mindfront_shoes_biker_boots_male.mhclo', 'Clothes']]},
    'spielerarm': lambda: {  # eigene rechte Hand mit dunkelblauem Hemdärmel (nur Unterarm, Hand, Finger)
        'makro': {'gender': 1.0, 'age': 0.5, 'muscle': 0.5, 'weight': 0.5, 'height': 0.6, 'proportions': 0.5,
                  'race': {'african': 0.0, 'asian': 0.0, 'caucasian': 1.0}},
        'haut': 'skins/young_caucasian_male/young_caucasian_male.mhmat', 'nur_arm': True,
        'assets': [[ganz_umfaerben('spieler_hemd', 'male_casualsuit01', [0.08, 0.12, 0.26]), 'Clothes']]},
    'anna': lambda: {       # sehr schlank, etwa 1,65 m, um die 30; sehr lange dunkelblonde Haare zum Pferdeschwanz gebunden, dunkle Kleidung, kein Kittel
        'makro': {'gender': 0.0, 'age': 0.55, 'muscle': 0.45, 'weight': 0.25, 'height': 0.3, 'proportions': 0.6,
                  'race': {'african': 0.0, 'asian': 0.0, 'caucasian': 1.0}},
        'haut': 'skins/young_caucasian_female/young_caucasian_female.mhmat', 'augen': 'bluegreen',
        'haarfarbe': [0.55, 0.43, 0.27],
        'assets': [['eyes/low-poly/low-poly.mhclo', 'Eyes'], ['eyebrows/eyebrow002/eyebrow002.mhclo', 'Eyebrows'],
                   ['eyelashes/eyelashes02/eyelashes02.mhclo', 'Eyelashes'], ['hair/ponytail01/ponytail01.mhclo', 'Hair'],
                   [umfaerben('anna_pulli', 'mindfront_knitted_sweater_01', [0.17, 0.18, 0.2]), 'Clothes'],
                   [umfaerben('anna_jeans', 'punkduck_female_tight_jeans', [0.1, 0.11, 0.14]), 'Clothes'],
                   ['clothes/punkduck_female_half-boots/punkduck_female_half-boots.mhclo', 'Clothes']]},
    'dok': lambda: {        # Doktorand im Tank: Ende 20, wuschelige dunkelblonde Haare, moderne Brille, helle Laborjacke, Jeans, Turnschuhe
        'makro': {'gender': 1.0, 'age': 0.53, 'muscle': 0.45, 'weight': 0.45, 'height': 0.62, 'proportions': 0.55,
                  'race': {'african': 0.0, 'asian': 0.0, 'caucasian': 1.0}},
        'haut': 'skins/young_caucasian_male2/young_caucasian_male2.mhmat', 'augen': 'brownlight',
        'haarfarbe': [0.5, 0.4, 0.28],
        'assets': [['eyes/low-poly/low-poly.mhclo', 'Eyes'], ['eyebrows/eyebrow003/eyebrow003.mhclo', 'Eyebrows'],
                   ['eyelashes/eyelashes01/eyelashes01.mhclo', 'Eyelashes'], ['hair/cortu_short_messy_hair/cortu_short_messy_hair.mhclo', 'Hair'],
                   [umfaerben('dok_jacke', 'elvs_emt_uniform_jacket_male', [0.9, 0.9, 0.88]), 'Clothes'],
                   ['clothes/punkduck_male_classic_jeans/punkduck_male_classic_jeans.mhclo', 'Clothes'],
                   ['clothes/punkduck_comfortable_sneakers/punkduck_comfortable_sneakers.mhclo', 'Clothes'],
                   ['clothes/punkduck_glasses_modern_form/punkduck_glasses_modern_form.mhclo', 'Clothes']]},
    'kollege_karo': lambda: {   # Typ "Kölner Proll": Mitte 30, etwa 1,78 m, kräftig, kurze dunkelbraune Haare mit Geheimratsecken,
                                # schwarze eckige Brille, markanter Hufeisen-Schnurrbart, kariertes Flanellhemd, Jeans
        'makro': {'gender': 1.0, 'age': 0.6, 'muscle': 0.55, 'weight': 0.65, 'height': 0.48, 'proportions': 0.45,
                  'race': {'african': 0.0, 'asian': 0.0, 'caucasian': 1.0}},
        'ziele': {'head/head-round': 0.45, 'head/head-fat-incr': 0.3, 'forehead/forehead-scale-vert-incr': 0.5, 'neck/measure-neck-circ-incr': 0.4,
                  'stomach/stomach-pregnant-incr': 0.2},
        'haut': 'skins/young_caucasian_male/young_caucasian_male.mhmat', 'augen': 'brown', 'haarfarbe': [0.25, 0.17, 0.11],
        'assets': [['eyes/low-poly/low-poly.mhclo', 'Eyes'], ['eyebrows/eyebrow004/eyebrow004.mhclo', 'Eyebrows'],
                   ['eyelashes/eyelashes01/eyelashes01.mhclo', 'Eyelashes'], ['hair/short04/short04.mhclo', 'Hair'],
                   [muster('karo_hemd', 'elvs_male_shirt_untucked_bd1', 'karo', [[0.55, 0.12, 0.1], [0.22, 0.3, 0.45], [0.85, 0.65, 0.15], [0.12, 0.12, 0.14]]), 'Clothes'],
                   ['clothes/punkduck_male_classic_jeans/punkduck_male_classic_jeans.mhclo', 'Clothes'],
                   ['clothes/spamrakuen_tbm_glasses_frames_01/spamrakuen_tbm_glasses_frames_01.mhclo', 'Clothes'],
                   ['clothes/shoes01/shoes01.mhclo', 'Clothes']]},
}

namen = sys.argv[1:] or list(FIGUREN)
for n in namen:
    b = FIGUREN[n](); jp = os.path.join(ARB, n + '.json'); json.dump(b, open(jp, 'w', encoding='utf-8'))
    glb = os.path.join(ARB, n + '.glb')
    r = subprocess.run([BLENDER, '-b', '--factory-startup', '-P', os.path.join(ROOT, 'tools', 'mh_figur.py'), '--', jp, glb], capture_output=True, text=True, encoding='utf-8', errors='replace')
    open(os.path.join(ARB, n + '.log'), 'w', encoding='utf-8').write(r.stdout + r.stderr)
    if not os.path.exists(glb) or 'EXPORT' not in r.stdout: sys.exit(f'{n}: Blender fehlgeschlagen, siehe {ARB}\\{n}.log\n' + (r.stdout + r.stderr)[-2500:])
    print(n, os.path.getsize(glb)//1024, 'KB')

# alle vorhandenen Figuren packen
out = {os.path.basename(p)[:-4]: base64.b64encode(open(p, 'rb').read()).decode() for p in sorted(glob.glob(os.path.join(ARB, '*.glb')))}
dst = os.path.join(ROOT, 'prototype', 'cad', 'figuren_data.js')
with open(dst, 'w', encoding='utf-8') as f:
    f.write('// erzeugt von tools/figuren.py (MakeHuman/MPFB in Blender, Bausteine CC0) - Spielfiguren als GLB (Base64)\n')
    f.write('window.FIGUREN=' + json.dumps(out, separators=(',', ':')) + ';\n')
print('->', dst, os.path.getsize(dst)//1024, 'KB')
