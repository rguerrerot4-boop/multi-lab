import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LogoLayer, MARK_CENTER, PLAY_CENTER, VB } from '@/components/AnimatedLogo';
import Login from '@/app/auth/login';
import { colors, font } from '@/theme';

// Splash animado (se dibuja ENCIMA del inicio de sesión, que ya está cargado debajo):
// 0. Una burbuja de vidrio espera abajo; al deslizarla hacia arriba sube al centro y se contrae:
//    ahí empieza la animación del logo (si no se toca, sube sola a los pocos segundos).
// 1. Las cuatro cápsulas entran desde sus lados y forman la cruz.
// 2. Aparece el botón de play.
// 3. El símbolo se reduce y entra el nombre MULTI LAB.
// 4. El play se "selecciona" (pulsación con onda) y, sin pausa, crece desde su propio tamaño
//    hasta cubrir la pantalla con el color de marca.
// 5. La capa de color se desvanece y deja ver el inicio de sesión, sin cambiar de pantalla,
//    así la transición no se traba esperando a que cargue la siguiente vista.
// El logotipo nunca se rota ni se deforma: solo se mueve, aparece y escala de forma uniforme.

const ease = Easing.out(Easing.cubic);
const glide = Easing.bezier(0.16, 1, 0.3, 1); // llegada rápida que frena suave

export default function Splash() {
  const { width, height } = useWindowDimensions();
  const W = Math.min(width * 0.82, 360);
  const s = W / VB.w; // escala del sistema de coordenadas del manual a píxeles
  const H = VB.h * s;
  const D = Math.hypot(width, height) * 2.1; // diámetro que cubre la pantalla desde cualquier punto
  const markShift = (VB.x + VB.w / 2 - MARK_CENTER.x) * s; // para centrar el símbolo solo
  const pcx = (PLAY_CENTER.x - VB.x) * s;
  const pcy = (PLAY_CENTER.y - VB.y) * s;
  const playSize = 40 * s; // diámetro aproximado del play en su tamaño final
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState<'intro' | 'logo'>('intro');
  const B = Math.min(width * 0.6, 250); // diámetro de la burbuja
  const restY = height / 2 - B * 0.2; // distancia del centro de la pantalla a la burbuja en reposo
  const intro = useRef({ lift: new Animated.Value(0), pop: new Animated.Value(0), idle: new Animated.Value(0), enter: new Animated.Value(0) }).current;
  const launched = useRef(false);
  const skipped = useRef(false);
  const running = useRef<Animated.CompositeAnimation | null>(null);

  const v = useRef({
    left: new Animated.Value(0),
    right: new Animated.Value(0),
    top: new Animated.Value(0),
    bottom: new Animated.Value(0),
    play: new Animated.Value(0),
    bump: new Animated.Value(0),
    shift: new Animated.Value(0),
    multi: new Animated.Value(0),
    lab: new Animated.Value(0),
    dot: new Animated.Value(0),
    press: new Animated.Value(0),
    ripple: new Animated.Value(0),
    expand: new Animated.Value(0),
    reveal: new Animated.Value(0),
  }).current;

  // desvanece la capa del splash y la retira
  const reveal = (duration: number) => {
    Animated.timing(v.reveal, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() =>
      setVisible(false),
    );
  };

  const skip = () => {
    if (!launched.current) return launch();
    if (skipped.current) return;
    skipped.current = true;
    running.current?.stop();
    reveal(260);
  };

  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelledRef.current) return;
      if (reduce) {
        intro.enter.setValue(1);
        launched.current = true;
        setPhase('logo');
        [v.left, v.right, v.top, v.bottom, v.play, v.shift, v.multi, v.lab, v.dot].forEach((a) => a.setValue(1));
        setTimeout(() => !cancelledRef.current && skip(), 900);
        return;
      }
      // la burbuja entra desde abajo con rebote líquido y luego "respira" mientras espera
      Animated.spring(intro.enter, { toValue: 1, delay: 150, stiffness: 140, damping: 11, mass: 1, useNativeDriver: true }).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(intro.idle, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(intro.idle, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ).start();
    });
    // si nadie desliza, sube sola
    const auto = setTimeout(() => launch(), 6000);
    return () => {
      cancelledRef.current = true;
      clearTimeout(auto);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // la burbuja termina de subir, se contrae y arranca el logo
  const launch = (velocity = 0) => {
    if (launched.current) return;
    launched.current = true;
    intro.idle.stopAnimation();
    Animated.timing(intro.lift, {
      toValue: 1,
      duration: velocity > 1.2 ? 280 : 420,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start(() => {
      setPhase('logo');
      // la burbuja se contrae hasta el tamaño del play y revienta: de ahí brota el logo
      Animated.timing(intro.pop, { toValue: 1, duration: 760, easing: Easing.linear, useNativeDriver: true }).start();
      runLogo();
    });
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !launched.current,
      onMoveShouldSetPanResponder: (_, g) => !launched.current && Math.abs(g.dy) > 4,
      onPanResponderGrant: () => intro.idle.stopAnimation(),
      onPanResponderMove: (_, g) => {
        if (launched.current) return;
        // sube con el dedo; hacia abajo apenas cede (resistencia)
        const p = g.dy < 0 ? Math.min(1, -g.dy / restY) : -Math.min(0.08, g.dy / restY / 4);
        intro.lift.setValue(p);
      },
      onPanResponderRelease: (_, g) => {
        if (launched.current) return;
        const p = -g.dy / restY;
        if (p > 0.3 || g.vy < -0.6 || Math.abs(g.dy) < 6) launch(-g.vy);
        else Animated.spring(intro.lift, { toValue: 0, stiffness: 260, damping: 18, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => {
        if (!launched.current) Animated.spring(intro.lift, { toValue: 0, stiffness: 260, damping: 18, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const runLogo = () => {
    const cancelled = cancelledRef.current;
    if (cancelled) return;
    const t = (val: Animated.Value, duration: number, delay = 0, easing = ease) =>
      Animated.timing(val, { toValue: 1, duration, delay, easing, useNativeDriver: true });
    const pop = (val: Animated.Value, delay: number) =>
      Animated.spring(val, { toValue: 1, delay, friction: 5, tension: 95, useNativeDriver: true });
    {
      running.current = Animated.sequence([
        // 1 + 2. las cápsulas llegan casi juntas y, justo cuando encajan, el play aparece con efecto pop
        // en el centro: así los cruces entre cápsulas quedan cubiertos por el play casi de inmediato
        Animated.parallel([
          // el play nace justo cuando la burbuja termina de contraerse
          Animated.spring(v.play, { toValue: 1, delay: 330, friction: 4, tension: 90, useNativeDriver: true }),
          // las cápsulas brotan desde el centro con rebote y se funden en la cruz
          pop(v.left, 380),
          pop(v.top, 420),
          pop(v.right, 460),
          pop(v.bottom, 500),
          Animated.sequence([
            Animated.delay(620),
            Animated.timing(v.bump, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(v.bump, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]),
        ]),
        Animated.delay(140),
        // 3. nombre
        Animated.parallel([
          t(v.shift, 600, 0, Easing.inOut(Easing.cubic)),
          t(v.multi, 500, 200),
          t(v.lab, 460, 340),
          t(v.dot, 360, 560, Easing.out(Easing.back(2.4))),
        ]),
        Animated.delay(320),
        // 4 + 5. selección y expansión encadenadas, sin pausa entre ellas
        Animated.parallel([
          Animated.timing(v.press, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          t(v.ripple, 520, 40, Easing.out(Easing.quad)),
          Animated.timing(v.expand, {
            toValue: 1,
            duration: 620,
            delay: 150,
            easing: Easing.bezier(0.65, 0, 0.35, 1),
            useNativeDriver: true,
          }),
        ]),
      ]);
      running.current.start(({ finished }) => {
        if (finished && !cancelledRef.current && !skipped.current) {
          skipped.current = true;
          reveal(380);
        }
      });
    }
  };

  // las cápsulas aparecen opacas casi de inmediato (sin fundidos a medias que ensucian los cruces)
  const enter = (val: Animated.Value, dx: number, dy: number) => ({
    opacity: val.interpolate({ inputRange: [0, 0.12], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [
      { translateX: val.interpolate({ inputRange: [0, 1], outputRange: [dx * s, 0] }) },
      { translateY: val.interpolate({ inputRange: [0, 1], outputRange: [dy * s, 0] }) },
      { scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) },
    ],
  });

  // el símbolo empieza más grande y centrado; al entrar el nombre se reduce a su tamaño final
  const markGroup = {
    transformOrigin: `${(MARK_CENTER.x - VB.x) * s}px ${(MARK_CENTER.y - VB.y) * s}px`,
    transform: [
      { translateX: v.shift.interpolate({ inputRange: [0, 1], outputRange: [markShift, 0] }) },
      {
        scale: Animated.multiply(
          v.shift.interpolate({ inputRange: [0, 1], outputRange: [1.8, 1] }),
          v.bump.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }),
        ),
      },
    ],
  };
  const playScale = Animated.multiply(
    // el resorte pasa de 1 y regresa: efecto pop
    v.play.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1], extrapolate: 'extend' }),
    v.press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }),
  );
  const playStyle = {
    opacity: Animated.multiply(
      v.play.interpolate({ inputRange: [0, 0.12], outputRange: [0, 1], extrapolate: 'clamp' }),
      v.expand.interpolate({ inputRange: [0, 0.15], outputRange: [1, 0], extrapolate: 'clamp' })),
    transform: [{ scale: playScale }],
  };
  const word = (val: Animated.Value) => ({
    opacity: val,
    transform: [{ translateX: val.interpolate({ inputRange: [0, 1], outputRange: [18 * s, 0] }) }],
  });
  const logoFade = v.expand.interpolate({ inputRange: [0, 0.35, 0.7], outputRange: [1, 1, 0], extrapolate: 'clamp' });
  const startScale = playSize / D;

  return (
    <View style={{ flex: 1 }}>
      {/* inicio de sesión ya montado debajo: al terminar el splash solo se descubre */}
      <Login />

      {visible ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: v.reveal.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
        >
          <Pressable
            onPress={phase === 'logo' ? skip : undefined}
            accessibilityRole="button"
            accessibilityLabel={phase === 'logo' ? 'Multi LAB. Toca para continuar' : 'Multi LAB. Desliza hacia arriba para entrar'}
            style={{ flex: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
          >
            {/* 0. burbuja de vidrio para deslizar (detrás del logo: el logo brota de ella) */}
            <IntroBubble B={B} restY={restY} lift={intro.lift} pop={intro.pop} idle={intro.idle} enter={intro.enter} pan={pan.panHandlers} onTap={() => launch()} />

            <Animated.View pointerEvents="none" style={{ width: W, height: H, opacity: logoFade }}>
              <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: W, height: H }, markGroup]}>
                {/* cada cápsula brota desde el centro del play (donde se contrajo la burbuja) */}
                <LogoLayer name="left" scale={s} style={enter(v.left, 24, 6)} />
                <LogoLayer name="right" scale={s} style={enter(v.right, -26, 7)} />
                <LogoLayer name="top" scale={s} style={enter(v.top, -6, 30)} />
                <LogoLayer name="bottom" scale={s} style={enter(v.bottom, -6, -16)} />
                {/* onda de selección */}
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: pcx - 40 * s,
                    top: pcy - 40 * s,
                    width: 80 * s,
                    height: 80 * s,
                    borderRadius: 40 * s,
                    borderWidth: Math.max(2, 2.4 * s),
                    borderColor: colors.turquesa,
                    opacity: v.ripple.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.9, 0] }),
                    transform: [{ scale: v.ripple.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1.6] }) }],
                  }}
                />
                {/* play: blanco + triángulo, escalan juntos desde su centro */}
                <Animated.View
                  style={[
                    { position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: `${pcx}px ${pcy}px` },
                    playStyle,
                  ]}
                >
                  <LogoLayer name="play" scale={s} />
                  <LogoLayer name="tri" scale={s} />
                </Animated.View>
              </Animated.View>
              <LogoLayer name="multi" scale={s} style={word(v.multi)} />
              <LogoLayer name="lab" scale={s} style={word(v.lab)} />
              <LogoLayer
                name="dot"
                scale={s}
                style={{ opacity: v.dot, transform: [{ scale: v.dot.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }] }}
              />
            </Animated.View>

            {/* el play crece desde su propio tamaño hasta cubrir la pantalla */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: width / 2 - W / 2 + pcx - D / 2,
                top: height / 2 - H / 2 + pcy - D / 2,
                width: D,
                height: D,
                borderRadius: D / 2,
                backgroundColor: colors.primary,
                opacity: v.expand.interpolate({ inputRange: [0, 0.02], outputRange: [0, 1], extrapolate: 'clamp' }),
                transform: [{ scale: v.expand.interpolate({ inputRange: [0, 1], outputRange: [startScale, 1] }) }],
              }}
            />

            <Animated.Text
              style={{
                position: 'absolute',
                bottom: 32,
                fontFamily: font.medium,
                fontSize: 12,
                color: colors.inkMuted,
                opacity: Animated.multiply(v.dot, logoFade),
              }}
            >
              Menos materiales. Más conexión.
            </Animated.Text>

          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

type Handlers = ReturnType<typeof PanResponder.create>['panHandlers'];

const DROPS = [0, 45, 90, 135, 180, 225, 270, 315];

/** Burbuja de vidrio que entra con rebote, se desliza hacia arriba y en el centro se contrae y revienta */
function IntroBubble({
  B,
  restY,
  lift,
  pop,
  idle,
  enter,
  pan,
  onTap,
}: {
  B: number;
  restY: number;
  lift: Animated.Value;
  pop: Animated.Value;
  idle: Animated.Value;
  enter: Animated.Value;
  pan: Handlers;
  onTap: () => void;
}) {
  const gone = pop.interpolate({ inputRange: [0, 0.01], outputRange: [1, 0], extrapolate: 'clamp' });
  const shown = enter.interpolate({ inputRange: [0.3, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const hint = Animated.multiply(
    Animated.multiply(lift.interpolate({ inputRange: [-0.1, 0, 0.25], outputRange: [1, 1, 0], extrapolate: 'clamp' }), gone),
    shown,
  );
  // se contrae hasta el tamaño del play (≈30 %) y revienta
  const popScale = pop.interpolate({ inputRange: [0, 0.42, 0.5, 1], outputRange: [1, 0.3, 0.34, 0.5], extrapolate: 'clamp' });
  const burst = pop.interpolate({ inputRange: [0, 0.42, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });
  return (
    <>
      {/* frase superior: la burbuja la "atraviesa" al subir */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: '30%',
          left: 32,
          right: 32,
          alignItems: 'center',
          opacity: Animated.multiply(
            Animated.multiply(lift.interpolate({ inputRange: [0, 0.35, 0.6], outputRange: [1, 1, 0], extrapolate: 'clamp' }), gone),
            shown,
          ),
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0], extrapolate: 'clamp' }) },
            { scale: lift.interpolate({ inputRange: [0, 0.6], outputRange: [1, 1.08], extrapolate: 'clamp' }) },
          ],
        }}
      >
        <Text style={{ fontFamily: font.semibold, fontSize: 22, lineHeight: 30, color: colors.ink, textAlign: 'center' }}>
          La visita médica,{'\n'}más cerca.
        </Text>
      </Animated.View>

      {/* anillo y gotas del estallido */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: B,
          height: B,
          borderRadius: B / 2,
          borderWidth: 3,
          borderColor: colors.turquesa,
          opacity: burst.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 0.9, 0] }),
          transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.25] }) }],
        }}
      />
      {DROPS.map((a, i) => {
        const r = (a * Math.PI) / 180;
        const d = burst.interpolate({ inputRange: [0, 1], outputRange: [B * 0.14, B * (i % 2 ? 0.62 : 0.78)] });
        const size = i % 2 ? 7 : 10;
        return (
          <Animated.View
            key={a}
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: i % 3 === 0 ? colors.primary : colors.turquesa,
              opacity: burst.interpolate({ inputRange: [0, 0.08, 0.7, 1], outputRange: [0, 1, 0.8, 0] }),
              transform: [{ translateX: Animated.multiply(d, Math.cos(r)) }, { translateY: Animated.multiply(d, Math.sin(r)) }],
            }}
          />
        );
      })}

      <Animated.View
        {...pan}
        style={{
          position: 'absolute',
          width: B,
          height: B,
          borderRadius: B / 2,
          // @ts-expect-error solo web: evita que el navegador use el gesto para desplazar
          touchAction: 'none',
          cursor: 'grab',
          opacity: Animated.multiply(
            pop.interpolate({ inputRange: [0, 0.44, 0.56], outputRange: [1, 1, 0], extrapolate: 'clamp' }),
            enter.interpolate({ inputRange: [0, 0.15], outputRange: [0, 1], extrapolate: 'clamp' }),
          ),
          transform: [
            // entra desde abajo con rebote
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [restY + B * 1.3, restY] }) },
            // y sube con el dedo hasta el centro
            { translateY: lift.interpolate({ inputRange: [-0.1, 1], outputRange: [restY * 0.1, -restY] }) },
            // efecto líquido: se estira al moverse y se aplasta al frenar
            {
              scaleX: Animated.multiply(
                enter.interpolate({ inputRange: [0, 0.8, 1, 1.12], outputRange: [0.9, 0.95, 1, 1.07] }),
                lift.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0.94, 1], extrapolate: 'clamp' }),
              ),
            },
            {
              scaleY: Animated.multiply(
                enter.interpolate({ inputRange: [0, 0.8, 1, 1.12], outputRange: [1.12, 1.05, 1, 0.93] }),
                lift.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 1.08, 1], extrapolate: 'clamp' }),
              ),
            },
            {
              scale: Animated.multiply(
                Animated.multiply(
                  lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86], extrapolate: 'clamp' }),
                  idle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }),
                ),
                popScale,
              ),
            },
          ],
          shadowColor: colors.primary,
          shadowOpacity: 0.18,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 10 },
          elevation: 6,
        }}
      >
        <View accessible accessibilityRole="button" accessibilityLabel="Entrar a Multi LAB" onAccessibilityTap={onTap} style={{ flex: 1 }}>
          {/* aro de vidrio con los colores de marca */}
          <LinearGradient
            colors={[colors.surface, colors.turquesa, colors.primary]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ flex: 1, borderRadius: B / 2, padding: 2 }}
          >
            <View style={{ flex: 1, borderRadius: B / 2, backgroundColor: colors.glass, overflow: 'hidden' }}>
              {/* brillo inferior: se enciende al deslizar y al contraerse */}
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    opacity: Animated.add(
                      lift.interpolate({ inputRange: [0, 0.06, 0.5, 1], outputRange: [0.45, 1, 0.5, 0.15], extrapolate: 'clamp' }),
                      pop.interpolate({ inputRange: [0, 0.4], outputRange: [0, 0.85], extrapolate: 'clamp' }),
                    ),
                  },
                ]}
              >
                <LinearGradient colors={[colors.clear, colors.clear, colors.accentSoft, colors.turquesa]} locations={[0, 0.55, 0.8, 1]} style={{ flex: 1 }} />
              </Animated.View>
              {/* reflejo superior */}
              <View
                style={{
                  position: 'absolute',
                  top: B * 0.1,
                  left: B * 0.2,
                  width: B * 0.32,
                  height: B * 0.12,
                  borderRadius: B,
                  backgroundColor: colors.surface,
                  opacity: 0.9,
                  transform: [{ rotate: '-18deg' }],
                }}
              />
            </View>
          </LinearGradient>
        </View>
      </Animated.View>

      {/* indicación inferior */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: 36, alignItems: 'center', gap: 2, opacity: hint }}>
        <Animated.View style={{ transform: [{ translateY: idle.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }}>
          <Ionicons name="chevron-up" size={20} color={colors.primary} />
        </Animated.View>
        <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.inkMuted }}>Desliza hacia arriba para entrar</Text>
      </Animated.View>
    </>
  );
}
