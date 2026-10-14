import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, Text, View } from 'react-native';
import Svg, { G, Polygon, Text as SvgText } from 'react-native-svg';
import type { Hotspot, Product } from '@/data/mock';
import { colors, font, radius, space, type } from '@/theme';

// Visor 3D simulado: una caja de producto dibujada con proyección en perspectiva.
// Gira 360° en cualquier dirección (arrastre libre tipo "trackball"), con inercia,
// giro automático y puntos interactivos con texto.
// Es una representación ilustrativa para el prototipo (no un modelo 3D real ni Vectary).

type FaceName = 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom';
type V3 = [number, number, number];
type Q = [number, number, number, number]; // cuaternión [w, x, y, z]

const A = 1.0; // ancho
const B = 0.46; // profundidad
const HH = 1.5; // alto
const DIST = 4.4; // distancia de cámara (perspectiva)

const FACES: Record<FaceName, { n: V3; corner: (u: number, v: number) => V3 }> = {
  front: { n: [0, 0, 1], corner: (u, v) => [-A / 2 + u * A, HH / 2 - v * HH, B / 2] },
  right: { n: [1, 0, 0], corner: (u, v) => [A / 2, HH / 2 - v * HH, B / 2 - u * B] },
  back: { n: [0, 0, -1], corner: (u, v) => [A / 2 - u * A, HH / 2 - v * HH, -B / 2] },
  left: { n: [-1, 0, 0], corner: (u, v) => [-A / 2, HH / 2 - v * HH, -B / 2 + u * B] },
  top: { n: [0, 1, 0], corner: (u, v) => [-A / 2 + u * A, HH / 2, -B / 2 + v * B] },
  bottom: { n: [0, -1, 0], corner: (u, v) => [-A / 2 + u * A, -HH / 2, B / 2 - v * B] },
};

// ---------- cuaterniones ----------
const qAxis = (ax: V3, ang: number): Q => {
  const s = Math.sin(ang / 2);
  return [Math.cos(ang / 2), ax[0] * s, ax[1] * s, ax[2] * s];
};
const qMul = (a: Q, b: Q): Q => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
const qNorm = (q: Q): Q => {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
};
const qRot = (q: Q, v: V3): V3 => {
  const [w, x, y, z] = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
};
const qSlerp = (a: Q, b: Q, t: number): Q => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (d < 0) {
    d = -d;
    bb = [-b[0], -b[1], -b[2], -b[3]];
  }
  if (d > 0.9995) return qNorm([a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t]);
  const th = Math.acos(d);
  const s1 = Math.sin((1 - t) * th) / Math.sin(th);
  const s2 = Math.sin(t * th) / Math.sin(th);
  return [a[0] * s1 + bb[0] * s2, a[1] * s1 + bb[1] * s2, a[2] * s1 + bb[2] * s2, a[3] * s1 + bb[3] * s2];
};

// vista de reposo: un poco desde arriba y de lado, para que se perciba el volumen
const VIEW: Q = qMul(qAxis([1, 0, 0], 0.32), qAxis([0, 1, 0], -0.45));
// orientación que deja cada cara de frente (más la inclinación de vista)
const FACE_Q: Record<FaceName, Q> = {
  front: VIEW,
  right: qMul(VIEW, qAxis([0, 1, 0], -Math.PI / 2)),
  back: qMul(VIEW, qAxis([0, 1, 0], Math.PI)),
  left: qMul(VIEW, qAxis([0, 1, 0], Math.PI / 2)),
  top: qMul(qAxis([1, 0, 0], 0.35), qMul(qAxis([1, 0, 0], Math.PI / 2), qAxis([0, 1, 0], -0.45))),
  bottom: qMul(qAxis([1, 0, 0], -0.35), qMul(qAxis([1, 0, 0], -Math.PI / 2), qAxis([0, 1, 0], -0.45))),
};

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export interface Product3DHandle {
  reset: () => void;
}

export const Product3D = forwardRef<
  Product3DHandle,
  {
    product: Product;
    size?: number;
    width?: number; // para ocupar un área no cuadrada (pantalla completa)
    height?: number;
    fullGestures?: boolean; // pellizcar para zoom, doble toque para restablecer, toque para cerrar el punto
    autoRotate?: boolean;
    interactive?: boolean;
    zoom?: number;
    active?: number | null; // punto seleccionado (controlado por la pantalla)
    onActiveChange?: (i: number | null) => void;
  }
>(function Product3D(
  { product, size = 300, width, height, fullGestures = false, autoRotate = true, interactive = true, zoom = 1, active = null, onActiveChange },
  ref,
) {
  const W = width ?? size;
  const H = height ?? size;
  const [q, setQState] = useState<Q>(VIEW);
  const qRef = useRef<Q>(VIEW);
  const dragging = useRef(false);
  const vel = useRef({ x: 0, y: 0 }); // velocidad angular (rad/ms) en ejes de pantalla
  const last = useRef({ dx: 0, dy: 0 });
  const tween = useRef<{ from: Q; to: Q; t0: number; dur: number } | null>(null);
  const idleSince = useRef(Date.now());
  const [hint, setHint] = useState(true);
  const [pinch, setPinch] = useState(1);
  const pinchRef = useRef({ start: 0, base: 1 });
  const lastTap = useRef(0);
  const pinchNow = useRef(1);
  const onActiveRef = useRef(onActiveChange);
  onActiveRef.current = onActiveChange;
  useEffect(() => {
    pinchNow.current = pinch;
  }, [pinch]);
  const moved = useRef(false);
  // escala de unidades a píxeles (en pantalla completa el modelo ocupa buena parte de la pantalla)
  const S = (fullGestures ? Math.min(W * 0.52, H * 0.3) : Math.min(W, H) * 0.33) * zoom * pinch;
  const cx = W / 2;
  const cy = H / 2;
  const clampZoom = (z: number) => Math.max(0.6, Math.min(2.2, z));

  const setQ = useCallback((nq: Q) => {
    qRef.current = nq;
    setQState(nq);
  }, []);

  // giro en ejes de pantalla: horizontal → eje vertical; vertical → eje horizontal
  const spin = useCallback(
    (ax: number, ay: number) => setQ(qNorm(qMul(qMul(qAxis([0, 1, 0], ax), qAxis([1, 0, 0], ay)), qRef.current))),
    [setQ],
  );

  useImperativeHandle(ref, () => ({
    reset: () => {
      vel.current = { x: 0, y: 0 };
      setPinch(1);
      tween.current = { from: qRef.current, to: VIEW, t0: Date.now(), dur: 600 };
    },
  }));

  // bucle de animación: transición hacia un punto, inercia y giro automático
  useEffect(() => {
    let raf = 0;
    let prev = Date.now();
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(48, now - prev);
      prev = now;
      if (!dragging.current) {
        if (tween.current) {
          const { from, to, t0, dur } = tween.current;
          const k = Math.min(1, (now - t0) / dur);
          setQ(qSlerp(from, to, 1 - Math.pow(1 - k, 3)));
          if (k >= 1) tween.current = null;
        } else if (Math.abs(vel.current.x) + Math.abs(vel.current.y) > 0.0003) {
          spin(vel.current.x * dt, vel.current.y * dt);
          const decay = Math.pow(0.94, dt / 16);
          vel.current = { x: vel.current.x * decay, y: vel.current.y * decay };
        } else if (autoRotate && active === null && now - idleSince.current > 2000) {
          spin(0.00045 * dt, 0);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [autoRotate, active, setQ, spin]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactive && fullGestures,
        onMoveShouldSetPanResponder: (_, g) => interactive && Math.hypot(g.dx, g.dy) > 4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragging.current = true;
          moved.current = false;
          pinchRef.current.start = 0;
          last.current = { dx: 0, dy: 0 };
        },
        onPanResponderMove: (e, g) => {
          const touches = e.nativeEvent.touches;
          if (fullGestures && touches && touches.length >= 2) {
            // pellizcar para acercar o alejar
            const d = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
            if (!pinchRef.current.start) pinchRef.current = { start: d, base: pinchRef.current.base };
            else setPinch(clampZoom((pinchRef.current.base * d) / pinchRef.current.start));
            moved.current = true;
            return;
          }
          if (Math.hypot(g.dx, g.dy) > 4 && !moved.current) {
            moved.current = true;
            tween.current = null;
            vel.current = { x: 0, y: 0 };
            setHint(false);
          }
          if (!moved.current) return;
          const k = 0.011;
          spin((g.dx - last.current.dx) * k, (g.dy - last.current.dy) * k);
          last.current = { dx: g.dx, dy: g.dy };
        },
        onPanResponderRelease: (_, g) => {
          dragging.current = false;
          idleSince.current = Date.now();
          if (pinchRef.current.start) {
            pinchRef.current = { start: 0, base: pinchNow.current };
            return;
          }
          if (!moved.current && fullGestures) {
            // toque: doble toque restablece; toque simple cierra el punto abierto
            const now = Date.now();
            if (now - lastTap.current < 320) {
              vel.current = { x: 0, y: 0 };
              setPinch(1);
              pinchRef.current.base = 1;
              tween.current = { from: qRef.current, to: VIEW, t0: now, dur: 600 };
              onActiveRef.current?.(null);
            } else onActiveRef.current?.(null);
            lastTap.current = now;
            return;
          }
          vel.current = { x: g.vx * 0.011, y: g.vy * 0.011 };
        },
        onPanResponderTerminate: () => {
          dragging.current = false;
          idleSince.current = Date.now();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interactive, spin, fullGestures],
  );

  // rueda del ratón para acercar en la versión web
  const host = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !fullGestures) return;
    const el = host.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      setHint(false);
      setPinch((z) => {
        const nz = clampZoom(z * (ev.deltaY > 0 ? 0.92 : 1.08));
        pinchRef.current.base = nz;
        return nz;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [fullGestures]);

  const hotspots = product.hotspots ?? [];

  // al cambiar el punto seleccionado, la caja gira hasta dejar esa cara de frente
  useEffect(() => {
    if (active === null || !hotspots[active]) {
      idleSince.current = Date.now();
      return;
    }
    setHint(false);
    vel.current = { x: 0, y: 0 };
    tween.current = { from: qRef.current, to: FACE_Q[hotspots[active].face], t0: Date.now(), dur: 700 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, product.id]);

  const project = (p: V3) => {
    const [x, y, z] = qRot(q, p);
    const f = DIST / (DIST - z);
    return { x: cx + x * f * S, y: cy - y * f * S };
  };
  const facing = (face: FaceName) => qRot(q, FACES[face].n)[2];
  const pt = (face: FaceName, u: number, v: number) => project(FACES[face].corner(u, v));
  const poly = (face: FaceName, u0 = 0, v0 = 0, u1 = 1, v1 = 1) =>
    [pt(face, u0, v0), pt(face, u1, v0), pt(face, u1, v1), pt(face, u0, v1)].map((p) => `${p.x},${p.y}`).join(' ');
  // matriz afín para escribir texto sobre una zona de una cara (sistema local 100x100)
  const textMatrix = (face: FaceName, u0: number, v0: number, u1: number, v1: number) => {
    const o = pt(face, u0, v0);
    const ex = pt(face, u1, v0);
    const ey = pt(face, u0, v1);
    return `matrix(${(ex.x - o.x) / 100} ${(ex.y - o.y) / 100} ${(ey.x - o.x) / 100} ${(ey.y - o.y) / 100} ${o.x} ${o.y})`;
  };

  const base = product.hue === colors.turquesa ? colors.primary : product.hue;
  const light = (face: FaceName) => {
    const [nx, ny, nz] = qRot(q, FACES[face].n);
    return 0.3 * nx + 0.28 * ny + 0.12 * nz - 0.08; // luz desde arriba a la derecha
  };
  const fill = (face: FaceName) =>
    face === 'top' || face === 'bottom' ? shade(colors.petroleo, 0.18 + light(face) * 0.4) : shade(base, light(face));

  const visibleFaces = (Object.keys(FACES) as FaceName[]).filter((f) => facing(f) > 0.01);
  const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

  return (
    <View ref={host} style={{ width: W, height: H, alignSelf: 'center' }} {...pan.panHandlers}>
      <Svg width={W} height={H}>
        {visibleFaces.map((face) => (
          <G key={face}>
            <Polygon points={poly(face)} fill={fill(face)} stroke={shade(base, -0.3)} strokeWidth={0.6} strokeOpacity={0.35} />
            {face === 'front' && facing('front') > 0.2 ? (
              <>
                <Polygon points={poly('front', 0.08, 0.3, 0.92, 0.66)} fill="#FFFFFF" />
                <Polygon points={poly('front', 0, 0.9, 1, 1)} fill={colors.turquesa} />
                <G transform={textMatrix('front', 0.08, 0.3, 0.92, 0.66)}>
                  <SvgText x={8} y={30} fontSize={11.5} fontFamily={font.bold} fill={colors.petroleo}>
                    {product.name.split(' ')[0]}
                  </SvgText>
                  <SvgText x={8} y={52} fontSize={10} fontFamily={font.semibold} fill={colors.primary}>
                    {product.name.split(' ').slice(1).join(' ') || product.category}
                  </SvgText>
                  <SvgText x={8} y={78} fontSize={8} fontFamily={font.medium} fill={colors.inkMuted}>
                    {product.form.split('·')[1]?.trim() ?? product.form}
                  </SvgText>
                </G>
                <G transform={textMatrix('front', 0.08, 0.08, 0.92, 0.24)}>
                  <SvgText x={0} y={55} fontSize={22} fontFamily={font.bold} fill="#FFFFFF">
                    {product.lab}
                  </SvgText>
                </G>
                <G transform={textMatrix('front', 0.08, 0.72, 0.92, 0.86)}>
                  <SvgText x={0} y={62} fontSize={8} fontFamily={font.bold} fill="#FFFFFF" fillOpacity={0.9}>
                    PRODUCTO FICTICIO
                  </SvgText>
                </G>
              </>
            ) : null}
            {face === 'back' && facing('back') > 0.25 ? (
              <G transform={textMatrix('back', 0.1, 0.1, 0.9, 0.9)}>
                <SvgText x={0} y={8} fontSize={6.5} fontFamily={font.bold} fill="#FFFFFF">
                  MODO DE USO
                </SvgText>
                {product.howTo.slice(0, 3).map((h, i) => (
                  <SvgText key={i} x={0} y={20 + i * 10} fontSize={4.6} fontFamily={font.medium} fill="#FFFFFF" fillOpacity={0.9}>
                    {`${i + 1}. ${clip(h, 34)}`}
                  </SvgText>
                ))}
                <SvgText x={0} y={64} fontSize={6.5} fontFamily={font.bold} fill="#FFFFFF">
                  PRECAUCIONES
                </SvgText>
                {product.precautions.slice(0, 2).map((h, i) => (
                  <SvgText key={i} x={0} y={76 + i * 10} fontSize={4.6} fontFamily={font.medium} fill="#FFFFFF" fillOpacity={0.9}>
                    {`• ${clip(h, 34)}`}
                  </SvgText>
                ))}
              </G>
            ) : null}
            {(face === 'right' || face === 'left') && facing(face) > 0.3 ? (
              <G transform={textMatrix(face, 0.15, 0.2, 0.85, 0.8)}>
                <SvgText x={50} y={20} fontSize={9} textAnchor="middle" fontFamily={font.bold} fill="#FFFFFF">
                  {face === 'right' ? 'MULTI' : 'LAB'}
                </SvgText>
                <SvgText x={50} y={36} fontSize={6} textAnchor="middle" fontFamily={font.medium} fill="#FFFFFF" fillOpacity={0.85}>
                  {face === 'right' ? product.category : 'demo'}
                </SvgText>
              </G>
            ) : null}
            {face === 'bottom' && facing('bottom') > 0.3 ? (
              <G transform={textMatrix('bottom', 0.1, 0.15, 0.9, 0.85)}>
                <SvgText x={50} y={45} fontSize={9} textAnchor="middle" fontFamily={font.bold} fill="#FFFFFF" fillOpacity={0.85}>
                  LOTE DEMO-0001
                </SvgText>
                <SvgText x={50} y={70} fontSize={7} textAnchor="middle" fontFamily={font.medium} fill="#FFFFFF" fillOpacity={0.7}>
                  Prototipo académico
                </SvgText>
              </G>
            ) : null}
          </G>
        ))}
      </Svg>

      {/* puntos interactivos */}
      {(interactive ? hotspots : []).map((h, i) => {
        if (facing(h.face) < 0.2) return null;
        const p = pt(h.face, h.u, h.v);
        return <HotspotDot key={i} n={i + 1} x={p.x} y={p.y} active={active === i} onPress={() => onActiveChange?.(active === i ? null : i)} />;
      })}

      {hint && interactive ? (
        <View style={{ position: 'absolute', bottom: fullGestures ? 28 : 4, left: 0, right: 0, alignItems: 'center' }} pointerEvents="none">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.border }}>
            <Ionicons name="move-outline" size={14} color={colors.primary} />
            <Text style={[type.caption, { color: colors.ink }]}>
              {fullGestures ? 'Arrastra para girar · pellizca para acercar · toca los puntos' : 'Arrastra en cualquier dirección · toca los puntos'}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
});

function HotspotDot({ n, x, y, active, onPress }: { n: number; x: number; y: number; active: boolean; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  useEffect(() => {
    Animated.spring(pop, { toValue: active ? 1 : 0, friction: 5, tension: 140, useNativeDriver: true }).start();
  }, [active, pop]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Punto ${n}`}
      hitSlop={10}
      style={{ position: 'absolute', left: x - 14, top: y - 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.turquesa,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.8] }) }],
        }}
      />
      <Animated.View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: active ? colors.petroleo : colors.white,
          borderWidth: 2,
          borderColor: active ? colors.turquesa : colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }],
        }}
      >
        <Text style={{ fontFamily: font.bold, fontSize: 11, color: active ? colors.white : colors.primary }}>{n}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** Tarjeta con el texto del punto seleccionado, con animación de entrada */
export function HotspotCard({ hotspot, index, onClose }: { hotspot: Hotspot | null; index: number; onClose: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(hotspot);
  useEffect(() => {
    if (hotspot) {
      setShown(hotspot);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setShown(null));
    }
  }, [hotspot, anim]);
  if (!shown) return null;
  return (
    <Animated.View
      style={{
        backgroundColor: colors.petroleo,
        borderRadius: radius.lg,
        padding: space.lg,
        gap: space.sm,
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
        ],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.turquesa, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.petroleo }}>{index + 1}</Text>
        </View>
        <Text style={[type.h3, { color: colors.white, flex: 1 }]}>{shown.title}</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={8}>
          <Ionicons name="close" size={20} color="#B9CCD0" />
        </Pressable>
      </View>
      <Text style={[type.body, { color: '#D5E2E5' }]}>{shown.text}</Text>
    </Animated.View>
  );
}
