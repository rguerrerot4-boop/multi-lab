"""Texturas del empaque de VITYBELL (Procaps) a partir de las fotos de la sesión (IMG_2285–2308).

1. Endereza las seis caras (corrección de perspectiva con las 4 esquinas medidas a mano en la foto, 6000 × 4000 px).
2. Iguala el rosado del cartón entre fotos.
3. Genera la versión con nombre ficticio (FLORIVA · Bioandes): borra los logotipos de Vitybell y de Procaps, los de
   Roddome y los datos del fabricante, y escribe encima el nombre y el laboratorio ficticios.

Caras: frente (IMG_2285), reverso con la información nutricional (IMG_2296), extremo izquierdo con el nombre
(IMG_2291), extremo derecho con el lote en relieve (IMG_2298), canto de arriba (IMG_2304) y canto de abajo
(IMG_2308, de pie en la foto). Proporción medida: ancho 1,62 : alto 1 : fondo 0,33.
Las fotos originales no se guardan en el repositorio.
Uso: python3 scripts/vitybell/texturas.py <carpeta con IMG_2285.JPG…>
Salida: assets/vitybell/*.jpg
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'assets', 'vitybell')
FONTS = os.path.join(ROOT, 'node_modules', '@expo-google-fonts', 'montserrat')
SRC = os.path.join(sys.argv[1] if len(sys.argv) > 1 else '.', 'IMG_%s.JPG')

FW, FH, D = 1024, 632, 208  # ancho, alto y fondo en píxeles de textura
FACES = {
    'frente': ('2285', [(1425, 1385), (4932, 1320), (4982, 3450), (1472, 3552)], (FW, FH), 0),
    'reverso': ('2296', [(1203, 1412), (4630, 1322), (4680, 3395), (1265, 3517)], (FW, FH), 0),
    'izquierda': ('2291', [(2555, 1382), (3310, 1372), (3330, 3625), (2590, 3625)], (D, FH), 0),
    'derecha': ('2298', [(2637, 1385), (3350, 1350), (3355, 3515), (2695, 3490)], (D, FH), 0),
    'arriba': ('2304', [(1435, 2590), (4645, 2558), (4660, 3262), (1440, 3335)], (FW, D), 0),
    # de pie en la foto: se endereza vertical y luego se acuesta
    'abajo': ('2308', [(2659, 227), (3370, 210), (3520, 3266), (2850, 3299)], (D, FW), 90),
}


def coeffs(dst, src):
    A, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    return np.linalg.solve(np.array(A, float), np.array(b, float)).tolist()


def rectify(img, pts, size):
    w, h = size
    im = ImageOps.exif_transpose(Image.open(SRC % img)).convert('RGB')
    m = 5  # se recorta un margen fino: no se cuela el borde gastado ni el fondo
    big = im.transform((w * 2 + 2 * m, h * 2 + 2 * m), Image.PERSPECTIVE,
                       coeffs([(-m, -m), (w * 2 + m, -m), (w * 2 + m, h * 2 + m), (-m, h * 2 + m)], pts), Image.BICUBIC)
    big = big.crop((2 * m, 2 * m, w * 2, h * 2))
    return big.resize((w, h), Image.LANCZOS)


PINK = None


def match_pink(im):
    """Lleva el rosado del cartón de cada foto al del frente (las luces cambian entre tomas)."""
    global PINK
    a = np.asarray(im).astype(float)
    hsv = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2HSV)
    paper = (hsv[..., 1] < 60) & (hsv[..., 2] > 190)
    mean = a[paper].mean(0)
    if PINK is None:
        PINK = mean
        return im
    g = PINK / mean
    return Image.fromarray(np.clip(a * g, 0, 255).astype(np.uint8))

def font(weight, size, italic=False):
    files = {'700': '700Bold/Montserrat_700Bold.ttf', '600': '600SemiBold/Montserrat_600SemiBold.ttf', '500': '500Medium/Montserrat_500Medium.ttf', '400': '400Regular/Montserrat_400Regular.ttf',
             '600i': '600SemiBold_Italic/Montserrat_600SemiBold_Italic.ttf', '700i': '700Bold_Italic/Montserrat_700Bold_Italic.ttf'}
    return ImageFont.truetype(os.path.join(FONTS, files[weight + ('i' if italic else '')]), size)


def erase(im, boxes, everything=False):
    """Borra lo impreso dentro de las cajas (lo que no es el rosado del cartón) y rellena con el fondo de alrededor."""
    a = np.asarray(im).copy()
    hsv = cv2.cvtColor(a, cv2.COLOR_RGB2HSV)
    mask = np.zeros(a.shape[:2], np.uint8)
    for x0, y0, x1, y1 in boxes:
        sub = hsv[y0:y1, x0:x1]
        ink = (sub[..., 1] > 62) | (sub[..., 2] < 195)
        if everything:
            ink[:] = True
        mask[y0:y1, x0:x1] = np.maximum(mask[y0:y1, x0:x1], ink.astype(np.uint8) * 255)
    mask = cv2.dilate(mask, np.ones((7, 7), np.uint8))
    out = cv2.inpaint(a, mask, 9, cv2.INPAINT_TELEA)
    return Image.fromarray(out)


RED = (205, 40, 62)
GRAY = (88, 86, 104)
INK = (60, 52, 74)


def name_mark(text, size, rot=0):
    """Nombre ficticio en rojo con «BIOANDES» encima, como el logotipo del empaque (sin copiarlo)."""
    f = font('500', size)
    small = font('500', max(10, size // 4))
    l, t, r, bb = f.getbbox(text)
    w, h = r - l + 8, bb - t + size // 3 + 10
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((4, 2), 'BIOANDES', font=small, fill=GRAY + (255,))
    d.text((4 - l, size // 3 + 4 - t), text, font=f, fill=RED + (255,))
    return im.rotate(rot, expand=True) if rot else im


def ficticio(name, im):
    im = im.copy()
    if name == 'frente':
        im = erase(im, [(222, 32, 780, 228), (426, 216, 484, 252), (742, 505, 1012, 612)])  # logotipo de Vitybell y de Grupo Procaps
        im = erase(im, [(5, 50, 100, 272)], everything=True)  # nombre en marca de agua del borde
        t = name_mark('Floriva', 150)
        im.paste(t, (240, 40), t)
        ImageDraw.Draw(im).text((990, 560), 'Laboratorio Bioandes (ficticio)', font=font('500', 20), fill=GRAY, anchor='rm')
    elif name == 'reverso':
        im = erase(im, [(795, 420, 1002, 512)], everything=True)  # logotipos de Procaps y Roddome
        im = erase(im, [(25, 440, 528, 576)])  # fabricante, notificación sanitaria e importador
        d = ImageDraw.Draw(im)
        d.text((36, 452), 'Producto ficticio para el prototipo académico Multi LAB.', font=font('500', 15), fill=INK)
        d.text((36, 476), 'Elaborado por Laboratorio Bioandes (ficticio).', font=font('500', 15), fill=INK)
        d.rounded_rectangle((812, 438, 990, 492), 10, outline=INK, width=3)
        d.text((901, 465), 'BIOANDES', font=font('700', 24), fill=INK, anchor='mm')
    elif name == 'izquierda':
        im = erase(im, [(38, 28, 152, 288)])
        t = name_mark('Floriva', 72, rot=-90)
        im.paste(t, (48, 40), t)
    elif name in ('arriba', 'abajo'):
        im = erase(im, [(158, 48, 450, 140), (440, 49, 500, 64)] if name == 'arriba' else [(160, 46, 452, 136), (380, 34, 420, 50)])
        im = erase(im, [(4, 20, 86, 200)], everything=True)  # marca de agua del borde
        t = name_mark('Floriva', 76)
        im.paste(t, (172, 30), t)
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, (img, pts, size, rot) in FACES.items():
        im = rectify(img, pts, size)
        if rot:
            im = im.rotate(rot, expand=True)
        im = match_pink(im)
        im.save(os.path.join(OUT, f'{name}.jpg'), quality=90)
        ficticio(name, im).save(os.path.join(OUT, f'ficticio-{name}.jpg'), quality=90)
        print(name, im.size)


if __name__ == '__main__':
    main()
