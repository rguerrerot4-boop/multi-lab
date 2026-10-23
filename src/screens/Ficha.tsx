import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductVisual } from '@/components/ProductVisual';
import { ShareSheet } from '@/components/ShareSheet';
import {
  FACE_LABEL,
  FullViewer,
  InkNote,
  Marquee,
  ModeToggle,
  Pill,
  Podium,
  PhotoZoom,
  RoundButton,
  ShowBox,
  Streaks,
  Topo,
  TornEdge,
  scrollToX,
  useReduceMotion,
  type ShowBoxHandle,
} from '@/components/showcase';
import type { BoxFace } from '@/components/PhotoBox3D';
import { goBack } from '@/components/ui';
import { fichaContent, fichaPalette, type FichaContent, type FichaPal } from '@/data/ficha';
import { labByName, products, type Product } from '@/data/mock';
import type { VitrinaCard, VitrinaMode } from '@/data/vitrina';
import { arCardUrl, openAR, type ArResult } from '@/lib/ar';
import { useMine } from '@/store/AppStore';
import { colors, font, radius, space } from '@/theme';

// Ficha del producto, armada con las referencias:
// 1) portada con el nombre gigante en movimiento detrás de la caja flotando (latas de la primera referencia),
// 2) ficha técnica con cifras grandes en recuadro junto al envase (página de producto),
// 3) «Cara por cara»: carrusel de tarjetas altas (segunda referencia); la caja de arriba gira a la cara de la
//    tarjeta del centro, la tarjeta se voltea para leer su texto y la foto se puede ampliar,
// 4) componentes en manchas de tinta alrededor del envase, 5) modo de uso y avisos,
// 6) pedestal y presentación en fila, 7) cierre con letras grandes y acciones.
// Los colores son los del empaque (producto real) o el tono del producto (ficticios).

type Sec = 'hero' | 'tecnica' | 'caras' | 'notas' | 'pedestal';

export default function Ficha({ product: p, presenting = false, visita, initialMode }: { product: Product; presenting?: boolean; visita?: string; initialMode?: VitrinaMode }) {
  const { role, chatWith, logEvent, visits, updateReport } = useMine();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [mode, setMode] = useState<VitrinaMode>(initialMode ?? 'real');
  const pal = fichaPalette(p);
  const c = useMemo(() => fichaContent(p, mode), [p, mode]);

  const scroll = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const hero = useRef<ShowBoxHandle>(null);
  const facesBox = useRef<ShowBoxHandle>(null);
  const pos = useRef<Record<Sec | 'outro', number>>({ hero: 0, tecnica: 1e5, caras: 1e5, notas: 1e5, pedestal: 1e5, outro: 1e5 });
  const [on, setOn] = useState<Record<Sec, boolean>>({ hero: true, tecnica: false, caras: false, notas: false, pedestal: false });
  const [bar, setBar] = useState(false);
  const [outroOn, setOutroOn] = useState(false);
  const [full, setFull] = useState(false);
  const [zoom, setZoom] = useState<VitrinaCard | null>(null);
  const [ar, setAr] = useState<ArResult | null>(null);
  const [share, setShare] = useState(false);
  const [note, setNote] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(Date.now());

  const W = Math.min(width, 600); // en pantallas anchas el contenido se centra
  const heroH = Math.max(600, Math.min(780, height * 0.9));

  useEffect(() => {
    logEvent(presenting ? 'presentacion_iniciada' : 'ficha_abierta', `${p.id}${c.hasModes ? `:${mode}` : ''}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id, mode]);

  // en una visita en curso, el producto presentado se marca solo (igual que la presentación)
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

  // qué secciones se ven: las cajas fuera de pantalla dejan de animarse
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      const top = value;
      const bottom = value + height;
      const vis = (k: Sec, h: number) => bottom > pos.current[k] && top < pos.current[k] + h;
      const next = { hero: top < heroH, tecnica: vis('tecnica', 700), caras: vis('caras', 900), notas: vis('notas', 760), pedestal: vis('pedestal', 700) };
      setOn((o) => ((Object.keys(next) as Sec[]).some((k) => o[k] !== next[k]) ? next : o));
      setBar(value > heroH * 0.55 && bottom < pos.current.outro + 120); // en el cierre ya están los botones
      if (bottom > pos.current.outro + 140) setOutroOn(true);
    });
    return () => scrollY.removeListener(id);
  }, [scrollY, height, heroH]);
  const mark = (k: Sec | 'outro') => (e: LayoutChangeEvent) => {
    pos.current[k] = e.nativeEvent.layout.y;
  };

  const close = () => {
    if (presenting) logEvent('presentacion_cerrada', `${p.id} · ${elapsed}s`);
    goBack(role === 'visitador' ? '/visitador/catalogo' : '/medico');
  };
  const launchAR = async () => {
    logEvent('ar_abierto', c.ar.id);
    setAr(await openAR(c.ar));
  };
  const openCard = () => {
    if (!c.cardId) return;
    logEvent('ar_tarjeta', c.cardId);
    Linking.openURL(arCardUrl(c.cardId)).catch(() => {});
  };
  const textY = scrollY.interpolate({ inputRange: [-200, 0, heroH], outputRange: [-60, 0, heroH * 0.42], extrapolate: 'clamp' });
  const boxY = scrollY.interpolate({ inputRange: [-200, 0, heroH], outputRange: [-30, 0, heroH * 0.2], extrapolate: 'clamp' });
  const giantSize = Math.min(width, 700) * (c.name.length > 10 ? 0.26 : 0.34);
  const related = products.filter((x) => x.id !== p.id && (x.category === p.category || x.lab === p.lab)).slice(0, 4);
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  // imagen de cada tarjeta: la foto de esa cara, o el envase dibujado del producto ficticio
  const imageFor = (card: VitrinaCard, i: number, w: number) => {
    if (c.textures) {
      const top = card.face === 'top' || card.face === 'bottom';
      const iw = w * (top ? 0.62 : 0.56);
      return <Image source={c.textures[card.face]} style={{ width: iw, height: top ? iw : iw * 1.447, borderRadius: 6 }} resizeMode="cover" />;
    }
    return (
      <View style={{ width: w * 0.72, borderRadius: radius.lg, overflow: 'hidden' }}>
        <ProductVisual product={p} height={w * 0.66} view={i % 3} />
      </View>
    );
  };

  const actions = presenting
    ? [{ icon: 'checkmark-circle-outline' as const, label: 'Terminar presentación', onPress: close }]
    : role === 'medico'
      ? [
          { icon: 'add' as const, label: 'Solicitar', onPress: () => router.push({ pathname: '/solicitud/nueva', params: { productId: p.id } }) },
          { icon: 'chatbubble-outline' as const, label: 'Contactar', onPress: () => router.push(`/chat/${chatWith(labByName(p.lab)?.repId ?? 'v1')}`) },
        ]
      : [
          { icon: 'play-circle-outline' as const, label: 'Presentar', onPress: () => router.push(`/presentacion/${p.id}`) },
          { icon: 'send-outline' as const, label: 'Compartir', onPress: () => setShare(true) },
        ];

  return (
    <View style={{ flex: 1, backgroundColor: pal.bgDeep }}>
      <Animated.ScrollView
        ref={scroll as never}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- 1 · PORTADA ---------- */}
        <View style={{ height: heroH, overflow: 'hidden' }}>
          <LinearGradient colors={[pal.bg, pal.bgDeep]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
          <Streaks width={width} height={heroH} reduce={reduce} />
          <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: heroH * 0.2, transform: [{ translateY: textY }] }} pointerEvents="none">
            <Marquee text={c.name.toUpperCase()} size={giantSize} color={pal.giant} reduce={reduce} />
            <Marquee text={c.name.toUpperCase()} size={giantSize} color={pal.giant} reduce={reduce} reverse faded />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: heroH * 0.1, alignItems: 'center', transform: [{ translateY: boxY }] }}>
            <ShowBox ref={hero} key={`h-${mode}`} product={p} textures={c.textures} width={width} height={heroH * 0.56} fill={0.6} paused={!on.hero} reduce={reduce} edge={pal.mainDeep} />
          </Animated.View>

          <View style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <RoundButton icon={presenting ? 'close' : 'chevron-back'} label={presenting ? 'Terminar presentación' : 'Volver'} onPress={close} color={pal.bg} />
            {presenting ? (
              <View style={{ backgroundColor: pal.veil, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Ionicons name="time-outline" size={14} color={colors.white} />
                <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.white }}>{mm}</Text>
              </View>
            ) : null}
            <View style={{ flex: 1 }} />
            {c.hasModes ? (
              <ModeToggle value={mode} onChange={setMode} options={[{ value: 'real', label: 'Nombre real' }, { value: 'ficticio', label: 'Ficticio' }]} color={pal.bg} veil={pal.veil} />
            ) : (
              <RoundButton icon="share-social-outline" label="Compartir ficha" onPress={() => setShare(true)} color={pal.bg} />
            )}
          </View>

          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 54, alignItems: 'center' }}>
            <View style={{ width: W, paddingHorizontal: space.xl, gap: space.md }}>
              <Text style={s.overline}>{c.labLine}</Text>
              <Text style={{ fontFamily: font.bold, fontSize: 30, lineHeight: 34, color: colors.white, letterSpacing: -0.5 }}>{c.mark}</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: colors.white, opacity: 0.88 }}>{c.formula}.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {c.badges.map((b) => (
                  <View key={b} style={[s.badge, { backgroundColor: pal.veil }]}>
                    <Text style={s.badgeText}>{b}</Text>
                  </View>
                ))}
                <View style={[s.badge, { backgroundColor: colors.white }]}>
                  <Text style={[s.badgeText, { color: pal.main }]}>{c.stamp}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs, flexWrap: 'wrap' }}>
                <Pill icon="cube-outline" label="Ver en 3D" onPress={() => setFull(true)} color={pal.main} />
                <Pill icon="scan-outline" label="Ver en AR" onPress={launchAR} variant="outline" color={pal.main} />
              </View>
              {ar ? <ArNote result={ar} pal={pal} /> : null}
            </View>
          </View>
          <TornEdge width={width} color={pal.paper} />
        </View>

        {/* ---------- 2 · FICHA TÉCNICA ---------- */}
        <View onLayout={mark('tecnica')} style={{ backgroundColor: pal.paper, paddingVertical: space.xl, overflow: 'hidden' }}>
          <Topo width={width} height={720} color={pal.line} />
          <View style={{ alignSelf: 'center', width: W, paddingHorizontal: space.xl, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1.25, gap: space.sm, zIndex: 1 }}>
              <Text style={[s.script, { color: pal.main }]}>Ficha técnica</Text>
              <Text style={{ fontFamily: font.bold, fontSize: 30, lineHeight: 32, color: pal.ink, letterSpacing: -1 }}>{p.form.split('·')[0].trim().toUpperCase()}</Text>
              <View style={{ borderWidth: 2, borderColor: pal.ink, padding: 4, backgroundColor: pal.paper, marginTop: space.sm }}>
                <View style={{ borderWidth: 1, borderColor: pal.ink, paddingHorizontal: space.md, paddingVertical: space.xs }}>
                  {c.facts.map((f, i) => (
                    <Stat key={f.label} f={f} first={i === 0} pal={pal} show={on.tecnica || reduce} delay={i * 120} />
                  ))}
                </View>
              </View>
            </View>
            <View style={{ flex: 1, marginLeft: -space.md }}>
              <ShowBox key={`t-${mode}`} product={p} textures={c.textures} width={W * 0.46} height={W * 0.72} fill={1} interactive={false} paused={!on.tecnica} reduce={reduce} edge={pal.mainDeep} spin={0.0003} />
            </View>
          </View>
        </View>

        {/* ---------- 3 · CARA POR CARA ---------- */}
        <View onLayout={mark('caras')} style={{ backgroundColor: pal.paper, paddingBottom: space.xl, overflow: 'hidden' }}>
          <Topo width={width} height={1000} color={pal.line} seed={7} />
          <View style={{ alignSelf: 'center', width: W, paddingHorizontal: space.xl, gap: 4 }}>
            <Text style={[s.overline, { color: pal.main, opacity: 1 }]}>Explora el empaque</Text>
            <Text style={[s.h1, { color: pal.ink }]}>Cara por cara</Text>
            <Text style={[s.lead, { color: pal.ink }]}>Desliza las tarjetas: la caja gira a esa cara. Toca la tarjeta del centro para leer su texto.</Text>
          </View>
          <ShowBox
            ref={facesBox}
            key={`c-${mode}`}
            product={p}
            textures={c.textures}
            width={width}
            height={210}
            fill={0.88}
            float={false}
            autoRotate={false}
            interactive
            paused={!on.caras}
            reduce={reduce}
            edge={pal.mainDeep}
          />
          <Carousel
            key={`car-${mode}`}
            cards={c.cards}
            width={width}
            pal={pal}
            reduce={reduce}
            imageFor={imageFor}
            canZoom={!!c.textures}
            onZoom={(card) => setZoom(card)}
            onActive={(card) => {
              facesBox.current?.show(card.face);
              logEvent('ficha_cara', card.id);
            }}
          />
        </View>

        {/* ---------- 4 · COMPONENTES EN MANCHAS DE TINTA ---------- */}
        <View onLayout={mark('notas')} style={{ backgroundColor: colors.white }}>
          <TornEdge width={width} color={colors.white} top under={pal.paper} seed={21} />
          <View style={{ alignSelf: 'center', width: W, paddingHorizontal: space.xl, gap: 4, paddingTop: space.md }}>
            <Text style={[s.overline, { color: pal.main, opacity: 1 }]}>{c.textures ? 'Composición por cápsula' : 'Texto de ejemplo'}</Text>
            <Text style={[s.h1, { color: pal.ink }]}>{c.textures ? 'Componentes' : 'Usos descritos'}</Text>
            <Text style={[s.lead, { color: pal.ink }]}>Toca cada mancha para ver el texto completo.</Text>
          </View>
          <Notes p={p} c={c} pal={pal} w={W} paused={!on.notas} reduce={reduce} open={note} onToggle={(i) => setNote((n) => (n === i ? null : i))} mode={mode} />
        </View>

        {/* ---------- 5 · MODO DE USO Y AVISOS ---------- */}
        <View style={{ backgroundColor: colors.white, paddingBottom: space.xl }}>
          <View style={{ alignSelf: 'center', width: W, paddingHorizontal: space.xl, gap: space.lg }}>
            <View style={{ gap: space.md }}>
              <Text style={[s.giantTitle, { color: pal.main }]}>MODO DE USO</Text>
              {p.howTo.map((step, i) => (
                <View key={step} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 40, lineHeight: 42, color: pal.main, width: 40 }}>{i + 1}</Text>
                  <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 15, lineHeight: 22, color: pal.ink, paddingTop: 8 }}>{step}</Text>
                </View>
              ))}
            </View>
            <View style={{ backgroundColor: pal.paper, borderRadius: radius.xl, padding: space.lg, gap: space.sm }}>
              <Text style={[s.giantTitle, { color: pal.ink, fontSize: 28 }]}>AVISOS</Text>
              {p.precautions.map((t) => (
                <View key={t} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
                  <Ionicons name="alert-circle" size={20} color={pal.main} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 15, lineHeight: 21, color: pal.ink }}>{t}</Text>
                </View>
              ))}
              <Text style={s.fine}>{p.real ? 'Texto impreso en el empaque.' : 'Información general de ejemplo.'} Consulte siempre la documentación oficial del producto.</Text>
            </View>
          </View>
        </View>

        {/* ---------- 6 · PEDESTAL Y PRESENTACIÓN ---------- */}
        <View onLayout={mark('pedestal')} style={{ backgroundColor: colors.white, paddingBottom: space.xxl }}>
          <View style={{ alignSelf: 'center', width: W, paddingHorizontal: space.xl, gap: 4, alignItems: 'center' }}>
            <Text style={[s.script, { color: pal.main }]}>Así se presenta</Text>
            <Text style={[s.giantTitle, { color: pal.ink, textAlign: 'center' }]}>PRESENTACIÓN</Text>
          </View>
          <Podium width={W}>
            <ShowBox key={`p-${mode}`} product={p} textures={c.textures} width={240} height={250} fill={0.8} float={false} paused={!on.pedestal} reduce={reduce} spin={0.00028} edge={pal.mainDeep} />
          </Podium>
          <Lineup p={p} c={c} pal={pal} w={W} />
          {p.sizeCm || p.photo ? (
            <Text style={[s.fine, { textAlign: 'center', marginTop: space.md }]}>
              Medidas aproximadas: {`${(p.sizeCm ?? { w: 7, h: 10.5, d: 3.2 }).w} × ${(p.sizeCm ?? { w: 7, h: 10.5, d: 3.2 }).d} × ${(p.sizeCm ?? { w: 7, h: 10.5, d: 3.2 }).h}`.replace(/\./g, ',')} cm
            </Text>
          ) : null}
        </View>

        {/* ---------- 7 · CIERRE ---------- */}
        <View onLayout={mark('outro')} style={{ backgroundColor: pal.bgDeep, paddingBottom: insets.bottom + 96, overflow: 'hidden' }}>
          <TornEdge width={width} color={pal.bgDeep} top under={colors.white} seed={31} />
          <Outro name={c.name} stamp={c.stamp} show={outroOn || reduce} reduce={reduce} width={W} pal={pal} />
          <View style={{ alignSelf: 'center', width: W, paddingHorizontal: space.xl, gap: space.md, marginTop: space.xl }}>
            {actions.map((a, i) => (
              <Pill key={a.label} icon={a.icon} label={a.label} onPress={a.onPress} variant={i === 0 ? 'white' : 'outline'} color={pal.main} wide />
            ))}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Pill icon="expand-outline" label="3D" onPress={() => setFull(true)} variant="outline" color={pal.main} wide small />
              <Pill icon="scan-outline" label="AR" onPress={launchAR} variant="outline" color={pal.main} wide small />
              {c.cardId ? <Pill icon="card-outline" label="Tarjeta" onPress={openCard} variant="outline" color={pal.main} wide small /> : null}
            </View>
            {!presenting && p.photo ? <Pill icon="albums-outline" label="Diapositivas del producto" onPress={() => router.push({ pathname: '/presentacion/[id]', params: { id: p.id, modo: 'diapositivas' } })} variant="outline" color={pal.main} wide small /> : null}
            <Text style={{ fontFamily: font.regular, fontSize: 12, lineHeight: 18, color: colors.white, opacity: 0.8, textAlign: 'center', marginTop: space.sm }}>
              {c.disclaimer} La app no vende ni entrega medicamentos.
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
      </Animated.ScrollView>

      {/* ---------- barra de acciones (aparece al bajar de la portada) ---------- */}
      <ActionBar show={bar} pal={pal} actions={actions} bottom={insets.bottom} reduce={reduce} />

      <Modal visible={full} animationType={reduce ? 'none' : 'fade'} onRequestClose={() => setFull(false)}>
        <FullViewer product={p} textures={c.textures} onClose={() => setFull(false)} reduce={reduce} title={c.mark} pal={pal} />
      </Modal>
      <Modal visible={!!zoom} animationType={reduce ? 'none' : 'fade'} onRequestClose={() => setZoom(null)}>
        {zoom && c.textures ? (
          <PhotoZoom source={c.textures[zoom.face]} title={`${zoom.title} · ${FACE_LABEL[zoom.face]}`} onClose={() => setZoom(null)} pal={pal} ratio={zoom.face === 'top' || zoom.face === 'bottom' ? 1 : 1.447} />
        ) : null}
      </Modal>
      <ShareSheet product={p} visible={share} onClose={() => setShare(false)} />
    </View>
  );
}

// ---------- partes ----------

function ArNote({ result, pal }: { result: ArResult; pal: FichaPal }) {
  const text =
    result === 'abierto'
      ? 'Abriendo el visor de realidad aumentada del teléfono…'
      : result === 'solo-celular'
        ? 'La realidad aumentada se abre desde un celular (Android con Google o iPhone con Safari). Aquí puedes usar la vista 3D o la tarjeta impresa.'
        : 'Este teléfono no tiene el visor de realidad aumentada. Usa la vista 3D o la tarjeta impresa.';
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: pal.veil, borderRadius: radius.md, padding: space.md }}>
      <Ionicons name="information-circle-outline" size={18} color={colors.white} />
      <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 12, lineHeight: 17, color: colors.white }}>{text}</Text>
    </View>
  );
}

/** Cifra del recuadro: entra subiendo cuando la sección aparece */
function Stat({ f, first, pal, show, delay }: { f: { value: string; label: string; note: string }; first: boolean; pal: FichaPal; show: boolean; delay: number }) {
  const a = useRef(new Animated.Value(show ? 1 : 0)).current;
  useEffect(() => {
    if (show) Animated.timing(a, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [show, a, delay]);
  return (
    <Animated.View style={{ paddingVertical: space.sm, borderTopWidth: first ? 0 : 1, borderColor: pal.ink, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
      <Text style={{ fontFamily: font.bold, fontSize: 10, letterSpacing: 0.8, color: pal.ink, textTransform: 'uppercase' }}>{f.label}</Text>
      <Text style={{ fontFamily: font.bold, fontSize: f.value.length > 7 ? 22 : 30, lineHeight: 36, color: pal.main, letterSpacing: -1 }} numberOfLines={1}>
        {f.value}
      </Text>
      <Text style={{ fontFamily: font.regular, fontSize: 11, lineHeight: 15, color: colors.inkMuted }} numberOfLines={2}>
        {f.note}
      </Text>
    </Animated.View>
  );
}

function Carousel({
  cards,
  width,
  pal,
  reduce,
  imageFor,
  canZoom,
  onZoom,
  onActive,
}: {
  cards: VitrinaCard[];
  width: number;
  pal: FichaPal;
  reduce: boolean;
  imageFor: (c: VitrinaCard, i: number, w: number) => ReactNode;
  canZoom: boolean;
  onZoom: (c: VitrinaCard) => void;
  onActive: (c: VitrinaCard) => void;
}) {
  const cardW = Math.min(250, width * 0.62);
  const cardH = cardW * 1.36;
  const GAP = 14;
  const I = cardW + GAP;
  const pad = (width - cardW) / 2;
  const x = useRef(new Animated.Value(0)).current;
  const ref = useRef<ScrollView>(null);
  const [active, setActive] = useState(0);
  const [flipped, setFlipped] = useState<string | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onActiveRef = useRef(onActive);
  onActiveRef.current = onActive;
  const go = (i: number) => scrollToX(ref.current, Math.max(0, Math.min(cards.length - 1, i)) * I, !reduce);

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

  // la caja de arriba gira a la cara de la tarjeta del centro; al cambiar de tarjeta, la anterior vuelve a su frente
  useEffect(() => {
    setFlipped(null);
    const t = setTimeout(() => onActiveRef.current(cards[active]), 120);
    return () => clearTimeout(t);
  }, [active, cards]);

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
        contentContainerStyle={{ paddingHorizontal: pad, gap: GAP, paddingTop: space.md, paddingBottom: 56 }}
        // en la web el carrusel debe conservar su propio desplazamiento (si no, se mueve la sección entera)
        style={Platform.OS === 'web' ? undefined : { overflow: 'visible' }}
      >
        {cards.map((cd, i) => {
          const range = [(i - 1) * I, i * I, (i + 1) * I];
          return (
            <FaceCard
              key={cd.id}
              card={cd}
              w={cardW}
              h={cardH}
              pal={pal}
              center={i === active}
              flipped={flipped === cd.id}
              reduce={reduce}
              scale={x.interpolate({ inputRange: range, outputRange: [0.84, 1, 0.84], extrapolate: 'clamp' })}
              ty={x.interpolate({ inputRange: range, outputRange: [22, 0, 22], extrapolate: 'clamp' })}
              pop={x.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' })}
              image={imageFor(cd, i, cardW)}
              label={`${cd.title}, tarjeta ${i + 1} de ${cards.length}`}
              onPress={() => (i === active ? setFlipped((f) => (f === cd.id ? null : cd.id)) : go(i))}
            />
          );
        })}
      </Animated.ScrollView>

      {/* controles: anterior / puntos / siguiente */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md }}>
        <ArrowBtn icon="chevron-back" label="Tarjeta anterior" disabled={active === 0} onPress={() => go(active - 1)} pal={pal} />
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {cards.map((cd, i) => (
            <Pressable key={cd.id} onPress={() => go(i)} style={{ paddingVertical: 10, paddingHorizontal: 2 }} accessibilityRole="button" accessibilityLabel={`Ir a ${cd.title}`}>
              <View style={{ width: i === active ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === active ? pal.main : pal.line }} />
            </Pressable>
          ))}
        </View>
        <ArrowBtn icon="chevron-forward" label="Tarjeta siguiente" disabled={active === cards.length - 1} onPress={() => go(active + 1)} pal={pal} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap', paddingHorizontal: space.lg }}>
        <Pill icon={flipped ? 'image-outline' : 'reader-outline'} label={flipped ? 'Ver la foto' : 'Leer el texto'} onPress={() => setFlipped((f) => (f ? null : card.id))} variant="solid" color={pal.main} small />
        {canZoom ? <Pill icon="search-outline" label="Ampliar foto" onPress={() => onZoom(card)} variant="outlineColor" color={pal.main} small /> : null}
      </View>
    </View>
  );
}

function ArrowBtn({ icon, label, onPress, disabled, pal }: { icon: 'chevron-back' | 'chevron-forward'; label: string; onPress: () => void; disabled: boolean; pal: FichaPal }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: pal.main, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : pressed ? 0.6 : 1, backgroundColor: colors.white })}
    >
      <Ionicons name={icon} size={20} color={pal.main} />
    </Pressable>
  );
}

/** Tarjeta alta: al frente la foto de la cara saliendo de la tarjeta; al voltearla, su texto */
function FaceCard({
  card,
  w,
  h,
  pal,
  center,
  flipped,
  reduce,
  scale,
  ty,
  pop,
  image,
  label,
  onPress,
}: {
  card: VitrinaCard;
  w: number;
  h: number;
  pal: FichaPal;
  center: boolean;
  flipped: boolean;
  reduce: boolean;
  scale: Animated.AnimatedInterpolation<number>;
  ty: Animated.AnimatedInterpolation<number>;
  pop: Animated.AnimatedInterpolation<number>;
  image: ReactNode;
  label: string;
  onPress: () => void;
}) {
  const f = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) f.setValue(flipped ? 1 : 0);
    else Animated.spring(f, { toValue: flipped ? 1 : 0, useNativeDriver: true, stiffness: 180, damping: 18 }).start();
  }, [flipped, f, reduce]);
  const bg = card.tone === 'red' ? pal.main : pal.bg;
  const face = { position: 'absolute' as const, top: 0, left: 0, width: w, height: h, borderRadius: 26, backgroundColor: bg, backfaceVisibility: 'hidden' as const };
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={center ? 'Toca para voltear la tarjeta' : 'Toca para centrarla'}>
      <Animated.View
        style={{
          width: w,
          height: h,
          shadowColor: pal.ink,
          shadowOpacity: 0.28,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 12 },
          elevation: 8,
          borderRadius: 26,
          transform: [{ translateY: ty }, { scale }],
        }}
      >
        {/* frente */}
        {/* el cambio de cara se hace con opacidad a mitad del giro (backface-visibility no es fiable en la web) */}
        <Animated.View
          pointerEvents={flipped ? 'none' : 'auto'}
          style={[face, { padding: space.lg, opacity: f.interpolate({ inputRange: [0.49, 0.51], outputRange: [1, 0], extrapolate: 'clamp' }), transform: [{ perspective: 900 }, { rotateY: f.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }]}
        >
          <Text style={s.cardKicker}>{card.kicker}</Text>
          <Text style={{ fontFamily: font.bold, fontSize: card.title.length > 14 ? 21 : 26, lineHeight: card.title.length > 14 ? 25 : 30, color: colors.white, marginTop: 4 }} numberOfLines={2}>
            {card.title}
          </Text>
          <Animated.View
            style={{
              position: 'absolute',
              bottom: -h * 0.1,
              left: 0,
              right: 0,
              alignItems: 'center',
              shadowColor: pal.ink,
              shadowOpacity: 0.35,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 10 },
              transform: [
                { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [10, -6] }) },
                { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-6deg'] }) },
                { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.04] }) },
              ],
            }}
          >
            {image}
          </Animated.View>
          {center ? (
            <View style={{ position: 'absolute', top: space.lg, right: space.lg, width: 30, height: 30, borderRadius: 15, backgroundColor: pal.veil, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="sync-outline" size={16} color={colors.white} />
            </View>
          ) : null}
        </Animated.View>
        {/* reverso: el texto de esa cara */}
        <Animated.View
          pointerEvents={flipped ? 'auto' : 'none'}
          style={[face, { backgroundColor: colors.white, borderWidth: 3, borderColor: bg, padding: space.lg, opacity: f.interpolate({ inputRange: [0.49, 0.51], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ perspective: 900 }, { rotateY: f.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }) }] }]}
        >
          <Text style={[s.cardKicker, { color: bg }]}>{card.kicker}</Text>
          <Text style={{ fontFamily: font.bold, fontSize: 18, lineHeight: 22, color: pal.ink, marginTop: 2, marginBottom: space.sm }} numberOfLines={2}>
            {card.title}
          </Text>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {card.body ? <Text style={{ fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: pal.ink }}>{card.body}</Text> : null}
            {card.rowsHead ? (
              <View style={{ flexDirection: 'row', paddingBottom: 4, borderBottomWidth: 1, borderColor: pal.line }}>
                <Text style={[s.th, { flex: 1 }]}>{card.rowsHead[0]}</Text>
                <Text style={[s.th, { width: 70, textAlign: 'right' }]}>{card.rowsHead[1]}</Text>
                {card.rowsHead[2] ? <Text style={[s.th, { width: 52, textAlign: 'right' }]}>{card.rowsHead[2]}</Text> : null}
              </View>
            ) : null}
            {(card.rows ?? []).map((r) => (
              <View key={r.label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 5, borderBottomWidth: 1, borderColor: pal.paper }}>
                {!r.value ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: bg, marginTop: 7 }} /> : null}
                <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 12.5, lineHeight: 17, color: pal.ink }}>{r.label}</Text>
                {r.value ? <Text style={{ width: r.extra !== undefined ? 70 : 96, textAlign: 'right', fontFamily: font.semibold, fontSize: 12.5, lineHeight: 17, color: pal.ink }}>{r.value}</Text> : null}
                {r.extra !== undefined ? <Text style={{ width: 52, textAlign: 'right', fontFamily: font.regular, fontSize: 12.5, color: pal.ink }}>{r.extra}</Text> : null}
              </View>
            ))}
            {card.foot ? <Text style={[s.fine, { marginTop: space.sm }]}>{card.foot}</Text> : null}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/** Manchas de tinta alrededor del envase (componentes del producto real o usos de los ficticios) */
function Notes({ p, c, pal, w, paused, reduce, open, onToggle, mode }: { p: Product; c: FichaContent; pal: FichaPal; w: number; paused: boolean; reduce: boolean; open: number | null; onToggle: (i: number) => void; mode: VitrinaMode }) {
  const H = 640;
  const spots = [
    { x: 0.0, y: 0.02 },
    { x: 0.55, y: 0.06 },
    { x: -0.02, y: 0.5 },
    { x: 0.56, y: 0.54 },
    { x: 0.27, y: 0.78 },
  ];
  const size = Math.min(w * 0.46, 200);
  return (
    <View style={{ alignSelf: 'center', width: w, height: H }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: H * 0.22, alignItems: 'center' }} pointerEvents="none">
        <ShowBox key={`n-${mode}`} product={p} textures={c.textures} width={w * 0.6} height={H * 0.5} fill={0.85} interactive={false} paused={paused} reduce={reduce} edge={pal.mainDeep} spin={0.00035} />
      </View>
      {c.notes.slice(0, spots.length).map((n, i) => (
        <View key={n.title} style={{ position: 'absolute', left: spots[i].x * w, top: spots[i].y * H, zIndex: open === i ? 2 : 1 }}>
          <InkNote title={n.title} text={n.text} color={i % 2 ? pal.bgDeep : pal.main} size={size} seed={31 + i * 17} open={open === i} onPress={() => onToggle(i)} />
        </View>
      ))}
      {!p.real ? <Text style={[s.fine, { position: 'absolute', bottom: 0, left: space.lg, right: space.lg, textAlign: 'center' }]}>Texto de ejemplo: no corresponde a indicaciones aprobadas.</Text> : null}
    </View>
  );
}

function Lineup({ p, c, pal, w }: { p: Product; c: FichaContent; pal: FichaPal; w: number }) {
  const items = c.textures
    ? [
        { key: 'front' as const, label: 'Frente', sub: '9 cápsulas' },
        { key: 'left' as const, label: 'Composición', sub: 'Modo de empleo' },
        { key: 'right' as const, label: 'Nutricional', sub: 'Porción diaria' },
        { key: 'back' as const, label: 'Reverso', sub: 'Advertencias y lote' },
        { key: 'top' as const, label: 'Tapa', sub: 'Extremos' },
      ]
    : [
        { key: 'front' as const, label: 'Envase', sub: p.form.split('·')[1]?.trim() ?? p.form },
        { key: 'right' as const, label: 'Detalle', sub: p.component },
        { key: 'back' as const, label: 'Formato', sub: p.form.split('·')[0].trim() },
      ];
  const cw = Math.min(130, w * 0.34);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.lg, paddingHorizontal: space.xl, alignItems: 'flex-end', flexGrow: 1, justifyContent: 'center' }}>
      {items.map((it, i) => (
        <View key={it.key} style={{ width: cw, alignItems: 'center', gap: 6 }}>
          {c.textures ? (
            <Image
              source={c.textures[it.key]}
              style={{ width: cw * 0.8, height: it.key === 'top' ? cw * 0.8 : cw * 0.8 * 1.447, borderRadius: 4, transform: [{ rotate: i % 2 ? '3deg' : '-3deg' }] }}
              accessibilityLabel={`${it.label} del empaque`}
            />
          ) : (
            <View style={{ width: cw }}>
              <ProductVisual product={p} height={cw * 1.1} view={i} />
            </View>
          )}
          <View style={{ width: 26, height: 3, borderRadius: 2, backgroundColor: pal.main, marginTop: 4 }} />
          <Text style={{ fontFamily: font.bold, fontSize: 13, color: pal.ink, textAlign: 'center' }}>{it.label}</Text>
          <Text style={[s.fine, { textAlign: 'center' }]} numberOfLines={2}>
            {it.sub}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function Outro({ name, stamp, show, reduce, width, pal }: { name: string; stamp: string; show: boolean; reduce: boolean; width: number; pal: FichaPal }) {
  const a = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (!show) return;
    Animated.spring(a, { toValue: 1, useNativeDriver: true, stiffness: 120, damping: 16, mass: 1 }).start();
  }, [show, a]);
  const size = Math.min(width * 0.2, 96);
  const words = name.toUpperCase().split(' ');
  const longest = Math.max(...words.map((x) => x.length));
  const nameSize = Math.min(size, (width - space.xl * 2) / (longest * 0.78));
  const line = (dir: 1 | -1, delay: number) => ({
    opacity: a.interpolate({ inputRange: [delay, Math.min(1, delay + 0.5)], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [dir * 80, 0] }) }],
  });
  return (
    <View style={{ alignSelf: 'center', width, paddingHorizontal: space.xl, paddingTop: space.lg }}>
      <Animated.Text style={[{ fontFamily: font.semibold, fontSize: 22, color: colors.white }, line(-1, 0)]}>Para la visita médica</Animated.Text>
      <Animated.Text style={[{ fontFamily: font.bold, fontSize: size, lineHeight: size * 1.02, color: colors.white, letterSpacing: -size * 0.04 }, line(-1, 0.1)]}>CONOCE</Animated.Text>
      {words.map((wd, i) => (
        <Animated.Text key={wd + i} style={[{ fontFamily: font.bold, fontSize: nameSize, lineHeight: nameSize * 1.05, color: pal.giant, letterSpacing: -nameSize * 0.04, textAlign: 'right' }, line(1, 0.2 + i * 0.08)]}>
          {wd}
        </Animated.Text>
      ))}
      <Animated.View style={[{ alignSelf: 'flex-end', marginTop: space.md, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 }, line(1, 0.4)]}>
        <Text style={{ fontFamily: font.bold, fontSize: 13, color: pal.main, letterSpacing: 0.4 }}>{stamp.toUpperCase()}</Text>
      </Animated.View>
    </View>
  );
}

function ActionBar({ show, pal, actions, bottom, reduce }: { show: boolean; pal: FichaPal; actions: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }[]; bottom: number; reduce: boolean }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: show ? 1 : 0, duration: reduce ? 0 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [show, a, reduce]);
  return (
    <Animated.View
      pointerEvents={show ? 'box-none' : 'none'}
      style={{ position: 'absolute', left: 0, right: 0, bottom: bottom + space.md, alignItems: 'center', opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }}
    >
      <View style={{ flexDirection: 'row', gap: space.sm, padding: 6, borderRadius: radius.pill, backgroundColor: pal.bgDeep, shadowColor: pal.ink, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
        {actions.map((x, i) => (
          <Pill key={x.label} icon={x.icon} label={x.label} onPress={x.onPress} variant={i === 0 ? 'white' : 'outline'} color={pal.main} small />
        ))}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  overline: { fontFamily: font.bold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.white, opacity: 0.9 },
  h1: { fontFamily: font.bold, fontSize: 30, lineHeight: 34, letterSpacing: -0.5 },
  lead: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, opacity: 0.8 },
  script: { fontFamily: font.semibold, fontSize: 15, fontStyle: 'italic' },
  giantTitle: { fontFamily: font.bold, fontSize: 40, lineHeight: 44, letterSpacing: -1.5 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  badgeText: { fontFamily: font.semibold, fontSize: 12, color: colors.white },
  cardKicker: { fontFamily: font.semibold, fontSize: 11, letterSpacing: 1, color: colors.white, opacity: 0.85, textTransform: 'uppercase' },
  th: { fontFamily: font.bold, fontSize: 11, color: colors.inkMuted },
  fine: { fontFamily: font.medium, fontSize: 12, lineHeight: 17, color: colors.inkMuted },
});
