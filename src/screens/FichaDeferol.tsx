import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Animated, Easing, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import type { BoxFace, BoxTextures } from '@/components/PhotoBox3D';
import { ProductVisual } from '@/components/ProductVisual';
import { ShareSheet } from '@/components/ShareSheet';
import { TearBox } from '@/components/TearBox';
import { ModeToggle, PhotoZoom, Pill, RoundButton, useReduceMotion } from '@/components/showcase';
import { goBack } from '@/components/ui';
import { DEFEROL } from '@/data/deferol';
import { defFaces, type DefFace } from '@/data/deferol-info';
import { fichaPalette } from '@/data/ficha';
import { labByName, products, type Product } from '@/data/mock';
import type { VitrinaMode } from '@/data/vitrina';
import { arCardUrl, fichaPdfUrl, openAR, type ArResult } from '@/lib/ar';
import { ArNote } from '@/screens/Ficha';
import { useMine } from '@/store/AppStore';
import { colors, font, packColors, radius, space } from '@/theme';

// Catálogo de DEFEROL (Procaps), distinto de los otros tres: una cuadrícula de mosaicos («bento») en una sola página
// con desplazamiento vertical. Cada mosaico es interactivo: la caja 3D gira hasta la cara que se elige, la cifra de
// 7000 U.I. se cuenta, la cápsula gira, la semana muestra la dosificación y el consumo máximo impresos, las
// indicaciones se pasan como tarjetas, las contraindicaciones se voltean y el termómetro sube hasta 30 °C.
// Colores de la caja: turquesa, plateado y coral. Todo el texto está tomado de la caja (src/data/deferol-info.ts);
// no se agregan indicaciones ni afirmaciones. La cápsula dibujada es ilustrativa.

const C = packColors.deferol;
type IconName = ComponentProps<typeof Ionicons>['name'];
const DAYS = [
  { k: 'L', name: 'Lunes' },
  { k: 'M', name: 'Martes' },
  { k: 'X', name: 'Miércoles' },
  { k: 'J', name: 'Jueves' },
  { k: 'V', name: 'Viernes' },
  { k: 'S', name: 'Sábado' },
  { k: 'D', name: 'Domingo' },
];

export default function FichaDeferol({ product: p, presenting = false, visita, initialMode }: { product: Product; presenting?: boolean; visita?: string; initialMode?: VitrinaMode }) {
  const { role, chatWith, logEvent, visits, updateReport } = useMine();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [mode, setMode] = useState<VitrinaMode>(initialMode ?? 'real');
  const I = DEFEROL;
  const N = I.names[mode];
  const tex = I.textures[mode];
  const faces = useMemo(() => defFaces(mode), [mode]);
  const pal = fichaPalette(p);

  const [face, setFace] = useState<DefFace | null>(null);
  const [fold, setFold] = useState(1);
  const [full, setFull] = useState(false);
  const [zoom, setZoom] = useState<DefFace | null>(null);
  const [share, setShare] = useState(false);
  const [ar, setAr] = useState<ArResult | null>(null);
  const [arTick, setArTick] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(Date.now());
  const scroll = useRef<ScrollView>(null);
  const [heroVisible, setHeroVisible] = useState(true);

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
  const pickFace = (f: DefFace) => {
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
  const related = products.filter((x) => x.id !== p.id && x.real).slice(0, 4);
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  // cuadrícula: 2 columnas en el teléfono, 4 en pantallas anchas
  const wide = width >= 900;
  const cols = wide ? 4 : 2;
  const GAP = space.md;
  const pad = wide ? space.xl : space.lg;
  const Wc = Math.min(width, 1120) - pad * 2;
  const colW = (Wc - GAP * (cols - 1)) / cols;
  const span = (n: number, nWide = n) => {
    const k = Math.min(cols, wide ? nWide : n);
    return colW * k + GAP * (k - 1);
  };
  const heroBoxH = wide ? 420 : Math.min(330, Math.max(240, width * 0.72));
  let order = 0;
  const next = () => order++;

  return (
    <View style={{ flex: 1, backgroundColor: C.aquaMist }}>
      <Swirls width={width} />
      <ScrollView
        ref={scroll}
        onScroll={(e) => setHeroVisible(e.nativeEvent.contentOffset.y < heroBoxH + 200)}
        scrollEventThrottle={64}
        contentContainerStyle={{ paddingTop: insets.top + 68, paddingBottom: insets.bottom + space.xxl * 2, alignItems: 'center' }}
      >
        <View style={{ width: Wc, flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
          {/* ---------- portada: caja 3D que gira a la cara elegida ---------- */}
          <Tile i={next()} reduce={reduce} width={span(2, 4)} bg="transparent" pad={0}>
            <LinearGradient colors={[C.aqua, '#8FE3DB', C.aquaSoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 28 }]} />
            <HeroArcs w={span(2, 4)} h={wide ? 520 : heroBoxH + 330} />
            <View style={{ flexDirection: wide ? 'row' : 'column', padding: wide ? space.xl : space.lg, gap: space.md }}>
              <View style={{ flex: wide ? 1 : undefined, gap: space.sm, justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Chip label={N.lab.toUpperCase()} solid />
                  <Chip label="VITAMINA D3" />
                  <Chip label="CÁPSULA BLANDA" />
                </View>
                <Text style={{ fontFamily: font.bold, fontSize: wide ? 64 : 48, lineHeight: wide ? 68 : 52, color: C.ink, letterSpacing: -1.5, marginTop: space.sm }}>{N.mark}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 30, lineHeight: 32, color: C.deep, letterSpacing: -1 }}>7000</Text>
                  <Text style={{ fontFamily: font.bold, fontSize: 15, color: C.deep, paddingBottom: 3 }}>U.I. · {I.activeName}</Text>
                </View>
                <Text style={{ fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: C.ink }}>{I.front.units} · {N.labLine}</Text>
                <View style={st.sample}>
                  <Ionicons name="medkit-outline" size={14} color={C.coral} />
                  <Text style={{ fontFamily: font.bold, fontSize: 12, color: C.coral }}>Muestra médica · prohibida su venta</Text>
                </View>
                {wide ? <HeroButtons onFull={() => setFull(true)} onAR={launchAR} fold={fold} onFold={() => { setFace(null); setFold(fold > 0.5 ? 0 : 1); }} /> : null}
              </View>
              <View style={{ flex: wide ? 1.25 : undefined, alignItems: 'center' }}>
                <View style={{ width: wide ? span(2, 4) * 0.55 : span(2), height: heroBoxH, marginHorizontal: wide ? 0 : -space.lg }}>
                  <TearBox
                    textures={tex}
                    dims={I.dims}
                    width={wide ? span(2, 4) * 0.55 : span(2)}
                    height={heroBoxH}
                    capsules
                    fold={fold}
                    face={face?.face ?? null}
                    edge={C.aqua}
                    active={heroVisible && !full && !zoom}
                    reduce={reduce}
                    zoom={1}
                  />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: space.sm }}>
                  {faces.map((f) => (
                    <Tap key={f.face} onPress={() => pickFace(f)} label={`Ver ${f.label.toLowerCase()} de la caja`} selected={face?.face === f.face}>
                      <View style={[st.facePill, face?.face === f.face && { backgroundColor: C.deep, borderColor: C.deep }]}>
                        <Text style={[st.facePillText, face?.face === f.face && { color: colors.white }]}>{f.label}</Text>
                      </View>
                    </Tap>
                  ))}
                </View>
                <View style={{ alignSelf: 'stretch', minHeight: 78, marginTop: space.sm }}>
                  {face ? (
                    <Appear key={face.face + mode} reduce={reduce}>
                      <View style={st.faceCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={st.overline}>{face.label}</Text>
                          <Text style={{ fontFamily: font.bold, fontSize: 15, color: C.ink }}>{face.title}</Text>
                          <Text style={st.small}>{face.body}</Text>
                        </View>
                        <MiniBtn icon="search-outline" label="Ampliar la foto de esta cara" onPress={() => setZoom(face)} />
                      </View>
                    </Appear>
                  ) : (
                    <Hint icon="finger-print-outline" text="Arrastra la caja para girarla o elige una cara" />
                  )}
                </View>
                {!wide ? <HeroButtons onFull={() => setFull(true)} onAR={launchAR} fold={fold} onFold={() => { setFace(null); setFold(fold > 0.5 ? 0 : 1); }} /> : null}
              </View>
            </View>
          </Tile>

          {/* ---------- composición: la cifra se cuenta ---------- */}
          <Tile i={next()} reduce={reduce} width={span(1)}>
            <CountTile reduce={reduce} onTap={() => tap('7000')} />
          </Tile>

          {/* ---------- forma farmacéutica y vía: la cápsula gira ---------- */}
          <Tile i={next()} reduce={reduce} width={span(1)} bg={C.ink}>
            <CapsuleTile reduce={reduce} onTap={() => tap('capsula')} form={I.pharmaForm} route={I.route} />
          </Tile>

          {/* ---------- dosificación: la semana ---------- */}
          <Tile i={next()} reduce={reduce} width={span(2)}>
            <WeekTile reduce={reduce} max={I.maxPerWeek} dosage={I.dosage} maxText={I.maxIntake} onTap={(k) => tap(`semana-${k}`)} />
          </Tile>

          {/* ---------- modo de uso: con o sin comidas ---------- */}
          <Tile i={next()} reduce={reduce} width={span(2)} bg={C.aquaSoft}>
            <MealsTile reduce={reduce} usage={I.usage(mode === 'real' ? 'Deferol' : N.mark)} onTap={(k) => tap(`comidas-${k}`)} />
          </Tile>

          {/* ---------- indicaciones: tarjetas que se pasan ---------- */}
          <Tile i={next()} reduce={reduce} width={span(2)}>
            <IndicationsTile items={I.indications} reduce={reduce} onTap={(k) => tap(`indicacion-${k + 1}`)} />
          </Tile>

          {/* ---------- contraindicaciones: tarjeta que se voltea ---------- */}
          <Tile i={next()} reduce={reduce} width={span(2)} bg="transparent" pad={0}>
            <FlipCard reduce={reduce} text={I.contraindications} onFlip={() => tap('contraindicaciones')} />
          </Tile>

          {/* ---------- conservación: el termómetro sube hasta 30 °C ---------- */}
          <Tile i={next()} reduce={reduce} width={span(1)}>
            <ThermoTile reduce={reduce} max={I.maxTemp} onTap={() => tap('30-grados')} />
          </Tile>

          {/* ---------- advertencias ---------- */}
          <Tile i={next()} reduce={reduce} width={span(1)} bg={C.coralSoft}>
            <View style={{ gap: space.sm }}>
              <Text style={[st.overline, { color: C.coral }]}>Advertencias y precauciones</Text>
              {[
                { icon: 'document-text-outline' as IconName, text: I.warnings[0] },
                { icon: 'medkit-outline' as IconName, text: I.warnings[1] },
                { icon: 'happy-outline' as IconName, text: 'Manténgase fuera del alcance de los niños.' },
              ].map((w) => (
                <View key={w.text} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <Ionicons name={w.icon} size={16} color={C.coral} style={{ marginTop: 2 }} />
                  <Text style={[st.body, { flex: 1, fontSize: 13, lineHeight: 19 }]}>{w.text}</Text>
                </View>
              ))}
            </View>
          </Tile>

          {/* ---------- la caja, cara por cara (fotos para leer) ---------- */}
          <Tile i={next()} reduce={reduce} width={span(2)}>
            <View style={{ gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text style={[st.h2, { flex: 1 }]}>La caja, cara por cara</Text>
                <Pill icon={fold > 0.5 ? 'expand-outline' : 'cube-outline'} label={fold > 0.5 ? 'Desplegar' : 'Armar'} onPress={() => { tap('troquel'); setFace(null); setFold(fold > 0.5 ? 0 : 1); scroll.current?.scrollTo({ y: 0, animated: !reduce }); }} variant="outlineColor" color={C.deep} small />
              </View>
              <Text style={st.small}>Toca una foto para leerla de cerca; con «Girar» la caja de arriba la deja de frente.</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingRight: space.sm }}>
                {faces.map((f) => {
                  const r = f.face === 'left' || f.face === 'right' ? I.dims.h / I.dims.d : f.face === 'top' || f.face === 'bottom' ? I.dims.d / I.dims.w : I.dims.h / I.dims.w;
                  const tw = f.face === 'left' || f.face === 'right' ? 62 : 190;
                  return (
                    <View key={f.face} style={{ width: tw, gap: 6 }}>
                      <Tap onPress={() => { tap(`foto-${f.face}`); setZoom(f); }} label={`Ampliar ${f.label.toLowerCase()}`}>
                        <View style={{ height: 120, justifyContent: 'center' }}>
                          <Image source={tex[f.face]} style={{ width: tw, height: Math.min(120, tw * r), borderRadius: 6, borderWidth: 1, borderColor: C.line }} resizeMode="cover" accessibilityLabel={`Foto: ${f.label}`} />
                        </View>
                      </Tap>
                      <Text style={{ fontFamily: font.bold, fontSize: 11, color: C.ink }} numberOfLines={1}>
                        {f.label}
                      </Text>
                      <Pressable onPress={() => showFace(f.face)} accessibilityRole="button" accessibilityLabel={`Girar la caja: ${f.label}`} hitSlop={6}>
                        <Text style={{ fontFamily: font.semibold, fontSize: 11, color: C.deep, textDecorationLine: 'underline' }}>Girar</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
              {mode === 'real' ? null : <Text style={st.small}>En la versión ficticia el nombre, los logotipos y el fabricante están tapados.</Text>}
            </View>
          </Tile>

          {/* ---------- fabricante ---------- */}
          <Tile i={next()} reduce={reduce} width={span(2)} bg={C.ink}>
            <View style={{ gap: space.sm }}>
              <Text style={[st.overline, { color: C.aqua }]}>Fabricante y registro</Text>
              {mode === 'real' ? (
                <>
                  <Text style={st.onDark}>{I.maker}</Text>
                  <Text style={st.onDarkSmall}>{I.registryCo}</Text>
                  <Text style={st.onDark}>{I.importer}</Text>
                  <Text style={st.onDarkSmall}>{I.registryEc}</Text>
                </>
              ) : (
                <Text style={st.onDark}>Laboratorio Bioandes (ficticio). En esta versión el fabricante, el importador y los registros están tapados.</Text>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.xs }}>
                <DarkChip label="Venta libre" icon="storefront-outline" />
                <DarkChip label="Muestra médica" icon="medkit-outline" />
                {mode === 'real' ? <DarkChip label={`Logotipos: ${I.logos.join(' · ')}`} icon="ribbon-outline" /> : null}
              </View>
            </View>
          </Tile>

          {/* ---------- para la visita ---------- */}
          <Tile i={next()} reduce={reduce} width={span(2, 4)}>
            <View style={{ gap: space.md }}>
              <Text style={st.overline}>Para la visita médica</Text>
              <Text style={st.h2}>{N.mark}</Text>
              <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.sm }}>
                {actions.map((a, i) => (
                  <View key={a.label} style={{ flex: wide ? 1 : undefined }}>
                    <Pill icon={a.icon} label={a.label} onPress={a.onPress} variant={i === 0 ? 'solid' : 'outlineColor'} color={C.deep} wide />
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                <View style={{ flex: 1, minWidth: 90 }}>
                  <Pill icon="cube-outline" label="3D" onPress={() => setFull(true)} variant="outlineColor" color={C.deep} wide small />
                </View>
                <View style={{ flex: 1, minWidth: 90 }}>
                  <Pill icon="scan-outline" label="AR" onPress={launchAR} variant="outlineColor" color={C.deep} wide small />
                </View>
                {mode === 'real' ? (
                  <View style={{ flex: 1, minWidth: 90 }}>
                    <Pill icon="card-outline" label="Tarjeta" onPress={openCard} variant="outlineColor" color={C.deep} wide small />
                  </View>
                ) : null}
              </View>
              {mode === 'real' ? <Pill icon="document-text-outline" label="Ficha del producto (PDF)" onPress={openPdf} variant="outlineColor" color={C.deep} wide small /> : null}
              {!presenting ? <Pill icon="albums-outline" label="Diapositivas del producto" onPress={() => router.push({ pathname: '/presentacion/[id]', params: { id: p.id, modo: 'diapositivas' } })} variant="outlineColor" color={C.deep} wide small /> : null}
              <Text style={st.small}>{N.disclaimer} La cápsula dibujada es ilustrativa. La app no vende ni entrega medicamentos.</Text>
              {related.length && !presenting ? (
                <View style={{ gap: space.sm, marginTop: space.sm }}>
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
          </Tile>
        </View>
      </ScrollView>

      {/* ---------- cabecera flotante ---------- */}
      <LinearGradient pointerEvents="none" colors={['rgba(238, 250, 249, 0.98)', 'rgba(238, 250, 249, 0.85)', 'rgba(238, 250, 249, 0)']} locations={[0, 0.7, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 76 }} />
      <View style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm }} pointerEvents="box-none">
        <RoundButton icon={presenting ? 'close' : 'chevron-back'} label={presenting ? 'Terminar presentación' : 'Volver'} onPress={close} color={C.deep} />
        {presenting ? (
          <View style={{ backgroundColor: C.deep, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
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
          color={C.deep}
          veil="rgba(11, 51, 50, 0.78)"
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

// ---------- piezas ----------

/** mosaico de la cuadrícula: aparece subiendo, uno tras otro */
function Tile({ i, reduce, width, bg = C.tile, pad = space.lg, children }: { i: number; reduce: boolean; width: number; bg?: string; pad?: number; children: ReactNode }) {
  return (
    <Appear reduce={reduce} delay={Math.min(i, 6) * 70} style={{ width }}>
      <View style={{ flex: 1, backgroundColor: bg, borderRadius: 28, padding: pad, overflow: 'hidden', borderWidth: bg === C.tile ? 1 : 0, borderColor: C.line, shadowColor: C.ink, shadowOpacity: bg === 'transparent' ? 0 : 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: bg === 'transparent' ? 0 : 2 }}>
        {children}
      </View>
    </Appear>
  );
}

function Appear({ reduce, delay = 0, style, children }: { reduce: boolean; delay?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const a = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.timing(a, { toValue: 1, duration: 340, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a, reduce, delay]);
  return <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>{children}</Animated.View>;
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

function Hint({ icon, text, color = C.deep }: { icon: IconName; text: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={{ fontFamily: font.semibold, fontSize: 12, color }}>{text}</Text>
    </View>
  );
}

function Chip({ label, solid }: { label: string; solid?: boolean }) {
  return (
    <View style={{ borderRadius: radius.pill, borderWidth: 1.5, borderColor: C.ink, backgroundColor: solid ? C.ink : 'rgba(255,255,255,0.45)', paddingHorizontal: 11, paddingVertical: 4 }}>
      <Text style={{ fontFamily: font.bold, fontSize: 10.5, letterSpacing: 0.6, color: solid ? colors.white : C.ink }}>{label}</Text>
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
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: C.deep, opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={18} color={colors.white} />
    </Pressable>
  );
}

function HeroButtons({ onFull, onAR, fold, onFold }: { onFull: () => void; onAR: () => void; fold: number; onFold: () => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: space.sm, justifyContent: 'center' }}>
      <Pill icon="cube-outline" label="Ver en 3D" onPress={onFull} variant="solid" color={C.deep} small />
      <Pill icon="scan-outline" label="Ver en AR" onPress={onAR} variant="outlineColor" color={C.deep} small />
      <Pill icon={fold > 0.5 ? 'expand-outline' : 'cube-outline'} label={fold > 0.5 ? 'Desplegar' : 'Armar'} onPress={onFold} variant="outlineColor" color={C.deep} small />
    </View>
  );
}

/** fondo: espirales plateadas como las del cartón */
function Swirls({ width }: { width: number }) {
  return (
    <Svg pointerEvents="none" width={width} height={900} style={{ position: 'absolute', top: 0, left: 0, opacity: 0.7 }}>
      {[
        { x: width * 0.92, y: 160, r: 90 },
        { x: width * 0.08, y: 620, r: 120 },
      ].map((s, k) => (
        <Path key={k} d={spiral(s.x, s.y, s.r)} stroke={C.line} strokeWidth={6} fill="none" strokeLinecap="round" />
      ))}
    </Svg>
  );
}

function spiral(cx: number, cy: number, r: number) {
  let d = '';
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * Math.PI * 3.2;
    const rr = r * (1 - i / 140);
    const x = cx + Math.cos(t) * rr;
    const y = cy + Math.sin(t) * rr;
    d += `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d;
}

/** arcos plateados de la caja, detrás de la portada */
function HeroArcs({ w, h }: { w: number; h: number }) {
  return (
    <Svg pointerEvents="none" width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        <SvgGradient id="silver" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
          <Stop offset="0.5" stopColor={C.silver} stopOpacity="0.8" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.5" />
        </SvgGradient>
      </Defs>
      <Path d={`M ${-w * 0.05} ${h * 1.02} C ${w * 0.05} ${h * 0.45}, ${w * 0.45} ${h * 0.2}, ${w * 1.08} ${h * 0.12}`} stroke="url(#silver)" strokeWidth={10} fill="none" />
      <Path d={`M ${w * 0.04} ${h * 1.04} C ${w * 0.12} ${h * 0.5}, ${w * 0.5} ${h * 0.25}, ${w * 1.08} ${h * 0.155}`} stroke="url(#silver)" strokeWidth={3} fill="none" />
      <Path d={spiral(w * 0.86, h * 0.86, Math.min(110, w * 0.22))} stroke="rgba(255,255,255,0.45)" strokeWidth={8} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** 7000 U.I.: la cifra se cuenta al aparecer y al tocarla */
function CountTile({ reduce, onTap }: { reduce: boolean; onTap: () => void }) {
  const [v, setV] = useState(reduce ? 7000 : 0);
  const [run, setRun] = useState(0);
  const bar = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return setV(7000);
    let raf = 0;
    const t0 = Date.now();
    bar.setValue(0);
    Animated.timing(bar, { toValue: 1, duration: 1300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / 1300);
      setV(Math.round(7000 * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const start = setTimeout(() => (raf = requestAnimationFrame(tick)), run ? 0 : 450);
    return () => {
      clearTimeout(start);
      cancelAnimationFrame(raf);
    };
  }, [run, reduce, bar]);
  return (
    <Pressable onPress={() => { onTap(); setRun((r) => r + 1); }} accessibilityRole="button" accessibilityLabel="Contar de nuevo: 7000 U.I. de vitamina D3" style={{ gap: 4, flex: 1 }}>
      <Text style={st.overline}>Composición</Text>
      <Text style={{ fontFamily: font.bold, fontSize: 40, lineHeight: 44, color: C.deep, letterSpacing: -1.5 }} adjustsFontSizeToFit numberOfLines={1}>
        {v}
      </Text>
      <Text style={{ fontFamily: font.bold, fontSize: 14, color: C.ink }}>U.I. · Vitamina D3</Text>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.aquaSoft, overflow: 'hidden', marginVertical: 6 }}>
        <Animated.View style={{ height: '100%', backgroundColor: C.aqua, width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
      </View>
      <Text style={st.small}>Cada cápsula blanda contiene: Vitamina D3 7000 U.I.; Excipientes: c.s.</Text>
      <View style={{ flex: 1 }} />
      <Hint icon="refresh" text="Toca para contar" />
    </Pressable>
  );
}

/** cápsula blanda ilustrativa: al tocarla gira y cambia el dato (forma farmacéutica / vía) */
function CapsuleTile({ reduce, onTap, form, route }: { reduce: boolean; onTap: () => void; form: string; route: string }) {
  const [side, setSide] = useState(0);
  const spin = useRef(new Animated.Value(0)).current;
  const floatA = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(floatA, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }), Animated.timing(floatA, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [floatA, reduce]);
  const press = () => {
    onTap();
    const to = side + 1;
    setSide(to);
    if (reduce) return spin.setValue(to);
    Animated.spring(spin, { toValue: to, useNativeDriver: true, speed: 6, bounciness: 9 }).start();
  };
  const data = side % 2 === 0 ? { k: 'FORMA FARMACÉUTICA', v: form } : { k: 'VÍA DE ADMINISTRACIÓN', v: route };
  return (
    <Pressable onPress={press} accessibilityRole="button" accessibilityLabel={`${data.k}: ${data.v} Toca para ver el otro dato`} style={{ flex: 1, gap: space.sm }}>
      <View style={{ height: 96, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ transform: [{ translateY: floatA.interpolate({ inputRange: [0, 1], outputRange: [-4, 4] }) }, { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '162deg'] }) }] }}>
          <SoftGel w={110} />
        </Animated.View>
      </View>
      <Appear key={side} reduce={reduce}>
        <Text style={[st.overline, { color: C.aqua }]}>{data.k}</Text>
        <Text style={{ fontFamily: font.bold, fontSize: 22, lineHeight: 26, color: colors.white }}>{data.v}</Text>
      </Appear>
      <View style={{ flex: 1 }} />
      <Hint icon="sync-outline" text="Toca la cápsula" color={C.aquaSoft} />
      <Text style={{ fontFamily: font.medium, fontSize: 10, color: C.aquaSoft, opacity: 0.8, textAlign: 'center' }}>Cápsula ilustrativa</Text>
    </Pressable>
  );
}

function SoftGel({ w }: { w: number }) {
  const h = w * 0.56;
  return (
    <Svg width={w} height={h}>
      <Defs>
        <SvgGradient id="gel" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE29A" />
          <Stop offset="0.55" stopColor={C.capsule} />
          <Stop offset="1" stopColor="#C9821A" />
        </SvgGradient>
      </Defs>
      <Ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 2} ry={h / 2 - 2} fill="url(#gel)" />
      <Ellipse cx={w * 0.42} cy={h * 0.3} rx={w * 0.26} ry={h * 0.1} fill="#FFFFFF" opacity={0.55} />
      <Rect x={w * 0.12} y={h / 2 - 0.75} width={w * 0.76} height={1.5} fill="#B8761A" opacity={0.35} />
    </Svg>
  );
}

/** semana: 1 cápsula semanal y consumo máximo de 2 (texto de la caja) */
function WeekTile({ reduce, max, dosage, maxText, onTap }: { reduce: boolean; max: number; dosage: string; maxText: string; onTap: (k: string) => void }) {
  const [days, setDays] = useState<number[]>([]);
  const [over, setOver] = useState(0);
  const shake = useRef(new Animated.Value(0)).current;
  const toggle = (i: number) => {
    if (days.includes(i)) {
      setDays(days.filter((d) => d !== i));
      return;
    }
    if (days.length >= max) {
      onTap('maximo');
      setOver((o) => o + 1);
      if (!reduce) {
        shake.setValue(0);
        Animated.sequence([0, 1, -1, 1, -1, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 55, useNativeDriver: true }))).start();
      }
      return;
    }
    onTap(DAYS[i].k);
    setOver(0);
    setDays([...days, i].sort());
  };
  const n = days.length;
  const msg =
    over > 0
      ? { icon: 'alert-circle' as IconName, color: C.coral, text: `${maxText} Toca un día marcado para quitarlo.` }
      : n === 0
        ? { icon: 'finger-print-outline' as IconName, color: C.muted, text: 'Toca un día para ubicar la cápsula de la semana.' }
        : n === 1
          ? { icon: 'checkmark-circle' as IconName, color: C.deep, text: `Dosificación: ${dosage}` }
          : { icon: 'warning' as IconName, color: C.coral, text: `${maxText}` };
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={st.overline}>Dosificación</Text>
          <Text style={st.h2}>{cap(dosage.replace('.', ''))}</Text>
          <Text style={st.small}>Vía oral · {maxText}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: font.bold, fontSize: 30, lineHeight: 32, color: n > max - 1 ? C.coral : C.deep }}>
            {n}
            <Text style={{ fontSize: 15, color: C.muted }}>/{max}</Text>
          </Text>
          <Text style={{ fontFamily: font.bold, fontSize: 9, letterSpacing: 0.5, color: C.muted }}>MÁXIMO</Text>
        </View>
      </View>
      <Animated.View style={{ flexDirection: 'row', justifyContent: 'space-between', transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }) }] }}>
        {DAYS.map((d, i) => (
          <DayButton key={d.k} label={d.k} name={d.name} on={days.includes(i)} reduce={reduce} onPress={() => toggle(i)} />
        ))}
      </Animated.View>
      <Appear key={`${n}-${over}`} reduce={reduce}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: msg.color === C.coral ? C.coralSoft : C.aquaMist, borderRadius: radius.lg, padding: space.md }}>
          <Ionicons name={msg.icon} size={18} color={msg.color} />
          <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13, lineHeight: 18, color: msg.color === C.muted ? C.ink : msg.color }}>{msg.text}</Text>
        </View>
      </Appear>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[st.small, { flex: 1 }]}>Ejemplo visual con el texto impreso en la caja.</Text>
        {n ? (
          <Pressable onPress={() => { setDays([]); setOver(0); }} accessibilityRole="button" hitSlop={8}>
            <Text style={{ fontFamily: font.semibold, fontSize: 12, color: C.deep, textDecorationLine: 'underline' }}>Reiniciar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function DayButton({ label, name, on, reduce, onPress }: { label: string; name: string; on: boolean; reduce: boolean; onPress: () => void }) {
  const k = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return k.setValue(on ? 1 : 0);
    Animated.spring(k, { toValue: on ? 1 : 0, useNativeDriver: true, speed: 16, bounciness: 12 }).start();
  }, [on, k, reduce]);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}${on ? ': cápsula ubicada' : ''}`} accessibilityState={{ selected: on }} style={{ alignItems: 'center', gap: 6 }} hitSlop={4}>
      <View style={{ width: 40, height: 52, borderRadius: 20, borderWidth: 1.5, borderColor: on ? C.deep : C.line, backgroundColor: on ? C.aquaSoft : colors.white, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ opacity: k, transform: [{ scale: k.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }, { rotate: '-30deg' }] }}>
          <SoftGel w={26} />
        </Animated.View>
      </View>
      <Text style={{ fontFamily: font.bold, fontSize: 12, color: on ? C.deep : C.muted }}>{label}</Text>
    </Pressable>
  );
}

/** modo de uso: se elige con o sin comidas; la caja dice que da igual */
function MealsTile({ reduce, usage, onTap }: { reduce: boolean; usage: string; onTap: (k: string) => void }) {
  const [pick, setPick] = useState<'con' | 'sin' | null>(null);
  const opts: { k: 'con' | 'sin'; label: string; icon: IconName }[] = [
    { k: 'con', label: 'Con comidas', icon: 'restaurant-outline' },
    { k: 'sin', label: 'Sin comidas', icon: 'time-outline' },
  ];
  return (
    <View style={{ gap: space.md }}>
      <Text style={st.overline}>Modo de uso</Text>
      <Text style={st.h2}>¿Con o sin comidas?</Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {opts.map((o) => {
          const on = pick === o.k;
          return (
            <Tap key={o.k} onPress={() => { onTap(o.k); setPick(o.k); }} label={o.label} selected={on} style={{ flex: 1 }}>
              <View style={{ borderRadius: 20, padding: space.md, gap: 8, alignItems: 'center', backgroundColor: on ? C.deep : colors.white, borderWidth: 1.5, borderColor: on ? C.deep : C.line }}>
                <Ionicons name={o.icon} size={26} color={on ? colors.white : C.deep} />
                <Text style={{ fontFamily: font.bold, fontSize: 13, color: on ? colors.white : C.ink }}>{o.label}</Text>
                {on ? <Ionicons name="checkmark-circle" size={20} color={C.aqua} /> : <View style={{ height: 20 }} />}
              </View>
            </Tap>
          );
        })}
      </View>
      {pick ? (
        <Appear key={pick} reduce={reduce}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Ionicons name="checkmark-done" size={20} color={C.deep} />
            <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 14, lineHeight: 20, color: C.ink }}>
              Las dos sirven: «{usage}»
            </Text>
          </View>
        </Appear>
      ) : (
        <Hint icon="finger-print-outline" text="Elige una opción" />
      )}
    </View>
  );
}

/** indicaciones: tres tarjetas que se pasan con las flechas o tocándolas */
function IndicationsTile({ items, reduce, onTap }: { items: string[]; reduce: boolean; onTap: (k: number) => void }) {
  const [i, setI] = useState(0);
  const dir = useRef(1);
  const a = useRef(new Animated.Value(1)).current;
  const go = (k: number) => {
    const to = (k + items.length) % items.length;
    dir.current = k >= i ? 1 : -1;
    onTap(to);
    setI(to);
    if (reduce) return;
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };
  const text = items[i];
  const lab = text.match(/\(suero.*?L\)/)?.[0];
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={st.overline}>Indicaciones</Text>
          <Text style={st.h2}>Tres usos impresos</Text>
        </View>
        <NavDot icon="chevron-back" label="Indicación anterior" onPress={() => go(i - 1)} />
        <NavDot icon="chevron-forward" label="Indicación siguiente" onPress={() => go(i + 1)} solid />
      </View>
      <Pressable onPress={() => go(i + 1)} accessibilityRole="button" accessibilityLabel={`Indicación ${i + 1} de ${items.length}: ${text}`}>
        <Animated.View style={{ opacity: a, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [28 * dir.current, 0] }) }] }}>
          <LinearGradient colors={[C.aquaSoft, '#F6FDFC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: space.lg, gap: space.sm, minHeight: 168 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 44, lineHeight: 46, color: C.deep, opacity: 0.25, letterSpacing: -2 }}>{String(i + 1).padStart(2, '0')}</Text>
            <Text style={{ fontFamily: font.semibold, fontSize: 16, lineHeight: 23, color: C.ink }}>{lab ? text.replace(` ${lab}`, '') : text}</Text>
            {lab ? (
              <View style={{ alignSelf: 'flex-start', backgroundColor: C.deep, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.white }}>{lab.slice(1, -1)}</Text>
              </View>
            ) : null}
          </LinearGradient>
        </Animated.View>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
        {items.map((_, k) => (
          <Pressable key={k} onPress={() => go(k)} accessibilityRole="button" accessibilityLabel={`Indicación ${k + 1}`} hitSlop={8}>
            <View style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? C.deep : C.line }} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function NavDot({ icon, label, onPress, solid }: { icon: IconName; label: string; onPress: () => void; solid?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, marginLeft: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.deep, backgroundColor: solid ? C.deep : colors.white, opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={18} color={solid ? colors.white : C.deep} />
    </Pressable>
  );
}

/** contraindicaciones: tarjeta que se voltea (giro en 3D) */
function FlipCard({ reduce, text, onFlip }: { reduce: boolean; text: string; onFlip: () => void }) {
  const [back, setBack] = useState(false);
  const a = useRef(new Animated.Value(0)).current;
  const flip = () => {
    if (!back) onFlip();
    const to = back ? 0 : 1;
    setBack(!back);
    if (reduce) return a.setValue(to);
    Animated.spring(a, { toValue: to, useNativeDriver: true, speed: 9, bounciness: 4 }).start();
  };
  const frontRot = a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRot = a.interpolate({ inputRange: [0, 1], outputRange: ['-180deg', '0deg'] });
  return (
    <Pressable onPress={flip} accessibilityRole="button" accessibilityLabel={back ? 'Contraindicaciones (toca para voltear)' : 'Ver contraindicaciones'} accessibilityHint="Voltea la tarjeta">
      {/* reverso: define el alto */}
      <Animated.View style={[st.flipFace, { backgroundColor: C.coral, transform: [{ perspective: 900 }, { rotateY: backRot }], opacity: a.interpolate({ inputRange: [0, 0.5, 0.51, 1], outputRange: [0, 0, 1, 1] }) }]}>
        <Text style={[st.overline, { color: colors.white, opacity: 0.85 }]}>Contraindicaciones</Text>
        <Text style={{ fontFamily: font.semibold, fontSize: 15, lineHeight: 22, color: colors.white }}>{text}</Text>
        <Hint icon="sync-outline" text="Toca para voltear" color={colors.white} />
      </Animated.View>
      {/* frente */}
      <Animated.View style={[StyleSheet.absoluteFill, st.flipFace, { backgroundColor: colors.white, borderWidth: 1, borderColor: C.line, justifyContent: 'center', transform: [{ perspective: 900 }, { rotateY: frontRot }], opacity: a.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] }) }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: C.coralSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close-circle-outline" size={30} color={C.coral} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.overline, { color: C.coral }]}>Antes de usar</Text>
            <Text style={st.h2}>Contraindicaciones</Text>
            <Text style={st.small}>Hipercalcemia, hipersensibilidad y toxicidad a la Vitamina D3: toca para leer el texto completo de la caja.</Text>
          </View>
        </View>
        <Hint icon="sync-outline" text="Toca para voltear" color={C.coral} />
      </Animated.View>
    </Pressable>
  );
}

/** conservación: el termómetro sube hasta 30 °C */
function ThermoTile({ reduce, max, onTap }: { reduce: boolean; max: number; onTap: () => void }) {
  const lvl = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const [shown, setShown] = useState(reduce);
  const run = () => {
    onTap();
    setShown(true);
    if (reduce) return lvl.setValue(1);
    lvl.setValue(0);
    Animated.timing(lvl, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  };
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => {
      setShown(true);
      Animated.timing(lvl, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    }, 900);
    return () => clearTimeout(t);
  }, [lvl, reduce]);
  const TUBE = 112;
  return (
    <Pressable onPress={run} accessibilityRole="button" accessibilityLabel={`Consérvese a temperatura no mayor a ${max} °C`} style={{ flex: 1, gap: space.sm }}>
      <Text style={st.overline}>Conservación</Text>
      <View style={{ flexDirection: 'row', gap: space.xl, alignItems: 'flex-end' }}>
        <View style={{ width: 30, alignItems: 'center' }}>
          <View style={{ width: 14, height: TUBE, borderRadius: 7, backgroundColor: C.aquaSoft, overflow: 'hidden', justifyContent: 'flex-end', borderWidth: 1, borderColor: C.line }}>
            <Animated.View style={{ width: '100%', backgroundColor: C.coral, height: lvl.interpolate({ inputRange: [0, 1], outputRange: [8, TUBE * 0.78] }) }} />
          </View>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.coral, marginTop: -6 }} />
          {/* marca de 30 °C */}
          <View style={{ position: 'absolute', top: TUBE * 0.22 - 1, left: 22, width: 8, height: 2, backgroundColor: C.ink }} />
          <Text style={{ position: 'absolute', top: TUBE * 0.22 - 8, left: 32, fontFamily: font.bold, fontSize: 10, color: C.ink }}>30°</Text>
        </View>
        <View style={{ flex: 1, paddingBottom: 4 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 13, color: C.muted }}>No mayor a</Text>
          <Text style={{ fontFamily: font.bold, fontSize: 36, lineHeight: 40, color: shown ? C.coral : C.line, letterSpacing: -1 }}>{max} °C</Text>
        </View>
      </View>
      <Text style={[st.small, { fontSize: 12 }]}>Consérvese a temperatura no mayor a 30 °C, en su envase y empaque original.</Text>
      <View style={{ flex: 1 }} />
      <Hint icon="thermometer-outline" text="Toca para medir" color={C.coral} />
    </Pressable>
  );
}

/** vista 3D a pantalla completa: girar, elegir una cara, desplegar y abrir la AR */
function FullBox({ textures, faces, dims, title, reduce, onClose, onAR }: { textures: BoxTextures; faces: DefFace[]; dims: { w: number; h: number; d: number }; title: string; reduce: boolean; onClose: () => void; onAR: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [fold, setFold] = useState(1);
  const [face, setFace] = useState<BoxFace | null>(null);
  return (
    <View style={{ flex: 1, backgroundColor: C.aquaMist }}>
      <LinearGradient colors={[C.aquaSoft, C.aquaMist]} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <TearBox textures={textures} dims={dims} width={width} height={height * 0.64} fold={fold} face={face} capsules edge={C.aqua} reduce={reduce} zoom={1.2} />
      </View>
      <View style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <RoundButton icon="close" label="Cerrar la vista 3D" onPress={onClose} color={C.deep} />
        <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 18, color: C.ink }}>{title}</Text>
      </View>
      <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: insets.bottom + space.lg, gap: space.sm, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
          {faces.map((f) => (
            <Tap key={f.face} onPress={() => { setFold(1); setFace(face === f.face ? null : f.face); }} label={f.label} selected={face === f.face}>
              <View style={[st.facePill, face === f.face && { backgroundColor: C.deep, borderColor: C.deep }]}>
                <Text style={[st.facePillText, face === f.face && { color: colors.white }]}>{f.label}</Text>
              </View>
            </Tap>
          ))}
        </View>
        <Text style={{ fontFamily: font.medium, fontSize: 12, color: C.ink, opacity: 0.8, textAlign: 'center' }}>Arrastra para girarla o elige una cara.</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, width: '100%', maxWidth: 460 }}>
          <Pill icon={fold > 0.5 ? 'expand-outline' : 'cube-outline'} label={fold > 0.5 ? 'Desplegar' : 'Armar'} onPress={() => { setFace(null); setFold(fold > 0.5 ? 0 : 1); }} variant="solid" color={C.deep} wide small />
          <Pill icon="scan-outline" label="Ver en AR" onPress={onAR} variant="outlineColor" color={C.deep} wide small />
        </View>
      </View>
    </View>
  );
}
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const st = StyleSheet.create({
  h2: { fontFamily: font.bold, fontSize: 21, lineHeight: 26, color: C.ink, letterSpacing: -0.3 },
  body: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: C.ink },
  small: { fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: C.muted },
  overline: { fontFamily: font.bold, fontSize: 11, letterSpacing: 0.9, color: C.deep, textTransform: 'uppercase' },
  onDark: { fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: colors.white },
  onDarkSmall: { fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: C.aquaSoft },
  sample: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginTop: space.xs },
  facePill: { borderRadius: radius.pill, borderWidth: 1.5, borderColor: C.deep, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 11, paddingVertical: 6 },
  facePillText: { fontFamily: font.bold, fontSize: 11.5, color: C.deep },
  faceCard: { flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 20, padding: space.md },
  flipFace: { borderRadius: 28, padding: space.lg, gap: space.md, backfaceVisibility: 'hidden' },
});
