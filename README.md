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
| Visitador médico | Juan Mieles |

En la recuperación de contraseña, el código de verificación de demostración es **123456**.

## Qué incluye

| Módulo | Pantallas |
|---|---|
| Acceso | Splash animado con el logotipo, inicio de sesión único, registro por rol, recuperación de contraseña (correo → código → nueva clave → confirmación) |
| Dashboards | Panel del profesional de salud y panel del visitador médico |
| Catálogo multimedia | Buscador, filtros por categoría y laboratorio, vista en cuadrícula o lista, ficha interactiva con galería, pestañas y secciones desplegables |
| Presentación | Revista editorial con scroll: portada con envase 3D, capítulos con parallax y apariciones, ficha rápida, modo de uso, avisos y cierre de visita |
| Solicitudes | Flujo de 3 pasos y seguimiento por estados: Pendiente → Recibida → En revisión → En proceso → Atendida / Cancelada |
| Comunicación | Bandeja de mensajes, chat individual y fichas compartidas como tarjeta |
| Agenda y mapa | Agenda semanal, detalle de visita con registro de estado y notas, y mapa de cobertura ilustrativo |
| Otros | Centro de notificaciones, perfil, contactos, historial de visitas y métricas de la prueba |

## Recorridos para probar

1. **Visitador:** Splash → Iniciar sesión → Iniciar presentación → Compartir ficha por chat → Marcar visita como realizada → Revisar solicitudes.
2. **Profesional de salud:** Iniciar sesión → Catálogo → Ficha → Solicitar → Seguimiento del estado.
3. **Recuperación de acceso:** Iniciar sesión → ¿Olvidaste tu contraseña? → Código `123456` → Nueva contraseña → Iniciar sesión.
4. **Organización de visita:** Agenda → Visita → Mapa / Catálogo → Registrar estado.

Para ver ambos lados de una solicitud: créala como profesional, cierra sesión, entra como visitador y cambia su estado.

## Alcance del prototipo

- Funciona **sin servidor**: los datos están en `src/data/mock.ts` y los cambios se guardan solo durante la sesión.
- **Requerirían integraciones adicionales:** mensajería en tiempo real, documentos autorizados, mapa con GPS y vista 3D con Vectary.
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
