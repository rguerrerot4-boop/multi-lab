"""Texturas del empaque de DEFEROL (Procaps) a partir de las fotos de la sesión (IMG_2260–2282).

1. Endereza las seis caras (corrección de perspectiva con las 4 esquinas medidas a mano en la foto, 6000 × 4000 px).
2. Iguala el color turquesa del cartón entre fotos.
3. Genera la versión con nombre ficticio (SOLDEVA · Bioandes): borra el logotipo plateado, los logotipos de Procaps y
   Roddome y los datos del fabricante y escribe encima el nombre y el laboratorio ficticios.

Caras: frente (IMG_2260), reverso con todo el texto (IMG_2270), extremo izquierdo con el nombre (IMG_2266), extremo
derecho con el lote en relieve (IMG_2273), canto de arriba (IMG_2278) y canto de abajo (IMG_2282, girado).
Proporción medida en las fotos: ancho 1,64 : alto 1 : fondo 0,335. Las fotos originales no se guardan en el repositorio.
Uso: python3 scripts/deferol/texturas.py <carpeta con IMG_2260.JPG…>
Salida: assets/deferol/*.jpg
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'assets', 'deferol')
FONTS = os.path.join(ROOT, 'node_modules', '@expo-google-fonts', 'montserrat')
SRC = os.path.join(sys.argv[1] if len(sys.argv) > 1 else '.', 'IMG_%s.JPG')

FW, FH, D = 1024, 626, 210  # ancho, alto y fondo en píxeles de textura
FACES = {
    'frente': ('2260', [(1395, 1448), (4495, 1372), (4550, 3290), (1425, 3338)], (FW, FH), 0),
    'reverso': ('2270', [(1130, 1430), (4530, 1376), (4565, 3440), (1172, 3470)], (FW, FH), 0),
    'izquierda': ('2266', [(2815, 1400), (3570, 1380), (3585, 3675), (2905, 3680)], (D, FH), 0),
    'derecha': ('2273', [(2850, 1385), (3590, 1370), (3590, 3575), (2858, 3580)], (D, FH), 0),
    'arriba': ('2278', [(1060, 2735), (4420, 2705), (4420, 3405), (1060, 3440)], (FW, D), 0),
    # de pie en la foto: se endereza vertical y luego se acuesta
    'abajo': ('2282', [(2660, 245), (3295, 245), (3280, 3160), (2650, 3160)], (D, FW), -90),
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


TEAL = None


def match_teal(im):
    """Lleva el turquesa del cartón de cada foto al del frente (las luces cambian entre tomas)."""
    global TEAL
    a = np.asarray(im).astype(float)
    hsv = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2HSV)
    teal = (hsv[..., 0] > 75) & (hsv[..., 0] < 95) & (hsv[..., 1] > 110)
    mean = a[teal].mean(0)
    if TEAL is None:
        TEAL = mean
        return im
    g = TEAL / mean
    return Image.fromarray(np.clip(a * g, 0, 255).astype(np.uint8))


def font(weight, size, italic=False):
    files = {'700': '700Bold/Montserrat_700Bold.ttf', '600': '600SemiBold/Montserrat_600SemiBold.ttf', '500': '500Medium/Montserrat_500Medium.ttf', '400': '400Regular/Montserrat_400Regular.ttf',
             '600i': '600SemiBold_Italic/Montserrat_600SemiBold_Italic.ttf', '700i': '700Bold_Italic/Montserrat_700Bold_Italic.ttf'}
    return ImageFont.truetype(os.path.join(FONTS, files[weight + ('i' if italic else '')]), size)


def erase(im, boxes, everything=False, skip_edges=False):
    """Borra lo impreso dentro de las cajas (lo que no es turquesa) y rellena con el fondo de alrededor.
    Con skip_edges no se tocan las manchas que llegan al borde de arriba o al izquierdo de la caja (p. ej. el arco plateado del frente)."""
    a = np.asarray(im).copy()
    hsv = cv2.cvtColor(a, cv2.COLOR_RGB2HSV)
    mask = np.zeros(a.shape[:2], np.uint8)
    for x0, y0, x1, y1 in boxes:
        sub = hsv[y0:y1, x0:x1]
        ink = (sub[..., 1] < 125) | (sub[..., 2] < 155) | (sub[..., 0] < 70) | (sub[..., 0] > 100)
        if everything:
            ink[:] = True
        ink = ink.astype(np.uint8)
        if skip_edges:
            n, lab = cv2.connectedComponents(ink)
            edge = set(np.unique(np.concatenate([lab[0], lab[:, 0]])))  # arriba e izquierda: por ahí entra el arco
            for k in edge - {0}:
                ink[lab == k] = 0
        mask[y0:y1, x0:x1] = np.maximum(mask[y0:y1, x0:x1], ink * 255)
    mask = cv2.dilate(mask, np.ones((9, 9), np.uint8))
    out = cv2.inpaint(a, mask, 11, cv2.INPAINT_TELEA)
    return Image.fromarray(out)


INK = (40, 52, 56)


def silver_name(text, size):
    """Nombre ficticio con relleno plateado (degradado) y borde oscuro fino, como el estampado del empaque."""
    f = font('700', size, italic=True)
    l, t, r, b = f.getbbox(text)
    w, h = r - l + 12, b - t + 12
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).text((6 - l, 6 - t), text, font=f, fill=255)
    edge = Image.new('L', (w, h), 0)
    ImageDraw.Draw(edge).text((6 - l, 6 - t), text, font=f, fill=255, stroke_width=3, stroke_fill=255)
    grad = np.linspace(0, 1, h)[:, None]
    tone = 205 - 130 * np.abs(grad - 0.35) * 1.6
    rgb = np.repeat(np.clip(tone, 70, 215), w, 1)
    fill = Image.fromarray(np.dstack([rgb * 0.98, rgb, rgb * 1.02]).clip(0, 255).astype(np.uint8))
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(Image.new('RGB', (w, h), (58, 64, 70)), (0, 0), edge)
    out.paste(fill, (0, 0), m)
    return out


def ficticio(name, im):
    im = im.copy()
    if name == 'frente':
        im = erase(im, [(436, 283, 1000, 441), (436, 441, 724, 500), (900, 270, 1000, 290)])  # logotipo plateado y ® (el arco queda a la izquierda)
        t = silver_name('Soldeva', 128)
        im.paste(t, (452, 300), t)
    elif name == 'reverso':
        im = erase(im, [(207, 148, 266, 172)])  # «Deferol» en el modo de uso
        im = erase(im, [(50, 394, 530, 506)])  # fabricante, importador y registros
        im = erase(im, [(712, 350, 962, 440)], everything=True)  # logotipos de Procaps y Roddome
        d = ImageDraw.Draw(im)
        d.text((208, 167), 'Soldeva', font=font('500', 15), fill=INK, anchor='ls')
        d.text((58, 418), 'Producto ficticio para el prototipo académico Multi LAB.', font=font('500', 15), fill=INK)
        d.text((58, 442), 'Elaborado por Laboratorio Bioandes (ficticio).', font=font('500', 15), fill=INK)
        d.rounded_rectangle((745, 368, 930, 422), 10, outline=INK, width=3)
        d.text((838, 396), 'BIOANDES', font=font('700', 24), fill=INK, anchor='mm')
    elif name == 'izquierda':
        im = erase(im, [(80, 92, 209, 470), (55, 92, 82, 266)])
        t = silver_name('Soldeva', 92).rotate(-90, expand=True)
        im.paste(t, (100, 120), t)
    elif name in ('arriba', 'abajo'):
        boxes = [(592, 12, 1000, 142), (716, 128, 800, 180)] if name == 'arriba' else [(588, 28, 990, 145), (736, 140, 790, 184)]
        im = erase(im, boxes)
        t = silver_name('Soldeva', 92)
        im.paste(t, (612 if name == 'arriba' else 600, 30 if name == 'arriba' else 45), t)
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, (img, pts, size, rot) in FACES.items():
        im = rectify(img, pts, size)
        if rot:
            im = im.rotate(rot, expand=True)
        im = match_teal(im)
        if name == 'derecha':
            # cara lisa con el lote en relieve: un poco más de contraste local para que el relieve se lea en 3D
            lab = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2LAB)
            lab[..., 0] = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(4, 8)).apply(lab[..., 0])
            im = Image.fromarray(cv2.cvtColor(lab, cv2.COLOR_LAB2RGB))
        im.save(os.path.join(OUT, f'{name}.jpg'), quality=90)
        ficticio(name, im).save(os.path.join(OUT, f'ficticio-{name}.jpg'), quality=90)
        print(name, im.size)


if __name__ == '__main__':
    main()
