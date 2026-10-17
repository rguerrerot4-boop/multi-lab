# Estado del proyecto y pendientes

Guía de traspaso para continuar el trabajo (en Claude Code o con otra persona). Complementa `README.md` (qué incluye la app) y `CLAUDE.md` (reglas).

## Cómo verificar un cambio

```bash
npm install
npx tsc --noEmit            # obligatorio antes de terminar un cambio
npx expo start              # celular con Expo Go, o "w" para el navegador
npx expo export --platform web --output-dir dist-web   # build web de prueba
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
| Botón de envío (puntos → confeti → ✓) | `src/components/SubmitButton.tsx` | |
| Check verde de confirmación | `src/components/SuccessCheck.tsx` (`SuccessCheck`, `SuccessOverlay`) | |

Todas respetan "reducir movimiento" del sistema.

## Realidad aumentada

- Modelos en `ar/models`, generados con `scripts/ar/build_models.py`.
- Se sirven por jsDelivr desde este repositorio público, fijados al commit `AR_COMMIT` de `src/lib/ar.ts`.
- **Si el repositorio pasa a privado, el AR deja de funcionar.** Antes de hacerlo: crear un repositorio público aparte solo con los modelos (sin código) y cambiar `BASE` en `src/lib/ar.ts` para apuntar ahí.

## Respaldo en Figma

- Archivo nuevo "Multi LAB · Respaldo de la app (prototipo)" con 58 marcos conectados como prototipo (4 secciones, 4 flujos). No es el archivo de diseño original, que no se debe tocar.
- Pendiente: colocar las 58 capturas (`01-splash.png` … `58-….png`). Cada marco tiene un texto "Pendiente" con el nombre de su imagen. Las capturas son anteriores a la burbuja de entrada y a la bienvenida animada.

## Pendientes y decisiones abiertas

- Pasar el repositorio a privado (ver Realidad aumentada).
- Rehacer las capturas del respaldo en Figma con el splash y la bienvenida nuevos.
- Decidir si se quita el confeti del botón de envío en las pantallas que ya muestran el check verde de confirmación.
- La vista 3D con Vectary sigue pendiente de integración.
- Al terminar el proyecto: publicar la app con EAS Update (`npx eas-cli@latest update:configure` y `update`) para abrirla en Expo Go sin la computadora, y crear en el iPhone un atajo con el logo que la abra. Revisar antes que el `runtimeVersion` de `app.json` sea compatible con Expo Go. Sin cuenta Apple Developer (de pago) no se puede instalar como app propia.
