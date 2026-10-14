import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, font, space, type } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const DOTS = 10;

/**
 * Check verde animado de confirmación (estilo apps de pedidos):
 * el círculo aparece con un rebote, se dibuja el visto y salen anillos y destellos.
 */
export function SuccessCheck({ size = 112, delay = 0 }: { size?: number; delay?: number }) {
  const circle = useRef(new Animated.Value(0)).current;
  const stroke = useRef(new Animated.Value(1)).current; // 1 = sin dibujar, 0 = completo
  const ring = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          circle.setValue(1);
          stroke.setValue(0);
          return;
        }
        // el círculo rebota y, sin esperar a que se detenga, se dibuja el visto
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.spring(circle, { toValue: 1, useNativeDriver: false, stiffness: 260, damping: 14 }),
            Animated.sequence([
              Animated.delay(230),
              Animated.parallel([
                Animated.timing(stroke, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
                Animated.timing(ring, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
                Animated.timing(burst, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
              ]),
            ]),
          ]),
        ]).start();
      });
    return () => {
      cancelled = true;
    };
  }, [circle, stroke, ring, burst, delay]);

  const len = 52; // largo del trazo del visto (en unidades del viewBox)
  const box = size * 1.9;
  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="image" accessibilityLabel="Confirmado">
      {/* anillo que se expande */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: colors.success,
          opacity: ring.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.5, 0] }),
          transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
        }}
      />
      {/* destellos */}
      {Array.from({ length: DOTS }, (_, i) => {
        const a = (i / DOTS) * Math.PI * 2 - Math.PI / 2;
        const d = burst.interpolate({ inputRange: [0, 1], outputRange: [size * 0.45, size * 0.86] });
        const big = i % 2 === 0;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: big ? 9 : 6,
              height: big ? 9 : 6,
              borderRadius: 5,
              backgroundColor: big ? colors.success : colors.turquesa,
              opacity: burst.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 0.8, 0] }),
              transform: [{ translateX: Animated.multiply(d, Math.cos(a)) }, { translateY: Animated.multiply(d, Math.sin(a)) }],
            }}
          />
        );
      })}
      {/* círculo verde con el visto */}
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.success,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.success,
          shadowOpacity: 0.35,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
          opacity: circle.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
          transform: [{ scale: circle }],
        }}
      >
        <Svg width={size * 0.56} height={size * 0.56} viewBox="0 0 56 56">
          <AnimatedPath
            d="M12 29 L24 41 L44 16"
            stroke={colors.white}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={len}
            strokeDashoffset={stroke.interpolate({ inputRange: [0, 1], outputRange: [0, len] })}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Pantalla completa de confirmación que se cierra sola (o al tocar) */
export function SuccessOverlay({
  visible,
  title,
  body,
  onClose,
  duration = 2600,
}: {
  visible: boolean;
  title: string;
  body?: string;
  onClose: () => void;
  duration?: number;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!visible) return;
    fade.setValue(0);
    rise.setValue(0);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 1, duration: 500, delay: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    AccessibilityInfo.announceForAccessibility?.(title);
    const t = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => closeRef.current());
    }, duration);
    return () => clearTimeout(t);
  }, [visible, fade, rise, title, duration]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, opacity: fade }}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={`${title}. Toca para continuar`} style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
          <SuccessCheck size={120} delay={120} />
          <Animated.View style={{ alignItems: 'center', gap: space.sm, opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
            <Text style={[type.h1, { textAlign: 'center' }]}>{title}</Text>
            {body ? <Text style={[type.bodyMuted, { textAlign: 'center', maxWidth: 320 }]}>{body}</Text> : null}
            <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.inkSubtle, marginTop: space.lg }}>Toca para continuar</Text>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
