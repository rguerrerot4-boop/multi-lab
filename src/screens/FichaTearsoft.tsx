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
  const [tour, setTour] = useState(false); // recorrido automático por las caras de la caja
  const [exc, setExc] = useState<number | null>(null); // excipiente elegido en el arco
  const [ind, setInd] = useState<string | null>(null); // frase o palabra elegida de la indicación
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
    if (PAGES[page].key !== 'caja') {
      setSpot(null);
      setTour(false);
    }
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
    setTour(false);
    setSpot((cur) => (cur?.id === s.id ? null : s));
    setFold(0);
  };
  // recorrido: despliega la caja y pasa por cada punto
  useEffect(() => {
    if (!tour || page !== 5) return;
    setFold(0);
    let k = 0;
    setSpot(spots[0]);
    const t = setInterval(() => {
      k = (k + 1) % spots.length;
      setSpot(spots[k]);
    }, 2600);
    return () => clearInterval(t);
  }, [tour, page, spots]);
  const pick = (key: string, set: (v: string | null) => void, cur: string | null) => {
    logEvent('ficha_punto', `${p.id}:${key}`);
    set(cur === key ? null : key);
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
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
            {[
              { value: `${I.activeQty}`, unit: 'por mL', label: 'Composición', to: 1 },
              { value: '20', unit: 'gotas', label: '= 1 mL', to: 2 },
              { value: I.front.volume, unit: '1 frasco', label: 'El empaque', to: 5 },
            ].map((q) => (
              <Tap key={q.label} onPress={() => goTo(q.to)} label={`Ir a ${PAGES[q.to].label}`} style={{ flex: 1 }}>
                <Glass style={{ paddingVertical: space.md, paddingHorizontal: space.sm, gap: 2, alignItems: 'flex-start' }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 22, lineHeight: 26, color: C.navy, letterSpacing: -0.5 }}>{q.value}</Text>
                  <Text style={{ fontFamily: font.semibold, fontSize: 11, color: C.ink }}>{q.unit}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 10, letterSpacing: 0.4, color: C.navy }}>{q.label.toUpperCase()}</Text>
                    <Ionicons name="arrow-forward" size={11} color={C.navy} />
                  </View>
                </Glass>
              </Tap>
            ))}
          </View>
          <Hint icon="finger-print-outline" text="Arrastra la caja para girarla · toca una cifra para ir a su página" />
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
            <View style={{ flexDirection: 'row', marginTop: space.sm }}>
              <Pill icon="cube-outline" label="Verlo en la caja" onPress={() => { goTo(5); const s = spots.find((x) => x.id === 'composicion'); if (s) setTimeout(() => pickSpot(s), reduce ? 0 : 450); }} variant="outlineColor" color={C.navy} small />
            </View>
          </Glass>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={st.overline}>Excipientes · {I.excipients.length}</Text>
            {exc === null ? <Hint icon="finger-print-outline" text="Toca uno" /> : null}
          </View>
          <Arc items={I.excipients} width={W - space.xl * 2} active={exc} onPick={(i) => { logEvent('ficha_punto', `${p.id}:excipiente-${i + 1}`); setExc((c) => (c === i ? null : i)); }} />
          {exc !== null ? (
            <Appear key={exc} reduce={reduce}>
              <Glass style={{ padding: space.lg, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[st.cardTitle, { flex: 1 }]}>
                    EXCIPIENTE {num(exc)} DE {String(I.excipients.length).padStart(2, '0')}
                  </Text>
                  <MiniNav icon="chevron-back" label="Excipiente anterior" onPress={() => setExc((exc + I.excipients.length - 1) % I.excipients.length)} />
                  <MiniNav icon="chevron-forward" label="Excipiente siguiente" onPress={() => setExc((exc + 1) % I.excipients.length)} />
                </View>
                <Text style={{ fontFamily: font.bold, fontSize: 20, lineHeight: 26, color: C.navy }}>{cap(I.excipients[exc])}</Text>
                <Text style={st.small}>Impreso en el costado de la caja, en este orden, después del principio activo.</Text>
              </Glass>
            </Appear>
          ) : null}
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
          <DropCounter reduce={reduce} active={page === 2} drops={I.drops} onDone={() => logEvent('ficha_punto', `${p.id}:20-gotas`)} />
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {SYMPTOMS.map((w) => (
              <Tap key={w} onPress={() => pick(w, setInd, ind)} label={cap(w)} selected={ind === w}>
                <View style={[st.spot, ind === w && { backgroundColor: C.navy, borderColor: C.navy }]}>
                  <Text style={[st.spotText, ind === w && { color: colors.white }]}>{cap(w)}</Text>
                </View>
              </Tap>
            ))}
          </View>
          <Text style={{ fontFamily: font.semibold, fontSize: 21, lineHeight: 31, color: C.ink }}>{highlightWords(cap(I.indication), SYMPTOMS, ind)}</Text>
          <View style={{ gap: 0, marginTop: space.sm }}>
            {PHRASES.map((ph, i) => {
              const on = ind === ph.text;
              return (
                <Tap key={ph.text} onPress={() => pick(ph.text, setInd, ind)} label={ph.text} selected={on}>
                  <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: 12, paddingHorizontal: on ? space.md : 0, borderTopWidth: 1, borderColor: on ? C.navy : C.line, backgroundColor: on ? C.navy : 'transparent', borderRadius: on ? radius.md : 0 }}>
                    <Ionicons name={ph.icon} size={18} color={on ? colors.white : C.navy} />
                    <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13, letterSpacing: 0.4, color: on ? colors.white : C.ink, textTransform: 'uppercase' }}>{ph.text}</Text>
                    <Text style={{ fontFamily: font.medium, fontSize: 11, color: on ? colors.white : C.navy, opacity: on ? 0.9 : 0.6 }}>{num(i)}</Text>
                  </View>
                </Tap>
              );
            })}
          </View>
          <Hint icon="finger-print-outline" text={ind ? 'Toca de nuevo para quitar el resaltado' : 'Toca una línea o un síntoma para encontrarlo en el texto'} />
          <Text style={st.small}>Texto impreso en el costado de la caja.</Text>
        </View>
      </Page>
    ),

    avisos: (
      <Page i={4} width={width} Hs={Hs} top={top} bottom={bottom} swoosh="high">
        <View style={{ width: W, alignSelf: 'center', paddingHorizontal: space.xl, gap: space.lg }}>
          <Kicker i={4} text="Contraindicaciones y advertencias" />
          <Text style={st.h1}>Antes de usar</Text>
          <Checklist
            reduce={reduce}
            onOpen={(id) => logEvent('ficha_punto', `${p.id}:aviso-${id}`)}
            items={[
              { id: 'contra', icon: 'alert-circle-outline', title: 'Contraindicaciones y advertencias', text: cap(I.contraindications) },
              { id: 'punta', icon: 'hand-left-outline', title: 'Para evitar contaminación', text: I.warning },
              { id: 'horas', icon: 'time-outline', title: 'Precauciones', text: cap(I.precautions), hours: 72 },
              { id: 'inserto', icon: 'document-text-outline', title: 'Inserto', text: I.insert },
            ]}
          />
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
            <Pill icon={fold > 0.5 ? 'expand-outline' : 'cube-outline'} label={fold > 0.5 ? 'Desplegar' : 'Armar la caja'} onPress={() => { setTour(false); setFold(fold > 0.5 ? 0 : 1); setSpot(null); }} variant="solid" color={C.navy} small wide />
            <Pill icon={tour ? 'pause-outline' : 'play-outline'} label={tour ? 'Pausar' : 'Recorrer las caras'} onPress={() => { logEvent('ficha_punto', `${p.id}:recorrido`); setTour(!tour); if (tour) setSpot(null); }} variant="outlineColor" color={C.navy} small wide />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {spots.map((s, i) => (
              <Tap key={s.id} onPress={() => pickSpot(s)} label={s.title} selected={spot?.id === s.id}>
                <View style={[st.spot, { flexDirection: 'row', gap: 6, alignItems: 'center' }, spot?.id === s.id && { backgroundColor: C.navy, borderColor: C.navy }]}>
                  <Text style={[st.spotText, { opacity: 0.55 }, spot?.id === s.id && { color: colors.white, opacity: 0.8 }]}>{num(i)}</Text>
                  <Text style={[st.spotText, spot?.id === s.id && { color: colors.white }]}>{s.title}</Text>
                </View>
              </Tap>
            ))}
          </View>
          {spot ? (
            <Appear key={spot.id} reduce={reduce}>
              <Glass style={{ padding: space.lg, gap: 4 }}>
                <Text style={st.cardTitle}>{faceLabel(spot.face)}</Text>
                <Text style={[st.body, { fontFamily: font.bold, color: C.navy }]}>{spot.title}</Text>
                <Text style={st.body}>{spot.body}</Text>
              </Glass>
            </Appear>
          ) : (
            <Hint icon="finger-print-outline" text="Toca un punto para ver su cara en la caja" />
          )}
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

const SYMPTOMS = ['irritación', 'picazón', 'ardor', 'molestias'];
// frases tal como están impresas en la indicación (cada una se resalta en el texto al tocarla)
const PHRASES: { text: string; icon: IconName }[] = [
  { text: 'síndrome de resequedad ocular', icon: 'water-outline' },
  { text: 'sea éste moderado o severo', icon: 'pulse-outline' },
  { text: 'de cualquier etiología', icon: 'help-circle-outline' },
  { text: 'irritación ocular causada por el viento', icon: 'cloudy-outline' },
  { text: 'y la exposición al sol', icon: 'sunny-outline' },
];

/** resalta palabras del texto impreso (fondo celeste) y, más fuerte, la frase o palabra elegida; el texto no cambia */
function highlightWords(text: string, words: string[], sel: string | null = null) {
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const all = [...(sel ? [sel] : []), ...words.filter((w) => w !== sel)].sort((x, y) => y.length - x.length);
  const re = new RegExp(`(${all.map(esc).join('|')})`, 'gi');
  return text.split(re).map((part, i) => {
    const low = part.toLowerCase();
    if (sel && low === sel.toLowerCase())
      return (
        <Text key={i} style={{ backgroundColor: C.navy, color: colors.white, fontFamily: font.bold }}>
          {part}
        </Text>
      );
    if (words.includes(low))
      return (
        <Text key={i} style={{ backgroundColor: C.skySoft, color: C.navy, fontFamily: font.bold }}>
          {part}
        </Text>
      );
    return <Text key={i}>{part}</Text>;
  });
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
function Arc({ items, width, active, onPick }: { items: string[]; width: number; active: number | null; onPick: (i: number) => void }) {
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
          <Circle key={i} cx={p.x} cy={p.y} r={active === i ? 9 : 7} fill={C.navy} opacity={active === null || active === i ? 1 : 0.3} />
        ))}
        {pts.map((p, i) => (
          <Circle key={`h${i}`} cx={p.x} cy={p.y} r={active === i ? 16 : 12} fill="none" stroke={active === i ? C.navy : C.sky} strokeWidth={2} opacity={active === null ? 0.7 : active === i ? 0.9 : 0.25} />
        ))}
      </Svg>
      {items.map((t, i) => (
        <Pressable
          key={t}
          onPress={() => onPick(i)}
          accessibilityRole="button"
          accessibilityState={{ selected: active === i }}
          accessibilityLabel={t}
          style={{ position: 'absolute', left: 0, width: Math.max(80, pts[i].x + 18), top: pts[i].y - 22, height: 44, justifyContent: 'center', paddingRight: 40 }}
        >
          <Text
            style={{ fontFamily: active === i ? font.bold : font.semibold, fontSize: 13, lineHeight: 17, color: active === i ? C.navy : C.ink, opacity: active === null || active === i ? 1 : 0.45, textAlign: 'right' }}
            numberOfLines={2}
          >
            {t}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** botón con un leve hundimiento al tocarlo (resorte, en el hilo nativo) */
function Tap({ onPress, label, selected, style, children }: { onPress: () => void; label: string; selected?: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const k = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(k, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 7 }).start();
  return (
    <Pressable onPress={onPress} onPressIn={() => to(0.95)} onPressOut={() => to(1)} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} style={style}>
      <Animated.View style={{ transform: [{ scale: k }] }}>{children}</Animated.View>
    </Pressable>
  );
}

/** aparece subiendo un poco (al cambiar su `key` se repite) */
function Appear({ reduce, delay = 0, children }: { reduce: boolean; delay?: number; children: ReactNode }) {
  const a = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.timing(a, { toValue: 1, duration: 280, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a, reduce, delay]);
  return <Animated.View style={{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>{children}</Animated.View>;
}

function Hint({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name={icon} size={14} color={C.navy} />
      <Text style={{ fontFamily: font.semibold, fontSize: 12, color: C.navy, opacity: 0.85 }}>{text}</Text>
    </View>
  );
}

function MiniNav({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.navy, marginLeft: 6, opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name={icon} size={16} color={C.navy} />
    </Pressable>
  );
}

/** cuenta gotas: cada toque deja caer una gota hasta llegar a las 20 de 1 mL (dato de la caja) */
function DropCounter({ reduce, active, drops, onDone }: { reduce: boolean; active: boolean; drops: string; onDone: () => void }) {
  const TOTAL = 20;
  const [n, setN] = useState(0);
  const fall = useRef(new Animated.Value(1)).current;
  const prog = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (!active) stop();
  }, [active]);
  useEffect(() => {
    Animated.timing(prog, { toValue: n / TOTAL, duration: reduce ? 0 : 200, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    if (n === TOTAL) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  const drip = () => {
    if (reduce) return;
    fall.setValue(0);
    Animated.timing(fall, { toValue: 1, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }).start();
  };
  const add = () => {
    stop();
    setN((c) => (c >= TOTAL ? 1 : c + 1));
    drip();
  };
  const fill = () => {
    stop();
    if (reduce) return setN(TOTAL);
    let k = 0;
    setN(0);
    timer.current = setInterval(() => {
      k += 1;
      setN(k);
      drip();
      if (k >= TOTAL) stop();
    }, 90);
  };
  const ml = (n / TOTAL).toFixed(2).replace('.', ',');
  return (
    <Glass style={{ padding: space.lg, gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <IconSquare icon="water-outline" />
        <View style={{ flex: 1 }}>
          <Text style={st.cardTitle}>GOTAS POR mL</Text>
          <Text style={[st.body, { fontFamily: font.bold }]}>{drops}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        <View style={{ alignItems: 'center' }}>
          <Tap onPress={add} label="Dejar caer una gota">
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', shadowColor: C.navyDeep, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 }}>
              <Ionicons name="eyedrop" size={30} color={colors.white} />
            </View>
          </Tap>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 66, opacity: fall.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [0, 34] }) }] }}>
            <Ionicons name="water" size={16} color="#4C9CE0" />
          </Animated.View>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 40, lineHeight: 44, color: C.navy, letterSpacing: -1 }}>
            {n}
            <Text style={{ fontSize: 16, letterSpacing: 0 }}> / {TOTAL} gotas</Text>
          </Text>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(50, 49, 108, 0.12)', overflow: 'hidden' }}>
            <Animated.View style={{ height: '100%', borderRadius: 4, backgroundColor: C.navy, width: prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
          </View>
          <Text style={{ fontFamily: font.semibold, fontSize: 12, color: C.ink }}>{n === TOTAL ? '¡1 mL completo! 20 gotas, como indica la caja.' : n === 0 ? 'Toca el gotero para dejar caer una gota.' : `${ml} mL`}</Text>
        </View>
      </View>
      <View accessibilityLabel={`${n} de ${TOTAL} gotas`} style={{ gap: 6 }}>
        {[0, 1].map((row) => (
          <View key={row} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {Array.from({ length: TOTAL / 2 }, (_, j) => {
              const i = row * (TOTAL / 2) + j;
              return <DropCell key={i} on={i < n} mark={i % 5 === 4} reduce={reduce} />;
            })}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Pill icon="play-outline" label="Llenar 1 mL" onPress={fill} variant="solid" color={C.navy} wide small />
        <Pill icon="refresh" label="Reiniciar" onPress={() => { stop(); setN(0); }} variant="outlineColor" color={C.navy} wide small />
      </View>
    </Glass>
  );
}

function DropCell({ on, mark, reduce }: { on: boolean; mark: boolean; reduce: boolean }) {
  const k = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return k.setValue(on ? 1 : 0);
    if (on) Animated.spring(k, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 12 }).start();
    else Animated.timing(k, { toValue: 0, duration: 160, useNativeDriver: true }).start();
  }, [on, k, reduce]);
  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="water-outline" size={18} color="rgba(50, 49, 108, 0.25)" style={{ position: 'absolute' }} />
      <Animated.View style={{ opacity: k, transform: [{ scale: k.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>
        <Ionicons name="water" size={18} color={mark ? C.navy : '#4C9CE0'} />
      </Animated.View>
    </View>
  );
}

/** advertencias como lista para revisar: se abre cada una y queda marcada como leída */
function Checklist({ items, reduce, onOpen }: { items: { id: string; icon: IconName; title: string; text: string; hours?: number }[]; reduce: boolean; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [read, setRead] = useState<string[]>([]);
  const prog = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(prog, { toValue: read.length / items.length, duration: reduce ? 0 : 300, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [read.length, items.length, prog, reduce]);
  const toggle = (id: string) => {
    if (open !== id) onOpen(id);
    setOpen(open === id ? null : id);
    setRead((r) => (r.includes(id) ? r : [...r, id]));
  };
  const done = read.length === items.length;
  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={st.overline}>Revisadas</Text>
          <Text style={st.overline}>
            {read.length} de {items.length}
          </Text>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(50, 49, 108, 0.12)', overflow: 'hidden' }}>
          <Animated.View style={{ height: '100%', backgroundColor: C.navy, width: prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
        </View>
      </View>
      {items.map((it) => {
        const isOpen = open === it.id;
        const isRead = read.includes(it.id);
        return (
          <Glass key={it.id} style={{ overflow: 'hidden' }}>
            <Pressable onPress={() => toggle(it.id)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} accessibilityLabel={it.title} style={({ pressed }) => ({ flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.lg, opacity: pressed ? 0.75 : 1 })}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isRead ? C.navy : colors.white, borderWidth: 1.5, borderColor: C.navy, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={isRead ? 'checkmark' : it.icon} size={20} color={isRead ? colors.white : C.navy} />
              </View>
              <Text style={[st.cardTitle, { flex: 1 }]}>{it.title.toUpperCase()}</Text>
              {it.hours ? <HoursBadge hours={it.hours} run={isOpen} reduce={reduce} /> : null}
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.navy} />
            </Pressable>
            {isOpen ? (
              <Appear reduce={reduce}>
                <Text style={[st.body, { paddingHorizontal: space.lg, paddingBottom: space.lg, marginTop: -4 }]}>{it.text}</Text>
              </Appear>
            ) : null}
          </Glass>
        );
      })}
      {done ? (
        <Appear reduce={reduce}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: C.navy, borderRadius: radius.lg, padding: space.md }}>
            <Ionicons name="checkmark-circle" size={20} color={colors.white} />
            <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13, color: colors.white }}>Revisaste todas las advertencias impresas en la caja.</Text>
          </View>
        </Appear>
      ) : (
        <Hint icon="finger-print-outline" text="Toca cada advertencia para abrirla" />
      )}
    </View>
  );
}

/** las 72 horas de la caja: cuenta hasta 72 al abrir la precaución */
function HoursBadge({ hours, run, reduce }: { hours: number; run: boolean; reduce: boolean }) {
  const [v, setV] = useState(hours);
  useEffect(() => {
    if (!run || reduce) return setV(hours);
    let raf = 0;
    const t0 = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / 900);
      setV(Math.round(hours * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, hours, reduce]);
  return (
    <View style={{ alignItems: 'flex-end', marginRight: 2 }}>
      <Text style={{ fontFamily: font.bold, fontSize: 26, lineHeight: 28, color: C.navy, letterSpacing: -1 }}>{v}</Text>
      <Text style={{ fontFamily: font.bold, fontSize: 9, color: C.navy }}>HORAS</Text>
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

