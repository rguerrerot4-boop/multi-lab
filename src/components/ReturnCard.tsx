import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { ago } from '@/components/doctor';
import { ProductVisual } from '@/components/ProductVisual';
import { PressableScale, StatusPill, styles } from '@/components/ui';
import { personById, productById, type ReturnItem } from '@/data/mock';
import { colors, radius, space, type } from '@/theme';

/** Tarjeta de una devolución de material */
export function ReturnCard({ r, forRep }: { r: ReturnItem; forRep?: boolean }) {
  const p = productById(r.productId);
  return (
    <PressableScale
      onPress={() => router.push(`/devolucion/${r.id}`)}
      accessibilityLabel={`Devolución ${r.code}, ${r.status}`}
      style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: forRep && r.status === 'Reportada' ? colors.warning : colors.border, padding: space.md, gap: space.sm }}
    >
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Text style={type.label}>
          {r.code} · {ago(r.createdAt)}
        </Text>
        <StatusPill status={r.status} />
      </View>
      <View style={styles.row}>
        {p ? (
          <View style={{ width: 44 }}>
            <ProductVisual product={p} height={44} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={type.h3}>{p?.name}</Text>
          <Text style={type.caption} numberOfLines={1}>
            {forRep ? `${personById(r.doctorId).name} · ` : ''}
            {r.reason} · {r.qty} {r.material.toLowerCase()}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.inkSubtle} />
      </View>
    </PressableScale>
  );
}
