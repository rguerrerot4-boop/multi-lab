"""Genera los modelos 3D de AR (GLB para Android y USDZ para iPhone) de los productos ficticios.

Cada producto es una caja con textura (frente, reverso, laterales, tapa y base), con la misma
gráfica del visor 3D de la app. La base del modelo queda en y = 0 para apoyarse sobre superficies.

Uso:
  node --experimental-strip-types scripts/ar/export-products.mts
  pip install usd-core pillow
  python3 scripts/ar/build_models.py
"""

import json
import os
import struct
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "ar", "models")
FONTS = os.path.join(ROOT, "node_modules", "@expo-google-fonts", "montserrat")

TEAL, PETROLEO, TURQUESA = "#1E7F8C", "#20343A", "#63C9D6"
INK_MUTED = "#5B6E74"

# Tamaño de la caja en metros (ficticio, proporción del visor 3D: 1 × 1.5 × 0.46)
W, H, D = 0.07, 0.105, 0.032

ATLAS = 2048
PX = 640 / W  # píxeles por metro en la textura
FW, FH, FD = round(W * PX), round(H * PX), round(D * PX)  # 640, 960, 293
RECTS = {  # x, y, ancho, alto dentro del atlas
    "front": (0, 0, FW, FH),
    "back": (FW + 10, 0, FW, FH),
    "right": (2 * FW + 20, 0, FD, FH),
    "left": (2 * FW + FD + 30, 0, FD, FH),
    "top": (0, FH + 20, FW, FD),
    "bottom": (FW + 10, FH + 20, FW, FD),
}


def font(weight, size):
    name = {"bold": "700Bold", "semibold": "600SemiBold", "medium": "500Medium"}[weight]
    return ImageFont.truetype(os.path.join(FONTS, name, f"Montserrat_{name}.ttf"), size)


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def shade(h, amt):
    r, g, b = hex2rgb(h)
    f = (lambda c: c + (255 - c) * amt) if amt > 0 else (lambda c: c * (1 + amt))
    return tuple(max(0, min(255, round(f(c)))) for c in (r, g, b))


def fit(draw, text, weight, size, max_w):
    while size > 10:
        f = font(weight, size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    return font(weight, size)


def clip(t, n):
    return t if len(t) <= n else t[: n - 1] + "…"


def draw_faces(p):
    base = TEAL if p["hue"] == TURQUESA else p["hue"]
    faces = {}

    # Frente
    im = Image.new("RGB", (FW, FH), hex2rgb(base))
    d = ImageDraw.Draw(im)
    d.text((FW * 0.08, FH * 0.16), p["lab"], font=fit(d, p["lab"], "bold", 64, FW * 0.84), fill="white", anchor="lm")
    d.rectangle([FW * 0.08, FH * 0.3, FW * 0.92, FH * 0.66], fill="white")
    words = p["name"].split(" ")
    first, rest = words[0], " ".join(words[1:]) or p["category"]
    pad = FW * 0.08 + 28
    inner = FW * 0.84 - 56
    d.text((pad, FH * 0.38), first, font=fit(d, first, "bold", 78, inner), fill=PETROLEO, anchor="lm")
    d.text((pad, FH * 0.47), rest, font=fit(d, rest, "semibold", 54, inner), fill=TEAL, anchor="lm")
    detail = p["form"].split("·")[1].strip() if "·" in p["form"] else p["form"]
    d.text((pad, FH * 0.58), detail, font=fit(d, detail, "medium", 40, inner), fill=INK_MUTED, anchor="lm")
    d.text((FW * 0.08, FH * 0.79), "PRODUCTO FICTICIO", font=font("bold", 30), fill=(255, 255, 255), anchor="lm")
    d.rectangle([0, FH * 0.9, FW, FH], fill=TURQUESA)
    faces["front"] = im

    # Reverso
    im = Image.new("RGB", (FW, FH), shade(base, -0.08))
    d = ImageDraw.Draw(im)
    x, y = FW * 0.1, FH * 0.1
    d.text((x, y), "MODO DE USO", font=font("bold", 40), fill="white")
    y += 70
    for i, h in enumerate(p["howTo"][:3]):
        d.text((x, y), f"{i + 1}. {clip(h, 30)}", font=font("medium", 27), fill=(235, 245, 247))
        y += 48
    y += 50
    d.text((x, y), "PRECAUCIONES", font=font("bold", 40), fill="white")
    y += 70
    for h in p["precautions"][:3]:
        d.text((x, y), f"• {clip(h, 30)}", font=font("medium", 27), fill=(235, 245, 247))
        y += 48
    d.text((x, FH * 0.86), "Contenido de demostración · Prototipo académico", font=font("medium", 22), fill=(220, 236, 239))
    d.text((x, FH * 0.91), "No es un medicamento real", font=font("medium", 22), fill=(220, 236, 239))
    faces["back"] = im

    # Laterales
    for name, title, sub in (("right", "MULTI", p["category"]), ("left", "LAB", "demo")):
        im = Image.new("RGB", (FD, FH), shade(base, -0.15))
        d = ImageDraw.Draw(im)
        d.text((FD / 2, FH * 0.42), title, font=font("bold", 64), fill="white", anchor="mm")
        d.text((FD / 2, FH * 0.5), sub, font=fit(d, sub, "medium", 34, FD * 0.85), fill=(225, 240, 243), anchor="mm")
        faces[name] = im

    # Tapa y base
    im = Image.new("RGB", (FW, FD), shade(PETROLEO, 0.12))
    d = ImageDraw.Draw(im)
    d.text((FW / 2, FD / 2), p["name"], font=fit(d, p["name"], "semibold", 40, FW * 0.85), fill=(225, 240, 243), anchor="mm")
    faces["top"] = im
    im = Image.new("RGB", (FW, FD), PETROLEO)
    d = ImageDraw.Draw(im)
    d.text((FW / 2, FD * 0.4), "LOTE DEMO-0001", font=font("bold", 40), fill=(225, 240, 243), anchor="mm")
    d.text((FW / 2, FD * 0.68), "Prototipo académico", font=font("medium", 28), fill=(180, 205, 210), anchor="mm")
    faces["bottom"] = im
    return faces


def atlas_for(p):
    atlas = Image.new("RGB", (ATLAS, ATLAS), hex2rgb(PETROLEO))
    for name, im in draw_faces(p).items():
        x, y, w, h = RECTS[name]
        atlas.paste(im.resize((w, h), Image.LANCZOS), (x, y))
    return atlas


# Geometría: mismas caras que el visor 3D (u, v en 0..1; v hacia abajo)
def corner(face, u, v):
    x0, y0, z0 = -W / 2, 0.0, -D / 2
    return {
        "front": (x0 + u * W, H - v * H, D / 2),
        "right": (W / 2, H - v * H, D / 2 - u * D),
        "back": (W / 2 - u * W, H - v * H, -D / 2),
        "left": (-W / 2, H - v * H, -D / 2 + u * D),
        "top": (x0 + u * W, H, z0 + v * D),
        "bottom": (x0 + u * W, y0, D / 2 - v * D),
    }[face]


NORMALS = {"front": (0, 0, 1), "right": (1, 0, 0), "back": (0, 0, -1), "left": (-1, 0, 0), "top": (0, 1, 0), "bottom": (0, -1, 0)}


def mesh():
    pos, nor, uv, idx = [], [], [], []
    for face in ("front", "right", "back", "left", "top", "bottom"):
        x, y, w, h = RECTS[face]
        start = len(pos)
        for u, v in ((0, 0), (1, 0), (0, 1), (1, 1)):
            pos.append(corner(face, u, v))
            nor.append(NORMALS[face])
            # medio píxel hacia dentro para que no se cuele el borde del atlas
            uv.append(((x + 0.5 + u * (w - 1)) / ATLAS, (y + 0.5 + v * (h - 1)) / ATLAS))
        a, b, c, e = start, start + 1, start + 2, start + 3
        tri = [(a, c, e), (a, e, b)]
        # orientar los triángulos hacia fuera
        p0, p1, p2 = (pos[i] for i in tri[0])
        cross = (
            (p1[1] - p0[1]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[1] - p0[1]),
            (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]),
            (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]),
        )
        if sum(cross[i] * NORMALS[face][i] for i in range(3)) < 0:
            tri = [(t[0], t[2], t[1]) for t in tri]
        for t in tri:
            idx.extend(t)
    return pos, nor, uv, idx


def write_glb(path, p, jpg_bytes):
    pos, nor, uv, idx = mesh()
    b_pos = b"".join(struct.pack("<3f", *v) for v in pos)
    b_nor = b"".join(struct.pack("<3f", *v) for v in nor)
    b_uv = b"".join(struct.pack("<2f", *v) for v in uv)
    b_idx = b"".join(struct.pack("<H", i) for i in idx)
    b_idx += b"\0" * ((4 - len(b_idx) % 4) % 4)
    img = jpg_bytes + b"\0" * ((4 - len(jpg_bytes) % 4) % 4)
    chunks = [b_pos, b_nor, b_uv, b_idx, img]
    offsets, o = [], 0
    for c in chunks:
        offsets.append(o)
        o += len(c)
    binary = b"".join(chunks)
    gltf = {
        "asset": {"version": "2.0", "generator": "Multi LAB (prototipo académico)"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": p["name"]}],
        "meshes": [{"name": p["name"], "primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2}, "indices": 3, "material": 0}]}],
        "materials": [{"name": "Caja", "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 0.55}}],
        "textures": [{"source": 0, "sampler": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": 4, "mimeType": "image/jpeg"}],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": offsets[0], "byteLength": len(b_pos), "target": 34962},
            {"buffer": 0, "byteOffset": offsets[1], "byteLength": len(b_nor), "target": 34962},
            {"buffer": 0, "byteOffset": offsets[2], "byteLength": len(b_uv), "target": 34962},
            {"buffer": 0, "byteOffset": offsets[3], "byteLength": len(idx) * 2, "target": 34963},
            {"buffer": 0, "byteOffset": offsets[4], "byteLength": len(jpg_bytes)},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(pos), "type": "VEC3",
             "min": [min(v[i] for v in pos) for i in range(3)], "max": [max(v[i] for v in pos) for i in range(3)]},
            {"bufferView": 1, "componentType": 5126, "count": len(nor), "type": "VEC3"},
            {"bufferView": 2, "componentType": 5126, "count": len(uv), "type": "VEC2"},
            {"bufferView": 3, "componentType": 5123, "count": len(idx), "type": "SCALAR"},
        ],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(binary), 0x004E4942) + binary)


def write_usdz(path, p, jpg_path):
    from pxr import Gf, Sdf, Usd, UsdGeom, UsdShade, UsdUtils, Vt

    pos, nor, uv, idx = mesh()
    with tempfile.TemporaryDirectory() as tmp:
        usda = os.path.join(tmp, "modelo.usdc")
        tex = os.path.join(tmp, "textura.jpg")
        with open(jpg_path, "rb") as a, open(tex, "wb") as b:
            b.write(a.read())
        stage = Usd.Stage.CreateNew(usda)
        UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
        UsdGeom.SetStageMetersPerUnit(stage, 1.0)
        root = UsdGeom.Xform.Define(stage, "/Producto")
        stage.SetDefaultPrim(root.GetPrim())
        m = UsdGeom.Mesh.Define(stage, "/Producto/Caja")
        m.CreatePointsAttr(Vt.Vec3fArray([Gf.Vec3f(*v) for v in pos]))
        m.CreateFaceVertexCountsAttr(Vt.IntArray([3] * (len(idx) // 3)))
        m.CreateFaceVertexIndicesAttr(Vt.IntArray(idx))
        m.CreateSubdivisionSchemeAttr("none")
        m.CreateExtentAttr([Gf.Vec3f(-W / 2, 0, -D / 2), Gf.Vec3f(W / 2, H, D / 2)])
        api = UsdGeom.PrimvarsAPI(m)
        n = api.CreatePrimvar("normals", Sdf.ValueTypeNames.Normal3fArray, UsdGeom.Tokens.vertex)
        n.Set(Vt.Vec3fArray([Gf.Vec3f(*v) for v in nor]))
        st = api.CreatePrimvar("st", Sdf.ValueTypeNames.TexCoord2fArray, UsdGeom.Tokens.vertex)
        st.Set(Vt.Vec2fArray([Gf.Vec2f(u, 1 - v) for u, v in uv]))  # USD: origen abajo

        mat = UsdShade.Material.Define(stage, "/Producto/Material")
        sh = UsdShade.Shader.Define(stage, "/Producto/Material/Superficie")
        sh.CreateIdAttr("UsdPreviewSurface")
        sh.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(0.55)
        sh.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(0.0)
        reader = UsdShade.Shader.Define(stage, "/Producto/Material/LectorST")
        reader.CreateIdAttr("UsdPrimvarReader_float2")
        reader.CreateInput("varname", Sdf.ValueTypeNames.Token).Set("st")
        texs = UsdShade.Shader.Define(stage, "/Producto/Material/Textura")
        texs.CreateIdAttr("UsdUVTexture")
        texs.CreateInput("file", Sdf.ValueTypeNames.Asset).Set("textura.jpg")
        texs.CreateInput("st", Sdf.ValueTypeNames.Float2).ConnectToSource(reader.ConnectableAPI(), "result")
        texs.CreateInput("wrapS", Sdf.ValueTypeNames.Token).Set("clamp")
        texs.CreateInput("wrapT", Sdf.ValueTypeNames.Token).Set("clamp")
        texs.CreateOutput("rgb", Sdf.ValueTypeNames.Float3)
        sh.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).ConnectToSource(texs.ConnectableAPI(), "rgb")
        mat.CreateSurfaceOutput().ConnectToSource(sh.ConnectableAPI(), "surface")
        UsdShade.MaterialBindingAPI.Apply(m.GetPrim()).Bind(mat)
        stage.GetRootLayer().Save()
        if not UsdUtils.CreateNewARKitUsdzPackage(Sdf.AssetPath(usda), path):
            sys.exit(f"No se pudo crear {path}")


def main():
    products = json.load(open(os.path.join(os.path.dirname(__file__), "products.json"), encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    for p in products:
        jpg = os.path.join(OUT, f"{p['id']}.jpg")
        atlas_for(p).save(jpg, "JPEG", quality=86, optimize=True)
        with open(jpg, "rb") as f:
            data = f.read()
        write_glb(os.path.join(OUT, f"{p['id']}.glb"), p, data)
        write_usdz(os.path.join(OUT, f"{p['id']}.usdz"), p, jpg)
        print(p["id"], p["name"], "listo")


if __name__ == "__main__":
    main()
