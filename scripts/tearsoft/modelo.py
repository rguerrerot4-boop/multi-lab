"""Modelo de AR animado de TEARSOFT (Procaps): la caja flota y gira despacio mientras gotas de lágrima
artificial giran a su alrededor (ciclo de 12 s sin cortes). Genera ar/models/tea (real) y tea-f (ficticio,
LUBRAVIS · Bioandes) en GLB (Scene Viewer) y USDZ (AR Quick Look).

Lo aprendido con PANCREOGEN (ver docs/ESTADO.md):
- nada empieza diminuto: el primer cuadro ya mide lo mismo que el resto;
- `Limites` (triángulo sin área) fija la caja con que los visores encuadran la cámara en modo Objeto;
- el tamaño de AR va multiplicado en las coordenadas (`bake_scale`), no como escala de un nodo.

Medidas de la caja: 2,7 × 2,15 × 5,3 cm (proporción medida en las fotos; el alto es aproximado).
Uso: python3 scripts/tearsoft/modelo.py   (lee las texturas de assets/tearsoft)
"""
import importlib.util
import math
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location('pan_modelo', os.path.join(ROOT, 'scripts', 'pancreogen', 'modelo.py'))
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)
A = P.A

T = 12.0
OUT = os.path.join(ROOT, 'ar', 'models')
TEX = os.path.join(ROOT, 'assets', 'tearsoft')
BW, BD, BH = 0.027, 0.0215, 0.053  # ancho, fondo, alto (m)
LIFT = 0.014                       # la caja flota sobre el piso
AR_SCALE = 3.5                     # en AR la caja mide unos 18,5 cm de alto (se aprecia el texto del empaque)
N_DROPS = 10
DROP = (0.45, 0.76, 1.0)           # azul claro de la gota (tono del empaque)


def face(tl, tr, br, bl, mat):
    pos = [tl, tr, br, bl]
    n = np.cross(np.subtract(bl, tl), np.subtract(br, tl))
    n = tuple((n / np.linalg.norm(n)).tolist())
    return (pos, [n] * 4, [0, 3, 2, 0, 2, 1], mat, [(0, 0), (1, 0), (1, 1), (0, 1)])


def box_prims(prefix):
    prefix = prefix.replace('-', '_')  # los materiales son prims de USD: sin guiones
    w, d, h = BW / 2, BD / 2, BH / 2
    return [
        face((-w, h, d), (w, h, d), (w, -h, d), (-w, -h, d), f'{prefix}frente'),
        face((w, h, -d), (-w, h, -d), (-w, -h, -d), (w, -h, -d), f'{prefix}frente'),
        face((-w, h, -d), (-w, h, d), (-w, -h, d), (-w, -h, -d), f'{prefix}costado'),
        face((w, h, d), (w, h, -d), (w, -h, -d), (w, -h, d), f'{prefix}costado'),
        face((-w, h, -d), (w, h, -d), (w, h, d), (-w, h, d), f'{prefix}tapa'),
        face((-w, -h, d), (w, -h, d), (w, -h, -d), (-w, -h, -d), f'{prefix}tapa'),
    ]


def drop_mesh(radius=0.0032, half=0.0055, seg=28, rings=22):
    """Gota con la punta hacia arriba (superficie de revolución: r = R·sen t·sen(t/2))."""
    pos, nor, idx = [], [], []
    prof = []
    for j in range(rings + 1):
        t = math.pi * j / rings
        prof.append((radius * math.sin(t) * math.sin(t / 2) * 1.55, half * math.cos(t)))
    for j, (r, y) in enumerate(prof):
        # normal del perfil (derivada numérica)
        a, b = prof[max(0, j - 1)], prof[min(rings, j + 1)]
        dr, dy = b[0] - a[0], b[1] - a[1]
        nr, ny = -dy, dr  # hacia afuera (el perfil va de la punta, arriba, a la base)
        L = math.hypot(nr, ny) or 1
        nr, ny = nr / L, ny / L
        if j == 0:
            nr, ny = 0, 1
        if j == rings:
            nr, ny = 0, -1
        for s in range(seg + 1):
            a_ = 2 * math.pi * s / seg
            c, sn = math.cos(a_), math.sin(a_)
            pos.append((r * c, y, r * sn))
            nor.append((nr * c, ny, nr * sn))
    for j in range(rings):
        for s in range(seg):
            a = j * (seg + 1) + s
            b = a + seg + 1
            idx += [a, a + 1, b, a + 1, b + 1, b]
    return pos, nor, idx


def box_at(t):
    y = BH / 2 + LIFT + 0.003 * math.sin(2 * math.pi * t / 6)
    yaw = 2 * math.pi * t / T
    tilt = 0.10 * math.sin(2 * math.pi * t / T * 2)
    q = A.quat_mul(A.quat_y(yaw), A.quat_axis((1, 0, 0), tilt))
    return (0.0, y, 0.0), q, 1.0


def drop_at(i):
    def f(t):
        base = 2 * math.pi * i / N_DROPS
        ang = base - 2 * math.pi * t / T
        r = 0.026 + 0.002 * math.sin(2 * math.pi * t / 4 + i)
        y = LIFT + BH * (0.12 + 0.86 * ((i * 3) % N_DROPS) / (N_DROPS - 1)) + 0.005 * math.sin(2 * math.pi * t / 3 + i * 1.7)
        s = 0.9 + 0.12 * math.sin(2 * math.pi * t / 2 + i)
        wob = 0.25 * math.sin(2 * math.pi * t / 4 + i)
        q = A.quat_mul(A.quat_y(-ang), A.quat_axis((0, 0, 1), wob))
        return (r * math.cos(ang), y, r * math.sin(ang)), q, s
    return f


def scene(prefix):
    meshes = {
        'Caja': box_prims(prefix),
        'Aro': [(*P.ring_mesh(0.021, 0.0235), 'aro', None)],
        'Gota': [(*drop_mesh(), 'gota', None)],
    }
    nodes = [
        {'name': 'Caja', 'parent': None, 'mesh': 'Caja', 'anim': box_at},
        {'name': 'Aro', 'parent': None, 'mesh': 'Aro'},
    ]
    for i in range(N_DROPS):
        nodes.append({'name': f'Gota{i + 1}', 'parent': None, 'mesh': 'Gota', 'anim': drop_at(i)})
    # caja de encuadre: la caja con un margen (las gotas pueden quedar un poco fuera del encuadre del modo Objeto)
    m = 1.5
    mn = (-BW / 2 * m, 0.0, -BW / 2 * m)
    mx = (BW / 2 * m, (BH + LIFT) * 1.1, BW / 2 * m)
    meshes['Limites'] = [([mn, mx, mx], [(0, 1, 0)] * 3, [0, 1, 2], 'aro', None)]
    nodes.append({'name': 'Limites', 'parent': None, 'mesh': 'Limites'})
    mp = prefix.replace('-', '_')
    materials = {
        f'{mp}frente': {'texture': f'{prefix}frente', 'rough': 0.55},
        f'{mp}costado': {'texture': f'{prefix}costado', 'rough': 0.55},
        f'{mp}tapa': {'texture': f'{prefix}tapa', 'rough': 0.55},
        'aro': {'color': (1, 1, 1), 'rough': 0.8, 'opacity': 0.55, 'double': True},
        'gota': {'color': DROP, 'rough': 0.08, 'opacity': 0.78, 'double': True},
    }
    return meshes, nodes, materials


def main():
    # los escritores de PANCREOGEN leen estas constantes al escribir
    P.T, P.SHOW, P.AR_SCALE = T, (0.0, T), AR_SCALE
    os.makedirs(OUT, exist_ok=True)
    for pid, title, prefix in (('tea', 'TEARSOFT', ''), ('tea-f', 'LUBRAVIS (ficticio)', 'ficticio-')):
        files = {f'{prefix}{k}': os.path.join(TEX, f'{prefix}{k}.jpg') for k in ('frente', 'costado', 'tapa')}
        images = {k: (open(v, 'rb').read(), 'image/jpeg') for k, v in files.items()}
        sc = P.bake_scale(scene(prefix), AR_SCALE)
        P.write_glb(os.path.join(OUT, f'{pid}.glb'), title, sc, images)
        P.write_usdz(os.path.join(OUT, f'{pid}.usdz'), sc, files)
        print(pid, 'listo')


if __name__ == '__main__':
    main()
