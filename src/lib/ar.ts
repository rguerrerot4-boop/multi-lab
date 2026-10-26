// Realidad aumentada sin Unity: la app abre el visor de AR del propio sistema operativo.
// - Android: Scene Viewer de Google (usa ARCore) con el modelo .glb.
// - iPhone/iPad: AR Quick Look de Apple (Safari) con el modelo .usdz.
// En la versión web pasa lo mismo desde el navegador del celular; en la computadora solo hay vista previa.
// Los modelos están en la carpeta /ar del repositorio y se sirven por jsDelivr (gratis, sin clave).
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';
import type { Product } from '@/data/mock';

/** Commit del repositorio con los modelos. Actualízalo si cambias los archivos de /ar/models. */
export const AR_COMMIT = '3ec38173afdbd2c7614e280786ca94fb8dbef81a';
const BASE = `https://cdn.jsdelivr.net/gh/rguerrerot4-boop/multi-lab@${AR_COMMIT}/ar/models`;

/** Medidas de la caja de demostración (cm), las mismas del modelo */
export const AR_SIZE_CM = { w: 7, h: 10.5, d: 3.2 };

export const arModelUrls = (id: string) => ({ glb: `${BASE}/${id}.glb`, usdz: `${BASE}/${id}.usdz` });

/** Versión web publicada: ahí vive la AR con tarjeta impresa (public/ar-tarjeta). */
export const WEB_URL = 'https://rguerrerot4-boop.github.io/multi-lab';
/** AR sobre la tarjeta impresa del producto: se abre en el navegador del teléfono y usa su cámara. */
export const arCardUrl = (id: string) => `${WEB_URL}/ar-tarjeta/?p=${id}`;
/** Hoja A4 con las tarjetas para imprimir y recortar. */
export const AR_CARDS_PDF = `${WEB_URL}/ar-tarjeta/tarjetas-multilab.pdf`;
/** Ficha del producto en PDF (la abre el código QR de su tarjeta impresa). */
export const fichaPdfUrl = (id: string) => `${WEB_URL}/fichas/${id}.pdf`;
/** Hoja A4 solo con la tarjeta de un producto. */
export const arCardPdf = (id: string) => `${WEB_URL}/ar-tarjeta/tarjetas/${id}.pdf`;

export type ArResult = 'abierto' | 'no-compatible' | 'solo-celular';

/** Sistema del teléfono donde se abriría la AR (en web se deduce del navegador); null en computadora */
export function arDevice(): 'android' | 'ios' | null {
  if (Platform.OS === 'android' || Platform.OS === 'ios') return Platform.OS;
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  // el iPad con iPadOS se presenta como Mac, pero tiene pantalla táctil
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return null;
}

/** Lo mínimo para abrir un modelo en AR: su id en ar/models y el título que muestra el visor. */
export type ArItem = Pick<Product, 'id' | 'name'> & { arTitle?: string };

const sceneViewerUrl = (p: ArItem, mode: 'ar_preferred' | 'ar_only') =>
  `https://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(arModelUrls(p.id).glb)}&mode=${mode}&title=${encodeURIComponent(p.arTitle ?? `${p.name} · producto ficticio`)}&resizable=true`;

// Web en Android: el navegador abre Scene Viewer con un enlace "intent"; si no está, vuelve a esta página
function openSceneViewerWeb(p: ArItem) {
  const fallback = encodeURIComponent(window.location.href);
  const target = sceneViewerUrl(p, 'ar_only').replace('https://', '');
  window.location.href = `intent://${target}#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;S.browser_fallback_url=${fallback};end;`;
}

// Web en iPhone: Safari abre AR Quick Look con un enlace rel="ar" que contiene una imagen
function openQuickLookWeb(p: ArItem) {
  const a = document.createElement('a');
  a.rel = 'ar';
  a.href = arModelUrls(p.id).usdz;
  a.appendChild(document.createElement('img'));
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function openAR(p: ArItem): Promise<ArResult> {
  if (Platform.OS === 'web') {
    const device = arDevice();
    if (!device) return 'solo-celular';
    try {
      if (device === 'android') openSceneViewerWeb(p);
      else openQuickLookWeb(p);
      return 'abierto';
    } catch {
      return 'no-compatible';
    }
  }
  if (Platform.OS === 'android') {
    // 1) Scene Viewer dentro de la app de Google (lo tienen casi todos los Android)
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: sceneViewerUrl(p, 'ar_preferred'),
        packageName: 'com.google.android.googlequicksearchbox',
      });
      return 'abierto';
    } catch {}
    // 2) Scene Viewer de ARCore directamente
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: sceneViewerUrl(p, 'ar_only'),
        packageName: 'com.google.ar.core',
      });
      return 'abierto';
    } catch {}
    return 'no-compatible';
  }
  if (Platform.OS === 'ios') {
    // Safari reconoce el .usdz y abre AR Quick Look
    try {
      await Linking.openURL(arModelUrls(p.id).usdz);
      return 'abierto';
    } catch {
      return 'no-compatible';
    }
  }
  return 'solo-celular';
}
