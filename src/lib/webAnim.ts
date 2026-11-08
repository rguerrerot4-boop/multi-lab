// Ayudas para animar en la web sin pasar por React en cada cuadro.
// En react-native-web, Animated vuelve a renderizar cada componente animado en cada cambio de valor; con el
// desplazamiento eso son decenas de renders por cuadro y la página se traba. Aquí se lee el valor actual de
// los nodos de Animated una vez por cuadro (requestAnimationFrame) y se escribe el estilo en el DOM.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';

type AnyNode = { __getValue?: () => number } | null | undefined;

/** valor actual de un nodo de Animated (Value, interpolación, suma…) */
export function nodeValue(n: AnyNode, fallback = 0): number {
  const v = n?.__getValue?.();
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** elemento del DOM de una referencia de react-native-web */
export function domEl(r: unknown): HTMLElement | null {
  return r && typeof (r as HTMLElement).style === 'object' ? (r as HTMLElement) : null;
}

// un solo requestAnimationFrame para toda la app: primero las tareas «pre» (p. ej. leer el desplazamiento
// real de la página), después las que dibujan; así todas usan el mismo valor en el mismo cuadro
type Tick = { fn: () => void; pre: boolean };
const ticks = new Set<Tick>();
let rafId = 0;
function run() {
  rafId = 0;
  if (!ticks.size) return;
  ticks.forEach((t) => t.pre && t.fn());
  ticks.forEach((t) => !t.pre && t.fn());
  rafId = requestAnimationFrame(run);
}

/** corre `tick` en cada cuadro mientras el componente está montado (solo en la web) */
export function useFrameLoop(tick: () => void, enabled = true, pre = false) {
  const fn = useRef(tick);
  fn.current = tick;
  useEffect(() => {
    if (!isWeb || !enabled || typeof requestAnimationFrame === 'undefined') return;
    const t: Tick = { fn: () => fn.current(), pre };
    ticks.add(t);
    if (!rafId) rafId = requestAnimationFrame(run);
    return () => {
      ticks.delete(t);
    };
  }, [enabled, pre]);
}

let injected = false;
/** animaciones CSS que corren solas en el compositor (latido de los puntos, flotación del frasco) */
export function ensureKeyframes() {
  if (!isWeb || injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.textContent = [
    '@keyframes mlPulse{0%{opacity:.9;transform:scale(.6)}100%{opacity:0;transform:scale(1.7)}}',
    '@keyframes mlBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}',
    '@keyframes mlHint{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}',
  ].join('');
  document.head.appendChild(s);
}

/** aplica una animación CSS a un elemento; `sync` la alinea con el reloj (dos elementos quedan en fase) */
export function cssAnim(el: HTMLElement | null, value: string, periodMs?: number) {
  if (!el) return;
  ensureKeyframes();
  el.style.animation = value;
  if (periodMs) el.style.animationDelay = `-${Math.round(Date.now() % periodMs)}ms`;
}

/** asigna un estilo solo si cambió (evita trabajo del navegador) */
export function setStyle(el: HTMLElement | null, key: 'transform' | 'opacity' | 'visibility' | 'pointerEvents' | 'zIndex', value: string) {
  if (!el) return;
  if (el.style[key] !== value) el.style[key] = value;
}
