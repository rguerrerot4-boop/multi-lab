"""Fichas de producto en PDF (una por producto): se abren al escanear el código QR de su tarjeta impresa.

Diseño en la línea de la ficha de la app: portada oscura con el nombre gigante detrás de la caja 3D,
borde de papel rasgado, cifras grandes en recuadro, modo de uso con números grandes, avisos y, en la
segunda página, las tablas del empaque (CORAESSENS) y un botón para abrir la realidad aumentada con
la tarjeta de ese producto.

Colores: los del empaque para CORAESSENS (producto real, con permiso de Nutrabiotics) y los de
Multi LAB para los productos ficticios.

Uso:
  node --experimental-strip-types scripts/ar/export-products.mts
  python3 scripts/fichas/build_fichas.py
Salida: public/fichas/<id>.pdf
"""

import io
import json
import math
import os
import random
import sys

import numpy as np
import qrcode
from PIL import Image, ImageDraw, ImageFilter
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts", "ar"))
import build_models as bm  # noqa: E402  (caras dibujadas de los productos ficticios)

OUT = os.path.join(ROOT, "public", "fichas")
FONTS = os.path.join(ROOT, "node_modules", "@expo-google-fonts", "montserrat")
SITE = "https://rguerrerot4-boop.github.io/multi-lab"
PW, PH = 595.28, 841.89  # A4 en puntos
M = 40  # margen

for name, folder in (("R", "400Regular"), ("M", "500Medium"), ("S", "600SemiBold"), ("B", "700Bold"), ("X", "800ExtraBold"), ("I", "600SemiBold_Italic")):
    pdfmetrics.registerFont(TTFont(f"Mont-{name}", os.path.join(FONTS, folder, f"Montserrat_{folder}.ttf")))


def palette(p):
    if p["id"] == "cor":
        return dict(main="#C9262F", mainDeep="#99161F", bg="#5C2C78", bgDeep="#341447", paper="#FBEDEE", line="#E9C9CD", ink="#2B1236", giant="#C9262F", muted="#6E5A72")
    main = "#1E7F8C" if p["hue"] == "#63C9D6" else p["hue"]
    return dict(main=main, mainDeep="#176874", bg="#20343A", bgDeep="#14242A", paper="#F4F7F8", line="#DCE5E7", ink="#20343A", giant="#1E7F8C", muted="#5B6E74")


# ---------- caja 3D renderizada a partir de sus caras ----------
def rot(ax, ang):
    c, s = math.cos(ang), math.sin(ang)
    if ax == "x":
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def render_box(faces, w, h, d, size=900, yaw=-0.62, tilt=0.36):
    """Proyección ortográfica de la caja (frente, derecha y tapa visibles) con sombreado suave."""
    R = rot("x", tilt) @ rot("y", yaw)

    def corner(face, u, v):
        x0, yT = -w / 2, h / 2
        return {
            "front": (x0 + u * w, yT - v * h, d / 2),
            "right": (w / 2, yT - v * h, d / 2 - u * d),
            "top": (x0 + u * w, yT, -d / 2 + v * d),
        }[face]

    normals = {"front": (0, 0, 1), "right": (1, 0, 0), "top": (0, 1, 0)}
    light = np.array([-0.45, 0.7, 0.55])
    light /= np.linalg.norm(light)
    pts_all = []
    quads = {}
    for f in ("front", "right", "top"):
        q = []
        for u, v in ((0, 0), (1, 0), (1, 1), (0, 1)):
            p = R @ np.array(corner(f, u, v))
            q.append((p[0], -p[1]))
            pts_all.append((p[0], -p[1]))
        quads[f] = q
    xs = [p[0] for p in pts_all]
    ys = [p[1] for p in pts_all]
    span = max(max(xs) - min(xs), max(ys) - min(ys))
    k = size * 0.86 / span
    ox = size / 2 - (min(xs) + max(xs)) / 2 * k
    oy = size / 2 - (min(ys) + max(ys)) / 2 * k
    canvas_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for f in ("top", "right", "front"):
        n = R @ np.array(normals[f])
        if n[2] <= 0.01:
            continue
        src = faces[f].convert("RGB")
        sw, sh = src.size
        dst = [(x * k + ox, y * k + oy) for x, y in quads[f]]
        # coeficientes de PERSPECTIVE: salida (dst) → entrada (src)
        A, B = [], []
        for (x, y), (uu, vv) in zip(dst, [(0, 0), (sw, 0), (sw, sh), (0, sh)]):
            A += [[x, y, 1, 0, 0, 0, -uu * x, -uu * y], [0, 0, 0, x, y, 1, -vv * x, -vv * y]]
            B += [uu, vv]
        coef = np.linalg.solve(np.array(A, float), np.array(B, float))
        warped = src.transform((size, size), Image.PERSPECTIVE, coef.tolist(), Image.BICUBIC)
        lam = float(n @ light)
        dark = max(0.0, 0.82 - lam) * 0.5
        if dark > 0.01:
            warped = Image.blend(warped, Image.new("RGB", warped.size, (20, 30, 35)), dark)
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).polygon(dst, fill=255)
        canvas_img.paste(warped, (0, 0), mask)
        ImageDraw.Draw(canvas_img).line(dst + [dst[0]], fill=(255, 255, 255, 70), width=2)
    # sombra en el piso
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bottom = max(ys) * k + oy
    ImageDraw.Draw(shadow).ellipse((size * 0.24, bottom + size * 0.01, size * 0.76, bottom + size * 0.07), fill=(10, 10, 20, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.025))
    out = Image.alpha_composite(shadow, canvas_img)
    return out


def faces_for(p):
    if p["id"] == "cor":
        tex = os.path.join(ROOT, "assets", "coraessens")
        return {f: Image.open(os.path.join(tex, f"{f}.jpg")) for f in ("front", "right", "top")}, (1, 1.444, 1)
    fs = bm.draw_faces(p)
    return {"front": fs["front"], "right": fs["right"], "top": fs["top"]}, (bm.W, bm.H, bm.D)


def png(img):
    b = io.BytesIO()
    img.save(b, "PNG")
    b.seek(0)
    return ImageReader(b)


def qr_img(url, color):
    q = qrcode.QRCode(border=1, box_size=10, error_correction=qrcode.constants.ERROR_CORRECT_M)
    q.add_data(url)
    q.make(fit=True)
    return q.make_image(fill_color=color, back_color="white").convert("RGB")


# ---------- ayudas de dibujo ----------
def wrap(c, text, font, size, width):
    lines, line = [], ""
    for word in text.split():
        t = f"{line} {word}".strip()
        if c.stringWidth(t, font, size) <= width:
            line = t
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def para(c, x, y, text, font, size, width, color, leading=None):
    leading = leading or size * 1.4
    c.setFillColor(HexColor(color))
    c.setFont(font, size)
    for ln in wrap(c, text, font, size, width):
        c.drawString(x, y, ln)
        y -= leading
    return y


def torn(c, y, color, seed, up=True):
    """borde de papel rasgado: rellena desde y hacia abajo con el color de la siguiente sección"""
    r = random.Random(seed)
    p = c.beginPath()
    p.moveTo(0, y - 30)
    p.lineTo(0, y)
    x = 0
    while x < PW + 12:
        p.lineTo(x, y + r.uniform(-6, 7))
        x += r.uniform(8, 18)
    p.lineTo(PW, y - 30)
    p.close()
    c.setFillColor(HexColor(color))
    c.drawPath(p, fill=1, stroke=0)


def pill(c, x, y, text, bg, fg, size=8.5, font="Mont-S", pad=7, h=17):
    w = c.stringWidth(text, font, size) + pad * 2
    c.setFillColor(HexColor(bg) if isinstance(bg, str) else bg)
    c.roundRect(x, y, w, h, h / 2, fill=1, stroke=0)
    c.setFillColor(HexColor(fg))
    c.setFont(font, size)
    c.drawString(x + pad, y + (h - size) / 2 + 1.5, text)
    return w


def specs_of(p):
    if p.get("specs"):
        return p["specs"]
    import re

    qty = re.search(r"(\d+(?:[.,]\d+)?)\s?(ml|g|mg|cápsulas)", p["form"], re.I)
    return [
        {"value": f"{qty.group(1)} {qty.group(2)}" if qty else p["form"].split("·")[0].strip(), "label": "Presentación", "note": p["form"]},
        {"value": p["component"].split(" ")[0], "label": "Componente principal", "note": p["component"]},
        {"value": "—" if p["concentration"] == "No aplica" else p["concentration"], "label": "Concentración", "note": "No aplica a este producto" if p["concentration"] == "No aplica" else "Por unidad"},
    ]


def footer(c, p, pal, page):
    c.setFont("Mont-M", 7)
    c.setFillColor(HexColor(pal["muted"]))
    note = p["real"]["note"] if p.get("real") else "Producto, laboratorio y datos ficticios para el prototipo académico Multi LAB. Textos de ejemplo: no son indicaciones aprobadas."
    y = 22
    for ln in wrap(c, note + " La app no vende ni entrega medicamentos.", "Mont-M", 7, PW - 2 * M - 60):
        c.drawString(M, y + 9, ln)
        y -= 9
    c.drawRightString(PW - M, 31, f"Multi LAB · {page}/2")


# ---------- páginas ----------
def page_cover(c, p, pal):
    info = p.get("info") or {}
    real = p["id"] == "cor"
    name = info.get("name", p["name"])
    hero_h = 470
    top = PH - hero_h
    # fondo oscuro con degradado
    c.linearGradient(0, PH, PW, top, (HexColor(pal["bg"]), HexColor(pal["bgDeep"])), extend=True)
    c.saveState()
    p_ = c.beginPath()
    p_.rect(0, top - 40, PW, hero_h + 40)
    c.clipPath(p_, stroke=0)
    c.linearGradient(0, PH, PW * 0.6, top - 40, (HexColor(pal["bg"]), HexColor(pal["bgDeep"])), extend=False)
    # nombre gigante detrás de la caja (dos filas, la segunda más tenue)
    big = name.upper()
    size = min(170, (PW + 120) / max(1, len(big) * 0.62))
    c.setFont("Mont-X", size)
    c.setFillColor(HexColor(pal["giant"]))
    c.drawString(-24, PH - 235, big)
    c.setFillColor(HexColor(pal["giant"]), alpha=0.35)
    c.drawString(-24 - size * 1.2, PH - 235 - size * 0.86, big + "  " + big)
    # trazos blancos
    r = random.Random(p["id"])
    c.setStrokeColor(white, alpha=0.55)
    c.setLineWidth(3)
    c.setLineCap(1)
    for _ in range(14):
        x, y, l = r.uniform(0, PW), r.uniform(PH - 330, PH - 70), r.uniform(8, 20)
        c.line(x, y, x + l * 0.78, y + l * 0.62)
    c.restoreState()
    # caja 3D
    faces, (w, h, d) = faces_for(p)
    box = render_box(faces, w, h, d)
    bs = 300
    c.drawImage(png(box), PW / 2 - bs / 2 + 80, PH - 52 - bs, bs, bs, mask="auto")
    # logotipo (sin alterar) sobre una pastilla blanca
    logo = os.path.join(ROOT, "assets", "logo-full.png")
    lw, lh = Image.open(logo).size
    c.setFillColor(white)
    c.roundRect(M - 6, PH - 58, 112, 32, 16, fill=1, stroke=0)
    c.drawImage(logo, M + 4, PH - 53, 92, 92 * lh / lw, mask="auto")
    chip = "Producto real · con permiso del laboratorio" if real else "Producto ficticio · prototipo académico"
    cw = c.stringWidth(chip, "Mont-S", 8.5) + 14
    pill(c, PW - M - cw, PH - 50, chip, "#FFFFFF", pal["main"])
    # texto de la portada
    y = top + 140
    c.setFillColor(white)
    c.setFont("Mont-B", 8.5)
    lab_line = info.get("labLine") or f"{p['lab']} · laboratorio ficticio"
    c.drawString(M, y, lab_line.upper())
    y -= 34
    c.setFont("Mont-B", 30)
    c.drawString(M, y, info.get("mark", p["name"]))
    y -= 22
    y = para(c, M, y, (info.get("formula") or p["tagline"]) + ".", "Mont-M", 10.5, PW * 0.62, "#FFFFFF", 15)
    y -= 6
    x = M
    badges = info.get("badges") or [p["category"]] + [s.strip() for s in p["form"].split("·")][:2]
    for b in badges[:3]:
        x += pill(c, x, y - 4, b, Color(1, 1, 1, alpha=0.18), "#FFFFFF") + 6
    stamp = info.get("sample") or "Producto ficticio"
    pill(c, x, y - 4, stamp, "#FFFFFF", pal["main"])
    torn(c, top - 10, pal["paper"], seed=len(p["id"]) * 7)
    c.setFillColor(HexColor(pal["paper"]))
    c.rect(0, 0, PW, top - 30, fill=1, stroke=0)

    # ficha técnica: cifras grandes en recuadro doble
    y = top - 62
    c.setFont("Mont-I", 11)
    c.setFillColor(HexColor(pal["main"]))
    c.drawString(M, y, "Ficha técnica")
    c.setFont("Mont-B", 22)
    c.setFillColor(HexColor(pal["ink"]))
    c.drawString(M, y - 25, p["form"].split("·")[0].strip().upper())
    box_y, box_h = y - 150, 108
    c.setStrokeColor(HexColor(pal["ink"]))
    c.setLineWidth(1.6)
    c.rect(M, box_y, PW - 2 * M, box_h, fill=0, stroke=1)
    c.setLineWidth(0.6)
    c.rect(M + 4, box_y + 4, PW - 2 * M - 8, box_h - 8, fill=0, stroke=1)
    specs = specs_of(p)[:3]
    cw = (PW - 2 * M - 8) / len(specs)
    for i, s in enumerate(specs):
        x = M + 4 + i * cw + 14
        if i:
            c.line(M + 4 + i * cw, box_y + 16, M + 4 + i * cw, box_y + box_h - 16)
        c.setFillColor(HexColor(pal["ink"]))
        c.setFont("Mont-B", 7.5)
        c.drawString(x, box_y + box_h - 24, s["label"].upper()[:34])
        c.setFillColor(HexColor(pal["main"]))
        vs = 30 if len(s["value"]) <= 6 else 22
        c.setFont("Mont-X", vs)
        c.drawString(x, box_y + box_h - 24 - vs - 4, s["value"])
        para(c, x, box_y + 26, s["note"], "Mont-R", 7.5, cw - 24, pal["muted"], 10)
    # descripción
    y = box_y - 30
    c.setFont("Mont-B", 13)
    c.setFillColor(HexColor(pal["ink"]))
    c.drawString(M, y, "Fórmula" if real else "Descripción")
    y = para(c, M, y - 18, p["description"], "Mont-R", 9.5, PW - 2 * M, pal["ink"], 14)
    footer(c, p, pal, 1)


def page_detail(c, p, pal):
    info = p.get("info") or {}
    real = p["id"] == "cor"
    c.setFillColor(white)
    c.rect(0, 0, PW, PH, fill=1, stroke=0)
    # cabecera
    c.setFillColor(HexColor(pal["bgDeep"]))
    c.rect(0, PH - 54, PW, 54, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Mont-B", 13)
    c.drawString(M, PH - 33, info.get("mark", p["name"]))
    c.setFont("Mont-M", 8.5)
    c.drawRightString(PW - M, PH - 33, (info.get("labLine") or f"{p['lab']} · laboratorio ficticio"))
    torn(c, PH - 54, "#FFFFFF", seed=99)
    c.setFillColor(white)
    c.rect(0, 0, PW, PH - 70, fill=1, stroke=0)

    col_w = (PW - 2 * M - 24) / 2
    y0 = PH - 104
    # modo de uso
    c.setFont("Mont-X", 22)
    c.setFillColor(HexColor(pal["main"]))
    c.drawString(M, y0, "MODO DE USO")
    y = y0 - 34
    for i, step in enumerate(p["howTo"]):
        c.setFont("Mont-X", 26)
        c.setFillColor(HexColor(pal["main"]))
        c.drawString(M, y - 6, str(i + 1))
        yy = para(c, M + 30, y + 4, step, "Mont-M", 9.5, col_w - 32, pal["ink"], 13)
        y = min(y - 34, yy - 12)
    # avisos
    x2 = M + col_w + 24
    c.setFillColor(HexColor(pal["paper"]))
    av_h = 34 + sum(14 * len(wrap(c, t, "Mont-R", 9, col_w - 40)) + 6 for t in p["precautions"]) + 28
    c.roundRect(x2, y0 - av_h + 18, col_w, av_h, 14, fill=1, stroke=0)
    c.setFont("Mont-X", 18)
    c.setFillColor(HexColor(pal["ink"]))
    c.drawString(x2 + 16, y0 - 6, "AVISOS")
    yy = y0 - 30
    for t in p["precautions"]:
        c.setFillColor(HexColor(pal["main"]))
        c.circle(x2 + 21, yy + 3, 4, fill=1, stroke=0)
        yy = para(c, x2 + 32, yy, t, "Mont-R", 9, col_w - 44, pal["ink"], 12.5) - 6
    para(c, x2 + 16, yy - 2, ("Texto impreso en el empaque." if real else "Información general de ejemplo.") + " Consulte siempre la documentación oficial del producto.", "Mont-M", 7, col_w - 30, pal["muted"], 9)
    y = min(y, y0 - av_h + 18) - 34

    # tablas del empaque (CORAESSENS) o datos y usos (ficticios)
    if real:
        cards = {cd["id"]: cd for cd in info["cards"]}
        tables = [cards["composicion"], cards["nutricional"]]
    else:
        tables = [
            {"title": "Datos del producto", "rows": [
                {"label": "Laboratorio", "value": f"{p['labFull']} (ficticio)"},
                {"label": "Presentación", "value": p["form"]},
                {"label": "Componente", "value": p["component"]},
                {"label": "Concentración", "value": p["concentration"]},
            ], "wide": True},
            {"title": "Usos descritos", "rows": [{"label": u, "value": ""} for u in p["uses"]], "foot": "Texto de ejemplo: no corresponde a indicaciones aprobadas."},
        ]
    for i, tb in enumerate(tables):
        x = M + i * (col_w + 24)
        c.setFont("Mont-B", 12)
        c.setFillColor(HexColor(pal["ink"]))
        c.drawString(x, y, tb["title"])
        ty = y - 10
        c.setStrokeColor(HexColor(pal["main"]))
        c.setLineWidth(1.4)
        c.line(x, ty, x + col_w, ty)
        ty -= 15
        head = tb.get("rowsHead")
        if head:
            c.setFont("Mont-B", 7.5)
            c.setFillColor(HexColor(pal["muted"]))
            c.drawString(x, ty, head[0])
            c.drawRightString(x + col_w - 46, ty, head[1])
            if len(head) > 2 and head[2]:
                c.drawRightString(x + col_w, ty, head[2])
            ty -= 14
        for row in tb["rows"]:
            val = row.get("value", "")
            extra = row.get("extra")
            label_w = col_w - (100 if tb.get("wide") else (96 if extra is not None else 64)) if val else col_w - 12
            lines = wrap(c, row["label"], "Mont-R", 8.8, label_w)
            if not val:
                c.setFillColor(HexColor(pal["main"]))
                c.circle(x + 3, ty + 3, 2.4, fill=1, stroke=0)
            c.setFillColor(HexColor(pal["ink"]))
            c.setFont("Mont-R", 8.8)
            for k, ln in enumerate(lines):
                c.drawString(x + (10 if not val else 0), ty - k * 11.5, ln)
            if val:
                c.setFont("Mont-S", 8.8)
                if tb.get("wide"):
                    vl = wrap(c, val, "Mont-S", 8.8, 100)
                    for k, ln in enumerate(vl):
                        c.drawRightString(x + col_w, ty - k * 11.5, ln)
                    lines = lines if len(lines) >= len(vl) else vl
                else:
                    c.drawRightString(x + col_w - (46 if extra is not None else 0), ty, val)
                    if extra is not None:
                        c.setFont("Mont-R", 8.8)
                        c.drawRightString(x + col_w, ty, extra)
            ty -= 11.5 * len(lines) + 5
            c.setStrokeColor(HexColor(pal["line"]))
            c.setLineWidth(0.5)
            c.line(x, ty + 9, x + col_w, ty + 9)
        if tb.get("foot"):
            para(c, x, ty - 2, tb["foot"], "Mont-M", 7.5, col_w, pal["muted"], 10)
        tb["_end"] = ty
    y = min(tb["_end"] for tb in tables) - 26

    if real:
        fab = {cd["id"]: cd for cd in info["cards"]}["fabricante"]
        c.setFont("Mont-B", 12)
        c.setFillColor(HexColor(pal["ink"]))
        c.drawString(M, y, "Fabricante")
        y = para(c, M, y - 16, fab["body"], "Mont-R", 8.5, PW - 2 * M, pal["ink"], 12)
        y = para(c, M, y - 2, fab.get("foot", ""), "Mont-M", 8, PW - 2 * M, pal["muted"], 11) - 10

    # realidad aumentada con la tarjeta de este producto
    ar_url = f"{SITE}/ar-tarjeta/?p={p['id']}"
    app_url = f"{SITE}/producto/{p['id']}"
    bh = 150
    by = max(70, y - bh)
    c.setFillColor(HexColor(pal["bgDeep"]))
    c.roundRect(M, by, PW - 2 * M, bh, 18, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Mont-B", 8)
    c.drawString(M + 22, by + bh - 28, "REALIDAD AUMENTADA")
    c.setFont("Mont-X", 20)
    c.drawString(M + 22, by + bh - 54, "Míralo sobre tu tarjeta")
    para(c, M + 22, by + bh - 74, "Toca el botón, permite la cámara y apunta al panel de color de la tarjeta impresa de este producto: solo responde a su propia tarjeta.", "Mont-M", 8.5, PW - 2 * M - 190, "#FFFFFF", 12)
    # botón con enlace
    btn = "Ver en AR · realidad aumentada"
    bw = c.stringWidth(btn, "Mont-B", 10) + 36
    bx, byy = M + 22, by + 20
    c.setFillColor(white)
    c.roundRect(bx, byy, bw, 30, 15, fill=1, stroke=0)
    c.setFillColor(HexColor(pal["main"]))
    c.setFont("Mont-B", 10)
    c.drawString(bx + 18, byy + 11, btn)
    c.linkURL(ar_url, (bx, byy, bx + bw, byy + 30), relative=0, thickness=0)
    # enlace a la app
    link = "Abrir en la app Multi LAB"
    lx = bx + bw + 14
    c.setFillColor(white)
    c.setFont("Mont-S", 9)
    c.drawString(lx, byy + 11, link)
    c.setStrokeColor(white)
    c.setLineWidth(0.6)
    c.line(lx, byy + 9, lx + c.stringWidth(link, "Mont-S", 9), byy + 9)
    c.linkURL(app_url, (lx, byy, lx + c.stringWidth(link, "Mont-S", 9), byy + 30), relative=0, thickness=0)
    # QR a la realidad aumentada (para abrirla desde otro teléfono)
    qs = 112
    c.drawImage(png(qr_img(ar_url, pal["bgDeep"])), PW - M - qs - 20, by + (bh - qs) / 2, qs, qs)
    c.linkURL(ar_url, (PW - M - qs - 20, by + (bh - qs) / 2, PW - M - 20, by + (bh + qs) / 2), relative=0, thickness=0)
    footer(c, p, pal, 2)


def build(p):
    pal = palette(p)
    path = os.path.join(OUT, f"{p['id']}.pdf")
    c = canvas.Canvas(path, pagesize=(PW, PH))
    name = (p.get("info") or {}).get("mark", p["name"])
    c.setTitle(f"{name} · Ficha del producto · Multi LAB")
    c.setAuthor("Multi LAB (prototipo académico)")
    c.setSubject("Ficha del producto con enlace a la realidad aumentada")
    page_cover(c, p, pal)
    c.showPage()
    page_detail(c, p, pal)
    c.showPage()
    c.save()
    return path


def main():
    products = json.load(open(os.path.join(os.path.dirname(__file__), "products.json"), encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    for p in products:
        print(build(p))


if __name__ == "__main__":
    main()
