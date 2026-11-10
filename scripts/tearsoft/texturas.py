"""Texturas del empaque de TEARSOFT (Procaps) a partir de las fotos de la sesión (IMG_2244–2258).

1. Endereza cada cara (corrección de perspectiva con las 4 esquinas medidas en la foto, a 6000 × 4000 px).
2. Iguala el blanco del cartón entre fotos.
3. Genera la versión con nombre ficticio (LUBRAVIS · Bioandes) tapando nombre, logotipos y fabricantes.

Caras fotografiadas: frente (IMG_2244), un costado con la composición (IMG_2248) y una tapa (IMG_2256).
La cara de atrás es igual al frente con braille en relieve (IMG_2250–2254); se usa la foto del frente.
El otro costado no se fotografió de frente: se usa el mismo costado. Las tapas de arriba y abajo son iguales.
Las fotos originales no se guardan en el repositorio.
Uso: python3 scripts/tearsoft/texturas.py <carpeta con IMG_2244.JPG…>
Salida: assets/tearsoft/*.jpg
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'assets', 'tearsoft')
FONTS = os.path.join(ROOT, 'node_modules', '@expo-google-fonts', 'montserrat')
SRC = os.path.join(sys.argv[1] if len(sys.argv) > 1 else '.', 'IMG_%s.JPG')

# proporciones medidas en las fotos: ancho 1 : fondo 0,79 : alto 1,96
FW, FH = 640, 1256      # frente y atrás
SW = 506                # costados (SW × FH)
EH = 506                # tapas (FW × EH)
FACES = {
    'frente': ('2244', [(2528, 995), (3741, 990), (3748, 3365), (2535, 3385)], (FW, FH)),
    'costado': ('2248', [(2407, 1002), (3392, 962), (3530, 3415), (2532, 3450)], (SW, FH)),
    'tapa': ('2256', [(2312, 2545), (3610, 2485), (3652, 3478), (2335, 3513)], (FW, EH)),
}
WT = np.array([240, 241, 242.])  # blanco del cartón


def coeffs(dst, src):
    A, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    return np.linalg.solve(np.array(A, float), np.array(b, float)).tolist()


def rectify(img, pts, size):
    w, h = size
    im = ImageOps.exif_transpose(Image.open(SRC % img)).convert('RGB')
    # se recorta un margen fino para que no se cuele el borde redondeado ni el fondo
    m = 6
    big = im.transform((w * 2 + 2 * m, h * 2 + 2 * m), Image.PERSPECTIVE,
                       coeffs([(-m, -m), (w * 2 + m, -m), (w * 2 + m, h * 2 + m), (-m, h * 2 + m)], pts), Image.BICUBIC)
    big = big.crop((2 * m, 2 * m, w * 2, h * 2))
    return big.resize((w, h), Image.LANCZOS)


def white_balance(im):
    a = np.asarray(im).astype(float)
    wh = (a.min(-1) > 175) & (a.max(-1) - a.min(-1) < 30)
    g = WT / a[wh].mean(0)
    return Image.fromarray(np.clip(a * g, 0, 255).astype(np.uint8))


def font(weight, size):
    files = {'800': '800ExtraBold/Montserrat_800ExtraBold.ttf', '700': '700Bold/Montserrat_700Bold.ttf', '600': '600SemiBold/Montserrat_600SemiBold.ttf', '500': '500Medium/Montserrat_500Medium.ttf'}
    return ImageFont.truetype(os.path.join(FONTS, files[weight]), size)


NAVY = (52, 38, 110)


def patch(im, box, sample_from=None):
    """Tapa un rectángulo con el fondo de alrededor (degradado vertical tomado de las columnas vecinas)."""
    a = np.asarray(im).astype(float).copy()
    x0, y0, x1, y1 = box
    left = a[y0:y1, max(0, x0 - 6):x0].mean(1)
    right = a[y0:y1, x1:x1 + 6].mean(1)
    for i, x in enumerate(range(x0, x1)):
        t = i / max(1, x1 - x0 - 1)
        a[y0:y1, x] = left * (1 - t) + right * t
    out = Image.fromarray(a.astype(np.uint8))
    return out


def fictitious(name, im):
    """Versión ficticia: LUBRAVIS (Bioandes) en lugar de Tearsoft (Procaps) y sin logotipos reales."""
    w, h = im.size
    d = ImageDraw.Draw(im)
    if name in ('frente', 'atras'):
        im = patch(im, (int(w * .05), int(h * .765), int(w * .97), int(h * .885)))
        im = patch(im, (int(w * .68), int(h * .035), int(w * .985), int(h * .14)))  # sello con la palomita
        d = ImageDraw.Draw(im)
        f1, f2 = font('600', int(h * .026)), font('800', int(h * .062))
        d.text((int(w * .5), int(h * .815)), 'BIOANDES', font=f1, fill=NAVY, anchor='mt')
        d.text((int(w * .5), int(h * .838)), 'Lubravis', font=f2, fill=NAVY, anchor='mt')
    elif name == 'costado':
        im = patch(im, (int(w * .04), int(h * .855), int(w * .97), int(h * .985)))
        d = ImageDraw.Draw(im)
        d.text((int(w * .5), int(h * .9)), 'BIOANDES', font=font('800', int(h * .03)), fill=NAVY, anchor='mt')
        d.text((int(w * .5), int(h * .935)), 'producto ficticio', font=font('500', int(h * .018)), fill=NAVY, anchor='mt')
    elif name == 'tapa':
        im = patch(im, (int(w * .12), int(h * .6), int(w * .9), int(h * .89)))
        d = ImageDraw.Draw(im)
        d.text((int(w * .5), int(h * .62)), 'BIOANDES', font=font('600', int(h * .055)), fill=NAVY, anchor='mt')
        d.text((int(w * .5), int(h * .685)), 'Lubravis', font=font('800', int(h * .13)), fill=NAVY, anchor='mt')
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    faces = {k: white_balance(rectify(img, pts, size)) for k, (img, pts, size) in FACES.items()}
    faces['atras'] = faces['frente']
    for k, im in faces.items():
        if k == 'atras':
            continue
        im.save(os.path.join(OUT, f'{k}.jpg'), quality=92)
        fictitious(k, im.copy()).save(os.path.join(OUT, f'ficticio-{k}.jpg'), quality=92)
    print('texturas en', OUT)


if __name__ == '__main__':
    main()
