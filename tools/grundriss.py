# Liest den Grundriss des Gebaeudes (docs/grundriss.png) und schreibt die Waende der Nachbarraeume fuer das Spiel
# als prototype/cad/raeume_data.js (per <script> ladbar, funktioniert daher auch bei Doppelklick auf die HTML-Datei).
# Aufruf: python tools\grundriss.py [docs\grundriss.png] [prototype\cad\raeume_data.js]
#   braucht: pip install pillow numpy scipy
#
# Im Plan sind Waende mittelgrau, Tueroeffnungen hellgrau, Tuerboegen, Fenster und Schrift dunkel.
# Mittelgrau wird Wand, Hellgrau ein Tuersturz ueber einer freien Oeffnung. Die Aussenwand mit den Fenstern wird durchgehend geschlossen.
# Die Jumbo-Halle (Raum 07) ist schon im Spiel und wird ausgespart; ihre Innenkanten im Plan legen den Massstab fest:
#   Plan unten = Hallentor = Osten im Spiel (+x), Plan links = +z (dort liegt die Tuer von 09 in die Halle).
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = sys.argv[1] if len(sys.argv) > 1 else 'docs/grundriss.png'
DST = sys.argv[2] if len(sys.argv) > 2 else 'prototype/cad/raeume_data.js'

# Innenkanten von Raum 07 im Plan (Pixel) und im Spiel (Meter)
PX07 = (1114, 1348)      # Plan x links .. rechts  ->  Spiel z +6 .. -6
PY07 = (14, 297)         # Plan y oben .. unten    ->  Spiel x -15.38 .. -0.3
GX = (-15.38, -0.3); GZ = (6.0, -6.0)
SX = (GX[1]-GX[0])/(PY07[1]-PY07[0]); SZ = (GZ[1]-GZ[0])/(PX07[1]-PX07[0])
gx = lambda py: GX[0] + (py - PY07[0])*SX          # Pixelkante -> Spiel x
gz = lambda px: GZ[0] + (px - PX07[0])*SZ          # Pixelkante -> Spiel z
HALLE_PX = 1104          # ab hier (Wand zwischen 09/06/017 und 07 eingeschlossen) beginnt die Halle; die Wand selbst kommt aus dem Plan
Z_MIN = 6.05             # nichts naeher an die Halle als bis kurz hinter ihre Innenwand (die CAD-Wand liegt bei z 6.0 bis 6.3)

# Raumnummern: Lage der Beschriftung im Plan (Pixel), daraus wird ein Schild auf dem Boden
LABELS = {'018':(95,27), '01':(537,23), '02':(662,23), '03':(726,24), '04a':(808,17), '04':(788,74), '020':(926,22),
          '06':(990,22), '08a':(28,134), '08':(322,126), '08b':(609,128), '05':(874,151), '09':(1005,133), '010':(28,175),
          '011':(538,179), '013':(728,173), '012':(793,175), '014a':(929,180), '015':(985,182), '016':(1032,181),
          '019':(279,218), '011a':(536,250), '017':(992,230), '014':(928,283)}

g = np.array(Image.open(SRC).convert('L')).astype(int)
H, W = g.shape

wall = (g >= 135) & (g <= 205)
# Aussenwand mit Fenstern (oben, unten, links) durchgehend schliessen
wall[5:11, 10:HALLE_PX] = True; wall[311:318, 10:HALLE_PX] = True; wall[5:318, 11:18] = True
# Dunkle Linien (Tuerboegen) haben grau geglaettete Raender: einzelne Pixelreihen entfernen (Oeffnen mit 2x2)
def opening(m):
    e = m[:-1, :-1] & m[1:, :-1] & m[:-1, 1:] & m[1:, 1:]
    o = np.zeros_like(m); o[:-1, :-1] |= e; o[1:, :-1] |= e; o[:-1, 1:] |= e; o[1:, 1:] |= e
    return o
wall = opening(wall)
wall = ndimage.binary_closing(wall, np.ones((1, 5))) | ndimage.binary_closing(wall, np.ones((5, 1)))   # kleine Luecken, wo Treppenlinien die Wand kreuzen
door = opening((g > 205) & (g <= 240)) & ~wall
for m in (wall, door): m[:, HALLE_PX+10:] = False          # Halle (07) ab ihrer Westwand aussparen
# Tueroeffnungen sind hellgrau umrandet: jede Umrandung wird ein voller Sturz ueber ihrer ganzen Flaeche
lab, n = ndimage.label(ndimage.binary_dilation(door, np.ones((3, 3))))
door = np.zeros_like(door)
for sl in ndimage.find_objects(lab): door[sl] = True
door &= ~wall

def rects(m):
    """Maske in Rechtecke zerlegen: Laeufe je Zeile, gleiche Laeufe untereinander zusammenfassen."""
    out, open_ = [], {}
    for y in range(H + 1):
        runs = set()
        if y < H:
            row = m[y]; x = 0
            while x < W:
                if row[x]:
                    x0 = x
                    while x < W and row[x]: x += 1
                    runs.add((x0, x))
                else: x += 1
        for r in list(open_):
            if r not in runs: out.append((r[0], open_.pop(r), r[1], y))
        for r in runs:
            if r not in open_: open_[r] = y
    return out                                              # (px0, py0, px1, py1), Kanten in Pixeln

def to_game(r, minsize=0.0):
    px0, py0, px1, py1 = r
    x0, x1 = gx(py0), gx(py1); z0, z1 = sorted((gz(px0), gz(px1)))
    z0 = max(z0, Z_MIN)
    if z1 - z0 < minsize or x1 - x0 < minsize: return None
    return [round(x0, 3), round(x1, 3), round(z0, 3), round(z1, 3)]

walls = [w for w in (to_game(r, 0.02) for r in rects(wall)) if w]
doors = [d for d in (to_game(r, 0.04) for r in rects(door)) if d]
# Tuer von 09 in die Halle: Lage und Hoehe nach der Oeffnung in der CAD-Wand, nicht nach dem Plan
HD = (-10.15, -8.2, 6.6)                                   # x von .. bis, Wandbereich bis z
def cut(r):
    x0, x1, z0, z1 = r
    if z0 >= HD[2] or x1 <= HD[0] or x0 >= HD[1]: return [r]
    return [p for p in ([x0, min(x1, HD[0]), z0, z1], [max(x0, HD[1]), x1, z0, z1]) if p[1] - p[0] > 0.02]
walls = [p for w in walls for p in cut(w)]
ZW = round(gz(HALLE_PX), 3)                                 # Wand zur Halle: im Plan breiter offen als im CAD, Reste schliessen
walls += [[HD[0] - 0.6, HD[0], Z_MIN, ZW], [HD[1], HD[1] + 0.6, Z_MIN, ZW]]
doors = [p for d in doors for p in cut(d)] + [[HD[0], HD[1], Z_MIN, ZW, 2.1]]   # 5. Wert: Unterkante des Sturzes
# Flure: freie Flaeche um die Beschriftung von 05, 08 und 08b (Tueroeffnungen gelten als Grenze); 05 schliesst das offene Treppenhaus 020 ein
FLURE = ['05', '08', '08b']
frei, _ = ndimage.label(~(wall | door))
flur = np.zeros_like(wall)
for k in FLURE:
    px, py = LABELS[k]; flur |= frei == frei[py + 4, px + 4]
flur = ndimage.binary_dilation(flur, np.ones((3, 3))) & ~door      # Boden ein Pixel unter die Wand schieben, keine Fuge
flure = [f for f in (to_game(r, 0.02) for r in rects(flur)) if f]
# Raeume, die nach Fotos eingerichtet sind: weiss gestrichen, eigener Boden (Lage wie bei den Fluren aus der Beschriftung)
WEISS = ['019', '016']
weiss = np.zeros_like(wall)
for k in WEISS:
    px, py = LABELS[k]; weiss |= frei == frei[py + 4, px + 4]
weiss = ndimage.binary_dilation(weiss, np.ones((3, 3))) & ~door
weiss_r = [f for f in (to_game(r, 0.02) for r in rects(weiss)) if f]
bx0, bx1 = gx(5), gx(318); bz1, bz0 = gz(10), Z_MIN
labels = {k: [round(gx(py + 6), 2), round(gz(px + 8), 2)] for k, (px, py) in LABELS.items()}
out = {'walls': walls, 'doors': doors, 'flure': flure, 'weiss': weiss_r, 'floor': [round(bx0, 2), round(bx1, 2), round(bz0, 2), round(bz1, 2)], 'labels': labels}
with open(DST, 'w', encoding='utf-8') as f:
    f.write('// erzeugt von tools/grundriss.py aus docs/grundriss.png - nicht von Hand bearbeiten\n')
    f.write('// walls/doors: [x0, x1, z0, z1] in Metern (Spielkoordinaten), floor: Ausdehnung des Gebaeudes, labels: Raumnummer -> [x, z]\n')
    f.write('window.RAEUME=' + json.dumps(out, separators=(',', ':')) + ';\n')
print(f'{len(walls)} Wandstuecke, {len(doors)} Tuerstuerze, {len(flure)} Flurstuecke, Gebaeude x {bx0:.2f}..{bx1:.2f} z {bz0:.2f}..{bz1:.2f} m -> {DST}')

if '--png' in sys.argv:                                     # Kontrollbild: Waende schwarz, Tuerstuerze rot
    v = np.full((H, W, 3), 255, np.uint8); v[flur] = (150, 200, 255); v[wall] = 0; v[door] = (220, 40, 40)
    Image.fromarray(v).save(sys.argv[sys.argv.index('--png') + 1])
