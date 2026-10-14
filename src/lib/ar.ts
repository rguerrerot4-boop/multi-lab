// Realidad aumentada sin Unity: la app abre el visor de AR del propio sistema operativo.
// - Android: Scene Viewer de Google (usa ARCore) con el modelo .glb.
// - iPhone/iPad: AR Quick Look de Apple (Safari) con el modelo .usdz.
// Los modelos están en la carpeta /ar del repositorio y se sirven por jsDelivr (gratis, sin clave).
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';
import type { Product } from '@/data/mock';

/** Commit del repositorio con los modelos. Actualízalo si cambias los archivos de /ar/models. */
export const AR_COMMIT = '9d55824582a7f690dd16f5b772c7ff4fe4dc7a52';
const BASE = `https://cdn.jsdelivr.net/gh/rguerrerot4-boop/multi-lab@${AR_COMMIT}/ar/models`;

/** Medidas de la caja de demostración (cm), las mismas del modelo */
export const AR_SIZE_CM = { w: 7, h: 10.5, d: 3.2 };

export const arModelUrls = (id: string) => ({ glb: `${BASE}/${id}.glb`, usdz: `${BASE}/${id}.usdz` });

export type ArResult = 'abierto' | 'no-compatible' | 'solo-celular';

const sceneViewerUrl = (p: Product, mode: 'ar_preferred' | 'ar_only') =>
  `https://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(arModelUrls(p.id).glb)}&mode=${mode}&title=${encodeURIComponent(`${p.name} · producto ficticio`)}&resizable=true`;

export async function openAR(p: Product): Promise<ArResult> {
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
