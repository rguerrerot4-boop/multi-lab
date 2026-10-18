# Estado del proyecto y pendientes

Guía de traspaso para continuar el trabajo (en Claude Code o con otra persona). Complementa `README.md` (qué incluye la app) y `CLAUDE.md` (reglas).

## Cómo verificar un cambio

```bash
npm install
npx tsc --noEmit            # obligatorio antes de terminar un cambio
npx expo start              # celular con Expo Go, o "w" para el navegador
npx expo export --platform web --output-dir dist-web   # build web de prueba
node scripts/web/pwa.mjs dist-web                      # ícono y manifiesto para la pantalla de inicio
```

Revisa las animaciones en el navegador y en el celular: lo que se ve fluido en la computadora puede cambiar en el teléfono.

## Animaciones (dónde está cada una)

| Animación | Archivo | Notas |
|---|---|---|
| Splash: burbuja de vidrio para deslizar → se contrae en el play → el logo brota (cápsulas con rebote) → MULTI LAB → expansión al inicio de sesión | `src/app/index.tsx` (`IntroBubble`, `launch`, `arrive`, `runLogo`) | La velocidad del dedo se mide con muestras propias (`fingerVy`), no con la de PanResponder. Si nadie desliza, sube sola a los 6 s. Tocar la burbuja también la lanza |
| Piezas vectoriales del logo | `src/components/AnimatedLogo.tsx`, `logoPaths.ts` | Trazos originales del Manual de Marca. Solo se mueven, aparecen y escalan parejo: nunca rotar, deformar ni recolorear |
| Bienvenida al iniciar sesión: play que cubre la pantalla → se abre en tres piezas → burbuja con el símbolo y "Bienvenido/a, nombre" → burbujas que se dispersan | `src/components/WelcomeTransition.tsx` (`playWelcome`, `WelcomeHost` en `_layout.tsx`) | `onCovered` navega al panel con la pantalla cubierta. Se salta tocando |
| Selector segmentado con pastilla deslizante | `Segmented` en `src/components/ui.tsx` | Profesional / Visitador y demás pestañas |
| Barra de pestañas con burbuja | `src/components/BubbleTabBar.tsx` | La burbuja no sale de la pantalla (clamp) y rebota en su lugar |
| Botón de envío (puntos → confeti → ✓) | `src/components/SubmitButton.tsx` | En nueva solicitud, devolución y respuesta a necesidades se combina a propósito con el check verde (decidido: se deja así) |
| Check verde de confirmación | `src/components/SuccessCheck.tsx` (`SuccessCheck`, `SuccessOverlay`) | |

Todas respetan "reducir movimiento" del sistema.

## Realidad aumentada

- Modelos en `ar/models`, generados con `scripts/ar/build_models.py`.
- Se sirven por jsDelivr desde este repositorio público, fijados al commit `AR_COMMIT` de `src/lib/ar.ts`.
- **Si el repositorio pasa a privado, el AR deja de funcionar.** Antes de hacerlo: crear un repositorio público aparte solo con los modelos (sin código) y cambiar `BASE` en `src/lib/ar.ts` para apuntar ahí.

## Versión web

- Se publica sola en GitHub Pages al cambiar `main` (`.github/workflows/web.yml`, base `/multi-lab` con `WEB_BASE_URL` en `app.config.js`). `scripts/web/pwa.mjs` agrega el manifiesto, los íconos de `public/` y el `404.html` para que abran todas las rutas.
- Mapa real en web: `src/components/map/PlacesMap.web.tsx` (Leaflet + mapas de OpenStreetMap, sin clave; CARTO dejó de servir sin clave).
- AR en web: `openAR` en `src/lib/ar.ts` detecta el celular por el navegador. iPhone: enlace `rel="ar"` (AR Quick Look de Safari). Android: enlace `intent://` a Scene Viewer. En la computadora solo hay vista previa.
- La sesión vive en memoria: si se recarga la página, hay que volver a iniciar sesión.
- Pendiente comprobar en un iPhone real que AR Quick Look abre desde la app agregada a la pantalla de inicio.

## AR con tarjeta impresa

- Página `public/ar-tarjeta/index.html` (MindAR 1.2.5 y three 0.160.1 desde jsDelivr; modelos copiados al sitio por `scripts/web/pwa.mjs`). Se abre con el QR de cada tarjeta o desde "Usar tarjeta impresa" en la pantalla de AR.
- La cámara reconoce solo el panel de cápsulas (izquierda de la tarjeta, 50,8 mm de ancho), que es distinto en cada producto: con la tarjeta completa los 7 diseños se confundían. Probado con cámara simulada: reconoce las 7 tarjetas.
- El producto aparece al 60 % de su tamaño real (`ESCALA` en la página) para que se vea completo.
- Los QR apuntan a `https://rguerrerot4-boop.github.io/multi-lab/ar-tarjeta/?p=<id>`: si cambia la dirección de la web hay que regenerar e imprimir las tarjetas.
- Pendiente: probarla con las tarjetas impresas en un iPhone y un Android reales.

## Respaldo en Figma

- Archivo actual: "Multi LAB · Prototipo de la app (capturas oct 2026)" — https://www.figma.com/design/CHdntcll7WDS1F5Xv78q7l
- 58 pantallas capturadas de la versión web (390×844) en 3 secciones (Entrada y acceso, Profesional de salud, Visitador médico), con 107 zonas táctiles conectadas sobre los botones reales, "Volver" como regreso y 4 flujos: Entrada a la app, Recuperar contraseña, Profesional de salud y Visitador médico.
- Inicios, perfiles, catálogo y ficha de producto se desplazan y mantienen fija la barra inferior.
- Las pantallas del mapa (60–62) tienen el mapa real de OpenStreetMap y Google Maps; los consultorios que aparecen son los de ejemplo, porque el entorno de captura no tenía acceso a la búsqueda de OpenStreetMap (overpass-api.de).
- El archivo anterior "Multi LAB · Respaldo de la app (prototipo)" quedó sin capturas; el archivo de diseño original no se toca.

## Pendientes y decisiones abiertas

- Pasar el repositorio a privado (ver Realidad aumentada; además, GitHub Pages en privado es de pago: usar Netlify o Cloudflare Pages).
- La vista 3D con Vectary sigue pendiente de integración.
- Al terminar el proyecto: publicar la app con EAS Update (`npx eas-cli@latest update:configure` y `update`) para abrirla en Expo Go sin la computadora, y crear en el iPhone un atajo con el logo que la abra. Revisar antes que el `runtimeVersion` de `app.json` sea compatible con Expo Go. Sin cuenta Apple Developer (de pago) no se puede instalar como app propia.
