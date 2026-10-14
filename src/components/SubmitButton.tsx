import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { IconName } from '@/data/mock';
import { colors, font, shadow } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const H = 54;
const CHECK_LEN = 24;
const PIECES = 20;
const CONFETTI = [colors.primary, colors.turquesa, colors.petroleo, '#3FA7B5', '#A7E3EA'];

type Phase = 'idle' | 'loading' | 'done';

/**
 * Botón de envío con confirmación (estilo de la referencia):
 * se encoge, muestra tres puntos de carga, explota confeti y vuelve con "✓ Enviado".
 */
export function SubmitButton({
  label,
  icon = 'send',
  doneLabel = '¡Listo!',
  disabled,
  onSubmit,
  onDone,
}: {
  label: string;
  icon?: IconName;
  doneLabel?: string;
  disabled?: boolean;
  /** se ejecuta al tocar (guarda los datos); lo que devuelva se pasa a onDone */
  onSubmit: () => unknown;
  /** se ejecuta al terminar la animación */
  onDone?: (result: unknown) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [w, setW] = useState(0);
  const shrink = useRef(new Animated.Value(0)).current; // 0 ancho completo · 1 encogido
  const dots = useRef(new Animated.Value(0)).current;
  const confetti = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(CHECK_LEN)).current;
  const doneIn = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const result = useRef<unknown>(null);
  const dotsLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => () => dotsLoop.current?.stop(), []);

  // trayectorias del confeti: salen hacia arriba en abanico y caen con gravedad
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
        const speed = 120 + Math.random() * 100;
        const vx = Math.cos(ang) * speed;
        const vy = Math.sin(ang) * speed;
        const g = 240 + Math.random() * 60;
        const ts = [0, 0.25, 0.5, 0.75, 1];
        return {
          color: CONFETTI[i % CONFETTI.length],
          w: 6 + Math.random() * 6,
          h: 4 + Math.random() * 4,
          x: ts.map((t) => vx * t * 1.6),
          y: ts.map((t) => vy * t * 1.6 + g * t * t),
          spin: `${(Math.random() > 0.5 ? 1 : -1) * (240 + Math.random() * 360)}deg`,
          startX: Math.random() - 0.5, // fracción del ancho del botón
        };
      }),
    [],
  );

  const start = async () => {
    if (phase !== 'idle' || disabled) return;
    result.current = onSubmit();
    const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
    setPhase('loading');
    if (reduce) {
      setPhase('done');
      doneIn.setValue(1);
      check.setValue(0);
      AccessibilityInfo.announceForAccessibility?.(doneLabel);
      setTimeout(() => onDone?.(result.current), 700);
      return;
    }
    dotsLoop.current = Animated.loop(Animated.timing(dots, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    dotsLoop.current.start();
    Animated.timing(shrink, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();
    setTimeout(() => {
      dotsLoop.current?.stop();
      setPhase('done');
      AccessibilityInfo.announceForAccessibility?.(doneLabel);
      Animated.parallel([
        Animated.timing(confetti, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shrink, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(doneIn, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(150),
          Animated.timing(check, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        ]),
      ]).start(() => setTimeout(() => onDone?.(result.current), 350));
    }, 1100);
  };

  const width = w ? shrink.interpolate({ inputRange: [0, 1], outputRange: [w, w * 0.88] }) : undefined;
  const dot = (i: number) =>
    dots.interpolate({
      inputRange: [0, 0.15 + i * 0.15, 0.3 + i * 0.15, 0.45 + i * 0.15, 1],
      outputRange: [0, 0, -4, 0, 0],
    });

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ alignItems: 'center', height: H, justifyContent: 'center' }}>
      <Pressable
        onPress={start}
        onPressIn={() => Animated.timing(press, { toValue: 0.98, duration: 110, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()}
        onPressOut={() => Animated.timing(press, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()}
        disabled={disabled || phase !== 'idle'}
        accessibilityRole="button"
        accessibilityLabel={phase === 'done' ? doneLabel : label}
        accessibilityState={{ disabled: !!disabled, busy: phase === 'loading' }}
      >
        <Animated.View
          style={[
            {
              width: width ?? '100%',
              height: H,
              borderRadius: H / 2,
              backgroundColor: phase === 'idle' ? colors.primary : colors.petroleo,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: disabled ? 0.5 : 1,
              transform: [{ scale: press }],
            },
            !disabled ? shadow.card : null,
          ]}
        >
          {phase === 'idle' ? (
            <>
              <Ionicons name={icon} size={18} color={colors.white} />
              <Text style={{ fontFamily: font.semibold, fontSize: 15, color: colors.white }}>{label}</Text>
            </>
          ) : phase === 'loading' ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[0, 1, 2].map((i) => (
                <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.turquesa, transform: [{ translateY: dot(i) }] }} />
              ))}
            </View>
          ) : (
            <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: doneIn, transform: [{ scale: doneIn.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}>
              <Svg width={20} height={20} viewBox="0 0 20 20">
                <AnimatedPath d="M3.5 10.5 L8 15 L16.5 5.5" stroke={colors.turquesa} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={CHECK_LEN} strokeDashoffset={check} />
              </Svg>
              <Text style={{ fontFamily: font.semibold, fontSize: 15, color: colors.white }}>{doneLabel}</Text>
            </Animated.View>
          )}
        </Animated.View>
      </Pressable>

      {/* confeti, por encima del botón */}
      {phase === 'done'
        ? pieces.map((p, i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: (w || 0) / 2 + p.startX * (w || 0) * 0.6,
                top: H / 2,
                width: p.w,
                height: p.h,
                borderRadius: 1,
                backgroundColor: p.color,
                opacity: confetti.interpolate({ inputRange: [0, 0.05, 0.75, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateX: confetti.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: p.x }) },
                  { translateY: confetti.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: p.y }) },
                  { rotate: confetti.interpolate({ inputRange: [0, 1], outputRange: ['0deg', p.spin] }) },
                ],
              }}
            />
          ))
        : null}
    </View>
  );
}
