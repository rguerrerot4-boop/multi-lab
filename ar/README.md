# Modelos de realidad aumentada

Modelos 3D de los 5 productos reales de Multi LAB (con permiso del laboratorio) para la función “Ver en AR”:
CORAESSENS y PANCREOGEN (Nutrabiotics) y TEARSOFT, DEFEROL y VITYBELL (Procaps). Cada uno tiene su versión
con nombre ficticio (`<id>-f`).

- `*.glb`: Android (Scene Viewer de Google, requiere ARCore).
- `*.usdz`: iPhone y iPad (AR Quick Look, iOS 12 o superior).

Cada producto genera los suyos con su script (`scripts/coraessens/modelo.py`, `scripts/pancreogen/modelo.py`,
`scripts/tearsoft/modelo.py`, `scripts/deferol/modelo.py`, `scripts/vitybell/modelo.py`), con la geometría de
`scripts/ar/build_models.py`. La app los descarga desde jsDelivr (CDN gratuito que sirve archivos de repositorios
públicos de GitHub); si cambian, actualiza `AR_COMMIT` en `src/lib/ar.ts`.
