"""Texturas del empaque de CORAESSENS a partir de las fotos de la sesión.

1. Endereza cada cara (corrección de perspectiva con las 4 esquinas marcadas en la foto).
2. Iguala el balance de blancos entre fotos.
3. Genera la versión con nombre ficticio (KARDENSA · Bioandes) tapando nombre, logotipo y fabricante.

Las fotos originales no se guardan en el repositorio (pesan ~10 MB cada una).
Uso: python3 scripts/coraessens/texturas.py <carpeta con IMG_2208.JPG…>
Después: python3 scripts/coraessens/modelo.py
Salida: assets/coraessens/*.jpg
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'assets', 'coraessens')
FONTS = os.path.join(ROOT, 'node_modules', '@expo-google-fonts', 'montserrat')
SRC = os.path.join(sys.argv[1] if len(sys.argv) > 1 else '.', 'IMG_%s.JPG')
K = 6000 / 1400  # esquinas medidas sobre la vista previa de 1400 px
SW, SH, EW = 600, 868, 600  # sides 600x868 (1:1.447), ends 600x600
FACES = {
  'front': ('2208', [(505,270),(912,269),(911,859),(503,859)], (SW, SH)),
  'left':  ('2214', [(548,299),(905,294),(917,810),(551,819)], (SW, SH)),
  'back':  ('2222', [(548,281),(924.5,281),(920,826),(549,835)], (SW, SH)),
  'right': ('2233', [(545,292),(915,291),(923,830),(551,834)], (SW, SH)),
  'top':   ('2235', [(557,461),(927,459),(937,821),(568,830)], (EW, EW)),
  'bottom':('2238', [(573,456),(919,448),(919,797),(577,801)], (EW, EW)),
}
def coeffs(dst, src):
    A = []; b = []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    return np.linalg.solve(np.array(A, float), np.array(b, float)).tolist()
cache = {}
RAW = {}
for name, (img, pts, (w, h)) in FACES.items():
    if img not in cache: cache[img] = ImageOps.exif_transpose(Image.open(SRC % img)).convert('RGB')
    im = cache[img]
    src = [(x * K, y * K) for x, y in pts]
    dst = [(0, 0), (w, 0), (w, h), (0, h)]
    out = im.transform((w, h), Image.PERSPECTIVE, coeffs(dst, src), Image.BICUBIC)
    RAW[name] = out

os.makedirs(OUT, exist_ok=True)
WT = np.array([236, 235, 231.])
def norm(name):
    im = RAW[name]
    w, h = im.size
    i = 4  # recorta el borde (fondo que se cuela) y vuelve al tamaño
    im = im.crop((i, i, w - i, h - i)).resize((w, h), Image.LANCZOS)
    a = np.asarray(im).astype(float)
    red = (a[..., 0] > 120) & (a[..., 1] < 80) & (a[..., 2] < 90)
    wh = a.min(-1) > 170
    Ws = a[wh].mean(0)
    g = WT / Ws; b = 0
    a = np.clip(a * g + b, 0, 255)
    return Image.fromarray(a.astype(np.uint8))
def font(wt, size):
    n = {'bold': '700Bold', 'semibold': '600SemiBold', 'medium': '500Medium', 'xb': '800ExtraBold'}[wt]
    return ImageFont.truetype(f'{FONTS}/{n}/Montserrat_{n}.ttf', size)
def med(im, box):
    if box == 'red' or box == 'paper':
        a = np.asarray(im).reshape(-1, 3).astype(int)
        m = ((a[:, 0] > 150) & (a[:, 1] < 90) & (a[:, 2] < 100)) if box == 'red' else (a.min(1) > 205)
        return tuple(int(v) for v in np.median(a[m], 0))
    return tuple(int(v) for v in np.median(np.asarray(im.crop(box)).reshape(-1, 3), 0))
def cover(im, box, sample):
    d = ImageDraw.Draw(im); d.rectangle(box, fill=med(im, sample)); return d
def fit(d, t, wt, size, mw):
    while size > 8 and d.textlength(t, font=font(wt, size)) > mw: size -= 1
    return font(wt, size)

faces = {n: norm(n) for n in ['front', 'left', 'back', 'right', 'top', 'bottom']}
for n, im in faces.items():
    im.save(f'{OUT}/{n}.jpg', quality=86, optimize=True)

# ---- versión con nombre ficticio (mismo empaque, nombre y laboratorio alterados) ----
NAME, LAB = 'KARDENSA', 'Bioandes'
RED = med(faces['front'], (8, 225, 30, 260))
PURPLE = med(faces['top'], (0, 0, 1, 1))
f = faces['front'].copy(); d = cover(f, (20, 70, 580, 165), (20, 30, 580, 60))
d.text((44, 118), NAME, font=fit(d, NAME, 'xb', 74, 420), fill=RED, anchor='lm')
d.text((44, 168), 'NOMBRE FICTICIO', font=font('bold', 20), fill=RED, anchor='lm')
r = faces['right'].copy()
d = cover(r, (20, 80, 580, 160), 'red')
d.text((300, 120), 'PRODUCTO FICTICIO · PROTOTIPO', font=font('bold', 24), fill='white', anchor='mm')
d = cover(r, (20, 555, 580, 730), 'red')
d.text((300, 625), LAB, font=font('xb', 78), fill='white', anchor='mm')
d.text((300, 690), 'laboratorio ficticio', font=font('medium', 26), fill='white', anchor='mm')
b = faces['back'].copy()
d = cover(b, (10, 350, 590, 606), 'red')
for k, t in enumerate(['Nombre y laboratorio alterados para', 'el prototipo académico Multi LAB.', 'Textos de ejemplo del empaque.']):
    d.text((300, 420 + k * 42), t, font=font('semibold', 26), fill='white', anchor='mm')
ends = {}
for n in ['top', 'bottom']:
    e = faces[n].copy(); W = e.width
    d = cover(e, (24, 24, W - 24, W - 44) if n == 'top' else (24, 24, W - 24, W - 24), 'paper')
    pur = (92, 44, 120)
    rot = n == 'bottom'
    layer = Image.new('RGBA', (W, W), (0, 0, 0, 0)); dl = ImageDraw.Draw(layer)
    dl.text((W / 2, W / 2 - 20), LAB, font=font('xb', 84), fill=pur, anchor='mm')
    dl.text((W / 2, W / 2 + 50), 'laboratorio ficticio', font=font('medium', 28), fill=pur, anchor='mm')
    if rot: layer = layer.rotate(90)
    e.paste(layer, (0, 0), layer); ends[n] = e
alt = {'front': f, 'left': faces['left'], 'back': b, 'right': r, **ends}
for n, im in alt.items():
    im.save(f'{OUT}/ficticio-{n}.jpg', quality=86, optimize=True)
print('Texturas listas en', OUT)
