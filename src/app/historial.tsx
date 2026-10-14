import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { AppHeader, Avatar, EmptyState, PressableScale, Screen, StatusPill, styles } from '@/components/ui';
import { dayLabel, personById, productById } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, radius, space, type } from '@/theme';

// Historial de visitas recibidas (profesional de salud)
export default function Historial() {
  const { myVisits } = useMine();
  const list = [...myVisits].sort((a, b) => b.dayOffset - a.dayOffset);
  const rep = personById('v1');

  return (
    <Screen header={<AppHeader title="Historial de visitas" />}>
      {list.length === 0 ? (
        <EmptyState icon="time-outline" title="Sin visitas" body="Aún no hay visitas registradas." />
      ) : (
        list.map((v) => (
          <PressableScale
            key={v.id}
            onPress={() => router.push(`/visita/${v.id}`)}
            style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.sm }}
          >
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Text style={type.overline}>
                {dayLabel(v.dayOffset)} · {v.time}
              </Text>
              <StatusPill status={v.status} />
            </View>
            <View style={styles.row}>
              <Avatar initials={rep.initials} size={36} />
              <Text style={[type.h3, { flex: 1 }]}>{rep.name}</Text>
            </View>
            <Text style={type.caption}>Productos: {v.productIds.map((id) => productById(id)?.name).join(', ')}</Text>
          </PressableScale>
        ))
      )}
    </Screen>
  );
}
