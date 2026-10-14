# Multi LAB

Prototipo funcional de la aplicación móvil **Multi LAB**: una experiencia multimedia interactiva para la presentación digital de productos farmacéuticos, dirigida a visitadores médicos y profesionales de la salud.

Proyecto de titulación de la carrera de Multimedia y Producción Audiovisual. **Todas las personas, laboratorios, productos y ubicaciones son ficticios.**

## Cómo ejecutarla

Requisitos: [Node.js 20+](https://nodejs.org) y la app **Expo Go** en tu celular (Android o iPhone).

```bash
git clone https://github.com/rguerrerot4-boop/multi-lab.git
cd multi-lab
npm install
npx expo start
```

- **En el celular:** escanea el código QR con Expo Go (Android) o con la cámara (iPhone). El celular y la computadora deben estar en la misma red Wi‑Fi.
- **En el navegador:** presiona `w` en la terminal.

### Cuentas de demostración

En la pantalla de inicio de sesión, elige el perfil y pulsa **“Completar con cuenta demo”**:

| Perfil | Usuario |
|---|---|
| Profesional de salud | Dra. Pamela Toscano |
| Visitador médico | Juan Carlos Mieles (Laboratorios Celvia) |

En la recuperación de contraseña, el código de verificación de demostración es **123456**.

## Qué incluye

| Módulo | Pantallas |
|---|---|
| Acceso | Splash animado con el logotipo, inicio de sesión único, registro por rol, recuperación de contraseña (correo → código → nueva clave → confirmación) |
| Dashboards | Panel del profesional de salud y panel del visitador médico (acción rápida **Comenzar visita**, indicadores del día, meta semanal, ruta de hoy, accesos rápidos y aviso de kit) |
| Estado y búsquedas del médico | El profesional marca su estado (**Libre**, **En consulta** con tiempo, **No disponible**), que el visitador ve en su ruta, al comenzar la visita y en el detalle. Con **Necesito un producto** publica una solicitud solo con palabras clave (estados: Publicada → Vista → Respondida; no ve productos ni a un visitador en particular); al visitador le llega la alerta y la app le indica cuál de sus productos coincide, para enviar la ficha y responder. El médico sigue el estado: Enviada → Vista → Atendida |
| Devoluciones | El médico reporta muestras o material de apoyo recibido en mal estado (material, motivo, cantidad, fotos y si prefiere reposición o retiro). El visitador lo sigue: Reportada → Recibida → En revisión → Retiro agendado → Resuelta, con notas para el médico. No es una devolución de compra |
| Visita en curso | Cronómetro, datos del profesional (horario, preferencias, última visita, solicitudes abiertas), productos presentados, **contador de material entregado** (muestras, impresos, ficha digital) con el kit disponible, resultado de la visita, **firma con el dedo** como acuse de recibo y resumen final |
| Registro de visitas | Cada visita finalizada se guarda automáticamente: totales del periodo, buscador, filtros por fecha y por profesional, y detalle con material entregado, resultado y firma |
| Catálogo multimedia | Buscador, filtros por categoría y laboratorio, vista en cuadrícula o lista, ficha interactiva con galería, pestañas y secciones desplegables |
| Realidad aumentada | Botón **Ver en AR** en la ficha, el visor 3D y la presentación: explica el uso y abre el visor AR del teléfono para colocar el envase en una superficie plana a tamaño real (Scene Viewer en Android con ARCore, AR Quick Look en iPhone). Modelos en `ar/models` |
| Presentación | Revista editorial con scroll: portada con envase 3D, capítulos con parallax y apariciones, ficha rápida, modo de uso, avisos y cierre de visita |
| Solicitudes | Flujo de 4 pasos: el médico elige el **laboratorio** (Celvia, Andina Pharma o Bioandes, cada uno con su visitador), luego un **producto de su área** (Dermatología, Pediatría o Medicina general; las otras áreas quedan ocultas), el tipo (información técnica, material de apoyo, **muestra original** o agendar visita), el **nivel de necesidad** (Urgente, Esta semana, Sin prisa) y confirma. Al visitador le aparecen primero las urgentes. Seguimiento y seguimiento por estados: Pendiente → Recibida → En revisión → En proceso → Atendida / Cancelada |
| Comunicación | Bandeja de mensajes, chat individual y fichas compartidas como tarjeta |
| Agenda y mapa | Agenda semanal, detalle de visita con registro de estado y notas, y mapa interactivo con tu ubicación (GPS), buscador, tus visitas, consultorios, clínicas y hospitales cercanos de OpenStreetMap, rutas dentro de la app (OSRM) con tiempo en auto y a pie, y Google Maps integrado para buscar consultorios y médicos |
| Otros | Centro de notificaciones, perfil, contactos, historial de visitas y métricas de la prueba |

## Recorridos para probar

1. **Visitador:** Splash → Iniciar sesión → Comenzar visita → Presentar producto → Contar material entregado → Finalizar y firmar → Resumen → Registro de visitas → Mi kit.
2. **Profesional de salud:** Iniciar sesión → Tu estado → Necesito un producto (palabras clave) → Seguimiento → Devoluciones. El profesional no navega el catálogo: accede a los productos a través del visitador (fichas compartidas por chat y visitas).
3. **Recuperación de acceso:** Iniciar sesión → ¿Olvidaste tu contraseña? → Código `123456` → Nueva contraseña → Iniciar sesión.
4. **Organización de visita:** Agenda → Visita → Mapa / Catálogo → Registrar estado.

Para ver ambos lados de una solicitud: créala como profesional, cierra sesión, entra como visitador y cambia su estado.

## Alcance del prototipo

- Funciona **sin servidor**: los datos están en `src/data/mock.ts` y los cambios se guardan solo durante la sesión.
- **Requerirían integraciones adicionales:** mensajería en tiempo real, documentos autorizados y vista 3D con Vectary.
- **AR:** funciona en el celular (Expo Go o APK) con internet. En Android necesita “Servicios de Google Play para RA”; en iPhone, iOS 12 o superior. En el navegador solo se ve la vista previa. Para regenerar los modelos: `node --experimental-strip-types scripts/ar/export-products.mts` y `python3 scripts/ar/build_models.py` (requiere `pip install usd-core pillow`).
- **Mapa:** en Expo Go usa el mapa real del teléfono, pide permiso de ubicación y busca lugares de salud cercanos en OpenStreetMap (gratuito, sin clave). En la vista web el mapa es ilustrativo. Para generar el APK de Android hay que agregar una clave de Google Maps en `app.json` (plugin `react-native-maps`).
- El material entregado es de demostración y la firma es solo un acuse de recibo: la app no registra ventas, pedidos ni dispensación, y la firma no tiene validez legal.
- La pantalla **Perfil → Métricas de la prueba** registra los eventos de interacción de la sesión, para pruebas de usabilidad controladas. No son métricas reales de uso.

## Estructura

```
src/
  app/          Pantallas (Expo Router: cada archivo es una ruta)
    auth/       Acceso y recuperación
    medico/     Pestañas del profesional de salud
    visitador/  Pestañas del visitador médico
  screens/      Pantallas compartidas por ambos roles
  components/   Componentes reutilizables (botones, campos, tarjetas…)
  data/         Datos ficticios
  store/        Estado de la app (sesión, solicitudes, chats, visitas)
  theme.ts      Colores, tipografía y espaciados
assets/         Logotipo oficial e íconos
```

## Identidad visual

Los colores y el logotipo provienen del Manual de Marca:

| Color | Código | Uso |
|---|---|---|
| Teal | `#1E7F8C` | Acciones y elementos activos |
| Petróleo oscuro | `#20343A` | Texto y fondos oscuros |
| Turquesa claro | `#63C9D6` | Acentos (no se usa para texto, por contraste) |

La tipografía de la interfaz es Montserrat. El logotipo se usa como imagen sin deformarlo, rotarlo ni cambiarle el color.
