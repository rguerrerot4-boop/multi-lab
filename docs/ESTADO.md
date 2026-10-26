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

- El QR de cada tarjeta abre la **ficha del producto en PDF** (`public/fichas/<id>.pdf`): portada con la caja 3D, cifras, modo de uso, avisos, tablas del empaque (CORAESSENS) y el botón «Ver en AR», que abre `ar-tarjeta/?p=<id>`. Se generan con `node --experimental-strip-types scripts/ar/export-products.mts` y `python3 scripts/fichas/build_fichas.py`. Los textos de CORAESSENS están en `src/data/coraessens-info.ts` (sin imágenes, para que el script los pueda leer).
- Con `?p=<id>` la página de AR solo muestra ese producto: si la cámara ve la tarjeta de otro, avisa «Esta tarjeta es de …» y no muestra nada. Sin `?p` responde a todas.

- Cada producto tiene su propia hoja para imprimir: `public/ar-tarjeta/tarjetas/<id>.pdf` (la genera `build_cards.py`). La app y la página de AR con `?p=<id>` descargan solo esa; sin producto, la hoja con todas (`tarjetas-multilab.pdf`).

- Página `public/ar-tarjeta/index.html` (MindAR 1.2.5 y three 0.160.1 desde jsDelivr; modelos copiados al sitio por `scripts/web/pwa.mjs`). Se abre con el QR de cada tarjeta o desde "Usar tarjeta impresa" en la pantalla de AR.
- La cámara reconoce solo el panel de cápsulas (izquierda de la tarjeta, 50,8 mm de ancho), que es distinto en cada producto: con la tarjeta completa los 7 diseños se confundían. Probado con cámara simulada: reconoce las 7 tarjetas.
- El producto aparece al 60 % de su tamaño real (`ESCALA` en la página) para que se vea completo.
- Los QR apuntan a `https://rguerrerot4-boop.github.io/multi-lab/ar-tarjeta/?p=<id>`: si cambia la dirección de la web hay que regenerar e imprimir las tarjetas.
- Pendiente: probarla con las tarjetas impresas en un iPhone y un Android reales.

## Ficha del producto (`src/screens/Ficha.tsx`)

- Una sola pantalla para todos los productos (`/producto/[id]`), armada con las referencias: portada con el nombre gigante en movimiento detrás de la caja 3D flotando; ficha técnica con cifras grandes en recuadro; «Cara por cara»; componentes en manchas de tinta (al tocar una se abre grande al centro con su texto completo; las manchas caben enteras en su lienzo y nunca se cortan a los lados); modo de uso y avisos; pedestal solo con el modelo 3D (la caja gira como en un tocadiscos con la base en el mismo plano que la tapa del pedestal: `turntable` y `pedestal` en PhotoBox3D y Product3D, dibujo en `src/components/Pedestal.tsx`); cierre con letras grandes y acciones. Barra flotante con las acciones del rol (Presentar/Compartir o Solicitar/Contactar).
- «Cara por cara»: la foto de cada cara va enmarcada dentro de la tarjeta (no se sale), con el número de la tarjeta de fondo. Al deslizar (o con las flechas y los puntos) la caja de arriba gira a la cara de la tarjeta del centro; al tocar esa tarjeta se voltea y muestra su texto; «Ampliar foto» abre la foto de esa cara para leer el empaque (1×, 1,6×, 2,4×).
- La vitrina 3D ya no es un botón aparte: es la ficha de CORAESSENS. `/vitrina/[id]` redirige a la ficha. Presentar CORAESSENS abre esta misma ficha en modo presentación (cronómetro, «Terminar presentación» y marca el producto en la visita en curso); `?modo=diapositivas` abre la revista de siempre. Los productos ficticios siguen presentándose con la revista.
- Contenido: `src/data/ficha.ts` (`fichaContent`, `fichaPalette`, `specsOf`). Piezas visuales: `src/components/showcase.tsx`.
- Web: react-native-web reemplaza `scrollTo` en el nodo del carrusel; `scrollToX` usa el del navegador. El carrusel no lleva `overflow: visible` en la web (si no, se desplaza la sección entera).

## CORAESSENS (producto real con fotos)

- Datos `src/data/vitrina.ts`, caja `src/components/PhotoBox3D.tsx`, acceso `src/components/VitrinaBanner.tsx` (abre su ficha).
- Texturas: `scripts/coraessens/texturas.py <carpeta de fotos>` endereza las caras (esquinas medidas a mano en IMG_2208, 2214, 2222, 2233, 2235 y 2238), iguala el blanco y crea la versión ficticia. Las fotos originales no están en el repositorio.
- Modelos AR: `scripts/coraessens/modelo.py` → `ar/models/cor.*` (real) y `cor-f.*` (ficticio), con la geometría de `build_models.py`.
- La caja 3D usa proyección ortográfica: cada cara es un paralelogramo y la foto se mapea exacta con una matriz afín de SVG (sin costuras). Las cajas fuera de pantalla se pausan.
- Medidas de la caja aproximadas: 3,6 × 3,6 × 5,2 cm (proporción medida en las fotos; la persona dueña del proyecto aceptó que no sean exactas).
- Integrado en toda la app como producto `cor` de `src/data/mock.ts` (laboratorio real Nutrabiotics, atendido en la demo por el visitador v1): catálogo (filtro "Mis laboratorios"), ficha, visor 3D y presentación con las fotos (`Product3D` usa `product.photo`), AR con su modelo y tamaño, solicitudes del médico, visita en curso, kit y búsquedas por palabras clave. Tiene su propia tarjeta impresa (ver abajo).
- Animaciones: texto gigante en bucle, trazos flotando, caja flotando y girando, tarjetas que escalan al centrarse con la foto saliendo de la tarjeta, cierre que entra por los lados. Con "reducir movimiento" todo queda quieto.
- Tarjeta impresa propia: `card_coraessens()` en `scripts/ar/build_cards.py` (colores del empaque y la foto del frente en el panel que reconoce la cámara). Es el último objetivo de `tarjetas.mind` (índice 7) y aparece al 80 % de su tamaño (`escala` en `productos.json`). Probado con cámara simulada: reconoce CORAESSENS y las tarjetas anteriores siguen funcionando.

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
