import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { IconName } from '@/data/mock';
import { colors, font } from '@/theme';

export interface BubbleTab {
  name: string;
  title: string;
  icon: IconName;
  iconOn: IconName;
  badge?: number;
}

const BAR_H = 62;
const BUBBLE = 50;
const RING = 6; // borde blanco: la barra se "levanta" alrededor de la burbuja
const LIFT = 20;

/**
 * Barra inferior con burbuja: el ícono activo sube dentro de un círculo que "recorta" la barra
 * y se desliza con rebote hasta la pestaña tocada.
 */
export function BubbleTabBar({
  tabs,
  index,
  onPress,
}: {
  tabs: BubbleTab[];
  index: number;
  onPress: (i: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(index)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      x.setValue(index);
      return;
    }
    pop.setValue(0);
    Animated.parallel([
      // rápido y con un solo rebote al llegar
      Animated.spring(x, { toValue: index, useNativeDriver: true, stiffness: 320, damping: 19, mass: 0.9 }),
      Animated.sequence([
        Animated.delay(70),
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, stiffness: 380, damping: 16 }),
      ]),
    ]).start();
  }, [index, x, pop]);

  const slot = w / Math.max(1, tabs.length);
  const outer = BUBBLE + RING * 2;
  const translateX = x.interpolate({
    inputRange: tabs.map((_, i) => i),
    outputRange: tabs.map((_, i) => i * slot + slot / 2 - outer / 2),
  });
  const active = tabs[index];

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{
        backgroundColor: colors.surface,
        height: BAR_H + insets.bottom,
        paddingBottom: insets.bottom,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        shadowColor: colors.petroleo,
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -2 },
        elevation: 12,
      }}
      accessibilityRole="tablist"
    >
      {/* burbuja deslizante */}
      {w && slot && tabs.length > 1 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -LIFT - RING,
            left: 0,
            width: outer,
            height: outer,
            borderRadius: outer / 2,
            backgroundColor: colors.surface,
            shadowColor: colors.petroleo,
            shadowOpacity: 0.1,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: -3 },
            elevation: 8,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ translateX }],
          }}
        >
          <View
            style={{
              width: BUBBLE,
              height: BUBBLE,
              borderRadius: BUBBLE / 2,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: colors.primary,
              shadowOpacity: 0.35,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
          >
            <Animated.View style={{ opacity: pop.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }), transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
              <Ionicons name={active?.iconOn ?? 'ellipse'} size={23} color={colors.white} />
            </Animated.View>
          </View>
        </Animated.View>
      ) : null}

      <View style={{ flex: 1, flexDirection: 'row' }}>
        {tabs.map((t, i) => {
          const on = i === index;
          return (
            <Pressable
              key={t.name}
              onPress={() => onPress(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t.badge ? `${t.title}, ${t.badge} nuevos` : t.title}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8, gap: 3 }}
            >
              <View style={{ height: 24, justifyContent: 'center' }}>
                {on ? null : <Ionicons name={t.icon} size={22} color={colors.inkMuted} />}
                {t.badge && !on ? (
                  <View style={{ position: 'absolute', top: -4, right: -10, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                    <Text style={{ color: colors.white, fontFamily: font.bold, fontSize: 10 }}>{t.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontFamily: on ? font.bold : font.semibold, fontSize: 11, color: on ? colors.primary : colors.inkMuted }}>{t.title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

