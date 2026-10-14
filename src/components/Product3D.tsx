import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, Text, View } from 'react-native';
import Svg, { G, Polygon, Text as SvgText } from 'react-native-svg';
import type { Hotspot, Product } from '@/data/mock';
import { colors, font, radius, space, type } from '@/theme';

// Visor 3D simulado: una caja de producto dibujada con proyección en perspectiva.
// Se gira arrastrando, rota sola cuando está quieta y tiene puntos interactivos con texto.
// Es una representación ilustrativa para el prototipo (no un modelo 3D real ni Vectary).

type Face = 'front' | 'right' | 'back' | 'left' | 'top';
type V3 = [number, number, number];

const A = 1.0; // ancho
const B = 0.46; // profundidad
const HH = 1.5; // alto
const PITCH = -0.34; // cámara ligeramente desde arriba
const DIST = 4.2; // distancia de cámara (perspectiva)

// esquinas de cada cara en orden, y su normal
const FACES: Record<Face, { n: V3; corner: (u: number, v: number) => V3 }> = {
  front: { n: [0, 0, 1], corner: (u, v) => [-A / 2 + u * A, HH / 2 - v * HH, B / 2] },
  right: { n: [1, 0, 0], corner: (u, v) => [A / 2, HH / 2 - v * HH, B / 2 - u * B] },
  back: { n: [0, 0, -1], corner: (u, v) => [A / 2 - u * A, HH / 2 - v * HH, -B / 2] },
  left: { n: [-1, 0, 0], corner: (u, v) => [-A / 2, HH / 2 - v * HH, -B / 2 + u * B] },
  top: { n: [0, 1, 0], corner: (u, v) => [-A / 2 + u * A, HH / 2, -B / 2 + v * B] },
};

// ángulo de giro que deja cada cara de frente a la cámara
const FACE_ANGLE: Record<Face, number> = { front: 0, right: -Math.PI / 2, back: Math.PI, left: Math.PI / 2, top: 0 };

function rotate([x, y, z]: V3, yaw: number): V3 {
  const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
  const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
  const y2 = y * Math.cos(PITCH) - z1 * Math.sin(PITCH);
  const z2 = y * Math.sin(PITCH) + z1 * Math.cos(PITCH);
  return [x1, y2, z2];
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

export function Product3D({
  product,
  size = 300,
  autoRotate = true,
  interactive = true,
  active = null,
  onActiveChange,
}: {
  product: Product;
  size?: number;
  autoRotate?: boolean;
  interactive?: boolean;
  active?: number | null; // punto seleccionado (controlado por la pantalla)
  onActiveChange?: (i: number | null) => void;
}) {
  const [yaw, setYaw] = useState(-0.55);
  const yawRef = useRef(-0.55);
  const dragging = useRef(false);
  const velocity = useRef(0);
  const tween = useRef<{ from: number; to: number; t0: number; dur: number } | null>(null);
  const idleSince = useRef(Date.now());
  const lastDx = useRef(0);
  const [hint, setHint] = useState(true);
  const S = size * 0.36; // escala de unidades a píxeles
  const cx = size / 2;
  const cy = size * 0.53;

  const setAngle = useCallback((a: number) => {
    yawRef.current = a;
    setYaw(a);
  }, []);

  // bucle de animación: inercia, giro hacia un punto y giro automático
  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(48, now - last);
      last = now;
      if (!dragging.current) {
        if (tween.current) {
          const { from, to, t0, dur } = tween.current;
          const k = Math.min(1, (now - t0) / dur);
          const e = 1 - Math.pow(1 - k, 3);
          setAngle(from + (to - from) * e);
          if (k >= 1) tween.current = null;
        } else if (Math.abs(velocity.current) > 0.0004) {
          setAngle(yawRef.current + velocity.current * dt);
          velocity.current *= Math.pow(0.94, dt / 16);
        } else if (autoRotate && active === null && now - idleSince.current > 1800) {
          setAngle(yawRef.current + 0.00045 * dt);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [autoRotate, active, setAngle]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => interactive && Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragging.current = true;
          tween.current = null;
          velocity.current = 0;
          setHint(false);
        },
        onPanResponderMove: (_, g) => {
          setAngle(yawRef.current + (g.dx - lastDx.current) * 0.012);
          lastDx.current = g.dx;
        },
        onPanResponderRelease: (_, g) => {
          lastDx.current = 0;
          dragging.current = false;
          velocity.current = g.vx * 0.012; // radianes por milisegundo
          idleSince.current = Date.now();
        },
        onPanResponderTerminate: () => {
          lastDx.current = 0;
          dragging.current = false;
          idleSince.current = Date.now();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interactive],
  );

  const project = (p: V3) => {
    const [x, y, z] = rotate(p, yaw);
    const f = DIST / (DIST - z);
    return { x: cx + x * f * S, y: cy - y * f * S, z };
  };
  const visible = (face: Face) => rotate(FACES[face].n, yaw)[2];
  const pt = (face: Face, u: number, v: number) => project(FACES[face].corner(u, v));
  const poly = (face: Face, u0 = 0, v0 = 0, u1 = 1, v1 = 1) =>
    [pt(face, u0, v0), pt(face, u1, v0), pt(face, u1, v1), pt(face, u0, v1)].map((p) => `${p.x},${p.y}`).join(' ');

  // matriz afín para escribir texto sobre una cara (zona u0..u1, v0..v1 en un sistema local 100x100)
  const textMatrix = (face: Face, u0: number, v0: number, u1: number, v1: number) => {
    const o = pt(face, u0, v0);
    const ex = pt(face, u1, v0);
    const ey = pt(face, u0, v1);
    return `matrix(${(ex.x - o.x) / 100} ${(ex.y - o.y) / 100} ${(ey.x - o.x) / 100} ${(ey.y - o.y) / 100} ${o.x} ${o.y})`;
  };

  const base = product.hue === colors.turquesa ? colors.primary : product.hue;
  const light = (face: Face) => {
    const [nx, ny, nz] = rotate(FACES[face].n, yaw);
    return 0.35 * nx + 0.25 * ny + 0.15 * nz - 0.1; // luz desde la derecha y arriba
  };

  const order: Face[] = (['back', 'left', 'right', 'front', 'top'] as Face[])
    .filter((f) => visible(f) > 0.01)
    .sort((a, b) => visible(a) - visible(b));

  const faceFill: Record<Face, string> = {
    front: shade(base, light('front')),
    right: shade(base, light('right') - 0.12),
    back: shade(base, light('back')),
    left: shade(base, light('left') - 0.12),
    top: shade(colors.petroleo, 0.15 + light('top') * 0.4),
  };

  const hotspots = product.hotspots ?? [];

  // al cambiar el punto seleccionado, la caja gira hasta dejar esa cara de frente
  useEffect(() => {
    if (active === null || !hotspots[active]) {
      idleSince.current = Date.now();
      return;
    }
    setHint(false);
    // se deja la cara un poco girada para que se siga percibiendo el volumen
    const target = FACE_ANGLE[hotspots[active].face] - 0.4;
    const from = yawRef.current;
    // camino más corto
    const d = ((((target - from) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    velocity.current = 0;
    tween.current = { from, to: from + d, t0: Date.now(), dur: 650 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, product.id]);

  const goTo = (i: number | null) => onActiveChange?.(i);

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }} {...pan.panHandlers}>
      <Svg width={size} height={size}>
        {/* sombra en el piso */}
        <Polygon
          points={[
            project([-A * 0.75, -HH / 2 - 0.02, B]),
            project([A * 0.75, -HH / 2 - 0.02, B]),
            project([A * 0.75, -HH / 2 - 0.02, -B]),
            project([-A * 0.75, -HH / 2 - 0.02, -B]),
          ]
            .map((p) => `${p.x},${p.y + 6}`)
            .join(' ')}
          fill={colors.petroleo}
          fillOpacity={0.08}
        />
        {order.map((face) => (
          <G key={face}>
            <Polygon points={poly(face)} fill={faceFill[face]} stroke={shade(base, -0.25)} strokeWidth={0.6} strokeOpacity={0.4} />
            {face === 'front' && visible('front') > 0.2 ? (
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
                  <SvgText x={0} y={64} fontSize={10.5} fontFamily={font.bold} fill="#FFFFFF" fillOpacity={0.9}>
                    PRODUCTO FICTICIO
                  </SvgText>
                </G>
              </>
            ) : null}
            {face === 'back' && visible('back') > 0.25 ? (
              <G transform={textMatrix('back', 0.1, 0.1, 0.9, 0.9)}>
                <SvgText x={0} y={8} fontSize={6.5} fontFamily={font.bold} fill="#FFFFFF">
                  MODO DE USO
                </SvgText>
                {product.howTo.slice(0, 3).map((h, i) => (
                  <SvgText key={i} x={0} y={20 + i * 10} fontSize={4.6} fontFamily={font.medium} fill="#FFFFFF" fillOpacity={0.9}>
                    {`${i + 1}. ${h.length > 34 ? `${h.slice(0, 33)}…` : h}`}
                  </SvgText>
                ))}
                <SvgText x={0} y={64} fontSize={6.5} fontFamily={font.bold} fill="#FFFFFF">
                  PRECAUCIONES
                </SvgText>
                {product.precautions.slice(0, 2).map((h, i) => (
                  <SvgText key={i} x={0} y={76 + i * 10} fontSize={4.6} fontFamily={font.medium} fill="#FFFFFF" fillOpacity={0.9}>
                    {`• ${h.length > 34 ? `${h.slice(0, 33)}…` : h}`}
                  </SvgText>
                ))}
              </G>
            ) : null}
            {(face === 'right' || face === 'left') && visible(face) > 0.3 ? (
              <G transform={textMatrix(face, 0.15, 0.2, 0.85, 0.8)}>
                <SvgText x={50} y={20} fontSize={9} textAnchor="middle" fontFamily={font.bold} fill="#FFFFFF">
                  {face === 'right' ? 'MULTI' : 'LAB'}
                </SvgText>
                <SvgText x={50} y={36} fontSize={6} textAnchor="middle" fontFamily={font.medium} fill="#FFFFFF" fillOpacity={0.85}>
                  {face === 'right' ? product.category : 'demo'}
                </SvgText>
              </G>
            ) : null}
          </G>
        ))}
      </Svg>

      {/* puntos interactivos */}
      {(interactive ? hotspots : []).map((h, i) => {
        const vis = visible(h.face);
        if (vis < 0.2) return null;
        const p = pt(h.face, h.u, h.v);
        return <HotspotDot key={i} n={i + 1} x={p.x} y={p.y} active={active === i} onPress={() => goTo(active === i ? null : i)} />;
      })}

      {hint && interactive ? (
        <View style={{ position: 'absolute', bottom: 4, left: 0, right: 0, alignItems: 'center' }} pointerEvents="none">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.border }}>
            <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
            <Text style={[type.caption, { color: colors.ink }]}>Arrastra para girar · toca los puntos</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function HotspotDot({ n, x, y, active, onPress }: { n: number; x: number; y: number; active: boolean; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
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
