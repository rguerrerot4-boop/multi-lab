import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar, BrandHeader, Button, EmptyState, PressableScale, Screen, StatusPill, styles } from '@/components/ui';
import { dateFor, dayLabel, personById, productById } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, font, radius, space, type } from '@/theme';

const DAYS = [-1, 0, 1, 2, 3, 4, 5, 6];

export default function Agenda() {
  const { myVisits, unreadNotices } = useMine();
  const [day, setDay] = useState(0);
  const list = myVisits.filter((v) => v.dayOffset === day).sort((a, b) => a.time.localeCompare(b.time));
  const month = dateFor(day).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });

  return (
    <Screen header={<BrandHeader unread={unreadNotices} onBell={() => router.push('/notificaciones')} />}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <View>
          <Text style={type.h1}>Agenda</Text>
          <Text style={[type.bodyMuted, { textTransform: 'capitalize' }]}>{month}</Text>
        </View>
        <Button label="Mapa" icon="map-outline" variant="secondary" small onPress={() => router.push('/mapa')} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {DAYS.map((d) => {
          const date = dateFor(d);
          const on = d === day;
          const count = myVisits.filter((v) => v.dayOffset === d).length;
          return (
            <Pressable
              key={d}
              onPress={() => setDay(d)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${dayLabel(d)}, ${count} visitas`}
              style={{
                width: 58,
                paddingVertical: 10,
                borderRadius: radius.md,
                alignItems: 'center',
                gap: 2,
                backgroundColor: on ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: on ? colors.primary : colors.border,
              }}
            >
              <Text style={{ fontFamily: font.medium, fontSize: 11, color: on ? colors.white : colors.inkMuted, textTransform: 'capitalize' }}>
                {date.toLocaleDateString('es-EC', { weekday: 'short' }).replace('.', '')}
              </Text>
              <Text style={{ fontFamily: font.bold, fontSize: 18, color: on ? colors.white : colors.ink }}>{date.getDate()}</Text>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: count ? (on ? colors.turquesa : colors.primary) : 'transparent' }} />
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={type.h3}>
        {dayLabel(day)} · {list.length} {list.length === 1 ? 'visita' : 'visitas'}
      </Text>

      {list.length === 0 ? (
        <EmptyState icon="calendar-clear-outline" title="Día libre" body="No tienes visitas programadas para este día." />
      ) : (
        <View style={{ gap: space.md }}>
          {list.map((v) => {
            const doc = personById(v.doctorId);
            return (
              <View key={v.id} style={{ flexDirection: 'row', gap: space.md }}>
                <View style={{ alignItems: 'center', width: 48 }}>
                  <Text style={type.label}>{v.time}</Text>
                  <View style={{ flex: 1, width: 2, backgroundColor: colors.border, marginTop: 6 }} />
                </View>
                <PressableScale
                  onPress={() => router.push(`/visita/${v.id}`)}
                  style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: space.sm }}
                  accessibilityLabel={`Visita con ${doc.name} a las ${v.time}`}
                >
                  <View style={[styles.row, { justifyContent: 'space-between' }]}>
                    <StatusPill status={v.status} />
                    <Ionicons name="chevron-forward" size={18} color={colors.inkSubtle} />
                  </View>
                  <View style={styles.row}>
                    <Avatar initials={doc.initials} size={36} tone="dark" />
                    <View style={{ flex: 1 }}>
                      <Text style={type.h3}>{doc.name}</Text>
                      <Text style={type.caption}>{doc.title}</Text>
                    </View>
                  </View>
                  <View style={styles.row}>
                    <Ionicons name="location-outline" size={14} color={colors.inkMuted} />
                    <Text style={[type.caption, { flex: 1 }]} numberOfLines={1}>
                      {v.place}
                    </Text>
                  </View>
                  <Text style={type.caption}>Productos: {v.productIds.map((id) => productById(id)?.name).join(', ')}</Text>
                </PressableScale>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
