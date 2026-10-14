import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Signature } from '@/data/mock';
import { colors, font, radius, space, type } from '@/theme';

// ---------- Tiempo ----------
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function formatClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}

export const hourLabel = (t: number) =>
  new Date(t).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });

// ---------- Punto que late (estado "en vivo") ----------
export function LiveDot({ color = colors.turquesa, size = 10 }: { color?: string; size?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1400, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
          transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

// ---------- Contador con botones + / − ----------
export function Counter({
  value,
  onChange,
  max,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  max: number;
  label: string;
}) {
  const bump = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    bump.setValue(1.35);
    Animated.spring(bump, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 12 }).start();
  }, [value, bump]);

  const btn = (icon: 'remove' | 'add', disabled: boolean, next: number, a11y: string) => (
    <Pressable
      onPress={() => !disabled && onChange(next)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: icon === 'add' ? colors.primary : colors.primarySoft,
        opacity: disabled ? 0.35 : pressed ? 0.75 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={icon === 'add' ? colors.white : colors.primary} />
    </Pressable>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {btn('remove', value <= 0, value - 1, `Quitar ${label}`)}
      <Animated.Text
        accessibilityLabel={`${value} ${label}`}
        style={{ minWidth: 30, textAlign: 'center', fontFamily: font.bold, fontSize: 18, color: value ? colors.ink : colors.inkSubtle, transform: [{ scale: bump }] }}
      >
        {value}
      </Animated.Text>
      {btn('add', value >= max, value + 1, `Agregar ${label}`)}
    </View>
  );
}

// ---------- Firma con el dedo ----------
const toPath = (pts: { x: number; y: number }[]) => {
  if (!pts.length) return '';
  if (pts.length === 1) return `M${pts[0].x} ${pts[0].y} l0.1 0.1`;
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  // curvas suaves por puntos medios
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
};

export function SignaturePad({
  paths,
  onChange,
  onSize,
  onDrawing,
  height = 240,
}: {
  paths: string[];
  onChange: (paths: string[]) => void;
  onSize?: (w: number, h: number) => void;
  /** avisa cuando empieza y termina un trazo (para pausar el scroll de la pantalla) */
  onDrawing?: (drawing: boolean) => void;
  height?: number;
}) {
  const [current, setCurrent] = useState('');
  const pts = useRef<{ x: number; y: number }[]>([]);
  const pathsRef = useRef(paths);
  pathsRef.current = paths;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const drawingRef = useRef(onDrawing);
  drawingRef.current = onDrawing;

  const point = (e: GestureResponderEvent) => ({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        drawingRef.current?.(true);
        pts.current = [point(e)];
        setCurrent(toPath(pts.current));
      },
      onPanResponderMove: (e) => {
        const p = point(e);
        const last = pts.current[pts.current.length - 1];
        if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1.5) return;
        pts.current.push(p);
        setCurrent(toPath(pts.current));
      },
      onPanResponderTerminate: () => {
        drawingRef.current?.(false);
      },
      onPanResponderRelease: () => {
        drawingRef.current?.(false);
        const d = toPath(pts.current);
        pts.current = [];
        setCurrent('');
        if (d) onChangeRef.current([...pathsRef.current, d]);
      },
    }),
  ).current;

  const empty = !paths.length && !current;
  const webStyle = Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none', cursor: 'crosshair' } as object) : null;

  return (
    <View
      onLayout={(e) => onSize?.(e.nativeEvent.layout.width, e.nativeEvent.layout.height)}
      style={{
        height,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1.5,
        borderColor: empty ? colors.borderStrong : colors.primary,
        borderStyle: 'dashed',
        overflow: 'hidden',
      }}
    >
      {empty ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Ionicons name="finger-print-outline" size={30} color={colors.inkSubtle} />
          <Text style={[type.bodyMuted, { textAlign: 'center' }]}>Firma aquí con el dedo</Text>
        </View>
      ) : null}
      <View pointerEvents="none" style={{ position: 'absolute', left: space.xl, right: space.xl, bottom: 44, height: 1, backgroundColor: colors.border }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Svg width="100%" height="100%">
          {[...paths, current].filter(Boolean).map((d, i) => (
            <Path key={i} d={d} stroke={colors.ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
        </Svg>
      </View>
      {/* capa vacía encima de todo: recibe el dedo y da coordenadas siempre relativas al área */}
      <View
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, webStyle]}
        accessibilityLabel="Área de firma. Dibuja tu firma con el dedo."
        {...pan.panHandlers}
      />
    </View>
  );
}

/** Muestra una firma guardada, escalada al ancho disponible */
export function SignatureView({ signature, height = 110 }: { signature: Signature; height?: number }) {
  return (
    <View style={{ height, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${signature.w} ${signature.h}`} preserveAspectRatio="xMidYMid meet">
        {signature.paths.map((d, i) => (
          <Path key={i} d={d} stroke={colors.ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ))}
      </Svg>
    </View>
  );
}
