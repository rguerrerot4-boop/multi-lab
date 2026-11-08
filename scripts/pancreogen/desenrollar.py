"""Desenrolla la etiqueta cilíndrica de PANCREOGEN desde las fotos del frasco.

Para cada vista: detecta los bordes del cuerpo blanco (abajo), el borde tapa/cuerpo y el fondo del frasco,
y remuestrea la imagen en coordenadas de ángulo (columna = ángulo alrededor del eje, fila = altura
normalizada entre el borde de la tapa y la base). Salida: un PNG por vista en scratch/desenrollado/.
Uso: python3 desenrollar.py <carpeta_fotos> <carpeta_salida>
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageOps

VIEWS = ['2311', '2313', '2318', '2319', '2322', '2329', '2333', '2336']
PX_DEG = 12  # columnas por grado
SPAN = 72  # grados a cada lado del centro de la vista
H = 1800  # alto normalizado del cuerpo
K = float(os.environ.get('PAN_K', '8'))  # distancia de la cámara / radio del frasco (perspectiva)


def smooth(x, k=9):
    return np.convolve(x, np.ones(k) / k, mode='same')


def detect(a):
    """a: gris float. Devuelve (cx, R, y_top, y_bot) del cuerpo."""
    # columnas aproximadas del frasco: banda de la tapa (plateada, más clara que el fondo)
    band = a[700:900, 1800:4300].mean(0)
    idx = np.where(band > 70)[0]
    segs = np.split(idx, np.where(np.diff(idx) > 15)[0] + 1)
    seg = max(segs, key=len)
    cx0 = 1800 + (seg[0] + seg[-1]) / 2
    # base: primera fila (de abajo hacia arriba) donde el centro es claro
    col = smooth(a[:, int(cx0) - 300:int(cx0) - 260].mean(1), 5)
    ys = np.where(col[2000:3800] > 110)[0]
    y_bot = 2000 + ys.max()
    # borde tapa/cuerpo: salto de plateado (~115) a blanco (~200), medido en varias columnas cerca del
    # borde del frasco (donde casi siempre hay plástico blanco) y se toma la mediana
    cands = []
    for dx in (-440, -400, -360, 360, 400, 440):
        c = smooth(a[:, int(cx0) + dx - 15:int(cx0) + dx + 15].mean(1), 5)
        d = np.diff(c[600:1500])
        k = int(np.argmax(d))
        if d[k] > 4:
            cands.append(600 + k + 1)
    y_top = int(np.median(sorted(cands)[:4]))  # las más altas: la etiqueta puede dar saltos más abajo
    # bordes del cuerpo: fila blanca justo encima de la base
    yb = int(y_bot - 90)
    row = smooth(a[yb - 6:yb + 6, :].mean(0), 5)
    left = right = None
    for x in range(int(cx0), 0, -1):
        if row[x] < 75:
            left = x
            break
    for x in range(int(cx0), a.shape[1]):
        if row[x] < 75:
            right = x
            break
    return (left + right) / 2, (right - left) / 2, y_top, y_bot


def unwrap(path, out):
    im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
    rgb = np.asarray(im).astype(np.float32)
    g = rgb.mean(2)
    cx, R, y0, y1 = detect(g)
    W = 2 * SPAN * PX_DEG
    th = np.radians((np.arange(W) / PX_DEG) - SPAN)
    # perspectiva: la cámara está a K radios del eje. El ancho medido es el de la silueta (tangentes),
    # así que el radio "en el centro" es R·sqrt(1-1/K²); los puntos más lejanos se ven más chicos.
    r0 = R * math.sqrt(1 - 1 / K ** 2)
    sc = (1 - 1 / K) / (1 - np.cos(th) / K)  # escala relativa al punto más cercano (θ = 0)
    xs = cx + r0 * np.sin(th) / (1 - np.cos(th) / K)
    # altura: el borde de la tapa y la base se midieron en el centro (θ = 0); la fila central es el horizonte
    yc = (y0 + y1) / 2
    vv = (np.arange(H) + 0.5) / H
    X = np.broadcast_to(xs, (H, W))
    Y = yc + ((y0 + vv * (y1 - y0))[:, None] - yc) * sc[None, :]
    # muestreo bilineal
    x0 = np.floor(X).astype(int); y0i = np.floor(Y).astype(int)
    fx = (X - x0)[..., None]; fy = (Y - y0i)[..., None]
    def at(yy, xx):
        return rgb[np.clip(yy, 0, rgb.shape[0] - 1), np.clip(xx, 0, rgb.shape[1] - 1)]
    s = at(y0i, x0) * (1 - fx) * (1 - fy) + at(y0i, x0 + 1) * fx * (1 - fy) + at(y0i + 1, x0) * (1 - fx) * fy + at(y0i + 1, x0 + 1) * fx * fy
    Image.fromarray(np.clip(s, 0, 255).astype(np.uint8)).save(out)
    return cx, R, y0, y1


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)
    for v in VIEWS:
        r = unwrap(os.path.join(src, f'IMG_{v}.JPG'), os.path.join(dst, f'{v}.png'))
        print(v, [round(float(x)) for x in r])
