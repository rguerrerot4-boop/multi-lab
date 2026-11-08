"""Arma la textura cilíndrica de 360° de PANCREOGEN con trozos de las vistas desenrolladas.

Cada bloque de la etiqueta se toma de la foto donde está más de frente (sin deformación):
la entrada de la etiqueta de la vista lateral, el frente, la tabla, el modo de empleo con el código
de barras y el relieve blanco. Las costuras caen en zonas lisas (teal o plástico blanco) y la
diferencia para completar los 360° se reparte estirando dos zonas lisas (fondo teal entre el frente
y la tabla, y plástico blanco antes del relieve). Ángulos medidos sobre las vistas desenrolladas
con una cuadrícula de 10° (desenrollar.py, perspectiva K = 8).
Uso: python3 componer.py <desenrollado> <salida.png>
"""
import sys

import numpy as np
from PIL import Image

PX, SPAN = 12, 72
# (vista, desde°, hasta°, ancho de salida°)
# bordes medidos de la etiqueta: fin = 2322 a +27,2° ≡ 2319 a −9,0°; inicio = 2319 a +44,0° ≡ 2336 a −60,0°
PIECES = [
    ('2319', -11.0, 22.0, 33.0),  # fin de la etiqueta y relieve «Nutrabiotics»
    ('2319', 22.0, 42.0, 34.8),  # plástico blanco liso (estirado)
    ('2319', 42.0, 46.0, 4.0),  # borde inicial de la etiqueta
    ('2336', -58.0, 56.0, 114.0),  # frente
    ('2329', -57.7, -52.5, 15.2),  # fondo teal antes de la tabla (estirado)
    ('2329', -52.5, 44.7, 97.2),  # composición e información nutricional
    ('2322', -36.6, 25.2, 61.8),  # modo de empleo, fabricante y código de barras
]
FRONT_AT = 33.0 + 34.8 + 4.0 + 58.0  # el centro del frente (ángulo 0 de la vista 2336) desde el inicio
FEATHER = 12  # columnas de transición en cada costura


def main(src, out):
    total = sum(p[3] for p in PIECES)
    assert abs(total - 360) < 0.01, total
    imgs = {}
    cols = []
    for v, a0, a1, wd in PIECES:
        if v not in imgs:
            imgs[v] = np.asarray(Image.open(f'{src}/{v}.png').convert('RGB')).astype(np.float32)
        n = int(round(wd * PX))
        src_cols = (np.linspace(a0, a1, n, endpoint=False) + SPAN) * PX
        cols.append((v, src_cols))
    h = imgs['2336'].shape[0]
    W = 360 * PX
    tex = np.zeros((h, W, 3), np.float32)
    x = 0
    pieces = []
    for v, sc in cols:
        im = imgs[v]
        c0 = np.floor(sc).astype(int); f = (sc - c0)[None, :, None]
        block = im[:, np.clip(c0, 0, im.shape[1] - 1)] * (1 - f) + im[:, np.clip(c0 + 1, 0, im.shape[1] - 1)] * f
        pieces.append((x, block, v, sc))
        x += block.shape[1]
    W = x
    tex = np.zeros((h, W, 3), np.float32)
    for i, (x0, block, v, sc) in enumerate(pieces):
        tex[:, x0:x0 + block.shape[1]] = block
    # transición suave en cada costura: mezcla la continuación de la vista anterior
    for i, (x0, block, v, sc) in enumerate(pieces):
        pv, psc = pieces[i - 1][2], pieces[i - 1][3]
        im = imgs[pv]
        step = (psc[-1] - psc[0]) / max(1, len(psc) - 1)
        ext = psc[-1] + step * np.arange(1, FEATHER + 1)
        c0 = np.clip(np.round(ext).astype(int), 0, im.shape[1] - 1)
        cont = im[:, c0]
        t = np.linspace(1, 0, FEATHER)[None, :, None]
        xs = (x0 + np.arange(FEATHER)) % W
        tex[:, xs] = cont * t + tex[:, xs] * (1 - t)
    # el frente al centro de la textura
    shift = int(round((FRONT_AT - 180) * PX))
    tex = np.roll(tex, -shift, axis=1)
    Image.fromarray(np.clip(tex, 0, 255).astype(np.uint8)).save(out)
    print('textura', tex.shape)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
