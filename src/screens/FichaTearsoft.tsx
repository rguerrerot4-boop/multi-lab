import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Animated, Easing, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import type { BoxTextures } from '@/components/PhotoBox3D';
import { ProductVisual } from '@/components/ProductVisual';
import { ShareSheet } from '@/components/ShareSheet';
import { TearBox } from '@/components/TearBox';
import { ModeToggle, Pill, RoundButton, useReduceMotion } from '@/components/showcase';
import { goBack } from '@/components/ui';
import type { FichaPal } from '@/data/ficha';
import { labByName, products, type Product } from '@/data/mock';
import { TEARSOFT } from '@/data/tearsoft';
import { teaSpots, type TeaSpot } from '@/data/tearsoft-info';
import type { VitrinaMode } from '@/data/vitrina';
import { arCardUrl, fichaPdfUrl, openAR, type ArResult } from '@/lib/ar';
import { cssAnim, domEl, isWeb } from '@/lib/webAnim';
import { ArNote } from '@/screens/Ficha';
import { useMine } from '@/store/AppStore';
import { colors, font, packColors, radius, space } from '@/theme';

// Catálogo de TEARSOFT (Procaps), distinto de la ficha de CORAESSENS y del catálogo con scroll de PANCREOGEN:
// es una historia de 7 páginas que se pasan de lado (como las historias de las referencias de cosmética), con
// número grande en cada página, tarjetas de vidrio sobre el producto (referencia de las fichas deportivas),
// listas técnicas con cruces (referencia de catálogos de cámaras), un arco con los excipientes y la caja en 3D
// real: flota con gotas a su alrededor y se despliega en su troquel. Todo el texto está tomado de la caja
// (src/data/tearsoft-info.ts); no se agregan indicaciones ni afirmaciones.

const C = packColors.tearsoft;
type IconName = ComponentProps<typeof Ionicons>['name'];
type PageKey = 'portada' | 'composicion' | 'uso' | 'indicacion' | 'avisos' | 'caja' | 'cierre';
const PAGES: { key: PageKey; label: string }[] = [
  { key: 'portada', label: 'Portada' },
  { key: 'composicion', label: 'Composición' },
  { key: 'uso', label: 'Dosificación' },
  { key: 'indicacion', label: 'Indicación' },
  { key: 'avisos', label: 'Advertencias' },
  { key: 'caja', label: 'El empaque' },
  { key: 'cierre', label: 'Para la visita' },
];
const num = (i: number) => String(i + 1).padStart(2, '0');

/** colores con la forma de la ficha (para el aviso de AR) */
const PAL: FichaPal = { main: C.navy, mainDeep: C.navyDeep, bg: C.navy, bgDeep: C.navyDeep, paper: C.paper, line: C.line, ink: C.ink, giant: C.navy, veil: C.veil, veilLine: C.veilLine };

export default function FichaTearsoft({ product: p, presenting = false, visita, initialMode }: { product: Product; presenting?: boolean; visita?: string; initialMode?: VitrinaMode }) {
  const { role, chatWith, logEvent, visits, updateReport } = useMine();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const focused = useIsFocused();
  const [mode, setMode] = useState<VitrinaMode>(initialMode ?? 'real');
  const N = TEARSOFT.names[mode];
  const I = TEARSOFT;
  const tex = TEARSOFT.textures[mode];
  const spots = useMemo(() => teaSpots(mode), [mode]);
  const W = Math.min(width, 620); // columna de contenido (en pantallas anchas se centra)
  const Hs = Math.max(560, height);

  const pager = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [ar, setAr] = useState<ArResult | null>(null);
  const [arTick, setArTick] = useState(0);
  const [share, setShare] = useState(false);
  const [full, setFull] = useState(false);
  const [fold, setFold] = useState(1); // caja de la página «El empaque»
  const [spot, setSpot] = useState<TeaSpot | null>(null);
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

  // mientras el paso de página lo hace un botón, el desplazamiento intermedio no cambia el número
  const target = useRef<number | null>(null);
  const goTo = (i: number) => {
    const k = Math.max(0, Math.min(PAGES.length - 1, i));
    target.current = k;
    pager.current?.scrollTo({ x: k * width, animated: !reduce });
    setPage(k);
    setTimeout(() => (target.current = null), 900);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    if (target.current !== null) {
      if (Math.abs(x - target.current * width) < 2) target.current = null;
      return;
    }
    const k = Math.round(x / Math.max(1, width));
    if (k !== page && k >= 0 && k < PAGES.length) setPage(k);
  };
  useEffect(() => {
    logEvent('ficha_pagina', `${p.id}:${PAGES[page].key}`);
    if (PAGES[page].key !== 'caja') setSpot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  // al cambiar el tamaño de la ventana, la página actual se mantiene
  useEffect(() => {
    pager.current?.scrollTo({ x: page * width, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);
  // flechas del teclado en la computadora
  useEffect(() => {
    if (!isWeb || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (full || share) return;
      if (e.key === 'ArrowRight') goTo(page + 1);
      if (e.key === 'ArrowLeft') goTo(page - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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
  // tarjeta impresa (AR en el navegador) y ficha en PDF: solo con el nombre real
  const openCard = () => {
    logEvent('ar_tarjeta', p.id);
    Linking.openURL(arCardUrl(p.id)).catch(() => {});
  };
  const openPdf = () => {
    logEvent('ficha_pdf', p.id);
    Linking.openURL(fichaPdfUrl(p.id)).catch(() => {});
  };
  const related = products.filter((x) => x.id !== p.id && x.real).slice(0, 4);
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const top = insets.top + 108; // debajo de la cabecera y la barra de progreso
  const bottom = insets.bottom + 92; // encima de la navegación
  const near = (i: number) => focused && Math.abs(page - i) <= 1;

  const pickSpot = (s: TeaSpot) => {
    logEvent('ficha_punto', `${p.id}:${s.id}`);
    setSpot((cur) => (cur?.id === s.id ? null : s));
    setFold(0);
  };

  // ---------- páginas ----------
  const pages: Record<PageKey, ReactNode> = {
    portada: (
      <Page i={0} width={width} Hs={Hs} top={top} bottom={bottom} swoosh="low">
        <View style={{ width: W, alignSelf: 'center', paddingHorizontal: space.xl, gap: space.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Chip label={N.lab.toUpperCase()} solid />
            <Chip label="SOLUCIÓN OFTÁLMICA" />
            <Chip label={I.front.volume} />
          </View>
        </View>
        <Hero name={N.name} width={width} W={W} stage={Math.min(Hs * 0.5, 470)} reduce={reduce} ring={`${mode === 'real' ? 'TEARSOFT®' : N.name} · SOLUCIÓN OFTÁLMICA · ${I.front.volume} · `}>
          {near(0) ? <TearBox textures={tex} dims={I.dims} width={W} height={Math.min(Hs * 0.5, 470)} drops active={page === 0 && !full} reduce={reduce} zoom={1.05} /> : null}
        </Hero>
        <View style={{ width: W, alignSelf: 'center', paddingHorizontal: space.xl, gap: space.sm }}>
          <BigNum i={0} />
          <Text style={st.mark}>{N.mark}</Text>
          <Text style={st.lead}>{mode === 'real' ? `${N.lab.toUpperCase()} · ${I.front.active}` : `${N.lab} · ${I.front.active}`}</Text>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: space.xs }}>
            <Pill icon="cube-outline" label="Ver en 3D" onPress={() => setFull(true)} variant="solid" color={C.navy} small />
            <Pill icon="scan-outline" label="Ver en AR" onPress={launchAR} variant="outlineColor" color={C.navy} small />
          </View>
          <View style={st.sample}>
            <Ionicons name="medkit-outline" size={14} color={C.navy} />
            <Text style={st.sampleText}>Muestra médica · prohibida su venta</Text>
          </View>
          {page === 0 ? <SwipeHint reduce={reduce} /> : null}
        </View>
      </Page>
    ),

    composicion: (
      <Page i={1} width={width} Hs={Hs} top={top} bottom={bottom} swoosh="high">
        <View style={{ width: W, alignSelf: 'center', paddingHorizontal: space.xl, gap: space.lg }}>
          <Kicker i={1} text="Composición" />
          <Text style={st.h1}>Cada mL contiene</Text>
          <Glass style={{ padding: space.xl, gap: 2 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 64, lineHeight: 68, color: C.navy, letterSpacing: -2 }}>{I.activeQty}</Text>
            <Text style={{ fontFamily: font.bold, fontSize: 18, lineHeight: 24, color: C.ink }}>{I.activeName}</Text>
            <Text style={[st.small, { marginTop: 6 }]}>«{I.composition}»</Text>
          </Glass>
          <Text style={st.overline}>Excipientes</Text>
          <Arc items={I.excipients} width={W - space.xl * 2} />
          <Glass style={{ padding: space.lg, flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <IconSquare icon="flask-outline" />
            <View style={{ flex: 1 }}>
              <Text style={st.cardTitle}>FORMA FARMACÉUTICA</Text>
              <Text style={st.body}>{cap(I.pharmaForm)}</Text>
            </View>
          </Glass>
        </View>
      </Page>
    ),

    uso: (
      <Page i={2} width={width} Hs={Hs} top={top} bottom={bottom} swoosh="mid">
        <View style={{ width: W, alignSelf: 'center', paddingHorizontal: space.xl, gap: space.lg }}>
          <Kicker i={2} text="Dosificación" />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.md }}>
            <Text style={{ fontFamily: font.bold, fontSize: 92, lineHeight: 92, color: C.navy, letterSpacing: -4 }}>1–2</Text>
            <View style={{ paddingBottom: 12 }}>
              <FallingDrop reduce={reduce || page !== 2} />
              <Text style={{ fontFamily: font.bold, fontSize: 22, color: C.navy }}>gotas</Text>
            </View>
          </View>
          <Text style={st.lead}>{cap(I.dosage)}</Text>
          <Glass style={{ padding: space.lg, gap: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <IconSquare icon="water-outline" />
              <View style={{ flex: 1 }}>
                <Text style={st.cardTitle}>GOTAS POR mL</Text>
                <Text style={[st.body, { fontFamily: font.bold }]}>{I.drops}</Text>
              </View>
            </View>
            <DropGrid count={20} />
          </Glass>
          <Glass style={{ padding: space.lg, flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
            <IconSquare icon="eye-outline" />
            <View style={{ flex: 1 }}>
              <Text style={st.cardTitle}>VÍA DE ADMINISTRACIÓN</Text>
              <Text style={st.body}>{I.route}</Text>
            </View>
          </Glass>
        </View>
      </Page>
    ),

    indicacion: (
      <Page i={3} width={width} Hs={Hs} top={top} bottom={bottom} swoosh="none" plain>
        <View style={{ width: W, alignSelf: 'center', paddingHorizontal: space.xl, gap: space.lg }}>
          <Kicker i={3} text="Indicación" />
          <Crosses />
          <Text style={{ fontFamily: font.semibold, fontSize: 21, lineHeight: 31, color: C.ink }}>
            {highlightWords(cap(I.indication), ['irritación', 'picazón', 'ardor', 'molestias'])}
          </Text>
          <View style={{ gap: 0, marginTop: space.sm }}>
            {['síndrome de resequedad ocular', 'sea éste moderado o severo', 'de cualquier etiología', 'irritación ocular causada por el viento', 'y la exposición al sol'].map((t, i) => (
              <View key={t} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderColor: C.line }}>
                <Text style={{ fontFamily: font.bold, fontSize: 16, color: C.navy, width: 16 }}>+</Text>
                <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13, letterSpacing: 0.4, color: C.ink, textTransform: 'uppercase' }}>{t}</Text>
                <Text style={{ fontFamily: font.medium, fontSize: 11, color: C.navy, opacity: 0.6 }}>{num(i)}</Text>
              </View>
            ))}
          </View>
          <Text style={st.small}>Texto impreso en el costado de la caja.</Text>
        </View>
      </Page>
    ),

    avisos: (
      <Page i={4} width={width} Hs={Hs} top={top} bottom={bottom} swoosh="high">
        <View style={{ width: W, alignSelf: 'center', paddingHorizontal: space.xl, gap: space.lg }}>
          <Kicker i={4} text="Contraindicaciones y advertencias" />
          <Text style={st.h1}>Antes de usar</Text>
          <Glass style={{ padding: space.lg, gap: space.sm }}>
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <IconSquare icon="alert-circle-outline" />
              <Text style={[st.cardTitle, { flex: 1 }]}>CONTRAINDICACIONES Y ADVERTENCIAS</Text>
            </View>
            <Text style={st.body}>{cap(I.contraindications)}</Text>
            <Text style={st.body}>{I.warning}</Text>
          </Glass>
          <Glass style={{ padding: space.lg, gap: space.sm }}>
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <IconSquare icon="time-outline" />
              <Text style={[st.cardTitle, { flex: 1 }]}>PRECAUCIONES</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: font.bold, fontSize: 34, lineHeight: 36, color: C.navy, letterSpacing: -1 }}>72</Text>
                <Text style={{ fontFamily: font.bold, fontSize: 11, color: C.navy }}>HORAS</Text>
              </View>
            </View>
            <Text style={st.body}>{cap(I.precautions)}</Text>
          </Glass>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
            <Ionicons name="document-text-outline" size={18} color={C.navy} />
            <Text style={[st.body, { flex: 1 }]}>{I.insert}</Text>
          </View>
        </View>
      </Page>
    ),

    caja: (
      <Page i={5} width={width} Hs={Hs} top={top} bottom={bottom} swoosh="none" plain>
        <View style={{ width: W, alignSelf: 'center', paddingHorizontal: space.xl, gap: space.md }}>
          <Kicker i={5} text="El empaque" />
          <Text style={st.h1}>{fold > 0.5 ? 'Despliega la caja' : 'Sus seis caras'}</Text>
          <Text style={st.lead}>Fotos de la caja de la muestra médica. {isWeb ? 'Gírala con el dedo y despliégala para ver cada cara.' : 'Gírala con el dedo o despliégala para ver cada cara.'}</Text>
        </View>
        <View style={{ alignItems: 'center', marginVertical: space.sm }}>
          {near(5) ? <TearBox textures={tex} dims={I.dims} width={W} height={Math.min(Hs * 0.46, 420)} fold={fold} highlight={spot?.face ?? null} active={page === 5 && !full} reduce={reduce} /> : <View style={{ width: W, height: Math.min(Hs * 0.46, 420) }} />}
        </View>
        <View style={{ width: W, alignSelf: 'center', paddingHorizontal: space.xl, gap: space.md }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Pill icon={fold > 0.5 ? 'expand-outline' : 'cube-outline'} label={fold > 0.5 ? 'Desplegar' : 'Armar la caja'} onPress={() => { setFold(fold > 0.5 ? 0 : 1); setSpot(null); }} variant="solid" color={C.navy} small wide />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {spots.map((s) => (
              <Pressable key={s.id} onPress={() => pickSpot(s)} accessibilityRole="button" accessibilityState={{ selected: spot?.id === s.id }} accessibilityLabel={s.title} style={[st.spot, spot?.id === s.id && { backgroundColor: C.navy, borderColor: C.navy }]}>
                <Text style={[st.spotText, spot?.id === s.id && { color: colors.white }]}>{s.title}</Text>
              </Pressable>
            ))}
          </View>
          {spot ? (
            <Glass style={{ padding: space.lg, gap: 4 }}>
              <Text style={st.cardTitle}>{faceLabel(spot.face)}</Text>
              <Text style={[st.body, { fontFamily: font.bold, color: C.navy }]}>{spot.title}</Text>
              <Text style={st.body}>{spot.body}</Text>
            </Glass>
          ) : null}
          <Text style={st.small}>
            {mode === 'real'
              ? `${I.units}. Medidas aproximadas: ${String(I.sizeCm.w).replace('.', ',')} × ${String(I.sizeCm.h).replace('.', ',')} × ${String(I.sizeCm.d).replace('.', ',')} cm. El reverso y el otro costado se muestran con las fotos del frente y del costado (el reverso real lleva braille en relieve).`
              : 'En la versión ficticia el nombre, los logotipos y el laboratorio están tapados.'}
          </Text>
        </View>
      </Page>
    ),

    cierre: (
      <Page i={6} width={width} Hs={Hs} top={top} bottom={bottom} swoosh="low">
        <View style={{ width: W, alignSelf: 'center', paddingHorizontal: space.xl, gap: space.md }}>
          <Kicker i={6} text="Para la visita médica" />
          <Text style={[st.mark, { fontSize: 52, lineHeight: 56 }]}>{N.mark}</Text>
          <Text style={st.lead}>{N.labLine}</Text>
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            {actions.map((a, i) => (
              <Pill key={a.label} icon={a.icon} label={a.label} onPress={a.onPress} variant={i === 0 ? 'solid' : 'outlineColor'} color={C.navy} wide />
            ))}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Pill icon="cube-outline" label="3D" onPress={() => setFull(true)} variant="outlineColor" color={C.navy} wide small />
              <Pill icon="scan-outline" label="AR" onPress={launchAR} variant="outlineColor" color={C.navy} wide small />
              {mode === 'real' ? <Pill icon="card-outline" label="Tarjeta" onPress={openCard} variant="outlineColor" color={C.navy} wide small /> : null}
            </View>
            {mode === 'real' ? <Pill icon="document-text-outline" label="Ficha del producto (PDF)" onPress={openPdf} variant="outlineColor" color={C.navy} wide small /> : null}
            {!presenting ? <Pill icon="albums-outline" label="Diapositivas del producto" onPress={() => router.push({ pathname: '/presentacion/[id]', params: { id: p.id, modo: 'diapositivas' } })} variant="outlineColor" color={C.navy} wide small /> : null}
          </View>
          {mode === 'real' ? <Text style={st.small}>Logotipos impresos en la caja: {I.logos.join(' · ')}.</Text> : null}
          <Text style={st.small}>{N.disclaimer} La app no vende ni entrega medicamentos.</Text>
          {related.length && !presenting ? (
            <View style={{ gap: space.sm, marginTop: space.md }}>
              <Text style={st.overline}>También en el catálogo</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
                {related.map((r) => (
                  <Pressable key={r.id} onPress={() => router.replace(`/producto/${r.id}`)} accessibilityRole="button" accessibilityLabel={`Ver ${r.name}`} style={{ width: 140 }}>
                    <ProductVisual product={r} height={90} />
                    <Text style={{ fontFamily: font.semibold, fontSize: 13, color: C.ink, marginTop: 6 }} numberOfLines={1}>
                      {r.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Page>
    ),
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <LinearGradient colors={[C.skySoft, C.paper, colors.white]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onMomentumScrollEnd={onScroll}
        style={{ flex: 1 }}
      >
        {PAGES.map((pg) => (
          <View key={pg.key} style={{ width, height: '100%' }}>
            {pages[pg.key]}
          </View>
        ))}
      </ScrollView>

      {/* ---------- arriba: volver, cronómetro, nombre real / ficticio y progreso de la historia ---------- */}
      <LinearGradient pointerEvents="none" colors={['rgba(243, 248, 253, 0.97)', 'rgba(243, 248, 253, 0.85)', 'rgba(243, 248, 253, 0)']} locations={[0, 0.7, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 104 }} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + space.sm, paddingHorizontal: space.lg, gap: space.sm }} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }} pointerEvents="box-none">
          <RoundButton icon={presenting ? 'close' : 'chevron-back'} label={presenting ? 'Terminar presentación' : 'Volver'} onPress={close} color={C.navy} />
          {presenting ? (
            <View style={{ backgroundColor: C.navy, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
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
            color={C.navy}
            veil={'rgba(30, 29, 74, 0.78)'}
          />
        </View>
        <Progress page={page} onGo={goTo} />
      </View>

      {/* ---------- abajo: página anterior / siguiente ---------- */}
      <LinearGradient pointerEvents="none" colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.92)', 'rgba(255, 255, 255, 0.98)']} locations={[0, 0.45, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: insets.bottom + 104 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + space.md, paddingTop: space.md, alignItems: 'center' }} pointerEvents="box-none">
        <View style={{ width: Math.min(width - space.lg * 2, 520), flexDirection: 'row', alignItems: 'center', gap: space.md }} pointerEvents="box-none">
          <NavButton icon="arrow-back" label="Página anterior" onPress={() => goTo(page - 1)} disabled={page === 0} />
          <View style={{ flex: 1, alignItems: 'center' }} pointerEvents="none">
            <Text style={{ fontFamily: font.bold, fontSize: 13, color: C.navy }}>
              {num(page)} <Text style={{ fontFamily: font.medium, opacity: 0.55 }}>/ {num(PAGES.length - 1)}</Text>
            </Text>
            <Text style={{ fontFamily: font.medium, fontSize: 11, color: C.ink, opacity: 0.75 }}>{PAGES[page].label}</Text>
          </View>
          <NavButton icon={page === PAGES.length - 1 ? 'refresh' : 'arrow-forward'} label={page === PAGES.length - 1 ? 'Volver a la portada' : 'Página siguiente'} onPress={() => goTo(page === PAGES.length - 1 ? 0 : page + 1)} solid />
        </View>
      </View>

      {ar ? <ArNote key={arTick} result={ar} pal={PAL} hasCard={mode === 'real'} top={insets.top + 110} reduce={reduce} onDone={() => setAr(null)} /> : null}

      <Modal visible={full} animationType={reduce ? 'none' : 'fade'} onRequestClose={() => setFull(false)}>
        <FullBox textures={tex} dims={I.dims} title={N.mark} reduce={reduce} onClose={() => setFull(false)} onAR={launchAR} />
      </Modal>
      <ShareSheet product={p} visible={share} onClose={() => setShare(false)} />
    </View>
  );
}

// ---------- piezas ----------

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const faceLabel = (f: TeaSpot['face']) => ({ front: 'FRENTE', back: 'REVERSO', left: 'COSTADO', right: 'COSTADO', top: 'TAPA', bottom: 'TAPA' })[f];

/** resalta palabras del texto impreso (fondo celeste), sin cambiarlo */
function highlightWords(text: string, words: string[]) {
  const re = new RegExp(`(${words.join('|')})`, 'g');
  return text.split(re).map((part, i) =>
    words.includes(part) ? (
      <Text key={i} style={{ backgroundColor: C.skySoft, color: C.navy, fontFamily: font.bold }}>
        {part}
      </Text>
    ) : (
      <Text key={i}>{part}</Text>
    ),
  );
}

function Page({ i, width, Hs, top, bottom, swoosh, plain, children }: { i: number; width: number; Hs: number; top: number; bottom: number; swoosh: 'low' | 'mid' | 'high' | 'none'; plain?: boolean; children: ReactNode }) {
  return (
    <ScrollView style={{ width }} contentContainerStyle={{ minHeight: Hs, paddingTop: top, paddingBottom: bottom }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
      {plain ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.white, opacity: 0.55 }]} /> : null}
      {swoosh !== 'none' ? <Swoosh width={width} Hs={Hs} at={swoosh} /> : null}
      <Text pointerEvents="none" style={{ position: 'absolute', right: -8, bottom: bottom - 30, fontFamily: font.bold, fontSize: 150, lineHeight: 150, letterSpacing: -8, color: C.navy, opacity: 0.05 }}>
        {num(i)}
      </Text>
      {children}
    </ScrollView>
  );
}

/** franja arcoíris de la caja como decoración de fondo */
function Swoosh({ width, Hs, at }: { width: number; Hs: number; at: 'low' | 'mid' | 'high' }) {
  const y0 = at === 'low' ? Hs * 0.62 : at === 'mid' ? Hs * 0.42 : Hs * 0.2;
  const h = Math.min(Hs * 0.28, 240);
  const band = 7;
  return (
    <Svg pointerEvents="none" width={width} height={h + 60} style={{ position: 'absolute', left: 0, top: y0, opacity: 0.4 }}>
      {C.rainbow.map((c, k) => {
        const o = k * band;
        return <Path key={c} d={`M -20 ${h + 30 - o} C ${width * 0.3} ${h + 20 - o}, ${width * 0.45} ${30 - o}, ${width + 20} ${20 - o * 0.6}`} stroke={c} strokeWidth={band} fill="none" strokeLinecap="round" />;
      })}
    </Svg>
  );
}

/** portada: nombre gigante detrás de la caja y un anillo de texto que gira alrededor */
function Hero({ name, width, W, stage, reduce, ring, children }: { name: string; width: number; W: number; stage: number; reduce: boolean; ring: string; children: ReactNode }) {
  const fs = Math.min((width - 8) / (name.length * 0.66), 170);
  return (
    <View style={{ height: stage, width: '100%', alignItems: 'center', justifyContent: 'center', marginVertical: space.sm }}>
      <Text pointerEvents="none" numberOfLines={1} style={{ position: 'absolute', fontFamily: font.bold, fontSize: fs, lineHeight: fs * 1.05, letterSpacing: -fs * 0.05, color: C.navy, opacity: 0.09 }}>
        {name}
      </Text>
      <TextRing text={ring} size={Math.min(W * 0.92, stage * 0.98)} reduce={reduce} />
      {children}
    </View>
  );
}

function TextRing({ text, size, reduce }: { text: string; size: number; reduce: boolean }) {
  const ref = useRef<View>(null);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    if (isWeb) {
      // en la web gira con CSS (no pasa por React en cada cuadro)
      if (typeof document !== 'undefined' && !document.getElementById('ml-tea-spin')) {
        const s = document.createElement('style');
        s.id = 'ml-tea-spin';
        s.textContent = '@keyframes mlTeaSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
        document.head.appendChild(s);
      }
      cssAnim(domEl(ref.current), 'mlTeaSpin 38s linear infinite');
      return;
    }
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 38000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [a, reduce]);
  const chars = text.split('');
  const r = size / 2 - 10;
  return (
    <Animated.View
      ref={ref as never}
      pointerEvents="none"
      style={{ position: 'absolute', width: size, height: size, transform: isWeb || reduce ? [] : [{ rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}
    >
      {chars.map((ch, i) => {
        const ang = (i / chars.length) * 360;
        return (
          <View key={i} style={{ position: 'absolute', left: size / 2 - 6, top: size / 2 - r - 8, width: 12, height: r + 8, alignItems: 'center', transform: [{ translateY: (r + 8) / 2 }, { rotate: `${ang}deg` }, { translateY: -(r + 8) / 2 }] }}>
            <Text style={{ fontFamily: font.bold, fontSize: 11, color: C.navy, opacity: 0.75 }}>{ch}</Text>
          </View>
        );
      })}
    </Animated.View>
  );
}

function Chip({ label, solid }: { label: string; solid?: boolean }) {
  return (
    <View style={{ borderRadius: radius.pill, borderWidth: 1.5, borderColor: C.navy, backgroundColor: solid ? C.navy : 'transparent', paddingHorizontal: 12, paddingVertical: 5 }}>
      <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 0.6, color: solid ? colors.white : C.navy }}>{label}</Text>
    </View>
  );
}

function BigNum({ i }: { i: number }) {
  return <Text style={{ fontFamily: font.bold, fontSize: 40, lineHeight: 42, color: C.navy, letterSpacing: -1 }}>{num(i)}.</Text>;
}

function Kicker({ i, text }: { i: number; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Text style={{ fontFamily: font.bold, fontSize: 40, lineHeight: 42, color: C.navy, letterSpacing: -1 }}>{num(i)}.</Text>
      <View style={{ flex: 1, height: 1.5, backgroundColor: C.navy, opacity: 0.2 }} />
      <Chip label={text.toUpperCase()} />
    </View>
  );
}

/** tarjeta de vidrio (en la web, con desenfoque del fondo) */
function Glass({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const ref = useRef<View>(null);
  useEffect(() => {
    const el = domEl(ref.current);
    if (el) {
      el.style.setProperty('backdrop-filter', 'blur(14px) saturate(1.3)');
      el.style.setProperty('-webkit-backdrop-filter', 'blur(14px) saturate(1.3)');
    }
  }, []);
  return (
    <View ref={ref} style={[{ backgroundColor: C.glass, borderRadius: radius.xl, borderWidth: 1, borderColor: C.glassLine, shadowColor: C.navyDeep, shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 }, style]}>
      {children}
    </View>
  );
}

function IconSquare({ icon }: { icon: IconName }) {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={20} color={colors.white} />
    </View>
  );
}

/** arco de excipientes (referencia: diagramas de ingredientes en arco) */
function Arc({ items, width }: { items: string[]; width: number }) {
  const step = 46;
  const H = items.length * step + 10;
  const R = H / 2 - 4;
  const cx = width - 6 + R * 0.35; // el centro queda fuera, a la derecha: se ve la mitad izquierda del arco
  const cy = H / 2;
  const pts = items.map((_, i) => {
    const t = (i + 0.5) / items.length; // 0 arriba → 1 abajo
    const ang = (-62 + 124 * t) * (Math.PI / 180);
    return { x: cx - R * Math.cos(ang), y: cy + R * Math.sin(ang) };
  });
  const a0 = (-70 * Math.PI) / 180;
  const a1 = (70 * Math.PI) / 180;
  return (
    <View style={{ width, height: H }}>
      <Svg width={width} height={H} style={{ position: 'absolute' }}>
        <Path d={`M ${cx - R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A ${R} ${R} 0 0 0 ${cx - R * Math.cos(a1)} ${cy + R * Math.sin(a1)}`} stroke={C.navy} strokeWidth={1.5} fill="none" opacity={0.5} />
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={7} fill={C.navy} />
        ))}
        {pts.map((p, i) => (
          <Circle key={`h${i}`} cx={p.x} cy={p.y} r={12} fill="none" stroke={C.sky} strokeWidth={2} opacity={0.7} />
        ))}
      </Svg>
      {items.map((t, i) => (
        <View key={t} style={{ position: 'absolute', left: 0, width: Math.max(80, pts[i].x - 22), top: pts[i].y - 20, height: 40, justifyContent: 'center' }}>
          <Text style={{ fontFamily: font.semibold, fontSize: 13, lineHeight: 17, color: C.ink, textAlign: 'right' }} numberOfLines={2}>
            {t}
          </Text>
        </View>
      ))}
    </View>
  );
}

function DropGrid({ count }: { count: number }) {
  return (
    <View accessibilityLabel={`${count} gotas`} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {Array.from({ length: count }, (_, i) => (
        <Ionicons key={i} name="water" size={18} color={i % 5 === 4 ? C.navy : '#4C9CE0'} />
      ))}
    </View>
  );
}

function FallingDrop({ reduce }: { reduce: boolean }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return a.setValue(0.5);
    const loop = Animated.loop(Animated.sequence([Animated.timing(a, { toValue: 1, duration: 1400, easing: Easing.in(Easing.quad), useNativeDriver: true }), Animated.delay(500)]));
    a.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [a, reduce]);
  return (
    <Animated.View style={{ alignSelf: 'center', marginBottom: 4, opacity: a.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-26, 6] }) }] }}>
      <Ionicons name="water" size={20} color="#4C9CE0" />
    </Animated.View>
  );
}

/** cruces de catálogo técnico (decoración) */
function Crosses() {
  return (
    <View pointerEvents="none" style={{ flexDirection: 'row', justifyContent: 'space-between', opacity: 0.4 }}>
      {[0, 1, 2].map((k) => (
        <Text key={k} style={{ fontFamily: font.medium, fontSize: 18, color: C.navy }}>
          +
        </Text>
      ))}
    </View>
  );
}

function SwipeHint({ reduce }: { reduce: boolean }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(a, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(a, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [a, reduce]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 12, color: C.navy }}>Desliza para pasar de página</Text>
      <Animated.View style={{ transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) }] }}>
        <Ionicons name="arrow-forward" size={16} color={C.navy} />
      </Animated.View>
    </View>
  );
}

function Progress({ page, onGo }: { page: number; onGo: (i: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }} accessibilityRole="tablist">
      {PAGES.map((pg, i) => (
        <Pressable key={pg.key} onPress={() => onGo(i)} accessibilityRole="tab" accessibilityState={{ selected: i === page }} accessibilityLabel={`${num(i)} · ${pg.label}`} hitSlop={{ top: 12, bottom: 12 }} style={{ flex: 1, height: 16, justifyContent: 'center' }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= page ? C.navy : 'rgba(50, 49, 108, 0.18)' }} />
        </Pressable>
      ))}
    </View>
  );
}

function NavButton({ icon, label, onPress, disabled, solid }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; solid?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: solid ? C.navy : colors.white, borderWidth: 1.5, borderColor: C.navy, opacity: disabled ? 0.3 : pressed ? 0.75 : 1 })}
    >
      <Ionicons name={icon} size={22} color={solid ? colors.white : C.navy} />
    </Pressable>
  );
}

/** vista 3D a pantalla completa: girar, desplegar y abrir la AR */
function FullBox({ textures, dims, title, reduce, onClose, onAR }: { textures: BoxTextures; dims: { w: number; h: number; d: number }; title: string; reduce: boolean; onClose: () => void; onAR: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [fold, setFold] = useState(1);
  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <LinearGradient colors={[C.skySoft, C.paper]} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <TearBox textures={textures} dims={dims} width={width} height={height * 0.72} fold={fold} drops reduce={reduce} zoom={1.1} />
      </View>
      <View style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <RoundButton icon="close" label="Cerrar la vista 3D" onPress={onClose} color={C.navy} />
        <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 18, color: C.navy }}>{title}</Text>
      </View>
      <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: insets.bottom + space.lg, gap: space.sm, alignItems: 'center' }}>
        <Text style={{ fontFamily: font.medium, fontSize: 12, color: C.ink, opacity: 0.8, textAlign: 'center' }}>Arrastra de lado para girarla.</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, width: '100%', maxWidth: 460 }}>
          <Pill icon={fold > 0.5 ? 'expand-outline' : 'cube-outline'} label={fold > 0.5 ? 'Desplegar' : 'Armar'} onPress={() => setFold(fold > 0.5 ? 0 : 1)} variant="solid" color={C.navy} wide small />
          <Pill icon="scan-outline" label="Ver en AR" onPress={onAR} variant="outlineColor" color={C.navy} wide small />
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  mark: { fontFamily: font.bold, fontSize: 40, lineHeight: 44, color: C.navy, letterSpacing: -1 },
  h1: { fontFamily: font.bold, fontSize: 30, lineHeight: 35, color: C.navy, letterSpacing: -0.6 },
  lead: { fontFamily: font.medium, fontSize: 15, lineHeight: 22, color: C.ink },
  body: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: C.ink },
  small: { fontFamily: font.regular, fontSize: 12, lineHeight: 18, color: C.ink, opacity: 0.78 },
  overline: { fontFamily: font.bold, fontSize: 11, letterSpacing: 0.9, color: C.navy, textTransform: 'uppercase' },
  cardTitle: { fontFamily: font.bold, fontSize: 12, letterSpacing: 0.8, color: C.navy },
  sample: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.line, marginTop: space.xs },
  sampleText: { fontFamily: font.semibold, fontSize: 12, color: C.navy },
  spot: { borderRadius: radius.pill, borderWidth: 1.5, borderColor: C.line, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 7 },
  spotText: { fontFamily: font.semibold, fontSize: 12, color: C.navy },
});

