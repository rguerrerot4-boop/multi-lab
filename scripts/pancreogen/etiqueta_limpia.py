"""Etiqueta de PANCREOGEN reconstruida en limpio (reemplaza la etiqueta pegada de las fotos).

La etiqueta desenrollada de las fotos (componer.py + texturas.py) trae los reflejos del estudio (la franja
oscura de la cámara y las ondas de la mesa), costuras entre fotos y bordes torcidos. Aquí se rehace:
  1. se enderezan las piezas para que la etiqueta tenga el mismo alto en toda la vuelta;
  2. el fondo (teal, franja gris, píldoras y formas redondeadas del frente, panel blanco de la tabla,
     reverso oscuro) se dibuja de nuevo con colores tomados de las fotos, sin reflejos;
  3. el texto, el logotipo y el código de barras se extraen de las fotos como máscaras (contraste local)
     y se pintan encima en un solo color, nítidos;
  4. el plástico blanco se aplana y conserva el relieve «Nutrabiotics».
La etiqueta de lote (con un precio de venta) no se reproduce. La versión ficticia (PANCRIVA · Bioandes)
omite el logotipo, el nombre, la web, el fabricante, el código de barras y el relieve.
Uso: python3 etiqueta_limpia.py <etiqueta-full.png de texturas.py> <carpeta de salida>
Genera etiqueta.jpg y ficticio-etiqueta.jpg (2048 × 854, para el modelo) y las versiones -full.png.
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy.ndimage import median_filter

MONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../node_modules/@expo-google-fonts/montserrat')
BOLD = f'{MONT}/700Bold/Montserrat_700Bold.ttf'
XBOLD = f'{MONT}/800ExtraBold/Montserrat_800ExtraBold.ttf'
SEMI = f'{MONT}/600SemiBold/Montserrat_600SemiBold.ttf'

ROLL = 700  # se trabaja con la etiqueta continua (el final del reverso pasa de x = 4320 a x = 0)
T, B = 140, 1672  # borde superior e inferior de la etiqueta (alto de la textura: 1800)
L0, L1 = 730, 4250  # inicio (frente) y fin (reverso) de la etiqueta, en coordenadas enrolladas
RAD = 38

# colores (sRGB) medidos en las fotos donde no hay reflejos
TEAL = (27, 74, 76)
TEAL_TABLE = (30, 88, 92)
TEAL_BACK = (15, 50, 53)
GREY = (150, 158, 160)
PILL = (16, 50, 53)
FORM = (34, 95, 98)
LINE = (138, 148, 150)
LOW = (44, 104, 106)
BOTTOM = (12, 33, 36)
PAPER = (247, 248, 246)
INK = (26, 30, 31)
WHITE = (244, 247, 247)
PLASTIC = 238

# bloques de texto: (nombre, caja, tipo) — 'w' blanco sobre teal, 'd' oscuro sobre blanco
BLOCKS = [
    ('logo', (850, 225, 2130, 445), 'W'),
    ('nombre', (890, 598, 2070, 762), 'W'),
    ('formula', (1200, 845, 2120, 1135), 'w'),
    ('capsulas', (1240, 1262, 2130, 1450), 'w'),
    ('libre', (1040, 1568, 2050, 1640), 'w'),
    ('tabla', (2326, 179, 3468, 1218), 'd'),
    ('neto', (2330, 1232, 3270, 1345), 'w'),
    ('web', (2330, 1345, 3270, 1420), 'w'),
    ('ec', (3270, 1345, 3420, 1420), 'w'),
    ('reverso', (3535, 130, 3836, 1660), 'w'),
    ('marca', (3836, 870, 3884, 1660), 'w'),
    ('fabricante', (3884, 150, 4180, 945), 'w'),
    ('codigo', (3897, 950, 4158, 1600), 'D'),
]
HIDE_FICT = {'logo', 'nombre', 'web', 'ec', 'marca', 'fabricante', 'codigo'}
PANEL = (2322, 177, 3478, 1222)
BARCODE = (3895, 948, 4160, 1602)


def straighten(a):
    """Endereza cada columna para que la etiqueta vaya de T a B (las piezas venían con el borde curvo)."""
    H, W = a.shape[:2]
    mx, mn = a.max(2), a.min(2)
    lab = (mx < 170) | ((mx - mn) > 45)
    tops = np.full(W, np.nan)
    bots = np.full(W, np.nan)
    for x in range(L0, L1):
        col = lab[:, x]
        for y in range(60, 400):
            if col[y:y + 20].all():
                tops[x] = y
                break
        for y in range(1760, 1550, -1):
            if col[y - 20:y].all() and not col[y:y + 6].any():
                bots[x] = y
                break
    xs = np.arange(W)

    def smooth(v):
        ok = ~np.isnan(v)
        f = np.interp(xs, xs[ok], v[ok])
        f = median_filter(f, 61, mode='nearest')
        return cv2.GaussianBlur(f.reshape(1, -1).astype(np.float32), (0, 0), 15).ravel()

    top = smooth(np.where(tops < 175, tops, np.nan))
    bot = smooth(np.where((bots > 1655) & (bots < 1690), bots, np.nan))
    ys = np.arange(H, dtype=np.float32)[:, None]
    src = top[None, :] + (ys - T) * (bot - top)[None, :] / (B - T)
    inside = (ys >= T - 40) & (ys <= B + 40) & (xs[None, :] >= L0 - 30) & (xs[None, :] <= L1 + 30)
    src = np.where(inside, src, ys).astype(np.float32)
    mapx = np.repeat(xs[None, :].astype(np.float32), H, 0)
    return cv2.remap(a, mapx, src, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def text_mask(a, box, kind):
    """Máscara (0–1) del texto de una caja por contraste local."""
    x0, y0, x1, y1 = box
    if kind in 'WD':
        # letras grandes y barras: umbral absoluto (el fondo es parejo y el contraste alto)
        sub = a[y0:y1, x0:x1]
        L = sub.mean(2)
        sat = sub.max(2) - sub.min(2)
        if kind == 'W':
            m = np.clip((L - 125) / 45, 0, 1) * np.clip((70 - sat) / 30, 0, 1)
        else:
            m = np.clip((150 - L) / 50, 0, 1)
        hard = (m > 0.5).astype(np.uint8)
        n, lab, stats, _ = cv2.connectedComponentsWithStats(hard, 8)
        keep = np.zeros(n, bool)
        keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= 60
        m = m * cv2.dilate(keep[lab].astype(np.uint8), np.ones((5, 5), np.uint8))
        m = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.1)
        m = np.clip((m - 0.3) / 0.4, 0, 1)
        out = np.zeros(a.shape[:2], np.float32)
        out[y0:y1, x0:x1] = m
        return out
    pad = 60
    X0, Y0 = max(0, x0 - pad), max(0, y0 - pad)
    X1, Y1 = min(a.shape[1], x1 + pad), min(a.shape[0], y1 + pad)
    L = a[Y0:Y1, X0:X1].mean(2).astype(np.uint8)
    bg = cv2.medianBlur(L, 101 if kind == 'w' else 61).astype(np.float32)
    Lf = L.astype(np.float32)
    if kind == 'w':
        m = np.clip((Lf - bg - 28) / 42, 0, 1) * np.clip((Lf - 128) / 40, 0, 1)
    else:
        m = np.clip((bg - Lf - 22) / 55, 0, 1) * np.clip((185 - Lf) / 50, 0, 1)
    # limpia puntos sueltos (grano y rayones) y deja el borde nítido
    hard = (m > 0.35).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(hard, 8)
    keep = np.zeros(n, bool)
    keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= (14 if kind == 'd' else 22)
    m = m * cv2.dilate(keep[lab].astype(np.uint8), np.ones((3, 3), np.uint8))
    m = np.clip((m - 0.18) / 0.55, 0, 1)
    out = np.zeros(a.shape[:2], np.float32)
    sub = m[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0]
    out[y0:y1, x0:x1] = sub
    return out


def stadium(d, box, fill, round_left=True, round_right=True):
    x0, y0, x1, y1 = box
    r = (y1 - y0) / 2
    d.rectangle((x0 + (r if round_left else 0), y0, x1 - (r if round_right else 0), y1), fill=fill)
    if round_left:
        d.ellipse((x0, y0, x0 + 2 * r, y1), fill=fill)
    if round_right:
        d.ellipse((x1 - 2 * r, y0, x1, y1), fill=fill)


def background(W, H):
    S = 2  # se dibuja al doble y se reduce (bordes suaves)
    img = Image.new('RGB', (W * S, H * S), (PLASTIC,) * 3)
    # color de fondo de la etiqueta: frente, zona de la tabla y reverso, con transiciones suaves
    xs = np.arange(W, dtype=np.float32)

    def ramp(x, a, b):
        return np.clip((x - a) / (b - a), 0, 1)[:, None]

    col = np.array(TEAL, np.float32)[None, :] * (1 - ramp(xs, 2150, 2330)) + np.array(TEAL_TABLE, np.float32)[None, :] * ramp(xs, 2150, 2330)
    col = col * (1 - ramp(xs, 3478, 3540)) + np.array(TEAL_BACK, np.float32)[None, :] * ramp(xs, 3478, 3540)
    # leve degradado vertical (más claro arriba), como el impreso
    ys = np.arange(H, dtype=np.float32)[:, None, None]
    grad = 1.06 - 0.10 * (ys - T) / (B - T)
    field = np.clip(col[None, :, :] * grad, 0, 255).astype(np.uint8)
    teal = Image.fromarray(field).resize((W * S, H * S), Image.BILINEAR)
    mask = Image.new('L', (W * S, H * S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((L0 * S, T * S, L1 * S, B * S), radius=RAD * S, fill=255)
    img.paste(teal, (0, 0), mask)
    d = ImageDraw.Draw(img)
    s = lambda *v: tuple(int(round(t * S)) for t in v)  # noqa: E731
    # frente: franja gris, píldora oscura del nombre, forma de la fórmula, línea clara, forma de las cápsulas
    # y píldora inferior (medidas sobre la etiqueta enderezada)
    clip = Image.new('RGB', img.size)
    clip.paste(img)
    dd = ImageDraw.Draw(clip)
    stadium(dd, s(L0 - 200, 520, 2118, 650), GREY, round_left=False)
    stadium(dd, s(L0 - 200, 590, 2142, 765), PILL, round_left=False)
    stadium(dd, s(870, 805, 2165, 1200), FORM)
    dd.rectangle(s(L0 - 10, 1208, 2150, 1222), fill=LINE)
    stadium(dd, s(L0 - 200, 1232, 2172, 1540), LOW, round_left=False)
    stadium(dd, s(832, 1560, 2160, 1650), BOTTOM)
    # el panel blanco de la tabla y la placa del código de barras
    dd.rectangle(s(*PANEL), fill=PAPER, outline=INK, width=4 * S)
    dd.rectangle(s(*BARCODE), fill=PAPER)
    img = Image.composite(clip, img, mask)
    img = img.resize((W, H), Image.LANCZOS)
    return np.asarray(img).astype(np.float32), np.asarray(mask.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255


def plastic(src, bg, label_mask, keep_relief=True):
    """plástico blanco liso; el relieve de la marca se conserva como sombreado suave"""
    L = src.mean(2)
    low = cv2.GaussianBlur(L, (0, 0), 40)
    detail = L - low
    out = bg.copy()
    rng = np.random.default_rng(3)
    grain = rng.normal(0, 0.8, L.shape).astype(np.float32)
    shade = PLASTIC + grain
    if keep_relief:
        # relieve «Nutrabiotics» (enrollado, cruza x = 0): ventana con bordes suaves para no dejar costuras
        W = src.shape[1]
        xs = np.arange(W)
        xr = np.where(xs > W / 2, xs - W, xs).astype(np.float32)  # −20 … 640
        win = np.clip((xr + 10) / 50, 0, 1) * np.clip((660 - xr) / 50, 0, 1)
        relief = cv2.GaussianBlur(detail, (0, 0), 1.2) * win[None, :]
        shade = shade + np.clip(relief * 1.1, -60, 40)
    outside = (1 - label_mask)[..., None]
    out = out * (1 - outside) + shade[..., None] * outside
    return out


def paint(out, mask, color):
    m = mask[..., None]
    return out * (1 - m) + np.array(color, np.float32)[None, None, :] * m


def text_center(img, box, text, font, color, track=0):
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box
    size = int((y1 - y0) * 1.3)
    while True:
        f = ImageFont.truetype(font, size)
        l, t, r, b = d.textbbox((0, 0), text, font=f)
        w = r - l + track * (len(text) - 1)
        if w <= (x1 - x0) and (b - t) <= (y1 - y0):
            break
        size -= 2
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    x = cx - w / 2
    if track:
        for ch in text:
            l, t, r, b = d.textbbox((0, 0), ch, font=f)
            d.text((x - l, cy - (b + t) / 2), ch, font=f, fill=color)
            x += r - l + track
    else:
        d.text((x - l, cy - (b + t) / 2), text, font=f, fill=color)


def vertical_text(img, box, text, font, color):
    """texto que se lee de abajo hacia arriba, como el del reverso"""
    w, h = box[3] - box[1], box[2] - box[0]
    t = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    text_center(t, (0, 0, w, h), text, font, color)
    t = t.rotate(90, expand=True)
    img.paste(t, (box[0], box[1]), t)


def build(src, fict=False):
    H, W = src.shape[:2]
    bg, lm = background(W, H)
    out = plastic(src, bg, lm, keep_relief=not fict)
    for name, box, kind in BLOCKS:
        if fict and name in HIDE_FICT:
            continue
        m = text_mask(src, box, kind)
        out = paint(out, m, WHITE if kind in 'wW' else INK)
    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    if fict:
        text_center(img, (1010, 250, 1960, 372), 'Bioandes', XBOLD, WHITE)
        text_center(img, (1040, 388, 1930, 428), 'LABORATORIO FICTICIO', SEMI, WHITE, track=10)
        text_center(img, (960, 618, 2000, 742), 'PANCRIVA', XBOLD, WHITE)
        # la línea del reverso que nombra el producto
        vertical_text(img, (3842, 900, 3878, 1640), 'PANCRIVA CONTIENE DENTRO DE SU FORMULACIÓN VITAMINA D.', SEMI, WHITE)
        # placa en lugar del código de barras y aviso en lugar del fabricante (texto vertical)
        for box, lines in (((3897, 960, 4158, 1590), ['PRODUCTO FICTICIO', 'Prototipo académico Multi LAB']), ((3890, 180, 4165, 930), ['Fabricante ficticio: Bioandes', 'Muestra para el prototipo académico'])):
            w, h = box[3] - box[1], box[2] - box[0]
            plate = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            on_paper = box[1] > 900
            pd = ImageDraw.Draw(plate)
            if on_paper:
                pd.rounded_rectangle((0, 0, w - 1, h - 1), radius=14, fill=PAPER + (255,))
            color = INK if on_paper else WHITE
            n = len(lines)
            for i, t in enumerate(lines):
                text_center(plate, (24, 18 + i * (h - 36) // n, w - 24, 18 + (i + 1) * (h - 36) // n - 8), t, BOLD if i == 0 else SEMI, color)
            plate = plate.rotate(90, expand=True)
            img.paste(plate, (box[0], box[1]), plate)
    return img


def main(src_path, out):
    os.makedirs(out, exist_ok=True)
    a = np.asarray(Image.open(src_path).convert('RGB')).astype(np.float32)
    a = np.roll(a, -ROLL, axis=1)
    a = straighten(a)
    for name, fict in (('etiqueta', False), ('ficticio-etiqueta', True)):
        img = build(a, fict)
        img = Image.fromarray(np.roll(np.asarray(img), ROLL, axis=1))
        img.save(os.path.join(out, f'{name}-full.png'))
        img.resize((2048, 854), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2, 40, 2)).save(os.path.join(out, f'{name}.jpg'), quality=90)
        print(name, 'listo')


if __name__ == '__main__':
    main(*sys.argv[1:3])
