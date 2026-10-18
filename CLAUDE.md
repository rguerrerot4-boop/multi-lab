# Multi LAB — contexto para Claude Code

Lee también `AGENTS.md` (reglas de Expo), `README.md` (estructura y alcance) y `docs/ESTADO.md` (estado actual, animaciones y pendientes).

## Proyecto
- App móvil de titulación (Multimedia y Producción Audiovisual) para la visita médica. Es una app integral, no solo un catálogo: el catálogo multimedia interactivo es su módulo diferenciador.
- Roles: `medico` (profesional de salud) y `visitador` (visitador médico). Cada rol tiene su dashboard y sus pestañas (`src/app/medico`, `src/app/visitador`).
- Expo SDK 57 + Expo Router + TypeScript. Sin backend: datos en `src/data/mock.ts`, estado en `src/store/AppStore.tsx`.

## Reglas
- Todo el texto de la interfaz va en español.
- Usa los tokens de `src/theme.ts` y los componentes de `src/components/ui.tsx`. No uses colores sueltos.
- Colores de marca: `#1E7F8C`, `#20343A` y `#63C9D6`. El turquesa claro nunca se usa como color de texto.
- El logotipo (`assets/logo-full.png`, `assets/logo-mark.png`) no se redibuja, rota, deforma ni recolorea.
- Los productos, personas y lugares son ficticios y deben seguir marcados así. No inventes indicaciones médicas, estudios clínicos ni certificaciones (HIPAA, GxP, ARCSA…) como si fueran reales.
- La app no simula venta ni dispensación de medicamentos.
- Realidad aumentada: con el visor AR del sistema (Scene Viewer en Android, AR Quick Look en iPhone) y los modelos de `ar/models` (generados con `scripts/ar/build_models.py`, servidos por jsDelivr; si cambian, actualiza `AR_COMMIT` en `src/lib/ar.ts`). Además, AR sobre tarjetas impresas con MindAR en el navegador (`public/ar-tarjeta`, mismos modelos; tarjetas con `scripts/ar/build_cards.py` y objetivos con `scripts/ar/compile_cards.cjs`). No uses Unity. La vista 3D con Vectary está pendiente de integración.
- Permite el desplazamiento vertical; no comprimas el contenido para que quepa en una sola pantalla.
- Antes de terminar un cambio, ejecuta `npx tsc --noEmit`.
- Publicación: los cambios se suben directo a `main` (autorizado por la persona dueña del proyecto), sin pull request. Cada push a `main` publica la versión web en GitHub Pages (`.github/workflows/web.yml`). Antes de subir, ejecuta `npx tsc --noEmit` y, si el cambio afecta a la web, compílala (`npx expo export --platform web --output-dir dist-web`) y pruébala.
