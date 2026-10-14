import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { VectorLogo } from '@/components/AnimatedLogo';
import { colors, font, type } from '@/theme';

// Transición de bienvenida al iniciar sesión (se dibuja encima de toda la app):
// 1. Un triángulo de play entra por la izquierda y crece hasta cubrir la pantalla con el teal de marca.
// 2. Con la pantalla cubierta se entra a la cuenta (el inicio se monta debajo, sin que se note la carga).
// 3. El teal se abre en tres piezas: arriba sube, abajo baja y el play del centro se retira a la izquierda.
// 4. El símbolo de Multi LAB aparece dentro de una burbuja de vidrio con el saludo.
// 5. La burbuja se encoge, suelta burbujas pequeñas en los colores de marca y la capa se desvanece.
// El logotipo no se rota, deforma ni recolorea: solo aparece y escala de forma uniforme.

type Req = { title: string; subtitle: string; greeting?: string; onCovered: () => void };

let show: ((r: Req) => void) | null = null;

/** Reproduce la transición; `onCovered` se llama cuando la pantalla está cubierta (ahí se navega). */
export function playWelcome(r: Req) {
  if (show) show(r);
  else r.onCovered();
}

const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const glide = Easing.bezier(0.16, 1, 0.3, 1);
const BUBBLES = [
  { a: -100, d: 1.25, s: 16, c: colors.turquesa },
  { a: -70, d: 1.05, s: 10, c: colors.primary },
  { a: -130, d: 1.0, s: 12, c: colors.petroleo },
  { a: -85, d: 1.6, s: 8, c: colors.primary },
  { a: -115, d: 1.55, s: 11, c: colors.turquesa },
  { a: -50, d: 1.3, s: 7, c: colors.turquesa },
  { a: -150, d: 1.35, s: 7, c: colors.primary },
  { a: -95, d: 1.95, s: 6, c: colors.petroleo },
  { a: -30, d: 0.95, s: 6, c: colors.primary },
  { a: -165, d: 0.95, s: 9, c: colors.turquesa },
  { a: -60, d: 1.85, s: 9, c: colors.turquesa },
  { a: -125, d: 2.0, s: 5, c: colors.primary },
];

export function WelcomeHost() {
  const [req, setReq] = useState<Req | null>(null);
  useEffect(() => {
    show = (r) => setReq(r);
    return () => {
      show = null;
    };
  }, []);
  if (!req) return null;
  return <Welcome key={req.title + Date.now()} req={req} onDone={() => setReq(null)} />;
}

function Welcome({ req, onDone }: { req: Req; onDone: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const cy = H / 2;
  const T = (W + H) * 1.12; // triángulo que cubre toda la pantalla desde el borde izquierdo
  const m = W * 0.62; // punta del play central
  const h = W * 0.36; // media altura del play central
  const BUB = Math.min(W * 0.36, 150);

  const v = useRef({
    cover: new Animated.Value(0),
    split: new Animated.Value(0),
    bubble: new Animated.Value(0),
    text: new Animated.Value(0),
    shrink: new Animated.Value(0),
    burst: new Animated.Value(0),
    out: new Animated.Value(0),
  }).current;
  const covered = useRef(false);
  const finished = useRef(false);
  const running = useRef<Animated.CompositeAnimation | null>(null);

  const cover = () => {
    if (covered.current) return;
    covered.current = true;
    req.onCovered();
  };
  const fadeOut = (duration: number) => {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(v.out, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(onDone);
  };
  const skip = () => {
    running.current?.stop();
    cover();
    fadeOut(220);
  };

  useEffect(() => {
    let cancelled = false;
    const t = (val: Animated.Value, duration: number, delay = 0, easing = glide) =>
      Animated.timing(val, { toValue: 1, duration, delay, easing, useNativeDriver: true });
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          v.cover.setValue(1);
          v.split.setValue(1);
          v.bubble.setValue(1);
          v.text.setValue(1);
          cover();
          setTimeout(() => !cancelled && fadeOut(300), 900);
          return;
        }
        running.current = Animated.sequence([
          // 1. el play entra y cubre la pantalla
          t(v.cover, 620, 0, inOut),
          Animated.delay(90),
          // 3 + 4. se abre en tres piezas y aparece la burbuja con el saludo
          Animated.parallel([
            t(v.split, 620),
            Animated.spring(v.bubble, { toValue: 1, delay: 120, stiffness: 300, damping: 16, mass: 0.9, useNativeDriver: true }),
            t(v.text, 480, 260, Easing.out(Easing.cubic)),
          ]),
          Animated.delay(380),
          // 5. la burbuja se encoge y suelta burbujas
          Animated.parallel([
            t(v.shrink, 380, 0, Easing.in(Easing.back(1.6))),
            t(v.burst, 760, 260, Easing.out(Easing.cubic)),
          ]),
        ]);
        // 2. a mitad del recorrido la pantalla ya está cubierta: se entra a la cuenta
        const cov = setTimeout(() => !cancelled && cover(), 660);
        running.current.start(({ finished: ok }) => {
          clearTimeout(cov);
          if (ok && !cancelled) {
            cover();
            fadeOut(320);
          }
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // triángulo de play (viewBox 100×100, punta a la derecha) con esquinas suaves
  const tri = 'M4 4 L96 50 L4 96 Z';
  const coverScale = v.cover.interpolate({ inputRange: [0, 1], outputRange: [0.07, 1] });
  const pieceFill = { fill: colors.primary, stroke: colors.primary, strokeWidth: 1.5, strokeLinejoin: 'round' as const };

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000, opacity: v.out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
    >
      <Pressable
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel={`${req.title}. Toca para continuar`}
        style={{ flex: 1, overflow: 'hidden' }}
      >
        {/* fondo blanco que aparece al abrirse el teal (oculta el inicio de sesión mientras tanto) */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface, opacity: v.split.interpolate({ inputRange: [0, 0.01], outputRange: [0, 1], extrapolate: 'clamp' }) }]} />

        {/* 1. play que crece desde el borde izquierdo */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: cy - T / 2,
            width: T,
            height: T,
            transformOrigin: `0px ${T / 2}px`,
            opacity: v.split.interpolate({ inputRange: [0, 0.01], outputRange: [1, 0], extrapolate: 'clamp' }),
            transform: [
              { translateX: v.cover.interpolate({ inputRange: [0, 1], outputRange: [-T * 0.03, -T * 0.02] }) },
              { scale: coverScale },
            ],
          }}
        >
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Path d={tri} fill={colors.primary} stroke={colors.primary} strokeWidth={8} strokeLinejoin="round" />
          </Svg>
        </Animated.View>

        {/* 3. tres piezas que se separan */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: v.split.interpolate({ inputRange: [0, 0.01], outputRange: [0, 1], extrapolate: 'clamp' }),
              transform: [{ translateY: v.split.interpolate({ inputRange: [0, 1], outputRange: [0, -(cy + h + 20)] }) }],
            },
          ]}
        >
          <Svg width={W} height={H}>
            <Path d={`M-2 -2 L${W + 2} -2 L${W + 2} ${cy} L${m} ${cy} L-2 ${cy - h} Z`} {...pieceFill} />
          </Svg>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: v.split.interpolate({ inputRange: [0, 0.01], outputRange: [0, 1], extrapolate: 'clamp' }),
              transform: [{ translateY: v.split.interpolate({ inputRange: [0, 1], outputRange: [0, cy + h + 20] }) }],
            },
          ]}
        >
          <Svg width={W} height={H}>
            <Path d={`M-2 ${H + 2} L${W + 2} ${H + 2} L${W + 2} ${cy} L${m} ${cy} L-2 ${cy + h} Z`} {...pieceFill} />
          </Svg>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: v.split.interpolate({ inputRange: [0, 0.01], outputRange: [0, 1], extrapolate: 'clamp' }),
              transform: [{ translateX: v.split.interpolate({ inputRange: [0, 1], outputRange: [0, -m - 20] }) }],
            },
          ]}
        >
          <Svg width={W} height={H}>
            <Path d={`M-2 ${cy - h} L${m} ${cy} L-2 ${cy + h} Z`} {...pieceFill} />
          </Svg>
        </Animated.View>

        {/* 4. burbuja con el símbolo y saludo */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }]}>
          <View style={{ width: BUB, height: BUB, alignItems: 'center', justifyContent: 'center' }}>
            {BUBBLES.map((b, i) => {
              const r = (b.a * Math.PI) / 180;
              const dist = v.burst.interpolate({ inputRange: [0, 1], outputRange: [BUB * 0.15, BUB * b.d] });
              return (
                <Animated.View
                  key={i}
                  style={{
                    position: 'absolute',
                    width: b.s,
                    height: b.s,
                    borderRadius: b.s / 2,
                    backgroundColor: b.c,
                    opacity: v.burst.interpolate({ inputRange: [0, 0.1, 0.65, 1], outputRange: [0, 1, 0.9, 0] }),
                    transform: [
                      { translateX: Animated.multiply(dist, Math.cos(r)) },
                      { translateY: Animated.multiply(dist, Math.sin(r)) },
                      { scale: v.burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 1, 0.7] }) },
                    ],
                  }}
                />
              );
            })}
            <Animated.View
              style={{
                width: BUB,
                height: BUB,
                borderRadius: BUB / 2,
                opacity: v.bubble.interpolate({ inputRange: [0, 0.2], outputRange: [0, 1], extrapolate: 'clamp' }),
                transform: [
                  { scale: Animated.multiply(v.bubble.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }), v.shrink.interpolate({ inputRange: [0, 1], outputRange: [1, 0.42] })) },
                ],
                shadowColor: colors.primary,
                shadowOpacity: 0.25,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 8 },
                elevation: 8,
              }}
            >
              {/* borde de vidrio con los colores de marca */}
              <LinearGradient
                colors={[colors.turquesa, colors.surface, colors.primary]}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1, borderRadius: BUB / 2, padding: 3 }}
              >
                <View style={{ flex: 1, borderRadius: BUB / 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {/* brillo del vidrio */}
                  <LinearGradient
                    colors={[colors.accentSoft, colors.surface]}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.6, y: 0.7 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <VectorLogo width={BUB * 0.52} mark />
                </View>
              </LinearGradient>
            </Animated.View>
          </View>
          <Animated.View
            style={{
              alignItems: 'center',
              marginTop: 22,
              gap: 4,
              opacity: v.text,
              transform: [{ translateY: v.text.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            }}
          >
            <Text style={{ fontFamily: font.semibold, fontSize: 13, letterSpacing: 1.2, color: colors.primary, textTransform: 'uppercase' }}>{req.greeting ?? 'Bienvenido'}</Text>
            <Text style={[type.h1, { textAlign: 'center' }]}>{req.title}</Text>
            <Text style={[type.bodyMuted, { textAlign: 'center' }]}>{req.subtitle}</Text>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
