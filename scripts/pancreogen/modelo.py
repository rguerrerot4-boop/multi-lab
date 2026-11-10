"""Modelos de AR de PANCREOGEN (GLB para Android, USDZ para iPhone) con la etiqueta fotografiada.

El frasco es un cilindro con la etiqueta reconstruida en limpio (texturas.py → etiqueta_limpia.py) y una
tapa plateada metalizada con la foto de la tapa. Animación propia, distinta de la de CORAESSENS (ciclo de 12 s):
  0,0–1,4 s   el frasco sube girando desde el piso, sobre un aro que ya está a tamaño real (así los visores
              de AR miden bien el modelo: tamaño real del frasco, 4 × 12,4 cm)
  0,8–1,6 s   aparece un anillo con el nombre en 3D alrededor del frasco
  1,6–10,8 s  función (tramo que se repite sin cortes; la AR con tarjeta repite solo este tramo):
              la tapa se desenrosca (1,9 s) y queda flotando de lado; salen 12 cápsulas en espiral
              (3,1 s), giran alrededor del frasco a distintas alturas, vuelven a entrar (7,6 s) y la tapa
              se enrosca de nuevo (9,0 s). El anillo del nombre da una vuelta en sentido contrario.
  10,8–11,6 s el frasco y el anillo bajan; 11,6–12 s pausa
Las cápsulas son ilustrativas (blanco y teal, colores de la etiqueta; no representan la cápsula real).
Genera pan (PANCREOGEN, real) y pan-f (PANCRIVA, ficticio) en ar/models, y pan-estatico.glb /
pan-f-estatico.glb (sin animación) en scratch para los renders de la app.
Uso: python3 scripts/pancreogen/modelo.py <carpeta texturas> [<carpeta para los estáticos>]
"""
import json
import math
import os
import random
import struct
import sys
import tempfile

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'coraessens'))
import animacion as A  # noqa: E402  (texto 3D, cápsula, curvas de animación, cuaterniones)

OUT = os.path.join(ROOT, 'ar', 'models')
T, FPS = 12.0, 30
SHOW = (1.6, 10.8)
TINY = 0.0001
# escala para los visores de AR del sistema (Scene Viewer y AR Quick Look): el frasco se veía pequeño al
# proyectarlo. Va multiplicada en las coordenadas del modelo animado (`bake_scale`), no como escala de un nodo.
# La ficha web (bottleGL), la AR con tarjeta y los cuadros leen `escalaAR` del nodo raíz y lo ponen a 1/escalaAR.
AR_SCALE = 2.5
# ancho de la caja de encuadre (`Limites`) en radios del frasco
LIMITES_MARGEN = 1.6

# medidas (m): diámetro de 4 cm; las proporciones salen de las fotos (cuerpo 2,39 diámetros, tapa 0,7)
R = 0.020
HB = 0.0956  # cuerpo (de la base al borde de la tapa)
RC = 0.0204  # tapa
HC = 0.028
EDGE = 0.0028  # redondeo del borde de la base
TEAL = (0.10, 0.36, 0.37)
TEAL_DEEP = (0.05, 0.22, 0.23)
WHITE = (0.97, 0.97, 0.96)
SILVER = (0.66, 0.67, 0.69)  # plástico plateado mate (sRGB)
N_CAPS = 12


# ---------- geometría ----------
def body_mesh(seg=144):
    """Lado del frasco (con el redondeo de la base) con la etiqueta como textura, y la base."""
    prof = [(R, HB)]  # (radio, altura) de arriba hacia abajo
    for k in range(0, 7):
        a = (math.pi / 2) * k / 6
        prof.append((R - EDGE + EDGE * math.cos(a), EDGE - EDGE * math.sin(a)))
    nrm = [(1.0, 0.0)] + [(math.cos((math.pi / 2) * k / 6), -math.sin((math.pi / 2) * k / 6)) for k in range(0, 7)]
    # v de la textura: 0 en el borde de la tapa, 1 en el borde inferior (largo de arco)
    L = [0.0]
    for i in range(1, len(prof)):
        L.append(L[-1] + math.dist(prof[i], prof[i - 1]))
    pos, nor, uv, idx = [], [], [], []
    for j, ((r, h), (nr, nh)) in enumerate(zip(prof, nrm)):
        for s in range(seg + 1):
            u = s / seg
            th = (u - 0.5) * 2 * math.pi  # u = 0,5 es el frente (+z)
            pos.append((r * math.sin(th), h, r * math.cos(th)))
            nor.append((nr * math.sin(th), nh, nr * math.cos(th)))
            uv.append((u, L[j] / L[-1]))
    for j in range(len(prof) - 1):
        for s in range(seg):
            a, b = j * (seg + 1) + s, j * (seg + 1) + s + 1
            c, d = a + seg + 1, b + seg + 1
            idx += [a, c, b, b, c, d]
    side = (pos, nor, uv, idx)
    # base
    bp, bn, bi = [(0.0, 0.0, 0.0)], [(0, -1, 0)], []
    rr = R - EDGE
    for s in range(seg):
        th = 2 * math.pi * s / seg
        bp.append((rr * math.sin(th), 0.0, rr * math.cos(th)))
        bn.append((0, -1, 0))
    for s in range(seg):
        bi += [0, 1 + (s + 1) % seg, 1 + s]
    return side, (bp, bn, None, bi)


def mouth_mesh(seg=96):
    """Boca del frasco (se ve al quitar la tapa): borde blanco y el interior oscuro un poco más abajo."""
    ri = R * 0.72
    rim_p, rim_n, rim_i = [], [], []
    for s in range(seg):
        th = 2 * math.pi * s / seg
        for rr in (ri, R):
            rim_p.append((rr * math.sin(th), HB, rr * math.cos(th)))
            rim_n.append((0, 1, 0))
    for s in range(seg):
        a, b = 2 * s, 2 * ((s + 1) % seg)
        rim_i += [a, b, a + 1, b, b + 1, a + 1]
    # pared interior del cuello y fondo oscuro
    wall_p, wall_n, wall_i = [], [], []
    depth = 0.006
    for s in range(seg):
        th = 2 * math.pi * s / seg
        for h in (HB, HB - depth):
            wall_p.append((ri * math.sin(th), h, ri * math.cos(th)))
            wall_n.append((-math.sin(th), 0, -math.cos(th)))
    for s in range(seg):
        a, b = 2 * s, 2 * ((s + 1) % seg)
        wall_i += [a, a + 1, b, b, a + 1, b + 1]
    hole_p, hole_n, hole_i = [(0.0, HB - depth, 0.0)], [(0, 1, 0)], []
    for s in range(seg):
        th = 2 * math.pi * s / seg
        hole_p.append((ri * math.sin(th), HB - depth, ri * math.cos(th)))
        hole_n.append((0, 1, 0))
    for s in range(seg):
        hole_i += [0, 1 + s, 1 + (s + 1) % seg]
    return (rim_p, rim_n, None, rim_i), (wall_p, wall_n, None, wall_i), (hole_p, hole_n, None, hole_i)


def cap_profile():
    """Perfil (radio, altura) de la tapa, de abajo hacia arriba, como la tapa real (fotos IMG_2313/2336):
    plástico plateado mate, lado recto con un leve bisel abajo, tres ondas muy suaves en el tercio de arriba
    y el borde superior redondeado. Las normales salen de la pendiente del perfil."""
    e = 0.0018  # radio del borde de arriba
    pts = [(RC * 0.982, 0.0), (RC * 0.996, 0.0004), (RC, 0.0010)]
    top0, top1 = HC * 0.55, HC * 0.86  # franja con ondas
    n = 48
    for i in range(1, n + 1):
        h = 0.0010 + (HC - e - 0.0010) * i / n
        r = RC
        if top0 < h < top1:
            t = (h - top0) / (top1 - top0)
            r += 0.00005 * math.sin(t * 2 * 2 * math.pi) * math.sin(t * math.pi)
        pts.append((r, h))
    for k in range(1, 9):
        a = (math.pi / 2) * k / 8
        pts.append((RC - e + e * math.cos(a), HC - e + e * math.sin(a)))
    nrm = []
    for i, (r, h) in enumerate(pts):
        r0, h0 = pts[max(0, i - 1)]
        r1, h1 = pts[min(len(pts) - 1, i + 1)]
        dr, dh = r1 - r0, h1 - h0
        L = math.hypot(dr, dh) or 1
        nrm.append((dh / L, -dr / L))
    nrm[-1] = (0.0, 1.0)
    return pts, nrm, RC - e


def cap_mesh(seg=144):
    """Tapa: lado plateado mate y la cara de arriba con la foto (con el logotipo en relieve)."""
    prof, nrm, rt = cap_profile()
    pos, nor, uv, idx = [], [], [], []
    for (r, h), (nr, nh) in zip(prof, nrm):
        for s in range(seg + 1):
            th = 2 * math.pi * s / seg
            pos.append((r * math.sin(th), h, r * math.cos(th)))
            nor.append((nr * math.sin(th), nh, nr * math.cos(th)))
            uv.append((s / seg, 1 - h / HC))
    # el perfil va de abajo hacia arriba (al revés que el del cuerpo): el orden de los vértices se invierte
    # para que las caras miren hacia afuera (antes miraban hacia adentro y desde arriba la tapa se veía hueca)
    for j in range(len(prof) - 1):
        for s in range(seg):
            a, b = j * (seg + 1) + s, j * (seg + 1) + s + 1
            c, d = a + seg + 1, b + seg + 1
            idx += [a, b, c, b, d, c]
    side = (pos, nor, uv, idx)
    tp, tn, tu, ti = [(0.0, HC, 0.0)], [(0, 1, 0)], [(0.5, 0.5)], []
    for s in range(seg):
        th = 2 * math.pi * s / seg
        x, z = rt * math.sin(th), rt * math.cos(th)
        tp.append((x, HC, z))
        tn.append((0, 1, 0))
        # la foto de la tapa mira hacia el frente (z+ abajo en la imagen)
        tu.append((0.5 + 0.5 * x / rt, 0.5 + 0.5 * z / rt))
    for s in range(seg):
        ti += [0, 1 + s, 1 + (s + 1) % seg]
    # cara de abajo (se ve si se mira la tapa suelta desde abajo, por ejemplo en realidad aumentada)
    bp, bn, bi = [(0.0, 0.0012, 0.0)], [(0, -1, 0)], []
    for s in range(seg):
        th = 2 * math.pi * s / seg
        bp.append((RC * 0.975 * math.sin(th), 0.0012, RC * 0.975 * math.cos(th)))
        bn.append((0, -1, 0))
    for s in range(seg):
        bi += [0, 1 + (s + 1) % seg, 1 + s]
    return side, (tp, tn, tu, ti), (bp, bn, None, bi)


def ring_text(text, radius=0.034, height=0.0075, depth=0.0024):
    """Texto curvado en un anillo alrededor del frasco (frente blanco y canto teal)."""
    geom, width = A.text_polygons(text, height)
    # el anillo se completa con el texto repetido para que dé toda la vuelta
    reps = max(1, int((2 * math.pi * radius) // (width * 1.04)))
    k = (2 * math.pi * radius) / (reps * width * 1.04)
    faces = ([], [], [], [])
    sides = ([], [], [], [])

    def bend(x, y, z):
        a = x / radius
        rr = radius + z
        return (rr * math.sin(a), y, rr * math.cos(a)), a

    for rep in range(reps):
        off = rep * width * 1.04 * k
        for part, z0, z1 in (('front', depth, None), ('walls', depth, 0.0)):
            if part == 'front':
                p, n, uv, ix = A.cap(geom, z0, True)
                base = len(faces[0])
                for (x, y, z) in p:
                    q, a = bend(x * k + off, y - height / 2, z)
                    faces[0].append(q)
                    faces[1].append((math.sin(a), 0.0, math.cos(a)))
                faces[3].extend(i + base for i in ix)
            else:
                p, n, uv, ix = A.walls(geom, z0, z1)
                base = len(sides[0])
                for (x, y, z), (nx, ny, nz) in zip(p, n):
                    q, a = bend(x * k + off, y - height / 2, z)
                    sides[0].append(q)
                    # gira la normal del plano del texto al anillo
                    sides[1].append((nx * math.cos(a) + nz * math.sin(a), ny, -nx * math.sin(a) + nz * math.cos(a)))
                sides[3].extend(i + base for i in ix)
    return faces, sides


def ring_mesh(r_in, r_out, seg=96):
    pos, nor, idx = [], [], []
    for s in range(seg):
        a = 2 * math.pi * s / seg
        for r in (r_in, r_out):
            pos.append((r * math.cos(a), 0.0005, r * math.sin(a)))
            nor.append((0, 1, 0))
    for s in range(seg):
        a, b = 2 * s, 2 * ((s + 1) % seg)
        idx += [a, a + 1, b, b, a + 1, b + 1]
    return pos, nor, idx


# ---------- línea de tiempo ----------
smooth, eo, ei, eio, eob, clamp = A.smooth, A.ease_out_cubic, A.ease_in_cubic, A.ease_in_out, A.ease_out_back, A.clamp01
qa, qm, qy = A.quat_axis, A.quat_mul, A.quat_y
SPAN = SHOW[1] - SHOW[0]


def bottle_at(t):
    """(altura, giro, escala) del frasco"""
    if t < SHOW[0]:
        k = clamp(t / 1.4)
        return -0.02 * (1 - eo(k)), 2 * math.pi * eo(k), max(TINY, eob(k))
    if t < SHOW[1]:
        u = t - SHOW[0]
        return 0.004 * math.sin(2 * math.pi * u / (SPAN / 2)), 2 * math.pi * u / SPAN, 1.0
    k = clamp((t - SHOW[1]) / 0.8)
    return -0.02 * ei(k), 0.0, max(TINY, 1 - ei(k))


UNSCREW = (1.9, 2.9)
FLOAT_UP = (2.9, 3.5)
FLOAT_DOWN = (8.6, 9.1)
SCREW = (9.1, 10.1)
CAP_TURNS = 1.5
CAP_FLOAT = (0.026, 0.05, -0.30)  # (x, altura sobre el cierre, inclinación) de la tapa flotando


def cap_at(t):
    """(posición relativa al frasco, cuaternión) de la tapa"""
    closed = ((0.0, HB, 0.0), (0, 0, 0, 1))
    fx, fy, ftilt = CAP_FLOAT
    lift = 0.006
    if t < UNSCREW[0] or t >= SCREW[1]:
        return closed
    if t < UNSCREW[1]:
        k = eio((t - UNSCREW[0]) / (UNSCREW[1] - UNSCREW[0]))
        return (0.0, HB + lift * k, 0.0), qy(-2 * math.pi * CAP_TURNS * k)
    if t < FLOAT_UP[1]:
        k = eio((t - FLOAT_UP[0]) / (FLOAT_UP[1] - FLOAT_UP[0]))
        return (fx * k, HB + lift + (fy - lift) * k, 0.0), qa((0, 0, 1), ftilt * k)
    if t < FLOAT_DOWN[0]:
        u = t - FLOAT_UP[1]
        return (fx, HB + fy + 0.003 * math.sin(2.2 * u), 0.0), qm(qa((0, 0, 1), ftilt + 0.06 * math.sin(1.6 * u)), qy(0.25 * math.sin(0.9 * u)))
    if t < FLOAT_DOWN[1]:
        k = eio((t - FLOAT_DOWN[0]) / (FLOAT_DOWN[1] - FLOAT_DOWN[0]))
        u = FLOAT_DOWN[0] - FLOAT_UP[1]
        y0 = HB + fy + 0.003 * math.sin(2.2 * u)
        return (fx * (1 - k), y0 + (HB + lift - y0) * k, 0.0), qa((0, 0, 1), ftilt * (1 - k))
    k = eio((t - SCREW[0]) / (SCREW[1] - SCREW[0]))
    return (0.0, HB + lift * (1 - k), 0.0), qy(-2 * math.pi * CAP_TURNS * (1 - k))


def ring_at(t):
    """(altura, giro, escala) del anillo del nombre"""
    y = HB * 0.42
    if t < 0.8:
        return y, 0.0, TINY
    if t < SHOW[0]:
        k = (t - 0.8) / (SHOW[0] - 0.8)
        return y - 0.01 * (1 - eo(k)), -0.8 * (1 - eo(k)), max(TINY, eob(k))
    if t < SHOW[1]:
        return y + 0.0025 * math.sin(2 * math.pi * (t - SHOW[0]) / (SPAN / 3)), -2 * math.pi * (t - SHOW[0]) / SPAN, 1.0
    k = clamp((t - SHOW[1]) / 0.6)
    return y + 0.02 * ei(k), 0.0, max(TINY, 1 - ei(k))


def floor_ring(t):
    # el aro del piso está siempre a tamaño real: así el primer cuadro de la animación ya mide lo que el
    # frasco (si todo empieza diminuto, Scene Viewer y AR Quick Look calculan el tamaño con ese cuadro y
    # agrandan el modelo, que al crecer se ve enorme)
    return 1.0


class Capsules:
    """12 cápsulas: salen por la boca del frasco en espiral, giran alrededor a distintas alturas y vuelven."""

    def __init__(self, n=N_CAPS, seed=7):
        r = random.Random(seed)
        self.caps = []
        for i in range(n):
            ax = np.array([r.uniform(-1, 1), r.uniform(-0.4, 0.4), r.uniform(-1, 1)])
            ax /= np.linalg.norm(ax)
            s = 3.1 + 0.12 * i
            back = 7.4 + 0.08 * i
            self.caps.append({
                'phi': 2 * math.pi * i / n * 2.5,  # dos vueltas y media de espiral entre la primera y la última
                'y': HB * (0.15 + 0.85 * i / (n - 1)),
                'r': 0.046 + 0.008 * ((i * 5) % 3) / 2,
                'axis': tuple(ax),
                'spin': r.uniform(2.0, 3.4) * (1 if i % 2 else -1),
                'start': s, 'out': s + 1.1, 'back': back, 'end': back + 1.0,
            })

    def orbit(self, c, t):
        phi = c['phi'] + 0.75 * (t - 3.1)
        return np.array([c['r'] * math.sin(phi), c['y'] + 0.003 * math.sin(1.9 * t + c['phi']), c['r'] * math.cos(phi)])

    def at(self, i, t):
        c = self.caps[i]
        by = bottle_at(t)[0]
        inside = np.array([0.0, HB * 0.6 + by, 0.0])
        mouth = np.array([0.0, HB + 0.03 + by, 0.0])

        def bez(a, b, d, u):
            return (1 - u) ** 2 * a + 2 * (1 - u) * u * b + u * u * d

        if t < c['start'] or t >= c['end']:
            return inside, (0, 0, 0, 1), TINY
        ang_back = c['spin'] * (c['back'] - c['start'])
        if t < c['out']:
            u = eio((t - c['start']) / (c['out'] - c['start']))
            o = self.orbit(c, t)
            o[1] += by
            pos = bez(inside, mouth, o, u)
            sc = 0.55 + 0.45 * smooth((t - c['start']) / 0.35)
            ang = c['spin'] * (t - c['start']) * smooth((t - c['start']) / 0.8)
        elif t < c['back']:
            pos = self.orbit(c, t)
            pos[1] += by
            sc = 1.0
            ang = c['spin'] * (t - c['start'])
        else:
            u = eio((t - c['back']) / (c['end'] - c['back']))
            o = self.orbit(c, t)
            o[1] += by
            pos = bez(o, mouth, inside, u)
            sc = 1 - 0.45 * smooth((u - 0.7) / 0.3)
            target = 2 * math.pi * (math.ceil(ang_back / (2 * math.pi)) if ang_back > 0 else math.floor(ang_back / (2 * math.pi)))
            ang = ang_back + (target - ang_back) * u
        return pos, qa(c['axis'], ang), max(TINY, sc)


def scene(name_text, prefix, animated=True):
    side, base = body_mesh()
    cside, ctop, cbot = cap_mesh()
    faces, sides = ring_text(name_text)
    rp, rn, ri = ring_mesh(0.030, 0.033)
    ctop_half, cbot_half = A.capsule_halves(length=0.0217, radius=0.0038)
    rim, wall, hole = mouth_mesh()
    meshes = {
        'Cuerpo': [
            (side[0], side[1], side[3], 'etiqueta', side[2]),
            (base[0], base[1], base[3], 'blanco', None),
            (rim[0], rim[1], rim[3], 'blanco', None),
            (wall[0], wall[1], wall[3], 'interior', None),
            (hole[0], hole[1], hole[3], 'interior', None),
        ],
        'Tapa': [(cside[0], cside[1], cside[3], 'plata', cside[2]), (ctop[0], ctop[1], ctop[3], 'tapaFoto', ctop[2]), (cbot[0], cbot[1], cbot[3], 'interior', None)],
    }
    nodes = [
        {'name': 'Frasco', 'parent': None, 'anim': (lambda t: ((0, bottle_at(t)[0], 0), qy(bottle_at(t)[1]), bottle_at(t)[2])) if animated else None},
        {'name': 'Cuerpo', 'parent': 'Frasco', 'mesh': 'Cuerpo'},
        {'name': 'Tapa', 'parent': 'Frasco', 'mesh': 'Tapa', 'anim': (lambda t: (cap_at(t)[0], cap_at(t)[1], 1.0)) if animated else None, 'translation': (0, HB, 0)},
    ]
    materials = {
        # la etiqueta es papel plastificado brillante (capa transparente); la tapa, plástico plateado metalizado
        'etiqueta': {'texture': f'{prefix}etiqueta', 'rough': 0.34, 'clearcoat': (0.7, 0.14)},
        'blanco': {'color': WHITE, 'rough': 0.38},
        'interior': {'color': (0.16, 0.2, 0.21), 'rough': 0.8},
        # la tapa es plástico plateado mate (no metal pulido): poco metálica y rugosa, así se ve igual en
        # cualquier visor (catálogo, Scene Viewer, AR Quick Look) sin reflejos de lámparas
        'plata': {'texture': 'tapaLado', 'rough': 0.5, 'metal': 0.38},
        'tapaFoto': {'texture': f'{prefix}tapa', 'rough': 0.52, 'metal': 0.34},
    }
    if animated:
        meshes['Nombre'] = [(faces[0], faces[1], faces[3], 'nombreFrente', None), (sides[0], sides[1], sides[3], 'nombreCanto', None)]
        meshes['Aro'] = [(rp, rn, ri, 'aro', None)]
        meshes['Capsula'] = [(ctop_half[0], ctop_half[1], ctop_half[2], 'capsulaTeal', None), (cbot_half[0], cbot_half[1], cbot_half[2], 'capsulaBlanca', None)]
        nodes.append({'name': 'Nombre', 'parent': None, 'mesh': 'Nombre', 'anim': lambda t: ((0, ring_at(t)[0], 0), qy(ring_at(t)[1]), ring_at(t)[2])})
        nodes.append({'name': 'Aro', 'parent': None, 'mesh': 'Aro', 'anim': lambda t: ((0, 0, 0), (0, 0, 0, 1), floor_ring(t))})
        caps = Capsules()
        for i in range(N_CAPS):
            nodes.append({'name': f'Capsula{i + 1}', 'parent': None, 'mesh': 'Capsula', 'anim': (lambda k: lambda t: caps.at(k, t))(i)})
        # «Limites»: un triángulo sin área (no se ve ni da sombra) que fija la caja con que AR Quick Look (modo
        # Objeto) y Scene Viewer encuadran la cámara. Ellos miden el primer cuadro, en el que el frasco aún es
        # diminuto: sin esto la cámara quedaba pegada. La caja es la del frasco cerrado con un poco de margen, para que
        # el frasco se vea grande; al abrirse, la tapa y las cápsulas pueden salirse un poco del encuadre.
        mn = (-R * LIMITES_MARGEN, -0.02, -R * LIMITES_MARGEN)
        mx = (R * LIMITES_MARGEN, (HB + HC) * 1.08, R * LIMITES_MARGEN)
        meshes['Limites'] = [([mn, mx, mx], [(0, 1, 0)] * 3, [0, 1, 2], 'aro', None)]
        nodes.append({'name': 'Limites', 'parent': None, 'mesh': 'Limites'})
        materials.update({
            'nombreFrente': {'color': WHITE, 'rough': 0.35},
            'nombreCanto': {'color': TEAL, 'rough': 0.4},
            'aro': {'color': (1, 1, 1), 'rough': 0.8, 'opacity': 0.55, 'double': True},
            'capsulaTeal': {'color': TEAL, 'rough': 0.28},
            'capsulaBlanca': {'color': (0.97, 0.96, 0.95), 'rough': 0.28},
        })
    return meshes, nodes, materials



def bake_scale(sc, k):
    """Escala el modelo animado multiplicando las coordenadas (mallas y traslaciones), sin transformación de
    escala en ningún nodo padre: así el tamaño es el mismo en cualquier visor (AR Quick Look puede ignorar la escala
    de un nodo contenedor y seguía mostrando el frasco pequeño)."""
    meshes, nodes, materials = sc
    meshes = {name: [([tuple(np.array(v, float) * k) for v in pos], nor, idx, mat, uv) for pos, nor, idx, mat, uv in prims]
              for name, prims in meshes.items()}
    out = []
    for n in nodes:
        n = dict(n)
        if n.get('translation'):
            n['translation'] = tuple(float(v) * k for v in n['translation'])
        if n.get('anim'):
            n['anim'] = (lambda f: lambda t: (lambda tr, q, s_: (tuple(float(v) * k for v in tr), q, s_))(*f(t)))(n['anim'])
        out.append(n)
    return meshes, out, materials

def _time(t):
    return t if t < T - 1e-9 else 0.0


def write_glb(path, title, scene_, images, animated=True):
    meshes, nodes, materials = scene_
    b = A._Bin()
    tex_keys = list(images)
    mat_keys = list(materials)
    gl_mats = []
    for k in mat_keys:
        m = materials[k]
        pbr = {'metallicFactor': m.get('metal', 0.0), 'roughnessFactor': m['rough']}
        if m.get('texture'):
            pbr['baseColorTexture'] = {'index': tex_keys.index(m['texture'])}
        else:
            pbr['baseColorFactor'] = [*A.srgb_to_linear(m['color']), m.get('opacity', 1.0)]
        g = {'name': k, 'pbrMetallicRoughness': pbr}
        if m.get('opacity', 1.0) < 1:
            g['alphaMode'] = 'BLEND'
        if m.get('double'):
            g['doubleSided'] = True
        if m.get('clearcoat'):
            g['extensions'] = {'KHR_materials_clearcoat': {'clearcoatFactor': m['clearcoat'][0], 'clearcoatRoughnessFactor': m['clearcoat'][1]}}
        gl_mats.append(g)
    mesh_keys = list(meshes)
    gl_meshes = []
    for k in mesh_keys:
        prims = []
        for pos, nor, idx, mat, uv in meshes[k]:
            attrs = {
                'POSITION': b.add(np.array(pos, np.float32), 5126, 'VEC3', 34962, minmax=True),
                'NORMAL': b.add(np.array(nor, np.float32), 5126, 'VEC3', 34962),
            }
            if uv is not None:
                attrs['TEXCOORD_0'] = b.add(np.array(uv, np.float32), 5126, 'VEC2', 34962)
            big = max(idx) >= 65535
            ind = b.add(np.array(idx, np.uint32 if big else np.uint16), 5125 if big else 5123, 'SCALAR', 34963)
            prims.append({'attributes': attrs, 'indices': ind, 'material': mat_keys.index(mat)})
        gl_meshes.append({'name': k, 'primitives': prims})
    img_views = [b.image(images[k][0]) for k in tex_keys]
    names = [n['name'] for n in nodes]
    gl_nodes = [{'name': title, 'children': []}]
    if animated:
        # el modelo de AR viene agrandado (`bake_scale`); quien necesite el tamaño real pone este nodo a 1/escalaAR
        gl_nodes[0]['extras'] = {'escalaAR': AR_SCALE}
    for n in nodes:
        g = {'name': n['name']}
        if n.get('mesh'):
            g['mesh'] = mesh_keys.index(n['mesh'])
        if n.get('translation'):
            g['translation'] = list(n['translation'])
        if n.get('anim'):
            # pose de reposo = frasco completo y cerrado (la animación la reemplaza al reproducirse); los visores
            # que miden el modelo antes de animarlo ven su tamaño real
            tr, q, s = n['anim'](SHOW[0])
            g['translation'], g['rotation'], g['scale'] = list(map(float, tr)), list(q), [s] * 3
        gl_nodes.append(g)
    for i, n in enumerate(nodes):
        parent = 0 if n['parent'] is None else names.index(n['parent']) + 1
        gl_nodes[parent].setdefault('children', []).append(i + 1)
    gltf = {
        'asset': {'version': '2.0', 'generator': 'Multi LAB (prototipo académico)'},
        'scene': 0,
        'scenes': [{'nodes': [0]}],
        'nodes': gl_nodes,
        'meshes': gl_meshes,
        'materials': gl_mats,
        'textures': [{'source': i, 'sampler': 0} for i in range(len(tex_keys))],
        'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
        'images': [{'bufferView': img_views[i], 'mimeType': images[k][1]} for i, k in enumerate(tex_keys)],
    }
    if any(m.get('clearcoat') for m in materials.values()):
        gltf['extensionsUsed'] = ['KHR_materials_clearcoat']
    if animated:
        ts = [i / FPS for i in range(int(round(T * FPS)) + 1)]
        times = b.add(np.array(ts, np.float32), 5126, 'SCALAR', minmax=True)
        samplers, channels = [], []

        def channel(node, path_, values, typ):
            samplers.append({'input': times, 'output': b.add(np.array(values, np.float32), 5126, typ), 'interpolation': 'LINEAR'})
            channels.append({'sampler': len(samplers) - 1, 'target': {'node': node, 'path': path_}})

        for i, n in enumerate(nodes):
            if n.get('anim'):
                vals = [n['anim'](_time(t)) for t in ts]
                channel(i + 1, 'translation', [tuple(map(float, v[0])) for v in vals], 'VEC3')
                channel(i + 1, 'rotation', A._continuous([v[1] for v in vals]), 'VEC4')
                channel(i + 1, 'scale', [(v[2],) * 3 for v in vals], 'VEC3')
        gltf['animations'] = [{'name': 'Presentacion', 'samplers': samplers, 'channels': channels}]
        gltf['extras'] = {'cicloSegundos': T, 'reposo': list(SHOW)}
    gltf['buffers'] = [{'byteLength': len(b.data)}]
    gltf['bufferViews'] = b.views
    gltf['accessors'] = b.accessors
    js = A._pad(json.dumps(gltf, separators=(',', ':')).encode(), b' ')
    total = 12 + 8 + len(js) + 8 + len(b.data)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(b.data), 0x004E4942) + b.data)


def write_usdz(path, scene_, files):
    """files: {clave de textura: ruta del jpg}"""
    from pxr import Gf, Sdf, Usd, UsdGeom, UsdShade, UsdUtils, Vt

    meshes, nodes, materials = scene_
    with tempfile.TemporaryDirectory() as tmp:
        usdc = os.path.join(tmp, 'modelo.usdc')
        local = {}
        for k, src in files.items():
            local[k] = f'{k}.jpg'
            with open(src, 'rb') as a, open(os.path.join(tmp, local[k]), 'wb') as b_:
                b_.write(a.read())
        stage = Usd.Stage.CreateNew(usdc)
        UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
        UsdGeom.SetStageMetersPerUnit(stage, 1.0)
        stage.SetTimeCodesPerSecond(FPS)
        stage.SetFramesPerSecond(FPS)
        stage.SetStartTimeCode(0)
        stage.SetEndTimeCode(int(round(T * FPS)))
        root = UsdGeom.Xform.Define(stage, '/Producto')
        UsdGeom.Xform.Define(stage, '/Producto/Escala')  # sin transformación: la escala ya va en las coordenadas
        stage.SetDefaultPrim(root.GetPrim())
        UsdGeom.Scope.Define(stage, '/Producto/Materiales')
        mats = {}
        for k, m in materials.items():
            mat = UsdShade.Material.Define(stage, f'/Producto/Materiales/{k}')
            sh = UsdShade.Shader.Define(stage, f'/Producto/Materiales/{k}/Superficie')
            sh.CreateIdAttr('UsdPreviewSurface')
            sh.CreateInput('roughness', Sdf.ValueTypeNames.Float).Set(m['rough'])
            sh.CreateInput('metallic', Sdf.ValueTypeNames.Float).Set(m.get('metal', 0.0))
            if m.get('opacity', 1.0) < 1:
                sh.CreateInput('opacity', Sdf.ValueTypeNames.Float).Set(m['opacity'])
            if m.get('clearcoat'):
                sh.CreateInput('clearcoat', Sdf.ValueTypeNames.Float).Set(m['clearcoat'][0])
                sh.CreateInput('clearcoatRoughness', Sdf.ValueTypeNames.Float).Set(m['clearcoat'][1])
            if m.get('texture'):
                reader = UsdShade.Shader.Define(stage, f'/Producto/Materiales/{k}/LectorST')
                reader.CreateIdAttr('UsdPrimvarReader_float2')
                reader.CreateInput('varname', Sdf.ValueTypeNames.Token).Set('st')
                tx = UsdShade.Shader.Define(stage, f'/Producto/Materiales/{k}/Textura')
                tx.CreateIdAttr('UsdUVTexture')
                tx.CreateInput('file', Sdf.ValueTypeNames.Asset).Set(local[m['texture']])
                tx.CreateInput('st', Sdf.ValueTypeNames.Float2).ConnectToSource(reader.ConnectableAPI(), 'result')
                tx.CreateInput('wrapS', Sdf.ValueTypeNames.Token).Set('clamp')
                tx.CreateInput('wrapT', Sdf.ValueTypeNames.Token).Set('clamp')
                tx.CreateOutput('rgb', Sdf.ValueTypeNames.Float3)
                sh.CreateInput('diffuseColor', Sdf.ValueTypeNames.Color3f).ConnectToSource(tx.ConnectableAPI(), 'rgb')
            else:
                sh.CreateInput('diffuseColor', Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(*m['color']))
            mat.CreateSurfaceOutput().ConnectToSource(sh.ConnectableAPI(), 'surface')
            mats[k] = (mat, m.get('double', False))
        paths = {}
        ts = [i / FPS for i in range(int(round(T * FPS)) + 1)]
        for n in nodes:
            parent = '/Producto/Escala' if n['parent'] is None else paths[n['parent']]
            p = f"{parent}/{n['name']}"
            paths[n['name']] = p
            x = UsdGeom.Xform.Define(stage, p)
            if n.get('anim'):
                t_op, r_op, s_op = x.AddTranslateOp(), x.AddOrientOp(), x.AddScaleOp()
                # valor sin tiempo = frasco completo (lo usa quien mide el modelo sin animación)
                tr0, q0, s0 = n['anim'](SHOW[0])
                t_op.Set(Gf.Vec3f(*map(float, tr0)))
                r_op.Set(Gf.Quatf(q0[3], q0[0], q0[1], q0[2]))
                s_op.Set(Gf.Vec3f(s0, s0, s0))
                vals = [n['anim'](_time(t)) for t in ts]
                for i, (tr, q, s) in enumerate(zip([v[0] for v in vals], A._continuous([v[1] for v in vals]), [v[2] for v in vals])):
                    t_op.Set(Gf.Vec3f(*map(float, tr)), i)
                    r_op.Set(Gf.Quatf(q[3], q[0], q[1], q[2]), i)
                    s_op.Set(Gf.Vec3f(s, s, s), i)
            elif n.get('translation'):
                x.AddTranslateOp().Set(Gf.Vec3f(*n['translation']))
            for j, (pos, nor, idx, mk, uv) in enumerate(meshes.get(n.get('mesh'), [])):
                m = UsdGeom.Mesh.Define(stage, f'{p}/Malla{j + 1}')
                m.CreatePointsAttr(Vt.Vec3fArray([Gf.Vec3f(*map(float, v)) for v in pos]))
                m.CreateFaceVertexCountsAttr(Vt.IntArray([3] * (len(idx) // 3)))
                m.CreateFaceVertexIndicesAttr(Vt.IntArray([int(i) for i in idx]))
                m.CreateSubdivisionSchemeAttr('none')
                arr = np.array(pos, float)
                m.CreateExtentAttr([Gf.Vec3f(*arr.min(axis=0)), Gf.Vec3f(*arr.max(axis=0))])
                mat, double = mats[mk]
                if double:
                    m.CreateDoubleSidedAttr(True)
                api = UsdGeom.PrimvarsAPI(m)
                api.CreatePrimvar('normals', Sdf.ValueTypeNames.Normal3fArray, UsdGeom.Tokens.vertex).Set(Vt.Vec3fArray([Gf.Vec3f(*map(float, v)) for v in nor]))
                if uv is not None:
                    api.CreatePrimvar('st', Sdf.ValueTypeNames.TexCoord2fArray, UsdGeom.Tokens.vertex).Set(Vt.Vec2fArray([Gf.Vec2f(u, 1 - v) for u, v in uv]))
                UsdShade.MaterialBindingAPI.Apply(m.GetPrim()).Bind(mat)
        stage.GetRootLayer().Save()
        if not UsdUtils.CreateNewARKitUsdzPackage(Sdf.AssetPath(usdc), path):
            raise SystemExit(f'No se pudo crear {path}')



def _mat(tr, q, sc):
    x, y, z, w = q
    r = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    m = np.eye(4)
    m[:3, :3] = r * sc
    m[:3, 3] = tr
    return m


def anim_extent(nodes, meshes, fps=30):
    """Caja que encierra todas las mallas visibles en todos los cuadros de la animación."""
    boxes = {}
    for k, prims in meshes.items():
        pts = np.concatenate([np.array(p[0], float) for p in prims])
        lo, hi = pts.min(axis=0), pts.max(axis=0)
        boxes[k] = np.array([[a, b, c, 1] for a in (lo[0], hi[0]) for b in (lo[1], hi[1]) for c in (lo[2], hi[2])])
    mn, mx = np.full(3, np.inf), np.full(3, -np.inf)
    for i in range(int(T * fps) + 1):
        t = i / fps
        world = {}
        for n in nodes:
            if n.get('anim'):
                tr, q, sc = n['anim'](t)
                m = _mat(tr, q, sc)
            else:
                m = _mat(n.get('translation', (0, 0, 0)), (0, 0, 0, 1), 1.0)
            if n['parent'] is not None:
                m = world[n['parent']] @ m
            world[n['name']] = m
            if n.get('mesh') in boxes and np.linalg.norm(m[:3, 0]) > 0.01:
                w = (m @ boxes[n['mesh']].T).T[:, :3]
                mn, mx = np.minimum(mn, w.min(axis=0)), np.maximum(mx, w.max(axis=0))
    return tuple(map(float, mn)), tuple(map(float, mx))

def cap_top(src):
    """La foto de la cara de arriba de la tapa, aclarada al tono del lado (la foto quedó oscura) y sin el
    borde sombreado; se guarda junto a la original como <nombre>-ajustada.jpg."""
    from PIL import Image, ImageFilter
    import numpy as np

    im = Image.open(src).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    rr = np.hypot(xx - W / 2, yy - H / 2) / (W / 2)
    L = a.mean(2)
    # sombreado de baja frecuencia (luz de la foto) → se aplana y se lleva al gris del lado
    low = np.asarray(Image.fromarray(L.astype(np.uint8)).filter(ImageFilter.GaussianBlur(W / 10))).astype(np.float32)
    target = np.array(SILVER, np.float32) * 255
    flat = (L - low)[..., None] * 1.15 + target[None, None, :]
    # fuera del disco (borde y fondo de la foto) queda el gris liso
    m = np.clip((0.97 - rr) / 0.04, 0, 1)[..., None]
    out = flat * m + target[None, None, :] * (1 - m)
    dst = os.path.splitext(src)[0] + '-ajustada.jpg'
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(dst, quality=92)
    return dst


def cap_grain(tex):
    """Grano fino del plástico arenado de la tapa (lado): gris plateado con puntitos claros y oscuros."""
    from PIL import Image
    import numpy as np

    rng = np.random.default_rng(7)
    W, H = 2048, 384
    n = rng.normal(0, 1, (H, W)).astype(np.float32)
    from scipy.ndimage import gaussian_filter

    # se repite sin costura alrededor de la tapa (desenfoque con borde envolvente)
    fine = gaussian_filter(n * 40, 0.6, mode='wrap')
    base = np.array(SILVER, np.float32) * 255
    out = base[None, None, :] + fine[..., None] * 0.35
    dst = os.path.join(tex, 'tapa-lado.jpg')
    Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(dst, quality=90)
    return dst


def main(tex, static_dir=None):
    os.makedirs(OUT, exist_ok=True)
    for pid, title, prefix, text in (('pan', 'PANCREOGEN', '', 'PANCREOGEN • 90 CÁPSULAS • '), ('pan-f', 'PANCRIVA (ficticio)', 'ficticio-', 'PANCRIVA • 90 CÁPSULAS • ')):
        files = {f'{prefix}etiqueta': os.path.join(tex, f'{prefix}etiqueta.jpg'), f'{prefix}tapa': cap_top(os.path.join(tex, f'{prefix}tapa.jpg')), 'tapaLado': cap_grain(tex)}
        images = {k: (open(v, 'rb').read(), 'image/jpeg') for k, v in files.items()}
        sc = bake_scale(scene(text, prefix), AR_SCALE)
        write_glb(os.path.join(OUT, f'{pid}.glb'), title, sc, images)
        write_usdz(os.path.join(OUT, f'{pid}.usdz'), sc, files)
        if static_dir:
            os.makedirs(static_dir, exist_ok=True)
            write_glb(os.path.join(static_dir, f'{pid}-estatico.glb'), title, scene(text, prefix, animated=False), images, animated=False)
        print(pid, 'listo')


if __name__ == '__main__':
    main(*sys.argv[1:3])
