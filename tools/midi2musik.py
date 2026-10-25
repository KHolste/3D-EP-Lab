# Rendert die Musik des RPG-Maker-Originals (MIDI) mit einem SoundFont zu OGG und bettet sie als Daten ein,
# damit sie im Browser auch per Doppelklick laedt (MIDI spielt kein Browser von sich aus ab).
#   python tools\midi2musik.py <soundfont.sf2> [prototype\cad\musik.js]
#   braucht: pip install tinysoundfont soundfile mido numpy; SoundFont z. B. GeneralUser GS
# Stuecke wie im Original: Hintergrundmusik 014-Theme03 (Map001, Autorun), Sieg 002-Victory02, Game Over 006-Defeat02.
# Der RPG Maker wiederholt ein Stueck ab der Marke Controller 111; die Stelle steht als "loop" (Sekunden) in der Ausgabe.
import sys, os, io, base64, json
import numpy as np, mido, soundfile as sf, tinysoundfont

SF2 = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join('prototype', 'cad', 'musik.js')
AUDIO = os.path.join('original', 'Jumbo-Pumpdown', 'Audio')
STUECKE = {'theme': ('BGM', '014-Theme03', True), 'sieg': ('ME', '002-Victory02', False), 'gameover': ('ME', '006-Defeat02', False)}
SR, TAIL = 44100, 4.0

def loop_start(path):
    m = mido.MidiFile(path); t = 0.0; tempo = 500000
    for e in mido.merge_tracks(m.tracks):
        t += mido.tick2second(e.time, m.ticks_per_beat, tempo)
        if e.type == 'set_tempo': tempo = e.tempo
        if e.type == 'control_change' and e.control == 111: return t, m.length
    return 0.0, m.length

def render(path, seconds):
    synth = tinysoundfont.Synth(samplerate=SR); synth.sfload(SF2)
    seq = tinysoundfont.Sequencer(synth); seq.midi_load(path)
    out = []; n = 0; total = int(seconds*SR); block = 441
    while n < total:
        seq.process(block/SR)
        out.append(np.frombuffer(bytes(synth.generate(block)), dtype=np.float32).reshape(-1, 2).copy()); n += block
    return np.concatenate(out)[:total]

res = {}; peak = 0; roh = {}
for key, (ordner, name, loop) in STUECKE.items():
    path = os.path.join(AUDIO, ordner, name + '.mid'); ls, length = loop_start(path)
    a = render(path, length + TAIL); n = int(length*SR)
    if loop:                                    # Ausklang des Endes in den Anfang der Schleife mischen: nahtlose Wiederholung
        i = int(ls*SR); tail = a[n:]; a = a[:n]; a[i:i+len(tail)] += tail
    else:
        a[-SR//2:] *= np.linspace(1, 0, SR//2)[:, None]
    roh[key] = (a, ls if loop else None, name); peak = max(peak, float(np.abs(a).max()))
for key, (a, ls, name) in roh.items():
    a = a/peak*0.89                             # gemeinsam aussteuern: Lautstaerkeverhaeltnis der Stuecke bleibt
    buf = io.BytesIO()
    with sf.SoundFile(buf, 'w', SR, 2, format='OGG', subtype='VORBIS', compression_level=0.4) as f:
        for i in range(0, len(a), SR): f.write(a[i:i+SR])
    res[key] = {'name': name, 'src': 'data:audio/ogg;base64,' + base64.b64encode(buf.getvalue()).decode()}
    if ls is not None: res[key]['loop'] = round(ls, 4); res[key]['ende'] = round(len(a)/SR, 4)
    print(key, name, '%.1f s' % (len(a)/SR), '%d kB' % (len(buf.getvalue())//1024))
with open(OUT, 'w', encoding='utf8', newline='\n') as f:
    f.write('// Musik aus dem RPG-Maker-Original, erzeugt von tools/midi2musik.py - nicht von Hand bearbeiten\n')
    f.write('window.MUSIK=' + json.dumps(res, separators=(',', ':')) + ';\n')
