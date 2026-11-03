# Vorberechnetes Licht fuer die Nachbarraeume (Lightmap):
#   1) exportiert die unbeweglichen Raumteile aus dem Spiel (Edge ohne Fenster, jumbo3d_lite.html?bakeexport=1),
#   2) laesst Blender (Cycles) das Licht berechnen (tools/blender_licht.py),
#   3) packt Lightmap und Lightmap-Koordinaten als prototype/cad/licht_data.js (per <script> ladbar, auch bei Doppelklick).
# Aufruf: python tools\lichtbake.py [--groesse 2048] [--samples 128] [--arbeit ordner]
#   braucht: Blender, Microsoft Edge, pip install pillow numpy scipy
# Nach Aenderungen an den Raeumen (raeume.js, Grundriss) neu ausfuehren; Objekte, deren Punktzahl nicht mehr passt,
# bekommen im Spiel einfach kein vorberechnetes Licht.
import sys, os, re, json, base64, io, glob, html, argparse, subprocess, shutil, time
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('--groesse', type=int, default=2048)
ap.add_argument('--samples', type=int, default=128)
ap.add_argument('--arbeit', default=os.path.join('tools', '_bake'))
ap.add_argument('--blender', default=None)
ap.add_argument('--nur-packen', action='store_true', help='Blender nicht neu starten, vorhandene Ergebnisse packen')
ap.add_argument('--glaetten', type=float, default=1.2, help='Unschaerfe gegen Rauschen (Texel)')
A = ap.parse_args()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARB = os.path.abspath(A.arbeit); os.makedirs(ARB, exist_ok=True)
DST = os.path.join(ROOT, 'prototype', 'cad', 'licht_data.js')

def finde(namen, muster):
    for n in namen:
        p = shutil.which(n)
        if p: return p
    for m in muster:
        t = sorted(glob.glob(m))
        if t: return t[-1]
    sys.exit('nicht gefunden: ' + ', '.join(namen))

if not A.nur_packen:
    # 1) Export aus dem Spiel
    edge = finde(['msedge'], [r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'])
    url = 'file:///' + os.path.join(ROOT, 'prototype', 'jumbo3d_lite.html').replace('\\', '/') + '?bakeexport=1&q=0'
    prof = os.path.join(ARB, 'edgeprofil'); shutil.rmtree(prof, ignore_errors=True)
    dom = subprocess.run([edge, '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', f'--user-data-dir={prof}',
                          '--virtual-time-budget=20000', '--dump-dom', url], capture_output=True, text=True, encoding='utf-8', errors='replace').stdout
    m = re.search(r'BAKEJSON (.*?) BAKEENDE', dom, re.S)
    if not m: sys.exit('Export fehlgeschlagen: ' + (re.search(r'BAKEFEHLER[^<]*', dom) or [''])[0][:500])
    exp = os.path.join(ARB, 'export.json')
    with open(exp, 'w', encoding='utf-8') as f: f.write(html.unescape(m.group(1)))
    d = json.load(open(exp, encoding='utf-8'))
    print(f"Export: {len(d['objekte'])} Objekte, {len(d['anker'])} Lampen")
    # 2) Blender
    blender = A.blender or finde(['blender'], [r'C:\Program Files\Blender Foundation\Blender*\blender.exe'])
    t0 = time.time()
    r = subprocess.run([blender, '-b', '--factory-startup', '-P', os.path.join(ROOT, 'tools', 'blender_licht.py'), '--',
                        exp, ARB, str(A.groesse), str(A.samples)], capture_output=True, text=True, encoding='utf-8', errors='replace')
    log = r.stdout + r.stderr
    open(os.path.join(ARB, 'blender.log'), 'w', encoding='utf-8').write(log)
    if 'fertig' not in r.stdout: sys.exit('Blender fehlgeschlagen, siehe ' + os.path.join(ARB, 'blender.log') + '\n' + log[-3000:])
    print(f'Blender: {time.time() - t0:.0f} s')

# 3) Packen: Licht (ohne Materialfarbe) -> 8 Bit mit Gamma, Skalierung merken; Bild in Spielrichtung (Zeile 0 = unten in Blender)
lm = np.load(os.path.join(ARB, 'lightmap.npy'))
# Rauschen glaetten: gewichtete Unschaerfe nur ueber berechnete Texel (leere Flaeche zwischen den Inseln bleibt aussen vor)
from scipy import ndimage
maske = (lm.sum(-1) > 1e-6).astype(np.float32)
w = ndimage.gaussian_filter(maske, A.glaetten)
lm = np.where(maske[..., None] > 0, np.dstack([ndimage.gaussian_filter(lm[..., k]*maske, A.glaetten) for k in range(3)])/np.maximum(w, 1e-6)[..., None], 0)
ecken = np.fromfile(os.path.join(ARB, 'ecken.bin'), dtype=np.float32).reshape(-1, 3)
werte = np.concatenate([lm[lm.sum(-1) > 1e-4], ecken[ecken.sum(-1) > 1e-4]])
skala = float(np.percentile(werte, 99.5)) if len(werte) else 1.0
enc = np.clip(lm/skala, 0, 1)**(1/2.2)
im = Image.fromarray((enc[::-1]*255 + 0.5).astype(np.uint8), 'RGB')
buf = io.BytesIO(); im.save(buf, 'WEBP', quality=90, method=6)
uvj = json.load(open(os.path.join(ARB, 'index.json'), encoding='utf-8'))
uvb = open(os.path.join(ARB, 'uv.bin'), 'rb').read()
eb = ((np.clip(ecken/skala, 0, 1)**(1/2.2))*255 + 0.5).astype(np.uint8).tobytes()   # Eckpunkt-Licht wie die Lightmap kodiert
with open(DST, 'w', encoding='utf-8') as f:
    f.write('// erzeugt von tools/lichtbake.py (Blender/Cycles) - vorberechnetes Licht der Nachbarraeume, nicht von Hand bearbeiten\n')
    f.write('// bild: Lightmap (Licht ohne Materialfarbe, Gamma 2.2, mal skala); uv: Float32-Lightmap-Koordinaten; ecken: Licht je Punkt (RGB 8 Bit, kodiert wie das Bild)\n')
    f.write('window.LICHT=' + json.dumps({'skala': skala, 'objekte': uvj['objekte'], 'uv': base64.b64encode(uvb).decode(), 'ecken': base64.b64encode(eb).decode(),
                                          'bild': 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()}, separators=(',', ':')) + ';\n')
print(f'-> {DST} ({os.path.getsize(DST)//1024} KB, Bild {len(buf.getvalue())//1024} KB, Skala {skala:.3g})')
