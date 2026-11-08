import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Animated, Easing, Linking, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Bottle360, framesPerPx, FRAMES, frameFacing } from '@/components/Bottle360';
import { ProductVisual } from '@/components/ProductVisual';
import { ShareSheet } from '@/components/ShareSheet';
import { ModeToggle, Pill, RoundButton, useReduceMotion } from '@/components/showcase';
import { goBack } from '@/components/ui';
import type { FichaPal } from '@/data/ficha';
import { labByName, products, type Product } from '@/data/mock';
import { PANCREOGEN } from '@/data/pancreogen';
import { panSpots, type PanSpot } from '@/data/pancreogen-info';
import type { VitrinaMode } from '@/data/vitrina';
import { arCardUrl, fichaPdfUrl, openAR, type ArResult } from '@/lib/ar';
import { cssAnim, domEl, isWeb, nodeValue, setStyle, useFrameLoop } from '@/lib/webAnim';
import { ActionBar, ArNote } from '@/screens/Ficha';
import { useMine } from '@/store/AppStore';
import { colors, font, packColors, radius, space } from '@/theme';

// Catálogo 3D de PANCREOGEN, distinto de la ficha de CORAESSENS: inspirado en las páginas de producto que
// giran con el desplazamiento. El frasco (cuadros renderizados del modelo 3D con la etiqueta fotografiada)
// baja por el catálogo a medida que se desliza: cambia de lado en cada sección, gira para mostrar la parte
// de la etiqueta de la que se habla y, en «90 cápsulas», se abre (la tapa se desenrosca y salen las
// cápsulas) siguiendo el dedo. Los puntos numerados sobre el frasco giran con la etiqueta; al tocarlos el
// frasco gira hasta dejarlos de frente y se abre una tarjeta con lo que dice esa parte. También se gira
// arrastrando el frasco de lado. Todo el texto está tomado del frasco (src/data/pancreogen-info.ts).

const C = packColors.pancreogen;
type IconName = ComponentProps<typeof Ionicons>['name'];
type Sec = 'hero' | 'explora' | 'capsulas' | 'composicion' | 'nutricional' | 'modo' | 'avisos' | 'cierre';
const SECS: Sec[] = ['hero', 'explora', 'capsulas', 'composicion', 'nutricional', 'modo', 'avisos', 'cierre'];
const SEC_LABEL: Record<Sec, string> = {
  hero: 'Inicio',
  explora: 'Explora el frasco',
  capsulas: '90 cápsulas',
  composicion: 'Composición',
  nutricional: 'Información nutricional',
  modo: 'Modo de empleo',
  avisos: 'Avisos',
  cierre: 'Acciones',
};

// pose del frasco en cada sección: centro (fracción del ancho y del alto de la pantalla), alto y ángulo (cuadros)
interface Pose {
  x: number;
  y: number;
  h: number;
  rot: number;
}
const POSES: Record<Sec, Pose> = {
  hero: { x: 0.5, y: 0.45, h: 0.5, rot: 0 },
  explora: { x: 0.75, y: 0.5, h: 0.56, rot: 0 },
  capsulas: { x: 0.5, y: 0.73, h: 0.36, rot: 0 }, // más abajo: la tapa, al salir, no tapa el texto
  composicion: { x: 0.24, y: 0.5, h: 0.54, rot: frameFacing(0.835) }, // la tabla de frente
  nutricional: { x: 0.2, y: 0.25, h: 0.28, rot: frameFacing(0.835) },
  modo: { x: 0.24, y: 0.5, h: 0.54, rot: frameFacing(1.012) }, // modo de empleo (reverso)
  avisos: { x: 0.84, y: 0.42, h: 0.33, rot: frameFacing(1.1) }, // fabricante y registro
  cierre: { x: 0.5, y: 0.325, h: 0.42, rot: -FRAMES },
};

/** colores con la forma de la ficha (para reutilizar el aviso de AR y la barra de acciones) */
const PAL: FichaPal = { main: C.teal, mainDeep: C.tealDeep, bg: C.tealDeep, bgDeep: C.night, paper: C.paper, line: C.line, ink: C.ink, giant: C.mint, veil: C.veil, veilLine: C.veilLine };

export default function FichaPancreogen({ product: p, presenting = false, visita, initialMode }: { product: Product; presenting?: boolean; visita?: string; initialMode?: VitrinaMode }) {
  const { role, chatWith, logEvent, visits, updateReport } = useMine();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [mode, setMode] = useState<VitrinaMode>(initialMode ?? 'real');
  const N = PANCREOGEN.names[mode];
  const spots = useMemo(() => panSpots(mode), [mode]);
  const W = Math.min(width, 640);
  const side = (width - W) / 2; // en pantallas anchas el contenido se centra
  const Hs = Math.max(560, height);

  const scroll = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current; // giro extra (arrastre y puntos), en cuadros
  const dragV = useRef(0);
  const intro = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const [layout, setLayout] = useState<Partial<Record<Sec, { y: number; h: number }>>>({});
  const [seen, setSeen] = useState<Record<Sec, boolean>>({ hero: true, explora: false, capsulas: false, composicion: false, nutricional: false, modo: false, avisos: false, cierre: false });
  const [current, setCurrent] = useState<Sec>('hero');
  const [spot, setSpot] = useState<PanSpot | null>(null);
  const spotAt = useRef(0);
  const [bar, setBar] = useState(false);
  const [ar, setAr] = useState<ArResult | null>(null);
  const [arTick, setArTick] = useState(0);
  const [share, setShare] = useState(false);
  const [full, setFull] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(Date.now());

  useEffect(() => {
    logEvent(presenting ? 'presentacion_iniciada' : 'ficha_abierta', `${p.id}:${mode}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id, mode]);
  // en una visita en curso, el producto presentado se marca solo
  const visit = visits.find((v) => v.id === visita);
  const inVisit = !!visit?.report && !visit.report.endedAt;
  useEffect(() => {
    if (!presenting || !visita || !inVisit) return;
    updateReport(visita, (r) => ({
      ...r,
      presented: r.presented.includes(p.id) ? r.presented : [...r.presented, p.id],
      deliveries: r.deliveries[p.id] ? r.deliveries : { ...r.deliveries, [p.id]: {} },
    }));
  }, [presenting, visita, inVisit, p.id, updateReport]);
  useEffect(() => {
    if (!presenting) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [presenting]);

  // entrada: el frasco cae girando desde arriba y frena suave (sin rebote: el rebote se veía como temblor).
  // En la web espera a que el frasco 3D esté listo (como mucho 2,5 s) para no cambiar de imágenes a 3D a
  // mitad de la entrada.
  const focused = useIsFocused();
  const [bottleReady, setBottleReady] = useState(false);
  const onBottleReady = useCallback(() => setBottleReady(true), []);
  useEffect(() => {
    if (bottleReady) return;
    const t = setTimeout(() => setBottleReady(true), 2500);
    return () => clearTimeout(t);
  }, [bottleReady]);
  useEffect(() => {
    if (reduce) return intro.setValue(1);
    if (!bottleReady) return;
    Animated.timing(intro, { toValue: 1, duration: 1500, delay: 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [intro, reduce, bottleReady]);
  // flota suave en el sitio
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce || isWeb) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(bob, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }), Animated.timing(bob, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [bob, reduce]);

  // ---------- posiciones de las secciones y recorrido del frasco ----------
  const mark = (k: Sec) => (e: LayoutChangeEvent) => {
    const { y, height: h } = e.nativeEvent.layout;
    setLayout((l) => (l[k]?.y === y && l[k]?.h === h ? l : { ...l, [k]: { y, h } }));
  };
  // ancla: desplazamiento en el que la sección queda centrada (o arriba, si es más alta que la pantalla)
  const anchors = useMemo(() => {
    const out: Record<Sec, number> = {} as Record<Sec, number>;
    let y = 0;
    SECS.forEach((k) => {
      const L = layout[k] ?? { y, h: Hs };
      out[k] = k === 'hero' ? 0 : Math.max(0, L.y + Math.min(L.h, Hs) / 2 - Hs / 2);
      y = L.y + L.h;
    });
    return out;
  }, [layout, Hs]);
  const base = Hs * 0.6; // alto del frasco con escala 1
  const capsL = layout.capsulas ?? { y: Hs * 2, h: Hs * 1.7 };
  // la sección de cápsulas es más alta: el frasco se queda quieto mientras se abre y se cierra
  const openStart = capsL.y - Hs * 0.15;
  const openEnd = capsL.y + capsL.h - Hs * 0.85;
  // en la tabla nutricional y en el cierre el frasco «aterriza» en la página: queda una copia dentro del
  // contenido (sube con la tabla y no la tapa) y el frasco fijo se oculta. Después de la tabla vuelve a
  // entrar desde abajo para el modo de empleo.
  const nutA = anchors.nutricional;
  const cierreA = anchors.cierre;
  const sEnter = Math.min(Math.max(nutA + Hs * 0.42, anchors.modo - Hs * 0.6), anchors.modo - 2);
  const keys = useMemo(() => {
    const list: { s: number; pose: Pose }[] = [];
    SECS.forEach((k) => {
      if (k === 'capsulas') {
        list.push({ s: openStart - Hs * 0.12, pose: POSES.capsulas });
        list.push({ s: openEnd + Hs * 0.12, pose: POSES.capsulas });
      } else {
        if (k === 'modo') list.push({ s: sEnter, pose: { ...POSES.modo, y: 1.3 } });
        // antes del cierre espera al lado de los avisos hasta que la tarjeta del fabricante sale de la pantalla
        if (k === 'cierre') list.push({ s: Math.max(anchors.avisos + 1, anchors.cierre - Hs * 0.42), pose: POSES.avisos });
        list.push({ s: anchors[k], pose: POSES[k] });
      }
    });
    // en orden y sin repetidos (interpolate exige entradas crecientes)
    const out: typeof list = [];
    list.forEach((k) => {
      const s = out.length ? Math.max(k.s, out[out.length - 1].s + 1) : k.s;
      out.push({ s, pose: k.pose });
    });
    return out;
  }, [anchors, openStart, openEnd, Hs, sEnter]);
  const ease = Easing.inOut(Easing.cubic);
  // nodos de Animated del recorrido (se crean una sola vez por diseño de página, no en cada render)
  const fly = useMemo(() => {
    const inputs = keys.map((k) => k.s);
    const interp = (f: (p: Pose) => number) => scrollY.interpolate({ inputRange: inputs, outputRange: keys.map((k) => f(k.pose)), extrapolate: 'clamp', easing: ease });
    const e1 = sEnter + Hs * 0.06;
    const c0 = Math.max(e1 + 1, cierreA - 1);
    return {
      tx: interp((q) => side + q.x * W),
      ty: interp((q) => q.y * Hs - base / 2),
      scale: interp((q) => q.h / 0.6),
      rotScroll: interp((q) => q.rot),
      // visibilidad del frasco fijo y de las copias que aterrizan
      stickyVis: scrollY.interpolate({ inputRange: [nutA - 1, nutA, sEnter, e1, c0, c0 + 1], outputRange: [1, 0, 0, 1, 1, 0], extrapolate: 'clamp' }),
      nutVis: scrollY.interpolate({ inputRange: [nutA - 1, nutA, sEnter, e1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
      endVis: scrollY.interpolate({ inputRange: [c0, c0 + 1], outputRange: [0, 1], extrapolate: 'clamp' }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, scrollY, side, W, Hs, base, nutA, sEnter, cierreA]);
  const introRot = useMemo(() => intro.interpolate({ inputRange: [0, 1], outputRange: [-FRAMES * 1.25, 0] }), [intro]);
  const introY = useMemo(() => intro.interpolate({ inputRange: [0, 1], outputRange: [-Hs * 0.9, 0] }), [intro, Hs]);
  const rot = useMemo(() => Animated.add(Animated.add(fly.rotScroll, drag), introRot), [fly.rotScroll, drag, introRot]);
  const openProgress = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [openStart, openStart + Hs * 0.4, openEnd - Hs * 0.4, openEnd],
        outputRange: [0, 1, 1, 0],
        extrapolate: 'clamp',
      }),
    [scrollY, openStart, openEnd, Hs],
  );
  // los puntos solo se ven con el frasco cerrado, fuera de la entrada y mientras el frasco fijo está a la vista
  const spotsVis = useMemo(
    () =>
      Animated.multiply(
        Animated.multiply(
          openProgress.interpolate({ inputRange: [0, 0.02], outputRange: [1, 0], extrapolate: 'clamp' }),
          intro.interpolate({ inputRange: [0.85, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
        ),
        fly.stickyVis,
      ),
    [openProgress, intro, fly.stickyVis],
  );
  // copias que aterrizan: giro fijo de su sección más el que haya dado el usuario
  const rotNut = useMemo(() => Animated.add(drag, POSES.nutricional.rot), [drag]);
  const rotEnd = useMemo(() => Animated.add(drag, POSES.cierre.rot), [drag]);
  const [stickyOff, setStickyOff] = useState(false);

  // sección actual, secciones vistas, contador de cápsulas y barra de acciones
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      const mid = value + Hs * 0.55;
      let cur: Sec = 'hero';
      SECS.forEach((k) => {
        const L = layout[k];
        if (L && mid >= L.y) cur = k;
      });
      setCurrent((c) => (c === cur ? c : cur));
      setSeen((s) => {
        const vis = SECS.filter((k) => {
          const L = layout[k];
          return L && value + Hs * 0.8 > L.y && !s[k];
        });
        if (!vis.length) return s;
        const n = { ...s };
        vis.forEach((k) => (n[k] = true));
        return n;
      });
      const off = (value > nutA && value < sEnter) || value > cierreA;
      setStickyOff((o) => (o === off ? o : off));
      const outro = layout.cierre?.y ?? 1e9;
      setBar(value > Hs * 0.5 && value + Hs < outro + 140);
      if (Math.abs(value - spotAt.current) > Hs * 0.5) setSpot(null);
    });
    return () => scrollY.removeListener(id);
  }, [scrollY, layout, Hs, nutA, sEnter, cierreA]);

  // al abrirse, el frasco vuelve de frente (los cuadros de apertura se renderizaron de frente)
  const frontRef = useRef(false);
  useEffect(() => {
    const id = openProgress.addListener(({ value }) => {
      if (value > 0 && !frontRef.current) {
        frontRef.current = true;
        Animated.timing(drag, { toValue: Math.round(dragV.current / FRAMES) * FRAMES, duration: 200, useNativeDriver: true }).start(() => (dragV.current = Math.round(dragV.current / FRAMES) * FRAMES));
      } else if (value === 0) frontRef.current = false;
    });
    return () => openProgress.removeListener(id);
  }, [openProgress, drag]);

  // arrastre lateral sobre el frasco: lo gira (con inercia); el desplazamiento vertical sigue funcionando
  // web: en cada cuadro se toma el desplazamiento real de la página (scrollTop). El evento de scroll llega
  // desfasado de la pantalla (y en iPhone, a saltos durante la inercia): con él el frasco temblaba al bajar.
  const scrollTopRef = useRef(-1);
  useFrameLoop(
    () => {
      const node = (scroll.current as unknown as { getScrollableNode?: () => HTMLElement } | null)?.getScrollableNode?.();
      if (!node) return;
      const t = node.scrollTop;
      if (t !== scrollTopRef.current) {
        scrollTopRef.current = t;
        if (Math.abs(nodeValue(scrollY as never) - t) > 0.25) scrollY.setValue(t);
      }
    },
    isWeb,
    true,
  );

  // la etiqueta sigue al dedo: cuadros por píxel según el tamaño con que se ve el frasco en esa sección
  const kpx = useRef(0.1);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onPanResponderGrant: () => {
          kpx.current = framesPerPx(base, nodeValue(fly.scale as never, 1));
          drag.stopAnimation((v) => (dragV.current = v));
        },
        onPanResponderMove: (_, g) => drag.setValue(dragV.current + g.dx * kpx.current),
        onPanResponderRelease: (_, g) => spinRelease(g.dx, g.vx),
        onPanResponderTerminate: (_, g) => spinRelease(g.dx, g.vx),
        // mientras se gira, el desplazamiento de la página no le quita el gesto
        onPanResponderTerminationRequest: () => false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drag, reduce, base, fly.scale],
  );
  /** suelta el frasco: sigue girando con inercia y se detiene suave en un cuadro */
  function spinRelease(dx: number, vx: number) {
    const start = dragV.current + dx * kpx.current;
    dragV.current = start;
    const vel = reduce ? 0 : Math.max(-0.12, Math.min(0.12, vx * kpx.current)); // cuadros por ms
    // distancia de frenado de una inercia exponencial (≈ v·τ), y llegada a un cuadro entero
    const to = Math.round(start + vel * 380);
    dragV.current = to;
    Animated.timing(drag, { toValue: to, duration: Math.min(1100, 260 + Math.abs(to - start) * 45), easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }

  /** gira el frasco hasta dejar un punto de frente y abre su tarjeta */
  const focusSpot = (id: string) => {
    const s = spots.find((x) => x.id === id);
    if (!s) return;
    logEvent('ficha_punto', `${p.id}:${id}`);
    const L = layout[current];
    const base = POSES[current]?.rot ?? 0;
    void L;
    const target = frameFacing(s.u) - base; // drag necesario
    // el camino más corto desde el giro actual
    drag.stopAnimation((v) => {
      const cur = v;
      const turns = Math.round((cur - target) / FRAMES);
      const to = target + turns * FRAMES;
      dragV.current = to;
      Animated.spring(drag, { toValue: to, useNativeDriver: true, stiffness: 90, damping: 16 }).start();
    });
    // el valor actual del desplazamiento (para cerrar la tarjeta al alejarse)
    (scrollY as unknown as { __getValue?: () => number }).__getValue && (spotAt.current = (scrollY as unknown as { __getValue: () => number }).__getValue());
    setSpot(s);
  };
  const stepSpot = (d: 1 | -1) => {
    if (!spot) return;
    const i = spots.findIndex((x) => x.id === spot.id);
    focusSpot(spots[(i + d + spots.length) % spots.length].id);
  };

  const goTo = (k: Sec) => {
    const L = layout[k];
    if (!L) return;
    const y = k === 'capsulas' ? openStart + Hs * 0.45 : anchors[k];
    const v = scroll.current as unknown as { scrollTo?: (o: object) => void; getScrollableNode?: () => HTMLElement | null };
    if (Platform.OS === 'web') {
      const node = v?.getScrollableNode?.();
      if (node && typeof Element !== 'undefined' && node instanceof Element) {
        (Element.prototype.scrollTo as (this: Element, o: ScrollToOptions) => void).call(node, { top: y, behavior: reduce ? 'auto' : 'smooth' });
        return;
      }
    }
    v?.scrollTo?.({ y, animated: !reduce });
  };

  const close = () => {
    if (presenting) logEvent('presentacion_cerrada', `${p.id} · ${elapsed}s`);
    goBack(role === 'visitador' ? '/visitador/catalogo' : '/medico');
  };
  const launchAR = async () => {
    logEvent('ar_abierto', N.arId);
    const r = await openAR({ id: N.arId, name: N.name, arTitle: N.arTitle });
    setArTick((t) => t + 1);
    setAr(r);
  };
  const openCard = () => {
    logEvent('ar_tarjeta', p.id);
    Linking.openURL(arCardUrl(p.id)).catch(() => {});
  };
  const actions: { icon: IconName; label: string; onPress: () => void }[] = presenting
    ? [{ icon: 'checkmark-circle-outline', label: 'Terminar presentación', onPress: close }]
    : role === 'medico'
      ? [
          { icon: 'add', label: 'Solicitar', onPress: () => router.push({ pathname: '/solicitud/nueva', params: { productId: p.id } }) },
          { icon: 'chatbubble-outline', label: 'Contactar', onPress: () => router.push(`/chat/${chatWith(labByName(p.lab)?.repId ?? 'v1')}`) },
        ]
      : [
          { icon: 'play-circle-outline', label: 'Presentar', onPress: () => router.push(`/presentacion/${p.id}`) },
          { icon: 'send-outline', label: 'Compartir', onPress: () => setShare(true) },
        ];
  const related = products.filter((x) => x.id !== p.id && x.category === p.category).slice(0, 4);
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const frames = PANCREOGEN.frames[mode];
  const openFrames = PANCREOGEN.open[mode];
  const model = mode === 'real' ? p.bottle?.model : p.bottle?.modelFicticio;
  const col = (x: number) => ({ alignSelf: 'center' as const, width: W, paddingHorizontal: space.xl, ...(x ? {} : {}) });
  // columna de texto al lado contrario del frasco
  const textSide = (k: Sec) => (POSES[k].x > 0.5 ? { paddingRight: W * 0.42 } : { paddingLeft: W * 0.44 });
  const titleName = Math.min(W * 0.17, 96);

  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      <Animated.ScrollView
        ref={scroll as never}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- 1 · PORTADA ---------- */}
        <View onLayout={mark('hero')} style={{ height: Hs, overflow: 'hidden' }}>
          <LinearGradient colors={[C.tealDeep, C.night]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
          <Glow size={Math.min(width, 700) * 1.1} color={C.mint} style={{ position: 'absolute', left: width / 2 - Math.min(width, 700) * 0.55, top: Hs * 0.18 }} opacity={0.22} />
          {/* nombre gigante detrás del frasco: se abre y se desvanece al bajar */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: Hs * 0.2,
              alignItems: 'center',
              opacity: scrollY.interpolate({ inputRange: [0, Hs * 0.5], outputRange: [1, 0], extrapolate: 'clamp' }),
              transform: [{ scale: scrollY.interpolate({ inputRange: [0, Hs * 0.6], outputRange: [1, 1.35], extrapolate: 'clamp' }) }],
            }}
          >
            <Text style={{ fontFamily: font.bold, fontSize: Math.min((width - 12) / (N.name.length * 0.7), 150), letterSpacing: -2, color: C.mint, opacity: 0.18 }} numberOfLines={1}>
              {N.name}
            </Text>
          </Animated.View>
          <View style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 70, alignItems: 'center', paddingHorizontal: space.xl }}>
            <Text style={s.overline}>{N.labLine}</Text>
          </View>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 34, alignItems: 'center' }}>
            <View style={{ width: W, paddingHorizontal: space.xl, gap: space.sm, alignItems: 'center' }}>
              <Text style={{ fontFamily: font.bold, fontSize: 30, lineHeight: 34, color: colors.white, letterSpacing: -0.5, textAlign: 'center' }}>{N.mark}</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: colors.white, opacity: 0.86, textAlign: 'center', maxWidth: 420 }}>{PANCREOGEN.formula}.</Text>
              <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Pill icon="cube-outline" label="Ver en 3D" onPress={() => setFull(true)} color={C.teal} small />
                <Pill icon="scan-outline" label="Ver en AR" onPress={launchAR} variant="outline" color={C.teal} small />
              </View>
              <ScrollHint reduce={reduce} />
            </View>
          </View>
        </View>

        {/* ---------- 2 · EXPLORA ---------- */}
        <Section k="explora" mark={mark} minH={Hs} dark>
          <View style={[col(0), textSide('explora'), { gap: space.md }]}>
            <Reveal show={seen.explora} reduce={reduce}>
              <Text style={[s.overline, { color: C.mint }]}>Explora el frasco</Text>
              <Text style={[s.h1, { color: colors.white }]}>Toca los puntos</Text>
              <Text style={[s.lead, { color: colors.white }]}>Desliza el frasco de lado para girarlo. Cada punto abre lo que está impreso en esa parte de la etiqueta.</Text>
            </Reveal>
            <View style={{ gap: 6, marginTop: space.sm }}>
              {spots.map((x, i) => (
                <Reveal key={x.id} show={seen.explora} reduce={reduce} delay={120 + i * 60}>
                  <Pressable
                    onPress={() => focusSpot(x.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${x.title}: girar el frasco hasta ese punto`}
                    style={({ pressed }) => [s.spotRow, { backgroundColor: spot?.id === x.id ? colors.white : C.veil, opacity: pressed ? 0.75 : 1 }]}
                  >
                    <View style={[s.spotNum, { backgroundColor: spot?.id === x.id ? C.teal : colors.white }]}>
                      <Text style={{ fontFamily: font.bold, fontSize: 11, color: spot?.id === x.id ? colors.white : C.teal }}>{i + 1}</Text>
                    </View>
                    <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13, lineHeight: 17, color: spot?.id === x.id ? C.ink : colors.white }} numberOfLines={2}>
                      {x.title}
                    </Text>
                  </Pressable>
                </Reveal>
              ))}
            </View>
          </View>
        </Section>

        {/* ---------- 3 · 90 CÁPSULAS (el frasco se abre siguiendo el dedo) ---------- */}
        <View onLayout={mark('capsulas')} style={{ height: Hs * 1.9, backgroundColor: C.night }}>
          <LinearGradient colors={[C.night, '#08262A', C.night]} style={StyleSheet.absoluteFill} />
          {/* el contador y los datos se quedan fijos arriba mientras el frasco se abre abajo */}
          <Sticky scrollY={scrollY} start={capsL.y} end={capsL.y + Hs * 1.0} height={Hs * 0.42}>
            <View style={{ alignItems: 'center', paddingTop: insets.top + 58, paddingHorizontal: space.lg }}>
              <Text style={[s.overline, { color: C.mint }]}>Suplemento dietario</Text>
              <CapsCounter scrollY={scrollY} start={openStart} span={Hs * 0.4} size={Math.min(W * 0.36, 150)} />
              <Text style={{ fontFamily: font.bold, fontSize: 20, letterSpacing: 6, color: C.mint, marginTop: -6 }}>CÁPSULAS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: space.md, maxWidth: 460 }}>
                {['3 al día', '30 porciones', '537,56 mg cada una', '48,3 g netos'].map((f, i) => (
                  <Reveal key={f} show={seen.capsulas} reduce={reduce} delay={500 + i * 90}>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: C.veilLine, backgroundColor: C.veil }}>
                      <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.white }}>{f}</Text>
                    </View>
                  </Reveal>
                ))}
              </View>
              <Text style={[s.fine, { color: colors.white, opacity: 0.6, marginTop: space.sm, textAlign: 'center' }]}>Las cápsulas de la animación son ilustrativas.</Text>
            </View>
          </Sticky>
        </View>

        {/* ---------- 4 · COMPOSICIÓN ---------- */}
        <Section k="composicion" mark={mark} minH={Hs * 1.05} bg={C.paper}>
          <View style={[col(0), textSide('composicion'), { gap: space.sm }]}>
            <Reveal show={seen.composicion} reduce={reduce}>
              <Text style={[s.overline, { color: C.teal }]}>Composición por cápsula</Text>
              <Text style={[s.h1, { color: C.ink }]}>Ingredientes</Text>
              <Text style={[s.lead, { color: C.ink }]}>En el orden en que aparecen en el frasco.</Text>
            </Reveal>
            {PANCREOGEN.ingredients.map((g, i) => (
              <Reveal key={g.name} show={seen.composicion} reduce={reduce} delay={100 + i * 55} from="right">
                <View style={[s.ingRow, { borderColor: C.line }]}>
                  <Text style={{ fontFamily: font.bold, fontSize: 12, color: C.teal, width: 22 }}>{String(i + 1).padStart(2, '0')}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.semibold, fontSize: 13.5, lineHeight: 18, color: C.ink }}>{g.name}</Text>
                    {g.detail ? <Text style={{ fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: colors.inkMuted, fontStyle: g.detail.startsWith('Cinnamomum') ? 'italic' : 'normal' }}>{g.detail}</Text> : null}
                  </View>
                </View>
              </Reveal>
            ))}
          </View>
        </Section>

        {/* ---------- 5 · INFORMACIÓN NUTRICIONAL ---------- */}
        <Section k="nutricional" mark={mark} minH={Hs} bg={colors.white}>
          <View style={[col(0), { gap: space.md }]}>
            <View style={{ paddingLeft: W * 0.34 }}>
              <Reveal show={seen.nutricional} reduce={reduce}>
                <Text style={[s.overline, { color: C.teal }]}>Información nutricional</Text>
                <Text style={[s.h1, { color: C.ink }]}>Por porción diaria</Text>
                <Text style={[s.lead, { color: C.ink }]}>
                  {PANCREOGEN.serving}. {PANCREOGEN.servings}.
                </Text>
              </Reveal>
            </View>
            <View style={{ marginTop: Hs * 0.1, gap: 2 }}>
              <View style={{ flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 2, borderColor: C.ink }}>
                <Text style={[s.th, { flex: 1 }]}>Nutriente</Text>
                <Text style={[s.th, { width: 92, textAlign: 'right' }]}>Cantidad</Text>
                <Text style={[s.th, { width: 64, textAlign: 'right' }]}>%VDR</Text>
              </View>
              {PANCREOGEN.nutrition.map((r, i) => (
                <NutrientBar key={r.name} row={r} show={seen.nutricional} reduce={reduce} delay={i * 90} />
              ))}
              <Text style={[s.fine, { marginTop: space.sm }]}>{PANCREOGEN.nutritionNote} Las barras siguen el %VDR impreso en el frasco.</Text>
            </View>
          </View>
        </Section>

        {/* ---------- 6 · MODO DE EMPLEO ---------- */}
        <Section k="modo" mark={mark} minH={Hs} dark>
          <View style={[col(0), textSide('modo'), { gap: space.md }]}>
            <Reveal show={seen.modo} reduce={reduce}>
              <Text style={[s.overline, { color: C.mint }]}>Modo de empleo</Text>
              <Text style={[s.h1, { color: colors.white }]}>Vía oral</Text>
              <Text style={[s.lead, { color: colors.white }]}>Adultos mayores de 18 años.</Text>
            </Reveal>
            <Reveal show={seen.modo} reduce={reduce} delay={150}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: space.sm }}>
                <Text style={{ fontFamily: font.bold, fontSize: 64, lineHeight: 66, color: colors.white, letterSpacing: -3 }}>1</Text>
                <Text style={{ fontFamily: font.semibold, fontSize: 16, color: C.mint, marginBottom: 12 }}>cápsula</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 64, lineHeight: 66, color: colors.white, letterSpacing: -3 }}>3</Text>
                <Text style={{ fontFamily: font.semibold, fontSize: 16, color: C.mint, marginBottom: 12 }}>veces al día</Text>
              </View>
            </Reveal>
            <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.sm }}>
              {[0, 1, 2].map((i) => (
                <CapsuleIcon key={i} show={seen.modo} reduce={reduce} delay={350 + i * 220} />
              ))}
            </View>
            <Text style={[s.fine, { color: colors.white, opacity: 0.75 }]}>«{PANCREOGEN.howTo}»</Text>
          </View>
        </Section>

        {/* ---------- 7 · AVISOS, VITAMINA D Y FABRICANTE ---------- */}
        <Section k="avisos" mark={mark} minH={Hs} bg={C.paper}>
          <View style={[col(0), { gap: space.lg, paddingRight: W * 0.3 }]}>
            <View>
              <Reveal show={seen.avisos} reduce={reduce}>
                <Text style={[s.overline, { color: C.teal }]}>Impreso en el frasco</Text>
                <Text style={[s.h1, { color: C.ink }]}>Avisos</Text>
              </Reveal>
            </View>
            <View style={{ gap: space.sm }}>
              {PANCREOGEN.warnings.map((t, i) => (
                <Reveal key={t} show={seen.avisos} reduce={reduce} delay={100 + i * 70}>
                  <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
                    <Ionicons name="alert-circle" size={20} color={C.teal} style={{ marginTop: 1 }} />
                    <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 15, lineHeight: 21, color: C.ink }}>{t}</Text>
                  </View>
                </Reveal>
              ))}
            </View>
            <Reveal show={seen.avisos} reduce={reduce} delay={500}>
              <View style={{ backgroundColor: C.tealDeep, borderRadius: radius.xl, padding: space.lg, gap: 6 }}>
                <Text style={[s.overline, { color: C.mint }]}>Vitamina D</Text>
                {PANCREOGEN.vitaminD.map((t) => (
                  <Text key={t} style={{ fontFamily: font.semibold, fontSize: 15, lineHeight: 21, color: colors.white }}>
                    {mode === 'real' ? t : t.replace('PANCREOGEN', N.name)}
                  </Text>
                ))}
              </View>
            </Reveal>
            <Reveal show={seen.avisos} reduce={reduce} delay={600}>
              <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: radius.lg, padding: space.lg, gap: 6, backgroundColor: colors.white }}>
                <Text style={[s.overline, { color: C.teal }]}>{mode === 'real' ? 'Fabricante y registro' : 'Producto ficticio'}</Text>
                {mode === 'real' ? (
                  <>
                    {PANCREOGEN.maker.map((t) => (
                      <Text key={t} style={s.small}>
                        {t}
                      </Text>
                    ))}
                    <Text style={[s.small, { fontFamily: font.semibold }]}>{PANCREOGEN.registry}</Text>
                  </>
                ) : (
                  <Text style={s.small}>En la versión ficticia el nombre, el laboratorio, el fabricante, la web y el código de barras están tapados.</Text>
                )}
              </View>
            </Reveal>
          </View>
        </Section>

        {/* ---------- 8 · CIERRE ---------- */}
        <View onLayout={mark('cierre')} style={{ backgroundColor: C.night, paddingBottom: insets.bottom + 96, overflow: 'hidden' }}>
          <LinearGradient colors={[C.paper, C.night]} locations={[0, 0.06]} style={StyleSheet.absoluteFill} />
          <View style={{ height: Hs * 0.6, alignItems: 'center', justifyContent: 'flex-end' }}>
            <Glow size={Math.min(W, 420)} color={C.mint} opacity={0.28} style={{ position: 'absolute', top: Hs * 0.12 }} />
            {/* pedestal de luz donde se apoya el frasco */}
            <View style={{ width: Math.min(W * 0.6, 260), height: 26, borderRadius: 130, backgroundColor: C.tealDeep, borderWidth: 1, borderColor: C.veilLine, marginBottom: Hs * 0.04 }} />
          </View>
          <View style={{ alignSelf: 'center', width: W, paddingHorizontal: space.xl, gap: space.md }}>
            <Text style={[s.overline, { color: C.mint, textAlign: 'center' }]}>Para la visita médica</Text>
            <Text style={{ fontFamily: font.bold, fontSize: titleName * 0.62, lineHeight: titleName * 0.66, color: colors.white, textAlign: 'center', letterSpacing: -1 }}>{N.mark}</Text>
            {actions.map((a, i) => (
              <Pill key={a.label} icon={a.icon} label={a.label} onPress={a.onPress} variant={i === 0 ? 'white' : 'outline'} color={C.teal} wide />
            ))}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Pill icon="expand-outline" label="3D" onPress={() => setFull(true)} variant="outline" color={C.teal} wide small />
              <Pill icon="scan-outline" label="AR" onPress={launchAR} variant="outline" color={C.teal} wide small />
              {mode === 'real' ? <Pill icon="card-outline" label="Tarjeta" onPress={openCard} variant="outline" color={C.teal} wide small /> : null}
            </View>
            {mode === 'real' ? (
              <Pill
                icon="document-text-outline"
                label="Ficha del producto (PDF)"
                onPress={() => {
                  logEvent('ficha_pdf', p.id);
                  Linking.openURL(fichaPdfUrl(p.id)).catch(() => {});
                }}
                variant="outline"
                color={C.teal}
                wide
                small
              />
            ) : null}
            {!presenting ? <Pill icon="albums-outline" label="Diapositivas del producto" onPress={() => router.push({ pathname: '/presentacion/[id]', params: { id: p.id, modo: 'diapositivas' } })} variant="outline" color={C.teal} wide small /> : null}
            <Text style={{ fontFamily: font.regular, fontSize: 12, lineHeight: 18, color: colors.white, opacity: 0.8, textAlign: 'center', marginTop: space.sm }}>
              {N.disclaimer} La app no vende ni entrega medicamentos.
            </Text>
            {related.length && !presenting ? (
              <View style={{ gap: space.sm, marginTop: space.lg }}>
                <Text style={[s.overline, { opacity: 0.85 }]}>También en el catálogo</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
                  {related.map((r) => (
                    <Pressable key={r.id} onPress={() => router.replace(`/producto/${r.id}`)} accessibilityRole="button" accessibilityLabel={`Ver ${r.name}`} style={{ width: 140 }}>
                      <ProductVisual product={r} height={90} />
                      <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.white, marginTop: 6 }} numberOfLines={1}>
                        {r.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </View>

        {/* ---------- el frasco: baja por el catálogo con el desplazamiento ---------- */}
        {/* solo con la ficha a la vista: si se abre otra pantalla encima, el 3D se libera */}
        {focused && (
          <FlyingBottle
            scrollY={scrollY}
            Hs={Hs}
            base={base}
            fly={fly}
            introY={introY}
            bob={bob}
            reduce={reduce}
            hidden={stickyOff}
            landings={[
              { key: 'nut', pose: POSES.nutricional, at: nutA, vis: fly.nutVis, rot: rotNut },
              { key: 'fin', pose: POSES.cierre, at: cierreA, vis: fly.endVis, rot: rotEnd },
            ].map((l) => ({ ...l, left: side + l.pose.x * W, top: l.at + l.pose.y * Hs - base / 2 }))}
            frames={frames}
            model={model}
            panHandlers={pan.panHandlers}
          >
            <Bottle360
              key={mode}
              frames={frames}
              model={model}
              onReady={onBottleReady}
              open={openFrames}
              rot={rot}
              openProgress={openProgress}
              height={base}
              spots={spots}
              showSpots={spotsVis}
              activeSpot={spot?.id ?? null}
              onSpot={focusSpot}
              reduce={reduce}
              spotColor={C.teal}
            />
          </FlyingBottle>
        )}
      </Animated.ScrollView>

      {/* ---------- arriba: volver, cronómetro y nombre real / ficticio ---------- */}
      <View style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm }} pointerEvents="box-none">
        <RoundButton icon={presenting ? 'close' : 'chevron-back'} label={presenting ? 'Terminar presentación' : 'Volver'} onPress={close} color={C.tealDeep} />
        {presenting ? (
          <View style={{ backgroundColor: C.veil, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Ionicons name="time-outline" size={14} color={colors.white} />
            <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.white }}>{mm}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <ModeToggle
          value={mode}
          onChange={(m) => {
            setSpot(null);
            setMode(m);
          }}
          options={[
            { value: 'real', label: 'Nombre real' },
            { value: 'ficticio', label: 'Ficticio' },
          ]}
          color={C.tealDeep}
          veil={'rgba(6, 23, 24, 0.55)'}
        />
      </View>

      {/* índice lateral: una línea por sección; toca para saltar */}
      <SectionRail current={current} onGo={goTo} top={insets.top + 80} />

      {ar ? <ArNote key={arTick} result={ar} pal={PAL} hasCard={mode === 'real'} top={insets.top + 64} reduce={reduce} onDone={() => setAr(null)} /> : null}
      <ActionBar show={bar && !spot} pal={PAL} actions={actions} bottom={insets.bottom} reduce={reduce} />
      <SpotCard spot={spot} index={spot ? spots.findIndex((x) => x.id === spot.id) : 0} total={spots.length} bottom={insets.bottom} reduce={reduce} onClose={() => setSpot(null)} onStep={stepSpot} />

      <Modal visible={full} animationType={reduce ? 'none' : 'fade'} onRequestClose={() => setFull(false)}>
        <BottleViewer frames={frames} model={model} title={N.mark} onClose={() => setFull(false)} reduce={reduce} />
      </Modal>
      <ShareSheet product={p} visible={share} onClose={() => setShare(false)} />
    </View>
  );
}

// ---------- partes ----------

function Section({ k, mark, minH, children, dark, bg }: { k: Sec; mark: (k: Sec) => (e: LayoutChangeEvent) => void; minH: number; children: ReactNode; dark?: boolean; bg?: string }) {
  return (
    <View onLayout={mark(k)} style={{ minHeight: minH, justifyContent: 'center', paddingVertical: space.xxl * 1.5, backgroundColor: bg ?? (dark ? C.night : C.paper), overflow: 'hidden' }}>
      {dark ? <LinearGradient colors={[C.night, '#0A2C2F', C.night]} style={StyleSheet.absoluteFill} /> : null}
      {children}
    </View>
  );
}

/** Aparece subiendo (o desde un lado) la primera vez que su sección entra en pantalla */
function Reveal({ show, reduce, delay = 0, children, from = 'bottom' }: { show: boolean; reduce: boolean; delay?: number; children: ReactNode; from?: 'bottom' | 'right' }) {
  const a = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (!show) return;
    if (reduce) return a.setValue(1);
    Animated.timing(a, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [show, a, reduce, delay]);
  const off = a.interpolate({ inputRange: [0, 1], outputRange: [from === 'right' ? 40 : 22, 0] });
  return <Animated.View style={{ opacity: a, transform: from === 'right' ? [{ translateX: off }] : [{ translateY: off }] }}>{children}</Animated.View>;
}

/** Contenido que se queda fijo en pantalla mientras su contenedor pasa (como position: sticky) */
function Sticky({ scrollY, start, end, height, children }: { scrollY: Animated.Value; start: number; end: number; height: number; children: ReactNode }) {
  // en la web, position: sticky (lo mueve el navegador junto con el desplazamiento, sin retraso)
  if (isWeb)
    return (
      <View style={{ height: end - start + height }} pointerEvents="box-none">
        <View style={{ position: 'sticky' as unknown as 'relative', top: 0, height }}>{children}</View>
      </View>
    );
  return <StickyNative scrollY={scrollY} start={start} end={end} height={height}>{children}</StickyNative>;
}

function StickyNative({ scrollY, start, end, height, children }: { scrollY: Animated.Value; start: number; end: number; height: number; children: ReactNode }) {
  const y = scrollY.interpolate({ inputRange: [start - 1, start, end, end + 1], outputRange: [0, 0, end - start, end - start], extrapolate: 'clamp' });
  return <Animated.View style={{ height, transform: [{ translateY: y }] }}>{children}</Animated.View>;
}

function Glow({ size, color, opacity, style }: { size: number; color: string; opacity: number; style?: object }) {
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="g" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#g)" />
      </Svg>
    </View>
  );
}

function ScrollHint({ reduce }: { reduce: boolean }) {
  const a = useRef(new Animated.Value(0)).current;
  const el = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (reduce) return;
    if (isWeb) return cssAnim(el.current, 'mlHint 1.8s ease-in-out infinite');
    const loop = Animated.loop(Animated.sequence([Animated.timing(a, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(a, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [a, reduce]);
  return (
    <Animated.View ref={(r: unknown) => void (el.current = domEl(r))} style={{ alignItems: 'center', marginTop: space.sm, transform: isWeb ? [] : [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) }] }}>
      <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.white, opacity: 0.75 }}>Desliza: el frasco baja contigo</Text>
      <Ionicons name="chevron-down" size={18} color={colors.white} style={{ opacity: 0.75 }} />
    </Animated.View>
  );
}

interface Fly {
  tx: Animated.AnimatedInterpolation<number>;
  ty: Animated.AnimatedInterpolation<number>;
  scale: Animated.AnimatedInterpolation<number>;
  stickyVis: Animated.AnimatedInterpolation<number>;
}
interface Landing {
  key: string;
  pose: Pose;
  left: number;
  top: number;
  vis: Animated.AnimatedInterpolation<number>;
  rot: Animated.AnimatedAddition<number>;
}

/**
 * El frasco que baja con el desplazamiento. Queda fijo en la pantalla (en la web con position: sticky, que
 * mueve el navegador sin retraso; en iPhone y Android con el desplazamiento en el controlador nativo) y solo
 * su pose (lugar, tamaño y giro) depende del desplazamiento. En la tabla nutricional y en el cierre se
 * cambia por una copia dentro del contenido, que se desplaza con la página.
 */
function FlyingBottle({
  scrollY,
  Hs,
  base,
  fly,
  introY,
  bob,
  reduce,
  hidden,
  landings,
  frames,
  model,
  panHandlers,
  children,
}: {
  scrollY: Animated.Value;
  Hs: number;
  base: number;
  fly: Fly;
  introY: Animated.AnimatedInterpolation<number>;
  bob: Animated.Value;
  reduce: boolean;
  hidden: boolean;
  landings: Landing[];
  frames: Parameters<typeof Bottle360>[0]['frames'];
  model?: string;
  panHandlers: object;
  children: ReactNode;
}) {
  const bw = base * 0.42;
  const outer = useRef<HTMLElement | null>(null);
  const scaler = useRef<HTMLElement | null>(null);
  const bobEls = useRef<(HTMLElement | null)[]>([]);
  const landEls = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    if (!isWeb || reduce) return;
    // la flotación es CSS y va en fase en el frasco y en sus copias (mismo reloj)
    bobEls.current.forEach((el) => cssAnim(el, 'mlBob 3.6s ease-in-out infinite', 3600));
  }, [reduce, landings.length]);
  useEffect(() => {
    // el navegador se queda con el desplazamiento vertical y deja el arrastre lateral para girar el frasco
    if (isWeb && scaler.current) scaler.current.style.touchAction = 'pan-y';
    // capas propias en la GPU: moverlas y escalarlas no vuelve a pintar la página
    if (isWeb) [outer.current, scaler.current].forEach((el) => el && (el.style.willChange = 'transform, opacity'));
  }, []);
  useFrameLoop(() => {
    const vis = nodeValue(fly.stickyVis as never, 1);
    setStyle(outer.current, 'transform', `translate(${nodeValue(fly.tx as never).toFixed(1)}px, ${(nodeValue(fly.ty as never) + nodeValue(introY as never)).toFixed(1)}px)`);
    setStyle(outer.current, 'opacity', vis.toFixed(3));
    setStyle(outer.current, 'visibility', vis < 0.02 ? 'hidden' : 'visible');
    setStyle(scaler.current, 'transform', `scale(${nodeValue(fly.scale as never, 1).toFixed(4)})`);
    landings.forEach((l, i) => {
      const v = nodeValue(l.vis as never);
      setStyle(landEls.current[i], 'opacity', v.toFixed(3));
      setStyle(landEls.current[i], 'visibility', v < 0.02 ? 'hidden' : 'visible');
    });
  });
  const follow = useMemo(() => scrollY.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolateLeft: 'clamp' }), [scrollY]);
  const bobY = useMemo(() => bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }), [bob]);
  const nativeTy = useMemo(() => Animated.add(Animated.add(fly.ty, introY), bobY), [fly.ty, introY, bobY]);

  const copies = landings.map((l, i) =>
    isWeb ? (
      <View key={l.key} ref={(r) => void (landEls.current[i] = domEl(r))} pointerEvents="none" style={{ position: 'absolute', left: l.left, top: l.top, opacity: 0 }}>
        <View ref={(r) => void (bobEls.current[i + 1] = domEl(r))}>
          <View style={{ marginLeft: -bw / 2, transform: [{ scale: l.pose.h / 0.6 }] }}>
            <Bottle360 frames={frames} model={model} rot={l.rot} height={base} spotColor={C.teal} reduce={reduce} />
          </View>
        </View>
      </View>
    ) : (
      <Animated.View key={l.key} pointerEvents="none" style={{ position: 'absolute', left: l.left, top: l.top, opacity: l.vis, transform: [{ translateY: bobY }] }}>
        <View style={{ marginLeft: -bw / 2, transform: [{ scale: l.pose.h / 0.6 }] }}>
          <Bottle360 frames={frames} model={model} rot={l.rot} height={base} spotColor={C.teal} reduce={reduce} />
        </View>
      </Animated.View>
    ),
  );

  if (isWeb)
    return (
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
        <View pointerEvents="box-none" style={{ position: 'sticky' as unknown as 'relative', top: 0, height: Hs }}>
          <View ref={(r) => void (outer.current = domEl(r))} pointerEvents="box-none" style={{ position: 'absolute', left: 0, top: 0, opacity: 0 }}>
            <View ref={(r) => void (bobEls.current[0] = domEl(r))} pointerEvents="box-none">
              <View ref={(r) => void (scaler.current = domEl(r))} style={{ marginLeft: -bw / 2 }} {...panHandlers}>
                {children}
              </View>
            </View>
          </View>
        </View>
        {copies}
      </View>
    );
  return (
    <>
      {copies}
      <Animated.View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Hs, transform: [{ translateY: follow }] }}>
        <Animated.View pointerEvents={hidden ? 'none' : 'box-none'} style={{ position: 'absolute', left: 0, top: 0, opacity: fly.stickyVis, transform: [{ translateX: fly.tx }, { translateY: nativeTy }] }}>
          <Animated.View style={{ marginLeft: -bw / 2, transform: [{ scale: fly.scale }] }} {...panHandlers}>
            {children}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </>
  );
}

/** «90 cápsulas»: cuenta al ritmo del desplazamiento (solo este texto se vuelve a dibujar) */
function CapsCounter({ scrollY, start, span, size }: { scrollY: Animated.Value; start: number; span: number; size: number }) {
  const [c, setC] = useState(0);
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      const pr = Math.max(0, Math.min(1, (value - start) / span));
      setC((prev) => {
        const v = Math.round(PANCREOGEN.capsules * pr);
        return v > prev || pr < 0.01 ? v : prev;
      });
    });
    return () => scrollY.removeListener(id);
  }, [scrollY, start, span]);
  return (
    <Text style={{ fontFamily: font.bold, fontSize: size, lineHeight: size * 1.02, color: colors.white, letterSpacing: -5 }} accessibilityLabel={`${c} cápsulas`}>
      {c}
    </Text>
  );
}

function NutrientBar({ row, show, reduce, delay }: { row: { name: string; qty: string; unit: string; vdr: string }; show: boolean; reduce: boolean; delay: number }) {
  const v = row.vdr === '*' ? null : parseFloat(row.vdr.replace(',', '.'));
  const frac = v === null ? 0 : Math.min(1, v / 975);
  const a = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (!show) return;
    if (reduce) return a.setValue(1);
    Animated.timing(a, { toValue: 1, duration: 900, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [show, a, reduce, delay]);
  return (
    <View style={{ paddingVertical: 7, borderBottomWidth: 1, borderColor: C.line }} accessible accessibilityLabel={`${row.name}: ${row.qty} ${row.unit}, ${row.vdr === '*' ? 'valor diario no establecido' : `${row.vdr} por ciento del valor diario`}`}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13.5, color: C.ink }}>{row.name}</Text>
        <Text style={{ width: 92, textAlign: 'right', fontFamily: font.regular, fontSize: 13, color: C.ink }}>
          {row.qty} {row.unit}
        </Text>
        <Text style={{ width: 64, textAlign: 'right', fontFamily: font.bold, fontSize: 13, color: C.teal }}>{row.vdr}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.paper, marginTop: 6, overflow: 'hidden' }}>
        <Animated.View style={{ height: 6, borderRadius: 3, backgroundColor: C.teal, width: a.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.max(frac * 100, v ? 1.5 : 0)}%`] }) }} />
      </View>
    </View>
  );
}

/** Cápsula dibujada (blanca y teal) que cae y rebota */
function CapsuleIcon({ show, reduce, delay }: { show: boolean; reduce: boolean; delay: number }) {
  const a = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (!show) return;
    if (reduce) return a.setValue(1);
    Animated.spring(a, { toValue: 1, useNativeDriver: true, stiffness: 160, damping: 9, delay } as Animated.SpringAnimationConfig).start();
  }, [show, a, reduce, delay]);
  return (
    <Animated.View style={{ width: 22, height: 54, borderRadius: 11, overflow: 'hidden', opacity: a.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }), transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }, { rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['-35deg', '18deg'] }) }] }}>
      <View style={{ flex: 1, backgroundColor: C.mint }} />
      <View style={{ flex: 1, backgroundColor: colors.white }} />
    </Animated.View>
  );
}

function SectionRail({ current, onGo, top }: { current: Sec; onGo: (k: Sec) => void; top: number }) {
  return (
    <View style={{ position: 'absolute', right: 6, top, gap: 2 }} pointerEvents="box-none">
      {SECS.map((k) => (
        <Pressable key={k} onPress={() => onGo(k)} accessibilityRole="button" accessibilityLabel={`Ir a ${SEC_LABEL[k]}`} hitSlop={4} style={{ paddingVertical: 5, paddingHorizontal: 6, alignItems: 'flex-end' }}>
          <View style={{ width: current === k ? 18 : 8, height: 4, borderRadius: 2, backgroundColor: current === k ? C.mint : 'rgba(255,255,255,0.45)', borderWidth: 0.5, borderColor: 'rgba(6,23,24,0.35)' }} />
        </Pressable>
      ))}
    </View>
  );
}

/** Tarjeta del punto tocado: sube desde abajo; se puede pasar al punto anterior o siguiente */
function SpotCard({ spot, index, total, bottom, reduce, onClose, onStep }: { spot: PanSpot | null; index: number; total: number; bottom: number; reduce: boolean; onClose: () => void; onStep: (d: 1 | -1) => void }) {
  const a = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<PanSpot | null>(spot);
  useEffect(() => {
    if (spot) {
      setShown(spot);
      if (reduce) a.setValue(1);
      else {
        a.setValue(0);
        Animated.spring(a, { toValue: 1, useNativeDriver: true, stiffness: 220, damping: 20 }).start();
      }
    } else if (reduce) setShown(null);
    else Animated.timing(a, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setShown(null));
  }, [spot, a, reduce]);
  if (!shown) return null;
  return (
    <Animated.View
      style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: bottom + space.lg, alignItems: 'center', opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }, { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}
      accessibilityLiveRegion="polite"
    >
      <View style={{ width: '100%', maxWidth: 520, backgroundColor: colors.white, borderRadius: radius.xl, padding: space.lg, gap: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={[s.spotNum, { backgroundColor: C.teal }]}>
            <Text style={{ fontFamily: font.bold, fontSize: 11, color: colors.white }}>{index + 1}</Text>
          </View>
          <Text style={[s.overline, { color: C.teal, flex: 1 }]}>
            {shown.kicker} · punto {index + 1} de {total}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10}>
            <Ionicons name="close" size={20} color={C.ink} />
          </Pressable>
        </View>
        <Text style={{ fontFamily: font.bold, fontSize: 19, lineHeight: 24, color: C.ink }}>{shown.title}</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: C.ink }}>{shown.body}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs }}>
          <Pressable onPress={() => onStep(-1)} accessibilityRole="button" accessibilityLabel="Punto anterior" style={s.stepBtn}>
            <Ionicons name="chevron-back" size={16} color={C.teal} />
            <Text style={s.stepText}>Anterior</Text>
          </Pressable>
          <Pressable onPress={() => onStep(1)} accessibilityRole="button" accessibilityLabel="Punto siguiente" style={s.stepBtn}>
            <Text style={s.stepText}>Siguiente</Text>
            <Ionicons name="chevron-forward" size={16} color={C.teal} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

/** Vista 3D a pantalla completa: arrastrar para girar, botones para girar de a 45° */
export function BottleViewer({ frames, model, title, onClose, reduce }: { frames: Parameters<typeof Bottle360>[0]['frames']; model?: string; title: string; onClose: () => void; reduce: boolean }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const rot = useRef(new Animated.Value(0)).current;
  const v = useRef(0);
  const auto = useRef<Animated.CompositeAnimation | null>(null);
  const spin = (from: number) => {
    if (reduce) return;
    auto.current = Animated.loop(Animated.timing(rot, { toValue: from + FRAMES, duration: 14000, easing: Easing.linear, useNativeDriver: true }));
    rot.setValue(from);
    auto.current.start();
  };
  useEffect(() => {
    spin(0);
    return () => auto.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const h = Math.min(height * 0.72, 720);
  // «Acercar»: el frasco se dibuja más grande (en 3D real sigue nítido) y se recorre arriba y abajo
  const [zoom, setZoom] = useState(false);
  const Z = zoom ? 1.8 : 1;
  const panY = useRef(new Animated.Value(0)).current;
  const py = useRef(0);
  const maxY = (h * (Z - 1)) / 2 + (zoom ? h * 0.08 : 0);
  // la etiqueta sigue al dedo (mismo sentido que en el catálogo) y al soltar sigue con inercia
  const kpx = framesPerPx(h * Z);
  const release = (dx: number, vx: number) => {
    const start = v.current + dx * kpx;
    const vel = reduce ? 0 : Math.max(-0.12, Math.min(0.12, vx * kpx));
    const to = Math.round(start + vel * 380);
    v.current = to;
    Animated.timing(rot, { toValue: to, duration: Math.min(1100, 260 + Math.abs(to - start) * 45), easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          auto.current?.stop();
          rot.stopAnimation((x) => (v.current = x));
          panY.stopAnimation((y) => (py.current = y));
        },
        onPanResponderMove: (_, g) => {
          rot.setValue(v.current + g.dx * kpx);
          if (zoom) panY.setValue(Math.max(-maxY, Math.min(maxY, py.current + g.dy)));
        },
        onPanResponderRelease: (_, g) => {
          release(g.dx, g.vx);
          if (zoom) py.current = Math.max(-maxY, Math.min(maxY, py.current + g.dy));
        },
        onPanResponderTerminate: (_, g) => release(g.dx, g.vx),
        onPanResponderTerminationRequest: () => false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rot, reduce, kpx, zoom, maxY],
  );
  const toggleZoom = () => {
    auto.current?.stop();
    rot.stopAnimation((x) => (v.current = x));
    // al acercar se empieza por la parte de arriba de la etiqueta (marca y nombre)
    const to = zoom ? 0 : h * 0.32;
    py.current = to;
    Animated.timing(panY, { toValue: to, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    setZoom((z) => !z);
  };
  const turn = (d: number) => {
    auto.current?.stop();
    rot.stopAnimation((x) => {
      v.current = Math.round((x + d) / 7.5) * 7.5;
      Animated.timing(rot, { toValue: v.current, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start();
    });
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.night, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <LinearGradient colors={[C.tealDeep, C.night]} style={StyleSheet.absoluteFill} />
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md }}>
        <RoundButton icon="close" label="Cerrar la vista 3D" onPress={onClose} color={C.tealDeep} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 18, color: colors.white }}>{title}</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: colors.white, opacity: 0.8 }}>{zoom ? 'Arrastra de lado para girar y hacia arriba o abajo para recorrer la etiqueta' : 'Arrastra para girar el frasco'}</Text>
        </View>
      </View>
      <View
        ref={(r) => {
          const el = domEl(r);
          if (el) el.style.touchAction = 'none'; // en el visor todo el arrastre gira el frasco
        }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        {...pan.panHandlers}
      >
        <Animated.View style={{ transform: [{ translateY: panY }] }}>
          <Bottle360 frames={frames} model={model} rot={rot} height={h * Z} spotColor={C.teal} reduce={reduce} />
        </Animated.View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm, padding: space.lg }}>
        <Pill icon="arrow-undo-outline" label="Izquierda" onPress={() => turn(-7.5)} variant="outline" color={C.teal} small />
        <Pill icon={zoom ? 'contract-outline' : 'search-outline'} label={zoom ? 'Alejar' : 'Acercar'} onPress={toggleZoom} variant="outline" color={C.teal} small />
        <Pill icon="arrow-redo-outline" label="Derecha" onPress={() => turn(7.5)} variant="outline" color={C.teal} small />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overline: { fontFamily: font.bold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.white, opacity: 0.95 },
  h1: { fontFamily: font.bold, fontSize: 30, lineHeight: 34, letterSpacing: -0.5, marginTop: 2 },
  lead: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, opacity: 0.85, marginTop: 4 },
  th: { fontFamily: font.bold, fontSize: 11, color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  fine: { fontFamily: font.medium, fontSize: 12, lineHeight: 17, color: colors.inkMuted },
  small: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: C.ink },
  spotRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.md },
  spotNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  fact: { minWidth: 120, paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.lg, borderWidth: 1, gap: 1 },
  ingRow: { flexDirection: 'row', gap: space.sm, paddingVertical: 7, borderBottomWidth: 1, alignItems: 'flex-start' },
  stepBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4 },
  stepText: { fontFamily: font.semibold, fontSize: 13, color: C.teal },
});
