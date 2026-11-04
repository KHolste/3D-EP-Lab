# Jumbo-Pumpdown 3D

3D-Umsetzung von **Jumbo-Pumpdown: The Game**, einem RPG-Maker-XP-Spiel über das Evakuieren des Vakuumtanks „Jumbo“.
Du läufst durch die Halle, die aus dem CAD-Modell der Anlage und Fotos nachgebaut ist, und bedienst Pumpen, Ventile
und Klappen in der richtigen Reihenfolge. Dabei folgt der Tankdruck einer Simulation des Abpumpvorgangs.

> Der Jumbo muss evakuiert werden. Alle, die es sonst machen, sind nicht da. Doch das Schicksal des Neutralisators
> hängt davon ab – und nur du kannst ihn jetzt noch retten.

**Online spielen: https://kholste.github.io/3D-EP-Lab/**

## Spielen

Lokal: `index.html` im Hauptordner per Doppelklick öffnen und eine Variante wählen. Es braucht keinen Server,
aber eine Internetverbindung, weil three.js von jsDelivr geladen wird.

Die Spiele selbst liegen in `prototype/` und lassen sich auch direkt öffnen:

| Datei | Inhalt |
|---|---|
| `prototype/jumbo3d_lite.html` | **leichte Variante**: vereinfachtes CAD-Modell mit Fototexturen, läuft auch auf schwächeren Rechnern |
| `prototype/jumbo3d_cad.html` | **volle CAD-Variante**: detailliertes Hallenmodell (ca. 9 MB Daten) |
| `prototype/jumbo3d.html` | erster Prototyp ohne CAD-Modell |

### Steuerung

| Taste | Funktion |
|---|---|
| `W` `A` `S` `D` | gehen, mit `Shift` laufen |
| `←` `→` / `↑` `↓` | drehen / hoch und runter sehen |
| `E` / `Enter` | bedienen, ansprechen |
| `M` | Maussteuerung an/aus |
| `H` | Anleitung zum Evakuieren |
| `Tab` | Übersicht |
| `T` | Zeitraffer |
| `G` | Grafikqualität: niedrig, mittel, hoch, sehr hoch (Schatten der Raumlampen, Eckenabdunkelung; nur für eigene Grafikkarten) |
| `B` | Boden |
| `N` | Musik an/aus |
| `Esc` | Pause |

Im Doktorandenzimmer 06 liegt eine **Nerf-Gun** (mit `E` aufnehmen): linke Maustaste oder `X` = schießen, rechte Maustaste
halten oder `C` = anlegen, `F` = ziehen/wegstecken. Verschossene Pfeile sammelt man ein, indem man drüberläuft.

Anna (oben auf der Bühne) und Kalle (unten in der Halle) helfen weiter, wenn man sie anspricht.

Das Spiel beginnt im Vorraum 09 vor der Tür in die Halle. Neben der Halle (Raum 07) ist das übrige Gebäude nach dem Grundriss begehbar: Durch die Tür an der Längswand
neben der EMV-Kabine geht es nach Raum 09 und von dort in die Flure und Räume. Die Räume sind noch leer und
werden nach und nach anhand von Fotos eingerichtet (`prototype/raeume.js`). Im Treppenhaus 020 kann man bis zur (geschlossenen)
Tür ins 1. Obergeschoss hinaufgehen und in den Keller hinunter. Raum 019 ist nach einem Foto eingerichtet
(Fenster, Arbeitstische, Leuchten).

Licht und Grafik der Räume steuert `prototype/grafik.js`: Die Deckenleuchten beleuchten ihren Raum (wenige wandernde Lichtquellen
folgen dem Spieler), das Hallenlicht bleibt in der Halle, und unbewegliche Teile der Räume werden zu wenigen Objekten
zusammengefasst, damit es auch auf Onboard-Grafik flüssig läuft. Die Rechenauflösung ist je Grafikstufe begrenzt.
Ab Stufe „hoch“ bekommen alle Oberflächen je nach Materialklasse Struktur, Glanzunterschiede und Relief
(Texturen von ambientCG.com, CC0, aus drei Richtungen projiziert; Klasse von Hand per `material.userData.jgKlasse` oder geschätzt).
Das Licht der Räume und der Halle ist vorberechnet (`prototype/cad/licht_data.js`, erzeugt mit `python tools\lichtbake.py`, braucht Blender):
Wände, Böden und Decken haben eine Lightmap, kleinere Teile das Licht an ihren Eckpunkten. Figuren, bewegliche Raumtüren und Metall
bekommen weiter Echtzeitlicht. Kästen haben leicht gerundete Kanten (`RundBox` in den HTML-Dateien). Teile, die sich seit dem Vorberechnen geändert haben, fallen automatisch auf Echtzeitlicht zurück.
Wiederkehrende Gegenstände mit mehr Details (Bürostühle mit Polstern, Bügelgriffe, Papierkörbe, Kartons, belebte und
unordentliche Schreibtische wie Rodrigos in 06) baut `prototype/details.js`. Vor den Fenstern von Raum 06 liegt eine
einfache 3D-Umgebung (`prototype/aussen.js`): Rasen, Hecke, Bäume und das Nachbargebäude in etwa 15 m Abstand.

### Testmodi

Die Testmodi werden als URL-Parameter an die HTML-Datei angehängt:

- `?test=1`: Selbsttest
- `?walk=1`: Lauftest, prüft, dass jedes Bedienelement zu Fuß erreichbar ist
- `?cam=x,y,z,yaw,pitch&do=a,b&ff=min`: feste Kameraposition für Screenshots

## Aufbau des Repos

| Ordner | Inhalt |
|---|---|
| `original/` | das RPG-Maker-XP-Original (Spiel, Grafiken, Audio, Daten) |
| `extracted/` | aus dem Original extrahierte Daten: Maps, Events, Skripte als Text und JSON |
| `prototype/` | die 3D-Spiele (three.js) |
| `prototype/cad/` | erzeugte Daten: Hallenmodell, Nachbarräume, Texturen, Musik, CAD-Vorschau (`view.html`) |
| `tools/` | Python-Werkzeuge, die die Daten in `extracted/` und `prototype/cad/` erzeugen |
| `docs/` | Anleitung zum Abpumpvorgang, gemessene Pumpdown-Kurve, Fotos der Halle, Grundriss des Gebäudes |

## Werkzeuge

Alle Aufrufe gehen vom Repo-Wurzelordner aus.

| Skript | Zweck |
|---|---|
| `tools/extract_rxdata.py` | liest das RPG-Maker-Projekt (`.rxdata`) aus und schreibt `extracted/` |
| `tools/step2glb.py` | wandelt die STEP-Datei der Anlage in eine GLB um (braucht OpenCascade/OCP) |
| `tools/step_tess.py` | liest die tessellierten Bauteile (z. B. EMV-Kabine) direkt aus der STEP-Datei |
| `tools/glb_opt.py` | verschlankt die GLB zu `halle_data.js` bzw. mit `lite` zu `halle_lite.js` |
| `tools/fototex.py` | schneidet aus `docs/fotos` kachelbare Texturen für `tex_lite.js` |
| `tools/pbrtex.py` | lädt Oberflächentexturen (ambientCG, CC0) für Metall, Lack, Putz, Beton, Boden, Holz, Kunststoff und packt sie in `tex_pbr.js` |
| `tools/lichtbake.py` | berechnet das Licht der Nachbarräume vor (exportiert die Räume aus dem Spiel, Blender/Cycles mit `tools/blender_licht.py`) und schreibt `licht_data.js`; nach Änderungen an den Räumen neu ausführen |
| `tools/aussentex.py` | Texturen für die Umgebung vor den Fenstern (Rasen von ambientCG, Hecke und Fassade aus dem Fensterfoto) -> `tex_aussen.js` |
| `tools/tuertex.py` | entzerrt das Foto der Türanlage am Ende von Flur 05 zur Textur `tuer05` |
| `tools/postertex.py` | entzerrt die Poster am Ende von Flur 05 zu den Texturen `poster_*` |
| `tools/fenstertex.py` | baut aus dem Foto von Raum 019 die Fenstertextur `fenster019` |
| `tools/grundriss.py` | liest die Wände der Nachbarräume aus `docs/grundriss.png` und schreibt `raeume_data.js` |
| `tools/midi2musik.py` | rendert die MIDI-Musik des Originals mit einem SoundFont und schreibt `musik.js` |
| `tools/glbstat.py`, `tools/glblib.py` | Hilfen: Dreiecksstatistik und GLB-Leser |

Die Kette fürs Hallenmodell:

```
STEP ──step2glb.py──▶ halle_full.glb ──glb_opt.py──▶ halle_data.js / halle_lite.js
     └─step_tess.py─▶ tess_extra.npz ──┘
```

Die CAD-Werkzeuge laufen in einer eigenen Python-Umgebung unter `tools/cadenv/`, die nicht im Repo liegt.
`midi2musik.py` braucht `pip install tinysoundfont soundfile mido numpy` und einen SoundFont (z. B. GeneralUser GS).

### Nicht im Repo

Wegen der Dateigröße fehlen (siehe `.gitignore`):

- die STEP-Datei der Anlage (`*.stp`, ca. 120 MB, über dem Dateilimit von GitHub)
- `prototype/cad/halle_full.glb` (ca. 44 MB, wird mit `step2glb.py` daraus erzeugt)
- die Python-Umgebung `tools/cadenv/`

Die fertigen Spieldaten (`halle_data.js`, `halle_lite.js` usw.) liegen im Repo, zum Spielen wird also nichts davon gebraucht.
