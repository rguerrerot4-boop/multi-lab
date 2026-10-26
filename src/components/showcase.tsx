// Piezas de la ficha del producto (estilo de las referencias): texto gigante en movimiento, trazos,
// bordes de papel rasgado, líneas topográficas, pedestal, manchas de tinta y la caja 3D.
import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { PhotoBox3D, type BoxFace, type BoxTextures, type PhotoBox3DHandle } from '@/components/PhotoBox3D';
import { Product3D } from '@/components/Product3D';
import type { FichaPal } from '@/data/ficha';
import type { Product } from '@/data/mock';
import { colors, font, radius, space } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
export const FACE_LABEL: Record<BoxFace, string> = { front: 'Frente', left: 'Izquierda', back: 'Reverso', right: 'Derecha', top: 'Tapa', bottom: 'Base' };

export const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

export function useReduceMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setR)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setR);
    return () => sub.remove();
  }, []);
  return r;
}

// ---------- caja 3D: fotos del empaque o caja dibujada del producto ficticio ----------
export interface ShowBoxHandle {
  show: (f: BoxFace) => void;
  reset: () => void;
}

export const ShowBox = forwardRef<
  ShowBoxHandle,
  {
    product: Product;
    textures?: BoxTextures;
    width: number;
    height: number;
    fill?: number;
    float?: boolean;
    interactive?: boolean;
    fullGestures?: boolean;
    autoRotate?: boolean;
    paused?: boolean;
    reduce?: boolean;
    spin?: number;
    edge?: string;
    onInteract?: () => void;
    turntable?: boolean;
    pedestal?: boolean;
  }
>(function ShowBox({ product, textures, width, height, fill = 0.6, float = true, interactive = true, fullGestures, autoRotate = true, paused, reduce, spin, edge, onInteract, turntable, pedestal }, ref) {
  const photo = useRef<PhotoBox3DHandle>(null);
  const [active, setActive] = useState<number | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  useImperativeHandle(ref, () => ({
    show: (f) => {
      if (textures) return photo.current?.show(f);
      const i = (product.hotspots ?? []).findIndex((h) => h.face === f);
      setActive(i >= 0 ? i : null);
      if (hold.current) clearTimeout(hold.current);
      if (autoRotate) hold.current = setTimeout(() => setActive(null), 4000);
    },
    reset: () => (textures ? photo.current?.reset() : setActive(null)),
  }));
  useEffect(() => () => void (hold.current && clearTimeout(hold.current)), []);
  if (textures) {
    return (
      <PhotoBox3D
        ref={photo}
        textures={textures}
        dims={product.photo?.dims}
        width={width}
        height={height}
        fill={fill}
        float={float}
        interactive={interactive}
        fullGestures={fullGestures}
        autoRotate={autoRotate}
        paused={paused}
        reduceMotion={reduce}
        spinSpeed={spin}
        edge={edge}
        onInteract={onInteract}
        turntable={turntable}
        pedestal={pedestal}
      />
    );
  }
  // la caja dibujada ocupa ~0,6 del lado menor con zoom 1
  return (
    <View style={{ width, height }}>
      <Product3D
        product={product}
        width={width}
        height={height}
        zoom={fill / 0.6}
        interactive={!!fullGestures}
        fullGestures={fullGestures}
        autoRotate={autoRotate && !reduce}
        active={active}
        onActiveChange={setActive}
        paused={paused}
        turntable={turntable}
        pedestal={pedestal}
      />
    </View>
  );
});

// ---------- botones ----------
export function RoundButton({ icon, label, onPress, color }: { icon: IconName; label: string; onPress: () => void; color: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}
    >
      <Ionicons name={icon} size={22} color={color} />
    </Pressable>
  );
}

/** Botón redondeado: relleno blanco, contorno blanco o relleno de color */
export function Pill({
  icon,
  label,
  onPress,
  variant = 'white',
  color,
  wide,
  small,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  variant?: 'white' | 'outline' | 'solid' | 'outlineColor';
  color: string;
  wide?: boolean;
  small?: boolean;
}) {
  const sc = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(sc, { toValue: v, useNativeDriver: true, stiffness: 400, damping: 20 }).start();
  const bg = variant === 'white' ? colors.white : variant === 'solid' ? color : 'transparent';
  const border = variant === 'outline' || variant === 'white' ? colors.white : color;
  const fg = variant === 'white' || variant === 'outlineColor' ? color : colors.white;
  return (
    <Pressable onPress={onPress} onPressIn={() => to(0.96)} onPressOut={() => to(1)} accessibilityRole="button" accessibilityLabel={label} style={wide ? { alignSelf: 'stretch', flexGrow: 1 } : undefined}>
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          minHeight: small ? 40 : 48,
          paddingHorizontal: small ? 14 : 20,
          borderRadius: radius.pill,
          backgroundColor: bg,
          borderWidth: 1.5,
          borderColor: border,
          transform: [{ scale: sc }],
        }}
      >
        <Ionicons name={icon} size={small ? 16 : 18} color={fg} />
        <Text style={{ fontFamily: font.bold, fontSize: small ? 13 : 14, color: fg }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function ModeToggle<T extends string>({ value, options, onChange, color, veil }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; color: string; veil: string }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useRef(new Animated.Value(idx)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: idx, useNativeDriver: true, stiffness: 320, damping: 24 }).start();
  }, [idx, x]);
  const OPT = 96;
  return (
    <View style={{ flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: veil }} accessibilityRole="tablist">
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', top: 3, left: 3, width: OPT, bottom: 3, borderRadius: radius.pill, backgroundColor: colors.white, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, OPT] }) }] }}
      />
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: value === o.value }} style={{ width: OPT, paddingVertical: 8, alignItems: 'center' }}>
          <Text style={{ fontFamily: font.bold, fontSize: 12, color: value === o.value ? color : colors.white }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---------- decoración ----------

/** Texto gigante que se desliza sin fin detrás del producto */
export function Marquee({ text, size, color, reduce, reverse, faded }: { text: string; size: number; color: string; reduce: boolean; reverse?: boolean; faded?: boolean }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!w || reduce) return;
    x.setValue(0);
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: w * 22, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [w, reduce, x]);
  const tx = x.interpolate({ inputRange: [0, 1], outputRange: reverse ? [-w, 0] : [0, -w] });
  return (
    <Animated.View style={{ flexDirection: 'row', width: 20000, transform: [{ translateX: w ? tx : 0 }], opacity: faded ? 0.35 : 1, marginTop: faded ? -size * 0.22 : 0 }}>
      {[0, 1, 2].map((i) => (
        <Text
          key={i}
          onLayout={i === 0 ? (e) => setW(e.nativeEvent.layout.width) : undefined}
          style={{ flexShrink: 0, fontFamily: font.bold, fontSize: size, lineHeight: size * 1.02, color, letterSpacing: -size * 0.04 }}
        >
          {`${text}  `}
        </Text>
      ))}
    </Animated.View>
  );
}

/** Trazos blancos inclinados que flotan */
export function Streaks({ width, height, reduce }: { width: number; height: number; reduce: boolean }) {
  const items = useMemo(() => {
    const r = rng(7);
    // solo en la parte de arriba: abajo va el texto de la portada y los trazos lo cruzarían
    return Array.from({ length: 18 }, () => ({ x: r() * width, y: r() * height * 0.5, l: 10 + r() * 22, o: 0.25 + r() * 0.5 }));
  }, [width, height]);
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, drift]);
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) }] }]}>
      {items.map((it, i) => (
        <View key={i} style={{ position: 'absolute', left: it.x, top: it.y, width: it.l, height: 4, borderRadius: 2, backgroundColor: colors.white, opacity: it.o, transform: [{ rotate: '-38deg' }] }} />
      ))}
    </Animated.View>
  );
}

/** Borde de papel rasgado entre secciones (abajo de una sección, o arriba de la siguiente) */
export function TornEdge({ width, color, top, under, seed = 13 }: { width: number; color: string; top?: boolean; under?: string; seed?: number }) {
  const H = 26;
  const d = useMemo(() => {
    const r = rng(seed);
    let p = `M0 ${H} L0 ${H * 0.55}`;
    for (let x = 0; x <= width + 14; x += 9 + r() * 12) p += ` L${x.toFixed(1)} ${(H * (0.15 + r() * 0.6)).toFixed(1)}`;
    return `${p} L${width} ${H} Z`;
  }, [width, seed]);
  return (
    <View pointerEvents="none" style={top ? { height: H, backgroundColor: under } : { position: 'absolute', left: 0, right: 0, bottom: -1, height: H }}>
      <Svg width={width} height={H}>
        <Path d={d} fill={colors.white} fillOpacity={0.55} transform="translate(0,-3)" />
        <Path d={d} fill={color} />
      </Svg>
    </View>
  );
}

/** Líneas topográficas suaves de fondo */
export function Topo({ width, height, color, seed = 42 }: { width: number; height: number; color: string; seed?: number }) {
  const paths = useMemo(() => {
    const r = rng(seed);
    const out: string[] = [];
    const centers = Array.from({ length: Math.max(2, Math.round(height / 320)) }, () => ({ x: r() * width, y: r() * height, a: r() * 6, b: r() * 6 }));
    for (const c of centers) {
      for (let k = 1; k <= 7; k++) {
        const R = k * 34;
        let p = '';
        for (let i = 0; i <= 48; i++) {
          const t = (i / 48) * Math.PI * 2;
          const rr = R * (1 + 0.16 * Math.sin(3 * t + c.a) + 0.09 * Math.sin(5 * t + c.b + k * 0.3));
          p += `${i ? 'L' : 'M'}${(c.x + Math.cos(t) * rr).toFixed(1)} ${(c.y + Math.sin(t) * rr * 0.8).toFixed(1)}`;
        }
        out.push(`${p}Z`);
      }
    }
    return out;
  }, [width, height, seed]);
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
      {paths.map((d, i) => (
        <Path key={i} d={d} stroke={color} strokeWidth={1.2} fill="none" />
      ))}
    </Svg>
  );
}

/** Pedestal blanco donde se apoya la caja */
export function Podium({ width, children, boxH = 250 }: { width: number; children: ReactNode; boxH?: number }) {
  const pw = Math.min(260, width * 0.66);
  const top = 26;
  return (
    <View style={{ alignItems: 'center', height: boxH + 70, marginVertical: space.md }}>
      <View style={{ position: 'absolute', top: boxH * 0.75, width: pw, height: 110 }}>
        <Svg width={pw} height={110}>
          <Defs>
            <SvgGradient id="pod" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.border} />
              <Stop offset="0.45" stopColor={colors.white} />
              <Stop offset="1" stopColor={colors.borderStrong} />
            </SvgGradient>
          </Defs>
          <Rect x={0} y={top / 2} width={pw} height={110 - top} fill="url(#pod)" />
          <Ellipse cx={pw / 2} cy={110 - top / 2} rx={pw / 2} ry={top / 2} fill="url(#pod)" />
          <Ellipse cx={pw / 2} cy={top / 2} rx={pw / 2} ry={top / 2} fill={colors.bg} stroke={colors.border} strokeWidth={1} />
        </Svg>
      </View>
      {children}
    </View>
  );
}

// forma de mancha de tinta con gotas (semilla fija: siempre la misma forma)
export function blob(seed: number, r: number) {
  const rnd = rng(seed);
  const n = 22;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const spike = rnd() < 0.22 ? 1.18 + rnd() * 0.22 : 0.9 + rnd() * 0.14;
    return [r + Math.cos(a) * r * spike * 0.92, r + Math.sin(a) * r * spike * 0.92];
  });
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    d += ` Q${a[0].toFixed(1)} ${a[1].toFixed(1)} ${((a[0] + b[0]) / 2).toFixed(1)} ${((a[1] + b[1]) / 2).toFixed(1)}`;
  }
  d += 'Z';
  for (let k = 0; k < 3; k++) {
    const a = rnd() * Math.PI * 2;
    const dist = r * (1.12 + rnd() * 0.18);
    const rr = r * (0.05 + rnd() * 0.06);
    const cx = r + Math.cos(a) * dist;
    const cy = r + Math.sin(a) * dist;
    d += ` M${(cx - rr).toFixed(1)} ${cy.toFixed(1)} a${rr.toFixed(1)} ${rr.toFixed(1)} 0 1 0 ${(rr * 2).toFixed(1)} 0 a${rr.toFixed(1)} ${rr.toFixed(1)} 0 1 0 ${(-rr * 2).toFixed(1)} 0`;
  }
  return d;
}

/** Mancha de tinta con texto. `full`: versión grande con el texto completo (se abre al centro) */
export function InkNote({ title, text, color, size, seed, full, dim, onPress }: { title: string; text: string; color: string; size: number; seed: number; full?: boolean; dim?: boolean; onPress: () => void }) {
  // la mancha (con picos y gotas) llega hasta ~1,45 R del centro: así nunca se corta dentro de su lienzo
  const R = size / 2.95;
  const off = size / 2 - R;
  const pad = size * (full ? 0.2 : 0.22);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: !!full }} accessibilityLabel={`${title}. ${text}`} style={{ opacity: dim ? 0.35 : 1 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Path d={blob(seed, R)} fill={color} transform={`translate(${off},${off})`} />
        </Svg>
        <View style={{ position: 'absolute', left: pad, right: pad, top: pad, bottom: pad, alignItems: 'center', justifyContent: 'center', gap: full ? 6 : 2 }}>
          <Text style={{ fontFamily: font.bold, fontSize: full ? 17 : 11.5, letterSpacing: 0.6, color: colors.white, textTransform: 'uppercase', textAlign: 'center' }}>{title}</Text>
          <Text style={{ fontFamily: font.medium, fontSize: full ? 14 : 10, lineHeight: full ? 20 : 13, color: colors.white, textAlign: 'center' }} numberOfLines={full ? 8 : 3}>
            {text}
          </Text>
          {full ? null : <Ionicons name="add-circle" size={16} color={colors.white} style={{ opacity: 0.85, marginTop: 2 }} />}
        </View>
      </View>
    </Pressable>
  );
}

/** desplaza un ScrollView animado (en la web, sobre el nodo del navegador) */
export function scrollToX(sv: unknown, x: number, animated: boolean) {
  const v = sv as { scrollTo?: (o: object) => void; getScrollableNode?: () => HTMLElement | null } | null;
  if (Platform.OS === 'web') {
    const node = v?.getScrollableNode?.() ?? (v as unknown as HTMLElement | null);
    // react-native-web reemplaza scrollTo en el nodo: se usa el del navegador directamente
    if (node && typeof Element !== 'undefined' && node instanceof Element) {
      (Element.prototype.scrollTo as (this: Element, o: ScrollToOptions) => void).call(node, { left: x, behavior: animated ? 'smooth' : 'auto' });
      return;
    }
  }
  v?.scrollTo?.({ x, animated });
}

// ---------- pantallas completas ----------

/** Caja 3D a pantalla completa: arrastrar, pellizcar o rueda para acercar, botones por cara */
export function FullViewer({ product, textures, onClose, reduce, title, pal }: { product: Product; textures?: BoxTextures; onClose: () => void; reduce: boolean; title: string; pal: FichaPal }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ref = useRef<ShowBoxHandle>(null);
  const [hint, setHint] = useState(true);
  const faces: BoxFace[] = textures ? ['front', 'left', 'back', 'right', 'top', 'bottom'] : ['front', 'right', 'back', 'left'];
  return (
    <View style={{ flex: 1, backgroundColor: pal.bgDeep }}>
      <LinearGradient colors={[pal.bg, pal.bgDeep]} style={StyleSheet.absoluteFill} />
      <ShowBox ref={ref} product={product} textures={textures} width={width} height={height} fill={0.78} fullGestures reduce={reduce} edge={pal.mainDeep} onInteract={() => setHint(false)} />
      <View style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <RoundButton icon="close" label="Cerrar vista 3D" onPress={onClose} color={pal.bg} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 17, color: colors.white }}>{title}</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.white, opacity: 0.8 }}>{textures ? 'Caja 3D con las fotos del empaque' : 'Envase 3D ilustrativo'}</Text>
        </View>
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + space.lg, gap: space.md, alignItems: 'center' }}>
        {hint ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: pal.veil, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }} pointerEvents="none">
            <Ionicons name="move-outline" size={14} color={colors.white} />
            <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.white }}>Arrastra para girar · pellizca para acercar</Text>
          </View>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ alignSelf: 'stretch', flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, flexGrow: 1, justifyContent: 'center' }}>
          {faces.map((f) => (
            <Pressable
              key={f}
              onPress={() => {
                setHint(false);
                ref.current?.show(f);
              }}
              accessibilityRole="button"
              style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: pressed ? colors.white : pal.veil, borderWidth: 1, borderColor: pal.veilLine })}
            >
              {({ pressed }) => <Text style={{ fontFamily: font.semibold, fontSize: 13, color: pressed ? pal.bg : colors.white }}>{FACE_LABEL[f]}</Text>}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

/** Foto de una cara del empaque para leer su texto: acercar con botones o pellizcando (iPhone) */
export function PhotoZoom({ source, title, onClose, pal, ratio }: { source: ComponentProps<typeof Image>['source']; title: string; onClose: () => void; pal: FichaPal; ratio: number }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [z, setZ] = useState(1);
  const baseW = Math.min(width - space.lg * 2, (height - 220) / ratio);
  const w = baseW * z;
  const h = w * ratio;
  return (
    <View style={{ flex: 1, backgroundColor: pal.bgDeep }}>
      <View style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <RoundButton icon="close" label="Cerrar foto" onPress={onClose} color={pal.bg} />
        <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 17, color: colors.white }}>{title}</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', padding: space.lg, minHeight: height - 200 }} maximumZoomScale={4} minimumZoomScale={1} centerContent>
        <ScrollView horizontal contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', minWidth: width - space.lg * 2 }} showsHorizontalScrollIndicator={false}>
          <Image source={source} style={{ width: w, height: h, borderRadius: 6 }} resizeMode="cover" accessibilityLabel={title} />
        </ScrollView>
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.sm, paddingBottom: insets.bottom + space.lg }}>
        {[1, 1.6, 2.4].map((v) => (
          <Pressable
            key={v}
            onPress={() => setZ(v)}
            accessibilityRole="button"
            accessibilityState={{ selected: z === v }}
            style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: z === v ? colors.white : pal.veil }}
          >
            <Text style={{ fontFamily: font.bold, fontSize: 13, color: z === v ? pal.bg : colors.white }}>{v === 1 ? 'Ajustar' : `${v.toString().replace('.', ',')}×`}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
