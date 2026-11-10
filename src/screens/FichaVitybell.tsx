import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Animated, Easing, Image, Linking, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import type { BoxFace, BoxTextures } from '@/components/PhotoBox3D';
import { ProductVisual } from '@/components/ProductVisual';
import { ShareSheet } from '@/components/ShareSheet';
import { TearBox } from '@/components/TearBox';
import { ModeToggle, PhotoZoom, Pill, RoundButton, useReduceMotion } from '@/components/showcase';
import { goBack } from '@/components/ui';
import { fichaPalette } from '@/data/ficha';
import { labByName, products, type Product } from '@/data/mock';
import type { VitrinaMode } from '@/data/vitrina';
import { VITYBELL } from '@/data/vitybell';
import { VIT_GROUPS, vitFaces, type VitFace, type VitNutrient } from '@/data/vitybell-info';
import { arCardUrl, fichaPdfUrl, openAR, type ArResult } from '@/lib/ar';
import { domEl } from '@/lib/webAnim';
import { ArNote } from '@/screens/Ficha';
import { useMine } from '@/store/AppStore';
import { colors, font, packColors, radius, space } from '@/theme';

// Catálogo de VITYBELL (Procaps), distinto de los otros cuatro: una revista rosada que se recorre bajando, con una
// portada animada (el nombre sube letra por letra, el trazo de cabello del logotipo se dibuja solo y flotan cápsulas
// perladas), una rueda de los 8 componentes que se gira con el dedo (el componente de arriba muestra su cantidad y
// su %VDR en un anillo), un selector cabello / uñas con dibujos animados, un blíster de las 5 cápsulas de la muestra
// que se sacan una por día, barras de %VDR, el listado de ingredientes que se resalta por grupos y la caja 3D con
// giro libre. Cada sección aparece al llegar a ella. Todo el texto está tomado de la caja (src/data/vitybell-info.ts);
// no se agregan indicaciones ni afirmaciones. Las cápsulas dibujadas son ilustrativas.

const C = packColors.vitybell;
type IconName = ComponentProps<typeof Ionicons>['name'];
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const N8 = VITYBELL.nutrients.length;
const STEP = 360 / N8;

export default function FichaVitybell({ product: p, presenting = false, visita, initialMode }: { product: Product; presenting?: boolean; visita?: string; initialMode?: VitrinaMode }) {
  const { role, chatWith, logEvent, visits, updateReport } = useMine();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [mode, setMode] = useState<VitrinaMode>(initialMode ?? 'real');
  const I = VITYBELL;
  const N = I.names[mode];
  const tex = I.textures[mode];
  const faces = useMemo(() => vitFaces(mode), [mode]);
  const pal = fichaPalette(p);

  const [face, setFace] = useState<VitFace | null>(null);
  const [fold, setFold] = useState(1);
  const [full, setFull] = useState(false);
  const [zoom, setZoom] = useState<VitFace | null>(null);
  const [share, setShare] = useState(false);
  const [ar, setAr] = useState<ArResult | null>(null);
  const [arTick, setArTick] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [nutrient, setNutrient] = useState(0); // componente de arriba en la rueda
  const started = useRef(Date.now());
  const scroll = useRef<ScrollView>(null);

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

  // ---------- cada sección aparece al llegar a ella ----------
  const ys = useRef<Record<string, number>>({});
  const seenRef = useRef<Record<string, boolean>>({ hero: true });
  const [seen, setSeen] = useState<Record<string, boolean>>({ hero: true });
  const scrollY = useRef(0);
  const [heroVisible, setHeroVisible] = useState(true);
  const check = useCallback(() => {
    const lim = scrollY.current + height * 0.86;
    let changed = false;
    for (const k of Object.keys(ys.current)) {
      if (!seenRef.current[k] && ys.current[k] < lim) {
        seenRef.current = { ...seenRef.current, [k]: true };
        changed = true;
      }
    }
    if (changed) setSeen(seenRef.current);
  }, [height]);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    check();
    const hv = scrollY.current < 760;
    if (hv !== heroVisible) setHeroVisible(hv);
  };
  const place = (k: string) => (e: LayoutChangeEvent) => {
    ys.current[k] = e.nativeEvent.layout.y;
    check();
  };
  const goTo = (k: string) => {
    const y = ys.current[k];
    if (y != null) scroll.current?.scrollTo({ y: Math.max(0, y - insets.top - 70), animated: !reduce });
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
  const openPdf = () => {
    logEvent('ficha_pdf', p.id);
    Linking.openURL(fichaPdfUrl(p.id)).catch(() => {});
  };
  const tap = (what: string) => logEvent('ficha_punto', `${p.id}:${what}`);
  const pickFace = (f: VitFace) => {
    tap(`cara-${f.face}`);
    setFold(1);
    setFace((cur) => (cur?.face === f.face ? null : f));
  };
  const showFace = (f: BoxFace) => {
    const found = faces.find((x) => x.face === f);
    if (!found) return;
    setFold(1);
    setFace(found);
    scroll.current?.scrollTo({ y: 0, animated: !reduce });
  };
  const pickNutrient = (k: string, jump = true) => {
    const i = I.nutrients.findIndex((n) => n.key === k);
    if (i < 0) return;
    tap(`componente-${k}`);
    setNutrient(i);
    if (jump) goTo('rueda');
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
  const related = products.filter((x) => x.id !== p.id && x.real).slice(0, 5);
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  const wide = width >= 900;
  const pad = wide ? space.xl : space.lg;
  const W = Math.min(width, wide ? 1120 : 720) - pad * 2;
  const boxW = wide ? W * 0.5 : W + pad * 2;
  const boxH = wide ? 440 : Math.min(380, Math.max(270, width * 0.86));

  return (
    <View style={{ flex: 1, backgroundColor: C.blush }}>
      <ScrollView ref={scroll} onScroll={onScroll} scrollEventThrottle={80} contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl * 2 }}>
        {/* ---------- portada ---------- */}
        <View onLayout={place('hero')} style={{ paddingTop: insets.top + 64, overflow: 'hidden' }}>
          <LinearGradient colors={[C.pinkSoft, C.blush, '#FBF4FA']} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
          <FloatingPearls width={width} height={wide ? 620 : 900} reduce={reduce} active={heroVisible && !full && !zoom} />
          <View style={{ width: W, alignSelf: 'center', flexDirection: wide ? 'row' : 'column', gap: space.lg, alignItems: wide ? 'center' : 'stretch' }}>
            <View style={{ flex: wide ? 1 : undefined, gap: space.sm }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Chip label={mode === 'real' ? 'GRUPO PROCAPS' : 'BIOANDES · FICTICIO'} solid />
                <Chip label="SUPLEMENTO ALIMENTICIO" />
                <Chip label="MUESTRA GRATUITA" accent />
              </View>
              <Title key={N.mark} text={N.mark} size={wide ? 96 : Math.min(76, width * 0.18)} maxWidth={wide ? W / 2 : W} reduce={reduce} />
              <Text style={{ fontFamily: font.semibold, fontSize: 15, lineHeight: 22, color: C.plum }}>{I.tagline}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {I.nutrients.map((n, i) => (
                  <Appear key={n.key} reduce={reduce} delay={500 + i * 70}>
                    <Tap onPress={() => pickNutrient(n.key)} label={`Ver ${n.name} en la rueda`}>
                      <View style={st.ingChip}>
                        <Text style={st.ingChipText}>{n.name}</Text>
                      </View>
                    </Tap>
                  </Appear>
                ))}
              </View>
              <Text style={st.small}>
                {I.net} {I.netDetail}
              </Text>
              {wide ? <HeroButtons onFull={() => setFull(true)} onAR={launchAR} fold={fold} onFold={() => { setFace(null); setFold(fold > 0.5 ? 0 : 1); }} /> : null}
            </View>
            <View style={{ flex: wide ? 1 : undefined, alignItems: 'center', marginHorizontal: wide ? 0 : -pad }}>
              <View style={{ width: boxW, height: boxH }}>
                <TearBox textures={tex} dims={I.dims} width={boxW} height={boxH} capsules capsuleColor={C.pearl} capsuleCount={8} free fold={fold} face={face?.face ?? null} edge={C.pink} active={heroVisible && !full && !zoom} reduce={reduce} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', paddingHorizontal: pad }}>
                {faces.map((f) => (
                  <Tap key={f.face} onPress={() => pickFace(f)} label={`Ver ${f.label.toLowerCase()} de la caja`} selected={face?.face === f.face}>
                    <View style={[st.facePill, face?.face === f.face && { backgroundColor: C.rose, borderColor: C.rose }]}>
                      <Text style={[st.facePillText, face?.face === f.face && { color: colors.white }]}>{f.label}</Text>
                    </View>
                  </Tap>
                ))}
              </View>
              <View style={{ alignSelf: 'stretch', minHeight: 80, marginTop: space.sm, paddingHorizontal: wide ? 0 : pad }}>
                {face ? (
                  <Appear key={face.face + mode} reduce={reduce}>
                    <View style={st.faceCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={st.overline}>{face.label}</Text>
                        <Text style={{ fontFamily: font.bold, fontSize: 15, color: C.plum }}>{face.title}</Text>
                        <Text style={st.small}>{face.body}</Text>
                      </View>
                      <MiniBtn icon="search-outline" label="Ampliar la foto de esta cara" onPress={() => setZoom(face)} />
                    </View>
                  </Appear>
                ) : (
                  <Hint icon="finger-print-outline" text="Gírala en cualquier dirección con el dedo o elige una cara" />
                )}
              </View>
              {!wide ? <HeroButtons onFull={() => setFull(true)} onAR={launchAR} fold={fold} onFold={() => { setFace(null); setFold(fold > 0.5 ? 0 : 1); }} /> : null}
            </View>
          </View>
          <View style={{ height: space.xxl }} />
        </View>

        <View style={{ width: W, alignSelf: 'center', gap: space.xxl, marginTop: space.lg }}>
          {/* ---------- rueda de componentes ---------- */}
          <Section k="rueda" onLayout={place('rueda')} shown={!!seen.rueda} reduce={reduce}>
            <Heading n="01" kicker="Componentes" title="La rueda de los ocho" text={`${I.serving} Gira la rueda o toca un componente: el de arriba muestra su cantidad por porción.`} />
            <Dial nutrients={I.nutrients} index={nutrient} onIndex={(i) => { tap(`rueda-${I.nutrients[i].key}`); setNutrient(i); }} reduce={reduce} size={Math.min(W, wide ? 460 : 380)} shown={!!seen.rueda} />
          </Section>

          {/* ---------- cabello y uñas ---------- */}
          <Section k="cabello" onLayout={place('cabello')} shown={!!seen.cabello} reduce={reduce}>
            <Heading n="02" kicker="En los cantos de la caja" title="Cabello y uñas" />
            <HairNails claims={I.claims} reduce={reduce} active={!!seen.cabello} onTap={tap} onNutrient={(k) => pickNutrient(k)} width={W} />
          </Section>

          {/* ---------- blíster: una cápsula al día ---------- */}
          <Section k="blister" onLayout={place('blister')} shown={!!seen.blister} reduce={reduce}>
            <Heading n="03" kicker="Modo de uso" title="Una cápsula al día" text={`Vía de administración: ${I.route} ${I.usage} ${I.maxDaily}`} />
            <Blister count={I.capsules} reduce={reduce} usage={I.usage} maxDaily={I.maxDaily} onTap={tap} width={W} />
          </Section>

          {/* ---------- información nutricional ---------- */}
          <Section k="tabla" onLayout={place('tabla')} shown={!!seen.tabla} reduce={reduce}>
            <Heading n="04" kicker="Información nutricional" title="%VDR por porción" text={I.serving} />
            <VdrBars nutrients={I.nutrients} zeros={I.zeros} note={I.vdrNote} shown={!!seen.tabla} reduce={reduce} onPick={(k) => pickNutrient(k)} onTap={tap} />
          </Section>

          {/* ---------- ingredientes ---------- */}
          <Section k="ingredientes" onLayout={place('ingredientes')} shown={!!seen.ingredientes} reduce={reduce}>
            <Heading n="05" kicker="Listado de ingredientes" title="Qué lleva la cápsula" text="Toca un grupo para encontrarlo en el texto de la caja." />
            <Ingredients text={I.ingredients} onTap={tap} />
          </Section>

          {/* ---------- uso y advertencias ---------- */}
          <Section k="avisos" onLayout={place('avisos')} shown={!!seen.avisos} reduce={reduce}>
            <Heading n="06" kicker="Antes de usar" title="Advertencia y población" />
            <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.md }}>
              <InfoCard icon="alert-circle-outline" tone="rose" title="Advertencia" text={I.warning} big="!" />
              <InfoCard icon="people-outline" tone="plum" title="Población" text={I.population} big="18+" />
              <InfoCard icon="leaf-outline" tone="pink" title="Contiene soya" text="Así lo indica el listado de ingredientes." big="Soya" />
            </View>
          </Section>

          {/* ---------- la caja, cara por cara ---------- */}
          <Section k="caja" onLayout={place('caja')} shown={!!seen.caja} reduce={reduce}>
            <Heading n="07" kicker="El empaque" title="La caja, cara por cara" text="Toca una foto para leerla de cerca; con «Girar» la caja de la portada la deja de frente." />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingRight: space.md }}>
              {faces.map((f) => {
                const side = f.face === 'left' || f.face === 'right';
                const edge = f.face === 'top' || f.face === 'bottom';
                const r = side ? I.dims.h / I.dims.d : edge ? I.dims.d / I.dims.w : I.dims.h / I.dims.w;
                const tw = side ? 64 : 210;
                return (
                  <View key={f.face} style={{ width: tw, gap: 6 }}>
                    <Tap onPress={() => { tap(`foto-${f.face}`); setZoom(f); }} label={`Ampliar ${f.label.toLowerCase()}`}>
                      <View style={{ height: 136, justifyContent: 'center' }}>
                        <Image source={tex[f.face]} style={{ width: tw, height: Math.min(136, tw * r), borderRadius: 6, borderWidth: 1, borderColor: C.line }} resizeMode="cover" accessibilityLabel={`Foto: ${f.label}`} />
                      </View>
                    </Tap>
                    <Text style={{ fontFamily: font.bold, fontSize: 11, color: C.plum }} numberOfLines={1}>
                      {f.label}
                    </Text>
                    <Pressable onPress={() => showFace(f.face)} accessibilityRole="button" accessibilityLabel={`Girar la caja: ${f.label}`} hitSlop={6}>
                      <Text style={{ fontFamily: font.semibold, fontSize: 11, color: C.rose, textDecorationLine: 'underline' }}>Girar</Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
            {mode === 'real' ? null : <Text style={st.small}>En la versión ficticia el nombre, los logotipos y el fabricante están tapados.</Text>}
          </Section>

          {/* ---------- fabricante ---------- */}
          <Section k="fabricante" onLayout={place('fabricante')} shown={!!seen.fabricante} reduce={reduce}>
            <View style={{ backgroundColor: C.plum, borderRadius: 28, padding: space.xl, gap: space.sm, overflow: 'hidden' }}>
              <Strand w={W} h={120} color="rgba(255,255,255,0.12)" style={{ position: 'absolute', right: -20, top: -10 }} />
              <Text style={[st.overline, { color: C.pearl }]}>Fabricante</Text>
              {mode === 'real' ? (
                <>
                  <Text style={st.onDark}>{I.maker}</Text>
                  <Text style={st.onDarkSmall}>{I.registry}</Text>
                  <Text style={st.onDarkSmall}>{I.importer}</Text>
                </>
              ) : (
                <Text style={st.onDark}>Laboratorio Bioandes (ficticio). En esta versión el fabricante, el importador y el registro están tapados.</Text>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.xs }}>
                <DarkChip label="Muestra gratuita" icon="gift-outline" />
                <DarkChip label="Vía oral" icon="medkit-outline" />
                {mode === 'real' ? <DarkChip label={`Logotipos: ${I.logos.join(' · ')}`} icon="ribbon-outline" /> : null}
              </View>
            </View>
          </Section>

          {/* ---------- para la visita ---------- */}
          <Section k="visita" onLayout={place('visita')} shown={!!seen.visita} reduce={reduce}>
            <Heading n="08" kicker="Para la visita médica" title={N.mark} />
            <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.sm }}>
              {actions.map((a, i) => (
                <View key={a.label} style={{ flex: wide ? 1 : undefined }}>
                  <Pill icon={a.icon} label={a.label} onPress={a.onPress} variant={i === 0 ? 'solid' : 'outlineColor'} color={C.rose} wide />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              <View style={{ flex: 1, minWidth: 90 }}>
                <Pill icon="cube-outline" label="3D" onPress={() => setFull(true)} variant="outlineColor" color={C.rose} wide small />
              </View>
              <View style={{ flex: 1, minWidth: 90 }}>
                <Pill icon="scan-outline" label="AR" onPress={launchAR} variant="outlineColor" color={C.rose} wide small />
              </View>
              {mode === 'real' ? (
                <View style={{ flex: 1, minWidth: 90 }}>
                  <Pill icon="card-outline" label="Tarjeta" onPress={openCard} variant="outlineColor" color={C.rose} wide small />
                </View>
              ) : null}
            </View>
            {mode === 'real' ? <Pill icon="document-text-outline" label="Ficha del producto (PDF)" onPress={openPdf} variant="outlineColor" color={C.rose} wide small /> : null}
            {!presenting ? <Pill icon="albums-outline" label="Diapositivas del producto" onPress={() => router.push({ pathname: '/presentacion/[id]', params: { id: p.id, modo: 'diapositivas' } })} variant="outlineColor" color={C.rose} wide small /> : null}
            <Text style={st.small}>{N.disclaimer} Las cápsulas dibujadas son ilustrativas. La app no vende ni entrega productos.</Text>
            {related.length && !presenting ? (
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                <Text style={st.overline}>También en el catálogo</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
                  {related.map((r) => (
                    <Pressable key={r.id} onPress={() => router.replace(`/producto/${r.id}`)} accessibilityRole="button" accessibilityLabel={`Ver ${r.name}`} style={{ width: 140 }}>
                      <ProductVisual product={r} height={90} />
                      <Text style={{ fontFamily: font.semibold, fontSize: 13, color: C.plum, marginTop: 6 }} numberOfLines={1}>
                        {r.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </Section>
        </View>
      </ScrollView>

      {/* ---------- cabecera flotante ---------- */}
      <LinearGradient pointerEvents="none" colors={['rgba(247, 236, 245, 0.98)', 'rgba(247, 236, 245, 0.85)', 'rgba(247, 236, 245, 0)']} locations={[0, 0.7, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 76 }} />
      <View style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm }} pointerEvents="box-none">
        <RoundButton icon={presenting ? 'close' : 'chevron-back'} label={presenting ? 'Terminar presentación' : 'Volver'} onPress={close} color={C.rose} />
        {presenting ? (
          <View style={{ backgroundColor: C.rose, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Ionicons name="time-outline" size={14} color={colors.white} />
            <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.white }}>{mm}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <ModeToggle
          value={mode}
          onChange={(m) => {
            setFace(null);
            setMode(m);
          }}
          options={[
            { value: 'real', label: 'Nombre real' },
            { value: 'ficticio', label: 'Ficticio' },
          ]}
          color={C.rose}
          veil="rgba(58, 36, 64, 0.78)"
        />
      </View>

      {ar ? <ArNote key={arTick} result={ar} pal={pal} hasCard={mode === 'real'} top={insets.top + 70} reduce={reduce} onDone={() => setAr(null)} /> : null}

      <Modal visible={full} animationType={reduce ? 'none' : 'fade'} onRequestClose={() => setFull(false)}>
        <FullBox textures={tex} faces={faces} dims={I.dims} title={N.mark} reduce={reduce} onClose={() => setFull(false)} onAR={launchAR} />
      </Modal>
      <Modal visible={!!zoom} animationType={reduce ? 'none' : 'fade'} onRequestClose={() => setZoom(null)}>
        {zoom ? (
          <PhotoZoom
            source={tex[zoom.face]}
            title={`${N.mark} · ${zoom.label}`}
            onClose={() => setZoom(null)}
            pal={pal}
            ratio={zoom.face === 'left' || zoom.face === 'right' ? I.dims.h / I.dims.d : zoom.face === 'top' || zoom.face === 'bottom' ? I.dims.d / I.dims.w : I.dims.h / I.dims.w}
          />
        ) : null}
      </Modal>
      <ShareSheet product={p} visible={share} onClose={() => setShare(false)} />
    </View>
  );
}

// ---------- piezas generales ----------

function Appear({ reduce, delay = 0, style, children }: { reduce: boolean; delay?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const a = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.timing(a, { toValue: 1, duration: 360, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a, reduce, delay]);
  return <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>{children}</Animated.View>;
}

/** sección que aparece (sube y se aclara) cuando se llega a ella */
function Section({ k, shown, reduce, onLayout, children }: { k: string; shown: boolean; reduce: boolean; onLayout: (e: LayoutChangeEvent) => void; children: ReactNode }) {
  const a = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (!shown || reduce) return;
    Animated.timing(a, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [shown, reduce, a]);
  return (
    <Animated.View
      nativeID={`vit-${k}`}
      onLayout={onLayout}
      style={{ gap: space.md, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) }, { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }] }}
    >
      {children}
    </Animated.View>
  );
}

function Heading({ n, kicker, title, text }: { n: string; kicker: string; title: string; text?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text style={{ fontFamily: font.bold, fontSize: 13, color: C.rose }}>{n}</Text>
        <View style={{ width: 28, height: 1.5, backgroundColor: C.rose, opacity: 0.5 }} />
        <Text style={st.overline}>{kicker}</Text>
      </View>
      <Text style={st.h2}>{title}</Text>
      {text ? <Text style={st.lead}>{text}</Text> : null}
    </View>
  );
}

/** botón con un leve hundimiento al tocarlo (resorte, en el hilo nativo) */
function Tap({ onPress, label, selected, style, children }: { onPress: () => void; label: string; selected?: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const k = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(k, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 7 }).start();
  return (
    <Pressable onPress={onPress} onPressIn={() => to(0.94)} onPressOut={() => to(1)} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} style={style}>
      <Animated.View style={{ transform: [{ scale: k }] }}>{children}</Animated.View>
    </Pressable>
  );
}

function Hint({ icon, text, color = C.rose }: { icon: IconName; text: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={{ fontFamily: font.semibold, fontSize: 12, color, textAlign: 'center', flexShrink: 1 }}>{text}</Text>
    </View>
  );
}

function Chip({ label, solid, accent }: { label: string; solid?: boolean; accent?: boolean }) {
  const bg = solid ? C.plum : accent ? C.rose : 'rgba(255,255,255,0.6)';
  return (
    <View style={{ borderRadius: radius.pill, borderWidth: 1.5, borderColor: solid ? C.plum : C.rose, backgroundColor: bg, paddingHorizontal: 11, paddingVertical: 4 }}>
      <Text style={{ fontFamily: font.bold, fontSize: 10.5, letterSpacing: 0.6, color: solid || accent ? colors.white : C.rose }}>{label}</Text>
    </View>
  );
}

function DarkChip({ label, icon }: { label: string; icon: IconName }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 10, paddingVertical: 5 }}>
      <Ionicons name={icon} size={13} color={colors.white} />
      <Text style={{ fontFamily: font.semibold, fontSize: 11, color: colors.white }}>{label}</Text>
    </View>
  );
}

function MiniBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: C.rose, opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={18} color={colors.white} />
    </Pressable>
  );
}

function HeroButtons({ onFull, onAR, fold, onFold }: { onFull: () => void; onAR: () => void; fold: number; onFold: () => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: space.sm, justifyContent: 'center' }}>
      <Pill icon="cube-outline" label="Ver en 3D" onPress={onFull} variant="solid" color={C.rose} small />
      <Pill icon="scan-outline" label="Ver en AR" onPress={onAR} variant="outlineColor" color={C.rose} small />
      <Pill icon={fold > 0.5 ? 'expand-outline' : 'cube-outline'} label={fold > 0.5 ? 'Desplegar' : 'Armar'} onPress={onFold} variant="outlineColor" color={C.rose} small />
    </View>
  );
}

/** cápsula blanda perlada (ilustrativa) */
function Pearl({ w, id = 'p' }: { w: number; id?: string }) {
  const h = w * 0.58;
  return (
    <Svg width={w} height={h}>
      <Defs>
        <SvgGradient id={`pearl-${id}`} x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor="#FFF4FA" />
          <Stop offset="0.45" stopColor={C.pearl} />
          <Stop offset="1" stopColor="#B85C8C" />
        </SvgGradient>
      </Defs>
      <Ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 1.5} ry={h / 2 - 1.5} fill={`url(#pearl-${id})`} />
      <Ellipse cx={w * 0.4} cy={h * 0.3} rx={w * 0.22} ry={h * 0.11} fill="#FFFFFF" opacity={0.7} />
    </Svg>
  );
}

/** cápsulas perladas que flotan detrás de la portada */
function FloatingPearls({ width, height, reduce, active }: { width: number; height: number; reduce: boolean; active: boolean }) {
  const spots = useMemo(
    () => [
      { x: 0.84, y: 0.06, w: 46, d: 0 },
      { x: 0.06, y: 0.3, w: 30, d: 500 },
      { x: 0.9, y: 0.36, w: 26, d: 900 },
      { x: 0.12, y: 0.62, w: 38, d: 300 },
      { x: 0.78, y: 0.74, w: 34, d: 1200 },
      { x: 0.5, y: 0.94, w: 24, d: 700 },
    ],
    [],
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {spots.map((s, i) => (
        <Floater key={i} x={s.x * width} y={s.y * height} delay={s.d} reduce={reduce} active={active}>
          <Pearl w={s.w} id={`f${i}`} />
        </Floater>
      ))}
    </View>
  );
}

function Floater({ x, y, delay, reduce, active, children }: { x: number; y: number; delay: number; reduce: boolean; active: boolean; children: ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce || !active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(a, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a, delay, reduce, active]);
  return (
    <Animated.View style={{ position: 'absolute', left: x, top: y, opacity: 0.85, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-9, 9] }) }, { rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '12deg'] }) }] }}>
      {children}
    </Animated.View>
  );
}

/** trazo de cabello como el del logotipo (decoración) */
function Strand({ w, h, color, style }: { w: number; h: number; color: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Svg pointerEvents="none" width={w} height={h} style={style}>
      <Path d={`M ${w * 0.05} ${h * 0.95} C ${w * 0.3} ${h * 0.3}, ${w * 0.65} ${h * 0.05}, ${w * 0.98} ${h * 0.12}`} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** el nombre sube letra por letra y el trazo de cabello se dibuja encima */
function Title({ text, size, maxWidth, reduce }: { text: string; size: number; maxWidth: number; reduce: boolean }) {
  const chars = text.split('');
  const vals = useRef(chars.map(() => new Animated.Value(reduce ? 1 : 0))).current;
  const draw = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.stagger(
      55,
      vals.map((v) => Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 9, bounciness: 9 })),
    ).start();
    Animated.timing(draw, { toValue: 1, duration: 1300, delay: 420, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();
  }, [vals, draw, reduce]);
  const L = 520;
  const w = Math.min(maxWidth, size * 0.62 * chars.length);
  return (
    <View style={{ marginTop: space.xs }} accessibilityRole="header" accessibilityLabel={text}>
      <View style={{ flexDirection: 'row' }}>
        {chars.map((ch, i) => (
          <Animated.Text
            key={i}
            style={{ fontFamily: font.semibold, fontSize: size, lineHeight: size * 1.08, color: ch === '®' ? C.plum : C.rose, letterSpacing: -size * 0.03, opacity: vals[i], transform: [{ translateY: vals[i].interpolate({ inputRange: [0, 1], outputRange: [size * 0.5, 0] }) }], ...(ch === '®' ? { fontSize: size * 0.32, lineHeight: size * 0.5 } : null) }}
          >
            {ch}
          </Animated.Text>
        ))}
      </View>
      <Svg pointerEvents="none" width={w} height={size * 1.15} viewBox="0 0 300 120" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: -size * 0.12 }}>
        <Defs>
          <SvgGradient id="strand" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={C.strand} stopOpacity="1" />
            <Stop offset="0.85" stopColor={C.strand} stopOpacity="0.6" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgGradient>
        </Defs>
        <AnimatedPath
          d="M 132 118 C 150 70, 190 26, 262 8"
          stroke="url(#strand)"
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${L} ${L}`}
          strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [L, 0] })}
        />
      </Svg>
    </View>
  );
}

// ---------- rueda de componentes ----------

function Dial({ nutrients, index, onIndex, reduce, size, shown }: { nutrients: VitNutrient[]; index: number; onIndex: (i: number) => void; reduce: boolean; size: number; shown: boolean }) {
  const rot = useRef(new Animated.Value(-index * STEP)).current;
  const rotNow = useRef(-index * STEP);
  const host = useRef<View>(null);
  const center = useRef<{ x: number; y: number } | null>(null);
  // giro de la rueda: ángulo del dedo alrededor del centro; se suma el cambio entre un movimiento y otro
  const drag = useRef({ start: 0, prevA: 0, acc: 0, ready: false, lastT: 0, vel: 0 });
  const [live, setLive] = useState(index);
  const liveRef = useRef(index);
  const [playing, setPlaying] = useState(false);
  const R = size / 2 - 38;

  useEffect(() => {
    const id = rot.addListener(({ value }) => {
      rotNow.current = value;
      const i = (((Math.round(-value / STEP) % N8) + N8) % N8);
      if (i !== liveRef.current) {
        liveRef.current = i;
        setLive(i);
      }
    });
    return () => rot.removeListener(id);
  }, [rot]);

  // la rueda gira hasta el componente pedido por el camino más corto
  const spinTo = useCallback(
    (i: number) => {
      const cur = rotNow.current;
      let target = -i * STEP;
      while (target - cur > 180) target -= 360;
      while (target - cur < -180) target += 360;
      if (reduce) rot.setValue(target);
      else Animated.spring(rot, { toValue: target, useNativeDriver: true, speed: 8, bounciness: 6 }).start();
    },
    [rot, reduce],
  );
  useEffect(() => {
    if (index !== liveRef.current) spinTo(index);
  }, [index, spinTo]);

  // recorrido automático
  useEffect(() => {
    if (!playing || !shown) return;
    const t = setInterval(() => onIndex((liveRef.current + 1) % N8), 2300);
    return () => clearInterval(t);
  }, [playing, shown, onIndex]);

  // en la web el gesto sobre la rueda no desplaza la página
  useEffect(() => {
    const el = domEl(host.current);
    if (el) el.style.touchAction = 'none';
  }, []);

  const angleAt = (x: number, y: number) => {
    const c = center.current;
    if (!c) return 0;
    return (Math.atan2(y - c.y, x - c.x) * 180) / Math.PI;
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 6,
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 6,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          setPlaying(false);
          rot.stopAnimation();
          const { pageX, pageY } = e.nativeEvent;
          drag.current = { start: rotNow.current, prevA: 0, acc: 0, ready: false, lastT: Date.now(), vel: 0 };
          host.current?.measureInWindow((x, y, w, h) => {
            center.current = { x: x + w / 2, y: y + h / 2 };
            drag.current.prevA = angleAt(pageX, pageY);
            drag.current.ready = true;
          });
        },
        onPanResponderMove: (e) => {
          const d0 = drag.current;
          if (!d0.ready) return;
          const a = angleAt(e.nativeEvent.pageX, e.nativeEvent.pageY);
          let d = a - d0.prevA;
          while (d > 180) d -= 360;
          while (d < -180) d += 360;
          d0.prevA = a;
          d0.acc += d;
          const now = Date.now();
          d0.vel = d0.vel * 0.5 + (d / Math.max(8, now - d0.lastT)) * 0.5;
          d0.lastT = now;
          rot.setValue(d0.start + d0.acc);
        },
        onPanResponderRelease: () => {
          const v = rotNow.current + Math.max(-90, Math.min(90, drag.current.vel * 220));
          const i = (((Math.round(-v / STEP) % N8) + N8) % N8);
          const target = Math.round(v / STEP) * STEP;
          Animated.spring(rot, { toValue: target, useNativeDriver: true, speed: 7, bounciness: 7 }).start();
          onIndex(i);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rot, onIndex],
  );

  const n = nutrients[live];
  const counter = rot.interpolate({ inputRange: [-3600, 3600], outputRange: ['3600deg', '-3600deg'] });
  const spin = rot.interpolate({ inputRange: [-3600, 3600], outputRange: ['-3600deg', '3600deg'] });
  return (
    <View style={{ alignItems: 'center', gap: space.md }}>
      <View ref={host} {...pan.panHandlers} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Rueda de componentes: gírala con el dedo o toca uno">
        {/* aro */}
        <View pointerEvents="none" style={{ position: 'absolute', width: R * 2, height: R * 2, borderRadius: R, borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed' }} />
        {/* marca de arriba */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 2, alignItems: 'center' }}>
          <Ionicons name="caret-down" size={18} color={C.rose} />
        </View>
        {/* centro: el componente de arriba */}
        <VdrRing key={n.key} n={n} size={R * 2 - 96} reduce={reduce} shown={shown} />
        {/* componentes alrededor */}
        <Animated.View pointerEvents="box-none" style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: spin }] }}>
          {nutrients.map((m, i) => {
            const a = ((i * STEP - 90) * Math.PI) / 180;
            const x = size / 2 + R * Math.cos(a);
            const y = size / 2 + R * Math.sin(a);
            const on = i === live;
            return (
              <Animated.View key={m.key} style={{ position: 'absolute', left: x - 34, top: y - 34, width: 68, height: 68, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: counter }] }}>
                <Pressable onPress={() => { setPlaying(false); onIndex(i); }} accessibilityRole="button" accessibilityLabel={`${m.name}: ${m.amount}, ${m.vdrText} VDR`} accessibilityState={{ selected: on }} hitSlop={4} style={{ alignItems: 'center' }}>
                  <View style={{ width: on ? 50 : 40, height: on ? 50 : 40, borderRadius: 25, backgroundColor: on ? C.rose : colors.white, borderWidth: 1.5, borderColor: on ? C.rose : C.line, alignItems: 'center', justifyContent: 'center', shadowColor: C.plum, shadowOpacity: on ? 0.22 : 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: on ? 4 : 1 }}>
                    <Text style={{ fontFamily: font.bold, fontSize: on ? 15 : 13, color: on ? colors.white : C.rose }}>{short(m)}</Text>
                  </View>
                  <Text numberOfLines={1} style={{ fontFamily: on ? font.bold : font.semibold, fontSize: 10, color: on ? C.rose : C.muted, marginTop: 3, width: 76, textAlign: 'center' }}>
                    {m.name.replace('Ácido ', 'Á. ')}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </Animated.View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <NavDot icon="chevron-back" label="Componente anterior" onPress={() => { setPlaying(false); onIndex((live + N8 - 1) % N8); }} />
        <Pressable onPress={() => setPlaying(!playing)} accessibilityRole="button" accessibilityLabel={playing ? 'Pausar el recorrido' : 'Recorrer los componentes'} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 40, borderRadius: 20, backgroundColor: C.rose, opacity: pressed ? 0.8 : 1 })}>
          <Ionicons name={playing ? 'pause' : 'play'} size={15} color={colors.white} />
          <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.white }}>{playing ? 'Pausar' : 'Recorrer'}</Text>
        </Pressable>
        <NavDot icon="chevron-forward" label="Componente siguiente" onPress={() => { setPlaying(false); onIndex((live + 1) % N8); }} />
      </View>
      <Text style={[st.small, { textAlign: 'center' }]}>
        {live + 1} de {N8} · {n.full}
      </Text>
    </View>
  );
}

const short = (n: VitNutrient) => ({ biotina: 'B', pantotenico: 'Ác', nicotinamida: 'Ni', zinc: 'Zn', cobre: 'Cu', selenio: 'Se', riboflavina: 'Ri', piridoxina: 'Pi' })[n.key] ?? n.name.slice(0, 2);

/** centro de la rueda: cantidad y anillo de %VDR que se llena (más de 100 %: el anillo se completa y se indica) */
function VdrRing({ n, size, reduce, shown }: { n: VitNutrient; size: number; reduce: boolean; shown: boolean }) {
  const a = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const [pct, setPct] = useState(reduce ? n.vdr : 0);
  useEffect(() => {
    if (!shown) return;
    if (reduce) {
      a.setValue(1);
      return setPct(n.vdr);
    }
    const id = a.addListener(({ value }) => setPct(n.vdr * value));
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => a.removeListener(id);
  }, [a, n.vdr, reduce, shown]);
  const r = size / 2 - 8;
  const L = 2 * Math.PI * r;
  const fill = Math.min(1, n.vdr / 100);
  const over = n.vdr > 100;
  const shownPct = pct >= n.vdr - 0.01 ? n.vdrText : `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
  return (
    <View pointerEvents="none" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.pinkSoft} strokeWidth={10} fill={colors.white} />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? C.rose : C.magenta}
          strokeWidth={10}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${L} ${L}`}
          strokeDashoffset={a.interpolate({ inputRange: [0, 1], outputRange: [L, L * (1 - fill)] })}
        />
      </Svg>
      <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 0.8, color: C.muted }}>{n.name.toUpperCase()}</Text>
      <Text style={{ fontFamily: font.bold, fontSize: size * 0.17, lineHeight: size * 0.2, color: C.plum, letterSpacing: -1 }}>{n.amount}</Text>
      <Text style={{ fontFamily: font.bold, fontSize: size * 0.1, color: over ? C.rose : C.magenta }}>{shownPct}</Text>
      <Text style={{ fontFamily: font.semibold, fontSize: 10, color: C.muted }}>VDR por porción{over ? ' · más de 100 %' : ''}</Text>
    </View>
  );
}

function NavDot({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.rose, backgroundColor: colors.white, opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={18} color={C.rose} />
    </Pressable>
  );
}

// ---------- cabello y uñas ----------

function HairNails({ claims, reduce, active, onTap, onNutrient, width }: { claims: { cabello: string; unas: string }; reduce: boolean; active: boolean; onTap: (k: string) => void; onNutrient: (k: string) => void; width: number }) {
  const [tab, setTab] = useState<'cabello' | 'unas'>('cabello');
  const x = useRef(new Animated.Value(0)).current;
  const pick = (t: 'cabello' | 'unas') => {
    onTap(`cantos-${t}`);
    setTab(t);
    Animated.spring(x, { toValue: t === 'cabello' ? 0 : 1, useNativeDriver: true, speed: 14, bounciness: 6 }).start();
  };
  const SEG = Math.min(width, 420) / 2 - 4;
  const keys = tab === 'cabello' ? ['zinc', 'biotina'] : ['zinc'];
  return (
    <View style={{ gap: space.md }}>
      <View style={{ alignSelf: 'center', flexDirection: 'row', padding: 4, borderRadius: radius.pill, backgroundColor: C.pinkSoft }}>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 4, left: 4, width: SEG, bottom: 4, borderRadius: radius.pill, backgroundColor: C.rose, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, SEG] }) }] }} />
        {(['cabello', 'unas'] as const).map((t) => (
          <Pressable key={t} onPress={() => pick(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} style={{ width: SEG, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            <Ionicons name={t === 'cabello' ? 'color-wand-outline' : 'hand-left-outline'} size={16} color={tab === t ? colors.white : C.rose} />
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: tab === t ? colors.white : C.rose }}>{t === 'cabello' ? 'Cabello' : 'Uñas'}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ borderRadius: 28, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: C.line }}>
        <LinearGradient colors={[C.pinkSoft, colors.white]} style={{ height: 190, alignItems: 'center', justifyContent: 'center' }}>
          {tab === 'cabello' ? <Hair key="h" reduce={reduce} active={active} /> : <Nails key="n" reduce={reduce} active={active} />}
        </LinearGradient>
        <Appear key={tab} reduce={reduce}>
          <View style={{ padding: space.lg, gap: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
              <Ionicons name="checkmark" size={22} color={C.rose} />
              <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 17, lineHeight: 25, color: C.plum }}>{tab === 'cabello' ? claims.cabello : claims.unas}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <Text style={st.small}>Ver en la rueda:</Text>
              {keys.map((k) => (
                <Tap key={k} onPress={() => onNutrient(k)} label={`Ver ${k === 'zinc' ? 'Zinc' : 'Biotina'} en la rueda`}>
                  <View style={[st.ingChip, { backgroundColor: C.rose, borderColor: C.rose }]}>
                    <Text style={[st.ingChipText, { color: colors.white }]}>{k === 'zinc' ? 'Zinc' : 'Biotina'}</Text>
                  </View>
                </Tap>
              ))}
            </View>
            <Text style={st.small}>Texto impreso en los cantos de la caja, con su marca de verificación.</Text>
          </View>
        </Appear>
      </View>
    </View>
  );
}

/** mechones que se mecen (dibujo) */
function Hair({ reduce, active }: { reduce: boolean; active: boolean }) {
  const strands = [0, 1, 2, 3, 4, 5, 6];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', height: 170, gap: 2 }}>
      {strands.map((i) => (
        <Sway key={i} delay={i * 140} reduce={reduce} active={active}>
          <Svg width={34} height={160}>
            <Path d={`M 17 0 C ${4 + (i % 3) * 4} 50, ${30 - (i % 2) * 6} 100, ${12 + (i % 4) * 3} 158`} stroke={i % 2 ? C.strand : C.plum} strokeWidth={i % 3 === 0 ? 4 : 3} strokeLinecap="round" fill="none" opacity={0.85} />
          </Svg>
        </Sway>
      ))}
    </View>
  );
}

function Sway({ delay, reduce, active, children }: { delay: number; reduce: boolean; active: boolean; children: ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  const grow = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.timing(grow, { toValue: 1, duration: 700, delay: delay * 0.6, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [grow, delay, reduce]);
  useEffect(() => {
    if (reduce || !active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 1500, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a, delay, reduce, active]);
  // gira desde la raíz (arriba): se mueve el centro hacia arriba, se gira y se devuelve
  return (
    <Animated.View style={{ opacity: grow, transform: [{ translateY: -80 }, { rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] }) }, { translateY: 80 }, { scaleY: grow }] }}>{children}</Animated.View>
  );
}

/** uñas con un brillo que las recorre (dibujo) */
function Nails({ reduce, active }: { reduce: boolean; active: boolean }) {
  const shine = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce || !active) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(shine, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }), Animated.delay(700), Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [shine, reduce, active]);
  const nails = [{ h: 92, w: 40 }, { h: 110, w: 44 }, { h: 118, w: 46 }, { h: 106, w: 44 }, { h: 80, w: 36 }];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 150 }}>
      {nails.map((n, i) => (
        <Appear key={i} reduce={reduce} delay={i * 80}>
          <View style={{ width: n.w, height: n.h, borderTopLeftRadius: n.w / 2, borderTopRightRadius: n.w / 2, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, overflow: 'hidden', backgroundColor: C.pearl, borderWidth: 2, borderColor: '#FFFFFF' }}>
            <LinearGradient colors={['#FFF4FA', C.pearl, '#C8709C']} style={StyleSheet.absoluteFill} />
            <Animated.View style={{ position: 'absolute', top: -20, bottom: -20, width: 14, backgroundColor: 'rgba(255,255,255,0.75)', transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-30, n.w + 30] }) }, { rotate: '18deg' }] }} />
          </View>
        </Appear>
      ))}
    </View>
  );
}

// ---------- blíster: una cápsula al día ----------

function Blister({ count, reduce, usage, maxDaily, onTap, width }: { count: number; reduce: boolean; usage: string; maxDaily: string; onTap: (k: string) => void; width: number }) {
  const [taken, setTaken] = useState<number[]>([]);
  const [day, setDay] = useState(1);
  const [today, setToday] = useState(false); // ya se sacó la cápsula de hoy
  const [warn, setWarn] = useState(0);
  const shake = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const done = taken.length === count;
  const press = (i: number) => {
    if (taken.includes(i)) return;
    if (today) {
      onTap('blister-maximo');
      setWarn((w) => w + 1);
      if (!reduce) {
        shake.setValue(0);
        Animated.sequence([0, 1, -1, 1, -1, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 55, useNativeDriver: true }))).start();
      }
      return;
    }
    onTap(`blister-${i + 1}`);
    setWarn(0);
    setToday(true);
    const next = [...taken, i];
    setTaken(next);
    if (next.length === count && !reduce) {
      burst.setValue(0);
      Animated.timing(burst, { toValue: 1, duration: 1100, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  };
  const nextDay = () => {
    onTap('blister-dia');
    setToday(false);
    setWarn(0);
    setDay((d) => d + 1);
  };
  const reset = () => {
    setTaken([]);
    setDay(1);
    setToday(false);
    setWarn(0);
  };
  const pocket = Math.min(58, (Math.min(width, 520) - 48 - 4 * 12) / 5);
  const msg = done
    ? { icon: 'sparkles' as IconName, color: C.rose, text: `Las ${count} cápsulas de la muestra, una por día.` }
    : warn
      ? { icon: 'alert-circle' as IconName, color: C.rose, text: `${maxDaily} Pasa al día siguiente para sacar otra.` }
      : today
        ? { icon: 'checkmark-circle' as IconName, color: C.magenta, text: `Día ${day}: ${usage.toLowerCase().replace('.', '')}, listo.` }
        : { icon: 'finger-print-outline' as IconName, color: C.muted, text: `Día ${day}: presiona una cápsula para sacarla del blíster.` };
  return (
    <View style={{ gap: space.md }}>
      <View style={{ alignSelf: 'center', alignItems: 'center' }}>
        <Animated.View style={{ transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }] }}>
          <LinearGradient colors={['#F5F3F7', '#D9D4DE', '#F2EFF4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 18, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: '#CFC8D6' }}>
            {Array.from({ length: count }, (_, i) => (
              <Pocket key={i} size={pocket} out={taken.includes(i)} reduce={reduce} onPress={() => press(i)} label={`Cápsula ${i + 1}${taken.includes(i) ? ', ya se sacó' : ''}`} />
            ))}
          </LinearGradient>
        </Animated.View>
        {/* lluvia de cápsulas al terminar */}
        {done ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            {Array.from({ length: 10 }, (_, k) => {
              const ang = (k / 10) * Math.PI * 2;
              return (
                <Animated.View key={k} style={{ position: 'absolute', opacity: burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }), transform: [{ translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(ang) * 140] }) }, { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(ang) * 90] }) }, { rotate: `${k * 36}deg` }] }}>
                  <Pearl w={22} id={`b${k}`} />
                </Animated.View>
              );
            })}
          </View>
        ) : null}
      </View>
      <Appear key={`${taken.length}-${warn}-${today}-${day}`} reduce={reduce}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: msg.color === C.rose ? '#FCE6EC' : colors.white, borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: C.line }}>
          <Ionicons name={msg.icon} size={18} color={msg.color} />
          <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13, lineHeight: 18, color: msg.color === C.muted ? C.plum : msg.color }}>{msg.text}</Text>
        </View>
      </Appear>
      <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center', flexWrap: 'wrap' }}>
        {!done ? <Pill icon="sunny-outline" label="Pasar al día siguiente" onPress={nextDay} variant={today ? 'solid' : 'outlineColor'} color={C.rose} small /> : null}
        {taken.length ? <Pill icon="refresh" label="Reiniciar" onPress={reset} variant="outlineColor" color={C.rose} small /> : null}
      </View>
      <Text style={[st.small, { textAlign: 'center' }]}>Ejemplo visual del modo de uso impreso en la caja · Cápsulas ilustrativas.</Text>
    </View>
  );
}

function Pocket({ size, out, reduce, onPress, label }: { size: number; out: boolean; reduce: boolean; onPress: () => void; label: string }) {
  const a = useRef(new Animated.Value(out ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return a.setValue(out ? 1 : 0);
    if (out) Animated.timing(a, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    else a.setValue(0);
  }, [out, a, reduce]);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: out }} style={{ width: size, height: size * 1.5, alignItems: 'center', justifyContent: 'center' }}>
      {/* alvéolo */}
      <View style={{ position: 'absolute', width: size, height: size * 1.5, borderRadius: size / 2, backgroundColor: out ? '#E8E3EC' : 'rgba(255,255,255,0.55)', borderWidth: 1.5, borderColor: out ? '#BDB4C6' : '#FFFFFF', borderStyle: out ? 'dashed' : 'solid' }} />
      <Animated.View style={{ opacity: a.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.6, 0] }), transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 1.4] }) }, { scale: a.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1.25, 0.6] }) }, { rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '200deg'] }) }] }}>
        <Pearl w={size * 1.2} id={`k${size}${label.length}`} />
      </Animated.View>
    </Pressable>
  );
}

// ---------- barras de %VDR ----------

function VdrBars({ nutrients, zeros, note, shown, reduce, onPick, onTap }: { nutrients: VitNutrient[]; zeros: string[]; note: string; shown: boolean; reduce: boolean; onPick: (k: string) => void; onTap: (k: string) => void }) {
  const [sorted, setSorted] = useState(false);
  const [showZeros, setShowZeros] = useState(false);
  const list = sorted ? [...nutrients].sort((a, b) => b.vdr - a.vdr) : nutrients;
  const MAX = 300;
  return (
    <View style={{ backgroundColor: colors.white, borderRadius: 28, padding: space.lg, gap: space.md, borderWidth: 1, borderColor: C.line }}>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Pill icon={sorted ? 'list-outline' : 'stats-chart-outline'} label={sorted ? 'Orden de la caja' : 'Ordenar por %VDR'} onPress={() => { onTap('tabla-orden'); setSorted(!sorted); }} variant="outlineColor" color={C.rose} small />
        <Pill icon={showZeros ? 'eye-off-outline' : 'eye-outline'} label={showZeros ? 'Ocultar valores en cero' : 'Ver valores en cero'} onPress={() => setShowZeros(!showZeros)} variant="outlineColor" color={C.rose} small />
      </View>
      <View style={{ gap: 10 }}>
        {list.map((n, i) => (
          <Bar key={n.key} n={n} ratio={Math.min(1, n.vdr / MAX)} hundred={100 / MAX} shown={shown} delay={i * 80} reduce={reduce} onPress={() => onPick(n.key)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 2, height: 12, backgroundColor: C.plum }} />
        <Text style={st.small}>La línea marca el 100 % del VDR. Toca un componente para verlo en la rueda.</Text>
      </View>
      {showZeros ? (
        <Appear reduce={reduce}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {zeros.map((z) => (
              <View key={z} style={{ borderRadius: radius.pill, backgroundColor: C.blush, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ fontFamily: font.medium, fontSize: 11, color: C.plum }}>{z}</Text>
              </View>
            ))}
          </View>
        </Appear>
      ) : null}
      <Text style={st.small}>{note}</Text>
    </View>
  );
}

function Bar({ n, ratio, hundred, shown, delay, reduce, onPress }: { n: VitNutrient; ratio: number; hundred: number; shown: boolean; delay: number; reduce: boolean; onPress: () => void }) {
  const a = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!shown || reduce) return;
    Animated.timing(a, { toValue: 1, duration: 900, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [shown, reduce, a, delay]);
  const over = n.vdr > 100;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${n.name}: ${n.amount}, ${n.vdrText} VDR. Ver en la rueda`} style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13, color: C.plum }} numberOfLines={1}>
          {n.name} <Text style={{ fontFamily: font.regular, color: C.muted }}>· {n.amount}</Text>
        </Text>
        <Text style={{ fontFamily: font.bold, fontSize: 13, color: over ? C.rose : C.magenta }}>{n.vdrText}</Text>
      </View>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 12, borderRadius: 6, backgroundColor: C.blush, overflow: 'hidden' }}>
        {/* la barra entra deslizándose desde la izquierda (en el hilo nativo) */}
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: w * ratio, borderRadius: 6, backgroundColor: over ? C.rose : C.magenta, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-w * ratio, 0] }) }] }} />
        <View style={{ position: 'absolute', left: w * hundred - 1, top: -2, bottom: -2, width: 2, backgroundColor: C.plum, opacity: 0.6 }} />
      </View>
    </Pressable>
  );
}

// ---------- ingredientes ----------

function Ingredients({ text, onTap }: { text: string; onTap: (k: string) => void }) {
  const [group, setGroup] = useState<string | null>(null);
  const g = VIT_GROUPS.find((x) => x.key === group);
  const count = (words: string[]) => words.reduce((s, w) => s + (text.match(new RegExp(`\\b${w}\\b`, 'gi'))?.length ?? 0), 0);
  const parts = useMemo(() => {
    if (!g) return [{ t: text, on: false }];
    const re = new RegExp(`(${g.words.join('|')})`, 'gi');
    return text.split(re).map((t) => ({ t, on: g.words.includes(t.toLowerCase()) }));
  }, [g, text]);
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {VIT_GROUPS.map((x) => {
          const on = group === x.key;
          return (
            <Tap key={x.key} onPress={() => { onTap(`ingredientes-${x.key}`); setGroup(on ? null : x.key); }} label={x.label} selected={on}>
              <View style={[st.ingChip, on && { backgroundColor: C.rose, borderColor: C.rose }]}>
                <Text style={[st.ingChipText, on && { color: colors.white }]}>
                  {x.label} <Text style={{ opacity: 0.7 }}>· {count(x.words)}</Text>
                </Text>
              </View>
            </Tap>
          );
        })}
      </View>
      <View style={{ backgroundColor: colors.white, borderRadius: 24, padding: space.lg, borderWidth: 1, borderColor: C.line }}>
        <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 23, color: C.plum }}>
          <Text style={{ fontFamily: font.bold }}>LISTADO DE INGREDIENTES: </Text>
          {parts.map((p, i) =>
            p.on ? (
              <Text key={i} style={{ backgroundColor: C.rose, color: colors.white, fontFamily: font.bold }}>
                {p.t}
              </Text>
            ) : (
              <Text key={i}>{p.t}</Text>
            ),
          )}
        </Text>
      </View>
    </View>
  );
}

function InfoCard({ icon, tone, title, text, big }: { icon: IconName; tone: 'rose' | 'plum' | 'pink'; title: string; text: string; big: string }) {
  const bg = tone === 'rose' ? C.rose : tone === 'plum' ? C.plum : colors.white;
  const fg = tone === 'pink' ? C.plum : colors.white;
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: 24, padding: space.lg, gap: 6, borderWidth: tone === 'pink' ? 1 : 0, borderColor: C.line, minHeight: 150 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Ionicons name={icon} size={22} color={tone === 'pink' ? C.rose : colors.white} />
        <Text style={{ fontFamily: font.bold, fontSize: 30, letterSpacing: -1, color: tone === 'pink' ? C.rose : 'rgba(255,255,255,0.9)' }}>{big}</Text>
      </View>
      <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 0.8, color: tone === 'pink' ? C.rose : C.pinkSoft, textTransform: 'uppercase' }}>{title}</Text>
      <Text style={{ fontFamily: font.semibold, fontSize: 15, lineHeight: 21, color: fg }}>{text}</Text>
    </View>
  );
}

/** vista 3D a pantalla completa: girar, elegir una cara, desplegar y abrir la AR */
function FullBox({ textures, faces, dims, title, reduce, onClose, onAR }: { textures: BoxTextures; faces: VitFace[]; dims: { w: number; h: number; d: number }; title: string; reduce: boolean; onClose: () => void; onAR: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [fold, setFold] = useState(1);
  const [face, setFace] = useState<BoxFace | null>(null);
  return (
    <View style={{ flex: 1, backgroundColor: C.blush }}>
      <LinearGradient colors={[C.pinkSoft, C.blush]} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <TearBox textures={textures} dims={dims} width={width} height={height * 0.64} fold={fold} face={face} capsules capsuleColor={C.pearl} capsuleCount={8} free edge={C.pink} reduce={reduce} />
      </View>
      <View style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <RoundButton icon="close" label="Cerrar la vista 3D" onPress={onClose} color={C.rose} />
        <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 18, color: C.plum }}>{title}</Text>
      </View>
      <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: insets.bottom + space.lg, gap: space.sm, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
          {faces.map((f) => (
            <Tap key={f.face} onPress={() => { setFold(1); setFace(face === f.face ? null : f.face); }} label={f.label} selected={face === f.face}>
              <View style={[st.facePill, face === f.face && { backgroundColor: C.rose, borderColor: C.rose }]}>
                <Text style={[st.facePillText, face === f.face && { color: colors.white }]}>{f.label}</Text>
              </View>
            </Tap>
          ))}
        </View>
        <Text style={{ fontFamily: font.medium, fontSize: 12, color: C.plum, opacity: 0.8, textAlign: 'center' }}>Gírala en cualquier dirección o elige una cara.</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, width: '100%', maxWidth: 460 }}>
          <Pill icon={fold > 0.5 ? 'expand-outline' : 'cube-outline'} label={fold > 0.5 ? 'Desplegar' : 'Armar'} onPress={() => { setFace(null); setFold(fold > 0.5 ? 0 : 1); }} variant="solid" color={C.rose} wide small />
          <Pill icon="scan-outline" label="Ver en AR" onPress={onAR} variant="outlineColor" color={C.rose} wide small />
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  h2: { fontFamily: font.bold, fontSize: 28, lineHeight: 33, color: C.plum, letterSpacing: -0.6 },
  lead: { fontFamily: font.medium, fontSize: 14, lineHeight: 21, color: C.muted },
  small: { fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: C.muted },
  overline: { fontFamily: font.bold, fontSize: 11, letterSpacing: 0.9, color: C.rose, textTransform: 'uppercase' },
  onDark: { fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: colors.white },
  onDarkSmall: { fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: C.pinkSoft },
  ingChip: { borderRadius: radius.pill, borderWidth: 1.5, borderColor: C.line, backgroundColor: colors.white, paddingHorizontal: 11, paddingVertical: 6 },
  ingChipText: { fontFamily: font.semibold, fontSize: 12, color: C.rose },
  facePill: { borderRadius: radius.pill, borderWidth: 1.5, borderColor: C.rose, backgroundColor: 'rgba(255,255,255,0.75)', paddingHorizontal: 11, paddingVertical: 6 },
  facePillText: { fontFamily: font.bold, fontSize: 11.5, color: C.rose },
  faceCard: { flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: space.md },
});

