import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { IconName } from '@/data/mock';
import { colors, font, radius, shadow } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const H = 54;
const CHECK_LEN = 30;
const DOTS = 8;

type Phase = 'idle' | 'loading' | 'done';

/**
 * Botón de envío con confirmación animada (estilo apps de pedidos):
 * se encoge a un círculo con carga, se vuelve verde, dibuja un check con un destello
 * y luego continúa (por ejemplo, navega al detalle).
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
  const width = useRef(new Animated.Value(0)).current; // 0 = ancho completo, 1 = círculo
  const spin = useRef(new Animated.Value(0)).current;
  const green = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(CHECK_LEN)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const result = useRef<unknown>(null);
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => () => spinLoop.current?.stop(), []);

  const start = async () => {
    if (phase !== 'idle' || disabled) return;
    result.current = onSubmit();
    const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
    setPhase('loading');
    if (reduce) {
      setPhase('done');
      green.setValue(1);
      check.setValue(0);
      AccessibilityInfo.announceForAccessibility?.(doneLabel);
      setTimeout(() => onDone?.(result.current), 500);
      return;
    }
    spinLoop.current = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 650, easing: Easing.linear, useNativeDriver: true }));
    Animated.timing(width, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start(() => {
      spinLoop.current?.start();
      setTimeout(() => {
        spinLoop.current?.stop();
        setPhase('done');
        AccessibilityInfo.announceForAccessibility?.(doneLabel);
        Animated.sequence([
          Animated.timing(green, { toValue: 1, duration: 220, useNativeDriver: false }),
          Animated.parallel([
            Animated.timing(check, { toValue: 0, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
            Animated.sequence([
              Animated.timing(pop, { toValue: 1.18, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: false }),
              Animated.spring(pop, { toValue: 1, useNativeDriver: false, speed: 12, bounciness: 14 }),
            ]),
            Animated.timing(burst, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
          ]),
          Animated.delay(550),
        ]).start(() => onDone?.(result.current));
      }, 750);
    });
  };

  const animWidth = w ? width.interpolate({ inputRange: [0, 1], outputRange: [w, H] }) : undefined;
  const bg = green.interpolate({ inputRange: [0, 1], outputRange: [colors.primary, colors.success] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const labelOpacity = width.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ alignItems: 'center', height: H, justifyContent: 'center' }}>
      {/* destello de puntos alrededor del check */}
      {phase === 'done'
        ? Array.from({ length: DOTS }, (_, i) => {
            const a = (i / DOTS) * Math.PI * 2;
            const dist = burst.interpolate({ inputRange: [0, 1], outputRange: [14, 56] });
            return (
              <Animated.View
                key={i}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: i % 2 ? 7 : 10,
                  height: i % 2 ? 7 : 10,
                  borderRadius: 5,
                  backgroundColor: i % 2 ? colors.turquesa : colors.success,
                  opacity: burst.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 0.8, 0] }),
                  transform: [{ translateX: Animated.multiply(dist, Math.cos(a)) }, { translateY: Animated.multiply(dist, Math.sin(a)) }],
                }}
              />
            );
          })
        : null}
      <Pressable
        onPress={start}
        onPressIn={() => Animated.spring(press, { toValue: 0.95, useNativeDriver: false, speed: 50, bounciness: 0 }).start()}
        onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: false, speed: 14, bounciness: 14 }).start()}
        disabled={disabled || phase !== 'idle'}
        accessibilityRole="button"
        accessibilityLabel={phase === 'done' ? doneLabel : label}
        accessibilityState={{ disabled: !!disabled, busy: phase === 'loading' }}
      >
        <Animated.View
          style={[
            {
              width: animWidth ?? '100%',
              minWidth: H,
              height: H,
              borderRadius: phase === 'idle' ? radius.md : H / 2,
              backgroundColor: bg,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: disabled ? 0.5 : 1,
              transform: [{ scale: Animated.multiply(press, pop) }],
            },
            !disabled ? shadow.card : null,
          ]}
        >
          {phase === 'idle' ? (
            <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: labelOpacity }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 15, color: colors.white }}>{label}</Text>
              <Ionicons name={icon} size={18} color={colors.white} />
            </Animated.View>
          ) : phase === 'loading' ? (
            <Animated.View
              style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: colors.white, transform: [{ rotate }] }}
            />
          ) : (
            <Svg width={28} height={28} viewBox="0 0 28 28">
              <AnimatedPath d="M6 14.5 L11.5 20 L22 8.5" stroke={colors.white} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={CHECK_LEN} strokeDashoffset={check} />
            </Svg>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}
