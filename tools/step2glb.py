# STEP (AP242, CATIA) -> GLB + Baumübersicht.
# Aufruf: tools\cadenv\Scripts\python.exe tools\step2glb.py <in.stp> <out.glb> [lin_defl_mm] [ang_defl_rad]
import sys, time, json
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.XCAFDoc import XCAFDoc_DocumentTool
from OCP.TDocStd import TDocStd_Document
from OCP.TCollection import TCollection_ExtendedString, TCollection_AsciiString
from OCP.TDF import TDF_Label
from OCP.collections import Sequence_TDF_Label as TDF_LabelSequence, IndexedDataMap_TCollection_AsciiString_TCollection_AsciiString as InfoMap
from OCP.TDataStd import TDataStd_Name
from OCP.IFSelect import IFSelect_RetDone
from OCP.Interface import Interface_Static
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib
from OCP.RWGltf import RWGltf_CafWriter
from OCP.RWMesh import RWMesh_CoordinateSystem_Zup
from OCP.Message import Message_ProgressRange

src, dst = sys.argv[1], sys.argv[2]
lin = float(sys.argv[3]) if len(sys.argv) > 3 else 5.0
ang = float(sys.argv[4]) if len(sys.argv) > 4 else 0.5
t0 = time.time()
def log(*a): print(f'[{time.time()-t0:7.1f}s]', *a, flush=True)

doc = TDocStd_Document(TCollection_ExtendedString('XmlXCAF'))
rd = STEPCAFControl_Reader()
rd.SetNameMode(True); rd.SetColorMode(True); rd.SetLayerMode(False)
Interface_Static.SetIVal_s('read.step.tessellated', 1)
log('lese', src)
if rd.ReadFile(src) != IFSelect_RetDone: sys.exit('ReadFile fehlgeschlagen')
log('übertrage')
if not rd.Transfer(doc): sys.exit('Transfer fehlgeschlagen')
log('übertragen')

st = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
free = TDF_LabelSequence(); st.GetFreeShapes(free)

def name(l):
    n = TDataStd_Name()
    return n.Get().ToExtString() if l.FindAttribute(TDataStd_Name.GetID_s(), n) else '?'

log('vernetze, lin', lin, 'ang', ang)
for i in range(1, free.Length() + 1):
    BRepMesh_IncrementalMesh(st.GetShape_s(free.Value(i)), lin, False, ang, True)
log('vernetzt')

def bbox(shape):
    b = Bnd_Box(); BRepBndLib.Add_s(shape, b, True)
    if b.IsVoid(): return None
    a, c = b.CornerMin(), b.CornerMax()
    return [round(v) for v in (a.X(), a.Y(), a.Z(), c.X(), c.Y(), c.Z())]

tree = []
def walk(l, depth, loc_shape=None):
    ref = TDF_Label()
    tgt = l
    if st.IsReference_s(l):
        st.GetReferredShape_s(l, ref); tgt = ref
    sh = st.GetShape_s(l)
    tree.append({'d': depth, 'inst': name(l), 'name': name(tgt), 'asm': bool(st.IsAssembly_s(tgt)), 'bb': bbox(sh) if depth <= 4 else None})
    if st.IsAssembly_s(tgt):
        comps = TDF_LabelSequence(); st.GetComponents_s(tgt, comps, False)
        for i in range(1, comps.Length() + 1): walk(comps.Value(i), depth + 1)
for i in range(1, free.Length() + 1): walk(free.Value(i), 0)
with open(dst + '.tree.json', 'w', encoding='utf-8') as f: json.dump(tree, f, ensure_ascii=False, indent=0)
log('Baum:', len(tree), 'Knoten')

w = RWGltf_CafWriter(TCollection_AsciiString(dst), True)
w.ChangeCoordinateSystemConverter().SetInputLengthUnit(0.001)
w.ChangeCoordinateSystemConverter().SetInputCoordinateSystem(RWMesh_CoordinateSystem_Zup)
ok = w.Perform(doc, InfoMap(), Message_ProgressRange())
log('GLB geschrieben:', ok)
