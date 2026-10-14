import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { AppHeader, EmptyState, Screen, styles } from '@/components/ui';
import type { IconName, Notice } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, radius, space, type } from '@/theme';

const ICON: Record<Notice['kind'], IconName> = {
  mensaje: 'chatbubble-outline',
  solicitud: 'document-text-outline',
  visita: 'calendar-outline',
  producto: 'sparkles-outline',
};

// Centro de notificaciones: cada aviso lleva al módulo correspondiente
export default function Notificaciones() {
  const { myNotices, markNoticeRead, markAllNoticesRead, unreadNotices } = useMine();

  return (
    <Screen
      header={
        <AppHeader
          title="Notificaciones"
          right={
            unreadNotices ? (
              <Pressable onPress={markAllNoticesRead} accessibilityRole="button" hitSlop={8}>
                <Text style={[type.caption, { color: colors.primary }]}>Leer todo</Text>
              </Pressable>
            ) : undefined
          }
        />
      }
    >
      {myNotices.length === 0 ? (
        <EmptyState icon="notifications-off-outline" title="Sin notificaciones" body="Aquí verás mensajes, solicitudes y recordatorios." />
      ) : (
        <View style={{ gap: space.sm }}>
          {myNotices.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => {
                markNoticeRead(n.id);
                router.push(n.href as never);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.listItem,
                { alignItems: 'flex-start', opacity: pressed ? 0.75 : 1 },
                !n.read && { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
              ]}
            >
              <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: n.read ? colors.bg : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={ICON[n.kind]} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.label}>{n.title}</Text>
                <Text style={type.bodyMuted}>{n.body}</Text>
                <Text style={type.caption}>{n.at}</Text>
              </View>
              {!n.read ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 }} /> : null}
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
