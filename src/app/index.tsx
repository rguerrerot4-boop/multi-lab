import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LogoLayer, MARK_CENTER, PLAY_CENTER, VB } from '@/components/AnimatedLogo';
import Login from '@/app/auth/login';
import { colors, font } from '@/theme';

// Splash animado (se dibuja ENCIMA del inicio de sesión, que ya está cargado debajo):
// 1. Las cuatro cápsulas entran desde sus lados y forman la cruz.
// 2. Aparece el botón de play.
// 3. El símbolo se reduce y entra el nombre MULTI LAB.
// 4. El play se "selecciona" (pulsación con onda) y, sin pausa, crece desde su propio tamaño
//    hasta cubrir la pantalla con el color de marca.
// 5. La capa de color se desvanece y deja ver el inicio de sesión, sin cambiar de pantalla,
//    así la transición no se traba esperando a que cargue la siguiente vista.
// El logotipo nunca se rota ni se deforma: solo se mueve, aparece y escala de forma uniforme.

const ease = Easing.out(Easing.cubic);

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
  const skipped = useRef(false);
  const running = useRef<Animated.CompositeAnimation | null>(null);

  const v = useRef({
    left: new Animated.Value(0),
    right: new Animated.Value(0),
    top: new Animated.Value(0),
    bottom: new Animated.Value(0),
    play: new Animated.Value(0),
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
    if (skipped.current) return;
    skipped.current = true;
    running.current?.stop();
    reveal(260);
  };

  useEffect(() => {
    let cancelled = false;
    const t = (val: Animated.Value, duration: number, delay = 0, easing = ease) =>
      Animated.timing(val, { toValue: 1, duration, delay, easing, useNativeDriver: true });

    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        [v.left, v.right, v.top, v.bottom, v.play, v.shift, v.multi, v.lab, v.dot].forEach((a) => a.setValue(1));
        setTimeout(() => !cancelled && skip(), 900);
        return;
      }
      running.current = Animated.sequence([
        // 1. cápsulas
        Animated.parallel([t(v.left, 600, 0), t(v.top, 600, 80), t(v.right, 600, 160), t(v.bottom, 600, 240)]),
        // 2. play
        t(v.play, 360, 0, Easing.out(Easing.back(1.8))),
        Animated.delay(100),
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
        if (finished && !cancelled && !skipped.current) {
          skipped.current = true;
          reveal(380);
        }
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enter = (val: Animated.Value, dx: number, dy: number) => ({
    opacity: val,
    transform: [
      { translateX: val.interpolate({ inputRange: [0, 1], outputRange: [dx * s, 0] }) },
      { translateY: val.interpolate({ inputRange: [0, 1], outputRange: [dy * s, 0] }) },
    ],
  });

  // el símbolo empieza más grande y centrado; al entrar el nombre se reduce a su tamaño final
  const markGroup = {
    transformOrigin: `${(MARK_CENTER.x - VB.x) * s}px ${(MARK_CENTER.y - VB.y) * s}px`,
    transform: [
      { translateX: v.shift.interpolate({ inputRange: [0, 1], outputRange: [markShift, 0] }) },
      { scale: v.shift.interpolate({ inputRange: [0, 1], outputRange: [1.8, 1] }) },
    ],
  };
  const playScale = Animated.multiply(
    v.play.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    v.press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }),
  );
  const playStyle = {
    opacity: Animated.multiply(v.play, v.expand.interpolate({ inputRange: [0, 0.15], outputRange: [1, 0], extrapolate: 'clamp' })),
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
            onPress={skip}
            accessibilityRole="button"
            accessibilityLabel="Multi LAB. Toca para continuar"
            style={{ flex: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
          >
            <Animated.View style={{ width: W, height: H, opacity: logoFade }}>
              <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: W, height: H }, markGroup]}>
                <LogoLayer name="left" scale={s} style={enter(v.left, -46, 0)} />
                <LogoLayer name="right" scale={s} style={enter(v.right, 46, 0)} />
                <LogoLayer name="top" scale={s} style={enter(v.top, 0, -46)} />
                <LogoLayer name="bottom" scale={s} style={enter(v.bottom, 0, 46)} />
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
