// Frasco en 360° hecho con cuadros renderizados del modelo 3D (como las páginas de producto que giran
// con el desplazamiento). Cada cuadro es una imagen con fondo transparente; se muestra el cuadro del
// ángulo actual cambiando su opacidad (todo con el controlador nativo de animaciones).
// También dibuja la secuencia de apertura (la tapa se desenrosca y salen las cápsulas) y los puntos
// interactivos, que siguen la etiqueta al girar porque su posición se proyecta con la misma cámara
// con la que se renderizaron los cuadros (scripts/pancreogen: pan.html).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, Text, View, type ImageSourcePropType } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import type { GLBottle } from '@/lib/bottleGL';
import { cssAnim, domEl, isWeb, nodeValue, setStyle, useFrameLoop } from '@/lib/webAnim';
import { font } from '@/theme';

export const FRAMES = 60; // una vuelta: 6° por cuadro
const FW = 420; // tamaño de cada cuadro de giro (px)
const FH = 1000;
// cámara de los cuadros de giro: perspectiva de 18°, a 0,44 m, 6° desde arriba, mirando a 6,18 cm de altura
const CAM = { fov: (18 * Math.PI) / 180, dist: 0.44, elev: (6 * Math.PI) / 180, ty: 0.0618 };
const BODY_R = 0.0201; // radio de la etiqueta (m)
const BODY_H = 0.0956; // alto del cuerpo, de la base al borde de la tapa
// cuadros de apertura (760 × 1000) con otra cámara: el frasco se ve 1,5013 veces más chico.
// Su punto (380, 945) coincide con el punto (210, 966) del cuadro de giro (centro de la base).
const OPEN = { w: 760, h: 1000, k: 1.5013, ax: 380, ay: 945, gx: 210, gy: 966 };

/** proyecta un punto de la etiqueta (u, v) girada `frame` cuadros a píxeles del cuadro de giro */
export function project(u: number, v: number, frame: number) {
  const th = (u - 0.5) * 2 * Math.PI + (frame * 2 * Math.PI) / FRAMES;
  const P = [BODY_R * Math.sin(th), BODY_H * (1 - v), BODY_R * Math.cos(th)];
  const C = [0, CAM.ty + Math.sin(CAM.elev) * CAM.dist, Math.cos(CAM.elev) * CAM.dist];
  // ejes de la cámara (mira al objetivo, «arriba» = +y)
  const f = [0 - C[0], CAM.ty - C[1], 0 - C[2]];
  const fl = Math.hypot(f[0], f[1], f[2]);
  const F = [f[0] / fl, f[1] / fl, f[2] / fl];
  const Rt = [F[2] * 0 - F[1] * 0, 0, 0]; // cross(F, up) con up = (0,1,0) → (-F.z, 0, F.x)
  Rt[0] = -F[2];
  Rt[2] = F[0];
  const rl = Math.hypot(Rt[0], Rt[1], Rt[2]);
  const Rn = [Rt[0] / rl, Rt[1] / rl, Rt[2] / rl];
  const U = [Rn[1] * F[2] - Rn[2] * F[1], Rn[2] * F[0] - Rn[0] * F[2], Rn[0] * F[1] - Rn[1] * F[0]];
  const d = [P[0] - C[0], P[1] - C[1], P[2] - C[2]];
  const xc = d[0] * Rn[0] + d[1] * Rn[1] + d[2] * Rn[2];
  const yc = d[0] * U[0] + d[1] * U[1] + d[2] * U[2];
  const zc = d[0] * F[0] + d[1] * F[1] + d[2] * F[2];
  const k = FH / 2 / Math.tan(CAM.fov / 2);
  return { x: FW / 2 + (xc / zc) * k, y: FH / 2 - (yc / zc) * k, facing: Math.cos(th) };
}

/** cuadro (giro) en el que un punto de la etiqueta queda de frente */
export const frameFacing = (u: number) => -(u - 0.5) * FRAMES;

/**
 * Cuadros por píxel para que la etiqueta siga al dedo (como si se tomara el frasco): un arco de radio R
 * píxeles mide 2πR por vuelta. `drawnHeight` es el alto con que se dibuja el cuadro de giro (sin escala).
 */
export function framesPerPx(drawnHeight: number, scale = 1) {
  const radiusPx = ((BOTTLE_W_FRAC * FW) / 2) * (drawnHeight / FH) * scale;
  return FRAMES / (2 * Math.PI * Math.max(30, radiusPx));
}
const BOTTLE_W_FRAC = 295 / 420; // ancho del frasco dentro del cuadro de giro
/** margen del lienzo 3D alrededor de la caja del cuadro de giro (la tapa y las cápsulas salen al abrir) */
const GL_PAD_X = { l: 0.95, r: 0.95, t: 0.4, b: 0.06 }; // las cápsulas giran a ~6,5 cm del eje

export interface BottleSpot {
  id: string;
  u: number;
  v: number;
}

export function Bottle360(props: BottleProps) {
  return isWeb ? <Bottle360Web {...props} /> : <Bottle360Native {...props} />;
}

interface BottleProps {
  frames: ImageSourcePropType[];
  /** modelo .glb animado (web): si se puede, el frasco se dibuja en 3D real y los cuadros quedan de respaldo */
  model?: string;
  /** avisa cuando el frasco ya se puede mostrar: en 3D real ('3d') o con los cuadros ('cuadros') */
  onReady?: (how: '3d' | 'cuadros') => void;
  open?: ImageSourcePropType[];
  /** ángulo en cuadros (cualquier número real; 60 = una vuelta) */
  rot: Animated.Value | Animated.AnimatedInterpolation<number> | Animated.AnimatedAddition<number>;
  /** 0 = cerrado, 1 = tapa arriba y cápsulas afuera */
  openProgress?: Animated.AnimatedInterpolation<number> | Animated.Value;
  height: number;
  spots?: BottleSpot[];
  showSpots?: Animated.AnimatedInterpolation<number> | Animated.Value | Animated.AnimatedMultiplication<number>;
  activeSpot?: string | null;
  onSpot?: (id: string) => void;
  reduce?: boolean;
  spotColor: string;
  shadow?: string;
}

/** sombra en el piso, bajo el frasco */
function FloorShadow({ width, k, shadow }: { width: number; k: number; shadow: string }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: -width * 0.3, right: -width * 0.3, top: 966 * k - width * 0.16, height: width * 0.32 }}>
      <Svg width="100%" height="100%" viewBox="0 0 100 32" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="sh" cx="50" cy="16" rx="50" ry="16" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={shadow} stopOpacity="1" />
            <Stop offset="0.45" stopColor={shadow} stopOpacity="0.45" />
            <Stop offset="1" stopColor={shadow} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50" cy="16" rx="50" ry="16" fill="url(#sh)" />
      </Svg>
    </View>
  );
}

/** posición y visibilidad de cada punto, tabuladas cada medio cuadro */
function spotTable(spot: BottleSpot, k: number, S: number) {
  const inputs: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  const os: number[] = [];
  for (let i = 0; i <= FRAMES * 2; i++) {
    const f = i / 2;
    const p = project(spot.u, spot.v, f);
    inputs.push(f);
    xs.push(p.x * k - S / 2);
    ys.push(p.y * k - S / 2);
    // visible solo de frente (se apaga al acercarse al borde)
    os.push(Math.max(0, Math.min(1, (p.facing - 0.25) / 0.3)));
  }
  return { xs, ys, os, inputs };
}
const SPOT = 34;

// ---------- web: un solo bucle por cuadro escribe el estilo de los cuadros visibles ----------
function Bottle360Web({ frames, model, onReady, open, rot, openProgress, height, spots, showSpots, activeSpot, onSpot, spotColor, reduce, shadow = 'rgba(0,0,0,0.45)' }: BottleProps) {
  const k = height / FH;
  const width = FW * k;
  const ok = OPEN.k * k;
  // 3D real con WebGL (si hay modelo y el navegador puede); mientras carga, los cuadros
  const host = useRef<HTMLElement | null>(null);
  const gl = useRef<GLBottle | null>(null);
  const [glOn, setGlOn] = useState(false);
  // los cuadros (respaldo) solo se montan si no hay modelo, si el 3D falla o si tarda más de 1,8 s: así no
  // se descargan 60 imágenes de más ni se cambia de imágenes a 3D delante de la persona
  const [framesOn, setFramesOn] = useState(!model);
  useEffect(() => {
    if (!model) return setFramesOn(true);
    if (glOn) return;
    const t = setTimeout(() => setFramesOn(true), 1800);
    return () => clearTimeout(t);
  }, [model, glOn]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  useEffect(() => {
    if (!model) readyRef.current?.('cuadros');
  }, [model]);
  const size = useRef({ width, height });
  size.current = { width, height };
  const placeCanvas = (c: HTMLCanvasElement, w: number, h: number) =>
    Object.assign(c.style, {
      position: 'absolute',
      left: `${-GL_PAD_X.l * w}px`,
      top: `${-GL_PAD_X.t * h}px`,
      width: `${w * (1 + GL_PAD_X.l + GL_PAD_X.r)}px`,
      height: `${h * (1 + GL_PAD_X.t + GL_PAD_X.b)}px`,
      pointerEvents: 'none',
      zIndex: '2',
    });
  // el contexto 3D se crea una vez por modelo; al cambiar de tamaño solo se ajusta (resize)
  useEffect(() => {
    if (!model || !host.current || typeof document === 'undefined') return;
    let alive = true;
    const canvas = document.createElement('canvas');
    const { width: w0, height: h0 } = size.current;
    placeCanvas(canvas, w0, h0);
    host.current.appendChild(canvas);
    canvasRef.current = canvas;
    import('@/lib/bottleGL')
      .then((m) => m.createBottleGL(canvas, model, CAM, FRAMES, w0, h0, GL_PAD_X))
      .then((b) => {
        if (!alive) return b.dispose();
        gl.current = b;
        const { width: w, height: h } = size.current;
        if (w !== w0 || h !== h0) {
          placeCanvas(canvas, w, h);
          b.resize(w, h);
        }
        b.render(nodeValue(rot as never), openProgress ? nodeValue(openProgress as never) : 0);
        setGlOn(true);
        readyRef.current?.('3d');
      })
      .catch(() => {
        canvas.remove();
        setFramesOn(true);
        readyRef.current?.('cuadros');
      });
    return () => {
      alive = false;
      gl.current?.dispose();
      gl.current = null;
      canvas.remove();
      canvasRef.current = null;
      setGlOn(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);
  useEffect(() => {
    if (!canvasRef.current) return;
    placeCanvas(canvasRef.current, width, height);
    gl.current?.resize(width, height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);
  const giroEls = useRef<(HTMLElement | null)[]>([]);
  const openEls = useRef<(HTMLElement | null)[]>([]);
  const openBox = useRef<HTMLElement | null>(null);
  const spotEls = useRef<(HTMLElement | null)[]>([]);
  const tables = useMemo(() => (spots ?? []).map((s) => spotTable(s, k, SPOT)), [spots, k]);
  const last = useRef<{ g: number; top: number; a: number; v: number; pv?: number; moved: number; o: number; open: number; m: number; vis: number }>({ g: -1, top: -1, a: 0, v: NaN, moved: 0, o: -1, open: -1, m: NaN, vis: NaN });
  // al cambiar de modo o de tamaño se vuelve a pintar todo
  useEffect(() => {
    last.current = { g: -1, top: -1, a: 0, v: NaN, moved: 0, o: -1, open: -1, m: NaN, vis: NaN };
  }, [frames, open, spots, k, glOn, framesOn]);
  useFrameLoop(() => {
    const v = nodeValue(rot as never);
    const m = ((v % FRAMES) + FRAMES) % FRAMES;
    const p = openProgress ? nodeValue(openProgress as never) : 0;
    const opened = p > 0.004 && !!open ? 1 : 0;
    if (gl.current) {
      gl.current.render(v, p);
    } else {
      drawFrames(v, m, p, opened);
    }
    updateSpots(m);
  });
  /** respaldo sin WebGL: cuadros de 6° mezclados mientras gira */
  const drawFrames = (v: number, m: number, p: number, opened: number) => {
    const L = last.current;
    // giro: el cuadro de abajo opaco y el siguiente encima con opacidad = fracción del ángulo (mezcla suave
    // entre cuadros de 6°). Quieto, la mezcla se asienta en el cuadro más cercano (sin imagen doble). Se
    // considera «en movimiento» hasta 160 ms después del último cambio: los eventos del dedo llegan con
    // otro ritmo que los cuadros de la pantalla y, si no, la imagen parpadea entre mezclada y asentada.
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (Number.isFinite(L.v) && Math.abs(v - L.v) > 0.0005) L.moved = now;
    L.v = v;
    const moving = now - L.moved < 160;
    // girando rápido (la entrada, una inercia larga) no se mezcla: con cuadros que cambian tanto, la mezcla
    // se ve como imagen doble
    const fast = Math.abs(v - (L.pv ?? v)) > 0.45;
    L.pv = v;
    const fl = Math.floor(m);
    const t = m - fl;
    const g = opened ? -2 : fl % FRAMES;
    const top = opened ? -2 : (fl + 1) % FRAMES;
    const want = moving && !fast ? t : t > 0.5 ? 1 : 0;
    L.a = moving && !fast ? want : fast ? want : L.a + (want - L.a) * 0.2;
    if (g !== L.g || top !== L.top) {
      [L.g, L.top].forEach((n) => n >= 0 && n !== g && n !== top && setStyle(giroEls.current[n], 'opacity', '0'));
      if (g >= 0) {
        setStyle(giroEls.current[g], 'opacity', '1');
        setStyle(giroEls.current[g], 'zIndex', '1');
        setStyle(giroEls.current[top], 'zIndex', '2');
      }
      L.g = g;
      L.top = top;
    }
    if (top >= 0) setStyle(giroEls.current[top], 'opacity', L.a.toFixed(3));
    // apertura
    if (open) {
      if (opened !== L.open) {
        setStyle(openBox.current, 'opacity', opened ? '1' : '0');
        L.open = opened;
      }
      const o = opened ? Math.round(Math.max(0, Math.min(1, p)) * (open.length - 1)) : 0;
      if (o !== L.o) {
        if (L.o >= 0) setStyle(openEls.current[L.o], 'opacity', '0');
        setStyle(openEls.current[o], 'opacity', '1');
        L.o = o;
      }
    }
  };
  const updateSpots = (m: number) => {
    const L = last.current;
    const vis = showSpots ? nodeValue(showSpots as never, 1) : 1;
    if (tables.length && (Math.abs(m - L.m) > 0.002 || vis !== L.vis)) {
      L.m = m;
      L.vis = vis;
      const i = Math.min(FRAMES * 2 - 1, Math.floor(m * 2));
      const t = m * 2 - i;
      tables.forEach((tb, n) => {
        const el = spotEls.current[n];
        if (!el) return;
        const x = tb.xs[i] + (tb.xs[i + 1] - tb.xs[i]) * t;
        const y = tb.ys[i] + (tb.ys[i + 1] - tb.ys[i]) * t;
        const o = (tb.os[i] + (tb.os[i + 1] - tb.os[i]) * t) * vis;
        setStyle(el, 'transform', `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`);
        setStyle(el, 'opacity', o.toFixed(3));
        setStyle(el, 'visibility', o < 0.05 ? 'hidden' : 'visible');
      });
    }
  };
  return (
    <View ref={(r) => void (host.current = domEl(r))} style={{ width, height }} pointerEvents="box-none">
      <FloorShadow width={width} k={k} shadow={shadow} />
      {/* con 3D real los cuadros no se montan (menos memoria en el teléfono) */}
      {!glOn && framesOn && frames.map((src, i) => (
        <Image key={i} ref={(r) => void (giroEls.current[i] = domEl(r))} source={src} fadeDuration={0} style={{ position: 'absolute', left: 0, top: 0, width, height, opacity: 0 }} />
      ))}
      {open && !glOn && framesOn ? (
        <View ref={(r) => void (openBox.current = domEl(r))} pointerEvents="none" style={{ position: 'absolute', left: OPEN.gx * k - OPEN.ax * ok, top: OPEN.gy * k - OPEN.ay * ok, width: OPEN.w * ok, height: OPEN.h * ok, opacity: 0, zIndex: 3 }}>
          {open.map((src, i) => (
            <Image key={i} ref={(r) => void (openEls.current[i] = domEl(r))} source={src} fadeDuration={0} style={{ position: 'absolute', left: 0, top: 0, width: OPEN.w * ok, height: OPEN.h * ok, opacity: 0 }} />
          ))}
        </View>
      ) : null}
      {spots?.map((s, n) => (
        <View key={s.id} ref={(r) => void (spotEls.current[n] = domEl(r))} style={{ position: 'absolute', left: 0, top: 0, width: SPOT, height: SPOT, opacity: 0, zIndex: 5 }}>
          <SpotFace n={n + 1} active={activeSpot === s.id} onPress={() => onSpot?.(s.id)} reduce={!!reduce} color={spotColor} />
        </View>
      ))}
    </View>
  );
}

// ---------- nativo: cada cuadro con su opacidad animada (controlador nativo) ----------
function Bottle360Native({ frames, onReady, open, rot, openProgress, height, spots, showSpots, activeSpot, onSpot, reduce, spotColor, shadow = 'rgba(0,0,0,0.45)' }: BottleProps) {
  const k = height / FH;
  const width = FW * k;
  useEffect(() => onReady?.('cuadros'), [onReady]);
  const mod = useMemo(() => Animated.modulo(rot as Animated.Animated as never, FRAMES), [rot]);
  // los cuadros de giro se ocultan mientras se ve la apertura
  const giroVis = useMemo(
    () => (openProgress ? openProgress.interpolate({ inputRange: [0, 0.004, 1], outputRange: [1, 0, 0], extrapolate: 'clamp' }) : null),
    [openProgress],
  );
  const opacity = (i: number) => {
    const o =
      i === 0
        ? mod.interpolate({ inputRange: [0, 0.5, 0.501, FRAMES - 0.501, FRAMES - 0.5, FRAMES], outputRange: [1, 1, 0, 0, 1, 1], extrapolate: 'clamp' })
        : mod.interpolate({ inputRange: [i - 0.501, i - 0.5, i + 0.5, i + 0.501], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
    return giroVis ? Animated.multiply(o, giroVis) : o;
  };
  const openIdx = useMemo(() => (openProgress && open ? openProgress.interpolate({ inputRange: [0, 1], outputRange: [0, open.length - 1], extrapolate: 'clamp' }) : null), [openProgress, open]);
  const openOpacity = (i: number) =>
    openIdx!.interpolate({
      inputRange: i === 0 ? [0, 0.5, 0.501] : [i - 0.501, i - 0.5, i + 0.5, i + 0.501],
      outputRange: i === 0 ? [1, 1, 0] : [0, 1, 1, 0],
      extrapolate: 'clamp',
    });
  const openVis = useMemo(() => (openProgress ? openProgress.interpolate({ inputRange: [0, 0.004, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }) : null), [openProgress]);
  const ok = OPEN.k * k;

  return (
    <View style={{ width, height }} pointerEvents="box-none">
      <FloorShadow width={width} k={k} shadow={shadow} />
      {frames.map((src, i) => (
        <Animated.Image key={i} source={src} fadeDuration={0} style={{ position: 'absolute', left: 0, top: 0, width, height, opacity: opacity(i) }} />
      ))}
      {open && openIdx && openVis ? (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: OPEN.gx * k - OPEN.ax * ok, top: OPEN.gy * k - OPEN.ay * ok, width: OPEN.w * ok, height: OPEN.h * ok, opacity: openVis }}>
          {open.map((src, i) => (
            <Animated.Image key={i} source={src} fadeDuration={0} style={{ position: 'absolute', left: 0, top: 0, width: OPEN.w * ok, height: OPEN.h * ok, opacity: openOpacity(i) }} />
          ))}
        </Animated.View>
      ) : null}
      {spots?.map((s, n) => (
        <SpotDot key={s.id} spot={s} n={n + 1} mod={mod} k={k} vis={showSpots} active={activeSpot === s.id} onPress={() => onSpot?.(s.id)} reduce={!!reduce} color={spotColor} />
      ))}
    </View>
  );
}

/** Punto interactivo (nativo): sigue la etiqueta al girar y se apaga cuando queda del lado de atrás */
function SpotDot({
  spot,
  n,
  mod,
  k,
  vis,
  active,
  onPress,
  reduce,
  color,
}: {
  spot: BottleSpot;
  n: number;
  mod: Animated.AnimatedInterpolation<number>;
  k: number;
  vis?: BottleProps['showSpots'];
  active: boolean;
  onPress: () => void;
  reduce: boolean;
  color: string;
}) {
  const { xs, ys, os, inputs } = useMemo(() => spotTable(spot, k, SPOT), [spot, k]);
  const facing = mod.interpolate({ inputRange: inputs, outputRange: os });
  const opacity = vis ? Animated.multiply(facing, vis) : facing;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: SPOT,
        height: SPOT,
        opacity,
        transform: [{ translateX: mod.interpolate({ inputRange: inputs, outputRange: xs }) }, { translateY: mod.interpolate({ inputRange: inputs, outputRange: ys }) }],
      }}
    >
      <SpotFace n={n} active={active} onPress={onPress} reduce={reduce} color={color} />
    </Animated.View>
  );
}

/** número del punto con un anillo que late */
function SpotFace({ n, active, onPress, reduce, color }: { n: number; active: boolean; onPress: () => void; reduce: boolean; color: string }) {
  const S = SPOT;
  const pulse = useRef(new Animated.Value(0)).current;
  const ring = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (reduce) return;
    if (isWeb) {
      // en la web el latido es una animación CSS (no pasa por React)
      cssAnim(ring.current, `mlPulse 1.6s cubic-bezier(.25,.46,.45,.94) ${n * 0.14}s infinite`);
      return;
    }
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, delay: n * 140, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce, n]);
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Punto ${n} del frasco`} style={{ width: S, height: S, alignItems: 'center', justifyContent: 'center' }}>
      {isWeb ? (
        <View ref={(r) => void (ring.current = domEl(r))} pointerEvents="none" style={{ position: 'absolute', width: S, height: S, borderRadius: S / 2, borderWidth: 2, borderColor: '#FFFFFF', opacity: reduce ? 0.5 : 0 }} />
      ) : (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: S,
            height: S,
            borderRadius: S / 2,
            borderWidth: 2,
            borderColor: '#FFFFFF',
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.7] }) }],
          }}
        />
      )}
      <View
        style={{
          width: active ? 26 : 22,
          height: active ? 26 : 22,
          borderRadius: 13,
          backgroundColor: active ? '#FFFFFF' : color,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        <Text style={{ fontFamily: font.bold, fontSize: 11, color: active ? color : '#FFFFFF' }}>{n}</Text>
      </View>
    </Pressable>
  );
}

/** Miniatura fija del frasco (cuadro de frente), recortada */
export function BottleThumb({ source, height }: { source: ImageSourcePropType; height: number }) {
  return <Image source={source} style={{ height, width: height * (292 / 900) }} resizeMode="contain" accessibilityIgnoresInvertColors />;
}

/** Frasco que gira solo (vistas previas) */
export function BottleSpin({ frames, model, height, reduce, seconds = 12 }: { frames: ImageSourcePropType[]; model?: string; height: number; reduce?: boolean; seconds?: number }) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(rot, { toValue: FRAMES, duration: seconds * 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [rot, reduce, seconds]);
  return <Bottle360 frames={frames} model={model} rot={rot} height={height} spotColor="#1F6B6E" reduce={reduce} />;
}
