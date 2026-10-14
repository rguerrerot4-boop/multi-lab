import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Product } from '@/data/mock';
import { colors, font, radius, space, type } from '@/theme';
import { ProductVisual } from './ProductVisual';
import { Tag } from './ui';

// Tarjeta del catálogo con vista rápida: al tocarla gira en 3D y muestra la información clave por detrás.
export function FlipCard({
  product,
  onOpen,
  onAction,
  actionLabel,
  actionIcon,
}: {
  product: Product;
  onOpen: () => void;
  onAction: () => void;
  actionLabel: string;
  actionIcon: 'play-circle-outline' | 'add-circle-outline';
}) {
  const flip = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const [back, setBack] = useState(false);

  const toggle = () => {
    const to = back ? 0 : 1;
    setBack(!back);
    Animated.spring(flip, { toValue: to, friction: 7, tension: 45, useNativeDriver: true }).start();
  };
  const pressTo = (v: number) => Animated.spring(press, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  const frontRot = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRot = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const lift = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.04, 1] });
  // respaldo para navegadores: se oculta la cara que queda de espaldas a mitad del giro
  const frontOp = flip.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [1, 1, 0, 0] });
  const backOp = flip.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [0, 0, 1, 1] });

  return (
    <Animated.View style={{ transform: [{ scale: Animated.multiply(press, lift) }] }}>
      {/* frente */}
      <Animated.View
        pointerEvents={back ? 'none' : 'auto'}
        style={[s.face, { opacity: frontOp, transform: [{ perspective: 900 }, { rotateY: frontRot }] }]}
      >
        <Pressable
          onPress={toggle}
          onPressIn={() => pressTo(0.97)}
          onPressOut={() => pressTo(1)}
          accessibilityRole="button"
          accessibilityLabel={`Vista rápida de ${product.name}`}
        >
          <ProductVisual product={product} height={128} />
          <View style={{ padding: space.md, gap: 4 }}>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <Text style={type.overline}>{product.category}</Text>
              {product.isNew ? <Tag label="Nuevo" tone="accent" /> : null}
            </View>
            <Text style={type.h3} numberOfLines={2}>
              {product.name}
            </Text>
            <Text style={type.bodyMuted} numberOfLines={2}>
              {product.tagline}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="sync-outline" size={14} color={colors.primary} />
              <Text style={[type.caption, { color: colors.primary }]}>Toca para vista rápida</Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>

      {/* reverso */}
      <Animated.View
        pointerEvents={back ? 'auto' : 'none'}
        style={[
          s.face,
          StyleSheet.absoluteFill,
          s.back,
          { opacity: backOp, transform: [{ perspective: 900 }, { rotateY: backRot }] },
        ]}
      >
        <Pressable onPress={toggle} style={{ flex: 1, gap: 6 }} accessibilityRole="button" accessibilityLabel="Volver al frente">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[type.overline, { color: colors.turquesa }]}>Vista rápida</Text>
            <Ionicons name="close" size={18} color="#B9CCD0" />
          </View>
          <Text style={[type.h3, { color: colors.white }]} numberOfLines={2}>
            {product.name}
          </Text>
          {[product.form, ...product.uses.slice(0, 2)].map((t) => (
            <View key={t} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.turquesa, marginTop: 6 }} />
              <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: '#D5E2E5' }} numberOfLines={2}>
                {t}
              </Text>
            </View>
          ))}
        </Pressable>
        <View style={{ gap: 6 }}>
          <Pressable onPress={onOpen} style={[s.backBtn, { backgroundColor: colors.turquesa }]} accessibilityRole="button">
            <Ionicons name="cube-outline" size={15} color={colors.petroleo} />
            <Text style={[s.backBtnText, { color: colors.petroleo }]}>Ficha y 3D</Text>
          </Pressable>
          <Pressable onPress={onAction} style={[s.backBtn, { borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }]} accessibilityRole="button">
            <Ionicons name={actionIcon} size={15} color={colors.white} />
            <Text style={[s.backBtnText, { color: colors.white }]}>{actionLabel}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  face: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    padding: 6,
    backfaceVisibility: 'hidden',
  },
  back: { backgroundColor: colors.petroleo, borderColor: colors.petroleo, padding: space.md, justifyContent: 'space-between' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  backBtnText: { fontFamily: font.semibold, fontSize: 13 },
});
