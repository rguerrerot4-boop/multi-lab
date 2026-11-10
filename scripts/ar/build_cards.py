"""Genera las tarjetas impresas de realidad aumentada (una por producto).

Solo los 5 productos reales (con permiso): CORAESSENS, PANCREOGEN, TEARSOFT, DEFEROL y VITYBELL. Cada uno
tiene su propia tarjeta con los colores de su empaque y la foto del producto en el panel. (La función
card() del patrón de cápsulas era para los productos ficticios de prueba, ya retirados.)

Cada tarjeta lleva un panel con un patrón de cápsulas distinto por producto y un código QR que abre
la ficha del producto en PDF (public/fichas, scripts/fichas/build_fichas.py); desde la ficha se abre la
AR con tarjeta (public/ar-tarjeta/?p=<id>), que solo responde a la tarjeta de ese producto. La cámara reconoce solo ese panel (la parte que no se repite
entre tarjetas), así que después de cambiarlo hay que volver a compilar los objetivos
(scripts/ar/compile_cards.cjs).

Uso:
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
    qr.add_data(f"{SITE}/fichas/{p['id']}.pdf")  # abre la ficha del producto en PDF
    qr.make(fit=True)
    qimg = qr.make_image(fill_color=PETROLEO, back_color=WHITE).convert("RGB").resize((270, 270), Image.NEAREST)
    qx, qy = CW - 60 - 270, CH - 60 - 270
    im.paste(qimg, (qx, qy))

    ty = qy + 6
    d.text((x0, ty), "Ficha del producto", font=font("bold", 34), fill=PETROLEO)
    for line in ["1. Escanea el código: se", "    abre la ficha en PDF.", "2. Toca «Ver en AR» y", "    apunta a esta tarjeta."]:
        ty += 50
        d.text((x0, ty), line, font=font("medium", 28), fill=INK_MUTED)

    d.rectangle((0, 0, CW - 1, CH - 1), outline="#DCE5E7", width=3)
    return im, panel


# ---------- tarjeta propia de CORAESSENS (colores del empaque: rojo, morado y blanco) ----------
COR = {"id": "cor", "name": "CORAESSENS", "lab": "Nutrabiotics", "category": "Suplemento dietario", "real": True, "escala": 0.8}  # la caja es más pequeña que las ficticias
RED, RED_DEEP, PURPLE, PURPLE_DEEP, BLUSH = "#C9262F", "#99161F", "#5C2C78", "#341447", "#FBEDEE"


def card_coraessens():
    im = Image.new("RGB", (CW, CH), WHITE)
    d = ImageDraw.Draw(im)

    # panel que reconoce la cámara: fondo morado, cápsulas rojas y blancas y la foto del frente de la caja
    panel = Image.new("RGB", (PANEL, CH), PURPLE_DEEP)
    pd = ImageDraw.Draw(panel)
    for k in range(0, PANEL + CH, 46):  # líneas diagonales finas (más detalle para el seguimiento)
        pd.line((k, 0, k - CH, CH), fill=PURPLE, width=10)
    rnd = random.Random("multilab-cor")
    for _ in range(46):
        w = rnd.randint(46, 170)
        h = rnd.randint(30, 64)
        pill = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(pill).rounded_rectangle((0, 0, w - 1, h - 1), h // 2, fill=rnd.choice([RED, WHITE, "#E46A72", RED_DEEP]))
        pill = pill.rotate(rnd.choice([0, 30, 45, 60, 90, 120, 135, 150]), expand=True)
        panel.paste(pill, (rnd.randint(-40, PANEL - 20), rnd.randint(-40, CH - 20)), pill)
    box = Image.open(os.path.join(ROOT, "assets", "coraessens", "front.jpg")).convert("RGB")
    bw = 330
    box = box.resize((bw, round(box.height * bw / box.width)), Image.LANCZOS)
    framed = Image.new("RGBA", (box.width + 24, box.height + 24), WHITE)
    framed.paste(box, (12, 12))
    framed = framed.rotate(-7, expand=True, resample=Image.BICUBIC)
    shadow = Image.new("RGBA", framed.size, (0, 0, 0, 0))
    shadow.paste((20, 6, 30, 120), (0, 0), framed.split()[3])
    from PIL import ImageFilter
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    cx, cy = (PANEL - framed.width) // 2, (CH - framed.height) // 2
    panel.paste(shadow, (cx + 10, cy + 18), shadow)
    panel.paste(framed, (cx, cy), framed)
    im.paste(panel, (0, 0))

    logo = Image.open(os.path.join(ROOT, "assets", "logo-full.png")).convert("RGBA")
    lh = 84
    logo = logo.resize((round(logo.width * lh / logo.height), lh), Image.LANCZOS)
    x0 = PANEL + 60
    im.paste(logo, (x0, 60), logo)

    y = 200
    d.text((x0, y), "SUPLEMENTO DIETARIO", font=font("bold", 30), fill=RED)
    y += 52
    d.text((x0, y), "CORAESSENS®", font=font("bold", 72), fill=PURPLE_DEEP)
    y += 96
    d.text((x0, y), "Nutrabiotics · 9 cápsulas", font=font("medium", 30), fill=INK_MUTED)
    y += 60
    badge = "Muestra · prohibida su venta"
    bwid = d.textlength(badge, font=font("semibold", 26)) + 44
    d.rounded_rectangle((x0, y, x0 + bwid, y + 52), 26, fill=RED)
    d.text((x0 + 22, y + 11), badge, font=font("semibold", 26), fill=WHITE)

    qr = qrcode.QRCode(border=0, box_size=10, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(f"{SITE}/fichas/cor.pdf")  # abre la ficha del producto en PDF
    qr.make(fit=True)
    qimg = qr.make_image(fill_color=PURPLE_DEEP, back_color=WHITE).convert("RGB").resize((270, 270), Image.NEAREST)
    qx, qy = CW - 60 - 270, CH - 60 - 270
    im.paste(qimg, (qx, qy))
    ty = qy + 6
    d.text((x0, ty), "Ficha del producto", font=font("bold", 34), fill=PURPLE_DEEP)
    for line in ["1. Escanea el código: se", "    abre la ficha en PDF.", "2. Toca «Ver en AR» y", "    apunta a la foto de la caja."]:
        ty += 50
        d.text((x0, ty), line, font=font("medium", 28), fill=INK_MUTED)
    d.text((x0, CH - 44), "Producto real mostrado con permiso del laboratorio.", font=font("regular", 22), fill=INK_MUTED)

    d.rectangle((0, CH - 14, CW, CH), fill=RED)
    d.rectangle((0, 0, CW - 1, CH - 1), outline="#DCE5E7", width=3)
    return im, panel


# ---------- tarjeta propia de PANCREOGEN (colores de su etiqueta: teal, blanco y plata) ----------
PAN = {"id": "pan", "name": "PANCREOGEN", "lab": "Nutrabiotics", "category": "Suplemento dietario", "real": True, "escala": 0.35}  # el frasco es alto (12,4 cm): 35 %
P_TEAL, P_DEEP, P_NIGHT, P_MINT, P_SILVER = "#1F6B6E", "#0E3A3C", "#061718", "#8FD3CC", "#C9CED2"


def card_pancreogen():
    from PIL import ImageFilter

    im = Image.new("RGB", (CW, CH), WHITE)
    d = ImageDraw.Draw(im)
    # panel que reconoce la cámara: fondo teal oscuro, anillos y cápsulas teal, blancas y menta, y el frasco
    panel = Image.new("RGB", (PANEL, CH), P_NIGHT)
    pd = ImageDraw.Draw(panel)
    for k, rr in enumerate(range(60, 900, 54)):  # anillos concéntricos (detalle para el seguimiento)
        pd.ellipse((PANEL / 2 - rr, CH * 0.55 - rr, PANEL / 2 + rr, CH * 0.55 + rr), outline=P_DEEP if k % 2 else P_TEAL, width=9)
    rnd = random.Random("multilab-pan")
    for _ in range(54):
        w = rnd.randint(44, 160)
        h = rnd.randint(28, 60)
        pill = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        a, b = rnd.choice([(P_TEAL, WHITE), (WHITE, P_MINT), (P_MINT, P_TEAL), (P_SILVER, P_DEEP)])
        pdraw = ImageDraw.Draw(pill)
        pdraw.rounded_rectangle((0, 0, w - 1, h - 1), h // 2, fill=a)
        pdraw.rounded_rectangle((w // 2, 0, w - 1, h - 1), h // 2, fill=b)
        pdraw.rectangle((w // 2, 0, w // 2 + h // 2, h - 1), fill=b)
        pill = pill.rotate(rnd.choice([0, 25, 45, 70, 90, 115, 135, 160]), expand=True)
        panel.paste(pill, (rnd.randint(-40, PANEL - 20), rnd.randint(-40, CH - 20)), pill)
    bottle = Image.open(os.path.join(ROOT, "assets", "pancreogen", "frente.png")).convert("RGBA")
    bh = 760
    bottle = bottle.resize((round(bottle.width * bh / bottle.height), bh), Image.LANCZOS)
    shadow = Image.new("RGBA", (bottle.width + 120, 90), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((10, 10, bottle.width + 110, 80), fill=(0, 0, 0, 170))
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    bx, by = (PANEL - bottle.width) // 2, (CH - bh) // 2 + 10
    panel.paste(shadow, (bx - 60, by + bh - 50), shadow)
    panel.paste(bottle, (bx, by), bottle)
    im.paste(panel, (0, 0))

    logo = Image.open(os.path.join(ROOT, "assets", "logo-full.png")).convert("RGBA")
    lh = 84
    logo = logo.resize((round(logo.width * lh / logo.height), lh), Image.LANCZOS)
    x0 = PANEL + 60
    im.paste(logo, (x0, 60), logo)
    y = 200
    d.text((x0, y), "SUPLEMENTO DIETARIO", font=font("bold", 30), fill=P_TEAL)
    y += 52
    d.text((x0, y), "PANCREOGEN®", font=font("bold", 68), fill=P_DEEP)
    y += 92
    d.text((x0, y), "Nutrabiotics · 90 cápsulas", font=font("medium", 30), fill=INK_MUTED)
    y += 60
    badge = "Producto real · con permiso"
    bwid = d.textlength(badge, font=font("semibold", 26)) + 44
    d.rounded_rectangle((x0, y, x0 + bwid, y + 52), 26, fill=P_TEAL)
    d.text((x0 + 22, y + 11), badge, font=font("semibold", 26), fill=WHITE)

    qr = qrcode.QRCode(border=0, box_size=10, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(f"{SITE}/fichas/pan.pdf")  # abre la ficha del producto en PDF
    qr.make(fit=True)
    qimg = qr.make_image(fill_color=P_NIGHT, back_color=WHITE).convert("RGB").resize((270, 270), Image.NEAREST)
    qx, qy = CW - 60 - 270, CH - 60 - 270
    im.paste(qimg, (qx, qy))
    ty = qy + 6
    d.text((x0, ty), "Ficha del producto", font=font("bold", 34), fill=P_DEEP)
    for line in ["1. Escanea el código: se", "    abre la ficha en PDF.", "2. Toca «Ver en AR» y", "    apunta a la foto del frasco."]:
        ty += 50
        d.text((x0, ty), line, font=font("medium", 28), fill=INK_MUTED)
    d.text((x0, CH - 44), "Producto real mostrado con permiso del laboratorio.", font=font("regular", 22), fill=INK_MUTED)
    d.rectangle((0, CH - 14, CW, CH), fill=P_TEAL)
    d.rectangle((0, 0, CW - 1, CH - 1), outline="#DCE5E7", width=3)
    return im, panel


# ---------- tarjeta propia de TEARSOFT (colores de su caja: azul marino, celeste y la franja de colores) ----------
TEA = {"id": "tea", "name": "TEARSOFT", "lab": "Procaps", "category": "Solución oftálmica", "real": True, "escala": 0.65}  # la caja flota 1,4 cm sobre el piso: unos 4,4 cm de alto, como PANCREOGEN
T_NAVY, T_DEEP, T_SKY, T_SOFT = "#32316C", "#1E1D4A", "#8AD1FD", "#C3E4FC"
T_RAINBOW = ["#2C77AC", "#24B96D", "#F5DC34", "#F68C2B", "#F7592C"]


def drop(size, color):
    """Gota (punta arriba) en una imagen RGBA: círculo abajo y triángulo arriba."""
    w, h = size, round(size * 1.4)
    im = Image.new("RGBA", (w * 4, h * 4), (0, 0, 0, 0))
    r = w * 2
    cx, cy = w * 2, h * 4 - r
    d = ImageDraw.Draw(im)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)
    d.polygon([(cx - r * 0.86, cy - r * 0.5), (cx, 0), (cx + r * 0.86, cy - r * 0.5)], fill=color)
    return im.resize((w, h), Image.LANCZOS)


def card_tearsoft():
    from PIL import ImageFilter

    im = Image.new("RGB", (CW, CH), WHITE)
    d = ImageDraw.Draw(im)
    # panel que reconoce la cámara: azul noche, ondas de gota celestes, gotas de colores y la foto del frente de la caja
    panel = Image.new("RGB", (PANEL, CH), T_DEEP)
    pd = ImageDraw.Draw(panel)
    for k, rr in enumerate(range(40, 1000, 46)):  # ondas que se abren desde abajo (detalle para el seguimiento)
        pd.ellipse((PANEL * 0.3 - rr * 1.2, CH * 0.82 - rr * 0.7, PANEL * 0.3 + rr * 1.2, CH * 0.82 + rr * 0.7), outline=T_NAVY if k % 2 else "#2A3F86", width=10)
    rnd = random.Random("multilab-tea")
    for _ in range(58):
        g = drop(rnd.randint(30, 92), rnd.choice([T_SKY, T_SOFT, WHITE, T_SKY] + T_RAINBOW))
        g = g.rotate(rnd.choice([0, 0, 20, -20, 35, -35, 180]), expand=True, resample=Image.BICUBIC)
        panel.paste(g, (rnd.randint(-30, PANEL - 20), rnd.randint(-30, CH - 20)), g)
    box = Image.open(os.path.join(ROOT, "assets", "tearsoft", "frente.jpg")).convert("RGB")
    bw = 300
    box = box.resize((bw, round(box.height * bw / box.width)), Image.LANCZOS)
    framed = Image.new("RGBA", (box.width + 24, box.height + 24), WHITE)
    framed.paste(box, (12, 12))
    framed = framed.rotate(6, expand=True, resample=Image.BICUBIC)
    shadow = Image.new("RGBA", framed.size, (0, 0, 0, 0))
    shadow.paste((5, 5, 30, 140), (0, 0), framed.split()[3])
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    cx, cy = (PANEL - framed.width) // 2, (CH - framed.height) // 2
    panel.paste(shadow, (cx + 10, cy + 18), shadow)
    panel.paste(framed, (cx, cy), framed)
    im.paste(panel, (0, 0))

    logo = Image.open(os.path.join(ROOT, "assets", "logo-full.png")).convert("RGBA")
    lh = 84
    logo = logo.resize((round(logo.width * lh / logo.height), lh), Image.LANCZOS)
    x0 = PANEL + 60
    im.paste(logo, (x0, 60), logo)
    y = 200
    d.text((x0, y), "SOLUCIÓN OFTÁLMICA", font=font("bold", 30), fill=T_NAVY)
    y += 52
    d.text((x0, y), "TEARSOFT®", font=font("bold", 72), fill=T_DEEP)
    y += 96
    d.text((x0, y), "Procaps · 1 frasco de 3 mL", font=font("medium", 30), fill=INK_MUTED)
    y += 60
    badge = "Muestra médica · prohibida su venta"
    bwid = d.textlength(badge, font=font("semibold", 26)) + 44
    d.rounded_rectangle((x0, y, x0 + bwid, y + 52), 26, fill=T_NAVY)
    d.text((x0 + 22, y + 11), badge, font=font("semibold", 26), fill=WHITE)

    qr = qrcode.QRCode(border=0, box_size=10, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(f"{SITE}/fichas/tea.pdf")  # abre la ficha del producto en PDF
    qr.make(fit=True)
    qimg = qr.make_image(fill_color=T_DEEP, back_color=WHITE).convert("RGB").resize((270, 270), Image.NEAREST)
    qx, qy = CW - 60 - 270, CH - 60 - 270
    im.paste(qimg, (qx, qy))
    ty = qy + 6
    d.text((x0, ty), "Ficha del producto", font=font("bold", 34), fill=T_DEEP)
    for line in ["1. Escanea el código: se", "    abre la ficha en PDF.", "2. Toca «Ver en AR» y", "    apunta a la foto de la caja."]:
        ty += 50
        d.text((x0, ty), line, font=font("medium", 28), fill=INK_MUTED)
    d.text((x0, CH - 44), "Producto real mostrado con permiso del laboratorio.", font=font("regular", 22), fill=INK_MUTED)
    seg = CW / len(T_RAINBOW)  # franja de colores de la caja
    for k, col in enumerate(T_RAINBOW):
        d.rectangle((round(k * seg), CH - 14, round((k + 1) * seg), CH), fill=col)
    d.rectangle((0, 0, CW - 1, CH - 1), outline="#DCE5E7", width=3)
    return im, panel


# ---------- tarjeta propia de DEFEROL (colores de su caja: turquesa, plateado y coral) ----------
DEF = {"id": "def", "name": "DEFEROL", "lab": "Procaps", "category": "Vitamina D3", "real": True, "escala": 0.65}  # la caja mide 7 cm de ancho y gira: 65 %
D_AQUA, D_DEEP, D_INK, D_SILVER, D_CORAL, D_SOFT = "#66D9CF", "#0E6A66", "#0B3332", "#9AA3A8", "#D23B43", "#D6F4F1"


def softgel(w, rot):
    """Cápsula blanda ilustrativa (ámbar con brillo)."""
    h = round(w * 0.56)
    im = Image.new("RGBA", (w * 3, h * 3), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((0, 0, w * 3 - 1, h * 3 - 1), fill="#8A5A12")
    d.ellipse((9, 9, w * 3 - 10, h * 3 - 10), fill="#E9A531")
    d.ellipse((w * 0.25, h * 0.25, w * 2.75, h * 2.2), fill="#F6C55A")
    d.ellipse((w * 0.7, h * 0.45, w * 1.8, h * 0.95), fill="#FFF1C8")
    im = im.resize((w, h), Image.LANCZOS)
    return im.rotate(rot, expand=True, resample=Image.BICUBIC)


def card_deferol():
    import math
    from PIL import ImageFilter

    im = Image.new("RGB", (CW, CH), WHITE)
    d = ImageDraw.Draw(im)
    # panel que reconoce la cámara: turquesa oscuro (contraste para el seguimiento), espirales turquesa, blancas y
    # plateadas, cápsulas con borde y la foto del frente de la caja
    panel = Image.new("RGB", (PANEL, CH), D_INK)
    pd = ImageDraw.Draw(panel)
    for k in range(0, PANEL + CH, 52):  # líneas diagonales finas
        pd.line((k, 0, k - CH, CH), fill=D_DEEP, width=12)
    rnd = random.Random("multilab-def")
    for _ in range(12):  # espirales como las del cartón
        cx, cy, r0 = rnd.randint(-40, PANEL + 40), rnd.randint(-40, CH + 40), rnd.randint(60, 150)
        pts = [(cx + math.cos(t / 18) * r0 * (1 - t / 140), cy + math.sin(t / 18) * r0 * (1 - t / 140)) for t in range(0, 125)]
        pd.line(pts, fill=rnd.choice([D_AQUA, WHITE, D_SILVER, D_SOFT]), width=rnd.choice([7, 10, 14]), joint="curve")
    for k in range(3):  # arcos plateados como el estampado
        pd.arc((-500 + k * 30, 120 + k * 22, PANEL + 520, CH * 2), 200, 330, fill=[D_SILVER, WHITE, D_AQUA][k], width=[16, 6, 8][k])
    for _ in range(30):
        g = softgel(rnd.randint(50, 110), rnd.randint(0, 179))
        panel.paste(g, (rnd.randint(-30, PANEL - 30), rnd.randint(-30, CH - 30)), g)
    box = Image.open(os.path.join(ROOT, "assets", "deferol", "frente.jpg")).convert("RGB")
    bw = 440
    box = box.resize((bw, round(box.height * bw / box.width)), Image.LANCZOS)
    framed = Image.new("RGBA", (box.width + 22, box.height + 22), WHITE)
    framed.paste(box, (11, 11))
    framed = framed.rotate(-9, expand=True, resample=Image.BICUBIC)
    shadow = Image.new("RGBA", framed.size, (0, 0, 0, 0))
    shadow.paste((5, 40, 40, 130), (0, 0), framed.split()[3])
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    cx, cy = (PANEL - framed.width) // 2, (CH - framed.height) // 2
    panel.paste(shadow, (cx + 10, cy + 18), shadow)
    panel.paste(framed, (cx, cy), framed)
    im.paste(panel, (0, 0))

    logo = Image.open(os.path.join(ROOT, "assets", "logo-full.png")).convert("RGBA")
    lh = 84
    logo = logo.resize((round(logo.width * lh / logo.height), lh), Image.LANCZOS)
    x0 = PANEL + 60
    im.paste(logo, (x0, 60), logo)
    y = 200
    d.text((x0, y), "VITAMINA D3 · 7000 U.I.", font=font("bold", 30), fill=D_DEEP)
    y += 52
    d.text((x0, y), "DEFEROL®", font=font("bold", 72), fill=D_INK)
    y += 96
    d.text((x0, y), "Procaps · 1 cápsula blanda", font=font("medium", 30), fill=INK_MUTED)
    y += 60
    badge = "Muestra médica · prohibida su venta"
    bwid = d.textlength(badge, font=font("semibold", 26)) + 44
    d.rounded_rectangle((x0, y, x0 + bwid, y + 52), 26, fill=D_CORAL)
    d.text((x0 + 22, y + 11), badge, font=font("semibold", 26), fill=WHITE)

    qr = qrcode.QRCode(border=0, box_size=10, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(f"{SITE}/fichas/def.pdf")  # abre la ficha del producto en PDF
    qr.make(fit=True)
    qimg = qr.make_image(fill_color=D_INK, back_color=WHITE).convert("RGB").resize((270, 270), Image.NEAREST)
    qx, qy = CW - 60 - 270, CH - 60 - 270
    im.paste(qimg, (qx, qy))
    ty = qy + 6
    d.text((x0, ty), "Ficha del producto", font=font("bold", 34), fill=D_INK)
    for line in ["1. Escanea el código: se", "    abre la ficha en PDF.", "2. Toca «Ver en AR» y", "    apunta a la foto de la caja."]:
        ty += 50
        d.text((x0, ty), line, font=font("medium", 28), fill=INK_MUTED)
    d.text((x0, CH - 44), "Producto real mostrado con permiso del laboratorio.", font=font("regular", 22), fill=INK_MUTED)
    d.rectangle((0, CH - 14, CW, CH), fill=D_AQUA)
    d.rectangle((CW * 0.72, CH - 14, CW, CH), fill=D_SILVER)
    d.rectangle((0, 0, CW - 1, CH - 1), outline="#DCE5E7", width=3)
    return im, panel


# ---------- tarjeta propia de VITYBELL (colores de su caja: rosado, rojo y dorado) ----------
VIT = {"id": "vit", "name": "VITYBELL", "lab": "Procaps", "category": "Suplemento alimenticio", "real": True, "escala": 0.65}  # la caja mide 7 cm de ancho y gira: 65 %
V_PLUM, V_PLUM2, V_ROSE, V_PINK, V_PEARL, V_GOLD = "#24152A", "#3A2440", "#C2223F", "#E6D0E6", "#E9A8C8", "#D4A24C"


def pearl(w, rot):
    """Cápsula blanda perlada ilustrativa."""
    h = round(w * 0.58)
    im = Image.new("RGBA", (w * 3, h * 3), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((0, 0, w * 3 - 1, h * 3 - 1), fill="#7E2F57")
    d.ellipse((9, 9, w * 3 - 10, h * 3 - 10), fill="#D98AB4")
    d.ellipse((w * 0.25, h * 0.2, w * 2.7, h * 2.1), fill=V_PEARL)
    d.ellipse((w * 0.7, h * 0.45, w * 1.8, h * 0.95), fill="#FFF3FA")
    im = im.resize((w, h), Image.LANCZOS)
    return im.rotate(rot, expand=True, resample=Image.BICUBIC)


def card_vitybell():
    import math
    from PIL import ImageFilter

    im = Image.new("RGB", (CW, CH), WHITE)
    d = ImageDraw.Draw(im)
    # panel que reconoce la cámara: ciruela oscuro (contraste), trazos de cabello claros, líneas doradas, cápsulas
    # perladas con borde y la foto del frente de la caja
    panel = Image.new("RGB", (PANEL, CH), V_PLUM)
    pd = ImageDraw.Draw(panel)
    for k in range(0, PANEL + CH, 48):  # líneas diagonales finas
        pd.line((k, 0, k - CH, CH), fill=V_PLUM2, width=12)
    rnd = random.Random("multilab-vit")
    for _ in range(16):  # trazos de cabello (curvas)
        x0, y0 = rnd.randint(-60, PANEL), rnd.randint(-40, CH)
        x3, y3 = x0 + rnd.randint(120, 320), y0 - rnd.randint(80, 260)
        c1 = (x0 + rnd.randint(0, 120), y0 - rnd.randint(40, 200))
        pts = []
        for t in [i / 40 for i in range(41)]:
            x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * c1[0] + t * t * x3
            y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * c1[1] + t * t * y3
            pts.append((x, y))
        pd.line(pts, fill=rnd.choice([V_PINK, WHITE, "#9C8AA3", V_PEARL]), width=rnd.choice([5, 8, 11]), joint="curve")
    for k in range(4):  # líneas doradas como las de la caja
        y = 120 + k * 230
        pd.line((0, y, PANEL, y - 60), fill=V_GOLD, width=6)
    for _ in range(28):
        g = pearl(rnd.randint(48, 104), rnd.randint(0, 179))
        panel.paste(g, (rnd.randint(-30, PANEL - 30), rnd.randint(-30, CH - 30)), g)
    box = Image.open(os.path.join(ROOT, "assets", "vitybell", "frente.jpg")).convert("RGB")
    bw = 440
    box = box.resize((bw, round(box.height * bw / box.width)), Image.LANCZOS)
    framed = Image.new("RGBA", (box.width + 22, box.height + 22), WHITE)
    framed.paste(box, (11, 11))
    framed = framed.rotate(8, expand=True, resample=Image.BICUBIC)
    shadow = Image.new("RGBA", framed.size, (0, 0, 0, 0))
    shadow.paste((10, 0, 20, 140), (0, 0), framed.split()[3])
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    cx, cy = (PANEL - framed.width) // 2, (CH - framed.height) // 2
    panel.paste(shadow, (cx + 10, cy + 18), shadow)
    panel.paste(framed, (cx, cy), framed)
    im.paste(panel, (0, 0))

    logo = Image.open(os.path.join(ROOT, "assets", "logo-full.png")).convert("RGBA")
    lh = 84
    logo = logo.resize((round(logo.width * lh / logo.height), lh), Image.LANCZOS)
    x0 = PANEL + 60
    im.paste(logo, (x0, 60), logo)
    y = 200
    d.text((x0, y), "SUPLEMENTO ALIMENTICIO", font=font("bold", 30), fill=V_ROSE)
    y += 52
    d.text((x0, y), "VITYBELL®", font=font("bold", 72), fill=V_PLUM)
    y += 96
    d.text((x0, y), "Procaps · 5 cápsulas blandas", font=font("medium", 30), fill=INK_MUTED)
    y += 60
    badge = "Muestra gratuita"
    bwid = d.textlength(badge, font=font("semibold", 26)) + 44
    d.rounded_rectangle((x0, y, x0 + bwid, y + 52), 26, fill=V_ROSE)
    d.text((x0 + 22, y + 11), badge, font=font("semibold", 26), fill=WHITE)

    qr = qrcode.QRCode(border=0, box_size=10, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(f"{SITE}/fichas/vit.pdf")  # abre la ficha del producto en PDF
    qr.make(fit=True)
    qimg = qr.make_image(fill_color=V_PLUM, back_color=WHITE).convert("RGB").resize((270, 270), Image.NEAREST)
    qx, qy = CW - 60 - 270, CH - 60 - 270
    im.paste(qimg, (qx, qy))
    ty = qy + 6
    d.text((x0, ty), "Ficha del producto", font=font("bold", 34), fill=V_PLUM)
    for line in ["1. Escanea el código: se", "    abre la ficha en PDF.", "2. Toca «Ver en AR» y", "    apunta a la foto de la caja."]:
        ty += 50
        d.text((x0, ty), line, font=font("medium", 28), fill=INK_MUTED)
    d.text((x0, CH - 44), "Producto real mostrado con permiso del laboratorio.", font=font("regular", 22), fill=INK_MUTED)
    d.rectangle((0, CH - 14, CW, CH), fill=V_ROSE)
    d.rectangle((CW * 0.7, CH - 14, CW, CH), fill=V_GOLD)
    d.rectangle((0, 0, CW - 1, CH - 1), outline="#DCE5E7", width=3)
    return im, panel


def sheet(cards, path, title="Multi LAB · Tarjetas de realidad aumentada (prototipo académico)"):
    # A4 a 300 ppp con tres tarjetas por hoja y líneas de corte
    W, H = 2480, 3508
    pages = []
    for i in range(0, len(cards), 3):
        page = Image.new("RGB", (W, H), WHITE)
        d = ImageDraw.Draw(page)
        d.text((150, 120), title, font=font("semibold", 36), fill=INK_MUTED)
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
    pages[0].save(path, save_all=True, append_images=pages[1:], resolution=DPI)


def main():
    os.makedirs(os.path.join(OUT, "tarjetas"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "objetivos"), exist_ok=True)
    cards = []
    # el orden es el de los objetivos de tarjetas.mind: CORAESSENS primero
    c, panel = card_coraessens()
    c.save(os.path.join(OUT, "tarjetas", "cor.png"), optimize=True)
    panel.save(os.path.join(OUT, "objetivos", "cor.png"), optimize=True)
    cards.append(c)
    # y la de PANCREOGEN después (objetivo siguiente)
    c, panel = card_pancreogen()
    c.save(os.path.join(OUT, "tarjetas", "pan.png"), optimize=True)
    panel.save(os.path.join(OUT, "objetivos", "pan.png"), optimize=True)
    cards.append(c)
    # y la de TEARSOFT al final (objetivo siguiente)
    c, panel = card_tearsoft()
    c.save(os.path.join(OUT, "tarjetas", "tea.png"), optimize=True)
    panel.save(os.path.join(OUT, "objetivos", "tea.png"), optimize=True)
    cards.append(c)
    # y la de DEFEROL al final (objetivo siguiente)
    c, panel = card_deferol()
    c.save(os.path.join(OUT, "tarjetas", "def.png"), optimize=True)
    panel.save(os.path.join(OUT, "objetivos", "def.png"), optimize=True)
    cards.append(c)
    # y la de VITYBELL al final (objetivo siguiente)
    c, panel = card_vitybell()
    c.save(os.path.join(OUT, "tarjetas", "vit.png"), optimize=True)
    panel.save(os.path.join(OUT, "objetivos", "vit.png"), optimize=True)
    cards.append(c)
    sheet(cards, os.path.join(OUT, "tarjetas-multilab.pdf"))
    # una hoja por producto: la app descarga solo la tarjeta del producto que se está viendo
    for p, c in zip([COR, PAN, TEA, DEF, VIT], cards):
        sheet([c], os.path.join(OUT, "tarjetas", f"{p['id']}.pdf"), f"Multi LAB · Tarjeta de realidad aumentada · {p['name']}")
    data = [COR, PAN, TEA, DEF, VIT]
    with open(os.path.join(OUT, "productos.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    shutil.copyfile(os.path.join(ROOT, "assets", "logo-full.png"), os.path.join(OUT, "logo-full.png"))
    print(f"{len(cards)} tarjetas en {OUT}")


if __name__ == "__main__":
    main()
