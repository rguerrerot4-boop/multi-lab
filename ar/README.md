# Modelos de realidad aumentada

Modelos 3D de los productos **ficticios** de Multi LAB para la función “Ver en AR”.

- `*.glb`: Android (Scene Viewer de Google, requiere ARCore).
- `*.usdz`: iPhone y iPad (AR Quick Look, iOS 12 o superior).
- `*.jpg`: textura de cada caja.

Se generan con `scripts/ar/build_models.py` a partir de los datos de `src/data/mock.ts`.
La app los descarga desde jsDelivr (CDN gratuito que sirve archivos de repositorios públicos de GitHub).
Si se reemplazan por modelos reales (por ejemplo exportados de Vectary en GLB y USDZ), basta con
conservar los nombres `p1.glb`, `p1.usdz`, etc., y actualizar `AR_COMMIT` en `src/lib/ar.ts`.
