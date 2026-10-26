"""Modelos de AR de CORAESSENS (GLB para Android, USDZ para iPhone) con las texturas de las fotos.

Usa la misma geometría de caja que scripts/ar/build_models.py, con las medidas de esta caja, y le
agrega la animación de presentación con el nombre en 3D (scripts/coraessens/animacion.py).
Genera dos versiones: con el nombre real (cor) y con el nombre ficticio (cor-f).
Necesita: pip install usd-core pillow fonttools shapely mapbox-earcut

Uso: python3 scripts/coraessens/modelo.py   (antes: texturas.py)
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'ar'))
import build_models as bm  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import animacion  # noqa: E402

TEX = os.path.join(ROOT, 'assets', 'coraessens')

# Medidas aproximadas de la caja (m): base cuadrada y alto 1,44 veces el ancho (medido en las fotos)
bm.W, bm.H, bm.D = 0.036, 0.052, 0.036
SW, SH = 500, 723  # caras laterales en el atlas
bm.ATLAS = 2048
bm.RECTS = {
    'front': (0, 0, SW, SH),
    'right': (SW + 10, 0, SW, SH),
    'back': (2 * SW + 20, 0, SW, SH),
    'left': (3 * SW + 30, 0, SW, SH),
    'top': (0, SH + 10, SW, SW),
    'bottom': (SW + 10, SH + 10, SW, SW),
}


def atlas(prefix):
    a = Image.new('RGB', (bm.ATLAS, bm.ATLAS), (236, 235, 231))
    for face, (x, y, w, h) in bm.RECTS.items():
        im = Image.open(os.path.join(TEX, f'{prefix}{face}.jpg')).convert('RGB')
        a.paste(im.resize((w, h), Image.LANCZOS), (x, y))
    return a


def main():
    os.makedirs(bm.OUT, exist_ok=True)
    for pid, name, prefix, text in (('cor', 'CORAESSENS', '', 'CORAESSENS'), ('cor-f', 'KARDENSA (ficticio)', 'ficticio-', 'KARDENSA')):
        jpg = os.path.join(bm.OUT, f'{pid}.jpg')
        atlas(prefix).save(jpg, 'JPEG', quality=88, optimize=True)
        data = open(jpg, 'rb').read()
        w = animacion.write_glb(os.path.join(bm.OUT, f'{pid}.glb'), name, bm, data, text)
        animacion.write_usdz(os.path.join(bm.OUT, f'{pid}.usdz'), name, bm, jpg, text)
        print(pid, name, f'listo · nombre 3D de {w * 100:.1f} cm')


if __name__ == '__main__':
    main()
