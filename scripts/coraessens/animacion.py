"""Modelo de AR animado de CORAESSENS, al estilo de las referencias de producto (caja flotando que gira,
se abre y deja salir su contenido, que vuela alrededor, y título en 3D).

Ciclo de 12 s (Scene Viewer y AR Quick Look repiten la primera animación sin fin):
  0,0–1,2 s   la caja sube desde el piso girando, con un pequeño rebote, y un aro se abre en el piso
  0,9–1,6 s   el nombre en 3D aparece flotando sobre la caja
  1,6–10,8 s  función (tramo que se repite sin cortes; la AR con tarjeta repite solo este tramo):
              la tapa se abre (2,0 s), salen 9 cápsulas una tras otra (2,45 s), giran alrededor de la
              caja dando vueltas sobre sí mismas, vuelven a entrar (8,0 s) y la tapa se cierra (9,6 s);
              mientras tanto la caja da una vuelta completa flotando y el nombre se balancea
  10,8–11,6 s el nombre y la caja bajan; 11,6–12 s pausa
El nombre en 3D sale de los contornos de Montserrat ExtraBold (frente rojo, canto morado). Las cápsulas
son ilustrativas (rojo y blanco, los colores del empaque; no representan el color real de la cápsula); la caja usa las fotos del empaque.
"""
import json
import math
import os
import random
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

T = 12.0  # duración del ciclo (s)
FPS = 30
SHOW = (1.6, 10.8)  # tramo que se repite sin cortes (la caja da una vuelta completa)
RED, PURPLE, WHITE = (0.788, 0.149, 0.184), (0.361, 0.173, 0.471), (1.0, 1.0, 1.0)
CARDBOARD = (0.93, 0.91, 0.87)
CAPSULE_WHITE = (0.97, 0.96, 0.95)
TINY = 0.0001
N_CAPS = 9  # la caja dice "9 cápsulas"


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




# ---------- geometría de la caja (cuerpo abierto, interior y tapa con bisagra) ----------
def box_parts(bm):
    """Cuerpo (5 caras con las fotos), interior de cartón y tapa (en coordenadas de su bisagra)."""
    W, H, D = bm.W, bm.H, bm.D

    def quad(pts, n, uvs=None):
        return pts, [n] * 4, uvs

    def face_uv(face):
        x, y, w, h = bm.RECTS[face]
        return [((x + 0.5 + u * (w - 1)) / bm.ATLAS, (y + 0.5 + v * (h - 1)) / bm.ATLAS) for u, v in ((0, 0), (1, 0), (1, 1), (0, 1))]

    def build(quads):
        pos, nor, uv, idx = [], [], [], []
        for pts, ns, uvs in quads:
            b = len(pos)
            pos += pts
            nor += ns
            uv += uvs or [(0, 0)] * 4
            n = np.array(ns[0])
            e1, e2 = np.subtract(pts[1], pts[0]), np.subtract(pts[2], pts[0])
            if np.dot(np.cross(e1, e2), n) > 0:
                idx += [b, b + 1, b + 2, b, b + 2, b + 3]
            else:
                idx += [b, b + 2, b + 1, b, b + 3, b + 2]
        return pos, nor, uv, idx

    body = []
    for face, n in (("front", (0, 0, 1)), ("right", (1, 0, 0)), ("back", (0, 0, -1)), ("left", (-1, 0, 0)), ("bottom", (0, -1, 0))):
        pts = [bm.corner(face, u, v) for u, v in ((0, 0), (1, 0), (1, 1), (0, 1))]
        body.append(quad(pts, n, face_uv(face)))
    e = 0.0006  # grosor del cartón
    x0, x1, z0, z1 = -W / 2 + e, W / 2 - e, -D / 2 + e, D / 2 - e
    y0, y1 = 0.0015, H  # piso interior un poco más alto que la sombra que dibuja la AR con tarjeta
    inner = [
        quad([(x0, y1, z1), (x1, y1, z1), (x1, y0, z1), (x0, y0, z1)], (0, 0, -1)),
        quad([(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)], (0, 0, 1)),
        quad([(x1, y1, z0), (x1, y1, z1), (x1, y0, z1), (x1, y0, z0)], (-1, 0, 0)),
        quad([(x0, y1, z0), (x0, y1, z1), (x0, y0, z1), (x0, y0, z0)], (1, 0, 0)),
        quad([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], (0, 1, 0)),
        # canto superior de las paredes (se ve al abrir)
        quad([(-W / 2, H, D / 2), (W / 2, H, D / 2), (x1, H, z1), (x0, H, z1)], (0, 1, 0)),
        quad([(-W / 2, H, -D / 2), (W / 2, H, -D / 2), (x1, H, z0), (x0, H, z0)], (0, 1, 0)),
        quad([(W / 2, H, -D / 2), (W / 2, H, D / 2), (x1, H, z1), (x1, H, z0)], (0, 1, 0)),
        quad([(-W / 2, H, -D / 2), (-W / 2, H, D / 2), (x0, H, z1), (x0, H, z0)], (0, 1, 0)),
    ]
    # tapa: en su bisagra (borde de atrás de la cara superior); z va de 0 (bisagra) a D (borde de adelante)
    lid_out = [quad([(-W / 2, 0.0002, 0), (W / 2, 0.0002, 0), (W / 2, 0.0002, D), (-W / 2, 0.0002, D)], (0, 1, 0), face_uv("top"))]
    lid_in = [quad([(-W / 2, -0.0002, 0), (W / 2, -0.0002, 0), (W / 2, -0.0002, D), (-W / 2, -0.0002, D)], (0, -1, 0))]
    return build(body), build(inner), build(lid_out), build(lid_in)


def capsule_halves(length=0.018, radius=0.0032, seg=24, rings=8):
    """Cápsula a lo largo del eje y, en dos mitades (arriba y abajo) para dos colores."""
    halves = []
    cyl = length / 2 - radius
    for sign in (1, -1):
        prof = [(radius, 0.0)]  # (radio, altura) desde el centro hacia la punta
        prof.append((radius, cyl))
        for k in range(1, rings + 1):
            a = (math.pi / 2) * k / rings
            prof.append((radius * math.cos(a), cyl + radius * math.sin(a)))
        pos, nor, idx = [], [], []
        for j, (r, h) in enumerate(prof):
            if j <= 1:
                n_r, n_h = 1.0, 0.0
            else:
                a = (math.pi / 2) * (j - 1) / rings
                n_r, n_h = math.cos(a), math.sin(a)
            for s in range(seg):
                ang = 2 * math.pi * s / seg
                c, si = math.cos(ang), math.sin(ang)
                pos.append((r * c, sign * h, r * si))
                nor.append((n_r * c, sign * n_h, n_r * si))
        for j in range(len(prof) - 1):
            for s in range(seg):
                a, b = j * seg + s, j * seg + (s + 1) % seg
                c, d = (j + 1) * seg + s, (j + 1) * seg + (s + 1) % seg
                tri = [(a, c, b), (b, c, d)] if sign > 0 else [(a, b, c), (b, d, c)]
                for t in tri:
                    idx.extend(t)
        halves.append((pos, nor, idx))
    return halves


# ---------- línea de tiempo ----------
def clamp01(x):
    return max(0.0, min(1.0, x))


def smooth(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def ease_out_cubic(x):
    return 1 - (1 - clamp01(x)) ** 3


def ease_in_cubic(x):
    return clamp01(x) ** 3


def ease_in_out(x):
    x = clamp01(x)
    return 4 * x**3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def ease_out_back(x):
    c1 = 1.70158
    c3 = c1 + 1
    x = clamp01(x)
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


SHOW_W = 2 * math.pi / (SHOW[1] - SHOW[0])  # una vuelta de la caja en la función
A1 = 1.5 * math.pi  # giro al terminar la entrada


def bob(t):
    return 0.0035 * math.sin(2 * math.pi * (t - SHOW[0]) / ((SHOW[1] - SHOW[0]) / 2))


def box_at(t):
    """(y, giro, escala) de la caja"""
    if t < 1.2:
        k = t / 1.2
        return -0.015 * (1 - ease_out_cubic(k)), A1 * ease_out_cubic(k), max(TINY, ease_out_back(k))
    if t < SHOW[1]:
        return bob(t) * smooth((t - 1.2) / 0.4), A1 + SHOW_W * (t - 1.2), 1.0
    a_end = A1 + SHOW_W * (SHOW[1] - 1.2)
    if t < SHOW[1] + 0.8:
        k = (t - SHOW[1]) / 0.8
        return -0.012 * ease_in_cubic(k), a_end + (4 * math.pi - a_end) * k, max(TINY, 1 - ease_in_cubic(k))
    return -0.015, 4 * math.pi, TINY


LID_OPEN = -1.95  # la tapa se abre hacia atrás (~112°)


def lid_at(t):
    if 2.0 <= t < 2.9:
        return LID_OPEN * ease_out_back((t - 2.0) / 0.9)
    if 2.9 <= t < 9.6:
        return LID_OPEN
    if 9.6 <= t < 10.2:
        return LID_OPEN * (1 - ease_in_out((t - 9.6) / 0.6))
    return 0.0


def name_at(t, base_y):
    if t < 0.9:
        return base_y - 0.01, -0.5, TINY
    if t < SHOW[0]:
        k = (t - 0.9) / 0.7
        return base_y - 0.01 * (1 - ease_out_cubic(k)), -0.5 * (1 - ease_out_cubic(k)), max(TINY, ease_out_back(k))
    if t < SHOW[1]:
        u = t - SHOW[0]
        span = SHOW[1] - SHOW[0]
        return base_y + 0.0025 * math.sin(2 * math.pi * u / (span / 2)), 0.12 * math.sin(2 * math.pi * u / span), 1.0
    if t < SHOW[1] + 0.5:
        k = (t - SHOW[1]) / 0.5
        return base_y + 0.006 * ease_in_cubic(k), 0.0, max(TINY, 1 - ease_in_cubic(k))
    return base_y - 0.01, -0.5, TINY


def ring_at(t):
    if t < 1.1:
        return max(TINY, 0.3 + 1.0 * ease_out_cubic(t / 1.1))
    if t < 1.35:
        return max(TINY, 1.3 * (1 - ease_in_cubic((t - 1.1) / 0.25)))
    return TINY


# ---------- cuaterniones (x, y, z, w) ----------
def quat_axis(ax, a):
    s = math.sin(a / 2)
    return (ax[0] * s, ax[1] * s, ax[2] * s, math.cos(a / 2))


def quat_mul(q1, q2):
    x1, y1, z1, w1 = q1
    x2, y2, z2, w2 = q2
    return (w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2, w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2, w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2, w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2)


def quat_y(a):
    return quat_axis((0, 1, 0), a)


NAME_TILT = -0.42  # el nombre se inclina hacia atrás: se lee de frente y también desde arriba


def quat_name(a):
    return quat_mul(quat_y(a), quat_axis((1, 0, 0), NAME_TILT))


# ---------- cápsulas que salen de la caja ----------
class Capsules:
    def __init__(self, box_h, n=N_CAPS, seed=11):
        r = random.Random(seed)
        self.h = box_h
        self.caps = []
        for i in range(n):
            ax = np.array([r.uniform(-1, 1), r.uniform(-0.3, 0.3), r.uniform(-1, 1)])
            ax /= np.linalg.norm(ax)
            s = 2.45 + 0.11 * i  # salen una tras otra
            ret = 7.8 + 0.11 * i  # y vuelven antes de que la tapa se cierre (9,6 s)
            self.caps.append({
                "phi": 2 * math.pi * i / n,
                "y": 0.012 + 0.03 * ((i * 4) % n) / (n - 1),
                "axis": tuple(ax),
                "spin": r.uniform(2.2, 3.6) * (1 if i % 2 else -1),
                "start": s, "out": s + 1.0, "back": ret, "end": ret + 0.9,
            })

    def orbit(self, c, t):
        phi = c["phi"] + 0.65 * (t - 2.45)
        return np.array([0.056 * math.cos(phi), c["y"] + 0.004 * math.sin(1.7 * t + c["phi"] * 3), 0.056 * math.sin(phi)])

    def at(self, i, t):
        """(posición, cuaternión, escala) de la cápsula i"""
        c = self.caps[i]
        by = box_at(t)[0]
        # cada cápsula sale de un punto distinto del interior y se curva hacia su órbita (no se cruzan)
        o = self.orbit(c, t)
        inside = np.array([0.007 * math.cos(c["phi"]), self.h * 0.55 + by, 0.007 * math.sin(c["phi"])])
        ctrl = np.array([0.3 * o[0], self.h + 0.07 + by, 0.3 * o[2]])
        if t < c["start"] or t >= c["end"]:
            return inside, (0, 0, 0, 1), TINY

        def bez(a, b, d, u):
            return (1 - u) ** 2 * a + 2 * (1 - u) * u * b + u * u * d

        ang_back = c["spin"] * (c["back"] - c["start"])
        if t < c["out"]:
            u = ease_in_out((t - c["start"]) / (c["out"] - c["start"]))
            pos = bez(inside, ctrl, self.orbit(c, t), u)
            sc = 0.6 + 0.4 * smooth((t - c["start"]) / 0.3)
            ang = c["spin"] * (t - c["start"]) * smooth((t - c["start"]) / 0.8)
        elif t < c["back"]:
            pos, sc = self.orbit(c, t), 1.0
            ang = c["spin"] * (t - c["start"])
        else:
            u = ease_in_out((t - c["back"]) / (c["end"] - c["back"]))
            pos = bez(self.orbit(c, t), ctrl, inside, u)
            sc = 1 - 0.4 * smooth((u - 0.7) / 0.3)
            # vuelve derecha (múltiplo de una vuelta) para entrar en la caja
            target = 2 * math.pi * math.ceil(ang_back / (2 * math.pi)) if ang_back > 0 else 2 * math.pi * math.floor(ang_back / (2 * math.pi))
            ang = ang_back + (target - ang_back) * u
        return pos, quat_axis(c["axis"], ang), max(TINY, sc)


def samples():
    n = int(round(T * FPS))
    return [i / FPS for i in range(n + 1)]


def scene(bm, text):
    """Descripción de la escena: materiales, mallas y nodos (con su animación)."""
    body, inner, lid_out, lid_in = box_parts(bm)
    geom, width = name_geometry(text)
    faces, sides = extrude(geom, NAME_DEPTH)
    rpos, rnor, ridx = ring_mesh(0.028, 0.031)
    cap_top, cap_bottom = capsule_halves()
    H, D = bm.H, bm.D
    base_y = H + 0.045  # el nombre flota por encima del camino de las cápsulas
    caps = Capsules(H)
    meshes = {
        "Cuerpo": [(body[0], body[1], body[3], "caja", body[2])],
        "Interior": [(inner[0], inner[1], inner[3], "carton", None)],
        "Tapa": [(lid_out[0], lid_out[1], lid_out[3], "caja", lid_out[2]), (lid_in[0], lid_in[1], lid_in[3], "carton", None)],
        "Nombre": [(faces[0], faces[1], faces[2], "rojo", None), (sides[0], sides[1], sides[2], "morado", None)],
        "Aro": [(rpos, rnor, ridx, "aro", None)],
        "Capsula": [(cap_top[0], cap_top[1], cap_top[2], "rojo", None), (cap_bottom[0], cap_bottom[1], cap_bottom[2], "capsulaBlanca", None)],
    }
    nodes = [
        {"name": "Caja", "parent": None, "anim": lambda t: ((0, box_at(t)[0], 0), quat_y(box_at(t)[1]), box_at(t)[2])},
        {"name": "Cuerpo", "parent": "Caja", "mesh": "Cuerpo"},
        {"name": "Interior", "parent": "Caja", "mesh": "Interior"},
        {"name": "Tapa", "parent": "Caja", "mesh": "Tapa", "translation": (0, H, -D / 2), "rot": lambda t: quat_axis((1, 0, 0), lid_at(t))},
        {"name": "Nombre", "parent": None, "mesh": "Nombre", "anim": lambda t: ((0, name_at(t, base_y)[0], 0), quat_name(name_at(t, base_y)[1]), name_at(t, base_y)[2])},
        {"name": "Aro", "parent": None, "mesh": "Aro", "anim": lambda t: ((0, 0, 0), (0, 0, 0, 1), ring_at(t))},
    ]
    for i in range(N_CAPS):
        nodes.append({"name": f"Capsula{i + 1}", "parent": None, "mesh": "Capsula", "anim": (lambda k: lambda t: caps.at(k, t))(i)})
    materials = {
        "caja": {"texture": True, "rough": 0.55},
        "carton": {"color": CARDBOARD, "rough": 0.9, "double": True},
        "rojo": {"color": RED, "rough": 0.35},
        "morado": {"color": PURPLE, "rough": 0.5},
        "capsulaBlanca": {"color": CAPSULE_WHITE, "rough": 0.3},
        "aro": {"color": WHITE, "rough": 0.8, "opacity": 0.55, "double": True},
    }
    return meshes, nodes, materials, width


def _time(t):
    return t if t < T - 1e-9 else 0.0  # el último cuadro repite el primero: el ciclo se une sin saltos


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


def write_glb(path, title, bm, jpg_bytes, text):
    meshes, nodes, materials, width = scene(bm, text)
    b = _Bin()
    mat_keys = list(materials)
    gl_mats = []
    for k in mat_keys:
        m = materials[k]
        pbr = {"metallicFactor": 0.0, "roughnessFactor": m["rough"]}
        if m.get("texture"):
            pbr["baseColorTexture"] = {"index": 0}
        else:
            pbr["baseColorFactor"] = [*srgb_to_linear(m["color"]), m.get("opacity", 1.0)]
        g = {"name": k, "pbrMetallicRoughness": pbr}
        if m.get("opacity", 1.0) < 1:
            g["alphaMode"] = "BLEND"
        if m.get("double"):
            g["doubleSided"] = True
        gl_mats.append(g)
    mesh_keys = list(meshes)
    gl_meshes = []
    for k in mesh_keys:
        prims = []
        for pos, nor, idx, mat, uv in meshes[k]:
            attrs = {
                "POSITION": b.add(np.array(pos, np.float32), 5126, "VEC3", 34962, minmax=True),
                "NORMAL": b.add(np.array(nor, np.float32), 5126, "VEC3", 34962),
            }
            if uv is not None:
                attrs["TEXCOORD_0"] = b.add(np.array(uv, np.float32), 5126, "VEC2", 34962)
            ind = b.add(np.array(idx, np.uint16 if max(idx) < 65535 else np.uint32), 5123 if max(idx) < 65535 else 5125, "SCALAR", 34963)
            prims.append({"attributes": attrs, "indices": ind, "material": mat_keys.index(mat)})
        gl_meshes.append({"name": k, "primitives": prims})
    img_view = b.image(jpg_bytes)

    names = [n["name"] for n in nodes]
    gl_nodes = [{"name": title, "children": []}]
    for n in nodes:
        g = {"name": n["name"]}
        if n.get("mesh"):
            g["mesh"] = mesh_keys.index(n["mesh"])
        if n.get("translation"):
            g["translation"] = list(n["translation"])
        if n.get("anim"):
            tr, q, s = n["anim"](0.0)
            g["translation"], g["rotation"], g["scale"] = list(map(float, tr)), list(q), [s] * 3
        gl_nodes.append(g)
    for i, n in enumerate(nodes):
        parent = 0 if n["parent"] is None else names.index(n["parent"]) + 1
        gl_nodes[parent].setdefault("children", []).append(i + 1)

    ts = samples()
    times = b.add(np.array(ts, np.float32), 5126, "SCALAR", minmax=True)
    samplers, channels = [], []

    def channel(node, path_, values, typ):
        samplers.append({"input": times, "output": b.add(np.array(values, np.float32), 5126, typ), "interpolation": "LINEAR"})
        channels.append({"sampler": len(samplers) - 1, "target": {"node": node, "path": path_}})

    for i, n in enumerate(nodes):
        if n.get("anim"):
            vals = [n["anim"](_time(t)) for t in ts]
            channel(i + 1, "translation", [tuple(map(float, v[0])) for v in vals], "VEC3")
            channel(i + 1, "rotation", [v[1] for v in vals], "VEC4")
            channel(i + 1, "scale", [(v[2],) * 3 for v in vals], "VEC3")
        elif n.get("rot"):
            channel(i + 1, "rotation", [n["rot"](_time(t)) for t in ts], "VEC4")

    gltf = {
        "asset": {"version": "2.0", "generator": "Multi LAB (prototipo académico)"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": gl_nodes,
        "meshes": gl_meshes,
        "materials": gl_mats,
        "textures": [{"source": 0, "sampler": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": img_view, "mimeType": "image/jpeg"}],
        "animations": [{"name": "Presentacion", "samplers": samplers, "channels": channels}],
        "extras": {"cicloSegundos": T, "reposo": list(SHOW)},
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
def write_usdz(path, title, bm, jpg_path, text):
    from pxr import Gf, Sdf, Usd, UsdGeom, UsdShade, UsdUtils, Vt

    meshes, nodes, materials, _ = scene(bm, text)
    with tempfile.TemporaryDirectory() as tmp:
        usdc = os.path.join(tmp, "modelo.usdc")
        with open(jpg_path, "rb") as a, open(os.path.join(tmp, "textura.jpg"), "wb") as b_:
            b_.write(a.read())
        stage = Usd.Stage.CreateNew(usdc)
        UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
        UsdGeom.SetStageMetersPerUnit(stage, 1.0)
        stage.SetTimeCodesPerSecond(FPS)
        stage.SetFramesPerSecond(FPS)
        stage.SetStartTimeCode(0)
        stage.SetEndTimeCode(int(round(T * FPS)))
        root = UsdGeom.Xform.Define(stage, "/Producto")
        stage.SetDefaultPrim(root.GetPrim())
        UsdGeom.Scope.Define(stage, "/Producto/Materiales")

        mats = {}
        for k, m in materials.items():
            mat = UsdShade.Material.Define(stage, f"/Producto/Materiales/{k}")
            sh = UsdShade.Shader.Define(stage, f"/Producto/Materiales/{k}/Superficie")
            sh.CreateIdAttr("UsdPreviewSurface")
            sh.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(m["rough"])
            sh.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(0.0)
            if m.get("opacity", 1.0) < 1:
                sh.CreateInput("opacity", Sdf.ValueTypeNames.Float).Set(m["opacity"])
            if m.get("texture"):
                reader = UsdShade.Shader.Define(stage, f"/Producto/Materiales/{k}/LectorST")
                reader.CreateIdAttr("UsdPrimvarReader_float2")
                reader.CreateInput("varname", Sdf.ValueTypeNames.Token).Set("st")
                tx = UsdShade.Shader.Define(stage, f"/Producto/Materiales/{k}/Textura")
                tx.CreateIdAttr("UsdUVTexture")
                tx.CreateInput("file", Sdf.ValueTypeNames.Asset).Set("textura.jpg")
                tx.CreateInput("st", Sdf.ValueTypeNames.Float2).ConnectToSource(reader.ConnectableAPI(), "result")
                tx.CreateInput("wrapS", Sdf.ValueTypeNames.Token).Set("clamp")
                tx.CreateInput("wrapT", Sdf.ValueTypeNames.Token).Set("clamp")
                tx.CreateOutput("rgb", Sdf.ValueTypeNames.Float3)
                sh.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).ConnectToSource(tx.ConnectableAPI(), "rgb")
            else:
                sh.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(*m["color"]))
            mat.CreateSurfaceOutput().ConnectToSource(sh.ConnectableAPI(), "surface")
            mats[k] = (mat, m.get("double", False))

        paths = {}
        ts = samples()
        for n in nodes:
            parent = "/Producto" if n["parent"] is None else paths[n["parent"]]
            p = f"{parent}/{n['name']}"
            paths[n["name"]] = p
            x = UsdGeom.Xform.Define(stage, p)
            if n.get("anim"):
                t_op, r_op, s_op = x.AddTranslateOp(), x.AddOrientOp(), x.AddScaleOp()
                for i, t in enumerate(ts):
                    tr, q, s = n["anim"](_time(t))
                    t_op.Set(Gf.Vec3f(*map(float, tr)), i)
                    r_op.Set(Gf.Quatf(q[3], q[0], q[1], q[2]), i)
                    s_op.Set(Gf.Vec3f(s, s, s), i)
            else:
                if n.get("translation"):
                    x.AddTranslateOp().Set(Gf.Vec3f(*n["translation"]))
                if n.get("rot"):
                    r_op = x.AddOrientOp()
                    for i, t in enumerate(ts):
                        q = n["rot"](_time(t))
                        r_op.Set(Gf.Quatf(q[3], q[0], q[1], q[2]), i)
            for j, (pos, nor, idx, mk, uv) in enumerate(meshes.get(n.get("mesh"), [])):
                m = UsdGeom.Mesh.Define(stage, f"{p}/Malla{j + 1}")
                m.CreatePointsAttr(Vt.Vec3fArray([Gf.Vec3f(*map(float, v)) for v in pos]))
                m.CreateFaceVertexCountsAttr(Vt.IntArray([3] * (len(idx) // 3)))
                m.CreateFaceVertexIndicesAttr(Vt.IntArray([int(i) for i in idx]))
                m.CreateSubdivisionSchemeAttr("none")
                arr = np.array(pos, float)
                m.CreateExtentAttr([Gf.Vec3f(*arr.min(axis=0)), Gf.Vec3f(*arr.max(axis=0))])
                mat, double = mats[mk]
                if double:
                    m.CreateDoubleSidedAttr(True)
                api = UsdGeom.PrimvarsAPI(m)
                api.CreatePrimvar("normals", Sdf.ValueTypeNames.Normal3fArray, UsdGeom.Tokens.vertex).Set(Vt.Vec3fArray([Gf.Vec3f(*map(float, v)) for v in nor]))
                if uv is not None:
                    api.CreatePrimvar("st", Sdf.ValueTypeNames.TexCoord2fArray, UsdGeom.Tokens.vertex).Set(Vt.Vec2fArray([Gf.Vec2f(u, 1 - v) for u, v in uv]))
                UsdShade.MaterialBindingAPI.Apply(m.GetPrim()).Bind(mat)
        stage.GetRootLayer().Save()
        if not UsdUtils.CreateNewARKitUsdzPackage(Sdf.AssetPath(usdc), path):
            raise SystemExit(f"No se pudo crear {path}")
