"""Modelo de AR animado de DEFEROL (Procaps): la caja flota y gira despacio mientras cápsulas blandas (ilustrativas)
giran a su alrededor sobre un aro (ciclo de 12 s sin cortes). Genera ar/models/def (real) y def-f (ficticio,
SOLDEVA · Bioandes) en GLB (Scene Viewer) y USDZ (AR Quick Look).

Lo aprendido con PANCREOGEN y TEARSOFT (ver docs/ESTADO.md):
- nada empieza diminuto: el primer cuadro ya mide lo mismo que el resto;
- `Limites` (triángulo sin área) fija la caja con que los visores encuadran la cámara en modo Objeto;
- el tamaño de AR va multiplicado en las coordenadas (`bake_scale`), no como escala de un nodo.

Medidas aproximadas de la caja: 7,0 × 4,3 × 1,45 cm (proporción medida en las fotos).
Uso: python3 scripts/deferol/modelo.py   (lee las texturas de assets/deferol)
"""
import importlib.util
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location('pan_modelo', os.path.join(ROOT, 'scripts', 'pancreogen', 'modelo.py'))
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)
A = P.A

T = 12.0
OUT = os.path.join(ROOT, 'ar', 'models')
TEX = os.path.join(ROOT, 'assets', 'deferol')
BW, BH, BD = 0.070, 0.043, 0.0145  # ancho, alto, fondo (m)
LIFT = 0.012                       # la caja flota sobre el piso
AR_SCALE = 3.0                     # en AR la caja mide unos 21 cm de ancho (se lee el empaque)
N_CAPS = 7
CAPS = (0.97, 0.74, 0.25)          # cápsula blanda ilustrativa (ámbar translúcido)
ORBIT = 0.047
FACES = ('frente', 'reverso', 'izquierda', 'derecha', 'arriba', 'abajo')


def face(tl, tr, br, bl, mat):
    pos = [tl, tr, br, bl]
    n = P.np.cross(P.np.subtract(bl, tl), P.np.subtract(br, tl))
    n = tuple((n / P.np.linalg.norm(n)).tolist())
    return (pos, [n] * 4, [0, 3, 2, 0, 2, 1], mat, [(0, 0), (1, 0), (1, 1), (0, 1)])


def box_prims(prefix):
    p = prefix.replace('-', '_')  # los materiales son prims de USD: sin guiones
    w, h, d = BW / 2, BH / 2, BD / 2
    return [
        face((-w, h, d), (w, h, d), (w, -h, d), (-w, -h, d), f'{p}frente'),
        face((w, h, -d), (-w, h, -d), (-w, -h, -d), (w, -h, -d), f'{p}reverso'),
        face((-w, h, -d), (-w, h, d), (-w, -h, d), (-w, -h, -d), f'{p}izquierda'),
        face((w, h, d), (w, h, -d), (w, -h, -d), (w, -h, d), f'{p}derecha'),
        face((-w, h, -d), (w, h, -d), (w, h, d), (-w, h, d), f'{p}arriba'),
        face((-w, -h, d), (w, -h, d), (w, -h, -d), (-w, -h, -d), f'{p}abajo'),
    ]


def softgel_mesh(a=0.0058, b=0.0037, seg=28, rings=18):
    """Cápsula blanda: elipsoide alargado en x."""
    pos, nor, idx = [], [], []
    for j in range(rings + 1):
        t = math.pi * j / rings
        for s in range(seg + 1):
            u = 2 * math.pi * s / seg
            x, y, z = a * math.cos(t), b * math.sin(t) * math.cos(u), b * math.sin(t) * math.sin(u)
            pos.append((x, y, z))
            n = (x / a ** 2, y / b ** 2, z / b ** 2)
            L = math.sqrt(sum(c * c for c in n)) or 1
            nor.append(tuple(c / L for c in n))
    for j in range(rings):
        for s in range(seg):
            i0 = j * (seg + 1) + s
            i1 = i0 + seg + 1
            idx += [i0, i1, i0 + 1, i0 + 1, i1, i1 + 1]
    return pos, nor, idx


def box_at(t):
    y = BH / 2 + LIFT + 0.0025 * math.sin(2 * math.pi * t / 6)
    yaw = 2 * math.pi * t / T
    tilt = 0.08 * math.sin(2 * math.pi * t / T * 2)
    q = A.quat_mul(A.quat_y(yaw), A.quat_axis((1, 0, 0), tilt))
    return (0.0, y, 0.0), q, 1.0


def caps_at(i):
    def f(t):
        ang = 2 * math.pi * i / N_CAPS - 2 * math.pi * t / T
        r = ORBIT + 0.002 * math.sin(2 * math.pi * t / 4 + i)
        y = LIFT + BH * (0.2 + 0.6 * ((i * 3) % N_CAPS) / (N_CAPS - 1)) + 0.004 * math.sin(2 * math.pi * t / 3 + i * 1.3)
        roll = 2 * math.pi * t / 6 + i
        # la cápsula mira en la dirección en que avanza y rueda despacio sobre su eje
        q = A.quat_mul(A.quat_y(-ang + math.pi / 2), A.quat_axis((1, 0, 0), roll))
        return (r * math.cos(ang), y, r * math.sin(ang)), q, 1.0
    return f


def scene(prefix):
    meshes = {
        'Caja': box_prims(prefix),
        'Aro': [(*P.ring_mesh(ORBIT - 0.003, ORBIT), 'aro', None)],
        'Capsula': [(*softgel_mesh(), 'capsula', None)],
    }
    nodes = [
        {'name': 'Caja', 'parent': None, 'mesh': 'Caja', 'anim': box_at},
        {'name': 'Aro', 'parent': None, 'mesh': 'Aro'},
    ]
    for i in range(N_CAPS):
        nodes.append({'name': f'Capsula{i + 1}', 'parent': None, 'mesh': 'Capsula', 'anim': caps_at(i)})
    # caja de encuadre del modo Objeto: la caja girando (su media diagonal) con poco margen
    half = math.hypot(BW / 2, BD / 2) * 1.12
    mn = (-half, 0.0, -half)
    mx = (half, (BH + LIFT) * 1.12, half)
    meshes['Limites'] = [([mn, mx, mx], [(0, 1, 0)] * 3, [0, 1, 2], 'aro', None)]
    nodes.append({'name': 'Limites', 'parent': None, 'mesh': 'Limites'})
    mp = prefix.replace('-', '_')
    materials = {f'{mp}{k}': {'texture': f'{prefix}{k}', 'rough': 0.42} for k in FACES}
    materials['aro'] = {'color': (1, 1, 1), 'rough': 0.8, 'opacity': 0.55, 'double': True}
    materials['capsula'] = {'color': CAPS, 'rough': 0.12, 'opacity': 0.86}
    return meshes, nodes, materials


def main():
    # los escritores de PANCREOGEN leen estas constantes al escribir
    P.T, P.SHOW, P.AR_SCALE = T, (0.0, T), AR_SCALE
    os.makedirs(OUT, exist_ok=True)
    for pid, title, prefix in (('def', 'DEFEROL', ''), ('def-f', 'SOLDEVA (ficticio)', 'ficticio-')):
        files = {f'{prefix}{k}': os.path.join(TEX, f'{prefix}{k}.jpg') for k in FACES}
        images = {k: (open(v, 'rb').read(), 'image/jpeg') for k, v in files.items()}
        sc = P.bake_scale(scene(prefix), AR_SCALE)
        P.write_glb(os.path.join(OUT, f'{pid}.glb'), title, sc, images)
        P.write_usdz(os.path.join(OUT, f'{pid}.usdz'), sc, files)
        print(pid, 'listo')


if __name__ == '__main__':
    main()
