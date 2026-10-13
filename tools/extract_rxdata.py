"""Extract an RPG Maker XP project (.rxdata, Ruby Marshal 4.8) into readable text.

Usage:  python tools/extract_rxdata.py [project_dir] [output_dir]
Defaults: project_dir = original, output_dir = extracted (relative to the repo root).

Output:
  scripts/NNN_Name.rb     Ruby (RGSS) scripts from Scripts.rxdata
  maps/MapNNN_Name.txt    events of each map as readable command listings
  common_events.txt       common events
  system.txt              switches, variables, start position, map list
  json/*.json             complete dump of every .rxdata file (except scripts)
"""
import json
import re
import struct
import sys
import zlib
from pathlib import Path


# ---------------------------------------------------------------- Ruby Marshal

class RObject:
    def __init__(self, cls, ivars=None):
        self.cls = cls
        self.ivars = ivars if ivars is not None else {}

    def __getitem__(self, name):
        return self.ivars.get('@' + name)

    def __repr__(self):
        return f'<{self.cls}>'


class RUser:
    """Object serialized through _dump (Table, Color, Tone)."""
    def __init__(self, cls, data):
        self.cls = cls
        self.data = data


class Symbol(str):
    pass


class MarshalReader:
    def __init__(self, data):
        self.d = data
        self.p = 0
        self.symbols = []
        self.objects = []

    def byte(self):
        b = self.d[self.p]
        self.p += 1
        return b

    def take(self, n):
        b = self.d[self.p:self.p + n]
        self.p += n
        return b

    def fixnum(self):
        c = struct.unpack('b', self.take(1))[0]
        if c == 0:
            return 0
        if 0 < c < 5:
            return int.from_bytes(self.take(c), 'little')
        if -5 < c < 0:
            n = -c
            return int.from_bytes(self.take(n), 'little') - (1 << (8 * n))
        return c - 5 if c > 0 else c + 5

    def bytestr(self):
        return self.take(self.fixnum())

    def load(self):
        major, minor = self.byte(), self.byte()
        if (major, minor) != (4, 8):
            raise ValueError(f'unsupported Marshal version {major}.{minor}')
        return self.read()

    def reserve(self):
        self.objects.append(None)
        return len(self.objects) - 1

    def symbol(self):
        t = chr(self.byte())
        if t == ':':
            s = Symbol(self.bytestr().decode('utf-8', 'replace'))
            self.symbols.append(s)
            return s
        if t == ';':
            return self.symbols[self.fixnum()]
        raise ValueError(f'expected symbol, got {t!r} at {self.p}')

    def read(self):
        t = chr(self.byte())
        if t == '0':
            return None
        if t == 'T':
            return True
        if t == 'F':
            return False
        if t == 'i':
            return self.fixnum()
        if t == ':':
            s = Symbol(self.bytestr().decode('utf-8', 'replace'))
            self.symbols.append(s)
            return s
        if t == ';':
            return self.symbols[self.fixnum()]
        if t == '@':
            return self.objects[self.fixnum()]
        if t == 'I':
            obj = self.read()
            for _ in range(self.fixnum()):
                self.symbol()
                self.read()
            return obj
        if t == 'e':
            self.symbol()
            return self.read()
        if t == 'C':
            self.symbol()
            return self.read()
        if t == '"':
            i = self.reserve()
            self.objects[i] = self.bytestr()
            return self.objects[i]
        if t == '/':
            i = self.reserve()
            self.objects[i] = self.bytestr()
            self.byte()
            return self.objects[i]
        if t == 'f':
            i = self.reserve()
            s = self.bytestr().split(b'\0')[0].decode('ascii')
            self.objects[i] = float({'nan': 'nan', 'inf': 'inf', '-inf': '-inf'}.get(s, s))
            return self.objects[i]
        if t == 'l':
            i = self.reserve()
            sign = chr(self.byte())
            n = int.from_bytes(self.take(self.fixnum() * 2), 'little')
            self.objects[i] = -n if sign == '-' else n
            return self.objects[i]
        if t == '[':
            arr = []
            self.objects[self.reserve()] = arr
            for _ in range(self.fixnum()):
                arr.append(self.read())
            return arr
        if t in '{}':
            h = {}
            self.objects[self.reserve()] = h
            for _ in range(self.fixnum()):
                k = self.read()
                if isinstance(k, bytes):
                    k = k.decode('utf-8', 'replace')
                h[k] = self.read()
            if t == '}':
                self.read()
            return h
        if t == 'o':
            obj = RObject(None)
            self.objects[self.reserve()] = obj
            obj.cls = str(self.symbol())
            for _ in range(self.fixnum()):
                k = self.symbol()
                obj.ivars[str(k)] = self.read()
            return obj
        if t == 'u':
            i = self.reserve()
            cls = str(self.symbol())
            self.objects[i] = RUser(cls, self.bytestr())
            return self.objects[i]
        if t == 'U':
            i = self.reserve()
            cls = str(self.symbol())
            self.objects[i] = RObject(cls, {'@__marshal__': self.read()})
            return self.objects[i]
        if t == 'S':
            obj = RObject(None)
            self.objects[self.reserve()] = obj
            obj.cls = str(self.symbol())
            for _ in range(self.fixnum()):
                k = self.symbol()
                obj.ivars['@' + str(k)] = self.read()
            return obj
        if t in 'cmM':
            i = self.reserve()
            self.objects[i] = self.bytestr().decode('utf-8', 'replace')
            return self.objects[i]
        raise ValueError(f'unknown Marshal type {t!r} at offset {self.p - 1}')


def load_rxdata(path):
    return MarshalReader(Path(path).read_bytes()).load()


def s(v):
    """Ruby string (bytes) -> str."""
    if isinstance(v, bytes):
        try:
            return v.decode('utf-8')
        except UnicodeDecodeError:
            return v.decode('cp1252', 'replace')
    return '' if v is None else str(v)


# ------------------------------------------------------------------ JSON dump

def to_json(v, seen=None):
    seen = seen or set()
    if isinstance(v, bytes):
        return s(v)
    if isinstance(v, (str, int, float, bool)) or v is None:
        return v
    if id(v) in seen:
        return '<circular>'
    seen = seen | {id(v)}
    if isinstance(v, list):
        return [to_json(x, seen) for x in v]
    if isinstance(v, dict):
        return {str(k): to_json(x, seen) for k, x in v.items()}
    if isinstance(v, RUser):
        if v.cls == 'Table':
            dim, x, y, z, size = struct.unpack_from('<5i', v.data)
            return {'__class__': 'Table', 'dim': dim, 'xsize': x, 'ysize': y, 'zsize': z,
                    'data': list(struct.unpack_from(f'<{size}h', v.data, 20))}
        if v.cls in ('Color', 'Tone'):
            return {'__class__': v.cls, 'values': list(struct.unpack('<4d', v.data))}
        return {'__class__': v.cls, 'hex': v.data.hex()}
    if isinstance(v, RObject):
        out = {'__class__': v.cls}
        for k, x in v.ivars.items():
            out[k.lstrip('@')] = to_json(x, seen)
        return out
    return repr(v)


# -------------------------------------------------------------- event decoder

TRIGGERS = ['Action Button', 'Player Touch', 'Event Touch', 'Autorun', 'Parallel Process']
MOVE_TYPES = ['Fixed', 'Random', 'Approach', 'Custom']
DIRS = {0: 'retain', 2: 'down', 4: 'left', 6: 'right', 8: 'up'}
OPS = ['=', '+=', '-=', '*=', '/=', '%=']
CMP = ['==', '>=', '<=', '>', '<', '!=']
BUTTONS = {2: 'DOWN', 4: 'LEFT', 6: 'RIGHT', 8: 'UP', 11: 'A', 12: 'B', 13: 'C', 14: 'X',
           15: 'Y', 16: 'Z', 17: 'L', 18: 'R'}

MOVE_CMDS = {
    1: 'Move Down', 2: 'Move Left', 3: 'Move Right', 4: 'Move Up', 5: 'Move Lower Left',
    6: 'Move Lower Right', 7: 'Move Upper Left', 8: 'Move Upper Right', 9: 'Move at Random',
    10: 'Move toward Player', 11: 'Move away from Player', 12: '1 Step Forward',
    13: '1 Step Backward', 14: 'Jump', 15: 'Wait', 16: 'Turn Down', 17: 'Turn Left',
    18: 'Turn Right', 19: 'Turn Up', 20: 'Turn 90 Right', 21: 'Turn 90 Left', 22: 'Turn 180',
    23: 'Turn 90 Right or Left', 24: 'Turn at Random', 25: 'Turn toward Player',
    26: 'Turn away from Player', 27: 'Switch ON', 28: 'Switch OFF', 29: 'Change Speed',
    30: 'Change Freq', 31: 'Move Animation ON', 32: 'Move Animation OFF',
    33: 'Stop Animation ON', 34: 'Stop Animation OFF', 35: 'Direction Fix ON',
    36: 'Direction Fix OFF', 37: 'Through ON', 38: 'Through OFF', 39: 'Always on Top ON',
    40: 'Always on Top OFF', 41: 'Change Graphic', 42: 'Change Opacity', 43: 'Change Blending',
    44: 'Play SE', 45: 'Script',
}

SIMPLE = {
    104: 'Change Text Options', 105: 'Button Input Processing', 112: 'Loop', 113: 'Break Loop',
    115: 'Exit Event Processing', 116: 'Erase Event', 131: 'Change Windowskin',
    132: 'Change Battle BGM', 133: 'Change Battle End ME', 134: 'Change Save Access',
    135: 'Change Menu Access', 136: 'Change Encounter', 202: 'Set Event Location',
    203: 'Scroll Map', 204: 'Change Map Settings', 205: 'Change Fog Color Tone',
    206: 'Change Fog Opacity', 207: 'Show Animation', 208: 'Change Transparent Flag',
    210: "Wait for Move's Completion", 221: 'Prepare for Transition',
    222: 'Execute Transition', 223: 'Change Screen Color Tone', 224: 'Screen Flash',
    225: 'Screen Shake', 231: 'Show Picture', 232: 'Move Picture', 233: 'Rotate Picture',
    234: 'Change Picture Color Tone', 235: 'Erase Picture', 236: 'Set Weather Effects',
    241: 'Play BGM', 242: 'Fade Out BGM', 245: 'Play BGS', 246: 'Fade Out BGS',
    247: 'Memorize BGM/BGS', 248: 'Restore BGM/BGS', 249: 'Play ME', 250: 'Play SE',
    251: 'Stop SE', 301: 'Battle Processing', 302: 'Shop Processing', 303: 'Name Input',
    311: 'Change HP', 312: 'Change SP', 313: 'Change State', 314: 'Recover All',
    315: 'Change EXP', 316: 'Change Level', 317: 'Change Parameters', 318: 'Change Skills',
    319: 'Change Equipment', 320: 'Change Actor Name', 321: 'Change Actor Class',
    322: 'Change Actor Graphic', 331: 'Change Enemy HP', 332: 'Change Enemy SP',
    333: 'Change Enemy State', 334: 'Enemy Recover All', 335: 'Enemy Appearance',
    336: 'Enemy Transform', 337: 'Show Battle Animation', 338: 'Deal Damage',
    339: 'Force Action', 340: 'Abort Battle', 351: 'Call Menu Screen',
    352: 'Call Save Screen', 353: 'Game Over', 354: 'Return to Title Screen',
    413: 'Repeat Above', 601: 'If Win', 602: 'If Escape', 603: 'If Lose',
}
SKIP = {404, 412, 509, 604, 605}  # block terminators / lines already shown by their parent


class Names:
    """Lookup tables for switch, variable, map, item, ... names."""
    def __init__(self, data_dir):
        self.data_dir = Path(data_dir)
        system = load_rxdata(self.data_dir / 'System.rxdata')
        self.system = system
        self.switches = [s(x) for x in system['switches']]
        self.variables = [s(x) for x in system['variables']]
        self.maps = {k: s(v['name']) for k, v in load_rxdata(self.data_dir / 'MapInfos.rxdata').items()}
        self.tables = {}
        for key in ('Items', 'Weapons', 'Armors', 'Actors', 'CommonEvents', 'Animations',
                    'Troops', 'Skills', 'States', 'Classes', 'Enemies'):
            f = self.data_dir / f'{key}.rxdata'
            arr = load_rxdata(f) if f.exists() else []
            self.tables[key] = {i: s(o['name']) for i, o in enumerate(arr) if o is not None}

    def _named(self, lst, i):
        name = lst[i] if isinstance(lst, list) and 0 <= i < len(lst) else lst.get(i, '') if isinstance(lst, dict) else ''
        return f'[{i:04d}: {name}]' if name else f'[{i:04d}]'

    def sw(self, i):
        return self._named(self.switches, i)

    def var(self, i):
        return self._named(self.variables, i)

    def of(self, table, i):
        return self._named(self.tables[table], i)

    def map(self, i):
        return self._named(self.maps, i)


def plain(v):
    """Compact representation of raw command parameters."""
    j = to_json(v)
    return json.dumps(j, ensure_ascii=False) if not isinstance(j, str) else j


def audio(a):
    if not isinstance(a, RObject):
        return plain(a)
    return f"'{s(a['name'])}' (vol {a['volume']}, pitch {a['pitch']})"


def character(i):
    return {-1: 'Player', 0: 'This event'}.get(i, f'Event {i:03d}')


def move_cmd(m, n):
    code, p = m['code'], m['parameters'] or []
    name = MOVE_CMDS.get(code, f'MoveCmd{code}')
    if code in (27, 28):
        return f'{name} {n.sw(p[0])}'
    if code == 44:
        return f'{name} {audio(p[0])}'
    if code == 45:
        return f'{name}: {s(p[0])}'
    return f'{name} {plain(p)}' if p else name


def operand(p, n):
    """Operand of Control Variables (parameters from index 3)."""
    kind = p[3]
    if kind == 0:
        return str(p[4])
    if kind == 1:
        return f'Variable {n.var(p[4])}'
    if kind == 2:
        return f'Random {p[4]}..{p[5]}'
    if kind == 3:
        return f'Item {n.of("Items", p[4])} in inventory'
    if kind == 6:
        what = ['Map X', 'Map Y', 'Direction', 'Screen X', 'Screen Y', 'Terrain Tag']
        return f'{character(p[4])} {what[p[5]] if p[5] < len(what) else p[5]}'
    if kind == 7:
        what = ['Map ID', 'Party Members', 'Gold', 'Steps', 'Play Time', 'Timer', 'Save Count']
        return what[p[4]] if p[4] < len(what) else f'Other {p[4]}'
    return f'type {kind}: {plain(p[4:])}'


def condition(p, n):
    kind = p[0]
    onoff = lambda v: 'ON' if v == 0 else 'OFF'
    if kind == 0:
        return f'Switch {n.sw(p[1])} == {onoff(p[2])}'
    if kind == 1:
        rhs = str(p[3]) if p[2] == 0 else f'Variable {n.var(p[3])}'
        return f'Variable {n.var(p[1])} {CMP[p[4]]} {rhs}'
    if kind == 2:
        return f'Self Switch {s(p[1])} == {onoff(p[2])}'
    if kind == 3:
        return f"Timer {p[1] // 60}min {p[1] % 60}s {'or more' if p[2] == 0 else 'or less'}"
    if kind == 6:
        return f'{character(p[1])} is facing {DIRS.get(p[2], p[2])}'
    if kind == 7:
        return f"Gold {'>=' if p[2] == 0 else '<='} {p[1]}"
    if kind == 8:
        return f'Item {n.of("Items", p[1])} in inventory'
    if kind == 9:
        return f'Weapon {n.of("Weapons", p[1])} in inventory'
    if kind == 10:
        return f'Armor {n.of("Armors", p[1])} in inventory'
    if kind == 11:
        return f'Button {BUTTONS.get(p[1], p[1])} is pressed'
    if kind == 12:
        return f'Script: {s(p[1])}'
    return f'type {kind}: {plain(p[1:])}'


def amount(p, i):
    """operation/operand-type/operand triple used by Change Gold/Items/..."""
    sign = '+' if p[i] == 0 else '-'
    return f'{sign} {p[i + 2]}' if p[i + 1] == 0 else f'{sign} Variable [{p[i + 2]:04d}]'


def render_commands(commands, n, base='  '):
    out = []
    for c in commands or []:
        code, p = c['code'], c['parameters'] or []
        pad = base + '  ' * (c['indent'] or 0)
        add = lambda text: out.append(pad + text)
        if code == 0 or code in SKIP:
            continue
        if code == 101:
            add(f'Text: {s(p[0])}')
        elif code == 401:
            add(f'    : {s(p[0])}')
        elif code == 102:
            add(f"Show Choices: {' | '.join(s(x) for x in p[0])}  (cancel: {p[1]})")
        elif code == 402:
            add(f'When [{s(p[1])}]')
        elif code == 403:
            add('When Cancel')
        elif code == 103:
            add(f'Input Number: Variable {n.var(p[0])}, {p[1]} digit(s)')
        elif code == 106:
            add(f'Wait: {p[0]} frame(s)')
        elif code == 108:
            add(f'# {s(p[0])}')
        elif code == 408:
            add(f'# {s(p[0])}')
        elif code == 111:
            add(f'If {condition(p, n)}')
        elif code == 411:
            add('Else')
        elif code == 117:
            add(f'Call Common Event: {n.of("CommonEvents", p[0])}')
        elif code == 118:
            add(f'Label: {s(p[0])}')
        elif code == 119:
            add(f'Jump to Label: {s(p[0])}')
        elif code == 121:
            rng = n.sw(p[0]) if p[0] == p[1] else f'[{p[0]:04d}..{p[1]:04d}]'
            add(f"Switch {rng} = {'ON' if p[2] == 0 else 'OFF'}")
        elif code == 122:
            rng = n.var(p[0]) if p[0] == p[1] else f'[{p[0]:04d}..{p[1]:04d}]'
            add(f'Variable {rng} {OPS[p[2]]} {operand(p, n)}')
        elif code == 123:
            add(f"Self Switch {s(p[0])} = {'ON' if p[1] == 0 else 'OFF'}")
        elif code == 124:
            add('Timer: Stop' if p[0] == 1 else f'Timer: Start {p[1] // 60}min {p[1] % 60}s')
        elif code == 125:
            add(f'Change Gold: {amount(p, 0)}')
        elif code == 126:
            add(f'Change Items: {n.of("Items", p[0])} {amount(p, 1)}')
        elif code == 127:
            add(f'Change Weapons: {n.of("Weapons", p[0])} {amount(p, 1)}')
        elif code == 128:
            add(f'Change Armor: {n.of("Armors", p[0])} {amount(p, 1)}')
        elif code == 129:
            add(f"Change Party Member: {'Add' if p[1] == 0 else 'Remove'} {n.of('Actors', p[0])}")
        elif code == 201:
            where = (f'Map {n.map(p[1])} ({p[2]}, {p[3]})' if p[0] == 0 else
                     f'Map by Variable [{p[1]:04d}], X by [{p[2]:04d}], Y by [{p[3]:04d}]')
            add(f"Transfer Player: {where}, facing {DIRS.get(p[4], p[4])}"
                f"{'' if p[5] == 0 else ', no fade'}")
        elif code == 209:
            route = p[1]
            flags = [f for f, on in (('repeat', route['repeat']), ('skippable', route['skippable'])) if on]
            add(f"Set Move Route: {character(p[0])}{' (' + ', '.join(flags) + ')' if flags else ''}")
            for m in route['list'] or []:
                if m['code'] != 0:
                    out.append(pad + '    > ' + move_cmd(m, n))
        elif code in (241, 245, 249, 250):
            add(f'{SIMPLE[code]}: {audio(p[0])}')
        elif code == 355:
            add(f'Script: {s(p[0])}')
        elif code == 655:
            add(f'      : {s(p[0])}')
        elif code in SIMPLE:
            add(f'{SIMPLE[code]}: {plain(p)}' if p else SIMPLE[code])
        else:
            add(f'Command {code}: {plain(p)}')
    return out


def page_conditions(cond, n):
    parts = []
    if cond['switch1_valid']:
        parts.append(f"Switch {n.sw(cond['switch1_id'])} is ON")
    if cond['switch2_valid']:
        parts.append(f"Switch {n.sw(cond['switch2_id'])} is ON")
    if cond['variable_valid']:
        parts.append(f"Variable {n.var(cond['variable_id'])} >= {cond['variable_value']}")
    if cond['self_switch_valid']:
        parts.append(f"Self Switch {s(cond['self_switch_ch'])} is ON")
    return ', '.join(parts) or 'none'


def render_map(map_id, m, n):
    out = [f'MAP {map_id:03d}: {n.maps.get(map_id, "")}',
           f"Size: {m['width']} x {m['height']}   Tileset ID: {m['tileset_id']}"]
    if m['autoplay_bgm']:
        out.append(f"Autoplay BGM: {audio(m['bgm'])}")
    if m['autoplay_bgs']:
        out.append(f"Autoplay BGS: {audio(m['bgs'])}")
    events = m['events'] or {}
    out.append(f'Events: {len(events)}')
    for eid in sorted(events):
        e = events[eid]
        out += ['', '=' * 78, f"EVENT {eid:03d}: {s(e['name'])}   at ({e['x']}, {e['y']})", '=' * 78]
        for i, page in enumerate(e['pages'] or [], 1):
            g = page['graphic']
            if s(g['character_name']):
                graphic = f"'{s(g['character_name'])}' facing {DIRS.get(g['direction'], g['direction'])}"
            elif g['tile_id']:
                graphic = f"tile {g['tile_id']}"
            else:
                graphic = 'none'
            flags = [f for f in ('through', 'always_on_top', 'direction_fix') if page[f]]
            out += ['', f'--- Page {i} ---',
                    f"  Conditions: {page_conditions(page['condition'], n)}",
                    f"  Trigger: {TRIGGERS[page['trigger']]}   Graphic: {graphic}   "
                    f"Movement: {MOVE_TYPES[page['move_type']]}"
                    f"{'   Flags: ' + ', '.join(flags) if flags else ''}"]
            if page['move_type'] == 3:
                for mc in page['move_route']['list'] or []:
                    if mc['code'] != 0:
                        out.append('    route > ' + move_cmd(mc, n))
            body = render_commands(page['list'], n, '    ')
            out += ['  Commands:'] + (body or ['    (none)'])
    return '\n'.join(out) + '\n'


# ------------------------------------------------------------------------ main

def safe_name(name):
    return re.sub(r'[^\w\-]+', '_', name).strip('_')


def main():
    root = Path(__file__).resolve().parent.parent
    project = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'original'
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else root / 'extracted'
    data = project / 'Data'
    for sub in ('scripts', 'maps', 'json'):
        (out / sub).mkdir(parents=True, exist_ok=True)

    # scripts
    index = []
    for i, (_id, name, code) in enumerate(load_rxdata(data / 'Scripts.rxdata')):
        name = s(name)
        text = zlib.decompress(code).decode('utf-8', 'replace').replace('\r\n', '\n')
        if not text.strip():
            index.append(f'{i:03d}  {name or "(separator)"}  -- empty')
            continue
        fname = f'{i:03d}_{safe_name(name) or "untitled"}.rb'
        (out / 'scripts' / fname).write_text(text, encoding='utf-8')
        index.append(f'{i:03d}  {name}  -> {fname}  ({text.count(chr(10)) + 1} lines)')
    (out / 'scripts' / '_index.txt').write_text('\n'.join(index) + '\n', encoding='utf-8')

    # JSON dump of everything else
    for f in sorted(data.glob('*.rxdata')):
        if f.stem != 'Scripts':
            (out / 'json' / f'{f.stem}.json').write_text(
                json.dumps(to_json(load_rxdata(f)), ensure_ascii=False, indent=1), encoding='utf-8')

    names = Names(data)

    # maps
    for f in sorted(data.glob('Map[0-9]*.rxdata')):
        map_id = int(f.stem[3:])
        text = render_map(map_id, load_rxdata(f), names)
        label = safe_name(names.maps.get(map_id, ''))
        (out / 'maps' / f'{f.stem}{"_" + label if label else ""}.txt').write_text(text, encoding='utf-8')

    # common events
    lines = []
    for ce in load_rxdata(data / 'CommonEvents.rxdata'):
        if ce is None:
            continue
        body = render_commands(ce['list'], names)
        if not body and not s(ce['name']):
            continue
        trig = ['None', 'Autorun', 'Parallel'][ce['trigger']]
        cond = f"   Condition switch: {names.sw(ce['switch_id'])}" if ce['trigger'] else ''
        lines += ['=' * 78, f"COMMON EVENT {ce['id']:03d}: {s(ce['name'])}   Trigger: {trig}{cond}",
                  '=' * 78] + (body or ['  (none)']) + ['']
    (out / 'common_events.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')

    # system overview
    sy = names.system
    lines = [f"Start position: Map {names.map(sy['start_map_id'])} ({sy['start_x']}, {sy['start_y']})",
             f"Starting party: {', '.join(names.of('Actors', a) for a in sy['party_members'] or [])}",
             f"Title BGM: {audio(sy['title_bgm'])}", '', 'MAPS']
    lines += [f'  {k:03d}: {v}' for k, v in sorted(names.maps.items())]
    lines += ['', 'SWITCHES (named)']
    lines += [f'  {i:04d}: {v}' for i, v in enumerate(names.switches) if v]
    lines += ['', 'VARIABLES (named)']
    lines += [f'  {i:04d}: {v}' for i, v in enumerate(names.variables) if v]
    lines += ['', 'ITEMS']
    lines += [f'  {i:03d}: {v}' for i, v in sorted(names.tables['Items'].items()) if v]
    (out / 'system.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')

    print(f'scripts: {len(list((out / "scripts").glob("*.rb")))}')
    print(f'maps:    {len(list((out / "maps").glob("*.txt")))}')
    print(f'output:  {out}')


if __name__ == '__main__':
    main()
