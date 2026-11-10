// Voz del asistente «Multi» en la web: lo que dice (audios grabados o la voz del dispositivo) y lo que escucha
// (reconocimiento de voz del navegador). En la app nativa no hay voz: el asistente funciona por texto.
import { Platform } from 'react-native';
import { VOZ } from '@/data/asistente-voz';
import { claveVoz, paraVoz } from '@/lib/asistente';

const web = Platform.OS === 'web' && typeof window !== 'undefined';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const W: any = web ? window : {};

// ---------- hablar ----------
let audio: HTMLAudioElement | null = null;
let turno = 0;

export const puedeHablar = web && (typeof W.Audio !== 'undefined' || 'speechSynthesis' in W);

function vozDelDispositivo(): SpeechSynthesisVoice | undefined {
  const vs: SpeechSynthesisVoice[] = W.speechSynthesis?.getVoices?.() ?? [];
  const es = vs.filter((v) => /^es/i.test(v.lang));
  // primero una voz de mujer en español de América, que se parece más a la grabada
  return (
    es.find((v) => /paulina|m[oó]nica|sabina|helena|elena|laura|dalia|marisol|google español de estados unidos/i.test(v.name)) ??
    es.find((v) => /es[-_](mx|us|419|ec|co)/i.test(v.lang)) ??
    es[0]
  );
}

function sintetizar(text: string, id: number, fin: () => void) {
  const synth = W.speechSynthesis;
  if (!synth || typeof W.SpeechSynthesisUtterance === 'undefined') return fin();
  const u = new W.SpeechSynthesisUtterance(paraVoz(text));
  const v = vozDelDispositivo();
  if (v) u.voice = v;
  u.lang = v?.lang ?? 'es-US';
  u.rate = 0.96;
  u.pitch = 1.05;
  u.onend = u.onerror = () => id === turno && fin();
  synth.cancel();
  synth.speak(u);
}

/** Dice el texto: con el audio grabado si esa frase lo tiene; si no, con la voz del dispositivo */
export function hablar(text: string, alTerminar?: () => void) {
  callar();
  const id = ++turno;
  let hecho = false;
  const fin = () => {
    if (hecho) return;
    hecho = true;
    alTerminar?.();
  };
  if (!web) return fin();
  const url = VOZ[claveVoz(text)];
  if (!url || typeof W.Audio === 'undefined') return sintetizar(text, id, fin);
  const a: HTMLAudioElement = new W.Audio(url);
  audio = a;
  a.onended = () => id === turno && fin();
  a.onerror = () => id === turno && sintetizar(text, id, fin);
  a.play().catch(() => id === turno && sintetizar(text, id, fin));
}

export function callar() {
  turno++;
  if (audio) {
    audio.onended = audio.onerror = null;
    audio.pause();
    audio = null;
  }
  if (web) W.speechSynthesis?.cancel?.();
}

/** Descarga por adelantado los audios más usados, para que respondan sin espera */
export function precargar(textos: string[]) {
  if (!web || typeof W.Audio === 'undefined') return;
  textos.forEach((t) => {
    const url = VOZ[claveVoz(t)];
    if (!url) return;
    const a = new W.Audio();
    a.preload = 'auto';
    a.src = url;
  });
}

// ---------- escuchar ----------
const SR = web ? W.SpeechRecognition || W.webkitSpeechRecognition : undefined;
export const puedeEscuchar = !!SR;

export interface Escucha {
  stop: () => void;
}

/**
 * Escucha una sola frase (botón del micrófono). `onParcial` recibe lo que va entendiendo.
 * `onFin` recibe la frase completa, o '' si no se entendió nada.
 */
export function escucharUna(onParcial: (t: string) => void, onFin: (t: string, error?: string) => void): Escucha {
  if (!SR) {
    onFin('', 'no-soportado');
    return { stop: () => {} };
  }
  const r = new SR();
  r.lang = 'es-EC';
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  let texto = '';
  let listo = false;
  let error: string | undefined;
  const fin = () => {
    if (listo) return;
    listo = true;
    onFin(texto.trim(), error);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  r.onresult = (e: any) => {
    texto = Array.from(e.results as ArrayLike<{ 0: { transcript: string } }>)
      .map((x) => x[0].transcript)
      .join(' ');
    onParcial(texto);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  r.onerror = (e: any) => {
    error = e.error;
  };
  r.onend = fin;
  try {
    r.start();
  } catch {
    error = 'no-inicio';
    fin();
  }
  return {
    stop: () => {
      try {
        r.stop();
      } catch {
        fin();
      }
    },
  };
}

/**
 * Escucha continua de la frase de activación («hola multi»). Llama `onFrase` con cada frase terminada
 * y se reinicia sola mientras esté activa. Devuelve cómo pararla; `pausa(true)` la silencia mientras Multi habla.
 */
export function escucharSiempre(onFrase: (t: string) => void, onEstado: (activo: boolean, error?: string) => void) {
  if (!SR) {
    onEstado(false, 'no-soportado');
    return { stop: () => {}, pausa: (_: boolean) => {} };
  }
  let vivo = true;
  let pausado = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r: any = null;
  let reintento: ReturnType<typeof setTimeout> | null = null;
  const arrancar = () => {
    if (!vivo || pausado || r) return;
    r = new SR();
    r.lang = 'es-EC';
    r.interimResults = false;
    r.continuous = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) onFrase(String(e.results[i][0].transcript));
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        vivo = false;
        onEstado(false, 'sin-permiso');
      }
    };
    r.onend = () => {
      r = null;
      if (vivo && !pausado) reintento = setTimeout(arrancar, 350); // el navegador corta la escucha cada cierto tiempo
    };
    try {
      r.start();
      onEstado(true);
    } catch {
      r = null;
      reintento = setTimeout(arrancar, 1200);
    }
  };
  const parar = () => {
    if (reintento) clearTimeout(reintento);
    reintento = null;
    try {
      r?.abort();
    } catch {
      /* ya estaba parada */
    }
    r = null;
  };
  arrancar();
  return {
    stop: () => {
      vivo = false;
      parar();
      onEstado(false);
    },
    pausa: (p: boolean) => {
      if (!vivo || pausado === p) return;
      pausado = p;
      if (p) parar();
      else reintento = setTimeout(arrancar, 250);
    },
  };
}

// preferencia de activación por voz y de sonido (solo en este navegador)
export function leerPref(k: string, def: boolean) {
  try {
    const v = W.localStorage?.getItem(`ml-multi-${k}`);
    return v == null ? def : v === '1';
  } catch {
    return def;
  }
}
export function guardarPref(k: string, v: boolean) {
  try {
    W.localStorage?.setItem(`ml-multi-${k}`, v ? '1' : '0');
  } catch {
    /* modo privado */
  }
}
