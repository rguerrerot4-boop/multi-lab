"""Convierte los cuadros de cuadros.cjs a WebP (assets/pancreogen) y recorta la miniatura de frente.
Uso: python3 webp.py <carpeta png> [<salida>]"""
import glob
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


def main(src, out=os.path.join(ROOT, 'assets', 'pancreogen')):
    for f in sorted(glob.glob(os.path.join(src, '*.png'))):
        name = os.path.splitext(os.path.basename(f))[0]
        im = Image.open(f).convert('RGBA')
        if name in ('frente', 'ficticio-frente'):
            im = im.crop(im.getbbox())
            im = im.resize((round(im.width * 900 / im.height), 900), Image.LANCZOS)
            im.save(os.path.join(out, f'{name}.png'), optimize=True)
        else:
            im.save(os.path.join(out, f'{name}.webp'), quality=84, method=6)
    print('listo')


if __name__ == '__main__':
    main(*sys.argv[1:3])
