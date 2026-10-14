import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Product3D } from '@/components/Product3D';
import { ShareSheet } from '@/components/ShareSheet';
import { Button, goBack } from '@/components/ui';
import { personById, productById, type IconName } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, font, radius, space } from '@/theme';

// Modo presentación como revista editorial con scroll:
// portada con el envase 3D y titular animado, y secciones que se arman con capas en movimiento
// (parallax y apariciones) a medida que el visitador desliza frente al profesional de salud.

const ScrollCtx = createContext<{ y: Animated.Value; h: number }>({ y: new Animated.Value(0), h: 800 });
const SectionCtx = createContext(0);

/** Sección de la revista: mide su posición para que sus elementos aparezcan al llegar a ella */
function Section({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [top, setTop] = useState(0);
  return (
    <SectionCtx.Provider value={top}>
      <View onLayout={(e) => setTop(e.nativeEvent.layout.y)} style={style}>
        {children}
      </View>
    </SectionCtx.Provider>
  );
}

/** Elemento que aparece al hacer scroll. `at` = píxeles dentro de la sección donde se ubica */
function Reveal({
  children,
  at = 0,
  from = 'up',
  style,
}: {
  children: ReactNode;
  at?: number;
  from?: 'up' | 'left' | 'right' | 'scale';
  style?: StyleProp<ViewStyle>;
}) {
  const { y, h } = useContext(ScrollCtx);
  const top = useContext(SectionCtx);
  const start = top + at - h * 0.92;
  const end = top + at - h * 0.62;
  const p = y.interpolate({ inputRange: [start, end], outputRange: [0, 1], extrapolate: 'clamp' });
  const transform =
    from === 'left'
      ? [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [-48, 0] }) }]
      : from === 'right'
        ? [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [48, 0] }) }]
        : from === 'scale'
          ? [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }]
          : [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [44, 0] }) }];
  return <Animated.View style={[style, { opacity: p, transform }]}>{children}</Animated.View>;
}

/** Capa con desplazamiento más lento o más rápido que el scroll (parallax) */
function Parallax({ children, speed, at = 0, style }: { children: ReactNode; speed: number; at?: number; style?: StyleProp<ViewStyle> }) {
  const { y, h } = useContext(ScrollCtx);
  const top = useContext(SectionCtx);
  const base = top + at;
  const translateY = y.interpolate({ inputRange: [base - h, base + h], outputRange: [h * speed, -h * speed] });
  return <Animated.View style={[style, { transform: [{ translateY }] }]}>{children}</Animated.View>;
}

export default function Presentacion() {
  const { id, visita } = useLocalSearchParams<{ id: string; visita?: string }>();
  const { visits, logEvent, setVisitStatus } = useMine();
  const visit = visits.find((v) => v.id === visita);
  const [productId, setProductId] = useState(id);
  const p = productById(productId);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [share, setShare] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [contentH, setContentH] = useState(height * 6);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<{ scrollTo: (o: { y: number; animated: boolean }) => void } | null>(null);
  const intro = useRef(new Animated.Value(0)).current;
  const started = useRef(Date.now());

  useEffect(() => {
    logEvent('presentacion_iniciada', productId);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [logEvent, productId]);

  // animación de la portada al abrir o cambiar de producto
  useEffect(() => {
    intro.setValue(0);
    Animated.timing(intro, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [productId, intro]);

  if (!p) return null;

  const close = () => {
    logEvent('presentacion_cerrada', `${p.id} · ${elapsed}s`);
    goBack('/visitador');
  };
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const H = height;
  const maxScroll = Math.max(1, contentH - H);
  const progress = scrollY.interpolate({ inputRange: [0, maxScroll], outputRange: [0, 1], extrapolate: 'clamp' });
  const hue = p.hue === colors.turquesa ? colors.primary : p.hue;
  const words = p.name.split(' ');
  const pad = space.xl;
  const wide = Math.min(width, 720);

  // portada: el envase 3D se aleja y se desvanece al empezar a bajar
  const heroStyle = {
    opacity: scrollY.interpolate({ inputRange: [0, H * 0.6], outputRange: [1, 0], extrapolate: 'clamp' }),
    transform: [
      { translateY: scrollY.interpolate({ inputRange: [0, H], outputRange: [0, H * 0.45], extrapolate: 'clamp' }) },
      { scale: scrollY.interpolate({ inputRange: [-200, 0, H], outputRange: [1.15, 1, 0.75], extrapolate: 'clamp' }) },
    ],
  };
  const introUp = (delay: number) => ({
    opacity: intro.interpolate({ inputRange: [delay, Math.min(1, delay + 0.35)], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [
      {
        translateY: intro.interpolate({ inputRange: [delay, Math.min(1, delay + 0.35)], outputRange: [36, 0], extrapolate: 'clamp' }),
      },
    ],
  });

  const switchProduct = (pid: string) => {
    setProductId(pid);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <ScrollCtx.Provider value={{ y: scrollY, h: H }}>
      <View style={{ flex: 1, backgroundColor: colors.petroleo }}>
        <Animated.ScrollView
          ref={(r: unknown) => {
            scrollRef.current = r as { scrollTo: (o: { y: number; animated: boolean }) => void } | null;
          }}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          onContentSizeChange={(_, h) => setContentH(h)}
          showsVerticalScrollIndicator={false}
        >
          {/* ---------- PORTADA ---------- */}
          <Section style={{ height: H, overflow: 'hidden' }}>
            <LinearGradient colors={[hue, colors.petroleo]} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={StyleSheet.absoluteFill} />
            {/* cápsulas decorativas en parallax */}
            <Parallax speed={0.25} style={{ position: 'absolute', top: H * 0.12, left: -60 }}>
              <View style={{ width: 220, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.08)' }} />
            </Parallax>
            <Parallax speed={-0.2} style={{ position: 'absolute', top: H * 0.5, right: -40 }}>
              <View style={{ width: 70, height: 240, borderRadius: 35, backgroundColor: 'rgba(99,201,214,0.14)' }} />
            </Parallax>

            <View style={{ flex: 1, paddingHorizontal: pad, paddingTop: insets.top + 92, paddingBottom: insets.bottom + space.xl, justifyContent: 'space-between' }}>
              <Animated.View style={introUp(0)}>
                <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 3, color: colors.turquesa }}>
                  MULTI LAB · EDICIÓN {p.category.toUpperCase()}
                </Text>
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: space.sm }} />
              </Animated.View>

              <Animated.View style={[{ alignItems: 'center' }, heroStyle]}>
                <Product3D product={p} size={Math.min(width * 0.9, H * 0.42, 380)} zoom={1.45} interactive={false} />
              </Animated.View>

              <View style={{ gap: space.sm }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 }}>
                  {words.map((w, i) => (
                    <Animated.Text
                      key={`${w}${i}`}
                      style={[
                        { fontFamily: font.bold, fontSize: Math.min(54, width * 0.12), lineHeight: Math.min(58, width * 0.13), color: colors.white, letterSpacing: -1 },
                        introUp(0.15 + i * 0.12),
                      ]}
                    >
                      {w}
                    </Animated.Text>
                  ))}
                </View>
                <Animated.Text style={[{ fontFamily: font.regular, fontSize: 18, lineHeight: 26, color: '#D5E2E5' }, introUp(0.45)]}>
                  {p.tagline}
                </Animated.Text>
                <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space.md }, introUp(0.7)]}>
                  <BounceArrow />
                  <Text style={{ fontFamily: font.medium, fontSize: 12, color: '#B9CCD0' }}>Desliza para leer</Text>
                </Animated.View>
              </View>
            </View>
          </Section>

          {/* ---------- CITA ---------- */}
          <Section style={{ backgroundColor: colors.turquesa, paddingHorizontal: pad, paddingVertical: H * 0.14, overflow: 'hidden' }}>
            <Parallax speed={0.3} style={{ position: 'absolute', right: -10, top: 0 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 260, lineHeight: 260, color: 'rgba(32,52,58,0.08)' }}>“</Text>
            </Parallax>
            <Reveal>
              <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 3, color: colors.petroleo }}>LA IDEA</Text>
            </Reveal>
            <Reveal at={40} style={{ marginTop: space.lg, maxWidth: wide }}>
              <Text style={{ fontFamily: font.bold, fontSize: Math.min(34, width * 0.08), lineHeight: Math.min(42, width * 0.1), color: colors.petroleo }}>
                {p.slides[0]?.body ?? p.tagline}
              </Text>
            </Reveal>
            <Reveal at={140} style={{ marginTop: space.xl, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ width: 32, height: 2, backgroundColor: colors.petroleo }} />
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.petroleo }}>
                {p.lab} · {p.form}
              </Text>
            </Reveal>
          </Section>

          {/* ---------- CAPÍTULOS (una sección por mensaje clave) ---------- */}
          {p.slides.map((s, i) => {
            const right = i % 2 === 1;
            return (
              <Section key={s.title} style={{ backgroundColor: colors.white, paddingHorizontal: pad, paddingVertical: H * 0.1, overflow: 'hidden' }}>
                <Parallax speed={0.35} style={{ position: 'absolute', top: H * 0.02, [right ? 'left' : 'right']: -6 } as ViewStyle}>
                  <Text style={{ fontFamily: font.bold, fontSize: 180, lineHeight: 190, color: colors.primarySoft }}>{String(i + 1).padStart(2, '0')}</Text>
                </Parallax>
                <View style={{ alignItems: right ? 'flex-end' : 'flex-start', gap: space.lg, maxWidth: wide, alignSelf: 'center', width: '100%' }}>
                  <Reveal from="scale">
                    <View style={{ width: 84, height: 84, borderRadius: 26, backgroundColor: hue, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={s.icon as IconName} size={40} color={colors.white} />
                    </View>
                  </Reveal>
                  <Reveal at={30} from={right ? 'right' : 'left'}>
                    <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 3, color: colors.primary, textAlign: right ? 'right' : 'left' }}>
                      CAPÍTULO {i + 1}
                    </Text>
                    <Text
                      style={{
                        fontFamily: font.bold,
                        fontSize: Math.min(36, width * 0.085),
                        lineHeight: Math.min(42, width * 0.1),
                        color: colors.petroleo,
                        marginTop: 6,
                        textAlign: right ? 'right' : 'left',
                      }}
                    >
                      {s.title}
                    </Text>
                  </Reveal>
                  <Reveal at={90}>
                    <Text style={{ fontFamily: font.regular, fontSize: 18, lineHeight: 28, color: colors.inkMuted, textAlign: right ? 'right' : 'left', maxWidth: 480 }}>
                      {s.body}
                    </Text>
                  </Reveal>
                </View>
              </Section>
            );
          })}

          {/* ---------- DATOS EN CIFRAS / FICHA ---------- */}
          <Section style={{ backgroundColor: colors.bg, paddingHorizontal: pad, paddingVertical: H * 0.1 }}>
            <Reveal>
              <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 3, color: colors.primary }}>FICHA RÁPIDA</Text>
            </Reveal>
            <View style={{ marginTop: space.lg, gap: space.md, maxWidth: wide, width: '100%', alignSelf: 'center' }}>
              {[
                { k: 'Presentación', v: p.form, icon: 'cube-outline' as IconName },
                { k: 'Componente principal', v: p.component, icon: 'flask-outline' as IconName },
                { k: 'Categoría', v: p.category, icon: 'pricetag-outline' as IconName },
                { k: 'Laboratorio', v: `${p.lab} (ficticio)`, icon: 'business-outline' as IconName },
              ].map((d, i) => (
                <Reveal key={d.k} at={40 + i * 60} from={i % 2 ? 'right' : 'left'}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.white, borderRadius: radius.lg, padding: space.lg }}>
                    <Ionicons name={d.icon} size={22} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.inkMuted }}>{d.k}</Text>
                      <Text style={{ fontFamily: font.semibold, fontSize: 16, color: colors.petroleo }}>{d.v}</Text>
                    </View>
                  </View>
                </Reveal>
              ))}
            </View>
          </Section>

          {/* ---------- MODO DE USO (línea de tiempo) ---------- */}
          <Section style={{ backgroundColor: colors.white, paddingHorizontal: pad, paddingVertical: H * 0.1 }}>
            <Reveal>
              <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 3, color: colors.primary }}>MODO DE USO</Text>
              <Text style={{ fontFamily: font.bold, fontSize: Math.min(32, width * 0.08), color: colors.petroleo, marginTop: 6 }}>Paso a paso</Text>
            </Reveal>
            <View style={{ marginTop: space.xl, gap: space.xl, maxWidth: wide, width: '100%', alignSelf: 'center' }}>
              {p.howTo.map((step, i) => (
                <Reveal key={step} at={80 + i * 90} from="left">
                  <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' }}>
                    <View style={{ alignItems: 'center' }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.petroleo, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: font.bold, fontSize: 16, color: colors.turquesa }}>{i + 1}</Text>
                      </View>
                    </View>
                    <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 18, lineHeight: 26, color: colors.petroleo, paddingTop: 8 }}>{step}</Text>
                  </View>
                </Reveal>
              ))}
            </View>
          </Section>

          {/* ---------- AVISOS ---------- */}
          <Section style={{ backgroundColor: colors.white, paddingHorizontal: pad, paddingBottom: H * 0.1 }}>
            <Reveal from="scale">
              <View style={{ backgroundColor: colors.warningSoft, borderRadius: radius.xl, padding: space.xl, gap: space.md, maxWidth: wide, width: '100%', alignSelf: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Ionicons name="warning-outline" size={22} color={colors.warning} />
                  <Text style={{ fontFamily: font.bold, fontSize: 16, color: colors.warning }}>Advertencias y precauciones</Text>
                </View>
                {p.precautions.map((t) => (
                  <Text key={t} style={{ fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: colors.petroleo }}>
                    • {t}
                  </Text>
                ))}
              </View>
            </Reveal>
          </Section>

          {/* ---------- 3D ---------- */}
          <Section style={{ backgroundColor: colors.petroleo, paddingHorizontal: pad, paddingVertical: H * 0.1, alignItems: 'center', overflow: 'hidden' }}>
            <Reveal>
              <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 3, color: colors.turquesa, textAlign: 'center' }}>EXPLÓRALO</Text>
              <Text style={{ fontFamily: font.bold, fontSize: Math.min(30, width * 0.075), color: colors.white, textAlign: 'center', marginTop: 6 }}>
                Míralo por todos sus lados
              </Text>
            </Reveal>
            <Reveal at={60} from="scale">
              <Product3D product={p} size={Math.min(width * 0.8, 320)} zoom={1.3} interactive={false} />
            </Reveal>
            <Reveal at={200}>
              <Button label="Abrir visor 3D · 360°" icon="cube-outline" variant="secondary" onPress={() => router.push(`/visor/${p.id}`)} />
            </Reveal>
          </Section>

          {/* ---------- CIERRE ---------- */}
          <Section style={{ backgroundColor: colors.petroleo, paddingHorizontal: pad, paddingTop: space.xl, paddingBottom: insets.bottom + H * 0.12 }}>
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: space.xl }} />
            <Reveal>
              <Text style={{ fontFamily: font.bold, fontSize: Math.min(36, width * 0.09), color: colors.white }}>¿Qué sigue?</Text>
              <Text style={{ fontFamily: font.regular, fontSize: 16, lineHeight: 24, color: '#D5E2E5', marginTop: 6 }}>
                Continúa la visita sin salir de la app.
              </Text>
            </Reveal>
            <Reveal at={80} style={{ gap: space.sm, marginTop: space.xl, maxWidth: wide, width: '100%', alignSelf: 'center' }}>
              <Button label="Compartir ficha por chat" icon="send-outline" onPress={() => setShare(true)} />
              <Button label="Ver ficha completa" variant="secondary" icon="document-text-outline" onPress={() => router.push(`/producto/${p.id}`)} />
              {visit && visit.status !== 'Realizada' ? (
                <Button
                  label={`Marcar visita con ${personById(visit.doctorId).name} como realizada`}
                  variant="secondary"
                  icon="checkmark-done-outline"
                  onPress={() => {
                    setVisitStatus(visit.id, 'Realizada');
                    router.replace(`/visita/${visit.id}`);
                  }}
                />
              ) : null}
            </Reveal>
            <Text style={{ fontFamily: font.medium, fontSize: 12, color: '#8FA7AD', marginTop: space.xl }}>
              Contenido de demostración. No corresponde a material promocional real.
            </Text>
          </Section>
        </Animated.ScrollView>

        {/* ---------- barra superior flotante ---------- */}
        <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, gap: space.sm }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              backgroundColor: 'rgba(32,52,58,0.86)',
              borderRadius: radius.pill,
              paddingHorizontal: space.md,
              paddingVertical: 8,
            }}
          >
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Cerrar presentación" hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.white} />
            </Pressable>
            <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
              <Animated.View
                style={{
                  height: 3,
                  width: '100%',
                  backgroundColor: colors.turquesa,
                  transformOrigin: 'left',
                  transform: [{ scaleX: progress }],
                }}
              />
            </View>
            <Text style={{ fontFamily: font.semibold, color: '#B9CCD0', fontSize: 12 }}>{mm}</Text>
            <Pressable onPress={() => setShare(true)} accessibilityRole="button" accessibilityLabel="Compartir ficha" hitSlop={10}>
              <Ionicons name="share-social-outline" size={20} color={colors.white} />
            </Pressable>
          </View>
          {visit && visit.productIds.length > 1 ? (
            <View style={{ flexDirection: 'row', gap: 6, alignSelf: 'flex-start' }}>
              {visit.productIds.map((pid) => (
                <Pressable
                  key={pid}
                  onPress={() => switchProduct(pid)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: radius.pill,
                    backgroundColor: pid === productId ? colors.turquesa : 'rgba(32,52,58,0.8)',
                  }}
                >
                  <Text style={{ fontFamily: font.semibold, fontSize: 12, color: pid === productId ? colors.ink : colors.white }}>
                    {productById(pid)?.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <ShareSheet product={p} visible={share} onClose={() => setShare(false)} />
      </View>
    </ScrollCtx.Provider>
  );
}

function BounceArrow() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) }] }}>
      <Ionicons name="chevron-down" size={18} color={colors.turquesa} />
    </Animated.View>
  );
}
