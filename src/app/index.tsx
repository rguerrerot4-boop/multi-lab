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
  const intro = useRef({
    lift: new Animated.Value(0),
    pop: new Animated.Value(0),
    idle: new Animated.Value(0),
    enter: new Animated.Value(0),
    press: new Animated.Value(0),
  }).current;
  const arrived = useRef(false);
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

  // velocidad del gesto (px/ms) convertida a la escala del recorrido (unidades/s)
  const toLift = (vy: number) => Math.max(-12, Math.min(12, (-vy * 1000) / restY));

  // la burbuja sigue con el impulso del dedo hasta el centro; un poco antes de detenerse
  // empieza a contraerse, y justo al terminar de contraerse nace el logo
  const launch = (velocity = 0) => {
    if (launched.current) return;
    launched.current = true;
    intro.idle.stopAnimation();
    Animated.spring(intro.press, { toValue: 0, stiffness: 300, damping: 24, useNativeDriver: true }).start();
    const id = intro.lift.addListener(({ value }) => {
      if (value >= 0.88) arrive();
    });
    Animated.spring(intro.lift, {
      toValue: 1,
      velocity: Math.max(velocity, 0),
      stiffness: 190,
      damping: 24,
      mass: 1,
      useNativeDriver: true,
    }).start(() => {
      intro.lift.removeListener(id);
      arrive();
    });
  };

  const arrive = () => {
    if (arrived.current || cancelledRef.current) return;
    arrived.current = true;
    setPhase('logo');
    // 1. se contrae acelerando hacia el centro (hasta el tamaño del play)
    Animated.timing(intro.pop, { toValue: 0.42, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      // 2. en ese mismo instante: revienta, nace el play y brotan las cápsulas
      Animated.timing(intro.pop, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      runLogo();
    });
  };

  const springBack = (vy: number) =>
    Animated.spring(intro.lift, { toValue: 0, velocity: toLift(vy), stiffness: 240, damping: 20, useNativeDriver: true }).start();

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !launched.current,
      onMoveShouldSetPanResponder: () => !launched.current,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        intro.idle.stopAnimation();
        intro.lift.stopAnimation();
        // al tocarla se "infla" un poco: respuesta inmediata al dedo
        Animated.spring(intro.press, { toValue: 1, stiffness: 420, damping: 22, useNativeDriver: true }).start();
      },
      onPanResponderMove: (_, g) => {
        if (launched.current) return;
        // sigue al dedo 1:1; hacia abajo cede poco (resistencia elástica)
        const p = g.dy < 0 ? -g.dy / restY : -(1 - 1 / (1 + g.dy / restY / 2)) * 0.25;
        if (p >= 0.8) return launch(toLift(g.vy)); // cerca del centro: se lo "traga" y sigue sola
        intro.lift.setValue(p);
      },
      onPanResponderRelease: (_, g) => {
        if (launched.current) return;
        const p = -g.dy / restY;
        if (p > 0.28 || g.vy < -0.35 || (Math.abs(g.dy) < 6 && Math.abs(g.dx) < 6)) launch(toLift(g.vy));
        else {
          springBack(g.vy);
          Animated.spring(intro.press, { toValue: 0, stiffness: 300, damping: 20, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: (_, g) => {
        if (launched.current) return;
        springBack(g.vy);
        Animated.spring(intro.press, { toValue: 0, stiffness: 300, damping: 20, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const runLogo = () => {
    const cancelled = cancelledRef.current;
    if (cancelled) return;
    const t = (val: Animated.Value, duration: number, delay = 0, easing = ease) =>
      Animated.timing(val, { toValue: 1, duration, delay, easing, useNativeDriver: true });
    const pop = (val: Animated.Value, delay: number) =>
      Animated.spring(val, { toValue: 1, delay, stiffness: 260, damping: 15, mass: 0.9, useNativeDriver: true });
    {
      running.current = Animated.sequence([
        // 1 + 2. las cápsulas llegan casi juntas y, justo cuando encajan, el play aparece con efecto pop
        // en el centro: así los cruces entre cápsulas quedan cubiertos por el play casi de inmediato
        Animated.parallel([
          // el play nace justo cuando la burbuja termina de contraerse
          Animated.spring(v.play, { toValue: 1, stiffness: 320, damping: 13, mass: 0.8, useNativeDriver: true }),
          // las cápsulas brotan desde el centro con rebote y se funden en la cruz
          pop(v.left, 30),
          pop(v.top, 60),
          pop(v.right, 90),
          pop(v.bottom, 120),
          // latido del símbolo cuando la cruz termina de cerrarse
          Animated.sequence([
            Animated.delay(360),
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
            <IntroBubble B={B} restY={restY} lift={intro.lift} pop={intro.pop} idle={intro.idle} enter={intro.enter} press={intro.press} pan={pan.panHandlers} onTap={() => launch()} />

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
  press,
  pan,
  onTap,
}: {
  B: number;
  restY: number;
  lift: Animated.Value;
  pop: Animated.Value;
  idle: Animated.Value;
  enter: Animated.Value;
  press: Animated.Value;
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

      {/* gotas del estallido: salen, se encogen y desaparecen del todo (sin anillo) */}
      {DROPS.map((a, i) => {
        const r = (a * Math.PI) / 180;
        const d = burst.interpolate({ inputRange: [0, 1], outputRange: [B * 0.12, B * (i % 2 ? 0.42 : 0.52)], extrapolate: 'clamp' });
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
              opacity: burst.interpolate({ inputRange: [0, 0.06, 0.35, 0.6], outputRange: [0, 1, 0.7, 0], extrapolate: 'clamp' }),
              transform: [
                { translateX: Animated.multiply(d, Math.cos(r)) },
                { translateY: Animated.multiply(d, Math.sin(r)) },
                { scale: burst.interpolate({ inputRange: [0, 0.15, 0.6], outputRange: [0.4, 1, 0], extrapolate: 'clamp' }) },
              ],
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
            pop.interpolate({ inputRange: [0, 0.42, 0.52], outputRange: [1, 1, 0], extrapolate: 'clamp' }),
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
                  Animated.multiply(
                    idle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }),
                    press.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }),
                  ),
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
