import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, useWindowDimensions } from 'react-native';
import { LogoLayer, MARK_CENTER, PLAY_CENTER, VB } from '@/components/AnimatedLogo';
import { colors, font } from '@/theme';

// Splash animado:
// 1. Las cuatro cápsulas entran desde sus lados y forman la cruz.
// 2. Aparece el botón de play.
// 3. El símbolo se desplaza y entra el nombre MULTI LAB.
// 4. El play se "selecciona" (pulsación con onda).
// 5. Desde el play se expande el color de marca hasta cubrir la pantalla y se abre el inicio de sesión.
// El logotipo nunca se rota ni se deforma: solo se mueve, aparece y escala de forma uniforme.

const ease = Easing.out(Easing.cubic);

export default function Splash() {
  const { width, height } = useWindowDimensions();
  const W = Math.min(width * 0.82, 360);
  const s = W / VB.w; // escala del sistema de coordenadas del manual a píxeles
  const H = VB.h * s;
  const D = Math.hypot(width, height) * 2.2; // diámetro del círculo que cubre la pantalla
  const markShift = (VB.x + VB.w / 2 - MARK_CENTER.x) * s; // para centrar el símbolo solo
  const pcx = (PLAY_CENTER.x - VB.x) * s;
  const pcy = (PLAY_CENTER.y - VB.y) * s;
  const [done, setDone] = useState(false);

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
  }).current;

  const go = () => {
    if (done) return;
    setDone(true);
    router.replace('/auth/login');
  };

  useEffect(() => {
    let cancelled = false;
    const t = (val: Animated.Value, duration: number, delay = 0, easing = ease) =>
      Animated.timing(val, { toValue: 1, duration, delay, easing, useNativeDriver: true });

    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        Object.values(v).forEach((a) => a !== v.press && a !== v.ripple && a !== v.expand && a.setValue(1));
        setTimeout(() => !cancelled && go(), 900);
        return;
      }
      Animated.sequence([
        // 1. cápsulas
        Animated.parallel([t(v.left, 620, 0), t(v.top, 620, 90), t(v.right, 620, 180), t(v.bottom, 620, 270)]),
        // 2. play
        t(v.play, 380, 0, Easing.out(Easing.back(1.8))),
        Animated.delay(120),
        // 3. nombre
        Animated.parallel([
          t(v.shift, 620, 0, Easing.inOut(Easing.cubic)),
          t(v.multi, 520, 220),
          t(v.lab, 480, 380),
          t(v.dot, 380, 620, Easing.out(Easing.back(2.4))),
        ]),
        Animated.delay(380),
        // 4. selección del play
        Animated.parallel([
          Animated.sequence([
            Animated.timing(v.press, { toValue: 1, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(v.press, { toValue: 0, duration: 220, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
          ]),
          t(v.ripple, 650, 60, Easing.out(Easing.quad)),
        ]),
        // 5. expansión
        Animated.timing(v.expand, { toValue: 1, duration: 650, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => finished && !cancelled && go());
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
    v.press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }),
  );
  const playStyle = { opacity: v.play, transform: [{ scale: playScale }] };
  const word = (val: Animated.Value) => ({
    opacity: val,
    transform: [{ translateX: val.interpolate({ inputRange: [0, 1], outputRange: [18 * s, 0] }) }],
  });
  const logoFade = v.expand.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1, 0] });

  return (
    <Pressable
      onPress={go}
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
          {/* play: blanco + triángulo, escalan juntos desde su centro */}
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: W, height: H }, playStyle, { transformOrigin: `${pcx}px ${pcy}px` }]}>
            <LogoLayer name="play" scale={s} />
            <LogoLayer name="tri" scale={s} />
          </Animated.View>
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
        </Animated.View>
        <LogoLayer name="multi" scale={s} style={word(v.multi)} />
        <LogoLayer name="lab" scale={s} style={word(v.lab)} />
        <LogoLayer
          name="dot"
          scale={s}
          style={{ opacity: v.dot, transform: [{ scale: v.dot.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }] }}
        />
      </Animated.View>

      {/* el play se expande hacia la pantalla */}
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
          opacity: v.expand.interpolate({ inputRange: [0, 0.01, 1], outputRange: [0, 1, 1] }),
          transform: [{ scale: v.expand.interpolate({ inputRange: [0, 1], outputRange: [0.004, 1] }) }],
        }}
      />

      <Animated.Text
        style={{
          position: 'absolute',
          bottom: 32,
          fontFamily: font.medium,
          fontSize: 12,
          color: colors.inkMuted,
          opacity: v.dot.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
        }}
      >
        Menos materiales. Más conexión.
      </Animated.Text>
    </Pressable>
  );
}
