import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Product } from '@/data/mock';
import { colors, font, radius, space, type } from '@/theme';
import { PressableScale, Tag, logoMark } from './ui';

// Composición visual del producto (sustituye fotografías reales en el prototipo).
// Usa las cápsulas del logotipo como recurso gráfico, sin alterar el logo.
export function ProductVisual({ product, height = 150, view = 0 }: { product: Product; height?: number; view?: number }) {
  const dark = product.hue === colors.petroleo;
  const start = product.hue;
  const end = dark ? '#2F4E56' : colors.primary;
  const pack = height * 0.62;
  return (
    <LinearGradient
      colors={view === 1 ? [colors.petroleo, '#2F4E56'] : [start, end]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.wrap, { height }]}
    >
      {/* cápsulas decorativas */}
      <View style={[s.capsH, { top: height * 0.12, left: -height * 0.2, width: height * 0.9, height: height * 0.28 }]} />
      <View style={[s.capsV, { right: height * 0.12, top: -height * 0.15, width: height * 0.28, height: height * 0.9 }]} />

      {view === 2 ? (
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Ionicons name={product.icon} size={height * 0.36} color={colors.white} />
          <Text style={[s.packTitle, { color: colors.white, fontSize: Math.max(12, height * 0.09) }]}>{product.form}</Text>
        </View>
      ) : (
        <View style={[s.pack, { width: pack * 0.72, height: pack }]}>
          <View style={[s.packCap, { width: pack * 0.36 }]} />
          <Image source={logoMark} style={{ width: pack * 0.22, height: pack * 0.21 }} resizeMode="contain" />
          <Text style={[s.packTitle, { fontSize: Math.max(9, pack * 0.085) }]} numberOfLines={1} adjustsFontSizeToFit>
            {product.name.split(' ')[0]}
          </Text>
          <View style={[s.packBand, { backgroundColor: product.hue === colors.turquesa ? colors.primary : colors.turquesa }]} />
        </View>
      )}
    </LinearGradient>
  );
}

export function ProductCard({
  product,
  onPress,
  onAction,
  actionLabel,
}: {
  product: Product;
  onPress: () => void;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <PressableScale onPress={onPress} style={s.card} accessibilityLabel={`Ver ficha de ${product.name}`}>
      <ProductVisual product={product} height={128} />
      <View style={{ padding: space.md, gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Text style={type.overline}>{product.category}</Text>
          {product.isNew ? <Tag label="Nuevo" tone="accent" /> : null}
        </View>
        <Text style={type.h3} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={type.bodyMuted} numberOfLines={2}>
          {product.tagline}
        </Text>
        <Text style={type.caption}>{product.lab} (ficticio)</Text>
        {onAction ? (
          <Pressable onPress={onAction} style={s.cardAction} accessibilityRole="button" hitSlop={6}>
            <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
            <Text style={[type.label, { color: colors.primary }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: radius.lg },
  capsH: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  capsV: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)' },
  pack: {
    backgroundColor: colors.white,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  packCap: { position: 'absolute', top: 0, height: 8, backgroundColor: colors.petroleo, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  packTitle: { fontFamily: font.bold, color: colors.ink, textAlign: 'center' },
  packBand: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 10 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    padding: 6,
  },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
});
