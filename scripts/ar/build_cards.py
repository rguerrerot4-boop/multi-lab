"""Genera las tarjetas impresas de realidad aumentada (una por producto ficticio).

Cada tarjeta lleva un panel con un patrón de cápsulas distinto por producto y un código QR que abre
la AR con tarjeta (public/ar-tarjeta). La cámara reconoce solo ese panel (la parte que no se repite
entre tarjetas), así que después de cambiarlo hay que volver a compilar los objetivos
(scripts/ar/compile_cards.cjs).

Uso:
  node --experimental-strip-types scripts/ar/export-products.mts
  pip install pillow qrcode
  python3 scripts/ar/build_cards.py

Salida:
  public/ar-tarjeta/tarjetas/<id>.png      imagen de cada tarjeta
  public/ar-tarjeta/objetivos/<id>.png     panel que reconoce la cámara (objetivo de AR)
  public/ar-tarjeta/tarjetas-multilab.pdf  hoja A4 para imprimir y recortar
  public/ar-tarjeta/productos.json         nombres que muestra la página de AR (mismo orden que los objetivos)
"""

import json
import os
import random
import shutil

import qrcode
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "ar-tarjeta")
FONTS = os.path.join(ROOT, "node_modules", "@expo-google-fonts", "montserrat")

# Dirección pública de la versión web (GitHub Pages). Si se publica en otro sitio, cámbiala y regenera.
SITE = "https://rguerrerot4-boop.github.io/multi-lab"

TEAL, PETROLEO, TURQUESA = "#1E7F8C", "#20343A", "#63C9D6"
INK_MUTED, ACCENT_SOFT, WHITE = "#5B6E74", "#E6F7F9", "#FFFFFF"

DPI = 300
CW, CH = 1500, 945  # 127 × 80 mm a 300 ppp
PANEL = 600  # ancho del panel que reconoce la cámara (51 mm)


def font(weight, size):
    name = {"bold": "700Bold", "semibold": "600SemiBold", "medium": "500Medium", "regular": "400Regular"}[weight]
    return ImageFont.truetype(os.path.join(FONTS, name, f"Montserrat_{name}.ttf"), size)


def wrap(draw, text, fnt, width):
    lines, line = [], ""
    for word in text.split():
        test = f"{line} {word}".strip()
        if draw.textlength(test, font=fnt) <= width:
            line = test
        else:
            lines.append(line)
            line = word
    lines.append(line)
    return lines


def card(p):
    """Devuelve (tarjeta, panel objetivo)."""
    im = Image.new("RGB", (CW, CH), WHITE)
    d = ImageDraw.Draw(im)

    # panel izquierdo: patrón de cápsulas distinto en cada tarjeta; es lo único que reconoce la cámara
    panel = Image.new("RGB", (PANEL, CH), PETROLEO)
    rnd = random.Random(f"multilab-{p['id']}")
    for _ in range(70):
        w = rnd.randint(46, 190)
        h = rnd.randint(30, 72)
        pill = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(pill).rounded_rectangle((0, 0, w - 1, h - 1), h // 2, fill=rnd.choice([TEAL, TURQUESA, WHITE, "#3E8E9B"]))
        pill = pill.rotate(rnd.choice([0, 30, 45, 60, 90, 120, 135, 150]), expand=True)
        panel.paste(pill, (rnd.randint(-40, PANEL - 20), rnd.randint(-40, CH - 20)), pill)
    im.paste(panel, (0, 0))

    # logotipo: solo se escala de forma proporcional (nunca se deforma ni recolorea)
    logo = Image.open(os.path.join(ROOT, "assets", "logo-full.png")).convert("RGBA")
    lh = 84
    logo = logo.resize((round(logo.width * lh / logo.height), lh), Image.LANCZOS)
    x0 = PANEL + 60
    im.paste(logo, (x0, 60), logo)

    y = 200
    d.text((x0, y), p["category"].upper(), font=font("bold", 30), fill=TEAL)
    y += 52
    for line in wrap(d, p["name"], font("bold", 66), CW - x0 - 60):
        d.text((x0, y), line, font=font("bold", 66), fill=PETROLEO)
        y += 80
    d.text((x0, y + 6), f"{p['lab']} (ficticio) · {p['form']}", font=font("medium", 30), fill=INK_MUTED)
    y += 70
    badge = "Producto ficticio · prototipo académico"
    bw = d.textlength(badge, font=font("semibold", 26)) + 44
    d.rounded_rectangle((x0, y, x0 + bw, y + 52), 26, fill=ACCENT_SOFT)
    d.text((x0 + 22, y + 11), badge, font=font("semibold", 26), fill=PETROLEO)

    # código QR que abre la AR con tarjeta de este producto
    qr = qrcode.QRCode(border=0, box_size=10, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(f"{SITE}/ar-tarjeta/?p={p['id']}")
    qr.make(fit=True)
    qimg = qr.make_image(fill_color=PETROLEO, back_color=WHITE).convert("RGB").resize((270, 270), Image.NEAREST)
    qx, qy = CW - 60 - 270, CH - 60 - 270
    im.paste(qimg, (qx, qy))

    ty = qy + 6
    d.text((x0, ty), "Realidad aumentada", font=font("bold", 34), fill=PETROLEO)
    for line in ["1. Escanea el código con", "    la cámara del teléfono.", "2. Apunta la cámara", "    a esta tarjeta."]:
        ty += 50
        d.text((x0, ty), line, font=font("medium", 28), fill=INK_MUTED)

    d.rectangle((0, 0, CW - 1, CH - 1), outline="#DCE5E7", width=3)
    return im, panel


def sheet(cards):
    # A4 a 300 ppp con tres tarjetas por hoja y líneas de corte
    W, H = 2480, 3508
    pages = []
    for i in range(0, len(cards), 3):
        page = Image.new("RGB", (W, H), WHITE)
        d = ImageDraw.Draw(page)
        d.text((150, 120), "Multi LAB · Tarjetas de realidad aumentada (productos ficticios, prototipo académico)", font=font("semibold", 36), fill=INK_MUTED)
        d.text((150, 175), "Imprime al 100 % (sin ajustar a la página) y recorta por la línea punteada.", font=font("regular", 32), fill=INK_MUTED)
        for k, c in enumerate(cards[i:i + 3]):
            x, y = (W - CW) // 2, 300 + k * (CH + 130)
            page.paste(c, (x, y))
            for dx in range(x - 20, x + CW + 20, 24):
                d.line((dx, y - 20, dx + 12, y - 20), fill="#8A9A9F", width=3)
                d.line((dx, y + CH + 20, dx + 12, y + CH + 20), fill="#8A9A9F", width=3)
            for dy in range(y - 20, y + CH + 20, 24):
                d.line((x - 20, dy, x - 20, dy + 12), fill="#8A9A9F", width=3)
                d.line((x + CW + 20, dy, x + CW + 20, dy + 12), fill="#8A9A9F", width=3)
        pages.append(page)
    pages[0].save(os.path.join(OUT, "tarjetas-multilab.pdf"), save_all=True, append_images=pages[1:], resolution=DPI)


def main():
    with open(os.path.join(ROOT, "scripts", "ar", "products.json"), encoding="utf-8") as f:
        products = json.load(f)
    os.makedirs(os.path.join(OUT, "tarjetas"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "objetivos"), exist_ok=True)
    cards = []
    for p in products:
        c, panel = card(p)
        c.save(os.path.join(OUT, "tarjetas", f"{p['id']}.png"), optimize=True)
        panel.save(os.path.join(OUT, "objetivos", f"{p['id']}.png"), optimize=True)
        cards.append(c)
    sheet(cards)
    with open(os.path.join(OUT, "productos.json"), "w", encoding="utf-8") as f:
        json.dump([{k: p[k] for k in ("id", "name", "lab", "category")} for p in products], f, ensure_ascii=False, indent=1)
    shutil.copyfile(os.path.join(ROOT, "assets", "logo-full.png"), os.path.join(OUT, "logo-full.png"))
    print(f"{len(cards)} tarjetas en {OUT}")


if __name__ == "__main__":
    main()
