import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, View, type ImageSourcePropType } from 'react-native';
import Svg, { Defs, Ellipse, G, Image as SvgImage, LinearGradient, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { type Q, type V3, qAxis, qMul, qNorm, qRot, qSlerp } from '@/lib/quat';
import { PedestalShape } from '@/components/Pedestal';
import { colors } from '@/theme';

// Caja 3D con las fotos reales del empaque como textura.
// Cada cara es una foto enderezada (scripts/coraessens/texturas.py) que se proyecta con una
// matriz afín: en proyección ortográfica cada cara es un paralelogramo, así que el mapeo es exacto
// y no hay costuras. Gira en cualquier dirección con inercia, flota y se apoya sobre su sombra.

export type BoxFace = 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom';
export type BoxTextures = Record<BoxFace, ImageSourcePropType>;

export interface PhotoBox3DHandle {
  reset: () => void;
  show: (face: BoxFace) => void;
}

// vista de reposo: un poco desde arriba y girada, para que se vean frente, lateral y tapa
export const BOX_VIEW: Q = qMul(qAxis([1, 0, 0], 0.36), qAxis([0, 1, 0], -0.62));
const TURN_TILT = 0.34; // inclinación de la cámara sobre el pedestal
const faceQ = (face: BoxFace): Q => {
  const tilt = qAxis([1, 0, 0], 0.22);
  const side = qAxis([0, 1, 0], -0.32);
  switch (face) {
    case 'front':
      return qMul(tilt, side);
    case 'left':
      return qMul(tilt, qMul(side, qAxis([0, 1, 0], Math.PI / 2)));
    case 'back':
      return qMul(tilt, qMul(side, qAxis([0, 1, 0], Math.PI)));
    case 'right':
      return qMul(tilt, qMul(side, qAxis([0, 1, 0], -Math.PI / 2)));
    case 'top':
      return qMul(qAxis([1, 0, 0], 0.95), qAxis([0, 1, 0], -0.35));
    case 'bottom':
      return qMul(qAxis([1, 0, 0], -0.95), qAxis([0, 1, 0], -0.35));
  }
};

const LIGHT: V3 = (() => {
  const v: V3 = [-0.45, 0.7, 0.55];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();
// vector medio entre la luz y la cámara (brillo especular)
const HALF: V3 = (() => {
  const v: V3 = [LIGHT[0], LIGHT[1], LIGHT[2] + 1];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

export const PhotoBox3D = forwardRef<
  PhotoBox3DHandle,
  {
    textures: BoxTextures;
    /** medidas relativas de la caja (ancho, alto, fondo) */
    dims?: { w: number; h: number; d: number };
    width: number;
    height: number;
    /** fracción del lado menor que ocupa la diagonal de la caja */
    fill?: number;
    autoRotate?: boolean;
    interactive?: boolean;
    /** pellizcar o rueda del ratón para acercar, doble toque para restablecer, arrastre en todas direcciones */
    fullGestures?: boolean;
    float?: boolean;
    paused?: boolean;
    reduceMotion?: boolean;
    edge?: string; // color del canto (se ve entre caras al antialiasear)
    initial?: Q;
    spinSpeed?: number;
    onInteract?: () => void;
    /** gira como en un tocadiscos (solo sobre su eje vertical, con la inclinación fija) */
    turntable?: boolean;
    /** dibuja un pedestal con la tapa en el plano de la base de la caja */
    pedestal?: boolean;
  }
>(function PhotoBox3D(
  {
    textures,
    dims = { w: 1, h: 1.444, d: 1 },
    width: W,
    height: H,
    fill = 0.62,
    autoRotate = true,
    interactive = true,
    fullGestures = false,
    float = true,
    paused = false,
    reduceMotion = false,
    edge = '#B0282E',
    initial = BOX_VIEW,
    spinSpeed = 0.00042,
    onInteract,
    turntable = false,
    pedestal = false,
  },
  ref,
) {
  const [, force] = useState(0);
  const qRef = useRef<Q>(initial);
  const dragging = useRef(false);
  const moved = useRef(false);
  const vel = useRef({ x: 0, y: 0 });
  const last = useRef({ dx: 0, dy: 0 });
  const tween = useRef<{ from: Q; to: Q; t0: number; dur: number } | null>(null);
  const idleSince = useRef(0);
  const t = useRef(0); // reloj para la flotación
  const zoom = useRef(1);
  const pinch = useRef({ start: 0, base: 1 });
  const lastTap = useRef(0);
  const angle = useRef(-0.62); // giro del tocadiscos
  const onInteractRef = useRef(onInteract);
  onInteractRef.current = onInteract;

  const redraw = useCallback(() => force((n) => (n + 1) % 1e6), []);
  const spin = useCallback((ax: number, ay: number) => {
    qRef.current = qNorm(qMul(qMul(qAxis([0, 1, 0], ax), qAxis([1, 0, 0], ay)), qRef.current));
  }, []);

  useImperativeHandle(ref, () => ({
    reset: () => {
      vel.current = { x: 0, y: 0 };
      zoom.current = 1;
      tween.current = { from: qRef.current, to: initial, t0: Date.now(), dur: reduceMotion ? 1 : 700 };
      idleSince.current = Date.now();
      redraw();
    },
    show: (face) => {
      vel.current = { x: 0, y: 0 };
      tween.current = { from: qRef.current, to: faceQ(face), t0: Date.now(), dur: reduceMotion ? 1 : 800 };
      // se queda mostrando esa cara un rato antes de volver a girar
      idleSince.current = Date.now() + 4000;
      redraw();
    },
  }));

  // bucle de animación: transición a una cara, inercia, giro automático y flotación
  useEffect(() => {
    if (paused) return;
    let raf = 0;
    let prev = Date.now();
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(48, now - prev);
      prev = now;
      let changed = false;
      if (!dragging.current) {
        if (tween.current) {
          const { from, to, t0, dur } = tween.current;
          const k = Math.min(1, (now - t0) / dur);
          qRef.current = qSlerp(from, to, 1 - Math.pow(1 - k, 3));
          if (k >= 1) tween.current = null;
          changed = true;
        } else if (Math.abs(vel.current.x) + Math.abs(vel.current.y) > 0.0002) {
          spin(vel.current.x * dt, vel.current.y * dt);
          const decay = Math.pow(0.93, dt / 16);
          vel.current = { x: vel.current.x * decay, y: vel.current.y * decay };
          changed = true;
        } else if (turntable) {
          if (!reduceMotion) angle.current += spinSpeed * dt;
          qRef.current = qMul(qAxis([1, 0, 0], TURN_TILT), qAxis([0, 1, 0], angle.current));
          changed = true;
        } else if (autoRotate && !reduceMotion && now - idleSince.current > 2200) {
          spin(spinSpeed * dt, 0);
          changed = true;
        }
      }
      if (float && !reduceMotion) {
        t.current += dt;
        changed = true;
      }
      if (changed) redraw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused, autoRotate, reduceMotion, float, spinSpeed, spin, redraw, turntable]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactive && fullGestures,
        // dentro de una página con scroll, solo los arrastres horizontales giran la caja
        onMoveShouldSetPanResponder: (_, g) =>
          interactive && (fullGestures ? Math.hypot(g.dx, g.dy) > 4 : Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2),
        onPanResponderTerminationRequest: () => !fullGestures,
        onPanResponderGrant: () => {
          dragging.current = true;
          moved.current = false;
          pinch.current.start = 0;
          last.current = { dx: 0, dy: 0 };
        },
        onPanResponderMove: (e, g) => {
          const touches = e.nativeEvent.touches;
          if (fullGestures && touches && touches.length >= 2) {
            const d = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
            if (!pinch.current.start) pinch.current = { start: d, base: zoom.current };
            else zoom.current = Math.max(0.6, Math.min(2.4, (pinch.current.base * d) / pinch.current.start));
            moved.current = true;
            redraw();
            return;
          }
          if (!moved.current && Math.hypot(g.dx, g.dy) > 4) {
            moved.current = true;
            tween.current = null;
            vel.current = { x: 0, y: 0 };
            onInteractRef.current?.();
          }
          if (!moved.current) return;
          const k = 0.0105;
          spin((g.dx - last.current.dx) * k, fullGestures ? (g.dy - last.current.dy) * k : 0);
          last.current = { dx: g.dx, dy: g.dy };
          redraw();
        },
        onPanResponderRelease: (_, g) => {
          dragging.current = false;
          idleSince.current = Date.now();
          if (pinch.current.start) {
            pinch.current.start = 0;
            return;
          }
          if (!moved.current && fullGestures) {
            const now = Date.now();
            if (now - lastTap.current < 320) {
              zoom.current = 1;
              tween.current = { from: qRef.current, to: initial, t0: now, dur: 600 };
            }
            lastTap.current = now;
            return;
          }
          vel.current = { x: g.vx * 0.0105, y: fullGestures ? g.vy * 0.0105 : 0 };
        },
        onPanResponderTerminate: () => {
          dragging.current = false;
          idleSince.current = Date.now();
        },
      }),
    [interactive, fullGestures, spin, redraw, initial],
  );

  // web: el visor recibe los gestos (y la rueda del ratón en pantalla completa)
  const host = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !interactive) return;
    const el = host.current as unknown as HTMLElement | null;
    if (!el?.style) return;
    el.style.touchAction = fullGestures ? 'none' : 'pan-y';
    if (!fullGestures) return;
    el.style.overscrollBehavior = 'contain';
    const stop = (ev: Event) => ev.preventDefault();
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      zoom.current = Math.max(0.6, Math.min(2.4, zoom.current * (ev.deltaY > 0 ? 0.92 : 1.08)));
      redraw();
    };
    el.addEventListener('gesturestart', stop);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('gesturestart', stop);
      el.removeEventListener('wheel', onWheel);
    };
  }, [interactive, fullGestures, redraw]);

  // ---------- proyección ----------
  const { w, h, d } = dims;
  const diag = Math.hypot(w, h, d);
  const S = ((Math.min(W, H) * fill) / diag) * zoom.current;
  const bob = float && !reduceMotion ? Math.sin(t.current / 900) * 0.045 : 0; // en unidades de la caja
  const cx = W / 2;
  // sobre el pedestal la caja queda más arriba para dejar sitio al cilindro
  const cy = pedestal ? H * 0.4 : H / 2 - (float ? h * 0.06 * S : 0);
  const q = qRef.current;
  const P = (p: V3) => {
    const [x, y] = qRot(q, p);
    return { x: cx + x * S, y: cy - (y + bob) * S };
  };
  const corner = (face: BoxFace, u: number, v: number): V3 => {
    const x0 = -w / 2;
    const yT = h / 2;
    switch (face) {
      case 'front':
        return [x0 + u * w, yT - v * h, d / 2];
      case 'right':
        return [w / 2, yT - v * h, d / 2 - u * d];
      case 'back':
        return [w / 2 - u * w, yT - v * h, -d / 2];
      case 'left':
        return [-w / 2, yT - v * h, -d / 2 + u * d];
      case 'top':
        return [x0 + u * w, yT, -d / 2 + v * d];
      case 'bottom':
        return [x0 + u * w, -yT, d / 2 - v * d];
    }
  };
  const NORMAL: Record<BoxFace, V3> = { front: [0, 0, 1], right: [1, 0, 0], back: [0, 0, -1], left: [-1, 0, 0], top: [0, 1, 0], bottom: [0, -1, 0] };
  const order: BoxFace[] = ['front', 'right', 'back', 'left', 'top', 'bottom'];
  const faces = order
    .map((face) => {
      const n = qRot(q, NORMAL[face]);
      return { face, n };
    })
    .filter((f) => f.n[2] > 0.002);

  // silueta (para el canto y la sombra)
  const allPts = faces.flatMap(({ face }) => [P(corner(face, 0, 0)), P(corner(face, 1, 0)), P(corner(face, 1, 1)), P(corner(face, 0, 1))]);
  const minX = Math.min(...allPts.map((p) => p.x));
  const maxX = Math.max(...allPts.map((p) => p.x));
  // la sombra queda en el piso: debajo del punto más bajo de la caja sin flotación
  const floorY = cy + (Math.hypot(h / 2, Math.max(w, d) / 2) + 0.12) * S;
  const lift = Math.max(0, bob);
  const shW = (maxX - minX) * (0.62 - lift * 0.8);

  return (
    <View ref={host} style={{ width: W, height: H }} {...(interactive ? pan.panHandlers : {})}>
      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient id="pb-shadow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={colors.petroleo} stopOpacity={0.38 - lift * 1.2} />
            <Stop offset="0.6" stopColor={colors.petroleo} stopOpacity={0.12} />
            <Stop offset="1" stopColor={colors.petroleo} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="pb-gloss" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.white} stopOpacity={0.9} />
            <Stop offset="0.45" stopColor={colors.white} stopOpacity={0.15} />
            <Stop offset="1" stopColor={colors.white} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {pedestal
          ? (() => {
              const base = P([0, -h / 2, 0]);
              const rx = (Math.hypot(w, d) / 2) * 1.22 * S;
              const ry = rx * Math.sin(TURN_TILT);
              return <PedestalShape id="pb-ped" cx={base.x} top={base.y} rx={rx} ry={ry} height={Math.max(20, Math.min(H - base.y - ry - 6, rx * 0.85))} />;
            })()
          : <Ellipse cx={(minX + maxX) / 2} cy={floorY} rx={Math.max(10, shW)} ry={Math.max(4, shW * 0.16)} fill="url(#pb-shadow)" />}
        {/* canto: rellena las juntas entre caras */}
        {faces.map(({ face }) => (
          <Polygon
            key={`e-${face}`}
            points={[corner(face, 0, 0), corner(face, 1, 0), corner(face, 1, 1), corner(face, 0, 1)]
              .map(P)
              .map((p) => `${p.x},${p.y}`)
              .join(' ')}
            fill={edge}
            stroke={edge}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        ))}
        {faces.map(({ face, n }) => {
          const o = P(corner(face, 0, 0));
          const ex = P(corner(face, 1, 0));
          const ey = P(corner(face, 0, 1));
          const m = `matrix(${(ex.x - o.x) / 100} ${(ex.y - o.y) / 100} ${(ey.x - o.x) / 100} ${(ey.y - o.y) / 100} ${o.x} ${o.y})`;
          const lambert = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
          const dark = Math.max(0, 0.82 - lambert) * 0.5; // sombra suave en las caras alejadas de la luz
          const spec = Math.pow(Math.max(0, n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2]), 18);
          return (
            <G key={face} transform={m}>
              <SvgImage href={textures[face]} x={0} y={0} width={100} height={100} preserveAspectRatio="none" />
              {dark > 0.01 ? <Rect x={0} y={0} width={100} height={100} fill={colors.petroleo} fillOpacity={dark} /> : null}
              {spec > 0.02 ? <Rect x={0} y={0} width={100} height={100} fill="url(#pb-gloss)" fillOpacity={spec * 0.35} /> : null}
              <Rect x={0} y={0} width={100} height={100} fill="none" stroke={colors.white} strokeOpacity={0.28} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
            </G>
          );
        })}
      </Svg>
    </View>
  );
});
