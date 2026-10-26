"""Modelo de AR animado de CORAESSENS: la caja sale del piso girando, aparece su nombre en 3D encima
y, al final del ciclo, ambos vuelven a bajar.

Ciclo de 10 s (Scene Viewer y AR Quick Look repiten la primera animación sin fin):
  0,0–1,2 s  la caja sube desde el piso girando, con un pequeño rebote, y un aro se abre en el piso
  0,9–1,6 s  el nombre en 3D aparece encima de la caja
  1,6–8,8 s  reposo: la caja da una vuelta completa y el nombre flota y se balancea (tramo que se
             puede repetir sin cortes: la página de AR con tarjeta repite solo este tramo)
  8,8–9,6 s  el nombre y la caja bajan; 9,6–10 s pausa
El nombre en 3D sale de los contornos de la fuente Montserrat ExtraBold (extruido, con caras
frontales rojas y laterales moradas, los colores del empaque).
"""
import json
import math
import os
import struct
import tempfile
from functools import reduce

import mapbox_earcut as earcut
import numpy as np
from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FONT = os.path.join(ROOT, "node_modules", "@expo-google-fonts", "montserrat", "800ExtraBold", "Montserrat_800ExtraBold.ttf")

T = 10.0  # duración del ciclo (s)
FPS = 30
IDLE = (1.6, 8.8)  # tramo de reposo que se repite sin cortes (una vuelta completa de la caja)
RED, PURPLE, WHITE = (0.788, 0.149, 0.184), (0.361, 0.173, 0.471), (1.0, 1.0, 1.0)


def srgb_to_linear(c):
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


# ---------- texto en 3D ----------
class _Flatten(BasePen):
    """Convierte los contornos de un glifo en polígonos (curvas aproximadas con segmentos)."""

    def __init__(self, glyphset, steps=8):
        super().__init__(glyphset)
        self.rings, self.cur, self.steps = [], [], steps

    def _moveTo(self, p):
        self.cur = [p]

    def _lineTo(self, p):
        self.cur.append(p)

    def _curveToOne(self, p1, p2, p3):
        p0 = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            mt = 1 - t
            self.cur.append((mt**3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t**3 * p3[0], mt**3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t**3 * p3[1]))

    def _qCurveToOne(self, p1, p2):
        p0 = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            mt = 1 - t
            self.cur.append((mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0], mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]))

    def _closePath(self):
        if len(self.cur) >= 3:
            self.rings.append(self.cur)
        self.cur = []

    _endPath = _closePath


NAME_WIDTH = 0.064  # ancho del nombre en 3D (m): casi el doble del ancho de la caja
NAME_DEPTH = 0.003


def name_geometry(text):
    """Polígonos del nombre escalados para que mida NAME_WIDTH de ancho."""
    _, w = text_polygons(text, 0.01)
    return text_polygons(text, 0.01 * NAME_WIDTH / w)


def text_polygons(text, cap_height):
    """Polígonos (con huecos) del texto, centrado en x, con la base en y = 0, en metros."""
    font = TTFont(FONT)
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    cap = getattr(font["OS/2"], "sCapHeight", 0) or upm * 0.7
    k = cap_height / cap
    x = 0
    shapes = []
    for ch in text:
        gname = cmap[ord(ch)]
        pen = _Flatten(gs)
        gs[gname].draw(pen)
        polys = [Polygon(r).buffer(0) for r in pen.rings if len(r) >= 3]
        if polys:
            # xor de los contornos: los huecos (como en la "O" o la "A") quedan vacíos
            glyph = reduce(lambda a, b: a.symmetric_difference(b), polys)
            shapes.append(_translate(glyph, x))
        x += gs[gname].width
    total = unary_union(shapes)
    width = x * k
    return _scale(total, k, -width / 2), width


def _translate(geom, dx):
    from shapely import affinity

    return affinity.translate(geom, xoff=dx)


def _scale(geom, k, dx):
    from shapely import affinity

    return affinity.translate(affinity.scale(geom, xfact=k, yfact=k, origin=(0, 0)), xoff=dx)


def extrude(geom, depth):
    """Malla extruida: (caras frente/atrás) y (laterales), cada una con posiciones, normales e índices."""
    faces = ([], [], [])
    sides = ([], [], [])
    polys = list(geom.geoms) if hasattr(geom, "geoms") else [geom]
    z0, z1 = -depth / 2, depth / 2
    for poly in polys:
        rings = [np.array(poly.exterior.coords)[:-1]] + [np.array(r.coords)[:-1] for r in poly.interiors]
        verts = np.concatenate(rings)
        ends = np.cumsum([len(r) for r in rings]).astype(np.uint32)
        tris = earcut.triangulate_float64(verts, ends).reshape(-1, 3)
        # frente (+z) y atrás (-z)
        for z, n, flip in ((z1, (0, 0, 1), False), (z0, (0, 0, -1), True)):
            base = len(faces[0])
            for vx, vy in verts:
                faces[0].append((vx, vy, z))
                faces[1].append(n)
            for a, b, c in tris:
                # el triángulo debe mirar hacia su normal
                pa, pb, pc = verts[a], verts[b], verts[c]
                cz = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0])
                tri = (a, b, c) if (cz > 0) != flip else (a, c, b)
                faces[2].extend(base + i for i in tri)
        # laterales
        for ring in rings:
            ccw = Polygon(ring).exterior.is_ccw
            m = len(ring)
            for i in range(m):
                p, q = ring[i], ring[(i + 1) % m]
                dx, dy = q[0] - p[0], q[1] - p[1]
                ln = math.hypot(dx, dy) or 1
                # normal hacia fuera del material: depende del sentido del anillo
                n = (dy / ln, -dx / ln, 0) if ccw else (-dy / ln, dx / ln, 0)
                base = len(sides[0])
                for (vx, vy), z in ((p, z0), (q, z0), (q, z1), (p, z1)):
                    sides[0].append((vx, vy, z))
                    sides[1].append(n)
                a, b, c, d = base, base + 1, base + 2, base + 3
                # orientar según la normal
                e1 = np.subtract(sides[0][b], sides[0][a])
                e2 = np.subtract(sides[0][c], sides[0][a])
                if np.dot(np.cross(e1, e2), n) > 0:
                    sides[2].extend([a, b, c, a, c, d])
                else:
                    sides[2].extend([a, c, b, a, d, c])
    return faces, sides


def ring_mesh(r_in, r_out, seg=64):
    pos, nor, idx = [], [], []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        for r in (r_in, r_out):
            pos.append((r * math.cos(a), 0.0005, r * math.sin(a)))
            nor.append((0, 1, 0))
    for i in range(seg):
        a, b = 2 * i, 2 * i + 1
        c, d = 2 * ((i + 1) % seg), 2 * ((i + 1) % seg) + 1
        idx.extend([a, c, b, b, c, d])
    return pos, nor, idx


# ---------- línea de tiempo ----------
def ease_out_cubic(x):
    return 1 - (1 - x) ** 3


def ease_in_cubic(x):
    return x**3


def ease_out_back(x):
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


TINY = 0.0001
IDLE_W = 2 * math.pi / (IDLE[1] - IDLE[0])  # una vuelta en el tramo de reposo


def box_at(t):
    """(y, ángulo, escala) de la caja en el instante t."""
    a1 = 1.5 * math.pi
    if t < 1.2:
        k = t / 1.2
        return -0.015 * (1 - ease_out_cubic(k)), a1 * ease_out_cubic(k), max(TINY, ease_out_back(k))
    a_end = a1 + IDLE_W * (9.0 - 1.2)
    if t < 9.0:
        return 0.0, a1 + IDLE_W * (t - 1.2), 1.0
    if t < 9.6:
        k = (t - 9.0) / 0.6
        return -0.012 * ease_in_cubic(k), a_end + (4 * math.pi - a_end) * k, max(TINY, 1 - ease_in_cubic(k))
    return -0.015, 4 * math.pi, TINY


def name_at(t, base_y):
    """(y, ángulo, escala) del nombre."""
    if t < 0.9:
        return base_y - 0.01, -0.5, TINY
    if t < 1.6:
        k = (t - 0.9) / 0.7
        return base_y - 0.01 * (1 - ease_out_cubic(k)), -0.5 * (1 - ease_out_cubic(k)), max(TINY, ease_out_back(k))
    if t < 8.8:
        u = t - 1.6
        return base_y + 0.002 * math.sin(2 * math.pi * u / 3.6), 0.12 * math.sin(2 * math.pi * u / 7.2), 1.0
    if t < 9.3:
        k = (t - 8.8) / 0.5
        return base_y + 0.006 * ease_in_cubic(k), 0.0, max(TINY, 1 - ease_in_cubic(k))
    return base_y - 0.01, -0.5, TINY


def ring_at(t):
    if t < 1.1:
        return max(TINY, 0.3 + 1.0 * ease_out_cubic(t / 1.1))
    if t < 1.35:
        return max(TINY, 1.3 * (1 - ease_in_cubic((t - 1.1) / 0.25)))
    return TINY


def quat_y(a):
    return (0.0, math.sin(a / 2), 0.0, math.cos(a / 2))  # x, y, z, w


NAME_TILT = -0.42  # el nombre se inclina un poco hacia atrás: se lee de frente y también desde arriba


def quat_name(a):
    """giro (balanceo) sobre el eje vertical por la inclinación hacia atrás del nombre"""
    qy = quat_y(a)
    s, c = math.sin(NAME_TILT / 2), math.cos(NAME_TILT / 2)
    qx = (s, 0.0, 0.0, c)
    x1, y1, z1, w1 = qy
    x2, y2, z2, w2 = qx
    return (w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2, w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2, w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2, w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2)


def samples():
    n = int(T * FPS)
    return [i / FPS for i in range(n + 1)]


# ---------- GLB ----------
def _pad(b, fill=b"\0"):
    return b + fill * ((4 - len(b) % 4) % 4)


class _Bin:
    def __init__(self):
        self.data = b""
        self.views = []
        self.accessors = []

    def add(self, arr, comp, typ, target=None, minmax=False):
        raw = arr.tobytes()
        off = len(self.data)
        self.data = _pad(self.data + raw)
        view = {"buffer": 0, "byteOffset": off, "byteLength": len(raw)}
        if target:
            view["target"] = target
        self.views.append(view)
        acc = {"bufferView": len(self.views) - 1, "componentType": comp, "count": int(arr.shape[0]), "type": typ}
        if minmax:
            acc["min"] = arr.min(axis=0).tolist() if arr.ndim > 1 else [float(arr.min())]
            acc["max"] = arr.max(axis=0).tolist() if arr.ndim > 1 else [float(arr.max())]
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def image(self, raw):
        off = len(self.data)
        self.data = _pad(self.data + raw)
        self.views.append({"buffer": 0, "byteOffset": off, "byteLength": len(raw)})
        return len(self.views) - 1


def _prim(bin_, pos, nor, idx, material, uv=None):
    attrs = {
        "POSITION": bin_.add(np.array(pos, np.float32), 5126, "VEC3", 34962, minmax=True),
        "NORMAL": bin_.add(np.array(nor, np.float32), 5126, "VEC3", 34962),
    }
    if uv is not None:
        attrs["TEXCOORD_0"] = bin_.add(np.array(uv, np.float32), 5126, "VEC2", 34962)
    big = max(idx) > 65535
    ind = bin_.add(np.array(idx, np.uint32 if big else np.uint16), 5125 if big else 5123, "SCALAR", 34963)
    return {"attributes": attrs, "indices": ind, "material": material}


def write_glb(path, title, box, jpg_bytes, text, box_h):
    """box = (pos, nor, uv, idx) de la caja con origen en el centro de su base."""
    b = _Bin()
    geom, width = name_geometry(text)
    faces, sides = extrude(geom, NAME_DEPTH)
    rpos, rnor, ridx = ring_mesh(0.028, 0.031)
    base_y = box_h + 0.012

    meshes = [
        {"name": "Caja", "primitives": [_prim(b, box[0], box[1], box[3], 0, uv=box[2])]},
        {"name": "Nombre", "primitives": [_prim(b, *faces, 1), _prim(b, *sides, 2)]},
        {"name": "Aro", "primitives": [_prim(b, rpos, rnor, ridx, 3)]},
    ]
    img_view = b.image(jpg_bytes)

    ts = samples()
    times = b.add(np.array(ts, np.float32), 5126, "SCALAR", minmax=True)

    def track(fn, quat=quat_y):
        tr, rot, sc = [], [], []
        for t in ts:
            y, a, s = fn(t if t < T else 0.0)
            tr.append((0.0, y, 0.0))
            rot.append(quat(a))
            sc.append((s, s, s))
        return [b.add(np.array(v, np.float32), 5126, typ) for v, typ in ((tr, "VEC3"), (rot, "VEC4"), (sc, "VEC3"))]

    # el último cuadro (t = T) repite el primero: el ciclo se une sin saltos
    box_tr = track(box_at)
    name_tr = track(lambda t: name_at(t, base_y), quat_name)
    ring_sc = b.add(np.array([(ring_at(t if t < T else 0.0),) * 3 for t in ts], np.float32), 5126, "VEC3")

    samplers, channels = [], []

    def channel(node, path_, out):
        samplers.append({"input": times, "output": out, "interpolation": "LINEAR"})
        channels.append({"sampler": len(samplers) - 1, "target": {"node": node, "path": path_}})

    for node, (tr, rot, sc) in ((1, box_tr), (2, name_tr)):
        channel(node, "translation", tr)
        channel(node, "rotation", rot)
        channel(node, "scale", sc)
    channel(3, "scale", ring_sc)

    red, purple = srgb_to_linear(RED), srgb_to_linear(PURPLE)
    gltf = {
        "asset": {"version": "2.0", "generator": "Multi LAB (prototipo académico)"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [
            {"name": title, "children": [1, 2, 3]},
            {"name": "Caja", "mesh": 0, "scale": [TINY] * 3},
            {"name": "Nombre", "mesh": 1, "translation": [0, base_y, 0], "scale": [TINY] * 3},
            {"name": "Aro", "mesh": 2, "scale": [TINY] * 3},
        ],
        "meshes": meshes,
        "materials": [
            {"name": "Caja", "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 0.55}},
            {"name": "Nombre frente", "pbrMetallicRoughness": {"baseColorFactor": [*red, 1], "metallicFactor": 0.0, "roughnessFactor": 0.35}},
            {"name": "Nombre canto", "pbrMetallicRoughness": {"baseColorFactor": [*purple, 1], "metallicFactor": 0.0, "roughnessFactor": 0.5}},
            {"name": "Aro", "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 0.55], "metallicFactor": 0.0, "roughnessFactor": 0.8}, "alphaMode": "BLEND", "doubleSided": True},
        ],
        "textures": [{"source": 0, "sampler": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": img_view, "mimeType": "image/jpeg"}],
        "animations": [{"name": "Presentacion", "samplers": samplers, "channels": channels}],
        "extras": {"cicloSegundos": T, "reposo": list(IDLE)},
        "buffers": [{"byteLength": len(b.data)}],
        "bufferViews": b.views,
        "accessors": b.accessors,
    }
    js = _pad(json.dumps(gltf, separators=(",", ":")).encode(), b" ")
    total = 12 + 8 + len(js) + 8 + len(b.data)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(b.data), 0x004E4942) + b.data)
    return width


# ---------- USDZ (AR Quick Look) ----------
def write_usdz(path, title, box, jpg_path, text, box_h):
    from pxr import Gf, Sdf, Usd, UsdGeom, UsdShade, UsdUtils, Vt

    geom, _ = name_geometry(text)
    faces, sides = extrude(geom, NAME_DEPTH)
    rpos, rnor, ridx = ring_mesh(0.028, 0.031)
    base_y = box_h + 0.012
    with tempfile.TemporaryDirectory() as tmp:
        usdc = os.path.join(tmp, "modelo.usdc")
        tex = os.path.join(tmp, "textura.jpg")
        with open(jpg_path, "rb") as a, open(tex, "wb") as b_:
            b_.write(a.read())
        stage = Usd.Stage.CreateNew(usdc)
        UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
        UsdGeom.SetStageMetersPerUnit(stage, 1.0)
        stage.SetTimeCodesPerSecond(FPS)
        stage.SetFramesPerSecond(FPS)
        stage.SetStartTimeCode(0)
        stage.SetEndTimeCode(int(T * FPS))
        root = UsdGeom.Xform.Define(stage, "/Producto")
        stage.SetDefaultPrim(root.GetPrim())

        def material(name, color=None, opacity=1.0, texture=False, rough=0.5):
            mat = UsdShade.Material.Define(stage, f"/Producto/Materiales/{name}")
            sh = UsdShade.Shader.Define(stage, f"/Producto/Materiales/{name}/Superficie")
            sh.CreateIdAttr("UsdPreviewSurface")
            sh.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(rough)
            sh.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(0.0)
            if opacity < 1:
                sh.CreateInput("opacity", Sdf.ValueTypeNames.Float).Set(opacity)
            if texture:
                reader = UsdShade.Shader.Define(stage, f"/Producto/Materiales/{name}/LectorST")
                reader.CreateIdAttr("UsdPrimvarReader_float2")
                reader.CreateInput("varname", Sdf.ValueTypeNames.Token).Set("st")
                tx = UsdShade.Shader.Define(stage, f"/Producto/Materiales/{name}/Textura")
                tx.CreateIdAttr("UsdUVTexture")
                tx.CreateInput("file", Sdf.ValueTypeNames.Asset).Set("textura.jpg")
                tx.CreateInput("st", Sdf.ValueTypeNames.Float2).ConnectToSource(reader.ConnectableAPI(), "result")
                tx.CreateInput("wrapS", Sdf.ValueTypeNames.Token).Set("clamp")
                tx.CreateInput("wrapT", Sdf.ValueTypeNames.Token).Set("clamp")
                tx.CreateOutput("rgb", Sdf.ValueTypeNames.Float3)
                sh.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).ConnectToSource(tx.ConnectableAPI(), "rgb")
            else:
                sh.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(*color))
            mat.CreateSurfaceOutput().ConnectToSource(sh.ConnectableAPI(), "surface")
            return mat

        def mesh(prim_path, pos, nor, idx, mat, uv=None, extent=None):
            m = UsdGeom.Mesh.Define(stage, prim_path)
            m.CreatePointsAttr(Vt.Vec3fArray([Gf.Vec3f(*map(float, v)) for v in pos]))
            m.CreateFaceVertexCountsAttr(Vt.IntArray([3] * (len(idx) // 3)))
            m.CreateFaceVertexIndicesAttr(Vt.IntArray([int(i) for i in idx]))
            m.CreateSubdivisionSchemeAttr("none")
            arr = np.array(pos, float)
            m.CreateExtentAttr([Gf.Vec3f(*arr.min(axis=0)), Gf.Vec3f(*arr.max(axis=0))])
            api = UsdGeom.PrimvarsAPI(m)
            api.CreatePrimvar("normals", Sdf.ValueTypeNames.Normal3fArray, UsdGeom.Tokens.vertex).Set(Vt.Vec3fArray([Gf.Vec3f(*map(float, v)) for v in nor]))
            if uv is not None:
                api.CreatePrimvar("st", Sdf.ValueTypeNames.TexCoord2fArray, UsdGeom.Tokens.vertex).Set(Vt.Vec2fArray([Gf.Vec2f(u, 1 - v) for u, v in uv]))
            UsdShade.MaterialBindingAPI.Apply(m.GetPrim()).Bind(mat)
            return m

        m_box = material("Caja", texture=True, rough=0.55)
        m_front = material("NombreFrente", RED, rough=0.35)
        m_side = material("NombreCanto", PURPLE)
        m_ring = material("Aro", WHITE, opacity=0.55, rough=0.8)

        def animated_xform(prim_path, fn, quat=quat_y):
            x = UsdGeom.Xform.Define(stage, prim_path)
            t_op = x.AddTranslateOp()
            r_op = x.AddOrientOp()
            s_op = x.AddScaleOp()
            for i, t in enumerate(samples()):
                y, a, s = fn(t if t < T else 0.0)
                q = quat(a)
                t_op.Set(Gf.Vec3f(0, y, 0), i)
                r_op.Set(Gf.Quatf(q[3], q[0], q[1], q[2]), i)
                s_op.Set(Gf.Vec3f(s, s, s), i)
            return x

        animated_xform("/Producto/Caja", box_at)
        mesh("/Producto/Caja/Malla", box[0], box[1], box[3], m_box, uv=box[2])
        animated_xform("/Producto/Nombre", lambda t: name_at(t, base_y), quat_name)
        mesh("/Producto/Nombre/Frente", *faces, m_front)
        mesh("/Producto/Nombre/Canto", *sides, m_side)
        ring = UsdGeom.Xform.Define(stage, "/Producto/Aro")
        sop = ring.AddScaleOp()
        for i, t in enumerate(samples()):
            s = ring_at(t if t < T else 0.0)
            sop.Set(Gf.Vec3f(s, s, s), i)
        mesh("/Producto/Aro/Malla", rpos, rnor, ridx, m_ring)
        stage.GetRootLayer().Save()
        if not UsdUtils.CreateNewARKitUsdzPackage(Sdf.AssetPath(usdc), path):
            raise SystemExit(f"No se pudo crear {path}")
