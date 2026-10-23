import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Image, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Product3D } from '@/components/Product3D';
import { ProductVisual } from '@/components/ProductVisual';
import { ShareSheet } from '@/components/ShareSheet';
import { AppHeader, Button, EmptyState, IconButton, ListItem, PressableScale, Screen, styles } from '@/components/ui';
import { labByName, labLabel, productById, productNote, products, type Hotspot, type IconName, type Product } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, font, packColors, radius, space, type } from '@/theme';

// Ficha del producto en capítulos (referencia: página de producto con el envase fijo al centro).
// El envase 3D queda quieto en pantalla mientras la ficha se desplaza: se mueve, gira hacia la cara
// que corresponde a cada capítulo y detrás pasan títulos gigantes. Cifras grandes en un recuadro,
// notas en manchas de tinta, pasos, avisos y la presentación en fila.

type Face = Hotspot['face'];
interface Ch {
  key: string;
  heading?: string; // título gigante detrás del envase
  face: Face | null; // cara que muestra el envase (null: gira solo)
  x: number; // posición del envase (fracción del ancho, desde el centro)
  y: number; // centro vertical del envase (fracción de la altura visible)
  s: number; // escala del envase
  o?: number; // opacidad del envase
}

/** colores de la ficha: los del empaque si el producto tiene fotos; si no, los del producto ficticio */
function paletteOf(p: Product) {
  if (p.photo) {
    const C = packColors.coraessens;
    return { ink: C.red, deep: C.purpleDeep, soft: C.line, paper: C.blush, text: C.ink };
  }
  const ink = p.hue === colors.turquesa ? colors.primary : p.hue;
  return { ink, deep: ink === colors.petroleo ? colors.primary : colors.petroleo, soft: colors.border, paper: colors.bg, text: colors.ink };
}

/** cifras grandes: las del producto o, si no tiene, armadas con sus datos */
function specsOf(p: Product) {
  if (p.specs?.length) return p.specs;
  const qty = p.form.match(/(\d+(?:[.,]\d+)?)\s?(ml|g|mg|cápsulas)/i);
  return [
    { value: qty ? `${qty[1]} ${qty[2]}` : p.form.split('·')[0].trim(), label: 'Presentación', note: p.form },
    { value: p.component.split(' ')[0], label: 'Componente principal', note: p.component },
    { value: p.concentration === 'No aplica' ? '—' : p.concentration, label: 'Concentración', note: p.concentration === 'No aplica' ? 'No aplica a este producto' : 'Por unidad' },
  ];
}

const complete = (o: number[], n: number) => {
  const a = Array.from({ length: n }, (_, i) => o[i]);
  return a.every((v, i) => typeof v === 'number' && (i === 0 || v > a[i - 1]));
};

export default function Producto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = productById(id);
  const { role, chatWith, logEvent } = useMine();
  const { width, height } = useWindowDimensions();
  const [share, setShare] = useState(false);
  const [vh, setVh] = useState(Math.max(480, height - 170)); // alto visible entre la cabecera y los botones
  const [offsets, setOffsets] = useState<number[]>([]);
  const [chapter, setChapter] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scroll = useRef<ScrollView>(null);
  const W = Math.min(width, 640);

  const chapters: Ch[] = useMemo(() => {
    if (!p) return [];
    const real = !!p.photo;
    return [
      { key: 'portada', heading: p.name.split(' ')[0].toUpperCase(), face: null, x: 0, y: 0.38, s: 1.05 },
      { key: 'cifras', face: 'front', x: 0.25, y: 0.42, s: 0.78 },
      { key: 'descripcion', heading: real ? 'FÓRMULA' : 'DESCRIPCIÓN', face: real ? 'back' : 'front', x: -0.2, y: 0.3, s: 0.7 },
      { key: 'componentes', heading: real ? 'COMPONENTES' : 'USOS', face: real ? 'left' : 'right', x: 0, y: 0.45, s: 0.86 },
      { key: 'uso', heading: 'MODO DE USO', face: real ? 'left' : 'back', x: 0.22, y: 0.3, s: 0.68 },
      { key: 'avisos', heading: 'AVISOS', face: 'back', x: -0.22, y: 0.3, s: 0.68 },
      { key: 'presentacion', face: null, x: 0, y: 0.2, s: 0.4, o: 0 },
      { key: 'recursos', face: null, x: 0, y: 0.2, s: 0.4, o: 0 },
    ];
  }, [p]);

  // capítulo actual según el desplazamiento (para girar el envase hacia su cara)
  useEffect(() => {
    if (!complete(offsets, chapters.length)) return;
    const id = scrollY.addListener(({ value }) => {
      const mid = value + vh * 0.45;
      let i = 0;
      for (let k = 0; k < offsets.length; k++) if (mid >= offsets[k]) i = k;
      setChapter((c) => (c === i ? c : i));
    });
    return () => scrollY.removeListener(id);
  }, [scrollY, offsets, vh, chapters.length]);

  useEffect(() => {
    if (chapters[chapter]) logEvent('ficha_seccion', chapters[chapter].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter]);

  if (!p) {
    return (
      <Screen header={<AppHeader title="Producto" />}>
        <EmptyState icon="alert-circle-outline" title="Producto no encontrado" body="Es posible que ya no esté en el catálogo." />
      </Screen>
    );
  }

  const pal = paletteOf(p);
  const related = products.filter((x) => x.id !== p.id && (x.category === p.category || x.lab === p.lab)).slice(0, 4);
  const open3D = () => {
    logEvent('visor_3d_abierto', p.id);
    router.push(`/visor/${p.id}`);
  };
  const openAR = () => router.push(`/ar/${p.id}`);
  // listo cuando se midieron todos los capítulos y sus posiciones van en aumento
  const ready = complete(offsets, chapters.length);
  const faceIndex = (f: Face | null) => (f ? (p.hotspots ?? []).findIndex((h) => h.face === f) : -1);
  const active = faceIndex(chapters[chapter]?.face ?? null);

  // ---------- interpolaciones del envase ----------
  const anim = (pick: (c: Ch) => number) =>
    ready
      ? scrollY.interpolate({ inputRange: offsets, outputRange: chapters.map(pick), extrapolate: 'clamp' })
      : pick(chapters[0]);
  const stageH = vh * 0.62;
  const prodX = anim((c) => c.x * W);
  const prodY = anim((c) => c.y * vh - stageH / 2);
  const prodS = anim((c) => c.s);
  const prodO = anim((c) => c.o ?? 1);

  const onChapter = (i: number) => (e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    setOffsets((o) => {
      if (o[i] === y) return o;
      const n = [...o];
      n[i] = y;
      return n;
    });
  };
  const chapterBox = (i: number, extra?: object) => ({ onLayout: onChapter(i), style: [{ minHeight: vh, width: W, alignSelf: 'center' as const }, extra] });

  // los títulos gigantes ocupan casi todo el ancho sin cortarse (Montserrat Bold en mayúsculas)
  const giant = (t: string) => Math.min(W * 0.26, (W - 12) / (t.length * 0.8));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: pal.paper }} edges={['top', 'left', 'right']}>
      <AppHeader
        title={p.name}
        subtitle={`${p.lab} · ${p.category}`}
        right={<IconButton icon="share-social-outline" label="Compartir ficha" onPress={() => setShare(true)} />}
      />

      <View style={{ flex: 1 }} onLayout={(e) => setVh(e.nativeEvent.layout.height)}>
        {/* ---------- escenario fijo: títulos gigantes y envase ---------- */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {ready
            ? chapters.map((c, i) =>
                c.heading ? (
                  <Animated.Text
                    key={c.key}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: c.y * vh - giant(c.heading) * 0.62,
                      textAlign: 'center',
                      fontFamily: font.bold,
                      fontSize: giant(c.heading),
                      lineHeight: giant(c.heading) * 1.1,
                      letterSpacing: -giant(c.heading) * 0.045,
                      color: pal.ink,
                      opacity: scrollY.interpolate({
                        inputRange: [offsets[i] - vh * 0.55, offsets[i] - vh * 0.15, offsets[i] + vh * 0.25, offsets[i] + vh * 0.6],
                        outputRange: [0, 1, 1, 0],
                        extrapolate: 'clamp',
                      }),
                      transform: [
                        {
                          translateY: scrollY.interpolate({
                            inputRange: [offsets[i] - vh * 0.55, offsets[i] + vh * 0.6],
                            outputRange: [vh * 0.12, -vh * 0.12],
                            extrapolate: 'clamp',
                          }),
                        },
                      ],
                    }}
                  >
                    {c.heading}
                  </Animated.Text>
                ) : null,
              )
            : null}
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              alignItems: 'center',
              opacity: prodO,
              transform: [{ translateX: prodX }, { translateY: prodY }, { scale: prodS }],
            }}
          >
            <Product3D product={p} width={W} height={stageH} interactive={false} autoRotate zoom={1.25} active={active >= 0 ? active : null} />
          </Animated.View>
        </View>

        {/* ---------- capítulos ---------- */}
        <Animated.ScrollView
          ref={scroll as never}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          contentContainerStyle={{ paddingBottom: space.xxl }}
        >
          {/* 0 · portada */}
          <View {...chapterBox(0, { justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
              <Text style={[s.kicker, { color: pal.ink }]}>{p.category}</Text>
              <View style={[s.chip, { borderColor: pal.ink }]}>
                <Text style={[s.chipText, { color: pal.ink }]}>{productNote(p)}</Text>
              </View>
              {p.isNew ? (
                <View style={[s.chip, { backgroundColor: pal.ink, borderColor: pal.ink }]}>
                  <Text style={[s.chipText, { color: colors.white }]}>Nuevo</Text>
                </View>
              ) : null}
            </View>
            <View style={{ gap: space.md }}>
              <Text style={{ fontFamily: font.bold, fontSize: 30, lineHeight: 34, color: pal.text, letterSpacing: -0.5 }}>{p.name}</Text>
              <Text style={[type.body, { color: pal.text }]}>{p.tagline}</Text>
              <Text style={type.caption}>{p.real ? p.real.note : `${labLabel(p)} · Producto y datos ficticios · Prototipo académico`}</Text>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                <Chip icon="cube-outline" label="3D · 360°" onPress={open3D} color={pal.ink} filled />
                <Chip icon="scan-outline" label="Ver en AR" onPress={openAR} color={pal.deep} filled />
                {p.photo ? <Chip icon="sparkles-outline" label="Vitrina 3D" onPress={() => router.push(p.photo!.vitrina as never)} color={pal.ink} /> : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: space.sm }}>
                <Ionicons name="chevron-down" size={16} color={colors.inkMuted} />
                <Text style={type.caption}>Desliza para recorrer la ficha</Text>
              </View>
            </View>
          </View>

          {/* 1 · cifras en recuadro */}
          <View {...chapterBox(1, { paddingHorizontal: space.lg, justifyContent: 'center' })}>
            <View style={{ width: '58%', gap: space.md }}>
              <Text style={[s.script, { color: pal.ink }]}>Ficha técnica</Text>
              <Text style={{ fontFamily: font.bold, fontSize: 34, lineHeight: 36, color: pal.text, letterSpacing: -1 }}>{p.form.split('·')[0].trim().toUpperCase()}</Text>
              <View style={{ borderWidth: 2, borderColor: pal.text, padding: 4, backgroundColor: pal.paper }}>
                <View style={{ borderWidth: 1, borderColor: pal.text, paddingHorizontal: space.md, paddingVertical: space.sm }}>
                  {specsOf(p).map((sp, i) => (
                    <View key={sp.label} style={{ paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderColor: pal.text }}>
                      <Text style={{ fontFamily: font.bold, fontSize: 10, letterSpacing: 0.8, color: pal.text, textTransform: 'uppercase' }}>{sp.label}</Text>
                      <Text style={{ fontFamily: font.bold, fontSize: sp.value.length > 7 ? 22 : 30, lineHeight: 36, color: pal.text, letterSpacing: -1 }} numberOfLines={1}>
                        {sp.value}
                      </Text>
                      <Text style={{ fontFamily: font.regular, fontSize: 11, lineHeight: 15, color: colors.inkMuted }}>{sp.note}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* 2 · descripción */}
          <View {...chapterBox(2, { paddingHorizontal: space.lg, paddingTop: vh * 0.6, gap: space.md })}>
            <Text style={[type.body, { color: pal.text }]}>{p.description}</Text>
            <View style={{ gap: space.sm, borderLeftWidth: 3, borderColor: pal.ink, paddingLeft: space.md }}>
              <Data label="Laboratorio" value={labLabel(p)} />
              <Data label="Presentación" value={p.form} />
              <Data label="Componente principal" value={p.component} />
              <Data label="Concentración" value={p.concentration} />
            </View>
          </View>

          {/* 3 · manchas de tinta con los componentes o los usos */}
          <View {...chapterBox(3)}>
            <Splats p={p} pal={pal} w={W} h={vh} />
          </View>

          {/* 4 · modo de uso */}
          <View {...chapterBox(4, { paddingHorizontal: space.lg, paddingTop: vh * 0.6, gap: space.md })}>
            {p.howTo.map((step, i) => (
              <View key={step} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
                <Text style={{ fontFamily: font.bold, fontSize: 40, lineHeight: 42, color: pal.ink, width: 44 }}>{i + 1}</Text>
                <Text style={[type.body, { flex: 1, color: pal.text, paddingTop: 8 }]}>{step}</Text>
              </View>
            ))}
          </View>

          {/* 5 · avisos */}
          <View {...chapterBox(5, { paddingHorizontal: space.lg, paddingTop: vh * 0.6, gap: space.sm })}>
            {p.precautions.map((t) => (
              <View key={t} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
                <Ionicons name="alert-circle" size={20} color={pal.ink} style={{ marginTop: 1 }} />
                <Text style={[type.body, { flex: 1, color: pal.text }]}>{t}</Text>
              </View>
            ))}
            <Text style={[type.caption, { marginTop: space.sm }]}>
              {p.real ? 'Texto impreso en el empaque. Consulte siempre la documentación oficial del producto.' : 'Información general de ejemplo. Consulte siempre la documentación oficial del producto.'}
            </Text>
          </View>

          {/* 6 · presentación en fila */}
          <View {...chapterBox(6, { paddingTop: space.xl, gap: space.lg })}>
            <Text style={[s.script, { color: pal.ink, textAlign: 'center' }]}>Así se presenta</Text>
            <Text style={{ fontFamily: font.bold, fontSize: giant('PRESENTACIÓN'), color: pal.text, textAlign: 'center', letterSpacing: -giant('PRESENTACIÓN') * 0.045 }}>
              PRESENTACIÓN
            </Text>
            <Lineup p={p} pal={pal} w={W} />
          </View>

          {/* 7 · recursos y relacionados */}
          <View {...chapterBox(7, { paddingHorizontal: space.lg, gap: space.sm, minHeight: undefined })}>
            <Text style={[s.script, { color: pal.ink }]}>Recursos</Text>
            <ListItem icon="albums-outline" title="Modo presentación" subtitle={`${p.slides.length} diapositivas interactivas`} onPress={() => router.push(`/presentacion/${p.id}`)} />
            <ListItem icon="cube-outline" title="Visor 3D · 360°" subtitle="Gira el envase y explora sus puntos" onPress={open3D} />
            <ListItem icon="scan-outline" title="Realidad aumentada" subtitle="Coloca el envase sobre una superficie real con la cámara" onPress={openAR} />
            {p.photo ? <ListItem icon="sparkles-outline" title="Vitrina 3D" subtitle="Catálogo con las fotos del empaque" onPress={() => router.push(p.photo!.vitrina as never)} /> : null}
            {p.docs.map((d) => (
              <ListItem
                key={d}
                icon={d.endsWith('.png') ? 'image-outline' : 'document-outline'}
                title={d}
                subtitle={p.real ? 'Material del producto' : 'Documento de demostración'}
                onPress={() =>
                  p.photo && d.endsWith('.png')
                    ? router.push(p.photo.vitrina as never)
                    : Alert.alert('Documento de demostración', 'En una versión con servidor aquí se abriría el documento autorizado del laboratorio.')
                }
              />
            ))}
            {related.length ? (
              <>
                <Text style={[type.h3, { marginTop: space.lg }]}>Productos relacionados</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
                  {related.map((r) => (
                    <PressableScale key={r.id} onPress={() => router.replace(`/producto/${r.id}`)} style={{ width: 150 }} accessibilityLabel={`Ver ${r.name}`}>
                      <ProductVisual product={r} height={96} />
                      <Text style={[type.label, { marginTop: 6 }]} numberOfLines={1}>
                        {r.name}
                      </Text>
                    </PressableScale>
                  ))}
                </ScrollView>
              </>
            ) : null}
          </View>
        </Animated.ScrollView>

        {/* índice de capítulos */}
        <View pointerEvents="none" style={{ position: 'absolute', left: 6, top: vh * 0.3, gap: 6 }}>
          {chapters.map((c, i) => (
            <View key={c.key} style={{ width: 4, height: i === chapter ? 22 : 8, borderRadius: 2, backgroundColor: i === chapter ? pal.ink : pal.soft }} />
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        {role === 'medico' ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Contactar" variant="secondary" icon="chatbubble-outline" onPress={() => router.push(`/chat/${chatWith(labByName(p.lab)?.repId ?? 'v1')}`)} />
            </View>
            <View style={{ flex: 1.3 }}>
              <Button label="Solicitar" icon="add" onPress={() => router.push({ pathname: '/solicitud/nueva', params: { productId: p.id } })} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Compartir" variant="secondary" icon="send-outline" onPress={() => setShare(true)} />
            </View>
            <View style={{ flex: 1.3 }}>
              <Button label="Presentar" icon="play-circle-outline" onPress={() => router.push(`/presentacion/${p.id}`)} />
            </View>
          </View>
        )}
      </View>

      <ShareSheet product={p} visible={share} onClose={() => setShare(false)} />
    </SafeAreaView>
  );
}

// ---------- partes ----------

type Pal = ReturnType<typeof paletteOf>;

function Chip({ icon, label, onPress, color, filled }: { icon: IconName; label: string; onPress: () => void; color: string; filled?: boolean }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 40, borderRadius: radius.pill, backgroundColor: filled ? color : 'transparent', borderWidth: 1.5, borderColor: color }}
    >
      <Ionicons name={icon} size={16} color={filled ? colors.white : color} />
      <Text style={{ fontFamily: font.bold, fontSize: 13, color: filled ? colors.white : color }}>{label}</Text>
    </PressableScale>
  );
}

function Data({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 1 }}>
      <Text style={type.caption}>{label}</Text>
      <Text style={type.label}>{value}</Text>
    </View>
  );
}

// forma de mancha de tinta con goteos (semilla fija: siempre la misma forma)
function blob(seed: number, r: number) {
  let t = seed;
  const rnd = () => {
    t = (t * 16807) % 2147483647;
    return (t - 1) / 2147483646;
  };
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
  // gotas sueltas
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

function Splats({ p, pal, w, h }: { p: Product; pal: Pal; w: number; h: number }) {
  const notes = p.notes?.length ? p.notes : p.uses.map((u, i) => ({ title: `Uso ${i + 1}`, text: u }));
  // posiciones alrededor del envase (que está al centro)
  const spots = [
    { x: 0.02, y: 0.04, r: 0.24 },
    { x: 0.56, y: 0.1, r: 0.21 },
    { x: 0.0, y: 0.5, r: 0.21 },
    { x: 0.58, y: 0.56, r: 0.22 },
    { x: 0.28, y: 0.76, r: 0.2 },
  ];
  return (
    <View style={{ height: h, width: w }}>
      {notes.slice(0, spots.length).map((n, i) => {
        const sp = spots[i];
        const R = Math.min(w * sp.r, h * 0.17);
        const fill = i % 2 ? pal.deep : pal.ink;
        return (
          <View key={n.title} style={{ position: 'absolute', left: sp.x * w, top: sp.y * h, width: R * 2.4, height: R * 2.4 }}>
            <Svg width={R * 2.4} height={R * 2.4} style={{ position: 'absolute' }}>
              <Path d={blob(31 + i * 17, R)} fill={fill} transform={`translate(${R * 0.2},${R * 0.2})`} />
            </Svg>
            <View style={{ position: 'absolute', left: R * 0.45, right: R * 0.45, top: R * 0.55, bottom: R * 0.45, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 0.6, color: colors.white, textTransform: 'uppercase', textAlign: 'center' }}>{n.title}</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 10.5, lineHeight: 14, color: colors.white, textAlign: 'center' }} numberOfLines={5}>
                {n.text}
              </Text>
            </View>
          </View>
        );
      })}
      {!p.real ? <Text style={[type.caption, { position: 'absolute', bottom: space.md, left: space.lg, right: space.lg, textAlign: 'center' }]}>Texto de ejemplo: no corresponde a indicaciones aprobadas.</Text> : null}
    </View>
  );
}

function Lineup({ p, pal, w }: { p: Product; pal: Pal; w: number }) {
  const items = p.photo
    ? [
        { key: 'front', label: 'Frente', sub: '9 cápsulas' },
        { key: 'left', label: 'Composición', sub: 'Modo de empleo' },
        { key: 'right', label: 'Nutricional', sub: 'Porción diaria' },
        { key: 'back', label: 'Reverso', sub: 'Advertencias y lote' },
      ]
    : [
        { key: 'v0', label: 'Envase', sub: p.form.split('·')[1]?.trim() ?? p.form },
        { key: 'v1', label: 'Detalle', sub: p.component },
        { key: 'v2', label: 'Formato', sub: p.form.split('·')[0].trim() },
      ];
  const cw = Math.min(150, w * 0.38);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.lg, paddingHorizontal: space.lg, alignItems: 'flex-end' }}>
      {items.map((it, i) => (
        <View key={it.key} style={{ width: cw, alignItems: 'center', gap: 6 }}>
          {p.photo ? (
            <Image
              source={p.photo.textures[it.key as 'front']}
              style={{ width: cw * 0.78, height: cw * 0.78 * 1.447, borderRadius: 4, transform: [{ rotate: i % 2 ? '3deg' : '-3deg' }] }}
              accessibilityLabel={`${it.label} del empaque`}
            />
          ) : (
            <View style={{ width: cw }}>
              <ProductVisual product={p} height={cw * 1.1} view={i} />
            </View>
          )}
          <View style={{ width: 26, height: 3, borderRadius: 2, backgroundColor: pal.ink, marginTop: 4 }} />
          <Text style={{ fontFamily: font.bold, fontSize: 13, color: pal.text, textAlign: 'center' }}>{it.label}</Text>
          <Text style={[type.caption, { textAlign: 'center' }]} numberOfLines={2}>
            {it.sub}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  kicker: { fontFamily: font.bold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontFamily: font.semibold, fontSize: 11 },
  script: { fontFamily: font.semibold, fontSize: 15, fontStyle: 'italic' },
});
