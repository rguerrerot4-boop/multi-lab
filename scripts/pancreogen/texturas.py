"""Texturas finales de PANCREOGEN a partir de la etiqueta desenrollada (componer.py).

Genera en assets/pancreogen/ (y en scratch para los renders):
  etiqueta.jpg            cuerpo del frasco, 360° (la etiqueta de lote se limpia: es de un lote puntual
                          y trae un precio de venta, que la app no muestra)
  ficticio-etiqueta.jpg   igual, con el nombre, el logotipo, la web, el fabricante, el código de barras
                          y el relieve de la marca tapados (PANCRIVA · Bioandes, producto ficticio)
  tapa.jpg / ficticio-tapa.jpg   tapa vista desde arriba (foto IMG_2340), recortada en círculo
Uso: python3 texturas.py <label.png> <carpeta fotos> <salida>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

MONT = os.path.join(os.path.dirname(__file__), '../../node_modules/@expo-google-fonts/montserrat')
BOLD = f'{MONT}/700Bold/Montserrat_700Bold.ttf'
XBOLD = f'{MONT}/800ExtraBold/Montserrat_800ExtraBold.ttf'
SEMI = f'{MONT}/600SemiBold/Montserrat_600SemiBold.ttf'

# zonas medidas sobre la etiqueta de 4320 × 1800 (frente centrado)
LOT = (3100, 1452, 4210, 1610)  # interior de la etiqueta blanca del lote
LOGO = (1580, 232, 2760, 378)
LEMA = (1630, 374, 2700, 432)
NOMBRE = (1620, 606, 2765, 752)
WEB = (3160, 1350, 3940, 1428)
FABRICANTE = (276, 170, 552, 950)
CODIGO = (276, 955, 556, 1610)
LINEA_MARCA = (224, 900, 268, 1645)  # «PANCREOGEN CONTIENE DENTRO DE SU FORMULACIÓN VITAMINA D.»
RELIEVE = (690, 60, 1330, 1720)  # «Nutrabiotics» en relieve sobre el plástico blanco


def clean_lot(a):
    x0, y0, x1, y1 = LOT
    left = a[y0:y1, x0:x0 + 70].mean(1)
    right = a[y0:y1, x1 - 60:x1].mean(1)
    t = np.linspace(0, 1, x1 - x0)[None, :, None]
    a[y0:y1, x0:x1] = left[:, None] * (1 - t) + right[:, None] * t
    return a


def inpaint_text(a, box, thr=150, grow=7):
    """borra el texto claro dentro de la caja rellenando con lo que lo rodea"""
    x0, y0, x1, y1 = box
    region = a[y0:y1, x0:x1].astype(np.uint8)
    gray = region.mean(2)
    mask = (gray > thr).astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((grow, grow), np.uint8))
    out = cv2.inpaint(region, mask, 9, cv2.INPAINT_TELEA)
    a[y0:y1, x0:x1] = out
    return a


def fill_box(a, box):
    """rellena toda la caja con el color de sus bordes (interpolado por filas y columnas)"""
    x0, y0, x1, y1 = box
    m = np.zeros(a.shape[:2], np.uint8)
    m[y0:y1, x0:x1] = 255
    pad = 40
    X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(a.shape[1], x1 + pad), min(a.shape[0], y1 + pad)
    sub = a[Y0:Y1, X0:X1].astype(np.uint8)
    out = cv2.inpaint(sub, m[Y0:Y1, X0:X1], 15, cv2.INPAINT_TELEA)
    # suaviza el relleno para que no queden vetas
    blur = cv2.GaussianBlur(out, (0, 0), 9)
    mm = (m[Y0:Y1, X0:X1] > 0)[..., None]
    a[Y0:Y1, X0:X1] = np.where(mm, blur, sub)
    return a


def smooth_white(a, box):
    """plástico blanco liso: interpola cada fila entre los bordes izquierdo y derecho de la caja"""
    x0, y0, x1, y1 = box
    L = a[y0:y1, x0 - 12:x0].mean(1)
    R = a[y0:y1, x1:x1 + 12].mean(1)
    t = np.linspace(0, 1, x1 - x0)[None, :, None]
    fill = L[:, None] * (1 - t) + R[:, None] * t
    fill = cv2.GaussianBlur(fill.astype(np.float32), (0, 0), 3)
    # grano muy suave para que no se vea plano
    rng = np.random.default_rng(3)
    fill += rng.normal(0, 1.2, fill.shape[:2])[..., None]
    # bordes suaves arriba y abajo
    a[y0:y1, x0:x1] = fill
    return a


def text_center(img, box, text, font, color, max_h=None, track=0):
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box
    size = int((max_h or (y1 - y0)) * 1.0)
    while True:
        f = ImageFont.truetype(font, size)
        l, t, r, b = d.textbbox((0, 0), text, font=f)
        w = r - l + track * (len(text) - 1)
        if w <= (x1 - x0) and (b - t) <= (y1 - y0) * 0.95:
            break
        size -= 2
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    if track:
        x = cx - w / 2
        for ch in text:
            l, t, r, b = d.textbbox((0, 0), ch, font=f)
            d.text((x - l, cy - (b + t) / 2), ch, font=f, fill=color)
            x += r - l + track
    else:
        d.text((cx - w / 2 - l, cy - (b + t) / 2), text, font=f, fill=color)


def ficticio(a):
    a = a.copy()
    # el logotipo y el nombre se tapan por completo (el relleno por texto deja la silueta)
    a = fill_box(a, (LOGO[0] - 10, LOGO[1] - 8, LOGO[2] + 10, LEMA[3] + 6))
    a = fill_box(a, NOMBRE)
    a = fill_box(a, WEB)
    a = fill_box(a, FABRICANTE)
    a = fill_box(a, LINEA_MARCA)
    a = fill_box(a, CODIGO)
    a = smooth_white(a, RELIEVE)
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    white = (246, 248, 248)
    text_center(img, (1700, 248, 2640, 368), 'Bioandes', XBOLD, white)
    text_center(img, (1720, 384, 2620, 424), 'LABORATORIO FICTICIO', SEMI, white, track=10)
    text_center(img, (1660, 632, 2720, 730), 'PANCRIVA', XBOLD, white)
    # en lugar del código de barras: aviso vertical sobre una placa blanca
    plate = Image.new('RGBA', (CODIGO[3] - CODIGO[1] - 40, CODIGO[2] - CODIGO[0] - 30), (0, 0, 0, 0))
    pd = ImageDraw.Draw(plate)
    pd.rounded_rectangle((0, 0, plate.width - 1, plate.height - 1), radius=18, fill=(244, 246, 246, 255))
    text_center(plate, (24, 20, plate.width - 24, plate.height // 2 - 4), 'PRODUCTO FICTICIO', BOLD, (31, 70, 74))
    text_center(plate, (24, plate.height // 2 + 6, plate.width - 24, plate.height - 20), 'Prototipo académico Multi LAB', SEMI, (31, 70, 74))
    plate = plate.rotate(90, expand=True)
    img.paste(plate, (CODIGO[0] + 15, CODIGO[1] + 20), plate)
    return img


def cap_top(photos, out_real, out_fict):
    im = ImageOps.exif_transpose(Image.open(os.path.join(photos, 'IMG_2340.JPG'))).convert('RGB')
    g = np.asarray(im.convert('L')).astype(np.float32)
    # la tapa es el disco plateado más grande en la parte baja de la foto
    m = (g > 70).astype(np.uint8)
    m[:, :2200] = 0
    m[:, 4200:] = 0
    n, lab, stats, cent = cv2.connectedComponentsWithStats(m)
    k = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    x, y, w, h = stats[k, :4]
    cx, cy = x + w / 2, y + h / 2
    r = min(w, h) / 2 * 0.97
    box = (int(cx - r), int(cy - r), int(cx + r), int(cy + r))
    disc = im.crop(box).resize((1024, 1024), Image.LANCZOS)
    mask = Image.new('L', disc.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, 1023, 1023), fill=255)
    base = Image.new('RGB', disc.size, (150, 152, 156))
    real = Image.composite(disc, base, mask)
    real.save(out_real, quality=88)
    # ficticio: el logotipo en relieve se reemplaza por plástico plateado liso con grano
    base = np.asarray(real.filter(ImageFilter.GaussianBlur(90))).astype(np.float32)
    rng = np.random.default_rng(5)
    grain = rng.normal(0, 5, base.shape[:2])[..., None]
    smooth = Image.fromarray(np.clip(base + grain, 0, 255).astype(np.uint8))
    inner = Image.new('L', disc.size, 0)
    ImageDraw.Draw(inner).ellipse((90, 90, 934, 934), fill=255)
    inner = inner.filter(ImageFilter.GaussianBlur(24))
    Image.composite(smooth, real, inner).save(out_fict, quality=88)


def main(label, photos, out):
    os.makedirs(out, exist_ok=True)
    a = np.asarray(Image.open(label).convert('RGB')).astype(np.float32)
    a = clean_lot(a)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(os.path.join(out, 'etiqueta-full.png'))
    f = ficticio(a)
    f.save(os.path.join(out, 'ficticio-etiqueta-full.png'))
    # versión de la app / modelo AR: 2048 de ancho
    for name, img in (('etiqueta', Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))), ('ficticio-etiqueta', f)):
        img.resize((2048, 854), Image.LANCZOS).save(os.path.join(out, f'{name}.jpg'), quality=86)
    cap_top(photos, os.path.join(out, 'tapa.jpg'), os.path.join(out, 'ficticio-tapa.jpg'))


if __name__ == '__main__':
    main(*sys.argv[1:4])
