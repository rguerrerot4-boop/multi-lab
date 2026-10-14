import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Avatar, BrandHeader, Button, Card, PressableScale, Screen, SectionHeader, StatusPill, styles } from '@/components/ui';
import { personById, productById } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, radius, space, type } from '@/theme';

// Dashboard del visitador médico
export default function VisitadorInicio() {
  const { userId, unreadNotices, unreadMessages, myRequests, myVisits, myChats } = useMine();
  const me = personById(userId ?? 'v1');
  const today = myVisits.filter((v) => v.dayOffset === 0).sort((a, b) => a.time.localeCompare(b.time));
  const next = today.find((v) => v.status === 'Programada' || v.status === 'En curso');
  const pending = myRequests.filter((r) => r.status === 'Pendiente' || r.status === 'Recibida' || r.status === 'En revisión');
  const recentChats = myChats.filter((c) => c.messages.length).slice(0, 2);
  const date = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen header={<BrandHeader unread={unreadNotices} onBell={() => router.push('/notificaciones')} />}>
      <View style={{ gap: 2 }}>
        <Text style={[type.caption, { textTransform: 'capitalize' }]}>{date}</Text>
        <Text style={type.h1}>Hola, {me.name.split(' ')[0]}</Text>
        <Text style={type.bodyMuted}>
          Tienes {today.length} {today.length === 1 ? 'visita' : 'visitas'} hoy y {pending.length} {pending.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}.
        </Text>
      </View>

      {next ? (
        <View style={{ backgroundColor: colors.primary, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={[type.overline, { color: colors.white }]}>Siguiente visita</Text>
            <StatusPill status={next.status} />
          </View>
          <View style={styles.row}>
            <Avatar initials={personById(next.doctorId).initials} tone="dark" />
            <View style={{ flex: 1 }}>
              <Text style={[type.h3, { color: colors.white }]}>{personById(next.doctorId).name}</Text>
              <Text style={[type.caption, { color: '#DDF1F4' }]}>
                Hoy · {next.time} · {next.place}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {next.productIds.map((id) => (
              <View key={id} style={{ backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={[type.caption, { color: colors.white }]}>{productById(id)?.name}</Text>
              </View>
            ))}
          </View>
          <Button
            label="Iniciar presentación"
            variant="secondary"
            icon="play-circle-outline"
            onPress={() => router.push({ pathname: '/presentacion/[id]', params: { id: next.productIds[0], visita: next.id } })}
          />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <MiniAction icon="document-text-outline" label="Detalle" onPress={() => router.push(`/visita/${next.id}`)} />
            <MiniAction icon="map-outline" label="Mapa" onPress={() => router.push(`/mapa?visita=${next.id}`)} />
          </View>
        </View>
      ) : (
        <Card>
          <Text style={type.h3}>No tienes más visitas hoy</Text>
          <Button label="Ver agenda" variant="secondary" onPress={() => router.push('/visitador/agenda')} />
        </Card>
      )}

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Shortcut icon="grid-outline" label="Catálogo" onPress={() => router.push('/visitador/catalogo')} />
        <Shortcut icon="calendar-outline" label="Agenda" onPress={() => router.push('/visitador/agenda')} />
        <Shortcut icon="map-outline" label="Cobertura" onPress={() => router.push('/mapa')} />
        <Shortcut icon="people-outline" label="Contactos" onPress={() => router.push('/contactos')} />
      </View>

      <SectionHeader title="Solicitudes pendientes" action="Ver todas" onAction={() => router.push('/solicitudes')} />
      {pending.length ? (
        <View style={{ gap: space.sm }}>
          {pending.map((r) => (
            <PressableScale
              key={r.id}
              onPress={() => router.push(`/solicitud/${r.id}`)}
              style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: 6 }}
            >
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <Text style={type.label}>{personById(r.doctorId).name}</Text>
                <StatusPill status={r.status} />
              </View>
              <Text style={type.bodyMuted}>
                {r.type} · {productById(r.productId)?.name}
              </Text>
            </PressableScale>
          ))}
        </View>
      ) : (
        <Card>
          <Text style={type.bodyMuted}>Estás al día. No hay solicitudes pendientes.</Text>
        </Card>
      )}

      <SectionHeader title="Mensajes recientes" action={unreadMessages ? `${unreadMessages} sin leer` : 'Ver'} onAction={() => router.push('/visitador/mensajes')} />
      <View style={{ gap: space.sm }}>
        {recentChats.map((c) => {
          const other = personById(c.members.find((m) => m !== userId)!);
          const last = c.messages[c.messages.length - 1];
          return (
            <PressableScale
              key={c.id}
              onPress={() => router.push(`/chat/${c.id}`)}
              style={[styles.listItem]}
            >
              <Avatar initials={other.initials} tone="dark" size={40} />
              <View style={{ flex: 1 }}>
                <Text style={type.label}>{other.name}</Text>
                <Text style={type.caption} numberOfLines={1}>
                  {last.text}
                </Text>
              </View>
              {userId && c.unreadFor[userId] ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /> : null}
            </PressableScale>
          );
        })}
      </View>
    </Screen>
  );
}

function MiniAction({ icon, label, onPress }: { icon: 'document-text-outline' | 'map-outline'; label: string; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.14)' }}
    >
      <Ionicons name={icon} size={16} color={colors.white} />
      <Text style={[type.label, { color: colors.white }]}>{label}</Text>
    </PressableScale>
  );
}

function Shortcut({ icon, label, onPress }: { icon: 'grid-outline' | 'calendar-outline' | 'map-outline' | 'people-outline'; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: 6 }} accessibilityLabel={label}>
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <Text style={type.caption}>{label}</Text>
    </PressableScale>
  );
}
