import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import { PhotoBox3D, type BoxFace, type PhotoBox3DHandle } from '@/components/PhotoBox3D';
import { goBack } from '@/components/ui';
import { CORAESSENS, vitrinaCards, type VitrinaCard, type VitrinaMode } from '@/data/vitrina';
import { openAR, type ArResult } from '@/lib/ar';
import { useMine } from '@/store/AppStore';
import { colors, font, packColors, radius, space } from '@/theme';

// Vitrina 3D de un producto fotografiado (estilo de las referencias: tipografía gigante detrás del
// producto flotando, carrusel de tarjetas altas, pedestal y cierre con letras grandes).
// Todos los colores salen del empaque: rojo, morado y blanco.
const C = packColors.coraessens;
const FACE_LABEL: Record<BoxFace, string> = { front: 'Frente', left: 'Izquierda', back: 'Reverso', right: 'Derecha', top: 'Tapa', bottom: 'Base' };

// generador pseudoaleatorio con semilla (las formas decorativas no cambian entre renders)
const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

function useReduceMotion() {
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

export default function Vitrina() {
  const { modo } = useLocalSearchParams<{ id: string; modo?: string }>();
  const { role, logEvent } = useMine();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [mode, setMode] = useState<VitrinaMode>(modo === 'ficticio' ? 'ficticio' : 'real');
  const names = CORAESSENS.names[mode];
  const textures = CORAESSENS.textures[mode];
  const cards = useMemo(() => vitrinaCards(mode), [mode]);

  const scroll = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const hero = useRef<PhotoBox3DHandle>(null);
  const [heroOn, setHeroOn] = useState(true);
  const [podiumOn, setPodiumOn] = useState(false);
  const [outroOn, setOutroOn] = useState(false);
  const [full, setFull] = useState(false);
  const [ar, setAr] = useState<ArResult | null>(null);
  const pos = useRef({ podium: 9999, outro: 9999 });

  const W = Math.min(width, 560); // en pantallas anchas el contenido se centra
  const heroH = Math.max(600, Math.min(760, height * 0.9));

  useEffect(() => {
    logEvent('vitrina_abierta', `${CORAESSENS.id}:${mode}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // qué secciones están en pantalla: las cajas fuera de vista dejan de animarse
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      const bottom = value + height;
      setHeroOn(value < heroH);
      setPodiumOn(bottom > pos.current.podium && value < pos.current.podium + 640);
      if (bottom > pos.current.outro + 140) setOutroOn(true);
    });
    return () => scrollY.removeListener(id);
  }, [scrollY, height, heroH]);

  const showFace = (face: BoxFace) => {
    scroll.current?.scrollTo({ y: 0, animated: !reduce });
    setTimeout(() => hero.current?.show(face), reduce ? 0 : 280);
    logEvent('vitrina_cara', face);
  };

  const launchAR = async () => {
    logEvent('ar_abierto', names.arId);
    setAr(await openAR({ id: names.arId, name: names.name, arTitle: names.arTitle }));
  };

  const textY = scrollY.interpolate({ inputRange: [-200, 0, heroH], outputRange: [-60, 0, heroH * 0.42], extrapolate: 'clamp' });
  const boxY = scrollY.interpolate({ inputRange: [-200, 0, heroH], outputRange: [-30, 0, heroH * 0.2], extrapolate: 'clamp' });

  return (
    <View style={{ flex: 1, backgroundColor: C.purpleDeep }}>
      <Animated.ScrollView
        ref={scroll as never}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 0 }}
      >
        {/* ---------- HERO ---------- */}
        <View style={{ height: heroH, overflow: 'hidden' }}>
          <LinearGradient colors={[C.purple, C.purpleDeep]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
          <Streaks width={width} height={heroH} reduce={reduce} />
          <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: heroH * 0.2, transform: [{ translateY: textY }] }} pointerEvents="none">
            <Marquee text={names.name} size={Math.min(width, 700) * 0.34} color={C.red} reduce={reduce} />
            <Marquee text={names.name} size={Math.min(width, 700) * 0.34} color={C.red} reduce={reduce} reverse faded />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: heroH * 0.1, alignItems: 'center', transform: [{ translateY: boxY }] }}>
            <PhotoBox3D
              ref={hero}
              key={mode}
              textures={textures}
              dims={CORAESSENS.dims}
              width={width}
              height={heroH * 0.56}
              fill={0.6}
              paused={!heroOn}
              reduceMotion={reduce}
              edge={C.redDeep}
            />
          </Animated.View>

          {/* barra superior */}
          <View style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <RoundButton icon="chevron-back" label="Volver" onPress={() => goBack(role === 'visitador' ? '/visitador/catalogo' : '/medico')} />
            <View style={{ flex: 1 }} />
            <ModeToggle mode={mode} onChange={setMode} />
          </View>

          {/* texto y acciones */}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 54, alignItems: 'center' }}>
            <View style={{ width: W, paddingHorizontal: space.xl, gap: space.md }}>
              <Text style={s.overline}>{names.labLine}</Text>
              <Text style={{ fontFamily: font.bold, fontSize: 30, lineHeight: 34, color: colors.white, letterSpacing: -0.5 }}>{names.mark}</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: colors.white, opacity: 0.88 }}>{CORAESSENS.formula}.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {CORAESSENS.badges.map((b) => (
                  <View key={b} style={s.badge}>
                    <Text style={s.badgeText}>{b}</Text>
                  </View>
                ))}
                <View style={[s.badge, { backgroundColor: colors.white }]}>
                  <Text style={[s.badgeText, { color: C.red }]}>{CORAESSENS.sample}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
                <Pill icon="cube-outline" label="Ver en 3D" onPress={() => setFull(true)} />
                <Pill icon="scan-outline" label="Ver en AR" onPress={launchAR} outline />
              </View>
              {ar ? <ArNote result={ar} /> : null}
            </View>
          </View>
          <TornEdge width={width} color={C.blush} />
        </View>

        {/* ---------- CARRUSEL ---------- */}
        <View style={{ backgroundColor: C.blush, paddingTop: space.xl, paddingBottom: space.xxl, overflow: 'hidden' }}>
          <Topo width={width} height={1100} />
          <View style={{ alignSelf: 'center', width: W, paddingHorizontal: space.xl, gap: 4 }}>
            <Text style={[s.overline, { color: C.red }]}>Explora el empaque</Text>
            <Text style={s.h1}>Cara por cara</Text>
            <Text style={s.lead}>Desliza las tarjetas. Cada una muestra una cara de la caja y su texto impreso.</Text>
          </View>
          <Carousel key={mode} cards={cards} textures={textures} width={width} reduce={reduce} onShowFace={showFace} />
        </View>

        {/* ---------- PEDESTAL ---------- */}
        <View
          style={{ backgroundColor: colors.white, paddingBottom: space.xxl }}
          onLayout={(e: LayoutChangeEvent) => (pos.current.podium = e.nativeEvent.layout.y)}
        >
          <TornEdge width={width} color={colors.white} top under={C.blush} />
          <View style={{ alignSelf: 'center', width: W, paddingHorizontal: space.xl, gap: 4 }}>
            <Text style={[s.overline, { color: C.red }]}>Muestra médica</Text>
            <Text style={s.h1}>Datos del empaque</Text>
          </View>
          <Podium width={W}>
            <PhotoBox3D
              key={`p-${mode}`}
              textures={textures}
              dims={CORAESSENS.dims}
              width={240}
              height={250}
              fill={0.8}
              float={false}
              interactive
              paused={!podiumOn}
              reduceMotion={reduce}
              spinSpeed={0.00028}
              edge={C.redDeep}
            />
          </Podium>
          <View style={{ alignSelf: 'center', width: W, paddingHorizontal: space.xl, gap: space.md }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
              {CORAESSENS.facts.map((f) => (
                <View key={f.label} style={s.fact}>
                  <Text style={{ fontFamily: font.bold, fontSize: f.value.length > 6 ? 20 : 24, lineHeight: 30, color: C.red }} numberOfLines={1}>
                    {f.value}
                  </Text>
                  <Text style={{ fontFamily: font.medium, fontSize: 13, color: C.ink }}>{f.label}</Text>
                </View>
              ))}
            </View>
            <Text style={[s.lead, { textAlign: 'center' }]}>
              Medidas aproximadas de la caja: {`${CORAESSENS.sizeCm.w} × ${CORAESSENS.sizeCm.d} × ${CORAESSENS.sizeCm.h}`.replace(/\./g, ',')} cm
            </Text>
          </View>
        </View>

        {/* ---------- CIERRE ---------- */}
        <View style={{ backgroundColor: C.purpleDeep, paddingBottom: insets.bottom + space.xxl, overflow: 'hidden' }} onLayout={(e) => (pos.current.outro = e.nativeEvent.layout.y)}>
          <TornEdge width={width} color={C.purpleDeep} top under={colors.white} />
          <Outro name={names.name} show={outroOn || reduce} reduce={reduce} width={W} />
          <View style={{ alignSelf: 'center', width: W, paddingHorizontal: space.xl, gap: space.md, marginTop: space.xl }}>
            <Pill icon="expand-outline" label="Abrir la caja en pantalla completa" onPress={() => setFull(true)} wide />
            <Pill icon="scan-outline" label="Ver en realidad aumentada" onPress={launchAR} outline wide />
            <Pill icon="grid-outline" label="Volver al catálogo" onPress={() => goBack(role === 'visitador' ? '/visitador/catalogo' : '/medico')} outline wide />
            <Text style={{ fontFamily: font.regular, fontSize: 12, lineHeight: 18, color: colors.white, opacity: 0.8, textAlign: 'center', marginTop: space.md }}>
              {names.disclaimer} La app no vende ni entrega medicamentos.
            </Text>
          </View>
        </View>
      </Animated.ScrollView>

      {/* ---------- pantalla completa ---------- */}
      <Modal visible={full} animationType={reduce ? 'none' : 'fade'} onRequestClose={() => setFull(false)} transparent={false}>
        <FullViewer textures={textures} onClose={() => setFull(false)} reduce={reduce} title={names.mark} />
      </Modal>
    </View>
  );
}

// ---------- partes ----------

function RoundButton({ icon, label, onPress }: { icon: 'chevron-back' | 'close'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}
    >
      <Ionicons name={icon} size={22} color={C.purple} />
    </Pressable>
  );
}

function ModeToggle({ mode, onChange }: { mode: VitrinaMode; onChange: (m: VitrinaMode) => void }) {
  const x = useRef(new Animated.Value(mode === 'real' ? 0 : 1)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: mode === 'real' ? 0 : 1, useNativeDriver: true, stiffness: 320, damping: 24 }).start();
  }, [mode, x]);
  const OPT = 96;
  return (
    <View style={{ flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: C.veil }} accessibilityRole="tablist">
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', top: 3, left: 3, width: OPT, bottom: 3, borderRadius: radius.pill, backgroundColor: colors.white, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, OPT] }) }] }}
      />
      {(['real', 'ficticio'] as VitrinaMode[]).map((m) => (
        <Pressable key={m} onPress={() => onChange(m)} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} style={{ width: OPT, paddingVertical: 8, alignItems: 'center' }}>
          <Text style={{ fontFamily: font.bold, fontSize: 12, color: mode === m ? C.purple : colors.white }}>{m === 'real' ? 'Nombre real' : 'Ficticio'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Pill({ icon, label, onPress, outline, wide }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; outline?: boolean; wide?: boolean }) {
  const sc = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(sc, { toValue: v, useNativeDriver: true, stiffness: 400, damping: 20 }).start();
  return (
    <Pressable onPress={onPress} onPressIn={() => to(0.96)} onPressOut={() => to(1)} accessibilityRole="button" accessibilityLabel={label} style={wide ? { alignSelf: 'stretch' } : undefined}>
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          minHeight: 48,
          paddingHorizontal: 20,
          borderRadius: radius.pill,
          backgroundColor: outline ? 'transparent' : colors.white,
          borderWidth: 1.5,
          borderColor: colors.white,
          transform: [{ scale: sc }],
        }}
      >
        <Ionicons name={icon} size={18} color={outline ? colors.white : C.red} />
        <Text style={{ fontFamily: font.bold, fontSize: 14, color: outline ? colors.white : C.red }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function ArNote({ result }: { result: ArResult }) {
  const text =
    result === 'abierto'
      ? 'Abriendo el visor de realidad aumentada del teléfono…'
      : result === 'solo-celular'
        ? 'La realidad aumentada se abre desde un celular (Android con Google o iPhone con Safari). Aquí puedes usar la vista 3D.'
        : 'Este teléfono no tiene el visor de realidad aumentada. Usa la vista 3D.';
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: C.veil, borderRadius: radius.md, padding: space.md }}>
      <Ionicons name="information-circle-outline" size={18} color={colors.white} />
      <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 12, lineHeight: 17, color: colors.white }}>{text}</Text>
    </View>
  );
}

/** Texto gigante que se desliza sin fin detrás del producto */
function Marquee({ text, size, color, reduce, reverse, faded }: { text: string; size: number; color: string; reduce: boolean; reverse?: boolean; faded?: boolean }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!w || reduce) return;
    x.setValue(0);
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: w * 22, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [w, reduce, x]);
  const seg = `${text}  `;
  const tx = x.interpolate({ inputRange: [0, 1], outputRange: reverse ? [-w, 0] : [0, -w] });
  return (
    <Animated.View style={{ flexDirection: 'row', width: 20000, transform: [{ translateX: w ? tx : 0 }], opacity: faded ? 0.35 : 1, marginTop: faded ? -size * 0.22 : 0 }}>
      {[0, 1, 2].map((i) => (
        <Text
          key={i}
          onLayout={i === 0 ? (e) => setW(e.nativeEvent.layout.width) : undefined}
          style={{ flexShrink: 0, fontFamily: font.bold, fontSize: size, lineHeight: size * 1.02, color, letterSpacing: -size * 0.04 }}
        >
          {seg}
        </Text>
      ))}
    </Animated.View>
  );
}

/** Trazos blancos inclinados (como el confeti de la referencia) */
function Streaks({ width, height, reduce }: { width: number; height: number; reduce: boolean }) {
  const items = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 22 }, () => ({ x: r() * width, y: r() * height * 0.8, l: 10 + r() * 22, o: 0.25 + r() * 0.5 }));
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
        <View
          key={i}
          style={{ position: 'absolute', left: it.x, top: it.y, width: it.l, height: 4, borderRadius: 2, backgroundColor: colors.white, opacity: it.o, transform: [{ rotate: '-38deg' }] }}
        />
      ))}
    </Animated.View>
  );
}

/** Borde de papel rasgado entre secciones */
function TornEdge({ width, color, top, under }: { width: number; color: string; top?: boolean; under?: string }) {
  const H = 26;
  const d = useMemo(() => {
    const r = rng(top ? 31 : 13);
    let p = `M0 ${H} L0 ${H * 0.55}`;
    for (let x = 0; x <= width + 14; x += 9 + r() * 12) p += ` L${x.toFixed(1)} ${(H * (0.15 + r() * 0.6)).toFixed(1)}`;
    return `${p} L${width} ${H} Z`;
  }, [width, top]);
  return (
    <View pointerEvents="none" style={top ? { height: H, backgroundColor: under, marginBottom: space.lg } : { position: 'absolute', left: 0, right: 0, bottom: -1, height: H }}>
      <Svg width={width} height={H}>
        <Path d={d} fill={colors.white} fillOpacity={0.55} transform="translate(0,-3)" />
        <Path d={d} fill={color} />
      </Svg>
    </View>
  );
}

/** Líneas topográficas suaves del fondo (como la segunda referencia) */
function Topo({ width, height }: { width: number; height: number }) {
  const paths = useMemo(() => {
    const r = rng(42);
    const out: string[] = [];
    const centers = Array.from({ length: 4 }, () => ({ x: r() * width, y: r() * height, a: r() * 6, b: r() * 6 }));
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
  }, [width, height]);
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
      {paths.map((d, i) => (
        <Path key={i} d={d} stroke={C.line} strokeWidth={1.2} fill="none" />
      ))}
    </Svg>
  );
}

// desplaza un ScrollView animado (en la web, sobre el nodo del navegador)
function scrollToX(sv: unknown, x: number, animated: boolean) {
  const v = sv as { scrollTo?: (o: object) => void; getScrollableNode?: () => HTMLElement | null } | null;
  if (Platform.OS === 'web') {
    const node = v?.getScrollableNode?.() ?? (v as unknown as HTMLElement | null);
    if (node && typeof (node as HTMLElement).scrollTo === 'function') {
      (node as HTMLElement).scrollTo({ left: x, behavior: animated ? 'smooth' : 'auto' });
      return;
    }
  }
  v?.scrollTo?.({ x, animated });
}

function Carousel({
  cards,
  textures,
  width,
  reduce,
  onShowFace,
}: {
  cards: VitrinaCard[];
  textures: Record<BoxFace, import('react-native').ImageSourcePropType>;
  width: number;
  reduce: boolean;
  onShowFace: (f: BoxFace) => void;
}) {
  const cardW = Math.min(250, width * 0.6);
  const cardH = cardW * 1.36;
  const GAP = 14;
  const I = cardW + GAP;
  const pad = (width - cardW) / 2;
  const x = useRef(new Animated.Value(0)).current;
  const ref = useRef<ScrollView>(null);
  const [active, setActive] = useState(0);
  const go = (i: number) => scrollToX(ref.current, i * I, !reduce);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const id = x.addListener(({ value }) => {
      const i = Math.max(0, Math.min(cards.length - 1, Math.round(value / I)));
      setActive((a) => (a === i ? a : i));
      // en la web no hay "snap" por intervalo: al soltar, la tarjeta más cercana se centra
      if (Platform.OS === 'web') {
        if (settle.current) clearTimeout(settle.current);
        settle.current = setTimeout(() => Math.abs(value - i * I) > 2 && scrollToX(ref.current, i * I, !reduce), 140);
      }
    });
    return () => {
      x.removeListener(id);
      if (settle.current) clearTimeout(settle.current);
    };
  }, [x, I, cards.length, reduce]);
  const card = cards[active];

  return (
    <View>
      <Animated.ScrollView
        ref={ref as never}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={I}
        decelerationRate="fast"
        disableIntervalMomentum
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], { useNativeDriver: true })}
        contentContainerStyle={{ paddingHorizontal: pad, gap: GAP, paddingTop: space.xl, paddingBottom: 56 }}
        style={{ overflow: 'visible' }}
      >
        {cards.map((c, i) => {
          const range = [(i - 1) * I, i * I, (i + 1) * I];
          const scale = x.interpolate({ inputRange: range, outputRange: [0.84, 1, 0.84], extrapolate: 'clamp' });
          const ty = x.interpolate({ inputRange: range, outputRange: [22, 0, 22], extrapolate: 'clamp' });
          const rot = x.interpolate({ inputRange: range, outputRange: ['-2deg', '0deg', '2deg'], extrapolate: 'clamp' });
          const pop = x.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' });
          const isTop = c.face === 'top' || c.face === 'bottom';
          const imgW = cardW * (isTop ? 0.62 : 0.56);
          const imgH = isTop ? imgW : imgW * 1.447;
          return (
            <Pressable key={c.id} onPress={() => go(i)} accessibilityRole="button" accessibilityLabel={`${c.title}, tarjeta ${i + 1} de ${cards.length}`}>
              <Animated.View
                style={{
                  width: cardW,
                  height: cardH,
                  borderRadius: 26,
                  backgroundColor: c.tone === 'red' ? C.red : C.purple,
                  padding: space.lg,
                  shadowColor: C.ink,
                  shadowOpacity: 0.28,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 12 },
                  elevation: 8,
                  transform: [{ translateY: ty }, { scale }, { rotate: rot }],
                }}
              >
                <Text style={{ fontFamily: font.semibold, fontSize: 11, letterSpacing: 1, color: colors.white, opacity: 0.85, textTransform: 'uppercase' }}>{c.kicker}</Text>
                <Text style={{ fontFamily: font.bold, fontSize: c.title.length > 14 ? 21 : 26, lineHeight: c.title.length > 14 ? 25 : 30, color: colors.white, marginTop: 4 }} numberOfLines={2}>
                  {c.title}
                </Text>
                {/* la foto de esa cara sale de la tarjeta */}
                <Animated.View
                  style={{
                    position: 'absolute',
                    bottom: -cardH * 0.1,
                    alignSelf: 'center',
                    left: (cardW - imgW) / 2,
                    width: imgW,
                    height: imgH,
                    borderRadius: 6,
                    shadowColor: C.ink,
                    shadowOpacity: 0.35,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 10 },
                    elevation: 10,
                    transform: [
                      { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [10, -6] }) },
                      { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-6deg'] }) },
                      { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.04] }) },
                    ],
                  }}
                >
                  <Image source={textures[c.face]} style={{ width: imgW, height: imgH, borderRadius: 6 }} resizeMode="cover" />
                </Animated.View>
              </Animated.View>
            </Pressable>
          );
        })}
      </Animated.ScrollView>

      {/* puntos */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginBottom: space.sm }}>
        {cards.map((c, i) => (
          <Pressable key={c.id} onPress={() => go(i)} style={{ paddingVertical: 10, paddingHorizontal: 2 }} accessibilityRole="button" accessibilityLabel={`Ir a ${c.title}`}>
            <View style={{ width: i === active ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === active ? C.red : C.line }} />
          </Pressable>
        ))}
      </View>

      <CardDetail card={card} width={Math.min(width, 560)} onShowFace={onShowFace} reduce={reduce} />
    </View>
  );
}

function CardDetail({ card, width, onShowFace, reduce }: { card: VitrinaCard; width: number; onShowFace: (f: BoxFace) => void; reduce: boolean }) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) return;
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [card.id, a, reduce]);
  return (
    <Animated.View
      style={{
        alignSelf: 'center',
        width: width - space.xl * 2,
        backgroundColor: colors.white,
        borderRadius: radius.xl,
        padding: space.lg,
        gap: space.md,
        shadowColor: C.ink,
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
        opacity: a,
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: card.tone === 'red' ? C.red : C.purple }} />
        <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 18, color: C.ink }}>{card.title}</Text>
        <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.inkMuted }}>{FACE_LABEL[card.face]}</Text>
      </View>
      {card.body ? <Text style={{ fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: C.ink }}>{card.body}</Text> : null}
      {card.rows ? (
        <View style={{ borderTopWidth: 1, borderColor: C.line }}>
          {card.rowsHead ? (
            <View style={s.tr}>
              <Text style={[s.th, { flex: 1 }]}>{card.rowsHead[0]}</Text>
              <Text style={[s.th, { width: 90, textAlign: 'right' }]}>{card.rowsHead[1]}</Text>
              {card.rowsHead[2] ? <Text style={[s.th, { width: 66, textAlign: 'right' }]}>{card.rowsHead[2]}</Text> : null}
            </View>
          ) : null}
          {card.rows.map((r) => (
            <View key={r.label} style={s.tr}>
              {!r.value ? <Ionicons name="alert-circle-outline" size={16} color={C.red} style={{ marginRight: 6, marginTop: 2 }} /> : null}
              <Text style={[s.td, { flex: 1 }]}>{r.label}</Text>
              {r.value ? <Text style={[s.td, { width: 90, textAlign: 'right', fontFamily: font.semibold }]}>{r.value}</Text> : null}
              {r.extra !== undefined ? <Text style={[s.td, { width: 66, textAlign: 'right' }]}>{r.extra}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
      {card.foot ? <Text style={{ fontFamily: font.medium, fontSize: 12, lineHeight: 17, color: colors.inkMuted }}>{card.foot}</Text> : null}
      <Pressable
        onPress={() => onShowFace(card.face)}
        accessibilityRole="button"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}
      >
        <Ionicons name="cube-outline" size={18} color={C.red} />
        <Text style={{ fontFamily: font.bold, fontSize: 14, color: C.red }}>Ver esta cara en la caja 3D</Text>
      </Pressable>
    </Animated.View>
  );
}

/** Pedestal blanco donde se apoya la caja */
function Podium({ width, children }: { width: number; children: React.ReactNode }) {
  const pw = Math.min(260, width * 0.66);
  const top = 26;
  return (
    <View style={{ alignItems: 'center', height: 250 + 70, marginTop: space.md, marginBottom: space.lg }}>
      <View style={{ position: 'absolute', top: 188, width: pw, height: 110 }}>
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

function Outro({ name, show, reduce, width }: { name: string; show: boolean; reduce: boolean; width: number }) {
  const a = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (!show) return;
    Animated.spring(a, { toValue: 1, useNativeDriver: true, stiffness: 120, damping: 16, mass: 1 }).start();
  }, [show, a]);
  const size = Math.min(width * 0.2, 96);
  // el nombre ocupa todo el ancho sin cortarse (la web no ajusta el tamaño sola)
  const nameSize = Math.min(size, (width - space.xl * 2) / (name.length * 0.78));
  const line = (dir: 1 | -1, delay: number) => ({
    opacity: a.interpolate({ inputRange: [delay, Math.min(1, delay + 0.5)], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [dir * 80, 0] }) }],
  });
  return (
    <View style={{ alignSelf: 'center', width, paddingHorizontal: space.xl, paddingTop: space.lg }}>
      <Animated.Text style={[{ fontFamily: font.semibold, fontSize: 22, color: colors.white }, line(-1, 0)]}>Para la visita médica</Animated.Text>
      <Animated.Text style={[{ fontFamily: font.bold, fontSize: size, lineHeight: size * 1.02, color: colors.white, letterSpacing: -size * 0.04 }, line(-1, 0.1)]}>
        CONOCE
      </Animated.Text>
      <Animated.Text style={[{ fontFamily: font.bold, fontSize: nameSize, lineHeight: nameSize * 1.05, color: C.red, letterSpacing: -nameSize * 0.04, textAlign: 'right' }, line(1, 0.25)]}
      >
        {name}
      </Animated.Text>
      <Animated.View style={[{ alignSelf: 'flex-end', marginTop: space.md, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 }, line(1, 0.4)]}>
        <Text style={{ fontFamily: font.bold, fontSize: 13, color: C.red, letterSpacing: 0.4 }}>MUESTRA · PROHIBIDA SU VENTA</Text>
      </Animated.View>
    </View>
  );
}

function FullViewer({ textures, onClose, reduce, title }: { textures: Record<BoxFace, import('react-native').ImageSourcePropType>; onClose: () => void; reduce: boolean; title: string }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ref = useRef<PhotoBox3DHandle>(null);
  const [hint, setHint] = useState(true);
  return (
    <View style={{ flex: 1, backgroundColor: C.purpleDeep }}>
      <LinearGradient colors={[C.purple, C.purpleDeep]} style={StyleSheet.absoluteFill} />
      <PhotoBox3D
        ref={ref}
        textures={textures}
        dims={CORAESSENS.dims}
        width={width}
        height={height}
        fill={0.78}
        fullGestures
        reduceMotion={reduce}
        edge={C.redDeep}
        onInteract={() => setHint(false)}
      />
      <View style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <RoundButton icon="close" label="Cerrar vista 3D" onPress={onClose} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 17, color: colors.white }}>{title}</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.white, opacity: 0.8 }}>Caja 3D con las fotos del empaque</Text>
        </View>
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + space.lg, gap: space.md, alignItems: 'center' }}>
        {hint ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.veil, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }} pointerEvents="none">
            <Ionicons name="move-outline" size={14} color={colors.white} />
            <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.white }}>Arrastra para girar · pellizca para acercar</Text>
          </View>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ alignSelf: 'stretch', flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, flexGrow: 1, justifyContent: 'center' }}>
          {(Object.keys(FACE_LABEL) as BoxFace[]).map((f) => (
            <Pressable
              key={f}
              onPress={() => {
                setHint(false);
                ref.current?.show(f);
              }}
              accessibilityRole="button"
              style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: pressed ? colors.white : C.veil, borderWidth: 1, borderColor: C.veilLine })}
            >
              {({ pressed }) => <Text style={{ fontFamily: font.semibold, fontSize: 13, color: pressed ? C.purple : colors.white }}>{FACE_LABEL[f]}</Text>}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overline: { fontFamily: font.bold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.white, opacity: 0.9 },
  h1: { fontFamily: font.bold, fontSize: 30, lineHeight: 34, color: C.ink, letterSpacing: -0.5 },
  lead: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: C.ink, opacity: 0.8 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: C.veil },
  badgeText: { fontFamily: font.semibold, fontSize: 12, color: colors.white },
  fact: { flexBasis: '46%', flexGrow: 1, backgroundColor: C.blush, borderRadius: radius.lg, padding: space.lg, gap: 2 },
  tr: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderColor: C.blush },
  th: { fontFamily: font.bold, fontSize: 12, color: colors.inkMuted },
  td: { fontFamily: font.regular, fontSize: 14, lineHeight: 19, color: C.ink },
});
